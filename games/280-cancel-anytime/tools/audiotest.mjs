// 聲音自測：node tools/audiotest.mjs [音效名…]
// 把 src/audio.js 打包丟進無頭 Chrome，用 OfflineAudioContext 逐一渲染音效與角色碎念，印出峰值／RMS（dBFS），
// 並把模組裡被 try/catch 吃掉的例外印出來；最後用真的 AudioContext 跑幾秒各強度的配樂確認有聲音、沒有例外。
import { chromium } from 'playwright-core';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const src = readFileSync(fileURLToPath(new URL('../src/audio.js', import.meta.url)), 'utf8')
  .replace(/catch \(e\) \{/g, 'catch (e) { (globalThis.__errs = globalThis.__errs || []).push(String(e && e.stack || e));');
const out = await build({ stdin: { contents: src + '\nglobalThis.SFX = SFX; globalThis.__names = Object.keys(FX); globalThis.__themes = Object.entries(THEMES).map(([k, v]) => [k, v.bpm]);', loader: 'js' }, bundle: true, format: 'iife', write: false });
const code = out.outputFiles[0].text;
const only = process.argv.slice(2);
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
const db = v => (v > 0 ? (20 * Math.log10(v)).toFixed(1) : '-inf');
const render = (kind, name) => page.evaluate(async ({ code, kind, name }) => {
  // 每個音效一個全新的模組實例（模組狀態綁在單一 context 上）
  const c = new OfflineAudioContext(2, 44100 * 4, 44100);
  const g = {}; new Function('globalThis', code)(g);
  g.SFX.init(c);
  let len = 0;
  if (kind === 'fx') g.SFX.play(name); else len = g.SFX.voice(name, 7, { boss: name === 'burger' });
  const buf = await c.startRendering(), d = buf.getChannelData(0);
  let peak = 0, sum = 0, last = 0;
  for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += a * a; if (a > 0.003) last = i; }
  return { peak, rms: Math.sqrt(sum / Math.max(1, last)), dur: last / 44100, len, errs: g.__errs || [], names: g.__names, themes: g.__themes };
}, { code, kind, name });
const first = await render('fx', 'select');
const names = only.length ? only : first.names;
console.log('音效'.padEnd(12), '峰值dB'.padStart(7), 'RMS dB'.padStart(7), '長度s'.padStart(6));
let bad = 0;
for (const n of names) {
  const r = await render('fx', n);
  const flag = r.errs.length ? ' ✗ ' + r.errs[0].split('\n')[0] : r.peak < 0.01 ? ' ✗ 無聲' : r.peak > 0.99 ? ' ⚠ 削峰' : '';
  if (flag.includes('✗')) bad++;
  console.log(n.padEnd(12), db(r.peak).padStart(7), db(r.rms).padStart(7), r.dur.toFixed(2).padStart(6), flag);
}
if (!only.length) {
  for (const k of ['chad', 'karen', 'dale', 'doge', 'burger', 'rat']) {
    const r = await render('voice', k);
    const flag = r.errs.length ? ' ✗ ' + r.errs[0].split('\n')[0] : r.peak < 0.01 ? ' ✗ 無聲' : '';
    if (flag) bad++;
    console.log(('voice:' + k).padEnd(12), db(r.peak).padStart(7), db(r.rms).padStart(7), r.dur.toFixed(2).padStart(6), flag);
  }
  // 配樂：真的 AudioContext，攔截接到 destination 的訊號。每個強度量滿兩小節，另外分出 4 kHz 以上的高頻（火熱層的 hi-hat／拍手在這裡）
  const mus = await page.evaluate(async ({ code }) => {
    const res = [];
    const c = new AudioContext();
    await c.resume();
    const an = c.createAnalyser(); an.fftSize = 2048;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4000;
    const anH = c.createAnalyser(); anH.fftSize = 2048; hp.connect(anH);
    const conn = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (d, ...a) { if (d === c.destination) { conn.call(this, an); conn.call(this, hp); } return conn.call(this, d, ...a); };
    const g = {}; new Function('globalThis', code)(g);
    g.SFX.init(c);
    const buf = new Float32Array(2048), bufH = new Float32Array(2048);
    const meas = async (ms) => { let s = 0, sh = 0, n = 0; const t0 = performance.now(); while (performance.now() - t0 < ms) { await new Promise(r => setTimeout(r, 40)); an.getFloatTimeDomainData(buf); anH.getFloatTimeDomainData(bufH); for (let i = 0; i < 2048; i++) { s += buf[i] * buf[i]; sh += bufH[i] * bufH[i]; n++; } } return [Math.sqrt(s / n), Math.sqrt(sh / n)]; };
    for (const [th, bpm] of g.__themes) {
      const row = { th }, bars = 2 * 4 * 60000 / bpm;
      for (const k of [0.3, 1]) { g.SFX.music(null); g.SFX.intensity(k); g.SFX.music(th); await new Promise(r => setTimeout(r, 1000)); row['m' + k] = await meas(bars); }
      res.push(row);
    }
    g.SFX.duck(0.5); g.SFX.music(null);
    return { res, errs: g.__errs || [], state: c.state };
  }, { code });
  console.log('\n配樂 RMS dB：全頻（強度 0.3 → 1.0）｜4 kHz 以上（0.3 → 1.0），AudioContext ' + mus.state);
  for (const r of mus.res) {
    const [a, ah] = r['m0.3'], [b, bh] = r.m1;
    const dAll = 20 * Math.log10(b / a), dHi = 20 * Math.log10(bh / Math.max(ah, 1e-7));
    const flag = b < 1e-4 ? ' ✗ 無聲' : dHi < 4 || dAll < 2 ? ' ✗ 分層差距不足' : '';
    if (flag) bad++;
    console.log(r.th.padEnd(10), db(a).padStart(7), '→', db(b).padStart(6), `(${dAll >= 0 ? '+' : ''}${dAll.toFixed(1)})`.padStart(7), '｜', db(ah).padStart(6), '→', db(bh).padStart(6), `(${dHi >= 0 ? '+' : ''}${dHi.toFixed(1)})`.padStart(7), flag);
  }
  if (mus.errs.length) { bad++; console.log('配樂例外：', mus.errs.slice(0, 3).join('\n')); }
}
await browser.close();
if (errs.length) console.log(errs.join('\n'));
console.log(bad || errs.length ? `FAIL（${bad} 項）` : 'OK');
process.exit(bad || errs.length ? 1 : 0);
