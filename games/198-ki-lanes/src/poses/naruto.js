// naruto 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（strike、lerpPose、ease、clamp、IMPACT…）。
//
// 鳴人：壓低的忍者架式、街頭打架式的直拳＋大擺拳＋迴旋踢；
// Q 螺旋丸（手托在身後衝刺 → 撞上時整個人壓進去按出去）、W 影分身十字印、E 替身術蹲身結印、R 風遁螺旋手裏劍（單手高舉 → 後仰 → 擲出）。
import { strike, lerpPose, ease, clamp, IMPACT, blank } from '../pose-kit.js';

const own = (p) => { p.ownHands = true; return p; }; // 手形自己決定，不讓共用的 HAND_OPEN 蓋掉
const max0 = (v) => (v > 0 ? v : 0);
// 頭轉回正前方：世界偏航 = hipsRY + torsoY/2 + headY
const face = (p, bias = 0) => { p.headY = -(p.hipsRY + p.torsoY * 0.5) + bias; return p; };

export default {
  // 架式：半蹲壓低、身體前傾，左手攤開在前、右拳收在後腰（握苦無的位置），重心隨呼吸微微上下
  stance({ t }) {
    const p = blank();
    const br = Math.sin(t * 2.6), bob = Math.sin(t * 5.2);
    Object.assign(p, {
      hipsY: -0.18 - 0.015 * br - 0.008 * bob, hipsRY: 0.25, hipsRZ: 0.03, torsoX: 0.34 + 0.025 * br, torsoY: 0.3, torsoZ: -0.03, headX: -0.32,
      shLX: -1.2, shLZ: 0.5, elL: -1.0, shRX: 0.25, shRZ: 0.6, elR: -1.35,
      thLX: -0.62, thLZ: 0.4, knL: 1.02, thRX: 0.36, thRZ: 0.36, knR: 0.98,
      hoL: 0.75, hsL: 0.45, hoR: 0, hsR: 0,
    });
    return face(p, 0.05);
  },

  // 忍者跑：上身大幅前傾、頭抬起看前方，雙臂筆直拖在身後（略高於水平），大步幅
  run({ phase, P }) {
    const s = Math.sin(phase), c = Math.cos(phase);
    return own(P({
      hipsY: -0.14 + 0.07 * Math.abs(c), hipsRX: 0.18, hipsRY: -0.12 * s, hipsRZ: 0, torsoX: 0.72, torsoY: 0.16 * s, torsoZ: 0, headX: -0.72, headY: 0.06 * s,
      thLX: s * 1.25 - 0.25, thRX: -s * 1.25 - 0.25, thLZ: 0.06, thRZ: 0.06,
      knL: 0.35 + 1.55 * max0(-c) * (0.6 + 0.4 * max0(-s)), knR: 0.35 + 1.55 * max0(c) * (0.6 + 0.4 * max0(s)),
      shLX: 0.95 + 0.08 * s, shRX: 0.95 - 0.08 * s, shLZ: 0.32, shRZ: 0.32, shLY: 0.2, shRY: 0.2, elL: -0.12, elR: -0.12,
      hoL: 0.85, hoR: 0.85, hsL: 0.2, hsR: 0.2,
    }));
  },

  // 普攻一：左手刺拳，前腳踏進
  atk1({ t, P, base }) {
    const W = face(P({ hipsY: -0.21, hipsZ: -0.04, hipsRY: 0.45, torsoY: 0.55, torsoX: 0.3, shLX: -0.8, shLZ: 0.35, elL: -2.1, shRX: -0.5, shRZ: 0.35, elR: -2.0, hoL: 0, hsL: 0,
      knL: 1.1, knR: 1.0 }));
    const S = face(P({ hipsY: -0.2, hipsZ: 0.22, hipsRY: -0.1, torsoY: -0.4, torsoX: 0.42, torsoZ: 0.06,
      shLX: -1.62, shLZ: 0.85, elL: -0.02, clL: 0.25, shRX: -0.55, shRZ: 0.3, elR: -2.2, hoL: 0, hsL: 0,
      thLX: -0.95, thLZ: 0.3, knL: 0.95, thRX: 0.75, thRZ: 0.3, knR: 0.2 }));
    return own(strike(t, IMPACT.atk1, base, W, S, 0.3));
  },

  // 普攻二：右手大擺拳。預備時右臂在肩膀高度往外、往後拉開（肘與肩同高），出拳時臀先轉、右拳沿水平大弧線掃過來，
  // 彎成約 80 度的鉤拳停在下巴前、越過中線；右腳跟著踏出。手臂打平時 shRY 是水平擺動，從上方看得到整道弧線
  atk2({ t, P, base }) {
    const W = face(P({ hipsY: -0.22, hipsRY: -0.3, torsoY: -1.0, torsoX: 0.3, torsoZ: 0.05,
      shRX: 0, shRZ: 1.5, shRY: 0.6, elR: -1.0, shLX: -1.3, shLZ: 0.3, elL: -1.4, hoL: 0.3,
      knL: 1.1, knR: 1.05 }));
    const S = face(P({ hipsY: -0.2, hipsZ: 0.24, hipsRY: 0.45, torsoY: 0.8, torsoX: 0.42, torsoZ: -0.12,
      shRX: 0, shRZ: 1.5, shRY: -0.8, elR: -1.5, shLX: 0.45, shLZ: 0.45, elL: -1.7, hoL: 0,
      thRX: -0.8, thRZ: 0.3, knR: 0.9, thLX: 0.6, thLZ: 0.35, knL: 0.35 }));
    return own(strike(t, IMPACT.atk2, base, W, S, 0.34));
  },

  // 普攻三：右腳迴旋踢。預備時右膝先收起來（膝蓋抬高、小腿折起）、扭腰蓄力；踢出時骨盆整個翻開，
  // 腿從側面水平掃出去，上身往反方向大幅倒、雙臂甩開
  atk3({ t, P, base }) {
    const W = face(P({ hipsY: -0.17, hipsRY: -0.55, torsoY: -0.8, torsoX: 0.25, torsoZ: 0.12,
      thRX: -1.1, thRZ: 0.7, knR: 2.1, thLX: -0.3, thLZ: 0.1, knL: 0.6,
      shLX: -0.9, shLZ: 0.3, elL: -1.6, shRX: 0.5, shRZ: 0.4, elR: -1.4 }));
    const S = face(P({ hipsY: 0.0, hipsZ: 0.12, hipsRY: 0.95, hipsRZ: -0.35, torsoY: 0.45, torsoX: -0.3, torsoZ: 0.65,
      thRX: -1.55, thRZ: 1.2, knR: 0.08, thLX: 0.15, thLZ: 0.1, knL: 0.4,
      shLX: 0.3, shLZ: 1.25, elL: -0.6, shRX: 0.6, shRZ: 1.0, elR: -0.5, hoL: 0.6, hoR: 0.6 }), -0.2);
    return own(strike(t, IMPACT.atk3, base, W, S, 0.42));
  },

  // Q 螺旋丸・衝刺：起步的 0.07 秒先在右腰前兩掌相對「捏」出螺旋丸，接著右臂拖到身側後方、掌心朝上托著球，
  // 左手在前開路，低身疾奔
  dash_Q({ t, P }) {
    const ph = t * 20, s = Math.sin(ph), c = Math.cos(ph);
    const legs = { hipsY: -0.2, hipsRX: 0.22, hipsRZ: 0, torsoX: 0.55, torsoZ: 0,
      thLX: s * 0.95 - 0.3, thRX: -s * 0.95 - 0.3, thLZ: 0.08, thRZ: 0.08,
      knL: 0.5 + 1.2 * max0(-c), knR: 0.5 + 1.2 * max0(c) };
    // 捏球：兩手在右腰前，掌心相對、中間隔一顆球
    const F = face(P({ ...legs, hipsRY: -0.1, torsoY: -0.35,
      shRX: -0.6, shRZ: 0.12, elR: -1.1, shLX: -0.55, shLZ: -0.85, elL: -1.05,
      hoR: 0.85, hsR: 0.7, hoL: 0.85, hsL: 0.7 }));
    // 托球疾奔：右臂往後、往外拖在腰側略後（不拖太遠，撞上時推出去的距離短），手臂一扭讓掌心朝上
    const C = face(P({ ...legs, hipsRY: 0.2, torsoY: 0.35,
      shRX: 1.1, shRZ: 0.95, shRY: -1.4, elR: -0.5, wrR: -0.6, hoR: 0.8, hsR: 0.8,
      shLX: -0.9, shLZ: 0.25, elL: -1.1, hoL: 0.85, hsL: 0.3 }));
    return own(t < 0.07 ? F : lerpPose(F, C, ease(clamp((t - 0.07) / 0.06, 0, 1))));
  },

  // Q 螺旋丸・命中：撞上的同一個 tick 就爆炸、擊飛，所以 t=0 立刻把球按出去：0.025 秒內右臂推到比定格再多伸一點
  // （上身也多壓進去），0.06 秒回到定格；0.2 秒前整條右臂和上身一起抖（壓著螺旋丸磨），0.33 秒收回架式
  atk3_Q({ t, P, base }) {
    const W = P({ hipsY: -0.22, hipsZ: 0.05, hipsRX: 0.15, hipsRY: 0.15, torsoX: 0.55, torsoY: 0.3,
      shRX: 1.1, shRZ: 0.8, shRY: -1.4, elR: -0.5, wrR: -0.4, shLX: -1.0, shLZ: 0.2, elL: -1.3,
      thLX: -0.5, knL: 1.0, thRX: 0.4, knR: 0.8 });
    const tr = t < 0.2 ? Math.sin(t * 70) : 0;
    const S = P({ hipsY: -0.26, hipsZ: 0.24, hipsRX: 0.12, hipsRY: 0.3, torsoX: 0.5 + 0.03 * tr, torsoY: 0.5, torsoZ: -0.05,
      shRX: -1.95 + 0.04 * tr, shRZ: 0.55, shRY: 0, elR: -0.08 - 0.04 * tr, clR: 0.3, wrR: -1.35,
      shLX: -1.75, shLZ: -0.6, elL: -0.45,
      thRX: -1.05, thRZ: 0.25, knR: 1.15, thLX: 0.85, thLZ: 0.3, knL: 0.2 });
    const X = { ...S, shRX: -2.05, hipsZ: 0.28, torsoX: 0.58, elR: -0.04 }; // 按進去的過衝
    face(W); face(S); face(X);
    let p;
    if (t < 0.025) { const u = t / 0.025; p = lerpPose(W, X, u * (2 - u)); } // 從衝刺的手勢直接推出（先快後慢）
    else if (t < 0.06) p = lerpPose(X, S, ease((t - 0.025) / 0.035));
    else if (t < 0.2) p = S; // 壓著螺旋丸磨（隨 tr 抖動）
    else p = lerpPose(S, base, ease(clamp((t - 0.2) / 0.13, 0, 1)));
    const r = ease(clamp((t - 0.2) / 0.13, 0, 1)), mix = (a, b) => a + (b - a) * r; // 收回時手形也回架式
    p.hoR = mix(0.85, base.hoR); p.hsR = mix(0.9, base.hsR); p.hoL = mix(0.9, base.hoL); p.hsL = mix(0.6, base.hsL);
    return own(p);
  },

  // W 影分身之術：兩手先往外一甩（預備），再「啪」地在胸前交叉成十字印（兩掌半開、右手疊在左手上），
  // 雙腳站開、頭微低；0.25 秒分身冒出來時身體一沉、點一下頭，0.27～0.3 鬆開印回架式
  cast_W({ t, P, base }) {
    const tr = Math.sin(t * 55) * 0.012;
    const pop = Math.sin(Math.PI * clamp((t - 0.21) / 0.06, 0, 1)); // 0.21～0.27 的一下
    const O = P({ hipsY: -0.2, hipsRY: 0, torsoX: 0.3, torsoY: 0, headX: -0.1, headY: 0,
      shLX: -0.45, shLZ: 1.25, elL: -0.7, shRX: -0.45, shRZ: 1.25, elR: -0.7,
      thLX: -0.4, thLZ: 0.42, knL: 0.9, thRX: 0.1, thRZ: 0.42, knR: 0.8, hoL: 1, hsL: 0.8, hoR: 1, hsR: 0.8 });
    const S = P({ hipsY: -0.14 - 0.06 * pop, hipsZ: 0, hipsRX: 0, hipsRY: 0, hipsRZ: 0, torsoX: 0.12 + tr + 0.04 * pop, torsoY: 0, torsoZ: 0,
      headX: 0.14 + 0.14 * pop, headY: 0, headZ: 0,
      shLX: -0.75, shLZ: -0.5, shLY: -0.4, elL: -1.85, shRX: -0.85, shRZ: -0.62, shRY: -0.4, elR: -1.85, wrL: 0.3, wrR: 0.3,
      thLX: -0.25, thLZ: 0.48, knL: 0.55 + 0.06 * pop, thRX: -0.05, thRZ: 0.48, knR: 0.5 + 0.06 * pop,
      hoL: 0.6, hsL: 0.1, hoR: 0.6, hsR: 0.1 });
    if (t < 0.04) return own(lerpPose(base, O, ease(t / 0.04)));
    if (t < 0.07) return own(O); // 兩手甩開停一下，才看得出預備
    if (t < 0.27) return own(lerpPose(O, S, ease(clamp((t - 0.07) / 0.03, 0, 1))));
    return own(lerpPose(S, base, ease(clamp((t - 0.27) / 0.03, 0, 1))));
  },

  // E 替身術：落地壓低成蹲姿、雙手在胸骨前合掌結印。注意：E 的 vanish 動作 0.12 秒內 main.js 會把模型整個藏起來，
  // 現身時已經回到待機，所以實機看不到這個姿勢；只留給檢視器，要有現身的一拍得在 combat.js 加一段看得見的動作
  vanish_E({ t, P, base }) {
    const S = P({ hipsY: -0.4, hipsRX: 0, hipsRY: 0.1, torsoX: 0.35, torsoY: 0, headX: -0.05, headY: -0.05,
      shLX: -0.65, shLZ: -0.5, shLY: -0.3, elL: -2.3, shRX: -0.65, shRZ: -0.5, shRY: -0.3, elR: -2.3, // 掌心相合、指尖朝上
      thLX: -1.1, thLZ: 0.35, knL: 1.8, thRX: -0.15, thRZ: 0.3, knR: 1.75, spin: 0,
      hoL: 1, hsL: 0.3, hoR: 1, hsR: 0.3 });
    const dip = { ...S, hipsY: -0.5 }; // 先多壓一點再站穩（落地的緩衝）
    if (t < 0.03) return own(lerpPose(base, dip, ease(t / 0.03)));
    return own(lerpPose(dip, S, ease(clamp((t - 0.03) / 0.05, 0, 1))));
  },

  // R 風遁・螺旋手裏劍：蹲身蓄力 → 右臂往斜上方高舉、手腕往後折讓掌心朝天撐住頭頂的手裏劍（手臂離開頭髮，從上方看得到）→
  // 後仰拉滿 → 0.34～0.45 越來越快地甩下，0.45 秒出手時手剛好在斜前上方約 1.6 公尺（和手裏劍出現的位置一致）→
  // 0.5 跨步送到底 → 0.55（動作結束）前收回架式
  overhead_R({ t, P, base }) {
    const crouch = P({ hipsY: -0.32, torsoX: 0.5, torsoY: -0.2, headX: -0.4, shRX: -1.2, shRZ: 0.3, elR: -1.2, shLX: -0.6, shLZ: 0.5, elL: -1.2,
      thLX: -0.75, thLZ: 0.42, knL: 1.45, thRX: 0.3, thRZ: 0.4, knR: 1.4 });
    const hold = P({ hipsY: -0.12, hipsRY: -0.1, torsoX: -0.12, torsoY: -0.25, torsoZ: 0.1, headX: -0.25,
      shRX: -2.8, shRZ: 0.6, shRY: -1.2, elR: -0.05, wrR: -1.5, shLX: -0.4, shLZ: 1.1, elL: -0.5,
      thLX: -0.5, thLZ: 0.45, knL: 0.7, thRX: 0.3, thRZ: 0.42, knR: 0.6 });
    const cock = P({ hipsY: -0.15, hipsZ: -0.06, hipsRY: -0.35, torsoX: -0.3, torsoY: -0.65, torsoZ: 0.12, headX: -0.15,
      shRX: -3.05, shRZ: 0.55, shRY: -1.2, elR: -0.35, wrR: -1.3, shLX: -1.3, shLZ: 0.4, elL: -0.4,
      thLX: -0.6, thLZ: 0.45, knL: 0.75, thRX: 0.45, thRZ: 0.4, knR: 0.65 });
    const thr = P({ hipsY: -0.18, hipsZ: 0.26, hipsRY: 0.35, torsoX: 0.4, torsoY: 0.7, torsoZ: -0.08, headX: -0.3,
      shRX: -2.1, shRZ: 0.6, shRY: -0.4, elR: -0.05, wrR: -0.3, clR: 0.3, shLX: 0.4, shLZ: 0.5, elL: -1.2,
      thLX: -0.95, thLZ: 0.35, knL: 1.0, thRX: 0.7, thRZ: 0.35, knR: 0.25 });
    const fol = P({ hipsY: -0.24, hipsZ: 0.34, hipsRY: 0.5, torsoX: 0.75, torsoY: 0.95, torsoZ: -0.12, headX: -0.45,
      shRX: -0.6, shRZ: 0.45, elR: -0.1, wrR: -0.2, shLX: 0.65, shLZ: 0.55, elL: -1.3,
      thLX: -1.05, thLZ: 0.35, knL: 1.15, thRX: 0.8, thRZ: 0.35, knR: 0.3 });
    for (const q of [crouch, hold, cock, thr, fol]) face(q);
    let p;
    if (t < 0.07) p = lerpPose(base, crouch, ease(t / 0.07));
    else if (t < 0.14) p = lerpPose(crouch, hold, ease((t - 0.07) / 0.07));
    else if (t < 0.24) p = hold; // 掌心朝天撐住手裏劍停 0.1 秒（快速跟隨要 ≥60 ms 才看得出來）
    else if (t < 0.34) p = lerpPose(hold, cock, ease((t - 0.24) / 0.1));
    else if (t < 0.45) { const u = (t - 0.34) / 0.11; p = lerpPose(cock, thr, u * u * (2 - u)); } // 出手越來越快
    else if (t < 0.5) p = lerpPose(thr, fol, ease((t - 0.45) / 0.05));
    else p = lerpPose(fol, base, ease(clamp((t - 0.5) / 0.05, 0, 1))); // 動作結束前收回架式
    // 撐著手裏劍時五指全張；擲出後放鬆
    const r = t < 0.5 ? 0 : ease(clamp((t - 0.5) / 0.05, 0, 1)); // 收回時手形也回架式
    const mix = (a, b) => a + (b - a) * r;
    p.hoR = mix(t < 0.07 ? 0.6 : 1, base.hoR); p.hsR = mix(t < 0.45 ? 1 : 0.8, base.hsR); p.hoL = mix(0.7, base.hoL); p.hsL = mix(0.5, base.hsL);
    return own(p);
  },

  // 勝利：雙手抱在後腦勺、身體歪一邊的招牌笑
  win({ t, P }) {
    const b = Math.sin(t * 3);
    return own(P({ hipsY: -0.01, hipsRY: 0, hipsRZ: 0.08 + 0.02 * b, torsoX: -0.12, torsoY: 0.1, torsoZ: -0.08, headX: -0.15, headY: -0.1, headZ: 0.1 + 0.04 * b,
      shLX: -2.5, shLZ: 1.0, elL: -2.45, shRX: -2.5, shRZ: 1.0, elR: -2.45,
      thLX: -0.12, thLZ: 0.16, knL: 0.08, thRX: 0.1, thRZ: 0.2, knR: 0.12,
      hoL: 0.8, hsL: 0.3, hoR: 0.8, hsR: 0.3 }));
  },
};

