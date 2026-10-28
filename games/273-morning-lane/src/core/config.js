// 所有手感與尺度參數集中在這裡。數值都是第一輪的猜測，調整前要先跟使用者說明觀察到的現象。
// 單位：公尺、秒、弧度。座標：騎士往 −Z 前進（北），+X 是騎士右手邊。

// 街道橫斷面（x 是到路中心線的距離）
export const STREET = {
  roadHalf: 3.6,      // 雙向兩線道，路面總寬 7.2 m
  curb: 0.15,         // 路緣石高度
  stripOut: 5.0,      // 路緣到 5.0 m 是植栽帶（行道樹、信箱）
  walkOut: 6.8,       // 人行道 5.0–6.8 m
  fence: 7.0,         // 白色柵欄
  houseFront: 12.0,   // 前院 5 m 後是房子正面（ART.md）
  lotDepth: 24,       // 地塊縱深（到 x = 31）
  lotWidth: 16,       // 每塊地沿街 16 m
  mailboxX: 4.3,      // 信箱在植栽帶、靠路緣
  length: 248,        // 灰盒這一條街的長度（z 從 0 到 −length）
};

export const BIKE = {
  cruise: 5.5,        // 不按加速時的巡航速度（m/s，約 20 km/h）
  max: 10.5,          // 按住加速的最高速度（約 38 km/h）
  accel: 3.2,         // 加速度
  coast: 2.0,         // 放開加速後回到巡航速度的減速度
  yawRate: 1.9,       // 最大轉向角速度（低速時）
  yawRateHi: 1.25,    // 最高速時的轉向角速度
  yawMax: 0.95,       // 車頭與街道方向的最大夾角（約 54°）
  yawReturn: 2.6,     // 放開轉向時車頭回正的速率
  lean: 0.38,         // 視覺用的最大傾角
  radius: 0.45,       // 碰撞半徑
  xLimit: 6.55,       // 能騎到人行道，騎不進柵欄
  bumpSpeed: 0.35,    // 撞到障礙物後保留的速度比例
};

export const PAPER = {
  launchH: 1.3,       // 出手高度
  side: 11.0,         // 橫向出手速度（往騎士較近的那一側）
  up: 2.8,            // 向上初速（1.7 時一樓窗戶（窗底 1.57 m）從哪裡都丟不到；2.8：信箱兩個車道都打得到，窗戶只有騎上人行道才打得到）
  gravity: 8.5,       // 刻意比真實重力小，拋物線比較平
  inherit: 0.85,      // 繼承腳踏車前進速度的比例（要提前出手）
  cooldown: 0.28,     // 兩次出手的最短間隔
  radius: 0.16,       // 報紙卷的判定半徑
  stock: 20,          // 第一輪 greybox：一趟 20 份
  mailboxR: 0.55,     // 信箱判定：以信箱盒中心為球心的半徑（比模型大，偏寬鬆）
};

export const POINTS = {
  mailbox: 100,       // 丟進訂戶信箱
  doorstep: 50,       // 落在訂戶的前院、門廊或撞到訂戶家正面（不含窗）
  badWindow: -100,    // 砸到非訂戶的窗
  subWindow: -150,    // 砸到訂戶自己的窗（之後會讓他退訂）
  missedHouse: 0,     // 訂戶沒收到報：結算時列出，第一輪不扣分
  bump: -20,          // 撞到垃圾桶、消防栓、信箱柱、停著的車
  bite: -40,          // 被狗追上咬到褲管
  crash: -60,         // 撞上對向來車（車會煞停，通常是自己騎進去）
  streak: 25,         // 連投：第 n 次連續送到多給 (n−1)×25
  vipMult: 3,         // 金色信箱（每天一戶 VIP 訂戶）：信箱與門口的分數 ×3
  bundle: 25,         // 撿到報紙補給包
  jump: 50,           // 飛過跳台
};

// 追尾鏡頭。兩組都留著，用 C 鍵即時切換比較（ART.md：greybox 時由騎乘手感決定）
export const CAMERAS = {
  near: { height: 2.15, back: 4.6, ahead: 9.0, lookH: 1.15, fov: 56 },   // 參考圖用的這組
  far:  { height: 2.8,  back: 6.5, ahead: 10.0, lookH: 1.0, fov: 54 },   // 接近參考影片：騎士佔畫面約 27%
};
export const CAMERA = {
  lag: 6.0,           // 位置跟隨的平滑速率（越大越緊）
  yawLag: 3.5,        // 鏡頭轉向跟隨車頭的速率；只跟一部分車頭角度，畫面不會甩
  yawFollow: 0.45,
  minHFov: 62,        // 橫式／方形螢幕保住的最小水平視角（度），兩側房子才不會掉出畫面
  // 直式螢幕（寬高比 < 0.8）：水平視角放寬到 48° 就好，鏡頭稍微拉高拉遠，騎士落在畫面約 62% 高度，
  // 不然垂直視角會撐到 105°、下半部全是路面。數值是加在目前那組鏡頭上的差量。
  portrait: { minHFov: 48, height: 0.45, back: 0.5, lookH: 0.2, ahead: 1.0 },
};

// 會動的障礙（src/core/hazards.js）。數值是第一輪的猜測。
export const HAZ = {
  dogWake: 9,         // 騎士騎到狗前方 9 m 內，狗就衝出來
  dogSpeed: 7.0,      // 狗的極速：比巡航 5.5 快、比按住加速的 10.5 慢 → 看到狗就要加速
  dogAccel: 10,
  dogChase: 5.0,      // 追 5 秒追不到就放棄
  dogBite: 0.8,       // 追到這個距離就算咬到
  carSpeed: 7.5,      // 對向來車（左側車道 x = −1.85，往 +z 開）
  carAhead: 75,       // 觸發時在騎士前方多遠出現
  carBrake: 9,        // 車道前方 7 m 內有騎士就煞車（只會停，不會閃）
  sprReach: 3.4,      // 灑水器水柱長度
  sprSweep: 1.1,      // 左右掃的幅度（弧度，以朝向馬路為中心）
  sprPeriod: 3.6,     // 掃一個來回的秒數
  sprBeam: 0.22,      // 水柱半寬（弧度）
  sprDrag: 9,         // 在水柱裡每秒掉多少速度（m/s²），最低降到巡航的 55%
};

// 路上的元素：報紙補給包、跳台（src/core/street.js 擺、game.js 判定）
export const ITEMS = {
  bundleR: 0.85,      // 騎到補給包這個距離內就撿起
  bundleAdd: 5,       // 一包 5 份
  stockMax: 25,       // 報紙最多帶 25 份
  rampL: 1.7, rampW: 1.2, rampH: 0.34,   // 跳台尺寸（和 Blender 的 ramp() 一樣）
  jumpUp: 1.6,        // 起跳垂直初速 = jumpUp + 車速 × jumpK
  jumpK: 0.22,
  gravity: 9.8,
};
