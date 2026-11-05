// 碰撞世界：軸對齊盒、直立圓柱、可抓的岩縫邊。角色是直立圓柱（半徑 r、高 h）。
import * as THREE from 'three';

const EPS = 1e-4;

export class World {
  constructor() { this.cols = []; this.ledges = []; }

  addBox(x0, y0, z0, x1, y1, z1, data = {}) {
    const c = { type: 'box', min: new THREE.Vector3(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)), max: new THREE.Vector3(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)), on: true, delta: new THREE.Vector3(), ...data };
    this.cols.push(c);
    return c;
  }
  addCyl(x, z, r, y0, y1, data = {}) {
    const c = { type: 'cyl', x, z, r, min: new THREE.Vector3(x - r, y0, z - r), max: new THREE.Vector3(x + r, y1, z + r), on: true, delta: new THREE.Vector3(), ...data };
    this.cols.push(c);
    return c;
  }
  /** 移動碰撞盒並記錄位移（站在上面的角色會被帶著走） */
  moveBox(c, dx, dy, dz) {
    c.min.x += dx; c.max.x += dx; c.min.y += dy; c.max.y += dy; c.min.z += dz; c.max.z += dz;
    c.delta.set(dx, dy, dz);
  }
  /** 岩縫：a→b 是手抓的邊（水平），n 是壁面朝外的方向；top=true 代表可以翻上去站 */
  addLedge(ax, ay, az, bx, bz, n, data = {}) {
    const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, ay, bz);
    const dir = b.clone().sub(a); const len = dir.length(); dir.divideScalar(len);
    const L = { id: this.ledges.length, a, b, dir, len, n: new THREE.Vector3(n[0], 0, n[1]).normalize(), y: ay, top: false, ...data };
    this.ledges.push(L);
    return L;
  }

  // 圓（x,z,r）和碰撞體在水平面是否重疊
  static overlapXZ(c, x, z, r) {
    if (c.type === 'cyl') { const dx = x - c.x, dz = z - c.z; return dx * dx + dz * dz < (c.r + r) * (c.r + r); }
    const qx = Math.max(c.min.x, Math.min(x, c.max.x)), qz = Math.max(c.min.z, Math.min(z, c.max.z));
    const dx = x - qx, dz = z - qz;
    return dx * dx + dz * dz < r * r;
  }

  /** 腳下的地面：在 feetY+step 以下、與足跡（r）重疊的最高頂面 */
  ground(x, z, r, feetY, step) {
    let best = -Infinity, col = null;
    for (const c of this.cols) {
      if (!c.on || c.noGround) continue;
      const top = c.max.y;
      if (top > feetY + step || top < best) continue;
      if (c.min.y > feetY + step) continue;
      if (World.overlapXZ(c, x, z, r)) { best = top; col = c; }
    }
    return { y: best, col };
  }

  /** 頭頂：feetY 以上、headY 以下最低的底面 */
  ceiling(x, z, r, feetY, headY) {
    let best = Infinity;
    for (const c of this.cols) {
      if (!c.on) continue;
      if (c.min.y < feetY + 0.2 || c.min.y > headY) continue;
      if (World.overlapXZ(c, x, z, r * 0.9) && c.min.y < best) best = c.min.y;
    }
    return best;
  }

  /** 水平推出：只處理垂直範圍與 [y0, y1] 重疊的碰撞體。回傳撞到的法線（可能為 null） */
  pushOut(p, r, y0, y1) {
    let hit = null;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const c of this.cols) {
        if (!c.on || c.max.y <= y0 + EPS || c.min.y >= y1 - EPS) continue;
        if (c.type === 'cyl') {
          const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), R = c.r + r;
          if (d < R) {
            const nx = d > EPS ? dx / d : 1, nz = d > EPS ? dz / d : 0;
            p.x = c.x + nx * R; p.z = c.z + nz * R; moved = true; hit = { x: nx, z: nz, c };
          }
          continue;
        }
        const qx = Math.max(c.min.x, Math.min(p.x, c.max.x)), qz = Math.max(c.min.z, Math.min(p.z, c.max.z));
        let dx = p.x - qx, dz = p.z - qz;
        const d = Math.hypot(dx, dz);
        if (d >= r) continue;
        if (d > EPS) { p.x = qx + (dx / d) * r; p.z = qz + (dz / d) * r; hit = { x: dx / d, z: dz / d, c }; moved = true; continue; }
        // 中心在盒內：往最近的邊推出去
        const pen = [p.x - c.min.x, c.max.x - p.x, p.z - c.min.z, c.max.z - p.z];
        const i = pen.indexOf(Math.min(...pen));
        if (i === 0) { p.x = c.min.x - r; hit = { x: -1, z: 0, c }; } else if (i === 1) { p.x = c.max.x + r; hit = { x: 1, z: 0, c }; } else if (i === 2) { p.z = c.min.z - r; hit = { x: 0, z: -1, c }; } else { p.z = c.max.z + r; hit = { x: 0, z: 1, c }; }
        moved = true;
      }
      if (!moved) break;
    }
    return hit;
  }

  /** 圓柱（腳 y0～頭 y1）放在 p 會不會卡進任何東西 */
  blocked(x, z, r, y0, y1) {
    for (const c of this.cols) {
      if (!c.on || c.max.y <= y0 + 0.02 || c.min.y >= y1) continue;
      if (World.overlapXZ(c, x, z, r)) return true;
    }
    return false;
  }
}
