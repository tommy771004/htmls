// 車流車型：把 cars.mjs 處理過的車（車長、車頭 +z、接地、輪子節點、材質頂點屬性都整理好了）烘成給 InstancedMesh 用的幾何
// → blender/out/traffic.glb（打包時內嵌成 #glb-traffic）。
//   node tools/traffic.mjs            （全部）
//   node tools/traffic.mjs police     （只重烘其中幾台，其他沿用舊檔）
// 每台車：貼圖在頂點上取樣成頂點色（sRGB → 線性）、依 _PBR／_EMI／輪子節點分成 uber 材質編號（_MAT），
// 分材質減面到 tris 左右，輸出 POSITION、NORMAL、COLOR_0、_MAT，最後量化＋meshopt 壓縮。
// 車流裡車身同時有幾十台，所以壓在幾千面；輪子不轉（車流本來就沒有輪子動畫）。
import { createRequire } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(root, '../197-openworld/package.json'));
const imp = (n) => import(pathToFileURL(req.resolve(n)).href);
const { NodeIO, Document } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { quantize, meshopt } = await imp('@gltf-transform/functions');
const { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } = await imp('meshoptimizer');
const sharp = (await imp('sharp')).default;

// src：assets/260/ 下 cars.mjs 的輸出；pal：車漆交給遊戲的調色盤（車漆材質寫成 _MAT 0）
export const TRAFFIC = [
  { id: 'police', src: 'police', pal: false, tris: 7000 },
  { id: 'e34', src: 'e34', pal: true, tris: 6000 },
  { id: 'evo190', src: 'evo190', pal: true, tris: 6000 },
];
const out = resolve(root, 'blender/out/traffic.glb');
const only = process.argv.slice(2);

await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const toLin = (c) => (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
const texCache = new Map();
async function texPixels(tex) {
  if (texCache.has(tex)) return texCache.get(tex);
  const { data, info } = await sharp(Buffer.from(tex.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const t = { data, w: info.width, h: info.height };
  texCache.set(tex, t);
  return t;
}
function sample(t, u, v) {
  const x = Math.min(t.w - 1, Math.max(0, Math.floor(((u % 1) + 1) % 1 * t.w)));
  const y = Math.min(t.h - 1, Math.max(0, Math.floor(((v % 1) + 1) % 1 * t.h)));
  const i = (y * t.w + x) * 4;
  return [toLin(t.data[i] / 255), toLin(t.data[i + 1] / 255), toLin(t.data[i + 2] / 255)];
}
// 4x4 矩陣（column-major）
const mulP = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
const mulN = (m, x, y, z) => { const a = [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z]; const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };

// uber 材質編號：0 車漆 1 玻璃 2 塑膠 3 鍍鉻 4 頭燈 5 尾燈 6 輪胎 7 輪圈 10 光滑 11 柔和自發光
function matOf(col, pbr, emi, wheel, pal) {
  const lum = .2126 * col[0] + .7152 * col[1] + .0722 * col[2];
  if (emi[3] === 1) return 4;
  if (emi[3] === 2) return 5;
  if (emi[0] + emi[1] + emi[2] > .05) return 11;
  if (col[3] < .99) return 1;
  if (wheel) return lum < .04 && pbr[1] < .5 ? 6 : 7;
  if (pbr[3] > .5 && pal) return 0;
  if (pbr[1] > .5 && pbr[0] < .35) return 3;
  return pbr[0] < .4 || pbr[2] > .3 ? 10 : 2;
}

async function bake(cfg) {
  const doc = await io.read(resolve(root, '../../assets/260', cfg.src + '.glb'));
  const parts = [];   // { mat, pos[], nor[], col[], idx[] }，每個 primitive × 材質編號一段
  let total = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const wm = node.getWorldMatrix(), wheel = /^wheel_/.test(node.getName());
    for (const prim of mesh.listPrimitives()) {
      const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), C = prim.getAttribute('COLOR_0');
      const PB = prim.getAttribute('_PBR'), E = prim.getAttribute('_EMI'), UV = prim.getAttribute('TEXCOORD_0');
      const tex = prim.getMaterial()?.getBaseColorTexture();
      const px = tex && UV ? await texPixels(tex) : null;
      const n = P.getCount(), mats = new Int8Array(n), byMat = new Map();
      const pos = [], nor = [], col = [];
      const a = [], b = [], c = [], d = [], e = [], uv = [];
      for (let i = 0; i < n; i++) {
        P.getElement(i, a); N.getElement(i, b); C ? C.getElement(i, c) : c.splice(0, 4, 1, 1, 1, 1);
        PB ? PB.getElement(i, d) : d.splice(0, 4, .6, 0, 0, 0); E ? E.getElement(i, e) : e.splice(0, 4, 0, 0, 0, 0);
        let rgb = [c[0], c[1], c[2]];
        if (px) { UV.getElement(i, uv); const s = sample(px, uv[0], uv[1]); rgb = [rgb[0] * s[0], rgb[1] * s[1], rgb[2] * s[2]]; }
        const m = matOf([...rgb, c[3]], d, e, wheel, cfg.pal);
        if (m === 4 || m === 11) { const l = Math.max(e[0], e[1], e[2]); if (l > .05) rgb = [e[0] / l, e[1] / l, e[2] / l]; }
        mats[i] = m;
        pos.push(...mulP(wm, a[0], a[1], a[2])); nor.push(...mulN(wm, b[0], b[1], b[2])); col.push(...rgb);
      }
      const I = prim.getIndices();
      const idx = I ? Array.from(I.getArray()) : [...Array(n).keys()];
      // 三角形歸到頭一個頂點的材質
      for (let t = 0; t < idx.length; t += 3) {
        const m = mats[idx[t]];
        let g = byMat.get(m);
        if (!g) byMat.set(m, (g = []));
        g.push(idx[t], idx[t + 1], idx[t + 2]);
      }
      for (const [m, tri] of byMat) { parts.push({ mat: m, pos, nor, col, idx: tri }); total += tri.length / 3; }
    }
  }
  // 依面數比例減面（不鎖邊界：零件多、邊界一鎖就減不下來；車流看的距離看不出接縫）
  const ratio = Math.min(1, cfg.tris / total);
  const P = [], N = [], C = [], M = [], IDX = [];
  for (const p of parts) {
    let ix = new Uint32Array(p.idx);
    if (ratio < 1 && ix.length > 30) {
      const target = Math.max(12, Math.floor(ix.length * ratio / 3) * 3);
      [ix] = MeshoptSimplifier.simplify(ix, new Float32Array(p.pos), 3, target, .04);
      if (ix.length > target * 1.5) [ix] = MeshoptSimplifier.simplifySloppy(ix, new Float32Array(p.pos), 3, null, target, .04);
    }
    const remap = new Map();
    for (const v of ix) {
      let o = remap.get(v);
      if (o == null) {
        o = P.length / 3; remap.set(v, o);
        P.push(p.pos[v * 3], p.pos[v * 3 + 1], p.pos[v * 3 + 2]); N.push(p.nor[v * 3], p.nor[v * 3 + 1], p.nor[v * 3 + 2]);
        C.push(p.col[v * 3], p.col[v * 3 + 1], p.col[v * 3 + 2]); M.push(p.mat);
      }
      IDX.push(o);
    }
  }
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y1 = 0;
  for (let i = 0; i < P.length; i += 3) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); y1 = Math.max(y1, P[i + 1]); z0 = Math.min(z0, P[i + 2]); z1 = Math.max(z1, P[i + 2]); }
  console.log(`${cfg.id}: ${total} → ${IDX.length / 3} 面，${P.length / 3} 頂點，${(x1 - x0).toFixed(2)}×${y1.toFixed(2)}×${(z1 - z0).toFixed(2)} m`);
  return { id: cfg.id, P, N, C, M, IDX, len: +(z1 - z0).toFixed(2), w: +(x1 - x0).toFixed(2) };
}

// 只重烘部分車型時，其他車型從舊的 traffic.glb 讀回來
const keep = new Map();
if (only.length && existsSync(out)) {
  const old = await io.read(out);
  for (const node of old.getRoot().listNodes()) if (!only.includes(node.getName())) keep.set(node.getName(), node);
}
const doc = new Document();
const buf = doc.createBuffer();
const scene = doc.createScene();
const acc = (arr, type, Ctor) => doc.createAccessor().setType(type).setArray(new Ctor(arr)).setBuffer(buf);
for (const cfg of TRAFFIC) {
  let r;
  if (keep.has(cfg.id)) {
    const n = keep.get(cfg.id), p = n.getMesh().listPrimitives()[0], ex = n.getExtras();
    const get = (a) => { const o = []; const e = []; for (let i = 0; i < a.getCount(); i++) o.push(...a.getElement(i, e)); return o; };
    const wm = n.getWorldMatrix(), raw = get(p.getAttribute('POSITION')), P = [];
    for (let i = 0; i < raw.length; i += 3) P.push(...mulP(wm, raw[i], raw[i + 1], raw[i + 2]));
    r = { id: cfg.id, P, N: get(p.getAttribute('NORMAL')), C: get(p.getAttribute('COLOR_0')), M: get(p.getAttribute('_MAT')), IDX: Array.from(p.getIndices().getArray()), len: ex.len, w: ex.w };
  } else r = await bake(cfg);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc(r.P, 'VEC3', Float32Array)).setAttribute('NORMAL', acc(r.N, 'VEC3', Float32Array))
    .setAttribute('COLOR_0', acc(r.C, 'VEC3', Float32Array)).setAttribute('_MAT', acc(r.M, 'SCALAR', Float32Array))
    .setIndices(acc(r.IDX, 'SCALAR', Uint32Array));
  const node = doc.createNode(r.id).setMesh(doc.createMesh(r.id).addPrimitive(prim)).setExtras({ len: r.len, w: r.w, pal: cfg.pal });
  scene.addChild(node);
}
await doc.transform(quantize({ pattern: /^(POSITION|NORMAL|COLOR_0)$/ }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
await io.write(out, doc);
console.log(`${out}: ${(statSync(out).size / 1024).toFixed(0)} KB`);
