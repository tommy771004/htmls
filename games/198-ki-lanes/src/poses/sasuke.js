// sasuke 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（strike、lerpPose、ease、clamp、IMPACT…）。
//
// 佐助（疾風傳）：草薙劍橫插在腰後、刀柄在右腰；右手拔刀（普攻與千鳥衝刺時劍在右手），千鳥用左手。
// 劍刃從虎口伸出、和前臂垂直：手臂前伸時 wrR 約 +1.3 讓劍身順著手臂朝前（刺擊），wrR 0 時劍朝上；shRY 正負把劍往右／左滾。
import { strike, lerpPose, ease, clamp, IMPACT, blank } from '../pose-kit.js';

const own = (p) => { p.ownHands = true; return p; }; // 手形自己決定，不讓共用的 HAND_OPEN 把手攤平
const lerp3 = (a, b, k) => lerpPose(a, b, clamp(k, 0, 1));

// 待機：半身側轉、左腳在前，右手按著腰後的刀柄隨時拔刀，左手鬆垂在身前；下巴微收、眼神斜睨
function stance({ t }) {
  const p = blank();
  const br = Math.sin(t * 2.4), sway = Math.sin(t * 1.1);
  Object.assign(p, {
    hipsY: -0.09 - 0.012 * br, hipsRY: 0.28, hipsRZ: 0.03, torsoX: 0.14 + 0.015 * br, torsoY: 0.38, torsoZ: -0.03,
    headX: 0.02, headY: -0.42 + 0.03 * sway, headZ: 0.04,
    shRX: 0.25, shRZ: 0.3, elR: -0.9, wrR: 0.2, hoR: 0.12, hsR: 0.2,
    shLX: -0.5 - 0.03 * br, shLZ: 0.3, elL: -0.8, wrL: -0.15, hoL: 0.55, hsL: 0.35,
    thLX: -0.42, thLZ: 0.2, knL: 0.5, thRX: 0.36, thRZ: 0.2, knR: 0.48,
  });
  return p;
}

// 普攻一：居合式拔刀橫斬——從右腰拔出，身體由後往前擰，劍身打平從右掃到左
function atk1({ t, base, P }) {
  const W = P({ hipsY: -0.16, hipsRY: 0.35, torsoX: 0.28, torsoY: -0.6, headY: -0.1,
    shRX: -0.3, shRZ: 1.3, elR: -0.5, wrR: 1.0, shLX: -1.15, shLZ: 0.0, elL: -1.2, hoL: 0.7,
    thLX: -0.5, knL: 0.75, thRX: 0.42, knR: 0.7 });
  const S = P({ hipsY: -0.17, hipsZ: 0.22, hipsRY: -0.05, torsoX: 0.3, torsoY: 0.8, headY: -0.42,
    shRX: -1.45, shRZ: 0.05, shRY: 0, elR: -0.08, wrR: 1.15, shLX: 0.4, shLZ: 0.6, elL: -0.55, hoL: 0.8, hsL: 0.5,
    thLX: -0.85, thLZ: 0.25, knL: 0.95, thRX: 0.6, thRZ: 0.15, knR: 0.15 });
  return strike(t, IMPACT.atk1, base, W, S, 0.3);
}

// 普攻二：反手上撩——劍從左下往右上撩起，上身反向擰開，左手甩後平衡
function atk2({ t, base, P }) {
  const W = P({ hipsY: -0.18, hipsRY: 0.1, torsoX: 0.32, torsoY: 0.95, headY: -0.5,
    shRX: -0.7, shRZ: -0.7, elR: -0.7, wrR: 0.7, shLX: -0.35, shLZ: 0.45, elL: -1.2, hoL: 0.6,
    thLX: -0.55, knL: 0.85, thRX: 0.4, knR: 0.8 });
  const S = P({ hipsY: -0.06, hipsZ: 0.16, hipsRY: 0.45, torsoX: 0.02, torsoY: -0.6, torsoZ: -0.12, headX: -0.15, headY: 0.3,
    shRX: -2.05, shRZ: 1.15, elR: -0.12, wrR: 0.95, shLX: 0.35, shLZ: 0.7, elL: -0.45, hoL: 0.85, hsL: 0.5,
    thLX: -0.7, thLZ: 0.22, knL: 0.6, thRX: 0.5, thRZ: 0.15, knR: 0.2 });
  return strike(t, IMPACT.atk2, base, W, S, 0.34);
}

// 普攻三：弓步突刺——劍收在右腰蓄勢，整個人往前撲，右臂與劍拉成一直線，後腳蹬直
function atk3({ t, base, P }) {
  const W = P({ hipsY: -0.2, hipsZ: -0.06, hipsRY: 0.55, torsoX: 0.25, torsoY: -0.55, headY: -0.75,
    shRX: 0.35, shRZ: 0.3, shRY: 0.8, elR: -1.6, wrR: 0.85, shLX: -1.3, shLZ: -0.25, elL: -0.25, hoL: 0.9, hsL: 0.5,
    thLX: -0.55, knL: 1.0, thRX: 0.45, knR: 0.95 });
  const S = P({ hipsY: -0.24, hipsZ: 0.34, hipsRY: 0.05, hipsRX: 0.1, torsoX: 0.3, torsoY: 0.7, headX: -0.1, headY: -0.42,
    shRX: -1.6, shRZ: 0.7, elR: -0.02, wrR: 1.35, shLX: 0.55, shLZ: 0.7, elL: -0.3, hoL: 0.9, hsL: 0.6,
    thLX: -1.15, thLZ: 0.2, knL: 1.25, thRX: 0.8, thRZ: 0.15, knR: 0.05 });
  return strike(t, IMPACT.atk3, base, W, S, 0.42);
}

// Q 豪火球之術（0.14 秒吐出火球）：雙手在胸前結虎印、上身後仰吸氣 → 往前一彎，右手指圈靠在嘴前噴火
function cast_Q({ t, base, P }) {
  const seal = P({ hipsY: -0.1, hipsRY: 0.15, torsoX: -0.25, torsoY: 0.05, headX: -0.3, headY: -0.15,
    shLX: -0.6, shLZ: 0.12, shLY: -0.85, elL: -2.0, wrL: -0.2, hoL: 0.55, hsL: 0.4,
    shRX: -0.6, shRZ: 0.12, shRY: -0.85, elR: -2.0, wrR: -0.2, hoR: 0.55, hsR: 0.4,
    thLX: -0.3, thLZ: 0.2, knL: 0.4, thRX: 0.3, thRZ: 0.2, knR: 0.4 });
  const tr = Math.sin(t * 55) * 0.02;
  const blow = P({ hipsY: -0.17, hipsZ: 0.1, torsoX: 0.35 + tr, torsoY: 0.45, headX: 0.05, headY: -0.25,
    shRX: -1.35, shRZ: 0.05, elR: -2.35, wrR: 0.3, hoR: 0.4, hsR: 0.7,
    shLX: 0.35, shLZ: 0.55, elL: -0.6, hoL: 0.6, hsL: 0.4,
    thLX: -0.75, thLZ: 0.25, knL: 0.9, thRX: 0.55, thRZ: 0.18, knR: 0.35 });
  let p;
  if (t < 0.08) p = lerp3(base, seal, ease(t / 0.05));
  else if (t < 0.14) { const u = (t - 0.08) / 0.06; p = lerp3(seal, blow, u * u * (2 - u)); }
  else p = blow;
  return own(p);
}

// W 千鳥（衝刺段）：壓低重心的疾跑，左手的雷光拖在身後、五指張成爪，右手的劍往後斜拖
function dash_W({ t, P }) {
  const ph = t * 26, s = Math.sin(ph), c = Math.cos(ph);
  return P({ hipsY: -0.22 + 0.04 * Math.abs(c), hipsRX: 0.35, hipsRY: -0.1 * s, hipsZ: 0.05, torsoX: 0.6, torsoY: 0.25 + 0.06 * s, headX: -0.65, headY: -0.12,
    shLX: 0.4, shLZ: 0.35, elL: -0.06, wrL: -0.5, hoL: 0.8, hsL: 0.85, clL: -0.1,
    shRX: 0.25, shRZ: 0.45, shRY: 1.5, elR: -0.2, wrR: 0.7,
    thLX: -0.2 + s * 1.0, thRX: -0.2 - s * 1.0, thLZ: 0.08, thRZ: 0.08,
    knL: 0.55 + 1.3 * Math.max(0, -c), knR: 0.55 + 1.3 * Math.max(0, c) });
}

// W 千鳥（貫穿段，撞到敵人的瞬間）：左手由後往前直貫、弓步撲出，右手的劍甩到身後；停一下再收
function atk3_W({ t, base, P }) {
  const W = P({ hipsY: -0.2, hipsRX: 0.3, torsoX: 0.55, torsoY: 0.3, headX: -0.55, headY: -0.15,
    shLX: 0.4, shLZ: 0.35, elL: -0.06, wrL: -0.5, hoL: 0.8, hsL: 0.85, shRX: 0.25, shRZ: 0.45, shRY: 1.5, elR: -0.2, wrR: 0.7,
    thLX: -0.6, knL: 1.0, thRX: 0.4, knR: 0.9 });
  const S = P({ hipsY: -0.22, hipsZ: 0.3, hipsRX: 0.12, hipsRY: -0.1, torsoX: 0.35, torsoY: -0.6, headX: -0.2, headY: 0.4,
    shLX: -1.6, shLZ: 1.05, elL: -0.02, wrL: -0.35, hoL: 0.85, hsL: 0.8,
    shRX: 0.6, shRZ: 0.5, shRY: 1.5, elR: -0.2, wrR: 0.7,
    thLX: -1.1, thLZ: 0.2, knL: 1.15, thRX: 0.75, thRZ: 0.15, knR: 0.1 });
  // 撞上的瞬間（t=0）傷害與雷光就出現，所以 0.03 秒內就要貫到底
  if (t < 0.03) { const u = 0.35 + 0.65 * t / 0.03; return lerp3(W, S, u * (2 - u)); }
  if (t < 0.2) return S;
  return lerp3(S, base, ease((t - 0.2) / 0.15));
}

// E 寫輪眼・瞬身：一瞬間的單手印、蹲低起跳（0.1 秒，不自轉）
function vanish_E({ P }) {
  return own(P({ hipsY: -0.22, torsoX: 0.35, torsoY: 0.1, headX: -0.3, headY: 0,
    shRX: -1.5, shRZ: -0.25, elR: -2.2, hoR: 0.5, hsR: 0.2, shLX: 0.5, shLZ: 0.4, elL: -0.4, hoL: 0.6,
    thLX: -0.7, knL: 1.2, thRX: 0.2, knR: 1.0, spin: 0 }));
}

// R 麒麟（1.0 秒落雷）：先蹲低蓄勢 → 右手筆直舉向天空、仰頭（手在雷雲下微顫）→ 最後一刻把手揮下指向目標
function overhead_R({ t, base, P }) {
  const crouch = P({ hipsY: -0.16, torsoX: 0.25, torsoY: 0.3, headX: 0.1,
    shRX: -0.7, shRZ: 0.1, shRY: -0.7, elR: -2.1, hoR: 0.9, hsR: 0.2, shLX: 0.2, shLZ: 0.45, elL: -0.9,
    thLX: -0.45, knL: 0.8, thRX: 0.35, knR: 0.75 });
  const tr = Math.sin(t * 47) * 0.03 * clamp((t - 0.3) / 0.2, 0, 1);
  const raise = P({ hipsY: -0.06, torsoX: -0.22, torsoY: 0.15, torsoZ: 0.08, headX: -0.55, headY: -0.1,
    shRX: -2.75 + tr, shRZ: 0.3, elR: -0.08, wrR: 0, hoR: 0.95, hsR: 0.15,
    shLX: 0.1, shLZ: 0.5, elL: -0.35, hoL: 0.5, hsL: 0.3,
    thLX: -0.25, thLZ: 0.22, knL: 0.25, thRX: 0.2, thRZ: 0.2, knR: 0.2 });
  const point = P({ hipsY: -0.16, hipsZ: 0.14, torsoX: 0.45, torsoY: 0.5, headX: 0.15, headY: -0.3,
    shRX: -0.95, shRZ: 0.35, elR: -0.03, wrR: 0.15, hoR: 0.95, hsR: 0.15,
    shLX: 0.45, shLZ: 0.55, elL: -0.4, hoL: 0.5, hsL: 0.3,
    thLX: -0.7, thLZ: 0.22, knL: 0.8, thRX: 0.5, thRZ: 0.15, knR: 0.3 });
  let p;
  if (t < 0.12) p = lerp3(base, crouch, ease(t / 0.12));
  else if (t < 0.32) p = lerp3(crouch, raise, ease((t - 0.12) / 0.2));
  else if (t < 0.8) p = raise;
  else { const u = clamp((t - 0.8) / 0.12, 0, 1); p = lerp3(raise, point, u * u); }
  return own(p);
}

// 跑步：忍者跑——上身大幅前傾、雙手筆直甩在身後，劍留在腰後
function run({ phase, P }) {
  const s = Math.sin(phase), c = Math.cos(phase);
  return P({ hipsY: -0.11 + 0.08 * Math.abs(c), hipsRX: 0.12, hipsRY: -0.15 * s, torsoX: 0.6, torsoY: 0.18 * s, torsoZ: 0, headX: -0.5, headY: -0.1 * s,
    thLX: s * 1.3 - 0.15, thRX: -s * 1.3 - 0.15, thLZ: 0.05, thRZ: 0.05,
    knL: 0.3 + 1.6 * Math.max(0, -c) * (0.6 + 0.4 * Math.max(0, -s)), knR: 0.3 + 1.6 * Math.max(0, c) * (0.6 + 0.4 * Math.max(0, s)),
    shLX: 0.85, shRX: 0.85, shLZ: 0.3, shRZ: 0.3, shLY: 0, shRY: 0, elL: -0.15, elR: -0.15, wrL: -0.3, wrR: -0.3, hoL: 0.7, hoR: 0.7, hsL: 0.3, hsR: 0.3 });
}

// 勝利：側身背對、右手仍按著刀柄，回頭斜睨一眼（「哼」）
function win({ t, P }) {
  const br = Math.sin(t * 2);
  return own(P({ hipsY: -0.02 - 0.008 * br, hipsRY: 0.75, hipsRZ: 0.04, torsoX: 0.04 + 0.01 * br, torsoY: 0.2, torsoZ: 0, headX: 0.12, headY: -0.8, headZ: 0.06,
    shRX: 0.25, shRZ: 0.3, elR: -0.9, wrR: 0.2, hoR: 0.12, hsR: 0.2,
    shLX: 0.08, shLZ: 0.14, elL: -0.25, wrL: 0, hoL: 0.5, hsL: 0.3,
    thLX: -0.12, thLZ: 0.12, knL: 0.12, thRX: 0.12, thRZ: 0.1, knR: 0.22 }));
}

export default {
  stance, atk1, atk2, atk3, cast_Q, dash_W, atk3_W, vanish_E, overhead_R, run, win,
  // 佐助每種動作只有一招，不帶技能鍵時（預覽、特寫工具）也用同一套
  cast: cast_Q, dash: dash_W, vanish: vanish_E, overhead: overhead_R,
};
