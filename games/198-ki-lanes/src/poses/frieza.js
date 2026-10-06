// frieza 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（strike、lerpPose、ease、clamp、IMPACT…）。
//
// 弗利沙（最終型態）：從容、居高臨下。腳尖離地微微懸浮，左手叉腰，出手只用一根手指；
// 普攻是指尖點射三連（右手點射 → 左手反手點射 → 甩尾轉身的重射），Q 死亡光束、W 死亡飛盤、R 死亡球（舉起 → 擲下）。
import { blank, strike, lerpPose, ease, clamp, IMPACT } from '../pose-kit.js';

// 關鍵格時間軸：frames = [[時間, 姿勢], …]，相鄰兩格之間用 ease 內插；最後一格之後停住
function track(t, frames) {
  if (t <= frames[0][0]) return { ...frames[0][1] };
  for (let i = 1; i < frames.length; i++) {
    const [t1, b] = frames[i];
    if (t < t1) { const [t0, a] = frames[i - 1]; return lerpPose(a, b, ease((t - t0) / (t1 - t0))); }
  }
  return { ...frames[frames.length - 1][1] };
}
// 自己決定手形（不套 models.js 的 HAND_OPEN）
const own = (p) => { p.ownHands = true; return p; };
// 叉腰的左手：上臂往外後張、手肘朝外，手背貼在腰側。shLY 把上臂往內扭，前臂才會彎到腰側而不是橫過肚子；
// 這個扭轉只給待機與自己的招式（左手出招時要歸零），共用動作的底由 stance 歸零，不會漏進去
const HIP_L = { shLX: 1.25, shLY: -0.45, shLZ: 1.1, elL: -1.95, wrL: 0.3, hoL: 0.6, hsL: 0.3 };
// 指尖：四指併攏伸直（手指只分三組，伸直的併指在遠處讀起來就是一根指頭），拇指收起
const POINT_R = { shRY: 0, hoR: 1, hsR: 0.05, wrR: 0 };
const POINT_L = { shLY: 0, hoL: 1, hsL: 0.05, wrL: 0 };
// 死亡球：右手筆直朝天、一根手指撐著球，仰頭看球；lift 是身體浮起的高度，腳尖垂下
const ballUp = (P, lift) => P({ hipsY: 0.08 + lift, torsoX: -0.24, torsoY: 0.12, torsoZ: -0.1, hipsRY: -0.05, headX: -0.55, headY: -0.05, headZ: 0,
  shRX: -3.0, shRZ: 0.22, elR: -0.04, ...POINT_R, wrR: -0.1, clR: 0.1,
  thLX: -0.32, thLZ: 0.08, knL: 0.8, anL: 0.65, thRX: 0.05, thRZ: 0.08, knR: 0.3, anR: 0.65 });

const moves = {
  // 架式：上身微後仰、頭歪向一側斜睨，左手叉腰（手肘往外撐出三角），右手往身側攤開、掌心朝上（從俯視鏡頭看手伸出身體輪廓）；
  // 骨盆離地懸浮、輕輕上下浮動，兩腳腳尖垂向地面，小腿跟著浮動前後晃。
  // 架式也是所有動作的底：上臂扭轉（shLY／shRY）、身體側歪只給待機與自己的招式，
  // 滑行、衝刺、受擊、倒地等共用動作沒設定這些鍵，依 name 歸零，免得漏進去。
  stance({ t, name }) {
    const br = Math.sin(t * 2.6), fl = Math.sin(t * 2.2), sw = Math.sin(t * 2.2 - 1.2);
    const idle = !name || name === 'idle', mine = idle || name in moves;
    const p = blank();
    Object.assign(p, {
      hipsY: 0.11 + 0.03 * fl, hipsRY: -0.18, hipsRZ: 0.05, torsoX: -0.12 + 0.012 * br, torsoY: 0.24, torsoZ: -0.05,
      headX: -0.28, headY: -0.24, headZ: 0.06,
      ...HIP_L,
      shRX: -0.2 - 0.03 * br, shRZ: 1.0, elR: -1.5 - 0.04 * br, wrR: -0.55, hoR: 1, hsR: 0.75,
      thLX: -0.28 - 0.04 * sw, thLZ: 0.06, knL: 0.55 + 0.08 * sw, anL: 0.85, thRX: 0.12 + 0.04 * sw, thRZ: 0.06, knR: 0.35 - 0.08 * sw, anR: 0.85,
      toL: 0.6, toR: 0.6,
    });
    // 歪頭、肩膀側傾的得意樣只在待機加大（出招時身體要正對目標）
    if (idle) Object.assign(p, { hipsRZ: 0.08, torsoZ: -0.08, headZ: 0.11 });
    // 右上臂外旋：前臂往身側攤開而不是橫在肚子前（自己的招式收招時落回同一個架式；右手出招的姿勢由 POINT_R 或各自設定歸零）。
    // 共用動作（滑行、受擊、集氣、倒地、抓取…）不吃這些扭轉與側歪；骨盆放回站立高度，腳尖下垂與翻掌的手腕也一起歸零，免得腳插進地面
    if (mine) p.shRY = 1.2; else Object.assign(p, { hipsY: 0, hipsRZ: 0, torsoZ: 0, headZ: 0, shLY: 0, wrR: 0, anL: 0, anR: 0, toL: 0, toR: 0 });
    return p;
  },

  // 普攻一：右手指尖點射。手收到肩前、指尖朝天 → 啪地伸直指向目標，右肩送出、頭順著手臂瞄；左手不離腰
  atk1({ t, P }) {
    const W = P({ torsoY: -0.2, hipsRY: -0.32, torsoX: -0.16, shRX: -1.45, shRZ: 0.1, elR: -2.2, ...POINT_R, wrR: 0.25, headY: -0.05,
      thLX: -0.2, knL: 0.45 });
    const S = P({ torsoY: 0.7, hipsRY: 0.05, torsoX: 0.02, hipsZ: 0.05, shRX: -1.6, shRZ: 0.75, elR: -0.02, ...POINT_R, clR: 0.25,
      headY: -0.65, headX: -0.08, thLX: -0.45, knL: 0.65, thRX: 0.12, knR: 0.1 });
    return own(strike(t, IMPACT.atk1, P({}), W, S, 0.34));
  },

  // 普攻二：左手反手點射。左手先收到右肩前（身體往右扭蓄勢），再反手掃出、伸直指向前方；右手收到腰後
  atk2({ t, P }) {
    const W = P({ torsoY: 0.85, hipsRY: 0.25, torsoX: -0.1, shLX: -1.25, shLZ: -0.5, elL: -2.0, ...POINT_L, wrL: 0.3,
      shRX: 0.3, shRY: 0, shRZ: 0.35, elR: -1.1, hoR: 0.7, headY: 0.05, thRX: -0.1, knR: 0.35 });
    const S = P({ torsoY: -0.4, hipsRY: -0.3, torsoX: 0.06, hipsZ: 0.06, shLX: -1.58, shLZ: 0.7, elL: -0.03, ...POINT_L, clL: 0.25,
      shRX: 0.5, shRY: 0, shRZ: 0.3, elR: -0.9, hoR: 0.7, headY: 0.4, headX: -0.08,
      thRX: -0.42, knR: 0.6, thLX: 0.18, knL: 0.18 });
    return own(strike(t, IMPACT.atk2, P({}), W, S, 0.38));
  },

  // 普攻三：甩尾轉身重射。骨盆先轉開（尾巴甩到身後一側）、右手高舉過頭蓄力 → 骨盆猛轉回來把尾巴甩出，
  // 上身前壓、右手全伸直往前下方點，左手往後甩平衡，前腳踏出
  atk3({ t, P }) {
    const W = P({ hipsRY: -0.95, hipsY: 0.1, torsoY: -0.4, torsoX: -0.24, headY: 0.4, headX: -0.28,
      shRX: -2.7, shRZ: 0.75, elR: -0.85, ...POINT_R, shLX: -0.55, shLY: 0, shLZ: 0.5, elL: -1.0, hoL: 0.8, hsL: 0.4,
      thLX: -0.12, knL: 0.45, anL: 0.5, thRX: 0.18, knR: 0.5, anR: 0.5 });
    const S = P({ hipsRY: 0.75, hipsY: -0.06, hipsZ: 0.2, torsoY: 0.3, torsoX: 0.45, headY: -0.6, headX: -0.2,
      shRX: -1.35, shRZ: 0.72, elR: -0.02, ...POINT_R, clR: 0.3, shLX: 0.75, shLY: 0, shLZ: 0.6, elL: -0.35, hoL: 0.95, hsL: 0.5,
      thLX: -0.65, thLZ: 0.1, knL: 0.6, thRX: 0.55, thRZ: 0.08, knR: 0.2, anR: 0.35 });
    return own(strike(t, IMPACT.atk3, P({}), W, S, 0.46));
  },

  // Q 死亡光束（0.12 秒射出）：右手先舉到臉旁、指尖朝天 → 側過身、手臂水平伸直、指尖對準，左手叉腰不動，
  // 射出後指尖往上輕輕一挑
  cast_Q({ t, P }) {
    const W = P({ torsoY: 0.1, torsoX: -0.2, hipsRY: -0.25, shRX: -2.35, shRZ: 0.5, elR: -1.75, ...POINT_R, wrR: 0.15, headY: -0.1, headX: -0.28 });
    const S = P({ torsoY: 1.05, hipsRY: 0.15, torsoX: -0.04, shRX: -1.62, shRZ: 1.2, elR: 0, ...POINT_R, clR: 0.25,
      headY: -0.9, headX: -0.02, thLX: -0.35, knL: 0.6 });
    const R = P({ ...S, wrR: -0.4, shRX: -1.78, torsoX: -0.1 });
    return own(track(t, [[0, P({})], [0.07, W], [0.12, S], [0.18, R], [0.27, P({})]]));
  },

  // W 死亡飛盤（0.14 秒擲出）：右手高舉、掌心朝天托著飛盤，上身後仰 → 手臂往前下方一甩擲出，身體前壓、前腳踏出
  overhead_W({ t, P }) {
    const W = P({ torsoX: -0.32, torsoY: -0.2, hipsRY: -0.3, headX: -0.45, headY: -0.15,
      shRX: -2.95, shRY: 0, shRZ: 0.35, elR: -0.3, wrR: -0.6, hoR: 1, hsR: 0.9, thLX: -0.15, knL: 0.4 });
    const S = P({ torsoX: 0.34, torsoY: 0.7, hipsRY: 0.25, hipsZ: 0.12, headX: -0.1, headY: -0.55,
      shRX: -1.25, shRY: 0, shRZ: 0.6, elR: -0.06, wrR: 0.25, hoR: 1, hsR: 0.6, clR: 0.25,
      thLX: -0.6, knL: 0.6, thRX: 0.38, knR: 0.15 });
    const F = P({ ...S, torsoX: 0.42, shRX: -0.75, shRZ: -0.45, torsoY: 0.85 });
    return own(track(t, [[0, P({})], [0.09, W], [0.14, S], [0.2, F], [0.29, P({})]]));
  },

  // R 死亡球（0.9 秒）：先微沉蓄勢，再把右手筆直舉過頭、一根手指撐起越長越大的能量球，身體緩緩浮高；左手始終叉腰
  overhead_R({ t, P }) {
    const dip = P({ hipsY: 0.0, torsoX: 0.14, headX: 0.08, shRX: -0.9, shRZ: 0.3, elR: -1.9, ...POINT_R, knL: 0.75, knR: 0.4 });
    return own(track(t, [[0, P({})], [0.12, dip], [0.3, ballUp(P, 0.04)], [0.9, ballUp(P, 0.14)]]));
  },

  // R 擲出（死亡球結束後接的 cast，0.35 秒；球在第 0 格就飛出）：從舉球的最後一格出發，0.1 秒內手往前下方一指、身體前壓把球「放」下去，停住再收回
  cast_R({ t, P }) {
    const hold = ballUp(P, 0.14);
    const S = P({ hipsY: 0.1, torsoX: 0.4, torsoY: 0.6, hipsZ: 0.1, headX: 0.05, headY: -0.5,
      shRX: -1.05, shRZ: 0.4, elR: -0.02, ...POINT_R, clR: 0.3, thLX: -0.5, knL: 0.65, anL: 0.45, thRX: 0.32, knR: 0.2 });
    return own(track(t, [[0, hold], [0.03, hold], [0.1, S], [0.22, S], [0.34, P({})]]));
  },

  // E 瞬移：身子一縮、右手往外一撥（殘像），不轉圈
  vanish_E({ t, P }) {
    const k = ease(clamp(t / 0.1, 0, 1));
    return own(lerpPose(P({}), P({ hipsY: 0.12, torsoX: 0.2, torsoY: -0.4, headX: -0.1, shRX: -0.6, shRY: 0, shRZ: 0.9, elR: -0.2, hoR: 1, hsR: 0.6,
      thLX: -0.4, knL: 0.9, thRX: -0.1, knR: 0.6, anL: 0.6, anR: 0.6 }), k));
  },

  // 勝利：手背掩嘴「呵呵呵」的高笑，頭往後仰，左手叉腰，笑得肩膀一抖一抖
  win({ t, P }) {
    const b = Math.abs(Math.sin(t * 7)) * ease(clamp(t / 0.4, 0, 1));
    return own(P({ hipsY: 0.07, torsoX: -0.2 - 0.04 * b, torsoY: 0.3, headX: -0.4 - 0.08 * b, headY: -0.3, headZ: 0.1,
      shRX: -1.2 - 0.05 * b, shRY: 0, shRZ: -0.2, elR: -2.3, wrR: 0.6, hoR: 0.75, hsR: 0.3 }));
  },
};
// 沒帶技能鍵的同名動作（除錯工具、其他路徑）沿用招牌招式
moves.cast = moves.cast_Q;
moves.overhead = moves.overhead_R;
export default moves;
