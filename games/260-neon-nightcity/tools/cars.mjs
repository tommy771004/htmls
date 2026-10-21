// Sketchfab 車輛模型 → assets/260/<id>.glb 與 assets/260/cars.json
//   node tools/cars.mjs [id…]      來源 GLB 放在 .cache/cars/（gitignore），CARS_SRC=… 可改目錄
// 每台車：攤平場景、依真實車長縮放、車頭朝 +z、接地；找出輪胎落地點拆出可轉動的輪子節點（wheel_FL…，機車 wheel_F／wheel_R），
// 材質係數改成頂點屬性（COLOR_0 底色＋不透明度、_PBR 粗糙／金屬／清漆／車漆旗標、_EMI 自發光＋燈種），同一張貼圖的零件合併成一個 primitive，
// 最後減面、貼圖轉 WebP（最長邊 1024）、meshopt 壓縮。gltf-transform、meshoptimizer 與 sharp 借用 197 的 node_modules。
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(root, '../197-openworld/package.json'));
const imp = (n) => import(pathToFileURL(req.resolve(n)).href);
const { NodeIO } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { prune, dedup, weld, simplify, textureCompress, meshopt } = await imp('@gltf-transform/functions');
const { MeshoptSimplifier, MeshoptEncoder } = await imp('meshoptimizer');
const sharp = (await imp('sharp')).default;

const SRC = process.env.CARS_SRC || resolve(root, '.cache/cars');
const OUT = resolve(root, '../../assets/260');
const OUT_T = resolve(root, '.cache/traffic');   // traffic: true 的車只給 tools/traffic.mjs 烘車流，不進車行（不 commit）

// len：真實車長（公尺）；flip：原檔車頭朝 -z（轉 180°）；tris：減面目標；paint：車漆材質名（沒給就自動挑）
export const MODELS = [
  { id: 'e92', file: '2010_bmw_m3_e92', len: 4.615, tris: 140000 },
  { id: 'm3c', file: 'bmw_m3_competition', len: 4.794, tris: 140000, flip: true },
  { id: 'm4wb', file: 'bmw_m4_modified_widebody', len: 4.85, tris: 130000 },
  { id: 'm3gtr', file: 'bmw_m3_gtr_gt2', len: 4.55, tris: 120000 },
  { id: 'm3t24', file: '2026_bmw_m3_touring_24h_shell_helix', len: 4.9, tris: 140000 },
  { id: 'm4gt3', file: '2025_bmw_m4_gt3_evo_g82', len: 5.02, tris: 110000 },
  { id: 'gt3rs', file: 'porsche_992_gt3_rs', len: 4.572, tris: 140000, flip: true, paint: false },
  { id: 'gt3r', file: '2024_porsche_992_gt3_r', len: 4.619, tris: 140000 },
  { id: 's1krr', file: 'bmw_s1000_rr', len: 2.056, tris: 90000, bike: true, flip: true, paint: false },
  { id: 's1krr19', file: 'bmw_s1000rr_2019', len: 2.073, tris: 90000, bike: true, flip: true, paint: false },
  // 第二批：日系、歐系、超跑與美式肌肉車，減面目標壓低（展示廳一次擺 29 台實車）
  { id: 'r34', file: 'nissan_skyline_r34_gt-r', len: 4.6, tris: 90000 },
  { id: 'r35', file: 'nissan_skyline_gtr_r35', len: 4.71, tris: 90000 },
  { id: 'supra', file: 'toyota_supra_mk4', len: 4.52, tris: 90000 },
  { id: 'rx7', file: 'mazda_rx-7_fd', len: 4.285, tris: 90000 },
  { id: 'nsx', file: 'honda_nsx_1990', len: 4.405, tris: 90000 },
  { id: 'ae86', file: 'toyota_trueno_ae86_initial_d', len: 4.205, tris: 90000, flip: true },
  { id: 'p930', file: 'porsche_911_930_turbo_1975', len: 4.291, tris: 90000 },
  { id: 'rwb', file: 'porsche_911_rauh-welt_free', len: 4.6, tris: 90000, flip: true },
  { id: 'e34', file: 'bmw_e34_stance_style', len: 4.72, tris: 90000, flip: true },
  { id: 'm4csl', file: 'bmw_m4_csl_2023', len: 4.8, tris: 90000 },
  { id: 'evo190', file: 'mercedes_190e_evo_1982_3d_model_free', len: 4.49, tris: 90000 },
  { id: 'f40', file: 'ferrari_f40', len: 4.358, tris: 90000 },
  { id: 'sf90', file: '2023_ferrari_sf90_xx_stradale', len: 4.85, tris: 90000 },
  { id: 'p1', file: 'mclaren_p1__www.vecarz.com', len: 4.588, tris: 90000 },
  { id: 'chall', file: 'free__dodge_challenger_srt', len: 5.02, tris: 90000 },
  { id: 'zr1', file: '2019_chevrolet_corvette_zr1', len: 4.49, tris: 90000 },
  { id: 'police', file: 'police_car', len: 5.3, tris: 90000 },
  { id: 'v4', file: 'ducati_panigale_v4', len: 2.11, tris: 70000, bike: true, flip: true, paint: false },
  { id: 'zx6r', file: 'kawasaki_ninja_zx-6r', len: 2.025, tris: 70000, bike: true, paint: false, opaque: true, noEmi: true,
    wheelNodes: { F: ['^Front Wheel_', '^Front Rim_'], R: ['^Rear Wheel_', '^Rear Rim_'] } },
  // 車流專用（DanielZhabotinsky 的虛構廠牌低多邊形車與 French delivery van，CC BY 4.0；原檔車頭都朝 -z，只有廂型車不用轉）：輸出到 .cache/traffic/，再由 tools/traffic.mjs 烘進 traffic.glb
  { id: 'fh_taxi', file: 'fairheaven_lt_80_taxi_-_low_poly_model', len: 5.07, tris: 30000, traffic: true, flip: true },
  { id: 'fh_cop', file: 'fairheaven_lt_80_cop_cruiser_-_low_poly_model', len: 5.07, tris: 30000, traffic: true, flip: true },
  { id: 'il_cop', file: 'illinois_90_police_cruiser_-_low_poly_model', len: 5.21, tris: 30000, traffic: true, flip: true },
  { id: 'negotiator', file: 'negotiator_80_-_low_poly_model', len: 4.94, tris: 30000, traffic: true, flip: true },
  { id: 'milano', file: 'milano_95_-_low_poly_model', len: 3.85, tris: 30000, traffic: true, flip: true },
  { id: 'kiri', file: 'kiri_86_-_low_poly_model', len: 4.31, tris: 30000, traffic: true, flip: true },
  { id: 'carter', file: 'carter_98_-_low_poly_model', len: 5.02, tris: 30000, traffic: true, flip: true },
  { id: 'compact', file: 'compact_07_-_low_poly_model', len: 2.69, tris: 30000, traffic: true, flip: true },
  { id: 'urban', file: 'urban_10_-_low_poly_model', len: 4.29, tris: 30000, traffic: true, flip: true },
  { id: 'tiara', file: 'tiara_gt_83_-_low_poly_model', len: 4.17, tris: 30000, traffic: true, flip: true },
  { id: 'shvan', file: 'shvan_92_-_low_poly_model', len: 4.9, tris: 30000, traffic: true, flip: true },
  { id: 'lct', file: 'lct_3000_95_-_low_poly_model', len: 6.02, tris: 30000, traffic: true, flip: true },
  { id: 'conquer', file: 'conquer_89_pickup_-_low_poly_model', len: 5.22, tris: 30000, traffic: true, flip: true },
  { id: 'fvan', file: 'french_delivery_van_-_low_poly_model', len: 4.3, tris: 30000, traffic: true },
];
const CFG = JSON.parse(existsSync(resolve(root, 'tools/cars.cfg.json')) ? readFileSync(resolve(root, 'tools/cars.cfg.json'), 'utf8') : '{}');

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;

// ─── 小工具：4×4 矩陣（column-major，gltf 慣例） ───
const mulPt = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
function normalMat(m) {   // 左上 3×3 的反轉置
  const [a, b, c, d, e, f, g, h, i] = [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C || 1;
  return { det, n: [A / det, B / det, C / det, -(b * i - c * h) / det, (a * i - c * g) / det, -(a * h - b * g) / det, (b * f - c * e) / det, -(a * f - c * d) / det, (a * e - b * d) / det] };
}
const lum = (c) => c[0] * .2126 + c[1] * .7152 + c[2] * .0722;

async function processModel(M) {
  const cfg = { ...M, ...(CFG[M.id] || {}) };
  const src = resolve(SRC, M.file + '.glb');
  const doc = await io.read(src);
  const R = doc.getRoot();
  const info = R.getAsset().extras || {};
  const scene = R.getDefaultScene() || R.listScenes()[0];

  // ─── 1. 收集每個 primitive 的世界座標幾何 ───
  const prims = [];
  scene.traverse((node) => {
    const mesh = node.getMesh(); if (!mesh) return;
    const wm = node.getWorldMatrix();
    const { det, n: nm } = normalMat(wm);
    for (const p of mesh.listPrimitives()) {
      if (p.getMode() !== 4) continue;
      const pa = p.getAttribute('POSITION'); if (!pa) continue;
      const mat = p.getMaterial();
      const cnt = pa.getCount();
      const pos = new Float32Array(cnt * 3), nor = new Float32Array(cnt * 3);
      const na = p.getAttribute('NORMAL');
      const t = [0, 0, 0], tn = [0, 0, 0];
      for (let i = 0; i < cnt; i++) {
        pa.getElement(i, t); const w = mulPt(wm, t[0], t[1], t[2]); pos.set(w, i * 3);
        if (na) { na.getElement(i, tn); const x = nm[0] * tn[0] + nm[3] * tn[1] + nm[6] * tn[2], y = nm[1] * tn[0] + nm[4] * tn[1] + nm[7] * tn[2], z = nm[2] * tn[0] + nm[5] * tn[1] + nm[8] * tn[2]; const l = Math.hypot(x, y, z) || 1; nor.set([x / l, y / l, z / l], i * 3); }
        else nor.set([0, 1, 0], i * 3);
      }
      // 底色貼圖用的 UV（含 KHR_texture_transform 烘進 UV）
      const ti = !mat ? null : mat.getBaseColorTexture() ? mat.getBaseColorTextureInfo() : mat.getEmissiveTexture() ? mat.getEmissiveTextureInfo() : null;
      let uv = null;
      if (ti) {
        const tr = ti.getExtension('KHR_texture_transform');
        const set = tr && tr.getTexCoord() != null ? tr.getTexCoord() : ti.getTexCoord();
        const ua = p.getAttribute('TEXCOORD_' + set) || p.getAttribute('TEXCOORD_0');
        if (ua) {
          uv = new Float32Array(cnt * 2); const e = [0, 0];
          const [ox, oy] = tr ? tr.getOffset() : [0, 0], [sx, sy] = tr ? tr.getScale() : [1, 1], r = tr ? tr.getRotation() : 0, cr = Math.cos(r), sr = Math.sin(r);
          for (let i = 0; i < cnt; i++) { ua.getElement(i, e); const u = e[0] * sx, v = e[1] * sy; uv[i * 2] = cr * u + sr * v + ox; uv[i * 2 + 1] = -sr * u + cr * v + oy; }
        }
      }
      const ia = p.getIndices();
      let idx = ia ? Uint32Array.from(ia.getArray()) : Uint32Array.from({ length: cnt }, (_, i) => i);
      if (det < 0) for (let i = 0; i < idx.length; i += 3) { const s = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = s; }
      prims.push({ mat, pos, nor, uv, idx, cnt, node: node.getName() });
    }
  });

  // ─── 2. 擺正：長軸轉到 z、車頭朝 +z、依車長縮放、置中、接地 ───
  const bb = () => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (const p of prims) for (let i = 0; i < p.cnt; i++) for (let k = 0; k < 3; k++) { const v = p.pos[i * 3 + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; } return { mn, mx }; };
  let b = bb();
  const alongX = (b.mx[0] - b.mn[0]) > (b.mx[2] - b.mn[2]);
  const yawQ = (alongX ? 1 : 0) + (cfg.flip ? 2 : 0);   // 以 90° 為單位繞 y 轉
  const rotY = (x, z) => { let a = x, c = z; for (let q = 0; q < yawQ; q++) [a, c] = [c, -a]; return [a, c]; };
  for (const p of prims) for (let i = 0; i < p.cnt; i++) {
    const [x, z] = rotY(p.pos[i * 3], p.pos[i * 3 + 2]); p.pos[i * 3] = x; p.pos[i * 3 + 2] = z;
    const [nx, nz] = rotY(p.nor[i * 3], p.nor[i * 3 + 2]); p.nor[i * 3] = nx; p.nor[i * 3 + 2] = nz;
  }
  // 去掉貼地的陰影平面（很薄、很大、在最底下）
  for (const p of prims) {
    let mn = 1e9, mx = -1e9; for (let i = 0; i < p.cnt; i++) { const y = p.pos[i * 3 + 1]; mn = Math.min(mn, y); mx = Math.max(mx, y); }
    p.flat = mx - mn;
  }
  b = bb();
  const s = cfg.len / (b.mx[2] - b.mn[2]);
  const cx = (b.mx[0] + b.mn[0]) / 2, cz = (b.mx[2] + b.mn[2]) / 2;
  for (const p of prims) for (let i = 0; i < p.cnt; i++) { p.pos[i * 3] = (p.pos[i * 3] - cx) * s; p.pos[i * 3 + 1] = (p.pos[i * 3 + 1] - b.mn[1]) * s; p.pos[i * 3 + 2] = (p.pos[i * 3 + 2] - cz) * s; }

  // ─── 3. 連通塊與輪子 ───
  const comps = [];   // 每個 primitive 的每個連通塊：bbox
  for (const p of prims) {
    const par = new Int32Array(p.cnt).map((_, i) => i);
    const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    for (let i = 0; i < p.idx.length; i += 3) { const a = find(p.idx[i]), c = find(p.idx[i + 1]), d = find(p.idx[i + 2]); par[c] = a; par[d] = a; }
    const id = new Map(); p.comp = new Int32Array(p.cnt);
    for (let i = 0; i < p.cnt; i++) {
      const r = find(i); let k = id.get(r);
      if (k == null) { k = comps.length; id.set(r, k); comps.push({ mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9], prim: p, n: 0 }); }
      p.comp[i] = k; const c = comps[k]; c.n++;
      for (let j = 0; j < 3; j++) { const v = p.pos[i * 3 + j]; if (v < c.mn[j]) c.mn[j] = v; if (v > c.mx[j]) c.mx[j] = v; }
    }
  }
  b = bb();
  const H = b.mx[1];
  // 貼地的薄片（陰影平面）不算
  for (const c of comps) c.shadow = c.mx[1] - c.mn[1] < .01 && c.mn[1] < .02 && (c.mx[0] - c.mn[0]) * (c.mx[2] - c.mn[2]) > cfg.len * .6;
  const ground = Math.min(...comps.filter((c) => !c.shadow).map((c) => c.mn[1]));
  if (process.env.DEBUG) for (const c of comps.filter((c) => c.mn[1] < ground + .05).sort((a, c) => c.n - a.n).slice(0, 12)) console.log('ground comp', c.n, c.mn.map((v) => v.toFixed(2)).join(','), c.mx.map((v) => v.toFixed(2)).join(','), c.prim.mat?.getName());
  const slots = M.bike ? [['F', (c) => (c.mn[2] + c.mx[2]) > 0], ['R', (c) => (c.mn[2] + c.mx[2]) <= 0]]
    : [['FL', (c) => c.mx[0] + c.mn[0] > 0 && c.mn[2] + c.mx[2] > 0], ['FR', (c) => c.mx[0] + c.mn[0] <= 0 && c.mn[2] + c.mx[2] > 0], ['RL', (c) => c.mx[0] + c.mn[0] > 0 && c.mn[2] + c.mx[2] <= 0], ['RR', (c) => c.mx[0] + c.mn[0] <= 0 && c.mn[2] + c.mx[2] <= 0]];
  const wheels = [];
  // wheelNodes：{ 輪位: [輪胎節點名, 輪框等節點名] } 直接依原檔節點名拆輪子（輪胎和前叉、擋泥板黏在一起時用）
  const WN = cfg.wheelNodes && Object.entries(cfg.wheelNodes).map(([name, [tire, parts]]) => ({ name, tire: new RegExp(tire), parts: new RegExp(parts || '^$') }));
  if (WN) for (const { name, tire } of WN) {
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const c of comps) if (tire.test(c.prim.node)) for (let j = 0; j < 3; j++) { mn[j] = Math.min(mn[j], c.mn[j]); mx[j] = Math.max(mx[j], c.mx[j]); }
    if (mn[0] > mx[0]) { console.log(`  ${M.id} ${name}：找不到節點 ${tire}`); continue; }
    const r = (mx[1] - mn[1]) / 2;
    wheels.push({ name, x: (mn[0] + mx[0]) / 2, y: ground + r, z: (mn[2] + mx[2]) / 2, r, x0: mn[0], x1: mx[0], front: name[0] === 'F', re: [tire, WN.find((w) => w.name === name).parts] });
  }
  for (const [name, inSlot] of WN ? [] : slots) {
    // 落地的連通塊（輪胎可能拆成好幾段胎面）→ 同材質、同一個前後位置的塊合起來就是整顆輪胎
    const g = comps.filter((c) => !c.shadow && c.mn[1] < ground + .03 && inSlot(c) && c.mx[2] - c.mn[2] < 1.2 && c.mx[0] - c.mn[0] < .6);
    if (!g.length) continue;
    const big = g.sort((a, c) => c.n - a.n)[0];
    const cz0 = (big.mn[2] + big.mx[2]) / 2, cx0 = (big.mn[0] + big.mx[0]) / 2;
    const mset = new Set(g.map((c) => c.prim.mat));
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const c of comps) {
      if (c.shadow || !mset.has(c.prim.mat) || Math.abs((c.mn[2] + c.mx[2]) / 2 - cz0) > .55 || c.mx[2] - c.mn[2] > 1.2 || c.mx[1] > 1.3) continue;
      if (c.mx[0] < cx0 - .3 || c.mn[0] > cx0 + .3) continue;
      for (let j = 0; j < 3; j++) { mn[j] = Math.min(mn[j], c.mn[j]); mx[j] = Math.max(mx[j], c.mx[j]); }
    }
    const dy = mx[1] - mn[1], dz = mx[2] - mn[2];
    if (!(dy > .4 && dy < 1.0 && dz / dy > .8 && dz / dy < 1.35)) { console.log(`  ${M.id} ${name}：輪胎不成圓（${dy.toFixed(2)}×${dz.toFixed(2)}），輪子不拆`); continue; }
    const r = dy / 2;
    wheels.push({ name, x: (mn[0] + mx[0]) / 2, y: ground + r, z: dz / dy < 1.15 ? (mn[2] + mx[2]) / 2 : cz0, r, x0: mn[0], x1: mx[0], front: name[0] === 'F' });
  }
  // 輪框、碟盤、卡鉗：整塊落在輪子圓柱內的連通塊
  for (const c of comps) {
    c.slot = -1;
    if (c.shadow) continue;
    if (WN) { c.slot = wheels.findIndex((w) => w.re.some((re) => re.test(c.prim.node))); continue; }
    wheels.forEach((w, k) => {
      if (c.slot >= 0) return;
      const R1 = w.r * 1.03;
      if (c.mn[1] < w.y - R1 || c.mx[1] > w.y + R1 || c.mn[2] < w.z - R1 || c.mx[2] > w.z + R1) return;
      // 角落也要在圓內（排除剛好塞進方框的車身碎片）
      const fy = Math.max(Math.abs(c.mn[1] - w.y), Math.abs(c.mx[1] - w.y)), fz = Math.max(Math.abs(c.mn[2] - w.z), Math.abs(c.mx[2] - w.z));
      if (Math.min(fy, fz) > R1 * .75 && Math.hypot(fy, fz) > R1 * 1.2) return;
      const inward = M.bike ? .12 : .28, out = M.bike ? .12 : .04;
      const lo = M.bike ? w.x0 - inward : w.x > 0 ? w.x0 - inward : w.x0 - out, hi = M.bike ? w.x1 + out : w.x > 0 ? w.x1 + out : w.x1 + inward;
      if (c.mn[0] < lo || c.mx[0] > hi) return;
      c.slot = k;
    });
  }

  // ─── 4. 材質 → 頂點屬性；車漆材質 ───
  const mats = [...new Set(prims.map((p) => p.mat))];
  const triOf = new Map(); for (const p of prims) triOf.set(p.mat, (triOf.get(p.mat) || 0) + p.idx.length / 3);
  let paint = cfg.paint === false ? [] : cfg.paint ? mats.filter((m) => m && cfg.paint.includes(m.getName())) : [];
  if (!paint.length && cfg.paint !== false) {
    const named = mats.filter((m) => m && /paint/i.test(m.getName()) && !/^int|_int|interior|accent|spoiler/i.test(m.getName()));
    const coat = mats.filter((m) => m && (m.getExtension('KHR_materials_clearcoat')?.getClearcoatFactor() || 0) >= .3 && m.getAlphaMode() === 'OPAQUE');
    const pick = (named.length ? named : coat).sort((a, c) => triOf.get(c) - triOf.get(a))[0];
    if (pick) paint = [pick];
  }
  const paintable = paint.length > 0 && paint.every((m) => !m.getBaseColorTexture());   // 有彩繪貼圖的不能換色
  const matInfo = (m) => {
    if (!m) return { col: [.6, .6, .6, 1], pbr: [.6, 0, 0, 0], emi: [0, 0, 0], key: 'flat|OPAQUE|0', tex: null, etex: null, blend: false, double: false };
    const bc = m.getBaseColorFactor();
    let a = bc[3], blend = m.getAlphaMode() === 'BLEND' && !(cfg.opaque && bc[3] > .99);   // opaque：原檔整台標成 BLEND 但其實不透明
    const tr = m.getExtension('KHR_materials_transmission');
    if (tr && tr.getTransmissionFactor() > .1) { blend = true; a = Math.min(a, 1 - tr.getTransmissionFactor() * .8); }
    const es = m.getExtension('KHR_materials_emissive_strength')?.getEmissiveStrength() ?? 1;
    const ef = cfg.noEmi ? [0, 0, 0] : m.getEmissiveFactor().map((v) => v * es);   // noEmi：原檔把底色貼圖也接到自發光（無光照的匯出）
    const coat = m.getExtension('KHR_materials_clearcoat')?.getClearcoatFactor() || 0;
    const tex = m.getBaseColorTexture(), etex = cfg.noEmi ? null : m.getEmissiveTexture();
    const mask = m.getAlphaMode() === 'MASK';
    const ti = tex ? m.getBaseColorTextureInfo() : null;
    const key = [tex ? tex.getName() + tex.getURI() + (R.listTextures().indexOf(tex)) : 'flat', etex ? R.listTextures().indexOf(etex) : '-', blend ? 'BLEND' : mask ? 'MASK' : 'OPAQUE', m.getDoubleSided() ? 1 : 0, ti ? ti.getWrapS() + ':' + ti.getWrapT() : ''].join('|');
    return { col: [bc[0], bc[1], bc[2], blend ? a : 1], pbr: [m.getRoughnessFactor(), m.getMetallicFactor(), coat, paint.includes(m) ? 1 : 0], emi: ef, key, tex, etex, ti, blend, mask, cutoff: m.getAlphaCutoff(), double: m.getDoubleSided() };
  };
  const MI = new Map(mats.map((m) => [m, matInfo(m)]));

  // ─── 5. 依（材質群組 × 輪子）重新組合 ───
  const groups = new Map();   // key|slot → { mi, pos[], nor[], uv[], col[], pbr[], emi[], idx[] }
  for (const p of prims) {
    const mi = MI.get(p.mat);
    const remap = new Map();
    for (let i = 0; i < p.idx.length; i += 3) {
      const comp = comps[p.comp[p.idx[i]]];
      if (comp.shadow) continue;
      const gk = mi.key + '#' + comp.slot;
      let g = groups.get(gk);
      if (!g) { g = { mi, slot: comp.slot, pos: [], nor: [], uv: [], col: [], pbr: [], emi: [], idx: [], n: 0 }; groups.set(gk, g); }
      for (let k = 0; k < 3; k++) {
        const v = p.idx[i + k], rk = gk + ':' + v;
        let o = remap.get(rk);
        if (o == null) {
          o = g.n++; remap.set(rk, o);
          const w = comp.slot >= 0 ? wheels[comp.slot] : null;
          g.pos.push(p.pos[v * 3] - (w ? w.x : 0), p.pos[v * 3 + 1] - (w ? w.y : 0), p.pos[v * 3 + 2] - (w ? w.z : 0));
          g.nor.push(p.nor[v * 3], p.nor[v * 3 + 1], p.nor[v * 3 + 2]);
          if (mi.tex || mi.etex) g.uv.push(p.uv ? p.uv[v * 2] : 0, p.uv ? p.uv[v * 2 + 1] : 0);
          g.col.push(...mi.col); g.pbr.push(...mi.pbr);
          // 自發光種類：1 車頭燈（前 1/4）、2 尾燈（後 1/4），遊戲裡隨開燈與煞車變亮；0 其他（儀表、車內燈）
          const ez = p.pos[v * 3 + 2], lit = mi.emi[0] + mi.emi[1] + mi.emi[2] > .05;
          g.emi.push(...mi.emi, !lit ? 0 : ez > cfg.len * .25 ? 1 : ez < -cfg.len * .25 ? 2 : 0);
        }
        g.idx.push(o);
      }
    }
  }

  // ─── 6. 重建文件：car（含 extras 規格）→ body、wheel_* ───
  for (const a of R.listAnimations()) a.dispose();   // 原檔的動畫（開門、轉輪）指向已拆掉的節點
  for (const k of R.listSkins()) k.dispose();
  for (const n of R.listNodes()) n.dispose();
  for (const m of R.listMeshes()) m.dispose();
  const oldMats = R.listMaterials();
  const buf = R.listBuffers()[0] || doc.createBuffer();
  const out = doc.createNode('car');
  scene.addChild(out);
  const matCache = new Map();
  const mkMat = (mi) => {
    if (matCache.has(mi.key)) return matCache.get(mi.key);
    const m = doc.createMaterial('nc|' + (mi.blend ? 'blend' : mi.mask ? 'mask' : 'opaque')).setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(1).setDoubleSided(mi.double);
    if (mi.blend) m.setAlphaMode('BLEND'); else if (mi.mask) m.setAlphaMode('MASK').setAlphaCutoff(mi.cutoff);
    if (mi.tex) { m.setBaseColorTexture(mi.tex); m.getBaseColorTextureInfo().setWrapS(mi.ti.getWrapS()).setWrapT(mi.ti.getWrapT()); }
    if (mi.etex) m.setEmissiveTexture(mi.etex).setEmissiveFactor([1, 1, 1]);
    matCache.set(mi.key, m); return m;
  };
  const acc = (arr, type, Ctor) => doc.createAccessor().setType(type).setArray(new Ctor(arr)).setBuffer(buf);
  const meshes = new Map();
  for (const g of groups.values()) {
    if (!g.idx.length) continue;
    let mesh = meshes.get(g.slot);
    if (!mesh) {
      mesh = doc.createMesh(g.slot < 0 ? 'body' : 'wheel_' + wheels[g.slot].name);
      const node = doc.createNode(mesh.getName()).setMesh(mesh);
      if (g.slot >= 0) { const w = wheels[g.slot]; node.setTranslation([w.x, w.y, w.z]); }
      out.addChild(node); meshes.set(g.slot, mesh);
    }
    const prim = doc.createPrimitive().setMaterial(mkMat(g.mi))
      .setAttribute('POSITION', acc(g.pos, 'VEC3', Float32Array)).setAttribute('NORMAL', acc(g.nor, 'VEC3', Float32Array))
      .setAttribute('COLOR_0', acc(g.col, 'VEC4', Float32Array)).setAttribute('_PBR', acc(g.pbr, 'VEC4', Float32Array)).setAttribute('_EMI', acc(g.emi, 'VEC4', Float32Array))
      .setIndices(acc(g.idx, 'SCALAR', Uint32Array));
    if (g.mi.tex || g.mi.etex) prim.setAttribute('TEXCOORD_0', acc(g.uv, 'VEC2', Float32Array));
    mesh.addPrimitive(prim);
  }
  for (const m of oldMats) m.dispose();
  for (const ext of doc.getRoot().listExtensionsUsed()) if (!['EXT_meshopt_compression', 'KHR_mesh_quantization', 'EXT_texture_webp'].includes(ext.extensionName)) ext.dispose();

  // ─── 7. 規格與壓縮 ───
  b = bb();
  const trisIn = prims.reduce((a, p) => a + p.idx.length / 3, 0);
  const fw = wheels.filter((w) => w.front), rw = wheels.filter((w) => !w.front);
  const avg = (a, f) => a.length ? a.reduce((s, w) => s + f(w), 0) / a.length : 0;
  const spec = {
    id: M.id, title: info.title, author: info.author, license: info.license, source: info.source, bike: !!M.bike,
    len: +(b.mx[2] - b.mn[2]).toFixed(3), w: +(b.mx[0] - b.mn[0]).toFixed(3), h: +(H - ground).toFixed(3),
    wr: +avg(wheels, (w) => w.r).toFixed(3), fa: +avg(fw, (w) => w.z).toFixed(3), ra: +avg(rw, (w) => w.z).toFixed(3),
    track: +avg(wheels, (w) => Math.abs(w.x)).toFixed(3),
    wheels: wheels.map((w) => ({ name: w.name, x: +w.x.toFixed(3), y: +w.y.toFixed(3), z: +w.z.toFixed(3), r: +w.r.toFixed(3) })),
    paint: paint.map((m) => m.getName()), paintable,
  };
  out.setExtras(spec);
  R.getAsset().extras = { title: info.title, author: info.author, license: info.license, source: info.source };

  await doc.transform(
    prune(), dedup(), weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, cfg.tris / trisIn), error: cfg.err ?? .0012 }),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [cfg.tex ?? 1024, cfg.tex ?? 1024], quality: 82 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  let trisOut = 0; for (const m of R.listMeshes()) for (const p of m.listPrimitives()) trisOut += p.getIndices().getCount() / 3;
  const dir = M.traffic ? OUT_T : OUT;
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, M.id + '.glb');
  await io.write(file, doc);
  spec.tris = trisOut; spec.kb = Math.round(statSync(file).size / 1024);
  spec.draws = R.listMeshes().reduce((a, m) => a + m.listPrimitives().length, 0);
  console.log(`${M.id}: ${Math.round(trisIn)} → ${trisOut} 面、${spec.draws} 個 primitive、${spec.kb} KB；長 ${spec.len} 寬 ${spec.w} 高 ${spec.h}；輪 ${wheels.map((w) => w.name + '@' + w.z.toFixed(2) + '/r' + w.r.toFixed(2)).join(' ')}；車漆 ${spec.paint.join(',') || '（無）'}`);
  return spec;
}

const only = process.argv.slice(2);
const manifestPath = resolve(OUT, 'cars.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const manifestT = resolve(OUT_T, 'cars.json');
const traffic = existsSync(manifestT) ? JSON.parse(readFileSync(manifestT, 'utf8')) : {};
for (const M of MODELS) {
  if (only.length ? !only.includes(M.id) : M.traffic && !process.env.TRAFFIC) continue;   // 車流車型要指名或 TRAFFIC=1 才重做
  (M.traffic ? traffic : manifest)[M.id] = await processModel(M);
}
const ordered = {}; for (const M of MODELS) if (!M.traffic && manifest[M.id]) ordered[M.id] = manifest[M.id];
writeFileSync(manifestPath, JSON.stringify(ordered, null, 1) + '\n');
if (Object.keys(traffic).length) writeFileSync(manifestT, JSON.stringify(traffic, null, 1) + '\n');
