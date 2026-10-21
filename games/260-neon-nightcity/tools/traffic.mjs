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

// src：cars.mjs 的輸出（車行的車在 assets/260/，車流專用的在 .cache/traffic/，要先 TRAFFIC=1 node tools/cars.mjs）；
// pal：車漆交給遊戲的調色盤（車漆材質寫成 _MAT 0）；彩繪車（計程車、警車）與沒有車漆材質的保留原色
export const TRAFFIC = [
  { id: 'e34', src: 'e34', pal: true, tris: 4000 },
  { id: 'evo190', src: 'evo190', pal: true, tris: 4000 },
  // DanielZhabotinsky 的虛構廠牌車（原檔約兩萬面）
  { id: 'fh_taxi', pal: false, tris: 4000 },
  { id: 'fh_cop', pal: false, tris: 4000 },
  { id: 'il_cop', pal: false, tris: 4000 },
  { id: 'negotiator', pal: true, tris: 3600 },
  { id: 'milano', pal: true, tris: 3600 },
  { id: 'kiri', pal: true, tris: 3600 },
  { id: 'carter', pal: true, tris: 3600 },
  { id: 'compact', pal: true, tris: 3200 },
  { id: 'urban', pal: true, tris: 3600 },
  { id: 'tiara', pal: true, tris: 3600 },
  { id: 'shvan', pal: true, tris: 3600 },
  { id: 'lct', pal: true, tris: 4000 },
  { id: 'conquer', pal: true, tris: 3600 },
  { id: 'fvan', pal: false, tris: 3200 },
];
const srcOf = (cfg) => {
  const a = resolve(root, '../../assets/260', (cfg.src || cfg.id) + '.glb');
  return existsSync(a) ? a : resolve(root, '.cache/traffic', (cfg.src || cfg.id) + '.glb');
};
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
  if (pbr[1] > .5 && pbr[0] < .35 && lum > .3) return 3;   // 暗色的金屬漆當成光滑漆面，不然整台像鍍鉻
  return pbr[0] < .4 || pbr[2] > .3 ? 10 : 2;
}

// 每台車分成幾個單元（車身、各個輪子）各自減面：輪框細節多、平面少，按比例分的話面數全被輪框吃掉。
// 每台烘兩級：近景 tris（40 m 內）與遠景 FAR_TRIS（節點名加 _far）
const WHEEL_TRIS = 140, FAR_TRIS = 600, FAR_WHEEL = 24;
async function bake(cfg, tris = cfg.tris, wheelTris = WHEEL_TRIS, id = cfg.id) {
  const doc = await io.read(srcOf(cfg));
  const units = new Map();   // 節點名 → { wheel, pos[], nor[], col[], mat[], idx[] }
  let total = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const wm = node.getWorldMatrix(), wheel = /^wheel_/.test(node.getName());
    let u = units.get(node.getName());
    if (!u) units.set(node.getName(), (u = { wheel, pos: [], nor: [], col: [], mat: [], idx: [] }));
    for (const prim of mesh.listPrimitives()) {
      const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), C = prim.getAttribute('COLOR_0');
      const PB = prim.getAttribute('_PBR'), E = prim.getAttribute('_EMI'), UV = prim.getAttribute('TEXCOORD_0');
      const tex = prim.getMaterial()?.getBaseColorTexture();
      const px = tex && UV ? await texPixels(tex) : null;
      const n = P.getCount(), base = u.pos.length / 3;
      const a = [], b = [], c = [], d = [], e = [], uv = [];
      for (let i = 0; i < n; i++) {
        P.getElement(i, a); N.getElement(i, b); C ? C.getElement(i, c) : c.splice(0, 4, 1, 1, 1, 1);
        PB ? PB.getElement(i, d) : d.splice(0, 4, .6, 0, 0, 0); E ? E.getElement(i, e) : e.splice(0, 4, 0, 0, 0, 0);
        let rgb = [c[0], c[1], c[2]];
        if (px) { UV.getElement(i, uv); const s = sample(px, uv[0], uv[1]); rgb = [rgb[0] * s[0], rgb[1] * s[1], rgb[2] * s[2]]; }
        const m = matOf([...rgb, c[3]], d, e, wheel, cfg.pal);
        // 燈：頂點色換成燈光的顏色（亮度交給 shader）；柔和自發光（燈條、儀表）壓暗，免得泛光整台爆白
        if (m === 4 || m === 11) { const l = Math.max(e[0], e[1], e[2]); if (l > .05) rgb = [e[0] / l, e[1] / l, e[2] / l]; if (m === 11) rgb = rgb.map((v) => v * .45); }
        u.mat.push(m);
        u.pos.push(...mulP(wm, a[0], a[1], a[2])); u.nor.push(...mulN(wm, b[0], b[1], b[2])); u.col.push(...rgb);
      }
      const I = prim.getIndices();
      if (I) for (const v of I.getArray()) u.idx.push(base + v);
      else for (let i = 0; i < n; i++) u.idx.push(base + i);
      total += (I ? I.getCount() : n) / 3;
    }
  }
  const nWheel = [...units.values()].filter((u) => u.wheel).length;
  const bodyTris = Math.max(300, tris - nWheel * wheelTris);
  const P = [], N = [], C = [], M = [], IDX = [];
  for (const u of units.values()) {
    // 依「位置（1 mm）＋材質」焊接：原檔的硬邊把面板拆成互不相連的小片，不焊接的話減面只能退回 sloppy，整台會被撕碎
    const wid = new Map(), wsrc = [], wpos = [], ix = new Uint32Array(u.idx.length);
    u.idx.forEach((v, i) => {
      const key = `${Math.round(u.pos[v * 3] * 1000)},${Math.round(u.pos[v * 3 + 1] * 1000)},${Math.round(u.pos[v * 3 + 2] * 1000)},${u.mat[v]}`;
      let w = wid.get(key);
      if (w == null) { w = wsrc.length; wid.set(key, w); wsrc.push(v); wpos.push(u.pos[v * 3], u.pos[v * 3 + 1], u.pos[v * 3 + 2]); }
      ix[i] = w;
    });
    const pos = new Float32Array(wpos), target = (u.wheel ? wheelTris : bodyTris) * 3;
    let out = ix;
    if (ix.length > target) {
      // Prune：整塊小零件（螺絲、徽章）在誤差內可以直接拿掉
      [out] = MeshoptSimplifier.simplify(ix, pos, 3, target, u.wheel ? .1 : .025, ['Prune']);
      if (out.length > target * 1.5) [out] = MeshoptSimplifier.simplifySloppy(out, pos, 3, null, target, u.wheel ? 1 : .03);
    }
    // 法線：相鄰面夾角 40° 內平滑，其餘保留硬邊
    const fn = [], adj = new Map();
    for (let t = 0; t < out.length; t += 3) {
      const [i0, i1, i2] = [out[t] * 3, out[t + 1] * 3, out[t + 2] * 3];
      const e1 = [pos[i1] - pos[i0], pos[i1 + 1] - pos[i0 + 1], pos[i1 + 2] - pos[i0 + 2]], e2 = [pos[i2] - pos[i0], pos[i2 + 1] - pos[i0 + 1], pos[i2 + 2] - pos[i0 + 2]];
      const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const l = Math.hypot(...f) || 1;
      fn.push(f.map((x) => x / l));
      for (let k = 0; k < 3; k++) { const w = out[t + k]; if (!adj.has(w)) adj.set(w, []); adj.get(w).push(t / 3); }
    }
    const vmap = new Map();
    for (let t = 0; t < out.length; t += 3) {
      const f = fn[t / 3];
      for (let k = 0; k < 3; k++) {
        const w = out[t + k], src = wsrc[w];
        const n = [0, 0, 0];
        for (const g of adj.get(w)) { const h = fn[g]; if (h[0] * f[0] + h[1] * f[1] + h[2] * f[2] > .766) { n[0] += h[0]; n[1] += h[1]; n[2] += h[2]; } }
        const l = Math.hypot(...n) || 1;
        const key = `${w}|${Math.round(n[0] / l * 20)},${Math.round(n[1] / l * 20)},${Math.round(n[2] / l * 20)}`;
        let o = vmap.get(key);
        if (o == null) {
          o = P.length / 3; vmap.set(key, o);
          P.push(pos[w * 3], pos[w * 3 + 1], pos[w * 3 + 2]); N.push(n[0] / l, n[1] / l, n[2] / l);
          C.push(u.col[src * 3], u.col[src * 3 + 1], u.col[src * 3 + 2]); M.push(u.mat[src]);
        }
        IDX.push(o);
      }
    }
  }
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y1 = 0;
  for (let i = 0; i < P.length; i += 3) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); y1 = Math.max(y1, P[i + 1]); z0 = Math.min(z0, P[i + 2]); z1 = Math.max(z1, P[i + 2]); }
  console.log(`${id}: ${total} → ${IDX.length / 3} 面（輪子 ${nWheel} 個），${P.length / 3} 頂點，${(x1 - x0).toFixed(2)}×${y1.toFixed(2)}×${(z1 - z0).toFixed(2)} m`);
  return { id, P, N, C, M, IDX, len: +(z1 - z0).toFixed(2), w: +(x1 - x0).toFixed(2) };
}

// 只重烘部分車型時，其他車型從舊的 traffic.glb 讀回來
const keep = new Map();
if (only.length && existsSync(out)) {
  const old = await io.read(out);
  for (const node of old.getRoot().listNodes()) if (!only.includes(node.getName().replace(/_far$/, ''))) keep.set(node.getName(), node);
}
const doc = new Document();
const buf = doc.createBuffer();
const scene = doc.createScene();
const acc = (arr, type, Ctor) => doc.createAccessor().setType(type).setArray(new Ctor(arr)).setBuffer(buf);
for (const [cfg, id, tris, wt] of TRAFFIC.flatMap((c) => [[c, c.id, c.tris, WHEEL_TRIS], [c, c.id + '_far', FAR_TRIS, FAR_WHEEL]])) {
  let r;
  if (keep.has(id)) {
    const n = keep.get(id), p = n.getMesh().listPrimitives()[0], ex = n.getExtras();
    const get = (a) => { const o = []; const e = []; for (let i = 0; i < a.getCount(); i++) o.push(...a.getElement(i, e)); return o; };
    const wm = n.getWorldMatrix(), raw = get(p.getAttribute('POSITION')), P = [];
    for (let i = 0; i < raw.length; i += 3) P.push(...mulP(wm, raw[i], raw[i + 1], raw[i + 2]));
    r = { id, P, N: get(p.getAttribute('NORMAL')), C: get(p.getAttribute('COLOR_0')), M: get(p.getAttribute('_MAT')), IDX: Array.from(p.getIndices().getArray()), len: ex.len, w: ex.w };
  } else r = await bake(cfg, tris, wt, id);
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
