#!/usr/bin/env node
// 作品 278 貼圖檢查：四方拼貼 contact sheet 與數值報告。
//
//   CHROME_PATH=<chrome-headless-shell> node tools/contact-sheet.mjs
//
// 產出 dist/contact-albedo.jpg、dist/contact-maps.jpg、dist/contact-sky.jpg、dist/assets-tex.json。
// 一定要給 headless shell 的路徑，這個工具不會去開系統 Chrome。

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(GAME, '../..');
const TEX = path.join(ROOT, 'assets/278/tex');
const SKY = path.join(ROOT, 'assets/278/sky');
const DIST = path.join(GAME, 'dist');
const DL = path.join(DIST, 'dl/tex');

const chrome = process.env.CHROME_PATH;
if (!chrome) throw new Error('請設定 CHROME_PATH 指向 chrome-headless-shell');

const NAMES = ['sandstone', 'plaster', 'whitewash', 'ashlar', 'brick', 'flag', 'cobble', 'sand',
  'tile', 'wood', 'woodpaint', 'metal', 'military', 'canvas'];

const size = f => {
  const line = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f]).toString();
  return line.trim().split(',').map(Number);
};
const raw = (f, w, h) => execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', `scale=${w}:${h}:flags=area`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });

/**
 * 接縫：環繞邊界的相鄰差 ÷ 圖內相鄰差的平均，接近 1 代表接縫和內部一樣平順。
 * 內部很平滑的貼圖比值會被放大，所以另外記絕對差（0–255），兩者都高才算接縫。
 */
function seamRatio(p, w, h) {
  const rowDiff = (a, b) => {
    let s = 0;
    for (let x = 0; x < w * 3; x++) s += Math.abs(p[a * w * 3 + x] - p[b * w * 3 + x]);
    return s / (w * 3);
  };
  const colDiff = (a, b) => {
    let s = 0;
    for (let y = 0; y < h; y++) for (let c = 0; c < 3; c++) s += Math.abs(p[(y * w + a) * 3 + c] - p[(y * w + b) * 3 + c]);
    return s / (h * 3);
  };
  let inV = 0, inH = 0;
  for (let y = 0; y < h - 1; y++) inV += rowDiff(y, y + 1);
  for (let x = 0; x < w - 1; x++) inH += colDiff(x, x + 1);
  const absV = rowDiff(h - 1, 0), absH = colDiff(w - 1, 0);
  return { h: +(absH / (inH / (w - 1))).toFixed(2), v: +(absV / (inV / (h - 1))).toFixed(2), absH: +absH.toFixed(1), absV: +absV.toFixed(1) };
}

function colour(p) {
  let r = 0, g = 0, b = 0;
  const n = p.length / 3;
  for (let i = 0; i < p.length; i += 3) { r += p[i]; g += p[i + 1]; b += p[i + 2]; }
  r /= n; g /= n; b /= n;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let hue = d === 0 ? 0 : mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  return { rgb: [r, g, b].map(Math.round), hue: Math.round(hue), sat: +(d / mx).toFixed(2), val: +(mx / 255).toFixed(2) };
}

/** 有損壓縮後的法線夾角誤差（度）：平均與 99 百分位。 */
function normalError(a, b) {
  const errs = [];
  const v = (p, i) => {
    const x = p[i] / 127.5 - 1, y = p[i + 1] / 127.5 - 1, z = p[i + 2] / 127.5 - 1;
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  };
  for (let i = 0; i < a.length; i += 3) {
    const m = v(a, i), n = v(b, i);
    errs.push(Math.acos(Math.min(1, m[0] * n[0] + m[1] * n[1] + m[2] * n[2])) * 180 / Math.PI);
  }
  errs.sort((x, y) => x - y);
  return { mean: +(errs.reduce((s, e) => s + e, 0) / errs.length).toFixed(2), p99: +errs[errs.length * 0.99 | 0].toFixed(2) };
}

function channels(p) {
  const out = [];
  for (let c = 0; c < 3; c++) {
    let s = 0, lo = 255, hi = 0;
    for (let i = c; i < p.length; i += 3) { s += p[i]; lo = Math.min(lo, p[i]); hi = Math.max(hi, p[i]); }
    out.push({ mean: +(s / (p.length / 3)).toFixed(1), min: lo, max: hi });
  }
  return { ao: out[0], rough: out[1], metal: out[2] };
}

const sources = JSON.parse(execFileSync('node', ['-e', `
  const s=require('fs').readFileSync(${JSON.stringify(path.join(GAME, 'tools/fetch-textures.mjs'))},'utf8');
  const m=[...s.matchAll(/name: '(\\w+)', id: '(\\w+)'/g)].map(x=>[x[1],x[2]]);
  console.log(JSON.stringify(Object.fromEntries(m)))`]).toString());

const report = {};
for (const name of NAMES) {
  const fa = path.join(TEX, `${name}_a.webp`), fn = path.join(TEX, `${name}_n.webp`), fo = path.join(TEX, `${name}_orm.webp`);
  const [w, h] = size(fa);
  const a = raw(fa, w, h), n = raw(fn, w, h), o = raw(fo, w, h);
  const src = path.join(DL, sources[name]);
  report[name] = {
    size: [w, h],
    bytes: [fa, fn, fo].map(f => fs.statSync(f).size),
    albedo: colour(a),
    seam: { albedo: seamRatio(a, w, h), normal: seamRatio(n, w, h) },
    normalErrorDeg: normalError(raw(path.join(src, 'nor_gl.png'), w, h), n),
    orm: channels(o),
  };
}
fs.writeFileSync(path.join(DIST, 'assets-tex.json'), JSON.stringify(report, null, 1) + '\n');

const cell = (url, label, c) => `<div style="position:relative;width:${c}px;height:${c}px;background:url(${url});background-size:${c / 2}px ${c / 2}px"><span style="position:absolute;left:0;bottom:0;font:12px system-ui;color:#fff;background:#000c;padding:1px 4px">${label}</span></div>`;
const grid = (cols, c, body) => `<!doctype html><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},${c}px)">${body}</body>`;

const browser = await chromium.launch({ executablePath: chrome });
async function shot(html, w, h, out) {
  const f = path.join(DIST, 'contact.html');
  fs.writeFileSync(f, html);
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.goto('file://' + f);
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(DIST, out), type: 'jpeg', quality: 86 });
  await p.close();
  fs.rmSync(f);
}

const texUrl = (n, s) => `file://${TEX}/${n}_${s}.webp`;
{
  const c = 384, cols = 4;
  const body = NAMES.map(n => {
    const r = report[n];
    return cell(texUrl(n, 'a'), `${n} h${r.albedo.hue} s${r.albedo.sat} v${r.albedo.val}`, c);
  }).join('');
  await shot(grid(cols, c, body), cols * c, Math.ceil(NAMES.length / cols) * c, 'contact-albedo.jpg');
}
{
  const c = 256, cols = 6;
  const body = NAMES.flatMap(n => [cell(texUrl(n, 'n'), `${n} n`, c), cell(texUrl(n, 'orm'), `${n} orm`, c)]).join('');
  await shot(grid(cols, c, body), cols * c, Math.ceil(NAMES.length * 2 / cols) * c, 'contact-maps.jpg');
}
await shot(`<!doctype html><body style="margin:0"><img src="file://${SKY}/sky.webp" style="width:1600px;height:800px;display:block"></body>`, 1600, 800, 'contact-sky.jpg');
await browser.close();

const fmt = (n, r) => `${n.padEnd(10)} ${r.albedo.rgb.join(',').padEnd(12)} h${String(r.albedo.hue).padStart(3)} s${r.albedo.sat} seamA ${r.seam.albedo.h}/${r.seam.albedo.v} (${r.seam.albedo.absH}/${r.seam.albedo.absV}) seamN ${r.seam.normal.h}/${r.seam.normal.v} nErr ${r.normalErrorDeg.mean}/${r.normalErrorDeg.p99} ao ${r.orm.ao.mean} rough ${r.orm.rough.mean} metal ${r.orm.metal.mean}(${r.orm.metal.max}) KB ${r.bytes.map(b => Math.round(b / 1024)).join('/')}`;
for (const n of NAMES) console.log(fmt(n, report[n]));
