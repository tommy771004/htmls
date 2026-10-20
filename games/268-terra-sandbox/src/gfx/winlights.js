// 夜間窗燈：每扇窗對應到那一層室內生成的房間（generateInterior 與走進去看到的是同一份格局）。
// 近景建物的每層、每欄窗戶寫進一張資料貼圖（R = 房間類型、G = 房間亂數、B = 窗戶亂數），
// 著色器依當地時刻與房間類型決定開不開燈與燈色；走進室內時用同一套規則決定哪些房間亮著。
import * as THREE from 'three';
import { generateInterior } from '../core/interior.js';
import { interiorView } from '../core/osm.js';
import { ROOM_CODE, roomByte } from '../core/lights.js';

export const WIN_W = 1024;
const WIN_H = 1024;
const MAX_TEXELS = 9000; // 單棟上限（超過就減少記錄的樓層數，樓上循環使用）

// 生成窗燈用的格局：沒有門的建物（多邊形、街廓內側）假設北側有門
function lightView(b) {
  if (b.door) return b;
  return { ...b, door: { x: (b.x0 + b.x1) / 2, z: b.z0, side: 'n' }, front: 'n' };
}
function roomAt(L, x, z) {
  let best = -1;
  let bd = Infinity;
  L.rooms.forEach((r, i) => {
    const dx = Math.max(r.x0 - x, 0, x - r.x1);
    const dz = Math.max(r.z0 - z, 0, z - r.z1);
    const d = dx + dz;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

export class WinLights {
  constructor() {
    this.data = new Uint8Array(WIN_W * WIN_H * 4);
    this.tex = new THREE.DataTexture(this.data, WIN_W, WIN_H, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.tex.magFilter = THREE.NearestFilter;
    this.tex.minFilter = THREE.NearestFilter;
    this.tex.generateMipmaps = false;
    this.tex.needsUpdate = true;
    this.free = [[0, WIN_W * WIN_H]]; // [起點, 長度]，依起點排序
    this.dirty = [];
    this.used = 0;
  }

  alloc(n) {
    for (let i = 0; i < this.free.length; i++) {
      const f = this.free[i];
      if (f[1] < n) continue;
      const base = f[0];
      f[0] += n;
      f[1] -= n;
      if (!f[1]) this.free.splice(i, 1);
      this.used += n;
      return base;
    }
    return -1;
  }
  release(list) {
    if (!list) return;
    for (const [base, n] of list) {
      this.used -= n;
      let i = 0;
      while (i < this.free.length && this.free[i][0] < base) i++;
      this.free.splice(i, 0, [base, n]);
      // 和前後相鄰的空段合併
      if (i + 1 < this.free.length && this.free[i][0] + this.free[i][1] === this.free[i + 1][0]) {
        this.free[i][1] += this.free[i + 1][1];
        this.free.splice(i + 1, 1);
      }
      if (i > 0 && this.free[i - 1][0] + this.free[i - 1][1] === this.free[i][0]) {
        this.free[i - 1][1] += this.free[i][1];
        this.free.splice(i, 1);
      }
    }
  }

  // 一個圖磚的收集器：buildBuilding 每棟呼叫 add()，圖磚丟掉時 release(c.list)
  collector() {
    const list = [];
    return {
      list,
      add: (b, cols, stride) => {
        const floors = Math.max(1, b.floors || 1);
        const rows = Math.max(1, Math.min(floors, 40, Math.floor(MAX_TEXELS / stride)));
        const base = this.alloc(rows * stride);
        if (base < 0) return null;
        list.push([base, rows * stride]);
        this.fill(b, cols, stride, rows, base);
        return { base, rows };
      },
    };
  }

  // cols：每一欄窗戶在建物座標（OSM 為局部座標）的位置 { g: [x, z] 一樓, u: [x, z] 樓上, n: [nx, nz] 外法線 }
  fill(b, cols, stride, rows, base) {
    const lv = lightView(b);
    const src = b.src;
    const unit = src && src.frame ? interiorView(src) : null;
    const hasUnit = unit && unit !== src._local;
    const d = this.data;
    for (let f = 0; f < rows; f++) {
      const L = generateInterior(lv, f);
      const U = hasUnit ? generateInterior(unit, f) : null;
      for (let c = 0; c < cols.length; c++) {
        const col = cols[c];
        if (!col) continue;
        const [px, pz] = f === 0 ? col.g : col.u;
        const x = px - col.n[0] * 0.8;
        const z = pz - col.n[1] * 0.8;
        let lay = L;
        let off = 0;
        if (U && x > U.x0 && x < U.x1 && z > U.z0 && z < U.z1) {
          lay = U;
          off = 64;
        }
        const ri = roomAt(lay, x, z);
        const i = (base + f * stride + c) * 4;
        d[i] = ri < 0 ? 0 : ROOM_CODE[lay.rooms[ri].type] || 0;
        d[i + 1] = roomByte(b.seed, f, ri + off);
        d[i + 2] = roomByte(b.seed ^ 0x5bd1e995, f, c);
        d[i + 3] = 255;
      }
    }
    this.dirty.push([base, base + rows * stride]);
  }

  // 每幀：只上傳有變動的列
  flush() {
    if (!this.dirty.length) return;
    for (const [a, z] of this.dirty) {
      for (let s = a; s < z; ) {
        const rowEnd = (Math.floor(s / WIN_W) + 1) * WIN_W;
        const e = Math.min(z, rowEnd);
        this.tex.addUpdateRange(s * 4, (e - s) * 4);
        s = e;
      }
    }
    this.dirty.length = 0;
    this.tex.needsUpdate = true;
  }
}
