// 常數、色票、英雄與技能數值。數值調整集中在這裡。
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
export const respawnTime = (lv) => 5 + lv * 1.4;

// 小兵與建築
export const WAVE_EVERY = 25;
export const FIRST_WAVE = 4;
export const MINION = {
  melee: { hp: 380, dmg: 16, range: 1.7, cd: 1.1, speed: 4.6, radius: 0.55, xp: 34, sight: 8 },
  ranged: { hp: 260, dmg: 24, range: 6.2, cd: 1.4, speed: 4.6, radius: 0.5, xp: 28, sight: 8.5 },
  siege: { hp: 950, dmg: 42, range: 6.8, cd: 1.8, speed: 4.3, radius: 0.85, xp: 70, sight: 9, structMul: 2.1 },
};
export const SIEGE_FROM_WAVE = 13;     // 第幾波起每波帶一台攻城兵
export const MINION_GROWTH = 0.06;   // 每分鐘血量與傷害成長
export const TOWER = { hp: [2500, 3000], core: 4400, range: 9, dmg: 150, dmgMinion: 95, cd: 1.0, ramp: 0.35, radius: 1.6 };
export const XP_SHARE_RADIUS = 15;

// 野怪：每隊半邊兩營（恐龍、紅緞帶機器人），河道一隻大猿（王）
export const CAMPS = [
  { id: 'dinoA', kind: 'dino', x: -48, z: -18, n: 2 },
  { id: 'robotA', kind: 'robot', x: 18, z: 48, n: 2 },
  { id: 'dinoB', kind: 'dino', x: 48, z: 18, n: 2 },
  { id: 'robotB', kind: 'robot', x: -18, z: -48, n: 2 },
  { id: 'ape', kind: 'ape', x: 34, z: 34, n: 1, boss: true },
];

// 英雄（七龍珠 FighterZ 同人致敬；招式名取自原作）。火影忍者、海賊王的客串角色在下方另外加入
// stats: hp/hpLv 血量與每級成長、ad/adLv 攻擊、range 普攻距離、as 普攻間隔（秒）、ms 移速、armor 減傷（0..1）
// ssj：爆氣時變身超級賽亞人
export const HEROES = {
  goku: {
    name: '孫悟空', short: '悟空', en: 'GOKU', role: '近戰鬥士', color: '#4fc3ff', glow: '#e6f8ff', melee: true, ssj: true,
    blurb: '愛打架的賽亞人。連段長、續戰力強，爆氣時變身超級賽亞人。',
    stats: { hp: 650, hpLv: 90, ad: 58, adLv: 4.3, range: 2.4, as: 0.76, ms: 7.3, armor: 0.12 },
    skills: {
      Q: { name: '龜派氣功', desc: '雙掌推出氣功彈，命中後小範圍爆炸。', cd: 5, range: 14, dmg: [70, 110, 150, 190, 230], adR: 0.6, radius: 2.6, speed: 34 },
      W: { name: '龍閃拳', desc: '向前衝刺，撞到敵人時打出四段連打並把對手打飛。', cd: 9, range: 8, dmg: [24, 34, 44, 54, 64], hits: 4, adR: 0.25 },
      E: { name: '瞬間移動', desc: '花 1 格氣瞬移；游標附近有敵人時繞到它背後，下一次普攻硬直。', cd: 10, range: 8, ki: 1 },
      R: { name: '超級龜派氣功', desc: '花 3 格氣，放出巨大的龜派氣功光束，持續 1.2 秒。', cd: 45, range: 22, dmg: [60, 90, 120], ticks: 6, adR: 0.35, width: 2.4, ki: 3 },
    },
  },
  vegeta: {
    name: '貝吉塔', short: '貝吉塔', en: 'VEGETA', role: '刺客', color: '#ffd84a', glow: '#fff6c8', melee: true, ssj: true,
    blurb: '賽亞人的王子。瞬移切入、連續能量彈壓制，終極閃光一擊定勝負。',
    stats: { hp: 580, hpLv: 80, ad: 62, adLv: 4.6, range: 2.3, as: 0.7, ms: 7.5, armor: 0.1 },
    skills: {
      Q: { name: '連續能量彈', desc: '射出能量彈，命中後連鎖到附近兩個敵人。', cd: 5, range: 13, dmg: [65, 100, 135, 170, 205], adR: 0.55, speed: 46, chain: 2 },
      W: { name: '超級衝刺踢', desc: '衝刺後接五段快踢。', cd: 8, range: 7.5, dmg: [17, 24, 31, 38, 45], hits: 5, adR: 0.2 },
      E: { name: '殘像閃', desc: '花 1 格氣，閃到目標背後並重置普攻鏈。', cd: 8, range: 9, ki: 1 },
      R: { name: '終極閃光', desc: '花 3 格氣，蓄力後放出極寬的金色光束。', cd: 50, range: 18, dmg: [70, 105, 140], ticks: 6, adR: 0.4, width: 3.8, windup: 0.55, ki: 3 },
    },
  },
  trunks: {
    name: '特南克斯', short: '特南克斯', en: 'TRUNKS', role: '劍士', color: '#ffb03a', glow: '#fff0d0', melee: true, ssj: true,
    blurb: '來自未來的劍士。劍閃穿過整排敵人，熱圓頂攻擊把對手打上天再炸開。',
    stats: { hp: 610, hpLv: 84, ad: 60, adLv: 4.4, range: 2.8, as: 0.74, ms: 7.4, armor: 0.1 },
    skills: {
      Q: { name: '魔閃光', desc: '雙手射出貫穿的氣功波，把敵人往後推。', cd: 6, range: 13, dmg: [60, 100, 140, 180, 220], adR: 0.55, width: 1.7, speed: 36 },
      W: { name: '閃光斬', desc: '揮劍穿過路徑上所有敵人，終點補一發氣功彈。', cd: 9, range: 8.5, dmg: [55, 85, 115, 145, 175], adR: 0.45 },
      E: { name: '旋風跳', desc: '花 1 格氣翻身躍到游標處，下一次普攻硬直。', cd: 9, range: 7.5, ki: 1 },
      R: { name: '熱圓頂攻擊', desc: '花 3 格氣，閃到敵人身邊一劍挑上天，再放出圓頂狀的大爆炸。', cd: 48, range: 10, dmg: [240, 350, 460], adR: 0.7, radius: 6, ki: 3 },
    },
  },
  piccolo: {
    name: '比克', short: '比克', en: 'PICCOLO', role: '坦克', color: '#b6ff5c', glow: '#efffd2', melee: true,
    blurb: '那美克星人。伸長手臂把敵人拉過來，再生護身，魔貫光殺砲貫穿一整排。',
    stats: { hp: 760, hpLv: 105, ad: 52, adLv: 3.7, range: 2.6, as: 0.9, ms: 6.9, armor: 0.22 },
    skills: {
      Q: { name: '魔空包圍彈', desc: '在游標處布下一圈氣彈，0.6 秒後收攏爆炸並擊飛。', cd: 8, range: 12, dmg: [70, 110, 150, 190, 230], adR: 0.5, radius: 3.4 },
      W: { name: '伸臂抓取', desc: '伸長手臂，把第一個碰到的敵人拉到身邊並暈眩。', cd: 12, range: 10, dmg: [50, 75, 100, 125, 150], adR: 0.4 },
      E: { name: '再生', desc: '花 1 格氣短距瞬移，再生回血並獲得護盾。', cd: 12, range: 5, ki: 1, shield: [90, 130, 170, 210, 250] },
      R: { name: '魔貫光殺砲', desc: '花 3 格氣，指尖蓄力後射出貫穿一整排的螺旋光束。', cd: 50, range: 26, dmg: [300, 430, 560], adR: 0.9, width: 1.6, windup: 0.7, ki: 3 },
    },
  },
  frieza: {
    name: '弗利沙', short: '弗利沙', en: 'FRIEZA', role: '遠程術士', color: '#ff4fb4', glow: '#ffe0f2', melee: false,
    blurb: '宇宙的帝王。死亡光束點殺、飛盤來回切割，死亡球覆蓋一大片。',
    stats: { hp: 520, hpLv: 72, ad: 52, adLv: 3.6, range: 7.2, as: 0.85, ms: 7.0, armor: 0.06 },
    skills: {
      Q: { name: '死亡光束', desc: '指尖射出極快的光束，命中的敵人減速 35%。', cd: 5.5, range: 16, dmg: [80, 120, 160, 200, 240], adR: 0.6, speed: 62, slow: 0.35 },
      W: { name: '死亡飛盤', desc: '擲出飛盤，飛出去再飛回來，來回都會切到敵人。', cd: 9, range: 12, dmg: [55, 85, 115, 145, 175], adR: 0.45, speed: 22 },
      E: { name: '瞬移擊', desc: '花 1 格氣瞬移，下一次普攻硬直。', cd: 10, range: 8.5, ki: 1 },
      R: { name: '死亡球', desc: '花 3 格氣，舉起巨大的能量球砸向游標處，大範圍傷害並暈眩。', cd: 55, range: 15, dmg: [280, 400, 520], adR: 0.8, radius: 6.5, ki: 3 },
    },
  },
  a18: {
    name: '人造人18號', short: '18號', en: 'ANDROID 18', role: '遠程射手', color: '#c7f0ff', glow: '#ffffff', melee: false,
    blurb: '能量無限的人造人。氣圓斬貫穿、能量屏障彈開近身者，能量波一陣掃射。',
    stats: { hp: 540, hpLv: 76, ad: 56, adLv: 4.2, range: 7.6, as: 0.72, ms: 7.1, armor: 0.07 },
    skills: {
      Q: { name: '氣圓斬', desc: '擲出貫穿的氣圓斬，切過路徑上所有敵人。', cd: 6, range: 15, dmg: [70, 110, 150, 190, 230], adR: 0.55, width: 1.4, speed: 30 },
      W: { name: '背後擒抱', desc: '衝刺，抓住第一個碰到的敵人往身後摔出並暈眩。', cd: 10, range: 8, dmg: [60, 90, 120, 150, 180], adR: 0.45 },
      E: { name: '能量屏障', desc: '花 1 格氣張開屏障，獲得護盾並彈開身邊的敵人。', cd: 11, range: 0, ki: 1, shield: [80, 120, 160, 200, 240] },
      R: { name: '能量波', desc: '花 3 格氣，朝游標方向掃射 14 發能量彈。', cd: 45, range: 14, dmg: [26, 38, 50], adR: 0.16, shots: 14, ki: 3 },
    },
  },
};
// 火影忍者、海賊王的客串角色（同人致敬；招式名取自原作，模型與特效全部以程式繪製）
Object.assign(HEROES, {
  naruto: {
    name: '漩渦鳴人', short: '鳴人', en: 'NARUTO', role: '近戰鬥士', color: '#ff8a1f', glow: '#fff0d8', melee: true, franchise: 'naruto',
    blurb: '意外性 No.1 的忍者。影分身圍毆、螺旋丸撞飛，風遁螺旋手裏劍炸開一大片。',
    stats: { hp: 640, hpLv: 90, ad: 57, adLv: 4.2, range: 2.4, as: 0.75, ms: 7.4, armor: 0.11 },
    skills: {
      Q: { name: '螺旋丸', desc: '向前衝刺，撞到敵人時把螺旋丸按上去，爆炸並擊飛。', cd: 7, range: 8, dmg: [80, 120, 160, 200, 240], adR: 0.6, radius: 2.4 },
      W: { name: '影分身之術', desc: '在游標處變出三個影分身圍毆，連打四下。', cd: 10, range: 9, dmg: [22, 32, 42, 52, 62], hits: 4, adR: 0.22, radius: 3.2 },
      E: { name: '替身術', desc: '花 1 格氣留下一截木頭替身，瞬移到游標處，下一次普攻硬直。', cd: 10, range: 8, ki: 1 },
      R: { name: '風遁・螺旋手裏劍', desc: '花 3 格氣擲出巨大的螺旋手裏劍，到點炸開成風刃球，持續切割 1.2 秒。', cd: 48, range: 16, dmg: [60, 90, 120], ticks: 6, adR: 0.3, radius: 5, ki: 3 },
    },
  },
  sasuke: {
    name: '宇智波佐助', short: '佐助', en: 'SASUKE', role: '刺客', color: '#8f7bff', glow: '#eef0ff', melee: true, franchise: 'naruto',
    blurb: '宇智波一族的天才。豪火球燒開、千鳥貫穿麻痺，麒麟從天而降。',
    stats: { hp: 580, hpLv: 80, ad: 62, adLv: 4.6, range: 2.5, as: 0.72, ms: 7.5, armor: 0.1 },
    skills: {
      Q: { name: '豪火球之術', desc: '吐出巨大的火球，命中後炸開。', cd: 6, range: 13, dmg: [75, 115, 155, 195, 235], adR: 0.6, radius: 3, speed: 26 },
      W: { name: '千鳥', desc: '帶著雷光衝刺，撞到敵人時貫穿並麻痺 0.8 秒。', cd: 9, range: 8, dmg: [70, 105, 140, 175, 210], adR: 0.55 },
      E: { name: '寫輪眼・瞬身', desc: '花 1 格氣閃到游標附近敵人的背後，重置普攻鏈。', cd: 9, range: 9, ki: 1 },
      R: { name: '麒麟', desc: '花 3 格氣，引落天雷化成的麒麟，砸向游標處。', cd: 50, range: 15, dmg: [300, 430, 560], adR: 0.85, radius: 5.5, ki: 3 },
    },
  },
  kakashi: {
    name: '旗木卡卡西', short: '卡卡西', en: 'KAKASHI', role: '遠程術士', color: '#7aa8ff', glow: '#eef5ff', melee: false, franchise: 'naruto',
    blurb: '拷貝忍者。水龍彈推開、追牙之術絆住，雷切切入，神威把人吸進異空間。',
    stats: { hp: 560, hpLv: 78, ad: 55, adLv: 4.0, range: 6.6, as: 0.8, ms: 7.2, armor: 0.08 },
    skills: {
      Q: { name: '水遁・水龍彈', desc: '噴出水龍，貫穿路徑上的敵人並往後推。', cd: 6, range: 13, dmg: [65, 100, 135, 170, 205], adR: 0.55, width: 2.0, speed: 30 },
      W: { name: '土遁・追牙之術', desc: '忍犬從地底竄出，一整排敵人被咬住定身 1 秒。', cd: 11, range: 12, dmg: [50, 75, 100, 125, 150], adR: 0.4, width: 2.2 },
      E: { name: '雷切', desc: '花 1 格氣，帶著雷光突刺，撞到第一個敵人時造成傷害並麻痺。', cd: 10, range: 8, dmg: [60, 90, 120, 150, 180], adR: 0.6, ki: 1 },
      R: { name: '神威', desc: '花 3 格氣，在游標處扭曲空間，把範圍內的敵人往中心吸 1.2 秒並持續造成傷害。', cd: 50, range: 14, dmg: [50, 75, 100], ticks: 6, adR: 0.3, radius: 5, ki: 3 },
    },
  },
  sakura: {
    name: '春野櫻', short: '小櫻', en: 'SAKURA', role: '坦克', color: '#ff6fae', glow: '#ffe8f2', melee: true, franchise: 'naruto',
    blurb: '綱手的弟子。怪力一拳打碎地面，醫療忍術替隊友回血，天之拳從天砸落。',
    stats: { hp: 740, hpLv: 102, ad: 54, adLv: 3.8, range: 2.4, as: 0.86, ms: 7.0, armor: 0.2 },
    skills: {
      Q: { name: '櫻花衝', desc: '對游標處揮出怪力一拳，打碎地面，範圍內敵人被擊飛。', cd: 8, range: 6, dmg: [70, 110, 150, 190, 230], adR: 0.55, radius: 3.2 },
      W: { name: '怪力衝拳', desc: '衝刺，撞到敵人時重拳把它打飛並暈眩。', cd: 10, range: 7.5, dmg: [60, 90, 120, 150, 180], adR: 0.5 },
      E: { name: '醫療忍術', desc: '花 1 格氣，替自己與附近的隊友回血並給護盾。', cd: 12, range: 0, ki: 1, shield: [80, 120, 160, 200, 240] },
      R: { name: '百豪之術・天之拳', desc: '花 3 格氣跳向游標處，從空中砸下，大範圍傷害並暈眩。', cd: 48, range: 12, dmg: [260, 380, 500], adR: 0.75, radius: 6, ki: 3 },
    },
  },
  luffy: {
    name: '蒙其・D・魯夫', short: '魯夫', en: 'LUFFY', role: '近戰鬥士', color: '#ff3b4b', glow: '#ffe6e8', melee: true, franchise: 'op',
    blurb: '橡膠果實能力者。手臂伸長打人、橡膠火箭飛撲，二檔加速，巨人手槍一拳轟飛。',
    stats: { hp: 660, hpLv: 92, ad: 58, adLv: 4.3, range: 2.6, as: 0.74, ms: 7.4, armor: 0.12 },
    skills: {
      Q: { name: '橡膠槍', desc: '手臂伸長打出直拳，打中第一個敵人並擊退。', cd: 5, range: 11, dmg: [70, 110, 150, 190, 230], adR: 0.6 },
      W: { name: '橡膠火箭', desc: '把自己彈射到游標處，落地撞開周圍的敵人。', cd: 10, range: 10, dmg: [55, 85, 115, 145, 175], adR: 0.45, radius: 3 },
      E: { name: '二檔', desc: '花 1 格氣進入二檔：6 秒內移速 +25%、攻速 +35%，身上冒出蒸氣。', cd: 14, range: 0, ki: 1, dur: 6, ms: 0.25, as: 0.35 },
      R: { name: '橡膠巨人手槍', desc: '花 3 格氣把拳頭吹成巨人大小轟出，貫穿一整排敵人並擊飛。', cd: 46, range: 16, dmg: [280, 400, 520], adR: 0.8, width: 3.6, ki: 3 },
    },
  },
  zoro: {
    name: '羅羅亞・索隆', short: '索隆', en: 'ZORO', role: '劍士', color: '#3fd07a', glow: '#e8fff0', melee: true, franchise: 'op',
    blurb: '三刀流劍豪。鬼斬穿過一排敵人，三十六煩惱鳳飛斬，三千世界旋身一刀斬盡。',
    stats: { hp: 620, hpLv: 86, ad: 61, adLv: 4.5, range: 2.8, as: 0.74, ms: 7.3, armor: 0.11 },
    skills: {
      Q: { name: '三十六煩惱鳳', desc: '揮出飛行的斬擊，貫穿路徑上的敵人。', cd: 6, range: 13, dmg: [65, 105, 145, 185, 225], adR: 0.6, width: 1.6, speed: 34 },
      W: { name: '鬼斬', desc: '三刀交叉衝過去，斬中路徑上所有敵人。', cd: 9, range: 8, dmg: [60, 90, 120, 150, 180], adR: 0.5 },
      E: { name: '獅子歌歌', desc: '花 1 格氣，一瞬間閃到游標處，途中的敵人全部被斬。', cd: 10, range: 8, dmg: [40, 60, 80, 100, 120], adR: 0.4, ki: 1 },
      R: { name: '三千世界', desc: '花 3 格氣旋轉三刀衝到敵人身邊，周圍一圈大範圍斬擊。', cd: 48, range: 10, dmg: [250, 360, 470], adR: 0.75, radius: 5.5, ki: 3 },
    },
  },
  sanji: {
    name: '賓什莫克・香吉士', short: '香吉士', en: 'SANJI', role: '刺客', color: '#ff6a3d', glow: '#fff0e0', melee: true, franchise: 'op',
    blurb: '只用腳戰鬥的廚師。連環踢壓制、空中步行切入，惡魔風腳燃燒一整套連踢。',
    stats: { hp: 590, hpLv: 82, ad: 61, adLv: 4.5, range: 2.6, as: 0.7, ms: 7.6, armor: 0.1 },
    skills: {
      Q: { name: '首肉射擊', desc: '前踏一記重踢，把前方敵人踢飛。', cd: 5, range: 6, dmg: [70, 110, 150, 190, 230], adR: 0.6 },
      W: { name: '羊肉射擊', desc: '原地倒立旋轉連踢三下，打中周圍所有敵人。', cd: 9, range: 0, dmg: [30, 45, 60, 75, 90], hits: 3, adR: 0.25, radius: 3.2 },
      E: { name: '空中步行', desc: '花 1 格氣踏著空氣跳到游標處，下一次普攻硬直。', cd: 9, range: 8.5, ki: 1 },
      R: { name: '惡魔風腳・畫龍點睛', desc: '花 3 格氣，燃燒的腳衝向前方，撞到敵人時連踢六下再一腳炸飛。', cd: 46, range: 9, dmg: [36, 52, 68], hits: 6, adR: 0.18, ki: 3 },
    },
  },
  nami: {
    name: '娜美', short: '娜美', en: 'NAMI', role: '遠程術士', color: '#ffa23c', glow: '#fff3e0', melee: false, franchise: 'op',
    blurb: '天才航海士。天候棒招來落雷、冷氣泡讓敵人變慢，雷雲在戰場上空連續劈落。',
    stats: { hp: 520, hpLv: 72, ad: 52, adLv: 3.7, range: 7.2, as: 0.82, ms: 7.1, armor: 0.06 },
    skills: {
      Q: { name: '雷霆節拍', desc: '在游標處劈下一道落雷，0.4 秒後命中並短暫麻痺。', cd: 6, range: 13, dmg: [75, 115, 155, 195, 235], adR: 0.6, radius: 2.4 },
      W: { name: '冷氣泡', desc: '在游標處布下冷氣霧，3 秒內敵人移速 -40%。', cd: 11, range: 12, dmg: [30, 45, 60, 75, 90], adR: 0.3, radius: 3.6, slow: 0.4 },
      E: { name: '旋風節拍', desc: '花 1 格氣颳起旋風，把身邊的敵人吹開並短暫暈眩。', cd: 11, range: 0, ki: 1, dmg: [40, 60, 80, 100, 120], adR: 0.3 },
      R: { name: '雷雲・宙之雷', desc: '花 3 格氣在游標處召來雷雲，3 秒內連續落雷。', cd: 52, range: 14, dmg: [55, 80, 105], ticks: 8, adR: 0.25, radius: 6, ki: 3 },
    },
  },
});
for (const id of ['goku', 'vegeta', 'trunks', 'piccolo', 'frieza', 'a18']) HEROES[id].franchise = 'db';
export const FRANCHISES = [['db', '七龍珠'], ['naruto', '火影忍者'], ['op', '海賊王']];
export const HERO_ORDER = ['goku', 'vegeta', 'trunks', 'piccolo', 'frieza', 'a18', 'naruto', 'sasuke', 'kakashi', 'sakura', 'luffy', 'zoro', 'sanji', 'nami'];

// 金幣與商店
export const GOLD = { start: 500, passive: 2.2, melee: 21, ranged: 16, siege: 55, hero: 300, assist: 120, tower: 120, shopRadius: 14 };
// stats：ad 攻擊、hp 血量、armor 減傷、as 攻速（間隔縮短比例）、ms 移速比例、ki 氣力獲得、cdr 冷卻縮減、skill 技能傷害、dmg 全傷害、vision 視野、regen 脫戰回血（每秒比例）、detect 看得到敵方的眼
// 合成：from 列出需要的下位道具，cost 是合成費（不含下位道具）；總價 = cost + 下位道具總價
export const ITEMS = [
  { id: 'senzu', name: '仙豆', cost: 120, tier: 0, desc: '吃下立刻回復 45% 血量與 1 格氣。最多帶 3 顆。', consumable: true, max: 3, field: 'senzu' },
  { id: 'control', name: '真眼', cost: 75, tier: 0, desc: '按 5 放下：敵我都看得到，會照出 9 公尺內的敵方眼（可拆），本身要打 4 下。每人場上限 1 顆，最多帶 2 顆。', consumable: true, max: 2, field: 'controls' },
  // 基礎
  { id: 'weights', name: '負重護腕', cost: 350, tier: 1, desc: '攻擊 +12', stats: { ad: 12 } },
  { id: 'gi', name: '修行道服', cost: 350, tier: 1, desc: '血量 +180', stats: { hp: 180 } },
  { id: 'kiband', name: '氣功護腕', cost: 300, tier: 1, desc: '氣力獲得 +15%', stats: { ki: 0.15 } },
  { id: 'boots', name: '武道鞋', cost: 300, tier: 1, desc: '移速 +8%', stats: { ms: 0.08 } },
  { id: 'scouter', name: '戰鬥力探測器', cost: 450, tier: 1, desc: '攻速 +12%，視野 +3，看得到附近的敵方眼', stats: { as: 0.12, vision: 3, detect: 1 } },
  // 進階
  { id: 'kaioken', name: '界王拳腰帶', cost: 500, tier: 2, from: ['weights', 'weights'], desc: '攻擊 +36，技能傷害 +12%', stats: { ad: 36, skill: 0.12 } },
  { id: 'armor', name: '賽亞人戰甲', cost: 450, tier: 2, from: ['gi', 'weights'], desc: '血量 +350，攻擊 +14，減傷 +6%', stats: { hp: 350, ad: 14, armor: 0.06 } },
  { id: 'nimbus', name: '筋斗雲', cost: 400, tier: 2, from: ['boots', 'kiband'], desc: '移速 +16%，氣力獲得 +20%', stats: { ms: 0.16, ki: 0.2 } },
  { id: 'kiamp', name: '氣力增幅器', cost: 500, tier: 2, from: ['kiband', 'scouter'], desc: '氣力獲得 +30%，冷卻 -15%，攻速 +14%，視野 +3，看得到敵方眼', stats: { ki: 0.3, cdr: 0.15, as: 0.14, vision: 3, detect: 1 } },
  { id: 'cell', name: '再生細胞', cost: 450, tier: 2, from: ['gi', 'gi'], desc: '血量 +460，脫戰每秒回 1.5% 血', stats: { hp: 460, regen: 0.015 } },
  // 終極
  { id: 'water', name: '超神水', cost: 600, tier: 3, from: ['kaioken', 'cell'], desc: '全部傷害 +18%，攻擊 +40，血量 +520，技能傷害 +12%', stats: { dmg: 0.18, ad: 40, hp: 520, skill: 0.12, regen: 0.01 } },
  { id: 'potara', name: '波塔拉耳環', cost: 650, tier: 3, from: ['armor', 'kiamp'], desc: '血量 +420，攻擊 +24，冷卻 -20%，減傷 +8%，氣力獲得 +30%', stats: { hp: 420, ad: 24, cdr: 0.2, armor: 0.08, ki: 0.3, detect: 1, vision: 3 } },
];
export const WARD = { cd: 70, range: 7, life: 90, hp: 3, max: 2 };
export const CONTROL = { range: 7, hp: 4, reveal: 9 };
export const INV_SLOTS = 6;

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
};
