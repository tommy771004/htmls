// 建造（SPEC §10）：牆／地板／斜坡、看向瞄準放置、turbo 連續放置、建造中全息、受損、碎裂、結構支撐。
// 繪製：每種外形一個 InstancedMesh（貼圖／全息／裂紋在 shader），碎片一個 InstancedMesh。
import * as THREE from 'three';
import { DIRS } from './physics.js';
import { clamp } from './shared.js';
import { makeTextures } from './build-tex.js';
import { CELL, LEVEL, FLOOR_T, RAMP_TH, RAMP_T, pieceGeometry, makePieceMaterial, makeGhostMaterial } from './build-shader.js';
import { Debris } from './build-debris.js';

const COST = 10, MAX_DIST = 7, TURBO_DT = 0.12, CAP = 640;
const MATS = { wood: { hp: 150, time: 2.8, idx: 0 }, stone: { hp: 300, time: 6, idx: 1 }, metal: { hp: 500, time: 11, idx: 2 } };
const MAT_ORDER = ['wood', 'stone', 'metal'];
const KINDS = ['wall', 'floor', 'ramp'];
const OPP = [2, 3, 0, 1];
const HOVER_RANGE = 16;
const _E = new THREE.Vector3(), _D = new THREE.Vector3(), _v = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _one = new THREE.Vector3(1, 1, 1), _zero = new THREE.Matrix4().makeScale(0, 0, 0);
const _yAxis = new THREE.Vector3(0, 1, 0), _xAxis = new THREE.Vector3(1, 0, 0);

// 一種外形的實例儲存
class Layer {
  constructor(kind, mat, parent) {
    this.kind = kind;
    const geo = pieceGeometry(kind);
    this.a1 = new Float32Array(CAP * 4); this.a2 = new Float32Array(CAP * 4);
    this.b1 = new THREE.InstancedBufferAttribute(this.a1, 4); this.b2 = new THREE.InstancedBufferAttribute(this.a2, 4);
    this.b1.setUsage(THREE.DynamicDrawUsage); this.b2.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPiece', this.b1); geo.setAttribute('aPiece2', this.b2);
    this.mesh = new THREE.InstancedMesh(geo, mat, CAP);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.name = 'build-' + kind;
    parent.add(this.mesh);
    this.free = []; this.top = 0; this.dirty = false; this.mdirty = false;
  }
  alloc() { if (!this.free.length && this.top >= CAP) return -1; const i = this.free.length ? this.free.pop() : this.top++; this.mesh.count = this.top; return i; }
  release(i) { this.mesh.setMatrixAt(i, _zero); this.mdirty = true; this.free.push(i); }
  clear() { for (let i = 0; i < this.top; i++) this.mesh.setMatrixAt(i, _zero); this.free.length = 0; this.top = 0; this.mesh.count = 0; this.mdirty = true; }
  set(i, mat, prog, dmg, hitT, placeT, seed) {
    const o = i * 4; this.a1[o] = mat; this.a1[o + 1] = prog; this.a1[o + 2] = dmg; this.a1[o + 3] = hitT; this.a2[o] = placeT; this.a2[o + 1] = seed; this.dirty = true;
  }
  flush() {
    if (this.dirty) { this.b1.needsUpdate = true; this.b2.needsUpdate = true; this.dirty = false; }
    if (this.mdirty) { this.mesh.instanceMatrix.needsUpdate = true; this.mdirty = false; }
  }
}

export class Build {
  constructor(ctx) {
    this.ctx = ctx;
    this.pieces = new Map(); this.byKey = new Map(); this.joints = new Map();
    this.nextId = 1; this.growing = new Set(); this.collapse = [];
    this.group = new THREE.Group(); this.group.name = 'build'; ctx.scene.add(this.group);
    this.U = { time: { value: 0 }, clock: { value: 0 } };
    const texs = makeTextures(); this.texs = texs;
    this.layers = {};
    for (const k of KINDS) this.layers[k] = new Layer(k, makePieceMaterial(k, texs, this.U), this.group);
    this.debris = new Debris(ctx, this.group);
    // 預覽幽靈：每種外形一個
    this.ghost = {};
    for (const k of KINDS) {
      const m = new THREE.Mesh(pieceGeometry(k), makeGhostMaterial(k, this.U));
      m.visible = false; m.renderOrder = 5; m.frustumCulled = false; m.castShadow = m.receiveShadow = false;
      this.group.add(m); this.ghost[k] = { mesh: m, pos: new THREE.Vector3(), quat: new THREE.Quaternion(), key: '', col: new THREE.Color(0x4aa8ff), shown: false };
    }
    this.colOk = new THREE.Color(0x4aa8ff); this.colBad = new THREE.Color(0xff4a5a); this.colOcc = new THREE.Color(0x7fc2e8);
    this.preview = null; this.hoverCache = { frame: -1, piece: null };
  }

  // ---- 幾何／鍵 ----
  canon(i, k, e) { return e === 1 ? [i + 1, k, 3] : e === 2 ? [i, k + 1, 0] : [i, k, e]; }
  edgeKey(i, k, e, lv) { const [a, b, c] = this.canon(i, k, e); return `${c === 0 ? 'x' : 'z'}${a},${b},${lv}`; }
  keyOf(kind, i, k, level, edge) {
    if (kind === 'wall') { const [a, b, c] = this.canon(i, k, edge); return `w:${a},${b},${level},${c}`; }
    return `${kind[0]}:${i},${k},${level}`;
  }
  jointsOf(kind, i, k, level, edge) {
    if (kind === 'floor') return [0, 1, 2, 3].map((e) => this.edgeKey(i, k, e, level));
    if (kind === 'wall') return [this.edgeKey(i, k, edge, level), this.edgeKey(i, k, edge, level + 1)];
    return [this.edgeKey(i, k, OPP[edge], level), this.edgeKey(i, k, edge, level + 1)];
  }
  // 世界變換（位置、旋轉）。回傳 center（物理／HP 用）寫入 pos。
  xform(kind, i, k, level, edge, pos, quat) {
    const y0 = LEVEL * level;
    if (kind === 'wall') { pos.set(edge === 0 ? CELL * i + CELL / 2 : CELL * i, y0 + LEVEL / 2, edge === 0 ? CELL * k : CELL * k + CELL / 2); quat.setFromAxisAngle(_yAxis, edge === 0 ? 0 : Math.PI / 2); }
    else if (kind === 'floor') { pos.set(CELL * i + CELL / 2, y0 - FLOOR_T / 2, CELL * k + CELL / 2); quat.identity(); }
    else {
      _q2.setFromAxisAngle(_yAxis, -edge * Math.PI / 2);
      _v.set(0, LEVEL / 2 - Math.cos(RAMP_TH) * RAMP_T / 2, -Math.sin(RAMP_TH) * RAMP_T / 2).applyQuaternion(_q2);
      pos.set(CELL * i + CELL / 2, y0, CELL * k + CELL / 2).add(_v);
      quat.setFromAxisAngle(_xAxis, RAMP_TH).premultiply(_q2);
    }
  }
  // 取樣點 [x, z, top, bottom]：地形接地／埋入判定
  samples(kind, i, k, level, edge) {
    const x0 = CELL * i, z0 = CELL * k, y0 = LEVEL * level, pts = [];
    if (kind === 'wall') { const c = this.canon(i, k, edge), ax = c[2] === 0, bx = CELL * c[0], bz = CELL * c[1]; for (const t of [0, 0.5, 1]) pts.push([ax ? bx + t * CELL : bx, ax ? bz : bz + t * CELL, y0 + LEVEL, y0]); }
    else if (kind === 'floor') for (const [a, b] of [[.5, .5], [0, 0], [1, 0], [0, 1], [1, 1]]) pts.push([x0 + a * CELL, z0 + b * CELL, y0, y0 - FLOOR_T]);
    else {
      const [dx, dz] = DIRS[edge], cx = x0 + CELL / 2, cz = z0 + CELL / 2, h = CELL / 2;
      for (const [u, v] of [[-1, 0], [-1, -1], [-1, 1], [-0.5, 0], [0, 0], [0.5, 0], [1, 0]]) { const top = y0 + LEVEL * (u + 1) / 2; pts.push([cx + dx * u * h - dz * v * h, cz + dz * u * h + dx * v * h, top, top - 0.25]); }
    }
    return pts;
  }
  cardinal(yaw) { const fx = -Math.sin(yaw), fz = -Math.cos(yaw); return Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 1 : 3) : (fz < 0 ? 0 : 2); }
  // 腳下（同格）是否站在朝同方向的斜坡上
  rampUnder(a, i0, k0, base) {
    for (const l of [base, base - 1]) { const p = this.byKey.get(`r:${i0},${k0},${l}`); if (p && !p.dead && a.pos.y >= LEVEL * l - 0.1 && a.pos.y <= LEVEL * (l + 1) + 1.6) return p; }
    return null;
  }
  mode(a) { return !!a.building; }
  selectedPiece(a) { return a.buildPiece; }

  // ---- 瞄準：由視線決定目標格 ----
  target(a, kind) {
    a.eyePos(_E); a.forward(_D);
    const T = this.ctx.terrain, pitch = a.pitch, up = pitch > 0.436;
    const base = Math.floor((a.pos.y + 0.4) / LEVEL);
    const i0 = Math.floor(a.pos.x / CELL), k0 = Math.floor(a.pos.z / CELL), dir = this.cardinal(a.yaw);
    if (kind === 'wall') {
      if (Math.hypot(_D.x, _D.z) > 0.08) {
        // 沿視線走訪格線：第一條穿過的格邊就是要蓋的牆
        let ix = _D.x > 0 ? Math.floor(_E.x / CELL) + 1 : Math.floor(_E.x / CELL), kz = _D.z > 0 ? Math.floor(_E.z / CELL) + 1 : Math.floor(_E.z / CELL);
        const sx = _D.x > 0 ? 1 : -1, sz = _D.z > 0 ? 1 : -1;
        for (let n = 0; n < 12; n++) {
          const tx = Math.abs(_D.x) > 1e-6 ? (ix * CELL - _E.x) / _D.x : Infinity, tz = Math.abs(_D.z) > 1e-6 ? (kz * CELL - _E.z) / _D.z : Infinity;
          const useX = tx < tz, t = useX ? tx : tz;
          if (t > MAX_DIST) break;
          if (t >= 0.05) {
            const x = _E.x + _D.x * t, z = _E.z + _D.z * t, y = Math.max(_E.y + _D.y * t, T.heightAt(x, z) + 0.2);
            const level = clamp(Math.floor(y / LEVEL), base - 1, base + 2);
            return useX ? { i: ix, k: Math.floor(z / CELL), level, edge: 3 } : { i: Math.floor(x / CELL), k: kz, level, edge: 0 };
          }
          if (useX) ix += sx; else kz += sz;
        }
      }
      const c = this.canon(i0, k0, dir);
      return { i: c[0], k: c[1], level: up ? base + 1 : base, edge: c[2] };
    }
    if (kind === 'floor') {
      const L = up ? base + 1 : base;
      let px = 0, pz = 0, ok = false;
      if (Math.abs(_D.y) > 0.05) {
        const t = (L * LEVEL - _E.y) / _D.y;
        if (t > 0.05 && t < 12) { px = _E.x + _D.x * t; pz = _E.z + _D.z * t; ok = Math.hypot(px - a.pos.x, pz - a.pos.z) <= 5.6; }
      }
      if (!ok) { px = a.pos.x - Math.sin(a.yaw) * 2.6; pz = a.pos.z - Math.cos(a.yaw) * 2.6; }
      return { i: Math.floor(px / CELL), k: Math.floor(pz / CELL), level: L, edge: 0 };
    }
    // ramp：朝視線方向（四向量化）；低頭 → 腳下格；站在同向斜坡上 → 往上接一層
    const [dx, dz] = DIRS[dir], down = pitch < -0.61;
    const under = this.rampUnder(a, i0, k0, base);
    let level = base;
    if (under && under.edge === dir) level = under.level + 1; else if (up) level = base + 1;
    return { i: down ? i0 : i0 + dx, k: down ? k0 : k0 + dz, level, edge: dir };
  }
  previewFor(a, kindOverride) {
    const kind = kindOverride || a.buildPiece || 'wall';
    const t = this.target(a, kind);
    return this.evaluate(a, kind, t.i, t.k, t.level, t.edge);
  }
  // 驗證一個格位能否放置
  evaluate(a, kind, i, k, level, edge, noReach) {
    const T = this.ctx.terrain;
    if (kind === 'wall') [i, k, edge] = this.canon(i, k, edge);
    const key = this.keyOf(kind, i, k, level, edge), y0 = LEVEL * level;
    const px = kind === 'wall' ? (edge === 0 ? CELL * i + CELL / 2 : CELL * i) : CELL * i + CELL / 2, pz = kind === 'wall' ? (edge === 0 ? CELL * k : CELL * k + CELL / 2) : CELL * k + CELL / 2;
    const pv = { piece: kind, i, k, level, edge, dir: this.cardinal(a.yaw), valid: true, reason: '', key, center: new THREE.Vector3(px, y0 + (kind === 'floor' ? 0 : LEVEL / 2), pz), grounded: false };
    const st = this.ctx.match.state;
    if (st !== 'playing' && st !== 'ended') { pv.valid = false; pv.reason = 'state'; return pv; }
    if (a.inventory.mats[a.inventory.buildMat] < COST) { pv.valid = false; pv.reason = 'mats'; return pv; }
    if (!noReach && (Math.hypot(px - a.pos.x, pz - a.pos.z) > MAX_DIST || Math.abs(pv.center.y - a.pos.y) > MAX_DIST + 1.5)) { pv.valid = false; pv.reason = 'far'; return pv; }
    if (this.byKey.has(key)) { pv.valid = false; pv.reason = 'exists'; return pv; }
    // 埋入／水中／接地：只要有「有意義的一部分」在地面上就可以；完全埋入才無效
    // 牆至少要有 0.45 m 露出地面；地板／斜坡可以貼齊地面（和地形共面也算，Fortnite 允許），完全埋入才無效
    const visBias = kind === 'wall' ? -0.45 : kind === 'floor' ? 0.2 : -0.3;
    let vis = false, touch = false, wet = true;
    for (const [sx, sz, top, bot] of this.samples(kind, i, k, level, edge)) {
      const h = T.heightAt(sx, sz);
      if (h > 0.05) wet = false;
      if (h < top + visBias) vis = true;
      if (h >= bot - 0.35) touch = true;
    }
    if (wet) { pv.valid = false; pv.reason = 'water'; return pv; }
    if (!vis) { pv.valid = false; pv.reason = 'buried'; return pv; }
    pv.grounded = touch;
    if (!touch) {
      let sup = false;
      for (const jk of this.jointsOf(kind, i, k, level, edge)) { const s = this.joints.get(jk); if (s && s.size) { sup = true; break; } }
      if (!sup) { pv.valid = false; pv.reason = 'unsupported'; }
    }
    if (pv.valid && this.layers[kind].top - this.layers[kind].free.length >= CAP) { pv.valid = false; pv.reason = 'limit'; }
    return pv;
  }

  // ---- 放置 ----
  place(a, pvIn) {
    const pv = pvIn || this.previewFor(a);
    if (!pv || !pv.valid) return null;
    return this._create(a, pv);
  }
  // AI 用：直接指定格位（wall 的 edge 可用 0..3 方向）
  placeAt(a, spec) {
    const kind = spec.piece || a.buildPiece || 'wall';
    const pv = this.evaluate(a, kind, spec.i, spec.k, spec.level, spec.edge != null ? spec.edge : (spec.dir != null ? spec.dir : 0), !!spec.noReach);
    return pv.valid ? this._create(a, pv) : null;
  }
  _create(a, pv) {
    const inv = a.inventory, m = inv.buildMat;
    if (!inv.spendMat(m, COST)) return null;
    const { piece: kind, i, k, level, edge } = pv, now = this.ctx.time.now, md = MATS[m], layer = this.layers[kind];
    const slot = layer.alloc(); if (slot < 0) { inv.addMat(m, COST); return null; }
    const p = { id: this.nextId++, kind: 'build', type: kind, i, k, level, edge, dir: edge, mat: m, key: pv.key, maxHp: md.hp, hp: md.hp * 0.1, t: 0, dead: false, building: true, progress: 0.05, center: pv.center, grounded: !!pv.grounded, owner: a, builder: a, slot, hitT: -99, placeT: now, seed: Math.random() };
    p.joints = this.jointsOf(kind, i, k, level, edge);
    p.takeDamage = (amount, info) => this.damage(p, amount, info);
    this.xform(kind, i, k, level, edge, _p, _q); _m.compose(_p, _q, _one); layer.mesh.setMatrixAt(slot, _m); layer.mdirty = true;
    layer.set(slot, md.idx, p.progress, 0, -99, now, p.seed);
    const P = this.ctx.physics;
    if (kind === 'wall') { const ax = this.canon(i, k, edge)[2] === 0; p.col = P.addBox({ cx: pv.center.x, cy: pv.center.y, cz: pv.center.z, hx: ax ? CELL / 2 : 0.15, hy: LEVEL / 2, hz: ax ? 0.15 : CELL / 2, owner: p, kind: 'build' }); }
    else if (kind === 'floor') p.col = P.addBox({ cx: pv.center.x, cy: LEVEL * level - FLOOR_T / 2, cz: pv.center.z, hx: CELL / 2, hy: FLOOR_T / 2, hz: CELL / 2, owner: p, kind: 'build' });
    else p.col = P.addRamp({ cx: pv.center.x, cz: pv.center.z, y0: LEVEL * level, size: CELL, rise: LEVEL, dir: edge, thickness: 0.25, owner: p });
    this.pieces.set(p.id, p); this.byKey.set(p.key, p);
    for (const jk of p.joints) { let s = this.joints.get(jk); if (!s) this.joints.set(jk, (s = new Set())); s.add(p); }
    this.growing.add(p);
    if (a.stats) a.stats.builds++;
    a.view?.playOneShot('build');
    // 腳下被新地板／斜坡蓋住的角色會被抬上去
    if (kind !== 'wall') for (const o of this.ctx.actors) if (o.alive && (o.state === 'ground' || o.state === 'air') && Math.abs(o.pos.x - pv.center.x) < 3 && Math.abs(o.pos.z - pv.center.z) < 3) P.liftOnto?.(p.col, o.pos, 0.38, o.height, o.vel);
    this.ctx.events.emit('buildPlaced', { actor: a, piece: p });
    return p;
  }

  // ---- 受損／摧毀 ----
  damage(p, amount, info) {
    if (p.dead || amount <= 0) return;
    p.hp -= amount; p.hitT = this.ctx.time.now;
    this._sync(p);
    this.ctx.events.emit('buildDamaged', { piece: p, amount, source: (info && info.source) || null, point: (info && info.point) || null });
    if (p.hp <= 0) this.destroy(p, info && info.source);
  }
  _sync(p) {
    const f = p.building ? 0.1 + 0.9 * Math.min(1, p.t / MATS[p.mat].time) : 1;
    const dmg = clamp(1 - p.hp / (p.maxHp * f), 0, 1);
    this.layers[p.type].set(p.slot, MATS[p.mat].idx, p.building ? p.progress : 1, dmg, p.hitT, p.placeT, p.seed);
  }
  destroy(p, by, collapsed) {
    if (p.dead) return; p.dead = true;
    const C = this.ctx;
    C.physics.remove(p.col); this.layers[p.type].release(p.slot); this.growing.delete(p);
    this.pieces.delete(p.id); if (this.byKey.get(p.key) === p) this.byKey.delete(p.key);
    for (const jk of p.joints) { const s = this.joints.get(jk); if (s) { s.delete(p); if (!s.size) this.joints.delete(jk); } }
    // 碎片
    const c = p.center, sz = p.type === 'wall' ? _v.set(3.6, 3.2, 0.4) : p.type === 'floor' ? _v.set(3.6, 0.3, 3.6) : _v.set(3.4, 3, 3.4);
    this.debris.burst(p.type === 'floor' ? { x: c.x, y: c.y - FLOOR_T / 2, z: c.z } : c, sz, MATS[p.mat].idx, p.type === 'wall' ? 16 : 14, by && by.pos ? by.pos : null);
    // 玩家附近的崩塌／摧毀輕微震動
    const pl = C.player;
    if (pl && C.cam && C.cam.shake) { const d = Math.hypot(pl.pos.x - c.x, pl.pos.z - c.z); if (d < 32) C.cam.shake((collapsed ? 0.3 : 0.2) * (1 - d / 32) + 0.04, collapsed ? 0.3 : 0.22); }
    C.events.emit('buildDestroyed', { piece: p, by: by || null, collapsed: !!collapsed });
    this.checkSupport(c);
  }
  // BFS：從接地建材出發，找出懸空者，由近到遠依序崩落
  checkSupport(origin) {
    const seen = new Set(), q = [];
    for (const p of this.pieces.values()) if (p.grounded && !p.collapsing) { seen.add(p); q.push(p); }
    while (q.length) {
      const p = q.pop();
      for (const jk of p.joints) { const s = this.joints.get(jk); if (s) for (const n of s) if (!seen.has(n) && !n.collapsing) { seen.add(n); q.push(n); } }
    }
    const loose = [];
    for (const p of this.pieces.values()) if (!seen.has(p) && !p.collapsing) loose.push(p);
    if (!loose.length) return;
    if (origin) loose.sort((a, b) => a.center.distanceToSquared(origin) - b.center.distanceToSquared(origin));
    const now = this.ctx.time.now;
    loose.forEach((p, n) => { p.collapsing = true; this.collapse.push({ p, at: now + 0.3 + Math.min(1.5, 0.06 * n) }); });
  }

  // ---- 每個固定步 ----
  fixedUpdate(dt) {
    const now = this.ctx.time.now;
    for (const p of this.growing) {
      const md = MATS[p.mat]; p.t += dt;
      const f = Math.min(1, p.t / md.time);
      p.hp = Math.min(p.maxHp, p.hp + (p.maxHp * 0.9 / md.time) * dt);
      p.progress = 0.05 + 0.95 * f;
      if (f >= 1) { p.building = false; p.progress = 1; this.growing.delete(p); this.ctx.events.emit('buildComplete', { piece: p }); }
      this._sync(p);
    }
    for (let i = this.collapse.length - 1; i >= 0; i--) if (this.collapse[i].at <= now) { const c = this.collapse.splice(i, 1)[0]; if (!c.p.dead) this.destroy(c.p, null, true); }
    const st = this.ctx.match.state, canBuild = st === 'playing' || st === 'ended';
    for (const a of this.ctx.actors) {
      if (!a.alive) continue;
      const I = a.intent, bs = a._bs || (a._bs = { cd: 0, held: false });
      bs.cd = Math.max(0, bs.cd - dt);
      if (a.state !== 'ground' && a.state !== 'air') { a.building = false; bs.held = false; continue; }
      if (I.buildToggle) a.building = !a.building;
      if (I.buildPiece) { a.building = true; a.buildPiece = I.buildPiece; }
      if (!a.building) { bs.held = false; continue; }
      if (I.buildCycleMaterial) a.inventory.buildMat = MAT_ORDER[(MAT_ORDER.indexOf(a.inventory.buildMat) + 1) % 3];
      if (!I.buildPlace) { bs.held = false; continue; }
      // turbo：按下瞬間（或剛換了建材種類）立刻放；按住同一種時每 0.12 s 放一次（目標沒變 → 已存在 → 自然無效）
      const fresh = !bs.held || bs.piece !== a.buildPiece;
      bs.held = true;
      if (!canBuild || bs.cd > (fresh ? 0.06 : 0)) continue;
      if (this.place(a)) { bs.cd = TURBO_DT; bs.piece = a.buildPiece; }
    }
  }

  // ---- 每幀（顯示） ----
  update(dt) {
    const C = this.ctx;
    this.U.time.value = C.time.now; this.U.clock.value = performance.now() / 1000;
    this.debris.update(dt);
    for (const k of KINDS) this.layers[k].flush();
    const a = C.player;
    for (const k of KINDS) this.ghost[k].mesh.visible = false;
    this.preview = null;
    if (!a || !a.alive || !a.building || (a.state !== 'ground' && a.state !== 'air')) { for (const k of KINDS) this.ghost[k].shown = false; return; }
    const pv = this.previewFor(a), g = this.ghost[pv.piece];
    for (const k of KINDS) if (k !== pv.piece) this.ghost[k].shown = false;
    this.xform(pv.piece, pv.i, pv.k, pv.level, pv.edge, _p, _q);
    const kk = 1 - Math.exp(-32 * dt);
    if (!g.shown) { g.pos.copy(_p); g.quat.copy(_q); g.shown = true; } else { g.pos.lerp(_p, kk); g.quat.slerp(_q, kk); }
    g.mesh.position.copy(g.pos); g.mesh.quaternion.copy(g.quat);
    const tc = pv.valid ? this.colOk : (pv.reason === 'exists' ? this.colOcc : this.colBad);
    g.col.lerp(tc, 1 - Math.exp(-16 * dt));
    const u = g.mesh.material.uniforms; u.uCol.value.copy(g.col);
    if (g.key !== pv.key) { g.key = pv.key; u.uPulse.value = 1; }
    u.uPulse.value = Math.max(0, u.uPulse.value - dt * 5);
    g.mesh.visible = true; this.preview = pv;
  }
  // HUD：準心指到的建材（用來顯示 HP 條）
  hovered(a) {
    const C = this.ctx, fr = C.time.frame;
    if (a === C.player && this.hoverCache.frame === fr) return this.hoverCache.piece;
    let o, d;
    if (a === C.player && C.camera) { o = C.camera.position; d = C.camera.getWorldDirection(_D); } else { o = a.eyePos(_E); d = a.forward(_D); }
    const h = C.physics.raycast(o, d, HOVER_RANGE + 6, {});
    const ow = h && h.owner && h.owner.kind === 'build' && !h.owner.dead ? h.owner : null;
    const piece = ow && Math.hypot(h.point.x - a.pos.x, h.point.z - a.pos.z) <= HOVER_RANGE ? ow : null;
    if (a === C.player) this.hoverCache = { frame: fr, piece };
    return piece;
  }
  stats() { return { pieces: this.pieces.size, growing: this.growing.size, collapsing: this.collapse.length }; }
  reset() {
    for (const p of this.pieces.values()) { p.dead = true; this.ctx.physics.remove(p.col); }
    this.pieces.clear(); this.byKey.clear(); this.joints.clear(); this.growing.clear(); this.collapse = [];
    for (const k of KINDS) { this.layers[k].clear(); this.layers[k].flush(); this.ghost[k].shown = false; this.ghost[k].mesh.visible = false; }
    this.debris.clear(); this.preview = null;
    for (const a of this.ctx.actors) if (a._bs) { a._bs.cd = 0; a._bs.held = false; }
  }
}
