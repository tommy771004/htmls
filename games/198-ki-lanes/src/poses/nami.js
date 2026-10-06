// nami 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（strike、lerpPose、ease、clamp、IMPACT…）。
//
// 娜美：航海士，不是打架型。天候棒（右手，只有普攻時拿在手上）打出輕快的棍法；技能時雙手空著，
// 用手勢指揮天氣：舉手招雷（Q）、捧手吹冷氣泡（W）、單腳旋轉颳旋風（E）、雙手高舉喚雷雲再一指劈下（R）。
// 天候棒插在拳頭裡、和前臂垂直從虎口伸出：wrR 0 時棍子朝掌心前方，wrR 往正彎到約 1.2 棍子就順著手臂延伸出去。
import { lerpPose, ease, clamp } from '../pose-kit.js';

// 關鍵幀時間軸：frames = [[時間, 姿勢], …]，相鄰兩格之間用 ease 內插；超出範圍就停在最後一格
function track(t, frames) {
  if (t <= frames[0][0]) return { ...frames[0][1] };
  for (let i = 1; i < frames.length; i++) {
    const [t1, b] = frames[i];
    if (t < t1) {
      const [t0, a] = frames[i - 1];
      return lerpPose(a, b, ease((t - t0) / (t1 - t0)));
    }
  }
  return { ...frames[frames.length - 1][1] };
}
// 出手越來越快的內插（揮棍的加速段）
function snap(a, b, u) { u = clamp(u, 0, 1); return lerpPose(a, b, u * u * (2 - u)); }
const own = (p) => { p.ownHands = true; return p; };

// 待機：左手叉腰、骨盆往右推出（重心在右腳）、左腳尖輕點，右手放鬆垂在身側；呼吸帶肩胸起伏、髖部輕擺
// 叉腰要把左上臂內旋（shLY），共用動作（跑、受擊、倒地…）不會把 shLY 歸零，所以只在自己的動作裡叉腰
function stance({ t, name, key }) {
  const br = Math.sin(t * 2.6), sway = Math.sin(t * 1.1);
  return {
    hipsY: -0.03 - 0.008 * br, hipsZ: 0, hipsRX: 0, hipsRY: -0.18, hipsRZ: -0.17 + 0.02 * sway,
    torsoX: 0.02 + 0.012 * br, torsoY: 0.28, torsoZ: 0.17 - 0.02 * sway, headX: -0.06, headY: -0.24, headZ: -0.15,
    ...(MINE.has(name) || MINE.has(name + '_' + key) ? HIP_L : HIP_GENERIC), // 左手叉腰
    shRX: -0.28, shRY: 0, shRZ: 0.28, elR: -0.55, // 右手鬆垂、微彎
    thLX: -0.28, thLZ: -0.08, knL: 0.42, thRX: 0.04, thRZ: 0.14, knR: 0.04, // 左腳在前、膝內收（腳尖點地）；右腳打直撐重
    spin: 0, stretch: 0, wrR: 0.15, anL: 0.25, anR: 0, clL: 0, clR: 0,
    hoR: 0.6, hsR: 0.35, toL: 0, toR: 0,
  };
}
// 叉腰的左手：上臂往外後張、往內旋，手肘彎向後方，手掌貼在腰側（只彎手肘的話前臂會往前伸，不像叉腰）
const HIP_L = { shLX: 0.55, shLY: -0.9, shLZ: 0.9, elL: -1.55, wrL: 0.1, hoL: 0.85, hsL: 0.2 };
const HIP_GENERIC = { shLX: -0.15, shLY: 0, shLZ: 0.6, elL: -1.65, wrL: 0, hoL: 0.55, hsL: 0.3 };
const MINE = new Set(['idle', 'atk1', 'atk2', 'atk3', 'win', 'cast_Q', 'cast_W', 'barrier_E', 'overhead_R']);
// 自己的動作：覆寫左臂時順手把叉腰的內旋歸零
const fixL = (fn) => (ctx) => fn({ ...ctx, P: (o) => ctx.P('shLX' in o && !('shLY' in o) ? { shLY: 0, ...o } : o) });

// 普攻一：正手斜劈——天候棒從右上方掄到左下，左手往前伸出瞄準
function atk1({ t, P }) {
  const W = P({ hipsY: -0.07, hipsRY: -0.35, hipsRZ: 0, torsoX: -0.05, torsoY: -0.55, torsoZ: 0, headX: -0.1, headY: 0.35, headZ: 0,
    shRX: -2.5, shRZ: 0.7, elR: -1.35, wrR: -0.3, shLX: -1.25, shLZ: 0.2, elL: -0.35, hoL: 1, hsL: 0.7, wrL: -0.2,
    thLX: -0.35, thLZ: 0.12, knL: 0.55, thRX: 0.2, thRZ: 0.16, knR: 0.45, hoR: 0 });
  const S = P({ hipsY: -0.11, hipsZ: 0.14, hipsRY: 0.3, hipsRZ: 0, torsoX: 0.32, torsoY: 0.62, torsoZ: -0.05, headX: -0.15, headY: -0.45, headZ: 0,
    shRX: -0.95, shRZ: -0.25, elR: -0.1, wrR: 0.2, shLX: 0.45, shLZ: 0.55, elL: -0.7, hoL: 0.8, hsL: 0.5, wrL: 0,
    thLX: -0.72, thLZ: 0.16, knL: 0.7, thRX: 0.55, thRZ: 0.12, knR: 0.12, anR: 0.3, hoR: 0 });
  return own(swing(t, 0.11, ctxBase(P), W, S, 0.36));
}
// 普攻二：反手橫掃——收棍到左肩，再往右甩開，順勢右腳踏出
function atk2({ t, P }) {
  const W = P({ hipsY: -0.08, hipsRY: 0.3, hipsRZ: 0, torsoX: 0.05, torsoY: 0.85, torsoZ: 0, headX: -0.08, headY: -0.6, headZ: 0,
    shRX: -1.3, shRZ: -0.55, elR: -1.55, wrR: 0.2, shLX: 0.35, shLZ: 0.75, elL: -0.6, hoL: 0.9, hsL: 0.5, wrL: 0,
    thLX: -0.15, thLZ: 0.05, knL: 0.45, thRX: 0.1, thRZ: 0.05, knR: 0.5, hoR: 0 });
  const S = P({ hipsY: -0.17, hipsZ: 0.14, hipsRY: -0.45, hipsRZ: 0, torsoX: 0.3, torsoY: -0.85, torsoZ: 0.2, headX: -0.1, headY: 0.5, headZ: 0,
    shRX: -1.45, shRZ: 1.2, elR: -0.08, wrR: 1.1, shLX: -1.0, shLZ: 0.45, elL: -0.55, hoL: 1, hsL: 0.8, wrL: -0.2,
    thLX: 0.5, thLZ: 0.2, knL: 0.25, thRX: -0.75, thRZ: 0.3, knR: 0.75, anL: 0.3, hoR: 0 });
  return own(swing(t, 0.13, ctxBase(P), W, S, 0.4));
}
// 普攻三（每第三下落雷）：天候棒直指天空、身體後仰、右腳往後勾起；再整個人撲出去把棍子劈向敵人
function atk3({ t, P }) {
  const base = ctxBase(P);
  const W = P({ hipsY: 0.0, hipsZ: -0.04, hipsRX: 0, hipsRY: -0.1, hipsRZ: 0, torsoX: -0.32, torsoY: -0.2, torsoZ: 0.05, headX: -0.5, headY: 0.1, headZ: 0,
    shRX: -3.0, shRZ: 0.12, elR: -0.12, wrR: 1.2, shLX: -0.35, shLZ: 1.05, elL: -0.35, hoL: 1, hsL: 0.8, wrL: 0,
    thLX: -0.06, thLZ: 0.08, knL: 0.08, thRX: 0.38, thRZ: 0.1, knR: 1.45, anL: 0.25, anR: 0.4, hoR: 0 });
  const S = P({ hipsY: -0.17, hipsZ: 0.2, hipsRX: 0.08, hipsRY: 0.25, hipsRZ: 0, torsoX: 0.48, torsoY: 0.4, torsoZ: -0.05, headX: 0.0, headY: -0.35, headZ: 0,
    shRX: -1.35, shRZ: 0.0, elR: -0.05, wrR: 0.7, shLX: 0.65, shLZ: 0.6, elL: -0.45, hoL: 0.9, hsL: 0.6, wrL: 0,
    thLX: -0.85, thLZ: 0.18, knL: 0.95, thRX: 0.7, thRZ: 0.12, knR: 0.15, anR: 0.35, hoR: 0 });
  const ti = 0.19;
  let p;
  if (t < 0.11) p = lerpPose(base, W, ease(t / 0.11));
  else if (t < 0.14) p = { ...W }; // 舉棍停一拍（蓄力）
  else if (t < ti) p = snap(W, S, (t - 0.14) / (ti - 0.14));
  else if (t < ti + 0.1) p = { ...S };
  else p = lerpPose(S, base, ease(clamp((t - ti - 0.1) / 0.2, 0, 1)));
  return own(p);
}

// 揮擊：base → W（ti×0.55）→ S（ti，越來越快）→ 停一下 → 收回
function swing(t, ti, base, W, S, rec) {
  const a = ti * 0.55;
  if (t < a) return lerpPose(base, W, ease(t / a));
  if (t < ti) return snap(W, S, (t - a) / (ti - a));
  if (t < ti + 0.07) return { ...S };
  return lerpPose(S, base, ease(clamp((t - ti - 0.07) / Math.max(0.05, rec - ti - 0.07), 0, 1)));
}
const ctxBase = (P) => P({});

// Q 雷霆節拍：右手往下收→猛然高舉到天上（掌心朝天招雷）、左手叉腰、後腳勾起；最後一指劈向落雷處
function cast_Q({ t, P }) {
  const gather = P({ hipsY: -0.1, hipsRY: 0.1, torsoX: 0.18, torsoY: 0.45, torsoZ: 0, headX: 0.05, headY: -0.3, headZ: 0,
    shRX: -0.35, shRZ: -0.3, elR: -1.6, wrR: 0.3, hoR: 0.3, thLX: -0.35, knL: 0.6, thRX: 0.15, knR: 0.55 });
  const sky = P({ hipsY: 0.02, hipsRY: -0.1, hipsRZ: -0.08, torsoX: -0.3, torsoY: -0.1, torsoZ: 0.1, headX: -0.5, headY: 0.05, headZ: -0.05,
    shRX: -3.05, shRZ: 0.22, elR: -0.08, wrR: -0.5, hoR: 1, hsR: 0.8,
    thLX: -0.05, thLZ: 0.06, knL: 0.06, thRX: 0.32, thRZ: 0.16, knR: 1.35, anL: 0.25, anR: 0.4 });
  const point = P({ hipsY: -0.08, hipsZ: 0.08, hipsRY: 0.15, torsoX: 0.25, torsoY: 0.45, torsoZ: 0, headX: -0.05, headY: -0.4, headZ: 0,
    shRX: -1.35, shRZ: -0.05, elR: -0.02, wrR: 0.1, hoR: 0.85, hsR: 0.5,
    thLX: -0.55, thLZ: 0.1, knL: 0.55, thRX: 0.4, thRZ: 0.12, knR: 0.25, anR: 0.25 });
  return own(track(t, [[0, P({})], [0.07, gather], [0.15, sky], [0.21, sky], [0.28, point]]));
}
// W 冷氣泡：雙手捧在嘴前吹氣→兩手往前推開、掌心朝外，上身前送、後腳點地
function cast_W({ t, P }) {
  const blow = P({ hipsY: -0.06, hipsZ: -0.04, hipsRY: 0.05, torsoX: -0.12, torsoY: 0.15, torsoZ: 0, headX: 0.1, headY: -0.15, headZ: 0,
    shLX: -1.15, shLZ: -0.3, elL: -2.25, shRX: -1.15, shRZ: -0.3, elR: -2.25, wrL: 0.3, wrR: 0.3, hoL: 0.55, hoR: 0.55, hsL: 0.6, hsR: 0.6,
    thLX: -0.15, knL: 0.2, thRX: 0.12, knR: 0.5 });
  const push = P({ hipsY: -0.12, hipsZ: 0.12, hipsRY: 0, hipsRZ: 0, torsoX: 0.3, torsoY: 0.05, torsoZ: 0, headX: -0.15, headY: 0, headZ: 0,
    shLX: -1.45, shLZ: 0.62, elL: -0.12, shRX: -1.45, shRZ: 0.62, elR: -0.12, wrL: 0.75, wrR: 0.75, hoL: 1, hoR: 1, hsL: 0.9, hsR: 0.9,
    thLX: -0.62, thLZ: 0.12, knL: 0.62, thRX: 0.52, thRZ: 0.1, knR: 0.2, anR: 0.35 });
  return own(track(t, [[0, P({})], [0.09, blow], [0.12, blow], [0.18, push]]));
}
// E 旋風節拍：壓低扭身、雙臂交抱（蓄力）→反向甩開、單腳立起作芭蕾式旋轉（右膝外開、腳收到左膝旁），
// 雙手一高一低張開；甩開後上身與髖繼續往同一方向擰、頭最後才跟上（留頭），看起來像還在轉
function barrier_E({ t, P }) {
  const coil = P({ hipsY: -0.15, hipsRY: -0.35, hipsRZ: 0, torsoX: 0.25, torsoY: -0.95, torsoZ: 0, headX: 0.05, headY: 0.4, headZ: 0,
    shLX: -1.2, shLZ: -0.45, elL: -1.9, shRX: -1.2, shRZ: -0.45, elR: -1.9, hoL: 0.4, hoR: 0.4, wrL: 0, wrR: 0,
    thLX: -0.45, thLZ: 0.2, knL: 0.85, thRX: 0.1, thRZ: 0.2, knR: 0.85 });
  const spin = (w) => P({ hipsY: 0.05, hipsRY: 0.3 + 0.3 * w, hipsRZ: 0.04, torsoX: -0.08, torsoY: 0.45 + 0.55 * w, torsoZ: -0.08, headX: -0.15, headY: 0.1 - 0.75 * w, headZ: 0,
    shLX: -0.25, shLZ: 1.85, elL: -0.2, shRX: -0.25, shRZ: 1.15, elR: -0.12, wrL: -0.2, wrR: -0.2, hoL: 1, hoR: 1, hsL: 1, hsR: 1,
    thLX: 0.0, thLZ: 0.05, knL: 0.03, thRX: -1.15, thRZ: 0.85, knR: 1.3, anL: 0.35, anR: 0.4 });
  return own(track(t, [[0, P({})], [0.1, coil], [0.18, spin(0)], [0.35, spin(1)]]));
}
// R 雷雲・宙之雷：蹲下把雙手交叉收在身前→雙手高舉成 V、仰頭喚雷雲→右手一指劈向雷雲下方（0.45 秒開始落雷）
function overhead_R({ t, P }) {
  const crouch = P({ hipsY: -0.2, hipsZ: -0.03, hipsRY: 0, hipsRZ: 0, torsoX: 0.45, torsoY: 0.1, torsoZ: 0, headX: 0.3, headY: 0, headZ: 0,
    shLX: -0.75, shLZ: -0.45, elL: -1.3, shRX: -0.75, shRZ: -0.45, elR: -1.3, hoL: 0.2, hoR: 0.2, wrL: 0.3, wrR: 0.3,
    thLX: -0.65, thLZ: 0.25, knL: 1.15, thRX: -0.35, thRZ: 0.25, knR: 1.2 });
  const call = P({ hipsY: 0.04, hipsZ: 0, hipsRY: 0, hipsRZ: 0, torsoX: -0.38, torsoY: 0, torsoZ: 0, headX: -0.6, headY: 0, headZ: 0,
    shLX: -2.75, shLZ: 0.62, elL: -0.12, shRX: -2.75, shRZ: 0.62, elR: -0.12, hoL: 1, hoR: 1, hsL: 0.9, hsR: 0.9, wrL: -0.3, wrR: -0.3,
    thLX: -0.05, thLZ: 0.1, knL: 0.05, thRX: 0.3, thRZ: 0.12, knR: 1.25, anL: 0.3, anR: 0.4 });
  const strikeDown = P({ hipsY: -0.12, hipsZ: 0.16, hipsRY: 0.2, hipsRZ: 0, torsoX: 0.3, torsoY: 0.5, torsoZ: -0.05, headX: -0.05, headY: -0.45, headZ: 0,
    shLX: -2.7, shLZ: 0.55, elL: -0.25, shRX: -1.35, shRZ: -0.05, elR: -0.02, hoL: 1, hoR: 0.85, hsL: 0.8, hsR: 0.5, wrL: -0.2, wrR: 0.1,
    thLX: -0.7, thLZ: 0.15, knL: 0.7, thRX: 0.5, thRZ: 0.12, knR: 0.2, anR: 0.3 });
  return own(track(t, [[0, P({})], [0.12, crouch], [0.17, crouch], [0.27, call], [0.38, call], [0.46, strikeDown]]));
}

// 勝利：叉腰扭腰、右手在臉旁比出招牌手勢、頭歪一邊
function win({ t, P }) {
  const b = Math.abs(Math.sin(t * 3.2));
  return own(P({ hipsY: -0.02 + 0.02 * b, hipsRY: -0.2, hipsRZ: -0.16, torsoX: -0.06, torsoY: 0.3, torsoZ: 0.16, headX: -0.18, headY: -0.3, headZ: -0.22,
    ...HIP_L,
    shRX: -1.25 - 0.1 * b, shRZ: 0.75, elR: -2.3, wrR: -0.3, hoR: 0.7, hsR: 0.9,
    thLX: -0.12, thLZ: -0.12, knL: 0.35, thRX: 0.05, thRZ: 0.14, knR: 0.02, anL: 0.35 }));
}

// 跑步：比共用跑姿上身立一點、膝蓋靠攏，雙手半張、手肘微外開地擺（天候棒跑步時收在背上，不學持劍的手往後拖）
function run({ phase, P }) {
  const s = Math.sin(phase), c = Math.cos(phase);
  return own(P({ hipsY: -0.07 + 0.07 * Math.abs(c), hipsZ: 0, hipsRX: 0.08, hipsRY: -0.22 * s, hipsRZ: 0.05 * c,
    torsoX: 0.3, torsoY: 0.3 * s, torsoZ: 0, headX: -0.25, headY: -0.18 * s, headZ: 0,
    thLX: s * 1.2 - 0.15, thRX: -s * 1.2 - 0.15, thLZ: 0.02, thRZ: 0.02,
    knL: 0.3 + 1.5 * Math.max(0, -c) * (0.6 + 0.4 * Math.max(0, -s)), knR: 0.3 + 1.5 * Math.max(0, c) * (0.6 + 0.4 * Math.max(0, s)),
    shLX: -s * 0.95 - 0.1, shRX: s * 0.95 - 0.1, shLZ: 0.34, shRZ: 0.34, shRY: 0,
    elL: -1.2 - 0.4 * Math.max(0, s), elR: -1.2 - 0.4 * Math.max(0, -s), wrL: 0.3, wrR: 0.3,
    hoL: 0.75, hoR: 0.75, hsL: 0.5, hsR: 0.5, anL: 0, anR: 0 }));
}

export default {
  stance, atk1: fixL(atk1), atk2: fixL(atk2), atk3: fixL(atk3), cast_Q: fixL(cast_Q), cast_W: fixL(cast_W),
  barrier_E: fixL(barrier_E), overhead_R: fixL(overhead_R), win: fixL(win), run: fixL(run),
};
