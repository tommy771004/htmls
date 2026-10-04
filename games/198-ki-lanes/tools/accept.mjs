// 驗收：node tools/accept.mjs <html> [--out dir]
// 兩種尺寸（1440×900、390×844 觸控）：選角 → 開場 → 兵線 → 普攻連段 → QWER → 升級 → 死亡復活 → 推塔 → 勝利 / 敗北。
// 檢查：無 uncaught exception、無 console.error、無外部請求、有 viewport meta、390 寬無水平溢出。
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { open } from './lib.mjs';

const a = process.argv.slice(2);
const html = a.find((x) => !x.startsWith('--') && a[a.indexOf(x) - 1] !== '--out') || '../../web/198-ki-lanes.html';
const oi = a.indexOf('--out');
const outDir = resolve(oi >= 0 ? a[oi + 1] : 'dist/accept');
mkdirSync(outDir, { recursive: true });

let failed = 0;
async function run(name, w, h, touch) {
  const { browser, page, log } = await open(html, { w, h, touch });
  const checks = [];
  const check = (n, ok, d) => { checks.push({ n, ok: !!ok, d }); if (!ok) failed++; };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const raf = () => ev(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  const shot = async (s) => { await raf(); await page.screenshot({ path: resolve(outDir, `${name}-${s}.png`) }); };
  check('viewport meta', await ev(() => !!document.querySelector('meta[name=viewport]')));
  await page.waitForTimeout(1200); await shot('1-select');
  // 用真的點擊選角並出戰
  if (touch) { await page.tap('.card[data-id="shimo"]'); await page.tap('#go'); } else { await page.click('.card[data-id="shimo"]'); await page.click('#go'); }
  await page.waitForTimeout(500);
  check('進入對戰', (await ev(() => window.__ki.state().phase)) === 'play');
  check('開局自動學會 Q', (await ev(() => window.__ki.state().player.ranks.Q)) === 1);
  // 兵線
  await ev(() => { const k = window.__ki; k.fastForward(26); k.teleport(-14, 14); k.fastForward(4); });
  const s1 = await ev(() => window.__ki.state());
  check('小兵出生並前進', s1.minions >= 20, s1.minions);
  await page.waitForTimeout(400); await shot('2-lane');
  // 普攻連段：對最近的敵方小兵連打
  const combo = await ev(() => {
    const k = window.__ki, G = k.G, P = G.player; k.freezeAI(true);
    const m = G.minions.filter((x) => x.alive && x.team === 1).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0];
    k.teleport(m.x - 3, m.z + 3); m.hp = m.maxHp = 5000; k.attack(m); let best = 0;
    for (let i = 0; i < 40; i++) { k.fastForward(0.1); best = Math.max(best, G.combo.n); }
    return { best, chainSeen: P.chain };
  });
  check('普攻三段連段累積連擊數', combo.best >= 3, combo);
  // 技能：升到 6 級、學全部技能、補滿氣
  await ev(() => { const k = window.__ki; k.setLevel(6); k.learnAll(); k.give({ ki: 500 }); });
  const eid = await ev(() => window.__ki.spawnEnemyHeroNear(6));
  const before = await ev((id) => window.__ki.G.units.find((u) => u.id === id).hp, eid);
  const used = await ev((id) => {
    const k = window.__ki, G = k.G, e = G.units.find((u) => u.id === id), r = {};
    for (const key of ['Q', 'W', 'E']) { r[key] = k.cast(key, e.x, e.z); k.fastForward(0.7); }
    return r;
  }, eid);
  check('Q/W/E 可施放', used.Q && used.W && used.E, used);
  const kiBefore = await ev(() => { window.__ki.give({ ki: 500 }); return window.__ki.state().player.ki; });
  const [rOk, kiAfter] = await ev((id) => { const k = window.__ki, e = k.G.units.find((u) => u.id === id); const ok = k.cast('R', e.x, e.z); return [ok, k.G.player.ki]; }, eid);
  await page.waitForTimeout(450); await shot('3-super');
  await ev(() => window.__ki.fastForward(1.6));
  const after = await ev((id) => { const u = window.__ki.G.units.find((x) => x.id === id); return { hp: u.hp, alive: u.alive }; }, eid);
  check('R 終極必殺可施放並花 3 格氣', rOk && kiBefore - kiAfter >= 250, { rOk, kiBefore, kiAfter });
  check('技能對敵方英雄造成傷害', !after.alive || after.hp < before, { before, after });
  await shot('4-after');
  // 升級
  const lv = await ev(() => { const k = window.__ki, P = k.G.player, l0 = P.level; k.give({ xp: 5000 }); return [l0, P.level, P.sp]; });
  check('經驗升級並得到技能點', lv[1] > lv[0] && lv[2] > 0, lv);
  // 死亡與復活
  const deadState = await ev(() => { const k = window.__ki; k.killPlayer(); k.fastForward(0.5); return k.state().player.alive; });
  check('玩家可陣亡', deadState === false);
  await page.waitForTimeout(300); await shot('5-dead');
  const back = await ev(() => { const k = window.__ki; k.fastForward(40); return k.state().player.alive; });
  check('倒數後復活', back === true);
  // 推塔：外塔被摧毀前內塔不受傷
  const prot = await ev(() => { const k = window.__ki, G = k.G; const inner = G.structures.find((s) => s.sid === 't11i'); const hp0 = inner.hp; k.damageStructure('t11i', 500); return [hp0, inner.hp]; });
  check('外塔未破時內塔受保護', prot[0] === prot[1], prot);
  check('摧毀外塔', await ev(() => window.__ki.destroy('t11o')));
  const prot2 = await ev(() => { const k = window.__ki, G = k.G; const inner = G.structures.find((s) => s.sid === 't11i'); const hp0 = inner.hp; k.damageStructure('t11i', 500); return [hp0, inner.hp]; });
  check('外塔破後內塔可受傷', prot2[1] < prot2[0], prot2);
  // 小地圖點擊（真實滑鼠／觸控）
  const mm = await page.$('#minimap'); const box = await mm.boundingBox();
  if (touch) await page.tap('#minimap', { position: { x: box.width * 0.5, y: box.height * 0.5 } }); else await page.click('#minimap', { position: { x: box.width * 0.5, y: box.height * 0.5 } });
  check('小地圖點擊有反應', await ev(() => { const G = window.__ki.G; return G.camFree || !!G.player.goal; }));
  await ev(() => window.__ki.follow());
  // 技能列實際點擊
  const skillClick = await (async () => { await ev(() => { const k = window.__ki; k.G.player.cds.D = 0; }); if (touch) await page.tap('.sk[data-k="D"] .face'); else await page.click('.sk[data-k="D"] .face'); return ev(() => window.__ki.G.player.st.spark > 0); })();
  check('點擊爆氣鍵生效', skillClick);
  // 說明面板
  if (!touch) { await page.click('#helpBtn'); await page.waitForTimeout(200); await shot('6-help'); check('說明面板開啟', await ev(() => document.getElementById('help').classList.contains('on'))); await page.click('#helpClose'); }
  // 勝利
  await ev(() => window.__ki.win());
  await page.waitForTimeout(4200); await shot('7-win');
  check('勝利結算畫面', await ev(() => window.__ki.state().phase === 'end' && document.getElementById('end').classList.contains('win')));
  if (touch) await page.tap('#again'); else await page.click('#again');
  await page.waitForTimeout(400);
  check('回到選角', await ev(() => window.__ki.state().phase === 'select' && document.getElementById('select').classList.contains('on')));
  // 敗北
  await ev(() => window.__ki.start('raiga', 0)); await ev(() => window.__ki.lose());
  await page.waitForTimeout(4200); await shot('8-lose');
  check('敗北結算畫面', await ev(() => window.__ki.state().phase === 'end' && document.getElementById('end').classList.contains('lose')));
  // 整場 AI 對戰跑得完（不卡死）
  const full = await ev(() => { const k = window.__ki; k.start('iwao', 2); k.freezeAI(false); const t0 = performance.now(); k.fastForward(240); return { t: k.state().time, ms: performance.now() - t0, kills: k.state().kills }; });
  check('AI 對戰持續進行', full.t > 200, full);
  check('無 uncaught exception', log.pageerrors.length === 0, log.pageerrors.slice(0, 3));
  check('無 console.error', log.errors.length === 0, log.errors.slice(0, 3));
  check('無外部請求', log.external.length === 0, log.external.slice(0, 3));
  if (w <= 430) { const sw = await ev(() => [document.documentElement.scrollWidth, innerWidth]); check('無水平溢出', sw[0] <= w, sw.join('/')); }
  console.log(`\n${name} ${w}×${h}（${log.gpu}）`);
  for (const c of checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.n}${c.d !== undefined && !c.ok ? '  ' + JSON.stringify(c.d) : ''}`);
  await browser.close();
}
await run('desktop', 1440, 900, false);
await run('mobile', 390, 844, true);
console.log(failed ? `\n${failed} 項失敗` : '\n全部通過');
process.exit(failed ? 1 : 0);
