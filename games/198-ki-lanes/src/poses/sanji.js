// sanji 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（strike、lerpPose、ease、clamp、IMPACT…）。
//
// 香吉士：雙手永遠插在口袋、只用腳。招式對照 combat.js 的 KITS.sanji：
//   Q 首肉射擊 → atk3_Q（0.12 秒命中）、W 羊肉射擊 → vanish_W（倒立旋轉，0.10／0.26／0.42 三段）、
//   E 空中步行 → air_E（0.4 秒踏空跳躍）、R 惡魔風腳 → dash_R → rush_R（每 0.09 秒一腳）→ 第 5 下迴旋後踢、第 6 下 atk3_R 轉滿一圈的側踢炸飛。
// 自己的動作走快速平滑（τ≈31 毫秒）：關鍵姿勢要停 50 毫秒以上才看得到，命中姿勢要比真正命中早約一格到位。
import { strike, lerpPose, ease, clamp, blank, IMPACT } from '../pose-kit.js';

const TAU = Math.PI * 2;
// 插口袋的手：上臂往後擺、往內旋讓手肘往外撐，前臂斜插進褲袋，拳頭沉進胯側（從鏡頭看只剩手腕）
const POCKET = { shLX: 0.55, shLZ: 0.25, shLY: -0.9, elL: -1.1, shRX: 0.55, shRZ: 0.25, shRY: -0.9, elR: -1.1, hoL: 0.1, hoR: 0.1, hsL: 0, hsR: 0, wrL: 0.9, wrR: 0.9 };
// 踢高腿時那一側的手再往後收，拳頭留在髖骨後面，不會插進抬起來的大腿
const BACK_L = { shLX: 0.8, elL: -1.0 }, BACK_R = { shRX: 0.8, elR: -1.0 };

// 分段內插：keys = [[時間, 姿勢], …]，相鄰兩格之間用 ease
function track(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, p1] = keys[i];
    if (t < t1) { const [t0, p0] = keys[i - 1]; return lerpPose(p0, p1, ease((t - t0) / (t1 - t0))); }
  }
  return keys[keys.length - 1][1];
}

// 有停頓的出腿：from → W（tw 到位）→ 停在 W 到 th → 越來越快踢到 S（ti）→ 順勢多送一點 → rec 收回 base
const _ov = {};
function kick(t, tw, th, ti, base, W, S, rec, from = base) {
  if (t < tw) return lerpPose(from, W, ease(t / tw));
  if (t < th) return W;
  if (t < ti) { const u = (t - th) / (ti - th); return lerpPose(W, S, u * u * (2 - u)); }
  for (const k in S) if (typeof S[k] === 'number') _ov[k] = S[k] + (S[k] - W[k]) * 0.1;
  if (t < ti + 0.07) return lerpPose(S, _ov, Math.sin(Math.PI * 0.5 * clamp((t - ti) / 0.04, 0, 1)));
  return lerpPose(_ov, base, ease(clamp((t - ti - 0.07) / Math.max(0.05, rec - ti - 0.07), 0, 1)));
}

// 惡魔風腳連踢：每 0.09 秒一腳，同一條腿連踢兩下再換腳（右右、左左），第一下往斜前方高掃、第二下把髖甩回來側踢，
// 兩下之間膝蓋收在胸前、大腿不放下（τ≈31 毫秒的平滑下，每腳都換腿會抹成原地踏步）
// 一腳的節奏（f 是這一腳的進度）：0～0.3 大腿抬到最高、膝蓋收著（蓄勢）→ 0.3～0.42 膝蓋彈直 → 停到 0.62 → 膝蓋收回
// 命中在每段 0.02 秒，落在這一腳 f≈0.67（伸直停住剛結束：畫面平滑慢約 30 毫秒，腿看起來正好最直）
// 從上往下看：高踢往斜前方（髖往踢腳那側轉開）、側踢把髖轉回來讓腳掃到外側，腿每一下換一個角度，張成一把扇子
function rushKick(t, P) {
  const per = 0.09, u = t + 0.04, i = Math.floor(u / per), f = (u % per) / per;
  const second = i % 2 === 1, right = Math.floor(i / 2) % 2 === 0, high = !second;
  const from = second ? 0.8 : 0.35, to = second ? 0.35 : 0.8; // 第一下從低處抬起、收到胸前；第二下從胸前出腿、踢完放下換腳
  const lift = f < 0.3 ? from + (1 - from) * ease(f / 0.3) : f < 0.62 ? 1 : 1 + (to - 1) * ease((f - 0.62) / 0.38);
  const snap = f < 0.3 ? 0 : f < 0.42 ? ease((f - 0.3) / 0.12) : f < 0.62 ? 1 : 1 - ease((f - 0.62) / 0.38);
  const s = right ? 1 : -1, K = right ? 'R' : 'L', N = right ? 'L' : 'R';
  const legX = (high ? -2.0 : -1.15) * lift, legZ = (high ? 0.35 : 1.4) * lift;
  const yaw = (high ? -0.55 : 0.8) * s * Math.min(1, lift + 0.2);
  const p = P({ hipsY: -0.04 + 0.08 * Math.abs(Math.sin(Math.PI * f)), hipsZ: 0.06, hipsRY: yaw,
    torsoX: (high ? -0.4 : -0.15) * lift, torsoY: -0.8 * yaw, torsoZ: (high ? 0.15 : 0.55) * s * lift,
    headX: high ? 0.2 * lift : 0, headY: -0.3 * yaw, headZ: 0,
    ['th' + K + 'X']: legX, ['th' + K + 'Z']: legZ, ['kn' + K]: 1.6 * (1 - snap) + 0.03, ['an' + K]: 0.4 * snap,
    ['th' + N + 'X']: 0.15, ['th' + N + 'Z']: 0.1, ['kn' + N]: 0.45, ['an' + N]: 0 });
  return Object.assign(p, right ? BACK_R : BACK_L);
}

// 惡魔風腳的收尾踢：轉身背對目標、右腳往後蹬（第 5 下），再轉滿一圈把燃燒的右腳橫著整條甩出去，上身倒向反側成一個「T」，把敵人炸飛（第 6 下）
// from：蓄勢從哪個姿勢開始（連踢中途接上；沒給就從架式）；命中後收回架式
// combat.js：rushAction 第一下在 0.02 秒，之後每 0.09 秒一下，香吉士 R 共 6 下；第 6 下那一格把動畫換成 atk3（t 從 0 重播）
const LAST_HIT = 0.02 + 5 * 0.09;
const FIN = 0.11, LEAD = 0.035; // 收尾踢開始後 0.11 秒腿伸到最直；比真正命中早 0.035 秒，抵掉畫面姿勢平滑的延遲
const FW = 0.035, FH = 0.07; // 0.035 秒轉到 W、停到 0.07 秒
// 收尾踢就是第 5、6 兩腳的一整圈迴旋：開始後 0.035 秒整個人往右轉開到背對目標、右腳幾乎伸直往後蹬出（迴旋後踢，第 5 下 0.38 秒命中），
// 停到 0.07 秒，再順著同一個方向越轉越快轉滿一圈，右腳橫著甩成側踢 S（第 6 下）。
// spin 不進 lerpPose：W 轉到 −2.45、S 轉到 −2π（和 0 同方向），之後一直停在 −2π，換動作時歸零看不出來
function finale(t, base, P, from = base) {
  const W = P({ hipsY: -0.14, hipsRX: 0.45, hipsRY: -0.6, hipsZ: 0.05, torsoX: 0.35, torsoY: 0.55, torsoZ: -0.2, headX: -0.55, headY: 0.7,
    thLX: -0.5, thLZ: 0.1, knL: 0.75, thRX: 1.2, thRZ: 0.12, knR: 0.15, anR: -0.35, ...BACK_R });
  const S = P({ hipsY: 0.32, hipsRY: 1.4, hipsRZ: -0.95, hipsZ: 0.22, torsoX: -0.1, torsoY: -0.6, torsoZ: -0.45, headX: 0.05, headY: -0.5, headZ: 0.6,
    thLX: -0.45, thLZ: 0.8, knL: 1.2, thRX: -0.3, thRZ: 0.8, knR: 0.02, anR: 0.45, anL: 0.35, ...BACK_R });
  const p = { ...kick(t, FW, FH, FIN, base, W, S, 0.4, from) };
  const SW = -2.45;
  p.spin = t < FW ? SW * ease(t / FW) : t < FH ? SW : t < FIN ? SW + (-TAU - SW) * ((t - FH) / (FIN - FH)) ** 1.6 : -TAU;
  return p;
}

const poses = {
  // 架式：側身、左腳在前虛點，上身微微後仰、下巴抬起斜睨；呼吸讓肩膀起伏，重心在後腳上輕輕搖
  stance({ t }) { // （此時 ctx.P 還沒準備好，自己從 blank() 組）
    const br = Math.sin(t * 2.4), sw = Math.sin(t * 1.1);
    return Object.assign(blank(), {
      ...POCKET,
      hipsY: -0.035 - 0.008 * br, hipsRY: 0.42, hipsRZ: 0.05 + 0.015 * sw, hipsZ: -0.01,
      torsoX: -0.06 + 0.012 * br, torsoY: 0.12, torsoZ: -0.03, headX: -0.1, headY: -0.42, headZ: 0.04,
      shLX: 0.55 - 0.03 * br, shRX: 0.57 - 0.03 * br,
      thLX: -0.16, thLZ: 0.14, knL: 0.2, thRX: 0.08, thRZ: 0.1, knR: 0.06, toL: 0.1,
    });
  },

  // 跑步：腿照一般跑姿大步跨，手仍插在口袋裡、上身前傾少一點
  run({ phase, P }) {
    const s = Math.sin(phase), c = Math.cos(phase);
    return P({ hipsY: -0.09 + 0.08 * Math.abs(c), hipsRX: 0.08, hipsRY: -0.2 * s, torsoX: 0.3, torsoY: 0.3 * s, headX: -0.25, headY: -0.2 * s,
      thLX: s * 1.3 - 0.15, thRX: -s * 1.3 - 0.15, thLZ: 0.05, thRZ: 0.05,
      knL: 0.3 + 1.6 * Math.max(0, -c) * (0.6 + 0.4 * Math.max(0, -s)), knR: 0.3 + 1.6 * Math.max(0, c) * (0.6 + 0.4 * Math.max(0, s)),
      shLX: 0.55 + 0.08 * s, shRX: 0.55 - 0.08 * s });
  },

  // 普攻一：前腳（左）縮腿後彈出的側前踢，上身往反方向倒
  atk1({ t, base, P }) {
    const W = P({ hipsY: -0.06, hipsRY: 0.4, torsoX: 0.02, torsoY: 0.2, torsoZ: -0.08, headY: -0.5,
      thLX: -0.95, thLZ: 0.25, knL: 1.9, thRX: 0.15, knR: 0.32 });
    // 髖只轉一點：外展的左腿剛好指向目標
    const S = P({ hipsY: 0.0, hipsRY: -0.1, hipsZ: 0.1, torsoX: -0.32, torsoY: 0.3, torsoZ: -0.25, headX: -0.05, headY: -0.4,
      thLX: -1.5, thLZ: 0.25, knL: 0.04, thRX: 0.22, thRZ: 0.12, knR: 0.12, anL: 0.3, ...BACK_L });
    return strike(t, IMPACT.atk1, base, W, S, 0.34);
  },

  // 普攻二：後腳（右）迴旋踢：右腳先收在右後方，踢的那側髖往前送（hipsRY 正＝往左轉），腿從右側水平掃過正前方、
  // 往他的左邊送出去；上身反向扭、往外倒，頭回轉盯著目標。從上往下看 0.11～0.13 秒腳在正前方
  atk2({ t, base, P }) {
    const W = P({ hipsY: -0.08, hipsRY: -0.25, torsoX: 0.06, torsoY: 0.35, torsoZ: 0.05, headY: -0.2,
      thLX: -0.35, knL: 0.45, thRX: 0.5, thRZ: 0.35, knR: 1.55 });
    const S = P({ hipsY: 0.0, hipsRY: 1.0, hipsZ: 0.12, hipsRZ: -0.1, torsoX: -0.2, torsoY: -0.6, torsoZ: 0.45, headY: -0.25, headZ: -0.2,
      thLX: 0.05, thLZ: 0.08, knL: 0.18, thRX: -1.05, thRZ: 1.15, knR: 0.06, anR: 0.3, ...BACK_R });
    return strike(t, 0.1, base, W, S, 0.38); // 實際命中約 0.12 秒，提早到位抵掉平滑延遲
  },

  // 普攻三：蹲低轉身背對蓄勢 → 小跳，整個骨盆往支撐腳那側倒，左腿伸到最遠橫掃，腿和上身連成一條斜躺的長棒
  atk3({ t, base, P }) {
    const W = P({ hipsY: -0.2, hipsRY: 1.2, torsoX: 0.25, torsoY: 0.45, torsoZ: -0.1, headY: -0.6,
      thLX: -0.45, thLZ: 0.2, knL: 1.3, thRX: 0.2, knR: 1.3 });
    // 髖轉到 −1.15：外展又往側邊倒的左腿和面向對齊，橫掃正前方
    const S = P({ hipsY: 0.14, hipsRY: -1.25, hipsZ: 0.18, hipsRZ: 0.9, torsoX: -0.2, torsoY: -0.35, torsoZ: 0.2, headY: 0.2, headZ: -0.5,
      thLX: -0.6, thLZ: 0.75, knL: 0.04, thRX: 0.12, thRZ: 0.85, knR: 0.35, anL: 0.35, ...BACK_L });
    return strike(t, 0.135, base, W, S, 0.44); // 實際命中約 0.17 秒（攻速 0.68），提早到位抵掉平滑延遲
  },

  // Q 首肉射擊（Collier Shoot）：大步踏進、後腳由下往上踢向脖子，骨盆往後倒、上身後仰到最開；0.12 秒命中
  // 0.035 秒踏進蓄勢、停一下，0.075 秒踢到最高（早一點到位，平滑後剛好在 0.12 秒的命中格）
  // 腿的世界角度 ≈ hipsRX＋thRX（約 135 度，踢到脖子高）、上身後仰 ≈ hipsRX＋torsoX（約 37 度），不會整個人倒成一條線
  atk3_Q({ t, base, P }) {
    const W = P({ hipsY: -0.2, hipsRY: 0.6, hipsZ: -0.08, torsoX: 0.35, torsoY: -0.35, headX: -0.25, headY: -0.3,
      thLX: -0.75, thLZ: 0.25, knL: 1.15, thRX: 0.55, thRZ: 0.15, knR: 1.4 });
    const S = P({ hipsY: 0.1, hipsRX: -0.15, hipsRY: -0.35, hipsZ: 0.12, torsoX: -0.5, torsoY: 0.55, torsoZ: 0.35, headX: 0.3, headY: -0.6,
      thLX: 0.15, thLZ: 0.1, knL: 0.08, thRX: -2.25, thRZ: 0.35, knR: 0.02, anR: 0.4, anL: 0.25, ...BACK_R, ...BACK_L, shRX: 0.95, shLX: 0.95 });
    // （骨盆被髖部輔助往後倒得比上身多，褲袋跟著往後跑：兩手都再往後收，拳頭才不會露在胯前）
    return kick(t, 0.035, 0.045, 0.075, base, W, S, 0.38);
  },

  // W 羊肉射擊：手抽出口袋撐地倒立，雙腿劈成一字像螺旋槳一樣轉，三次命中時腿剛好掃過正前方、一次比一次劈得開；
  // 最後腿收攏往下壓（手還撐著）→ 蹲著落地 → 站起
  vanish_W({ t, d, base, P }) {
    const handH = d.torso + d.upper + d.lower + d.fist - d.L; // 倒立時手掌剛好撐在地上的骨盆高度
    const arms = (x, z, el, wr) => ({ shLX: x, shLZ: z, elL: el, shRX: x, shRZ: z, elR: el, hoL: 1, hoR: 1, hsL: 0.8, hsR: 0.8, wrL: wr, wrR: wr });
    const crouch = P({ hipsY: -0.22, hipsRY: 0, hipsRZ: 0, torsoX: 0.9, torsoY: 0, torsoZ: 0, headX: -0.5, headY: 0, ...arms(-1.3, 0.2, -0.2, 0),
      thLX: -0.9, thLZ: 0.25, knL: 1.5, thRX: -0.9, thRZ: 0.25, knR: 1.5 });
    // 翻上去的途中腿已經劈開：側翻進場就是第一腳
    const flip = P({ hipsY: handH + 0.12, hipsRX: 1.9, hipsRY: 0, hipsRZ: 0, torsoX: 0.3, torsoY: 0, torsoZ: 0, headX: -0.6, headY: 0, ...arms(-2.6, 0.18, -0.15, -0.9),
      thLX: -0.1, thLZ: 1.0, knL: 0.1, thRX: -0.1, thRZ: 1.0, knR: 0.1 });
    const hand = P({ hipsY: handH, hipsRX: Math.PI, hipsRY: 0, hipsRZ: 0, torsoX: 0, torsoY: 0, torsoZ: 0, headX: -0.7, headY: 0, ...arms(-3.0, 0.12, -0.05, -1.2),
      thLX: 0, thLZ: 1.3, knL: 0.02, thRX: 0, thRZ: 1.3, knR: 0.02 });
    // 收腿下壓：倒立往回倒、雙腿併攏往肚子那側折，手仍撐地
    const pike = P({ hipsY: handH + 0.05, hipsRX: 2.4, hipsRY: 0, hipsRZ: 0, torsoX: 0.1, torsoY: 0, torsoZ: 0, headX: -0.5, headY: 0, ...arms(-2.7, 0.12, -0.1, -1.0),
      thLX: -1.3, thLZ: 0.12, knL: 0.3, thRX: -1.3, thRZ: 0.12, knR: 0.3 });
    const land = P({ hipsY: -0.22, hipsRX: 0.15, hipsRY: 0, hipsRZ: 0, torsoX: 0.6, torsoY: 0, torsoZ: 0, headX: -0.4, headY: 0, ...arms(-0.9, 0.3, -0.3, 0.2),
      thLX: -1.0, thLZ: 0.3, knL: 1.5, thRX: -1.0, thRZ: 0.3, knR: 1.5 });
    let p = track(t, [[0, base], [0.03, crouch], [0.06, flip], [0.09, hand], [0.5, hand], [0.56, pike], [0.62, land], [0.68, base]]);
    p = { ...p };
    // 腿掃過正前方的那一下（命中 0.10／0.26／0.42）腿劈得更開，一下比一下開
    if (t > 0.06 && t < 0.5) {
      const i = clamp(Math.floor((t - 0.02) / 0.16), 0, 2), kk = Math.max(0, Math.cos((t - 0.1) * TAU / 0.16));
      p.thLZ += (0.08 + 0.08 * i) * kk; p.thRZ += (0.08 + 0.08 * i) * kk;
    }
    // 自轉：每 0.16 秒轉 3π/2（約每秒 4.7 圈），第一、三下命中時腿掃過正前方（spin ≡ π/2）、第二下掃過兩側；
    // 最後一下之後等減速補半圈，0.53 秒剛好停在整兩圈（4π），收腿落地時已經不轉、正面朝前
    const w = 1.5 * Math.PI / 0.16, stop = Math.PI / w; // 從 3.5π 以等減速補半圈到 4π 的時間
    p.spin = t < 0.03 ? 0 : t < 0.1 ? 0.5 * Math.PI * Math.pow((t - 0.03) / 0.07, 1.31)
      : t < 0.42 ? 0.5 * Math.PI + (t - 0.1) * w
        : t < 0.42 + stop ? 3.5 * Math.PI + w * (t - 0.42) - w * (t - 0.42) ** 2 / (2 * stop) : 4 * Math.PI;
    if (t >= 0.66) p.spin = 0; // 收招最後一格回到 0（4π 和 0 是同一個方向，不會看到轉回去）
    p.ownHands = true;
    return p;
  },

  // E 空中步行（Sky Walk）：手插口袋，兩腳輪流在空氣上蹬：一膝抬到胸口、另一腳往後下方踩直、腳尖繃直，
  // 換腳三次（對上三團踏空的氣），落地前收成屈膝蹲姿
  air_E({ t, P }) {
    const step = (s) => { // s = 1 左膝在上，-1 右膝在上
      const up = s > 0 ? 'L' : 'R', dn = s > 0 ? 'R' : 'L';
      // 兩腿前後分開（膝蓋往正前方抬、蹬地的腳往正後方伸），髖只扭一點，從上面看不會變成左右張開的蹲馬步
      return P({ hipsY: 0.06, hipsRY: 0.1 + 0.12 * s, hipsRX: 0.1, torsoX: 0.35, torsoY: -0.12 * s, torsoZ: 0.04 * s, headX: -0.35, headY: -0.1 + 0.1 * s,
        ['th' + up + 'X']: -2.55, ['th' + up + 'Z']: 0.04, ['kn' + up]: 2.5, ['an' + up]: -0.25,
        ['th' + dn + 'X']: 0.6, ['th' + dn + 'Z']: 0.06, ['kn' + dn]: 0.02, ['an' + dn]: 0.9, ['to' + dn]: 0.5 });
    };
    const A = step(1), B = step(-1);
    const go = P({ hipsY: -0.14, torsoX: 0.25, thLX: -0.5, knL: 1.0, thRX: 0.25, knR: 0.9 });
    const land = P({ hipsY: -0.22, torsoX: 0.35, headX: -0.2, thLX: -0.75, thLZ: 0.2, knL: 1.2, thRX: -0.1, thRZ: 0.15, knR: 1.2 });
    return track(t, [[0, go], [0.03, A], [0.09, A], [0.13, B], [0.18, B], [0.21, A], [0.27, A], [0.32, land]]);
  },

  // R 惡魔風腳：先踮著左腳原地轉一整圈、右腳整條甩在外面（惡魔風腳靠旋轉摩擦生熱點火，從上面看是一圈火輪），
  // 再整個人往後仰飛出去：身體和燃燒的右腳連成一支往前刺的長槍，左腳收在下面
  // 衝刺最長 0.33 秒（射程 9 ÷ 速度 32 ＋ 0.05），撞到敵人就換成連踢，所以點火要在 0.13 秒內轉完
  dash_R({ t, P }) {
    const fl = Math.sin(t * 40) * 0.05;
    const coil = P({ hipsY: -0.14, hipsRY: 0.2, hipsRZ: -0.12, torsoX: 0.3, torsoY: 0.2, torsoZ: 0.2, headX: -0.15, headY: -0.3,
      thLX: -0.35, thLZ: 0.05, knL: 0.75, thRX: 0.35, thRZ: 1.05, knR: 0.12, anR: 0.4, ...BACK_R });
    const fly = P({ hipsY: 0.3, hipsRX: -1.05, hipsRY: -0.2, torsoX: 0.2, torsoY: 0.3, torsoZ: 0.08, headX: 0.8, headY: -0.3,
      thRX: -0.55 + fl, thRZ: 0.08, knR: 0.03, anR: 0.45, thLX: 0.95 - fl, thLZ: 0.15, knL: 1.15, anL: 0.3, ...BACK_R });
    const p = { ...track(t, [[0, P({})], [0.025, coil], [0.085, coil], [0.125, fly]]) };
    // 自轉一整圈（不放進 track，免得轉回去）：慢起、轉最快、慢停在 −2π，下一格直接歸零（同一個方向，看不出來）；
    // 0.08 秒前轉完，近距離撞上敵人換成連踢時已經轉正，不會半圈倒轉回去
    p.spin = t > 0.015 && t < 0.08 ? -TAU * ease((t - 0.015) / 0.065) : 0;
    return p;
  },

  // 惡魔風腳連踢：每 0.09 秒一腳、兩下換一次腳，高掃與側踢交錯；
  // 收尾踢從第 4 腳收腿的途中接上（0.325 秒起）：0.36 秒轉成迴旋後踢、0.38 秒第 5 下命中，0.435 秒側踢甩到最直、0.47 秒第 6 下命中
  rush_R({ t, base, P }) {
    const t0 = LAST_HIT - LEAD - FIN;
    if (t >= t0) return finale(t - t0, base, P, rushKick(t0, P));
    return rushKick(t, P);
  },

  // 第 6 下命中那一格 rushAction 把動畫換成 atk3（t 從 0 開始，一直播到 R 動作結束），接著 rush_R 的收尾踢往下播
  atk3_R({ t, base, P }) { return finale(t + FIN + LEAD, base, P); },

  // 勝利：一手插口袋，另一手掌心凹起來從側面護住嘴邊的打火機火苗，頭低下去湊近手、肩膀微聳
  win({ t, P }) {
    const b = Math.sin(t * 2);
    const p = P({ hipsY: -0.02, hipsRY: 0.3, hipsRZ: 0.08, torsoX: 0.05, torsoY: 0.2, headX: 0.35 + 0.03 * b, headY: -0.15, headZ: 0.1,
      shRX: -0.75, shRZ: 0.02, shRY: 0.65, elR: -2.38, hoR: 0.85, hsR: 0.7, wrR: -0.4,
      thLX: -0.12, thLZ: 0.06, knL: 0.08, thRX: 0.1, thRZ: 0.12, knR: 0.25 });
    p.ownHands = true;
    return p;
  },
};
// 羊肉射擊的動作名：combat.js 的 KITS.sanji.W 目前用 act(name: 'vanish')，而 main.js 在 vanish 動作時把整個模型藏起來，
// 所以倒立旋轉在遊戲裡看不到；等 W 改用 name: 'cast' 後會直接套到同一段動作（cast_W）
poses.cast_W = poses.vanish_W;
export default poses;
