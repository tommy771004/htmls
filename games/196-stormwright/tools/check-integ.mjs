// 整合走查：node tools/check-integ.mjs <html> [--out dir] [--only desktop|mobile]
// 選單 → 飛艇（等艙門）→ 跳下 → 自由落體 → 滑翔 → 蜂蜜鎮落地 → 開寶箱 → 撿武器（含換槍提示）→ 射擊 bot（爆頭＋身體）→ 換彈
// → 十字鎬採樹（弱點）→ 牆／地板／斜坡 → 斜坡衝刺 4 階 → 喝護盾 → 風暴跳階段 → 勝利；再走淘汰路線；最後重新開始再玩一輪。每步截圖。
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { open } from './lib.mjs';

const a = process.argv.slice(2);
const html = a.find((x, i) => !x.startsWith('--') && a[i - 1] !== '--out' && a[i - 1] !== '--only') || 'dist/integ/index.html';
const oi = a.indexOf('--out'), only = a[a.indexOf('--only') + 1];
const outDir = resolve(oi >= 0 ? a[oi + 1] : 'dist/integ/walk');
mkdirSync(outDir, { recursive: true });
let failed = 0; const report = [];

async function run(name, w, h, touch) {
  const { browser, page, log } = await open(html, { w, h, touch });
  const checks = [];
  const check = (n, ok, d) => { checks.push({ n, ok: !!ok, d }); if (!ok) { failed++; console.error('FAIL', name, n, JSON.stringify(d)); } };
  const shot = (s) => page.screenshot({ path: resolve(outDir, `${name}-${s}.png`) });
  const wait = (ms) => page.waitForTimeout(ms);
  const sw = (code) => page.evaluate(`(() => { const s = window.__sw, c = s.ctx, p = c.player; ${code} })()`);
  const press = (o) => sw(`s.press(${JSON.stringify(o)});`);
  const ff = (sec) => sw(`s.fastForward(${sec});`);
  const pose = () => sw('return { st: p.state, y: +p.pos.y.toFixed(2), alive: p.alive, hp: p.health, sh: p.shield }');
  await sw(`window.__log = []; for (const n of ['damage','harvest','reload','pickup','chestOpen','buildPlaced','jump','glide','land','busDoor','eliminated','matchOver','mantle','equip','consume','dryFire','shieldBreak','lightning']) c.events.on(n, (e) => window.__log.push({ n, headshot: e.headshot, weakPoint: e.weakPoint, material: e.material, phase: e.phase, amount: e.amount, win: e.winner === p, victim: e.victim && e.victim.id, src: e.source && e.source.id, tgt: e.target && e.target.id }));`);
  const evs = (n) => sw(`return window.__log.filter((e) => e.n === ${JSON.stringify(n)})`);
  const settleBlank = () => sw('window.__log.length = 0;');

  // ---- 1 選單 ----
  await page.mouse.click(4, 4); await wait(1500); await shot('01-menu');
  check('AudioContext 啟動', (await sw("return c.audio.ac && c.audio.ac.state")) === 'running', await sw('return c.audio.ac && c.audio.ac.state'));
  check('選單', (await sw('return c.match.state')) === 'menu');
  let loot0 = -1;
  await sw('window.__snd = {}; const op = c.audio.play.bind(c.audio); c.audio.play = (n, o) => { window.__snd[n] = (window.__snd[n] || 0) + 1; return op(n, o); };');

  async function matchFlow(tag, full) {
    // ---- 2 飛艇 ----
    await sw('s.start();'); await wait(1600); await shot(`${tag}02-bus`);
    check(`${tag}飛艇狀態`, (await sw('return c.match.state')) === 'bus' && (await sw('return p.state')) === 'bus');
    check(`${tag}開局清空（建材/風暴/存活）`, (await sw('return [c.build.pieces.size, c.storm.phase, c.match.alive(), c.cam.orbitTarget, c.cam.followTarget].join()')) === '0,0,30,,');
    const lc = await sw('return c.loot.pickups.length'); if (loot0 < 0) loot0 = lc;
    check(`${tag}重置後戰利品數量一致`, Math.abs(lc - loot0) < 25 && lc > 100, [lc, loot0]);
    await sw('s.fastForward(1.2);'); await wait(500);
    check(`${tag}艙門倒數顯示`, await sw("return /艙門開啟倒數/.test(document.getElementById('busmsg').textContent)"));
    await sw('s.fastForward(4);'); await wait(500); await shot(`${tag}03-bus-door`);
    check(`${tag}艙門開啟`, (await evs('busDoor')).length >= 1);
    // ---- 3 跳下 ----
    await press({ jump: true }); await sw('s.fastForward(0.1);'); await press(null);
    check(`${tag}跳下→自由落體`, (await sw('return p.state')) === 'skydive');
    // 把玩家放到蜂蜜鎮上空（保持姿態），低頭俯衝
    await sw('p.pos.set(8, 120, 70); p.vel.set(0, -20, -10); s.look(0, -0.7); c.cam.init = false;'); await sw('s.fastForward(0.8);'); await wait(500); await shot(`${tag}04-skydive`);
    await sw('s.look(0, -0.15); s.fastForward(1.2); p.pos.y = Math.min(p.pos.y, 70); p.pos.set(8, 70, 60); c.cam.init = false;');
    // ---- 4 滑翔 ----
    await press({ jump: true }); await sw('s.fastForward(0.1);'); await press(null);
    const gl = await pose(); check(`${tag}開滑翔翼`, gl.st === 'glide', gl);
    await press({ moveX: 0.6 }); await sw('s.fastForward(1.0);'); await wait(500); await shot(`${tag}05-glide`); await press(null);
    await sw('s.fastForward(3.5);');
    let n = 0; while ((await sw('return p.state')) === 'glide' && n++ < 20) await sw('s.fastForward(1);');
    const ld = await pose(); check(`${tag}落地`, ld.st === 'ground', ld);
    await sw('s.look(0, -0.05);'); await ff(0.5);
    const where = await sw('return c.world.poiAt(p.pos.x, p.pos.z)');
    check(`${tag}降落在蜂蜜鎮附近`, where === '蜂蜜鎮', where);
    await wait(500); await shot(`${tag}06-landed`);
    if (!full) return;
    // ---- 5 開寶箱 ----
    await sw('s.freezeBots(true); s.look(0, -0.3); s.spawnChest(2.0);'); await ff(0.2); await wait(300); await shot('07-chest-prompt');
    check('寶箱提示', await sw("return !document.getElementById('prompt').hidden && /開啟/.test(document.getElementById('promptTxt').textContent)"));
    await settleBlank(); await press({ interact: true }); await sw('s.fastForward(0.8);'); await wait(300); await shot('08-chest-opening'); await sw('s.fastForward(0.8);'); await press(null); await sw('s.fastForward(0.6);'); await wait(500); await shot('09-chest-open');
    check('寶箱開啟', (await evs('chestOpen')).length === 1);
    await sw('s.fastForward(1.2);'); await wait(400); await shot('10-chest-loot');
    // ---- 6 撿武器 ----
    await sw("s.dropItem('ar', 3, 1.0);"); await ff(0.3); await wait(300); await shot('11-weapon-prompt');
    const pr = await sw("return document.getElementById('promptTxt').textContent");
    check('武器撿取提示', /撿起|交換/.test(pr), pr);
    await settleBlank(); await press({ interact: true }); await sw('s.fastForward(0.1);'); await press(null); await ff(0.2);
    check('撿起武器', (await sw("return p.inventory.slots.some((i) => i && i.defId === 'ar')")) , await sw('return p.inventory.slots.map((i) => i && i.defId)'));
    // 背包滿 → 交換提示
    await sw("for (const d of ['pump','smg','sniper','pistol','ar']) s.give(d, 1); s.dropItem('smg', 3, 1.0); p.inventory.selected = 1;"); await ff(0.3); await wait(300); await shot('12-swap-prompt');
    const sp = await sw("return document.getElementById('promptTxt').textContent");
    check('背包滿 → 交換卡片', /交換/.test(sp), sp);
    await sw('s.ctx.loot.clear();');
    // ---- 7 射擊 bot：身體 + 爆頭 ----
    await sw("s.give('ar', 3); s.giveAmmo(); s.freezeBots(true);");
    const bot = await sw('return s.spawnBotNear(14)');
    await sw(`c.actors[${bot}].health = 400; c.aimLockY = 1.1; s.aimAt(${bot});`); await ff(0.4);
    await settleBlank(); await press({ fire: true }); await sw('s.fastForward(0.12);'); await press(null); await wait(250); await shot('13-shoot-body');
    await sw(`c.aimLockY = 1.62;`); await ff(0.5);
    for (let i = 0; i < 4; i++) { await press({ fire: true, ads: true }); await sw('s.fastForward(0.15);'); await press({ ads: true }); await sw('s.fastForward(0.3);'); }
    await press(null); await wait(250); await shot('14-shoot-head');
    const dm = await evs('damage');
    check('身體命中', dm.some((e) => e.src === 0 && e.tgt === bot && !e.headshot), dm.length);
    check('爆頭命中', dm.some((e) => e.src === 0 && e.tgt === bot && e.headshot), dm.length);
    await press({ fire: true }); await sw('s.fastForward(1.5);'); await press(null);
    const mag0 = await sw('return p.inventory.current().mag');
    // ---- 8 換彈 ----
    await settleBlank(); await press({ reload: true }); await sw('s.fastForward(0.1);'); await press(null); await wait(200); await shot('15-reload');
    check('換彈中動作', (await sw("return p.action && p.action.kind")) === 'reload');
    await sw('s.fastForward(3);'); const mag1 = await sw('return p.inventory.current().mag');
    check('換彈完成', mag1 > mag0 && mag1 === 30, [mag0, mag1]);
    await sw('s.aimAt(null); c.aimLockY = null; s.killBots(1);'); await ff(0.5);
    // ---- 9 十字鎬採樹（弱點）----
    const tree = await sw(`let best = null, bd = 1e9; for (const r of c.world.treeRefs) { if (r.dead) continue; const d = Math.hypot(r.x - p.pos.x, r.z - p.pos.z); if (d < bd) { bd = d; best = r; } } return best ? { x: best.x, y: best.y, z: best.z } : null`);
    check('找到樹', !!tree);
    if (tree) {
      await sw(`const t = ${JSON.stringify(tree)}; const dx = p.pos.x - t.x, dz = p.pos.z - t.z, l = Math.hypot(dx, dz) || 1; s.teleport(t.x + dx / l * 2.2, t.z + dz / l * 2.2); p.inventory.selected = 0; s.look(Math.atan2(-(t.x - p.pos.x), -(t.z - p.pos.z)), 0.1);`);
      await ff(0.6); await settleBlank();
      await press({ fire: true }); await sw('s.fastForward(0.9);'); await wait(120); await shot('16-pickaxe-hit');
      const wk = await sw('return c.combat.weakPoint.active ? c.combat.weakPoint.point.toArray() : null');
      check('出現採集弱點', !!wk, wk);
      if (wk) { await sw(`c.aimLockPoint = new c.THREE.Vector3(${wk.join(',')}); c.aimLockPoint.y += 0;`); await sw('s.fastForward(0.7);'); await wait(150); await shot('17-pickaxe-weak'); }
      await press(null); await sw('c.aimLockPoint = null;');
      const hv = await evs('harvest');
      check('採集木材', hv.length >= 1 && hv[0].material === 'wood', hv.length);
      check('弱點雙倍', hv.some((e) => e.weakPoint), hv.map((e) => [e.amount, e.weakPoint]));
    }
    // ---- 10 建造 ----
    await sw('s.teleport(10, 33); s.look(0, 0); s.giveMats(); p.inventory.buildMat = "wood";'); await ff(0.3);
    const piece = async (pc, ms = 300) => { await press({ piece: pc, fire: true }); await sw(`s.fastForward(${ms / 1000});`); await press(null); await sw('s.fastForward(0.1);'); };
    await piece('wall'); await piece('floor'); await piece('ramp');
    await sw('s.press({ piece: "wall" });'); await ff(0.2); await wait(300); await shot('18-build'); await press(null);
    check('放置牆/地板/斜坡', (await sw('return c.build.pieces.size')) >= 3);
    // 無法放置提示：材料用光
    await sw('p.inventory.mats.wood = 0; p.building = true; p.buildPiece = "wall";'); await ff(0.3); await wait(300);
    const hint = await sw("return document.getElementById('bhint').hidden ? '' : document.getElementById('bhint').textContent");
    check('無法放置提示（材料不足）', /材料不足/.test(hint), hint); await shot('19-cant-place');
    await sw('s.giveMats(); p.building = false;');
    // ---- 11 斜坡衝刺 ----
    await sw('s.teleport(60, -50); s.look(0, 0.15); p.inventory.buildMat = "stone"; s.giveMats();'); await ff(0.4);
    const y0 = await sw('return p.pos.y');
    await press({ piece: 'ramp', fire: true, moveZ: 1 }); await sw('s.fastForward(0.45);'); await wait(150); await shot('20-ramp-rush-a'); await sw('s.fastForward(3.6);'); await wait(150); await shot('21-ramp-rush-b');
    const spr = await sw('return { y: p.pos.y, sprint: p.sprinting, pieces: [...c.build.pieces.values()].filter((q) => q.type === "ramp").length, g: p.grounded, v: Math.hypot(p.vel.x, p.vel.z) }');
    await press(null);
    check('斜坡衝刺 ≥ 4 階並持續爬升', spr.pieces >= 4 && spr.y - y0 > 9, spr);
    await sw('s.fastForward(1.2);'); await wait(200); await shot('22-ramp-top');
    // ---- 12 喝護盾 ----
    await sw("s.teleport(8, 30); p.shield = 0; s.give('shield'); p.building = false;"); await ff(0.3);
    await settleBlank(); await press({ fire: true }); await sw('s.fastForward(1.5);'); await wait(150); await shot('23-drink'); await sw('s.fastForward(4.2);'); await press(null);
    check('護盾藥水', (await sw('return p.shield')) >= 49, await sw('return p.shield'));
    // ---- 12b 音效／特效補測：繃帶、射牆、射地、空槍、狙擊 ----
    await sw("p.health = 40; s.give('bandage'); p.building = false;"); await ff(0.2); await press({ fire: true }); await sw('s.fastForward(4);'); await press(null);
    await sw("s.teleport(30, 60); s.look(0, 0); s.give('ar', 3); s.giveAmmo(); s.giveMats(); p.inventory.buildMat = 'wood'; s.freezeBots(true);"); await ff(0.3);
    const wl = await sw("const pc = c.build.placeAt(p, { piece: 'wall', i: Math.floor(p.pos.x / 4), k: Math.floor(p.pos.z / 4) - 2, level: Math.floor((p.pos.y + 0.4) / 3.5), edge: 0, noReach: true }); return pc ? pc.center.toArray() : null");
    if (wl) { await sw(`c.aimLockPoint = new c.THREE.Vector3(${wl[0]}, ${wl[1]}, ${wl[2]});`); await ff(0.4); await press({ fire: true }); await sw('s.fastForward(0.8);'); await press(null); await wait(200); await shot('24a-shoot-wall'); }
    await sw('c.aimLockPoint = new c.THREE.Vector3(p.pos.x + 6, 0.5, p.pos.z - 1); c.aimLockPoint.y = c.terrain.heightAt(c.aimLockPoint.x, c.aimLockPoint.z);'); await ff(0.4);
    await press({ fire: true }); await sw('s.fastForward(0.5);'); await press(null); await wait(150); await shot('24b-shoot-ground');
    await sw("c.aimLockPoint = null; p.inventory.current().mag = 0; p.inventory.ammo.medium = 0;"); await press({ fire: true }); await sw('s.fastForward(0.15);'); await press(null); await sw('s.fastForward(0.4); s.giveAmmo();');
    await sw("s.give('sniper', 3); s.giveAmmo(); s.look(0, 0.05);"); await ff(0.6); await press({ fire: true }); await sw('s.fastForward(0.2);'); await press(null); await sw('s.fastForward(1.5);');
    await sw("s.give('ar', 3); c.render.setQuality && 0;");
    // ---- 13 風暴 ----
    await sw('for (let i = 0; i < 4; i++) { s.storm.skip(); s.fastForward(6); }'); await wait(400); await shot('24-storm-circle');
    check('風暴縮圈', (await sw('return c.storm.radius')) < 400);
    await sw('const S = c.storm; s.teleport(S.center.x + S.radius + 30, S.center.y); s.fastForward(2);'); await wait(500); await shot('25-in-storm');
    check('風暴圈外 HUD', await sw("return !document.getElementById('stormWarn').hidden"));
    await sw('s.teleport(8, 30); p.health = 100;');
    // ---- 14 勝利 ----
    await sw('s.killBots(40);'); await ff(1.5); await wait(1800); await shot('26-win-orbit'); await wait(1400); await shot('27-win-screen');
    check('勝利', (await sw('return c.match.state')) === 'ended' && (await sw('return c.match.winner === p')));
    check('勝利環繞鏡頭', !!(await sw('return c.cam.orbitTarget')));
    check('勝利畫面', await sw("return !document.getElementById('end').hidden && /風暴之冠/.test(document.getElementById('endTitle').textContent)"));
  }

  await matchFlow('', true);
  // ---- 淘汰路線 ----
  await sw('s.start(); s.skipToGround(); s.freezeBots(false);'); await ff(1); await sw('p.takeDamage(999, { ignoreShield: true });'); await sw('s.fastForward(1);'); await wait(1500); await shot('28-lose-spectate');
  check('淘汰', !(await sw('return p.alive')));
  check('觀戰鏡頭鎖定', !!(await sw('return c.cam.followTarget && c.cam.followTarget.alive')));
  await sw("document.getElementById('specNext').click();"); await ff(0.3); await wait(400); await shot('29-lose-spectate-next');
  await sw("document.getElementById('btnReport').click();"); await wait(500); await shot('30-lose-screen');
  check('淘汰結算畫面', await sw("return !document.getElementById('end').hidden && /^#\\d+/.test(document.getElementById('endTitle').textContent)"));
  // ---- 重新開始再玩一輪（簡短）----
  await sw('s.restart();'); await wait(500);
  check('重新開始後角色/鏡頭重置', (await sw('return [p.alive, c.cam.followTarget, c.cam.orbitTarget].join()')) === 'true,,');
  await matchFlow('r-', false);
  await sw('s.give("ar", 3); s.giveAmmo(); s.giveMats(); s.look(0,0); const b = s.spawnBotNear(12); s.freezeBots(true); s.aimAt(b); s.press({ fire: true }); s.fastForward(3); s.press(null); s.aimAt(null);'); await wait(300); await shot('r-31-combat');
  check('第二輪：擊殺 bot', (await sw('return p.kills')) >= 1);
  await sw('s.skipToGround(); s.killBots(40); s.fastForward(1.5);'); await wait(1500); await shot('r-32-win');
  check('第二輪：勝利', (await sw('return c.match.state === "ended" && c.match.winner === p')));
  const snd = await sw('return window.__snd');
  const want = ['shot_ar','shot_sniper','sniper_crack','headshot','hit','empty','equip','harvest_wood','weakpoint','build_wood','build_hit','build_done','chest','pickup','heal','shield_heal','impact_wood','break_wood','bus_door','countdown','win','lose','jump','land','glider_open','swing','storm_warn','digitize','kill'];
  check('音效事件都有觸發', want.filter((n) => !snd[n]).length <= 2, want.filter((n) => !snd[n]));
  console.log(name, 'missing sounds:', want.filter((n) => !snd[n]).join(','));
  check('無 uncaught exception', log.pageerrors.length === 0, log.pageerrors.slice(0, 3));
  check('無 console.error', log.errors.length === 0, log.errors.slice(0, 3));
  check('無外部請求', log.external.length === 0, log.external.slice(0, 3));
  report.push({ viewport: `${w}x${h}`, gpu: log.gpu, ok: checks.every((c) => c.ok), checks: checks.filter((c) => !c.ok), total: checks.length });
  await browser.close();
}
if (only !== 'mobile') await run('desktop', 1440, 900, false);
if (only !== 'desktop') await run('mobile', 390, 844, true);
console.log(JSON.stringify({ ok: failed === 0, failed, report }, null, 1));
process.exit(failed ? 1 : 0);
