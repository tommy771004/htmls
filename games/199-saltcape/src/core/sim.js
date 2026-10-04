// 權威對局：運輸機、跳傘、戰利品、命中裁定（含延遲補償）、毒圈、擊殺與勝負。
// 不碰網路與 DOM：伺服器與前端的離線練習都直接跑這個類別。
import { mulberry32 } from './rng.js';
import { heightAt } from './map.js';
import { raycastWorld, terrainAt } from './physics.js';
import { stepPlayer, newPlayer, MODE, eyeHeight, packSelf, STAND_H, CROUCH_H, planePos } from './player.js';
import {
  TICK, DT, WEAPONS, WEAPON_KEYS, RARITY, AMMO, AMMO_KEYS, LOOT, weaponCode, decodeLoot, magOf,
  PLATE_INV_MAX, PLANE_ALT, PLANE_SPEED, BITS,
} from './rules.js';
import { newStorm, stormTick, outside, stormDps, packStorm } from './storm.js';
import { botThink, initBot } from './bots.js';

const HIST = 24;
const q = (v, s) => Math.round(v * s);

export class Match {
  constructor({ W, seed = 1, roster = [], fast = 1 }) {
    this.W = W;
    this.seed = seed >>> 0;
    this.rnd = mulberry32(this.seed);
    this.tick = 0;
    this.time = 0;
    this.fast = fast;
    this.players = [];
    this.byId = new Map();
    this.loot = new Map();
    this.lootId = 1;
    this.out = new Map();          // 每名真人的事件匣
    this.queue = new Map();        // 每名真人的輸入佇列
    this.lastInput = new Map();
    this.bucket = new Map();
    this.ack = new Map();
    this.hist = [];
    this.over = false;
    this.winner = -1;
    this.elims = [];               // 依淘汰順序
    this.storm = newStorm();
    this.stormAcc = new Map();
    const a = this.rnd() * Math.PI * 2, off = (this.rnd() - 0.5) * 500, L = 1250;
    const px = Math.cos(a + Math.PI / 2) * off, pz = Math.sin(a + Math.PI / 2) * off;
    this.plane = { ax: px - Math.cos(a) * L, az: pz - Math.sin(a) * L, bx: px + Math.cos(a) * L, bz: pz + Math.sin(a) * L, alt: PLANE_ALT, speed: PLANE_SPEED, t0: 0 };
    for (const r of roster) this.addPlayer(r.id, r.name, r.bot);
    this.spawnLoot();
  }

  addPlayer(id, name, bot = false, spectator = false) {
    const p = newPlayer(id, name, bot);
    const pp = planePos(this.plane, this.time);
    p.x = pp.x; p.z = pp.z;
    if (spectator) p.mode = MODE.SPECT;
    if (bot) initBot(p, this);
    else { this.out.set(id, []); this.queue.set(id, []); this.ack.set(id, 0); }
    this.players.push(p);
    this.byId.set(id, p);
    return p;
  }
  canJoinPlane() { return planePos(this.plane, this.time).u < 0.55; }
  removeHuman(id) {
    // 斷線玩家原地保留（可被擊殺）；由伺服器決定何時視為離開
    this.queue.set(id, []);
  }

  alive() { return this.players.filter((p) => p.mode !== MODE.DEAD && p.mode !== MODE.SPECT); }

  // ---- 戰利品 ----
  spawnLoot() {
    const r = mulberry32(this.seed ^ 0x5a17);
    const pickW = (tier) => {
      const roll = r();
      const pool = tier >= 2 ? ['ar', 'ar', 'dmr', 'smg', 'sg', 'sr'] : tier === 1 ? ['smg', 'ar', 'sg', 'p9', 'ar', 'smg', 'dmr'] : ['p9', 'smg', 'sg', 'ar', 'smg'];
      const w = pool[Math.floor(roll * pool.length)];
      const rr = r() + tier * 0.12;
      const rar = rr > 0.95 ? 3 : rr > 0.78 ? 2 : rr > 0.45 ? 1 : 0;
      return [w, w === 'sr' && tier < 3 && r() < 0.5 ? 'dmr' : w, rar];
    };
    for (const [x, y, z, tier] of this.W.loot) {
      const chance = [0.5, 0.72, 0.9, 1][tier];
      if (r() > chance) continue;
      const roll = r();
      const j = () => (r() - 0.5) * 0.9;
      if (roll < 0.42 || tier === 3) {
        const [, w, rar] = pickW(tier);
        this.addLoot(weaponCode(w, rar), magOf(w, rar), x + j(), y, z + j());
        const a = WEAPONS[w].ammo;
        this.addLoot(LOOT.AMMO0 + AMMO_KEYS.indexOf(a), AMMO[a].pack, x + 0.7 + j() * 0.3, y, z + 0.4 + j() * 0.3);
      } else if (roll < 0.66) {
        const a = AMMO_KEYS[Math.floor(r() * 3.4) % 4];
        this.addLoot(LOOT.AMMO0 + AMMO_KEYS.indexOf(a), AMMO[a].pack, x + j(), y, z + j());
      } else if (roll < 0.9) {
        this.addLoot(LOOT.PLATE, 1 + Math.floor(r() * 2.2), x + j(), y, z + j());
      } else {
        this.addLoot(r() < 0.75 - tier * 0.15 ? LOOT.VEST2 : LOOT.VEST3, 1, x + j(), y, z + j());
      }
    }
  }
  addLoot(code, amt, x, y, z, emit = false) {
    const id = this.lootId++;
    const it = { id, code, amt, x, y, z };
    this.loot.set(id, it);
    if (emit) this.emitAll({ e: 'l+', l: [packLoot(it)] });
    return it;
  }
  removeLoot(id) { if (this.loot.delete(id)) this.emitAll({ e: 'l-', i: [id] }); }

  pickup(p, id, auto = false) {
    const it = this.loot.get(id);
    if (!it || p.mode !== MODE.GROUND) return false;
    const dx = it.x - p.x, dz = it.z - p.z, dy = it.y - p.y;
    if (dx * dx + dz * dz > (auto ? 1.6 * 1.6 : 2.8 * 2.8) || dy < -1.2 || dy > 2.2) return false;
    const d = decodeLoot(it.code);
    if (d.kind === 'a') {
      const room = AMMO[d.a].cap - p.ammo[d.a];
      if (room <= 0) return false;
      const take = Math.min(room, it.amt);
      p.ammo[d.a] += take; it.amt -= take;
      if (it.amt <= 0) this.removeLoot(id); else this.emitAll({ e: 'l~', i: id, a: it.amt });
    } else if (d.kind === 'p') {
      const room = PLATE_INV_MAX - p.pinv;
      if (room <= 0) return false;
      const take = Math.min(room, it.amt);
      p.pinv += take; it.amt -= take;
      if (it.amt <= 0) this.removeLoot(id); else this.emitAll({ e: 'l~', i: id, a: it.amt });
    } else if (d.kind === 'v') {
      if (auto || d.lv <= p.vest) return false;
      p.vest = d.lv; this.removeLoot(id);
    } else if (d.kind === 'w') {
      if (auto) return false;
      let slot = p.slots.findIndex((s) => !s);
      if (slot < 0) {
        slot = p.cur;
        const old = p.slots[slot];
        this.addLoot(weaponCode(old[0], old[1]), old[2], p.x, p.y + 0.02, p.z, true);
      }
      p.slots[slot] = [d.w, d.r, it.amt];
      p.cur = slot; p.rt = 0; p.swapT = 0.5;
      this.removeLoot(id);
    } else return false;
    this.emitTo(p.id, { e: 'got', c: it.code, a: auto ? 1 : 0 });
    return true;
  }

  // ---- 事件 ----
  emitAll(ev) { for (const box of this.out.values()) box.push(ev); }
  emitTo(id, ev) { this.out.get(id)?.push(ev); }
  emitNear(x, z, R, ev, except = -1) {
    for (const [id, box] of this.out) {
      if (id === except) continue;
      const p = this.byId.get(id), f = p && (p.mode === MODE.DEAD || p.mode === MODE.SPECT) ? this.byId.get(p.watch) || p : p;
      if (!f) continue;
      const dx = f.x - x, dz = f.z - z;
      if (dx * dx + dz * dz < R * R) box.push(ev);
    }
  }

  queueInput(id, list) {
    const qd = this.queue.get(id);
    if (!qd) return;
    let last = this.ack.get(id) || 0;
    for (const i of list) {
      if (!(i.s > last)) continue;
      qd.push(i); last = i.s;
    }
    if (qd.length > 30) qd.splice(0, qd.length - 30);
  }

  // ---- 命中裁定 ----
  rewound(target, tickF) {
    const back = this.tick - tickF;
    if (back <= 0 || this.hist.length < 2) return target;
    const i0 = Math.min(this.hist.length - 1, Math.floor(back)), i1 = Math.min(this.hist.length - 1, i0 + 1), f = back - Math.floor(back);
    const a = this.hist[this.hist.length - 1 - i0].get(target.id), b = this.hist[this.hist.length - 1 - i1].get(target.id);
    if (!a || !b) return target;
    return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, z: a[2] + (b[2] - a[2]) * f, cr: a[3] };
  }
  fire(p, w, rar, dirs, inp) {
    const W = WEAPONS[w];
    const ex = p.x, ey = p.y + eyeHeight(p), ez = p.z;
    const vt = typeof inp.vt === 'number' ? Math.max(this.tick - 12, Math.min(this.tick, inp.vt)) : this.tick;
    const range = Math.min(520, W.r2 * 2.6);
    const ends = [];
    const hits = new Map();
    for (const [dx, dy, dz] of dirs) {
      let best = raycastWorld(this.W, ex, ey, ez, dx, dy, dz, range), victim = null, head = false;
      for (const t of this.players) {
        if (t === p || t.mode === MODE.DEAD || t.mode === MODE.SPECT || t.mode === MODE.PLANE) continue;
        const r = this.rewound(t, vt);
        const ox = r.x - ex, oz = r.z - ez;
        if (ox * ox + oz * oz > (best + 2) * (best + 2)) continue;
        const H = r.cr ? CROUCH_H : STAND_H;
        // 頭：球
        const hy = r.y + H - 0.18;
        const th = raySphere(ex, ey, ez, dx, dy, dz, r.x, hy, r.z, 0.2);
        if (th >= 0 && th < best) { best = th; victim = t; head = true; }
        const tb = rayBox(ex, ey, ez, dx, dy, dz, r.x - 0.32, r.y, r.z - 0.32, r.x + 0.32, r.y + H - 0.36, r.z + 0.32);
        if (tb >= 0 && tb < best) { best = tb; victim = t; head = false; }
      }
      ends.push([ex + dx * best, ey + dy * best, ez + dz * best]);
      if (victim) {
        const fall = best <= W.r1 ? 1 : best >= W.r2 ? W.fall : 1 + (W.fall - 1) * ((best - W.r1) / (W.r2 - W.r1));
        const dmg = W.dmg * RARITY[rar].dmg * fall * (head ? W.hs : 1);
        const h = hits.get(victim) || { d: 0, hs: false, dist: best };
        h.d += dmg; h.hs = h.hs || head; hits.set(victim, h);
      }
    }
    const ev = { e: 's', i: p.id, w, o: [q(ex, 10) / 10, q(ey, 10) / 10, q(ez, 10) / 10], t: ends.slice(0, 4).map((e) => e.map((v) => q(v, 10) / 10)) };
    this.emitNear(ex, ez, 420, ev, p.id);
    for (const [v, h] of hits) this.damage(v, h.d, p, w, h.hs, h.dist);
  }

  damage(v, amount, attacker, w, hs = false, dist = 0) {
    if (v.mode === MODE.DEAD || v.mode === MODE.SPECT || amount <= 0) return;
    let rest = amount, broke = false;
    if (w !== 'storm' && v.ar > 0) {
      const a = Math.min(v.ar, rest);
      v.ar -= a; rest -= a;
      if (v.ar <= 0.01) { v.ar = 0; broke = true; }
    }
    v.hp -= rest;
    v.lastHit = this.time;
    v.pt = 0;
    if (attacker) attacker.dmg += amount;
    if (v.ai) v.ai.hurtBy = attacker ? attacker.id : -1, v.ai.hurtT = this.time;
    const killed = v.hp <= 0;
    if (attacker) this.emitTo(attacker.id, { e: 'h', v: v.id, d: Math.round(amount), hs: hs ? 1 : 0, br: broke ? 1 : 0, k: killed ? 1 : 0 });
    this.emitTo(v.id, { e: 'd', a: attacker ? attacker.id : -1, x: attacker ? q(attacker.x, 1) : null, z: attacker ? q(attacker.z, 1) : null, d: Math.round(amount) });
    if (killed) this.kill(v, attacker, w, hs, dist);
  }

  kill(v, attacker, w, hs, dist) {
    const place = this.alive().length;
    v.hp = 0; v.mode = MODE.DEAD; v.place = place; v.diedAt = this.time;
    v.watch = attacker && attacker !== v ? attacker.id : -1;
    if (attacker && attacker !== v) attacker.kills++;
    this.elims.push(v.id);
    // 掉落背包
    const drops = [];
    const around = (k) => { const a = k * 1.9; return [v.x + Math.cos(a) * 0.8, v.z + Math.sin(a) * 0.8]; };
    let k = 0;
    const gy = v.y + 0.02;
    for (const s of v.slots) if (s) { const [x, z] = around(k++); drops.push(this.addLoot(weaponCode(s[0], s[1]), s[2], x, gy, z)); }
    for (const a of AMMO_KEYS) if (v.ammo[a] > 0) { const [x, z] = around(k++); drops.push(this.addLoot(LOOT.AMMO0 + AMMO_KEYS.indexOf(a), v.ammo[a], x, gy, z)); }
    if (v.pinv > 0) { const [x, z] = around(k++); drops.push(this.addLoot(LOOT.PLATE, v.pinv, x, gy, z)); }
    if (v.mode === MODE.DEAD && drops.length) this.emitAll({ e: 'l+', l: drops.map(packLoot) });
    v.slots = [null, null]; v.ammo = { l: 0, h: 0, s: 0, n: 0 }; v.pinv = 0;
    this.emitAll({ e: 'k', k: attacker && attacker !== v ? attacker.id : -1, v: v.id, w, hs: hs ? 1 : 0, d: Math.round(dist), n: place - 1 });
    this.emitTo(v.id, { e: 'dead', k: attacker && attacker !== v ? attacker.id : -1, w, hs: hs ? 1 : 0, d: Math.round(dist), place });
    const left = this.alive();
    if (left.length <= 1 && !this.over) this.finish(left[0]);
  }

  finish(w) {
    this.over = true;
    this.winner = w ? w.id : -1;
    if (w) w.place = 1;
    this.emitAll({ e: 'end', win: this.winner, stand: this.standings() });
  }

  standings() {
    return this.players.filter((p) => p.mode !== MODE.SPECT || p.place)
      .map((p) => ({ id: p.id, n: p.name, b: p.bot ? 1 : 0, k: p.kills, d: Math.round(p.dmg), pl: p.place || (p.mode === MODE.DEAD ? 0 : 1) }))
      .sort((a, b) => a.pl - b.pl || b.k - a.k);
  }

  pickStormCenter(cur, r) {
    for (let k = 0; k < 40; k++) {
      const a = this.rnd() * Math.PI * 2, d = Math.sqrt(this.rnd()) * Math.max(0, cur.r - r) * 0.92;
      const x = cur.x + Math.cos(a) * d, z = cur.z + Math.sin(a) * d;
      if (heightAt(this.W.H, x, z) > 1.5 || k === 39) return { x, z };
    }
    return { x: cur.x, z: cur.z };
  }

  // ---- 一個 tick ----
  step() {
    if (this.over) { this.tick++; this.time = this.tick * DT; return; }
    const ctx = { W: this.W, dt: DT, time: this.time, plane: this.plane };
    const fx = { fire: (p, w, r, dirs, inp) => this.fire(p, w, r, dirs, inp), event: (p, e) => this.onEvent(p, e) };
    for (const p of this.players) {
      if (p.bot) {
        if (p.mode === MODE.DEAD) continue;
        const inp = botThink(p, this);
        stepPlayer(p, inp, ctx, fx);
        if (inp.u && inp.b & BITS.USE) this.pickup(p, inp.u);
      } else {
        const qd = this.queue.get(p.id);
        // 令牌桶：每 tick 補 1 筆、最多存 6 筆，可短暫追上延遲但長期不能比 30 Hz 快（防加速）
        const tb = Math.min(6, (this.bucket.get(p.id) ?? 6) + 1);
        let n = Math.min(Math.floor(tb), qd.length > 6 ? 3 : qd.length > 2 ? 2 : 1);
        if (!qd.length) {
          // 沒有新輸入：在空中或飛機上照常推進，地面上延續上一筆移動 0.25 秒後停下
          const li = this.lastInput.get(p.id);
          const idle = li ? { ...li, b: (this.tick - (li.tick || 0) < 8 ? li.b : 0) & ~(BITS.FIRE | BITS.USE | BITS.JUMP), u: 0 } : { b: 0, yaw: p.yaw, pitch: p.pitch };
          if (p.mode !== MODE.GROUND || !li || this.tick - (li.tick || 0) > 8) stepPlayer(p, idle, ctx, fx);
          continue;
        }
        let used = 0;
        while (n-- > 0 && qd.length) {
          const i = qd.shift(); used++;
          const inp = { b: i.b | 0, yaw: +i.y || 0, pitch: +i.p || 0, vt: i.vt, u: i.u | 0 };
          stepPlayer(p, inp, ctx, fx);
          if (inp.b & BITS.USE && inp.u) this.pickup(p, inp.u);
          this.ack.set(p.id, i.s);
          this.lastInput.set(p.id, { ...inp, tick: this.tick });
        }
        this.bucket.set(p.id, tb - used);
      }
    }
    // 自動撿彈藥與護甲片
    if (this.tick % 5 === 0) {
      for (const p of this.players) {
        if (p.mode !== MODE.GROUND) continue;
        for (const it of this.nearLoot(p.x, p.z, 1.6)) { const d = decodeLoot(it.code); if (d.kind === 'a' || d.kind === 'p') this.pickup(p, it.id, true); }
      }
    }
    // 毒圈
    const sev = stormTick(this.storm, this.time, (cur, r) => this.pickStormCenter(cur, r));
    if (sev || this.tick === 0) this.emitAll({ e: 'st', s: packStorm(this.storm) });
    if (this.tick % 3 === 0) {
      const dps = stormDps(this.storm);
      for (const p of this.alive()) {
        if (p.mode === MODE.PLANE) continue;
        if (outside(this.storm, p.x, p.z)) {
          const acc = (this.stormAcc.get(p.id) || 0) + dps * DT * 3;
          if (acc >= 1) { this.stormAcc.set(p.id, acc % 1); this.damage(p, Math.floor(acc), null, 'storm'); }
          else this.stormAcc.set(p.id, acc);
        }
      }
    }
    // 延遲補償用的位置歷史
    const snap = new Map();
    for (const p of this.players) if (p.mode !== MODE.DEAD) snap.set(p.id, [p.x, p.y, p.z, p.cr]);
    this.hist.push(snap);
    if (this.hist.length > HIST) this.hist.shift();
    this.tick++;
    this.time = this.tick * DT;
  }

  onEvent(p, e) {
    if (e === 'jump' || e === 'land') this.emitNear(p.x, p.z, 200, { e: 'fx', i: p.id, f: e }, p.id);
    if (e === 'reload' || e === 'plate') this.emitNear(p.x, p.z, 40, { e: 'fx', i: p.id, f: e }, p.id);
  }

  nearLoot(x, z, R) {
    const out = [];
    for (const it of this.loot.values()) { const dx = it.x - x, dz = it.z - z; if (dx * dx + dz * dz < R * R) out.push(it); }
    return out;
  }

  // ---- 封包 ----
  startPacket(forId) {
    return {
      seed: this.seed, tick: this.tick, plane: this.plane,
      players: this.players.map((p) => ({ id: p.id, n: p.name, b: p.bot ? 1 : 0 })),
      loot: [...this.loot.values()].map(packLoot),
      storm: packStorm(this.storm), you: forId,
    };
  }
  entities() {
    const out = [];
    for (const p of this.players) {
      if (p.mode === MODE.DEAD || p.mode === MODE.SPECT) continue;
      const s = p.slots[p.cur];
      const flags = p.mode | (p.cr << 3) | ((p.ads > 0.5 ? 1 : 0) << 4) | (p.spr << 5) | (p.og << 6) | ((p.rt > 0 ? 1 : 0) << 7) | ((p.pt > 0 ? 1 : 0) << 8);
      out.push([p.id, q(p.x, 20), q(p.y, 20), q(p.z, 20), q(p.yaw, 1000), q(p.pitch, 1000), flags, s ? WEAPON_KEYS.indexOf(s[0]) : -1]);
    }
    return out;
  }
  snapshotFor(id, ents) {
    const p = this.byId.get(id);
    const box = this.out.get(id) || [];
    const msg = { t: 'snap', k: this.tick, a: this.ack.get(id) || 0, n: this.alive().length, e: ents || this.entities(), me: p ? packSelf(p) : null };
    if (box.length) { msg.ev = box.splice(0, box.length); }
    return msg;
  }
}

export function packLoot(it) { return [it.id, it.code, it.amt, q(it.x, 100) / 100, q(it.y, 100) / 100, q(it.z, 100) / 100]; }

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const px = ox - cx, py = oy - cy, pz = oz - cz;
  const b = px * dx + py * dy + pz * dz, c = px * px + py * py + pz * pz - r * r;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : -1;
}
function rayBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
  let t0 = 0, t1 = 1e9;
  const o = [ox, oy, oz], d = [dx, dy, dz], lo = [x0, y0, z0], hi = [x1, y1, z1];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) { if (o[a] < lo[a] || o[a] > hi[a]) return -1; continue; }
    let ta = (lo[a] - o[a]) / d[a], tb = (hi[a] - o[a]) / d[a];
    if (ta > tb) { const t = ta; ta = tb; tb = t; }
    if (ta > t0) t0 = ta; if (tb < t1) t1 = tb;
    if (t0 > t1) return -1;
  }
  return t0;
}

export { TICK, DT, MODE, terrainAt };
