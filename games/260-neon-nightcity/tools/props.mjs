// Sketchfab 道具與建築 → assets/260/props/<out>.glb 與 assets/260/props/props.json
//   node tools/props.mjs [out…]      來源 GLB 放在 .cache/props/（gitignore）
// 每個輸出檔有一個或多個物件（場景根節點，名稱是物件 id，extras 有 w／d／h），物件已經擺正：
// 底面中心在原點、接地、正面朝 +z，單位公尺。材質改成和實車一樣的頂點屬性（COLOR_0、_PBR、_EMI），
// 頁面用 26-glb.js 的 glbMaterial 畫。建築組（DanielZhabotinsky）的金屬粗糙貼圖其實是窗戶遮罩（洋紅＝玻璃），
// 留在 metallicRoughness 槽給頁面點亮夜間窗燈（win: true）。
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(root, '../197-openworld/package.json'));
const imp = (n) => import(pathToFileURL(req.resolve(n)).href);
const { NodeIO, Document } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { prune, dedup, weld, simplify, textureCompress, meshopt } = await imp('@gltf-transform/functions');
const { MeshoptSimplifier, MeshoptEncoder } = await imp('meshoptimizer');
const sharp = (await imp('sharp')).default;

const SRC = resolve(root, '.cache/props');
const OUT = resolve(root, '../../assets/260/props');

// 建築組的節點名是「建築名_材質名_0」：拿掉材質名就是同一棟
const byBuilding = (node, mat) => node.replace(new RegExp('_' + mat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '_\\d+$'), '');
// out：輸出檔名；items：單一物件 { id, h（目標高）或 len（目標最長水平邊）或 scale，rot（繞 y 轉幾個 90°），drop（拿掉的節點／材質） }
// split：整組拆成多個物件（依 group(節點名, 材質名) 分），scale 統一，min／max 篩掉太小或太怪的
export const SETS = [
  { out: 'interior', items: [
    { id: 'jukebox', file: 'rocket_vinyl_jukebox_game_ready', h: 1.62 },
    { id: 'arcade', file: 'rusty_japanese_arcade', h: 1.86 },
    { id: 'carlift', file: 'carlift', scale: 1 },
    { id: 'toolcart', file: 'free_drawer_tool_cart_used', h: .98, rot: 1 },
  ] },
  { out: 'ramen', items: [{ id: 'ramen', file: 'japanese_ramen_stall', h: 3.4, drop: /Platform/ }] },
  // 武器（69-combat.js）：orient 是「哪個原檔軸變成槍口方向 +z、哪個變成上方 +y」，center 是包圍盒中心放原點（握把位置由頁面的 ARMS 表另外給）
  { out: 'arms', tex: 512, src: '.cache/arms', items: [
    { id: 'pistol', file: 'heckler__koch_usp_pistol', len: .194, orient: ['z', 'y'], center: 1 },
    // 原檔並排擺了兩把：只取右邊那把（摺疊槍托），再用主軸轉正
    { id: 'smg', file: 'mac-11', len: .3, pick: (x, y) => x > -.2 && y > .2, pca: 1, orient: ['-z', 'y'], center: 1 },
    { id: 'rifle', file: 'm4a1_sopmod_remaster', len: .84, orient: ['x', 'y'], center: 1 },
    { id: 'shotgun', file: 'remington_870_shotgun', len: 1.0, yaw: -14, orient: ['z', 'y'], center: 1 },
    { id: 'sniper', file: 'usmc_m40a5_sniper', len: 1.12, yaw: -35, pitch: 12, orient: ['z', 'y'], center: 1 },
    { id: 'rpg', file: 'rpg-7', len: 1.2, orient: ['z', 'y'], center: 1 },
    { id: 'minigun', file: 'minigun_improved', len: .95, orient: ['-z', 'y'], center: 1 },
    { id: 'grenade', file: 'm67_fragmentation_grenade', len: .075, orient: ['z', 'y'], center: 1 },
    { id: 'c4', file: 'c4_explosive', len: .22, orient: ['z', 'y'], center: 1 },
    { id: 'bat', file: 'baseball_bat', len: .84, orient: ['-x', 'y'], center: 1 },
    { id: 'katana', file: 'cyberpunk_katana', len: 1.0, orient: ['-x', 'y'], center: 1 },
    { id: 'baton', file: 'police_baton_game_ready_-_pbr', len: .5, orient: ['-z', 'y'], center: 1 },
  ] },
  // 街道物件：消防栓、配電箱、加油機
  { out: 'street', tex: 512, src: '.cache/raw', items: [
    { id: 'hydrant', file: 'fire_hydrant', h: .78 },
    { id: 'ebox', file: 'electrical_box_-_free', h: 1.62 },
    { id: 'pump', file: 'gas_pump', h: 2.1 },
  ] },
  { out: 'bld_brown', file: 'brownstone_building_set_-_low_poly_model', split: byBuilding, win: true, prefix: 'brown' },
  { out: 'bld_down', file: 'downtown_buildings_set_-_low_poly_model', split: byBuilding, win: true, prefix: 'down' },
  { out: 'bld_ind', file: 'industrial_buildings_set_-_low_poly_models', split: byBuilding, win: true, prefix: 'ind' },
  { out: 'bld_mid', file: 'midcity_buildings_set_-_low_poly_model', split: byBuilding, win: true, prefix: 'mid' },
  // World 區域（使用者提供的 ~/Downloads/World，複製到 .cache/world/）：golukumar 的 new_york_city（CC BY 4.0）是依材質合併的整片街區，
  // 只取建築節點（Object_55 之後），依原檔座標的矩形（建築群之間的空隙量出來的）拆成 12 群，每群在頁面整塊擺進金融區的一個街區。
  // 沒有窗戶遮罩：立面貼圖（/Facade/）的暗色區塊當成玻璃自動產生窗戶編號貼圖
  { out: 'bld_fin', file: 'new_york_city', src: '.cache/world', keep: (node) => +node.replace(/\D/g, '') >= 55, win: true, winAuto: /Facade/, prefix: 'fin',
    curtain: /^CityGen(textured_metal|black_)/,
    // 沒貼圖的「Material」是 80% 灰、粗糙度 .3 的大片牆：夜裡反射環境變成一整面白牆，壓暗、變粗糙
    tint: { Material: [.32, .7] },
    winRects: { 'Building_Facade.001': [.065, .4, .735].flatMap((u) => [.086, .417, .753].map((v) => [u, v, u + .2, v + .16])) },
    cells: [[-82, -42, -52, -8], [-165, -105, -51, -15], [-20, 42, -51, -13], [-144, -101, 13, 48], [-20, 7.5, 13, 45], [7.5, 43, 13, 52],
      [-77, -49, 14, 46], [-163, -147, 15, 48], [-79, -45, 73, 114], [-20, 16, 73, 110], [16, 42, 73, 110], [-165, -103, 74, 108]] },
  // 雲杉坡的住宅大樓：abhayexe 的「city」（CC BY 4.0）左側那排五棟公寓，原檔比例偏小（一層約 2.2 m），放大 1.45 倍；
  // 每棟由十幾個節點拼成，同樣依原檔座標的矩形拆開（矩形彼此只差幾公分，邊界不留餘量），路邊的樹與地面不要
  // 窗戶：38、39 是藍灰玻璃（winBlue），27 是米色立面上幾扇窗（手量矩形）；其他是管線、招牌、冷氣，不點燈
  { out: 'bld_res', file: 'city_abhayexe', src: '.cache/world', win: true, winAuto: /^01_-_Default_(27|38|39)$/, winBlue: /_3[89]$/, prefix: 'res', scale: 1.45, cellMargin: .05, dropGround: .45,
    rot: 3, drop: /Default_4[67]$/,   // 原檔大門朝 +x，轉成朝 +z；路樹不要
    winRects: { '01_-_Default_27': [[.32, .055, .695, .234], [.227, .055, .289, .094], [.023, .29, .223, .41], [.578, .305, .625, .383], [.215, .535, .477, .664],
      [.117, .539, .164, .57], [.672, .539, .727, .625], [.117, .78, .164, .812], [.5, .773, .555, .867]] },
    cells: [[-20.5, -13.85, -18.6, -10.89], [-20.5, -13.85, -10.88, -3.15], [-28.6, -20.55, -8.85, -2.4], [-20.3, -13.85, 6.3, 14.2], [-20.9, -14.3, 14.21, 21.95]] },
  // 安全屋室內（69-safehouse.js）：dasy444 的兩個 Sketchfab 室內（CC BY 4.0），保留原檔座標（地板 y＝0）。
  // loft17 是兩層樓的頂樓公寓，玻璃牆外那圈發光的摩天樓卡片就是窗景；interior15 是崖邊別墅，拿掉白天的天空半球
  { out: 'apt_loft', src: '.cache/world', items: [{ id: 'loft', file: 'loft17', origin: [0, 0, 0] }] },
  // 客廳地板（Material.001）原檔是金屬度 1、粗糙度 0 的鏡面，夜裡整片映出城市環境圖：改成拋光石材；落地窗（material_5）的反射也壓淡
  { out: 'apt_villa', src: '.cache/world', items: [{ id: 'villa', file: 'interior15', origin: [0, 0, 0], drop: /^Sphere/ }], tint: { 'Material.001': [1, .42, 0], material_5: [1, .7, 0] } },
];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
const mulPt = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
function normalMat(m) {
  const [a, b, c, d, e, f, g, h, i] = [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C || 1;
  return { det, n: [A / det, B / det, C / det, -(b * i - c * h) / det, (a * i - c * g) / det, -(a * h - b * g) / det, (b * f - c * e) / det, -(a * f - c * d) / det, (a * e - b * d) / det] };
}

// 讀一個來源檔的所有三角形 primitive（世界座標）
function collect(doc) {
  const R = doc.getRoot(), scene = R.getDefaultScene() || R.listScenes()[0], prims = [];
  scene.traverse((node) => {
    const mesh = node.getMesh(); if (!mesh) return;
    const wm = node.getWorldMatrix(), { det, n: nm } = normalMat(wm);
    for (const p of mesh.listPrimitives()) {
      if (p.getMode() !== 4 || !p.getAttribute('POSITION')) continue;
      const pa = p.getAttribute('POSITION'), na = p.getAttribute('NORMAL'), cnt = pa.getCount(), mat = p.getMaterial();
      const pos = new Float32Array(cnt * 3), nor = new Float32Array(cnt * 3), t = [0, 0, 0];
      for (let i = 0; i < cnt; i++) {
        pa.getElement(i, t); pos.set(mulPt(wm, t[0], t[1], t[2]), i * 3);
        if (na) { na.getElement(i, t); const x = nm[0] * t[0] + nm[3] * t[1] + nm[6] * t[2], y = nm[1] * t[0] + nm[4] * t[1] + nm[7] * t[2], z = nm[2] * t[0] + nm[5] * t[1] + nm[8] * t[2], l = Math.hypot(x, y, z) || 1; nor.set([x / l, y / l, z / l], i * 3); }
        else nor.set([0, 1, 0], i * 3);
      }
      const ti = mat && mat.getBaseColorTexture() ? mat.getBaseColorTextureInfo() : null;
      const ua = ti ? p.getAttribute('TEXCOORD_' + ti.getTexCoord()) || p.getAttribute('TEXCOORD_0') : p.getAttribute('TEXCOORD_0');
      let uv = null;
      if (ua) {
        const tr = ti && ti.getExtension('KHR_texture_transform'), e = [0, 0];
        const [ox, oy] = tr ? tr.getOffset() : [0, 0], [sx, sy] = tr ? tr.getScale() : [1, 1], r = tr ? tr.getRotation() : 0, cr = Math.cos(r), sr = Math.sin(r);
        uv = new Float32Array(cnt * 2);
        for (let i = 0; i < cnt; i++) { ua.getElement(i, e); const u = e[0] * sx, v = e[1] * sy; uv[i * 2] = cr * u + sr * v + ox; uv[i * 2 + 1] = -sr * u + cr * v + oy; }
      }
      const ia = p.getIndices();
      const idx = ia ? Uint32Array.from(ia.getArray()) : Uint32Array.from({ length: cnt }, (_, i) => i);
      if (det < 0) for (let i = 0; i < idx.length; i += 3) { const s = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = s; }
      prims.push({ node: node.getName(), mat, pos, nor, uv, idx, cnt });
    }
  });
  return prims;
}
const seedOf = (id) => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7) / 9973;
const bbox = (prims) => {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const p of prims) for (let i = 0; i < p.cnt; i++) for (let k = 0; k < 3; k++) { const v = p.pos[i * 3 + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }
  return { mn, mx };
};
// 照片立面找窗戶：比周圍 129 px 平均暗 28%，或低於整張的 Otsu 門檻（圖集的全黑空白不算），再做開運算去雜點；
// 連通區太小、太大（超過貼圖 1/5）或不夠方正（填滿外框不到 55%）的丟掉
function photoWindows(data, S) {
  const N = S * S, L = new Float32Array(N);
  for (let i = 0; i < N; i++) L[i] = (data[i * 4] * .3 + data[i * 4 + 1] * .59 + data[i * 4 + 2] * .11) / 255;
  const med = Float32Array.from(L).sort()[N >> 1];
  const hist = new Float64Array(64); let tot = 0, sum = 0;
  for (const l of L) if (l > .02) { const k = Math.min(63, Math.floor(l * 64)); hist[k]++; tot++; sum += k; }
  let wB = 0, sB = 0, best = 0, otsu = 0;
  for (let k = 0; k < 64; k++) { wB += hist[k]; if (!wB || wB === tot) continue; sB += k * hist[k]; const v = wB * (tot - wB) * (sB / wB - (sum - sB) / (tot - wB)) ** 2; if (v > best) { best = v; otsu = (k + 1) / 64; } }
  const I = new Float64Array((S + 1) * (S + 1)), R = 64;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) I[(y + 1) * (S + 1) + x + 1] = L[y * S + x] + I[y * (S + 1) + x + 1] + I[(y + 1) * (S + 1) + x] - I[y * (S + 1) + x];
  const box = (x, y) => { const x0 = Math.max(0, x - R), x1 = Math.min(S, x + R + 1), y0 = Math.max(0, y - R), y1 = Math.min(S, y + R + 1); return (I[y1 * (S + 1) + x1] - I[y0 * (S + 1) + x1] - I[y1 * (S + 1) + x0] + I[y0 * (S + 1) + x0]) / ((x1 - x0) * (y1 - y0)); };
  let g = new Uint8Array(N);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const l = L[y * S + x]; g[y * S + x] = (l < box(x, y) * .72 || l < otsu * .85) && l < Math.max(.12, med * .8) ? 1 : 0; }
  const pass = (a, er, horiz) => { const o = new Uint8Array(N); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { let v = er ? 1 : 0; for (let d = -1; d <= 1; d++) { const X = horiz ? x + d : x, Y = horiz ? y : y + d; const q = X < 0 || Y < 0 || X >= S || Y >= S ? 0 : a[Y * S + X]; if (er ? !q : q) { v = er ? 0 : 1; break; } } o[y * S + x] = v; } return o; };
  g = pass(pass(pass(pass(g, 1, 1), 1, 0), 0, 1), 0, 0);
  const lab = new Int32Array(N).fill(-1), keep = new Uint8Array(N);
  for (let i = 0, n = 0; i < N; i++) {
    if (!g[i] || lab[i] >= 0) continue;
    const st = [i], px = []; lab[i] = n; let x0 = S, x1 = 0, y0 = S, y1 = 0;
    while (st.length) {
      const j = st.pop(), x = j % S, y = (j / S) | 0; px.push(j); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const k of [x > 0 ? j - 1 : -1, x < S - 1 ? j + 1 : -1, y > 0 ? j - S : -1, y < S - 1 ? j + S : -1]) if (k >= 0 && g[k] && lab[k] < 0) { lab[k] = n; st.push(k); }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (px.length >= 12 && bw <= S / 5 && bh <= S / 5 && px.length / (bw * bh) > .55) for (const j of px) keep[j] = 1;
    n++;
  }
  return keep;
}
// 帷幕牆：材質名符合的 primitive，牆面（法線接近水平）的三角形拆出來，UV 改成沿牆面投影（每格 1.6 m 寬、3.5 m 一層），
// 標成 curtain，輸出時換成有格狀窗戶遮罩的材質；屋頂與地面維持原本的 UV
function curtainUV(ps, re) {
  for (const p of [...ps]) {
    if (!p.mat || !re.test(p.mat.getName())) continue;
    const wall = [], rest = [];
    for (let t = 0; t < p.idx.length; t += 3) {
      const ny = (p.nor[p.idx[t] * 3 + 1] + p.nor[p.idx[t + 1] * 3 + 1] + p.nor[p.idx[t + 2] * 3 + 1]) / 3;
      (Math.abs(ny) < .3 ? wall : rest).push(p.idx[t], p.idx[t + 1], p.idx[t + 2]);
    }
    if (!wall.length) continue;
    const w = subPrim(p, wall);
    w.uv = new Float32Array(w.cnt * 2); w.curtain = true;
    for (let i = 0; i < w.cnt; i++) {
      const nx = w.nor[i * 3], nz = w.nor[i * 3 + 2], l = Math.hypot(nx, nz) || 1;
      w.uv[i * 2] = (w.pos[i * 3] * -nz / l + w.pos[i * 3 + 2] * nx / l) / 1.6; w.uv[i * 2 + 1] = w.pos[i * 3 + 1] / 3.5;
    }
    ps.splice(ps.indexOf(p), 1, w, ...(rest.length ? [subPrim(p, rest)] : []));
  }
}
// 取 primitive 的部分三角形，頂點重新編號
function subPrim(p, ix) {
  const map = new Map(), keep = [];
  const idx = Uint32Array.from(ix, (v) => { if (!map.has(v)) { map.set(v, keep.length); keep.push(v); } return map.get(v); });
  const pick = (a, n) => { if (!a) return null; const o = new Float32Array(keep.length * n); keep.forEach((v, i) => { for (let k = 0; k < n; k++) o[i * n + k] = a[v * n + k]; }); return o; };
  return { node: p.node, mat: p.mat, pos: pick(p.pos, 3), nor: pick(p.nor, 3), uv: pick(p.uv, 2), idx, cnt: keep.length };
}
// 擺正一組 primitive（就地改）：轉 rot×90°、縮放、底面中心移到原點
// 3×3 對稱矩陣的特徵向量（Jacobi），由大到小
function eigen3(A) {
  const a = A.map((r) => r.slice()), V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let it = 0; it < 50; it++) {
    let p = 0, q = 1; for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) if (Math.abs(a[i][j]) > Math.abs(a[p][q])) { p = i; q = j; }
    if (Math.abs(a[p][q]) < 1e-12) break;
    const th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
    for (let k = 0; k < 3; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; }
    for (let k = 0; k < 3; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
    for (let k = 0; k < 3; k++) { const x = V[k][p], y = V[k][q]; V[k][p] = c * x - s * y; V[k][q] = s * x + c * y; }
  }
  return [0, 1, 2].map((i) => ({ l: a[i][i], v: [V[0][i], V[1][i], V[2][i]] })).sort((x, y) => y.l - x.l).map((e) => e.v);
}
const remap = (prims, r, u, f) => {
  const dot = (a, p, i) => a[0] * p[i] + a[1] * p[i + 1] + a[2] * p[i + 2];
  for (const p of prims) for (const arr of [p.pos, p.nor]) for (let i = 0; i < p.cnt * 3; i += 3) { const x = dot(r, arr, i), y = dot(u, arr, i), z = dot(f, arr, i); arr[i] = x; arr[i + 1] = y; arr[i + 2] = z; }
};
function place(prims, cfg, scale0) {
  if (cfg.yaw) {   // 原檔斜放：先繞 y 轉正（度）
    const a = cfg.yaw * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    remap(prims, [c, 0, s], [0, 1, 0], [-s, 0, c]);
  }
  if (cfg.pitch) {   // 再繞 x 壓平（度，+z 那端往下）
    const a = cfg.pitch * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    remap(prims, [1, 0, 0], [0, c, -s], [0, s, c]);
  }
  if (cfg.pca) {
    // 原檔歪斜擺放：主軸（最長）→ z、次軸 → y、最短 → x
    let m = [0, 0, 0], n = 0;
    for (const p of prims) for (let i = 0; i < p.cnt; i++) { for (let k = 0; k < 3; k++) m[k] += p.pos[i * 3 + k]; n++; }
    m = m.map((v) => v / n);
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const p of prims) for (let i = 0; i < p.cnt; i++) { const d = [0, 1, 2].map((k) => p.pos[i * 3 + k] - m[k]); for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += d[a] * d[b]; }
    const [f, u] = eigen3(C), r = [u[1] * f[2] - u[2] * f[1], u[2] * f[0] - u[0] * f[2], u[0] * f[1] - u[1] * f[0]];
    remap(prims, r, u, f);
  }
  if (cfg.orient) {
    // 軸重排：orient[0] 的原檔軸 → +z，orient[1] → +y，右手系補出 +x
    const ax = (a) => { const v = [0, 0, 0]; v['xyz'.indexOf(a.slice(-1))] = a[0] === '-' ? -1 : 1; return v; };
    const f = ax(cfg.orient[0]), u = ax(cfg.orient[1]), r = [u[1] * f[2] - u[2] * f[1], u[2] * f[0] - u[0] * f[2], u[0] * f[1] - u[1] * f[0]];
    remap(prims, r, u, f);
  }
  const q = ((cfg.rot || 0) % 4 + 4) % 4;
  const rot = (x, z) => (q === 0 ? [x, z] : q === 1 ? [z, -x] : q === 2 ? [-x, -z] : [-z, x]);
  for (const p of prims) for (let i = 0; i < p.cnt; i++) {
    const [x, z] = rot(p.pos[i * 3], p.pos[i * 3 + 2]); p.pos[i * 3] = x; p.pos[i * 3 + 2] = z;
    const [nx, nz] = rot(p.nor[i * 3], p.nor[i * 3 + 2]); p.nor[i * 3] = nx; p.nor[i * 3 + 2] = nz;
  }
  let { mn, mx } = bbox(prims);
  const s = scale0 ?? (cfg.h ? cfg.h / (mx[1] - mn[1]) : cfg.len ? cfg.len / Math.max(mx[0] - mn[0], mx[2] - mn[2]) : cfg.scale ?? 1);
  // origin：室內場景保留原檔座標（頁面的碰撞框照原檔量），只減掉這個點
  const [cx, cy, cz] = cfg.origin || [(mn[0] + mx[0]) / 2, cfg.center ? (mn[1] + mx[1]) / 2 : mn[1], (mn[2] + mx[2]) / 2];
  for (const p of prims) for (let i = 0; i < p.cnt; i++) { p.pos[i * 3] = (p.pos[i * 3] - cx) * s; p.pos[i * 3 + 1] = (p.pos[i * 3 + 1] - cy) * s; p.pos[i * 3 + 2] = (p.pos[i * 3 + 2] - cz) * s; }
  ({ mn, mx } = bbox(prims));
  return { w: +(mx[0] - mn[0]).toFixed(2), d: +(mx[2] - mn[2]).toFixed(2), h: +(mx[1] - mn[1]).toFixed(2) };
}

async function build(set) {
  const out = new Document();
  out.createBuffer();
  const scene = out.createScene();
  const items = {};
  const sources = set.items ? set.items : [{ file: set.file, drop: set.drop }];
  const credits = [];
  const matCache = new Map();   // 來源材質 → 新材質（貼圖複製到新文件）
  const texCache = new Map(), autoCache = new Map();
  const copyTex = (t) => {
    if (!t) return null;
    if (!texCache.has(t)) texCache.set(t, out.createTexture(t.getName()).setImage(t.getImage()).setMimeType(t.getMimeType()));
    return texCache.get(t);
  };
  const mkMat = async (m, win, curtain) => {
    if (curtain) {   // 帷幕牆：同一個材質另開一份，金屬粗糙槽放格狀窗戶遮罩（每格一扇窗）
      const k = 'curtain:' + (m ? m.getName() : '');
      if (!matCache.has(k)) { const b = await mkMat(m, false); matCache.set(k, b.clone().setName(b.getName() + '_curtain').setMetallicRoughnessTexture(await gridTex())); }
      return matCache.get(k);
    }
    if (matCache.has(m)) return matCache.get(m);
    const blend = m && m.getAlphaMode() === 'BLEND', mask = m && m.getAlphaMode() === 'MASK';
    const n = out.createMaterial(m ? m.getName() : 'flat').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(1).setDoubleSided(!!(m && m.getDoubleSided()));
    if (blend) n.setAlphaMode('BLEND'); else if (mask) n.setAlphaMode('MASK').setAlphaCutoff(m.getAlphaCutoff());
    if (m && m.getBaseColorTexture()) n.setBaseColorTexture(copyTex(m.getBaseColorTexture()));
    if (m && m.getEmissiveTexture()) n.setEmissiveTexture(copyTex(m.getEmissiveTexture())).setEmissiveFactor([1, 1, 1]);
    // 窗戶遮罩只給不透明的牆面材質（逃生梯欄杆之類的鏤空貼圖也是洋紅，會被誤點亮）
    if (set.winAuto) { if (!blend && !mask && m && m.getBaseColorTexture() && set.winAuto.test(m.getName())) n.setMetallicRoughnessTexture(await winTex(m.getBaseColorTexture(), m.getName())); }
    else if (win && !blend && !mask && m && m.getMetallicRoughnessTexture()) n.setMetallicRoughnessTexture(await winTex(m.getMetallicRoughnessTexture()));
    matCache.set(m, n); return n;
  };
  // 窗戶編號貼圖：R＝玻璃（原遮罩的洋紅），G＝這扇窗的亂數。遮罩膨脹 2 px 再找連通區，同一扇窗的上下兩片玻璃算同一扇；
  // G 填滿膨脹後的整塊，玻璃邊緣做雙線性取樣時編號也不會混到隔壁
  // auto：沒有遮罩的照片立面，比整張中位數暗很多的地方當成玻璃（解析度要高一點，窗戶才不會糊在一起）
  const winTex = async (t, auto) => {
    // 自動遮罩依材質名而定（winRects），同一張貼圖不同材質要分開；內嵌貼圖沒有名稱與 URI，用貼圖物件當鍵
    if (auto && !autoCache.has(t)) autoCache.set(t, new Map());
    const ck = auto ? auto : t, cache = auto ? autoCache.get(t) : texCache;
    if (cache.has(ck)) return cache.get(ck);
    const S = auto ? 1024 : 256, { data } = await sharp(Buffer.from(t.getImage())).resize(S, S, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const glass = new Uint8Array(S * S), dil = new Uint8Array(S * S), lab = new Int32Array(S * S).fill(-1);
    const D = auto ? 0 : 2;   // 照片立面的窗戶彼此很近，膨脹會把整面牆的窗併成同一個編號
    const rects = auto && set.winRects && set.winRects[auto];
    if (rects) {   // 窗戶和牆面亮度太接近、分不出來的立面：直接給窗框矩形（UV 0–1）
      for (const [u0, v0, u1, v1] of rects) for (let y = Math.round(v0 * S); y < v1 * S; y++) for (let x = Math.round(u0 * S); x < u1 * S; x++) glass[y * S + x] = 1;
    } else if (auto && set.winBlue && set.winBlue.test(auto)) {   // 藍灰色玻璃的立面：比亮度不準，看藍色比紅色多多少
      for (let i = 0; i < S * S; i++) glass[i] = data[i * 4 + 2] - data[i * 4] > 10 && data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2] < 420 ? 1 : 0;
    } else if (auto) glass.set(photoWindows(data, S));
    else for (let i = 0; i < S * S; i++) glass[i] = data[i * 4] > 128 && data[i * 4 + 2] > 128 && data[i * 4 + 1] < 128 ? 1 : 0;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (!glass[y * S + x]) continue;
      for (let dy = -D; dy <= D; dy++) for (let dx = -D; dx <= D; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < S && Y < S) dil[Y * S + X] = 1; }
    }
    let n = 0;
    for (let i = 0; i < S * S; i++) {
      if (!dil[i] || lab[i] >= 0) continue;
      const st = [i]; lab[i] = n;
      while (st.length) {
        const j = st.pop(), x = j % S, y = (j / S) | 0;
        for (const k of [x > 0 ? j - 1 : -1, x < S - 1 ? j + 1 : -1, y > 0 ? j - S : -1, y < S - 1 ? j + S : -1]) if (k >= 0 && dil[k] && lab[k] < 0) { lab[k] = n; st.push(k); }
      }
      n++;
    }
    const px = Buffer.alloc(S * S * 3);
    for (let i = 0; i < S * S; i++) { px[i * 3] = glass[i] ? 255 : 0; px[i * 3 + 1] = lab[i] < 0 ? 0 : 1 + ((lab[i] * 157 + 61) % 254); }
    const png = await sharp(px, { raw: { width: S, height: S, channels: 3 } }).png().toBuffer();
    const nt = out.createTexture(t.getName() + '_win').setImage(new Uint8Array(png)).setMimeType('image/png');
    cache.set(ck, nt); return nt;
  };
  // 帷幕牆的窗格：64×64 一格，四周留 12% 窗框；G 固定，頁面用 UV 的整數格區分每扇窗
  let grid = null;
  const gridTex = async () => {
    if (grid) return grid;
    const S = 64, px = Buffer.alloc(S * S * 3);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const g = x > S * .12 && x < S * .88 && y > S * .14 && y < S * .86; px[(y * S + x) * 3] = g ? 255 : 0; px[(y * S + x) * 3 + 1] = g ? 128 : 0; }
    const png = await sharp(px, { raw: { width: S, height: S, channels: 3 } }).png().toBuffer();
    return grid = out.createTexture('curtain_win').setImage(new Uint8Array(png)).setMimeType('image/png');
  };
  const acc = (arr, type, Ctor) => out.createAccessor().setType(type).setArray(new Ctor(arr)).setBuffer(out.getRoot().listBuffers()[0]);
  const emit = async (id, prims, dims) => {
    const node = out.createNode(id).setExtras(dims), mesh = out.createMesh(id);
    const groups = new Map();
    for (const p of prims) { const k = p.curtain ? 'c:' + (p.mat ? p.mat.getName() : '') : p.mat; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
    for (const [, ps] of groups) {
      const m = ps[0].mat, curtain = !!ps[0].curtain;
      const tint = set.tint && m && set.tint[m.getName()];   // [底色倍率, 最低粗糙度, 最高金屬度]
      const bc = (m ? m.getBaseColorFactor() : [.6, .6, .6, 1]).map((v, i) => tint && i < 3 ? v * tint[0] : v), es = m?.getExtension('KHR_materials_emissive_strength')?.getEmissiveStrength() ?? 1;
      const ef = m ? m.getEmissiveFactor().map((v) => v * es) : [0, 0, 0];
      const pbr = [Math.max(m ? m.getRoughnessFactor() : .8, tint ? tint[1] : 0), set.win ? 0 : Math.min(m ? m.getMetallicFactor() : 0, tint ? tint[2] ?? 1 : 1), 0, 0];
      const P = [], N = [], U = [], C = [], B = [], E = [], I = [], W = [];
      const vert = (p, i, w) => {
        P.push(p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]); N.push(p.nor[i * 3], p.nor[i * 3 + 1], p.nor[i * 3 + 2]);
        U.push(p.uv ? p.uv[i * 2] : 0, p.uv ? p.uv[i * 2 + 1] : 0);
        C.push(bc[0], bc[1], bc[2], m && m.getAlphaMode() === 'BLEND' ? bc[3] : 1); B.push(...pbr); E.push(...ef, 0);
        if (w != null) W.push(w);
      };
      let base = 0;
      for (const p of ps) {
        if (set.win && !set.winAuto) {
          // 窗燈亂數（_WIN）：同一面牆的同一層（三角形最低點的高度相同）共用一個值，頁面再依貼圖格子分到每扇窗
          for (let t = 0; t < p.idx.length; t += 3) {
            const y = Math.min(p.pos[p.idx[t] * 3 + 1], p.pos[p.idx[t + 1] * 3 + 1], p.pos[p.idx[t + 2] * 3 + 1]);
            const w = (Math.sin(Math.round(y * 10) * 12.9898 + seedOf(id) * 78.233) * 43758.5453) % 1;
            for (let k = 0; k < 3; k++) { vert(p, p.idx[t + k], Math.abs(w)); I.push(base++); }
          }
          continue;
        }
        if (set.winAuto && !curtain && m && set.winAuto.test(m.getName())) {
          // 立面照片圖集：模型把同一塊窗戶照片貼在每一層、每一段牆上，只靠貼圖的窗編號會整面牆一起亮。
          // 每個三角形取外框的最小角（長方形拆成的兩個三角形一定共用這個角）當這一塊的亂數
          for (let t = 0; t < p.idx.length; t += 3) {
            const a = [0, 1, 2].map((ax) => Math.round(Math.min(...[0, 1, 2].map((k) => p.pos[p.idx[t + k] * 3 + ax])) * 4));
            const w = Math.abs((Math.sin(a[0] * 12.9898 + a[1] * 78.233 + a[2] * 37.719 + seedOf(id) * 91.7) * 43758.5453) % 1);
            for (let k = 0; k < 3; k++) { vert(p, p.idx[t + k], w); I.push(base++); }
          }
          continue;
        }
        // 帷幕牆用 UV 的整數格區分每扇窗，_WIN 只要每棟不同（保持索引，頂點數不會變三倍）
        for (let i = 0; i < p.cnt; i++) vert(p, i, set.winAuto ? seedOf(id) : null);
        for (const v of p.idx) I.push(base + v);
        base += p.cnt;
      }
      const prim = out.createPrimitive().setMaterial(await mkMat(m, set.win, curtain))
        .setAttribute('POSITION', acc(P, 'VEC3', Float32Array)).setAttribute('NORMAL', acc(N, 'VEC3', Float32Array))
        .setAttribute('COLOR_0', acc(C, 'VEC4', Float32Array)).setAttribute('_PBR', acc(B, 'VEC4', Float32Array)).setAttribute('_EMI', acc(E, 'VEC4', Float32Array))
        .setIndices(acc(I, 'SCALAR', Uint32Array));
      if (ps.some((p) => p.uv)) prim.setAttribute('TEXCOORD_0', acc(U, 'VEC2', Float32Array));
      if (W.length) prim.setAttribute('_WIN', acc(W, 'SCALAR', Float32Array));
      mesh.addPrimitive(prim);
    }
    node.setMesh(mesh); scene.addChild(node);
    items[id] = { ...dims, tris: prims.reduce((a, p) => a + p.idx.length / 3, 0) };
  };
  for (const src of sources) {
    const doc = await io.read(resolve(set.src ? resolve(root, set.src) : SRC, src.file + '.glb'));
    const info = doc.getRoot().getAsset().extras || {};
    credits.push({ file: src.file, title: info.title, author: info.author, license: info.license, source: info.source });
    let prims = collect(doc);
    if (src.drop) prims = prims.filter((p) => !src.drop.test(p.node) && !src.drop.test(p.mat ? p.mat.getName() : ''));
    if (set.keep) prims = prims.filter((p) => set.keep(p.node));
    if (set.cells) {
      // 每個三角形依重心落在哪個矩形分群（原檔座標，公尺），各群各自置中接地
      const M = set.cellMargin ?? 1, groups = set.cells.map(() => []);
      let lost = 0;
      for (const p of prims) {
        const tri = set.cells.map(() => []);
        for (let t = 0; t < p.idx.length; t += 3) {
          let x = 0, z = 0, y = -1e9; for (let k = 0; k < 3; k++) { x += p.pos[p.idx[t + k] * 3] / 3; z += p.pos[p.idx[t + k] * 3 + 2] / 3; y = Math.max(y, p.pos[p.idx[t + k] * 3 + 1]); }
          if (set.dropGround != null && y < set.dropGround) continue;   // 整片地面（街區底下的土）
          const c = set.cells.findIndex(([x0, x1, z0, z1]) => x > x0 - M && x < x1 + M && z > z0 - M && z < z1 + M);
          if (c < 0) { lost++; continue; }
          tri[c].push(p.idx[t], p.idx[t + 1], p.idx[t + 2]);
        }
        tri.forEach((ix, c) => { if (ix.length) groups[c].push(subPrim(p, ix)); });
      }
      console.log(`${set.out}：${lost} 個三角形不在任何一群`);
      for (const [c, ps] of groups.entries()) {
        const dims = place(ps, set, set.scale ?? 1);
        if (set.curtain) curtainUV(ps, set.curtain);
        await emit(`${set.prefix}_${String(c + 1).padStart(2, '0')}`, ps, { ...dims, src: set.cells[c].join(',') });
      }
      continue;
    }
    if (src.pick) prims = prims.filter((p) => { const { mn, mx } = bbox([p]); return src.pick((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2); });
    if (!set.split) { await emit(src.id, prims, place(prims, src)); continue; }
    // 拆成多棟：依建築名分組，各自置中接地（原檔已是公尺、正面朝 +z）
    const groups = new Map();
    for (const p of prims) { const k = set.split(p.node, p.mat ? p.mat.getName() : ''); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
    let n = 0;
    for (const [k, ps] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
      const dims = place(ps, set, set.scale ?? 1);
      if (dims.h < 2.5 || Math.max(dims.w, dims.d) < 3) continue;   // 零件（路燈、管線）不當成建築
      await emit(`${set.prefix}_${String(++n).padStart(2, '0')}`, ps, { ...dims, src: k });
    }
  }
  await out.transform(
    dedup(), weld(), prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^baseColor|^emissive/, resize: [set.tex ?? 1024, set.tex ?? 1024], quality: 80 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^metallicRoughness/, lossless: true }),   // 窗戶編號不能有失真
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  mkdirSync(OUT, { recursive: true });
  const file = resolve(OUT, set.out + '.glb');
  await io.write(file, out);
  const kb = Math.round(statSync(file).size / 1024);
  console.log(`${set.out}: ${Object.keys(items).length} 個物件、${kb} KB；` + Object.entries(items).map(([k, v]) => `${k} ${v.w}×${v.d}×${v.h} ${v.tris}面`).join('；'));
  return { kb, items, credits };
}

const only = process.argv.slice(2);
const manifestPath = resolve(OUT, 'props.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
for (const set of SETS) {
  if (only.length && !only.includes(set.out)) continue;
  manifest[set.out] = await build(set);
}
const ordered = {}; for (const s of SETS) if (manifest[s.out]) ordered[s.out] = manifest[s.out];
writeFileSync(manifestPath, JSON.stringify(ordered, null, 1) + '\n');
