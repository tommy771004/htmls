// 原生 Web Audio API 即時數位訊號處理（DSP）與程序化車輛音效合成引擎
// 零外部音檔依賴：多層振盪器引擎聲浪、WaveShaper 負載失真、渦輪嘯叫與洩壓閥（BOV）、
// 排氣管回火（Pop & Bang）、雙共振帶通輪胎尖叫、路緣石低頻脈衝、砂石顆粒摩擦、高速粉紅雜訊風切與 90 年代街機 FM 音效。

function makeDistortionCurve(amount = 24) {
  const n = 1024;
  const curve = new Float32Array(n);
  const k = amount;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    // 非對稱暖飽和曲線（產生偶次與奇次諧波，強化 V8 / 直六 / 水平對臥聲浪厚實度）
    curve[i] = ((1 + k * 0.15) * (x + 0.08 * x * x)) / (1 + k * 0.15 * Math.abs(x));
  }
  return curve;
}

export class ProceduralAudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.muted = false;
    this.initialized = false;
    this.drivingActive = false;

    // 持續音源節點
    this.engineNodes = null;
    this.tireNodes = null;
    this.curbNodes = null;
    this.gravelNodes = null;
    this.windNodes = null;
    this.whiteNoiseBuf = null;
    this.pinkNoiseBuf = null;
  }

  /**
   * 於玩家首次互動時安全建立並喚醒 AudioContext
   */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 6;
      this.compressor.attack.value = 0.004;
      this.compressor.release.value = 0.18;

      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0.0 : 0.78;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyserBuf = new Float32Array(this.analyser.fftSize);
      this.master.connect(this.compressor);
      this.compressor.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      this._buildNoiseBuffers();
      this._buildContinuousRig();
      this.initialized = true;
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return true;
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0.0 : 0.78, this.ctx.currentTime, 0.03);
    }
    return this.muted;
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }

  /**
   * 讀取即時音訊時域波形峰值（供實機自動驗證確認引擎與特效聲浪真實輸出）
   */
  getWaveformPeak() {
    if (!this.analyser || !this.analyserBuf) return 0;
    this.analyser.getFloatTimeDomainData(this.analyserBuf);
    let peak = 0;
    for (let i = 0; i < this.analyserBuf.length; i++) {
      const a = Math.abs(this.analyserBuf[i]);
      if (a > peak) peak = a;
    }
    return Number(peak.toFixed(4));
  }

  setDrivingActive(active) {
    this.drivingActive = !!active;
    if (!this.initialized || !this.ctx) return;
    const now = this.ctx.currentTime;
    const target = active ? 1.0 : 0.0;
    this.rigBus.gain.setTargetAtTime(target, now, 0.06);
  }

  _buildNoiseBuffers() {
    const sr = this.ctx.sampleRate;
    const len = sr * 2;
    this.whiteNoiseBuf = this.ctx.createBuffer(1, len, sr);
    this.pinkNoiseBuf = this.ctx.createBuffer(1, len, sr);

    const wData = this.whiteNoiseBuf.getChannelData(0);
    const pData = this.pinkNoiseBuf.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      wData[i] = white;

      // Paul Kellet Pink Noise Filter
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      pData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
      b6 = white * 0.115926;
    }
  }

  _createLoopingNoise(buffer) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start();
    return src;
  }

  _buildContinuousRig() {
    const ctx = this.ctx;
    this.rigBus = ctx.createGain();
    this.rigBus.gain.value = 0.0;
    this.rigBus.connect(this.master);

    // 1. 多層次引擎聲浪合成（Sawtooth + Triangle + Sub-bass Sine + Harmonic Detune -> WaveShaper -> Biquad Lowpass）
    const engOut = ctx.createGain();
    engOut.gain.value = 0.32;

    const engFilter = ctx.createBiquadFilter();
    engFilter.type = 'lowpass';
    engFilter.frequency.value = 500;
    engFilter.Q.value = 2.8;

    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDistortionCurve(32);
    shaper.oversample = '2x';

    const preDrive = ctx.createGain();
    preDrive.gain.value = 1.0;

    const oscSaw = ctx.createOscillator();
    oscSaw.type = 'sawtooth';
    const gainSaw = ctx.createGain();
    gainSaw.gain.value = 0.42;

    const oscTri = ctx.createOscillator();
    oscTri.type = 'triangle';
    const gainTri = ctx.createGain();
    gainTri.gain.value = 0.38;

    const oscSub = ctx.createOscillator();
    oscSub.type = 'sine';
    const gainSub = ctx.createGain();
    gainSub.gain.value = 0.45;

    const oscHarm = ctx.createOscillator();
    oscHarm.type = 'sawtooth';
    const gainHarm = ctx.createGain();
    gainHarm.gain.value = 0.25;

    oscSaw.connect(gainSaw).connect(preDrive);
    oscTri.connect(gainTri).connect(preDrive);
    oscHarm.connect(gainHarm).connect(preDrive);
    oscSub.connect(gainSub).connect(engOut); // 次低音直入輸出保持渾厚底盤感

    preDrive.connect(shaper).connect(engFilter).connect(engOut);
    engOut.connect(this.rigBus);

    // 渦輪增壓嘯叫層（Turbo Spool Whistle + Air Hiss）
    const turboSine = ctx.createOscillator();
    turboSine.type = 'sine';
    const turboGain = ctx.createGain();
    turboGain.gain.value = 0.0;
    turboSine.connect(turboGain).connect(this.rigBus);

    oscSaw.start();
    oscTri.start();
    oscSub.start();
    oscHarm.start();
    turboSine.start();

    this.engineNodes = {
      oscSaw,
      oscTri,
      oscSub,
      oscHarm,
      gainSaw,
      gainTri,
      gainSub,
      gainHarm,
      preDrive,
      engFilter,
      engOut,
      turboSine,
      turboGain
    };

    // 2. 輪胎抓地極限尖叫（Tire Screech：White Noise -> 雙高 Q 帶通濾波器 980Hz & 1340Hz）
    const tireSrc = this._createLoopingNoise(this.whiteNoiseBuf);
    const bp1 = ctx.createBiquadFilter();
    bp1.type = 'bandpass';
    bp1.frequency.value = 980;
    bp1.Q.value = 11.5;

    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'bandpass';
    bp2.frequency.value = 1340;
    bp2.Q.value = 13.0;

    const tireGain = ctx.createGain();
    tireGain.gain.value = 0.0;
    tireSrc.connect(bp1).connect(tireGain);
    tireSrc.connect(bp2).connect(tireGain);
    tireGain.connect(this.rigBus);
    this.tireNodes = { bp1, bp2, tireGain };

    // 3. 路緣石震動音（Curb Rumble：30Hz ~ 65Hz 連續低頻脈衝）
    const curbOsc = ctx.createOscillator();
    curbOsc.type = 'sawtooth';
    curbOsc.frequency.value = 45;
    const curbFilter = ctx.createBiquadFilter();
    curbFilter.type = 'lowpass';
    curbFilter.frequency.value = 140;
    const curbGain = ctx.createGain();
    curbGain.gain.value = 0.0;
    curbOsc.connect(curbFilter).connect(curbGain).connect(this.rigBus);
    curbOsc.start();
    this.curbNodes = { curbOsc, curbGain };

    // 4. 越野砂石與草地摩擦聲（Granular Gravel & Dirt Noise）
    const grvSrc = this._createLoopingNoise(this.whiteNoiseBuf);
    const grvFilter = ctx.createBiquadFilter();
    grvFilter.type = 'bandpass';
    grvFilter.frequency.value = 480;
    grvFilter.Q.value = 1.6;
    const grvGain = ctx.createGain();
    grvGain.gain.value = 0.0;
    grvSrc.connect(grvFilter).connect(grvGain).connect(this.rigBus);
    this.gravelNodes = { grvFilter, grvGain };

    // 5. 高速風切聲（> 120 km/h 低通粉紅雜訊 Pink Noise）
    const windSrc = this._createLoopingNoise(this.pinkNoiseBuf);
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 380;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.0;
    windSrc.connect(windFilter).connect(windGain).connect(this.rigBus);
    this.windNodes = { windFilter, windGain };
  }

  /**
   * 每幀同步物理遙測數據至 DSP 合成器
   */
  updateFromVehicle(simVehicle) {
    if (!this.initialized || !this.ctx || !simVehicle) return;
    const now = this.ctx.currentTime;
    const spec = simVehicle.spec;
    const aud = spec.audio;

    // 1. 計算點火基頻 f = (RPM / 60) * (氣缸數 / 2)
    const rpm = Math.max(600, simVehicle.rpm);
    const baseFreq = Math.max(24, (rpm / 60) * (aud.cylinders / 2));

    // 不同引擎形式泛音比例調校（i4 清脆、flat4 鼓動不等長排氣、i6/flat6 金屬高頻共鳴、v8 低沉咆哮、v12 高亢交響）
    let harmRatio = 1.5;
    let subRatio = 0.5;
    if (aud.engineTone === 'flat4') {
      harmRatio = 0.75; // 水平對臥特有的 Boxer rumble 次諧波
      this.engineNodes.gainHarm.gain.setTargetAtTime(0.38, now, 0.03);
    } else if (aud.engineTone === 'v8') {
      harmRatio = 1.25;
      subRatio = 0.5;
      this.engineNodes.gainHarm.gain.setTargetAtTime(0.36, now, 0.03);
    } else if (aud.engineTone === 'v12' || aud.engineTone === 'i6' || aud.engineTone === 'flat6') {
      harmRatio = 2.0;
      this.engineNodes.gainHarm.gain.setTargetAtTime(0.32, now, 0.03);
    } else {
      harmRatio = 1.5;
      this.engineNodes.gainHarm.gain.setTargetAtTime(0.20, now, 0.03);
    }

    this.engineNodes.oscSaw.frequency.setTargetAtTime(baseFreq, now, 0.015);
    this.engineNodes.oscTri.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.015);
    this.engineNodes.oscSub.frequency.setTargetAtTime(baseFreq * subRatio, now, 0.015);
    this.engineNodes.oscHarm.frequency.setTargetAtTime(baseFreq * harmRatio, now, 0.015);

    // 油門負載調變（Throttle Load Modulation）與紅線斷油切斷（Rev Limiter）
    const throttle = simVehicle.throttle;
    const rpmNorm = Math.min(1, (rpm - spec.physics.idleRpm) / Math.max(1000, spec.physics.redlineRpm - spec.physics.idleRpm));
    const cutoff = 320 + throttle * 1650 + rpmNorm * 1150;
    this.engineNodes.engFilter.frequency.setTargetAtTime(cutoff, now, 0.02);

    const limiterCut = simVehicle.limiterActive ? 0.14 : 1.0;
    const loadDrive = (0.75 + throttle * 1.45) * limiterCut;
    this.engineNodes.preDrive.gain.setTargetAtTime(loadDrive, now, 0.01);
    this.engineNodes.engOut.gain.setTargetAtTime((0.24 + throttle * 0.14) * limiterCut, now, 0.015);

    // 渦輪增壓葉片高頻嘯叫
    if (aud.hasTurbo && simVehicle.boostBar > 0.05) {
      const boostNorm = simVehicle.boostBar / Math.max(0.5, aud.maxBoostBar);
      this.engineNodes.turboSine.frequency.setTargetAtTime(1750 + boostNorm * 2350, now, 0.02);
      this.engineNodes.turboGain.gain.setTargetAtTime(Math.min(0.065, boostNorm * 0.055), now, 0.03);
    } else {
      this.engineNodes.turboGain.gain.setTargetAtTime(0, now, 0.03);
    }

    // 消費單發動態事件：BOV 洩壓閥、排氣管回火、碰撞音效
    if (simVehicle.events.bov > 0) {
      this.triggerBOV(simVehicle.events.bov);
      simVehicle.events.bov = 0;
    }
    if (simVehicle.events.backfire > 0) {
      this.triggerBackfire(simVehicle.events.backfire);
      simVehicle.events.backfire = 0;
    }
    if (simVehicle.events.collision > 0) {
      this.triggerCollision(simVehicle.events.collision);
      simVehicle.events.collision = 0;
    }

    // 2. 輪胎抓地極限尖叫（依滑移率與側滑角動態調整音量與共振中心頻率 900Hz ~ 1400Hz）
    const speedAbs = Math.abs(simVehicle.speedKmh);
    const slip = simVehicle.maxWheelSlip;
    const onAsphaltLike = simVehicle.dominantSurface === 'asphalt' || simVehicle.dominantSurface === 'skidpad' || simVehicle.dominantSurface === 'curb';
    if (onAsphaltLike && slip > 0.34 && speedAbs > 8 && !simVehicle.airborne) {
      const screechNorm = Math.min(1.0, (slip - 0.32) * 1.15);
      const pitchShift = Math.min(240, speedAbs * 0.9 + Math.abs(simVehicle.slipAngleDeg) * 3.2);
      this.tireNodes.bp1.frequency.setTargetAtTime(920 + pitchShift, now, 0.02);
      this.tireNodes.bp2.frequency.setTargetAtTime(1260 + pitchShift * 0.85, now, 0.02);
      this.tireNodes.tireGain.gain.setTargetAtTime(screechNorm * 0.22, now, 0.025);
    } else {
      this.tireNodes.tireGain.gain.setTargetAtTime(0.0, now, 0.04);
    }

    // 3. 路緣石連續震動音（30Hz ~ 65Hz 與車速成正比）
    if (simVehicle.onCurb && speedAbs > 5 && !simVehicle.airborne) {
      const curbFreq = Math.max(28, Math.min(68, 26 + speedAbs * 0.22));
      this.curbNodes.curbOsc.frequency.setTargetAtTime(curbFreq, now, 0.015);
      this.curbNodes.curbGain.gain.setTargetAtTime(Math.min(0.28, 0.08 + (speedAbs / 180) * 0.2), now, 0.02);
    } else {
      this.curbNodes.curbGain.gain.setTargetAtTime(0.0, now, 0.03);
    }

    // 4. 越野泥地與砂石顆粒摩擦聲
    const isOffroad = simVehicle.dominantSurface === 'gravel' || simVehicle.dominantSurface === 'dirt' || simVehicle.dominantSurface === 'grass';
    if (isOffroad && speedAbs > 4 && !simVehicle.airborne) {
      const grvFreq = 360 + Math.min(900, speedAbs * 5.2);
      const grvVol = Math.min(0.26, (speedAbs / 130) * 0.22 + slip * 0.08);
      this.gravelNodes.grvFilter.frequency.setTargetAtTime(grvFreq, now, 0.03);
      this.gravelNodes.grvGain.gain.setTargetAtTime(grvVol, now, 0.03);
    } else {
      this.gravelNodes.grvGain.gain.setTargetAtTime(0.0, now, 0.04);
    }

    // 5. 高速風切聲（> 120 km/h 漸進混入粉紅雜訊）
    if (speedAbs > 110) {
      const windNorm = Math.min(1.0, (speedAbs - 110) / 190);
      this.windNodes.windFilter.frequency.setTargetAtTime(360 + windNorm * 950, now, 0.05);
      this.windNodes.windGain.gain.setTargetAtTime(windNorm * 0.24, now, 0.05);
    } else {
      this.windNodes.windGain.gain.setTargetAtTime(0.0, now, 0.05);
    }
  }

  /**
   * 觸發渦輪洩壓閥音效（Blow-Off Valve `psshhh`）
   */
  triggerBOV(boost = 1.0) {
    if (!this.initialized || !this.ctx || !this.whiteNoiseBuf) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.whiteNoiseBuf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(3400, now);
    hp.frequency.exponentialRampToValueAtTime(1600, now + 0.24);
    hp.Q.value = 3.5;

    const g = ctx.createGain();
    const peak = Math.min(0.26, 0.10 + boost * 0.12);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.018);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    src.connect(hp).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + 0.28);
  }

  /**
   * 觸發高轉收油門排氣管回火音（Exhaust Pop & Bang，隨機 1～3 聲低頻爆裂）
   */
  triggerBackfire(intensity = 0.85) {
    if (!this.initialized || !this.ctx || !this.whiteNoiseBuf) return;
    const ctx = this.ctx;
    const count = 1 + Math.floor(Math.random() * 3);

    for (let i = 0; i < count; i++) {
      const delay = i * (0.055 + Math.random() * 0.045);
      const t0 = ctx.currentTime + delay;

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(145 + Math.random() * 35, t0);
      osc.frequency.exponentialRampToValueAtTime(38, t0 + 0.09);

      const g = ctx.createGain();
      const vol = Math.min(0.32, 0.18 * intensity);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.095);

      osc.connect(g).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + 0.1);
    }
  }

  /**
   * 觸發碰撞與金屬刮擦音效
   */
  triggerCollision(impactNorm = 0.5) {
    if (!this.initialized || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // 低頻撞擊重音（頻率快速下墜正弦波）
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.18);

    const g = ctx.createGain();
    const vol = Math.min(0.45, 0.15 + impactNorm * 0.3);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.22);

    // 金屬刮擦高頻雜訊
    if (this.whiteNoiseBuf) {
      const nSrc = ctx.createBufferSource();
      nSrc.buffer = this.whiteNoiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2100;
      bp.Q.value = 4.0;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(vol * 0.45, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      nSrc.connect(bp).connect(ng).connect(this.master);
      nSrc.start(now);
      nSrc.stop(now + 0.18);
    }
  }

  // ==================== 90 年代街機 FM UI 音效 ====================

  /**
   * 清脆選單切換音（Blip）
   */
  playBlip(freq = 880) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const g = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + 0.055);

    mod.type = 'triangle';
    mod.frequency.value = freq * 2;
    modGain.gain.value = 180;

    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    mod.connect(modGain).connect(osc.frequency);
    osc.connect(g).connect(this.master);
    mod.start(now);
    osc.start(now);
    mod.stop(now + 0.07);
    osc.stop(now + 0.07);
  }

  /**
   * 切換車輛性能等級的機械卡榫聲（Clunk）
   */
  playClunk() {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(68, now + 0.08);

    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.095);

    this.playBlip(660);
  }

  /**
   * 確認出賽的 90 年代街機激昂合成和弦音
   */
  playConfirmChord() {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [440, 554.37, 659.25, 880]; // A Major triad + octave
    for (let i = 0; i < freqs.length; i++) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freqs[i], now + i * 0.025);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2600, now);
      filter.frequency.exponentialRampToValueAtTime(650, now + 0.42);

      g.gain.setValueAtTime(0.001, now + i * 0.025);
      g.gain.linearRampToValueAtTime(0.09, now + i * 0.025 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(filter).connect(g).connect(this.master);
      osc.start(now + i * 0.025);
      osc.stop(now + 0.48);
    }
  }

  /**
   * 經典街機起跑倒數音（3 - 2 - 1 - GO!）
   */
  playCountdown(isGo = false) {
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, now);

    const dur = isGo ? 0.36 : 0.16;
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }
}
