// 把 src/art 產生的所有像素圖排成放大 4 倍的 PNG 對照表，方便人工檢查。
// 用法：npx vite-node scripts/preview-art.mjs [輸出資料夾]
// 預設輸出到 /tmp/claude-0/art-preview/。

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { buildSprites, CHAR_IDS } from '../src/art/index.ts';
import { SPECIES_LIST } from '../src/data/species.ts';
import { TILE_LIST, TILES } from '../src/data/tiles.ts';
import { ITEM_LIST } from '../src/data/items.ts';
import { MAPS } from '../src/data/maps.ts';

const OUT = process.argv[2] ?? '/tmp/claude-0/art-preview';
const SCALE = 4;
mkdirSync(OUT, { recursive: true });

// ---- 極簡 PNG 編碼器 ----
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- 以「邏輯像素」作畫的紙張，最後整張放大 ----
class Sheet {
  constructor(w, h, bg = [58, 60, 72]) {
    this.w = w; this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) this.data.set([...bg, 255], i * 4);
  }
  /** 棋盤格底，表示透明區域。 */
  checker(x0, y0, w, h) {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        const v = ((x >> 2) + (y >> 2)) & 1 ? 214 : 232;
        this.px(x, y, [v, v, v + 4]);
      }
  }
  px(x, y, [r, g, b]) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data.set([r, g, b, 255], (y * this.w + x) * 4);
  }
  draw(img, x0, y0, flip = false) {
    for (let y = 0; y < img.h; y++)
      for (let x = 0; x < img.w; x++) {
        const sx = flip ? img.w - 1 - x : x;
        const i = (y * img.w + sx) * 4;
        const a = img.data[i + 3] / 255;
        if (a === 0) continue;
        const di = ((y0 + y) * this.w + x0 + x) * 4;
        if (x0 + x < 0 || y0 + y < 0 || x0 + x >= this.w || y0 + y >= this.h) continue;
        for (let k = 0; k < 3; k++) this.data[di + k] = img.data[i + k] * a + this.data[di + k] * (1 - a);
      }
  }
  save(name, scale = SCALE) {
    const W = this.w * scale, H = this.h * scale;
    const big = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const s = (((y / scale) | 0) * this.w + ((x / scale) | 0)) * 4;
        big.set(this.data.subarray(s, s + 4), (y * W + x) * 4);
      }
    const file = join(OUT, name);
    writeFileSync(file, encodePng(W, H, big));
    console.log('wrote', file, `${W}×${H}`);
  }
}

const S = buildSprites();
const need = (k) => {
  const img = S.get(k);
  if (img) return img;
  console.warn(`missing sprite ${k}`);
  return { w: 16, h: 16, data: new Uint8ClampedArray(16 * 16 * 4).map((_, i) => [255, 0, 255, 255][i % 4]) };
};

// 1. 怪獸：每列 front / back / icon
{
  const pad = 4, rowH = 48 + pad;
  const sh = new Sheet(pad + (48 + pad) * 2 + 24 + pad + 72, pad + rowH * SPECIES_LIST.length);
  SPECIES_LIST.forEach((sp, i) => {
    const y = pad + i * rowH;
    sh.checker(pad, y, 48, 48); sh.draw(need(sp.sprite.front), pad, y);
    sh.checker(pad + 52, y, 48, 48); sh.draw(need(sp.sprite.back), pad + 52, y);
    sh.checker(pad + 104, y, 24, 24); sh.draw(need(sp.sprite.icon), pad + 104, y);
    // 原尺寸（不放大感受）：再畫一次 front 在右邊暗底上
    sh.draw(need(sp.sprite.icon), pad + 104, y + 26);
    sh.draw(need(sp.sprite.front), pad + 132, y);
  });
  sh.save('monsters.png');
  // 放大 8 倍的細節表：每張 4 隻（front 在上、back 在下）
  for (const [name, list] of [['monsters-a.png', SPECIES_LIST.slice(0, 4)], ['monsters-b.png', SPECIES_LIST.slice(4)]]) {
    const z = new Sheet(2 + list.length * 50, 100);
    list.forEach((sp, i) => {
      z.checker(2 + i * 50, 2, 48, 48); z.draw(need(sp.sprite.front), 2 + i * 50, 2);
      z.checker(2 + i * 50, 51, 48, 48); z.draw(need(sp.sprite.back), 2 + i * 50, 51);
    });
    z.save(name, 5);
  }
}

// 2. 角色：每列 4 方向 × 3 幀；另外輸出兩張放大 8 倍的半表方便看細節
{
  const dirs = ['down', 'up', 'left', 'right'];
  const pad = 2, cell = 16 + pad;
  const sheet = (ids, name, scale) => {
    const sh = new Sheet(pad + cell * 12 + 6, pad + cell * ids.length, [96, 140, 82]);
    ids.forEach((id, r) => {
      dirs.forEach((d, di) =>
        [0, 1, 2].forEach((f) => {
          const x = pad + (di * 3 + f) * cell + di * 2;
          sh.draw(need(`char.${id}.${d}.${f}`), x, pad + r * cell);
        }),
      );
    });
    sh.save(name, scale);
  };
  sheet(CHAR_IDS, 'characters.png', SCALE);
  sheet(CHAR_IDS.slice(0, 6), 'characters-a.png', 7);
  sheet(CHAR_IDS.slice(6), 'characters-b.png', 7);
}

// 3. 地圖格：單格 + 3×3 平鋪（檢查接縫）
{
  const keys = [...TILE_LIST.map((t) => t.sprite), 'tile.water.b'];
  const cols = 6, cw = 16 * 3 + 6;
  const sh = new Sheet(6 + cols * (cw + 20), 6 + Math.ceil(keys.length / cols) * (48 + 8));
  keys.forEach((k, i) => {
    const x = 6 + (i % cols) * (cw + 20), y = 6 + Math.floor(i / cols) * 56;
    const img = need(k);
    sh.draw(img, x, y);
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) sh.draw(img, x + 20 + a * 16, y + b * 16);
  });
  sh.save('tiles.png');
}

// 4. 物件與道具
{
  const keys = ['obj.sign', 'obj.terminal', 'obj.itemball', ...ITEM_LIST.map((it) => it.sprite)];
  const sh = new Sheet(4 + keys.length * 20, 44);
  keys.forEach((k, i) => {
    sh.checker(4 + i * 20, 4, 16, 16);
    sh.draw(need(k), 4 + i * 20, 4);
    sh.draw(need('tile.grass'), 4 + i * 20, 24);
    sh.draw(need(k), 4 + i * 20, 24);
  });
  sh.save('objects.png');
}

// 5. 戰鬥背景＋模擬戰鬥畫面
{
  const bgs = ['bg.meadow', 'bg.forest', 'bg.arena'];
  const sh = new Sheet(4 + 260 * 2, 4 + 196 * 3);
  bgs.forEach((k, i) => {
    const y = 4 + i * 196;
    sh.draw(need(k), 4, y);
    sh.draw(need(k), 264, y);
    const enemy = SPECIES_LIST[(i * 3 + 3) % SPECIES_LIST.length];
    const ally = SPECIES_LIST[i];
    sh.draw(need(enemy.sprite.front), 264 + 171, y + 38);
    sh.draw(need(ally.sprite.back), 264 + 36, y + 110);
  });
  sh.save('battle.png', 3);
}

// 6. 地圖場景（每張地圖畫出地形與人物）
for (const map of Object.values(MAPS)) {
  const W = map.rows[0].length * 16, H = map.rows.length * 16;
  const sh = new Sheet(W, H);
  map.rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const t = TILES[ch];
      sh.draw(need(t ? t.sprite : 'tile.grass'), x * 16, y * 16);
    }),
  );
  for (const e of map.entities) {
    const key = e.sprite.startsWith('char.') ? `${e.sprite}.${e.facing}.0` : e.sprite;
    sh.draw(need(key), e.x * 16, e.y * 16 - (e.sprite.startsWith('char.') ? 2 : 0));
  }
  if (map.id === 'village') sh.draw(need('char.player.up.1'), 9 * 16, 9 * 16 - 2);
  sh.save(`map-${map.id}.png`, 3);
}
