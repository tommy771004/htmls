// 小工具：把許多帶頂點色的基本形狀併成一個幾何（角色、槍）。
import * as THREE from 'three';
import { gridBox } from './builder.js';
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export class Geo {
  constructor() { this.list = []; }
  add(g, x, y, z, col, o = {}) {
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'YXZ'); _q.setFromEuler(_e); _s.set(o.sx || 1, o.sy || 1, o.sz || 1);
    g.applyMatrix4(_m.compose(_p.set(x, y, z), _q, _s));
    const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); this.list.push(g); return this;
  }
  box(w, h, d, x, y, z, col, o = {}) { return this.add(gridBox(w, h, d, { r: o.r || 0, tess: 9, uvs: 0.2 }), x, y, z, col, o); }
  cyl(rt, rb, h, seg, x, y, z, col, o = {}) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!o.open), x, y, z, col, o); }
  sph(r, x, y, z, col, o = {}) { return this.add(new THREE.SphereGeometry(r, o.ws || 10, o.hs || 7, 0, 6.2832, o.t0 || 0, o.tl || Math.PI), x, y, z, col, o); }
  build() { return mergeGeos(this.list); }
  get empty() { return !this.list.length; }
}
export function mergeGeos(list) {
  let nv = 0, ni = 0; for (const g of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3).fill(1), idx = new (nv > 65535 ? Uint32Array : Uint16Array)(ni); let vo = 0, io = 0;
  for (const g of list) {
    const n = g.attributes.position.count; pos.set(g.attributes.position.array, vo * 3); if (g.attributes.normal) nor.set(g.attributes.normal.array, vo * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2); if (g.attributes.color) col.set(g.attributes.color.array, vo * 3);
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo; else for (let i = 0; i < n; i++) idx[io++] = vo + i;
    vo += n;
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}
