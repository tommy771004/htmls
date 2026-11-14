// 286 天堂實境客戶端：全 64 張地圖規格、城鎮安全區、傳送師／渡船航線與最近回村解析
// 規則與地圖名稱對齊 https://lineagereal.com/account/maps.php 與原版 1.63 對話行動

export const MAP_META = {
  0: { id: 0, name: '說話之島', category: 'island', tele: true, recall: true, mark: true, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'field' },
  1: { id: 1, name: '冒險洞窟 1樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  2: { id: 2, name: '冒險洞窟 2樓', category: 'dungeon', tele: false, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  3: { id: 3, name: '甘特之屋', category: 'town', tele: false, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'town' },
  4: { id: 4, name: '亞丁大陸', category: 'mainland', tele: true, recall: true, mark: true, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'field' },
  5: { id: 5, name: '說話之島往古魯丁的船', category: 'ship', tele: false, recall: true, mark: false, resurrect: true, penalty: true, takePets: false, recallPets: false, bgm: 'field' },
  6: { id: 6, name: '亞丁大陸往說話之島的船', category: 'ship', tele: false, recall: true, mark: false, resurrect: true, penalty: true, takePets: false, recallPets: false, bgm: 'field' },
  7: { id: 7, name: '古魯丁地監 1樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  8: { id: 8, name: '古魯丁地監 2樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  9: { id: 9, name: '古魯丁地監 3樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  10: { id: 10, name: '古魯丁地監 4樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  11: { id: 11, name: '古魯丁地監 5樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  12: { id: 12, name: '古魯丁地監 6樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  13: { id: 13, name: '古魯丁地監 7樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  14: { id: 14, name: '海底隧道', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  15: { id: 15, name: '肯特內城', category: 'town', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'town' },
  16: { id: 16, name: '哈汀研究所', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  17: { id: 17, name: '娜魯帕洞穴', category: 'town', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'town' },
  18: { id: 18, name: '都佩傑諾地監', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  19: { id: 19, name: '眠龍洞穴 1樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  20: { id: 20, name: '眠龍洞穴 2樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  21: { id: 21, name: '眠龍洞穴 3樓', category: 'dungeon', tele: false, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  22: { id: 22, name: '傑瑞德的試煉地監', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  23: { id: 23, name: '風木城地監 1樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  24: { id: 24, name: '風木城地監 2樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  25: { id: 25, name: '騎士洞穴 1樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  26: { id: 26, name: '騎士洞穴 2樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  27: { id: 27, name: '騎士洞穴 3樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  28: { id: 28, name: '騎士洞穴 4樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  29: { id: 29, name: '風木城內城', category: 'town', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'town' },
  30: { id: 30, name: '龍之谷地監 1樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  31: { id: 31, name: '龍之谷地監 2樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  32: { id: 32, name: '龍之谷地監 3樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  33: { id: 33, name: '龍之谷地監 4樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  34: { id: 34, name: 'Hall of Honor', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  35: { id: 35, name: '龍之谷地監 5樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  36: { id: 36, name: '龍之谷地監 6樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  37: { id: 37, name: '安塔瑞斯棲息地', category: 'dungeon', tele: false, recall: false, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  43: { id: 43, name: '巨蟻洞穴 1區', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  44: { id: 44, name: '巨蟻洞穴 2區', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  45: { id: 45, name: '巨蟻洞穴 3區', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  46: { id: 46, name: '巨蟻洞穴 4區', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  47: { id: 47, name: '巨蟻洞穴 5區', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  48: { id: 48, name: '巨蟻洞穴 6區', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  49: { id: 49, name: '巨蟻洞穴 7區', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  50: { id: 50, name: '巨蟻洞穴 8區', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  51: { id: 51, name: '巨蟻洞穴 9區', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  52: { id: 52, name: '奇岩內城', category: 'town', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'town' },
  53: { id: 53, name: '奇岩地監 1樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  54: { id: 54, name: '奇岩地監 2樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  55: { id: 55, name: '奇岩地監 3樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  56: { id: 56, name: '奇岩地監 4樓', category: 'dungeon', tele: true, recall: true, mark: false, resurrect: true, penalty: true, takePets: true, recallPets: true, bgm: 'dungeon' },
  99: { id: 99, name: '管理者房間', category: 'special', tele: false, recall: false, mark: false, resurrect: true, penalty: true, takePets: false, recallPets: false, bgm: 'town' },
  666: { id: 666, name: '地獄', category: 'special', tele: false, recall: false, mark: false, resurrect: false, penalty: true, takePets: false, recallPets: false, bgm: 'dungeon' },
  16384: { id: 16384, name: '旅館房間 (說話之島)', category: 'inn', tele: false, recall: true, mark: false, resurrect: true, penalty: true, takePets: false, recallPets: true, bgm: 'town' },
  16896: { id: 16896, name: '旅館房間 (說話之島)', category: 'inn', tele: false, recall: true, mark: false, resurrect: true, penalty: true, takePets: false, recallPets: true, bgm: 'town' },
  17408: { id: 17408, name: '旅館房間 (古魯丁)', category: 'inn', tele: false, recall: true, mark: false, resurrect: true, penalty: true, takePets: false, recallPets: true, bgm: 'town' },
  17920: { id: 17920, name: '旅館房間 (古魯丁)', category: 'inn', tele: false, recall: true, mark: false, resurrect: true, penalty: true, takePets: false, recallPets: false, bgm: 'town' },
  18432: { id: 18432, name: '旅館房間 (奇岩)', category: 'inn', tele: false, recall: true, mark: false, resurrect: true, penalty: true, takePets: false, recallPets: false, bgm: 'town' },
  18944: { id: 18944, name: '旅館房間 (奇岩)', category: 'inn', tele: false, recall: true, mark: false, resurrect: true, penalty: true, takePets: false, recallPets: false, bgm: 'town' },
  19456: { id: 19456, name: '旅館房間 (海音)', category: 'inn', tele: false, recall: true, mark: false, resurrect: true, penalty: true, takePets: false, recallPets: false, bgm: 'town' },
  19968: { id: 19968, name: '旅館房間 (海音)', category: 'inn', tele: false, recall: true, mark: false, resurrect: true, penalty: true, takePets: false, recallPets: false, bgm: 'town' },
  20480: { id: 20480, name: '旅館房間 (風木)', category: 'inn', tele: false, recall: true, mark: false, resurrect: true, penalty: true, takePets: false, recallPets: false, bgm: 'town' },
  20992: { id: 20992, name: '旅館房間 (風木)', category: 'inn', tele: false, recall: true, mark: false, resurrect: true, penalty: true, takePets: false, recallPets: false, bgm: 'town' },
};

export const MAP_NAMES = Object.fromEntries(
  Object.values(MAP_META).map((m) => [m.id, m.name]),
);

export function getMapMeta(mapId) {
  return MAP_META[Number(mapId)] || {
    id: Number(mapId),
    name: `地圖 ${mapId}`,
    category: 'field',
    tele: true,
    recall: true,
    mark: true,
    resurrect: true,
    penalty: true,
    takePets: true,
    recallPets: true,
    bgm: 'field',
  };
}

/** 世界主要城鎮安全區與座標（含說話之島 + 亞丁大陸 7 大聚落，bbox + 原版 0x04 安全位元精準對應城牆） */
export const TOWN_ZONES = [
  { id: 'ti', label: '說話之島村莊', map: 0, x: 32578, y: 32943, box: [32545, 32606, 32908, 32981], coreBox: [32565, 32598, 32924, 32965], desc: '新手起點・象牙塔盧卡斯／渡船港口／甘特／吉倫' },
  { id: 'gludin', label: '古魯丁城鎮', map: 4, x: 32612, y: 32748, box: [32580, 32640, 32704, 32832], coreBox: [32592, 32630, 32724, 32806], desc: '西部大港・渡船碼頭・通往話島與古魯丁地監 1~7樓' },
  { id: 'kent', label: '肯特城村', map: 4, x: 33050, y: 32775, box: [33025, 33120, 32721, 32815], coreBox: [33038, 33078, 32732, 32802], desc: '大陸中央樞紐・肯特城堡・連接古丁與奇岩要道' },
  { id: 'giran', label: '奇岩城', map: 4, x: 33436, y: 32796, box: [33330, 33550, 32632, 32896], coreBox: [33380, 33490, 32720, 32830], desc: '商業首都・鍛造工坊群・奇岩地監／龍之谷門戶' },
  { id: 'woods', label: '風木村莊', map: 4, x: 32626, y: 33185, box: [32578, 32658, 33152, 33235], coreBox: [32604, 32642, 33166, 33204], desc: '西南綠洲聚落・巨蟻洞穴／沙漠與風木地監入口' },
  { id: 'silver', label: '銀騎士村莊', map: 4, x: 33080, y: 33385, box: [33045, 33142, 33342, 33425], coreBox: [33075, 33108, 33365, 33398], desc: '南方騎士重鎮・騎士洞穴 1~4樓／試煉地監入口' },
  { id: 'willow', label: '燃柳村', map: 4, x: 32750, y: 32440, box: [32710, 32824, 32388, 32485], coreBox: [32725, 32785, 32418, 32468], desc: '北方森林前哨・鄰近妖魔堡壘／眠龍洞穴 1~3樓' },
  { id: 'elven', label: '妖精森林 (世界樹)', map: 4, x: 33060, y: 32330, box: [33024, 33098, 32300, 32380], coreBox: [33040, 33086, 32316, 32345], desc: '神聖世界樹・艾爾／娜魯帕洞穴・精靈工藝聖地' },
];

/** 城鎮以外附屬碼頭／修煉場／城堡庭院安全區（不列為回村座標但保護玩家） */
const EXTRA_SAFE_BOXES = [
  { map: 0, box: [32623, 32652, 32940, 32978] }, // 說話之島港口棧橋
  { map: 0, box: [32485, 32559, 32779, 32831] }, // 說話之島北部修煉場／甘特周邊安全區
  { map: 4, box: [32592, 32640, 32645, 32704] }, // 古魯丁港口棧橋
  { map: 4, box: [32576, 32639, 33344, 33407] }, // 風木城堡內庭安全區
];

function inBox(tx, ty, [x0, x1, y0, y1]) {
  return tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1;
}

export const MAINLAND_TOWNS = TOWN_ZONES.filter((t) => t.map === 4);

const TOWN_BY_ID = Object.fromEntries(TOWN_ZONES.map((t) => [t.id, t]));

export function isSafetyZone(mapId, tx, ty, isoMap = null) {
  const m = Number(mapId);
  if (m === 3 || m === 15 || m === 17 || m === 29 || m === 52 || m === 99 || m >= 16384) {
    return true;
  }
  for (const t of TOWN_ZONES) {
    if (t.map !== m || !inBox(tx, ty, t.box)) continue;
    if (!isoMap || (t.coreBox && inBox(tx, ty, t.coreBox))) return true;
    if (isoMap.hasSafetyBit?.(tx, ty, m)) return true;
  }
  for (const extra of EXTRA_SAFE_BOXES) {
    if (extra.map !== m || !inBox(tx, ty, extra.box)) continue;
    if (!isoMap || isoMap.hasSafetyBit?.(tx, ty, m)) return true;
  }
  return false;
}

export function zoneOfPlayer(player, isoMap = null) {
  if (!player) return 'field';
  const m = Number(player.map || 0);
  if (isSafetyZone(m, player.tx, player.ty, isoMap)) return 'town';
  const meta = getMapMeta(m);
  if (meta.bgm === 'dungeon') return 'dungeon';
  return 'field';
}

const DUNGEON_HOME_ID = {
  0: 'ti', 1: 'ti', 2: 'ti', 3: 'ti', 5: 'ti', 16384: 'ti', 16896: 'ti',
  6: 'gludin', 7: 'gludin', 8: 'gludin', 9: 'gludin', 10: 'gludin', 11: 'gludin', 12: 'gludin', 13: 'gludin', 17408: 'gludin', 17920: 'gludin',
  15: 'kent',
  16: 'elven', 17: 'elven',
  18: 'willow', 19: 'willow', 20: 'willow', 21: 'willow',
  22: 'silver', 25: 'silver', 26: 'silver', 27: 'silver', 28: 'silver',
  23: 'woods', 24: 'woods', 29: 'woods', 43: 'woods', 44: 'woods', 45: 'woods', 46: 'woods', 47: 'woods', 48: 'woods', 49: 'woods', 50: 'woods', 51: 'woods', 20480: 'woods', 20992: 'woods',
  30: 'giran', 31: 'giran', 32: 'giran', 33: 'giran', 34: 'giran', 35: 'giran', 36: 'giran', 37: 'giran', 52: 'giran', 53: 'giran', 54: 'giran', 55: 'giran', 56: 'giran', 18432: 'giran', 18944: 'giran', 19456: 'giran', 19968: 'giran',
  99: 'gludin', 666: 'ti',
};

/** 依所在位置推算最近的回村／復活返村城鎮 */
export function resolveHomeTown(mapId, tx = 0, ty = 0) {
  const m = Number(mapId);
  if (m === 14) {
    return tx < 32750 ? TOWN_BY_ID.ti : TOWN_BY_ID.gludin;
  }
  if (m === 4) {
    let best = TOWN_BY_ID.gludin;
    let bestD = Infinity;
    for (const town of MAINLAND_TOWNS) {
      const d = Math.hypot((tx || town.x) - town.x, (ty || town.y) - town.y);
      if (d < bestD) {
        bestD = d;
        best = town;
      }
    }
    return best;
  }
  const key = DUNGEON_HOME_ID[m] || 'ti';
  return TOWN_BY_ID[key] || TOWN_BY_ID.ti;
}

/** 原版對話 `<a action="teleport ...">` 對照表 */
export const TELEPORT_ACTIONS = {
  'island-gludin': { label: '古魯丁城鎮', map: 4, x: 32612, y: 32748, price: 1500 },
  'gludin-island': { label: '說話之島', map: 0, x: 32584, y: 32929, price: 1500 },
  'gludin-kent': { label: '肯特村莊', map: 4, x: 33050, y: 32783, price: 300 },
  'gludin-willow': { label: '燃柳村', map: 4, x: 32750, y: 32440, price: 450 },
  'gludin-woods': { label: '風木村莊', map: 4, x: 32640, y: 33202, price: 300 },
  'kent-gludin': { label: '古魯丁城鎮', map: 4, x: 32612, y: 32748, price: 300 },
  'kent-giran': { label: '奇岩城', map: 4, x: 33437, y: 32795, price: 450 },
  'giran-kent': { label: '肯特村莊', map: 4, x: 33050, y: 32783, price: 450 },
  'giran-dragonvalley': { label: '龍之谷地監入口', map: 4, x: 33348, y: 32347, price: 700 },
  'woods-gludin': { label: '古魯丁城鎮', map: 4, x: 32612, y: 32748, price: 300 },
  'woods-silver': { label: '銀騎士村莊', map: 4, x: 33080, y: 33385, price: 400 },
  'silver-kent': { label: '肯特村莊', map: 4, x: 33050, y: 32783, price: 500 },
  'silver-woods': { label: '風木村莊', map: 4, x: 32640, y: 33202, price: 400 },
  'gludio-orcfortress': { label: '對岸（燃柳／妖魔要塞）', map: 4, x: 32659, y: 32524, price: 100 },
  'orcfortress-gludio': { label: '對岸（古魯丁北岸）', map: 4, x: 32657, y: 32540, price: 100 },
  firefieldtown: { label: '燃柳村', map: 4, x: 32750, y: 32440, price: 500 },
  'trial-dungeon': { label: '傑瑞德的試煉地監（蛇女）', map: 22, x: 32770, y: 32769, price: 200 },
};

/** 各城鎮／區域傳送師清單（依 NPC 或目前所在領地提供） */
export const TELEPORT_ROUTES_BY_NPC = {
  盧卡斯: [
    { label: '古魯丁城鎮（亞丁大陸西港・通往本島全區）', map: 4, x: 32612, y: 32748, price: 1500 },
    { label: '說話之島村莊中央', map: 0, x: 32578, y: 32943, price: 30 },
    { label: '說話之島東北森林（練功區）', map: 0, x: 32645, y: 32840, price: 50 },
    { label: '說話之島地監入口外', map: 0, x: 32480, y: 32854, price: 60 },
    { label: '冒險洞窟 1樓（骷髏／食屍鬼）', map: 1, x: 32669, y: 32802, price: 100 },
    { label: '冒險洞窟 2樓（狼人／巴風特）', map: 2, x: 32662, y: 32874, price: 150 },
    { label: '甘特之屋（導師試煉）', map: 3, x: 32675, y: 32814, price: 80 },
  ],
  史提夫: [
    { label: '說話之島村莊（搭船／傳送返島）', map: 0, x: 32584, y: 32929, price: 1500 },
    { label: '古魯丁地監 1樓入口', map: 4, x: 32728, y: 32929, price: 200 },
    { label: '肯特城村（大陸中央）', map: 4, x: 33050, y: 32783, price: 300 },
    { label: '燃柳村（北方森林／眠龍洞）', map: 4, x: 32750, y: 32440, price: 450 },
    { label: '風木村莊（沙漠／巨蟻洞穴）', map: 4, x: 32640, y: 33202, price: 300 },
    { label: '妖精森林（世界樹）', map: 4, x: 33060, y: 32330, price: 500 },
  ],
  史坦利: [
    { label: '古魯丁城鎮（西岸港口）', map: 4, x: 32612, y: 32748, price: 300 },
    { label: '奇岩城（商業中心・奇岩地監）', map: 4, x: 33437, y: 32795, price: 450 },
    { label: '銀騎士村莊（騎士洞穴）', map: 4, x: 33080, y: 33385, price: 500 },
    { label: '風木村莊（巨蟻洞穴）', map: 4, x: 32640, y: 33202, price: 450 },
    { label: '肯特內城', map: 15, x: 32736, y: 32810, price: 150 },
  ],
  爾瑪: [
    { label: '奇岩城（中央廣場・傳送師）', map: 4, x: 33432, y: 32818, price: 50 },
    { label: '奇岩內城（城堡內部）', map: 52, x: 32740, y: 32815, price: 250 },
    { label: '肯特城村（西部要道）', map: 4, x: 33050, y: 32783, price: 450 },
    { label: '奇岩地監 1樓（奇岩盜賊・囚犯）', map: 53, x: 32808, y: 32732, price: 500 },
    { label: '龍之谷地監入口（龍之谷 1~6樓）', map: 4, x: 33348, y: 32347, price: 700 },
    { label: '龍之谷地監 1樓', map: 30, x: 32727, y: 32728, price: 850 },
    { label: '銀騎士村莊（南方）', map: 4, x: 33080, y: 33385, price: 500 },
    { label: '古魯丁城鎮（港口）', map: 4, x: 32612, y: 32748, price: 600 },
  ],
  奇岩傳送師: [
    { label: '奇岩內城（城堡內部）', map: 52, x: 32740, y: 32815, price: 250 },
    { label: '奇岩地監 1樓（奇岩盜賊・囚犯）', map: 53, x: 32808, y: 32732, price: 500 },
    { label: '龍之谷地監入口（龍之谷 1~6樓）', map: 4, x: 33348, y: 32347, price: 700 },
    { label: '龍之谷地監 1樓', map: 30, x: 32727, y: 32728, price: 850 },
    { label: '肯特城村（西部要道）', map: 4, x: 33050, y: 32783, price: 450 },
    { label: '銀騎士村莊（南方）', map: 4, x: 33080, y: 33385, price: 500 },
    { label: '古魯丁城鎮（港口）', map: 4, x: 32612, y: 32748, price: 600 },
    { label: '說話之島村莊（新手故鄉）', map: 0, x: 32578, y: 32943, price: 800 },
  ],
  奇岩內城傳送師: [
    { label: '奇岩城（中央廣場・倉庫商店）', map: 4, x: 33432, y: 32818, price: 50 },
    { label: '奇岩城（北區・爾瑪）', map: 4, x: 33436, y: 32796, price: 50 },
    { label: '奇岩地監 1樓（奇岩盜賊・囚犯）', map: 53, x: 32808, y: 32732, price: 500 },
  ],
  特萊: [
    { label: '古魯丁城鎮（西北方）', map: 4, x: 32612, y: 32748, price: 300 },
    { label: '銀騎士村莊（東方）', map: 4, x: 33080, y: 33385, price: 400 },
    { label: '巨蟻洞穴 1區（掃除蟻・巨工蟻）', map: 43, x: 32783, y: 32751, price: 450 },
    { label: '風木城地監 1樓', map: 23, x: 32809, y: 32726, price: 500 },
  ],
  麥特: [
    { label: '風木村莊（西方沙漠）', map: 4, x: 32640, y: 33202, price: 400 },
    { label: '肯特城村（北方）', map: 4, x: 33050, y: 32783, price: 500 },
    { label: '奇岩城（東北）', map: 4, x: 33436, y: 32796, price: 500 },
    { label: '騎士洞穴 1樓（練習與練功）', map: 25, x: 32739, y: 32805, price: 350 },
    { label: '傑瑞德的試煉地監（蛇女）', map: 22, x: 32770, y: 32769, price: 250 },
  ],
  傑瑞德: [TELEPORT_ACTIONS['trial-dungeon']],
};

/** 全球快速導航參考清單（用於世界地圖與跨海渡船） */
export const WORLD_EXPEDITION_ROUTES = [
  { group: '說話之島', label: '說話之島村莊', map: 0, x: 32578, y: 32943, lv: 'Lv.1+', price: 50 },
  { group: '說話之島', label: '冒險洞窟 1樓', map: 1, x: 32669, y: 32802, lv: 'Lv.5~12', price: 100 },
  { group: '說話之島', label: '冒險洞窟 2樓', map: 2, x: 32662, y: 32874, lv: 'Lv.10~20', price: 150 },
  { group: '亞丁城鎮', label: '古魯丁城鎮', map: 4, x: 32612, y: 32748, lv: '主要港口', price: 300 },
  { group: '亞丁城鎮', label: '肯特城村', map: 4, x: 33050, y: 32783, lv: '大陸中央', price: 350 },
  { group: '亞丁城鎮', label: '奇岩城', map: 4, x: 33436, y: 32796, lv: '商業首都', price: 500 },
  { group: '亞丁城鎮', label: '奇岩城（中央廣場）', map: 4, x: 33432, y: 32818, lv: '廣場傳送師', price: 500 },
  { group: '亞丁城鎮', label: '風木村莊', map: 4, x: 32626, y: 33185, lv: '沙漠綠洲', price: 350 },
  { group: '亞丁城鎮', label: '銀騎士村莊', map: 4, x: 33080, y: 33385, lv: '騎士重鎮', price: 450 },
  { group: '亞丁城鎮', label: '燃柳村', map: 4, x: 32750, y: 32440, lv: '森林前哨', price: 450 },
  { group: '亞丁城鎮', label: '妖精森林 (世界樹)', map: 4, x: 33060, y: 32330, lv: '精靈聖地', price: 500 },
  { group: '經典地監', label: '古魯丁地監 1樓 (7F通海底)', map: 7, x: 32810, y: 32726, lv: 'Lv.10~35', price: 300 },
  { group: '經典地監', label: '眠龍洞穴 1樓', map: 19, x: 32804, y: 32726, lv: 'Lv.12~25', price: 450 },
  { group: '經典地監', label: '騎士洞穴 1樓', map: 25, x: 32739, y: 32805, lv: 'Lv.10~28', price: 400 },
  { group: '經典地監', label: '風木城地監 1樓', map: 23, x: 32809, y: 32726, lv: 'Lv.15~32', price: 500 },
  { group: '經典地監', label: '巨蟻洞穴 1區', map: 43, x: 32783, y: 32751, lv: 'Lv.12~35', price: 450 },
  { group: '經典地監', label: '傑瑞德的試煉地監 (蛇女)', map: 22, x: 32770, y: 32769, lv: 'Lv.18~28', price: 300 },
  { group: '經典地監', label: '奇岩地監 1樓 (1~4F)', map: 53, x: 32808, y: 32732, lv: 'Lv.28~50', price: 550 },
  { group: '經典地監', label: '龍之谷地監 1樓 (通安塔瑞斯)', map: 30, x: 32727, y: 32728, lv: 'Lv.35~60+', price: 850 },
];

export const HARBOR_DESTINATIONS_BY_MAP = {
  0: [
    { label: '北島荒野沙灘營地', map: 0, x: 32640, y: 32742, price: 60 },
    { label: '地監海岸西岸渡口', map: 0, x: 32476, y: 32842, price: 60 },
    { label: '古魯丁港口（亞丁本島航線・直達）', map: 4, x: 32550, y: 32724, price: 300 },
    { label: '登船甲板（話島往古丁的船）', map: 5, x: 32734, y: 32796, price: 300 },
  ],
  4: [
    { label: '說話之島東岸碼頭（渡海航線・直達）', map: 0, x: 32631, y: 32971, price: 300 },
    { label: '登船甲板（亞丁往話島的船）', map: 6, x: 32735, y: 32794, price: 300 },
  ],
  5: [
    { label: '古魯丁港口（抵達本島）', map: 4, x: 32550, y: 32724, price: 0 },
    { label: '返回說話之島碼頭', map: 0, x: 32631, y: 32981, price: 0 },
  ],
  6: [
    { label: '說話之島東岸碼頭（抵達話島）', map: 0, x: 32631, y: 32971, price: 0 },
    { label: '返回古魯丁港口', map: 4, x: 32544, y: 32728, price: 0 },
  ],
};

/** 亞丁大陸在地圖畫布上的地標（當玩家位於 Map 4 時顯示全島標記） */
export const CONTINENT_LANDMARKS = [
  ...MAINLAND_TOWNS.map((t) => ({ label: t.label, x: t.x, y: t.y, color: '#facc15' })),
  { label: '古魯丁地監', x: 32728, y: 32929, color: '#fb7185' },
  { label: '眠龍洞穴', x: 32938, y: 32284, color: '#fb7185' },
  { label: '奇岩地監', x: 33311, y: 33061, color: '#fb7185' },
  { label: '龍之谷地監', x: 33348, y: 32347, color: '#fb7185' },
  { label: '巨蟻洞穴', x: 32756, y: 33207, color: '#fb7185' },
  { label: '騎士洞穴', x: 32951, y: 33502, color: '#fb7185' },
];
