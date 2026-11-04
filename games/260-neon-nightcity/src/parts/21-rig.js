// ═══ 海上鑽油平台（城南外海，光格島東南約 1.3 km）：亮燈的生活艙、直升機坪、鑽塔、燃燒的火炬臂、旁邊頂著浪待命的拖船 ═══
// 座標：RIG_X、RIG_Z 是 SEA_FR 座標（10-city.js：外海的剛體座標框，沒有 ?zrot 時就是世界座標）；平台的局部座標 (lx, lz) 加上它，+z 朝南。
// 平台的幾何是局部座標，網格的 position／rotation.y 擺到世界（不走 cityAdd 烘焙：m-uberX 的雜訊在 3000 多公尺的座標上會失真）
// 結構全是程式建模（Kit＋MAT.ux：塗漆的鐵 21、鍍鋅鋼 22、鋼板 29、烤漆鋼板 34、亮窗 13、發光 8），不用外部模型或貼圖。
// 海面：平台四周 RIG_R1 公尺內是 m-rigSea.mjs 的暴風浪（src/rigwave.mjs 的 8 道 Gerstner 波，從 RIG_R0 淡到 RIG_R1），原本的海面（m-water.mjs）在那個圓裡挖掉。
// rigWave(x, z, t) 是同一組浪的 JS 版：31-boats.js 的 seaWave（玩家的船、渡輪這些）與 40-people.js 的游泳都加上它，船開進來會跟著大浪起伏。
// 火焰、黑煙、斜雨（只下在平台四周的雨區，不管城裡的天氣）、探照燈光柱是 m-rigFx.mjs；火炬的閃爍光與探照燈由 99-main.js 的 pickLights 經 rigLights 放進點光。
// 碰撞：四隻腳是靜態圓（世界座標 w: 1），拖船是 30-vehicles.js 的 dynMore（每幀更新的三個圓）。測試 API 在 __nc.rig。
import { RIG_WAVES, RIG_TS, RIG_WIND, RIG_R0, RIG_R1, RIG_PAD } from '../rigwave.mjs';
const RIG_X = 3000, RIG_Z = 3900;
const RIG = (() => {
  const [cx, cz] = toW(RIG_X, RIG_Z, SEA_FR), [ex, ez] = toW(RIG_X + 1, RIG_Z, SEA_FR);
  return { cx, cz, c: ex - cx, s: ez - cz, tug: { x: 0, z: 0, yaw: 0, y: SEA_Y, pit: 0, rol: 0, circ: null }, flare: 1, hooked: false, near: false };
})();
const rigW = (lx, lz) => toW(RIG_X + lx, RIG_Z + lz, SEA_FR);   // 平台局部 → 世界
{ const [fx, fz] = rigW(0, 1); if (Math.abs(fx - RIG.cx + RIG.s) + Math.abs(fz - RIG.cz - RIG.c) > 1e-6) console.warn('21-rig：SEA_FR 不是純旋轉，平台網格的擺法要改'); }
// 浪（JS 版，跟 m-rigSea.mjs 的頂點位移同一組）：未位移的 (x, z) 的浪高，平台外 RIG_R1 公尺是 0
function rigWave(x, z, t) {
  const dx = x - RIG.cx, dz = z - RIG.cz, r2 = dx * dx + dz * dz;
  if (r2 > RIG_R1 * RIG_R1) return 0;
  const r = Math.sqrt(r2), u = clamp((r - RIG_R0) / (RIG_R1 - RIG_R0), 0, 1), k = 1 - u * u * (3 - 2 * u), tt = t * RIG_TS;
  let y = 0; for (const w of RIG_WAVES) y += w.A * Math.sin(w.k * (w.dx * x + w.dz * z) - w.w * tt + w.ph);
  return y * k;
}

// ─── 平台的配置（局部座標，y 是世界高度） ───
const RIG_SEAB = -8, RIG_LEGT = 15, RIG_DK1 = 15.5, RIG_DK2 = 22;   // 海床、導管架頂、下層甲板、主甲板
const rigLeg = (sx, sz, y) => { const k = (y - RIG_SEAB) / (RIG_LEGT - RIG_SEAB); return [sx * lerp(18, 14, k), sz * lerp(16, 12, k)]; };   // 斜腳（m-rigSea.mjs 的白沫照海面那一圈的位置 17.0, 15.0）
const RIG_HELI = { x: -24, z: 3, y: 36.4, R: 11.5 };
const RIG_DER = { x: 7, z: -1, y0: 25.5, y1: 74, b0: 5.2, b1: 1.7 };
const RIG_FLB = [21, 24, -15], RIG_FLT = [50, 53, -37];   // 火炬臂的根與尖（局部 x、世界 y、局部 z）
const RIG_TUG = { x: -58, z: 46 };
// Kit 的材質編號換成海上平台的做舊版（m-uberX.mjs 59–63）；[j0, j1) 的頂點是導管架那一段（浪花帶 60）
const RIG_AGE = { 2: 59, 21: 59, 34: 59, 15: 59, 29: 61, 55: 62, 22: 63 };
function rigAge(k, j0 = 0, j1 = 0) { const M = k.mat; for (let i = 0; i < M.length; i++) { const m = M[i]; if (m === 8 || m >= 12 && m <= 14 || m === 30) continue; M[i] = i >= j0 && i < j1 ? 60 : RIG_AGE[m] || m; } }   // 拖船待命的地方（局部）

{
  const k = new Kit(), kb = new Kit();   // kb：會閃的航空障礙燈（另一個網格，照時間開關）
  const YEL = 0xd0a018, GRY = 0x5a5e62, DKG = 0x2c3034, WHT = 0xd8dcdc, ORG = 0xe0561a;
  const P = (lx, lz) => [lx, lz];   // 幾何留在平台的局部座標（m-uberX 的程式紋理用幾何座標；烘成世界座標的 3000 多公尺雜訊會失真），網格再擺到世界
  const B = (lx, y, lz, sx, sy, sz, col, mat = 2, ry = 0) => { const [x, z] = P(lx, lz); k.box(x, y, z, sx, sy, sz, col, mat, 0, ry, 0); };
  const R = (a, b, r, col, mat = 21, seg = 10) => { const [ax, az] = P(a[0], a[2]), [bx, bz] = P(b[0], b[2]); k.rod(ax, a[1], az, bx, b[1], bz, r, seg, col, mat); };
  const Bar = (a, b, w, col, mat = 21, kk = k) => { const [ax, az] = P(a[0], a[2]), [bx, bz] = P(b[0], b[2]); kk.bar(ax, a[1], az, bx, b[1], bz, w, w, col, mat); };
  const corner = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const j0 = k.mat.length;   // 導管架、立管、沉箱、靠船平台（到 j1）換成浪花帶的材質 60
  // 導管架：四根斜腳、四層水平撐、每面 X 撐（海面下也有）、腳底的樁靴
  const LV = [RIG_SEAB + .8, -1, 7, RIG_LEGT];
  const lp = (sx, sz, y) => { const [x, z] = rigLeg(sx, sz, y); return [x, y, z]; };
  for (const [sx, sz] of corner) { R(lp(sx, sz, RIG_SEAB - .5), lp(sx, sz, RIG_LEGT), 1.7, YEL, 21, 18); R(lp(sx, sz, RIG_SEAB - .5), lp(sx, sz, RIG_SEAB + 1.2), 3, YEL, 21, 18); }
  for (let l = 0; l < LV.length; l++) {
    const y = LV[l], Q = corner.map(([sx, sz]) => lp(sx, sz, y));
    for (let i = 0; i < 4; i++) R(Q[i], Q[(i + 1) % 4], .55, YEL);
    if (l < LV.length - 1) { const y2 = LV[l + 1], Q2 = corner.map(([sx, sz]) => lp(sx, sz, y2)); for (let i = 0; i < 4; i++) { R(Q[i], Q2[(i + 1) % 4], .45, YEL); R(Q[(i + 1) % 4], Q2[i], .45, YEL); } R(Q[0], Q[2], .4, YEL); }
  }
  // 導管（井口的管子）、靠船平台與爬梯（朝拖船那隻腳）
  for (let i = 0; i < 6; i++) { const x = RIG_DER.x - 2.2 + (i % 3) * 2.2, z = RIG_DER.z - 1.2 + (i / 3 | 0) * 2.4; R([x, RIG_SEAB, z], [x, RIG_DK1, z], .42, GRY, 22, 10); }
  { const [x, , z] = lp(-1, 1, 2); B(x - 1.5, 2.6, z + 1.5, 6, .45, 3.6, GRY, 29); B(x - 1.5, -.6, z + 1.5, 6, .45, 3.6, GRY, 29); for (const dx of [-3.5, 1.5]) Bar([x + dx, -2.5, z + 3.3], [x + dx, 4, z + 3.3], .3, YEL); Bar([x - .4, 3, z + .4], [x - .2, RIG_DK1 - 1, z + .2], .25, GRY, 22); }
  // 立管與 J 管：沿兩隻腳外側從海床爬到下層甲板（跟著腳的斜度），每 4 m 一個管夾；兩支沉箱（消防水泵、排水）從下層甲板外緣垂進海裡
  for (const [sx, sz, n] of [[1, -1, 3], [-1, -1, 2], [1, 1, 1]]) for (let i = 0; i < n; i++) {
    const off = 2.3 + i * .95, side = (i - (n - 1) / 2) * 1.1, at = y => { const [x, z] = rigLeg(sx, sz, y), l = Math.hypot(x, z); return [x + x / l * off - z / l * side, y, z + z / l * off + x / l * side]; };
    R(at(RIG_SEAB), at(RIG_DK1 - 1.2), .2 + (i % 2) * .12, i ? GRY : 0x2c2a28, 22, 10);
    for (let y = -6; y < RIG_DK1 - 2; y += 4) { const a = at(y), [lx, lz] = rigLeg(sx, sz, y); Bar([lx, y, lz], a, .22, DKG); }
  }
  for (const [x, z, r] of [[10, -17, .75], [-6, 17, .6]]) { R([x, -6, z], [x, RIG_DK1, z], r, GRY, 21, 14); R([x, RIG_DK1 - 4, z], [x, RIG_DK1 - 4, z * .87], .3, DKG); }
  const j1 = k.mat.length;
  // 甲板：下層、主甲板（鋼板），邊梁、甲板之間的柱與斜撐、腳頂的柱
  B(0, RIG_DK1 - .6, 0, 36, 1.2, 31, GRY, 29); B(0, RIG_DK2 - .7, 0, 44, 1.4, 37, GRY, 29);
  B(0, RIG_DK1 - 1.6, 0, 37, .9, 32, DKG, 21); B(0, RIG_DK2 - 1.85, 0, 45, 1, 38, DKG, 21);
  for (const [sx, sz] of corner) { const [x, , z] = lp(sx, sz, RIG_LEGT); R([x, RIG_LEGT, z], [x, RIG_DK2 - 1.5, z], 1.5, YEL, 21, 16); }
  for (let i = -2; i <= 2; i++) for (const s of [-1, 1]) Bar([i * 8, RIG_DK1, s * 15], [i * 8, RIG_DK2 - 2, s * 17.5], .45, DKG);
  // 欄杆（兩層甲板的邊）：扶手、中欄、每 2.2 m 一根柱
  const rail = (x0, z0, x1, z1, y) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 2.2)); Bar([x0, y + 1.1, z0], [x1, y + 1.1, z1], .08, YEL); Bar([x0, y + .55, z0], [x1, y + .55, z1], .06, YEL); for (let i = 0; i <= n; i++) B(lerp(x0, x1, i / n), y + .55, lerp(z0, z1, i / n), .08, 1.1, .08, YEL, 21); };
  for (const [y, hx, hz] of [[RIG_DK2, 22, 18.5], [RIG_DK1, 18, 15.5]]) { rail(-hx, -hz, hx, -hz, y); rail(-hx, hz, hx, hz, y); rail(hx, -hz, hx, hz, y); rail(-hx, -hz, -hx, hz, y); }
  // 生活艙（西側，四層）：白色烤漆鋼板、每層一排窗（亮窗 13），屋頂上的通訊室與天線
  const AX = -15, AZ = 1, AW = 13, AD = 22;
  B(AX, RIG_DK2 + 6.3, AZ, AW, 12.6, AD, WHT, 34); B(AX - 1.5, RIG_DK2 + 14.2, AZ, 8, 3.2, 12, WHT, 34);
  B(AX, RIG_DK2 + 12.7, AZ, AW + .4, .3, AD + .4, DKG, 29);
  for (let f = 0; f < 4; f++) {
    const y = RIG_DK2 + 1.75 + f * 3.1;
    for (let i = 0; i < 8; i++) { const z = AZ - AD / 2 + 1.7 + i * 2.65; B(AX + AW / 2 + .03, y, z, .06, 1.05, 1.5, 0x9fb8c8, 13); B(AX - AW / 2 - .03, y, z, .06, 1.05, 1.5, 0x9fb8c8, 13); }
    for (let i = 0; i < 4; i++) { const x = AX - AW / 2 + 1.8 + i * 3.1; B(x, y, AZ + AD / 2 + .03, 1.5, 1.05, .06, 0x9fb8c8, 13); B(x, y, AZ - AD / 2 - .03, 1.5, 1.05, .06, 0x9fb8c8, 13); }
    Bar([AX + AW / 2 + .2, y + 1.5, AZ - AD / 2], [AX + AW / 2 + .2, y + 1.5, AZ + AD / 2], .12, DKG);
  }
  for (let i = 0; i < 4; i++) B(AX - 1.5 + 4.03, RIG_DK2 + 14.4, AZ - 4.5 + i * 3, .06, 1.2, 2.2, 0x9fb8c8, 13);
  Bar([AX - 3, RIG_DK2 + 15.8, AZ - 3], [AX - 3, RIG_DK2 + 23, AZ - 3], .18, GRY, 22); Bar([AX - 5, RIG_DK2 + 15.8, AZ + 3], [AX - 5, RIG_DK2 + 20, AZ + 3], .14, GRY, 22);
  // 救生艇（橘色）掛在生活艙北面的吊架上
  for (const i of [-1, 1]) { const [x, z] = P(AX + i * 3.4, AZ + AD / 2 + 2.4); k.cyl(x, RIG_DK2 + 4.4, z, 1.25, 1.25, 7.5, 14, ORG, 34, 0, 0, Math.PI / 2); B(AX + i * 3.4, RIG_DK2 + 5.4, AZ + AD / 2 + 2.4, 5.4, .9, 1.9, ORG, 34); for (const s of [-3, 3]) Bar([AX + i * 3.4 + s, RIG_DK2 + 7.6, AZ + AD / 2 - .2], [AX + i * 3.4 + s, RIG_DK2 + 7.6, AZ + AD / 2 + 2.6], .28, GRY, 22); }
  // 直升機坪：八角形的板（深綠防滑面）、白色周邊線、黃色著陸圈、白色 H、周邊的綠燈與往下斜到生活艙的撐
  { const H = RIG_HELI, [hx, hz] = P(H.x, H.z);
    k.cyl(hx, H.y - .35, hz, H.R, H.R, .7, 8, 0x1f4a2c, 29, 0, Math.PI / 8, 0);
    k.torus(hx, H.y + .02, hz, 4.55, .22, 48, 0xe0b020, 2);
    const ap = H.R * Math.cos(Math.PI / 8) - .7;
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, L = 2 * ap * Math.tan(Math.PI / 8); B(H.x + Math.cos(a) * ap, H.y + .02, H.z + Math.sin(a) * ap, .28, .04, L, 0xe8e8e8, 2, -a); }
    for (const s of [-1, 1]) B(H.x + s * 1.8, H.y + .02, H.z, .55, .04, 6, 0xe8e8e8, 2); B(H.x, H.y + .02, H.z, 3.1, .04, .55, 0xe8e8e8, 2);
    for (let i = 0; i < 8; i++) { const a = (i + .5) / 8 * Math.PI * 2; B(H.x + Math.cos(a) * H.R * .93, H.y + .12, H.z + Math.sin(a) * H.R * .93, .35, .2, .35, 0x30ff60, 8); }
    for (let i = 0; i < 8; i++) { const a0 = i / 8 * Math.PI * 2, a1 = (i + 1) / 8 * Math.PI * 2, R1 = H.R + 1.1; Bar([H.x + Math.cos(a0) * R1, H.y - .25, H.z + Math.sin(a0) * R1], [H.x + Math.cos(a1) * R1, H.y - .25, H.z + Math.sin(a1) * R1], .1, DKG); }
    for (const [dx, dz] of [[-7, -6], [-7, 6], [4, -7], [4, 7]]) Bar([H.x + dx, H.y - .8, H.z + dz], [AX + (dx > 0 ? 5 : -6), RIG_DK2 + 12.6, AZ + dz * .9], .5, YEL);
  }
  // 鑽台與鑽塔：底座、四根往上收的角柱、每 4.85 m 一圈橫桿與 X 撐、天車、游車與鋼索、旁邊一排立著的鑽桿
  { const D = RIG_DER, dl = (sx, sz, y) => { const t = (y - D.y0) / (D.y1 - D.y0), b = lerp(D.b0, D.b1, t); return [D.x + sx * b, y, D.z + sz * b]; };
    B(D.x, RIG_DK2 + 1.8, D.z, 15, 3.6, 15, WHT, 55); B(D.x, D.y0 - .3, D.z, 16, .6, 16, GRY, 29);
    for (const [sx, sz] of corner) Bar(dl(sx, sz, D.y0), dl(sx, sz, D.y1), .5, WHT, 21);
    const NL = 10;
    for (let l = 0; l <= NL; l++) {
      const y = lerp(D.y0, D.y1, l / NL), Q = corner.map(([sx, sz]) => dl(sx, sz, y));
      for (let i = 0; i < 4; i++) Bar(Q[i], Q[(i + 1) % 4], .26, WHT);
      if (l < NL) { const y2 = lerp(D.y0, D.y1, (l + 1) / NL), Q2 = corner.map(([sx, sz]) => dl(sx, sz, y2)); for (let i = 0; i < 4; i++) { Bar(Q[i], Q2[(i + 1) % 4], .18, WHT); Bar(Q[(i + 1) % 4], Q2[i], .18, WHT); } }
    }
    B(D.x, D.y1 + 1.4, D.z, 4.6, 2.8, 4.6, YEL, 21); B(D.x, D.y1 - 14, D.z + D.b1 + .9, 3.6, .3, 1.6, GRY, 29);
    R([D.x, D.y0, D.z], [D.x, D.y1, D.z], .12, DKG, 22, 6); B(D.x, D.y0 + 12, D.z, 2.4, 3.2, 2.4, YEL, 21);
    for (let i = 0; i < 18; i++) { const x = D.x - 6.5 + (i % 6) * .5, z = D.z + 3 + (i / 6 | 0) * .5; R([x, D.y0, z], [x, D.y0 + 26, z], .12, GRY, 22, 6); }
    const [bx, bz] = P(D.x, D.z); kb.box(bx, D.y1 + 3.1, bz, .7, .7, .7, 0xff2010, 8);
  }
  // 生產模組（東南）：廠房、臥式分離器、立式儲槽、管廊、排氣管
  B(13, RIG_DK2 + 4, 12, 14, 8, 10, GRY, 55); B(13, RIG_DK2 + 8.2, 12, 14.4, .4, 10.4, YEL, 29);
  for (let i = 0; i < 3; i++) { const z = 9 + i * 3; R([6, RIG_DK2 + 2 + i * .2, z], [20, RIG_DK2 + 2 + i * .2, z], .9 + (i % 2) * .4, WHT, 34, 14); }
  for (let i = 0; i < 7; i++) R([-6, RIG_DK2 + 1 + i * .55, -16.5], [20, RIG_DK2 + 1 + i * .55, -16.5], .22, i % 2 ? YEL : GRY, 21, 8);
  for (const [x, z, r, h] of [[17, -10, 2.6, 9], [11.5, -10, 2.2, 7.5], [-4, -12, 1.8, 6]]) { const [X, Z] = P(x, z); k.cyl(X, RIG_DK2 + h / 2, Z, r, r, h, 18, WHT, 34); k.cyl(X, RIG_DK2 + h + .25, Z, r * .6, r * .6, .5, 12, GRY, 22); }
  R([-7, RIG_DK2 + 13, -2], [-7, RIG_DK2 + 24, -2], .7, GRY, 22, 10);
  // 吊車（東北、西南）：基座、轉台、駕駛室、格子吊臂、吊鉤
  for (const [x, z, a, el] of [[20, 16, 2.4, .5], [-20, -16, -1, .62]]) {
    const [X, Z] = P(x, z);
    k.cyl(X, RIG_DK2 + 3.5, Z, 1.6, 1.6, 7, 16, YEL, 21); B(x, RIG_DK2 + 8, z, 4.6, 2, 4.2, YEL, 34, a); B(x + Math.cos(a + 1.6) * 1.6, RIG_DK2 + 9.7, z - Math.sin(a + 1.6) * 1.6, 2, 2.2, 2, WHT, 34, a);
    const L = 34, tip = [x + Math.cos(a) * Math.cos(el) * L, RIG_DK2 + 9 + Math.sin(el) * L, z - Math.sin(a) * Math.cos(el) * L], root = [x, RIG_DK2 + 9, z];
    const ux = -Math.sin(a), uz = -Math.cos(a), seg = 10;   // 吊臂兩側的弦桿（往尖端收窄）
    for (const s of [-1, 1]) for (const h of [0, 1]) {
      const pt = t => [lerp(root[0], tip[0], t) + ux * s * lerp(1.1, .35, t), lerp(root[1], tip[1], t) + h * lerp(1.4, .4, t), lerp(root[2], tip[2], t) + uz * s * lerp(1.1, .35, t)];
      Bar(pt(0), pt(1), .2, YEL);
      for (let i = 0; i < seg; i++) Bar(pt(i / seg), [lerp(root[0], tip[0], (i + 1) / seg) + ux * -s * lerp(1.1, .35, (i + 1) / seg), lerp(root[1], tip[1], (i + 1) / seg) + h * lerp(1.4, .4, (i + 1) / seg), lerp(root[2], tip[2], (i + 1) / seg) + uz * -s * lerp(1.1, .35, (i + 1) / seg)], .12, YEL);
    }
    R(tip, [tip[0], tip[1] - 14, tip[2]], .05, DKG, 22, 4); B(tip[0], tip[1] - 14.6, tip[2], .8, 1.1, .8, YEL, 21);
    const [tx, tz] = P(tip[0], tip[2]); kb.box(tx, tip[1] + .5, tz, .5, .5, .5, 0xff2010, 8);
  }
  // 火炬臂：三角桁架往外斜伸、尖端的燃燒器
  { const A = V3(...RIG_FLB), Bv = V3(...RIG_FLT), d = Bv.clone().sub(A), L = d.length(); d.normalize();
    const u = V3().crossVectors(d, V3(0, 1, 0)).normalize(), v = V3().crossVectors(u, d).normalize();
    const pt = (t, i) => { const r = lerp(1.9, .8, t), an = i / 3 * Math.PI * 2 + Math.PI / 2; return A.clone().addScaledVector(d, t * L).addScaledVector(u, Math.cos(an) * r).addScaledVector(v, Math.sin(an) * r).toArray(); };
    const n = Math.round(L / 3.4);
    for (let i = 0; i < 3; i++) Bar(pt(0, i), pt(1, i), .38, WHT);
    for (let j = 0; j < n; j++) for (let i = 0; i < 3; i++) { Bar(pt(j / n, i), pt((j + 1) / n, (i + 1) % 3), .2, WHT); if (j % 2 === 0) Bar(pt(j / n, i), pt(j / n, (i + 1) % 3), .2, WHT); }
    const [X, Z] = P(RIG_FLT[0], RIG_FLT[2]); k.cyl(X, RIG_FLT[1] + .6, Z, 1.1, 1.1, 1.2, 12, DKG, 22); k.cyl(X, RIG_FLT[1] + 1.4, Z, .6, .6, .4, 10, 0x2a1a10, 21);
    kb.box(X, RIG_FLT[1] - 1.4, Z, .5, .5, .5, 0xff2010, 8);
  }
  // 投光燈的燈具（自己發光；照明是 signLights）與甲板邊零星的燈
  const LAMPS = [[21, RIG_DK2 + 3, 18], [-21, RIG_DK2 + 3, -18], [21, RIG_DK2 + 3, -18], [RIG_DER.x + 2, RIG_DER.y0 + 22, RIG_DER.z + 2], [AX + 6.8, RIG_DK2 + 11, -10], [AX + 6.8, RIG_DK2 + 11, 12]];
  for (const [x, y, z] of LAMPS) { B(x, y, z, .8, .5, .8, 0xffe2b0, 8); Bar([x, y - .3, z], [x, RIG_DK2, z], .14, GRY, 22); const [X, Z] = rigW(x, z); signLights.push({ x: X, y: y - .6, z: Z, col: lin(0xffd7a0), r: 42, i: 6, w: 1 }); }
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; B(Math.cos(a) * 21.5, RIG_DK2 + .3, Math.sin(a) * 17.5, .25, .25, .25, 0xffd090, 8); }
  // ── 細節：甲板下的鋼梁格、下層甲板的設備、管架、貨櫃、排氣管與煙垢、通訊塔、風向袋、救生圈 ──
  for (let i = -4; i <= 4; i++) { B(i * 4.8, RIG_DK2 - 2.85, 0, .4, 1, 37, DKG, 21); B(i * 3.9, RIG_DK1 - 2.55, 0, .35, .9, 31, DKG, 21); }
  for (let i = -3; i <= 3; i++) { B(0, RIG_DK2 - 2.85, i * 5.6, 44, .9, .35, DKG, 21); B(0, RIG_DK1 - 2.5, i * 4.6, 36, .8, .3, DKG, 21); }
  { const y0 = RIG_DK1;   // 下層甲板：兩支臥式分離器、泵浦撬座、儲水槽、配管
    for (const z of [-6.5, -2.5]) { const [X, Z] = P(-6, z); k.cyl(X, y0 + 1.9, Z, 1.35, 1.35, 8.5, 18, WHT, 34, 0, 0, Math.PI / 2); for (const s of [-1, 1]) { k.cyl(...P(-6 + s * 4.25, z).flatMap((v, j) => j ? [v] : [v, y0 + 1.9]), 1.35, .4, .5, 18, WHT, 34, 0, 0, s * Math.PI / 2); B(-6 + s * 3, y0 + .3, z, .5, .6, 2.2, DKG, 21); } }
    for (const [x, z] of [[9, 9], [13, 9], [-14, -10], [-10, -12]]) { B(x, y0 + .2, z, 3.2, .4, 2.4, YEL, 21); B(x - .5, y0 + 1.1, z, 1.6, 1.4, 1.3, 0x3a6a8a, 34); const [X, Z] = P(x + .9, z); k.cyl(X, y0 + 1, Z, .45, .45, 1.6, 12, GRY, 21, 0, 0, Math.PI / 2); }
    for (const [x, z] of [[-14, 6], [-14, 10.5]]) { const [X, Z] = P(x, z); k.cyl(X, y0 + 2, Z, 1.8, 1.8, 4, 18, 0x6a7a6e, 34); }
    for (let i = 0; i < 5; i++) { const y = y0 + 1.2 + (i % 2) * .5, z = 12.6 + i * .55; R([-16, y, z], [16, y, z], .16 + (i % 3) * .07, [GRY, YEL, 0x2f6a3a, 0x8a2a20, GRY][i], 21, 8); }
    for (let x = -14; x <= 14; x += 4) { B(x, y0 + .7, 13.7, .25, 1.4, 3, DKG, 21); B(x, y0 + 1.95, 13.7, .3, .2, 3.2, DKG, 21); }
  }
  // 貨櫃（主甲板北側，兩個疊著）：波浪板（62），門那端暗一點的門框與鎖桿
  for (const [x, y, z, col] of [[-4, 0, 11, 0x1f4e7a], [-4, 1, 11, 0x8a2b1e], [2.4, 0, 14.4, 0x2e5a3a], [-4.2, 0, 15.2, 0xb8b2a4]]) {
    const yy = RIG_DK2 + 1.3 + y * 2.6; B(x, yy, z, 6.06, 2.59, 2.44, col, 55); B(x + 3.04, yy, z, .08, 2.5, 2.36, new T.Color(lin(col)).multiplyScalar(.7), 21);
    for (const dz of [-.5, .5]) B(x + 3.1, yy, z + dz, .05, 2.3, .05, GRY, 22);
  }
  // 排氣管（生產模組屋頂的兩支燃氣渦輪排氣，頂端燻黑）
  for (const [x, z] of [[10, 13.5], [16, 13.5]]) { const [X, Z] = P(x, z); k.cyl(X, RIG_DK2 + 13.2, Z, .95, 1.05, 9.6, 16, GRY, 22); k.cyl(X, RIG_DK2 + 18.6, Z, .98, .97, 1.2, 16, 0x141210, 59); k.cyl(X, RIG_DK2 + 17.4, Z, .97, .96, 1.2, 16, 0x3a3430, 59); B(x, RIG_DK2 + 9.6, z, 2.6, 2.4, 2.6, GRY, 55); }
  // 通訊塔（生活艙屋頂）：三角格子塔、兩面碟形天線、鞭狀天線
  { const bx = AX + 4, bz = AZ + 7, y0 = RIG_DK2 + 12.85, H = 14, leg = i => { const a = i / 3 * Math.PI * 2; return [bx + Math.cos(a) * .9, bz + Math.sin(a) * .9]; };
    for (let i = 0; i < 3; i++) { const [x0, z0] = leg(i), [x1, z1] = leg((i + 1) % 3); Bar([x0, y0, z0], [lerp(x0, bx, .6), y0 + H, lerp(z0, bz, .6)], .12, WHT);
      for (let j = 0; j < 7; j++) { const t0 = j / 7, t1 = (j + 1) / 7; Bar([lerp(x0, lerp(x0, bx, .6), t0), y0 + H * t0, lerp(z0, lerp(z0, bz, .6), t0)], [lerp(x1, lerp(x1, bx, .6), t1), y0 + H * t1, lerp(z1, lerp(z1, bz, .6), t1)], .06, 0xc04020); } }
    for (const [h, a] of [[9, .4], [6.5, 2.6]]) { const [X, Z] = P(bx + Math.cos(a) * 1.2, bz - Math.sin(a) * 1.2); k.cyl(X, y0 + h, Z, .85, .55, .45, 18, 0xe8e6e0, 34, 0, a, Math.PI / 2); }
    Bar([bx, y0 + H, bz], [bx, y0 + H + 4, bz], .05, GRY, 22);
  }
  // 風向袋（直升機坪邊，朝下風）：桿、橘白相間的錐筒
  { const [ox, oz] = rigW(0, 0), [ex, ez] = rigW(1, 0), [fx, fz] = rigW(0, 1), wx = RIG_WIND[0] * (ex - ox) + RIG_WIND[1] * (ez - oz), wz = RIG_WIND[0] * (fx - ox) + RIG_WIND[1] * (fz - oz), wa = Math.atan2(-wz, wx);   // 局部框裡的風向；(cos wa, −sin wa) 是下風
    const sx = RIG_HELI.x - 9, sz = RIG_HELI.z + 9, y = RIG_HELI.y + 3.2; Bar([sx, RIG_HELI.y - 1, sz], [sx, y + .3, sz], .1, WHT, 59);
    for (let i = 0; i < 4; i++) { const r0 = .42 - i * .07, [X, Z] = P(sx + Math.cos(wa) * (.5 + i * .62), sz - Math.sin(wa) * (.5 + i * .62)); k.cyl(X, y - i * .06, Z, r0 - .07, r0, .62, 12, i % 2 ? 0xf0f0ea : 0xff5a10, 2, 0, wa, -Math.PI / 2); }
  }
  // 救生圈（主甲板欄杆上）
  for (const [x, z, a] of [[22.1, -8, Math.PI / 2], [22.1, 8, Math.PI / 2], [-6, -18.6, 0], [10, 18.6, 0], [-22.1, -12, Math.PI / 2]]) { const [X, Z] = P(x, z); k.torus(X, RIG_DK2 + .75, Z, .36, .09, 14, 0xff5a10, 2, 0, a, 0); }
  // 材質換成海上平台的做舊（m-uberX.mjs 59–63）：塗漆鋼 59、浪花帶 60、甲板 61、波浪板 62、鍍鋅 63；發光與窗不動
  rigAge(k, j0, j1);
  const put = m => { m.position.set(RIG.cx, 0, RIG.cz); m.rotation.y = Math.atan2(-RIG.s, RIG.c); scene.add(m); return m; };
  put(new T.Mesh(k.build(), MAT.ux));
  RIG.blink = put(new T.Mesh(kb.build(), MAT.ux));
  // 碰撞：四隻腳在海面那一圈（斜腳取海面上下 3 m 的平均）
  for (const [sx, sz] of corner) { const [x, z] = rigLeg(sx, sz, SEA_Y), [X, Z] = rigW(x, z); circles.push({ x: X, z: Z, r: 2.4, w: 1 }); }
}

// ─── 暴風海面（m-rigSea.mjs）：極座標網格，中心密、往外疏；外緣比 RIG_R1 多 RIG_PAD ───
const MAT_RIGSEA = groundMat('rigSea', { uRig: { value: new T.Vector4(RIG.cx, RIG.cz, RIG_R0, RIG_R1) }, uRigF: { value: new T.Vector4(RIG.c, RIG.s, 0, 0) }, uRigK: { value: new T.Vector4(0, 0, 10, 0) }, uRigKB: { value: new T.Vector4() }, uRigT: { value: new T.Vector4(0, 0, 0, 0) } });
{
  const NA = isTouch ? 320 : 512, Rmax = RIG_R1 + RIG_PAD, rings = [0];
  while (rings[rings.length - 1] < Rmax) rings.push(Math.min(Rmax, rings[rings.length - 1] + .8 + rings[rings.length - 1] * .012));
  rings[rings.length - 1] = Rmax / Math.cos(Math.PI / NA);   // 多邊形外接，邊上不會露出縫
  const pos = new Float32Array((1 + (rings.length - 1) * NA) * 3), idx = [];
  pos.set([RIG.cx, SEA_Y, RIG.cz], 0);
  for (let j = 1; j < rings.length; j++) for (let i = 0; i < NA; i++) { const a = i / NA * Math.PI * 2, v = 1 + (j - 1) * NA + i; pos.set([RIG.cx + Math.cos(a) * rings[j], SEA_Y, RIG.cz + Math.sin(a) * rings[j]], v * 3); }
  for (let i = 0; i < NA; i++) idx.push(0, 1 + (i + 1) % NA, 1 + i);
  for (let j = 1; j < rings.length - 1; j++) for (let i = 0; i < NA; i++) { const a = 1 + (j - 1) * NA + i, b = 1 + (j - 1) * NA + (i + 1) % NA, c = a + NA, d = b + NA; idx.push(a, b, c, b, d, c); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setIndex(idx);
  const nr = new Float32Array(pos.length); for (let i = 1; i < nr.length; i += 3) nr[i] = 1; g.setAttribute('normal', new T.BufferAttribute(nr, 3));
  const m = new T.Mesh(g, MAT_RIGSEA); m.frustumCulled = false; m.renderOrder = 1; groundAdd(m, null);
  RIG.sea = m;
  MAT_WATER.uniforms.uRig.value.set(RIG.cx, RIG.cz, RIG_R0, RIG_R1);
}

// ─── 特效（m-rigFx.mjs）：火焰、黑煙、斜雨、探照燈光柱 ───
const RIG_FXU = { uRigP: { value: new T.Vector4(0, 0, 0, 1) }, uRigR: { value: new T.Vector4(RIG.cx, RIG.cz, 300, SEA_Y + 1.5) }, uRigS: { value: new T.Vector4(0, 0, 8, 0) }, uRigS2: { value: new T.Vector4(40, SEA_Y, 0, 0) } };   // uRigS／S2：21-rigbeast.js 的水幕
const rigFxMat = (kind, o) => new T.ShaderMaterial({ name: 'rigFx', defines: { [kind]: '' }, uniforms: { ...shared(ALLU), ...RIG_FXU }, transparent: true, depthWrite: false, side: T.DoubleSide, ...o });
{
  // 面向相機的四邊形一批：aQ = (角落 x, 沿長 0..1, 種子, 大小)
  const quads = (list, rows) => {
    const q = [], idx = [], pos = [];
    list.forEach(([seed, size], k) => {
      for (let j = 0; j <= rows; j++) for (const cx of [-1, 1]) { q.push(cx, j / rows, seed, size); pos.push(0, 0, 0); }
      const b = k * (rows + 1) * 2;
      for (let j = 0; j < rows; j++) { const a = b + j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('aQ', new T.Float32BufferAttribute(q, 4)); g.setIndex(idx);
    return g;
  };
  const add = (g, mat, ro) => { const m = new T.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = ro; scene.add(m); return m; };
  RIG.smoke = add(quads([[1.3, 1], [5.9, .8], [9.4, .62]], 12), rigFxMat('SMOKE', { premultipliedAlpha: true }), 19);
  RIG.flame = add(quads([[0, 1], [3.7, .78], [7.1, .6], [11.3, .42]], 10), rigFxMat('FLAME', { blending: T.AdditiveBlending }), 21);
  // 雨：每條雨絲 4 個頂點（position 是角落：x ±1、y 0..1），aR 是亂數（雨區裡的 x、z、相位、長度）
  const NR = isTouch ? 5000 : 12000, rr = rng(5150), pos = new Float32Array(NR * 12), ar = new Float32Array(NR * 16), idx = new Uint32Array(NR * 6);
  for (let i = 0; i < NR; i++) {
    const a = rr(), b = rr(), c = rr(), d = rr();
    for (let j = 0; j < 4; j++) { pos.set([j & 1 ? 1 : -1, j >> 1, 0], i * 12 + j * 3); ar.set([a, b, c, d], i * 16 + j * 4); }
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 1, i * 4 + 3, i * 4 + 2], i * 6);
  }
  const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(pos, 3)); rg.setAttribute('aR', new T.BufferAttribute(ar, 4)); rg.setIndex(new T.BufferAttribute(idx, 1));
  RIG.rain = add(rg, rigFxMat('RAIN', { blending: T.AdditiveBlending }), 20);
  const bg = new T.CylinderGeometry(.3, 6.5, 1, 24, 1, true).translate(0, -.5, 0);
  RIG.beam = add(bg, rigFxMat('BEAM', { blending: T.AdditiveBlending }), 18);
}

// ─── 拖船：放樣的船身（船頭 +z、船尾平、V 形船底、船頭翹），上層艙、駕駛台一圈窗、煙囪、桅杆與航行燈、碰墊、拖纜絞盤、探照燈 ───
{
  const k = new Kit(), L = 27, Bm = 9.6, NS = 28, NP = 6;
  const hw = s => Bm / 2 * (1 - Math.pow(Math.max(0, (s - .5) / .5), 2.1) * .93) * (s < .1 ? .86 + s / .1 * .14 : 1);
  const dk = s => 2.3 + 1.4 * Math.pow(Math.max(0, (s - .55) / .45), 2);
  const kl = s => -2.4 * (1 - Math.pow(Math.max(0, (s - .72) / .28), 1.4) * .75) * (s < .06 ? .55 + s / .06 * .45 : 1);
  const prof = s => { const w = hw(s), q = kl(s), d = dk(s); return [[0, q], [w * .5, q * .86], [w * .86, q * .45], [w, -.1], [w * 1.02, d * .55], [w * 1.03, d]]; };
  // 船身：每站左右各一串點（左舷由上到龍骨、右舷由龍骨到上），站與站之間連成帶；水線以下黑、以上紅，另外一條白色腰線
  const hull = (y0, y1, col, mat) => {
    const pos = [], idx = [];
    for (let i = 0; i <= NS; i++) { const s = i / NS, z = (s - .5) * L, Pq = prof(s); for (let j = NP - 1; j >= 0; j--) pos.push(-Pq[j][0], Pq[j][1], z); for (let j = 1; j < NP; j++) pos.push(Pq[j][0], Pq[j][1], z); }
    const RW = NP * 2 - 1;
    for (let i = 0; i < NS; i++) for (let j = 0; j < RW - 1; j++) { const a = i * RW + j, b = a + RW; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    let g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); g = g.toNonIndexed();
    // 只留這一段高度（三角形重心）
    const p = g.attributes.position.array, n = g.attributes.normal.array, kp = [], kn = [];
    for (let t = 0; t < p.length; t += 9) { const cy = (p[t + 1] + p[t + 4] + p[t + 7]) / 3; if (cy >= y0 && cy < y1) { kp.push(...p.slice(t, t + 9)); kn.push(...n.slice(t, t + 9)); } }
    const h = new T.BufferGeometry(); h.setAttribute('position', new T.Float32BufferAttribute(kp, 3)); h.setAttribute('normal', new T.Float32BufferAttribute(kn, 3));
    k.add(h, col, mat);
  };
  hull(-9, .5, 0x151617, 21); hull(.5, 9, 0xa01a12, 21);
  { const dp = [], di = [];
    for (let i = 0; i <= NS; i++) { const s = i / NS, z = (s - .5) * L, w = hw(s) * 1.03, d = dk(s); dp.push(-w, d, z, w, d, z); if (i < NS) { const a = i * 2; di.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    const tp = prof(0), b0 = dp.length / 3; for (let j = 0; j < NP; j++) dp.push(-tp[j][0], tp[j][1], -L / 2); for (let j = 0; j < NP; j++) dp.push(tp[j][0], tp[j][1], -L / 2);
    for (let j = 0; j < NP - 1; j++) { const a = b0 + j, b = b0 + NP + j; di.push(a, a + 1, b, a + 1, b + 1, b); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(dp, 3)); g.setIndex(di); g.computeVertexNormals(); k.add(g, 0x3a3c3e, 29);
  }
  for (let i = 0; i <= NS; i++) { const s = i / NS; if (i % 2 === 0 && s > .05) k.box(hw(s) * 1.03 + .02, 1.9, (s - .5) * L, .05, .3, L / NS * 2.05, 0xe8e8e8, 2); if (i % 2 === 0 && s > .05) k.box(-hw(s) * 1.03 - .02, 1.9, (s - .5) * L, .05, .3, L / NS * 2.05, 0xe8e8e8, 2); }
  k.box(0, 4.6, 1.6, 6.6, 4.6, 9, 0xe4e4e0, 34); k.box(0, 8.9, 3.4, 6.2, 2, 5.2, 0xe4e4e0, 34); k.box(0, 10.05, 3.4, 7.2, .3, 5.8, 0x2a2c2e, 29);
  for (const s of [-1, 1]) { k.box(s * 3.12, 8.95, 3.4, .06, 1.1, 4.6, 0x9fb8c8, 13); for (let i = 0; i < 3; i++) k.box(s * 3.32, 5.6, -1.5 + i * 2.2, .06, .5, .5, 0x9fb8c8, 13); }
  k.box(0, 8.95, 6.02, 5.6, 1.1, .06, 0x9fb8c8, 13); k.box(0, 8.95, .78, 5.6, 1.1, .06, 0x9fb8c8, 13);
  for (const s of [-1, 1]) { k.box(s * 1.8, 7.6, -1.4, 1.1, 4.6, 1.3, 0x2a2c2e, 21); k.box(s * 1.8, 9.95, -1.4, 1.12, .3, 1.32, 0xd0a018, 21); }
  k.bar(0, 10, 3.6, 0, 15.5, 3.2, .25, .25, 0x2a2c2e, 22); k.bar(-1.6, 13.4, 3.3, 1.6, 13.4, 3.3, .18, .18, 0x2a2c2e, 22);
  k.box(0, 15.7, 3.25, .35, .35, .35, 0xfff4e0, 8); k.box(-1.75, 13.4, 3.3, .3, .3, .3, 0xff1808, 8); k.box(1.75, 13.4, 3.3, .3, .3, .3, 0x10ff40, 8); k.box(0, 3.4, -12.8, .3, .3, .3, 0xfff4e0, 8);
  k.rod(-1.3, 2.4, -7, 1.3, 2.4, -7, .9, 14, 0x2a2c2e, 22); k.box(0, 3.2, -7, 3.3, 1.6, 1.6, 0x2a2c2e, 21); k.rod(0, 2.3, -10.8, 0, 4.2, -10.8, .4, 10, 0xd0a018, 21);
  k.rod(-2.5, 2.6, L / 2 - .4, 2.5, 2.6, L / 2 - .4, 1.1, 14, 0x141414, 30);
  for (let i = 0; i < 7; i++) for (const s of [-1, 1]) { const z = -9 + i * 2.8, w = hw(z / L + .5) * 1.03; k.torus(s * (w + .15), 1.4, z, .55, .25, 12, 0x141414, 30, 0, Math.PI / 2, 0); }
  k.rod(0, 10.3, 4.6, 0, 11, 4.6, .35, 10, 0x2a2c2e, 22);
  const m = new T.Mesh(k.build(), MAT.ux); m.frustumCulled = false; scene.add(m);
  RIG.tug.m = m; RIG.tug.light = V3(0, 11, 4.6);
}

// ─── 每幀（99-main.js 的 step，在戶外時） ───
const _rq = new T.Quaternion(), _re = new T.Euler(), _rv = V3(), _rd = V3(), _rm = new T.Matrix4();
function rigUpdate(dt) {
  const t = uTimeNow(), cam = camera.position, cd = Math.hypot(cam.x - RIG.cx, cam.z - RIG.cz);
  RIG.near = cd < 5000;
  // 太遠就整組不畫（原本的海面也不挖洞）
  RIG.sea.visible = RIG.rain.visible = RIG.beam.visible = RIG.tug.m.visible = RIG.near;
  MAT_WATER.uniforms.uRig.value.w = RIG.near ? RIG_R1 : -100;
  if (!RIG.near) return;
  // 火炬：閃爍
  const fl = .84 + .08 * Math.sin(t * 13.1) + .05 * Math.sin(t * 31.7 + 1) + .05 * Math.sin(t * 5.3 + 2) + .03 * Math.sin(t * 47.3);
  RIG.flare = fl;
  const [fx, fz] = rigW(RIG_FLT[0], RIG_FLT[2]);
  RIG_FXU.uRigP.value.set(fx, RIG_FLT[1] + 1.5, fz, fl);
  RIG.blink.visible = Math.sin(t * Math.PI * .9) > .55;
  // 拖船：頂著浪在平台西北邊待命，船頭慢慢擺、位置慢慢飄；照船頭、船尾、兩舷的浪高算起伏、俯仰、橫搖（帶一點慣性）
  const B = RIG.tug, [x0, z0] = rigW(RIG_TUG.x + 3 * Math.sin(t * .05), RIG_TUG.z + 2 * Math.sin(t * .07 + 1));
  const [px, pz] = rigW(-14, 12);
  B.x = x0; B.z = z0; B.yaw = Math.atan2(px - x0, pz - z0) + .3 + .12 * Math.sin(t * .09) + .05 * Math.sin(t * .23);
  const f1 = Math.sin(B.yaw), f2 = Math.cos(B.yaw), L2 = 11, W2 = 4.2;
  const hb = rigWave(B.x + f1 * L2, B.z + f2 * L2, t), hs = rigWave(B.x - f1 * L2, B.z - f2 * L2, t), hl = rigWave(B.x - f2 * W2, B.z + f1 * W2, t), hr = rigWave(B.x + f2 * W2, B.z - f1 * W2, t);
  const kk = 1 - Math.exp(-Math.min(dt, .1) * 3.5);
  B.y += (SEA_Y + (hb + hs + hl + hr) / 4 - .35 - B.y) * kk; B.pit += (Math.atan2(hs - hb, 2 * L2) - B.pit) * kk; B.rol += (Math.atan2(hr - hl, 2 * W2) - B.rol) * kk;
  B.m.position.set(B.x, B.y, B.z); B.m.quaternion.setFromEuler(_re.set(B.pit, B.yaw, B.rol, 'YXZ'));
  MAT_RIGSEA.uniforms.uRigT.value.set(B.x, B.z, Math.atan2(f2, f1), 1);   // 著色器的船頭方向：世界 xz 的角度
  // 碰撞：沿船身三個圓（30-vehicles.js 的 dynMore；頂層是 TDZ，第一次更新才放進去）
  if (!B.circ) { B.circ = [-8, 0, 8].map(() => ({ x: 0, z: 0, r: 4.6 })); dynMore.push(...B.circ); }
  [-8, 0, 8].forEach((o, i) => { B.circ[i].x = B.x + f1 * o; B.circ[i].z = B.z + f2 * o; });
  // 探照燈：照著平台西北那隻腳
  B.m.updateMatrixWorld(true);
  _rv.copy(B.light).applyMatrix4(B.m.matrixWorld);
  const [lx, lz] = rigLeg(-1, 1, 5), [tx, tz] = rigW(lx, lz);
  _rd.set(tx, 5 + Math.sin(t * .4) * 1.5, tz).sub(_rv); const len = _rd.length(); _rd.normalize();
  RIG.beam.position.copy(_rv); RIG.beam.quaternion.setFromUnitVectors(V3(0, -1, 0), _rd); RIG.beam.scale.set(len / 70, len, len / 70);
  (RIG.beamDir ||= V3()).copy(_rd); (RIG.beamPos ||= V3()).copy(_rv);
}
// 點光（99-main.js 的 pickLights）：火炬的閃爍光、拖船的探照燈（聚光）；鏡頭離平台 1.6 km 內才放
const RIG_FLC = lin(0xff7a2a), RIG_SPC = lin(0xfff0d8);
function rigLights() {
  const cam = camera.position;
  if (!RIG.near || Math.hypot(cam.x - RIG.cx, cam.z - RIG.cz) > 1600) return [];
  const P = RIG_FXU.uRigP.value, out = [{ x: P.x + RIG_WIND[0] * 6, y: P.y + 9, z: P.z + RIG_WIND[1] * 6, col: RIG_FLC, r: 170, i: 95 * RIG.flare }];
  if (RIG.beamDir) out.push({ x: RIG.beamPos.x, y: RIG.beamPos.y, z: RIG.beamPos.z, col: RIG_SPC, r: 90, i: 14, dir: RIG.beamDir.toArray(), cos: .975 });
  return out;
}
