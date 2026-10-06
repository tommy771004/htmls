// sakura（春野櫻）的專屬動作：綱手直傳的怪力體術。
// 普攻：左刺拳 → 右手大擺拳（全身扭轉）→ 痛天腳（高舉腳跟往下劈）。
// Q 櫻花衝：右拳舉過頭再整個人壓下去捶地；W 怪力衝拳：壓低衝刺、撞上時一記全身重拳；
// E 醫療忍術：雙掌前伸發綠光；R 天之拳：跳起拉弓、從空中拳頭朝下砸落，落地單膝跪地拳插地面。
// 鍵見 ../pose-kit.js；符號慣例見 models.js 的 heroPose（torsoX + 前傾、sh*X 負往前上舉、el* 負彎肘、th*X 負抬腿、kn* 正彎膝）。
import { strike, lerpPose, ease, clamp, IMPACT } from '../pose-kit.js';

const own = (p) => { p.ownHands = true; return p; }; // 自己決定手形，不讓 models.js 的 HAND_OPEN 蓋掉
// 分段關鍵幀：frames = [[時間, 姿勢], …]，段內用 ease 內插
function keys(t, frames) {
  if (t <= frames[0][0]) return lerpPose(frames[0][1], frames[0][1], 0);
  for (let i = 1; i < frames.length; i++) {
    const [t1, b] = frames[i], [t0, a] = frames[i - 1];
    if (t < t1) return lerpPose(a, b, ease((t - t0) / (t1 - t0)));
  }
  return lerpPose(frames[frames.length - 1][1], frames[frames.length - 1][1], 0);
}

export default {
  // 架式：拳擊式高架，左拳在前護臉、右拳收在下巴旁蓄力，重心壓低、前腳虛點，肩膀隨呼吸起伏
  stance({ t }) {
    const br = Math.sin(t * 2.6), bob = Math.sin(t * 5.2) * 0.5 + 0.5;
    return own({
      hipsY: -0.1 - 0.012 * br - 0.015 * bob, hipsZ: 0, hipsRX: 0.04, hipsRY: -0.3, hipsRZ: 0.02,
      torsoX: 0.16 + 0.015 * br, torsoY: -0.25, torsoZ: -0.03, headX: -0.1, headY: 0.45, headZ: 0,
      shLX: -1.4, shLY: 0, shLZ: 0.2, elL: -1.75, shRX: -0.95, shRY: 0, shRZ: 0.32, elR: -2.3,
      thLX: -0.45, thLZ: 0.16, knL: 0.5, thRX: 0.3, thRZ: 0.18, knR: 0.6,
      spin: 0, stretch: 0, wrL: 0, wrR: 0, anL: 0, anR: 0, clL: 0, clR: 0,
      hoL: 0, hoR: 0, hsL: 0, hsR: 0, toL: 0, toR: 0,
    });
  },

  // 一段：左刺拳，前腳踏出，左肩送出去
  atk1({ t, P, base }) {
    const W = P({ torsoY: 0.0, hipsRY: -0.15, shLX: -1.0, shLZ: 0.3, elL: -2.3, hipsY: -0.15, knL: 0.65, knR: 0.72, hipsZ: -0.03, headY: 0.25 });
    const S = P({ torsoY: -0.35, hipsRY: -0.3, torsoX: 0.3, shLX: -1.6, shLZ: 0.55, elL: -0.03, clL: 0, shRX: -1.0, shRZ: 0.25, elR: -2.35,
      hipsZ: 0.2, hipsY: -0.15, thLX: -0.85, thLZ: 0.2, knL: 0.72, thRX: 0.6, knR: 0.2, anR: 0.3, headY: 0.65, headX: -0.12 });
    return own(strike(t, IMPACT.atk1, base, W, S, 0.3));
  },

  // 二段：右手大擺拳，先把整個上身往右後擰緊，再用髖帶肩轉過來，後腳跟蹬起
  atk2({ t, P, base }) {
    const W = P({ torsoY: -0.6, hipsRY: -0.35, torsoX: 0.05, shRX: 0.35, shRZ: 0.55, elR: -1.9, shLX: -1.4, shLZ: 0.2, elL: -1.4,
      hipsY: -0.16, knL: 0.7, knR: 0.8, hipsZ: -0.05, headY: 0.55 });
    const S = P({ torsoY: 0.55, hipsRY: 0.35, torsoX: 0.35, torsoZ: -0.08, shRX: -1.55, shRZ: 0.6, elR: -0.05, clR: 0, shLX: 0.3, shLZ: 0.45, elL: -1.9,
      hipsZ: 0.26, hipsY: -0.16, thLX: -0.85, thLZ: 0.22, knL: 0.85, thRX: 0.75, knR: 0.12, anR: 0.4, headY: -0.75, headX: -0.15 });
    return own(strike(t, IMPACT.atk2, base, W, S, 0.36));
  },

  // 三段：痛天腳——右腳高舉過頭（身體後仰平衡），腳跟往前方地面劈下，落地時重心壓到最低
  atk3({ t, P, base }) {
    const W = P({ hipsRX: -0.25, torsoX: -0.35, torsoY: 0.1, hipsRY: 0.1, thRX: -1.9, thRZ: 0.1, knR: 0.15, thLX: 0.15, knL: 0.3, hipsY: 0.02,
      shLX: -0.4, shLZ: 1.1, elL: -0.6, shRX: -0.3, shRZ: 1.0, elR: -0.7, headX: 0.15, headY: -0.2, anR: 0.3 });
    const S = P({ hipsRX: 0.2, torsoX: 0.45, torsoY: 0.1, hipsRY: 0.1, thRX: -0.75, thRZ: 0.08, knR: 0.35, thLX: 0.55, knL: 0.95, hipsY: -0.28, hipsZ: 0.18,
      shLX: 0.2, shLZ: 0.9, elL: -0.7, shRX: 0.4, shRZ: 0.8, elR: -0.8, headX: -0.3, headY: -0.1, anR: -0.2 });
    return own(strike(t, IMPACT.atk3, base, W, S, 0.44));
  },

  // Q 櫻花衝（0.45 秒，0.22 秒捶地）：右拳舉過頭、身體拉長 → 整個人往前壓下，拳頭直直打進前方地面
  overhead_Q({ t, P, base }) {
    const W = P({ hipsY: 0.04, hipsRX: -0.12, torsoX: -0.4, torsoY: -0.35, hipsRY: -0.1, headX: -0.3, headY: 0.35,
      shRX: -2.9, shRZ: 0.3, elR: -1.5, shLX: -1.1, shLZ: 0.2, elL: -0.15, hoL: 0.9, hsL: 0.5,
      thLX: -0.95, thLZ: 0.15, knL: 1.25, thRX: 0.15, knR: 0.25, anR: 0.2 });
    const S = P({ hipsY: -0.32, hipsRX: 0.3, hipsZ: 0.22, torsoX: 0.85, torsoY: 0.35, hipsRY: 0.15, headX: -0.55, headY: -0.3,
      shRX: -1.0, shRZ: 0.08, elR: -0.05, clR: 0.3, shLX: 0.5, shLZ: 0.65, elL: -0.9,
      thLX: -1.0, thLZ: 0.25, knL: 1.35, thRX: 0.55, thRZ: 0.15, knR: 0.9 });
    return own(keys(t, [[0, base], [0.12, W], [0.18, S], [0.34, S], [0.45, base]]));
  },

  // W 怪力衝拳（衝刺中）：上身壓低往前衝，右拳拉到腰後蓄力，左手在前開路
  dash_W({ t, P }) {
    const s = Math.sin(t * 34);
    return own(P({ hipsY: -0.12, hipsRX: 0.35, torsoX: 0.45, torsoY: -0.3, hipsRY: -0.1, headX: -0.6, headY: 0.25,
      shRX: 0.65, shRZ: 0.35, elR: -1.7, shLX: -1.35, shLZ: 0.15, elL: -0.9,
      thLX: -0.9 + 0.5 * s, thLZ: 0.1, knL: 0.9 - 0.3 * s, thRX: 0.6 - 0.5 * s, thRZ: 0.08, knR: 0.8 + 0.4 * s }));
  },
  // W 撞上目標（atk3，0.35 秒，接觸當下就打中）：右直拳全伸，後腳蹬直、整個人送進去
  atk3_W({ t, P, base }) {
    const S = P({ hipsY: -0.2, hipsRX: 0.15, hipsZ: 0.3, torsoX: 0.4, torsoY: 0.55, hipsRY: 0.35, headX: -0.15, headY: -0.65,
      shRX: -1.6, shRZ: 0.6, elR: -0.02, clR: 0, shLX: 0.45, shLZ: 0.4, elL: -1.9,
      thLX: -1.0, thLZ: 0.2, knL: 1.0, thRX: 0.85, knR: 0.08, anR: 0.4 });
    const W = P({ torsoY: 0.2, shRX: -0.6, elR: -1.6, hipsZ: 0.1, hipsY: -0.16, torsoX: 0.4 });
    return own(keys(t, [[0, W], [0.05, S], [0.2, S], [0.35, base]]));
  },

  // E 醫療忍術（0.4 秒）：微蹲前傾，雙掌併攏往前推出、掌心朝下發光，低頭專注
  barrier_E({ t, P, base }) {
    const pulse = Math.sin(t * 22) * 0.03;
    const S = P({ hipsY: -0.16, hipsRX: 0.1, torsoX: 0.35 + pulse, torsoY: 0.05, hipsRY: 0.05, headX: 0.35, headY: 0,
      shLX: -1.35, shLZ: 0.45, elL: -0.3, clL: -0.15, shRX: -1.35, shRZ: 0.45, elR: -0.3, clR: -0.15, wrL: -0.3, wrR: -0.3,
      hoL: 1, hoR: 1, hsL: 0.45, hsR: 0.45,
      thLX: -0.45, thLZ: 0.22, knL: 0.7, thRX: 0.25, thRZ: 0.2, knR: 0.6 });
    return own(keys(t, [[0, base], [0.1, S], [0.4, S]]));
  },

  // R 天之拳（跳躍 0.75 秒）：起跳拉長 → 空中拉弓（右拳舉到頭後、左手指向落點、雙腿收起）→ 下墜時翻身拳頭朝下
  air_R({ t, P }) {
    const up = P({ hipsY: 0.05, hipsRX: -0.15, torsoX: -0.25, torsoY: 0.1, headX: -0.4, headY: -0.1,
      shRX: -2.6, shRZ: 0.4, elR: -0.6, shLX: -2.4, shLZ: 0.5, elL: -0.4,
      thLX: 0.2, thLZ: 0.1, knL: 0.4, thRX: 0.35, thRZ: 0.1, knR: 0.6 });
    const cock = P({ hipsY: 0.05, hipsRX: -0.35, torsoX: -0.45, torsoY: -0.55, headX: -0.4, headY: 0.4,
      shRX: -2.55, shRZ: 0.95, elR: -1.35, shLX: -1.35, shLZ: 0.75, elL: -0.1, clL: -0.2, hoL: 0.9, hsL: 0.5,
      thLX: -1.2, thLZ: 0.2, knL: 1.9, thRX: -0.3, thRZ: 0.15, knR: 1.8 });
    const dive = P({ hipsY: 0.05, hipsRX: 0.75, torsoX: 0.55, torsoY: 0.35, headX: -0.7, headY: -0.2,
      shRX: -1.1, shRZ: 0.05, elR: -0.05, clR: 0.3, shLX: 0.4, shLZ: 0.9, elL: -0.5,
      thLX: 0.25, thLZ: 0.2, knL: 1.4, thRX: 0.5, thRZ: 0.15, knR: 1.0 });
    return own(keys(t, [[0, up], [0.12, up], [0.32, cock], [0.5, cock], [0.68, dive]]));
  },
  // R 落地（atk3，0.4 秒，落地瞬間已造成傷害）：雙腿大開深蹲著地，右拳垂直打進兩腳之間的地面，左臂往後上方甩開
  atk3_R({ t, P, base }) {
    const S = P({ hipsY: -0.44, hipsRX: 0.45, hipsZ: 0.05, hipsRY: 0, torsoX: 0.7, torsoY: 0.2, headX: -0.75, headY: -0.1,
      shRX: -0.75, shRZ: 0.05, elR: -0.05, clR: 0.25, shLX: 1.1, shLZ: 0.75, elL: -0.25, hoL: 0.6, hsL: 0.4,
      thLX: -1.1, thLZ: 0.55, knL: 1.75, thRX: -0.55, thRZ: 0.5, knR: 1.6 });
    return own(keys(t, [[0, S], [0.26, S], [0.4, base]]));
  },

  // 勝利：「しゃーんなろー！」左手叉腰、右臂彎起秀出怪力（二頭肌），身體一頓一頓
  win({ t, P }) {
    const b = Math.abs(Math.sin(t * 4));
    return own(P({ hipsY: -0.03 + 0.02 * b, hipsRY: -0.1, hipsRZ: 0.05, torsoX: -0.05, torsoY: 0.2, torsoZ: -0.06, headX: -0.2, headY: -0.1, headZ: 0.08,
      shLX: -0.1, shLZ: 0.65, elL: -1.7, hoL: 0.5, hsL: 0.3, shRX: -1.57, shRZ: 1.4 + 0.06 * b, elR: -1.9 - 0.2 * b, hoR: 0,
      thLX: -0.12, thLZ: 0.18, knL: 0.12, thRX: 0.12, thRZ: 0.16, knR: 0.2 }));
  },
};
