// kakashi 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（strike、lerpPose、ease、clamp、IMPACT…）。
//
// 卡卡西：遠程忍者。待機是駝背看書、一手插口袋；普攻是手裏劍／苦無三連投；
// Q 水龍彈＝快速結印後單手指揮水龍；W 追牙之術＝高舉手掌拍地通靈；E 雷切＝握腕集雷、低身衝刺、貫手突刺；R 神威＝手掩寫輪眼、伸手扭曲空間。
// 時間對齊 combat.js：普攻 0.4／0.42／0.48 秒（出手 0.12／0.14／0.2）、Q 0.32 秒（0.14 噴出）、W 0.4 秒（0.25 咬住）、
// E 衝刺約 0.25 秒、撞到人接 atk3 0.35 秒、R 0.5 秒（0.45 發動）。每個動作都在時長內收完。
import { blank, strike, lerpPose, ease, clamp, IMPACT } from '../pose-kit.js';

// 多關鍵幀時間軸：frames = [[時間, 姿勢], …]，相鄰兩幀之間用 ease 內插
function keyed(t, frames) {
  if (t <= frames[0][0]) return lerpPose(frames[0][1], frames[0][1], 0);
  for (let i = 1; i < frames.length; i++) {
    const [t1, b] = frames[i];
    if (t < t1) { const [t0, a] = frames[i - 1]; return lerpPose(a, b, ease((t - t0) / (t1 - t0))); }
  }
  const last = frames[frames.length - 1][1];
  return lerpPose(last, last, 0);
}
const own = (p) => { p.ownHands = true; return p; }; // 手形自己決定，不套共用的張手表

export default {
  // 待機：微駝背低頭看書（右手在胸前托書、掌心朝上、拇指壓著書頁），左手插在褲袋，重心落在右腳；偶爾左手抽出來翻頁
  stance({ t }) {
    const p = blank();
    const br = Math.sin(t * 2.2), sw = Math.sin(t * 0.9);
    Object.assign(p, {
      hipsY: -0.03 - 0.008 * br, hipsRY: 0.12, hipsRZ: 0.07 + 0.015 * sw,
      torsoX: 0.2 + 0.012 * br, torsoY: 0.1, torsoZ: -0.06, headX: 0.48, headY: -0.12, headZ: 0.06 + 0.02 * sw,
      shLX: 0.25, shLZ: 0.15, elL: -0.7, wrL: 0.2, hoL: 0.1, hsL: 0,
      shRX: -0.55, shRZ: -0.15, elR: -1.65, wrR: -0.6, hoR: 0.55, hsR: 0.75,
      thLX: -0.14, thLZ: 0.1, knL: 0.16, thRX: 0.06, thRZ: 0.05, knR: 0.04,
    });
    // 翻頁：每 6.5 秒左手離開口袋，到書前撥一下再收回
    const u = t % 6.5;
    if (u > 5.5 && u < 6.3) {
      const k = Math.sin(Math.PI * (u - 5.5) / 0.8);
      p.shLX += (-0.55 - p.shLX) * k; p.shLZ += (-0.3 - p.shLZ) * k; p.elL += (-1.6 - p.elL) * k; p.hoL += (0.85 - p.hoL) * k; p.hsL += 0.5 * k;
      p.wrR += 0.15 * k; p.headX -= 0.05 * k;
    }
    return own(p);
  },

  // 普攻一：右手側甩手裏劍——手先橫收到左胸前（不是耳邊），扭腰把手平平甩到右前方，放手後手掌張開
  atk1({ t, base, P }) {
    const W = P({ hipsY: -0.08, hipsRY: -0.25, torsoX: 0.2, torsoY: -0.8, headX: 0, headY: 0.6,
      shRX: -0.9, shRZ: -0.9, shRY: -1.2, elR: -1.8, wrR: 0.6, hoR: 0.2, hsR: 0.3, shLX: -0.3, shLZ: 0.4, elL: -1.2, hoL: 0.2,
      thLX: -0.2, knL: 0.35, knR: 0.3 });
    const S = P({ hipsY: -0.12, hipsZ: 0.14, hipsRY: 0.35, torsoX: 0.3, torsoY: 0.75, headX: -0.05, headY: -0.7,
      shRX: -1.5, shRZ: 0.45, elR: -0.02, wrR: -0.3, hoR: 0.9, hsR: 0.8, shLX: 0.4, shLZ: 0.35, elL: -1.0, hoL: 0.2,
      thLX: -0.55, thLZ: 0.15, knL: 0.6, thRX: 0.45, thRZ: 0.08, knR: 0.2 });
    return own(strike(t, IMPACT.atk1, base, W, S, 0.3));
  },

  // 普攻二：左手過肩擲苦無——手拉到腦後、反向扭身，右腳踏出整個人壓過去
  atk2({ t, base, P }) {
    const W = P({ hipsY: -0.04, hipsRY: 0.2, torsoX: 0, torsoY: 0.6, torsoZ: -0.12, headX: -0.05, headY: -0.5,
      shLX: -2.6, shLZ: 0.35, elL: -1.9, wrL: 0.4, hoL: 0.2, hsL: 0.2, shRX: -1.0, shRZ: 0.2, elR: -1.4, hoR: 0.4,
      thLX: -0.35, knL: 0.3, thRX: 0.2, knR: 0.4 });
    const S = P({ hipsY: -0.14, hipsZ: 0.14, hipsRY: -0.2, torsoX: 0.45, torsoY: -0.5, torsoZ: 0.05, headX: -0.1, headY: 0.45,
      shLX: -1.95, shLZ: 0.3, elL: -0.05, wrL: -0.4, hoL: 0.95, hsL: 0.8, shRX: 0.5, shRZ: 0.3, elR: -0.8, hoR: 0.3,
      thRX: -0.65, thRZ: 0.15, knR: 0.65, thLX: 0.5, thLZ: 0.08, knL: 0.15 });
    return own(strike(t, IMPACT.atk2, base, W, S, 0.34));
  },

  // 普攻三：深蹲、兩前臂在胸前交叉成 X（上臂內旋讓前臂斜著交叉，右手低一點疊在前面；手握苦無），小跳步騰空時往兩側甩開撒出一排苦無，落地屈膝緩衝
  atk3({ t, P }) {
    const W = P({ hipsY: -0.3, hipsRY: 0, torsoX: 0.5, torsoY: 0, torsoZ: 0, headX: -0.25, headY: 0,
      shLX: -1.65, shLY: -0.75, shLZ: -0.4, elL: -1.75, wrL: 0.2, hoL: 0.15, hsL: 0.1, shRX: -1.45, shRY: -0.75, shRZ: -0.4, elR: -1.75, wrR: 0.2, hoR: 0.15, hsR: 0.1,
      thLX: -0.75, thLZ: 0.2, knL: 1.35, thRX: 0.25, thRZ: 0.16, knR: 1.25 });
    const A = P({ hipsY: 0.2, hipsZ: 0.16, hipsRY: 0, torsoX: 0.18, torsoY: 0, torsoZ: 0, headX: -0.15, headY: 0,
      shLX: -1.7, shLZ: 0.85, elL: -0.05, wrL: -0.3, hoL: 1, hsL: 0.9, shRX: -1.7, shRZ: 0.85, elR: -0.05, wrR: -0.3, hoR: 1, hsR: 0.9,
      thLX: -0.55, thLZ: 0.12, knL: 0.45, thRX: 0.3, thRZ: 0.08, knR: 0.45, anL: 0.5, anR: 0.5, toL: 0.5, toR: 0.5 });
    const L = P({ ...A, hipsY: -0.16, hipsZ: 0.22, torsoX: 0.32, headX: -0.2, shLX: -1.45, shRX: -1.45, shLZ: 0.95, shRZ: 0.95,
      thLX: -0.75, knL: 0.85, thRX: 0.45, knR: 0.35, toL: 0, toR: 0.2 });
    return own(keyed(t, [[0, P({})], [0.07, W], [0.12, W], [0.165, A], [0.21, A], [0.26, L], [0.32, L], [0.46, P({})]]));
  },

  // Q 水遁・水龍彈（cast，0.14 秒噴出）：壓低身體連結兩個印（雙手碰在一起，手形一個換一個），
  // 噴出那一刻右手往前上方一指操縱水龍，左手收到下巴下方結單手印；0.32 秒內收回
  cast_Q({ t, P }) {
    const low = { hipsY: -0.14, hipsRY: 0, torsoX: 0.18, torsoY: 0.1, torsoZ: 0, headX: 0.1, headY: -0.05,
      thLX: -0.35, thLZ: 0.18, knL: 0.55, thRX: 0.25, thRZ: 0.15, knR: 0.5 };
    // 兩個印依序在小腹（低、蹲深一點）→下巴（高）結，兩手始終碰在一起；每印換腕角與手形（一手握一手張），外輪廓跟著跳
    const at = (sx, el) => ({ shLX: sx, shRX: sx, shLZ: -0.55, shRZ: -0.55, elL: el, elR: el });
    const SEALS = [
      P({ ...low, ...at(-0.35, -1.35), hipsY: -0.2, knL: 0.7, knR: 0.65, wrL: 0.6, wrR: -0.6, hoL: 0.9, hsL: 0.2, hoR: 0.1, hsR: 0 }),
      P({ ...low, ...at(-1.35, -1.6), headX: 0.02, wrL: -0.6, wrR: 0.6, hoL: 0.1, hsL: 0, hoR: 0.9, hsR: 0.2 }),
    ];
    const S = P({ hipsY: -0.2, hipsZ: 0.12, hipsRY: 0.2, torsoX: 0.3, torsoY: 0.6, torsoZ: 0, headX: -0.2, headY: -0.55,
      shRX: -2.35, shRZ: 0.05, elR: -0.05, wrR: 0.15, hoR: 1, hsR: 0.15, clR: 0.2,
      shLX: -1.1, shLZ: -0.8, elL: -2.0, wrL: 0, hoL: 0.9, hsL: 0,
      thLX: -0.7, thLZ: 0.22, knL: 0.8, thRX: 0.55, thRZ: 0.15, knR: 0.25 });
    // 第一印從 0 秒就是目標（交給平滑帶過去），0.055 秒換第二印；每印約 50 毫秒才看得出來
    if (t < 0.105) return own(SEALS[t < 0.055 ? 0 : 1]);
    // 0.125 秒打直（含平滑約 15 毫秒後到位），0.14 秒噴出那一刻手已經指出去
    return own(keyed(t, [[0.105, SEALS[1]], [0.125, S], [0.24, S], [0.32, P({})]]));
  },

  // W 土遁・追牙之術（overhead，0.25 秒咬住）：右手往斜上方高舉（從上方也看得到）、左手在胸前捏卷軸，
  // 接著單膝跪下，雙手疊在一起把卷軸拍進地面，忍犬由此竄出；0.4 秒內站回來。
  // 土牙在出招當下（t=0）就從腳邊開始竄出，所以第 0 幀就舉手、0.055 秒往下拍，約 0.1 秒雙掌落地，跪姿一直撐過 0.25 秒咬住
  overhead_W({ t, P }) {
    const W = P({ hipsY: 0.06, hipsRY: 0, hipsRZ: 0, torsoX: -0.2, torsoY: -0.2, torsoZ: 0, headX: -0.25, headY: 0.1,
      shRX: -2.3, shRZ: 1.2, elR: -0.3, wrR: 0.3, hoR: 1, hsR: 0.7,
      shLX: -0.5, shLZ: -0.7, elL: -1.4, wrL: 0, hoL: 0.2, hsL: 0.2,
      thLX: -0.45, thLZ: 0.1, knL: 0.55, thRX: 0.1, thRZ: 0.08, knR: 0.1 });
    const S = P({ hipsY: -0.52, hipsZ: 0.1, hipsRX: 0.15, hipsRY: 0, hipsRZ: 0, torsoX: 1.1, torsoY: 0.2, torsoZ: 0, headX: -0.45, headY: -0.1,
      shRX: -1.4, shRZ: 0.1, elR: -0.1, wrR: -1.0, hoR: 1, hsR: 0.9,
      shLX: -1.3, shLZ: -0.15, elL: -0.3, wrL: -0.9, hoL: 1, hsL: 0.9,
      thLX: -1.3, thLZ: 0.2, knL: 2.0, thRX: 0.25, thRZ: 0.1, knR: 1.9, toR: 0.4 });
    return own(keyed(t, [[0, W], [0.055, W], [0.095, S], [0.3, S], [0.4, P({})]]));
  },

  // E 雷切・衝刺（dash，約 0.25 秒）：一蹬腳就衝出去（不站著蹲），左手握右腕把雷切壓在右胯前，
  // 身體壓得很低大步狂奔，後半段把帶雷的右手放低拖在身後（手不高過胯）
  dash_E({ t, P }) {
    const grip = { shRX: -0.2, shRZ: -0.05, elR: -1.6, wrR: 0.4, hoR: 0.75, hsR: 0.9, // 左手扣住右腕，雷切壓在右胯前下方
      shLX: -0.3, shLZ: -0.9, elL: -1.2, wrL: 0, hoL: 0.35, hsL: 0.5 };
    const G = P({ hipsY: -0.18, hipsZ: 0.08, hipsRX: 0.4, hipsRY: 0, torsoX: 0.75, torsoY: 0, torsoZ: 0, headX: -0.45, headY: -0.15,
      ...grip, thLX: -0.9, thLZ: 0.12, knL: 1.1, thRX: 0.6, thRZ: 0.1, knR: 0.2 });
    const s = Math.sin(t * 30 + 0.6), c = Math.cos(t * 30 + 0.6);
    const run = { hipsY: -0.2, hipsRX: 0.5, hipsRY: -0.12 * s, torsoX: 0.8, torsoY: 0.08 * s, torsoZ: 0, headX: -0.75, headY: 0,
      thLX: -1.1 * s - 0.4, thLZ: 0.08, knL: 0.4 + 1.1 * Math.max(0, -c), thRX: 1.1 * s - 0.4, thRZ: 0.08, knR: 0.4 + 1.1 * Math.max(0, c) };
    const R1 = P({ ...run, ...grip });
    const R2 = P({ ...run, shRX: 0.05, shRZ: 0.45, elR: -0.05, wrR: -0.4, hoR: 0.75, hsR: 0.9,
      shLX: -1.1, shLZ: -0.1, elL: -1.5, wrL: 0, hoL: 0, hsL: 0 });
    if (t < 0.03) return own(G);
    const R = lerpPose(R1, R2, ease(clamp((t - 0.1) / 0.08, 0, 1)));
    return own(lerpPose(G, R, ease(clamp((t - 0.03) / 0.04, 0, 1))));
  },

  // E 雷切・命中（撞到敵人時接 atk3，0.35 秒）：命中、火花與雷光都在 t=0，所以第 0 幀就以突刺為目標，從拖在身後的右手一口氣甩出貫手，胸口高度打直；右腳弓步、左手甩到身後平衡
  atk3_E({ t, P }) {
    const S = P({ hipsY: -0.32, hipsZ: 0.32, hipsRY: 0.1, hipsRX: 0.1, torsoX: 0.5, torsoY: 0.3, torsoZ: 0, headX: -0.35, headY: -0.25,
      shRX: -2.4, shRZ: 0.7, elR: 0, wrR: 0, hoR: 1, hsR: 0.15, clR: 0.3,
      shLX: 0.9, shLZ: 0.35, elL: -0.5, hoL: 0.4, hsL: 0.3,
      thRX: -1.05, thRZ: 0.15, knR: 1.25, thLX: 0.85, thLZ: 0.1, knL: 0.2, toL: 0.4 });
    // 衝刺最後的拖手姿勢就是預備；從第 0 幀就以「多送一點」的突刺為目標，平滑約 30 毫秒甩到位，和火花同時
    const S2 = Object.assign(lerpPose(S, S, 0), { hipsZ: S.hipsZ + 0.06, torsoX: S.torsoX + 0.12, shRX: S.shRX - 0.08 });
    return own(keyed(t, [[0, S2], [0.06, S2], [0.12, S], [0.2, S], [0.34, P({})]]));
  },

  // R 神威（cast，0.45 秒發動）：右手橫過臉遮住左眼（寫輪眼）、左手對準目標張開；
  // 用力時全身發顫、頭往前壓、左手慢慢收攏，0.44 秒猛地前頂、左拳擰回胸前把空間扭進去，停住到 0.5 秒
  cast_R({ t, P }) {
    const A = P({ hipsY: -0.17, hipsRY: -0.15, hipsRZ: 0, torsoX: 0.12, torsoY: -0.25, torsoZ: 0, headX: -0.1, headY: 0.35,
      shRX: -1.75, shRZ: -1.0, shRY: -0.5, elR: -1.9, wrR: -0.2, hoR: 0.9, hsR: 0.6, clR: 0.15,
      shLX: -1.5, shLZ: 0.2, elL: -0.1, wrL: -0.7, hoL: 1, hsL: 0.7,
      thLX: -0.6, thLZ: 0.28, knL: 0.65, thRX: 0.45, thRZ: 0.25, knR: 0.4 });
    const strain = clamp((t - 0.18) / 0.22, 0, 1);
    const B = Object.assign(lerpPose(A, A, 0), { torsoX: A.torsoX + 0.1, headX: A.headX + 0.15, hipsZ: 0.03,
      hoL: 0.45, wrL: -0.3, elL: -0.35 });
    const F = Object.assign(lerpPose(A, A, 0), { hipsY: -0.22, hipsZ: 0.15, torsoX: A.torsoX + 0.35, headX: A.headX + 0.3,
      shLX: -1.1, shLZ: 0.1, elL: -1.3, wrL: 1.0, hoL: 0, hsL: 0,
      shRX: -1.2, shRZ: -0.3, elR: -1.8, wrR: 0, hoR: 0.6, hsR: 0.4, clR: 0,
      thLX: -0.75, knL: 0.8 });
    if (t < 0.18) return own(lerpPose(P({}), A, ease(t / 0.18)));
    if (t < 0.4) {
      const p = lerpPose(A, B, ease(strain));
      const tr = Math.sin(t * 34) * strain; // 發顫：用力越久抖越大
      p.torsoX += 0.08 * tr; p.headX += 0.04 * tr; p.hipsZ += 0.02 * tr;
      return own(p);
    }
    return own(keyed(t, [[0.4, B], [0.44, F], [0.5, F]]));
  },

  // 勝利：招牌的「喲」——右手舉到頭側（不被頭髮擋住）掌心朝鏡頭（上臂外旋）大大揮兩下、歪頭瞇眼笑，左手還插在口袋（同待機的口袋值）
  win({ t, P }) {
    const w = Math.sin(t * 7);
    return own(P({ hipsY: -0.02, hipsRY: 0, hipsRZ: 0.06, torsoX: 0.05, torsoY: -0.1, torsoZ: -0.04, headX: -0.05, headY: -0.1, headZ: 0.2,
      shRX: -1.5, shRZ: 1.35, shRY: 0.3, elR: -1.3 + 0.35 * w, wrR: 0.45 * w, hoR: 1, hsR: 0.9,
      shLX: 0.25, shLZ: 0.15, elL: -0.7, wrL: 0.2, hoL: 0.1, hsL: 0 }));
  },
};
