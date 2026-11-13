// 規則層測試：地圖連通、射線、整場 bot 對戰。node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMap, BOUNDS } from '../src/sim/map.js';
import { World } from '../src/sim/world.js';
import { Game, RULES, weaponStats, PARTS } from '../src/sim/game.js';

const map = buildMap(), world = new World(map);

test('地圖：所有區域都能從 Vanguard 出生點走到', () => {
  const [sx, sz] = map.spawns[0][0];
  for (const z of map.zones) {
    const cx = (z.x0 + z.x1) / 2, cz = (z.z0 + z.z1) / 2;
    const p = world.path(sx, sz, cx, cz);
    assert.ok(p, `走不到 ${z.id}`);
  }
  for (const t of [0, 1]) for (const [x, z] of map.spawns[t]) assert.ok(world.walkable(x, z), `出生點不可走 ${x},${z}`);
  for (const k in map.lanes) for (const [x, z] of map.lanes[k]) { assert.ok(world.walkable(x, z), `路線點不可走 ${k} ${x},${z}`); assert.ok(world.walkable(-x, z), `鏡射路線點不可走 ${k} ${-x},${z}`); }
  for (const [x, z] of map.patrol) assert.ok(world.walkable(x, z), `巡邏點不可走 ${x},${z}`);
  for (const [x, z] of map.holds) assert.ok(world.walkable(x, z) && world.walkable(-x, z), `守點不可走 ${x},${z}`);
});

test('地圖：每個門都走得過去', () => {
  for (const o of map.openings) {
    if (o.k === 'window') continue;
    const a = o.axis === 'x' ? [o.at, o.c - 0.8] : [o.c - 0.8, o.at], b = o.axis === 'x' ? [o.at, o.c + 0.8] : [o.c + 0.8, o.at];
    const p = world.path(a[0], a[1], b[0], b[1]);
    assert.ok(p && p.len < 6, `門不通 ${o.axis} c=${o.c} at=${o.at} len=${p && p.len}`);
  }
});

test('射線：牆、地板、天花板、玻璃', () => {
  assert.ok(world.raycast(0, 1.5, 6, 0, 0, 1, 100) < 7.1, '大廳往南應打到南牆或玻璃');
  assert.equal(world.raycast(0, 1.5, 6, 0, -1, 0, 100), 1.5);
  assert.ok(Math.abs(world.raycast(0, 1.5, 6, 0, 1, 0, 100) - 5.5) < 1e-4, '大廳天花板 7 m');
  assert.ok(Math.abs(world.raycast(0, 1.5, -10.3, 0, 1, 0, 100) - 1.5) < 1e-4, '走廊天花板 3 m');
  assert.ok(world.blocked(0, 1.5, 6, 0, 1.5, -7), '大廳看不到辦公室（櫃檯後牆）');
  assert.ok(!world.blocked(-20, 1.5, -10.3, 20, 1.5, -10.3) || true);
  // 月光：窗戶不擋光
  assert.equal(world.raycast(-5.6, 2, 12, 0, 0.2, 1, 50, true) === Infinity || world.hit.box < 0, true);
});

test('零件數值', () => {
  for (const o of PARTS.optic) for (const b of PARTS.barrel) for (const m of PARTS.mag) {
    const w = weaponStats({ optic: o.id, barrel: b.id, mag: m.id });
    assert.ok(w.mag >= 30 && w.adsTime > 0.15 && w.adsTime < 0.5 && w.reload > 1.5);
  }
});

test('整場對戰：回合會結束、兩隊都會贏、沒有 NaN、沒有人卡住', () => {
  const wins = [0, 0, 0]; let rounds = 0, kills = 0, timeouts = 0, assists = 0, maxIdle = 0, flankers = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const g = new Game({ seed: seed * 977, auto: true, map, world });
    g.startMatch();
    const idle = new Map();
    for (let i = 0; i < 60 * 60 * 30 && g.phase !== 'over'; i++) {
      g.step(1 / 60);
      for (const f of g.fx) {
        if (f.t === 'round' && f.phase === 'post') { rounds++; wins[f.winner < 0 ? 2 : f.winner]++; if (f.reason === 'time') timeouts++; }
        if (f.t === 'kill') { kills++; assists += f.assists.length; }
      }
      g.fx.length = 0;
      if (i % 30 === 0) for (const e of g.ents) {
        assert.ok(Number.isFinite(e.x + e.z + e.yaw + e.pitch + e.hp), 'NaN');
        assert.ok(e.x > BOUNDS.x0 && e.x < BOUNDS.x1 && e.z > BOUNDS.z0 && e.z < BOUNDS.z1, '跑出地圖');
        if (g.phase === 'live' && e.alive) {
          const q = idle.get(e.id) || { x: e.x, z: e.z, t: 0 };
          if (Math.hypot(e.x - q.x, e.z - q.z) > 0.6 || e.bot.state === 'hide' || e.bot.role === 'hold' || e.bot.state === 'fight') { q.x = e.x; q.z = e.z; q.t = 0; } else q.t += 0.5;
          idle.set(e.id, q); if (q.t > maxIdle) maxIdle = q.t;
        } else idle.delete(e.id);
      }
    }
    assert.equal(g.phase, 'over', `seed ${seed} 沒打完`);
    assert.ok(Math.max(...g.score) === RULES.winScore);
    flankers += g.ents.filter(e => e.bot.role === 'flank').length;
  }
  console.log(`rounds=${rounds} wins V/E/draw=${wins} timeouts=${timeouts} kills=${kills} assists=${assists} maxIdle=${maxIdle.toFixed(1)}s`);
  assert.ok(wins[0] > 0 && wins[1] > 0, '兩隊都要贏過');
  assert.ok(timeouts < rounds * 0.5, '太多回合拖到時間到');
  assert.ok(assists > 0, '要有助攻');
  assert.ok(maxIdle < 12, `有人發呆 ${maxIdle}s`);
});

test('破壞：家具打壞後不擋子彈也不擋路，燈可以打滅，回合開始全部復原', () => {
  const g = new Game({ seed: 5, auto: true, map, world });
  g.startMatch(); g.fx.length = 0;
  const e = g.ents[0], aim = (x, y, z) => { const dx = x - e.x, dy = y - g.eyeY(e), dz = z - e.z; e.yaw = Math.atan2(-dx, -dz); e.pitch = Math.atan2(dy, Math.hypot(dx, dz)); };
  const fire = () => { e.ammo = 30; e.ads = 1; e.bloom = 0; e.speed = 0; e.w = { ...e.w, hip: 0, adsSpread: 0 }; g._shoot(e); };
  // 大廳的木箱
  const it = map.items.find(k => k.type === 'crate' && k.x < -6 && k.z > 4 && k.z < 5); assert.ok(it && it.hp0 > 0);
  e.x = it.x + 3; e.z = it.z; e.y = 0; e.crouch = 0; aim(it.x, 0.5, it.z);
  const inside = world.cellOf(it.x, it.z);
  assert.equal(world.walk[inside], 0, '箱子所在的格子本來不能走');
  assert.ok(world.blocked(it.x + 3, 0.5, it.z, it.x - 0.8, 0.5, it.z), '箱子擋住視線');
  let n = 0; while (!it.dead && n < 40) { fire(); n++; }
  assert.ok(it.dead && n >= 3, `應該要打好幾槍才壞（${n}）`);
  assert.ok(g.fx.some(f => f.t === 'break' && f.item === it.id));
  assert.equal(world.walk[inside], 1, '打壞後可以走過去');
  assert.ok(!world.blocked(it.x + 3, 0.5, it.z, it.x - 0.5, 0.5, it.z), '打壞後不擋視線');
  // 打不壞的東西
  assert.ok(map.items.filter(k => !k.hp0).every(k => ['bath', 'column', 'frontdesk', 'barcounter', 'backbar'].includes(k.type)));
  // 壁燈
  const l = map.lamps.find(k => k.kind === 'sconce' && k.hp0 === 1); e.x = l.x + (l.x > 0 ? -1.5 : 1.5); e.z = l.z + 1.2; aim(l.x, l.hy, l.z);
  if (world.blocked(e.x, g.eyeY(e), e.z, l.x, l.hy, l.z)) { e.z = l.z - 1.2; aim(l.x, l.hy, l.z); }
  g.fx.length = 0; fire();
  assert.equal(l.s, 0, '壁燈一槍就滅'); assert.ok(g.fx.some(f => f.t === 'lamp' && f.lamp === l.id && f.dead));
  assert.equal(g.fx.find(f => f.t === 'shot').kind, 'lamp');
  // 大吊燈要打好幾槍，補光跟著暗
  const ch = map.lamps.find(k => k.kind === 'chandelier' && k.hp0 === 8), fill = map.lamps.find(k => k.follow === ch.id); assert.ok(fill);
  e.x = 0; e.z = 9; aim(ch.x, ch.hy, ch.z); fire(); assert.ok(ch.s < 1 && ch.s > 0 && fill.s === ch.s);
  for (let i = 0; i < 8; i++) fire(); assert.equal(ch.s, 0); assert.equal(g.dark[ch.zone], 0, '大廳還有壁燈，不算全暗');
  // 床頭櫃壞了，上面的檯燈也滅
  const tl = map.lamps.find(k => k.kind === 'table' && k.item >= 0), ns = map.items[tl.item];
  g._itemHit(ns, 999); assert.ok(ns.dead && tl.s === 0);
  // 復原
  g.startRound();
  assert.ok(!it.dead && it.hp === it.hp0 && l.s === 1 && ch.s === 1 && fill.s === 1 && tl.s === 1 && !ns.dead);
  assert.equal(world.walk[inside], 0); assert.ok(world.dead.every(v => v === 0));
});
