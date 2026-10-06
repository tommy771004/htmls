// goku 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（strike、lerpPose、ease、clamp、IMPACT…）。
//
// 悟空：龜仙流的低馬步（左半身在前、左掌前伸、右拳護胸），普攻是刺拳 → 直拳 → 側踢；
// Q 小龜派氣功（右腰合掌 → 雙掌推出）、W 龍閃拳（拳頭蓄在腰側衝刺 → 左右連打 → 龍拳收尾）、
// E 瞬間移動（兩指貼額頭）、R 超級龜派氣功（深蹲蓄氣 → 推掌、身體被反衝力往後頂）。
// 角度慣例：角色面向 +z；偏航（yaw）正值朝角色左手邊。胸口的世界偏航 = hipsRY + torsoY。
import { blank, strike, lerpPose, ease, clamp, IMPACT } from '../pose-kit.js';

const HALF_PI = Math.PI / 2;

// 頭轉回正前方（看著目標），extra 是額外偏轉
function lookFwd(p, extra = 0) { p.headY = -(p.hipsRY + 0.5 * p.torsoY) + extra; return p; }
// 讓手臂指向世界方向：yaw 0 = 正前方、正值偏左；pitch 0 = 水平、正值往上（抵銷胸口的扭轉與前傾）
function aim(p, s, yaw, pitch = 0) {
  const yc = p.hipsRY + p.torsoY, pc = p.hipsRX + p.torsoX;
  p['sh' + s + 'X'] = -HALF_PI - pitch - pc;
  p['sh' + s + 'Z'] = s === 'L' ? yaw - yc : yc - yaw;
  return p;
}
// 腳踩地：依大腿角度、骨盆高度與側傾算出膝蓋彎曲，讓腳底剛好落在地面（hint 選前彎或後彎的解）
function plant(p, d, legs = 'LR') {
  const T = d.thighLen, S = d.shinLen, ankle = d.L - T - S;
  for (const s of legs) {
    const a = p.hipsRX + p['th' + s + 'X'];
    const z = p['th' + s + 'Z'] + (s === 'L' ? p.hipsRZ : -p.hipsRZ);
    const hipH = d.L + p.hipsY + (s === 'L' ? 1 : -1) * 0.09 * Math.sin(p.hipsRZ) - ankle;
    const v = clamp((hipH / Math.max(0.3, Math.cos(z)) - T * Math.cos(a)) / S, -1, 1);
    const sh = Math.acos(v), hint = p['kn' + s];
    const k1 = sh - a, k2 = -sh - a;
    const ok1 = k1 >= 0 && k1 < 2.4, ok2 = k2 >= 0 && k2 < 2.4;
    p['kn' + s] = ok1 && ok2 ? (Math.abs(k1 - hint) < Math.abs(k2 - hint) ? k1 : k2) : ok1 ? k1 : ok2 ? k2 : Math.max(0, -a);
  }
  return p;
}
const own = (p) => { p.ownHands = true; return p; }; // 手形自己決定，不套共用的張手

/* ---------------- 架式 ---------------- */
// 龜仙流架式：左半身朝敵、左掌張開前伸，右拳收在胸前；FighterZ 式的小幅彈跳＋呼吸
function stance({ t, d }) {
  const br = Math.sin(t * 2.6), bob = Math.sin(t * 5.2);
  const p = blank();
  Object.assign(p, {
    hipsY: -0.18 + 0.014 * bob, hipsRY: -0.45, hipsRZ: 0.03, torsoX: 0.2 + 0.02 * br, torsoY: -0.3, torsoZ: 0.04, headX: -0.14,
    elL: -0.6, hoL: 0.75, hsL: 0.55, wrL: -0.15,
    shRX: -0.65, shRZ: 0.25, elR: -2.2, hoR: 0, hsR: 0,
    thLX: -0.5, thLZ: 0.3, knL: 0.5, thRX: 0.45, thRZ: 0.22, knR: 0.6, anL: 0, anR: 0,
  });
  aim(p, 'L', 0.05, -0.15 + 0.03 * br);
  lookFwd(p);
  return plant(p, d);
}

/* ---------------- 普攻三連 ---------------- */
// 一：左刺拳。前腳滑步、左肩送出，右拳不離下巴
function atk1(ctx) {
  const { t, d, P } = ctx;
  const W = P({ hipsY: -0.2, hipsZ: -0.04, torsoY: -0.05, torsoX: 0.14, shLX: -1.0, shLZ: 0.5, elL: -2.25, hoL: 0, hsL: 0, wrL: 0 });
  const S = P({ hipsY: -0.22, hipsZ: 0.3, hipsRY: -0.65, torsoY: -0.55, torsoX: 0.32, elL: -0.03, clL: 0.3, hoL: 0, hsL: 0, wrL: 0,
    shRX: -0.95, shRZ: 0.15, elR: -2.35, thLX: -0.85, thRX: 0.72, headX: -0.2 });
  aim(S, 'L', 0, 0.12);
  lookFwd(W); lookFwd(S);
  return own(plant(strike(t, IMPACT.atk1, ctx.base, W, S, 0.3), d));
}
// 二：右直拳。左肩拉回、右髖帶動整個身體轉正，後腳蹬直
function atk2(ctx) {
  const { t, d, P } = ctx;
  const W = P({ hipsY: -0.2, hipsRY: -0.6, torsoY: -0.55, torsoX: 0.22, shRX: -0.2, shRZ: 0.35, elR: -2.3, shLX: -1.3, shLZ: 0.5, elL: -1.2,
    knL: 0.7, knR: 0.75, hoL: 0.3 });
  const S = P({ hipsY: -0.23, hipsZ: 0.34, hipsRY: 0.15, torsoY: 0.45, torsoX: 0.34, elR: -0.03, clR: 0.3,
    shLX: -0.7, shLZ: 0.05, elL: -2.4, hoL: 0, hsL: 0,
    thLX: -0.8, thLZ: 0.22, knL: 0.9, thRX: 0.7, thRZ: 0.18, knR: 0.1, headX: -0.2 });
  aim(S, 'R', 0, 0.1);
  lookFwd(W); lookFwd(S);
  return own(plant(strike(t, IMPACT.atk2, ctx.base, W, S, 0.34), d));
}
// 三：右側踢。先轉髖、提膝收腿，再把整條腿往目標蹬直，上身往反方向倒、雙臂張開平衡
function atk3(ctx) {
  const { t, d, P } = ctx;
  const W = P({ hipsY: -0.12, hipsRY: 0.9, hipsRZ: -0.15, torsoY: -0.5, torsoX: 0.1, torsoZ: -0.1,
    thRX: -1.1, thRZ: 0.35, knR: 2.1, thLX: 0.05, thLZ: 0.2, knL: 0.4,
    shLX: -1.2, shLZ: 0.2, elL: -2.0, shRX: -0.5, shRZ: 0.3, elR: -1.9, headX: -0.1 });
  const S = P({ hipsY: -0.05, hipsZ: 0.12, hipsRY: 1.35, hipsRZ: -0.5, torsoY: -0.45, torsoX: -0.05, torsoZ: -0.25,
    thRX: -0.35, thRZ: 1.0, knR: 0.04, anR: 0.5, toR: -0.3, thLX: 0.05, thLZ: 0.52, knL: 0.3,
    shLX: -1.0, shLZ: 0.6, elL: -1.7, shRX: 0.15, shRZ: 0.75, elR: -0.3, hoR: 0, headX: -0.15 });
  // 收腿：踢完先把膝蓋收回胸前（不是直腿掃回來），再落地回架式
  const R = P({ hipsY: -0.1, hipsZ: 0.08, hipsRY: 0.95, hipsRZ: -0.2, torsoY: -0.45, torsoX: 0.08, torsoZ: -0.1,
    thRX: -1.0, thRZ: 0.45, knR: 2.0, thLX: 0.05, thLZ: 0.25, knL: 0.4,
    shLX: -1.1, shLZ: 0.3, elL: -2.0, shRX: -0.4, shRZ: 0.35, elR: -1.9, headX: -0.1 });
  lookFwd(W); lookFwd(S); lookFwd(R);
  const ti = IMPACT.atk3;
  if (t < ti + 0.08) return own(plant(strike(t, ti, ctx.base, W, S, 0.42), d, 'L'));
  const O = { ...strike(ti + 0.08, ti, ctx.base, W, S, 0.42) };
  const p = t < ti + 0.16 ? lerpPose(O, R, ease((t - ti - 0.08) / 0.08)) : lerpPose(R, ctx.base, ease(clamp((t - ti - 0.16) / 0.14, 0, 1)));
  return own(plant(p, d, t < ti + 0.22 ? 'L' : 'LR'));
}

/* ---------------- Q 龜派氣功（小） ---------------- */
// 龜派氣功共用：big 0 = Q 的小發、1 = R 的超級版（馬步更寬更低、上身壓得更前）
// 右腰合掌：胸口轉向右後方，雙手在右髖後方上下相疊、掌心相對，像捧著一顆氣球
function kameCup(P, big = 0) {
  return P({ hipsY: -0.22 - 0.1 * big, hipsZ: -0.03, hipsRY: -0.6, torsoY: -0.85, torsoX: 0.3 + 0.08 * big, torsoZ: 0.1, headX: -0.25,
    shRX: 0.3, shRZ: 0.22, elR: -1.25, shLX: -0.05, shLZ: -0.75, elL: -1.35,
    hoL: 0.8, hoR: 0.8, hsL: 0.7, hsR: 0.7, wrL: -0.5, wrR: -0.5,
    thLX: -0.65 - 0.2 * big, thLZ: 0.32 + 0.08 * big, knL: 0.8, thRX: 0.5 + 0.15 * big, thRZ: 0.3 + 0.08 * big, knR: 0.8 });
}
// 雙掌推出：胸口轉正，兩腕相貼往前頂，掌根朝前；前腳弓、後腳蹬直
function kamePush(P, big = 0) {
  const S = P({ hipsY: -0.21 - 0.1 * big, hipsZ: 0.14 + 0.06 * big, hipsRY: -0.1, torsoY: 0.05, torsoX: 0.18 + 0.1 * big, torsoZ: 0, headX: -0.08,
    elL: -0.06, elR: -0.06, clL: 0.25, clR: 0.25, hoL: 1, hoR: 1, hsL: 0.9, hsR: 0.9, wrL: 1.1, wrR: -1.1,
    thLX: -0.8 - 0.15 * big, thLZ: 0.3 + 0.08 * big, knL: 0.9, thRX: 0.7 + 0.15 * big, thRZ: 0.26 + 0.08 * big, knR: 0.15 });
  aim(S, 'L', -0.1, 0.05); aim(S, 'R', 0.1, 0.05);
  return S;
}
function cast_Q(ctx) {
  const { t, d, P } = ctx;
  const W = lookFwd(kameCup(P)), S = lookFwd(kamePush(P));
  // 0～0.08 收到右腰、0.08～0.14 推出（0.14 發射）、撐到 0.24 再收回架式（不用 strike 的過衝，免得雙掌往上飄）
  let p;
  if (t < 0.08) p = lerpPose(ctx.base, W, ease(t / 0.08));
  else if (t < 0.14) { const u = (t - 0.08) / 0.06; p = lerpPose(W, S, u * u * (2 - u)); }
  else if (t < 0.24) p = S;
  else p = lerpPose(S, ctx.base, ease(clamp((t - 0.24) / 0.08, 0, 1)));
  return own(plant(p, d));
}

/* ---------------- W 龍閃拳 ---------------- */
// 衝刺：身體前傾貼地飛，右拳蓄在腰側，左掌在前瞄準
function dash_W(ctx) {
  const { t, P } = ctx;
  const fl = Math.sin(t * 34) * 0.05;
  const p = P({ hipsRX: 0.75, hipsY: 0.12, hipsRY: -0.35, hipsRZ: 0, torsoX: 0.25, torsoY: -0.3, torsoZ: fl * 0.4, headX: -0.85,
    shRX: 0.55, shRZ: 0.35, elR: -1.85, hoR: 0, hsR: 0, elL: -0.35, hoL: 0.7, hsL: 0.5,
    thLX: 0.1 + fl, thLZ: 0.15, knL: 0.55, thRX: 0.4 - fl, thRZ: 0.1, knR: 0.95 });
  aim(p, 'L', 0, 0.1);
  return own(lookFwd(p));
}
// 連打：左右直拳交替，命中時刻對齊 combat.js 的 0.02 + 0.1·i
function rush_W(ctx) {
  const { t, d, P } = ctx;
  const gap = 0.1, x = (t - 0.02) / gap + 1, i = Math.floor(x), f = x - i; // f = 0 正是命中
  // 命中後 0～0.35 收拳，0.35～0.7 蓄力，0.7～1 出拳
  const ext = f < 0.35 ? 1 - ease(f / 0.35) : f < 0.7 ? 0 : ease((f - 0.7) / 0.3);
  const hitL = (i % 2) === 0; // 即將打出（或剛打出）的那隻手
  const cur = f < 0.35 ? !hitL : hitL; // 收拳中的是剛打完的手
  const tw = (cur ? -0.55 : 0.55) * (0.4 + 0.6 * ext); // 左拳時胸口右轉、右拳時左轉
  const p = P({ hipsY: -0.2, hipsZ: 0.05 + 0.03 * ext, hipsRY: tw * 0.4, torsoY: tw, torsoX: 0.32, torsoZ: 0, headX: -0.15,
    hoL: 0, hoR: 0, hsL: 0, hsR: 0,
    thLX: -0.7, thLZ: 0.28, knL: 0.8, thRX: 0.55, thRZ: 0.25, knR: 0.5 });
  const pun = cur ? 'L' : 'R', back = cur ? 'R' : 'L';
  aim(p, pun, cur ? -0.05 : 0.05, 0.12);
  p['sh' + pun + 'X'] = -0.9 + (p['sh' + pun + 'X'] + 0.9) * ext;
  p['sh' + pun + 'Z'] = 0.2 + (p['sh' + pun + 'Z'] - 0.2) * ext;
  p['el' + pun] = -2.3 + 2.27 * ext;
  p['sh' + back + 'X'] = -0.85; p['sh' + back + 'Z'] = 0.15; p['el' + back] = -2.35;
  return own(plant(lookFwd(p), d));
}
// 收尾的龍拳：最後一擊時 combat.js 把動作換成 atk3。整個人飛撲出去，右拳打穿、左臂往後甩
function atk3_W(ctx) {
  const { t, P } = ctx;
  const W = P({ hipsY: -0.18, hipsRY: -0.5, torsoY: -0.6, torsoX: 0.25, shRX: 0.5, shRZ: 0.3, elR: -2.1, shLX: -1.3, shLZ: 0.4, elL: -0.6,
    hoL: 0.6, hoR: 0, hsR: 0, thLX: -0.7, knL: 0.9, thRX: 0.5, knR: 0.8 });
  const S = P({ hipsY: 0.12, hipsZ: 0.35, hipsRX: 0.3, hipsRY: 0.35, torsoY: 0.6, torsoX: 0.2, torsoZ: -0.1, headX: -0.35,
    elR: 0, hoR: 0, hsR: 0, shLX: 0.75, shLZ: 0.45, elL: -0.45, hoL: 0.7, hsL: 0.6,
    thLX: 0.55, thLZ: 0.15, knL: 0.9, thRX: -0.75, thRZ: 0.1, knR: 1.5 });
  aim(S, 'R', 0, 0.3);
  lookFwd(W); lookFwd(S);
  // 命中已在 t=0 結算：極短的蓄力後衝出、停在空中，再落回架式
  let p;
  if (t < 0.05) p = lerpPose(W, S, ease(t / 0.05));
  else if (t < 0.22) p = S;
  else p = lerpPose(S, ctx.base, ease(clamp((t - 0.22) / 0.12, 0, 1)));
  return own(p);
}

/* ---------------- E 瞬間移動 ---------------- */
// 站直、低頭專注：右手立掌在臉前，手腕往內扣讓指尖貼上額頭（手肘朝前下），左手自然垂下
function vanish_E(ctx) {
  const { d, P } = ctx;
  const p = P({ hipsY: -0.03, hipsRY: -0.15, hipsRZ: 0, torsoX: 0.02, torsoY: -0.1, torsoZ: 0, headX: 0.15, spin: 0,
    shRX: -1.3, shRY: 0, shRZ: -0.12, elR: -2.2, wrR: -0.4, hoR: 0.85, hsR: 0,
    shLX: 0.05, shLZ: 0.15, elL: -0.35, hoL: 0.4, hsL: 0.3,
    thLX: -0.15, thLZ: 0.12, knL: 0.12, thRX: 0.12, thRZ: 0.1, knR: 0.15 });
  return own(plant(lookFwd(p), d));
}

/* ---------------- R 超級龜派氣功 ---------------- */
// 0～0.32 秒深蹲在右腰集氣（越蹲越低、雙手微顫），0.32～0.4 秒雙掌推出，之後頂著反衝力撐住
function beam_R(ctx) {
  const { t, d, P } = ctx;
  const wind = 0.32;
  if (t < wind) {
    const k = ease(clamp(t / 0.22, 0, 1)), sh = Math.sin(t * 70) * 0.02 * k;
    const C = lookFwd(kameCup(P, k));
    C.elL += sh; C.elR -= sh; C.torsoY -= 0.12 * k; // 越拉越後
    return own(plant(lerpPose(ctx.base, C, k), d));
  }
  // 推出後頂住光束的反衝力：身體壓前、後腳慢慢被推得滑後一點
  const tr = Math.sin(t * 60) * 0.025, push = clamp((t - 0.6) / 0.6, 0, 1);
  const S = lookFwd(kamePush(P, 1));
  S.torsoX += tr + 0.06 * push; S.hipsZ -= 0.06 * push; S.hipsY -= 0.03 * push; S.headX -= 0.08;
  S.elL += tr; S.elR += tr;
  const W = lookFwd(kameCup(P, 1)); W.torsoY -= 0.12;
  const p = t < IMPACT.beam ? lerpPose(W, S, ease((t - wind) / (IMPACT.beam - wind))) : S;
  return own(plant(p, d));
}

/* ---------------- 集氣 ---------------- */
// 變身式的集氣：馬步大開、雙拳握緊壓在腰側、手肘往後撐，上身後仰仰頭吶喊，全身發抖
function charge({ t, d, P }) {
  const tr = Math.sin(t * 70) * 0.02, sw = Math.sin(t * 9) * 0.03;
  const p = P({ hipsY: -0.3, hipsZ: 0, hipsRX: 0, hipsRY: 0, hipsRZ: 0, torsoX: -0.22 + tr, torsoY: sw, torsoZ: 0, headX: -0.45, headZ: 0,
    shLX: 0.45, shLY: 0, shLZ: 0.75, elL: -1.6 + tr, shRX: 0.45, shRY: 0, shRZ: 0.75, elR: -1.6 - tr,
    clL: -0.15, clR: -0.15, hoL: 0, hoR: 0, hsL: 0, hsR: 0, wrL: 0.25, wrR: 0.25,
    thLX: -0.12, thLZ: 0.58, knL: 0.7, thRX: -0.12, thRZ: 0.58, knR: 0.7 });
  return own(plant(lookFwd(p), d));
}

/* ---------------- 勝利 ---------------- */
// 嘿嘿：右手抓後腦勺，左手叉腰，輕輕晃身體
function win({ t, d, P }) {
  const b = Math.sin(t * 3);
  const p = P({ hipsY: -0.03 + 0.01 * b, hipsRY: -0.1, hipsRZ: 0.04 * b, torsoX: -0.06, torsoY: 0.1, torsoZ: -0.05 * b, headX: -0.15, headZ: 0.12,
    shRX: -2.5, shRZ: 0.95, elR: -2.3 - 0.1 * b, hoR: 0.7, hsR: 0.4,
    shLX: 0.15, shLZ: 0.55, elL: -1.6, hoL: 0, hsL: 0,
    thLX: -0.12, thLZ: 0.16, knL: 0.1, thRX: 0.1, thRZ: 0.16, knR: 0.1 });
  return own(plant(lookFwd(p, 0.1), d));
}

export default { stance, atk1, atk2, atk3, cast_Q, dash_W, rush_W, atk3_W, vanish_E, beam_R, charge, win };
