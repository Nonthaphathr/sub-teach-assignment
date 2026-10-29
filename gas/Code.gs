/**
 * ระบบมอบหมายงานสอนแทน — Code.gs  (API หลังบ้านสำหรับหน้าเว็บบน GitHub Pages)
 * พัฒนาโดย ครูนนทพัทธ์ หิรัญเรือง
 * ------------------------------------------------------------------
 * วิธีติดตั้ง
 *  1) สร้าง Google Sheet ใหม่ > ส่วนขยาย > Apps Script วางไฟล์นี้เป็น Code.gs (ไม่ต้องมีไฟล์ HTML)
 *  2) แก้เลข PIN ในฟังก์ชัน setupPin แล้ว Run (ตั้ง PIN — บังคับ เพราะ Web app เปิดให้เรียกจากภายนอก)
 *  3) Run authorizeOnce 1 ครั้ง (อนุญาตสิทธิ์ ชีต + Drive + Forms + Gemini)
 *  4) Deploy > New deployment > Web app
 *       Execute as: Me   |   Who has access: Anyone   (หน้าเว็บบน GitHub Pages เรียกแบบไม่ล็อกอิน)
 *  5) คัดลอกลิงก์ /exec ไปใส่ที่หน้าเว็บ (หน้าเชื่อมต่อ หรือ GAS_URL_CONST ใน index.html) + PIN
 *  6) แท็บ "ตั้งค่า" > ใส่ Gemini API key / โลโก้ / favicon
 *
 * ชีตที่ระบบสร้างให้เอง
 *   "ตารางสอน"       — รายภาคเรียน (นำเข้าจากหน้าเว็บได้ หรือแก้ตรงชีต)
 *   "งานที่มอบหมาย"  — ประวัติการมอบหมายงานทุกครั้ง
 */

const SH_TT = 'ตารางสอน';
const SH_AS = 'งานที่มอบหมาย';
const SH_BK = 'คลังเนื้อหา';
const BK_KEYS = ['id', 'level', 'code', 'subject', 'topic', 'story', 'dates', 'created', 'used', 'lastUsed'];
const BK_HEAD = ['id', 'ชั้น', 'รหัสวิชา', 'วิชา', 'หัวข้อ', 'เนื้อหา (เขียนเป็นเรื่อง)', 'วันที่สอน', 'สร้างเมื่อ', 'ใช้ไปแล้ว (ครั้ง)', 'ใช้ล่าสุด'];
const TT_HEAD = ['วัน (1=จันทร์ … 5=ศุกร์)', 'คาบ', 'เวลา', 'ชั้น', 'รหัสวิชา', 'วิชา', 'ภาคเรียน', 'เริ่มใช้ (ปปปป-ดด-วว)'];
const SEED_TERM = '2/2569', SEED_START = '2026-10-19'; // ตารางสอนตั้งต้น เริ่มใช้ 19 ต.ค. 2569
const AS_KEYS = ['id', 'created', 'date', 'period', 'time', 'level', 'code', 'subject', 'topic', 'indicators',
  'type', 'clip', 'knowledge', 'formUrl', 'formEdit', 'task', 'submit', 'note', 'message', 'quiz'];
const AS_HEAD = ['id', 'สร้างเมื่อ', 'วันที่', 'คาบ', 'เวลา', 'ชั้น', 'รหัสวิชา', 'วิชา', 'เรื่อง', 'ตัวชี้วัด/จุดประสงค์',
  'ประเภทภาระงาน (form/text)', 'ลิงก์คลิป', 'ลิงก์ใบความรู้', 'ลิงก์ Google Form', 'ลิงก์แก้ไขฟอร์ม', 'โจทย์',
  'วิธีส่งงาน', 'หมายเหตุ', 'ข้อความพร้อมส่ง', 'ข้อสอบ (JSON)'];
const PERIODS = {
  1: '08:40-09:30', 2: '09:30-10:20', 3: '10:20-11:10', 4: '11:10-12:00',
  5: '13:00-13:50', 6: '13:50-14:40', 7: '14:40-15:30', 8: '15:30-16:20'
};
// ตารางสอนตั้งต้น (ครูนนท์ ภาคเรียนที่ 2/2569) : [วัน, คาบ, ชั้น, รหัสวิชา, วิชา]
const SEED_TT = [
  [1, 1, 'ม.3', 'ท23102', 'ภาษาไทย 6'], [1, 3, 'ม.5', 'ท32102', 'ภาษาไทย 4'], [1, 6, 'ม.2', 'ท22102', 'ภาษาไทย 4'],
  [2, 4, 'ม.6', 'ท33102', 'ภาษาไทย 6'], [2, 5, 'ม.1', 'ท21102', 'ภาษาไทย 2'], [2, 6, 'ม.4', 'ท31102', 'ภาษาไทย 2'],
  [3, 1, 'ม.4', 'ท31102', 'ภาษาไทย 2'], [3, 4, 'ม.1', 'ท21102', 'ภาษาไทย 2'], [3, 5, 'ม.3', 'ท23102', 'ภาษาไทย 6'], [3, 6, 'ม.2', 'ท22102', 'ภาษาไทย 4'],
  [4, 2, 'ม.2', 'ท22102', 'ภาษาไทย 4'], [4, 3, 'ม.6', 'ท33102', 'ภาษาไทย 6'], [4, 4, 'ม.3', 'ท23102', 'ภาษาไทย 6'], [4, 6, 'ม.1', 'ท21102', 'ภาษาไทย 2'],
  [5, 3, 'ม.5', 'ท32102', 'ภาษาไทย 4']
];

/* ============================ API (หน้าเว็บ GitHub Pages เรียกใช้) ============================ */
// หน้าเว็บ POST แบบ no-cors {key, fn, args} แล้ว poll GET ?key=KEY — ผลลัพธ์พักใน CacheService (แบ่งก้อนเพราะจำกัด 100KB/ค่า)

const CACHE_TTL = 600, CHUNK = 30000;

function jsonOut_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function cachePut_(key, obj) {
  const s = JSON.stringify(obj), parts = {}, n = Math.ceil(s.length / CHUNK) || 1;
  for (let i = 0; i < n; i++) parts[key + '_' + i] = s.substr(i * CHUNK, CHUNK);
  parts[key + '_n'] = String(n);
  CacheService.getScriptCache().putAll(parts, CACHE_TTL);
}

function cacheGet_(key) {
  const c = CacheService.getScriptCache(), n = +c.get(key + '_n');
  if (!n) return null;
  const names = [];
  for (let i = 0; i < n; i++) names.push(key + '_' + i);
  const got = c.getAll(names);
  let s = '';
  for (let i = 0; i < n; i++) { if (got[key + '_' + i] == null) return null; s += got[key + '_' + i]; }
  return JSON.parse(s);
}

function doGet(e) {
  const key = e && e.parameter && e.parameter.key;
  if (key) return jsonOut_(cacheGet_(String(key)) || { status: 'pending' });
  return jsonOut_({ ok: true, app: 'ระบบมอบหมายงานสอนแทน' }); // ใช้ทดสอบการเชื่อมต่อ
}

const API = {
  apiBoot: apiBoot, apiSaveAssignment: apiSaveAssignment, apiDeleteAssignment: apiDeleteAssignment,
  apiSaveSettings: apiSaveSettings, apiListModels: apiListModels, apiPrepare: apiPrepare, apiUpload: apiUpload,
  apiGenQuiz: apiGenQuiz, apiGenTask: apiGenTask, apiCreateForm: apiCreateForm,
  apiImportTimetable: apiImportTimetable, apiDeleteTerm: apiDeleteTerm,
  apiFindClips: apiFindClips, apiSyncBank: apiSyncBank, apiBankList: apiBankList, apiBankGet: apiBankGet,
  apiRandomBank: apiRandomBank, apiMarkBankUsed: apiMarkBankUsed, apiDeleteBank: apiDeleteBank
};

function doPost(e) {
  let key = '';
  try {
    const req = JSON.parse(e.postData.contents);
    key = String(req.key || '');
    if (!/^[\w-]{8,64}$/.test(key)) throw new Error('key ไม่ถูกต้อง');
    const fn = API[req.fn];
    if (!fn) throw new Error('ไม่รู้จักคำสั่ง ' + req.fn);
    const r = fn.apply(null, req.args || []);
    cachePut_(key, { status: 'done', result: typeof r === 'string' ? JSON.parse(r) : r });
  } catch (err) {
    if (key) {
      try { cachePut_(key, { status: 'error', error: String(err && err.message || err).replace(/^Error:\s*/, '') }); } catch (e2) { }
    }
  }
  return ContentService.createTextOutput('ok');
}

function bootData_() {
  const P = PropertiesService.getScriptProperties();
  let folders = null;
  try { folders = JSON.parse(P.getProperty('FOLDERS') || 'null'); } catch (e) { }
  return {
    tt: readTT_(),
    assigns: readAssigns_(),
    cfg: {
      hasKey: !!P.getProperty('GEMINI_KEY'),
      model: P.getProperty('GEMINI_MODEL') || '',
      teacher: P.getProperty('TEACHER') || 'ครูนนท์',
      master: P.getProperty('MASTER_PROMPT') || '',
      logo: P.getProperty('LOGO_URL') || '',
      favicon: P.getProperty('FAVICON_URL') || '',
      tlSheetId: P.getProperty('TL_SHEET_ID') || '',
      tlLast: P.getProperty('TL_LASTSYNC') || ''
    },
    bank: readBank_(false),
    folders: folders,
    ssUrl: SpreadsheetApp.getActive().getUrl()
  };
}

function apiBoot(pin) {
  checkPin_(pin);
  return JSON.stringify(bootData_());
}

/* ============================ PIN (บังคับ) ============================ */

function checkPin_(pin) {
  const real = PropertiesService.getScriptProperties().getProperty('PIN');
  if (!real) throw new Error('PIN_INVALID: ยังไม่ได้ตั้ง PIN — รันฟังก์ชัน setupPin ใน Apps Script ก่อน');
  const c = CacheService.getScriptCache(), k = 'pinfail';
  const fails = +(c.get(k) || 0);
  if (fails >= 5) throw new Error('PIN_LOCKED: ลองใหม่ใน 5 นาที');
  if (String(pin) !== real) { c.put(k, String(fails + 1), 300); throw new Error('PIN_INVALID: PIN ไม่ถูกต้อง'); }
}

/* ============================ ชีต ============================ */

function s_(v) {
  return v instanceof Date ? Utilities.formatDate(v, 'Asia/Bangkok', 'yyyy-MM-dd') : String(v == null ? '' : v);
}

function ensureSheets_() {
  const ss = SpreadsheetApp.getActive();
  let tt = ss.getSheetByName(SH_TT);
  if (!tt) {
    tt = ss.insertSheet(SH_TT);
    tt.getRange(1, 1, 1, TT_HEAD.length).setValues([TT_HEAD]).setFontWeight('bold').setBackground('#fde68a');
    const rows = SEED_TT.map(function (r) { return [r[0], r[1], PERIODS[r[1]], r[2], r[3], r[4], SEED_TERM, SEED_START]; });
    tt.getRange(2, 3, 400, 1).setNumberFormat('@');   // เวลา
    tt.getRange(2, 7, 400, 2).setNumberFormat('@');   // ภาคเรียน "2/2569" กับวันที่ ต้องเป็นข้อความ ไม่ให้ชีตแปลงเป็นวันที่
    tt.getRange(2, 1, rows.length, 8).setValues(rows);
    tt.setFrozenRows(1);
    tt.autoResizeColumns(1, 8);
  }
  let as = ss.getSheetByName(SH_AS);
  if (!as) {
    as = ss.insertSheet(SH_AS);
    as.getRange(1, 1, 1, AS_HEAD.length).setValues([AS_HEAD]).setFontWeight('bold').setBackground('#bfdbfe');
    as.setFrozenRows(1);
  }
  let bk = ss.getSheetByName(SH_BK);
  if (!bk) {
    bk = ss.insertSheet(SH_BK);
    bk.getRange(1, 1, 1, BK_HEAD.length).setValues([BK_HEAD]).setFontWeight('bold').setBackground('#bbf7d0');
    bk.setFrozenRows(1);
  }
  return { tt: tt, as: as, bk: bk };
}

function rawTT_() {
  const sh = ensureSheets_().tt, last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 8).getValues().filter(function (r) { return r[0] !== '' && r[1] !== ''; });
}

function readTT_() {
  return rawTT_().map(function (r) {
    return {
      day: +r[0], period: +r[1], time: s_(r[2]) || PERIODS[+r[1]] || '', level: s_(r[3]), code: s_(r[4]), subject: s_(r[5]),
      term: s_(r[6]), start: s_(r[7])
    };
  });
}

function writeTT_(rows) {
  const sh = ensureSheets_().tt, last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, 8).clearContent();
  if (rows.length) {
    const rng = sh.getRange(2, 1, rows.length, 8);
    rng.setNumberFormat('@');
    rng.setValues(rows);
  }
}

// นำเข้าตารางสอนทั้งภาคเรียน (แทนที่ภาคเรียนเดิมที่ชื่อเดียวกัน) — p = {term, start, rows:[{day,period,time,level,code,subject}]}
function apiImportTimetable(pin, json) {
  checkPin_(pin);
  const p = JSON.parse(json);
  const term = String(p.term || '').trim(), start = String(p.start || '').trim();
  if (!term) throw new Error('ยังไม่ระบุภาคเรียน');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new Error('วันที่เริ่มใช้ไม่ถูกต้อง');
  const src = p.rows || [];
  if (!src.length) throw new Error('ไม่มีแถวตารางสอน');
  if (src.length > 400) throw new Error('ตารางสอนเกิน 400 คาบ');
  const add = src.map(function (r) {
    const day = +r.day, period = +r.period;
    if (!(day >= 1 && day <= 7) || !(period >= 1 && period <= 12)) throw new Error('วัน/คาบไม่ถูกต้อง: ' + JSON.stringify(r));
    return [day, period, String(r.time || PERIODS[period] || ''), String(r.level || '').trim(), String(r.code || '').trim(), String(r.subject || '').trim(), term, start];
  });
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const keep = rawTT_().filter(function (r) { return String(r[6]) !== term; });
    writeTT_(keep.concat(add));
  } finally { lock.releaseLock(); }
  return JSON.stringify({ tt: readTT_() });
}

function apiDeleteTerm(pin, json) {
  checkPin_(pin);
  const term = String(JSON.parse(json).term || '');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    writeTT_(rawTT_().filter(function (r) { return String(r[6]) !== term; }));
  } finally { lock.releaseLock(); }
  return JSON.stringify({ tt: readTT_() });
}

function readAssigns_() {
  const sh = ensureSheets_().as, last = sh.getLastRow();
  if (last < 2) return [];
  const v = sh.getRange(2, 1, last - 1, AS_KEYS.length).getValues(), out = [];
  v.forEach(function (r) {
    if (!r[0]) return;
    const o = {};
    AS_KEYS.forEach(function (k, i) { o[k] = s_(r[i]); });
    o.period = o.period ? Number(o.period) : '';
    try { o.quiz = o.quiz ? JSON.parse(o.quiz) : null; } catch (e) { o.quiz = null; }
    out.push(o);
  });
  return out.slice(-300).reverse(); // ใหม่สุดก่อน
}

// บันทึก/แก้ไขงานหนึ่งรายการ (upsert ตาม id)
function apiSaveAssignment(pin, json) {
  checkPin_(pin);
  const r = JSON.parse(json);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = ensureSheets_().as;
    if (!r.id) r.id = 'A' + Date.now();
    if (!r.created) r.created = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm');
    const quizStr = r.quiz ? JSON.stringify(r.quiz) : '';
    if (quizStr.length > 49000) throw new Error('ข้อสอบยาวเกินกว่าจะเก็บในเซลล์ชีต (ลดจำนวนข้อ)');
    const row = AS_KEYS.map(function (k) { return k === 'quiz' ? quizStr : (r[k] == null ? '' : r[k]); });
    const last = sh.getLastRow();
    const ids = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (x) { return String(x[0]); }) : [];
    const i = ids.indexOf(String(r.id));
    const rowNo = i >= 0 ? i + 2 : last + 1;
    const rng = sh.getRange(rowNo, 1, 1, row.length);
    rng.setNumberFormat('@');            // เก็บเป็นข้อความทั้งแถว กันชีตแปลงวันที่/สูตร
    rng.setValues([row]);
    return JSON.stringify({ ok: true, id: r.id, created: r.created });
  } finally { lock.releaseLock(); }
}

function apiDeleteAssignment(pin, json) {
  checkPin_(pin);
  const p = JSON.parse(json); // {id, trashForm}
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = ensureSheets_().as, last = sh.getLastRow();
    if (last < 2) return JSON.stringify({ ok: true });
    const v = sh.getRange(2, 1, last - 1, AS_KEYS.length).getValues();
    for (let i = 0; i < v.length; i++) {
      if (String(v[i][0]) === String(p.id)) {
        if (p.trashForm) {
          const m = String(v[i][AS_KEYS.indexOf('formEdit')]).match(/\/d\/([\w-]+)\/edit/);
          if (m) { try { DriveApp.getFileById(m[1]).setTrashed(true); } catch (e) { } }
        }
        sh.deleteRow(i + 2);
        break;
      }
    }
    return JSON.stringify({ ok: true });
  } finally { lock.releaseLock(); }
}

/* ============================ ตั้งค่า ============================ */

function apiSaveSettings(pin, json) {
  checkPin_(pin);
  const s = JSON.parse(json), P = PropertiesService.getScriptProperties();
  if (s.geminiKey) P.setProperty('GEMINI_KEY', String(s.geminiKey).trim());
  if (s.model != null) P.setProperty('GEMINI_MODEL', String(s.model).trim());
  if (s.teacher != null) P.setProperty('TEACHER', String(s.teacher).trim());
  [['logo', 'LOGO_URL', 'โลโก้'], ['favicon', 'FAVICON_URL', 'favicon']].forEach(function (m) {
    if (s[m[0]] == null) return;
    const v = String(s[m[0]]).trim();
    if (!v) { P.deleteProperty(m[1]); return; }
    if (!/^https?:\/\/\S+$/.test(v)) throw new Error('ลิงก์' + m[2] + 'ต้องขึ้นต้นด้วย https://');
    if (v.length > 1500) throw new Error('ลิงก์' + m[2] + 'ยาวเกินไป');
    P.setProperty(m[1], v);
  });
  if (s.tlSheetId != null) {
    const v = String(s.tlSheetId).trim().replace(/^.*\/d\/([\w-]+).*$/, '$1');
    if (!v) P.deleteProperty('TL_SHEET_ID');
    else if (!/^[\w-]{20,}$/.test(v)) throw new Error('รหัสชีต teachinglog ไม่ถูกต้อง (วางลิงก์ชีตทั้งลิงก์ก็ได้)');
    else { P.setProperty('TL_SHEET_ID', v); P.deleteProperty('TL_CURSOR'); }
  }
  if (s.master != null) {
    if (!String(s.master).trim()) P.deleteProperty('MASTER_PROMPT');
    else {
      if (Utilities.newBlob(s.master).getBytes().length > 8500) throw new Error('master prompt ยาวเกินไป (เก็บได้ราว 2,800 ตัวอักษรไทย)');
      P.setProperty('MASTER_PROMPT', s.master);
    }
  }
  if (s.newPin) {
    if (String(s.newPin).length < 4) throw new Error('PIN ต้องมีอย่างน้อย 4 ตัว');
    P.setProperty('PIN', String(s.newPin));
  }
  return JSON.stringify({ ok: true });
}

function apiListModels(pin) {
  checkPin_(pin);
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_KEY');
  if (!key) throw new Error('ยังไม่ได้บันทึก Gemini API key');
  const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100',
    { headers: { 'x-goog-api-key': key }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Gemini ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  const j = JSON.parse(res.getContentText());
  const list = (j.models || [])
    .filter(function (m) { return (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0 && /gemini/.test(m.name); })
    .map(function (m) { return m.name.replace(/^models\//, ''); });
  return JSON.stringify({ models: list });
}

/* ============================ โฟลเดอร์ Drive ============================ */

function furl_(id) { return 'https://drive.google.com/drive/folders/' + id; }
function sub_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

// โครงสร้าง: ระบบมอบหมายงานสอนแทน / ใบความรู้ / ม.1..ม.6  และ  แบบทดสอบ (Google Form)
function folders_(create) {
  const P = PropertiesService.getScriptProperties();
  const cached = P.getProperty('FOLDERS');
  if (cached) {
    try { const o = JSON.parse(cached); DriveApp.getFolderById(o.root.id); return o; } catch (e) { }
  }
  if (!create) return null;
  const root = sub_(DriveApp.getRootFolder(), 'ระบบมอบหมายงานสอนแทน');
  const kn = sub_(root, 'ใบความรู้');
  const out = { root: { id: root.getId(), url: furl_(root.getId()) }, kn: {}, quiz: null };
  ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'].forEach(function (l) {
    const f = sub_(kn, l);
    out.kn[l] = { id: f.getId(), url: furl_(f.getId()) };
  });
  const q = sub_(root, 'แบบทดสอบ (Google Form)');
  out.quiz = { id: q.getId(), url: furl_(q.getId()) };
  try { kn.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { } // ไฟล์ใบความรู้สืบทอดสิทธิ์
  P.setProperty('FOLDERS', JSON.stringify(out));
  return out;
}

function apiPrepare(pin) {
  checkPin_(pin);
  return JSON.stringify(folders_(true));
}

// อัปโหลด PDF ใบความรู้เอง (สำรองกรณีให้ Claude อัปไม่ได้)
function apiUpload(pin, json) {
  checkPin_(pin);
  const p = JSON.parse(json);
  const f = folders_(true);
  const info = f.kn[p.level] || f.root;
  const file = DriveApp.getFolderById(info.id).createFile(
    Utilities.newBlob(Utilities.base64Decode(p.data), p.mimeType || 'application/pdf', p.filename));
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { }
  return JSON.stringify({ ok: true, id: file.getId(), url: 'https://drive.google.com/file/d/' + file.getId() + '/view?usp=sharing' });
}

/* ============================ Gemini ============================ */

function gemini_(prompt, schema, opts) {
  opts = opts || {};
  const P = PropertiesService.getScriptProperties();
  const key = P.getProperty('GEMINI_KEY');
  if (!key) throw new Error('ยังไม่ได้ตั้งค่า Gemini API key — ไปที่แท็บ "ตั้งค่า"');
  const main = P.getProperty('GEMINI_MODEL') || 'gemini-flash-latest';
  // ถ้าโมเดลหลักไม่ว่าง (503/429) หรือใช้ไม่ได้ (404) ให้ลองโมเดลสำรองต่อทันที ไม่ต้องรอนาน
  const models = [main].concat(['gemini-flash-lite-latest'].filter(function (m) { return m !== main; }));
  const errs = [];
  const gen = { temperature: opts.temperature != null ? opts.temperature : 0.7 };
  if (schema) { gen.responseMimeType = 'application/json'; gen.responseSchema = schema; }
  const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: gen };
  if (opts.search) body.tools = [{ google_search: {} }];   // ให้ Gemini ค้นเว็บ (ใช้หาคลิป) — โหมดนี้ไม่บังคับ JSON schema
  const payload = JSON.stringify(body);
  let last = '';
  for (let mi = 0; mi < models.length; mi++) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(models[mi]) + ':generateContent';
    const req = { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'x-goog-api-key': key }, payload: payload };
    for (let t = 0; t < 2; t++) {
      let res;
      try { res = UrlFetchApp.fetch(url, req); } catch (e) { last = 'เรียก Gemini ไม่สำเร็จ (' + models[mi] + '): ' + (e && e.message || e); errs.push(String(last).slice(0, 160)); break; }
      const code = res.getResponseCode(), txt = res.getContentText();
      if (code === 200) {
        const j = JSON.parse(txt);
        const cand = j.candidates && j.candidates[0];
        const parts = cand && cand.content && cand.content.parts;
        const out = parts ? parts.map(function (p) { return p.text || ''; }).join('') : '';
        if (!out) throw new Error('Gemini ไม่ส่งผลลัพธ์กลับมา (อาจถูกกรองเนื้อหา) — ลองใหม่อีกครั้ง');
        if (schema) return JSON.parse(out);
        return { text: out, grounding: (cand && cand.groundingMetadata) || null };
      }
      let m = txt.slice(0, 300);
      try { m = JSON.parse(txt).error.message; } catch (e) { }
      last = 'Gemini ' + code + ' (' + models[mi] + '): ' + m;
      errs.push(code + ' ' + models[mi] + ': ' + String(m).slice(0, 140));
      if (code === 503 || code === 429) { if (t === 0) { Utilities.sleep(2000); continue; } break; }
      if (code === 404 || (code === 400 && !/api key/i.test(m))) break;   // โมเดลนี้ใช้ไม่ได้ → ลองตัวถัดไป
      throw new Error(last);                                                // key ผิด/ไม่มีสิทธิ์ ฯลฯ
    }
  }
  throw new Error('AI ใช้งานไม่ได้ชั่วคราว ลองใหม่ในอีก 1-2 นาที — ' + (errs.join(' | ') || last).slice(0, 700));
}

function shuffleQ_(q) {
  const idx = q.choices.map(function (_, i) { return i; });
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
  }
  return { q: q.q, choices: idx.map(function (i) { return q.choices[i]; }), answer: idx.indexOf(q.answer), explain: q.explain || '' };
}

function apiGenQuiz(pin, json) {
  checkPin_(pin);
  const p = JSON.parse(json);
  const n = Math.max(1, Math.min(20, +p.count || 10));
  const prompt =
    'คุณเป็นครูภาษาไทยระดับมัธยมศึกษาที่ออกข้อสอบเก่งมาก ออกข้อสอบปรนัย ' + n + ' ข้อ\n' +
    '- ชั้น: ' + p.level + '\n' +
    '- วิชา: ' + p.subject + (p.code ? ' (' + p.code + ')' : '') + '\n' +
    '- เรื่อง: ' + p.topic + '\n' +
    '- ตัวชี้วัด/จุดประสงค์: ' + (p.indicators || '(ไม่ระบุ — ให้ออกตามสาระของเรื่องนี้ตามหลักสูตรแกนกลาง)') + '\n' +
    '- ระดับความยาก: ' + (p.difficulty || 'ปานกลาง') + '\n' +
    (p.ref ? '- ให้ออกข้อสอบจากเนื้อหาอ้างอิงนี้เป็นหลัก:\n"""\n' + p.ref + '\n"""\n' : '') +
    '\nเงื่อนไข:\n' +
    '1. ทุกข้อมี 4 ตัวเลือก ถูกเพียง 1 ข้อ ตัวเลือกลวงต้องฟังดูสมเหตุสมผล\n' +
    '2. ห้ามใช้ตัวเลือก "ถูกทุกข้อ" "ไม่มีข้อถูก" "ข้อ ก และ ข" เพราะระบบจะสลับลำดับตัวเลือก\n' +
    '3. ตัวเลือกไม่ต้องมี ก. ข. ค. ง. นำหน้า\n' +
    '4. ภาษาไทยต้องถูกต้องตามหลักภาษา ข้อมูลต้องถูกต้อง ถ้าไม่แน่ใจให้เลี่ยงประเด็นนั้น\n' +
    '5. คละระดับพฤติกรรม (จำ เข้าใจ นำไปใช้) ตามความยากที่กำหนด และห้ามออกข้อซ้ำกัน\n' +
    '6. answer คือลำดับตัวเลือกที่ถูก เริ่มนับจาก 0\n' +
    '7. explain คือเฉลยสั้น ๆ 1 ประโยค';
  const schema = {
    type: 'OBJECT',
    properties: {
      questions: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            q: { type: 'STRING' },
            choices: { type: 'ARRAY', items: { type: 'STRING' } },
            answer: { type: 'INTEGER' },
            explain: { type: 'STRING' }
          },
          required: ['q', 'choices', 'answer', 'explain']
        }
      }
    },
    required: ['questions']
  };
  const r = gemini_(prompt, schema);
  const qs = (r.questions || [])
    .map(function (q) {
      const ch = (q.choices || []).map(function (c) { return String(c).replace(/^\s*[กขคง][\.\)]\s*/, '').trim(); }).filter(String).slice(0, 4);
      return { q: String(q.q || '').trim(), choices: ch, answer: +q.answer, explain: String(q.explain || '').trim() };
    })
    .filter(function (q) { return q.q && q.choices.length >= 3 && q.answer >= 0 && q.answer < q.choices.length; })
    .map(shuffleQ_);
  if (!qs.length) throw new Error('AI ส่งข้อสอบกลับมาไม่ถูกรูปแบบ — กดสร้างใหม่อีกครั้ง');
  return JSON.stringify({ questions: qs });
}

function apiGenTask(pin, json) {
  checkPin_(pin);
  const p = JSON.parse(json);
  const prompt =
    'คุณเป็นครูภาษาไทยระดับมัธยมศึกษา เขียน "โจทย์ภาระงาน" ให้นักเรียนทำเองในคาบเรียนที่ครูไม่อยู่\n' +
    '- ชั้น: ' + p.level + '\n- วิชา: ' + p.subject + (p.code ? ' (' + p.code + ')' : '') + '\n- เรื่อง: ' + p.topic + '\n' +
    '- ตัวชี้วัด/จุดประสงค์: ' + (p.indicators || '(ไม่ระบุ)') + '\n' +
    (p.ref ? '- เนื้อหาอ้างอิง:\n"""\n' + p.ref + '\n"""\n' : '') +
    '\nเงื่อนไข: ทำเสร็จได้ภายใน 30-40 นาที ใช้สมุดและปากกาเท่านั้น มี 3-5 ข้อ/ขั้นตอน เรียงลำดับ ' +
    'ใช้ภาษาที่นักเรียนอ่านแล้วเข้าใจทันที ระบุชัดว่าต้องส่งอะไร ไม่ต้องมีคำทักทายหรือคำอธิบายนอกโจทย์ ' +
    'ตอบเป็นข้อความธรรมดา ขึ้นต้นแต่ละข้อด้วยเลข 1) 2) 3)';
  const r = gemini_(prompt, { type: 'OBJECT', properties: { task: { type: 'STRING' } }, required: ['task'] });
  return JSON.stringify({ task: String(r.task || '').trim() });
}

/* ============================ ค้นหาคลิปสอนด้วย AI ============================ */

const YT_RE = /(?:youtube\.com\/(?:watch\?(?:[^\s"')]*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/g;

function ytIds_(text, add) {
  const re = new RegExp(YT_RE.source, 'g');
  let m;
  while ((m = re.exec(String(text || ''))) !== null) add(m[1]);
}

// ให้ Gemini ค้นเว็บหาคลิป YouTube ภาษาไทยตามหัวข้อ แล้วตรวจทุกลิงก์ด้วย oEmbed (กันลิงก์ที่ AI แต่งขึ้น)
function apiFindClips(pin, json) {
  checkPin_(pin);
  const p = JSON.parse(json);
  const topic = String(p.topic || '').trim();
  if (!topic) throw new Error('ยังไม่ระบุเรื่อง/หัวข้อ');
  const seen = {}, ids = [];
  const add = function (id) { if (id && !seen[id]) { seen[id] = 1; ids.push(id); } };
  let note = '';
  const q = topic + ' ภาษาไทย ' + (p.level || '') + ' สอน';
  try {
    const prompt = 'ค้นหาคลิปวิดีโอบน YouTube ภาษาไทยที่อธิบายหรือสอนเรื่อง "' + topic + '" วิชา' + (p.subject || 'ภาษาไทย') +
      (p.level ? ' ระดับชั้น' + p.level : '') + ' ให้นักเรียนมัธยมดูเข้าใจง่าย ความยาวไม่เกินประมาณ 20 นาที เนื้อหาถูกต้อง\n' +
      (p.indicators ? 'ตัวชี้วัด/จุดประสงค์: ' + p.indicators + '\n' : '') +
      'ตอบเป็นรายการ 6-8 ข้อ แต่ละข้อมีชื่อคลิป ชื่อช่อง และลิงก์ YouTube ที่ขึ้นต้นด้วย https://www.youtube.com/watch?v= ตรง ๆ ' +
      'ห้ามแต่งหรือเดาลิงก์ ถ้าไม่พบให้ตอบเท่าที่พบจริง';
    const r = gemini_(prompt, null, { search: true, temperature: 0.2 });
    ytIds_(r.text, add);
    const chunks = (r.grounding && r.grounding.groundingChunks) || [];
    chunks.forEach(function (c) { ytIds_(c && c.web && c.web.uri, add); });
  } catch (e) { note = 'ค้นด้วย AI: ' + String(e && e.message || e); }
  if (ids.length < 4) {   // สำรอง: อ่านผลค้นหาหน้า YouTube
    try {
      const res = UrlFetchApp.fetch('https://www.youtube.com/results?hl=th&search_query=' + encodeURIComponent(q), {
        muteHttpExceptions: true,
        headers: { 'Accept-Language': 'th-TH,th;q=0.9', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' }
      });
      const sc = res.getResponseCode();
      if (sc !== 200) note += ' | ค้นหน้า YouTube ไม่ได้ (' + sc + ')';
      if (sc === 200) {
        const re = /"videoId":"([\w-]{11})"/g, html = res.getContentText();
        let m, n = 0;
        while ((m = re.exec(html)) !== null && n < 10) { if (!seen[m[1]]) { add(m[1]); n++; } }
      }
    } catch (e) { }
  }
  const cand = ids.slice(0, 16);
  const clips = [];
  if (cand.length) {
    const reqs = cand.map(function (id) {
      return { url: 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id), muteHttpExceptions: true };
    });
    UrlFetchApp.fetchAll(reqs).forEach(function (r, i) {
      if (r.getResponseCode() !== 200) return;
      try {
        const j = JSON.parse(r.getContentText());
        clips.push({ id: cand[i], url: 'https://www.youtube.com/watch?v=' + cand[i], title: j.title || '', channel: j.author_name || '', thumb: j.thumbnail_url || '' });
      } catch (e) { }
    });
  }
  clips.sort(function (a, b) { return (/ครูนนท์/.test(b.channel) ? 1 : 0) - (/ครูนนท์/.test(a.channel) ? 1 : 0); }); // ช่องของครูนนท์ขึ้นก่อน
  return JSON.stringify({ clips: clips.slice(0, 8), searchUrl: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q), note: clips.length ? '' : note });
}

/* ============================ คลังเนื้อหา (สรุปจากบันทึก teachinglog) ============================ */

function readBank_(withStory) {
  const sh = ensureSheets_().bk, last = sh.getLastRow();
  if (last < 2) return [];
  const out = [];
  sh.getRange(2, 1, last - 1, BK_KEYS.length).getValues().forEach(function (r) {
    if (!r[0]) return;
    const o = {};
    BK_KEYS.forEach(function (k, i) { o[k] = s_(r[i]); });
    o.used = +o.used || 0;
    o.len = o.story.length;
    if (withStory) { /* เก็บ story ไว้ */ } else { o.snip = o.story.replace(/\s+/g, ' ').slice(0, 140); delete o.story; }
    out.push(o);
  });
  return out.reverse(); // ใหม่สุดก่อน
}

function bankRowIdx_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function apiBankList(pin) {
  checkPin_(pin);
  return JSON.stringify({ bank: readBank_(false) });
}

function apiBankGet(pin, json) {
  checkPin_(pin);
  const id = String(JSON.parse(json).id || '');
  const it = readBank_(true).filter(function (x) { return x.id === id; })[0];
  if (!it) throw new Error('ไม่พบรายการในคลัง');
  return JSON.stringify({ item: it });
}

function apiDeleteBank(pin, json) {
  checkPin_(pin);
  const id = String(JSON.parse(json).id || '');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = ensureSheets_().bk, r = bankRowIdx_(sh, id);
    if (r > 0) sh.deleteRow(r);
  } finally { lock.releaseLock(); }
  return JSON.stringify({ ok: true, bank: readBank_(false) });
}

// สุ่มเนื้อหาจากคลัง (ไม่เรียก AI) — เลือกจากรายการที่ถูกใช้น้อยที่สุดก่อน กันซ้ำ
function apiRandomBank(pin, json) {
  checkPin_(pin);
  const p = JSON.parse(json || '{}');
  let rows = readBank_(true);
  if (p.level) rows = rows.filter(function (x) { return x.level === p.level; });
  if (!rows.length) throw new Error('คลังยังไม่มีเนื้อหา' + (p.level ? 'ของ ' + p.level : '') + ' — ไปแท็บ "คลังเนื้อหา" แล้วกดซิงก์จาก teachinglog ก่อน');
  const min = Math.min.apply(null, rows.map(function (x) { return x.used; }));
  let pool = rows.filter(function (x) { return x.used === min; });
  if (p.excludeId && pool.length > 1) pool = pool.filter(function (x) { return x.id !== p.excludeId; });
  return JSON.stringify({ item: pool[Math.floor(Math.random() * pool.length)], count: rows.length });
}

function apiMarkBankUsed(pin, json) {
  checkPin_(pin);
  const id = String(JSON.parse(json).id || '');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = ensureSheets_().bk, r = bankRowIdx_(sh, id);
    if (r > 0) {
      const ui = BK_KEYS.indexOf('used') + 1, li = BK_KEYS.indexOf('lastUsed') + 1;
      const cur = +sh.getRange(r, ui).getValue() || 0;
      sh.getRange(r, ui).setNumberFormat('@').setValue(String(cur + 1));
      sh.getRange(r, li).setNumberFormat('@').setValue(Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd'));
    }
  } finally { lock.releaseLock(); }
  return JSON.stringify({ ok: true });
}

// ซิงก์บันทึกใหม่จากชีต teachinglog (แท็บ Notes) มาให้ AI สรุปเป็นเรื่อง เก็บลงคลัง — ทำครั้งละ 30 บันทึก (เรียกซ้ำจนกว่า remaining = 0)
// ใช้ AI เฉพาะตอนกดซิงก์ ตอนสุ่มไม่ใช้ AI  |  p = {reset?:true} เพื่อล้างคลังแล้วเริ่มใหม่ทั้งหมด
function apiSyncBank(pin, json) {
  checkPin_(pin);
  const p = JSON.parse(json || '{}');
  const P = PropertiesService.getScriptProperties();
  const tlId = P.getProperty('TL_SHEET_ID');
  if (!tlId) throw new Error('ยังไม่ได้ตั้งรหัสชีต teachinglog — ไปที่แท็บ "ตั้งค่า"');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const bk = ensureSheets_().bk;
    if (p.reset) {
      const l0 = bk.getLastRow();
      if (l0 > 1) bk.getRange(2, 1, l0 - 1, BK_KEYS.length).clearContent();
      P.deleteProperty('TL_CURSOR');
    }
    let tl;
    try { tl = SpreadsheetApp.openById(tlId); } catch (e) { throw new Error('เปิดชีต teachinglog ไม่ได้ — ตรวจรหัสชีตและสิทธิ์ของบัญชีนี้'); }
    const sh = tl.getSheetByName('Notes');
    if (!sh) throw new Error('ไม่พบแท็บชื่อ Notes ในชีต teachinglog');
    const last = sh.getLastRow();
    const cursor = Math.max(1, +(P.getProperty('TL_CURSOR') || 1));
    const total0 = Math.max(0, bk.getLastRow() - 1);
    if (last <= cursor) return JSON.stringify({ ok: true, added: 0, processed: 0, remaining: 0, total: total0 });
    const from = cursor + 1, to = Math.min(last, cursor + 30);
    const notes = sh.getRange(from, 1, to - from + 1, 8).getValues().map(function (r) {
      return { date: s_(r[6]), level: s_(r[5]), code: s_(r[3]), subject: s_(r[4]), text: s_(r[7]).trim() };
    }).filter(function (n) { return n.text; });
    let added = 0;
    if (notes.length) {
      const prompt =
        'คุณเป็นครูภาษาไทยมัธยมศึกษา ช่วยจัดทำ "คลังเนื้อหา" จากบันทึกการสอนที่ครูจดไว้ (วันที่ ชั้น วิชา ข้อความ) ดังนี้\n\n' +
        notes.map(function (n, i) { return (i + 1) + ') [' + n.date + '] ' + n.level + ' ' + n.code + ' ' + n.subject + ': ' + n.text.replace(/\n+/g, ' / '); }).join('\n') +
        '\n\nงาน: จัดกลุ่มบันทึกที่สอนเรื่องเดียวกัน (ชั้นเดียวกัน) เป็น 1 รายการต่อ 1 หัวข้อ แล้วเขียน story เป็นเรื่องเล่าต่อเนื่อง (ร้อยแก้ว 1-3 ย่อหน้า ราว 120-250 คำ) ' +
        'อธิบายสาระความรู้ของหัวข้อนั้นที่นักเรียนได้เรียน ให้เหมาะกับการนำไปให้นักเรียนอ่านทบทวนเอง\n' +
        'กติกา:\n- ข้ามบันทึกที่ไม่ใช่เนื้อหาการสอน (เช่น ติดตามนักเรียน 0 ร มส ประชุม สอบ ไม่มีการสอน กิจกรรมทั่วไป)\n' +
        '- ยึดสาระจากบันทึกเป็นหลัก ถ้าจะเสริมความรู้ ให้เสริมเฉพาะหลักภาษาไทยที่ถูกต้องแน่นอน ห้ามแต่งตัวอย่างหรือข้อเท็จจริงที่ไม่แน่ใจ\n' +
        '- ห้ามเล่าวิธีสอน/คลิป/เกม/ใบงาน/คะแนนของครู ให้เล่าเฉพาะสาระความรู้\n' +
        '- topic คือชื่อหัวข้อสั้น ๆ  dates คือวันที่สอน (yyyy-mm-dd คั่นด้วยจุลภาค)  level/code/subject ใช้ตามบันทึก';
      const schema = {
        type: 'OBJECT',
        properties: { items: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
          level: { type: 'STRING' }, code: { type: 'STRING' }, subject: { type: 'STRING' },
          topic: { type: 'STRING' }, story: { type: 'STRING' }, dates: { type: 'STRING' } },
          required: ['level', 'topic', 'story'] } } },
        required: ['items']
      };
      const r = gemini_(prompt, schema);
      const have = {};
      readBank_(false).forEach(function (x) { have[x.level + '|' + x.topic.replace(/\s+/g, '')] = 1; });
      const now = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm');
      const rows = [];
      (r.items || []).forEach(function (it) {
        const level = String(it.level || '').trim(), topic = String(it.topic || '').trim(), story = String(it.story || '').trim();
        if (!level || !topic || story.length < 40 || have[level + '|' + topic.replace(/\s+/g, '')]) return;
        have[level + '|' + topic.replace(/\s+/g, '')] = 1;
        rows.push(['B' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), level, String(it.code || '').trim(), String(it.subject || '').trim(), topic, story.slice(0, 20000), String(it.dates || ''), now, '0', '']);
      });
      if (rows.length) {
        const rng = bk.getRange(bk.getLastRow() + 1, 1, rows.length, BK_KEYS.length);
        rng.setNumberFormat('@'); rng.setValues(rows);
      }
      added = rows.length;
    }
    P.setProperty('TL_CURSOR', String(to));
    P.setProperty('TL_LASTSYNC', Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'));
    return JSON.stringify({ ok: true, added: added, processed: to - from + 1, remaining: last - to, total: Math.max(0, bk.getLastRow() - 1), last: P.getProperty('TL_LASTSYNC') });
  } finally { lock.releaseLock(); }
}

/* ============================ Google Form ============================ */

function respSS_() {
  const P = PropertiesService.getScriptProperties();
  const id = P.getProperty('RESP_SS_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) { } }
  const ss = SpreadsheetApp.create('คะแนนแบบทดสอบ — ระบบมอบหมายงานสอนแทน');
  P.setProperty('RESP_SS_ID', ss.getId());
  try { DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(folders_(true).quiz.id)); } catch (e) { }
  return ss;
}

function apiCreateForm(pin, json) {
  checkPin_(pin);
  const p = JSON.parse(json); // {title, level, topic, questions:[{q,choices,answer,explain}]}
  if (!p.questions || !p.questions.length) throw new Error('ยังไม่มีข้อสอบ');
  const form = FormApp.create(p.title);
  form.setIsQuiz(true);
  form.setDescription('แบบทดสอบ ' + (p.level || '') + ' เรื่อง ' + (p.topic || '') +
    '\nกรอกชื่อ-นามสกุล ชั้น เลขที่ ให้ครบก่อนเริ่มทำ');
  form.setProgressBar(true);
  form.setShowLinkToRespondAgain(false);
  form.setConfirmationMessage('ส่งคำตอบเรียบร้อยแล้ว กดดูคะแนนของตนเองได้ด้านล่าง');
  form.addTextItem().setTitle('ชื่อ-นามสกุล').setRequired(true);
  form.addTextItem().setTitle('ชั้น / เลขที่').setRequired(true);
  p.questions.forEach(function (q, i) {
    const it = form.addMultipleChoiceItem();
    it.setTitle((i + 1) + '. ' + q.q);
    it.setChoices(q.choices.map(function (c, j) { return it.createChoice(c, j === q.answer); }));
    it.setPoints(1).setRequired(true);
    if (q.explain) {
      it.setFeedbackForCorrect(FormApp.createFeedback().setText('ถูกต้อง — ' + q.explain).build());
      it.setFeedbackForIncorrect(FormApp.createFeedback().setText('เฉลย: ' + q.choices[q.answer] + ' — ' + q.explain).build());
    }
  });
  let warn = '';
  try { if (typeof form.setPublished === 'function') form.setPublished(true); } catch (e) { }
  try { form.setAcceptingResponses(true); } catch (e) { }
  try { DriveApp.getFileById(form.getId()).moveTo(DriveApp.getFolderById(folders_(true).quiz.id)); }
  catch (e) { warn += 'ย้ายฟอร์มเข้าโฟลเดอร์ไม่สำเร็จ; '; }
  let ssUrl = '';
  try {
    const ss = respSS_();
    form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
    ssUrl = ss.getUrl();
  } catch (e) { warn += 'ผูกชีตเก็บคะแนนไม่สำเร็จ (ดูคำตอบได้ในตัวฟอร์ม); '; }
  return JSON.stringify({ ok: true, formUrl: form.getPublishedUrl(), formEdit: form.getEditUrl(), scoreSheet: ssUrl, warn: warn });
}

/* ============================ ครั้งแรก ============================ */

// 1) แก้ PIN ด้านล่างเป็นของคุณ (แนะนำ 6 ตัวขึ้นไป) 2) กด Run setupPin 1 ครั้ง — เปลี่ยนภายหลังได้ที่แท็บตั้งค่าในหน้าเว็บ
function setupPin() {
  const PIN = '1234'; // ← เปลี่ยนก่อนรัน
  if (PIN === '1234') throw new Error('เปลี่ยน PIN ในโค้ดก่อนรัน (ห้ามใช้ 1234)');
  PropertiesService.getScriptProperties().setProperty('PIN', PIN);
  Logger.log('ตั้ง PIN แล้ว');
}

// กด Run 1 ครั้งเพื่ออนุญาตสิทธิ์ครบ (ชีต + Drive + Forms + เรียก Gemini) และสร้างโฟลเดอร์
function authorizeOnce() {
  ensureSheets_();
  folders_(true);
  const f = FormApp.create('test-authorize');
  DriveApp.getFileById(f.getId()).setTrashed(true);
  UrlFetchApp.fetch('https://generativelanguage.googleapis.com/', { muteHttpExceptions: true });
  Logger.log('พร้อมใช้งาน — Deploy เป็น Web app (Anyone) ได้เลย');
}
