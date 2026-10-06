// trunks 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（strike、lerpPose、ease、clamp、IMPACT…）。
//
// 未來特南克斯：劍收在背上（右肩露出劍柄），出劍時從背後拔出（atk*、dash 時劍在手上，其他動作劍回背上）。
// 普攻三段：拔劍袈裟斬 → 反手橫斬 → 雙手縱劈（劈開弗利沙那一刀）。
// Q 魔閃光（cast_Q）：雙掌疊在頭頂 → 向前推出。W 閃光斬（dash_W）：橫刀穿過 → 單掌補一發氣彈（cast，沒有技能鍵）。
// R 熱圓頂攻擊：豎劍蓄勢（dash_R）→ 閃到身邊上挑（atk3_R）→ 手印一交錯、雙掌朝天放出圓頂爆炸（beam_R）。
// 劍在右拳裡和前臂垂直、從虎口伸出；wrR 往正彎讓劍身順著前臂延伸。劍的角度用無頭量測對過（劍尖不入地）。
import { blank, lerpPose, ease, clamp, IMPACT } from '../pose-kit.js';

// 依時間在關鍵姿勢之間內插：keys = [[時間, 姿勢], …]（時間遞增）
function seq(t, keys) {
  if (t <= keys[0][0]) return { ...keys[0][1] };
  for (let i = 1; i < keys.length; i++) {
    const [t1, b] = keys[i];
    if (t < t1) { const [t0, a] = keys[i - 1]; return lerpPose(a, b, ease((t - t0) / (t1 - t0))); }
  }
  return { ...keys[keys.length - 1][1] };
}
// 劍招時間軸：架式 → W 預備（ti×0.55）→ 加速揮到 S（ti 命中）→ 減速送到 F（揮完的收勢）→ 停一下 → rec 時回架式
function cut(t, ti, base, W, S, F, rec) {
  const a = ti * 0.55;
  if (t < a) return lerpPose(base, W, ease(t / a));
  if (t < ti) { const u = (t - a) / (ti - a); return lerpPose(W, S, u * u * (2 - u)); }
  if (t < ti + 0.06) return lerpPose(S, F, Math.sin((Math.PI / 2) * ((t - ti) / 0.06)));
  if (t < ti + 0.12) return { ...F };
  return lerpPose(F, base, ease(clamp((t - ti - 0.12) / Math.max(0.05, rec - ti - 0.12), 0, 1)));
}
const own = (p) => { p.ownHands = true; return p; }; // 手形自己決定，不套 models.js 的 HAND_OPEN

export default {
  // 架式：左腳在前半身側轉，左拳護在胸前，右手翻到右肩上方虛握背後的劍柄
  stance({ t }) {
    const p = blank();
    const br = Math.sin(t * 2.6), sway = Math.sin(t * 1.3);
    Object.assign(p, {
      hipsY: -0.1 - 0.012 * br, hipsRY: 0.25, hipsRZ: 0.03 * sway, torsoX: 0.12 + 0.015 * br, torsoY: 0.45, torsoZ: -0.03, headY: -0.5, headX: -0.06,
      shLX: -1.1 - 0.03 * br, shLZ: 0.3, elL: -1.75, hoL: 0,
      shRX: -2.0, shRZ: 1.0, shRY: 0.9, elR: -2.4, hoR: 0.35, hsR: 0.3,
      thLX: -0.45, thLZ: 0.2, knL: 0.6, thRX: 0.38, thRZ: 0.18, knR: 0.55,
    });
    return p;
  },

  // 一段：拔劍袈裟斬——右手從肩後拔劍高舉（劍尖朝後），右肩送出、斜劈到左前下，收勢時劍橫在身體左側
  atk1({ t, P, base }) {
    const W = P({ torsoY: -0.2, torsoX: 0.0, hipsRY: 0.05, shRX: -2.8, shRZ: 0.7, shRY: 0.2, elR: -0.8, wrR: 0.3,
      shLX: -0.9, shLZ: 0.25, elL: -1.5, hipsY: -0.12, knL: 0.7, knR: 0.65, headY: -0.6, headX: -0.15 });
    const S = P({ torsoY: 0.85, torsoX: 0.32, hipsRY: 0.45, shRX: -0.63, shRZ: 0.47, shRY: 0.8, elR: -0.2, wrR: 0.5,
      shLX: 0.45, shLZ: 0.35, elL: -1.6, hipsZ: 0.2, hipsY: -0.16,
      thLX: -0.8, thLZ: 0.24, knL: 0.95, thRX: 0.7, thRZ: 0.14, knR: 0.12, headY: -0.7, headX: 0.05 });
    const F = P({ torsoY: 0.95, torsoX: 0.35, hipsRY: 0.5, shRX: -0.75, shRZ: -0.35, shRY: 0, elR: -0.12, wrR: 0.9,
      shLX: 0.5, shLZ: 0.4, elL: -1.6, hipsZ: 0.22, hipsY: -0.17,
      thLX: -0.82, thLZ: 0.24, knL: 0.98, thRX: 0.72, thRZ: 0.14, knR: 0.1, headY: -0.7, headX: 0.05 });
    return cut(t, IMPACT.atk1, base, W, S, F, 0.34);
  },

  // 二段：反手橫斬——劍收到左肩後（劍尖朝左後），身體反轉把劍水平掃過正前方，收勢甩到右後
  atk2({ t, P, base }) {
    const W = P({ torsoY: 1.0, hipsRY: 0.5, torsoX: 0.2, shRX: -0.35, shRZ: 1.36, shRY: -0.59, elR: -2.22, wrR: 1.3,
      shLX: -0.5, shLZ: 0.2, elL: -1.8, hipsY: -0.14, knL: 0.75, knR: 0.7, headY: -0.7 });
    const S = P({ torsoY: -0.75, hipsRY: -0.3, torsoX: 0.25, torsoZ: 0.1, shRX: -1.48, shRZ: -0.22, shRY: 0.01, elR: -0.08, wrR: 1.07,
      shLX: -0.6, shLZ: 0.6, elL: -1.2, hipsZ: 0.22, hipsY: -0.17,
      thLX: -0.85, thLZ: 0.3, knL: 1.0, thRX: 0.7, thRZ: 0.2, knR: 0.15, headY: 0.2 });
    const F = P({ torsoY: -0.85, hipsRY: -0.35, torsoX: 0.25, torsoZ: 0.12, shRX: -1.45, shRZ: 1.25, shRY: 0.2, elR: -0.05, wrR: 1.0,
      shLX: -0.65, shLZ: 0.65, elL: -1.1, hipsZ: 0.24, hipsY: -0.18,
      thLX: -0.88, thLZ: 0.3, knL: 1.02, thRX: 0.72, thRZ: 0.2, knR: 0.12, headY: 0.25 });
    return cut(t, IMPACT.atk2, base, W, S, F, 0.38);
  },

  // 三段：雙手縱劈——起身把劍高舉過頭（劍尖垂到背後），雙手握柄一刀劈到腰前、深弓步壓低
  atk3({ t, P, base }) {
    const W = P({ torsoY: 0.2, hipsRY: 0.15, torsoX: -0.3, hipsY: -0.02, shRX: -2.24, shRZ: 0.21, shRY: -0.56, elR: -0.6, wrR: -0.18,
      shLX: -2.36, shLZ: -0.08, shLY: 0.12, elL: -0.18, hoL: 0.15,
      thLX: -0.6, knL: 0.8, thRX: 0.3, knR: 0.5, anR: 0.3, headX: -0.3, headY: -0.3 });
    const S = P({ torsoY: 0.3, hipsRY: 0.2, torsoX: 0.4, hipsRX: 0.1, hipsY: -0.22, hipsZ: 0.25, shRX: -1.65, shRZ: 0.44, shRY: 0.66, elR: -0.05, wrR: 0.55,
      shLX: -1.37, shLZ: -0.33, shLY: -0.31, elL: -0.1, hoL: 0.15,
      thLX: -1.0, thLZ: 0.25, knL: 1.2, thRX: 0.75, thRZ: 0.15, knR: 0.2, headX: 0.1, headY: -0.3 });
    const F = P({ torsoY: 0.3, hipsRY: 0.2, torsoX: 0.48, hipsRX: 0.12, hipsY: -0.25, hipsZ: 0.27, shRX: -1.45, shRZ: 0.44, shRY: 0.66, elR: -0.05, wrR: 0.5,
      shLX: -1.17, shLZ: -0.33, shLY: -0.31, elL: -0.1, hoL: 0.15,
      thLX: -1.05, thLZ: 0.25, knL: 1.28, thRX: 0.78, thRZ: 0.15, knR: 0.18, headX: 0.15, headY: -0.3 });
    return cut(t, IMPACT.atk3, base, W, S, F, 0.46);
  },

  // Q 魔閃光：雙掌疊在頭頂聚氣（0～0.09），0.14 秒出手時向前推出，手臂打直、掌心朝前，撐到 0.26 再收
  cast_Q({ t, P, base }) {
    const tr = Math.sin(t * 60) * 0.02;
    const up = P({ torsoY: 0.1, hipsRY: 0.15, torsoX: -0.3, headX: -0.35, headY: -0.15, hipsY: -0.08,
      shLX: -2.7, shLZ: -0.3, elL: -0.5, wrL: -0.3, shRX: -2.7, shRZ: -0.3, shRY: 0, elR: -0.5, wrR: -0.3,
      hoL: 1, hoR: 1, hsL: 0.8, hsR: 0.8, thLX: -0.4, knL: 0.5, thRX: 0.35, knR: 0.45 });
    const push = P({ torsoY: 0.15, hipsRY: 0.2, torsoX: 0.25 + tr, headX: 0.0, headY: -0.15, hipsY: -0.17, hipsZ: 0.16,
      shLX: -1.5, shLZ: -0.58, elL: -0.12, wrL: -0.6, shRX: -1.5, shRZ: -0.58, shRY: 0, elR: -0.12, wrR: -0.6,
      hoL: 1, hoR: 1, hsL: 0.9, hsR: 0.9, thLX: -0.85, thLZ: 0.25, knL: 0.95, thRX: 0.7, thRZ: 0.15, knR: 0.15 });
    return own(seq(t, [[0, base], [0.09, up], [0.14, push], [0.26, push], [0.4, base]]));
  },

  // W 閃光斬：起步時劍收到左肩後，0.05 秒起一刀橫掃穿過，之後壓低身體、劍拖在右後方滑行
  dash_W({ t, P }) {
    const cock = P({ torsoY: 1.0, hipsRY: 0.4, torsoX: 0.35, hipsY: -0.16, shRX: -0.59, shRZ: 1.32, shRY: -1.29, elR: -1.2, wrR: 1.0,
      shLX: -0.6, elL: -1.8, thLX: -0.8, knL: 1.0, thRX: 0.6, knR: 0.3, headY: -0.7 });
    const thru = P({ torsoY: -0.8, hipsRY: -0.3, torsoX: 0.6, hipsRX: 0.2, hipsY: -0.24, hipsZ: 0.12, shRX: -1.0, shRZ: 1.3, shRY: 0.3, elR: -0.05, wrR: 1.0,
      shLX: -1.3, shLZ: 0.2, elL: -0.3, hoL: 0.8, thLX: -1.0, thLZ: 0.3, knL: 1.2, thRX: 0.85, thRZ: 0.2, knR: 0.25, headY: 0.1, headX: -0.2 });
    return seq(t, [[0, cock], [0.05, cock], [0.11, thru]]);
  },

  // W 收尾（衝刺結束後補一發氣彈，沒有技能鍵；劍已回背上）：左掌向前推出，右手收到腰後
  cast({ t, P, base }) {
    const S = P({ torsoY: -0.85, hipsRY: -0.3, torsoX: 0.3, hipsY: -0.18, hipsZ: 0.14, shLX: -1.65, shLZ: 0.0, elL: -0.03, wrL: -0.8, hoL: 1, hsL: 0.8,
      shRX: 0.6, shRZ: 0.45, shRY: 0, elR: -1.4, thLX: -0.85, thLZ: 0.25, knL: 0.95, thRX: 0.65, knR: 0.12, headY: 0.5 });
    return own(seq(t, [[0, base], [0.05, S], [0.18, S], [0.32, base]]));
  },

  // R 前奏（慢動作特寫，劍已在手）：劍豎在臉前、左掌貼在劍柄上方 → 壓低身體把劍拖到右後下方，準備上挑
  dash_R({ t, P }) {
    const salute = P({ torsoY: 0.15, hipsRY: 0.1, torsoX: 0.0, headX: -0.1, headY: -0.15, hipsY: -0.08,
      shRX: -0.24, shRZ: -0.08, shRY: -0.25, elR: -1.95, wrR: 0.23, hoR: 0,
      shLX: -1.39, shLZ: -0.42, shLY: -0.4, elL: -1.32, hoL: 1, hsL: 0.4,
      thLX: -0.3, thLZ: 0.22, knL: 0.4, thRX: 0.25, thRZ: 0.2, knR: 0.35 });
    return own(seq(t, [[0, salute], [0.09, salute], [0.19, lowGuard(P)]]));
  },

  // R 上挑：閃到敵人身邊，一刀從右後下挑過頭頂，順勢蹬地躍起、劍尖朝天（命中在 t=0，所以 0.09 秒就揮到頂）
  atk3_R({ t, P }) {
    const S = P({ torsoY: -0.35, hipsRY: -0.15, torsoX: -0.3, hipsY: 0.16, hipsZ: 0.12, shRX: -2.65, shRZ: 0.2, shRY: 0, elR: -0.05, wrR: 1.1,
      shLX: 0.35, shLZ: 0.85, elL: -0.4, hoL: 1, hsL: 0.8, thLX: -1.05, thLZ: 0.2, knL: 1.5, thRX: 0.35, thRZ: 0.1, knR: 0.12, anR: 0.4, toR: -0.3, headX: -0.5, headY: 0.1 });
    return own(seq(t, [[0, lowGuard(P)], [0.02, lowGuard(P)], [0.09, S], [0.38, S]]));
  },

  // R 熱圓頂：燃燒攻擊的手印——雙臂在胸前交錯 → 甩開到兩側 → 雙掌在額前拼成菱形，
  // 再朝斜上方推出放出圓頂爆炸；大開步撐地、上身後仰（爆炸在 t=0 就開始，手印壓在前 0.14 秒）
  beam_R({ t, P }) {
    const tr = Math.sin(t * 55) * 0.025;
    const legs = { thLX: -0.5, thLZ: 0.35, knL: 0.8, thRX: 0.4, thRZ: 0.3, knR: 0.45 };
    const cross = P({ torsoY: 0, hipsRY: 0, torsoX: 0.15, headX: -0.2, headY: 0, hipsY: -0.16, ...legs,
      shLX: -1.2, shLZ: -0.55, elL: -1.5, shRX: -1.35, shRZ: -0.6, shRY: 0, elR: -1.3, hoL: 1, hoR: 1, hsL: 0.9, hsR: 0.9 });
    const wide = P({ torsoY: 0, hipsRY: 0, torsoX: -0.05, headX: -0.25, headY: 0, hipsY: -0.2, ...legs,
      shLX: -1.0, shLZ: 1.25, elL: -0.25, wrL: -0.5, shRX: -1.0, shRZ: 1.25, shRY: 0, elR: -0.25, wrR: -0.5, hoL: 1, hoR: 1, hsL: 1, hsR: 1 });
    const sign = P({ torsoY: 0, hipsRY: 0, torsoX: -0.15, headX: -0.35, headY: 0, hipsY: -0.2, ...legs,
      shLX: -2.2, shLZ: -0.35, elL: -0.75, wrL: -0.7, shRX: -2.2, shRZ: -0.35, shRY: 0, elR: -0.75, wrR: -0.7, hoL: 1, hoR: 1, hsL: 1, hsR: 1 });
    const S = P({ torsoY: 0, hipsRY: 0, torsoX: -0.32 + tr, headX: -0.5, headY: 0, hipsY: -0.22, hipsZ: -0.04,
      shLX: -1.95, shLZ: -0.45, elL: -0.1, wrL: -0.8, shRX: -1.95, shRZ: -0.45, shRY: 0, elR: -0.1, wrR: -0.8, hoL: 1, hoR: 1, hsL: 1, hsR: 1,
      thLX: -0.7, thLZ: 0.4, knL: 0.95, thRX: 0.55, thRZ: 0.35, knR: 0.3 });
    return own(seq(t, [[0, cross], [0.03, cross], [0.07, wide], [0.11, sign], [0.17, S], [0.5, S], [0.65, P({})]]));
  },

  // E 旋風跳：瞬移落點上縮成一團、半空中旋身（spin 是全身自轉），雙拳抱在胸前，落地時已經是下一刀的架勢
  vanish_E({ t, P }) {
    const k = ease(clamp(t / 0.05, 0, 1)), up = Math.sin(Math.PI * clamp(t / 0.12, 0, 1));
    return own(P({ hipsY: -0.2 + 0.32 * up * k, hipsRX: 0.25 * k, torsoX: 0.55 * k + 0.1, torsoY: 0, headX: -0.3, headY: 0,
      shLX: -1.35, shLZ: -0.3, elL: -2.1, hoL: 0, shRX: -1.25, shRZ: -0.25, shRY: 0, elR: -2.1, hoR: 0,
      thLX: -1.1 * k - 0.2, thLZ: 0.15, knL: 1.9 * k + 0.3, thRX: -0.9 * k, thRZ: 0.15, knR: 2.0 * k + 0.2, toL: 0.4, toR: 0.4,
      spin: t * 40 }));
  },

  // 勝利：人造人篇的招牌站姿——雙手抱胸、重心落在後腳、側頭斜看（呼吸時肩微微起伏）
  win({ t, P }) {
    const b = Math.sin(t * 2.2);
    return P({ hipsY: -0.03 + 0.008 * b, hipsRY: 0.2, hipsRZ: 0.06, torsoX: -0.06 + 0.01 * b, torsoY: 0.25, torsoZ: -0.04, headX: -0.12, headY: -0.45, headZ: 0.08,
      shLX: -0.55, shLZ: 0.1, shLY: -1.3, elL: -1.9, hoL: 0, shRX: -0.42, shRZ: 0.12, shRY: -1.3, elR: -1.7, hoR: 0, hsR: 0,
      thLX: -0.2, thLZ: 0.16, knL: 0.22, thRX: 0.14, thRZ: 0.14, knR: 0.08 });
  },
};

// R 的低架：深蹲、上身往右扭，劍拖在右後下方（dash_R 的結尾＝atk3_R 的預備）
function lowGuard(P) {
  return P({ torsoY: 0.95, hipsRY: 0.45, torsoX: 0.45, headX: -0.25, headY: -0.75, hipsY: -0.3,
    shRX: 0.16, shRZ: -0.59, shRY: -1.3, elR: -0.44, wrR: 0.91, hoR: 0,
    shLX: -1.3, shLZ: 0.5, elL: -0.5, hoL: 1, hsL: 0.8,
    thLX: -0.95, thLZ: 0.3, knL: 1.35, thRX: 0.55, thRZ: 0.25, knR: 1.0 });
}
