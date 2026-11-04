// 外部模型管線：tools/models.json 列的每一件 → 讀 .cache/models/ 的原檔 → 減面、縮貼圖轉 webp、正規化
// → 每件包成名為 m_<id> 的根節點 → 依 group 合併輸出 blender/out/<group>.glb（build.mjs 會自動 gzip＋base64 內嵌）。
//
// 用法：npm run models [-- --only=arch,props] [--id=qp_hall,arm_dao] [--dry]
//   --only 只重建指定 group；--id 只處理指定件（輸出到 dist/models-test-<group>.glb，不蓋 blender/out）；--no-simplify 不減面（除錯用）。
//
// 正規化（每件，依 models.json 的欄位）：
//   rot      [x, y, z] 度，先轉（修正原檔的上軸／正面）。正面一律朝 +Z。
//   pca      true：兵器用。依主成分把最長軸轉到 +Y、次長軸轉到 +Z（再套 rot／flip 修正）。
//   dropMaterials  正規式：材質名相符的 primitive 整個刪掉（地台、展示底座）。
//   flags    meshoptimizer simplify 旗標（例如 ['Prune'] 會刪掉小的分離零件）；noPermissive／sloppy:false 關掉放寬的後備。
//   crop     { x:[a,b], y:[a,b], z:[a,b] }：在轉正後的包圍盒內以 0..1 比例裁掉三角形（質心在範圍外者刪除）。
//   cut      [{ x, y, z }, ...]：同樣的比例座標，質心落在任一盒內的三角形刪除。
//   cutParts [{ x, y, z }, ...]：以頂點位置相連的零件，整塊包圍盒中心落在盒內就整塊刪除（掃描裡的樹、告示牌）。
//   fit      { h } 高度（公尺）｜{ w } 水平最大邊｜{ d } 三軸最大邊｜{ scale } 原單位直接乘｜{ len, grip } 兵器全長＋握把位置（0..1，從尾端算）
//   一般件：y=0 著地、x/z 置中；兵器（有 grip）：x/z 置中、握把中心在原點、+Y 指向尖端（weapons.js 的握把座標系）。
//
// 依賴：@gltf-transform 4.5.1、meshoptimizer、sharp 借用 ../197-openworld/node_modules（MODELS_DEPS 可改路徑）。
// Draco 原檔不在管線裡解：models.json 的 file 指到 .cache/models/_decoded/ 裡已解碼的檔（見 notes）。
// 有 prep 欄位的件（Draco 解碼、Blender 烘焙成單一材質）先跑 node tools/prep-models.mjs 產生 _decoded／_baked 中間檔；.cache/ 不進 git。
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(process.env.MODELS_DEPS || resolve(root, '../197-openworld'), 'package.json'));
const { NodeIO, Document, Logger } = req('@gltf-transform/core');
const quiet = new Logger(Logger.Verbosity.WARN);
const { ALL_EXTENSIONS, EXTTextureWebP } = req('@gltf-transform/extensions');
const F = req('@gltf-transform/functions');
const { MeshoptDecoder, MeshoptSimplifier } = req('meshoptimizer');
const sharp = req('sharp');
await MeshoptDecoder.ready;
await MeshoptSimplifier.ready;

const CACHE = resolve(root, '.cache/models');
const OUT = resolve(root, 'blender/out');
const DIST = resolve(root, 'dist');
const arg = (k) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3).split(',').filter(Boolean) : null; };
const onlyGroups = arg('only');
const onlyIds = arg('id');
const dry = process.argv.includes('--dry');
const noSimplify = process.argv.includes('--no-simplify'); // 除錯：看原始面數下的樣子（貼圖問題還是減面問題）

const io = new NodeIO().setLogger(quiet).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const KEEP_EXT = new Set(['KHR_mesh_quantization', 'EXT_texture_webp', 'KHR_texture_transform', 'KHR_materials_emissive_strength']);
const spec = JSON.parse(readFileSync(resolve(root, 'tools/models.json'), 'utf8'));
const DEF = spec.defaults || {};
const items = spec.models.filter((m) => !m.skip && (!onlyGroups || onlyGroups.includes(m.group)) && (!onlyIds || onlyIds.includes(m.id)));
const groups = [...new Set(items.map((m) => m.group))];

// ── 小工具：4×4 欄主序矩陣 ──
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const I4 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const T4 = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const S4 = (s) => [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1];
const fromRows = (rx, ry, rz) => [rx[0], ry[0], rz[0], 0, rx[1], ry[1], rz[1], 0, rx[2], ry[2], rz[2], 0, 0, 0, 0, 1];
function R4([ax = 0, ay = 0, az = 0]) {
  const r = (d) => (d * Math.PI) / 180;
  const cx = Math.cos(r(ax)), sx = Math.sin(r(ax)), cy = Math.cos(r(ay)), sy = Math.sin(r(ay)), cz = Math.cos(r(az)), sz = Math.sin(r(az));
  const X = [1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1];
  const Y = [cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1];
  const Z = [cz, sz, 0, 0, -sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  return mul(Z, mul(Y, X)); // 先 X、再 Y、再 Z
}

const meshNodes = (doc) => doc.getRoot().listNodes().filter((n) => n.getMesh());
const prims = (doc) => doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
const triCount = (doc) => prims(doc).reduce((s, p) => s + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0);

function bounds(doc) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of prims(doc)) {
    const a = p.getAttribute('POSITION').getArray();
    for (let i = 0; i < a.length; i += 3) for (let k = 0; k < 3; k++) { const v = a[i + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
  }
  return { min, max, size: max.map((v, i) => v - min[i]) };
}

function ensureIndices(doc, p) {
  if (p.getIndices()) return;
  const n = p.getAttribute('POSITION').getCount();
  const idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  p.setIndices(doc.createAccessor().setType('SCALAR').setArray(idx).setBuffer(doc.getRoot().listBuffers()[0]));
}

// 主成分：回傳列向量 e1（最大變異）、e2、e3
function pcaAxes(doc) {
  let n = 0; const m = [0, 0, 0];
  for (const p of prims(doc)) { const a = p.getAttribute('POSITION').getArray(); for (let i = 0; i < a.length; i += 3) { m[0] += a[i]; m[1] += a[i + 1]; m[2] += a[i + 2]; n++; } }
  m[0] /= n; m[1] /= n; m[2] /= n;
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of prims(doc)) {
    const a = p.getAttribute('POSITION').getArray();
    for (let i = 0; i < a.length; i += 3) { const d = [a[i] - m[0], a[i + 1] - m[1], a[i + 2] - m[2]]; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[r][c] += d[r] * d[c]; }
  }
  // Jacobi
  const A = C.map((r) => r.slice()); const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let it = 0; it < 50; it++) {
    let p = 0, q = 1; for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) if (Math.abs(A[i][j]) > Math.abs(A[p][q])) { p = i; q = j; }
    if (Math.abs(A[p][q]) < 1e-12) break;
    const th = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]); const c = Math.cos(th), s = Math.sin(th);
    for (let k = 0; k < 3; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
    for (let k = 0; k < 3; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
    for (let k = 0; k < 3; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
  }
  const order = [0, 1, 2].sort((i, j) => A[j][j] - A[i][i]);
  return order.map((i) => [V[0][i], V[1][i], V[2][i]]);
}

function applyMatrix(doc, M) { for (const mesh of doc.getRoot().listMeshes()) F.transformMesh(mesh, M); }

function cropTris(doc, it, bb) {
  const box = (b) => [0, 1, 2].map((k) => (b['xyz'[k]] || [0, 1]).map((f) => bb.min[k] + f * bb.size[k]));
  const keepBox = it.crop ? box(it.crop) : null;
  const cuts = (it.cut || []).map(box);
  const partCuts = (it.cutParts || []).map(box);
  const inside = (L, c) => c.every((v, k) => v >= L[k][0] && v <= L[k][1]);
  for (const p of prims(doc)) {
    ensureIndices(doc, p);
    const pos = p.getAttribute('POSITION').getArray(); const idx = p.getIndices().getArray();
    const dropTri = partCuts.length ? partsInside(pos, idx, partCuts, inside) : null;
    const keep = [];
    for (let t = 0; t < idx.length; t += 3) {
      const c = [0, 1, 2].map((k) => (pos[idx[t] * 3 + k] + pos[idx[t + 1] * 3 + k] + pos[idx[t + 2] * 3 + k]) / 3);
      if ((dropTri && dropTri[t / 3]) || (keepBox && !inside(keepBox, c)) || cuts.some((L) => inside(L, c))) continue;
      keep.push(idx[t], idx[t + 1], idx[t + 2]);
    }
    if (!keep.length) { p.dispose(); continue; }
    p.getIndices().setArray(new Uint32Array(keep));
    F.compactPrimitive(p);
  }
}

// 連通零件（以頂點位置相連）中心落在盒內者整塊標記刪除：掃描裡的樹、告示牌常是獨立零件
function partsInside(pos, idx, boxes, inside) {
  const key = new Map(); const id = new Int32Array(pos.length / 3);
  for (let v = 0; v < id.length; v++) { const k = `${pos[v * 3].toFixed(4)},${pos[v * 3 + 1].toFixed(4)},${pos[v * 3 + 2].toFixed(4)}`; if (!key.has(k)) key.set(k, key.size); id[v] = key.get(k); }
  const par = new Int32Array(key.size).map((_, i) => i);
  const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
  for (let t = 0; t < idx.length; t += 3) { const a = find(id[idx[t]]), b = find(id[idx[t + 1]]), c = find(id[idx[t + 2]]); par[b] = a; par[find(c)] = a; }
  const mn = new Map(), mx = new Map();
  for (let v = 0; v < id.length; v++) {
    const r = find(id[v]); const p = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
    if (!mn.has(r)) { mn.set(r, p.slice()); mx.set(r, p.slice()); } else { const a = mn.get(r), b = mx.get(r); for (let k = 0; k < 3; k++) { if (p[k] < a[k]) a[k] = p[k]; if (p[k] > b[k]) b[k] = p[k]; } }
  }
  const drop = new Set();
  for (const [r, a] of mn) { const b = mx.get(r); const c = a.map((v, k) => (v + b[k]) / 2); if (boxes.some((L) => inside(L, c))) drop.add(r); }
  const out = new Uint8Array(idx.length / 3);
  for (let t = 0; t < idx.length; t += 3) if (drop.has(find(id[idx[t]]))) out[t / 3] = 1;
  return out;
}

// 減面：先一般 simplify（error 上限），不到目標就放寬成 Permissive（可跨 UV 縫），再不到就 sloppy
function simplifyDoc(doc, target, it) {
  const before = triCount(doc);
  if (!target || before <= target * 1.05) return 'none';
  let mode = 'simplify';
  const run = (flags, errLimit, sloppy) => {
    const ratio = Math.min(1, target / triCount(doc)); // 每一輪依目前的面數重算，不然第二輪會減過頭
    for (const p of prims(doc)) {
      ensureIndices(doc, p);
      const pos = p.getAttribute('POSITION').getArray();
      const f32 = pos instanceof Float32Array ? pos : new Float32Array(pos);
      const idx = new Uint32Array(p.getIndices().getArray());
      const want = Math.max(3, Math.floor((idx.length / 3) * ratio) * 3);
      if (idx.length <= want) continue;
      const [out] = sloppy
        ? MeshoptSimplifier.simplifySloppy(idx, f32, 3, null, want, errLimit)
        : MeshoptSimplifier.simplify(idx, f32, 3, want, errLimit, flags);
      if (out.length < 3) { p.dispose(); continue; }
      p.getIndices().setArray(out);
      F.compactPrimitive(p);
    }
  };
  run(it.flags || (it.lockBorder ? ['LockBorder'] : []), it.error ?? DEF.error ?? 0.05, false);
  if (triCount(doc) > target * 1.5 && !it.noPermissive) { mode = 'permissive'; run(['Permissive', ...(it.flags || [])], it.error ?? DEF.error ?? 0.05, false); }
  if (triCount(doc) > target * 1.5 && it.sloppy !== false) { mode = 'sloppy'; run(null, 1, true); }
  return mode;
}

function stripMaterials(doc, it) {
  const keep = new Set(it.keep || []);
  for (const m of doc.getRoot().listMaterials()) {
    if (!keep.has('normal')) m.setNormalTexture(null);
    if (!keep.has('orm')) {
      if (m.getMetallicRoughnessTexture()) { m.setMetallicRoughnessTexture(null); m.setMetallicFactor(it.metal ?? 0); m.setRoughnessFactor(it.rough ?? 0.82); }
      m.setOcclusionTexture(null);
    }
    if (it.metal != null && !keep.has('orm')) m.setMetallicFactor(it.metal);
    if (it.rough != null && !keep.has('orm')) m.setRoughnessFactor(it.rough);
    if (!keep.has('emissive')) { m.setEmissiveTexture(null); m.setEmissiveFactor([0, 0, 0]); }
    if (it.doubleSided != null) m.setDoubleSided(it.doubleSided);
    if (it.alpha) m.setAlphaMode(it.alpha);
    if (it.alphaCutoff != null) m.setAlphaCutoff(it.alphaCutoff);
  }
  // 不要用到的屬性（TEXCOORD_1 通常只給 AO）
  for (const p of prims(doc)) {
    for (const s of p.listSemantics()) {
      if (/^(JOINTS|WEIGHTS)_/.test(s) || s === 'TANGENT' || (s === 'TEXCOORD_1' && !keep.has('orm')) || /^TEXCOORD_[2-9]/.test(s) || (/^COLOR_/.test(s) && it.dropVertexColor)) p.setAttribute(s, null);
    }
    for (const t of p.listTargets()) { p.removeTarget(t); t.dispose(); }
  }
}

async function processItem(it) {
  const path = resolve(CACHE, it.file);
  if (!existsSync(path)) throw new Error(`找不到原檔 ${it.file}`);
  const doc = (await io.read(path)).setLogger(quiet);
  const r = doc.getRoot();
  for (const a of r.listAnimations()) a.dispose();
  for (const n of r.listNodes()) { n.setSkin(null); n.setWeights([]); }
  for (const s of r.listSkins()) s.dispose();
  for (const c of r.listCameras()) c.dispose();
  const usesSG = r.listExtensionsUsed().some((e) => e.extensionName === 'KHR_materials_pbrSpecularGlossiness');
  await doc.transform(F.dequantize(), ...(usesSG ? [F.metalRough()] : []), F.uninstance(), F.flatten());
  if (r.listBuffers().length === 0) doc.createBuffer();
  const scene = r.getDefaultScene() || r.listScenes()[0];
  // 只留預設場景用到的網格，把節點變換烘進頂點
  const used = new Set(); scene.traverse((n) => used.add(n));
  for (const n of r.listNodes()) if (!used.has(n)) n.dispose();
  for (const s of r.listScenes()) if (s !== scene) s.dispose();
  for (const n of meshNodes(doc)) { F.clearNodeParent(n); F.clearNodeTransform(n); }
  for (const p of r.listMeshes().flatMap((m) => m.listPrimitives())) if (p.getMode() !== 4) p.dispose();
  if (it.dropMaterials) { const re = new RegExp(it.dropMaterials); for (const p of prims(doc)) if (re.test(p.getMaterial()?.getName() || '')) p.dispose(); }
  stripMaterials(doc, it);
  await doc.transform(F.prune({ keepAttributes: false, keepLeaves: false }));
  for (const b of r.listBuffers().slice(1)) { for (const a of r.listAccessors()) if (a.getBuffer() === b) a.setBuffer(r.listBuffers()[0]); b.dispose(); }
  const tris0 = triCount(doc);

  // 轉正
  let M = R4(it.rot || [0, 0, 0]);
  if (it.pca) { const [e1, e2, e3] = pcaAxes(doc); const x = [e2[1] * e1[2] - e2[2] * e1[1], e2[2] * e1[0] - e2[0] * e1[2], e2[0] * e1[1] - e2[1] * e1[0]]; M = mul(M, fromRows(x, e1, e2)); void e3; }
  if (it.flip) M = mul(R4(it.flip), M);
  applyMatrix(doc, M);
  if (it.crop || it.cut || it.cutParts) { cropTris(doc, it, bounds(doc)); await doc.transform(F.prune({ keepAttributes: false })); }

  // 合併、焊接、減面
  await doc.transform(F.join({ keepNamed: false }), F.weld());
  const mode = noSimplify ? 'off' : simplifyDoc(doc, it.triTarget, it);
  await doc.transform(F.prune({ keepAttributes: false }));

  // 尺寸
  const bb = bounds(doc);
  const fit = it.fit || {};
  let s = 1;
  if (fit.h) s = fit.h / bb.size[1];
  else if (fit.w) s = fit.w / Math.max(bb.size[0], bb.size[2]);
  else if (fit.d) s = fit.d / Math.max(...bb.size);
  else if (fit.len) s = fit.len / bb.size[1];
  else if (fit.scale) s = fit.scale;
  const cx = (bb.min[0] + bb.max[0]) / 2, cz = (bb.min[2] + bb.max[2]) / 2;
  const oy = fit.grip != null ? bb.min[1] + fit.grip * bb.size[1] : bb.min[1];
  applyMatrix(doc, mul(S4(s), T4(-cx, -oy, -cz)));
  const size = bb.size.map((v) => +(v * s).toFixed(3));

  // 貼圖：baseColor 用 texSize，法線／ORM 用一半
  const tex = it.texSize ?? DEF.texSize ?? 512;
  const q = it.quality ?? DEF.quality ?? 76;
  await doc.transform(
    F.textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [tex, tex], quality: q, slots: /^(baseColorTexture|emissiveTexture)$/ }),
    F.textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [Math.max(64, tex / 2), Math.max(64, tex / 2)], quality: Math.min(90, q + 8), slots: /^(normalTexture|metallicRoughnessTexture|occlusionTexture)$/ }),
  );
  await doc.transform(F.prune(), F.dedup());

  // 包成 m_<id>
  const wrap = doc.createNode(`m_${it.id}`).setExtras({ role: it.role, size });
  for (const n of [...scene.listChildren()]) { scene.removeChild(n); wrap.addChild(n); }
  scene.addChild(wrap);
  for (const e of r.listExtensionsUsed()) if (!KEEP_EXT.has(e.extensionName)) e.dispose();
  return { doc, scene, info: { id: it.id, group: it.group, tris0: Math.round(tris0), tris: Math.round(triCount(doc)), mode, size } };
}

function texInfo(textures) {
  let px = 0, bytes = 0; const dims = [];
  for (const t of textures) { const sz = t.getSize() || [0, 0]; px += sz[0] * sz[1]; bytes += t.getImage().byteLength; dims.push(Math.max(...sz)); }
  return { count: textures.length, dims, bytes, gpuMB: +((px * 4 * 4) / 3 / 1048576).toFixed(2) };
}

const report = [];
mkdirSync(OUT, { recursive: true });
mkdirSync(DIST, { recursive: true });
for (const g of groups) {
  const out = new Document().setLogger(quiet);
  out.createBuffer();
  const outScene = out.createScene(g);
  for (const it of items.filter((m) => m.group === g)) {
    const t0 = Date.now();
    let res;
    try { res = await processItem(it); } catch (e) { console.error(`✗ ${it.id}: ${e.message}`); report.push({ id: it.id, group: g, error: e.message }); continue; }
    const map = F.mergeDocuments(out, res.doc);
    const s2 = map.get(res.scene);
    for (const n of [...s2.listChildren()]) { s2.removeChild(n); outScene.addChild(n); }
    s2.dispose();
    report.push({ ...res.info, sec: +((Date.now() - t0) / 1000).toFixed(1) });
    console.log(`  ${g}/${it.id}: ${res.info.tris0} → ${res.info.tris} 三角（${res.info.mode}）尺寸 ${res.info.size.join('×')} m`);
  }
  const rr = out.getRoot();
  out.getRoot().setDefaultScene(outScene);
  for (const b of rr.listBuffers().slice(1)) b.dispose();
  for (const a of rr.listAccessors()) a.setBuffer(rr.listBuffers()[0]);
  await out.transform(F.prune({ keepLeaves: true }), F.dedup(), F.quantize({ quantizePosition: 14, quantizeNormal: 8, quantizeTexcoord: 14, quantizeColor: 8 }));
  // 索引能用 16 位元就用（每三角省 6 bytes）
  for (const a of rr.listAccessors()) { const arr = a.getArray(); if (arr instanceof Uint32Array && rr.listMeshes().some((m) => m.listPrimitives().some((p) => p.getIndices() === a))) { let mx = 0; for (const v of arr) if (v > mx) mx = v; if (mx < 65536) a.setArray(new Uint16Array(arr)); } }
  if (rr.listTextures().length) out.createExtension(EXTTextureWebP).setRequired(true);
  for (const e of rr.listExtensionsUsed()) if (!KEEP_EXT.has(e.extensionName)) e.dispose();

  // 每件的實際份量（量化之後）
  for (const wrap of outScene.listChildren()) {
    const id = wrap.getName().replace(/^m_/, '');
    const rec = report.find((x) => x.id === id && x.group === g);
    if (!rec) continue;
    const texs = new Set(); let geo = 0, prim = 0; const accs = new Set();
    wrap.traverse((n) => {
      const m = n.getMesh(); if (!m) return;
      for (const p of m.listPrimitives()) {
        prim++;
        for (const a of [...p.listAttributes(), p.getIndices()].filter(Boolean)) accs.add(a);
        const mat = p.getMaterial();
        if (mat) for (const t of [mat.getBaseColorTexture(), mat.getNormalTexture(), mat.getMetallicRoughnessTexture(), mat.getOcclusionTexture(), mat.getEmissiveTexture()]) if (t) texs.add(t);
      }
    });
    for (const a of accs) geo += a.getArray().byteLength;
    const ti = texInfo([...texs]);
    Object.assign(rec, { drawCalls: prim, tex: ti.count, texDims: ti.dims, texKB: Math.round(ti.bytes / 1024), geoKB: Math.round(geo / 1024), gpuMB: ti.gpuMB });
  }
  const file = onlyIds ? resolve(DIST, `models-test-${g}.glb`) : resolve(OUT, `${g}.glb`);
  if (!dry) {
    const bin = await io.writeBinary(out);
    writeFileSync(file, bin);
    const gz = gzipSync(bin, { level: 9 });
    const all = texInfo(rr.listTextures());
    const rec = { group: g, file: file.slice(root.length + 1), items: outScene.listChildren().length, bytes: bin.byteLength, gzip: gz.byteLength, base64: Math.ceil(gz.byteLength / 3) * 4, tris: Math.round(triCount(out)), textures: all.count, gpuMB: all.gpuMB, drawCalls: rr.listMeshes().reduce((s, m) => s + m.listPrimitives().length, 0) };
    report.push({ groupSummary: rec });
    console.log(`→ ${rec.file}: ${(rec.bytes / 1048576).toFixed(2)} MB，gzip ${(rec.gzip / 1048576).toFixed(2)} MB，內嵌 ${(rec.base64 / 1048576).toFixed(2)} MB；${rec.items} 件、${rec.tris} 三角、${rec.textures} 張貼圖（解碼約 ${rec.gpuMB} MB）、${rec.drawCalls} primitive`);
  }
}

// 報表：dist/models-report.json（預覽頁的標籤與回報用）。只跑部分 group 時與舊報表合併
const repFile = resolve(DIST, 'models-report.json');
let prev = [];
if ((onlyGroups || onlyIds) && existsSync(repFile)) prev = JSON.parse(readFileSync(repFile, 'utf8')).filter((r) => !(r.groupSummary ? groups.includes(r.groupSummary.group) : groups.includes(r.group)));
if (!dry && !onlyIds) writeFileSync(repFile, JSON.stringify([...prev, ...report], null, 1));
const sums = [...prev, ...report].filter((r) => r.groupSummary).map((r) => r.groupSummary);
if (sums.length && !onlyIds) {
  const tot = sums.reduce((a, r) => ({ bytes: a.bytes + r.bytes, gzip: a.gzip + r.gzip, base64: a.base64 + r.base64, tris: a.tris + r.tris, gpuMB: a.gpuMB + r.gpuMB }), { bytes: 0, gzip: 0, base64: 0, tris: 0, gpuMB: 0 });
  console.log(`合計：${(tot.bytes / 1048576).toFixed(2)} MB，gzip ${(tot.gzip / 1048576).toFixed(2)} MB，內嵌 ${(tot.base64 / 1048576).toFixed(2)} MB，${tot.tris} 三角，貼圖解碼約 ${tot.gpuMB.toFixed(1)} MB`);
}
const errs = report.filter((r) => r.error);
if (errs.length) { console.error(`${errs.length} 件失敗`); process.exitCode = 1; }
