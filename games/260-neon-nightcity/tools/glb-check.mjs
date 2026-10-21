// 實車模型驗收：以本機 HTTP 伺服器開頁（assets/260/ 要能下載），檢查 10 台 GLB 都載入、展示廳與車庫換成實車、
// 買一台實車開上街（輪子轉動、轉向）、騎實車機車、CHROME WORKS 換色規則，並且沒有錯誤與外部請求。
//   node tools/glb-check.mjs        SHOT_DIR=… 會存截圖
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../..');
const shotDir = process.env.SHOT_DIR ? resolve(process.env.SHOT_DIR) : null;
if (shotDir) mkdirSync(shotDir, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.svg': 'image/svg+xml' };
const srv = createServer((q, s) => {
  const f = resolve(repo, '.' + decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(repo + sep) || !existsSync(f) || !statSync(f).isFile()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/web/260-neon-nightcity.html`;

let failed = 0;
const check = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) failed++; };
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { if (shotDir) { await raf(page); await page.screenshot({ path: resolve(shotDir, name + '.png') }); } };
const hideHud = page => ev(page, () => { for (const id of ['toast', 'prompt', 'marker']) { const el = document.getElementById(id); if (el) el.style.visibility = 'hidden'; } });

const { browser, page, log } = await open(url, { w: 1440, h: 900 });
try {
  await ev(page, () => { try { localStorage.removeItem('nc260.motors'); } catch (e) {} });
  await ev(page, () => window.__nc.start());
  await page.waitForTimeout(800);
  check((await ev(page, () => window.__nc.glb.loaded.length)) === 0, '開頁時不下載實車模型（進展示廳或車庫才下載）');
  const t0 = Date.now();
  await ev(page, () => window.__nc.loadAllGLB());
  const g = await ev(page, () => window.__nc.glb);
  check(g.on && g.loaded.length === 10 && !g.failed.length, `GLB 下載 ${g.loaded.length}/10（${((Date.now() - t0) / 1000).toFixed(1)} s）${g.failed.length ? '，失敗 ' + g.failed.join(',') : ''}`);

  // 展示廳：後兩排的實車
  await ev(page, () => window.__nc.enter('show'));
  await page.waitForTimeout(600);
  await ev(page, () => { const nc = window.__nc; nc.player.x = 0; nc.player.z = 22; nc.player.yaw = 0; nc.look(0, -.12, 1); });
  await page.waitForTimeout(500); await hideHud(page);
  const st1 = await ev(page, () => window.__nc.getStats());
  check(st1.triangles > 500000, `展示廳 ${st1.triangles} 個三角形、${st1.drawCalls} 個 draw call、${st1.fps} fps`);
  await shot(page, 'g-show');
  for (const [i, yaw] of [[0, 0], [1, .6], [2, -.6]]) {
    await ev(page, ([yaw]) => { const nc = window.__nc; nc.player.x = 0; nc.player.z = 32; nc.player.yaw = yaw; nc.look(yaw, -.1, 0); }, [yaw]);
    await page.waitForTimeout(400); await shot(page, 'g-show-back' + i);
  }
  // 看車對話：實車有授權標示
  const cars = await ev(page, () => window.__nc.spots.showCars);
  if (process.env.CLOSEUPS) for (const c of cars.filter(c => /e92|m3c|m4wb|m3gtr|m3t24|m4gt3|gt3rs|gt3r|s1krr/.test(c.id))) {
    // 站在車子斜前方、相機拉遠看整台車
    await ev(page, (c) => { const nc = window.__nc, p = nc.player, a = c.yaw + .75; nc.me.mesh.visible = false; p.x = c.x + Math.sin(a) * 2.2; p.z = c.z + Math.cos(a) * 2.2; p.yaw = a + Math.PI; nc.look(a + Math.PI, -.22, 1); }, c);
    await page.waitForTimeout(350); await hideHud(page); await shot(page, 'c-' + c.id);
    await ev(page, () => { window.__nc.me.mesh.visible = true; });
  }
  const m3 = cars.find(c => c.id === 'e92');
  await ev(page, (c) => { const p = window.__nc.player; p.x = c.x; p.z = c.z - 2.6; }, m3);
  await page.waitForTimeout(250);
  check(/BMW M3 \(E92\)/.test((await ev(page, () => window.__nc.ctx())) || ''), `實車旁的提示：${await ev(page, () => window.__nc.ctx())}`);
  await ev(page, () => window.__nc.carInfo('e92'));
  const dl = await ev(page, () => document.getElementById('dlgText')?.textContent || document.querySelector('#dialog')?.textContent || '');
  check(/CC BY/.test(dl), `看車對話有模型授權：${(dl.match(/模型：[^\n]*/) || [''])[0]}`);
  await shot(page, 'g-dialog');
  // 買下（加錢）→ 換車、上街開
  await ev(page, () => { window.__nc.closeDialog(); window.__nc.motors.cash = 2e6; });
  await ev(page, () => window.__nc.carInfo('e92'));
  await ev(page, () => window.__nc.pick(0)); await ev(page, () => window.__nc.pick(0));
  await page.waitForTimeout(300);
  check(await ev(page, () => window.__nc.motors.owned.includes('e92') && window.__nc.motors.cur === 'e92'), '買下 BMW M3 (E92)');
  await ev(page, () => window.__nc.pick(0));
  await page.waitForTimeout(1800);
  const dv = await ev(page, () => { const nc = window.__nc, v = nc.player.veh; return { mode: nc.player.mode, id: v && v.carId, glbBody: !!(v && v.body.children.some(o => o.isGroup)), wheels: v && v.wheels.length, isCar: v && v.isCar }; });
  check(dv.mode === 'drive' && dv.id === 'e92' && dv.glbBody && dv.wheels === 4, `開著實車 ${JSON.stringify(dv)}`);
  const w0 = await ev(page, () => window.__nc.player.veh.wheels[0].w.rotation.x);
  await page.keyboard.down('KeyW'); await page.keyboard.down('KeyA'); await page.waitForTimeout(1400);
  const w1 = await ev(page, () => { const v = window.__nc.player.veh; return { spin: v.wheels[0].w.rotation.x, steer: v.wheels.find(w => w.front).piv.rotation.y, kmh: Math.hypot(v.vx, v.vz) * 3.6 }; });
  await page.keyboard.up('KeyA'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
  check(Math.abs(w1.spin - w0) > 1 && Math.abs(w1.steer) > .05, `輪子轉動 ${(w1.spin - w0).toFixed(1)} rad、前輪轉向 ${w1.steer.toFixed(2)}、時速 ${w1.kmh.toFixed(0)}`);
  await hideHud(page);
  await ev(page, () => { const nc = window.__nc; nc.look(nc.player.veh.yaw + 2.4, .02, 0); });
  await page.waitForTimeout(300); await ev(page, () => { const nc = window.__nc; nc.look(nc.player.veh.yaw + 2.4, .02, 0); });
  await shot(page, 'g-drive');
  // CHROME WORKS：可換色的車換色、彩繪車不能換
  await ev(page, () => window.__nc.livery());
  const pe = await ev(page, () => window.__nc.motors.paint.e92);
  check(Number.isInteger(pe), `E92 換色 → #${(pe >>> 0).toString(16)}`);
  await ev(page, () => window.__nc.applyCar('m3gtr'));
  await ev(page, () => window.__nc.livery());
  check(/原廠彩繪/.test(await ev(page, () => document.getElementById('toast').textContent)), 'M3 GTR 彩繪車不能換色');
  // 機車
  await ev(page, () => { const nc = window.__nc; nc.walk(); nc.applyCar('s1krr19'); });
  await page.waitForTimeout(400);
  await ev(page, () => { const nc = window.__nc; nc.drive(); });
  await page.waitForTimeout(300);
  const bk = await ev(page, () => { const v = window.__nc.player.veh; return { isCar: v.isCar, wheels: v.wheels.length, rider: window.__nc.player.mode }; });
  check(!bk.isCar && bk.wheels === 2, `騎實車機車 ${JSON.stringify(bk)}`);
  await page.keyboard.down('KeyW'); await page.keyboard.down('KeyD'); await page.waitForTimeout(1500); await page.keyboard.up('KeyD'); await page.keyboard.up('KeyW');
  await hideHud(page);
  await ev(page, () => { const nc = window.__nc; nc.look(nc.player.veh.yaw + 1.9, .05, 0); });
  await page.waitForTimeout(250); await ev(page, () => { const nc = window.__nc; nc.look(nc.player.veh.yaw + 1.9, .05, 0); });
  await shot(page, 'g-bike');
  // 街景：每台實車停在 LAZARUS 門口拍一張（CITY=1）
  if (process.env.CITY) for (const id of ['e92', 'm3c', 'm4wb', 'm3gtr', 'm3t24', 'm4gt3', 'gt3rs', 'gt3r', 's1krr', 's1krr19']) {
    await ev(page, (id) => { const nc = window.__nc, d = nc.spots.clubDoor; nc.walk(); nc.applyCar(id); nc.drive(); const v = nc.player.veh; v.x = d.x + 10; v.z = d.z + 8.9; v.yaw = 1.57; v.vx = v.vz = 0; nc.look(v.yaw - 3.6, .02, 0); }, id);
    await page.waitForTimeout(900);
    await ev(page, () => { const nc = window.__nc; nc.look(nc.player.veh.yaw - 3.6, .02, 0); });
    await hideHud(page); await shot(page, 'city-' + id);
  }
  // 車庫：擁有的實車停在車格裡
  await ev(page, () => { const nc = window.__nc; nc.walk(); nc.motors.owned.push('gt3rs', 's1krr', 'm4gt3', 'gt3r', 's1krr19', 'm3t24', 'halcyon'); nc.applyCar('kestrel'); nc.motors.cur = 'kestrel'; nc.garage(); nc.enter('home'); });
  await page.waitForTimeout(600);
  await ev(page, () => { const nc = window.__nc; nc.player.x = 0; nc.player.z = 30; nc.player.yaw = Math.PI; nc.look(Math.PI, -.15, 1); });
  await page.waitForTimeout(500); await hideHud(page);
  await shot(page, 'g-garage');
  await ev(page, () => { const nc = window.__nc; nc.me.mesh.visible = false; nc.player.x = 0; nc.player.z = 6; nc.player.yaw = 0; nc.look(0, -.12, 1); });
  await page.waitForTimeout(500); await hideHud(page);
  await shot(page, 'g-garage-back');
  await ev(page, () => { window.__nc.me.mesh.visible = true; });
  const gs = await ev(page, () => window.__nc.getStats());
  check(gs.drawCalls > 0, `車庫 ${gs.triangles} 個三角形、${gs.drawCalls} 個 draw call`);
} finally {
  check(!log.pageerrors.length, `沒有未捕捉例外 ${log.pageerrors.slice(0, 3).join(' | ')}`);
  check(!log.errors.length, `沒有 console.error ${log.errors.slice(0, 3).join(' | ')}`);
  check(!log.external.length, `沒有外部請求 ${log.external.slice(0, 3).join(' | ')}`);
  await browser.close(); srv.close();
}
console.log(failed ? `✗ ${failed} 項失敗` : '✓ 全部通過');
process.exit(failed ? 1 : 0);
