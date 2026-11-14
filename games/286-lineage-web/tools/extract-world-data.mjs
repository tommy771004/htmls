// 從 assets/286/auto-worker465.js 與封包 manifest 萃取全 64 張地圖（說話之島＋亞丁大陸＋經典地監）世界與精靈中繼資料
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(gameRoot, '../..');
const assetsRoot = path.join(repoRoot, 'assets/286');
const outPath = path.join(gameRoot, 'src/data/talking-island.json');

const art = JSON.parse(fs.readFileSync(path.join(assetsRoot, 'art-assets.json'), 'utf8'));
const byPath = new Map(art.assets.map((a) => [a[0], a]));

function readPackBytes(relPath) {
  const entry = byPath.get(relPath);
  if (entry) {
    const pack = art.packs[entry[3]];
    const fd = fs.openSync(path.join(assetsRoot, 'packs', pack.file), 'r');
    const buf = Buffer.alloc(entry[2]);
    fs.readSync(fd, buf, 0, entry[2], entry[4]);
    fs.closeSync(fd);
    return buf;
  }
  const disk = path.join(assetsRoot, relPath.replace(/^\//, ''));
  return fs.existsSync(disk) ? fs.readFileSync(disk) : null;
}

function readJson(relPath) {
  const b = readPackBytes(relPath);
  return b ? JSON.parse(b.toString('utf8')) : null;
}

function gzipJsonBase64(obj) {
  return zlib.gzipSync(Buffer.from(JSON.stringify(obj), 'utf8'), { level: 9 }).toString('base64');
}

function webpDims(b) {
  if (!b) return null;
  if (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') {
    if (b.slice(12, 16).toString() === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (b.slice(12, 16).toString() === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
    }
    if (b.slice(12, 16).toString() === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  }
  if (b.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  }
  return null;
}

let aw = fs.readFileSync(path.join(assetsRoot, 'auto-worker465.js'), 'utf8');
aw = aw.replace(
  /\}\)\(\);\s*$/,
  ';globalThis.__EXP={C,oA,_E,s,o,D,t,i,w,sE,HA,SA,iE};})();',
);
const sandbox = {
  postMessage: () => {},
  setInterval: () => 0,
  clearInterval: () => {},
  onmessage: null,
  globalThis: null,
  Math,
  Date,
  JSON,
  Object,
  Array,
  Map,
  Set,
  Number,
  String,
  Boolean,
  RegExp,
  Error,
  atob: (b) => Buffer.from(b, 'base64').toString('binary'),
};
sandbox.globalThis = sandbox;
vm.runInNewContext(aw, sandbox);
const E = sandbox.__EXP;

const releaseScope = JSON.parse(
  fs.readFileSync(path.join(gameRoot, 'src/data/captured/release-scope.json'), 'utf8'),
);

// 1. 收集本地與碰撞表共有的全部 64 張地圖（0..37, 43..56, 99, 666, 16384..20992）
const localMapDirs = new Set(
  fs
    .readdirSync(path.join(assetsRoot, 'lineage163/maps'))
    .map((d) => Number(d))
    .filter((n) => !Number.isNaN(n)),
);
const VALID_MAPS = new Set();
const collision = {};
for (const [k, v] of Object.entries(E.C)) {
  const mId = Number(k.split('/')[0]);
  if (localMapDirs.has(mId)) {
    VALID_MAPS.add(mId);
    collision[k] = v;
  }
}

// 2. 全世界傳送點（含修正原版 uid=289 龍谷地監 1F -> 2F 誤植為地圖 3 的座標）
const portals = E.oA
  .map((p) => ({
    id: p.uid,
    map: Number(p.locM),
    x: Number(p.locX),
    y: Number(p.locY),
    toMap: p.uid === '289' ? 31 : Number(p.gotoM),
    toX: Number(p.gotoX),
    toY: Number(p.gotoY),
    heading: Number(p.gotoH || 4),
  }))
  .filter((p) => VALID_MAPS.has(p.map) && VALID_MAPS.has(p.toMap));

// 3. 怪物名稱正規化（韓文 브롭 -> 布拉伯）＋ LineageReal 缺漏地監（22/37/43/53..56/99）刷怪補充
const MOB_NAME_FIX = {
  브롭: '布拉伯',
};
const normalizeMobName = (name) => MOB_NAME_FIX[name] || name;

const spawns = E._E
  .filter((sp) => VALID_MAPS.has(Number(sp.map)))
  .map((sp) => ({
    id: String(sp.id),
    name: normalizeMobName(sp.name),
    map: Number(sp.map),
    x: Number(sp.x),
    y: Number(sp.y),
    count: Math.max(1, Number(sp.count || 1)),
    size: Number(sp.size || 6),
    respawnMs: Math.max(8000, Number(sp.respawn || 30000)),
    random: Boolean(sp.random) || (Number(sp.x) === 0 && Number(sp.y) === 0),
    villageAnimal: Boolean(sp.villageAnimal),
  }));

for (const sup of releaseScope.supplementalEncounters || []) {
  if (VALID_MAPS.has(Number(sup.map))) {
    const counts = {};
    for (const mName of sup.members || []) counts[mName] = (counts[mName] || 0) + 1;
    Object.entries(counts).forEach(([mName, cnt], idx) => {
      spawns.push({
        id: `${sup.id}-${idx}`,
        name: normalizeMobName(mName),
        map: Number(sup.map),
        x: Number(sup.x) + (idx === 0 ? 0 : 1),
        y: Number(sup.y) + (idx === 0 ? 0 : 1),
        count: cnt,
        size: Math.max(3, Number(sup.spread || 3)),
        respawnMs: 120000,
        random: false,
        villageAnimal: false,
        boss: mName === '克德',
      });
    });
  }
}

// 依據 https://lineagereal.com/account/map.php 補齊奇岩地監 1~4F、巨蟻洞穴、經典首領與安塔瑞斯棲息地刷怪
const LINEAGEREAL_DUNGEON_SPAWNS = [
  { id: 'lr-2-boss', name: '巴風特', map: 2, count: 1, respawnMs: 180000, boss: true },
  { id: 'lr-4-cyclops-dv', name: '獨眼巨人', map: 4, x: 33375, y: 32365, size: 12, count: 2, respawnMs: 90000 },
  { id: 'lr-4-cyclops-ww', name: '獨眼巨人', map: 4, x: 32885, y: 33395, size: 12, count: 2, respawnMs: 90000 },
  { id: 'lr-11-boss', name: '死靈騎士', map: 11, count: 1, respawnMs: 180000, boss: true },
  { id: 'lr-13-boss', name: '死靈騎士', map: 13, count: 1, respawnMs: 180000, boss: true },
  { id: 'lr-22-0', name: '蛇女', map: 22, count: 10 },
  { id: 'lr-37-0', name: '史萊姆', map: 37, count: 6 },
  { id: 'lr-37-1', name: '地元素精靈', map: 37, count: 6 },
  { id: 'lr-37-2', name: '安塔瑞斯', map: 37, count: 1, respawnMs: 180000, boss: true },
  { id: 'lr-43-0', name: '掃除蟻', map: 43, count: 10 },
  { id: 'lr-44-0', name: '巨型蟻兵', map: 44, count: 6 },
  { id: 'lr-44-1', name: '掃除蟻', map: 44, count: 6 },
  { id: 'lr-45-0', name: '巨型蟻兵', map: 45, count: 6 },
  { id: 'lr-45-1', name: '掃除蟻', map: 45, count: 6 },
  { id: 'lr-46-0', name: '巨型蟻兵', map: 46, count: 6 },
  { id: 'lr-46-1', name: '掃除蟻', map: 46, count: 6 },
  { id: 'lr-47-0', name: '巨型蟻兵', map: 47, count: 6 },
  { id: 'lr-47-1', name: '掃除蟻', map: 47, count: 6 },
  { id: 'lr-48-0', name: '巨型蟻兵', map: 48, count: 6 },
  { id: 'lr-48-1', name: '掃除蟻', map: 48, count: 6 },
  { id: 'lr-49-0', name: '巨型蟻兵', map: 49, count: 8 },
  { id: 'lr-50-0', name: '巨型蟻兵', map: 50, count: 8 },
  { id: 'lr-51-0', name: '巨型蟻兵', map: 51, count: 8 },
  { id: 'lr-51-boss', name: '巨蟻女皇', map: 51, count: 1, respawnMs: 180000, boss: true },
  { id: 'lr-53-0', name: '奇岩盜賊', map: 53, count: 18 },
  { id: 'lr-54-0', name: '奇岩盜賊', map: 54, count: 10 },
  { id: 'lr-54-1', name: '飢餓的囚犯', map: 54, count: 8 },
  { id: 'lr-54-2', name: '飢餓的盜賊囉嘍', map: 54, count: 6 },
  { id: 'lr-54-3', name: '強盜首領克萊恩', map: 54, count: 1, respawnMs: 120000, boss: true },
  { id: 'lr-55-0', name: '飢餓的囚犯', map: 55, count: 10 },
  { id: 'lr-55-1', name: '飢餓的盜賊囉嘍', map: 55, count: 10 },
  { id: 'lr-55-2', name: '靈魂狩獵者', map: 55, count: 5 },
  { id: 'lr-56-0', name: '奇岩盜賊', map: 56, count: 12 },
  { id: 'lr-56-1', name: '強盜', map: 56, count: 8 },
  { id: 'lr-56-2', name: '強盜首領克萊恩', map: 56, count: 1, respawnMs: 120000, boss: true },
  { id: 'lr-99-0', name: '食人妖精', map: 99, count: 4 },
];
for (const sp of LINEAGEREAL_DUNGEON_SPAWNS) {
  if (!VALID_MAPS.has(sp.map)) continue;
  spawns.push({
    id: sp.id,
    name: sp.name,
    map: sp.map,
    x: sp.x || 0,
    y: sp.y || 0,
    count: sp.count,
    size: sp.size || 8,
    respawnMs: sp.respawnMs || 28000,
    random: sp.x == null,
    villageAnimal: false,
    boss: Boolean(sp.boss),
  });
}

// 4. 怪物定義（保留全 E.s 並補齊缺漏 gfx 與 LineageReal 怪物）
const MOB_GFX_FALLBACK = {
  146: 255, // 楊格莫爾 -> 蜘蛛精靈
  6314: 1162, // 熊貓 -> 歐熊
  2544: 1245, // 林德拜爾 -> 飛龍王
};
const SUPPLEMENTAL_MONSTERS = {
  蛇女: { name: '蛇女', gfx: 1112, level: 21, hp: 120, mp: 30, ac: -6, str: 14, exp: 442, lawful: -25, range: 1, aggressive: true, aden: true, arrowGfx: 0 },
  地元素精靈: { name: '地元素精靈', gfx: 49, level: 55, hp: 1800, mp: 10, ac: -56, str: 24, exp: 5042, lawful: -25, range: 1, aggressive: true, aden: true, arrowGfx: 0 },
  掃除蟻: { name: '掃除蟻', gfx: 1037, level: 12, hp: 90, mp: 20, ac: -4, str: 12, exp: 145, lawful: -15, range: 1, aggressive: true, aden: true, arrowGfx: 0 },
  奇岩盜賊: { name: '奇岩盜賊', gfx: 1125, level: 30, hp: 220, mp: 10, ac: -42, str: 18, exp: 480, lawful: -20, range: 1, aggressive: true, aden: true, arrowGfx: 0 },
  飢餓的囚犯: { name: '飢餓的囚犯', gfx: 52, level: 45, hp: 600, mp: 430, ac: -40, str: 20, exp: 2026, lawful: -65, range: 1, aggressive: true, aden: true, arrowGfx: 0 },
  飢餓的盜賊囉嘍: { name: '飢餓的盜賊囉嘍', gfx: 1130, level: 45, hp: 550, mp: 480, ac: -40, str: 19, exp: 2026, lawful: -65, range: 2, aggressive: true, aden: true, arrowGfx: 0 },
  強盜首領克萊恩: { name: '強盜首領克萊恩', gfx: 110, level: 35, hp: 3000, mp: 10, ac: -60, str: 22, exp: 1800, lawful: -50, range: 2, aggressive: true, aden: true, arrowGfx: 0 },
  靈魂狩獵者: { name: '靈魂狩獵者', gfx: 1571, level: 50, hp: 1700, mp: 600, ac: -58, str: 24, exp: 2501, lawful: -50, range: 1, aggressive: true, aden: true, arrowGfx: 0 },
  強盜: { name: '強盜', gfx: 1132, level: 28, hp: 500, mp: 10, ac: -16, str: 18, exp: 785, lawful: -35, range: 1, aggressive: true, aden: true, arrowGfx: 0 },
  食人妖精: { name: '食人妖精', gfx: 1020, level: 22, hp: 250, mp: 30, ac: -6, str: 17, exp: 485, lawful: -25, range: 1, aggressive: true, aden: true, arrowGfx: 0 },
};

const PASSIVE_CRITTERS = new Set(['鹿', '白兔', '灰兔', '青蛙', '狐狸']);
const monsters = {};
for (const m of Object.values(E.s)) {
  if (!m?.name || m.name === '섬해골') continue;
  const rawGfx = Number(m.gfx);
  monsters[m.name] = {
    name: m.name,
    gfx: MOB_GFX_FALLBACK[rawGfx] ?? rawGfx,
    level: Number(m.level || 1),
    hp: Number(m.hp || 20),
    mp: Number(m.mp || 0),
    ac: Number(m.ac || 10),
    str: Number(m.str || 8),
    exp: Math.max(1, Number(m.exp || 5)),
    lawful: Number(m.lawful || 0),
    range: Math.max(1, Number(m.range || m.atk_range || 1)),
    aggressive: Boolean(m.aggressive),
    aden: Boolean(m.aden),
    arrowGfx: Number(m.arrowGfx || 0),
    isPassiveCritter: PASSIVE_CRITTERS.has(m.name),
  };
}
for (const [mName, m] of Object.entries(SUPPLEMENTAL_MONSTERS)) {
  monsters[mName] = { ...m, isPassiveCritter: false };
}

// 5. 韓文掉落道具名翻譯＋缺漏道具定義補完
const KOREAN_ITEM_MAP = {
  '빨간 물약': '紅色藥水',
  '주홍 물약': '橙色藥水',
  '맑은 물약': '白色藥水',
  '초록 물약': '綠色藥水',
  '강화 초록 물약': '強化綠色藥水',
  '파란 물약': '藍色藥水',
  '비취 물약': '翡翠藥水',
  '지혜의 물약': '慎重藥水',
  '용기의 물약': '勇敢藥水',
  '불투명 물약': '黑色藥水',
  '농축 체력 회복제': '濃縮體力恢復劑',
  '농축 고급 체력 회복제': '濃縮強力體力恢復劑',
  '농축 강력 체력 회복제': '濃縮終極體力恢復劑',
  '변신 주문서': '變形卷軸',
  '귀환 주문서': '傳送回家的卷軸',
  '순간이동 주문서': '瞬間移動的卷軸',
  '확인 주문서': '鑑定卷軸',
  '무기 마법 주문서': '對武器施法的卷軸',
  '갑옷 마법 주문서': '對盔甲施法的卷軸',
  '부활 주문서': '復活卷軸',
  '저주 풀기 주문서': '解除咀咒的卷軸',
  '빈 주문서 (레벨 1)': '空的魔法卷軸(等級1)',
  '빈 주문서 (레벨 2)': '空的魔法卷軸(等級2)',
  '빈 주문서 (레벨 3)': '空的魔法卷軸(等級3)',
  '빈 주문서 (레벨 4)': '空的魔法卷軸(等級4)',
  '빈 주문서 (레벨 5)': '空的魔法卷軸(等級5)',
  '해골의 두개골': '骨頭碎片',
  장검: '長劍',
  대검: '巨劍',
  양손검: '雙手劍',
  도끼: '斧',
  '대형 도끼': '巨斧',
  '전투 도끼': '戰斧',
  창: '矛',
  '넓은 창': '闊矛',
  미늘창: '戟',
  언월도: '巴迪須',
  루선해머: '露西錘',
  일본도: '武士刀',
  '싸울아비 장검': '瑟魯基之劍',
  '다마스커스 검': '大馬士革刀',
  '사냥꾼 활': '獵人之弓',
  화살: '箭',
  고기: '肉',
  당근: '胡蘿蔔',
  달걀: '蛋',
  에메랄드: '綠寶石',
  다이아몬드: '鑽石',
  사파이어: '藍寶石',
  루비: '紅寶石',
  '고급 다이아몬드': '品質鑽石',
  '고급 루비': '品質紅寶石',
  '고급 에메랄드': '品質綠寶石',
  '고급 사파이어': '品質藍寶石',
  '최고급 다이아몬드': '高品質鑽石',
  '최고급 루비': '高品質紅寶石',
  '최고급 에메랄드': '高品質綠寶石',
  '최고급 사파이어': '高品質藍寶石',
  紅寶實: '紅寶石',
  藍寶實: '藍寶石',
  品質紅寶實: '品質紅寶石',
  品質藍寶實: '品質藍寶石',
  品質綠寶實: '品質綠寶石',
  '짧은 장화': '短統靴',
  부츠: '長靴',
  장갑: '手套',
  '파워 글러브': '力量手套',
  '설인 장갑': '雪人手套',
  투구: '皮頭盔',
  '마법 방어 투구': '抗魔法頭盔',
  '마법의 투구: 치유': '治癒魔法頭盔',
  '마법의 투구: 힘': '力量魔法頭盔',
  '마법의 투구: 신속': '敏捷魔法頭盔',
  '기사의 면갑': '騎士面甲',
  '마법사 모자': '法師之帽',
  '마법사 옷': '法師長袍',
  '무명 로브': '綿質長袍',
  '마법 망토': '抗魔法斗篷',
  '보호 망토': '保護者斗篷',
  '투명 망토': '隱身斗篷',
  티셔츠: 'T恤',
  '고리 갑옷': '環甲',
  '비늘 갑옷': '鱗甲',
  '미늘 갑옷': '藤甲',
  '판금 갑옷': '金屬盔甲',
  '청동 판금 갑옷': '青銅盔甲',
  '수정 갑옷': '水晶盔甲',
  '띠 갑옷': '銀釘皮甲',
  '징박힌 가죽 갑옷': '銀釘皮背心',
  '마법 방어 사슬 갑옷': '抗魔法鏈甲',
  '큰 방패': '大盾牌',
  '사각 방패': '大盾牌',
  '반사 방패': '反射之盾',
  '미스릴 판금': '米索莉金屬板',
  '오리하루콘 판금': '奧里哈魯根金屬板',
  '미스릴 원석': '粗糙的米索莉塊',
  철괴: '金屬塊',
  동물가죽: '皮革',
  등잔: '燈籠',
  '燈籠용 기름': '燈油',
  정령옥: '精靈玉',
  '엘븐 와퍼': '精靈餅乾',
  '소나무 막대': '松木魔杖',
  '단풍나무 막대': '楓木魔杖',
  '흑단 막대': '烏木魔杖',
  '마력의 돌': '魔法寶石',
  '완력의 목걸이': '力量項鍊',
  '민첩의 목걸이': '敏捷項鍊',
  '체력의 목걸이': '體質項鍊',
  '지식의 목걸이': '智力項鍊',
  '지혜의 목걸이': '精神項鍊',
  '매력의 목걸이': '魅力項鍊',
  '순간이동 조종 반지': '傳送控制戒指',
  '변신 조종 반지': '變形控制戒指',
  '수령의 반지': '水靈戒指',
  '지령의 반지': '地靈戒指',
  '화령의 반지': '火靈戒指',
  '풍령의 반지': '風靈戒指',
  '신체의 벨트': '身體腰帶',
  '정신의 벨트': '精神腰帶',
  '영혼의 벨트': '靈魂腰帶',
  '낡은 신체의 벨트': '小型身體腰帶',
  '낡은 정신의 벨트': '小型精神腰帶',
  '낡은 영혼의 벨트': '小型靈魂腰帶',
  '타이탄의 벨트': '泰坦的腰帶',
  '트롤의 벨트': '食人妖精的腰帶',
  '오우거의 벨트': '歐格的腰帶',
  '오우거의 피': '食人巨魔的血',
  '인어의 비늘': '人魚的鱗片',
  '화룡 비늘': '火龍鱗',
  '수룡 비늘': '水龍鱗',
  '풍룡 비늘': '風龍鱗',
  '아시타지오의 재': '阿西塔吉奧的灰燼',
  '터틀 드래곤의 껍질': '海龜龍甲殼',
  '구울의 손톱': '食屍鬼的指甲',
  '구울의 이빨': '食屍鬼的牙齒',
  '생명의 비밀': '生命的秘密',
  '아투바 오크 마법서': '阿吐巴獸人魔法書',
  '간디 오크 마법서': '甘地獸人魔法書',
  '두다 마라 오크 마법서': '都達瑪拉獸人魔法書',
  '마법서 (웨폰 브레이크)': '魔法書 (壞物術)',
  '마법서 (피지컬 인챈트: STR)': '魔法書 (體魄強健術)',
  '마법서 (피지컬 인챈트: DEX)': '魔法書(通暢氣脈術)',
  '마법서 (헤이스트)': '魔法書 (加速術)',
  '마법서 (마나 드레인)': '魔法書 (魔力奪取)',
  '마법서 (다크니스)': '魔法書 (闇盲咒術)',
  '마법서 (캔슬레이션)': '魔法書 (魔法相消術)',
  '마법서 (콜 라이트닝)': '魔法書 (極道落雷)',
  '마법서 (풀 힐)': '魔法書 (全部治癒術)',
  '마법서 (위크니스)': '魔法書 (弱化術)',
  '마법서 (이뮨 투 함)': '魔法書 (聖結界)',
  '마법서 (서먼 몬스터)': '魔法書 (召喚術)',
  '마법서 (블레스 웨폰)': '魔法書 (創造魔法武器)',
  '마법서 (디스인티그레이트)': '魔法書 (究極光裂術)',
  '마법서 (아이스 랜스)': '魔法書 (冰矛圍籬)',
  '마법서 (슬로우)': '魔法書 (緩速術)',
  '마법서 (블리자드)': '魔法書 (冰雪暴)',
  '마법서 (리절렉션)': '魔法書 (返生術)',
  '마법서 (콘 오브 콜드)': '魔法書 (極光雷電)',
  '마법서 (리무브 커스)': '魔法書 (聖潔之光)',
  '마법서 (힐 올)': '魔法書 (終極治癒術)',
  '마법서 (파이어 스톰)': '魔法書 (火風暴)',
  '마법서 (선 버스트)': '魔法書 (烈炎術)',
  '마법서 (토네이도)': '魔法書 (龍捲風)',
  '마법서 (이럽션)': '魔法書 (地裂術)',
  '마법서 (어스 재일)': '魔法書 (岩牢)',
  '마법서 (테이밍 몬스터)': '魔法書 (迷魅術)',
  '마법서 (그레이터 힐)': '魔法書 (高級治癒術)',
  '마법서 (그레이터 헤이스트)': '魔法書 (強力加速術)',
  '마법서 (디케이 포션)': '魔法書 (藥水霜化術)',
  '마법서 (디지즈)': '魔法書 (疾病術)',
  '마법서 (파이어월)': '魔法書 (火牢)',
  '마법서 (파이어볼)': '魔法書 (燃燒的火球)',
  '마법서 (미티어 스트라이크)': '魔法書 (流星雨)',
  '마법서 (포그 오브 슬리핑)': '魔法書 (沉睡之霧)',
  '마법서 (뱀파이어릭 터치)': '魔法書 (吸血鬼之吻)',
  '마법서 (매스 텔리포트)': '魔法書 (集體傳送術)',
  '마법서 (인비지블리티)': '魔法書 (隱身術)',
  '마법서 (사일런스)': '魔法書 (魔法封印)',
  '마법서 (어스 퀘이크)': '魔法書 (震裂術)',
  '마법서 (메디테이션)': '魔法書 (冥想術)',
  '마법서 (카운터 매직)': '魔法書 (魔法屏障)',
  '마법서 (앱솔루트 배리어)': '魔法書 (絕對屏障)',
  '정령의 수정 (텔레포트 투 마더)': '精靈水晶(世界樹的呼喚)',
  '정령의 수정 (브레스 오브 파이어)': '精靈水晶(火焰武器)',
  '정령의 수정 (클리어 마인드)': '精靈水晶(淨化精神)',
  '정령의 수정 (블러드 투 소울)': '精靈水晶(魂體轉換)',
  '정령의 수정 (네이쳐스 터치)': '精靈水晶(生命之泉)',
  '정령의 수정 (네이쳐스 블레싱)': '精靈水晶(生命的祝福)',
  '정령의 수정 (레지스트 엘리멘트)': '精靈水晶(屬性防禦)',
  '정령의 수정 (어스 스킨)': '精靈水晶(大地防護)',
  '정령의 수정 (바디 투 마인드)': '精靈水晶(心靈轉換)',
  '정령의 수정 (버닝 웨폰)': '精靈水晶(烈炎武器)',
  '정령의 수정 (아이 오브 스톰)': '精靈水晶(暴風之眼)',
  '정령의 수정 (블레스 오브 어스)': '精靈水晶(大地的祝福)',
  '정령의 수정 (인탱글)': '精靈水晶(地面障礙)',
  '정령의 수정 (윈드 워크)': '精靈水晶(風之疾走)',
  '정령의 수정 (아이언 스킨)': '精靈水晶(鋼鐵防護)',
  '정령의 수정 (이레이즈 매직)': '精靈水晶(魔法消除)',
  '정령의 수정 (어스 바인드)': '精靈水晶(大地屏障)',
  '정령의 수정 (파이어 웨폰)': '精靈水晶(火焰武器)',
  '정령의 수정 (에어리어 오브 사일런스)': '精靈水晶(封印禁地)',
  '정령의 수정 (윈드 샷)': '精靈水晶(風之神射)',
  '정령의 수정 (레지스트 매직)': '精靈水晶(魔法防禦)',
  '정령의 수정 (스톰 샷)': '精靈水晶(暴風神射)',
};
const normalizeItemName = (raw) => KOREAN_ITEM_MAP[raw] || raw;

const drops = {};
for (const d of E.iE) {
  const mName = normalizeMobName(d.monster_name || d.name);
  if (!monsters[mName]) continue;
  if (!drops[mName]) drops[mName] = [];
  const item = normalizeItemName(d.item_name);
  if (!item || item === 'null') continue;
  drops[mName].push({
    item,
    min: Math.max(1, Number(d.count_min || 1)),
    max: Math.max(1, Number(d.count_max || 1)),
    chance: Math.max(1, Number(d.chance || 10000)),
  });
}

const SUPPLEMENTAL_DROPS = {
  安塔瑞斯: [
    { item: '傳送控制戒指', min: 1, max: 1, chance: 180000 },
    { item: '變形控制戒指', min: 1, max: 1, chance: 180000 },
    { item: '地龍鱗', min: 1, max: 2, chance: 450000 },
    { item: '高品質鑽石', min: 1, max: 1, chance: 400000 },
    { item: '對武器施法的卷軸', min: 1, max: 1, chance: 500000 },
  ],
  靈魂狩獵者: [
    { item: '保護者斗篷', min: 1, max: 1, chance: 80000 },
    { item: '金屬盔甲', min: 1, max: 1, chance: 80000 },
    { item: '敏捷項鍊', min: 1, max: 1, chance: 60000 },
    { item: '勇敢藥水', min: 1, max: 2, chance: 220000 },
  ],
  飢餓的囚犯: [
    { item: '紅色藥水', min: 1, max: 3, chance: 260000 },
    { item: '綠色藥水', min: 1, max: 1, chance: 140000 },
  ],
  飢餓的盜賊囉嘍: [
    { item: '箭', min: 15, max: 40, chance: 260000 },
    { item: '橙色藥水', min: 1, max: 2, chance: 180000 },
  ],
  強盜首領克萊恩: [
    { item: '對武器施法的卷軸', min: 1, max: 1, chance: 120000 },
    { item: '對盔甲施法的卷軸', min: 1, max: 1, chance: 140000 },
    { item: '綠色藥水', min: 1, max: 3, chance: 350000 },
  ],
  奇岩盜賊: [
    { item: '紅色藥水', min: 1, max: 2, chance: 220000 },
    { item: '對盔甲施法的卷軸', min: 1, max: 1, chance: 30000 },
  ],
  地元素精靈: [
    { item: '元素石', min: 1, max: 2, chance: 250000 },
    { item: '地靈戒指', min: 1, max: 1, chance: 60000 },
  ],
  蛇女: [
    { item: '翡翠藥水', min: 1, max: 2, chance: 260000 },
    { item: '解毒藥水', min: 1, max: 2, chance: 200000 },
  ],
  食人妖精: [
    { item: '戰斧', min: 1, max: 1, chance: 90000 },
    { item: '對武器施法的卷軸', min: 1, max: 1, chance: 40000 },
  ],
  布拉伯: [
    { item: '短劍的劍身', min: 1, max: 1, chance: 180000 },
    { item: '長劍的劍身', min: 1, max: 1, chance: 100000 },
    { item: '奧里哈魯根的劍身', min: 1, max: 1, chance: 55000 },
    { item: '覆上米索莉的角', min: 1, max: 1, chance: 120000 },
    { item: '覆上奧里哈魯根的角', min: 1, max: 1, chance: 60000 },
    { item: '魔法寶石', min: 1, max: 3, chance: 260000 },
  ],
};
for (const [mName, list] of Object.entries(SUPPLEMENTAL_DROPS)) {
  drops[mName] = list;
}

// 補充製作材料掉落（採累加合併，保留原始掉落表）
const ADDITIONAL_DROPS = {
  狼人: [{ item: '原木', min: 1, max: 2, chance: 180000 }],
  歐格: [
    { item: '原木', min: 1, max: 3, chance: 220000 },
    { item: '木材', min: 2, max: 4, chance: 140000 },
  ],
  吐魯番獸人: [{ item: '原木', min: 1, max: 2, chance: 140000 }],
  岩石魔怪: [{ item: '元素石', min: 1, max: 2, chance: 120000 }],
  土咒師: [{ item: '元素石', min: 1, max: 3, chance: 350000 }],
  火咒師: [{ item: '元素石', min: 1, max: 3, chance: 350000 }],
  風咒師: [{ item: '元素石', min: 1, max: 3, chance: 350000 }],
  水咒師: [{ item: '元素石', min: 1, max: 3, chance: 350000 }],
  黑咒師: [{ item: '元素石', min: 1, max: 3, chance: 350000 }],
  卡司托: [
    { item: '芮克妮的網', min: 2, max: 5, chance: 260000 },
    { item: '芮克妮的蛻皮', min: 1, max: 1, chance: 100000 },
    { item: '元素石', min: 1, max: 2, chance: 140000 },
  ],
  地靈: [
    { item: '安特之樹枝', min: 2, max: 5, chance: 240000 },
    { item: '安特之樹皮', min: 1, max: 2, chance: 150000 },
    { item: '精靈粉末', min: 5, max: 12, chance: 200000 },
    { item: '元素石', min: 1, max: 1, chance: 160000 },
  ],
  艾多倫: [
    { item: '潘的鬃毛', min: 1, max: 3, chance: 220000 },
    { item: '安特之樹枝', min: 2, max: 5, chance: 220000 },
  ],
  蘑菇: [{ item: '安特之樹枝', min: 1, max: 3, chance: 180000 }],
  奇岩盜賊: [
    { item: '紅色布料', min: 1, max: 1, chance: 90000 },
    { item: '藍色布料', min: 1, max: 1, chance: 90000 },
    { item: '白色布料', min: 1, max: 2, chance: 120000 },
  ],
};
for (const [mName, list] of Object.entries(ADDITIONAL_DROPS)) {
  const existing = drops[mName] || [];
  const seen = new Set(existing.map((e) => e.item));
  const toAdd = list.filter((e) => !seen.has(e.item));
  if (toAdd.length > 0) drops[mName] = [...existing, ...toAdd];
}

// 6. 全 64 張地圖 NPC 與商店（44 個原版缺少的 NPC 圖編號一律對映到封包既有精靈）
const NPC_GFX_FALLBACK = {
  143: 54, // 矮人倉庫（朵琳／索連／凱倫／高特／克哈丁／巴歐／寶金／諾丁／蘇瑞耳／托芬）
  147: 940, // 港口主人
  148: 51, // 城門／市鎮長矛警衛
  266: 98, // 歐林（古魯丁地監 7F 神秘商人）
  696: 721,
  697: 723,
  698: 725,
  699: 695,
  700: 695, // 旅館老闆娘（羅利雅／莫莉）
  701: 705,
  702: 706,
  703: 727,
  792: 940, // 胡帕／凱文等
  793: 940, // 卡爾等
  794: 940, // 班曲／喬治等
  797: 796,
  798: 721,
  799: 725,
  800: 704,
  895: 864, // 娜魯帕（精靈匠師）
  896: 864, // 精靈女皇
  924: 916,
  925: 918,
  982: 704, // 馬賓／漢斯（馴獸師）
  984: 237, // 凱瑟／格林
  986: 988,
  989: 695, // 維萊莎（風木旅館）
  990: 981, // 梅林
  991: 695, // 米蘭德（銀騎旅館）
  992: 705,
  1505: 1256,
  1507: 1276,
  1508: 1286,
  1509: 1298,
  1510: 1307,
  1511: 1276,
  1513: 1256,
  1514: 1312,
  1515: 1298,
  1528: 1286,
  1529: 1298,
  1530: 1307,
  1531: 1276,
  1532: 1256,
};
const cleanNpcName = (name) =>
  String(name || '')
    .replace(/\(기\)/g, '(奇岩)')
    .replace(/^윈성\s*/, '風木城 ');

const npcs = E.o
  .filter((n) => VALID_MAPS.has(Number(n.map)))
  .map((n) => ({
    id: n.id,
    name: cleanNpcName(n.name),
    map: Number(n.map),
    x: Number(n.mx),
    y: Number(n.my),
    gfx: Number(n.sprite),
    renderGfx: NPC_GFX_FALLBACK[Number(n.sprite)] ?? Number(n.sprite),
    heading: Number(n.heading || 4) % 8,
    type: n.type,
    shop: Boolean(n.shop),
  }));

const EXTRA_GIRANS_TELEPORTERS = [
  {
    id: 'npc-giran-plaza-tp',
    name: '奇岩傳送師',
    map: 4,
    x: 33433,
    y: 32818,
    gfx: 940,
    renderGfx: 940,
    heading: 5,
    type: 'Teleport',
    shop: false,
  },
  {
    id: 'npc-giran-inner-tp',
    name: '奇岩內城傳送師',
    map: 52,
    x: 32740,
    y: 32815,
    gfx: 940,
    renderGfx: 940,
    heading: 4,
    type: 'Teleport',
    shop: false,
  },
];
for (const tp of EXTRA_GIRANS_TELEPORTERS) {
  if (!npcs.some((n) => n.id === tp.id)) npcs.push(tp);
}

const shops = {};
for (const row of E.i) {
  if (!row.sell) continue;
  const npcName = cleanNpcName(row.npc);
  const itemName = normalizeItemName(row.item);
  if (!shops[npcName]) shops[npcName] = [];
  const itemDef = E.t[itemName];
  const unitPrice = row.price > 0 ? row.price : Math.max(1, Number(itemDef?.price || 10));
  if (!shops[npcName].some((x) => x.item === itemName && x.plus === row.plus)) {
    shops[npcName].push({
      item: itemName,
      count: Number(row.count || 1),
      plus: Number(row.plus || 0),
      price: unitPrice,
    });
  }
}

// 7. 道具表：納入全 E.t 398 項道具，並為掉落／獎勵中新譯名補上合適圖示與規格
const groundJson = readJson('/lineage163/ground-items79.json') || {};
const groundPackedSet = new Set(
  art.assets
    .map((a) => a[0])
    .filter((p) => p.startsWith('/lineage163/ground-items79/'))
    .map((p) => p.split('/').pop().replace(/\..+$/, '')),
);

const items = {};
for (const [rawName, it] of Object.entries(E.t)) {
  if (!it) continue;
  const name = normalizeItemName(rawName);
  if (items[name] && rawName !== name) continue;
  const spStr = String(it.sprite ?? '');
  items[name] = {
    name,
    kind: it.kind,
    type: it.type,
    small: Number(it.small || 0),
    large: Number(it.large || 0),
    ac: Number(it.ac || 0),
    hit: Number(it.hit || 0),
    damage: Number(it.damage || 0),
    safe: Number(it.safe || 0),
    enchant: Boolean(it.enchant),
    stack: Boolean(it.stack),
    twoHand: Boolean(it.twoHand),
    weight: Number(it.weight || 0),
    price: Number(it.price || 0),
    icon: Number(it.icon || 0),
    groundGfx: groundPackedSet.has(spStr) ? Number(spStr) : null,
    effect: Number(it.effect || 0),
    classes: Array.isArray(it.classes) ? it.classes : [1, 1, 1, 1],
    hp: Number(it.hp || 0),
    mp: Number(it.mp || 0),
    sp: Number(it.sp || 0),
    mr: Number(it.mr || 0),
    str: Number(it.str || 0),
    con: Number(it.con || 0),
    dex: Number(it.dex || 0),
    int: Number(it.int || 0),
    wis: Number(it.wis || 0),
    cha: Number(it.cha || 0),
    regenHp: Number(it.regenHp || 0),
    regenMp: Number(it.regenMp || 0),
    hitMelee: Number(it.hitMelee || 0),
    hitBow: Number(it.hitBow || 0),
    dmgMelee: Number(it.dmgMelee || 0),
    dmgBow: Number(it.dmgBow || 0),
    dr: Number(it.dr || 0),
    maxWeightBonus: Number(it.maxWeightBonus || 0),
    elem: null,
    special: it.special || '',
  };
}

function synthesizeMissingItem(name) {
  const base = {
    name,
    kind: 'item',
    type: 'etc',
    small: 0,
    large: 0,
    ac: 0,
    hit: 0,
    damage: 0,
    safe: 0,
    enchant: false,
    stack: false,
    twoHand: false,
    weight: 5,
    price: 500,
    icon: 235,
    groundGfx: 773,
    effect: 0,
    classes: [1, 1, 1, 1],
    hp: 0,
    mp: 0,
    sp: 0,
    mr: 0,
    str: 0,
    con: 0,
    dex: 0,
    int: 0,
    wis: 0,
    cha: 0,
    regenHp: 0,
    regenMp: 0,
    hitMelee: 0,
    hitBow: 0,
    dmgMelee: 0,
    dmgBow: 0,
    dr: 0,
    maxWeightBonus: 0,
    elem: null,
    special: '',
  };
  if (name.startsWith('魔法書') || name.startsWith('精靈水晶') || name.includes('魔法書')) {
    return { ...base, kind: 'book', icon: 248, groundGfx: 776, weight: 7, price: 3000 };
  }
  if (name.includes('卷軸')) {
    return { ...base, icon: 468, groundGfx: 22, weight: 1, stack: true, price: 1200 };
  }
  if (name.includes('腰帶')) {
    return { ...base, kind: 'armor', type: 'belt', icon: 264, groundGfx: 1165, ac: 0, hp: name.includes('身體') ? 20 : 0, mp: name.includes('精神') ? 20 : 0, weight: 50, price: 12000 };
  }
  if (name.includes('戒指')) {
    return { ...base, kind: 'armor', type: 'ring', icon: 87, groundGfx: 21, weight: 3, price: 15000 };
  }
  if (name.includes('盔甲')) {
    return { ...base, kind: 'armor', type: 'armor', icon: 73, groundGfx: 9, ac: 5, safe: 4, enchant: true, weight: 280, price: 25000 };
  }
  if (name.includes('頭盔')) {
    return { ...base, kind: 'armor', type: 'helm', icon: 55, groundGfx: 18, ac: 2, safe: 4, enchant: true, weight: 35, price: 12000 };
  }
  if (name.includes('長靴')) {
    return { ...base, kind: 'armor', type: 'boot', icon: 435, groundGfx: 25, ac: 2, safe: 4, enchant: true, weight: 20, price: 9000 };
  }
  if (name.includes('手套')) {
    return { ...base, kind: 'armor', type: 'glove', icon: 141, groundGfx: 182, ac: 1, safe: 4, enchant: true, weight: 12, price: 8000 };
  }
  if (name.includes('盾')) {
    return { ...base, kind: 'armor', type: 'shield', icon: 55, groundGfx: 18, ac: 2, safe: 4, enchant: true, weight: 40, price: 8000 };
  }
  if (name.includes('寶石')) {
    return { ...base, icon: 242, groundGfx: 774, weight: 1, stack: true, price: 3500 };
  }
  if (name.includes('精靈玉')) {
    return { ...base, icon: 235, groundGfx: 773, weight: 1, stack: true, price: 150 };
  }
  return base;
}

const SUPPLEMENTAL_ITEMS = {
  原木: { ...synthesizeMissingItem('原木'), stack: true, weight: 5, price: 20, icon: 309, groundGfx: 881 },
  木材: { ...synthesizeMissingItem('木材'), stack: true, weight: 1, price: 8, icon: 311, groundGfx: 883 },
};
for (const [sName, def] of Object.entries(SUPPLEMENTAL_ITEMS)) {
  if (!items[sName]) items[sName] = def;
}

for (const rows of Object.values(drops)) {
  for (const d of rows) {
    if (!items[d.item]) items[d.item] = synthesizeMissingItem(d.item);
  }
}
for (const rows of Object.values(shops)) {
  for (const r of rows) {
    if (!items[r.item]) items[r.item] = synthesizeMissingItem(r.item);
  }
}

// 依 LineageReal 資料庫校正武器與防具素質（保留未開放項原值）
const lrOverridesPath = path.join(gameRoot, 'tools/lineagereal-overrides.json');
if (fs.existsSync(lrOverridesPath)) {
  const lrOverrides = JSON.parse(fs.readFileSync(lrOverridesPath, 'utf8'));
  for (const [name, patch] of Object.entries(lrOverrides)) {
    const target = items[name];
    if (!target) continue;
    const { elem, ...rest } = patch;
    Object.assign(target, rest);
    if (elem && Object.values(elem).some((v) => Number(v) !== 0)) {
      target.elem = {
        water: Number(elem.water || 0),
        wind: Number(elem.wind || 0),
        fire: Number(elem.fire || 0),
        earth: Number(elem.earth || 0),
      };
    } else {
      target.elem = null;
    }
  }
}

// 8. 法術（1~6 級經典法術）
const effectJson = readJson('/lineage163/effects.json') || {};
const spells = E.D.filter((sp) => Number(sp['사용레벨'] || 99) <= 6)
  .map((sp) => {
    const id = Number(sp['마법아이디']);
    const eff = Number(sp['이팩트'] || 0);
    return {
      id,
      name: sp['마법이름'],
      level: Number(sp['사용레벨']),
      mp: Number(sp['소모MP'] || 0),
      hp: Number(sp['소모HP'] || 0),
      duration: Number(sp['버프지속시간'] || 0),
      minDmg: Number(sp['최소데미지'] || 0),
      maxDmg: Number(sp['최대데미지'] || 0),
      range: Number(sp['범위'] || 0),
      delay: Number(sp.delay || 800),
      element: sp.element || 'none',
      effect: effectJson[String(eff)] ? eff : 167,
      hasIcon: byPath.has(`/lineage163/all-magic-v2/${id}.png`),
    };
  });

// 9. 職業初始與成長
const classMap = {
  royal: { id: 'royal', clsIdx: 0, prefix: 'royal' },
  knight: { id: 'knight', clsIdx: 1, prefix: 'knight' },
  elf: { id: 'elf', clsIdx: 2, prefix: 'elf' },
  mage: { id: 'mage', clsIdx: 3, prefix: 'wizard' },
};
const classes = {};
for (const [id, info] of Object.entries(classMap)) {
  const p = info.prefix;
  const [sx, sy, sm] = String(E.w[`${p}_spawn`] || '32578 32943 0')
    .split(/\s+/)
    .map(Number);
  const invRaw = String(E.w[`${p}_first_inventory`] || '');
  const startItems = invRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^(.+)\((\d+)\)$/);
      return m ? { name: m[1].trim(), count: Number(m[2]) } : { name: s, count: 1 };
    });
  classes[id] = {
    id,
    clsIdx: info.clsIdx,
    spawn: { map: sm || 0, x: sx || 32578, y: sy || 32943 },
    maleGfx: Number(E.w[`${p}_male_gfx`]),
    femaleGfx: Number(E.w[`${p}_female_gfx`]),
    baseHp: Number(E.w[`${p}_hp`] || 14),
    baseMp: Number(E.w[`${p}_mp`] || 2),
    maxHpCap: Number(E.w[`${p}_max_hp`] || 1000),
    maxMpCap: Number(E.w[`${p}_max_mp`] || 600),
    stats: {
      str: Number(E.w[`${p}_stat_str`] || 12),
      con: Number(E.w[`${p}_stat_con`] || 12),
      dex: Number(E.w[`${p}_stat_dex`] || 10),
      wis: Number(E.w[`${p}_stat_wis`] || 10),
      cha: Number(E.w[`${p}_stat_cha`] || 10),
      int: Number(E.w[`${p}_stat_int`] || 10),
    },
    startItems,
  };
}

const ABILITY_CLASS_BASE = {
  royal: { baseHp: 14, baseMp: 2, stats: { str: 13, dex: 10, con: 10, wis: 11, cha: 13, int: 10 } },
  knight: { baseHp: 16, baseMp: 1, stats: { str: 16, dex: 12, con: 14, wis: 9, cha: 12, int: 8 } },
  elf: { baseHp: 15, baseMp: 4, stats: { str: 11, dex: 12, con: 12, wis: 12, cha: 9, int: 12 } },
  mage: { baseHp: 12, baseMp: 6, stats: { str: 8, dex: 7, con: 12, wis: 12, cha: 8, int: 12 } },
};
for (const [id, ov] of Object.entries(ABILITY_CLASS_BASE)) {
  if (classes[id]) {
    classes[id].baseHp = ov.baseHp;
    classes[id].baseMp = ov.baseMp;
    classes[id].stats = { ...ov.stats };
  }
}

// 10. 全 64 張地圖區塊清單與高畫質重繪查找表（以 gzip 壓縮維持單檔輕量）
const mapsJson = readJson('/lineage163/maps.json') || {};
const retainedChunks = {};
for (const mId of VALID_MAPS) {
  retainedChunks[String(mId)] = mapsJson[String(mId)] || [];
}

function pickChunks(manifestPath) {
  const man = readJson(manifestPath);
  const out = {};
  if (!man?.chunks) return out;
  for (const [ck, cv] of Object.entries(man.chunks)) {
    const mId = Number(ck.split('/')[0]);
    if (VALID_MAPS.has(mId)) out[ck] = cv;
  }
  return out;
}

const redrawLayers = {
  houses: pickChunks('/lineage163/village-houses-v3/manifest.json'),
  fences: pickChunks('/lineage163/fences-trees-v1/manifest.json'),
  scenery: pickChunks('/lineage163/scenery-redraw-v1/manifest.json'),
  village: pickChunks('/lineage163/village-redraw-v3/manifest.json'),
};

// 11. 精靈目錄與幾何查找（涵蓋全部 8 主角、全怪物、全變身與全 NPC）
const playerAtlasesFull = readJson('/lineage163/player-atlases.json') || {};
const seqJson = readJson('/lineage163/sequences.json') || {};
const motJson = readJson('/lineage163/motions.json') || {};
const actorsJson = readJson('/lineage163/actors.json') || {};
const geom71 = readJson('/lineage163/actor-geometry71.json') || {};
const animSoundsJson = readJson('/lineage163/animation-sounds.json') || {};

const playerGfxList = [0, 1, 61, 48, 138, 37, 734, 1186];
const extraMorphAndPetGfx = [94, 1477, 32, 30, 110, 931, 96, 936];
const neededGfx = new Set([
  ...playerGfxList,
  ...extraMorphAndPetGfx,
  ...Object.values(monsters).map((m) => m.gfx),
  ...npcs.map((n) => n.renderGfx),
]);

const gfxDirCandidates = new Map();
for (const p of byPath.keys()) {
  const m = p.match(/^\/lineage163\/([^/]+)\/(\d+)-(\d+)\.(webp|png)$/);
  if (!m) continue;
  const [, dir, gStr, actStr, ext] = m;
  const g = Number(gStr);
  if (!neededGfx.has(g)) continue;
  if (!gfxDirCandidates.has(g)) gfxDirCandidates.set(g, new Map());
  const byDir = gfxDirCandidates.get(g);
  if (!byDir.has(dir)) byDir.set(dir, {});
  byDir.get(dir)[Number(actStr)] = ext;
}

const CUSTOM_DIR_PRIORITY = [
  'goblin-full-animation-v2',
  'orc-beast-v7',
  'orc-archer-beast-v1',
  'orc-warrior-full-v12',
  'orc-amethyst-v3',
  'frog-native-animation-v2',
  'floating-demon-eye-full-v7',
  'white-robed-sorcerer-v1',
  'shargo-v2-animation',
  'living-dead-native-v18',
  'rock-monster-full-v1',
  'werewolf-v9-lean-humanoid-v1',
  'slime-pink-death-v6',
  'skull-bone-native-v4',
  'skull-bone-archer-v1',
  'corpse-devourer-full-v4',
  'sparto-native-v3',
  'gnome-animation-v2',
  'wolf-slate-animation-v5',
  'doberman-v4-animation',
  'rabbit-two-colors-v2',
  'deer-natural-edge-v3',
  'kede-shield-v1',
  'dark-knight-shield-v6',
  'guards-fitted-silver-v5',
  'jansen-animation-v2',
  'basin-animation-v2',
  'selena-animation-v2',
  'judith-animation-v2',
  'lian-animation-v2',
  'mona-animation-v2',
  'fin-animation-v2',
  'ladar-animation-v2',
  'lucas-animation-v2',
  'geren-animation-v2',
  'touma-animation-v2',
  'farin-animation-v2',
  'pandora-animation-v2',
  'training-dummy-native-v2',
];

const spriteMeta = {};
for (const g of neededGfx) {
  const gStr = String(g);
  const info = {
    gfx: g,
    kind: playerGfxList.includes(g) ? 'player' : 'actor',
    dir: null,
    acts: {},
    geom: {},
    seq: seqJson[gStr] || null,
    mot: motJson[gStr] || null,
    sounds: animSoundsJson[gStr] || null,
  };

  if (info.kind === 'player') {
    const atl = {};
    for (const [k, v] of Object.entries(playerAtlasesFull)) {
      if (k.startsWith(gStr + '-')) {
        atl[k.slice(gStr.length + 1)] = {
          f: v.file,
          r: v.rects,
          w: v.width || 128,
          h: v.height || 160,
          x: v.x ?? -64,
          y: v.y ?? -148,
        };
      }
    }
    info.atlas = atl;
  } else {
    const byDir = gfxDirCandidates.get(g) || new Map();
    const chosenDir =
      CUSTOM_DIR_PRIORITY.find((d) => byDir.has(d)) ||
      [...byDir.keys()].find((d) => d !== 'creatures600' && d !== 'actors-webp' && d !== 'actors-full') ||
      [...byDir.keys()][0] ||
      null;
    info.dir = chosenDir;
    const actMap = chosenDir ? byDir.get(chosenDir) : {};
    info.acts = actMap;
    const dirGeom = chosenDir ? readJson(`/lineage163/${chosenDir}/geometry.json`) : null;
    for (const [actStr, ext] of Object.entries(actMap)) {
      const aKey = `${g}-${actStr}`;
      const frames = Number(E.HA[aKey] || actorsJson[aKey] || 0);
      let gEntry = E.SA[aKey] || geom71[aKey] || null;
      if (!gEntry && dirGeom) {
        gEntry = dirGeom[aKey] || dirGeom[Object.keys(dirGeom).find((k) => k.endsWith('-' + actStr))] || null;
      }
      if (gEntry) {
        info.geom[actStr] = {
          w: gEntry.width,
          h: gEntry.height,
          x: gEntry.x,
          y: gEntry.y,
          n: Number(gEntry.frames || frames || 1),
        };
      } else {
        const dims = webpDims(readPackBytes(`/lineage163/${chosenDir}/${g}-${actStr}.${ext}`));
        let n = frames;
        if (!n && dims) {
          if (dims[1] === 160 || dims[1] === 256 || dims[1] === 320 || dims[1] === 224) {
            n = Math.max(1, Math.round(dims[0] / (dims[1] === 160 ? 128 : dims[1] === 224 ? 192 : dims[1])));
          } else {
            n = Math.max(1, Math.round(dims[0] / Math.max(24, Math.min(dims[1], 64))));
          }
        }
        const cw = dims && n ? Math.round(dims[0] / n) : 64;
        const ch = dims ? dims[1] : 64;
        info.geom[actStr] = {
          w: cw,
          h: ch,
          x: -Math.round(cw / 2),
          y: ch >= 160 ? -(ch - 48) : -(ch - 12),
          n: n || 1,
        };
        if (ch === 320 && cw === 320) {
          info.geom[actStr].x = -160;
          info.geom[actStr].y = -240;
        } else if (ch === 256 && cw === 256) {
          info.geom[actStr].x = -128;
          info.geom[actStr].y = -208;
        } else if (ch === 160 && cw === 128) {
          info.geom[actStr].x = -64;
          info.geom[actStr].y = -132;
        } else if (ch === 224 && cw === 192) {
          info.geom[actStr].x = -96;
          info.geom[actStr].y = -176;
        }
      }
    }
  }
  spriteMeta[gStr] = info;
}

// 12. 效果圖檔幀數幾何資訊
const effectsMeta = {};
for (const [eid, e] of Object.entries(effectJson)) {
  const variant = e.variants?.['0'] || `${eid}-0.webp`;
  const dims = webpDims(readPackBytes(`/lineage163/effects/${variant}`));
  const seqList = e.sequence || [];
  const maxIdx = seqList.reduce((acc, [fi]) => Math.max(acc, fi), 0);
  const frames = Math.max(1, maxIdx + 1);
  effectsMeta[eid] = {
    id: Number(eid),
    file: variant,
    seq: seqList,
    duration: Number(e.duration || 400),
    sounds: e.sounds || {},
    w: dims ? Math.round(dims[0] / frames) : 128,
    h: dims ? dims[1] : 128,
    frames,
  };
}
const lvlDef = readJson('/level-up-v1/definition.json');
if (lvlDef) {
  const b = readPackBytes('/lineage163/effects/751-0.webp');
  effectsMeta['levelup'] = {
    id: 2127,
    file: '/level-up-v1/2127-0.webp',
    seq: Array.from({ length: Number(lvlDef.frames || 16) }, (_, k) => [k, 2]),
    duration: 1200,
    sounds: { 0: '/level-up-v1/517.wav' },
    w: Number(lvlDef.width || 256),
    h: Number(lvlDef.height || 256),
    frames: Number(lvlDef.frames || 16),
    rawPath: true,
    legacyDims: b ? webpDims(b) : null,
  };
}

// 13. 收錄完整原版 NPC 對話 HTML（dialogues.json 全 911 筆，經 gzip 僅 ~120 KB）
const allDlgs = readJson('/lineage163/dialogues.json') || {};

const validTiles = art.assets
  .map((a) => a[0])
  .filter((p) => /^\/lineage163\/tiles-lossless-v1\/\d+\.webp$/.test(p))
  .map((p) => Number(p.split('/').pop().replace('.webp', '')))
  .sort((a, b) => a - b);

const validIcons = art.assets
  .map((a) => a[0])
  .filter((p) => /^\/lineage163\/item-icons\/\d+\.png$/.test(p))
  .map((p) => Number(p.split('/').pop().replace('.png', '')))
  .sort((a, b) => a - b);

const validSounds = art.assets
  .map((a) => a[0])
  .filter((p) => /^\/lineage163\/sound-mp3-v1\/\d+\.mp3$/.test(p))
  .map((p) => Number(p.split('/').pop().replace('.mp3', '')))
  .sort((a, b) => a - b);

const out = {
  version: '286-world-v2',
  mapIds: [...VALID_MAPS].sort((a, b) => a - b),
  expTable: E.sE,
  classes,
  portals,
  spawns,
  monsters,
  drops,
  npcs,
  shops,
  items,
  spells,
  groundItems: groundJson,
  retainedChunks,
  redrawLayersGz: gzipJsonBase64(redrawLayers),
  collisionGz: gzipJsonBase64(collision),
  spriteMeta,
  effectsMeta,
  dialoguesGz: gzipJsonBase64(allDlgs),
  validTiles,
  validIcons,
  validSounds,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out));
const stats = fs.statSync(outPath);
const missingMobGfx = Object.values(monsters).filter((m) => !spriteMeta[String(m.gfx)]?.dir && !spriteMeta[String(m.gfx)]?.atlas);
const missingNpcGfx = npcs.filter((n) => !spriteMeta[String(n.renderGfx)]?.dir && !spriteMeta[String(n.renderGfx)]?.atlas);
console.log(
  `Extracted ${outPath}: ${(stats.size / 1024).toFixed(1)} KB ` +
    `(maps=${out.mapIds.length}, chunks=${Object.keys(collision).length}, portals=${portals.length}, ` +
    `mobs=${Object.keys(monsters).length}, spawns=${spawns.length}, npcs=${npcs.length}, ` +
    `shops=${Object.keys(shops).length}, items=${Object.keys(items).length}, ` +
    `sprites=${Object.keys(spriteMeta).length}, dialogues=${Object.keys(allDlgs).length}, ` +
    `missMobGfx=${missingMobGfx.length}, missNpcGfx=${missingNpcGfx.length})`,
);
