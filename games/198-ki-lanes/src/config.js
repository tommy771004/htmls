// 常數、色票、英雄與技能數值。數值調整集中在這裡。
import { LOL_ITEMS } from './items-lol.js';
export const DT = 1 / 60;            // 固定模擬步長
export const MAP = 90;               // 地圖半寬
export const TEAM_COLOR = ['#24a38f', '#d9472b'];
export const TEAM_LIGHT = ['#8fe8d4', '#ffa184'];
export const TEAM_NAME = ['青隊', '赤隊'];
export const BASE = [[-72, 72], [72, -72]];
export const FOUNTAIN = [[-81, 81], [81, -81]];

export const KI_BAR = 100;
export const KI_MAX = 5 * KI_BAR;
export const MAX_LEVEL = 12;
export const xpToNext = (lv) => 140 + 88 * (lv - 1);
export const respawnTime = (lv, t = 0) => (5 + lv * 1.4) * (1 + Math.min(0.5, Math.max(0, t - 360) / 1200)); // 6 分鐘後隨時間拉長，最多 ×1.5
// 擊殺賞金（《英雄聯盟》）：連殺的英雄被終結時多給錢；連死的英雄賞金遞減；一血多 100
export const BOUNTY = { base: 300, firstBlood: 100, shutdownPer: 120, shutdownMax: 600, deathCut: 0.15, minMul: 0.5, xpPerLv: 0.16 };

// 小兵與建築
export const WAVE_EVERY = 25;
export const FIRST_WAVE = 4;
export const MINION = {
  melee: { hp: 380, dmg: 16, range: 1.7, cd: 1.1, speed: 4.6, radius: 0.55, xp: 34, sight: 8 },
  ranged: { hp: 260, dmg: 24, range: 6.2, cd: 1.4, speed: 4.6, radius: 0.5, xp: 28, sight: 8.5 },
  siege: { hp: 950, dmg: 42, range: 6.8, cd: 1.8, speed: 4.3, radius: 0.85, xp: 70, sight: 9, structMul: 2.1 },
  super: { hp: 1600, dmg: 85, range: 1.9, cd: 0.95, speed: 4.6, radius: 0.8, xp: 95, sight: 9, structMul: 2.4 }, // 超級兵：敵方這一路的水晶兵營倒了才會出
};
export const SIEGE_FROM_WAVE = 13;     // 第幾波起每波帶一台攻城兵
export const MINION_GROWTH = 0.06;   // 每分鐘血量與傷害成長
export const TOWER = { hp: [2500, 3000], inhib: 2200, nexus: 2600, inhibRespawn: 120, core: 4400, range: 9, dmg: 150, dmgMinion: 95, cd: 1.0, ramp: 0.35, radius: 1.6 };
export const XP_SHARE_RADIUS = 15;
// 塔皮：開局 5 分 30 秒內，外塔每掉三分之一血給附近敵方英雄 120 金（平分）
export const PLATES = { n: 3, gold: 120, until: 330, radius: 15 };

// 屬性公式（《英雄聯盟》）：防禦數值化、技能加速、攻速相加、高移速遞減
export const STAT = {
  armorLv: 0.8,          // 每級防禦成長
  asLv: 0.025,           // 每級攻速加成
  asMinInterval: 0.4,    // 普攻間隔下限（每秒 2.5 下）
  msCap: [8.6, 10.1],    // 超過第一段打 8 折、超過第二段打 5 折（原作 415／490 換算）
  ovSkill: 0.33,         // 全能吸血對技能傷害只算三分之一（多為範圍技）
};

// 野怪：每隊半邊兩營（恐龍、紅緞帶機器人），河道一隻大猿（王）
export const CAMPS = [
  { id: 'dinoA', kind: 'dino', x: -48, z: -18, n: 2 },
  { id: 'robotA', kind: 'robot', x: 18, z: 48, n: 2 },
  { id: 'dinoB', kind: 'dino', x: 48, z: 18, n: 2 },
  { id: 'robotB', kind: 'robot', x: -18, z: -48, n: 2 },
  { id: 'ape', kind: 'ape', x: 34, z: 34, n: 1, boss: true },
];

// 英雄（七龍珠 FighterZ 同人致敬；招式名取自原作）。火影忍者、海賊王的客串角色在下方另外加入
// stats: hp/hpLv 血量與每級成長、ad/adLv 攻擊、range 普攻距離、as 普攻間隔（秒）、ms 移速、armor 防禦（承受傷害 ×100／(100＋防禦)，技能防禦的基礎值同樣用它）
// ssj：爆氣時變身超級賽亞人
export const HEROES = {
  goku: {
    name: '孫悟空', short: '悟空', en: 'GOKU', role: '近戰鬥士', color: '#4fc3ff', glow: '#e6f8ff', melee: true, ssj: true,
    blurb: '愛打架的賽亞人。連段長、續戰力強，爆氣時變身超級賽亞人。',
    stats: { hp: 650, hpLv: 90, ad: 58, adLv: 4.3, range: 2.4, as: 0.76, ms: 7.3, armor: 14 },
    skills: {
      Q: { name: '龜派氣功', desc: '雙掌推出氣功彈，命中後小範圍爆炸。', cd: 5, range: 14, dmg: [70, 110, 150, 190, 230], adR: 0.6, radius: 2.6, speed: 34 },
      W: { name: '龍閃拳', desc: '向前衝刺，撞到敵人時打出四段連打並把對手打飛。', cd: 9, range: 8, dmg: [24, 34, 44, 54, 64], hits: 4, adR: 0.25 },
      E: { name: '瞬間移動', desc: '瞬移；游標附近有敵人時繞到它背後，下一次普攻硬直。', cd: 10, range: 8 },
      R: { name: '超級龜派氣功', desc: '花 3 格氣，放出巨大的龜派氣功光束，持續 1.2 秒。', cd: 45, range: 22, dmg: [60, 90, 120], ticks: 6, adR: 0.35, width: 2.4, ki: 3 },
    },
  },
  vegeta: {
    name: '貝吉塔', short: '貝吉塔', en: 'VEGETA', role: '刺客', color: '#ffd84a', glow: '#fff6c8', melee: true, ssj: true,
    blurb: '賽亞人的王子。瞬移切入、連續能量彈壓制，終極閃光一擊定勝負。',
    stats: { hp: 580, hpLv: 80, ad: 62, adLv: 4.6, range: 2.3, as: 0.7, ms: 7.5, armor: 11 },
    skills: {
      Q: { name: '連續能量彈', desc: '射出能量彈，命中後連鎖到附近兩個敵人。', cd: 5, range: 13, dmg: [65, 100, 135, 170, 205], adR: 0.55, speed: 46, chain: 2 },
      W: { name: '超級衝刺踢', desc: '衝刺後接五段快踢。', cd: 8, range: 7.5, dmg: [17, 24, 31, 38, 45], hits: 5, adR: 0.2 },
      E: { name: '殘像閃', desc: '閃到目標背後並重置普攻鏈。', cd: 8, range: 9 },
      R: { name: '終極閃光', desc: '花 3 格氣，蓄力後放出極寬的金色光束。', cd: 50, range: 18, dmg: [70, 105, 140], ticks: 6, adR: 0.4, width: 3.8, windup: 0.55, ki: 3 },
    },
  },
  trunks: {
    name: '特南克斯', short: '特南克斯', en: 'TRUNKS', role: '劍士', color: '#ffb03a', glow: '#fff0d0', melee: true, blade: true, ssj: true,
    blurb: '來自未來的劍士。劍閃穿過整排敵人，熱圓頂攻擊把對手打上天再炸開。',
    stats: { hp: 610, hpLv: 84, ad: 60, adLv: 4.4, range: 2.8, as: 0.74, ms: 7.4, armor: 11 },
    skills: {
      Q: { name: '魔閃光', desc: '雙手射出貫穿的氣功波，把敵人往後推。', cd: 6, range: 13, dmg: [60, 100, 140, 180, 220], adR: 0.55, width: 1.7, speed: 36 },
      W: { name: '閃光斬', desc: '揮劍穿過路徑上所有敵人，終點補一發氣功彈。', cd: 9, range: 8.5, dmg: [55, 85, 115, 145, 175], adR: 0.45 },
      E: { name: '旋風跳', desc: '翻身躍到游標處，下一次普攻硬直。', cd: 9, range: 7.5 },
      R: { name: '熱圓頂攻擊', desc: '花 3 格氣，閃到敵人身邊一劍挑上天，再放出圓頂狀的大爆炸。', cd: 48, range: 10, dmg: [240, 350, 460], adR: 0.7, radius: 6, ki: 3 },
    },
  },
  piccolo: {
    name: '比克', short: '比克', en: 'PICCOLO', role: '坦克', color: '#b6ff5c', glow: '#efffd2', melee: true,
    blurb: '那美克星人。伸長手臂把敵人拉過來，再生護身，魔貫光殺砲貫穿一整排。',
    stats: { hp: 760, hpLv: 105, ad: 52, adLv: 3.7, range: 2.6, as: 0.9, ms: 6.9, armor: 28 },
    skills: {
      Q: { name: '魔空包圍彈', desc: '在游標處布下一圈氣彈，0.6 秒後收攏爆炸並擊飛。', cd: 8, range: 12, dmg: [70, 110, 150, 190, 230], adR: 0.5, radius: 3.4 },
      W: { name: '伸臂抓取', desc: '伸長手臂，把第一個碰到的敵人拉到身邊並暈眩。', cd: 12, range: 10, dmg: [50, 75, 100, 125, 150], adR: 0.4 },
      E: { name: '再生', desc: '短距瞬移，再生回血並獲得護盾。', cd: 12, range: 5, shield: [90, 130, 170, 210, 250] },
      R: { name: '魔貫光殺砲', desc: '花 3 格氣，指尖蓄力後射出貫穿一整排的螺旋光束。', cd: 50, range: 26, dmg: [300, 430, 560], adR: 0.9, width: 1.6, windup: 0.7, ki: 3 },
    },
  },
  frieza: {
    name: '弗利沙', short: '弗利沙', en: 'FRIEZA', role: '遠程術士', color: '#ff4fb4', glow: '#ffe0f2', melee: false,
    blurb: '宇宙的帝王。死亡光束點殺、飛盤來回切割，死亡球覆蓋一大片。',
    stats: { hp: 520, hpLv: 72, ad: 52, adLv: 3.6, range: 7.2, as: 0.85, ms: 7.0, armor: 6 },
    skills: {
      Q: { name: '死亡光束', desc: '指尖射出極快的光束，命中的敵人減速 35%。', cd: 5.5, range: 16, dmg: [80, 120, 160, 200, 240], adR: 0.6, speed: 62, slow: 0.35 },
      W: { name: '死亡飛盤', desc: '擲出飛盤，飛出去再飛回來，來回都會切到敵人。', cd: 9, range: 12, dmg: [55, 85, 115, 145, 175], adR: 0.45, speed: 22 },
      E: { name: '瞬移擊', desc: '瞬移，下一次普攻硬直。', cd: 10, range: 8.5 },
      R: { name: '死亡球', desc: '花 3 格氣，舉起巨大的能量球砸向游標處，大範圍傷害並暈眩。', cd: 55, range: 15, dmg: [280, 400, 520], adR: 0.8, radius: 6.5, ki: 3 },
    },
  },
  a18: {
    name: '人造人18號', short: '18號', en: 'ANDROID 18', role: '遠程射手', color: '#c7f0ff', glow: '#ffffff', melee: false,
    blurb: '能量無限的人造人。氣圓斬貫穿、能量屏障彈開近身者，能量波一陣掃射。',
    stats: { hp: 540, hpLv: 76, ad: 56, adLv: 4.2, range: 7.6, as: 0.72, ms: 7.1, armor: 8 },
    skills: {
      Q: { name: '氣圓斬', desc: '擲出貫穿的氣圓斬，切過路徑上所有敵人。', cd: 6, range: 15, dmg: [70, 110, 150, 190, 230], adR: 0.55, width: 1.4, speed: 30 },
      W: { name: '背後擒抱', desc: '衝刺，抓住第一個碰到的敵人往身後摔出並暈眩。', cd: 10, range: 8, dmg: [60, 90, 120, 150, 180], adR: 0.45 },
      E: { name: '能量屏障', desc: '張開屏障，獲得護盾並彈開身邊的敵人。', cd: 11, range: 0, shield: [80, 120, 160, 200, 240] },
      R: { name: '能量波', desc: '花 3 格氣，朝游標方向掃射 14 發能量彈。', cd: 45, range: 14, dmg: [26, 38, 50], adR: 0.16, shots: 14, ki: 3 },
    },
  },
};
// 火影忍者、海賊王的客串角色（同人致敬；招式名取自原作，模型與特效全部以程式繪製）
Object.assign(HEROES, {
  naruto: {
    name: '漩渦鳴人', short: '鳴人', en: 'NARUTO', role: '近戰鬥士', color: '#ff8a1f', glow: '#fff0d8', melee: true, franchise: 'naruto',
    blurb: '意外性 No.1 的忍者。影分身圍毆、螺旋丸撞飛，風遁螺旋手裏劍炸開一大片。',
    stats: { hp: 640, hpLv: 90, ad: 57, adLv: 4.2, range: 2.4, as: 0.75, ms: 7.4, armor: 12 },
    skills: {
      Q: { name: '螺旋丸', desc: '向前衝刺，撞到敵人時把螺旋丸按上去，爆炸並擊飛。', cd: 7, range: 8, dmg: [80, 120, 160, 200, 240], adR: 0.6, radius: 2.4 },
      W: { name: '影分身之術', desc: '在游標處變出三個影分身圍毆，連打四下。', cd: 10, range: 9, dmg: [22, 32, 42, 52, 62], hits: 4, adR: 0.22, radius: 3.2 },
      E: { name: '替身術', desc: '留下一截木頭替身，瞬移到游標處，下一次普攻硬直。', cd: 10, range: 8 },
      R: { name: '風遁・螺旋手裏劍', desc: '花 3 格氣擲出巨大的螺旋手裏劍，到點炸開成風刃球，持續切割 1.2 秒。', cd: 48, range: 16, dmg: [60, 90, 120], ticks: 6, adR: 0.3, radius: 5, ki: 3 },
    },
  },
  sasuke: {
    name: '宇智波佐助', short: '佐助', en: 'SASUKE', role: '刺客', color: '#8f7bff', glow: '#eef0ff', melee: true, blade: true, franchise: 'naruto',
    blurb: '宇智波一族的天才。豪火球燒開、千鳥貫穿麻痺，麒麟從天而降。',
    stats: { hp: 580, hpLv: 80, ad: 62, adLv: 4.6, range: 2.5, as: 0.72, ms: 7.5, armor: 11 },
    skills: {
      Q: { name: '豪火球之術', desc: '吐出巨大的火球，命中後炸開。', cd: 6, range: 13, dmg: [75, 115, 155, 195, 235], adR: 0.6, radius: 3, speed: 26 },
      W: { name: '千鳥', desc: '帶著雷光衝刺，撞到敵人時貫穿並麻痺 0.8 秒。', cd: 9, range: 8, dmg: [70, 105, 140, 175, 210], adR: 0.55 },
      E: { name: '寫輪眼・瞬身', desc: '閃到游標附近敵人的背後，重置普攻鏈。', cd: 9, range: 9 },
      R: { name: '麒麟', desc: '花 3 格氣，引落天雷化成的麒麟，砸向游標處。', cd: 50, range: 15, dmg: [300, 430, 560], adR: 0.85, radius: 5.5, ki: 3 },
    },
  },
  kakashi: {
    name: '旗木卡卡西', short: '卡卡西', en: 'KAKASHI', role: '遠程術士', color: '#7aa8ff', glow: '#eef5ff', melee: false, franchise: 'naruto',
    blurb: '拷貝忍者。水龍彈推開、追牙之術絆住，雷切切入，神威把人吸進異空間。',
    stats: { hp: 560, hpLv: 78, ad: 55, adLv: 4.0, range: 6.6, as: 0.8, ms: 7.2, armor: 9 },
    skills: {
      Q: { name: '水遁・水龍彈', desc: '噴出水龍，貫穿路徑上的敵人並往後推。', cd: 6, range: 13, dmg: [65, 100, 135, 170, 205], adR: 0.55, width: 2.0, speed: 30 },
      W: { name: '土遁・追牙之術', desc: '忍犬從地底竄出，一整排敵人被咬住定身 1 秒。', cd: 11, range: 12, dmg: [50, 75, 100, 125, 150], adR: 0.4, width: 2.2 },
      E: { name: '雷切', desc: '帶著雷光突刺，撞到第一個敵人時造成傷害並麻痺。', cd: 10, range: 8, dmg: [60, 90, 120, 150, 180], adR: 0.6 },
      R: { name: '神威', desc: '花 3 格氣，在游標處扭曲空間，把範圍內的敵人往中心吸 1.2 秒並持續造成傷害。', cd: 50, range: 14, dmg: [50, 75, 100], ticks: 6, adR: 0.3, radius: 5, ki: 3 },
    },
  },
  sakura: {
    name: '春野櫻', short: '小櫻', en: 'SAKURA', role: '坦克', color: '#ff6fae', glow: '#ffe8f2', melee: true, franchise: 'naruto',
    blurb: '綱手的弟子。怪力一拳打碎地面，醫療忍術替隊友回血，天之拳從天砸落。',
    stats: { hp: 740, hpLv: 102, ad: 54, adLv: 3.8, range: 2.4, as: 0.86, ms: 7.0, armor: 25 },
    skills: {
      Q: { name: '櫻花衝', desc: '對游標處揮出怪力一拳，打碎地面，範圍內敵人被擊飛。', cd: 8, range: 6, dmg: [70, 110, 150, 190, 230], adR: 0.55, radius: 3.2 },
      W: { name: '怪力衝拳', desc: '衝刺，撞到敵人時重拳把它打飛並暈眩。', cd: 10, range: 7.5, dmg: [60, 90, 120, 150, 180], adR: 0.5 },
      E: { name: '醫療忍術', desc: '替自己與附近的隊友回血並給護盾。', cd: 12, range: 0, shield: [80, 120, 160, 200, 240] },
      R: { name: '百豪之術・天之拳', desc: '花 3 格氣跳向游標處，從空中砸下，大範圍傷害並暈眩。', cd: 48, range: 12, dmg: [260, 380, 500], adR: 0.75, radius: 6, ki: 3 },
    },
  },
  luffy: {
    name: '蒙其・D・魯夫', short: '魯夫', en: 'LUFFY', role: '近戰鬥士', color: '#ff3b4b', glow: '#ffe6e8', melee: true, franchise: 'op',
    blurb: '橡膠果實能力者。手臂伸長打人、橡膠火箭飛撲，二檔加速，巨人手槍一拳轟飛。',
    stats: { hp: 700, hpLv: 96, ad: 58, adLv: 4.3, range: 3.4, as: 0.74, ms: 7.4, armor: 18 },
    skills: {
      Q: { name: '橡膠槍', desc: '手臂伸長打出直拳，打中第一個敵人並擊退。', cd: 5, range: 11, dmg: [70, 110, 150, 190, 230], adR: 0.6 },
      W: { name: '橡膠火箭', desc: '把自己彈射到游標處，落地撞開周圍的敵人。', cd: 10, range: 10, dmg: [55, 85, 115, 145, 175], adR: 0.45, radius: 3 },
      E: { name: '二檔', desc: '進入二檔：6 秒內移速 +25%、攻速 +35%，身上冒出蒸氣。', cd: 14, range: 0, dur: 6, ms: 0.25, as: 0.35 },
      R: { name: '橡膠巨人手槍', desc: '花 3 格氣把拳頭吹成巨人大小轟出，貫穿一整排敵人並擊飛。', cd: 46, range: 16, dmg: [280, 400, 520], adR: 0.8, width: 3.6, ki: 3 },
    },
  },
  zoro: {
    name: '羅羅亞・索隆', short: '索隆', en: 'ZORO', role: '劍士', color: '#3fd07a', glow: '#e8fff0', melee: true, blade: true, franchise: 'op',
    blurb: '三刀流劍豪。鬼斬穿過一排敵人，三十六煩惱鳳飛斬，三千世界旋身一刀斬盡。',
    stats: { hp: 620, hpLv: 86, ad: 61, adLv: 4.5, range: 2.8, as: 0.74, ms: 7.3, armor: 12 },
    skills: {
      Q: { name: '三十六煩惱鳳', desc: '揮出飛行的斬擊，貫穿路徑上的敵人。', cd: 6, range: 13, dmg: [65, 105, 145, 185, 225], adR: 0.6, width: 1.6, speed: 34 },
      W: { name: '鬼斬', desc: '三刀交叉衝過去，斬中路徑上所有敵人。', cd: 9, range: 8, dmg: [60, 90, 120, 150, 180], adR: 0.5 },
      E: { name: '獅子歌歌', desc: '一瞬間閃到游標處，途中的敵人全部被斬。', cd: 10, range: 8, dmg: [40, 60, 80, 100, 120], adR: 0.4 },
      R: { name: '三千世界', desc: '花 3 格氣旋轉三刀衝到敵人身邊，周圍一圈大範圍斬擊。', cd: 48, range: 10, dmg: [250, 360, 470], adR: 0.75, radius: 5.5, ki: 3 },
    },
  },
  sanji: {
    name: '賓什莫克・香吉士', short: '香吉士', en: 'SANJI', role: '刺客', color: '#ff6a3d', glow: '#fff0e0', melee: true, franchise: 'op',
    blurb: '只用腳戰鬥的廚師。連環踢壓制、空中步行切入，惡魔風腳燃燒一整套連踢。',
    stats: { hp: 590, hpLv: 82, ad: 61, adLv: 4.5, range: 2.6, as: 0.7, ms: 7.6, armor: 11 },
    skills: {
      Q: { name: '首肉射擊', desc: '前踏一記重踢，把前方敵人踢飛。', cd: 5, range: 6, dmg: [70, 110, 150, 190, 230], adR: 0.6 },
      W: { name: '羊肉射擊', desc: '原地倒立旋轉連踢三下，打中周圍所有敵人。', cd: 9, range: 0, dmg: [30, 45, 60, 75, 90], hits: 3, adR: 0.25, radius: 3.2 },
      E: { name: '空中步行', desc: '踏著空氣跳到游標處，下一次普攻硬直。', cd: 9, range: 8.5 },
      R: { name: '惡魔風腳・畫龍點睛', desc: '花 3 格氣，燃燒的腳衝向前方，撞到敵人時連踢六下再一腳炸飛。', cd: 46, range: 9, dmg: [36, 52, 68], hits: 6, adR: 0.18, ki: 3 },
    },
  },
  nami: {
    name: '娜美', short: '娜美', en: 'NAMI', role: '遠程術士', color: '#ffa23c', glow: '#fff3e0', melee: false, franchise: 'op',
    blurb: '天才航海士。天候棒招來落雷、冷氣泡讓敵人變慢，雷雲在戰場上空連續劈落。',
    stats: { hp: 560, hpLv: 78, ad: 54, adLv: 3.9, range: 7.4, as: 0.8, ms: 7.1, armor: 9 },
    skills: {
      Q: { name: '雷霆節拍', desc: '在游標處劈下一道落雷，0.4 秒後命中並短暫麻痺。', cd: 6, range: 13, dmg: [75, 115, 155, 195, 235], adR: 0.6, radius: 2.4 },
      W: { name: '冷氣泡', desc: '在游標處布下冷氣霧，3 秒內敵人移速 -40%。', cd: 11, range: 12, dmg: [30, 45, 60, 75, 90], adR: 0.3, radius: 3.6, slow: 0.4 },
      E: { name: '旋風節拍', desc: '颳起旋風，把身邊的敵人吹開並短暫暈眩。', cd: 11, range: 0, dmg: [40, 60, 80, 100, 120], adR: 0.3 },
      R: { name: '雷雲・宙之雷', desc: '花 3 格氣在游標處召來雷雲，3 秒內連續落雷。', cd: 52, range: 14, dmg: [55, 80, 105], ticks: 8, adR: 0.25, radius: 6, ki: 3 },
    },
  },
});
for (const id of ['goku', 'vegeta', 'trunks', 'piccolo', 'frieza', 'a18']) HEROES[id].franchise = 'db';
export const FRANCHISES = [['db', '七龍珠'], ['naruto', '火影忍者'], ['op', '海賊王']];
export const HERO_ORDER = ['goku', 'vegeta', 'trunks', 'piccolo', 'frieza', 'a18', 'naruto', 'sasuke', 'kakashi', 'sakura', 'luffy', 'zoro', 'sanji', 'nami'];

// 技能資源（《英雄聯盟》的魔力／能量）：Q/W/E/R 都要花；R 另外花 3 格氣（FighterZ 的必殺量表）。
// 魔力型：上限與回復隨等級和裝備成長（七龍珠叫魔力、火影叫查克拉）；能量型（海賊王叫體力）：上限 200、每秒固定回 12，裝備不加。
// 集氣（C）時資源回復 ×3；泉水每秒回 12% 上限；爆氣期間額外回 15% 上限。
export const RES = {
  mana: { cost: { Q: [45, 50, 55, 60, 65], W: [55, 60, 65, 70, 75], E: [50, 50, 50, 50, 50], R: [100, 100, 100] }, color: '#4a6cf0' },
  energy: { max: 200, regen: 12, cost: { Q: [50], W: [60], E: [40], R: [0] }, color: '#a6dc4a' },
  chargeMul: 3, fountain: 0.12, spark: 0.15,
};
// 依定位的魔力數值：mp 上限、mpLv 每級、mpr 每秒回復、mprLv 每級
const MANA_BY_ROLE = {
  '坦克': { mp: 300, mpLv: 34, mpr: 3.6, mprLv: 0.3 },
  '刺客': { mp: 280, mpLv: 34, mpr: 3.8, mprLv: 0.32 },
  '遠程術士': { mp: 380, mpLv: 46, mpr: 4.6, mprLv: 0.4 },
  '遠程射手': { mp: 320, mpLv: 38, mpr: 4.0, mprLv: 0.34 },
};
const MANA_DEFAULT = { mp: 300, mpLv: 36, mpr: 3.8, mprLv: 0.32 };
for (const id of HERO_ORDER) {
  const d = HEROES[id];
  d.res = d.franchise === 'op' ? 'energy' : 'mana';
  d.resName = d.franchise === 'op' ? '體力' : d.franchise === 'naruto' ? '查克拉' : '魔力';
  if (d.res === 'mana') Object.assign(d.stats, MANA_BY_ROLE[d.role] || MANA_DEFAULT);
}

// 開場符文（《英雄聯盟》的基石符文）：選角時挑一個，AI 用 rec 裡的推薦
export const RUNES = [
  { id: 'conqueror', name: '戰鬥狂', proto: '征服者', desc: '普攻或技能命中英雄疊 1 層（技能 2 層），5 秒內最多 8 層，每層傷害 +1.5%。疊滿時對英雄造成的傷害回復 8% 血量。' },
  { id: 'electrocute', name: '雷擊三連', proto: '電刑', desc: '3 秒內用三次不同的普攻或技能命中同一名英雄，落雷追加 30＋每級 12＋額外攻擊 30%＋氣功強度 25% 的傷害。冷卻 20 秒。' },
  { id: 'grasp', name: '不死之身', proto: '不滅之握', desc: '交戰中每 4 秒，下一次普攻英雄追加 4% 自身最大血量的傷害、回復 2% 最大血量，並永久 +6 血量（遠程減半）。' },
  { id: 'tempo', name: '連打節奏', proto: '致命節奏', desc: '普攻英雄疊 1 層，6 秒內最多 6 層，每層攻速 +7%。' },
  { id: 'comet', name: '流星氣彈', proto: '秘術彗星', desc: '技能命中英雄時，一顆流星在 0.8 秒後砸向該處，造成 30＋每級 10＋氣功強度 35%＋額外攻擊 20% 的傷害。冷卻 16 秒。' },
  { id: 'phase', name: '舞空術', proto: '相位衝擊', desc: '4 秒內用三次普攻或技能命中同一名英雄，3 秒內移速 +35%。冷卻 14 秒。' },
  { id: 'harvest', name: '魂之收割', proto: '靈魂收割', desc: '傷害血量低於 50% 的英雄時追加 30＋每個靈魂 11＋額外攻擊 10%＋氣功強度 5% 的傷害，並收下一個靈魂（永久 +11）。冷卻 35 秒，參與擊殺後 1 秒就能再發動。' },
  { id: 'hail', name: '連擊風暴', proto: '刀鋒之雹', desc: '普攻英雄時，接下來 3 次普攻攻速 +90%（遠程 +60%）。冷卻 10 秒。' },
  { id: 'glacial', name: '冰封術', proto: '冰川增幅', desc: '暈眩、擊飛或冰凍英雄後，在目標周圍留下 3 秒的冰凍領域，緩速敵人 30%。冷卻 25 秒。' },
  { id: 'spellbook', name: '萬能卷軸', proto: '啟封法書', desc: '遊戲 2 分鐘 24 秒後，脫戰時可以按 Shift＋F（手機長按 F 格）換一個召喚師技能，冷卻 120 秒，每換過一種新的就縮短 10 秒。' },
  { id: 'firstStrike', name: '先手必勝', proto: '先發制人', desc: '對英雄先出手（對方 3 秒內沒傷害過你）時，3 秒內對英雄傷害 +7%，並得到 10 金＋額外傷害一半的金錢（遠程 35%）。冷卻 20 秒。' },
  { id: 'pta', name: '強襲', proto: '強攻', desc: '連續三次普攻同一英雄時追加 40＋每級 10 的傷害，之後到脫戰前你對它的傷害 +8%。' },
  { id: 'fleet', name: '瞬身步法', proto: '瞬疾步法', desc: '移動與普攻蓄能，滿了的下一次普攻回復 15＋每級 12＋額外攻擊 10%＋氣功強度 5% 的血量，並在 1 秒內移速 +20%（遠程回血六成、移速 +75%）。' },
  { id: 'aftershock', name: '金剛震', proto: '裂地衝擊', desc: '暈眩、擊飛或冰凍英雄後，2.5 秒內物理與技能防禦 +20＋額外防禦的 75%，然後放出震波造成 25＋每級 8＋額外血量 8% 的技能傷害。冷卻 20 秒。' },
  { id: 'guardian', name: '守護之誓', proto: '神聖守護', desc: '守護 6 公尺內的隊友：自己或隊友 2.5 秒內受到明顯傷害時，兩人都得到 40＋每級 10＋氣功強度 20%＋額外血量 6% 的護盾 1.5 秒。冷卻 45 秒。' },
  { id: 'aery', name: '式神', proto: '召喚艾莉', desc: '傷害英雄時放出式神，追加 10＋每級 4＋氣功強度 5%＋額外攻擊 10% 的傷害；治療或護盾隊友時改為給隊友 20＋每級 8 的護盾。式神飛回來前（2 秒）不能再放。' },
  { id: 'deathfire', name: '冥火', proto: '冥火之觸', desc: '技能傷害英雄時讓它燃燒 4 秒，每秒 3＋每級 1＋氣功強度 2.5%＋額外攻擊 7% 的技能傷害；燒滿 3 秒後傷害 +75%。' },
];
// 符文五系（《英雄聯盟》）：主系選 1 個基石＋每列 1 個小符文；副系從不同的兩列各選 1 個；另有 3 列碎片
export const RUNE_TREES = [
  { id: 'dom', name: '征伐', proto: '征服', keys: ['electrocute', 'harvest', 'hail'] },
  { id: 'insp', name: '啟發', proto: '啟示', keys: ['glacial', 'spellbook', 'firstStrike'] },
  { id: 'prec', name: '精準', proto: '精準', keys: ['pta', 'tempo', 'fleet', 'conqueror'] },
  { id: 'res', name: '意志', proto: '意志', keys: ['grasp', 'aftershock', 'guardian'] },
  { id: 'sorc', name: '巫術', proto: '巫術', keys: ['aery', 'comet', 'phase', 'deathfire'] },
];
// 小符文：tree、row（1～3）、效果 psv（traits.js 的原語，key 前綴 rune_）
export const MINOR_RUNES = [
  { id: 'cheapShot', tree: 'dom', row: 1, name: '趁虛而入', proto: '凌虐', desc: '傷害被暈眩、冰凍或緩速的英雄時，追加 10＋每級 3 的真實傷害（4 秒一次）。', psv: { k: 'cheapShot', base: 10, lv: 3, cd: 4 } },
  { id: 'tasteBlood', tree: 'dom', row: 1, name: '嗜血', proto: '血噬', desc: '傷害英雄時回復 16＋每級 2＋額外攻擊 10%＋氣功強度 5%（20 秒一次）。', psv: { k: 'tasteBlood', base: 16, lv: 2, cd: 20 } },
  { id: 'impact', name: '突襲', tree: 'dom', row: 1, proto: '即刻衝擊', desc: '瞬移、衝刺或閃現後 4 秒內，下一次傷害英雄追加 20＋每級 5 的真實傷害（10 秒一次）。', psv: { k: 'impact', base: 20, lv: 5, cd: 10 } },
  { id: 'sixthSense', tree: 'dom', row: 2, name: '第六感', proto: '第六感', desc: '看得到附近的敵方眼。', psv: { k: 'statAdd', detect: 1 } },
  { id: 'mementos', tree: 'dom', row: 2, name: '戰利品', proto: '恐懼紀念物', desc: '參與擊殺英雄收集戰利品（最多 6 個），每個召喚師技能加速 +3。', psv: { k: 'stacks', sumAh: 3, max: 6 } },
  { id: 'deepWard', tree: 'dom', row: 2, name: '深潛眼', proto: '敵後守衛', desc: '插下的眼多存在 40%、多一點血。', psv: { k: 'statAdd', wardLife: 0.4 } },
  { id: 'treasure', tree: 'dom', row: 3, name: '尋寶獵人', proto: '寶藏獵人', desc: '第一次參與擊殺每名敵方英雄時，得到 50＋每層 20 金（層數＝獵過的不同英雄）。', psv: { k: 'hunter', gold: 50, per: 20 } },
  { id: 'relentless', tree: 'dom', row: 3, name: '窮追獵人', proto: '殘虐獵人', desc: '每層獵人（獵過的不同英雄）脫戰移速 +2.5%。', psv: { k: 'hunter', ooc: 0.025 } },
  { id: 'ultHunter', tree: 'dom', row: 3, name: '終極獵人', proto: '終焉獵人', desc: '大絕技能加速 +6，每層獵人再 +5。', psv: { k: 'hunter', ultAh: 6, ultPer: 5 } },

  { id: 'hexflash', tree: 'insp', row: 1, name: '機巧閃現', proto: '海克斯充能閃現', desc: '閃現在冷卻時，F 改成引導 1 秒後閃現的機巧閃現（冷卻 20 秒）。', psv: { k: 'flag', hexflash: 1 } },
  { id: 'footwear', tree: 'insp', row: 1, name: '神行鞋', proto: '魔法靈靴', desc: '4 分 48 秒時免費得到移速多 3% 的武道鞋（在那之前不能買鞋），每次參與擊殺提早 18 秒。', psv: { k: 'flag', footwear: 1 } },
  { id: 'cashback', tree: 'insp', row: 1, name: '回饋金', proto: '兌現', desc: '購買終極裝備時退還 7.5% 的錢。', psv: { k: 'flag', cashback: 0.075 } },
  { id: 'triple', tree: 'insp', row: 2, name: '三帖藥', proto: '三倍藥水', desc: '升到 3 級得到 2 瓶傷藥，6 級得到依定位的藥丸，9 級得到鐵壁丸。', psv: { k: 'flag', triple: 1 } },
  { id: 'timewarp', tree: 'insp', row: 2, name: '時光藥', proto: '時間扭曲藥水', desc: '喝傷藥或水壺時，立刻回復總量的 40%。', psv: { k: 'flag', timewarp: 0.4 } },
  { id: 'biscuit', tree: 'insp', row: 2, name: '乾糧快遞', proto: '乾糧快遞', desc: '開局到 2 分 24 秒每 48 秒送一塊乾糧（按 1 吃），回復 20＋2% 最大血量（缺血越多回越多），並永久血量 +30。', psv: { k: 'flag', biscuit: 1 } },
  { id: 'cosmic', tree: 'insp', row: 3, name: '星空視界', proto: '銀河視界', desc: '召喚師技能加速 +18，主動道具冷卻 -9%。', psv: { k: 'statAdd', sumAh: 18, itemAh: 10 } },
  { id: 'approach', tree: 'insp', row: 3, name: '乘勝追擊', proto: '斗轉星移', desc: '附近有被緩速、暈眩或冰凍的敵方英雄時，移速 +7.5%。', psv: { k: 'approach', ms: 0.075, r: 10 } },
  { id: 'jack', tree: 'insp', row: 3, name: '萬事通', proto: '萬事通', desc: '裝備每提供一種不同的屬性，技能加速 +1；5 種時再 +8 適性之力，10 種時 +20。', psv: { k: 'jack' } },

  { id: 'absorb', tree: 'prec', row: 1, name: '吸取', proto: '吸取生命', desc: '擊殺任何敵方單位回復 6＋每級 1 血量。', psv: { k: 'absorb', base: 6, lv: 1 } },
  { id: 'triumph', tree: 'prec', row: 1, name: '凱旋', proto: '凱旋', desc: '參與擊殺英雄時回復 5% 已損血量＋2.5% 最大血量，並多 20 金。', psv: { k: 'triumph' } },
  { id: 'presence', tree: 'prec', row: 1, name: '心如止水', proto: '氣定神閒', desc: '傷害英雄時回復 6＋每級 4 魔力（體力 6，8 秒一次）；參與擊殺回復 15% 最大魔力。', psv: { k: 'presence', base: 6, lv: 4, cd: 8 } },
  { id: 'alacrity', tree: 'prec', row: 2, name: '傳奇・迅捷', proto: '傳奇：敏捷', desc: '攻速 +3%，每層傳奇再 +1.5%（最多 10 層）。參與擊殺英雄或大型野怪各 1 層，每補 20 隻兵 1 層。', psv: { k: 'legend', as: 0.015, base: { as: 0.03 }, max: 10 } },
  { id: 'legendHaste', tree: 'prec', row: 2, name: '傳奇・疾速', proto: '傳奇：疾速', desc: '每層傳奇一般技能（Q、W、E）加速 +1.5（最多 10 層）。', psv: { k: 'legend', basicAh: 1.5, max: 10 } },
  { id: 'bloodline', tree: 'prec', row: 2, name: '傳奇・血統', proto: '傳奇：血脈', desc: '每層傳奇普攻吸血 +0.45%（最多 15 層），滿層血量 +85。', psv: { k: 'legend', ls: 0.0045, max: 15, fullHp: 85 } },
  { id: 'coup', tree: 'prec', row: 3, name: '致命一擊', proto: '致命一擊', desc: '對血量低於 40% 的英雄傷害 +8%。', psv: { k: 'dmgVsHp', below: 0.4, pct: 0.08 } },
  { id: 'cutDown', tree: 'prec', row: 3, name: '斬殺', proto: '斬殺', desc: '對血量高於 60% 的英雄傷害 +8%。', psv: { k: 'dmgVsHp', above: 0.6, pct: 0.08 } },
  { id: 'lastStand', tree: 'prec', row: 3, name: '背水一戰', proto: '背水一戰', desc: '自己血量低於 60% 時傷害 +5%，30% 時 +11%。', psv: { k: 'lastStand' } },

  { id: 'demolish', tree: 'res', row: 1, name: '破城', proto: '爆破', desc: '在塔旁邊連打 3 次普攻時，第 3 下追加 85＋最大血量 28% 的物理傷害（遠程 50＋20%，30 秒一次）。', psv: { k: 'demolish', cd: 30 } },
  { id: 'fontLife', tree: 'res', row: 1, name: '生命泉源', proto: '生命之泉', desc: '暈眩、冰凍或緩速英雄時，自己與附近血量最低的隊友回復 20＋每級 5（遠程七成，20 秒一次）。', psv: { k: 'fontLife', base: 20, lv: 5, cd: 20 } },
  { id: 'shieldBash', tree: 'res', row: 1, name: '盾擊', proto: '盾擊', desc: '得到新護盾後，下一次對英雄的普攻追加 5＋每級 2＋額外血量 2.5%＋護盾量 15% 的傷害。', psv: { k: 'shieldBash' } },
  { id: 'conditioning', tree: 'res', row: 2, name: '鍛鍊', proto: '調節', desc: '4 分 48 秒後物理與技能防禦 +4，再多 3%。', psv: { k: 'conditioning', at: 288, v: 4, pct: 0.03 } },
  { id: 'secondWind', tree: 'res', row: 2, name: '回氣', proto: '回春', desc: '受到英雄傷害後 10 秒內回復 4% 已損血量。', psv: { k: 'secondWind', pct: 0.04 } },
  { id: 'bonePlating', tree: 'res', row: 2, name: '骨甲', proto: '骨甲', desc: '受到英雄傷害後，接下來 1.5 秒內的 3 次傷害各減少 20＋每級 3（55 秒一次）。', psv: { k: 'bonePlating', base: 20, lv: 3, cd: 55 } },
  { id: 'overgrowth', tree: 'res', row: 3, name: '茁壯', proto: '過度生長', desc: '附近每死 8 隻敵方小兵或野怪，永久最大血量 +3；收集 120 隻時再 +3.5%。', psv: { k: 'overgrowth' } },
  { id: 'revitalize', tree: 'res', row: 3, name: '復甦', proto: '甦醒', desc: '治療與護盾強度 +5%；對血量低於 40% 的目標再 +10%。', psv: { k: 'statAdd', hsp: 0.05 } },
  { id: 'unflinching', tree: 'res', row: 3, name: '不屈', proto: '堅毅', desc: '被控場期間與之後 2 秒，物理與技能防禦 +5。', psv: { k: 'unflinching', v: 5 } },

  { id: 'axiomArc', tree: 'sorc', row: 1, name: '大絕奧義', proto: '公理奧術大師', desc: '大絕的傷害 +10%；參與擊殺時大絕目前的冷卻 -7%。', psv: { k: 'axiomArc', pct: 0.1, cdr: 0.07 } },
  { id: 'manaflow', tree: 'sorc', row: 1, name: '氣力之環', proto: '附魔之帶', desc: '技能命中英雄時最大魔力 +25（15 秒一次，最多 +250）；滿了之後每 5 秒回復 1% 已用魔力。', psv: { k: 'manaflow' } },
  { id: 'nimbusCloak', tree: 'sorc', row: 1, name: '筋斗雲披風', proto: '光輝披風', desc: '施放召喚師技能後 2 秒內移速 +15%～45%（冷卻越長的技能越多）。', psv: { k: 'nimbusCloak' } },
  { id: 'transcend', tree: 'sorc', row: 2, name: '超越', proto: '卓越', desc: '5 級技能加速 +5、8 級再 +5；11 級起參與擊殺時一般技能剩餘冷卻 -20%。', psv: { k: 'transcend' } },
  { id: 'celerity', tree: 'sorc', row: 2, name: '神速', proto: '迅捷', desc: '移速 +1%，所有移速加成效果再強 7%。', psv: { k: 'statAdd', ms: 0.01, msAmp: 0.07 } },
  { id: 'absFocus', tree: 'sorc', row: 2, name: '絕對專注', proto: '絕對專注', desc: '血量高於 70% 時，適性之力 +2＋每級 1.5（攻擊或氣功強度，取較高的那邊）。', psv: { k: 'absFocus' } },
  { id: 'scorch', tree: 'sorc', row: 3, name: '灼燒', proto: '焦灼', desc: '技能命中英雄時，1 秒後追加 20＋每級 2 的技能傷害（10 秒一次）。', psv: { k: 'heroProc', dmg: 20, lvDmg: 2, cd: 10, skillOnly: true, delay: 1 } },
  { id: 'waterwalk', tree: 'sorc', row: 3, name: '踏浪', proto: '水行者', desc: '在河道上移速 +3%、適性之力 +8＋每級 1.5。', psv: { k: 'waterwalk' } },
  { id: 'storm', tree: 'sorc', row: 3, name: '風暴凝聚', proto: '暴風凝聚', desc: '每 4 分鐘適性之力增加（4 分 +8、8 分 +24、12 分 +48…）。', psv: { k: 'storm', every: 240 } },
];
// 碎片：每列選 1
export const SHARDS = [
  [{ id: 'as', name: '攻速 +10%', stats: { as: 0.1 } }, { id: 'af', name: '適性之力 +9', adaptive: 9 }, { id: 'ah', name: '技能加速 +8', stats: { ah: 8 } }],
  [{ id: 'af', name: '適性之力 +9', adaptive: 9 }, { id: 'ms', name: '移速 +2%', stats: { ms: 0.02 } }, { id: 'hpLv', name: '血量 +10～180（隨等級）', hpLv: true }],
  [{ id: 'hp', name: '血量 +65', stats: { hp: 65 } }, { id: 'ten', name: '韌性與緩速抗性 +10%', stats: { ten: 0.1 }, slowRes: 0.1 }, { id: 'hpLv', name: '血量 +10～180（隨等級）', hpLv: true }],
];
// 各定位的預設符文頁（玩家可在選角畫面改）
export const RUNE_PAGES = {
  fighter: { minors: ['triumph', 'alacrity', 'lastStand'], sec: 'res', secs: ['secondWind', 'unflinching'], shards: ['as', 'af', 'hpLv'] },
  assassin: { minors: ['tasteBlood', 'mementos', 'ultHunter'], sec: 'prec', secs: ['triumph', 'coup'], shards: ['af', 'af', 'hpLv'] },
  tank: { minors: ['demolish', 'secondWind', 'overgrowth'], sec: 'insp', secs: ['biscuit', 'cosmic'], shards: ['ah', 'ms', 'hp'] },
  mage: { minors: ['manaflow', 'transcend', 'scorch'], sec: 'insp', secs: ['biscuit', 'cosmic'], shards: ['ah', 'af', 'hp'] },
  marksman: { minors: ['presence', 'alacrity', 'coup'], sec: 'dom', secs: ['tasteBlood', 'treasure'], shards: ['as', 'af', 'hpLv'] },
};
export const RUNE_REC = {
  goku: 'conqueror', vegeta: 'electrocute', trunks: 'conqueror', piccolo: 'grasp', frieza: 'comet', a18: 'tempo',
  naruto: 'conqueror', sasuke: 'electrocute', kakashi: 'comet', sakura: 'grasp', luffy: 'tempo', zoro: 'conqueror', sanji: 'phase', nami: 'comet',
};
// 野怪增益（《英雄聯盟》的藍 buff／紅 buff）：最後一擊紅緞帶機器人得藍、恐龍得紅；英雄陣亡時增益轉給擊殺者
export const JUNGLE_BUFF = {
  blue: { dur: 60, mpr: 1.0, energy: 0.5, ah: 11, name: '藍色氣焰' },
  red: { dur: 60, burn: 8, burnLv: 3, burnT: 3, slow: 0.15, name: '赤色氣焰' },
};

// 金幣與商店
export const GOLD = { start: 500, passive: 2.2, melee: 21, ranged: 16, siege: 55, super: 60, hero: 300, assist: 120, tower: 120, shopRadius: 14 };
// stats：ad 攻擊、hp 血量、armor 物理防禦、mr 技能防禦（數值）、as 攻速加成（相加後除攻擊間隔）、ms 移速比例、ki 氣力獲得、ah 技能加速（冷卻 ×100／(100＋加速)）、leth 固定穿甲、apen ％穿甲、mpen 固定法穿、mpenPct ％法穿、ten 韌性（相乘疊加）、ov 全能吸血、skill 技能傷害、dmg 全傷害、
//   vision 視野、regen 脫戰回血（每秒比例）、detect 看得到敵方的眼、mp 最大魔力、mpr 魔力回復（比例）、ap 氣功強度、crit 暴擊率、ls 普攻吸血
//   （能量型英雄的體力固定，mp／mpr 對他們無效）
// psv：被動（同名被動不疊加，取最大）。blade 咒刃（施放技能後下一次普攻追加 blade 倍基礎攻擊）、critDmg 暴擊傷害倍率、overheal 吸血溢出轉護盾（最大血量比例）、
//   thorns 被普攻時反彈 { base, lv, pct } 並施加重傷 gw（治療降低比例）、ga 致命傷害時 3 秒後原地復活（冷卻秒數）、tear 每次施放技能最大魔力 +N（上限 TEAR_MAX）、
//   mpAp 氣功強度 +最大魔力的比例、apAmp 氣功強度 +比例、lvMp 升級時回復最大魔力的比例
// act：主動效果（2、3 鍵依序對應身上第一、第二個主動道具）。stasis 凝時（無敵且無法行動）、cleanse 淨化（解除控制並加速）
// proto：設計參考的《英雄聯盟》裝備；note：被動或主動的說明
// 合成：from 列出需要的下位道具，cost 是合成費（不含下位道具）；總價 = cost + 下位道具總價
export const ITEMS = [
  { id: 'senzu', name: '仙豆', cost: 120, tier: 0, desc: '吃下立刻回復 45% 血量、45% 魔力（體力）與 1 格氣。最多帶 3 顆。', consumable: true, max: 3, field: 'senzu' },
  // 《英雄聯盟》的藥水與藥劑：數字鍵 1 先吃仙豆，沒有仙豆才喝藥水；藥劑買下就服用，同時只有一種，效果 90 秒
  { id: 'salve', name: '傷藥', cost: 50, tier: 0, proto: '生命藥水', desc: '按 1（沒有仙豆時）：15 秒內回復 120 血。最多帶 5 瓶。', consumable: true, max: 5, field: 'salve' },
  { id: 'flask', name: '隨身水壺', cost: 150, tier: 0, proto: '回復藥水', desc: '按 1（沒有仙豆與傷藥時）：12 秒內回復 100 血，可喝 2 次，回到泉水自動裝滿。只能帶 1 個。', consumable: true, max: 1, field: 'flask' },
  { id: 'ironpill', name: '鐵壁丸', cost: 500, tier: 0, proto: '抗擊藥劑', desc: '買下立刻服用：90 秒內血量 +300、韌性 +25%。同時只能有一種藥丸。', consumable: true, max: 1, field: 'pillIron', elixir: { stats: { hp: 300, ten: 0.25 } } },
  { id: 'kipill', name: '增氣丸', cost: 500, tier: 0, proto: '巫魔藥劑', desc: '買下立刻服用：90 秒內氣功強度 +50、魔力回復 +15%，傷害英雄時追加 25 真實傷害（5 秒一次）。同時只能有一種藥丸。', consumable: true, max: 1, field: 'pillKi', elixir: { stats: { ap: 50, mpr: 0.15 }, psv: { sorcery: { k: 'heroProc', dmg: 25, cd: 5, trueDmg: true } } } },
  { id: 'ragepill', name: '狂戰丸', cost: 500, tier: 0, proto: '憤怒藥劑', desc: '買下立刻服用：90 秒內攻擊 +30、普攻吸血 +8%。同時只能有一種藥丸。', consumable: true, max: 1, field: 'pillRage', elixir: { stats: { ad: 30, ls: 0.08 } } },
  { id: 'control', name: '真眼', cost: 75, tier: 0, desc: '按 5 放下：敵我都看得到，會照出 9 公尺內的敵方眼（可拆），本身要打 4 下。每人場上限 1 顆，最多帶 2 顆。', consumable: true, max: 2, field: 'controls' },
  // 基礎
  { id: 'weights', name: '負重護腕', cost: 350, tier: 1, proto: '長劍', desc: '攻擊 +12', stats: { ad: 12 } },
  { id: 'gi', name: '修行道服', cost: 350, tier: 1, proto: '紅水晶', desc: '血量 +180', stats: { hp: 180 } },
  { id: 'capsule', name: '蓄氣膠囊', cost: 300, tier: 1, proto: '藍水晶', desc: '魔力 +220', stats: { mp: 220 } },
  { id: 'scroll', name: '龜仙流秘笈', cost: 350, tier: 1, proto: '增幅之書', desc: '氣功強度 +20', stats: { ap: 20 } },
  { id: 'gloves', name: '瞄準手套', cost: 350, tier: 1, proto: '敏捷斗篷', desc: '暴擊率 +15%', stats: { crit: 0.15 } },
  { id: 'cloth', name: '修行護甲', cost: 300, tier: 1, proto: '布甲', desc: '物理防禦 +6', stats: { armor: 6 } },
  { id: 'cape', name: '界王神披風', cost: 300, tier: 1, proto: '抗魔斗篷', desc: '技能防禦 +6', stats: { mr: 6 } },
  { id: 'tear', name: '界王星之水', cost: 400, tier: 1, proto: '女神之淚', desc: '魔力 +240，魔力回復 +25%', stats: { mp: 240, mpr: 0.25 }, psv: { tear: 8 }, note: '被動・積蓄：每次施放技能，最大魔力永久 +8（最多 +360）。體力型英雄無效。' },
  { id: 'kiband', name: '氣功護腕', cost: 300, tier: 1, desc: '氣力獲得 +15%', stats: { ki: 0.15 } },
  { id: 'boots', name: '武道鞋', cost: 300, boots: true, tier: 1, proto: '鞋子', desc: '移速 +8%', stats: { ms: 0.08 } },
  { id: 'scouter', name: '戰鬥力探測器', cost: 450, tier: 1, proto: '偵查鏡', desc: '攻速 +12%，視野 +3，看得到附近的敵方眼', stats: { as: 0.12, vision: 3, detect: 1 } },
  // 進階
  { id: 'kaioken', name: '界王拳腰帶', cost: 500, tier: 2, from: ['weights', 'weights'], desc: '攻擊 +36，技能傷害 +12%', stats: { ad: 36, skill: 0.12 } },
  { id: 'armor', name: '賽亞人戰甲', cost: 450, tier: 2, from: ['gi', 'weights'], proto: '吞噬者', desc: '血量 +350，攻擊 +14，物理防禦 +6', stats: { hp: 350, ad: 14, armor: 6 } },
  { id: 'nimbus', name: '筋斗雲', cost: 400, boots: true, tier: 2, from: ['boots', 'kiband'], proto: '狂戰士脛甲', desc: '移速 +16%，攻速 +10%，氣力獲得 +20%', stats: { ms: 0.16, as: 0.1, ki: 0.2 } },
  { id: 'kiamp', name: '氣力增幅器', cost: 500, tier: 2, from: ['kiband', 'scouter'], desc: '氣力獲得 +30%，技能加速 +18，攻速 +14%，視野 +3，看得到敵方眼', stats: { ki: 0.3, ah: 18, as: 0.14, vision: 3, detect: 1 } },
  { id: 'cell', name: '再生細胞', cost: 450, tier: 2, from: ['gi', 'gi'], proto: '狂徒鎧甲（簡化）', desc: '血量 +460，脫戰每秒回 1.5% 血', stats: { hp: 460, regen: 0.015 } },
  { id: 'sheen', name: '元氣手環', cost: 450, tier: 2, from: ['capsule'], proto: '耀光', desc: '魔力 +250，技能加速 +5', stats: { mp: 250, ah: 5 }, psv: { blade: 1 }, note: '被動・咒刃：施放技能後 10 秒內，下一次普攻追加 100% 基礎攻擊的傷害（1.5 秒冷卻）。' },
  { id: 'fang', name: '惡魔之牙', cost: 350, tier: 2, from: ['weights'], proto: '吸血鬼權杖', desc: '攻擊 +16，普攻吸血 10%', stats: { ad: 16, ls: 0.1 } },
  { id: 'brave', name: '勇者之劍', cost: 550, tier: 2, from: ['weights'], proto: '暴風大劍', desc: '攻擊 +36', stats: { ad: 36 } },
  { id: 'tome', name: '天界秘笈', cost: 300, tier: 2, from: ['scroll', 'capsule'], proto: '遺失的章節', desc: '氣功強度 +30，魔力 +300，魔力回復 +40%', stats: { ap: 30, mp: 300, mpr: 0.4 }, psv: { lvMp: 0.2 }, note: '被動・頓悟：升級時回復 20% 最大魔力。' },
  { id: 'bramble', name: '荊棘護腕', cost: 400, tier: 2, from: ['cloth'], proto: '荊棘背心', desc: '物理防禦 +11', stats: { armor: 11 }, psv: { thorns: { base: 6, lv: 2, pct: 0.1, gw: 0.4 } }, note: '被動・荊棘：被英雄普攻命中時，反彈 6＋每級 2＋所受傷害 10% 的傷害，並讓對方重傷 3 秒（受到的治療 -40%）。' },
  // 終極
  { id: 'water', name: '超神水', cost: 600, tier: 3, from: ['kaioken', 'cell'], desc: '全部傷害 +18%，攻擊 +40，血量 +520，技能傷害 +12%', stats: { dmg: 0.18, ad: 40, hp: 520, skill: 0.12, regen: 0.01 } },
  { id: 'potara', name: '波塔拉耳環', cost: 650, tier: 3, from: ['armor', 'kiamp'], desc: '血量 +420，攻擊 +24，技能加速 +25，物理與技能防禦 +9，氣力獲得 +30%', stats: { hp: 420, ad: 24, ah: 25, armor: 9, mr: 9, ki: 0.3, detect: 1, vision: 3 } },
  { id: 'trinity', name: '超元氣手環', cost: 500, tier: 3, from: ['sheen', 'armor'], proto: '三相之力', desc: '攻擊 +34，血量 +320，攻速 +15%，技能加速 +11，魔力 +250，物理防禦 +6', stats: { ad: 34, hp: 320, as: 0.15, ah: 11, mp: 250, armor: 6 }, psv: { blade: 2 }, note: '被動・咒刃：施放技能後 10 秒內，下一次普攻追加 200% 基礎攻擊的傷害（1.5 秒冷卻）。' },
  { id: 'zsword', name: 'Z 劍', cost: 650, tier: 3, from: ['brave', 'gloves'], proto: '無盡之刃', desc: '攻擊 +62，暴擊率 +25%', stats: { ad: 62, crit: 0.25 }, psv: { critDmg: 2.15 }, note: '被動・無盡：暴擊傷害從 175% 提高到 215%。' },
  { id: 'majin', name: '魔人之牙', cost: 450, tier: 3, from: ['fang', 'brave'], proto: '飲血劍', desc: '攻擊 +56，普攻吸血 18%', stats: { ad: 56, ls: 0.18 }, psv: { overheal: 0.15 }, note: '被動・血之盾：吸血溢出的血量轉成護盾，最多 15% 最大血量。' },
  { id: 'hourglass', name: '時光屋沙漏', cost: 900, tier: 3, from: ['scroll', 'cloth'], proto: '中婭沙漏', desc: '氣功強度 +60，物理防禦 +11', stats: { ap: 60, armor: 11 }, act: { id: 'stasis', cd: 90, dur: 2.5, name: '凝時' }, note: '主動・凝時（2／3 鍵）：2.5 秒內無敵但無法行動，冷卻 90 秒。' },
  { id: 'halo', name: '天使光環', cost: 1100, tier: 3, from: ['weights', 'cloth'], proto: '守護天使', desc: '攻擊 +36，物理防禦 +11', stats: { ad: 36, armor: 11 }, psv: { ga: 180 }, note: '被動・復活：受到致命傷害時倒下，3 秒後原地以 40% 血量、30% 魔力復活（期間無敵），冷卻 180 秒。' },
  { id: 'thorn', name: '針刺戰甲', cost: 600, tier: 3, from: ['bramble', 'gi'], proto: '荊棘之甲', desc: '血量 +320，物理防禦 +18', stats: { hp: 320, armor: 18 }, psv: { thorns: { base: 12, lv: 3, pct: 0.18, gw: 0.6 } }, note: '被動・荊棘：被英雄普攻命中時，反彈 12＋每級 3＋所受傷害 18% 的傷害，並讓對方重傷 3 秒（受到的治療 -60%）。' },
  { id: 'beerus', name: '破壞神頭飾', cost: 1100, tier: 3, from: ['scroll', 'scroll'], proto: '滅世者的死亡之帽', desc: '氣功強度 +80', stats: { ap: 80 }, psv: { apAmp: 0.3 }, note: '被動・破壞：總氣功強度 +30%。' },
  { id: 'staff', name: '老界王神之杖', cost: 600, tier: 3, from: ['tear', 'tome'], proto: '大天使之杖', desc: '氣功強度 +50，魔力 +500，魔力回復 +50%', stats: { ap: 50, mp: 500, mpr: 0.5 }, psv: { tear: 8, mpAp: 0.02, lvMp: 0.2 }, note: '被動・積蓄：施放技能最大魔力永久 +8（最多 +360）。被動・敬畏：氣功強度 +2% 最大魔力。' },
  { id: 'holy', name: '超聖水', cost: 900, tier: 3, from: ['gloves', 'cape'], proto: '水銀彎刀', desc: '攻擊 +30，暴擊率 +15%，技能防禦 +14', stats: { ad: 30, crit: 0.15, mr: 14 }, act: { id: 'cleanse', cd: 75, dur: 1.2, name: '淨化' }, note: '主動・淨化（2／3 鍵）：解除暈眩、擊飛、冰凍與緩速，1.2 秒內移速 +40%，冷卻 75 秒。' },
];
export const TEAR_MAX = 360;
export const WARD = { cd: 70, range: 7, life: 90, hp: 3, max: 2 };
export const CONTROL = { range: 7, hp: 4, reveal: 9 };
// 《英雄聯盟》全裝備（tools/lol-items.mjs 產生）：整件總價換成遞增價（扣掉材料的總價，最低 50）
{
  const total = (id) => { const it = ITEMS.find((i) => i.id === id); return it.cost + (it.from || []).reduce((a, c) => a + total(c), 0); };
  for (const L of LOL_ITEMS) {
    const { gold, ...it } = L;
    it.cost = Math.max(50, gold - (it.from || []).reduce((a, c) => a + total(c), 0));
    if (!it.from.length) delete it.from;
    if (!it.psv) delete it.psv;
    ITEMS.push(it);
  }
}
// 召喚師技能（《英雄聯盟》，選角時挑一個，F 鍵；冷卻依本作節奏 ×0.4）
export const SUMMONERS = [
  { id: 'flash', name: '閃現', proto: '閃現', cd: 120, range: 4, desc: '朝游標瞬移 4 公尺。' },
  { id: 'ignite', name: '點燃', proto: '點燃', cd: 72, range: 6, dmg: 50, lv: 20, dur: 5, desc: '點燃 6 公尺內最近的敵方英雄：5 秒內共 50＋每級 20 真實傷害，並施加重傷（受到的治療 -40%）。' },
  { id: 'heal', name: '治療', proto: '治療', cd: 96, range: 8, heal: 80, lv: 15, desc: '自己與 8 公尺內血量最低的隊友回復 80＋每級 15，並在 1 秒內移速 +30%。' },
  { id: 'barrier', name: '光盾', proto: '光盾', cd: 72, shield: 100, lv: 20, dur: 2.5, desc: '得到 100＋每級 20 的護盾，持續 2.5 秒。' },
  { id: 'cleanse', name: '淨化', proto: '淨化', cd: 84, desc: '解除暈眩、冰凍與緩速（擊飛除外），3 秒內韌性 +65%。' },
  { id: 'exhaust', name: '虛弱', proto: '虛弱', cd: 84, range: 6, slow: 0.3, weak: 0.35, dur: 3, desc: '讓 6 公尺內最近的敵方英雄緩速 30%、造成的傷害 -35%，持續 3 秒。' },
  { id: 'ghost', name: '鬼步', proto: '鬼步', cd: 84, ms: 0.3, dur: 8, desc: '8 秒內移速 +30%。' },
  { id: 'teleport', name: '傳送', proto: '傳送', cd: 144, channel: 3, desc: '引導 3 秒（受傷會中斷），傳送到游標附近的我方防禦塔或小兵身邊。' },
  { id: 'smite', name: '重擊', proto: '重擊', cd: 36, range: 5, dmg: 450, lv: 25, desc: '對 5 公尺內最近的野怪或小兵造成 450＋每級 25 真實傷害（對英雄 80）。搶大猿用。' },
];
export const SUMM_REC = { tank: 'teleport', assassin: 'ignite', marksman: 'heal', mage: 'barrier', fighter: 'flash' };
// 英雄天生被動（《英雄聯盟》每名英雄都有一個）：psv 用 traits.js 的效果原語，併入 h.psv（key 前綴 hero_，不和裝備衝突）
export const PASSIVES = {
  goku: { name: '越戰越勇', desc: '與英雄交戰時，每秒傷害 +1.5%，最多 +7.5%。', psv: { ramp: { k: 'ramp', per: 0.015, max: 0.075 } } },
  vegeta: { name: '王子的自尊', desc: '血量低於 40% 時傷害 +12%、攻速 +15%。', psv: { pride: { k: 'selfLowHp', below: 0.4, dmg: 0.12, as: 0.15 } } },
  trunks: { name: '未來劍技', desc: '每第三下普攻追加 20＋每級 4 的真實傷害。', psv: { sword: { k: 'everyN', n: 3, flat: 20, lvDmg: 4, trueDmg: true } } },
  piccolo: { name: '那美克星人的再生', desc: '5 秒沒受傷後，每秒回復 1.5% 最大血量。', psv: { regen: { k: 'warmog', pct: 0.015, need: 0, after: 5 } } },
  frieza: { name: '宇宙帝王', desc: '技能命中英雄時追加目標最大血量 2% 的技能傷害（同一目標 1 秒一次）。', psv: { emperor: { k: 'skillPctMax', pct: 0.02, cd: 1 } } },
  a18: { name: '無限能量', desc: '技能的魔力消耗 -25%。', psv: { energy: { k: 'costCut', pct: 0.25 } } },
  naruto: { name: '九尾查克拉', desc: '受傷後血量低於 30% 時，5 秒內回復 20% 最大血量（60 秒一次）。', psv: { kurama: { k: 'lifeline', at: 0.3, base: 0, regen: 0.2, dur: 5, cd: 60 } } },
  sasuke: { name: '寫輪眼', desc: '對被暈眩、冰凍或緩速的英雄傷害 +12%。', psv: { sharingan: { k: 'vsCc', pct: 0.12 } } },
  kakashi: { name: '複製忍者', desc: '10 公尺內的敵方英雄施放技能後，自己的下一次技能傷害 +15%（6 秒內）。', psv: { copy: { k: 'copy', pct: 0.15, r: 10, dur: 6 } } },
  sakura: { name: '百豪之印', desc: '受傷後血量低於 35% 時，5 秒內回復 25% 最大血量（90 秒一次）。', psv: { byakugo: { k: 'lifeline', at: 0.35, base: 0, regen: 0.25, dur: 5, cd: 90 } } },
  luffy: { name: '橡膠', desc: '承受的普攻傷害 -15%（打擊對橡膠沒什麼用）。', psv: { rubber: { k: 'autoReduce', pct: 0.15 } } },
  zoro: { name: '三刀流', desc: '普攻對目標周圍 2.5 公尺的敵人造成 35% 傷害。', psv: { santoryu: { k: 'cleave', pct: 0.35, r: 2.5 } } },
  sanji: { name: '連環踢', desc: '普攻疊攻速 +5%（最多 4 層，4 秒）。', psv: { kicks: { k: 'guinsoo', as: 0.05, max: 4, dur: 4 } } },
  nami: { name: '氣象科學', desc: '每第三下普攻落雷，追加 30＋30% 氣功強度的技能傷害。', psv: { weather: { k: 'everyN', n: 3, flat: 30, apK: 0.3, magic: true } } },
};
export const INV_SLOTS = 6;
export const ELIXIR_DUR = 90;

// 野怪數值
export const MONSTER = {
  dino: { hp: 720, dmg: 32, range: 2.2, cd: 1.3, speed: 5, radius: 0.9, xp: 70, gold: 45, ranged: false },
  robot: { hp: 640, dmg: 30, range: 6, cd: 1.5, speed: 4.5, radius: 0.8, xp: 72, gold: 48, ranged: true },
  ape: { hp: 5400, dmg: 120, range: 4, cd: 2.4, speed: 4.2, radius: 2.4, xp: 230, gold: 260, ranged: false, aoe: 4 },
};
export const CAMP_FIRST = 60, CAMP_RESPAWN = 70, BOSS_FIRST = 150, BOSS_RESPAWN = 180, LEASH = 13;
export const APE_BUFF = { dur: 90, dmg: 0.2 };

export const SPARK = { dur: 8, cd: 90, dmg: 1.2, ms: 1.25, heal: 0.18 };
export const RECALL_TIME = 4;
export const COMBO_WINDOW = 1.6;
export const HITSTOP = { L: 0.045, M: 0.06, H: 0.085, skill: 0.1, super: 0.22 };

// 龍珠獵人：全隊每補 perCs 隻兵得 1 顆、打倒大猿得 apeBalls 顆；先集滿 7 顆的隊伍召喚神龍到神龍坑，打倒神龍的隊伍許願
export const DRAGON = {
  perCs: 30, apeBalls: 2, max: 7, pit: { x: -34, z: -34 }, summonDelay: 6,
  omen: { dur: 15, dmg: 0.15 },
  wish: { dur: 90, dmg: 0.25, ms: 0.15 },
  shenron: { hp: 8200, dmg: 150, range: 13, cd: 2.4, radius: 3, armor: 0.25, xp: 320, gold: 180, bolt: 3.4, telegraph: 0.7 },
  // 屬性龍珠（原作的元素小龍）：打倒神龍的隊伍得到該屬性的永久祝福；3 層得到龍魂；之後出現究極神龍（遠古龍）
  soulAt: 3, elderDur: 60, elderBurn: 45, elderExec: 0.2,
  elements: {
    fire: { name: '烈火', proto: '地獄', color: '#ff6a3a', per: '傷害 +4%', soul: '烈火之魂：普攻與技能命中英雄時爆炸，追加 40＋每級 6 的技能傷害（3 秒一次）' },
    earth: { name: '岩山', proto: '山脈', color: '#c9a26a', per: '物理與技能防禦 +6%', soul: '岩山之魂：5 秒沒受傷就得到 60＋每級 14 的護盾' },
    ocean: { name: '大海', proto: '海洋', color: '#4fb8ff', per: '每秒回復 0.5% 已損血量', soul: '大海之魂：造成傷害回復 10% 的血量（全能吸血）' },
    cloud: { name: '風雲', proto: '雲霧', color: '#e8f4ff', per: '移速 +3%', soul: '風雲之魂：施放大絕後 6 秒內移速 +50%' },
    hextech: { name: '機巧', proto: '海克斯', color: '#7fe8ff', per: '技能加速 +5、攻速 +5%', soul: '機巧之魂：傷害英雄時放出電鏈，追加 30＋每級 5 技能傷害並緩速 30%（3 秒一次）' },
    chem: { name: '毒霧', proto: '化學科技', color: '#9fd84a', per: '韌性 +6%、治療與護盾強度 +6%', soul: '毒霧之魂：血量低於一半時傷害 +10%、承受傷害 -10%' },
  },
};
