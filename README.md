# ระบบมอบหมายงานสอนแทน

พัฒนาโดย ครูนนทพัทธ์ หิรัญเรือง

มอบหมายงาน (คลิป + ใบความรู้ + แบบทดสอบ Google Form / โจทย์ข้อความ) ให้นักเรียนเมื่อครูไปราชการ

- หน้าเว็บ: `index.html` + `sw.js` (GitHub Pages, ติดตั้งเป็น PWA ได้)
- หลังบ้าน: `gas/Code.gs` (Google Apps Script ผูกกับ Google Sheet; Gemini สร้างข้อสอบ)
- ตั้งค่า: ลิงก์ Web app (/exec) + PIN ที่หน้าเชื่อมต่อ หรือใส่ใน `GAS_URL_CONST` ต้นสคริปต์ของ `index.html`
