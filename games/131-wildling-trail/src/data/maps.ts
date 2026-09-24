import type { MapDef } from '../core/world';

/*
 * 圖例：. 草地  , 高草叢（遭遇）  = 泥土路  f 花叢  T 樹  ~ 水  F 柵欄  r 岩石
 *       ^ 屋頂  # 牆  w 窗  d 門  x 攤位櫃台  : 林地  ; 深草叢（遭遇）  t 杉樹
 *       o 石板  P 石柱  R 石牆  b 木橋
 * 四張地圖由南往北相連：芽口村 → 風草道 → 霧苔林 → 石冠挑戰場。
 */

const village: MapDef = {
  id: 'village',
  name: '芽口村',
  battleBg: 'meadow',
  rows: [
    'TTTTTTTTT==TTTTTTTTT',
    'T.f......==......f.T',
    'T.^^^^^..==..^^^^^.T',
    'T.^^^^^..==..^^^^^.T',
    'T.#w#d#..==..#d#w#.T',
    'T....=...==...=....T',
    'T....========.=....T',
    'T.f.....====..=..f.T',
    'T.......====.......T',
    'TFFFF...====..xxx..T',
    'T~~~F..........f...T',
    'T~~~F..f...........T',
    'T~~~~F.............T',
    'T~~~~~F....f.....f.T',
    'TTTTTTTTTTTTTTTTTTTT',
  ],
  warps: [
    { x: 9, y: 0, to: 'route', dest: { x: 9, y: 21 }, facing: 'up',
      requires: { flag: 'gotStarter', speaker: '小楓', text: '外面的草叢住著野生怪獸，沒有夥伴很危險！先去廣場找禾老師吧。' } },
    { x: 10, y: 0, to: 'route', dest: { x: 10, y: 21 }, facing: 'up',
      requires: { flag: 'gotStarter', speaker: '小楓', text: '外面的草叢住著野生怪獸，沒有夥伴很危險！先去廣場找禾老師吧。' } },
  ],
  entities: [
    { id: 'tutor', kind: 'npc', name: '禾老師', x: 10, y: 7, facing: 'down', sprite: 'char.tutor', script: 'tutor' },
    { id: 'healer', kind: 'npc', name: '蘇護士', x: 5, y: 5, facing: 'down', sprite: 'char.healer', script: 'healer' },
    { id: 'terminal', kind: 'terminal', name: '收納石', x: 7, y: 5, facing: 'down', sprite: 'obj.terminal', script: 'terminal' },
    { id: 'shopkeeper', kind: 'npc', name: '阿良', x: 15, y: 8, facing: 'down', sprite: 'char.shopkeeper', script: 'shop' },
    { id: 'kid', kind: 'npc', name: '小楓', x: 11, y: 2, facing: 'left', sprite: 'char.kid', script: 'kid' },
    { id: 'villageSign', kind: 'sign', name: '告示牌', x: 8, y: 2, facing: 'down', sprite: 'obj.sign', script: 'villageSign' },
    { id: 'clinicSign', kind: 'sign', name: '告示牌', x: 3, y: 5, facing: 'down', sprite: 'obj.sign', script: 'clinicSign' },
  ],
};

const route: MapDef = {
  id: 'route',
  name: '風草道',
  battleBg: 'meadow',
  rows: [
    'TTTTTTT==TTTTTTT',
    'TT.....==.....TT',
    'T..,,,,==,,,...T',
    'T..,,,,==,,,,..T',
    'T..,,,.==.,,,..T',
    'T......==......T',
    'T.rr...==...~~~T',
    'T......==...~~~T',
    'T.,,,,.==....~~T',
    'T.,,,,.==......T',
    'T.,,,,.====....T',
    'T.,,,,....=....T',
    'T.........=,,,.T',
    'Tf...======,,,.T',
    'T....=....,,,,.T',
    'T....=....,,,,.T',
    'T..,,=,,.......T',
    'T..,,=,,..rr...T',
    'T..,,=,,.......T',
    'T....=......f..T',
    'T....======....T',
    'TT........=...TT',
    'TTTTTTTTT==TTTTT',
  ],
  warps: [
    { x: 9, y: 22, to: 'village', dest: { x: 9, y: 1 }, facing: 'down' },
    { x: 10, y: 22, to: 'village', dest: { x: 10, y: 1 }, facing: 'down' },
    { x: 7, y: 0, to: 'forest', dest: { x: 9, y: 18 }, facing: 'up',
      requires: { flag: 'firstCatch', speaker: '巡林員', text: '森林的規矩：先學會捕捉野生怪獸，才能進霧苔林。在草叢裡用晶籠試試看吧！' } },
    { x: 8, y: 0, to: 'forest', dest: { x: 10, y: 18 }, facing: 'up',
      requires: { flag: 'firstCatch', speaker: '巡林員', text: '森林的規矩：先學會捕捉野生怪獸，才能進霧苔林。在草叢裡用晶籠試試看吧！' } },
  ],
  entities: [
    { id: 'routeSign', kind: 'sign', name: '告示牌', x: 6, y: 21, facing: 'down', sprite: 'obj.sign', script: 'routeSign' },
    { id: 'traveler', kind: 'npc', name: '旅人', x: 12, y: 10, facing: 'left', sprite: 'char.traveler', script: 'traveler' },
    { id: 'warden', kind: 'npc', name: '巡林員', x: 6, y: 1, facing: 'right', sprite: 'char.warden', script: 'warden' },
    { id: 'routeBerry', kind: 'item', name: '道具', x: 13, y: 5, facing: 'down', sprite: 'obj.itemball', script: 'pickup',
      hiddenWhen: 'item_route_berry', item: { id: 'berry', count: 2, flag: 'item_route_berry' } },
  ],
  encounter: {
    rate: 0.12,
    table: [
      { species: 'sprigling', min: 2, max: 4, weight: 40 },
      { species: 'mistsnail', min: 2, max: 4, weight: 32 },
      { species: 'cinderow', min: 3, max: 4, weight: 28 },
    ],
  },
};

const forest: MapDef = {
  id: 'forest',
  name: '霧苔林',
  battleBg: 'forest',
  rows: [
    'tttttttttt::tttttttt',
    'ttttttttt:::tttttttt',
    't;;;;tt:::::::t;;;;t',
    't;;;;tt:::::::t;;;;t',
    't;;;;::::tt:::::;;;t',
    't::::::::tt::::::::t',
    'tt::tttt::::tttt::tt',
    't;;:t~~t::::t;;;;::t',
    't;;:t~~t::::t;;;;::t',
    't;;::::::tt:::;;;::t',
    't::::;;;:tt::::::::t',
    'tttt:;;;::::::tttt:t',
    't::::;;;::::::t;;;:t',
    't:tt::::::tt::t;;;:t',
    't:tt;;;;::tt::::;;:t',
    't:::;;;;:::::::::::t',
    'tttt;;;;::::tt::tttt',
    't:::::::::::tt:::::t',
    't::::::::::::::::::t',
    'ttttttttt::ttttttttt',
  ],
  warps: [
    { x: 9, y: 19, to: 'route', dest: { x: 7, y: 1 }, facing: 'down' },
    { x: 10, y: 19, to: 'route', dest: { x: 8, y: 1 }, facing: 'down' },
    { x: 10, y: 0, to: 'arena', dest: { x: 7, y: 9 }, facing: 'up',
      requires: { flag: 'hasPermit', speaker: '石門衛', text: '這裡是石冠挑戰場的入口。只有通過守林人朔試煉、拿到挑戰許可的人才能進去。' } },
    { x: 11, y: 0, to: 'arena', dest: { x: 7, y: 9 }, facing: 'up',
      requires: { flag: 'hasPermit', speaker: '石門衛', text: '這裡是石冠挑戰場的入口。只有通過守林人朔試煉、拿到挑戰許可的人才能進去。' } },
  ],
  entities: [
    { id: 'ranger', kind: 'npc', name: '守林人・朔', x: 10, y: 3, facing: 'down', sprite: 'char.ranger', script: 'ranger' },
    { id: 'gatekeeper', kind: 'npc', name: '石門衛', x: 9, y: 1, facing: 'right', sprite: 'char.gatekeeper', script: 'gatekeeper' },
    { id: 'forestSign', kind: 'sign', name: '告示牌', x: 8, y: 18, facing: 'down', sprite: 'obj.sign', script: 'forestSign' },
    { id: 'forestCage', kind: 'item', name: '道具', x: 1, y: 17, facing: 'down', sprite: 'obj.itemball', script: 'pickup',
      hiddenWhen: 'item_forest_fineCage', item: { id: 'fineCage', count: 2, flag: 'item_forest_fineCage' } },
    { id: 'forestHerb', kind: 'item', name: '道具', x: 18, y: 12, facing: 'down', sprite: 'obj.itemball', script: 'pickup',
      hiddenWhen: 'item_forest_herb', item: { id: 'herb', count: 2, flag: 'item_forest_herb' } },
  ],
  encounter: {
    rate: 0.14,
    table: [
      { species: 'leafcoon', min: 7, max: 8, weight: 22 },
      { species: 'cinderow', min: 6, max: 8, weight: 28 },
      { species: 'mistsnail', min: 6, max: 8, weight: 28 },
      { species: 'sprigling', min: 5, max: 5, weight: 22 },
    ],
  },
};

const arena: MapDef = {
  id: 'arena',
  name: '石冠挑戰場',
  battleBg: 'arena',
  rows: [
    'RRRRRRRRRRRRRRR',
    'RPoooooooooooPR',
    'RoooooooooooooR',
    'RooPoooooooPooR',
    'RoooooooooooooR',
    'RPoooooooooooPR',
    'RoooooooooooooR',
    'RooPoooooooPooR',
    'RoooooooooooooR',
    'RPoooooooooooPR',
    'RRRRRRRoRRRRRRR',
  ],
  warps: [{ x: 7, y: 10, to: 'forest', dest: { x: 10, y: 1 }, facing: 'down' }],
  entities: [
    { id: 'boss', kind: 'npc', name: '場主・嵐', x: 7, y: 2, facing: 'down', sprite: 'char.boss', script: 'boss' },
    { id: 'arenaSign', kind: 'sign', name: '告示牌', x: 5, y: 9, facing: 'down', sprite: 'obj.sign', script: 'arenaSign' },
    { id: 'fan', kind: 'npc', name: '觀眾', x: 12, y: 8, facing: 'left', sprite: 'char.fan', script: 'fan' },
  ],
};

export const MAP_LIST: MapDef[] = [village, route, forest, arena];
export const MAPS: Record<string, MapDef> = Object.fromEntries(MAP_LIST.map((m) => [m.id, m]));

export function getMap(id: string): MapDef {
  const map = MAPS[id];
  if (!map) throw new Error(`未知地圖：${id}`);
  return map;
}

/** 新遊戲起點：禾老師正前方，一按確認就能說話。 */
export const START_POS = { map: 'village', x: 10, y: 8, facing: 'up' as const };
/** 全隊倒下後回到的治療所門口。 */
export const WHITEOUT_POS = { map: 'village', x: 5, y: 6, facing: 'up' as const };
