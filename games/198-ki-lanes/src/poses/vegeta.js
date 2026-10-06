// vegeta 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（lerpPose、smooth01、clamp、IMPACT…；出招時間軸用下面自己的 hit()）。
//
// 貝吉塔：挺胸、下巴抬高、左肩在前斜睨；普攻是左刺拳 → 右重直拳 → 迴旋踢，
// Q 連續能量彈右掌推出、左手收回，W 超級衝刺踢（飛身側踢 → 四段快踢 → 前蹬收尾），R 終極閃光（雙臂大張蓄力 → 水平合掌前推 → 撐住後座力）。
// 這副骨架的方向：+z 正前、+x 是他的左手邊；torsoY／hipsRY 正值把右肩轉到前面。shZ 正值讓伸直的手臂往外張，
// 所以身體往右扭（正）時要加 shRZ、往左扭（負）時要加 shLZ，拳頭才會回到正前方的中線上。
import { lerpPose, clamp, smooth01, IMPACT } from '../pose-kit.js';

const mix = (a, b, k) => lerpPose(a, b, clamp(k, 0, 1));
const own = (p) => { p.ownHands = true; return p; }; // 手形自己決定，不套共用的 HAND_OPEN
const outQ = (u) => u * (2 - u); // 越來越慢
// 出招時間軸（取代 strike）：base → W 預備 → S 命中 → 順勢多送一點 → 收回架式（rec 秒內做完）。
// 姿勢跟隨有約 30 ms 的平滑，所以 S 提前 LEAD 秒擺到位並停住，命中那一刻（ti）手腳才真的伸到最直；
// 順勢多送的量很小，而且幾乎伸直的肘、膝一律夾住，不會被推過頭往反方向折
const LEAD = 0.035;
const fix = (p) => {
  p.elL = Math.min(p.elL, -0.04); p.elR = Math.min(p.elR, -0.04);
  p.knL = Math.max(p.knL, 0.03); p.knR = Math.max(p.knR, 0.03);
  return p;
};
const _o = {};
const hit = (t, ti, base, W, S, rec, mid = null, over = 0.08) => { // mid：收招途中先經過的姿勢（例如踢完先落腳）
  const te = Math.max(0.03, ti - LEAD), a = te * 0.55;
  let p;
  if (t < a) p = mix(base, W, smooth01(t / a));
  else if (t < te) { const u = (t - a) / (te - a); p = mix(W, S, u * u * (2 - u)); }
  else {
    for (const k in S) _o[k] = S[k] + (S[k] - W[k]) * over;
    if (t < ti + 0.07) p = mix(S, _o, Math.sin(Math.PI * 0.5 * clamp((t - te) / (ti + 0.07 - te), 0, 1)));
    else {
      const u = (t - ti - 0.07) / Math.max(0.05, rec - ti - 0.07);
      p = !mid ? mix(_o, base, smooth01(u)) : u < 0.5 ? mix(_o, mid, smooth01(u / 0.5)) : mix(mid, base, smooth01((u - 0.5) / 0.5));
    }
  }
  return fix(p);
};

// 抱胸：上臂內旋（shY）讓前臂橫過胸口；左臂在上、在前，右臂壓在下面，兩個拳頭各塞到對側上臂旁
const FOLD = { shLX: -0.78, shLY: -1.45, shLZ: 0.16, elL: -1.6, shRX: -0.55, shRY: -1.32, shRZ: 0.1, elR: -1.78, hoL: 0.1, hoR: 0.1, wrL: 0, wrR: 0 };

export default {
  // 架式：左肩在前的半側身，重心落後腳；左拳在胸前、右拳收在下巴旁；下巴抬高斜睨。待機時偶爾抱胸。
  stance({ t, name }) {
    const br = Math.sin(t * 2.4);
    const p = {
      hipsY: -0.07 - 0.012 * br, hipsZ: 0, hipsRX: 0, hipsRY: -0.2, hipsRZ: 0.04,
      torsoX: -0.06 + 0.018 * br, torsoY: -0.3, torsoZ: -0.03,
      headX: -0.2 - 0.02 * br, headY: 0.3, headZ: 0.05,
      shLX: -0.72 - 0.04 * br, shLY: 0, shLZ: 0.25, elL: -1.45,
      shRX: -0.55 - 0.03 * br, shRY: -0.5, shRZ: 0.1, elR: -2.1,
      thLX: -0.32, thLZ: 0.16, knL: 0.34, thRX: 0.3, thRZ: 0.2, knR: 0.44,
      spin: 0, stretch: 0, wrL: 0, wrR: 0, anL: 0, anR: 0, clL: 0, clR: 0,
      hoL: 0.05, hoR: 0, hsL: 0, hsR: 0, toL: 0, toR: 0, prop: 0,
    };
    if (name === 'idle') { // 每隔一陣子雙手抱胸、站直、下巴抬更高、頭撇開（傲慢的等待）
      const f = smooth01((Math.sin(t * 0.35) - 0.4) / 0.3);
      if (f > 0) Object.assign(p, mix(p, { ...p, ...FOLD, hipsY: -0.02 - 0.008 * br, hipsRY: -0.12, torsoY: -0.1, torsoX: -0.1 + 0.012 * br,
        headX: -0.3, headY: 0.55, knL: 0.16, knR: 0.24, thLX: -0.18, thRX: 0.16 }, f));
    }
    return p;
  },

  // 普攻一：左刺拳。前拳先往下巴收一點、身體微微回扭蓄力，再往左扭、前腳踏半步把左臂打直（右拳留在下巴護著）
  atk1({ t, P, base }) {
    const W = P({ torsoY: -0.12, hipsRY: -0.12, torsoX: 0.04, hipsY: -0.11, knL: 0.48, knR: 0.55,
      shLX: -0.95, shLZ: 0.3, elL: -2.15, hoL: 0 });
    const S = P({ torsoY: -0.45, hipsRY: -0.2, torsoX: 0.16, torsoZ: 0.03, hipsY: -0.13, hipsZ: 0.16,
      shLX: -1.66, shLZ: 0.7, elL: -0.04, hoL: 0, shRX: -0.6, shRY: -0.55, elR: -2.2,
      thLX: -0.62, thLZ: 0.16, knL: 0.62, thRX: 0.5, thRZ: 0.18, knR: 0.16, headY: 0.5, headX: -0.08 });
    return hit(t, IMPACT.atk1, base, W, S, 0.3);
  },

  // 普攻二：右重直拳。右拳收到肋旁、左手往前探距離並把身體再往左扭；接著髖先轉、後腳蹬直、深弓步，
  // 右臂朝正前方打直（只扭約 27 度，靠 shRZ 把拳頭拉回中線），左拳拉回胸口
  atk2({ t, P, base }) {
    const W = P({ torsoY: -0.6, hipsRY: -0.32, torsoX: 0.08, hipsY: -0.12, hipsZ: -0.04, knL: 0.6, knR: 0.68,
      shLX: -1.35, shLZ: 0.45, elL: -0.7, hoL: 0.3, shRX: -0.2, shRY: -0.3, shRZ: 0.35, elR: -2.35, headY: 0.6 });
    const S = P({ torsoY: 0.35, hipsRY: 0.12, torsoX: 0.25, hipsY: -0.17, hipsZ: 0.28,
      shRX: -1.7, shRY: 0, shRZ: 0.36, elR: -0.04, clR: 0.15, shLX: -0.55, shLY: -0.6, shLZ: 0.2, elL: -2.2, hoL: 0,
      thLX: -0.85, thLZ: 0.2, knL: 0.95, thRX: 0.75, thRZ: 0.14, knR: 0.06, headY: -0.3, headX: -0.1 });
    return hit(t, IMPACT.atk2, base, W, S, 0.34);
  },

  // 普攻三：右腳迴旋踢。膝先提起、身體往左回扭，再讓上身往外倒、雙臂甩開，腳背橫掃到胸口高度
  atk3({ t, P, base }) {
    const W = P({ torsoY: -0.75, hipsRY: -0.45, torsoX: 0.18, hipsY: -0.12, hipsZ: -0.02,
      thRX: -0.95, thRZ: 0.35, knR: 2.0, thLX: -0.3, knL: 0.55,
      shLX: -1.0, shLZ: 0.35, elL: -1.7, shRX: 0.35, shRZ: 0.45, elR: -1.6, headY: 0.4 });
    const S = P({ torsoY: 1.0, hipsRY: 0.7, torsoX: -0.3, torsoZ: 0.55, hipsRZ: 0.22, hipsY: -0.09, hipsZ: 0.14,
      thRX: -2.3, thRZ: 0.9, knR: 0.08, thLX: 0.15, thLZ: 0.08, knL: 0.3,
      shLX: 0.25, shLZ: 1.2, elL: -0.5, shRX: 0.55, shRZ: 1.05, elR: -0.55, headY: -0.95, headX: -0.1, toR: -0.3 });
    // 踢完右腳先往前落地、身體還朝右轉著，再踏回左肩在前的架式（直接內插回架式時右腿會從左腿前面交叉穿過）
    const PLANT = P({ hipsRY: 0.45, torsoY: 0.3, torsoX: 0.1, hipsY: -0.12, hipsZ: 0.08,
      thRX: -0.5, thRZ: 0.25, knR: 0.55, thLX: 0.4, thLZ: 0.15, knL: 0.45,
      shLX: -0.8, shLZ: 0.4, elL: -1.8, shRX: -0.6, shRY: -0.4, shRZ: 0.3, elR: -2.0, headY: -0.45 });
    return hit(t, IMPACT.atk3, base, W, S, 0.4, PLANT);
  },

  // W 收尾：快踢的最後一下，右腳前蹬把對手踹飛。打擊在動作 t=0 就結算，所以不從地面架式起手：
  // 直接從空中的收膝（和快踢同高）在 0.03 秒內蹬直，停住 0.08 秒讓人看清楚，再落地屈膝緩衝、0.29 秒回到架式（衝刺踢在 0.305 秒結束）
  atk3_W({ t, P, base }) {
    const W = P({ torsoX: 0.05, torsoY: 0.4, hipsY: 0.16, hipsRX: -0.1, hipsZ: 0.05, thRX: -1.3, knR: 1.7, thLX: -0.4, knL: 1.2,
      shLX: -0.3, shLY: -0.5, shLZ: 0.3, elL: -2.0, shRX: -0.3, shRY: -0.5, shRZ: 0.3, elR: -2.0 });
    const S = P({ torsoX: -0.45, torsoY: 0.75, torsoZ: 0.12, hipsRX: -0.2, hipsY: 0.14, hipsZ: 0.18, hipsRY: 0.4,
      thRX: -1.95, thRZ: 0.15, knR: 0.05, thLX: 0.35, thLZ: 0.1, knL: 0.55,
      shLX: 0.2, shLZ: 0.9, elL: -0.7, shRX: 0.5, shRZ: 0.75, elR: -0.8, headY: -0.7, headX: 0.05, toR: -0.25 });
    const LAND = P({ hipsY: -0.16, hipsZ: 0.04, torsoX: 0.12, torsoY: -0.1, hipsRY: -0.1, knL: 0.75, knR: 0.8, thLX: -0.5, thRX: 0.2,
      shLX: -0.8, shLZ: 0.4, elL: -1.5, shRX: -0.5, shRY: -0.4, shRZ: 0.25, elR: -2.0, headY: 0.2 });
    let p;
    if (t < 0.03) p = mix(W, S, outQ(t / 0.03));
    else if (t < 0.11) p = S;
    else if (t < 0.22) p = mix(S, LAND, smooth01((t - 0.11) / 0.11));
    else p = mix(LAND, base, smooth01((t - 0.22) / 0.07));
    return fix(p);
  },

  // Q 連續能量彈：右掌往後拉、左掌在前瞄準 → 右掌朝正前方推出（0.10 秒發射，對準能量彈出現的位置）→
  // 手掌被反作用力往上彈、上身往後一頓 → 收回架式（0.26 秒內）
  cast_Q({ t, P, base }) {
    const Wd = P({ torsoY: -0.5, hipsRY: -0.25, torsoX: 0.04, hipsY: -0.11, knL: 0.48, knR: 0.55,
      shRX: -0.35, shRY: -0.2, shRZ: 0.5, elR: -2.2, hoR: 0.9, hsR: 0.6, wrR: 0.4,
      shLX: -1.35, shLZ: 0.55, elL: -0.35, hoL: 0.9, hsL: 0.4, headY: 0.55 });
    const R = P({ torsoY: 0.3, hipsRY: 0.1, torsoX: 0.18, hipsY: -0.13, hipsZ: 0.12,
      shRX: -1.62, shRY: 0, shRZ: 0.3, elR: -0.05, hoR: 1, hsR: 0.85, wrR: -0.55, clR: 0.12,
      shLX: -0.55, shLY: -0.6, shLZ: 0.2, elL: -2.15, hoL: 0.1, hsL: 0,
      thLX: -0.62, knL: 0.62, thRX: 0.5, knR: 0.2, headY: -0.25 });
    const K = P({ ...R, shRX: -1.85, elR: -0.35, wrR: -0.2, torsoX: 0.04, hipsZ: 0.04, clR: 0 }); // 反作用力：手掌往上彈、上身退回
    let p;
    if (t < 0.045) p = mix(base, Wd, smooth01(t / 0.045));
    else if (t < 0.075) p = mix(Wd, R, outQ((t - 0.045) / 0.03));
    else if (t < 0.15) p = R;
    else if (t < 0.19) p = mix(R, K, smooth01((t - 0.15) / 0.04));
    else p = mix(K, base, smooth01((t - 0.19) / 0.06));
    return own(fix(p));
  },

  // W 衝刺：飛身側踢，右腳在前伸直、左腳收起，身體後仰、雙拳護在胸前；衝刺可能很短，0.04 秒就擺到位
  dash_W({ t, P, base }) {
    const fl = Math.sin(t * 34) * 0.05;
    const S = P({ hipsY: 0.34, hipsRX: -0.3, hipsRY: 0.18, hipsRZ: 0.05, torsoX: -0.2, torsoY: 0.55, torsoZ: fl * 0.4,
      headX: 0.1, headY: -0.45,
      thRX: -1.45 + fl, thRZ: 0.1, knR: 0.05, thLX: -0.7, thLZ: 0.18, knL: 2.05,
      shLX: 0, shLY: -0.6, shLZ: 0.2, elL: -1.9, shRX: 0.1, shRY: -0.6, shRZ: 0.12, elR: -1.9, toR: -0.3 }); // 上身後仰又側身，雙拳在胸骨正前方（胸口朝向）
    return fix(mix(base, S, smooth01(t / 0.04)));
  },

  // W 快踢：左右腳交替踢出，每 0.075 秒一腳（打擊在 0.02、0.095、0.17、0.245 秒），雙拳護胸、整個人懸在空中
  rush_W({ t, P }) {
    const s = (t - 0.02) / 0.075;
    const aL = smooth01((0.5 + 0.5 * Math.cos(Math.PI * s)) * 1.5 - 0.25), aR = 1 - aL; // 偶數段左腳、奇數段右腳
    const tw = aL - aR;
    // 踢哪隻腳，髖就往同側送（左腳踢時 hipsRY 為負），胸口反向扭回來對著目標，兩腳都踢在正前方的中線上
    return fix(P({ hipsY: 0.16, hipsRX: -0.15, hipsRY: -0.3 * tw, hipsZ: 0.05,
      torsoX: -0.1, torsoY: 0.4 * tw, torsoZ: -0.08 * tw, headY: -0.1 * tw, headX: -0.1,
      thLX: -0.65 - 0.9 * aL, thLZ: 0.15 - 0.15 * aL, knL: 1.75 - 1.65 * aL,
      thRX: -0.65 - 0.9 * aR, thRZ: 0.15 - 0.15 * aR, knR: 1.75 - 1.65 * aR,
      shLX: -0.08 - 0.2 * aR, shLY: -0.5, shLZ: 0.25 + 0.2 * aL, elL: -2.0 + 0.2 * aL,
      shRX: -0.08 - 0.2 * aL, shRY: -0.5, shRZ: 0.25 + 0.2 * aR, elR: -2.0 + 0.2 * aR,
      toL: -0.3 * aL, toR: -0.3 * aR }));
  },

  // R 終極閃光：0～0.22 秒雙臂往兩側平舉張開、掌心朝外、挺胸怒吼；蓄力時雙臂再往後張並發抖；
  // 0.46～0.55 秒雙臂在肩高水平往前合攏、雙掌上下疊在正前方推出（光束 0.55 秒出現）；之後被後座力慢慢推退，再前後頂住。
  // 手臂先用 shX −1.5 把肩關節「轉成水平面」，之後只動 shZ：shZ 1.5 是平舉在身側、0 是正前方，中間每一格都維持在肩高，
  // 合掌時不會像直接內插 shX／shZ 那樣先垂到腰間。手腕 −0.6 讓指尖朝上，平舉時掌心朝外、推出時掌心朝前。
  beam_R({ t, P, base }) {
    const tr = Math.sin(t * 57) * 0.02, tr2 = Math.sin(t * 43 + 1) * 0.02;
    const SPREAD = P({ hipsY: -0.13, hipsRY: 0.03, hipsRZ: 0, torsoX: -0.2 + tr, torsoY: 0, torsoZ: 0, headX: -0.32, headY: 0, headZ: 0,
      shLX: -1.5, shLY: 0, shLZ: 1.5, elL: -0.1, shRX: -1.5, shRY: 0, shRZ: 1.5, elR: -0.1,
      hoL: 1, hoR: 1, hsL: 1, hsR: 1, wrL: -0.6, wrR: -0.6, clL: -0.1, clR: -0.1,
      thLX: -0.32, thLZ: 0.36, knL: 0.58, thRX: 0.32, thRZ: 0.36, knR: 0.62 });
    const FIRE = P({ hipsY: -0.15, hipsRY: 0.02, hipsRZ: 0, hipsZ: 0.06, torsoX: 0.12, torsoY: 0, torsoZ: 0, headX: 0.02, headY: 0, headZ: 0,
      shLX: -1.5, shLY: 0, shLZ: 0.01, elL: -0.05, shRX: -1.45, shRY: 0, shRZ: 0.03, elR: -0.05,
      hoL: 1, hoR: 1, hsL: 1, hsR: 1, wrL: -0.6, wrR: -0.6, clL: 0.15, clR: 0.15,
      thLX: -0.68, thLZ: 0.22, knL: 0.74, thRX: 0.58, thRZ: 0.16, knR: 0.24 });
    let p;
    if (t < 0.22) p = mix(base, SPREAD, smooth01(t / 0.22));
    else if (t < 0.46) { // 蓄力中：雙臂再往後張（shZ 超過 π/2 就往身後轉）、身體後仰發抖
      const u = smooth01((t - 0.22) / 0.24);
      p = P({ ...SPREAD, shLZ: 1.5 + 0.3 * u + tr, shRZ: 1.5 + 0.3 * u - tr, torsoX: -0.2 - 0.08 * u + tr });
    } else if (t < 0.55) { // 合掌：0.46 時雙臂在身後一點（shZ 1.8），水平掃到正前方
      const u = (t - 0.46) / 0.09, e = u * u * (3 - 2 * u);
      p = mix({ ...SPREAD, shLZ: 1.8, shRZ: 1.8, torsoX: -0.28 }, FIRE, e);
    } else { // 後座力：0.55～0.9 秒被推退（重心後移、上身打直），之後 6 Hz 前後頂住，外加細微發抖
      const u = smooth01((t - 0.55) / 0.35), push = Math.sin((t - 0.55) * 6 * Math.PI * 2) * 0.03 * u;
      p = P({ ...FIRE, hipsZ: 0.06 - 0.1 * u + push, torsoX: 0.12 - 0.1 * u + push + tr, torsoZ: tr2,
        knL: 0.74 + 0.08 * u, thLX: -0.68 + 0.06 * u, shLX: -1.5 + tr, shRX: -1.45 - tr });
    }
    return own(fix(p));
  },

  // 勝利：抱胸、站直、下巴抬高把頭撇開
  win({ t, P }) {
    const br = Math.sin(t * 2);
    return P({ ...FOLD, hipsY: -0.02 + 0.01 * br, hipsRY: -0.1, hipsRZ: 0.05, torsoX: -0.12, torsoY: -0.05, torsoZ: 0, headX: -0.32, headY: 0.7, headZ: 0.1,
      thLX: -0.12, thLZ: 0.16, knL: 0.08, thRX: 0.12, thRZ: 0.2, knR: 0.22 });
  },
};
