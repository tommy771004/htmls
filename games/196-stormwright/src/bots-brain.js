// Bot 大腦：狀態機（空投 → 滑翔 → 搜刮 → 採集 → 轉圈 → 交戰 → 補給）。只給 bots.js 引入。
import * as THREE from 'three';
import { clamp } from './shared.js';
import { NavMixin, houseAt } from './bots-nav.js';
import { CombatMixin, TUNE, WVALUE } from './bots-combat.js';

const _v = new THREE.Vector3();
const AMMO_WANT = { light: 90, medium: 90, heavy: 12, shells: 24 };

export class Brain {
  constructor(bots, actor, idx) {
    this.bots = bots; this.a = actor; this.ctx = bots.ctx; this.idx = idx;
    this.look = { mode: 'yaw', yaw: 0, pitch: 0, rate: 6, tgt: null, cur: null, hy: 1.05, dist: 30, trueYaw: 0, truePitch: 0 };
    this.acc = Math.random() * 0.05;
    this.reset();
  }
  reset() {
    const c = this.ctx, rng = c.rng, i = this.idx;
    this.skill = clamp(0.2 + 0.7 * ((i * 0.6180339 + rng() * 0.3) % 1), 0.2, 0.9);
    this.aggr = 0.35 + 0.95 * rng();
    this.reactT = clamp(0.8 - 0.55 * this.skill + (rng() - 0.5) * 0.12, 0.25, 0.8);
    this.reach = 150 + rng() * 40;
    this.target = null;                       // 落點（{x,z}，main.js skipToGround 會讀）
    this.pickLanding();
    this.state = 'bus'; this.jumpS = undefined; this.deployAlt = 50 + rng() * 38;
    this.foe = null; this.engaged = false; this.seeing = null; this.firstSeen = -9; this.lastSeen = -9; this.lastEnemySeen = -9;
    this.hitBy = null; this.hitAt = -9; this.lastHurtAt = -9; this.heardT = -9; this.heardX = 0; this.heardZ = 0;
    this.seenX = this.seenY = this.seenZ = 0; this.trackQ = 0; this.burstLeft = 0; this.nextShotAt = 0;
    this.fireMode = 'off'; this.wantFire = false; this.fireTol = 0.5; this.missM = 99; this.noAimOverride = false;
    this.errYaw = this.errPitch = this.errTy = this.errTp = 0; this.sigma = 0.03; this.errClock = 0;
    this.strafe = 1; this.strafeT = 0; this.crouchT = 0; this.switchAt = -9; this.fleeUntil = 0; this.coverUntil = 0;
    this.landedAt = 1e9; this.tickN = 0; this.simBusyUntil = 0; this.simAcc = 0; this.simDmg = 0; this.simShots = 0;
    this.goal = null; this.route = null; this.goalKey = ''; this.goalAt = -99; this.moveIntent = false;
    this.stuckT = 0; this.stuckLvl = 0; this.stuckAt = undefined; this.breakUntil = 0; this.stuckSide = 0; this.avoidUntil = 0; this.stuckCount = 0;
    this.bseq = null; this.buildCd = 0;
    this.loot = null; this.ignore = new Map(); this.lootAt = -9; this.lootStart = 0;
    this.harvest = null; this.harvestCd = 0; this.rotGoal = null; this.roamAt = -99;
    this.useSlot = -1; this.healSince = 0;
    this.look.mode = 'yaw'; this.look.tgt = null;
    this.pass = new Map(); this.forcedGoal = null; this.hurtAmt = 0; this.coverWanted = false; this.coverAt = 0;
    this.far = false;
  }
  // ---------- 落點 ----------
  pickLanding() {
    const c = this.ctx, rng = c.rng, W = c.world, T = c.terrain;
    let t = null;
    for (let n = 0; n < 40 && !t; n++) {
      let x, z;
      const r = rng();
      if (r < 0.45) {
        const p = W.pois[rng() < 0.25 ? 0 : rng.int(W.pois.length)];
        const ang = rng() * 6.283, d = Math.sqrt(rng()) * p.r * 0.85; x = p.x + Math.cos(ang) * d; z = p.z + Math.sin(ang) * d;
      } else if (r < 0.75) {
        const s = W.lootSpots[rng.int(W.lootSpots.length)]; x = s.x + (rng() - 0.5) * 14; z = s.z + (rng() - 0.5) * 14;
      } else { x = (rng() - 0.5) * 640; z = (rng() - 0.5) * 640; }
      if (T.heightAt(x, z) < 2 || houseAt(W, x, z, 1.5)) continue;
      t = { x, z };
    }
    this.target = t || { x: 0, z: 60 };
  }

  // ---------- 每個固定步 ----------
  clearEdges() {
    const I = this.a.intent;
    I.jump = false; I.reload = false; I.slot = -1; I.buildToggle = false; I.buildPiece = null; I.deploy = false; I.buildCycleMaterial = false; I.buildPlace = false;
  }
  think(dt) {
    const c = this.ctx, a = this.a, I = a.intent, now = c.time.now;
    const st = a.state;
    this.tickN++;
    if (st === 'bus') { this.busThink(); return; }
    if (st === 'skydive' || st === 'glide') { this.flyThink(st); return; }
    if (st !== 'ground' && st !== 'air') return;
    if (this.landedAt > 1e8) { this.landedAt = now; this.state = 'loot'; this.look.mode = 'yaw'; }
    // 每 tick 重置的連續意圖
    I.interact = false; I.ads = false; I.crouch = false; I.sprint = false; I.moveX = 0; I.moveZ = 0;
    this.wasMoving = this.moveIntent; this.moveIntent = false; this.fireMode = 'off'; I.fire = false; this.noAimOverride = false; this.wantFire = false;
    if (this.look.mode === 'target') this.look.mode = 'yaw';
    this.refreshInv();
    const inv = a.inventory, S = this.inv, storm = c.storm;
    // 卡住處理（階梯式）
    if (this.stuckTick(dt)) { this.state = 'unstick'; this.breakStep(); return; }
    this.breakThrough = false;
    if (this.forcedGoal) { this.state = 'test'; this.goTo(this.forcedGoal.x, this.forcedGoal.z, a.pos.y, 'test', true, dt, 2); return; }   // 測試用：強制前往
    // 感知
    const seen = this.perceive();
    const o = this.foe;
    const outside = storm.active && storm.isOutside(a.pos.x, a.pos.z);
    if (this.bseq && this.runBuild(dt)) { this.state = 'build'; return; }
    const od = o && o.alive ? Math.hypot(o.pos.x - a.pos.x, o.pos.z - a.pos.z) : 1e9;
    // 在風暴圈外：趕路優先，除非敵人很近且正在打我
    if (o && o.alive && !(outside && !(now - this.lastHurtAt < 1.5 && od < 25))) {
      const d = od;
      const visible = seen === o;
      const hp = a.health + a.shield * 0.7;
      // 受擊反應：蓋牆（受擊時由 Bots 的 damage 監聽擲骰，延遲後才動手）
      if (this.coverWanted && now >= this.coverAt) {
        this.coverWanted = false;
        if (this.planCover(o) && this.runBuild(dt)) { this.state = 'build'; return; }
      }
      if (hp < 34 && S.heal.length === 0 && !this.engaged && d > 22) this.fleeUntil = now + 5;
      if (hp < 30 && (visible || now - this.lastHurtAt < 2)) {
        if (this.planCover(o) && this.runBuild(dt)) { this.state = 'build'; return; }
        if (d >= 28 && (S.heal.length === 0 || !this.engaged)) this.fleeUntil = now + 4 + Math.random() * 3;   // 近距離逃跑只會被打背：寧可還擊
      }
      if (this.engaged && now - this.fightStart > this.fightMax && d > 28 && storm.phase < 5 && hp > 30) {
        // 僵持太久：脫戰
        this.engaged = false; this.fleeUntil = now + 3 + Math.random() * 3; this.pass.set(o, { fight: false, until: now + 14, cool: now + 12 });
      }
      if (this.fleeUntil > now && visible && d > 22) { this.fleeTick(o, dt); return; }
      if (!visible && this.coverUntil > now && now - this.lastEnemySeen > 1.0 && this.healTick(outside)) return;   // 躲在掩護後面補血
      if (this.engaged || (visible && this.wantFight(o, d))) {
        if (!this.engaged) { this.fightStart = now; this.fightMax = 6 + 9 * this.skill + 6 * Math.random(); const ss = this.bots.stats; ss.fights++; if (this.hitBy === o && now - this.hitAt < 5) ss.defend++; else ss.start++; ss.byPhase[Math.min(6, storm.active ? storm.phase : 0)]++; }
        this.engaged = true;
        if (!S.hasGun) { if (d < 3.2 && now - this.hitAt < 4) { this.meleeTick(o, d, dt); return; } this.engaged = false; }
        else {
          this.fightTick(o, d, visible, dt);
          if (this.far && this.simOK(o)) {
            this.fireMode = 'off'; I.fire = false;
            if (visible && this.wantFire) this.simShoot(o, d, dt);
          }
          return;
        }
      }
    } else if (this.fleeUntil > now && now - this.lastHurtAt < 2) {
      // 被不明來源打：移動
    }
    // 補給（安全時）
    if (this.healTick(outside)) return;
    // 風暴
    const storming = this.stormTick(outside, dt);
    if (storming) return;
    // 聽見槍聲：後期去看看
    if (!o && now - this.heardT < 7 && storm.active && storm.phase >= 2 && this.aggr * (0.4 + storm.phase * 0.2) > 0.55 && a.health > 55 && S.hasGun) {
      const d = Math.hypot(this.heardX - a.pos.x, this.heardZ - a.pos.z);
      if (d > 18) { this.state = 'investigate'; this.goTo(this.heardX, this.heardZ, a.pos.y, 'hear', true, dt, 14); return; }
    }
    // 補彈、整備
    this.maintainTick();
    if (this.harvestTick(dt)) return;
    if (this.lootTick(dt)) return;
    this.roamTick(dt);
  }

  // ---------- 飛艇、跳傘、滑翔 ----------
  busThink() {
    const c = this.ctx, a = this.a, I = a.intent, m = c.match, now = c.time.now;
    this.state = 'bus';
    m.busPos(_v);
    const bs = m.busStart, dir = m.busDir, T = this.target;
    if (this.jumpS === undefined) {
      const s0 = (T.x - bs.x) * dir.x + (T.z - bs.z) * dir.z, lat = Math.abs((T.x - bs.x) * dir.z - (T.z - bs.z) * dir.x);
      const lead = Math.min(150, Math.sqrt(Math.max(0, this.reach * this.reach - lat * lat)));
      this.jumpS = clamp(s0 - lead + (Math.random() - 0.5) * 36, 110, 930) + Math.random() * 24;
    }
    const along = (_v.x - bs.x) * dir.x + (_v.z - bs.z) * dir.z;
    this.look.mode = 'yaw'; this.look.yaw = Math.atan2(-(T.x - _v.x), -(T.z - _v.z)); this.look.pitch = 0; this.look.rate = 3;
    if (m.canJump() && along >= this.jumpS) { I.deploy = true; }
  }
  flyThink(st) {
    const a = this.a, I = a.intent, T = this.target;
    const dx = T.x - a.pos.x, dz = T.z - a.pos.z, D = Math.hypot(dx, dz), h = a.altitude();
    this.state = st;
    this.look.mode = 'yaw'; this.look.yaw = Math.atan2(-dx, -dz); this.look.rate = 3.4; I.moveX = 0;
    if (st === 'skydive') {
      const reach = 2.46 * Math.min(h, 90) + Math.max(0, h - 90) / 55 * 15;
      const ratio = D / Math.max(10, reach);
      this.look.pitch = ratio > 0.8 ? -0.05 : ratio > 0.55 ? -0.6 : -1.25; I.moveZ = 1;
      if (h < 90 && (ratio > 0.55 || h < this.deployAlt)) I.deploy = true;
    } else {
      this.look.pitch = -0.1;
      const ratio = D / Math.max(8, 2.46 * h);
      if (ratio < 0.35) { I.moveZ = -1; I.moveX = D > 8 ? 0 : (this.idx % 2 ? 1 : -1); this.look.yaw = Math.atan2(-dx, -dz); }
      else if (ratio < 0.7) { I.moveZ = -1; } else I.moveZ = 1;
      // 太近還很高：繞圈
      if (D < 14 && h > 12) { I.moveX = this.idx % 2 ? 1 : -1; I.moveZ = 0.4; this.look.yaw += (this.idx % 2 ? 1 : -1) * 0.5; }
    }
  }

  // ---------- 目標與導航 ----------
  goTo(x, z, y, kind, sprint, dt, stopDist = 1.2) {
    const a = this.a, key = kind + ':' + Math.round(x / 3) + ',' + Math.round(z / 3);
    if (this.goalKey !== key || !this.goal || this.ctx.time.now - this.goalAt > 18) { this.goalKey = key; this.setGoal(x, z, y, kind); }
    const w = this.waypoint();
    const d = Math.hypot(x - a.pos.x, z - a.pos.z);
    if (d < stopDist && (!this.route || !this.route.length)) { this.moveIntent = false; return true; }
    this.navStep(w.x, w.z, sprint, dt);
    return false;
  }
  ignoreGoal() {
    const now = this.ctx.time.now;
    if (this.loot) this.ignore.set(this.loot.ref, now + 45);
    if (this.harvest) this.ignore.set(this.harvest.ref, now + 60);
    this.loot = null; this.harvest = null; this.goalKey = ''; this.rotGoal = null; this.roamAt = -99;
  }

  // ---------- 逃跑 ----------
  fleeTick(o, dt) {
    const a = this.a, I = a.intent;
    this.state = 'flee';
    const dx = a.pos.x - o.pos.x, dz = a.pos.z - o.pos.z, d = Math.hypot(dx, dz) || 1;
    let fx = dx / d, fz = dz / d; const st = this.ctx.storm;
    if (st.active) { const cx = st.center.x - a.pos.x, cz = st.center.y - a.pos.z, cl = Math.hypot(cx, cz) || 1, w = st.distToSafe(a.pos.x, a.pos.z) > -1 && cl > st.radius * 0.5 ? 0.9 : 0.35; fx += cx / cl * w; fz += cz / cl * w; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl; }
    const sx = a.pos.x + fx * 30 + (Math.random() - 0.5) * 8, sz = a.pos.z + fz * 30 + (Math.random() - 0.5) * 8;
    if (!this.goal || this.goal.kind !== 'flee' || this.ctx.time.now - this.goalAt > 2) this.setGoal(sx, sz, a.pos.y, 'flee');
    const w = this.waypoint(); this.navStep(w.x, w.z, true, dt);
    this.look.mode = 'yaw';
  }

  // ---------- 補給 ----------
  healTick(outside) {
    const c = this.ctx, a = this.a, I = a.intent, inv = a.inventory, S = this.inv, now = c.time.now;
    const cover = this.coverUntil > now;
    const safe = now - this.lastEnemySeen > (cover ? 1.0 : 3.0) && now - this.lastHurtAt > (cover ? 1.0 : 2.0);
    let want = -1;
    if (safe && (cover || !(this.foe && this.engaged))) {
      const find = (id) => S.heal.find((h) => h.it.defId === id);
      if (!outside) {
        if (a.shield < 50) { const h = find('minishield') || (a.shield <= 50 ? find('shield') : null); if (h) want = h.slot; }
        else if (a.shield < 100 && a.shield >= 50) { /* 已有半盾：不浪費時間 */ }
        if (want < 0 && a.health < 70) { const h = (a.health < 45 ? find('medkit') : null) || find('bandage') || (a.health < 55 ? find('medkit') : null); if (h) want = h.slot; }
      } else if (a.health < 35) { const dmg = c.storm.dmg, h = (dmg < 9 ? find('medkit') : null) || (dmg < 3.5 ? find('bandage') : null); if (h) want = h.slot; }   // 風暴傷害高於回血速度時補了也是白補，直接跑
    }
    if (want < 0) {
      this.useSlot = -1;
      if (a.action && a.action.kind === 'consume') { /* 被打斷時由戰鬥邏輯處理 */ }
      return false;
    }
    this.state = 'heal'; this.useSlot = want;
    this.moveIntent = false;
    if (inv.selected !== want) { I.slot = want; return true; }
    this.fireMode = 'hold'; I.fire = true;
    // 緩慢朝目標方向走（不浪費時間）：站定即可
    return true;
  }
  maintainTick() {
    const a = this.a, I = a.intent, inv = a.inventory, now = this.ctx.time.now, S = this.inv;
    if (a.action) return;
    const cur = this.curGun();
    // 選一把合適的槍拿著（不在採集時）
    if (!this.harvest && (!cur || (cur.it.mag <= 0 && inv.ammo[cur.st.ammo] <= 0)) && S.hasGun) {
      const g = this.bestGun(30); if (g && inv.selected !== g.slot && now - this.switchAt > 0.5) { I.slot = g.slot; this.switchAt = now; }
    }
    // 沒敵人時補彈
    if (cur && cur.it.mag < cur.st.mag * 0.55 && inv.ammo[cur.st.ammo] > 0 && now - this.lastEnemySeen > 2.5) I.reload = true;
  }

  // ---------- 風暴 ----------
  stormTick(outside, dt) {
    const c = this.ctx, a = this.a, st = c.storm, now = c.time.now;
    if (!st.active) return false;
    const nx = st.next.center.x, nz = st.next.center.y, nr = st.next.radius;
    const toNext = Math.hypot(a.pos.x - nx, a.pos.z - nz);
    const edge = Math.max(0, toNext - Math.max(6, nr - 12));
    const travel = edge / 5.2, tleft = st.state === 'waiting' ? st.timeLeft : 0;
    const margin = 12 + 26 * this.skill + travel * 0.3;
    const final = st.state === 'final';
    const need = outside || final || (edge > 0 && travel + margin > tleft);
    if (!need) { this.rotGoal = null; return false; }
    // 殘血在圈外且有補給 → 交給 healTick（已先處理）。這裡負責移動。
    if (!this.rotGoal || this.rotGoal.phase !== st.phase * 10 + (st.state === 'waiting' ? 0 : 1) || this.rotGoal.stuck !== this.stuckCount) {
      const T = c.terrain;
      let x = nx, z = nz;
      for (let n = 0; n < 12; n++) {
        const ang = Math.random() * 6.283, r = Math.sqrt(Math.random()) * Math.max(0, nr * 0.55);
        x = nx + Math.cos(ang) * r; z = nz + Math.sin(ang) * r;
        if (T.heightAt(x, z) > 1.2 && !houseAt(c.world, x, z, 0.5)) break;
      }
      this.rotGoal = { phase: st.phase * 10 + (st.state === 'waiting' ? 0 : 1), x, z, stuck: this.stuckCount };
    }
    this.state = 'rotate';
    // 順路搜刮：附近有想要的東西且不是很趕
    const urgent = outside || tleft < travel + 4;
    if (!urgent && this.lootNear(10)) return false;
    this.goTo(this.rotGoal.x, this.rotGoal.z, a.pos.y, 'storm', true, dt, 3);
    return true;
  }

  // ---------- 搜刮 ----------
  pickupValue(it) {
    const inv = this.a.inventory, S = this.inv, free = inv.slots.includes(null);
    if (it.kind === 'weapon') {
      const v = WVALUE[it.defId] * (1 + 0.15 * it.rarity);
      if (!S.guns.length) return 100;
      const same = S.guns.filter((g) => g.it.defId === it.defId).sort((x, y) => y.it.rarity - x.it.rarity)[0];
      if (same) return it.rarity > same.it.rarity ? (it.rarity - same.it.rarity) * 9 + 3 : 0;
      if (it.defId === 'pistol') return S.guns.length < 2 ? 12 : 0;
      let worst = 99; for (const g of S.guns) worst = Math.min(worst, WVALUE[g.it.defId] * (1 + 0.15 * g.it.rarity));
      const catHave = (ids) => S.guns.some((g) => ids.includes(g.it.defId));
      const bonus = (it.defId === 'pump' && !catHave(['pump'])) || (it.defId === 'sniper' && !catHave(['sniper'])) || ((it.defId === 'ar' || it.defId === 'smg') && !catHave(['ar', 'smg'])) ? 4 : 1;
      if (S.guns.length >= 4 || !free) { if (v - worst < 1.8) return 0; return (v - worst) * 2.5 * bonus; }
      return v * bonus * 1.6;
    }
    if (it.kind === 'consumable') {
      let have = 0; for (const h of S.heal) if (h.it.defId === it.defId) have += h.it.count;
      const stack = S.heal.some((h) => h.it.defId === it.defId);
      if (!free && !stack) return 0;
      const want = { bandage: 8, minishield: 4, medkit: 2, shield: 2 }[it.defId] || 2;
      if (have >= want) return 0;
      return { shield: 42, minishield: 36, medkit: 32, bandage: 22 }[it.defId] || 15;
    }
    if (it.kind === 'ammo') {
      const t = it.defId.slice(5);
      if (!S.guns.some((g) => g.st.ammo === t)) return 0;
      return inv.ammo[t] < AMMO_WANT[t] * 0.65 ? 26 : 0;
    }
    if (it.kind === 'mats') return S.mats < 220 ? 14 : 0;
    return 0;
  }
  lootNear(R) {
    const a = this.a, c = this.ctx, now = c.time.now;
    for (const p of c.loot.pickups) {
      if (p.fly || (this.ignore.get(p) || 0) > now) continue;
      if (Math.abs(p.pos.x - a.pos.x) > R || Math.abs(p.pos.z - a.pos.z) > R || Math.abs(p.pos.y - a.pos.y) > 2.5) continue;
      if (this.pickupValue(p.item) >= 20) return true;
    }
    return false;
  }
  chooseLoot() {
    const c = this.ctx, a = this.a, now = c.time.now, W = c.world, S = this.inv;
    const R = S.guns.length ? 75 : 130, R2 = R * R;
    let best = null, bs = 0;
    const ax = a.pos.x, az = a.pos.z, ay = a.pos.y;
    const consider = (ref, x, y, z, value) => {
      const dx = x - ax, dz = z - az, d2 = dx * dx + dz * dz; if (d2 > R2) return;
      const d = Math.sqrt(d2), dy = Math.abs(y - ay);
      let cost = d;
      if (dy > 2.5) { if (!houseAt(W, x, z, 0.3) && !houseAt(W, ax, az, 0.3)) return; cost += 20; }
      if (c.storm.active && c.storm.state !== 'idle') { const nx = c.storm.next.center.x, nz = c.storm.next.center.y; if (Math.hypot(x - nx, z - nz) > c.storm.next.radius + 30 && c.storm.state === 'shrinking') return; }
      const sc = value / (cost + 14);
      if (sc > bs) { bs = sc; best = { ref, x, y, z, kind: ref.item ? 'pickup' : 'chest' }; }
    };
    for (const p of c.loot.pickups) {
      if (p.fly || (this.ignore.get(p) || 0) > now) continue;
      const v = this.pickupValue(p.item); if (v <= 0) continue;
      consider(p, p.pos.x, p.pos.y, p.pos.z, v);
    }
    for (const ch of c.loot.chests) {
      if (ch.opened || (this.ignore.get(ch) || 0) > now) continue;
      consider(ch, ch.x, ch.y, ch.z, S.guns.length ? 52 : 80);
    }
    this.lootBest = bs;
    return best;
  }
  lootTick(dt) {
    const c = this.ctx, a = this.a, I = a.intent, inv = a.inventory, now = c.time.now;
    // 目標失效檢查
    const L0 = this.loot;
    if (L0) {
      const gone = L0.kind === 'chest' ? L0.ref.opened : !c.loot.pickups.includes(L0.ref);
      if (gone || now - this.lootStart > 28) { if (!gone) this.ignore.set(L0.ref, now + 40); this.loot = null; this.goalKey = ''; }
    }
    if (!this.loot && now - this.lootAt > 0.6) {
      this.lootAt = now; const L = this.chooseLoot();
      if (L) { this.loot = L; this.lootStart = now; }
    }
    const L = this.loot;
    if (!L) return false;
    this.state = 'loot';
    const dx = L.x - a.pos.x, dz = L.z - a.pos.z, d = Math.hypot(dx, dz);
    const arrive = L.kind === 'chest' ? 1.7 : 1.1;
    if (d > arrive || Math.abs(L.y - a.pos.y) > 2.6) {
      const done = this.goTo(L.x, L.z, L.y, 'loot', d > 12 && this.skill > 0.3, dt, arrive);
      if (!done) return true;
      if (Math.abs(L.y - a.pos.y) > 2.6) { this.ignore.set(L.ref, now + 60); this.loot = null; return false; }
    }
    // 到達：互動
    this.moveIntent = false;
    this.look.mode = 'yaw'; this.look.yaw = Math.atan2(-dx, -dz); this.look.pitch = L.kind === 'chest' ? -0.5 : -0.9; this.look.rate = 8;
    if (L.kind === 'chest') {
      if (a.action && a.action.kind !== 'open') return true;
      I.interact = true; return true;
    }
    // 撿東西：背包滿了要先選好要被換掉的欄位
    const near = c.loot.nearestPickup(a);
    if (a.action) return true;
    const it = L.ref.item;
    if (!inv.slots.includes(null) && it.kind !== 'ammo' && it.kind !== 'mats') {
      const stack = it.kind === 'consumable' && this.inv.heal.some((h) => h.it.defId === it.defId);
      if (!stack) {
        const slot = this.worstSlot(it);
        if (slot < 0) { this.ignore.set(L.ref, now + 60); this.loot = null; return false; }
        if (inv.selected !== slot) { I.slot = slot; return true; }
      }
    }
    if (near && near.pickup !== L.ref && near.kind === 'pickup' && this.pickupValue(near.item) <= 0 && now - this.lootStart > 2.2) {
      // 附近有不要的東西擋住（最近的會先被撿）：放棄這個
      this.ignore.set(L.ref, now + 25); this.loot = null; return false;
    }
    I.interact = (this.tickN & 1) === 0;
    if (now - this.lootStart > 6 && d < 2) { this.ignore.set(L.ref, now + 30); this.loot = null; }
    return true;
  }
  worstSlot(newItem) {
    const S = this.inv; let worst = -1, ws = 1e9;
    const consumableCount = S.heal.length;
    if (newItem.kind === 'weapon') {
      for (const g of S.guns) { const v = WVALUE[g.it.defId] * (1 + 0.15 * g.it.rarity) + (g.it.defId === newItem.defId ? -50 : 0); if (v < ws) { ws = v; worst = g.slot; } }
      for (const h of S.heal) { if (h.it.defId === 'bandage' && consumableCount > 2) { worst = h.slot; ws = -99; } }
      return worst;
    }
    // 消耗品：換掉最差的槍（有兩把以上時）或較沒價值的消耗品
    if (S.guns.length >= 3) { for (const g of S.guns) { const v = WVALUE[g.it.defId] * (1 + 0.15 * g.it.rarity); if (v < ws) { ws = v; worst = g.slot; } } return worst; }
    return -1;
  }

  // ---------- 採集材料 ----------
  harvestTick(dt) {
    const c = this.ctx, a = this.a, I = a.intent, inv = a.inventory, now = c.time.now, S = this.inv;
    const H = this.harvest;
    if (H) {
      const r = H.ref;
      if (r.dead || S.mats >= H.until || now - H.start > 14) { this.harvest = null; this.harvestCd = now + 8 + Math.random() * 8; if (inv.selected === 0 && S.hasGun) { const g = this.bestGun(30); if (g) I.slot = g.slot; } return false; }
      this.state = 'harvest';
      const dx = r.x - a.pos.x, dz = r.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d > 1.9 && !(this.blocked && d < 3.2)) { this.blocked = false; this.goTo(r.x, r.z, a.pos.y, 'harvest', false, dt, 1.4); return true; }
      if (inv.selected !== 0) { I.slot = 0; return true; }
      this.moveIntent = false;
      this.look.mode = 'yaw'; this.look.yaw = Math.atan2(-dx, -dz); this.look.pitch = 0.05; this.look.rate = 8;
      const ap = this.aimV || (this.aimV = new THREE.Vector3());
      ap.set(r.x, a.pos.y + 1.3, r.z); I.aimPoint = ap; this.noAimOverride = true;
      I.fire = true; this.fireMode = 'off';
      return true;
    }
    if (S.mats >= 70 || now < this.harvestCd || (this.lootBest || 0) > 0.9) return false;
    if (now - this.landedAt < 6) return false;
    if (this.harvestScanAt > now - 1.5) return false;
    this.harvestScanAt = now;
    const W = c.world; let best = null, bd = 26 * 26;
    const scan = (arr) => { for (const r of arr) { if (r.dead) continue; const dx = r.x - a.pos.x, dz = r.z - a.pos.z, d2 = dx * dx + dz * dz; if (d2 < bd && (this.ignore.get(r) || 0) < now && Math.abs(r.y - a.pos.y) < 3) { bd = d2; best = r; } } };
    scan(W.treeRefs); scan(W.rockRefs);
    if (best && Math.random() < 0.7) this.harvest = { ref: best, start: now, until: 110 + Math.random() * 60 };
    else this.harvestCd = now + 6;
    return false;
  }

  // ---------- 閒晃 ----------
  roamTick(dt) {
    const c = this.ctx, a = this.a, st = c.storm, now = c.time.now;
    this.state = 'roam';
    if (!this.roam || now - this.roamAt > 25 || Math.hypot(this.roam.x - a.pos.x, this.roam.z - a.pos.z) < 5) {
      const T = c.terrain; const cn = st.active ? st.center : { x: 0, y: 0 }, R = st.active ? Math.min(st.radius, 380) : 300;
      let x = a.pos.x, z = a.pos.z;
      const W = c.world;
      for (let n = 0; n < 12; n++) {
        let tx, tz;
        if (Math.random() < 0.65) { const s = W.lootSpots[Math.floor(Math.random() * W.lootSpots.length)]; tx = s.x; tz = s.z; }
        else { const ang = Math.random() * 6.283, r = Math.sqrt(Math.random()) * R * 0.8; tx = cn.x + Math.cos(ang) * r; tz = cn.y + Math.sin(ang) * r; }
        if (T.heightAt(tx, tz) < 1.2) continue;
        if (st.active && st.isOutside(tx, tz)) continue;
        if (Math.hypot(tx - a.pos.x, tz - a.pos.z) < 15) continue;
        x = tx; z = tz; break;
      }
      this.roam = { x, z }; this.roamAt = now;
    }
    this.goTo(this.roam.x, this.roam.z, a.pos.y, 'roam', false, dt, 4);
  }
  simOK(o) {
    const b = this.bots, p = b.viewer();
    if (b.forceFull) return false;
    if (b.forceSim) return true;
    return Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z) > b.lodDist;
  }
}
Object.assign(Brain.prototype, NavMixin, CombatMixin);
