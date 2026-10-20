// 55 種魚的資料庫（企劃書 #01～#55）。zone 1～5；rarity C/U/R/E/L；times 是會咬鉤的時段，best 是「正確時段」（品質判定用）。
// p 是收線狀態機的參數覆寫（預設值依稀有度，見 reelParams()）；掙扎特性的文字說明照這些數值寫。
// 時段：am 早上、pm 下午、dusk 黃昏。
export const TIMES = ['am', 'pm', 'dusk'];
export const TIME_ZH = { am: '早上', pm: '下午', dusk: '黃昏' };
export const RARITY = {
  C: { zh: '普通', en: 'Common', w: 40, value: 10 },
  U: { zh: '少見', en: 'Uncommon', w: 22, value: 18 },
  R: { zh: '稀有', en: 'Rare', w: 10, value: 35 },
  E: { zh: '史詩', en: 'Epic', w: 4, value: 70 },
  L: { zh: '傳奇', en: 'Legendary', w: 1.2, value: 150 },
};
export const ZONES = [
  null,
  { id: 1, zh: '木屋碼頭與靜水淺灘', en: 'Cabin Dock & Shallow Cove', short: '碼頭淺灘' },
  { id: 2, zh: '陽光蜿蜒河道中游', en: 'Sunlit Meandering River', short: '蜿蜒中游' },
  { id: 3, zh: '松林樹蔭與沉木緩流', en: 'Pine Shade & Sunken Logs', short: '松林沉木' },
  { id: 4, zh: '亂石急流與峽谷河灣', en: 'Rocky Rapids & Gorge Bend', short: '峽谷急流' },
  { id: 5, zh: '上游瀑布潭與秘境深淵', en: 'Waterfall Pool & Abyssal Basin', short: '瀑布深潭' },
];

const ALL = ['am', 'pm', 'dusk'];
// [編號, 英文, 中文, 稀有度, 時段, 最佳時段, 體長 cm, 重量 kg, 特性說明, 參數]
const RAW = [
  // 第一區
  [1, 'Silver bream', '銀鯛', 'C', ALL, ['am'], 24, 0.6, '掙扎溫和且平靜期長，經典入門魚種', { calm: [3.2, 4.6], tens: 2.5 }],
  [2, 'Reed minnow', '蘆葦鰷', 'C', ['am', 'pm'], null, 12, 0.1, '體型極小，收線極快，偶爾短促抖動', { reel: 19, strug: [0.35, 0.6] }],
  [3, 'Sunlit roach', '暖陽擬鯉', 'C', ['am', 'pm'], null, 20, 0.4, '固定每 3 秒輕微擺尾一次，節奏穩定', { calm: [3, 3], strug: [0.6, 0.6], tens: 2.4 }],
  [4, 'Dockside bluegill', '碼頭藍鰓太陽魚', 'C', ['pm'], null, 18, 0.35, '喜歡繞著碼頭木樁打轉，初期張力略高', { startT: 44 }],
  [5, 'Pebble gudgeon', '鵝卵石鮈魚', 'C', ALL, null, 15, 0.2, '貼底游動，收線基礎阻力略大但極少暴衝', { reel: 9, calm: [4.5, 6.5] }],
  [6, 'Golden rudd', '金紅眼魚', 'U', ['pm', 'dusk'], null, 26, 0.75, '鱗片閃耀金光，被拉近船邊時會突然暴衝', { special: 'near' }],
  [7, 'Shallow dace', '淺灘雅羅魚', 'U', ['am'], null, 22, 0.45, '游速敏捷，試探點水次數高達 3～4 次', { nib: [3, 4], reel: 11 }],
  [8, 'Lilypad tench', '睡蓮丁鱥', 'U', ['am', 'dusk'], null, 34, 1.4, '耐力悠長，每次掙扎持續時間較長', { strug: [2.0, 3.0] }],
  [9, 'Mirror crucian', '鏡鱗鯽', 'R', ['dusk'], null, 30, 1.1, '僅在夕陽折射淺灘時咬鉤，張力升降平滑但快速', { special: 'smooth' }],
  [10, 'Lantern bitterling', '提燈鰟鮍', 'R', ['dusk'], null, 14, 0.15, '體型袖珍卻異常靈敏，提竿時間窗僅 0.9 秒', { win: 0.9, reel: 12 }],
  [11, 'Old Dock Master', '碼頭老巡守（巨型鯉）', 'L', ['dusk'], null, 68, 6.5, '棲息於碼頭正下方的魚王，三段式猛烈拉扯', { waves: 3 }],
  // 第二區
  [12, 'River perch', '河鱸', 'C', ['am', 'pm'], null, 28, 0.8, '間歇性短促暴衝，背鰭帶刺張力反彈快', { calm: [1.4, 2.2], strug: [0.5, 0.8], special: 'rebound' }],
  [13, 'Striped chub', '條紋溪哥', 'C', ALL, null, 19, 0.3, '成群活動，咬鉤極快，適合快速填滿魚簍', { bite: 0.4, nib: [1, 2] }],
  [14, 'Clearwater bleak', '清溪歐鰷', 'C', ['am', 'pm'], null, 16, 0.18, '表層魚種，浮標幾乎剛落水就會咬鉤', { bite: 0.12, nib: [0, 1], reel: 14 }],
  [15, 'Sandbar loach', '沙洲泥鰍', 'C', ['pm', 'dusk'], null, 21, 0.25, '扭動頻率高但單次張力增幅小', { calm: [0.8, 1.2], strug: [0.4, 0.6], tens: 1.8 }],
  [16, 'Meadow ide', '草岸圓腹雅羅', 'U', ['am', 'pm'], null, 36, 1.5, '力量渾厚，平靜期與暴衝期交替規律', { calm: [2.5, 2.5], strug: [1.5, 1.5] }],
  [17, 'Copper bream', '銅鱗魴', 'U', ['pm'], null, 38, 1.8, '側扁身軀善於借水流側拉，退線速度較快', { slipS: 9 }],
  [18, 'Silver grayling', '銀帆茴魚', 'U', ['am'], null, 35, 1.2, '擁有華麗背鰭，收線至一半時會躍出水面', { jumps: [0.5] }],
  [19, 'Golden trout', '金鱒', 'R', ['pm', 'dusk'], null, 42, 2.1, '河道明星魚種，暴衝時間長，考驗點放收線', { strug: [2.2, 3.2] }],
  [20, 'Ribbon eel-goby', '彩帶蝦虎', 'R', ['pm'], null, 25, 0.4, '鑽入水底沙石縫隙，張力條會瞬間鎖死 1.5 秒', { special: 'lock' }],
  [21, 'Amber barbel', '琥珀魮魚', 'E', ['dusk'], null, 55, 3.8, '觸鬚敏銳，強力貼底逆流衝刺，張力極易飆紅', { tens: 3.9, special: 'rush' }],
  [22, 'Suncrest Salmon', '日冕大麻哈魚', 'L', ['pm'], null, 78, 8.2, '正午陽光直射時現身，連續四次高頻躍水掙扎', { jumps: [0.2, 0.4, 0.6, 0.8] }],
  // 第三區
  [23, 'Pine-shadow bass', '松影黑鱸', 'C', ['am', 'pm'], null, 32, 1.3, '躲在樹蔭邊緣伏擊，咬鉤瞬間張力直接跳升 25%', { startT: 55 }],
  [24, 'Bark bullhead', '樹皮褐首鯰', 'C', ALL, ['dusk'], 27, 0.9, '沉木底層常客，不常暴衝但收線進度累積慢', { calm: [4.5, 6], reel: 8 }],
  [25, 'Mossy pumpkinseed', '青苔瓜仁太陽魚', 'C', ['am', 'pm'], null, 17, 0.32, '色彩斑斕，掙扎節奏輕快', { calm: [1.2, 1.8], strug: [0.4, 0.6], tens: 2.2 }],
  [26, 'Driftwood sucker', '流木亞口魚', 'U', ALL, null, 40, 1.9, '吸附於水底沉木，前 30% 進度阻力極大', { special: 'anchor' }],
  [27, 'Emerald pickerel', '翠紋草狗魚', 'U', ['am', 'dusk'], null, 46, 2.2, '掠食性魚類，暴衝速度極快但耐力較短', { tens: 3.8, strug: [0.5, 0.8] }],
  [28, 'Hollow-log burbot', '朽木江鱈', 'U', ['dusk'], null, 48, 2.5, '喜歡往陰暗處鑽，平靜期極短', { calm: [0.8, 1.3] }],
  [29, 'Velvet catfish', '絨鬚鯰', 'R', ['dusk'], null, 56, 4.2, '體型沉重，拉扯時船身會跟著產生明顯晃動', { reel: 7, sway: 1 }],
  [30, 'Dusk carp', '暮光鯉', 'R', ['dusk'], null, 52, 3.6, '鱗片映照晚霞紫光，退線拉力強勁', { slipS: 9.5 }],
  [31, 'Spotted snakehead', '斑紋雷魚', 'E', ['pm', 'dusk'], null, 62, 4.8, '兇猛掙扎，每次暴衝都會伴隨假平靜誘騙按鍵', { special: 'feint' }],
  [32, 'Ghost-pine koi', '蒼松幽鯉', 'E', ['am'], null, 58, 4.1, '晨霧繚繞松林時出沒，游姿優雅卻極難控線', { special: 'erratic' }],
  [33, 'Sunken Leviathan', '沉木古鱷雀鱔', 'L', ['dusk'], null, 95, 12.5, '松林深灣霸主，張力容錯率極低，需精準點放', { brk: 0.5, waves: 3 }],
  // 第四區
  [34, 'Torrent sculpin', '急流杜父魚', 'C', ALL, null, 16, 0.22, '胸鰭寬大緊貼岩石，順流與逆流阻力差異大', { special: 'current' }],
  [35, 'Boulder darter', '巨石鏢鱸', 'C', ['am', 'pm'], null, 14, 0.15, '在石縫間高速彈跳游動，浮標抖動極為頻繁', { nib: [4, 6], reel: 13 }],
  [36, 'Whitewater nose', '白沫軟口魚', 'C', ['am', 'pm'], null, 31, 0.95, '借急流沖刷之力逃脫，放開收線時進度倒退快', { slip: 7 }],
  [37, 'Canyon rainbow', '峽谷虹鱒', 'U', ALL, null, 41, 1.85, '體側彩虹帶鮮明，擅長連續跳水甩鉤', { jumps: [0.3, 0.55, 0.8] }],
  [38, 'Granite barbell', '花崗岩鮠', 'U', ['pm', 'dusk'], null, 39, 1.7, '會將釣線往岩石邊緣摩擦，紅區斷線時間縮短為 0.6 秒', { brk: 0.6 }],
  [39, 'Silver-rapid asp', '銀湍赤梢魚', 'U', ['am'], null, 49, 2.6, '表層高速掠食者，第一波暴衝長達 4 秒', { first: 4 }],
  [40, 'Gorge cutthroat', '峽谷割喉鱒', 'R', ['am', 'dusk'], null, 45, 2.3, '鰓下有鮮紅斑紋，掙扎頻率隨進度接近 80% 而加倍', { special: 'ramp' }],
  [41, 'Ironclad sturgeon', '鐵甲小鱘', 'R', ['pm', 'dusk'], null, 64, 5.4, '骨質鱗片沉重無比，基礎收線速度減半', { reel: 5 }],
  [42, 'Thunder-rapids pike', '雷湍狗魚', 'E', ['pm'], null, 72, 6.2, '峽谷掠食霸主，爆發性衝刺會瞬間拉滿 70% 張力', { special: 'burst' }],
  [43, 'Crimson huchen', '緋紅哲羅鮭', 'E', ['am', 'dusk'], null, 80, 7.8, '極度罕見的冷水巨魚，兼具高速暴衝與高退線率', { tens: 3.8, slipS: 10 }],
  [44, 'Gorge King Arapaima', '峽谷帝王骨舌魚', 'L', ['pm'], null, 110, 15.0, '逆流而上的傳奇巨物，需經歷五波極限張力考驗', { waves: 5 }],
  // 第五區
  [45, 'Mist smelt', '水霧胡瓜魚', 'C', ['am', 'pm'], null, 18, 0.2, '聚集在瀑布水花下方，成群閃爍銀光', {}],
  [46, 'Basin whitefish', '深潭白鮭', 'C', ALL, null, 33, 1.1, '深水層溫和魚種，拉升至水面過程穩定', { tens: 2.2 }],
  [47, 'Cascade kokanee', '飛瀑紅鮭', 'U', ['am', 'pm'], null, 37, 1.4, '通體鮮紅，喜愛逆著瀑布水流向上衝刺', { special: 'rush' }],
  [48, 'Deepwater cisco', '淵底歐白鮭', 'U', ['pm', 'dusk'], null, 34, 1.25, '潛藏於深藍水底，咬鉤前試探動作極微弱', { faint: 1 }],
  [49, 'Sapphire arctic char', '藍寶石北極紅點鮭', 'R', ['am'], null, 50, 3.1, '晨光照射瀑布時出現，鱗片呈寶石藍，耐力極高', { calm: [2, 3], strug: [2, 3], reel: 8 }],
  [50, 'Waterfall char', '瀑潭紅點鮭', 'R', ['am', 'dusk'], null, 54, 3.5, '瀑布潭代表性名魚，高頻率連續暴衝', { calm: [0.9, 1.4], strug: [1.2, 1.8] }],
  [51, 'Moon-veil paddlefish', '月紗匙吻鱘', 'R', ['dusk'], null, 66, 5.0, '長吻奇特，水下迴旋力道強，張力曲線呈波浪狀', { special: 'wave' }],
  [52, 'Abyssal lake trout', '深淵湖鱒', 'E', ['pm', 'dusk'], null, 74, 6.8, '潛伏潭底最深處，會發動「深淵下潛」強制退線', { special: 'dive' }],
  [53, 'Prism oar-carp', '稜光彩鯉', 'E', ['am'], null, 60, 4.5, '瀑布彩虹出現時咬鉤，掙扎節奏多變難測', { special: 'erratic' }],
  [54, 'Albino cave-catfish', '瀑洞白化龍鬚鯰', 'E', ['dusk'], null, 82, 8.6, '瀑布後方岩洞游出，力量沉猛無比', { tens: 3.9, reel: 6.5, sway: 1 }],
  [55, 'Spirit of Stillwater', '靜水之靈（幻彩龍魚）', 'L', ['dusk'], null, 120, 18.0, '圖鑑最終極目標，全身散發柔和微光，集所有掙扎特技於一身', { special: 'all', waves: 5 }],
];

export const FISH = RAW.map(([id, en, zh, rarity, times, best, len, kg, desc, p]) => ({
  id, key: 'f' + String(id).padStart(2, '0'), no: '#' + String(id).padStart(2, '0'),
  en, zh, rarity, zone: Math.ceil(id / 11), times, best: best || times, len, kg, desc, p,
}));
export const byId = (id) => FISH[id - 1];
export const zoneFish = (z) => FISH.filter((f) => f.zone === z);
export const LEGENDS = [11, 22, 33, 44, 55];

// 收線參數：稀有度決定基準，再套魚種覆寫。單位：進度與張力都是 %，速率是 %/s，時間是秒。
const BY_RARITY = {
  C: { reel: 13, tens: 2.5, calm: [2.4, 3.6], strug: [0.8, 1.3] },
  U: { reel: 11.5, tens: 2.9, calm: [2.2, 3.2], strug: [1.0, 1.5] },
  R: { reel: 10, tens: 3.2, calm: [2.2, 3.0], strug: [1.1, 1.7] },
  E: { reel: 9, tens: 3.6, calm: [2.2, 3.0], strug: [1.2, 1.8] },
  L: { reel: 8, tens: 4.0, calm: [2.2, 3.2], strug: [1.4, 2.0] },
};
export function reelParams(f) {
  const b = BY_RARITY[f.rarity];
  return {
    nib: [1, 3], win: 1.5, perfect: 0.35, bite: 1, startT: 30,
    slip: 3, slipS: 5.5, brk: 0.8, special: null, jumps: [], waves: 0, first: 0, sway: 0, faint: 0,
    ...b, ...f.p,
  };
}
