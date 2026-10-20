// 房間燈光規則：房間類型 × 當地時刻 → 開燈機率；同一房間的亂數一致。
// 畫面的窗燈（gfx/winlights.js 與 atlas.js 的著色器）和走進室內看到的燈都用這一份，所以從外面看哪幾間亮、進去就是哪幾間亮。
import { interiorView } from './osm.js';

export const ROOM_CODE = { shop: 1, back: 2, lobby: 3, living: 4, bed: 5, kitchen: 6, bath: 7, office: 8, meeting: 9, hall: 10, stairs: 11, lodge: 12 };

// 和著色器裡的 roomP 相同：這類房間在這個時刻開燈的機率
const inH = (h, a, b) => (a < b ? h >= a && h < b : h >= a || h < b);
export function roomLightP(type, h) {
  const t = ROOM_CODE[type] || 0;
  if (!t) return 0;
  if (t === 1 || t === 12) return inH(h, 8, 22) ? 0.95 : 0.06;
  if (t === 2) return inH(h, 8, 23) ? 0.5 : 0.03;
  if (t === 3) return 0.85;
  if (t === 10) return inH(h, 23, 6) ? 0.4 : 0.85;
  if (t === 11) return 0.7;
  if (t === 4) return Math.max(inH(h, 17, 23.5) ? 0.75 : 0, inH(h, 6, 8) ? 0.3 : 0, 0.05);
  if (t === 5) return Math.max(inH(h, 21, 24) ? 0.45 : 0, inH(h, 6, 7.5) ? 0.35 : 0, inH(h, 0, 1) ? 0.15 : 0, 0.03);
  if (t === 6) return Math.max(inH(h, 6, 9) ? 0.5 : 0, inH(h, 17, 21) ? 0.7 : 0, 0.04);
  if (t === 7) return Math.max(inH(h, 6, 8) ? 0.4 : 0, 0.12);
  return Math.max(inH(h, 7, 19) ? 0.9 : 0, inH(h, 19, 22) ? 0.35 : 0, 0.12);
}
// 房間亂數（0–255）：同一房間的每扇窗一致
export function roomByte(seed, floor, idx) {
  let h = Math.imul(seed ^ Math.imul(floor + 1, 0x27d4eb2d), 0x165667b1) ^ Math.imul(idx + 7, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) & 255;
}
// 走進室內：這間房的燈現在亮不亮（unit = 大樓只生成臨街單位時，房間編號加 64，與窗燈資料一致）
export function roomLit(b, layout, idx, hour) {
  const off = b.frame && interiorView(b) !== b._local ? 64 : 0;
  const r = layout.rooms[idx];
  return roomByte(b.seed, layout.floor, idx + off) / 255 < roomLightP(r.type, hour);
}
