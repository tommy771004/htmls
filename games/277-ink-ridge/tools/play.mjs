// 即時試玩探測（真實按鍵、真實時間）：找腳本路線測不到的問題。node tools/play.mjs
import { open, raf } from './lib.mjs';
const { browser, page, log } = await open('../../web/277-ink-ridge.html', { w: 1440, h: 900 });
const st = () => page.evaluate(() => window.__ink.state());
const tp = (x, y, z, yaw = Math.PI, cy = 0) => page.evaluate(([x, y, z, yaw, cy]) => { window.__ink.teleport(x, y, z, yaw); window.__ink.setCamYaw(cy); }, [x, y, z, yaw, cy]);
const hold = async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await page.waitForTimeout(ms); for (const k of keys) await page.keyboard.up(k); };
const tap = async (k) => { await page.keyboard.down(k); await page.waitForTimeout(60); await page.keyboard.up(k); };
const f = (a) => a.map((v) => v.toFixed(2)).join(',');
const shot = async (n) => { await raf(page); await page.screenshot({ path: `dist/play-${n}.png` }); };
await page.click('#startBtn');
await page.waitForTimeout(300);

// 1 真實時間：在岩壁下助跑跳抓 A
await tp(1, 4, -40.0);
await page.waitForTimeout(200);
await page.keyboard.down('KeyW'); await page.waitForTimeout(380); await tap('Space'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
let s = await st(); console.log('1 grab A realtime:', s.mode, s.ledge, f(s.pos));
// 2 按住 D 橫移、W 上攀、D+Space 側跳、W×2 翻上
if (s.mode === 'hang') {
  await hold(['KeyD'], 1500); s = await st(); console.log('2a shimmy D 1.5s x=', s.pos[0].toFixed(2), s.mode);
  await tap('KeyW'); await page.waitForTimeout(500); s = await st(); console.log('2b W ->', s.ledge, s.mode);
  await hold(['KeyD'], 2000); s = await st(); console.log('2c shimmy B x=', s.pos[0].toFixed(2));
  await page.keyboard.down('KeyD'); await tap('Space'); await page.waitForTimeout(600); await page.keyboard.up('KeyD'); s = await st(); console.log('2d side jump ->', s.ledge, s.mode, f(s.pos));
  await shot('side');
  await tap('KeyW'); await page.waitForTimeout(500); s = await st(); console.log('2e W ->', s.ledge, s.mode);
  await tap('KeyW'); await page.waitForTimeout(1000); s = await st(); console.log('2f W ->', s.mode, f(s.pos), 'cam', f(s.cam));
  await shot('topped');
}
// 3 靠岩縫 A 左端繼續按 A：不該掉、不該穿牆
await tp(-1, 4, -41.4); await page.keyboard.down('KeyW'); await page.waitForTimeout(150); await tap('Space'); await page.waitForTimeout(400); await page.keyboard.up('KeyW');
await hold(['KeyA'], 2500); s = await st(); console.log('3 shimmy to A left end:', s.mode, f(s.pos));
// 4 從岩縫往後躍、空中按 W 回抓
await page.keyboard.down('KeyS'); await tap('Space'); await page.keyboard.up('KeyS'); await page.waitForTimeout(700); s = await st(); console.log('4 leap back ->', s.mode, f(s.pos));
// 5 站在吊台下方，吊台下降時會怎樣
await page.evaluate(() => { const I = window.__ink; I.manual(true); });
await page.evaluate(() => { const I = window.__ink; I.teleport(0.5, 11, -82.2, Math.PI); I.input({ strike: true }); I.step(40); I.input({}); });
await page.evaluate(() => { const I = window.__ink; for (let i = 0; i < 900 && I.state().lift.state !== 'top'; i++) I.step(1); });
await page.evaluate(() => { const I = window.__ink; I.teleport(-4, 11, -88.7, Math.PI); });
s = await page.evaluate(() => { const I = window.__ink; let m = []; for (let i = 0; i < 900; i++) { const s = I.step(1); if (i % 60 === 0) m.push(s.lift.state + ':' + s.lift.y.toFixed(1) + '/' + s.pos[1].toFixed(2) + '/' + s.mode); if (s.lift.state === 'down') break; } return { m, s: I.state() }; });
console.log('5 lift descends onto player:', s.m.join(' '), '→', s.s.mode, f(s.s.pos));
await shot('under-lift');
// 6 配重石落下的位置
await page.evaluate(() => { const I = window.__ink; I.teleport(0.5, 11, -82.2, Math.PI); I.input({ strike: true }); I.step(40); I.input({}); I.teleport(-4, 11, -85.7, Math.PI); });
s = await page.evaluate(() => { const I = window.__ink; for (let i = 0; i < 700; i++) { I.step(1); if (I.state().lift.state === 'top') break; } return I.state(); });
console.log('6 counterweight lands on player:', s.mode, f(s.pos));
// 7 在上升中的吊台上跳
await page.evaluate(() => { window.__ink.reset(); });
s = await page.evaluate(() => { const I = window.__ink; I.teleport(0.5, 11, -82.2, Math.PI); I.input({ strike: true }); I.step(30); I.input({}); I.teleport(-4, 11.3, -88.7, Math.PI); for (let i = 0; i < 300 && I.state().lift.state !== 'up'; i++) I.step(1); I.step(60); const y0 = I.state().pos[1]; I.input({ jump: true, jumpHeld: true }); I.step(1); I.input({ jumpHeld: true }); let mx = 0; for (let i = 0; i < 90; i++) { const s = I.step(1); mx = Math.max(mx, s.pos[1]); if (s.mode === 'ground' && i > 5) break; } return { y0, mx, s: I.state() }; });
console.log('7 jump on rising lift: y0', s.y0.toFixed(2), 'peak', s.mx.toFixed(2), '→', s.s.mode, f(s.s.pos), s.s.lift.state);
// 8 跳過鐘庭右側矮牆 → 墜落 → 重生
s = await page.evaluate(() => { const I = window.__ink; I.teleport(10.5, 11, -80, Math.PI / 2); for (let i = 0; i < 300; i++) { I.input({ mx: 1, jump: i % 20 === 0, jumpHeld: true }); const s = I.step(1); if (s.mode === 'dead') break; } I.input({}); I.step(80); return I.state(); });
console.log('8 over low wall → respawn:', s.mode, f(s.pos), 'falls', s.falls, 'cp', s.checkpoint);
// 9 鏡頭：掛在 C（W2 角落）與崖頂邊時鏡頭位置
s = await page.evaluate(() => { const I = window.__ink; I.teleport(8.8, 4, -41.5); I.setCamYaw(0); I.input({ my: 1 }); I.step(6); I.input({ my: 1, jump: true, jumpHeld: true }); for (let i = 0; i < 50 && I.state().mode !== 'hang'; i++) I.step(1); I.input({}); I.step(120); return I.state(); });
console.log('9 hang near W2 corner:', s.mode, s.ledge, 'cam', f(s.cam));
// 10 滑鼠拖曳轉鏡頭（沒有鎖定指標）
await page.evaluate(() => window.__ink.manual(false));
await tp(0, 0, 3.5);
await page.waitForTimeout(300);
const c0 = (await st()).cam;
await page.mouse.move(700, 450); await page.mouse.down(); await page.mouse.move(900, 450, { steps: 10 }); await page.mouse.up();
await page.waitForTimeout(300);
const c1 = (await st()).cam;
console.log('10 drag camera moved:', f(c0), '→', f(c1));
// 11 實時跑過 6 段的平均幀時間
console.log('frameMs', (await st()).frameMs.toFixed(1), 'errors', log.errors.length, log.pageerrors.length, log.warns.slice(0, 3));
await browser.close();
