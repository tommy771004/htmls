// WebAudio 程式合成音效：滑雪沙沙聲、刻滑刮雪聲、風聲 + 各種單發音效。不載入任何音檔。
import { config } from './config.js';
import { clamp } from './shared.js';

const LOCAL_DEFAULTS = config.audio; // 預設值唯一來源是 config.js（這裡不再重複寫數值）

function makeNoiseBuffer(ctx, seconds, pink) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (!pink) {
      d[i] = w * 0.5;
      continue;
    }
    // Paul Kellet pink noise
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return buf;
}

// 顆粒感振幅包絡：隨機階梯（15~40ms）平滑過渡，值域 [lo, 1]
function makeCrunchBuffer(ctx, seconds, lo) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let i = 0;
  let prev = 1;
  while (i < len) {
    const seg = Math.floor(ctx.sampleRate * (0.015 + Math.random() * 0.025));
    const target = lo + (1 - lo) * Math.pow(Math.random(), 0.6);
    for (let j = 0; j < seg && i < len; j++, i++) {
      const t = j / seg;
      d[i] = prev + (target - prev) * (t * t * (3 - 2 * t));
    }
    prev = target;
  }
  // 讓尾端接回開頭，避免 loop 爆音
  const fix = Math.min(len, Math.floor(ctx.sampleRate * 0.01));
  for (let k = 0; k < fix; k++) {
    const t = k / fix;
    d[len - fix + k] = d[len - fix + k] * (1 - t) + d[0] * t;
  }
  return buf;
}

// 單發音效時持續音（雪聲/風聲）壓低的相對量（× duckAmount），讓撞擊、旗門等聽得清楚又不必把峰值拉高
const DUCK = { crash: 1, landHard: 0.9, hit: 0.8, fence: 0.6, gate: 0.5, land: 0.5, jump: 0.3 };

export class AudioEngine {
  constructor(cfg = config) {
    this.C = { ...LOCAL_DEFAULTS, ...((cfg && cfg.audio) || {}) };
    this.ctx = null;
    this.muted = false;
    this.ready = false;
    this._last = { glide: -1, glideF: -1, skid: -1, skidF: -1, wind: -1, windF: -1, crunchRate: -1, rumble: -1, rumbleF: -1 };
    this._lastUpdate = 0;
    this._watchdog = null;
    this._lastPlay = Object.create(null);
  }

  init() {
    if (this.ctx) {
      this._resume();
      return;
    }
    const AC = typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
    if (!AC) return;
    try {
      const ctx = (this.ctx = new AC());
      const C = this.C;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : C.masterVolume;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -16;
      this.comp.knee.value = 12;
      this.comp.ratio.value = 4;
      this.comp.attack.value = 0.004;
      this.comp.release.value = 0.2;
      this.bus = ctx.createGain(); // 持續音
      this.sfx = ctx.createGain(); // 單發
      this.sfx.gain.value = C.sfxVolume;
      this.bus.connect(this.comp);
      this.sfx.connect(this.comp);
      this.comp.connect(this.master);
      this.master.connect(ctx.destination);

      this.white = makeNoiseBuffer(ctx, 2.0, false);
      this.pink = makeNoiseBuffer(ctx, 2.5, true);
      const crunch = makeCrunchBuffer(ctx, 3.0, 0.45);
      const t = ctx.currentTime;

      // (1) 滑雪沙沙聲：粉紅噪音 → bandpass → 顆粒 AM → gain
      this.glideSrc = this._loop(this.pink, 1);
      this.glideBP = ctx.createBiquadFilter();
      this.glideBP.type = 'bandpass';
      this.glideBP.frequency.value = C.glideFreqMin;
      this.glideBP.Q.value = 0.9;
      this.glideAM = ctx.createGain();
      this.glideAM.gain.value = 0;
      this.crunchSrc = this._loop(crunch, 1);
      this.crunchSrc.connect(this.glideAM.gain);
      this.glideGain = ctx.createGain();
      this.glideGain.gain.value = 0;
      this.glideSrc.connect(this.glideBP).connect(this.glideAM).connect(this.glideGain).connect(this.bus);
      // 低頻 rumble（板子壓雪的厚度感）
      this.rumbleLP = ctx.createBiquadFilter();
      this.rumbleLP.type = 'lowpass';
      this.rumbleLP.frequency.value = 220;
      this.rumbleGain = ctx.createGain();
      this.rumbleGain.gain.value = 0;
      this.glideSrc.connect(this.rumbleLP).connect(this.rumbleGain).connect(this.bus);

      // (2) 刻滑/側滑刮雪聲：白噪音 → highpass → bandpass → 顆粒 AM → gain
      this.skidSrc = this._loop(this.white, 1);
      this.skidHP = ctx.createBiquadFilter();
      this.skidHP.type = 'highpass';
      this.skidHP.frequency.value = 2000;
      this.skidBP = ctx.createBiquadFilter();
      this.skidBP.type = 'bandpass';
      this.skidBP.frequency.value = 3000;
      this.skidBP.Q.value = 1.1;
      this.skidAM = ctx.createGain();
      this.skidAM.gain.value = 0;
      this.skidCrunch = this._loop(crunch, 2.3);
      this.skidCrunch.connect(this.skidAM.gain);
      this.skidGain = ctx.createGain();
      this.skidGain.gain.value = 0;
      this.skidSrc.connect(this.skidHP).connect(this.skidBP).connect(this.skidAM).connect(this.skidGain).connect(this.bus);

      // (3) 風聲：粉紅噪音 → lowpass（LFO 調變）→ gain
      this.windSrc = this._loop(this.pink, 0.9);
      this.windLP = ctx.createBiquadFilter();
      this.windLP.type = 'lowpass';
      this.windLP.frequency.value = C.windFreqMin;
      this.windLP.Q.value = 2.5;
      this.windHP = ctx.createBiquadFilter();
      this.windHP.type = 'highpass';
      this.windHP.frequency.value = C.windHighpass;
      this.windHP.Q.value = 0.7;
      this.windLFO = ctx.createOscillator();
      this.windLFO.frequency.value = 0.17;
      this.windLFOGain = ctx.createGain();
      this.windLFOGain.gain.value = 220;
      this.windLFO.connect(this.windLFOGain).connect(this.windLP.frequency);
      this.windLFO2 = ctx.createOscillator();
      this.windLFO2.frequency.value = 0.41;
      this.windLFO2Gain = ctx.createGain();
      this.windLFO2Gain.gain.value = 0.25;
      this.windMod = ctx.createGain(); // 陣風起伏 1±0.25
      this.windMod.gain.value = 1;
      this.windLFO2.connect(this.windLFO2Gain).connect(this.windMod.gain);
      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;
      this.windSrc.connect(this.windHP).connect(this.windLP).connect(this.windMod).connect(this.windGain).connect(this.bus);
      this.windLFO.start(t);
      this.windLFO2.start(t);

      this.ready = true;
      this._lastUpdate = typeof performance !== 'undefined' ? performance.now() : 0;
      // 遊戲迴圈停止（暫停/分頁隱藏）時自動淡出持續音
      this._watchdog = setInterval(() => this._checkIdle(), 200);
      this._resume();
    } catch (e) {
      this.ctx = null;
      this.ready = false;
    }
  }

  _loop(buffer, rate) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.playbackRate.value = rate;
    s.start(this.ctx.currentTime, Math.random() * buffer.duration);
    return s;
  }

  _resume() {
    const ctx = this.ctx;
    if (ctx && ctx.state === 'suspended') {
      try {
        const p = ctx.resume();
        if (p && p.catch) p.catch(() => {});
      } catch (e) {
        /* ignore */
      }
    }
  }

  _set(param, key, value, tc, eps = 0.004) {
    const last = this._last[key];
    if (Math.abs(last - value) < eps) return;
    this._last[key] = value;
    param.setTargetAtTime(value, this.ctx.currentTime, tc);
  }

  _checkIdle() {
    if (!this.ready) return;
    const now = performance.now();
    if (now - this._lastUpdate > 300) this._silenceLoops(0.08);
  }

  _silenceLoops(tc) {
    this._set(this.glideGain.gain, 'glide', 0, tc, 1e-4);
    this._set(this.rumbleGain.gain, 'rumble', 0, tc, 1e-4);
    this._set(this.skidGain.gain, 'skid', 0, tc, 1e-4);
    this._set(this.windGain.gain, 'wind', 0, tc, 1e-4);
  }

  setMuted(b) {
    this.muted = !!b;
    if (!this.ready) return;
    const g = this.master.gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.setTargetAtTime(this.muted ? 0 : this.C.masterVolume, t, 0.06);
    if (!this.muted) this._resume();
  }

  update(dt, s) {
    if (!this.ready || !s) return;
    this._lastUpdate = performance.now();
    const C = this.C;
    const speed = Math.max(0, s.speed || 0);
    const state = s.state;
    const crashed = state === 'crashed';
    const air = state === 'air' || !s.grounded;
    const onSnow = !air && !crashed && state !== 'ready';
    const sp = clamp(speed / C.glideSpeedRef, 0, 1);
    const skid = clamp(s.skid || 0, 0, 1);
    const crouch = clamp(s.crouch || 0, 0, 1);

    // 雪聲：離地時快速淡出，著地時淡入
    const glide = onSnow ? C.glideVolume * Math.pow(sp, 0.8) : 0;
    const snowTc = onSnow ? 0.06 : air ? 0.035 : 0.25;
    this._set(this.glideGain.gain, 'glide', glide, snowTc);
    this._set(this.rumbleGain.gain, 'rumble', onSnow ? C.rumbleVolume * sp * (1 + crouch * 0.4) : 0, snowTc);
    this._set(this.rumbleLP.frequency, 'rumbleF', 160 + 160 * sp, 0.15, 4);
    const gf = C.glideFreqMin * Math.pow(C.glideFreqMax / C.glideFreqMin, sp) * (1 - crouch * 0.12);
    this._set(this.glideBP.frequency, 'glideF', gf, 0.1, 8);
    this._set(this.crunchSrc.playbackRate, 'crunchRate', 0.6 + sp * 1.6, 0.15, 0.02);

    // 刮雪聲
    const skidAmt = onSnow ? C.skidVolume * skid * clamp(speed / 20, 0, 1.2) : 0;
    this._set(this.skidGain.gain, 'skid', skidAmt, onSnow ? 0.05 : 0.035);
    this._set(this.skidBP.frequency, 'skidF', 2500 + 2500 * sp, 0.1, 10);

    // 風聲：速度平方，空中略大
    let w = clamp((speed - C.windSpeedMin) / (C.windSpeedRef - C.windSpeedMin), 0, 1);
    w = w * w * C.windVolume;
    if (air && state !== 'ready') w = Math.max(w * C.windAirBoost, C.windAirMin * clamp(speed / 10, 0, 1));
    this._set(this.windGain.gain, 'wind', w, 0.25);
    this._set(this.windLP.frequency, 'windF', C.windFreqMin + (C.windFreqMax - C.windFreqMin) * clamp(speed / C.windSpeedRef, 0, 1), 0.3, 10);
  }

  // ---------- 單發音效 ----------
  play(name) {
    if (!this.ready || this.muted) return;
    this._resume();
    const t = this.ctx.currentTime + 0.005;
    if (name === 'boost') {
      if (t - (this._lastPlay.boost || -9) < this.C.boostCooldown) return;
      this._lastPlay.boost = t;
    }
    const duck = DUCK[name];
    if (duck) this._duck(duck);
    switch (name) {
      case 'jump':
        this._noise({ t, dur: 0.28, type: 'bandpass', f0: 600, f1: 2600, q: 1.2, gain: 0.35, attack: 0.03 });
        this._tone({ t, dur: 0.16, type: 'sine', f0: 120, f1: 55, gain: 0.45, attack: 0.005 });
        break;
      case 'land':
        this._tone({ t, dur: 0.18, type: 'sine', f0: 95, f1: 45, gain: 0.6, attack: 0.004 });
        this._noise({ t, dur: 0.22, type: 'lowpass', f0: 1600, f1: 500, q: 0.7, gain: 0.45, attack: 0.004, pink: true });
        this._noise({ t: t + 0.02, dur: 0.14, type: 'bandpass', f0: 2500, f1: 1800, q: 1, gain: 0.18, attack: 0.003 });
        break;
      case 'landHard':
        this._tone({ t, dur: 0.32, type: 'sine', f0: 80, f1: 32, gain: 0.95, attack: 0.003 });
        this._tone({ t, dur: 0.12, type: 'triangle', f0: 160, f1: 70, gain: 0.3, attack: 0.002 });
        this._noise({ t, dur: 0.38, type: 'lowpass', f0: 1800, f1: 350, q: 0.7, gain: 0.7, attack: 0.003, pink: true });
        this._noise({ t: t + 0.03, dur: 0.25, type: 'bandpass', f0: 2800, f1: 1500, q: 0.9, gain: 0.3, attack: 0.003 });
        break;
      case 'crash':
        this._tone({ t, dur: 0.35, type: 'sine', f0: 85, f1: 30, gain: 1.0, attack: 0.003 });
        this._noise({ t, dur: 0.3, type: 'lowpass', f0: 2000, f1: 400, q: 0.7, gain: 0.7, attack: 0.003, pink: true });
        for (let i = 0; i < 4; i++) {
          const ti = t + 0.18 + i * (0.16 + Math.random() * 0.08);
          const g = 0.45 * (1 - i * 0.18);
          this._noise({ t: ti, dur: 0.16, type: 'lowpass', f0: 1300, f1: 400, q: 0.8, gain: g, attack: 0.01, pink: true });
          this._tone({ t: ti, dur: 0.12, type: 'sine', f0: 90 - i * 8, f1: 45, gain: g * 0.9, attack: 0.004 });
        }
        break;
      case 'gate':
        this._tone({ t, dur: 0.5, type: 'triangle', f0: 1046.5, gain: 0.3, attack: 0.004 });
        this._tone({ t, dur: 0.4, type: 'sine', f0: 2093, gain: 0.08, attack: 0.004 });
        this._tone({ t: t + 0.09, dur: 0.7, type: 'triangle', f0: 1568, gain: 0.3, attack: 0.004 });
        this._tone({ t: t + 0.09, dur: 0.5, type: 'sine', f0: 3136, gain: 0.06, attack: 0.004 });
        break;
      case 'hit':
        this._tone({ t, dur: 0.12, type: 'sine', f0: 190, f1: 120, gain: 0.8, attack: 0.002 });
        this._tone({ t, dur: 0.06, type: 'square', f0: 620, f1: 380, gain: 0.14, attack: 0.001 });
        this._noise({ t, dur: 0.08, type: 'bandpass', f0: 900, f1: 700, q: 4, gain: 0.8, attack: 0.001 });
        this._noise({ t: t + 0.02, dur: 0.3, type: 'lowpass', f0: 1400, f1: 500, q: 0.7, gain: 0.25, attack: 0.01, pink: true });
        break;
      case 'fence':
        this._noise({ t, dur: 0.05, type: 'bandpass', f0: 1500, f1: 1300, q: 6, gain: 0.95, attack: 0.001 });
        this._tone({ t, dur: 0.07, type: 'triangle', f0: 420, f1: 360, gain: 0.5, attack: 0.001 });
        this._noise({ t: t + 0.06, dur: 0.04, type: 'bandpass', f0: 1800, f1: 1600, q: 6, gain: 0.4, attack: 0.001 });
        this._tone({ t: t + 0.06, dur: 0.05, type: 'triangle', f0: 480, f1: 420, gain: 0.2, attack: 0.001 });
        break;
      case 'click':
        this._tone({ t, dur: 0.035, type: 'sine', f0: 1800, f1: 1400, gain: 0.22, attack: 0.001 });
        break;
      case 'gameover': {
        const notes = [523.25, 415.3, 329.63];
        for (let i = 0; i < 3; i++) {
          const ti = t + i * 0.24;
          const d = i === 2 ? 0.8 : 0.3;
          this._tone({ t: ti, dur: d, type: 'triangle', f0: notes[i], gain: 0.32, attack: 0.006 });
          this._tone({ t: ti, dur: d, type: 'sine', f0: notes[i] / 2, gain: 0.15, attack: 0.006 });
        }
        break;
      }
      case 'boost':
        this._noise({ t, dur: 0.4, type: 'bandpass', f0: 400, f1: 3200, q: 1.5, gain: 0.5, attack: 0.08 });
        this._tone({ t, dur: 0.35, type: 'sine', f0: 220, f1: 660, gain: 0.18, attack: 0.05 });
        break;
      default:
        break;
    }
  }

  _duck(k) {
    const g = this.bus.gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.setTargetAtTime(1 - this.C.duckAmount * k, t, 0.012);
    g.setTargetAtTime(1, t + 0.12, this.C.duckRelease);
  }

  _env(g, t, dur, peak, attack) {
    const p = g.gain;
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + attack);
    p.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  _tone({ t, dur, type, f0, f1, gain, attack }) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    this._env(g, t, dur, gain, attack);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _noise({ t, dur, type, f0, f1, q, gain, attack, pink }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = pink ? this.pink : this.white;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q || 1;
    const g = ctx.createGain();
    this._env(g, t, dur, gain, attack);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, Math.random() * (src.buffer.duration - dur - 0.1));
    src.stop(t + dur + 0.05);
  }
}
