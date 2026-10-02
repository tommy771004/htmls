// chars 軌道：圓潤基本體烘焙器。把球／膠囊／圓角盒／旋轉體等合併成單一 BufferGeometry（頂點色，可選剛性蒙皮索引）。
import * as THREE from 'three';

const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _n = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0), _c = new THREE.Color();

// 變換矩陣：位置、尤拉旋轉（XYZ）、縮放
export function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _e.set(rx, ry, rz, 'XYZ'); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
// 沿 from→to 擺放（局部 +Y 對齊線段），可帶非均勻半徑
export function along(from, to, rx = 1, rz = rx, len = null) {
  _v.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const l = _v.length() || 1e-6; _v.divideScalar(l);
  _q.setFromUnitVectors(_up, _v);
  return new THREE.Matrix4().compose(_p.set((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2), _q, _s.set(rx, len ?? l, rz));
}

const cache = new Map();
const memo = (k, f) => { let g = cache.get(k); if (!g) cache.set(k, (g = f())); return g; };
export const unitSphere = (w = 10, h = 7) => memo(`s${w}_${h}`, () => new THREE.SphereGeometry(1, w, h));
export const unitCyl = (seg = 10, rt = 1, rb = 1) => memo(`c${seg}_${rt}_${rb}`, () => new THREE.CylinderGeometry(rt, rb, 1, seg, 1));
export const unitCone = (seg = 8) => memo(`k${seg}`, () => new THREE.ConeGeometry(1, 1, seg, 1));
export const unitTorus = (tube = 0.25, seg = 12, tseg = 5) => memo(`t${tube}_${seg}_${tseg}`, () => new THREE.TorusGeometry(1, tube, tseg, seg));

// 圓角盒（倒角效果）：以 BoxGeometry 細分後把頂點推到內盒 + 半徑
export function roundedBox(w, h, d, r = 0.01, seg = 2) {
  const key = `rb${w}_${h}_${d}_${r}_${seg}`;
  return memo(key, () => {
    const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
    const pos = g.attributes.position, nor = g.attributes.normal;
    const hx = Math.max(0, w / 2 - r), hy = Math.max(0, h / 2 - r), hz = Math.max(0, d / 2 - r);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const ix = Math.max(-hx, Math.min(hx, x)), iy = Math.max(-hy, Math.min(hy, y)), iz = Math.max(-hz, Math.min(hz, z));
      _n.set(x - ix, y - iy, z - iz);
      const l = _n.length();
      if (l > 1e-6) { _n.divideScalar(l); pos.setXYZ(i, ix + _n.x * r, iy + _n.y * r, iz + _n.z * r); nor.setXYZ(i, _n.x, _n.y, _n.z); }
    }
    return g;
  });
}

const toColor = (c) => (c && c.isColor ? c : new THREE.Color(c));
export const shade = (c, k) => { const o = toColor(c).clone(); o.multiplyScalar(k); return o; };
export const mix = (a, b, t) => toColor(a).clone().lerp(toColor(b), t);

export class Baker {
  constructor(skinned = false) { this.pos = []; this.nor = []; this.col = []; this.idx = []; this.bone = []; this.n = 0; this.skinned = skinned; this.sample = []; this.cur = 0; this.post = null; this.ox = 0; this.oy = 0; this.oz = 0; }
  // 切到某骨頭：之後的座標都是該骨頭的局部座標，烘焙時加上 rest 世界偏移
  use(bone, ox = 0, oy = 0, oz = 0, sx = 1, sy = 1, sz = 1, cx = 0, cy = 0, cz = 0) {
    this.cur = bone; this.ox = ox; this.oy = oy; this.oz = oz;
    // 骨頭局部的整體縮放（繞 c 點），用來把身體各段加粗
    this.post = sx === 1 && sy === 1 && sz === 1 ? null : new THREE.Matrix4().makeTranslation(cx, cy, cz).multiply(new THREE.Matrix4().makeScale(sx, sy, sz)).multiply(new THREE.Matrix4().makeTranslation(-cx, -cy, -cz));
    return this;
  }
  // geo：任何 BufferGeometry；m：變換；color：hex / Color / fn(x,y,z)=>Color（變換後座標）；bone：骨頭索引
  add(geo, m, color, bone = this.cur) {
    if (this.post) m = this.post.clone().multiply(m);
    const pa = geo.attributes.position, na = geo.attributes.normal, ix = geo.index;
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const attr = color === 'attr' ? geo.attributes.color : null;
    const fn = typeof color === 'function' ? color : null, fixed = fn || attr ? null : toColor(color);
    const base = this.n;
    for (let i = 0; i < pa.count; i++) {
      _v.fromBufferAttribute(pa, i).applyMatrix4(m);
      _n.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
      const cc = attr ? _c.setRGB(attr.getX(i), attr.getY(i), attr.getZ(i)) : fn ? toColor(fn(_v.x, _v.y, _v.z, _n)) : fixed;
      this.pos.push(_v.x + this.ox, _v.y + this.oy, _v.z + this.oz); this.nor.push(_n.x, _n.y, _n.z);
      this.col.push(cc.r, cc.g, cc.b); this.bone.push(bone);
    }
    if (ix) for (let i = 0; i < ix.count; i++) this.idx.push(base + ix.getX(i));
    else for (let i = 0; i < pa.count; i++) this.idx.push(base + i);
    this.n += pa.count;
    return this;
  }
  sphere(x, y, z, rx, ry, rz, color, bone = this.cur, rot = null) { return this.add(unitSphere(), M(x, y, z, rot?.[0] || 0, rot?.[1] || 0, rot?.[2] || 0, rx, ry, rz), color, bone); }
  box(x, y, z, w, h, d, color, bone = this.cur, rot = null, r = 0.012) { return this.add(roundedBox(w, h, d, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)), M(x, y, z, rot?.[0] || 0, rot?.[1] || 0, rot?.[2] || 0), color, bone); }
  cyl(x, y, z, rt, rb, len, color, bone = this.cur, rot = null, seg = 10) { return this.add(unitCyl(seg, rt, rb), M(x, y, z, rot?.[0] || 0, rot?.[1] || 0, rot?.[2] || 0, 1, len, 1), color, bone); }
  // 沿 z 軸的圓柱（槍管用）：z0→z1
  cylZ(x, y, z0, z1, r0, r1, color, bone = this.cur, seg = 10) {
    return this.add(unitCyl(seg, r1, r0), along([x, y, z0], [x, y, z1], 1, 1), color, bone);
  }
  cone(x, y, z, r, h, color, bone = this.cur, rot = null, seg = 8) { return this.add(unitCone(seg), M(x, y, z, rot?.[0] || 0, rot?.[1] || 0, rot?.[2] || 0, r, h, r), color, bone); }
  torus(x, y, z, r, tube, color, bone = this.cur, rot = null, sx = 1, sz = 1) { return this.add(unitTorus(tube / r), M(x, y, z, rot?.[0] || 0, rot?.[1] || 0, rot?.[2] || 0, r * sx, r, r * sz), color, bone); }
  // 錐形肢體：圓柱＋兩端圓球
  limb(from, to, r1, r2, color, bone = this.cur, seg = 8) {
    const l = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    this.add(unitCyl(seg, r2, r1), along(from, to, 1, 1, l), color, bone);
    this.add(unitSphere(8, 6), M(from[0], from[1], from[2], 0, 0, 0, r1), color, bone);
    this.add(unitSphere(8, 6), M(to[0], to[1], to[2], 0, 0, 0, r2), color, bone);
    return this;
  }
  // 旋轉體：profile = [[r,y],...]
  lathe(profile, m, color, bone = this.cur, seg = 12) {
    const g = new THREE.LatheGeometry(profile.map((p) => new THREE.Vector2(p[0], p[1])), seg);
    this.add(g, m, color, bone); g.dispose(); return this;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (this.skinned) {
      const si = new Uint16Array(this.n * 4), sw = new Float32Array(this.n * 4);
      for (let i = 0; i < this.n; i++) { si[i * 4] = this.bone[i]; sw[i * 4] = 1; }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    }
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}
export { _c };
