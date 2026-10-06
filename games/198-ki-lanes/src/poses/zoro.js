// 索隆的專屬動作（海賊王・三刀流）。遊戲只在右手拿一把刀；左腰掛三把刀鞘。
// 鍵：atk1～3 普攻三連斬、cast_Q 三十六煩惱鳳、dash_W／slash 鬼斬（衝刺與收招）、slash_E 獅子歌歌、dash_R／vanish_R 三千世界、run、win。
// 刀在哪裡由姿勢的 prop 決定（1 在右手、−1 在左腰鞘裡、0 照動作名預設）：cast_Q 拔刀後、vanish_R 旋斬時把刀拿在手上，
// 收招時右手先回到左腰的鞘口，手到了那一格才把刀切回鞘裡，看起來是「收刀」而不是刀憑空消失。
// 規則：每一個動作都從「右手握刀柄、刀在鞘裡」起手，也在動作時間內收回同一格。動作之間 combat.js 會切回待機
// （待機時刀一定在鞘裡），所以普攻、技能、普攻之間不論怎麼接，刀都是拔出來、收回去，不會在手和腰間瞬移。
// 刀的方向：刀身從虎口伸出、和前臂垂直；wrR 正（約 1.0）把刀身扳成和手臂一直線，wrR 負讓刀往後倒（上段架刀）。
// 座標備忘（角色面向 +Z、+X 是左手邊）：鞘口的刀柄在左腰前（約 0.12, 0.84, 0.09），刀身朝左下斜插。
import { strike, lerpPose, ease, clamp, KEYS } from '../pose-kit.js';

const TAU = Math.PI * 2;

// 讓腳踩在地上：依骨盆高度與大腿角度算膝蓋彎度（大腿 0.5L、小腿 0.44L，直立時腳踝離地 0.06L）
function knee(d, thX, hipsY, hipsRX = 0, thZ = 0) {
  const L = d.L, A = thX + hipsRX;
  const D = (0.94 * L + hipsY) / Math.cos(thZ);
  const c = clamp((D - 0.5 * L * Math.cos(A)) / (0.44 * L), -1, 1);
  return Math.max(0, Math.acos(c) - A);
}
// 兩腳都踩地（姿勢裡的 knL／knR 被覆寫）
function plant(d, p) {
  p.knL = knee(d, p.thLX, p.hipsY, p.hipsRX, p.thLZ);
  p.knR = knee(d, p.thRX, p.hipsY, p.hipsRX, p.thRZ);
  return p;
}
// 以架式為底，覆寫後把腳踩實
const pose = (ctx, o) => plant(ctx.d, ctx.P(o));

// 左手搭在左腰鞘口：手肘往後外張、拇指頂著護手（隨時能推刀出鞘）
const HILT_L = { shLX: 0.55, shLY: -0.3, shLZ: 0.42, elL: -1.22, wrL: 0.15, hoL: 0.05, hsL: 0.75 };
// 收刀：右手握著刀柄回到左腰鞘口，刀身順著鞘的方向往左下插（這一格切回鞘裡就接得上）
const SHEATHE_R = { shRX: -0.15, shRY: -0.11, shRZ: -0.83, elR: -0.35, wrR: 1.0, hoR: 0, hsR: 0.2 };
const sheathe = (ctx, o) => pose(ctx, { hipsY: -0.12, hipsZ: 0, hipsRX: 0, hipsRY: -0.3, torsoX: 0.22, torsoY: 0.45, torsoZ: 0, headX: 0.3, headY: 0.1,
  ...HILT_L, shLX: 0.47, shLY: -0.6, shLZ: 0.6, ...SHEATHE_R, thLX: -0.3, thLZ: 0.2, thRX: 0.3, thRZ: 0.18, ...o });
// 納刀的中繼格：右手收到腹前、刀身平著指向左前方（刀尖找鞘口）。從任何姿勢直接內插到 SHEATHE_R，
// 刀身會往下甩過地面；先經過這一格，刀一路保持水平，最後才順著鞘的方向插回去
const NOTO_R = { shRX: -0.62, shRY: -0.3, shRZ: -0.19, elR: -0.96, wrR: 1.14, hoR: 0, hsR: 0.2 };
// from → 納刀中繼（前半）→ 收刀（後半）；u 0～1。兩段之間有一個短短的停頓，看得出「刀尖對準鞘口、再推進去」
// 前半段手臂往前抬一點（lift），刀從身側轉到身前時刀尖不會往下掉
function toSheath(ctx, from, u, lift = 0.5) {
  let p;
  if (u < 0.5) { p = lerpPose(from, sheathe(ctx, NOTO_R), ease(u / 0.5)); p.shRX -= lift * Math.sin(Math.PI * u / 0.5); }
  else p = lerpPose(sheathe(ctx, NOTO_R), sheathe(ctx), ease((u - 0.5) / 0.5));
  return plant(ctx.d, p);
}

// 鬼斬的 X：兩前臂在胸骨前交叉（右手到左胸前、左手到右胸前），刀從右手虎口往後上方越過左肩
const ONI_X = { hipsY: -0.12, hipsZ: 0.05, hipsRX: 0.3, hipsRY: 0, hipsRZ: 0, torsoX: 0.3, torsoY: 0, torsoZ: 0, headX: -0.55, headY: 0,
  shRX: -0.48, shRY: -1.44, shRZ: 0.96, elR: -1.68, wrR: 0.12, hoR: 0, hsR: 0.2,
  shLX: -0.62, shLY: -1.44, shLZ: 0.61, elL: -1.69, wrL: 0, hoL: 0, hsL: 0.1 };

// 普攻：右手握住左腰的刀柄（刀還在鞘裡）→ 拔刀到預備 W、停一下 → 斬下（ti）→ 順勢多送一點並停住 → 平著收到腹前、推回鞘口（done 入鞘）。
// 普攻之間 combat.js 會切回待機（待機時刀在鞘裡、右手搭在刀柄上），所以每一刀都從鞘口拔、收回鞘口：
// 刀不會在伸直的手和腰間之間瞬移；獅子歌歌收刀後緊接的強化普攻，也是從同一個鞘口再拔出來。
// done 照攻速最快（約 0.5）時的動作長度抓：atk1／atk2 約 0.355 秒、atk3 約 0.4 秒，收刀一定在動作結束前完成。
// ti 對齊 combat.js 普攻的命中時間（wind × min(1, as/0.8)；索隆基礎攻速 0.74 時 atk1 0.111、atk2 0.13、atk3 0.185），
// 比共用的 IMPACT 晚一點點：多出來的時間拿來拔刀，刀落下和命中火花也在同一格。
const DRAW = 0.035; // 右手到了刀柄，這一格才把刀切到手上
const _ov = {};
function cut(ctx, { ti, W, S, wa, wh, ov = 0.12, ft = ti + 0.07, done, lift = 0.5 }) {
  const { t } = ctx;
  const G = sheathe(ctx);
  let p;
  if (t < 0.025) p = lerpPose(ctx.base, G, ease(t / 0.025));
  else if (t < DRAW) p = { ...G };
  else if (t < wa) p = lerpPose(G, W, ease((t - DRAW) / (wa - DRAW)));
  else if (t < wh) p = { ...W };
  else if (t < ti) { const u = (t - wh) / (ti - wh); p = lerpPose(W, S, u * u * (2 - u)); } // 出手越來越快
  else {
    for (const k of KEYS) _ov[k] = S[k] + (S[k] - W[k]) * ov; // 順勢多送（下劈的招式送得少，刀尖才不會插進地裡）
    if (t < ft) p = lerpPose(S, _ov, Math.sin(Math.PI * 0.5 * clamp((t - ti) / 0.05, 0, 1)));
    else p = toSheath(ctx, { ..._ov }, clamp((t - ft) / (done - ft), 0, 1), lift);
  }
  plant(ctx.d, p);
  p.prop = t < DRAW || t >= done ? -1 : 1;
  return p;
}

export default {
  // 架式（居合的待機）：腳開、膝微彎，身子微駝、下巴壓低瞪人；左手拇指頂著護手，右手鬆鬆地搭在刀柄上。
  // 和每一招收刀的最後一格（sheathe）同一個手位，招式結束切回待機時右手不必從刀柄移開，下一刀也從這裡拔
  stance(ctx) {
    const { t, d } = ctx;
    const br = Math.sin(t * 2.2), sway = Math.sin(t * 1.1);
    const p = {
      hipsY: -0.07 - 0.012 * br, hipsZ: 0, hipsRX: 0, hipsRY: -0.28, hipsRZ: 0.03 * sway,
      torsoX: 0.14 + 0.02 * br, torsoY: -0.12, torsoZ: 0.04, headX: 0.14 - 0.02 * br, headY: 0.34, headZ: -0.04,
      ...HILT_L,
      ...SHEATHE_R, hoR: 0.2,
      thLX: -0.3, thLZ: 0.2, thRX: 0.28, thRZ: 0.16, knL: 0, knR: 0,
      spin: 0, stretch: 0, anL: 0, anR: 0, clL: 0, clR: 0, toL: 0, toR: 0, prop: 0,
    };
    return plant(d, p);
  },

  // 一：袈裟斬。刀扛在右肩後（刀尖朝後），右腳踏進、腰帶動，刀從右上斬到左前下方，刀尖停在膝蓋高
  atk1(ctx) {
    const W = pose(ctx, { hipsY: -0.1, hipsZ: -0.03, hipsRY: -0.4, torsoY: -0.55, torsoX: -0.05, headY: 0.65, headX: 0,
      shRX: -1.76, shRY: 0.77, shRZ: 0.04, elR: -0.9, wrR: -0.33, hoR: 0,
      shLX: -0.55, shLZ: 0.3, elL: -1.3, hoL: 0.1, thLX: -0.22, thRX: 0.3 });
    const S = pose(ctx, { hipsY: -0.24, hipsZ: 0.26, hipsRX: 0.1, hipsRY: 0.3, torsoY: 0.65, torsoX: 0.45, torsoZ: -0.08, headY: -0.6, headX: -0.15,
      shRX: -0.93, shRY: 0.41, shRZ: 0.01, elR: -0.05, wrR: 0.33, hoR: 0,
      shLX: 0.55, shLZ: 0.5, elL: -0.6, hoL: 0.1, thRX: -0.8, thRZ: 0.12, thLX: 0.5, thLZ: 0.18 });
    return cut(ctx, { ti: 0.11, W, S, wa: 0.065, wh: 0.08, ov: 0.06, ft: 0.17, done: 0.34 });
  },

  // 二：反手橫斬（逆胴）。刀收到左腰後（刀尖朝後），左腳踏進，刀身平著從左掃到右、停在腰胸高
  atk2(ctx) {
    const W = pose(ctx, { hipsY: -0.12, hipsRY: 0.35, torsoY: 0.75, torsoX: 0.15, headY: -0.7,
      shRX: -1.08, shRY: -0.78, shRZ: -1.09, elR: -0.52, wrR: 0.41, hoR: 0,
      shLX: -0.3, shLZ: 0.2, elL: -1.3, hoL: 0.1, thLX: -0.3, thRX: 0.35 });
    const S = pose(ctx, { hipsY: -0.2, hipsZ: 0.2, hipsRY: -0.3, torsoY: -0.7, torsoX: 0.3, torsoZ: 0.08, headY: 0.65,
      shRX: -1.48, shRY: 0.93, shRZ: 0.09, elR: -0.24, wrR: 0.8, hoR: 0,
      shLX: 0.35, shLZ: 0.6, elL: -0.5, hoL: 0.1, thLX: -0.8, thLZ: 0.25, thRX: 0.5, thRZ: 0.14 });
    return cut(ctx, { ti: 0.13, W, S, wa: 0.075, wh: 0.095, ft: 0.19, done: 0.35 });
  },

  // 三：虎狩。蹲低、雙手握刀扛到腦後（刀身平躺在背後），小跳一步雙手往前下劈；連段收尾，收招把刀送回左腰鞘
  atk3(ctx) {
    const { t } = ctx, ti = 0.17, wh = 0.12;
    const W = pose(ctx, { hipsY: -0.2, hipsZ: -0.05, hipsRY: 0, torsoY: 0.1, torsoX: -0.3, torsoZ: 0, headX: -0.3, headY: 0,
      shRX: -2.33, shRY: -0.28, shRZ: 0.33, elR: -1.06, wrR: 0, hoR: 0,
      shLX: -2.33, shLY: -0.73, shLZ: 0.4, elL: -1.27, hoL: 0, thLX: -0.45, thRX: 0.35 });
    const S = pose(ctx, { hipsY: -0.3, hipsZ: 0.32, hipsRX: 0.12, hipsRY: 0, torsoY: 0, torsoX: 0.5, torsoZ: 0, headX: -0.5, headY: 0,
      shRX: -1.0, shRY: 0.15, shRZ: -0.27, elR: -0.51, wrR: 0.88, hoR: 0,
      shLX: -0.62, shLY: -0.59, shLZ: 0.06, elL: -1.02, hoL: 0, thLX: -0.8, thLZ: 0.2, thRX: 0.5, thRZ: 0.15 });
    // 收招：刀平著收到腹前、刀尖對準鞘口，再推回左腰（0.375 秒入鞘：攻速加快、動作縮到約 0.4 秒時也來得及）
    const p = cut(ctx, { ti, W, S, wa: 0.095, wh, ov: 0.03, ft: 0.22, done: 0.375 });
    // 出手的半拍裡往前小跳：骨盆抬起、兩腳離地
    if (t > wh && t < ti) {
      const h = Math.sin(Math.PI * (t - wh) / (ti - wh));
      p.hipsY += 0.12 * h; p.knL += 0.4 * h; p.knR += 0.5 * h;
    }
    return p;
  },

  // Q 三十六煩惱鳳：右手握住左腰的刀柄、身體扭緊蹲低（刀還在鞘裡），0.14 秒拔刀橫掃、刀身順著手臂甩向右側，
  // 斬擊飛出後收刀回鞘（0.29 秒手到鞘口才切回鞘裡）
  cast_Q(ctx) {
    const { t } = ctx;
    const W = pose(ctx, { hipsY: -0.2, hipsZ: -0.04, hipsRY: 0.3, torsoY: 0.7, torsoX: 0.38, torsoZ: -0.05, headY: -0.62, headX: -0.25,
      shRX: -0.47, shRY: -0.59, shRZ: -0.58, elR: -0.32, wrR: 0.73, hoR: 0, hsR: 0.2,
      ...HILT_L, shLX: 0.05, shLY: -0.35, shLZ: 0.1, elL: -1.3, thLX: -0.45, thLZ: 0.24, thRX: 0.4, thRZ: 0.2 });
    const S = pose(ctx, { hipsY: -0.22, hipsZ: 0.18, hipsRY: -0.3, torsoY: -0.6, torsoX: 0.25, torsoZ: 0.08, headY: 0.6, headX: -0.15,
      shRX: -1.95, shRY: 0.65, shRZ: 0.59, elR: -0.04, wrR: 0.67, hoR: 0, hsR: 0.2,
      ...HILT_L, shLX: 0.58, shLY: -0.22, shLZ: 0.25, elL: -1.01,
      thLX: -0.35, thLZ: 0.32, thRX: -0.5, thRZ: 0.35 });
    let p;
    if (t < 0.19) p = strike(t, 0.14, ctx.base, W, S, 0.32);
    else p = plant(ctx.d, lerpPose(S, sheathe(ctx), ease(clamp((t - 0.19) / 0.1, 0, 1))));
    p.prop = t < 0.08 || t >= 0.29 ? -1 : 1;
    p.ownHands = true;
    return p;
  },

  // W 鬼斬（衝刺中）：身體壓低前衝，兩前臂在胸骨前交叉成 X（右前臂在外、手肘往兩側張開），
  // 刀從左肩上方往後躺、離開頭部；兩腳交替快速擺動（往後擺的那條腿收起來），骨盆跟著上下顛。
  // 起步的一瞬右手先握住左腰的刀柄（刀還在鞘裡），DRAW 那一格拔出、雙臂一路交叉成 X
  dash_W(ctx) {
    const { t } = ctx;
    const s = Math.sin(t * 38);
    const legs = { thLX: -0.45 + 0.4 * s, thLZ: 0.12, thRX: -0.05 - 0.4 * s, thRZ: 0.1 };
    let p = pose(ctx, { ...ONI_X, ...legs });
    if (t < 0.065) p = plant(ctx.d, lerpPose(sheathe(ctx, legs), p, ease(clamp((t - DRAW) / (0.065 - DRAW), 0, 1))));
    p.knL += 0.9 * Math.max(0, s); p.knR += 0.9 * Math.max(0, -s);
    p.hipsY += 0.025 * Math.abs(s);
    p.prop = t < DRAW ? -1 : 1;
    return p;
  },

  // W 鬼斬收招（slash，沒有技能鍵）：衝過去後雙臂一口氣向兩側甩開（刀順著右臂伸直、平平地掃開），壓低定住，
  // 再把刀平著收到腹前、推回左腰（0.29 秒入鞘）
  slash(ctx) {
    const { t } = ctx;
    const X = pose(ctx, { ...ONI_X, thLX: -0.45, thLZ: 0.12, thRX: -0.05, thRZ: 0.1 });
    const S = pose(ctx, { hipsY: -0.3, hipsZ: 0.1, hipsRX: 0.2, hipsRY: 0, torsoX: 0.35, torsoY: 0, torsoZ: 0, headX: -0.4, headY: 0,
      shRX: 0.1, shRY: 0, shRZ: 1.4, elR: -0.05, wrR: 1.0, hoR: 0,
      shLX: 0.1, shLY: 0, shLZ: 1.4, elL: -0.05, wrL: 0, hoL: 0,
      thLX: -0.8, thLZ: 0.3, thRX: 0.5, thRZ: 0.25 });
    let p;
    if (t < 0.07) {
      const u = ease(t / 0.07);
      p = lerpPose(X, S, u);
      p.wrR = X.wrR + (S.wrR - X.wrR) * u * u; // 刀尖先留在上面、手臂甩開後才順成一直線，刀不會往下掃過地面
    } else if (t < 0.15) p = { ...S };
    else p = toSheath(ctx, S, clamp((t - 0.15) / 0.14, 0, 1));
    p.prop = t >= 0.29 ? -1 : 1;
    return p;
  },

  // E 獅子歌歌：一閃而過後的居合收勢——一開始就已經拔刀（斬擊在瞬移途中完成），深弓步、刀向右後方平伸，
  // 上身轉過頭一點再回正（殘心），左手還按著刀鞘；最後快速收刀
  slash_E(ctx) {
    const { t } = ctx;
    const S = pose(ctx, { hipsY: -0.36, hipsZ: 0.18, hipsRY: -0.3, torsoY: -0.6, torsoX: 0.5, torsoZ: 0.05, headY: 0.55, headX: -0.15,
      shRX: -0.26, shRY: -0.3, shRZ: 1.36, elR: 0, wrR: 1.25, hoR: 0,
      ...HILT_L, shLX: 0.77, shLY: -0.24, shLZ: 0.41, elL: -1.32, thLX: -0.8, thLZ: 0.25, thRX: 0.5, thRZ: 0.2 });
    const k = 1 - ease(clamp(t / 0.1, 0, 1)); // 轉過頭的量，0.1 秒內回正
    let p = { ...S, torsoY: S.torsoY - 0.3 * k, hipsY: S.hipsY - 0.04 * k, shRZ: S.shRZ + 0.15 * k, headY: S.headY + 0.15 * k };
    plant(ctx.d, p);
    // 動作只有 0.2 秒：殘心停到 0.09 秒，剩下的時間快速納刀，0.185 秒刀已經回到鞘口（不會從伸直的手上瞬間跳回腰間）。
    // 接著的強化普攻從同一個鞘口起手：右手留在刀柄上約 0.05 秒（喀的一聲）再拔出來
    const u = clamp((t - 0.09) / 0.095, 0, 1);
    if (u > 0) p = toSheath(ctx, p, u, 0.7);
    p.prop = u >= 1 ? -1 : 1;
    return p;
  },

  // R 三千世界（前 0.3 秒，原地）：蹲低前傾，右臂往前伸、刀在身前繞圈（刀尖畫出朝前的圓錐：上 → 右 → 前 → 左），
  // 刀一直在身體前方，不會掃過頭或地面；左手按住鞘口。起手先從鞘口拔刀（DRAW 之前刀在鞘裡）
  dash_R(ctx) {
    const { t } = ctx;
    const th = t * 26, a = Math.sin(th), b = Math.cos(th);
    let p = pose(ctx, { hipsY: -0.22, hipsZ: 0, hipsRX: 0.2, hipsRY: 0, hipsRZ: 0, torsoX: 0.35, torsoY: 0.1 * a, torsoZ: 0, headX: -0.45, headY: 0,
      shRX: -1.96 + 0.12 * b, shRY: 1.5 * a, shRZ: -0.29, elR: -0.17, wrR: 0.5 - 0.65 * b, hoR: 0, hsR: 0.2,
      ...HILT_L, shLX: 0.51, shLY: 0.12, shLZ: 0.08, elL: -1.4,
      thLX: -0.5, thLZ: 0.4, thRX: 0.4, thRZ: 0.4 });
    if (t < 0.08) p = plant(ctx.d, lerpPose(sheathe(ctx), p, ease(clamp((t - DRAW) / (0.08 - DRAW), 0, 1))));
    p.prop = t < DRAW ? -1 : 1;
    return p;
  },

  // R 三千世界（閃到敵人身後）：像陀螺一樣斜著旋身兩圈（右臂連刀斜上、左臂斜下），
  // 接著站起、刀平著收到腹前（0.45 秒）、推回左腰鞘口（0.6 秒入鞘），點頭一下（喀）定住
  vanish_R(ctx) {
    const { t } = ctx;
    const Wh = pose(ctx, { hipsY: -0.3, hipsZ: 0, hipsRX: 0.1, hipsRY: 0, hipsRZ: -0.06, torsoX: 0.3, torsoY: 0, torsoZ: 0.2, headX: -0.25, headY: 0, headZ: -0.15,
      shRX: -0.3, shRY: 0, shRZ: 1.8, elR: -0.05, wrR: 1.0, hoR: 0,
      shLX: -0.1, shLY: 0, shLZ: 1.05, elL: -0.05, wrL: 0, hoL: 0,
      thLX: -0.45, thLZ: 0.35, thRX: 0.4, thRZ: 0.35 });
    let p;
    if (t < 0.3) p = { ...Wh, spin: 2 * TAU * (1 - (1 - t / 0.3) ** 2) };
    else {
      p = toSheath(ctx, Wh, clamp((t - 0.3) / 0.3, 0, 1));
      p.spin = 2 * TAU;
      if (t > 0.6) { const c = Math.sin(Math.PI * clamp((t - 0.6) / 0.1, 0, 1)); p.headX += 0.22 * c; p.torsoX += 0.06 * c; p.hipsY -= 0.03 * c; plant(ctx.d, p); }
    }
    p.prop = t < 0.6 ? 1 : -1;
    p.ownHands = true;
    return p;
  },

  // 跑步：左手按住腰間刀鞘不讓它晃，右手前後大擺，上身前傾
  run(ctx) {
    const { phase } = ctx;
    const s = Math.sin(phase), c = Math.cos(phase);
    return ctx.P({ hipsY: -0.09 + 0.08 * Math.abs(c), hipsZ: 0, hipsRX: 0.1, hipsRY: -0.2 * s, hipsRZ: 0,
      torsoX: 0.42, torsoY: 0.3 * s, torsoZ: 0, headX: -0.34, headY: -0.15 * s,
      thLX: s * 1.15 - 0.15, thRX: -s * 1.15 - 0.15, thLZ: 0.05, thRZ: 0.05,
      knL: 0.3 + 1.6 * Math.max(0, -c) * (0.6 + 0.4 * Math.max(0, -s)), knR: 0.3 + 1.6 * Math.max(0, c) * (0.6 + 0.4 * Math.max(0, s)),
      ...HILT_L,
      shRX: s * 1.2 - 0.15, shRY: 0, shRZ: 0.22, elR: -1.35 - 0.35 * Math.max(0, -s), wrR: 0, hoR: 0.1 });
  },

  // 勝利：雙手抱胸、重心落在左腳（骨盆往左上斜、右膝放鬆前彎），下巴抬起往旁邊斜睨
  win(ctx) {
    const { t, d } = ctx;
    const br = Math.sin(t * 2);
    const p = plant(d, ctx.P({ hipsY: -0.03 + 0.01 * br, hipsZ: 0, hipsRX: 0, hipsRY: -0.25, hipsRZ: 0.15, torsoX: -0.06, torsoY: 0.1, torsoZ: -0.12,
      headX: -0.3, headY: 0.45, headZ: 0.1,
      shLX: -0.5, shLY: -1.4, shLZ: -0.05, elL: -1.55, wrL: 0, hoL: 0, hsL: 0,
      shRX: -0.42, shRY: -1.4, shRZ: -0.05, elR: -1.75, wrR: 0, hoR: 0, hsR: 0,
      thLX: -0.05, thLZ: -0.05, thRX: -0.2, thRZ: 0.3 }));
    p.knR += 0.3;
    return p;
  },
};
