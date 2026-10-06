// 自然物件：蓬鬆闊葉樹、松樹、灌木、岩石、巨型蘑菇。
// 分區（3×3）實例化、可被十字鎬打擊：受擊晃動、倒下噴葉、碎屑；reset 時復原。
import * as THREE from 'three';
import { fbm, hash2, mulberry32, clamp } from './shared.js';
import { instMat, merge, tinted, paint, Z_MAT } from './geo.js';
import { POI_SITES, FLAT_Y, PIT } from './terrain.js';

const BROAD = ['#4fd04a', '#66dc4a', '#38b852', '#8ae04a', '#2fa65a', '#5cd65e'];
const PINE = ['#2a9a6a', '#35aa6a', '#1f8a5e', '#3fb87a'];
const SPECIAL = ['#ffb23a', '#ff8a45', '#ff9ec7', '#ffd84a']; // 少量秋色／櫻花樹增添色彩
const ROCK = ['#a9a39a', '#b8b0a4', '#8f9aa6', '#9c948c'];
const CAPS = ['#ff5a6e', '#ffa63a', '#b57bff', '#ff6fb0', '#37c8b4'];

function gradient(geo, lo, hi, y0, y1) {
  const p = geo.attributes.position, n = p.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const t = clamp((p.getY(i) - y0) / (y1 - y0), 0, 1), k = lo + (hi - lo) * t; c[i * 3] = k; c[i * 3 + 1] = k; c[i * 3 + 2] = k; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo;
}
function blob(r, x, y, z, sy = 0.9, lo = 0.62, hi = 1.12, seed = 1) {
  const g = new THREE.IcosahedronGeometry(r, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 + (hash2(Math.round(p.getX(i) * 50), Math.round(p.getZ(i) * 50), seed) - 0.5) * 0.14; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * sy, p.getZ(i) * k); }
  g.translate(x, y, z); gradient(g, lo, hi, y - r * sy, y + r * sy); return tinted(g, 1);
}
function cyl(rt, rb, h, y, color, seg = 7) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg).translate(0, y + h / 2, 0); return paint(g, color);
}
export function broadGeo() {
  return merge([cyl(0.2, 0.34, 3.4, 0, '#8a5a33'), blob(2.0, 0, 4.0, 0), blob(1.6, 1.2, 3.4, 0.4, 0.9, 0.6, 1.1, 2), blob(1.5, -1.1, 3.5, -0.5, 0.9, 0.6, 1.1, 3), blob(1.4, 0.1, 5.2, 0.2, 0.9, 0.7, 1.15, 4)]);
}
export function pineGeo() {
  const cones = [], spec = [[2.1, 2.7, 1.5], [1.7, 2.5, 2.9], [1.3, 2.3, 4.2], [0.85, 2.1, 5.4]];
  spec.forEach(([r, h, y], i) => { const g = new THREE.ConeGeometry(r, h, 7).translate(0, y + h / 2, 0); gradient(g, 0.62 + i * 0.04, 1.12, y, y + h); cones.push(tinted(g, 1)); });
  return merge([cyl(0.18, 0.3, 2.2, 0, '#7a4a28'), ...cones]);
}
export function bushGeo() { return merge([blob(0.8, 0, 0.55, 0, 0.8, 0.6, 1.1, 7), blob(0.6, 0.65, 0.4, 0.2, 0.8, 0.6, 1.1, 8), blob(0.55, -0.55, 0.4, -0.25, 0.8, 0.6, 1.05, 9), blob(0.5, 0.1, 0.4, 0.6, 0.8, 0.6, 1.0, 10)]); }
function rockGeo(seed) {
  const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 0.78 + hash2(Math.round(p.getX(i) * 40) + seed, Math.round(p.getY(i) * 40) + Math.round(p.getZ(i) * 40), seed) * 0.4; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.85, p.getZ(i) * k); }
  const ng = g.index ? g.toNonIndexed() : g; ng.computeVertexNormals(); // three 0.186 的 Icosahedron 本來就是 non-indexed，直接呼叫會印警告 gradient(ng, 0.62, 1.1, -0.9, 0.9); return tinted(ng, 1);
}
function mushroomGeo() {
  const parts = [];
  const stem = new THREE.CylinderGeometry(0.42, 0.62, 2.5, 10).translate(0, 1.25, 0); parts.push(paint(stem, '#f6ecd6'));
  // 傘：半球壓扁
  const cap = new THREE.SphereGeometry(2.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); cap.scale(1, 0.62, 1).translate(0, 2.35, 0);
  gradient(cap, 0.8, 1.1, 2.3, 3.8); cap.deleteAttribute('uv'); parts.push(tinted(cap, 1));
  const under = new THREE.CircleGeometry(2.3, 16).rotateX(Math.PI / 2).translate(0, 2.34, 0); parts.push(paint(under, '#e8cfa0'));
  for (let i = 0; i < 9; i++) { // 白點
    const a = i * 2.4, rr = 0.5 + (i % 3) * 0.6, x = Math.cos(a) * rr, z = Math.sin(a) * rr, y = 2.35 + Math.sqrt(Math.max(0, 1 - (rr / 2.3) ** 2)) * 1.43 * 0.99;
    const s = new THREE.SphereGeometry(0.26, 6, 4).scale(1, 0.4, 1); s.translate(x, y - 0.02, z); parts.push(paint(s, '#fffdf2'));
  }
  return merge(parts);
}

export class Nature {
  constructor(world) {
    this.world = world; this.ctx = world.ctx; this.refs = []; this.active = new Set();
    this.group = new THREE.Group(); this.ctx.scene.add(this.group);
    this.geo = { broad: broadGeo(), pine: pineGeo(), bush: bushGeo(), rockA: rockGeo(3), rockB: rockGeo(11), mush: mushroomGeo() };
    this.mat = { tree: instMat({ rough: 0.8, sway: 0.012 }), bush: instMat({ rough: 0.85, sway: 0.03 }), rock: instMat({ rough: 0.95 }), mush: instMat({ rough: 0.55 }) };
    this._M = new THREE.Matrix4(); this._Q = new THREE.Quaternion(); this._V = new THREE.Vector3(); this._S = new THREE.Vector3(); this._E = new THREE.Euler(); this._A = new THREE.Vector3();
  }
  // 依型別 + 分區建立 InstancedMesh：items = [{type,x,y,z,s,rot,color,hp,...}]
  build(items) {
    const cells = new Map(), CELL = 420;
    for (const it of items) { const key = it.type + ':' + Math.floor((it.x + 400) / CELL) + ':' + Math.floor((it.z + 400) / CELL); let a = cells.get(key); if (!a) cells.set(key, (a = [])); a.push(it); }
    for (const [key, arr] of cells) {
      const type = arr[0].type, geo = type === 'rock' ? this.geo.rockA : this.geo[type];
      const mat = type === 'bush' ? this.mat.bush : type === 'rock' ? this.mat.rock : type === 'mush' ? this.mat.mush : this.mat.tree;
      const im = new THREE.InstancedMesh(geo, mat, arr.length); im.castShadow = type !== 'bush'; im.receiveShadow = type !== 'bush';
      arr.forEach((it, i) => {
        const ref = this.makeRef(it, im, i);
        im.setMatrixAt(i, this.matrixFor(ref)); im.setColorAt(i, new THREE.Color(it.color));
      });
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.computeBoundingSphere(); im.computeBoundingBox();
      // 邊界略放大（晃動、倒下）
      if (im.boundingSphere) im.boundingSphere.radius += 6;
      this.group.add(im);
    }
  }
  makeRef(it, im, i) {
    const W = this.world, ctx = this.ctx, T = it.type;
    const maxHp = T === 'bush' ? 40 : T === 'rock' ? (it.big ? 260 : 140) : T === 'mush' ? 150 * Math.min(1.6, it.s) : 100;
    const ref = { kind: T === 'rock' ? 'rock' : T === 'bush' ? 'bush' : T === 'mush' ? 'mushroom' : 'tree', type: T, mesh: im, idx: i, hp: maxHp, maxHp, x: it.x, y: it.y, z: it.z, s: it.s, rot: it.rot, sy: it.sy || it.s, color: it.color, big: it.big,
      harvest: { material: T === 'rock' ? 'stone' : 'wood' }, dead: false, colIds: [], wob: null, fall: null, debris: T === 'rock' ? '#b8b0a4' : T === 'mush' ? it.color : it.color };
    ref.takeDamage = (amount, info) => this.damage(ref, amount, info);
    ref.colSpecs = this.collidersFor(ref, it);
    for (const c of ref.colSpecs) ref.colIds.push(ctx.physics.addBox({ ...c, owner: ref, kind: ref.kind === 'rock' ? 'rock' : 'tree' }));
    this.refs.push(ref); return ref;
  }
  collidersFor(r) {
    const s = r.s, sy = r.sy;
    if (r.type === 'bush') return [{ cx: r.x, cy: r.y + 0.5 * s, cz: r.z, hx: 0.55 * s, hy: 0.5 * s, hz: 0.55 * s, solid: false }];
    if (r.type === 'rock') return [{ cx: r.x, cy: r.y + 0.55 * sy * 0.8, cz: r.z, hx: s * 0.82, hy: sy * 0.62, hz: s * 0.82, yaw: r.rot }];
    if (r.type === 'mush') return [
      { cx: r.x, cy: r.y + 1.25 * s, cz: r.z, hx: 0.5 * s, hy: 1.25 * s, hz: 0.5 * s },
      { cx: r.x, cy: r.y + 2.45 * s, cz: r.z, hx: 2.0 * s, hy: 0.22 * s, hz: 2.0 * s },
      { cx: r.x, cy: r.y + 3.2 * s, cz: r.z, hx: 1.3 * s, hy: 0.4 * s, hz: 1.3 * s },
    ];
    const h = (r.type === 'pine' ? 2.4 : 3.4) * s;
    return [{ cx: r.x, cy: r.y + h / 2, cz: r.z, hx: 0.34 * s, hy: h / 2, hz: 0.34 * s }];
  }
  matrixFor(r, tilt = 0, axis = null, extra = 1) {
    const E = this._E, Q = this._Q, M = this._M;
    Q.setFromEuler(E.set(0, r.rot, 0));
    if (tilt && axis) { const t = new THREE.Quaternion().setFromAxisAngle(axis, tilt); Q.premultiply(t); }
    const s = r.s * extra, sy = r.sy * extra;
    return M.compose(this._V.set(r.x, r.y - (r.type === 'rock' ? 0.0 : 0.05), r.z), Q, this._S.set(s, sy, s)).clone();
  }
  damage(r, amount, info) {
    if (r.dead || r.fall) return;
    const w = info && info.weapon; if (w && w !== 'pickaxe') amount *= 0.5;
    r.hp -= amount;
    const src = info && info.source && info.source.pos;
    let dx = src ? r.x - src.x : Math.random() - 0.5, dz = src ? r.z - src.z : Math.random() - 0.5; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const pt = info && info.point;
    this.world.debris.burst(pt || this._V.set(r.x, r.y + 1.2, r.z), r.type === 'rock' ? '#b8b0a4' : r.type === 'mush' ? r.color : (r.type === 'bush' ? r.color : '#a8704a'), 3, 2, 0.12);
    if (r.type !== 'rock') { // 葉片
      this.world.debris.burst(this._V.set(r.x, r.y + 3.3 * r.s, r.z), r.color, r.type === 'bush' ? 3 : 4, 2.2, 0.16, 0.6);
    }
    if (r.hp <= 0) { this.kill(r, dx, dz); return; }
    r.wob = { t: 0, amp: 0.16 + 0.08 * (r.type === 'rock' ? 0 : 1), dx, dz }; this.active.add(r);
  }
  kill(r, dx, dz) {
    for (const id of r.colIds) this.ctx.physics.remove(id); r.colIds.length = 0;
    r.dead = true; r.wob = null;
    if (r.type === 'tree' || r.type === 'bush' || r.type === 'mush' || r.kind === 'tree') { r.fall = { t: 0, dx, dz }; this.active.add(r); }
    else this.finishKill(r);
  }
  finishKill(r) {
    r.mesh.setMatrixAt(r.idx, Z_MAT); r.mesh.instanceMatrix.needsUpdate = true; r.fall = null; this.active.delete(r);
    const p = this._A.set(r.x, r.y + (r.type === 'rock' ? 0.6 : 2.5 * r.s), r.z);
    this.world.debris.burst(p, r.type === 'rock' ? '#b8b0a4' : r.color, r.type === 'rock' ? 14 : 20, 5, 0.2);
    if (r.type !== 'rock') this.world.debris.burst(p, '#9a6a3c', 5, 4, 0.2);
    this.ctx.fx?.puff?.(p, r.type === 'rock' ? 0xb8b0a4 : 0x7bd35a, 10, 3.5);
    this.ctx.events?.emit('propDestroyed', { kind: r.kind, pos: p.clone(), material: r.harvest.material });
  }
  update(dt) {
    if (!this.active.size) return;
    const axis = new THREE.Vector3();
    for (const r of this.active) {
      const im = r.mesh;
      if (r.fall) {
        const f = r.fall; f.t += dt; const k = Math.min(1, f.t / 0.55), ang = k * k * 1.35;
        axis.set(f.dz, 0, -f.dx);
        im.setMatrixAt(r.idx, this.matrixFor(r, ang, axis, 1 - Math.max(0, k - 0.8) * 2));
        if (f.t >= 0.6) this.finishKill(r);
      } else if (r.wob) {
        const w = r.wob; w.t += dt; const a = w.amp * Math.sin(w.t * 26) * Math.exp(-w.t * 5.5) * (r.type === 'rock' ? 0.15 : 1);
        axis.set(w.dz, 0, -w.dx);
        im.setMatrixAt(r.idx, this.matrixFor(r, a, axis, 1));
        if (w.t > 1.0) { r.wob = null; im.setMatrixAt(r.idx, this.matrixFor(r)); this.active.delete(r); }
      }
      im.instanceMatrix.needsUpdate = true;
    }
  }
  reset() {
    this.active.clear();
    for (const r of this.refs) {
      if (r.dead || r.hp < r.maxHp || r.wob || r.fall) {
        if (r.dead) { r.colIds = r.colSpecs.map((c) => this.ctx.physics.addBox({ ...c, owner: r, kind: r.kind === 'rock' ? 'rock' : 'tree' })); }
        r.dead = false; r.hp = r.maxHp; r.wob = r.fall = null; r.mesh.setMatrixAt(r.idx, this.matrixFor(r));
      }
    }
    this.group.children.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
  }
}

// 散佈：回傳 items 清單（世界依 blockers / 道路 / 坡度過濾）
export function scatterNature(world) {
  const T = world.ctx.terrain, rng = mulberry32(4242), items = [], n3 = new THREE.Vector3();
  const ok = (x, z, margin = 6) => {
    const h = T.heightAt(x, z); if (h < 2.3 || h > 34) return false;
    T.normalAt(x, z, n3); if (n3.y < 0.86) return false;
    if (T.maskAt(x, z, 0) > 0.03 || T.maskAt(x, z, 1) > 0.03 || T.maskAt(x, z, 2) > 0.03 || T.maskAt(x, z, 3) > 0.03) return false;
    if (world.blocked(x, z, margin)) return false;
    return true;
  };
  const grove = POI_SITES[3];
  let nb = 0, np = 0, nu = 0;
  for (let i = 0; i < 16000 && nb + np < 640; i++) {
    const x = rng.range(-345, 345), z = rng.range(-345, 345), inGrove = Math.hypot(x - grove.x, z - grove.z) < 78;
    if (!inGrove && world.nearPoi(x, z, 0.7)) continue;
    const f = fbm(x * 0.011 + 11, z * 0.011, 3, 11);
    if (!inGrove && f < 0.5 && rng() > 0.05) continue;
    if (inGrove && rng() < 0.15) continue;
    if (!ok(x, z, inGrove ? 4.5 : 6)) continue;
    // 太近的樹略過（簡單間距）
    const h = T.heightAt(x, z), pine = h > 15 || (inGrove ? rng() < 0.4 : f > 0.62 ? rng() < 0.4 : rng() < 0.2);
    const s = 0.85 + rng() * 0.7;
    const col = pine ? PINE[rng.int(PINE.length)] : (rng() < 0.08 ? SPECIAL[rng.int(SPECIAL.length)] : BROAD[rng.int(BROAD.length)]);
    items.push({ type: pine ? 'pine' : 'broad', x, y: h, z, s, rot: rng() * 6.28, color: col }); pine ? np++ : nb++;
  }
  for (let i = 0; i < 4000 && nu < 170; i++) {
    const x = rng.range(-345, 345), z = rng.range(-345, 345); if (!ok(x, z, 4)) continue;
    items.push({ type: 'bush', x, y: T.heightAt(x, z), z, s: 0.8 + rng() * 0.8, rot: rng() * 6.28, color: BROAD[rng.int(BROAD.length)] }); nu++;
  }
  return items;
}
export function scatterRocks(world, items) {
  const T = world.ctx.terrain, rng = mulberry32(777), n3 = new THREE.Vector3(), P = POI_SITES[4];
  const add = (x, z, s, big = false) => { const h = T.heightAt(x, z); if (h < 0.8) return; items.push({ type: 'rock', variant: rng() < 0.5 ? 1 : 0, x, y: h, z, s, sy: s * (0.8 + rng() * 0.4), rot: rng() * 6.28, big, color: ROCK[rng.int(ROCK.length)] }); };
  // 採石場：坑邊、坑底大量岩塊
  for (let i = 0; i < 46; i++) { const a = rng() * 6.28, d = rng.range(3, PIT.r * 1.25), x = PIT.cx + Math.cos(a) * d, z = PIT.cz + Math.sin(a) * d; if (world.blocked(x, z, 3)) continue; add(x, z, 0.9 + rng() * 2.2, rng() < 0.2); }
  for (let i = 0; i < 24; i++) { const a = rng() * 6.28, d = rng.range(PIT.r * 1.2, P.r * 1.2), x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d; if (!world.blocked(x, z, 3)) add(x, z, 1.0 + rng() * 1.6); }
  // 全島散落：斜坡、海岸、高台下
  for (let i = 0; i < 4000 && items.filter((r) => r.type === 'rock').length < 160; i++) {
    const x = rng.range(-350, 350), z = rng.range(-350, 350), h = T.heightAt(x, z); if (h < 1 || world.nearPoi(x, z, 0.62) || world.blocked(x, z, 3)) continue;
    T.normalAt(x, z, n3); if (T.maskAt(x, z, 0) > 0.03) continue;
    const steep = n3.y < 0.9 || h < 2.5; if (!steep && rng() > 0.06) continue;
    add(x, z, 0.8 + rng() * 1.6 + (steep ? 0.5 : 0), rng() < 0.12);
  }
}
export function scatterMushrooms(world, items) {
  const rng = mulberry32(555), G = POI_SITES[3], T = world.ctx.terrain;
  for (let i = 0; i < 40; i++) {
    const a = rng() * 6.28, d = 8 + rng() * 52, x = G.x + Math.cos(a) * d, z = G.z + Math.sin(a) * d;
    if (world.blocked(x, z, 5) || T.maskAt(x, z, 0) > 0.03) continue;
    const big = i < 22, s = big ? 1.0 + rng() * 1.1 : 0.35 + rng() * 0.3;
    items.push({ type: 'mush', x, y: T.heightAt(x, z), z, s, rot: rng() * 6.28, color: CAPS[rng.int(CAPS.length)] });
    world.addBlocker(x, z, 2.5 * s);
  }
}
