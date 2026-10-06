// a18 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（strike、lerpPose、ease、clamp、IMPACT…）。
//
// 人造人18號：冷淡、省力、出手乾脆。待機單手叉腰、重心落在一腳；普攻是掌心氣彈→反手甩掌→迴旋高踢，
// Q 氣圓斬舉過頭再側甩、W 低身衝刺抓人往身後甩、E 雙臂交叉擋在臉前再一口氣張開、R 左右手交替連射。
import { strike, lerpPose, ease, clamp, blank, IMPACT } from '../pose-kit.js';

const own = (p) => { p.ownHands = true; return p; }; // 手形自己決定（不套 HAND_OPEN）
const LEAD = 0.85; // 畫面姿勢會慢約 25 毫秒追上，出招提早一點到位，命中那格才是完全伸展
const seg = (t, a, b) => ease(clamp((t - a) / (b - a), 0, 1));

// 叉腰的右手（肩往後、肘向外、手掌貼在右髖）
const HIP_R = { shRX: 1.2, shRY: -0.55, shRZ: 1.1, elR: -1.55, wrR: 0, hoR: 0.7, hsR: 0.5 };
const HIP_NAMES = new Set(['idle', 'atk1', 'atk2', 'atk3', 'cast', 'dash', 'barrier', 'win']);

// R 能量波的兩個連射姿勢：A 右掌推出、B 左掌推出（馬步側身，另一手收在胸前）
function volley(P, t, right) {
  const tr = Math.sin(t * 55) * 0.02;
  const legs = { hipsY: -0.17, hipsRY: 0.25, hipsZ: 0.04, thLX: -0.6, thLZ: 0.38, knL: 0.9, thRX: 0.38, thRZ: 0.36, knR: 0.72, anR: 0.1 };
  if (right) return P({ ...legs, torsoX: 0.12 + tr, torsoY: 0.45, torsoZ: 0, headX: -0.05, headY: -0.5, headZ: 0,
    shRX: -1.58, shRY: 0, shRZ: -0.06, elR: -0.04, wrR: -0.9, hoR: 1, hsR: 0.85, clR: 0.15,
    shLX: 0.35, shLY: 0, shLZ: 0.3, elL: -2.05, wrL: 0, hoL: 0.8, hsL: 0.5 });
  return P({ ...legs, torsoX: 0.12 + tr, torsoY: -0.05, torsoZ: 0, headX: -0.05, headY: -0.05, headZ: 0,
    shLX: -1.58, shLY: 0, shLZ: 0.05, elL: -0.04, wrL: -0.9, hoL: 1, hsL: 0.85, clL: 0.15,
    shRX: 0.35, shRY: 0, shRZ: 0.3, elR: -2.05, wrR: 0, hoR: 0.8, hsR: 0.5 });
}

export default {
  // 待機：重心在左腳、右髖外推、右手叉腰，左手鬆垂；頭微偏、目光斜睨
  // 叉腰要用到上臂內旋（shRY），models.js 的共用動作（被打飛、暈眩、倒地、蓄氣…）不會把它歸零，
  // 所以只有待機與自己寫的動作拿叉腰當底，其他動作的底改成右手自然垂下
  stance({ t, name }) {
    const br = Math.sin(t * 2.6), sw = Math.sin(t * 0.9);
    const arm = HIP_NAMES.has(name) ? HIP_R : { shRX: 0.05, shRY: 0, shRZ: 0.2, elR: -0.4, wrR: 0, hoR: 0.5, hsR: 0.3 };
    return Object.assign(blank(), { hipsY: -0.03 - 0.008 * br, hipsZ: 0, hipsRX: 0, hipsRY: 0.15, hipsRZ: 0.1 + 0.015 * sw,
      torsoX: 0.02 - 0.012 * br, torsoY: 0.2, torsoZ: -0.12 - 0.01 * sw, headX: -0.05 + 0.01 * br, headY: -0.3, headZ: 0.1 + 0.02 * sw,
      shLX: 0.05 + 0.02 * br, shLY: 0, shLZ: 0.18, elL: -0.35, wrL: 0.1, hoL: 0.5, hsL: 0.3, clL: 0, clR: 0,
      ...arm,
      thLX: -0.05, thLZ: -0.06, knL: 0.03, thRX: 0.12, thRZ: 0.24, knR: 0.35, anL: 0, anR: 0, toL: 0, toR: 0 });
  },

  // 普攻一：右手從腰間抽出，掌心推出一發氣彈（左腳踏前、腰帶肩）
  atk1({ t, base, P }) {
    const W = P({ torsoY: -0.35, torsoX: -0.05, hipsRY: -0.1, hipsY: -0.07, headY: -0.15,
      shRX: 0.35, shRY: 0, shRZ: 0.35, elR: -2.1, wrR: 0, hoR: 0.9, hsR: 0.5,
      shLX: -0.9, shLZ: 0.25, elL: -1.1, hoL: 0.6,
      thLX: -0.22, thLZ: 0.22, knL: 0.35, thRX: 0.22, thRZ: 0.24, knR: 0.3 });
    const S = P({ torsoY: 0.75, torsoX: 0.18, torsoZ: 0, hipsRY: 0.35, hipsRZ: 0, hipsZ: 0.18, hipsY: -0.1, headY: -0.65, headX: -0.05, headZ: 0,
      shRX: -1.55, shRY: 0, shRZ: -0.05, elR: -0.05, wrR: -1.0, hoR: 1, hsR: 0.8,
      shLX: 0.35, shLZ: 0.3, elL: -1.6, hoL: 0.3,
      thLX: -0.5, thLZ: 0.32, knL: 0.75, thRX: 0.38, thRZ: 0.3, knR: 0.2 });
    return own(strike(t, IMPACT.atk1 * LEAD, base, W, S, 0.3));
  },

  // 普攻二：左手先折到右肩前、上身轉向右邊蓄力，再反手橫甩一掌（掌背帶頭，像搧耳光），身體往左打開
  atk2({ t, base, P }) {
    const W = P({ torsoY: -0.55, torsoX: 0.05, hipsRY: -0.2, hipsY: -0.07, headY: 0.45, headX: 0,
      shLX: -1.3, shLY: 0, shLZ: -0.45, elL: -2.0, wrL: 0.3, hoL: 0.85, hsL: 0.4,
      shRX: 0.2, shRY: 0, shRZ: 0.45, elR: -1.2, wrR: 0, hoR: 0.6,
      thRX: -0.2, thRZ: 0.25, knR: 0.4, thLX: 0.2, thLZ: 0.22, knL: 0.35 });
    const S = P({ torsoY: 0.25, hipsRY: 0.15, torsoX: 0.15, torsoZ: -0.05, hipsRZ: 0, hipsZ: 0.15, hipsY: -0.1, headY: -0.3, headX: -0.05, headZ: 0,
      shLX: -1.5, shLY: 0, shLZ: 0.4, elL: -0.05, wrL: 0.3, hoL: 1, hsL: 0.4,
      shRX: 0.5, shRY: 0, shRZ: 0.5, elR: -0.9, wrR: 0, hoR: 0.6,
      thLX: -0.5, thLZ: 0.36, knL: 0.6, thRX: 0.35, thRZ: 0.3, knR: 0.2 });
    return own(strike(t, IMPACT.atk2 * LEAD, base, W, S, 0.34));
  },

  // 普攻三：右腳迴旋踢——先提膝蓄力，髖部整個翻過去把腿橫掃出去，上身往反方向倒、雙臂張開平衡
  // （腿往側邊掃、不往正前方抬，長裙才不會被兩腿撐開成一片垂下的裙片）
  atk3({ t, base, P }) {
    const W = P({ hipsRY: -0.25, hipsRZ: 0, hipsY: -0.02, torsoY: -0.35, torsoX: -0.15, torsoZ: -0.15, headY: -0.1, headX: 0,
      thRX: -1.05, thRZ: 0.55, knR: 2.0, thLX: 0.05, thLZ: -0.02, knL: 0.2,
      shLX: -1.0, shLY: 0, shLZ: 0.4, elL: -1.6, hoL: 0.4, shRX: 0.6, shRY: 0, shRZ: 0.35, elR: -0.5, hoR: 0.6 });
    const S = P({ hipsRY: 0.9, hipsRZ: -0.3, hipsY: 0.04, hipsZ: 0.1, torsoY: -0.7, torsoX: -0.4, torsoZ: -0.4, headY: -0.3, headX: 0.15, headZ: 0,
      thRX: -1.25, thRZ: 0.85, knR: 0.05, anR: 0.3, toR: 0.3, thLX: 0.15, thLZ: -0.05, knL: 0.2,
      shLX: -0.6, shLY: 0, shLZ: 1.0, elL: -0.6, hoL: 0.8, hsL: 0.4, shRX: 0.8, shRY: 0, shRZ: 0.6, elR: -0.3, wrR: 0, hoR: 0.8, hsR: 0.4 });
    return own(strike(t, IMPACT.atk3 * LEAD, base, W, S, 0.42));
  },

  // Q 氣圓斬：右手舉過頭頂托起圓盤（掌心朝天），停一拍，再沿肩高側甩出去（0.14 秒放出）
  cast_Q({ t, base, P }) {
    const R = P({ torsoX: -0.2, torsoY: -0.35, torsoZ: 0.1, hipsRY: -0.05, hipsY: -0.05, headX: -0.15, headY: 0.1, headZ: 0,
      shRX: -2.85, shRY: 0, shRZ: 0.2, elR: -0.35, wrR: -1.3, hoR: 1, hsR: 0.9,
      shLX: -1.2, shLY: 0, shLZ: 0.2, elL: -0.3, wrL: 0, hoL: 0.9, hsL: 0.5,
      thLX: -0.28, thLZ: 0.24, knL: 0.3, thRX: 0.28, thRZ: 0.26, knR: 0.4 });
    const T = P({ torsoX: 0.35, torsoY: 0.8, torsoZ: 0, hipsRY: 0.3, hipsRZ: 0, hipsZ: 0.2, hipsY: -0.12, headX: 0, headY: -0.6, headZ: 0,
      shRX: -1.45, shRY: 0, shRZ: -0.5, elR: -0.15, wrR: 0.3, hoR: 1, hsR: 0.5,
      shLX: 0.5, shLY: 0, shLZ: 0.35, elL: -1.2, hoL: 0.6, hsL: 0.4,
      thLX: -0.55, thLZ: 0.36, knL: 0.8, thRX: 0.4, thRZ: 0.32, knR: 0.2 });
    const F = P({ ...T, shRX: -0.95, shRZ: -0.75, elR: -0.3, torsoY: 0.95 });
    let p;
    if (t < 0.07) p = lerpPose(base, R, seg(t, 0, 0.07));
    else if (t < 0.1) p = R;
    else if (t < 0.14) { const u = (t - 0.1) / 0.04; p = lerpPose(R, T, u * u * (2 - u)); }
    else if (t < 0.2) p = lerpPose(T, F, seg(t, 0.14, 0.2));
    else p = lerpPose(F, base, 0.5 * seg(t, 0.2, 0.32));
    return own(p);
  },

  // W 背後擒抱（衝刺段）：壓低身子貼地滑行，雙手往前張開要抓人
  dash_W({ t, base, P }) {
    const fl = Math.sin(t * 30) * 0.05;
    const S = P({ hipsRX: 0.45, hipsRY: 0, hipsRZ: 0, hipsY: -0.1, hipsZ: 0, torsoX: 0.3, torsoY: 0.1, torsoZ: 0, headX: -0.6, headY: 0, headZ: 0,
      shLX: -1.35, shLY: 0, shLZ: 0.3, elL: -0.25, wrL: -0.2, hoL: 0.75, hsL: 0.8, shRX: -1.35, shRY: 0, shRZ: 0.3, elR: -0.25, wrR: -0.2, hoR: 0.75, hsR: 0.8,
      thLX: -0.4 + fl, thLZ: 0.32, knL: 0.7, thRX: 0.22 - fl, thRZ: 0.3, knR: 0.65, anL: 0.2, anR: 0.4 });
    return own(lerpPose(base, S, seg(t, 0, 0.07)));
  },

  // W 背後擒抱（摔投段，碰到敵人後 0.4 秒）：抓住→腰往右整個轉開、雙臂掄到身後把人甩出去→回頭瞥一眼
  atk3_W({ t, base, P }) {
    const G = P({ hipsRX: 0.1, hipsRY: 0, hipsRZ: 0, hipsY: -0.15, hipsZ: 0.05, torsoX: 0.3, torsoY: 0, torsoZ: 0, headX: -0.2, headY: 0, headZ: 0,
      shLX: -1.3, shLY: 0, shLZ: -0.05, elL: -0.5, wrL: 0, hoL: 0.1, hsL: 0.2, shRX: -1.3, shRY: 0, shRZ: -0.05, elR: -0.5, wrR: 0, hoR: 0.1, hsR: 0.2,
      thLX: -0.45, thLZ: 0.32, knL: 0.9, thRX: 0.3, thRZ: 0.3, knR: 0.8 });
    // 甩出：上身連腰往右轉開約 120 度、往後仰，雙手跟著胸口往上送，在身後右上方放手
    const H = P({ hipsRX: 0, hipsRY: -0.8, hipsRZ: 0, hipsY: -0.06, hipsZ: 0.05, torsoX: -0.3, torsoY: -1.3, torsoZ: 0.15, headX: -0.25, headY: -0.6, headZ: 0,
      shLX: -2.0, shLY: 0, shLZ: -0.12, elL: -0.15, wrL: 0, hoL: 0.95, hsL: 0.7, shRX: -2.0, shRY: 0, shRZ: -0.12, elR: -0.15, wrR: 0, hoR: 0.95, hsR: 0.7,
      thLX: -0.15, thLZ: 0.3, knL: 0.45, thRX: 0.25, thRZ: 0.3, knR: 0.35 });
    // 收：轉回正面、雙手垂下，頭還回望身後被甩出去的人
    const F = P({ headY: -1.0, headX: -0.1, torsoY: -0.25, hipsRY: -0.1, shLX: 0.1, shLZ: 0.3, elL: -0.3, hoL: 0.7 });
    let p;
    if (t < 0.06) p = lerpPose(base, G, seg(t, 0, 0.05));
    else if (t < 0.2) { const u = (t - 0.06) / 0.14; p = lerpPose(G, H, u * u * (3 - 2 * u)); }
    else p = lerpPose(H, F, seg(t, 0.24, 0.4));
    return own(p);
  },

  // E 能量屏障：雙臂在臉前交叉成 X、壓低重心，接著一口氣把雙臂往兩側斜下張開（張開後一直撐到動作結束）
  barrier_E({ t, P }) {
    const tr = Math.sin(t * 50) * 0.02;
    const X = P({ hipsRX: 0, hipsRY: 0, hipsRZ: 0, hipsY: -0.14, hipsZ: 0, torsoX: 0.18 + tr, torsoY: 0, torsoZ: 0, headX: 0.15, headY: 0, headZ: 0,
      shLX: -1.6, shLY: 0, shLZ: -0.6, elL: -1.2, wrL: 0, hoL: 0.95, hsL: 0.4, shRX: -1.55, shRY: 0, shRZ: -0.55, elR: -1.2, wrR: 0, hoR: 0.95, hsR: 0.4,
      thLX: -0.35, thLZ: 0.3, knL: 0.6, thRX: -0.05, thRZ: 0.3, knR: 0.55 });
    const B = P({ hipsRX: 0, hipsRY: 0, hipsRZ: 0, hipsY: -0.09, hipsZ: 0, torsoX: -0.3, torsoY: 0, torsoZ: 0, headX: -0.25, headY: 0, headZ: 0,
      shLX: -0.55, shLY: 0, shLZ: 1.25, elL: -0.2, wrL: -0.9, hoL: 1, hsL: 0.9, shRX: -0.55, shRY: 0, shRZ: 1.25, elR: -0.2, wrR: -0.9, hoR: 1, hsR: 0.9,
      thLX: -0.3, thLZ: 0.38, knL: 0.45, thRX: 0.05, thRZ: 0.38, knR: 0.4 });
    let p;
    if (t < 0.07) p = X; // 屏障與彈開在 t=0 就發生，交叉只停一下，馬上張開
    else p = lerpPose(X, B, seg(t, 0.07, 0.13));
    return own(p);
  },

  // R 能量波：0.3 秒舉掌瞄準後左右手交替推掌連射。
  // 連射時 combat.js 每發會把動作重設：奇數發是 cast＠0.05 起算（右掌）、偶數發是 atk2 一格再回到 cast＠總時間（左掌），
  // 所以 t < 0.3 一律是右掌推出、t ≥ 0.3 是左掌，兩段每 0.08 秒交替就成了雙手連射
  cast_R({ t, base, P }) {
    if (t < 0.3) return own(lerpPose(base, volley(P, t, true), seg(t, 0, 0.06)));
    return own(volley(P, t, false));
  },
  atk2_R({ t, P }) { return own(volley(P, t, false)); }, // 偶數發只停一格，直接換左掌

  // 跑：步幅比共用的小、兩腿略開（長裙才不會被扯開），上身前傾、手半張隨步伐擺動，跑起來俐落不慌張
  run({ phase, P }) {
    const s = Math.sin(phase), c = Math.cos(phase);
    return own(P({ hipsY: -0.07 + 0.06 * Math.abs(c), hipsZ: 0, hipsRX: 0.08, hipsRY: -0.16 * s, hipsRZ: 0,
      torsoX: 0.32, torsoY: 0.28 * s, torsoZ: 0, headX: -0.28, headY: -0.18 * s, headZ: 0,
      thLX: 0.85 * s - 0.12, thRX: -0.85 * s - 0.12, thLZ: 0.16, thRZ: 0.16,
      knL: 0.3 + 1.35 * Math.max(0, -c) * (0.6 + 0.4 * Math.max(0, -s)), knR: 0.3 + 1.35 * Math.max(0, c) * (0.6 + 0.4 * Math.max(0, s)),
      shLX: -0.95 * s - 0.15, shRX: 0.95 * s - 0.15, shLY: 0, shRY: 0, shLZ: 0.24, shRZ: 0.24,
      elL: -1.25 - 0.35 * Math.max(0, s), elR: -1.25 - 0.35 * Math.max(0, -s), wrL: 0, wrR: 0, hoL: 0.55, hoR: 0.55, hsL: 0.3, hsR: 0.3 }));
  },

  // 勝利：右手叉腰、髖往外頂，左手把頭髮撥到耳後，冷冷地偏頭
  win({ t, P }) {
    const b = Math.sin(t * 2.2);
    return own(P({ hipsRZ: 0.15, hipsRY: 0.2, torsoZ: -0.16, torsoY: 0.25, headX: -0.12, headY: -0.35, headZ: 0.2 + 0.03 * b,
      shLX: -1.75, shLY: 0.7, shLZ: 1.3 + 0.05 * b, elL: -2.2, wrL: 0.2, hoL: 0.85, hsL: 0.4,
      ...HIP_R }));
  },
};
