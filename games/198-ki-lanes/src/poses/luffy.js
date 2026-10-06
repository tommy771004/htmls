// luffy 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（strike、lerpPose、ease、clamp、IMPACT…）。
//
// 魯夫的動作語彙：大開步、膝蓋鬆、整個人像彈簧一樣上下彈；出拳前手臂往後「拉長」再彈回來（stretch 只作用在右臂）。
// 招式對應（combat.js 的 KITS.luffy）：
//   Q 橡膠槍       → grab（0.5 秒，一出手就射出拳頭）          → grab_Q
//   W 橡膠火箭     → dash（0.45 秒，拋物線飛到落點、落地衝擊）  → dash_W
//   E 二檔         → charge（0.35 秒）                          → charge_E
//   R 巨人手槍     → charge（0.5 秒，咬拇指吹氣＋把巨臂甩到身後）→ charge_R，接著 pierceWave 的 cast（0.32 秒，0.14 秒出拳；沒有技能鍵）→ cast
//
// 手臂方向的算法：胸口朝向 c = hipsRY + torsoY（正值＝右肩往前）。手臂水平（sh*X ≈ -1.57）時，
// sh*Z 是相對胸口往外擺的角度，所以右手要指向正前方 shRZ ≈ c、左手 shLZ ≈ -c；往外擺得比 c 多就是指向身後。
import { strike, lerpPose, ease, clamp, blank } from '../pose-kit.js';

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

// 巨人手槍的蓄力終點（charge_R 的最後一格，也是 cast 的起點，前後要接得起來）：
// 上身擰到右肩在後，巨臂往右後方拉長舉起，左手張開瞄準
const GIGANT_WIND = { hipsRY: -0.35, torsoY: -0.75, torsoX: 0.22, torsoZ: 0.12, shRX: -1.85, shRZ: 1.55, elR: -0.12, stretch: 0.8, hoR: 0,
  shLX: -1.5, shLZ: 1.0, elL: -0.12, hoL: 0.85, hsL: 0.6, thLX: -0.6, thLZ: 0.45, knL: 0.95, thRX: 0.45, thRZ: 0.45, knR: 0.6, hipsZ: -0.1 };

export default {
  // 架式：大開步半蹲、上身前傾駝背，像橡皮球一樣一直上下彈；前手（左）鬆鬆握在胸前、右拳垂在腰邊隨時甩出去
  stance(ctx) {
    const t = ctx.t;
    const b = 0.5 - 0.5 * Math.cos(t * 5.2); // 彈跳 0～1
    const sway = Math.sin(t * 1.3);
    const p = Object.assign(blank(), {
      hipsRY: -0.08, hipsRZ: 0.03 * sway, hipsRX: 0.04,
      torsoX: 0.3 - 0.05 * b, torsoY: -0.08 + 0.06 * sway, torsoZ: -0.03, headX: -0.3 + 0.04 * b,
      shLX: -0.85 - 0.12 * b, shLZ: 0.42, elL: -1.35 + 0.1 * b, wrL: 0.15,
      shRX: -0.2 + 0.1 * b, shRZ: 0.5, elR: -1.0, wrR: 0.1,
      thLX: -0.36, thLZ: 0.42, knL: 0.72 - 0.15 * b,
      thRX: 0.28, thRZ: 0.42, knR: 0.62 - 0.14 * b,
      hoL: 0.12, hoR: 0.08, hsL: 0.2, hsR: 0.2,
    });
    return look(plant(ctx.d, p), 0.05);
  },

  // 普攻一：左手刺拳。左肩送出去、前腳踏一小步，右拳收在腰邊
  atk1(ctx) {
    const W = pose(ctx, { torsoY: 0.35, hipsRY: 0.15, torsoX: 0.26, shLX: -0.6, shLZ: 0.3, elL: -2.15, shRX: -0.55, shRZ: 0.4, elR: -1.7,
      thLX: -0.3, knL: 0.85, thRX: 0.3, knR: 0.8, hipsZ: -0.04 });
    const S = pose(ctx, { torsoY: -0.65, hipsRY: -0.3, torsoX: 0.36, shLX: -1.6, shLZ: 0.88, elL: -0.03, clL: 0.35, hoL: 0,
      shRX: 0.2, shRZ: 0.35, elR: -1.95, hipsZ: 0.2,
      thLX: -0.72, thLZ: 0.36, knL: 0.82, thRX: 0.6, thRZ: 0.38, knR: 0.22 });
    return strike(ctx.t, 0.1, ctx.base, W, S, 0.3);
  },

  // 普攻二：橡膠鞭臂。右手甩到身後拉長，上身與骨盆整個扭回來，長手臂由右往左橫掃過去
  atk2(ctx) {
    const W = pose(ctx, { torsoY: -0.85, hipsRY: -0.35, torsoX: 0.22, torsoZ: 0.08, shRX: -1.35, shRZ: 1.45, elR: -0.3, stretch: 0.6, hoR: 0,
      shLX: -1.2, shLZ: 0.7, elL: -1.5, thLX: -0.4, knL: 0.9, thRX: 0.32, knR: 0.8, hipsZ: -0.04 });
    const S = pose(ctx, { torsoY: 0.85, hipsRY: 0.35, torsoX: 0.3, torsoZ: -0.12, shRX: -1.5, shRZ: 1.1, elR: -0.04, stretch: 1.4, clR: 0.35, hoR: 0,
      shLX: 0.45, shLZ: 0.55, elL: -1.2, hipsZ: 0.16,
      thLX: -0.72, thLZ: 0.4, knL: 0.85, thRX: 0.6, thRZ: 0.4, knR: 0.2 });
    return strike(ctx.t, 0.12, ctx.base, W, S, 0.34);
  },

  // 普攻三：橡膠火箭砲（Bazooka）。上身前壓、兩手往後甩到底，弓步衝出雙掌並排推出
  atk3(ctx) {
    const W = pose(ctx, { torsoY: 0, hipsRY: 0, torsoX: 0.6, headX: -0.5, shLX: 1.1, shLZ: 0.3, elL: -0.2, shRX: 1.1, shRZ: 0.3, elR: -0.2, stretch: 0.35,
      hoL: 0.9, hoR: 0.9, hsL: 0.7, hsR: 0.7, thLX: -0.6, thLZ: 0.42, knL: 1.15, thRX: 0.3, thRZ: 0.42, knR: 1.0, hipsZ: -0.08 });
    const S = pose(ctx, { torsoY: 0, hipsRY: 0, torsoX: 0.3, headX: -0.15, shLX: -1.5, shLZ: -0.1, elL: -0.04, shRX: -1.5, shRZ: -0.1, elR: -0.04, stretch: 0,
      wrL: -0.9, wrR: -0.9, clL: 0.45, clR: 0.45, hoL: 1, hoR: 1, hsL: 0.85, hsR: 0.85,
      thLX: -1.0, thLZ: 0.3, knL: 1.05, thRX: 0.8, thRZ: 0.3, knR: 0.12, hipsZ: 0.32 });
    return strike(ctx.t, 0.16, ctx.base, W, S, 0.42);
  },

  // Q 橡膠槍：右臂往右後方拉長、上身擰到底（左手指著目標），收肘蓄彈，再整個人轉回來把拳頭射出去；
  // 手臂拉到最長、等拳頭飛遠後才彈回來
  grab_Q(ctx) {
    const W = pose(ctx, { hipsRY: -0.3, torsoY: -0.7, torsoX: 0.24, shRX: -1.4, shRZ: 1.5, elR: -0.08, stretch: 1.35, hoR: 0,
      shLX: -1.5, shLZ: 1.0, elL: -0.15, hoL: 0.65, hsL: 0.5, thLX: -0.48, knL: 0.9, thRX: 0.38, knR: 0.65, hipsZ: -0.06 });
    const M = pose(ctx, { hipsRY: 0, torsoY: 0, torsoX: 0.3, shRX: -1.45, shRZ: 0.45, elR: -1.5, stretch: 0.15, hoR: 0,
      shLX: -0.6, shLZ: 0.6, elL: -1.4, thLX: -0.6, knL: 0.85, thRX: 0.5, knR: 0.4, hipsZ: 0.08 });
    const S = pose(ctx, { hipsRY: 0.32, torsoY: 0.7, torsoX: 0.34, shRX: -1.57, shRZ: 1.0, elR: 0, stretch: 2.6, clR: 0.45, hoR: 0,
      shLX: 0.55, shLZ: 0.5, elL: -0.95, thLX: -0.8, thLZ: 0.4, knL: 0.92, thRX: 0.66, thRZ: 0.4, knR: 0.16, hipsZ: 0.22 });
    const back = pose(ctx, { hipsRY: 0.15, torsoY: 0.3, shRX: -1.0, shRZ: 0.5, elR: -1.0, stretch: 0.15, shLX: -0.4, elL: -1.2, hipsZ: 0.08 });
    // 拳頭在第一格就射出去了（橡皮手臂的特效同時拉出），所以蓄力壓得很短，重點放在拉到最長的停格
    const p = track(ctx.t, [[0, ctx.base], [0.04, W], [0.065, M, 'in'], [0.095, S, 'snap'], [0.3, S], [0.42, back, 'in'], [0.5, ctx.base]]);
    p.ownHands = true; // 右手保持握拳（不套共用的張手）
    return p;
  },

  // W 橡膠火箭：先蹲低、右手伸長「抓住」落點，接著整個人打平飛過去（雙手在前、腿併攏在後），最後屈膝落地、右拳砸地
  dash_W(ctx) {
    const t = ctx.t;
    const L = pose(ctx, { torsoY: 0, hipsRY: 0, torsoX: 0.55, headX: -0.55, shLX: -2.2, shLZ: 0.25, elL: -0.2, shRX: -2.3, shRZ: 0.1, elR: -0.05, stretch: 1.6,
      hoL: 0.8, hoR: 0.8, hsL: 0.6, hsR: 0.6, thLX: -0.75, thLZ: 0.4, knL: 1.5, thRX: -0.25, thRZ: 0.4, knR: 1.45 });
    const F = ctx.P({ hipsRX: 1.4, hipsY: 0.3, hipsRY: 0, torsoX: 0.12, torsoY: 0, torsoZ: 0, headX: -1.15, headY: 0,
      shLX: -2.95, shLZ: 0.18, elL: -0.06, shRX: -2.95, shRZ: 0.12, elR: -0.04, stretch: 0.9, hoL: 0, hoR: 0,
      thLX: 0.12, thLZ: 0.08, knL: 0.15, thRX: 0.18, thRZ: 0.08, knR: 0.35, anL: 0.4, anR: 0.4 });
    const F2 = Object.assign({ ...F }, { stretch: 0.2, torsoZ: Math.sin(t * 24) * 0.05 });
    const Land = pose(ctx, { hipsRX: 0.35, torsoX: 0.6, torsoY: 0.1, headX: -0.55, shLX: 0.35, shLZ: 1.15, elL: -0.5, shRX: -0.95, shRZ: 0.2, elR: -0.08, stretch: 0, hoL: 0.5, hoR: 0,
      thLX: -1.3, thLZ: 0.6, knL: 1.75, thRX: -0.9, thRZ: 0.6, knR: 1.55 });
    return track(t, [[0, ctx.base], [0.05, L], [0.12, F, 'snap'], [0.26, F2], [0.36, Land], [0.45, Land]]);
  },

  // E 二檔：壓低成蹲踞、左拳撐地，雙腿像幫浦一樣快速一壓一壓把血打快（蒸氣由特效負責）
  charge_E(ctx) {
    const t = ctx.t, pump = Math.sin(t * 26);
    const G2 = pose(ctx, { hipsRX: 0.45, hipsRY: 0.15, torsoX: 0.85, torsoY: 0.2, torsoZ: -0.1, headX: -1.15,
      shLX: -1.2, shLZ: 0.3, elL: -0.1, wrL: 0.3, hoL: 0, clL: 0.3,
      shRX: 0.45, shRZ: 0.75, elR: -0.9, hoR: 0,
      thLX: -1.45, thLZ: 0.7, knL: 1.75 - 0.16 * pump, thRX: -1.1, thRZ: 0.75, knR: 1.5 - 0.16 * pump });
    return lerpPose(ctx.base, G2, ease(clamp(t / 0.1, 0, 1)) * (1 - 0.6 * ease(clamp((t - 0.28) / 0.07, 0, 1)))); // 最後 0.07 秒開始站起來
  },

  // R 巨人手槍・前段：咬住右手拇指吹氣（上身後仰、胸口鼓起），再把變大的手臂甩到右後方拉長、左手瞄準
  charge_R(ctx) {
    const t = ctx.t, puff = Math.sin(t * 30) * 0.04;
    const Bite = pose(ctx, { hipsRY: 0, torsoX: -0.12 + puff, torsoY: 0.3, headX: -0.15, shRX: -1.05, shRZ: -0.45, elR: -2.45, hoR: 0.35, hsR: 1, wrR: -0.2,
      shLX: 0.15, shLZ: 0.75, elL: -1.0, hoL: 0, thLX: -0.25, thLZ: 0.48, knL: 0.55, thRX: 0.25, thRZ: 0.48, knR: 0.5, headY: -0.1 });
    const Wind = pose(ctx, GIGANT_WIND);
    return track(t, [[0, ctx.base], [0.08, Bite], [0.24, Bite], [0.4, Wind, 'snap'], [0.5, Wind]]);
  },

  // R 巨人手槍・出拳（pierceWave 的 cast，0.14 秒射出巨拳）：從右後方的巨臂收肘、整個人扭轉弓步轟出
  cast(ctx) {
    const W = pose(ctx, GIGANT_WIND);
    const M = pose(ctx, { hipsRY: 0, torsoY: 0, torsoX: 0.3, shRX: -1.5, shRZ: 0.5, elR: -1.3, stretch: 0.3, hoR: 0,
      shLX: -0.5, shLZ: 0.6, elL: -1.3, hoL: 0.4, thLX: -0.8, thLZ: 0.4, knL: 1.0, thRX: 0.6, thRZ: 0.4, knR: 0.4, hipsZ: 0.12 });
    const S = pose(ctx, { hipsRY: 0.4, torsoY: 0.75, torsoX: 0.36, torsoZ: -0.08, shRX: -1.57, shRZ: 1.15, elR: 0, stretch: 1.8, clR: 0.5, hoR: 0,
      shLX: 0.65, shLZ: 0.5, elL: -1.0, hoL: 0.3, thLX: -1.0, thLZ: 0.36, knL: 1.1, thRX: 0.85, thRZ: 0.36, knR: 0.1, hipsZ: 0.32 });
    const p = track(ctx.t, [[0, W], [0.04, W], [0.1, M, 'in'], [0.14, S, 'snap'], [0.22, S], [0.32, lerpPose(S, ctx.base, 0.5)]]);
    p.ownHands = true; // 巨拳是握拳，左手照自己設定
    return p;
  },

  // 勝利：一手按住草帽、一手握拳舉高，仰頭大笑「嘻嘻嘻」一抖一抖
  win(ctx) {
    const t = ctx.t, b = Math.abs(Math.sin(t * 7));
    return pose(ctx, { hipsRY: 0, torsoX: -0.2 + 0.05 * b, torsoY: 0.1, headX: -0.45 + 0.1 * b, shLX: -2.55, shLZ: 0.55, elL: -2.25, hoL: 0.7, hsL: 0.4,
      shRX: -2.95, shRZ: 0.2, elR: -0.3 - 0.25 * b, hoR: 0, thLX: -0.15, thLZ: 0.4, knL: 0.25 + 0.15 * b, thRX: 0.1, thRZ: 0.4, knR: 0.25 + 0.15 * b });
  },
};
