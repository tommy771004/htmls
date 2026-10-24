// ═══ 實車模型：Sketchfab 的 GLB 經 tools/cars.mjs 處理成 assets/260/<id>.glb，規格在 assets/260/cars.json（打包進頁面） ═══
// 以網站伺服器開啟時才下載；以檔案開啟、或下載失敗，就一直用 proxy 指定的程式建模車身（機車用 Hanzo）頂替，頁面照樣能玩。
// 材質沿用 uber 的光照、霧、倒影裁切與遮擋淡出，底色、粗糙度、金屬、清漆與自發光改讀 GLB 的頂點屬性與貼圖。
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import GLB_SPEC from '../../../../assets/260/cars.json';

const GLB_ON = /^https?:$/.test(location.protocol);
const GLB_BASE = new URL('../assets/260/', location.href).href;
const glbReport = { on: GLB_ON, loaded: [], failed: [] };
const STARTER = 'ae86', STREET_BIKE = 'zx6r';   // 開場的座駕與停在路邊的機車；車行與車庫只賣實車模型

// price 美元；vmax m/s、eng 加速、grip 抓地（同 CARS）；proxy 是沒下載到模型時的替身；fb 是替身的車色
const GLB_CARS = [
  ['e92', { name: 'BMW M3 (E92)', cls: '2010 · 4.0 V8 雙門', price: 62000, fb: 0x0b4fd0, proxy: 'ronin', vmax: 78, eng: 15, grip: 9.2,
    tag: '最後一代自然進氣 V8 的 M3，轉到八千轉還在加速。寬體套件、碳纖維車頂與鴨尾。' }],
  ['m3c', { name: 'BMW M3 Competition', cls: '2021 G80 · 雙渦輪直六四門', price: 98000, fb: 0xc81010, proxy: 'lucerna', vmax: 80, eng: 16.5, grip: 9.4,
    tag: '四門房車的外表、510 匹的心臟。這台加了寬體套件、鍛造碳引擎蓋與巨大尾翼，載得了朋友也甩得了尾。' }],
  ['m4wb', { name: 'BMW M4 寬體改裝', cls: 'G82 · 寬體套件', price: 165000, fb: 0x8a7a50, proxy: 'ronin', vmax: 84, eng: 17.5, grip: 9.8,
    tag: '直立大鼻孔、外擴的葉子板與低趴的車身，香檳金烤漆在霓虹底下會變色。' }],
  ['m3gtr', { name: 'BMW M3 GTR (GT2)', cls: '2001 E46 · ALMS 賽車', price: 420000, fb: 0x6a1018, proxy: 'ronin', vmax: 82, eng: 18, grip: 10.4,
    tag: '美國 ALMS 傳奇的 22 號車，V8 賽車引擎塞進 E46 車身。原廠彩繪，CHROME WORKS 不能換色。' }],
  ['m3t24', { name: 'BMW M3 Touring 24H', cls: '2026 · 耐久賽旅行車', price: 560000, fb: 0x2a3a8a, proxy: 'lucerna', vmax: 80, eng: 18.5, grip: 10.6,
    tag: '紐柏林 24 小時的旅行車賽車，防滾籠、賽車座椅、Shell Helix 彩繪。原廠彩繪，不能換色。' }],
  ['m4gt3', { name: 'BMW M4 GT3 EVO', cls: '2025 G82 · GT3 賽車', price: 640000, fb: 0x15161a, proxy: 'mamba', vmax: 83, eng: 19, grip: 10.8,
    tag: 'GT3 規格的 M4：寬體、鵝頸尾翼、中央鎖定輪框。消光黑車身，可以到 CHROME WORKS 換色。' }],
  ['gt3rs', { name: 'Porsche 911 GT3 RS', cls: '992 · 自然進氣水平對臥六缸', price: 330000, fb: 0x9a9680, proxy: 'kanto', vmax: 86, eng: 19.5, grip: 10.6,
    tag: '九千轉紅線的公路賽車，鵝頸尾翼高過車頂。橡木綠金屬漆配橘色輪框，原廠塗裝不能換色。' }],
  ['gt3r', { name: 'Porsche 911 GT3 R', cls: '2024 992 · GT3 賽車', price: 720000, fb: 0x6a5ab0, proxy: 'kanto', vmax: 84, eng: 19.5, grip: 11,
    tag: '純賽車，沒有車牌也沒有冷氣。抓地力是整間車行最好的一台。原廠彩繪，不能換色。' }],
  ['s1krr', { name: 'BMW S1000RR', cls: '千 cc 超級跑車機車', price: 24000, fb: 0xc81010, proxy: 'hanzo', bike: true, vmax: 80, eng: 17, grip: 7.4, seat: [-.06, -.2],
    tag: '兩百匹的四缸超跑機車，壓車過彎比任何一台車都快，只是下雨天要小心。' }],
  ['s1krr19', { name: 'BMW S1000RR (2019)', cls: 'M 套件 · 千 cc 超跑機車', price: 29000, fb: 0xd8d8dc, proxy: 'hanzo', bike: true, vmax: 82, eng: 18, grip: 7.6, seat: [-.06, -.2],
    tag: '第二代 S1000RR，M 套件的白藍紅塗裝、碳纖維輪框與 Akrapovič 排氣管。' }],
  // 第二批：日系、歐系、超跑、美式與機車
  ['ae86', { name: 'Toyota Sprinter Trueno (AE86)', cls: '1983 · 4A-G 後驅掀背', price: 38000, fb: 0xe8e8e4, proxy: 'kestrel', vmax: 62, eng: 10, grip: 8.4,
    tag: '黑白熊貓配色、可升降頭燈，門上印著豆腐店的字樣。馬力不大，但輕、後驅、好甩。原廠塗裝，不能換色。' }],
  ['rx7', { name: 'Mazda RX-7 (FD3S)', cls: '1992 · 13B 雙渦輪轉子', price: 85000, fb: 0x1f5fa8, proxy: 'ronin', vmax: 79, eng: 15.5, grip: 9.6,
    tag: '整台車只有曲線沒有直線，轉子引擎小到可以塞在前軸後面，前後配重五五開。' }],
  ['supra', { name: 'Toyota Supra (A80)', cls: '1993 · 2JZ 雙渦輪直六', price: 110000, fb: 0xd86a1a, proxy: 'ronin', vmax: 82, eng: 16, grip: 9.2,
    tag: '圓潤的長車頭、拱形尾翼與四顆圓尾燈。2JZ 引擎出了名的耐操，改到上千匹也不會散。' }],
  ['r34', { name: 'Nissan Skyline GT-R (R34)', cls: '1999 · RB26 雙渦輪四驅', price: 135000, fb: 0x1f4fb8, proxy: 'ronin', vmax: 80, eng: 16.5, grip: 9.8,
    tag: '方正的肩線、可調尾翼與四顆圓尾燈，ATTESA 四驅讓它在雨夜的街上照樣出得了彎。' }],
  ['nsx', { name: 'Honda NSX', cls: '1990 · 中置 V6', price: 140000, fb: 0xf0f0ee, proxy: 'meridian', vmax: 80, eng: 15, grip: 9.8,
    tag: '全鋁車身、戰鬥機座艙般的低矮視野，中置 V6 轉到八千轉。這台換了一組粉紫色的網狀輪框。' }],
  ['r35', { name: 'Nissan GT-R (R35) 寬體', cls: '雙渦輪 V6 四驅 · 寬體套件', price: 180000, fb: 0x6a6e74, proxy: 'ronin', vmax: 86, eng: 18, grip: 10.2,
    tag: '外擴的鉚釘葉子板、前下巴與高腳尾翼。四驅雙離合起步，紅燈一跳綠就已經在下個路口了。' }],
  ['p930', { name: 'Porsche 911 Turbo (930)', cls: '1975 · 水平對臥六缸渦輪', price: 160000, fb: 0x1f5fa8, proxy: 'kanto', vmax: 78, eng: 15, grip: 8.6,
    tag: '鯨尾尾翼、外擴後葉子板，七〇年代的渦輪遲滯：先是什麼都沒有，然後一口氣全部來。' }],
  ['rwb', { name: 'Porsche 911 RAUH-Welt', cls: '964 · RWB 寬體改裝', price: 260000, fb: 0xf0f0ee, proxy: 'kanto', vmax: 82, eng: 16.5, grip: 9.8,
    tag: '手工切開的葉子板、鉚上去的寬體與兩層的巨大尾翼，彩虹條紋的復古賽車彩繪。原廠彩繪，不能換色。' }],
  ['e34', { name: 'BMW 5 系列 (E34) 低趴', cls: '1990 · 直六四門房車', price: 28000, fb: 0x1f5fa8, proxy: 'lucerna', vmax: 66, eng: 11, grip: 8.6,
    tag: '九〇年代的四門房車，降到幾乎貼地、外傾的網狀輪框。整間車行最便宜的一台實車。' }],
  ['evo190', { name: 'Mercedes-Benz 190E EVO', cls: '四門房車 · 房車賽認證版', price: 120000, fb: 0x1a1b1e, proxy: 'lucerna', vmax: 76, eng: 14.5, grip: 9.4,
    tag: '為了房車賽而生的四門車：寬體、可調尾翼與十六氣門直四。黑色原廠塗裝，不能換色。' }],
  ['m4csl', { name: 'BMW M4 CSL', cls: '2023 G82 · 輕量化直六', price: 190000, fb: 0x1f5fa8, proxy: 'ronin', vmax: 84, eng: 18, grip: 10.2,
    tag: '拆掉後座、換上碳纖維引擎蓋與車頂，比一般 M4 輕一百公斤，雷射尾燈在夜裡是兩道紅色的刀。' }],
  ['chall', { name: 'Dodge Challenger SRT', cls: '機械增壓 HEMI V8', price: 72000, fb: 0x4a2a7a, proxy: 'bulldog', vmax: 74, eng: 16, grip: 7.8,
    tag: '紫色車身、消光黑引擎蓋，增壓器的嘯聲隔兩條街都聽得到。後輪很愛冒煙。原廠塗裝，不能換色。' }],
  ['police', { name: '退役警車', cls: '前置 V8 巡邏車', price: 45000, fb: 0x1a1b1e, proxy: 'lucerna', vmax: 70, eng: 13, grip: 8.2,
    tag: '從市警局標售出來的巡邏車，推撞桿、警示燈條和車頂編號都還在。開出去路人會自動讓路。原廠塗裝，不能換色。' }],
  ['zr1', { name: 'Chevrolet Corvette ZR1', cls: '2019 C7 · 增壓 V8', price: 210000, fb: 0x1f5fa8, proxy: 'mamba', vmax: 90, eng: 18.5, grip: 9.8,
    tag: '引擎蓋中間開了一個洞讓增壓器探出頭來，後面是高腳碳纖維尾翼。美國最後一代前置引擎的 Corvette。' }],
  ['f40', { name: 'Ferrari F40', cls: '1987 · 雙渦輪 V8 中置', price: 900000, fb: 0xc8141c, proxy: 'saetta', vmax: 90, eng: 18.5, grip: 9.6,
    tag: '壓克力百葉後窗、拉索開門、沒有音響也沒有地毯。創辦人生前最後一台親自批准的車。' }],
  ['sf90', { name: 'Ferrari SF90 XX Stradale', cls: '2024 · 插電 V8 四驅', price: 980000, fb: 0xc8141c, proxy: 'furia', vmax: 98, eng: 21, grip: 10.8,
    tag: '一千多匹的油電動力、前軸兩顆電動馬達，車尾一片固定式大尾翼。整間車行加速最暴力的一台。' }],
  ['p1', { name: 'McLaren P1', cls: '2013 · 油電 V8 超跑', price: 1100000, fb: 0xe8782a, proxy: 'halcyon', vmax: 100, eng: 21.5, grip: 10.6,
    tag: '油電三雄之一，車身像被風吹出來的一層皮，賽道模式下車身會降低、尾翼會升起。' }],
  // 第三批：amogusstrikesback2 的三台超跑
  ['svj', { name: 'Lamborghini Aventador SVJ', cls: 'LP 770-4 · 自然進氣 V12 四驅', price: 520000, fb: 0x1f4fd8, proxy: 'furia', vmax: 100, eng: 21.9, grip: 10.2,
    tag: '七百七十匹的自然進氣 V12，剪刀門一掀整條街都會回頭。主動氣流尾翼過彎時往內側壓，紐柏林北環曾經是量產車最快。原廠塗裝，不能換色。' }],
  ['evija', { name: 'Lotus Evija', cls: '2020 · 四馬達純電超跑', price: 2100000, fb: 0x1f4fd8, proxy: 'halcyon', vmax: 100, eng: 21.3, grip: 10.5,
    tag: '兩千匹的純電超跑，四顆馬達各管一個輪子，車尾兩個大洞讓氣流直接穿過車身。整間車行最貴的一台，安靜得像一陣風。原廠塗裝，不能換色。' }],
  ['spano', { name: 'GTA Spano', cls: '2015 · 雙渦輪 V10 中置', price: 900000, fb: 0xf0f0ee, proxy: 'saetta', vmax: 100, eng: 21.3, grip: 10,
    tag: '西班牙小廠手工打造的超跑，碳纖維、凱夫拉與石墨烯車身，雙渦輪 V10 推到九百匹，極速是整間車行最高的。原廠塗裝，不能換色。' }],
  ['f8', { name: 'Ferrari F8 Tributo', cls: '2019 · 雙渦輪 V8 中置', price: 280000, fb: 0xf0f0ee, proxy: 'saetta', vmax: 100, eng: 21.3, grip: 9.8,
    tag: '向史上最強的 V8 致敬：七百二十匹、渦輪幾乎沒有遲滯，車尾的 S-Duct 把氣流從引擎蓋中間導上去壓住車頭。原廠塗裝，不能換色。' }],
  ['scg', { name: 'SCG 003S', cls: 'Glickenhaus · 公路版耐久賽車', price: 1800000, fb: 0xf0f0ee, proxy: 'mamba', vmax: 100, eng: 21.4, grip: 11.1,
    tag: '紐約小廠把紐柏林 24 小時的賽車掛上車牌，鷗翼門、碳纖維單體殼與整片底盤下壓力。過彎抓地力是公路車裡的怪物。原廠塗裝，不能換色。' }],
  ['p9x8', { name: 'Peugeot 9X8', cls: '2022 · Le Mans Hypercar 油電賽車', price: 3200000, fb: 0x1f4fd8, proxy: 'halcyon', vmax: 100, eng: 21.3, grip: 12.1,
    tag: '沒有尾翼的利曼原型賽車，下壓力全靠車身與底盤。不是公路車，車行說是「收藏展示用」，但油箱是滿的。原廠彩繪，不能換色。' }],
  ['c110', { name: 'Bugatti Centodieci', cls: '2020 · 四渦輪 W16 四驅', price: 8900000, fb: 0x1f4fd8, proxy: 'furia', vmax: 100, eng: 24.6, grip: 10.5,
    tag: '致敬九〇年代 EB110 的限量十台，一千六百匹的 W16、四顆渦輪。整間車行最貴、加速最猛的一台。原廠塗裝，不能換色。' }],
  ['nevera', { name: 'Rimac Nevera', cls: '2021 · 四馬達純電超跑', price: 2400000, fb: 0x1f4fd8, proxy: 'halcyon', vmax: 110, eng: 28.4, grip: 10.7,
    tag: '克羅埃西亞的純電怪物：四顆馬達、一千九百多匹，零到一百不到兩秒，極速破四百。兩噸多的車重，煞車和輪胎都要很有自信。原廠塗裝，不能換色。' }],
  ['f488c', { name: 'Ferrari 488 Challenge Evo', cls: '2020 · 單一車型賽專用賽車', price: 450000, fb: 0x1f4fd8, proxy: 'saetta', vmax: 100, eng: 20.8, grip: 11.9,
    tag: '原廠單一車型賽的賽車：防滾籠、賽車座椅、光頭胎與大尾翼，沒有冷氣也沒有車牌。原廠彩繪，不能換色。' }],
  ['sc20', { name: 'Lamborghini SC20', cls: '2020 · 無擋風玻璃 V12 單一訂製車', price: 3500000, fb: 0x1f4fd8, proxy: 'furia', vmax: 100, eng: 21.3, grip: 10.2,
    tag: '原廠賽車部門替一位客人做的一台：開放座艙、沒有擋風玻璃，SVJ 的 V12 配上 GT3 賽車的尾翼。雨夜開它會濕透。原廠塗裝，不能換色。' }],
  ['c63dtm', { name: 'Mercedes-AMG C63 DTM', cls: 'DTM 房車賽 · 前置 V8 賽車', price: 780000, fb: 0x1f4fd8, proxy: 'mamba', vmax: 100, eng: 20.8, grip: 12.1,
    tag: '德國房車大師賽的賽車：外表還看得出是 C 級雙門，底下是碳纖維單體殼、V8 與巨大的尾翼。過彎抓地力是整間車行的頂點。原廠彩繪，不能換色。' }],
  ['energ', { name: 'Mercedes-Benz Vision Ener-G-Force', cls: '2012 · 氫燃料電池越野概念車', price: 1200000, fb: 0x1f3a7a, proxy: 'bulldog', vmax: 70, eng: 10.5, grip: 8.8,
    tag: '洛杉磯車展的設計概念車：四輪輪轂馬達、車頂的儲水槽與越野燈架。這台沒有量產，性能數字是車行自己定的。原廠塗裝，不能換色。' }],
  ['spano8', { name: 'GTA Spano 銀白版', cls: '2015 · 雙渦輪 V10 中置', price: 920000, fb: 0xe8e8e4, proxy: 'saetta', vmax: 100, eng: 21.3, grip: 10,
    tag: '同一台西班牙超跑的另一份模型：銀白車身、碳纖維下擺與深灰飾條，比藍白那台低調一點。原廠塗裝，不能換色。' }],
  ['mosler', { name: 'Mosler MT900 GTR XX', cls: '「Land Shark」雙渦輪 V8 改裝', price: 1250000, fb: 0x1f4fd8, proxy: 'mamba', vmax: 100, eng: 23.1, grip: 10.7,
    tag: '美國小廠的賽車底盤塞進雙渦輪 V8，綽號「陸上鯊魚」，直線加速專門拿來破紀錄。馬力是改裝車常見的說法，不是原廠數字。原廠塗裝，不能換色。' }],
  ['csl3', { name: 'BMW 3.0 CSL Hommage', cls: '2015 · 向 E9 蝙蝠車致敬的概念車', price: 850000, fb: 0x1f4fd8, proxy: 'ronin', vmax: 80, eng: 16.4, grip: 9.6,
    tag: '致敬七〇年代賽道上的「蝙蝠車」：碳纖維車身、巨大的鴨尾與格柵。這台沒有量產，性能數字是車行自己定的。原廠塗裝，不能換色。' }],
  ['slk55', { name: 'Mercedes-Benz SLK 55 AMG', cls: '2012 R172 · 自然進氣 V8 硬頂敞篷', price: 90000, fb: 0x1f4fd8, proxy: 'meridian', vmax: 70, eng: 15.5, grip: 9.2,
    tag: '短軸距的硬頂敞篷跑車塞進五點五升 V8，排氣聲比外表兇得多。車頂收進行李廂只要二十秒。原廠塗裝，不能換色。' }],
  ['giulietta', { name: 'Alfa Romeo Giulietta Veloce', cls: '2016 · 1750 TBi 前驅掀背', price: 42000, fb: 0x1f4fd8, proxy: 'lucerna', vmax: 66, eng: 13.1, grip: 9,
    tag: '義大利的五門掀背，盾形水箱護罩與藏在 C 柱的後門把手。前輪驅動，不愛甩尾，但窄巷裡很好開。原廠塗裝，不能換色。' }],
  ['charger', { name: 'Dodge Charger SRT8 Police', cls: '前置 HEMI V8 · 追緝警車', price: 68000, fb: 0x1a1b1e, proxy: 'bulldog', vmax: 70, eng: 13.4, grip: 8.9,
    tag: '黑白相間的追緝警車，推撞桿、車頂警示燈條與 PURSUIT 911 塗裝都還在。重、硬、耐撞。原廠塗裝，不能換色。' }],
  ['zx6r', { name: 'Kawasaki Ninja ZX-6R', cls: '636 cc 四缸仿賽', price: 16000, fb: 0x3aa83a, proxy: 'hanzo', bike: true, vmax: 76, eng: 15.5, grip: 7.8, seat: [-.06, -.2],
    tag: '萊姆綠的中量級仿賽，轉速拉到一萬六。比千 cc 好駕馭，在窄巷裡也鑽得進去。' }],
  ['v4', { name: 'Ducati Panigale V4', cls: '1100 cc V4 超跑機車', price: 32000, fb: 0xc8141c, proxy: 'hanzo', bike: true, vmax: 84, eng: 18.5, grip: 7.6, seat: [-.06, -.2],
    tag: '從 MotoGP 賽車下放的 V4 引擎、單搖臂與紅色車殼。兩百多匹，比很多跑車都快。' }],
];
// ─── 原廠規格（公開規格與媒體實測的概數；賽車是規格書的最低車重與 BoP 前後的馬力）───
// [車重 kg（機車是含油）, 馬力 PS, 0–100 km/h 秒, 極速 km/h（有電子限速的照限速）, 側向抓地 g（繞圈測試）, 100–0 煞車距離 m, 驅動：R 前置後驅／M 中後置後驅／F 前置前驅／A 四驅／B 機車, 備註：cage 防滾籠賽車、pol 警用強化]
const CAR_REAL = {
  e92: [1655, 420, 4.8, 250, .95, 36, 'R'], m3c: [1730, 510, 3.9, 250, 1.0, 34, 'R'], m4wb: [1725, 510, 3.9, 290, 1.02, 34, 'R'],
  m3gtr: [1120, 470, 3.6, 290, 1.45, 30, 'R', 'cage'], m3t24: [1450, 550, 3.6, 280, 1.4, 31, 'R', 'cage'], m4gt3: [1300, 590, 3.4, 290, 1.55, 29, 'R', 'cage'],
  gt3rs: [1450, 525, 3.2, 296, 1.2, 31, 'M'], gt3r: [1250, 565, 3.0, 290, 1.6, 29, 'M', 'cage'],
  s1krr: [204, 193, 2.9, 299, .9, 40, 'B'], s1krr19: [194, 207, 2.8, 303, .92, 39, 'B'],
  ae86: [940, 130, 8.5, 190, .8, 43, 'R'], rx7: [1260, 255, 5.3, 250, .9, 37, 'R'], supra: [1510, 280, 4.9, 250, .92, 37, 'R'],
  r34: [1540, 280, 4.9, 250, .95, 36, 'A'], nsx: [1350, 280, 5.7, 270, .92, 38, 'M'], r35: [1752, 570, 2.8, 315, 1.0, 33, 'A'],
  p930: [1300, 300, 5.4, 260, .86, 40, 'M'], rwb: [1290, 330, 4.8, 270, .95, 36, 'M'], e34: [1480, 192, 8.6, 228, .78, 42, 'R'],
  evo190: [1340, 235, 7.1, 250, .88, 39, 'R'], m4csl: [1625, 550, 3.7, 307, 1.05, 33, 'R'], chall: [2018, 717, 3.6, 315, .93, 36, 'R'],
  police: [1840, 250, 8.5, 209, .78, 44, 'R', 'pol'], zr1: [1615, 765, 3.0, 341, 1.1, 31, 'R'], f40: [1100, 478, 4.1, 324, .98, 37, 'M'],
  sf90: [1660, 1030, 2.3, 320, 1.15, 30, 'A'], p1: [1490, 916, 2.8, 350, 1.2, 30, 'M'],
  svj: [1675, 770, 2.8, 350, 1.2, 30, 'A'], evija: [1680, 2000, 2.9, 350, 1.25, 31, 'A'], spano: [1400, 900, 2.9, 370, 1.15, 31, 'M'],
  nevera: [2300, 1914, 2.0, 412, 1.3, 30, 'A'], f488c: [1385, 670, 3.0, 320, 1.6, 28, 'M', 'cage'], sc20: [1600, 770, 2.9, 350, 1.2, 30, 'A'], c63dtm: [1110, 500, 3.0, 280, 1.65, 25, 'R', 'cage'],
  energ: [2400, 400, 5.5, 200, .85, 38, 'A'],
  spano8: [1400, 900, 2.9, 370, 1.15, 31, 'M'], mosler: [1150, 1500, 2.6, 360, 1.3, 30, 'M'], csl3: [1400, 450, 4.2, 280, 1.05, 34, 'R'],   // Land Shark 的馬力是改裝車的說法；3.0 CSL Hommage 是概念車，數字自訂
  slk55: [1615, 421, 4.6, 250, .95, 35, 'R'], giulietta: [1395, 240, 6.0, 244, .9, 37, 'F'], charger: [1950, 370, 5.8, 240, .88, 38, 'R', 'pol'],   // Vision Ener-G-Force 是沒有動力規格的概念車：數字是自己定的越野休旅
  f8: [1435, 720, 2.9, 340, 1.1, 32, 'M'], scg: [1300, 811, 2.9, 350, 1.4, 29, 'M'], p9x8: [1030, 707, 2.9, 340, 1.65, 26, 'M', 'cage'], c110: [1976, 1600, 2.4, 380, 1.25, 31, 'A'],
  zx6r: [196, 130, 3.2, 260, .88, 41, 'B'], v4: [198, 214, 2.9, 299, .9, 38, 'B'],
};
// 換算成遊戲手感（城市尺度的街機手感，具名常數）：
//   極速 = 原廠 × TOP_K（再由 vmaxFor 反推推力歸零速度）；加速 eng = ENG0 + ENG_K·(27.8 / 0–100 秒)；抓地 = GRIP0 + GRIP_K·g（機車另一組）；
//   轉向 1.05·(1500 / 車重)^0.3（四驅 ×0.97）；手煞車 μ 後驅 .4、前驅 .5、四驅 .56（越重越不好甩）；耐久 HP0 + HP_KG·車重（防滾籠、警用另加）；煞車 16·(a / 10.5)^0.8
const TUNE = { TOP_K: .8, ENG0: 5.5, ENG_K: 1.65, GRIP0: 5.2, GRIP_K: 4.2, BGRIP0: 3.6, BGRIP_K: 4.6, HP0: 650, HP_KG: .32, HP_CAGE: 200, HP_POL: 300, RIDER: 80 };
function realTune(c, r) {
  const [kg, ps, t100, top, g, d100, dt, x] = r, bike = dt === 'B', m = kg + (bike ? TUNE.RIDER : 0);
  const eng = TUNE.ENG0 + TUNE.ENG_K * 27.8 / t100, kmh = top * TUNE.TOP_K;
  Object.assign(c, {
    real: { kg, ps, t100, top, g, d100, dt, x: x || '' }, kmh, eng: +eng.toFixed(2), vmax: +vmaxFor(kmh, eng).toFixed(2),
    grip: +(bike ? TUNE.BGRIP0 + TUNE.BGRIP_K * g : TUNE.GRIP0 + TUNE.GRIP_K * g).toFixed(2),
    m, turn: +(bike ? 1.5 * (280 / m) ** .3 : clamp(1.05 * (1500 / kg) ** .3 * (dt === 'A' ? .97 : 1), .8, 1.35)).toFixed(3),
    drift: +(bike ? .4 : (dt === 'A' ? .56 : dt === 'F' ? .5 : .4) * (kg / 1500) ** .25).toFixed(3),
    hp: Math.round(bike ? 380 + kg : TUNE.HP0 + TUNE.HP_KG * kg + (x === 'cage' ? TUNE.HP_CAGE : 0) + (x === 'pol' ? TUNE.HP_POL : 0)),
    brk: +(16 * (386 / d100 / 10.5) ** .8).toFixed(2),
  });
}
const shortLic = l => (l || '').replace(/\s*\(.*\)/, '').replace(/^CC-/, 'CC ').replace(/-(\d)/, ' $1');
const shortAuthor = a => (a || '').replace(/\s*\(.*\)/, '');
for (const [id, o] of GLB_CARS) {
  const s = GLB_SPEC[id];
  car(id, {
    ...o, glb: true, paint: null, paintable: !!s.paintable,
    len: s.len, w: s.w, wr: s.wr || .33, ww: o.bike ? [.12, .19] : [.27, .3], track: s.track || .8, fa: s.fa || 1.3, ra: s.ra || -1.3, rim: ['five', 0x9aa0a6],
    credit: `模型：${shortAuthor(s.author)} · ${shortLic(s.license)} · 非官方同人，與車廠無關`, source: s.source,
    db: s.db || null,   // tools/seats.mjs 量的駕駛座 [座椅高度, 往前偏移]（69-combat.js 的車窗射擊）
  });
  if (CAR_REAL[id]) realTune(CARS[id], CAR_REAL[id]);   // 每台車照原廠規格換算自己的極速、加速、抓地、車重、轉向、手煞車、耐久與煞車
}

// ─── 材質 ───
const GLB_VS = /* glsl */`
attribute vec4 color; attribute vec4 _pbr; attribute vec4 _emi; attribute float _win;
varying vec3 vW, vN; varying vec4 vCol, vPbr, vEmi; varying vec2 vUv; varying float vWin;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  vCol = color; vPbr = _pbr; vEmi = _emi; vWin = _win;
  #ifdef USE_MAP
  vUv = uv;
  #else
  vUv = vec2(0);
  #endif
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const GLB_FS = /* glsl */`
${GL_LIB}
uniform vec4 uM, uPaint; uniform sampler2D uMap, uEmiMap, uWinMap;
varying vec3 vW, vN; varying vec4 vCol, vPbr, vEmi; varying vec2 vUv; varying float vWin;
void main(){
  if (vW.y < uClipY) discard;
  #ifdef CUT
  if (vW.x > CUT.x && vW.x < CUT.y && vW.z > CUT.z && vW.z < CUT.w && vW.y < 3.9) discard;   // 拉開的落地窗（69-safehouse.js 的 cut）
  #endif
  if (uFocus.w > 0.) {
    vec3 ab = uFocus.xyz - uCam; float tt = clamp(dot(vW - uCam, ab) / dot(ab, ab), 0., 1.);
    float dd = length(vW - uCam - ab * tt), cd = length(vW - uCam);
    float fade = max(1. - smoothstep(.5, 1.6, cd), (1. - smoothstep(.45, 1., dd)) * step(tt, .8) * .8);
    if (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))) < fade) discard;
  }
  vec4 base = vCol;
  if (vPbr.w > .5 && uPaint.w > .5 && uPaint.r >= 0.) base.rgb = uPaint.rgb;   // r < 0：原廠色，只換烤漆材質
  #ifdef USE_MAP
  base *= texture2D(uMap, vUv);
  #endif
  #ifdef MASK
  if (base.a < .5) discard;
  #endif
  vec3 n = normalize(vN);
  #ifdef DOUBLE
  if (!gl_FrontFacing) n = -n;
  #endif
  vec3 v = normalize(uCam - vW);
  float rough = clamp(vPbr.x, .05, 1.), metal = clamp(vPbr.y, 0., 1.), coat = vPbr.z;
  // 很多模型把金屬漆標成 metallic 1；夜城的環境光很暗，全金屬會整台變黑，所以只有很光滑的（鍍鉻）才保留全金屬
  metal = min(metal, mix(.5, 1., step(rough, .15)));
  // uPaint.w：66-chrome.js 的烤漆材質（1 原廠亮面、2 金屬、3 消光、4 珠光、5 電鍍鏡面），只換車漆的部分
  if (vPbr.w > .5 && uPaint.w > 1.5) {
    float pf = uPaint.w;
    if (pf < 2.5) { metal = .55; rough = .3; coat = 1.; }
    else if (pf < 3.5) { metal = 0.; rough = .72; coat = 0.; }
    else if (pf < 4.5) { rough = .22; coat = 1.; base.rgb = mix(base.rgb, base.rgb.gbr * .7 + vec3(.12, .08, .16), pow(1. - max(dot(n, v), 0.), 1.6) * .85); }
    else { metal = 1.; rough = .06; coat = 1.; base.rgb = mix(base.rgb, vec3(.9), .35); }
  }
  // uM.w：燒毀程度（68-gta.js 的爆炸），車身變成焦黑、不再反光發光
  base.rgb = mix(base.rgb, vec3(.03, .026, .022), uM.w); rough = mix(rough, .95, uM.w); metal *= 1. - uM.w; coat *= 1. - uM.w;
  float wet = uWet * smoothstep(.55, .95, n.y);
  #ifdef FAR
  wet = 0.;
  #endif
  rough = mix(rough, rough * .4, wet);
  vec3 c = shade(vW, n, v, base.rgb, rough, metal);
  float envK = max(coat * .75, metal * .9);
  #ifdef BLEND
  envK = 1.1;
  #endif
  envK = max(envK, wet * .5);
  if (envK > .01) {
    vec3 r = reflect(-v, n); float F = .04 + .96 * pow(1. - max(dot(n, v), 0.), 5.);
    float rr = coat > .3 ? min(rough, .25) : rough;
    c += envMap(r) * envK * mix(vec3(max(F, coat * .1)), base.rgb, metal) * (1. - rr * .9);
  }
  #ifdef USE_WINMAP
  // 建築組的窗戶編號貼圖（props.mjs 的 winTex：R＝玻璃、G＝這扇窗的編號）：每扇窗依編號、貼圖重複的第幾格與 _WIN（同一面牆同一層）
  // 決定亮不亮，顏色和程式立面的窗燈同一套。編號取第 0 層 mip，遠處不會混到隔壁窗的編號
  // 遮罩也取第 0 層：遠處的牆一個像素蓋好幾扇窗，mip 平均下來會小於 .5，整面窗燈就消失了
  if (textureLod(uWinMap, vUv, 0.).r > .5) {
    // 帷幕牆的 UV 是公尺換算的格數（幾百格）：h21 先乘一百多再取 fract，數字大了精度不夠、整面牆會同一個值，
    // 規律的格數也會排成條紋；這裡改用 Dave Hoskins 的 hash（輸入在千以內都穩）
    vec2 cell = vec2(floor(textureLod(uWinMap, vUv, 0.).g * 255. + .5), dot(mod(floor(vUv), 256.), vec2(1., 257.))) + vWin * 997.;
    float hs = hw(cell), hs2 = hw(cell + 71.3);
    vec3 lc = hs2 < .55 ? vec3(1.,.66,.36) : hs2 < .8 ? vec3(.8,.86,1.) : hs2 < .92 ? vec3(1.,.4,.65) : vec3(.4,.6,1.);
    float lit = step(hs, uLit * 1.1);
    vec3 wl = lc * (.25 + .9 * dot(base.rgb, vec3(.33))) * (lit * 1.6 + .015);
    c = mix(c * .4 + wl, c + wl * .3, uDay);   // 白天保留日照下的貼圖，只疊一點開著燈的窗
  }
  #endif
  #ifdef WASH
  // 沒有窗戶遮罩的拼貼立面（Neighbourhood）：夜裡依高度打一層路燈的暖光（一樓最亮、往上淡掉，屋頂與地面不打），
  // 再依樓層與 3 m 一格的開間疊一點室內透出的光，整面牆不會黑成一片
  {
    float wv = uLamp * (1. - smoothstep(.45, .8, abs(n.y)));
    vec2 bay = floor(vec2(dot(vW.xz, normalize(vec2(-n.z, n.x) + 1e-4)) / 3.1, vW.y / 3.2));
    float room = step(hw(bay + floor(vW.xz / 40.) * 13.), uLit * .9) * smoothstep(1.2, 3., vW.y);
    c += base.rgb * wv * (vec3(1., .72, .45) * (.06 + .7 * exp(-max(vW.y - .8, 0.) / 3.5)) + vec3(1., .8, .6) * room * .35);
  }
  #endif
  vec3 emi = vEmi.rgb / max(1., max(vEmi.r, max(vEmi.g, vEmi.b)));   // 有些模型的 emissive_strength 很大，壓回 0–1 再交給燈種倍率
  #ifdef USE_EMIMAP
  emi *= texture2D(uEmiMap, vUv).rgb;
  #endif
  float k = vEmi.a;
  c += emi * 1.6 * (k > 1.5 ? .5 + uM.y * 2.4 : k > .5 ? .35 + uM.x * 1.4 : uM.z) * (1. - uM.w);
  #ifdef BLEND
  gl_FragColor = vec4(applyFog(c, vW), clamp(base.a + (1. - max(dot(n, v), 0.)) * .25, 0., 1.));
  #else
  #ifdef FAR
  gl_FragColor = vec4(applyFog(c, uCam + (vW - uCam) * farK(FAR)), 1.);   // 遠景模型（對岸城區）：和 MAT.far 一樣只算一部分距離的霧
  #else
  gl_FragColor = vec4(applyFog(c, vW), 1.);
  #endif
  #endif
}`;
function glbMaterial(src, inst, far, wash) {
  const defines = {};
  if (far) defines.FAR = far.toFixed(3);
  if (wash) defines.WASH = '';
  if (src.map) defines.USE_MAP = '';
  if (src.emissiveMap) defines.USE_EMIMAP = '';
  if (src.transparent) defines.BLEND = ''; else if (src.alphaTest > 0) defines.MASK = '';
  if (src.side === T.DoubleSide) defines.DOUBLE = '';
  if (src.metalnessMap) defines.USE_WINMAP = '';   // 只有 props.mjs 的建築組會留金屬粗糙貼圖（窗戶遮罩）
  return new T.ShaderMaterial({
    uniforms: { ...shared(ALLU), uM: inst.uM, uPaint: inst.uPaint, uMap: { value: src.map || null }, uEmiMap: { value: src.emissiveMap || null }, uWinMap: { value: src.metalnessMap || null } },
    vertexShader: GLB_VS, fragmentShader: GLB_FS, defines, side: src.side,
    transparent: !!src.transparent, depthWrite: !src.transparent,
  });
}

// ─── 下載與拆件：body 的網格、每個輪子的網格（相對輪軸）；幾何與貼圖所有實例共用 ───
const glbLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
// 打包時內嵌的 meshopt 壓縮 GLB（#glb-名稱，gzip＋base64）：人物與車流
async function embeddedGLB(name) {
  const el = document.getElementById('glb-' + name);
  if (!el) throw new Error('缺少內嵌模型 ' + name);
  const bin = Uint8Array.from(atob(el.textContent.trim()), c => c.charCodeAt(0));
  const ab = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  await MeshoptDecoder.ready;
  return glbLoader.parseAsync(ab, '');
}
const glbCache = {};
// 下載進度：每台已收到／總共幾 byte（伺服器沒給長度時用 cars.json 的檔案大小），下載完或失敗就記成完成
const glbBytes = {}, glbDone = new Set();
function glbFrac(ids) {
  let got = 0, all = 0;
  for (const id of ids) {
    const tot = (GLB_SPEC[id] ? GLB_SPEC[id].kb : PROPS_SPEC[id.slice(2)] ? PROPS_SPEC[id.slice(2)].kb : 1000) * 1024, b = glbBytes[id];
    all += tot; got += glbDone.has(id) ? tot : b ? tot * Math.min(1, b[0] / (b[1] || tot)) : 0;
  }
  return all ? got / all : 1;
}
// 走進車行、車庫（或走近車行門口）時這一批要下載的車款；HUD 顯示合計進度，全部下載完才清空
const glbBatch = new Set();
function glbBatchFrac() {
  if (!glbBatch.size) return null;
  for (const id of glbBatch) if (!glbDone.has(id)) return glbFrac(glbBatch);
  glbBatch.clear(); return null;
}
function loadGLB(id) {
  if (!GLB_ON || !CARS[id] || !CARS[id].glb) return null;
  const prog = e => { glbBytes[id] = [e.loaded, e.lengthComputable ? e.total : 0]; };
  return glbCache[id] ??= glbLoader.loadAsync(GLB_BASE + id + '.glb', prog).then(g => {
    const root = g.scene.getObjectByName('car'), spec = GLB_SPEC[id];
    g.scene.updateMatrixWorld(true);
    const inv = root.matrixWorld.clone().invert();
    const tpl = { id, body: [], wheels: [] };
    for (const n of root.children) {
      const meshes = []; n.traverse(o => { if (o.isMesh) meshes.push(o); });
      const list = meshes.map(m => ({ geo: m.geometry, mat: m.material, rel: new T.Matrix4().multiplyMatrices(inv, m.matrixWorld) }));
      // wheel_XX 跟著輪子轉；wheel_XX_fix（卡鉗）只跟著轉向
      const nm = n.name.replace(/_fix$/, ''), w = nm.startsWith('wheel_') && spec.wheels.find(w => 'wheel_' + w.name === nm);
      if (w) {
        const off = new T.Matrix4().makeTranslation(-w.x, -w.y, -w.z);
        for (const e of list) e.rel.premultiply(off);
        let tw = tpl.wheels.find(t => t.name === w.name);
        if (!tw) tpl.wheels.push(tw = { ...w, front: w.name[0] === 'F', list: [], fix: [] });
        (nm === n.name ? tw.list : tw.fix).push(...list);
      } else tpl.body.push(...list);
    }
    glbReport.loaded.push(id); glbDone.add(id);
    return tpl;
  }, () => { glbReport.failed.push(id); glbDone.add(id); return null; });
}
// 一個實例：自己的 uM（頭燈、煞車）與車漆 uniform，網格與材質都是新的、幾何共用
function glbInstance(tpl, paint, uM, fin = 1) {
  const inst = { uM: uM || { value: new T.Vector4(0, 0, 1, 0) }, uPaint: { value: new T.Vector4(0, 0, 0, 0) }, body: new T.Group(), wheels: [] };
  if (paint != null && CARS[tpl.id].paintable) { const c = new T.Color(paint); inst.uPaint.value.set(c.r, c.g, c.b, fin); }
  else if (fin > 1 && CARS[tpl.id].paintable) inst.uPaint.value.set(-1, -1, -1, fin);
  const mats = new Map();
  const mk = e => {
    let m = mats.get(e.mat); if (!m) { m = glbMaterial(e.mat, inst); mats.set(e.mat, m); }
    const o = new T.Mesh(e.geo, m); o.matrixAutoUpdate = false; o.matrix.copy(e.rel); o.userData.glb = 1;
    return o;
  };
  for (const e of tpl.body) inst.body.add(mk(e));
  for (const w of tpl.wheels) {
    const piv = new T.Group(); piv.position.set(w.x, w.y, w.z);
    const spin = new T.Group(); piv.add(spin);
    for (const e of w.list) spin.add(mk(e));
    for (const e of w.fix) piv.add(mk(e));
    inst.wheels.push({ piv, w: spin, front: w.front, rake: w.front && GLB_SPEC[tpl.id].rake || 0 });   // rake：機車前叉的後傾角（度），前輪繞這條軸轉向
  }
  return inst;
}
// 展示廳與車庫用的整台車（靜態）：先放替身，走進那個場館時才下載模型（glbWake），下載好就換掉
const glbWait = [];
function carObject(id, paint, fin = 1) {
  const c = CARS[id];
  const fbMesh = () => { const m = new T.Mesh(c.bike ? bikeFallbackGeo() : carKit(id, paint).build(), MAT.uber); m.userData.kit = 1; return m; };
  if (!c.glb) return fbMesh();
  const g = new T.Group(), fb = fbMesh(); g.add(fb);
  if (GLB_ON) {
    if (glbWait.length > 64) for (let i = glbWait.length - 1; i >= 0; i--) if (!glbWait[i].g.parent) glbWait.splice(i, 1);
    glbWait.push({ g, fb, id, paint, fin });
  }
  return g;
}
function glbWake(scn) {
  for (let i = glbWait.length - 1; i >= 0; i--) {
    const e = glbWait[i]; let top = e.g; while (top.parent) top = top.parent;
    if (top !== scn && e.g.parent) continue;   // 還在別的場景裡；已經被拿掉的直接丟棄
    glbWait.splice(i, 1);
    if (!e.g.parent) continue;
    if (!glbDone.has(e.id)) glbBatch.add(e.id);
    loadGLB(e.id).then(tpl => {
      if (!tpl || e.fb.parent !== e.g) return;
      const inst = glbInstance(tpl, e.paint, null, e.fin); e.g.userData.inst = inst;
      e.g.remove(e.fb); e.fb.geometry.dispose();
      e.g.add(inst.body); for (const w of inst.wheels) e.g.add(w.piv);
    });
  }
}
// 機車替身：Hanzo 的車身加兩個輪子合成一個幾何
let bikeFbGeo = null;
function bikeFallbackGeo() {
  if (!bikeFbGeo) {
    const k = new Kit(); const kk = hanzoKit(); k.pos.push(...kk.pos); k.nor.push(...kk.nor); k.col.push(...kk.col); k.mat.push(...kk.mat);
    for (const z of [.8, -.72]) wheel(k, 0, .33, z, .33, .14, 0x9aa0a6, 5);
    bikeFbGeo = k.build();
  }
  return bikeFbGeo.clone();
}
// 釋放 Kit 建的幾何與 GLB 實例的材質（GLB 的幾何與貼圖所有實例共用，不釋放）
function disposeKit(o) { o.traverse(m => { if (!m.isMesh) return; if (m.userData.kit) m.geometry.dispose(); else if (m.userData.glb) m.material.dispose(); }); }
