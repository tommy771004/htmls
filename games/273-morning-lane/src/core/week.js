// 一週七天：每天一條不同的街（種子、長度）、訂戶比例與障礙數量逐日加碼；週五、六是黃昏的晚報，週日是天還沒亮的早報。
// vip：金色信箱戶數；bundles：報紙補給包；ramps：跳台；missions：當天三個任務（missions.js 的 'id:門檻'）。
export const TIMES = { morning: '清晨', dusk: '黃昏', night: '凌晨' };

export const DAYS = [
  { name: '週一', note: '第一天，楓樹巷。熟悉一下：白色信箱、紅旗立起的才是訂戶；路上的報紙包騎過去就能補 5 份。', street: '楓樹巷', time: 'morning', seed: 1, length: 248, subRatio: 0.6, bins: 0.2, dogs: 0, cars: 0, sprinklers: 2, vip: 0, bundles: 1, ramps: 0, missions: ['mailbox:6', 'bundles:1', 'noWindow'] },
  { name: '週二', note: '橡樹街有一隻沒綁繩的狗，會從沒訂報的院子衝出來追人——看到牠就按住加速。對向車道開始有車，還有第一戶金色信箱（分數 ×3）和第一座跳台。', street: '橡樹街', time: 'morning', seed: 2, length: 280, subRatio: 0.6, bins: 0.25, dogs: 1, cars: 1, sprinklers: 2, vip: 1, bundles: 1, ramps: 1, missions: ['vip', 'escape', 'streak:4'] },
  { name: '週三', note: '栗子巷比較長，灑水器多了一個；水柱掃到會濕身減速。', street: '栗子巷', time: 'morning', seed: 3, length: 312, subRatio: 0.62, bins: 0.3, dogs: 1, cars: 2, sprinklers: 3, vip: 1, bundles: 2, ramps: 1, missions: ['jumps:1', 'dry', 'mailbox:8'] },
  { name: '週四', note: '榆樹街是收垃圾日，路邊的垃圾桶特別多，還有兩隻狗。', street: '榆樹街', time: 'morning', seed: 4, length: 344, subRatio: 0.62, bins: 0.35, dogs: 2, cars: 3, sprinklers: 4, vip: 1, bundles: 2, ramps: 2, missions: ['noBump', 'bundles:2', 'streak:5'] },
  { name: '週五', note: '週五送晚報：太陽很低、影子很長，車也多了。', street: '白樺巷', time: 'dusk', seed: 5, length: 344, subRatio: 0.65, bins: 0.35, dogs: 2, cars: 4, sprinklers: 3, vip: 1, bundles: 2, ramps: 2, missions: ['vip', 'jumps:2', 'escape'] },
  { name: '週六', note: '柳樹街是一週最長的路線，三隻狗、四台車。', street: '柳樹街', time: 'dusk', seed: 6, length: 376, subRatio: 0.65, bins: 0.4, dogs: 3, cars: 4, sprinklers: 4, vip: 1, bundles: 3, ramps: 3, missions: ['mailbox:12', 'spare:5', 'dry'] },
  { name: '週日', note: '週日的早報要在天亮前送完：只有路燈和你的車燈。', street: '松果巷', time: 'night', seed: 7, length: 376, subRatio: 0.68, bins: 0.45, dogs: 3, cars: 5, sprinklers: 2, vip: 1, bundles: 2, ramps: 2, missions: ['perfect', 'noBump', 'vip'] },
];

/** 第 k 天（0–6）的設定；subsDelta 是前幾天累積的訂戶增減，每多（少）一戶，訂戶比例 ±2.5% */
export function dayConfig(k, subsDelta = 0) {
  const d = DAYS[Math.max(0, Math.min(6, k))];
  return { ...d, index: DAYS.indexOf(d), subRatio: Math.max(0.35, Math.min(0.85, d.subRatio + subsDelta * 0.025)) };
}
