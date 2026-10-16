// Procedural WebAudio soundscape & synthesizer:
// - Rain patter & wet tire hiss (filtered pink/white noise)
// - Cyber-Quadra V8 / Turbine engine RPM + boost whine + tire drift screech
// - City cyberpunk drone pad
// - PULSE Nightclub 124 BPM techno beat (spatialized around (0, 0, -2))
// - AFTERGLOW Bar 92 BPM synth-chill groove (spatialized around (-60, 0, 0))
// - One-shot SFX (door/car enter-exit, boost trigger, drink clink, spray paint)

export class Soundscape {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.started = false;
    this.masterGain = null;
    this.rainGain = null;
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.screechGain = null;
    this.clubGain = null;
    this.barGain = null;
    this.stepTimer = 0;
    this.stepIndex = 0;
    this.barStepTimer = 0;
    this.barStepIndex = 0;
  }

  init() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.started = true;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.42;
    this.masterGain.connect(this.ctx.destination);

    // Create shared noise buffer (2 seconds)
    const sampleRate = this.ctx.sampleRate;
    const noiseLen = sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, noiseLen, sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < noiseLen; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    // 1. Rain Loop
    const rainSource = this.ctx.createBufferSource();
    rainSource.buffer = this.noiseBuffer;
    rainSource.loop = true;
    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1350;
    rainFilter.Q.value = 0.7;
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0.24;
    rainSource.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);
    rainSource.start();

    // 2. City Vangelis Sub-Drone
    const droneOsc = this.ctx.createOscillator();
    droneOsc.type = 'sawtooth';
    droneOsc.frequency.value = 55; // A1
    const droneFilter = this.ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 140;
    const droneGain = this.ctx.createGain();
    droneGain.gain.value = 0.08;
    droneOsc.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(this.masterGain);
    droneOsc.start();

    // 3. Vehicle Engine Synth
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 48;

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.value = 96;

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 260;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);
    this.engineOsc1.start();
    this.engineOsc2.start();

    // 4. Tire Drift / Screech Noise
    const screechSrc = this.ctx.createBufferSource();
    screechSrc.buffer = this.noiseBuffer;
    screechSrc.loop = true;
    const screechFilter = this.ctx.createBiquadFilter();
    screechFilter.type = 'bandpass';
    screechFilter.frequency.value = 2100;
    screechFilter.Q.value = 4.5;
    this.screechGain = this.ctx.createGain();
    this.screechGain.gain.value = 0;
    screechSrc.connect(screechFilter);
    screechFilter.connect(this.screechGain);
    this.screechGain.connect(this.masterGain);
    screechSrc.start();

    // 5. Club & Bar bus gains
    this.clubGain = this.ctx.createGain();
    this.clubGain.gain.value = 0;
    this.clubFilter = this.ctx.createBiquadFilter();
    this.clubFilter.type = 'lowpass';
    this.clubFilter.frequency.value = 400;
    this.clubGain.connect(this.clubFilter);
    this.clubFilter.connect(this.masterGain);

    this.barGain = this.ctx.createGain();
    this.barGain.gain.value = 0;
    this.barGain.connect(this.masterGain);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (!this.started) this.init();
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.42, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  triggerClubStep(step) {
    if (!this.ctx || this.muted || this.clubGain.gain.value < 0.01) return;
    const now = this.ctx.currentTime;

    // 4-on-the-floor techno kick (steps 0, 4, 8, 12)
    if (step % 4 === 0) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(135, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.11);
      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.clubGain);
      osc.start(now);
      osc.stop(now + 0.23);
    }

    // Offbeat hi-hat (steps 2, 6, 10, 14)
    if (step % 4 === 2) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 5500;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      src.connect(hp);
      hp.connect(gain);
      gain.connect(this.clubGain);
      src.start(now);
      src.stop(now + 0.08);
    }

    // Cyberpunk acid bassline (16-step pattern)
    const bassNotes = [55, 55, 65.41, 55, 73.42, 55, 61.74, 55, 55, 55, 65.41, 82.41, 73.42, 65.41, 61.74, 55];
    const freq = bassNotes[step % 16];
    const bOsc = this.ctx.createOscillator();
    bOsc.type = 'sawtooth';
    bOsc.frequency.setValueAtTime(freq, now);
    const bFilt = this.ctx.createBiquadFilter();
    bFilt.type = 'lowpass';
    bFilt.Q.value = 5.0;
    bFilt.frequency.setValueAtTime(step % 2 === 0 ? 950 : 480, now);
    bFilt.frequency.exponentialRampToValueAtTime(140, now + 0.11);
    const bGain = this.ctx.createGain();
    bGain.gain.setValueAtTime(0.24, now);
    bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    bOsc.connect(bFilt);
    bFilt.connect(bGain);
    bGain.connect(this.clubGain);
    bOsc.start(now);
    bOsc.stop(now + 0.13);
  }

  triggerBarStep(step) {
    if (!this.ctx || this.muted || this.barGain.gain.value < 0.01) return;
    const now = this.ctx.currentTime;
    // Warm lo-fi synth chords & plucks
    const arpNotes = [220, 261.63, 329.63, 392.0, 329.63, 293.66, 261.63, 196.0];
    if (step % 2 === 0) {
      const freq = arpNotes[(step / 2) % arpNotes.length];
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(this.barGain);
      osc.start(now);
      osc.stop(now + 0.36);
    }
  }

  playSFX(type) {
    if (!this.started) this.init();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);

    if (type === 'door') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.14);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.17);
    } else if (type === 'drink') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1180, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.18);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.26);
    } else if (type === 'paint') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.22);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  }

  update(dt, state) {
    if (!this.started || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    // 1. Rain intensity (slightly muffled when inside a building)
    const inside = Boolean(state.insideVenue);
    this.rainGain.gain.setTargetAtTime(inside ? 0.08 : 0.24, now, 0.15);

    // 2. Vehicle engine & drift screech
    if (state.mode === 'driving') {
      const spdRatio = Math.min(1, Math.abs(state.speedKmh) / 145);
      const boostAdd = state.boosting ? 35 : 0;
      const baseFreq = 46 + spdRatio * 125 + boostAdd;
      this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.04);
      this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.98, now, 0.04);
      this.engineFilter.frequency.setTargetAtTime(260 + spdRatio * 1400 + boostAdd * 15, now, 0.05);
      this.engineGain.gain.setTargetAtTime(0.14 + spdRatio * 0.14, now, 0.06);

      const screechLevel = state.drifting && Math.abs(state.speedKmh) > 25 ? 0.14 : 0;
      this.screechGain.gain.setTargetAtTime(screechLevel, now, 0.05);
    } else {
      this.engineGain.gain.setTargetAtTime(0, now, 0.1);
      this.screechGain.gain.setTargetAtTime(0, now, 0.05);
    }

    // 3. Spatialized PULSE Nightclub music (center at (0, -2))
    const dxClub = state.pos.x - 0;
    const dzClub = state.pos.z - -2;
    const distClub = Math.hypot(dxClub, dzClub);
    const clubVol = Math.max(0, 1 - distClub / 45) * 0.55;
    this.clubGain.gain.setTargetAtTime(clubVol, now, 0.1);
    const insideClub = state.insideVenue && state.insideVenue.id === 'nightclub';
    this.clubFilter.frequency.setTargetAtTime(insideClub ? 4800 : 520, now, 0.15);

    // Advance 124 BPM 16th-note sequencer (1 step = 60 / 124 / 4 = 0.1209s)
    this.stepTimer += dt;
    if (this.stepTimer >= 0.1209) {
      this.stepTimer -= 0.1209;
      this.triggerClubStep(this.stepIndex++);
    }

    // 4. Spatialized AFTERGLOW Bar music (center at (-60, 0))
    const dxBar = state.pos.x - -60;
    const dzBar = state.pos.z - 0;
    const distBar = Math.hypot(dxBar, dzBar);
    const barVol = Math.max(0, 1 - distBar / 36) * 0.45;
    this.barGain.gain.setTargetAtTime(barVol, now, 0.1);

    this.barStepTimer += dt;
    if (this.barStepTimer >= 0.163) {
      this.barStepTimer -= 0.163;
      this.triggerBarStep(this.barStepIndex++);
    }
  }
}
