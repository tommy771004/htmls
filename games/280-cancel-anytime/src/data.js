// 絕命免運費 · CANCEL ANYTIME — 純資料（無 DOM / Three）。數值依使用者的 GDD 文件轉錄。
// 座標：x = 欄（西 0 → 東 11），z = 列（北 0 → 南 11）。高度層 0~3，每層 0.85 m（顯示為 +1.5 m / 3.0 m / 4.5 m）。

export const GRID = 12;
export const TILE = 2.0;          // 每格 2 m
export const LAYER = 0.85;        // 每層高度差
export const LAYER_LABEL = ['平地 0m', '車頂 +1.5m', '屋頂 +3.0m', '高塔 +4.5m'];

// ── 地表 ──────────────────────────────────────────────
// turns: 0 = 永久；其他 = 剩餘回合數（每輪結束遞減）
export const SURFACES = {
  soda:   { name: '零卡快樂水積水', icon: '🥤', color: '#c9e8ff', note: '丟曼陀珠會引爆可樂間歇泉' },
  grease: { name: '反式脂肪炸雞油', icon: '🍟', color: '#e8b64a', note: '踩上需敏捷 DC 12，失敗劈腿倒地；遇火變火海' },
  energy: { name: '翻倒的能量飲', icon: '⚡', color: '#9dff4a', note: '遇電擊變成咖啡因高壓電網' },
  cheese: { name: '過期起司酸池', icon: '🧀', color: '#ffb41f', note: '每次進入或回合開始 1d6 酸蝕；遇電子菸毒霧變毒雲' },
  slime:  { name: '下水道突變綠黏液', icon: '🟢', color: '#5ef05a', note: '強酸地表，1d6 酸蝕；遇電子菸毒霧變毒雲' },
  fire:   { name: '膽固醇地獄火海', icon: '🔥', color: '#ff5a1f', note: '每回合 2d4 火焰傷害' },
  shock:  { name: '咖啡因高壓電網', icon: '⚡', color: '#4af0ff', note: '敵人 1d8 電擊＋心悸；我方移動 +2' },
  toxic:  { name: '生化毒氣沼澤', icon: '☣️', color: '#a8d020', note: '內部單位 AC −2、遠程命中 −4' },
  sludge: { name: '藍色生化惡臭泥漿', icon: '🚽', color: '#3a7cff', note: '進入者噁心反胃（攻擊 −2）' },
  mud:    { name: '拖車公園泥巴路', icon: '🟤', color: '#8a6038', note: '困難地形，每格耗 2 移動' },
  lava:   { name: '沸騰甜辣烤肉醬池', icon: '🌋', color: '#c2280e', note: '不可行走；被推進去 3d6 火焰＋TOUCHDOWN' },
  trap:   { name: '彈出式假關閉 [X]', icon: '❎', color: '#ff2a6a', note: '踩上會被傳送到主腦正前方並承受 3d8' },
};

// ── 狀態 ──────────────────────────────────────────────
export const STATUSES = {
  prone:     { name: '倒地', icon: '🫠', note: '近戰攻擊它 +2；起身耗一半移動' },
  stunned:   { name: '暈眩', icon: '💫', note: '跳過回合' },
  boxed:     { name: '關在紙箱裡', icon: '📦', note: '跳過回合' },
  canceled:  { name: '被網路出征', icon: '🚫', note: '命中 −3，被打時額外 1d4 心靈' },
  sugar:     { name: '胰島素糖分崩潰', icon: '🍩', note: '移動 −2' },
  subpoena:  { name: '收到法院傳票', icon: '⚖️', note: '不能用附贈與反應，回合開始被拖向律師' },
  nausea:    { name: '噁心反胃', icon: '🤢', note: '攻擊 −2' },
  palpit:    { name: '心悸麻痺', icon: '💓', note: '無法使用反應動作' },
  veins:     { name: '血管爆青筋', icon: '💪', note: '近戰傷害 +2' },
  stealth:   { name: 'VPN 潛行', icon: '🕶️', note: 'AC +2，下一擊必定背刺' },
  cringe:    { name: '尷尬癌', icon: '🤡', note: '命中 −2' },
  psyched:   { name: '腎上腺素', icon: '🔥', note: '移動 +2、命中 +2' },
  shaken:    { name: '心態崩潰', icon: '😵', note: 'AC −2' },
  distracted:{ name: '分心背對', icon: '🙈', note: '不行動，攻擊它必定背刺' },
  pineapple: { name: '鳳梨披薩恐懼', icon: '🍍', note: '命中 −2' },
  intern:    { name: '實習生試用期', icon: '🪪', note: '被洗腦，替我方打工' },
  freedom:   { name: '美式自由狂熱', icon: '🦅', note: '首擊必定暴擊' },
};

// ── 英雄 ──────────────────────────────────────────────
// hit: 命中加值；dice: 傷害；range/radius: 格；cost: action|bonus；slot: 消耗法術位
export const HEROES = {
  chad: {
    name: '查德・布羅', en: 'CHAD "THE GYM BRO"', title: '健身房蛋白粉狂戰士', color: '#ff6b2c',
    hp: 52, ac: 18, dex: 2, move: 5, slots: 2, slotName: '乳清格', athletics: 4, str: 6,
    passive: { name: '從不練腿日', text: '推撞檢定常駐 +4，可把敵人推飛 3 格。' },
    talk: { flex: 6, bbq: 5, intimidate: 3, deceive: 0, persuade: 1, kin: 2, latenight: 2, hack: -1, health: 1 },
    skills: {
      melee:  { name: '奧林匹克槓鈴重劈', icon: '🏋️', kind: 'melee', cost: 'action', range: 1.5, hit: 6, dice: '2d6+4', type: '鈍擊', text: '揮舞插滿槓片的長槓砸向敵人。' },
      ranged: { name: '壺鈴投擲', icon: '🔔', kind: 'ranged', cost: 'action', range: 6, hit: 5, dice: '1d10+3', type: '鈍擊', proneHigh: 0.3, text: '單手把 32kg 壺鈴當棒球砸出去；高地投擲有 30% 機率擊倒。' },
      aoe:    { name: '練前氮泵・泰山壓頂', icon: '☄️', kind: 'aoe', cost: 'action', slot: 1, range: 4, radius: 1.5, hit: 6, dice: '3d6+4', type: '力場震波', leap: true, knock: 1, text: '吼出 "LIGHTWEIGHT BABY!" 跳向目標區砸地，震退 1 格。' },
      bonus:  { name: '乾吞肌酸粉', icon: '🥄', kind: 'selfheal', cost: 'bonus', range: 0, dice: '2d8+4', status: ['veins', 1], text: '生吞一大匙肌酸粉，回血並血管爆青筋（近戰傷害 +2）。' },
    },
  },
  karen: {
    name: '凱倫阿姨', en: 'KAREN "THE MANAGER SLAYER"', title: '社區管委會與客訴領域牧師', color: '#ffd23f',
    hp: 44, ac: 17, dex: 2, move: 4, slots: 3, slotName: '客訴格', athletics: 1, str: 3,
    passive: { name: '顧客永遠是對的', text: '戰前【威嚇】檢定自動優勢（擲兩顆 D20 取高）。' },
    talk: { flex: 0, bbq: 1, intimidate: 5, deceive: 2, persuade: 3, kin: 1, latenight: 2, hack: 0, health: 6 },
    skills: {
      melee:  { name: '限量冰霸杯物理說服', icon: '🥤', kind: 'melee', cost: 'action', range: 1.5, hit: 5, dice: '1d8+3', type: '鈍擊', text: '用裝滿冰塊的 40oz 保溫杯猛敲腦門。' },
      ranged: { name: '「叫你們經理出來！」', icon: '📢', kind: 'ranged', cost: 'action', range: 7, hit: 6, dice: '4d6', type: '心靈光耀', status: ['canceled', 1], text: '140 分貝客訴射線，目標被出征（命中 −3）1 回合。' },
      aoe:    { name: '一星負評天罰火柱', icon: '⭐', kind: 'aoe', cost: 'action', slot: 1, range: 6, radius: 1.8, hit: 6, dice: '3d8+3', type: '神聖業火', fire: true, text: '天降「★☆☆☆☆ 服務態度極差！」火柱，點燃地面油漬。' },
      bonus:  { name: '直銷精油群體芳療', icon: '🌿', kind: 'heal', cost: 'bonus', slot: 1, range: 6, radius: 2.0, dice: '2d6+5', revive: true, text: '治療範圍內隊友，並拉起倒地沒買醫保的隊友。' },
    },
  },
  dale: {
    name: '佛州老戴', en: 'FLORIDA MAN "DALE"', title: '沼澤拖車公園狂野塑能法師', color: '#3fd17a',
    hp: 36, ac: 14, dex: 3, move: 4, slots: 3, slotName: '煙火格', athletics: 0, str: 2,
    passive: { name: '幫我拿著啤酒', text: '範圍爆炸絕不誤傷隊友（但會把流動廁所和油桶全部炸飛）。' },
    talk: { flex: 1, bbq: 3, intimidate: 2, deceive: 3, persuade: 2, kin: 5, latenight: 5, hack: 0, health: -1 },
    skills: {
      melee:  { name: '寵物短吻鱷咬擊', icon: '🐊', kind: 'melee', cost: 'action', range: 1.5, hit: 5, dice: '1d8+2', type: '穿刺', text: '掏出懷裡的鱷魚「小乖」咬敵人屁股。' },
      ranged: { name: '非法改裝沖天炮連發', icon: '🎆', kind: 'ranged', cost: 'action', range: 8, hit: 7, dice: '2d10', type: '火焰', fire: true, tile: true, text: '不耗法術位的超遠距煙火，可以點燃地面油漬與炸藥。' },
      aoe:    { name: '性別揭曉派對・核爆火球', icon: '🎇', kind: 'aoe', cost: 'action', slot: 1, range: 8, radius: 2.2, hit: 7, dice: '4d6+4', type: '爆裂火焰', fire: true, text: '粉紅亮藍雙色蘑菇雲，空中打出 "IT\'S A BOY!"。' },
      bonus:  { name: '下水道鱷魚瞬移', icon: '🌫️', kind: 'teleport', cost: 'bonus', range: 5, text: '化為薄荷汽水綠霧，無視高低差瞬移到 5 格內空地。' },
    },
  },
  doge: {
    name: '多吉', en: 'DOGE THE RUG-PULLER', title: '矽谷加密貨幣吸血鬼刺客', color: '#b48cff',
    hp: 38, ac: 16, dex: 5, move: 6, slots: 2, slotName: '區塊鏈格', athletics: 2, str: 2, noOA: true,
    passive: { name: '去中心化閃避', text: '敏捷 +5，移動時不會觸發借機攻擊。' },
    talk: { flex: -1, bbq: 0, intimidate: 1, deceive: 6, persuade: 5, kin: 0, latenight: 1, hack: 6, health: 0 },
    skills: {
      melee:  { name: '割韭菜跑路背刺', icon: '🗡️', kind: 'melee', cost: 'action', range: 1.5, hit: 7, dice: '2d6+5', type: '穿刺', drain: 4, text: '冷錢包匕首；背刺時吸血 4 HP。' },
      ranged: { name: '暴跌 NFT 實體飛鏢', icon: '🖼️', kind: 'ranged', cost: 'action', range: 7, hit: 7, dice: '2d6+4', type: '穿刺', text: '市值跌到 0.01 美元的猿猴鐵牌，鋒利又帶心靈創傷。' },
      aoe:    { name: '超濃哈密瓜電子菸毒霧', icon: '💨', kind: 'aoe', cost: 'action', slot: 1, range: 5, radius: 1.8, hit: 6, dice: '3d6+3', type: '毒素', vape: true, text: '遮天蔽日的哈密瓜味濃煙，碰到起司酸池或綠黏液會變毒雲。' },
      bonus:  { name: '無痕模式＋跨區 VPN', icon: '🕶️', kind: 'stealth', cost: 'bonus', range: 0, status: ['stealth', 9], text: 'IP 切到離岸小島融入暗影：AC +2，下一擊必定背刺。' },
    },
  },
};
export const HERO_ORDER = ['chad', 'karen', 'dale', 'doge'];

// 通用動作
export const COMMON = {
  shove:  { name: '美式足球擒抱推撞', icon: '🏈', kind: 'shove', cost: 'bonus', range: 1.5, text: '附贈動作：1d20+運動 對抗 1d20+目標體能，成功推飛 2 格；推下高台每層 1d6 墜落傷害。' },
  help:   { name: '別叫救護車！扶我起來', icon: '🤲', kind: 'help', cost: 'action', range: 1.5, text: '拉起相鄰倒地的隊友，恢復一半生命值。' },
  yeet:   { name: '萬物皆可 YEET', icon: '🪑', kind: 'yeet', cost: 'action', range: 5, text: '抓起相鄰的摺疊椅、瓦斯桶、販賣機（查德還能抓小型敵人）丟向 5 格內目標。' },
  mentos: { name: '曼陀珠手榴彈', icon: '🍬', kind: 'mentos', cost: 'action', range: 6, radius: 1, text: '丟進快樂水積水引爆可樂間歇泉：半徑 2 格內所有單位 3d6＋擊倒。' },
  valve:  { name: '啟動巨型肉錘', icon: '🔨', kind: 'valve', cost: 'action', range: 1.5, text: '相鄰開關閥時可用：肉錘砸向中央格，首領 −25 HP 並暈眩。' },
  cancel: { name: '強制取消訂閱並刪除帳號', icon: '❌', kind: 'cancel', cost: 'action', range: 1.5, text: '站上 3 層王座並緊鄰主腦時可用。主腦血量 50% 以下直接斬首。' },
};

// 5G 自動續訂晶片（每關限用 1 次）
export const POWERS = {
  drone:  { name: '尊榮當日配・無人機空投', icon: '📦', range: 10, dice: '4d8', text: '500kg 巨型紙箱砸在敵人頭上，4d8 鈍擊並關進紙箱 1 回合。（不耗動作）' },
  refund: { name: '30 天無條件退貨反射盾', icon: '🧾', text: '受到致命攻擊時自動觸發："Item did not match description!" 傷害 100% 退貨給攻擊者。' },
  gaslight: { name: '演算法大數據洗腦', icon: '🧠', range: 8, text: '令一名非首領敵人為我方白白打工 2 回合。（不耗動作）' },
};

// ── 敵人 ──────────────────────────────────────────────
// ai: melee | ranged | caster；atk: 主攻擊；aoe: 範圍攻擊（caster）
// small: 可被查德 YEET；fly: 飛行（無視高低差與地表）；shoveDef: 抵抗推撞加值
const E = (o) => Object.assign({ dex: 1, move: 4, shoveDef: 2, hit: 4, ai: 'melee' }, o);
export const ENEMIES = {
  // 第 1 關
  chihuahua: E({ name: '外星洗腦吉娃娃', icon: '🧠', hp: 22, ac: 12, move: 5, dex: 3, small: true, atk: { name: '腦波狂吠', dice: '2d6+2', range: 1.5 } }),
  raccoon:   E({ name: '垃圾桶變異浣熊', icon: '🦝', hp: 22, ac: 12, small: true, atk: { name: '垃圾抓擊', dice: '2d6+2', range: 1.5 } }),
  tinfoil:   E({ name: '錫箔紙帽陰謀論弓手', icon: '👽', hp: 26, ac: 13, ai: 'ranged', atk: { name: '真相之箭', dice: '2d6+3', range: 6 } }),
  burger:    E({ name: '外星速食吉祥物・漢堡魔神', icon: '🍔', hp: 36, ac: 14, boss: true, hit: 5, shoveDef: 4, atk: { name: '芝麻麵包泰山壓頂', dice: '2d8+3', range: 1.5 } }),
  // 第 2 關
  auntie:    E({ name: '搶電視狂暴大媽', icon: '🛒', hp: 32, ac: 15, hit: 5, shoveDef: 4, atk: { name: '購物車衝撞', dice: '1d10+3', range: 1.5 } }),
  reseller:  E({ name: '插隊球鞋黃牛黨', icon: '🥊', hp: 30, ac: 13, move: 5, dex: 3, hit: 5, atk: { name: '限量鞋盒連打', dice: '2d6+3', range: 1.5 } }),
  scanner:   E({ name: '車頂條碼機狙擊手', icon: '🔫', hp: 26, ac: 14, ai: 'ranged', hit: 5, atk: { name: '條碼雷射', dice: '2d6+3', range: 7 } }),
  paul:      E({ name: '平衡車商場保安隊長・保羅', icon: '🛴', hp: 38, ac: 14, ai: 'caster', boss: true, hit: 5, shoveDef: 3, atk: { name: '警棍點名', dice: '1d8+3', range: 7 }, aoe: { name: '高壓電擊槍', dice: '3d6+2', range: 7, radius: 1.5, lightning: true } }),
  // 第 3 關
  skater:    E({ name: '滑板塗鴉屁孩先鋒', icon: '🛹', hp: 28, ac: 14, move: 5, dex: 3, hit: 5, small: true, atk: { name: '滑板尾翹拍', dice: '2d6+3', range: 1.5 } }),
  pitbull:   E({ name: '未牽繩狂暴比特犬「小公主」', icon: '🐕', hp: 34, ac: 13, move: 6, dex: 3, hit: 5, atk: { name: '甩頭咬', dice: '2d8+3', range: 1.5 } }),
  balloon:   E({ name: '惡作劇水球投擲手', icon: '📱', hp: 26, ac: 13, ai: 'caster', hit: 5, atk: { name: '自拍棒戳', dice: '1d6+2', range: 6 }, aoe: { name: '快樂水水球', dice: '3d6+2', range: 6, radius: 1, soda: true } }),
  blower:    E({ name: '凌晨六點吹葉機怪客', icon: '🍃', hp: 26, ac: 13, ai: 'ranged', hit: 5, atk: { name: '吹葉機噪音砲', dice: '2d6+2', range: 7, push: 1 } }),
  zack:      E({ name: '車庫重金屬樂團主唱・扎克', icon: '🎸', hp: 48, ac: 16, boss: true, hit: 6, shoveDef: 4, atk: { name: '電吉他擴音器重擊', dice: '2d10+4', range: 1.5, push: 1 } }),
  // 第 4 關
  slingshot: E({ name: '露營車頂・彈弓紅脖子', icon: '🎯', hp: 28, ac: 14, ai: 'ranged', hit: 5, atk: { name: '鋼珠彈弓', dice: '2d6+3', range: 7 } }),
  moonshine: E({ name: '大腳車頂・私酒投彈手', icon: '🧨', hp: 28, ac: 13, ai: 'caster', hit: 5, atk: { name: '空酒瓶', dice: '1d8+2', range: 7 }, aoe: { name: '私釀汽油彈', dice: '3d6+2', range: 7, radius: 1.5, fire: true } }),
  mechanic:  E({ name: '扳手修車工狂徒', icon: '🔧', hp: 32, ac: 14, hit: 5, atk: { name: '活動扳手', dice: '2d6+3', range: 1.5 } }),
  bubba:     E({ name: '炸雞桶大胃王・食人魔巴霸', icon: '🍗', hp: 60, ac: 12, boss: true, hit: 6, shoveDef: 6, big: true, atk: { name: '巨型火雞腿重擊', dice: '2d10+5', range: 1.5 } }),
  // 第 5 關
  fryguard:  E({ name: '薯條護衛隊盾兵', icon: '🍟', hp: 34, ac: 15, hit: 6, shoveDef: 4, atk: { name: '薯條盾猛推', dice: '2d6+3', range: 1.5 } }),
  patty:     E({ name: '冷凍肉排處刑者', icon: '🔪', hp: 34, ac: 14, hit: 6, atk: { name: '冷凍肉排斬', dice: '2d8+3', range: 1.5 } }),
  priestess: E({ name: '【副首領】糖分女祭司・芭芭拉', icon: '🥤', hp: 42, ac: 15, ai: 'caster', boss: true, hit: 6, healer: '2d8+4', atk: { name: '吸管射擊', dice: '1d8+3', range: 7 }, aoe: { name: '高果糖漿爆破', dice: '3d6+3', range: 7, radius: 1.5, sugar: true } }),
  warlord:   E({ name: '速食帝國執行長・雙層漢堡督軍', icon: '👑', hp: 58, ac: 16, boss: true, hit: 7, shoveDef: 6, big: true, atk: { name: '黃金雙層漢堡戰錘', dice: '2d10+5', range: 1.5, push: 3, legendary: true } }),
  // 第 6 關
  gator:     E({ name: '下水道變異巨鱷', icon: '🐊', hp: 42, ac: 14, move: 6, dex: 2, hit: 6, shoveDef: 4, atk: { name: '死亡翻滾', dice: '2d8+4', range: 1.5 } }),
  dodger:    E({ name: '地鐵逃票重裝怪客', icon: '🚇', hp: 38, ac: 16, hit: 6, shoveDef: 4, atk: { name: '閘門跳躍踢', dice: '2d8+3', range: 1.5 } }),
  sax:       E({ name: '車廂頂・薩克斯風音波射手', icon: '🎷', hp: 34, ac: 15, ai: 'ranged', hit: 6, atk: { name: '走音長音', dice: '2d6+4', range: 7 } }),
  ratking:   E({ name: '下水道披薩鼠大師・老起司', icon: '🍕', hp: 50, ac: 16, ai: 'caster', boss: true, hit: 7, shoveDef: 3, atk: { name: '披薩飛盤', dice: '2d6+3', range: 7 }, aoe: { name: '牽絲莫札瑞拉起司風暴', dice: '3d8+3', range: 7, radius: 1.8, sugar: true } }),
  // 第 7 關
  batA:      E({ name: '墨西哥辣椒飛行魔蝠 A', icon: '🌶️', hp: 30, ac: 13, ai: 'ranged', fly: true, move: 5, dex: 3, hit: 6, small: true, atk: { name: '辣椒籽機槍', dice: '2d6+3', range: 6, fire: true } }),
  batB:      E({ name: '墨西哥辣椒飛行魔蝠 B', icon: '🌶️', hp: 30, ac: 13, ai: 'ranged', fly: true, move: 5, dex: 3, hit: 6, small: true, atk: { name: '辣椒籽機槍', dice: '2d6+3', range: 6, fire: true } }),
  cowboy:    E({ name: '德州雙槍牛排保鑣', icon: '🤠', hp: 42, ac: 16, hit: 7, shoveDef: 4, atk: { name: '雙槍托重擊', dice: '2d8+4', range: 1.5 } }),
  mecha:     E({ name: '鑄鐵煙燻機甲・牛胸肉 9000 號', icon: '🤖', hp: 70, ac: 18, boss: true, hit: 7, shoveDef: 8, move: 3, dex: 0, big: true, atk: { name: '鑄鐵烤網重擊', dice: '3d8+5', range: 1.5 } }),
  // 第 8 關
  frat:      E({ name: '喝醉的大學兄弟會猛男', icon: '🍺', hp: 38, ac: 14, move: 6, dex: 2, hit: 7, atk: { name: '啤酒桶衝鋒', dice: '2d8+3', range: 1.5 } }),
  ghost:     E({ name: '深夜不睡覺的宿醉怨靈', icon: '👻', hp: 36, ac: 14, ai: 'ranged', fly: true, hit: 7, atk: { name: '宿醉吐息', dice: '2d8+3', range: 6, nausea: true } }),
  chairman:  E({ name: '摺疊椅精準投擲專家', icon: '🪑', hp: 38, ac: 15, ai: 'ranged', hit: 7, atk: { name: '鐵椅飛擲', dice: '2d8+4', range: 7, chair: true } }),
  marcus:    E({ name: '要求退費的暗影飛翼奧客・馬庫斯', icon: '🦇', hp: 64, ac: 16, boss: true, fly: true, move: 6, dex: 3, hit: 7, shoveDef: 4, atk: { name: '退費單連環巴掌', dice: '3d8+4', range: 1.5, canceled: true } }),
  // 第 9 關
  robot:     E({ name: '裁員通知 AI 機械衛兵', icon: '🤖', hp: 42, ac: 16, hit: 7, shoveDef: 5, atk: { name: '資遣通知書斬', dice: '2d8+4', range: 1.5 } }),
  lawyer:    E({ name: '北停機坪・保密協議狙擊律師', icon: '⚖️', hp: 36, ac: 14, ai: 'ranged', hit: 7, atk: { name: '傳票射擊', dice: '2d8+3', range: 7, subpoena: true } }),
  hacker:    E({ name: '南停機坪・演算法黑客法師', icon: '💻', hp: 42, ac: 15, ai: 'caster', hit: 7, atk: { name: '封包注入', dice: '2d6+3', range: 7 }, aoe: { name: '大數據轟炸', dice: '3d8+3', range: 7, radius: 1.5, lightning: true } }),
  lizard:    E({ name: '不朽的蜥蜴人生化執行長・LZRD', icon: '🦎', hp: 76, ac: 18, boss: true, hit: 8, shoveDef: 6, dex: 2, atk: { name: '隱私數據竊取戰錘', dice: '3d8+6', range: 1.5 }, phase2: true }),
  // 第 10 關
  dragon:    E({ name: '百萬訂閱網紅噴火龍戰士', icon: '🐉', hp: 50, ac: 16, move: 5, hit: 8, shoveDef: 6, atk: { name: '業配工商重擊', dice: '2d10+4', range: 1.5 } }),
  adsA:      E({ name: '演算法觸手總監・廣告投放', icon: '🦑', hp: 44, ac: 15, ai: 'caster', hit: 8, atk: { name: '觸手推播', dice: '2d6+4', range: 7 }, aoe: { name: '洗腦推播震爆', dice: '3d8+4', range: 7, radius: 1.5 } }),
  adsB:      E({ name: '演算法觸手總監・流量變現', icon: '🦑', hp: 44, ac: 15, ai: 'caster', hit: 8, atk: { name: '觸手推播', dice: '2d6+4', range: 7 }, aoe: { name: '洗腦推播震爆', dice: '3d8+4', range: 7, radius: 1.5 } }),
  brain:     E({ name: '自動續訂之冠・不可跳過的雙重 30 秒廣告主腦', icon: '👁️', hp: 92, ac: 18, ai: 'brain', boss: true, final: true, move: 0, dex: 0, hit: 8, shoveDef: 99, big: true, atk: { name: '全螢幕彈出式廣告毀滅光束', dice: '4d8+5', range: 8 } }),
};

// ── 道具（佔格的物件）─────────────────────────────────
// block: 不可站人；cover: 提供半身掩護；hp: 可破壞；throw: 可被 YEET；tall: 擋視線
export const PROPS = {
  kiosk:     { name: '外星自動點餐機', block: true, cover: true },
  cart:      { name: '塞滿衛生紙的購物車', block: true, cover: true },
  potty:     { name: '流動廁所', block: true, cover: true, hp: 15, burst: 'sludge' },
  trash:     { name: '大型垃圾桶', block: true, cover: true },
  pillar:    { name: '巨型薯條石柱', block: true, cover: true, tall: true },
  gate:      { name: '地鐵刷卡閘門', block: true, cover: true },
  glass:     { name: '防彈玻璃會議室隔板', block: true, cover: true, tall: true },
  solar:     { name: '太陽能板', block: true, cover: true },
  booth:     { name: '鬆餅屋卡座桌', block: true, cover: true },
  hedge:     { name: '社區修剪樹籬', block: true, cover: true },
  mailbox:   { name: '社區信箱', block: true, cover: true },
  barrel:    { name: '烤肉醬鐵桶', block: true, cover: true },
  wreck:     { name: '墜毀的飛碟漢堡餐車', block: true, cover: true, tall: true },
  truckcab:  { name: '大腳怪卡車車頭', block: true, cover: true, tall: true },
  chair:     { name: '摔角級金屬摺疊椅', block: false, throw: 'chair' },
  gascan:    { name: '瓦斯桶', block: true, hp: 4, throw: 'gascan', explode: true },
  vending:   { name: '自動販賣機', block: true, cover: true, throw: 'vending', heavy: true },
  crate:     { name: '性別揭曉派對炸藥箱', block: true, hp: 5, explode: true, big: true },
  sprinkler: { name: '自動旋轉草坪灑水器（快樂水改裝）', block: true },
  chandelier:{ name: '巨型促銷展示吊燈', hang: true, hp: 1 },
  toyball:   { name: '裝滿熱油的巨型兒童餐玩具球', hang: true, hp: 1 },
  valve:     { name: '巨型肉錘開關閥', block: true },
  server:    { name: '不死專利伺服器塔', block: true, hp: 20, tall: true },
  cable:     { name: '漏電電纜', block: true, hp: 1 },
  chef:      { name: '傳奇鐵板神廚阿姨', block: true, npc: true },
};

// ── 戰利品 ────────────────────────────────────────────
export const LOOT = {
  coupon:   { name: '過期三年的得來速買一送一折價券', icon: '🎟️', who: 'party', text: '得來速短休回血量額外 +10 HP。' },
  segway:   { name: '商場保安的電動平衡車', icon: '🛴', who: 'karen', text: '凱倫每回合移動 +1 格，外型極度滑稽。' },
  bulkcard: { name: '量販店黑鑽會員卡護身符', icon: '💳', who: 'party', text: '每次治療享批發優惠，治療量 +4。' },
  ruler:    { name: '管委會違規罰單激光尺', icon: '📏', who: 'karen', text: '「叫你們經理出來！」射程 +2 格。' },
  crocs:    { name: '開啟運動模式的螢光洞洞鞋', icon: '👟', who: 'dale', text: '老戴移動 +1、敏捷 +1，免疫泥沼與油漬滑倒。' },
  icecream: { name: '絕對不會壞的冰淇淋機聖物', icon: '🍦', who: 'party', text: '全隊法術位上限 +1 格。' },
  metrocard:{ name: '地鐵終身逃票卡', icon: '🎫', who: 'party', text: '使用附贈動作瞬移或潛行時，額外恢復 5 HP。' },
  wwechair: { name: '摔角冠軍摺疊椅', icon: '🪑', who: 'chad', text: 'YEET 與近戰重劈傷害 +1d6，暴擊時 DING DING DING!' },
  skillet:  { name: '德州精金鑄鐵平底鍋防彈甲', icon: '🍳', who: 'chad', text: '查德 AC 提升至 20，且不會被暴擊。' },
  tumbler:  { name: '消保官認證防彈冰霸杯', icon: '🥤', who: 'karen', text: '凱倫 AC +2，火焰傷害減半。' },
  spatula:  { name: '凌晨三點鬆餅屋金鏟子徽章', icon: '🥇', who: 'party', text: '全隊遠程與法術攻擊命中 +1。' },
  ledger:   { name: '離岸免稅冷錢包', icon: '💾', who: 'doge', text: '背刺命中時 50% 機率偷走敵人護甲（敵 AC −2、自身 AC +2）。' },
  sunscreen:{ name: '蜥蜴人執行長的保濕防曬乳與股權書', icon: '🧴', who: 'party', text: '全隊獲得 1 次免費「無人機空投」充能。' },
};

// ── 關卡 ──────────────────────────────────────────────
// h: 12 列字串，'0'~'3' 高度，'L' 烤肉醬熔岩池（高度 0、不可行走），'#' 場外（不可行走）
// props: [type, x, z, opts?]；surf: [type, x0, z0, x1?, z1?]；heroes: chad/karen/dale/doge 出生點
// enemies: [key, x, z, faceX?, faceZ?]
export const LEVELS = [
  {
    n: 1, name: '66 號公路・外星速食飛船墜毀地', en: 'ROUTE 66 DRIVE-THRU CRASH',
    sky: ['#ffb36b', '#ff6f59'], ground: '#d9a066', theme: 'desert',
    intro: '深夜速食吃到一半，你們被墜毀的外送母艦抓走，腦袋裡多了一顆「5G 自動續訂晶片」。七天免費試用期倒數開始。',
    h: [
      '000000000000',
      '000011110000',
      '000011111000',
      '000000000000',
      '000000000000',
      '000000000000',
      '000000000000',
      '000000000000',
      '000001111000',
      '000011110000',
      '000000000000',
      '000000000000',
    ],
    props: [['wreck', 5, 5, { w: 2, d: 2 }], ['kiosk', 4, 4], ['kiosk', 7, 4], ['kiosk', 4, 7], ['kiosk', 7, 7], ['potty', 2, 9], ['gascan', 9, 9], ['chair', 3, 3]],
    surf: [['grease', 8, 5, 8, 6]],
    heroes: { chad: [1, 5], karen: [0, 6], dale: [1, 7], doge: [1, 4] },
    enemies: [['chihuahua', 9, 5], ['raccoon', 9, 7], ['tinfoil', 6, 1], ['burger', 10, 6]],
    check: { hero: 'karen', skill: 'intimidate', label: '威嚇', dc: 10,
      scene: '外星速食吉祥物「漢堡魔神」拿著平板電腦，逼你們簽下 25% 服務費小費單。',
      line: '「你們薯條是冷的，我拒絕付小費，並要求見區經理！」',
      win: '漢堡魔神心態崩潰：開戰直接損失 10 HP，首回合 AC −2！', effect: 'burger' },
    loot: ['coupon'], chip: true,
  },
  {
    n: 2, name: '黑色星期五・量販店大門搶購修羅場', en: 'BLACK FRIDAY MEGA-MART',
    sky: ['#2b2d6e', '#e2475c'], ground: '#59606b', theme: 'parking',
    intro: '量販店鐵捲門前擠滿失去理智的搶購大媽與球鞋黃牛。卸貨月台上，保安隊長騎著平衡車巡邏。',
    h: [
      '000000000000',
      '000000011110',
      '000000012221',
      '000000012221',
      '000000012221',
      '000000011221',
      '000000011221',
      '000000012221',
      '000000012221',
      '000000011110',
      '000000000000',
      '000000000000',
    ],
    props: [['cart', 4, 2], ['cart', 3, 5], ['cart', 5, 7], ['cart', 2, 8], ['cart', 4, 10], ['chandelier', 5, 4, { w: 2, d: 2 }], ['vending', 6, 1], ['chair', 2, 2]],
    surf: [['energy', 3, 3, 4, 3]],
    heroes: { chad: [1, 5], karen: [0, 6], dale: [0, 4], doge: [1, 7] },
    enemies: [['auntie', 6, 4], ['reseller', 6, 8], ['scanner', 9, 3], ['paul', 9, 7]],
    check: { hero: 'doge', skill: 'deceive', label: '欺瞞', dc: 12,
      scene: '一群搶購大媽與球鞋黃牛堵在鐵捲門前。',
      line: '（拿起擴音器）「隔壁走道有半價的 85 吋電視跟限量聯名潮鞋！」',
      win: '黃牛信以為真，開局 2 回合背對你們（白賺背刺優勢）！', effect: 'reseller' },
    loot: ['segway', 'bulkcard'],
  },
  {
    n: 3, name: '陽光草坪社區・管委會大門保衛戰', en: 'SUBURBAN HOA GATE DEFENSE',
    sky: ['#7cd3ff', '#d7f3ff'], ground: '#5fbf4a', theme: 'suburb',
    intro: '你們開局就站在警衛亭二樓露台上。車庫樂團主唱扎克帶著滑板屁孩從東邊馬路衝向修剪整齊的草坪。',
    h: [
      '000000000000',
      '000000000000',
      '221000000000',
      '220000000000',
      '220000000000',
      '220000000000',
      '220000000000',
      '220000000000',
      '220000000000',
      '221000000000',
      '000000000000',
      '000000000000',
    ],
    props: [['sprinkler', 6, 5], ['hedge', 8, 2], ['hedge', 8, 9], ['mailbox', 4, 2], ['trash', 4, 9], ['potty', 9, 5], ['chair', 3, 6]],
    surf: [['soda', 4, 4, 7, 7]],
    heroes: { chad: [1, 4], karen: [0, 6], dale: [1, 6], doge: [1, 7] },
    enemies: [['skater', 10, 3], ['pitbull', 10, 8], ['balloon', 11, 4], ['blower', 11, 7], ['zack', 11, 6]],
    check: { hero: 'chad', skill: 'flex', label: '健身炫耀', dc: 12,
      scene: '車庫重金屬主唱扎克帶著滑板屁孩，準備衝上社區草坪。',
      line: '（當場脫掉背心秀雙頭肌）「你們這群竹竿連空槓都推不起來吧？」',
      win: '全員腎上腺素爆發：第一回合移動 +2、命中 +2！', effect: 'psyched' },
    loot: ['ruler'], chip: true,
  },
  {
    n: 4, name: '佛州沼澤拖車公園・雙大腳車伏擊戰', en: 'TRAILER PARK MONSTER TRUCK AMBUSH',
    sky: ['#ffd36b', '#7fbf6a'], ground: '#7c8a4a', theme: 'swamp',
    intro: '南北兩輛改裝大腳車把泥巴路夾成口袋陣。三百公斤的大胃王巴霸拿著火雞腿擋在正中央。',
    h: [
      '000000000000',
      '000012222000',
      '000012222000',
      '000000000000',
      '000000000000',
      '000000000000',
      '000000000000',
      '000000000000',
      '000000000000',
      '000002222100',
      '000002222100',
      '000000000000',
    ],
    props: [['crate', 9, 4], ['trash', 5, 4], ['trash', 7, 7], ['potty', 3, 8], ['gascan', 10, 8], ['chair', 2, 3]],
    surf: [['mud', 4, 5, 9, 6], ['grease', 6, 7, 6, 7]],
    heroes: { chad: [1, 5], karen: [0, 6], dale: [0, 5], doge: [1, 6] },
    enemies: [['slingshot', 6, 1], ['moonshine', 7, 10], ['mechanic', 8, 6], ['bubba', 9, 5]],
    check: { hero: 'dale', skill: 'kin', label: '佛州同鄉共鳴', dc: 13,
      scene: '大胃王巴霸拿著巨型烤火雞腿堵在拖車公園中央。',
      line: '（掏出懷裡的短吻鱷與一瓶私釀玉米威士忌）「兄弟，先乾一杯再說！」',
      win: '巴霸決定先吃宵夜：首回合跳過行動，就站在可引爆的炸藥箱旁！', effect: 'bubba' },
    loot: ['crocs'],
  },
  {
    n: 5, name: '高熱量聖殿・速食邪教總部祭壇', en: 'THE DEEP-FRIED SANCTUM',
    sky: ['#3a0d0d', '#c2471a'], ground: '#5a2a1a', theme: 'temple',
    intro: '三層黃金汽水祭壇上，漢堡督軍與糖分女祭司正在宣揚高果糖漿福音。',
    h: [
      '00000012333#',
      '00000012333#',
      '00000012333#',
      '00000012333#',
      '00000012333#',
      '00000012333#',
      '00000012333#',
      '00000012333#',
      '00000012333#',
      '00000012333#',
      '00000012333#',
      '00000012333#',
    ],
    props: [['pillar', 3, 2], ['pillar', 3, 9], ['pillar', 4, 5], ['pillar', 5, 3], ['pillar', 5, 8], ['toyball', 8, 4, { w: 2, d: 3 }], ['chair', 1, 2]],
    surf: [['grease', 8, 4, 9, 6]],
    heroes: { chad: [1, 5], karen: [0, 6], dale: [0, 4], doge: [1, 7] },
    enemies: [['fryguard', 6, 5], ['patty', 6, 7], ['priestess', 9, 3], ['warlord', 9, 7]],
    check: { hero: 'karen', skill: 'health', label: '衛生局檢舉', dc: 14,
      scene: '督軍與女祭司站在三樓黃金汽水祭壇上。',
      line: '（拿出放大鏡指著祭壇）「你們的冰淇淋機怎麼又壞了？我要通報衛生局！」',
      win: '女祭司心虛跑去修冰淇淋機：開局兩回合無法施法！', effect: 'priestess' },
    loot: ['icecream'], chip: true,
  },
  {
    n: 6, name: '紐約地鐵下水道・螢光披薩鼠王國', en: 'SUBWAY NEON SEWER',
    sky: ['#06120c', '#0d3b2a'], ground: '#2c3a33', theme: 'sewer',
    intro: '廢棄地鐵車廂與發光蘑菇形成四座孤島。披薩鼠大師老起司站在車廂頂上指揮巨鱷包圍你們。',
    h: [
      '000000000000',
      '002222100000',
      '002222000000',
      '000000001100',
      '000000001100',
      '000000000000',
      '000000000000',
      '011000000000',
      '011000222200',
      '000001222200',
      '000000000000',
      '000000000000',
    ],
    props: [['gate', 3, 5], ['gate', 7, 6], ['gate', 8, 3], ['trash', 10, 2], ['chair', 0, 9]],
    surf: [['slime', 4, 4, 6, 7], ['slime', 9, 6, 10, 6]],
    heroes: { chad: [1, 4], karen: [0, 5], dale: [1, 6], doge: [1, 3] },
    enemies: [['gator', 9, 5], ['dodger', 8, 7], ['sax', 6, 8], ['ratking', 8, 9]],
    check: { hero: 'doge', skill: 'persuade', label: '嘴砲說服', dc: 14,
      scene: '披薩鼠大師站在廢棄車廂頂，周圍是變異巨鱷。',
      line: '（掏出一片冷掉的夏威夷鳳梨披薩）「不投降，我就把鳳梨加進你們每一片披薩。」',
      win: '全體地鐵生物陷入鳳梨恐懼：首回合命中 −2！', effect: 'pineapple' },
    loot: ['metrocard', 'wwechair'],
  },
  {
    n: 7, name: '德州終極煙燻烤肉爐・機甲牛胸肉守衛', en: 'TEXAS MECHA-BBQ PIT',
    sky: ['#2a0a00', '#ff7a1a'], ground: '#4a3020', theme: 'bbq',
    intro: '五噸重的鑄鐵煙燻機甲從沸騰的烤肉醬池中緩緩升起。競技場中央的巨型肉錘開關閥，是唯一的勝算。',
    h: 'bbq',
    props: [['valve', 2, 5], ['barrel', 3, 3], ['barrel', 8, 8], ['chair', 1, 8]],
    surf: [],
    center: [[5, 5], [6, 5], [5, 6], [6, 6]],
    heroes: { chad: [1, 6], karen: [0, 5], dale: [0, 6], doge: [1, 4] },
    enemies: [['batA', 10, 1], ['batB', 10, 10], ['cowboy', 8, 6], ['mecha', 7, 5]],
    check: { hero: 'chad', skill: 'bbq', label: '美式烤肉學識', dc: 15,
      scene: '鑄鐵機甲「牛胸肉 9000 號」從烤肉醬池中升起，排氣管噴著山胡桃木煙。',
      line: '「誰烤德州牛胸肉會塗番茄醬？這簡直是對蛋白質的侮辱！」',
      win: '機甲 AI 晶片被冒犯到過熱：AC 從 18 降到 15！', effect: 'mecha' },
    loot: ['skillet', 'tumbler'], chip: true,
  },
  {
    n: 8, name: '凌晨三點的鬆餅屋・鐵板神廚保衛戰', en: '3 AM WAFFLE DINER SURVIVAL',
    sky: ['#0a0a1a', '#2a1a4a'], ground: '#d8d0c0', theme: 'diner',
    intro: '凌晨三點，全美戰鬥力最強的鬆餅屋遭到暗影飛翼奧客馬庫斯與喝醉的兄弟會破窗突襲。',
    h: [
      '000000000000',
      '000000000000',
      '221000000000',
      '221000000000',
      '221000000000',
      '221000000000',
      '221000000000',
      '221000000000',
      '221000000000',
      '221000000000',
      '000000000000',
      '000000000000',
    ],
    props: [['chef', 1, 1], ['booth', 5, 4], ['booth', 7, 7], ['booth', 8, 3], ['booth', 4, 9], ['chair', 4, 3], ['chair', 5, 8], ['chair', 7, 5], ['chair', 3, 6], ['chair', 6, 2], ['vending', 3, 10]],
    surf: [['grease', 3, 2, 3, 3]],
    heroes: { chad: [2, 5], karen: [0, 6], dale: [1, 4], doge: [2, 7] },
    enemies: [['frat', 10, 4], ['ghost', 11, 6], ['chairman', 10, 8], ['marcus', 11, 5]],
    check: { hero: 'dale', skill: 'latenight', label: '深夜酒客交涉', dc: 15,
      scene: '暗影飛翼奧客馬庫斯帶著兄弟會破門而入，要求全額退費。',
      line: '（投幣點唱機播放鄉村搖滾）「在鬆餅屋鬧事的人，連神都救不了你！」',
      win: '鐵板神廚阿姨出手：每回合用鍋鏟替你們擋下一次遠程投擲物！', effect: 'chef' },
    loot: ['spatula', 'ledger'],
  },
  {
    n: 9, name: '矽谷科技巨頭總部頂樓・蜥蜴人執行長決戰', en: 'SILICON VALLEY ROOFTOP',
    sky: ['#0b1d3a', '#6a3cff'], ground: '#3a4250', theme: 'rooftop',
    intro: '元宇宙伺服器王座前，不朽的蜥蜴人執行長眨著水平瞬膜眼睛，想把 VR 頭盔推銷給你們。',
    h: [
      '000122200000',
      '000122200000',
      '000000000000',
      '000000012330',
      '000000012330',
      '000000012330',
      '000000012330',
      '000000012330',
      '000000012330',
      '000000000000',
      '000122200000',
      '000122200000',
    ],
    props: [['server', 10, 6], ['cable', 4, 6], ['glass', 3, 3], ['glass', 3, 8], ['solar', 6, 3], ['solar', 6, 8], ['chair', 1, 6]],
    surf: [['energy', 5, 5, 6, 6]],
    heroes: { chad: [1, 5], karen: [0, 6], dale: [0, 4], doge: [1, 7] },
    enemies: [['robot', 7, 6], ['lawyer', 5, 0], ['hacker', 5, 11], ['lizard', 9, 5]],
    check: { hero: 'doge', skill: 'hack', label: '駭客拆穿', dc: 16,
      scene: '蜥蜴人執行長站在伺服器王座前推銷 VR 頭盔。',
      line: '「先完成這張『請點選所有紅綠燈』的驗證碼，證明你是人類。」',
      win: '執行長分不清紅綠燈邊角而當機 1 回合，伺服器塔直接過載自爆！', effect: 'lizard' },
    loot: ['sunscreen'],
  },
  {
    n: 10, name: '超級盃中場秀之巔・不可跳過的 30 秒廣告主腦', en: 'ATOP THE UNSKIPPABLE AD-BRAIN',
    sky: ['#05030f', '#ff2a8a'], ground: '#1a1530', theme: 'stage',
    intro: '漂浮在體育場上空的廣告主腦，把「略過廣告」按鈕做得只有 1×1 像素。最後一天試用期，取消它。',
    h: [
      '000222200000',
      '000222200000',
      '001000000000',
      '000001123###',
      '000001123###',
      '000001123300',
      '000001123300',
      '000001123###',
      '000001123###',
      '001000000000',
      '000222200000',
      '000222200000',
    ],
    props: [['chair', 2, 5], ['solar', 4, 4], ['solar', 4, 7]],
    surf: [],
    throne: [[9, 5], [9, 6]],
    heroes: { chad: [1, 5], karen: [0, 6], dale: [0, 4], doge: [1, 7] },
    enemies: [['dragon', 7, 5], ['adsA', 4, 1], ['adsB', 4, 10], ['brain', 10, 5]],
    check: { hero: 'all', skill: 'team', label: '終極聯合客訴', dc: 18,
      scene: '主腦發出震耳欲聾的推播音效，「略過廣告」只有 1×1 像素。',
      line: '凱倫掏出消保官電話、多吉開啟擋廣告外掛、老戴點燃全州煙火、查德舉起 200kg 槓鈴對準主機！',
      win: '強制全螢幕鎖定被破除：全員 HP 上限 +15、法術位全滿、首擊必定暴擊！', effect: 'freedom' },
    loot: [],
  },
];

// 第 7 關：圓形競技台＋烤肉醬環＋四角烤架高台，用程式生成
export function bbqMap() {
  const rows = [];
  for (let z = 0; z < GRID; z++) {
    let s = '';
    for (let x = 0; x < GRID; x++) {
      const dx = x - 5.5, dz = z - 5.5, d = Math.hypot(dx, dz);
      const cx = Math.min(x, 11 - x), cz = Math.min(z, 11 - z);
      let c = '0';
      if (cx <= 1 && cz <= 1) c = '2';
      else if (cx <= 2 && cz <= 2) c = '1';
      else if (d > 2.4 && d < 4.2 && !(x === 5 || x === 6 || z === 5 || z === 6)) c = 'L';
      s += c;
    }
    rows.push(s);
  }
  return rows;
}

// 晶片預設分配（直接跳關時使用）：依過關序 chip1..4
export const DEFAULT_CHIPS = [['dale', 'drone'], ['doge', 'gaslight'], ['chad', 'refund'], ['karen', 'drone']];

export const TIP_START = 2, TIP_MAX = 4, MENTOS_PER_LEVEL = 2;
