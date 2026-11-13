// 可破壞的場景：家具被打壞時，把它在靜態網格裡的三角形藏起來、噴出會落地的碎片，
// 並把「原本被它擋住光」的頂點重新烘焙（分幀做）。回合開始時全部復原。純畫面層，不影響模擬。
import * as THREE from 'three';
import { ambientPatch } from './builder.js';
import { C, WOOD_D, WOOD_M, WOOD_L, BRASS, STEEL, RED, GREEN, CREAM, SHEET, LEATHER, OX, WHITE } from './props.js';

const W3 = [WOOD_D, WOOD_M, WOOD_L], LAC = C('#0c0c0d'), GREY = C('#56646b');
const PAL = {
  bed: [WOOD_D, WHITE, RED, WOOD_M], nightstand: W3, wardrobe: W3, cabinet: [C('#48554c'), STEEL, C('#3a443d')], desk: W3, chair: [WOOD_D, RED, WOOD_D],
  armchair: [RED, LEATHER, WOOD_D, CREAM], sofa: [OX, GREEN, WOOD_D, CREAM], ctable: W3, stool: [STEEL, OX, BRASS], rtable: [WOOD_M, CREAM, WOOD_D],
  piano: [LAC, LAC, C('#d8d2c2'), BRASS], cart: [BRASS, LEATHER, WOOD_D, RED], hcart: [GREY, WHITE, STEEL], sideboard: W3, crate: [WOOD_L, WOOD_M], crate2: [WOOD_L, WOOD_M],
  sheet: [SHEET, SHEET, WOOD_M], plant: [C('#70402c'), C('#4a4424'), C('#241a12')], pool: [WOOD_D, C('#1f5a3c'), WOOD_M], booth: [OX, WOOD_D], barricade: [WOOD_L, WOOD_M, C('#8a7f62')], buffet: [WOOD_M, WOOD_D, STEEL, WHITE],
};
const SOFT = { bed: 1, armchair: 1, sofa: 1, sheet: 1, booth: 1 };
export const BREAK_SND = { cabinet: 'metal', stool: 'metal', hcart: 'metal', cart: 'metal', bed: 'soft', armchair: 'soft', sofa: 'soft', sheet: 'soft', booth: 'soft', piano: 'piano', plant: 'pot' };

const ND = 320, _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _ax = new THREE.Vector3(), _c = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0);
const R = Math.random;

class Debris {
  constructor(scene, lights, world) {
    this.lights = lights; this.world = world; this.i = 0; this.pi = 0; this.live = 0;
    const g = new THREE.BoxGeometry(1, 1, 1); this.probe = new THREE.InstancedBufferAttribute(new Float32Array(ND * 3), 3); g.setAttribute('aProbe', this.probe);
    this.mat = ambientPatch(new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, envMapIntensity: 0.5 }), 'iprobe');
    const m = this.mesh = new THREE.InstancedMesh(g, this.mat, ND); m.frustumCulled = false; m.receiveShadow = true; m.castShadow = false;
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(ND * 3).fill(1), 3);
    this.P = Array.from({ length: ND }, () => ({ on: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, q: new THREE.Quaternion(), wx: 0, wy: 0, wz: 0, sx: 1, sy: 1, sz: 1, b: 0, yaw: 0, t: 0 }));
    this.clear(); scene.add(m);
  }
  clear() { _m.makeScale(0, 0, 0); for (let i = 0; i < ND; i++) { this.P[i].on = 0; this.mesh.setMatrixAt(i, _m); } this.mesh.instanceMatrix.needsUpdate = true; this.live = 0; }
  spawn(it, b) {
    const w = b.x1 - b.x0, d = b.z1 - b.z0, h = it.h, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, pal = PAL[it.type] || W3, soft = !!SOFT[it.type];
    const n = Math.max(7, Math.min(30, Math.round(w * d * h * 15) + 6)), pc = this.lights.probe(cx, Math.min(1.2, h * 0.6) + 0.1, cz, _c);
    for (let k = 0; k < n; k++) {
      const i = this.i; this.i = (i + 1) % ND; const p = this.P[i], r = R(), col = pal[(R() * pal.length) | 0];
      // 形狀：長木板、碎塊、細木條（sy 是最薄的那一邊，落地後朝上）
      if (r < (soft ? 0.2 : 0.5)) { p.sx = Math.min(Math.max(w, d), 0.25 + R() * 0.6); p.sy = 0.02 + R() * 0.025; p.sz = 0.07 + R() * 0.12; }
      else if (r < (soft ? 0.85 : 0.8)) { const s = soft ? 0.12 + R() * 0.2 : 0.08 + R() * 0.17; p.sx = s; p.sy = s * (soft ? 0.45 : 0.4 + R() * 0.5); p.sz = s * (0.6 + R() * 0.6); }
      else { p.sx = 0.18 + R() * 0.35; p.sy = 0.015 + R() * 0.012; p.sz = 0.02 + R() * 0.02; }
      p.x = cx + (R() - 0.5) * w * 0.8; p.z = cz + (R() - 0.5) * d * 0.8; p.y = 0.1 + R() * Math.max(0.1, h - 0.2);
      let dx = p.x - cx, dz = p.z - cz; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl; const sp = 0.5 + R() * 2.4;
      p.vx = dx * sp + (R() - 0.5) * 1.2; p.vz = dz * sp + (R() - 0.5) * 1.2; p.vy = 0.8 + R() * 3.0;
      p.wx = (R() - 0.5) * 16; p.wy = (R() - 0.5) * 16; p.wz = (R() - 0.5) * 16; p.q.setFromAxisAngle(_ax.set(R() - 0.5, R() - 0.5, R() - 0.5).normalize(), R() * 6.28);
      p.on = 1; p.b = 0; p.t = 0; p.yaw = R() * 6.28; const v = 0.36 + R() * 0.3; // 家具本體有貼圖壓暗，碎片沒有，所以把底色壓低
      this.mesh.setColorAt(i, _c.setRGB(col[0] * v, col[1] * v, col[2] * v)); this.probe.setXYZ(i, pc.r, pc.g, pc.b); this.live++;
    }
    this.mesh.instanceColor.needsUpdate = true; this.probe.needsUpdate = true;
  }
  update(dt) {
    if (!this.live) return; const o = this._o || (this._o = { x: 0, z: 0 }), W = this.world; let moved = false, live = 0;
    for (let i = 0; i < ND; i++) {
      const p = this.P[i]; if (p.on !== 1) continue; live++; moved = true;
      if (p.b < 3) {
        p.vy -= 9.8 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        W.resolve(p.x, p.z, 0.05, o); if (o.x !== p.x || o.z !== p.z) { p.x = o.x; p.z = o.z; p.vx *= -0.2; p.vz *= -0.2; }
        const wl = Math.hypot(p.wx, p.wy, p.wz); if (wl > 1e-3) { _q.setFromAxisAngle(_ax.set(p.wx / wl, p.wy / wl, p.wz / wl), wl * dt); p.q.premultiply(_q); }
        const hh = p.sy * 0.5 + 0.008;
        if (p.y < hh) { p.y = hh; p.b++; p.vy = -p.vy * 0.28; p.vx *= 0.55; p.vz *= 0.55; p.wx *= 0.4; p.wy *= 0.4; p.wz *= 0.4; if (Math.abs(p.vy) < 0.5) p.b = 3; }
      } else { // 落地：攤平、停下
        p.t += dt; p.x += p.vx * dt; p.z += p.vz * dt; p.vx *= 0.8; p.vz *= 0.8; p.y = p.sy * 0.5 + 0.008;
        p.q.slerp(_q2.setFromAxisAngle(UP, p.yaw), Math.min(1, dt * 14)); if (p.t > 0.45) p.on = 2;
      }
      _m.compose(_p.set(p.x, p.y, p.z), p.q, _s.set(p.sx, p.sy, p.sz)); this.mesh.setMatrixAt(i, _m);
    }
    this.live = live; if (moved) this.mesh.instanceMatrix.needsUpdate = true;
  }
  // 碎片吃的環境光：每幀輪流重新取樣幾片（燈被打滅後碎片也會跟著暗下來）
  relight(n = 6) {
    let any = false;
    for (let k = 0; k < n; k++) { const i = this.pi; this.pi = (i + 1) % ND; const p = this.P[i]; if (!p.on) continue; this.lights.probe(p.x, p.y + 0.12, p.z, _c); this.probe.setXYZ(i, _c.r, _c.g, _c.b); any = true; }
    if (any) this.probe.needsUpdate = true;
  }
}

// 線段 a→b 是否穿過盒子 B
function segBox(ax, ay, az, bx, by, bz, B) {
  let t0 = 0, t1 = 1;
  for (let k = 0; k < 3; k++) {
    const o = k === 0 ? ax : k === 1 ? ay : az, d = (k === 0 ? bx : k === 1 ? by : bz) - o, lo = k === 0 ? B.x0 : k === 1 ? B.y0 : B.z0, hi = k === 0 ? B.x1 : k === 1 ? B.y1 : B.z1;
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return false; continue; }
    let a = (lo - o) / d, b = (hi - o) / d; if (a > b) { const s = a; a = b; b = s; }
    if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) return false;
  }
  return true;
}

export class Wreck {
  constructor(hotel, map, world, lights, scene) {
    this.map = map; this.world = world; this.lights = lights; this.owners = hotel.group.userData.owners;
    this.meshes = hotel.group.children.filter(m => m.geometry.attributes.bake);
    this.jobs = []; this.snap = new Map(); this.hidden = []; this.out = new Float32Array(11);
    this.debris = new Debris(scene, lights, world);
  }
  breakItem(it, quiet) {
    const b = this.map.boxes[it.box]; this.hide('i' + it.id); this.rebake(b);
    if (!quiet) this.debris.spawn(it, b);
  }
  hide(key) {
    const L = this.owners.get(key); if (!L) return;
    for (const r of L) {
      if (r.hidden) continue; const ix = r.mesh.geometry.index;
      if (!r.save) r.save = ix.array.slice(r.i0, r.i1);
      ix.array.fill(0, r.i0, r.i1); ix.needsUpdate = true; r.hidden = true; this.hidden.push(r); // 全部指向同一個頂點＝退化三角形，不會畫出來
    }
  }
  // 找出「到某盞燈的連線會穿過 b」的頂點，排進重烘佇列
  rebake(b) {
    const Lt = this.lights, cands = [], U = { x0: 1e9, y0: 1e9, z0: 1e9, x1: -1e9, y1: -1e9, z1: -1e9 };
    const ext = (c, x, y, z) => { if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y; if (z < c.z0) c.z0 = z; if (z > c.z1) c.z1 = z; };
    for (const l of Lt.L) {
      const qx = Math.max(b.x0 - l.x, 0, l.x - b.x1), qy = Math.max(b.y0 - l.y, 0, l.y - b.y1), qz = Math.max(b.z0 - l.z, 0, l.z - b.z1); if (qx * qx + qy * qy + qz * qz > l.r2) continue;
      const r = Math.sqrt(l.r2), c = { x: l.x, y: l.y, z: l.z, x0: b.x0, y0: b.y0, z0: b.z0, x1: b.x1, y1: b.y1, z1: b.z1 };
      if (qx + qy + qz === 0) { ext(c, l.x - r, l.y - r, l.z - r); ext(c, l.x + r, l.y + r, l.z + r); } // 燈在盒子裡
      else for (let k = 0; k < 8; k++) { // 盒子的影子：八個角沿著「燈 → 角」延伸到燈的照射半徑
        const dx = (k & 1 ? b.x1 : b.x0) - l.x, dy = (k & 2 ? b.y1 : b.y0) - l.y, dz = (k & 4 ? b.z1 : b.z0) - l.z, s = Math.max(1, r / (Math.hypot(dx, dy, dz) || 1e-3));
        ext(c, l.x + dx * s, l.y + dy * s, l.z + dz * s);
      }
      cands.push(c);
    }
    const m = Lt.moon;
    if (b.z1 > 1.5) { const t = (b.y1 + 0.3) / -m.dir[1], c = { moon: 1, x0: b.x0, y0: -0.1, z0: b.z0, x1: b.x1, y1: b.y1, z1: b.z1 }; ext(c, b.x0 + m.dir[0] * t, 0, b.z0 + m.dir[2] * t); ext(c, b.x1 + m.dir[0] * t, 0, b.z1 + m.dir[2] * t); cands.push(c); }
    if (!cands.length) return;
    for (const c of cands) { c.x0 -= 0.1; c.y0 -= 0.1; c.z0 -= 0.1; c.x1 += 0.1; c.y1 += 0.1; c.z1 += 0.1; ext(U, c.x0, c.y0, c.z0); ext(U, c.x1, c.y1, c.z1); }
    for (const mesh of this.meshes) {
      const g = mesh.geometry, bb = g.boundingBox; if (bb.max.x < U.x0 || bb.min.x > U.x1 || bb.max.y < U.y0 || bb.min.y > U.y1 || bb.max.z < U.z0 || bb.min.z > U.z1) continue;
      const P = g.attributes.position.array, N = g.attributes.normal.array, n = P.length / 3, list = [];
      for (let i = 0; i < n; i++) {
        const px = P[i * 3] + N[i * 3] * 0.05, py = P[i * 3 + 1] + N[i * 3 + 1] * 0.05, pz = P[i * 3 + 2] + N[i * 3 + 2] * 0.05;
        if (px < U.x0 || px > U.x1 || pz < U.z0 || pz > U.z1 || py < U.y0 || py > U.y1) continue;
        for (let k = 0; k < cands.length; k++) {
          const c = cands[k]; if (px < c.x0 || px > c.x1 || py < c.y0 || py > c.y1 || pz < c.z0 || pz > c.z1) continue;
          if (c.moon ? segBox(px, py, pz, px - m.dir[0] * 60, py - m.dir[1] * 60, pz - m.dir[2] * 60, b) : segBox(px, py, pz, c.x, c.y, c.z, b)) { list.push(i); break; }
        }
      }
      if (list.length) this.jobs.push({ mesh, list, i: 0 });
    }
  }
  // 每幀花一點時間重烘；一個網格做完才上傳，畫面不會一塊一塊跳
  update(dt, ms = 2.2) {
    this.debris.update(dt); this.debris.relight();
    if (!this.jobs.length) return; const t0 = performance.now(), out = this.out, Lt = this.lights;
    while (this.jobs.length) {
      const j = this.jobs[0], g = j.mesh.geometry, P = g.attributes.position.array, N = g.attributes.normal.array, A = g.attributes.bake, I = g.attributes.bakeI, Wt = g.attributes.bakeW;
      if (!this.snap.has(j.mesh)) this.snap.set(j.mesh, { a: A.array.slice(), i: I.array.slice(), w: Wt.array.slice() });
      for (; j.i < j.list.length; j.i++) {
        if ((j.i & 31) === 31 && performance.now() - t0 > ms) return;
        const v = j.list[j.i], nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2];
        Lt.bakeAt(P[v * 3] + nx * 0.05, P[v * 3 + 1] + ny * 0.05, P[v * 3 + 2] + nz * 0.05, nx, ny, nz, out);
        A.array[v * 3] = out[0]; A.array[v * 3 + 1] = out[1]; A.array[v * 3 + 2] = out[2];
        for (let k = 0; k < 4; k++) { I.array[v * 4 + k] = out[3 + k]; Wt.array[v * 4 + k] = out[7 + k]; }
      }
      A.needsUpdate = I.needsUpdate = Wt.needsUpdate = true; this.jobs.shift();
    }
  }
  get busy() { return this.jobs.length; }
  // 回合開始：把藏起來的家具、改過的烘焙光與碎片全部還原
  restore() {
    this.jobs.length = 0;
    for (const [mesh, s] of this.snap) { const a = mesh.geometry.attributes; a.bake.array.set(s.a); a.bakeI.array.set(s.i); a.bakeW.array.set(s.w); a.bake.needsUpdate = a.bakeI.needsUpdate = a.bakeW.needsUpdate = true; }
    this.snap.clear();
    for (const r of this.hidden) { const ix = r.mesh.geometry.index; ix.array.set(r.save, r.i0); ix.needsUpdate = true; r.hidden = false; }
    this.hidden.length = 0; this.debris.clear();
  }
}
