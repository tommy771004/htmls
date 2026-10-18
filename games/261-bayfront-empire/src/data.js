// 遊戲資料：商家、需求曲線、天氣、任務與帝國等級。不碰 DOM 與 three，Node 測試與瀏覽器共用。
// 金額單位為美元；時間單位為「遊戲分鐘」（一天 1440 分）。

// kind 決定天氣倍率：indoor 室內、outdoor 海灘陸上、water 水上活動
// curve 決定每小時客流曲線（見 CURVES）
export const BIZ = [
  // ── 城市街區（原有內容）──
  { id: 'cafe', supply: 0.20, cargo: 'food', zone: 'city', name: '轉角咖啡館', en: 'Corner Café', cat: '餐飲', icon: 'cup', color: '#2f6b55',
    cost: 60000, up: [90000, 190000], price: [270, 380, 510], cap: [4, 6, 9], stay: 25, wage: [5200, 8400, 13600],
    open: 7 * 60, close: 20 * 60, demand: 1.25, kind: 'indoor', curve: 'day' },
  { id: 'bakery', supply: 0.21, cargo: 'food', zone: 'city', name: '老窯麵包坊', en: 'Kiln Bakery', cat: '餐飲', icon: 'bread', color: '#b5793a',
    cost: 75000, up: [110000, 230000], price: [240, 330, 450], cap: [3, 5, 8], stay: 14, wage: [4800, 7600, 12400],
    open: 6 * 60 + 30, close: 19 * 60, demand: 1.05, kind: 'indoor', curve: 'morning' },
  { id: 'burger', supply: 0.22, cargo: 'food', zone: 'city', name: '碼頭漢堡', en: 'Dockside Burger', cat: '餐飲', icon: 'burger', color: '#b4513c',
    cost: 120000, up: [170000, 340000], price: [420, 570, 770], cap: [6, 9, 13], stay: 28, wage: [9000, 14000, 22000],
    open: 10 * 60, close: 23 * 60, demand: 1.35, kind: 'indoor', curve: 'meal' },
  { id: 'mart', supply: 0.27, cargo: 'goods', zone: 'city', name: '日夜便利店', en: 'Night & Day Mart', cat: '零售', icon: 'basket', color: '#3f7a8c',
    cost: 80000, up: [120000, 240000], price: [200, 270, 360], cap: [4, 6, 9], stay: 8, wage: [5600, 8800, 14000],
    open: 0, close: 24 * 60, demand: 1.15, kind: 'indoor', curve: 'allday' },
  { id: 'books', supply: 0.26, cargo: 'goods', zone: 'city', name: '潮汐書店', en: 'Tideline Books', cat: '零售', icon: 'book', color: '#6a5a8a',
    cost: 90000, up: [140000, 280000], price: [510, 690, 930], cap: [4, 6, 9], stay: 38, wage: [5000, 8000, 12800],
    open: 9 * 60, close: 21 * 60, demand: 0.65, kind: 'indoor', curve: 'day' },
  { id: 'pizza', supply: 0.21, cargo: 'food', zone: 'city', name: '石爐披薩', en: 'Stone Oven Pizza', cat: '餐飲', icon: 'pizza', color: '#c0662f',
    cost: 140000, up: [200000, 400000], price: [540, 740, 990], cap: [5, 8, 12], stay: 30, wage: [9400, 14800, 23000],
    open: 11 * 60, close: 23 * 60, demand: 1.1, kind: 'indoor', curve: 'meal' },
  { id: 'nail', supply: 0.08, cargo: 'goods', zone: 'city', name: '貝殼美甲', en: 'Shell Nail Salon', cat: '服務', icon: 'nail', color: '#c0607a',
    cost: 150000, up: [220000, 440000], price: [1350, 1880, 2550], cap: [2, 4, 6], stay: 55, wage: [7600, 12600, 20400],
    open: 10 * 60, close: 21 * 60, demand: 0.6, kind: 'indoor', curve: 'day' },
  { id: 'boutique', supply: 0.23, cargo: 'goods', zone: 'city', name: '海風服飾', en: 'Seabreeze Boutique', cat: '零售', icon: 'shirt', color: '#8a4f6e',
    cost: 220000, up: [320000, 640000], price: [2100, 2850, 3900], cap: [3, 5, 8], stay: 32, wage: [11000, 17600, 28000],
    open: 10 * 60, close: 21 * 60, demand: 0.62, kind: 'indoor', curve: 'day' },
  { id: 'gym', supply: 0.05, cargo: 'goods', zone: 'city', name: '浪尖健身房', en: 'Crest Gym', cat: '服務', icon: 'dumbbell', color: '#3d6b4a',
    cost: 260000, up: [380000, 760000], price: [930, 1290, 1770], cap: [6, 10, 15], stay: 75, wage: [12000, 19000, 31000],
    open: 6 * 60, close: 23 * 60, demand: 0.78, kind: 'indoor', curve: 'gym' },
  { id: 'bar', supply: 0.18, cargo: 'food', zone: 'city', name: '燈塔酒吧', en: 'Lighthouse Bar', cat: '娛樂', icon: 'glass', color: '#7a3b3b',
    cost: 300000, up: [430000, 860000], price: [1320, 1830, 2520], cap: [6, 10, 14], stay: 65, wage: [13000, 21000, 34000],
    open: 17 * 60, close: 2 * 60, demand: 1.0, kind: 'indoor', curve: 'night' },

  // ── 海灘改版（新增）──
  { id: 'snack', supply: 0.22, cargo: 'food', zone: 'beach', name: '浪花小吃攤', en: 'Surfside Snacks', cat: '餐飲', icon: 'snack', color: '#d0763a',
    cost: 180000, up: [260000, 520000], price: [420, 580, 780], cap: [3, 5, 8], stay: 10, wage: [7000, 11400, 18400],
    open: 9 * 60, close: 21 * 60, demand: 1.3, kind: 'outdoor', curve: 'beach' },
  { id: 'umbrella', supply: 0.04, cargo: 'goods', zone: 'beach', name: '遮陽傘躺椅', en: 'Umbrella & Loungers', cat: '休閒', icon: 'umbrella', color: '#c8453c',
    cost: 320000, up: [460000, 900000], price: [1800, 2400, 3200], cap: [4, 8, 12], stay: 70, wage: [8000, 13000, 21000],
    open: 8 * 60, close: 18 * 60 + 30, demand: 1.15, kind: 'outdoor', curve: 'beach' },
  { id: 'surf', supply: 0.07, cargo: 'goods', zone: 'beach', name: '白浪衝浪學校', en: 'Whitecap Surf School', cat: '休閒', icon: 'wave', color: '#2f7f8f',
    cost: 520000, up: [740000, 1450000], price: [3900, 5100, 6600], cap: [2, 4, 6], stay: 60, wage: [15000, 24000, 39000],
    open: 7 * 60, close: 17 * 60 + 30, demand: 0.75, kind: 'water', curve: 'beach' },
  { id: 'jetski', supply: 0.13, cargo: 'fuel', zone: 'beach', name: '水上摩托車', en: 'Jet Ski Rental', cat: '休閒', icon: 'jetski', color: '#2e5f9a',
    cost: 620000, up: [900000, 1800000], price: [3600, 4700, 6100], cap: [2, 4, 6], stay: 30, wage: [21000, 33000, 54000],
    open: 9 * 60, close: 18 * 60, demand: 0.85, kind: 'water', curve: 'beach' },
  { id: 'boat', supply: 0.10, cargo: 'fuel', zone: 'beach', name: '海灣租船碼頭', en: 'Boat Rental', cat: '休閒', icon: 'boat', color: '#2d5a45',
    cost: 780000, up: [1150000, 2300000], price: [4830, 6250, 8100], cap: [2, 4, 6], stay: 45, wage: [26000, 41000, 66000],
    open: 8 * 60, close: 19 * 60, demand: 0.82, kind: 'water', curve: 'beach' },
];

export const BIZ_BY_ID = Object.fromEntries(BIZ.map((b) => [b.id, b]));
export const BEACH_IDS = BIZ.filter((b) => b.zone === 'beach').map((b) => b.id);
export const CITY_IDS = BIZ.filter((b) => b.zone === 'city').map((b) => b.id);

// 每小時（0–23 時）客流倍率
export const CURVES = {
  day:     [0, 0, 0, 0, 0, 0, 0.2, 0.55, 0.85, 1, 1, 1.1, 1.25, 1.15, 1, 1, 1.05, 1.15, 1, 0.8, 0.5, 0.3, 0.1, 0],
  morning: [0, 0, 0, 0, 0, 0, 0.6, 1.4, 1.5, 1.2, 0.9, 0.8, 0.9, 0.8, 0.7, 0.8, 0.9, 1, 0.8, 0.4, 0.2, 0, 0, 0],
  meal:    [0, 0, 0, 0, 0, 0, 0, 0.1, 0.2, 0.3, 0.5, 1.2, 1.6, 1.3, 0.7, 0.5, 0.6, 0.9, 1.5, 1.6, 1.2, 0.8, 0.5, 0.2],
  allday:  [0.3, 0.2, 0.15, 0.1, 0.1, 0.2, 0.5, 0.9, 1, 0.9, 0.8, 1, 1.1, 1, 0.9, 0.9, 1, 1.1, 1.1, 1, 0.9, 0.8, 0.6, 0.4],
  gym:     [0, 0, 0, 0, 0, 0, 0.9, 1.3, 1, 0.6, 0.5, 0.6, 0.8, 0.6, 0.5, 0.6, 0.8, 1.2, 1.5, 1.4, 1, 0.6, 0.3, 0],
  night:   [1, 0.6, 0.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0.8, 1, 1.3, 1.5, 1.5, 1.3],
  beach:   [0, 0, 0, 0, 0, 0, 0, 0.25, 0.5, 0.8, 1.05, 1.25, 1.35, 1.45, 1.45, 1.35, 1.15, 0.85, 0.55, 0.3, 0.15, 0, 0, 0],
};

// 天氣：mult 依商家 kind 套用到客流；beach 為海灘閒逛人潮倍率
export const WEATHER = {
  sunny:  { name: '晴朗', note: '海灘人潮正常', mult: { indoor: 1, outdoor: 1.3, water: 1.3 }, beach: 1.15, light: 1 },
  partly: { name: '晴時多雲', note: '客流平穩', mult: { indoor: 1, outdoor: 1, water: 1 }, beach: 0.95, light: 0.9 },
  cloudy: { name: '陰天', note: '海灘客人減少', mult: { indoor: 1.06, outdoor: 0.6, water: 0.55 }, beach: 0.55, light: 0.72 },
  rain:   { name: '小雨', note: '新客人變少，海灘幾乎沒人', mult: { indoor: 1.15, outdoor: 0.1, water: 0.05 }, beach: 0.06, light: 0.55 },
  heat:   { name: '熱浪', note: '海灘客流 +60%', mult: { indoor: 1.1, outdoor: 1.7, water: 1.55 }, beach: 1.6, light: 1.08 },
};

// 天氣轉移機率（每段 2–5 小時重新抽一次）
export const WEATHER_NEXT = {
  sunny:  { sunny: 0.42, partly: 0.3, cloudy: 0.1, rain: 0.04, heat: 0.14 },
  partly: { sunny: 0.38, partly: 0.3, cloudy: 0.2, rain: 0.08, heat: 0.04 },
  cloudy: { sunny: 0.15, partly: 0.35, cloudy: 0.25, rain: 0.25, heat: 0 },
  rain:   { sunny: 0.1, partly: 0.3, cloudy: 0.35, rain: 0.25, heat: 0 },
  heat:   { sunny: 0.55, partly: 0.25, cloudy: 0.1, rain: 0.02, heat: 0.08 },
};

// 每日活動
export const EVENTS = {
  weekend:  { name: '週末海灘日', note: '海灘客流 +35%', zone: 'beach', mult: 1.35 },
  market:   { name: '街區市集', note: '城市客流 +25%', zone: 'city', mult: 1.25 },
  festival: { name: '海灘音樂節', note: '海灘客流 +50%', zone: 'beach', mult: 1.5 },
  // 城市生活改版：週五晚上的街區派對（18 點到凌晨 3 點，夜店類 ×2、其他城市商家 ×1.5）
  party:    { name: '週五夜派對', note: '晚上城市客流 +50%，酒吧加倍', zone: 'city', mult: 1, night: true },
  // 批發短缺：向城市批發商進貨貴 50%，港口有庫存的不受影響
  shortage: { name: '批發短缺', note: '市價進貨貴 50%，港口庫存不受影響', zone: null, mult: 1 },
};

// ── 城市生活改版 ──
// 季節：每季 7 天，影響海灘與城市的客流；冬天沒有熱浪、夏天少雨
export const SEASON_DAYS = 7;
export const SEASONS = [
  { id: 'spring', name: '春', beach: 1, city: 1 },
  { id: 'summer', name: '夏', beach: 1.3, city: 0.95 },
  { id: 'autumn', name: '秋', beach: 0.85, city: 1.06 },
  { id: 'winter', name: '冬', beach: 0.55, city: 1.15 },
];
// 定價：平價客人多、評分漲得快；精品客單價高、客人少
export const TIERS = {
  '-1': { name: '平價', price: 0.85, arrive: 1.22, rating: 1.5 },
  0: { name: '標準', price: 1, arrive: 1, rating: 1 },
  1: { name: '精品', price: 1.22, arrive: 0.8, rating: 0.6 },
};
// 促銷：花客單價的 25 倍，接下來 3 小時客流 ×1.6
export const PROMO = { costMul: 25, minutes: 180, mult: 1.6 };
// 疊樓：同棟每多一級別家店，客流 +5%（樓上的店吃一樓的人潮）
export const STACK_BONUS = 0.05;
// 電梯：每棟一部，叫車制；升級加大車廂、加快速度
export const LIFT = { cap: [4, 6, 8], move: [3.2, 2.2, 1.4], cost: [0, 150000, 380000], name: ['標準電梯', '雙速電梯', '高速觀景梯'] };
export const SWAP_COST = 60000; // 疊樓兩層交換位置的裝修費
// 公寓：買下住宅收房租，住戶也是城市商家的客人（每級 +2.5% 城市客流）
export const APT_NAMES = ['鷗鳴公寓', '紅磚大樓', '轉角公寓', '燈塔街 12 號', '海風住宅', '老榆樹公寓', '晨光大樓', '水手公寓', '貝灣住宅'];
export const APT = { base: 360000, step: 50000, renoMul: 1.5, rent: [0.045, 0.05], pop: 0.025 };
// 地標：一次買斷，帶來全區加成
export const LANDMARKS = [
  { id: 'lighthouse', name: '防波堤燈塔', en: 'Breakwater Lighthouse', icon: 'beacon', color: '#c8453c', cost: 1600000,
    note: '水上活動客流 +15%，夜裡有旋轉的光束', at: [-99, 0, 90] },
  { id: 'market', name: '海濱夜市', en: 'Seaside Night Market', icon: 'lantern', color: '#d9a63e', cost: 2200000,
    note: '城市客流 +10%，晚上 6 點到午夜再 +25%', at: [-108, 0, 26] },
  { id: 'ferris', name: '海灣摩天輪', en: 'Bayfront Wheel', icon: 'wheel', color: '#2f7f8f', cost: 3500000,
    note: '海灘人潮 +20%、戶外與水上 +10%，每小時賣票收入', at: [140, 0, 30] },
];
export const LANDMARK_BY_ID = Object.fromEntries(LANDMARKS.map((m) => [m.id, m]));
export const FERRIS_TICKET = 9000; // 每小時票房（乘上海灘人潮倍率）
// 競爭對手：搶走目標店家的部分客人，可以收購或買下他租的那棟公寓趕走
export const RIVAL_NAMES = {
  cafe: '星浪連鎖咖啡', bakery: '工業吐司坊', burger: '巨無霸速食', mart: '全日超商', books: '網路書城體驗店',
  pizza: '閃電外送披薩', nail: '快剪美甲吧', boutique: '快時尚旗艦店', gym: '24H 健身中心', bar: '霓虹夜店',
};
export const RIVAL = { start: 0.15, grow: 0.02, max: 0.35, buyMul: 3, cooldown: 5 };

export const LEVEL_AT = [0, 150000, 420000, 950000, 2000000, 4200000, 8000000, 14000000];

// 任務鏈。index 0–3 是海灘改版前就有的城市任務，v1 存檔的進度直接沿用
export const QUESTS = [
  { ch: 1, chName: '街角起家', title: '開第一家店', hint: '點選街區裡標著價格的店面，買下任一家', reward: 20000,
    goal: (s) => [owned(s).length, 1] },
  { ch: 1, chName: '街角起家', title: '升級一家店到 Lv2', hint: '升級會提高客單價、容量與吸引力', reward: 30000,
    goal: (s) => [Math.max(0, ...Object.values(s.biz).map((b) => b.lv)) >= 2 ? 1 : 0, 1] },
  { ch: 2, chName: '連鎖經營', title: '擁有 4 家店', hint: '早餐、午餐、夜晚的店錯開，全天都有收入', reward: 60000,
    goal: (s) => [owned(s).length, 4] },
  { ch: 2, chName: '連鎖經營', title: '單日營收 $45,000', hint: '午餐與晚餐尖峰最好賺', reward: 80000,
    goal: (s) => [Math.round(dayRevenue(s)), 45000] },
  { ch: 3, chName: '海灘改版', title: '開設浪花小吃攤', hint: '沿海步道下方的沙灘，客人會從街區走過來', reward: 90000, target: 'snack',
    goal: (s) => [s.biz.snack.lv ? 1 : 0, 1] },
  { ch: 3, chName: '海灘改版', title: '開設遮陽傘躺椅', hint: '升級會在沙灘上加開更多傘位', reward: 140000, target: 'umbrella',
    goal: (s) => [s.biz.umbrella.lv ? 1 : 0, 1] },
  { ch: 3, chName: '海灘改版', title: '開設白浪衝浪學校', hint: '晴天與熱浪天最好賺，下雨幾乎沒人', reward: 200000, target: 'surf',
    goal: (s) => [s.biz.surf.lv ? 1 : 0, 1] },
  { ch: 3, chName: '海灘改版', title: '開設海灣租船碼頭', hint: '每租出一艘船就是一筆大收入', reward: 320000, target: 'boat',
    goal: (s) => [s.biz.boat.lv ? 1 : 0, 1] },
  { ch: 4, chName: '海岸帝國', title: '開設水上摩托車', hint: '浮動碼頭在碼頭東邊的淺灘', reward: 400000, target: 'jetski',
    goal: (s) => [s.biz.jetski.lv ? 1 : 0, 1] },
  { ch: 4, chName: '海岸帝國', title: '單日營收 $400,000', hint: '把海灘商家升級，挑晴天衝業績', reward: 600000,
    goal: (s) => [Math.round(dayRevenue(s)), 400000] },
  { ch: 4, chName: '海岸帝國', title: '五家海灘商家全部 Lv3', hint: '整條海岸都是你的', reward: 1500000,
    goal: (s) => [BEACH_IDS.filter((id) => s.biz[id].lv >= 3).length, BEACH_IDS.length] },
  // ── 物流與海港改版 ──
  { ch: 5, chName: '物流與海港', title: '開設灣岸海港', hint: '防波堤西邊的碼頭：批發價進貨，供應成本立刻下降', reward: 300000, target: 'port',
    goal: (s) => [s.port.lv ? 1 : 0, 1] },
  { ch: 5, chName: '物流與海港', title: '完成一份貨運合約', hint: '在海港面板的「合約」投標，船靠港卸完貨就收款', reward: 400000, target: 'port',
    goal: (s) => [s.port.stats.contracts, 1] },
  { ch: 5, chName: '物流與海港', title: '單日省下 $40,000 供應成本', hint: '物流車不夠送時會改回市價進貨，升級海港加車', reward: 600000, target: 'port',
    goal: (s) => [Math.round(s.today.saved || 0), 40000] },
  { ch: 5, chName: '物流與海港', title: '海港升到 Lv3 · 區域港', hint: '三座岸橋、三個泊位、六台物流車', reward: 2000000, target: 'port',
    goal: (s) => [s.port.lv >= 3 ? 1 : 0, 1] },
];
export const FIRST_BEACH_QUEST = 4;
export const FIRST_PORT_QUEST = 11;

// ── 物流與海港 ──
// 每位客人消費會用掉 1 單位貨；單位成本 = 客單價 × supply。沒有港口時全部向城市批發商以市價進貨。
export const CARGO = {
  food: { name: '食材', unit: 64, color: '#c8453c', fresh: true },
  goods: { name: '零售貨', unit: 120, color: '#2f7f8f', fresh: false },
  fuel: { name: '燃油耗材', unit: 210, color: '#d9a63e', fresh: false },
};
export const CARGO_IDS = Object.keys(CARGO);
export const PORT = {
  id: 'port', name: '灣岸海港', en: 'Bayfront Harbor', icon: 'anchor', color: '#a8462f',
  cost: 950000, up: [1500000, 2800000],
  stage: ['碼頭倉庫', '冷鏈港', '區域港'],
  disc: [0.22, 0.28, 0.34],       // 批發價比市價便宜的比例
  cranes: [1, 2, 3],              // 岸橋數
  berths: [1, 2, 3],              // 泊位數
  trucks: [2, 4, 6],              // 物流車數
  truckUnits: 50,                 // 每台物流車每小時能送的單位數
  craneRate: 3,                   // 每台岸橋每小時卸貨櫃數
  spoil: [0.05, 0.016, 0.008],    // 生鮮每天耗損比例（Lv2 起有冷藏倉）
  storage: 3,                     // 每單位每天倉儲費
  freight: 5000, freightPer: 220, // 每艘補給船的運費與每櫃費用
  wage: [14000, 22000, 34000],
  container: 60,                  // 每櫃單位數
};
export const SHIP_NAMES = ['藍鷺號', '晨潮號', '珊瑚黎明號', '鵜鶘號', '哈德遜微風號', '北灣信天翁號', '金沙號', '燈塔守望號', '海鷗之歌號', '翡翠灣號', '遠洋燕號', '白帆號'];
export const CLIENTS = [
  ['河岸咖啡貿易', '咖啡生豆'], ['阿特拉斯電子', '電子零件'], ['藍鰭進口', '冷凍海鮮'], ['先鋒玩具', '玩具'], ['流明食品', '包裝食品'],
  ['灣區家具', '組裝家具'], ['北岬酒商', '葡萄酒'], ['晴空單車', '自行車'], ['南洋香料行', '香料'], ['海景建材', '建材'],
];

function owned(s) { return Object.keys(s.biz).filter((id) => s.biz[id].lv > 0); }
function dayRevenue(s) { let t = 0; for (const k in s.today.rev) t += s.today.rev[k]; return t; }
