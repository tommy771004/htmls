// Groundline（267）WebAudio 即時音效合成（點擊、派車確認、延誤警示、空橋對接、離場提示）

let ctx = null;
let muted = false;

function ensureCtx() {
  if (muted) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

export function isMuted() {
  return muted;
}

export function setMuted(val) {
  muted = !!val;
  return muted;
}

export function playTone(type = 'click') {
  const c = ensureCtx();
  if (!c) return;
  const now = c.currentTime;

  if (type === 'click') {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.045);
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(g).connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  } else if (type === 'dispatch') {
    // 航空無線電雙音確認 (SELCAL / ACARS chime)
    [523.25, 659.25].forEach((freq, i) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.075);
      g.gain.setValueAtTime(0.07, now + i * 0.075);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.075 + 0.14);
      osc.connect(g).connect(c.destination);
      osc.start(now + i * 0.075);
      osc.stop(now + i * 0.075 + 0.15);
    });
  } else if (type === 'warn') {
    // 延誤警示雙短音
    [440, 370].forEach((freq, i) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.11);
      g.gain.setValueAtTime(0.055, now + i * 0.11);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.1);
      osc.connect(g).connect(c.destination);
      osc.start(now + i * 0.11);
      osc.stop(now + i * 0.11 + 0.11);
    });
  } else if (type === 'depart') {
    // 航班準點推出柔和三和弦
    [440, 554.37, 659.25].forEach((freq, i) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      g.gain.setValueAtTime(0.05, now + i * 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.22);
      osc.connect(g).connect(c.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.24);
    });
  }
}
