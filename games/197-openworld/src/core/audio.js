// 全部用 Web Audio 即時合成（白噪音＋濾波、振盪器），不需要任何音檔。
// AudioContext 必須在使用者手勢後才能建立，所以由第一次鎖定滑鼠時呼叫 start()。
// 尚未 start（例如 ?debug 自動化測試）時，所有方法都是 no-op。

import { clamp } from './noise.js';

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.stepIndex = 0;
    this.rowIndex = 0;
    this.swimT = 0;
    this.wasSwimming = false;
  }

  start() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = (this.ctx = new Ctx());

    // master：音量 → 低通（潛入水中時壓低）→ 輸出
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 20000;
    this.master.connect(this.muffle).connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.rain = this.#loop('highpass', 1100, 0.4);
    this.wind = this.#loop('lowpass', 420, 0.8);
    this.fire = this.#loop('lowpass', 260, 0.5);

    // 引擎：鋸齒波過低通，頻率跟車速走
    this.engine = ctx.createOscillator();
    this.engine.type = 'sawtooth';
    this.engine.frequency.value = 45;
    const ef = ctx.createBiquadFilter();
    ef.type = 'lowpass';
    ef.frequency.value = 420;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engine.connect(ef).connect(this.engineGain).connect(this.master);
    this.engine.start();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  suspend() {
    this.ctx?.suspend();
  }

  #loop(type, freq, q) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.master);
    src.start(0, Math.random() * 2);
    return { gain, filter };
  }

  /** 一次性的噪音脈衝：腳步、水花、槍聲的高頻部分都用它 */
  #burst({ dur, freq, to = freq, q = 1, type = 'bandpass', gain, attack = 0.004 }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(to, 20), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }

  #tone({ freq, to = freq, dur, gain, type = 'sine' }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 20), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  shot() {
    this.#burst({ dur: 0.22, freq: 2600, to: 300, q: 0.4, type: 'lowpass', gain: 0.7, attack: 0.001 });
    this.#tone({ freq: 160, to: 45, dur: 0.16, gain: 0.6 });
  }

  dryFire() {
    this.#burst({ dur: 0.04, freq: 3200, q: 4, gain: 0.25, attack: 0.001 });
  }

  reload() {
    this.#burst({ dur: 0.05, freq: 1800, q: 5, gain: 0.3, attack: 0.001 });
    setTimeout(() => this.#burst({ dur: 0.07, freq: 1200, q: 4, gain: 0.35, attack: 0.001 }), 900);
  }

  swish() {
    this.#burst({ dur: 0.2, freq: 500, to: 2600, q: 2.5, gain: 0.3, attack: 0.05 });
  }

  thunk() {
    this.#tone({ freq: 220, to: 90, dur: 0.14, gain: 0.45, type: 'triangle' });
    this.#burst({ dur: 0.08, freq: 900, q: 1.5, gain: 0.3, attack: 0.001 });
  }

  pickup() {
    this.#tone({ freq: 620, to: 930, dur: 0.12, gain: 0.18 });
  }

  eat() {
    this.#burst({ dur: 0.12, freq: 700, q: 3, gain: 0.25 });
    setTimeout(() => this.#burst({ dur: 0.12, freq: 600, q: 3, gain: 0.25 }), 180);
  }

  thunder() {
    this.#burst({ dur: 3.2, freq: 260, to: 50, q: 0.5, type: 'lowpass', gain: 0.75, attack: 0.04 });
    this.#burst({ dur: 0.5, freq: 1800, to: 300, q: 0.4, type: 'lowpass', gain: 0.35, attack: 0.005 });
  }

  splash(strength = 1) {
    this.#burst({ dur: 0.45, freq: 1500, to: 500, q: 0.6, gain: 0.3 * strength, attack: 0.02 });
  }

  #step(inWater) {
    if (inWater) this.#burst({ dur: 0.25, freq: 1300, to: 600, q: 0.7, gain: 0.2, attack: 0.01 });
    else this.#burst({ dur: 0.09, freq: 700 + Math.random() * 400, q: 0.9, gain: 0.14, attack: 0.003 });
  }

  /** 每個 frame 更新環境音與跟狀態連動的聲音 */
  update(dt, game) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const { env, player, campfire, boat } = game;
    const t = ctx.currentTime;
    const under = player.headUnderwater;
    this.muffle.frequency.setTargetAtTime(under ? 420 : 20000, t, 0.08);

    this.rain.gain.gain.setTargetAtTime(env.w.rain * 0.22, t, 0.4);
    const gust = 0.7 + 0.3 * Math.sin(env.elapsed * 0.6) * Math.sin(env.elapsed * 0.17 + 1);
    this.wind.gain.gain.setTargetAtTime(clamp(env.wind.strength, 0, 1.2) * 0.13 * gust, t, 0.3);
    this.wind.filter.frequency.setTargetAtTime(300 + 260 * gust * env.wind.strength, t, 0.3);

    // 營火：低頻底噪＋隨機劈啪聲，音量隨距離衰減
    const d = Math.hypot(player.pos.x - campfire.position.x, player.pos.z - campfire.position.z);
    const near = clamp(1 - d / 22, 0, 1) ** 2;
    this.fire.gain.gain.setTargetAtTime(near * 0.16, t, 0.2);
    if (near > 0.02 && Math.random() < dt * 9) {
      this.#burst({ dur: 0.03 + Math.random() * 0.04, freq: 1500 + Math.random() * 2500, q: 3, gain: near * (0.1 + Math.random() * 0.25), attack: 0.001 });
    }

    if (player.swimming && !this.wasSwimming && !player.vehicle) this.splash(1);
    this.wasSwimming = player.swimming;

    const v = player.vehicle;
    const driving = v && v !== boat;
    this.engineGain.gain.setTargetAtTime(driving ? 0.09 : 0, t, 0.15);
    if (driving) this.engine.frequency.setTargetAtTime(42 + Math.abs(v.speed) * 6.5, t, 0.08);

    if (v === boat) {
      // 每划一下（rowPhase 過半圈）一聲水花
      const idx = Math.floor((boat.rowPhase + Math.PI * 0.75) / (Math.PI * 2));
      if (idx !== this.rowIndex) {
        this.rowIndex = idx;
        this.splash(0.7);
      }
    } else if (!v) {
      if (player.swimming) {
        if (player.moveSpeed > 0.6) {
          this.swimT -= dt;
          if (this.swimT <= 0) {
            this.swimT = 0.75;
            if (!under) this.splash(0.6);
          }
        }
      } else if (player.onGround && player.moveSpeed > 0.5) {
        const idx = Math.floor(player.bob / Math.PI);
        if (idx !== this.stepIndex) {
          this.stepIndex = idx;
          this.#step(player.pos.y < -0.15);
        }
      }
    }
  }
}
