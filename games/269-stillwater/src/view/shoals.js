// 水底魚影：每個釣點一群繞著游的魚（魚種取自該區當下時段會出現的魚），加上鏡頭附近隨處漫游的魚。
// 釣點魚群偶爾在水面冒漣漪；有人在等魚時，會有一條離群游向浮標；魚王出沒的釣點在對的時段會看到一個大黑影。
import { SPOTS, spotPos, zoneAt } from '../core/map.js';
import { zoneFish, byId } from '../core/fishdb.js';
import { mulberry } from '../core/rng.js';
import { displayLen } from './fishview.js';

export function createShoals(pools, grid, water) {
  const rnd = mulberry(77);
  const shoals = SPOTS.map((s) => ({ spot: s, fish: [], key: '', rest: 0, cx: s.x, cz: s.z }));
  const wander = [];
  let approach = null;   // { k: 釣點索引, x, z, fish }

  function fill(sh, time) {
    const pool = zoneFish(sh.spot.zone).filter((f) => f.times.includes(time) && f.rarity !== 'L');
    sh.fish = [];
    const n = 6 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) {
      const f = pool[Math.floor(rnd() * pool.length)];
      sh.fish.push({ id: f.id, a: rnd() * 6.28, r: 1 + rnd() * 2.6, dr: rnd() * 6.28, y: -0.32 - rnd() * 0.6, v: 0.5 + rnd() * 0.5, ph: rnd() * 6.28, s: displayLen(f) * 1.25 });
    }
    // 魚王：在牠的時段，深水釣點下方繞著一個大影子
    if (sh.spot.kind === 'legend') {
      const L = zoneFish(sh.spot.zone).find((f) => f.rarity === 'L');
      if (L.times.includes(time)) sh.fish.push({ id: L.id, a: rnd() * 6.28, r: 2.4, dr: 0, y: -1.6, v: 0.35, ph: 0, s: displayLen(L) * 0.95, legend: true });
    }
  }

  function spawnWander(fx, fz, time) {
    for (let tries = 0; tries < 6; tries++) {
      const a = rnd() * 6.28, d = 14 + rnd() * 26;
      const x = fx + Math.cos(a) * d, z = fz + Math.sin(a) * d;
      const h = grid.sample(x, z);
      if (h > -1.0) continue;
      const pool = zoneFish(zoneAt(x, z)).filter((f) => f.times.includes(time) && (f.rarity === 'C' || f.rarity === 'U'));
      const f = pool[Math.floor(rnd() * pool.length)];
      return { id: f.id, x, z, y: Math.max(h + 0.4, -0.5 - rnd() * 0.8), yaw: rnd() * 6.28, turn: 0, v: 0.6 + rnd() * 0.6, ph: rnd() * 6.28, s: displayLen(f), t: 0 };
    }
    return null;
  }

  return {
    shoals,
    get approach() { return approach; },
    // 指定一條魚游向浮標（等魚時）；回傳魚種 id 讓釣魚邏輯知道是誰
    setApproach(k, x, z, id) {
      if (k == null) { approach = null; return; }
      const f = byId(id);
      approach = { k, x, z, id, px: shoals[k].cx + 2, pz: shoals[k].cz, y: -0.7, yaw: 0, s: displayLen(f), ph: 0, d: 99 };
    },
    hideApproach() { if (approach) approach.hidden = true; },
    update(dt, t, time, timeIdx, focus, rest, near) {
      pools.begin();
      const key = time;
      for (const sh of shoals) {
        const p = spotPos(sh.spot, timeIdx);
        sh.cx += (p.x - sh.cx) * Math.min(1, dt * 0.3); sh.cz += (p.z - sh.cz) * Math.min(1, dt * 0.3);
        if (sh.key !== key) { sh.key = key; fill(sh, time); }
        const resting = rest(sh.spot.k);
        const far = Math.hypot(sh.cx - focus.x, sh.cz - focus.z) > 70;
        if (far) continue;
        const bed = grid.sample(sh.cx, sh.cz);
        for (const f of sh.fish) {
          if (resting && !f.legend) continue;
          f.a += (f.v / f.r) * dt * (f.legend ? 0.6 : 1);
          f.dr += dt * 0.7;
          const r = f.r + Math.sin(f.dr) * 0.5;
          const x = sh.cx + Math.cos(f.a) * r, z = sh.cz + Math.sin(f.a) * r;
          const yaw = Math.atan2(-Math.sin(f.a), Math.cos(f.a));
          const y = Math.max(bed + 0.25, f.y + Math.sin(t * 0.7 + f.ph) * 0.08);
          pools.put(f.id, x, y, z, yaw, 0, f.s, f.ph, f.legend ? 5 : 9 + f.v * 3, f.legend ? 0.09 : 0.13, grid.sample(x, z));
        }
        if (!resting && near(sh.spot.k) && rnd() < dt * 0.5) {
          const f = sh.fish[Math.floor(rnd() * sh.fish.length)];
          water.ripple(sh.cx + Math.cos(f.a) * f.r, sh.cz + Math.sin(f.a) * f.r, 0.35);
        }
      }
      // 游向浮標的那條魚
      if (approach && !approach.hidden) {
        const a = approach;
        const dx = a.x - a.px, dz = a.z - a.pz, d = Math.hypot(dx, dz);
        a.d = d;
        const ty = Math.atan2(dx, dz);
        const dy = Math.atan2(Math.sin(ty - a.yaw), Math.cos(ty - a.yaw));
        a.yaw += dy * Math.min(1, dt * 3);
        const sp = d > 0.9 ? 0.9 : 0.15;
        a.px += Math.sin(a.yaw) * sp * dt; a.pz += Math.cos(a.yaw) * sp * dt;
        if (d < 0.9) { a.px += Math.sin(t * 2.3) * 0.004; a.yaw += Math.sin(t * 1.7) * dt * 0.8; }
        a.y += (-0.45 - a.y) * dt;
        pools.put(a.id, a.px, a.y, a.pz, a.yaw, 0, a.s, a.ph, d > 0.9 ? 12 : 6, 0.13, grid.sample(a.px, a.pz));
      }
      // 漫游的魚
      while (wander.length < 22) { const w = spawnWander(focus.x, focus.z, time); if (!w) break; wander.push(w); }
      for (let i = wander.length - 1; i >= 0; i--) {
        const w = wander[i];
        w.t += dt;
        if (rnd() < dt * 0.4) w.turn = (rnd() - 0.5) * 1.6;
        w.yaw += w.turn * dt;
        let nx = w.x + Math.sin(w.yaw) * w.v * dt, nz = w.z + Math.cos(w.yaw) * w.v * dt;
        const h = grid.sample(nx, nz);
        if (h > w.y - 0.25) { w.yaw += Math.PI * 0.6; nx = w.x; nz = w.z; }
        w.x = nx; w.z = nz;
        if (Math.hypot(w.x - focus.x, w.z - focus.z) > 48 || w.t > 60) { wander.splice(i, 1); continue; }
        pools.put(w.id, w.x, w.y, w.z, w.yaw, 0, w.s, w.ph, 9 + w.v * 4, 0.12, h);
      }
    },
  };
}
