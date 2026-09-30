// 預設單發音效：全部 WebAudio 即時合成。簽名 fn(ctx, destination, params)，params = {truck, a, b}。
// 回傳值（可選）是這個音效的長度（秒），給同時發聲數計算用。

const noiseCache = new WeakMap();

// 2 秒白噪音，每個 context 建一次
export function noiseBuffer(ctx) {
  let b = noiseCache.get(ctx);
  if (b) return b;
  const len = Math.floor(ctx.sampleRate * 2);
  b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  let seed = 0x9e3779b9;
  for (let i = 0; i < len; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    d[i] = ((seed >>> 0) / 4294967296) * 2 - 1;
  }
  noiseCache.set(ctx, b);
  return b;
}

export function noise(ctx, t, dur, offset = Math.random() * 1.5) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx);
  s.loop = true;
  s.start(t, offset);
  s.stop(t + dur + 0.05);
  return s;
}

// 衰減包絡：attack 後以指數降到幾乎無聲
export function env(ctx, t, peak, attack, decay) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

function tone(ctx, dest, { type = 'sine', f0, f1 = f0, t = ctx.currentTime, dur = 0.2, peak = 0.3, attack = 0.004, glide = dur }) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + glide);
  const g = env(ctx, t, peak, attack, dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + attack + dur + 0.05);
  return o;
}

function filt(ctx, type, f, q = 0.8) {
  const bq = ctx.createBiquadFilter();
  bq.type = type;
  bq.frequency.value = f;
  bq.Q.value = q;
  return bq;
}

function burst(ctx, dest, { t = ctx.currentTime, dur = 0.2, peak = 0.3, type = 'bandpass', f = 1000, f1 = f, q = 0.8, attack = 0.003 }) {
  const src = noise(ctx, t, attack + dur);
  const bq = filt(ctx, type, f, q);
  bq.frequency.setValueAtTime(f, t);
  if (f1 !== f) bq.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + attack + dur);
  const g = env(ctx, t, peak, attack, dur);
  src.connect(bq).connect(g).connect(dest);
}

const lvl = (a, lo = 0.25) => lo + (1 - lo) * Math.max(0, Math.min(1, +a || 0));

export const SFX = {
  countdown(ctx, dest) {
    tone(ctx, dest, { type: 'square', f0: 587, dur: 0.16, peak: 0.16 });
    tone(ctx, dest, { type: 'sine', f0: 1174, dur: 0.12, peak: 0.08 });
    return 0.2;
  },
  // 起跑汽笛：兩支鋸齒波疊成空氣喇叭
  go(ctx, dest) {
    const t = ctx.currentTime;
    const lp = filt(ctx, 'lowpass', 2400, 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.03);
    g.gain.setValueAtTime(0.22, t + 0.62);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    lp.connect(g).connect(dest);
    for (const f of [311, 370, 466]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.94, t);
      o.frequency.linearRampToValueAtTime(f, t + 0.06);
      o.connect(lp);
      o.start(t);
      o.stop(t + 0.95);
    }
    return 0.9;
  },
  takeoff(ctx, dest, p) {
    burst(ctx, dest, { f: 500, f1: 1800, dur: 0.28, peak: 0.07 * lvl(p.gain, 0.5), q: 1.4 });
    return 0.3;
  },
  // 落地：低頻撞擊 + 土聲，依衝擊大小
  land(ctx, dest, p) {
    const k = lvl(p.a, 0.2);
    tone(ctx, dest, { f0: 95, f1: 38, dur: 0.22 + k * 0.15, peak: 0.45 * k, glide: 0.18 });
    burst(ctx, dest, { type: 'lowpass', f: 900, f1: 200, dur: 0.18 + 0.1 * k, peak: 0.25 * k });
    if (k > 0.6) tone(ctx, dest, { type: 'triangle', f0: 210, f1: 180, dur: 0.12, peak: 0.08 * k });
    return 0.4;
  },
  // 濺水：帶通噪音快起慢收 + 高頻水花
  splash(ctx, dest, p) {
    const k = Math.max(0.3, Math.min(1, (+p.a || 8) / 16));
    const t = ctx.currentTime;
    burst(ctx, dest, { t, type: 'bandpass', f: 700, f1: 1600, dur: 0.45 * k + 0.15, peak: 0.32 * k, q: 0.6, attack: 0.02 });
    burst(ctx, dest, { t: t + 0.03, type: 'highpass', f: 3500, dur: 0.35 * k, peak: 0.12 * k, q: 0.5 });
    for (let i = 0; i < 4; i++) {
      tone(ctx, dest, { f0: 900 + Math.random() * 900, f1: 400, t: t + 0.05 + Math.random() * 0.3, dur: 0.05, peak: 0.04 * k, glide: 0.05 });
    }
    return 0.6;
  },
  // 泥巴：低通噪音加上掃頻的「啵」
  mud(ctx, dest) {
    const t = ctx.currentTime;
    burst(ctx, dest, { t, type: 'lowpass', f: 700, f1: 220, dur: 0.3, peak: 0.28, q: 3 });
    tone(ctx, dest, { t: t + 0.04, f0: 160, f1: 70, dur: 0.18, peak: 0.18, glide: 0.14 });
    tone(ctx, dest, { t: t + 0.14, f0: 240, f1: 120, dur: 0.1, peak: 0.08, glide: 0.08 });
    return 0.35;
  },
  // 卡車互撞：鈑金的非諧波敲擊 + 悶響
  truck_hit(ctx, dest, p) {
    const k = lvl(p.a, 0.25);
    const t = ctx.currentTime;
    for (const [f, a] of [[187, 0.18], [283, 0.12], [431, 0.09], [659, 0.05]]) {
      tone(ctx, dest, { type: 'triangle', f0: f, f1: f * 0.92, t, dur: 0.18 + 0.1 * k, peak: a * k });
    }
    burst(ctx, dest, { t, type: 'bandpass', f: 1400, f1: 500, dur: 0.1, peak: 0.25 * k, q: 1.2 });
    tone(ctx, dest, { t, f0: 80, f1: 45, dur: 0.15, peak: 0.3 * k });
    return 0.3;
  },
  // 撞牆（輪胎堆、乾草、土堤）：比較悶的橡膠撞擊
  wall_hit(ctx, dest, p) {
    const k = lvl(p.a, 0.2);
    const t = ctx.currentTime;
    tone(ctx, dest, { t, f0: 120, f1: 42, dur: 0.2 + 0.1 * k, peak: 0.42 * k, glide: 0.15 });
    burst(ctx, dest, { t, type: 'lowpass', f: 600, f1: 150, dur: 0.16, peak: 0.3 * k, q: 1 });
    tone(ctx, dest, { t: t + 0.02, type: 'square', f0: 140, f1: 110, dur: 0.06, peak: 0.05 * k });
    return 0.3;
  },
  // 氮氣：嘶一聲的掃頻 + 低頻推力
  nitro(ctx, dest) {
    const t = ctx.currentTime;
    burst(ctx, dest, { t, type: 'bandpass', f: 380, f1: 3200, dur: 0.75, peak: 0.26, q: 0.9, attack: 0.04 });
    tone(ctx, dest, { t, type: 'sawtooth', f0: 55, f1: 110, dur: 0.6, peak: 0.12, attack: 0.03 });
    return 0.8;
  },
  pickup(ctx, dest, p) {
    const t = ctx.currentTime;
    if ((p.a | 0) === 2) {
      // 錢袋：收銀機叮噹
      burst(ctx, dest, { t, type: 'highpass', f: 2500, dur: 0.03, peak: 0.12 });
      tone(ctx, dest, { t: t + 0.02, f0: 1568, dur: 0.35, peak: 0.12 });
      tone(ctx, dest, { t: t + 0.09, f0: 2093, dur: 0.5, peak: 0.12 });
      tone(ctx, dest, { t: t + 0.09, f0: 2093 * 2.76, dur: 0.12, peak: 0.02 });
    } else {
      // 氮氣瓶：上行琶音
      [784, 988, 1175, 1568].forEach((f, i) => tone(ctx, dest, { t: t + i * 0.045, type: 'triangle', f0: f, dur: 0.14, peak: 0.13 }));
    }
    return 0.6;
  },
  lap(ctx, dest) {
    const t = ctx.currentTime;
    tone(ctx, dest, { t, type: 'triangle', f0: 988, dur: 0.16, peak: 0.16 });
    tone(ctx, dest, { t: t + 0.12, type: 'triangle', f0: 1319, dur: 0.3, peak: 0.16 });
    return 0.45;
  },
  // 最後一圈：銅鈴（非諧波泛音），敲兩下
  final_lap(ctx, dest) {
    const t = ctx.currentTime;
    for (const dt of [0, 0.28]) {
      for (const [r, a, d] of [[1, 0.16, 1.2], [2.76, 0.07, 0.6], [5.4, 0.04, 0.3], [0.5, 0.05, 1.4]]) {
        tone(ctx, dest, { t: t + dt, f0: 740 * r, dur: d, peak: a, attack: 0.002 });
      }
    }
    return 1.6;
  },
  // 完賽：群眾歡呼（多段帶通噪音 + 隨機起伏）+ 口哨
  finish(ctx, dest, p) {
    const t = ctx.currentTime;
    const k = (p.a | 0) === 1 ? 1 : (p.a | 0) === 2 ? 0.8 : 0.55;
    const dur = 2.8;
    for (const [f, q, a] of [[900, 0.7, 0.2], [1700, 1.1, 0.12], [420, 0.9, 0.12]]) {
      const src = noise(ctx, t, dur);
      const bq = filt(ctx, 'bandpass', f, q);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(a * k, t + 0.35);
      for (let s = 0.4; s < dur - 0.6; s += 0.14) g.gain.linearRampToValueAtTime(a * k * (0.65 + Math.random() * 0.5), t + s);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      src.connect(bq).connect(g).connect(dest);
    }
    if (k === 1) {
      tone(ctx, dest, { t: t + 0.3, f0: 1800, f1: 2600, dur: 0.25, peak: 0.07, glide: 0.2 });
      tone(ctx, dest, { t: t + 0.6, f0: 2600, f1: 1500, dur: 0.35, peak: 0.07, glide: 0.3 });
    }
    return dur;
  },
  overtake(ctx, dest) {
    const t = ctx.currentTime;
    tone(ctx, dest, { t, type: 'square', f0: 660, dur: 0.06, peak: 0.06 });
    tone(ctx, dest, { t: t + 0.06, type: 'square', f0: 880, dur: 0.1, peak: 0.06 });
    return 0.2;
  },
  // 介面：木頭看板的敲擊感
  ui_move(ctx, dest) {
    tone(ctx, dest, { type: 'triangle', f0: 1250, f1: 900, dur: 0.035, peak: 0.08, glide: 0.03 });
    return 0.05;
  },
  ui_confirm(ctx, dest) {
    const t = ctx.currentTime;
    tone(ctx, dest, { t, type: 'triangle', f0: 660, dur: 0.07, peak: 0.12 });
    tone(ctx, dest, { t: t + 0.06, type: 'triangle', f0: 990, dur: 0.12, peak: 0.12 });
    return 0.2;
  },
  ui_back(ctx, dest) {
    const t = ctx.currentTime;
    tone(ctx, dest, { t, type: 'triangle', f0: 740, dur: 0.06, peak: 0.1 });
    tone(ctx, dest, { t: t + 0.06, type: 'triangle', f0: 494, dur: 0.1, peak: 0.1 });
    return 0.18;
  },
  purchase(ctx, dest) {
    const t = ctx.currentTime;
    burst(ctx, dest, { t, type: 'bandpass', f: 3000, dur: 0.04, peak: 0.14, q: 2 });
    burst(ctx, dest, { t: t + 0.07, type: 'bandpass', f: 2200, dur: 0.05, peak: 0.1, q: 2 });
    tone(ctx, dest, { t: t + 0.12, f0: 2349, dur: 0.6, peak: 0.12 });
    tone(ctx, dest, { t: t + 0.12, f0: 2349 * 2.4, dur: 0.2, peak: 0.03 });
    tone(ctx, dest, { t: t + 0.12, type: 'triangle', f0: 587, dur: 0.25, peak: 0.08 });
    return 0.75;
  },
};
