// naruto 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（strike、lerpPose、ease、clamp、IMPACT…）。
//
// 鳴人：壓低的忍者架式、街頭打架式的直拳＋大擺拳＋迴旋踢；
// Q 螺旋丸（手托在身後衝刺 → 撞上時整個人壓進去按出去）、W 影分身十字印、E 替身術蹲身結印、R 風遁螺旋手裏劍（單手高舉 → 後仰 → 擲出）。
import { strike, lerpPose, ease, clamp, IMPACT, blank } from '../pose-kit.js';

const own = (p) => { p.ownHands = true; return p; }; // 手形自己決定，不讓共用的 HAND_OPEN 蓋掉
const max0 = (v) => (v > 0 ? v : 0);
// 頭轉回正前方：世界偏航 = hipsRY + torsoY/2 + headY
const face = (p, bias = 0) => { p.headY = -(p.hipsRY + p.torsoY * 0.5) + bias; return p; };

export default {
  // 架式：半蹲壓低、身體前傾，左手攤開在前、右拳收在後腰（握苦無的位置），重心隨呼吸微微上下
  stance({ t }) {
    const p = blank();
    const br = Math.sin(t * 2.6), bob = Math.sin(t * 5.2);
    Object.assign(p, {
      hipsY: -0.18 - 0.015 * br - 0.008 * bob, hipsRY: 0.25, hipsRZ: 0.03, torsoX: 0.34 + 0.025 * br, torsoY: 0.3, torsoZ: -0.03, headX: -0.32,
      shLX: -1.2, shLZ: 0.5, elL: -1.0, shRX: 0.25, shRZ: 0.6, elR: -1.35,
      thLX: -0.62, thLZ: 0.4, knL: 1.02, thRX: 0.36, thRZ: 0.36, knR: 0.98,
      hoL: 0.75, hsL: 0.45, hoR: 0, hsR: 0,
    });
    return face(p, 0.05);
  },

  // 忍者跑：上身大幅前傾、頭抬起看前方，雙臂筆直拖在身後（略高於水平），大步幅
  run({ phase, P }) {
    const s = Math.sin(phase), c = Math.cos(phase);
    return own(P({
      hipsY: -0.14 + 0.07 * Math.abs(c), hipsRX: 0.18, hipsRY: -0.12 * s, hipsRZ: 0, torsoX: 0.72, torsoY: 0.16 * s, torsoZ: 0, headX: -0.72, headY: 0.06 * s,
      thLX: s * 1.25 - 0.25, thRX: -s * 1.25 - 0.25, thLZ: 0.06, thRZ: 0.06,
      knL: 0.35 + 1.55 * max0(-c) * (0.6 + 0.4 * max0(-s)), knR: 0.35 + 1.55 * max0(c) * (0.6 + 0.4 * max0(s)),
      shLX: 0.95 + 0.08 * s, shRX: 0.95 - 0.08 * s, shLZ: 0.32, shRZ: 0.32, shLY: 0.2, shRY: 0.2, elL: -0.12, elR: -0.12,
      hoL: 0.85, hoR: 0.85, hsL: 0.2, hsR: 0.2,
    }));
  },

  // 普攻一：左手刺拳，前腳踏進
  atk1({ t, P, base }) {
    const W = face(P({ hipsY: -0.21, hipsZ: -0.04, hipsRY: 0.45, torsoY: 0.55, torsoX: 0.3, shLX: -0.8, shLZ: 0.35, elL: -2.1, shRX: -0.5, shRZ: 0.35, elR: -2.0, hoL: 0, hsL: 0,
      knL: 1.1, knR: 1.0 }));
    const S = face(P({ hipsY: -0.2, hipsZ: 0.22, hipsRY: -0.1, torsoY: -0.4, torsoX: 0.42, torsoZ: 0.06,
      shLX: -1.62, shLZ: 0.85, elL: -0.02, clL: 0.25, shRX: -0.55, shRZ: 0.3, elR: -2.2, hoL: 0, hsL: 0,
      thLX: -0.95, thLZ: 0.3, knL: 0.95, thRX: 0.75, thRZ: 0.3, knR: 0.2 }));
    return own(strike(t, IMPACT.atk1, base, W, S, 0.3));
  },

  // 普攻二：右手大擺拳，整個人轉過去、右腳跟著踏出
  atk2({ t, P, base }) {
    const W = face(P({ hipsY: -0.22, hipsRY: -0.25, torsoY: -0.85, torsoX: 0.3, shRX: 0.35, shRZ: 1.05, elR: -1.7, shLX: -1.3, shLZ: 0.3, elL: -1.4, hoL: 0.3,
      knL: 1.1, knR: 1.05 }));
    const S = face(P({ hipsY: -0.2, hipsZ: 0.24, hipsRY: 0.35, torsoY: 0.6, torsoX: 0.45, torsoZ: -0.15,
      shRX: -1.5, shRZ: 1.3, elR: -0.85, clR: 0.25, shLX: 0.45, shLZ: 0.45, elL: -1.7, hoL: 0,
      thRX: -0.8, thRZ: 0.3, knR: 0.9, thLX: 0.6, thLZ: 0.35, knL: 0.35 }));
    return own(strike(t, IMPACT.atk2, base, W, S, 0.34));
  },

  // 普攻三：右腳迴旋踢，先蹲身扭腰蓄力，踢出時骨盆翻開、上身往反方向倒，雙臂甩開
  atk3({ t, P, base }) {
    const W = face(P({ hipsY: -0.24, hipsRY: -0.55, torsoY: -0.8, torsoX: 0.3, thRX: 0.5, knR: 1.4, thLX: -0.55, knL: 1.15,
      shLX: -0.9, shLZ: 0.3, elL: -1.6, shRX: 0.5, shRZ: 0.4, elR: -1.4 }));
    const S = face(P({ hipsY: 0.0, hipsZ: 0.12, hipsRY: 0.95, hipsRZ: -0.25, torsoY: 0.45, torsoX: -0.3, torsoZ: 0.45,
      thRX: -1.65, thRZ: 0.75, knR: 0.08, thLX: 0.15, thLZ: 0.1, knL: 0.4,
      shLX: 0.3, shLZ: 1.25, elL: -0.6, shRX: 0.6, shRZ: 1.0, elR: -0.5, hoL: 0.6, hoR: 0.6 }), -0.2);
    return own(strike(t, IMPACT.atk3, base, W, S, 0.42));
  },

  // Q 螺旋丸・衝刺：低身疾奔，右手托著螺旋丸拖在身側後方，左手在前開路
  dash_Q({ t, P }) {
    const ph = t * 20, s = Math.sin(ph), c = Math.cos(ph);
    return own(P({
      hipsY: -0.2, hipsRX: 0.22, hipsRY: 0.2, hipsRZ: 0, torsoX: 0.55, torsoY: 0.35, torsoZ: 0, headX: -0.65, headY: -0.35,
      thLX: s * 0.95 - 0.3, thRX: -s * 0.95 - 0.3, thLZ: 0.08, thRZ: 0.08,
      knL: 0.5 + 1.2 * max0(-c), knR: 0.5 + 1.2 * max0(c),
      shRX: 0.55, shRZ: 0.55, elR: -0.45, wrR: -0.4, hoR: 1, hsR: 0.8,
      shLX: -0.9, shLZ: 0.25, elL: -1.1, hoL: 0.85, hsL: 0.3,
    }));
  },

  // Q 螺旋丸・命中：衝進對方懷裡，右掌連人帶球壓出去，左手扣住右腕，前腳大弓步
  atk3_Q({ t, P, base }) {
    const W = P({ hipsY: -0.22, hipsZ: 0.05, hipsRX: 0.15, hipsRY: -0.1, torsoX: 0.55, torsoY: -0.45, shRX: 0.6, shRZ: 0.5, elR: -0.5, shLX: -1.0, shLZ: 0.2, elL: -1.3,
      thLX: -0.5, knL: 1.0, thRX: 0.4, knR: 0.8 });
    const tr = Math.sin(t * 70) * 0.03;
    const S = P({ hipsY: -0.26, hipsZ: 0.32, hipsRX: 0.12, hipsRY: 0.3, torsoX: 0.55 + tr, torsoY: 0.5, torsoZ: -0.05,
      shRX: -1.55, shRZ: 1.2, elR: -0.02, clR: 0.3, wrR: -0.55, shLX: -1.35, shLZ: -0.25, elL: -0.75,
      thRX: -1.05, thRZ: 0.25, knR: 1.15, thLX: 0.85, thLZ: 0.3, knL: 0.2 });
    face(W); face(S);
    let p;
    if (t < 0.03) p = lerpPose(W, S, 0); // 撞上的那一瞬：從衝刺的手勢起手
    else if (t < 0.07) p = lerpPose(W, S, ease((t - 0.03) / 0.04));
    else if (t < 0.2) p = S; // 壓著螺旋丸磨（隨 tr 抖動）
    else p = lerpPose(S, base, ease(clamp((t - 0.2) / 0.15, 0, 1)));
    p.hoR = 1; p.hsR = 0.9; p.hoL = 0.55; p.hsL = 0.6;
    return own(p);
  },

  // W 影分身之術：雙腳站開、兩手在胸前交叉成十字印，頭微低集中查克拉
  cast_W({ t, P, base }) {
    const tr = Math.sin(t * 55) * 0.012;
    // 先把兩手往外一甩（預備），再「啪」地在胸前交叉：兩掌半開、右手疊在左手上
    const O = P({ hipsY: -0.2, hipsRY: 0, torsoX: 0.3, torsoY: 0, headX: -0.1, headY: 0,
      shLX: -0.7, shLZ: 0.75, elL: -1.5, shRX: -0.7, shRZ: 0.75, elR: -1.5,
      thLX: -0.4, thLZ: 0.42, knL: 0.9, thRX: 0.1, thRZ: 0.42, knR: 0.8, hoL: 0.6, hoR: 0.6 });
    const S = P({ hipsY: -0.14, hipsZ: 0, hipsRX: 0, hipsRY: 0, hipsRZ: 0, torsoX: 0.12 + tr, torsoY: 0, torsoZ: 0, headX: 0.14, headY: 0, headZ: 0,
      shLX: -0.95, shLZ: -0.5, shLY: -0.4, elL: -1.75, shRX: -1.05, shRZ: -0.62, shRY: -0.4, elR: -1.75, wrL: 0.3, wrR: 0.3,
      thLX: -0.25, thLZ: 0.48, knL: 0.55, thRX: -0.05, thRZ: 0.48, knR: 0.5,
      hoL: 0.6, hsL: 0.1, hoR: 0.6, hsR: 0.1 });
    if (t < 0.05) return own(lerpPose(base, O, ease(t / 0.05)));
    return own(lerpPose(O, S, ease(clamp((t - 0.05) / 0.05, 0, 1))));
  },

  // E 替身術：落地時壓低成蹲姿、雙手合在胸前結印
  vanish_E({ t, P, base }) {
    const S = P({ hipsY: -0.4, hipsRX: 0, hipsRY: 0.1, torsoX: 0.35, torsoY: 0, headX: -0.25, headY: -0.05,
      shLX: -0.9, shLZ: -0.6, shLY: -0.3, elL: -2.1, shRX: -0.9, shRZ: -0.6, shRY: -0.3, elR: -2.1, // 掌心相合、指尖朝上
      thLX: -1.1, thLZ: 0.35, knL: 1.8, thRX: -0.15, thRZ: 0.3, knR: 1.75, spin: 0,
      hoL: 1, hsL: 0.3, hoR: 1, hsR: 0.3 });
    return own(lerpPose(base, S, ease(clamp(t / 0.06, 0, 1))));
  },

  // R 風遁・螺旋手裏劍：蹲身蓄力 → 右手筆直高舉托住 → 後仰拉滿 → 0.45 秒擲出、跨步送出
  overhead_R({ t, P, base }) {
    const crouch = P({ hipsY: -0.26, torsoX: 0.4, torsoY: -0.2, shRX: -1.2, shRZ: 0.3, elR: -1.2, shLX: -0.6, shLZ: 0.5, elL: -1.2,
      thLX: -0.6, thLZ: 0.42, knL: 1.2, thRX: 0.3, thRZ: 0.4, knR: 1.15 });
    const hold = P({ hipsY: -0.12, hipsRY: -0.1, torsoX: -0.12, torsoY: -0.25, torsoZ: 0.06, headX: -0.25,
      shRX: -3.0, shRZ: 0.22, elR: -0.12, wrR: 0.5, shLX: -0.4, shLZ: 1.1, elL: -0.5,
      thLX: -0.5, thLZ: 0.45, knL: 0.7, thRX: 0.3, thRZ: 0.42, knR: 0.6 });
    const cock = P({ hipsY: -0.15, hipsZ: -0.06, hipsRY: -0.35, torsoX: -0.3, torsoY: -0.65, torsoZ: 0.1, headX: -0.15,
      shRX: -3.05, shRZ: 0.45, elR: -0.35, wrR: 0.6, shLX: -1.3, shLZ: 0.4, elL: -0.4,
      thLX: -0.6, thLZ: 0.45, knL: 0.75, thRX: 0.45, thRZ: 0.4, knR: 0.65 });
    const thr = P({ hipsY: -0.2, hipsZ: 0.3, hipsRY: 0.4, torsoX: 0.55, torsoY: 0.8, torsoZ: -0.1, headX: -0.3,
      shRX: -1.25, shRZ: 0.85, elR: -0.05, wrR: -0.3, clR: 0.3, shLX: 0.5, shLZ: 0.5, elL: -1.2,
      thLX: -1.0, thLZ: 0.35, knL: 1.05, thRX: 0.75, thRZ: 0.35, knR: 0.25 });
    const fol = P({ hipsY: -0.24, hipsZ: 0.34, hipsRY: 0.5, torsoX: 0.75, torsoY: 0.95, torsoZ: -0.12, headX: -0.45,
      shRX: -0.55, shRZ: 0.45, elR: -0.1, wrR: -0.2, shLX: 0.65, shLZ: 0.55, elL: -1.3,
      thLX: -1.05, thLZ: 0.35, knL: 1.15, thRX: 0.8, thRZ: 0.35, knR: 0.3 });
    for (const q of [crouch, hold, cock, thr, fol]) face(q);
    let p;
    if (t < 0.1) p = lerpPose(base, crouch, ease(t / 0.1));
    else if (t < 0.2) p = lerpPose(crouch, hold, ease((t - 0.1) / 0.1));
    else if (t < 0.34) p = lerpPose(hold, cock, ease((t - 0.2) / 0.14));
    else if (t < 0.43) { const u = (t - 0.34) / 0.09; p = lerpPose(cock, thr, u * u * (2 - u)); } // 出手越來越快
    else p = lerpPose(thr, fol, ease(clamp((t - 0.43) / 0.12, 0, 1)));
    const up = t < 0.43; // 舉著手裏劍時右手攤平托住；擲出後五指張開
    p.hoR = t < 0.1 ? 0.6 : 1; p.hsR = up ? 0.7 : 1; p.hoL = 0.7; p.hsL = 0.5;
    return own(p);
  },

  // 勝利：雙手抱在後腦勺、身體歪一邊的招牌笑
  win({ t, P }) {
    const b = Math.sin(t * 3);
    return own(P({ hipsY: -0.01, hipsRY: 0, hipsRZ: 0.08 + 0.02 * b, torsoX: -0.12, torsoY: 0.1, torsoZ: -0.08, headX: -0.15, headY: -0.1, headZ: 0.1 + 0.04 * b,
      shLX: -2.5, shLZ: 1.0, elL: -2.45, shRX: -2.5, shRZ: 1.0, elR: -2.45,
      thLX: -0.12, thLZ: 0.16, knL: 0.08, thRX: 0.1, thRZ: 0.2, knR: 0.12,
      hoL: 0.8, hsL: 0.3, hoR: 0.8, hsR: 0.3 }));
  },
};

