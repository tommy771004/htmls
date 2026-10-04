// 玩家推進：移動、跳傘、武器計時與開火。伺服器（權威）與前端（預測重播）跑同一份。
import { groundAt, resolveXZ, ceilingAt, terrainAt, STEP, WATER_FLOOR } from './physics.js';
import { WEAPONS, magOf, RARITY, BITS, PLATE, PLATE_TIME, PLATE_INV_MAX, HP_MAX, REGEN_DELAY, REGEN_RATE, PLANE_ALT } from './rules.js';
import { hash2 } from './rng.js';

export const MODE = { PLANE: 0, FALL: 1, CHUTE: 2, GROUND: 3, DEAD: 4, SPECT: 5 };
export const STAND_H = 1.8, CROUCH_H = 1.25;
export const eyeHeight = (p) => (p.cr ? 1.12 : 1.62);
const G = 20;

export function newPlayer(id, name, bot = false) {
  return {
    id, name, bot,
    x: 0, y: PLANE_ALT, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0,
    mode: MODE.PLANE, og: 0, cr: 0, ads: 0, spr: 0,
    hp: HP_MAX, ar: 0, vest: 1, pinv: 1, pt: 0,
    slots: [['p9', 0, 15], null], cur: 0,
    ammo: { l: 45, h: 0, s: 0, n: 0 },
    rt: 0, cool: 0, swapT: 0, shotN: 0, pb: 0, lastHit: -99, dropT: 0,
    kills: 0, dmg: 0, place: 0,
  };
}

// 前端重播只需要這些欄位
const PRED_KEYS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'mode', 'og', 'cr', 'ads', 'spr', 'hp', 'ar', 'vest', 'pinv', 'pt', 'cur', 'rt', 'cool', 'swapT', 'shotN', 'pb', 'lastHit'];
export function packSelf(p) {
  const o = {};
  for (const k of PRED_KEYS) o[k] = typeof p[k] === 'number' ? Math.round(p[k] * 1000) / 1000 : p[k];
  o.slots = p.slots.map((s) => (s ? s.slice() : null));
  o.ammo = { ...p.ammo };
  o.kills = p.kills; o.dmg = Math.round(p.dmg);
  return o;
}
export function applySelf(p, o) {
  for (const k of PRED_KEYS) p[k] = o[k];
  p.slots = o.slots.map((s) => (s ? s.slice() : null));
  p.ammo = { ...o.ammo };
  p.kills = o.kills; p.dmg = o.dmg;
}

export function aimDir(yaw, pitch) {
  const cp = Math.cos(pitch);
  return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
}

// 依射擊序號產生決定性的散布，前端預測曳光彈方向與伺服器一致
export function shotDirs(p, w, spread) {
  const W = WEAPONS[w], n = W.pellets || 1, out = [];
  for (let k = 0; k < n; k++) {
    const a = hash2(p.id * 7 + 3, p.shotN * 31 + k, 99) * 6.283185307, r = Math.sqrt(hash2(p.id * 13 + 1, p.shotN * 17 + k, 7)) * spread;
    const yaw = p.yaw + Math.cos(a) * r, pitch = p.pitch + Math.sin(a) * r;
    out.push(aimDir(yaw, pitch));
  }
  return out;
}

export function currentSpread(p) {
  const s = p.slots[p.cur];
  if (!s) return 0.05;
  const W = WEAPONS[s[0]];
  const sp = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
  let base = W.hip + (W.ads - W.hip) * p.ads;
  base += Math.min(sp / 7, 1) * 0.02 * (1 - p.ads * 0.7);
  if (!p.og) base += 0.05;
  if (p.cr) base *= 0.8;
  return base;
}

export function planePos(plane, t) {
  const dx = plane.bx - plane.ax, dz = plane.bz - plane.az, L = Math.sqrt(dx * dx + dz * dz);
  const u = ((t - plane.t0) * plane.speed) / L;
  return { x: plane.ax + dx * u, z: plane.az + dz * u, u, dx: dx / L, dz: dz / L };
}

// 一個固定 dt 的推進；inp = { b: 按鍵位元, yaw, pitch }；fx 為 null 時是重播（不觸發效果）
export function stepPlayer(p, inp, ctx, fx) {
  const { W, dt } = ctx;
  const b = inp.b | 0, pressed = b & ~p.pb;
  p.yaw = inp.yaw; p.pitch = Math.max(-1.5, Math.min(1.5, inp.pitch));
  if (p.mode === MODE.DEAD || p.mode === MODE.SPECT) { p.pb = b; return; }

  if (p.mode === MODE.PLANE) {
    const pp = planePos(ctx.plane, ctx.time);
    p.x = pp.x; p.z = pp.z; p.y = PLANE_ALT - 2; p.vx = pp.dx * ctx.plane.speed; p.vz = pp.dz * ctx.plane.speed; p.vy = 0;
    const overLand = pp.u > 0.06;
    if ((pressed & BITS.JUMP && overLand) || pp.u >= 0.97) {
      p.mode = MODE.FALL; p.y = PLANE_ALT - 6; p.vx *= 0.35; p.vz *= 0.35; p.vy = -6;
      fx?.event?.(p, 'jump');
    }
    p.pb = b; return;
  }

  const fwd = (b & BITS.FWD ? 1 : 0) - (b & BITS.BACK ? 1 : 0);
  const str = (b & BITS.RIGHT ? 1 : 0) - (b & BITS.LEFT ? 1 : 0);
  const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
  const fxv = -sy, fzv = -cy, rxv = cy, rzv = -sy;

  if (p.mode === MODE.FALL || p.mode === MODE.CHUTE) {
    const g = groundAt(W, p.x, p.z, p.y, 0.34, 0.4);
    const hag = p.y - g;
    if (p.mode === MODE.FALL) {
      const hs = fwd > 0 ? 34 : fwd < 0 ? 7 : 17, vt = fwd > 0 ? -54 : fwd < 0 ? -30 : -40;
      const tx = fxv * hs + rxv * str * 12, tz = fzv * hs + rzv * str * 12;
      const k = Math.min(1, 1.4 * dt);
      p.vx += (tx - p.vx) * k; p.vz += (tz - p.vz) * k; p.vy += (vt - p.vy) * Math.min(1, 1.2 * dt);
      if ((pressed & BITS.JUMP && hag > 12) || hag < 95) { p.mode = MODE.CHUTE; p.vy = Math.max(p.vy, -14); fx?.event?.(p, 'chute'); }
    } else {
      const hs = fwd > 0 ? 18 : fwd < 0 ? 5 : 11, vt = fwd > 0 ? -9.5 : fwd < 0 ? -4.2 : -6.2;
      const tx = fxv * hs + rxv * str * 7, tz = fzv * hs + rzv * str * 7;
      const k = Math.min(1, 1.1 * dt);
      p.vx += (tx - p.vx) * k; p.vz += (tz - p.vz) * k; p.vy += (vt - p.vy) * Math.min(1, 2.2 * dt);
      if (pressed & BITS.JUMP && hag > 130) { p.mode = MODE.FALL; fx?.event?.(p, 'cut'); }
    }
    p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt;
    resolveXZ(p, W, STAND_H, false);
    const g2 = groundAt(W, p.x, p.z, p.y + 0.6, 0.34, 0.2);
    if (p.y <= g2) {
      p.y = g2; p.vy = 0; p.mode = MODE.GROUND; p.og = 1; p.vx *= 0.3; p.vz *= 0.3; p.dropT = ctx.time;
      fx?.event?.(p, 'land');
    }
    clampBounds(p);
    p.pb = b; return;
  }

  // ---- 地面 ----
  const inWater = p.y < -0.35;
  // 蹲下／站起（頭頂有東西時不能站）
  const wantCrouch = !!(b & BITS.CROUCH);
  if (wantCrouch) p.cr = 1;
  else if (p.cr && ceilingAt(W, p.x, p.z, p.y, STAND_H) > p.y + STAND_H) p.cr = 0;
  const slot = p.slots[p.cur], WP = slot ? WEAPONS[slot[0]] : null;
  const firing = !!(b & BITS.FIRE) && slot && p.rt <= 0 && p.pt <= 0 && p.swapT <= 0;
  p.ads += ((b & BITS.ADS && !inWater ? 1 : 0) - p.ads) * Math.min(1, dt * 9);
  if (p.ads < 0.01) p.ads = 0; else if (p.ads > 0.99) p.ads = 1;
  p.spr = b & BITS.SPRINT && fwd > 0 && !p.cr && p.ads < 0.3 && !firing && p.pt <= 0 && !inWater ? 1 : 0;
  let speed = p.spr ? 7.2 : p.cr ? 2.4 : 4.8;
  speed *= 1 - p.ads * 0.42;
  if (inWater) speed *= 0.55;
  if (p.pt > 0) speed *= 0.6;
  let wx = fxv * fwd + rxv * str, wz = fzv * fwd + rzv * str;
  const wl = Math.sqrt(wx * wx + wz * wz);
  if (wl > 0) { wx = (wx / wl) * speed; wz = (wz / wl) * speed; }
  const acc = p.og ? 55 : 7;
  const dvx = wx - p.vx, dvz = wz - p.vz, dl = Math.sqrt(dvx * dvx + dvz * dvz), mx = acc * dt;
  if (dl <= mx) { p.vx = wx; p.vz = wz; } else { p.vx += (dvx / dl) * mx; p.vz += (dvz / dl) * mx; }
  if (pressed & BITS.JUMP && p.og && !inWater) { p.vy = 6.4; p.og = 0; fx?.event?.(p, 'hop'); }
  p.vy -= G * dt;
  const H = p.cr ? CROUCH_H : STAND_H;
  // 以小步推進避免穿牆
  const steps = Math.max(1, Math.ceil(Math.sqrt(p.vx * p.vx + p.vz * p.vz) * dt / 0.25));
  for (let s = 0; s < steps; s++) {
    p.x += (p.vx * dt) / steps; p.z += (p.vz * dt) / steps;
    resolveXZ(p, W, H, true);
  }
  p.y += p.vy * dt;
  if (p.vy > 0) { const c = ceilingAt(W, p.x, p.z, p.y, H); if (p.y + H > c) { p.y = c - H; p.vy = 0; } }
  const g = groundAt(W, p.x, p.z, p.y);
  if (p.y <= g) { if (!p.og && p.vy < -12) fx?.event?.(p, 'thud'); p.y = g; p.vy = 0; p.og = 1; }
  else if (p.og && p.y - g < STEP && p.vy <= 0) { p.y = g; p.vy = 0; }
  else p.og = 0;
  if (p.y < WATER_FLOOR) p.y = WATER_FLOOR;
  clampBounds(p);

  // ---- 武器 ----
  p.cool = Math.max(-dt, p.cool - dt);
  if (p.swapT > 0) p.swapT = Math.max(0, p.swapT - dt);
  let want = -1;
  if (pressed & BITS.SLOT1) want = 0;
  if (pressed & BITS.SLOT2) want = 1;
  if (pressed & BITS.SWAP) want = 1 - p.cur;
  if (want >= 0 && want !== p.cur && p.slots[want]) { p.cur = want; p.rt = 0; p.swapT = 0.4; p.cool = 0; fx?.event?.(p, 'swap'); }
  const s2 = p.slots[p.cur];
  if (s2) {
    const W2 = WEAPONS[s2[0]], mag = magOf(s2[0], s2[1]);
    if (p.rt > 0) {
      p.rt -= dt;
      if (p.rt <= 0) {
        const take = Math.min(mag - s2[2], p.ammo[W2.ammo]);
        s2[2] += take; p.ammo[W2.ammo] -= take; p.rt = 0;
      }
    } else if (((pressed & BITS.RELOAD) || (s2[2] === 0 && b & BITS.FIRE)) && s2[2] < mag && p.ammo[W2.ammo] > 0 && p.swapT <= 0) {
      p.rt = W2.reload; fx?.event?.(p, 'reload');
    }
    const trig = W2.auto ? b & BITS.FIRE : pressed & BITS.FIRE;
    if (trig && p.rt <= 0 && p.swapT <= 0 && p.pt <= 0 && p.cool <= 0 && s2[2] > 0) {
      const spread = currentSpread(p);
      const dirs = shotDirs(p, s2[0], spread);
      s2[2]--; p.shotN++; p.cool += 60 / W2.rpm; p.spr = 0;
      fx?.fire?.(p, s2[0], s2[1], dirs, inp);
    }
    void WP;
  }
  // ---- 護甲片 ----
  const cap = p.vest * PLATE;
  if (p.pt > 0) {
    p.pt -= dt;
    if (p.pt <= 0) { p.pt = 0; p.pinv--; p.ar = Math.min(cap, p.ar + PLATE); fx?.event?.(p, 'plated'); }
  } else if (b & BITS.PLATE && p.pinv > 0 && p.ar < cap && p.rt <= 0) {
    p.pt = PLATE_TIME; fx?.event?.(p, 'plate');
  }
  // ---- 生命回復 ----
  if (ctx.time - p.lastHit > REGEN_DELAY && p.hp < HP_MAX) p.hp = Math.min(HP_MAX, p.hp + REGEN_RATE * dt);
  p.pb = b;
}

function clampBounds(p) {
  const L = 1240;
  if (p.x < -L) p.x = -L; if (p.x > L) p.x = L; if (p.z < -L) p.z = -L; if (p.z > L) p.z = L;
}

export { RARITY, PLATE_INV_MAX, terrainAt };
