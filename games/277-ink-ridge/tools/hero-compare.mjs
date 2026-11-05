// 新舊主角比較：node tools/hero-compare.mjs <html> <前綴>，輸出 dist/<前綴>-{idle,run,jump,hang,strike,back}.png（裁到角色附近）
import { open, raf } from './lib.mjs';
const [html, tag] = process.argv.slice(2);
const { browser, page, log } = await open(html, { w: 1000, h: 800 });
await page.click('#startBtn'); await page.waitForTimeout(300);
await page.evaluate(() => { const I = window.__ink; I.manual(true); I.setFov(30); });
const shot = async (n) => { await raf(page); await page.screenshot({ path: `dist/${tag}-${n}.png` }); };
const run = (fn, ...a) => page.evaluate(fn, ...a);
await run(() => { const I = window.__ink; I.teleport(0, 0, 3.5, 0); I.setCamYaw(0); I.input({}); I.step(90); });
await shot('idle');
await run(() => { const I = window.__ink; I.setCamYaw(0.9); I.step(4); });
await shot('idle2');
await run(() => { const I = window.__ink; I.teleport(0, 0, 5.5); I.setCamYaw(0); I.input({ my: 1 }); I.step(24); I.setCamYaw(Math.PI * 0.6); I.step(3); });
await shot('run');
await run(() => { const I = window.__ink; I.input({ my: 1, jump: true, jumpHeld: true }); I.step(14); });
await shot('jump');
await run(() => { const I = window.__ink; I.input({}); I.step(40); I.teleport(1, 4, -41.2); I.setCamYaw(0); I.step(1); I.input({ my: 1 }); for (let i = 0; i < 12; i++) I.step(1); I.input({ my: 1, jump: true, jumpHeld: true }); for (let i = 0; i < 80; i++) if (I.step(1).mode === 'hang') break; I.input({}); for (let i = 0; i < 30; i++) I.step(1); I.setCamYaw(1.5); I.setFov(13); I.step(4); return { ...I.state(), dbg: I.heroDbg() }; }).then((s) => console.log('hang?', s.mode, s.ledge, JSON.stringify(s.dbg), s.pos.map((v) => +v.toFixed(2))));
await shot('hang');
await run(() => { const I = window.__ink; I.setCamYaw(0.05); I.setFov(30); I.step(3); }); await shot('hang2');
await run(() => { const I = window.__ink; I.setCamYaw(0.5); I.input({ mx: 1 }); for (let i = 0; i < 14; i++) I.step(1); I.input({}); }); await shot('shimmy');
await run(() => { const I = window.__ink; I.input({ mx: 1 }); for (let i = 0; i < 30; i++) I.step(1); I.input({}); for (let i = 0; i < 8; i++) I.step(1); I.input({ my: 1 }); for (let i = 0; i < 9; i++) I.step(1); }); await shot('hop');
await run(() => { const I = window.__ink; I.input({}); }); 
await run(() => { const I = window.__ink; I.teleport(9, 4, -41); I.setCamYaw(0); I.input({}); I.step(5); });

await run(() => { const I = window.__ink; I.input({}); I.teleport(0, 0, 3, Math.PI); I.setCamYaw(1.1); I.step(30); I.input({ strike: true }); I.step(14); I.input({}); });
await shot('strike');
console.log(await run(() => { const s = window.__ink.state(); return { draws: s.draws, tris: s.tris, cloth: s.clothOK }; }), log.pageerrors.slice(0, 3), log.errors.slice(0, 3), log.warns.slice(0, 3));
await browser.close();
