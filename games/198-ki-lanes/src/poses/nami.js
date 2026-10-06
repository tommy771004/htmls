// nami 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（strike、lerpPose、ease、clamp、IMPACT…）。
//
// 娜美：航海士，不是打架型。天候棒（右手）打出輕快的棍法，普攻的光彈在 0.12／0.14／0.20 秒從胸口高度往正前方射出，
// 所以三下普攻命中瞬間棍尖都指向前方胸口高度。技能用天候棒指揮天氣：舉棍招雷（Q）、單腳旋轉把棍子甩成一圈颳旋風（E）、
// 雙手高舉喚雷雲再一棍劈下（R）都拿著棍子（prop 1）；待機也把棍子扛在右肩上（普攻間隔不會在手上與背上之間跳）；
// 只有吹冷氣泡（W）、跑步、回城與勝利把棍子收在背上（prop −1）。舉棍招雷的棍子要接近垂直，面向鏡頭時才不會縮成一小截。
// 天候棒插在拳頭裡、和前臂垂直從虎口伸出：wrR 0 時棍子朝掌心前方，wrR 往正彎到約 1.25 棍子就順著手臂延伸出去（再多彎就往掌背那側偏）。
// 共用的姿勢平滑約有 30 毫秒的延遲，所以命中姿勢要比 combat.js 的出手時間早約 30～40 毫秒到位。
// 動作結束（combat.js 的 dur）後會以較慢的速率退回待機，所以每個動作在 dur 前就收回架式附近。
import { lerpPose, ease, clamp, KEYS } from '../pose-kit.js';

// 關鍵幀時間軸：frames = [[時間, 姿勢, 內插法], …]；內插法省略是 ease，'snap' 是出手越來越快、'out' 是一開始最快（甩出去後減速）
const CURVE = { snap: (u) => u * u * (2 - u), out: (u) => 1 - (1 - u) * (1 - u) * (1 - u) };
function track(t, frames) {
  if (t <= frames[0][0]) return { ...frames[0][1] };
  for (let i = 1; i < frames.length; i++) {
    const [t1, b, how] = frames[i];
    if (t < t1) {
      const [t0, a] = frames[i - 1];
      const u = clamp((t - t0) / (t1 - t0), 0, 1);
      return lerpPose(a, b, (CURVE[how] || ease)(u));
    }
  }
  return { ...frames[frames.length - 1][1] };
}
// 順勢多送：從 W 往 S 的方向再推 k 倍（跟隨動作）
function past(W, S, k) { const o = {}; for (const key of KEYS) o[key] = S[key] + (S[key] - W[key]) * k; return o; }
const own = (p) => { p.ownHands = true; return p; };

// 待機：左手叉腰、骨盆往右推出（重心在右腳）、左腳尖輕點，右手握天候棒扛在右肩上（棍子斜斜越過肩後）；呼吸帶肩胸起伏、髖部輕擺
// 叉腰要把左上臂內旋（shLY），共用動作（跑、受擊、倒地…）不會把 shLY 歸零，所以只在自己的動作裡叉腰
function stance({ t, name, key }) {
  const br = Math.sin(t * 2.6), sway = Math.sin(t * 1.1), mine = MINE.has(name) || MINE.has(name + '_' + key);
  return {
    hipsY: -0.03 - 0.008 * br, hipsZ: 0, hipsRX: 0, hipsRY: -0.18, hipsRZ: -0.17 + 0.02 * sway,
    torsoX: 0.02 + 0.012 * br, torsoY: 0.28, torsoZ: 0.17 - 0.02 * sway, headX: -0.06, headY: -0.24, headZ: -0.15,
    ...(mine ? HIP_L : HIP_GENERIC), // 左手叉腰
    ...CARRY, // 右手握天候棒扛在肩上
    // 共用動作（暈眩、被打飛…）只改肩肘，不歸零 shRY／wrR：改成棍子順著前臂往下垂（暈眩時拖著棍、飛起時甩成一直線）；倒地收回背上
    ...(mine ? null : { shRY: 0, wrR: 0.9, prop: name === 'dead' ? -1 : 1 }),
    thLX: -0.28, thLZ: -0.08, knL: 0.42, thRX: 0.04, thRZ: 0.14, knR: 0.04, // 左腳在前、膝內收（腳尖點地）；右腳打直撐重
    spin: 0, stretch: 0, anL: 0.25, anR: 0, clL: 0, clR: 0, toL: 0, toR: 0,
  };
}
// 待機也握著天候棒（prop 1）：普攻間隔裡棍子不會在手上與背上之間跳來跳去
const CARRY = { shRX: -0.4, shRY: -0.5, shRZ: 0.7, elR: -2.2, wrR: -0.3, hoR: 0, hsR: 0.3, prop: 1 };
// 叉腰的左手：上臂往側邊張開、往內旋，手肘往外翹出身體輪廓，手掌貼在腰側（只彎手肘的話前臂會往前伸，不像叉腰）
const HIP_L = { shLX: 1.1, shLY: -0.45, shLZ: 1.35, elL: -1.75, wrL: 0.3, hoL: 0.85, hsL: 0.2 };
const HIP_GENERIC = { shLX: -0.15, shLY: 0, shLZ: 0.6, elL: -1.65, wrL: 0, hoL: 0.55, hsL: 0.3 };
const MINE = new Set(['idle', 'atk1', 'atk2', 'atk3', 'win', 'charge', 'cast_Q', 'cast_W', 'barrier_E', 'overhead_R']);
// 自己的動作：覆寫左臂時順手把叉腰的內旋歸零
const fixL = (fn) => (ctx) => fn({ ...ctx, P: (o) => ctx.P('shLX' in o && !('shLY' in o) ? { shLY: 0, ...o } : o) });

// 普攻一（0.12 秒射出、0.40 秒結束）：天候棒從右後上方往前劈下——0.08 秒到位，射出瞬間棍子順著前臂、平指正前方胸口高度；
// 小踏步（大弓步留給第三下），射出後棍尖再往下多送一點（跟隨）才收
function atk1({ t, P }) {
  const base = P({ prop: 1 });
  const W = P({ hipsY: -0.06, hipsRY: -0.35, hipsRZ: 0, torsoX: -0.05, torsoY: -0.55, torsoZ: 0, headX: 0.1, headY: 0.35, headZ: 0,
    shRX: -2.4, shRZ: 0.9, elR: -1.35, wrR: -0.3, shLX: -1.25, shLZ: 0.2, elL: -0.35, hoL: 1, hsL: 0.7, wrL: -0.2,
    thLX: -0.3, thLZ: 0.12, knL: 0.5, thRX: 0.15, thRZ: 0.16, knR: 0.4, hoR: 0, prop: 1 });
  const S = P({ hipsY: -0.08, hipsZ: 0.08, hipsRY: 0.15, hipsRZ: 0, torsoX: 0.22, torsoY: 0.3, torsoZ: -0.15, headX: -0.1, headY: -0.3, headZ: 0,
    shRX: -1.55, shRZ: 0.35, elR: -0.08, wrR: 1.35, shLX: 0.45, shLZ: 0.6, elL: -0.7, hoL: 0.85, hsL: 0.5, wrL: 0,
    thLX: -0.5, thLZ: 0.14, knL: 0.5, thRX: 0.4, thRZ: 0.12, knR: 0.12, anR: 0.25, hoR: 0, prop: 1 });
  return own(track(t, [[0, base], [0.04, W], [0.05, W], [0.08, S, 'snap'], [0.13, S], [0.17, past(W, S, 0.12), 'out'], [0.2, past(W, S, 0.12)], [0.37, base]]));
}
// 普攻二（0.14 秒射出、0.42 秒結束）：反手橫掃——身體往左擰、棍子水平收在左側（棍尖朝左後）；出手瞬間棍子水平指向前方胸口高度，
// 之後再往右甩開到右後方（跟隨），整個棍尖掃出一道 180 度的水平弧，右腳踏出成大步
function atk2({ t, P }) {
  const base = P({ prop: 1 });
  const W = P({ hipsY: -0.08, hipsRY: 0.3, hipsRZ: 0, torsoX: 0.05, torsoY: 0.85, torsoZ: 0, headX: -0.08, headY: -0.6, headZ: 0,
    shRX: -0.95, shRY: -0.26, shRZ: -1.2, elR: -0.85, wrR: 1.5, shLX: 0.35, shLZ: 0.75, elL: -0.6, hoL: 0.9, hsL: 0.5, wrL: 0,
    thLX: -0.15, thLZ: 0.05, knL: 0.45, thRX: 0.1, thRZ: 0.05, knR: 0.5, hoR: 0, prop: 1 });
  const S = P({ hipsY: -0.12, hipsZ: 0.1, hipsRY: -0.2, hipsRZ: 0, torsoX: 0.1, torsoY: -0.3, torsoZ: 0.1, headX: -0.1, headY: 0.2, headZ: 0,
    shRX: -1.53, shRZ: -0.03, elR: -0.1, wrR: 1.3, shLX: -0.8, shLZ: 0.4, elL: -0.6, hoL: 1, hsL: 0.8, wrL: -0.2,
    thLX: 0.3, thLZ: 0.15, knL: 0.25, thRX: -0.55, thRZ: 0.25, knR: 0.6, anL: 0.25, hoR: 0, prop: 1 });
  const F = P({ hipsY: -0.16, hipsZ: 0.14, hipsRY: -0.45, hipsRZ: 0, torsoX: 0.3, torsoY: -0.95, torsoZ: 0.2, headX: -0.1, headY: 0.5, headZ: 0,
    shRX: -1.4, shRZ: 1.3, elR: -0.08, wrR: 1.1, shLX: -1.0, shLZ: 0.45, elL: -0.55, hoL: 1, hsL: 0.8, wrL: -0.2,
    thLX: 0.5, thLZ: 0.2, knL: 0.25, thRX: -0.75, thRZ: 0.3, knR: 0.75, anL: 0.3, hoR: 0, prop: 1 });
  return own(track(t, [[0, base], [0.05, W], [0.075, W], [0.11, S, 'snap'], [0.145, S], [0.2, F, 'out'], [0.24, F], [0.4, base]]));
}
// 普攻三（每第三下落雷；0.20 秒射出、0.48 秒結束）：天候棒直指天空、身體後仰、右腳往後勾起，停一拍蓄力；
// 再撲出去把棍子平指敵人（光彈從胸口射出），射出後才順勢往下壓（跟隨）
function atk3({ t, P }) {
  const base = P({ prop: 1 });
  const W = P({ hipsY: 0.0, hipsZ: -0.04, hipsRX: 0, hipsRY: -0.1, hipsRZ: 0, torsoX: -0.32, torsoY: -0.2, torsoZ: 0.05, headX: -0.5, headY: 0.1, headZ: 0,
    shRX: -3.0, shRZ: 0.12, elR: -0.12, wrR: 1.2, shLX: -0.35, shLZ: 1.05, elL: -0.35, hoL: 1, hsL: 0.8, wrL: 0,
    thLX: -0.06, thLZ: 0.08, knL: 0.08, thRX: 0.38, thRZ: 0.1, knR: 1.45, anL: 0.25, anR: 0.4, hoR: 0, prop: 1 });
  const S = P({ hipsY: -0.15, hipsZ: 0.2, hipsRX: 0.06, hipsRY: 0.15, hipsRZ: 0, torsoX: 0.3, torsoY: 0.2, torsoZ: -0.05, headX: -0.1, headY: -0.35, headZ: 0,
    shRX: -1.75, shRZ: 0.3, elR: -0.05, wrR: 1.35, shLX: 0.65, shLZ: 0.6, elL: -0.45, hoL: 0.9, hsL: 0.6, wrL: 0,
    thLX: -0.8, thLZ: 0.18, knL: 0.9, thRX: 0.65, thRZ: 0.12, knR: 0.15, anR: 0.35, hoR: 0, prop: 1 });
  const F = P({ ...S, hipsY: -0.17, torsoX: 0.45, headX: 0.05, shRX: -1.25, wrR: 0.85 });
  return own(track(t, [[0, base], [0.1, W], [0.13, W], [0.165, S, 'snap'], [0.21, S], [0.25, F, 'out'], [0.28, F], [0.46, base]]));
}

// Q 雷霆節拍（0.30 秒結束、0.40 秒落雷）：右手握棍往下收→猛然把天候棒直直舉向天空招雷（左手叉腰、雙腳踮起往前一步，
// 和普攻三的後勾腳區分）→棍子一指劈向地上的落雷處停住 0.05 秒，0.30 秒前收回七成（動作結束後的待機平滑很慢，不能停在全伸展）
function cast_Q({ t, P }) {
  const base = P({ prop: 1 });
  const gather = P({ hipsY: -0.1, hipsRY: 0.1, torsoX: 0.18, torsoY: 0.45, torsoZ: 0, headX: 0.05, headY: -0.3, headZ: 0,
    shRX: -0.35, shRZ: -0.3, elR: -1.6, wrR: 0.6, hoR: 0, thLX: -0.35, knL: 0.6, thRX: 0.15, knR: 0.55, prop: 1 });
  const sky = P({ hipsY: 0.03, hipsZ: 0.04, hipsRY: -0.1, hipsRZ: -0.08, torsoX: -0.2, torsoY: -0.1, torsoZ: 0.1, headX: -0.45, headY: -0.25, headZ: -0.05,
    shRX: -2.9, shRZ: 0.2, elR: -0.05, wrR: 1.2, hoR: 0, hsR: 0.3,
    thLX: -0.22, thLZ: 0.06, knL: 0.1, thRX: 0.1, thRZ: 0.14, knR: 0.1, anL: 0.4, anR: 0.4, prop: 1 });
  const point = P({ hipsY: -0.08, hipsZ: 0.1, hipsRY: 0.15, torsoX: 0.35, torsoY: 0.45, torsoZ: 0, headX: 0.05, headY: -0.4, headZ: 0,
    shRX: -0.76, shRZ: 0.53, elR: -0.32, wrR: 1.0, hoR: 0, hsR: 0.3,
    thLX: -0.55, thLZ: 0.1, knL: 0.55, thRX: 0.4, thRZ: 0.12, knR: 0.25, anR: 0.25, prop: 1 });
  return own(track(t, [[0, base], [0.045, gather], [0.095, sky, 'out'], [0.145, sky], [0.195, point, 'snap'], [0.25, point], [0.3, lerpPose(point, base, 0.72)]]));
}
// W 冷氣泡（霧與傷害在 0 秒就出現、0.30 秒結束）：天候棒收在背上，雙手捧在下巴前、低頭吹氣→兩手往前推開、手腕往後翻（掌心朝外）
function cast_W({ t, P }) {
  const base = P({ prop: -1 });
  const blow = P({ hipsY: -0.06, hipsZ: -0.04, hipsRY: 0.05, torsoX: -0.08, torsoY: 0.15, torsoZ: 0, headX: 0.15, headY: -0.15, headZ: 0,
    shLX: -1.0, shLZ: -0.55, elL: -1.9, shRX: -1.0, shRZ: -0.55, elR: -1.9, wrL: -0.3, wrR: -0.3, hoL: 0.85, hoR: 0.85, hsL: 0.7, hsR: 0.7,
    thLX: -0.15, knL: 0.2, thRX: 0.12, knR: 0.5, prop: -1 });
  const push = P({ hipsY: -0.12, hipsZ: 0.12, hipsRY: 0, hipsRZ: 0, torsoX: 0.3, torsoY: 0.05, torsoZ: 0, headX: -0.15, headY: 0, headZ: 0,
    shLX: -1.6, shLZ: 0.55, elL: -0.12, shRX: -1.6, shRZ: 0.55, elR: -0.12, wrL: -0.8, wrR: -0.8, hoL: 1, hoR: 1, hsL: 0.9, hsR: 0.9,
    thLX: -0.62, thLZ: 0.12, knL: 0.62, thRX: 0.52, thRZ: 0.1, knR: 0.2, anR: 0.35, prop: -1 });
  return own(track(t, [[0, base], [0.04, blow], [0.07, blow], [0.13, push, 'snap'], [0.22, push], [0.3, lerpPose(push, base, 0.7)]]));
}
// E 旋風節拍（吹飛與塵土在 0 秒、0.35 秒結束）：壓低往右擰、雙臂交抱（短蓄力）→反向甩開成單腳芭蕾旋轉（spin 整整一圈），
// 右膝外開、腳收到左膝旁；左手高舉成弧、右手握天候棒往外斜下甩出，轉起來棍子掃出一個圓；頭慢半拍（留頭）
function barrier_E({ t, P }) {
  const base = P({ prop: 1 });
  const coil = P({ hipsY: -0.15, hipsRY: -0.6, hipsRZ: 0, torsoX: 0.25, torsoY: -1.1, torsoZ: 0, headX: 0.05, headY: 0.5, headZ: 0,
    shLX: -1.2, shLZ: -0.95, elL: -1.3, shRX: -1.2, shRZ: -0.95, elR: -1.3, hoL: 0.85, hsL: 0.6, hoR: 0, wrL: 0, wrR: 0.6,
    thLX: -0.45, thLZ: 0.2, knL: 0.85, thRX: 0.1, thRZ: 0.2, knR: 0.85, prop: 1 });
  const spin = (w) => P({ hipsY: 0.05, hipsRY: -0.2 + 0.4 * w, hipsRZ: 0.04, torsoX: -0.08, torsoY: 0.3 * (1 - w), torsoZ: -0.08, headX: -0.15, headY: 0.4 - 0.8 * w, headZ: 0,
    shLX: -2.3, shLZ: 0.9, elL: -0.4, shRX: 0.15, shRZ: 1.05, elR: -0.15, wrL: -0.2, wrR: 1.1, hoL: 1, hsL: 1, hoR: 0,
    thLX: 0.0, thLZ: 0.05, knL: 0.03, thRX: -1.15, thRZ: 0.85, knR: 1.3, anL: 0.35, anR: 0.4, prop: 1 });
  // 轉滿一圈後落地：抬起的右腳踩回地面、屈膝吸收，雙臂放下
  const land = P({ hipsY: -0.08, hipsRY: 0.1, hipsRZ: 0, torsoX: 0.12, torsoY: 0, torsoZ: 0, headX: 0, headY: -0.1, headZ: 0,
    shLX: -0.9, shLZ: 0.8, elL: -0.5, wrL: 0, hoL: 0.9, hsL: 0.6, shRX: -0.5, shRZ: 0.75, elR: -0.3, wrR: 1.0, hoR: 0,
    thLX: -0.12, thLZ: 0.08, knL: 0.32, thRX: 0, thRZ: 0.15, knR: 0.3, anL: 0, anR: 0, prop: 1 });
  const p = track(t, [[0, base], [0.04, coil], [0.1, spin(0), 'out'], [0.28, spin(1)], [0.32, land], [0.35, lerpPose(land, base, 0.6)]]);
  // 自轉：0.08 秒起甩出、一開始最快再慢下來，0.32 秒剛好轉滿一圈（2π）；收尾時折回 0，不會反轉回去
  const u = clamp((t - 0.08) / 0.24, 0, 1);
  p.spin = t >= 0.32 ? 2 * Math.PI : 2 * Math.PI * (1 - (1 - u) * (1 - u));
  return own(p);
}
// R 雷雲・宙之雷（0.45 秒開始落雷、0.50 秒結束）：蹲下雙臂交叉收在胸前→雙手高舉成大 V（右手握天候棒）、
// 仰頭、雙腳踮起喚雷雲→右手連棍一劈指向雷雲下方，左手留在上面
function overhead_R({ t, P }) {
  const base = P({ prop: 1 });
  const crouch = P({ hipsY: -0.2, hipsZ: -0.03, hipsRY: 0, hipsRZ: 0, torsoX: 0.45, torsoY: 0.1, torsoZ: 0, headX: 0.3, headY: 0, headZ: 0,
    shLX: -0.75, shLZ: -0.95, elL: -1.3, shRX: -0.75, shRZ: -0.95, elR: -1.3, hoL: 0.85, hsL: 0.6, hoR: 0, wrL: 0, wrR: 0.6,
    thLX: -0.65, thLZ: 0.25, knL: 1.15, thRX: -0.35, thRZ: 0.25, knR: 1.2, prop: 1 });
  const call = P({ hipsY: 0.04, hipsZ: 0, hipsRY: 0, hipsRZ: 0, torsoX: -0.3, torsoY: 0, torsoZ: 0, headX: -0.6, headY: 0, headZ: 0,
    shLX: -2.35, shLZ: 1.3, elL: -0.12, shRX: -2.9, shRZ: 0.45, elR: -0.08, hoL: 1, hsL: 0.9, hoR: 0, wrL: -0.3, wrR: 1.2,
    thLX: -0.05, thLZ: 0.3, knL: 0.05, thRX: 0.05, thRZ: 0.3, knR: 0.1, anL: 0.4, anR: 0.4, prop: 1 });
  const strikeDown = P({ hipsY: -0.12, hipsZ: 0.16, hipsRY: 0.2, hipsRZ: 0, torsoX: 0.3, torsoY: 0.5, torsoZ: -0.05, headX: -0.05, headY: -0.45, headZ: 0,
    shLX: -2.5, shLZ: 0.8, elL: -0.25, shRX: -0.97, shRZ: 0.76, elR: -0.02, hoL: 1, hoR: 0, hsL: 0.8, wrL: -0.2, wrR: 0.95,
    thLX: -0.7, thLZ: 0.15, knL: 0.7, thRX: 0.5, thRZ: 0.12, knR: 0.2, anR: 0.3, prop: 1 });
  return own(track(t, [[0, base], [0.08, crouch], [0.12, crouch], [0.21, call, 'snap'], [0.31, call], [0.38, strikeDown, 'snap'], [0.45, strikeDown], [0.5, lerpPose(strikeDown, base, 0.5)]]));
}

// 勝利：叉腰扭腰、右手攤開在臉頰旁（掌心朝鏡頭）、頭歪一邊，墊腳輕跳
function win({ t, P }) {
  const b = Math.abs(Math.sin(t * 3.2));
  return own(P({ hipsY: -0.035 + 0.07 * b, hipsRY: -0.2, hipsRZ: -0.16, torsoX: -0.06, torsoY: 0.3, torsoZ: 0.16, headX: -0.18, headY: -0.3, headZ: -0.3,
    ...HIP_L,
    shRX: -1.25 - 0.1 * b, shRZ: 0.75, elR: -2.3, wrR: -0.6, hoR: 1, hsR: 1,
    thLX: -0.12, thLZ: -0.12, knL: 0.35, thRX: 0.05, thRZ: 0.14, knR: 0.02, anL: 0.2 + 0.3 * b, anR: 0.25 * b, prop: -1 }));
}
// 回城／集氣：放鬆的對立式站姿，右手在胸前攤開、掌心朝上，低頭看著手心（不學共用的握拳蹲馬步）
function charge({ t, P }) {
  const br = Math.sin(t * 3);
  return own(P({ headX: 0.25, headY: 0.15, headZ: -0.1, torsoX: 0.06,
    shRX: -0.9 - 0.04 * br, shRZ: 0.2, elR: -1.4, wrR: -0.4, hoR: 1, hsR: 0.8, prop: -1 }));
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
    hoL: 0.75, hoR: 0.75, hsL: 0.5, hsR: 0.5, anL: 0, anR: 0, prop: -1 }));
}

export default {
  stance, atk1: fixL(atk1), atk2: fixL(atk2), atk3: fixL(atk3), cast_Q: fixL(cast_Q), cast_W: fixL(cast_W),
  barrier_E: fixL(barrier_E), overhead_R: fixL(overhead_R), win: fixL(win), charge: fixL(charge), run: fixL(run),
};
