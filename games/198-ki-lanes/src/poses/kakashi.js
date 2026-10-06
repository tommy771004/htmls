// kakashi 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（strike、lerpPose、ease、clamp、IMPACT…）。
//
// 卡卡西：遠程忍者。待機是駝背看書、一手插口袋；普攻是手裏劍／苦無三連投；
// Q 水龍彈＝快速結印後單手指揮水龍；W 追牙之術＝高舉手掌拍地通靈；E 雷切＝握腕集雷、低身衝刺、貫手突刺；R 神威＝手掩寫輪眼、伸手扭曲空間。
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
  // 待機：微駝背低頭看書（右手托書、拇指壓著書頁），左手插口袋，重心落在右腳；偶爾左手抽出來翻頁
  stance({ t }) {
    const p = blank();
    const br = Math.sin(t * 2.2), sw = Math.sin(t * 0.9);
    Object.assign(p, {
      hipsY: -0.03 - 0.008 * br, hipsRY: 0.12, hipsRZ: 0.07 + 0.015 * sw,
      torsoX: 0.2 + 0.012 * br, torsoY: 0.1, torsoZ: -0.06, headX: 0.3, headY: -0.12, headZ: 0.06 + 0.02 * sw,
      shLX: 0.12, shLZ: 0.1, elL: -0.35, wrL: 0.2, hoL: 0.15, hsL: 0,
      shRX: -0.85, shRZ: 0.05, elR: -2.05, wrR: -0.3, hoR: 0.55, hsR: 0.75,
      thLX: -0.14, thLZ: 0.1, knL: 0.16, thRX: 0.06, thRZ: 0.05, knR: 0.04,
    });
    // 翻頁：每 6.5 秒左手離開口袋，到書前撥一下再收回
    const u = t % 6.5;
    if (u > 5.5 && u < 6.3) {
      const k = Math.sin(Math.PI * (u - 5.5) / 0.8);
      p.shLX += (-0.8 - p.shLX) * k; p.shLZ += (-0.25 - p.shLZ) * k; p.elL += (-1.9 - p.elL) * k; p.hoL += (0.75 - p.hoL) * k;
      p.wrR += 0.15 * k; p.headX -= 0.05 * k;
    }
    return own(p);
  },

  // 普攻一：右手側甩手裏劍——手先收到左肩，扭腰橫甩，放手後手掌張開
  atk1({ t, base, P }) {
    const W = P({ hipsY: -0.08, hipsRY: -0.25, torsoX: 0.2, torsoY: -0.8, headX: 0, headY: 0.6,
      shRX: -1.3, shRZ: -0.8, elR: -2.3, wrR: 0.5, hoR: 0.25, hsR: 0.3, shLX: -0.3, shLZ: 0.4, elL: -1.2, hoL: 0.2,
      thLX: -0.2, knL: 0.35, knR: 0.3 });
    const S = P({ hipsY: -0.12, hipsZ: 0.14, hipsRY: 0.35, torsoX: 0.3, torsoY: 0.75, headX: -0.05, headY: -0.7,
      shRX: -1.65, shRZ: 0.45, elR: -0.02, wrR: -0.3, hoR: 0.9, hsR: 0.8, shLX: 0.4, shLZ: 0.35, elL: -1.0, hoL: 0.2,
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

  // 普攻三：雙手交叉蓄勢後往兩側甩開，扇形撒出一排苦無（小跳步踏前）
  atk3({ t, base, P }) {
    const W = P({ hipsY: -0.24, hipsRY: 0, torsoX: 0.5, torsoY: -0.15, torsoZ: 0, headX: -0.25, headY: 0.05,
      shLX: -1.3, shLZ: -0.55, elL: -1.75, wrL: 0.3, hoL: 0.3, hsL: 0.2, shRX: -1.4, shRZ: -0.6, elR: -1.6, wrR: 0.3, hoR: 0.3, hsR: 0.2,
      thLX: -0.6, thLZ: 0.18, knL: 1.15, thRX: 0.2, thRZ: 0.14, knR: 1.05 });
    const S = P({ hipsY: 0.05, hipsZ: 0.2, hipsRY: 0, torsoX: 0.22, torsoY: 0, torsoZ: 0, headX: -0.15, headY: 0,
      shLX: -1.75, shLZ: 0.75, elL: -0.05, wrL: -0.3, hoL: 1, hsL: 0.9, shRX: -1.75, shRZ: 0.75, elR: -0.05, wrR: -0.3, hoR: 1, hsR: 0.9,
      thLX: -0.7, thLZ: 0.12, knL: 0.45, thRX: 0.45, thRZ: 0.08, knR: 0.05, toR: 0.3 });
    return own(strike(t, IMPACT.atk3, base, W, S, 0.42));
  },

  // Q 水遁・水龍彈（cast，0.14 秒噴出）：壓低身體在胸前飛快結印，最後右手往前一指放出水龍，左手留在胸前單手印
  cast_Q({ t, P }) {
    const seal = clamp((t - 0.02) / 0.1, 0, 1) < 1 && t > 0.03 ? 0.5 + 0.5 * Math.sin(t * 80) : 0;
    const A = P({ hipsY: -0.14, hipsRY: 0, torsoX: 0.18, torsoY: 0.1, torsoZ: 0, headX: 0.1, headY: -0.05,
      shLX: -1.05 - 0.3 * seal, shLZ: -0.5, elL: -2.0 - 0.3 * seal, wrL: -0.4 * seal, hoL: 0.6 - 0.3 * seal, hsL: 0.15,
      shRX: -1.05 - 0.3 * seal, shRZ: -0.5, elR: -2.0 - 0.3 * seal, wrR: 0.4 * seal - 0.2, hoR: 0.6 - 0.3 * seal, hsR: 0.15,
      thLX: -0.35, thLZ: 0.18, knL: 0.55, thRX: 0.25, thRZ: 0.15, knR: 0.5 });
    const S = P({ hipsY: -0.2, hipsZ: 0.12, hipsRY: 0.2, torsoX: 0.3, torsoY: 0.6, torsoZ: 0, headX: -0.2, headY: -0.55,
      shRX: -2.35, shRZ: 0.05, elR: -0.05, wrR: 0.15, hoR: 1, hsR: 0.15, clR: 0.2,
      shLX: -1.0, shLZ: -0.45, elL: -2.1, wrL: 0, hoL: 0.6, hsL: 0.1,
      thLX: -0.7, thLZ: 0.22, knL: 0.8, thRX: 0.55, thRZ: 0.15, knR: 0.25 });
    if (t < 0.12) return own(t < 0.04 ? lerpPose(P({}), A, ease(t / 0.04)) : A);
    return own(keyed(t, [[0.12, A], [0.155, S], [0.27, S], [0.42, P({})]]));
  },

  // W 土遁・追牙之術（overhead，0.25 秒咬住）：踮腳高舉手掌、左手捏卷軸，接著單膝跪下把手掌拍進地面，忍犬由此竄出
  overhead_W({ t, P }) {
    const W = P({ hipsY: 0.02, hipsRY: 0, hipsRZ: 0, torsoX: -0.15, torsoY: -0.2, torsoZ: 0, headX: -0.2, headY: 0.1,
      shRX: -2.75, shRZ: 0.3, elR: -0.6, wrR: 0.3, hoR: 1, hsR: 0.7,
      shLX: -1.2, shLZ: -0.2, elL: -1.6, hoL: 0.3, hsL: 0.3,
      thLX: -0.45, thLZ: 0.1, knL: 0.55, thRX: 0.1, thRZ: 0.08, knR: 0.1 });
    const S = P({ hipsY: -0.42, hipsZ: 0.1, hipsRX: 0.15, hipsRY: 0, hipsRZ: 0, torsoX: 0.95, torsoY: 0.2, torsoZ: 0, headX: -0.45, headY: -0.1,
      shRX: -1.5, shRZ: 0.1, elR: -0.1, wrR: -1.0, hoR: 1, hsR: 0.9,
      shLX: -0.4, shLZ: 0.3, elL: -1.0, hoL: 0.3, hsL: 0.3,
      thLX: -1.3, thLZ: 0.2, knL: 2.0, thRX: 0.25, thRZ: 0.1, knR: 1.9, toR: 0.4 });
    return own(keyed(t, [[0, P({})], [0.09, W], [0.17, S], [0.32, S], [0.5, P({})]]));
  },

  // E 雷切・衝刺（dash）：起步時左手握住右腕集雷，接著壓低身體狂奔，帶雷的右手拖在身後
  dash_E({ t, P }) {
    const G = P({ hipsY: -0.2, hipsRY: 0, torsoX: 0.5, torsoY: 0.35, torsoZ: 0, headX: -0.35, headY: -0.15,
      shRX: -0.7, shRZ: 0.15, elR: -0.4, wrR: 0.3, hoR: 0.75, hsR: 0.9,
      shLX: -0.75, shLZ: -0.55, elL: -1.0, hoL: 0.35, hsL: 0.5,
      thLX: -0.5, thLZ: 0.15, knL: 0.9, thRX: 0.3, thRZ: 0.12, knR: 0.7 });
    const s = Math.sin(t * 30), c = Math.cos(t * 30);
    const R = P({ hipsY: -0.2, hipsRX: 0.4, hipsRY: 0, torsoX: 0.7, torsoY: 0.2 * s, torsoZ: 0, headX: -0.65, headY: 0,
      shRX: 0.6, shRZ: 0.5, elR: -0.2, wrR: 0.2, hoR: 0.75, hsR: 0.9,
      shLX: -1.3, shLZ: -0.1, elL: -1.6, hoL: 0, hsL: 0,
      thLX: -0.95 * s - 0.25, thLZ: 0.08, knL: 0.4 + 1.3 * Math.max(0, -c), thRX: 0.95 * s - 0.25, thRZ: 0.08, knR: 0.4 + 1.3 * Math.max(0, c) });
    return own(lerpPose(G, R, ease(clamp((t - 0.05) / 0.06, 0, 1))));
  },

  // E 雷切・命中（撞到敵人時接 atk3）：右手貫手整條打直刺出、右腳弓步、左手甩到身後平衡
  atk3_E({ t, P }) {
    const W = P({ hipsY: -0.2, hipsZ: 0.05, hipsRY: 0.1, torsoX: 0.6, torsoY: -0.2, torsoZ: 0, headX: -0.5, headY: 0,
      shRX: -0.3, shRZ: 0.2, elR: -1.6, wrR: 0.3, hoR: 0.75, hsR: 0.9,
      shLX: -0.8, shLZ: 0.2, elL: -1.2, hoL: 0.2,
      thLX: -0.5, knL: 0.9, thRX: 0.3, knR: 0.6 });
    const S = P({ hipsY: -0.32, hipsZ: 0.32, hipsRY: 0.35, hipsRX: 0.1, torsoX: 0.5, torsoY: 0.7, torsoZ: 0, headX: -0.2, headY: -0.6,
      shRX: -2.1, shRZ: 0, elR: 0, wrR: 0, hoR: 1, hsR: 0.15, clR: 0.3,
      shLX: 0.9, shLZ: 0.35, elL: -0.5, hoL: 0.4, hsL: 0.3,
      thRX: -1.05, thRZ: 0.15, knR: 1.25, thLX: 0.85, thLZ: 0.1, knL: 0.2, toL: 0.4 });
    return own(keyed(t, [[0, W], [0.05, S], [0.2, S], [0.35, P({})]]));
  },

  // R 神威（cast，0.45 秒發動）：右手掀護額、掌心遮在寫輪眼旁，左手對準目標張開，
  // 用力時全身微顫、左手慢慢收攏，發動瞬間握拳把空間擰進去
  cast_R({ t, P }) {
    const A = P({ hipsY: -0.17, hipsRY: -0.15, hipsRZ: 0, torsoX: 0.12, torsoY: -0.25, torsoZ: 0, headX: -0.1, headY: 0.2,
      shRX: -1.8, shRZ: -0.7, elR: -2.45, wrR: -0.2, hoR: 0.9, hsR: 0.6,
      shLX: -1.5, shLZ: 0.2, elL: -0.1, wrL: -0.7, hoL: 1, hsL: 0.7,
      thLX: -0.6, thLZ: 0.28, knL: 0.65, thRX: 0.45, thRZ: 0.25, knR: 0.4 });
    const tr = t > 0.18 && t < 0.44 ? Math.sin(t * 55) * 0.025 : 0;
    const strain = clamp((t - 0.18) / 0.24, 0, 1);
    const B = lerpPose(A, A, 0);
    Object.assign(B, { torsoX: A.torsoX + 0.06 + tr, headX: A.headX + 0.12 * strain, hoL: 1 - 0.45 * strain, wrL: -0.7 + 0.4 * strain, elL: -0.1 - 0.25 * strain });
    const F = Object.assign(lerpPose(A, A, 0), { hipsZ: 0.06, torsoX: A.torsoX + 0.16, headX: 0.12, hoL: 0.05, hsL: 0.1, wrL: 0.1, elL: -0.25 });
    if (t < 0.18) return own(lerpPose(P({}), A, ease(t / 0.18)));
    if (t < 0.42) return own(B);
    return own(keyed(t, [[0.42, B], [0.46, F], [0.6, F]]));
  },

  // 勝利：招牌的「喲」——右手隨意舉起揮一揮、歪頭瞇眼笑，左手還插在口袋
  win({ t, P }) {
    const w = Math.sin(t * 6);
    return own(P({ hipsY: -0.02, hipsRZ: 0.06, torsoX: 0.05, torsoY: 0.1, torsoZ: -0.04, headX: -0.05, headY: -0.1, headZ: 0.18,
      shRX: -2.0, shRZ: 0.55, elR: -1.5 + 0.2 * w, wrR: 0.15 * w, hoR: 1, hsR: 0.6 }));
  },
};
