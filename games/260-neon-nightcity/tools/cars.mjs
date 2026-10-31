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
const { prune, dedup, weld, simplify, compactPrimitive, textureCompress, meshopt } = await imp('@gltf-transform/functions');
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
  // 第三批：amogusstrikesback2 的三台超跑（CC BY 4.0）；前後位置燈的節點連著往車頭外伸一公尺多的光束面片（會撐大車長、畫成黑色的長條），整個拿掉
  { id: 'svj', file: 'lamborghini_aventador_lp_770-4_svj', len: 4.943, tris: 90000, drop: /^lights_position_front_and_back/ },
  { id: 'evija', file: 'lotus_evija', len: 4.459, tris: 90000, drop: /^lights_position_front_and_back/,
    wheelNodes: Object.fromEntries(['FL', 'FR', 'BL', 'BR'].map((w) => [w.replace('B', 'R'), [`^wheel${w}_tires`, `^wheel${w}_details`]])) },
  { id: 'spano', file: '2015_gta_spano', len: 4.61, tris: 90000, paint: 'Material.001', drop: /^lights_position_front_and_back/ },
  { id: 'f8', file: 'ferrari_f8_tributo', len: 4.611, tris: 90000, paint: 'Material.001', drop: /^lights_position_front_and_back/ },
  { id: 'scg', file: 'scg_003s', len: 4.77, tris: 90000, paint: 'material', drop: /^lights_position_front_and_back/ },
  { id: 'p9x8', file: 'peugeot_9x8', len: 5.0, tris: 90000, drop: /^lights_position_front_and_back/ },
  { id: 'c110', file: 'bugatti_centodieci', len: 4.6, tris: 90000, drop: /^lights_position_front_and_back/ },
  { id: 'nevera', file: 'rimac_nevera', len: 4.75, tris: 90000, paint: 'Material.001', drop: /^lights_position_front_and_back/ },
  { id: 'f488c', file: 'ferrari_488_challenge_evo', len: 4.65, tris: 90000, paint: 'Material.001', drop: /^lights_position_front_and_back/,
    wheelNodes: Object.fromEntries(['FL', 'FR', 'BL', 'BR'].map((w) => [w.replace('B', 'R'), [`^Wheel${w}_tyres`, `^Wheel${w}_rims`]])) },
  { id: 'sc20', file: 'lamborghini_sc20', len: 4.93, tris: 90000, paint: 'Material.001', drop: /^lights_position_front_and_back/ },
  { id: 'c63dtm', file: 'mercedes-benz_amg_c63_dtm_mk_iii', len: 4.85, tris: 90000, paint: 'Material.001', drop: /^lights_position_front_and_back/ },
  { id: 'spano8', file: 'asphalt_8_-_2015_gta_spano', len: 4.61, tris: 90000 },   // IWillSearchNewModelz 上傳的另一份 Spano（一張貼圖、節點名是 Object_N）
  { id: 'mosler', file: 'mosler_mt900_gtr_xx_twin_turbo_land_shark', len: 4.58, tris: 90000, paint: 'Material.001', drop: /^lights_position_front_and_back/ },
  { id: 'csl3', file: 'bmw_3.0_csl_hommage_concept', len: 4.94, tris: 90000, paint: 'Material.001', drop: /^lights_position_front_and_back/ },
  { id: 'slk55', file: 'mercedes-benz_slk_55_amg', len: 4.134, tris: 90000, paint: 'Material.001', drop: /^lights_position_front_and_back/ },
  { id: 'giulietta', file: '2016_alfa_romeo_giulietta_veloce_1750_tbi_tct', len: 4.351, tris: 90000, paint: 'Material.001', drop: /^lights_position_front_and_back/ },
  // 遊戲拆出來的警車（公分；車身有 HiRes／LowRes／BoxRes 三套，還有粒子、輪位、鏡頭、影子面片等輔助網格）：只留 HiRes 車身、室內與高模輪子
  { id: 'charger', file: 'dodge_charger_srt8_police', len: 5.15, tris: 90000, paint: false,
    drop: /^(BoxRes|LowRes|Particle|WheelPos|Wheel_|Rim_|ShadowPlane|hood_cam|Damage_Effect|Brake|Glow|Rank|Driver)/,
    wheelNodes: Object.fromEntries(['FL', 'FR', 'BL', 'BR'].map((w) => [w.replace('B', 'R'), [`^WheelHiRes_${w}`, `^RimHiRes_${w}`]])) },
  { id: 'energ', file: 'mercedes-benz_vision_ener-g-force', len: 4.7, tris: 90000, paint: 'Material.001', drop: /^lights_position_front_and_back/,
    wheelNodes: Object.fromEntries(['FL', 'FR', 'BL', 'BR'].map((w) => [w.replace('B', 'R'), [`^Wheel${w}_tyre`, `^Wheel${w}_(details|carpaint)`]])) },
  { id: 'v4', file: 'ducati_panigale_v4', len: 2.11, tris: 70000, bike: true, flip: true, paint: false },
  { id: 'zx6r', file: 'kawasaki_ninja_zx-6r', len: 2.025, tris: 70000, bike: true, paint: false, opaque: true, noEmi: true,
    wheelNodes: { F: ['^Front Wheel_', '^Front Rim_'], R: ['^Rear Wheel_', '^Rear Rim_'] } },
  // 街頭車（照 gta5-mods 熱門車款補的類型，不進車行）：汽車混進車流、搶到後換成這裡的實車，開回 GARAGE 07 就收下；機車停在路邊
  { id: 'g63', file: 'mersedes-benz_g63_amg', len: 4.873, tris: 90000, soup: true },
  { id: 'lc200', file: 'toyota_land_cruiser_j200_2017', len: 4.95, tris: 90000, wheelsAt: { FL: [.82, 1.555, .39], FR: [-.82, 1.555, .39], RL: [.82, -1.295, .39], RR: [-.82, -1.295, .39] } },
  // 車身 Material.005 標成 BLEND（alpha .98），當不透明的車漆；原檔沒焊接（snap）
  { id: 'rr06', file: 'range_rover_l405', len: 5.0, tris: 140000, snap: true, paint: 'Material.005', opaque: ['Material.005'] },
  { id: 'ramtrx', file: 'dodge_ram_trx_sandblast_edition', len: 5.92, tris: 90000, soup: true, flip: true },   // 原檔車頭朝 -z
  { id: 'ghost', file: 'rolls-royce_ghost', len: 5.546, tris: 90000, soup: true },
  { id: 's65', file: 'mersedes-benz_s65_w222', len: 5.27, tris: 90000, soup: true },
  { id: 'm5f90', file: 'bmw_m5_f90', len: 4.966, tris: 90000, soup: true, tex: 512, flip: true },   // 原檔是不共用頂點的三角形，一百多個材質：先合併頂點、貼圖壓到 512
  { id: 'camry', file: 'toyota_camry_2020', len: 4.885, tris: 90000, wheelsAt: { FL: [.8, 1.46, .34], FR: [-.8, 1.46, .34], RL: [.8, -1.365, .34], RR: [-.8, -1.365, .34] } },
  { id: 'gt500', file: 'ford_mustang_shelby_gt500', len: 4.818, tris: 90000 },
  { id: 'viper', file: 'dodge_viper_srt_free', len: 4.46, tris: 90000, paint: false },
  { id: 'senna', file: 'mclaren_senna_free', len: 4.744, tris: 90000 },
  { id: 'r8', file: 'audi_r8', len: 4.426, tris: 90000, paint: false },
  { id: 'evo6', file: 'mitsubishi_lancer_evolution_6___www.vecarz.com', len: 4.35, tris: 90000, paint: false },
  { id: 'hd72', file: 'harley-davidson_seventy-two_hd_fxt_2015', len: 2.255, tris: 70000, bike: true, paint: false, wheelsAt: { R: [0, -.7, .33] } },
  { id: 'hdpol', file: 'harley-davidson_police', len: 2.44, tris: 70000, bike: true, paint: false, wtop: .8 },
  { id: 'r6', file: '2015_yamaha_yzf-r6', len: 2.04, tris: 70000, bike: true, flip: true, paint: false, wheelsAt: { R: [0, -.625, .3] } },
  { id: 'z1000', file: 'z1000_2014', len: 2.045, tris: 70000, bike: true, flip: true, paint: false, wheelsAt: { F: [0, .72, .31], R: [0, -.72, .31] }, fork: { r: .09, bar: .36, barH: .1 } },
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
  // 第二階段（通緝與追捕）：執法、救護與更多計程車、房車
  { id: 'urban_cop', file: 'urban_10_cop_enforcer_-_low_poly_model', len: 4.36, tris: 30000, traffic: true, flip: true },
  { id: 'md84', file: 'md_84_armored_-_low_poly_model', len: 6.34, tris: 30000, traffic: true, flip: true },
  { id: 'ambulance', file: 'shvan_92_ambulance_-_low_poly_model', len: 5.02, tris: 30000, traffic: true, flip: true },
  { id: 'canyon_taxi', file: 'canyon_75_taxi_-_low_poly_model', len: 5.31, tris: 30000, traffic: true, flip: true },
  { id: 'fh', file: 'fairheaven_lt_80_-_low_poly_model', len: 5.0, tris: 30000, traffic: true, flip: true },
  { id: 'il', file: 'illinois_90_-_low_poly_model', len: 5.17, tris: 30000, traffic: true, flip: true },
  // HANDOFF 補完：拖吊車與消防局長車（同一位作者），消防車是 FixedShark554 的低面數消防車（車頭朝 +z）
  { id: 'tow', file: 'lightbody_90_md_tow_truck_-_low_poly_model', len: 6.3, tris: 30000, traffic: true, flip: true },
  { id: 'fire_chief', file: 'fairheaven_sw_80_fire_dept._-_low_poly_model', len: 5.3, tris: 30000, traffic: true, flip: true },
  { id: 'firetruck', file: 'fire_enginefire_truck_low_poly_game_asset', len: 9.2, tris: 30000, traffic: true },
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

// snap 的原檔是很密的曲面：只看位置的減面會留下跨過曲率大的地方的長三角形，沿用舊法線在車漆的反射上變成一道道皺褶。
// 改用 simplifyWithAttributes 把法線的差也算進誤差（權重 .5），曲面上法線變化大的地方就留著
const simplifyN = (ratio, error) => (doc) => {
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    const pa = p.getAttribute('POSITION'), na = p.getAttribute('NORMAL'), ia = p.getIndices(); if (!na || !ia) continue;
    const I = Uint32Array.from(ia.getArray()), target = Math.floor(I.length * ratio / 3) * 3;
    const [out] = MeshoptSimplifier.simplifyWithAttributes(I, Float32Array.from(pa.getArray()), 3, Float32Array.from(na.getArray()), 3, [.5, .5, .5], null, target, error, []);
    ia.setArray(out);
    compactPrimitive(p);
  }
};

async function processModel(M) {
  const cfg = { ...M, ...(CFG[M.id] || {}) };
  const src = resolve(SRC, M.file + '.glb');
  const doc = await io.read(src);
  const R = doc.getRoot();
  const info = R.getAsset().extras || {};
  const scene = R.getDefaultScene() || R.listScenes()[0];

  // ─── 1. 收集每個 primitive 的世界座標幾何 ───
  const prims = [];
  const snapN = cfg.snap ? new Map() : null;
  scene.traverse((node) => {
    const mesh = node.getMesh(); if (!mesh) return;
    if (cfg.drop && cfg.drop.test(node.getName())) return;   // drop：不要的節點（例如伸出車頭好幾公尺的大燈光束面片）
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
      // snap：原檔是沒焊接的三角形湯、同一點的法線差在最後幾個位元，weld 合不起來（減面也就沒作用）：
      // 位置對齊到格點，同一點上和第一個法線夾角 20° 內的歸成一群，全部讀完再寫回這群的平均法線（整台共用，原檔切塊的接縫也合得起來），真的折角才留縫
      if (snapN) for (let i = 0; i < cnt; i++) {
        for (let k = 0; k < 3; k++) pos[i * 3 + k] = Math.round(pos[i * 3 + k] * 1e4) / 1e4;
        const key = pos[i * 3] + ',' + pos[i * 3 + 1] + ',' + pos[i * 3 + 2], x = nor[i * 3], y = nor[i * 3 + 1], z = nor[i * 3 + 2];
        let L = snapN.get(key); if (!L) snapN.set(key, L = []);
        let c = L.find((q) => q.n[0] * x + q.n[1] * y + q.n[2] * z > .94);
        if (!c) L.push(c = { n: [x, y, z], s: [0, 0, 0], at: [] });
        c.s[0] += x; c.s[1] += y; c.s[2] += z; c.at.push(nor, i * 3);
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
      let path = '', up = node; while (up) { path = up.getName() + '/' + path; up = up.getParentNode(); }   // 連同上層節點名（卡鉗常是上層群組的名字）
      prims.push({ mat, pos, nor, uv, idx, cnt, node: node.getName(), path });
    }
  });

  if (snapN) for (const L of snapN.values()) for (const c of L) {
    const l = Math.hypot(...c.s) || 1, n = c.s.map((v) => v / l);
    for (let j = 0; j < c.at.length; j += 2) c.at[j].set(n, c.at[j + 1]);
  }

  // 離群的小雜物（十幾個三角形以下、整塊在大零件外框之外，例如拉到車外幾公尺的退化面片）會撐大外框、把車縮小，先丟掉
  {
    const box = (p) => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < p.cnt; i++) for (let k = 0; k < 3; k++) { const v = p.pos[i * 3 + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; } return { mn, mx }; };
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const p of prims) { if (p.idx.length / 3 < 16) continue; const b = box(p); for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], b.mn[k]); mx[k] = Math.max(mx[k], b.mx[k]); } }
    const pad = [0, 1, 2].map((k) => (mx[k] - mn[k]) * .05);
    for (let i = prims.length - 1; i >= 0; i--) {
      const p = prims[i]; if (p.idx.length / 3 >= 16) continue;
      const b = box(p);
      if ([0, 1, 2].some((k) => b.mn[k] < mn[k] - pad[k] || b.mx[k] > mx[k] + pad[k])) { console.log(`  ${M.id}：丟掉離群的 ${p.node}（${p.idx.length / 3} 面）`); prims.splice(i, 1); }
    }
  }

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
  // soup：原檔每個三角形各自一組頂點（不共用），減面器沒有邊可收 → 位置（0.1 mm）、法線、UV 都一樣的頂點先合併
  if (cfg.soup) for (const p of prims) {
    const key = new Map(), remap = new Uint32Array(p.cnt); let n = 0;
    const r = (v, q) => Math.round(v * q);
    for (let i = 0; i < p.cnt; i++) {
      const k = [r(p.pos[i * 3], 1e4), r(p.pos[i * 3 + 1], 1e4), r(p.pos[i * 3 + 2], 1e4), r(p.nor[i * 3], 50), r(p.nor[i * 3 + 1], 50), r(p.nor[i * 3 + 2], 50), p.uv ? r(p.uv[i * 2], 1e4) + ',' + r(p.uv[i * 2 + 1], 1e4) : ''].join(',');
      let j = key.get(k);
      if (j == null) { j = n++; key.set(k, j); p.pos.copyWithin(j * 3, i * 3, i * 3 + 3); p.nor.copyWithin(j * 3, i * 3, i * 3 + 3); if (p.uv) p.uv.copyWithin(j * 2, i * 2, i * 2 + 2); }
      remap[i] = j;
    }
    p.idx = p.idx.map((i) => remap[i]); p.cnt = n; p.pos = p.pos.slice(0, n * 3); p.nor = p.nor.slice(0, n * 3); if (p.uv) p.uv = p.uv.slice(0, n * 2);
  }

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
  const ground = comps.reduce((m, c) => c.shadow ? m : Math.min(m, c.mn[1]), Infinity);   // 不用展開：零件幾十萬塊時會撐爆呼叫堆疊
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
    // wheelsAt：{ 輪位: [x, z, 半徑] } 直接指定輪心（輪胎和車身下緣、擋泥板共用材質，自動找不出來時用）；胎寬汽車 .26、機車 .18
    const at = cfg.wheelsAt?.[name];
    if (at) { const [x, z, r] = at, hw = M.bike ? .09 : .13; wheels.push({ name, x, y: ground + r, z, r, x0: x - hw, x1: x + hw, front: name[0] === 'F' }); continue; }
    // 落地的連通塊（輪胎可能拆成好幾段胎面）→ 同材質、同一個前後位置的塊合起來就是整顆輪胎
    const g = comps.filter((c) => !c.shadow && c.mn[1] < ground + .03 && inSlot(c) && c.mx[2] - c.mn[2] < 1.2 && c.mx[0] - c.mn[0] < .6);
    if (!g.length) continue;
    const big = g.sort((a, c) => c.n - a.n)[0];
    const cz0 = (big.mn[2] + big.mx[2]) / 2, cx0 = (big.mn[0] + big.mx[0]) / 2;
    const mset = new Set(g.map((c) => c.prim.mat));
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (const c of comps) {
      if (c.shadow || !mset.has(c.prim.mat) || Math.abs((c.mn[2] + c.mx[2]) / 2 - cz0) > .55 || c.mx[2] - c.mn[2] > 1.2 || c.mx[1] > (cfg.wtop ?? 1.3)) continue;   // wtop：輪胎材質和車身下緣共用時，只收這個高度以下的塊
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

  // 卡鉗：落在輪子裡、但材質或原檔節點名有 calip 的塊不跟著輪子轉，只跟著轉向（輸出成 wheel_XX_fix）
  const FIX = cfg.fix ?? /calip/i;
  for (const c of comps) c.fix = c.slot >= 0 && (FIX.test(c.prim.mat?.getName() || '') || FIX.test(c.prim.path || ''));
  if (comps.some((c) => c.fix)) console.log(`  ${M.id}：卡鉗 ${comps.filter((c) => c.fix).length} 塊不跟著輪子轉`);
  // 機車前叉與車把：轉向軸過前輪軸心、往後傾 rake 度；整塊落在軸周圍細圓柱裡（下段，前叉管）或上端軸後方較粗的範圍（車把）的塊
  // 也放進 wheel_F_fix，遊戲裡繞這條軸轉（spec.rake）
  const fi = M.bike && cfg.fork !== false ? wheels.findIndex((w) => w.name === 'F') : -1;
  const F = { rake: 24, r: .14, top: .78, bar: .44, barH: .18, ...(cfg.fork || {}) };
  if (fi >= 0) {
    const w = wheels[fi], th = F.rake * Math.PI / 180, ay = Math.cos(th), az = -Math.sin(th);   // 軸：往上、往後（車頭朝 +z）
    const bad = new Uint8Array(comps.length);
    for (const p of prims) for (let i = 0; i < p.cnt; i++) {
      const k = p.comp[i]; if (bad[k]) continue;
      const x = p.pos[i * 3], y = p.pos[i * 3 + 1] - w.y, z = p.pos[i * 3 + 2] - w.z, t = y * ay + z * az;
      const d = Math.hypot(x, y - t * ay, z - t * az), f = y * -az + z * ay;   // d：離軸的距離；f：往前（垂直於軸）的距離
      if (t < -.12 || t > F.top + .12 || (t < F.top - F.barH ? d > F.r : d > F.bar || f > .06)) bad[k] = 1;
    }
    let n = 0;
    comps.forEach((c, k) => { if (!bad[k] && !c.shadow && c.slot < 0) { c.slot = fi; c.fix = true; n++; } });
    console.log(`  ${M.id}：前叉與車把 ${n} 塊跟著轉向`);
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
    let a = bc[3], blend = m.getAlphaMode() === 'BLEND' && !(Array.isArray(cfg.opaque) ? cfg.opaque.includes(m.getName()) : cfg.opaque && bc[3] > .99);   // opaque：原檔整台標成 BLEND 但其實不透明（給材質名陣列：只有那幾個）
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
      const gk = mi.key + '#' + comp.slot + (comp.fix ? 'f' : '');
      let g = groups.get(gk);
      if (!g) { g = { mi, slot: comp.slot, fix: comp.fix, pos: [], nor: [], uv: [], col: [], pbr: [], emi: [], idx: [], n: 0 }; groups.set(gk, g); }
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
    const mk = g.slot + (g.fix ? 'f' : '');
    let mesh = meshes.get(mk);
    if (!mesh) {
      mesh = doc.createMesh(g.slot < 0 ? 'body' : 'wheel_' + wheels[g.slot].name + (g.fix ? '_fix' : ''));
      const node = doc.createNode(mesh.getName()).setMesh(mesh);
      if (g.slot >= 0) { const w = wheels[g.slot]; node.setTranslation([w.x, w.y, w.z]); }
      out.addChild(node); meshes.set(mk, mesh);
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
  if (fi >= 0) spec.rake = F.rake;   // 機車前輪與 wheel_F_fix 繞這個後傾角的軸轉向
  out.setExtras(spec);
  R.getAsset().extras = { title: info.title, author: info.author, license: info.license, source: info.source };

  await doc.transform(
    // keepSolidTextures：單色小貼圖不能換成 baseColorFactor（頁面的 uber 材質只讀 COLOR_0 × 貼圖，factor 是白的；消防車的紅色車身就是這樣不見的）
    prune({ keepSolidTextures: true }), dedup(), weld(),
    cfg.snap ? simplifyN(Math.min(1, cfg.tris / trisIn), cfg.err ?? .0012) : simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, cfg.tris / trisIn), error: cfg.err ?? .0012 }),
    prune({ keepSolidTextures: true }),
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
  // 其他工具寫進來的欄位（tools/seats.mjs 的 db）保留
  const tbl = M.traffic ? traffic : manifest, prev = tbl[M.id] || {}, spec = await processModel(M);
  for (const k in prev) if (!(k in spec)) spec[k] = prev[k];
  tbl[M.id] = spec;
}
const ordered = {}; for (const M of MODELS) if (!M.traffic && manifest[M.id]) ordered[M.id] = manifest[M.id];
writeFileSync(manifestPath, JSON.stringify(ordered, null, 1) + '\n');
if (Object.keys(traffic).length) writeFileSync(manifestT, JSON.stringify(traffic, null, 1) + '\n');
