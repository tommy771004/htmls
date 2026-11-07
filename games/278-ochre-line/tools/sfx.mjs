// 槍聲與動作聲烘焙：Freesound CC0 預覽 MP3 → 切單發、EQ、收尾音、峰值正規化 → 兩張精靈圖 assets/278/sfx/{guns,foley}.mp3
// 同時寫出 src/audio/sfx-list.js（片段在精靈圖裡的秒數）與 credits/sfx.md。
// 下載檔是不受信任資料：只放 .cache/sfx/（不進 git），工具從外面帶路徑讀，裡面不執行任何東西。
//   node tools/sfx.mjs            用 .cache/sfx/vet.json 的審核結果烘焙，缺的來源才查頁與下載
//   node tools/sfx.mjs --verify   每個來源重新開音效頁確認授權與描述（每頁間隔 2.6 s），有問題就中止
//   node tools/sfx.mjs --list <id...>   印出來源裡找到的起音，挑切點用
// 規則：只收 CC0；標題、描述、標籤提到遊戲名稱或疑似擷取的來源一律中止，見 BAD。
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
const cache = resolve(root, '.cache/sfx'), outDir = resolve(root, '../../assets/278/sfx');
const SR = 44100, verify = process.argv.includes('--verify');
const BAD = /counter.?strike|\bcs\s?:?\s?(go|2|source)\b|csgo|\bvalve\b|source engine|half.?life|call of duty|\bcod\b|modern warfare|black ops|battlefield|pubg|fortnite|valorant|overwatch|apex legends|rainbow six|tarkov|\bhalo\b|\bdoom\b|\bquake\b|unreal|\bgta\b|grand theft|far cry|insurgency|\barma\b|ripped|extracted|sample from|taken from|from (the )?(movie|film|game)|\bgame\b|\bgames\b|gaming|video.?game|\bfps\b|shooter/i;
const UA = { 'user-agent': 'Mozilla/5.0 (Macintosh) ochre-line-sfx' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { GUNS, FOLEY } = await import(resolve(here, 'sfx-table.mjs'));

// ---- 來源審核 ----
const vetPath = resolve(cache, 'vet.json');
mkdirSync(cache, { recursive: true }); mkdirSync(outDir, { recursive: true });
const vet = existsSync(vetPath) ? JSON.parse(readFileSync(vetPath, 'utf8')) : {};
async function source(id) {
  const f = resolve(cache, `${id}.mp3`);
  if (vet[id] && existsSync(f) && !verify) return f;
  const p = await (await fetch(`https://freesound.org/s/${id}/`, { headers: UA, redirect: 'follow' })).text();
  const lic = (p.match(/title="Go to the full license text" href="([^"]+)"/) || [])[1] || '';
  const by = (p.match(/<meta property="og:audio:artist" content="([^"]*)"/) || [])[1];
  const title = (p.match(/<meta property="og:audio:title" content="([^"]*)"/) || [])[1];
  const desc = (p.match(/<meta name="twitter:description" content="([^"]*)"/) || [])[1] || '';
  const info = (p.match(/bw-sound-page__information[\s\S]*?(?=bw-sound-page__user)/) || [''])[0].replace(/<[^>]+>/g, ' ');
  const tags = [...new Set([...p.matchAll(/\/browse\/tags\/([^/"]+)\//g)].map((m) => m[1]))];
  if (!/publicdomain\/zero\/1\.0/.test(lic)) throw new Error(`${id} 不是 CC0：${lic || '找不到授權'}`);
  const bad = [title, desc, info, tags.join(' ')].join(' ').match(BAD);
  if (bad) throw new Error(`${id}「${title}」命中排除字：${bad[0]}`);
  const prev = (p.match(/https:\/\/cdn\.freesound\.org\/previews\/[^"]+-hq\.mp3/) || [])[0];
  if (!prev) throw new Error(`${id} 找不到預覽`);
  if (!existsSync(f)) { const r = await fetch(prev, { headers: UA }); if (!r.ok) throw new Error(`${id} 下載失敗 ${r.status}`); writeFileSync(f, Buffer.from(await r.arrayBuffer())); }
  vet[id] = { by, title: title.replace(/&amp;/g, '&'), url: `https://freesound.org/s/${id}/`, lic: 'CC0 1.0', checked: new Date().toISOString().slice(0, 10) };
  writeFileSync(vetPath, JSON.stringify(vet, null, 1));
  await sleep(2600);
  return f;
}

// ---- DSP ----
function decode(f) {
  const b = execFileSync('ffmpeg', ['-v', 'error', '-nostdin', '-i', f, '-ac', '1', '-ar', String(SR), '-f', 'f32le', 'pipe:1'], { maxBuffer: 1 << 29 });
  return new Float32Array(b.buffer, b.byteOffset, b.byteLength >> 2).slice();
}
function env1ms(x) { const n = 44, e = new Float32Array(Math.ceil(x.length / n)); for (let i = 0; i < e.length; i++) { let m = 0; for (let j = i * n, q = Math.min(x.length, j + n); j < q; j++) m = Math.max(m, Math.abs(x[j])); e[i] = m; } return e; }
/** 起音：1 ms 包絡比前 12 ms 平均高 12 dB、且不低於全檔峰值 floor dB，間距至少 gap ms。開頭補 20 ms 靜音，檔案第一個樣本就是起音時才抓得到。 */
function onsets(x, floor = -18, gap = 45) {
  const e = env1ms(x); let pk = 0; for (const v of e) pk = Math.max(pk, v);
  const out = [], th = pk * 10 ** (floor / 20), get = (i) => (i < 0 ? 0 : e[i]);
  for (let i = 0; i < e.length; i++) {
    if (e[i] < th) continue;
    let pre = 0; for (let j = i - 12; j < i; j++) pre += get(j); pre /= 12;
    if (e[i] > pre * 4 + 1e-6 && (!out.length || i - out[out.length - 1] >= gap)) out.push(i);
  }
  return out.map((ms) => ms * 44);
}
/** 連發錄音的單發：谷底太淺抓不到起音時，改找間距至少 gap ms 的包絡峰，回傳峰前 3 ms。 */
function peaks(x, gap = 45, floor = -9) {
  const e = env1ms(x); let pk = 0; for (const v of e) pk = Math.max(pk, v);
  const th = pk * 10 ** (floor / 20), out = [], r = gap >> 1;
  for (let i = r; i < e.length - r; i++) {
    if (e[i] < th) continue;
    let top = true; for (let j = i - r; j <= i + r; j++) if (e[j] > e[i]) { top = false; break; }
    if (top && (!out.length || i - out[out.length - 1] >= gap)) out.push(i);
  }
  return out.map((ms) => Math.max(0, ms - 3) * 44);
}
function biquad(x, type, f, Q = 0.7, dB = 0) {
  const w = 2 * Math.PI * f / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * Q), A = 10 ** (dB / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
  else if (type === 'peak') { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
  else if (type === 'hs' || type === 'ls') { const r = 2 * Math.sqrt(A) * al, sg = type === 'hs' ? 1 : -1; b0 = A * ((A + 1) + sg * (A - 1) * c + r); b1 = -2 * sg * A * ((A - 1) + sg * (A + 1) * c); b2 = A * ((A + 1) + sg * (A - 1) * c - r); a0 = (A + 1) - sg * (A - 1) * c + r; a1 = 2 * sg * ((A - 1) - sg * (A + 1) * c); a2 = (A + 1) - sg * (A - 1) * c - r; }
  else throw new Error(type);
  const o = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = x[i], y = (b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = v; y2 = y1; y1 = y; o[i] = y; }
  return o;
}
// 頻譜匹配：同一把槍的不同錄音都拉向同一條八度音色線 sig，變體之間才像同一把、彼此之間才分得開。補償上限 ±10 dB。
const OCT = [63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
function fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } } for (let l = 2; l <= n; l <<= 1) { const a = -2 * Math.PI / l, wr = Math.cos(a), wi = Math.sin(a); for (let i = 0; i < n; i += l) { let cr = 1, ci = 0; for (let j = 0; j < l / 2; j++) { const k = i + j, m = k + l / 2, tr = re[m] * cr - im[m] * ci, ti = re[m] * ci + im[m] * cr; re[m] = re[k] - tr; im[m] = im[k] - ti; re[k] += tr; im[k] += ti; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } } }
function octave(x, s) {
  const n = 8192, re = new Float64Array(n), im = new Float64Array(n), L = Math.min(n, Math.round(SR * 0.1), x.length - s);
  for (let i = 0; i < L; i++) re[i] = x[s + i] * Math.cos((Math.PI * i) / (2 * L)) ** 2;
  fft(re, im); const df = SR / n;
  const b = OCT.map((f) => { const lo = Math.max(1, Math.floor(f * 0.707 / df)), hi = Math.min(n / 2, Math.ceil(f * 1.414 / df)); let p = 0; for (let i = lo; i < hi; i++) p += re[i] ** 2 + im[i] ** 2; return 10 * Math.log10(p / (hi - lo) + 1e-12); });
  const m = b.reduce((p, c) => p + c, 0) / b.length; return b.map((v) => v - m);
}
function matchSig(w, s, sig) {
  const m0 = sig.reduce((p, c) => p + c, 0) / sig.length;
  for (let pass = 0; pass < 2; pass++) {
    const cur = octave(w, s);
    OCT.forEach((f, k) => { const g = Math.max(-10, Math.min(10, (sig[k] - m0 - cur[k]) * 0.8)); if (Math.abs(g) > 0.3) w = biquad(w, 'peak', f, 1.2, g); });
  }
  return w;
}
// 第二層匹配：同一把的變體用 1/3 倍頻帶拉向彼此的平均。八度音色線只管大形狀，sfx-report 的距離是 25 個 1/3 倍頻帶，錄音之間細部的峰谷要在這裡收掉
const THIRD = Array.from({ length: 25 }, (_, k) => 1000 * 2 ** ((k - 13) / 3));
function third(x) {
  const n = 8192, re = new Float64Array(n), im = new Float64Array(n), L = Math.min(n, Math.round(SR * 0.12), x.length);
  for (let i = 0; i < L; i++) re[i] = x[i] * Math.cos((Math.PI * i) / (2 * L)) ** 2;
  fft(re, im); const df = SR / n;
  const b = THIRD.map((f) => { const lo = Math.max(1, Math.floor(f * 2 ** (-1 / 6) / df)), hi = Math.ceil(f * 2 ** (1 / 6) / df); let p = 0; for (let i = lo; i < Math.min(n / 2, hi); i++) p += re[i] ** 2 + im[i] ** 2; return 10 * Math.log10(p / Math.max(1, hi - lo) + 1e-12); });
  const m = b.reduce((p, c) => p + c, 0) / b.length; return b.map((v) => v - m);
}
function tighten(clips, peak) {
  for (let pass = 0; pass < 3; pass++) {
    const P = clips.map(third), mean = THIRD.map((_, k) => P.reduce((p, q) => p + q[k], 0) / P.length);
    clips.forEach((c, j) => { let w = c; THIRD.forEach((f, k) => { const g = Math.max(-9, Math.min(9, (mean[k] - P[j][k]) * 0.8)); if (Math.abs(g) > 0.25) w = biquad(w, 'peak', f, 4.3, g); }); clips[j] = w; });
  }
  // 音量對齊前 120 ms 的能量，不是峰值：sfx.js 疊上去的低頻衝擊是固定量，主體各自正規化峰值時，尖的錄音主體偏小，低頻比例就和其他變體不同
  const rms = clips.map((c) => { let e = 0; const L = Math.min(c.length, Math.round(SR * 0.12)); for (let i = 0; i < L; i++) e += c[i] ** 2; return Math.sqrt(e / L); });
  const ref = Math.min(...clips.map((c, j) => { let pk = 0; for (const v of c) pk = Math.max(pk, Math.abs(v)); return (peak / (pk || 1)) * rms[j]; }));
  clips.forEach((c, j) => { const k = ref / (rms[j] || 1); for (let i = 0; i < c.length; i++) c[i] *= k; });
}
/** 切一段：從起音開始，hold 秒後以 tau 指數衰減，len 秒結束，最後 12 ms 淡出。eq 先做（濾波器要看到起音前的靜音）。 */
function cut(x, i0, { hold = 0.03, tau = 0.09, len = 0.5, eq = [], peak = 0.84, sig = null }, nextOnset = Infinity) {
  const pre = 400, a = Math.max(0, i0 - pre);
  let w = x.slice(a, Math.min(x.length, i0 + Math.ceil(len * SR) + 8));
  for (const q of eq) w = biquad(w, ...q);
  w = biquad(w, 'hp', 32, 0.7);
  const s = i0 - a;
  if (sig) w = matchSig(w, s, sig);
  const n = Math.min(Math.ceil(len * SR), w.length - s, nextOnset === Infinity ? 1e12 : nextOnset - i0 - 66), o = new Float32Array(n);
  const fade = Math.min(n, (0.012 * SR) | 0);
  let pk = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; let v = w[s + i];
    if (t > hold) v *= Math.exp(-(t - hold) / tau);
    if (i > n - fade) v *= (n - i) / fade;
    if (i < 22) v *= i / 22;
    o[i] = v; pk = Math.max(pk, Math.abs(v));
  }
  for (let i = 0; i < n; i++) o[i] *= peak / (pk || 1);
  return o;
}

const raws = new Map();
const raw = async (id) => { if (!raws.has(id)) raws.set(id, decode(await source(id))); return raws.get(id); };

if (process.argv.includes('--list')) {
  for (const id of process.argv.slice(process.argv.indexOf('--list') + 1).map(Number)) {
    const x = await raw(id), o = onsets(x, -26, 30);
    console.log(id, (x.length / SR).toFixed(2) + 's', vet[id]?.title, '\n  ', o.map((i) => (i / SR).toFixed(3)).join(' '));
  }
  process.exit(0);
}

// ---- 組精靈圖 ----
const used = new Set();
async function bakeSet(name, spec, chunks, list, pos, fileIdx) {
  list[name] = []; const clips = [];
  for (const v of spec.v) {
    const [id, at, over] = v, x = await raw(id); used.add(id);
    const on = (over?.peaks ?? spec.peaks) ? peaks(x, spec.gap ?? 45) : onsets(x, spec.floor ?? -18, spec.gap ?? 45);
    let i0, next = Infinity;
    if (typeof at === 'number' && Number.isInteger(at) && at >= 0 && !v.sec && !spec.sec) { i0 = on[at]; next = on[at + 1] ?? Infinity; if (i0 == null) throw new Error(`${name}: ${id} 沒有第 ${at} 個起音（共 ${on.length}）`); }
    else i0 = Math.round(at * SR);
    if (over?.nonext ?? spec.nonext) next = Infinity;
    clips.push(cut(x, i0, { ...spec, ...over }, next));
  }
  if (spec.tight && clips.length > 1) tighten(clips, spec.peak ?? 0.84);
  for (const clip of clips) {
    list[name].push([fileIdx, +(pos.t / SR).toFixed(5), +(clip.length / SR).toFixed(4)]);
    chunks.push(clip); pos.t += clip.length;
    const gap = new Float32Array((0.16 * SR) | 0); chunks.push(gap); pos.t += gap.length;
  }
}
function wav(chunks, f) {
  const n = chunks.reduce((a, c) => a + c.length, 0), b = Buffer.alloc(44 + n * 2); let o = 44;
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (const c of chunks) for (const v of c) { b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), o); o += 2; }
  writeFileSync(f, b);
}
const list = {}, sprites = [['guns', GUNS, 160], ['foley', FOLEY, 128]], names = [];
for (let k = 0; k < sprites.length; k++) {
  const [nm, table, kbps] = sprites[k], chunks = [new Float32Array((0.16 * SR) | 0)], pos = { t: (0.16 * SR) | 0 };
  for (const name in table) await bakeSet(name, table[name], chunks, list, pos, k);
  const w = resolve(cache, `_${nm}.wav`), mp3 = resolve(outDir, `${nm}.mp3`);
  wav(chunks, w);
  execFileSync('lame', ['--silent', '--cbr', '-b', String(kbps), '-m', 'm', '-q', '0', w, mp3]);
  names.push(`${nm}.mp3`);
}
writeFileSync(resolve(root, 'src/audio/sfx-list.js'), `// tools/sfx.mjs 產生，不要手改。片段名 → [精靈圖索引, 起點秒, 長度秒][]\nexport const SPRITES = ${JSON.stringify(names)};\nexport const CLIPS = ${JSON.stringify(list).replace(/\],"/g, '],\n"')};\n`);

const lines = ['# 音效來源', '', '`assets/278/sfx/` 的錄音都來自 Freesound，授權皆為 CC0 1.0（<https://creativecommons.org/publicdomain/zero/1.0/>），使用的是 128 kbps 預覽檔。每個來源都開過音效頁確認授權；標題、描述或標籤提到遊戲名稱、或疑似從遊戲擷取的錄音一律不用。合成的低頻與機械層由 `src/audio/sfx.js` 即時算出。', '', '| 用途 | 音效 | 作者 | 授權 | 確認日期 |', '| --- | --- | --- | --- | --- |'];
const usage = {};
for (const t of [GUNS, FOLEY]) for (const name in t) for (const [id] of t[name].v) (usage[id] ??= new Set()).add(name);
for (const id of [...used].sort((a, b) => a - b)) lines.push(`| ${[...usage[id]].join(' ')} | [${vet[id].title.replace(/\|/g, '/')}](${vet[id].url}) | ${vet[id].by} | ${vet[id].lic} | ${vet[id].checked} |`);
writeFileSync(resolve(root, 'credits/sfx.md'), lines.join('\n') + '\n');
for (const f of names) console.log(f, (readFileSync(resolve(outDir, f)).length / 1024).toFixed(0) + ' KB');
console.log('clips', Object.keys(list).length, 'sources', used.size);
