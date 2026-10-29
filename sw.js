self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(function () {
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>ไม่มีสัญญาณอินเทอร์เน็ต</h2><p>เปิดแอปอีกครั้งเมื่อเชื่อมต่อแล้ว</p>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }));
});
