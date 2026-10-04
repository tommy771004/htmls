// 開發用：把 sfx-dsp.js 的每個音色算成 WAV（dist/sfx/），印出長度、峰值、RMS 與耗時，方便試聽與檢查。
import { mkdirSync, writeFileSync } from 'node:fs';
import { dsp, RECIPES, MUSIC_RECIPES, KOTO_SCALE, koto } from '../src/sfx-dsp.js';
const SR = 44100;
mkdirSync('dist/sfx', { recursive: true });
function wav(name, data) {
  const n = data.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(data[i] * 32767))), 44 + i * 2);
  writeFileSync(`dist/sfx/${name}.wav`, b);
}
let total = 0;
const stat = (name, d, ms) => {
  let pk = 0, ss = 0, nan = 0;
  for (const x of d) { if (!Number.isFinite(x)) nan++; else { pk = Math.max(pk, Math.abs(x)); ss += x * x; } }
  console.log(name.padEnd(12), (d.length / SR).toFixed(2) + 's', 'peak', pk.toFixed(2), 'rms', Math.sqrt(ss / d.length).toFixed(3), nan ? 'NaN×' + nan : '', ms.toFixed(0) + 'ms');
};
for (const [k, fn] of Object.entries(RECIPES)) {
  const t = performance.now(); const r = fn(dsp(SR, 3)); const ms = performance.now() - t; total += ms;
  stat(k, r.data, ms); wav(k, r.data);
}
for (const [k, fn] of Object.entries(MUSIC_RECIPES)) { const t = performance.now(); const d = fn(dsp(SR, 5)); total += performance.now() - t; stat('m_' + k, d, performance.now() - t); wav('m_' + k, d); }
const t = performance.now(); KOTO_SCALE.forEach((f, i) => { const d = koto(dsp(SR, i), f); if (i === 5) wav('m_koto', d); }); total += performance.now() - t;
console.log('合計', total.toFixed(0) + 'ms（每種一個變體）');
