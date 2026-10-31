
// ═══ Blender 室內道具：解壓內嵌的 GLB，轉成通用材質的頂點色幾何 ═══
// blender/out/interior_props.glb、street_props.glb 以 gzip＋base64 內嵌在 <script id="glb-名稱">。
await bootStep(BOOT.assets, '搬進道具…');
const assetReport = { loaded: [], missing: [], props: [] };
async function decodeGLB(name) {
  const el = document.getElementById('glb-' + name);
  const txt = el && el.textContent.trim();
  if (!txt) return null;
  const bin = Uint8Array.from(atob(txt), c => c.charCodeAt(0));
  el.textContent = '';   // 只解一次，base64 文字不再留在 DOM 裡
  const ab = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return new GLTFLoader().parseAsync(ab, '');
}
// 依材質決定 aMat：有自發光的當霓虹、金屬當鍍鉻、其餘依粗糙度
// 材質名稱以 tNN_／mNN_ 開頭的直接用那個代號（tNN 是 07-kitx.js 的程式材質，如山坡住宅 hill_homes）
function matId(m) {
  const mn = /^[tm](\d+)_/.exec(m.name || '');
  if (mn) return +mn[1];
  const e = m.emissive ? m.emissive.r + m.emissive.g + m.emissive.b : 0;
  if (e > .05) return 8;
  if (m.metalness > .5) return m.roughness < .35 ? 3 : 15;
  return m.roughness < .4 ? 10 : 2;
}
const PROPS = {};
function bakeProp(root) {
  const k = new Kit();
  root.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(root.matrixWorld).invert();
  root.traverse(o => {
    if (!o.isMesh) return;
    const m = new T.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const g = o.geometry;
    const groups = g.groups.length ? g.groups : [{ start: 0, count: g.index ? g.index.count : g.attributes.position.count, materialIndex: 0 }];
    for (const gr of groups) {
      const mm = mats[gr.materialIndex] || mats[0];
      const sub = new T.BufferGeometry();
      sub.setAttribute('position', g.attributes.position); sub.setAttribute('normal', g.attributes.normal);
      if (g.attributes.color) { sub.setAttribute('color', g.attributes.color); sub.userData.ao = 1; }   // 烘好的 AO（hill_homes.py 的 bake_ao），Kit.add 乘在材質色上
      if (g.index) sub.setIndex(Array.from(g.index.array.slice(gr.start, gr.start + gr.count)));
      const id = matId(mm);
      const col = id === 8 ? mm.emissive.clone().multiplyScalar(.9) : mm.color.clone();
      k.add(sub, col, id, m);
    }
  });
  const geo = k.build();
  geo.computeBoundingBox();
  return geo;
}
for (const name of ['interior_props', 'street_props', 'hill_homes']) {
  try {
    const g = await decodeGLB(name);
    if (!g) { assetReport.missing.push(name); continue; }
    assetReport.loaded.push(name);
    for (const o of g.scene.children) { PROPS[o.name] = bakeProp(o); assetReport.props.push(o.name); }
  } catch (e) { assetReport.missing.push(name); }
}
// 山坡別墅區（10-city.js 開路、挖平台、擺好位置）：每型的低模 _lo 全部畫，細模只畫相機 420 m 內的（低模縮 1% 藏在細模裡面）；
// aIns.z 是每棟的種子（07-kitx.js 的 48 號落地玻璃照它決定哪幾間開燈）。植栽與岩石：棕櫚近的細模、遠的低模，其餘只畫附近的
const HILL_SEED = (t, c) => c === 2 ? t.seed : c === 3 ? t.ry : 0;   // aIns：z 種子（玻璃後的房間、照片錯開）、w 繞 y 的轉角（07-kitx.js 的照片法線轉到世界）
// 細模有照平面圖蓋的室內（blender/villa_plans.json），玻璃是另一個物件 NAME_gl、用透明的 villaGlass 畫：正看幾乎透明、斜看反射天空與城市燈（菲涅耳），
// 霧玻璃（底色偏白，浴室）不透明、散射室內外的光。低模只畫細模半徑外的（R0），不然透過玻璃會看到藏在裡面的低模
const VGLASS = new T.ShaderMaterial({ name: 'villaGlass', uniforms: shared(ALLU), transparent: true, depthWrite: false });
const HOME_R = 420;
HOME_V.forEach(([nm], v) => {
  const L = HILL_HOMES.filter(h => h.v === v);
  if (!L.length || !PROPS[nm]) return;
  const lo = instanced(PROPS[nm + '_lo'], MAT.uxI, L, 0, HILL_SEED, 1e5), S = lo.userData.stream;
  if (PROPS[nm + '_gl']) Object.defineProperty(S, 'R0', { get: () => (HOME_R - 6) * detailK() });
  instanced(PROPS[nm], MAT.uxI, L, 0, HILL_SEED, HOME_R);
  if (PROPS[nm + '_gl']) instanced(PROPS[nm + '_gl'], VGLASS, L, 0, null, HOME_R);
});
for (const [k, R] of [['palm', 380], ['agave', 160], ['shrub', 260], ['shrub_bloom', 260], ['rock', 320]]) {
  const L = HILL_PLANTS[k];
  if (!L.length || !PROPS[k]) continue;
  instanced(PROPS[k], MAT.uxI, L, 0, null, R);
  if (k === 'palm' && PROPS.palm_lo) {
    const S = instanced(PROPS.palm_lo, MAT.uxI, L, 0, null, L.length > 160 ? 1e5 : undefined).userData.stream;
    if (S) Object.defineProperty(S, 'R0', { get: () => (R - 6) * detailK() });   // 細模畫到的範圍裡不再畫低模（原本 380 m 內兩級疊著畫）
  }
}
// 外緣山林的遠景樹（10-city.js 的 HILL_FOREST）：全部畫（整顆進霧的不畫，見 20-props.js 的 instUpdate）；27-props.js 下載 nat_forest 的近景樹之後改成只畫在近景半徑外。以檔案開啟時只有這一層
const forestLo = {};
if (HILL_FOREST.broad.length && PROPS.maple_lo && !PROPS.broad_lo) PROPS.broad_lo = akinaBroadLo(PROPS.maple_lo);   // 榛嶺的闊葉樹（09-akina.js）
// 松的遠景（forest.py 的 pine 沒有低模）：借 maple_lo 的樹幹與三團樹冠，樹幹拉到 10 m、樹冠壓扁放到 9.5–15.5 m（赤松：下半截沒有枝、樹冠集中在上面），換成暗的針葉綠
if (HILL_FOREST.pine.length && PROPS.maple_lo && !PROPS.pine_lo) {
  const g = PROPS.maple_lo.clone(), p = g.attributes.position, c = g.attributes.color, G = [[.06, .085, .04], [.05, .07, .033], [.075, .1, .05]];
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), leaf = c && c.getX(i) >= c.getY(i) * 1.3 + .02;   // 樹冠（橘紅）；樹幹是褐灰
    if (leaf) { p.setXYZ(i, p.getX(i) * .95, 9.5 + Math.max(0, y - 2.5) * .66, p.getZ(i) * .95); const l = Math.min(1.6, (c.getX(i) + c.getY(i) + c.getZ(i)) / .9), k = G[i % 3]; c.setXYZ(i, k[0] * l, k[1] * l, k[2] * l); }
    else p.setXYZ(i, p.getX(i) * .9, y * 2.05, p.getZ(i) * .9);
  }
  if (c) c.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere(); g.name = 'pine_lo'; PROPS.pine_lo = g;
}
for (const k of ['fir', 'maple', 'broad', 'pine']) if (HILL_FOREST[k].length && PROPS[k + '_lo']) {
  forestLo[k] = instanced(PROPS[k + '_lo'], MAT.uxI, HILL_FOREST[k], 0, null, 1e5);
  const S = forestLo[k].userData.stream; if (S) Object.defineProperty(S, 'R0', { get: () => (HILL_FOREST.loR0 || 0) * detailK() });   // 27-props.js 換上近景模型後才設 loR0
  if (S) S.fogCut = 1;   // 20-props.js 的 instUpdate：整顆進霧的不送（日出日落時照舊全送）
}
// 相機 800 m 外的遠景樹換成合併頂點的版本：位置與顏色相同的頂點併成一個（留第一個的法線與其他屬性），面數不變、頂點 132 → 39、216 → 48／108。
// 雨夜光環廣場朝山 28.7 → 24.0 ms；凍結畫面市區 0 像素、城外空地朝山最多 48 像素（最大色差 7）。再用 meshopt 減面會改掉稜線剪影（使用者選了不減面）。
// 20-props.js 的 instUpdate 照 S.far 分兩組送，70-render.js 的 reflOcc 兩組一起換圖層
const FOREST_FAR = 800;
function forestMerge(g) {
  const P = g.attributes.position.array, C = g.attributes.color ? g.attributes.color : null, n = g.attributes.position.count, seen = new Map(), rem = new Uint32Array(n), keep = [];
  for (let i = 0; i < n; i++) {
    let k = Math.round(P[i * 3] * 1e4) + ',' + Math.round(P[i * 3 + 1] * 1e4) + ',' + Math.round(P[i * 3 + 2] * 1e4);
    if (C) k += '|' + Math.round(C.array[i * C.itemSize] * 1e3) + ',' + Math.round(C.array[i * C.itemSize + 1] * 1e3) + ',' + Math.round(C.array[i * C.itemSize + 2] * 1e3);
    let j = seen.get(k); if (j === undefined) { j = keep.length; seen.set(k, j); keep.push(i); }
    rem[i] = j;
  }
  const o = new T.BufferGeometry();
  for (const [k, a] of Object.entries(g.attributes)) { if (a.isInstancedBufferAttribute) continue; const s = a.itemSize, d = new a.array.constructor(keep.length * s); keep.forEach((i, j) => { for (let e = 0; e < s; e++) d[j * s + e] = a.array[i * s + e]; }); o.setAttribute(k, new T.BufferAttribute(d, s, a.normalized)); }
  const src = g.index ? g.index.array : Uint32Array.from({ length: n }, (_, i) => i);
  o.setIndex(new T.BufferAttribute(Uint16Array.from(src, i => rem[i]), 1));
  o.boundingBox = g.boundingBox && g.boundingBox.clone(); o.boundingSphere = g.boundingSphere && g.boundingSphere.clone(); o.name = (g.name || '') + '_far';
  return o;
}
for (const m of Object.values(forestLo)) {
  const S = m.userData.stream;
  if (!S || S.attrs.length || m.geometry.attributes.position.count > 65535) continue;
  const f = new T.InstancedMesh(forestMerge(m.geometry), m.material, S.n);
  f.count = 0; f.layers.mask = m.layers.mask; f.name = 'forestFar'; f.boundingSphere = new T.Sphere();
  scene.add(f); S.far = f; S.farD = FOREST_FAR; m.userData.far = f;
}
// 石柱峰（21-coast.js 的 KARST，四型）：遠景材質，全部畫
for (let v = 0; v < 4; v++) { const L = KARST.filter(t => t.v === v); if (L.length && PROPS['karst' + (v + 1)]) instanced(PROPS['karst' + (v + 1)], MAT.uxFI, L, 0, null); }
// 缺檔時用方塊頂替，頁面照樣能跑
function prop(name, w = 1, h = 1, d = 1) {
  if (PROPS[name]) return PROPS[name];
  return new Kit().box(0, h / 2, 0, w, h, d, 0x222428, 2).build();
}
// 把道具縮放成指定高度（Blender 檔的單位以公尺為準，但保險起見依包圍盒校正）
function propFit(name, targetH) {
  const g = prop(name); g.computeBoundingBox();
  const bb = g.boundingBox, h = bb.max.y - bb.min.y || 1;
  return { geo: g, s: targetH ? targetH / h : 1, y0: -bb.min.y, size: bb.getSize(V3()) };
}
