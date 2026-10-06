// trunks 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（strike、lerpPose、ease、clamp、IMPACT…）。
//
// 未來特南克斯：劍收在背上（右手扣在肩後的劍柄上），出劍時從背後拔出（atk*、dash 時劍在手上，其他動作劍回背上）。
// 架式的右手腕對過：劍在手上時的劍身方向和背上劍鞘的方向一致，所以拔劍、收劍那一格換插槽看不出跳動。
// 普攻三段：拔劍袈裟斬 → 反手橫斬 → 雙手縱劈（劈開弗利沙那一刀）。
// Q 魔閃光（cast_Q）：雙掌疊在頭頂 → 向前推出。W 閃光斬（dash_W）：橫刀穿過 → 左掌補一發氣彈（cast，沒有技能鍵；劍還在右手，收尾才收回背上）。
// R 熱圓頂攻擊：豎劍蓄勢（dash_R）→ 閃到身邊原地上挑、收劍、結燃燒攻擊的菱形手印、雙掌朝斜上方推出（atk3_R）→ 撐住推掌、圓頂爆炸（beam_R）。
// 劍在右拳裡和前臂垂直、從虎口伸出；wrR 往正彎讓劍身順著前臂延伸。劍的角度用無頭量測對過（劍尖不入地）。
// 時間：姿勢以 rate 32（τ≈31 ms）跟隨，所以關鍵姿勢比想要的影格早約 0.03 秒到位、並停住 ≥0.05 秒；收勢都在 combat.js 的 dur 內做完。
import { blank, lerpPose, ease, clamp } from '../pose-kit.js';

// 實際命中時間＝combat.js 的 wind × min(1, 攻速 0.74 / 0.8)；動作長度 dur＝wind＋0.28
const HIT = { atk1: 0.111, atk2: 0.13, atk3: 0.185 };
const DUR = { atk1: 0.39, atk2: 0.41, atk3: 0.465 };
const GRIP = { hoR: 0, hsR: 0 }; // 握劍：右拳收緊、拇指扣住
// 架式裡扣住背後劍柄的右臂（相對胸口，所以不管上身怎麼擺，手都在劍柄上）；
// 角度用無頭量測最佳化過：完全到位時手上的劍和背上的劍鞘幾乎重合（柄端差約 5 公分、劍尖差約 3 公分），收劍換插槽不跳
const HILT = { shRX: -3.02, shRZ: 0.85, shRY: -0.05, elR: -2.6, wrR: 0.64, hoR: 0.1, hsR: 0.1 };

// 依時間在關鍵姿勢之間內插：keys = [[時間, 姿勢], …]（時間遞增）
function seq(t, keys) {
  if (t <= keys[0][0]) return { ...keys[0][1] };
  for (let i = 1; i < keys.length; i++) {
    const [t1, b] = keys[i];
    if (t < t1) { const [t0, a] = keys[i - 1]; return lerpPose(a, b, ease((t - t0) / (t1 - t0))); }
  }
  return { ...keys[keys.length - 1][1] };
}
// 劍招時間軸：架式 → W 預備（ti×0.4，停到 ti×0.5）→ 加速揮到 S（比命中早 lead 秒到位，停到命中後 0.025）→
// 減速送到 F（揮完的收勢）→ 停一下 → 在 dur 前 0.03 秒回到架式。M（選填）是 W→S 正中間的姿勢，控制刀路（反手橫斬要保持水平）。
function cut(t, ti, dur, base, W, S, F, M, lead = 0.035) {
  const a = ti * 0.4 - (M ? 0.008 : 0), b = a + ti * 0.1, s = ti - lead;
  if (t < a) return lerpPose(base, W, ease(t / a));
  if (t < b) return { ...W };
  if (t < s) {
    const u = (t - b) / (s - b);
    if (M) return u < 0.5 ? lerpPose(W, M, (u * 2) ** 2) : lerpPose(M, S, (u - 0.5) * 2);
    return lerpPose(W, S, u * u * (2 - u)); // 出手越來越快
  }
  if (t < ti + 0.025) return { ...S };
  if (t < ti + 0.085) return lerpPose(S, F, Math.sin((Math.PI / 2) * ((t - ti - 0.025) / 0.06)));
  if (t < ti + 0.13) return { ...F };
  return lerpPose(F, base, ease(clamp((t - ti - 0.13) / Math.max(0.05, dur - 0.03 - ti - 0.13), 0, 1)));
}
const own = (p) => { p.ownHands = true; return p; }; // 手形自己決定，不套 models.js 的 HAND_OPEN

export default {
  // 架式：左腳在前半身側轉，左拳護在胸骨前，右手翻到右肩後扣住背上的劍柄，有呼吸起伏
  stance({ t }) {
    const p = blank();
    const br = Math.sin(t * 2.6), sway = Math.sin(t * 1.3);
    Object.assign(p, {
      hipsY: -0.1 - 0.012 * br, hipsRY: 0.25, hipsRZ: 0.03 * sway, torsoX: 0.12 + 0.015 * br, torsoY: 0.45, torsoZ: -0.03, headY: -0.5, headX: -0.06,
      shLX: -0.63 - 0.03 * br, shLZ: -0.22, shLY: -0.4, elL: -1.6, hoL: 0, hsL: 0,
      ...HILT,
      thLX: -0.45, thLZ: 0.2, knL: 0.6, thRX: 0.38, thRZ: 0.18, knR: 0.55,
    });
    return p;
  },

  // 一段：拔劍袈裟斬——右手從肩後拔劍高舉（劍尖朝後），右肩送出、斜劈到左前下，收勢時劍橫在身體左側
  atk1({ t, P, base }) {
    const W = P({ ...GRIP, torsoY: -0.2, torsoX: 0.0, hipsRY: 0.05, shRX: -2.8, shRZ: 0.7, shRY: 0.2, elR: -0.8, wrR: 0.3,
      shLX: -0.9, shLZ: 0.25, elL: -1.5, hipsY: -0.12, knL: 0.7, knR: 0.65, headY: -0.6, headX: -0.15 });
    const S = P({ ...GRIP, torsoY: 0.85, torsoX: 0.32, hipsRY: 0.45, shRX: -0.63, shRZ: 0.47, shRY: 0.8, elR: -0.2, wrR: 0.5,
      shLX: 0.45, shLZ: 0.35, elL: -1.6, hipsZ: 0.2, hipsY: -0.16,
      thLX: -0.8, thLZ: 0.24, knL: 0.95, thRX: 0.7, thRZ: 0.14, knR: 0.12, headY: -0.7, headX: 0.05 });
    const F = P({ ...GRIP, torsoY: 0.95, torsoX: 0.35, hipsRY: 0.5, shRX: -0.75, shRZ: -0.35, shRY: 0, elR: -0.12, wrR: 0.9,
      shLX: 0.5, shLZ: 0.4, elL: -1.6, hipsZ: 0.22, hipsY: -0.17,
      thLX: -0.82, thLZ: 0.24, knL: 0.98, thRX: 0.72, thRZ: 0.14, knR: 0.1, headY: -0.7, headX: 0.05 });
    return cut(t, HIT.atk1, DUR.atk1, base, W, S, F, null, 0.045);
  },

  // 二段：反手橫斬——劍平收到左肩後（劍尖朝左後），身體反轉把劍水平掃過正前方，收勢甩到右後；左拳讓開刀路、收在左腰
  atk2({ t, P, base }) {
    const W = P({ ...GRIP, torsoY: 1.0, hipsRY: 0.5, torsoX: 0.2, shRX: -1.9, shRZ: -0.79, shRY: -1.56, elR: -1.77, wrR: 1.6,
      shLX: -0.2, shLZ: 0.5, elL: -1.5, hipsY: -0.14, knL: 0.75, knR: 0.7, headY: -0.7 });
    const M = P({ ...GRIP, torsoY: 0.2, hipsRY: 0.15, torsoX: 0.25, shRX: -1.13, shRZ: 0.48, shRY: -1.36, elR: -1.22, wrR: 1.49,
      shLX: -0.3, shLZ: 0.55, elL: -1.4, hipsY: -0.16, hipsZ: 0.12, thLX: -0.65, thLZ: 0.26, knL: 0.9, thRX: 0.55, knR: 0.35, headY: -0.2 });
    const S = P({ ...GRIP, torsoY: -0.75, hipsRY: -0.3, torsoX: 0.25, torsoZ: 0.1, shRX: -1.9, shRZ: -0.51, shRY: -1.06, elR: -0.48, wrR: 1.06,
      shLX: -0.4, shLZ: 0.6, elL: -1.3, hipsZ: 0.22, hipsY: -0.17,
      thLX: -0.85, thLZ: 0.3, knL: 1.0, thRX: 0.7, thRZ: 0.2, knR: 0.15, headY: 0.2 });
    const F = P({ ...GRIP, torsoY: -0.85, hipsRY: -0.35, torsoX: 0.25, torsoZ: 0.12, shRX: -1.1, shRZ: 0.76, shRY: -1.0, elR: 0, wrR: 1.6,
      shLX: -0.55, shLZ: 0.65, elL: -1.2, hipsZ: 0.24, hipsY: -0.18,
      thLX: -0.88, thLZ: 0.3, knL: 1.02, thRX: 0.72, thRZ: 0.2, knR: 0.12, headY: 0.25 });
    return cut(t, HIT.atk2, DUR.atk2, base, W, S, F, M, 0.05);
  },

  // 三段：雙手縱劈——起身把劍高舉過頭（劍尖垂到背後），雙手握柄一刀劈下：命中時劍身水平、收勢劍尖斜指前膝，深弓步壓低
  atk3({ t, P, base }) {
    const two = { ...GRIP, hoL: 0, hsL: 0 };
    const W = P({ ...two, torsoY: 0.2, hipsRY: 0.15, torsoX: -0.3, hipsY: -0.02, shRX: -2.24, shRZ: 0.21, shRY: -0.56, elR: -0.6, wrR: -0.18,
      shLX: -2.56, shLZ: -0.28, shLY: 0.32, elL: -0.48, wrL: -0.1, // 左拳收到中線、扣在右拳下方的劍柄上（量測對過）
      thLX: -0.6, knL: 0.8, thRX: 0.3, knR: 0.5, anR: 0.3, headX: -0.3, headY: -0.3 });
    const S = P({ ...two, torsoY: 0.3, hipsRY: 0.2, torsoX: 0.33, hipsRX: 0.18, hipsY: -0.22, hipsZ: 0.25, shRX: -1.65, shRZ: 0.44, shRY: 0.66, elR: -0.05, wrR: 0.8,
      shLX: -1.37, shLZ: -0.33, shLY: -0.31, elL: -0.1,
      thLX: -1.0, thLZ: 0.25, knL: 1.2, thRX: 0.75, thRZ: 0.15, knR: 0.2, headX: 0.1, headY: -0.3 });
    const F = P({ ...two, torsoY: 0.3, hipsRY: 0.2, torsoX: 0.35, hipsRX: 0.24, hipsY: -0.25, hipsZ: 0.27, shRX: -1.2, shRZ: 0.44, shRY: 0.66, elR: -0.05, wrR: 0.55,
      shLX: -1.08, shLZ: -0.55, shLY: -0.31, elL: -0.1,
      thLX: -1.05, thLZ: 0.25, knL: 1.28, thRX: 0.78, thRZ: 0.15, knR: 0.18, headX: 0.15, headY: -0.3 });
    return cut(t, HIT.atk3, DUR.atk3, base, W, S, F, null, 0.045);
  },

  // Q 魔閃光：雙掌疊在頭頂聚氣（0.055～0.075），0.105 秒向前推到底（0.14 秒出波時手臂已打直、雙掌疊在正前方），撐到 0.22 再收（dur 0.32）
  cast_Q({ t, P, base }) {
    const tr = Math.sin(t * 60) * 0.02;
    const up = P({ torsoY: 0.1, hipsRY: 0.15, torsoX: -0.3, headX: -0.35, headY: -0.15, hipsY: -0.08,
      shLX: -2.7, shLZ: -0.3, shLY: 0, elL: -0.5, wrL: -0.3, shRX: -2.7, shRZ: -0.3, shRY: 0, elR: -0.5, wrR: -0.3,
      hoL: 1, hoR: 1, hsL: 0.8, hsR: 0.8, thLX: -0.4, knL: 0.5, thRX: 0.35, knR: 0.45 });
    const push = P({ torsoY: 0, hipsRY: 0.05, torsoX: 0.25 + tr, headX: 0.0, headY: 0, hipsY: -0.17, hipsZ: 0.16,
      shLX: -1.8, shLZ: -0.12, shLY: 0, elL: -0.05, wrL: -0.8, shRX: -1.72, shRZ: 0.05, shRY: 0, elR: -0.05, wrR: -0.8,
      hoL: 1, hoR: 1, hsL: 0.9, hsR: 0.9, thLX: -0.85, thLZ: 0.25, knL: 0.95, thRX: 0.7, thRZ: 0.15, knR: 0.15 });
    return own(seq(t, [[0, base], [0.055, up], [0.075, up], [0.105, push], [0.22, push], [0.3, base]]));
  },

  // W 閃光斬：穿身判定在衝刺一開始就生效，所以劍只在左肩後擺 1～2 格當預備（和二段同一個架勢，手在頭後不穿過臉），
  // 0.055 就橫掃穿過、整段滑行都把劍拖在右後方；0.15 起左掌推向前方，衝刺在 0.25 結束時剛好接上 cast 的氣彈
  dash_W({ t, P }) {
    const guard = P({ ...GRIP, prop: 1, torsoY: 0.9, hipsRY: 0.45, torsoX: 0.3, hipsY: -0.16, shRX: -1.9, shRZ: -0.79, shRY: -1.56, elR: -1.77, wrR: 1.6,
      shLX: -0.2, shLZ: 0.5, elL: -1.5, hoL: 0, thLX: -0.8, knL: 1.0, thRX: 0.6, knR: 0.3, headY: -0.7 });
    const thru = P({ ...GRIP, prop: 1, torsoY: -0.8, hipsRY: -0.3, torsoX: 0.35, hipsRX: 0.3, hipsY: -0.2, hipsZ: 0.12, shRX: -1.0, shRZ: 1.3, shRY: 0.3, elR: -0.05, wrR: 1.25,
      shLX: -1.0, shLZ: 0.2, elL: -1.7, hoL: 0, hsL: 0, thLX: -0.75, thLZ: 0.3, knL: 1.0, thRX: 0.85, thRZ: 0.2, knR: 0.25, headY: 0.1, headX: -0.2 });
    const palm = { ...thru, ...castArms(0.62), torsoY: -0.3, hipsRY: -0.3, torsoX: 0.2, hipsRX: 0.12, headY: 0.3 };
    return own(seq(t, [[0, guard], [0.015, guard], [0.055, thru], [0.15, thru], [0.205, palm]]));
  },

  // W 收尾（衝刺結束後補一發氣彈，沒有技能鍵；氣彈在 t=0 就射出）：左掌在正前方推出、右手握劍收在右腰後，
  // 0.1 後右手把劍送回肩後劍柄的位置（0.165 到位；架式的右手也扣在劍柄上，所以手停在原處、只有身體回到架式），
  // 0.275 才換回背上（跟隨的殘差已收斂，換插槽不跳），0.29 回到架式（dur 0.3）
  cast({ t, P, base }) {
    const body = { torsoY: -0.15, hipsRY: -0.3, torsoX: 0.3, hipsY: -0.18, hipsZ: 0.14, thLX: -0.85, thLZ: 0.25, knL: 0.95, thRX: 0.65, knR: 0.12, headY: 0.3 };
    const S = P({ ...body, ...castArms(), prop: 1 });
    const sheathe = P({ ...body, ...castArms(), ...HILT, prop: 1, torsoX: 0.2, hipsY: -0.14, elL: -0.5 });
    const p = seq(t, [[0, S], [0.1, S], [0.165, sheathe], [0.29, P({ prop: -1 })]]);
    p.prop = t < 0.275 ? 1 : -1;
    return own(p);
  },

  // R 前奏（慢動作特寫）：從背後拔劍過頭頂 → 劍豎在臉前、左掌貼在劍柄上方（0.055～0.085）→ 0.12 右臂往下帶、劍尖往後下甩 →
  // 0.165 壓低身體把劍拖到右後下方（停到 0.22 閃身）
  dash_R({ t, P }) {
    const salute = P({ ...GRIP, prop: 1, torsoY: 0.15, hipsRY: 0.1, torsoX: 0.0, headX: -0.1, headY: -0.15, hipsY: -0.08,
      shRX: -0.24, shRZ: -0.08, shRY: -0.25, elR: -1.95, wrR: 0.23,
      shLX: -1.39, shLZ: -0.42, shLY: -0.4, elL: -1.32, hoL: 1, hsL: 0.4,
      thLX: -0.3, thLZ: 0.22, knL: 0.4, thRX: 0.25, thRZ: 0.2, knR: 0.35 });
    const low = lowGuard(P);
    // 中途右臂伸直往下帶、劍尖往後下甩（這組角度用實機時間軸最佳化過：劍尖一直離地 ≥0.3、不穿過身體），再壓低拖到右後下方
    const mid = { ...lerpPose(salute, low, 0.45), shRX: 0.81, shRZ: -0.63, shRY: -1.19, elR: 0, wrR: 1.6 };
    const draw = { ...salute, shRX: -2.8, shRZ: 0.7, shRY: 0.2, elR: -0.8, wrR: 0.3, shLX: -0.9, shLZ: 0.25, shLY: 0, elL: -1.5, hoL: 0 }; // 先把劍從背後拔過頭頂，劍身不穿過臉
    return own(seq(t, [[0, draw], [0.02, draw], [0.055, salute], [0.085, salute], [0.12, mid], [0.165, low]]));
  },

  // R 上挑（傷害、火花在 t=0，閃身那一格是低架）：劍尖先繞到右側再挑過正前方，0.04 劍已朝天（實際畫面 0.03～0.05 劍身掃過敵人高度），
  // 原地提左膝的上挑，不跳 → 把劍送回肩後（0.12 到位、0.22 換回背上）→ 額前結菱形手印（0.28～0.33）→
  // 0.365 雙掌已推到斜上方，接 beam_R 時（爆炸、震動那一格）手臂已經打直
  atk3_R({ t, P }) {
    const S = P({ ...GRIP, prop: 1, torsoY: -0.35, hipsRY: -0.15, torsoX: -0.3, hipsY: 0.12, hipsZ: 0.12, shRX: -2.65, shRZ: 0.2, shRY: 0, elR: -0.05, wrR: 1.1,
      shLX: 0.35, shLZ: 0.85, elL: -0.4, hoL: 1, hsL: 0.8, thLX: -1.05, thLZ: 0.2, knL: 1.5, thRX: 0.35, thRZ: 0.1, knR: 0.12, anR: 0.4, toR: -0.3, headX: -0.5, headY: 0.1 });
    const follow = { ...S, torsoX: -0.2, shRX: -2.5, hipsY: 0.08 }; // 揮到頂後的餘勢（原地上挑、提左膝，不跳）
    const sheathe = P({ ...HILT, prop: 1, torsoY: 0, hipsRY: 0, torsoX: -0.05, hipsY: -0.06, hipsZ: 0.05, headX: -0.25,
      shLX: -1.6, shLZ: -0.1, elL: -1.3, wrL: -0.5, hoL: 1, hsL: 1, thLX: -0.6, thLZ: 0.3, knL: 0.85, thRX: 0.3, thRZ: 0.25, knR: 0.55 });
    const low = lowGuard(P);
    // 上挑途中右臂先往外側抬、劍尖從右側繞到前方（這兩組角度用實機時間軸最佳化過：跟隨的殘差下劍尖一直離地 ≥0.35）
    const rise = { ...lerpPose(low, S, 0.35), shRX: -0.72, shRZ: 1.78, shRY: -0.6, elR: -0.82, wrR: 1.16 };
    const side = { ...lerpPose(low, S, 0.15), shRX: -0.57, shRZ: 2.0, shRY: 0.83, elR: -0.26, wrR: 1.33 }; // 劍尖先轉到右側
    const p = seq(t, [[0, low], [0.012, side], [0.026, rise], [0.04, S], [0.065, follow], [0.12, sheathe], [0.225, sheathe],
      [0.28, sign(P)], [0.33, sign(P)], [0.365, domePush(P, 0)]]);
    p.prop = t < 0.22 ? 1 : -1;
    return own(p);
  },

  // R 熱圓頂（爆炸在 t=0）：雙掌已在 atk3_R 的結尾推到斜上方，這裡只撐住（掌心微顫）到 0.5，0.62 收回（dur 內做完）
  beam_R({ t, P }) {
    const S = domePush(P, Math.sin(t * 55) * 0.025);
    return own(seq(t, [[0, S], [0.5, S], [0.62, P({ prop: -1 })]]));
  },

  // E 旋風跳：整段在遊戲裡隱身（main.js），只有收尾的姿勢會被看到——縮身旋一圈（剛好 2π）後落成蹲低的著地姿勢
  vanish_E({ t, P }) {
    const k = ease(clamp(t / 0.05, 0, 1)), land = ease(clamp((t - 0.07) / 0.05, 0, 1)), up = Math.sin(Math.PI * clamp(t / 0.1, 0, 1));
    const tuck = (1 - land) * k;
    return own(P({ hipsY: -0.12 + 0.3 * up * k - 0.08 * land, hipsRX: 0.25 * tuck, torsoX: 0.55 * tuck + 0.1 + 0.15 * land, torsoY: 0.2 * land, headX: -0.3, headY: 0,
      shLX: -1.35, shLZ: -0.3, elL: -2.1, hoL: 0, shRX: -1.25, shRZ: -0.25, shRY: 0, elR: -2.1, hoR: 0,
      thLX: -1.1 * tuck - 0.2 - 0.4 * land, thLZ: 0.2, knL: 1.9 * tuck + 0.3 + 0.6 * land, thRX: -0.9 * tuck + 0.3 * land, thRZ: 0.2, knR: 2.0 * tuck + 0.2 + 0.5 * land,
      toL: 0.4 * tuck, toR: 0.4 * tuck,
      spin: 2 * Math.PI * ease(clamp(t / 0.1, 0, 1)) }));
  },

  // 勝利：人造人篇的招牌站姿——雙手抱胸（右手塞在左上臂下）、重心落在後腳、側頭斜看（呼吸時肩微微起伏）
  win({ t, P }) {
    const b = Math.sin(t * 2.2);
    return P({ hipsY: -0.03 + 0.008 * b, hipsRY: 0.2, hipsRZ: 0.06, torsoX: -0.06 + 0.01 * b, torsoY: 0.25, torsoZ: -0.04, headX: -0.12, headY: -0.45, headZ: 0.08,
      shLX: -0.55, shLZ: 0.1, shLY: -1.3, elL: -1.9, wrL: 0, hoL: 0, hsL: 0, shRX: -0.42, shRZ: 0.12, shRY: -1.45, elR: -1.85, wrR: 0, hoR: 0, hsR: 0,
      thLX: -0.2, thLZ: 0.16, knL: 0.22, thRX: 0.14, thRZ: 0.14, knR: 0.08 });
  },
};

const BEAM_LEGS = { thLX: -0.5, thLZ: 0.35, knL: 0.8, thRX: 0.4, thRZ: 0.3, knR: 0.45 };
// W 收尾的手臂：左掌在身體中線前方推出（掌根朝前）、右拳握劍收在右腰後（劍尖朝右後下）
function castArms(z = 0.42) {
  return { shLX: -1.7, shLZ: z, shLY: -0.4, elL: -0.05, wrL: -0.6, hoL: 1, hsL: 0.6,
    shRX: 0.44, shRZ: -0.21, shRY: 1.6, elR: -1.05, wrR: 1.4, hoR: 0, hsR: 0 };
}
// R 的低架：深蹲、上身往左扭，劍拖在右後下方（dash_R 的結尾＝atk3_R 的預備）
function lowGuard(P) {
  return P({ ...GRIP, prop: 1, torsoY: 0.5, hipsRY: 0.25, torsoX: 0.45, headX: -0.25, headY: -0.45, hipsY: -0.24,
    shRX: 1.04, shRZ: 0.58, shRY: -0.71, elR: -0.32, wrR: 1.42,
    shLX: -1.3, shLZ: 0.5, elL: -0.5, hoL: 1, hsL: 0.8,
    thLX: -0.95, thLZ: 0.3, knL: 1.35, thRX: 0.55, thRZ: 0.25, knR: 1.0 });
}
// 熱圓頂的推掌：雙掌朝斜上方推出、大開步撐地、上身後仰（tr 是顫動）
function domePush(P, tr) {
  return P({ ...BEAM_LEGS, prop: -1, torsoY: 0, hipsRY: 0, torsoX: -0.26 + tr, headX: -0.5, headY: 0, hipsY: -0.22, hipsZ: -0.04,
    shLX: -2.21, shLZ: 0.13, shLY: 0.28, elL: 0, wrL: -0.6, shRX: -2.21, shRZ: 0.13, shRY: 0.28, elR: 0, wrR: -0.6, hoL: 1, hoR: 1, hsL: 1, hsR: 1,
    thLX: -0.7, thLZ: 0.4, knL: 0.95, thRX: 0.55, thRZ: 0.35, knR: 0.3 });
}
// 燃燒攻擊的菱形手印：雙掌在額前併攏（拇指與食指圍成菱形），手肘張開、上身微後仰
function sign(P) {
  return P({ ...BEAM_LEGS, prop: -1, torsoY: 0, hipsRY: 0, torsoX: -0.15, headX: -0.35, headY: 0, hipsY: -0.17, hipsZ: 0,
    shLX: -1.34, shLZ: -0.08, shLY: -0.15, elL: -1.1, wrL: -0.9, shRX: -1.34, shRZ: -0.08, shRY: -0.15, elR: -1.1, wrR: -0.9, hoL: 1, hoR: 1, hsL: 1, hsR: 1 });
}
