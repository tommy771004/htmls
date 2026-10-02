// Actor：玩家與 bot 共用（SPEC §4）。差別只在誰寫 intent。
import * as THREE from 'three';
import { MOVE } from './config.js';
import { clamp, damp } from './shared.js';

const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
import { Inventory } from './inventory.js';

export function makeIntent() {
  return {
    moveX: 0, moveZ: 0, sprint: false, crouch: false, jump: false, yaw: 0, pitch: 0, aimPoint: null,
    fire: false, ads: false, reload: false, interact: false, slot: -1,
    buildToggle: false, buildPiece: null, buildPlace: false, buildCycleMaterial: false, deploy: false,
  };
}

export class Actor {
  constructor(ctx, id, isPlayer, name) {
    this.ctx = ctx; this.id = id; this.isPlayer = isPlayer; this.name = name;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.aim = { origin: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, -1) };
    this.intent = makeIntent();
    this.inventory = new Inventory();
    this.view = null; this.outfit = null;
    this.reset(null);
  }
  reset(spawn) {
    this.alive = true; this.kills = 0; this.place = 0;
    this.yaw = 0; this.pitch = 0;
    this.state = 'bus'; this.grounded = false; this.crouching = false; this.sprinting = false; this.inWater = false;
    this.health = 100; this.shield = 0;
    this.inventory = new Inventory();
    this.action = null; this.lastDamageAt = -99; this.lastHitByAt = -99; this.lastDamagedBy = null; this.lastHitDir = null;
    this.building = false; this.buildPiece = 'wall';
    this.stormAcc = 0; this.glideOpened = false;
    this.jumpBuf = 0; this.coyoteT = 0; this.mantle = null; this.stepOff = 0; this.bank = 0; this.prevYaw = 0; this.sprintBlend = 0;
    this.cs = { cd: 0, bloom: 0, reloadHold: 0 }; // combat 內部狀態
    this.stats = { damage: 0, builds: 0, bornAt: this.ctx.time ? this.ctx.time.now : 0, diedAt: 0 };
    this.vel.set(0, 0, 0);
    if (spawn) this.pos.copy(spawn);
    Object.assign(this.intent, makeIntent());
    if (this.view) this.view.setVisible(true);
  }
  get height() { return this.crouching ? MOVE.crouchHeight : MOVE.height; }
  eyePos(out) { return out.set(this.pos.x, this.pos.y + (this.crouching ? MOVE.crouchEye : MOVE.eye), this.pos.z); }
  headCenter(out) { return out.set(this.pos.x, this.pos.y + (this.crouching ? MOVE.crouchHeadY : MOVE.headY), this.pos.z); }
  forward(out) { const c = Math.cos(this.pitch); return out.set(-Math.sin(this.yaw) * c, Math.sin(this.pitch), -Math.cos(this.yaw) * c); }
  // 視覺位置：站上台階／階梯時不彈跳（鏡頭與模型用這個；物理仍用 pos）
  visPos(out) { return out.set(this.pos.x, this.pos.y + this.stepOff, this.pos.z); }
  get mantling() { return !!this.mantle; }
  altitude() { return this.pos.y - Math.max(this.ctx.terrain.heightAt(this.pos.x, this.pos.z), 0); }

  takeDamage(amount, info = {}) {
    if (!this.alive || this.state === 'bus' || amount <= 0) return { shieldDamage: 0, healthDamage: 0, killed: false };
    let sd = 0;
    if (!info.ignoreShield) { sd = Math.min(this.shield, amount); this.shield -= sd; }
    const hd = Math.min(this.health, amount - sd);
    this.health -= hd;
    this.lastDamageAt = this.ctx.time.now;
    if (info.source) { this.lastDamagedBy = info.source; if (info.source !== this) this.lastHitByAt = this.ctx.time.now; if (info.source !== this) { info.source.stats.damage += sd + hd; this.lastHitDir = info.source.pos; } }
    const killed = this.health <= 0.001;
    this.ctx.events.emit('damage', { target: this, source: info.source || null, amount, shieldDamage: sd, healthDamage: hd, headshot: !!info.headshot, point: info.point || null, weapon: info.weapon || null });
    if (killed) this.die(info);
    return { shieldDamage: sd, healthDamage: hd, killed };
  }
  heal(kind, amount, cap = 100) {
    const cur = kind === 'health' ? this.health : this.shield;
    const add = Math.max(0, Math.min(amount, Math.min(100, cap) - cur));
    if (add <= 0) return 0;
    if (kind === 'health') this.health += add; else this.shield += add;
    this.ctx.events.emit('heal', { actor: this, kind, amount: add });
    return add;
  }
  die(info = {}) {
    if (!this.alive) return;
    this.alive = false; this.health = 0; this.state = 'dead'; this.action = null; this.building = false;
    this.stats.diedAt = this.ctx.time.now;
    this.place = this.ctx.actors.filter((a) => a.alive).length + 1;
    const killer = info.source && info.source !== this ? info.source : (this.lastDamagedBy && this.ctx.time.now - this.lastHitByAt < 6 && !info.storm && !info.fall ? this.lastDamagedBy : null);
    if (killer && killer !== this) killer.kills++;
    this.view?.eliminate();
    this.ctx.events.emit('eliminated', { victim: this, killer: killer && killer !== this ? killer : null, weapon: info.weapon || null, headshot: !!info.headshot, storm: !!info.storm, fall: !!info.fall });
  }

  // 翻越：空中撞到 0.2–1.3 m 高的邊緣時，探測頂面與頭部空間，成功就平滑翻上去
  tryMantle(dx, dz) {
    const P = this.ctx.physics, R = MOVE.radius, y = this.pos.y;
    const tx = this.pos.x + dx * (R + 0.4), tz = this.pos.z + dz * (R + 0.4);
    const g = P.groundHeight(tx, tz, y + MOVE.mantleMax - 0.55, R * 0.8);
    if (g.colliderId == null) return false;
    const gy = g.y, rise = gy - y;
    if (rise < MOVE.mantleMin || rise > MOVE.mantleMax) return false;
    // 邊緣緊貼身前也要是同一高度（避免翻上只有一小塊的突起）
    const g1 = P.groundHeight(this.pos.x + dx * (R + 0.12), this.pos.z + dz * (R + 0.12), y + MOVE.mantleMax - 0.55, 0.2);
    if (g1.colliderId == null || g1.y - y < MOVE.mantleMin) return false;
    if (P.overlapsCapsule(tx, gy + 0.03, tz, R, MOVE.height)) return false;
    this.mantle = { t: 0, dur: MOVE.mantleDur + rise * 0.06, x0: this.pos.x, y0: y, z0: this.pos.z, x1: tx, y1: gy, z1: tz, dx, dz };
    this.vel.set(0, 0, 0); this.grounded = false; this.jumpBuf = 0;
    this.ctx.events.emit('mantle', { actor: this, height: rise });
    return true;
  }

  fixedUpdate(dt) {
    if (!this.alive) return;
    const I = this.intent, ctx = this.ctx, P = ctx.physics;
    this.yaw = I.yaw; this.pitch = I.pitch;
    const yawRate = (this.yaw - this.prevYaw) / dt; this.prevYaw = this.yaw;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    this.stepOff *= Math.exp(-MOVE.stepDecay * dt);
    if (this.state !== 'skydive' && this.state !== 'glide') this.bank = damp(this.bank, 0, 8, dt);
    if (this.state === 'bus') {
      ctx.match.busPos(this.pos); this.vel.set(0, 0, 0); this.stepOff = 0;
      if (I.deploy && ctx.match.canJump()) { this.state = 'skydive'; ctx.match.busDir && this.vel.set(ctx.match.busDir.x * 20, 0, ctx.match.busDir.z * 20); this.glideOpened = false; ctx.events.emit('jump', { actor: this }); }
      return;
    }
    if (this.state === 'skydive' || this.state === 'glide') {
      const gl = this.state === 'glide';
      this.jumpBuf = 0; this.coyoteT = 0; this.stepOff = 0; this.mantle = null; this.crouching = false;
      // 玩家低頭滑翔會略快略降，抬頭則減速（bot 不吃這個，避免落點偏離）
      const pd = this.isPlayer && gl ? clamp(-this.pitch / 1.0, -0.5, 1) : 0;
      const dive = gl ? 0 : clamp(-this.pitch / 1.1, 0, 1);
      const fwd = I.moveZ < 0 ? 0.35 : 1;
      const spd = gl ? MOVE.glideH * (I.moveZ < 0 ? 0.55 : 1) * (1 + 0.22 * pd) : MOVE.skydiveH * (1 - 0.5 * dive) * fwd;
      const side = I.moveX * (gl ? 6 : 9);
      const tx = -sy * spd + cy * side, tz = -cy * spd - sy * side;
      const tvy = gl ? -MOVE.glideFall * (1 + 0.45 * pd) : -(MOVE.skydiveTerm + (MOVE.skydiveDive - MOVE.skydiveTerm) * dive);
      this.vel.x = damp(this.vel.x, tx, gl ? 3.4 : 3, dt); this.vel.z = damp(this.vel.z, tz, gl ? 3.4 : 3, dt);
      this.vel.y = damp(this.vel.y, tvy, gl ? 4.5 : 1.6, dt);
      // 傾斜（bank）：隨轉向與側移擺盪，給鏡頭與模型用
      this.bank = damp(this.bank, clamp(-yawRate * 0.22 + I.moveX * 0.4, -0.65, 0.65), 5, dt);
      const alt = this.altitude();
      if (!gl && ((I.deploy && alt < MOVE.glideAllowAlt) || alt < MOVE.glideOpenAlt)) { this.state = 'glide'; this.glideOpened = true; ctx.events.emit('glide', { actor: this }); }
      const prevVy = this.vel.y;
      const r = P.moveCapsule(this.pos, this.vel, dt, MOVE.radius, MOVE.height, false);
      if (r.grounded) { this.state = 'ground'; this.grounded = true; this.vel.y = 0; this.vel.x *= 0.3; this.vel.z *= 0.3; if (!gl && prevVy < -MOVE.fallSafe) this.takeDamage(Math.min(100, (-prevVy - MOVE.fallSafe) * MOVE.fallMul), { ignoreShield: true, fall: true }); ctx.events.emit('land', { actor: this, speed: -prevVy }); }
      return;
    }
    // ---- 翻越中：直接插值位置（先上後前），不走碰撞 ----
    if (this.mantle) {
      const m = this.mantle; m.t += dt; const k = Math.min(1, m.t / m.dur);
      const ky = smooth(k / 0.65), kx = smooth((k - 0.3) / 0.7);
      this.pos.set(m.x0 + (m.x1 - m.x0) * kx, m.y0 + (m.y1 - m.y0) * ky, m.z0 + (m.z1 - m.z0) * kx);
      this.vel.set(0, 0, 0);
      if (k >= 1) { this.mantle = null; this.grounded = true; this.state = 'ground'; this.vel.set(m.dx * 2.5, 0, m.dz * 2.5); }
      return;
    }
    // ---- ground / air ----
    if (this.crouching && !I.crouch && P.overlapsCapsule(this.pos.x, this.pos.y, this.pos.z, MOVE.radius, MOVE.height)) this.crouching = true; // 頭上有東西：保持蹲
    else this.crouching = !!I.crouch && this.grounded;
    const moving = I.moveX !== 0 || I.moveZ !== 0;
    this.inWater = this.pos.y < 0.4 && ctx.terrain.heightAt(this.pos.x, this.pos.z) < 0.05;
    this.sprinting = !!I.sprint && I.moveZ > 0 && !this.crouching && !I.ads && (!this.action || this.action.kind === 'open' ? true : false);
    let speed = this.crouching ? MOVE.crouch : this.sprinting ? MOVE.sprint : MOVE.walk;
    if (this.action && this.action.kind === 'consume') speed *= 0.5;
    if (this.inWater) speed *= 0.5;
    if (I.ads) speed *= 0.75;
    let mx = I.moveX, mz = I.moveZ; const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    const wx = (-sy * mz + cy * mx) * speed, wz = (-cy * mz - sy * mx) * speed;
    // 加速：起步用 accel，轉向（目標與現速反向）用 decel 較快，放開用 decel
    const ac = (moving ? MOVE.accel : MOVE.decel) * (this.grounded ? 1 : (moving ? MOVE.airControl : 0.03));
    if (ac > 0) {
      const dx = wx - this.vel.x, dz = wz - this.vel.z, dl = Math.hypot(dx, dz), step = ac * dt;
      if (dl <= step) { this.vel.x = wx; this.vel.z = wz; } else { this.vel.x += dx / dl * step; this.vel.z += dz / dl * step; }
    }
    // 跳躍：緩衝（落地前 0.12 s 按）＋土狼時間（離邊後 0.1 s 仍可跳）
    this.jumpBuf = I.jump ? MOVE.jumpBuffer : Math.max(0, this.jumpBuf - dt);
    this.coyoteT = this.grounded ? MOVE.coyote : Math.max(0, this.coyoteT - dt);
    if (this.jumpBuf > 0 && this.coyoteT > 0) {
      this.vel.y = MOVE.jump * (this.inWater ? 0.7 : 1); this.grounded = false; this.crouching = false;
      this.jumpBuf = 0; this.coyoteT = 0; ctx.events.emit('jump', { actor: this });
    }
    this.vel.y -= MOVE.gravity * dt;
    const wasG = this.grounded, prevVy = this.vel.y, py = this.pos.y, px = this.pos.x, pz = this.pos.z;
    const r = P.moveCapsule(this.pos, this.vel, dt, MOVE.radius, this.height, wasG);
    this.grounded = r.grounded;
    this.state = this.grounded ? 'ground' : 'air';
    // 台階／樓梯平滑：貼地移動時高度突變超過坡度預期 → 記成視覺偏移再衰減
    if (wasG && this.grounded) {
      const dy = this.pos.y - py, lim = Math.hypot(this.pos.x - px, this.pos.z - pz) * 1.3 + 0.08;
      if (Math.abs(dy) > lim && Math.abs(dy) < 0.9) this.stepOff = clamp(this.stepOff - dy, -0.8, 0.8);
    }
    if (this.grounded && !wasG) {
      if (prevVy < -MOVE.fallSafe) this.takeDamage(Math.min(100, (-prevVy - MOVE.fallSafe) * MOVE.fallMul), { ignoreShield: true, fall: true });
      ctx.events.emit('land', { actor: this, speed: -prevVy });
    }
    // 空中撞到可翻越的邊緣
    if (!this.grounded && r.hitWall && moving && this.vel.y > -9) {
      const l = Math.hypot(wx, wz) || 1;
      this.tryMantle(wx / l, wz / l);
    }
  }
}
