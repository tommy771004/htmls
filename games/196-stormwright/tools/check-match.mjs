// 軌道 match 自檢：node tools/check-match.mjs <html> [--out dir] [--only desktop|mobile]
// 驅動 __sw 走過：選單、飛艇、跳傘／滑翔、風暴牆（外／內）、各種 HUD 狀態、地圖、暫停、觀戰、勝利、淘汰，並截圖。
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { open } from './lib.mjs';

const a = process.argv.slice(2);
const html = a.find((x, i) => !x.startsWith('--') && a[i - 1] !== '--out' && a[i - 1] !== '--only');
const oi = a.indexOf('--out'), only = a[a.indexOf('--only') + 1];
const outDir = resolve(oi >= 0 ? a[oi + 1] : 'dist/match/check');
if (!html) { console.error('usage: node tools/check-match.mjs <html> [--out dir]'); process.exit(2); }
mkdirSync(outDir, { recursive: true });
let failed = 0; const report = [];

async function run(name, w, h, touch) {
  const { browser, page, log } = await open(html, { w, h, touch });
  const checks = [];
  const check = (n, ok, d) => { checks.push({ n, ok: !!ok, d }); if (!ok) failed++; };
  const shot = (s) => page.screenshot({ path: resolve(outDir, `${name}-${s}.png`) });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const wait = (ms) => page.waitForTimeout(ms);
  const sw = (code) => ev(`(() => { const s = window.__sw, c = s.ctx, p = c.player; ${code} })()`);

  await wait(1500); await shot('01-menu');
  check('選單狀態', (await sw('return c.match.state')) === 'menu');
  await page.evaluate(() => document.getElementById('btnHelp').click()); await wait(300); await shot('01b-menu-help');
  await page.evaluate(() => { document.getElementById('btnHelp').click(); document.getElementById('btnSettings').click(); }); await wait(300); await shot('01c-menu-settings');
  await page.evaluate(() => document.getElementById('btnBack').click());
  await sw('s.start();'); await wait(1800); await shot('02-bus-countdown');
  check('飛艇倒數顯示', await sw("return !document.getElementById('busmsg').hidden && /艙門/.test(document.getElementById('busmsg').textContent)"));
  await sw('c.match.busT = 6;'); await wait(900); await shot('03-bus-open');
  check('跳傘提示', await sw("return /跳/.test(document.getElementById('busmsg').textContent)"));
  // 從飛艇跳下 → 自由落體 → 滑翔
  await sw('s.press({ jump: true });'); await wait(200); await sw('s.press(null);');
  await wait(900); await shot('04-skydive');
  check('跳下後自由落體', ['skydive', 'glide'].includes(await sw('return p.state')));
  await sw('p.pos.set(p.pos.x, Math.max(c.terrain.heightAt(p.pos.x, p.pos.z), 0) + 80, p.pos.z); p.state = "skydive"; s.press({ jump: true });'); await wait(250); await sw('s.press(null);'); await wait(900); await shot('05-glide');
  check('滑翔狀態', (await sw('return p.state')) === 'glide');
  // 落地、對戰開始
  await sw('s.skipToGround(8, 30); s.freezeBots(true); s.giveMats(); s.giveAmmo(); s.give("bandage"); s.give("minishield"); s.give("pistol", 1); s.give("smg", 2); s.give("pump", 3); s.give("ar", 4);'); await wait(1000);
  check('對戰開始', (await sw('return c.match.state')) === 'playing');
  check('風暴計時啟動', await sw('return c.storm.active'));
  await shot('06-hud-ground');
  // 撿取提示卡
  await sw('s.dropItem("sniper", 4, 1.2);'); await wait(500); await shot('07-pickup-card');
  check('撿取提示卡', await sw("return !document.getElementById('prompt').hidden"));
  // 寶箱進度
  await sw('s.spectate; s.teleport(-60, 30); s.spawnChest(1.4);'); await wait(300);
  await sw('s.press({ interact: true });'); await wait(650); await shot('08-chest-progress');
  check('寶箱進度環', await sw("return !document.getElementById('prompt').hidden && document.getElementById('prompt').classList.contains('chest')"));
  await sw('s.press(null);'); await wait(300);
  // 消耗品進度
  await sw('s.teleport(8, 30); p.health = 40; p.shield = 10; s.give("bandage"); s.press({ fire: true });'); await wait(900); await shot('09-consume-progress');
  check('消耗品進度條', await sw("return !document.getElementById('act').hidden"));
  await sw('s.press(null); p.health = 100; p.shield = 60;'); await wait(300);
  // 建造模式
  await sw('s.give("ar", 2); s.press({ piece: "wall" });'); await wait(350); await sw('s.press(null);'); await wait(300); await shot('10-build-mode');
  check('建造列顯示', await sw("return !document.getElementById('buildbar').hidden"));
  await sw('s.press({ buildToggle: true });'); await wait(200); await sw('s.press(null);'); await wait(200);
  // 狙擊鏡
  await sw('s.give("sniper", 3); s.look(0, 0);'); await wait(300); await sw('s.press({ ads: true });'); await wait(900); await shot('11-sniper-scope');
  check('狙擊鏡顯示', await sw("return document.getElementById('scope').classList.contains('on')"));
  await sw('s.press(null);'); await wait(300);
  // 步槍準心、命中、傷害數字、淘汰彈窗
  await sw('s.give("ar", 3); s.look(0, 0);'); await wait(250);
  const bid = await sw('return s.spawnBotNear(11);');
  await sw('s.aimAt(arguments[0]);'.replace('arguments[0]', bid) + ' s.press({ fire: true });'); await wait(450); await shot('12-damage-numbers');
  check('傷害數字', await sw("return document.querySelectorAll('#dmg span').length > 0"));
  await sw('s.fastForward(3);'); await wait(350); await shot('13-kill-popup');
  check('淘汰彈窗', await sw("return document.getElementById('killpop').classList.contains('on')"));
  check('擊殺訊息', await sw("return document.querySelectorAll('#killfeed .kf').length > 0"));
  await sw('s.press(null); s.aimAt(null);'); await wait(200);
  // 受擊方向 + 低血
  await sw('const b = c.actors.find((x) => !x.isPlayer && x.alive); p.takeDamage(40, { source: b, ignoreShield: true }); b.pos.set(p.pos.x + 12, p.pos.y, p.pos.z + 3); p.takeDamage(20, { source: b, ignoreShield: true }); p.health = 24;'); await wait(160); await shot('14-hurt-lowhp');
  check('受擊方向弧', await sw("return document.querySelectorAll('#hitdir .hd').length > 0"));
  await sw('p.health = 100; p.shield = 100;'); await wait(200);
  // 風暴：外觀、內部
  await sw('s.storm.setPhase(2); s.storm.skip(); s.fastForward(1);'); await wait(300);
  await sw('const S = c.storm, ang = Math.atan2(S.center.y, S.center.x), R = S.radius, cx = S.center.x, cz = S.center.y; const x = cx + Math.cos(ang) * (R + 60), z = cz + Math.sin(ang) * (R + 60); s.teleport(x, z); s.look(Math.atan2(-(cx - x), -(cz - z)), 0.1);'); await wait(1500); await shot('15-storm-wall-outside');
  const hp0 = await sw('return p.health');
  await sw('s.fastForward(2.1);'); await wait(300);
  check('風暴圈外扣血', (await sw('return p.health')) < hp0);
  await shot('16-storm-inside-hud');
  check('風暴內色調 stormTint > 0.5', (await sw('return c.render.stormTint || 0')) > 0.5);
  await sw('const S = c.storm, ang = 0.8, R = S.radius; const x = S.center.x + Math.cos(ang) * (R - 25), z = S.center.y + Math.sin(ang) * (R - 25); s.teleport(x, z); s.look(Math.atan2(-Math.cos(ang), -Math.sin(ang)) + Math.PI, 0.15); p.health = 100;'); await wait(1600); await shot('17-storm-wall-from-inside');
  check('安全區內無風暴色調', (await sw('return c.render.stormTint || 0')) < 0.25);
  await sw('s.teleport(8, 30); s.storm.skip(); s.fastForward(2);'); await wait(300);
  await shot('18-banner-shrink');
  // 地圖、暫停
  await page.keyboard.press('KeyM'); await wait(700); await shot('19-bigmap'); await page.keyboard.press('KeyM'); await wait(300);
  await page.keyboard.press('Escape'); await wait(500); await shot('20-pause');
  check('暫停面板', await sw("return !document.getElementById('pause').hidden"));
  await page.evaluate(() => { const r = document.getElementById('rngSens'); r.value = 1.6; r.dispatchEvent(new Event('input')); document.getElementById('tgInv').click(); document.querySelector('#segQ button[data-q="medium"]').click(); });
  const saved = await ev(() => JSON.parse(localStorage.getItem('stormwright.settings.v1') || '{}'));
  check('設定寫入 localStorage', saved.sens === 1.6 && saved.invertY === true && saved.quality === 'medium', JSON.stringify(saved));
  await page.evaluate(() => { document.getElementById('tgInv').click(); document.querySelector('#segQ button[data-q="high"]').click(); });
  await page.evaluate(() => document.getElementById('btnResume').click()); await wait(300);
  // 觀戰
  await sw('p.takeDamage(999, { ignoreShield: true, source: c.actors[3] }); s.fastForward(2.5);'); await wait(1800);
  check('淘汰後自動觀戰', await sw("return !document.getElementById('spectate').hidden && !document.getElementById('specBtns').hidden"));
  await shot('21-defeat-spectate');
  await page.evaluate(() => document.getElementById('btnReport').click()); await wait(1300); await shot('22-defeat-report');
  check('結算畫面', await sw("return !document.getElementById('end').hidden && /#/.test(document.getElementById('endTitle').textContent)"));
  await page.evaluate(() => document.getElementById('btnSpec').click()); await wait(800);
  check('觀戰列', await sw("return !document.getElementById('spectate').hidden"));
  check('觀戰目標', await sw('return !!c.cam.spectate && c.cam.spectate.alive'));
  // 勝利
  await sw('s.start(); s.skipToGround(8, 30); s.freezeBots(true); s.killBots(40); s.fastForward(1);'); await wait(2800); await shot('23-victory');
  check('勝利狀態', (await sw('return c.match.state')) === 'ended' && (await sw('return p.alive')));
  check('勝利畫面', await sw("return !document.getElementById('end').hidden && /風暴之冠/.test(document.getElementById('endTitle').textContent)"));
  // 重來：重設完整
  await page.evaluate(() => document.getElementById('btnAgain').click()); await wait(700);
  const st = await sw('return { st: c.match.state, alive: c.match.alive(), kills: p.kills, storm: c.storm.active, ended: !document.getElementById("end").hidden }');
  check('再來一局重設', st.st === 'bus' && st.alive === 30 && st.kills === 0 && !st.storm && !st.ended, JSON.stringify(st));
  await shot('24-restart-bus');
  const stats = await sw('return s.stats();');
  check('無 uncaught exception', log.pageerrors.length === 0, log.pageerrors.slice(0, 3));
  check('無 console.error', log.errors.length === 0, log.errors.slice(0, 3));
  check('無外部請求（Google Fonts 除外）', log.external.length === 0, log.external.slice(0, 3));
  if (w <= 430) { const o = await ev(() => [document.documentElement.scrollWidth, innerWidth]); check('無水平溢出', o[0] <= w, o.join('/')); }
  report.push({ viewport: `${w}x${h}`, gpu: log.gpu, ok: checks.every((c) => c.ok), failedChecks: checks.filter((c) => !c.ok), stats });
  await browser.close();
}
if (only === 'land') await run('land', 844, 390, true);
else {
  if (only !== 'mobile') await run('desktop', 1440, 900, false);
  if (only !== 'desktop') await run('mobile', 390, 844, true);
}
console.log(JSON.stringify({ ok: failed === 0, failed, report }, null, 1));
process.exit(failed ? 1 : 0);
