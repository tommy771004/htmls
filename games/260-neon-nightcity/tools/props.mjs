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
  // ─── World 第二輪（城市擴到 20×15）：以下三組是 Sketchfab Standard 授權（可用在作品裡、不能單獨再散布），來源與授權見 CREDITS.md ───
  // 楓林里的住宅街區：golukumar 的 Neighbourhood City Modular（公尺，42×39 m，剛好一個街區），整塊當一個物件；
  // 只拿掉停在路邊的 BMW E46（真實車款，而且車流會自己開車進來）與路面；冷氣室外機、路燈、盆栽、路障這些面數很高的小零件（約 17 萬面）
  // 單獨減到一成（heavy），整組再減一半。路燈的燈頭位置記在 lights，頁面補點光。窗戶是幾何的窗框加上窗簾貼圖（Wall_3.056_5 上方四分之三）
  { out: 'bld_nbh', file: 'neighbourhood', src: '.cache/world', prefix: 'nbh', win: true, winAuto: /^Wall_3\.056_5$/, winRects: { 'Wall_3.056_5': [[0, 0, 1, .74]] },
    dropPath: /E46/, lightPath: /streetLights/, heavy: [/Window_AC|Split_Ac|streetLights|Pot_9|TrafficDrum|Barricade/, .12], dropGround: .12, cellMargin: 0, simplify: .5, cells: [[-25, 25, -25, 25]] },
  // 灰石國宅：dasy444 的 street city buildings (8)，照片立面的蘇聯式板樓。原檔一層約 0.27 單位，放大 11 倍（一層 3 m）；
  // 疊在下一層上面的算同一棟（Cube.019→018、Plane.011→010、Plane.014→013）；名叫 Plane 的也是板樓（grey_19 起），
  // Plane.015 是後面那棟磚牆大樓（grey_31，56×53×85 m）；只有 Plane.002 是整片地面
  { out: 'bld_grey', file: 'street8', src: '.cache/world', prefix: 'grey', scale: 11, win: true, winAuto: /^Material\.0(0[1-579]|11)$/,
    split: (n, m) => byBuilding(n, m).replace('Cube.019', 'Cube.018').replace('Plane.011', 'Plane.010').replace('Plane.014', 'Plane.013'), drop: /^Plane\.002$/ },
  // 珊瑚灘的街角小店：dasy444 的 street city (7) 右邊那排七間兩層樓店面（照片立面，有塗鴉與舊招牌），放大 3 倍；彎曲的國宅與高塔不要
  // 照片窗是多格窗櫺，自動偵測會拆成一格一格的碎點，所以每張立面都手量窗框（貼圖 UV，v 由上往下）
  // 每間店的立面照片都不一樣（不像板樓把同一塊窗貼在每一層），用 winWhole：整棟一個亂數、靠貼圖的窗編號區分每扇窗。
  // 不然窗戶跨兩個面片時，兩半各抽各的亂數，會一半亮一半暗
  { out: 'bld_shop', file: 'street7', src: '.cache/world', prefix: 'shop', scale: 3, win: true, winAuto: /^Material\.00[1-7]$/, winWhole: true, cellMargin: .02,
    winRects: {
      'Material.001': [[.17, .7, .3, .85], [.37, .7, .59, .85], [.66, .7, .89, .85], [.37, .5, .59, .63], [.66, .5, .89, .63]],
      'Material.002': [[.086, .164], [.227, .305], [.398, .477], [.555, .64], [.777, .86]].flatMap(([u0, u1]) => [[u0, .44, u1, .55], [u0, .66, u1, .77]]),
      'Material.003': [[.13, .13, .36, .42], [.4, .13, .65, .42], [.69, .13, .89, .42], [.27, .6, .39, .78]],
      'Material.004': Array.from({ length: 9 }, (_, k) => (25 + 23.5 * k) / 256).flatMap((u) => [[.254, .39], [.47, .605], [.7, .84]].map(([v0, v1]) => [u, v0, u + .062, v1])),
      'Material.005': [[.09, .17], [.26, .34], [.4, .48], [.56, .64], [.83, .94]].flatMap(([u0, u1]) => [[u0, .37, u1, .55], [u0, .65, u1, .8]]),
      'Material.006': [[.13, .45, .3, .58], [.34, .45, .5, .58], [.67, .45, .83, .58], [.13, .69, .3, .83], [.34, .69, .5, .83], [.55, .69, .61, .83], [.67, .69, .83, .83]],
      'Material.007': [[.01, .14], [.2, .32], [.39, .52], [.55, .68], [.73, .85]].map(([u0, u1]) => [u0, .23, u1, .45])
        .concat([[.07, .19], [.31, .44], [.56, .68], [.8, .93]].map(([u0, u1]) => [u0, .56, u1, .86])),
    },
    cells: [[17.9, 19.6, -1.7, .2], [19.9, 21.7, -1.8, .7], [21.9, 24.6, -2.6, .5], [24.7, 28.1, -3.2, .2], [28.5, 31, -2.5, .3], [31.7, 34.5, -2.7, .2], [35.4, 38.4, -2.9, .2]] },
  // 安全屋室內（69-safehouse.js）：dasy444 的兩個 Sketchfab 室內（CC BY 4.0），保留原檔座標（地板 y＝0）。
  // loft17 是兩層樓的頂樓公寓，玻璃牆外那圈發光的摩天樓卡片就是窗景；interior15 是崖邊別墅，拿掉白天的天空半球
  { out: 'apt_loft', src: '.cache/world', items: [{ id: 'loft', file: 'loft17', origin: [0, 0, 0] }] },
  // 客廳地板（Material.001）原檔是金屬度 1、粗糙度 0 的鏡面，夜裡整片映出城市環境圖：改成拋光石材；落地窗（material_5）的反射也壓淡
  { out: 'apt_villa', src: '.cache/world', items: [{ id: 'villa', file: 'interior15', origin: [0, 0, 0], drop: /^Sphere/ }], tint: { 'Material.001': [1, .42, 0], material_5: [1, .7, 0] } },
  // ─── World 第三輪：剩下的檔案全部用上（授權見 CREDITS.md）───
  // 光環廣場：golukumar 的 Cyberpunk City（CC BY 4.0，時代廣場式街廓）。原檔物件依材質合併、跨整個模型，只能依原檔座標的矩形拆：
  // 主街（東西向，z −0.7…0.4）兩側、五條南北向小街之間，北排 6 群（正面朝 +z）、南排 8 群（正面朝 −z，轉 180°）；街上的車、人、樹、路面不要。
  // 原檔一層約 0.35 單位，放大 9 倍（最高的塔約 180 m）。四張廣告圖集全是真實品牌，每塊版面換成原創的霓虹廣告（虛構店名）；
  // 立面照片圖集（Material.004／.009 同一張）拍到的真實招牌（餐廳、速食、飯店、劇院）模糊成色塊
  { out: 'bld_cyber', file: 'cyberpunk', src: '.cache/world', prefix: 'cyber', scale: 9, cellMargin: .05, dropGround: .12, simplify: .5, simplifyError: .004, tex: 2048,
    texEdit: (() => {
      const blur = [[.132, .068, .334, .13], [.48, .054, .759, .123], [.768, .071, .814, .145], [.877, .3, .993, .354], [.502, .368, .7, .409], [.875, .427, .921, .48],
        [.384, .454, .464, .486], [.62, .499, .689, .53], [.3, .607, .48, .68], [.873, .607, .987, .699]];
      return { 'Material.001': { ads: 1 }, 'Material.002': { ads: 2 }, 'Material.007': { ads: 3 }, 'Material.008': { ads: 4 }, 'Material.004': { blur }, 'Material.009': { blur },
        'Material.005': { blur: [[.886, .888, .984, .989]] } };   // 玻璃帷幕圖集角落的募兵中心招牌
    })(),
    dropBox: [[-7.2, -3, 12.4, 14.05, 2.6, 7.8, /^(metal_gray|Material\.007|white_neon)$/]],   // 最高那棟塔頂的服飾品牌立體字招牌
    cells: [[-12.9, -8, -8.5, -.6, 0], [-7.6, -2.7, -8.5, -.6, 0], [-2.7, 2, -8.5, -.6, 0], [2, 6.8, -8.5, -.6, 0], [6.8, 11.6, -8.5, -.6, 0], [11.6, 16.5, -8.5, -.6, 0],
      [-12.9, -8, .3, 4.1, 2], [-12.9, -8, 4.1, 8, 2], [-7.6, -2.7, .3, 2.6, 2], [-7.6, -2.7, 2.6, 8, 2], [-2.7, 2, .3, 8, 2], [2, 6.8, .3, 8, 2], [6.8, 11.6, .3, 8, 2], [11.6, 16.5, .3, 8, 2]] },
  // 東灣對岸的舊港城：golukumar 的 City（Standard，遊戲關卡：沿街的立面殼、背面是空的），整片當遠景，從碼頭、跨海橋與東區看過去。
  // 原檔一層約 0.17 單位，放大 17 倍（約 250×405 m）；邊緣的天際線紙板、路面箭頭、可破壞的小道具不要
  { out: 'far_golu', src: '.cache/world', far: 1, tex: 512, winRes: 256, win: true, winAuto: /^material_104_93/, simplify: .5, simplifyError: .004, dropPath: /backdrop_grp|chevron_grp|prop_\d+_mdl/, items: [{ id: 'golu', file: 'city_golu', scale: 17 }] },
  // 東灣對岸舊港城的後排：dasy444 的 street city (7) 除了已經用在珊瑚灘的七間店面（x > 17）以外的部分——彎成弧形的一圈店屋、
  // 九棟照片立面的板樓（Cube.012…019）與四棟只有兩面牆的高塔紙板（Plane.027…030，背面朝東、從城裡看不到）。
  // 原檔一層約 0.56 單位，放大 5 倍（最高約 62 m）；整片地面（Plane、Plane.003／005／006／007）不要
  { out: 'far_s7', src: '.cache/world', far: 1, tex: 512, winRes: 256, win: true, winAuto: /^Material\.0(09|10|11)$/,
    items: [{ id: 's7', file: 'street7', scale: 5, clip: [-20, 17.4, -5, 20, -30, 30], drop: /^Plane(\.00[3567])?_Material\.009/ }] },
  // 遠景兩組都沒有窗戶遮罩：照片立面的暗色區塊自動當成窗（winAuto），夜裡遠看是一片零星的窗燈
  // 灰鷺河對岸：golukumar 的 London City（CC BY 4.0，遊戲關卡，公尺）。光照貼圖那一份重複的網格、碰撞牆、隱形牆、停車格、水面不要；
  // 只留城區本體（散在幾百公尺外的碎片用 clip 切掉）。原檔地面高低不平（−17…−4），最低處當地面
  { out: 'far_london', src: '.cache/world', far: 1, win: true, winAuto: /^WorldCityBuildings\dMat$/, items: [{ id: 'london', file: 'london_city', clip: [-300, 410, -40, 400, -1180, 120], groundY: -17.5,
    drop: /Lightmap|Collision|InvisibleWall|Parking|CitySea/ }] },
  // 灰鷗島：dasy444 的 abandoned city street（廢墟街區，放大 2.3 倍）與 Loft 18 environment（辦公室與一圈板樓，公尺）
  { out: 'isle_ruin', src: '.cache/world', items: [{ id: 'ruin', file: 'abandoned', scale: 2.3, groundY: -.1 }] },
  { out: 'isle_office', src: '.cache/world', win: true, winAuto: /^Material\.0(18|20)$/, items: [{ id: 'office', file: 'loft18env', groundY: 0 }] },
  // 第三輪的安全屋室內（dasy444，Standard）：島上辦公室（Loft 18 本體）、迷你閣樓（拿掉天空球）、Loft 16、Interior 14（拿掉兩個天空球）
  { out: 'apt_office', src: '.cache/world', items: [{ id: 'office', file: 'loft18', origin: [0, 0, 0] }] },
  { out: 'apt_mini', src: '.cache/world', items: [{ id: 'mini', file: 'miniloft', origin: [0, 0, 0], drop: /^Sphere/ }] },
  { out: 'apt_l16', src: '.cache/world', items: [{ id: 'l16', file: 'loft16', origin: [0, 0, 0] }] },
  // 地板（Material.001）是金屬度 .8 的鏡面、牆與櫃子（.002／.006）也帶金屬度，夜裡映出整片城市環境圖：同 villa 改成不反光的石材與漆面
  { out: 'apt_i14', src: '.cache/world', items: [{ id: 'i14', file: 'interior14', origin: [0, 0, 0], drop: /^Sphere/ }], tint: { 'Material.001': [1, .42, 0], 'Material.002': [1, .5, 0], 'Material.006': [1, .82, 0] } },
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
      let path = [], par = node; while (par) { path.unshift(par.getName()); par = par.getParentNode(); }
      prims.push({ node: node.getName(), path: path.join('/'), mat, pos, nor, uv, idx, cnt });
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
  return { node: p.node, path: p.path, mat: p.mat, pos: pick(p.pos, 3), nor: pick(p.nor, 3), uv: pick(p.uv, 2), idx, cnt: keep.length };
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
  // groundY：原檔有東西沉到地面以下（地基、斜坡）時，指定哪個高度是地面
  const [cx, cy, cz] = cfg.origin || [(mn[0] + mx[0]) / 2, cfg.center ? (mn[1] + mx[1]) / 2 : cfg.groundY ?? mn[1], (mn[2] + mx[2]) / 2];
  for (const p of prims) for (let i = 0; i < p.cnt; i++) { p.pos[i * 3] = (p.pos[i * 3] - cx) * s; p.pos[i * 3 + 1] = (p.pos[i * 3 + 1] - cy) * s; p.pos[i * 3 + 2] = (p.pos[i * 3 + 2] - cz) * s; }
  ({ mn, mx } = bbox(prims));
  return { w: +(mx[0] - mn[0]).toFixed(2), d: +(mx[2] - mn[2]).toFixed(2), h: +(mx[1] - mn[1]).toFixed(2) };
}

// ─── 換掉真實商標（texEdit）───
// ads：整張都是真實廣告的圖集（cyberpunk 的四張），找出每塊非黑的版面，各自畫一張原創的霓虹廣告（虛構店名）蓋上去；
// blur：照片立面上拍到的真實招牌，把那幾個矩形（UV，v 由上往下）重度模糊成看不出字的色塊
const AD_PAL = [['#0b0f1a', '#ff3b8d', '#29e0ff'], ['#ffd400', '#141414', '#e4002b'], ['#101820', '#00ffa3', '#f5f5f5'], ['#e4002b', '#ffffff', '#ffd400'],
  ['#1b0033', '#cc99ff', '#ff6a00'], ['#f2f2f2', '#0a2fff', '#ff2d55'], ['#002b36', '#2aa198', '#fdf6e3'], ['#ff6a00', '#1a1a1a', '#ffffff'], ['#06121f', '#ffb000', '#ff3b8d']];
const AD_LAT = ['KAGEMORI', 'NOVA DRIFT', 'PULSE/9', 'ORBITAL COLA', 'LUMEN AIR', 'HEXA', 'KITE MOBILE', 'ZEPHYR', 'MIRAGE TV', 'AKIRO', 'VOLTA', 'NEONIX', 'SORA BANK', 'QUILL', 'TANUKI', 'HALO 24', 'RIKKA', 'OMNI-7', 'FERRO', 'CIRRUS'];
const AD_CJK = ['霓虹拉麵', '夜鷹電機', '雲端酒造', '赤羽鐘錶', '狐火電影', '鐵馬機車', '月光銀行', '電腦書店', '星屑咖啡', '光環劇院', '龍門飯店', '極光通訊', '白鷺藥局', '黑潮唱片', '燈籠茶屋', '電光彈珠'];
const AD_TAG = ['24H', 'NEW', 'OPEN', '¥980', '-50%', 'SALE', 'LIVE', '2077', 'VR', '4K'];
const FONT_CJK = 'PingFang TC, Heiti TC, sans-serif', FONT_LAT = 'Avenir Next Condensed, Helvetica Neue, sans-serif';
function adSvg(x, y, w, h, r) {
  const [bg, fg, ac] = AD_PAL[Math.floor(r() * AD_PAL.length)], pick = (a) => a[Math.floor(r() * a.length)];
  let o = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bg}"/>`;
  const t = (tx, ty, sz, fill, str, font, anchor = 'middle') => `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" font-family="${font}" font-weight="800" font-size="${sz.toFixed(1)}" fill="${fill}" text-anchor="${anchor}">${str}</text>`;
  if (h > w * 2.2) {   // 直立招牌：中文直排
    const name = pick(AD_CJK), n = Math.min(name.length, Math.max(1, Math.floor(h / (w * .95)))), sz = Math.min(w * .78, h / (n + .4));
    o += `<rect x="${x + w * .06}" y="${y + w * .06}" width="${w * .88}" height="${h - w * .12}" fill="none" stroke="${ac}" stroke-width="${Math.max(1, w * .05)}"/>`;
    for (let i = 0; i < n; i++) o += t(x + w / 2, y + (h - n * sz) / 2 + (i + .86) * sz, sz, fg, name[i], FONT_CJK);
  } else if (w > h * 2.6) {   // 橫幅：店名＋右邊的標籤
    const cjk = r() < .45, name = cjk ? pick(AD_CJK) : pick(AD_LAT), tag = pick(AD_TAG);
    const sz = Math.min(h * .58, (w * .7) / (name.length * (cjk ? 1.02 : .62)));
    o += `<rect x="${x}" y="${y + h * .86}" width="${w}" height="${h * .14}" fill="${ac}"/>`;
    o += t(x + w * .05, y + h * .5 + sz * .36, sz, fg, name, cjk ? FONT_CJK : FONT_LAT, 'start');
    o += t(x + w * .93, y + h * .5 + h * .14, h * .36, ac, tag, FONT_LAT, 'end');
  } else {   // 海報：大色塊圖形＋店名＋角落標籤
    const cjk = r() < .5, name = cjk ? pick(AD_CJK) : pick(AD_LAT), tag = pick(AD_TAG), k = r();
    if (k < .33) o += `<circle cx="${x + w * .5}" cy="${y + h * .4}" r="${Math.min(w, h) * .3}" fill="${ac}"/>`;
    else if (k < .66) for (let i = 0; i < 5; i++) o += `<rect x="${x}" y="${y + h * (.1 + i * .12)}" width="${w}" height="${h * .05}" fill="${ac}" opacity="${1 - i * .16}"/>`;
    else o += `<polygon points="${x + w * .15},${y + h * .7} ${x + w * .5},${y + h * .1} ${x + w * .85},${y + h * .7}" fill="${ac}"/>`;
    const sz = Math.min(h * .2, (w * .86) / (name.length * (cjk ? 1.02 : .62)));
    o += t(x + w / 2, y + h * .86, sz, fg, name, cjk ? FONT_CJK : FONT_LAT);
    o += t(x + w * .06, y + h * .12 + Math.min(w, h) * .05, Math.min(w, h) * .14, fg, tag, FONT_LAT, 'start');
  }
  return o;
}
async function adAtlas(img, seed) {
  const S = 1024, O = 2048, k = O / S;
  const { data } = await sharp(Buffer.from(img), { limitInputPixels: false }).resize(S, S, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const on = new Uint8Array(S * S), lab = new Int32Array(S * S).fill(-1), boxes = [];
  for (let i = 0; i < S * S; i++) on[i] = data[i * 3] * .3 + data[i * 3 + 1] * .59 + data[i * 3 + 2] * .11 > 18 ? 1 : 0;
  for (let i = 0; i < S * S; i++) {
    if (!on[i] || lab[i] >= 0) continue;
    const st = [i]; lab[i] = boxes.length; let x0 = S, x1 = 0, y0 = S, y1 = 0;
    while (st.length) {
      const j = st.pop(), x = j % S, y = (j / S) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const q of [x > 0 ? j - 1 : -1, x < S - 1 ? j + 1 : -1, y > 0 ? j - S : -1, y < S - 1 ? j + S : -1]) if (q >= 0 && on[q] && lab[q] < 0) { lab[q] = boxes.length; st.push(q); }
    }
    boxes.push([x0, y0, x1 + 1, y1 + 1]);
  }
  let r0 = seed * 9301 + 49297; const r = () => (r0 = (r0 * 16807) % 2147483647) / 2147483647;
  const body = boxes.filter(([x0, y0, x1, y1]) => x1 - x0 >= 3 && y1 - y0 >= 3).map(([x0, y0, x1, y1]) => adSvg(x0 * k, y0 * k, (x1 - x0) * k, (y1 - y0) * k, r)).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${O}" height="${O}"><rect width="${O}" height="${O}" fill="#000"/>${body}</svg>`;
  return { png: await sharp(Buffer.from(svg), { limitInputPixels: false }).png().toBuffer(), n: boxes.length };
}
async function blurAtlas(img, rects) {
  const O = 2048, base = await sharp(Buffer.from(img), { limitInputPixels: false }).resize(O, O, { fit: 'fill' }).removeAlpha().png().toBuffer();
  const comp = [];
  for (const [u0, v0, u1, v1] of rects) {
    const left = Math.round(u0 * O), top = Math.round(v0 * O), width = Math.round((u1 - u0) * O), height = Math.round((v1 - v0) * O);
    comp.push({ input: await sharp(base).extract({ left, top, width, height }).blur(Math.max(6, Math.min(width, height) / 5)).toBuffer(), left, top });
  }
  return sharp(base).composite(comp).png().toBuffer();
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
    const edit = set.texEdit && m && set.texEdit[m.getName()];
    if (edit && m.getBaseColorTexture()) {
      // 換掉真實商標：廣告圖集同時當底色與自發光（版面形狀照原檔，內容是原創的）；照片立面只模糊招牌
      const src = m.getBaseColorTexture(), png = edit.ads != null ? (await adAtlas(src.getImage(), edit.ads)).png : await blurAtlas(src.getImage(), edit.blur);
      const nt = out.createTexture(m.getName() + (edit.ads != null ? '_ads' : '_clean')).setImage(new Uint8Array(png)).setMimeType('image/png');
      n.setBaseColorTexture(nt);
      if (edit.ads != null) n.setEmissiveTexture(nt).setEmissiveFactor([1, 1, 1]);
      else if (m.getEmissiveTexture()) n.setEmissiveTexture(copyTex(m.getEmissiveTexture())).setEmissiveFactor([1, 1, 1]);
    } else {
      if (m && m.getBaseColorTexture()) n.setBaseColorTexture(copyTex(m.getBaseColorTexture()));
      if (m && m.getEmissiveTexture()) n.setEmissiveTexture(copyTex(m.getEmissiveTexture())).setEmissiveFactor([1, 1, 1]);
    }
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
    const S = auto ? set.winRes ?? 1024 : 256, { data } = await sharp(Buffer.from(t.getImage())).resize(S, S, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
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
    // 編號再往外長 2 px（只填還沒有編號的像素，不會把兩扇窗併起來）：玻璃邊緣雙線性取樣時 G 不會混到牆的 0，
    // 不然沒亮的窗四周會多一圈亂數不同、自己亮起來的細線
    for (let pass = 0; pass < 2; pass++) {
      const grow = [];
      for (let i = 0; i < S * S; i++) {
        if (lab[i] >= 0) continue;
        const x = i % S, y = (i / S) | 0;
        for (const k of [x > 0 ? i - 1 : -1, x < S - 1 ? i + 1 : -1, y > 0 ? i - S : -1, y < S - 1 ? i + S : -1]) if (k >= 0 && lab[k] >= 0) { grow.push(i, lab[k]); break; }
      }
      for (let g = 0; g < grow.length; g += 2) lab[grow[g]] = grow[g + 1];
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
        if (set.winAuto && !set.winWhole && !curtain && m && set.winAuto.test(m.getName())) {
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
    if (set.dropPath) prims = prims.filter((p) => !set.dropPath.test(p.path));   // 依祖先節點名（整條路徑）拿掉車、路燈、路面
    if (set.heavy) prims = prims.map((p) => {   // [路徑, 比例]：面數特別高的小零件（冷氣室外機、路燈）單獨大幅減面，其他照整組的 simplify
      if (!set.heavy[0].test(p.path) || p.idx.length < 90) return p;
      const [ix] = MeshoptSimplifier.simplify(Uint32Array.from(p.idx), Float32Array.from(p.pos), 3, Math.max(36, Math.floor(p.idx.length * set.heavy[1] / 3) * 3), .08);
      return ix.length ? subPrim(p, ix) : null;
    }).filter(Boolean);
    if (set.keep) prims = prims.filter((p) => set.keep(p.node));
    if (set.dropBox) prims = prims.map((p) => {   // 原檔座標的盒子 [x0, x1, y0, y1, z0, z1, 材質]：做成立體字的真實商標整塊拿掉
      const boxes = set.dropBox.filter((b) => !b[6] || (p.mat && b[6].test(p.mat.getName())));
      if (!boxes.length) return p;
      const ix = [];
      for (let t = 0; t < p.idx.length; t += 3) {
        let x = 0, y = 0, z = 0; for (let k = 0; k < 3; k++) { x += p.pos[p.idx[t + k] * 3] / 3; y += p.pos[p.idx[t + k] * 3 + 1] / 3; z += p.pos[p.idx[t + k] * 3 + 2] / 3; }
        if (!boxes.some((b) => x > b[0] && x < b[1] && y > b[2] && y < b[3] && z > b[4] && z < b[5])) ix.push(p.idx[t], p.idx[t + 1], p.idx[t + 2]);
      }
      return ix.length === p.idx.length ? p : ix.length ? subPrim(p, ix) : null;
    }).filter(Boolean);
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
        const dims = place(ps, set.cells[c][4] != null ? { ...set, rot: set.cells[c][4] } : set, set.scale ?? 1);   // 第五個數：這一群轉幾個 90°（正面朝 +z）
        if (set.curtain) curtainUV(ps, set.curtain);
        if (set.lightPath) {   // 原檔的路燈：每支燈（同一條節點路徑）取包圍盒頂端中心，頁面在那裡補一盞點光（座標是擺正、縮放後的）
          const at = new Map();
          for (const p of ps) if (set.lightPath.test(p.path)) { if (!at.has(p.path)) at.set(p.path, []); at.get(p.path).push(p); }
          dims.lights = [...at.values()].map((g) => { const { mn, mx } = bbox(g); return [(mn[0] + mx[0]) / 2, mx[1] - .2, (mn[2] + mx[2]) / 2].map((v) => +v.toFixed(2)); });
        }
        await emit(`${set.prefix}_${String(c + 1).padStart(2, '0')}`, ps, { ...dims, src: set.cells[c].join(',') });
      }
      continue;
    }
    if (src.clip) {   // 只留重心在這個盒子裡的三角形（原檔座標 [x0, x1, y0, y1, z0, z1]）：遊戲關卡模型散在遠處的碎片
      const [x0, x1, y0, y1, z0, z1] = src.clip;
      prims = prims.map((p) => {
        const ix = [];
        for (let t = 0; t < p.idx.length; t += 3) {
          let x = 0, y = 0, z = 0; for (let k = 0; k < 3; k++) { x += p.pos[p.idx[t + k] * 3] / 3; y += p.pos[p.idx[t + k] * 3 + 1] / 3; z += p.pos[p.idx[t + k] * 3 + 2] / 3; }
          if (x > x0 && x < x1 && y > y0 && y < y1 && z > z0 && z < z1) ix.push(p.idx[t], p.idx[t + 1], p.idx[t + 2]);
        }
        return ix.length === p.idx.length ? p : ix.length ? subPrim(p, ix) : null;
      }).filter(Boolean);
    }
    if (set.split && set.dropGround != null) prims = prims.map((p) => {   // 拆棟的組：整片地面（三角形最高點低於 dropGround）不要
      const ix = [];
      for (let t = 0; t < p.idx.length; t += 3) if (Math.max(p.pos[p.idx[t] * 3 + 1], p.pos[p.idx[t + 1] * 3 + 1], p.pos[p.idx[t + 2] * 3 + 1]) >= set.dropGround) ix.push(p.idx[t], p.idx[t + 1], p.idx[t + 2]);
      return ix.length === p.idx.length ? p : ix.length ? subPrim(p, ix) : null;
    }).filter(Boolean);
    if (src.pick) prims = prims.filter((p) => { const { mn, mx } = bbox([p]); return src.pick((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2); });
    if (!set.split) { await emit(src.id, prims, place(prims, src)); continue; }
    // 拆成多棟：依建築名分組，各自置中接地（原檔已是公尺、正面朝 +z）
    const groups = new Map();
    for (const p of prims) { const k = set.split(p.node, p.mat ? p.mat.getName() : ''); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
    let n = 0;
    for (const [k, ps] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
      const dims = place(ps, set.rotOf ? { ...set, rot: set.rotOf(k, ps) } : set, set.scale ?? 1);
      if (dims.h < (set.minH ?? 2.5) || Math.max(dims.w, dims.d) < 3) continue;   // 零件（路燈、管線）不當成建築
      await emit(`${set.prefix}_${String(++n).padStart(2, '0')}`, ps, { ...dims, src: k });
    }
  }
  await out.transform(
    dedup(), weld(), prune(),
    ...(set.simplify ? [simplify({ simplifier: MeshoptSimplifier, ratio: set.simplify, error: set.simplifyError ?? .002 })] : []),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^baseColor|^emissive/, resize: [set.tex ?? 1024, set.tex ?? 1024], quality: 80 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^metallicRoughness/, lossless: true }),   // 窗戶編號不能有失真
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  mkdirSync(OUT, { recursive: true });
  const file = resolve(OUT, set.out + '.glb');
  await io.write(file, out);
  const kb = Math.round(statSync(file).size / 1024);
  console.log(`${set.out}: ${Object.keys(items).length} 個物件、${kb} KB；` + Object.entries(items).map(([k, v]) => `${k} ${v.w}×${v.d}×${v.h} ${v.tris}面`).join('；'));
  return { kb, items, credits, ...(set.far ? { far: 1 } : {}) };
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
