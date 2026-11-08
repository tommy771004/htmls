// 士兵池：五個攻方、五個守方在開機建好；動畫是自製混合器（關鍵影格烘成 Float32Array），不用 AnimationGroup。
import { snapshotActive, sendWorld } from '../core/tmp.js';
// 武器以每種槍一組 thin instance 掛在手上，隱藏用零矩陣。
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { ASSET_BASE } from '../core/assets.js';
import { TMP_MAT_A, TMP_MAT_B, TMP_MAT_C, TMP_QUAT_A, TMP_VEC3_A } from '../core/tmp.js';
import meta from './soldier-meta.json' with { type: 'json' };
import { loadNewGuns, alias } from './guns/load.js';
import { NEW_GUNS } from './guns/index.js';

const FPS = 30;
let clipData = {}, clipNames = [], bones = [], boneIdx = {};
const PAR = 7;   // 每骨 7 個數：位移 3 + 四元數 4
export const pool = { atk: [], def: [] };
const guns = {};      // id → { meshes, buf, n }
const socketM = Matrix.Compose(Vector3.One(), new Quaternion(...meta.socket.quat), new Vector3(...meta.socket.pos));
const MUZZLE = { p9: [0, 0.076, 0.153], r50: [0, 0.076, 0.153], v11: [0, 0.094, 0.177], s8: [0, 0.036, 0.71], ks: [0, 0.073, 0.547], ar5: [0, 0.127, 0.609], l40: [0, 0.059, 0.862] };   // guns-meta 的槍口，槍框架座標

function bake(groups, nodeBone) {
  for (const g of groups) {
    const info = meta.clips[g.name]; if (!info) continue;
    const N = Math.max(2, Math.round(info.seconds * FPS) + 1), data = new Float32Array(N * bones.length * PAR);
    // 預設值
    for (let f = 0; f < N; f++) for (let b = 0; b < bones.length; b++) {
      const o = (f * bones.length + b) * PAR, tn = nodeBone[b], p = tn.position, q = tn.rotationQuaternion ?? Quaternion.Identity();
      data[o] = p.x; data[o + 1] = p.y; data[o + 2] = p.z; data[o + 3] = q.x; data[o + 4] = q.y; data[o + 5] = q.z; data[o + 6] = q.w;
    }
    const fps = g.targetedAnimations[0]?.animation.framePerSecond ?? 60;
    for (const ta of g.targetedAnimations) {
      const b = nodeBone.indexOf(ta.target); if (b < 0) continue;
      const a = ta.animation, keys = a.getKeys(), prop = a.targetProperty;
      if (prop !== 'position' && prop !== 'rotationQuaternion') continue;
      for (let f = 0, k = 0; f < N; f++) {
        const fr = keys[0].frame + (f / FPS) * fps;
        while (k < keys.length - 2 && keys[k + 1].frame <= fr) k++;
        const A = keys[k], B = keys[Math.min(k + 1, keys.length - 1)], t = B.frame > A.frame ? Math.min(1, Math.max(0, (fr - A.frame) / (B.frame - A.frame))) : 0;
        const o = (f * bones.length + b) * PAR;
        if (prop === 'position') { data[o] = A.value.x + (B.value.x - A.value.x) * t; data[o + 1] = A.value.y + (B.value.y - A.value.y) * t; data[o + 2] = A.value.z + (B.value.z - A.value.z) * t; }
        else { const q = Quaternion.Slerp(A.value, B.value, t); data[o + 3] = q.x; data[o + 4] = q.y; data[o + 5] = q.z; data[o + 6] = q.w; }
      }
    }
    clipData[g.name] = { data, N, dur: (N - 1) / FPS, lf: info.loopFrom ?? 0 };   // lf：循環起點，前段（下跪）只播一次
  }
  clipNames = Object.keys(clipData);
}

export async function buildSoldiers(ctx) {
  const { scene, shadow } = ctx;
  const c = await LoadAssetContainerAsync(ASSET_BASE + 'models/soldier.glb', scene, { pluginExtension: '.glb' });
  for (const m of c.materials) if (m.ambientTexture && m.metallicTexture) { m.useAmbientOcclusionFromMetallicTextureRed = false; m.ambientTexture = null; }
  for (const m of c.materials) { m.metallic = 0; m.environmentIntensity = 1.2; if (m.albedoTexture) m.albedoTexture.level = 1.2; }   // 軍裝全當非金屬；ORM 的 R 在裝備區是 0，用它當遮蔽會連日光一起乘掉，所以上面關掉
  const make = (team) => {
    const inst = c.instantiateModelsToScene(n => n, false, { doNotInstantiate: true });
    const root = inst.rootNodes[0], holder = new TransformNode('sol', scene);
    holder.rotationQuaternion = Quaternion.Identity();
    root.parent = holder;
    const meshes = root.getChildMeshes(false), keep = meshes.find(m => m.name.includes(team === 'atk' ? 'body_atk' : 'body_def'));
    for (const m of meshes) if (m !== keep) m.dispose(false, false);
    for (const g of inst.animationGroups) g.dispose();
    const sk = inst.skeletons.find(s => s === keep.skeleton) ?? inst.skeletons[0];
    keep.alwaysSelectAsActiveMesh = true; keep.doNotSyncBoundingInfo = true; keep.receiveShadows = true; keep.isPickable = false;
    shadow?.addShadowCaster?.(keep, false);
    const nodes = sk.bones.map(b => b.getTransformNode());
    for (const t of nodes) { t.rotationQuaternion ??= Quaternion.Identity(); }
    return { team, holder, root, mesh: keep, sk, nodes, agent: null,
      clipA: 'idle_rifle', tA: 0, clipB: 'idle_rifle', tB: 0, blend: 1, once: false, hidden: false, rate: 1, rateA: 1, bd: 0.14, gunM: new Matrix(), gunOn: false, sup: null, bf: sk.bones.map(b => b.getFinalMatrix()), world: new Matrix(), caps: new Float32Array(11 * 7) };
  };
  // 先用一組的骨頭順序烘動畫
  const first = make('atk');
  bones = first.sk.bones; bones.forEach((b, i) => { boneIdx[b.name] = i; });
  const map = new Map(c.animationGroups.map(g => [g.name, g]));
  bake([...map.values()], c.transformNodes.length ? bones.map(b => c.transformNodes.find(t => t.name === b.name) ?? c.meshes.find(m => m.name === b.name)) : []);
  pool.atk.push(first);
  for (let i = 1; i < 5; i++) pool.atk.push(make('atk'));
  for (let i = 0; i < 5; i++) pool.def.push(make('def'));
  for (const s of [...pool.atk, ...pool.def]) park(s);
  buildChain();
}

// 不能縮成 0：行列式不再是負的，FAST 快照會把繞序記反，士兵整個內外翻面（看到身體內側與對面的肩）
export function park(s) { s.hidden = true; s.agent = null; s.holder.scaling.setAll(1e-5); s.holder.position.set(0, -100, 0); pushWorld(s); }
function pushWorld(s) {
  s.holder.computeWorldMatrix(true); s.root.computeWorldMatrix(true); s.mesh.computeWorldMatrix(true);
  s.world.copyFrom(s.root.getWorldMatrix());
  if (snapshotActive.on) sendWorld(s.mesh);
}

// 左手執行時 IK。動畫把左手烘在槍框架 (0, HOLD_Y, HOLD_Z)，那是 AR5 的護木；其他槍要把手沿槍身滑到自己的護木（SUPPORT）。
// 手的朝向與手肘方向都沿用動畫，只解上臂、前臂兩段，手骨反向補回來，所以手形和手指不用動。
// 走 sampleTo 之後、sk.prepare 之前：先自算胸到雙手這一小段 FK，改好節點只 prepare 一次，骨架貼圖每幀仍只上傳一次。
const HOLD_Y = 0.075, HOLD_Z = 0.22;
const HOLD = { idle_rifle: 1, aim_rifle: 1, walk_rifle: 1, run_rifle: 1, back_rifle: 1, strafe_l_rifle: 1, strafe_r_rifle: 1, crouch_idle: 1, crouch_walk: 1, jump: 1, hit: 1 };   // 這些片段左手在槍上；手槍類片段、下跪、死亡不解
const SUPPORT = { v11: [0.06, 0.085], ks: [0.055, 0.27], l40: [0.02, 0.23], s8: [-0.02, 0.29] };   // 舊槍的左手支撐點 [y, z]，槍框架；新槍在 guns/<id>.js 的 support。沒列的槍（AR5）就是烘焙值，不解
export const ik = { on: true };
let chain = null;   // at：骨頭索引；up：父骨在 chain 的位置；m：預配置矩陣；hr、ua、la、ha：右手與左臂在 chain 的位置
function buildChain() {
  const set = new Set();
  for (const n of ['hand_r', 'hand_l']) for (let b = bones[boneIdx[n]]; b; b = b.getParent()) set.add(bones.indexOf(b));
  const at = [...set].sort((a, b) => a - b), pos = i => at.indexOf(i);   // Babylon 的骨頭陣列本來就是父骨在前
  chain = { at, up: at.map(i => { const p = bones[i].getParent(); return p ? pos(bones.indexOf(p)) : -1; }), m: at.map(() => new Matrix()), hr: pos(boneIdx.hand_r), ua: pos(boneIdx.upperarm_l), la: pos(boneIdx.lowerarm_l), ha: pos(boneIdx.hand_l) };
}
/** 四元數右乘：q ⊗ (x y z w)，寫回節點。 */
function rotLocal(q, x, y, z, w) { const a = q.x, b = q.y, c = q.z, d = q.w; q.copyFromFloats(d * x + a * w + b * z - c * y, d * y - a * z + b * w + c * x, d * z + a * y - b * x + c * w, d * w - a * x - b * y - c * z); }
/** 世界空間的旋轉轉成掛在這根骨頭本地、右乘的旋轉：向量部分投到骨頭的三軸，再正規化。 */
function applyDelta(node, m, x, y, z, w) {
  const a = m[0] * x + m[1] * y + m[2] * z, b = m[4] * x + m[5] * y + m[6] * z, c = m[8] * x + m[9] * y + m[10] * z, l = Math.hypot(a, b, c), v = Math.hypot(x, y, z), k = l > 1e-9 ? v / l : 0;
  rotLocal(node.rotationQuaternion, a * k, b * k, c * k, w);
}
function holdSupport(s, sup) {
  const w = (HOLD[s.clipB] ?? 0) * s.blend + (HOLD[s.clipA] ?? 0) * (1 - s.blend); if (w < 1e-3) return;
  const c = chain, N = c.at.length, F = c.m;
  for (let i = 0; i < N; i++) {
    const n = s.nodes[c.at[i]], u = c.up[i];
    if (u < 0) { Matrix.ComposeToRef(n.scaling, n.rotationQuaternion, n.position, F[i]); continue; }
    Matrix.ComposeToRef(n.scaling, n.rotationQuaternion, n.position, TMP_MAT_C);
    TMP_MAT_C.multiplyToRef(F[u], F[i]);
  }
  socketM.multiplyToRef(F[c.hr], TMP_MAT_C);
  const g = TMP_MAT_C.m, dy = (sup[0] - HOLD_Y) * w, dz = (sup[1] - HOLD_Z) * w;
  const U = F[c.ua].m, L = F[c.la].m, H = F[c.ha].m;
  const sx = U[12], sy = U[13], sz = U[14], ex = L[12] - sx, ey = L[13] - sy, ez = L[14] - sz, fx = H[12] - L[12], fy = H[13] - L[13], fz = H[14] - L[14];
  const l1 = Math.hypot(ex, ey, ez), l2 = Math.hypot(fx, fy, fz);
  let wx = H[12] + g[4] * dy + g[8] * dz - sx, wy = H[13] + g[5] * dy + g[9] * dz - sy, wz = H[14] + g[6] * dy + g[10] * dz - sz;
  const D0 = Math.hypot(wx, wy, wz), D = Math.min(D0, (l1 + l2) * 0.999), ux = wx / D0, uy = wy / D0, uz = wz / D0;
  wx = ux * D; wy = uy * D; wz = uz * D;
  const a = (l1 * l1 - l2 * l2 + D * D) / (2 * D), b = Math.sqrt(Math.max(0, l1 * l1 - a * a)), t = ex * ux + ey * uy + ez * uz;
  let vx = ex - ux * t, vy = ey - uy * t, vz = ez - uz * t; const vl = Math.hypot(vx, vy, vz); if (vl < 1e-5) return;   // 手臂全直，手肘沒有方向
  vx /= vl; vy /= vl; vz /= vl;
  const nx = (ux * a + vx * b) / l1, ny = (uy * a + vy * b) / l1, nz = (uz * a + vz * b) / l1;   // 新上臂方向
  const mx = (wx - ux * a - vx * b) / l2, my = (wy - uy * a - vy * b) / l2, mz = (wz - uz * a - vz * b) / l2;   // 新前臂方向
  // q1：舊上臂轉到新上臂；q2：舊前臂轉到新前臂。都是世界空間的最短弧。半角形式 (a×b, 1+a·b)
  const ax = ex / l1, ay = ey / l1, az = ez / l1, bx = fx / l2, by = fy / l2, bz = fz / l2;
  let q1x = ay * nz - az * ny, q1y = az * nx - ax * nz, q1z = ax * ny - ay * nx, q1w = 1 + ax * nx + ay * ny + az * nz, q = 1 / Math.hypot(q1x, q1y, q1z, q1w);
  q1x *= q; q1y *= q; q1z *= q; q1w *= q;
  let q2x = by * mz - bz * my, q2y = bz * mx - bx * mz, q2z = bx * my - by * mx, q2w = 1 + bx * mx + by * my + bz * mz; q = 1 / Math.hypot(q2x, q2y, q2z, q2w);
  q2x *= q; q2y *= q; q2z *= q; q2w *= q;
  // 上臂：q1。前臂：扣掉父骨已轉的 q1，得 q1⁻¹⊗q2。手：扣掉前臂的 q2，世界朝向就維持動畫的值
  const rw = q1w * q2w + q1x * q2x + q1y * q2y + q1z * q2z, rx = q1w * q2x - q1x * q2w - q1y * q2z + q1z * q2y, ry = q1w * q2y - q1y * q2w - q1z * q2x + q1x * q2z, rz = q1w * q2z - q1z * q2w - q1x * q2y + q1y * q2x;
  applyDelta(s.nodes[c.at[c.ua]], U, q1x, q1y, q1z, q1w);
  applyDelta(s.nodes[c.at[c.la]], L, rx, ry, rz, rw);
  applyDelta(s.nodes[c.at[c.ha]], H, -q2x, -q2y, -q2z, q2w);
}

/** 掛到 agent。 */
export function assign(s, agent) { s.agent = agent; agent.soldier = s; s.hidden = false; s.holder.scaling.setAll(1); s.clipA = s.clipB = 'idle_rifle'; s.tA = s.tB = 0; s.blend = 1; s.once = false; s.rate = s.rateA = 1; s.bd = 0.14; }

export const clipDebug = { name: '', t: -1 };   // __ol.forceClip：驗圖用，固定所有士兵的片段與時間
/** rate：片段倍速，走路跟著實際速度才不會腳滑。 */
export function play(s, name, once = false, rate = 1) {
  if (clipDebug.name) name = clipDebug.name;
  if (s.clipB === name) { s.rate = rate; return; }
  s.bd = s.clipB === 'plant' || s.clipB === 'defuse' ? 0.3 : 0.14;   // 從跪姿站起來要時間
  s.clipA = s.clipB; s.tA = s.tB; s.rateA = s.rate; s.rate = rate; s.clipB = name; s.tB = 0; s.blend = 0; s.once = once;
}
const wrap = (t, c) => (t < c.dur ? t : c.lf + (t - c.lf) % (c.dur - c.lf));

function sampleTo(s, dt) {
  const b = bones.length, A = clipData[s.clipA], B = clipData[s.clipB]; if (!A || !B) return;
  s.tA += dt * s.rateA; s.tB += dt * s.rate; s.blend = Math.min(1, s.blend + dt / s.bd);
  if (clipDebug.t >= 0) { s.tA = s.tB = clipDebug.t; s.blend = 1; }
  const fa = wrap(s.tA, A) / A.dur * (A.N - 1), ia = fa | 0, ta = fa - ia;
  const tb = s.once ? Math.min(s.tB, B.dur - 1e-3) : wrap(s.tB, B), fb = tb / B.dur * (B.N - 1), ib = fb | 0, tt = fb - ib, w = s.blend, d0 = A.data, d1 = B.data;
  const a0 = ia * b * PAR, a1 = Math.min(ia + 1, A.N - 1) * b * PAR, b0 = ib * b * PAR, b1 = Math.min(ib + 1, B.N - 1) * b * PAR;
  for (let i = 0, o = 0; i < b; i++, o += PAR) {
    const n = s.nodes[i]; if (!n) continue;
    const pA = d0[a0 + o] + (d0[a1 + o] - d0[a0 + o]) * ta, pB = d1[b0 + o] + (d1[b1 + o] - d1[b0 + o]) * tt;
    const qA = d0[a0 + o + 1], yA = d0[a0 + o + 1] + (d0[a1 + o + 1] - d0[a0 + o + 1]) * ta, yB = d1[b0 + o + 1] + (d1[b1 + o + 1] - d1[b0 + o + 1]) * tt, zA = d0[a0 + o + 2] + (d0[a1 + o + 2] - d0[a0 + o + 2]) * ta, zB = d1[b0 + o + 2] + (d1[b1 + o + 2] - d1[b0 + o + 2]) * tt;
    n.position.copyFromFloats(pA + (pB - pA) * w, yA + (yB - yA) * w, zA + (zB - zA) * w); void qA;
    let x = 0, y = 0, z = 0, ww = 0;
    for (let c = 0; c < 2; c++) {
      const dd = c ? d1 : d0, p0 = (c ? b0 : a0) + o + 3, p1 = (c ? b1 : a1) + o + 3, t = c ? tt : ta, k = c ? w : 1 - w;
      let sg = dd[p0] * dd[p1] + dd[p0 + 1] * dd[p1 + 1] + dd[p0 + 2] * dd[p1 + 2] + dd[p0 + 3] * dd[p1 + 3] < 0 ? -1 : 1;
      const qx = dd[p0] + (dd[p1] * sg - dd[p0]) * t, qy = dd[p0 + 1] + (dd[p1 + 1] * sg - dd[p0 + 1]) * t, qz = dd[p0 + 2] + (dd[p1 + 2] * sg - dd[p0 + 2]) * t, qw = dd[p0 + 3] + (dd[p1 + 3] * sg - dd[p0 + 3]) * t;
      sg = x * qx + y * qy + z * qz + ww * qw < 0 ? -k : k;
      x += qx * sg; y += qy * sg; z += qz * sg; ww += qw * sg;
    }
    const l = 1 / Math.sqrt(x * x + y * y + z * z + ww * ww);
    n.rotationQuaternion.copyFromFloats(x * l, y * l, z * l, ww * l);
  }
}

/** 槍的 thin instance：id → 所有 primitive。每位士兵固定佔第 k 格。 */
export async function buildWorldGuns(ctx) {
  const { scene } = ctx;
  const [c, more] = await Promise.all([LoadAssetContainerAsync(ASSET_BASE + 'models/guns.glb', scene, { pluginExtension: '.glb' }), loadNewGuns(scene)]);
  c.addAllToScene();
  for (const m of c.materials) if (m.ambientTexture && m.metallicTexture) { m.useAmbientOcclusionFromMetallicTextureRed = false; m.ambientTexture = null; }
  const ids = ['knife', 'p9', 'r50', 'v11', 's8', 'ks', 'ar5', 'l40', 'charge'];
  for (const m of [...c.meshes]) {     // 要複製：dispose 會改 c.meshes，邊走邊刪會跳過下一件（排在 flash 後面的 charge 就這樣被漏掉）
    if (!m.getTotalVertices()) continue;
    const id = m.name.replace(/_primitive\d+$/, '');
    if (!ids.includes(id)) { m.dispose(false, false); continue; }
    const w = m.computeWorldMatrix(true).clone();
    m.makeGeometryUnique(); m.setParent(null); m.position.setAll(0); m.rotationQuaternion = null; m.rotation.setAll(0); m.scaling.setAll(1);
    m.bakeTransformIntoVertices(w);
    const g = guns[id] ??= { meshes: [], buf: new Float32Array(11 * 16) };
    g.meshes.push(m);
  }
  // 新槍的世界模型是同一個 glb 裡減面過的 <id>_w，法線與 ORM 和第一人稱共用；模組有 TINT 的槍另有一張未壓暗的小基色圖（build_guns_hd.py 的 aw）
  for (const id in more.gun) {
    const m = more.gun[id].meshes.find(x => x.name === id + '_w'), mat = m.material, w = m.computeWorldMatrix(true).clone();
    if (mat.ambientTexture && mat.metallicTexture) { mat.useAmbientOcclusionFromMetallicTextureRed = false; mat.ambientTexture = null; }
    m.makeGeometryUnique(); m.setParent(null); m.position.setAll(0); m.rotationQuaternion = null; m.rotation.setAll(0); m.scaling.setAll(1);
    m.bakeTransformIntoVertices(w);
    guns[id] = { meshes: [m], buf: new Float32Array(11 * 16) }; MUZZLE[id] = more.index[id].muzzle;
  }
  for (const n of NEW_GUNS) if (n.support) SUPPORT[n.id] = n.support;
  for (const id in guns) for (const m of guns[id].meshes) {
    m.thinInstanceSetBuffer('matrix', guns[id].buf, 16, false);
    m.alwaysSelectAsActiveMesh = true; m.doNotSyncBoundingInfo = true; m.isPickable = false; m.receiveShadows = true; m.freezeWorldMatrix();
    // 不投影：16 種槍 × 11 格約 130 萬三角形，快照裡沒用到的格子（矩陣是 0）也照跑頂點，每層陰影都要再畫一次；
    // 槍在手上的影子幾乎看不到（2026-11-08 同頁量 GPU 少 1–2 ms）
  }
  for (const t of c.transformNodes) if (!t.getChildMeshes().length) t.dispose();
  for (const m of c.meshes) if (!m.getTotalVertices() && !m.isDisposed()) m.dispose(false, false);
}

export const chargePos = { on: false, x: 0, y: 0, z: 0 };
/** 手上那把槍的槍口世界座標。第三人稱火光用，槍不在手上回傳 false。 */
export function gunMuzzle(s, id, out) {
  const m = MUZZLE[alias[id] ?? id]; if (!m || !s.gunOn) return false;
  Vector3.TransformCoordinatesFromFloatsToRef(m[0], m[1], m[2], s.gunM, out); return true;
}
/** 每幀更新：採樣動畫、骨架、世界矩陣、手上的槍。 */
export function updateSoldiers(dt, cam) {
  let k = 0;
  for (const id in guns) guns[id].buf.fill(0);
  for (const team of ['atk', 'def']) for (let i = 0; i < 5; i++) {
    const s = pool[team][i], a = s.agent; k++;
    if (!a || s.hidden) continue;
    sampleTo(s, dt);
    s.holder.position.copyFromFloats(a.rx, a.ry, a.rz);
    Quaternion.RotationYawPitchRollToRef(a.yaw, 0, 0, TMP_QUAT_A);
    s.holder.rotationQuaternion.copyFrom(TMP_QUAT_A);
    pushWorld(s);
    const id = a.alive && !s.busy ? alias[a.cur] ?? a.cur : '', g = guns[id];
    if (SUPPORT[id]) s.sup = SUPPORT[id]; else if (s.blend >= 1) s.sup = null;   // 槍收掉後手還在淡出：撐到片段混完
    if (s.sup && ik.on) holdSupport(s, s.sup);
    s.sk.prepare(true);
    s.gunOn = !!g;
    if (g) {
      const hand = s.bf[boneIdx.hand_r];
      socketM.multiplyToRef(hand, TMP_MAT_A); TMP_MAT_A.multiplyToRef(s.world, TMP_MAT_B);
      TMP_MAT_B.copyToArray(g.buf, (k - 1) * 16);
      s.gunM.copyFrom(TMP_MAT_B);
    }
  }
  if (chargePos.on && guns.charge) { TMP_MAT_A.copyFrom(Matrix.IdentityReadOnly); TMP_MAT_A.setTranslationFromFloats(chargePos.x, chargePos.y, chargePos.z); TMP_MAT_A.copyToArray(guns.charge.buf, 10 * 16); }
  for (const id in guns) for (const m of guns[id].meshes) m.thinInstanceBufferUpdated('matrix');
}

// 命中膠囊：回傳每位士兵 11 段世界座標（ax ay az bx by bz r）
const HB = Object.entries(meta.hitbox).map(([name, h]) => ({ name, bone: h.bone, a: new Vector3(...h.a), b: new Vector3(...h.b), r: h.r, group: name === 'Head' ? 0 : name === 'Chest' ? 1 : name === 'Stomach' ? 2 : name.startsWith('Upper') || name.startsWith('Fore') ? 1 : 3 }));
export const HB_N = HB.length;
export function hbGroup(i) { return HB[i].group; }
export function hbName(i) { return HB[i].name; }
export function refreshCapsules(s) {
  for (let i = 0; i < HB.length; i++) {
    const h = HB[i], bi = boneIdx[h.bone], o = i * 7;
    s.bf[bi].multiplyToRef(s.world, TMP_MAT_C);
    Vector3.TransformCoordinatesToRef(h.a, TMP_MAT_C, TMP_VEC3_A); s.caps[o] = TMP_VEC3_A.x; s.caps[o + 1] = TMP_VEC3_A.y; s.caps[o + 2] = TMP_VEC3_A.z;
    Vector3.TransformCoordinatesToRef(h.b, TMP_MAT_C, TMP_VEC3_A); s.caps[o + 3] = TMP_VEC3_A.x; s.caps[o + 4] = TMP_VEC3_A.y; s.caps[o + 5] = TMP_VEC3_A.z;
    s.caps[o + 6] = h.r;
  }
}
export { clipData };
