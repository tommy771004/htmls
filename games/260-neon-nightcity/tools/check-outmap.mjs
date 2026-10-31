// 城外的大地圖與導航（90-hud.js 的 mapOut、91-map.js、69-gps.js 的 XG）驗收：外緣山路、榛嶺、機場堤道、紐柏林的路都接進導航路網、
// 從城裡導航過去的路線沿路走（沒有長的直線）、大地圖拉得到那些地方、點路面設得了導航點、地名，最後各拍一張截圖
// 用法：node tools/check-outmap.mjs [html]（預設 web/260-neon-nightcity.html；NC_QUERY='?zrot=25' 轉整座城；SHOT_DIR 存截圖）
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(process.argv[2] || resolve(root, '../../web/260-neon-nightcity.html'));
const shotDir = process.env.SHOT_DIR ? resolve(process.env.SHOT_DIR) : null;
if (shotDir) mkdirSync(shotDir, { recursive: true });
let failed = 0;
const check = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) failed++; };
const { browser, page, log } = await open(htmlPath, { w: 1440, h: 900 });
const ev = (fn, a) => page.evaluate(fn, a);
await ev(() => window.__nc.start()); await page.waitForTimeout(400);
const shot = async n => { if (!shotDir) return; await raf(page); await raf(page); await page.screenshot({ path: resolve(shotDir, n + '.png') }); };

console.log('導航路網（XG）');
const st = await ev(() => window.__nc.gta.gps.xg());
console.log('   ', JSON.stringify(st));
const mo = await ev(() => window.__nc.map.out());
console.log('    mapOut', JSON.stringify(mo));
check(st.outMain > 1000 && st.ms < 300, `城外的邊 ${st.out} 條、連得到城裡的 ${st.outMain} 條，建圖 ${st.ms} ms`);

// 目標（最長一段的門檻 720 m：紐柏林的 OSM 鄉道有一段 675 m 沒有中間點的直路）：榛嶺山頂那頭、每條別墅區山路的盡頭、GP、北環最遠的一段、維修道、機場航廈前
const T = await ev(() => {
  const nc = window.__nc, H = nc.hillRoads(), out = [];
  H.forEach((P, i) => { const p = P[P.length - 1]; out.push({ k: (P.akina ? '榛嶺' : '山路') + i, x: p[0], z: p[1] }); });
  if (nc.nbr) for (const [k, i] of [['gp', 300], ['ns', 2600], ['ns', 4200], ['pit', 12]]) { const t = nc.nbr.track(k); if (t) { const [x, , z] = t.at(i); out.push({ k: `紐柏林 ${k}#${i}`, x, z }); } }
  return out;
});
const from = await ev(() => { const p = window.__nc.player; return { x: p.x, z: p.z }; });
console.log(`路線（從 ${Math.round(from.x)}, ${Math.round(from.z)}）`);
for (const t of T) {
  const r = await ev(([f, t]) => {
    const R = window.__nc.gta.gps.xroute(f.x, f.z, t.x, t.z); let L = 0, seg = 0;
    for (let i = 1; i < R.length; i++) { const d = Math.hypot(R[i][0] - R[i - 1][0], R[i][1] - R[i - 1][1]); L += d; if (i > 1 && i < R.length - 1) seg = Math.max(seg, d); }
    let wi = 0, wd = 0; for (let i = 2; i < R.length - 1; i++) { const d = Math.hypot(R[i][0] - R[i - 1][0], R[i][1] - R[i - 1][1]); if (d > wd) { wd = d; wi = i; } }
    const m = [(R[wi][0] + R[wi - 1][0]) / 2, (R[wi][1] + R[wi - 1][1]) / 2], pm = window.__nc.gta.gps.xproject(...m);
    const e = R[R.length - 2]; return { n: R.length, L, seg, end: Math.hypot(e[0] - t.x, e[1] - t.z), worst: seg > 200 ? `${Math.round(m[0])},${Math.round(m[1])} ${pm && pm.src}` : '' };
  }, [from, t]);
  const air = Math.hypot(t.x - from.x, t.z - from.z);
  check(r.n > 10 && r.seg < 720 && r.end < 30 && r.L < air * 3.5 + 1500, `${t.k}：${(r.L / 1000).toFixed(2)} km（直線 ${(air / 1000).toFixed(2)} km）、${r.n} 點、最長一段 ${Math.round(r.seg)} m、終點離目標 ${r.end.toFixed(1)} m${r.worst ? '（最長一段在 ' + r.worst + '）' : ''}`);
}

// 山路路口的連接路（12-hillmouth.js）：每個路口都鋪了；從城裡那條路的中心線起、接到山路 P[0]；沿路（連接路＋山路開頭 40 m，三條線、車寬的圓）沒有靜態的碰撞（路邊停車、路燈、隱形牆的口）
console.log('山路路口的連接路');
{
  const c = await ev(() => {
    const nc = window.__nc, H = nc.hillConn(), st = H.pop(), P = nc.hillRoads(), mouths = P.filter(p => !p.link || p.mouth).length, hits = [];
    const dyn = [nc.col.dynCircles.splice(0), nc.col.dynMore.splice(0)];   // 車流與路人不算（同步跑完就放回去）
    for (const C of H) {
      const hp = P.find(q => q.conn === C.pts) || [], L = [...C.pts.slice(0, -1), ...hp.slice(0, 6).map(q => [q[0], q[1]])];
      for (let k = 1; k < L.length; k++) for (let t = 0; t < 1; t += .25) {
        const dx = L[k][0] - L[k - 1][0], dz = L[k][1] - L[k - 1][1], l = Math.hypot(dx, dz) || 1, x = L[k - 1][0] + dx * t, z = L[k - 1][1] + dz * t;
        for (const off of [-2, 0, 2]) { const X = x - dz / l * off, Z = z + dx / l * off, o = nc.col.collide(X, Z, 1.1, 0); if (o.hit && Math.hypot(o.x - X, o.z - Z) > .05) hits.push(`${Math.round(X)},${Math.round(Z)}`); }
      }
    }
    nc.col.dynCircles.push(...dyn[0]); nc.col.dynMore.push(...dyn[1]);
    const ends = H.map(C => { const hp = P.find(q => q.conn === C.pts); return hp ? Math.hypot(C.pts.at(-1)[0] - hp[0][0], C.pts.at(-1)[1] - hp[0][1]) : 99; });
    return { st, mouths, n: H.length, hits: [...new Set(hits)], end: Math.max(...ends) };
  });
  console.log('   ', JSON.stringify(c.st));
  check(c.n === c.mouths && !c.st.fail.length, `${c.mouths} 個山路路口都鋪了連接路（共 ${c.st.len} m）`);
  check(c.end < .01, `連接路的終點就是山路的第一點（差 ${c.end.toFixed(3)} m）`);
  check(!c.hits.length, `連接路與山路開頭沒有靜態碰撞${c.hits.length ? '：' + c.hits.slice(0, 6).join(' ') : ''}`);
}

console.log('大地圖');
await page.keyboard.press('KeyM'); await page.waitForTimeout(200);
check(await ev(() => document.getElementById('map').classList.contains('on')), 'M 開啟大地圖');
const view = async (x, z, zoom, name) => {
  // 世界座標 → 大地圖上的位置（紐柏林是縮小的插圖，91-map.js 的 toMap）；回傳的 x, z 換回世界座標比對
  const m = await ev(([x, z, zoom]) => { const M = window.__nc.map.MV, [mx, mz] = window.__nc.map.toMap(x, z); M.tx = M.cx = mx; M.tz = M.cz = mz; M.tzoom = M.zoom = zoom; M.mx = -1; M.dirty = true; return [mx, mz]; }, [x, z, zoom]);
  await raf(page); await raf(page);
  const v = await ev(() => { const M = window.__nc.map.MV; return { x: M.cx, z: M.cz, loc: document.getElementById('mapLoc').textContent }; });
  if (Math.hypot(v.x - m[0], v.z - m[1]) < 1) { v.x = x; v.z = z; }
  if (name) await shot(name);
  return v;
};
// 整張圖（最小縮放）
await ev(() => window.__nc.map.zoom(1e-6)); await page.waitForTimeout(600); await shot('om-all');
{ const ins = await ev(() => { const nc = window.__nc, t = nc.nbr && nc.nbr.track('gp'); if (!t) return null; const [x, , z] = t.at(0), [mx, mz] = nc.map.toMap(x, z); return Math.hypot(mx - x, mz - z); }); if (ins !== null) check(ins > 500, `紐柏林在大地圖上是縮小的插圖（GP 起點移了 ${Math.round(ins)} m）`); }
const ak = T.find(t => t.k.startsWith('榛嶺'));
if (ak) {
  const v = await view(ak.x, ak.z, .6, 'om-akina');
  check(Math.hypot(v.x - ak.x, v.z - ak.z) < 5, `地圖拉得到榛嶺的盡頭（${v.loc}）`);
  check(/榛嶺/.test(v.loc), `游標地名是榛嶺：${v.loc}`);
}
const hill = T.filter(t => t.k.startsWith('山路'));
if (hill.length) { const h = hill[0]; const v = await view(h.x, h.z, 1.4, 'om-villa'); check(/別墅|山|榛嶺/.test(v.loc), `別墅區山路的地名：${v.loc}`); }
const gp = T.find(t => t.k.includes('gp'));
if (gp) { const v = await view(gp.x, gp.z, 1.4, 'om-nbr'); check(Math.hypot(v.x - gp.x, v.z - gp.z) < 5 && /紐柏林/.test(v.loc), `地圖拉得到紐柏林 GP（${v.loc}）`); await view(gp.x, gp.z, 6, 'om-nbr-near'); }
const ns = T.find(t => t.k.includes('ns#4200'));
if (ns) { const v = await view(ns.x, ns.z, .5); check(Math.hypot(v.x - ns.x, v.z - ns.z) < 5, `地圖拉得到北環最遠那段（${v.loc}）`); }
// 點路面設導航點：榛嶺、紐柏林北環（點畫面中心，就是那條路上的一點）
for (const t of [ak, ns, hill[0]].filter(Boolean)) {
  await view(t.x, t.z, t.k.startsWith('紐柏林') ? 3.4 : 1.2);
  const r = await ev(() => { const g = window.__nc.gta.gps; g.clear(); const r = document.getElementById('bigmap').getBoundingClientRect(); window.__nc.map.click(r.width / 2, r.height / 2); return g.gps.wp && { x: g.gps.wp.x, z: g.gps.wp.z }; });
  check(r && Math.hypot(r.x - t.x, r.z - t.z) < 3, `大地圖點 ${t.k} 的路面設得了導航點`);
}
if (ns) {   // 導航線畫在大地圖上
  await ev(() => { window.__nc.gta.gps.gps.t = 0; });
  await page.keyboard.press('Escape'); await page.waitForTimeout(700);
  const r = await ev(() => window.__nc.gta.gps.gps.route && window.__nc.gta.gps.gps.route.length);
  check(r > 100, `北環的導航路線 ${r} 點`);
  await page.keyboard.press('KeyM'); await page.waitForTimeout(200);
  await ev(() => window.__nc.map.zoom(1e-6)); await page.waitForTimeout(600); await shot('om-route');
}
// 圖例：維修區、展望台
const cats = await ev(() => [...new Set(window.__nc.map.blips().map(b => b.cat))]);
check(cats.includes('pit'), `圖例有賽道維修區（${cats.length} 類）`);
await page.keyboard.press('Escape');

console.log('小地圖');
for (const [k, i] of [['榛嶺', 0], ['紐柏林', 1]]) {
  const p = await ev(([i]) => { const nc = window.__nc; if (i === 0) { const P = nc.hillRoads().find(P => P.akina); if (!P) return null; const q = P[P.length >> 1]; return [q[0], q[1]]; } const t = nc.nbr && nc.nbr.track('gp'); if (!t) return null; const [x, , z] = t.at(600); return [x, z]; }, [i]);
  if (!p) continue;
  await ev(([x, z]) => window.__nc.tp(x, z), p); await page.waitForTimeout(800);
  await shot('om-mini-' + i);
  const lit = await ev(() => { const c = document.getElementById('mini'), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let j = 0; j < d.length; j += 4) if (d[j + 3] > 0 && d[j] > 60 && Math.abs(d[j] - d[j + 2]) < 30) n++; return n; });
  check(lit > 200, `小地圖在${k}畫得出路（亮的像素 ${lit}）`);
}
console.log('錯誤');
check(!log.pageerrors.length && !log.errors.length, `頁面錯誤 ${log.pageerrors.length}、console.error ${log.errors.length}${[...log.pageerrors, ...log.errors].slice(0, 3).map(s => '：' + s.slice(0, 160)).join('')}`);
await browser.close();
console.log(failed ? `✗ ${failed} 項失敗` : '✓ 全部通過');
process.exit(failed ? 1 : 0);
