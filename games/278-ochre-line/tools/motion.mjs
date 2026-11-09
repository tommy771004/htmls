// 逐幀動作探針：node tools/motion.mjs <dir>，走一輪固定劇本（走停跳、連發、換彈、換槍、檢視、蹲、轉身、看 Bot 交火、陣亡觀戰），
// 每幀記第一人稱槍（視空間）、相機、每位士兵六根骨頭的世界座標寫到 <dir>/probe.json，CDP screencast 每幀存 <dir>/fr/*.jpg。分析用 tools/motion-report.mjs
import { startServer, launch } from './lib/serve.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
const D = process.argv[2]; const srv = await startServer(); const errs = [];
const b = await launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto(srv.url + '/web/278-ochre-line.html'); await p.waitForFunction(() => window.__ol?.ready, null, { timeout: 120000 });
const vt0 = Date.now();
await p.evaluate(() => {
  const ol = __ol, scene = ol.ctx.scene, cam = ol.ctx.camera, vm = __GAME_MCP__.vm;
  const BN = ['pelvis', 'Head', 'hand_r', 'hand_l', 'foot_l', 'foot_r'];
  const P = window.__probe = { f: [], marks: [], on: false, t0: performance.now() };
  P.mark = n => P.marks.push([performance.now() - P.t0, n]);
  const sols = [...ol.pool.atk, ...ol.pool.def], bi = BN.map(n => sols[0].sk.bones.findIndex(b => b.name === n));
  P.bnames = BN.map((n, i) => n + ':' + bi[i]);
  scene.onAfterRenderObservable.add(() => {
    if (!P.on) return;
    const v = cam.getViewMatrix().m, row = { t: performance.now() - P.t0, cp: [cam.position.x, cam.position.y, cam.position.z], cr: [cam.rotation.x, cam.rotation.y], vm: null, vmId: vm.cur?.id ?? '', s: [] };
    const g = vm.cur; if (g && g.meshes?.length) { const out = []; for (let k = 0; k < Math.min(3, g.meshes.length); k++) { const w = g.meshes[k].getWorldMatrix().m, x = w[12], y = w[13], z = w[14]; out.push([x * v[0] + y * v[4] + z * v[8] + v[12], x * v[1] + y * v[5] + z * v[9] + v[13], x * v[2] + y * v[6] + z * v[10] + v[14]]); } row.vm = out; }
    for (let i = 0; i < sols.length; i++) { const s = sols[i]; if (s.hidden || !s.agent) continue; const w = s.world.m, bs = [];
      for (const j of bi) { const f = s.bf[j].m, x = f[12], y = f[13], z = f[14]; bs.push([x * w[0] + y * w[4] + z * w[8] + w[12], x * w[1] + y * w[5] + z * w[9] + w[13], x * w[2] + y * w[6] + z * w[10] + w[14]]); }
      row.s.push({ n: s.agent.name, a: +s.agent.alive, cA: s.clipA, cB: s.clipB, bl: +s.blend.toFixed(3), b: bs }); }
    P.f.push(row);
  });
});
const mark = n => p.evaluate(n => __probe.mark(n), n);
const wait = ms => p.waitForTimeout(ms);
const turn = (x, y) => p.evaluate(([x, y]) => document.dispatchEvent(new MouseEvent('mousemove', { movementX: x, movementY: y })), [x, y]);
await p.evaluate(() => { __ol.startMatch({ side: 'atk', skipBuy: true }); __ol.G.paused = false; __ol.input.locked = true; });
await p.waitForFunction(() => __ol.G.phase === 'live'); await p.evaluate(() => { __ol.giveWeapon('ar5'); __ol.G.me.money = 16000; });
await wait(1500); await p.evaluate(() => { __probe.on = true; __probe.t0 = performance.now(); __probe.vt = performance.now(); });
const vOff = 0; mkdirSync(D + '/fr', { recursive: true }); const cdp = await ctx.newCDPSession(p), frames = []; const pt0 = await p.evaluate(() => performance.timeOrigin + __probe.t0);
cdp.on('Page.screencastFrame', async f => { const t = f.metadata.timestamp * 1000 - pt0, n = frames.length; frames.push(t); writeFileSync(`${D}/fr/${String(n).padStart(5, '0')}.jpg`, Buffer.from(f.data, 'base64')); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 960, maxHeight: 540, everyNthFrame: 1 });
await mark('idle'); await wait(1000);
await mark('walk'); await p.keyboard.down('KeyW'); await wait(1500); await mark('stop'); await p.keyboard.up('KeyW'); await wait(1000);
await mark('jump'); await p.keyboard.press('Space'); await wait(1300);
await mark('fire'); await p.mouse.move(640, 360); await p.mouse.down(); await wait(800); await p.mouse.up(); await mark('fire_end'); await wait(1000);
await mark('reload'); await p.keyboard.press('KeyR'); await wait(3200);
await mark('sw2'); await p.keyboard.press('Digit2'); await wait(1000); await mark('sw1'); await p.keyboard.press('Digit1'); await wait(1000);
await mark('sw3'); await p.keyboard.press('Digit3'); await wait(1000); await mark('sw1b'); await p.keyboard.press('Digit1'); await wait(1000);
await mark('quickswap'); await p.keyboard.press('KeyQ'); await wait(150); await p.keyboard.press('KeyQ'); await wait(1200);
await mark('inspect'); await p.keyboard.press('KeyF'); await wait(4200);
await mark('crouch'); await p.keyboard.down('ControlLeft'); await wait(1000); await p.keyboard.up('ControlLeft'); await mark('uncrouch'); await wait(1000);
await mark('turn'); for (let i = 0; i < 30; i++) { await turn(20, 0); await wait(16); } await mark('turn_end'); await wait(800);
await mark('runfire'); await p.keyboard.down('KeyW'); await wait(500); await p.mouse.down(); await wait(500); await p.mouse.up(); await p.keyboard.up('KeyW'); await wait(1000);
await mark('pistolfire'); await p.keyboard.press('Digit2'); await wait(800); for (let i = 0; i < 4; i++) { await p.mouse.down(); await wait(60); await p.mouse.up(); await wait(200); } await wait(800);
await mark('bots'); await p.keyboard.press('Digit1'); await wait(25000);
await mark('die'); await p.evaluate(() => { const d = __ol.LAYOUT.spawns.def[0]; __ol.G.me.hp = 1; __ol.teleport(d.x, d.y, d.z - 6, 0, 0); });
await p.waitForFunction(() => !__ol.G.me.alive, null, { timeout: 30000 }).catch(() => {}); await mark('dead'); await wait(4000);
await mark('specnext'); await p.mouse.down(); await wait(50); await p.mouse.up(); await wait(2500);
await mark('spec3p'); await p.keyboard.press('Space'); await wait(2500); await p.keyboard.press('Space'); await mark('spec1p'); await wait(2000);
const data = await p.evaluate(() => { __probe.on = false; return { f: __probe.f, marks: __probe.marks, bn: __probe.bnames }; });
data.vOff = vOff; data.frames = frames; await cdp.send('Page.stopScreencast').catch(() => {}); writeFileSync(`${D}/probe.json`, JSON.stringify(data));
console.log('frames', data.f.length, 'marks', data.marks.length, 'bones', data.bn.join(' '), 'vOff', vOff, 'errs', errs.slice(0, 5));
await p.close(); await ctx.close(); await b.close(); await srv.close();
