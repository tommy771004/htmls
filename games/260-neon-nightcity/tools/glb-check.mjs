// 實車模型驗收：以本機 HTTP 伺服器開頁（assets/260/ 要能下載），檢查 cars.json 的每台 GLB 都載入、展示廳與車庫換成實車、
// 買一台實車開上街（輪子轉動、轉向）、騎實車機車、CHROME WORKS 換色規則，並且沒有錯誤與外部請求。
//   node tools/glb-check.mjs        SHOT_DIR=… 會存截圖
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../..');
const IDS = Object.keys(JSON.parse(readFileSync(resolve(repo, 'assets/260/cars.json'), 'utf8')));
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
  const early = await ev(page, () => window.__nc.glb.loaded.slice());
  check(early.every(id => id === 'ae86' || id === 'zx6r'), `開頁時只下載座駕與路邊機車（${early.join(', ') || '還沒下載完'}），其他進車行或車庫才下載`);
  const t0 = Date.now();
  await ev(page, () => window.__nc.loadAllGLB());
  const g = await ev(page, () => window.__nc.glb);
  check(g.on && g.loaded.length === IDS.length && !g.failed.length, `GLB 下載 ${g.loaded.length}/${IDS.length}（${((Date.now() - t0) / 1000).toFixed(1)} s）${g.failed.length ? '，失敗 ' + g.failed.join(',') : ''}`);
  // World 第四輪之二（27-props.js 檔尾）：街道設施、植物與海岸的 8 組模型、快速道路的橋墩（hwy），加上 world_1 第二批的路燈（w1_grc）與觀景解說牌（w1_board）下載好、換掉程式建模；
  // 柏油貼圖（w1_asphalt）不是模型組，下載好就開 ASPH_U
  await page.waitForFunction(() => { const w = window.__nc.props.w2; return w && Object.keys(w.sets).length + w.failed.length >= 11 && (w.swapped.includes('asphalt') || w.failed.includes('w1_asphalt')); }, null, { timeout: 60000 }).catch(() => {});
  const w2 = await ev(page, () => { const w = window.__nc.props.w2; return { sets: Object.keys(w.sets).length, failed: w.failed, swapped: w.swapped.length, has: ['lamps', 'asphalt', 'board'].filter(k => w.swapped.includes(k)), kept: w.kept(), n: w.n, board: w.board }; });
  check(w2.sets === 11 && !w2.failed.length && w2.swapped >= 16 && w2.has.length === 3 && w2.kept === 1 && w2.n.trees > 1000 && w2.n.containers > 500 && w2.n.ebox > 20 && w2.n.pump >= 4 && w2.n.lamps > 3000 && w2.n.pier > 20 && w2.board, `world_2 模型與橋墩 ${w2.sets}/11 組、換掉 ${w2.swapped} 類（含 ${w2.has.join('、')}）、程式建模只留遠景的樹（${w2.kept}）${JSON.stringify(w2.n)}${w2.failed.length ? '，失敗 ' + w2.failed.join(',') : ''}`);
  const grc = await ev(page, () => ['grc_sedan', 'grc_stepvan', 'grc_mailvan'].map(t => window.__nc.parked.filter(p => p.type === t).length));
  check(grc.every(n => n > 10), `gameready_city 的三台車混進路邊停車（轎車 ${grc[0]}、廂型貨車 ${grc[1]}、郵務車 ${grc[2]}）`);

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
  if (process.env.CLOSEUPS) for (const c of cars.filter(c => IDS.includes(c.id) && (!process.env.ONLY || process.env.ONLY.split(',').includes(c.id)))) {
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
  // 新機車的騎乘姿勢
  for (const id of ['zx6r', 'v4']) {
    await ev(page, (id) => { const nc = window.__nc; nc.walk(); nc.applyCar(id); nc.drive(); const v = nc.player.veh; v.vx = v.vz = 0; nc.look(v.yaw + 1.6, .05, 0); }, id);
    await page.waitForTimeout(500); await ev(page, () => { const nc = window.__nc; nc.look(nc.player.veh.yaw + 1.6, .05, 0); });
    await hideHud(page); await shot(page, 'g-ride-' + id);
  }
  // 車行門口：門前兩台展示車與櫥窗剪影，走近才下載
  await ev(page, () => { const nc = window.__nc, d = nc.spots.dealerDoor; nc.walk(); nc.tpL(d.x, d.z + 9, Math.PI); nc.look(nc.player.yaw, .05, 1); });
  await page.waitForTimeout(2500); await hideHud(page);
  const front = await ev(page, () => ({ loaded: window.__nc.glb.loaded.slice(), st: window.__nc.getStats() }));
  check(['f40', 'sf90', 'r34', 'supra', 'nsx', 'zr1'].every(id => front.loaded.includes(id)), `車行門口的實車已下載，${front.st.triangles} 個三角形、${front.st.drawCalls} 個 draw call、${front.st.fps} fps`);
  await shot(page, 'g-storefront');
  // 街景：每台實車停在 LAZARUS 門口拍一張（CITY=1）
  if (process.env.CITY) for (const id of IDS.filter(id => !process.env.ONLY || process.env.ONLY.split(',').includes(id))) {
    await ev(page, (id) => { const nc = window.__nc, d = nc.spots.clubDoor; nc.walk(); nc.applyCar(id); nc.drive(); const v = nc.player.veh, s = nc.Ws(d.x + 10, d.z + 8.9, 1.57); v.x = s.x; v.z = s.z; v.yaw = s.yaw; v.vx = v.vz = 0; nc.look(v.yaw - 3.6, .02, 0); }, id);
    await page.waitForTimeout(900);
    await ev(page, () => { const nc = window.__nc; nc.look(nc.player.veh.yaw - 3.6, .02, 0); });
    await hideHud(page); await shot(page, 'city-' + id);
  }
  // 車庫：擁有的實車停在車格裡
  await ev(page, () => { const nc = window.__nc; nc.walk(); nc.motors.owned.push('gt3rs', 's1krr', 'm4gt3', 'gt3r', 's1krr19', 'm3t24', 'r34', 'f40', 'v4', 'police'); nc.applyCar('ae86'); nc.motors.cur = 'ae86'; nc.garage(); nc.enter('home'); });
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

  // 島上的基地與對岸的遠景（27-props.js 的 COAST_MODELS）：走近就下載，量模型在所在區（邏輯座標）的範圍，
  // 島上的要整塊落在灰鷗島上、底部在地面附近（原檔有幾公尺的地基）；對岸的要貼著各自的河岸（河岸基礎在水面下二十公尺內）（倫敦的東緣、舊港城的西緣），不能浮在空中或沉到水裡
  // 十五片版圖拿掉了東灣對岸（golu、s7），只測頁面還有的模型；外海的兩座島（鷹巖村、光格島）：底部沉在海面下、頂端在海面上，中心對著原本程式建模的島
  const coastIds = await ev(page, () => window.__nc.props.coast.models.map(o => o.id));
  for (const id of ['ruin', 'office', 'london', 'golu', 's7', 'eze', 'tron'].filter(id => coastIds.includes(id))) {
    await ev(page, (id) => { const nc = window.__nc, o = nc.props.coast.models.find(o => o.id === id); nc.tpL(o.at.x + (o.proxy === 'isle' ? 0 : o.id === 'london' ? 700 : o.proxy === 'eze' || o.proxy === 'tron' ? 0 : -600), o.at.z - (o.proxy === 'eze' || o.proxy === 'tron' ? 700 : 0), 0); }, id);
    let done = false;
    for (let i = 0; i < 240 && !done; i++) { await page.waitForTimeout(250); done = await ev(page, (id) => !!window.__nc.props.coast.models.find(o => o.id === id).done, id); }
    const bb = await ev(page, (id) => {
      const C = window.__nc.props.coast, o = C.models.find(o => o.id === id);
      if (!o.obj) return null;
      const inv = o.obj.parent.matrixWorld.clone().invert(), b = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 };
      o.obj.updateMatrixWorld(true);
      o.obj.traverse(m => {
        if (!m.isMesh) return;
        m.geometry.boundingBox || m.geometry.computeBoundingBox();
        const q = m.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld));
        b.x0 = Math.min(b.x0, q.min.x); b.x1 = Math.max(b.x1, q.max.x); b.y0 = Math.min(b.y0, q.min.y); b.y1 = Math.max(b.y1, q.max.y); b.z0 = Math.min(b.z0, q.min.z); b.z1 = Math.max(b.z1, q.max.z);
      });
      for (const k in b) b[k] = Math.round(b[k]);
      return { b, isle: o.proxy === 'isle' ? C.ISLE : null, far: C.FAR_BANK_X, east: C.EAST_BANK_X, at: o.at, sea: window.__nc.sea.SEA_Y };
    }, id);
    let ok = !!bb, why = '';
    if (bb && bb.isle) { const I = bb.isle; ok = bb.b.x0 > I.x0 - 5 && bb.b.x1 < I.x1 + 5 && bb.b.z0 > I.z0 - 5 && bb.b.z1 < I.z1 + 5 && bb.b.y0 > -6 && bb.b.y0 < 2 && bb.b.y1 > 10; why = `島 x ${I.x0}…${I.x1}、z ${I.z0}…${I.z1}`; }
    else if (bb && (id === 'eze' || id === 'tron')) { const cx = (bb.b.x0 + bb.b.x1) / 2, cz = (bb.b.z0 + bb.b.z1) / 2; ok = Math.hypot(cx - bb.at.x, cz - bb.at.z) < 80 && bb.b.y0 < bb.sea - 5 && bb.b.y1 > bb.sea + (id === 'eze' ? 150 : 15); why = `島心 ${Math.round(bb.at.x)}, ${Math.round(bb.at.z)}，海面 ${bb.sea}`; }
    else if (bb && id === 'london') { ok = Math.abs(bb.b.x1 - bb.far) < 60 && bb.b.y0 > -25 && bb.b.y0 < 5 && bb.b.y1 > 40; why = `河岸 x ${bb.far}`; }
    else if (bb) { ok = bb.b.x0 > bb.east - 40 && bb.b.y0 > -25 && bb.b.y0 < 5 && bb.b.y1 > 20; why = `河岸 x ${bb.east}`; }
    check(done && ok, `${id} 的模型擺在該在的地方（邏輯座標範圍 ${JSON.stringify(bb && bb.b)}，${why}）`);
  }

  // 北嶺鐵道橋（10-city.js 的 VIADUCT）：走近就下載，擺好拿掉程式替身；山坡在模型範圍中間貼著模型地面下 1.5 m（hf 雙線性）
  {
    await ev(page, () => { const nc = window.__nc, V = nc.props.viaduct; nc.tpL(V.x - 40, V.z + 120, Math.PI); });
    let done = false;
    for (let i = 0; i < 240 && !done; i++) { await page.waitForTimeout(250); done = await ev(page, () => !!window.__nc.props.w1.find(o => o.set === 'far_rail').obj); }
    const vr = await ev(page, () => {
      const nc = window.__nc, V = nc.props.viaduct, d = [];
      for (const [fx, fz] of [[.25, .5], [.5, .5], [.75, .5], [.5, .2], [.5, .8]]) { const x = V.x + V.lx0 + V.W * fx, z = V.z + V.lz0 + V.D * fz; d.push(nc.park.h(x, z) - (V.at(V.W * fx, V.D * fz) + V.y - 1.5)); }
      return { proxy: !!(V.proxy && V.proxy.parent), d: d.map(v => +v.toFixed(2)), deck: +V.deck.toFixed(1) };
    });
    await page.waitForTimeout(800); await hideHud(page); await ev(page, () => { const nc = window.__nc, V = nc.props.viaduct, [x, z] = nc.W(V.x, V.z); nc.look(Math.atan2(x - nc.player.x, z - nc.player.z), .12, 0); });
    await page.waitForTimeout(400); await shot(page, 'g-viaduct');
    check(done && !vr.proxy && vr.d.every(v => Math.abs(v) < .05), `北嶺鐵道橋模型已擺上、替身拿掉，山溝貼著模型地面（差 ${vr.d.join('、')} m，橋面 y ${vr.deck}）`);
  }

  // 北嶺鐵道橋的列車（21-rail.js）：走近就下載 w1_train 換掉程式替身；夜裡停在橋中間截圖（車窗亮著）
  {
    let ok = false;
    for (let i = 0; i < 160 && !ok; i++) { await page.waitForTimeout(250); ok = await ev(page, () => window.__nc.props.rail.R.loaded); }
    const t0 = await ev(page, () => { const nc = window.__nc, R = nc.props.rail.R, t = nc.time(); nc.time(21 * 60 + 30); nc.props.rail.go(1, R.len / 2 + 50); R.speed = 0; return t; });
    await page.waitForTimeout(1500); await hideHud(page);
    const tr = await ev(page, () => {
      const nc = window.__nc, V = nc.props.viaduct, R = nc.props.rail.R, [cx, cz] = nc.W(V.x + 25, V.z + 48), [tx, tz] = nc.W(V.x - 15, V.zc(V.x - 15));
      nc.camAt(cx, V.deck + 9, cz, tx, V.deck + 2, tz);
      return { on: R.cars.filter(c => c.on && c.obj.visible).length, mesh: R.cars.reduce((a, c) => a + c.obj.children.length, 0), win: +R.uM.value.z.toFixed(2) };
    });
    await page.waitForTimeout(500); await shot(page, 'g-train');
    await ev(page, (t) => { const nc = window.__nc, R = nc.props.rail.R; nc.camAt(); nc.time(t); R.speed = 17; R.state = 'wait'; R.tw = 30; }, t0);
    check(ok && tr.on === 5 && tr.mesh > 5 && tr.win > .5, `北嶺鐵道橋的列車換成 Lastochka 模型，五節都在橋上、夜裡車窗亮（${JSON.stringify(tr)}）`);
  }

  // 安全屋：走近門口就下載室內模型，換掉程式建模的房間
  for (const id of ['loft', 'villa', 'office', 'mini', 'l16', 'i14']) {
    await ev(page, (id) => { const nc = window.__nc, a = nc.gta.apt.APT[id], d = a.door, f = a.face || 1; nc.motors.props.own.push(id); nc.tpL(d.x, d.z + 6 * f, f > 0 ? Math.PI : 0); }, id);
    let ok = false;
    for (let i = 0; i < 60 && !ok; i++) { await page.waitForTimeout(250); ok = await ev(page, (id) => !window.__nc.gta.apt.APT[id].fb.visible, id); }
    await ev(page, (id) => { const nc = window.__nc; nc.enter(id); nc.look(nc.gta.apt.APT[id].spawn.yaw, .15, 1); }, id);
    await page.waitForTimeout(600); await hideHud(page);
    await shot(page, 'g-' + id);
    const as = await ev(page, () => window.__nc.getStats());
    check(ok && as.where === id, `安全屋 ${id} 的室內模型已換上，${as.triangles} 個三角形、${as.drawCalls} 個 draw call、${as.fps} fps`);
  }
} finally {
  check(!log.pageerrors.length, `沒有未捕捉例外 ${log.pageerrors.slice(0, 3).join(' | ')}`);
  check(!log.errors.length, `沒有 console.error ${log.errors.slice(0, 3).join(' | ')}`);
  check(!log.external.length, `沒有外部請求 ${log.external.slice(0, 3).join(' | ')}`);
  await browser.close(); srv.close();
}
console.log(failed ? `✗ ${failed} 項失敗` : '✓ 全部通過');
process.exit(failed ? 1 : 0);
