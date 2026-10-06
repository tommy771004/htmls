// sanji 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（strike、lerpPose、ease、clamp、IMPACT…）。
//
// 香吉士：雙手永遠插在口袋、只用腳。招式對照 combat.js 的 KITS.sanji：
//   Q 首肉射擊 → atk3_Q（0.12 秒命中）、W 羊肉射擊 → vanish_W（倒立旋轉，0.10／0.26／0.42 三段）、
//   E 空中步行 → air_E（0.4 秒踏空跳躍）、R 惡魔風腳 → dash_R → rush_R（每 0.09 秒一腳，第 6 下收尾踢炸飛）。
import { strike, lerpPose, ease, clamp, blank, IMPACT } from '../pose-kit.js';

const TAU = Math.PI * 2;
// 插口袋的手：上臂貼著身側略往後、手肘彎成前臂斜插進褲袋，拳頭收起、手腕往內折
const POCKET = { shLX: 0.26, shLZ: 0.1, elL: -0.72, shRX: 0.26, shRZ: 0.1, elR: -0.72, hoL: 0.1, hoR: 0.1, hsL: 0, hsR: 0, wrL: 0.35, wrR: 0.35 };

// 分段內插：keys = [[時間, 姿勢], …]，相鄰兩格之間用 ease
function track(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, p1] = keys[i];
    if (t < t1) { const [t0, p0] = keys[i - 1]; return lerpPose(p0, p1, ease((t - t0) / (t1 - t0))); }
  }
  return keys[keys.length - 1][1];
}

// 惡魔風腳連踢：每 0.09 秒一腳、左右輪流，高掃與側踢交錯；腿伸到最直的時刻比命中早約一格（畫面姿勢平滑有延遲）
function rushKick(t, P) {
  const per = 0.09, u = t + 0.035, i = Math.floor(u / per), f = (u % per) / per;
  const ext = f < 0.45 ? ease(f / 0.45) : 1 - ease((f - 0.45) / 0.55) * 0.7;
  const right = i % 2 === 0, high = i % 4 < 2;
  const s = right ? 1 : -1;
  const legX = (high ? -1.55 : -1.2) * ext, legZ = (high ? 0.5 : 1.1) * ext;
  return P({ hipsY: -0.02 + 0.05 * ext, hipsZ: 0.06, hipsRY: -0.6 * s * ext, torsoX: -0.3 * ext, torsoY: 0.8 * s * ext, torsoZ: 0.35 * s * ext,
    headX: 0, headY: -0.3 * s * ext, headZ: 0,
    thRX: right ? legX : 0.15, thRZ: right ? legZ : 0.1, knR: right ? 1.4 * (1 - ext) + 0.03 : 0.25,
    thLX: right ? 0.15 : legX, thLZ: right ? 0.1 : legZ, knL: right ? 0.25 : 1.4 * (1 - ext) + 0.03,
    anR: right ? 0.4 * ext : 0, anL: right ? 0 : 0.4 * ext });
}

// 惡魔風腳的收尾踢：右腳收到身後蓄勢，跳起來把燃燒的右腳橫著整條甩出去，上身倒向反側成一個「T」，把敵人炸飛
// from：蓄勢從哪個姿勢開始（連踢中途接上；沒給就從架式）；命中後收回架式
const LAST_HIT = 0.02 + 5 * 0.09; // combat.js：rushAction 第一下在 0.02 秒，之後每 0.09 秒一下，香吉士 R 共 6 下
const FIN = 0.07, LEAD = 0.03; // 收尾踢開始後 0.07 秒腿伸到最直；比真正命中早 0.03 秒，抵掉畫面姿勢平滑的延遲
function finale(t, base, P, from = base) {
  const W = P({ hipsY: -0.18, hipsRY: 0.6, torsoX: 0.3, torsoY: -0.7, torsoZ: 0.1, headY: -0.2, thLX: -0.6, knL: 1.1, thRX: 0.5, thRZ: 0.3, knR: 1.6 });
  const S = P({ hipsY: 0.16, hipsRY: -0.85, hipsRZ: -0.2, hipsZ: 0.22, torsoX: -0.25, torsoY: 1.0, torsoZ: 0.7, headX: 0.05, headY: 0.2, headZ: -0.35,
    thLX: 0.1, thLZ: 0.05, knL: 0.5, thRX: -1.1, thRZ: 1.4, knR: 0.02, anR: 0.45, anL: 0.35 });
  return strike(t, FIN, t < FIN * 0.55 ? from : base, W, S, 0.4);
}

export default {
  // 架式：側身、左腳在前虛點，上身微微後仰、下巴抬起斜睨；呼吸讓肩膀起伏，重心在後腳上輕輕搖
  stance({ t }) { // （此時 ctx.P 還沒準備好，自己從 blank() 組）
    const br = Math.sin(t * 2.4), sw = Math.sin(t * 1.1);
    return Object.assign(blank(), {
      ...POCKET,
      hipsY: -0.035 - 0.008 * br, hipsRY: 0.42, hipsRZ: 0.05 + 0.015 * sw, hipsZ: -0.01,
      torsoX: -0.06 + 0.012 * br, torsoY: 0.12, torsoZ: -0.03, headX: -0.1, headY: -0.42, headZ: 0.04,
      shLX: 0.2 - 0.03 * br, shRX: 0.22 - 0.03 * br,
      thLX: -0.16, thLZ: 0.14, knL: 0.2, thRX: 0.08, thRZ: 0.1, knR: 0.06, toL: 0.1,
    });
  },

  // 普攻一：前腳（左）縮腿後彈出的側前踢，上身往反方向倒
  atk1({ t, base, P }) {
    const W = P({ hipsY: -0.06, hipsRY: 0.55, torsoX: 0.02, torsoY: 0.2, torsoZ: -0.08, headY: -0.5,
      thLX: -0.95, thLZ: 0.25, knL: 1.9, thRX: 0.15, knR: 0.32 });
    const S = P({ hipsY: 0.0, hipsRY: 0.75, hipsZ: 0.1, torsoX: -0.32, torsoY: 0.3, torsoZ: -0.25, headX: -0.05, headY: -0.7,
      thLX: -1.5, thLZ: 0.45, knL: 0.04, thRX: 0.22, thRZ: 0.12, knR: 0.12, anL: 0.3 });
    return strike(t, IMPACT.atk1, base, W, S, 0.34);
  },

  // 普攻二：後腳（右）迴旋踢，髖先轉、腿從外側水平掃過，上身反向扭並往外倒
  atk2({ t, base, P }) {
    const W = P({ hipsY: -0.08, hipsRY: 0.1, torsoX: 0.06, torsoY: -0.55, torsoZ: 0.05, headY: -0.2,
      thLX: -0.35, knL: 0.45, thRX: 0.45, thRZ: 0.3, knR: 1.55 });
    const S = P({ hipsY: 0.0, hipsRY: -0.9, hipsZ: 0.12, hipsRZ: -0.1, torsoX: -0.2, torsoY: 1.0, torsoZ: 0.45, headY: 0.3, headZ: -0.2,
      thLX: 0.05, thLZ: 0.08, knL: 0.18, thRX: -1.05, thRZ: 1.15, knR: 0.06, anR: 0.3 });
    return strike(t, IMPACT.atk2, base, W, S, 0.38);
  },

  // 普攻三：小跳轉身的高掃踢（左腳），身體幾乎躺平，腿伸到最遠
  atk3({ t, base, P }) {
    const W = P({ hipsY: -0.16, hipsRY: 0.85, torsoX: 0.25, torsoY: 0.45, torsoZ: -0.1, headY: -0.6,
      thLX: -0.45, thLZ: 0.2, knL: 1.3, thRX: 0.2, knR: 1.05 });
    const S = P({ hipsY: 0.06, hipsRY: -0.55, hipsZ: 0.18, hipsRZ: 0.1, torsoX: -0.4, torsoY: -0.9, torsoZ: -0.5, headY: -0.15, headZ: 0.25,
      thLX: -1.15, thLZ: 1.25, knL: 0.04, thRX: 0.12, thRZ: 0.06, knR: 0.35, anL: 0.35 });
    return strike(t, IMPACT.atk3, base, W, S, 0.44);
  },

  // Q 首肉射擊（Collier Shoot）：大步踏進、後腳由下往上踢向脖子，上身後仰到最開；0.12 秒命中
  atk3_Q({ t, base, P }) {
    const W = P({ hipsY: -0.2, hipsRY: 0.6, hipsZ: -0.08, torsoX: 0.35, torsoY: -0.35, headX: -0.25, headY: -0.3,
      thLX: -0.75, thLZ: 0.25, knL: 1.15, thRX: 0.55, thRZ: 0.15, knR: 1.4 });
    const S = P({ hipsY: 0.04, hipsRY: -0.35, hipsZ: 0.22, torsoX: -0.6, torsoY: 0.55, torsoZ: 0.35, headX: 0.1, headY: -0.6,
      thLX: 0.12, thLZ: 0.1, knL: 0.08, thRX: -2.1, thRZ: 0.6, knR: 0.02, anR: 0.4, anL: 0.25 });
    return strike(t, 0.12, base, W, S, 0.4);
  },

  // W 羊肉射擊：手抽出口袋撐地倒立，雙腿劈成一字像螺旋槳一樣轉三圈，最後翻回站姿
  vanish_W({ t, d, base, P }) {
    const handH = d.torso + d.upper + d.lower + d.fist - d.L; // 倒立時手掌剛好撐在地上的骨盆高度
    const crouch = P({ hipsY: -0.22, hipsRY: 0, hipsRZ: 0, torsoX: 0.9, torsoY: 0, torsoZ: 0, headX: -0.5, headY: 0,
      shLX: -1.3, shLZ: 0.25, elL: -0.2, shRX: -1.3, shRZ: 0.25, elR: -0.2, hoL: 1, hoR: 1, hsL: 0.8, hsR: 0.8, wrL: 0, wrR: 0,
      thLX: -0.9, thLZ: 0.25, knL: 1.5, thRX: -0.9, thRZ: 0.25, knR: 1.5 });
    const flip = P({ hipsY: handH + 0.15, hipsRX: 1.7, hipsRY: 0, hipsRZ: 0, torsoX: 0.3, torsoY: 0, torsoZ: 0, headX: -0.6, headY: 0,
      shLX: -2.6, shLZ: 0.3, elL: -0.15, shRX: -2.6, shRZ: 0.3, elR: -0.15, hoL: 1, hoR: 1, hsL: 1, hsR: 1, wrL: -0.9, wrR: -0.9,
      thLX: -0.2, thLZ: 0.6, knL: 0.9, thRX: -0.2, thRZ: 0.6, knR: 0.9 });
    const hand = P({ hipsY: handH, hipsRX: Math.PI, hipsRY: 0, hipsRZ: 0, torsoX: 0, torsoY: 0, torsoZ: 0, headX: -0.7, headY: 0,
      shLX: -3.0, shLZ: 0.32, elL: -0.05, shRX: -3.0, shRZ: 0.32, elR: -0.05, hoL: 1, hoR: 1, hsL: 1, hsR: 1, wrL: -1.2, wrR: -1.2,
      thLX: 0, thLZ: 1.35, knL: 0.02, thRX: 0, thRZ: 1.35, knR: 0.02 });
    let p = track(t, [[0, base], [0.05, crouch], [0.1, flip], [0.14, hand], [0.5, hand], [0.58, flip], [0.68, base]]);
    p = { ...p };
    // 腿掃過的那一下（每段命中前後）腿劈得更開
    const kick = Math.max(0, Math.cos((t - 0.1) * TAU / 0.16));
    if (t > 0.12 && t < 0.5) { p.thLZ += 0.12 * kick; p.thRZ += 0.12 * kick; }
    // 自轉：每 0.16 秒轉半圈，命中時刻（0.10／0.26／0.42）劈開的腿剛好掃過正前方；收招時減速轉到整圈（4π）
    const w = Math.PI / 0.16;
    p.spin = t < 0.1 ? 0.5 * Math.PI * ease(clamp((t - 0.04) / 0.06, 0, 1))
      : t < 0.5 ? 0.5 * Math.PI + (t - 0.1) * w
        : t < 0.62 ? 3 * Math.PI + Math.PI * Math.sin(0.5 * Math.PI * (t - 0.5) / 0.12) : 0;
    p.ownHands = true;
    return p;
  },

  // E 空中步行（Sky Walk）：兩腳輪流在空氣上蹬，膝蓋抬高、手插口袋，落地前收腿
  // 兩步各停約 0.1 秒（air 的姿勢平滑較慢，步子太碎會被抹平）：左膝抬高、右腳往下踩空氣 → 換腳 → 屈膝落地
  air_E({ t, P }) {
    const step = (s) => { // s = 1 左膝在上，-1 右膝在上
      const up = s > 0 ? 'L' : 'R', dn = s > 0 ? 'R' : 'L';
      return P({ hipsY: 0.06, hipsRY: 0.1 + 0.25 * s, hipsRX: 0.08, torsoX: 0.1, torsoY: -0.35 * s, torsoZ: 0.06 * s, headX: -0.25, headY: -0.1 + 0.25 * s,
        ['th' + up + 'X']: -1.6, ['th' + up + 'Z']: 0.18, ['kn' + up]: 2.05, ['an' + up]: -0.25,
        ['th' + dn + 'X']: 0.6, ['th' + dn + 'Z']: 0.06, ['kn' + dn]: 0.08, ['an' + dn]: 0.7, ['to' + dn]: 0.35 });
    };
    const A = step(1), B = step(-1);
    const land = P({ hipsY: -0.16, torsoX: 0.25, headX: -0.15, thLX: -0.6, thLZ: 0.2, knL: 1.0, thRX: 0.15, thRZ: 0.15, knR: 0.9 });
    return track(t, [[0, P({ hipsY: -0.12, torsoX: 0.2, thLX: -0.5, knL: 0.9, thRX: 0.2, knR: 0.8 })], [0.05, A], [0.15, A], [0.2, B], [0.3, B], [0.38, land]]);
  },

  // R 惡魔風腳：燃燒的右腳在前、身體後仰飛踢衝出
  // 起手先在左腳上擰身、右腳收到身後點火（惡魔風腳靠旋轉摩擦生熱），再整個人飛出去
  dash_R({ t, P }) {
    const fl = Math.sin(t * 40) * 0.05;
    const fly = P({ hipsY: 0.16, hipsRX: -0.55, hipsRY: -0.35, torsoX: 0.05, torsoY: 0.45, torsoZ: 0.12, headX: 0.35, headY: -0.45,
      thRX: -1.1 + fl, thRZ: 0.15, knR: 0.03, anR: 0.45, thLX: 0.15 - fl, thLZ: 0.2, knL: 1.85 });
    if (t >= 0.1) return fly;
    const coil = P({ hipsY: -0.14, hipsRY: 1.0, torsoX: 0.3, torsoY: 0.5, torsoZ: -0.1, headX: -0.1, headY: -0.9,
      thLX: -0.45, thLZ: 0.15, knL: 0.9, thRX: 0.75, thRZ: 0.25, knR: 1.7, anR: 0.4 });
    return t < 0.05 ? lerpPose(P({}), coil, ease(t / 0.05)) : lerpPose(coil, fly, ease((t - 0.05) / 0.05));
  },

  // 惡魔風腳連踢：每 0.09 秒一腳、左右輪流，高掃與側踢交錯，命中瞬間腿伸到最直
  // 第 6 下（0.47 秒）是收尾踢：從第 5 腳收腿的途中直接接蓄勢，不回架式
  rush_R({ t, base, P }) {
    const t0 = LAST_HIT - LEAD - FIN;
    if (t >= t0) return finale(t - t0, base, P, rushKick(t0, P));
    return rushKick(t, P);
  },

  // 惡魔風腳最後一腳：rushAction 只在命中那一格把動作換成 atk3，下一格又換回 rush，所以真正的收尾踢畫在 rush_R 裡；
  // 這裡讓那一格直接是命中姿勢，不會閃回架式
  atk3_R({ t, base, P }) { return finale(t + FIN + LEAD, base, P); },

  // 勝利：一手插口袋、一手在嘴邊護著火點菸，頭低下來
  win({ t, P }) {
    const b = Math.sin(t * 2);
    return P({ hipsY: -0.02, hipsRY: 0.3, hipsRZ: 0.08, torsoX: 0.05, torsoY: 0.2, headX: 0.25 + 0.03 * b, headY: -0.15, headZ: 0.1,
      shRX: -1.05, shRZ: -0.15, elR: -2.45, hoR: 0.55, hsR: 0.5, wrR: -0.3,
      thLX: -0.12, thLZ: 0.06, knL: 0.08, thRX: 0.1, thRZ: 0.12, knR: 0.25 });
  },
};
