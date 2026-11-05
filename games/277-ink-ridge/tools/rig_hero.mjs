// 把靜態主角模型（Sketchfab：wuxia chinese swordman，xiamilisite，CC BY 4.0）加上骨架，輸出 assets/hero.glb。
// 原檔是單一網格、A 字站姿、沒有骨架。這支工具不靠 Blender：
//   1. 烘掉節點變換、縮放到 1.75 m、腳底 y=0、面向 +Z
//   2. 依網格切片量出肩、肘、腕、髖、膝、踝
//   3. 依到骨段的距離＋分區規則算蒙皮權重，再沿網格平滑
//   4. 法線、底色貼圖轉 JPEG（金屬粗糙度與自發光水墨材質用不到，丟掉）
// 骨架的靜止旋轉全是單位旋轉，所以 hero.js 可以直接把程序動畫的關節旋轉套上去。
// node tools/rig_hero.mjs [來源.glb] [輸出.glb]
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2] || join(root, 'assets/_hero-src.glb');
const out = process.argv[3] || join(root, 'assets/hero.glb');
const H = 1.75;

// ---------- 讀 GLB ----------
const b = readFileSync(src);
if (b.readUInt32LE(0) !== 0x46546c67) throw new Error('不是 GLB');
const jl = b.readUInt32LE(12);
const j = JSON.parse(b.subarray(20, 20 + jl).toString('utf8'));
const bin = b.subarray(20 + jl + 8);
const mul = (a, c) => { const r = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) for (let l = 0; l < 4; l++) r[k * 4 + i] += a[l * 4 + i] * c[k * 4 + l]; return r; };
const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const parent = {}; j.nodes.forEach((n, i) => (n.children || []).forEach((c) => { parent[c] = i; }));
const world = (i) => { const m = j.nodes[i].matrix || I4; return parent[i] != null ? mul(world(parent[i]), m) : m; };
const meshNode = j.nodes.findIndex((n) => n.mesh != null);
const W = world(meshNode);
const prim = j.meshes[0].primitives[0];
const read = (idx, n) => {
  const a = j.accessors[idx], v = j.bufferViews[a.bufferView], st = v.byteStride || n * 4, off = (v.byteOffset || 0) + (a.byteOffset || 0);
  const o = new Float32Array(a.count * n);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) o[i * n + k] = bin.readFloatLE(off + i * st + k * 4);
  return o;
};
const P0 = read(prim.attributes.POSITION, 3), N0 = read(prim.attributes.NORMAL, 3), T0 = read(prim.attributes.TANGENT, 4), UV = read(prim.attributes.TEXCOORD_0, 2);
const nv = P0.length / 3;
const ia = j.accessors[prim.indices], iv = j.bufferViews[ia.bufferView], io = (iv.byteOffset || 0) + (ia.byteOffset || 0);
const IDX = new Uint32Array(ia.count);
for (let i = 0; i < ia.count; i++) IDX[i] = ia.componentType === 5125 ? bin.readUInt32LE(io + i * 4) : ia.componentType === 5123 ? bin.readUInt16LE(io + i * 2) : bin[io + i];

// ---------- 烘掉變換、正規化 ----------
const P = new Float32Array(nv * 3), Nn = new Float32Array(nv * 3), Tn = new Float32Array(nv * 4);
const rot = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
let minY = Infinity, maxY = -Infinity;
for (let i = 0; i < nv; i++) {
  const [x, y, z] = rot(W, P0[i * 3], P0[i * 3 + 1], P0[i * 3 + 2]);
  P[i * 3] = x + W[12]; P[i * 3 + 1] = y + W[13]; P[i * 3 + 2] = z + W[14];
  minY = Math.min(minY, P[i * 3 + 1]); maxY = Math.max(maxY, P[i * 3 + 1]);
  const n = rot(W, N0[i * 3], N0[i * 3 + 1], N0[i * 3 + 2]), nl = Math.hypot(...n) || 1;
  Nn.set([n[0] / nl, n[1] / nl, n[2] / nl], i * 3);
  const t = rot(W, T0[i * 4], T0[i * 4 + 1], T0[i * 4 + 2]), tl = Math.hypot(...t) || 1;
  Tn.set([t[0] / tl, t[1] / tl, t[2] / tl, T0[i * 4 + 3]], i * 4);
}
const k = H / (maxY - minY);
// 軀幹中線的 z 當成 0
let zs = 0, zn = 0;
for (let i = 0; i < nv; i++) { const y = (P[i * 3 + 1] - minY) * k; if (y > 0.9 && y < 1.3) { zs += P[i * 3 + 2]; zn++; } }
const z0 = zs / zn;
for (let i = 0; i < nv; i++) { P[i * 3] *= k; P[i * 3 + 1] = (P[i * 3 + 1] - minY) * k; P[i * 3 + 2] = (P[i * 3 + 2] - z0) * k; }
const px = (i) => P[i * 3], py = (i) => P[i * 3 + 1], pz = (i) => P[i * 3 + 2];

// ---------- 量關節 ----------
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
function sliceCenter(y0, y1, test) {
  const q = []; for (let i = 0; i < nv; i++) if (py(i) >= y0 && py(i) < y1 && test(i)) q.push(i);
  return q.length ? { x: mean(q.map(px)), y: (y0 + y1) / 2, z: mean(q.map(pz)), n: q.length, rx: Math.max(...q.map(px)) - Math.min(...q.map(px)) } : null;
}
// 手臂：從肩下開始與身體分開（|x| 大於身體寬）
const bodyW = (y) => 0.17 + Math.max(0, (y - 1.05)) * 0.35;
const armPts = [];
for (let y = 0.84; y < 1.08; y += 0.03) { const c = sliceCenter(y, y + 0.03, (i) => px(i) > 0.3); if (c) armPts.push(c); }
// 用最小平方擬合手臂中線 x(y)、z(y)
const fit = (pts, f) => { const n = pts.length, sy = pts.reduce((s, p) => s + p.y, 0), sv = pts.reduce((s, p) => s + f(p), 0), syy = pts.reduce((s, p) => s + p.y * p.y, 0), syv = pts.reduce((s, p) => s + p.y * f(p), 0); const m = (n * syv - sy * sv) / (n * syy - sy * sy); return { m, c: (sv - m * sy) / n }; };
const fx = fit(armPts, (p) => p.x), fz = fit(armPts, (p) => p.z);
const armAt = (y) => [fx.m * y + fx.c, y, fz.m * y + fz.c];
let tipY = Infinity; for (let i = 0; i < nv; i++) if (px(i) > 0.38 && py(i) > 0.6) tipY = Math.min(tipY, py(i));
console.log('手臂切片', armPts.map((p) => [p.y, p.x, p.z].map((v) => +v.toFixed(3)).join(',')).join(' | '));
const shY = 1.36, wrY = tipY + 0.14;
const sh = armAt(shY), wr = armAt(wrY), el = [(sh[0] + wr[0]) / 2, (sh[1] + wr[1]) / 2, (sh[2] + wr[2]) / 2];
const hand = armAt(tipY + 0.07);
// 腿：腳踝與小腿切片
const leg = (y) => sliceCenter(y, y + 0.04, (i) => px(i) > 0.05 && px(i) < 0.3);
const an = leg(0.13) || { x: 0.17, z: 0 }, kn0 = leg(0.34) || { x: 0.15, z: 0 };
const hipY = 0.76;
const J = {
  hips: [0, 0.78, 0], spine: [0, 0.82, 0], neck: [0, 1.47, -0.01], head: [0, 1.53, 0.0],
  shL: sh, elL: el, handL: wr,
  shR: [-sh[0], sh[1], sh[2]], elR: [-el[0], el[1], el[2]], handR: [-wr[0], wr[1], wr[2]],
  thL: [0.1, hipY, 0], knL: [(0.1 + an.x) / 2 + 0.01, 0.42, an.z * 0.6], ftL: [an.x, 0.09, an.z],
  thR: [-0.1, hipY, 0], knR: [-(0.1 + an.x) / 2 - 0.01, 0.42, an.z * 0.6], ftR: [-an.x, 0.09, an.z],
};
void hand; void kn0;
const PARENT = { hips: null, spine: 'hips', neck: 'spine', head: 'neck', shL: 'spine', elL: 'shL', handL: 'elL', shR: 'spine', elR: 'shR', handR: 'elR', thL: 'hips', knL: 'thL', ftL: 'knL', thR: 'hips', knR: 'thR', ftR: 'knR' };
const NAMES = Object.keys(PARENT);
const TIP = { hips: 'spine', spine: 'neck', neck: 'head', head: null, shL: 'elL', elL: 'handL', handL: null, shR: 'elR', elR: 'handR', handR: null, thL: 'knL', knL: 'ftL', ftL: null, thR: 'knR', knR: 'ftR', ftR: null };
const tipOf = (n) => (TIP[n] ? J[TIP[n]] : n === 'head' ? [0, 1.75, 0] : n.startsWith('hand') ? [Math.sign(J[n][0]) * (Math.abs(J[n][0]) + 0.05), tipY, J[n][2] + 0.03] : [J[n][0], 0.02, J[n][2] + 0.14]);
console.log('關節', Object.fromEntries(NAMES.map((n) => [n, J[n].map((v) => +v.toFixed(3))])), '手尖 y', tipY.toFixed(3));

// ---------- 權重 ----------
const segD = (p, a, c) => {
  const ab = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1)));
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
};
const WW = new Float32Array(nv * NAMES.length);
for (let i = 0; i < nv; i++) {
  const p = [px(i), py(i), pz(i)], x = p[0], y = p[1], ax = Math.abs(x), side = x >= 0 ? 'L' : 'R', sgn = x >= 0 ? 1 : -1;
  const line = [fx.m * y + fx.c, fz.m * y + fz.c]; // 手臂中線
  const armD = Math.hypot(ax - line[0], p[2] - line[1]);
  const isArm = y > tipY - 0.01 && y < 1.5 && ax > 0.2 && (y > 1.12 ? ax > bodyW(y) - 0.02 : armD < 0.13);
  for (let n = 0; n < NAMES.length; n++) {
    const nm = NAMES[n], d = Math.max(0.015, segD(p, J[nm], tipOf(nm)));
    let w = 1 / d ** 4;
    if (nm === 'head') w = y > 1.5 ? 1e9 : y > 1.44 ? 1 / d ** 4 : 0;
    else if (nm === 'neck') w = y > 1.5 || y < 1.4 ? 0 : w * 0.6;
    else if (y > 1.5) w = 0;
    else if (/^(sh|el|hand)/.test(nm)) w = isArm && nm.endsWith(side) ? w : 0;
    else if (/^(th|kn|ft)/.test(nm)) { if (y > hipY + 0.05 || x * (nm.endsWith('L') ? 1 : -1) < -0.015) w = 0; if (isArm) w = 0; if (nm.startsWith('ft') && y > 0.14) w = 0; }
    else if (nm === 'hips') { if (y < hipY - 0.14 || y > 0.98 || (isArm && ax > 0.34)) w = 0; }
    else if (nm === 'spine') { if (y < hipY - 0.02 || (isArm && ax > bodyW(y) + 0.06)) w = 0; }
    WW[i * NAMES.length + n] = w;
    void sgn;
  }
  let s = 0; for (let n = 0; n < NAMES.length; n++) s += WW[i * NAMES.length + n];
  if (s <= 0) { WW[i * NAMES.length + (y > 0.76 ? 1 : 0)] = 1; s = 1; }
  for (let n = 0; n < NAMES.length; n++) WW[i * NAMES.length + n] /= s;
}
// 沿網格平滑：先把同位置的頂點（UV 接縫）合併，平滑後接縫不會裂開
const posKey = new Map(), weld = new Int32Array(nv);
for (let i = 0; i < nv; i++) { const key = `${Math.round(px(i) * 2e3)},${Math.round(py(i) * 2e3)},${Math.round(pz(i) * 2e3)}`; if (!posKey.has(key)) posKey.set(key, i); weld[i] = posKey.get(key); }
const nbr = Array.from({ length: nv }, () => new Set());
for (let t = 0; t < IDX.length; t += 3) for (let e = 0; e < 3; e++) { const a = weld[IDX[t + e]], c = weld[IDX[t + (e + 1) % 3]]; if (a !== c) { nbr[a].add(c); nbr[c].add(a); } }
// 斗笠是獨立的一塊：找出含最高點的連通區，水平放大到參考影片的寬度（約 1.25 倍肩寬）
const HAT_R = 0.35;
{
  let top = 0; for (let i = 0; i < nv; i++) if (py(i) > py(top)) top = i;
  const seen = new Uint8Array(nv), st = [weld[top]]; seen[weld[top]] = 1;
  while (st.length) { const a = st.pop(); for (const c of nbr[a]) if (!seen[c]) { seen[c] = 1; st.push(c); } }
  let cnt = 0, cx = 0, cz = 0, r = 0;
  for (let i = 0; i < nv; i++) if (seen[weld[i]]) { cnt++; cx += px(i); cz += pz(i); }
  cx /= cnt; cz /= cnt;
  for (let i = 0; i < nv; i++) if (seen[weld[i]]) r = Math.max(r, Math.hypot(px(i) - cx, pz(i) - cz));
  if (cnt < nv * 0.25 && r > 0.1) {
    const s = HAT_R / r;
    for (let i = 0; i < nv; i++) if (seen[weld[i]]) { P[i * 3] = cx + (P[i * 3] - cx) * s; P[i * 3 + 2] = cz + (P[i * 3 + 2] - cz) * s; }
    console.log(`斗笠：${cnt} 頂點，半徑 ${r.toFixed(3)} → ${HAT_R}`);
  } else console.log(`斗笠沒有分離（${cnt} 頂點、半徑 ${r.toFixed(3)}），不放大`);
}
const NJ = NAMES.length, headI = NAMES.indexOf('head');
for (let it = 0; it < 3; it++) {
  const nw = WW.slice();
  for (let i = 0; i < nv; i++) {
    if (weld[i] !== i || !nbr[i].size) continue;
    if (WW[i * NJ + headI] > 0.999 && py(i) > 1.56) continue; // 斗笠全跟頭
    for (let n = 0; n < NJ; n++) { let s = 0; for (const q of nbr[i]) s += WW[q * NJ + n]; nw[i * NJ + n] = WW[i * NJ + n] * 0.5 + (s / nbr[i].size) * 0.5; }
  }
  WW.set(nw);
}
// ---------- 手指：連通區分出五指，每指三節骨頭 ----------
const dot3 = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
const sub3 = (a, c) => [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
const add3 = (a, c, t = 1) => [a[0] + c[0] * t, a[1] + c[1] * t, a[2] + c[2] * t];
const cross3 = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]];
const norm3 = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const handRig = {};
const fingerOf = new Map(); // 頂點 → { side, f, s(0..1) }
const handVerts = { L: [], R: [] };
const scene_J = J; // 新關節加進 J、PARENT
for (const [side, sg] of [['L', 1], ['R', -1]]) {
  const w = J['hand' + side], elb = J['el' + side];
  const e0 = norm3(sub3(w, elb));
  const near = [];
  for (let i = 0; i < nv; i++) {
    if (x_side(i) * sg <= 0.3 || py(i) > 1.05 || py(i) < 0.6) continue;
    const d = sub3([px(i), py(i), pz(i)], w), t = dot3(d, e0), r = Math.hypot(...sub3(d, [e0[0] * t, e0[1] * t, e0[2] * t]));
    if (t > -0.1 && r < 0.2) near.push(i);
  }
  const c = [0, 1, 2].map((q) => near.reduce((a, i) => a + P[i * 3 + q], 0) / near.length);
  const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const i of near) { const q = sub3([px(i), py(i), pz(i)], c); for (let r = 0; r < 3; r++) for (let u = 0; u < 3; u++) cov[r][u] += q[r] * q[u] / near.length; }
  const pow = (M, x) => { for (let i = 0; i < 40; i++) x = norm3(M.map((r) => dot3(r, x))); return x; };
  let e1 = pow(cov, e0); if (dot3(e1, e0) < 0) e1 = e1.map((v) => -v);
  const l1 = dot3(cov.map((r) => dot3(r, e1)), e1);
  let e2 = pow(cov.map((r, i) => r.map((v, u) => v - l1 * e1[i] * e1[u])), [0, -0.1, 1]);
  if (e2[2] < 0) e2 = e2.map((v) => -v);          // 拇指側朝前
  let e3 = norm3(cross3(e1, e2)); if (e3[0] * sg > 0) e3 = e3.map((v) => -v); // 掌心朝身體
  const coord = (i) => { const d = sub3([px(i), py(i), pz(i)], w); return [dot3(d, e1), dot3(d, e2), dot3(d, e3)]; };
  const isHand = new Set(near.filter((i) => coord(i)[0] > -0.02));
  const free = new Set();
  for (const i of isHand) { const q = coord(i); if (q[0] > 0.082 || (q[0] > 0.04 && q[1] > 0.052)) free.add(weld[i]); }
  const done = new Set(), comps = [];
  for (const i of free) {
    if (done.has(i)) continue;
    const st = [i], cm = [i]; done.add(i);
    while (st.length) { const a = st.pop(); for (const q of nbr[a]) if (free.has(q) && !done.has(q)) { done.add(q); st.push(q); cm.push(q); } }
    if (cm.length >= 12) comps.push(cm);
  }
  const fins = comps.map((cm) => {
    const qs = cm.map((i) => ({ i, q: coord(i) }));
    const tMin = Math.min(...qs.map((o) => o.q[0]));
    const baseV = qs.filter((o) => o.q[0] < tMin + 0.012);
    const b0 = [0, 1, 2].map((u) => baseV.reduce((a, o) => a + P[o.i * 3 + u], 0) / baseV.length);
    let tip = qs[0], far = 0;
    for (const o of qs) { const d = Math.hypot(...sub3([px(o.i), py(o.i), pz(o.i)], b0)); if (d > far) { far = d; tip = o; } }
    const tp = [px(tip.i), py(tip.i), pz(tip.i)];
    const dir = norm3(sub3(tp, b0));
    const base = add3(b0, dir, -0.016);
    const len = Math.hypot(...sub3(tp, base));
    return { cm, base, dir, len, y2: qs.reduce((a, o) => a + o.q[1], 0) / qs.length };
  }).sort((a, c2) => c2.y2 - a.y2);
  console.log(`${side} 手：${fins.length} 指`, fins.map((f) => `${f.cm.length}頂點 長${f.len.toFixed(3)} 寬位${f.y2.toFixed(3)}`).join(' / '));
  const rec = { e1, e2, e3, fingers: [] };
  fins.forEach((f, idx) => {
    const thumb = idx === 0;
    const toward = thumb ? norm3(add3(e3.map((v) => v * 0.75), e2, -0.65)) : e3;
    const axis = norm3(cross3(f.dir, toward));
    const fan = Math.atan2(dot3(cross3(f.dir, e1), e3), dot3(f.dir, e1)); // 把手指收攏到手軸方向要轉的角度
    const names = ['a', 'b', 'c'].map((n) => `f${side}${idx}${n}`);
    const cuts = [0, 0.38, 0.7];
    let prev = 'hand' + side;
    names.forEach((n, q) => { J[n] = add3(f.base, f.dir, f.len * cuts[q]); PARENT[n] = prev; prev = n; });
    rec.fingers.push({ thumb, names, axis, normal: e3, fan: thumb ? 0 : fan });
    for (const v of f.cm) {
      const sv = dot3(sub3([px(v), py(v), pz(v)], f.base), f.dir) / f.len;
      fingerOf.set(v, { side, names, s: sv, cuts });
    }
  });
  handRig[side] = rec;
  for (const i of isHand) handVerts[side].push({ i, t: coord(i)[0] });
}
function x_side(i) { return px(i); }
void scene_J;
const ALL = Object.keys(PARENT);
const NA = ALL.length;
console.log('骨頭總數', NA);

const JOINTS = new Uint8Array(nv * 4), WEIGHTS = new Float32Array(nv * 4);
const count = new Array(NJ).fill(0);
for (let i = 0; i < nv; i++) {
  const src = weld[i] * NJ;
  const o = Array.from({ length: NJ }, (_, n) => [WW[src + n], n]).sort((a, c) => c[0] - a[0]).slice(0, 4);
  const s = o.reduce((a, c) => a + c[0], 0) || 1;
  o.forEach(([w, n], q) => { JOINTS[i * 4 + q] = n; WEIGHTS[i * 4 + q] = w / s; });
  count[o[0][1]]++;
}
console.log('主要骨頭頂點數', Object.fromEntries(NAMES.map((n, i) => [n, count[i]])));
// 手部覆寫：手掌全跟手骨（手腕處與前臂混合），手指依位置分給三節，交界處混合
const setW = (i, list) => { const s0 = list.reduce((a, c) => a + c[1], 0); for (let q = 0; q < 4; q++) { JOINTS[i * 4 + q] = q < list.length ? ALL.indexOf(list[q][0]) : 0; WEIGHTS[i * 4 + q] = q < list.length ? list[q][1] / s0 : 0; } };
for (const side of ['L', 'R']) {
  const hand = 'hand' + side, el2 = 'el' + side;
  for (const { i, t } of handVerts[side]) {
    const f = fingerOf.get(weld[i]);
    if (f) {
      const { names, s: sv, cuts } = f, soft = 0.09;
      const list = [];
      const seg = (a2, c2) => Math.max(0, Math.min(1, (sv - a2 + soft) / (2 * soft))) * (1 - Math.max(0, Math.min(1, (sv - c2 + soft) / (2 * soft))));
      const wh = 1 - Math.max(0, Math.min(1, (sv + soft) / (2 * soft))), w0 = seg(cuts[0], cuts[1]), w1 = seg(cuts[1], cuts[2]), w2 = Math.max(0, Math.min(1, (sv - cuts[2] + soft) / (2 * soft)));
      if (wh > 0.001) list.push([hand, wh]); if (w0 > 0.001) list.push([names[0], w0]); if (w1 > 0.001) list.push([names[1], w1]); if (w2 > 0.001) list.push([names[2], w2]);
      setW(i, list.length ? list : [[names[0], 1]]);
    } else if (t > 0.012) setW(i, [[hand, 1]]);
    else { const k2 = Math.max(0, Math.min(1, (t + 0.03) / 0.042)); setW(i, [[hand, k2], [el2, 1 - k2]]); }
  }
}

// ---------- 貼圖 ----------
const imgOf = (tex) => { const im = j.images[j.textures[tex.index].source], v = j.bufferViews[im.bufferView]; return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); };
const dir = mkdtempSync(join(tmpdir(), 'hero-tex-'));
const jpeg = (name, buf, q) => {
  const a = join(dir, name + '.png'), c = join(dir, name + '.jpg');
  writeFileSync(a, buf);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(q), a, '--out', c], { stdio: 'ignore' });
  return readFileSync(c);
};
const mat = j.materials[0];
const baseJ = jpeg('base', imgOf(mat.pbrMetallicRoughness.baseColorTexture), 86);
const normJ = jpeg('norm', imgOf(mat.normalTexture), 88);
rmSync(dir, { recursive: true, force: true });

// ---------- 寫 GLB ----------
const IDX16 = Uint16Array.from(IDX);
if (nv > 65535) throw new Error('頂點太多');
const chunks = []; let off = 0;
const views = [];
const add = (buf, target) => {
  const u = Buffer.from(buf.buffer ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : buf);
  const v = { buffer: 0, byteOffset: off, byteLength: u.length }; if (target) v.target = target;
  views.push(v); chunks.push(u); off += u.length;
  const pad = (4 - (off % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); off += pad; }
  return views.length - 1;
};
const accessors = [];
const acc = (view, type, ct, count, extra = {}) => { accessors.push({ bufferView: view, componentType: ct, type, count, ...extra }); return accessors.length - 1; };
const mm = (a, n) => { const lo = new Array(n).fill(Infinity), hi = new Array(n).fill(-Infinity); for (let i = 0; i < a.length; i += n) for (let q = 0; q < n; q++) { lo[q] = Math.min(lo[q], a[i + q]); hi[q] = Math.max(hi[q], a[i + q]); } return { min: lo, max: hi }; };
const aI = acc(add(IDX16, 34963), 'SCALAR', 5123, IDX16.length);
const aP = acc(add(P, 34962), 'VEC3', 5126, nv, mm(P, 3));
const aN = acc(add(Nn, 34962), 'VEC3', 5126, nv);
const aT = acc(add(Tn, 34962), 'VEC4', 5126, nv);
const aU = acc(add(UV, 34962), 'VEC2', 5126, nv);
const aJ = acc(add(JOINTS, 34962), 'VEC4', 5121, nv);
const aW = acc(add(WEIGHTS, 34962), 'VEC4', 5126, nv);
const IBM = new Float32Array(16 * NA);
ALL.forEach((n, i) => { IBM.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -J[n][0], -J[n][1], -J[n][2], 1], i * 16); });
const aB = acc(add(IBM), 'MAT4', 5126, NA);
const vB = add(baseJ), vN = add(normJ);
const nodes = ALL.map((n) => {
  const p = PARENT[n] ? J[PARENT[n]] : [0, 0, 0];
  return { name: n, translation: [J[n][0] - p[0], J[n][1] - p[1], J[n][2] - p[2]], children: ALL.map((c, i) => (PARENT[c] === n ? i : -1)).filter((i) => i >= 0) };
});
for (const n of nodes) if (!n.children.length) delete n.children;
nodes.push({ name: 'hero', mesh: 0, skin: 0 });
const gltf = {
  asset: { version: '2.0', generator: 'tools/rig_hero.mjs', extras: { ...j.asset.extras, modified: '加骨架與蒙皮、換算尺寸、貼圖轉 JPEG' } },
  scene: 0,
  scenes: [{ nodes: [0, NA], extras: { rig: { joints: J, tipY, hands: handRig } } }],
  nodes, skins: [{ joints: ALL.map((_, i) => i), inverseBindMatrices: aB, skeleton: 0 }],
  meshes: [{ name: 'hero', primitives: [{ attributes: { POSITION: aP, NORMAL: aN, TANGENT: aT, TEXCOORD_0: aU, JOINTS_0: aJ, WEIGHTS_0: aW }, indices: aI, material: 0 }] }],
  materials: [{ name: 'hero', doubleSided: true, pbrMetallicRoughness: { baseColorTexture: { index: 0 }, roughnessFactor: 1, metallicFactor: 0 }, normalTexture: { index: 1 } }],
  textures: [{ sampler: 0, source: 0 }, { sampler: 0, source: 1 }],
  samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
  images: [{ bufferView: vB, mimeType: 'image/jpeg' }, { bufferView: vN, mimeType: 'image/jpeg' }],
  accessors, bufferViews: views, buffers: [{ byteLength: off }],
};
let js = Buffer.from(JSON.stringify(gltf)); if (js.length % 4) js = Buffer.concat([js, Buffer.alloc(4 - (js.length % 4), 0x20)]);
const body = Buffer.concat(chunks);
const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + body.length, 8);
const c1 = Buffer.alloc(8); c1.writeUInt32LE(js.length, 0); c1.writeUInt32LE(0x4e4f534a, 4);
const c2 = Buffer.alloc(8); c2.writeUInt32LE(body.length, 0); c2.writeUInt32LE(0x004e4942, 4);
writeFileSync(out, Buffer.concat([head, c1, js, c2, body]));
console.log(`${out}: ${((12 + 16 + js.length + body.length) / 1048576).toFixed(2)} MB（底色 ${(baseJ.length / 1024).toFixed(0)} KB、法線 ${(normJ.length / 1024).toFixed(0)} KB）`);
