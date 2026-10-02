// 角色（SPEC §8）。卡通英雄比例、單一蒙皮網格（剛性綁定，1 個 draw call）、程序動畫＋手臂 IK、手持武器、滑翔翼、數位化淘汰特效。
import * as THREE from 'three';
import { clamp, damp, hash2, lerp } from './shared.js';
import { BONES, BI, L1, L2, makeOutfit as bodyOutfit, makePlayerOutfit, bakeCharacter } from './chars-body.js';
import { makeWeapon, makeItem3D, makeGlider } from './chars-models.js';

const matChar = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 });
const TAU = Math.PI * 2, HIP0 = 0.89;
const JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'uArmL', 'fArmL', 'uArmR', 'fArmR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
const GUNS = { rifle: 1, smg: 1, shotgun: 1, sniper: 1, pistol: 1 };
// 持槍姿勢（chest 局部座標：x 右、y 上、z 後）
const HOLD = {
  rifle: { pos: [0.18, 0.04, -0.26], ads: [0.1, 0.27, -0.28], low: [0.1, -0.02, -0.2], lowPitch: -0.85 },
  smg: { pos: [0.18, 0.04, -0.25], ads: [0.1, 0.27, -0.27], low: [0.1, -0.02, -0.2], lowPitch: -0.8 },
  shotgun: { pos: [0.18, 0.04, -0.26], ads: [0.1, 0.27, -0.28], low: [0.1, -0.02, -0.2], lowPitch: -0.85 },
  sniper: { pos: [0.18, 0.04, -0.29], ads: [0.1, 0.27, -0.32], low: [0.1, -0.02, -0.24], lowPitch: -0.9 },
  pistol: { pos: [0.16, 0.1, -0.32], ads: [0.08, 0.29, -0.34], low: [0.1, 0.06, -0.28], lowPitch: -0.5 },
};
const easeOutBack = (x) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------- 兩節點解析 IK（在 chest 局部空間） ----------
const _u = new THREE.Vector3(), _p = new THREE.Vector3(), _Ek = new THREE.Vector3(), _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3(), _T2 = new THREE.Vector3();
const _qf = new THREE.Quaternion(), _qi = new THREE.Quaternion(), DOWN = new THREE.Vector3(0, -1, 0);
function solveArm(S, T, pole, qU, qF) {
  _u.subVectors(T, S); let dist = _u.length();
  if (dist < 1e-4) { _u.set(0, 0, -1); dist = 1e-4; } else _u.divideScalar(dist);
  const dd = clamp(dist, Math.abs(L1 - L2) + 0.03, (L1 + L2) * 0.997);
  const a = (L1 * L1 - L2 * L2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  _p.copy(pole).addScaledVector(_u, -pole.dot(_u));
  if (_p.lengthSq() < 1e-6) _p.set(0, -1, 0); _p.normalize();
  _Ek.copy(S).addScaledVector(_u, a).addScaledVector(_p, h);
  _d1.subVectors(_Ek, S).normalize(); qU.setFromUnitVectors(DOWN, _d1);
  _T2.copy(S).addScaledVector(_u, dd); _d2.subVectors(_T2, _Ek).normalize();
  _qf.setFromUnitVectors(DOWN, _d2); _qi.copy(qU).invert(); qF.copy(_qi).multiply(_qf);
}

export function createCharacterFactory(ctx) {
  const playerOutfit = makePlayerOutfit();
  const factory = {
    makeOutfit: (rng) => bodyOutfit(rng),
    playerOutfit,
    weaponModel: (defId, rarity = 0) => makeWeapon(defId, rarity, false),
    pickaxe: () => makeWeapon('pickaxe', 0, false),
    glider: (cols) => makeGlider(cols),
    itemModel: (defId, rarity = 0) => makeItem3D(defId, rarity),
    create(actor) {
      const o = actor.outfit || bodyOutfit(ctx.rng);
      actor.outfit = o;
      return new CharacterView(ctx, actor, o);
    },
  };
  // 事件 → 角色反應
  const ev = ctx.events;
  ev.on('shot', ({ actor }) => actor?.view?.kickNow?.());
  ev.on('damage', ({ target, amount, source }) => { if (amount > 0 && source && source !== target) target?.view?.playOneShot?.('hit'); }); // 風暴／摔傷（source 為 null）不顫動
  ev.on('land', ({ actor, speed }) => actor?.view?.landNow?.(speed ?? 8));
  ev.on('jump', ({ actor }) => actor?.view?.jumpNow?.());
  ev.on('mantle', ({ actor }) => actor?.view?.mantleNow?.());
  ev.on('matchState', ({ state }) => { if (state === 'bus' || state === 'menu') for (const a of ctx.actors) a.view?.resetAnim?.(); });
  return factory;
}

class CharacterView {
  constructor(ctx, actor, o) {
    this.ctx = ctx; this.actor = actor; this.o = o;
    const root = (this.root = new THREE.Group());
    ctx.scene.add(root);
    // 骨架
    const bones = BONES.map(([name, , rest]) => { const b = new THREE.Bone(); b.name = name; b.position.fromArray(rest); return b; });
    BONES.forEach(([, p], i) => { if (p < 0) root.add(bones[i]); else bones[p].add(bones[i]); });
    const b = (this.b = {}); BONES.forEach(([name], i) => (b[name] = bones[i]));
    const geo = bakeCharacter(o);
    const mesh = (this.mesh = new THREE.SkinnedMesh(geo, matChar));
    mesh.castShadow = true; mesh.receiveShadow = false;
    root.add(mesh); root.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.95, 0), 2.1);
    mesh.boundingBox = new THREE.Box3(new THREE.Vector3(-1.6, -0.3, -1.6), new THREE.Vector3(1.6, 2.2, 1.6));
    // 掛點
    this.gunPivot = new THREE.Object3D(); b.chest.add(this.gunPivot);
    this.handR = new THREE.Object3D(); this.handR.position.set(0, -0.32, 0); b.fArmR.add(this.handR);
    this.handL = new THREE.Object3D(); this.handL.position.set(0, -0.32, 0); b.fArmL.add(this.handL);
    this.glider = makeGlider(o.glider); this.glider.visible = false; root.add(this.glider);
    // 動畫狀態
    this.cur = {}; this.tgt = {}; JOINTS.forEach((j) => { this.cur[j] = [0, 0, 0]; this.tgt[j] = [0, 0, 0]; });
    this.phase = hash2(actor.id, 7) * TAU; this.t = hash2(actor.id, 3) * 20;
    this.gaitW = 0; this.adsW = 0; this.lowW = 0; this.armW = 0; this.dv = 0; this.aw = 0; this.cw = 0;
    this.ikR = 0; this.ikL = 0; this.modeR = 0; this.modeL = 0; this.offR = new THREE.Vector3(); this.offL = new THREE.Vector3();
    this.tR = new THREE.Vector3(); this.tL = new THREE.Vector3(); this.finR = new THREE.Vector3(); this.finL = new THREE.Vector3();
    this.landT = 9; this.landAmp = 0; this.jumpT = 9; this.mantleT = 9; this.hitT = 9; this.hitSign = 1; this.kick = 0; this.swingT = -1; this.buildT = -1; this.drawT = 1;
    this.glideT = 0; this.gOpen = 0; this.yawPrev = actor.yaw; this.yawRate = 0; this.tailAng = 0; this.rollSm = 0; this.pitchSm = 0;
    this.visible = true; this.skip = 0; this.emote = false; this.emoteOnce = 0; this.bits = null;
    this.held = null; this.heldKey = ''; this.heldKind = ''; this.hold = null;
    this.qUfk = new THREE.Quaternion(); this.qFfk = new THREE.Quaternion(); this.qUik = new THREE.Quaternion(); this.qFik = new THREE.Quaternion();
    this.shL = b.shL; this.shR = b.shR;
    this.poleR = new THREE.Vector3(0.45, -1, 0.3).normalize(); this.poleL = new THREE.Vector3(-0.45, -1, 0.3).normalize();
    this.root.visible = false;
  }

  // ---------- 外部介面 ----------
  setVisible(v) { this.visible = v; this.root.visible = v; if (v && this.bits) this.clearBits(); }
  resetAnim() { this.emote = false; this.emoteOnce = 0; this.kick = 0; this.hitT = 9; this.swingT = -1; this.glideT = 0; this.gOpen = 0; this.glider.visible = false; if (this.bits) this.clearBits(); }
  playOneShot(name) {
    if (name === 'pickaxe') this.swingT = 0;
    else if (name === 'hit') { this.hitT = 0; this.hitSign = Math.random() < 0.5 ? -1 : 1; }
    else if (name === 'build') this.buildT = 0;
    else if (name === 'emote') this.emoteOnce = 4;
    else if (name === 'reload') this.kick += 0.15;
  }
  kickNow() { this.kick = 1; }
  landNow(speed) { this.landT = 0; this.landAmp = clamp(speed / 16, 0.3, 1); }
  jumpNow() { this.jumpT = 0; }
  mantleNow() { this.mantleT = 0; }
  muzzleWorld(out) {
    const m = this.held && this.held.userData.muzzle;
    if (m && this.gunHeld) { this.root.updateMatrixWorld(true); return m.getWorldPosition(out); }
    // 後備：腰前一點
    const a = this.actor, s = Math.sin(a.yaw), c = Math.cos(a.yaw);
    return out.set(a.pos.x - s * 0.7 + c * 0.2, a.pos.y + 1.3, a.pos.z - c * 0.7 - s * 0.2);
  }
  handWorld(out) { this.root.updateMatrixWorld(true); return this.handR.getWorldPosition(out); }

  // ---------- 數位化淘汰 ----------
  eliminate() {
    this.root.visible = false; this.clearBits();
    const N = 120, a = this.actor;
    this.root.position.copy(a.pos); this.root.updateMatrixWorld(true); this.mesh.skeleton.update();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, depthWrite: false, toneMapped: false });
    const im = new THREE.InstancedMesh(geo, mat, N); im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const items = [], pos = new THREE.Vector3(), col = this.mesh.geometry.attributes.color, cc = new THREE.Color(), glow = new THREE.Color('#6ff3ff');
    const vc = this.mesh.geometry.attributes.position.count;
    for (let i = 0; i < N; i++) {
      const vi = Math.floor(Math.random() * vc);
      this.mesh.getVertexPosition(vi, pos); pos.applyMatrix4(this.mesh.matrixWorld);
      cc.setRGB(col.getX(vi), col.getY(vi), col.getZ(vi)).lerp(glow, 0.55).multiplyScalar(1.0);
      im.setColorAt(i, cc);
      const hgt = clamp((pos.y - a.pos.y) / 1.8, 0, 1);
      items.push({ x: pos.x, y: pos.y, z: pos.z, vx: (Math.random() - 0.5) * 0.9, vy: 0.6 + Math.random() * 1.6 + hgt * 0.5, vz: (Math.random() - 0.5) * 0.9, s: 0.05 + Math.random() * 0.06, rx: Math.random() * TAU, ry: Math.random() * TAU, sp: (Math.random() - 0.5) * 8, d: Math.random() * 0.25 + (1 - hgt) * 0.12, w: Math.random() * TAU });
    }
    // 腳下擴散光環
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.55, 28), new THREE.MeshBasicMaterial({ color: 0x3fe6ff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(a.pos.x, a.pos.y + 0.06, a.pos.z);
    const g = new THREE.Group(); g.add(im, ring); this.ctx.scene.add(g);
    this.bits = { g, im, ring, items, t: 0, geo, mat };
    this._stepBits(0);
  }
  _stepBits(dt) {
    const B = this.bits; if (!B) return; B.t += dt;
    const m4 = _m4, q = _q4, e = _e4, s = _s4, p = _p4, LIFE = 1.25;
    B.items.forEach((it, i) => {
      const lt = Math.max(0, B.t - it.d);
      const x = it.x + it.vx * lt + Math.sin(lt * 3 + it.w) * 0.12 * lt, y = it.y + it.vy * lt - 0.4 * lt * lt * 0, z = it.z + it.vz * lt + Math.cos(lt * 3 + it.w) * 0.12 * lt;
      const k = lt <= 0 ? 1 : easeOutBack(clamp(lt / 0.12, 0, 1)) * (1 - sstep(0.55, LIFE - it.d, lt));
      e.set(it.rx + it.sp * lt, it.ry + it.sp * 0.7 * lt, 0); q.setFromEuler(e);
      m4.compose(p.set(x, y, z), q, s.setScalar(Math.max(0.0001, it.s * k)));
      B.im.setMatrixAt(i, m4);
    });
    B.im.instanceMatrix.needsUpdate = true;
    B.mat.opacity = clamp(1 - sstep(0.8, LIFE, B.t), 0, 1);
    const rt = B.t / 0.9; B.ring.scale.setScalar(1 + rt * 2.2); B.ring.material.opacity = 0.8 * clamp(1 - rt, 0, 1);
    if (B.t > LIFE) this.clearBits();
  }
  clearBits() {
    if (!this.bits) return; const B = this.bits;
    this.ctx.scene.remove(B.g); B.geo.dispose(); B.mat.dispose(); B.ring.geometry.dispose(); B.ring.material.dispose(); B.im.dispose(); this.bits = null;
  }
  dispose() { this.clearBits(); this.ctx.scene.remove(this.root); this.mesh.geometry.dispose(); this.mesh.skeleton.dispose(); }

  // ---------- 每幀 ----------
  update(dt, actor) {
    if (this.bits) this._stepBits(dt);
    const show = actor.alive && actor.state !== 'bus' && this.visible;
    this.root.visible = show;
    if (!show) return;
    const cam = this.ctx.camera.position, d = Math.hypot(cam.x - actor.pos.x, cam.z - actor.pos.z);
    actor.visPos ? actor.visPos(this.root.position) : this.root.position.copy(actor.pos);
    this.root.rotation.y = actor.yaw;
    this.mesh.castShadow = d < 90;
    if (d > 260) return;
    let adt = dt;
    if (d > 120) { if (++this.skip % 3 !== 0) return; adt = dt * 3; }
    this.animate(adt, actor);
  }

  _setHeld(a) {
    const it = a.inventory.current();
    const st = a.state;
    const hide = st === 'glide' || st === 'skydive' || a.building || this.emote || this.emoteOnce > 0 || !it || (a.action && a.action.kind === 'open');
    const key = hide ? '' : `${it.kind}:${it.defId}:${it.rarity}`;
    if (key === this.heldKey) return;
    this.heldKey = key;
    if (this.held) { this.held.parent && this.held.parent.remove(this.held); this.held = null; }
    this.gunHeld = false; this.hold = null; this.heldKind = '';
    if (!key) return;
    if (it.kind === 'weapon' && it.defId !== 'pickaxe') {
      const m = makeWeapon(it.defId, it.rarity, true);
      this.gunPivot.add(m); this.held = m; this.gunHeld = true; this.hold = m.userData.hold; this.heldKind = 'gun'; this.drawT = 0;
    } else if (it.defId === 'pickaxe') {
      const m = makeWeapon('pickaxe', 0, false); m.rotation.x = -Math.PI / 2 + 0.1; m.position.set(0, -0.1, 0); m.scale.setScalar(0.85); this.handR.add(m); this.held = m; this.heldKind = 'axe'; this.drawT = 0;
    } else if (it.kind === 'consumable') {
      const m = makeItem3D(it.defId); this.handR.add(m); this.held = m; this.heldKind = 'item'; this.drawT = 0; m.scale.setScalar(1.0);
    }
  }

  animate(dt, a) {
    const T = this.tgt, C = this.cur, b = this.b, t = (this.t += dt);
    for (const j of JOINTS) { const q = T[j]; q[0] = q[1] = q[2] = 0; }
    this._setHeld(a);
    const st = a.state, ground = st === 'ground', skydive = st === 'skydive', glide = st === 'glide', air = st === 'air';
    const sp = Math.hypot(a.vel.x, a.vel.z), n = clamp(sp / 6.4, 0, 1.15), vy = a.vel.y;
    const crouch = !!a.crouching && ground, sprint = !!a.sprinting && sp > 3 && ground;
    const act = a.action, actKind = act ? act.kind : '';
    const emote = (this.emote || this.emoteOnce > 0) && !skydive && !glide;
    if (this.emoteOnce > 0) this.emoteOnce -= dt;
    const gun = this.gunHeld && !emote;
    const pitch = clamp(a.pitch, -1.25, 1.25);
    this.yawRate = damp(this.yawRate, clamp(angDiff(this.yawPrev, a.yaw) / Math.max(dt, 1e-3), -6, 6), 8, dt); this.yawPrev = a.yaw;
    const ads = !!a.intent.ads && ground;
    // 權重
    this.adsW = damp(this.adsW, ads ? 1 : 0, 14, dt);
    this.lowW = damp(this.lowW, sprint && !ads ? 1 : 0, 9, dt);
    this.cw = damp(this.cw, crouch ? 1 : 0, 12, dt);
    this.aw = damp(this.aw, air ? 1 : 0, 14, dt);
    const dive = skydive ? clamp(-a.pitch / 1.1, 0, 1) : 0;
    this.dv = damp(this.dv, dive, 5, dt);
    this.gaitW = damp(this.gaitW, ground && sp > 0.3 ? 1 : 0, 11, dt);
    if (ground && sp > 0.3) {
      const L = 2.0 + 1.1 * n; this.phase = (this.phase + (sp * dt / L) * TAU) % (TAU * 8);
    }
    this.landT += dt; this.jumpT += dt; this.hitT += dt; this.drawT = Math.min(1, this.drawT + dt * 5); this.kick = Math.max(0, this.kick - dt * 9 * (0.4 + this.kick));
    const landE = this.landT < 0.5 ? this.landAmp * (this.landT < 0.06 ? this.landT / 0.06 : Math.exp(-(this.landT - 0.06) * 9)) : 0;
    const jumpE = this.jumpT < 0.3 ? Math.sin((this.jumpT / 0.3) * Math.PI) : 0;
    const hitE = this.hitT < 0.4 ? Math.exp(-this.hitT * 12) * Math.sin(Math.min(1, this.hitT / 0.05) * Math.PI / 2) : 0;
    const idleW = 1 - this.gaitW;

    // ---- 基礎姿勢 ----
    if (skydive) {
      const dv = this.dv;
      T.hips[0] = -Math.PI / 2 - dv * 1.0; T.hips[1] = clamp(-(a.bank || 0) * 0.8, -0.6, 0.6);
      T.uArmL[2] = lerp(-1.25, -0.22, dv); T.uArmR[2] = lerp(1.25, 0.22, dv); T.uArmL[0] = lerp(0.55, -0.35, dv); T.uArmR[0] = lerp(0.55, -0.35, dv);
      T.fArmL[0] = lerp(0.9, 0.1, dv); T.fArmR[0] = lerp(0.9, 0.1, dv);
      T.thighL[0] = lerp(-0.3, 0.0, dv); T.thighR[0] = lerp(-0.3, 0.0, dv); T.thighL[2] = lerp(-0.3, -0.03, dv); T.thighR[2] = lerp(0.3, 0.03, dv);
      T.shinL[0] = lerp(-0.7, -0.05, dv); T.shinR[0] = lerp(-0.7, -0.05, dv); T.footL[0] = 0.5; T.footR[0] = 0.5;
      T.head[0] = lerp(1.1, 0.95, dv); T.spine[0] = lerp(0.18, 0.0, dv); T.chest[0] = lerp(0.15, 0, dv);
      T.hips[2] = Math.sin(t * 2.3) * 0.06;
    } else if (glide) {
      T.hips[0] = 0; T.spine[0] = 0.04; T.head[0] = 0.28;
      T.thighL[0] = 0.1 + Math.sin(t * 1.7) * 0.1; T.thighR[0] = 0.04 + Math.sin(t * 1.7 + 1.4) * 0.1; T.thighL[2] = -0.06; T.thighR[2] = 0.06;
      T.shinL[0] = -0.25 + Math.sin(t * 1.7 + 0.8) * 0.1; T.shinR[0] = -0.3 + Math.sin(t * 1.7 + 2.2) * 0.1; T.footL[0] = 0.5; T.footR[0] = 0.5;
      T.uArmL[0] = 2.9; T.uArmR[0] = 2.9; T.uArmL[2] = -0.2; T.uArmR[2] = 0.2;
    } else if (emote) {
      this._emote(T, t);
    } else {
      // 地面／空中
      const lean = ground ? -(0.04 + 0.16 * n) * (1 - this.cw) - (sprint ? 0.1 : 0) : 0;
      T.spine[0] += lean * 0.5; T.chest[0] += lean * 0.5; T.head[0] -= lean * 0.7;
      if (crouch) {
        T.thighL[0] = 1.2; T.thighR[0] = 1.2; T.shinL[0] = -1.9; T.shinR[0] = -1.9; T.footL[0] = 0.6; T.footR[0] = 0.6;
        T.spine[0] -= 0.3; T.chest[0] -= 0.1; T.head[0] += 0.38;
        T.uArmL[0] = 0.35; T.uArmR[0] = 0.35; T.uArmL[2] = -0.25; T.uArmR[2] = 0.25; T.fArmL[0] = 0.8; T.fArmR[0] = 0.8;
      } else if (air) {
        const rise = clamp(vy / 7, 0, 1), fall = clamp(-vy / 10, 0, 1);
        T.thighL[0] = 0.75 * rise + 0.25 * fall; T.thighR[0] = -0.25 * rise + 0.1 * fall;
        T.shinL[0] = -(1.0 * rise + 0.2 * fall); T.shinR[0] = -(0.75 * rise + 0.15 * fall + 0.1); T.footL[0] = 0.35; T.footR[0] = 0.45;
        T.thighL[2] = -0.08; T.thighR[2] = 0.08;
        T.uArmL[0] = 0.3 + 0.9 * rise; T.uArmR[0] = 0.3 + 0.9 * rise; T.uArmL[2] = -0.35 - 0.3 * fall; T.uArmR[2] = 0.35 + 0.3 * fall; T.fArmL[0] = 0.5; T.fArmR[0] = 0.5;
        T.spine[0] -= 0.08 * rise; T.head[0] += 0.08;
      } else {
        T.shinL[0] = -0.04; T.shinR[0] = -0.04;
        T.uArmL[2] = -0.1; T.uArmR[2] = 0.1; T.fArmL[0] = 0.18; T.fArmR[0] = 0.18;
      }
      // 著地壓縮、起跳拉伸
      T.thighL[0] += 0.85 * landE; T.thighR[0] += 0.85 * landE; T.shinL[0] -= 1.2 * landE; T.shinR[0] -= 1.2 * landE; T.footL[0] += 0.35 * landE; T.footR[0] += 0.35 * landE;
      T.spine[0] -= 0.28 * landE; T.chest[0] -= 0.1 * landE; T.uArmL[0] += 0.5 * landE; T.uArmR[0] += 0.5 * landE; T.head[0] += 0.25 * landE;
      // 受擊
      T.chest[0] += 0.28 * hitE; T.head[0] += 0.3 * hitE; T.spine[0] += 0.12 * hitE; T.hips[2] += 0.1 * hitE * this.hitSign; T.chest[2] += 0.12 * hitE * this.hitSign;
      // 待機呼吸／重心
      T.spine[0] += 0.012 * Math.sin(t * 1.9) * idleW; T.chest[0] += 0.02 * Math.sin(t * 1.9 + 0.4) * idleW; T.hips[2] += 0.025 * Math.sin(t * 0.6) * idleW * (crouch ? 0.3 : 1);
      T.head[1] += 0.08 * Math.sin(t * 0.45) * idleW; T.head[2] += 0.03 * Math.sin(t * 0.8) * idleW;
      T.uArmL[2] += -0.015 * Math.sin(t * 1.9) * idleW; T.uArmR[2] += 0.015 * Math.sin(t * 1.9) * idleW;
      if (!gun) T.head[0] += pitch * 0.45;
    }
    // 翻越（vault）：雙手撐前、身體前傾、雙腿收起後蹬上去
    this.mantleT += dt;
    const mk = a.mantle ? clamp(a.mantle.t / Math.max(0.01, a.mantle.dur), 0, 1) : this.mantleT < 0.4 ? this.mantleT / 0.4 : 1;
    const vault = (a.mantle || this.mantleT < 0.4) && !skydive && !glide ? Math.sin(Math.min(1, mk) * Math.PI) : 0;
    if (vault > 0.01) {
      T.spine[0] += 0.5 * vault; T.chest[0] += 0.25 * vault; T.head[0] -= 0.35 * vault;
      T.uArmL[0] += (2.0 - T.uArmL[0]) * vault; T.uArmR[0] += (2.0 - T.uArmR[0]) * vault; T.fArmL[0] += (0.25 - T.fArmL[0]) * vault; T.fArmR[0] += (0.25 - T.fArmR[0]) * vault;
      T.thighL[0] += (1.35 - T.thighL[0]) * vault; T.thighR[0] += (0.7 - T.thighR[0]) * vault; T.shinL[0] += (-1.7 - T.shinL[0]) * vault; T.shinR[0] += (-1.0 - T.shinR[0]) * vault;
    }
    // 持槍上半身（含 IK 目標在後面）
    if (gun && (ground || air) && vault < 0.3) {
      T.spine[0] += pitch * 0.18 + 0.02; T.chest[0] += pitch * 0.2; T.head[0] += pitch * 0.55 - pitch * 0.05;
      // 側身持槍（左肩朝前），頭仍看向瞄準方向
      const bl = 1 - this.adsW * 0.4 - this.lowW * 0.5;
      T.spine[1] += -0.1 * bl; T.chest[1] += -0.3 * bl; T.head[1] += 0.38 * bl;
      if (crouch) T.chest[0] -= 0.02;
    }
    // ---- 阻尼 ----
    const kBase = 15;
    for (const j of JOINTS) { const cu = C[j], tg = T[j]; cu[0] = damp(cu[0], tg[0], kBase, dt); cu[1] = damp(cu[1], tg[1], kBase, dt); cu[2] = damp(cu[2], tg[2], kBase, dt); }
    for (const j of JOINTS) b[j].rotation.set(C[j][0], C[j][1], C[j][2]);

    // ---- 步態（疊加，不經阻尼；振幅由 gaitW 平滑） ----
    const gw = this.gaitW;
    if (gw > 0.002 && ground) {
      const A = (0.28 + 0.62 * Math.pow(n, 1.1)) * (1 - 0.55 * this.cw) * gw, Bk = (0.4 + 1.0 * n) * (1 - 0.3 * this.cw) * gw;
      const ph = this.phase, s = Math.sin(ph);
      const kneeL = Math.pow(Math.max(0, Math.cos(ph + 0.45)), 1.3), kneeR = Math.pow(Math.max(0, -Math.cos(ph + 0.45)), 1.3);
      b.thighL.rotation.x += A * s + 0.08 * n * gw; b.thighR.rotation.x += -A * s + 0.08 * n * gw;
      b.shinL.rotation.x -= Bk * kneeL + 0.1 * gw; b.shinR.rotation.x -= Bk * kneeR + 0.1 * gw;
      b.hips.rotation.y += -0.16 * n * s * gw; b.spine.rotation.y += 0.1 * n * s * gw; b.chest.rotation.y += 0.1 * n * s * gw;
      b.hips.rotation.z += 0.035 * n * Math.cos(ph) * gw;
      b.spine.rotation.x += 0.02 * n * Math.cos(ph * 2) * gw;
      const armA = (0.2 + 0.7 * n) * gw * (1 - 0.5 * this.cw);
      b.uArmL.rotation.x += -armA * s; b.uArmR.rotation.x += armA * s;
      b.fArmL.rotation.x += (0.25 + 0.95 * n) * gw + 0.35 * n * gw * Math.max(0, s); b.fArmR.rotation.x += (0.25 + 0.95 * n) * gw + 0.35 * n * gw * Math.max(0, -s);
      b.head.rotation.x += 0.03 * n * Math.cos(ph * 2) * gw;
    }
    // 腳掌保持水平（著地時）
    b.footL.rotation.x = C.footL[0] - (b.thighL.rotation.x + b.shinL.rotation.x) * 0.85 * (1 - this.aw) * (skydive || glide ? 0 : 1);
    b.footR.rotation.x = C.footR[0] - (b.thighR.rotation.x + b.shinR.rotation.x) * 0.85 * (1 - this.aw) * (skydive || glide ? 0 : 1);

    // ---- 臀部高度：由雙腿實際姿勢反推，讓著地腳貼地 ----
    const legH = (th, sh) => 0.15 + 0.40 * Math.cos(th) + 0.34 * Math.cos(th + sh);
    const hL = legH(b.thighL.rotation.x, b.shinL.rotation.x), hR = legH(b.thighR.rotation.x, b.shinR.rotation.x);
    const smax = (p, q) => (p + q) / 2 + Math.sqrt(((p - q) / 2) ** 2 + 0.0006);
    let hy = smax(hL, hR);
    if (skydive || glide) hy = HIP0; else hy = lerp(hy, HIP0 + 0.02 * jumpE, this.aw * 0.8);
    if (emote) hy = Math.min(hy, HIP0);
    hy += jumpE * 0.05;
    // ---- 髖部定位（含滑翔擺盪、跳舞） ----
    const hips = b.hips;
    if (glide) {
      // 繞把手擺盪
      const bank = clamp(-(a.bank || 0) * 0.6, -0.4, 0.4);
      this.rollSm = damp(this.rollSm, bank, 6, dt);
      const swX = -0.14 + Math.sin(t * 1.3) * 0.03, swZ = this.rollSm * 0.8 + Math.sin(t * 0.9) * 0.03;
      const P = _P.set(0, 2.02, -0.02), R = _R.setFromEuler(_E.set(swX, 0, swZ)), h0 = _h0.set(0, hy, 0);
      h0.sub(P).applyQuaternion(R).add(P);
      hips.position.copy(h0);
      _qa.setFromEuler(hips.rotation); hips.quaternion.copy(R).multiply(_qa);
      this.glider.rotation.set(0.16 + swX * -0.3, 0, this.rollSm * 0.9);
    } else {
      hips.position.set(0, hy, 0);
    }
    this.root.scale.set(1 + 0.05 * landE - 0.02 * jumpE, 1 - 0.07 * landE + 0.04 * jumpE, 1 + 0.05 * landE - 0.02 * jumpE);

    // ---- 手臂 IK ----
    this._arms(dt, a, { gun: gun && vault < 0.3, ground, air, glide, skydive, emote, crouch, sprint, actKind, act, pitch, ads, hitE });

    // ---- 配件 ----
    // 圍巾／披風擺動
    const targetTail = skydive ? -1.2 : glide ? -0.55 : -(0.12 + 0.95 * n) * (ground ? 1 : 0.6) - 0.1 * (air ? 1 : 0);
    this.tailAng = damp(this.tailAng, targetTail, 7, dt);
    b.tail.rotation.set(this.tailAng + Math.sin(t * (6 + 5 * n) + 1) * 0.05 * (0.4 + n), Math.sin(t * 3.1) * 0.05, Math.sin(t * 5 + 2) * 0.04 * n + this.yawRate * 0.02);
    // 滑翔翼開合
    if (glide) { this.glideT += dt; this.gOpen = 1; } else { this.glideT = 0; this.gOpen = damp(this.gOpen, 0, 18, dt); }
    const gk = glide ? easeOutBack(clamp(this.glideT / 0.45, 0, 1)) : this.gOpen;
    this.glider.visible = gk > 0.02;
    if (this.glider.visible) {
      this.glider.position.set(0, lerp(1.45, 2.02, clamp(gk, 0, 1.15)), lerp(0.25, -0.02, clamp(gk, 0, 1)));
      this.glider.scale.set(Math.max(0.01, gk), Math.max(0.01, gk), Math.max(0.01, gk));
      if (!glide) this.glider.rotation.set(0.16, 0, 0);
    }
    b.pack.scale.setScalar(this.glider.visible ? 0.001 : 1);
    if (this.swingT >= 0) { this.swingT += dt; if (this.swingT > 0.55) this.swingT = -1; }
    if (this.buildT >= 0) { this.buildT += dt; if (this.buildT > 0.3) this.buildT = -1; }
  }

  _emote(T, t) {
    // 「風暴舞步」：120 bpm，4 段（每段 4 拍）
    const tb = t * 2, mv = Math.floor(tb / 4) % 4, mt = tb % 4;
    const beat = 0.5 - 0.5 * Math.cos(tb * TAU), side = mt < 2 ? 1 : -1, sw = Math.sin(tb * Math.PI);
    T.thighL[0] = 0.4 * beat; T.thighR[0] = 0.4 * beat; T.shinL[0] = -0.8 * beat; T.shinR[0] = -0.8 * beat; T.footL[0] = 0.3 * beat; T.footR[0] = 0.3 * beat;
    T.hips[1] = 0.3 * sw; T.chest[1] = -0.2 * sw; T.head[2] = 0.15 * sw; T.chest[0] = 0.06;
    if (mv === 0) { // 指天迪斯可
      const up = side === 1 ? 'R' : 'L', dn = side === 1 ? 'L' : 'R', sgn = side;
      T['uArm' + up][0] = 2.7; T['uArm' + up][2] = sgn * 0.45; T['fArm' + up][0] = 0.15;
      T['uArm' + dn][0] = 0.25; T['uArm' + dn][2] = -sgn * 0.75; T['fArm' + dn][0] = 1.6;
      T.hips[2] = sgn * 0.16; T.chest[2] = -sgn * 0.1; T.hips[1] = 0.45 * sgn * (0.5 + 0.5 * sw);
    } else if (mv === 1) { // 小雞翅膀
      const fl = Math.sin(tb * TAU * 2);
      T.uArmL[2] = -1.35; T.uArmR[2] = 1.35; T.fArmL[2] = 0; T.fArmL[0] = 1.7 + fl * 0.5; T.fArmR[0] = 1.7 - fl * 0.5; T.uArmL[0] = 0.1; T.uArmR[0] = 0.1;
      T.head[0] = 0.15 * fl; T.thighL[2] = -0.12; T.thighR[2] = 0.12; T.hips[2] = 0.06 * fl;
    } else if (mv === 2) { // 扭腰握拳
      const tw = Math.sin(tb * Math.PI * 2);
      T.hips[1] = 0.8 * tw; T.chest[1] = -0.5 * tw; T.uArmL[0] = 1.1; T.uArmR[0] = 1.1; T.uArmL[2] = 0.45; T.uArmR[2] = -0.45; T.fArmL[0] = 1.5; T.fArmR[0] = 1.5;
      T.head[1] = -0.3 * tw;
    } else { // 舉起屋頂
      const p = Math.sin(tb * TAU);
      T.uArmL[0] = 2.55 + 0.45 * p; T.uArmR[0] = 2.55 - 0.45 * p; T.uArmL[2] = -0.25; T.uArmR[2] = 0.25; T.fArmL[0] = 0.5 + 0.3 * p; T.fArmR[0] = 0.5 - 0.3 * p;
      T.head[0] = 0.25 + 0.12 * p; T.chest[0] = -0.08;
    }
  }

  // 手臂：FK（已設好）與 IK 混合
  _arms(dt, a, S) {
    const b = this.b, hd = this.hold ? HOLD[this.hold] : null;
    const gp = this.gunPivot, held = this.held;
    let wantR = 0, wantL = 0, modeR = 0, modeL = 0;
    const tR = this.tR, tL = this.tL;
    const t = this.t;
    const act = S.act, actKind = S.actKind;
    // 預設：不啟用 IK
    if (S.glide) {
      this.root.updateMatrixWorld(true);
      wantR = wantL = 1; modeR = modeL = 3;
      const rootP = this.glider.localToWorld(_t1.copy(this.glider.userData.handleR.position)); b.chest.worldToLocal(rootP); tR.copy(rootP);
      const rootL = this.glider.localToWorld(_t2.copy(this.glider.userData.handleL.position)); b.chest.worldToLocal(rootL); tL.copy(rootL);
    } else if (S.gun && (S.ground || S.air) && hd && held) {
      const ud = held.userData;
      // 槍姿勢
      const adsW = this.adsW, lowW = this.lowW;
      const base = hd.pos, ads = hd.ads, low = hd.low;
      let px = lerp(lerp(base[0], ads[0], adsW), low[0], lowW), py = lerp(lerp(base[1], ads[1], adsW), low[1], lowW), pz = lerp(lerp(base[2], ads[2], adsW), low[2], lowW);
      const drawK = easeOutBack(clamp(this.drawT, 0, 1));
      const kick = this.kick;
      const reloading = actKind === 'reload', rp = reloading ? clamp(act.t / Math.max(0.2, act.duration), 0, 1) : 0;
      let extraPitch = lowW * hd.lowPitch + (1 - drawK) * -1.0 + kick * 0.09;
      let extraYaw = lowW * 0.25, extraRoll = lowW * -0.15;
      if (reloading) {
        const w = sstep(0, 0.12, rp) * (1 - sstep(0.88, 1, rp));
        extraPitch += 0.3 * w; py += 0.03 * w; extraYaw += 0.15 * w;
      }
      const gait = this.gaitW * (S.ground ? 1 : 0);
      px += Math.sin(this.phase) * 0.012 * gait; py += Math.abs(Math.cos(this.phase)) * 0.015 * gait * (1 - this.adsW * 0.7);
      pz += kick * 0.05;
      // 世界俯仰 = 瞄準俯仰；抵銷身體旋轉
      _qa.copy(b.hips.quaternion).multiply(_qb.copy(b.spine.quaternion)).multiply(_qb.copy(b.chest.quaternion)).invert();
      _qc.setFromEuler(_E.set(clamp(S.pitch, -1.25, 1.25) + extraPitch, extraYaw, extraRoll, 'YXZ'));
      gp.quaternion.copy(_qa).multiply(_qc);
      gp.position.set(px, py, pz); gp.scale.setScalar(0.6 + 0.4 * drawK);
      gp.updateMatrix();
      const m = gp.matrix;
      // 右手 = 握把；左手 = 前握把（換彈時去彈匣）
      tR.copy(ud.gripR); tL.copy(ud.gripL);
      if (reloading) {
        if (ud.reload === 'mag' && ud.magRest) {
          // 0–.12 去彈匣；.12–.38 拔出；.38–.6 換新；.6–.82 插入；.82–1 回前握把
          const out = _t3.set(-0.05, -0.38, 0.08), well = ud.magRest;
          if (rp < 0.12) tL.lerpVectors(ud.gripL, well, sstep(0, 0.12, rp));
          else if (rp < 0.38) { tL.lerpVectors(well, out, sstep(0.12, 0.38, rp)) }
          else if (rp < 0.6) { tL.copy(out); tL.x += Math.sin((rp - 0.38) * 40) * 0.015 }
          else if (rp < 0.82) { tL.lerpVectors(out, well, sstep(0.6, 0.82, rp)) }
          else tL.lerpVectors(well, ud.gripL, sstep(0.82, 1, rp));
        } else if (ud.reload === 'shell') {
          const c = (rp * 2) % 1; tL.set(0.0, -0.05 - 0.2 * Math.sin(c * Math.PI), -0.2 + 0.1 * Math.sin(c * Math.PI));
        } else if (ud.reload === 'bolt') {
          const bolt = _t3.set(0.1, 0.04, 0.06);
          if (rp < 0.15) tR.lerpVectors(ud.gripR, bolt, sstep(0, 0.15, rp));
          else if (rp < 0.35) { tR.copy(bolt); tR.z += 0.14 * sstep(0.15, 0.3, rp); }
          else if (rp < 0.7) { tR.copy(bolt); tR.z += 0.14; tL.set(0, -0.2, -0.1); }
          else if (rp < 0.85) { tR.copy(bolt); tR.z += 0.14 * (1 - sstep(0.7, 0.85, rp)); }
          else tR.lerpVectors(bolt, ud.gripR, sstep(0.85, 1, rp));
        }
      }
      if (ud.magMesh && ud.magRest) {
        if (reloading && ud.reload === 'mag' && rp > 0.12 && rp < 0.82) ud.magMesh.position.copy(_t4.copy(tL).sub(ud.magRest));
        else ud.magMesh.position.set(0, 0, 0);
      }
      tR.applyMatrix4(m); tL.applyMatrix4(m);
      wantR = 1; wantL = 1; modeR = modeL = 1;
      this.poleR.set(0.5, -1, 0.15).normalize(); this.poleL.set(-0.5, -1, 0.2).normalize();
    } else if (S.ground && actKind === 'consume' && this.heldKind === 'item') {
      const p = clamp(act.t / Math.max(0.5, act.duration), 0, 1), id = a.inventory.current()?.defId || '';
      if (id.includes('shield')) { // 喝藥水
        const lift = sstep(0, 0.15, p) * (1 - sstep(0.88, 1, p)), glug = Math.sin(t * 9) * 0.01 * lift;
        tR.set(0.05, 0.4 + glug, -0.2).multiplyScalar(1); tR.lerp(_t3.set(0.2, 0.0, -0.3), 1 - lift);
        tL.set(-0.12, 0.12, -0.25);
        if (held) held.rotation.set(-0.3 - lift * 1.25, 0, 0);
        b.head.rotation.x += 0.4 * lift;
      } else { // 包紮
        const c = t * 7;
        tR.set(0.04 + Math.cos(c) * 0.05, 0.14 + Math.sin(c) * 0.04, -0.34); tL.set(-0.06, 0.12, -0.34);
        if (held) held.rotation.set(0, 0, 0.3);
      }
      wantR = wantL = 1; modeR = modeL = 2;
    } else if (S.ground && actKind === 'open') {
      const w = Math.sin(t * 10) * 0.03;
      tR.set(0.12, 0.02 + w, -0.42); tL.set(-0.12, 0.02 - w, -0.42); wantR = wantL = 1; modeR = modeL = 4;
    } else if (a.building && (S.ground || S.air)) {
      const k = this.buildT >= 0 ? Math.sin((this.buildT / 0.3) * Math.PI) : 0;
      tR.set(0.14, 0.2 - 0.04 * k, -0.4 - 0.12 * k); tL.set(-0.14, 0.2 - 0.04 * k, -0.4 - 0.12 * k); wantR = wantL = 1; modeR = modeL = 5;
    } else if (S.ground || S.air) {
      this._axeFK(a); // FK：十字鎬揮擊／持鎬
    }
    // 模式切換：保留位移偏差，讓手平滑過渡
    const sw = (mode, key, off, tgt, fin) => { if (mode !== this[key]) { off.copy(fin).sub(tgt); this[key] = mode; } };
    if (wantR) sw(modeR, 'modeR', this.offR, tR, this.finR); else this.modeR = 0;
    if (wantL) sw(modeL, 'modeL', this.offL, tL, this.finL); else this.modeL = 0;
    const dec = Math.exp(-14 * dt); this.offR.multiplyScalar(dec); this.offL.multiplyScalar(dec);
    this.finR.copy(tR).add(this.offR); this.finL.copy(tL).add(this.offL);
    this.ikR = damp(this.ikR, wantR, 16, dt); this.ikL = damp(this.ikL, wantL, 16, dt);
    if (this.ikR > 0.002) {
      this._fkQ(b.uArmR, b.fArmR, this.qUfk, this.qFfk);
      solveArm(b.shR.position, this.finR, this.poleR, this.qUik, this.qFik);
      b.uArmR.quaternion.slerpQuaternions(this.qUfk, this.qUik, this.ikR); b.fArmR.quaternion.slerpQuaternions(this.qFfk, this.qFik, this.ikR);
    }
    if (this.ikL > 0.002) {
      this._fkQ(b.uArmL, b.fArmL, this.qUfk, this.qFfk);
      solveArm(b.shL.position, this.finL, this.poleL, this.qUik, this.qFik);
      b.uArmL.quaternion.slerpQuaternions(this.qUfk, this.qUik, this.ikL); b.fArmL.quaternion.slerpQuaternions(this.qFfk, this.qFik, this.ikL);
    }
    if (!(S.gun && held && held.userData.magMesh) && this.held && this.held.userData.magMesh) { this.held.userData.magMesh.position.set(0, 0, 0); }
  }
  _fkQ(u, f, qu, qf) { qu.copy(u.quaternion); qf.copy(f.quaternion); }

  // 十字鎬 FK（持鎬、揮擊）
  _axeFK(a) {
    const b = this.b;
    if (this.swingT >= 0) {
      // 衝擊點約 0.18 s
      let u, f, ch = 0, hy = 0;
      if (this.swingT < 0.07) { const k = this.swingT / 0.07; u = lerp(1.1, 3.0, k); f = lerp(0.5, 1.4, k); ch = 0.18 * k; hy = 0.35 * k; }
      else if (this.swingT < 0.18) { const k = (this.swingT - 0.07) / 0.11, e = k * k; u = lerp(3.0, 0.7, e); f = lerp(1.4, 0.3, e); ch = lerp(0.18, -0.3, e); hy = lerp(0.35, -0.3, e); }
      else { const k = clamp((this.swingT - 0.18) / 0.3, 0, 1), e = sstep(0, 1, k); u = lerp(0.7, 1.0, e); f = lerp(0.3, 0.6, e); ch = lerp(-0.3, 0, e); hy = lerp(-0.3, 0, e); }
      b.uArmR.rotation.set(u, 0, 0.12); b.fArmR.rotation.set(f, 0, 0);
      b.chest.rotation.x += ch; b.hips.rotation.y += hy * 0.6; b.chest.rotation.y += hy * 0.5;
      b.uArmL.rotation.x += 0.3 * ch; b.uArmL.rotation.z -= 0.2;
    } else {
      // 持鎬：右手提在身側、前臂前伸
      b.uArmR.rotation.x = 0.35 + b.uArmR.rotation.x * 0.5; b.fArmR.rotation.x = 1.85 + (b.fArmR.rotation.x - 0.2) * 0.25; b.uArmR.rotation.z = 0.12;
    }
  }
}

const _P = new THREE.Vector3(), _h0 = new THREE.Vector3(), _R = new THREE.Quaternion(), _E = new THREE.Euler(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion();
const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3(), _t3 = new THREE.Vector3(), _t4 = new THREE.Vector3();
const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _e4 = new THREE.Euler(), _s4 = new THREE.Vector3(), _p4 = new THREE.Vector3();
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
