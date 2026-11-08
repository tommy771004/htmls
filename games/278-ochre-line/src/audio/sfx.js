// 音效。槍聲每把一組分層：真實錄音主體（assets/278/sfx/，tools/sfx.mjs 烘焙）＋合成低頻衝擊＋合成機械聲，
// 全部送進同一個短空間與限幅器。錄音還沒載到或載入失敗時，退回下面 legacy 的純合成，所以 play() 永遠有聲音。
// 呼叫介面：play('shot_<id>')、play('<片段名>', x, y, z, 音高倍率)。片段名見 sfx-list.js 與 cues.js。
import { NEW_GUNS } from '../game/guns/index.js';
import { ASSET_BASE } from '../core/assets.js';
import { SPRITES, CLIPS } from './sfx-list.js';
import { GUN_TUNE, CLIP_TUNE } from './sfx-tune.js';

let ac = null, bus = null, noise = null, vol = 0.8, lx = 0, ly = 0, lz = 0, ly2 = 0;
let fixedT = -1, fixedV = -1;  // renderSfx 排程用；<0 時走 ac.currentTime 與隨機變體
const clips = {};             // 片段名 → AudioBuffer[]
const layers = {};            // 槍 id → { thump, mech: [AudioBuffer, AudioBuffer] }
const stat = { fetched: 0, decoded: 0, clips: 0, guns: 0, failed: '', shots: 0, foley: 0, synth: 0, last: '' };
const now = () => (fixedT >= 0 ? fixedT : ac.currentTime);

function softCurve() {   // 0.84 以下完全線性，之上平滑壓到 0.985：限幅器沒擋住的尖峰不會硬切成方波
  const n = 4097, c = new Float32Array(n), k = 0.84, top = 0.985;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x);
    c[i] = Math.sign(x) * (a <= k ? a : k + (top - k) * Math.tanh((a - k) / (top - k)));
  }
  return c;
}

/** 共用短空間的脈衝響應：城鎮巷道，幾個立體聲早期反射，加上快速收掉的低通噪音尾。 */
function impulse(ctx) {
  const sr = ctx.sampleRate, n = (sr * 0.56) | 0, b = ctx.createBuffer(2, n, sr);
  let seed = 2780;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };
  const early = [[0.011, 0.42, -0.5], [0.019, 0.5, 0.6], [0.031, 0.36, -0.2], [0.047, 0.3, 0.45], [0.073, 0.22, -0.7], [0.109, 0.15, 0.7]];
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let lp = 0, lp2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr, a = Math.exp(-2 * Math.PI * (2600 * Math.exp(-t / 0.16) + 500) / sr * 1);
      lp = rnd() * (1 - a) + lp * a; lp2 = lp * (1 - a * 0.6) + lp2 * a * 0.6;
      d[i] = lp2 * 0.11 * Math.exp(-t / 0.095) * Math.min(1, t / 0.008);
    }
    for (const [t, g, side] of early) {
      const at = (t * (ch ? 1.09 : 1) * sr) | 0, gg = g * (ch ? 1 + side * 0.6 : 1 - side * 0.6);
      for (let i = 0; i < 44 && at + i < n; i++) d[at + i] += gg * 0.34 * (1 - i / 44) * (i % 2 ? -0.5 : 1);
    }
  }
  return b;
}

function makeBus(ctx, raw = false) {
  const b = { dry: ctx.createGain(), wet: ctx.createGain(), echo: ctx.createGain(), master: ctx.createGain() };
  b.master.gain.value = vol;
  const verb = ctx.createConvolver(); verb.normalize = false; verb.buffer = impulse(ctx);
  // 遠處回音：延遲 → 低通 → 回授，也餵進空間
  const dl = ctx.createDelay(0.5), lp = ctx.createBiquadFilter(), fb = ctx.createGain();
  dl.delayTime.value = 0.135; lp.type = 'lowpass'; lp.frequency.value = 1500; fb.gain.value = 0.34;
  b.echo.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(b.master); lp.connect(verb);
  b.dry.connect(b.master); b.wet.connect(verb); verb.connect(b.master);
  // 主輸出限幅：比較快的壓縮器擋連發堆疊，尾端 soft clip 保底
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -2.5; lim.knee.value = 1; lim.ratio.value = 20; lim.attack.value = 0.003; lim.release.value = 0.12;   // 單發不該碰到它，否則起音被壓平
  const clip = ctx.createWaveShaper(); clip.curve = softCurve();
  if (raw) b.master.connect(ctx.destination);   // 量測用：限幅前的訊號
  else { b.master.connect(lim); lim.connect(clip); clip.connect(ctx.destination); }
  return b;
}

export function initAudio() {
  if (ac) { ac.resume?.(); return; }
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  ac = new C({ latencyHint: 'interactive' }); window.__ac = ac;
  // 切 App、來電或瀏覽器節流都會把 context 暫停，play() 在非 running 時直接丟棄。回到前景或下一次操作就叫醒
  const real = ac, wake = () => { if (!document.hidden && real.state !== 'running' && real.state !== 'closed') real.resume?.().catch?.(() => {}); };
  wake(); real.addEventListener?.('statechange', wake); document.addEventListener('visibilitychange', wake);
  // iOS Safari 的使用者手勢只認 touchend／click，pointerdown 叫 resume 不會生效
  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) addEventListener(ev, wake, { passive: true });
  bus = makeBus(ac);
  noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  loadBank(ac).catch((e) => { stat.failed = String(e?.message ?? e); });
}
export function setVolume(v) { vol = v; if (bus) bus.master.gain.value = v; }
export function setListener(x, y, z, yaw) { lx = x; ly = y; lz = z; ly2 = yaw; }
export function sfxStatus() { return { ...stat, ctx: ac?.state ?? 'none', voices: voices.length }; }

// ---- 素材載入：開機時先抓 bytes（不擋開機），建立 AudioContext 後才解碼；每處理幾個片段讓出主執行緒 ----
let raw = null, job = null;
const yieldMain = () => new Promise((r) => setTimeout(r, 0));
export function preloadSfx() {
  raw ??= Promise.all(SPRITES.map((f) => fetch(ASSET_BASE + 'sfx/' + f).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null)));
  return raw;
}
/** 精靈圖裡的起點：MP3 編碼延遲各解碼器不同，用起音本身對齊，主體和合成層才不會差 25 ms。 */
function onsetIn(d, sr, at) {
  const a = Math.max(0, at - ((sr * 0.05) | 0)), b = Math.min(d.length, at + ((sr * 0.09) | 0));
  let pk = 0; for (let i = a; i < b; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; }
  const th = pk * 0.14;
  for (let i = a; i < b; i++) if (Math.abs(d[i]) >= th) return Math.max(a, i - ((sr * 0.0006) | 0));
  return at;
}
function loadBank(ctx) {
  return (job ??= (async () => {
    const files = await preloadSfx(), sr = ctx.sampleRate;
    const dec = await Promise.all(files.map((b) => {
      if (!b) return null;
      stat.fetched++;
      return ctx.decodeAudioData(b.slice(0)).then((a) => { stat.decoded++; return a; }, () => null);
    }));
    let n = 0;
    for (const name in CLIPS) {
      const list = [];
      for (const [f, off, len] of CLIPS[name]) {
        const src = dec[f]; if (!src) continue;
        const d = src.getChannelData(0), at = onsetIn(d, sr, Math.round(off * sr)), N = Math.min(Math.round(len * sr), d.length - at);
        const buf = ctx.createBuffer(1, N, sr), o = buf.getChannelData(0);
        o.set(d.subarray(at, at + N));
        const fi = Math.min((sr * 0.0005) | 0, N); for (let i = 0; i < fi; i++) o[i] *= i / fi;   // 解碼器的前回音切掉時別留爆音
        const fo = Math.min((sr * 0.006) | 0, N); for (let i = 0; i < fo; i++) o[N - 1 - i] *= i / fo;
        list.push(buf);
      }
      if (list.length) { clips[name] = list; stat.clips++; }
      if (++n % 6 === 0) await yieldMain();
    }
    for (const id in GUN_TUNE) {
      const T = GUN_TUNE[id];
      layers[id] = { thump: T.thump ? thumpBuf(ctx, T.thump) : null, mech: T.mech ? [mechBuf(ctx, T.mech, id.length * 31 + 7), mechBuf(ctx, T.mech, id.charCodeAt(0) * 97 + 13)] : null };
      stat.guns++;
      await yieldMain();
    }
  })());
}

// ---- 合成層：開機算一次放進 AudioBuffer，開火時只是多一個 BufferSource，不用節點鏈 ----
/** 低頻衝擊：掃頻正弦過 tanh。[起始 Hz, 落點 Hz, 秒, 量, 驅動] */
function thumpBuf(ctx, [f0, f1, dur, amt, drive = 1.6]) {
  const sr = ctx.sampleRate, n = (dur * sr) | 0, b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, f = f1 + (f0 - f1) * Math.exp(-t / (dur * 0.2)); ph += 2 * Math.PI * f / sr;
    d[i] = amt * Math.tanh(drive * Math.sin(ph)) * Math.min(1, t / 0.0007) * Math.exp(-t / (dur * 0.26)) * Math.min(1, (n - i) / (sr * 0.004));
  }
  return b;
}
/** 機械聲：金屬模態加高通噪音，第二響是槍機復位。[[模態 Hz...], 秒, 量, 第二響延遲秒, 第二響相對量, 噪音量] */
function mechBuf(ctx, [modes, dur, amt, t2 = 0, k2 = 0, hiss = 0.5], seed) {
  const sr = ctx.sampleRate, n = (dur * sr) | 0, b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
  let s = seed >>> 0, hp = 0, prev = 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2147483648 - 1; };
  const strike = (t0, level, j) => {
    const at = (t0 * sr) | 0;
    modes.forEach((f, k) => {
      const fr = f * (1 + (rnd() * 0.5 + j) * 0.02), tau = 0.0065 / (1 + k * 0.4), ph = rnd() * 3;
      for (let i = at; i < n; i++) { const t = (i - at) / sr, e = Math.exp(-t / tau); if (e < 0.002) break; d[i] += (level * Math.sin(2 * Math.PI * fr * t + ph) * e) / modes.length; }
    });
    for (let i = at, e = at + ((sr * 0.0055) | 0); i < e && i < n; i++) { const w = rnd(); hp = 0.72 * (hp + w - prev); prev = w; d[i] += level * hiss * hp * (1 - (i - at) / (e - at)); }
  };
  strike(0, 1, 0); if (k2) strike(t2 * (1 + rnd() * 0.06), k2, 0.3);
  for (let i = 0; i < n; i++) d[i] *= amt * Math.min(1, (n - i) / (sr * 0.003));
  return b;
}

// ---- 聲部管理：開火路徑不產生數學物件；節點由 WebAudio 自己回收，這裡只控制同時數量 ----
const MAX_VOICES = 26, MAX_SAME = 4;
const voices = [];          // { key, g, level, end, src, self }
let lastSelf = null;
const lastPick = {};
function reap(t) { for (let i = voices.length - 1; i >= 0; i--) if (voices[i].end <= t) { if (voices[i] === lastSelf) lastSelf = null; voices.splice(i, 1); } }
function kill(v, t) {
  v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, 0.006);
  for (const s of v.src) { try { s.stop(t + 0.03); } catch { /* 已結束 */ } }
  v.end = Math.min(v.end, t + 0.03);
}
function admit(key, t) {
  reap(t);
  let same = 0, oldest = null;
  for (const v of voices) if (v.key === key) { same++; oldest ??= v; }
  if (same >= MAX_SAME) kill(oldest, t);
  if (voices.length >= MAX_VOICES) { let q = voices[0]; for (const v of voices) if (v.level < q.level) q = v; kill(q, t); }
}
const pick = (key, n) => { if (fixedV >= 0) return fixedV % n; let i = (Math.random() * n) | 0; if (n > 1 && i === lastPick[key]) i = (i + 1) % n; lastPick[key] = i; return i; };

/** 聲部出口：低通（距離）→ 聲像 → 乾／空間／回音。第一人稱不經低通與聲像，只有乾聲與一點空間。 */
function route(g, x, z, d, h, wet) {
  let tail = g;
  if (d > 7) { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(1300, 15000 * Math.exp(-(d - 7) / 13)); lp.Q.value = 0.4; tail.connect(lp); tail = lp; }
  if (h > 0.6 && ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.sin(Math.atan2(x - lx, z - lz) - ly2) * 0.8; tail.connect(p); tail = p; }
  tail.connect(bus.dry);
  const far = d < 6 ? 0 : Math.min(1, (d - 6) / 28);
  if (wet > 0) { const s = ac.createGain(); s.gain.value = wet * (1 + far * 1.2); tail.connect(s); s.connect(bus.wet); }
  if (far > 0) { const e = ac.createGain(); e.gain.value = far * 0.3; tail.connect(e); e.connect(bus.echo); }
}
function source(buf, rate, g, t) { const s = ac.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate; s.connect(g); s.start(t); return s; }

function shotVoice(name, id, set, x, y, z, d, h, g0) {
  const T = GUN_TUNE[id], L = layers[id], self = d < 0.8;
  let t = now();
  admit(self ? 'self' : name, t);
  if (self) {                      // 連發：前一發的尾巴讓位，不疊成一團
    if (lastSelf) { lastSelf.g.gain.setTargetAtTime(lastSelf.level * (T.choke ?? 0.4), t, 0.014); }
  } else t += d / 343;             // 遠處的槍聲比火光晚到
  const rate = 1 + (Math.random() - 0.5) * 0.06, body = set[pick(name, set.length)];
  const g = ac.createGain(), level = g0 * T.gain * (0.94 + Math.random() * 0.06);
  g.gain.value = level;
  const src = [source(body, rate, g, t)];
  let end = t + body.duration / rate;
  if (L && d < 16 && L.thump) { const th = source(L.thump, 1, g, t); src.push(th); end = Math.max(end, t + L.thump.duration); }
  if (L && self && L.mech) src.push(source(L.mech[(Math.random() * 2) | 0], 1 + (Math.random() - 0.5) * 0.05, g, t));
  route(g, x, z, d, h, T.wet);
  const v = { key: self ? 'self' : name, g, level, end, src };
  voices.push(v);
  if (self) lastSelf = v;
  stat.shots++;
}
function clipVoice(name, set, x, y, z, d, h, g0, rate) {
  const C = CLIP_TUNE[name] ?? CLIP_TUNE._, t = now();
  admit(name, t);
  const r = rate * (1 + (Math.random() - 0.5) * (C.jit ?? 0.04)), buf = set[pick(name, set.length)];
  const g = ac.createGain(), level = g0 * C.gain;
  g.gain.value = level;
  const src = [source(buf, r, g, t)];
  route(g, x, z, d, h, C.wet ?? 0.1);
  voices.push({ key: name, g, level, end: t + buf.duration / r, src });
  stat.foley++; stat.last = name;
}

// ---- 合成音（legacy）：非武器的提示音，以及錄音載入失敗時的退路 ----
function nz(t, dest, dur, peak, type, f, q = 0.7, sweep = 0) {
  const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noise; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (sweep) fl.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
}
function tone(t, dest, dur, peak, f0, f1, type = 'sine') {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
}
const GUN = { p9: [0.9, 1500, 150, 0.16], r50: [1.25, 1100, 95, 0.26], v11: [0.75, 2100, 170, 0.11], s8: [1.5, 900, 80, 0.34], ks: [1.1, 1400, 115, 0.2], ar5: [1, 1700, 125, 0.18], l40: [1.7, 800, 70, 0.55] };
for (const g of NEW_GUNS) GUN[g.id] = g.snd;

export function play(name, x = lx, y = ly, z = lz, rate = 1) {
  if (!ac || (fixedT < 0 && ac.state !== 'running')) return;
  const d = Math.hypot(x - lx, y - ly, z - lz), h = Math.hypot(x - lx, z - lz), range = name.startsWith('shot') || name === 'nade_explode' || name === 'flash' ? 70 : 24, g0 = 1 / (1 + (d / (range * 0.2)) ** 1.6);
  if (g0 < 0.012) return;
  const set = clips[name];
  if (set) {
    if (name.startsWith('shot_')) shotVoice(name, name.slice(5), set, x, y, z, d, h, g0);
    else clipVoice(name, set, x, y, z, d, h, g0, rate);
    return;
  }
  const t = now(), g = ac.createGain(); g.gain.value = g0;
  const out = g;
  if (h > 0.5 && ac.createStereoPanner) {
    const p = ac.createStereoPanner(), a = Math.atan2(x - lx, z - lz) - ly2; p.pan.value = Math.sin(a) * 0.8; g.connect(p); p.connect(bus.dry);
    if (d > 18) { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; g.disconnect(); g.connect(lp); lp.connect(p); }
  } else g.connect(bus.dry);
  if (name.startsWith('shot_')) {
    stat.synth++;
    const [k, hi, lo, tail] = GUN[name.slice(5)] ?? GUN.ar5;
    nz(t, out, 0.022, 1.1 * k, 'highpass', 3000);
    nz(t, out, 0.09, 0.9 * k, 'bandpass', hi, 0.8, hi * 0.35);
    tone(t, out, 0.1, 0.8 * k, lo * 2.2, lo * 0.7);
    nz(t + 0.012, out, tail + 0.28, 0.24 * k, 'lowpass', 1400, 0.5, 320);
    return;
  }
  // 換彈分段的名稱是 mag_out_r 這類，退路都走同一種金屬喀聲
  if (name.startsWith('empty')) { nz(t, out, 0.03, 0.45, 'bandpass', 3400, 4); return; }
  if (/^(mag|bolt|slide|pump|rack|belt|cycle|draw|shell|cover)/.test(name)) { nz(t, out, 0.05, 0.5, 'bandpass', 1500 + (name.length % 5) * 200, 2); return; }
  switch (name) {
    case 'knife': nz(t, out, 0.14, 0.4, 'bandpass', 2600, 1.2, 1100); break;
    case 'reload': nz(t, out, 0.04, 0.4, 'highpass', 2400); nz(t + 0.42, out, 0.05, 0.5, 'bandpass', 1500, 2); tone(t + 0.42, out, 0.05, 0.3, 320, 180, 'triangle'); nz(t + 0.8, out, 0.05, 0.55, 'bandpass', 1900, 2); break;
    case 'step': nz(t, out, 0.07, 0.22, 'lowpass', 520, 0.8, 200); nz(t, out, 0.03, 0.09, 'highpass', 3000); break;
    case 'hit': tone(t, out, 0.1, 0.5, 190, 70); nz(t, out, 0.06, 0.35, 'bandpass', 900, 1); break;
    case 'head': tone(t, out, 0.08, 0.3, 1800, 1200, 'triangle'); nz(t, out, 0.07, 0.32, 'lowpass', 700, 0.8, 260); break;
    // 頭盔：幾個不成倍數的高頻正弦一起衰減，聽起來是鋼殼被敲的鏗聲；前面一聲很短的高頻喀
    case 'helmet': nz(t, out, 0.012, 0.5, 'highpass', 5000); tone(t, out, 0.34, 0.2, 3150, 3080); tone(t, out, 0.24, 0.14, 4710, 4650); tone(t, out, 0.16, 0.1, 6890, 6800); tone(t, out, 0.1, 0.16, 1500, 1100, 'triangle'); break;
    case 'death': tone(t, out, 0.32, 0.26, 150, 60); nz(t + 0.1, out, 0.2, 0.2, 'lowpass', 420); break;
    case 'nade_bounce': nz(t, out, 0.04, 0.4, 'bandpass', 2300, 3); break;
    case 'nade_explode': nz(t, out, 0.05, 1.2, 'highpass', 2000); tone(t, out, 0.5, 1.2, 130, 34); nz(t, out, 1.1, 0.8, 'lowpass', 1200, 0.5, 120); break;
    case 'smoke': nz(t, out, 2, 0.28, 'bandpass', 3000, 0.5, 900); break;
    case 'flash': nz(t, out, 0.05, 1, 'highpass', 3000); tone(t, out, 0.9, 0.2, 3800, 3500); break;
    case 'plant': tone(t, out, 0.08, 0.4, 880, 880, 'square'); tone(t + 0.14, out, 0.14, 0.4, 1175, 1175, 'square'); break;
    case 'beep': tone(t, out, 0.06, 0.32, 1560, 1560, 'square'); break;
    case 'defuse': tone(t, out, 0.22, 0.3, 660, 990, 'triangle'); break;
    case 'win': tone(t, bus.master, 0.2, 0.26, 523, 523, 'triangle'); tone(t + 0.16, bus.master, 0.34, 0.26, 784, 784, 'triangle'); break;
    case 'lose': tone(t, bus.master, 0.42, 0.26, 330, 196, 'triangle'); break;
    // 彈殼落地與彈著：短、高頻為主，數量多所以音量壓低
    case 'brass': tone(t, out, 0.09, 0.11, 5200, 5050, 'triangle'); tone(t, out, 0.15, 0.06, 7450, 7380); nz(t, out, 0.018, 0.12, 'highpass', 6000); tone(t + 0.075, out, 0.06, 0.05, 5600, 5520, 'triangle'); break;
    case 'imp_stone': nz(t, out, 0.045, 0.34, 'bandpass', 2600, 1.2); nz(t, out, 0.12, 0.18, 'lowpass', 900, 0.7); break;
    case 'imp_plaster': nz(t, out, 0.06, 0.28, 'bandpass', 1800, 0.9); nz(t + 0.01, out, 0.16, 0.12, 'lowpass', 700); break;
    case 'imp_wood': nz(t, out, 0.04, 0.28, 'bandpass', 1250, 1.5); tone(t, out, 0.09, 0.28, 330, 180, 'triangle'); break;
    case 'imp_metal': nz(t, out, 0.015, 0.3, 'highpass', 4000); tone(t, out, 0.34, 0.12, 2350, 2300); tone(t, out, 0.26, 0.08, 3720, 3650); if (Math.random() < 0.3) tone(t + 0.02, out, 0.32, 0.06, 4300, 1700); break;   // 偶爾跳彈的呼嘯
    case 'imp_sand': nz(t, out, 0.1, 0.26, 'lowpass', 700, 0.6); nz(t, out, 0.05, 0.09, 'bandpass', 3000, 0.8); break;
    case 'pickup': nz(t, out, 0.03, 0.34, 'bandpass', 1300, 3); nz(t + 0.07, out, 0.04, 0.3, 'bandpass', 2100, 3); tone(t + 0.07, out, 0.06, 0.12, 620, 520, 'triangle'); break;
    case 'buy': nz(t, out, 0.03, 0.3, 'bandpass', 1800, 3); tone(t + 0.02, out, 0.08, 0.22, 1040, 1040, 'triangle'); break;
  }
}

/** 量測用：同一條訊號路徑（含限幅；raw 時不含）畫到 OfflineAudioContext。events=[{t,name,x?,y?,z?,rate?}]，回傳 AudioBuffer。tools/sfx-report.mjs 用。 */
export async function renderSfx(events, dur, { synth = false, volume = vol, raw = false } = {}) {
  await job;
  const keep = [ac, bus, noise, lx, ly, lz, ly2, vol];
  const off = new OfflineAudioContext(2, Math.ceil(dur * ac.sampleRate), ac.sampleRate);
  vol = volume; ac = off; bus = makeBus(off, raw); noise = keep[2]; voices.length = 0; lastSelf = null;
  const saved = synth ? { ...clips } : null;
  if (synth) for (const k in clips) delete clips[k];
  for (const e of events) { fixedT = e.t; fixedV = e.v ?? -1; play(e.name, e.x ?? lx, e.y ?? ly, e.z ?? lz, e.rate ?? 1); }
  fixedT = -1; fixedV = -1;
  if (saved) Object.assign(clips, saved);
  [ac, bus, noise, lx, ly, lz, ly2, vol] = keep;
  voices.length = 0; lastSelf = null;
  return off.startRendering();
}
export const whenSfxReady = () => job;
