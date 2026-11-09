// 第一人稱武器。全部武器與手臂在開機時建好並進快照，隱藏用極小縮放。
// 不能用零縮放：FAST 快照啟用當下行列式為 0 不算負值，Babylon 不反轉面向，錯的面向會被烘進 render bundle，槍和手整組內外翻轉。
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3, Quaternion } from '@babylonjs/core/Maths/math.vector.js';
import { ViewmodelDepthPlugin } from '../core/depthHack.js';
import { ASSET_BASE } from '../core/assets.js';
import { snapshotActive, sendWorld } from '../core/tmp.js';
import { NEW_GUNS } from './guns/index.js';
import { loadNewGuns, alias } from './guns/load.js';

const HD = new Set(['ks', 'ar5', 'l40', 'p9']);
// 每把武器的持握位置。相機座標：右、上、前（公尺），再加偏航、俯仰（度）。
// 依參考影片：槍身與視線近乎平行（槍口往畫面中心收斂），握把貼近鏡頭右下，右手大多在畫面外
const POSE = {
  ks: [0.15, -0.155, 0.18, -2, 0], ar5: [0.15, -0.16, 0.18, -2, 0], l40: [0.16, -0.175, 0.2, -2, 0],
  v11: [0.15, -0.155, 0.31, -3, 0], s8: [0.14, -0.14, 0.14, -2, 0],
  p9: [0.135, -0.125, 0.3, -8, -5], r50: [0.135, -0.13, 0.3, -8, -5],
  knife: [0.2, -0.17, 0.3, -30, 8], frag: [0.17, -0.122, 0.3, -6, 2], smoke: [0.17, -0.14, 0.3, -6, 2], flash: [0.17, -0.14, 0.3, -6, 2], charge: [0.04, -0.17, 0.34, 0, 8],
};
// 開火後座：俯仰度、後退公尺、上移、右移、翻滾度、彈簧 ω（越大越快回）
const KICK = {
  ks: [2.2, 0.026, 0.003, 0, 0.8, 24], ar5: [1.8, 0.022, 0.003, 0, 0.6, 26], v11: [1.5, 0.018, 0.002, 0, 0.8, 30],
  s8: [10, 0.07, 0.01, 0, 3, 11], l40: [8, 0.08, 0.012, 0, 2.5, 10],
  p9: [22, 0.024, 0.014, 0.012, 7, 11], r50: [30, 0.034, 0.022, 0.02, 10, 9],
  knife: [-16, -0.13, 0.02, -0.07, 14, 13], frag: [-20, -0.1, 0.05, 0, 0, 10], smoke: [-20, -0.1, 0.05, 0, 0, 10], flash: [-20, -0.1, 0.05, 0, 0, 10], charge: [0, 0, 0, 0, 0, 12],
};
const KIND = { knife: 'one', p9: 'pistol', r50: 'pistol', v11: 'pistol', s8: 'rifle', ks: 'rifle', ar5: 'rifle', l40: 'rifle', frag: 'throw', smoke: 'throw', flash: 'throw', charge: 'throw' };

const DEG = Math.PI / 180;
const HIDE = 1e-5;   // 隱藏的縮放量，z 要保持負號（見檔頭）
export const POSES = POSE;
export const vm = { CYCLE: null, anchor: null, groups: {}, cur: null, kick: 0, kickV: 0, swap: 0, swapT: 0.42, reload: 0, reloadT: 1, inspect: 0, cycle: -1, slide: 0, ch: { bolt: 0, pull: 0, lift: 0, cover: 0 }, pin: null, dry: false, bobT: 0, muzzle: null, swayX: 0, swayY: 0, lastYaw: 0, lastPitch: 0, land: 0, landV: 0, wasGround: true };

function adopt(mat, seen) {
  let c = seen.get(mat);
  if (!c) {
    c = mat.clone(mat.name + '_vm');
    if (c.ambientTexture && c.metallicTexture) { c.useAmbientOcclusionFromMetallicTextureRed = false; c.ambientTexture = null; }
    const arm = /soldier/.test(c.name);   // 手臂是布料：當金屬會映天空，轉向時忽白忽黑
    if (arm) c.metallic = 0;
    c.environmentIntensity = arm ? 1.7 : 2.4; c.directIntensity = arm ? 0.9 : 1.8; if (c.albedoTexture) { c.emissiveTexture = c.albedoTexture; c.emissiveColor.set(arm ? 0.03 : 0.3, arm ? 0.03 : 0.3, arm ? 0.03 : 0.3); } new ViewmodelDepthPlugin(c); seen.set(mat, c); seen.set(c, c);
  }
  return c;
}

// 彈匣範圍（槍座標）：x 半寬、y0、y1、z0、z1。整個零件都在範圍內才算彈匣，開機時從槍身的三角形拆出來。
const MAG = { ks: [0.02, -0.165, 0.045, 0.1, 0.23], ar5: [0.018, -0.16, 0.04, 0.09, 0.2], l40: [0.036, -0.035, 0.045, 0.1, 0.2], v11: [0.018, -0.16, 0.09, -0.03, 0.035], p9: [0.02, -0.09, -0.066, -0.065, 0.01], r50: [0.02, -0.06, -0.044, -0.05, 0.035] };
// 手槍的彈匣藏在握把裡，模型只有底板：補一段看得到的匣身。寬、高、深、上端傾斜（度）、下端中心 z
const MAG_BODY = { p9: [0.018, 0.1, 0.03, 12, -0.005], r50: [0.018, 0.09, 0.03, 12, 0.017] };
const REACH = [0.12, -0.42, -0.12];   // 換彈時手與彈匣離開畫面的位移（槍座標）
const REACH_TALL = [1, 1.5, 1.8];
const REACHES = {};   // 個別武器的 REACH，例如彈匣在頂部的 B90
const INSPECT = { ks: 0.5, ar5: 0.75 };   // 檢視前半段的轉動量：槍身長、握點靠後的槍，袖子末端會比較早掃進畫面
const ARC = {}, SLIDE = {}, TILT = {}, CYCLE = {}, SHELL = {}, BOLT_T = { ks: 0.07, ar5: 0.07 };   // 換彈傾斜、開火後手動上膛、單發裝填的秒數，欄位見 guns/index.js
// 會動的零件（槍座標 glTF，x 取反於建模座標）。沒有獨立網格：見 buildParts。舊槍的資料也寫在這裡，新槍在 guns/<id>.js 的 vm.parts
const PARTS = {
  // 舊槍沒有分組，靠範圍從 guns_hd.glb 的主網格選零件，模型不用重烘。AR5 的拉機柄是不隨動折疊片，只在換彈拉一次
  ks: [{ box: [0.0095, 0.0445, 0.0695, 0.0835, 0.1375, 0.1515], ch: 'bolt', t: [0, 0, -0.08] }, { box: [-0.0125, 0.0095, 0.0575, 0.0845, 0.0955, 0.1905], ch: 'bolt', t: [0, 0, -0.08] }],
  ar5: [{ box: [0.0085, 0.0348, 0.0692, 0.0788, 0.1185, 0.1405], ch: 'pull', t: [0, 0, -0.06] }, { box: [-0.0106, 0.0086, 0.056, 0.083, 0.0695, 0.1605], ch: 'bolt', t: [0, 0, -0.06] }],
  r50: [{ box: [-0.0165, 0.0155, 0.0485, 0.0935, -0.0395, 0.153], ch: 'bolt', t: [0, 0, -0.026] }],
  p9: [{ box: [-0.0148, 0.0148, 0.044, 0.0902, -0.0745, 0.1165], skip: [0.0086, 0.009, 0.058, 0.083, 0.005, 0.056], ch: 'bolt', t: [0, 0, -0.03] }],
}, KNOB = {};
for (const g of NEW_GUNS) { POSE[g.id] = g.vm.pose; KICK[g.id] = g.vm.kick; KIND[g.id] = g.vm.kind; if (g.vm.mag) MAG[g.id] = g.vm.mag; if (g.vm.magBody) MAG_BODY[g.id] = g.vm.magBody; if (g.vm.reach) REACHES[g.id] = g.vm.reach; if (g.vm.arc) ARC[g.id] = g.vm.arc; if (g.vm.slide) SLIDE[g.id] = g.vm.slide; if (g.vm.inspect) INSPECT[g.id] = g.vm.inspect; if (g.vm.tilt) TILT[g.id] = g.vm.tilt; if (g.vm.cycle) CYCLE[g.id] = g.vm.cycle; if (g.shell) SHELL[g.id] = g.shell; if (g.vm.parts) PARTS[g.id] = g.vm.parts; if (g.vm.knob) KNOB[g.id] = g.vm.knob; if (g.vm.boltT) BOLT_T[g.id] = g.vm.boltT; }

/** 把範圍內的零件從 mesh 拆成新網格，回傳新網格；mesh 只留其餘三角形。 */
function splitPart(mesh, box) {
  const p = mesh.getVerticesData('position'), ix = mesh.getIndices(), n = p.length / 3;
  if (!p || !ix) return null;
  const up = new Int32Array(n).map((_, i) => i), root = (i) => { while (up[i] !== i) i = up[i] = up[up[i]]; return i; };
  for (let i = 0; i < ix.length; i += 3) { up[root(ix[i])] = root(ix[i + 1]); up[root(ix[i])] = root(ix[i + 2]); }
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2]; if (Math.abs(x) > box[0] || y < box[1] || y > box[2] || z < box[3] || z > box[4]) out[root(i)] = 1; }
  const remap = new Int32Array(n).fill(-1), keep = [], part = [], old = [];
  for (let i = 0; i < ix.length; i += 3) {
    if (out[root(ix[i])]) { keep.push(ix[i], ix[i + 1], ix[i + 2]); continue; }
    for (let k = 0; k < 3; k++) { const v = ix[i + k]; if (remap[v] < 0) { remap[v] = old.length; old.push(v); } part.push(remap[v]); }
  }
  if (!part.length) return null;
  const pick = (kind, c) => { const a = mesh.getVerticesData(kind); if (!a) return null; const r = new Float32Array(old.length * c); for (let i = 0; i < old.length; i++) for (let k = 0; k < c; k++) r[i * c + k] = a[old[i] * c + k]; return r; };
  const m = new Mesh(mesh.name + '_mag', mesh.getScene()), d = new VertexData();
  d.positions = pick('position', 3); d.normals = pick('normal', 3); d.uvs = pick('uv', 2); d.indices = part;
  const t = pick('tangent', 4); if (t) d.tangents = t;
  d.applyToMesh(m, false);
  m.material = mesh.material; m.parent = mesh.parent; m.position.copyFrom(mesh.position); if (mesh.rotationQuaternion) m.rotationQuaternion = mesh.rotationQuaternion.clone(); m.scaling.copyFrom(mesh.scaling);
  mesh.setIndices(keep);
  return m;
}

/** 換彈資料：左手兩個姿勢（持握、抓彈匣）的頂點、拆出來的彈匣。單手武器只有抓彈匣姿勢。 */
function buildReload(id, holder, armL, armR, gunMeshes, magMeshes) {
  const rl = { reach: REACHES[id] ?? REACH, arc: ARC[id], arm: armL ?? armR, p0: null, n0: null, p1: armR.getVerticesData('position'), n1: armR.getVerticesData('normal'), pw: null, nw: null, vp: null, vn: null, k: -1, mags: [], base: [], dirty: true };
  if (armL) {
    rl.p0 = armL.getVerticesData('position'); rl.n0 = armL.getVerticesData('normal');
    if (rl.p0.length !== rl.p1.length) { console.warn('換彈姿勢頂點數不符', id); return null; }
    rl.pw = new Float32Array(rl.p0); rl.nw = new Float32Array(rl.n0);
    armL.markVerticesDataAsUpdatable('position'); armL.markVerticesDataAsUpdatable('normal');
    rl.vp = armL.getVertexBuffer('position'); rl.vn = armL.getVertexBuffer('normal');
  }
  rl.base = [rl.arm.position.x, rl.arm.position.y, rl.arm.position.z];
  if (magMeshes.length) rl.mags.push(...magMeshes);   // 新槍的彈匣是獨立節點 <id>_mag，不用靠範圍拆
  else for (const g of gunMeshes) { const m = splitPart(g, MAG[id]); if (m) rl.mags.push(m); }
  if (MAG_BODY[id]) {
    const [w, h, d, tilt, zc] = MAG_BODY[id], box = CreateBox(id + '_magbody', { width: w, height: h, depth: d }, holder.getScene()), y0 = MAG[id][2] - 0.012;
    const mt = new PBRMaterial('magbody', holder.getScene()); mt.albedoColor = new Color3(0.05, 0.05, 0.055); mt.metallic = 0.6; mt.roughness = 0.5;
    box.material = mt; box.parent = holder; box.position.set(0, y0 + h / 2, zc + Math.sin(tilt * DEG) * h / 2); box.rotation.x = tilt * DEG; rl.mags.push(box);
  }
  rl.magBase = rl.mags.map(m => [m.position.x, m.position.y, m.position.z]);
  return rl;
}

/** 依換彈進度擺左手與彈匣。u 是 0..1，未在換彈時傳 -1 歸位。c 是單發裝填這一發的進度，t／T 是全程的秒數：
 *  手先空手下去，再帶著這一發回到裝彈口；下去時彈殼留在槍裡，所以 mag 只在回程跟著手。 */
function poseReload(rl, u, c = -1, t = 0, T = 0) {
  let grab, off, mag, arc = 0;
  if (u < 0) { grab = 0; off = rl.p0 ? 0 : 1; mag = 0; }
  else if (c >= 0) { grab = ease(0, 0.16, t) * (1 - ease(T - 0.16, T, t)); const back = 1 - ease(0.34, 0.86, c); off = c < 0.34 ? ease(0, 0.34, c) : back; mag = c < 0.34 ? 0 : back; }
  else if (rl.arc) { grab = ease(0.1, 0.14, u) * (1 - ease(0.66, 0.7, u)); off = ease(0.2, 0.36, u) * (1 - ease(0.4, 0.54, u)); mag = off; arc = ease(0.03, 0.1, u) * (1 - ease(0.14, 0.24, u)) + ease(0.6, 0.66, u) * (1 - ease(0.7, 0.8, u)); }   // 兩個姿勢差太多，內插途中手會塌：先退到畫面外，看不到時才換姿勢
  else if (rl.p0) { grab = ease(0.04, 0.2, u) * (1 - ease(0.62, 0.78, u)); off = ease(0.2, 0.36, u) * (1 - ease(0.4, 0.54, u)); mag = off; }
  else { off = (1 - ease(0.3, 0.52, u)) + ease(0.62, 0.8, u); grab = 1; const drop = ease(0.1, 0.3, u); mag = u < 0.3 ? drop * drop : (u < 0.54 ? off : 0); }
  if (rl.p0 && Math.abs(grab - rl.k) > 1e-3) {
    rl.k = grab; const a = rl.p0, b = rl.p1, c = rl.n0, d = rl.n1, pw = rl.pw, nw = rl.nw;
    for (let i = 0; i < a.length; i++) { pw[i] = a[i] + (b[i] - a[i]) * grab; nw[i] = c[i] + (d[i] - c[i]) * grab; }
    rl.vp.update(pw); rl.vn.update(nw);
  }
  const R = rl.reach, tall = innerHeight > innerWidth, ky = tall && R[1] < 0 ? REACH_TALL[1] : 1, kz = tall ? REACH_TALL[2] : 1, kx = tall ? REACH_TALL[0] : 1;   // 直式畫面又高又窄：手與彈匣要走更遠、更靠近鏡頭才出得了畫面，不然整段換彈都掛在中段
  let ax = 0, ay = 0, az = 0;
  if (rl.arc) { const A = rl.arc; ax = A[0] * arc; ay = A[1] * arc * (tall ? 2.2 : 1); az = A[2] * arc; }
  rl.arm.position.set(rl.base[0] + R[0] * kx * off * off + ax, rl.base[1] + R[1] * ky * off + ay, rl.base[2] + R[2] * kz * off * off + az);
  for (let i = 0; i < rl.mags.length; i++) { const m = rl.mags[i], o = rl.magBase[i]; m.position.set(o[0] + R[0] * kx * mag * mag, o[1] + R[1] * ky * mag, o[2] + R[2] * kz * mag * mag); }
}

/** 手動上膛的右手：持握與抓栓柄兩個姿勢，頂點順序相同，內插方式同 poseReload。抓栓柄的姿勢只拿頂點，不進場景。 */
function buildBoltHand(id, arm, node) {
  const p0 = arm.getVerticesData('position'), n0 = arm.getVerticesData('normal'), p1 = node.getVerticesData('position'), n1 = node.getVerticesData('normal');
  node.dispose(false, false);
  if (p0.length !== p1.length) { console.warn('上膛手頂點數不符', id); return null; }
  arm.markVerticesDataAsUpdatable('position'); arm.markVerticesDataAsUpdatable('normal');
  const lever = PARTS[id].find(p => p.rc);   // 手跟著的零件：旋轉軸與後拉行程都讀它的資料
  return { arm, p0, n0, p1, n1, pw: new Float32Array(p0), nw: new Float32Array(n0), vp: arm.getVertexBuffer('position'), vn: arm.getVertexBuffer('normal'), k: 0, x: arm.position.x, y: arm.position.y, z: arm.position.z, knob: KNOB[id], axis: lever.r[1], ang: lever.r[2] * DEG, back: lever.t[2], dirty: false };
}

/** k 是手抓住栓柄的程度，dx…是握球離烘焙位置（舉起、未後拉）的位移。 */
function poseBoltHand(rb, k, dx, dy, dz) {
  if (Math.abs(k - rb.k) > 1e-3) {
    rb.k = k; const a = rb.p0, b = rb.p1, c = rb.n0, d = rb.n1, pw = rb.pw, nw = rb.nw;
    for (let i = 0; i < a.length; i++) { pw[i] = a[i] + (b[i] - a[i]) * k; nw[i] = c[i] + (d[i] - c[i]) * k; }
    rb.vp.update(pw); rb.vn.update(nw);
  }
  rb.arm.position.set(rb.x + dx * k, rb.y + dy * k, rb.z + dz * k);
}

/** 把 box 內完整的零件標成 tag。整個連通塊都在範圍內才算，skip 範圍裡的不算。 */
function markBox(p, ix, def, tag, label) {
  const n = p.length / 3, up = new Int32Array(n).map((_, i) => i), root = (i) => { while (up[i] !== i) i = up[i] = up[up[i]]; return i; }, out = new Uint8Array(n), [a, b, c, d, e, f] = def.box, sk = def.skip;
  for (let i = 0; i < ix.length; i += 3) { up[root(ix[i])] = root(ix[i + 1]); up[root(ix[i])] = root(ix[i + 2]); }
  for (let i = 0; i < n; i++) { const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2]; if (x < a || x > b || y < c || y > d || z < e || z > f || (sk && x >= sk[0] && x <= sk[1] && y >= sk[2] && y <= sk[3] && z >= sk[4] && z <= sk[5])) out[root(i)] = 1; }
  let hit = 0;
  for (let i = 0; i < n; i++) if (!out[root(i)] && label[i] < 0) { label[i] = tag; hit++; }
  return hit;
}

/** 活動零件留在主網格裡，每個都排到頂點緩衝尾端，動的時候只上傳那一段，和 poseReload 改手臂頂點同一招。
 *  draw 上限很緊，拆成獨立網格每件多 1 draw（隱藏的槍也算），所以不拆；FAST 快照下緩衝不換，bundle 不用重錄。 */
function buildParts(id, meshes) {
  const defs = PARTS[id]; if (!defs) return null;
  const out = [];
  for (const m of meshes) {
    const p = m.getVerticesData('position'), ix = m.getIndices(), n = p.length / 3, label = new Int8Array(n).fill(-1), hits = defs.map((d, k) => markBox(p, ix, d, k, label));
    if (!hits.some(Boolean)) continue;
    const order = new Int32Array(n), inv = new Int32Array(n); let w = 0;
    for (let i = 0; i < n; i++) if (label[i] < 0) order[w++] = i;
    const runs = [];
    defs.forEach((d, k) => { if (!hits[k]) return; const start = w; for (let i = 0; i < n; i++) if (label[i] === k) order[w++] = i; runs.push({ d, start, count: w - start }); });
    for (let i = 0; i < n; i++) inv[order[i]] = i;
    const turn = runs.some(r => r.d.r);
    for (const kind of m.getVerticesDataKinds()) {
      const a = m.getVerticesData(kind), c = a.length / n, r = new Float32Array(a.length);
      for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) r[i * c + k] = a[order[i] * c + k];
      m.setVerticesData(kind, r, kind === 'position' || (turn && kind === 'normal'), c);
    }
    m.setIndices(Array.from(ix, v => inv[v]));
    const pos = m.getVerticesData('position'), nor = m.getVerticesData('normal');
    for (const r of runs) {
      const q = { ...r, vp: m.getVertexBuffer('position'), vn: turn ? m.getVertexBuffer('normal') : null, p0: pos.slice(r.start * 3, (r.start + r.count) * 3), n0: nor.slice(r.start * 3, (r.start + r.count) * 3), pw: new Float32Array(r.count * 3), nw: new Float32Array(r.count * 3), k0: 0, k1: 0, axis: r.d.r ? 'xyz'.indexOf(r.d.r[0]) : -1 };
      out.push(q);
    }
  }
  return out.length ? out : null;
}

/** 依通道值擺零件：先繞軸轉（r: [軸, [軸上兩座標], 度]，通道 rc），再平移（t，通道 ch）。值沒變就不上傳。 */
function poseParts(parts) {
  const c = vm.ch;
  for (let i = 0; i < parts.length; i++) {
    const q = parts[i], d = q.d, k0 = c[d.ch] ?? 0, k1 = d.rc ? c[d.rc] ?? 0 : 0;
    if (k0 === q.k0 && k1 === q.k1) continue;
    q.k0 = k0; q.k1 = k1;
    const a = q.p0, b = q.pw, t = d.t, tx = t ? t[0] * k0 : 0, ty = t ? t[1] * k0 : 0, tz = t ? t[2] * k0 : 0, N = a.length;
    if (q.axis < 0) { for (let j = 0; j < N; j += 3) { b[j] = a[j] + tx; b[j + 1] = a[j + 1] + ty; b[j + 2] = a[j + 2] + tz; } }
    else {
      const u = q.axis, v = (u + 1) % 3, w = (u + 2) % 3, P = d.r[1], pv = P[0], pw = P[1], th = d.r[2] * DEG * k1, cs = Math.cos(th), sn = Math.sin(th), m = q.n0, o = q.nw;
      for (let j = 0; j < N; j += 3) {
        const y = a[j + v] - pv, z = a[j + w] - pw;
        b[j + u] = a[j + u]; b[j + v] = pv + y * cs - z * sn; b[j + w] = pw + y * sn + z * cs; b[j] += tx; b[j + 1] += ty; b[j + 2] += tz;
        const ny = m[j + v], nz = m[j + w]; o[j + u] = m[j + u]; o[j + v] = ny * cs - nz * sn; o[j + w] = ny * sn + nz * cs;
      }
      q.vn.updateDirectly(o, q.start * 3);
    }
    q.vp.updateDirectly(b, q.start * 3);
  }
}

export async function buildViewmodel(ctx, snapshot) {
  const { scene, camera } = ctx;
  const load = (f) => LoadAssetContainerAsync(ASSET_BASE + 'models/' + f, scene, { pluginExtension: '.glb' });
  const [hd, std, arms, more] = await Promise.all([load('guns_hd.glb'), load('guns.glb'), load('arms.glb'), loadNewGuns(scene)]);
  for (const c of [hd, std, arms]) c.addAllToScene();
  const anchor = new TransformNode('vm', scene);
  anchor.parent = camera; vm.anchor = anchor;
  anchor.rotationQuaternion = Quaternion.Identity();
  const seen = new Map(), find = (c, n) => c.transformNodes.find(t => t.name === n) ?? c.meshes.find(m => m.name === n);
  const take = (holder, node) => {
    node.parent = holder;
    const meshes = node.getChildMeshes(false); if (node.getTotalVertices?.()) meshes.push(node);
    for (const m of meshes) {
      m.material = adopt(m.material, seen); m.isPickable = false; m.alwaysSelectAsActiveMesh = true; m.doNotSyncBoundingInfo = true; m.receiveShadows = false;
    }
    return meshes;
  };
  for (const id of Object.keys(KIND)) {
    if (alias[id]) continue;   // 模型還沒做好的新槍，迴圈後指到替身
    const holder = new TransformNode('vm_' + id, scene); holder.parent = anchor;
    holder.rotationQuaternion = new Quaternion(0, 1, 0, 0); holder.scaling.set(1, 1, -1);  // glTF 根節點的翻轉
    const src = more.gun[id] ?? (HD.has(id) ? hd : std), armSrc = more.arms[id] ?? arms;
    const gun = find(src, id);
    const arm = find(armSrc, 'arms_' + id);
    const armL = find(armSrc, 'arms_' + id + '_L'), armR = find(armSrc, 'arms_' + id + '_LR');
    if (more.arms[id]) for (const n of [arm, armL, armR]) if (n) n.material = arms.materials[0];   // 新槍的手臂只帶幾何，貼圖共用 arms.glb
    const magNode = more.gun[id] && find(src, id + '_mag'), magMeshes = magNode ? take(holder, magNode) : [];
    const slideNode = more.gun[id] && SLIDE[id] && find(src, id + '_slide'), slideMeshes = slideNode ? take(holder, slideNode) : [];
    const gunMeshes = take(holder, gun), meshes = [...gunMeshes, ...magMeshes, ...slideMeshes, ...(arm ? take(holder, arm) : [])];
    let rl = null;
    if (armR) {
      const left = armL ? take(holder, armL) : take(holder, armR);
      meshes.push(...left);
      rl = buildReload(id, holder, armL, armR, gunMeshes.filter(m => m.getTotalVertices() > 0), magMeshes);
      if (rl) for (const m of rl.mags) { if (magMeshes.includes(m)) continue; m.material = adopt(m.material, seen); m.isPickable = false; m.alwaysSelectAsActiveMesh = true; m.doNotSyncBoundingInfo = true; m.receiveShadows = false; meshes.push(m); }
      if (rl) poseReload(rl, -1);
      if (armL && more.arms[id]) armR.dispose(false, false);   // 只要它的頂點。新槍的容器不走下面的 trash，留著會在世界原點多畫一隻手
    }
    const parts = buildParts(id, gunMeshes.filter(m => m.getTotalVertices() > 0));
    const rbNode = find(armSrc, 'arms_' + id + '_RB'), rb = rbNode ? buildBoltHand(id, arm, rbNode) : null;
    const mz = find(src, id + '_muzzle'), local = new Vector3();
    if (mz) { const w = mz.computeWorldMatrix(true).getTranslation(), inv = anchor.computeWorldMatrix(true).clone().invert(); Vector3.TransformCoordinatesToRef(w, inv, local); }
    vm.groups[id] = { id, holder, meshes, kind: KIND[id], muzzle: mz, muzzleLocal: local, scale: new Vector3(1, 1, -1), rl, parts, rb, slide: slideNode || null, slideZ: slideNode ? slideNode.position.z : 0 };
    holder.scaling.set(HIDE, HIDE, -HIDE);
  }
  // 替身共用舊槍的節點與換彈資料，不多畫任何東西；id 和 kind 用新槍自己的，POSE、KICK 才走得到
  for (const id in alias) vm.groups[id] = { ...vm.groups[alias[id]], id, kind: KIND[id] };
  const trash = [...hd.meshes, ...std.meshes, ...arms.meshes].filter(m => !m.parent?.name?.startsWith('vm_') && !m.name.endsWith('_primitive0') && !m.name.endsWith('_primitive1') && m.parent?.parent?.name?.startsWith?.('vm_') !== true && !m.parent?.name?.startsWith?.('vm'));
  for (const m of trash) if (!m.isDisposed() && !vm.groups[m.name]) m.dispose(false, false);
  for (const c of [hd, std, arms]) for (const t of c.transformNodes) if (t.getChildren().length === 0 && !t.name.includes('_')) t.dispose();
  vm.snapshot = snapshot;
  return vm;
}

/** 槍口世界座標，寫進 out。用開機時算好的本地點，開火時不動節點樹。 */
export function muzzleTo(out) { Vector3.TransformCoordinatesToRef(vm.cur.muzzleLocal, vm.anchor.worldMatrixFromCache, out); return out; }

export function selectWeapon(id, draw = 0) {
  const g = vm.groups[id]; if (!g || vm.cur === g) return;
  putAway();
  vm.cur = g; g.holder.scaling.copyFrom(g.scale); vm.swap = 1; vm.swapT = draw ? draw * 0.85 : g.kind === 'pistol' ? 0.32 : 0.42; vm.reload = 0; vm.inspect = 0; vm.cycle = -1; vm.kick = 0; vm.kickV = 0;   // 舉槍動畫比拔槍時間略短，槍舉穩了才能開火
}
/** 目前那把收起來：換彈、拉栓的零件姿勢歸位，縮到看不見。 */
function putAway() { if (!vm.cur) return; if (vm.cur.rl) poseReload(vm.cur.rl, -1); if (vm.cur.parts) { vm.ch.bolt = vm.ch.pull = vm.ch.lift = vm.ch.cover = 0; poseParts(vm.cur.parts); } if (vm.cur.rb) poseBoltHand(vm.cur.rb, 0, 0, 0, 0); vm.cur.holder.scaling.set(HIDE, HIDE, -HIDE); flush(vm.cur); }
/** 玩家陣亡：第一人稱的槍和手收起來，下一回合 selectWeapon 再拿出來。 */
export function hideViewmodel() { putAway(); vm.cur = null; }
/** 快照剛啟用時呼叫：啟用前換的槍沒寫進 uniform，不補的話那把會一直留在畫面上。 */
export function flushAll() { for (const id in vm.groups) flush(vm.groups[id]); }
function flush(g) {
  g.holder.computeWorldMatrix(true);
  for (let i = 0; i < g.meshes.length; i++) { const m = g.meshes[i]; m.computeWorldMatrix(true); if (snapshotActive.on) sendWorld(m); }
}

vm.CYCLE = CYCLE; vm.REACHES = REACHES; vm.ARC = ARC; vm.TILT = TILT; vm.REACH_TALL = REACH_TALL;   // 除錯：gun-reel --js 現場改數字
const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x, ease = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** 開火：給後座彈簧一個衝量。臨界阻尼下 v0 = ωe 時峰值約為 1。 */
export function fireKick() {
  const g = vm.cur; if (!g) return;
  vm.kickV += KICK[g.id][5] * 2.72; vm.inspect = 0; if (CYCLE[g.id]) vm.cycle = 0; vm.slide = 1;
}
export function startReloadAnim(t, tac = false, total = t) { vm.reload = t; vm.reloadT = total; vm.tac = tac; vm.inspect = 0; vm.cycle = -1; }
export function stopReloadAnim() { vm.reload = 0; }
/** 開新回合或買到同一把時 selectWeapon 會提早返回，換彈、上膛、檢視要另外歸零。 */
export function stopAnims() { vm.reload = 0; vm.cycle = -1; vm.inspect = 0; }
export function startInspect() { if (vm.reload <= 0 && vm.swap <= 0 && vm.cycle < 0) vm.inspect = 2.6; }

/** 每幀：跟相機走，加後座、搖晃、拔槍、換彈與檢視動畫。 */
export function updateViewmodel(dt, speed, ground, yaw, pitch) {
  const g = vm.cur; if (!g) return;
  const P = POSE[g.id], K = KICK[g.id], w = K[5];
  // 後座彈簧
  const h = Math.min(dt, 0.033) / 2;
  for (let i = 0; i < 2; i++) { vm.kickV += (-2 * w * vm.kickV - w * w * vm.kick) * h; vm.kick += vm.kickV * h; }
  const kp = vm.kick > 1.5 ? 1.5 : vm.kick;
  // 落地下沉
  if (ground && !vm.wasGround) vm.landV -= 1.6; vm.wasGround = ground;
  vm.landV += (-2 * 14 * vm.landV - 196 * vm.land) * Math.min(dt, 0.033); vm.land += vm.landV * Math.min(dt, 0.033);
  // 轉頭時槍慢半拍
  let dy = yaw - vm.lastYaw; if (dy > 3.14) dy -= 6.283; else if (dy < -3.14) dy += 6.283; let dp = pitch - vm.lastPitch; vm.lastYaw = yaw; vm.lastPitch = pitch;
  // 換算成 60 fps 一幀的轉角：擺幅不隨更新率變（120 Hz 不會只剩一半）
  const fr = 1 / (60 * (dt > 0.002 ? dt : 0.002)); dy *= fr; dp *= fr;
  const lag = 1 - Math.exp(-dt * 11), lim = 0.09;
  vm.swayX += ((dy < -lim ? -lim : dy > lim ? lim : dy) - vm.swayX) * lag; vm.swayY += ((dp < -lim ? -lim : dp > lim ? lim : dp) - vm.swayY) * lag;
  // 計時
  vm.swap = Math.max(0, vm.swap - dt / vm.swapT); vm.reload = Math.max(0, vm.reload - dt); vm.inspect = Math.max(0, vm.inspect - dt);
  vm.bobT += dt * speed * 1.9;
  const bob = ground ? Math.min(1, speed / 5.4) : 0, bx = Math.sin(vm.bobT) * 0.005 * bob, by = -Math.abs(Math.cos(vm.bobT)) * 0.006 * bob;
  // 拔槍：從右下翻上來
  const sw = vm.swap * vm.swap, dx0 = sw * 0.04, dy0 = -sw * 0.2, rP = sw * 42, rR = sw * 24;
  // 換彈：傾斜露出彈匣，中段插匣下頓一下，收尾拉機柄
  let eR = 0, eP = 0, eY = 0, eX = 0, pull = 0, lift = 0, cover = 0;
  if (vm.reload > 0) {
    const u = 1 - vm.reload / vm.reloadT, env = ease(0, 0.16, u) * (1 - ease(0.84, 1, u));
    let seat = ease(0.5, 0.56, u) * (1 - ease(0.56, 0.68, u)), bolt = vm.tac ? 0 : ease(0.76, 0.8, u) * (1 - ease(0.8, 0.88, u));   // 戰術換彈不拉機柄
    const sh = SHELL[g.id], T = vm.reloadT, t = T - vm.reload, c = sh ? (t / sh) % 1 : -1, tl = TILT[g.id];
    if (sh) { seat = ease(0.8, 0.86, c) * (1 - ease(0.86, 1, c)); bolt = 0; }   // 每一發頓一下
    pull = bolt; lift = vm.tac ? 0 : ease(0.72, 0.76, u) * (1 - ease(0.88, 0.92, u)); cover = ease(0.06, 0.16, u) * (1 - ease(0.82, 0.92, u));
    eR = (tl ? tl[0] : -26) * env; eP = (tl ? tl[1] : -13) * env + seat * 4 - bolt * 3; eY = (tl ? tl[2] : -0.04) * env - seat * 0.016; eX = (tl ? tl[3] : -0.035) * env + bolt * 0.006;
    if (g.kind === 'pistol') { eY = (g.id === 'v11' ? 0.1 : 0.06) * env - seat * 0.016; eR = -20 * env; eP = -16 * env + seat * 4; eX = -0.05 * env; }   // 手槍抬起來，彈匣口才進得了畫面
    if (g.rl) { poseReload(g.rl, u, c, t, T); g.rl.dirty = true; }
  } else if (g.rl?.dirty) { poseReload(g.rl, -1); g.rl.dirty = false; }
  // 滑套：開火往後一下，打空掛在後方，換彈收尾才放回去
  vm.slide = Math.max(0, vm.slide - dt / (BOLT_T[g.id] ?? 0.1));
  if (g.slide) {
    const p = 1 - vm.slide, back = p < 0.3 ? p / 0.3 : (1 - p) / 0.7;
    let lock = vm.dry ? 1 : 0;
    if (vm.reload > 0) lock *= 1 - ease(0.78, 0.84, 1 - vm.reload / vm.reloadT);
    g.slide.position.z = g.slideZ - SLIDE[g.id] * Math.max(vm.slide > 0 ? back : 0, lock);
  }
  // 手動上膛：開火後把槍側過來拉一次槍機。槍機在右側，畫面裡看到的是整把槍翻過來、往後一頓
  let cR = 0, cP = 0, cZ = 0, cY = 0, cX = 0, cW = 0;
  if (vm.cycle >= 0) {
    const C = CYCLE[g.id]; vm.cycle += dt;
    if (vm.cycle > C[1]) vm.cycle = -1;
    else { const k = vm.cycle, e = ease(C[0], C[0] + 0.2, k) * (1 - ease(C[1] - 0.2, C[1], k)), a = ease(C[0] + 0.26, C[0] + 0.38, k), b = ease(C[1] - 0.3, C[1] - 0.18, k); cR = C[2] * e; cP = C[3] * e; cY = C[4] * e; cX = (C[6] ?? 0) * e; cW = (C[7] ?? 0) * e; cZ = -C[5] * a * (1 - b) + (C[8] ?? 0) * e; lift = ease(C[0] + 0.16, C[0] + 0.25, k) * (1 - ease(C[1] - 0.18, C[1] - 0.1, k)); pull = a * (1 - b); }
  }
  // 活動零件：開火往後一下，打空掛在後方，換彈收尾拉一次；連發每發重新起算，所以 BOLT_T 要短於 60/rpm
  if (g.parts) {
    const p = 1 - vm.slide, back = vm.slide > 0 ? (p < 0.3 ? p / 0.3 : (1 - p) / 0.7) : 0, ch = vm.ch;
    let lock = vm.dry ? 1 : 0;
    if (vm.reload > 0) lock *= 1 - ease(0.78, 0.84, 1 - vm.reload / vm.reloadT);
    ch.bolt = Math.max(back, lock, pull); ch.pull = pull; ch.lift = lift; ch.cover = cover;
    if (vm.pin) Object.assign(ch, vm.pin);
    poseParts(g.parts);
  }
  // 右手跟著栓柄：先伸過去，再隨舉起與後拉移動（只在開火後的上膛，換彈時槍朝另一邊翻，看不到右側）
  if (g.rb) {
    const C = CYCLE[g.id], R = g.rb, on = vm.cycle >= 0 ? vm.cycle : -1;
    if (on >= 0 || R.dirty) {
      const k = on < 0 ? 0 : ease(C[0] + 0.02, C[0] + 0.16, on) * (1 - ease(C[1] - 0.1, C[1], on));
      const th = R.ang * (vm.ch.lift - 1), cs = Math.cos(th), sn = Math.sin(th), K = R.knob, x = K[0] - R.axis[0], y = K[1] - R.axis[1];
      poseBoltHand(R, k, x * cs - y * sn - x, x * sn + y * cs - y, R.back * vm.ch.pull);
      R.dirty = on >= 0;
    }
  }
  // 檢視：把槍轉過來看
  let iY = 0, iR = 0, iX = 0, iZ = 0, iH = 0;
  if (vm.inspect > 0) {
    const u = 1 - vm.inspect / 2.6, env = ease(0, 0.2, u) * (1 - ease(0.8, 1, u)), flip = ease(0.42, 0.6, u);
    const k = INSPECT[g.id] ?? 1;
    iY = (18 * k - 52 * flip) * env; iR = (-24 * k + 72 * flip) * env; iX = -0.07 * env; iZ = 0.09 * env; iH = -0.05 * env * (1 - flip);   // 手臂網格的袖口在肘部附近，翻太多或太高會把開口轉進畫面
  }
  const tall = innerHeight > innerWidth ? 1 : 0;   // 直式畫面垂直視角大，手臂要壓低，否則露出切口
  vm.anchor.position.copyFromFloats(
    P[0] * (tall ? 0.95 : 1) + bx + dx0 + eX + cX + iX + K[3] * kp - vm.swayX * 0.1,
    P[1] + by + dy0 + eY + cY + iH + K[2] * kp + vm.land * 0.04 + vm.swayY * 0.1 - tall * 0.22,
    P[2] - K[1] * kp + iZ + cZ + tall * 0.05);
  Quaternion.RotationYawPitchRollToRef(
    (P[3] + iY + cW) * DEG - vm.swayX * 0.5,
    (-P[4] - K[0] * kp + rP + eP + cP) * DEG - vm.swayY * 0.5,
    (K[4] * kp + rR + eR + iR + cR) * DEG, vm.anchor.rotationQuaternion);
  vm.anchor.computeWorldMatrix(true);
  flush(g);
}
