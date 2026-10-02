// Bot 導航：房屋門／樓梯路徑、障礙感測（射線 feeler）、卡住偵測階梯。只給 bots.js 引入。
import * as THREE from 'three';
import { clamp, angleDiff } from './shared.js';

export const NAV = {
  feel: 3.4,          // 前方感測距離
  stuckEvery: 0.5,    // 卡住偵測間隔
  stuckMove: 0.32,    // 該間隔內位移小於此值視為卡住
  stuckTimes: [0, 0.5, 1.2, 2.2, 5.0],  // 各階梯觸發的累計卡住秒數
};
const _o = new THREE.Vector3(), _d = new THREE.Vector3();
const HOUSE_L = 3.5;

// ---------- 房屋 ----------
export function houseAt(world, x, z, margin = 0) {
  for (const h of world.houses) {
    const dx = x - h.x, dz = z - h.z;
    if (dx * dx + dz * dz > (h.radius + 3) * (h.radius + 3)) continue;
    const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    if (Math.abs(lx) < h.W / 2 + margin && Math.abs(lz) < h.D / 2 + margin) return h;
  }
  return null;
}
export const floorOf = (h, y) => clamp(Math.round((y - h.y) / HOUSE_L), 0, h.floors - 1);
function doorPoints(h, door) {
  const W = h.W / 2, D = h.D / 2, a = door.a, side = door.side;
  let lx, lz, ox, oz;
  if (side === 'front') { lx = a; lz = -D; ox = 0; oz = -1; }
  else if (side === 'back') { lx = a; lz = D; ox = 0; oz = 1; }
  else if (side === 'left') { lx = -W; lz = a; ox = -1; oz = 0; }
  else { lx = W; lz = a; ox = 1; oz = 0; }
  const [ix, iz] = h.L2W(lx - ox * 1.7, lz - oz * 1.7), [ex, ez] = h.L2W(lx + ox * 2.0, lz + oz * 2.0);
  return { inside: { x: ix, z: iz }, outside: { x: ex, z: ez } };
}
function nearestDoor(h, x, z) {
  let best = null, bd = 1e9;
  for (const d of h.doors) { const p = doorPoints(h, d), q = Math.hypot(p.outside.x - x, p.outside.z - z); if (q < bd) { bd = q; best = p; } }
  return best;
}
function stairPts(h, up) {
  const s = h.stairs; if (!s) return [];
  const lx = s.lx, zs = s.zs;
  const bot = h.L2W(lx, zs - 0.9), top = h.L2W(lx, zs + 5.4), off = h.L2W(lx + 1.9, zs + 5.0);
  const B = { x: bot[0], z: bot[1] }, T = { x: top[0], z: top[1], y: 1 }, O = { x: off[0], z: off[1] };
  return up ? [B, T, O] : [O, T, B];
}
// 回傳需要經過的中途點（不含終點）
export function routeVia(world, from, to) {
  const hf = houseAt(world, from.x, from.z, 0.2), ht = houseAt(world, to.x, to.z, 0.2), pts = [];
  if (hf && hf === ht) {
    const f0 = floorOf(hf, from.y), f1 = floorOf(ht, to.y);
    if (f0 !== f1) pts.push(...stairPts(hf, f1 > f0));
    return pts;
  }
  let cx = from.x, cz = from.z;
  if (hf) {
    if (floorOf(hf, from.y) > 0) pts.push(...stairPts(hf, false));
    const d = nearestDoor(hf, to.x, to.z);
    if (d) { pts.push(d.inside, d.outside); cx = d.outside.x; cz = d.outside.z; }
  }
  if (ht) {
    const d = nearestDoor(ht, cx, cz);
    if (d) pts.push(d.outside, d.inside);
    if (floorOf(ht, to.y) > 0) pts.push(...stairPts(ht, true));
  }
  return pts;
}

// ---------- 繞過房屋 ----------
const INFL = 2.6;
// 線段 a→b 與房屋矩形（加寬 INFL）相交？回傳進入參數 t（0..1）或 -1
function segRect(h, ax, az, bx, bz) {
  const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
  const x0 = (ax - h.x) * c - (az - h.z) * s, z0 = (ax - h.x) * s + (az - h.z) * c;
  const x1 = (bx - h.x) * c - (bz - h.z) * s, z1 = (bx - h.x) * s + (bz - h.z) * c;
  const hx = h.W / 2 + INFL, hz = h.D / 2 + INFL;
  let t0 = 0, t1 = 1; const dx = x1 - x0, dz = z1 - z0;
  for (const [p, q] of [[-dx, x0 + hx], [dx, hx - x0], [-dz, z0 + hz], [dz, hz - z0]]) {
    if (Math.abs(p) < 1e-9) { if (q < 0) return -1; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return -1; if (r > t0) t0 = r; } else { if (r < t0) return -1; if (r < t1) t1 = r; }
  }
  return t0 <= t1 ? t0 : -1;
}
function inflated(h, x, z) {
  const c = Math.cos(h.yaw), s = Math.sin(h.yaw), dx = x - h.x, dz = z - h.z;
  return Math.abs(dx * c - dz * s) < h.W / 2 + INFL && Math.abs(dx * s + dz * c) < h.D / 2 + INFL;
}
function detour(world, a, b, skip, depth, out) {
  if (depth > 3) return;
  let hit = null, bt = 2;
  for (const h of world.houses) {
    if (skip.has(h)) continue;
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, R = Math.hypot(b.x - a.x, b.z - a.z) / 2 + h.radius + INFL + 2;
    if ((h.x - mx) ** 2 + (h.z - mz) ** 2 > R * R) continue;
    const t = segRect(h, a.x, a.z, b.x, b.z);
    if (t >= 0 && t < bt) { bt = t; hit = h; }
  }
  if (!hit) return;
  const h = hit, hx = h.W / 2 + INFL + 0.4, hz = h.D / 2 + INFL + 0.4;
  let best = null, bl = 1e9;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const [cx, cz] = h.L2W(sx * hx, sz * hz), len = Math.hypot(cx - a.x, cz - a.z) + Math.hypot(cx - b.x, cz - b.z) + Math.random() * 6;
    if (len < bl) { bl = len; best = { x: cx, z: cz }; }
  }
  const sk = new Set(skip); sk.add(h);
  detour(world, a, best, sk, depth + 1, out); out.push(best); detour(world, best, b, sk, depth + 1, out);
}
export function planPath(world, from, to) {
  const via = routeVia(world, from, to), seq = [...via, to], out = [];
  let cur = from;
  for (const nx of seq) {
    // 端點所在的房屋（正要進出）不繞
    const skip = new Set();
    for (const h of world.houses) if (inflated(h, cur.x, cur.z) || inflated(h, nx.x, nx.z)) skip.add(h);
    detour(world, cur, nx, skip, 0, out);
    if (nx !== to) out.push(nx);
    cur = nx;
  }
  return out;
}

// ---------- 導航方法（mixin 到 Brain） ----------
export const NavMixin = {
  // 設定目標點（會算房屋中途點）。kind 僅用於 debug。
  setGoal(x, z, y, kind) {
    const a = this.a;
    this.goal = { x, z, y: y == null ? a.pos.y : y, kind: kind || 'goto' };
    this.route = planPath(this.ctx.world, a.pos, this.goal);
    this.goalAt = this.ctx.time.now; this.stuckLvl = 0; this.stuckT = 0;
  },
  clearGoal() { this.goal = null; this.route = null; },
  // 目前要追的點（中途點優先）
  waypoint() {
    const a = this.a, g = this.goal; if (!g) return null;
    while (this.route && this.route.length) {
      const w = this.route[0];
      if (Math.hypot(w.x - a.pos.x, w.z - a.pos.z) < 1.1) this.route.shift(); else return w;
    }
    return g;
  },
  // 沿方向 yaw 的可走距離（水平 raycast，略過地形；另檢查水與陡坡）
  clearAlong(yaw, len, hi = 0.9) {
    const a = this.a, P = this.ctx.physics, T = this.ctx.terrain;
    const dx = -Math.sin(yaw), dz = -Math.cos(yaw);
    _o.set(a.pos.x, a.pos.y + hi, a.pos.z); _d.set(dx, 0, dz);
    const h = P.raycast(_o, _d, len, { skipTerrain: true });
    let free = h ? Math.max(0, h.dist - 0.35) : len;
    // 水與陡坡
    const g0 = T.heightAt(a.pos.x, a.pos.z);
    for (let t = 1.5; t <= Math.min(free, len); t += 1.5) {
      const hh = T.heightAt(a.pos.x + dx * t, a.pos.z + dz * t);
      if (hh < -0.05 && !this.allowWater) return Math.max(0, t - 1.5);
      if (Math.abs(hh - g0) > 1.55 * t + 0.8 && hh > g0 + 0.8 && this.ctx.physics.groundHeight(a.pos.x + dx * t, a.pos.z + dz * t, a.pos.y + 1, 0.3).colliderId == null) return Math.max(0, t - 1.5);
    }
    return free;
  },
  // 朝 (tx,tz) 前進一步：決定 moveZ / 面向 / 跳躍。回傳是否在移動。
  navStep(tx, tz, sprint, dt) {
    const a = this.a, I = a.intent, now = this.ctx.time.now;
    const want = Math.atan2(-(tx - a.pos.x), -(tz - a.pos.z));
    const dist = Math.hypot(tx - a.pos.x, tz - a.pos.z);
    let yaw = want;
    if (this.avoidUntil > now) yaw = this.avoidYaw;
    else {
      const L = Math.min(NAV.feel, Math.max(1.6, dist));
      const f = this.clearAlong(want, L);
      if (f < L - 0.2) {
        // 低矮障礙：膝蓋高度擋、頭部高度通 → 跳
        const hiClear = this.clearAlong(want, Math.min(L, 1.6), 1.6);
        const lowClear = this.clearAlong(want, Math.min(L, 1.2), 0.45);
        if (f > 0.9 && hiClear > lowClear + 0.3) { this.hop = true; }
        else {
          let best = -1, by = want;
          const side = this.avoidSide || (this.avoidSide = Math.random() < 0.5 ? 1 : -1);
          for (const off of [0.55, 1.0, 1.5, 2.1]) for (const sgn of [side, -side]) {
            const y2 = want + off * sgn, c = this.clearAlong(y2, L);
            if (c > best + 0.01) { best = c; by = y2; if (c >= L - 0.2) break; }
            if (c >= L - 0.2) break;
          }
          if (best > f + 0.3) { yaw = by; this.avoidYaw = by; this.avoidUntil = now + 0.55; this.avoidSide = angleDiff(want, by) >= 0 ? 1 : -1; }
          else if (f < 0.9) { yaw = want; this.blocked = true; }
        }
      }
    }
    this.look.mode = 'yaw'; this.look.yaw = yaw; this.look.pitch = clamp(-0.05, -1, 1); this.look.rate = 7;
    I.moveZ = Math.abs(angleDiff(a.yaw, yaw)) > 1.9 ? 0.2 : 1;
    if (this.stuckSide) { I.moveX = this.stuckSide; if (now > this.stuckSideUntil) this.stuckSide = 0; } else I.moveX = 0;
    I.sprint = !!sprint;
    if (this.hop) { I.jump = true; this.hop = false; }
    this.moveIntent = true;
    return true;
  },
  // 卡住階梯。回傳 true 表示本 tick 由卡住處理（打穿牆）接管。
  // 兩個偵測器：微觀（0.5 s 內位移太小）與宏觀（1.2 s 內離目標沒靠近 1.6 m，抓原地繞圈／沿牆來回）。
  stuckTick(dt) {
    const a = this.a, now = this.ctx.time.now;
    if (this.breakUntil > now) return true;
    if (!this.wasMoving) { this.microT = this.macroT = 0; this.stuckT = 0; this.stuckLvl = 0; this.stuckAt = now; this.bestAt = undefined; this.stuckX = a.pos.x; this.stuckZ = a.pos.z; return false; }
    if (this.stuckAt === undefined) { this.stuckAt = now; this.stuckX = a.pos.x; this.stuckZ = a.pos.z; this.microT = this.macroT = 0; }
    if (now - this.stuckAt >= NAV.stuckEvery) {
      const moved = Math.hypot(a.pos.x - this.stuckX, a.pos.z - this.stuckZ) + Math.abs(a.pos.y - (this.stuckY || a.pos.y)) * 0.5;
      this.stuckX = a.pos.x; this.stuckZ = a.pos.z; this.stuckY = a.pos.y; this.stuckAt = now;
      if (moved < NAV.stuckMove && a.state !== 'air') this.microT += NAV.stuckEvery; else this.microT = Math.max(0, this.microT - NAV.stuckEvery * 1.5);
      // 宏觀：到目前中途點的最短距離有多久沒再刷新（原地繞圈／沿牆來回都會停滯）
      this.macroT = 0;
      if (this.goal) {
        const w = this.waypoint() || this.goal, dg = Math.hypot(w.x - a.pos.x, w.z - a.pos.z);
        if (this.bestW !== w || this.bestAt === undefined) { this.bestW = w; this.bestD = dg; this.bestAt = now; }
        else if (dg < this.bestD - 1.0) { this.bestD = dg; this.bestAt = now; }
        if (a.state !== 'air' && dg > 3) this.macroT = Math.max(0, now - this.bestAt - 0.8);
      }
      this.stuckT = this.microT + this.macroT;
      if (this.stuckT > 8.5) { this.microT = 0; this.bestAt = now - 2.3; this.stuckT = 1.5; this.stuckLvl = 1; }   // 階梯跑完還沒脫困 → 循環重來
      const T = NAV.stuckTimes;
      let lvl = 0; for (let i = T.length - 1; i >= 1; i--) if (this.stuckT >= T[i]) { lvl = i; break; }
      if (lvl === 0 && this.stuckT < 0.3) this.stuckLvl = 0;
      while (lvl > this.stuckLvl) { this.stuckLvl++; this.onStuck(this.stuckLvl); }
    }
    return this.breakUntil > now;
  },
  onStuck(lvl) {
    const a = this.a, I = a.intent, now = this.ctx.time.now;
    this.stuckCount = (this.stuckCount || 0) + 1;
    if (lvl === 1) { I.jump = true; this.stuckSide = Math.random() < 0.5 ? 1 : -1; this.stuckSideUntil = now + 0.6; }
    else if (lvl === 2) { if (this.goal) this.route = planPath(this.ctx.world, a.pos, this.goal); this.avoidYaw = a.yaw + (Math.random() < 0.5 ? 1 : -1) * (1.2 + Math.random() * 0.8); this.avoidUntil = now + 1.1; I.jump = true; }
    else if (lvl === 3) { this.breakUntil = now + 2.8; this.breakThrough = true; }
    else if (lvl >= 4) {
      if (!this.buildRampOver()) { this.avoidYaw = a.yaw + Math.PI * (0.6 + Math.random() * 0.8); this.avoidUntil = now + 1.5; }
      if (this.goal && this.goal.kind !== 'storm' && this.goal.kind !== 'test') this.ignoreGoal();
    }
  },
  // 用十字鎬打穿面前的牆
  breakStep() {
    const a = this.a, I = a.intent, inv = a.inventory;
    if (inv.selected !== 0) I.slot = 0;
    const dx = -Math.sin(a.yaw), dz = -Math.cos(a.yaw);
    _o.set(a.pos.x, a.pos.y + 1.0, a.pos.z); _d.set(dx, 0, dz);
    const h = this.ctx.physics.raycast(_o, _d, 6, { skipTerrain: true });
    const pa = this.aimV || (this.aimV = new THREE.Vector3());
    if (h) { pa.copy(h.point); I.aimPoint = pa; } else { I.aimPoint = null; }
    I.fire = inv.selected === 0 && !!h && h.dist < 2.3; I.moveZ = !h || h.dist > 1.7 ? 1 : 0; I.sprint = false; if (h) this.moveIntent = false; else this.moveIntent = true;
    this.look.mode = 'yaw'; this.look.yaw = a.yaw; this.look.pitch = 0;
    this.noAimOverride = true;
  },
  // 前方放斜坡越障（需要材料）
  buildRampOver() {
    const a = this.a, inv = a.inventory, B = this.ctx.build;
    if (!this.pickMat(10)) return false;
    const dir = B.cardinal(a.yaw), level = Math.floor((a.pos.y + 0.4) / 3.5);
    const DX = [0, 1, 0, -1], DZ = [-1, 0, 1, 0];
    const i0 = Math.floor(a.pos.x / 4), k0 = Math.floor(a.pos.z / 4);
    const p = B.placeAt(a, { piece: 'ramp', i: i0 + DX[dir], k: k0 + DZ[dir], level, edge: dir });
    if (p) this.avoidUntil = 0;
    return !!p;
  },
};
