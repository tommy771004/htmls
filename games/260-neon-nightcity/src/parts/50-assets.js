
// ═══ Blender 室內道具：解壓內嵌的 GLB，轉成通用材質的頂點色幾何 ═══
// blender/out/interior_props.glb、street_props.glb 以 gzip＋base64 內嵌在 <script id="glb-名稱">。
const assetReport = { loaded: [], missing: [], props: [] };
async function decodeGLB(name) {
  const el = document.getElementById('glb-' + name);
  const txt = el && el.textContent.trim();
  if (!txt) return null;
  const bin = Uint8Array.from(atob(txt), c => c.charCodeAt(0));
  const ab = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return new GLTFLoader().parseAsync(ab, '');
}
// 依材質決定 aMat：有自發光的當霓虹、金屬當鍍鉻、其餘依粗糙度
function matId(m) {
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
for (const name of ['interior_props', 'street_props']) {
  try {
    const g = await decodeGLB(name);
    if (!g) { assetReport.missing.push(name); continue; }
    assetReport.loaded.push(name);
    for (const o of g.scene.children) { PROPS[o.name] = bakeProp(o); assetReport.props.push(o.name); }
  } catch (e) { assetReport.missing.push(name); }
}
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
