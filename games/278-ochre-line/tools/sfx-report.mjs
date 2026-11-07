// 量測實際輸出：把 src/audio/sfx.js 單獨打包，在 chrome-headless-shell 用 OfflineAudioContext 走和遊戲相同的路徑（含空間與限幅）算出 PCM，
// 再算起音、峰值、-20 dB 尾長、頻譜重心、頻帶輪廓、彼此距離，寫進 dist/sfx-report.md，並把每把槍的 WAV 放 dist/sfx/ 給人聽。
// 全部是量測，不代表聽感判斷。
import { build } from 'esbuild';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { startServer, launch, GAME_DIR, REPO_ROOT } from './lib/serve.mjs';
import { db, mono, chPeak, hotMs, analyze, distance } from './lib/sfx-measure.mjs';
import { CLIPS } from '../src/audio/sfx-list.js';

const GUNS = ['knife', 'p9', 'c7', 'r50', 'v11', 'm7', 'b90', 't4', 'ks', 'ar5', 'x10', 's8', 's6', 'l40', 'n9'];
const CLASS = { knife: 'knife', p9: 'pistol', c7: 'pistol', r50: 'pistol+', v11: 'smg', m7: 'smg', b90: 'smg', t4: 'rifle', ks: 'rifle', ar5: 'rifle', x10: 'shotgun', s8: 'shotgun', s6: 'sniper', l40: 'sniper', n9: 'lmg' };
const RANGE = { knife: [0.05, 0.35], pistol: [0.1, 0.25], 'pistol+': [0.15, 0.3], smg: [0.1, 0.25], rifle: [0.25, 0.5], shotgun: [0.3, 0.7], sniper: [0.4, 0.95], lmg: [0.25, 0.5] };
const RPM = { n9: 800, b90: 900, v11: 900, m7: 800, ar5: 700, ks: 650, t4: 680 };
const T0 = 1;   // 預捲 1 秒：DynamicsCompressor 剛起步時還在暫態，t≈0 開槍會低報 2–5 dB

const js = (await build({ entryPoints: [resolve(GAME_DIR, 'src/audio/sfx.js')], bundle: true, write: false, format: 'iife', globalName: 'SFX', target: 'es2022', logLevel: 'error' })).outputFiles[0].text;
const html = `<!doctype html><meta charset=utf-8><script>${js.replace(/<\/script/gi, '<\\/script')}</script>`;
mkdirSync(resolve(GAME_DIR, 'dist/sfx'), { recursive: true });
writeFileSync(resolve(GAME_DIR, 'dist/sfx/_page.html'), html);

const srv = await startServer(REPO_ROOT, { '/web/_sfx.html': resolve(GAME_DIR, 'dist/sfx/_page.html') });
const br = await launch(), page = await br.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(srv.url + '/web/_sfx.html');
const load = await page.evaluate(async () => { const t = performance.now(); SFX.preloadSfx(); SFX.initAudio(); await SFX.whenSfxReady(); return { ms: performance.now() - t, st: SFX.sfxStatus(), sr: (new AudioContext()).sampleRate }; });
const render = (events, dur, opt) => page.evaluate(async ({ events, dur, opt }) => {
  const R = Math.random; Math.random = () => 0.5;
  const b = await SFX.renderSfx(events, dur, opt); Math.random = R;
  const pack = (a) => { const u = new Uint8Array(a.buffer), n = 0x8000; let s = ''; for (let i = 0; i < u.length; i += n) s += String.fromCharCode.apply(null, u.subarray(i, i + n)); return btoa(s); };
  return { sr: b.sampleRate, l: pack(b.getChannelData(0)), r: pack(b.getChannelData(1)) };
}, { events, dur, opt }).then(({ sr, l, r }) => { const f = (s) => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.length >> 2).slice(); }; return { sr, l: f(l), r: f(r) }; });

function save(name, a) {
  const n = a.l.length, b = Buffer.alloc(44 + n * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(a.sr, 24); b.writeUInt32LE(a.sr * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, a.l[i])) * 32767), 44 + i * 4); b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, a.r[i])) * 32767), 46 + i * 4); }
  writeFileSync(resolve(GAME_DIR, 'dist/sfx', name + '.wav'), b);
}
const nameOf = (id) => (id === 'knife' ? 'knife' : 'shot_' + id);
const rows = [];
for (const id of GUNS) {
  const list = [];
  const ev = (v) => [{ t: T0, name: nameOf(id), x: 0, y: 0, z: 0, v }], t1 = T0 - 0.03;
  for (let v = 0; v < CLIPS[nameOf(id)].length; v++) {
    const a = await render(ev(v), T0 + 1.5), q = analyze(a, t1); if (v === 0) save(id, a);
    // 單發不可碰到限幅器：限幅前的峰值在音量 .8 與 1.0 都要量，音量 100% 是使用者拉得到的
    const raw8 = await render(ev(v), T0 + 0.8, { raw: true, volume: 0.8 }), raw10 = await render(ev(v), T0 + 0.8, { raw: true, volume: 1 }), lim10 = await render(ev(v), T0 + 0.8, { volume: 1 });
    q.raw8 = db(chPeak(raw8, t1)); q.raw10 = db(chPeak(raw10, t1)); q.lim10 = db(chPeak(lim10, t1)); q.hot8 = hotMs(a, 0.84, t1); q.hot10 = hotMs(lim10, 0.84, t1); list.push(q);
  }
  const far = await render([{ t: T0, name: nameOf(id), x: 38, y: 0, z: 12, v: 0 }], T0 + 1.8); save(id + '_far', far);
  const fa = analyze(far, T0 - 0.03);
  let L = 0, R = 0; for (let i = 0; i < far.l.length; i++) { L += far.l[i] ** 2; R += far.r[i] ** 2; }
  const mean = (k) => list.reduce((p, q) => p + q[k], 0) / list.length;
  list[0].t20m = mean('t20'); list[0].t20lo = Math.min(...list.map((q) => q.t20)); list[0].t20hi = Math.max(...list.map((q) => q.t20));
  for (const k of ['peak', 'raw8', 'raw10', 'lim10', 'hot8', 'hot10']) list[0]['max_' + k] = Math.max(...list.map((q) => q[k]));
  rows.push({ id, a: list[0], far: fa, lr: 10 * Math.log10(R / (L || 1e-9)), v: list });
}
// 每把的所有變體兩兩比：best 是和別把任一變體的最小距離，within 是同一把內的最大距離。within 大於 best 表示有變體比自己人更靠近別把
const near = rows.map((r) => { let best = 1e9, who = '', within = 0; for (const a of r.v) { for (const q of rows) if (q !== r) for (const b of q.v) { const d = distance(a, b); if (d < best) { best = d; who = q.id; } } for (const b of r.v) within = Math.max(within, distance(a, b)); } return { best, who, within }; });

const bursts = [];
for (const id of Object.keys(RPM)) {
  const dt = 60 / RPM[id], N = 30, ev = []; for (let i = 0; i < N; i++) ev.push({ t: T0 + i * dt, name: 'shot_' + id, x: 0, y: 0, z: 0, v: i });
  const a = await render(ev, T0 + N * dt + 0.8), a1 = await render(ev, T0 + N * dt + 0.8, { volume: 1 }); let pk = 0, clip = 0, hot = 0; const m = a.l;
  for (let c = 0; c < 2; c++) { const d = c ? a.r : a.l; for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; if (v >= 0.98) clip++; if (v >= 0.84) hot++; } }
  // 每發之間谷底：相鄰兩發之間最小的 2 ms 包絡，相對峰值。谷越深，連發越不糊
  const sr = a.sr, x = mono(a); let valley = 0, cnt = 0;
  for (let i = 5; i < N - 1; i++) { const s = Math.round((T0 + i * dt) * sr), e = Math.round((T0 + (i + 1) * dt) * sr), w = Math.round(sr * 0.002); let lo = 1, hi = 0; for (let j = s; j + w < e; j += w) { let v = 0; for (let k = j; k < j + w; k++) v = Math.max(v, Math.abs(x[k])); lo = Math.min(lo, v); hi = Math.max(hi, v); } valley += db(lo) - db(hi); cnt++; }
  bursts.push({ id, peak: db(pk), clipMs: clip / 2 / sr * 1000, hotMs: hot / 2 / sr * 1000, valley: valley / cnt, peak10: db(chPeak(a1)), hot10: hotMs(a1, 0.84), clip10: hotMs(a1, 0.98) });
  if (id === 'n9' || id === 'b90') save(id + '_burst', a);
}
// 壓力：自己 N9 全自動，同時四把遠近不同的槍
const stress = []; for (let i = 0; i < 26; i++) { stress.push({ t: 0.02 + i * 0.075, name: 'shot_n9', x: 0, y: 0, z: 0, v: i }); for (const [k, id] of ['ar5', 'b90', 'v11', 'ks'].entries()) stress.push({ t: 0.02 + i * 0.075 + k * 0.011, name: 'shot_' + id, x: 6 + k * 6, y: 0, z: 4 - k, v: i }); }
const sa = await render(stress, 2.8, { volume: 1 }); let sp = 0, sc = 0; for (const d of [sa.l, sa.r]) for (const v of d) { const q = Math.abs(v); if (q > sp) sp = q; if (q >= 0.98) sc++; }
// 退路：拿掉錄音也要有聲音
const syn = analyze(await render([{ t: 0.03, name: 'shot_ar5', x: 0, y: 0, z: 0 }], 1, { synth: true }));
// 動作聲與其他片段：逐一確認切到的不是靜音
const others = [];
for (const name in CLIPS) {
  if (name.startsWith('shot_') || name === 'knife') continue;
  for (let v = 0; v < CLIPS[name].length; v++) { const a = analyze(await render([{ t: 0.02, name, x: 0, y: 0, z: 0, v }], Math.min(2.6, CLIPS[name][v][2] + 0.5)), 0, 2.5); others.push({ name, v, dur: CLIPS[name][v][2], ...a }); }
}
await br.close(); await srv.close();

const sz = ['guns.mp3', 'foley.mp3'].map((f) => [f, statSync(resolve(REPO_ROOT, 'assets/278/sfx', f)).size]);
const f1 = (v, n = 1) => v.toFixed(n);
const md = ['# 武器音效量測（dist/sfx-report.md）', '', '由 `tools/sfx-report.mjs` 產生。數字來自 OfflineAudioContext 走完 `sfx.js` 的實際路徑（主體＋合成層＋空間＋限幅），音量設定 0.8。**這些都是量測，沒有任何聽感判斷**：開發者無法聽聲音。', '', `載入與解碼 ${f1(load.ms, 0)} ms（無頭環境），片段 ${load.st.clips}，合成層 ${load.st.guns} 把，取樣率 ${load.sr}。素材 ${sz.map(([f, s]) => `${f} ${f1(s / 1024, 0)} KB`).join('、')}，合計 ${f1(sz.reduce((a, b) => a + b[1], 0) / 1048576, 2)} MB。頁面錯誤 ${errs.length} 筆${errs.length ? '：' + errs.slice(0, 3).join(' / ') : ''}。`, '', '## 第一人稱單發（全部變體，開槍前預捲 1 秒，峰值逐聲道）', '', `單發不可碰到限幅器（門檻 -2.5 dBFS）。「限幅前」是不經壓縮器與 soft clip 的峰值，每把取最差的變體。`, '', '| 武器 | 類別 | 變體 | 峰值 dBFS（音量 .8） | 限幅前 .8 | 限幅前 1.0 | 峰值（音量 1.0） | ≥.84 ms（.8／1.0） | 起音 ms | -20 dB 尾長 s（全變體平均與範圍） | -40 dB s | 重心 Hz | <150 Hz 佔比 | 前 150 ms RMS | 尾長目標 | 判定 | 最近鄰（各變體最小距離 dB） | 同把變體最大距離 dB |', '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | ---: |'];
rows.forEach((r, i) => { const R = RANGE[CLASS[r.id]], ok = r.a.t20m >= R[0] && r.a.t20m <= R[1]; md.push(`| ${r.id} | ${CLASS[r.id]} | ${r.v.length} | ${f1(r.a.max_peak)} | ${f1(r.a.max_raw8)} | ${f1(r.a.max_raw10)} | ${f1(r.a.max_lim10)} | ${f1(r.a.max_hot8)}／${f1(r.a.max_hot10)} | ${f1(r.a.attack, 2)} | ${f1(r.a.t20m, 3)}（${f1(r.a.t20lo, 2)}–${f1(r.a.t20hi, 2)}） | ${f1(r.a.t40, 3)} | ${f1(r.a.cen, 0)} | ${f1(r.a.lo * 100)}% | ${f1(r.a.rms)} | ${R[0]}–${R[1]} | ${ok ? '在內' : '**超出**'} | ${near[i].who}（${f1(near[i].best)}） | ${f1(near[i].within)} |`); });
md.push('', '距離是 50 Hz–12.5 kHz 的 25 個 1/3 倍頻帶、去掉平均後的方均根差（前 120 ms），只看頻譜，不含尾長與起音。沒有對應的聽感門檻：同把距離大於最近鄰的武器，表示量測上分不開，不代表聽得出或聽不出。', '', '## 遠方（右前方約 40 m）', '', '| 武器 | 相對近距峰值 dB | 重心 Hz | 近距重心 Hz | -20 dB 尾長 s | 右/左 dB |', '| --- | ---: | ---: | ---: | ---: | ---: |');
rows.forEach((r) => md.push(`| ${r.id} | ${f1(r.far.peak - r.a.peak)} | ${f1(r.far.cen, 0)} | ${f1(r.a.cen, 0)} | ${f1(r.far.t20, 3)} | ${f1(r.lr)} |`));
md.push('', '## 連發 30 發（含限幅）', '', '| 武器 | rpm | 峰值 dBFS | ≥0.98 累計 ms | ≥0.84（soft clip 區）累計 ms | 音量 1.0 峰值 | 音量 1.0 ≥0.84 ms | 音量 1.0 ≥0.98 ms | 發間谷底 dB |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
bursts.forEach((b) => md.push(`| ${b.id} | ${RPM[b.id]} | ${f1(b.peak)} | ${f1(b.clipMs)} | ${f1(b.hotMs)} | ${f1(b.peak10)} | ${f1(b.hot10)} | ${f1(b.clip10)} | ${f1(b.valley)} |`));
md.push('', '## 動作聲與其他片段', '', '| 片段 | 變體 | 長度 s | 峰值 dBFS | -20 dB 尾長 s | 重心 Hz |', '| --- | ---: | ---: | ---: | ---: | ---: |');
others.forEach((o) => md.push(`| ${o.name} | ${o.v} | ${f1(o.dur, 2)} | ${f1(o.peak)} | ${f1(o.t20, 3)} | ${f1(o.cen, 0)} |`));
md.push('', `壓力測試（音量 1.0，自己 N9 全自動＋四把近距離槍同時開 2 s）：峰值 ${f1(db(sp))} dBFS，≥0.98 的樣本 ${sc}。`, '', `退路：拿掉錄音時 shot_ar5 走純合成，峰值 ${f1(syn.peak)} dBFS，重心 ${f1(syn.cen, 0)} Hz。`, '', '每把的第一人稱、遠方、連發 WAV 在 `dist/sfx/`，給人耳驗收。', '');
writeFileSync(resolve(GAME_DIR, 'dist/sfx-report.md'), md.join('\n'));
console.log(md.join('\n'));
