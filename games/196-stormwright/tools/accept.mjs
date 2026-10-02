// 驗收：node tools/accept.mjs <html> [--out dir]
// 兩種尺寸（1440×900、390×844）：選單 → 飛艇 → 落地 → 戰鬥 → 建造（牆／地板／斜坡、走上斜坡）→ 消耗品 → 風暴 → 大地圖。
// 檢查：無 uncaught exception、無 console.error、除 Google Fonts 外無外部請求、有 viewport meta、390 寬無水平溢出。
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { open } from './lib.mjs';

const a = process.argv.slice(2);
const html = a.find((x) => !x.startsWith('--') && a[a.indexOf(x) - 1] !== '--out');
const oi = a.indexOf('--out');
const outDir = resolve(oi >= 0 ? a[oi + 1] : 'dist/shots');
if (!html) { console.error('usage: node tools/accept.mjs <html> [--out dir]'); process.exit(2); }
mkdirSync(outDir, { recursive: true });

const results = [];
let failed = 0;
async function run(name, w, h, touch) {
  const { browser, page, log } = await open(html, { w, h, touch });
  const checks = [];
  const check = (n, ok, d) => { checks.push({ n, ok: !!ok, d }); if (!ok) failed++; };
  const shot = (s) => page.screenshot({ path: resolve(outDir, `${name}-${s}.png`) });
  const sw = (fn, arg) => page.evaluate(fn, arg);
  const wait = (ms) => page.waitForTimeout(ms);
  check('viewport meta', await sw(() => !!document.querySelector('meta[name=viewport]')));
  await wait(1200); await shot('1-menu');
  await sw(() => window.__sw.start()); await wait(2500); await shot('2-bus');
  await sw(() => window.__sw.skipToGround()); await wait(800);
  await sw(() => { const s = window.__sw; s.give('ar', 3); s.give('pump', 2); s.give('bandage'); s.give('minishield'); s.giveMats(); s.giveAmmo(); s.give('ar', 3); });
  // 戰鬥：Bot 放在前方，鎖定準心後開火
  const botId = await sw(() => window.__sw.spawnBotNear(14));
  await sw((id) => { const s = window.__sw; s.freezeBots(true); s.aimAt(id); s.press({ fire: true }); }, botId);
  await wait(500); await shot('3-combat');
  await sw(() => window.__sw.fastForward(4));
  const dead = await sw((id) => !window.__sw.ctx.actors[id].alive, botId);
  check('擊殺 bot', dead);
  await sw(() => { window.__sw.press(null); window.__sw.aimAt(null); });
  // 建造：牆、地板、斜坡
  await sw(() => { const s = window.__sw; s.teleport(10, 33); s.look(0, 0); s.give('ar', 2); });
  await wait(300);
  const piece = async (p, ms = 300) => { await sw((x) => window.__sw.press({ piece: x, fire: true }), p); await wait(ms); await sw(() => window.__sw.press(null)); await wait(120); };
  await piece('wall'); await piece('floor'); await piece('ramp');
  await sw(() => window.__sw.fastForward(1));
  const pieces = await sw(() => window.__sw.state().pieces);
  check('放置建材（牆/地板/斜坡）', pieces >= 3, pieces);
  await sw(() => window.__sw.press({ piece: 'wall' })); await wait(250); await shot('4-build'); await sw(() => window.__sw.press(null));
  // 走上斜坡（換到乾淨的格子，斜坡上坡方向 = 面向）
  await sw(() => { const s = window.__sw; s.teleport(26, 33); s.look(0, 0); });
  await wait(200); await piece('ramp', 250);
  const y0 = await sw(() => window.__sw.state().pos[1]);
  const y1 = await sw(() => { const s = window.__sw; s.look(0, 0); s.press({ moveZ: 1 }); let m = 0; for (let i = 0; i < 12; i++) { s.fastForward(0.1); m = Math.max(m, s.state().pos[1]); } s.press(null); return m; });
  check('走上斜坡', y1 - y0 > 3, `${y0.toFixed(2)} → 最高 ${y1.toFixed(2)}`);
  await wait(300); await shot('5-ramp');
  // 消耗品
  await sw(() => { const s = window.__sw, c = s.ctx; c.player.health = 40; c.player.shield = 0; s.give('bandage'); s.press({ fire: true }); s.fastForward(4.2); s.press(null); });
  check('繃帶回血', (await sw(() => window.__sw.ctx.player.health)) > 50);
  // 風暴：跳階段、縮圈，玩家移到圈外看暈影與扣血
  await sw(() => { const s = window.__sw; s.storm.skip(); s.storm.skip(); s.fastForward(60); });
  const st = await sw(() => window.__sw.state());
  check('風暴縮圈', st.radius < 600, st.radius.toFixed(0));
  const hp0 = await sw(() => { const s = window.__sw, c = s.ctx, p = c.player, S = c.storm; s.teleport(S.center.x + S.radius + 25, S.center.y); p.health = 100; return p.health; });
  await sw(() => window.__sw.fastForward(3)); await wait(400); await shot('6-storm');
  check('風暴圈外扣血', (await sw(() => window.__sw.ctx.player.health)) < hp0);
  await sw(() => { const s = window.__sw; s.teleport(8, 30); s.ctx.player.health = 100; });
  await page.keyboard.press('KeyM'); await wait(500); await shot('7-map'); await page.keyboard.press('KeyM'); await wait(200);
  const stats = await sw(() => window.__sw.stats());
  // 勝利 / 淘汰畫面
  await sw(() => { const s = window.__sw; s.killBots(40); });
  await sw(() => window.__sw.fastForward(1)); await wait(2800); await shot('8-win');
  check('勝利狀態', (await sw(() => window.__sw.state().state)) === 'ended');
  await sw(() => window.__sw.start()); await sw(() => window.__sw.skipToGround()); await sw(() => { window.__sw.ctx.player.takeDamage(999, { ignoreShield: true }); window.__sw.fastForward(2); }); await wait(1500); await shot('9-lose');
  check('淘汰狀態', (await sw(() => window.__sw.state().state)) === 'ended' && !(await sw(() => window.__sw.state().playerAlive)));
  check('無 uncaught exception', log.pageerrors.length === 0, log.pageerrors.slice(0, 3));
  check('無 console.error', log.errors.length === 0, log.errors.slice(0, 3));
  check('無外部請求（Google Fonts 除外）', log.external.length === 0, log.external.slice(0, 3));
  if (w <= 430) { const sw2 = await sw(() => [document.documentElement.scrollWidth, innerWidth]); check('無水平溢出', sw2[0] <= w, sw2.join('/')); }
  results.push({ viewport: `${w}x${h}`, gpu: log.gpu, ok: checks.every((c) => c.ok), checks, stats });
  await browser.close();
}
await run('desktop', 1440, 900, false);
await run('mobile', 390, 844, true);
console.log(JSON.stringify({ ok: failed === 0, failed, results }, null, 1));
process.exit(failed ? 1 : 0);
