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
import { tronData } from './walkgrid.mjs';

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
  // 第五部曲的商店街（69-v5-shops.js，原檔在 .cache/v5/）：縫線服飾的店面是 jungle_jim 三間店面的右邊兩間（原檔單位約半公尺，縮成 0.6；
  // 原點在玻璃面、店內往 −z；原店名的立體字、人行道與第三間不要），店裡的掛衣架是 ngdkh 的 Wardrobe Rack 兩座；
  // 射擊場的吊靶（夾板＋人形靶紙）與射擊位（兩片夾板隔間＋檯面）是 FrodoUndead 的 Gun Targets
  // 原檔的玻璃是很藍、粗糙度 0.8 的半透明（BLEND），反射環境變成一片霧白、看不到店裡：換成淡灰、透明度一成、光滑；店裡的白牆換成暖米色
  { out: 'v5shop', src: '.cache/v5', tex: 2048, recolor: { ...Object.fromEntries(['Glass', 'Glass.001', 'Glass.002'].map((k) => [k, [.5, .56, .6, .1, .06]])), 'Inside.002__0': [.74, .66, .56, 1] }, items: [
    { id: 'front', file: 'storefronts_with_opening_doors_empty_stores', scale: .6, origin: [-16.64, .66, -9.9], only: /^(Storefront2 by Jungle Jim|Storefront3|Cube|Cube\.001)$/, drop: /^Text/ },
    { id: 'rackA', file: 'wardrobe_rack', h: 1.75, only: /^rack 1$/ },
    { id: 'rackB', file: 'wardrobe_rack', h: 1.75, only: /^rack 2$/ },
    { id: 'target', file: 'gun_targets', h: 1, only: /^Moving Target_6$/ },
    { id: 'booth', file: 'gun_targets', h: 1.9, only: /^(BoothTable_8|BoothWall_9)$/ },
  ] },
  // 第五部曲之四的街道小設施（69-v5-street.js，原檔在 .cache/v5/）：Ottto3d 的 Modern Bus Stop Shelter（放大 1.1 倍，開口朝 +z；
  // 背牆三片玻璃在這條管線畫成不透明的黑板，拿掉（dropBox），頁面換成打得碎的透明玻璃）；BeaBea 的 Hot Dog Stand（縮成 0.5）拆成
  // 攤車、遮陽傘（連傘柄）與兩罐醬料，三件用同一個原點（攤車底面中心），頁面擺在同一個位置就對得上；撞飛的時候各自翻滾
  { out: 'v5street', src: '.cache/v5', tex: 1024, items: [
    { id: 'shelter', file: 'modern_bus_stop_shelter', scale: 1.1, dropBox: [[-1.19, -.53, .25, 1.75, -.445, -.425], [-.32, .35, .25, 1.75, -.445, -.425], [.55, 1.22, .25, 1.75, -.445, -.425]] },
    { id: 'hd_cart', file: 'hot_dog_stand', scale: .5, origin: [.1855, -1.003, .317], dropBox: [[-2, 2, 1.5, 4, -3, 5], [1.05, 1.32, 1.15, 1.75, 1.85, 2.33]] },
    { id: 'hd_umb', file: 'hot_dog_stand', scale: .5, origin: [.1855, -1.003, .317], clip: [-2, 2, 1.5, 4, -3, 5] },
    { id: 'hd_sauce', file: 'hot_dog_stand', scale: .5, origin: [.1855, -1.003, .317], clip: [1.05, 1.32, 1.15, 1.75, 1.85, 2.33] },
  ] },
  // 第五部曲之五的施工大樓與塔吊（69-v5-crane.js，原檔在 .cache/v5/）：Stas Gunko 的 Construction（CC BY 4.0，公尺，23×13 m、八層、層高 4 m）
  // 照高度切成三段：底層（兩層店面＋第三層，到 13.0 m 的樓板底）、標準層（13.0–25.0 m 三層，頁面疊十幾次）、頂層（25.0 m 以上，沒封頂的框架與牆）；
  // 三段用同一個原點（原檔外框的水平中心、各段的切面高度），疊起來切口剛好接上
  { out: 'v5tower', src: '.cache/v5', tex: 1024, items: [
    { id: 'base', file: 'construction', band: [-5, 13], origin: [-12.145, 0, 6.825] },
    { id: 'mid', file: 'construction', band: [13, 25], origin: [-12.145, 13, 6.825] },
    { id: 'top', file: 'construction', band: [25, 99], origin: [-12.145, 25, 6.825] },
  ] },
  // Cem Alagozlu 的 Liebherr Tower Crane（CC BY 4.0）：原檔比實物小（桅桿 1.2 m 寬、一節 1.66 m），放大 1.8 倍。拆成底座、一節桅桿（頁面疊幾十節到 230 m 上下）
  // 與頂部（回轉台、駕駛室、吊臂、平衡臂、塔帽，原點是回轉台底 y 31.3）；三件的原點都在桅桿中心線上。吊臂朝 +z、平衡臂朝 −z
  { out: 'v5crane', src: '.cache/v5', tex: 1024, items: [
    { id: 'cr_mast', file: 'liebherr_tower_crane', scale: 1.8, origin: [0, 8.3, 0], only: /^Object012$/, simp: [.35, .01] },
    { id: 'cr_top', file: 'liebherr_tower_crane', scale: 1.8, origin: [0, 31.3, 0], only: /^(Box021|Object052|Object053|Plane002|Box069)$/, simp: [.45, .004] },
  ] },
  // Şafak Binen 的 Construction Pack (Low Poly)（CC BY 4.0）：五棟施工中的框架，挑兩棟矮的擺在施工大樓旁邊當工寮與材料棚
  { out: 'v5site', src: '.cache/v5', tex: 1024, items: [
    { id: 'site1', file: 'construction_pack_low_poly', only: /^Construction1$/ },
    { id: 'site2', file: 'construction_pack_low_poly', only: /^Construction2$/ },
    { id: 'site3', file: 'construction_pack_low_poly', only: /^Construction3$/ },
    { id: 'site4', file: 'construction_pack_low_poly', only: /^Construction4$/ },
    { id: 'site5', file: 'construction_pack_low_poly', only: /^Construction5$/ },
  ] },
  // 第九分局（69-v5-civic.js；10-city.js 的 FAC.pd 前半塊地當實體建築 bldPlace 擺）：katiewolfe 的 Southern District Police Station（CC BY 4.0，照片掃描，公尺，
  // 正面朝 +z、右側有原本的逃生梯）。21 塊切塊先縫合再減到 6%，8K 貼圖縮成 4K
  { out: 'v5pd', src: '.cache/v5', tex: 4096, items: [{ id: 'pd', file: 'southern_district_police_station', sloppy: .06, seam: .06, renorm: 1 }] },
  // 聖瑪格麗特醫院的舊院區正面（10-city.js 的 FAC.hosp 急診那塊地）：artfletch 的 Samaritan Hospital Frontage（CC BY 4.0，照片掃描，公尺，
  // 只掃了正面與右側轉角，背後是空的，頁面在後面補一個量體）。正面朝 +z、牆面在 z≈10，原檔 y 3.5 是人行道（下面的地下室採光井埋進人行道板）
  { out: 'v5hosp', src: '.cache/v5', tex: 4096, items: [{ id: 'front', file: 'samaritan_hospital_frontage', groundY: 3.5, sloppy: .12, seam: .06, renorm: 1 }] },
  // 武器（69-combat.js）：orient 是「哪個原檔軸變成槍口方向 +z、哪個變成上方 +y」，center 是包圍盒中心放原點（握把位置由頁面的 ARMS 表另外給）
  // heavy：瓦斯罐原檔兩萬多面（拉環、保險桿都很細），單獨減到兩成
  { out: 'arms', tex: 512, src: '.cache/arms', heavy: [/Smoke Grenade/, .2], items: [
    { id: 'pistol', file: 'heckler__koch_usp_pistol', len: .194, orient: ['z', 'y'], center: 1 },
    // 原檔並排擺了兩把：只取右邊那把（摺疊槍托），再用主軸轉正
    { id: 'smg', file: 'mac-11', len: .3, pick: (x, y) => x > -.2 && y > .2, pca: 1, orient: ['-z', 'y'], center: 1 },
    { id: 'rifle', file: 'm4a1_sopmod_remaster', len: .84, orient: ['x', 'y'], center: 1 },
    { id: 'shotgun', file: 'remington_870_shotgun', len: 1.0, yaw: -14, orient: ['z', 'y'], center: 1 },
    { id: 'sniper', file: 'usmc_m40a5_sniper', len: 1.12, yaw: -35, pitch: 12, orient: ['z', 'y'], center: 1 },
    { id: 'rpg', file: 'rpg-7', len: 1.2, orient: ['z', 'y'], center: 1 },
    { id: 'minigun', file: 'minigun_improved', len: .95, orient: ['-z', 'y'], center: 1 },
    { id: 'grenade', file: 'm67_fragmentation_grenade', len: .075, orient: ['z', 'y'], center: 1 },
    // 69-tactics.js 的榴彈發射器（M32，原檔槍口朝 +x）與催淚瓦斯罐（直立，保留原檔的 SMOKE 字樣）
    { id: 'launcher', file: 'm32_greande_launcher_low_poly', len: .78, orient: ['x', 'y'], center: 1 },
    { id: 'gas', file: 'smoke_grenade', h: .14, orient: ['z', 'y'], center: 1 },
    { id: 'c4', file: 'c4_explosive', len: .22, orient: ['z', 'y'], center: 1 },
    { id: 'bat', file: 'baseball_bat', len: .84, orient: ['-x', 'y'], center: 1 },
    { id: 'katana', file: 'cyberpunk_katana', len: 1.0, orient: ['-x', 'y'], center: 1 },
    { id: 'baton', file: 'police_baton_game_ready_-_pbr', len: .5, orient: ['-z', 'y'], center: 1 },
  ] },
  // 快速道路的橋墩柱身（21-coast.js 的 FWY_PIERS，27-props.js 依橋面高度拉長）：PolyDavid 的 Cyberpunk Highway（CC BY 4.0）裡的混凝土柱（Object_63）與側面的黃色飾條（Object_65），
  // 原檔單位公尺、柱高 8.1 m，長邊（2.9 m）轉成橫跨橋面。其他部件（橋面、路燈、指示牌）不用；原檔放在 .cache/hwy/
  { out: 'hwy', tex: 512, src: '.cache/hwy', items: [{ id: 'pier', file: 'cyberhwy', only: /^Object_(63|65)$/, scale: 1, rot: 1 }] },
  // 街道物件：消防栓、配電箱、加油機（加油機側板的店名、頂蓋的油品標語與一堆貼紙看不出是不是真實品牌，模糊掉）
  { out: 'street', tex: 512, src: '.cache/raw', texEdit: { 'Material.001': { blur: [[0, .1, .11, .33], [.79, .46, .83, .74], [.12, 0, .19, .08], [.41, 0, .5, .12], [.41, .14, .46, .24],
    [.82, 0, .86, .1], [.82, .15, .86, .25], [.1, .33, .18, .42], [.79, .72, .87, .95], [.15, .9, .22, 1], [.52, .88, .63, 1], [.17, .9, .25, .96], [.8, .88, .86, 1], [.92, .88, .96, 1]] } }, items: [
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
  { out: 'bld_nbh', file: 'neighbourhood', src: '.cache/world', prefix: 'nbh', meshopt: 'high', win: true, winAuto: /^Wall_3\.056_5$/, winRects: { 'Wall_3.056_5': [[0, 0, 1, .74]] },
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
  { out: 'bld_cyber', file: 'cyberpunk', src: '.cache/world', prefix: 'cyber', meshopt: 'high', scale: 9, cellMargin: .05, dropGround: .12, simplify: .5, simplifyError: .004, tex: 2048,
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
  // 原檔是一圈樓圍著的遊戲關卡，外面進不去：拿掉東面中段那棟樓的南半（上下兩層），留一個朝跨海橋那條路的 7 m 缺口當入口
  { out: 'isle_ruin', src: '.cache/world', items: [{ id: 'ruin', file: 'abandoned', scale: 2.3, groundY: -.1, drop: /^Cube\.02[02]_/ }] },
  { out: 'isle_office', src: '.cache/world', win: true, winAuto: /^Material\.0(18|20)$/, items: [{ id: 'office', file: 'loft18env', groundY: 0 }] },
  // 第三輪的安全屋室內（dasy444，Standard）：島上辦公室（Loft 18 本體）、迷你閣樓（拿掉天空球）、Loft 16、Interior 14（拿掉兩個天空球）
  { out: 'apt_office', src: '.cache/world', items: [{ id: 'office', file: 'loft18', origin: [0, 0, 0] }] },
  { out: 'apt_mini', src: '.cache/world', items: [{ id: 'mini', file: 'miniloft', origin: [0, 0, 0], drop: /^Sphere/ }] },
  { out: 'apt_l16', src: '.cache/world', items: [{ id: 'l16', file: 'loft16', origin: [0, 0, 0] }] },
  // 地板（Material.001）是金屬度 .8 的鏡面、牆與櫃子（.002／.006）也帶金屬度，夜裡映出整片城市環境圖：同 villa 改成不反光的石材與漆面
  { out: 'apt_i14', src: '.cache/world', items: [{ id: 'i14', file: 'interior14', origin: [0, 0, 0], drop: /^Sphere/ }], tint: { 'Material.001': [1, .42, 0], 'Material.002': [1, .5, 0], 'Material.006': [1, .82, 0] } },
  // ─── World 第四輪（使用者提供的 ~/Downloads/world_1，複製到 .cache/world1/，短檔名；來源與授權見 CREDITS.md）───
  // 光環廣場南段與冠石南段的玻璃高樓：abhayexe 的 Procedural City 5（Standard，CityGen 產生的 4×4 街區，公尺），和 bld_fin 同一套 CityGen 材質。
  // 街道、路樹、路面道具（Plane.018 底下）與人行道不要，依街區矩形拆成 15 群（第三排中間兩塊是同一棟）
  { out: 'bld_pc5', file: 'pcity5', src: '.cache/world1', prefix: 'pc5', win: true, winAuto: /Facade/, curtain: /^CityGen(textured_metal|black_|Glass)/, dropPath: /Plane\.018/,
    dropGround: .35, cellMargin: 0, simplify: .6, simplifyError: .003,
    cells: [[-118, -60, -108, -60], [-60, 0, -108, -60], [0, 60, -108, -60], [60, 108, -108, -60], [-118, -60, -60, 0], [-60, 0, -60, 0], [0, 60, -60, 0], [60, 108, -60, 0],
      [-118, -60, 0, 60], [-60, 60, 0, 60], [60, 108, 0, 60], [-118, -60, 60, 110], [-60, 0, 60, 110], [0, 60, 60, 110], [60, 108, 60, 110]] },
  // 各區沿街的辦公樓與公寓：mortalityrexotable 的 Full Gameready City Buildings（CC BY 4.0）。原檔依材質合併、一個單位約 0.67 m（車長 3 單位），放大 1.5 倍；
  // 用連通區自動分棟（seg），太大的（兩棟黏在一起、超過 72 m）不要；路上的車（_0、_2、_3 貼圖）與路燈不要。
  // 照片立面裡有窗的那幾張自動找窗，_5 是藍玻璃帷幕；招牌拼貼（_26）上的滑板品牌模糊掉
  { out: 'bld_grc', file: 'gameready_city', src: '.cache/world1', prefix: 'grc', scale: 1.5, tex: 512, winRes: 512, simplify: .6, simplifyError: .003, win: true, winAuto: /_1_(5|22|24|36|46|49|55|61|65|69|70|74|76|85|91)$/, winBlue: /_1_5$/,
    drop: /_1_(0|2|3)$|StreeLamp/, seg: { res: .5, minY: 1, minArea: 30 }, segPick: (c) => (Math.max(c.c[1] - c.c[0], c.c[3] - c.c[2]) * 1.5 > 72 ? null : {}),
    texEdit: { Concrete_u2SEBuild7_1_26: { blur: [[0, .6, .3, .87]] } } },
  // 灰石國宅的板樓與塔樓：Randonavt 的 Tram Station（CC BY 4.0，公尺）周圍那圈蘇聯式住宅，自動分棟、同款只留一棟；路樹、電車道、彎成弧形的大樓（放不進街區）不要。
  // 窗戶是一扇一扇的窗簾面片（interior 材質），整片當玻璃、每扇各抽亂數
  { out: 'bld_tram', file: 'tram', src: '.cache/world1', prefix: 'tram', win: true, winAuto: /^interior/,
    winRects: new Proxy({}, { get: (_, k) => (typeof k === 'string' && k.startsWith('interior') ? [[0, 0, 1, 1]] : undefined) }),
    seg: { res: 1, minY: 11, minArea: 400 },
    segPick: (() => { const seen = new Set(); return (c) => { const w = c.c[1] - c.c[0], d = c.c[3] - c.c[2], k = [Math.round(Math.min(w, d)), Math.round(Math.max(w, d)), Math.round(c.h)].join(); if (c.h < 28 || Math.max(w, d) > 76 || seen.has(k)) return null; seen.add(k); return {}; }; })() },
  // 珊瑚灘與錨灣港的木屋、小店、餐車：DanielZhabotinsky 的 Rural Buildings Set（CC BY 4.0，和其他 bld_ 組同一位作者、同樣的窗戶遮罩），
  // 節點名是「Rural_類型_編號_材質」；原檔大多長邊沿 z，轉成長邊朝街
  { out: 'bld_rural', file: 'rural', src: '.cache/world1', prefix: 'rural', win: true, split: (n) => (n.match(/^Rural_[A-Za-z]+_\d+/) || [n])[0],
    rotOf: (k, ps) => { const { mn, mx } = bbox(ps); return mx[2] - mn[2] > mx[0] - mn[0] ? 1 : 0; } },
  // 單棟：abhayexe 的 realistic building（五層舊辦公樓）與 brutalist（十四層清水模板樓）（Standard）；zigurat 的 modern tower（CC BY 4.0，含廣場與樹，整塊街區）；
  // Jotrain 的 Petstock and Radio Rentals（Standard，量販店，整塊街區）——兩個真實店名的招牌、海報與電話模糊掉。
  // 後兩個原檔是 specular-glossiness 材質，先用 gltf-transform 的 metalRough() 轉成 *_mr.glb
  { out: 'bld_w1', src: '.cache/world1', win: true, winAuto: /^Material\.00[3-7]$/, items: [
    { id: 'real', file: 'realistic', h: 18 }, { id: 'brut', file: 'brutalist', h: 42 }, { id: 'tower', file: 'modern_tower_mr', scale: 1 }, { id: 'pet', file: 'petstock_mr', scale: 1 }],
    texEdit: { Material: { blur: [[.79, 0, .84, .11], [.8, .165, .97, .225], [.34, .25, .47, .37], [.69, .215, 1, .31], [.74, .3, .88, .39], [.86, .3, .97, .45], [.03, .68, .09, .75], [0, .77, .09, 1], [.3, .77, .345, .94]] } } },
  // 第七間安全屋：dasy444 的 Living Room Interior（Standard，清水模挑高客廳）。原檔一個單位約 0.15 m（天花板在 21），地板在 y 0.8
  { out: 'apt_lr', src: '.cache/world1', items: [{ id: 'lr', file: 'living_room', origin: [0, .8, 0], scale: .15 }] },
  // 可以直接走進去的兩間店（69-safehouse.js 的 HANG_IDS）：katydid 的 British Pub（Standard，原檔一個單位約 5 m）與 Pasha 的 Convenience Store 2
  // （CC BY 4.0，SketchUp 的英吋；只留店面那一間，後面的倉庫與散在遠處的零件用 clip 切掉）
  { out: 'apt_pub', src: '.cache/world1', items: [{ id: 'pub', file: 'pub', scale: 5 }] },
  { out: 'apt_store', src: '.cache/world1', sloppy: .2, tex: 512, items: [{ id: 'store', file: 'store', scale: .0254, clip: [200, 670, -15, 200, -2150, -1625] }] },
  // 地標：golukumar 的希臘神廟掃描（Standard，只留神廟與底下的台基，放大 2.6 倍約 36 m 長）整塊街區擺在燈籠公園北邊（10-city 的 PLAN，所以叫 bld_）；以下 27-world1.js 擺放：
  // -X-ScornGames 的石塔（CC BY 4.0，16 m）在岬角上；artfletch 的 Mayflower Stairs（CC BY 4.0，泰晤士河岸的木造階梯掃描，0.3 倍）在舊碼頭的河岸
  { out: 'bld_temple', src: '.cache/world1', sloppy: .05, items: [{ id: 'temple', file: 'temple', scale: 2.6, groundY: .9, clip: [-6.5, 7.2, -1, 9, -5.2, 5.2] }] },
  { out: 'w1_tower', src: '.cache/world1', sloppy: .5, items: [{ id: 'tower', file: 'stone_tower', h: 16 }] },
  { out: 'w1_stairs', src: '.cache/world1', sloppy: .06, items: [{ id: 'stairs', file: 'mayflower', scale: .3 }] },
  // 圍籬：Warh95 的帶刺鐵絲網圍籬（CC BY 4.0，公分，三種只取 A02 那一片；頂上的蛇腹刺網面數太高拿掉，剩 2.9×3.5 m）擋在舊碼頭兩座木棧橋入口兩側的河岸；orphanrtg 的石塊矮牆（CC BY 4.0，4.6 m 一段）沿岬角步道
  { out: 'w1_fence', src: '.cache/world1', sloppy: .12, tex: 512, items: [{ id: 'wire', file: 'wiremesh', scale: .01, pick: (x, y, z) => x > -200 && x < 100 && Math.abs(z) < 60 && y < 360 },
    { id: 'stone', file: 'stone_fence', scale: 1 }] },
  // 遠景：Metazeon 的三座水泥廠掃描（CC BY 4.0，0.45 倍）在東灣對岸。
  { out: 'far_cement', src: '.cache/world1', far: 1, sloppy: .04, items: [{ id: 'plant', file: 'cement_plant', scale: .45 }, { id: 'tank', file: 'cement_tank', scale: .45 }, { id: 'ruin', file: 'cement_ruin', scale: .45 }] },
  // ─── world_1 第二批：原本沒用上的三個檔與 gameready_city 拿掉的部分（這四個原檔 2026-10-23 從 Sketchfab 重新下載）───
  // 用到這一批加的選項：skirt（外圍一圈往下長到模型底下 d 公尺的斜坡，掃描的邊緣才不會浮著；cap 補島面、ring 輸出外緣）、hf（[nx, nz] 每格的地面最低點，頁面用來接地形）、
  // glow（照底色貼圖挑屋頂撒夜燈點，頁面在那裡放小燈塊）、texOut（只輸出材質的貼圖，給頁面當重複貼圖）
  // 鷹巖村（21-coast.js 外海西南那座島）：Azad Balabanian 的 Èze Village 空拍掃描（CC BY 4.0，公分；山頂的石頭村與兩側山谷，約 640×550 m、263 m 高），
  // 天空球（Skybox：同一次空拍的 360° 全景照）不要，另外裁成 w1_board 的看板。掃描四周的切邊往下長成約 42° 的山坡、沉進海裡
  { out: 'far_eze', src: '.cache/world1', far: 1, tex: 1024, sloppy: .3, items: [{ id: 'eze', file: 'eze', scale: .01, drop: /Skybox/, skirt: { d: 60, slope: 1.1, col: [.055, .062, .042] },
    glow: { n: 220, gap: 7, test: (r, g, b) => r > 110 && r > g * 1.18 && g > b * .95 && r - b > 45 } }] },
  // 北嶺鐵道橋（10-city.js 的 VIADUCT，北嶺公園觀景台正北的山谷）：orphanrtg 的 Railway bridge with a feeling of coziness（CC BY 4.0，
  // 掃描單位一格約 100 m：橋長約 290 m、橋墩約 40 m），連山谷、樹與谷底的路；不補裙邊，hf 給頁面把公園山坡貼到掃描的地面底下、在邊上接起來；
  // line 量橋面的中心線與高度（橋面約 y 64.3、護欄頂約 66.7）與四座橋墩的佔地，列車、橋面步道、護欄與山溝底的碰撞都照它（21-rail.js）
  { out: 'far_rail', src: '.cache/world1', far: 1, tex: 1024, sloppy: .06, items: [{ id: 'rail', file: 'railway', scale: 100, hf: [60, 22], line: { y: [63.4, 65.4], step: 4, x: [-140, 140], piers: [40, 48] } }] },
  // 北嶺鐵道橋兩端的隧道口（21-rail.js）：fpan 的 Marshall Tunnel（CC BY 4.0，公尺；岩壁上鑿出的 U 形切口，裡面是單線鐵道隧道的洞口，洞身斜 4.7°），
  // 轉正、放大 1.25 倍（洞口才夠列車過）後只留切口與洞口後面 5 m 的洞身（portal，東端；洞口裡面接 21-rail.js 的隧道），切口裡的碎石地面（dropBox）拿掉，鋪頁面自己的道碴；
  // spleen.vision 的 stone tunnel at railway（CC BY 4.0，紅砂岩的拱形涵洞，前後兩面石欄杆、兩側斜下的擋土牆；arch，西端）放大 2.2 倍讓列車過得去，
  // 地面的草皮與泥地（原檔 y < 0.2）與兩側的擋土牆（掃描只有正面，背後是空的）不要；perz_scans 的 Cliff Rock Boulder Field（CC BY 4.0，採石場的碎石坡與一圈崖壁）切一段 12 m 寬的崖壁（cliff，0.75 倍；崖腳的碎石堆只留 2 m；石灰岩太白，底色壓到三分之一），
  // 蓋在洞口兩側與上方的陡坡上。三個原檔都是照片掃描：seam 減面不跨 UV 接縫（先把切塊併回一塊、對齊接縫兩邊的頂點），renorm 重算法線，ds 雙面
  { out: 'w1_tunnel', src: '.cache/tunnel', tex: 2048, ds: 1, tint: { rock_field: [.34, 1, 0] }, dropBox: [[90.5, 110, -1, 2.7, 2, 13.5]], items: [
    { id: 'portal', file: 'marshall', sloppy: .25, seam: .01, renorm: 1, clip: [86, 110, -2, 21, -12, 22], yaw: 4.7, orient: ['x', 'y'], scale: 1.25 },
    { id: 'arch', file: 'stonearch', sloppy: .05, seam: .01, renorm: 1, clip: [-9, 9, .2, 9, -2.9, 3.7], orient: ['-z', 'y'], scale: 2.2 },
    { id: 'cliff', file: 'boulders', clip: [309, 322, 18, 50, 0, 18], orient: ['-x', 'y'], scale: .75 },
  ] },
  // 光格島（外海東南那座島）：SpringSociety 的 Arq Grid Tron（CC BY 4.0，公尺；霓虹格線的未來街區，亮線全在自發光貼圖），縮成 0.85、
  // 原點放在島心（原檔 [32, 0, 91]）。遠景（far_tron）不要水面、街道家具、樹與車；tron 選項（tools/walkgrid.mjs）把街區之間封閉的洞補上島面、
  // 外緣長出黑色岸壁，land（陸地遊程編碼）、edges（岸線）、dock（北端那條路的盡頭）給頁面放碼頭、護岸燈與海底
  { out: 'far_tron', src: '.cache/world1', far: 1, tex: 1024, sloppy: .3, metalMax: .3, items: [{ id: 'tron', file: 'tron', scale: .85, origin: [32, 0, 91], drop: /Water|Bench|Vending|Crate|Planter|Postbox|StreetBin|SignPost|Dumpster|Hydrant|BikeRack|Barrel|TrafficCone|Door_Maintenance|Table|Glasses|Spanner|Console|LightOrnament|Tree|Foliage|GodRay|CarPipeline|TronCycle|Blocker_|Lit\.|UnlitPureBlack/,
    tron: {} }] },
  // 光格島的近景（21-tron.js：開船靠岸、走進街區時才下載）：整個街區含長椅、販賣機、樹、停著的車；光速機車、水面、光束拆成自己的物件，
  // 頁面自己畫（水面與光束換成 shader、光速機車可以騎）。tron 選項另外寫步行格 isle_tron.walk.bin、車道圖、家具與升降梯的位置。
  // only：只留路徑符合的原件、inst 取第幾份；beam 保留島的座標（和 tron 同一個原點）
  // emi：原檔的樹是全白自發光（強度 2），夜裡泛光糊成一團白，壓成淡青色的發光樹；metalMax：路面原檔是金屬度 1、粗糙度 0.3，
  // 照出來是城市環境圖裡一格格的彩色窗燈，壓到 0.3；tint 把路面與鋪面的粗糙度拉到 0.8（斜看時的反射也糊開）
  { out: 'isle_tron', src: '.cache/world1', tex: 1024, metalMax: .3, tint: Object.fromEntries(['M_Hexagon_Ground_01', 'M_Decal_Road', 'M_Pavement_Tiles_03', 'M_Pavement_Tiles_2'].map((k) => [k, [1, .8, .3]])), emi: [[/^M_(Tree|Foliage)/, [.07, .19, .24], 0]], items: [
    { id: 'tron', file: 'tron', scale: .85, origin: [32, 0, 91], drop: /Blocker_|Lit\.|UnlitPureBlack/, tron: { walk: true, cut: /(^|\/)(PF_TronCycle|Water_Plane|SM_GodRayBeam)/ } },
    { id: 'beam', file: 'tron', scale: .85, origin: [32, 0, 91], only: /^SM_GodRayBeam/ },
    { id: 'cycle', file: 'tron', scale: 1.1, rot: 1, only: /^PF_TronCycle/, inst: 0 },   // 原檔比人小（2.2 m），放大到 2.4 m 長讓人騎得上去；長邊轉到 z
    { id: 'car_conv', file: 'tron', scale: .85, rot: 1, only: /^PF_Car_Convertible/, inst: 0 },
    { id: 'car_pod', file: 'tron', scale: .85, only: /^PF_Car_Podcar/, inst: 0 },
    { id: 'car_tuc', file: 'tron', scale: .85, only: /^SM_Commercial_TucTuc/, inst: 0 },
  ] },
  // gameready_city 當初拿掉的部分：路上的三台車（深藍轎車、白色廂型貨車、藍色郵務車，tools/traffic.mjs 從這個檔烘進車流）與路燈（彎臂燈桿，
  // 20-props.js 換掉支路的程式路燈）。車與路燈在原檔是和別的東西合併的網格，用 clip 依位置切出來；車頭的徽章、車門上的公司名模糊掉
  { out: 'w1_grc', src: '.cache/world1', tex: 512,
    texEdit: { Concrete_u2SEBuild7_1_0: { blur: [[.1, .33, .135, .39], [.48, .66, .51, .72]] }, Concrete_u2SEBuild7_1_2: { blur: [[.16, .385, .225, .42], [.55, .8, .65, .84]] },
      Concrete_u2SEBuild7_1_3: { blur: [[.16, .385, .225, .42]] } },
    items: [
      // drop 也比節點名：節點都叫 Object_N，負向前瞻只會吃掉材質名不是這台車的（路面上的紙屑、人孔蓋）
      { id: 'sedan', file: 'gameready_city', scale: 1.9, clip: [-16.5, -13.8, .08, 1.4, -5.3, -3.9], drop: /^(?!Object_|Concrete_u2SEBuild7_1_0$|Merged_materials$)/ },
      { id: 'stepvan', file: 'gameready_city', scale: 1.9, clip: [-23, -20, .08, 1.5, -3.7, -2.1], drop: /^(?!Object_|Concrete_u2SEBuild7_1_2$)/ },
      { id: 'mailvan', file: 'gameready_city', scale: 1.9, clip: [-1.8, -.2, .08, 1.5, 24.1, 27.2], drop: /^(?!Object_|Concrete_u2SEBuild7_1_[23]$)/ },
      // 燈桿（_84）在 (−2.75, 10.25)、燈頭在 +x 1 m：轉 180° 讓燈臂朝 −x（和 20-props.js 的 lampKit 一樣），原點放在燈桿底；放大到燈頭約 7 m 高。
      // 旁邊的垃圾桶（_95）、號誌牌（_90）與地上的紙屑不要
      { id: 'lamp', file: 'gameready_city', scale: 2.2, rot: 2, clip: [-2.95, -1.6, -.05, 3.4, 10.1, 10.4], drop: /^(?!Object_|Concrete_u2SEBuild7_1_84$|StreeLamp)/, origin: [2.66, 0, -10.2] },
    ] },
  // gameready_city 的柏油路面（Concrete_u2SEBuild7_1：底色、法線、粗糙度三張），10-city.js 的路面 shader 拿來當重複貼圖
  { out: 'w1_asphalt', src: '.cache/world1', texOut: { file: 'gameready_city', mat: /^Concrete_u2SEBuild7_1$/, size: 512 } },
  // 鷹巖村的看板：Èze 掃描附的 360° 空拍全景（Skybox 的貼圖），裁出地平線那一帶，做成珊瑚灘步道上的燈箱看板
  { out: 'w1_board', src: '.cache/world1', board: { file: 'eze', mat: /^Material\.001$/, crop: [0, .45, .62, .86], flip: 1, w: 7.2, h: 2.4 } },
  // 北嶺鐵道橋的列車（21-rail.js）：tiunov.se 的 Lastochka electric train（CC BY 4.0，公尺，沒有貼圖、只有材質顏色；2026-10-23 下載），
  // 原檔是一節駕駛車、一節中間車、一節拖車沿 x 排開（車頭朝 −x），依位置拆成三個物件、車頭轉成朝 +z；頁面排成五節，最後一節是反過來的駕駛車。
  // 車頭上方的目的地字幕（Material_1508，真實地名）拿掉，頁面另外貼原創的路線牌；客室窗（Material_705／544，深色半透明）夜裡亮暖色燈（燈種 0），
  // 頭燈（Material_806）是燈種 1，跑起來才亮
  { out: 'w1_train', src: '.cache/world1', tex: 256, simplify: .3, emi: [[/^Material_(705|544)$/, [1, .74, .46], 0], [/^Material_806$/, null, 1]], items: [
    { id: 'cab', file: 'lastochka', orient: ['-x', 'y'], pick: (x) => x < 17.65, drop: /^Material_1508$/ },
    { id: 'mid', file: 'lastochka', orient: ['-x', 'y'], pick: (x) => x > 17.65 && x < 36.85 },
    { id: 'tail', file: 'lastochka', orient: ['-x', 'y'], pick: (x) => x > 36.85 },
  ] },
  // ─── World 第四輪之二（使用者提供的 ~/Downloads/world_2，21 個 Sketchfab 模型，全部 CC BY 4.0；複製到 .cache/world2/，短檔名；來源與拿掉的部分見 CREDITS.md）───
  // 街道設施、植物與海岸，頁面在 27-props.js 檔尾（World 第四輪之二那段）下載後換掉 20-props／21-coast 的程式建模；大量重複的用 InstancedMesh。
  // 用到這一輪加的選項：metalMax（金屬度上限）、noEmi（拿掉自發光）、mask（改成 MASK）、keyWhite（白底當透明）、simplifyMat（只減某些材質；第四項 'sloppy'／'permissive' 允許不管拓撲或跨 UV 接縫收合）、soften（提亮並壓低貼圖對比）。
  // fire_hydrant 和 street.glb 的消防栓是同一個模型，不再處理一次，頁面直接用 street.glb 的 hydrant
  // 街道設施：長椅兩款、野餐桌、垃圾桶（原檔三個並排，拆成三個；Recology 的商標模糊掉）、有輪子的垃圾桶、電話亭、報紙箱
  { out: 'st2_street', src: '.cache/world2', tex: 512, metalMax: .2, simplifyMat: [[/^phone_tex$/, .25, .01]],
    texEdit: Object.fromEntries(['garbage', 'compost', 'recycle'].map((k) => [k, { blur: [[.06, 0, .23, .23], [.57, 0, .74, .23]] }])),
    items: [
      { id: 'bench', file: 'bench_park', len: 1.9 },
      { id: 'bench2', file: 'bench_modern', len: 1.6 },
      { id: 'picnic', file: 'picnic', len: 1.8 },
      { id: 'bin_k', file: 'garbage_bin', scale: .0095, drop: /compost|recycle/ },
      { id: 'bin_g', file: 'garbage_bin', scale: .0095, drop: /garbage|recycle/ },
      { id: 'bin_b', file: 'garbage_bin', scale: .0095, drop: /garbage|compost/ },
      { id: 'wheelie', file: 'public_bin', h: 1.06 },
      { id: 'booth', file: 'phone_booth', h: 2.4 },
      { id: 'newsbox', file: 'newsbox', h: 1.2 },
    ] },
  // 樹：楓樹（拿掉底下的草皮；葉片貼圖沒有 alpha，白底當透明）、兩棵垂柳（原檔並排，依 x 切開）、三棵一叢的橡樹。樹幹減面，葉片卡不動
  { out: 'nat_trees', src: '.cache/world2', tex: 512, metalMax: 0, mask: /lea(f|ves)/i, keyWhite: /^sugar_maple_leaf$/, noEmi: /leaf|grass/i, simplifyMat: [[/bark/i, .2, .02]],
    items: [
      { id: 'maple', file: 'maple', h: 8, drop: /Groundcover|grass/ },
      { id: 'willow_a', file: 'tree_low', h: 7.5, clip: [-10, 7, -5, 30, -20, 20] },
      { id: 'willow_b', file: 'tree_low', h: 7, clip: [7, 30, -5, 30, -20, 20] },
      { id: 'oak', file: 'oak', h: 10 },
    ] },
  // 灌木：Bush + Ivy Pack 裡的玉簪與兩種蕨（牆上的長春藤不要），花台與公園地面用
  { out: 'nat_bush', src: '.cache/world2', tex: 512, metalMax: 0, mask: /./, items: [
    { id: 'hosta', file: 'bush', h: .55, drop: /Ivy|wall|Fern/ },
    { id: 'fern', file: 'bush', h: .6, drop: /Ivy|wall|hosta|Fern2|FernLong/ },
    { id: 'fernlong', file: 'bush', h: .5, drop: /Ivy|wall|hosta|Fern1/ },
  ] },
  // 珊瑚灘：椰子樹、救生員塔（小屋的 BLEND 改 MASK）、海灘陽傘
  { out: 'cst_beach', src: '.cache/world2', tex: 1024, metalMax: .1, mask: /^booth$/, simplifyMat: [[/Palm_4_Leaf/, .5, .01]], items: [
    { id: 'palm', file: 'palm', h: 10 },
    { id: 'lifeguard', file: 'lifeguard', h: 4.6 },
    { id: 'umbrella', file: 'umbrella', h: 2.6 },
  ] },
  // 棧橋摩天輪：拆成支架（A 字架；地面、底座平台、柵欄、樓梯、垃圾桶不要）、輪子、一個車廂。三件共用輪軸當原點（origin），
  // 車廂的原點是吊點（原檔十個車廂只取一個，頁面依角度擺十份並保持水平）
  { out: 'cst_ferris', src: '.cache/world2', tex: 1024, metalMax: .3, items: [
    { id: 'base', file: 'ferris', origin: [0, 12.15, -2.2], drop: /^(plane|trash|wheel|block|fence|stairs|polySurface)/ },
    { id: 'wheel', file: 'ferris', origin: [0, 12.15, -2.2], drop: /^(plane|trash|mount|block|fence|stairs|polySurface)/ },
    { id: 'cabin', file: 'ferris', origin: [-12.6, 23.95, -2.25], drop: /^(plane|trash|mount|block|fence|stairs|wheel|polySurface(?!326))/ },
  ] },
  // 錨灣港：岸橋（吊在下面的小車、鋼索、吊具與貨櫃是另外幾個材質，拿掉，頁面的小車照舊會動；吊臂原檔沿 +x，轉成朝海 +z）、
  // 貨櫃船、20 呎貨櫃（跨接縫減到約 700 面、改霧面，堆場用一千多份）
  { out: 'cst_port', src: '.cache/world2', tex: 1024, metalMax: .2, tint: { BODY: [1, .8, 0] }, soften: { BODY: [150, .45] }, simplifyMat: [[/^100[123]$/, .35, .005], [/^BODY$/, .04, .015, 'permissive']], items: [
    { id: 'crane', file: 'sts_crane', scale: .0857, rot: 3, drop: /Material\.00[4-8]/ },
    { id: 'ship', file: 'cargo_ship', scale: 1.85 },
    { id: 'box', file: 'container', len: 6.06 },
  ] },
  // 北嶺的雪山：遠景（far），頁面依山脊拉伸擺幾座；夜裡雪不要白到刺眼，底色壓到六成
  { out: 'cst_mount', src: '.cache/world2', far: 1, tex: 512, metalMax: 0, tint: { '01_-_Default': [.6, .9, 0] }, simplifyMat: [[/Default/, .4, .01]],
    items: [{ id: 'mount', file: 'mountain', scale: 1 }] },
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
// 重算頂點法線（renorm）：照面積加權、同一個位置（1 mm）的頂點共用（UV 接縫兩邊一樣平滑）。照片掃描減面後原檔的法線對不上細長的三角形，
// 打光時會冒出一點一點的亮斑
function renormal(prims) {
  const acc = new Map(), key = (p, i) => `${Math.round(p.pos[i * 3] * 1000)},${Math.round(p.pos[i * 3 + 1] * 1000)},${Math.round(p.pos[i * 3 + 2] * 1000)}`;
  for (const p of prims) {
    p.keys = Array.from({ length: p.cnt }, (_, i) => key(p, i));
    for (let t = 0; t < p.idx.length; t += 3) {
      const [a, b, c] = [p.idx[t], p.idx[t + 1], p.idx[t + 2]], P = (v, k) => p.pos[v * 3 + k];
      const ux = P(b, 0) - P(a, 0), uy = P(b, 1) - P(a, 1), uz = P(b, 2) - P(a, 2), vx = P(c, 0) - P(a, 0), vy = P(c, 1) - P(a, 1), vz = P(c, 2) - P(a, 2);
      const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      for (const v of [a, b, c]) { const k = p.keys[v], s = acc.get(k) || [0, 0, 0]; s[0] += n[0]; s[1] += n[1]; s[2] += n[2]; acc.set(k, s); }
    }
  }
  for (const p of prims) { for (let i = 0; i < p.cnt; i++) { const s = acc.get(p.keys[i]), l = Math.hypot(...s) || 1; p.nor.set([s[0] / l, s[1] / l, s[2] / l], i * 3); } delete p.keys; }
}
// 同一個材質的 primitive 併成一個（節點名取第一個）
function mergePrims(prims) {
  const by = new Map();
  for (const p of prims) { if (!by.has(p.mat)) by.set(p.mat, []); by.get(p.mat).push(p); }
  return [...by.values()].map((g) => {
    if (g.length === 1) return g[0];
    const cnt = g.reduce((a, p) => a + p.cnt, 0), pos = new Float32Array(cnt * 3), nor = new Float32Array(cnt * 3), uv = g.every((p) => p.uv) ? new Float32Array(cnt * 2) : null, idx = [];
    let o = 0;
    for (const p of g) { pos.set(p.pos, o * 3); nor.set(p.nor, o * 3); if (uv) uv.set(p.uv, o * 2); for (const v of p.idx) idx.push(v + o); o += p.cnt; }
    return { node: g[0].node, path: g[0].path, mat: g[0].mat, pos, nor, uv, idx: Uint32Array.from(idx), cnt };
  });
}
// 位置差不到 1 mm 的頂點對齊到同一點（UV 接縫兩邊的頂點位置要完全一樣，減面才認得出是接縫、不當成外緣），位置與 UV 都一樣的併成一個
function weldPrim(p) {
  const at = new Map(), first = new Map(), rep = new Uint32Array(p.cnt);
  for (let i = 0; i < p.cnt; i++) {
    const pk = [0, 1, 2].map((j) => Math.round(p.pos[i * 3 + j] * 1e3)).join(',');
    if (!at.has(pk)) at.set(pk, i); else { const j = at.get(pk); for (let k = 0; k < 3; k++) p.pos[i * 3 + k] = p.pos[j * 3 + k]; }
    const k = pk + (p.uv ? `/${Math.round(p.uv[i * 2] * 1e5)},${Math.round(p.uv[i * 2 + 1] * 1e5)}` : '');
    if (!first.has(k)) first.set(k, i); rep[i] = first.get(k);
  }
  return subPrim(p, Array.from(p.idx, (v) => rep[v]));
}
// 取 primitive 的部分三角形，頂點重新編號
function subPrim(p, ix) {
  const map = new Map(), keep = [];
  const idx = Uint32Array.from(ix, (v) => { if (!map.has(v)) { map.set(v, keep.length); keep.push(v); } return map.get(v); });
  const pick = (a, n) => { if (!a) return null; const o = new Float32Array(keep.length * n); keep.forEach((v, i) => { for (let k = 0; k < n; k++) o[i * n + k] = a[v * n + k]; }); return o; };
  return { node: p.node, path: p.path, mat: p.mat, pos: pick(p.pos, 3), nor: pick(p.nor, 3), uv: pick(p.uv, 2), idx, cnt: keep.length };
}
// 水平切一段（原檔座標 y0 ≤ y < y1）：跨過切面的三角形真的切開（位置、法線、UV 照比例內插），柱子與牆才不會整根掉到另一段。
// 施工大樓的樓層一段一段疊上去（69-v5-crane.js），各段用同一個原點，切口剛好接在一起
function bandPrim(p, y0, y1) {
  const P = [], N = [], U = [], hasUV = !!p.uv;
  const vtx = (i) => ({ p: [p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]], n: [p.nor[i * 3], p.nor[i * 3 + 1], p.nor[i * 3 + 2]], u: hasUV ? [p.uv[i * 2], p.uv[i * 2 + 1]] : [0, 0] });
  const mix = (a, b, t) => ({ p: a.p.map((v, k) => v + (b.p[k] - v) * t), n: a.n.map((v, k) => v + (b.n[k] - v) * t), u: a.u.map((v, k) => v + (b.u[k] - v) * t) });
  // Sutherland–Hodgman：留下 s·(y − c) ≥ 0 的那邊
  const cut = (poly, c, sg) => {
    const out = [];
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k], b = poly[(k + 1) % poly.length], da = sg * (a.p[1] - c), db = sg * (b.p[1] - c);
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) out.push(mix(a, b, da / (da - db)));
    }
    return out;
  };
  for (let t = 0; t < p.idx.length; t += 3) {
    let poly = [0, 1, 2].map((k) => vtx(p.idx[t + k]));
    const lo = Math.min(...poly.map((v) => v.p[1])), hi = Math.max(...poly.map((v) => v.p[1]));
    if (hi <= y0 || lo >= y1) { if (!(hi === lo && lo === y0)) continue; }   // 剛好躺在下切面上的樓板面算這一段
    if (lo < y0) poly = cut(poly, y0, 1);
    if (hi > y1) poly = cut(poly, y1, -1);
    for (let k = 1; k + 1 < poly.length; k++) for (const v of [poly[0], poly[k], poly[k + 1]]) { P.push(...v.p); N.push(...v.n); U.push(...v.u); }
  }
  if (!P.length) return null;
  const cnt = P.length / 3;
  return { node: p.node, path: p.path, mat: p.mat, pos: Float32Array.from(P), nor: Float32Array.from(N), uv: hasUV ? Float32Array.from(U) : null, idx: Uint32Array.from({ length: cnt }, (_, i) => i), cnt };
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

// ─── world_1 第二批的選項（skirt、hf、glow），都在 place() 擺正、縮放之後跑，座標是輸出的公尺 ───
// skirt { d, maxY, res, slope, col, n }：掃描模型（地景切片）的邊緣補一圈斜坡，往下長到模型最低點下面 d 公尺。
// 不用邊界邊（照片掃描的邊緣是鋸齒、重疊與破洞，邊界邊會缺一段段）：三角形取樣進 res 公尺的格子記最低高度，
// 從中心往外每個角度（n 個）找最外面有模型的格子，那一點的高度當坡頂（略往內一點，藏在模型邊緣底下），坡底從中心往外推（高差 × slope）。
// 另開一個沒有貼圖的雙面材質（col 是線性底色）。maxY：坡頂最高到這個高度（城市切片只補地面以下）。
// cap：坡頂一律在這個高度，圈內再鋪一片平的面（街區之間原本是空的，補成島面）。ring：每 ring 個角度取一個坡頂點 [x, z] 記進 manifest（頁面沿著它擺護岸燈）
function addSkirt(prims, { d, maxY = Infinity, res = 2, slope = 0, col = [.1, .1, .1], n = 720, cap, ring: ringStep }) {
  const { mn, mx } = bbox(prims), W = Math.ceil((mx[0] - mn[0]) / res) + 1, H = Math.ceil((mx[2] - mn[2]) / res) + 1, ylo = new Float32Array(W * H).fill(Infinity);
  for (const p of prims) for (let t = 0; t < p.idx.length; t += 3) {
    const P = [0, 1, 2].map((k) => { const v = p.idx[t + k]; return [p.pos[v * 3], p.pos[v * 3 + 1], p.pos[v * 3 + 2]]; });
    const m = Math.max(1, Math.ceil(Math.max(...[[0, 1], [1, 2], [2, 0]].map(([a, b]) => Math.hypot(P[a][0] - P[b][0], P[a][2] - P[b][2]))) / (res * .7)));
    for (let i = 0; i <= m; i++) for (let j = 0; j <= m - i; j++) {
      const u = i / m, w = j / m, v = 1 - u - w, x = P[0][0] * u + P[1][0] * w + P[2][0] * v, z = P[0][2] * u + P[1][2] * w + P[2][2] * v, y = P[0][1] * u + P[1][1] * w + P[2][1] * v;
      const k = Math.floor((z - mn[2]) / res) * W + Math.floor((x - mn[0]) / res);
      if (y < ylo[k]) ylo[k] = y;
    }
  }
  const cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2, yb = mn[1] - d, R = Math.hypot(mx[0] - mn[0], mx[2] - mn[2]) / 2 + res;
  const at = (x, z) => { const X = Math.floor((x - mn[0]) / res), Z = Math.floor((z - mn[2]) / res); return X < 0 || Z < 0 || X >= W || Z >= H ? Infinity : ylo[Z * W + X]; };
  const ring = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    let hit = null;
    for (let r = R; r > res; r -= res * .5) {
      if (at(cx + dx * r, cz + dz * r) === Infinity) continue;
      const r1 = r - res * .75, y = cap ?? Math.min(maxY, at(cx + dx * r1, cz + dz * r1) === Infinity ? at(cx + dx * r, cz + dz * r) : at(cx + dx * r1, cz + dz * r1));
      hit = [cx + dx * r1, y - .3, cz + dz * r1, dx, dz]; break;
    }
    ring.push(hit);
  }
  const pos = [], nor = [], idx = [], ny = slope / Math.hypot(1, slope), nh = 1 / Math.hypot(1, slope);
  for (let i = 0; i < n; i++) {
    const A = ring[i], B = ring[(i + 1) % n];
    if (!A || !B) continue;
    const q = pos.length / 3;
    for (const [P, low] of [[A, 0], [A, 1], [B, 1], [B, 0]]) {
      const o = low ? Math.max(0, P[1] - yb) * slope : 0;
      pos.push(P[0] + P[3] * o, low ? yb : P[1], P[2] + P[4] * o); nor.push(P[3] * nh, ny, P[4] * nh);
    }
    idx.push(q, q + 2, q + 1, q, q + 3, q + 2);
  }
  const segs = idx.length / 6;
  if (cap != null) {   // 島面：從中心拉到每一段坡頂的扇形
    const c0 = pos.length / 3; pos.push(cx, cap, cz); nor.push(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const A = ring[i], B = ring[(i + 1) % n];
      if (!A || !B) continue;
      const q = pos.length / 3; pos.push(A[0], cap, A[2], B[0], cap, B[2]); nor.push(0, 1, 0, 0, 1, 0);
      idx.push(c0, q + 1, q);
    }
  }
  console.log(`  崖壁：一圈 ${segs} 段，往下到 y ${yb.toFixed(1)}${cap != null ? `，島面 y ${cap}` : ''}`);
  if (!idx.length) return prims;
  const mat = new Document().createMaterial('skirt').setBaseColorFactor([...col, 1]).setRoughnessFactor(1).setMetallicFactor(0).setDoubleSided(true);
  const out = [...prims, { node: 'skirt', path: 'skirt', mat, pos: Float32Array.from(pos), nor: Float32Array.from(nor), uv: null, idx: Uint32Array.from(idx), cnt: pos.length / 3 }];
  if (ringStep) out.ring = ring.filter((p, i) => p && i % ringStep === 0).map((p) => [+p[0].toFixed(1), +p[2].toFixed(1)]);
  return out;
}
// hf [nx, nz]：外框切成 nx×nz 格，每格取落在格裡的頂點最低的高度（地面，樹冠與橋面比它高）；沒有頂點的格子是 null
function heightField(prims, nx, nz) {
  const { mn, mx } = bbox(prims), dx = (mx[0] - mn[0]) / nx, dz = (mx[2] - mn[2]) / nz, y = new Array(nx * nz).fill(null);
  for (const p of prims) for (let i = 0; i < p.cnt; i++) {
    const X = Math.min(nx - 1, Math.floor((p.pos[i * 3] - mn[0]) / dx)), Z = Math.min(nz - 1, Math.floor((p.pos[i * 3 + 2] - mn[2]) / dz)), k = Z * nx + X;
    if (y[k] == null || p.pos[i * 3 + 1] < y[k]) y[k] = p.pos[i * 3 + 1];
  }
  return { x0: +mn[0].toFixed(2), z0: +mn[2].toFixed(2), dx: +dx.toFixed(3), dz: +dz.toFixed(3), nx, nz, y: y.map((v) => v == null ? null : +v.toFixed(1)) };
}
// line { y: [lo, hi], step, x: [x0, x1] }：橋面的中心線。每 step 公尺切一片，取高度在 [lo, hi]（橋面，低於護欄頂）的頂點，
// 依 z 分群（間隔超過 2.5 m 算另一群：旁邊的樹冠與山坡），從中間那片往兩頭走、每片挑離上一片中心最近的那群；
// 各片的中心擬合成 z = c0 + c1·x + c2·x²，y 是橋面頂點高度的中位數，w 是各片寬度的中位數（護欄內側到內側）
function trackLine(prims, { y: [lo, hi], step = 4, x: [x0, x1], piers: pier }) {
  const band = [];
  for (const p of prims) for (let i = 0; i < p.cnt; i++) { const y = p.pos[i * 3 + 1]; if (y >= lo && y <= hi) band.push([p.pos[i * 3], y, p.pos[i * 3 + 2]]); }
  const slice = (x) => {
    const zs = band.filter((v) => Math.abs(v[0] - x) < step / 2).map((v) => v[2]).sort((a, b) => a - b), groups = [];
    for (const z of zs) { const g = groups[groups.length - 1]; if (g && z - g[g.length - 1] < 2.5) g.push(z); else groups.push([z]); }
    return groups.filter((g) => g.length > 4);
  };
  const pts = [], pick = (x, near) => {
    const gs = slice(x); if (!gs.length) return near;
    const g = gs.reduce((a, b) => Math.abs((a[0] + a[a.length - 1]) / 2 - near) < Math.abs((b[0] + b[b.length - 1]) / 2 - near) ? a : b);
    const c = (g[0] + g[g.length - 1]) / 2; if (Math.abs(c - near) > 4) return near;
    pts.push([x, c, g[g.length - 1] - g[0]]); return c;
  };
  const mid = (x0 + x1) / 2, g0 = slice(mid).sort((a, b) => b.length - a.length)[0], c0 = (g0[0] + g0[g0.length - 1]) / 2;
  for (const dir of [1, -1]) { let c = c0; for (let x = mid + (dir > 0 ? 0 : -step); dir > 0 ? x <= x1 : x >= x0; x += dir * step) c = pick(x, c); }
  // 最小平方擬合二次式
  const S = Array.from({ length: 5 }, (_, k) => pts.reduce((a, p) => a + p[0] ** k, 0)), T = [0, 1, 2].map((k) => pts.reduce((a, p) => a + p[1] * p[0] ** k, 0));
  const M = [[S[0], S[1], S[2]], [S[1], S[2], S[3]], [S[2], S[3], S[4]]], det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M), c = [0, 1, 2].map((k) => det(M.map((r, i) => r.map((v, j) => j === k ? T[i] : v))) / D);
  const ys = band.filter((v) => v[0] > x0 && v[0] < x1 && Math.abs(v[2] - (c[0] + c[1] * v[0] + c[2] * v[0] ** 2)) < 3).map((v) => v[1]).sort((a, b) => a - b);
  const ws = pts.map((p) => p[2]).sort((a, b) => a - b);
  const res = { c: [+c[0].toFixed(3), +c[1].toFixed(5), +c[2].toFixed(7)], y: +ys[ys.length >> 1].toFixed(2), w: +ws[ws.length >> 1].toFixed(1), x0, x1 };
  console.log(`  橋面中心線：${pts.length} 片，z = ${res.c.join(' + ')}·x…，y ${res.y}，寬 ${res.w}`);
  // 橋墩：高度帶 piers（橋面下 16–24 m，西端的橋墩在 30–40 m 會和山坡連成一片）裡，離中心線 12 m 內的頂點放進 1 m 的格子，連通的一塊是一座（給山溝底的碰撞）
  if (pier) {
    const occ = new Set();
    for (const p of prims) for (let i = 0; i < p.cnt; i++) {
      const x = p.pos[i * 3], y = p.pos[i * 3 + 1], z = p.pos[i * 3 + 2];
      if (y >= pier[0] && y <= pier[1] && Math.abs(z - (c[0] + c[1] * x + c[2] * x * x)) < 12) occ.add(Math.floor(x) + ',' + Math.floor(z));
    }
    res.piers = [];
    for (const k of occ) {
      if (!occ.has(k)) continue;
      const st = [k], b = [1e9, -1e9, 1e9, -1e9]; let n = 0; occ.delete(k);
      while (st.length) {
        const [i, j] = st.pop().split(',').map(Number); n++; b[0] = Math.min(b[0], i); b[1] = Math.max(b[1], i + 1); b[2] = Math.min(b[2], j); b[3] = Math.max(b[3], j + 1);
        for (let a = -1; a <= 1; a++) for (let d = -1; d <= 1; d++) { const q = (i + a) + ',' + (j + d); if (occ.has(q)) { occ.delete(q); st.push(q); } }
      }
      const mx = (b[0] + b[1]) / 2, off = (b[2] + b[3]) / 2 - (c[0] + c[1] * mx + c[2] * mx * mx);   // 橋墩騎在中心線上；偏到一邊的是樹梢
      if (n >= 12 && b[1] - b[0] < 20 && b[3] - b[2] < 20 && Math.abs(off) < 3) res.piers.push(b);
    }
    for (let i = res.piers.length - 1; i > 0; i--) for (let j = 0; j < i; j++) {   // 同一座被切成兩塊的併起來
      const p = res.piers[i], q = res.piers[j];
      if (p[0] <= q[1] && q[0] <= p[1] && p[2] <= q[3] && q[2] <= p[3]) { res.piers[j] = [Math.min(p[0], q[0]), Math.max(p[1], q[1]), Math.min(p[2], q[2]), Math.max(p[3], q[3])]; res.piers.splice(i, 1); break; }
    }
    res.piers.sort((p, q) => p[0] - q[0]);
    console.log(`  橋墩：${res.piers.map((b) => `x ${b[0]}…${b[1]}`).join('、')}`);
  }
  return res;
}
// glow { n, gap, test(r, g, b) }：依面積隨機挑三角形，重心取到的底色符合 test（紅瓦屋頂）就記成一盞夜燈的位置，彼此至少隔 gap 公尺
async function glowPts(prims, { n, gap, test }) {
  const px = new Map(), tris = [];
  for (const p of prims) {
    const t0 = p.mat && p.mat.getBaseColorTexture(); if (!t0 || !p.uv) continue;
    if (!px.has(t0)) { const { data, info } = await sharp(Buffer.from(t0.getImage())).resize(512, 512, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true }); px.set(t0, { data, S: info.width }); }
    for (let t = 0; t < p.idx.length; t += 3) {
      const v = [0, 1, 2].map((k) => p.idx[t + k]), P = v.map((i) => [p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]]);
      const e1 = P[1].map((x, k) => x - P[0][k]), e2 = P[2].map((x, k) => x - P[0][k]);
      const area = Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2;
      tris.push({ p, v, P, area, img: px.get(t0) });
    }
  }
  const tot = tris.reduce((a, o) => a + o.area, 0), r = (() => { let s = 1234567; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(), pts = [];
  for (let k = 0; k < n * 60 && pts.length < n; k++) {
    let x = r() * tot, o = tris[0]; for (const q of tris) { x -= q.area; if (x <= 0) { o = q; break; } }
    const u = o.v.reduce((a, i) => a + o.p.uv[i * 2], 0) / 3, w = o.v.reduce((a, i) => a + o.p.uv[i * 2 + 1], 0) / 3, S = o.img.S;
    const j = (Math.min(S - 1, Math.max(0, Math.floor((((w % 1) + 1) % 1) * S))) * S + Math.min(S - 1, Math.max(0, Math.floor((((u % 1) + 1) % 1) * S)))) * 3;
    if (!test(o.img.data[j], o.img.data[j + 1], o.img.data[j + 2])) continue;
    const c = [0, 1, 2].map((a) => (o.P[0][a] + o.P[1][a] + o.P[2][a]) / 3);
    if (pts.some((q) => Math.hypot(q[0] - c[0], q[2] - c[2]) < gap)) continue;
    pts.push(c.map((v) => +v.toFixed(1)));
  }
  console.log(`  夜燈點：${pts.length}`);
  return pts;
}
// texOut { file, mat, size }：只把那個材質的底色、法線、金屬粗糙三張貼圖輸出成 <out>_base／_n／_mr.webp
async function texOut(set) {
  const { file, mat, size } = set.texOut, doc = await io.read(resolve(root, set.src, file + '.glb'));
  const m = doc.getRoot().listMaterials().find((x) => mat.test(x.getName())), files = [];
  for (const [k, t] of [['base', m.getBaseColorTexture()], ['n', m.getNormalTexture()], ['mr', m.getMetallicRoughnessTexture()]]) {
    if (!t) continue;
    const f = `${set.out}_${k}.webp`;
    await sharp(Buffer.from(t.getImage())).resize(size, size).webp({ quality: 82 }).toFile(resolve(OUT, f));
    files.push(f);
  }
  const kb = files.reduce((a, f) => a + Math.round(statSync(resolve(OUT, f)).size / 1024), 0);
  console.log(`${set.out}: ${files.join('、')}，${kb} KB`);
  return { kb, tex: files };
}
// board { file, mat, crop, flip, w, h }：從原檔某個材質的底色貼圖裁一塊（UV，v 由上往下；flip 先上下翻），做成 w×h 公尺、面朝 +z 的燈箱面板
async function boardSrc(set) {
  const { file, mat, crop: [u0, v0, u1, v1], flip, w, h } = set.board, doc = await io.read(resolve(root, set.src, file + '.glb'));
  const m = doc.getRoot().listMaterials().find((x) => mat.test(x.getName())), img = Buffer.from(m.getBaseColorTexture().getImage());
  const { width: W, height: H } = await sharp(img).metadata();
  let s = sharp(img); if (flip) s = sharp(await s.flip().toBuffer());
  const png = await s.extract({ left: Math.round(u0 * W), top: Math.round(v0 * H), width: Math.round((u1 - u0) * W), height: Math.round((v1 - v0) * H) }).resize(1024).png().toBuffer();
  const tmp = new Document(), tex = tmp.createTexture('board').setImage(new Uint8Array(png)).setMimeType('image/png');
  const bm = tmp.createMaterial('board').setBaseColorTexture(tex).setEmissiveTexture(tex).setEmissiveFactor([.55, .55, .55]);
  const pos = Float32Array.from([-w / 2, 0, 0, w / 2, 0, 0, w / 2, h, 0, -w / 2, h, 0]), nor = Float32Array.from([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
  return [{ node: 'board', path: 'board', mat: bm, pos, nor, uv: Float32Array.from([0, 1, 1, 1, 1, 0, 0, 0]), idx: Uint32Array.from([0, 1, 2, 0, 2, 3]), cnt: 4 }];
}

async function build(set) {
  if (set.texOut) return texOut(set);
  const out = new Document();
  out.createBuffer();
  const scene = out.createScene();
  const items = {};
  const sources = set.items ? set.items : set.board ? [] : [{ file: set.file, drop: set.drop }];
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
    // mask（World 第四輪加的選項，沒寫的組不受影響）：材質名符合的改成 MASK（葉片：BLEND 大量實例會排序錯亂、OPAQUE 會看到貼圖的白底）
    const forceMask = !!(set.mask && m && set.mask.test(m.getName()));
    const blend = m && m.getAlphaMode() === 'BLEND' && !forceMask, mask = m && m.getAlphaMode() === 'MASK' || forceMask;
    const n = out.createMaterial(m ? m.getName() : 'flat').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(1).setDoubleSided(!!(set.ds || m && m.getDoubleSided()));   // ds：照片掃描減面後有翻面的小三角形，背面剔除會透出一點一點的洞
    if (blend) n.setAlphaMode('BLEND'); else if (mask) n.setAlphaMode('MASK').setAlphaCutoff(forceMask ? .5 : m.getAlphaCutoff());
    const noEmi = !!(set.noEmi && m && set.noEmi.test(m.getName()));   // noEmi（第四輪）：原檔把葉子、草標成自發光，夜裡整棵樹會亮
    const edit = set.texEdit && m && set.texEdit[m.getName()];
    if (edit && m.getBaseColorTexture()) {
      // 換掉真實商標：廣告圖集同時當底色與自發光（版面形狀照原檔，內容是原創的）；照片立面只模糊招牌
      const src = m.getBaseColorTexture(), png = edit.ads != null ? (await adAtlas(src.getImage(), edit.ads)).png : await blurAtlas(src.getImage(), edit.blur);
      const nt = out.createTexture(m.getName() + (edit.ads != null ? '_ads' : '_clean')).setImage(new Uint8Array(png)).setMimeType('image/png');
      n.setBaseColorTexture(nt);
      if (edit.ads != null) n.setEmissiveTexture(nt).setEmissiveFactor([1, 1, 1]);
      else if (m.getEmissiveTexture()) n.setEmissiveTexture(copyTex(m.getEmissiveTexture())).setEmissiveFactor([1, 1, 1]);
    } else if (set.keyWhite && m && m.getBaseColorTexture() && set.keyWhite.test(m.getName())) {
      // keyWhite（第四輪）：沒有 alpha 的葉片貼圖，白底當成透明（配合 mask）
      const { data, info } = await sharp(Buffer.from(m.getBaseColorTexture().getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let i = 0; i < data.length; i += 4) if (Math.min(data[i], data[i + 1], data[i + 2]) > 200) data[i + 3] = 0;
      const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
      n.setBaseColorTexture(out.createTexture(m.getName() + '_key').setImage(new Uint8Array(png)).setMimeType('image/png'));
      if (m.getEmissiveTexture() && !noEmi) n.setEmissiveTexture(copyTex(m.getEmissiveTexture())).setEmissiveFactor([1, 1, 1]);
    } else if (set.soften && m && m.getBaseColorTexture() && set.soften[m.getName()]) {
      // soften（第四輪）：{ 材質名: [目標亮度 0–255, 對比倍率] }。深色舊化貼圖（貨櫃）提亮、壓低刮痕對比，頁面再乘上顏色才不會一片亮紋
      const [tgt, k] = set.soften[m.getName()];
      const { data, info } = await sharp(Buffer.from(m.getBaseColorTexture().getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const mean = [0, 1, 2].map((c) => { let t = 0; for (let i = c; i < data.length; i += 3) t += data[i]; return t / (data.length / 3); });
      for (let i = 0; i < data.length; i++) data[i] = Math.max(0, Math.min(255, tgt + (data[i] - mean[i % 3]) * k));
      const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer();
      n.setBaseColorTexture(out.createTexture(m.getName() + '_soft').setImage(new Uint8Array(png)).setMimeType('image/png'));
    } else {
      if (m && m.getBaseColorTexture()) n.setBaseColorTexture(copyTex(m.getBaseColorTexture()));
      if (m && m.getEmissiveTexture() && !noEmi) n.setEmissiveTexture(copyTex(m.getEmissiveTexture())).setEmissiveFactor([1, 1, 1]);
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
      const rc = set.recolor && m && set.recolor[m.getName()];   // [r, g, b, a, 粗糙度]：整個換掉原檔的底色（偏色很重、又粗糙到一片霧白的玻璃）
      const bc = rc ? rc.slice(0, 4) : (m ? m.getBaseColorFactor() : [.6, .6, .6, 1]).map((v, i) => tint && i < 3 ? v * tint[0] : v), es = m?.getExtension('KHR_materials_emissive_strength')?.getEmissiveStrength() ?? 1;
      let ef = m && !(set.noEmi && set.noEmi.test(m.getName())) ? m.getEmissiveFactor().map((v) => v * es) : [0, 0, 0], ek = 0;
      // emi：[[材質名, 顏色（null 照原檔）, 燈種]…]：燈種是 _EMI 的 w（頁面 26-glb.js：0 照 uM.z、1 頭燈 uM.x、2 煞車 uM.y），列車的窗燈與頭燈分開開關
      const er = set.emi && m && set.emi.find(([re]) => re.test(m.getName()));
      if (er) { if (er[1]) ef = er[1]; ek = er[2]; }
      // metalMax（第四輪）：整組的金屬度上限（原檔多半標 metallic 1、靠金屬粗糙貼圖分區，這條管線不留那張貼圖）；沒寫就和以前一樣
      const pbr = [rc && rc[4] != null ? rc[4] : Math.max(m ? m.getRoughnessFactor() : .8, tint ? tint[1] : 0), set.win ? 0 : Math.min(m ? m.getMetallicFactor() : 0, tint ? tint[2] ?? set.metalMax ?? 1 : set.metalMax ?? 1), 0, 0];
      const P = [], N = [], U = [], C = [], B = [], E = [], I = [], W = [];
      const vert = (p, i, w) => {
        P.push(p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]); N.push(p.nor[i * 3], p.nor[i * 3 + 1], p.nor[i * 3 + 2]);
        U.push(p.uv ? p.uv[i * 2] : 0, p.uv ? p.uv[i * 2 + 1] : 0);
        C.push(bc[0], bc[1], bc[2], m && m.getAlphaMode() === 'BLEND' ? bc[3] : 1); B.push(...pbr); E.push(...ef, ek);
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
      // simplifyMat（第四輪）：[[材質名, 比例, 誤差, 'sloppy']…] 只減這些材質（樹幹），葉片卡不動；用掉的頂點重新編號。
      // 第四個是 'sloppy' 就不管拓撲硬減（貨櫃這種 UV 接縫很多、一般減面減不下去的箱子）
      const sm = set.simplifyMat && m && set.simplifyMat.find(([re]) => re.test(m.getName()));
      if (sm && I.length > 300) {
        const tgt = Math.max(36, Math.floor(I.length * sm[1] / 3) * 3);
        const [ix] = sm[3] === 'sloppy' ? MeshoptSimplifier.simplifySloppy(Uint32Array.from(I), Float32Array.from(P), 3, null, tgt, sm[2] ?? .01)
          : MeshoptSimplifier.simplify(Uint32Array.from(I), Float32Array.from(P), 3, tgt, sm[2] ?? .01, sm[3] === 'permissive' ? ['Permissive'] : []);   // 'permissive'：允許跨 UV 接縫收合
        const map = new Map(), keep = [];
        const nI = Array.from(ix, (v) => { if (!map.has(v)) { map.set(v, keep.length); keep.push(v); } return map.get(v); });
        const pick = (a, n) => keep.flatMap((v) => a.slice(v * n, v * n + n));
        const [P2, N2, U2, C2, B2, E2, W2] = [pick(P, 3), pick(N, 3), pick(U, 2), pick(C, 4), pick(B, 4), pick(E, 4), W.length ? pick(W, 1) : []];
        for (const [a, b] of [[P, P2], [N, N2], [U, U2], [C, C2], [B, B2], [E, E2], [W, W2], [I, nI]]) { a.length = 0; for (const v of b) a.push(v); }
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
  if (set.board) await emit('board', await boardSrc(set), { w: set.board.w, d: 0, h: set.board.h });
  for (const src of sources) {
    const doc = await io.read(resolve(set.src ? resolve(root, set.src) : SRC, src.file + '.glb'));
    const info = doc.getRoot().getAsset().extras || {};
    credits.push({ file: src.file, title: info.title, author: info.author, license: info.license, source: info.source });
    let prims = collect(doc);
    if (src.drop) prims = prims.filter((p) => !src.drop.test(p.node) && !src.drop.test(p.mat ? p.mat.getName() : ''));
    if (src.only) {   // 只留路徑裡有節點符合的 primitive；inst：同一個原件擺了好幾份時只取第幾份（照路徑到那個節點為止分）
      const key = (p) => { const seg = p.path.split('/'); return seg.slice(0, seg.findIndex((n) => src.only.test(n)) + 1).join('/'); };
      prims = prims.filter((p) => p.path.split('/').some((n) => src.only.test(n)));
      if (src.inst != null) { const ks = [...new Set(prims.map(key))]; prims = prims.filter((p) => key(p) === ks[src.inst]); }
    }
    if (set.dropPath) prims = prims.filter((p) => !set.dropPath.test(p.path));   // 依祖先節點名（整條路徑）拿掉車、路燈、路面
    if (set.heavy) prims = prims.map((p) => {   // [路徑, 比例]：面數特別高的小零件（冷氣室外機、路燈）單獨大幅減面，其他照整組的 simplify
      if (!set.heavy[0].test(p.path) || p.idx.length < 90) return p;
      const [ix] = MeshoptSimplifier.simplify(Uint32Array.from(p.idx), Float32Array.from(p.pos), 3, Math.max(36, Math.floor(p.idx.length * set.heavy[1] / 3) * 3), .08);
      return ix.length ? subPrim(p, ix) : null;
    }).filter(Boolean);
    const sloppy = src.sloppy ?? set.sloppy;   // 物件自己的比例優先（同一組裡面數差很多的原檔）
    if (src.seam) prims = mergePrims(prims);   // 原檔照 16 位元索引切成好幾塊、塊與塊之間不共用頂點：先併回一塊，減面才不會沿著切線裂開
    if (sloppy && sloppy < 1) prims = prims.map((p) => {   // 照片掃描：UV 接縫多到 simplify 減不下去，允許跨接縫收合（Permissive）減到這個比例（遠景與地標用）
      if (p.idx.length < 300) return p;
      // seam：不跨接縫（UV 不同的頂點不收合），近看的掃描不會出現一塊塊貼錯的碎斑，代價是減不到那麼少（誤差放寬到 err）。
      // 先把位置與 UV 都相同的頂點併成一個（原檔每個三角形各自一份頂點時，減面會把每條邊當成外緣各自收合，裂出一個個小洞）
      if (src.seam) p = weldPrim(p);
      const [ix] = src.seam ? MeshoptSimplifier.simplifyWithAttributes(Uint32Array.from(p.idx), Float32Array.from(p.pos), 3, p.uv ? Float32Array.from(p.uv) : new Float32Array(p.cnt * 2), 2, [1, 1], null, Math.max(60, Math.floor(p.idx.length * sloppy / 3) * 3), src.seam)
        : MeshoptSimplifier.simplify(Uint32Array.from(p.idx), Float32Array.from(p.pos), 3, Math.max(60, Math.floor(p.idx.length * sloppy / 3) * 3), .05, ['Permissive']);
      return ix.length ? subPrim(p, ix) : null;
    }).filter(Boolean);
    if (set.keep) prims = prims.filter((p) => set.keep(p.node));
    const dropB = src.dropBox || set.dropBox;   // 物件自己的 dropBox 優先（同一組裡別的物件不受影響）
    if (dropB) prims = prims.map((p) => {   // 原檔座標的盒子 [x0, x1, y0, y1, z0, z1, 材質]：做成立體字的真實商標整塊拿掉
      const boxes = dropB.filter((b) => !b[6] || (p.mat && b[6].test(p.mat.getName())));
      if (!boxes.length) return p;
      const ix = [];
      for (let t = 0; t < p.idx.length; t += 3) {
        let x = 0, y = 0, z = 0; for (let k = 0; k < 3; k++) { x += p.pos[p.idx[t + k] * 3] / 3; y += p.pos[p.idx[t + k] * 3 + 1] / 3; z += p.pos[p.idx[t + k] * 3 + 2] / 3; }
        if (!boxes.some((b) => x > b[0] && x < b[1] && y > b[2] && y < b[3] && z > b[4] && z < b[5])) ix.push(p.idx[t], p.idx[t + 1], p.idx[t + 2]);
      }
      return ix.length === p.idx.length ? p : ix.length ? subPrim(p, ix) : null;
    }).filter(Boolean);
    if (src.band) prims = prims.map((p) => bandPrim(p, src.band[0], src.band[1])).filter(Boolean);
    if (src.simp) prims = prims.map((p) => {   // [比例, 誤差]：這個物件自己減面（塔吊桅桿一節要重複幾十次，格子桿件減到三分之一）
      if (p.idx.length < 90) return p;
      const [ix] = MeshoptSimplifier.simplify(Uint32Array.from(p.idx), Float32Array.from(p.pos), 3, Math.max(36, Math.floor(p.idx.length * src.simp[0] / 3) * 3), src.simp[1]);
      return ix.length ? subPrim(p, ix) : null;
    }).filter(Boolean);
    if (set.seg) {
      // 依材質合併、跨整片城市的網格：高於 minY 的三角形投影到 xz 格網（res 一格），相連的格子算同一棟（或貼在一起的一群）。
      // 矩形 cells 遇到 L 形的樓會切到隔壁，這裡每個三角形照重心那一格的連通區分。segPick(群) 回傳 null 不要、或 { rot } 覆寫轉向
      const { res = 1, minY = 1.5, minArea = 40 } = set.seg, tris = [];
      let mn = [1e9, 1e9], mx = [-1e9, -1e9];
      for (const [pi, p] of prims.entries()) for (let t = 0; t < p.idx.length; t += 3) {
        const v = [0, 1, 2].map((k) => p.idx[t + k] * 3);
        const ymax = Math.max(...v.map((i) => p.pos[i + 1])); if (ymax < minY) continue;
        const xs = v.map((i) => p.pos[i]), zs = v.map((i) => p.pos[i + 2]);
        const b = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
        tris.push({ pi, t, b, y: ymax, big: (b[1] - b[0]) * (b[3] - b[2]) > 4000 });
        mn = [Math.min(mn[0], b[0]), Math.min(mn[1], b[2])]; mx = [Math.max(mx[0], b[1]), Math.max(mx[1], b[3])];
      }
      const W = Math.ceil((mx[0] - mn[0]) / res) + 2, H = Math.ceil((mx[1] - mn[1]) / res) + 2, occ = new Float32Array(W * H);
      const gx = (x) => Math.floor((x - mn[0]) / res), gz = (z) => Math.floor((z - mn[1]) / res);
      for (const o of tris) if (!o.big) for (let z = gz(o.b[2]); z <= gz(o.b[3]); z++) for (let x = gx(o.b[0]); x <= gx(o.b[1]); x++) occ[z * W + x] = Math.max(occ[z * W + x], o.y);
      const lab = new Int32Array(W * H).fill(-1), comps = [];
      for (let i = 0; i < W * H; i++) {
        if (!occ[i] || lab[i] >= 0) continue;
        const st = [i]; lab[i] = comps.length; let a = 0, x0 = W, x1 = 0, z0 = H, z1 = 0, h = 0;
        while (st.length) {
          const j = st.pop(), x = j % W, z = (j / W) | 0; a++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); h = Math.max(h, occ[j]);
          for (const k of [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, z > 0 ? j - W : -1, z < H - 1 ? j + W : -1]) if (k >= 0 && occ[k] && lab[k] < 0) { lab[k] = comps.length; st.push(k); }
        }
        comps.push({ a: a * res * res, c: [mn[0] + x0 * res, mn[0] + (x1 + 1) * res, mn[1] + z0 * res, mn[1] + (z1 + 1) * res].map((v) => +v.toFixed(1)), h: +h.toFixed(1), ix: prims.map(() => []) });
      }
      for (const o of tris) {
        const p = prims[o.pi]; let x = 0, z = 0;
        for (let k = 0; k < 3; k++) { x += p.pos[p.idx[o.t + k] * 3] / 3; z += p.pos[p.idx[o.t + k] * 3 + 2] / 3; }
        const l = lab[gz(z) * W + gx(x)]; if (l >= 0) comps[l].ix[o.pi].push(p.idx[o.t], p.idx[o.t + 1], p.idx[o.t + 2]);
      }
      const keep = comps.filter((c) => c.a >= minArea).sort((p, q) => p.c[2] - q.c[2] || p.c[0] - q.c[0]);
      let n = 0;
      for (const c of keep) {
        const pick = set.segPick ? set.segPick(c) : {};
        if (!pick) continue;
        const ps = c.ix.map((ix, pi) => ix.length ? subPrim(prims[pi], ix) : null).filter(Boolean);
        const rot = pick.rot ?? (c.c[3] - c.c[2] > c.c[1] - c.c[0] ? 1 : 0);   // 長邊朝街（+z）
        const dims = place(ps, { ...set, rot }, set.scale ?? 1);
        if (set.curtain) curtainUV(ps, set.curtain);
        await emit(`${set.prefix}_${String(++n).padStart(2, '0')}`, ps, { ...dims, src: c.c.join(',') });
      }
      continue;
    }
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
    if (!set.split) {
      if (src.renorm) renormal(prims);
      const dims = place(prims, src);
      if (src.hf) dims.hf = heightField(prims, ...src.hf);   // 崖壁之前量：只量掃描本身的地面
      if (src.line) dims.line = trackLine(prims, src.line);
      if (src.skirt) { prims = addSkirt(prims, src.skirt); if (src.skirt.ring) dims.ring = prims.ring; }
      if (src.tron) {   // 光格島：島面、岸壁、步行格與車道圖（tools/walkgrid.mjs）
        const mat = (n, c) => new Document().createMaterial(n).setBaseColorFactor([...c, 1]).setRoughnessFactor(1).setMetallicFactor(0).setDoubleSided(true);
        const r = tronData(prims, { ...src.tron, file: resolve(OUT, set.out + '.walk.bin'), mat });
        prims = r.prims; Object.assign(dims, r.dims);
      }
      if (src.glow) dims.glow = await glowPts(prims, src.glow);
      await emit(src.id, prims, dims); continue;
    }
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
    meshopt({ encoder: MeshoptEncoder, level: set.meshopt ?? 'medium' }),   // 'high'：法線與位置用 meshopt 的濾波量化，檔案小三到四成
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
const built = {};
for (const set of SETS) {
  if (only.length && !only.includes(set.out)) continue;
  built[set.out] = await build(set);
}
// 寫入前才讀清單再合併：同時有兩個 props.mjs 在跑（各做不同的組）時，不會互相蓋掉對方剛寫進去的組
const manifest = { ...(existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}), ...built };
const ordered = {}; for (const s of SETS) if (manifest[s.out]) ordered[s.out] = manifest[s.out];
for (const k of Object.keys(manifest)) if (!ordered[k]) ordered[k] = manifest[k];   // 另一個程序剛加、這份 SETS 還沒有的組也留著
// foot（tools/foot.mjs 量的碰撞矩形）每個矩形寫成一行，和 foot.mjs 寫出來的格式一樣
// 光格島（tools/walkgrid.mjs）的大陣列：岸線、車道圖、家具位置整個擠成一行，不然 props.json 會多上萬行
const TIGHT = new Set(['edges', 'graph', 'vend', 'bench', 'tree', 'lamp', 'cycle', 'pool', 'shop', 'lift']), tight = [];
const tightOf = (k, v) => { if (!TIGHT.has(k) || !(Array.isArray(v) || k === 'graph' && v && v.nodes)) return v; tight.push(JSON.stringify(v)); return `@@tight${tight.length - 1}@@`; };
writeFileSync(manifestPath, JSON.stringify(ordered, tightOf, 1).replace(/"@@tight(\d+)@@"/g, (_, i) => tight[i]).replace(/\[\n\s*(-?[\d.]+),\n\s*(-?[\d.]+),\n\s*(-?[\d.]+),\n\s*(-?[\d.]+),\n\s*(-?[\d.]+)\n\s*\]/g, '[$1, $2, $3, $4, $5]') + '\n');
