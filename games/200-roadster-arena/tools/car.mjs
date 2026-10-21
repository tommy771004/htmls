// Sketchfab 車輛模型 → assets/roadster.glb（打包時 gzip＋base64 內嵌進單檔）
//   node tools/car.mjs        來源 GLB 放在 .cache/tesla_roadtser_2026.glb（gitignore），CAR_SRC=… 可改路徑
// 原檔是單一材質（貼圖接在自發光、底色全黑）、切成 10 塊的 50 萬面網格，輪子和車身黏在一起。
// 這裡把節點轉換烘進頂點，依物理的軸距縮放、前軸對到 CAR.WHEELS 的 z，以「三角形重心落在輪胎圓柱內」切出四個輪子
// （各自以輪心為原點），再減面、貼圖轉 WebP、meshopt 壓縮。gltf-transform、meshoptimizer 與 sharp 借用 197 的 node_modules。
import { createRequire } from 'node:module';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CAR } from '../src/core/const.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(root, '../197-openworld/package.json'));
const imp = (n) => import(pathToFileURL(req.resolve(n)).href);
const { NodeIO, Document } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { textureCompress, meshopt } = await imp('@gltf-transform/functions');
const { MeshoptSimplifier, MeshoptEncoder } = await imp('meshoptimizer');
const sharp = (await imp('sharp')).default;

const SRC = process.env.CAR_SRC || resolve(root, '.cache/tesla_roadtser_2026.glb');
const OUT = resolve(root, 'assets/roadster.glb');
// 原檔座標（車頭 +z、地面 y=0）量出來的輪胎：軸心 z、半徑；X_IN 以外才算輪胎（以內是輪拱內襯，留在車身）
const AXLE = { front: 0.5315, rear: -0.6315 }, R = 0.122, X_IN = 0.25, EPS = 0.1;
const TRIS = { body: 70000, wheel: 4000 };
const ERR = 0.004;   // 減面的容許誤差（相對於模型大小）
const CREASE = 40;   // 法線折角（度）
const BLUR = 0.08;   // 法線濾波半徑（公尺，縮放後）：原檔表面有低頻起伏，抹平才不會在車漆反光上看到皺折

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
const src = await io.read(SRC);

// 攤平：每個網格節點的世界矩陣烘進位置。原檔的法線接近逐面、表面也有低頻起伏（面很細所以看不出來，減面後會變成皺折），
// 所以丟掉原法線、以「位置＋UV」合併；減面後的法線由高精度網格的面法線在 BLUR 半徑內、CREASE 折角內平均而來
const P = [], U = [], I = [], key = new Map();
let texImage = null, texMime = 'image/png';
for (const node of src.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const m = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) {
    const tex = prim.getMaterial()?.getEmissiveTexture() || prim.getMaterial()?.getBaseColorTexture();
    if (tex && !texImage) { texImage = tex.getImage(); texMime = tex.getMimeType(); }
    const pa = prim.getAttribute('POSITION').getArray(), ua = prim.getAttribute('TEXCOORD_0').getArray();
    const remap = [];
    for (let i = 0; i < pa.length / 3; i++) {
      const [x, y, z] = [pa[i * 3], pa[i * 3 + 1], pa[i * 3 + 2]];
      const v = [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
      const k = `${v.map((c) => c.toFixed(6)).join(',')}|${ua[i * 2].toFixed(6)},${ua[i * 2 + 1].toFixed(6)}`;
      let id = key.get(k);
      if (id === undefined) { id = P.length / 3; key.set(k, id); P.push(...v); U.push(ua[i * 2], ua[i * 2 + 1]); }
      remap.push(id);
    }
    for (const k of prim.getIndices().getArray()) I.push(remap[k]);
  }
}

// 縮放：原檔軸距 → 物理軸距；前軸對到 CAR.WHEELS 前輪的 z
const wf = CAR.WHEELS.find((w) => w.front), wr = CAR.WHEELS.find((w) => !w.front);
const S = (wf.z - wr.z) / (AXLE.front - AXLE.rear), DZ = wf.z - AXLE.front * S;
for (let i = 0; i < P.length; i += 3) { P[i] *= S; P[i + 1] *= S; P[i + 2] = P[i + 2] * S + DZ; }
const r = R * S, xin = X_IN * S;
// 高精度網格的面（重心、面積加權法線）放進空間格子，減面後的法線由它濾出來
const FG = new Map(), CELL = BLUR;
const cellKey = (x, y, z) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
for (let t = 0; t < I.length; t += 3) {
  const [a, b, c] = [I[t] * 3, I[t + 1] * 3, I[t + 2] * 3];
  const e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
  const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.hypot(...n);
  if (!l) continue;
  const f = { c: [(P[a] + P[b] + P[c]) / 3, (P[a + 1] + P[b + 1] + P[c + 1]) / 3, (P[a + 2] + P[b + 2] + P[c + 2]) / 3], n, u: n.map((x) => x / l) };
  const k = cellKey(...f.c);
  (FG.get(k) || FG.set(k, []).get(k)).push(f);
}
// 半徑 BLUR 內、和參考方向夾角小於 CREASE 的面法線平均
const cosC = Math.cos(CREASE * Math.PI / 180);
function blurNormal(p, ref) {
  const s = [0, 0, 0];
  const [cx, cy, cz] = p.map((v) => Math.floor(v / CELL));
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
    for (const f of FG.get(`${cx + i},${cy + j},${cz + k}`) || []) {
      if (Math.hypot(f.c[0] - p[0], f.c[1] - p[1], f.c[2] - p[2]) > BLUR) continue;
      if (f.u[0] * ref[0] + f.u[1] * ref[1] + f.u[2] * ref[2] < cosC) continue;
      s[0] += f.n[0]; s[1] += f.n[1]; s[2] += f.n[2];
    }
  }
  const l = Math.hypot(...s);
  return l ? s.map((x) => x / l) : ref;
}
let zmin = Infinity, zmax = -Infinity;
for (let i = 2; i < P.length; i += 3) { zmin = Math.min(zmin, P[i]); zmax = Math.max(zmax, P[i]); }
// 輪子：左右（車身 +X 是左側）× 前後
const WHEELS = [['FL', 1, wf.z], ['FR', -1, wf.z], ['RL', 1, wr.z], ['RR', -1, wr.z]].map(([name, side, z]) => ({ name, side, z, y: r, tris: [] }));
const body = [];
for (let t = 0; t < I.length; t += 3) {
  let cx = 0, cy = 0, cz = 0;
  for (let k = 0; k < 3; k++) { const v = I[t + k] * 3; cx += P[v] / 3; cy += P[v + 1] / 3; cz += P[v + 2] / 3; }
  const w = Math.abs(cx) > xin && WHEELS.find((w) => Math.sign(cx) === w.side && Math.hypot(cz - w.z, cy - w.y) < r * (1 + EPS));
  (w ? w.tris : body).push(I[t], I[t + 1], I[t + 2]);
}
// 輪子的 x 中心（胎面的內外緣中點）：前輪轉向繞這條垂直軸
for (const w of WHEELS) {
  let lo = Infinity, hi = 0;
  for (const v of w.tris) if (Math.hypot(P[v * 3 + 2] - w.z, P[v * 3 + 1] - w.y) > 0.85 * r) { const ax = Math.abs(P[v * 3]); lo = Math.min(lo, ax); hi = Math.max(hi, ax); }
  w.x = w.side * (lo + hi) / 2; w.w = hi - lo;
}

const doc = new Document();
const buf = doc.createBuffer();
const tex = doc.createTexture('roadster').setImage(texImage).setMimeType(texMime);
const mat = doc.createMaterial('roadster').setBaseColorTexture(tex).setMetallicFactor(0).setRoughnessFactor(0.4);
const scene = doc.createScene();
let trisOut = [];
const NCACHE = new Map();
function part(name, tris, target, ofs = [0, 0, 0]) {
  const remap = new Map(), src = [], pos = [], idx = [];
  for (const v of tris) {
    let k = remap.get(v);
    if (k === undefined) { k = remap.size; remap.set(v, k); src.push(v); pos.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); }
    idx.push(k);
  }
  // 減面（meshoptimizer 只挑保留哪些原頂點、會沿著 UV 接縫收邊），再逐角落挑法線
  const [out] = MeshoptSimplifier.simplify(Uint32Array.from(idx), Float32Array.from(pos), 3, Math.min(idx.length, target * 3), ERR, []);
  const fp = [], fn = [], fu = [];
  for (let t = 0; t < out.length; t += 3) {
    const [a, b, c] = [out[t], out[t + 1], out[t + 2]].map((k) => src[k]);
    const e1 = [0, 1, 2].map((d) => P[b * 3 + d] - P[a * 3 + d]), e2 = [0, 1, 2].map((d) => P[c * 3 + d] - P[a * 3 + d]);
    const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const fl = Math.hypot(...f) || 1;
    for (const v of [a, b, c]) {
      // 先以新面法線濾一次定出這個角落屬於哪一面，再以結果當參考濾第二次：同一面的角落得到同樣的法線，才合併得回去
      const p = [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]];
      const ref = blurNormal(p, f.map((x) => x / fl));
      const list = NCACHE.get(v) || NCACHE.set(v, []).get(v);
      let hit = list.find((e) => e.ref[0] * ref[0] + e.ref[1] * ref[1] + e.ref[2] * ref[2] > 0.95);
      if (!hit) { hit = { ref, n: blurNormal(p, ref) }; list.push(hit); }
      const n = hit.n;
      fp.push(p[0] - ofs[0], p[1] - ofs[1], p[2] - ofs[2]); fn.push(...n); fu.push(U[v * 2], U[v * 2 + 1]);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(fp, 3)); g.setAttribute('normal', new Float32BufferAttribute(fn, 3)); g.setAttribute('uv', new Float32BufferAttribute(fu, 2));
  const m = mergeVertices(g);
  const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
  const prim = doc.createPrimitive().setMaterial(mat)
    .setAttribute('POSITION', acc('VEC3', m.attributes.position.array)).setAttribute('NORMAL', acc('VEC3', m.attributes.normal.array))
    .setAttribute('TEXCOORD_0', acc('VEC2', m.attributes.uv.array)).setIndices(acc('SCALAR', Uint32Array.from(m.index.array)));
  // meshopt 的量化會把縮放與位移寫進節點矩陣，原點另存在 extras.c，頁面烘回幾何後以它為輪心
  const node = doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)).setTranslation(ofs).setExtras({ c: ofs.map((v) => +v.toFixed(4)) });
  scene.addChild(node);
  trisOut.push(`${name} ${tris.length / 3}→${m.index.count / 3}`);
  return node;
}
part('body', body, TRIS.body);
for (const w of WHEELS) part('wheel_' + w.name, w.tris, TRIS.wheel, [w.x, w.y, w.z]);

await doc.transform(
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [2048, 2048], quality: 82 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
mkdirSync(dirname(OUT), { recursive: true });
await io.write(OUT, doc);
console.log(`${OUT}: ${(statSync(OUT).size / 1024).toFixed(0)} KB；縮放 ${S.toFixed(3)}、車頭 z ${zmax.toFixed(2)}、車尾 z ${zmin.toFixed(2)}；輪半徑 ${r.toFixed(3)}；${trisOut.join('、')}`);
console.log(WHEELS.map((w) => `${w.name} x=${w.x.toFixed(3)} 寬 ${w.w.toFixed(2)} z=${w.z}`).join('  '));
