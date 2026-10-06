// vegeta 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（strike、lerpPose、ease、clamp、IMPACT…）。
//
// 貝吉塔：挺胸、下巴抬高、側身斜睨；普攻是左刺拳 → 右重直拳 → 迴旋踢，
// Q 連續能量彈左右掌交替推出，W 超級衝刺踢（飛身側踢 → 五段快踢 → 前蹬收尾），R 終極閃光（雙臂大張蓄力 → 雙掌併攏前推）。
import { strike, lerpPose, clamp, smooth01, IMPACT } from '../pose-kit.js';

const mix = (a, b, k) => lerpPose(a, b, clamp(k, 0, 1));
const own = (p) => { p.ownHands = true; return p; }; // 手形自己決定，不套共用的 HAND_OPEN

// 抱胸（待機偶爾、勝利姿勢）
const FOLD = { shLX: -1.12, shLZ: -0.36, elL: -1.98, shRX: -1.02, shRZ: -0.42, elR: -2.08, hoL: 0.15, hoR: 0.1 };

export default {
  // 架式：左肩在前的半側身，重心落後腳；前拳低垂在胸前、後拳收在肋旁；下巴抬高斜睨。待機時偶爾抱胸。
  stance({ t, name }) {
    const br = Math.sin(t * 2.4);
    const p = {
      hipsY: -0.07 - 0.012 * br, hipsZ: 0, hipsRX: 0, hipsRY: 0.26, hipsRZ: -0.04,
      torsoX: -0.06 + 0.018 * br, torsoY: 0.36, torsoZ: 0.04,
      headX: -0.2 - 0.02 * br, headY: -0.46, headZ: -0.06,
      shLX: -0.85 - 0.04 * br, shLY: 0, shLZ: 0.3, elL: -1.62,
      shRX: -0.22 - 0.03 * br, shRY: 0, shRZ: 0.36, elR: -1.92,
      thLX: -0.3, thLZ: 0.18, knL: 0.34, thRX: 0.28, thRZ: 0.2, knR: 0.44,
      spin: 0, stretch: 0, wrL: 0, wrR: 0, anL: 0, anR: 0, clL: 0, clR: 0,
      hoL: 0.05, hoR: 0, hsL: 0, hsR: 0, toL: 0, toR: 0,
    };
    if (name === 'idle') { // 每隔一陣子雙手抱胸、站直、下巴抬更高（傲慢的等待）
      const f = smooth01((Math.sin(t * 0.35) - 0.4) / 0.3);
      if (f > 0) Object.assign(p, mix(p, { ...p, ...FOLD, hipsY: -0.02 - 0.008 * br, torsoX: -0.1 + 0.012 * br, headX: -0.3, knL: 0.16, knR: 0.24, thLX: -0.18, thRX: 0.16 }, f));
    }
    return p;
  },

  // 普攻一：左刺拳，短促、前腳踏半步
  atk1({ t, P, base }) {
    const W = P({ torsoY: 0.6, hipsRY: 0.35, torsoX: 0.04, hipsY: -0.12, knL: 0.55, knR: 0.6,
      shLX: -0.7, shLZ: 0.22, elL: -2.15, shRX: -0.5, shRZ: 0.25, elR: -2.2, headY: -0.6 });
    const S = P({ torsoY: -0.2, hipsRY: 0.05, torsoX: 0.24, torsoZ: -0.04, hipsY: -0.13, hipsZ: 0.18,
      shLX: -1.58, shLZ: 0.04, elL: -0.03, shRX: -0.6, shRZ: 0.22, elR: -2.25,
      thLX: -0.68, thLZ: 0.18, knL: 0.72, thRX: 0.55, thRZ: 0.16, knR: 0.16, headY: -0.12, headX: -0.1 });
    return strike(t, IMPACT.atk1, base, W, S, 0.3);
  },

  // 普攻二：右重直拳，髖先轉、後腳蹬直，左拳收回腰際
  atk2({ t, P, base }) {
    const W = P({ torsoY: -0.25, hipsRY: -0.1, torsoX: 0.08, hipsY: -0.15, hipsZ: -0.04, knL: 0.62, knR: 0.7,
      shLX: -1.2, shLZ: 0.2, elL: -0.9, shRX: -0.1, shRZ: 0.4, elR: -2.35, headY: -0.3 });
    const S = P({ torsoY: 1.05, hipsRY: 0.62, torsoX: 0.3, hipsY: -0.17, hipsZ: 0.3,
      shRX: -1.6, shRZ: -0.02, elR: -0.02, shLX: 0.42, shLZ: 0.32, elL: -2.05,
      thLX: -0.88, thLZ: 0.22, knL: 0.98, thRX: 0.78, thRZ: 0.14, knR: 0.05, headY: -0.85, headX: -0.1, clR: 0.15 });
    return strike(t, IMPACT.atk2, base, W, S, 0.34);
  },

  // 普攻三：右腳迴旋踢，膝先提起、上身往反方向倒，腳背橫掃到胸口高度
  atk3({ t, P, base }) {
    const W = P({ torsoY: -0.75, hipsRY: -0.45, torsoX: 0.18, hipsY: -0.16, hipsZ: -0.02,
      thRX: -0.95, thRZ: 0.35, knR: 2.0, thLX: -0.3, knL: 0.7,
      shLX: -1.0, shLZ: 0.35, elL: -1.7, shRX: 0.35, shRZ: 0.45, elR: -1.6, headY: -0.2 });
    const S = P({ torsoY: 1.0, hipsRY: 0.7, torsoX: -0.3, torsoZ: 0.55, hipsRZ: 0.22, hipsY: 0.04, hipsZ: 0.14,
      thRX: -1.85, thRZ: 0.9, knR: 0.06, thLX: 0.15, thLZ: 0.08, knL: 0.3,
      shLX: 0.25, shLZ: 1.2, elL: -0.5, shRX: 0.55, shRZ: 1.05, elR: -0.55, headY: -0.95, headX: -0.1, toR: -0.3 });
    return strike(t, IMPACT.atk3, base, W, S, 0.42);
  },

  // W 收尾：五段快踢的最後一下，右腳前蹬把對手踹飛（打擊在動作一開始就落下，所以起手幾乎是伸直的）
  atk3_W({ t, P, base }) {
    const W = P({ torsoX: 0.1, torsoY: 0.4, hipsY: 0.06, thRX: -1.1, knR: 1.6, thLX: 0.15, knL: 0.6,
      shLX: -0.9, shLZ: 0.3, elL: -1.8, shRX: -0.3, shRZ: 0.4, elR: -2.0 });
    const S = P({ torsoX: -0.45, torsoY: 0.75, torsoZ: 0.12, hipsRX: -0.2, hipsY: 0.12, hipsZ: 0.18, hipsRY: 0.4,
      thRX: -1.95, thRZ: 0.15, knR: 0.02, thLX: 0.35, thLZ: 0.1, knL: 0.55,
      shLX: 0.2, shLZ: 0.9, elL: -0.7, shRX: 0.5, shRZ: 0.75, elR: -0.8, headY: -0.7, headX: 0.05, toR: -0.25 });
    return strike(t, 0.04, base, W, S, 0.36);
  },

  // Q 連續能量彈：右掌先推出（0.10 秒發射），接著左掌補一發，左右交替
  cast_Q({ t, P, base }) {
    const Wd = P({ torsoY: -0.4, torsoX: 0.04, hipsY: -0.11, knL: 0.48, knR: 0.55,
      shRX: -0.45, shRZ: 0.55, elR: -2.2, hoR: 0.85, hsR: 0.6, wrR: 0.4,
      shLX: -1.25, shLZ: 0.22, elL: -0.55, hoL: 0.2, headY: -0.4 });
    const R = P({ torsoY: 0.8, hipsRY: 0.45, torsoX: 0.2, hipsY: -0.13, hipsZ: 0.1,
      shRX: -1.6, shRZ: -0.05, elR: -0.04, hoR: 1, hsR: 0.85, wrR: -0.55,
      shLX: -0.3, shLZ: 0.38, elL: -2.1, hoL: 0.7, hsL: 0.5, wrL: 0.3,
      thLX: -0.6, knL: 0.62, thRX: 0.5, knR: 0.2, headY: -0.62, clR: 0.12 });
    const L = P({ torsoY: -0.5, hipsRY: 0.05, torsoX: 0.22, hipsY: -0.13, hipsZ: 0.14,
      shLX: -1.6, shLZ: -0.05, elL: -0.04, hoL: 1, hsL: 0.85, wrL: -0.55,
      shRX: -0.35, shRZ: 0.48, elR: -2.15, hoR: 0.7, hsR: 0.5, wrR: 0.3,
      thLX: -0.66, knL: 0.66, thRX: 0.52, knR: 0.22, headY: -0.15, clL: 0.12 });
    let p;
    if (t < 0.055) p = mix(base, Wd, smooth01(t / 0.055));
    else if (t < 0.1) { const u = (t - 0.055) / 0.045; p = mix(Wd, R, u * u * (2 - u)); }
    else if (t < 0.13) p = R;
    else if (t < 0.18) { const u = (t - 0.13) / 0.05; p = mix(R, L, u * u * (2 - u)); }
    else if (t < 0.22) p = L;
    else p = mix(L, base, smooth01((t - 0.22) / 0.16));
    return own(p);
  },

  // W 衝刺：飛身側踢，右腳在前伸直、左腳收起，身體後仰、拳頭護在胸前
  dash_W({ t, P, base }) {
    const fl = Math.sin(t * 34) * 0.05;
    const S = P({ hipsY: 0.34, hipsRX: -0.3, hipsRY: 0.18, hipsRZ: 0.05, torsoX: 0.2, torsoY: 0.55, torsoZ: fl * 0.4,
      headX: -0.15, headY: -0.9,
      thRX: -1.45 + fl, thRZ: 0.1, knR: 0.03, thLX: -0.7, thLZ: 0.18, knL: 2.05,
      shLX: -1.05, shLZ: 0.2, elL: -1.85, shRX: 0.45, shRZ: 0.45, elR: -1.3, toR: -0.3 });
    return mix(base, S, smooth01(t / 0.07));
  },

  // W 五段快踢：左右腳交替踢出，每 0.075 秒一腳（打擊在 0.02、0.095、0.17、0.245 秒），整個人懸在空中
  rush_W({ t, P }) {
    const s = (t - 0.02) / 0.075;
    const aL = smooth01((0.5 + 0.5 * Math.cos(Math.PI * s)) * 1.5 - 0.25), aR = 1 - aL; // 偶數段左腳、奇數段右腳
    const tw = aL - aR;
    return P({ hipsY: 0.16, hipsRX: -0.15, hipsRY: 0.35 * tw, hipsZ: 0.05,
      torsoX: -0.1, torsoY: -0.55 * tw, torsoZ: 0.12 * tw, headY: 0.4 * tw, headX: -0.1,
      thLX: -0.65 - 0.9 * aL, thLZ: 0.15 + 0.2 * aL, knL: 1.75 - 1.65 * aL,
      thRX: -0.65 - 0.9 * aR, thRZ: 0.15 + 0.2 * aR, knR: 1.75 - 1.65 * aR,
      shLX: -0.45 - 0.4 * aR + 0.5 * aL, shLZ: 0.3 + 0.55 * aL, elL: -2.05 + 0.6 * aL, shRX: -0.45 - 0.4 * aL + 0.5 * aR, shRZ: 0.3 + 0.55 * aR, elR: -2.05 + 0.6 * aR,
      toL: -0.3 * aL, toR: -0.3 * aR });
  },

  // R 終極閃光：0.55 秒蓄力（雙臂往兩側大張、掌心朝外、挺胸怒吼），再雙掌併攏往前推出，光束期間撐住後座力
  beam_R({ t, P, base }) {
    const tr = Math.sin(t * 57) * 0.02, tr2 = Math.sin(t * 43 + 1) * 0.02;
    const SPREAD = P({ hipsY: -0.16, hipsRY: 0.05, hipsRZ: 0, torsoX: -0.2 + tr, torsoY: 0.05, torsoZ: 0, headX: -0.32, headY: 0, headZ: 0,
      shLX: 0.2, shLZ: 1.42, elL: -0.12, shRX: 0.2, shRZ: 1.42, elR: -0.12,
      hoL: 1, hoR: 1, hsL: 1, hsR: 1, wrL: 0.5, wrR: 0.5, clL: -0.1, clR: -0.1,
      thLX: -0.32, thLZ: 0.36, knL: 0.58, thRX: 0.32, thRZ: 0.36, knR: 0.62 });
    const FIRE = P({ hipsY: -0.17, hipsRY: 0.08, hipsRZ: 0, hipsZ: 0.06, torsoX: 0.12 + tr, torsoY: 0.08, torsoZ: tr2, headX: 0.02, headY: -0.05, headZ: 0,
      shLX: -1.5, shLZ: -0.1, elL: -0.05, shRX: -1.42, shRZ: -0.08, elR: -0.05,
      hoL: 1, hoR: 1, hsL: 1, hsR: 1, wrL: -0.6, wrR: -0.6, clL: 0.15, clR: 0.15,
      thLX: -0.68, thLZ: 0.22, knL: 0.74, thRX: 0.58, thRZ: 0.16, knR: 0.24 });
    let p;
    if (t < 0.22) p = mix(base, SPREAD, smooth01(t / 0.22));
    else if (t < 0.46) { // 蓄力中：雙臂再往後張一點、身體發抖
      const u = (t - 0.22) / 0.24;
      p = P({ ...SPREAD, shLX: 0.2 + 0.18 * u + tr, shRX: 0.2 + 0.18 * u - tr, torsoX: -0.2 - 0.06 * u + tr });
    } else if (t < 0.55) { const u = (t - 0.46) / 0.09; p = mix({ ...SPREAD, shLX: 0.38, shRX: 0.38, torsoX: -0.26 }, FIRE, u * u * (2 - u)); }
    else p = FIRE;
    return own(p);
  },

  // 勝利：抱胸、下巴抬高把頭撇開
  win({ t, P }) {
    const br = Math.sin(t * 2);
    return P({ ...FOLD, hipsY: -0.02 + 0.01 * br, hipsRY: 0.3, hipsRZ: -0.06, torsoX: -0.12, torsoY: 0.25, headX: -0.32, headY: -0.75, headZ: -0.1,
      thLX: -0.12, thLZ: 0.16, knL: 0.08, thRX: 0.12, thRZ: 0.2, knR: 0.22 });
  },
};
