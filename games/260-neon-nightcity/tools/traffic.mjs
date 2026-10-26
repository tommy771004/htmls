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
  // 第二階段：執法、救護、計程車與房車（同一位作者）
  { id: 'urban_cop', pal: false, tris: 4000 },
  { id: 'md84', pal: false, tris: 4400 },
  { id: 'ambulance', pal: false, tris: 4000 },
  { id: 'canyon_taxi', pal: false, tris: 4000 },
  { id: 'fh', pal: true, tris: 3600 },
  { id: 'il', pal: true, tris: 3600 },
  // HANDOFF 補完：拖吊車、消防局長車（同一位作者）與 FixedShark554 的消防車（69-v8-fire.js 的消防派遣）
  { id: 'tow', pal: true, tris: 4200 },
  { id: 'fire_chief', pal: false, tris: 4000 },
  { id: 'firetruck', pal: false, tris: 4800 },
  // 直接讀原檔（raw，.cache/raw/）：不是車，不走 cars.mjs。scale 縮放、rot 繞 y 轉（度，轉完車頭朝 +z）、nodes 只取哪些節點；
  // 同一個原檔的各部件共用同一個原點（整檔或 center 指定節點的底面中心），part: true 的部件再把自己的中心移到原點（轉軸），偏移記在 extras.piv
  { id: 'heli', raw: 'as350_b2', scale: 99, rot: 180, nodes: /^(cabine|patins|tuyere|moyeu)/, pal: false, tris: 3600 },
  { id: 'heli_rotor', raw: 'as350_b2', scale: 99, rot: 180, nodes: /^rotor_pales/, part: true, pivot: [0, 2.988, 1.95], pal: false, tris: 300, noFar: true },
  { id: 'heli_tail', raw: 'as350_b2', scale: 99, rot: 180, nodes: /^rotor_anticouple/, part: true, pal: false, tris: 120, noFar: true },
  // 坦克：原點在車體（Hull）的中心；砲塔轉軸量自砲塔寬的部分（不含砲管）的中心
  { id: 'tank', raw: 'low_poly_abrams_free_model', scale: 1, rot: -90, center: /^Abrams_Hull_/, nodes: /^(?!Abrams_Tower)/, pal: false, tris: 3600 },
  { id: 'tank_turret', raw: 'low_poly_abrams_free_model', scale: 1, rot: -90, center: /^Abrams_Hull_/, nodes: /^Abrams_Tower/, part: true, pivot: [0, 1.53, -.69], pal: false, tris: 1600 },
  { id: 'barricade', raw: 'barricade_set_low_poly_game_ready', scale: 1, rot: 0, nodes: /^(Barricade3L|Light[789]_)/, part: true, pal: false, tris: 500, noFar: true },
  { id: 'cone', raw: 'barricade_set_low_poly_game_ready', scale: 1, rot: 0, nodes: /^ConeTraffic/, part: true, pal: false, tris: 120, noFar: true },
  { id: 'spike', raw: 'spike_strip', scale: 1, rot: 90, part: true, pal: false, tris: 500, noFar: true },
  // 武裝直升機（69-gunship.js）：PolyDucky 的 AH-64 低面數模型，原檔機頭已朝 +z；原點以機身（Object_4）置中，主旋翼與尾旋翼各自拆出來轉。
  // flat：原檔是低面數＋色塊迷彩，焊接時連顏色一起比，色塊才不會在相鄰面之間糊開（面數本來就在 tris 內，不必減面）
  { id: 'gunship', raw: 'ah-64_apache_attack_helicopter_low_poly', scale: 4.8, rot: 0, center: /^Object_4$/, nodes: /^Object_(?!(8|10|11|37|39)$)/, pal: false, tris: 4000, noFar: true, flat: true },
  { id: 'gunship_rotor', raw: 'ah-64_apache_attack_helicopter_low_poly', scale: 4.8, rot: 0, center: /^Object_4$/, nodes: /^Object_(8|10|11)$/, part: true, pal: false, tris: 400, noFar: true, flat: true },
  { id: 'gunship_tail', raw: 'ah-64_apache_attack_helicopter_low_poly', scale: 4.8, rot: 0, center: /^Object_4$/, nodes: /^Object_(37|39)$/, part: true, pal: false, tris: 300, noFar: true, flat: true },
  // world_1 gameready_city 路上的三台車：tools/props.mjs 的 w1_grc 已經切出來、擺正、接地（rawFile 直接讀那個輸出；節點名就是物件 id）。
  // 轎車與白色廂型貨車原檔車頭朝 +x，郵務車朝 +z；車身顏色在貼圖上，不給調色盤
  { id: 'grc_sedan', rawFile: '../../assets/260/props/w1_grc.glb', scale: 1, rot: -90, center: /^sedan$/, nodes: /^sedan$/, pal: false, tris: 2400 },
  { id: 'grc_stepvan', rawFile: '../../assets/260/props/w1_grc.glb', scale: 1, rot: -90, center: /^stepvan$/, nodes: /^stepvan$/, pal: false, tris: 2400 },
  { id: 'grc_mailvan', rawFile: '../../assets/260/props/w1_grc.glb', scale: 1, rot: 0, center: /^mailvan$/, nodes: /^mailvan$/, pal: false, tris: 2400 },
  // 街頭車（26-glb.js 的 street）：車行的實車模型烘成車流版，搶到時才換回實車（68-gta.js 的 streetVeh）；pal 照 cars.json 的 paintable
  { id: 'g63', src: 'g63', pal: true, tris: 4000 },
  { id: 'lc200', src: 'lc200', pal: false, tris: 4000 },
  { id: 'rr06', src: 'rr06', pal: false, tris: 4000 },
  { id: 'ramtrx', src: 'ramtrx', pal: false, tris: 4000 },
  { id: 'ghost', src: 'ghost', pal: true, tris: 4000 },
  { id: 's65', src: 's65', pal: true, tris: 4000 },
  { id: 'm5f90', src: 'm5f90', pal: false, tris: 4000 },
  { id: 'camry', src: 'camry', pal: true, tris: 4000 },
  { id: 'gt500', src: 'gt500', pal: true, tris: 4000 },
  { id: 'viper', src: 'viper', pal: false, tris: 4000 },
  { id: 'senna', src: 'senna', pal: true, tris: 4000 },
  { id: 'r8', src: 'r8', pal: false, tris: 4000 },
  { id: 'evo6', src: 'evo6', pal: false, tris: 4000 },
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
// real：車行的實車（src，貼圖車身）：金屬漆一律當光滑漆面，不判鍍鉻（逐頂點取樣的亮暗會讓鍍鉻與漆面在同一片車身上交錯）
// 燈種照 _EMI.w：1 頭燈、2 尾燈（原檔的自發光）；1.5／2.5 是 tools/lamps.mjs 手量的燈；1.25／2.25 是它照位置找到的燈範圍，
// 頁面的實車逐像素挑底色亮的（頭燈）或紅的（尾燈）發光，這裡在讀檔時逐三角形取樣挑（傳進來的 emi 已經清掉）
function matOf(col, pbr, emi, wheel, pal, real) {
  const lum = .2126 * col[0] + .7152 * col[1] + .0722 * col[2], k = emi[3];
  if (k === 1 || Math.abs(k - 1.5) < .01) return 4;
  if (k === 2 || Math.abs(k - 2.5) < .01) return 5;
  if (emi[0] + emi[1] + emi[2] > .05) return 11;
  if (col[3] < .99) return 1;
  if (wheel) return lum < .04 && pbr[1] < .5 ? 6 : 7;
  if (pbr[3] > .5 && pal) return 0;
  if (pbr[1] > .5 && pbr[0] < .35 && lum > .3 && !real) return 3;   // 暗色的金屬漆當成光滑漆面，不然整台像鍍鉻
  return pbr[0] < .4 || pbr[2] > .3 ? 10 : 2;
}

// 三角形的材質一律取一個（頂點的材質編號在三角形裡內插，兩端不同的話中間會掃過鍍鉻、燈、輪胎，整台變成彩虹條紋）：
// 兩個頂點以上是燈就算燈，其餘取多數
const BARY = [[1 / 3, 1 / 3], [.6, .2], [.2, .6], [.2, .2], [.8, .1], [.1, .8], [.1, .1], [.45, .45], [.45, .1], [.1, .45]];   // 三角形裡取樣的重心座標
const LAMP = new Set([4, 5]);
function triMat(a, b, c) {
  for (const m of [a, b, c]) if (LAMP.has(m) && (m === a) + (m === b) + (m === c) >= 2) return m;
  return a === b || a === c ? a : b === c ? b : a;
}

// 外殼：從四周與上方 17 個方向各畫一張深度圖（正交、512 格），三角形的重心或靠近三個角的點有一個在最前面（2 cm 內）就留下。
// 車行的實車連內裝、引擎、板金內側都建了，全部丟給減面的話幾千面的預算被裡面吃掉，外殼被撕破；
// 車流的材質是不透明的（玻璃也是深色的面），裡面本來就看不到
const SHELL_DIRS = [];
for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; SHELL_DIRS.push([Math.cos(a), 0, Math.sin(a)], [Math.cos(a) * .7071, .7071, Math.sin(a) * .7071]); }
SHELL_DIRS.push([0, 1, 0]);
function shellCull(ix, pos, id) {
  const nT = ix.length / 3, keep = new Uint8Array(nT), G = 512, eps = .02;
  const zb = new Float32Array(G * G);
  for (const d of SHELL_DIRS) {
    const up0 = Math.abs(d[1]) > .9 ? [1, 0, 0] : [0, 1, 0];
    const rx = [up0[1] * d[2] - up0[2] * d[1], up0[2] * d[0] - up0[0] * d[2], up0[0] * d[1] - up0[1] * d[0]], rl = Math.hypot(...rx); for (let k = 0; k < 3; k++) rx[k] /= rl;
    const uy = [d[1] * rx[2] - d[2] * rx[1], d[2] * rx[0] - d[0] * rx[2], d[0] * rx[1] - d[1] * rx[0]];
    const n = pos.length / 3, S = new Float32Array(n), Tt = new Float32Array(n), D = new Float32Array(n);
    let s0 = Infinity, s1 = -Infinity, t0 = Infinity, t1 = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      S[i] = x * rx[0] + y * rx[1] + z * rx[2]; Tt[i] = x * uy[0] + y * uy[1] + z * uy[2]; D[i] = x * d[0] + y * d[1] + z * d[2];
      s0 = Math.min(s0, S[i]); s1 = Math.max(s1, S[i]); t0 = Math.min(t0, Tt[i]); t1 = Math.max(t1, Tt[i]);
    }
    const k = (G - 1) / Math.max(s1 - s0, t1 - t0, 1e-6);
    for (let i = 0; i < n; i++) { S[i] = (S[i] - s0) * k; Tt[i] = (Tt[i] - t0) * k; }
    zb.fill(-Infinity);
    for (let t = 0; t < nT; t++) {
      const a = ix[t * 3], b = ix[t * 3 + 1], c = ix[t * 3 + 2];
      const ax = S[a], ay = Tt[a], bx = S[b], by = Tt[b], cx = S[c], cy = Tt[c];
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); if (Math.abs(area) < 1e-12) continue;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(G - 1, Math.ceil(Math.max(ax, bx, cx)));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(G - 1, Math.ceil(Math.max(ay, by, cy)));
      for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
        const qx = px + .5, qy = py + .5;
        const w0 = ((bx - qx) * (cy - qy) - (by - qy) * (cx - qx)) / area, w1 = ((cx - qx) * (ay - qy) - (cy - qy) * (ax - qx)) / area, w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * D[a] + w1 * D[b] + w2 * D[c], o = py * G + px;
        if (z > zb[o]) zb[o] = z;
      }
    }
    for (let t = 0; t < nT; t++) {
      if (keep[t]) continue;
      const v = [ix[t * 3], ix[t * 3 + 1], ix[t * 3 + 2]];
      const ms = [S, Tt, D].map((A) => (A[v[0]] + A[v[1]] + A[v[2]]) / 3);
      for (const [ws, wv] of [[1, -1], [.5, 0], [.5, 1], [.5, 2]]) {
        const q = [S, Tt, D].map((A, j) => wv < 0 ? ms[j] : ms[j] * ws + A[v[wv]] * (1 - ws));
        const o = Math.min(G - 1, Math.max(0, Math.floor(q[1]))) * G + Math.min(G - 1, Math.max(0, Math.floor(q[0])));
        if (q[2] >= zb[o] - eps) { keep[t] = 1; break; }
      }
    }
  }
  const out = [];
  for (let t = 0; t < nT; t++) if (keep[t]) out.push(ix[t * 3], ix[t * 3 + 1], ix[t * 3 + 2]);
  console.log(`  ${id}：外殼 ${out.length / 3} / ${nT} 面`);
  return new Uint32Array(out);
}

// 每台車分成幾個單元（車身、各個輪子）各自減面：輪框細節多、平面少，按比例分的話面數全被輪框吃掉。
// 每台烘兩級：近景 tris（40 m 內）與遠景 FAR_TRIS（節點名加 _far）
const WHEEL_TRIS = 140, FAR_TRIS = 600, FAR_WHEEL = 24;
async function bake(cfg, tris = cfg.tris, wheelTris = WHEEL_TRIS, id = cfg.id) {
  const doc = await io.read(cfg.rawFile ? resolve(root, cfg.rawFile) : cfg.raw ? resolve(root, '.cache/raw', cfg.raw + '.glb') : srcOf(cfg));
  // raw：縮放＋繞 y 轉，原點移到整檔（不只選到的節點）的底面中心
  let xf = (p) => p, xfN = (n) => n;
  if (cfg.raw || cfg.rawFile) {
    const a = -cfg.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), k = cfg.scale;
    const rot = ([x, y, z]) => [x * c - z * s, y, x * s + z * c];
    let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const node of doc.getRoot().listNodes()) {
      const mesh = node.getMesh(); if (!mesh) continue;
      const wm = node.getWorldMatrix(), xz = !cfg.center || cfg.center.test(node.getName());   // 高度一律看整檔
      for (const prim of mesh.listPrimitives()) {
        const P = prim.getAttribute('POSITION'), e = [];
        for (let i = 0; i < P.getCount(); i++) { P.getElement(i, e); const q = rot(mulP(wm, e[0], e[1], e[2]).map((v) => v * k)); for (let j = 0; j < 3; j++) { if (j !== 1 && !xz) continue; lo[j] = Math.min(lo[j], q[j]); hi[j] = Math.max(hi[j], q[j]); } }
      }
    }
    const o = [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2];
    xf = (p) => { const q = rot(p.map((v) => v * k)); return [q[0] - o[0], q[1] - o[1], q[2] - o[2]]; };
    xfN = rot;
  }
  const real = !cfg.raw && !cfg.rawFile && !!cfg.src;
  const units = new Map();   // 節點名 → { wheel, pos[], nor[], col[], mat[], idx[] }
  let total = 0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    if (cfg.nodes && !cfg.nodes.test(node.getName())) continue;
    const wm = node.getWorldMatrix(), wheel = !cfg.raw && !cfg.rawFile && /^wheel_/.test(node.getName()), un = cfg.raw || cfg.rawFile ? 'body' : node.getName();   // raw 的零件全部合成一個單元一起減面
    let u = units.get(un);
    if (!u) units.set(un, (u = { wheel, pos: [], nor: [], col: [], mat: [], idx: [] }));
    for (const prim of mesh.listPrimitives()) {
      const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), C = prim.getAttribute('COLOR_0');
      const PB = prim.getAttribute('_PBR'), E = prim.getAttribute('_EMI'), UV = prim.getAttribute('TEXCOORD_0');
      const mat = prim.getMaterial(), tex = mat?.getBaseColorTexture(), bcf = cfg.raw && mat ? mat.getBaseColorFactor() : [1, 1, 1, 1];
      const rawPbr = (cfg.raw || cfg.rawFile) && mat ? [mat.getRoughnessFactor(), mat.getMetallicFactor(), 0, 0] : null;
      const px = tex && UV ? await texPixels(tex) : null;
      const n = P.getCount(), base = u.pos.length / 3;
      const a = [], b = [], c = [], d = [], e = [], uv = [];
      const vdet = new Uint8Array(n), vmet = new Uint8Array(n), vc = [], vuv = [];   // lamps.mjs 偵測到的燈範圍（1.25／2.25）：留著頂點色與 UV，下面逐三角形挑
      for (let i = 0; i < n; i++) {
        P.getElement(i, a); N.getElement(i, b); C ? C.getElement(i, c) : c.splice(0, 4, 1, 1, 1, 1);
        PB ? PB.getElement(i, d) : d.splice(0, 4, ...(rawPbr || [.6, 0, 0, 0])); E ? E.getElement(i, e) : e.splice(0, 4, 0, 0, 0, 0);
        let rgb = [c[0] * bcf[0], c[1] * bcf[1], c[2] * bcf[2]];
        vc.push(rgb[0], rgb[1], rgb[2], c[3]); vmet[i] = d[1] > .5 ? 1 : 0;
        if (px) { UV.getElement(i, uv); vuv.push(uv[0], uv[1]); const s = sample(px, uv[0], uv[1]); rgb = [rgb[0] * s[0], rgb[1] * s[1], rgb[2] * s[2]]; }
        if (Math.abs(e[3] - Math.floor(e[3]) - .25) < .01) { vdet[i] = Math.floor(e[3]); e.splice(0, 4, 0, 0, 0, 0); }
        const m = matOf([...rgb, c[3]], d, e, wheel, cfg.pal, real);
        // 燈：頂點色換成燈光的顏色（亮度交給 shader）；柔和自發光（燈條、儀表）壓暗，免得泛光整台爆白
        if (m === 4 || m === 11) { const l = Math.max(e[0], e[1], e[2]); if (l > .05) rgb = [e[0] / l, e[1] / l, e[2] / l]; if (m === 11) rgb = rgb.map((v) => v * .45); }
        if (m === 5 && rgb[0] > .01) rgb = [1, rgb[1] / rgb[0], rgb[2] / rgb[0]];   // 尾燈的顏色正規化，亮度交給 shader
        u.mat.push(m);
        u.pos.push(...xf(mulP(wm, a[0], a[1], a[2]))); u.nor.push(...xfN(mulN(wm, b[0], b[1], b[2]))); u.col.push(...rgb);
      }
      const I = prim.getIndices(), ia = I ? I.getArray() : Array.from({ length: n }, (_, i) => i);
      for (let f = 0; f < ia.length; f += 3) {
        const t = [ia[f], ia[f + 1], ia[f + 2]], k = vdet[t[0]] && (vdet[t[0]] === vdet[t[1]] || vdet[t[0]] === vdet[t[2]]) ? vdet[t[0]] : vdet[t[1]] && vdet[t[1]] === vdet[t[2]] ? vdet[t[1]] : 0;
        if (!k) { for (const v of t) u.idx.push(base + v); continue; }
        // 燈範圍裡的三角形：在三角形裡取 10 個點的底色，三成以上是紅的（尾燈）或亮的（頭燈）就整片是燈。
        // 低模的燈常常落在大三角形中間，只看頂點會整個漏掉；燈罩後面的燈芯也被 shellCull 拿掉了，所以燈罩本身要亮
        let hit = 0; const acc = [0, 0, 0];
        for (const [wa, wb] of BARY) {
          const w = [wa, wb, 1 - wa - wb], col = [0, 1, 2].map((j) => w[0] * vc[t[0] * 4 + j] + w[1] * vc[t[1] * 4 + j] + w[2] * vc[t[2] * 4 + j]);
          const al = w[0] * vc[t[0] * 4 + 3] + w[1] * vc[t[1] * 4 + 3] + w[2] * vc[t[2] * 4 + 3];
          if (px) { const s = sample(px, w[0] * vuv[t[0] * 2] + w[1] * vuv[t[1] * 2] + w[2] * vuv[t[2] * 2], w[0] * vuv[t[0] * 2 + 1] + w[1] * vuv[t[1] * 2 + 1] + w[2] * vuv[t[2] * 2 + 1]); for (let j = 0; j < 3; j++) col[j] *= s[j]; }
          const lum = .2126 * col[0] + .7152 * col[1] + .0722 * col[2], red = col[0] > .05 && col[0] > 2.2 * Math.max(col[1], col[2]);
          // 透明的面只算亮的燈罩，車窗是暗的（亮度 0.03 以下）；頭燈不算不透明的金屬（鍍鉻保險桿、水箱罩）
          if (k === 2 ? red || al < .99 && lum > .1 : lum > .2 && al >= .99 && !(vmet[t[0]] + vmet[t[1]] + vmet[t[2]] >= 2) || al < .99 && lum > .08) { hit++; if (red) for (let j = 0; j < 3; j++) acc[j] += col[j]; }
        }
        if (hit < BARY.length * .3) { for (const v of t) u.idx.push(base + v); continue; }
        const lc = k === 2 ? (acc[0] > .01 ? [1, acc[1] / acc[0], acc[2] / acc[0]] : [1, .05, .03]) : [1, .95, .86];
        for (const v of t) {   // 燈的三角形不和旁邊的車身共用頂點
          u.idx.push(u.pos.length / 3);
          u.pos.push(...u.pos.slice((base + v) * 3, (base + v) * 3 + 3)); u.nor.push(...u.nor.slice((base + v) * 3, (base + v) * 3 + 3)); u.col.push(...lc); u.mat.push(k === 2 ? 5 : 4);
        }
      }
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
      const key = `${Math.round(u.pos[v * 3] * 1000)},${Math.round(u.pos[v * 3 + 1] * 1000)},${Math.round(u.pos[v * 3 + 2] * 1000)},${u.mat[v]}` + (cfg.flat ? `,${u.col.slice(v * 3, v * 3 + 3).map((c) => Math.round(c * 255)).join(',')}` : '');
      let w = wid.get(key);
      if (w == null) { w = wsrc.length; wid.set(key, w); wsrc.push(v); wpos.push(u.pos[v * 3], u.pos[v * 3 + 1], u.pos[v * 3 + 2]); }
      ix[i] = w;
    });
    const pos = new Float32Array(wpos), target = (u.wheel ? wheelTris : bodyTris) * 3;
    let out = real && !u.wheel ? shellCull(ix, pos, id) : ix;
    // 燈的三角形和車身不共用頂點（焊接時連材質一起比），在減面看來是一塊塊獨立的小島，Prune 會整塊拿掉：另外減面、不 Prune
    const isLamp = (a, t) => LAMP.has(triMat(u.mat[wsrc[a[t]]], u.mat[wsrc[a[t + 1]]], u.mat[wsrc[a[t + 2]]]));
    const li = [], bi = [];
    for (let t = 0; t < out.length; t += 3) (isLamp(out, t) ? li : bi).push(out[t], out[t + 1], out[t + 2]);
    let lamp = new Uint32Array(li);
    out = new Uint32Array(bi);
    const lt = Math.min(lamp.length, Math.round(target * .15 / 3) * 3);
    // 減面只給這一組三角形用到的頂點：meshopt 把位置相同的頂點當成同一個，燈和車身在交界處位置相同，整份頂點一起給的話，
    // 減完的燈三角形會改用車身的頂點（材質跟著變回車身）
    const simp = (ix, tgt, err, opt, sloppyErr) => {
      const loc = new Map(), back = [], lp = [], li = new Uint32Array(ix.length);
      ix.forEach((w, i) => { let o = loc.get(w); if (o == null) { o = back.length; loc.set(w, o); back.push(w); lp.push(pos[w * 3], pos[w * 3 + 1], pos[w * 3 + 2]); } li[i] = o; });
      const P3 = new Float32Array(lp);
      let [r] = MeshoptSimplifier.simplify(li, P3, 3, tgt, err, opt);
      if (r.length > tgt * 1.5) [r] = MeshoptSimplifier.simplifySloppy(r, P3, 3, null, tgt, sloppyErr);
      return r.map((o) => back[o]);
    };
    if (lamp.length > lt) lamp = simp(lamp, lt, .03, [], .03);
    const bt = Math.max(target / 2, target - lamp.length);
    // Prune：整塊小零件（螺絲、徽章）在誤差內可以直接拿掉
    if (out.length > bt) out = simp(out, bt, u.wheel ? .1 : .025, ['Prune'], u.wheel ? 1 : .03);
    if (lamp.length) { const m = new Uint32Array(out.length + lamp.length); m.set(out); m.set(lamp, out.length); out = m; }
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
      // 一個三角形一個材質（_MAT 在 shader 裡是內插的：三個頂點材質不同時，中間會內插出鍍鉻、燈、輪胎等其他編號，車身變成一條條彩色的帶）；
      // 燈優先（小塊，不然減面後就被車身吃掉），其餘取多數
      const tm = triMat(u.mat[wsrc[out[t]]], u.mat[wsrc[out[t + 1]]], u.mat[wsrc[out[t + 2]]]);
      for (let k = 0; k < 3; k++) {
        const w = out[t + k], src = wsrc[w];
        const n = [0, 0, 0];
        for (const g of adj.get(w)) { const h = fn[g]; if (h[0] * f[0] + h[1] * f[1] + h[2] * f[2] > .766) { n[0] += h[0]; n[1] += h[1]; n[2] += h[2]; } }
        const l = Math.hypot(...n) || 1;
        const key = `${w}|${tm}|${Math.round(n[0] / l * 20)},${Math.round(n[1] / l * 20)},${Math.round(n[2] / l * 20)}`;
        let o = vmap.get(key);
        if (o == null) {
          o = P.length / 3; vmap.set(key, o);
          P.push(pos[w * 3], pos[w * 3 + 1], pos[w * 3 + 2]); N.push(n[0] / l, n[1] / l, n[2] / l);
          C.push(u.col[src * 3], u.col[src * 3 + 1], u.col[src * 3 + 2]); M.push(tm);
        }
        IDX.push(o);
      }
    }
  }
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = 0;
  for (let i = 0; i < P.length; i += 3) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); y0 = Math.min(y0, P[i + 1]); y1 = Math.max(y1, P[i + 1]); z0 = Math.min(z0, P[i + 2]); z1 = Math.max(z1, P[i + 2]); }
  // 部件：轉軸移到原點（pivot 給的是轉軸在整檔座標裡的 x、y、z，沒給就用部件自己的中心），原本的位置記在 piv
  let piv = null;
  if (cfg.part) {
    piv = cfg.pivot || [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    for (let i = 0; i < P.length; i += 3) { P[i] -= piv[0]; P[i + 1] -= piv[1]; P[i + 2] -= piv[2]; }
    piv = piv.map((v) => +v.toFixed(3));
  }
  console.log(`${id}: ${total} → ${IDX.length / 3} 面（輪子 ${nWheel} 個），${P.length / 3} 頂點，${(x1 - x0).toFixed(2)}×${y1.toFixed(2)}×${(z1 - z0).toFixed(2)} m`);
  return { id, P, N, C, M, IDX, len: +(z1 - z0).toFixed(2), w: +(x1 - x0).toFixed(2), h: +(y1 - y0).toFixed(2), piv };
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
for (const [cfg, id, tris, wt] of TRAFFIC.flatMap((c) => [[c, c.id, c.tris, WHEEL_TRIS], ...(c.noFar ? [] : [[c, c.id + '_far', FAR_TRIS, FAR_WHEEL]])])) {
  let r;
  if (keep.has(id)) {
    const n = keep.get(id), p = n.getMesh().listPrimitives()[0], ex = n.getExtras();
    const get = (a) => { const o = []; const e = []; for (let i = 0; i < a.getCount(); i++) o.push(...a.getElement(i, e)); return o; };
    const wm = n.getWorldMatrix(), raw = get(p.getAttribute('POSITION')), P = [];
    for (let i = 0; i < raw.length; i += 3) P.push(...mulP(wm, raw[i], raw[i + 1], raw[i + 2]));
    r = { id, P, N: get(p.getAttribute('NORMAL')), C: get(p.getAttribute('COLOR_0')), M: get(p.getAttribute('_MAT')), IDX: Array.from(p.getIndices().getArray()), len: ex.len, w: ex.w, h: ex.h, piv: ex.piv };
  } else r = await bake(cfg, tris, wt, id);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', acc(r.P, 'VEC3', Float32Array)).setAttribute('NORMAL', acc(r.N, 'VEC3', Float32Array))
    .setAttribute('COLOR_0', acc(r.C, 'VEC3', Float32Array)).setAttribute('_MAT', acc(r.M, 'SCALAR', Float32Array))
    .setIndices(acc(r.IDX, 'SCALAR', Uint32Array));
  const node = doc.createNode(r.id).setMesh(doc.createMesh(r.id).addPrimitive(prim)).setExtras({ len: r.len, w: r.w, h: r.h, pal: cfg.pal, ...(r.piv ? { piv: r.piv } : {}) });
  scene.addChild(node);
}
await doc.transform(quantize({ pattern: /^(POSITION|NORMAL|COLOR_0)$/ }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
await io.write(out, doc);
console.log(`${out}: ${(statSync(out).size / 1024).toFixed(0)} KB`);
