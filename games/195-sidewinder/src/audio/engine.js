// 每台卡車的持續音：引擎（鋸齒 + 方波次諧 + 濾波噪音）、打滑噪音、氮氣嘶聲。
// 參數一律用 setTargetAtTime 平滑，避免拉鍊雜音。
import { noiseBuffer } from './synth.js';
import { ST, SURF } from './events.js';

const TC = 0.05; // 參數平滑時間常數

function loopNoise(ctx) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx);
  s.loop = true;
  s.start(ctx.currentTime, Math.random() * 1.5);
  return s;
}

export function createTruckVoice(ctx, dest) {
  const out = ctx.createGain();
  out.gain.value = 0;
  let pan = null;
  if (ctx.createStereoPanner) {
    pan = ctx.createStereoPanner();
    out.connect(pan).connect(dest);
  } else {
    out.connect(dest);
  }

  // 引擎：V8 化油器的粗糙感 = 鋸齒 + 低八度方波，經低通；再加一點帶通噪音當排氣
  const saw = ctx.createOscillator(); saw.type = 'sawtooth';
  const sub = ctx.createOscillator(); sub.type = 'square';
  const wob = ctx.createOscillator(); wob.type = 'sine'; wob.frequency.value = 7.3; // 怠速抖動
  const wobAmt = ctx.createGain(); wobAmt.gain.value = 1.5;
  wob.connect(wobAmt); wobAmt.connect(saw.frequency); wobAmt.connect(sub.frequency);
  const sawG = ctx.createGain(); sawG.gain.value = 0.55;
  const subG = ctx.createGain(); subG.gain.value = 0.35;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3.5; lp.frequency.value = 400;
  saw.connect(sawG).connect(lp);
  sub.connect(subG).connect(lp);
  const exN = loopNoise(ctx);
  const exBp = ctx.createBiquadFilter(); exBp.type = 'bandpass'; exBp.Q.value = 1.2; exBp.frequency.value = 300;
  const exG = ctx.createGain(); exG.gain.value = 0.2;
  exN.connect(exBp).connect(exG).connect(lp);
  const engG = ctx.createGain(); engG.gain.value = 0;
  lp.connect(engG).connect(out);

  // 打滑：帶通噪音，地面種類決定音色
  const skN = loopNoise(ctx);
  const skBp = ctx.createBiquadFilter(); skBp.type = 'bandpass'; skBp.Q.value = 1.6; skBp.frequency.value = 1800;
  const skG = ctx.createGain(); skG.gain.value = 0;
  skN.connect(skBp).connect(skG).connect(out);

  // 氮氣噴射中的持續嘶聲
  const nzN = loopNoise(ctx);
  const nzHp = ctx.createBiquadFilter(); nzHp.type = 'highpass'; nzHp.frequency.value = 1800; nzHp.Q.value = 0.7;
  const nzG = ctx.createGain(); nzG.gain.value = 0;
  nzN.connect(nzHp).connect(nzG).connect(out);

  const t0 = ctx.currentTime;
  for (const o of [saw, sub, wob]) o.start(t0);
  const sources = [saw, sub, wob, exN, skN, nzN];
  let alive = true;

  return {
    // s：狀態陣列；k：卡車；opt = {level, pan}
    set(s, k, opt) {
      if (!alive) return;
      const t = ctx.currentTime;
      const b = ST.TRUCK0 + ST.STRIDE * k;
      const rpm = Math.max(0, Math.min(1, s[b + ST.RPM] || 0));
      const slip = Math.max(0, Math.min(1, s[b + ST.SLIP] || 0));
      const air = s[b + ST.AIR] > 0.5;
      const surf = s[b + ST.SURFACE] | 0;
      const nitro = s[b + ST.NITRO_T] > 0;
      const done = s[b + ST.FINISHED] > 0.5;
      // 滯空時引擎空轉拉高
      const r = air ? Math.min(1, rpm + 0.18) : rpm;
      const f = 34 + r * 118 + (nitro ? 14 : 0);
      saw.frequency.setTargetAtTime(f, t, TC);
      sub.frequency.setTargetAtTime(f * 0.5, t, TC);
      wobAmt.gain.setTargetAtTime(1.5 * (1 - r) + 0.2, t, TC);
      lp.frequency.setTargetAtTime(260 + r * r * 2200 + (nitro ? 700 : 0), t, TC);
      exBp.frequency.setTargetAtTime(180 + r * 900, t, TC);
      engG.gain.setTargetAtTime((0.35 + 0.65 * r) * (done ? 0.6 : 1), t, TC);
      // 打滑音色：泥地低沉、鬆土沙沙、水裡幾乎沒有
      let sf = 1900, sq = 1.6, sk = 1;
      if (surf === SURF.MUD) { sf = 520; sq = 2.5; sk = 0.9; }
      else if (surf === SURF.LOOSE || surf === SURF.INFIELD) { sf = 2600; sq = 0.8; sk = 0.8; }
      else if (surf === SURF.WATER) { sf = 1200; sq = 0.7; sk = 0.35; }
      skBp.frequency.setTargetAtTime(sf, t, 0.08);
      skBp.Q.setTargetAtTime(sq, t, 0.08);
      const sl = air ? 0 : Math.max(0, slip - 0.12) / 0.88;
      skG.gain.setTargetAtTime(sl * sl * 0.55 * sk, t, 0.04);
      nzG.gain.setTargetAtTime(nitro ? 0.18 : 0, t, 0.06);
      out.gain.setTargetAtTime(opt.level, t, 0.12);
      if (pan) pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, opt.pan || 0)), t, 0.1);
    },
    fade(v = 0) {
      if (alive) out.gain.setTargetAtTime(v, ctx.currentTime, 0.08);
    },
    stop() {
      if (!alive) return;
      alive = false;
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setTargetAtTime(0, t, 0.06);
      for (const s of sources) { try { s.stop(t + 0.4); } catch { /* 已停止 */ } }
      setTimeout(() => { try { (pan || out).disconnect(); } catch { /* 忽略 */ } }, 600);
    },
  };
}
