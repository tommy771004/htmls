// 地上戰利品、寶箱、死亡掉落。畫面物件只在玩家附近才建立（最近 N 個，模型與光柱群組放進池重複使用）。
// 公開 API：
//   nearestPickup(actor) / nearest(actor) -> null | { kind:'pickup'|'chest', item, dist, pickup?, chest?, replaces? }
//     replaces = 背包已滿時按 E 會被換掉的手上物品（給 HUD 顯示「換掉」）
//   nearestChest(pos, maxD = 60) -> null | { chest, dist }（給 audio 做寶箱附近的閃亮聲）
//   spawn(item, pos, opts) / drop(item, from, dir, speed)（弧線拋出）/ openChest(actor, chest)
// 事件：'pickup'、'chestOpen'、'inventoryFull'
import * as THREE from 'three';
import { RARITY, randomLoot, chestLoot, makeItem, itemName, itemColor, AMMO_COLORS, WEAPONS } from './items.js';
import { BoxBatch, vcMat } from './geo.js';

const SHOW_R = 62, MAX_FULL = 30, BEACON_R = 150, MAX_BEACON = 8, MAX_CHEST = 8;
const PICK_R = 2.6, AUTO_R = 1.7, CHEST_R = 2.6, OPEN_T = 1.4, LID_OPEN = 1.95;
const GRAV = 18;
const _v = new THREE.Vector3();

// ---------- 光柱＋地面光環（單一 draw call） ----------
const GLOW_V = `attribute vec3 aP; varying vec3 vP; varying float vF;
void main(){ vP = aP; vec4 p4 = vec4(position,1.0); vec3 nn = normal;
  #ifdef USE_INSTANCING
  p4 = instanceMatrix * p4; nn = mat3(instanceMatrix) * nn;
  #endif
  vec4 mv = modelViewMatrix*p4; gl_Position = projectionMatrix*mv;
  vec3 n = normalize(normalMatrix*nn); vF = abs(dot(n, normalize(-mv.xyz))); }`;
const GLOW_F = `uniform vec3 uColor; uniform float uInt; uniform float uTime; varying vec3 vP; varying float vF;
void main(){
  float a, k = (vP.x < 0.5) ? min(uInt, 1.15) : uInt;
  if (vP.x < 0.5) { float h = vP.y; a = pow(1.0 - h, 1.6) * 0.5 * pow(vF, 1.3) * (0.88 + 0.12 * sin(uTime * 2.2 + h * 7.0)); a *= smoothstep(0.0, 0.03, h); }
  else { float r = vP.z; float ring = exp(-pow((r - 0.8) / 0.13, 2.0)); a = ring * 0.95 + (1.0 - r) * 0.45; a *= 0.85 + 0.15 * sin(uTime * 3.0); }
  gl_FragColor = vec4(uColor * k, clamp(a, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
function glowGeometry(H, ringOnly) {
  const pos = [], nor = [], aP = [], idx = [];
  if (!ringOnly) {
    const N = 14, rb = 0.34, rt = 0.1;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(c * rb, 0, s * rb, c * rt, H, s * rt); nor.push(c, 0.2, s, c, 0.2, s); aP.push(0, 0, 0, 0, 1, 0);
      if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    }
  }
  const base = pos.length / 3, M = 28;
  pos.push(0, 0.03, 0); nor.push(0, 1, 0); aP.push(1, 0, 0);
  for (let i = 0; i < M; i++) { const a = (i / M) * Math.PI * 2; pos.push(Math.cos(a) * 0.95, 0.03, Math.sin(a) * 0.95); nor.push(0, 1, 0); aP.push(1, 0, 1); }
  for (let i = 0; i < M; i++) idx.push(base, base + 1 + i, base + 1 + ((i + 1) % M));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('aP', new THREE.Float32BufferAttribute(aP, 3));
  g.setIndex(idx); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, H * 0.5, 0), Math.max(H, 2));
  return g;
}

// ---------- 後備模型（characters.itemModel 不存在時） ----------
const fbCache = new Map();
function fallbackGeo(item) {
  const key = item.kind === 'weapon' ? item.defId + item.rarity : item.defId;
  let g = fbCache.get(key); if (g) return g;
  const b = new BoxBatch(), id = item.defId;
  if (item.kind === 'weapon') {
    const rc = RARITY[item.rarity].color;
    b.add(0, 0, -0.25, 0.04, 0.06, 0.3, '#2b2f3a'); b.add(0, 0, -0.62, 0.015, 0.015, 0.2, '#5a6270'); b.add(0, -0.1, -0.2, 0.025, 0.07, 0.04, rc);
  } else if (id === 'bandage') { b.add(0, 0.1, 0, 0.14, 0.1, 0.14, '#f4f4f0'); b.add(0, 0.1, 0, 0.145, 0.03, 0.145, '#e8e4d4'); b.add(0, 0.21, 0, 0.08, 0.015, 0.02, '#e83a3a'); b.add(0, 0.21, 0, 0.02, 0.016, 0.08, '#e83a3a'); }
  else if (id === 'medkit') { b.add(0, 0.14, 0, 0.22, 0.14, 0.15, '#f6f6f2'); b.add(0, 0.14, -0.155, 0.1, 0.05, 0.01, '#e83a3a'); b.add(0, 0.14, -0.155, 0.03, 0.1, 0.011, '#e83a3a'); b.add(0, 0.3, 0, 0.1, 0.02, 0.02, '#6a727c'); }
  else if (id === 'minishield') { b.add(0, 0.12, 0, 0.07, 0.12, 0.07, '#4aa8ff'); b.add(0, 0.28, 0, 0.035, 0.04, 0.035, '#bfe6ff'); b.add(0, 0.33, 0, 0.04, 0.02, 0.04, '#6a727c'); }
  else if (id === 'shield') { b.add(0, 0.15, 0, 0.1, 0.15, 0.1, '#3a8bff'); b.add(0, 0.34, 0, 0.05, 0.05, 0.05, '#9fe0ff'); b.add(0, 0.41, 0, 0.055, 0.025, 0.055, '#6a727c'); b.add(0, 0.15, -0.101, 0.05, 0.05, 0.005, '#bfe6ff'); }
  else if (id.startsWith('ammo_')) { const c = AMMO_COLORS[id.slice(5)]; b.add(0, 0.1, 0, 0.18, 0.1, 0.12, '#3f7a3a'); b.add(0, 0.2, 0, 0.19, 0.015, 0.13, '#2e5a2a'); b.add(0, 0.12, -0.122, 0.12, 0.04, 0.005, c); for (let i = -1; i <= 1; i++) b.add(i * 0.07, 0.24, 0, 0.022, 0.05, 0.022, '#e0b040'); }
  else if (id === 'mat_wood') { for (let i = 0; i < 3; i++) b.add(0, 0.05 + i * 0.1, 0, 0.26 - i * 0.02, 0.045, 0.06, i % 2 ? '#d9984a' : '#c4803a', i * 0.35); }
  else if (id === 'mat_stone') { b.add(0, 0.11, 0, 0.16, 0.11, 0.14, '#9fb0c6'); b.add(0.12, 0.07, 0.08, 0.1, 0.07, 0.09, '#8696ae', 0.5); b.add(-0.1, 0.18, -0.02, 0.09, 0.08, 0.08, '#b4c4d8', 0.9); }
  else { b.add(0, 0.05, 0, 0.2, 0.05, 0.1, '#c9d3dc'); b.add(0, 0.15, 0, 0.17, 0.05, 0.09, '#dfe6ee'); b.add(0, 0.25, 0, 0.14, 0.05, 0.08, '#b0bac6'); }
  g = b.geometry(); fbCache.set(key, g); return g;
}

// ---------- 寶箱幾何 ----------
function chestGeos() {
  const GOLD = '#ffcf3d', GL = '#fff0a0', W1 = '#c26a1e', W2 = '#9a4e12';
  const base = new BoxBatch();
  base.add(0, 0.26, 0, 0.55, 0.26, 0.36, W1);
  base.add(0, 0.12, -0.365, 0.54, 0.02, 0.005, W2); base.add(0, 0.28, -0.365, 0.54, 0.02, 0.005, W2); base.add(0, 0.42, -0.365, 0.54, 0.02, 0.005, W2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) base.add(sx * 0.53, 0.26, sz * 0.34, 0.045, 0.27, 0.045, GOLD);
  base.add(0, 0.03, 0, 0.58, 0.035, 0.39, GOLD); base.add(0, 0.5, 0, 0.5, 0.02, 0.32, '#ffe58a'); base.add(0, 0.515, 0, 0.44, 0.012, 0.27, '#fff6c0');
  const lid = new BoxBatch();   // 原點在鉸鏈（後上緣），蓋子往 -Z 延伸
  lid.add(0, 0.09, -0.36, 0.56, 0.09, 0.37, W1); lid.add(0, 0.21, -0.36, 0.5, 0.05, 0.33, W1); lid.add(0, 0.27, -0.36, 0.38, 0.02, 0.28, W2);
  lid.add(0, 0.12, -0.11, 0.575, 0.15, 0.03, GOLD); lid.add(0, 0.12, -0.62, 0.575, 0.15, 0.03, GOLD);
  lid.add(0, 0.02, -0.745, 0.09, 0.09, 0.02, GOLD); lid.add(0, 0.0, -0.765, 0.04, 0.045, 0.012, '#6df0ff'); lid.add(0, 0.3, -0.36, 0.1, 0.03, 0.1, GL);
  return { base: base.geometry(), lid: lid.geometry() };
}

export class Loot {
  constructor(ctx) {
    this.ctx = ctx; this.pickups = []; this.chests = []; this.flying = [];
    this.group = new THREE.Group(); ctx.scene.add(this.group);
    this.uTime = { value: 0 };
    // 光柱素材：0..4 稀有度、5 彈藥、6 寶箱、7 材料（只有光環）
    this.glowGeos = { r: RARITY.map((r) => glowGeometry(r.beam, false)), ammo: glowGeometry(1.7, false), chest: glowGeometry(9, false), ring: glowGeometry(0, true) };
    const mk = (hex, k) => new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(hex) }, uInt: { value: k }, uTime: this.uTime }, vertexShader: GLOW_V, fragmentShader: GLOW_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.glowMats = [...RARITY.map((r) => mk(r.hex, r.glow)), mk(0x6be04a, 0.9), mk(0xffc93a, 2.2), mk(0xe8e0c8, 0.5)];
    // 光柱／光環：每種樣式一個 InstancedMesh（全部可見拾取物＋寶箱共 8 個 draw call 以內）
    const geos = [...this.glowGeos.r, this.glowGeos.ammo, this.glowGeos.chest, this.glowGeos.ring];
    this.glowIM = geos.map((g, i) => { const im = new THREE.InstancedMesh(g, this.glowMats[i], 56); im.count = 0; im.frustumCulled = false; im.renderOrder = 2; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(im); return im; });
    this._gm = new THREE.Matrix4(); this._gs = new THREE.Vector3(); this._gs2 = new THREE.Vector3(); this._gq = new THREE.Quaternion();
    const cg = chestGeos();
    this.chestBaseGeo = cg.base; this.chestLidGeo = cg.lid;
    this.chestMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.3, emissive: 0x4a2c00, emissiveIntensity: 0.7 });
    this.tpl = new Map(); this.pool = new Map(); this.chestPool = [];
    this.clock = 0; this.scanT = 0; this.sparkT = 0; this._cand = []; this._stamp = 0;
    ctx.events.on('eliminated', ({ victim }) => this.dropFrom(victim));
  }
  // 清空所有拾取物與寶箱（reset 與測試用）
  clear() {
    for (const p of this.pickups) this._release(p);
    for (const c of this.chests) this._releaseChest(c);
    this.pickups = []; this.chests = []; this.flying = [];
    if (this.glowIM) for (const im of this.glowIM) im.count = 0;
  }
  reset() {
    this.clear();
    const rng = this.ctx.rng, W = this.ctx.world;
    for (const s of W.lootSpots) {
      const it = randomLoot(rng, { inside: s.inside, poi: !!s.poi });
      this.spawn(it, _v.set(s.x, s.y, s.z));
      if (it.kind === 'weapon' && rng() < 0.65) this.spawn(makeItem('ammo_' + WEAPONS[it.defId].ammo), _v.set(s.x + 0.7, s.y, s.z + 0.5));
      else if (s.inside && rng() < 0.3) this.spawn(randomLoot(rng, { inside: true, poi: !!s.poi }), _v.set(s.x - 0.6, s.y, s.z + 0.4));
    }
    for (const c of W.chestSpots) this.chests.push({ x: c.x, y: c.y, z: c.z, yaw: c.yaw, opened: false, mesh: null, poi: c.poi, lidA: 0, lidV: 0, prog: 0 });
  }

  // ---------- 拾取物 ----------
  spawn(item, pos, opts) {
    const p = { item, pos: pos.clone(), mesh: null, ph: Math.random() * 6, fly: null, key: null };
    if (opts && opts.vel) { p.fly = { vx: opts.vel.x, vy: opts.vel.y, vz: opts.vel.z, b: 0 }; this.flying.push(p); }
    this.pickups.push(p); return p;
  }
  // 從 from 往 dir（水平方向，單位化）拋出 item
  drop(item, from, dir, speed = 2.4, up = 4.2) {
    return this.spawn(item, from, { vel: { x: (dir ? dir.x : 0) * speed, y: up, z: (dir ? dir.z : 0) * speed } });
  }
  dropFrom(victim) {
    const items = victim.inventory.dropAll(), n = Math.max(1, items.length), a0 = Math.random() * 6.28;
    const from = new THREE.Vector3(victim.pos.x, victim.pos.y + 1.0, victim.pos.z);
    items.forEach((it, i) => { const a = a0 + (i / n) * Math.PI * 2, sp = 1.8 + Math.random() * 1.5; this.spawn(it, from, { vel: { x: Math.cos(a) * sp, y: 3.5 + Math.random() * 2, z: Math.sin(a) * sp } }); });
  }
  _tpl(item) {
    const key = item.kind === 'weapon' ? item.defId + ':' + item.rarity : item.defId;
    let t = this.tpl.get(key); if (t) return t;
    let m = null; const ch = this.ctx.characters;
    try { m = item.kind === 'weapon' ? ch.weaponModel(item.defId, item.rarity) : ch.itemModel && ch.itemModel(item.defId, item.rarity); } catch (e) { m = null; }
    if (!m) { m = new THREE.Mesh(fallbackGeo(item), vcMat(0.6)); }
    m.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
    m.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    // 槍模型本來就是實際尺寸：地上只放大 1.1 倍（手槍太小時補到約 0.55 m）；其他物品約 0.3 m → ×1.2
    const mx = Math.max(s.x, s.y, s.z, 0.05), k = item.kind === 'weapon' ? Math.max(1.1, 0.55 / mx) : 1.2;
    const holder = new THREE.Group(); m.position.sub(c); holder.add(m); holder.scale.setScalar(k);
    t = { model: holder, half: s.y * k * 0.5 };
    this.tpl.set(key, t); return t;
  }
  _glowIdx(item) { return item.kind === 'ammo' ? 5 : item.kind === 'mats' ? 7 : item.rarity || 0; }
  _acquire(p, beaconOnly) {
    const it = p.item, gi = this._glowIdx(it);
    const key = (beaconOnly ? 'b:' : 'f:') + (it.kind === 'weapon' ? it.defId + ':' + it.rarity : it.defId);
    let g = null; const free = this.pool.get(key);
    if (free && free.length) g = free.pop();
    else {
      g = new THREE.Group(); g.userData.key = key;
      if (!beaconOnly) { const pivot = new THREE.Group(); const t = this._tpl(it); pivot.add(t.model.clone()); pivot.userData.half = t.half; g.add(pivot); g.userData.pivot = pivot; }
    }
    g.position.copy(p.pos); this.group.add(g); p.mesh = g; p.gi = gi; p.key = key; p.beacon = beaconOnly;
  }
  _release(p) {
    const g = p.mesh; if (!g) return;
    this.group.remove(g); let a = this.pool.get(p.key); if (!a) this.pool.set(p.key, (a = [])); if (a.length < 12) a.push(g);
    p.mesh = null;
  }
  _remove(p) {
    this._release(p); const i = this.pickups.indexOf(p); if (i >= 0) this.pickups.splice(i, 1);
    if (p.fly) { const j = this.flying.indexOf(p); if (j >= 0) this.flying.splice(j, 1); p.fly = null; }
  }

  // ---------- 互動查詢 ----------
  nearestPickup(a, maxD = PICK_R) {
    let best = null, bd = maxD;
    for (const p of this.pickups) {
      const k = p.item.kind; if (k === 'ammo' || k === 'mats') continue;
      const d = Math.hypot(p.pos.x - a.pos.x, p.pos.z - a.pos.z);
      if (d < bd && Math.abs(p.pos.y - a.pos.y) < 2.5) { bd = d; best = { kind: 'pickup', pickup: p, dist: d, item: p.item, chest: null, replaces: null }; }
    }
    for (const c of this.chests) {
      if (c.opened) continue;
      const d = Math.hypot(c.x - a.pos.x, c.z - a.pos.z);
      if (d < Math.min(bd, CHEST_R) && Math.abs(c.y - a.pos.y) < 2.5) { bd = d; best = { kind: 'chest', chest: c, dist: d, item: null, pickup: null, replaces: null }; }
    }
    if (best && best.kind === 'pickup') {
      const inv = a.inventory, it = best.item;
      if (!inv.hasSpace() && inv.selected > 0) {
        const stackable = it.kind === 'consumable' && inv.slots.some((s) => s && s.defId === it.defId);
        if (!stackable) best.replaces = inv.slots[inv.selected - 1];
      }
    }
    return best;
  }
  nearest(a, maxD) { return this.nearestPickup(a, maxD); }
  nearestChest(pos, maxD = 60) {
    let best = null, bd = maxD;
    for (const c of this.chests) { if (c.opened) continue; const d = Math.hypot(c.x - pos.x, c.z - pos.z); if (d < bd) { bd = d; best = { chest: c, dist: d }; } }
    return best;
  }
  pickup(a, p) {
    const inv = a.inventory, it = p.item;
    const r = inv.add(it);
    if (!r.added) { this.ctx.events.emit('inventoryFull', { actor: a }); return false; }
    if (r.swapped) {
      const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
      this.drop(r.swapped, _v.set(a.pos.x, a.pos.y + 0.9, a.pos.z), { x: fx, z: fz }, 2.2, 2.6);
    }
    if (it.kind === 'weapon' && inv.selected === 0 && !r.swapped) inv.selected = r.slot;
    if (r.remainder) this.ctx.events.emit('pickup', { actor: a, item: it, partial: true });   // 疊滿了，剩下的留在地上
    else { this._remove(p); this.ctx.events.emit('pickup', { actor: a, item: it }); }
    return true;
  }

  // ---------- 寶箱 ----------
  openChest(a, c) {
    if (c.opened) return;
    c.opened = true; c.prog = 0;
    const items = chestLoot(this.ctx.rng), n = items.length;
    const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
    items.forEach((it, i) => {
      const ang = (i / (n - 1) - 0.5) * 2.1 + (Math.random() - 0.5) * 0.25, ca = Math.cos(ang), sa = Math.sin(ang), sp = 2.4 + Math.random() * 1.2;
      this.spawn(it, _v.set(c.x, c.y + 0.55, c.z), { vel: { x: (fx * ca - fz * sa) * sp, y: 5.2 + Math.random() * 1.3, z: (fx * sa + fz * ca) * sp } });
    });
    const fxm = this.ctx.fx;
    if (fxm) {
      _v.set(c.x, c.y + 0.6, c.z);
      fxm.burst(_v, 0xffd75a, 22, 5.5, 0.1, 0.8, 7); fxm.ring(_v, 0xffe08a, 0.8, 4.2, 0.45); fxm.flash(_v, 0xfff0b0, 2.0, 0.2, 1); fxm.sparkle(_v, 0xfff0b0, 10, 0.9);
    }
    this.ctx.cam?.shake?.(0.08, 0.15);
    this.ctx.events.emit('chestOpen', { actor: a, chest: c });
  }
  _makeChest(c) {
    let g = this.chestPool.pop();
    if (!g) {
      g = new THREE.Group();
      const base = new THREE.Mesh(this.chestBaseGeo, this.chestMat); base.castShadow = true; g.add(base);
      const hinge = new THREE.Group(); hinge.position.set(0, 0.52, 0.36);
      const lid = new THREE.Mesh(this.chestLidGeo, this.chestMat); lid.castShadow = true; hinge.add(lid); g.add(hinge); g.userData.hinge = hinge;
    }
    g.position.set(c.x, c.y, c.z); g.rotation.y = c.yaw; g.scale.setScalar(1.25);
    c.lidA = c.opened ? LID_OPEN : 0; c.lidV = 0; g.userData.hinge.rotation.x = c.lidA;
    this.group.add(g); c.mesh = g;
  }
  _releaseChest(c) { if (c.mesh) { this.group.remove(c.mesh); if (this.chestPool.length < 10) this.chestPool.push(c.mesh); c.mesh = null; } }

  // ---------- 固定步 ----------
  fixedUpdate(dt) {
    const actors = this.ctx.actors, P = this.ctx.physics;
    // 拋出物的弧線
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const p = this.flying[i], f = p.fly;
      f.vy -= GRAV * dt; p.pos.x += f.vx * dt; p.pos.y += f.vy * dt; p.pos.z += f.vz * dt;
      const gy = P.groundHeight(p.pos.x, p.pos.z, p.pos.y + 0.6, 0.15).y;
      if (p.pos.y <= gy && f.vy < 0) {
        if (f.b < 1 && -f.vy > 3) { p.pos.y = gy; f.vy = -f.vy * 0.32; f.vx *= 0.5; f.vz *= 0.5; f.b++; }
        else { p.pos.y = gy; p.fly = null; this.flying.splice(i, 1); }
      }
      if (p.mesh) p.mesh.position.copy(p.pos);
    }
    for (const a of actors) {
      if (!a.alive || (a.state !== 'ground' && a.state !== 'air')) { a._pi = a.intent.interact; continue; }
      const I = a.intent;
      // 彈藥與材料自動撿取
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const p = this.pickups[i], k = p.item.kind;
        if ((k !== 'ammo' && k !== 'mats') || p.fly) continue;
        if (Math.abs(p.pos.x - a.pos.x) > AUTO_R || Math.abs(p.pos.z - a.pos.z) > AUTO_R) continue;
        if (Math.abs(p.pos.y - a.pos.y) < 2) { a.inventory.add(p.item); this._remove(p); this.ctx.events.emit('pickup', { actor: a, item: p.item }); }
      }
      const edge = I.interact && !a._pi; a._pi = I.interact;
      if (a.action && a.action.kind !== 'open') continue;
      const near = I.interact ? this.nearestPickup(a) : null;
      if (near && near.kind === 'chest') {
        const c = near.chest;
        if (!a.action) { a.action = { kind: 'open', t: 0, duration: OPEN_T, data: { chest: c } }; a.view?.playOneShot('open'); }
        else { a.action.data.chest = c; a.action.t += dt; if (a.action.t >= OPEN_T) { a.action = null; this.openChest(a, c); } }
        c.prog = a.action ? a.action.t / OPEN_T : 0; c.progT = this.clock;
      } else {
        if (a.action && a.action.kind === 'open') a.action = null;
        if (edge && near && near.kind === 'pickup') this.pickup(a, near.pickup);
      }
    }
  }

  // ---------- 每幀 ----------
  update(dt) {
    this.clock += dt; this.uTime.value = this.clock; this.scanT -= dt;
    const cam = this.ctx.camera.position;
    if (this.scanT <= 0) { this.scanT = 0.2; this._scan(cam); }
    // 浮動與旋轉
    const t = this.clock;
    for (const p of this.pickups) {
      const g = p.mesh; if (!g) continue;
      const pv = g.userData.pivot; if (!pv) continue;
      const half = pv.userData.half || 0.2;
      pv.position.y = 0.3 + half + Math.sin(t * 2 + p.ph) * 0.08;
      pv.rotation.y = t * 1.3 + p.ph;
    }
    // 寶箱：蓋子彈簧動畫、閃光
    this.sparkT -= dt; const sp = this.sparkT <= 0; if (sp) this.sparkT = 0.14;
    let sc = 0;
    for (const c of this.chests) {
      const g = c.mesh; if (!g) continue;
      const hinge = g.userData.hinge;
      let tgt = c.opened ? LID_OPEN : 0, shake = 0;
      if (!c.opened && c.prog > 0) { if (this.clock - (c.progT || 0) > 0.2) c.prog = 0; else { tgt = c.prog * 0.2; shake = Math.sin(t * 50) * 0.03 * c.prog; } }
      c.lidV += ((tgt - c.lidA) * 160 - c.lidV * 11) * dt; c.lidA += c.lidV * dt;
      if (c.lidA < 0) { c.lidA = 0; c.lidV = 0; }
      hinge.rotation.x = c.lidA + shake;
      if (sp && !c.opened && sc < 4 && this.ctx.fx) { const d = Math.hypot(c.x - cam.x, c.z - cam.z); if (d < 45) { _v.set(c.x, c.y + 0.5, c.z); this.ctx.fx.sparkle(_v, 0xffd75a, 2, 0.7); sc++; } }
    }
    this._glow();
  }
  // 每幀重寫光柱實例矩陣（拾取物在彈跳／飛行時位置會變）
  _glow() {
    const ims = this.glowIM, M = this._gm, S = this._gs, Q = this._gq;
    for (const im of ims) im.count = 0;
    const put = (i, x, y, z, k) => { const im = ims[i]; if (im.count >= 56) return; M.compose(S.set(x, y, z), Q, this._gs2.set(k, k, k)); im.setMatrixAt(im.count++, M); };
    for (const p of this.pickups) if (p.mesh) put(p.gi, p.pos.x, p.pos.y, p.pos.z, 1);
    for (const c of this.chests) if (c.mesh && !c.opened) put(6, c.x, c.y, c.z, 0.85 * 1.25);
    for (const im of ims) if (im.count) im.instanceMatrix.needsUpdate = true;
  }
  _scan(cam) {
    const cand = this._cand; cand.length = 0;
    const R2 = SHOW_R * SHOW_R, B2 = BEACON_R * BEACON_R;
    for (const p of this.pickups) {
      const dx = p.pos.x - cam.x, dz = p.pos.z - cam.z, d2 = dx * dx + dz * dz;
      if (d2 < R2) cand.push(p, d2, 0); else if (p.item.kind === 'weapon' && p.item.rarity >= 3 && d2 < B2) cand.push(p, d2, 1);
    }
    // 近的 MAX_FULL 個完整顯示（模型＋光柱），稀有武器遠處只顯示光柱
    const full = [], beac = [];
    for (let i = 0; i < cand.length; i += 3) (cand[i + 2] === 0 ? full : beac).push({ p: cand[i], d: cand[i + 1] });
    full.sort((a, b) => a.d - b.d); beac.sort((a, b) => a.d - b.d);
    const stamp = ++this._stamp;
    for (let i = 0; i < full.length && i < MAX_FULL; i++) { const p = full[i].p; p._st = stamp; if (!p.mesh || p.beacon) { if (p.mesh) this._release(p); this._acquire(p, false); } }
    for (let i = 0; i < beac.length && i < MAX_BEACON; i++) { const p = beac[i].p; p._st = stamp; if (!p.mesh) this._acquire(p, true); }
    for (const p of this.pickups) if (p.mesh && p._st !== stamp) this._release(p);
    // 寶箱
    const cs = []; for (const c of this.chests) { const d = Math.hypot(c.x - cam.x, c.z - cam.z); if (d < (c.opened ? 40 : SHOW_R + 10)) cs.push({ c, d }); }
    cs.sort((a, b) => a.d - b.d);
    const keep = new Set(); for (let i = 0; i < cs.length && i < MAX_CHEST; i++) { keep.add(cs[i].c); if (!cs[i].c.mesh) this._makeChest(cs[i].c); }
    for (const c of this.chests) if (c.mesh && !keep.has(c)) this._releaseChest(c);
  }
}
