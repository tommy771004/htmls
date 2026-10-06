// goku 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（strike、lerpPose、ease、clamp、IMPACT…）。
//
// 悟空：龜仙流的低馬步（左半身在前、左掌前伸、右拳護胸），普攻是刺拳 → 直拳 → 側踢；
// Q 小龜派氣功（右腰合掌 → 雙掌推出）、W 龍閃拳（拳頭蓄在腰側衝刺 → 左右連打 → 龍拳收尾）、
// E 瞬間移動（手刀貼額頭）、R 超級龜派氣功（深蹲蓄氣 → 推掌、身體被反衝力往後頂）。
// 角度慣例：角色面向 +z；偏航（yaw）正值朝角色左手邊。胸口的世界偏航 = hipsRY + torsoY。
// 平滑：自己的動作以 rate 32（τ≈31 ms）跟隨，所以關鍵姿勢都在命中前約 30 ms 先到位、並撐住 50 ms 以上。
import { blank, strike, lerpPose, ease, clamp, smooth01, IMPACT } from '../pose-kit.js';

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
// 腳慢慢落地：w 0 = 照姿勢給的膝蓋（腳在空中）、1 = 踩地（避免某一格突然換成踩地解，腳一下子彈到地上）
function landing(p, d, legs, w) {
  if (w <= 0) return p;
  const g = plant({ ...p }, d, legs);
  for (const s of legs) p['kn' + s] += (g['kn' + s] - p['kn' + s]) * Math.min(1, w);
  return p;
}
// 手形自己決定，不套共用的張手；手肘不反折（strike 的順勢過衝會把伸直的手臂外插成負彎曲）
const own = (p) => { p.ownHands = true; p.elL = Math.min(p.elL, -0.02); p.elR = Math.min(p.elR, -0.02); return p; };

/* ---------------- 架式 ---------------- */
// 龜仙流架式：左半身朝敵、左掌攤平立在胸前（拇指收起，從正面和上方都看得出是掌），右拳收在胸前；FighterZ 式的小幅彈跳＋呼吸
function stance({ t, d }) {
  const br = Math.sin(t * 2.6), bob = Math.sin(t * 5.2);
  const p = blank();
  Object.assign(p, {
    hipsY: -0.18 + 0.014 * bob, hipsRY: -0.45, hipsRZ: 0.03, torsoX: 0.2 + 0.02 * br, torsoY: -0.3, torsoZ: 0.04, headX: -0.14,
    elL: -0.4, hoL: 0.95, hsL: 0.25, wrL: -0.25,
    shRX: -0.65, shRZ: 0.25, elR: -2.2, hoR: 0, hsR: 0,
    thLX: -0.5, thLZ: 0.3, knL: 0.5, thRX: 0.45, thRZ: 0.22, knR: 0.6, anL: 0, anR: 0,
  });
  aim(p, 'L', 0.05, 0.08 + 0.03 * br);
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
// 三：右側踢。先轉髖、把膝蓋高高提到胸前，再把整條腿往目標蹬直到腰高，上身往反方向倒，右臂順著踢腿方向伸出。
// 踢完先把膝蓋收回胸前（不是直腿掃回來），再慢慢落地回架式（右腳的踩地解用 landing 漸進套用，不會一格彈到地上）
function atk3(ctx) {
  const { t, d, P } = ctx;
  const W = P({ hipsY: -0.1, hipsRY: 0.9, hipsRZ: -0.15, torsoY: -0.5, torsoX: 0.1, torsoZ: -0.1,
    thRX: -1.5, thRZ: 0.35, knR: 2.2, thLX: 0.05, thLZ: 0.2, knL: 0.4,
    shLX: -1.2, shLZ: 0.2, elL: -2.0, shRX: -0.5, shRZ: 0.3, elR: -1.9, hoR: 0, hsR: 0, headX: -0.1 });
  const S = P({ hipsY: -0.04, hipsZ: 0.12, hipsRY: 1.35, hipsRZ: -0.65, torsoY: -0.45, torsoX: -0.05, torsoZ: -0.35,
    thRX: -0.35, thRZ: 1.25, knR: 0.04, anR: 0.5, toR: -0.3, thLX: 0.05, thLZ: 0.52, knL: 0.3,
    shLX: -1.0, shLZ: 0.6, elL: -1.7, shRX: -0.22, shRY: -0.1, shRZ: 0.16, elR: -0.04, hoR: 0, hsR: 0, headX: -0.15 });
  // S 的右臂伸直、順著踢腿指向目標略朝下（上身往後倒，aim 不處理側傾，角度是在檢視器裡對手的世界方向反解的）；R 是踢完收膝的姿勢
  const R = P({ hipsY: -0.1, hipsZ: 0.08, hipsRY: 0.95, hipsRZ: -0.2, torsoY: -0.45, torsoX: 0.08, torsoZ: -0.1,
    thRX: -1.1, thRZ: 0.45, knR: 2.0, thLX: 0.05, thLZ: 0.25, knL: 0.4,
    shLX: -1.1, shLZ: 0.3, elL: -2.0, shRX: -0.4, shRZ: 0.35, elR: -1.9, hoR: 0, hsR: 0, headX: -0.1 });
  lookFwd(W); lookFwd(S); lookFwd(R);
  const ti = IMPACT.atk3;
  if (t < ti + 0.08) return own(plant(strike(t, ti, ctx.base, W, S, 0.42), d, 'L'));
  const O = { ...strike(ti + 0.08, ti, ctx.base, W, S, 0.42) };
  const p = t < ti + 0.15 ? lerpPose(O, R, ease((t - ti - 0.08) / 0.07)) : lerpPose(R, ctx.base, ease(clamp((t - ti - 0.15) / 0.14, 0, 1)));
  plant(p, d, 'L');
  return own(landing(p, d, 'R', smooth01((t - ti - 0.17) / 0.1)));
}

/* ---------------- Q 龜派氣功（小） ---------------- */
// 龜派氣功共用：big 0 = Q 的小發、1 = R 的超級版（馬步更寬更低、上身壓得更前）
// 手臂角度是在檢視器裡對手的世界座標反解出來的（big 0／1 各一組，中間內插），改了軀幹角度要重新對位
const mix = (a, b, k) => a + (b - a) * k;
function arms(p, A0, A1, k) {
  const K = ['shLX', 'shLY', 'shLZ', 'elL', 'wrL', 'shRX', 'shRY', 'shRZ', 'elR', 'wrR'];
  K.forEach((key, i) => { p[key] = mix(A0[i], A1[i], k); });
  return p;
}
// 右腰合掌：胸口大幅轉向右後方（左肩對著目標），雙手半握、上下相疊收在右髖側後方（右手在下、左手在上，相距約 12 公分），
// 伸出軀幹輪廓之外：從側面、背面與遊戲鏡頭都看得到「兩手藏在腰後」的剪影
const CUP0 = [-0.44, -0.2, -0.84, -0.96, 0.12, -0.06, -0.32, 0.25, -1.33, -0.19];
const CUP1 = [-0.56, -0.26, -0.88, -0.91, 0.12, -0.04, -0.26, 0.28, -1.41, -0.22];
function kameCup(P, big = 0) {
  const p = P({ hipsY: -0.22 - 0.1 * big, hipsZ: -0.03, hipsRY: -0.75, torsoY: -0.95, torsoX: 0.4 + 0.08 * big, torsoZ: 0.1, headX: -0.3,
    clL: 0, clR: 0, hoL: 0.6, hoR: 0.6, hsL: 0.5, hsR: 0.5,
    thLX: -0.65 - 0.2 * big, thLZ: 0.32 + 0.08 * big, knL: 0.8, thRX: 0.5 + 0.15 * big, thRZ: 0.3 + 0.08 * big, knR: 0.8 });
  return arms(p, CUP0, CUP1, big);
}
// 雙掌推出：胸口轉正，雙臂伸直往胸前正中併攏、兩手掌根相貼（左手在上指尖朝上、右手在下指尖朝下，像張開的嘴）；前腳弓、後腳蹬直。
// 骨架的手掌法線就是手肘的轉軸、永遠垂直前臂，所以手臂朝前時掌心沒辦法正對目標；改成掌根相貼的上下一對，從正面、側面、上方都讀得出來
const PUSH0 = [-1.8, 0.28, -0.11, -0.12, -0.59, -1.69, -0.23, -0.16, -0.11, 0.58];
const PUSH1 = [-1.9, 0.28, -0.11, -0.12, -0.59, -1.79, -0.23, -0.16, -0.11, 0.58]; // 上身多前傾 0.1，手臂抬回同樣的世界角度
function kamePush(P, big = 0) {
  const S = P({ hipsY: -0.21 - 0.1 * big, hipsZ: 0.14 + 0.06 * big, hipsRY: -0.1, torsoY: 0.05, torsoX: 0.18 + 0.1 * big, torsoZ: 0, headX: -0.08,
    clL: 0, clR: 0, hoL: 1, hoR: 1, hsL: 0.9, hsR: 0.9,
    thLX: -0.8 - 0.15 * big, thLZ: 0.3 + 0.08 * big, knL: 0.9, thRX: 0.7 + 0.15 * big, thRZ: 0.26 + 0.08 * big, knR: 0.15 });
  return arms(S, PUSH0, PUSH1, big);
}
function cast_Q(ctx) {
  const { t, d, P } = ctx;
  const W = lookFwd(kameCup(P)), S = lookFwd(kamePush(P));
  // 0～0.07 收到右腰、0.07～0.12 推出（0.14 發射時雙掌已完全推出）、撐到 0.24 再收回架式（不用 strike 的過衝，免得雙掌往上飄）
  let p;
  if (t < 0.07) p = lerpPose(ctx.base, W, ease(t / 0.07));
  else if (t < 0.12) { const u = (t - 0.07) / 0.05; p = lerpPose(W, S, u * u * (2 - u)); }
  else if (t < 0.24) p = S;
  else p = lerpPose(S, ctx.base, ease(clamp((t - 0.24) / 0.07, 0, 1)));
  return own(plant(p, d));
}

/* ---------------- W 龍閃拳 ---------------- */
// 衝刺：上身壓平往前飛（前傾主要靠胸口，骨盆別折太多，腰帶才不會從兩腿間戳出來），右拳蓄在腰側，左拳在前領路
// （衝進連打的第一拳就是左拳，0.02 秒就命中，所以左臂先伸好）
function dash_W(ctx) {
  const { t, P } = ctx;
  const fl = Math.sin(t * 34) * 0.05;
  const p = P({ hipsRX: 0.3, hipsY: 0.12, hipsRY: -0.35, hipsRZ: 0, torsoX: 0.5, torsoY: -0.3, torsoZ: fl * 0.4, headX: -0.95,
    shRX: 0.5, shRZ: 0.6, elR: -1.65, hoR: 0, hsR: 0, elL: -0.12, clL: 0.25, hoL: 0, hsL: 0,
    thLX: 0.25 + fl, thLZ: 0.25, knL: 0.5, thRX: 0.5 - fl, thRZ: 0.2, knR: 0.95 });
  aim(p, 'L', 0, -0.33); // 拳頭略朝下：身體已前傾，手臂再抬平會變成相對軀幹高舉過頭（shX < −2.05），左腰的衣襬會被拉出一片
  return own(lookFwd(p)); // 自己的動作走快速平滑（τ≈31 ms），0.3 秒的衝刺大約 0.1 秒就壓平
}
// 連打：左右直拳交替，命中時刻對齊 combat.js 的 0.02 + 0.1·i（悟空 4 下：左 0.02、右 0.12、左 0.22、右 0.32）
// 兩隻手各有自己的時間軸：命中前 75～30 ms 出拳、撐到命中後 25 ms，再 45 ms 收回下巴；一手收、另一手同時出，像活塞
const RUSH_HITS = { L: [0.02, 0.22], R: [0.12, 0.32] };
function punchExt(t, hits) {
  let e = 0;
  for (const h of hits) {
    const u = t - h;
    const v = u < -0.075 ? 0 : u < -0.03 ? ease((u + 0.075) / 0.045) : u < 0.025 ? 1 : u < 0.07 ? 1 - ease((u - 0.025) / 0.045) : 0;
    e = Math.max(e, v);
  }
  return e;
}
function rush_W(ctx) {
  const { t, d, P } = ctx;
  if (t >= 0.32) return atk3_W({ ...ctx, t: t - 0.32 }); // 第四下就是龍拳（實機在這一刻換成 atk3，這裡只是保險）
  const eL = punchExt(t, RUSH_HITS.L), eR = punchExt(t, RUSH_HITS.R);
  const tw = 0.55 * (eR - eL); // 左拳時胸口右轉、右拳時左轉
  const p = P({ hipsY: -0.2, hipsZ: 0.05 + 0.05 * Math.max(eL, eR), hipsRY: tw * 0.4, torsoY: tw, torsoX: 0.32, torsoZ: 0, headX: -0.15,
    hoL: 0, hoR: 0, hsL: 0, hsR: 0, wrL: 0, wrR: 0,
    thLX: -0.7, thLZ: 0.28, knL: 0.8, thRX: 0.55, thRZ: 0.25, knR: 0.5 });
  for (const [s, e] of [['L', eL], ['R', eR]]) {
    aim(p, s, s === 'L' ? -0.05 : 0.05, 0.12);
    p['sh' + s + 'X'] = -0.85 + (p['sh' + s + 'X'] + 0.85) * e;
    p['sh' + s + 'Z'] = 0.15 + (p['sh' + s + 'Z'] - 0.15) * e;
    p['el' + s] = -2.35 + 2.32 * e;
    p['cl' + s] = 0.3 * e;
  }
  return own(plant(lookFwd(p), d));
}
// 收尾的龍拳：第四下命中時 combat.js 把動畫換成 atk3（t 從 0 起算，命中已結算）。
// 不再蓄力：一開始就是整個人打平飛出去、身體延著右拳成一直線，左拳拉回腰際、雙腿在後拖直；停在空中，再落回架式
function atk3_W(ctx) {
  const { t, d, P } = ctx;
  const S = P({ hipsY: 0.1, hipsZ: 0.4, hipsRX: 0.6, hipsRY: 0.3, torsoY: 0.4, torsoX: 0.35, torsoZ: 0, headX: -0.7,
    elR: -0.02, clR: 0.35, hoR: 0, hsR: 0, shLX: 0.9, shLZ: 0.25, elL: -1.6, hoL: 0, hsL: 0, wrL: 0, wrR: 0,
    thLX: 0.6, thLZ: 0.18, knL: 0.3, thRX: 0.35, thRZ: 0.12, knR: 0.6 });
  aim(S, 'R', 0, 0.12);
  lookFwd(S);
  const O = { ...S }; // 衝出時多送 10%（更平、更前）
  O.hipsZ += 0.06; O.hipsRX += 0.06; O.torsoX += 0.04; O.shRX -= 0.1; O.thLX += 0.06; O.thRX += 0.06;
  let p;
  if (t < 0.05) p = lerpPose(S, O, Math.sin(HALF_PI * t / 0.05));
  else if (t < 0.11) p = lerpPose(O, S, ease((t - 0.05) / 0.06));
  else if (t < 0.17) p = { ...S };
  else p = lerpPose(S, ctx.base, ease(clamp((t - 0.17) / 0.13, 0, 1)));
  // 最後 0.1 秒雙腳漸進踩回地面（落地，不是滑回去）
  return own(landing(p, d, 'LR', smooth01((t - 0.2) / 0.1)));
}

/* ---------------- E 瞬間移動 ---------------- */
// 站直、低頭專注：右手立掌在臉前（手刀，拇指收起；骨架沒有單指控制，做不出真的兩指），指尖貼額頭正中，手肘抬到肩高往前。
// 注意：實機在 vanish 期間整個模型是隱藏的（main.js），這個姿勢只在檢視器裡看得到，所以只做最基本的可讀性。
function vanish_E(ctx) {
  const { d, P } = ctx;
  const p = P({ hipsY: -0.03, hipsRY: -0.15, hipsRZ: 0, torsoX: 0.02, torsoY: -0.1, torsoZ: 0, headX: 0.25, spin: 0,
    shRX: -1.45, shRY: 0, shRZ: -0.35, elR: -2.4, wrR: 0, hoR: 1, hsR: 0,
    shLX: 0.05, shLZ: 0.15, elL: -0.35, hoL: 0.4, hsL: 0.3,
    thLX: -0.15, thLZ: 0.12, knL: 0.12, thRX: 0.12, thRZ: 0.1, knR: 0.15 });
  return own(plant(lookFwd(p), d));
}

/* ---------------- R 超級龜派氣功 ---------------- */
// 悟空的 R 沒有 windup，光束在 0.32 秒射出：0～0.24 秒深蹲在右腰集氣（越蹲越低、越拉越後、雙手微顫），
// 0.24～0.31 秒雙掌推出，0.31 起撐住（顫抖、被反衝力往後頂），最後 0.12 秒收回架式（動作 1.57 秒結束）
function beam_R(ctx) {
  const { t, d, P } = ctx;
  const cupEnd = 0.24, out = 0.31, end = 1.57;
  if (t < cupEnd) {
    const k = ease(clamp(t / cupEnd, 0, 1)), sh = Math.sin(t * 70) * 0.025 * k;
    const C = lookFwd(kameCup(P, k));
    C.elL += sh; C.elR -= sh; C.torsoY -= 0.12 * k; // 越拉越後
    return own(plant(lerpPose(ctx.base, C, k), d));
  }
  // 推出後頂住光束的反衝力：身體壓前、後腳慢慢被推得滑後一點
  const tr = Math.sin(t * 60) * 0.025, push = clamp((t - 0.6) / 0.6, 0, 1);
  const S = lookFwd(kamePush(P, 1));
  S.torsoX += tr + 0.06 * push; S.hipsZ -= 0.06 * push; S.hipsY -= 0.03 * push; S.headX -= 0.08;
  S.elL += tr; S.elR += tr;
  let p;
  if (t < out) {
    const W = lookFwd(kameCup(P, 1)); W.torsoY -= 0.12;
    const u = (t - cupEnd) / (out - cupEnd);
    p = lerpPose(W, S, u * u * (2 - u));
  } else if (t < end - 0.12) p = S;
  else p = lerpPose(S, ctx.base, ease(clamp((t - (end - 0.12)) / 0.12, 0, 1)));
  return own(plant(p, d));
}

/* ---------------- 集氣 ---------------- */
// 變身式的集氣：兩腳大開成 A 字站穩（骨架沒有大腿外旋，大腿往前抬再彎膝，從遊戲鏡頭看會像跪著或蛙蹲，所以大腿只往兩側張、膝蓋微彎），
// 雙拳握緊壓在腰側、手肘往後撐，上身後仰仰頭吶喊，全身發抖
function charge({ t, d, P }) {
  const tr = Math.sin(t * 70) * 0.02, sw = Math.sin(t * 9) * 0.03;
  const p = P({ hipsY: -0.17, hipsZ: 0, hipsRX: 0, hipsRY: 0, hipsRZ: 0, torsoX: -0.22 + tr, torsoY: sw, torsoZ: 0, headX: -0.45, headZ: 0,
    shLX: 0.45, shLY: 0, shLZ: 0.75, elL: -1.6 + tr, shRX: 0.45, shRY: 0, shRZ: 0.75, elR: -1.6 - tr,
    clL: -0.15, clR: -0.15, hoL: 0, hoR: 0, hsL: 0, hsR: 0, wrL: 0.25, wrR: 0.25,
    thLX: -0.08, thLZ: 0.48, knL: 0.5, thRX: -0.08, thRZ: 0.48, knR: 0.5 });
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
