
// ═══ 建築高度圖：白天的日光陰影（00-core.js 的 sunVis 從每個片段朝太陽方向在這張圖上步進） ═══
// 開場先用地塊、實體建築的外框與島上基地畫一張；實體建築模型下載好（27-props.js 的 bldLoad），
// 再用它的三角形重畫那一塊，拼成一群的高樓、中庭與退縮的樓頂才對。沒有東西的格子是 HM_NONE（地面不算遮擋物）。
await bootTick(13.5, "量建築與樹冠的高度…");
const HMS = LOW ? 2 : 1.25, HM_NONE = -50;
// 範圍是城市外緣（CITY_BB）往外 80 m，再包進灰鷗島
const HM = (() => {
  let x0 = CITY_BB.x0 - 80, x1 = CITY_BB.x1 + 80, z0 = CITY_BB.z0 - 80, z1 = CITY_BB.z1 + 80;
  for (const [x, z] of rectW(ISLE.x0 - 40, ISLE.x1 + 40, ISLE.z0 - 40, ISLE.z1 + 40)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const n = Math.ceil(Math.max(x1 - x0, z1 - z0) / HMS);
  return { x0, z0, n, h: new Float32Array(n * n).fill(HM_NONE), max: 0, d: null };
})();
const hmTex = new T.DataTexture(new Uint16Array(HM.n * HM.n).fill(T.DataUtils.toHalfFloat(HM_NONE)), HM.n, HM.n, T.RedFormat, T.HalfFloatType);
hmTex.minFilter = hmTex.magFilter = T.LinearFilter; hmTex.generateMipmaps = false;
U.uHMap.value = hmTex;
U.uHM.value.set(HM.x0, HM.z0, 1 / (HM.n * HMS), 0);
// 城市陸地的遮罩（05-zones.js 的 CITY_POLY，和高度圖同一個範圍）：00-core.js 的 applyFog 在鏡頭升高時只讓城裡的霧變淡
{
  const S = 512, k = S / (HM.n * HMS), cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d'); c.filter = 'blur(6px)'; c.fillStyle = '#fff'; c.beginPath();
  CITY_POLY.forEach(([x, z], i) => c[i ? 'lineTo' : 'moveTo']((x - HM.x0) * k, (z - HM.z0) * k)); c.closePath(); c.fill();
  c.strokeStyle = '#000'; c.lineWidth = 2 * 90 * k; c.stroke();   // 往裡縮 90 m：外緣的山坡（21-coast.js）從城市邊上就開始隆起，那一圈照舊在霧裡
  const tx = new T.CanvasTexture(cv); tx.flipY = false; tx.wrapS = tx.wrapT = T.ClampToEdgeWrapping; tx.generateMipmaps = false; tx.minFilter = T.LinearFilter;
  U.uCityM.value = tx;
}
const hmI = x => Math.floor((x - HM.x0) / HMS), hmJ = z => Math.floor((z - HM.z0) / HMS);
function hmDirty(i0, i1, j0, j1) {
  const d = HM.d ||= [1e9, -1e9, 1e9, -1e9];
  d[0] = Math.min(d[0], i0); d[1] = Math.max(d[1], i1); d[2] = Math.min(d[2], j0); d[3] = Math.max(d[3], j1);
}
// 矩形（世界座標）：set 為真時直接覆寫（清掉一塊），否則取較高的
function hmRect(x0, x1, z0, z1, h, set) {
  const i0 = Math.max(0, hmI(x0)), i1 = Math.min(HM.n - 1, hmI(x1)), j0 = Math.max(0, hmJ(z0)), j1 = Math.min(HM.n - 1, hmJ(z1));
  if (i0 > i1 || j0 > j1) return;
  for (let j = j0; j <= j1; j++) for (let i = i0, o = j * HM.n; i <= i1; i++) HM.h[o + i] = set ? h : Math.max(HM.h[o + i], h);
  if (!set) HM.max = Math.max(HM.max, h);
  hmDirty(i0, i1, j0, j1);
}
// 邏輯座標的矩形（地塊、實體建築與島上基地的外框）：換成世界座標的四邊形，蓋住格子中心的才畫
function hmRectL(x0, x1, z0, z1, h, set, zn = zoneAtL((x0 + x1) / 2, (z0 + z1) / 2)) {
  if (!zn || !zn.ry) { const [ax, az] = toW(x0, z0, zn); hmRect(ax, ax + x1 - x0, az, az + z1 - z0, h, set); return; }
  const cs = rectW(x0, x1, z0, z1, zn).map(([x, z]) => [(x - HM.x0) / HMS, (z - HM.z0) / HMS]);
  const i0 = Math.max(0, Math.floor(Math.min(...cs.map(c => c[0])))), i1 = Math.min(HM.n - 1, Math.floor(Math.max(...cs.map(c => c[0]))));
  const j0 = Math.max(0, Math.floor(Math.min(...cs.map(c => c[1])))), j1 = Math.min(HM.n - 1, Math.floor(Math.max(...cs.map(c => c[1]))));
  if (i0 > i1 || j0 > j1) return;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const px = i + .5, pz = j + .5;
    let pos = 0, neg = 0;
    for (let k = 0; k < 4; k++) { const [ax, az] = cs[k], [bx, bz] = cs[(k + 1) % 4], c = (bx - ax) * (pz - az) - (bz - az) * (px - ax); if (c > 0) pos++; else if (c < 0) neg++; }
    if (pos && neg) continue;
    const o = j * HM.n + i; HM.h[o] = set ? h : Math.max(HM.h[o], h);
  }
  if (!set) HM.max = Math.max(HM.max, h);
  hmDirty(i0, i1, j0, j1);
}
const hmPut = (i, j, h) => { if (i >= 0 && j >= 0 && i < HM.n && j < HM.n) { const o = j * HM.n + i; if (h > HM.h[o]) HM.h[o] = h; } };
// 三角形：投影到 xz 蓋住的格子取三個頂點裡最高的；牆面投影只剩一條線，所以三條邊也各自畫一遍
function hmTri(ax, ay, az, bx, by, bz, cx, cy, cz) {
  const h = Math.max(ay, by, cy);
  if (h < .5) return;
  const fi = x => (x - HM.x0) / HMS, fj = z => (z - HM.z0) / HMS;
  const x0 = fi(ax), z0 = fj(az), x1 = fi(bx), z1 = fj(bz), x2 = fi(cx), z2 = fj(cz);
  const i0 = Math.floor(Math.min(x0, x1, x2)), i1 = Math.floor(Math.max(x0, x1, x2)), j0 = Math.floor(Math.min(z0, z1, z2)), j1 = Math.floor(Math.max(z0, z1, z2));
  if (i0 === i1 && j0 === j1) { hmPut(i0, j0, h); return; }
  const den = (z1 - z2) * (x0 - x2) + (x2 - x1) * (z0 - z2);
  if (Math.abs(den) > 1e-6) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const px = i + .5, pz = j + .5;
    const a = ((z1 - z2) * (px - x2) + (x2 - x1) * (pz - z2)) / den, b = ((z2 - z0) * (px - x2) + (x0 - x2) * (pz - z2)) / den;
    if (a >= 0 && b >= 0 && a + b <= 1) hmPut(i, j, h);
  }
  for (const [sx, sz, ex, ez] of [[x0, z0, x1, z1], [x1, z1, x2, z2], [x2, z2, x0, z0]]) {
    const n = Math.ceil(Math.max(Math.abs(ex - sx), Math.abs(ez - sz)) * 2);
    for (let k = 0; k <= n; k++) { const t = n ? k / n : 0; hmPut(Math.floor(sx + (ex - sx) * t), Math.floor(sz + (ez - sz) * t), h); }
  }
}
// 一棟（或一群）實體建築：b 是 bldPlace 的邏輯座標，geos 是世界座標的幾何；先清掉它的外框，再畫三角形
function hmModel(b, geos, mtx) {
  const e = mtx && mtx.elements;   // 幾何是邏輯座標時，mtx 是區的變換（只繞 y 轉，y 不變）
  const it = PROPS_SPEC[b.set]?.items[b.id];
  if (it) { const [w, d] = hmFoot(b, it); hmRectL(b.x - w / 2 - 1, b.x + w / 2 + 1, b.z - d / 2 - 1, b.z + d / 2 + 1, HM_NONE, true); }
  for (const g of geos) {
    const p = g.attributes.position.array, ix = g.index ? g.index.array : null, n = ix ? ix.length : p.length / 3;
    for (let k = 0; k < n; k += 3) {
      const a = (ix ? ix[k] : k) * 3, c = (ix ? ix[k + 1] : k + 1) * 3, f = (ix ? ix[k + 2] : k + 2) * 3;
      if (e) {
        const X = o => e[0] * p[o] + e[8] * p[o + 2] + e[12], Z = o => e[2] * p[o] + e[10] * p[o + 2] + e[14];
        hmTri(X(a), p[a + 1], Z(a), X(c), p[c + 1], Z(c), X(f), p[f + 1], Z(f));
      }
      else hmTri(p[a], p[a + 1], p[a + 2], p[c], p[c + 1], p[c + 2], p[f], p[f + 1], p[f + 2]);
      HM.max = Math.max(HM.max, p[a + 1], p[c + 1], p[f + 1]);
    }
  }
  if (it) { const [w, d] = hmFoot(b, it); hmRectL(b.x - w / 2 - 1, b.x + w / 2 + 1, b.z - d / 2 - 1, b.z + d / 2 + 1, HM_NONE - 1); }   // 只標記要重新上傳的範圍
}
const hmFoot = (b, it) => Math.abs(Math.sin(b.ry || 0)) > .5 ? [it.d * b.s, it.w * b.s] : [it.w * b.s, it.d * b.s];
// 改過的範圍轉成半浮點再整張上傳
function hmFlush() {
  const d = HM.d; if (!d) return;
  HM.d = null;
  const arr = hmTex.image.data, i0 = Math.max(0, d[0]), i1 = Math.min(HM.n - 1, d[1]), j0 = Math.max(0, d[2]), j1 = Math.min(HM.n - 1, d[3]);
  for (let j = j0; j <= j1; j++) for (let i = i0, o = j * HM.n; i <= i1; i++) arr[o + i] = T.DataUtils.toHalfFloat(HM.h[o + i]);
  hmTex.needsUpdate = true;
  U.uHM.value.w = HM.max + 1;
}
{
  for (const L of lots) if (!L.glb && !L.ghost) hmRectL(L.x0, L.x1, L.z0, L.z1, L.h, false, L.zn);   // ghost：廣場與設施街區原本的地塊，沒蓋樓
  for (const b of bldPlace) { const it = PROPS_SPEC[b.set]?.items[b.id]; if (!it) continue; const [w, d] = hmFoot(b, it); hmRectL(b.x - w / 2, b.x + w / 2, b.z - d / 2, b.z + d / 2, b.h); }
  for (const id in ISLE_SITES) for (const [x0, x1, z0, z1, h] of isleFoot(id)) hmRectL(x0, x1, z0, z1, h);
  // 天樞島：片裡的退台（L.tiers 是邏輯座標，每層往裡退 t.i）與填空樓（11-isle.js，世界座標的四邊形）
  for (const L of lots) if (L.tiers && !L.glb) for (const t of L.tiers) hmRectL(L.x0 + t.i, L.x1 - t.i, L.z0 + t.i, L.z1 - t.i, t.y, false, L.zn);
  for (const f of ISLE_FILL) for (const [P, h] of [[f.P, f.h], ...f.tiers.map(t => [t.P, t.y])]) { hmTri(P[0][0], h, P[0][1], P[1][0], h, P[1][1], P[2][0], h, P[2][1]); hmTri(P[0][0], h, P[0][1], P[2][0], h, P[2][1], P[3][0], h, P[3][1]); HM.max = Math.max(HM.max, h); }
  hmRectL(LIGHTHOUSE.x - 4, LIGHTHOUSE.x + 4, LIGHTHOUSE.z - 4, LIGHTHOUSE.z + 4, 36);
  hmFlush();
}
// ─── 樹冠圖：日光穿過樹冠的碎光（00-core.js 的 leafVis）與體積光（70-render.js）。每棵樹是一顆橢球：行道樹照 nat_trees 的楓樹
// （寬 5.9 m、高 8 m），公園、縫與島上的樹混著七種，取平均的大小；r 是樹冠的頂、g 是底（0 是沒有樹）。2.5 m 一格，雙線性內插 ───
const TMS = 2.5;
{
  const n = Math.ceil(HM.n * HMS / TMS), top = new Float32Array(n * n), bot = new Float32Array(n * n).fill(1e4);
  let max = 0;
  const put = (X, Z, base, r, h1, h0) => {
    const cy = base + (h1 + h0) / 2, hh = (h1 - h0) / 2, i0 = Math.max(0, Math.floor((X - r - HM.x0) / TMS)), i1 = Math.min(n - 1, Math.floor((X + r - HM.x0) / TMS));
    const j0 = Math.max(0, Math.floor((Z - r - HM.z0) / TMS)), j1 = Math.min(n - 1, Math.floor((Z + r - HM.z0) / TMS));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = HM.x0 + (i + .5) * TMS - X, dz = HM.z0 + (j + .5) * TMS - Z, k = 1 - (dx * dx + dz * dz) / (r * r);
      if (k <= 0) continue;
      const e = Math.sqrt(k) * hh, o = j * n + i;
      top[o] = Math.max(top[o], cy + e); bot[o] = Math.min(bot[o], cy - e * .8);
    }
    max = Math.max(max, base + h1);
  };
  for (const t of [...trees, ...ISLE_TREES.map(t => ({ ...t, park: 1 }))]) {
    const [X, Z] = t.zn === null ? [t.x, t.z] : toW(t.x, t.z), s = t.s || 1;
    let base = 0; try { base = groundH(X, Z); } catch (e) { /* 外面的島 */ }
    if (t.park) put(X, Z, t.y + base, 3.8 * s, 8.6 * s, 2.2 * s); else put(X, Z, t.y + base, 2.95 * s, 8 * s, 2.6 * s);
  }
  const arr = new Uint16Array(n * n * 2);
  for (let o = 0; o < n * n; o++) if (top[o] > 0) { arr[o * 2] = T.DataUtils.toHalfFloat(top[o]); arr[o * 2 + 1] = T.DataUtils.toHalfFloat(bot[o]); }
  const tx = new T.DataTexture(arr, n, n, T.RGFormat, T.HalfFloatType);
  tx.minFilter = tx.magFilter = T.LinearFilter; tx.generateMipmaps = false; tx.needsUpdate = true;
  U.uTMap.value = tx; U.uTM.value.set(HM.x0, HM.z0, 1 / (n * TMS), max + .5);
}
// ─── 外緣山林的樹冠圖（00-core.js 的 forestVis）：10-city.js 的 HILL_FOREST 照鏡頭畫 1 km 見方（2 m 一格），鏡頭離圖中心 160 m 以上才重畫（99-main.js 每幀問）。
// 冷杉是圓錐（頂 18.7·s、底 1.8·s、底半徑 4·s，同 blender/forest.py），楓樹是橢球（中心 7.4·s、橫半徑 4.8·s、縱半徑 4.6·s）；r 是頂、g 是底（世界高度）───
const FM = { S: 2, n: 512, cx: 1e9, cz: 1e9, tex: null, top: null, bot: null, builds: 0 };
{
  const n = FM.n; FM.top = new Float32Array(n * n); FM.bot = new Float32Array(n * n);
  FM.tex = new T.DataTexture(new Uint16Array(n * n * 2), n, n, T.RGFormat, T.HalfFloatType);
  FM.tex.minFilter = FM.tex.magFilter = T.LinearFilter; FM.tex.generateMipmaps = false;
  U.uFMap.value = FM.tex;
}
function forestMap(cx, cz) {
  if (Math.abs(cx - FM.cx) < 160 && Math.abs(cz - FM.cz) < 160 || !HILL_FOREST.fir.length && !HILL_FOREST.maple.length && !HILL_FOREST.broad.length && !HILL_FOREST.pine.length) return;
  const n = FM.n, S = FM.S, half = n * S / 2, top = FM.top, bot = FM.bot;
  FM.cx = Math.round(cx / 40) * 40; FM.cz = Math.round(cz / 40) * 40;
  const x0 = FM.cx - half, z0 = FM.cz - half;
  top.fill(-1e4); bot.fill(1e4);
  let any = 0;
  const put = (t, cone) => {   // cone：冷杉（true）、闊葉（false）、松（'pine'：樹冠在 9.5–16 m 的扁團）
    const s = t.sx || t.s || 1, sy = t.sy || t.s || 1, r = (cone === 'pine' ? 4.6 : cone ? 4 : 4.8) * s;
    if (t.x < x0 - r || t.x > x0 + 2 * half + r || t.z < z0 - r || t.z > z0 + 2 * half + r) return;
    any++;
    const i0 = Math.max(0, Math.floor((t.x - r - x0) / S)), i1 = Math.min(n - 1, Math.floor((t.x + r - x0) / S));
    const j0 = Math.max(0, Math.floor((t.z - r - z0) / S)), j1 = Math.min(n - 1, Math.floor((t.z + r - z0) / S));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = x0 + (i + .5) * S - t.x, dz = z0 + (j + .5) * S - t.z, dd = Math.sqrt(dx * dx + dz * dz);
      if (dd >= r) continue;
      const o = j * n + i;
      if (cone === 'pine') { const e = Math.sqrt(1 - dd * dd / (r * r)) * 3.2 * sy, cy = t.y + 12.6 * sy; top[o] = Math.max(top[o], cy + e); bot[o] = Math.min(bot[o], cy - e); }
      else if (cone) { top[o] = Math.max(top[o], t.y + sy * 18.7 - dd * 16.9 / 4); bot[o] = Math.min(bot[o], t.y + 1.8 * sy); }
      else { const e = Math.sqrt(1 - dd * dd / (r * r)) * 4.6 * sy, cy = t.y + 7.4 * sy; top[o] = Math.max(top[o], cy + e); bot[o] = Math.min(bot[o], cy - e * .8); }
    }
  };
  for (const t of HILL_FOREST.fir) put(t, true);
  for (const t of HILL_FOREST.maple) put(t, false);
  for (const t of HILL_FOREST.broad) put(t, false);
  for (const t of HILL_FOREST.pine) put(t, 'pine');
  const arr = FM.tex.image.data, h = T.DataUtils.toHalfFloat;
  for (let o = 0; o < n * n; o++) { const e = top[o] < -1e3; arr[o * 2] = h(e ? 0 : top[o]); arr[o * 2 + 1] = h(e ? 0 : bot[o]); }
  FM.tex.needsUpdate = true; FM.builds++;
  U.uFM.value.set(x0, z0, 1 / (n * S), any ? 1 : 0);
}
// 斜屋頂（19-roofs.js）：屋頂面的高度寫進高度圖（日光陰影的屋脊、直升機與跳傘落在屋頂上不會陷進去）；邏輯座標每 0.6 m 取一點換到世界
{
  for (const L of lots) {
    if (!L.rk) continue;
    const oh = L.rk.oh, x0 = L.x0 - (L.axis === 'x' ? oh : 0), x1 = L.x1 + (L.axis === 'x' ? oh : 0), z0 = L.z0 - (L.axis === 'z' ? oh : 0), z1 = L.z1 + (L.axis === 'z' ? oh : 0);
    for (let x = x0; x <= x1; x += .6) for (let z = z0; z <= z1; z += .6) {
      const h = roofTop(L, x, z); if (!(h > L.h)) continue;
      const [X, Z] = toW(x, z, L.zn); hmPut(hmI(X), hmJ(Z), h);
    }
    const cs = rectW(x0, x1, z0, z1, L.zn), xs = cs.map(c => c[0]), zs = cs.map(c => c[1]);
    hmDirty(hmI(Math.min(...xs)) - 1, hmI(Math.max(...xs)) + 1, hmJ(Math.min(...zs)) - 1, hmJ(Math.max(...zs)) + 1);
    HM.max = Math.max(HM.max, L.rk.y0 + L.rk.H);
  }
  hmFlush();
}
