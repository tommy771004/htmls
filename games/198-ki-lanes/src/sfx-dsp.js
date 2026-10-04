// 音效的樣本級合成：不用振盪器，直接算波形——打擊是肉身悶響＋布料拍擊＋破空聲，氣功是噪音的轟鳴與劈啪，
// 塔是石頭與水晶、小兵是陶土碎裂、介面是拍子木與鈴（模態合成：一組會衰減的非諧波分音），音樂是太鼓與箏（膜面模態、Karplus–Strong 撥弦）。
// 每個音色以 (D, out) 寫入 Float32Array；D 帶著取樣率與亂數，同一個音色換種子就有不同變化。

export function dsp(sr, seed = 1) {
  let s = (seed * 2654435761) >>> 0 || 1;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const rr = (a, b) => a + (b - a) * rnd();
  const n = (sec) => Math.max(1, Math.ceil(sec * sr));
  const TAU = Math.PI * 2;

  // 二階濾波（RBJ），可每 32 樣本更新頻率做掃頻
  function bq(type, f, q = 0.7) {
    let b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    const set = (fr) => {
      const w = TAU * Math.min(fr, sr * 0.45) / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q);
      let B0, B1, B2;
      if (type === 'lp') { B0 = (1 - c) / 2; B1 = 1 - c; B2 = (1 - c) / 2; }
      else if (type === 'hp') { B0 = (1 + c) / 2; B1 = -(1 + c); B2 = (1 + c) / 2; }
      else { B0 = al; B1 = 0; B2 = -al; } // bp（峰值增益 1）
      const A0 = 1 + al; b0 = B0 / A0; b1 = B1 / A0; b2 = B2 / A0; a1 = (-2 * c) / A0; a2 = (1 - al) / A0;
    };
    set(f);
    return { set, run(x) { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; } };
  }
  // 噪音源：white／pink（Voss–Kellet 近似）／brown
  function src(color = 'white') {
    let b0 = 0, b1 = 0, b2 = 0, br = 0;
    return () => {
      const w = rnd() * 2 - 1;
      if (color === 'white') return w;
      if (color === 'brown') { br = (br + w * 0.02) * 0.998; return br * 3.5; }
      b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527;
      return (b0 + b1 + b2 + w * 0.1848) * 0.25;
    };
  }
  const ex = (t, tau) => Math.exp(-t / tau);

  // 有包絡的濾波噪音：f 可為 [f0, f1] 掃頻（指數），env 預設「a 秒起音、tau 衰減」，或自訂 env(t)
  function noise(out, t0, dur, amp, { color = 'pink', type = 'bp', f = 1000, q = 0.8, a = 0.002, tau = 0.1, env, am } = {}) {
    const i0 = n(t0), len = Math.min(n(dur), out.length - i0);
    const g = src(color), [f0, f1] = Array.isArray(f) ? f : [f, f];
    const fl = type === 'none' ? null : bq(type, f0, q);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      if (fl && f0 !== f1 && (i & 31) === 0) fl.set(f0 * Math.pow(f1 / f0, Math.min(1, t / dur)));
      let v = g(); if (fl) v = fl.run(v);
      const e = env ? env(t) : (t < a ? t / a : ex(t - a, tau));
      out[i0 + i] += v * amp * e * (am ? am(t) : 1);
    }
  }
  // 往下滑的悶響（肉身、地面、鼓身）：正弦＋一點三次諧波，頻率 f0→f1、時間常數 tau
  function thump(out, t0, f0, f1, tau, amp, { glide = tau * 0.6, a = 0.0015, h3 = 0.12 } = {}) {
    const i0 = n(t0), len = Math.min(n(tau * 7), out.length - i0);
    let ph = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr, f = f1 + (f0 - f1) * ex(t, glide);
      ph += TAU * f / sr;
      const e = (t < a ? t / a : 1) * ex(t, tau);
      out[i0 + i] += (Math.sin(ph) + h3 * Math.sin(3 * ph)) * amp * e;
    }
  }
  // 模態合成：基頻 f、分音比 ratios、各自振幅與衰減；detune 讓每個分音分成兩條略偏的線產生拍頻（鈴、鉢）
  function modal(out, t0, f, ratios, amps, taus, amp = 1, { detune = 0, a = 0.0008, maxDur } = {}) {
    const i0 = n(t0);
    const dur = maxDur || Math.max(...taus) * 6;
    const len = Math.min(n(dur), out.length - i0);
    ratios.forEach((r, k) => {
      const fr = f * r; if (fr > sr * 0.45) return;
      const A = amps[k] * amp, tau = taus[k], ph0 = rnd() * TAU;
      const lines = detune ? [[1 - detune, 0.5], [1 + detune, 0.5]] : [[1, 1]];
      for (const [dm, w] of lines) {
        const dph = TAU * fr * dm / sr;
        let c = Math.cos(ph0), sn = Math.sin(ph0); const cd = Math.cos(dph), sd = Math.sin(dph);
        const dec = Math.exp(-1 / (tau * sr));
        let e = 1;
        const ai = n(a);
        for (let i = 0; i < len; i++) {
          const env = i < ai ? i / ai : 1;
          out[i0 + i] += sn * A * w * e * env;
          const c2 = c * cd - sn * sd; sn = sn * cd + c * sd; c = c2; e *= dec;
          if (e < 1e-4) break;
        }
      }
    });
  }
  // 劈啪：隨機短脈衝（碎石、火花、電弧），density 每秒顆數（可隨時間衰減）
  function crackle(out, t0, dur, density, amp, { f = 2500, q = 1.2, type = 'bp', decay = 0, grain = 0.004 } = {}) {
    const i0 = n(t0), len = Math.min(n(dur), out.length - i0);
    const fl = bq(type, f, q), g = src('white');
    const tmp = new Float32Array(len);
    let next = rr(0, 1 / density);
    while (next < dur) {
      const k = n(next), gl = n(grain * rr(0.5, 1.6)), a = amp * rr(0.3, 1) * (decay ? ex(next, decay) : 1);
      for (let j = 0; j < gl && k + j < len; j++) tmp[k + j] += g() * a * (1 - j / gl);
      next += -Math.log(1 - rnd() * 0.999) / density;
    }
    for (let i = 0; i < len; i++) out[i0 + i] += fl.run(tmp[i]);
  }
  // 破空聲：帶通噪音、頻率掃過、鐘形包絡
  function whoosh(out, t0, dur, f0, f1, amp, { q = 1.6, color = 'pink', peak = 0.4 } = {}) {
    noise(out, t0, dur, amp, { color, type: 'bp', f: [f0, f1], q, env: (t) => { const x = t / dur; return x < peak ? Math.sin((x / peak) * Math.PI / 2) ** 2 : Math.cos(((x - peak) / (1 - peak)) * Math.PI / 2) ** 2; } });
  }
  // 撥弦（Karplus–Strong）：bright 0..1 控制初始雜音亮度與衰減
  function pluck(out, t0, f, dur, amp, { bright = 0.6, decay = 0.996, pick = 0.3 } = {}) {
    const i0 = n(t0), len = Math.min(n(dur), out.length - i0);
    const N = Math.max(2, Math.round(sr / f)), line = new Float32Array(N);
    const lp = bq('lp', 800 + 6000 * bright, 0.7);
    for (let i = 0; i < N; i++) line[i] = lp.run(rnd() * 2 - 1);
    // 撥弦位置造成的梳狀濾波
    const pk = Math.max(1, Math.round(N * pick)), tmp = line.slice();
    for (let i = 0; i < N; i++) line[i] = tmp[i] - tmp[(i + pk) % N] * 0.5;
    let p = 0, prev = 0;
    for (let i = 0; i < len; i++) {
      const cur = line[p];
      const nx = (cur + prev) * 0.5 * decay; prev = cur; line[p] = nx;
      p = (p + 1) % N;
      out[i0 + i] += cur * amp * Math.min(1, i / 30);
    }
  }
  // 太鼓膜面：圓膜模態比、擊點雜音、輕微下滑
  function drum(out, t0, f, amp, { tau = 0.35, tight = 0, stick = 0.4 } = {}) {
    const R = [1, 1.594, 2.136, 2.296, 2.653, 2.918, 3.156];
    const A = [1, 0.5, 0.32, 0.26, 0.18, 0.12, 0.08].map((x, k) => x * (k ? 1 - tight * 0.3 : 1));
    const T = R.map((r, k) => tau / (1 + k * 0.9) / (1 + tight));
    thump(out, t0, f * 1.18, f, tau, amp * 0.9, { glide: 0.03, h3: 0.05 });
    modal(out, t0, f, R.slice(1), A.slice(1), T.slice(1), amp * 0.55);
    noise(out, t0, 0.05, amp * stick, { color: 'white', type: 'bp', f: 900 + tight * 2500, q: 0.9, a: 0.0005, tau: 0.008 });
  }
  const sat = (out, k = 2) => { const nk = Math.tanh(k); for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * k) / nk; return out; };
  const gainAll = (out, g) => { for (let i = 0; i < out.length; i++) out[i] *= g; return out; };
  const normalize = (out, peak = 0.9) => { let m = 0; for (let i = 0; i < out.length; i++) m = Math.max(m, Math.abs(out[i])); if (m > 0) gainAll(out, peak / m); return out; };
  // 首尾交叉淡化成可無縫循環
  function loopify(out, fade = 0.25) {
    const f = n(fade), L = out.length - f, res = new Float32Array(L);
    for (let i = 0; i < L; i++) res[i] = out[i];
    for (let i = 0; i < f; i++) { const k = i / f; res[i] = out[L + i] * (1 - k) + out[i] * k; }
    return res;
  }
  const fadeTail = (out, sec = 0.02) => { const f = n(sec); for (let i = 0; i < f; i++) out[out.length - 1 - i] *= i / f; return out; };
  return { sr, rnd, rr, n, buf: (sec) => new Float32Array(n(sec)), noise, thump, modal, crackle, whoosh, pluck, drum, sat, gainAll, normalize, loopify, fadeTail, bq, src };
}

// 鐘、鉢、拍子木等的分音
const RIN = { r: [1, 2.71, 5.15, 8.25, 11.9], a: [1, 0.55, 0.3, 0.14, 0.06] };
const WOOD = { r: [1, 2.57, 4.8, 7.1], a: [1, 0.45, 0.2, 0.08] };
const STONE = { r: [1, 1.72, 2.61, 3.93, 5.2], a: [1, 0.7, 0.5, 0.3, 0.18] };
const GLASS = { r: [1, 2.32, 4.25, 6.63, 9.4], a: [1, 0.6, 0.35, 0.18, 0.1] };
const GONG = { r: [1, 1.48, 2.03, 2.71, 3.36, 4.12, 5.4], a: [1, 0.8, 0.6, 0.5, 0.35, 0.25, 0.15] };

// ---------------------------------------------------------------- 音色
// 每個 recipe：(D) → { data: Float32Array, loop?: bool }。長度在函式內決定。
export const RECIPES = {
  // 輕擊：拳頭打在身上的悶響＋布料拍擊＋短促的破聲
  hitL(D) {
    const o = D.buf(0.22), p = D.rr(0.9, 1.12);
    D.thump(o, 0, 150 * p, 72 * p, 0.04, 0.9);
    D.noise(o, 0, 0.12, 0.75, { color: 'pink', f: 1100 * p, q: 1.1, a: 0.0008, tau: 0.02 });
    D.noise(o, 0, 0.05, 0.35, { color: 'white', type: 'hp', f: 3200, q: 0.7, a: 0.0004, tau: 0.007 });
    return { data: D.sat(o, 1.6) };
  },
  hitM(D) {
    const o = D.buf(0.36), p = D.rr(0.9, 1.1);
    D.thump(o, 0, 120 * p, 50 * p, 0.075, 1.0);
    D.noise(o, 0, 0.2, 0.8, { color: 'pink', f: 760 * p, q: 1, a: 0.0008, tau: 0.035 });
    D.noise(o, 0, 0.06, 0.55, { color: 'white', f: 2600, q: 0.7, a: 0.0004, tau: 0.012 });
    D.noise(o, 0.004, 0.25, 0.45, { color: 'brown', type: 'lp', f: 320, q: 0.7, a: 0.003, tau: 0.08 });
    return { data: D.sat(o, 2.2) };
  },
  // 重擊：低沉的「咚」＋碎裂感＋碎屑
  hitH(D) {
    const o = D.buf(0.7), p = D.rr(0.9, 1.1);
    D.thump(o, 0, 100 * p, 32 * p, 0.17, 1.1);
    D.noise(o, 0, 0.35, 0.9, { color: 'pink', f: [1900 * p, 380], q: 0.9, a: 0.001, tau: 0.09 });
    D.noise(o, 0, 0.08, 0.6, { color: 'white', type: 'hp', f: 2400, q: 0.7, a: 0.0004, tau: 0.02 });
    D.crackle(o, 0.03, 0.4, 70, 0.28, { f: 1500, q: 1, decay: 0.12 });
    return { data: D.sat(o, 3) };
  },
  // 揮拳／踢腿的破空
  swing(D) {
    const o = D.buf(0.2);
    D.whoosh(o, 0, 0.17, D.rr(500, 700), D.rr(2200, 3200), 0.7, { q: 1.4, peak: 0.55 });
    return { data: o };
  },
  // 劍：金屬破空＋一點刃鳴
  slash(D) {
    const o = D.buf(0.45);
    D.whoosh(o, 0, 0.2, 900, 5200, 0.7, { q: 2, color: 'white', peak: 0.6 });
    D.modal(o, 0.1, D.rr(2500, 2900), [1, 2.4, 3.9], [0.4, 0.2, 0.08], [0.18, 0.1, 0.06], 0.5, { detune: 0.002 });
    return { data: o };
  },
  // 氣功彈發射：吸氣般的上掃＋轟的推出＋劈啪
  blast(D) {
    const o = D.buf(0.55), p = D.rr(0.92, 1.08);
    D.whoosh(o, 0, 0.14, 400 * p, 2400 * p, 0.5, { q: 1.2, peak: 0.9 });
    D.noise(o, 0.1, 0.4, 0.75, { color: 'pink', f: [1400 * p, 500 * p], q: 0.8, a: 0.004, tau: 0.11 });
    D.thump(o, 0.1, 170 * p, 60 * p, 0.05, 0.6);
    D.crackle(o, 0.1, 0.3, 140, 0.22, { type: 'hp', f: 3500, decay: 0.12 });
    return { data: D.sat(o, 2) };
  },
  explode(D) {
    const o = D.buf(1.6), p = D.rr(0.9, 1.1);
    D.thump(o, 0, 75 * p, 24 * p, 0.38, 1.2);
    D.noise(o, 0, 1.4, 1.0, { color: 'brown', type: 'lp', f: [5000, 160], q: 0.7, a: 0.004, tau: 0.38 });
    D.noise(o, 0, 0.9, 0.55, { color: 'pink', f: [2600, 300], q: 0.7, a: 0.002, tau: 0.18 });
    D.crackle(o, 0.05, 1.2, 80, 0.35, { f: 1200, q: 0.9, decay: 0.35 });
    return { data: D.sat(o, 2.5) };
  },
  // 集氣蓄力（循環）：帶顫動的能量嘶聲、電弧劈啪、低頻嗡鳴
  beamCharge(D) {
    const o = D.buf(2.25);
    D.noise(o, 0, 2.25, 0.55, { color: 'pink', f: 1500, q: 2.5, env: () => 1, am: (t) => 0.65 + 0.35 * Math.sin(t * 2 * Math.PI * 17) });
    D.noise(o, 0, 2.25, 0.5, { color: 'brown', type: 'lp', f: 260, q: 1, env: () => 1, am: (t) => 0.8 + 0.2 * Math.sin(t * 2 * Math.PI * 3) });
    D.crackle(o, 0, 2.25, 45, 0.45, { type: 'hp', f: 2800, grain: 0.003 });
    return { data: D.loopify(D.sat(o, 1.8)), loop: true };
  },
  // 光束（循環）：火焰般的轟鳴、低頻震動、劈啪
  beam(D) {
    const o = D.buf(2.25);
    D.noise(o, 0, 2.25, 1.0, { color: 'brown', type: 'lp', f: 520, q: 0.8, env: () => 1, am: (t) => 0.75 + 0.25 * Math.sin(t * 2 * Math.PI * 6.5) });
    D.noise(o, 0, 2.25, 0.55, { color: 'pink', f: 1100, q: 0.6, env: () => 1, am: (t) => 0.7 + 0.3 * Math.sin(t * 2 * Math.PI * 4.3 + 1) });
    D.crackle(o, 0, 2.25, 70, 0.3, { f: 3000, q: 0.9, grain: 0.003 });
    D.thump(o, 0, 46, 44, 9, 0.5, { a: 0.2, h3: 0.25 });
    return { data: D.loopify(D.sat(o, 2.6)), loop: true };
  },
  dash(D) {
    const o = D.buf(0.4);
    D.whoosh(o, 0, 0.36, D.rr(450, 650), D.rr(2600, 3600), 0.85, { q: 1.3, peak: 0.35 });
    D.noise(o, 0, 0.3, 0.2, { color: 'white', type: 'hp', f: 2000, env: (t) => Math.sin(Math.min(1, t / 0.3) * Math.PI), am: (t) => 0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 38) });
    return { data: o };
  },
  // 瞬間移動：短促上掃的「咻」
  vanish(D) {
    const o = D.buf(0.3);
    D.whoosh(o, 0, 0.09, 1200, 7500, 0.85, { q: 2.2, color: 'white', peak: 0.75 });
    D.whoosh(o, 0.08, 0.16, 6000, 1800, 0.35, { q: 1.5, color: 'white', peak: 0.2 });
    return { data: o };
  },
  freeze(D) {
    const o = D.buf(1.0);
    D.crackle(o, 0, 0.6, 260, 0.35, { type: 'hp', f: 4200, decay: 0.2, grain: 0.002 });
    for (let k = 0; k < 4; k++) D.modal(o, D.rr(0, 0.25), D.rr(1900, 3200), GLASS.r, GLASS.a, [0.35, 0.22, 0.14, 0.09, 0.06], 0.25);
    D.whoosh(o, 0, 0.6, 4000, 2500, 0.2, { q: 0.8, color: 'white', peak: 0.2 });
    return { data: o };
  },
  thunder(D) {
    const o = D.buf(1.6);
    D.crackle(o, 0, 0.14, 900, 1.0, { type: 'hp', f: 1400, grain: 0.0025 });
    D.crackle(o, 0.15, 0.25, 300, 0.4, { type: 'hp', f: 1800, grain: 0.0025, decay: 0.08 });
    D.noise(o, 0.03, 1.5, 1.0, { color: 'brown', type: 'lp', f: 200, q: 0.8, a: 0.03, tau: 0.5, am: (t) => 0.7 + 0.3 * Math.sin(t * 23) * Math.sin(t * 7.1) });
    return { data: D.sat(o, 2) };
  },
  // 重踏地面：大地的悶響＋碎石＋揚塵
  slam(D) {
    const o = D.buf(1.0);
    D.thump(o, 0, 62, 22, 0.3, 1.2);
    D.crackle(o, 0.03, 0.6, 70, 0.4, { f: 800, q: 0.9, decay: 0.2, grain: 0.006 });
    D.noise(o, 0, 0.8, 0.5, { color: 'brown', type: 'lp', f: 800, q: 0.7, a: 0.01, tau: 0.25 });
    return { data: D.sat(o, 2) };
  },
  // 防禦塔射擊：水晶共鳴＋氣流
  tower(D) {
    const o = D.buf(0.7);
    D.whoosh(o, 0, 0.18, 1000, 4200, 0.45, { q: 1.6, peak: 0.6 });
    D.modal(o, 0.02, D.rr(1700, 1900), GLASS.r, GLASS.a, [0.4, 0.25, 0.15, 0.1, 0.06], 0.4, { detune: 0.003 });
    D.thump(o, 0.02, 220, 110, 0.04, 0.4);
    return { data: o };
  },
  // 打在石塔上：石頭的悶敲＋碎礫
  towerHit(D) {
    const o = D.buf(0.4);
    D.modal(o, 0, D.rr(170, 210), STONE.r, STONE.a, [0.12, 0.09, 0.06, 0.04, 0.03], 0.9);
    D.crackle(o, 0, 0.18, 120, 0.3, { f: 2200, q: 1, decay: 0.06 });
    D.thump(o, 0, 130, 70, 0.05, 0.5);
    return { data: D.sat(o, 1.5) };
  },
  towerDown(D) {
    const o = D.buf(2.4);
    D.thump(o, 0, 60, 20, 0.6, 1.2);
    D.noise(o, 0, 2.2, 0.9, { color: 'brown', type: 'lp', f: 140, q: 0.8, a: 0.06, tau: 0.8 });
    for (let k = 0; k < 16; k++) D.modal(o, D.rr(0.05, 1.4), D.rr(110, 320), STONE.r, STONE.a, [0.1, 0.07, 0.05, 0.03, 0.02], D.rr(0.25, 0.6));
    D.crackle(o, 0.05, 1.8, 60, 0.35, { f: 1400, q: 0.8, decay: 0.7, grain: 0.006 });
    return { data: D.sat(o, 2) };
  },
  // 陶土小兵碎裂
  minionDie(D) {
    const o = D.buf(0.55);
    D.thump(o, 0, 210, 90, 0.04, 0.5);
    D.noise(o, 0, 0.15, 0.5, { color: 'white', type: 'hp', f: 2500, q: 0.7, a: 0.0005, tau: 0.04 });
    for (let k = 0; k < 9; k++) D.modal(o, D.rr(0, 0.28), D.rr(1800, 5200), [1, 2.3, 3.8], [1, 0.5, 0.2], [0.04, 0.025, 0.015], D.rr(0.15, 0.35));
    D.crackle(o, 0.01, 0.3, 90, 0.2, { f: 3000, q: 1, decay: 0.1 });
    return { data: o };
  },
  // 英雄倒地：身體摔落的重響
  heroDie(D) {
    const o = D.buf(1.0);
    D.whoosh(o, 0, 0.3, 600, 1800, 0.4, { q: 1.1 });
    D.thump(o, 0.22, 85, 30, 0.2, 1.1);
    D.noise(o, 0.22, 0.6, 0.45, { color: 'brown', type: 'lp', f: 600, q: 0.7, a: 0.005, tau: 0.2 });
    D.crackle(o, 0.24, 0.4, 50, 0.2, { f: 900, decay: 0.15 });
    return { data: D.sat(o, 2) };
  },
  // 升級：兩聲寺院的鈴（鉢）
  levelUp(D) {
    const o = D.buf(2.6);
    D.modal(o, 0, 660, RIN.r, RIN.a, [2.0, 1.1, 0.55, 0.3, 0.18], 0.55, { detune: 0.0015 });
    D.modal(o, 0.14, 990, RIN.r, RIN.a, [1.7, 0.9, 0.45, 0.25, 0.15], 0.4, { detune: 0.0015 });
    D.noise(o, 0, 0.6, 0.12, { color: 'white', type: 'hp', f: 6000, a: 0.002, tau: 0.25 });
    return { data: o };
  },
  // 氣力：柔和的氣息湧動＋小鈴
  ki(D) {
    const o = D.buf(0.5);
    D.noise(o, 0, 0.4, 0.45, { color: 'pink', f: [400, 900], q: 1.2, a: 0.05, tau: 0.08 });
    D.modal(o, 0.03, D.rr(1250, 1400), RIN.r, RIN.a, [0.3, 0.18, 0.1, 0.06, 0.04], 0.14);
    return { data: o };
  },
  kiFull(D) {
    const o = D.buf(1.6);
    D.noise(o, 0, 0.5, 0.4, { color: 'pink', f: [300, 1400], q: 1, a: 0.12, tau: 0.12 });
    D.modal(o, 0.1, 880, RIN.r, RIN.a, [1.2, 0.7, 0.35, 0.2, 0.12], 0.4, { detune: 0.0015 });
    return { data: o };
  },
  // 爆氣：氣焰轟然湧起
  spark(D) {
    const o = D.buf(1.5);
    D.noise(o, 0, 1.4, 1.0, { color: 'pink', f: [280, 1700], q: 0.8, env: (t) => (t < 0.35 ? t / 0.35 : Math.exp(-(t - 0.35) / 0.35)) });
    D.noise(o, 0, 1.4, 0.7, { color: 'brown', type: 'lp', f: 400, q: 0.8, a: 0.2, tau: 0.45 });
    D.thump(o, 0.02, 66, 24, 0.3, 1.0);
    D.crackle(o, 0.1, 1.1, 70, 0.3, { type: 'hp', f: 2600, decay: 0.5, grain: 0.003 });
    return { data: D.sat(o, 2.4) };
  },
  // 回城（循環）：風聲與風鈴
  recall(D) {
    const o = D.buf(3.25);
    D.noise(o, 0, 3.25, 0.35, { color: 'pink', f: 700, q: 0.5, env: () => 1, am: (t) => 0.6 + 0.4 * Math.sin(t * 2 * Math.PI * 0.31) });
    for (let k = 0; k < 9; k++) D.modal(o, D.rr(0, 2.6), D.rr(1500, 3000), [1, 2.76, 5.4], [1, 0.4, 0.15], [0.5, 0.25, 0.12], D.rr(0.08, 0.18));
    return { data: D.loopify(o), loop: true };
  },
  respawn(D) {
    const o = D.buf(1.6);
    D.drum(o, 0, 92, 0.9, { tau: 0.45 });
    D.modal(o, 0.12, 1320, RIN.r, RIN.a, [1.2, 0.6, 0.3, 0.2, 0.1], 0.3, { detune: 0.0015 });
    return { data: o };
  },
  // 選角：拍子木
  select(D) {
    const o = D.buf(0.35);
    D.modal(o, 0, D.rr(1750, 1850), WOOD.r, WOOD.a, [0.06, 0.035, 0.02, 0.012], 0.8);
    D.noise(o, 0, 0.03, 0.4, { color: 'white', f: 3000, q: 0.8, a: 0.0003, tau: 0.004 });
    D.modal(o, 0.004, D.rr(1580, 1650), WOOD.r, WOOD.a, [0.05, 0.03, 0.02, 0.01], 0.5);
    return { data: o };
  },
  ui(D) {
    const o = D.buf(0.12);
    D.modal(o, 0, D.rr(1150, 1300), WOOD.r, WOOD.a, [0.03, 0.018, 0.01, 0.006], 0.45);
    return { data: o };
  },
  // 勝利：太鼓連打＋大鼓＋箏的上行句＋鈴
  victory(D) {
    const o = D.buf(4.2);
    for (let k = 0; k < 9; k++) D.drum(o, 0.42 * (1 - Math.pow(0.86, k)) / (1 - 0.86) * 0.3, 140, 0.35 + k * 0.04, { tau: 0.18, tight: 0.4 });
    D.drum(o, 1.25, 70, 1.2, { tau: 0.8, stick: 0.5 });
    const sc = [293.7, 311.1, 392, 440, 466.2, 587.3, 622.3, 784];
    [0, 2, 3, 4, 5, 7].forEach((k, i) => D.pluck(o, 1.3 + i * 0.13, sc[k], 2.2, 0.5, { bright: 0.7, decay: 0.997 }));
    D.modal(o, 2.15, 587, RIN.r, RIN.a, [1.6, 0.9, 0.45, 0.25, 0.15], 0.35, { detune: 0.0015 });
    return { data: o };
  },
  // 敗北：低沉的箏下行與銅鑼
  defeat(D) {
    const o = D.buf(4.2);
    const sc = [293.7, 277.2, 220, 207.7, 146.8];
    sc.forEach((f, i) => D.pluck(o, i * 0.42, f, 2.4, 0.5, { bright: 0.35, decay: 0.9975 }));
    D.modal(o, 1.8, 72, GONG.r, GONG.a, [2.4, 1.8, 1.4, 1.0, 0.8, 0.6, 0.4], 0.6, { detune: 0.004, a: 0.01 });
    return { data: o };
  },
};

// 音樂用的單音：大太鼓、長胴太鼓、締太鼓、鉦、箏（都 → Float32Array）
export const MUSIC_RECIPES = {
  odaiko: (D) => { const o = D.buf(1.4); D.drum(o, 0, D.rr(62, 68), 1, { tau: 0.7, stick: 0.45 }); return o; },
  nagado: (D) => { const o = D.buf(0.8); D.drum(o, 0, D.rr(118, 128), 0.8, { tau: 0.32, tight: 0.2 }); return o; },
  rim: (D) => { const o = D.buf(0.15); D.modal(o, 0, D.rr(1500, 1700), WOOD.r, WOOD.a, [0.04, 0.02, 0.012, 0.008], 0.5); D.noise(o, 0, 0.02, 0.3, { color: 'white', f: 2800, a: 0.0003, tau: 0.003 }); return o; },
  shime: (D) => { const o = D.buf(0.3); D.drum(o, 0, D.rr(400, 430), 0.5, { tau: 0.09, tight: 1, stick: 0.6 }); return o; },
  kane: (D) => { const o = D.buf(0.8); D.modal(o, 0, D.rr(1180, 1240), [1, 1.53, 2.31, 3.17, 4.4], [1, 0.7, 0.5, 0.3, 0.2], [0.2, 0.14, 0.1, 0.07, 0.05], 0.35, { detune: 0.003 }); return o; },
};
export const KOTO_SCALE = [146.8, 155.6, 196, 220, 233.1, 293.7, 311.1, 392, 440, 466.2, 587.3]; // 都節音階（D、E♭、G、A、B♭）
export function koto(D, f) { const o = D.buf(2.4); D.pluck(o, 0, f, 2.4, 0.6, { bright: 0.55, decay: 0.9972, pick: 0.18 }); return o; }
