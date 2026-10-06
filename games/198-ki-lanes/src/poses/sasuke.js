// sasuke 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（strike、lerpPose、ease、clamp、IMPACT…）。
//
// 佐助（疾風傳）：草薙劍橫插在腰後、刀柄在右腰；右手拔刀（普攻時劍在右手），千鳥、豪火球、麒麟都把劍留在腰後（prop −1）。
// 劍刃從虎口伸出、和前臂垂直：手臂前伸時 wrR 約 +1.3 讓劍身順著手臂朝前（刺擊），wrR 0 時劍朝上；shRY 正負把劍往右／左滾。
// 普攻的實際長度會隨攻速縮短（最短約 0.33 秒），所以每一招都在 0.33 秒內收回架式。
// 關鍵姿勢至少停 2～4 格（約 0.03～0.05 秒）再走下一段：models.js 的跟隨平滑約 30 毫秒，一閃而過的姿勢在遊戲裡看不到。
import { lerpPose, ease as ease0, clamp, blank } from '../pose-kit.js';

const own = (p) => { p.ownHands = true; return p; }; // 手形自己決定，不讓共用的 HAND_OPEN 把手攤平
const lerp3 = (a, b, k) => lerpPose(a, b, clamp(k, 0, 1));
const ease = (u) => ease0(clamp(u, 0, 1)); // pose-kit 的 ease 超過 1 會往回彎，先夾住
const fast = (u) => { u = clamp(u, 0, 1); return u * u * (2 - u); }; // 出手越來越快
const out = (u) => Math.sin(Math.PI * 0.5 * clamp(u, 0, 1)); // 衝過頭後減速停住
// 右手按在腰後刀柄上（待機、勝利共用）
// 握點和劍拿在手上時的握點只差約 4 公分、劍身方向也幾乎和鞘一致，所以出招第一格把劍換到手上、收招換回鞘裡都不會跳
const GRIP = { shRX: 0.9, shRY: -1.0, shRZ: 0.5, elR: -0.8, wrR: 0.3, hoR: 0.12, hsR: 0.2 };
const sheathe = (p, on) => { if (on) p.prop = -1; return p; }; // 收招的手回到刀柄後就把劍插回鞘裡（動作剩下的幾格不再拿著劍）

// 待機：半身側轉、左腳在前，右手按著腰後的刀柄隨時拔刀，左手鬆垂在身前；下巴微收、眼神斜睨
function stance({ t }) {
  const br = Math.sin(t * 2.4), sway = Math.sin(t * 1.1);
  return Object.assign(blank(), GRIP, {
    hipsY: -0.09 - 0.012 * br, hipsRY: 0.28, hipsRZ: 0.03, torsoX: 0.14 + 0.015 * br, torsoY: 0.38, torsoZ: -0.03,
    headX: 0.02, headY: -0.42 + 0.03 * sway, headZ: 0.04,
    shLX: -0.2 - 0.03 * br, shLZ: 0.2, elL: -0.35, wrL: -0.1, hoL: 0.75, hsL: 0.35,
    thLX: -0.42, thLZ: 0.2, knL: 0.5, thRX: 0.36, thRZ: 0.2, knR: 0.48,
  });
}

// 普攻一：居合式高位橫斬——右腰拔刀、右臂連劍往右後方平舉、身體向右擰緊 → 腰由後往前甩，
// 劍身打平從右後方掃過正前方（約 0.1 秒命中時劍尖已指向左前）→ 順勢掃到左後方停住再收。站姿偏高（和普攻三的低弓步區分）
function atk1({ t, base, P }) {
  const W = P({ hipsY: -0.15, hipsRY: 0.35, torsoX: 0.25, torsoY: -0.6, headY: 0.05,
    shRX: 0.1, shRZ: 1.5, shRY: 0.8, elR: -0.6, wrR: 1.2, shLX: -0.9, shLZ: 0.1, elL: -1.3, hoL: 0.75,
    thLX: -0.5, knL: 0.7, thRX: 0.4, knR: 0.65 });
  const S = P({ hipsY: -0.12, hipsZ: 0.14, hipsRY: -0.1, torsoX: 0.18, torsoY: 0.7, headY: -0.4,
    shRX: -1.45, shRZ: 0.1, shRY: -0.9, elR: -0.1, wrR: 1.3,
    shLX: 0.35, shLZ: 0.3, elL: -1.1, wrL: 0.2, hoL: 0.7, hsL: 0.4,
    thLX: -0.6, thLZ: 0.2, knL: 0.55, thRX: 0.45, thRZ: 0.15, knR: 0.25 });
  const O = P({ ...S, hipsRY: -0.2, torsoY: 1.35, headY: -0.68, shRX: -1.35, shRZ: -0.65, shRY: -0.7, wrR: 0.8, shLX: 0.5, elL: -1.2 });
  if (t < 0.025) return sheathe(lerp3(base, W, t / 0.025), true); // 拔刀快到看不見：前兩格劍還在鞘裡，手甩到右邊時劍才出現（途中劍尖不會往下掃過地面）
  if (t < 0.035) return sheathe(W, true);
  if (t < 0.075) return W; // 拔刀架勢停住約 50 毫秒（跟隨平滑約 30 毫秒，太短會和橫掃糊成一片）
  if (t < 0.1) return lerp3(W, S, fast((t - 0.075) / 0.025));
  if (t < 0.145) return lerp3(S, O, out((t - 0.1) / 0.045));
  if (t < 0.19) return O;
  return sheathe(lerp3(O, base, ease((t - 0.19) / 0.12)), t > 0.25); // 手往回收到一半就收刀入鞘，劍不會穿過腰
}

// 普攻二：反手上撩——身體往反方向擰、劍尖拖在左後下方蓄勢（往外滾開，俯視時不被衣襬擋住）→ 劍從左下往右上撩起，
// 途中劍身平指正前方，收招時手舉過右肩、劍身直立（微往後倒），所以從遊戲鏡頭看任何面向都是往畫面上方收，左手甩後平衡
function atk2({ t, base, P }) {
  const W = P({ hipsY: -0.22, hipsRY: 0.1, torsoX: 0.35, torsoY: 0.95, headY: -0.5,
    shRX: -0.2, shRZ: -0.55, shRY: -1.15, elR: -0.9, wrR: 1.5, shLX: -0.3, shLZ: 0.4, elL: -1.3, hoL: 0.7,
    thLX: -0.55, knL: 0.9, thRX: 0.4, knR: 0.85 });
  const S = P({ hipsY: -0.07, hipsZ: 0.16, hipsRY: 0.45, torsoX: 0.02, torsoY: -0.6, torsoZ: -0.12, headX: -0.15, headY: 0.15,
    shRX: -1.9, shRZ: 0.85, shRY: 0, elR: -0.12, wrR: 0.7, shLX: 0.6, shLZ: 0.55, elL: -0.35, hoL: 0.85, hsL: 0.5,
    thLX: -0.7, thLZ: 0.22, knL: 0.6, thRX: 0.5, thRZ: 0.15, knR: 0.2 });
  const O = P({ ...S, torsoY: -0.75, headX: -0.25, shRX: -2.3, shRZ: 0.7, wrR: 0.38, shLX: 0.75 });
  if (t < 0.06) return lerp3(base, W, ease(t / 0.06));
  if (t < 0.085) return W; // 劍尖垂在左後下方停一下
  if (t < 0.125) return lerp3(W, S, fast((t - 0.085) / 0.04));
  if (t < 0.165) return lerp3(S, O, out((t - 0.125) / 0.04));
  if (t < 0.2) return O;
  return sheathe(lerp3(O, base, ease((t - 0.2) / 0.12)), t > 0.29);
}

// 普攻三：弓步突刺——劍收在右腰、劍尖朝前蓄勢 → 整個人往前撲，右臂與劍拉成胸口高的一直線，左手往後甩、後腳蹬直
function atk3({ t, base, P }) {
  const W = P({ hipsY: -0.2, hipsZ: -0.06, hipsRY: 0.55, torsoX: 0.2, torsoY: -0.55, headY: 0.05,
    shRX: 0.2, shRZ: 0.3, shRY: 0.3, elR: -1.7, wrR: 0.75, shLX: -1.2, shLZ: -0.1, elL: -0.4, hoL: 0.9, hsL: 0.5,
    thLX: -0.55, knL: 1.0, thRX: 0.45, knR: 0.95 });
  const S = P({ hipsY: -0.24, hipsZ: 0.34, hipsRY: 0.05, hipsRX: 0, torsoX: 0.15, torsoY: 0.7, headX: -0.05, headY: -0.4,
    shRX: -1.6, shRZ: 0.8, shRY: 0, elR: -0.02, wrR: 1.15, shLX: 1.0, shLZ: 0.4, elL: -0.1, hoL: 0.9, hsL: 0.6,
    thLX: -1.15, thLZ: 0.2, knL: 1.25, thRX: 0.8, thRZ: 0.15, knR: 0.05 });
  const O = P({ ...S, hipsZ: 0.4, shRX: -1.62, torsoY: 0.8, shLX: 1.1 });
  if (t < 0.08) return sheathe(lerp3(base, W, ease(t / 0.08)), t < 0.05); // 劍從鞘裡翻到前方的那兩格會穿過腰，晚一點才拿出來
  if (t < 0.1) return W;
  if (t < 0.16) return lerp3(W, S, fast((t - 0.1) / 0.06));
  if (t < 0.2) return lerp3(S, O, out((t - 0.16) / 0.04));
  if (t < 0.23) return O;
  return sheathe(lerp3(O, base, ease((t - 0.23) / 0.1)), t > 0.33);
}

// Q 豪火球之術（0.14 秒吐出火球）：雙手在胸前合掌結虎印、上身後仰吸氣 → 往前一彎，右手指圈湊在嘴前、左手托著右腕噴火
function cast_Q({ t, base, P }) {
  const seal = P({ hipsY: -0.1, hipsRY: 0.15, torsoX: -0.4, torsoY: 0.05, headX: -0.45, headY: -0.15,
    shLX: -0.25, shLZ: 0.35, shLY: -0.55, elL: -1.85, wrL: 0, hoL: 0.85, hsL: 0.1,
    shRX: -0.25, shRZ: 0.35, shRY: -0.55, elR: -1.85, wrR: 0, hoR: 0.85, hsR: 0.1,
    thLX: -0.3, thLZ: 0.2, knL: 0.4, thRX: 0.3, thRZ: 0.2, knR: 0.4, prop: -1 });
  const tr = Math.sin(t * 55) * 0.04 * clamp((t - 0.14) / 0.03, 0, 1);
  const blow = P({ hipsY: -0.17, hipsZ: 0.1, torsoX: 0.5, torsoY: 0.3, headX: 0.2 + tr, headY: -0.15,
    shRX: -1.15 + tr, shRZ: 0.35, shRY: 0.3, elR: -2.3, wrR: 0.3, hoR: 0.5, hsR: 0.8,
    shLX: -0.75, shLY: -0.7, shLZ: 0.1, elL: -1.7, wrL: 0.2, hoL: 0.8, hsL: 0.4,
    thLX: -0.75, thLZ: 0.25, knL: 0.9, thRX: 0.55, thRZ: 0.18, knR: 0.35, prop: -1 });
  let p;
  if (t < 0.095) p = lerp3(base, seal, ease(t / 0.04)); // 0.04 秒結好虎印、停約 55 毫秒
  else if (t < 0.13) p = lerp3(seal, blow, fast((t - 0.095) / 0.035));
  else if (t < 0.24) p = blow;
  else p = lerp3(blow, base, ease((t - 0.24) / 0.08));
  return own(p);
}

// W 千鳥（衝刺段）：壓得很低的疾跑，左手的雷光筆直拖在身後側、五指張成爪，右拳收在胸前；劍留在腰後
function dash_W({ t, P }) {
  const ph = t * 26, s = Math.sin(ph), c = Math.cos(ph);
  // 手臂比例短，手最多拖到腰後約 20 公分：靠上身左擰（左肩往後）＋手臂外展，讓俯視時看得到一條斜拖在左後方的手
  return own(P({ hipsY: -0.24 + 0.03 * Math.abs(c), hipsRX: 0.25, hipsRY: 0.3 - 0.08 * s, hipsZ: 0.05, torsoX: 0.65, torsoY: 0.3 + 0.05 * s, headX: -0.8, headY: -0.3,
    shLX: 0.05, shLZ: 0.6, elL: -0.05, wrL: -0.35, hoL: 0.85, hsL: 0.85, clL: -0.1,
    shRX: -0.5, shRZ: 0.3, shRY: 0, elR: -2.2, wrR: 0, hoR: 0.1, hsR: 0.2, prop: -1,
    thLX: -0.55 + s * 1.0, thRX: -0.55 - s * 1.0, thLZ: 0.1, thRZ: 0.1,
    knL: 0.5 + 1.3 * Math.max(0, -c), knR: 0.5 + 1.3 * Math.max(0, c) }));
}

// W 千鳥（貫穿段，撞到敵人的瞬間）：左手手刀沿面向直直貫出、左肩領先的弓步，右手留在後下方；停一下再收
function atk3_W({ t, base, P }) {
  const W = P({ hipsY: -0.26, hipsRX: 0.25, hipsRY: 0.3, torsoX: 0.65, torsoY: 0.3, headX: -0.8, headY: -0.3,
    shLX: 0.05, shLZ: 0.6, elL: -0.05, wrL: -0.35, hoL: 0.85, hsL: 0.85, shRX: -0.5, shRZ: 0.3, shRY: 0, elR: -2.2, wrR: 0, hoR: 0.1, hsR: 0.2,
    thLX: -0.9, knL: 1.4, thRX: 0.2, knR: 1.1, prop: -1 });
  const S = P({ hipsY: -0.24, hipsZ: 0.3, hipsRX: 0.12, hipsRY: -0.1, torsoX: 0.35, torsoY: -0.6, headX: -0.25, headY: 0.35,
    shLX: -2.0, shLZ: 0.3, shLY: 0, elL: 0, wrL: 0, hoL: 0.95, hsL: 0.2,
    shRX: 0.55, shRZ: 0.35, shRY: 0, elR: -0.45, wrR: -0.2, hoR: 0.3, hsR: 0.3,
    thLX: -1.1, thLZ: 0.2, knL: 1.15, thRX: 0.75, thRZ: 0.15, knR: 0.1, prop: -1 });
  // 撞上的瞬間（t=0）傷害與雷光就出現，所以 0.03 秒內就要貫到底
  if (t < 0.03) { const u = 0.35 + 0.65 * t / 0.03; return own(lerp3(W, S, u * (2 - u))); }
  if (t < 0.2) return own(S);
  const p = lerp3(S, base, ease((t - 0.2) / 0.12));
  p.prop = -1; // 收招時劍也留在腰後，不會在最後一刻跳回手上
  return own(p);
}

// E 寫輪眼・瞬身：下巴前豎起單手印（手刀）、深蹲準備彈出，左手往後甩（0.1 秒，不自轉；遊戲裡這段模型是隱藏的）
function vanish_E({ P }) {
  return own(P({ hipsY: -0.32, torsoX: 0.5, torsoY: 0.1, headX: -0.4, headY: 0,
    shRX: -1.2, shRZ: -0.1, shRY: 0, elR: -1.9, wrR: 0, hoR: 0.85, hsR: 0.1, shLX: 0.9, shLZ: 0.35, elL: -0.2, hoL: 0.7,
    thLX: -1.0, knL: 1.8, thRX: 0.35, knR: 1.45, spin: 0, prop: -1 }));
}

// R 麒麟（1.0 秒落雷）：先蹲低擰身、右手斜壓到左膝前蓄勢 → 右手畫一個大弧往右上方高舉、仰頭（在雷雲下慢慢再往上伸、微顫）
// → 0.86 秒起把手刀揮下、0.94 秒指住地上的目標，落雷接著劈下（手臂略往外側舉，背對鏡頭時手不會蓋住臉）
function overhead_R({ t, base, P }) {
  const crouch = P({ hipsY: -0.32, torsoX: 0.6, torsoY: -0.45, headX: 0.25, headY: 0.25,
    shRX: -0.45, shRZ: -0.6, shRY: 0, elR: -0.5, wrR: 0, hoR: 0.85, hsR: 0.2, shLX: 0.4, shLZ: 0.35, elL: -0.4, hoL: 0.6,
    thLX: -0.6, knL: 1.3, thRX: 0.45, knR: 1.2, prop: -1 });
  const k = clamp((t - 0.32) / 0.54, 0, 1), tr = Math.sin(t * 47) * 0.03 * clamp((t - 0.3) / 0.2, 0, 1);
  const raise = P({ hipsY: -0.06, torsoX: -0.3, torsoY: 0.15, torsoZ: 0.15, headX: -0.55, headY: -0.1,
    shRX: -2.0 - 0.12 * k + tr, shRZ: 1.15, shRY: 0, elR: -0.08, wrR: 0, hoR: 0.95, hsR: 0.1,
    shLX: 0.15, shLZ: 0.5, elL: -0.35, hoL: 0.6, hsL: 0.3,
    thLX: -0.25, thLZ: 0.22, knL: 0.25, thRX: 0.2, thRZ: 0.2, knR: 0.2, prop: -1 });
  const point = P({ hipsY: -0.16, hipsZ: 0.14, torsoX: 0.45, torsoY: 0.3, headX: 0.2, headY: -0.3,
    shRX: -1.25, shRZ: 0.3, shRY: 0, elR: -0.03, wrR: 0, hoR: 0.95, hsR: 0.1,
    shLX: 0.45, shLZ: 0.55, elL: -0.4, hoL: 0.6, hsL: 0.3,
    thLX: -0.7, thLZ: 0.22, knL: 0.8, thRX: 0.5, thRZ: 0.15, knR: 0.3, prop: -1 });
  let p;
  if (t < 0.14) p = lerp3(base, crouch, ease(t / 0.08));
  else if (t < 0.34) p = lerp3(crouch, raise, ease((t - 0.14) / 0.2));
  else if (t < 0.86) p = raise;
  else p = lerp3(raise, point, fast((t - 0.86) / 0.08)); // 0.94 秒指到目標，正好接 1.0 秒的落雷
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

// 勝利：側身背對、右手仍按著腰後的刀柄，抬下巴回頭斜睨一眼（「哼」）
function win({ t, P }) {
  const br = Math.sin(t * 2);
  return own(P({ ...GRIP, hipsY: -0.02 - 0.008 * br, hipsRY: 0.75, hipsRZ: 0.04, torsoX: 0.04 + 0.01 * br, torsoY: 0.2, torsoZ: 0, headX: 0, headY: -1.0, headZ: 0.06,
    shLX: 0.08, shLZ: 0.14, elL: -0.25, wrL: 0, hoL: 0.6, hsL: 0.3,
    thLX: -0.12, thLZ: 0.12, knL: 0.12, thRX: 0.12, thRZ: 0.1, knR: 0.22 }));
}

export default {
  stance, atk1, atk2, atk3, cast_Q, dash_W, atk3_W, vanish_E, overhead_R, run, win,
  // 佐助每種動作只有一招，不帶技能鍵時（預覽、特寫工具）也用同一套
  cast: cast_Q, dash: dash_W, vanish: vanish_E, overhead: overhead_R,
};
