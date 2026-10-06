// luffy 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（strike、lerpPose、ease、clamp、IMPACT…）。
//
// 魯夫的動作語彙：大開步、膝蓋鬆、整個人像橡皮球一樣落地一縮、彈起一鬆；手臂伸長打人（stretch 只作用在右臂，從手肘拉長前臂）。
// 伸長的手臂收回時要先在水平高度縮短（stretch ≤ 0.3）再放下，否則俯視鏡頭會看到一根長竿躺在地上。
// 招式對應（combat.js 的 KITS.luffy）：
//   普攻         → atk1 右直拳伸長（射程 3.4，最長的近戰）、atk2 鞭臂橫掃、atk3 鐵鎚（長臂過頂砸下）
//   Q 橡膠槍       → grab（0.5 秒，第一格就射出拳頭與皮膚色的橡皮臂特效）  → grab_Q
//   W 橡膠火箭     → dash（0.45 秒，從 t=0 就沿拋物線飛到落點，0.45 秒落地衝擊）→ dash_W
//   E 二檔         → charge（0.35 秒）                                     → charge_E
//   R 巨人手槍     → charge（0.5 秒，咬拇指吹氣＋把巨臂舉到身後）→ charge_R，接著 pierceWave 的 cast（0.32 秒，0.14 秒出拳，技能鍵 R）→ cast_R
//
// 手臂方向：上身扭轉、前傾後，肩膀角度和「世界方向」不是線性關係，主要指向是用肩→手的方向反解出來的
// （正前方水平：無扭轉 shRX −1.6／shRZ 0.3；右肩往前扭 1 弧度時 shRZ 約 1.7，等於手臂從胸口側面伸出去）。
import { lerpPose, ease, clamp, blank } from '../pose-kit.js';

// 依兩腿角度算骨盆高度，讓比較低的那隻腳剛好踩在地上（大腿／膝蓋的世界角度含骨盆前傾）
function plant(d, p, lift = 0) {
  const drop = (thX, thZ, kn) => {
    const x = thX + p.hipsRX;
    return d.thighLen * Math.cos(x) * Math.cos(thZ) + d.shinLen * (Math.cos(x) * Math.cos(kn) * Math.cos(thZ) - Math.sin(x) * Math.sin(kn));
  };
  const leg = d.thighLen + d.shinLen;
  p.hipsY = Math.max(drop(p.thLX, p.thLZ, p.knL), drop(p.thRX, p.thRZ, p.knR)) - leg + lift;
  return p;
}
// 頭跟著骨盆與上身扭轉時往回轉，眼睛一直盯著前方（extra 是額外的偏頭）
const look = (p, extra = 0) => { p.headY = -(0.5 * p.torsoY + p.hipsRY) + extra; return p; };
// 先套 base 再覆寫，最後貼地與看前方
function pose(ctx, o, lift = 0) { return look(plant(ctx.d, ctx.P(o), lift), o.headY || 0); }
// 依時間軸在關鍵姿勢之間內插：keys = [[時間, 姿勢, 曲線?], …]；snap＝越來越快（出手）、in＝先慢後快
function track(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, b, curve] = keys[i];
    if (t < t1) {
      const [t0, a] = keys[i - 1];
      const u = (t - t0) / (t1 - t0);
      return lerpPose(a, b, curve === 'snap' ? u * u * (2 - u) : curve === 'in' ? u * u : ease(u));
    }
  }
  return keys[keys.length - 1][1];
}
const own = (p) => { p.ownHands = true; return p; }; // 右手保持握拳（不套共用的張手）
// 橡皮手臂彈回：方向不變、手肘保持伸直，只把長度縮回去（邊縮邊彎會折成一個長長的 V）
const snapBack = (p, len = 0.12) => Object.assign({ ...p }, { stretch: len, elR: Math.min(p.elR, -0.12) });

// 巨人手槍的蓄力終點（charge_R 的最後一格，也是 cast_R 的起點，前後要接得起來）：
// 巨臂舉到右後上方、手肘微彎，上身擰過去並往左側倒（讓開手臂），左手張開指著目標，雙腿深蹲蓄力
const GIGANT_WIND = { hipsRY: -0.35, torsoY: -0.9, torsoX: 0.15, torsoZ: 0.25, hipsZ: -0.1,
  shRX: -2.6, shRZ: 1.14, elR: -0.45, stretch: 1.1, hoR: 0, hsR: 0,
  shLX: -0.96, shLZ: 1.33, elL: -0.1, hoL: 1, hsL: 0.8, wrL: -0.3,
  thLX: -0.8, thLZ: 0.45, knL: 1.2, thRX: 0.45, thRZ: 0.45, knR: 0.85, headX: -0.2 };

export default {
  // 架式：大開步半蹲、上身前傾駝背，像橡皮球一樣一直彈：落地那一下膝蓋猛縮（尖點）、彈起時慢慢鬆開；
  // 雙拳跟著晚半拍上下甩，頭反向點一下，俯視時整個輪廓一縮一放
  stance(ctx) {
    const t = ctx.t;
    const up = Math.abs(Math.sin(t * 4)); // 彈起高度：0＝落地（尖點）～1＝最高
    const b = 1 - up; // 壓縮量
    const lag = 1 - Math.abs(Math.sin(t * 4 - 0.45)); // 手臂晚半拍
    const sway = Math.sin(t * 1.3);
    const p = Object.assign(blank(), {
      hipsRY: -0.08, hipsRZ: 0.03 * sway, hipsRX: 0.04,
      torsoX: 0.24 + 0.08 * b, torsoY: -0.08 + 0.06 * sway, torsoZ: -0.03, headX: -0.28 - 0.08 * b,
      shLX: -0.8 + 0.22 * lag, shLZ: 0.42, elL: -1.4 + 0.15 * lag, wrL: 0.15,
      shRX: -0.25 + 0.18 * lag, shRZ: 0.5 + 0.06 * lag, elR: -1.05 - 0.15 * lag, wrR: 0.1,
      thLX: -0.36, thLZ: 0.42, knL: 0.36 + 0.72 * b,
      thRX: 0.28, thRZ: 0.42, knR: 0.3 + 0.66 * b,
      hoL: 0.12, hoR: 0.08, hsL: 0.2, hsR: 0.2,
    });
    return look(plant(ctx.d, p, 0.03 * up), 0.05);
  },

  // 普攻一：橡膠直拳。右拳收到腰邊、上身擰回去，再整個人轉過來把右臂筆直「射」出去拉到 2.5 倍（補足 3.4 的射程），
  // 左拳同時拉回胸口；停一下就在水平高度彈回來
  atk1(ctx) {
    // 預備：右拳收到右後方腰邊（手肘往後外撐），俯視時看得到拳頭藏在身後
    const W = pose(ctx, { hipsRY: -0.2, torsoY: -0.55, torsoX: 0.25, shRX: 0.1, shRZ: 0.5, elR: -2.3, wrR: 0, stretch: 0, hoR: 0,
      shLX: -1.81, shLZ: 0.91, elL: -0.4, hoL: 0, thLX: -0.4, knL: 0.95, thRX: 0.32, knR: 0.8, hipsZ: -0.05 });
    // 中段：拳頭先沿直線往前送（避免從胸口往上繞一大圈）
    const M = pose(ctx, { hipsRY: 0.05, torsoY: 0.1, torsoX: 0.28, shRX: -1.39, shRZ: 0.66, elR: -0.7, stretch: 0.4, clR: 0.2, hoR: 0,
      shLX: -0.6, shLZ: 0.5, elL: -1.5, hoL: 0, thLX: -0.6, thLZ: 0.4, knL: 0.9, thRX: 0.45, thRZ: 0.4, knR: 0.5, hipsZ: 0.06 });
    const S = pose(ctx, { hipsRY: 0.2, torsoY: 0.4, torsoX: 0.3, shRX: -2.07, shRZ: 1.36, elR: 0, stretch: 2.5, clR: 0.45, hoR: 0,
      shLX: 0.35, shLZ: 0.45, elL: -1.9, hoL: 0, hipsZ: 0.18,
      thLX: -0.75, thLZ: 0.38, knL: 0.85, thRX: 0.6, thRZ: 0.38, knR: 0.2 });
    const O = Object.assign({ ...S }, { torsoY: 0.48, stretch: 2.7, hipsZ: 0.22 }); // 命中後再多送一點
    const R = pose(ctx, { hipsRY: 0.12, torsoY: 0.3, torsoX: 0.28, shRX: -1.75, shRZ: 1.2, elR: -0.9, stretch: 0.15, hoR: 0,
      shLX: -0.4, shLZ: 0.45, elL: -1.6, thLX: -0.5, knL: 0.8, thRX: 0.4, knR: 0.5, hipsZ: 0.08 });
    // 命中時間是 0.12×攻速係數（基礎約 0.11、二檔約 0.07），伸直的拳頭提早到 0.075 就位並一路撐到 0.18
    return own(track(ctx.t, [[0, ctx.base], [0.04, W], [0.058, M, 'snap'], [0.075, S], [0.12, O], [0.18, O], [0.215, snapBack(O), 'in'], [0.26, R], [0.33, ctx.base]]));
  },

  // 普攻二：橡膠鞭臂。右手甩到右後方先拉長，上身與骨盆整個扭回來，長手臂（2.2 倍）由右往左橫掃過目標再掃到左前方，
  // 收的時候先在水平高度縮短再放下
  atk2(ctx) {
    const W = pose(ctx, { torsoY: -0.85, hipsRY: -0.35, torsoX: 0.22, torsoZ: 0.08, shRX: -1.69, shRZ: 1.29, elR: -0.15, stretch: 0.8, hoR: 0,
      shLX: -1.2, shLZ: 0.7, elL: -1.5, thLX: -0.4, knL: 0.9, thRX: 0.32, knR: 0.8, hipsZ: -0.04 });
    const S = pose(ctx, { torsoY: 0.85, hipsRY: 0.35, torsoX: 0.3, torsoZ: -0.12, shRX: -1.07, shRZ: 1.5, elR: 0, stretch: 2.2, clR: 0.35, hoR: 0,
      shLX: 0.45, shLZ: 0.55, elL: -1.2, hipsZ: 0.16,
      thLX: -0.72, thLZ: 0.4, knL: 0.85, thRX: 0.6, thRZ: 0.4, knR: 0.2 });
    const O = Object.assign({ ...S }, { torsoY: 1.05, hipsRY: 0.45, torsoX: 0.32, shRX: -1.89, shRZ: 1.21, stretch: 2.0 }); // 掃過頭到左前方
    const R = pose(ctx, { torsoY: 0.5, hipsRY: 0.2, torsoX: 0.28, shRX: -1.75, shRZ: 0.6, elR: -1.2, stretch: 0.15, hoR: 0,
      shLX: -0.3, shLZ: 0.5, elL: -1.4, thLX: -0.55, knL: 0.8, thRX: 0.45, knR: 0.45, hipsZ: 0.08 });
    return own(track(ctx.t, [[0, ctx.base], [0.055, W], [0.095, S, 'snap'], [0.15, O], [0.19, O], [0.225, snapBack(O), 'in'], [0.27, R], [0.34, ctx.base]]));
  },

  // 普攻三：橡膠鐵鎚（連段收尾，擊退＋暈眩）。只有右臂能伸長，所以不做雙掌火箭砲（左手搆不到 3.4 的射程）：
  // 上身往右後擰、後仰，右臂舉到右後上方並先拉長一截（俯視看得到一根橡皮臂甩在身後），
  // 接著整個人往前折腰、弓步，長臂從頭頂越過來把拳頭砸到前方 2.4 倍遠的目標上，砸過頭一點再停住；收的時候先在水平高度縮短
  atk3(ctx) {
    const W = pose(ctx, { hipsRY: -0.25, torsoY: -0.75, torsoX: -0.12, torsoZ: 0.12, hipsZ: -0.08, headX: -0.1,
      shRX: -2.9, shRZ: 0.9, elR: -1.1, wrR: 0.3, stretch: 0.5, hoR: 0,
      shLX: -1.5, shLZ: 0.9, elL: -0.3, hoL: 0.6, hsL: 0.5,
      thLX: -0.5, thLZ: 0.45, knL: 0.9, thRX: 0.4, thRZ: 0.45, knR: 0.95 });
    // 頂點：手臂打直、拉到 1.5 倍，指向右後上方
    const U = Object.assign({ ...W }, { shRX: -3.3, shRZ: 0.8, elR: -0.05, wrR: 0, stretch: 1.5, torsoX: -0.18 });
    const S = pose(ctx, { hipsRY: 0.18, torsoY: 0.42, torsoX: 0.6, torsoZ: -0.05, hipsZ: 0.3, headX: -0.5,
      shRX: -2.3, shRZ: 1.42, elR: 0, wrR: 0.4, stretch: 2.4, clR: 0.4, hoR: 0,
      shLX: 0.6, shLZ: 0.6, elL: -1.2, hoL: 0.3, hsL: 0.4,
      thLX: -1.1, thLZ: 0.36, knL: 1.1, thRX: 0.8, thRZ: 0.36, knR: 0.15 });
    const O = Object.assign({ ...S }, { torsoX: 0.7, shRX: -2.18, stretch: 2.55, hipsZ: 0.34 }); // 砸過頭一點
    const R = pose(ctx, { hipsRY: 0.1, torsoY: 0.2, torsoX: 0.35, shRX: -1.6, shRZ: 1.0, elR: -1.0, stretch: 0.1, hoR: 0,
      shLX: -0.4, shLZ: 0.45, elL: -1.5, thLX: -0.6, knL: 0.85, thRX: 0.45, knR: 0.5, hipsZ: 0.1 });
    // 命中在 0.2×攻速係數（基礎約 0.185、二檔約 0.12）：0.13 砸到、撐到 0.24，0.37 前回到架式（二檔時動作只有 0.4 秒）
    return own(track(ctx.t, [[0, ctx.base], [0.06, W], [0.09, U], [0.13, S, 'snap'], [0.17, O], [0.24, O], [0.275, snapBack(O), 'in'], [0.32, R], [0.37, ctx.base]]));
  },

  // Q 橡膠槍：拳頭與皮膚色的橡皮臂特效在第一格就從胸前射出去，所以模型不往後拉（會和特效變成兩隻手），
  // 只用 0.03 秒擰腰蓄一下，接著整個人轉過來，右臂沿著特效的方向筆直伸出（拉長 1.1 倍、手接到特效的起點），
  // 一直撐到特效快結束（0.44 秒）才在水平高度彈回來
  grab_Q(ctx) {
    const W = pose(ctx, { hipsRY: -0.25, torsoY: -0.55, torsoX: 0.26, shRX: -0.9, shRZ: 0.55, elR: -1.9, stretch: 0.4, hoR: 0,
      shLX: -1.81, shLZ: 0.91, elL: -0.3, hoL: 0.65, hsL: 0.5, thLX: -0.48, knL: 0.9, thRX: 0.38, knR: 0.65, hipsZ: -0.06 });
    const S = pose(ctx, { hipsRY: 0.32, torsoY: 0.7, torsoX: 0.3, shRX: 0.15, shRZ: 1.71, elR: 0, stretch: 1.1, clR: 0.45, hoR: 0,
      shLX: 0.55, shLZ: 0.5, elL: -0.95, thLX: -0.8, thLZ: 0.4, knL: 0.92, thRX: 0.66, thRZ: 0.4, knR: 0.16, hipsZ: 0.22 });
    const O = Object.assign({ ...S }, { torsoY: 0.78, hipsZ: 0.26, torsoX: 0.34 }); // 出手瞬間多送一點
    return own(track(ctx.t, [[0, ctx.base], [0.03, W], [0.065, S, 'snap'], [0.1, O], [0.18, S], [0.43, S], [0.465, snapBack(S), 'in'], [0.5, ctx.base]]));
  },

  // W 橡膠火箭：combat 從 t=0 就把人拋起來，所以一開始就是彈射姿勢（身體前倒、腿往後伸直、右手伸長「抓」落點），
  // 接著打平飛過去（雙手在前、腿併攏在後、身體慢慢滾一點），下降時收腿、右拳舉高，落地深蹲、拳頭砸進地面（0.45 秒衝擊）
  dash_W(ctx) {
    const t = ctx.t;
    const L = ctx.P({ hipsRX: 0.8, hipsY: 0.05, hipsRY: 0, hipsZ: 0.1, torsoX: 0.2, torsoY: 0, torsoZ: 0, headX: -0.75, headY: 0,
      shRX: -2.82, shRZ: 0.39, elR: 0, stretch: 1.6, hoR: 0.8, hsR: 0.6, shLX: -2.8, shLZ: 0.46, elL: -0.1, hoL: 0.8, hsL: 0.6,
      thLX: 0.5, thLZ: 0.12, knL: 0.1, thRX: 0.35, thRZ: 0.12, knR: 0.15, anL: 0.5, anR: 0.5, toL: 0.3, toR: 0.3 });
    const F = ctx.P({ hipsRX: 1.4, hipsY: 0.3, hipsRY: 0, hipsZ: 0, torsoX: 0.12, torsoY: 0, torsoZ: 0, headX: -1.15, headY: 0,
      shLX: -2.95, shLZ: 0.18, elL: -0.06, shRX: -2.95, shRZ: 0.12, elR: -0.04, stretch: 0.5, hoL: 0, hoR: 0,
      thLX: 0.12, thLZ: 0.08, knL: 0.15, thRX: 0.18, thRZ: 0.08, knR: 0.35, anL: 0.4, anR: 0.4 });
    const F2 = Object.assign({ ...F }, { stretch: 0, torsoZ: Math.sin(t * 8) * 0.15, hipsRZ: Math.sin(t * 8) * 0.1 });
    // 下降：腿往前收到身體下面、右拳舉過頭準備砸地
    const Pre = ctx.P({ hipsRX: 0.25, hipsY: 0.1, hipsRY: 0, hipsZ: 0, torsoX: 0.35, torsoY: -0.2, torsoZ: 0, headX: -0.5, headY: 0.1,
      shRX: -2.7, shRZ: 0.6, elR: -1.2, stretch: 0, hoR: 0, shLX: -0.9, shLZ: 1.1, elL: -0.4, hoL: 0.6,
      thLX: -1.25, thLZ: 0.45, knL: 1.6, thRX: -0.9, thRZ: 0.45, knR: 1.7, anL: 0, anR: 0 });
    const Land = pose(ctx, { hipsRX: 0.3, hipsRY: 0, torsoX: 0.55, torsoY: 0, torsoZ: 0, headX: -0.55, shRX: -2.4, shRZ: 0.55, elR: -1.0, stretch: 0, hoR: 0,
      shLX: 0.35, shLZ: 1.15, elL: -0.5, hoL: 0.5, thLX: -1.3, thLZ: 0.6, knL: 1.75, thRX: -0.9, thRZ: 0.6, knR: 1.55 });
    const Slam = pose(ctx, { hipsRX: 0.3, hipsRY: 0, torsoX: 0.75, torsoY: 0.15, torsoZ: 0, headX: -0.6, shRX: -1.5, shRZ: 0.52, elR: -0.1, stretch: 0, hoR: 0, clR: 0.4,
      shLX: 0.45, shLZ: 1.25, elL: -0.4, hoL: 0.7, thLX: -1.35, thLZ: 0.62, knL: 2.0, thRX: -0.95, thRZ: 0.62, knR: 1.8 });
    // 0.40 腳一碰地就砸下去，Slam 撐到 0.45 的爆炸
    return own(track(t, [[0, L], [0.04, L], [0.1, F, 'snap'], [0.24, F2], [0.32, Pre], [0.37, Land], [0.4, Slam, 'in'], [0.45, Slam]]));
  },

  // E 二檔：壓低成蹲踞、左拳撐地、頭抬起盯著前方，雙腿像幫浦一樣用力踩兩下（整個人一沉一起、胸口跟著壓），
  // 0.28 秒後站回架式（蒸氣由特效負責）
  charge_E(ctx) {
    const t = ctx.t;
    const G2 = (k) => pose(ctx, { hipsRX: 0.35 + 0.15 * k, hipsRY: 0.15, torsoX: 0.7 + 0.25 * k, torsoY: 0.2, torsoZ: -0.1, headX: -1.0 - 0.2 * k,
      shLX: -1.0 - 0.25 * k, shLZ: 0.3, elL: -0.5 + 0.4 * k, wrL: 0.3, hoL: 0, clL: 0.3,
      shRX: 0.45, shRZ: 0.75, elR: -0.7 - 0.5 * k, hoR: 0,
      thLX: -1.25 - 0.25 * k, thLZ: 0.7, knL: 1.15 + 0.75 * k, thRX: -0.9 - 0.25 * k, thRZ: 0.75, knR: 0.95 + 0.7 * k }, 0.05 * (1 - k));
    const Up = G2(0), Down = G2(1);
    return own(track(t, [[0, ctx.base], [0.07, Down], [0.11, Up], [0.16, Down, 'in'], [0.2, Up], [0.25, Down, 'in'], [0.29, Down], [0.35, ctx.base]]));
  },

  // R 巨人手槍・前段：咬住右手拇指吹氣（手肘往外上方抬、上身後仰，胸口慢慢一鼓一縮），再把變大的手臂舉到右後上方、左手瞄準
  charge_R(ctx) {
    const t = ctx.t, puff = Math.sin(t * 11);
    const Bite = pose(ctx, { hipsRY: 0, torsoX: -0.3 + 0.12 * puff, torsoY: 0.3, torsoZ: 0, headX: -0.25 - 0.06 * puff, shRX: -1.9, shRZ: 0.9, elR: -2.6, wrR: -0.3, hoR: 0.35, hsR: 1,
      shLX: 0.15, shLZ: 0.75, elL: -1.0, hoL: 0, thLX: -0.25, thLZ: 0.48, knL: 0.55 - 0.08 * puff, thRX: 0.25, thRZ: 0.48, knR: 0.5 - 0.08 * puff, headY: -0.1 }, 0.03 * puff);
    const Wind = pose(ctx, GIGANT_WIND);
    return own(track(t, [[0, ctx.base], [0.08, Bite], [0.26, Bite], [0.4, Wind, 'snap'], [0.5, Wind]]));
  },

  // R 巨人手槍・出拳（pierceWave 的 cast，0.14 秒射出巨拳）：從右後上方的巨臂再擰深一點蓄力，
  // 然後整個人扭轉弓步，手臂從頭頂劈過來筆直轟出（拉長 1.8 倍）；收的時候先在水平高度縮短再回架式
  cast_R(ctx) {
    const W = pose(ctx, GIGANT_WIND);
    const M = pose(ctx, { ...GIGANT_WIND, hipsRY: -0.45, torsoY: -1.0, torsoX: 0.2, torsoZ: 0.2, shRX: -2.89, shRZ: 1.09, elR: -0.5, stretch: 1.0,
      knL: 1.3, knR: 0.95, thLX: -0.85 });
    const S = pose(ctx, { hipsRY: 0.4, torsoY: 0.75, torsoX: 0.3, torsoZ: -0.08, shRX: -1.49, shRZ: 1.99, elR: 0, stretch: 1.8, clR: 0.5, hoR: 0, wrR: 0,
      shLX: 0.65, shLZ: 0.5, elL: -1.0, hoL: 0.3, hsL: 0.3, wrL: 0, headX: -0.3,
      thLX: -1.0, thLZ: 0.36, knL: 1.1, thRX: 0.85, thRZ: 0.36, knR: 0.1, hipsZ: 0.32 });
    // 拳頭要在 0.14 秒（巨拳射出）前就轉到正前方：畫面跟隨有約 30 ms 延遲，所以 S 放在 0.09
    return own(track(ctx.t, [[0, W], [0.025, W], [0.06, M, 'in'], [0.09, S, 'snap'], [0.22, S], [0.255, snapBack(S), 'in'], [0.32, ctx.base]]));
  },

  // 勝利：左手從側面壓住草帽帽簷、右拳舉高（離開帽子），仰頭朝鏡頭大笑「嘻嘻嘻」一抖一抖
  win(ctx) {
    const t = ctx.t, b = Math.abs(Math.sin(t * 7));
    return pose(ctx, { hipsRY: 0, torsoX: -0.2 + 0.05 * b, torsoY: 0.1, torsoZ: 0, headX: -0.35 + 0.08 * b, shLX: -1.56, shLZ: 1.02, elL: -2.15, hoL: 0.6, hsL: 0.4,
      shRX: -2.9, shRZ: 0.55, elR: -0.3 - 0.25 * b, hoR: 0, thLX: -0.15, thLZ: 0.4, knL: 0.25 + 0.15 * b, thRX: 0.1, thRZ: 0.4, knR: 0.25 + 0.15 * b });
  },
};
