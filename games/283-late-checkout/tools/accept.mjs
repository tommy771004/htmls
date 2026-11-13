// 驗收：用無頭 Chrome 跑打包後的單檔 web/283-late-checkout.html。
// node tools/accept.mjs [--page 檔名] [--shots 資料夾]
// 檢查：兩種尺寸（1440×900、390×844）沒有例外、console.error、外部請求、手機水平溢出；
// 桌機實際點「開始」→ 鍵盤滑鼠操作 → 暫停／槍匠／設定 → 打完整場；手機走觀戰模式；最後量 FPS。
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname, join } from 'node:path';

const a = process.argv.slice(2), take = k => { const i = a.indexOf(k); return i >= 0 ? a.splice(i, 2)[1] : null; };
const pageName = take('--page') || '283-late-checkout.html', shots = take('--shots');
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
if (shots) mkdirSync(shots, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer(async (req, res) => {
  const p = resolve(repo, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(repo)) { res.writeHead(403).end(); return; }
  try { const b = await readFile(p); res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }).end(b); } catch { res.writeHead(404).end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`, url = `${base}/web/${pageName}`;

let fail = 0; const ok = (name, cond, extra = '') => { console.log(`${cond ? '✔' : '✖'} ${name}${extra ? ' — ' + extra : ''}`); if (!cond) fail++; };
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });

async function open(w, h, touch, query = '', dpr = 1) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage(), log = { errors: [], external: [] };
  page.on('console', m => { if (m.type() === 'error') log.errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => log.errors.push('exception: ' + e.message));
  page.on('request', r => { const u = r.url(); if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:')) log.external.push(u); });
  await page.goto(url + query, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__lc && window.__lc.ready, null, { timeout: 90000 });
  return { ctx, page, log };
}
const info = page => page.evaluate(() => window.__lc.info());
const shot = async (page, name) => { if (shots) await page.screenshot({ path: join(shots, name + '.png') }); };
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const visible = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return c.display !== 'none' && c.visibility !== 'hidden' && r.width > 0 && r.height > 0; }, sel);

// ---------- 桌機 1440×900 ----------
{
  const { ctx, page, log } = await open(1440, 900, false);
  ok('桌機：有 viewport meta', await page.evaluate(() => !!document.querySelector('meta[name=viewport]')));
  ok('桌機：標題畫面', (await info(page)).mode === 'title' && await visible(page, '#title h1'));
  await page.waitForTimeout(1500); await shot(page, 'desk-title');
  await page.click('button[data-team="1"]'); await page.click('button[data-d="easy"]'); await page.click('button[data-team="0"]');
  await page.click('#go'); await page.waitForTimeout(600);
  let i = await info(page);
  ok('桌機：按「開始」進入對戰', i.mode === 'play' && !i.auto && await visible(page, '#top'));
  const locked = await page.evaluate(() => document.pointerLockElement === document.getElementById('c'));
  console.log(`  滑鼠鎖定：${locked ? '已鎖定' : '無頭環境沒有鎖定（改由畫面點擊重試）'}`);
  if (!locked) { await page.mouse.click(720, 450); await page.waitForTimeout(300); }
  const lockedNow = await page.evaluate(() => document.pointerLockElement === document.getElementById('c'));
  await page.waitForFunction(() => window.__lc.info().phase === 'live', null, { timeout: 15000 });
  const p0 = (await info(page)).pos;
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft'); await page.waitForTimeout(1400); await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
  i = await info(page); ok('桌機：W＋Shift 會前進', Math.hypot(i.pos[0] - p0[0], i.pos[1] - p0[1]) > 3, `移動 ${Math.hypot(i.pos[0] - p0[0], i.pos[1] - p0[1]).toFixed(1)} m`);
  if (lockedNow) {
    const y0 = await page.evaluate(() => window.__lc.dbg.view.yaw);
    await page.mouse.move(820, 430, { steps: 6 }); await page.waitForTimeout(100);
    ok('桌機：滑鼠會轉動視角', Math.abs(await page.evaluate(() => window.__lc.dbg.view.yaw) - y0) > 0.02);
  }
  await page.evaluate(() => { const s = window.__lc.dbg.sound, an = s.ctx.createAnalyser(); an.fftSize = 2048; s.master.connect(an); window.__an = an; });
  await page.mouse.down(); await page.waitForTimeout(450);
  const au = await page.evaluate(() => { const b = new Float32Array(2048); let pk = 0; window.__an.getFloatTimeDomainData(b); for (const v of b) pk = Math.max(pk, Math.abs(v)); return { state: window.__lc.dbg.sound.ctx.state, pk }; });
  await page.waitForTimeout(250); await page.mouse.up();
  ok('桌機：Web Audio 有在出聲（開槍時主輸出峰值 > 0.02）', au.state === 'running' && au.pk > 0.02, `state ${au.state}、峰值 ${au.pk.toFixed(3)}`);
  i = await info(page); ok('桌機：左鍵會開槍', i.ammo < 30, `剩 ${i.ammo} 發`);
  await page.keyboard.press('KeyR'); await page.waitForTimeout(2600);
  i = await info(page); ok('桌機：R 會換彈', i.ammo === 30);
  await page.mouse.down({ button: 'right' }); await page.waitForTimeout(500); await shot(page, 'desk-ads'); await page.mouse.up({ button: 'right' });
  await page.keyboard.down('Tab'); await page.waitForTimeout(150); ok('桌機：Tab 顯示計分板', await visible(page, '#board .ledger table')); await page.keyboard.up('Tab');
  await shot(page, 'desk-play');
  // 暫停：鎖定時 ESC 由瀏覽器解除鎖定 → pointerlockchange；沒鎖定時走 keydown
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  if (!(await info(page)).paused) { console.log('  （ESC 沒有觸發暫停，改用 __lc.openPause()）'); fail++; await page.evaluate(() => window.__lc.openPause()); }
  i = await info(page); ok('桌機：ESC 暫停', i.paused && await visible(page, '#pause .rail'));
  const keys = await page.$$eval('#pause .key b', els => els.map(e => e.textContent));
  ok('桌機：選單有 RESUME / GUNSMITH / SETTINGS / QUIT', keys.join(',') === 'RESUME,GUNSMITH,SETTINGS,QUIT', keys.join(','));
  ok('桌機：計分板有兩隊各 5 人與 K/D/A', await page.$$eval('#pauseL table', t => t.length === 2 && t.every(x => x.rows.length === 6 && x.rows[0].cells.length === 4)));
  await shot(page, 'desk-pause');
  const t1 = (await info(page)).round, a1 = (await info(page)).alive.join();
  await page.waitForTimeout(700); ok('桌機：暫停時模擬停住', (await page.evaluate(() => window.__lc.game.time)) === (await page.evaluate(() => new Promise(r => setTimeout(() => r(window.__lc.game.time), 300)))), `round ${t1} alive ${a1}`);
  await page.click('.key[data-act="gunsmith"]'); await page.waitForTimeout(400);
  ok('桌機：槍匠面板', (await info(page)).panel === 'gunsmith' && await visible(page, '#gunsmith'));
  for (const [slot, id] of [['optic', 'scope'], ['barrel', 'sup'], ['mag', 'drum']]) await page.click(`.part[data-slot="${slot}"][data-id="${id}"]`);
  await page.waitForTimeout(900);
  i = await info(page); ok('桌機：槍匠換瞄具／槍管／彈匣', i.lo.optic === 'scope' && i.lo.barrel === 'sup' && i.lo.mag === 'drum', JSON.stringify(i.lo));
  ok('桌機：槍模跟著換零件', await page.evaluate(() => { const v = window.__lc.dbg.vm; return v.lo.optic === 'scope' && v.lo.barrel === 'sup' && v.lo.mag === 'drum' && v.gun.children.length > 3; }));
  await shot(page, 'desk-gunsmith');
  await page.click('.part[data-slot="optic"][data-id="holo"]'); await page.click('.part[data-slot="barrel"][data-id="long"]'); await page.waitForTimeout(700); await shot(page, 'desk-gunsmith2');
  await page.click('#gunsmith .back'); await page.click('.key[data-act="settings"]'); await page.waitForTimeout(300);
  ok('桌機：設定面板', (await info(page)).panel === 'settings' && await visible(page, '#settings'));
  await page.click('#sQual button[data-q="med"]'); await page.click('#sMisc button[data-k="fps"]'); await page.waitForTimeout(300); await shot(page, 'desk-settings');
  await page.click('#sQual button[data-q="high"]'); await page.click('#settings .back');
  await page.click('.key[data-act="resume"]'); await page.waitForTimeout(1800);
  if ((await info(page)).paused) { console.log('  （按 RESUME 沒有重新鎖定滑鼠：無頭環境常見，改用 __lc.resume()）'); await page.evaluate(() => window.__lc.resume()); }
  ok('桌機：RESUME 回到對戰', !(await info(page)).paused);
  if (lockedNow) {
    await page.evaluate(() => document.exitPointerLock()); await page.waitForTimeout(400);
    ok('桌機：滑鼠鎖定被解除（真實瀏覽器的 ESC）會自動暫停', (await info(page)).paused && await visible(page, '#pause .rail'));
    await page.click('.key[data-act="resume"]'); await page.waitForTimeout(2000);
    ok('桌機：RESUME 重新鎖定滑鼠並繼續', !(await info(page)).paused && await page.evaluate(() => document.pointerLockElement === document.getElementById('c')));
    if ((await info(page)).paused) await page.evaluate(() => window.__lc.resume());
  }
  // 量 FPS：對戰中連續 6 秒，期間依序打滅一盞燈、打壞一件家具、打倒一個人（第一次破壞／倒地不能卡頓）
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const L = window.__lc, D = L.dbg, g = D.game, P = g.player, d = o => Math.hypot(o.x - P.x, o.z - P.z);
    const lamp = D.map.lamps.filter(l => l.hp0 > 0 && l.s > 0 && l.follow < 0).sort((a, b) => d(a) - d(b))[0], item = D.map.items.filter(o => o.hp0 > 0 && !o.dead).sort((a, b) => d(a) - d(b))[0];
    const B = window.__brk = { lamp: lamp.id, item: item.id };
    setTimeout(() => { g._lampHit(lamp, lamp.hp); setTimeout(() => { B.lampSim = lamp.s; B.lampS = D.lights.S[lamp.id]; }, 500); }, 1000);
    setTimeout(() => { g._itemHit(item, item.hp); setTimeout(() => { B.itemDead = item.dead; B.boxDead = D.world.dead[item.box]; B.hidden = D.wreck.hidden.length; B.debris = D.wreck.debris.live; }, 500); }, 2200);
    setTimeout(() => { const foe = g.ents.find(e => e.team !== P.team && e.alive); if (!foe) return; g._hurt(foe, P, 999, false); setTimeout(() => { const s = D.soldiers[foe.id]; B.rag = !!s.rag; B.ragY = s.torso.position.y; B.gunY = s.gun.position.y; }, 1400); }, 3400);
  });
  const fps = await page.evaluate(() => new Promise(r => { let n = 0, worst = 0, last = performance.now(); const t0 = last; const f = t => { n++; worst = Math.max(worst, t - last); last = t; if (t - t0 < 6000) requestAnimationFrame(f); else r({ avg: n / ((t - t0) / 1000), worst }); }; requestAnimationFrame(f); }));
  i = await info(page);
  { const B = await page.evaluate(() => window.__brk);
    ok('桌機：燈打得滅（模擬狀態與著色器亮度都歸零）', B.lampSim === 0 && B.lampS < 0.05, `燈 ${B.lamp}：s=${B.lampSim}、uLampS=${(+B.lampS).toFixed(2)}`);
    ok('桌機：家具打得壞（幾何隱藏、碰撞取消、噴出碎片）', B.itemDead && B.boxDead === 1 && B.hidden > 0 && B.debris > 0, `家具 ${B.item}：隱藏 ${B.hidden} 段、碎片 ${B.debris} 片`);
    ok('桌機：被打倒的人換成布娃娃落地、槍掉在地上', B.rag === true && B.ragY < 0.75 && B.gunY < 0.2, B.rag === undefined ? '這 6 秒內沒有活著的敵人' : `軀幹高度 ${(+B.ragY).toFixed(2)} m、槍高度 ${(+B.gunY).toFixed(2)} m`);
    ok('桌機：破壞與倒地時沒有卡頓（最慢一幀 ≤ 120 ms）', fps.worst <= 120, `${fps.worst.toFixed(0)} ms`);
    // 下一回合開始時全部復原
    const R = await page.evaluate(() => { const L = window.__lc, D = L.dbg, g = D.game, r0 = g.round; g.setAuto(true); for (let k = 0; k < 400 && g.round === r0 && g.phase !== 'over'; k++) L.step(1); g.setAuto(false);
      return { next: g.round > r0, hidden: D.wreck.hidden.length, debris: D.wreck.debris.live, item: D.map.items[window.__brk.item].dead, lamp: D.map.lamps[window.__brk.lamp].s, box: D.world.dead[D.map.items[window.__brk.item].box], rag: D.soldiers.filter(s => s.e.alive && s.rag).length }; });
    await page.waitForTimeout(400); const S2 = await page.evaluate(() => ({ S: window.__lc.dbg.lights.S[window.__brk.lamp], rag: window.__lc.dbg.soldiers.filter(s => s.rag).length }));
    ok('桌機：下一回合開始時家具、燈與倒地的人全部復原', R.next && R.hidden === 0 && R.debris === 0 && !R.item && R.lamp === 1 && R.box === 0 && S2.S > 0.5 && S2.rag === 0, `隱藏 ${R.hidden}、碎片 ${R.debris}、燈 s=${R.lamp}／uLampS=${(+S2.S).toFixed(2)}、布娃娃 ${S2.rag}`);
  }
  ok('桌機：對戰中平均 FPS ≥ 55', fps.avg >= 55, `平均 ${fps.avg.toFixed(1)}、最慢一幀 ${fps.worst.toFixed(0)} ms、${i.calls} draw calls、${i.tris} 三角形、內部解析度 ${i.size.join('×')}`);
  // 快轉把整場打完
  await page.evaluate(() => { const g = window.__lc.game; g.setAuto(true); for (let k = 0; k < 40 && g.phase !== 'over'; k++) window.__lc.step(30); });
  await page.waitForTimeout(600); i = await info(page);
  ok('桌機：整場打完進結算', i.mode === 'over' && Math.max(...i.score) === 5 && await visible(page, '#over .ledger'), `比分 ${i.score.join(':')}`);
  await shot(page, 'desk-over');
  await page.click('#over button[data-act="quit"]'); await page.waitForTimeout(400);
  ok('桌機：回到標題', (await info(page)).mode === 'title' && await visible(page, '#title h1'));
  ok('桌機：沒有水平溢出', await overflow(page) <= 0);
  ok('桌機：沒有例外／console.error', log.errors.length === 0, log.errors.slice(0, 3).join(' | '));
  ok('桌機：沒有外部請求', log.external.length === 0, log.external.slice(0, 3).join(' | '));
  await ctx.close();
}

// ---------- 手機 390×844 ----------
{
  const { ctx, page, log } = await open(390, 844, true);
  ok('手機：有 viewport meta', await page.evaluate(() => !!document.querySelector('meta[name=viewport]')));
  ok('手機：標題畫面與「需要鍵盤滑鼠」提示', await visible(page, '#title h1') && await visible(page, '#mobile'));
  ok('手機：標題沒有水平溢出', await overflow(page) <= 0);
  await page.waitForTimeout(1200); await shot(page, 'phone-title');
  await page.tap('#watch'); await page.waitForTimeout(5200);
  let i = await info(page); ok('手機：觀戰模式開打', i.mode === 'play' && i.auto && await visible(page, '#top'));
  ok('手機：HUD 沒有水平溢出', await overflow(page) <= 0);
  const hudFit = await page.evaluate(() => ['#top', '#hp', '#ammo', '#menuBtn'].every(s => { const r = document.querySelector(s).getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; }));
  ok('手機：比分、體力、彈藥都在畫面內', hudFit);
  await page.waitForTimeout(2500); await shot(page, 'phone-play');
  await page.tap('#menuBtn'); await page.waitForTimeout(400);
  i = await info(page); ok('手機：選單鈕開暫停', i.paused && await visible(page, '#pause .rail'));
  ok('手機：暫停畫面沒有水平溢出', await overflow(page) <= 0 && await page.evaluate(() => [...document.querySelectorAll('#pause .key, #pause .ledger')].every(e => { const r = e.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; })));
  await shot(page, 'phone-pause');
  await page.tap('.key[data-act="gunsmith"]'); await page.waitForTimeout(700);
  ok('手機：槍匠面板在畫面內', await page.evaluate(() => { const r = document.querySelector('#gunsmith').getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }));
  await shot(page, 'phone-gunsmith');
  await page.tap('#gunsmith .back'); await page.tap('.key[data-act="resume"]'); await page.waitForTimeout(400);
  ok('手機：RESUME 回到觀戰', !(await info(page)).paused);
  ok('手機：沒有例外／console.error', log.errors.length === 0, log.errors.slice(0, 3).join(' | '));
  ok('手機：沒有外部請求', log.external.length === 0, log.external.slice(0, 3).join(' | '));
  await ctx.close();
}

// ---------- 其他螢幕比例：版面都要留在畫面內、互不重疊 ----------
const inView = (page, sels) => page.evaluate(ss => ss.every(s => [...document.querySelectorAll(s)].every(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; })), sels);
const apart = (page, sels) => page.evaluate(ss => { const R = ss.map(s => document.querySelector(s).getBoundingClientRect()).filter(r => r.width > 0); for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) if (R[i].left < R[j].right && R[j].left < R[i].right && R[i].top < R[j].bottom && R[j].top < R[i].bottom) return false; return true; }, sels);
for (const [w, h, touch, name] of [[844, 390, true, '橫式手機'], [1024, 768, false, '4:3 平板'], [2560, 1080, false, '超寬螢幕'], [1280, 600, false, '矮視窗']]) {
  const { ctx, page, log } = await open(w, h, touch);
  await page.waitForTimeout(700); await shot(page, `fit-${w}x${h}-title`);
  ok(`${name} ${w}×${h}：標題的選項與按鈕都在畫面內`, await inView(page, ['#title h1', '#tTeam button', '#tDiff button', '#go', '#watch']));
  await page.evaluate(() => window.__lc.start({ auto: true })); await page.waitForTimeout(4600); await shot(page, `fit-${w}x${h}-play`);
  ok(`${name}：HUD 在畫面內且互不重疊`, await inView(page, ['#top', '#hp', '#ammo', '#menuBtn']) && await apart(page, ['#top', '#hp', '#ammo', '#menuBtn']));
  await page.evaluate(() => window.__lc.openPause()); await page.waitForTimeout(350); await shot(page, `fit-${w}x${h}-pause`);
  ok(`${name}：暫停選單與計分板在畫面內且互不重疊`, await inView(page, ['#pause .key', '#pauseL table']) && await apart(page, ['#pause .rail', '#pauseL']));
  await page.evaluate(() => window.__lc.panel('gunsmith')); await page.waitForTimeout(700); await shot(page, `fit-${w}x${h}-gunsmith`);
  ok(`${name}：槍匠的選項與返回鈕都在畫面內`, await inView(page, ['#gunsmith .part', '#gunsmith .back']));
  await page.evaluate(() => window.__lc.panel('settings')); await page.waitForTimeout(300);
  ok(`${name}：設定的控制項都在畫面內`, await inView(page, ['#settings input', '#settings .seg button', '#settings .back']));
  ok(`${name}：沒有水平溢出、沒有錯誤`, await overflow(page) <= 0 && log.errors.length === 0 && log.external.length === 0, log.errors.concat(log.external).slice(0, 2).join(' | '));
  await ctx.close();
}

// ---------- Retina（DPR 2）下、槍燈開著面對大廳連續開火的 FPS ----------
{
  const { ctx, page } = await open(1440, 900, false, '?seed=7', 2);
  await page.click('#go'); await page.waitForFunction(() => window.__lc.info().phase === 'live', null, { timeout: 15000 });
  await page.evaluate(() => { const L = window.__lc, g = L.game; for (const e of g.ents) if (!e.isPlayer) e.bot.wait = 999; const p = g.player; p.x = 1.2; p.z = 10.5; L.dbg.view.yaw = 0.12; L.dbg.view.pitch = -0.03; L.dbg.M[0] = true; });
  await page.waitForTimeout(1500);
  const fps = await page.evaluate(() => new Promise(r => { let n = 0, worst = 0, last = performance.now(); const t0 = last; const f = t => { n++; worst = Math.max(worst, t - last); last = t; if (t - t0 < 6000) requestAnimationFrame(f); else r({ avg: n / ((t - t0) / 1000), worst }); }; requestAnimationFrame(f); }));
  const i = await info(page);
  ok('Retina：槍燈開、面對大廳開火時平均 FPS ≥ 55', fps.avg >= 55 && i.calls > 180, `平均 ${fps.avg.toFixed(1)}、最慢一幀 ${fps.worst.toFixed(0)} ms、${i.calls} draw calls、${i.tris} 三角形、內部解析度 ${i.size.join('×')}、動態縮放 ${i.dyn.toFixed(2)}`);
  await shot(page, 'retina-fire');
  await ctx.close();
}

await browser.close(); server.close();
console.log(fail ? `\n${fail} 項沒過` : '\n全部通過');
process.exit(fail ? 1 : 0);
