// piccolo 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（strike、lerpPose、ease、clamp、IMPACT…）。
//
// 比克：高瘦的那美克星人。架式駝背壓低、兩手半張成爪；普攻是貫手、伸長的直拳、踹出的側踢；
// Q 魔空包圍彈＝左右手連甩氣彈再握拳收網，W 伸臂抓取，E 再生（抱臂蹲身瞬移），R 魔貫光殺砲＝兩指抵額蓄力、弓步直指。
import { strike, lerpPose, ease, clamp, IMPACT } from '../pose-kit.js';

const own = (p) => { p.ownHands = true; return p; }; // 手形自己決定（不套 models.js 的 HAND_OPEN）
const seg = (t, a, b) => ease(clamp((t - a) / (b - a), 0, 1)); // t 在 a→b 之間的平滑進度

export default {
  // 架式：寬馬步、上身前駝、頭壓低往上瞪；左手爪在前、右手爪收在腰側，呼吸帶動肩膀
  stance({ t }) {
    const br = Math.sin(t * 2.2), sw = Math.sin(t * 1.1);
    return {
      hipsY: -0.14 - 0.012 * br, hipsZ: 0, hipsRX: 0, hipsRY: -0.2, hipsRZ: 0.03 * sw,
      torsoX: 0.28 + 0.025 * br, torsoY: -0.35, torsoZ: -0.04, headX: -0.3, headY: 0.38, headZ: 0,
      shLX: -1.15 - 0.04 * br, shLY: 0, shLZ: 0.6, elL: -0.7,
      shRX: -0.25 + 0.03 * br, shRY: 0, shRZ: 0.55, elR: -1.55,
      thLX: -0.5, thLZ: 0.32, knL: 0.75, thRX: 0.4, thRZ: 0.3, knR: 0.7,
      spin: 0, stretch: 0, wrL: -0.25, wrR: -0.3, anL: 0, anR: 0, clL: 0.1, clR: 0,
      hoL: 0.62, hoR: 0.55, hsL: 0.55, hsR: 0.5, toL: 0, toR: 0,
    };
  },

  // 普攻一：左手貫手（指尖併攏直插），小步前踏
  atk1({ t, base, P }) {
    const W = P({ torsoY: 0.1, hipsRY: -0.05, shLX: -0.7, shLZ: 0.25, elL: -2.0, hipsY: -0.16, hipsZ: -0.04, headY: 0.1 });
    const S = P({ torsoY: -0.6, hipsRY: -0.3, torsoX: 0.32, shLX: -1.62, shLZ: 0.78, elL: -0.02, wrL: 0, shRX: 0.4, shRZ: 0.4, elR: -1.7,
      hipsZ: 0.22, hipsY: -0.16, thLX: -0.8, thLZ: 0.24, knL: 0.9, thRX: 0.7, thRZ: 0.16, knR: 0.12, headY: 0.6, headX: -0.15,
      hoL: 0.95, hsL: 0.05, hoR: 0.3 });
    return own(strike(t, IMPACT.atk1, base, W, S, 0.3));
  },

  // 普攻二：右拳往後一拉，伸長手臂的直拳（那美克星人的長臂）
  atk2({ t, base, P }) {
    const W = P({ torsoY: -0.85, hipsRY: -0.4, torsoX: 0.2, shRX: 0.55, shRZ: 0.35, elR: -2.1, shLX: -1.3, shLZ: 0.2, elL: -0.6,
      hipsY: -0.17, hipsZ: -0.05, knL: 0.85, knR: 0.8, headY: 0.6, hoR: 0, hsR: 0 });
    const S = P({ torsoY: 0.6, hipsRY: 0.3, torsoX: 0.3, shRX: -1.6, shRZ: 0.8, elR: 0, wrR: 0, shLX: 0.45, shLZ: 0.4, elL: -1.9,
      hipsZ: 0.3, hipsY: -0.17, thLX: -0.85, thLZ: 0.25, knL: 0.95, thRX: 0.75, thRZ: 0.14, knR: 0.08, headY: -0.6, headX: -0.15,
      stretch: 0.75, hoR: 0, hsR: 0, hoL: 0.4 });
    return own(strike(t, IMPACT.atk2 - 0.015, base, W, S, 0.34)); // 手臂行程長，提早一點到位才趕得上平滑
  },

  // 普攻三：收膝蓄力，右腳腳跟直踹（側踢），上身後仰、兩手甩開平衡
  atk3({ t, base, P }) {
    const W = P({ torsoY: -0.7, hipsRY: -0.45, torsoX: 0.1, hipsY: -0.08, thRX: -1.1, thRZ: 0.1, knR: 2.1, thLX: 0.1, knL: 0.55,
      shLX: -1.2, shLZ: 0.3, elL: -1.6, shRX: -0.6, shRZ: 0.3, elR: -1.9, headY: 0.5, hoL: 0.3, hoR: 0.3 });
    const S = P({ torsoY: 0.4, hipsRY: 0.5, torsoX: -0.4, torsoZ: 0.2, hipsY: -0.02, hipsZ: 0.22, thRX: -1.75, thRZ: 0.5, knR: 0.05, anR: -0.4,
      thLX: 0.3, thLZ: 0.15, knL: 0.35, shLX: 0.5, shLZ: 1.1, elL: -0.5, shRX: 0.6, shRZ: 0.8, elR: -0.6, headY: -0.6, headX: 0.15,
      hoL: 0.7, hoR: 0.7, hsL: 0.6, hsR: 0.6 });
    return own(strike(t, IMPACT.atk3, base, W, S, 0.42));
  },

  // Q 魔空包圍彈（動作 0.35 秒）：右手、左手輪流往前外側甩出氣彈（腰跟著左右大扭）→ 雙拳舉到臉前握緊收網
  // overhead 不在 models.js 的快速平滑名單（約 77ms 才追到），所以關鍵姿勢故意誇大（手肘略超伸、腰扭過頭），追到七成剛好是要的幅度
  overhead_Q({ t, base, P }) {
    const legs = { hipsY: -0.2, thLX: -0.6, thLZ: 0.42, knL: 1.0, thRX: 0.45, thRZ: 0.4, knR: 0.8 };
    // 右手甩：右肩送出、手臂伸直往右前上方撒開，左手收到腰後；腰往左扭
    const flingR = P({ ...legs, hipsZ: 0.1, hipsRY: 0.3, torsoX: 0.3, torsoY: 0.95, torsoZ: -0.12, headX: -0.25, headY: -0.75,
      shRX: -2.0, shRY: 0, shRZ: 1.3, elR: 0, wrR: -0.6, shLX: 0.75, shLZ: 0.5, elL: -1.7, clR: 0.3,
      hoR: 1, hsR: 1, hoL: 0.2, hsL: 0.3 });
    // 左手甩：反過來，腰往右扭、左臂往左前上方撒開，右手拉回
    const flingL = P({ ...legs, hipsZ: 0.16, hipsRY: -0.3, torsoX: 0.3, torsoY: -0.95, torsoZ: 0.12, headX: -0.25, headY: 0.75,
      shLX: -2.0, shLY: 0, shLZ: 1.3, elL: 0, wrL: -0.6, shRX: 0.75, shRZ: 0.5, elR: -1.7, clL: 0.3,
      hoL: 1, hsL: 1, hoR: 0.2, hsR: 0.3 });
    // 收網：上身挺起、手肘外張，雙拳舉到臉前用力握緊（氣彈在遠處合攏）
    const clench = P({ torsoX: 0.0, torsoY: 0, hipsY: -0.16, hipsZ: 0.08, hipsRY: 0, headX: -0.4, headY: 0, shLX: -1.6, shLZ: 0.9, elL: -2.0, shRX: -1.6, shRZ: 0.9, elR: -2.0,
      thLX: -0.5, thLZ: 0.42, knL: 0.85, thRX: 0.4, thRZ: 0.42, knR: 0.7, hoL: 0, hoR: 0, hsL: 0, hsR: 0 });
    let p;
    if (t < 0.11) p = lerpPose(base, flingR, seg(t, 0, 0.05));
    else if (t < 0.22) p = lerpPose(flingR, flingL, seg(t, 0.11, 0.15));
    else p = lerpPose(flingL, clench, seg(t, 0.22, 0.26));
    return own(p);
  },

  // W 伸臂抓取（0.55 秒）：右肩一縮就把手臂射出去拉長，抓到後往回扯、身體後坐
  grab_W({ t, base, P }) {
    const coil = P({ torsoY: -0.6, hipsRY: -0.3, torsoX: 0.25, shRX: 0.3, shRZ: 0.4, elR: -1.8, hipsY: -0.17, hipsZ: -0.04, headY: 0.4, hoR: 0.6, hsR: 0.6 });
    const reach = P({ torsoY: 0.6, hipsRY: 0.3, torsoX: 0.35, shRX: -1.58, shRZ: 0.85, elR: 0, wrR: 0.1, shLX: 0.5, shLZ: 0.45, elL: -1.4,
      hipsZ: 0.24, hipsY: -0.18, thLX: -0.85, thLZ: 0.26, knL: 0.95, thRX: 0.75, thRZ: 0.14, knR: 0.1, headY: -0.6, headX: -0.15,
      hoR: 1, hsR: 0.8, hoL: 0.3, stretch: 2.2 });
    const yank = P({ torsoY: 0.3, hipsRY: 0.1, torsoX: -0.15, shRX: -1.2, shRZ: 0.2, elR: -1.6, shLX: 0.2, shLZ: 0.5, elL: -1.5,
      hipsZ: -0.1, hipsY: -0.2, thLX: -0.65, thLZ: 0.3, knL: 0.85, thRX: 0.55, thRZ: 0.25, knR: 0.6, headY: -0.3, headX: -0.25,
      hoR: 0.05, hsR: 0.1, hoL: 0.2, stretch: 0.3 });
    let p;
    if (t < 0.05) p = lerpPose(base, coil, ease(t / 0.05));
    else if (t < 0.3) { p = lerpPose(coil, reach, Math.min(1, (t - 0.05) / 0.1)); p.stretch = reach.stretch * clamp((t - 0.05) / 0.22, 0, 1); }
    else if (t < 0.45) p = lerpPose(reach, yank, seg(t, 0.3, 0.42));
    else p = lerpPose(yank, base, seg(t, 0.45, 0.55));
    return own(p);
  },

  // E 再生：瞬移的一瞬間蹲低、雙臂交叉護身（之後護盾與回血特效接手）
  vanish_E({ t, base, P }) {
    const S = P({ hipsY: -0.3, torsoX: 0.5, torsoY: 0, headX: -0.1, headY: 0, shLX: -1.35, shLZ: -0.4, elL: -1.85, shRX: -1.35, shRZ: -0.4, elR: -1.85,
      thLX: -0.9, thLZ: 0.35, knL: 1.5, thRX: -0.3, thRZ: 0.35, knR: 1.4, hoL: 0.1, hoR: 0.1, hsL: 0, hsR: 0 });
    return own(lerpPose(base, S, ease(clamp(t / 0.06, 0, 1))));
  },

  // R 魔貫光殺砲（蓄力 0.7 秒＋發射 0.6 秒）：右手兩指抵額、左拳握緊垂在腰側，越蹲越低全身發抖蓄力 → 弓步把手臂直直刺出、兩指指向前方
  beam_R({ t, base, P }) {
    const tr = Math.sin(t * 55) * 0.02;
    const aim = P({ torsoX: 0.12 + tr, torsoY: 0.4, hipsRY: 0.3, torsoZ: -0.05, hipsY: -0.16, hipsZ: -0.03, headX: 0.15, headY: -0.5,
      shRX: -1.28, shRY: -0.35, shRZ: 1.3, elR: -2.45, wrR: 0.5, shLX: 0.2, shLZ: 0.35, elL: -0.5,
      thLX: -0.5, thLZ: 0.36, knL: 0.8, thRX: 0.42, thRZ: 0.32, knR: 0.7, hoR: 0.85, hsR: 0, hoL: 0.1, hsL: 0.2 });
    // 蓄滿：再蹲低一點、上身壓前、右肩繃緊
    const full = { ...aim, torsoX: aim.torsoX + 0.08, hipsY: aim.hipsY - 0.04, knL: aim.knL + 0.15, knR: aim.knR + 0.15, clR: aim.clR + 0.15 };
    const fire = P({ torsoX: 0.18 + tr * 0.5, torsoY: 0.75, hipsRY: 0.45, torsoZ: 0, hipsY: -0.2, hipsZ: 0.24, headX: -0.1, headY: -0.83,
      shRX: -1.57, shRZ: 1.1, elR: 0, wrR: 0, shLX: 0.5, shLZ: 0.35, elL: -1.6,
      thLX: -0.9, thLZ: 0.3, knL: 1.0, thRX: 0.8, thRZ: 0.2, knR: 0.05, hoR: 0.92, hsR: 0, hoL: 0, hsL: 0 });
    let p;
    if (t < 0.25) p = lerpPose(base, aim, ease(t / 0.25));
    else if (t < 0.6) { p = lerpPose(aim, full, seg(t, 0.25, 0.6)); p.torsoX += 0.03 * Math.sin(t * 9); } // 指尖的螺旋氣越聚越亮
    else if (t < 0.7) { const u = (t - 0.6) / 0.1; p = lerpPose(full, fire, u * u); } // 出手越來越快
    else { p = { ...fire }; const r = Math.max(0, 1 - (t - 0.7) / 0.15); p.hipsZ -= 0.06 * r; p.torsoX -= 0.1 * r; } // 後座力
    return own(p);
  },

  // 勝利：雙臂抱胸、挺直站好，低頭冷笑（比克的招牌站姿）
  win({ t, P }) {
    const br = Math.sin(t * 2);
    return own(P({ hipsY: -0.01, hipsRY: 0, hipsRZ: 0, torsoX: -0.04 + 0.01 * br, torsoY: 0.1, torsoZ: 0, headX: 0.18, headY: -0.2,
      shLX: -0.4, shLY: -1.3, shLZ: 0.12, elL: -1.7, shRX: -0.5, shRY: -1.3, shRZ: 0.08, elR: -1.75, wrL: 0, wrR: 0,
      thLX: -0.06, thLZ: 0.16, knL: 0.06, thRX: 0.06, thRZ: 0.16, knR: 0.06, hoL: 0.6, hoR: 0.6, hsL: 0.4, hsR: 0.4 }));
  },
};
