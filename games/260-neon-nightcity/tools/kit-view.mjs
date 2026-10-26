// 改裝外觀件的截圖：以本機 HTTP 開頁、換成實車、裝上指定的外觀件，從四個角度各拍一張拼成一列
//   node tools/kit-view.mjs <out-dir> [id…|all]   MODS='{"spl":2,"bmp":1,"exh":2,"ng":1}' 指定套件、VIEWS=tail,nose 只拍這幾個角度
// 角度：rq 右後、fq 左前、side 側面、rear 正後、low 低角度前方、tail 車尾近景、nose 車頭近景
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../..');
const outDir = resolve(process.argv[2] || resolve(root, '.cache/kit'));
mkdirSync(outDir, { recursive: true });
const SPEC = JSON.parse(readFileSync(resolve(repo, 'assets/260/cars.json'), 'utf8'));
const arg = process.argv.slice(3), ids = arg[0] === 'all' ? Object.keys(SPEC).filter(id => !SPEC[id].bike) : arg.length ? arg : ['ae86', 'supra', 'e92', 'gt3rs', 'f40', 'chall'];
const only = process.env.VIEWS ? process.env.VIEWS.split(',') : null;
const MODS = JSON.parse(process.env.MODS || '{"spl":2,"bmp":1,"exh":2,"ng":2}');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.svg': 'image/svg+xml' };
const srv = createServer((q, s) => {
  const f = resolve(repo, '.' + decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(repo + sep) || !existsSync(f) || !statSync(f).isFile()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const { browser, page, log } = await open(`http://127.0.0.1:${srv.address().port}/web/260-neon-nightcity.html`, { w: 800, h: 500 });
try {
  await page.evaluate(() => { try { localStorage.removeItem('nc260.motors'); } catch (e) {} window.__nc.start(); });
  await page.evaluate(() => { const N = window.__nc; N.time(13 * 60); N.weather('clear'); for (let i = 0; i < 30; i++) N.step(1 / 60); });   // 白天、晴天才看得清楚
  await page.waitForTimeout(800);
  for (const id of ids) {
    await page.evaluate(([id, m]) => { const N = window.__nc; if (N.player.mode !== 'drive') N.drive(); N.applyCar(id); N.motors.mods[id] = m; N.chrome.apply(); }, [id, MODS]);
    await page.waitForFunction(id => window.__nc.glb.loaded.includes(id), id, { timeout: 60000 });
    await page.waitForTimeout(600);
    await page.evaluate(() => { for (const el of document.querySelectorAll('#hud, #toast, #prompt')) el.style.visibility = 'hidden'; });
    const views = [['rq', -.75, -.75, .9], ['fq', .75, .75, .6], ['side', 0, 1.25, .5], ['rear', -1.1, -.15, .55], ['low', 1.1, .25, .22], ['tail', -.62, -.38, .62], ['nose', .62, .3, .16]];
    for (const [n, f, r, h] of views.filter(v => !only || only.includes(v[0]))) {
      await page.evaluate(([f, r, h]) => {
        const N = window.__nc, v = N.player.veh, L = N.cars[v.carId].len, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), d = L * .95;
        const px = v.x + (fx * f - fz * r) * d, pz = v.z + (fz * f + fx * r) * d;
        N.camAt(px, v.y + h * 1.6, pz, v.x, v.y + .55, v.z); N.step(1 / 60);
      }, [f, r, h]);
      await raf(page);
      await page.screenshot({ path: resolve(outDir, `${id}-${n}.png`) });
    }
  }
  console.log('errors', log.errors.slice(0, 5), log.pageerrors.slice(0, 5));
} finally { await browser.close(); srv.close(); }
