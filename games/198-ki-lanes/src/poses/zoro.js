// 索隆的專屬動作（海賊王・三刀流）。遊戲只在右手拿一把刀；左腰掛三把刀鞘。
// 鍵：atk1～3 普攻三連斬、cast_Q 三十六煩惱鳳、dash_W／slash 鬼斬（衝刺與收招）、slash_E 獅子歌歌、dash_R／vanish_R 三千世界、run、win。
// 注意：模型只在 atk*、slash、dash、rush 時把刀放在手上；cast（Q）與 vanish（R 後半）刀在鞘裡，所以那兩招設計成「拔刀」與「收刀」。
// 刀的方向：刀身從虎口伸出、和前臂垂直；wrR 正（約 1.0）把刀身扳成和手臂一直線，wrR 負讓刀往後倒（上段架刀）。
import { strike, lerpPose, ease, clamp, IMPACT, KEYS } from '../pose-kit.js';

const TAU = Math.PI * 2;

// 普攻出招：前半照 strike（架式 → 預備 → 斬下 → 順勢多送），收招不垂回架式，
// 而是收成「殘心」——刀還在手上、刀尖朝前斜上，避免刀尖戳進地面，連段之間也一直看得到刀
const _ov = {};
function cut(ctx, ti, W, S, rec, ov = 0.12) {
  const { t, base } = ctx;
  if (t < ti) return strike(t, ti, base, W, S, rec);
  for (const k of KEYS) _ov[k] = S[k] + (S[k] - W[k]) * ov; // 順勢多送（下劈的招式送得少，刀尖才不會插進地裡）
  if (t < ti + 0.08) return plant(ctx.d, lerpPose(S, _ov, Math.sin(Math.PI * 0.5 * clamp((t - ti) / 0.05, 0, 1))));
  // 殘心：中段架，刀尖斜指前上方
  const G = plant(ctx.d, ctx.P({ ...HILT_L, shRX: -1.0, shRY: 0, shRZ: 0.35, elR: -0.6, wrR: 0.45, hoR: 0, hsR: 0.2,
    hipsY: -0.11, torsoX: 0.2 }));
  return plant(ctx.d, lerpPose(_ov, G, ease(clamp((t - ti - 0.08) / Math.max(0.05, rec - ti - 0.08), 0, 1))));
}

// 讓腳踩在地上：依骨盆高度與大腿角度算膝蓋彎度（大腿 0.5L、小腿 0.44L，直立時腳踝離地 0.06L）
function knee(d, thX, hipsY, hipsRX = 0, thZ = 0) {
  const L = d.L, A = thX + hipsRX;
  const D = (0.94 * L + hipsY) / Math.cos(thZ);
  const c = clamp((D - 0.5 * L * Math.cos(A)) / (0.44 * L), -1, 1);
  return Math.max(0, Math.acos(c) - A);
}
// 兩腳都踩地（姿勢裡的 knL／knR 被覆寫）
function plant(d, p) {
  p.knL = knee(d, p.thLX, p.hipsY, p.hipsRX, p.thLZ);
  p.knR = knee(d, p.thRX, p.hipsY, p.hipsRX, p.thRZ);
  return p;
}
// 以架式為底，覆寫後把腳踩實
const pose = (ctx, o) => plant(ctx.d, ctx.P(o));

// 左手搭在腰間刀柄上（拇指頂著護手，隨時能推刀出鞘）
const HILT_L = { shLX: -0.4, shLY: 0, shLZ: 0.17, elL: -1.05, wrL: 0.2, hoL: 0.05, hsL: 0.7 };

export default {
  // 架式：腳開、膝微彎，身子微駝、下巴壓低瞪人；左手按刀柄，右手垂著放鬆
  stance(ctx) {
    const { t, d } = ctx;
    const br = Math.sin(t * 2.2), sway = Math.sin(t * 1.1);
    const p = {
      hipsY: -0.07 - 0.012 * br, hipsZ: 0, hipsRX: 0, hipsRY: -0.28, hipsRZ: 0.03 * sway,
      torsoX: 0.14 + 0.02 * br, torsoY: -0.12, torsoZ: 0.04, headX: 0.14 - 0.02 * br, headY: 0.34, headZ: -0.04,
      ...HILT_L,
      shRX: -0.12 - 0.03 * br, shRY: 0, shRZ: 0.24, elR: -0.45, wrR: 0, hoR: 0.35, hsR: 0.3,
      thLX: -0.3, thLZ: 0.2, thRX: 0.28, thRZ: 0.16, knL: 0, knR: 0,
      spin: 0, stretch: 0, anL: 0, anR: 0, clL: 0, clR: 0, toL: 0, toR: 0,
    };
    return plant(d, p);
  },

  // 一：右上斜劈（袈裟斬）。刀高舉過右肩，右腳踏進，刀從右上斬到左下
  atk1(ctx) {
    const W = pose(ctx, { hipsY: -0.1, hipsZ: -0.03, hipsRY: -0.4, torsoY: -0.55, torsoX: -0.05, headY: 0.65, headX: 0,
      shRX: -2.55, shRY: 0, shRZ: 0.55, elR: -1.3, wrR: -0.35, hoR: 0,
      shLX: -0.55, shLZ: 0.3, elL: -1.3, hoL: 0.1, thLX: -0.22, thRX: 0.3 });
    const S = pose(ctx, { hipsY: -0.22, hipsZ: 0.26, hipsRX: 0.1, hipsRY: 0.3, torsoY: 0.65, torsoX: 0.45, torsoZ: -0.08, headY: -0.6, headX: -0.15,
      shRX: -1.25, shRY: -0.4, shRZ: -0.4, elR: -0.05, wrR: 0.3, hoR: 0,
      shLX: 0.55, shLZ: 0.5, elL: -0.6, hoL: 0.1, thRX: -0.85, thRZ: 0.12, thLX: 0.6, thLZ: 0.18 });
    return cut(ctx, IMPACT.atk1, W, S, 0.32, 0.06);
  },

  // 二：反手橫斬（逆胴）。刀收到左肩，左腳踏進，刀身平著從左掃到右
  atk2(ctx) {
    const W = pose(ctx, { hipsY: -0.12, hipsRY: 0.35, torsoY: 0.75, torsoX: 0.15, headY: -0.7,
      shRX: -1.35, shRY: 0, shRZ: -0.95, elR: -1.5, wrR: -0.2, hoR: 0,
      shLX: -0.3, shLZ: 0.2, elL: -1.3, hoL: 0.1, thLX: -0.3, thRX: 0.35 });
    const S = pose(ctx, { hipsY: -0.18, hipsZ: 0.2, hipsRY: -0.3, torsoY: -0.7, torsoX: 0.3, torsoZ: 0.08, headY: 0.65,
      shRX: -1.35, shRY: 0.3, shRZ: 1.0, elR: -0.05, wrR: 1.1, hoR: 0,
      shLX: 0.35, shLZ: 0.6, elL: -0.5, hoL: 0.1, thLX: -0.85, thLZ: 0.25, thRX: 0.55, thRZ: 0.14 });
    return cut(ctx, IMPACT.atk2, W, S, 0.36);
  },

  // 三：虎狩。蹲低、雙臂舉過頭（刀倒在背後），小跳一步，雙臂一起往前下劈
  atk3(ctx) {
    const { t } = ctx, ti = IMPACT.atk3;
    const W = pose(ctx, { hipsY: -0.2, hipsZ: -0.05, hipsRY: 0, torsoY: 0.1, torsoX: -0.3, torsoZ: 0, headX: -0.3, headY: 0,
      shRX: -2.85, shRY: 0, shRZ: 0.3, elR: -1.35, wrR: -0.5, hoR: 0,
      shLX: -2.85, shLZ: 0.3, elL: -1.35, hoL: 0, thLX: -0.45, thRX: 0.35 });
    const S = pose(ctx, { hipsY: -0.27, hipsZ: 0.32, hipsRX: 0.12, hipsRY: 0, torsoY: 0, torsoX: 0.5, torsoZ: 0, headX: -0.5, headY: 0,
      shRX: -1.55, shRY: 0, shRZ: 0.12, elR: -0.05, wrR: 0.8, hoR: 0,
      shLX: -1.45, shLZ: 0.12, elL: -0.05, hoL: 0, thLX: -0.95, thLZ: 0.2, thRX: 0.75, thRZ: 0.15 });
    const p = cut(ctx, ti, W, S, 0.45, 0.03);
    // 出手的半拍裡往前小跳：骨盆抬起、兩腳離地
    if (t > ti * 0.55 && t < ti) {
      const h = Math.sin(Math.PI * (t - ti * 0.55) / (ti * 0.45));
      p.hipsY += 0.12 * h; p.knL += 0.4 * h; p.knR += 0.5 * h;
    }
    return p;
  },

  // Q 三十六煩惱鳳：右手握住左腰的刀柄、身體扭緊蹲低，0.14 秒一口氣拔刀橫掃，斬擊飛出
  cast_Q(ctx) {
    const W = pose(ctx, { hipsY: -0.2, hipsZ: -0.04, hipsRY: 0.3, torsoY: 0.7, torsoX: 0.38, torsoZ: -0.05, headY: -0.62, headX: -0.25,
      shRX: -0.35, shRY: 0, shRZ: -0.65, elR: -1.0, wrR: 0.2, hoR: 0, hsR: 0.2,
      ...HILT_L, shLX: -0.32, elL: -0.95, thLX: -0.45, thLZ: 0.24, thRX: 0.4, thRZ: 0.2 });
    const S = pose(ctx, { hipsY: -0.22, hipsZ: 0.18, hipsRY: -0.3, torsoY: -0.6, torsoX: 0.25, torsoZ: 0.08, headY: 0.6, headX: -0.15,
      shRX: -1.55, shRY: 0.2, shRZ: 0.75, elR: -0.02, wrR: 0.6, hoR: 0, hsR: 0.2,
      ...HILT_L, shLX: 0.15, shLZ: 0.25, elL: -0.9,
      thLX: -0.35, thLZ: 0.32, thRX: -0.55, thRZ: 0.35 });
    const p = strike(ctx.t, 0.14, ctx.base, W, S, 0.32);
    p.ownHands = true;
    return p;
  },

  // W 鬼斬（衝刺中）：身體壓低前衝，兩臂在胸前交叉成 X，刀越過左肩往後
  dash_W(ctx) {
    const { t } = ctx;
    const fl = Math.sin(t * 40) * 0.04;
    return pose(ctx, { hipsY: -0.16, hipsZ: 0.05, hipsRX: 0.3, hipsRY: 0, hipsRZ: 0, torsoX: 0.3, torsoY: 0, torsoZ: 0, headX: -0.55, headY: 0,
      shRX: -1.45, shRY: 0, shRZ: -0.7, elR: -1.6, wrR: -0.2, hoR: 0,
      shLX: -1.45, shLY: 0, shLZ: -0.7, elL: -1.6, wrL: 0, hoL: 0, hsL: 0.1,
      thLX: -0.75 + fl, thLZ: 0.12, thRX: 0.55 - fl, thRZ: 0.1 });
  },

  // W 鬼斬收招（slash，沒有技能鍵）：衝過去後雙臂一口氣向兩側甩開，壓低定住
  slash(ctx) {
    const { t } = ctx;
    const X = pose(ctx, { hipsY: -0.16, hipsZ: 0.05, hipsRX: 0.3, hipsRY: 0, torsoX: 0.3, torsoY: 0, headX: -0.55, headY: 0,
      shRX: -1.45, shRY: 0, shRZ: -0.7, elR: -1.6, wrR: -0.2, hoR: 0,
      shLX: -1.45, shLY: 0, shLZ: -0.7, elL: -1.6, wrL: 0, hoL: 0,
      thLX: -0.75, thLZ: 0.12, thRX: 0.55, thRZ: 0.1 });
    const S = pose(ctx, { hipsY: -0.28, hipsZ: 0.1, hipsRX: 0.2, hipsRY: 0, torsoX: 0.35, torsoY: 0, torsoZ: 0, headX: -0.4, headY: 0,
      shRX: 0.25, shRY: 0, shRZ: 1.3, elR: -0.05, wrR: 1.0, hoR: 0,
      shLX: 0.25, shLY: 0, shLZ: 1.3, elL: -0.05, wrL: 0, hoL: 0,
      thLX: -0.9, thLZ: 0.3, thRX: 0.7, thRZ: 0.25 });
    if (t < 0.07) return lerpPose(X, S, ease(t / 0.07));
    if (t < 0.18) return S;
    return lerpPose(S, ctx.base, ease(clamp((t - 0.18) / 0.12, 0, 1)));
  },

  // E 獅子歌歌：一閃而過後的居合收勢——深弓步、刀從左腰拔出向右後方平伸，左手還按著刀鞘
  slash_E(ctx) {
    const { t } = ctx;
    const D = pose(ctx, { hipsY: -0.26, hipsZ: 0.1, hipsRY: 0.3, torsoY: 0.65, torsoX: 0.45, headY: -0.5, headX: -0.3,
      shRX: -0.35, shRY: 0, shRZ: -0.65, elR: -1.0, wrR: 0.2, hoR: 0,
      ...HILT_L, thLX: -0.95, thLZ: 0.2, thRX: 0.7, thRZ: 0.15 });
    const S = pose(ctx, { hipsY: -0.32, hipsZ: 0.18, hipsRY: -0.3, torsoY: -0.6, torsoX: 0.5, torsoZ: 0.05, headY: 0.55, headX: -0.15,
      shRX: -0.25, shRY: 0.25, shRZ: 1.3, elR: -0.02, wrR: 1.1, hoR: 0,
      ...HILT_L, thLX: -1.0, thLZ: 0.22, thRX: 0.72, thRZ: 0.18 });
    if (t < 0.05) return lerpPose(D, S, ease(t / 0.05));
    return S;
  },

  // R 三千世界（前 0.3 秒，原地）：蹲低前傾，雙臂在身前畫圈轉刀
  dash_R(ctx) {
    const { t } = ctx;
    const w = 14, a = Math.sin(t * w), b = Math.cos(t * w);
    return pose(ctx, { hipsY: -0.22, hipsZ: 0, hipsRX: 0.2, hipsRY: 0, hipsRZ: 0, torsoX: 0.35, torsoY: 0, torsoZ: 0, headX: -0.45, headY: 0,
      shRX: -1.5 + 0.35 * a, shRY: 0, shRZ: 0.2 + 0.4 * b, elR: -0.85, wrR: 0.1 + 0.6 * a, hoR: 0, // 刀在手裡轉圈，刀尖始終高過地面
      shLX: -1.5 - 0.35 * a, shLY: 0, shLZ: 0.2 - 0.4 * b, elL: -0.85, wrL: 0, hoL: 0,
      thLX: -0.5, thLZ: 0.4, thRX: 0.4, thRZ: 0.4 });
  },

  // R 三千世界（閃到敵人身後）：雙臂平張旋身兩圈斬盡一周，接著站定、右手把刀推回左腰的鞘（收刀）
  vanish_R(ctx) {
    const { t } = ctx;
    // 旋身時像陀螺一樣斜著轉：右臂斜上、左臂斜下，上身側傾、蹲得更低
    const Wh = pose(ctx, { hipsY: -0.3, hipsZ: 0, hipsRX: 0.1, hipsRY: 0, hipsRZ: -0.06, torsoX: 0.3, torsoY: 0, torsoZ: 0.2, headX: -0.25, headY: 0, headZ: -0.15,
      shRX: -0.3, shRY: 0, shRZ: 1.8, elR: -0.05, wrR: 0, hoR: 0,
      shLX: -0.1, shLY: 0, shLZ: 1.05, elL: -0.05, wrL: 0, hoL: 0,
      thLX: -0.45, thLZ: 0.35, thRX: 0.4, thRZ: 0.35 });
    const N = pose(ctx, { hipsY: -0.12, hipsZ: 0, hipsRX: 0, hipsRY: -0.3, torsoX: 0.22, torsoY: 0.45, torsoZ: 0, headX: 0.4, headY: 0.1,
      shRX: -0.35, shRY: 0, shRZ: -0.65, elR: -1.0, wrR: 0.2, hoR: 0,
      ...HILT_L, thLX: -0.3, thLZ: 0.2, thRX: 0.3, thRZ: 0.18 });
    let p;
    if (t < 0.3) p = { ...Wh, spin: 2 * TAU * (1 - (1 - t / 0.3) ** 2) };
    else { p = lerpPose(Wh, N, ease(clamp((t - 0.3) / 0.15, 0, 1))); p.spin = 2 * TAU; }
    p.ownHands = true;
    return p;
  },

  // 跑步：左手按住腰間三把刀不讓它晃，右手前後大擺，上身前傾
  run(ctx) {
    const { phase } = ctx;
    const s = Math.sin(phase), c = Math.cos(phase);
    return ctx.P({ hipsY: -0.09 + 0.08 * Math.abs(c), hipsZ: 0, hipsRX: 0.1, hipsRY: -0.2 * s, hipsRZ: 0,
      torsoX: 0.42, torsoY: 0.3 * s, torsoZ: 0, headX: -0.34, headY: -0.15 * s,
      thLX: s * 1.3 - 0.15, thRX: -s * 1.3 - 0.15, thLZ: 0.05, thRZ: 0.05,
      knL: 0.3 + 1.6 * Math.max(0, -c) * (0.6 + 0.4 * Math.max(0, -s)), knR: 0.3 + 1.6 * Math.max(0, c) * (0.6 + 0.4 * Math.max(0, s)),
      ...HILT_L, shLX: -0.5, elL: -1.2,
      shRX: s * 1.2 - 0.15, shRY: 0, shRZ: 0.22, elR: -1.35 - 0.35 * Math.max(0, -s), wrR: 0, hoR: 0.1 });
  },

  // 勝利：雙手抱胸、重心落在一腳，下巴微抬斜睨
  win(ctx) {
    const { t, d } = ctx;
    const br = Math.sin(t * 2);
    return plant(d, ctx.P({ hipsY: -0.02 + 0.01 * br, hipsZ: 0, hipsRX: 0, hipsRY: -0.25, hipsRZ: 0.06, torsoX: -0.06, torsoY: 0.1, torsoZ: -0.04,
      headX: -0.18, headY: 0.3, headZ: 0.06,
      shLX: -0.5, shLY: -1.4, shLZ: -0.05, elL: -1.55, wrL: 0, hoL: 0, hsL: 0,
      shRX: -0.42, shRY: -1.4, shRZ: -0.05, elR: -1.75, wrR: 0, hoR: 0, hsR: 0,
      thLX: -0.1, thLZ: 0.12, thRX: 0.14, thRZ: 0.16 }));
  },
};
