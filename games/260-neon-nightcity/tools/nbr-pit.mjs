// 紐柏林維修區的道具原檔（24-nbr-pit.js）：Sketchfab 下載的 glTF（.cache/pit-src/<名稱>/scene.gltf，gitignore）轉成 tools/props.mjs 讀的 .cache/pit/<名稱>.glb。
// Tyre Holder 2023（kilianhoffmann13，CC BY 4.0）的胎壁印著真實的輪胎廠牌、側板是真實賽事與贊助商的標誌：胎壁的字與色帶整圈塗回橡膠色、
// 換成一道沒有字的黃色配方線，側板換成素面白板（上緣黑色斜角、下緣紅色斜帶，照原本的版型、不放字）。Pit Board（Alex Werner，CC BY 4.0）照原檔。
// 車間的道具（都是 CC BY 4.0，原檔是 Sketchfab 的 GLB）：Garage Cabinets（Victor_Biedrycki，櫃體的暗紅改成石墨灰）、Mechanics Tool Chest with Top Box
// （zeleniy89，原檔材質是 BLEND，改成不透明）、Trolley Jack Lo Poly（almartin）、Fire Extinguisher（loichuet1），貼圖上沒有真實廠牌
// 用法：node tools/nbr-pit.mjs，再 node tools/props.mjs nbr_pit
import { createRequire } from 'node:module';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(root, '../197-openworld/package.json'));
const imp = (n) => import(pathToFileURL(req.resolve(n)).href);
const { NodeIO } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const sharp = (await imp('sharp')).default;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const SRC = resolve(root, '.cache/pit-src'), OUT = resolve(root, '.cache/pit');

// 胎壁：亮的或有彩度的像素（字、色帶、白邊）塗成旁邊的橡膠色；那一圈的中位半徑畫一道 2.5% 寬的黃色配方線
async function sidewall(img) {
  const { data, info } = await sharp(Buffer.from(img)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info, mark = new Uint8Array(w * h), rs = [];
  let sx = 0, sz = 0, n = 0;
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx > 70 || mx - mn > 28) { mark[i] = 1; sx += i % w; sz += (i / w) | 0; n++; }
  }
  if (!n) return null;
  const cx = sx / n, cz = sz / n;
  for (let i = 0; i < w * h; i++) if (mark[i]) rs.push(Math.hypot(i % w - cx, ((i / w) | 0) - cz));
  rs.sort((a, b) => a - b);
  const rm = rs[rs.length >> 1], hw = w * .0125;
  for (let i = 0; i < w * h; i++) {
    const d = Math.abs(Math.hypot(i % w - cx, ((i / w) | 0) - cz) - rm);
    if (d < hw) { data[i * 4] = 214; data[i * 4 + 1] = 178; data[i * 4 + 2] = 36; }
    else if (mark[i]) { data[i * 4] = 27; data[i * 4 + 1] = 27; data[i * 4 + 2] = 29; }
  }
  return new Uint8Array(await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer());
}
// 側板：素面白板，上緣黑色斜角、下緣紅黑兩道斜帶
async function panel(img) {
  const { width: w, height: h } = await sharp(Buffer.from(img)).metadata();
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, u = x / w, v = y / h;
    const c = v < .3 - u * .12 ? [22, 22, 24] : v > .9 - u * .07 ? [24, 24, 26] : v > .87 - u * .07 ? [196, 34, 30] : [232, 233, 235];
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
  }
  return new Uint8Array(await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer());
}

mkdirSync(OUT, { recursive: true });
const GRAPHITE = [.045, .05, .056, 1];
const TWEAK = {
  garage_cabinets: m => /^Cabinet(_Door)?_Color$/.test(m.getName()) && m.setBaseColorFactor(GRAPHITE),
  mechanics_tool_chest_with_top_box: m => m.setAlphaMode('OPAQUE'),
};
for (const name of ['pit_board', 'tyre_holder_2023', 'garage_cabinets', 'mechanics_tool_chest_with_top_box', 'trolley_jack_lo_poly', 'fire_extinguisher']) {
  const gl = resolve(SRC, name, name + '.glb'), doc = await io.read(existsSync(gl) ? gl : resolve(SRC, name, 'scene.gltf'));
  for (const m of doc.getRoot().listMaterials()) if (TWEAK[name]?.(m)) console.log(`${name}: ${m.getName()} 改了材質`);
  for (const m of doc.getRoot().listMaterials()) {
    const t = m.getBaseColorTexture(); if (!t) continue;
    const fix = /^Slick_Tyre/.test(m.getName()) ? sidewall : m.getName() === 'Tyre_Holder_Logo' ? panel : null;
    if (!fix) continue;
    const png = await fix(t.getImage()); if (!png) continue;
    t.setImage(png).setMimeType('image/png').setURI('');
    console.log(`${name}: ${m.getName()} 換掉廠牌圖`);
  }
  await io.write(resolve(OUT, name + '.glb'), doc);
  console.log('寫出 .cache/pit/' + name + '.glb');
}
