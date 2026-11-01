// 截圖裁切放大並排：node tools/crop.mjs out.png x y w h scale a.png b.png [c.png]
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromePath } from './lib.mjs';
const [out, x, y, w, h, k, ...ins] = process.argv.slice(2);
const b = await chromium.launch({ headless: true, executablePath: chromePath() }), p = await b.newPage();
const png = await p.evaluate(async ({ srcs, x, y, w, h, k }) => {
  const imgs = await Promise.all(srcs.map(s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; })));
  const c = new OffscreenCanvas(w * k * imgs.length + 8 * (imgs.length - 1), h * k), g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  imgs.forEach((im, j) => g.drawImage(im, x, y, w, h, j * (w * k + 8), 0, w * k, h * k));
  const bl = await c.convertToBlob({ type: 'image/png' }), u = new Uint8Array(await bl.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768)); return btoa(s);
}, { srcs: ins.map(f => 'data:image/png;base64,' + readFileSync(f).toString('base64')), x: +x, y: +y, w: +w, h: +h, k: +k });
writeFileSync(out, Buffer.from(png, 'base64')); await b.close();
