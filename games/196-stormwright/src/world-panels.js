// 可破壞的板塊系統：每個叢集一組 InstancedMesh（板塊材質含木板／瓦片／磚／鐵皮等程序花紋），
// 每個板塊對應一或多個物理 collider；被打掉時縮成 0、移除 collider、噴碎屑。
import * as THREE from 'three';
import { instMat, Z_MAT, TIME } from './geo.js';

export const KIND = { plank: 0, shingle: 1, brick: 2, metal: 3, floor: 4, plaster: 5, log: 6, plain: 7 };
const HP = { wood: 110, stone: 190, metal: 320 };
export const HP_MUL = { wall: 1, floor: 1.1, roof: 0.9, stair: 1, prop: 1 };

// 板塊材質：不用 vertex color，花紋由 shader 依物件空間座標（公尺）決定
let _panelMat = null;
export function panelMat() {
  if (_panelMat) return _panelMat;
  const m = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aKind; varying float vKind; varying vec3 vLoc; varying vec3 vLn; varying vec3 vSz;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vec3 isz = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
vLoc = position * isz; vLn = normal; vKind = aKind; vSz = isz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vKind; varying vec3 vLoc; varying vec3 vLn; varying vec3 vSz;
float hs1(float n){ return fract(sin(n*91.345)*47453.5453); }
float hs2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 an = abs(vLn); vec2 uv; vec2 hs;
  if (an.z > 0.5) { uv = vLoc.xy; hs = vSz.xy * 0.5; } else if (an.x > 0.5) { uv = vLoc.zy; hs = vSz.zy * 0.5; } else { uv = vLoc.xz; hs = vSz.xz * 0.5; }
  float k = vKind, m = 1.0; vec3 tint = vec3(1.0);
  if (k < 0.5) { // 橫向木板
    float t = (uv.y + hs.y) / 0.30, row = floor(t), f = fract(t);
    m = mix(0.74, 1.0, smoothstep(0.0, 0.14, f)) * (0.93 + 0.1 * hs1(row + floor((uv.x + hs.x) / 2.3 + hs1(row) * 5.0)));
    float sx = fract((uv.x + hs.x) / 1.9 + hs1(row) * 3.0); m *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 0.012, min(sx, 1.0 - sx)));
  } else if (k < 1.5) { // 屋瓦：交錯排列，每列下緣較暗
    float t = (uv.y + hs.y) / 0.42, row = floor(t), f = fract(t);
    float tx = (uv.x + hs.x) / 0.55 + 0.5 * mod(row, 2.0), tc = floor(tx), fx = fract(tx);
    m = mix(0.72, 1.06, smoothstep(0.0, 0.85, f)) * (0.9 + 0.2 * hs2(vec2(tc, row)));
    m *= 1.0 - 0.28 * (1.0 - smoothstep(0.0, 0.05, min(fx, 1.0 - fx)));
  } else if (k < 2.5) { // 磚／石塊
    float t = (uv.y + hs.y) / 0.24, row = floor(t), f = fract(t);
    float tx = (uv.x + hs.x) / 0.6 + 0.5 * mod(row, 2.0), tc = floor(tx), fx = fract(tx);
    float mortar = 1.0 - smoothstep(0.0, 0.07, min(min(f, 1.0 - f), min(fx, 1.0 - fx) * 0.45));
    m = (0.88 + 0.2 * hs2(vec2(tc, row))); tint = mix(vec3(1.0), vec3(1.28, 1.25, 1.2), mortar * 0.8); m *= 1.0 - mortar * 0.12;
  } else if (k < 3.5) { // 波浪鐵皮：直向肋條 + 底部鏽跡
    m = 0.8 + 0.2 * sin((uv.x + hs.x) * 16.0);
    float yy = (uv.y + hs.y); tint = mix(vec3(1.0), vec3(1.05, 0.78, 0.6), smoothstep(0.7, 0.0, yy) * 0.35 * hs2(vec2(floor((uv.x + hs.x) * 3.0), 3.0)));
  } else if (k < 4.5) { // 地板木條
    float t = (uv.y + hs.y) / 0.32, row = floor(t), f = fract(t);
    m = mix(0.78, 1.0, smoothstep(0.0, 0.1, f)) * (0.94 + 0.1 * hs1(row * 1.7));
    float sx = fract((uv.x + hs.x) / 1.6 + hs1(row) * 2.0); m *= 1.0 - 0.15 * (1.0 - smoothstep(0.0, 0.015, min(sx, 1.0 - sx)));
  } else if (k < 5.5) { // 灰泥
    m = 0.95 + 0.07 * hs2(floor((uv + hs) * 6.0));
  } else if (k < 6.5) { // 圓木
    float t = (uv.y + hs.y) / 0.30, f = fract(t);
    m = 0.72 + 0.4 * sin(f * 3.14159);
    m *= 0.94 + 0.1 * hs1(floor(t) * 3.1);
  }
  // 板塊邊緣略暗，凸顯「一塊一塊」的板塊感
  float edge = min(hs.x - abs(uv.x), hs.y - abs(uv.y));
  m *= mix(0.8, 1.0, smoothstep(0.0, 0.07, edge));
  diffuseColor.rgb *= m * tint;
}`);
  };
  m.customProgramCacheKey = () => 'panelmat';
  return (_panelMat = m);
}

export class Debris {
  constructor(ctx, max = 360) {
    this.ctx = ctx; this.max = max;
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, max);
    this.mesh.castShadow = true; this.mesh.frustumCulled = false; this.mesh.count = max;
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    for (let i = 0; i < max; i++) this.mesh.setMatrixAt(i, Z_MAT);
    ctx.scene.add(this.mesh);
    this.p = []; for (let i = 0; i < max; i++) this.p.push({ on: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), s: new THREE.Vector3(), t: 0, life: 1, rested: false });
    this.i = 0; this.live = 0; this._tail = 0; this.mesh.visible = false;
    this._M = new THREE.Matrix4(); this._Q = new THREE.Quaternion(); this._c = new THREE.Color(); this._S = new THREE.Vector3();
  }
  burst(pos, color, n = 8, speed = 4, size = 0.22, up = 1.2) {
    const c = this._c.set(color); this.mesh.visible = true; this._tail = 2;
    for (let k = 0; k < n; k++) {
      const q = this.p[this.i++ % this.max], a = Math.random() * 6.283, sp = speed * (0.35 + Math.random() * 0.8);
      q.on = true; q.t = 0; q.life = 1.1 + Math.random() * 0.9; q.rested = false;
      q.pos.set(pos.x + (Math.random() - 0.5) * 0.5, pos.y + (Math.random() - 0.5) * 0.5, pos.z + (Math.random() - 0.5) * 0.5);
      q.vel.set(Math.cos(a) * sp, up * speed * (0.4 + Math.random() * 0.8), Math.sin(a) * sp);
      q.spin.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14); q.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      const s = size * (0.5 + Math.random() * 0.9); q.s.set(s * (0.7 + Math.random() * 1.8), s * (0.35 + Math.random() * 0.6), s * (0.6 + Math.random() * 0.8));
      const j = 0.82 + Math.random() * 0.35;
      this.mesh.setColorAt((this.i - 1) % this.max, this._c.copy(c).multiplyScalar(j));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  clear() { for (let i = 0; i < this.max; i++) if (this.p[i].on) { this.p[i].on = false; this.mesh.setMatrixAt(i, Z_MAT); } this.mesh.instanceMatrix.needsUpdate = true; }
  update(dt) {
    const T = this.ctx.terrain; let any = false;
    for (let i = 0; i < this.max; i++) {
      const q = this.p[i]; if (!q.on) continue;
      q.t += dt; any = true;
      if (!q.rested) {
        q.vel.y -= 18 * dt; q.pos.addScaledVector(q.vel, dt);
        q.rot.x += q.spin.x * dt; q.rot.y += q.spin.y * dt; q.rot.z += q.spin.z * dt;
        const gh = Math.max(T.heightAt(q.pos.x, q.pos.z), 0) + q.s.y * 0.4;
        if (q.pos.y < gh) { q.pos.y = gh; q.vel.y *= -0.3; q.vel.x *= 0.55; q.vel.z *= 0.55; q.spin.multiplyScalar(0.4); if (Math.abs(q.vel.y) < 0.8) q.rested = true; }
      }
      const f = q.t > q.life - 0.35 ? Math.max(0, (q.life - q.t) / 0.35) : 1;
      if (q.t >= q.life) { q.on = false; this.mesh.setMatrixAt(i, Z_MAT); continue; }
      this._Q.setFromEuler(q.rot);
      this._M.compose(q.pos, this._Q, this._S.set(q.s.x * f, q.s.y * f, q.s.z * f));
      this.mesh.setMatrixAt(i, this._M);
    }
    if (any || this._was) this.mesh.instanceMatrix.needsUpdate = true;
    this._was = any; this.mesh.visible = any || this._tail > 0; this._tail = any ? 2 : Math.max(0, (this._tail || 0) - 1);
  }
}

const WHITE = new THREE.Color(1, 1, 1);
export class Panels {
  constructor(world, name) {
    this.world = world; this.ctx = world.ctx; this.name = name;
    this.list = []; this.types = new Map(); // type 名 → { geo, mat, items[] }
    this.flashing = new Set(); this.meshes = [];
  }
  // 註冊其他幾何類型（圓柱、車子…）；'box' 預設
  addType(name, geo, mat) { this.types.set(name, { geo, mat, items: [] }); }
  // spec: { type='box', kind, mat:'wood'|'stone'|'metal', cx,cy,cz, sx,sy,sz, yaw,tilt,roll, color, cols:[{cx,cy,cz,hx,hy,hz,yaw}], hpMul, tintColor }
  add(s) {
    const type = s.type || 'box';
    let t = this.types.get(type); if (!t) { t = { items: [] }; this.types.set(type, t); }
    const p = {
      kind: 'panel', panelKind: s.pk || 'wall', world: this.world, set: this, type, spec: s,
      hp: 0, maxHp: Math.round((s.hp || HP[s.mat || 'wood'] * (HP_MUL[s.pk || 'wall'] || 1)) * (s.hpMul || 1)), dead: false,
      harvest: { material: s.mat || 'wood' }, colIds: [], flash: 0, shake: 0, idx: -1, slot: t.items.length,
      color: new THREE.Color(s.color || '#ffffff'), center: new THREE.Vector3(s.cx, s.cy, s.cz),
      debrisColor: s.debrisColor || s.color || '#d9b27a',
    };
    p.hp = p.maxHp;
    p.takeDamage = (amount, info) => this.damage(p, amount, info);
    t.items.push(p); this.list.push(p);
    return p;
  }
  composeFor(p, scaleMul = 1) {
    const s = p.spec, E = new THREE.Euler(s.tilt || 0, s.yaw || 0, s.roll || 0, 'YXZ'), M = new THREE.Matrix4();
    return M.compose(new THREE.Vector3(s.cx, s.cy, s.cz), new THREE.Quaternion().setFromEuler(E), new THREE.Vector3(s.sx * scaleMul, s.sy * scaleMul, s.sz * scaleMul));
  }
  _registerColliders(p) {
    p.colIds.length = 0;
    const cols = p.spec.cols || [{ cx: p.spec.cx, cy: p.spec.cy, cz: p.spec.cz, hx: p.spec.sx / 2, hy: p.spec.sy / 2, hz: p.spec.sz / 2, yaw: p.spec.yaw || 0 }];
    for (const c of cols) p.colIds.push(this.ctx.physics.addBox({ ...c, owner: p, kind: 'prop', solid: p.spec.solid !== false }));
  }
  // 全部加完後建立 InstancedMesh
  build(parent = this.ctx.scene) {
    for (const [name, t] of this.types) {
      const n = t.items.length; if (!n) continue;
      let geo = t.geo, mat = t.mat;
      if (!geo || !mat) { geo = geo ? geo.clone() : new THREE.BoxGeometry(1, 1, 1); mat = panelMat(); const kinds = new Float32Array(n); t.items.forEach((p, i) => { kinds[i] = p.spec.kind || 0; }); geo.setAttribute('aKind', new THREE.InstancedBufferAttribute(kinds, 1)); geo.deleteAttribute('uv'); }
      const im = new THREE.InstancedMesh(geo, mat, n);
      im.castShadow = im.receiveShadow = true;
      t.mesh = im; t.items.forEach((p, i) => { p.idx = i; p.mesh = im; im.setMatrixAt(i, this.composeFor(p)); im.setColorAt(i, p.color); this._registerColliders(p); p.baseMat = this.composeFor(p); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere(); im.computeBoundingBox();
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      parent.add(im); this.meshes.push(im);
    }
  }
  damage(p, amount, info) {
    if (p.dead) return;
    const w = info && info.weapon;
    if (w && w !== 'pickaxe') amount *= 0.4; // 子弹只在板塊上留痕
    p.hp -= amount; p.flash = 1; p.shake = 1; this.flashing.add(p);
    const pt = info && info.point ? info.point : p.center;
    this.world.debris.burst(pt, p.debrisColor, p.hp <= 0 ? 0 : 3, 2.2, 0.12);
    if (p.hp <= 0) this.destroy(p, info);
  }
  destroy(p, info) {
    if (p.dead) return; p.dead = true;
    p.mesh.setMatrixAt(p.idx, Z_MAT); p.mesh.instanceMatrix.needsUpdate = true;
    for (const id of p.colIds) this.ctx.physics.remove(id);
    this.flashing.delete(p);
    const mx = Math.max(p.spec.sx, p.spec.sy, p.spec.sz), sz = Math.min(0.26, 0.1 + mx * 0.018), n = Math.min(30, 10 + Math.round(mx * 3));
    this.world.debris.burst(p.center, p.debrisColor, n, 5.5, sz);
    this.ctx.fx?.puff?.(p.center, 0xe6dccb, 8, 3);
    this.ctx.events?.emit('panelDestroyed', { panel: p, pos: p.center, material: p.harvest.material, by: info && info.source });
  }
  update(dt) {
    if (!this.flashing.size) return;
    const M = new THREE.Matrix4(), c = new THREE.Color();
    for (const p of this.flashing) {
      p.flash = Math.max(0, p.flash - dt * 5); p.shake = Math.max(0, p.shake - dt * 4);
      const hpK = Math.max(0.35, p.hp / p.maxHp), f = p.flash;
      const sc = 1 + 0.035 * Math.sin(p.shake * 22) * p.shake;
      p.mesh.setMatrixAt(p.idx, this.composeFor(p, sc));
      c.copy(p.color).multiplyScalar(0.6 + 0.4 * hpK).lerp(WHITE, f * 0.35);
      p.mesh.setColorAt(p.idx, c);
      if (p.flash <= 0 && p.shake <= 0) { this.flashing.delete(p); p.mesh.setMatrixAt(p.idx, p.baseMat); c.copy(p.color).multiplyScalar(0.6 + 0.4 * hpK); p.mesh.setColorAt(p.idx, c); }
      p.mesh.instanceMatrix.needsUpdate = true; if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
    }
  }
  reset() {
    this.flashing.clear();
    for (const p of this.list) {
      if (!p.mesh) continue;
      if (p.dead) { p.dead = false; this._registerColliders(p); }
      p.hp = p.maxHp; p.flash = p.shake = 0;
      p.mesh.setMatrixAt(p.idx, p.baseMat); p.mesh.setColorAt(p.idx, p.color);
    }
    for (const m of this.meshes) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }
}
