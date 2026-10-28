// 幾何累積器：一堆方塊／圓柱／多面體各自帶頂點色，最後合併成一個 Mesh（每個材質一次 draw call）。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _c = new THREE.Color();

export class Kit {
  constructor() { this.list = []; this.jitter = 0.04; this.seed = 1; }
  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  add(geo, pos, rot, scale, hex, jitter = this.jitter) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv');
    _e.set(rot[0], rot[1], rot[2]); _q.setFromEuler(_e);
    _m.compose(_p.set(pos[0], pos[1], pos[2]), _q, _s.set(scale[0], scale[1], scale[2]));
    g.applyMatrix4(_m);
    _c.set(hex);
    const k = 1 + (this.rnd() - 0.5) * 2 * jitter;
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r * k; col[i * 3 + 1] = _c.g * k; col[i * 3 + 2] = _c.b * k; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.list.push(g);
    return this;
  }
  box(x, y, z, sx, sy, sz, hex, ry = 0, rz = 0, rx = 0) { return this.add(BOX, [x, y, z], [rx, ry, rz], [sx, sy, sz], hex); }
  cyl(x, y, z, r, h, hex, seg = 10, rz = 0, rx = 0) { return this.add(cylGeo(seg), [x, y, z], [rx, 0, rz], [r, h, r], hex); }
  ico(x, y, z, r, hex, sy = 1, detail = 1) { return this.add(icoGeo(detail), [x, y, z], [0, this.rnd() * 6, 0], [r, r * sy, r], hex, 0.08); }
  prism(x, y, z, w, h, len, hex, ry = 0) { return this.add(PRISM, [x, y, z], [0, ry, 0], [w, h, len], hex); }
  build(mat, { shadow = true, receive = true } = {}) {
    if (!this.list.length) return null;
    const g = mergeGeometries(this.list, false);
    this.list.forEach((x) => x.dispose());
    this.list = [];
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.castShadow = shadow; m.receiveShadow = receive;
    return m;
  }
}

const BOX = new THREE.BoxGeometry(1, 1, 1);
const _cyl = {}, _ico = {};
const cylGeo = (seg) => (_cyl[seg] ??= new THREE.CylinderGeometry(1, 1, 1, seg));
const icoGeo = (d) => (_ico[d] ??= new THREE.IcosahedronGeometry(1, d));
// 三角柱：底寬 1（x −0.5..0.5）、高 1（y 0..1）、沿 z 長 1（−0.5..0.5）
const PRISM = (() => {
  const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5);
  return g;
})();
