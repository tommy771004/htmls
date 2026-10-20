// 截圖：node tools/shot.mjs "<網站路徑?參數>" out.png [寬x高] [等待的 JS 條件] [截圖前執行的 JS]
// 以 repo 根目錄起一個靜態伺服器，用系統 Chrome（真 GPU）開頁面。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const [path, out, size = '1280x720', ready = 'window.__ready === true', before = ''] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try { const body = await readFile(join(REPO, p)); res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => errors.push('[pageerror] ' + e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/${path.replace(/^\//, '')}`);
await page.waitForFunction(ready, null, { timeout: 180000, polling: 250 });
if (before) { await page.evaluate(before); await page.waitForTimeout(600); }
await page.screenshot({ path: out });
console.log(errors.slice(0, 20).join('\n') || '沒有錯誤');
await browser.close(); server.close();
