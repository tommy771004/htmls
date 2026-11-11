// RO SPR / ACT 解析，並把 ACT 每格的多個圖層合成成一張索引圖，輸出本作的精靈圖格式：
//   json  { image, palette, palettes, frames:[[x,y,w,h,ox,oy]], actions:{名稱:{delay, dirs:[8][格][[frameIdx,x,y]]}} }
//   png   R = 調色盤索引、A = 255（透明為全 0）
//   pal   256×1，RGBA，索引 0 透明
import { encodePng } from './png.mjs';

export const ACTIONS = ['idle', 'walk', 'sit', 'pickup', 'ready', 'attack', 'hurt', 'freeze', 'dead', 'freeze2', 'attack2', 'attack3', 'cast'];

export function parseSpr(buf) {
  if (buf.toString('latin1', 0, 2) !== 'SP') throw new Error('不是 SPR');
  const ver = buf[3] + buf[2] / 10;
  let p = 4;
  const nIdx = buf.readUInt16LE(p); p += 2;
  let nRgba = 0;
  if (ver >= 2) { nRgba = buf.readUInt16LE(p); p += 2; }
  const indexed = [], rgba = [];
  for (let i = 0; i < nIdx; i++) {
    const w = buf.readUInt16LE(p), h = buf.readUInt16LE(p + 2); p += 4;
    const data = new Uint8Array(w * h);
    if (ver >= 2.1) {
      const size = buf.readUInt16LE(p); p += 2;
      const end = p + size;
      let o = 0;
      while (p < end && o < data.length) {
        const c = buf[p++];
        data[o++] = c;
        if (c === 0) {
          const n = buf[p++];
          if (n === 0) data[o++] = 0;
          else for (let k = 1; k < n; k++) data[o++] = 0;
        }
      }
      p = end;
    } else { data.set(buf.subarray(p, p + w * h)); p += w * h; }
    indexed.push({ w, h, data });
  }
  for (let i = 0; i < nRgba; i++) {
    const w = buf.readUInt16LE(p), h = buf.readUInt16LE(p + 2); p += 4;
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const s = p + ((h - 1 - y) * w + x) * 4, d = (y * w + x) * 4; // 檔內為 ABGR、由下往上
      data[d] = buf[s + 3]; data[d + 1] = buf[s + 2]; data[d + 2] = buf[s + 1]; data[d + 3] = buf[s];
    }
    p += w * h * 4;
    rgba.push({ w, h, data });
  }
  const palette = new Uint8Array(1024);
  if (ver >= 1.1) palette.set(buf.subarray(buf.length - 1024));
  return { ver, indexed, rgba, palette };
}

export function parseAct(buf) {
  if (buf.toString('latin1', 0, 2) !== 'AC') throw new Error('不是 ACT');
  const ver = buf[3] + buf[2] / 10;
  let p = 4;
  const nAct = buf.readUInt16LE(p); p += 12;
  const actions = [];
  for (let a = 0; a < nAct; a++) {
    const nFrames = buf.readUInt32LE(p); p += 4;
    const frames = [];
    for (let f = 0; f < nFrames; f++) {
      p += 32;
      const nLayers = buf.readUInt32LE(p); p += 4;
      const layers = [];
      for (let l = 0; l < nLayers; l++) {
        const L = { x: buf.readInt32LE(p), y: buf.readInt32LE(p + 4), index: buf.readInt32LE(p + 8), mirror: buf.readInt32LE(p + 12), color: [255, 255, 255, 255], sx: 1, sy: 1, angle: 0, type: 0 };
        p += 16;
        if (ver >= 2) {
          L.color = [...buf.subarray(p, p + 4)]; p += 4;
          L.sx = L.sy = buf.readFloatLE(p); p += 4;
          if (ver >= 2.4) { L.sy = buf.readFloatLE(p); p += 4; }
          L.angle = buf.readInt32LE(p); L.type = buf.readInt32LE(p + 4); p += 8;
          if (ver >= 2.5) p += 8;
        }
        layers.push(L);
      }
      let sound = -1;
      if (ver >= 2) { sound = buf.readInt32LE(p); p += 4; }
      const attach = [];
      if (ver >= 2.3) {
        const n = buf.readInt32LE(p); p += 4;
        for (let k = 0; k < n; k++) { attach.push([buf.readInt32LE(p + 4), buf.readInt32LE(p + 8)]); p += 16; }
      }
      frames.push({ layers, sound, attach });
    }
    actions.push({ frames, delay: 150 });
  }
  if (ver >= 2.1) { const n = buf.readInt32LE(p); p += 4 + n * 40; }
  if (ver >= 2.2) for (let a = 0; a < nAct; a++) { actions[a].delay = buf.readFloatLE(p) * 25; p += 4; }
  return { ver, actions };
}

function nearest(pal, r, g, b) {
  let best = 1, bd = Infinity;
  for (let i = 1; i < 256; i++) {
    const d = (pal[i * 4] - r) ** 2 + (pal[i * 4 + 1] - g) ** 2 + (pal[i * 4 + 2] - b) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// 把一格的所有圖層合成成索引圖；回傳 null 代表空格。
export function composeFrame(spr, frame, cache) {
  const parts = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const L of frame.layers) {
    if (L.index < 0 || L.color[3] === 0) continue;
    const img = (L.type === 1 ? spr.rgba : spr.indexed)[L.index];
    if (!img) continue;
    const sw = img.w * L.sx, sh = img.h * L.sy;
    const rad = (L.angle * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    // 圖層中心在 (x, y)；旋轉後的外框
    const hw = Math.abs(sw / 2), hh = Math.abs(sh / 2);
    const ex = Math.abs(hw * cos) + Math.abs(hh * sin), ey = Math.abs(hw * sin) + Math.abs(hh * cos);
    const bx0 = Math.floor(L.x - ex), by0 = Math.floor(L.y - ey), bx1 = Math.ceil(L.x + ex), by1 = Math.ceil(L.y + ey);
    parts.push({ L, img, sw, sh, cos, sin, bx0, by0, bx1, by1 });
    x0 = Math.min(x0, bx0); y0 = Math.min(y0, by0); x1 = Math.max(x1, bx1); y1 = Math.max(y1, by1);
  }
  if (!parts.length) return null;
  const W = x1 - x0, H = y1 - y0, out = new Uint8Array(W * H);
  for (const { L, img, sw, sh, cos, sin, bx0, by0, bx1, by1 } of parts) {
    const simple = L.angle === 0 && L.sx === 1 && L.sy === 1;
    const left = Math.floor(L.x - img.w / 2), top = Math.floor(L.y - img.h / 2); // 與原版轉檔一致：奇數寬高往左上取整
    for (let y = by0; y < by1; y++) for (let x = bx0; x < bx1; x++) {
      let u, v;
      if (simple) { u = x - left; v = y - top; }
      else {
        // 反向映射：畫面座標 → 圖層座標
        const dx = x + 0.5 - L.x, dy = y + 0.5 - L.y;
        const rx = dx * cos + dy * sin, ry = -dx * sin + dy * cos;
        u = Math.floor(rx / (sw / img.w) + img.w / 2); v = Math.floor(ry / (sh / img.h) + img.h / 2);
      }
      if (L.mirror) u = img.w - 1 - u;
      if (u < 0 || v < 0 || u >= img.w || v >= img.h) continue;
      let idx;
      if (L.type === 1) {
        const s = (v * img.w + u) * 4;
        if (img.data[s + 3] < 128) continue;
        const key = (img.data[s] << 16) | (img.data[s + 1] << 8) | img.data[s + 2];
        idx = cache.get(key) ?? (cache.set(key, nearest(spr.palette, img.data[s], img.data[s + 1], img.data[s + 2])), cache.get(key));
      } else {
        idx = img.data[v * img.w + u];
        if (!idx) continue;
      }
      out[(y - y0) * W + (x - x0)] = idx;
    }
  }
  // 裁到不透明像素
  let cx0 = W, cy0 = H, cx1 = -1, cy1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (out[y * W + x]) { cx0 = Math.min(cx0, x); cy0 = Math.min(cy0, y); cx1 = Math.max(cx1, x); cy1 = Math.max(cy1, y); }
  if (cx1 < 0) return null;
  const w = cx1 - cx0 + 1, h = cy1 - cy0 + 1, data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) data.set(out.subarray((y + cy0) * W + cx0, (y + cy0) * W + cx0 + w), y * w);
  return { w, h, ox: -(x0 + cx0), oy: -(y0 + cy0), data };
}

// 由 SPR + ACT 產生本作的精靈圖（json、索引圖、調色盤）。
export function buildSheet(sprBuf, actBuf, base, { atlasWidth = 1024 } = {}) {
  const spr = parseSpr(sprBuf), act = parseAct(actBuf);
  const cache = new Map(), uniq = new Map(), frames = [];
  const frameIndex = (fr) => {
    const img = composeFrame(spr, fr, cache);
    if (!img) return -1;
    const key = `${img.w},${img.h},${img.ox},${img.oy},${Buffer.from(img.data).toString('base64')}`;
    if (!uniq.has(key)) { uniq.set(key, frames.length); frames.push(img); }
    return uniq.get(key);
  };
  const actions = {};
  ACTIONS.forEach((name, a) => {
    const dirs = [];
    for (let d = 0; d < 8; d++) {
      const A = act.actions[a * 8 + d];
      dirs.push(A ? A.frames.map((fr) => [frameIndex(fr), fr.attach[0]?.[0] ?? 0, fr.attach[0]?.[1] ?? 0]) : [[-1, 0, 0]]);
    }
    actions[name] = { delay: Math.round(act.actions[a * 8]?.delay ?? 150), dirs };
  });
  // 由高到低排架（shelf packing）
  const order = frames.map((f, i) => i).sort((a, b) => frames[b].h - frames[a].h || frames[b].w - frames[a].w);
  const pos = new Array(frames.length);
  let x = 0, y = 0, row = 0, W = 0;
  for (const i of order) {
    const f = frames[i];
    if (x + f.w > atlasWidth) { x = 0; y += row + 1; row = 0; }
    pos[i] = [x, y]; x += f.w + 1; row = Math.max(row, f.h); W = Math.max(W, x - 1);
  }
  const H = Math.max(1, y + row), aw = Math.max(1, W);
  const rgba = new Uint8Array(aw * H * 4);
  frames.forEach((f, i) => {
    const [px, py] = pos[i];
    for (let yy = 0; yy < f.h; yy++) for (let xx = 0; xx < f.w; xx++) {
      const v = f.data[yy * f.w + xx];
      if (!v) continue;
      const o = ((py + yy) * aw + px + xx) * 4;
      rgba[o] = v; rgba[o + 3] = 255;
    }
  });
  const pal = new Uint8Array(1024);
  for (let i = 0; i < 256; i++) { pal.set(spr.palette.subarray(i * 4, i * 4 + 3), i * 4); pal[i * 4 + 3] = i ? 255 : 0; }
  const json = {
    image: `${base}.png`, palette: `${base}.pal.png`, palettes: 1,
    frames: frames.map((f, i) => [pos[i][0], pos[i][1], f.w, f.h, f.ox, f.oy]),
    actions,
  };
  return { json, png: encodePng(aw, H, rgba), pal: encodePng(256, 1, pal), stats: { frames: frames.length, w: aw, h: H } };
}
