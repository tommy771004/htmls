// piccolo 的專屬動作。鍵是動作名（atk1、atk2、atk3、cast、beam、dash、rush、overhead、grab、barrier、air、run、win…）
// 或「動作_技能鍵」（cast_Q、dash_E…，比動作名優先）；stance 覆蓋待機架式（其他動作的 base 也會跟著換）。
// 每個函式拿到 ctx = { d, name, t, k, phase, key, base, P }，回傳姿勢物件；回傳 undefined 就用 models.js 的共用動作。
// 工具見 ../pose-kit.js（strike、lerpPose、ease、clamp、IMPACT…）。
//
// 比克：高瘦的那美克星人。架式駝背壓低、兩手半張成爪；普攻是貫手、伸長的直拳、腳跟直踹；
// Q 魔空包圍彈＝左右手連甩氣彈再握拳收網，W 伸臂抓取，E 再生（瞬移後挺胸怒吼），R 魔貫光殺砲＝指尖抵額蓄力、弓步直指。
// 自己的動作走快速平滑（約 31ms 追上），關鍵姿勢至少停 50～70ms 才看得出來。
import { strike, lerpPose, ease, clamp, IMPACT } from '../pose-kit.js';
import { HEROES } from '../config.js';

const own = (p) => { p.ownHands = true; return p; }; // 手形自己決定（不套 models.js 的 HAND_OPEN）
const seg = (t, a, b) => ease(clamp((t - a) / (b - a), 0, 1)); // t 在 a→b 之間的平滑進度
const BEAM_WIND = HEROES.piccolo.skills.R.windup; // 魔貫光殺砲的蓄力時間（combat.js 在這之後才放出光束）
// 弓步（左腳在前）：骨盆壓到 −0.24、後腿幾乎打直，兩腳的腳趾都貼地（量過 toL≈0.02、toR≈0.04）
const LUNGE = { hipsY: -0.24, thLX: -0.85, thLZ: 0.26, knL: 1.1, thRX: 0.7, thRZ: 0.14, knR: 0.05 };

export default {
  // 架式：寬馬步、上身前駝、頭壓低往上瞪；左手爪在前、右手爪收在腰側，呼吸帶動肩膀
  stance({ t }) {
    const br = Math.sin(t * 2.2), sw = Math.sin(t * 1.1);
    return {
      hipsY: -0.14 - 0.012 * br, hipsZ: 0, hipsRX: 0, hipsRY: -0.2, hipsRZ: 0.03 * sw,
      torsoX: 0.4 + 0.03 * br, torsoY: -0.35, torsoZ: -0.04, headX: -0.45 - 0.02 * br, headY: 0.38, headZ: 0,
      shLX: -1.15 - 0.05 * br, shLY: 0, shLZ: 0.6 + 0.03 * br, elL: -0.7,
      shRX: -0.25 + 0.05 * br, shRY: 0, shRZ: 0.55 + 0.03 * br, elR: -1.55,
      thLX: -0.5, thLZ: 0.32, knL: 0.75, thRX: 0.4, thRZ: 0.22, knR: 0.25, // 後腳伸長踩地（腳跟微抬）
      spin: 0, stretch: 0, wrL: -0.25, wrR: -0.3, anL: 0, anR: 0, clL: 0.15, clR: 0.15,
      hoL: 0.85, hoR: 0.7, hsL: 0.75, hsR: 0.6, toL: 0, toR: 0, prop: 0,
    };
  },

  // 普攻一：左手貫手（指尖併攏直插），往前踏一步
  atk1({ t, base, P }) {
    const W = P({ torsoY: 0.1, hipsRY: -0.05, shLX: -0.7, shLZ: 0.25, elL: -2.0, hipsY: -0.16, hipsZ: -0.04, headY: 0.1 });
    const S = P({ torsoY: -0.6, hipsRY: -0.3, torsoX: 0.32, shLX: -1.62, shLZ: 0.55, elL: -0.02, wrL: -0.1, shRX: 0.4, shRZ: 0.4, elR: -1.7,
      hipsZ: 0.28, ...LUNGE, headY: 0.6, headX: -0.25,
      hoL: 0.95, hsL: 0.05, hoR: 0.3 });
    return own(strike(t, IMPACT.atk1, base, W, S, 0.3));
  },

  // 普攻二：右拳往後一拉（藏到肋骨後），伸長手臂的直拳（那美克星人的長臂）
  atk2({ t, base, P }) {
    const W = P({ torsoY: -0.85, hipsRY: -0.4, torsoX: 0.2, shRX: 0.55, shRZ: 0.2, elR: -2.3, shLX: -1.3, shLZ: 0.2, elL: -0.6,
      hipsY: -0.17, hipsZ: -0.05, knL: 0.85, knR: 0.35, headY: 0.6, hoR: 0, hsR: 0 });
    const S = P({ torsoY: 0.6, hipsRY: 0.3, torsoX: 0.3, shRX: -1.6, shRZ: 0.8, elR: 0, wrR: 0, shLX: 0.45, shLZ: 0.4, elL: -1.9,
      hipsZ: 0.3, ...LUNGE, headY: -0.6, headX: -0.25,
      stretch: 0.75, hoR: 0, hsR: 0, hoL: 0.4 });
    return own(strike(t, IMPACT.atk2 - 0.015, base, W, S, 0.34)); // 手臂行程長，提早一點到位才趕得上平滑
  },

  // 普攻三：膝蓋高高收起、身體壓低蓄力，右腳腳跟往前直踹（踹擊），上身靠骨盆後仰、兩手甩開平衡
  atk3({ t, base, P }) {
    const W = P({ torsoY: -0.7, hipsRY: -0.45, hipsRX: -0.1, torsoX: 0.15, hipsY: -0.17, thRX: -1.7, thRZ: 0.1, knR: 2.35, thLX: -0.2, thLZ: 0.15, knL: 0.85,
      shLX: -0.45, shLZ: 0.5, elL: -1.6, shRX: -0.3, shRZ: 0.3, elR: -1.4, headY: 0.5, hoL: 0.3, hoR: 0.3 });
    const S = P({ torsoY: 0.4, hipsRY: 0.5, hipsRX: -0.15, torsoX: -0.3, torsoZ: 0.2, hipsY: -0.02, hipsZ: 0.22, thRX: -1.75, thRZ: 0.25, knR: 0.05, anR: -0.4,
      thLX: 0, thLZ: 0.15, knL: 0.3, shLX: 0.4, shLZ: 1.4, elL: -0.3, shRX: 0.5, shRZ: 1.4, elR: -0.3, headY: -0.6, headX: 0.1,
      hoL: 0.7, hoR: 0.7, hsL: 0.6, hsR: 0.6 });
    // 收膝要停住才看得出來：0.06 秒收到位、停到 0.11 秒（50ms），再加速踹出（0.16 秒到位，平滑後約 0.19 秒全伸、對上 0.2 秒的傷害），
    // 伸直停到 0.26 秒，0.46 秒前收回架式（動作 0.48 秒）
    const over = { ...S }; for (const k in S) over[k] = S[k] + (S[k] - W[k]) * 0.08;
    let p;
    if (t < 0.11) p = lerpPose(base, W, seg(t, 0, 0.06));
    else if (t < 0.16) { const u = (t - 0.11) / 0.05; p = lerpPose(W, S, u * u * (2 - u)); }
    else if (t < 0.26) p = lerpPose(S, over, seg(t, 0.16, 0.2));
    else p = lerpPose(over, base, seg(t, 0.26, 0.46));
    return own(p);
  },

  // Q 魔空包圍彈（動作 0.35 秒）：右手、左手輪流往前外側甩出氣彈（腰跟著左右大扭）→ 雙拳在臉前一握收網
  // 每個甩手停約 60ms 才換下一個；收網 0.215 秒到位、0.22～0.25 秒再狠狠一握，停到 0.28 秒，0.35 秒前收回架式
  overhead_Q({ t, base, P }) {
    const legs = { hipsY: -0.2, thLX: -0.6, thLZ: 0.42, knL: 1.0, thRX: 0.42, thRZ: 0.3, knR: 0.35 };
    // 右手甩：右肩送出、手臂伸直往右前上方撒開，左手收到腰後；腰往左扭
    const flingR = P({ ...legs, hipsZ: 0.1, hipsRY: 0.3, torsoX: 0.3, torsoY: 0.8, torsoZ: -0.1, headX: -0.25, headY: -0.6,
      shRX: -1.85, shRY: 0, shRZ: 1.15, elR: 0, wrR: -0.6, shLX: 0.7, shLZ: 0.45, elL: -1.7, clR: 0.3,
      hoR: 1, hsR: 1, hoL: 0.2, hsL: 0.3 });
    // 左手甩：反過來，腰往右扭、左臂往左前上方撒開，右手拉回
    const flingL = P({ ...legs, hipsZ: 0.16, hipsRY: -0.3, torsoX: 0.3, torsoY: -0.8, torsoZ: 0.1, headX: -0.25, headY: 0.6,
      shLX: -1.85, shLY: 0, shLZ: 1.15, elL: 0, wrL: -0.6, shRX: 0.7, shRZ: 0.45, elR: -1.7, clL: 0.3,
      hoL: 1, hsL: 1, hoR: 0.2, hsR: 0.3 });
    // 收網：身體沉下去、駝背縮起，手肘外張、前臂往內收，雙拳在下巴前併攏用力握緊（氣彈在遠處合攏）
    const tr = 0.02 * Math.sin(t * 70);
    const clench = P({ torsoX: 0.2, torsoY: 0, torsoZ: tr, hipsY: -0.24, hipsZ: 0.04, hipsRY: 0, headX: -0.35, headY: 0,
      shLX: -1.1, shLY: -0.85, shLZ: 0.8, elL: -1.7, shRX: -1.1, shRY: -0.85, shRZ: 0.8, elR: -1.7, clL: 0.1, clR: 0.1,
      thLX: -0.55, thLZ: 0.42, knL: 1.0, thRX: 0.45, thRZ: 0.32, knR: 0.55, hoL: 0, hoR: 0, hsL: 0, hsR: 0 });
    let p;
    if (t < 0.095) p = lerpPose(base, flingR, seg(t, 0, 0.035));
    else if (t < 0.185) p = lerpPose(flingR, flingL, seg(t, 0.095, 0.125));
    else if (t < 0.28) {
      p = lerpPose(flingL, clench, seg(t, 0.185, 0.215));
      const sq = seg(t, 0.22, 0.25); p.torsoX += 0.06 * sq; p.hipsY -= 0.02 * sq; p.elL -= 0.15 * sq; p.elR -= 0.15 * sq; // 最後狠狠一握
    } else {
      const sq = { ...clench, torsoX: clench.torsoX + 0.06, hipsY: clench.hipsY - 0.02, elL: clench.elL - 0.15, elR: clench.elR - 0.15 };
      p = lerpPose(sq, base, seg(t, 0.28, 0.345));
    }
    return own(p);
  },

  // W 伸臂抓取（0.55 秒；氣彈與綠色手臂線在第一格就射出）：右肩一縮馬上把手臂射出去拉長、張爪，
  // 抓到後手肘往後猛拉到腰側、身體後坐，最後收回架式
  grab_W({ t, base, P }) {
    // 預備與伸出用同一個腰的扭轉方向（只差一點），手臂才會沿著綠色手臂線直直射出去，而不是從側邊掃過來
    const coil = P({ torsoY: 0.05, hipsRY: 0, torsoX: 0.25, shRX: 0.6, shRZ: 0.45, elR: -2.2, clR: -0.15, hipsY: -0.17, hipsZ: -0.04, headY: 0, hoR: 0.6, hsR: 0.6 });
    // 伸出：手要落在綠線上。英雄在對局裡放大 1.4 倍（main.js HERO_VIS），綠線在世界高度 1.3，所以手在骨架座標要約 (0, 0.93, 2.4)（量過：正對面向、和氣彈同高）
    const reach = P({ torsoY: 0.3, hipsRY: 0.15, torsoX: 0.35, shRX: -1.55, shRZ: 1.1, elR: 0, wrR: 0.1, shLX: 0.5, shLZ: 0.45, elL: -1.4, clR: 0.4,
      hipsZ: 0.24, ...LUNGE, headY: -0.3, headX: -0.25,
      hoR: 0.85, hsR: 1, hoL: 0.3, stretch: 2.0 });
    const yank = P({ torsoY: -0.35, hipsRY: -0.2, torsoX: -0.2, shRX: 0.35, shRZ: 0.3, elR: -1.9, clR: -0.1, shLX: -0.6, shLZ: 0.5, elL: -1.2,
      hipsZ: -0.12, hipsY: -0.2, thLX: -0.65, thLZ: 0.3, knL: 0.85, thRX: 0.5, thRZ: 0.25, knR: 0.35, headY: 0.2, headX: -0.3,
      hoR: 0, hsR: 0, hoL: 0.4, stretch: 0 });
    let p;
    if (t < 0.03) p = lerpPose(base, coil, ease(t / 0.03));
    // 綠色手臂線（fx.stretch）留 0.55 秒，手臂就伸著陪到 0.38 秒（對上拉人的那段），再猛拉回腰側、停 50ms，0.55 秒收回架式
    else if (t < 0.38) { p = lerpPose(coil, reach, seg(t, 0.03, 0.08)); p.stretch = reach.stretch * seg(t, 0.03, 0.1); }
    else if (t < 0.48) p = lerpPose(reach, yank, seg(t, 0.38, 0.43));
    else p = lerpPose(yank, base, seg(t, 0.48, 0.55));
    return own(p);
  },

  // E 再生（0.12 秒，瞬移時模型隱藏；現身時從這個姿勢收回架式）：挺胸、雙臂往下外側甩開握拳，像再生時的一聲怒吼
  vanish_E({ t, base, P }) {
    const S = P({ hipsY: -0.18, torsoX: -0.15, torsoY: 0, headX: 0.2, headY: 0, shLX: 0.3, shLZ: 0.9, elL: -0.4, shRX: 0.3, shRZ: 0.9, elR: -0.4,
      thLX: -0.5, thLZ: 0.4, knL: 0.8, thRX: 0.3, thRZ: 0.4, knR: 0.7, hoL: 0, hoR: 0, hsL: 0, hsR: 0, clL: -0.1, clR: -0.1 });
    return own(lerpPose(base, S, seg(t, 0, 0.04)));
  },

  // R 魔貫光殺砲（蓄力 BEAM_WIND 秒＋發射 0.6 秒）：右手指尖豎起抵住額頭正中、頭往手指靠，左拳握緊壓在腰側，
  // 越蹲越低、抖得越來越厲害 → 最後 0.1 秒弓步把手臂直直刺出、指尖指向前方 → 後座力
  beam_R({ t, base, P }) {
    const W = BEAM_WIND;
    const aim = P({ torsoX: 0.12, torsoY: 0.4, hipsRY: 0.3, torsoZ: -0.05, hipsY: -0.16, hipsZ: -0.03, headX: 0.2, headY: -0.25, headZ: 0.12,
      shRX: -1.55, shRY: -0.1, shRZ: 1.45, elR: -2.55, wrR: 0.7, clR: 0, shLX: 0.2, shLZ: 0.35, elL: -0.5,
      thLX: -0.5, thLZ: 0.36, knL: 0.8, thRX: 0.4, thRZ: 0.24, knR: 0.3, hoR: 0.9, hsR: 0, hoL: 0.1, hsL: 0.2 });
    // 蓄滿：明顯蹲低、上身壓前、左拳在腰側握得更緊；前膝多彎吃掉下沉量，後腿往後伸長踩住地（量過 toR≈0.03）
    const full = { ...aim, torsoX: aim.torsoX + 0.15, hipsY: aim.hipsY - 0.1, knL: aim.knL + 0.3, knR: 0.4,
      thLX: aim.thLX - 0.15, thRX: 0.55, shLX: 0.35, elL: -1.9, clL: 0.1, hoL: 0, hsL: 0 };
    const fire = P({ torsoX: 0.18, torsoY: 0.6, hipsRY: 0.3, torsoZ: 0, hipsZ: 0.24, headX: -0.1, headY: -0.7, headZ: 0,
      shRX: -1.57, shRY: 0, shRZ: 1.1, elR: 0, wrR: 0, shLX: 0.5, shLZ: 0.35, elL: -1.6,
      ...LUNGE, hoR: 0.92, hsR: 0, hoL: 0, hsL: 0 });
    // 出手前一瞬：手從額頭收到下巴前、前臂放平、手肘往後夾，手腕往前折讓指尖朝前（像長槍收手，不是舉手揮手），再整條手臂刺出
    const cock = { ...lerpPose(full, fire, 0.4), shRX: -0.3, shRY: 0, shRZ: 0.8, elR: -1.7, wrR: 0.5, hoR: 0.92 };
    let p;
    if (t < 0.25) p = lerpPose(base, aim, ease(t / 0.25));
    else if (t < W - 0.1) {
      p = lerpPose(aim, full, seg(t, 0.25, W - 0.1));
      // 指尖的螺旋氣越聚越亮：發抖從無到有，分散在腰、頭、右肩
      const a = 0.05 * seg(t, 0.25, W - 0.1), s1 = Math.sin(t * 31), s2 = Math.sin(t * 23 + 1.3);
      p.torsoZ += a * s1; p.headZ += a * s2; p.shRZ += a * 0.8 * s2; p.torsoX += a * 0.5 * s1;
    } else if (t < W - 0.05) { p = lerpPose(full, cock, seg(t, W - 0.1, W - 0.05)); } // 先收到肩前（不會從頭頂繞一圈）
    else if (t < W) { const u = (t - (W - 0.05)) / 0.05; p = lerpPose(cock, fire, u * u); } // 再加速刺出
    else {
      p = { ...fire };
      const e = t - W, r = e < 0.03 ? e / 0.03 : Math.max(0, 1 - (e - 0.03) / 0.15); // 後座力：30ms 內頂到、再慢慢回來
      p.hipsZ -= 0.08 * r; p.torsoX -= 0.12 * r; p.headX -= 0.06 * r;
      if (t > W + 0.45) p = lerpPose(p, base, 0.3 * seg(t, W + 0.45, W + 0.6)); // 光束快收時手臂放低一點、腰抬起來，交回待機比較短
    }
    return own(p);
  },

  // 勝利：雙臂抱胸、挺直站好，低頭冷笑（比克的招牌站姿）
  win({ t, P }) {
    const br = Math.sin(t * 2);
    return own(P({ hipsY: -0.01, hipsRY: 0, hipsRZ: 0, torsoX: -0.04 + 0.01 * br, torsoY: 0.1, torsoZ: 0, headX: 0.18, headY: -0.2,
      shLX: -0.4, shLY: -1.3, shLZ: 0.12, elL: -1.7, shRX: -0.5, shRY: -1.3, shRZ: 0.08, elR: -1.75, wrL: 0, wrR: 0, clL: 0, clR: 0,
      thLX: -0.06, thLZ: 0.16, knL: 0.06, thRX: 0.06, thRZ: 0.16, knR: 0.06, hoL: 0.6, hoR: 0.6, hsL: 0.4, hsR: 0.4 }));
  },
};
