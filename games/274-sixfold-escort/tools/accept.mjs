// 六器鏢行 — 無頭 Chrome 全流程驗收腳本
// 用法：node tools/accept.mjs [單檔路徑] [--prefix=ui-]   （或環境變數 SHOT_PREFIX；預設截圖名 accept-*.png，存在 dist/）
// 檢查 1440×900（桌機）、390×844（直式手機觸控）、667×375（橫式手機觸控）：
// 零 uncaught exception、零 console.error、零外部網路請求、零水平溢出、頁面不含舊作品名、入局帖與雙模 HUD 完整在視窗內且互不重疊，
// 六器匣六格與羅盤都在視窗內、觸控扇匣各鍵 ≥ 44px 且互不重疊，
// 並實際走過：立帖入局進青萍渡 → 移動 → 匣中取器施放【通玄・斷流斬】破罡 → 渡口行會朱砂引路線 → 偃師遺墟金樞偃甲上機 → 換手
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const prefixArg = args.find((a) => a.startsWith('--prefix='));
const prefix = prefixArg ? prefixArg.slice(9) : (process.env.SHOT_PREFIX ?? 'accept-');
const htmlArg = args.find((a) => !a.startsWith('--'));
const html = htmlArg ? resolve(process.cwd(), htmlArg) : resolve(root, '../../web/274-sixfold-escort.html');
const distDir = resolve(root, 'dist');
mkdirSync(distDir, { recursive: true });

let fail = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) fail++;
};
const rect = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const b = el.getBoundingClientRect();
  return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)];
}, sel);
// 圓形鍵（border-radius ≥ 50%）用圓形判定，其餘用矩形：扇匣沿弧排列時外接方框會在角落交疊，但鍵本身沒有碰到
const rects = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)]
  .filter((el) => getComputedStyle(el).display !== 'none' && el.getClientRects().length)
  .map((el) => {
    const b = el.getBoundingClientRect();
    const round = parseFloat(getComputedStyle(el).borderTopLeftRadius) >= b.width / 2 - 0.5 && Math.abs(b.width - b.height) < 1;
    return { id: el.dataset.fan || el.dataset.slot || el.id || el.className, round, r: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)] };
  }), sel);
const inView = (r, w, h) => !!r && r[0] >= 0 && r[1] >= 0 && r[2] <= w && r[3] <= h;
const overlaps = (a, b) => !!a && !!b && a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
const circ = (r) => ({ x: (r[0] + r[2]) / 2, y: (r[1] + r[3]) / 2, rad: (r[2] - r[0]) / 2 });
const shapeHit = (a, b) => {
  if (!overlaps(a.r, b.r)) return false;
  if (a.round && b.round) {
    const p = circ(a.r), q = circ(b.r);
    return Math.hypot(p.x - q.x, p.y - q.y) < p.rad + q.rad - 0.5;
  }
  if (a.round || b.round) {
    const c = circ(a.round ? a.r : b.r);
    const r = a.round ? b.r : a.r;
    const nx = Math.max(r[0], Math.min(c.x, r[2])), ny = Math.max(r[1], Math.min(c.y, r[3]));
    return Math.hypot(c.x - nx, c.y - ny) < c.rad - 0.5;
  }
  return true;
};
const pairOverlaps = (list) => {
  const hits = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (shapeHit(list[i], list[j])) hits.push(`${list[i].id}×${list[j].id}`);
  return hits;
};

for (const [w, h, touch] of [[1440, 900, false], [390, 844, true], [667, 375, true]]) {
  const tag = `${w}×${h}${touch ? '(Touch)' : '(PC)'}`;
  const { browser, page, log } = await open(html, { w, h, touch });
  const st = () => page.evaluate(() => window.__sf.state());
  const shot = async (name) => {
    await raf(page);
    await page.screenshot({ path: resolve(distDir, `${prefix}${name}-${w}x${h}.png`) });
  };
  const noOverflow = () => page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth &&
    document.body.scrollWidth <= window.innerWidth
  ));

  try {
    await page.waitForTimeout(500);
    const meta = await page.evaluate(() => ({
      vp: !!document.querySelector('meta[name=viewport]'),
      text: `${document.title}\n${document.body.innerText}`,
      html: [...document.querySelectorAll('head, body > :not(script)')].map((el) => el.outerHTML).join('\n'),
      title: document.title,
      info: window.__sf.info(),
    }));
    // 禁用字以 \u 跳脫寫成，讓這支腳本本身在舊名掃描裡也是 0 筆（前身的改編聲明用語、作品舊名、舊主城名、舊合體名、舊屬性名、舊爆發系統名、英文對戰縮寫）
    const bannedZh = ['\u5fa9\u523b', '\u540c\u4eba', '\u65b0\u58a8\u6e58', '\u58a8\u9999', '\u58a8\u9b42', '\u862d\u5dde', '\u6cf0\u5766', '\u5fc3\u8108', '\u7121\u96d9', 'P\u0076P'];
    const banned = [
      ...bannedZh.filter((t) => meta.text.includes(t) || meta.html.includes(t)),
      ...(meta.text.toUpperCase().includes('MO' + 'SIANG') ? ['MO' + 'SIANG'] : []),
    ];
    ok(meta.vp, `${tag} 具備 viewport meta（後端：${meta.info.backend}）`);
    ok(banned.length === 0, `${tag} 頁面文字不含舊作品名與改編字樣${banned.length ? `（找到：${banned.join('、')}）` : ''}`);
    ok(await noOverflow(), `${tag} 入局帖零水平溢出`);

    const cardRect = await rect(page, '.intro-card');
    const btnRect = await rect(page, '#startBtn');
    ok(inView(cardRect, w, h) && inView(btnRect, w, h), `${tag} 入局帖與「立帖入局」完整在視窗內 (${cardRect?.join(',')})`);
    // 入局帖的每個選項都能點：換成女、第二種髮式、墨綠、刀，再確認 look 跟著變
    const pickSel = ['#segGender [data-v="Female"]', '#segHair [data-v="1"]', '#segPalette [data-v="pine"]', '#introWpnGrid [data-type="BLADE"]', '#segGender [data-v="Male"]', '#introWpnGrid [data-type="SPEAR"]'];
    for (const s of pickSel) {
      if (touch) await page.tap(s);
      else await page.click(s);
    }
    const look = await page.evaluate(() => window.__sf.hud.getLook());
    ok(look.gender === 'Male' && look.hair === 1 && look.palette === 'pine' && look.weapon === 'SPEAR', `${tag} 入局帖選項生效 (${JSON.stringify(look)})`);
    await shot('intro');

    // 點擊立帖入局，進入青萍渡
    if (touch) await page.tap('#startBtn');
    else await page.click('#startBtn');
    await page.waitForTimeout(250);

    const s0 = await st();
    const expectedMode = touch ? 'mobile' : 'pc';
    ok(s0.hudMode === expectedMode, `${tag} 自動適配雙模 HUD = ${s0.hudMode}`);
    ok(await noOverflow(), `${tag} 遊戲主 HUD 零水平溢出`);

    const rCompass = await rect(page, '#compass');
    ok(inView(rCompass, w, h), `${tag} 黃銅羅盤在視窗內 (${rCompass?.join(',')})`);
    const rHero = await rect(page, '#heroBox');
    const rRight = await rect(page, '#rightTop');
    ok(inView(rHero, w, h) && inView(rRight, w, h), `${tag} 鏢單與羅盤區完整在視窗內`);

    if (!touch) {
      const slots = await rects(page, '#sixBox .slot');
      ok(slots.length === 6 && slots.every((s) => inView(s.r, w, h)), `${tag} 六器匣六格都在視窗內 (${slots.map((s) => s.r[0]).join(',')})`);
      const bar = await rects(page, '#leftBox, #sixBox, #innerBox, #chatBox, #heroBox, #sideTabs, #rightTop');
      const hits = pairOverlaps(bar);
      ok(hits.length === 0, `${tag} PC HUD 各區零重疊${hits.length ? `（${hits.join('、')}）` : ''}`);
      const tabs = await rects(page, '#sideTabs [data-open-tab]');
      ok(tabs.length === 8 && tabs.every((t) => inView(t.r, w, h)), `${tag} 左緣八面鏢旗頁籤都在視窗內`);
    } else {
      const rTopC = await rect(page, '#topCenter');
      const rTabsBtn = await rect(page, '#btnMobileTabs');
      ok(!overlaps(rHero, rTopC) && !overlaps(rRight, rTopC) && !overlaps(rTabsBtn, rTopC) && !overlaps(rHero, rRight) && !overlaps(rTabsBtn, rRight),
        `${tag} 頂部 HUD 零重疊 (hero=${rHero?.join(',')} tabs=${rTabsBtn?.join(',')} right=${rRight?.join(',')} topC=${rTopC?.join(',')})`);
      const fanBtns = await rects(page, '#skillFan .fan-btn, #btnWheelMech');
      const small = fanBtns.filter((b) => b.r[2] - b.r[0] < 44 || b.r[3] - b.r[1] < 44);
      ok(fanBtns.length === 8 && small.length === 0, `${tag} 觸控扇匣八鍵（中央＋六格＋偃甲）皆 ≥ 44px${small.length ? `（過小：${small.map((b) => b.id).join('、')}）` : ''}`);
      const fanHits = pairOverlaps(fanBtns);
      ok(fanHits.length === 0 && fanBtns.every((b) => inView(b.r, w, h)), `${tag} 觸控扇匣各鍵互不重疊且在視窗內${fanHits.length ? `（${fanHits.join('、')}）` : ''}`);
      const bottom = await rects(page, '#joyZone, #mobPotions .pot-btn, #skillFan .fan-btn, #btnWheelMech, #chatBox');
      const bottomHits = pairOverlaps(bottom);
      ok(bottomHits.length === 0, `${tag} 底部搖桿／藥／扇匣／驛報零重疊${bottomHits.length ? `（${bottomHits.join('、')}）` : ''}`);
      // 鏢單按鈕展開鏢旗
      await page.tap('#btnMobileTabs');
      await page.waitForTimeout(120);
      const tabs = await rects(page, '#sideTabs [data-open-tab]');
      ok(tabs.length === 8 && tabs.every((t) => inView(t.r, w, h)), `${tag}「鏢單」按鈕展開八面鏢旗且都在視窗內`);
      await shot('tabs-open');
      await page.tap('#btnMobileTabs');
    }

    // 移動測試
    const pos0 = s0.pos;
    if (!touch) {
      await page.keyboard.down('KeyS');
      await page.waitForTimeout(550);
      await page.keyboard.up('KeyS');
    } else {
      await page.evaluate(() => window.__sf.advance(0.6, { moveX: 0.4, moveZ: -0.9 }));
    }
    const pos1 = (await st()).pos;
    ok(Math.hypot(pos1.x - pos0.x, pos1.z - pos0.z) > 0.6, `${tag} 角色移動順暢 (${pos0.x},${pos0.z} -> ${pos1.x},${pos1.z})`);
    await shot('qingping');

    // 匣中取器施放【通玄・斷流斬】並破罡，畫面中央蓋「破」字朱印
    const combatCheck = await page.evaluate(() => {
      const wObj = window.__sf.world;
      wObj.char.x = 13.8;
      wObj.char.z = 7.5;
      wObj.char.lockedTargetId = 'dummy-1';
      const dummy = wObj.entities.find((e) => e.id === 'dummy-1');
      dummy.curShield = 80; // 殘餘罡氣，準備測破罡
      window.__sf.advance(0.02);
      const res = wObj.castLinkedSkill(101, { targetId: 'dummy-1' }); // 101 通玄・斷流斬 -> 自動抽出 +9 截江刀
      window.__sf.advance(0.15);
      return {
        res, activeWpn: wObj.getActiveWeapon().uid, dummyShield: dummy.curShield,
        stamp: document.getElementById('breakStamp').classList.contains('on'),
        drawn: [...document.querySelectorAll('#sixBox .slot.drawn, #skillFan .fan-btn.drawn')].map((b) => b.dataset.castSkill),
      };
    });
    ok(combatCheck.res.ok && combatCheck.activeWpn === 'wpn-blade-01' && combatCheck.dummyShield === 0,
      `${tag} 匣中取器自動抽刀施放【通玄・斷流斬】並破罡 (active=${combatCheck.activeWpn})`);
    ok(combatCheck.stamp, `${tag} 破罡時畫面中央蓋「破」字朱印`);
    ok(combatCheck.drawn.length > 0 && combatCheck.drawn.every((s) => s === '101'), `${tag} 匣中刀格呈抽出狀態 (${combatCheck.drawn.join(',')})`);
    await page.waitForTimeout(120);
    await shot('combat-break');

    // 罡氣 < 25%：鏢單邊框朱印閃爍
    const low = await page.evaluate(() => {
      const c = window.__sf.world.char;
      c.curShield = c.maxShield * 0.12;
      window.__sf.hud.updateHud(0.016, false); // 只刷介面，不讓世界步進（自動服藥會把罡氣補回去）
      const on = document.getElementById('heroBox').classList.contains('low');
      c.curShield = c.maxShield;
      window.__sf.hud.updateHud(0.016, false);
      return on;
    });
    ok(low, `${tag} 罡氣低於 25% 時鏢單掛上朱印警示`);

    // 抽屜：每一頁都打得開、零水平溢出
    const drawerOk = await page.evaluate(async () => {
      const out = [];
      for (const t of ['char', 'martial', 'forge', 'mech', 'market', 'worldmap', 'bounty', 'handoff']) {
        window.__sf.hud.openDrawer(t);
        await new Promise((r) => requestAnimationFrame(r));
        const body = document.getElementById('drawerBody');
        const sh = document.querySelector('.drawer-shell').getBoundingClientRect();
        out.push({ t, n: body.children.length, fit: sh.left >= 0 && sh.top >= 0 && sh.right <= innerWidth + 0.5 && sh.bottom <= innerHeight + 0.5,
          over: document.documentElement.scrollWidth > document.documentElement.clientWidth });
      }
      window.__sf.hud.closeDrawer();
      return out;
    });
    const badDrawers = drawerOk.filter((d) => d.n !== 2 || !d.fit || d.over).map((d) => d.t);
    ok(badDrawers.length === 0, `${tag} 八個抽屜都是左右兩欄、在視窗內、零溢出${badDrawers.length ? `（${badDrawers.join('、')}）` : ''}`);

    // 抽屜裡那一列鏢旗頁籤：八面都完整在視窗內、頁籤欄本身不用捲
    const dtabs = await page.evaluate(async () => {
      window.__sf.hud.openDrawer('handoff');
      await new Promise((r) => requestAnimationFrame(r));
      const bar = document.querySelector('.drawer-tabs');
      const tabs = [...bar.querySelectorAll('.flag-tab')].map((t) => { const b = t.getBoundingClientRect(); return { id: t.dataset.tab || t.textContent.trim(), r: [b.left, b.top, b.right, b.bottom] }; });
      const b = bar.getBoundingClientRect();
      return { tabs, bar: [b.left, b.top, b.right, b.bottom] };
    });
    // 每面頁籤都完整落在視窗內，也完整落在頁籤欄的可見範圍內（不用捲就點得到）
    const inBox = (r, b) => r[0] >= b[0] - 0.5 && r[1] >= b[1] - 0.5 && r[2] <= b[2] + 0.5 && r[3] <= b[3] + 0.5;
    const offTabs = dtabs.tabs.filter((t) => !inBox(t.r, [0, 0, w, h]) || !inBox(t.r, dtabs.bar)).map((t) => t.id);
    ok(dtabs.tabs.length === 8 && offTabs.length === 0,
      `${tag} 抽屜頁籤八面都在視窗內、不必捲動 (欄 ${dtabs.bar.map(Math.round).join(',')})${offTabs.length ? `（超出：${offTabs.join('、')}）` : ''}`);

    // 鏢路圖：節點（旗＋字）兩兩不重疊，也不超出地圖卡
    const wm = await page.evaluate(async () => {
      window.__sf.hud.openDrawer('worldmap');
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const map = document.querySelector('.route-map').getBoundingClientRect();
      // 旗、字分兩塊量（字被 .drop 下移時按鈕外框不跟著變）
      const parts = (n) => [n.querySelector('.pin'), n.querySelector('.wl') || n].map((e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; });
      const nodes = [...document.querySelectorAll('.route-map .wm-node')].map((n) => ({ id: n.textContent.trim(), parts: parts(n) }));
      window.__sf.hud.closeDrawer();
      return { map: [map.left, map.top, map.right, map.bottom], nodes };
    });
    const wmHits = [];
    const hit1 = (a, b) => a[0] < b[2] - 1 && a[2] > b[0] + 1 && a[1] < b[3] - 1 && a[3] > b[1] + 1;
    for (let i = 0; i < wm.nodes.length; i++) for (let j = i + 1; j < wm.nodes.length; j++) {
      if (wm.nodes[i].parts.some((a) => wm.nodes[j].parts.some((b) => hit1(a, b)))) wmHits.push(`${wm.nodes[i].id}×${wm.nodes[j].id}`);
    }
    const wmOut = wm.nodes.filter((n) => n.parts.some((r) => r[0] < wm.map[0] - 0.5 || r[2] > wm.map[2] + 0.5 || r[3] > wm.map[3] + 0.5)).map((n) => n.id);
    ok(wm.nodes.length >= 10 && wmHits.length === 0 && wmOut.length === 0, `${tag} 鏢路圖 ${wm.nodes.length} 個節點字互不重疊、不出地圖卡${wmHits.length ? `（重疊：${wmHits.join('、')}）` : ''}${wmOut.length ? `（出界：${wmOut.join('、')}）` : ''}`);
    if (touch) {
      await page.evaluate(() => window.__sf.hud.openDrawer('martial'));
      await shot('drawer-martial');
      await page.evaluate(() => window.__sf.hud.closeDrawer());
    }

    // 渡口行會全攤檢索 ＋ 朱砂引路線
    if (w === 1440) {
      await page.click('[data-open-tab="market"]');
      await page.waitForTimeout(200);
      await shot('drawer-market');
      await page.click('[data-nav-stall="stall-2"]');
      await page.waitForTimeout(200);
      const navOn = await page.evaluate(() => !!window.__sf.state().navTarget);
      ok(navOn, `${tag} 渡口行會畫出 3D 朱砂引路線`);
      await shot('guide-trail');

      // 前往偃師遺墟與金樞偃甲上機
      await page.evaluate(() => {
        const wObj = window.__sf.world;
        wObj.clearNavTarget();
        wObj.changeMap(2001);
        wObj.char.mechTier = 3;
        wObj.toggleMechSummon({ instantForTest: true });
        wObj.castLinkedSkill(9001);
        window.__sf.advance(0.2);
      });
      const mechSt = await st();
      ok(mechSt.mapId === 2001 && mechSt.mechPhase === 'ACTIVE_MERGED', `${tag} 偃師遺墟金樞偃甲上機與千鈞錘施放`);
      const mechSlots = await page.evaluate(() => [...document.querySelectorAll('#sixBox .slot')].map((s) => s.dataset.castSkill || '封'));
      ok(mechSlots[0] === '9001' && mechSlots[1] === '9002', `${tag} 上機後匣中 1、2 格換成偃甲專屬技 (${mechSlots.join(',')})`);
      await shot('ruins-mech');

      // 換手（< 300ms）
      const handoff = await page.evaluate(() => window.__sf.world.performSessionHandoff('mobile'));
      ok(handoff.handoff_latency_ms < 300, `${tag} 換手 (${handoff.handoff_latency_ms}ms)`);
    }

    const shadowWarn = log.warns.filter((m) => /PCFSoftShadowMap/.test(m));
    ok(shadowWarn.length === 0, `${tag} 沒有 PCFSoftShadowMap 已移除的 warning${shadowWarn.length ? `（${shadowWarn[0]}）` : ''}`);
    ok(log.pageerrors.length === 0, `${tag} 無 uncaught exception (${log.pageerrors.join('; ')})`);
    ok(log.errors.length === 0, `${tag} 無 console.error (${log.errors.join('; ')})`);
    ok(log.external.length === 0, `${tag} 零外部網路請求 (${log.external.join('; ')})`);
  } finally {
    await browser.close();
  }
}

if (fail > 0) {
  console.error(`\n驗收失敗：共 ${fail} 項未通過`);
  process.exit(1);
} else {
  console.log('\n全部驗收項目通過！');
}
