// 188 彩筆曠野：主線流程回歸測試。用法：PLAYWRIGHT_MODULE=<playwright 路徑> node tests/brushwild-regression.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs'; import http from 'node:http'; import path from 'node:path'; import os from 'node:os'; import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url))), output = fs.mkdtempSync(path.join(os.tmpdir(), 'brushwild-'));
const server = http.createServer((req, res) => { const pathname = new URL(req.url, 'http://localhost').pathname, file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname)); if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); } res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html' : /\.(js|mjs)$/.test(file) ? 'text/javascript' : 'application/octet-stream'); res.end(fs.readFileSync(file)); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}), args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const slow = { timeout: 240000 };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }), errors = [], external = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
  await page.goto(origin + '/web/188-brushwild.html');
  await page.waitForSelector('#title:not(.hide)', slow);
  assert(await page.evaluate(() => !!document.querySelector('meta[name=viewport]')));
  const counts = await page.evaluate(() => ({ types: Object.keys(brushwild.ENEMY_TYPES).length, zones: Object.keys(brushwild.ZONES), dungeons: Object.values(brushwild.ZONES).filter(z => z.boss).length, crystals: brushwild.CRYSTALS.length }));
  assert(counts.types >= 30); assert.equal(counts.dungeons, 3); assert(counts.zones.includes('cave')); assert.equal(counts.crystals, 4);
  assert.equal(await page.evaluate(() => brushwild.models), true, 'Blender 模型沒有載入');
  await page.click('#bNew');
  await page.waitForFunction(() => brushwild.G.talking, null, slow);
  while (await page.evaluate(() => brushwild.G.talking)) await page.evaluate(() => document.getElementById('talk').click());
  await page.evaluate(() => { brushwild.G.noLock = true; brushwild.god(true); });

  // 湖心小島與藤橋兩端都在水面上
  const lake = await page.evaluate(() => [brushwild.H(-131, -32), brushwild.H(-96.5, -32), brushwild.H(-92, -32)]);
  assert(lake.every(h => h > .5), 'lake heights ' + lake);

  // 揮筆真的打得死怪
  const k0 = await page.evaluate(() => brushwild.S().kills || 0);
  await page.evaluate(() => { const P = brushwild.P; P.yaw = brushwild.CAM.yaw + Math.PI; for (let i = 0; i < 3; i++) brushwild.spawnEnemy('mudslime', P.pos.x - Math.sin(brushwild.CAM.yaw) * 2.2 + (i - 1) * .6, P.pos.z - Math.cos(brushwild.CAM.yaw) * 2.2, { zone: 'ow' }).def = Object.assign({}, brushwild.ENEMY_TYPES.mudslime, { spd: 0, arch: 'turret' }); });
  // 擊退會把原地不動的測試史萊姆推遠，所以打到有一隻倒下為止
  for (let i = 0; i < 20 && (await page.evaluate(() => brushwild.S().kills || 0)) <= k0; i++) { await page.keyboard.press('KeyJ'); await page.waitForTimeout(700); }
  assert((await page.evaluate(() => brushwild.S().kills || 0)) > k0, 'melee kills');
  // 打擊特效：命中時有特效在播、有頓幀；關掉後完全不播
  const fxOn = await page.evaluate(() => { const B = brushwild, P = B.P; const e = B.spawnEnemy('goblin', P.pos.x, P.pos.z + 3, { zone: 'ow' }); B.HFX.clear(); B.killEnemy; const before = e.hp; e.def = Object.assign({}, e.def, { spd: 0, arch: 'turret' }); window.__fxE = e; return before; });
  let seen = false;
  for (let i = 0; i < 12 && !seen; i++) { await page.evaluate(() => { const B = brushwild; B.CAM.yaw = Math.atan2(B.P.pos.x - window.__fxE.pos.x, B.P.pos.z - window.__fxE.pos.z); }); await page.keyboard.press('KeyJ'); await page.waitForTimeout(500); seen = await page.evaluate(() => window.__fxE.hp < window.__fxE.maxHp && !!window.__fxE.fxT); }
  assert(seen, 'hit fx target');
  await page.evaluate(() => { brushwild.HFX.enabled = false; brushwild.HFX.clear(); });
  const offLive = await page.evaluate(() => { const B = brushwild, e = window.__fxE; B.HFX.hit({ pos: e.pos.clone(), color: 0xff0000, damage: 1 }); return B.HFX.live.length; });
  assert.equal(offLive, 0, 'hit fx off');
  await page.evaluate(() => { brushwild.HFX.enabled = true; });

  // 水晶：守護者還在 → 塗不亮；打倒後錯色不亮、對色才亮；四顆都亮 → 解鎖飛行
  const gate = await page.evaluate(() => {
    const B = brushwild, S = B.S(), out = [];
    for (const cr of B.CRYSTALS) {
      const camp = B.CAMPS.find(c => c.guard === cr.c);
      cr.thing.paint(cr.c); out.push(S.crystals[cr.c]);
      B.ENEMIES.filter(e => e.camp === camp && !e.dead).forEach(e => B.killEnemy(e, 0));
      cr.thing.paint((cr.c + 1) % 4); out.push(S.crystals[cr.c]);
      cr.thing.paint(cr.c); out.push(S.crystals[cr.c]);
    }
    return out;
  });
  assert.deepEqual(gate, [false, false, true, false, false, true, false, false, true, false, false, true]);
  await page.waitForFunction(() => brushwild.S().flight, null, slow);

  // 彈花：塗黃 → 踩上去 → 落在風鈴浮島上
  await page.evaluate(() => { const B = brushwild; B.warp(-110, 118); const L = B.THINGS.find(t => t.kind === 'launch' && t.L.id === 'L1'); L.paint(2); B.P.pos.set(L.L.x, L.L.y, L.L.z); });
  await page.waitForFunction(() => brushwild.P.launch, null, slow);
  await page.waitForFunction(() => !brushwild.P.launch, null, slow);
  const landed = await page.evaluate(() => { const I = brushwild.ISLES.find(i => i.id === 'a'), P = brushwild.P; return [P.pos.y, Math.hypot(P.pos.x - I.x, P.pos.z - I.z), I.r]; });
  assert(landed[0] > 44 && landed[1] < landed[2], 'launcher landing ' + landed);

  // 三座地城：每個房間用真的機關解開，必須打倒的怪用燒死（走 killEnemy 路徑），門要打開；頭目倒下後出口與寶箱出現
  for (const z of ['d1', 'd2', 'd3']) {
    await page.evaluate(z => brushwild.enterZone(z, null, true), z);
    await page.waitForFunction(z => brushwild.G.zone === z, z, slow);
    const Zrooms = await page.evaluate(z => brushwild.ZONES[z].rooms.length, z);
    for (let ri = 0; ri < Zrooms - 1; ri++) {
      await page.evaluate(([z, ri]) => {
        const B = brushwild, Z = B.ZONES[z], rm = Z.rooms[ri], T = B.THINGS.filter(t => t.zone === z && t.cell && t.cell.room === ri);
        T.filter(t => t.kind === 'bramble' || t.kind === 'iceblock').forEach(t => t.paint(0, { x: 0, z: -1 }));
        T.filter(t => t.kind === 'torch').forEach(t => t.paint(0));
        T.filter(t => t.kind === 'orb').forEach(t => t.paint(t.ci));
        T.filter(t => t.kind === 'seed').forEach(t => t.paint(3));
        T.filter(t => t.kind === 'firejet').forEach(t => t.paint(1));
        const crate = T.find(t => t.kind === 'crate'), plate = T.find(t => t.kind === 'plate');
        if (crate && plate) { const dz = Math.sign(plate.cell.r - crate.cur.r); B.P.pos.set(crate.cur.x, 0, crate.cur.z - dz * 4); crate.push({ x: 0, z: dz }); }
        B.ENEMIES.filter(e => e.zone === z && e.spawn && e.spawn.cell.room === ri && !e.dead).forEach(e => { e.hp = .3; e.st.burn = 1; e.burnT = 0; });
      }, [z, ri]);
      await page.waitForFunction(([z, ri]) => brushwild.ZONES[z].rooms[ri].solved, [z, ri], slow);
      assert(await page.evaluate(([z, ri]) => brushwild.ZONES[z].rooms[ri].doors.every(d => d.open), [z, ri]), `${z} room ${ri} doors`);
    }
    const last = Zrooms - 1;
    await page.evaluate(([z, last]) => { const B = brushwild, Z = B.ZONES[z]; const bs = B.THINGS.find(t => t.zone === z && t.kind === 'bossSpawn'); B.P.pos.set(bs.cell.x, 0, bs.cell.z + 10); }, [z, last]);
    await page.waitForFunction(() => brushwild.G.bossActive, null, slow);
    await page.screenshot({ path: `${output}/boss-${z}.png` });
    await page.evaluate(() => brushwild.killBoss());
    await page.waitForFunction(([z, last]) => brushwild.ZONES[z].rooms[last].solved, [z, last], slow);
    const reveal = await page.evaluate(([z, last]) => brushwild.THINGS.filter(t => t.zone === z && t.cell && t.cell.room === last && (t.kind === 'portal' || t.kind === 'chest')).map(t => !t.hidden && t.mesh.visible), [z, last]);
    assert.deepEqual(reveal, [true, true], `${z} boss room reveal`);
  }
  assert.deepEqual(await page.evaluate(() => brushwild.S().dungeons), [true, true, true]);

  // 地城裡摔落／倒下會回到檢查點
  await page.evaluate(() => { const B = brushwild; B.god(false); B.P.inv = 0; B.P.hp = 1; B.hurtPlayer(2); });
  await page.waitForFunction(() => !brushwild.P.dead && brushwild.P.hp === brushwild.P.maxHp, null, slow);
  assert.equal(await page.evaluate(() => brushwild.G.zone), 'd3');

  // 天頂島：護罩消失、巨像出現、打倒後結局
  await page.evaluate(() => { const B = brushwild, I = B.ISLES.find(i => i.final); B.enterZone('ow', { x: I.x + 8, z: I.z + 24, y: I.y }, true); });
  await page.waitForFunction(() => brushwild.G.bossActive && brushwild.G.bossActive.id === 'colossus', null, slow);
  await page.screenshot({ path: `${output}/colossus.png` });
  await page.evaluate(() => brushwild.killBoss());
  await page.waitForSelector('#ending:not(.hide)', slow);

  // 存檔讀檔
  await page.evaluate(() => { document.getElementById('bEndGo').click(); brushwild.saveGame(); });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('brushwild188-save-v1')));
  await page.reload(); await page.waitForSelector('#bCont:not(.hide)', slow); await page.click('#bCont');
  await page.waitForFunction(() => brushwild.G.running, null, slow);
  const restored = await page.evaluate(() => { const S = brushwild.S(); return { crystals: S.crystals, dungeons: S.dungeons, final: S.final, flight: S.flight }; });
  assert.deepEqual(restored, { crystals: saved.crystals, dungeons: saved.dungeons, final: true, flight: true });
  assert(await page.evaluate(() => brushwild.ZONES.d1.rooms.every(r => r.solved)));
  await page.screenshot({ path: `${output}/desktop.png` });
  await page.close();

  const mp = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const merr = [];
  mp.on('pageerror', e => merr.push(e.message)); mp.on('console', m => { if (m.type() === 'error') merr.push(m.text()); });
  await mp.goto(origin + '/web/188-brushwild.html'); await mp.waitForSelector('#title:not(.hide)', slow);
  assert(await mp.evaluate(() => document.documentElement.scrollWidth === innerWidth));
  await mp.click('#bNew'); await mp.waitForTimeout(1500);
  assert(await mp.evaluate(() => document.documentElement.scrollWidth === innerWidth));
  await mp.screenshot({ path: `${output}/mobile.png` });
  assert.deepEqual(merr, []);
  assert.deepEqual(errors, []);
  assert(external.every(u => u.startsWith('https://cdn.jsdelivr.net/npm/three@0.186.0/')), 'external ' + external);
  // 模型載不到（直接開檔、離線）時要退回程式建模，而且不能報錯
  const fb = await browser.newPage({ viewport: { width: 1280, height: 800 } }); const ferr = [];
  fb.on('pageerror', e => ferr.push(e.message)); fb.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) ferr.push(m.text()); });
  await fb.route('**/assets/188/*.glb', r => r.abort());
  await fb.goto(origin + '/web/188-brushwild.html'); await fb.waitForSelector('#title:not(.hide)', slow);
  assert.equal(await fb.evaluate(() => brushwild.models), false);
  await fb.click('#bNew'); await fb.waitForTimeout(2500);
  await fb.evaluate(() => { const P = brushwild.P; ['mudslime', 'goblin', 'boar'].forEach((id, i) => brushwild.spawnEnemy(id, P.pos.x + i * 3, P.pos.z - 8, { zone: 'ow' })); brushwild.enterZone('d1', null, true); });
  await fb.waitForTimeout(1500);
  assert.deepEqual(ferr, []);
  await fb.close();
  console.log('PASS Blender models loaded, procedural fallback without glb, 37+ enemy types, melee kills, crystal guardian and color gate, flight unlock, launcher to sky isle, 3 dungeons solved room by room with doors, boss rooms reveal exit and chest, respawn, colossus and ending, save/continue, mobile no overflow. Screenshots: ' + output);
} finally { await browser.close(); await new Promise(r => server.close(r)); }
