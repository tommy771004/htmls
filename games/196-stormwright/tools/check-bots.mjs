// 軌道 bots 自檢：node tools/check-bots.mjs <html> [--out dir] [--only curve|duel|stuck|shots|perf] [--runs N]
// (a) 完整對局模擬＋存活曲線；(b) 1v1 受擊後蓋牆反擊；(c) 房屋內卡住測試；(d) 截圖；(e) 效能。
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { open } from './lib.mjs';

const a = process.argv.slice(2);
const flag = (n, d) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : d; };
const html = a.find((x, i) => !x.startsWith('--') && !['--out', '--only', '--runs', '--mode', '--max'].includes(a[i - 1]));
const outDir = resolve(flag('--out', 'dist/bots/check'));
const only = flag('--only', 'all'), runs = +flag('--runs', 3), maxSec = +flag('--max', 700);
const modeArg = flag('--mode', '');
if (!html) { console.error('usage: node tools/check-bots.mjs <html> [--out dir] [--only curve|duel|stuck|shots|perf]'); process.exit(2); }
mkdirSync(outDir, { recursive: true });
let failed = 0; const report = {};
const check = (grp, n, ok, d) => { (report[grp] ||= []).push({ n, ok: !!ok, d }); if (!ok) { failed++; console.error('FAIL', grp, n, d === undefined ? '' : JSON.stringify(d)); } };

// 共用：玩家無敵、事件記錄（在 simulate 的頁面內設定）
async function simulate(label, { mode, forceFull, forceSim, player }) {
  const { browser, page, log } = await open(html, { w: 800, h: 500 });
  const res = await page.evaluate(async ({ mode, forceFull, forceSim, player, maxSec }) => {
    const s = window.__sw, c = s.ctx;
    window.__elim = []; c.events.on('eliminated', (e) => window.__elim.push({ t: c.time.now, v: e.victim.id, k: e.killer ? e.killer.id : null, w: e.weapon }));
    c.player.takeDamage = function () { return { shieldDamage: 0, healthDamage: 0, killed: false }; };
    c.bots.forceFull = !!forceFull; c.bots.forceSim = !!forceSim;
    s.start();
    const t0 = c.time.now;
    if (player === 'far') s.teleport(-395, 395); else if (player === 'poi') s.teleport(0, 20);
    const curve = [], stormKills = []; let nextT = 0, steps = 0, chunkMs = 0;
    const tt = performance.now();
    while (c.time.now - t0 < maxSec) {
      s.fastForward(2); steps += 120;
      const t = c.time.now - t0;
      if (c.player) { c.player.health = 100; }
      while (nextT <= t) { curve.push([nextT, c.match.alive()]); nextT += 10; }
      if (c.match.alive() <= 2) break;
    }
    const wall = performance.now() - tt;
    const el = window.__elim, tel = el.filter((e) => e.k === null).length;
    const byW = {}; el.forEach((e) => { byW[e.w || 'storm'] = (byW[e.w || 'storm'] || 0) + 1; });
    const kd = c.actors.filter((a) => !a.isPlayer).map((a) => a.kills).reduce((x, y) => x + y, 0);
    return { curve, endT: c.time.now - t0, alive: c.match.alive(), stormKills: tel, elims: el.length, byW, playerKills: c.player.kills, wallSec: wall / 1000, perfMs: c.bots.perf.ms / Math.max(1, c.bots.perf.n), stuckMax: Math.max(...c.bots.brains.map((b) => b.stuckCount || 0)), builds: c.build.pieces.size, fights: c.bots.stats, pace: c.bots.pace, paceLog: c.bots.paceLog.filter((x) => x[0] % 20 === 0).map((x) => x[0] + ':' + x[1]).join(' '), paceRaw: c.bots.paceLog, elTimes: el.map((e) => Math.round(e.t - t0)) };
  }, { mode, forceFull, forceSim, player, maxSec });
  const at = (t) => { const r = res.curve.find((p) => p[0] >= t); return r ? r[1] : res.alive; };
  if (process.env.VERBOSE)   console.log(`[${label}] end=${res.endT.toFixed(0)}s alive=${res.alive} curve@ 60:${at(60)} 90:${at(90)} 150:${at(150)} 210:${at(210)} 270:${at(270)} 330:${at(330)} 390:${at(390)} 450:${at(450)} 510:${at(510)} 570:${at(570)} 630:${at(630)}  stormKills=${res.stormKills}/${res.elims} wall=${res.wallSec.toFixed(0)}s botMs/step=${res.perfMs.toFixed(3)} maxStuck=${res.stuckMax} weapons=${JSON.stringify(res.byW)} fights=${JSON.stringify(res.fights)}\n   pace ${res.paceLog}`);
  check('curve', label + ' 無 pageerror', log.pageerrors.length === 0, log.pageerrors.slice(0, 2));
  check('curve', label + ' 無 console.error', log.errors.length === 0, log.errors.slice(0, 2));
  await browser.close();
  return res;
}

const TS = [60, 90, 150, 210, 270, 330, 390, 450, 510, 570];
if (only === 'all' || only === 'curve' || only === 'tune') {
  const modes = modeArg ? modeArg.split(',') : ['far', 'poi', 'full'];
  const agg = {}, all = [];
  for (let r = 0; r < runs; r++) {
    const m = modes[r % modes.length];
    const res = await simulate(`curve${r + 1}-${m}`, { player: m === 'poi' || m === 'full' ? 'poi' : 'far', forceFull: m === 'full' || m === 'fullfar', forceSim: m === 'sim' });
    const at = (t) => { const x = res.curve.find((p) => p[0] >= t); return x ? x[1] : res.alive; };
    const rec = { pc: TS.map((t) => { const q = (res.paceRaw || []).filter((x) => x[0] >= t - 30 && x[0] < t + 30).map((x) => x[1]); return q.length ? q.reduce((x, y) => x + y, 0) / q.length : NaN; }), at: TS.map(at), pace: res.pace, end: res.endT, storm: res.stormKills, elims: res.elims };
    (agg[m] ||= []).push(rec); all.push(rec);
    if (only !== 'tune') {
      check('curve', `${m}: 落地後 ~30（70 s ≥ 21）`, at(70) >= 21, at(70));
      check('curve', `${m}: 150 s 不低於 12`, at(150) >= 12, at(150));
      check('curve', `${m}: 最終收斂（≤2）於 6.3–11 分`, res.alive <= 2 && res.endT >= 380 && res.endT <= 660, { end: res.endT, alive: res.alive });
    }
  }
  const meanOf = (L, f) => L.reduce((s, x) => s + f(x), 0) / L.length;
  for (const m in agg) {
    const L = agg[m];
    console.log(`PACE[${m}] ` + TS.map((t, i) => `${t}:${meanOf(L, (x) => x.pc[i]).toFixed(2)}`).join(' '));
    console.log(`MEAN[${m}] n=${L.length} ` + TS.map((t, i) => `${t}:${meanOf(L, (x) => x.at[i]).toFixed(1)}`).join(' ') + ` end=${meanOf(L, (x) => x.end).toFixed(0)} (min ${Math.min(...L.map((x) => x.end)).toFixed(0)} max ${Math.max(...L.map((x) => x.end)).toFixed(0)}) stormKills=${meanOf(L, (x) => x.storm).toFixed(1)}`);
  }
  if (only !== 'tune') {
    // 各模式合併後比對目標曲線（單次模擬雜訊大，所以合併判斷）
    const i150 = TS.indexOf(150), i270 = TS.indexOf(270), i390 = TS.indexOf(390);
    const m150 = meanOf(all, (x) => x.at[i150]), m270 = meanOf(all, (x) => x.at[i270]), m390 = meanOf(all, (x) => x.at[i390]);
    check('curve', `存活曲線貼近目標（n=${all.length}）：150 s ≈ 20、270 s ≈ 12、390 s ≈ 6（容許 ±6／±5／±4）`, Math.abs(m150 - 20) <= 6 && Math.abs(m270 - 12) <= 5 && Math.abs(m390 - 6) <= 4, { m150, m270, m390 });
    check('curve', `風暴擊殺不超過四成（${meanOf(all, (x) => x.storm).toFixed(1)}/28）`, meanOf(all, (x) => x.storm) / 28 <= 0.4, meanOf(all, (x) => x.storm));
  }
}

// 校準：同技能 1v1，真實戰鬥 vs 簡化結算的擊殺時間
if (only === 'cal') {
  const { browser, page } = await open(html, { w: 800, h: 500 });
  const res = await page.evaluate(async ({ weapon, n }) => {
    const s = window.__sw, c = s.ctx;
    c.player.takeDamage = function () { return { shieldDamage: 0, healthDamage: 0, killed: false }; };
    s.start(); s.skipToGround(-395, 395); c.storm.isOutside = () => false; c.storm.distToSafe = () => 0; c.bots.frozen = false;
    for (const b of c.bots.brains) if (b.a.id > 2) b.a.takeDamage(9999, { ignoreShield: true });
    const A = c.bots.brains[0], B = c.bots.brains[1];
    const defs = { ar: ['medium', 30], smg: ['light', 30], pump: ['shells', 5], pistol: ['light', 16], sniper: ['heavy', 1] };
    const out = {};
    for (const mode of ['real', 'sim']) {
      c.bots.forceFull = mode === 'real'; c.bots.forceSim = mode === 'sim';
      for (const d of [8, 20, 40, 70]) {
        const ttk = []; let draws = 0;
        for (let k = 0; k < n; k++) {
          for (const [b, sgn] of [[A, -1], [B, 1]]) {
            const a = b.a; a.alive = true; a.health = 100; a.shield = 0; a.state = 'ground'; a.grounded = true; a.vel.set(0, 0, 0); a.action = null;
            const x = 18 + sgn * d / 2, z = 28; a.pos.set(x, c.physics.groundHeight(x, z, 100, 0.38).y + 0.02, z);
            a.inventory.slots = [null, null, null, null, null]; a.inventory.mats = { wood: 0, stone: 0, metal: 0 };
            const [am, mag] = defs[weapon]; a.inventory.ammo = { light: 300, medium: 300, heavy: 40, shells: 60 };
            a.inventory.slots[0] = { uid: 9000 + k, defId: weapon, kind: 'weapon', rarity: 1, mag, count: 1 }; a.inventory.selected = 1;
            b.skill = 0.55; b.aggr = 1.3; b.reactT = 0.5; b.fleeUntil = 0; b.engaged = false; b.foe = null; b.bseq = null; b.pass = new Map(); b.hitBy = null; b.landedAt = -99; b.coverWanted = false;
            b.cs = null; a.cs = { cd: 0, bloom: 0, reloadHold: 0 }; b.simBusyUntil = 0; b.nextShotAt = 0; b.burstLeft = 0; b.buildCd = 1e9; b.loot = null; b.harvest = null; b.state = 'loot';
          }
          for (const [b, o] of [[A, B], [B, A]]) { const now = c.time.now; b.engaged = true; b.foe = o.a; b.fightStart = now; b.fightMax = 1e9; b.pass.set(o.a, { fight: true, until: 1e9 }); b.firstSeen = now; b.lastSeen = now; }
          const t0 = c.time.now; let t = 0;
          while (t < 40 && A.a.alive && B.a.alive) { s.fastForward(0.25); t += 0.25; if (c.storm.active) { c.storm.radius = 600; } A.a.health = Math.min(A.a.health, A.a.health); }
          if (A.a.alive && B.a.alive) draws++; else ttk.push(c.time.now - t0);
          // 結算後把存活者的事件清掉
        }
        const m = ttk.length ? ttk.reduce((x, y) => x + y, 0) / ttk.length : 0;
        ttk.sort((x, y) => x - y);
        out[mode + '@' + d] = { mean: +m.toFixed(1), med: +(ttk[Math.floor(ttk.length / 2)] || 0).toFixed(1), draws, n };
      }
    }
    return out;
  }, { weapon: flag('--weapon', 'ar'), n: +flag('--n', 12) });
  console.log(JSON.stringify(res));
  await browser.close();
}
// 校準：真實戰鬥下每發平均造成的傷害（含連發節奏與換彈）→ 簡化結算查表用
if (only === 'dps') {
  const { browser, page } = await open(html, { w: 800, h: 500 });
  const res = await page.evaluate(async ({ n, skill, secs }) => {
    const s = window.__sw, c = s.ctx;
    c.player.takeDamage = function () { return { shieldDamage: 0, healthDamage: 0, killed: false }; };
    s.start(); s.skipToGround(-395, 395); c.storm.isOutside = () => false; c.storm.distToSafe = () => 0; c.bots.frozen = false; c.bots.forceFull = true;
    for (const b of c.bots.brains) if (b.a.id > 2) b.a.takeDamage(9999, { ignoreShield: true });
    const A = c.bots.brains[0], B = c.bots.brains[1];
    const defs = { ar: 30, smg: 30, pump: 5, pistol: 16, sniper: 1 };
    let shots = 0; let shooter = null; c.events.on('shot', (e) => { if (e.actor === shooter) shots++; });
    const out = {};
    for (const weapon of ['ar', 'smg', 'pump', 'pistol', 'sniper']) {
      out[weapon] = {};
      for (const d of [6, 12, 20, 35, 55, 80, 120, 170]) {
        let dmg = 0, sh = 0, tt = 0;
        for (let k = 0; k < n; k++) {
          for (const [b, sgn] of [[A, -1], [B, 1]]) {
            const a = b.a; a.alive = true; a.health = 1e6; a.shield = 0; a.state = 'ground'; a.grounded = true; a.vel.set(0, 0, 0); a.action = null; a.stats.damage = 0;
            const x = 18 + sgn * d / 2, z = 28; a.pos.set(x, c.physics.groundHeight(x, z, 100, 0.38).y + 0.02, z);
            a.inventory.slots = [null, null, null, null, null]; a.inventory.mats = { wood: 0, stone: 0, metal: 0 };
            a.inventory.ammo = { light: 3000, medium: 3000, heavy: 400, shells: 600 };
            a.inventory.slots[0] = { uid: 9000 + k, defId: weapon, kind: 'weapon', rarity: 1, mag: defs[weapon], count: 1 }; a.inventory.selected = 1;
            b.skill = skill; b.aggr = 1.3; b.reactT = 0.5; b.fleeUntil = 0; b.engaged = false; b.foe = null; b.bseq = null; b.pass = new Map(); b.hitBy = null; b.landedAt = -99; b.coverWanted = false;
            a.cs = { cd: 0, bloom: 0, reloadHold: 0 }; b.simBusyUntil = 0; b.nextShotAt = 0; b.burstLeft = 0; b.buildCd = 1e9; b.loot = null; b.harvest = null; b.state = 'loot'; b.firstSeen = -9;
          }
          for (const [b, o] of [[A, B], [B, A]]) { const now = c.time.now; b.engaged = true; b.foe = o.a; b.fightStart = now; b.fightMax = 1e9; b.pass.set(o.a, { fight: true, until: 1e9 }); b.firstSeen = now; b.lastSeen = now; }
          shooter = A.a; shots = 0; const t0 = c.time.now;
          s.fastForward(secs);
          dmg += A.a.stats.damage; sh += shots; tt += secs;
        }
        out[weapon][d] = { dmgPerShot: +(dmg / Math.max(1, sh)).toFixed(2), shotsPerSec: +(sh / tt).toFixed(2), dps: +(dmg / tt).toFixed(1) };
      }
    }
    return out;
  }, { n: +flag('--n', 6), skill: +flag('--skill', 0.55), secs: +flag('--secs', 12) });
  console.log(JSON.stringify(res));
  await browser.close();
}
// (b) 1v1：30 m 外的 bot 被打 → 蓋牆掩護、還擊（6 次試驗）
if (only === 'all' || only === 'duel') {
  const { browser, page, log } = await open(html, { w: 1440, h: 900 });
  const r = await page.evaluate(async () => {
    const s = window.__sw, c = s.ctx, p = c.player;
    s.start(); s.skipToGround(3, 28); c.storm.isOutside = () => false; c.storm.distToSafe = () => 0; s.giveMats(); s.giveAmmo(); s.give('smg', 1);
    for (const b of c.bots.brains) if (b.a.id > 1) b.a.takeDamage(9999, { ignoreShield: true });
    const B = c.bots.brains[0], bot = B.a;
    c.bots.frozen = false; p.health = 1e6;
    let shotsBack = 0, hitsOnPlayer = 0, built = 0, firstHit = null, firstBuild = null, firstShot = null;
    c.events.on('shot', (e) => { if (e.actor === bot) { shotsBack++; if (firstShot === null && firstHit !== null) firstShot = c.time.now; } });
    c.events.on('damage', (e) => { if (e.source === bot && e.target === p) hitsOnPlayer++; if (e.target === bot && firstHit === null) firstHit = c.time.now; });
    c.events.on('buildPlaced', (e) => { if (e.actor === bot) { built++; if (firstBuild === null && firstHit !== null) firstBuild = c.time.now; } });
    const trials = [];
    for (let k = 0; k < 6; k++) {
      for (const q of [...c.build.pieces.values()]) q.takeDamage(1e9, {});
      s.fastForward(1);
      bot.alive = true; bot.pos.set(33, c.physics.groundHeight(33, 28, 100, 0.38).y + 0.02, 28); bot.state = 'ground'; bot.grounded = true; bot.vel.set(0, 0, 0); bot.health = 100; bot.shield = 0; bot.action = null;
      bot.inventory.slots = [{ uid: 777 + k, defId: 'ar', kind: 'weapon', rarity: 2, mag: 30, count: 1 }, null, null, null, null]; bot.inventory.selected = 1;
      bot.inventory.ammo.medium = 200; bot.inventory.mats = { wood: 120, stone: 0, metal: 0 };
      B.skill = 0.95; B.landedAt = -99; B.buildCd = 0; B.pass = new Map(); B.state = 'loot'; B.loot = null; B.foe = null; B.engaged = false; B.bseq = null; B.coverWanted = false; B.hitBy = null;
      bot.yaw = bot.intent.yaw = Math.PI / 2;
      shotsBack = hitsOnPlayer = built = 0; firstHit = firstBuild = firstShot = null;
      p.pos.set(3, c.physics.groundHeight(3, 28, 100, 0.38).y + 0.02, 28); s.look(-Math.PI / 2, 0); c.cam.init = false;
      const t0 = c.time.now;
      // 被「玩家」連打兩發（各 20 傷害）；之後玩家不再開火，看 bot 怎麼反應
      for (let i = 0; i < 36; i++) { if (i === 0 || i === 1) bot.takeDamage(20, { source: p, weapon: 'ar', point: bot.pos }); s.fastForward(0.25); if (!bot.alive) break; }
      const mine = [...c.build.pieces.values()].filter((q) => q.owner === bot).length;
      trials.push({ hit: firstHit !== null ? +(firstHit - t0).toFixed(2) : null, buildAfter: firstBuild && firstHit ? +(firstBuild - firstHit).toFixed(2) : null, shotAfter: firstShot && firstHit ? +(firstShot - firstHit).toFixed(2) : null, built, mine, shotsBack, hitsOnPlayer, hp: bot.health | 0, alive: bot.alive });
    }
    s.aimAt(null);
    return trials;
  });
  console.log('[duel]', JSON.stringify(r));
  const coverN = r.filter((x) => x.built > 0 && x.buildAfter !== null && x.buildAfter < 2.5).length, backN = r.filter((x) => x.shotsBack >= 3).length;
  check('duel', `被打後 2.5 秒內蓋出掩護（${coverN}/6 次，要求 ≥ 4）`, coverN >= 4, r);
  check('duel', `9 秒內有還擊（${backN}/6 次，要求 ≥ 3）`, backN >= 3, r);
  check('duel', '無 pageerror', log.pageerrors.length === 0, log.pageerrors.slice(0, 2));
  await browser.close();
}

// (b2) 三種掩護：牆、箱子、斜坡高地
if (only === 'all' || only === 'duel') {
  const { browser, page, log } = await open(html, { w: 800, h: 500 });
  const r = await page.evaluate(async () => {
    const s = window.__sw, c = s.ctx, p = c.player;
    s.start(); s.skipToGround(3, 28); c.storm.isOutside = () => false; c.storm.distToSafe = () => 0; c.bots.frozen = false; p.health = 1e6;
    for (const b of c.bots.brains) if (b.a.id > 1) b.a.takeDamage(9999, { ignoreShield: true });
    const B = c.bots.brains[0], bot = B.a, out = {};
    for (const kind of ['wall', 'box', 'ramp']) {
      for (const q of [...c.build.pieces.values()]) q.takeDamage(1e9, {});
      s.fastForward(1.5);
      const x = 22, z = 28; bot.alive = true; bot.pos.set(x + 0.4, c.physics.groundHeight(x, z, 100, 0.38).y + 0.02, z + 0.3); bot.state = 'ground'; bot.grounded = true; bot.vel.set(0, 0, 0); bot.health = 100; bot.shield = 0; bot.action = null;
      bot.inventory.slots = [{ uid: 880, defId: 'ar', kind: 'weapon', rarity: 2, mag: 30, count: 1 }, null, null, null, null]; bot.inventory.selected = 1; bot.inventory.ammo.medium = 300; bot.inventory.mats = { wood: 300, stone: 0, metal: 0 };
      B.skill = 0.9; B.landedAt = -99; B.buildCd = 0; B.pass = new Map(); B.loot = null; B.foe = null; B.engaged = false; B.bseq = null; B.hitBy = null; B.coverWanted = false; B.forceCover = kind;
      const y0 = bot.pos.y; let maxY = y0;
      // 玩家（無敵）在 -X 方向 30 m，打一下觸發
      p.pos.set(-8, c.physics.groundHeight(-8, 28, 100, 0.38).y + 0.02, 28); s.look(-Math.PI / 2, 0); c.cam.init = false;
      B.foe = p; B.firstSeen = c.time.now - 1; B.lastSeen = c.time.now; B.hitBy = p; B.hitAt = c.time.now; B.lastHurtAt = c.time.now; B.coverWanted = true; B.coverAt = c.time.now;
      for (let i = 0; i < 40; i++) { s.fastForward(0.25); maxY = Math.max(maxY, bot.pos.y); }
      const mine = [...c.build.pieces.values()].filter((q) => q.owner === bot);
      out[kind] = { pieces: mine.length, types: mine.map((q) => q.type[0]).join(''), dy: +(maxY - y0).toFixed(1), kind: B.coverKind, finalDy: +(bot.pos.y - y0).toFixed(1) };
    }
    return out;
  });
  console.log('[cover]', JSON.stringify(r));
  check('duel', '牆掩護：蓋出牆', r.wall.pieces >= 1, r.wall);
  check('duel', '箱子：至少 3 面牆＋屋頂', r.box.pieces >= 4, r.box);
  check('duel', '斜坡：爬升至少 3 m 高地', r.ramp.dy >= 3, r.ramp);
  check('duel', '無 pageerror', log.pageerrors.length === 0, log.pageerrors.slice(0, 2));
  await browser.close();
}

// (b3) 觀戰 LOD：玩家死亡後，鏡頭看的地方（觀戰目標）附近的打鬥必須真的開槍（不能用簡化結算）
if (only === 'all' || only === 'duel') {
  const { browser, page, log } = await open(html, { w: 800, h: 500 });
  const r = await page.evaluate(async () => {
    const s = window.__sw, c = s.ctx; let shots = 0;
    s.start(); s.teleport(-395, 395); s.fastForward(100);
    c.player.takeDamage(9999, { ignoreShield: true });
    const alive = c.bots.brains.filter((b) => b.a.alive);
    const far = alive.sort((a, b) => Math.hypot(b.a.pos.x + 395, b.a.pos.z - 395) - Math.hypot(a.a.pos.x + 395, a.a.pos.z - 395))[0];
    const other = alive.filter((b) => b !== far)[0];
    c.cam.follow(far.a); c.storm.isOutside = () => false; c.storm.distToSafe = () => 0;
    c.events.on('shot', (e) => { if (e.actor === far.a || e.actor === other.a) shots++; });
    for (const [b, o, sg] of [[far, other, 1], [other, far, -1]]) {
      const a = b.a; a.pos.set(far.a.pos.x + sg * 8, far.a.pos.y, far.a.pos.z); a.vel.set(0, 0, 0); a.health = 1e6; a.state = 'ground'; a.grounded = true;
      a.inventory.slots[0] = { uid: 99000 + a.id, defId: 'ar', kind: 'weapon', rarity: 1, mag: 30, count: 1 }; a.inventory.ammo.medium = 999; a.inventory.selected = 1;
      const now = c.time.now; b.engaged = true; b.foe = o.a; b.fightStart = now; b.fightMax = 1e9; b.pass.set(o.a, { fight: true, until: 1e9 }); b.firstSeen = now - 1; b.lastSeen = now; b.fleeUntil = 0; b.bseq = null; b.buildCd = 1e9;
    }
    s.fastForward(10);
    return { shots, farFlag: far.far, dist: Math.round(Math.hypot(far.a.pos.x + 395, far.a.pos.z - 395)) };
  });
  console.log('[spectate]', JSON.stringify(r));
  check('spectate', '離玩家屍體很遠、但在觀戰目標旁的打鬥有真實開火', r.dist > 300 && r.farFlag === false && r.shots >= 3, r);
  await browser.close();
}

// (c) 卡住測試：把 bot 丟進房屋（一樓、二樓）→ 必須走出去
if (only === 'all' || only === 'stuck') {
  const { browser, page, log } = await open(html, { w: 800, h: 500 });
  const r = await page.evaluate(async () => {
    const s = window.__sw, c = s.ctx, W = c.world;
    s.start(); s.skipToGround(-395, 395); c.storm.isOutside = () => false; c.storm.distToSafe = () => 0; c.bots.frozen = false;
    c.player.takeDamage = () => ({ shieldDamage: 0, healthDamage: 0, killed: false });
    const inHouse = (h, x, z) => { const cs = Math.cos(h.yaw), sn = Math.sin(h.yaw), dx = x - h.x, dz = z - h.z; return Math.abs(dx * cs - dz * sn) < h.W / 2 + 0.3 && Math.abs(dx * sn + dz * cs) < h.D / 2 + 0.3; };
    const cases = [];
    for (const h of W.houses) {
      for (const L of [0, 1]) {
        if (L >= h.floors) continue;
        const spots = W.lootSpots.filter((q) => q.inside && inHouse(h, q.x, q.z) && Math.abs(q.y - (h.y + 3.5 * L)) < 0.6);
        if (spots.length) cases.push({ h, L, sp: spots[0] });
      }
    }
    // 取樣：每個 POI 盡量涵蓋，最多 24 個案例
    const c0 = cases.filter((q) => q.L === 0), c1 = cases.filter((q) => q.L === 1), pick = [];
    const take = (arr, k) => { const st = Math.max(1, Math.floor(arr.length / k)); for (let i = 0; i < arr.length && k > 0; i += st, k--) pick.push(arr[i]); };
    take(c0, 11); take(c1, 12);
    const n = Math.min(pick.length + 6, 29);
    for (const b of c.bots.brains) if (b.a.id > n) b.a.takeDamage(9999, { ignoreShield: true });
    const res = [];
    pick.slice(0, n).forEach((cs, i) => {
      const b = c.bots.brains[i], a = b.a; a.pos.set(cs.sp.x, cs.sp.y + 0.05, cs.sp.z); a.vel.set(0, 0, 0); a.state = 'ground'; a.grounded = true; a.health = 1e9;
      b.landedAt = -99; b.pass = new Map(); b.loot = null;
      const gx = cs.h.L2W(0, -cs.h.D / 2 - 30), gz = gx[1];
      c.bots.setGoal(a.id, gx[0], gz);
      res.push({ b, cs, exitAt: null, still: 0, maxStill: 0, last: a.pos.clone(), gx: gx[0], gz });
    });
    // 另外 6 個：開闊地上被四面牆圍住（有 3 個有材料可以蓋斜坡，3 個只能用十字鎬）
    const encl = [];
    const spots = []; { const builder = c.actors[29]; builder.inventory.mats.wood = 999; builder.inventory.buildMat = 'wood';
      for (let gx = -240; gx <= 240 && spots.length < 6; gx += 17) for (let gz = -240; gz <= 240 && spots.length < 6; gz += 23) {
        const bi = Math.floor(gx / 4), bk = Math.floor(gz / 4), h = c.terrain.heightAt(gx, gz); if (h < 3 || W.blocked(gx, gz, 4) || spots.some((q) => Math.hypot(q[0] - gx, q[1] - gz) < 40)) continue;
        const L = Math.floor((h + 0.4) / 3.5); builder.pos.set(bi * 4 + 2, h, bk * 4 + 2);
        if ([0, 1, 2, 3].every((e) => c.build.evaluate(builder, 'wall', bi, bk, L, e, true).valid)) spots.push([gx, gz]);
      } }
    for (let i = 0; i < 6 && pick.length + i < n && i < spots.length; i++) {
      const b = c.bots.brains[pick.length + i], a = b.a; const x = spots[i][0], z = spots[i][1];
      a.pos.set(x, c.physics.groundHeight(x, z, 100, 0.38).y + 0.02, z); a.vel.set(0, 0, 0); a.state = 'ground'; a.grounded = true; a.health = 1e9;
      a.inventory.slots = [null, null, null, null, null]; a.inventory.mats = { wood: i < 3 ? 100 : 0, stone: 0, metal: 0 };
      b.landedAt = -99; b.pass = new Map(); b.loot = null;
      const bi = Math.floor(x / 4), bk = Math.floor(z / 4), L = Math.floor((a.pos.y + 0.4) / 3.5);
      const cx = bi * 4 + 2, cz = bk * 4 + 2; a.pos.set(cx, a.pos.y, cz);
      const builder = c.actors[29]; builder.inventory.mats.wood = 999; builder.inventory.buildMat = 'wood'; builder.pos.set(cx, a.pos.y, cz);
      let placed = 0; for (let e = 0; e < 4; e++) if (c.build.placeAt(builder, { piece: 'wall', i: bi, k: bk, level: L, edge: e, noReach: true })) placed++;
      window.__placed = (window.__placed || []).concat(placed);
      c.bots.setGoal(a.id, cx + 40, cz + 5);
      encl.push({ b, x: cx, z: cz, exitAt: null });
    }
    for (let t = 0; t < 30; t++) {
      s.fastForward(1);
      for (const q of encl) if (q.exitAt === null && Math.hypot(q.b.a.pos.x - q.x, q.b.a.pos.z - q.z) > 4.5) q.exitAt = t + 1;
      for (const r of res) {
        const a = r.b.a, d = Math.hypot(a.pos.x - r.last.x, a.pos.y - r.last.y, a.pos.z - r.last.z);
        r.last.copy(a.pos);
        if (r.exitAt === null && !inHouse(r.cs.h, a.pos.x, a.pos.z) && Math.abs(a.pos.y - r.cs.h.y) < 3.5 * r.cs.h.floors) r.exitAt = t + 1;
        if (r.exitAt === null) { r.still = d < 0.4 ? r.still + 1 : 0; r.maxStill = Math.max(r.maxStill, r.still); }
      }
    }
    window.__encl = encl.map((q) => q.exitAt);
    return res.map((r) => ({ poi: r.cs.h.poi, floor: r.cs.L, floors: r.cs.h.floors, exit: r.exitAt, maxStill: r.maxStill, stuckCount: r.b.stuckCount }));
  });
  const bad = r.filter((x) => x.exit === null || x.exit > 14), still = r.filter((x) => x.maxStill > 4);
  const encl = await page.evaluate(() => window.__encl);
  console.log('[stuck] enclosed exits (s)', JSON.stringify(encl), 'walls placed', JSON.stringify(await page.evaluate(() => window.__placed)));
  check('stuck', '被四面牆圍住的 bot 在 14 秒內脫困（有材料與無材料各 3）', encl.length === 6 && encl.every((x) => x !== null && x <= 14), encl);
  console.log('[stuck] cases', r.length, 'exit times', r.map((x) => `${x.floor}/${x.floors}:${x.exit}`).join(' '));
  check('stuck', `房屋內 bot 都在 14 秒內走出 (${r.length} 例)`, bad.length === 0, bad);
  check('stuck', '沒有任何 bot 在屋內原地 > 4 秒', still.length === 0, still);
  check('stuck', '無 pageerror', log.pageerrors.length === 0, log.pageerrors.slice(0, 2));
  await browser.close();
}

// (e) 效能：29 bot 全開時 bots.fixedUpdate 的耗時
if (only === 'all' || only === 'perf') {
  const { browser, page } = await open(html, { w: 800, h: 500 });
  const r = await page.evaluate(async () => {
    const s = window.__sw, c = s.ctx;
    c.player.takeDamage = () => ({ shieldDamage: 0, healthDamage: 0, killed: false });
    s.start(); s.teleport(0, 20); s.fastForward(90);
    const out = {};
    for (const [name, full] of [['lod', false], ['full', true]]) {
      c.bots.forceFull = full; const orig = c.bots.fixedUpdate.bind(c.bots); let tot = 0, mx = 0, n = 0;
      c.bots.fixedUpdate = (dt) => { const t = performance.now(); orig(dt); const d = performance.now() - t; tot += d; mx = Math.max(mx, d); n++; };
      s.fastForward(10); c.bots.fixedUpdate = orig;
      out[name] = { avgMs: +(tot / n).toFixed(3), maxMs: +mx.toFixed(2), alive: c.match.alive() };
    }
    return out;
  });
  console.log('[perf]', JSON.stringify(r));
  check('perf', 'LOD 模式平均 < 2 ms／步', r.lod.avgMs < 2, r);
  check('perf', '全開（全部真實）平均 < 2 ms／步', r.full.avgMs < 2, r);
  await browser.close();
}
// (d) 截圖：滑翔、搜刮／開箱、蓋牆、近距離交戰（1440x900）
if (only === 'all' || only === 'shots') {
  const { browser, page, log } = await open(html, { w: 1440, h: 900 });
  const shot = async (name) => { await page.evaluate(() => { window.__sw.ctx.paused = true; }); await page.waitForTimeout(450); await page.screenshot({ path: resolve(outDir, `bots-${name}.png`) }); await page.evaluate(() => { window.__sw.ctx.paused = false; }); };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const fresh = () => ev(() => { const s = window.__sw, c = s.ctx; c.player.takeDamage = () => ({ shieldDamage: 0, healthDamage: 0, killed: false }); s.start(); });
  // 1. 滑翔：玩家也在滑翔，飛在一個滑翔中的 bot 旁邊
  await fresh(); await ev(() => window.__sw.fastForward(24));
  const g = await ev(() => {
    const s = window.__sw, c = s.ctx, p = c.player; const gl = c.bots.brains.filter((b) => b.a.state === 'glide' && b.a.altitude() > 30);
    if (!gl.length) return null; const b = gl[0], a = b.a;
    const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw), rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw);
    p.pos.set(a.pos.x - fx * 7 + rx * 7, a.pos.y + 3, a.pos.z - fz * 7 + rz * 7); p.vel.copy(a.vel); p.state = 'glide'; p.glideOpened = true;
    s.look(Math.atan2(-(a.pos.x - p.pos.x), -(a.pos.z - p.pos.z)) + 0.15, -0.1); c.cam.init = false; if (c.match.state === 'bus') c.match.beginPlaying();
    return { n: gl.length, alt: a.altitude() };
  });
  check('shots', '有 bot 在滑翔', !!g, g);
  await ev(() => window.__sw.fastForward(0.2)); await shot('1-glide');
  // 2. 搜刮：找一個在戶外開箱／撿東西的 bot，玩家站在旁邊看
  await fresh(); await ev(() => window.__sw.fastForward(50));
  const L = await ev(() => {
    const s = window.__sw, c = s.ctx, p = c.player; let found = null;
    const outdoors = (b) => !c.world.houses.some((h) => Math.hypot(h.x - b.a.pos.x, h.z - b.a.pos.z) < h.radius + 1);
    for (let i = 0; i < 600 && !found; i++) {
      s.fastForward(0.4);
      found = c.bots.brains.find((b) => b.a.alive && b.a.state === 'ground' && b.state === 'loot' && outdoors(b) && b.loot && (b.a.action && b.a.action.kind === 'open' || (b.loot.kind === 'pickup' && Math.hypot(b.loot.x - b.a.pos.x, b.loot.z - b.a.pos.z) < 1.3)));
    }
    if (!found) return null; const a = found.a;
    const ang = a.yaw + 2.9, x = a.pos.x + Math.sin(ang) * 4.2, z = a.pos.z + Math.cos(ang) * 4.2;
    p.pos.set(x, c.physics.groundHeight(x, z, a.pos.y + 0.6, 0.38).y + 0.02, z); p.state = 'ground'; p.grounded = true; p.vel.set(0, 0, 0);
    s.look(Math.atan2(-(a.pos.x - p.pos.x), -(a.pos.z - p.pos.z)), -0.12); c.cam.init = false;
    return { id: a.id, action: a.action && a.action.kind, state: found.state, loot: found.loot.kind };
  });
  check('shots', '找到搜刮中的 bot', !!L, L);
  await ev(() => window.__sw.fastForward(0.05)); await shot('2-loot');
  // 3. 蓋牆：玩家打 30 m 外的 bot
  await fresh();
  const bres = await ev(async () => {
    const s = window.__sw, c = s.ctx, p = c.player;
    s.skipToGround(3, 28); s.giveMats(); s.giveAmmo(); s.give('smg', 2); c.bots.frozen = false;
    for (const b of c.bots.brains) if (b.a.id > 1) b.a.takeDamage(9999, { ignoreShield: true });
    const B = c.bots.brains[0], bot = B.a;
    bot.pos.set(25, c.physics.groundHeight(25, 28, 100, 0.38).y + 0.02, 28); bot.state = 'ground'; bot.grounded = true; bot.health = 100; bot.shield = 0;
    bot.inventory.slots = [{ uid: 5001, defId: 'ar', kind: 'weapon', rarity: 2, mag: 30, count: 1 }, null, null, null, null]; bot.inventory.selected = 1; bot.inventory.ammo.medium = 200; bot.inventory.mats = { wood: 200, stone: 0, metal: 0 };
    B.skill = 0.9; B.landedAt = -99; B.buildCd = 0; B.pass = new Map(); B.loot = null; B.foe = null; B.engaged = false; B.bseq = null; B.hitBy = null;
    p.health = 1e6; s.look(-Math.PI / 2, 0.02);
    const mine = () => [...c.build.pieces.values()].filter((q) => q.owner === bot).length;
    for (let tr = 0; tr < 5 && !mine(); tr++) {
      bot.health = 100; B.buildCd = 0; B.coverWanted = false; B.bseq = null; s.aimAt(bot.id);
      for (let i = 0; i < 4; i++) { s.press({ fire: i < 2 }); s.fastForward(0.25); } s.press(null); s.aimAt(null);
      s.fastForward(1.0);
    }
    s.fastForward(3.4);
    return { pieces: mine(), hp: bot.health };
  });
  check('shots', '蓋牆截圖：bot 蓋了牆', bres.pieces > 0, bres);
  await shot('3-build');
  // 4. 近距離交戰：兩個 bot 在玩家前方互打，玩家旁觀
  await fresh();
  const fres = await ev(async () => {
    const s = window.__sw, c = s.ctx, p = c.player;
    s.skipToGround(3, 28); c.bots.frozen = false; for (const b of c.bots.brains) if (b.a.id > 3) b.a.takeDamage(9999, { ignoreShield: true });
    const mk = (b, x, z, def, yaw) => { const a = b.a; a.pos.set(x, c.physics.groundHeight(x, z, 100, 0.38).y + 0.02, z); a.vel.set(0, 0, 0); a.state = 'ground'; a.grounded = true; a.health = 100; a.shield = 50; a.action = null;
      a.inventory.slots = [{ uid: 6000 + a.id, defId: def, kind: 'weapon', rarity: 2, mag: 30, count: 1 }, null, null, null, null]; a.inventory.selected = 1; a.inventory.ammo = { light: 300, medium: 300, heavy: 20, shells: 40 }; a.inventory.mats = { wood: 0, stone: 0, metal: 0 };
      b.skill = 0.6; b.landedAt = -99; b.pass = new Map(); b.loot = null; b.bseq = null; b.engaged = false; b.foe = null; b.hitBy = null; b.fleeUntil = 0; b.aggr = 1.3; a.yaw = a.intent.yaw = yaw; };
    const A = c.bots.brains[1], B = c.bots.brains[2];
    mk(A, 22, 40, 'ar', 0); mk(B, 22, 16, 'smg', Math.PI);
    p.pos.set(8, c.physics.groundHeight(8, 28, 100, 0.38).y + 0.02, 28); s.look(-Math.PI / 2, -0.03); c.cam.init = false;
    for (const [b, o] of [[A, B], [B, A]]) { const now = c.time.now; b.engaged = true; b.foe = o.a; b.fightStart = now; b.fightMax = 1e9; b.pass.set(o.a, { fight: true, until: 1e9 }); b.firstSeen = now - 1; b.lastSeen = now; }
    let seen = 0; c.events.on('shot', (e) => { if (e.actor === A.a || e.actor === B.a) seen++; });
    for (let i = 0; i < 60 && seen < 8; i++) s.fastForward(0.1);
    return { shots: seen, a: A.a.health | 0, b: B.a.health | 0 };
  });
  check('shots', '交戰截圖：bot 互相開火', fres.shots >= 6, fres);
  await shot('4-fight');
  check('shots', '無 pageerror', log.pageerrors.length === 0, log.pageerrors.slice(0, 2));
  check('shots', '無 console.error', log.errors.length === 0, log.errors.slice(0, 2));
  await browser.close();
}

console.log(JSON.stringify({ ok: failed === 0, failed, report }, null, 1));
process.exit(failed ? 1 : 0);
