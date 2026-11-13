import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = path.resolve(HERE, '..');
const HTMLS_ROOT = path.resolve(GAME_DIR, '../..');
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(HTMLS_ROOT, 'games/283-late-checkout/node_modules/playwright-core'));

const SHOT_DIR = '/tmp/284-accept';
fs.mkdirSync(SHOT_DIR, { recursive: true });

const PORT = parseInt(process.env.PORT || '18284', 10);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const WRITE_THUMB = process.argv.includes('--write-thumb');
const FFMPEG = process.env.FFMPEG_BIN || '/opt/homebrew/bin/ffmpeg';

let failed = 0;
function check(label, cond, detail = '') {
  const mark = cond ? 'PASS' : 'FAIL';
  if (!cond) failed++;
  console.log(`[${mark}] ${label}${detail ? ' — ' + detail : ''}`);
}

async function startServer() {
  const proc = spawn(process.execPath, ['server/jade-table/server.mjs'], {
    cwd: HTMLS_ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  proc.stdout.on('data', d => { logs += d; });
  proc.stderr.on('data', d => { logs += d; });

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${ORIGIN}/favicon.svg`);
      if (r.ok) return proc;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 150));
  }
  proc.kill('SIGTERM');
  throw new Error(`Server failed to start on ${PORT}: ${logs}`);
}

async function openContext(browser, width, height, mobile) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    hasTouch: !!mobile,
    isMobile: !!mobile,
  });
  const page = await ctx.newPage();
  const log = { errors: [], http4xx: [], external: [], warnings: [] };
  page.on('pageerror', e => log.errors.push(`pageerror: ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error') log.errors.push(`console.error: ${m.text()}`);
    else if (m.type() === 'warning') log.warnings.push(m.text());
  });
  page.on('response', r => {
    if (r.status() >= 400) log.http4xx.push(`${r.status()} ${r.url()}`);
  });
  page.on('request', r => {
    const u = r.url();
    if (!u.startsWith(ORIGIN) && !u.startsWith('data:') && !u.startsWith('blob:')) {
      log.external.push(u);
    }
  });
  page.on('dialog', d => d.accept());
  await page.goto(`${ORIGIN}/web/284-lineage-life.html`, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  return { ctx, page, log };
}

async function createKnightAndEnter(page) {
  await page.click('#btn-start-menu');
  await page.waitForTimeout(450);
  await page.click('#load-btn-create');
  await page.waitForTimeout(450);
  await page.click('#btn-class-base-knight');
  await page.waitForTimeout(300);

  // Allocate all remaining points round-robin across stats (capped at 20 each) until #btn-start is enabled
  const statBtns = ['.stat-str button:last-of-type', '.stat-con button:last-of-type', '.stat-dex button:last-of-type', '.stat-wis button:last-of-type'];
  for (let i = 0; i < 24; i++) {
    const dis = await page.$eval('#btn-start', b => b.disabled);
    if (!dis) break;
    await page.click(statBtns[i % statBtns.length]);
    await page.waitForTimeout(50);
  }
  const canStart = await page.$eval('#btn-start', b => !b.disabled);
  if (!canStart) throw new Error('#btn-start stayed disabled after allocating STR');
  await page.click('#btn-start');
  await page.waitForSelector('#game-screen:not(.hidden)', { timeout: 5000 });
  await page.waitForTimeout(900);
}

const serverProc = await startServer();
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});

try {
  // ===== 1. Desktop 1440x900 =====
  {
    const { ctx, page, log } = await openContext(browser, 1440, 900, false);
    const hasVp = await page.evaluate(() => !!document.querySelector('meta[name=viewport]'));
    check('桌機：viewport meta 存在', hasVp);

    const loginInfo = await page.evaluate(() => {
      const bg = document.getElementById('login-bg-image');
      const anim = document.getElementById('login-anim-image');
      const ver = document.getElementById('login-version');
      const notes = document.getElementById('login-update-notes');
      const h1 = document.querySelector('#login-title-layer h1');
      return {
        bgOk: bg && bg.complete && bg.naturalWidth > 0,
        animOk: anim && anim.complete && anim.naturalWidth > 0,
        verText: ver ? ver.textContent.trim() : '',
        notesLen: notes ? notes.children.length : -1,
        title: h1 ? h1.textContent.trim() : '',
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });
    check('桌機：登入頁標題 v1.0、無更新說明、背景與動畫載入',
      loginInfo.bgOk && loginInfo.animOk && loginInfo.verText === 'v1.0' && loginInfo.notesLen === 0 && loginInfo.title.includes('天堂人生'),
      JSON.stringify(loginInfo));
    check('桌機：登入頁無水平溢出', loginInfo.overflow <= 0, `overflow=${loginInfo.overflow}`);
    await page.screenshot({ path: path.join(SHOT_DIR, 'desk-login.png') });

    await page.click('#btn-start-menu');
    await page.waitForTimeout(450);
    const loadOk = await page.evaluate(() => {
      const p = document.getElementById('load-select-panel');
      const bg = document.getElementById('load-select-bg');
      return p && !p.classList.contains('hidden') && bg && bg.complete && bg.naturalWidth > 0;
    });
    check('桌機：選角畫面背景載入正常', loadOk);

    await page.click('#load-btn-create');
    await page.waitForTimeout(450);
    await page.click('#btn-class-base-mage');
    await page.waitForTimeout(300);
    const magePreviewOk = await page.$eval('#class-preview-img', im => im.complete && im.naturalWidth > 0);
    check('桌機：創角切換未快取職業時徽章備援圖正常顯示', magePreviewOk);

    await page.click('#btn-class-base-knight');
    await page.waitForFunction(() => {
      const im = document.getElementById('class-preview-img');
      return im && im.complete && im.naturalWidth > 0 && im.src.includes('/start/m_knight/');
    }, null, { timeout: 3000 }).catch(() => {});
    const knightPreviewInfo = await page.$eval('#class-preview-img', im => ({ ok: im.complete && im.naturalWidth > 0 && im.src.includes('/start/m_knight/'), src: im.src, w: im.naturalWidth }));
    check('桌機：創角切換男騎士動畫預覽正常載入', knightPreviewInfo.ok, JSON.stringify(knightPreviewInfo));
    await page.screenshot({ path: path.join(SHOT_DIR, 'desk-create.png') });

    const deskStatBtns = ['.stat-str button:last-of-type', '.stat-con button:last-of-type', '.stat-dex button:last-of-type', '.stat-wis button:last-of-type'];
    for (let i = 0; i < 24; i++) {
      const dis = await page.$eval('#btn-start', b => b.disabled);
      if (!dis) break;
      await page.click(deskStatBtns[i % deskStatBtns.length]);
      await page.waitForTimeout(50);
    }
    await page.click('#btn-start');
    await page.waitForSelector('#game-screen:not(.hidden)', { timeout: 5000 });
    await page.waitForTimeout(1200);

    const townState = await page.evaluate(() => ({
      gameVisible: !document.getElementById('game-screen').classList.contains('hidden'),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      mapZoneVisible: !!document.getElementById('map-view-panel'),
    }));
    check('桌機：進入主遊戲（冒險地圖主體與 HUD）無水平溢出', townState.gameVisible && townState.overflow <= 0, JSON.stringify(townState));
    await page.screenshot({ path: path.join(SHOT_DIR, 'desk-town.png') });

    // Switch to hunting map via map selector ('training' = 新兵修練場) & verify combat scene
    await page.selectOption('#map-view-panel .panel-header select:last-of-type', 'training');
    await page.waitForTimeout(2200);
    const battleState = await page.evaluate(() => ({
      battleVisible: !document.getElementById('battle-view').classList.contains('hidden'),
      mobsCount: document.querySelectorAll('#battle-view .mob-target').length,
      playerSpriteOk: (() => {
        const imgs = [...document.querySelectorAll('#battle-view img, #player-stage img')];
        return imgs.some(im => im.complete && im.naturalWidth > 0);
      })(),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    check('桌機：戰鬥地圖切換與精靈渲染正常', battleState.battleVisible && battleState.mobsCount > 0 && battleState.playerSpriteOk && battleState.overflow <= 0, JSON.stringify(battleState));
    await page.screenshot({ path: path.join(SHOT_DIR, 'desk-battle.png') });

    // Open drawer tabs (裝備 / 設定) & toggle switches
    await page.click('.tab-bar button[onclick*="automation"]');
    await page.waitForTimeout(350);
    await page.click('#set-vfx-on');
    await page.waitForTimeout(150);
    await page.click('#set-vfxnum-on');
    await page.waitForTimeout(150);
    const settingsState = await page.evaluate(() => ({
      vfxChecked: document.getElementById('set-vfx-on').getAttribute('aria-checked'),
      numChecked: document.getElementById('set-vfxnum-on').getAttribute('aria-checked'),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    check('桌機：設定選單戰鬥特效與傷害數字開關運作正常',
      settingsState.vfxChecked === 'false' && settingsState.numChecked === 'false' && settingsState.overflow <= 0,
      JSON.stringify(settingsState));
    await page.screenshot({ path: path.join(SHOT_DIR, 'desk-settings.png') });
    await page.click('#set-vfx-on');
    await page.click('#set-vfxnum-on');

    await page.click('.tab-bar button[onclick*="equip"]');
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(SHOT_DIR, 'desk-equip.png') });
    await page.click('#right-drawer-close');
    await page.waitForTimeout(250);

    // Optional thumbnail capture from crisp 1280x800 battle view
    if (WRITE_THUMB) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.waitForTimeout(700);
      const rawThumb = path.join(SHOT_DIR, 'thumb-1280x800.png');
      const outThumb = path.join(HTMLS_ROOT, 'thumbs/284.jpg');
      await page.screenshot({ path: rawThumb });
      execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', rawThumb, '-vf', 'scale=640:400:flags=lanczos', '-q:v', '3', outThumb]);
      check('縮圖：thumbs/284.jpg 生成成功', fs.existsSync(outThumb) && fs.statSync(outThumb).size > 10000);
    }

    check('桌機：零 console.error / pageerror', log.errors.length === 0, log.errors.slice(0, 5).join(' | '));
    check('桌機：零 HTTP >= 400 錯誤', log.http4xx.length === 0, log.http4xx.slice(0, 5).join(' | '));
    check('桌機：零外部網路請求', log.external.length === 0, log.external.slice(0, 5).join(' | '));
    await ctx.close();
  }

  // ===== 2. Mobile 390x844 =====
  {
    const { ctx, page, log } = await openContext(browser, 390, 844, true);
    const loginOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check('手機：登入頁無水平溢出', loginOverflow <= 0, `overflow=${loginOverflow}`);
    await page.screenshot({ path: path.join(SHOT_DIR, 'phone-login.png') });

    await createKnightAndEnter(page);
    const playOverflow = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    check('手機：主遊戲畫面無水平溢出', playOverflow.overflow <= 0, JSON.stringify(playOverflow));
    await page.screenshot({ path: path.join(SHOT_DIR, 'phone-town.png') });

    await page.selectOption('#map-view-panel .panel-header select:last-of-type', 'training');
    await page.waitForTimeout(2000);
    const battleOverflow = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    check('手機：戰鬥地圖無水平溢出', battleOverflow.overflow <= 0, JSON.stringify(battleOverflow));
    await page.screenshot({ path: path.join(SHOT_DIR, 'phone-battle.png') });

    await page.click('.tab-bar button[onclick*="automation"]');
    await page.waitForTimeout(350);
    const drawerOverflow = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    check('手機：設定抽屜無水平溢出', drawerOverflow.overflow <= 0, JSON.stringify(drawerOverflow));
    await page.screenshot({ path: path.join(SHOT_DIR, 'phone-settings.png') });

    check('手機：零 console.error / pageerror', log.errors.length === 0, log.errors.slice(0, 5).join(' | '));
    check('手機：零 HTTP >= 400 錯誤', log.http4xx.length === 0, log.http4xx.slice(0, 5).join(' | '));
    check('手機：零外部網路請求', log.external.length === 0, log.external.slice(0, 5).join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
  serverProc.kill('SIGTERM');
}

console.log(`\nSummary: ${failed === 0 ? 'ALL PASSED' : failed + ' FAILED'}`);
process.exit(failed === 0 ? 0 : 1);
