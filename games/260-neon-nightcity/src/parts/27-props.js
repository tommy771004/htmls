
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
      n.traverse(m => { if (m.isMesh) parts.push({ geo: floatGeo(m.geometry, m.matrixWorld), mat: propMat(m.material, PROPS_SPEC[set].far && FAR_FOG, WASH_SETS.has(set)) }); });
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
const bldTile = b => zoneAtL(b.x, b.z).id + ':' + Math.floor((b.x - X0) / (P * BLD_TILE)) + ',' + Math.floor((b.z - Z0) / (Q * BLD_TILE));
const bldW = new Map(bldPlace.map(b => [b, toW(b.x, b.z)]));   // 走近才下載：比的是世界座標
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
      const tk = bldTile(b), wg = [], zn = zoneAtL(b.x, b.z);
      for (const p of items[b.id].parts) {
        let e = byKey.get(tk + '|' + p.mat.uuid);
        if (!e) byKey.set(tk + '|' + p.mat.uuid, e = { mat: p.mat, list: [], zn });
        const g = p.geo.clone().applyMatrix4(M);
        e.list.push(g); wg.push(g);
      }
      hmModel(b, wg, zn.m4);   // 22-hmap.js：用模型的三角形重畫日光陰影的高度圖
    }
    hmFlush();
    for (const { mat, list, zn } of byKey.values()) {
      const g = mergeGeometries(list);
      for (const x of list) x.dispose();
      if (!g) continue;
      const m = new T.Mesh(g, mat); m.matrixAutoUpdate = false; m.userData.bld = set;
      cityAdd(m, zn); cullAdd(m);
    }
  });
  bldReq.set(set, pr);
  return pr;
}
const bldNear = (set, x, z, R) => bldPlace.some(b => { if (b.set !== set) return false; const [bx, bz] = bldW.get(b); return (bx - x) ** 2 + (bz - z) ** 2 < R * R; });
const bldReady = Promise.all(bldSets.filter(set => bldNear(set, ...toW(avX(1), stZ(2)), BLD_NEAR)).map(bldLoad));   // 出生點在 Atlas Av · 8 St 附近（40-people.js 的 player）
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
  { set: 'far_london', id: 'london', at: FAR_SITES.london, proxy: 'far', near: 1500, zn: FAR_ZN },
  { set: 'far_golu', id: 'golu', at: FAR_SITES.golu, proxy: 'golu', near: 1500 },
  { set: 'far_s7', id: 's7', at: FAR_SITES.s7, proxy: 'golu', near: 1500 },
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
      cityAdd(propObject(items[o.id], o.at.x, o.y || 0, o.at.z, o.at.ry || 0), zn);
      if (o.proxy === 'isle') {   // 島上的基地也畫進日光陰影的高度圖（22-hmap.js）
        const M = new T.Matrix4().compose(V3(o.at.x, o.y || 0, o.at.z), new T.Quaternion().setFromAxisAngle(V3(0, 1, 0), o.at.ry || 0), V3(1, 1, 1));
        const wg = items[o.id].parts.map(p => p.geo.clone().applyMatrix4(M));
        hmModel({ set: o.set, id: o.id, x: o.at.x, z: o.at.z, ry: o.at.ry || 0, s: 1 }, wg, zn && zn.m4);
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

// ═══ World 第四輪之二（使用者提供的 ~/Downloads/world_2，21 個 Sketchfab 模型，CC BY 4.0）：街道設施、植物與海岸 ═══
// tools/props.mjs 的 st2_／nat_／cst_ 組（消防栓用既有 street.glb 的同一個模型）。以 http(s) 開啟時開場就在背景下載（合計約 4 MB），
// 下載好才把 20-props.js／21-coast.js 的程式建模拿掉換成模型；以檔案開啟或下載失敗時程式建模原封不動，只有模型版才有的
// （報紙箱、公園長椅與野餐桌、樹下灌木、雪山）也不擺、不加碰撞。大量重複的每個部件一個 InstancedMesh（20-props 的 instanced()：
// 清單、zn 與 instUpdate 串流規則和程式建模一樣），材質是 glbMaterial 加上 instanceMatrix 的版本（propMatI）。
// 狀態放在 window.__nc.props.w2（驗收用）。
const W2 = { on: GLB_ON, sets: {}, failed: [], swapped: [], n: {} };
const GLB_VS_I = GLB_VS.replace('vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);',
  'vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);');
const propMatsI = new Map();
function propMatI(mat) {   // 和 propMat 共用 uniforms（時間、相機、天氣都跟著動），只換頂點著色器
  let m = propMatsI.get(mat);
  if (!m) { m = new T.ShaderMaterial({ uniforms: mat.uniforms, vertexShader: GLB_VS_I, fragmentShader: mat.fragmentShader, defines: { ...mat.defines }, side: mat.side, transparent: mat.transparent, depthWrite: mat.depthWrite }); propMatsI.set(mat, m); }
  return m;
}
// 一個模型物件擺成清單裡的每一份；geo 可以換成上色過的副本（貨櫃）
function w2Inst(it, list, layer = 0, R, geoOf = g => g) {
  if (!it || !list.length) return [];
  return it.parts.map(p => instanced(geoOf(p.geo), propMatI(p.mat), list, layer, undefined, R));
}
const w2Drop = (...ms) => { for (const m of ms) if (m) m.removeFromParent(); };
const w2Hash = (x, z) => ((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1 + 1) % 1;
const w2Group = (list, n, f) => { const out = Array.from({ length: n }, () => []); for (const t of list) out[f(t)].push(t); return out; };
function w2Load(set, fn) {
  return loadProps(set).then(items => {
    if (!items) { W2.failed.push(set); return; }
    try { fn(items); W2.sets[set] = Object.keys(items).length; } catch (e) { console.warn('World 第四輪之二：擺放失敗 ' + set, e); W2.failed.push(set); }
  });
}
let w2Ready = Promise.resolve();
// ?w2=0：不換這一輪的模型（比較效能、除錯用）
if (/[?&]w2=0\b/.test(location.search)) W2.on = false;
if (W2.on && GLB_VS_I !== GLB_VS) {
  const TREE_R = 200;   // 樹的面數多：只送 200 m 內的實例，外面用程式建模的樹（畫到 380 m）
  const W2R = { small: 110, mid: 160 };   // 小件（垃圾桶、消防栓、報紙箱、灌木）與中件（長椅、電話亭、陽傘）的串流半徑
  w2Ready = Promise.all([
    // ─── 人行道：消防栓（street.glb）、垃圾桶四款、電話亭、報紙箱；公園的長椅與野餐桌；海濱與岬角的長椅、岬角的野餐桌 ───
    w2Load('street', it => {
      w2Inst(it.hydrant, hydrants, LY.NOREFL, W2R.small); w2Drop(hydrantMesh); W2.swapped.push('hydrant'); W2.n.hydrant = hydrants.length;
      // 配電箱（20-props.js 的 eboxes）：碰撞是順著街的盒
      w2Inst(it.ebox, eboxes, LY.NOREFL, W2R.small);
      for (const t of eboxes) { const [hx, hz] = t.ax === 'z' ? [1, .28] : [.28, 1]; addBoxL({ x0: t.x - hx, x1: t.x + hx, z0: t.z - hz, z1: t.z + hz }); }
      // 加油機：每個船位（31-boats.js 的 BOAT_SPOTS）上岸那一側、離船頭三公尺多，面向水面
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
      w2Inst(it.pump, pumps, 0, W2R.mid);
      W2.swapped.push('ebox', 'pump'); Object.assign(W2.n, { ebox: eboxes.length, pump: pumps.length });
      W2.pumps = pumps;
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
    // ─── 樹：行道樹是楓樹，公園、縫、岬角與灰鷗島四種混著（楓樹、兩棵垂柳、三棵一叢的橡樹）；碰撞照舊 ───
    w2Load('nat_trees', it => {
      const MIX = ['maple', 'willow_a', 'willow_b', 'oak'];
      const pick = t => (t.park ? Math.floor(w2Hash(t.x, t.z) * 4) : 0);
      const isle = ISLE_TREES.map(t => ({ ...t, park: 1 }));
      w2Group(trees, 4, pick).forEach((L, k) => w2Inst(it[MIX[k]], L, 0, TREE_R));
      w2Group(isle, 4, pick).forEach((L, k) => w2Inst(it[MIX[k]], L, 0, 700));   // 島上的樹少，從岸邊看得到
      // 程式建模的行道樹留著當遠景：只畫在 TREE_R 外（20-props 的 stream.R0），近處換成模型
      if (treeMesh.userData.stream) treeMesh.userData.stream.R0 = TREE_R - 6; else w2Drop(treeMesh);
      w2Drop(isleTreeMesh);
      W2.swapped.push('trees'); W2.n.trees = trees.length + isle.length;
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
    // ─── 北嶺：第三層山脊後面的雪山（遠景材質） ───
    w2Load('cst_mount', it => { w2Inst(it.mount, PEAKS); W2.n.peaks = PEAKS.length; }),
  ]);
}
// 驗收與截圖用的幾個位置（邏輯座標；cape 是世界座標）
W2.at = { seat: parkSeats.find(t => t.kind === 'bench'), picnic: parkSeats.find(t => t.kind === 'picnic'), news: newsBoxes[0], ebox: eboxes[0], booth: booths[0], bin: bins[0], hydrant: hydrants[0],
  palm: palms[0], guard: lifeguards[0], ferris: { x: FERRIS.cx, z: FERRIS.wz }, crane: { x: 690, z: QUAY.z1 }, yard: harbor.boxLists.flat()[0], cape: capePicnic[0], planter: planters[0], peak: PEAKS[0] };
// 驗收：程式建模的網格還掛在場景上的有幾個（以檔案開啟時應該全部都在）
// （清單在這裡先取好：模型還在下載，harbor.ship 之後會換成模型的船）
const W2_PROC = [hydrantMesh, binMesh, boothMesh, treeMesh, benchMesh, planterShrubMesh, palmMesh, guardMesh, beachUmbMesh, isleTreeMesh, ...harbor.cranes.map(c => c.proc), harbor.ship, ...harbor.boxMeshes];
W2.kept = () => W2_PROC.filter(m => m && m.parent).length;
{ const iv = setInterval(() => { if (window.__nc && window.__nc.props) { window.__nc.props.w2 = W2; clearInterval(iv); } }, 250); }
