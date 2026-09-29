// 189 渚 NAGISA：驗收與數值穩定回歸測試。用法：PLAYWRIGHT_MODULE=<playwright 路徑> node tests/nagisa-coast-regression.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const server = http.createServer((req, res) => { const pathname = new URL(req.url, 'http://localhost').pathname, file = path.resolve(root, '.' + pathname); if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); } res.setHeader('Content-Type', 'text/html'); res.end(fs.readFileSync(file)); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}), args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500 }), errors = [], external = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('request', r => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
    await page.goto(origin + '/web/189-nagisa-coast.html');
    await page.waitForFunction(() => window.nagisa && nagisa.S.warm === 0, null, { timeout: 120000 });
    const info = await page.evaluate(() => ({ vp: !!document.querySelector('meta[name=viewport]'), sw: document.documentElement.scrollWidth, iw: innerWidth, failed: !document.getElementById('fail').hidden }));
    assert(info.vp); assert(!info.failed); assert(info.sw <= info.iw, `水平溢出 ${info.sw} > ${info.iw}`);
    // 每個情境跑一段，數值必須有限，且水不能爬上高處岩盤或堤頂（靜水重建的回歸）
    for (let i = 0; i < 6; i++) {
      const r = await page.evaluate(i => { nagisa.load(i); nagisa.S.warm = 0; nagisa.step(160); return { c: nagisa.check(), high: nagisa.wetHigh().pop() }; }, i);
      assert.equal(r.c.bad, 0, `情境 ${i + 1} 出現非有限值`); assert(r.c.vmax < 7.5, `情境 ${i + 1} 流速異常 ${r.c.vmax}`); assert(r.high < 60, `情境 ${i + 1} 高處積水 ${r.high} 格`);
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    await page.close();
  }
  console.log('189 渚 NAGISA：通過');
} finally { await browser.close(); server.close(); }
