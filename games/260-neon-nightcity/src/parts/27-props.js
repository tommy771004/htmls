
// ═══ 實體道具與建築：tools/props.mjs 處理過的 assets/260/props/*.glb（以 http(s) 開啟才下載），材質沿用實車的 glbMaterial ═══
// 建築（10-city 的 bldPlace）與路邊拉麵攤開場就下載，開始畫面等它們下載完；室內道具走進酒吧或車庫才下載。
// 以檔案開啟或下載失敗：建築那幾塊地補回程式立面，室內沿用 Blender 道具，拉麵攤不擺。
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const PROP_BASE = new URL('../assets/260/props/', location.href).href;
const PROP_INST = { uM: { value: new T.Vector4(0, 0, 1, 0) }, uPaint: { value: new T.Vector4(0, 0, 0, 0) } };
const propCache = {}, propMats = new Map(), FAR_FOG = .2;   // FAR_FOG：props.json 標 far 的遠景組，霧和 MAT.far 一樣只算兩成距離
// WASH_SETS：立面是拼貼圖集、量不出窗戶的組，夜裡在 shader 依高度打一層路燈光（26-glb.js 的 WASH）
const WASH_SETS = new Set(['bld_nbh']);
const propMat = (src, far, wash) => { let m = propMats.get(src); if (!m) { m = glbMaterial(src, PROP_INST, far, wash); propMats.set(src, m); } return m; };
// 量化的整數屬性轉成浮點，再套上節點矩陣（量化的位移與縮放在節點上）。直接讀底層陣列（交錯排列照 stride，正規化的整數照 three 的 denormalize），
// 逐元素 getComponent 在大的建築組與場館要上百 ms
const DENORM = new Map([[Uint32Array, 4294967295], [Uint16Array, 65535], [Uint8Array, 255], [Uint8ClampedArray, 255], [Int32Array, 2147483647], [Int16Array, 32767], [Int8Array, 127]]);
function floatGeo(geo, mtx) {
  const g = new T.BufferGeometry();
  for (const [k, at] of Object.entries(geo.attributes)) {
    const il = at.isInterleavedBufferAttribute, a = il ? at.data.array : at.array, st = il ? at.data.stride : at.itemSize, o = il ? at.offset : 0, n = at.itemSize;
    const f = new Float32Array(at.count * n), d = at.normalized ? DENORM.get(a.constructor) : 0;
    if (d === undefined && !(a instanceof Float32Array)) { for (let i = 0; i < at.count; i++) for (let c = 0; c < n; c++) f[i * n + c] = at.getComponent(i, c); }
    else if (d) { for (let i = 0; i < at.count; i++) for (let c = 0; c < n; c++) f[i * n + c] = Math.max(a[i * st + o + c] / d, -1); }
    else for (let i = 0; i < at.count; i++) for (let c = 0; c < n; c++) f[i * n + c] = a[i * st + o + c];
    g.setAttribute(k, new T.BufferAttribute(f, n));
  }
  const ix = geo.index && geo.index.array;
  g.setIndex(ix ? new T.BufferAttribute(ix instanceof Uint8Array ? Uint16Array.from(ix) : ix.slice(), 1) : null);
  g.applyMatrix4(mtx);
  return g;
}
// 大量重複的道具用的 InstancedMesh 版材質（後段的 w2Inst）
const GLB_VS_I = GLB_VS.replace('vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);',
  'vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);');
const propMatsI = new Map();
function propMatI(mat) {   // 和 propMat 共用 uniforms（時間、相機、天氣都跟著動），只換頂點著色器
  let m = propMatsI.get(mat);
  if (!m) { m = new T.ShaderMaterial({ uniforms: mat.uniforms, vertexShader: GLB_VS_I, fragmentShader: mat.fragmentShader, defines: { ...mat.defines }, side: mat.side, transparent: mat.transparent, depthWrite: mat.depthWrite }); propMatsI.set(mat, m); }
  return m;
}
// ─── 分幀與預熱（96-perf.js 量到的抵達卡頓：第一次畫到時一幀上傳近百張貼圖、建築組在主執行緒合併一次 0.5～1 秒）───
// 長工作每做滿 warmMs 就讓出一幀，同一幀裡所有切片共用預算（開始畫面時給 40 ms，進場後 99-main.js 改成 6 ms）。
// 模型放進場景前先在背景編好著色器（compileAsync：有 KHR_parallel_shader_compile 時驅動在背景編）、貼圖一張一張上傳（initTexture），
// 建築合併後、距離剔除半徑內的大網格一個一個送進 1×1 的暫存目標畫一次，把頂點傳上顯示卡；這樣第一次畫到時不用整批擠在同一幀。
// ?warm=0 關掉（不切片、不預熱、不開解碼 Worker），和舊做法比較用。
const WARM_ON = !/[?&]warm=0\b/.test(location.search);
let warmLive = false, warmMs = WARM_ON ? 40 : Infinity, warmTs = -1, warmT = 0, warmRT = null;
const warmCam = new T.PerspectiveCamera(), warmTex = new WeakSet();
warmCam.layers.enableAll();
const nextFrame = () => new Promise(r => { const t = setTimeout(r, 100); requestAnimationFrame(ts => { clearTimeout(t); r(ts); }); });
async function warmSlice() {
  for (;;) {
    if (performance.now() - warmT < warmMs) return;
    const ts = await nextFrame();
    if (ts === undefined || ts !== warmTs) { warmTs = ts; warmT = performance.now(); }   // 這一幀第一個醒來的切片重設預算
  }
}
// 做事的時間（扣掉等幀）：96-perf.js 的卡頓標記用
function warmClock() { let ms = 0, t = performance.now(); return { tick: async () => { ms += performance.now() - t; await warmSlice(); t = performance.now(); }, ms: () => ms + performance.now() - t }; }
// near 給了（建築組）：著色器全部編，貼圖與頂點只傳 near 為真的網格的（建築組 670 m 外就下載，全部先傳要多佔幾百 MB 顯示卡記憶體）；
// 沒給：進場後才下載的道具（走近或走進場館才下載的）編著色器、傳貼圖，幾何等第一次畫到；開場整批下載的（69-* 頂層的 loadProps，
// 多半擺在城裡別處）只編著色器，貼圖照舊等第一次畫到。貼圖傳過的不再傳（warmTex），著色器 three 自己快取
const warmGo = () => { warmLive = true; if (WARM_ON) warmMs = 6; };   // 99-main.js 按下進場時呼叫
async function glbWarm(objs, near, inst) {
  if (!WARM_ON || !objs.length) return;
  const tmp = new T.Scene(), mats = new Set();
  for (const o of objs) {
    const geo = o.isMesh ? o.geometry : o.geo, mat = o.isMesh ? o.material : o.mat;
    if (mats.has(mat)) continue;
    mats.add(mat); tmp.add(new T.Mesh(geo, mat));
    if (inst) tmp.add(new T.InstancedMesh(geo, propMatI(mat), 1));   // inst：後段 w2Inst 用的實例版
  }
  try { await R.compileAsync(tmp, warmCam); } catch (e) { /* 編譯失敗留給第一次畫到時再報 */ }
  if (near) objs = objs.filter(near);
  else if (!warmLive) objs = [];
  const tex = [];
  for (const m of new Set(objs.map(o => (o.isMesh ? o.material : o.mat)))) for (const u of Object.values(m.uniforms || {})) { const v = u.value; if (v && v.isTexture && !v.isRenderTargetTexture && !warmTex.has(v)) { warmTex.add(v); tex.push(v); } }
  for (const t of tex) { await warmSlice(); R.initTexture(t); }
  if (!near) return;
  warmRT ??= new T.WebGLRenderTarget(1, 1, { depthBuffer: false });
  for (const m of objs) {
    await warmSlice();
    const prev = R.getRenderTarget(), ri = R.info.render, c = ri.calls, tr = ri.triangles, fc = m.frustumCulled, par = m.parent;
    tmp.clear(); tmp.add(m); m.frustumCulled = false;
    R.setRenderTarget(warmRT); R.render(tmp, warmCam); R.setRenderTarget(prev);
    m.frustumCulled = fc; tmp.remove(m); if (par) par.add(m);
    ri.calls = c; ri.triangles = tr;
  }
}
// 一個輸出檔 → { 物件 id: { parts: [{ geo, mat }], w, d, h } }
function loadProps(set) {
  if (!GLB_ON || !PROPS_SPEC[set]) return Promise.resolve(null);
  const key = 'p:' + set;
  return propCache[set] ??= glbLoader.loadAsync(PROP_BASE + set + '.glb', e => { glbBytes[key] = [e.loaded, e.lengthComputable ? e.total : 0]; }).then(async g => {
    const clk = warmClock();
    g.scene.updateMatrixWorld(true);
    const items = {};
    for (const n of g.scene.children) {
      const parts = [], ms = [];
      n.traverse(m => { if (m.isMesh) ms.push(m); });
      for (const m of ms) { parts.push({ geo: floatGeo(m.geometry, m.matrixWorld), mat: propMat(m.material, PROPS_SPEC[set].far && FAR_FOG, WASH_SETS.has(set)) }); await clk.tick(); }
      items[n.name] = { parts, ...PROPS_SPEC[set].items[n.name] };
    }
    perfTags.push(['道具 ' + set, clk.ms()]);
    const parts = Object.values(items).flatMap(it => it.parts);
    if (bldPlace.some(b => b.set === set)) await glbWarm(parts, () => false);   // 建築組：這裡只編著色器，貼圖與頂點在 bldPut 照距離傳
    else await glbWarm(parts);
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
const bldTile = b => zoneAtL(b.x, b.z).id + ':' + Math.floor((b.x - X0) / (P * BLD_TILE)) + ',' + Math.floor((b.z - Z0) / (Q * BLD_TILE));
const bldW = new Map(bldPlace.map(b => [b, toW(b.x, b.z)]));   // 走近才下載：比的是世界座標
const bldSets = [...new Set(bldPlace.map(b => b.set))];
const bldReq = new Map();   // set → Promise
let bldQ = Promise.resolve();   // 各組依序擺（一組擺到一半時讓出幀，別組不插進來，bldSeam 看到的隔壁不是半套）
function bldLoad(set) {
  if (bldReq.has(set)) return bldReq.get(set);
  const pr = loadProps(set).then(items => (bldQ = bldQ.then(() => bldPut(set, items)).catch(e => console.warn('建築組擺放失敗：' + set, e))));
  bldReq.set(set, pr);
  return pr;
}
async function bldPut(set, items) {
  const clk = warmClock(), mine = bldPlace.filter(b => b.set === set);
  if (!items) { lotFallback(mine.flatMap(b => b.lots)); return; }
  const byKey = new Map(), M = new T.Matrix4(), Q = new T.Quaternion(), Y = V3(0, 1, 0);
  for (const b of mine) {
    bldAlign(b, items[b.id]);   // 27-bldfoot.js：沿街的一排照模型的牆面推到街面（以模型為主）
    M.compose(V3(b.x, 0, b.z), Q.setFromAxisAngle(Y, b.ry), V3(b.s, b.s, b.s));
    const tk = bldTile(b), wg = [], zn = zoneAtL(b.x, b.z);
    for (const p of items[b.id].parts) {
      let e = byKey.get(tk + '|' + p.mat.uuid);
      if (!e) byKey.set(tk + '|' + p.mat.uuid, e = { mat: p.mat, list: [], zn });
      const g = p.geo.clone().applyMatrix4(M);
      e.list.push(g); wg.push(g);
    }
    hmModel(b, wg, frameM4(zn, b.x, b.z));   // 22-hmap.js：用模型的三角形重畫日光陰影的高度圖
    if (b.blk && b.blk.ents) bldCut(b, wg);   // 27-bldfoot.js：模型在人的高度的外形
    bldOver(b, wg);   // 伸出地塊前緣的逃生梯、雨棚與兩端的高度
    await clk.tick();
  }
  for (const b of mine) if (b.row) { bldSeam(b); bldTrees(b); }   // 模型兩端和隔壁之間的縫補起來；枝葉會插進逃生梯、雨棚的行道樹拿掉
  hmFlush();
  for (const blk of new Set(mine.map(b => b.blk).filter(k => k && k.ents))) blkFoot(blk);   // 照模型的外形換掉街區的碰撞盒
  const ms = [];
  for (const { mat, list, zn } of byKey.values()) {
    await clk.tick();
    const g = mergeGeometries(list);
    for (const x of list) x.dispose();
    if (!g) continue;
    const m = new T.Mesh(g, mat); m.matrixAutoUpdate = false; m.userData.bld = set; m.userData.noTess = 1;   // 頂點逐一彎曲（不切），貼著彎過的街區
    bakeMesh(m, zn); ms.push(m);   // 10-city.js 的 cityAdd 對原點網格做的事，放進場景前先預熱
  }
  perfTags.push(['建築 ' + set, clk.ms()]);
  // 只預熱現在距離剔除半徑內的（遠的分塊等走近、第一次畫到才上傳，不先佔顯示卡記憶體）
  let x, z; try { x = pX(); z = pZ(); } catch (e) { [x, z] = toW(avX(1), stZ(2)); }   // 開場時排在後面的 69-police.js 還沒跑到：用出生點
  const cr = CULL_R * detailK() + 60;
  await glbWarm(ms, m => { const s = m.geometry.boundingSphere || (m.geometry.computeBoundingSphere(), m.geometry.boundingSphere); return Math.hypot(s.center.x - x, s.center.z - z) < s.radius + cr; });
  for (const m of ms) { scene.add(m); cullAdd(m); }
}
const bldNear = (set, x, z, R) => bldPlace.some(b => { if (b.set !== set) return false; const [bx, bz] = bldW.get(b); return (bx - x) ** 2 + (bz - z) ** 2 < R * R; });
const bldReady = Promise.all(bldSets.filter(set => bldNear(set, ...toW(avX(1), stZ(2)), BLD_NEAR)).map(bldLoad));   // 出生點在 Atlas Av · 8 St 附近（40-people.js 的 player）
let bldTick = 0;
function bldUpdate() {   // 每半秒看一次：走近還沒下載的組就開始下載
  if (!GLB_ON || (bldTick = (bldTick + 1) % 30)) return;
  const x = pX(), z = pZ();
  for (const set of bldSets) if (!bldReq.has(set) && bldNear(set, x, z, BLD_NEAR + 150)) bldLoad(set);
}

// ─── 海岸的模型（21-coast.js）：灰鷗島的兩個基地、灰鷺河對岸的 London City（東灣改成山之後，舊港城與後排板樓不擺了）。
// 玩家走近 near 公尺內才下載；同一個替身（ISLE_PROXY）的模型都擺好，才把程式替身藏起來 ───
const COAST_MODELS = [
  { set: 'isle_ruin', id: 'ruin', at: ISLE_SITES.ruin, proxy: 'isle', near: 900, y: .03 },
  { set: 'isle_office', id: 'office', at: ISLE_SITES.office, proxy: 'isle', near: 900, y: .03 },
  { set: 'far_london', id: 'london', at: FAR_SITES.london, proxy: 'far', near: 1500, zn: FAR_ZN },
  // 外海的兩座島（遠景，整個城市南半都看得到，所以 near 比其他遠景大；城北的玩家要往南走才會下載）：鷹巖村的紅瓦屋頂（props.mjs 的 glow 取樣）夜裡點上一盞盞暖色的窗燈
  { set: 'far_eze', id: 'eze', at: FAR_SITES.eze, proxy: 'eze', near: 3600, y: FAR_SITES.eze.y, zn: SEA_FR, after: (it, zn) => {
    const k = new Kit(), c = Math.cos(FAR_SITES.eze.ry), s = Math.sin(FAR_SITES.eze.ry), at = FAR_SITES.eze;
    for (const [x, y, z] of it.glow || []) k.box(at.x + x * c + z * s, at.y + y + 2, at.z - x * s + z * c, 4.5, 3.2, 4.5, 0xffc890, 11);   // 兩公里外一盞約兩三個像素
    cityAdd(new T.Mesh(k.build(), MAT.far), zn);
  } },
  // 光格島的街區是原檔的遮光盒（純黑），只有路面邊線會亮：沿岸線（props.mjs 的 edges，tools/walkgrid.mjs 量的陸地邊界）在岸壁頂下拉一條青色的燈帶，
  // 每走 40 m 立一支洋紅色的燈柱；近景（21-tron.js）換上來之後這些還留著
  { set: 'far_tron', id: 'tron', at: FAR_SITES.tron, proxy: 'tron', near: 3600, y: FAR_SITES.tron.y, zn: TRON_SITE.zn, after: (it, zn) => {
    const k = new Kit(), at = FAR_SITES.tron, y = at.y;
    let run = 40;
    for (const [x0, z0, x1, z1] of it.edges || []) {
      const L = Math.hypot(x1 - x0, z1 - z0); if (L < .5) continue;
      k.box(at.x + (x0 + x1) / 2, y - .4, at.z + (z0 + z1) / 2, L + .3, .3, .3, 0x46e6ff, 11, 0, -Math.atan2(z1 - z0, x1 - x0), 0);
      if ((run += L) > 40) { run = 0; k.box(at.x + x0, y + 3, at.z + z0, .5, 6, .5, 0x1a1c22, 2).box(at.x + x0, y + 6.3, at.z + z0, 1, .6, 1, 0xff3ad0, 11); }
    }
    cityAdd(new T.Mesh(k.build(), MAT.far), zn);
  } },
];
let coastTick = 0;
function coastModelsUpdate() {
  if (!GLB_ON || (coastTick = (coastTick + 1) % 30)) return;
  const x = pX(), z = pZ();
  for (const o of COAST_MODELS) {
    const zn = o.zn || zoneAtL(o.at.x, o.at.z), [ax, az] = toW(o.at.x, o.at.z, zn);   // at 是邏輯座標，模型掛進所在的區（對岸的跟著 FAR_ZN）
    if (o.req || Math.hypot(x - ax, z - az) > o.near) continue;
    o.req = true;
    loadProps(o.set).then(items => {
      if (!items || !items[o.id]) return;
      cityAdd(o.obj = propObject(items[o.id], o.at.x, o.y || 0, o.at.z, o.at.ry || 0), zn);   // o.obj：tools/glb-check.mjs 量擺放的位置
      if (o.after) o.after(items[o.id], zn);
      if (o.proxy === 'isle') {   // 島上的基地也畫進日光陰影的高度圖（22-hmap.js）
        const M = new T.Matrix4().compose(V3(o.at.x, o.y || 0, o.at.z), new T.Quaternion().setFromAxisAngle(V3(0, 1, 0), o.at.ry || 0), V3(1, 1, 1));
        const wg = items[o.id].parts.map(p => p.geo.clone().applyMatrix4(M));
        hmModel({ set: o.set, id: o.id, x: o.at.x, z: o.at.z, ry: o.at.ry || 0, s: 1 }, wg, zn && frameM4(zn, o.at.x, o.at.z));
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
    cityAdd(propObject(items.ramen, o.x, 0, o.z, o.ry));
    addBoxL({ x0: o.x - 2.9, x1: o.x + 2.9, z0: o.z - 1.3, z1: o.z + 1.3 });
  }
}) : Promise.resolve();

// ─── 室內道具：走進場館才下載，下載好就把 Blender 道具（fb，InstancedMesh）換掉；fb 為 null 是單純加擺（車庫的升降機） ───
const propSwaps = [];   // { where, fb, scn, id, list, done }
// set：道具在哪一個 props/<set>.glb（預設 interior；66-chrome.js 的改裝廠用 chrome）
function propSwap(where, fb, id, list, scn = fb && fb.parent, done, set = 'interior') { if (GLB_ON) propSwaps.push({ where, fb, scn, id, list, done, set }); }
function propWake(where) {
  for (let i = propSwaps.length - 1; i >= 0; i--) {
    const o = propSwaps[i];
    if (o.where !== where) continue;
    propSwaps.splice(i, 1);
    if (!glbDone.has('p:' + o.set)) glbBatch.add('p:' + o.set);
    loadProps(o.set).then(items => {
      if (!items || !items[o.id]) return;
      if (o.fb) o.fb.visible = false;
      for (const t of o.list) o.scn.add(propObject(items[o.id], t.x, t.y || 0, t.z, t.ry || 0, t.s || 1));
      if (o.done) o.done();
    });
  }
}

// ═══ World 第四輪之二（使用者提供的 ~/Downloads/world_2，21 個 Sketchfab 模型，CC BY 4.0）：街道設施、植物與海岸 ═══
// tools/props.mjs 的 st2_／nat_／cst_ 組（消防栓用既有 street.glb 的同一個模型）。以 http(s) 開啟時開場就在背景下載（合計約 4 MB），
// 下載好才把 20-props.js／21-coast.js 的程式建模拿掉換成模型；以檔案開啟或下載失敗時程式建模原封不動，只有模型版才有的
// （報紙箱、公園長椅與野餐桌、樹下灌木、雪山）也不擺、不加碰撞。大量重複的每個部件一個 InstancedMesh（20-props 的 instanced()：
// 清單、zn 與 instUpdate 串流規則和程式建模一樣），材質是 glbMaterial 加上 instanceMatrix 的版本（propMatI）。
// 狀態放在 window.__nc.props.w2（驗收用）。
const W2 = { on: GLB_ON, sets: {}, failed: [], swapped: [], n: {} };
// 一個模型物件擺成清單裡的每一份；geo 可以換成上色過的副本（貨櫃）
function w2Inst(it, list, layer = 0, R, geoOf = g => g) {
  if (!it || !list.length) return [];
  return it.parts.map(p => instanced(geoOf(p.geo), propMatI(p.mat), list, layer, undefined, R));
}
const w2Drop = (...ms) => { for (const m of ms) if (m) m.removeFromParent(); };
const w2Hash = (x, z) => ((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1 + 1) % 1;
const w2Group = (list, n, f) => { const out = Array.from({ length: n }, () => []); for (const t of list) out[f(t)].push(t); return out; };
function w2Load(set, fn, fail) {
  return loadProps(set).then(async items => {
    if (!items) { W2.failed.push(set); if (fail) fail(); return; }
    await glbWarm(Object.values(items).flatMap(it => it.parts), null, true);
    try { fn(items); W2.sets[set] = Object.keys(items).length; } catch (e) { console.warn('World 第四輪之二：擺放失敗 ' + set, e); W2.failed.push(set); }
  });
}
let w2Ready = Promise.resolve();
// 公園、縫與島上的樹分七種（nat_trees 四種、cs_country 三種，兩組各自擺），行道樹都是第 0 種（楓樹）
const treePick = t => (t.park ? Math.floor(w2Hash(t.x, t.z) * 7) : 0);
const isleTreeList = () => ISLE_TREES.map(t => ({ ...t, park: 1 }));
// ?w2=0：不換這一輪的模型（比較效能、除錯用）
if (/[?&]w2=0\b/.test(location.search)) W2.on = false;
if (W2.on && GLB_VS_I !== GLB_VS) {
  const TREE_R = 200;   // 樹的面數多：只送 200 m 內的實例，外面用程式建模的樹（畫到 380 m）
  const W2R = { small: 110, mid: 160 };   // 小件（垃圾桶、消防栓、報紙箱、灌木）與中件（長椅、電話亭、陽傘）的串流半徑
  w2Ready = Promise.all([
    // ─── 人行道：消防栓（street.glb）、垃圾桶四款、電話亭、報紙箱；公園的長椅與野餐桌；海濱與岬角的長椅、岬角的野餐桌 ───
    w2Load('street', it => {
      w2Inst(it.hydrant, hydrants, LY.NOREFL, W2R.small); w2Drop(hydrantMesh); W2.swapped.push('hydrant'); W2.n.hydrant = hydrants.length;
      streetLater(it);
    }, () => streetLater(null)),
    // ─── 快速道路的橋墩柱身（hwy.glb，21-coast.js 的 FWY_PIERS）：柱高照橋面拉長，帽梁還是程式建模 ───
    w2Load('hwy', it => {
      const H = it.pier.h || 8;
      w2Inst(it.pier, FWY_PIERS.map(t => ({ x: t.x, z: t.z, ry: t.ry, sy: t.h / H, zn: null })), 0, W2R.mid * 2);
      w2Drop(fwyPierMesh); W2.swapped.push('pier'); W2.n.pier = FWY_PIERS.length;
    }),
    w2Load('st2_street', it => {
      const BINS = ['bin_k', 'bin_g', 'bin_b', 'wheelie'];
      w2Group(bins, 4, t => Math.floor(w2Hash(t.x, t.z) * 4)).forEach((L, k) => w2Inst(it[BINS[k]], L, LY.NOREFL, W2R.small));
      w2Drop(binMesh);
      w2Inst(it.booth, booths, 0, W2R.mid); w2Drop(boothMesh);
      w2Inst(it.newsbox, newsBoxes, LY.NOREFL, W2R.small);
      for (const t of newsBoxes) addCircleL({ x: t.x, z: t.z, r: .3 });
      // 公園：長椅（有靠背、沒靠背交錯）與野餐桌，碰撞是軸向的盒（ry 都是 90° 的倍數）
      const seats = w2Group(parkSeats, 3, t => (t.kind === 'picnic' ? 2 : w2Hash(t.x, t.z) < .5 ? 0 : 1));
      w2Inst(it.bench, seats[0], LY.NOREFL, W2R.mid); w2Inst(it.bench2, seats[1], LY.NOREFL, W2R.mid); w2Inst(it.picnic, seats[2], LY.NOREFL, W2R.mid);
      for (const t of parkSeats) {
        const [hx, hz] = t.kind === 'picnic' ? [.9, .9] : t.ax === 'x' ? [.95, .3] : [.3, .95];
        addBoxL({ x0: t.x - hx, x1: t.x + hx, z0: t.z - hz, z1: t.z + hz });
      }
      // 海濱與岬角：程式建模的長椅換成同一款有靠背的（位置與碰撞不變）
      w2Inst(it.bench, benches, LY.NOREFL, W2R.mid); w2Drop(benchMesh);
      // 岬角的野餐桌：避開 27-world1.js 擺的石塔（和它的石牆）
      let towers = []; try { towers = W1_SITES.filter(o => o.set === 'w1_tower'); } catch (e) { /* 另一段還沒宣告 */ }
      const cp = capePicnic.filter(t => !towers.some(o => Math.hypot(o.x - t.x, o.z - t.z) < 14));
      w2Inst(it.picnic, cp, LY.NOREFL, W2R.mid);
      for (const t of cp) addCircleL({ x: t.x, z: t.z, r: 1.1, w: 1 });
      W2.swapped.push('bins', 'booth', 'bench'); Object.assign(W2.n, { bins: bins.length, booths: booths.length, news: newsBoxes.length, parkSeats: parkSeats.length, benches: benches.length, capePicnic: cp.length });
    }),
    // ─── 樹：行道樹是楓樹，公園、縫、岬角與灰鷗島七種混著（楓樹、兩棵垂柳、三棵一叢的橡樹；後三種是 cs_country 的三款槭樹，那一組自己擺）；碰撞照舊 ───
    w2Load('nat_trees', it => {
      const MIX = ['maple', 'willow_a', 'willow_b', 'oak'];
      w2Group(trees, 7, treePick).slice(0, 4).forEach((L, k) => w2Inst(it[MIX[k]], L, 0, TREE_R));
      w2Group(isleTreeList(), 7, treePick).slice(0, 4).forEach((L, k) => w2Inst(it[MIX[k]], L, 0, 700));   // 島上的樹少，從岸邊看得到
      // 程式建模的行道樹留著當遠景：只畫在 TREE_R 外（20-props 的 stream.R0），近處換成模型
      if (treeMesh.userData.stream) treeMesh.userData.stream.R0 = TREE_R - 6; else w2Drop(treeMesh);
      w2Drop(isleTreeMesh);
      W2.swapped.push('trees'); W2.n.trees = trees.length + ISLE_TREES.length;
    }),
    // ─── 田園一景（abhayexe 的 Countryside Scene）拆出來的件：公園與島上的槭樹（nat_trees 的另外三種）、20 呎貨櫃、護欄 ───
    // 整景與島上的護欄在 27-world1.js（走近才擺）。貨櫃：拖吊場西牆邊兩個疊一起再一個、施工大樓工地東邊（材料棚北邊）兩個加一個疊上去；
    // 設施座標相對街區西北角（facZn），碰撞是盒（疊的那個不用）
    w2Load('cs_country', it => {
      const ACER = ['acer1', 'acer2', 'acer3'];
      w2Group(trees, 7, treePick).slice(4).forEach((L, k) => w2Inst(it[ACER[k]], L, 0, TREE_R));
      w2Group(isleTreeList(), 7, treePick).slice(4).forEach((L, k) => w2Inst(it[ACER[k]], L, 0, 700));
      const box = [];
      const put = (F, x, z, ry = 0, y = 0) => {
        if (!F) return;
        const zn = F.L[0] ? F.L[0].zn : F.zn;   // 69-v5-civic.js 的 facZn（模型可能在那一段跑到之前就下載好）
        box.push({ x: F.ax + x, z: F.az + z, y, ry, zn });
        if (!y) { const hw = it.crate.w / 2, hd = it.crate.d / 2, [a, b] = ry ? [hd, hw] : [hw, hd]; addBoxL({ x0: F.ax + x - a, x1: F.ax + x + a, z0: F.az + z - b, z1: F.az + z + b, zn, hy: it.crate.h }); }
      };
      const P = FAC.pd, Y = P && P.yard;
      if (Y) { const x = Y.x0 - P.ax + 1.6, z = Y.z0 - P.az; put(P, x, z + 20); put(P, x, z + 20, 0, it.crate.h); put(P, x, z + 27); }
      const C = FAC.crane;
      if (C) { put(C, 54, 17.5); put(C, 54, 25); put(C, 54, 21.2, 0, it.crate.h); }
      w2Inst(it.crate, box, 0, W2R.mid * 1.5);
      W2.n.crates = box.length;
    }),
    // ─── 灌木：樹下（只有模型版才有）與海濱花台（換掉程式的二十面體） ───
    w2Load('nat_bush', it => {
      const KIND = ['hosta', 'fern', 'fernlong'], pl = [];
      for (const p of planters) for (let i = 0; i < 4; i++) {
        const ox = -1.1 + i * .73, oz = (i % 2 - .5) * .3, c = Math.cos(p.ry || 0), s = Math.sin(p.ry || 0);
        pl.push({ x: p.x + ox * c + oz * s, z: p.z - ox * s + oz * c, y: (p.y || 0) + .61, ry: i * 1.9, s: 1.3, kind: i % 3, zn: zoneAtL(p.x, p.z) });
      }
      w2Group([...shrubs, ...pl], 3, t => t.kind).forEach((L, k) => w2Inst(it[KIND[k]], L, LY.NOREFL, W2R.small));
      w2Drop(planterShrubMesh);
      W2.swapped.push('shrubs'); W2.n.shrubs = shrubs.length + pl.length;
    }),
    // ─── 珊瑚灘：椰子樹、救生員塔、陽傘 ───
    w2Load('cst_beach', it => {
      w2Inst(it.palm, palms, 0, 600); w2Drop(palmMesh);
      for (const g of lifeguards) cityAdd(propObject(it.lifeguard, g.x, g.y, g.z, 0));
      w2Drop(guardMesh);
      w2Inst(it.umbrella, beachUmbs, 0, W2R.mid); w2Drop(beachUmbMesh);
      W2.swapped.push('palms', 'lifeguard', 'umbrella'); Object.assign(W2.n, { palms: palms.length, umbrellas: beachUmbs.length });
    }),
    // ─── 棧橋摩天輪：支架、輪子、十個車廂（coastUpdate 照舊轉輪子、車廂保持水平；輪軸高度與吊點半徑換成模型的） ───
    w2Load('cst_ferris', it => {
      const bg = it.base.parts[0].geo; bg.computeBoundingBox();
      const hub = -bg.boundingBox.min.y;   // 支架底到輪軸
      ferris.position.y = FERRIS.h + hub; FERRIS.R = 17.26; FERRIS.wy = hub;
      cityAdd(propObject(it.base, FERRIS.cx, FERRIS.h + hub, FERRIS.wz), zoneAtL(FERRIS.cx, FERRIS.wz));
      ferris.add(propObject(it.wheel, 0, 0, 0));
      w2Drop(FERRIS.base, FERRIS.wheel);
      const cp = it.cabin.parts;
      for (const c of cabins) { c.geometry = cp[0].geo; c.material = cp[0].mat; for (const p of cp.slice(1)) c.add(new T.Mesh(p.geo, p.mat)); }
      W2.swapped.push('ferris');
    }),
    // ─── 錨灣港：岸橋（小車、鋼索、吊具照舊會動，高度改成模型吊臂的下緣）、貨櫃船（船艏朝東，隨浪起伏）、堆場的 20 呎貨櫃 ───
    w2Load('cst_port', it => {
      for (const c of harbor.cranes) { c.g.add(propObject(it.crane, -1.9, 0, QUAY.z1 - 4.3)); w2Drop(c.proc); }   // 掛在岸橋自己的 Group 底下，照樣沿軌道移動
      // 貨櫃船：原檔放大 1.85 倍（235 m）；吃水 11 m，艙蓋頂約在海面上 12 m。吊臂避開船上的吊桿與艉樓
      // 掛在 harbor.root（船心）底下，跟著進出港；模型的中心比程式建模的船偏東 22 m
      const SHIP_X = 727, sy0 = SEA_Y - 11, ship = propObject(it.ship, SHIP_X - harbor.home.x, sy0, 0);
      w2Drop(harbor.ship);
      harbor.root.add(ship); for (const m of ship.children) cullAdd(m, 1200);   // cullAdd 要網格，船是 Group
      Object.assign(harbor, { ship, shipY0: sy0, shipY: sy0 + 24.7 + 2.9, trY: 21.6, wireY: 21, hiY: 18.4, shipX0: SHIP_X - it.ship.w / 2, shipX1: SHIP_X + it.ship.w / 2, halfL: it.ship.w / 2 + 2, shipDX: SHIP_X - harbor.home.x });
      // 堆場：原本一格 40 呎的位置擺兩個 20 呎（門對門，打開的那頭藏在中間），沿 z 壓窄成 2.5 m；顏色用頂點色乘上原本的六色
      const pairs = harbor.boxLists.map(L => L.flatMap(t => [{ x: t.x - 3.05, y: t.y, z: t.z, ry: 0, sx: 1, sy: 1.066, sz: .82 }, { x: t.x + 3.05, y: t.y, z: t.z, ry: Math.PI, sx: 1, sy: 1.066, sz: .82 }]));
      harbor.COLS.forEach((col, k) => {
        const tint = new T.Color(lin(col)); tint.multiplyScalar(Math.min(2.4, 1.2 / Math.max(tint.r, tint.g, tint.b, .01)));   // 貼圖提亮成中灰（props.mjs 的 soften）：深色最多放大 2.4 倍，白、灰的不要過曝
        w2Inst(it.box, pairs[k], 0, undefined, g => {
          const c = g.clone(), a = c.attributes.color;
          if (a) { for (let i = 0; i < a.count; i++) a.setXYZ(i, a.getX(i) * tint.r, a.getY(i) * tint.g, a.getZ(i) * tint.b); a.needsUpdate = true; }
          return c;
        });
      });
      w2Drop(...harbor.boxMeshes);
      W2.swapped.push('cranes', 'ship', 'containers'); W2.n.containers = pairs.reduce((a, L) => a + L.length, 0);
    }),
    // ─── 路燈：Full Gameready City 的眼鏡蛇頭路燈（w1_grc 的 lamp，桿在原點、燈臂往 −x）換掉三組程式建模的燈；
    // 燈頭比程式的近 0.25 m，沿燈臂拉長 1.12 倍對上路燈表（hx／hz）。模型的燈罩是灰的，另擺一片自發光的燈罩（顏色照原本三組） ───
    w2Load('w1_grc', it => {
      const L = [lampsA, lampsS, lampsC].map(l => l.map(t => ({ ...t, sx: 1.12 })));
      for (const l of L) w2Inst(it.lamp, l, 0);
      [0xff8a3a, 0xb8dcff, 0xff8a3a].forEach((col, k) => instanced(new Kit().box(-2.02, 6.91, 0, .36, .03, .15, col, 8).build(), MAT.uber, L[k]));
      w2Drop(lampMeshA, lampMeshS, lampMeshC);
      W2.swapped.push('lamps'); W2.n.lamps = lampsA.length + lampsS.length + lampsC.length;
    }),
    // ─── 路面：同一個檔案的柏油貼圖（顏色、法線）疊到 10-city.js 的程式路面上（ASPH_U）；平均亮度先算好，貼圖只改細節不改整體明暗 ───
    Promise.all(['base', 'n'].map(k => new T.TextureLoader().loadAsync(PROP_BASE + 'w1_asphalt_' + k + '.webp'))).then(([b, n]) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 32;
      const cx = cv.getContext('2d'); cx.drawImage(b.image, 0, 0, 32, 32);
      const px = cx.getImageData(0, 0, 32, 32).data, m = [0, 0, 0], lin1 = v => ((v / 255 + .055) / 1.055) ** 2.4;
      for (let i = 0; i < px.length; i += 4) for (let c = 0; c < 3; c++) m[c] += lin1(px[i + c]) / 1024;
      b.colorSpace = T.SRGBColorSpace;
      for (const t of [b, n]) { t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; t.needsUpdate = true; }
      ASPH_U.uAsB.value = b; ASPH_U.uAsN.value = n; ASPH_U.uAsM.value.set(...m.map(v => Math.max(v, .005))); ASPH_U.uAsOn.value = 1;
      W2.swapped.push('asphalt');
    }, e => { console.warn('柏油貼圖下載失敗', e); W2.failed.push('w1_asphalt'); }),
    // ─── 珊瑚灘海濱步道的觀景解說牌：Èze 掃描原檔附的山城全景照（w1_board，燈箱），立在欄杆內側、鷹巖村的正對面，
    // 牌面朝步道、往後仰 34°，看牌子的人抬頭就是那座島 ───
    w2Load('w1_board', it => {
      const ex = FAR_SITES.eze.x, z = SHORE_Z - 1.3;
      let x = null;
      for (let d = 0; d < 60 && x == null; d++) for (const s of [1, -1]) if (x == null && free(ex + d * s, z, 2.1)) x = ex + d * s;
      if (x == null) return;
      claim(x, z, 2.1); addBoxL({ x0: x - 1.95, x1: x + 1.95, z0: z - .5, z1: z + .2 });
      const g = new T.Group(); g.position.set(x, .15, z); g.rotation.y = Math.PI;   // 局部 +z（牌面）朝北
      const pan = new T.Group(); pan.position.set(0, .9, .1); pan.rotation.x = -.6; g.add(pan);
      pan.add(propObject(it.board, 0, 0, .07, 0, .5));   // 背板前面 3 cm
      pan.add(new T.Mesh(new Kit().box(0, .6, 0, 3.84, 1.32, .08, 0x2a2d33, 15).build(), MAT.uber));   // 背板與外框
      const legs = new Kit(); for (const s of [-1.5, 1.5]) legs.box(s, .62, -.25, .12, 1.24, .12, 0x2a2d33, 15);
      g.add(new T.Mesh(legs.build(), MAT.uber));
      cityAdd(g, zoneAtL(x, z));
      W2.swapped.push('board'); W2.board = { x, z };
    }),
    // ─── 北嶺：第三層山脊後面的雪山（遠景材質） ───
    w2Load('cst_mount', it => { w2Inst(it.mount, PEAKS); W2.n.peaks = PEAKS.length; }),
  ]);
}
// 配電箱（20-props.js 的 eboxes，碰撞是順著街的盒）與加油機（每個船位 31-boats.js 的 BOAT_SPOTS 上岸那一側、離船頭三公尺多，面向水面）。
// it 是 street.glb 的模型；以檔案開啟、?w2=0 或下載失敗時傳 null，擺程式建模的替身。
// BOAT_SPOTS 在 31 才宣告，中間隔著好幾個 await bootStep，所以等 99-main.js 的 cityWorld() 之後（W2.boot()）才擺
let w2Boot; const W2_BOOT = new Promise(r => { w2Boot = r; });
W2.boot = () => w2Boot();
const streetLater = it => W2_BOOT.then(() => streetBoxes(it)).catch(e => console.warn('配電箱與加油機擺放失敗', e));
function streetBoxes(it) {
  for (const t of eboxes) { const [hx, hz] = t.ax === 'z' ? [1, .28] : [.28, 1]; addBoxL({ x0: t.x - hx, x1: t.x + hx, z0: t.z - hz, z1: t.z + hz }); }
  const pumps = [];
  for (const S of BOAT_SPOTS) {
    let best = null;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let d = 1.5; d <= 9; d += .5) {
      if (!inLand(S.x + dx * d, S.z + dz * d)) continue;
      if (!best || d < best.d) best = { d, dx, dz };
      break;
    }
    if (!best) continue;
    const { d, dx, dz } = best, x0 = S.x + dx * (d + 1.1), z0 = S.z + dz * (d + 1.1);
    for (const o of [3.6, -3.6, 6, -6]) {
      const x = x0 + dz * o, z = z0 + dx * o;
      if (!inLand(x, z) || !free(x, z, 1)) continue;
      pumps.push({ x, z, y: groundHL(x, z), ry: Math.atan2(-dx, -dz), zn: zoneAtL(S.x, S.z) }); claim(x, z, 1);
      const [hx, hz] = dx ? [.4, .85] : [.85, .4]; addBoxL({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz });
      break;
    }
  }
  if (it) {
    w2Inst(it.ebox, eboxes, LY.NOREFL, 110); w2Inst(it.pump, pumps, 0, 160);
    W2.swapped.push('ebox', 'pump');
  } else {
    // 灰綠色的長箱（長邊順著街）：兩扇門、散熱百葉、頂蓋
    instanced(new Kit().box(0, .58, 0, 1.9, 1.16, .5, 0x56625a, 10).box(0, 1.2, 0, 2, .08, .58, 0x434c46, 15)
      .box(-.47, .6, -.26, .86, .98, .02, 0x606d64, 10).box(.47, .6, -.26, .86, .98, .02, 0x606d64, 10)
      .box(-.47, .95, -.275, .5, .14, .01, 0x2a302c, 15).box(.47, .95, -.275, .5, .14, .01, 0x2a302c, 15)
      .box(0, -.05, 0, 1.94, .1, .54, 0x6c6c66, 2).build(), MAT.uber, eboxes, LY.NOREFL, undefined, 110);
    // 加油機：底座、機身、亮著的價格窗、油槍掛在側面（ry 讓 +z 朝水面）
    instanced(new Kit().box(0, .08, 0, 1.7, .16, .8, 0x8a8a84, 2).box(0, .9, 0, 1.3, 1.5, .55, 0xd8d8d2, 10)
      .box(0, 1.25, .28, .7, .34, .02, 0x7fe7a0, 8).box(0, 1.72, 0, 1.4, .14, .62, 0x1f6a8a, 10)
      .box(.58, .7, .2, .1, .3, .12, 0x222222, 15).cyl(.66, .45, .2, .025, .025, .6, 6, 0x111111, 15).build(), MAT.uber, pumps, 0, undefined, 160);
    W2.proc = true;
  }
  Object.assign(W2.n, { ebox: eboxes.length, pump: pumps.length });
  W2.pumps = pumps;
}
if (!W2.on || GLB_VS_I === GLB_VS) streetLater(null);
// 驗收與截圖用的幾個位置（邏輯座標；cape 是世界座標）
W2.at = { seat: parkSeats.find(t => t.kind === 'bench'), picnic: parkSeats.find(t => t.kind === 'picnic'), news: newsBoxes[0], ebox: eboxes[0], booth: booths[0], bin: bins[0], hydrant: hydrants[0],
  palm: palms[0], guard: lifeguards[0], ferris: { x: FERRIS.cx, z: FERRIS.wz }, crane: { x: 690, z: QUAY.z1 }, yard: harbor.boxLists.flat()[0], cape: capePicnic[0], planter: planters[0], peak: PEAKS[0] };
// 驗收：程式建模的網格還掛在場景上的有幾個（以檔案開啟時應該全部都在）
// （清單在這裡先取好：模型還在下載，harbor.ship 之後會換成模型的船）
const W2_PROC = [hydrantMesh, binMesh, boothMesh, lampMeshA, lampMeshS, lampMeshC, treeMesh, benchMesh, planterShrubMesh, palmMesh, guardMesh, beachUmbMesh, isleTreeMesh, ...harbor.cranes.map(c => c.proc), harbor.ship, ...harbor.boxMeshes];
W2.kept = () => W2_PROC.filter(m => m && m.parent).length;
{ const iv = setInterval(() => { if (window.__nc && window.__nc.props) { window.__nc.props.w2 = W2; clearInterval(iv); } }, 250); }
