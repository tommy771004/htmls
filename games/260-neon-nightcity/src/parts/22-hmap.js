
// ═══ 建築高度圖：白天的日光陰影（00-core.js 的 sunVis 從每個片段朝太陽方向在這張圖上步進） ═══
// 開場先用地塊、實體建築的外框與島上基地畫一張；實體建築模型下載好（27-props.js 的 bldLoad），
// 再用它的三角形重畫那一塊，拼成一群的高樓、中庭與退縮的樓頂才對。沒有東西的格子是 HM_NONE（地面不算遮擋物）。
const HMS = LOW ? 2 : 1.25, HM_NONE = -50;
// 範圍是各區把城市外框（含島）換到世界座標後的外接框
const HM = (() => {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const zn of ZONES) for (const [x, z] of rectW(Math.max(zn.x0, CITY_X0 - OUT_D - 60), Math.min(zn.x1, CITY_X1 + OUT_D + 60), Math.max(zn.z0, CITY_Z0 - 60), Math.min(zn.z1, ISLE.z1 + 40), zn)) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  const n = Math.ceil(Math.max(x1 - x0, z1 - z0) / HMS);
  return { x0, z0, n, h: new Float32Array(n * n).fill(HM_NONE), max: 0, d: null };
})();
const hmTex = new T.DataTexture(new Uint16Array(HM.n * HM.n).fill(T.DataUtils.toHalfFloat(HM_NONE)), HM.n, HM.n, T.RedFormat, T.HalfFloatType);
hmTex.minFilter = hmTex.magFilter = T.LinearFilter; hmTex.generateMipmaps = false;
U.uHMap.value = hmTex;
U.uHM.value.set(HM.x0, HM.z0, 1 / (HM.n * HMS), 0);
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
  for (const L of lots) if (!L.glb) hmRectL(L.x0, L.x1, L.z0, L.z1, L.h);
  for (const b of bldPlace) { const it = PROPS_SPEC[b.set]?.items[b.id]; if (!it) continue; const [w, d] = hmFoot(b, it); hmRectL(b.x - w / 2, b.x + w / 2, b.z - d / 2, b.z + d / 2, b.h); }
  for (const [id, s] of Object.entries(ISLE_SITES)) { const it = PROPS_SPEC['isle_' + id]?.items[id]; hmRectL(s.x - s.w * .42, s.x + s.w * .42, s.z - s.d * .42, s.z + s.d * .42, it ? it.h : 12); }
  hmRectL(LIGHTHOUSE.x - 4, LIGHTHOUSE.x + 4, LIGHTHOUSE.z - 4, LIGHTHOUSE.z + 4, 36);
  hmFlush();
}
