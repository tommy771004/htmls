// sakura（春野櫻）的專屬動作：綱手直傳的怪力體術。
// 普攻：左刺拳 → 右手大擺拳（水平弧線的勾拳，全身扭轉）→ 痛天腳（高舉腳跟往下劈）。
// Q 櫻花衝：右拳舉過頭再整個人壓下去捶地；W 怪力衝拳：壓低衝刺、撞上時一記全身右直拳；
// E 醫療忍術：雙掌併攏前伸發綠光；R 天之拳：跳起拉弓、從空中拳頭朝下砸落，落地大開深蹲、拳頭打進兩腳前的地面。
// 鍵見 ../pose-kit.js；符號慣例見 models.js 的 heroPose（torsoX + 前傾、sh*X 負往前上舉、el* 負彎肘、th*X 負抬腿、kn* 正彎膝）。
// 手臂的旋轉順序是 X·Y·Z：sh*Z 先把手臂往側面抬，sh*Y 再讓抬起的手臂水平前後擺，sh*X 最後整個往前上舉；
// 所以手臂側平舉（sh*Z≈1.5）時手肘的彎曲面是水平的（勾拳），再加 sh*X≈−1.6 彎曲面就轉成垂直（秀肌肉）。
import { lerpPose, ease, clamp, IMPACT } from '../pose-kit.js';

const own = (p) => { p.ownHands = true; return p; }; // 自己決定手形，不讓 models.js 的 HAND_OPEN 蓋掉
// 分段關鍵幀：frames = [[時間, 姿勢, 緩動?], …]。預設 smoothstep；'in' 是越來越快（打中那一段用，命中瞬間不減速）
const EASE = { in: (u) => u * u * (2 - u), lin: (u) => u };
function keys(t, frames) {
  if (t <= frames[0][0]) return lerpPose(frames[0][1], frames[0][1], 0);
  for (let i = 1; i < frames.length; i++) {
    const [t1, b, e] = frames[i], [t0, a] = frames[i - 1];
    if (t < t1) return lerpPose(a, b, (EASE[e] || ease)((t - t0) / (t1 - t0)));
  }
  const last = frames[frames.length - 1][1];
  return lerpPose(last, last, 0);
}
// 命中後順勢多送一點（只送上半身：腳和骨盆不動，才不會把腳踩進地裡）
const UPPER = ['torsoX', 'torsoY', 'torsoZ', 'headX', 'headY', 'shLX', 'shLY', 'shLZ', 'elL', 'shRX', 'shRY', 'shRZ', 'elR', 'clL', 'clR'];
function over(W, S, k) { const o = { ...S }; for (const key of UPPER) o[key] = S[key] + (S[key] - W[key]) * k; return o; }

// 讓腳踩在地上：依骨盆高度與大腿角度算膝蓋彎度（大腿 0.5L、小腿 0.44L，直立時腳踝離地 0.06L）
function knee(d, thX, hipsY, hipsRX = 0, thZ = 0) {
  const L = d.L, A = thX + hipsRX;
  const D = (0.94 * L + hipsY) / Math.cos(thZ);
  const c = clamp((D - 0.5 * L * Math.cos(A)) / (0.44 * L), -1, 1);
  return Math.max(0, Math.acos(c) - A);
}
// 指定的腳（'L'、'R' 或 'LR'）踩實：覆寫膝蓋彎度
// lift：深蹲時公式會讓腳略為陷進地面，多彎一點膝蓋把腳抬回地面
function plant(d, p, which = 'LR', lift = 0) {
  for (const s of which) p['kn' + s] = knee(d, p['th' + s + 'X'], p.hipsY - lift, p.hipsRX, p['th' + s + 'Z']);
  return p;
}

export default {
  // 架式：拳擊式高架，左拳在前護臉、右拳收在下巴旁蓄力，重心壓低、前腳虛點，肩膀隨呼吸起伏
  stance({ t, d }) {
    const br = Math.sin(t * 2.6), bob = Math.sin(t * 5.2) * 0.5 + 0.5;
    return own(plant(d, {
      hipsY: -0.08 - 0.012 * br - 0.015 * bob, hipsZ: 0, hipsRX: 0.04, hipsRY: -0.3, hipsRZ: 0.02,
      torsoX: 0.16 + 0.015 * br, torsoY: -0.25, torsoZ: -0.03, headX: -0.1, headY: 0.45, headZ: 0,
      shLX: -1.4, shLY: 0, shLZ: 0.2, elL: -1.75, shRX: -0.95, shRY: 0, shRZ: 0.32, elR: -2.3,
      thLX: -0.45, thLZ: 0.16, knL: 0.5, thRX: 0.3, thRZ: 0.18, knR: 0.6,
      spin: 0, stretch: 0, wrL: 0, wrR: 0, anL: 0, anR: 0, clL: 0, clR: 0,
      hoL: 0, hoR: 0, hsL: 0, hsR: 0, toL: 0, toR: 0, prop: 0,
    }));
  },

  // 一段：左刺拳，前腳踏出，左肩送出去（打中 0.1 秒）
  atk1({ t, P, base, d }) {
    const W = plant(d, P({ torsoY: 0.0, hipsRY: -0.15, shLX: -1.0, shLZ: 0.3, elL: -2.3, hipsY: -0.13, hipsZ: -0.03, headY: 0.25 }));
    const S = plant(d, P({ torsoY: -0.35, hipsRY: -0.3, torsoX: 0.3, shLX: -1.6, shLZ: 0.55, elL: -0.03, clL: 0, shRX: -1.0, shRZ: 0.25, elR: -2.35,
      hipsZ: 0.2, hipsY: -0.13, thLX: -0.85, thLZ: 0.2, thRX: 0.6, thRZ: 0.18, anR: 0.3, headY: 0.65, headX: -0.12 }));
    return own(keys(t, [[0, base], [0.055, W], [0.1, S, 'in'], [0.14, over(W, S, 0.06)], [0.18, S], [0.3, base]]));
  },

  // 二段：右手大擺拳（勾拳）——上身往右後擰緊、右拳拉到屁股後面，再由髖帶肩轉過來，
  // 手肘彎著讓拳頭走水平大弧線，收在身體中線前方、頭的高度；後腳跟蹬起（打中 0.12 秒）
  atk2({ t, P, base, d }) {
    const W = plant(d, P({ torsoY: -0.95, hipsRY: -0.55, torsoX: 0.12, shRX: 0.9, shRY: 0, shRZ: 0.35, elR: -1.0, shLX: -1.4, shLZ: 0.25, elL: -1.6,
      hipsY: -0.12, hipsZ: -0.05, headY: 0.85 }));
    const S = plant(d, P({ torsoY: 0.8, hipsRY: 0.45, torsoX: 0.3, torsoZ: -0.1, shRX: -0.41, shRY: 0.92, shRZ: 1.88, elR: -1.8, clR: 0,
      shLX: 0.2, shLZ: 0.5, elL: -1.9, hipsZ: 0.22, hipsY: -0.14, thLX: -0.8, thLZ: 0.22, thRX: 0.6, thRZ: 0.16, anR: 0.4, headY: -0.6, headX: -0.1 }));
    return own(keys(t, [[0, base], [0.055, W], [0.105, S, 'in'], [0.145, over(W, S, 0.06)], [0.2, S], [0.36, base]]));
  },

  // 三段：痛天腳——右腳高舉過頭（身體後仰、雙臂張開平衡），腳跟往前方地面劈下，
  // 腳跟剛好踩在地上、上身深深壓下去（實際傷害在 0.2 秒：舉腿要撐住約 65 毫秒才舉得過頭，腳跟落地對準 0.2 秒）
  atk3({ t, P, base, d }) {
    const W = P({ hipsRX: -0.25, torsoX: -0.45, torsoY: 0.1, hipsRY: 0.1, thRX: -2.6, thRZ: 0.1, knR: 0.05, thLX: 0.15, knL: 0.3, hipsY: 0.02,
      shLX: -0.4, shLZ: 1.1, elL: -0.6, shRX: -0.3, shRZ: 1.0, elR: -0.7, headX: 0.15, headY: -0.2, anR: 0.3 });
    const S = plant(d, P({ hipsRX: 0.2, torsoX: 0.55, torsoY: 0.1, hipsRY: 0.1, thRX: -1.0, thRZ: 0.08, thLX: 0.35, thLZ: 0.14, hipsY: -0.16, hipsZ: 0.22,
      shLX: 0.2, shLZ: 0.9, elL: -0.7, shRX: 0.4, shRZ: 0.8, elR: -0.8, headX: -0.3, headY: -0.1, anR: -0.3 }));
    return own(keys(t, [[0, base], [0.07, W], [0.135, W], [0.18, S, 'in'], [0.21, over(W, S, 0.06)], [0.3, S], [0.46, base]]));
  },

  // Q 櫻花衝（0.45 秒，0.22 秒捶地）：右拳舉過頭撐住、身體拉長 → 整個人往前壓下，拳頭直直打進前方地面（落地對準 0.22 秒的坑）
  // 前腳弓步、小腿直立（骨盆不壓太低，免得前膝跪下去）
  overhead_Q({ t, P, base, d }) {
    const W = P({ hipsY: 0.04, hipsRX: -0.12, torsoX: -0.4, torsoY: -0.35, hipsRY: -0.1, headX: -0.3, headY: 0.35,
      shRX: -2.9, shRZ: 0.7, elR: -1.5, shLX: -1.1, shLZ: 0.2, elL: -0.15, hoL: 0.9, hsL: 0,
      thLX: -0.95, thLZ: 0.15, knL: 1.25, thRX: 0.15, knR: 0.25, anR: 0.2 });
    const S = plant(d, P({ hipsY: -0.32, hipsRX: 0.12, hipsZ: 0.32, torsoX: 1.2, torsoY: 0.2, hipsRY: 0.1, headX: -0.7, headY: -0.2,
      shRX: -1.45, shRY: 0.06, shRZ: 0.5, elR: 0, clR: 0.3, shLX: 0.5, shLZ: 0.65, elL: -0.9,
      thLX: -1.4, thLZ: 0.25, thRX: 0.75, thRZ: 0.15 }), 'LR', 0.03);
    return own(keys(t, [[0, base], [0.09, W], [0.15, W], [0.195, S, 'in'], [0.23, over(W, S, 0.05)], [0.34, S], [0.45, base]]));
  },

  // W 怪力衝拳（衝刺中）：上身壓低往前衝，右拳拉到腰後蓄力，左手在前開路，雙腿真正交替跨步
  dash_W({ t, P }) {
    const s = Math.sin(t * 28), c = Math.cos(t * 28);
    return own(P({ hipsY: -0.1 + 0.04 * Math.abs(c), hipsRX: 0.35, torsoX: 0.45, torsoY: -0.3, hipsRY: -0.1, headX: -0.6, headY: 0.25,
      shRX: 0.65, shRZ: 0.35, elR: -1.7, shLX: -1.35, shLZ: 0.15, elL: -0.9,
      thLX: -0.3 - 0.95 * s, thLZ: 0.1, knL: 0.4 + 1.3 * Math.max(0, -c), thRX: -0.3 + 0.95 * s, thRZ: 0.08, knR: 0.4 + 1.3 * Math.max(0, c) }));
  },
  // W 撞上目標（atk3，0.35 秒，接觸當下就打中）：右直拳全伸，前膝深彎、後腳蹬直腳尖點地，整個人送進去
  atk3_W({ t, P, base, d }) {
    const S = plant(d, P({ hipsY: -0.22, hipsRX: 0.15, hipsZ: 0.3, torsoX: 0.4, torsoY: 0.55, hipsRY: 0.35, headX: -0.15, headY: -0.65,
      shRX: -1.95, shRZ: 0.6, elR: -0.02, clR: 0, shLX: 0.45, shLZ: 0.4, elL: -1.9,
      thLX: -1.0, thLZ: 0.2, thRX: 0.7, thRZ: 0.15, anR: 0.5 }), 'LR', 0.02);
    const W = plant(d, P({ torsoY: -0.2, shRX: 0.5, shRZ: 0.35, elR: -1.6, hipsZ: 0.05, hipsY: -0.16, torsoX: 0.4 }));
    // 衝刺中（dash_W）已經看得到拉弓，撞上的瞬間就從大半出拳開始，拳頭和火花同時到
    return own(keys(t, [[0, lerpPose(W, S, 0.6)], [0.025, S, 'in'], [0.07, over(W, S, 0.05)], [0.2, S], [0.35, base]]));
  },

  // E 醫療忍術（0.4 秒）：微蹲前傾、低頭專注，雙掌併攏在胸前往前推出（掌心朝下發光），手掌隨查克拉一下一下脈動
  barrier_E({ t, P, base, d }) {
    const pulse = Math.sin(t * 22);
    const S = plant(d, P({ hipsY: -0.12, hipsRX: 0.1, torsoX: 0.35, torsoY: -0.1, hipsRY: 0.05, headX: 0.35, headY: 0.05,
      shLX: -1.35 + 0.05 * pulse, shLY: -0.35, shLZ: -0.25, elL: -0.5, clL: -0.15, shRX: -1.35 + 0.05 * pulse, shRY: 0.35, shRZ: -0.25, elR: -0.5, clR: -0.15,
      wrL: -0.3 + 0.1 * pulse, wrR: -0.3 + 0.1 * pulse, hoL: 1, hoR: 1, hsL: 0.3, hsR: 0.3,
      thLX: -0.45, thLZ: 0.22, thRX: 0.25, thRZ: 0.2 }));
    return own(keys(t, [[0, base], [0.1, S], [0.4, S]]));
  },

  // R 天之拳（跳躍 0.75 秒，0.7 秒落地）：起跳拉長 → 空中拉弓（右拳舉到頭側後方、左手指向落點、雙腿收起）
  // → 下墜時上身前傾、右拳斜朝下 → 落地前雙腿收到身體下面
  air_R({ t, P, d }) {
    const up = P({ hipsY: 0.05, hipsRX: -0.15, torsoX: -0.25, torsoY: 0.1, headX: -0.4, headY: -0.1,
      shRX: -2.6, shRZ: 0.4, elR: -0.6, shLX: -2.4, shLZ: 0.5, elL: -0.4,
      thLX: 0.2, thLZ: 0.1, knL: 0.4, thRX: 0.35, thRZ: 0.1, knR: 0.6 });
    const cock = P({ hipsY: 0.05, hipsRX: -0.35, torsoX: -0.45, torsoY: -0.55, headX: -0.4, headY: 0.4,
      shRX: -2.55, shRZ: 1.3, elR: -1.0, shLX: -0.9, shLZ: 0.4, elL: -0.1, clL: -0.2, hoL: 0.9, hsL: 0,
      thLX: -1.2, thLZ: 0.2, knL: 1.9, thRX: -0.3, thRZ: 0.15, knR: 1.8 });
    const dive = P({ hipsY: 0.05, hipsRX: 0.6, torsoX: 0.9, torsoY: 0.35, headX: -0.85, headY: -0.2,
      shRX: -1.3, shRZ: 0.05, elR: -0.05, clR: 0.3, shLX: 0.4, shLZ: 0.9, elL: -0.5, hoL: 1, hsL: 0.3,
      thLX: 0.25, thLZ: 0.2, knL: 1.4, thRX: 0.5, thRZ: 0.15, knR: 1.0 });
    const land = plant(d, P({ hipsY: -0.2, hipsRX: 0.3, torsoX: 0.9, torsoY: 0.25, headX: -0.75, headY: -0.15,
      shRX: -1.3, shRZ: 0.3, elR: -0.02, clR: 0.3, shLX: 1.2, shLZ: 0.5, elL: -0.3, hoL: 1, hsL: 0.3,
      thLX: -0.5, thLZ: 0.5, thRX: -0.3, thRZ: 0.45 }), 'LR', 0.04);
    return own(keys(t, [[0, up], [0.12, up], [0.32, cock], [0.46, cock], [0.6, dive, 'in'], [0.68, land], [0.75, land]]));
  },
  // R 落地（atk3，0.4 秒，落地瞬間已造成傷害）：雙腿大開深蹲著地，右拳打進兩腳前方的地面，左臂往後上方甩開
  // air_R 的 land 已經把拳頭壓低，這裡一開始就是打進地面的姿勢，坑和拳頭同一格出現
  atk3_R({ t, P, base, d }) {
    const S = plant(d, P({ hipsY: -0.44, hipsRX: 0.45, hipsZ: 0.05, hipsRY: 0, torsoX: 0.95, torsoY: 0.2, headX: -0.8, headY: -0.1,
      shRX: -1.53, shRY: -0.22, shRZ: 0.58, elR: 0, clR: 0.25, shLX: 1.5, shLZ: 0.4, elL: -0.2, hoL: 1, hsL: 0.3,
      thLX: -1.1, thLZ: 0.8, thRX: -0.55, thRZ: 0.75 }), 'LR', 0.09);
    return own(keys(t, [[0, S], [0.26, S], [0.4, base]]));
  },

  // 勝利：「しゃーんなろー！」左拳叉腰（手肘往外）、右臂側平舉、前臂直立秀出二頭肌，身體一頓一頓
  win({ t, P }) {
    const b = Math.abs(Math.sin(t * 4));
    return own(P({ hipsY: -0.03 + 0.02 * b, hipsRY: -0.1, hipsRZ: 0.05, torsoX: -0.05, torsoY: 0.2, torsoZ: -0.06, headX: -0.2, headY: -0.1, headZ: 0.08,
      shLX: 1.3, shLY: -0.8, shLZ: 1.39, elL: -1.28, hoL: 0, hsL: 0,
      shRX: -1.63, shRY: 0, shRZ: 1.71 - 0.05 * b, elR: -1.22 - 0.25 * b, hoR: 0, hsR: 0,
      thLX: -0.12, thLZ: 0.18, knL: 0.12, thRX: 0.12, thRZ: 0.16, knR: 0.2 }));
  },
};
