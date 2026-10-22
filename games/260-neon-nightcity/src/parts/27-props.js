
// ═══ 實體道具與建築：tools/props.mjs 處理過的 assets/260/props/*.glb（以 http(s) 開啟才下載），材質沿用實車的 glbMaterial ═══
// 建築（10-city 的 bldPlace）與路邊拉麵攤開場就下載，開始畫面等它們下載完；室內道具走進酒吧或車庫才下載。
// 以檔案開啟或下載失敗：建築那幾塊地補回程式立面，室內沿用 Blender 道具，拉麵攤不擺。
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const PROP_BASE = new URL('../assets/260/props/', location.href).href;
const PROP_INST = { uM: { value: new T.Vector4(0, 0, 1, 0) }, uPaint: { value: new T.Vector4(0, 0, 0, 0) } };
const propCache = {}, propMats = new Map(), FAR_FOG = .2;   // FAR_FOG：props.json 標 far 的遠景組，霧和 MAT.far 一樣只算兩成距離
const propMat = (src, far) => { let m = propMats.get(src); if (!m) { m = glbMaterial(src, PROP_INST, far); propMats.set(src, m); } return m; };
// 量化的整數屬性轉成浮點，再套上節點矩陣（量化的位移與縮放在節點上）
function floatGeo(geo, mtx) {
  const g = new T.BufferGeometry();
  for (const [k, at] of Object.entries(geo.attributes)) {
    const f = new Float32Array(at.count * at.itemSize);
    for (let i = 0; i < at.count; i++) for (let c = 0; c < at.itemSize; c++) f[i * at.itemSize + c] = at.getComponent(i, c);
    g.setAttribute(k, new T.BufferAttribute(f, at.itemSize));
  }
  g.setIndex(geo.index ? Array.from(geo.index.array) : null);
  g.applyMatrix4(mtx);
  return g;
}
// 一個輸出檔 → { 物件 id: { parts: [{ geo, mat }], w, d, h } }
function loadProps(set) {
  if (!GLB_ON || !PROPS_SPEC[set]) return Promise.resolve(null);
  const key = 'p:' + set;
  return propCache[set] ??= glbLoader.loadAsync(PROP_BASE + set + '.glb', e => { glbBytes[key] = [e.loaded, e.lengthComputable ? e.total : 0]; }).then(g => {
    g.scene.updateMatrixWorld(true);
    const items = {};
    for (const n of g.scene.children) {
      const parts = [];
      n.traverse(m => { if (m.isMesh) parts.push({ geo: floatGeo(m.geometry, m.matrixWorld), mat: propMat(m.material, PROPS_SPEC[set].far && FAR_FOG) }); });
      items[n.name] = { parts, ...PROPS_SPEC[set].items[n.name] };
    }
    glbDone.add(key);
    return items;
  }, e => { console.warn('道具模型下載失敗：' + set, e); glbDone.add(key); return null; });
}
// 一個物件擺一份（Group，網格共用幾何與材質）
function propObject(it, x, y, z, ry = 0, s = 1) {
  const g = new T.Group();
  for (const p of it.parts) { const m = new T.Mesh(p.geo, p.mat); g.add(m); }
  g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s);
  return g;
}

// ─── 建築：同一組、同一材質、同一個 4×4 街區分塊的棟合併成一個網格，遠處的分塊由 distCull 隱藏 ───
// 開場只等出生點 BLD_NEAR 內用到的組；其他組在玩家走近 BLD_NEAR 時才下載（在霧裡，下載完才出現也看不到）。
const BLD_TILE = 4, BLD_NEAR = 520;
const bldTile = b => Math.floor((b.x - X0) / (P * BLD_TILE)) + ',' + Math.floor((b.z - Z0) / (Q * BLD_TILE));
const bldSets = [...new Set(bldPlace.map(b => b.set))];
const bldReq = new Map();   // set → Promise
function bldLoad(set) {
  if (bldReq.has(set)) return bldReq.get(set);
  const pr = loadProps(set).then(items => {
    const mine = bldPlace.filter(b => b.set === set);
    if (!items) { lotFallback(mine.flatMap(b => b.lots)); return; }
    const byKey = new Map(), M = new T.Matrix4(), Q = new T.Quaternion(), Y = V3(0, 1, 0);
    for (const b of mine) {
      M.compose(V3(b.x, 0, b.z), Q.setFromAxisAngle(Y, b.ry), V3(b.s, b.s, b.s));
      const tk = bldTile(b), wg = [];
      for (const p of items[b.id].parts) {
        let e = byKey.get(tk + '|' + p.mat.uuid);
        if (!e) byKey.set(tk + '|' + p.mat.uuid, e = { mat: p.mat, list: [] });
        const g = p.geo.clone().applyMatrix4(M);
        e.list.push(g); wg.push(g);
      }
      hmModel(b, wg);   // 22-hmap.js：用模型的三角形重畫日光陰影的高度圖
    }
    hmFlush();
    for (const { mat, list } of byKey.values()) {
      const g = mergeGeometries(list);
      for (const x of list) x.dispose();
      if (!g) continue;
      const m = new T.Mesh(g, mat); m.matrixAutoUpdate = false; m.userData.bld = set;
      scene.add(m); cullAdd(m);
    }
  });
  bldReq.set(set, pr);
  return pr;
}
const bldNear = (set, x, z, R) => bldPlace.some(b => b.set === set && (b.x - x) ** 2 + (b.z - z) ** 2 < R * R);
const bldReady = Promise.all(bldSets.filter(set => bldNear(set, avX(1), stZ(2), BLD_NEAR)).map(bldLoad));   // 出生點在 Atlas Av · 8 St 附近（40-people.js 的 player）
let bldTick = 0;
function bldUpdate() {   // 每半秒看一次：走近還沒下載的組就開始下載
  if (!GLB_ON || (bldTick = (bldTick + 1) % 30)) return;
  const x = pX(), z = pZ();
  for (const set of bldSets) if (!bldReq.has(set) && bldNear(set, x, z, BLD_NEAR + 150)) bldLoad(set);
}

// ─── 海岸的模型（21-coast.js）：灰鷗島的兩個基地、灰鷺河對岸的 London City、東灣對岸的舊港城與後排板樓。
// 玩家走近 near 公尺內才下載；同一個替身（ISLE_PROXY）的模型都擺好，才把程式替身藏起來 ───
const COAST_MODELS = [
  { set: 'isle_ruin', id: 'ruin', at: ISLE_SITES.ruin, proxy: 'isle', near: 900, y: .03 },
  { set: 'isle_office', id: 'office', at: ISLE_SITES.office, proxy: 'isle', near: 900, y: .03 },
  { set: 'far_london', id: 'london', at: FAR_SITES.london, proxy: 'far', near: 1500 },
  { set: 'far_golu', id: 'golu', at: FAR_SITES.golu, proxy: 'golu', near: 1500 },
  { set: 'far_s7', id: 's7', at: FAR_SITES.s7, proxy: 'golu', near: 1500 },
];
let coastTick = 0;
function coastModelsUpdate() {
  if (!GLB_ON || (coastTick = (coastTick + 1) % 30)) return;
  const x = pX(), z = pZ();
  for (const o of COAST_MODELS) {
    if (o.req || Math.hypot(x - o.at.x, z - o.at.z) > o.near) continue;
    o.req = true;
    loadProps(o.set).then(items => {
      if (!items || !items[o.id]) return;
      scene.add(propObject(items[o.id], o.at.x, o.y || 0, o.at.z, o.at.ry || 0));
      if (o.proxy === 'isle') {   // 島上的基地也畫進日光陰影的高度圖（22-hmap.js）
        const M = new T.Matrix4().compose(V3(o.at.x, o.y || 0, o.at.z), new T.Quaternion().setFromAxisAngle(V3(0, 1, 0), o.at.ry || 0), V3(1, 1, 1));
        const wg = items[o.id].parts.map(p => p.geo.clone().applyMatrix4(M));
        hmModel({ set: o.set, id: o.id, x: o.at.x, z: o.at.z, ry: o.at.ry || 0, s: 1 }, wg);
        wg.forEach(g => g.dispose()); hmFlush();
      }
      o.done = true;
      if (COAST_MODELS.every(c => c.proxy !== o.proxy || c.done)) ISLE_PROXY[o.proxy].removeFromParent();   // 島上的替身在 cullList 裡，distCull 每幀會重設 visible，所以直接拿掉
    });
  }
}

// ─── 路邊拉麵攤：霓虹區三個地塊門前的人行道上，面向馬路 ───
const ramenSpots = [];
if (GLB_ON) {
  const r = rng(808);
  const cand = lots.filter(L => !L.back && !L.special && !L.glb && L.b && !L.b.outer && L.axis === 'z' && L.x1 - L.x0 > 8.5 && district((L.x0 + L.x1) / 2, (L.z0 + L.z1) / 2).startsWith('霓虹'));
  for (const L of cand.sort(() => r() - .5)) {
    if (ramenSpots.length >= 3) break;
    const x = (L.x0 + L.x1) / 2, z = L.face > 0 ? L.z1 + 1.55 : L.z0 - 1.55;
    if (!free(x, z, 3.2) || ramenSpots.some(o => Math.hypot(o.x - x, o.z - z) < 60)) continue;
    claim(x, z, 3.2);
    ramenSpots.push({ x, z, ry: L.face > 0 ? 0 : Math.PI });
  }
}
const ramenReady = ramenSpots.length ? loadProps('ramen').then(items => {
  if (!items) return;
  for (const o of ramenSpots) {
    scene.add(propObject(items.ramen, o.x, 0, o.z, o.ry));
    colliders.push({ x0: o.x - 2.9, x1: o.x + 2.9, z0: o.z - 1.3, z1: o.z + 1.3 });
  }
}) : Promise.resolve();

// ─── 室內道具：走進場館才下載，下載好就把 Blender 道具（fb，InstancedMesh）換掉；fb 為 null 是單純加擺（車庫的升降機） ───
const propSwaps = [];   // { where, fb, scn, id, list, done }
function propSwap(where, fb, id, list, scn = fb && fb.parent, done) { if (GLB_ON) propSwaps.push({ where, fb, scn, id, list, done }); }
function propWake(where) {
  for (let i = propSwaps.length - 1; i >= 0; i--) {
    const o = propSwaps[i];
    if (o.where !== where) continue;
    propSwaps.splice(i, 1);
    if (!glbDone.has('p:interior')) glbBatch.add('p:interior');
    loadProps('interior').then(items => {
      if (!items || !items[o.id]) return;
      if (o.fb) o.fb.visible = false;
      for (const t of o.list) o.scn.add(propObject(items[o.id], t.x, t.y || 0, t.z, t.ry || 0, t.s || 1));
      if (o.done) o.done();
    });
  }
}
