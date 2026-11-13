// 靜態幾何建構器：把牆、地板、家具全部併成「材質 × 區塊」的網格，並在載入時把所有燈的光照（含陰影）烘進頂點。
import * as THREE from 'three';

// 烘焙光：每個頂點存「不會變的底光」＋影響它最大的 4 盞燈（編號與係數）。每盞燈目前的顏色放在 uLamp，
// 所以燈可以各自閃爍、被打滅，不必重烘。第 MOON 格是月光（方向光），閃電時一起變亮。
export const NL = 64, MOON = 63;
export const BAKE_U = { uMoon: { value: 1 }, uLamp: { value: new Float32Array(NL * 3) }, uLampS: { value: new Float32Array(NL).fill(1) } };

// 讓 MeshStandardMaterial 吃烘焙光：'vertex' 讀頂點屬性；'probe' 讀每個材質自己的 uProbe；'iprobe' 讀每個 instance 的 aProbe
export function ambientPatch(mat, mode) {
  if (mode === 'probe') mat.userData.uProbe = { value: new THREE.Color(0.2, 0.15, 0.1) };
  mat.onBeforeCompile = function (sh) {
    const tail = k => `irradiance += bakeL * PI;\n#include <lights_fragment_maps>\nfloat bkl = clamp(dot(bakeL, vec3(0.35, 0.5, 0.15)) * ${k}, 0.02, 1.3); radiance *= bkl; iblIrradiance *= bkl;`;
    if (mode === 'vertex') {
      sh.uniforms.uLamp = BAKE_U.uLamp;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nattribute vec3 bake; attribute vec4 bakeI; attribute vec4 bakeW; varying vec3 vBake; uniform vec3 uLamp[${NL}];`)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBake = bake + bakeW.x * uLamp[int(bakeI.x)] + bakeW.y * uLamp[int(bakeI.y)] + bakeW.z * uLamp[int(bakeI.z)] + bakeW.w * uLamp[int(bakeI.w)];');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vBake;')
        .replace('#include <lights_fragment_maps>', 'vec3 bakeL = vBake;\n' + tail('1.5'));
    } else if (mode === 'iprobe') {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aProbe; varying vec3 vProbe;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvProbe = aProbe;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vProbe;').replace('#include <lights_fragment_maps>', 'vec3 bakeL = vProbe;\n' + tail('2.2'));
    } else {
      sh.uniforms.uProbe = this.userData.uProbe;
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uProbe;').replace('#include <lights_fragment_maps>', 'vec3 bakeL = uProbe;\n' + tail('2.2'));
    }
  };
  mat.customProgramCacheKey = () => 'amb-' + mode;
  return mat;
}
// 燈罩與燈泡（不受光的材質）：亮度跟著那盞燈的狀態。aLamp = 燈編號＋小數；小數 > 0 表示「亮度低於這個門檻就熄」（吊燈的燈泡一顆顆滅）。
export function lampPatch(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uLampS = BAKE_U.uLampS;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nattribute float aLamp; uniform float uLampS[${NL}]; varying float vLampS;`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n{ float ls = aLamp < 0.0 ? 1.0 : uLampS[int(aLamp)]; float th = fract(aLamp); vLampS = th > 0.001 ? step(th, ls) : ls; }');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLampS;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 0.02 + 0.98 * vLampS;');
  };
  mat.customProgramCacheKey = () => 'lampS'; mat.userData.lampAttr = true;
  return mat;
}

// 每軸可不等距的方盒：r > 0 時把邊角揉圓（軟墊、枕頭、行李箱）。uv 以公尺 / uvs。
export function gridBox(w, h, d, o = {}) {
  const r = Math.min(o.r || 0, w / 2, h / 2, d / 2), tess = o.tess || 0.6, uvs = o.uvs || 1;
  const axis = (len) => {
    const hl = len / 2, out = [-hl];
    if (r > 0) { if (!o.lite) out.push(-hl + r * 0.35); out.push(-hl + r); }
    const a = -hl + r, b = hl - r, n = Math.max(1, Math.ceil((b - a) / tess));
    for (let i = 1; i < n; i++) out.push(a + (b - a) * i / n);
    if (r > 0) { if (b > a + 1e-6) out.push(b); if (!o.lite) out.push(hl - r * 0.35); }
    out.push(hl);
    return out;
  };
  const X = axis(w), Y = axis(h), Z = axis(d), pos = [], nor = [], uv = [], idx = [];
  const face = (A, B, fix, ia, ib, ic, flip) => { // ia, ib：平面兩軸的索引；ic：固定軸
    const base = pos.length / 3;
    for (let j = 0; j < B.length; j++) for (let i = 0; i < A.length; i++) {
      const p = [0, 0, 0]; p[ia] = A[i]; p[ib] = B[j]; p[ic] = fix; const n = [0, 0, 0]; n[ic] = Math.sign(fix);
      if (r > 0) {
        const hw = [w / 2 - r, h / 2 - r, d / 2 - r], q = [0, 0, 0], v = [0, 0, 0];
        for (let k = 0; k < 3; k++) { q[k] = Math.max(-hw[k], Math.min(hw[k], p[k])); v[k] = p[k] - q[k]; }
        const l = Math.hypot(v[0], v[1], v[2]); if (l > 1e-6) for (let k = 0; k < 3; k++) { n[k] = v[k] / l; p[k] = q[k] + n[k] * r; }
      }
      pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]);
      if (o.uvFit) uv.push((A[i] - A[0]) / (A[A.length - 1] - A[0]), (B[j] - B[0]) / (B[B.length - 1] - B[0]));
      else uv.push(A[i] / uvs, ib === 1 && o.uvV ? B[j] / o.uvV + 0.5 : B[j] / uvs);
    }
    const na = A.length;
    for (let j = 0; j < B.length - 1; j++) for (let i = 0; i < na - 1; i++) {
      const a = base + j * na + i, b = a + 1, c = a + na, e = c + 1;
      if (flip) idx.push(a, c, b, b, c, e); else idx.push(a, b, c, b, e, c);
    }
  };
  const sk = o.skip || '';
  if (!sk.includes('X')) face(Z, Y, w / 2, 2, 1, 0, true); if (!sk.includes('x')) face(Z, Y, -w / 2, 2, 1, 0, false);
  if (!sk.includes('Y')) face(X, Z, h / 2, 0, 2, 1, true); if (!sk.includes('y')) face(X, Z, -h / 2, 0, 2, 1, false);
  if (!sk.includes('Z')) face(X, Y, d / 2, 0, 1, 2, false); if (!sk.includes('z')) face(X, Y, -d / 2, 0, 1, 2, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1);

export class Builder {
  constructor() { this.bins = new Map(); this.lamp = -1; this.owner = null; this.owners = new Map(); }
  // owner 有值時，之後加入的三角形都記在它名下（家具被打壞時整組藏起來）
  _own(B, i0) {
    if (this.owner == null) return; let L = this.owners.get(this.owner); if (!L) this.owners.set(this.owner, L = []);
    const last = L[L.length - 1]; if (last && last.b === B && last.i1 === i0) last.i1 = B.idx.length; else L.push({ b: B, i0, i1: B.idx.length });
  }
  bin(mat, chunk) {
    const k = mat + '|' + chunk; let b = this.bins.get(k);
    if (!b) { b = { mat, chunk, pos: [], nor: [], uv: [], col: [], idx: [], lamp: [] }; this.bins.set(k, b); }
    return b;
  }
  // 平面網格：原點 (ox,oy,oz)，邊 a、b，法線 n。uv = (u0 + s*ul, v0 + t*vl)。tess：每格最大邊長
  quad(mat, chunk, ox, oy, oz, ax, ay, az, bx, by, bz, nx, ny, nz, u0, v0, ul, vl, tess = 0.5, col) {
    const B = this.bin(mat, chunk), la = Math.hypot(ax, ay, az), lb = Math.hypot(bx, by, bz);
    const na = Math.max(1, Math.ceil(la / tess - 1e-6)), nb = Math.max(1, Math.ceil(lb / tess - 1e-6)), base = B.pos.length / 3, i0 = B.idx.length;
    const cr = col ? col[0] : 1, cg = col ? col[1] : 1, cb = col ? col[2] : 1;
    for (let j = 0; j <= nb; j++) for (let i = 0; i <= na; i++) {
      const s = i / na, t = j / nb;
      B.pos.push(ox + ax * s + bx * t, oy + ay * s + by * t, oz + az * s + bz * t); B.nor.push(nx, ny, nz); B.uv.push(u0 + ul * s, v0 + vl * t); B.col.push(cr, cg, cb); B.lamp.push(this.lamp);
    }
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx, flip = cx * nx + cy * ny + cz * nz < 0;
    for (let j = 0; j < nb; j++) for (let i = 0; i < na; i++) {
      const a = base + j * (na + 1) + i, b = a + 1, c = a + na + 1, d = c + 1;
      if (flip) B.idx.push(a, c, b, b, c, d); else B.idx.push(a, b, c, b, d, c);
    }
    this._own(B, i0);
  }
  // 任意幾何（已含 position / normal / uv）＋矩陣
  geo(mat, chunk, g, m, col) {
    const B = this.bin(mat, chunk), base = B.pos.length / 3, i0 = B.idx.length, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, C = g.attributes.color;
    _n.getNormalMatrix(m);
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(m); B.pos.push(_v.x, _v.y, _v.z);
      _v.fromBufferAttribute(N, i).applyMatrix3(_n).normalize(); B.nor.push(_v.x, _v.y, _v.z);
      if (U) B.uv.push(U.getX(i), U.getY(i)); else B.uv.push(0, 0);
      if (C) B.col.push(C.getX(i) * (col ? col[0] : 1), C.getY(i) * (col ? col[1] : 1), C.getZ(i) * (col ? col[2] : 1));
      else if (col) B.col.push(col[0], col[1], col[2]); else B.col.push(1, 1, 1);
      B.lamp.push(this.lamp);
    }
    const I = g.index; if (I) for (let i = 0; i < I.count; i++) B.idx.push(base + I.getX(i)); else for (let i = 0; i < P.count; i++) B.idx.push(base + i);
    this._own(B, i0);
  }
  // 局部座標助手：家具都在自己的局部空間裡組，再乘上擺放矩陣
  local(chunk, M) {
    const self = this, mm = new THREE.Matrix4();
    const place = (x, y, z, o) => { _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'); _q.setFromEuler(_e); _s.set(o.sx || 1, o.sy || 1, o.sz || 1); mm.compose(_v.set(x, y, z), _q, _s).premultiply(M); return mm; };
    return {
      M, tag(v) { self.lamp = v; },
      box(mat, x, y, z, w, h, d, o = {}) { self.geo(mat, chunk, gridBox(w, h, d, o), place(x, y, z, o), o.col); },
      cyl(mat, x, y, z, rt, rb, h, seg = 12, o = {}) { const g = new THREE.CylinderGeometry(rt, rb, h, seg, o.hs || 1, !!o.open); if (o.uvs) scaleUV(g, o.uvs[0], o.uvs[1]); self.geo(mat, chunk, g, place(x, y, z, o), o.col); },
      sph(mat, x, y, z, r, o = {}) { const g = new THREE.SphereGeometry(r, o.ws || 12, o.hs || 8, 0, 6.2832, o.t0 || 0, o.tl || Math.PI); self.geo(mat, chunk, g, place(x, y, z, o), o.col); },
      lathe(mat, x, y, z, pts, seg = 14, o = {}) { const g = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg); self.geo(mat, chunk, g, place(x, y, z, o), o.col); },
      geo(mat, g, x, y, z, o = {}) { self.geo(mat, chunk, g, place(x, y, z, o), o.col); },
    };
  }

  // 烘焙：對每個頂點累加所有燈的照度（射線判斷遮蔽）。分批執行，避免卡住頁面。
  async bake(lights, onProgress) {
    let total = 0, done = 0; for (const b of this.bins.values()) total += b.pos.length / 3;
    const out = new Float32Array(11); let t0 = performance.now();
    for (const b of this.bins.values()) {
      const n = b.pos.length / 3; b.bake = new Float32Array(n * 3); b.bakeI = new Uint8Array(n * 4); b.bakeW = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        const nx = b.nor[i * 3], ny = b.nor[i * 3 + 1], nz = b.nor[i * 3 + 2];
        lights.bakeAt(b.pos[i * 3] + nx * 0.05, b.pos[i * 3 + 1] + ny * 0.05, b.pos[i * 3 + 2] + nz * 0.05, nx, ny, nz, out);
        b.bake[i * 3] = out[0]; b.bake[i * 3 + 1] = out[1]; b.bake[i * 3 + 2] = out[2];
        for (let k = 0; k < 4; k++) { b.bakeI[i * 4 + k] = out[3 + k]; b.bakeW[i * 4 + k] = out[7 + k]; }
        if ((++done & 1023) === 0 && performance.now() - t0 > 14) { onProgress && onProgress(done / total); await new Promise(r => setTimeout(r, 0)); t0 = performance.now(); }
      }
    }
    onProgress && onProgress(1);
  }
  build(mats) {
    const group = new THREE.Group(); let tris = 0, verts = 0;
    for (const b of this.bins.values()) {
      const g = new THREE.BufferGeometry(), n = b.pos.length / 3;
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      const mat = mats[b.mat]; if (!mat) throw new Error('缺材質 ' + b.mat);
      if (b.bake && !mat.userData.unlit) { g.setAttribute('bake', new THREE.BufferAttribute(b.bake, 3)); g.setAttribute('bakeI', new THREE.BufferAttribute(b.bakeI, 4)); g.setAttribute('bakeW', new THREE.BufferAttribute(b.bakeW, 4)); }
      if (mat.userData.lampAttr) g.setAttribute('aLamp', new THREE.Float32BufferAttribute(b.lamp, 1));
      g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(b.idx, 1) : new THREE.Uint16BufferAttribute(b.idx, 1));
      g.computeBoundingSphere(); g.computeBoundingBox();
      const m = new THREE.Mesh(g, mat); b.mesh = m; m.name = b.mat + '|' + b.chunk; m.matrixAutoUpdate = false;
      m.castShadow = !mat.userData.noShadow; m.receiveShadow = !mat.userData.unlit;
      if (mat.userData.order) m.renderOrder = mat.userData.order;
      group.add(m); tris += b.idx.length / 3; verts += n;
    }
    group.userData.stats = { meshes: group.children.length, tris, verts };
    const owners = group.userData.owners = new Map();
    for (const [k, L] of this.owners) owners.set(k, L.map(r => ({ mesh: r.b.mesh, i0: r.i0, i1: r.i1, save: null })));
    this.bins.clear();
    return group;
  }
}
function scaleUV(g, su, sv) { const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * su, u.getY(i) * sv); }

// 光照評估（烘焙與動態物件的探針共用）
const AMB = [0.026, 0.028, 0.038], MOONCOL = [0.5, 0.64, 1.0];
export class Lights {
  constructor(map, world) {
    this.world = world; this.moon = map.moon; this.lamps = map.lamps; const L = [];
    if (map.lamps.length > MOON) throw new Error('燈太多');
    this.base = new Float32Array(NL * 3); this.lum = new Float32Array(NL); this.cur = BAKE_U.uLamp.value; this.S = BAKE_U.uLampS.value; this.fl = new Float32Array(NL).fill(1);
    this.acc = new Float32Array(NL); this.ids = new Int16Array(NL);
    const setBase = (i, c, I) => { this.base[i * 3] = c[0] * I; this.base[i * 3 + 1] = c[1] * I; this.base[i * 3 + 2] = c[2] * I; this.lum[i] = (c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15) * I; };
    for (const l of map.lamps) {
      setBase(l.id, l.ch === 2 ? MOONCOL : l.col, l.I);
      L.push({ x: l.x, y: l.y, z: l.z, r2: l.r * l.r, id: l.id, k: 1, b: 0 });
      if (l.kind === 'window') continue;
      // 地面反彈（朝上發光）
      const t = world.raycast(l.x, l.y - 0.06, l.z, 0, -1, 0, 10, true), fy = l.y - 0.06 - (t < Infinity ? t : l.y) + 0.08;
      L.push({ x: l.x, y: fy, z: l.z, r2: l.r * l.r * 0.8, id: l.id, k: 0.22, b: 1 });
      // 天花板反彈（朝下發光）
      const t2 = world.raycast(l.x, l.y + 0.06, l.z, 0, 1, 0, 10, true);
      if (t2 < Infinity && t2 < 4) L.push({ x: l.x, y: l.y + 0.06 + t2 - 0.08, z: l.z, r2: l.r * l.r * 0.7, id: l.id, k: 0.15, b: 2 });
    }
    setBase(MOON, MOONCOL, this.moon.I);
    this.L = L;
    // 空間格：每格列出影響得到的燈
    this.cs = 4; this.gx0 = -28; this.gz0 = -22; this.gw = 14; this.gh = 11; this.grid = Array.from({ length: this.gw * this.gh }, () => []);
    for (const l of L) { const r = Math.sqrt(l.r2); for (let j = 0; j < this.gh; j++) for (let i = 0; i < this.gw; i++) { const x0 = this.gx0 + i * 4, z0 = this.gz0 + j * 4; const dx = Math.max(x0 - l.x, 0, l.x - x0 - 4), dz = Math.max(z0 - l.z, 0, l.z - z0 - 4); if (dx * dx + dz * dz < r * r) this.grid[j * this.gw + i].push(l); } }
    this.update(0, 0, 1);
  }
  // 每幀：依燈的狀態（lamp.s）、閃爍與閃電算出每盞燈目前的顏色
  update(dt, t, moonK) {
    const cur = this.cur, base = this.base, S = this.S, fl = this.fl;
    for (const l of this.lamps) {
      const i = l.id; let s = l.s;
      if (l.ch === 1) { const tt = t + i * 13.7, f = Math.sin(tt * 31) * Math.sin(tt * 7.3) * Math.sin(tt * 1.9); fl[i] += ((f > 0.3 ? 0.28 : 1) - fl[i]) * Math.min(1, dt * 30); s *= fl[i]; }
      S[i] = s; const k = l.ch === 2 ? moonK : s;
      cur[i * 3] = base[i * 3] * k; cur[i * 3 + 1] = base[i * 3 + 1] * k; cur[i * 3 + 2] = base[i * 3 + 2] * k;
    }
    for (let c = 0; c < 3; c++) cur[MOON * 3 + c] = base[MOON * 3 + c] * moonK;
  }
  // 把每盞燈（連同它的反彈）在這一點的照度係數累加進 acc[燈編號]；回傳碰到幾盞（編號在 ids）。法線全 0 表示無方向（探針）。
  _gather(px, py, pz, nx, ny, nz) {
    const W = this.world, omni = nx === 0 && ny === 0 && nz === 0, acc = this.acc, ids = this.ids; let n = 0;
    const ci = Math.floor((px - this.gx0) / this.cs), cj = Math.floor((pz - this.gz0) / this.cs);
    const list = (ci >= 0 && cj >= 0 && ci < this.gw && cj < this.gh) ? this.grid[cj * this.gw + ci] : this.L;
    for (let i = 0; i < list.length; i++) {
      const l = list[i], dx = l.x - px, dy = l.y - py, dz = l.z - pz, d2 = dx * dx + dy * dy + dz * dz; if (d2 > l.r2) continue;
      const d = Math.sqrt(d2) || 1e-3; let ndl = omni ? 0.55 : (nx * dx + ny * dy + nz * dz) / d; if (ndl <= 0.01) continue;
      if (l.b === 1) { const e = -dy / d; if (e <= 0) continue; ndl *= 0.35 + 0.65 * e; } else if (l.b === 2) { const e = dy / d; if (e <= 0) continue; ndl *= 0.35 + 0.65 * e; }
      const w = 1 - d2 / l.r2, k = (w * w / (d2 + 0.3) + 0.04 * w) * ndl * l.k; // 後項是多次反彈的近似：離燈遠一點也還有底光
      if (W.blocked(px, py, pz, l.x, l.y, l.z, true)) continue;
      if (acc[l.id] === 0) ids[n++] = l.id; acc[l.id] += k;
    }
    const m = this.moon;
    if (pz > 1.5) {
      const ndl = omni ? 0.5 : -(nx * m.dir[0] + ny * m.dir[1] + nz * m.dir[2]);
      if (ndl > 0.01 && W.raycast(px, py, pz, -m.dir[0], -m.dir[1], -m.dir[2], 60, true) === Infinity) { ids[n++] = MOON; acc[MOON] = ndl; }
    }
    return n;
  }
  // 烘焙一個頂點 → out[0..2] 底光、out[3..6] 四盞燈的編號、out[7..10] 係數
  bakeAt(px, py, pz, nx, ny, nz, out) {
    const n = this._gather(px, py, pz, nx, ny, nz), acc = this.acc, ids = this.ids, base = this.base, lum = this.lum;
    let r = AMB[0], g = AMB[1], b = AMB[2];
    for (let s = 0; s < 4; s++) {
      let bi = -1, bv = 0; for (let i = 0; i < n; i++) { const id = ids[i]; if (id < 0) continue; const v = acc[id] * lum[id]; if (v > bv) { bv = v; bi = i; } }
      if (bi < 0) { out[3 + s] = 0; out[7 + s] = 0; } else { const id = ids[bi]; out[3 + s] = id; out[7 + s] = acc[id]; acc[id] = 0; ids[bi] = -1; }
    }
    for (let i = 0; i < n; i++) { const id = ids[i]; if (id < 0) continue; const k = acc[id]; r += base[id * 3] * k; g += base[id * 3 + 1] * k; b += base[id * 3 + 2] * k; acc[id] = 0; }
    out[0] = r; out[1] = g; out[2] = b;
  }
  // 動態物件用：這一點目前的環境光顏色（吃得到燈的亮滅、閃爍與閃電）
  // dir（可省略）：主要光線來的方向 × 方向性（0＝四面八方一樣亮、1＝只有一盞燈），角色拿它當主光，弧面才有明暗
  probe(x, y, z, col, dir) {
    const n = this._gather(x, y, z, 0, 0, 0), acc = this.acc, ids = this.ids, cur = this.cur; let r = AMB[0], g = AMB[1], b = AMB[2], vx = 0, vy = 0, vz = 0, ws = 0.02;
    for (let i = 0; i < n; i++) {
      const id = ids[i], k = acc[id], cr = cur[id * 3] * k, cg = cur[id * 3 + 1] * k, cb = cur[id * 3 + 2] * k; r += cr; g += cg; b += cb; acc[id] = 0;
      if (dir) { const w = cr * 0.3 + cg * 0.55 + cb * 0.15, l = id === MOON ? null : this.lamps[id]; let dx, dy, dz; if (l) { dx = l.x - x; dy = l.y - y; dz = l.z - z; } else { dx = -this.moon.dir[0]; dy = -this.moon.dir[1]; dz = -this.moon.dir[2]; } const d = Math.hypot(dx, dy, dz) || 1; vx += dx / d * w; vy += dy / d * w; vz += dz / d * w; ws += w; }
    }
    if (dir) dir.set(vx / ws, vy / ws, vz / ws);
    return col.setRGB(r, g, b);
  }
}
