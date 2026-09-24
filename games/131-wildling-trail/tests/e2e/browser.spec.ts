// 瀏覽器驗收：對建置好的單檔 HTML（web/131-wildling-trail.html）操作。
// 先執行 npm run build，再 npm run test:e2e。

import { expect, test, type Page } from '@playwright/test';

type Probe = { mode: string; map?: string; x?: number; y?: number; party?: number; battle?: string | null; phase?: string | null };

async function probe(page: Page): Promise<Probe> {
  return page.evaluate(() => {
    const w = (window as unknown as { __wildling: { app: any } }).__wildling;
    const app = w.app;
    return {
      mode: app.mode,
      map: app.progress?.player.map,
      x: app.progress?.player.x,
      y: app.progress?.player.y,
      party: app.progress?.party.length,
      battle: app.battle?.core.kind ?? null,
      phase: app.battle?.phase ?? null,
    };
  });
}

function watch(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console.error: ${m.text()}`);
  });
  page.on('request', (r) => {
    const url = r.url();
    if (!url.startsWith('http://127.0.0.1') && !url.startsWith('data:') && !url.startsWith('blob:')) problems.push(`外部請求：${url}`);
  });
  return problems;
}

async function noHorizontalOverflow(page: Page): Promise<void> {
  const r = await page.evaluate(() => {
    const offenders: string[] = [];
    const vw = document.documentElement.clientWidth;
    for (const el of document.querySelectorAll<HTMLElement>('#app *')) {
      if (el.closest('[hidden]')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) continue;
      if (rect.right > vw + 1 || rect.left < -1) offenders.push(`${el.tagName}.${el.className}`);
    }
    // 文字不得溢出所在的容器
    for (const el of document.querySelectorAll<HTMLElement>('#sheet .lbl, #sheet .text, #sheet .right, #bbox .lbl, #bbox .right, #bbox .bpick button, .hud .name')) {
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow !== 'ellipsis') offenders.push(`文字溢出 ${el.className}`);
    }
    return { sw: document.documentElement.scrollWidth, vw, offenders };
  });
  expect(r.sw).toBeLessThanOrEqual(r.vw);
  expect(r.offenders).toEqual([]);
}

async function readDialogs(page: Page, press: () => Promise<void>): Promise<void> {
  for (let i = 0; i < 40 && (await probe(page)).mode === 'dialog'; i++) {
    await press();
    await page.waitForTimeout(80);
  }
}

test.describe('桌機 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('鍵盤：開始旅程、教學、選夥伴，走到草叢遇到野生怪獸並逃跑', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/?seed=42');
    await expect(page.locator('meta[name="viewport"]')).toHaveCount(1);
    await page.waitForFunction(() => (window as any).__wildling?.app.mode === 'title');
    await expect(page.locator('#logo')).toBeVisible();
    await noHorizontalOverflow(page);

    await page.keyboard.press('Enter');
    await page.waitForFunction(() => (window as any).__wildling.app.mode === 'dialog');
    await expect(page.locator('#sheet .speaker')).toHaveText('旅行筆記');
    const enter = () => page.keyboard.press('Enter');
    await readDialogs(page, enter);
    expect((await probe(page)).mode).toBe('explore');
    await expect(page.locator('#sheet .goal h2')).toHaveText('和禾老師說話');

    // 按住方向鍵對著禾老師：只會轉身不會穿過去
    await page.keyboard.press('ArrowUp');
    expect((await probe(page)).y).toBe(8);

    await page.keyboard.press('KeyZ');
    await readDialogs(page, enter);
    await expect(page.locator('.starter-grid .card')).toHaveCount(3);
    await noHorizontalOverflow(page);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await readDialogs(page, enter);
    const after = await probe(page);
    expect(after.party).toBe(1);

    // 走到村子北邊出口：左一格、往上八格
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(250);
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(() => (window as any).__wildling.app.progress.player.map === 'route', null, { timeout: 15_000 });
    await page.keyboard.up('ArrowUp');
    await page.waitForFunction(() => (window as any).__wildling.app.mode === 'explore');

    // 在高草叢來回走直到遭遇
    await page.evaluate(() => {
      const app = (window as any).__wildling.app;
      app.p.player = { map: 'route', x: 4, y: 3, facing: 'left' };
    });
    for (let i = 0; i < 80 && !(await probe(page)).battle; i++) {
      await page.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowRight');
      await page.waitForTimeout(200);
    }
    await page.waitForFunction(() => (window as any).__wildling.app.mode === 'battle', null, { timeout: 10_000 });
    await expect(page.locator('#hud-enemy')).toBeVisible();
    // 開場訊息 → 指令
    for (let i = 0; i < 20 && (await probe(page)).phase !== 'command'; i++) {
      await enter();
      await page.waitForTimeout(250);
    }
    await expect(page.locator('#bbox .bpick button')).toHaveCount(4);
    await expect(page.locator('#sheet')).toBeHidden();
    await noHorizontalOverflow(page);
    // 逃跑（右下）
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await enter();
    for (let i = 0; i < 40 && (await probe(page)).mode !== 'explore'; i++) {
      await page.waitForTimeout(250);
      const p = await probe(page);
      if (p.phase === 'command') {
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowRight');
      }
      await enter();
    }
    expect((await probe(page)).mode).toBe('explore');
    expect(problems).toEqual([]);
  });
});

test.describe('手機 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('觸控：按鈕操作、控制區不遮住畫面與手帳、介面不溢出', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/?seed=7');
    await page.waitForFunction(() => (window as any).__wildling?.app.mode === 'title');
    const pad = page.locator('#pad');
    await expect(pad).toBeVisible();

    const box = async (sel: string) => (await page.locator(sel).boundingBox())!;
    const screen = await box('#screen');
    const sheet = await box('#sheet');
    const padBox = await box('#pad');
    expect(screen.y + screen.height).toBeLessThanOrEqual(sheet.y + 1);
    expect(sheet.y + sheet.height).toBeLessThanOrEqual(padBox.y + 1);
    expect(padBox.y + padBox.height).toBeLessThanOrEqual(844);
    await noHorizontalOverflow(page);

    const tapA = () => page.locator('[data-btn="confirm"]').tap();
    await tapA();
    await page.waitForFunction(() => (window as any).__wildling.app.mode === 'dialog');
    await readDialogs(page, tapA);
    expect((await probe(page)).mode).toBe('explore');

    // 十字鍵：往左走一格
    await page.locator('[data-btn="left"]').tap();
    await page.waitForTimeout(300);
    expect((await probe(page)).x).toBe(9);
    await page.locator('[data-btn="right"]').tap();
    await page.waitForTimeout(300);
    await page.locator('[data-btn="up"]').tap();
    await page.waitForTimeout(200);
    await tapA();
    await readDialogs(page, tapA);
    await expect(page.locator('.starter-grid .card')).toHaveCount(3);
    await noHorizontalOverflow(page);
    // 直接點選卡片
    await page.locator('.starter-grid .card').nth(2).tap();
    await page.waitForTimeout(100);
    await readDialogs(page, tapA);
    expect((await probe(page)).party).toBe(1);

    // 選單鍵打開選單，逐一打開每個項目並關閉
    await page.locator('[data-btn="menu"]').tap();
    await expect(page.locator('#sheet .row')).toHaveCount(7);
    for (let i = 0; i < 6; i++) {
      await page.locator('#sheet .row').nth(i).tap();
      await page.waitForTimeout(80);
      await noHorizontalOverflow(page);
      // 存檔項目會直接顯示對話
      await readDialogs(page, tapA);
      if ((await probe(page)).mode === 'menu') await page.locator('[data-btn="cancel"]').tap();
      await readDialogs(page, tapA);
    }
    await page.locator('[data-btn="cancel"]').tap();
    expect((await probe(page)).mode).toBe('explore');
    expect(problems).toEqual([]);
  });

  test('戰鬥：訊息、指令與招式都在畫面框內，畫面不會比探索時小', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/?seed=42');
    await page.waitForFunction(() => (window as any).__wildling?.app.mode === 'title');
    const tapA = () => page.locator('[data-btn="confirm"]').tap();
    await tapA();
    await page.waitForFunction(() => (window as any).__wildling.app.mode === 'dialog');
    await readDialogs(page, tapA);
    expect((await probe(page)).mode).toBe('explore');
    const exploreWidth = (await page.locator('#frame').boundingBox())!.width;
    // 直接給一隻夥伴並站到草叢裡，只測戰鬥版面
    await page.evaluate(() => {
      const app = (window as any).__wildling.app;
      app.p.flags.gotStarter = true;
      app.giveMonster('wickling', 8);
      app.p.player = { map: 'route', x: 4, y: 3, facing: 'left' };
    });
    for (let i = 0; i < 120 && !(await probe(page)).battle; i++) {
      await page.locator(`[data-btn="${i % 2 ? 'left' : 'right'}"]`).tap();
      await page.waitForTimeout(200);
    }
    await page.waitForFunction(() => (window as any).__wildling.app.mode === 'battle', null, { timeout: 10_000 });
    for (let i = 0; i < 20 && (await probe(page)).phase !== 'command'; i++) {
      await tapA();
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(300);

    // 手帳收起，戰鬥框在畫面框裡，畫面框和控制區不重疊
    await expect(page.locator('#sheet')).toBeHidden();
    const frame = (await page.locator('#frame').boundingBox())!;
    const screen = (await page.locator('#screen').boundingBox())!;
    const bbox = (await page.locator('#bbox').boundingBox())!;
    const pad = (await page.locator('#pad').boundingBox())!;
    expect(bbox.y).toBeGreaterThanOrEqual(screen.y + screen.height - 1);
    expect(bbox.y + bbox.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
    expect(frame.y + frame.height).toBeLessThanOrEqual(pad.y + 1);
    expect(frame.width).toBeGreaterThanOrEqual(exploreWidth);
    await expect(page.locator('#bbox .bmsg')).toContainText('要做什麼');
    await expect(page.locator('#bbox .bpick button')).toHaveCount(4);
    await noHorizontalOverflow(page);

    // 點「招式」：左邊 2×2 招式、右邊次數與屬性，十字鍵在格子裡移動
    await page.locator('#bbox .bpick button').first().tap();
    await expect(page.locator('#bbox .bmoves button').first()).toBeVisible();
    await expect(page.locator('#bbox .binfo')).toContainText('次數');
    await noHorizontalOverflow(page);
    const count = await page.locator('#bbox .bmoves button').count();
    if (count >= 2) {
      await page.locator('[data-btn="right"]').tap();
      await expect(page.locator('#bbox .bmoves button').nth(1)).toHaveClass(/sel/);
    }
    // 取消回到指令，再打開背包：清單蓋滿整個畫面框
    await page.locator('[data-btn="cancel"]').tap();
    await expect(page.locator('#bbox .bpick button')).toHaveCount(4);
    await page.locator('#bbox .bpick button').nth(1).tap();
    await expect(page.locator('#bbox .bover .row')).not.toHaveCount(0);
    const overlay = (await page.locator('#bbox .bover').boundingBox())!;
    expect(Math.abs(overlay.height - frame.height)).toBeLessThanOrEqual(2);
    expect(Math.abs((await page.locator('#frame').boundingBox())!.height - frame.height)).toBeLessThanOrEqual(1);
    await noHorizontalOverflow(page);
    await page.locator('[data-btn="cancel"]').tap();
    await expect(page.locator('#bbox')).not.toHaveClass(/overlay/);

    // 出招後訊息在戰鬥框內逐句顯示，點一下前進
    await page.locator('#bbox .bpick button').first().tap();
    await page.locator('#bbox .bmoves button').first().tap();
    await page.waitForFunction(() => (window as any).__wildling.app.battle?.phase !== 'panel');
    await expect(page.locator('#bbox .bmsg')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('損壞的存檔：顯示原因與重新開始，不會白畫面', async ({ page }) => {
    const problems = watch(page);
    await page.addInitScript(() => localStorage.setItem('wildling-trail.save', '{"version":1,"savedAt":1,"progress":{"oops":true}}'));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).__wildling?.app.mode === 'title');
    await expect(page.locator('#sheet .detail h3')).toHaveText('存檔讀取失敗');
    await expect(page.locator('#sheet .row').first()).toContainText('重新開始');
    await page.locator('[data-btn="confirm"]').tap();
    await page.waitForFunction(() => (window as any).__wildling.app.mode === 'dialog');
    const backup = await page.evaluate(() => localStorage.getItem('wildling-trail.save.corrupt'));
    expect(backup).toContain('oops');
    expect(problems).toEqual([]);
  });
});
