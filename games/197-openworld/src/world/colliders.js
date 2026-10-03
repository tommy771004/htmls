// 2.5D 碰撞世界：圓柱（樹、石頭）與有向方盒（GLB 物件、車、船）。
// 靜態 collider 進 spatial hash；會移動的放 dynamic 清單逐一檢查。

const CELL = 8;
const key = (i, j) => i * 73856093 ^ j * 19349663;

export class Colliders {
  constructor() {
    this.grid = new Map();
    this.dynamic = [];
    this._seen = new Set();
  }

  /** 圓柱：{x, z, r, top}，top 為世界座標的頂面高度 */
  addCircle(x, z, r, top = Infinity) {
    const c = { type: 'circle', x, z, r, top, enabled: true };
    this.#insert(c, r);
    return c;
  }

  /** 有向方盒：hw/hd 為 X/Z 半寬，yaw 為繞 Y 旋轉 */
  addBox(x, z, hw, hd, yaw = 0, top = Infinity) {
    const c = { type: 'box', x, z, hw, hd, yaw, top, enabled: true };
    this.#insert(c, Math.hypot(hw, hd));
    return c;
  }

  addDynamicBox(hw, hd, top = Infinity) {
    const c = { type: 'box', x: 0, z: 0, hw, hd, yaw: 0, top, enabled: true };
    this.dynamic.push(c);
    return c;
  }

  #insert(c, radius) {
    const i0 = Math.floor((c.x - radius) / CELL);
    const i1 = Math.floor((c.x + radius) / CELL);
    const j0 = Math.floor((c.z - radius) / CELL);
    const j1 = Math.floor((c.z + radius) / CELL);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const k = key(i, j);
        let list = this.grid.get(k);
        if (!list) this.grid.set(k, (list = []));
        list.push(c);
      }
    }
  }

  /** 對半徑內每個 collider 呼叫 fn（可能跨格，已去重） */
  forEachNear(x, z, radius, fn) {
    const seen = this._seen;
    seen.clear();
    const i0 = Math.floor((x - radius) / CELL);
    const i1 = Math.floor((x + radius) / CELL);
    const j0 = Math.floor((z - radius) / CELL);
    const j1 = Math.floor((z + radius) / CELL);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const list = this.grid.get(key(i, j));
        if (!list) continue;
        for (const c of list) {
          if (!c.enabled || seen.has(c)) continue;
          seen.add(c);
          fn(c);
        }
      }
    }
    for (const c of this.dynamic) if (c.enabled) fn(c);
  }

  /**
   * 把半徑 radius 的圓（pos.x, pos.z）推出所有 collider。
   * feetY 高於 collider 頂面時視為站在上面，不做水平推擠。
   * @returns {boolean} 是否發生碰撞
   */
  resolve(pos, radius, feetY = -Infinity, ignore = null) {
    let hit = false;
    this.forEachNear(pos.x, pos.z, radius + 0.1, (c) => {
      if (c === ignore || feetY >= c.top - 0.05) return;
      if (c.type === 'circle') {
        const dx = pos.x - c.x;
        const dz = pos.z - c.z;
        const min = radius + c.r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min) return;
        const d = Math.sqrt(d2);
        if (d < 1e-5) {
          pos.x += min;
        } else {
          pos.x = c.x + (dx / d) * min;
          pos.z = c.z + (dz / d) * min;
        }
        hit = true;
      } else {
        const cos = Math.cos(c.yaw);
        const sin = Math.sin(c.yaw);
        const dx = pos.x - c.x;
        const dz = pos.z - c.z;
        // 世界 → 方盒 local（yaw 為繞 +Y 的旋轉）
        let lx = dx * cos - dz * sin;
        let lz = dx * sin + dz * cos;
        const cx = Math.max(-c.hw, Math.min(c.hw, lx));
        const cz = Math.max(-c.hd, Math.min(c.hd, lz));
        let px = lx - cx;
        let pz = lz - cz;
        const d2 = px * px + pz * pz;
        if (d2 >= radius * radius) return;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          lx = cx + (px / d) * radius;
          lz = cz + (pz / d) * radius;
        } else {
          // 圓心在方盒內：沿穿透最淺的軸推出
          const ox = c.hw - Math.abs(lx);
          const oz = c.hd - Math.abs(lz);
          if (ox < oz) lx = Math.sign(lx || 1) * (c.hw + radius);
          else lz = Math.sign(lz || 1) * (c.hd + radius);
        }
        pos.x = c.x + lx * cos + lz * sin;
        pos.z = c.z - lx * sin + lz * cos;
        hit = true;
      }
    });
    return hit;
  }

  /** 可站立的方盒頂面高度（腳要夠高才算），沒有則回傳 -Infinity */
  supportHeight(x, z, feetY) {
    let best = -Infinity;
    this.forEachNear(x, z, 0.1, (c) => {
      if (c.type !== 'box' || c.top === Infinity || feetY < c.top - 0.35) return;
      const cos = Math.cos(c.yaw);
      const sin = Math.sin(c.yaw);
      const dx = x - c.x;
      const dz = z - c.z;
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      if (Math.abs(lx) <= c.hw && Math.abs(lz) <= c.hd && c.top > best) best = c.top;
    });
    return best;
  }

  /** 射線對圓柱／方盒（方盒以外接圓近似），回傳最近距離或 -1 */
  raycast(origin, dir, maxDist) {
    let best = -1;
    const step = 4;
    const seen = new Set();
    for (let t = 0; t <= maxDist; t += step) {
      const x = origin.x + dir.x * t;
      const z = origin.z + dir.z * t;
      const list = this.grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
      if (!list) continue;
      for (const c of list) {
        if (seen.has(c)) continue;
        seen.add(c);
        const r = c.type === 'circle' ? c.r : Math.min(c.hw, c.hd);
        // 2D 射線對圓
        const ox = origin.x - c.x;
        const oz = origin.z - c.z;
        const a = dir.x * dir.x + dir.z * dir.z;
        if (a < 1e-8) continue;
        const b = 2 * (ox * dir.x + oz * dir.z);
        const cc = ox * ox + oz * oz - r * r;
        const disc = b * b - 4 * a * cc;
        if (disc < 0) continue;
        const hitT = (-b - Math.sqrt(disc)) / (2 * a);
        if (hitT < 0 || hitT > maxDist) continue;
        if (origin.y + dir.y * hitT > c.top) continue;
        if (best < 0 || hitT < best) best = hitT;
      }
      if (best >= 0 && best < t) break;
    }
    return best;
  }
}
