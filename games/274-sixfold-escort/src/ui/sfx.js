// 六器鏢行 — WebAudio 即時合成兵器、破罡裂帛與偃甲機關音效

export function createEscortSfx() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (muted) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch { return null; }
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function tone({ freq = 440, endFreq = null, type = 'sine', dur = 0.18, gain = 0.12, delay = 0 } = {}) {
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // 裂帛音效（罡氣危急與破罡瞬間）
  function playShieldBreak(isHero = false) {
    const notes = isHero ? [587.3, 523.2, 392.0, 293.6] : [659.2, 783.9, 1046.5];
    notes.forEach((f, idx) => {
      tone({ freq: f, endFreq: f * 0.72, type: 'triangle', dur: 0.24, gain: 0.14, delay: idx * 0.032 });
    });
    tone({ freq: 1480, endFreq: 190, type: 'sawtooth', dur: 0.28, gain: 0.10 });
  }

  function playSkill(weaponType = 'SPEAR', isTrue = false, isMech = false) {
    if (isMech) {
      tone({ freq: 110, endFreq: 42, type: 'sawtooth', dur: 0.48, gain: 0.18 });
      tone({ freq: 520, endFreq: 160, type: 'square', dur: 0.35, gain: 0.09, delay: 0.04 });
      return;
    }
    if (weaponType === 'THROWN' || weaponType === 'BOW') {
      tone({ freq: 980, endFreq: 320, type: 'triangle', dur: 0.14, gain: 0.10 });
      tone({ freq: 1320, endFreq: 480, type: 'sine', dur: 0.12, gain: 0.08, delay: 0.05 });
    } else if (weaponType === 'BLADE' || weaponType === 'FIST') {
      tone({ freq: 240, endFreq: 68, type: 'sawtooth', dur: 0.24, gain: 0.15 });
    } else {
      tone({ freq: 420, endFreq: 155, type: 'triangle', dur: 0.20, gain: 0.13 });
    }
    if (isTrue) {
      // 通玄：低鐘共鳴
      tone({ freq: 196, endFreq: 192, type: 'sine', dur: 0.55, gain: 0.16 });
      tone({ freq: 587.3, endFreq: 580, type: 'triangle', dur: 0.42, gain: 0.09, delay: 0.03 });
    }
  }

  function playDash() {
    tone({ freq: 520, endFreq: 880, type: 'sine', dur: 0.15, gain: 0.09 });
  }

  function playMechAwaken() {
    [130.8, 196.0, 261.6, 392.0].forEach((f, i) => {
      tone({ freq: f, endFreq: f * 1.04, type: 'sawtooth', dur: 0.45, gain: 0.09, delay: i * 0.06 });
    });
  }

  function playForge(success = true) {
    tone({ freq: 880, endFreq: 440, type: 'triangle', dur: 0.16, gain: 0.13 });
    if (success) {
      tone({ freq: 659.2, endFreq: 987.7, type: 'sine', dur: 0.32, gain: 0.12, delay: 0.08 });
    } else {
      tone({ freq: 220, endFreq: 140, type: 'sawtooth', dur: 0.22, gain: 0.09, delay: 0.08 });
    }
  }

  // 短促噪音（木匣扣合、印章落紙用）
  let noiseBuf = null;
  function noise({ dur = 0.06, gain = 0.1, freq = 1800, q = 1.2, delay = 0 } = {}) {
    const c = ensure();
    if (!c) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.25), c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // 朱印落紙：一聲悶響加紙面拍擊
  function playStamp() {
    tone({ freq: 140, endFreq: 70, type: 'sine', dur: 0.16, gain: 0.16 });
    noise({ dur: 0.08, gain: 0.12, freq: 900, q: 0.8 });
  }

  // 抽屜與頁籤：漆木輕扣
  function playUiTick() {
    noise({ dur: 0.035, gain: 0.07, freq: 2600, q: 3 });
    tone({ freq: 760, endFreq: 520, type: 'triangle', dur: 0.05, gain: 0.04 });
  }

  function playPotion() {
    tone({ freq: 523.2, endFreq: 784.0, type: 'sine', dur: 0.18, gain: 0.10 });
  }

  return {
    unlock: ensure,
    toggleMute: () => { muted = !muted; return muted; },
    setMuted: (m) => { muted = !!m; return muted; },
    isMuted: () => muted,
    playShieldBreak,
    playSkill,
    playDash,
    playMechAwaken,
    playForge,
    playPotion,
    playStamp,
    playUiTick,
  };
}
