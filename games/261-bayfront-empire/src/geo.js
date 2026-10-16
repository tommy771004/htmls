// 幾何累積器：把大量小方塊、圓柱等基本形以頂點色寫進同一個 BufferGeometry，
// 靜態場景只剩少數幾個 draw call。鏡頭固定從 +x +z 方向俯看，cull 選項可省掉看不到的面。
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _n = new THREE.Matrix3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();
const _c = new THREE.Color();

function tpl(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  return { pos: g.attributes.position.array, nor: g.attributes.normal.array };
}

// 方塊：原點在底面中心，尺寸 1
const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
export const T = {
  box: tpl(boxGeo),
  cyl6: tpl(new THREE.CylinderGeometry(0.5, 0.5, 1, 6).translate(0, 0.5, 0)),
  cyl8: tpl(new THREE.CylinderGeometry(0.5, 0.5, 1, 8).translate(0, 0.5, 0)),
  cyl12: tpl(new THREE.CylinderGeometry(0.5, 0.5, 1, 12).translate(0, 0.5, 0)),
  cone8: tpl(new THREE.ConeGeometry(0.5, 1, 8).translate(0, 0.5, 0)),
  cone12: tpl(new THREE.ConeGeometry(0.5, 1, 12, 1, true).translate(0, 0.5, 0)),
  cone4: tpl(new THREE.ConeGeometry(0.5, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0)),
  ico: tpl(new THREE.IcosahedronGeometry(0.5, 0).translate(0, 0.5, 0)),
  ico1: tpl(new THREE.IcosahedronGeometry(0.5, 1).translate(0, 0.5, 0)),
  // 三角柱（斜屋頂、帆）：沿 x 延伸，截面在 yz 平面
  prism: tpl(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)]), { depth: 1, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-0.5, 0, 0)),
  plane: tpl(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
};

// 只保留朝 +x、+z、+y 的面（鏡頭看得到的三面），給不投影的小細節用
function cullTpl(t) {
  const pos = [], nor = [];
  for (let i = 0; i < t.pos.length; i += 9) {
    const nx = t.nor[i], ny = t.nor[i + 1], nz = t.nor[i + 2];
    if (nx < -0.5 || nz < -0.5 || ny < -0.5) continue;
    for (let k = 0; k < 9; k++) { pos.push(t.pos[i + k]); nor.push(t.nor[i + k]); }
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor) };
}
T.boxV = cullTpl(T.box);

export class Builder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
  }

  get empty() { return this.pos.length === 0; }

  add(t, x, y, z, sx, sy, sz, ry, color, rx = 0, rz = 0) {
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    _n.getNormalMatrix(_m);
    _c.set(color);
    const { pos, nor } = t;
    const P = this.pos, N = this.nor, C = this.col;
    for (let i = 0; i < pos.length; i += 3) {
      _v.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(_m);
      P.push(_v.x, _v.y, _v.z);
      _v.set(nor[i], nor[i + 1], nor[i + 2]).applyMatrix3(_n).normalize();
      N.push(_v.x, _v.y, _v.z);
      C.push(_c.r, _c.g, _c.b);
    }
    return this;
  }

  // 以兩角座標放方塊（y0 底、y1 頂）
  box(x0, y0, z0, x1, y1, z1, color, cull = false) {
    return this.add(cull ? T.boxV : T.box, (x0 + x1) / 2, y0, (z0 + z1) / 2, Math.abs(x1 - x0), y1 - y0, Math.abs(z1 - z0), 0, color);
  }

  // 以中心、尺寸、旋轉放方塊
  boxR(cx, y0, cz, w, h, d, ry, color, cull = false) {
    return this.add(cull ? T.boxV : T.box, cx, y0, cz, w, h, d, ry, color);
  }

  cyl(cx, y0, cz, r, h, color, seg = 8) {
    return this.add(T['cyl' + seg] || T.cyl8, cx, y0, cz, r * 2, h, r * 2, 0, color);
  }

  cone(cx, y0, cz, r, h, color, seg = 8) {
    return this.add(T['cone' + seg] || T.cone8, cx, y0, cz, r * 2, h, r * 2, 0, color);
  }

  ball(cx, y0, cz, r, color, detail = 0, sy = 1) {
    return this.add(detail ? T.ico1 : T.ico, cx, y0, cz, r * 2, r * 2 * sy, r * 2, 0, color);
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }

  mesh(material, { cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(this.geometry(), material);
    m.castShadow = cast;
    m.receiveShadow = receive;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    return m;
  }
}

// 簡單可重現亂數（場景擺設用，跟經濟系統的亂數分開）
export function prng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
