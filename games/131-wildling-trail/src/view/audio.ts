// WebAudio 即時合成的音效。只在第一次使用者互動後建立 AudioContext，
// 設定關閉音效時完全不發聲。

import type { Sfx } from '../app/types';

type Note = { f: number; d: number; t?: number; type?: OscillatorType; v?: number; slide?: number };

const SEQ: Record<Sfx | 'hit' | 'hitSuper' | 'faint' | 'throw' | 'shake' | 'caught' | 'attack' | 'status', Note[]> = {
  cursor: [{ f: 880, d: 0.03, type: 'square', v: 0.05 }],
  confirm: [{ f: 988, d: 0.05, type: 'square', v: 0.06 }],
  cancel: [{ f: 523, d: 0.06, type: 'square', v: 0.05 }],
  error: [{ f: 196, d: 0.12, type: 'square', v: 0.07 }, { f: 165, d: 0.12, t: 0.1, type: 'square', v: 0.07 }],
  bump: [{ f: 90, d: 0.07, type: 'triangle', v: 0.12 }],
  step: [{ f: 140, d: 0.02, type: 'triangle', v: 0.03 }],
  talk: [{ f: 660, d: 0.04, type: 'square', v: 0.04 }],
  buy: [{ f: 1047, d: 0.06, type: 'square', v: 0.06 }, { f: 1319, d: 0.1, t: 0.07, type: 'square', v: 0.06 }],
  heal: [523, 659, 784, 1047].map((f, i) => ({ f, d: 0.14, t: i * 0.12, type: 'triangle' as const, v: 0.09 })),
  save: [{ f: 784, d: 0.08, type: 'triangle', v: 0.08 }, { f: 1175, d: 0.14, t: 0.09, type: 'triangle', v: 0.08 }],
  pickup: [{ f: 784, d: 0.08, type: 'square', v: 0.06 }, { f: 988, d: 0.08, t: 0.08, type: 'square', v: 0.06 }, { f: 1319, d: 0.16, t: 0.16, type: 'square', v: 0.06 }],
  encounter: [0, 1, 2, 3, 4, 5].map((i) => ({ f: i % 2 ? 330 : 440, d: 0.07, t: i * 0.07, type: 'sawtooth' as const, v: 0.05 })),
  levelup: [523, 659, 784, 1047, 784, 1047].map((f, i) => ({ f, d: 0.1, t: i * 0.09, type: 'square' as const, v: 0.06 })),
  evolve: [392, 440, 494, 523, 587, 659, 698, 784].map((f, i) => ({ f, d: 0.12, t: i * 0.1, type: 'triangle' as const, v: 0.09 })),
  clear: [523, 659, 784, 1047, 988, 1047, 1319].map((f, i) => ({ f, d: 0.2, t: i * 0.16, type: 'square' as const, v: 0.06 })),
  attack: [{ f: 600, d: 0.08, type: 'sawtooth', v: 0.05, slide: 200 }],
  hit: [{ f: 120, d: 0.1, type: 'square', v: 0.1, slide: 60 }],
  hitSuper: [{ f: 160, d: 0.08, type: 'square', v: 0.12, slide: 50 }, { f: 90, d: 0.12, t: 0.07, type: 'square', v: 0.12 }],
  faint: [{ f: 440, d: 0.5, type: 'triangle', v: 0.1, slide: 80 }],
  throw: [{ f: 300, d: 0.25, type: 'triangle', v: 0.06, slide: 900 }],
  shake: [{ f: 220, d: 0.05, type: 'square', v: 0.06 }],
  caught: [{ f: 1047, d: 0.1, type: 'square', v: 0.07 }, { f: 1568, d: 0.25, t: 0.1, type: 'square', v: 0.07 }],
  status: [{ f: 330, d: 0.18, type: 'sine', v: 0.08, slide: 220 }],
};

export type SoundId = keyof typeof SEQ;

export class Sound {
  private ctx: AudioContext | null = null;
  enabled = true;

  /** 必須在使用者手勢的事件處理中呼叫。 */
  unlock(): void {
    if (this.ctx) return;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) this.ctx = new Ctor();
    } catch {
      this.ctx = null;
    }
  }

  play(id: SoundId): void {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime + 0.005;
    for (const n of SEQ[id]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + (n.t ?? 0);
      osc.type = n.type ?? 'square';
      osc.frequency.setValueAtTime(n.f, start);
      if (n.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, n.slide), start + n.d);
      gain.gain.setValueAtTime(n.v ?? 0.06, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + n.d);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + n.d + 0.02);
    }
  }
}
