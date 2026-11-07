#!/usr/bin/env node
// 把 sky/env.hdr 預先濾成 half float cube：assets/278/sky/env.bin。
// 為什麼要烘：HDRCubeTexture 開機時用 4096 樣本在 GPU 上濾 6 面 8 層，全塞在一個 command buffer，約 300 ms。
// macOS 上和別的 GPU 工作搶時會觸發 GPU 重啟（/Library/Logs/DiagnosticReports/gpuEvent-*：firmware-detected lockup），
// 那批指令被殺掉，環境貼圖留下隨機位元，整局彩虹槍面或全白，而且 CPU 端、WebGPU 驗證層都不會報錯。
// 改 env.hdr 才要重跑。node tools/bake-env.mjs [--check]（--check 只驗 env.bin 和現場濾的結果一致）
import { build } from 'esbuild';
import { startServer, launch, GAME_DIR, REPO_ROOT } from './lib/serve.mjs';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const entry = `
import { WebGPUEngine, Scene, HDRCubeTexture } from '@babylonjs/core/Legacy/legacy.js';
window.bake = async url => {
  const c = document.createElement('canvas'); c.width = c.height = 16; document.body.append(c);
  const engine = new WebGPUEngine(c); await engine.initAsync();
  const scene = new Scene(engine);
  const t = await new Promise((ok, no) => { const t = new HDRCubeTexture(url, scene, 128, false, true, false, true, () => ok(t), no); });
  engine.flushFramebuffer(); await engine._device.queue.onSubmittedWorkDone();
  const size = t.getSize().width, lods = Math.log2(size) + 1, parts = [];
  for (let l = 0; l < lods; l++) for (let f = 0; f < 6; f++) {
    const r = await t.readPixels(f, l, null, true, true), u = new Uint16Array(r.buffer, r.byteOffset, r.byteLength >> 1), w = size >> l;
    if (u.length !== w * w * 4) throw new Error('長度不符 ' + l + ' ' + f + ' ' + u.length);
    parts.push(Array.from(new Uint8Array(u.buffer, u.byteOffset, u.byteLength)));
  }
  const p = t.sphericalPolynomial, v = x => [x.x, x.y, x.z], h = p.preScaledHarmonics;   // 取 preScaled 才會和執行期 PBR 拿到的完全一樣；由多項式反推有誤差
  return { size, lods, scale: t.lodGenerationScale, offset: t.lodGenerationOffset, sph: { x: v(p.x), y: v(p.y), z: v(p.z), xx: v(p.xx), yy: v(p.yy), zz: v(p.zz), yz: v(p.yz), zx: v(p.zx), xy: v(p.xy) }, sh: ['l00', 'l1_1', 'l10', 'l11', 'l2_2', 'l2_1', 'l20', 'l21', 'l22'].map(k => [k, v(h[k])]), parts };
};
`;
const js = (await build({ stdin: { contents: entry, resolveDir: GAME_DIR }, bundle: true, write: false, format: 'iife', target: 'es2022', logLevel: 'error', define: { 'import.meta.url': '"http://local/"', __DEV__: 'false' } })).outputFiles[0].text;
mkdirSync(resolve(GAME_DIR, 'dist'), { recursive: true });
const html = resolve(GAME_DIR, 'dist/env-bake.html'); writeFileSync(html, `<!doctype html><meta charset=utf-8><script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
const s = await startServer(undefined, { '/env-bake.html': html }), b = await launch();
const half = v => { const e = (v >> 10) & 31, m = v & 1023, s = v >> 15 ? -1 : 1; return e === 31 ? (m ? NaN : s * Infinity) : s * (e ? (1 + m / 1024) * 2 ** (e - 15) : m / 1024 * 2 ** -14); };
try {
  const once = async () => { const p = await b.newPage(); p.on('pageerror', e => console.log('頁面錯誤', String(e.stack || e).slice(0, 400))); await p.goto(s.url + '/env-bake.html'); const r = await p.evaluate(u => window.bake(u), '/assets/278/sky/env.hdr'); await p.close(); return r; };
  const A = await once(), B = await once();
  const bytes = r => Buffer.concat(r.parts.map(x => Buffer.from(x)));
  const a = bytes(A), c = bytes(B);
  if (!a.equals(c)) throw new Error('兩次濾出來不一樣：GPU 可能剛好被重啟，機器閒下來再跑一次');
  // 驗數值：不准有 Inf／NaN，每層平均要接近（濾波不改能量），天空沒有太陽盤所以峰值不高
  const u = new Uint16Array(a.buffer, a.byteOffset, a.length >> 1); let o = 0; const report = [];
  for (let l = 0; l < A.lods; l++) { const n = (A.size >> l) ** 2 * 4 * 6; let mx = 0, sum = 0, cnt = 0; for (let i = 0; i < n; i++) { if (i % 4 === 3) continue; const v = half(u[o + i]); if (!Number.isFinite(v) || v < 0) throw new Error(`lod ${l} 有壞值 ${v}`); mx = Math.max(mx, v); sum += v; cnt++; } o += n; report.push([+mx.toFixed(2), +(sum / cnt).toFixed(3)]); }
  if (report.some(x => x[0] > 16 || x[1] < 0.1 || x[1] > 0.25)) throw new Error('數值超出預期 ' + JSON.stringify(report));
  console.log('每層 [最大, 平均]', JSON.stringify(report));
  const out = resolve(REPO_ROOT, 'assets/278/sky/env.bin');
  const meta = Buffer.from(JSON.stringify({ size: A.size, lods: A.lods, scale: A.scale, offset: A.offset, sph: A.sph, sh: A.sh })), pad = (8 - ((4 + meta.length) % 8)) % 8, head = Buffer.alloc(4); head.writeUInt32LE(meta.length + pad);
  const file = Buffer.concat([head, meta, Buffer.alloc(pad, 0x20), a]);
  if (process.argv.includes('--check')) { const cur = readFileSync(out); if (!cur.equals(file)) throw new Error('env.bin 和現場濾的不同'); console.log('env.bin 一致'); } else { writeFileSync(out, file); console.log(out, (file.length / 1024).toFixed(0) + ' KB'); }
} finally { await b.close(); await s.close(); }
