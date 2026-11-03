// 車門、坐姿駕駛與車內視角的驗收（68-xdoor.js、src/doors.mjs）：以本機 HTTP 開頁，換成有門的實車，
// 走到門邊按 F 開門上車 → 坐在駕駛座 → 車內視角 → 開門下車；方向盤跟著轉、雙手握在輪圈上、副駕的乘客、
// 從副駕那側上車（坐進副駕再挪到駕駛座）、開著的門擋人，最後到展示廳走近一台有門的車看門會不會自己打開。
//   node tools/door-check.mjs [id]      SHOT_DIR=… 會存截圖（預設 .cache/door-check/）
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../..');
const SPEC = JSON.parse(readFileSync(resolve(repo, 'assets/260/cars.json'), 'utf8'));
const DOOR_IDS = Object.keys(SPEC).filter((id) => SPEC[id].door);
const id = process.argv[2] || 'e92';
const shotDir = resolve(process.env.SHOT_DIR || resolve(root, '.cache/door-check'));
mkdirSync(shotDir, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };
const srv = createServer((q, s) => {
  const f = resolve(repo, '.' + decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(repo + sep) || !existsSync(f) || !statSync(f).isFile()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(readFileSync(f));
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/web/260-neon-nightcity.html?gpu=high`;

let failed = 0;
const check = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) failed++; };
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await raf(page); await page.screenshot({ path: resolve(shotDir, name + '.png') }); console.log('    ' + resolve(shotDir, name + '.png')); };
// 截圖相機：車身座標 (x, y, z) 看向 (tx, ty, tz)
const camCar = (page, p, t) => ev(page, ([p, t]) => {
  const N = window.__nc, v = N.vehicles[0], c = Math.cos(v.yaw), s = Math.sin(v.yaw);
  const W = (l) => [v.x + l[0] * c + l[2] * s, (v.y || 0) + l[1], v.z - l[0] * s + l[2] * c];
  N.camAt(...W(p), ...W(t));
}, [p, t]);

const { browser, page, log } = await open(url, { w: 1440, h: 900 });
try {
  await ev(page, () => { try { localStorage.removeItem('nc260.motors'); } catch (e) {} });
  await ev(page, () => window.__nc.start());
  await page.waitForTimeout(1500);
  await ev(page, () => { const N = window.__nc; N.time(22 * 60); N.weather('clear'); for (const k of ['toast', 'prompt', 'marker']) { const el = document.getElementById(k); if (el) el.style.visibility = 'hidden'; } });
  // 1. 每台有 door 規格的車都切得出左右兩扇門
  const cut = await ev(page, async (ids) => {
    const N = window.__nc, out = {};
    for (const id of ids) { const t0 = performance.now(), tpl = await N.loadGLB(id); out[id] = tpl ? { doors: (tpl.doors || []).map((d) => d.s), tris: (tpl.doors || []).map((d) => d.list.reduce((a, e) => a + (e.geo.index ? e.geo.index.count : e.geo.attributes.position.count) / 3, 0)), ms: Math.round(performance.now() - t0) } : null; }
    return out;
  }, DOOR_IDS);
  for (const [k, r] of Object.entries(cut)) check(r && r.doors.length === 2 && r.tris.every((n) => n > 300), `${k}：切出 ${r ? r.doors.length : 0} 扇門（${r ? r.tris.join(' / ') : '-'} 個三角形，載入＋切門 ${r ? r.ms : '-'} ms）`);
  // 2. 換成這台車，走到駕駛座門邊
  await ev(page, (id) => { const N = window.__nc; N.applyCar(id); }, id);
  await page.waitForFunction(() => !!window.__nc.gta.door.state(), null, { timeout: 30000 });
  await ev(page, () => { const N = window.__nc, v = N.vehicles[0]; N.player.x = v.x + Math.cos(v.yaw) * 2.4 - Math.sin(v.yaw) * .4; N.player.z = v.z - Math.sin(v.yaw) * 2.4 - Math.cos(v.yaw) * .4; N.player.yaw = v.yaw - Math.PI / 2; });
  await page.waitForTimeout(400);
  const prompt = await ev(page, () => window.__nc.ctx());
  check(/上車/.test(prompt || ''), `門邊的提示：${prompt}`);
  await camCar(page, [4.2, 1.7, 2.6], [0, .8, 0]);
  await shot(page, `${id}-0-walkup`);
  // 3. 按 F：開門 → 坐進去 → 關門
  const seq = await ev(page, async () => {
    const N = window.__nc, D = N.gta.door, maxK = { v: 0 }, modes = [];
    N.act();
    const t0 = performance.now();
    while (performance.now() - t0 < 2600) { await new Promise((r) => requestAnimationFrame(r)); const st = D.state(); maxK.v = Math.max(maxK.v, ...st.map((d) => d.k)); modes.push(N.player.mode); }
    return { maxK: maxK.v, end: D.state(), mode: N.player.mode, seq: !!D.DOOR.seq, firstDrive: modes.indexOf('drive') };
  });
  check(seq.maxK > .98, `上車時門打開到 ${seq.maxK.toFixed(2)}`);
  check(seq.mode === 'drive' && !seq.seq && seq.end.every((d) => d.k === 0), `坐進駕駛座、門關上（${JSON.stringify(seq.end)}）`);
  // 開門過場的中間：重新來一次，在門全開時截圖
  await ev(page, () => window.__nc.walk());
  await ev(page, () => { const N = window.__nc, v = N.vehicles[0]; N.player.x = v.x + Math.cos(v.yaw) * 2.4; N.player.z = v.z - Math.sin(v.yaw) * 2.4; });
  await page.waitForTimeout(300);
  await ev(page, () => window.__nc.gta.door.enter());
  await page.waitForTimeout(780); await shot(page, `${id}-1-open`);
  await page.waitForTimeout(330); await shot(page, `${id}-2-sitting`);
  await page.waitForTimeout(1200);
  // 4. 坐在車裡（門打開看駕駛）
  await ev(page, () => window.__nc.gta.door.open(undefined, 1, 1));
  await page.waitForTimeout(900);
  await camCar(page, [2.6, 1.45, .9], [.3, .75, -.1]);
  await shot(page, `${id}-3-seated`);
  await ev(page, () => window.__nc.gta.door.open(undefined, 2, 1));
  await page.waitForTimeout(900);
  await camCar(page, [-2.3, 1.35, .2], [.4, .8, -.05]);
  await shot(page, `${id}-3b-seated-passenger-side`);
  await camCar(page, [2.9, 1.25, -1.9], [.9, .7, .45]);
  await shot(page, `${id}-3c-door-inner`);
  await ev(page, () => window.__nc.gta.door.open(undefined, 2, 0));
  await ev(page, () => window.__nc.gta.door.open(undefined, 1, 0));
  await page.waitForTimeout(700);
  await camCar(page, [3.6, 1.5, -2.6], [0, .8, .2]);
  await shot(page, `${id}-4-closed-driver`);
  // 5. 車內視角
  await ev(page, () => { const N = window.__nc; N.camAt(); N.gta.door.fp(true); N.look(N.vehicles[0].yaw, .13); });
  await page.waitForTimeout(600);
  const fp = await ev(page, () => { const N = window.__nc, v = N.vehicles[0], c = N.camera.position; return { d: Math.hypot(c.x - v.x, c.z - v.z), y: c.y - (v.y || 0), near: N.camera.near, vis: N.me.mesh.visible }; });
  check(fp.d < 1.2 && fp.y > .5 && fp.y < Math.max(1.4, SPEC[id].h - .2) && fp.near < .1, `車內視角：鏡頭在車身裡（離中心 ${fp.d.toFixed(2)} m、高 ${fp.y.toFixed(2)} m、近平面 ${fp.near}）`);
  await shot(page, `${id}-5-fp`);
  await ev(page, () => window.__nc.look(window.__nc.vehicles[0].yaw + 1.2, .25));
  await page.waitForTimeout(200);
  await shot(page, `${id}-6-fp-left`);
  // 車內視角看得到自己握方向盤的手（頭縮掉），往左打時雙手跟著方向盤轉
  await ev(page, () => { const N = window.__nc; N.keys.KeyA = true; });
  await page.waitForTimeout(900);
  await ev(page, () => { const N = window.__nc; N.look(N.vehicles[0].yaw, .42); });
  await page.waitForTimeout(150);
  const fpv = await ev(page, () => ({ vis: window.__nc.me.mesh.visible, noHead: !!window.__nc.me.people[0].noHead }));
  check(fpv.vis && fpv.noHead, `車內視角畫出自己的身體、頭縮掉（${JSON.stringify(fpv)}）`);
  await shot(page, `${id}-6b-fp-turn`);
  await ev(page, () => { window.__nc.keys.KeyA = false; });
  await ev(page, () => window.__nc.gta.door.fp(false));
  // 6. 下車
  const out = await ev(page, async () => {
    const N = window.__nc, D = N.gta.door; let maxK = 0;
    D.exit();
    const t0 = performance.now();
    while (performance.now() - t0 < 2200) { await new Promise((r) => requestAnimationFrame(r)); maxK = Math.max(maxK, ...D.state().map((d) => d.k)); }
    return { maxK, mode: N.player.mode, end: D.state(), seq: !!D.DOOR.seq };
  });
  check(out.maxK > .7 && out.mode === 'walk' && !out.seq && out.end.every((d) => d.k === 0), `下車：門開到 ${out.maxK.toFixed(2)}、站到車外、門關上`);
  // 6b. 方向盤跟著轉、雙手握在方向盤外緣（左手 10 點、右手 2 點）
  if (SPEC[id].sw) {
    await ev(page, () => window.__nc.gta.door.enter());
    await page.waitForFunction(() => window.__nc.player.mode === 'drive' && !window.__nc.gta.door.DOOR.seq, null, { timeout: 8000 });
    await page.waitForTimeout(500);
    const grip = (key) => ev(page, async (key) => {
      const N = window.__nc, v = N.vehicles[0], sw = v.inst.sw, P = N.me.people[0];
      if (key) N.keys[key] = true;
      await new Promise((r) => setTimeout(r, 900));
      const T = sw.piv.matrixWorld, c = [T.elements[12], T.elements[13], T.elements[14]];
      // 轉軸（世界）：方向盤 pivot 的父節點（車身）轉過去
      sw.piv.parent.updateWorldMatrix(true, false);
      const pe = sw.piv.parent.matrixWorld.elements, n = sw.n, nw = [pe[0] * n.x + pe[4] * n.y + pe[8] * n.z, pe[1] * n.x + pe[5] * n.y + pe[9] * n.z, pe[2] * n.x + pe[6] * n.y + pe[10] * n.z];
      const nl = Math.hypot(...nw); for (let i = 0; i < 3; i++) nw[i] /= nl;
      const q = sw.piv.quaternion, ang = 2 * Math.atan2(Math.hypot(q.x, q.y, q.z), q.w) * Math.sign(q.x * n.x + q.y * n.y + q.z * n.z || 1);
      const hand = (s) => {   // 掌心（手腕沿手指方向 7.5 cm，40-people.js 的 gripAt 也照這個距離）→ 世界：p.h × sm × 骨架空間
        const b = P.bones['hand_' + s], w = b.getWorldPosition(b.position.clone()), f = b.children.find((c) => c.isBone) || P.bones['lowerarm_' + s];
        const t = f.getWorldPosition(f.position.clone()), m2b = 1 / P.sm.matrix.getMaxScaleOnAxis();
        const dir = f === P.bones['lowerarm_' + s] ? w.clone().sub(t) : t.sub(w);
        w.addScaledVector(dir.normalize(), .075 * m2b);
        w.applyMatrix4(P.sm.matrix); P.h.updateWorldMatrix(true, false); w.applyMatrix4(P.h.matrixWorld);
        const d = [w.x - c[0], w.y - c[1], w.z - c[2]], ax = d[0] * nw[0] + d[1] * nw[1] + d[2] * nw[2];
        return { ax: +ax.toFixed(3), rad: +Math.sqrt(Math.max(0, d[0] ** 2 + d[1] ** 2 + d[2] ** 2 - ax * ax)).toFixed(3) };
      };
      const out = { steer: +v.steer.toFixed(3), ang: +ang.toFixed(3), k: P.wheel ? P.wheel.k : null, l: hand('l'), r: hand('r') };
      return out;
    }, key);
    const g0 = await grip(null);
    const r = SPEC[id].sw.r;
    const onRim = (h) => Math.abs(h.ax) < .06 && Math.abs(h.rad - r) < .06;   // 掌心離輪圈 6 cm 內
    check(g0.k === 1 && onRim(g0.l) && onRim(g0.r), `雙手握在方向盤上（半徑 ${r}：左 ${JSON.stringify(g0.l)}、右 ${JSON.stringify(g0.r)}）`);
    await ev(page, () => window.__nc.gta.door.open(undefined, 1, 1));
    await page.waitForTimeout(800);
    const swc = SPEC[id].sw.c;
    await camCar(page, [swc[0] + 1.25, swc[1] + .3, swc[2] - .55], [swc[0], swc[1] - .05, swc[2] - .05]);
    await shot(page, `${id}-8-wheel-center`);
    const gl = await grip('KeyA');
    check(gl.steer > .3 && gl.ang > .5, `往左打：前輪 ${gl.steer}、方向盤轉 ${(gl.ang * 180 / Math.PI).toFixed(0)}°（逆時針）`);
    check(onRim(gl.l) && onRim(gl.r), `手跟著方向盤轉（左 ${JSON.stringify(gl.l)}、右 ${JSON.stringify(gl.r)}）`);
    await shot(page, `${id}-8-wheel-left`);
    await ev(page, () => { window.__nc.keys.KeyA = false; });
    const gr = await grip('KeyD');
    check(gr.steer < -.3 && gr.ang < -.5, `往右打：前輪 ${gr.steer}、方向盤轉 ${(gr.ang * 180 / Math.PI).toFixed(0)}°`);
    await shot(page, `${id}-8-wheel-right`);
    await ev(page, () => { window.__nc.keys.KeyD = false; window.__nc.gta.door.open(undefined, 1, 0); });
    await page.waitForTimeout(900);
    // 6c. 副駕的乘客
    await ev(page, () => window.__nc.gta.door.pax(true));
    await ev(page, () => window.__nc.gta.door.open(undefined, 2, 1));
    await page.waitForTimeout(900);
    await camCar(page, [-2.4, 1.3, .5], [-.3, .8, -.1]);
    await shot(page, `${id}-9-passenger`);
    await ev(page, () => { window.__nc.gta.door.open(undefined, 2, 0); });
    await page.waitForTimeout(700);
    await ev(page, () => window.__nc.gta.door.pax(null));
    // 下車都等過場真的跑完（seq 清掉、回到走路），不固定等 2.2 s：畫面卡的時候會沒跑完就往下測
    // 6d. 下車，從副駕那側上車：坐進副駕再挪到駕駛座
    await ev(page, async () => { const N = window.__nc; N.gta.door.exit(); for (const t0 = performance.now(); performance.now() - t0 < 6000 && (N.gta.door.DOOR.seq || N.player.mode !== 'walk' || performance.now() - t0 < 600);) await new Promise((r) => setTimeout(r, 50)); });
    // 右駕（door.rhd，方向盤在 -x）的副駕在左邊：R 是駕駛座那側的正負，副駕的門是 s = R > 0 ? 2 : 1
    const R = Math.sign(SPEC[id].sw ? SPEC[id].sw.c[0] : SPEC[id].door.rhd ? -1 : 1) || 1;
    const pass = await ev(page, async ([w, R]) => {
      const N = window.__nc, v = N.vehicles[0], D = N.gta.door, c = Math.cos(v.yaw) * R, s = Math.sin(v.yaw) * R, L = [-(w / 2 + 1.1), 0, -.4 * R];
      // 副駕那側被路邊的東西擋住（69-kinema.js 的 kinDoorSide 會改走駕駛座那側）：把車往駕駛座那側挪開再測
      for (let i = 0; i < 6 && N.col.collide(v.x - c * (v.w / 2 + .55), v.z + s * (v.w / 2 + .55), .3, v.y || 0).hit; i++) { v.x += c * .2; v.z -= s * .2; }
      await new Promise((r) => setTimeout(r, 100));
      N.player.x = v.x + L[0] * c + L[2] * s; N.player.z = v.z - L[0] * s + L[2] * c;
      await new Promise((r) => setTimeout(r, 300));
      const n0 = D.DOOR.stats.pass; D.enter();
      let k2 = 0, k1 = 0, slide = 0; const t0 = performance.now(), ph = [];
      while (performance.now() - t0 < 6000 && (performance.now() - t0 < 600 || D.DOOR.seq)) { await new Promise((r) => requestAnimationFrame(r)); const st = D.state(); k1 = Math.max(k1, st.find((d) => d.s === (R > 0 ? 1 : 2)).k); k2 = Math.max(k2, st.find((d) => d.s === (R > 0 ? 2 : 1)).k); const q = D.DOOR.seq, p = q ? q.ph : '-'; if (p === 'slide') slide++; if (ph[ph.length - 1] !== p) ph.push(p); }
      return { pass: D.DOOR.stats.pass - n0, k1, k2, slide, ph: ph.join('→'), mode: N.player.mode, seq: !!D.DOOR.seq };
    }, [SPEC[id].w, R]);
    check(pass.pass === 1 && pass.k2 > .98 && pass.k1 < .01 && pass.slide > 5 && pass.mode === 'drive' && !pass.seq, `副駕上車：開副駕的門 ${pass.k2.toFixed(2)}、駕駛座的門 ${pass.k1.toFixed(2)}、挪位子 ${pass.slide} 幀（${pass.ph}）、最後坐在駕駛座（${pass.mode}）`);
    // 挪位子中間的截圖
    await ev(page, async () => { const N = window.__nc; N.gta.door.exit(); for (const t0 = performance.now(); performance.now() - t0 < 6000 && (N.gta.door.DOOR.seq || N.player.mode !== 'walk' || performance.now() - t0 < 600);) await new Promise((r) => setTimeout(r, 50)); });
    await ev(page, async ([w, R]) => {
      const N = window.__nc, v = N.vehicles[0], c = Math.cos(v.yaw) * R, s = Math.sin(v.yaw) * R, L = [-(w / 2 + 1.1), 0, -.4 * R];
      N.player.x = v.x + L[0] * c + L[2] * s; N.player.z = v.z - L[0] * s + L[2] * c;
      await new Promise((r) => setTimeout(r, 300)); N.gta.door.enter();
    }, [SPEC[id].w, R]);
    await camCar(page, [-.05, 1.12, -1.05], [0, .75, .5]);   // 後座往前看
    await page.waitForTimeout(1250); await shot(page, `${id}-10-pass-sit`);
    await page.waitForTimeout(450); await shot(page, `${id}-10-pass-slide`);
    await page.waitForTimeout(1500);
    // 6e. 開著的門擋人
    await ev(page, async () => { const N = window.__nc; N.gta.door.exit(); for (const t0 = performance.now(); performance.now() - t0 < 6000 && (N.gta.door.DOOR.seq || N.player.mode !== 'walk' || performance.now() - t0 < 600);) await new Promise((r) => setTimeout(r, 50)); N.gta.door.open(undefined, 1, 1); await new Promise((r) => setTimeout(r, 800)); });
    const col = await ev(page, () => {
      const N = window.__nc, cs = N.gta.door.col(), m = cs[1];
      const o = m ? N.col.collide(m.x, m.z, .3) : null;
      return { n: cs.length, push: o ? Math.hypot(o.x - m.x, o.z - m.z) : 0 };
    });
    check(col.n === 3 && col.push > .3, `開著的門擋人：${col.n} 個碰撞圓，站在門板上被推開 ${col.push.toFixed(2)} m`);
    const col2 = await ev(page, async () => { const N = window.__nc; N.gta.door.open(undefined, 1, 0); await new Promise((r) => setTimeout(r, 900)); return N.gta.door.col().length; });
    check(col2 === 0, `門關上就不擋（剩 ${col2} 個圓）`);
  }
  // 7. 展示廳：走到一台有門的車旁邊
  const sc = await ev(page, (ids) => { const N = window.__nc; return N.spots.showCars.filter((c) => ids.includes(c.id)); }, DOOR_IDS);
  check(sc.length > 0, `展示廳裡有門的車：${sc.map((c) => c.id).join(', ')}`);
  if (sc.length) {
    const c = sc[0];
    await ev(page, (c) => { const N = window.__nc; N.enter('show'); N.showLevel(c.lv || 0); }, c);
    await page.waitForFunction((id) => window.__nc.glb.loaded.includes(id), c.id, { timeout: 30000 });
    await page.waitForTimeout(800);
    const w = SPEC[c.id].w, sz = (SPEC[c.id].db || [0, 0])[1];
    const r = await ev(page, async ([c, w, sz]) => {
      const N = window.__nc, cs = Math.cos(c.yaw), sn = Math.sin(c.yaw), L = [w / 2 + .7, 0, sz + .3];
      N.player.x = c.x + L[0] * cs + L[2] * sn; N.player.z = c.z - L[0] * sn + L[2] * cs; N.player.yaw = c.yaw - Math.PI / 2;
      await new Promise((r) => setTimeout(r, 1600));
      const e = N.gta.door.DOOR.show.find((e) => e.id === c.id && e.g.parent);
      const P = [c.x + 3.6 * cs + 2.4 * sn, 1.7 + (N.player.y || 0), c.z - 3.6 * sn + 2.4 * cs], Tt = [c.x, .8 + (N.player.y || 0), c.z];
      N.camAt(...P, ...Tt);
      return e ? e.inst.doors.map((d) => +d.k.toFixed(2)) : null;
    }, [c, w, sz]);
    check(r && r.some((k) => k > .9), `展示廳的 ${c.id} 走近就開門（${JSON.stringify(r)}）`);
    await shot(page, `${id}-7-showroom-${c.id}`);
    await ev(page, () => window.__nc.camAt());
  }
  const errs = [...log.errors, ...log.pageerrors];
  check(!errs.length, `沒有錯誤${errs.length ? '：' + errs.slice(0, 5).join(' | ') : ''}`);
} finally {
  await browser.close(); srv.close();
}
console.log(failed ? `✗ ${failed} 項沒過` : '✓ 全部通過');
process.exit(failed ? 1 : 0);
