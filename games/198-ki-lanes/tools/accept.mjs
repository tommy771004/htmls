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
  if (touch) { await page.tap('.card[data-id="frieza"]'); await page.tap('#go'); } else { await page.click('.card[data-id="frieza"]'); await page.click('#go'); }
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
  const [rOk, kiAfter] = await ev((id) => { const k = window.__ki, e = k.G.units.find((u) => u.id === id), P = k.G.player; P.st.stun = 0; P.y = 0; P.action = null; e.st.stun = 2; const ok = k.cast('R', e.x, e.z); return [ok, k.G.player.ki]; }, eid);
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
  // 商店與仙豆：泉水外不能買；回泉水後買得到，能力值跟著變
  const shop = await ev(() => {
    const k = window.__ki, G = k.G, P = G.player;
    k.teleport(0, 0); k.setGold(5000); const away = k.buy('weights');
    const f = P.team === 0 ? [-80, 80] : [80, -80]; k.teleport(f[0], f[1]);
    const ad0 = P.ad; const ok = k.buy('weights'); const ok2 = k.buy('senzu');
    P.hp = P.maxHp * 0.3; const hp0 = P.hp; const ate = k.senzu();
    return { away, ok, ok2, adUp: P.ad > ad0, ate, healed: P.hp > hp0 };
  });
  check('泉水外不能購買', shop.away === false, shop);
  check('購買道具並加攻擊', shop.ok && shop.adUp, shop);
  check('仙豆可購買並回血', shop.ok2 && shop.ate && shop.healed, shop);
  if (touch) await page.tap('#dock .goldbtn'); else await page.keyboard.press('KeyP');
  await page.waitForTimeout(250); await shot('5b-shop');
  check('商店面板開啟', await ev(() => document.getElementById('shop').classList.contains('on')));
  if (touch) await page.tap('#shop .shopX'); else await page.click('#shop .shopX');
  // 戰爭迷霧：遠處的敵方英雄看不到
  const fog = await ev(() => {
    const k = window.__ki, G = k.G, P = G.player; k.freezeAI(true);
    const e = G.heroes.find((h) => h.team !== P.team && h.alive) || G.heroes.find((h) => h.team !== P.team);
    e.alive = true; e.hp = e.maxHp; e.x = 60; e.z = -20; k.teleport(-60, 20);
    for (const m of G.minions) if (m.team === P.team) m.alive = false;
    k.fastForward(0.5);
    const hidden = k.visible(e.id) === false;
    k.teleport(e.x - 2.5, e.z); k.fastForward(0.5);
    return { hidden, shown: k.visible(e.id) === true };
  });
  check('戰爭迷霧：視野外的敵人看不到、靠近後看得到', fog.hidden && fog.shown, fog);
  // 野怪營地與大猿
  const jungle = await ev(() => {
    const k = window.__ki, G = k.G, P = G.player; k.fastForward(Math.max(0, 152 - G.time));
    const camps = k.camps(); const boss = k.boss();
    const mob = G.monsters.find((m) => m.alive && !m.boss);
    k.teleport(mob.x + 2, mob.z + 2); k.setLevel(10); mob.hp = 30; k.attack(mob.id); k.fastForward(2.5);
    const b = G.monsters.find((m) => m.boss && m.alive); k.teleport(b.x + 4, b.z + 4); b.hp = 20; k.attack(b.id); k.fastForward(4);
    return { camps: camps.filter((c) => c.alive).length, boss: !!boss, mobDead: !mob.alive, apeBuff: P.apeBuff > 0 };
  });
  check('野怪營地與大猿出生', jungle.camps >= 4 && jungle.boss, jungle);
  check('擊倒野怪', jungle.mobDead, jungle);
  check('擊倒大猿得到大猿之力', jungle.apeBuff, jungle);
  await page.waitForTimeout(300); await shot('5c-jungle');
  // 尋路：點遠處能繞過野區走到
  const nav = await ev(() => { const k = window.__ki, G = k.G, P = G.player; k.teleport(-60, -30); k.moveTo(-20, -60); k.fastForward(14); return { d: Math.hypot(P.x + 20, P.z + 60) }; });
  check('長距離尋路可到達', nav.d < 2.5, nav);
  // 超級賽亞人：悟空爆氣變身
  // 草叢、視線遮擋、眼
  const fog2 = await ev(() => {
    const k = window.__ki, G = k.G, P = G.player; k.freezeAI(true);
    for (const m of G.minions) m.alive = false; G.nextWave = 1e9;
    for (const m of G.monsters) m.alive = false; for (const c of G.camps) c.next = 1e9;
    for (const w of G.wards) w.alive = false;
    const e = G.heroes.find((h) => h.team !== P.team); e.alive = true; e.hp = e.maxHp; e.brain = null; e.goal = null; e.target = null; e.reveal = 0; e.autoAcquire = false; e.st.stun = 60;
    for (const h of G.heroes) if (h !== P && h !== e) { h.x = 999; h.alive = false; h.respawn = 999; }
    const b = k.bushes().find((q) => Math.abs(q.x) < 60 && Math.abs(q.z) < 60 && q.x < q.z) || k.bushes()[0];
    e.x = b.x; e.z = b.z; k.teleport(b.x + b.r + 3.5, b.z); k.fastForward(0.4);
    const bushHidden = k.visible(e.id) === false;
    k.teleport(b.x + 0.4, b.z); k.fastForward(0.4);
    const sameBush = k.visible(e.id) === true;
    // 視線：大障礙物兩側
    const o = window.__ki.G && null;
    return { bushHidden, sameBush, ex: e.id };
  });
  check('草叢：外面看不到草叢裡的敵人', fog2.bushHidden, fog2);
  check('草叢：走進同一叢就看得到', fog2.sameBush, fog2);
  const los = await ev((eid) => {
    const k = window.__ki, G = k.G, P = G.player, e = G.units.find((u) => u.id === eid);
    const obs = k.obstacles().filter((o) => o.r > 3.2 && Math.abs(o.x) < 70 && Math.abs(o.z) < 70);
    for (const o of obs) {
      const a = { x: o.x - o.r - 2.2, z: o.z }, b = { x: o.x + o.r + 2.2, z: o.z };
      if (!k.walkableAt(a.x, a.z) || !k.walkableAt(b.x, b.z) || k.inBushAt(a.x, a.z) || k.inBushAt(b.x, b.z)) continue;
      e.x = b.x; e.z = b.z; e.reveal = 0; k.teleport(a.x, a.z); k.fastForward(0.4);
      return { blocked: k.visible(e.id) === false, d: +(b.x - a.x).toFixed(1) };
    }
    return { blocked: false, none: true };
  }, fog2.ex);
  check('樹叢／岩石擋住視線', los.blocked && los.d < 13, los);
  const ward = await ev((eid) => {
    const k = window.__ki, G = k.G, P = G.player, e = G.units.find((u) => u.id === eid);
    k.teleport(0, 0); P.cds.T = 0; e.x = 6; e.z = -6; e.reveal = 0; k.fastForward(0.4);
    const before = k.visible(e.id);
    const placed = k.ward(4, -4); k.teleport(-30, 30); k.fastForward(0.4);
    const viaWard = k.visible(e.id);
    const w = G.wards.find((x) => x.alive && x.team === P.team);
    const enemySees = (() => { const g = G.vision; return null; })();
    return { placed, viaWard, wardHiddenToEnemy: !!w && !k.visibleTo(1 - P.team, w.id), before };
  }, fog2.ex);
  check('插眼並靠眼看到敵人', ward.placed && ward.viaWard, ward);
  check('敵方沒有探測器時看不到眼', ward.wardHiddenToEnemy, ward);
  // 真眼：照出敵方的眼，敵人也看得到真眼
  const ctl = await ev(() => {
    const k = window.__ki, G = k.G, P = G.player, E = G.heroes.find((h) => h.team !== P.team);
    P.alive = true; P.inv = []; P.st.stun = 0;
    // 敵方在 (20,-20) 插一顆眼
    E.alive = true; E.cds.T = 0; E.x = 18; E.z = -18; window.__kiPlace(E, 20, -20);
    const ew = G.wards.find((w) => w.alive && w.team === E.team && !w.control);
    k.teleport(15, -15); k.fastForward(0.3);
    const before = k.visible(ew.id);
    P.controls = 1; const placed = k.control(17, -17); k.fastForward(0.3);
    const after = k.visible(ew.id);
    const cw = G.wards.find((w) => w.alive && w.control && w.team === P.team);
    E.st.stun = 30; E.x = cw.x + 4; E.z = cw.z - 4; E.alive = true; k.fastForward(0.4);
    return { before, placed, after, enemySeesControl: k.visibleTo(E.team, cw.id) };
  });
  check('真眼照出敵方的眼', ctl.before === false && ctl.placed && ctl.after === true, ctl);
  check('敵人看得到真眼', ctl.enemySeesControl === true, ctl);
  // AI 草叢埋伏：落單的敵人沿路推進時，兩名隊友先躲進它前方的草叢，等它走近再出手
  const amb = await ev(() => {
    const k = window.__ki; k.start('goku', 1); const G = k.G, P = G.player; k.freezeAI(false);
    k.listen('ambush'); k.listen('ambushStrike');
    G.time = 120; G.nextWave = 1e9;
    const allies = G.heroes.filter((h) => h.team === P.team && h !== P), foes = G.heroes.filter((h) => h.team !== P.team);
    const E = foes[0]; for (const f of foes.slice(1)) { f.alive = false; f.respawn = 999; }
    const bs = k.laneBushes(E.lane, E.team).filter((b) => b.prog > 60 && b.prog < 170).sort((a, b) => a.prog - b.prog);
    const bush = bs[0];
    const start = k.lanePoint(E.lane, E.team, bush.prog - 18), dest = k.lanePoint(E.lane, E.team, bush.prog + 25), back = k.lanePoint(E.lane, E.team, bush.prog + 16);
    E.x = start.x; E.z = start.z; E.brain = null; E.reveal = 1e9; E.ms = 3.2;
    P.x = -80; P.z = 80;
    allies.forEach((a, i) => { a.x = back.x + (i ? -5 : 5); a.z = back.z + (i ? 5 : -5); a.hp = a.maxHp; a.brain.mode = 'lane'; a.brain.plan = 0; a.brain.ambushCd = 0; });
    let hiddenInBush = false, t = 0;
    for (; t < 40 && !window.__kiEv.ambushStrike; t += 0.25) {
      if (t > 6 && !E.goal) { window.__kiMove(E, dest.x, dest.z); }
      k.fastForward(0.25);
      if (window.__kiEv.ambush && !hiddenInBush) hiddenInBush = allies.some((a) => k.inBushAt(a.x, a.z) && !k.visibleTo(E.team, a.id));
    }
    return { ambush: window.__kiEv.ambush, strike: window.__kiEv.ambushStrike, hiddenInBush, t };
  });
  check('AI 隊友會先躲進草叢埋伏，敵人看不到', amb.ambush >= 1 && amb.hiddenInBush, amb);
  check('敵人走近時埋伏一起出手', amb.strike >= 1, amb);
  await page.waitForTimeout(300); await shot('5e-ambush');
  await ev(() => { const k = window.__ki; k.start('frieza', 1); });
  // 合成與賣回
  const tree = await ev(() => {
    const k = window.__ki, G = k.G, P = G.player; P.alive = true;
    const f = P.team === 0 ? [-80, 80] : [80, -80]; k.teleport(f[0], f[1]);
    P.inv = []; k.setGold(2000);
    k.buy('weights'); k.buy('weights'); const g0 = P.gold; const ok = k.buy('kaioken'); const paid = g0 - P.gold;
    const inv1 = P.inv.slice(); const g1 = P.gold; const sold = k.sell(0); const got = P.gold - g1;
    return { ok, paid, inv1, sold, got, inv2: P.inv.slice() };
  });
  check('合成：吃掉材料、只付合成費', tree.ok && tree.paid === 500 && tree.inv1.join() === 'kaioken', tree);
  check('賣回拿 60%', tree.sold && tree.got === 720 && tree.inv2.length === 0, tree);
  if (touch) await page.tap('#dock .goldbtn'); else await page.keyboard.press('KeyP');
  await page.waitForTimeout(200);
  const sel = touch ? page.tap.bind(page) : page.click.bind(page);
  await sel('#shop .item[data-id="potara"]'); await page.waitForTimeout(150); await shot('5d-tree');
  const treeUi = await ev(() => document.querySelectorAll('#shop .tree .node').length);
  check('商店顯示合成樹', treeUi >= 7, treeUi);
  await sel('#shop .item[data-id="weights"]'); await sel('#shop .buyb'); await page.waitForTimeout(100);
  await sel('#shop .islot[data-slot="0"]'); await sel('#shop .sellb'); await page.waitForTimeout(100);
  check('商店介面可以購買與賣出', await ev(() => window.__ki.G.player.inv.length === 0));
  await sel('#shop .shopX');
  // AI 包抄：隊友被壓在塔下時，另一名 AI 隊友繞到敵人背後支援
  const gank = await ev(() => {
    const k = window.__ki; k.start('goku', 1); const G = k.G, P = G.player; k.freezeAI(false); G.vision.on = true;
    k.listen('roam'); k.listen('flank');
    for (const h of G.heroes) h.alive = true;
    const allies = G.heroes.filter((h) => h.team === P.team && h !== P), foes = G.heroes.filter((h) => h.team !== P.team);
    const [A, B] = allies; const E = foes[0];
    P.x = -80; P.z = 80;
    for (const f of foes.slice(1)) { f.alive = false; f.respawn = 999; }
    const t = G.structures.find((s) => s.team === P.team && s.lane === A.lane && s.tier === 'outer');
    A.x = -70; A.z = -8; A.hp = A.maxHp * 0.6; E.x = -67; E.z = -12; E.hp = E.maxHp; E.armor = 0.55; E.ms = 3; E.reveal = 1e9; E.brain = null; E.target = A;
    B.x = -36; B.z = 22; B.hp = B.maxHp; B.brain.mode = 'lane'; B.brain.plan = 0;
    for (let i = 0; i < 26 && !window.__kiEv.flank; i++) k.fastForward(1);
    return { roam: window.__kiEv.roam, flank: window.__kiEv.flank, B: B.heroId, E: E.heroId };
  });
  check('AI 隊友會遊走支援並繞到敵人背後', gank.roam >= 1 && gank.flank >= 1, gank);
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
  await ev(() => window.__ki.start('vegeta', 0)); await ev(() => window.__ki.lose());
  await page.waitForTimeout(4200); await shot('8-lose');
  check('敗北結算畫面', await ev(() => window.__ki.state().phase === 'end' && document.getElementById('end').classList.contains('lose')));
  // 整場 AI 對戰跑得完（不卡死）
  const formBefore = await ev(() => { const k = window.__ki; k.start('goku', 1); const P = k.G.player; P.cds.D = 0; k.fastForward(0.2); return P.form; });
  await page.waitForTimeout(200);
  if (touch) await page.tap('.sk[data-k="D"] .face'); else await page.keyboard.press('KeyD');
  const ssj2 = [formBefore, await ev(() => window.__ki.G.player.form)];
  check('悟空爆氣變超級賽亞人', ssj2[0] === 'base' && ssj2[1] === 'ssj', ssj2);
  await page.waitForTimeout(500); await shot('9-ssj');
  const full = await ev(() => { const k = window.__ki; k.start('piccolo', 2); k.freezeAI(false); const t0 = performance.now(); k.fastForward(240); return { t: k.state().time, ms: performance.now() - t0, kills: k.state().kills }; });
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
