// 合併幾何建構器：把大量小物件（建物牆面、路燈、樹、車…）寫進同一個 BufferGeometry，
// 每個頂點帶顏色（vertex color）與圖集矩形（atl：u0, v0, du, dv），一塊圖磚只需要少數幾次 draw call。
import * as THREE from 'three';

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m3 = new THREE.Matrix3();
const _c = new THREE.Color();

export class Builder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.uv = [];
    this.atl = [];
    this.idx = [];
    this.n = 0;
    this.wlr = []; // 窗燈資料範圍：{ s, e, v }（頂點 s..e 的 wl 屬性 = v，其餘為 -1）
  }

  // 在 fn 裡加的頂點標上窗燈資料（v = [起點, 每層欄數, 欄位偏移, 樓層偏移 + 層數 × 4]）
  win(v, fn) {
    const s = this.n;
    fn();
    if (v && this.n > s) this.wlr.push({ s, e: this.n, v });
  }

  get empty() {
    return this.n === 0;
  }

  // 加一個四邊形（a→b→c→d 逆時針、朝外），uv 為重複座標，rect 為圖集區塊
  quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, color, uv = null, rect = null) {
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = dx - ax;
    const vy = dy - ay;
    const vz = dz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    _c.set(color);
    const base = this.n;
    const P = [ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz];
    const U = uv || [0, 0, 1, 0, 1, 1, 0, 1];
    const R = rect || NO_RECT;
    for (let k = 0; k < 4; k++) {
      this.pos.push(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]);
      this.nor.push(nx, ny, nz);
      this.col.push(_c.r, _c.g, _c.b);
      this.uv.push(U[k * 2], U[k * 2 + 1]);
      this.atl.push(R[0], R[1], R[2], R[3]);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.n += 4;
  }

  tri(ax, ay, az, bx, by, bz, cx, cy, cz, color, uv = null, rect = null) {
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    _c.set(color);
    const base = this.n;
    const P = [ax, ay, az, bx, by, bz, cx, cy, cz];
    const U = uv || [0, 0, 1, 0, 0.5, 1];
    const R = rect || NO_RECT;
    for (let k = 0; k < 3; k++) {
      this.pos.push(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]);
      this.nor.push(nx / l, ny / l, nz / l);
      this.col.push(_c.r, _c.g, _c.b);
      this.uv.push(U[k * 2], U[k * 2 + 1]);
      this.atl.push(R[0], R[1], R[2], R[3]);
    }
    this.idx.push(base, base + 1, base + 2);
    this.n += 3;
  }

  // 軸對齊方塊（可選擇略過底面），六面同色
  box(x0, y0, z0, x1, y1, z1, color, skipBottom = true) {
    this.quad(x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, color); // +z
    this.quad(x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, color); // -z
    this.quad(x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, color); // +x
    this.quad(x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, color); // -x
    this.quad(x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0, color); // top
    if (!skipBottom) this.quad(x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, color);
  }

  // 任意 three 幾何（套用矩陣與顏色）
  geom(g, matrix, color, rect = null) {
    const p = g.attributes.position;
    const nm = g.attributes.normal;
    const uvA = g.attributes.uv;
    _m3.getNormalMatrix(matrix);
    _c.set(color);
    const base = this.n;
    const R = rect || NO_RECT;
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      this.pos.push(_v.x, _v.y, _v.z);
      if (nm) {
        _n.fromBufferAttribute(nm, i).applyMatrix3(_m3).normalize();
        this.nor.push(_n.x, _n.y, _n.z);
      } else this.nor.push(0, 1, 0);
      this.col.push(_c.r, _c.g, _c.b);
      if (uvA) this.uv.push(uvA.getX(i), uvA.getY(i));
      else this.uv.push(0, 0);
      this.atl.push(R[0], R[1], R[2], R[3]);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(base + g.index.getX(i));
    else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
    this.n += p.count;
  }

  // 另一個 Builder 的內容（已是世界座標）平移後併入
  append(o, dx = 0, dy = 0, dz = 0) {
    const base = this.n;
    for (let i = 0; i < o.pos.length; i += 3) this.pos.push(o.pos[i] + dx, o.pos[i + 1] + dy, o.pos[i + 2] + dz);
    for (const v of o.nor) this.nor.push(v);
    for (const v of o.col) this.col.push(v);
    for (const v of o.uv) this.uv.push(v);
    for (const v of o.atl) this.atl.push(v);
    for (const i of o.idx) this.idx.push(base + i);
    for (const r of o.wlr) this.wlr.push({ s: base + r.s, e: base + r.e, v: r.v });
    this.n += o.n;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('atl', new THREE.Float32BufferAttribute(this.atl, 4));
    const wl = new Float32Array(this.n * 4);
    for (let i = 0; i < this.n; i++) wl[i * 4] = -1;
    for (const r of this.wlr) for (let i = r.s; i < r.e; i++) wl.set(r.v, i * 4);
    g.setAttribute('wl', new THREE.BufferAttribute(wl, 4));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

const NO_RECT = [0, 0, 0, 0];

// 常用的小幾何（共用快取）
const cache = new Map();
export function prim(key, make) {
  let g = cache.get(key);
  if (!g) {
    g = make();
    cache.set(key, g);
  }
  return g;
}
export const P = {
  cyl: (seg = 8) => prim(`cyl${seg}`, () => new THREE.CylinderGeometry(1, 1, 1, seg, 1)),
  cylOpen: (seg = 8) => prim(`cylo${seg}`, () => new THREE.CylinderGeometry(1, 1, 1, seg, 1, true)),
  cone: (seg = 8) => prim(`cone${seg}`, () => new THREE.ConeGeometry(1, 1, seg, 1)),
  ico: (d = 1) => prim(`ico${d}`, () => new THREE.IcosahedronGeometry(1, d)),
  sphere: (w = 10, h = 8) => prim(`sph${w}_${h}`, () => new THREE.SphereGeometry(1, w, h)),
  box: () => prim('box', () => new THREE.BoxGeometry(1, 1, 1)),
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
export function mat(x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  _s.set(sx, sy, sz);
  _p.set(x, y, z);
  return _m.compose(_p, _q, _s);
}

// 沿 yaw 旋轉的方塊（車、長椅等）
export function rotBox(b, cx, cy, cz, w, h, d, yaw, color) {
  b.geom(P.box(), mat(cx, cy + h / 2, cz, w, h, d, 0, yaw, 0), color);
}
