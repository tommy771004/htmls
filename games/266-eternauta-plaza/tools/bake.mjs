// 把模型烘焙成 Gaussian splat：在無頭 Chrome 開 tools/bake.html，輸出 assets/266/*.spz、*.skin 與 manifest.json。
// 用法：PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/bake.mjs [all|items|zombies] [--only id,id]
// --only 只烘焙指定的物件／角色，manifest 依 id 合併，其他檔案不動。
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '../../..');
const OUT = join(REPO, 'assets/266');
const which = process.argv[2] || 'all';
const oi = process.argv.indexOf('--only'), only = oi > 0 ? process.argv[oi + 1].split(',') : null;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.bin': 'application/octet-stream', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.spz': 'application/octet-stream', '.skin': 'application/octet-stream' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try { const body = await readFile(join(REPO, path)); res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.error('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/games/266-eternauta-plaza/tools/bake.html`);
await page.waitForFunction(() => typeof window.bakeAll === 'function');
const { files, manifest } = await page.evaluate(([w, o]) => window.bakeAll(w, o), [which, only]);
await mkdir(OUT, { recursive: true });
let old = {}; try { old = JSON.parse(await readFile(join(OUT, 'manifest.json'), 'utf8')); } catch { /* 第一次 */ }
for (const [name, data] of Object.entries(files)) {
  const buf = Buffer.from(data, 'base64'); await writeFile(join(OUT, name), buf);
  console.log(name.padEnd(18), (buf.length / 1024).toFixed(0).padStart(6), 'KB');
}
const merged = { ...old, ...manifest, items: { ...old.items, ...manifest.items }, zombies: { ...old.zombies, ...manifest.zombies }, rigs: { ...old.rigs, ...manifest.rigs } };
if (!manifest.clips) merged.clips = old.clips;
await writeFile(join(OUT, 'manifest.json'), JSON.stringify(merged));
console.log('manifest.json', (JSON.stringify(merged).length / 1024).toFixed(0), 'KB');
await browser.close(); server.close();
