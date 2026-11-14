// 實機驗收與全視圖互動測試腳本（Playwright Headless Chrome）
// 1. 檢查 5 種視窗尺寸（1440x900, 1280x600, 1024x768, 844x390, 390x844）零水平溢出與零報錯
// 2. 驗證遊戲大廳（4:3 登入 -> 8 槽位選角 -> 8 職業創角擲骰 -> 進入說話之島 Canvas 與地圖 0/7ff88000.json.gz 解壓縮）
// 3. 驗證全部 9 個視圖（/、/official、/guide 243 筆攻略與對話檢索、/form 論壇發文回覆、/rice 骰子模擬、/topup 儲值簽章與雙重領取防護、/gm 控制台、/privacy、/privacy2）
// 4. 產出網站代表縮圖 thumbs/286.jpg (640x400)

import { chromium } from 'playwright-core';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLineageServer } from '../../../server/lineage-web/server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(gameRoot, '../..');
const thumbOut = path.join(repoRoot, 'thumbs/286.jpg');
const scratchDir =
  '/Users/tommy/.gemini/antigravity-cli/brain/8e501d1b-38ea-4bdf-b9d7-dce616d6e8f4/scratch';

fs.mkdirSync(scratchDir, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.cur': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.bin': 'application/octet-stream',
  '.gz': 'application/octet-stream',
};

function assert(cond, msg) {
  if (!cond) {
    throw new Error(`ACCEPTANCE FAILED: ${msg}`);
  }
}

function findChromeExecutable() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    process.env.CHROME_PATH,
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

const lineage = createLineageServer();

async function dispatchInMemoryRequest(urlObj, method, headers, bodyBuffer) {
  const req = new EventEmitter();
  req.url = urlObj.pathname + urlObj.search;
  req.method = method || 'GET';
  req.headers = {
    host: urlObj.host,
    origin: urlObj.origin,
    ...headers,
  };
  if (bodyBuffer && bodyBuffer.length > 0) {
    req.body = bodyBuffer.toString('utf8');
  }

  let statusCode = 200;
  const resHeaders = {};
  const chunks = [];

  const res = {
    writeHead(code, h = {}) {
      statusCode = code;
      for (const [k, v] of Object.entries(h)) {
        resHeaders[k.toLowerCase()] = String(v);
      }
    },
    setHeader(k, v) {
      resHeaders[k.toLowerCase()] = String(v);
    },
    end(payload) {
      if (payload !== undefined && payload !== null) {
        chunks.push(Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload)));
      }
    },
  };

  const handled = await lineage.handle(req, res);
  if (handled) {
    return {
      status: statusCode,
      headers: resHeaders,
      body: Buffer.concat(chunks),
    };
  }

  const urlPath = decodeURIComponent(urlObj.pathname);
  if (urlPath === '/favicon.ico') {
    return { status: 204, headers: {}, body: Buffer.alloc(0) };
  }
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(repoRoot, rel);
  if (!filePath.startsWith(repoRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: Buffer.from(`Not found: ${urlPath}`),
    };
  }
  const ext = path.extname(filePath).toLowerCase();
  const isGz = filePath.endsWith('.json.gz');
  return {
    status: 200,
    headers: {
      'content-type': isGz ? 'application/octet-stream' : MIME[ext] || 'application/octet-stream',
      'cache-control': 'public, max-age=3600',
    },
    body: fs.readFileSync(filePath),
  };
}

async function startServerOrRouteOrigin() {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        const handled = await lineage.handle(req, res);
        if (handled) return;
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        if (urlPath === '/favicon.ico') {
          res.writeHead(204);
          res.end();
          return;
        }
        const rel = urlPath === '/' ? '/index.html' : urlPath;
        const filePath = path.join(repoRoot, rel);
        if (!filePath.startsWith(repoRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } catch (err) {
        res.writeHead(500);
        res.end(String(err));
      }
    });

    const makeRouteAttacher = (baseOrigin) => async (context) => {
      await context.route(`${baseOrigin}/**`, async (route) => {
        const req = route.request();
        const urlObj = new URL(req.url());
        const postBuf = req.postDataBuffer();
        const result = await dispatchInMemoryRequest(
          urlObj,
          req.method(),
          req.headers(),
          postBuf
        );
        await route.fulfill({
          status: result.status,
          headers: result.headers,
          body: result.body,
        });
      });
    };

    server.on('error', () => {
      const baseOrigin = 'http://127.0.0.1:18286';
      resolve({
        server: null,
        baseOrigin,
        attachContext: makeRouteAttacher(baseOrigin),
      });
    });

    server.listen(0, '127.0.0.1', async () => {
      const addr = server.address();
      const baseOrigin = `http://127.0.0.1:${addr.port}`;
      let loopbackReachable = false;
      try {
        const probe = await fetch(`${baseOrigin}/favicon.ico`);
        loopbackReachable = probe.status === 204;
      } catch {
        loopbackReachable = false;
      }
      resolve({
        server,
        baseOrigin,
        attachContext: loopbackReachable ? async () => {} : makeRouteAttacher(baseOrigin),
      });
    });
  });
}

const { server, baseOrigin, attachContext } = await startServerOrRouteOrigin();
const pageUrl = `${baseOrigin}/web/286-lineage-web.html`;

const executablePath = findChromeExecutable();
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--autoplay-policy=no-user-gesture-required'],
});

const consoleErrors = [];
const pageErrors = [];
const externalRequests = [];
const badResponses = [];
const recordedAssetRequests = [];

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  await attachContext(context);

  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    console.error('PAGEERROR:', err);
    pageErrors.push(String(err));
  });
  page.on('request', (req) => {
    const u = req.url();
    if (
      !u.startsWith(`${baseOrigin}/`) &&
      !u.startsWith('file://') &&
      !u.startsWith('data:') &&
      !u.startsWith('blob:')
    ) {
      externalRequests.push(u);
    }
    if (u.startsWith(`${baseOrigin}/assets/286/`)) {
      const headers = req.headers();
      recordedAssetRequests.push({ url: u, range: headers.range || '' });
    }
  });
  page.on('response', (res) => {
    const status = res.status();
    const u = res.url();
    if (status >= 400 && !u.endsWith('/favicon.ico')) {
      badResponses.push(`${status} ${u}`);
    }
  });

  console.log(`Opening ${pageUrl} ...`);
  await page.goto(pageUrl, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__lineage && window.__lineage.ready === true, null, {
    timeout: 15000,
  });
  await page.waitForTimeout(300);

  // 1. 檢查 5 種視窗尺寸零水平溢出
  const viewports = [
    { width: 1440, height: 900, name: 'desktop-1440x900' },
    { width: 1280, height: 600, name: 'laptop-1280x600' },
    { width: 1024, height: 768, name: 'tablet-1024x768' },
    { width: 844, height: 390, name: 'mobile-landscape-844x390' },
    { width: 390, height: 844, name: 'mobile-portrait-390x844' },
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(100);
    const layout = await page.evaluate(() => ({
      hasViewportMeta: !!document.querySelector('meta[name="viewport"]'),
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    assert(layout.hasViewportMeta, `Missing <meta name="viewport"> on ${vp.name}`);
    assert(
      layout.scrollWidth <= layout.innerWidth,
      `Horizontal overflow on ${vp.name}: scrollWidth=${layout.scrollWidth} > innerWidth=${layout.innerWidth}`
    );
  }

  // 切回 1440x900 測試完整大廳登入 -> 選角 -> 8 職業創角 -> 說話之島遊戲舞台流程
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(150);

  // (a) 驗證 4:3 登入舞台與動畫影格載入
  const loginImgHandle = await page.waitForFunction(
    () => {
      const bg = document.getElementById('login-bg-image');
      const img = document.getElementById('login-anim-image');
      return Boolean(bg && bg.complete && bg.naturalWidth > 0 && img && img.complete && img.naturalWidth > 0);
    },
    null,
    { timeout: 6000 }
  );
  const loginImgOk = await loginImgHandle.jsonValue();
  assert(loginImgOk, 'Login animation frame image should load with naturalWidth > 0');

  await page.fill('#login-username', 'adventurer01');
  await page.fill('#login-password', 'pass1234');
  await page.click('#btn-auth-register');
  await page.waitForTimeout(250);

  let st = await page.evaluate(() => window.__lineage.getState());
  assert(st.stage === 'select', `Expected stage 'select' after login, got '${st.stage}'`);
  assert(
    st.charactersCount === 0,
    `Newly registered account must have 0 characters (no default test character), got ${st.charactersCount}`
  );

  // 先在 slot 2 塞入一筆舊角色殘留的 Lv.12 localStorage 存檔，驗證創角後不會誤讀舊存檔而變成非 Lv.1
  await page.evaluate(() => {
    localStorage.setItem(
      'll286:adventurer01:world_slot_2',
      JSON.stringify({ charName: '殘留測試角色', level: 12, exp: 32000, hp: 168, maxHp: 168 })
    );
  });

  // (b) 選取空槽位 (Slot 2) 進入 8 職業創角畫面
  await page.click('[data-slot="2"]');
  await page.waitForTimeout(80);
  await page.click('#load-btn-create');
  await page.waitForTimeout(150);

  st = await page.evaluate(() => window.__lineage.getState());
  assert(st.stage === 'create', `Expected stage 'create', got '${st.stage}'`);

  // 巡覽職業、配點並建立角色
  for (const classId of ['royal', 'elf', 'mage', 'dark', 'knight']) {
    await page.click(`[data-class-id="${classId}"]`);
    await page.waitForTimeout(40);
  }
  // 騎士獎勵點數為 4 點（STR +2 至 18、CON +2 至 16）後即可按「開始遊戲」
  for (let i = 0; i < 2; i += 1) {
    await page.click('[data-stat-inc="str"]');
    await page.click('[data-stat-inc="con"]');
  }
  await page.fill('#create-char-name', '亞丁銀騎士');
  await page.click('#btn-start');
  await page.waitForTimeout(250);

  st = await page.evaluate(() => window.__lineage.getState());
  assert(st.stage === 'select', `Expected stage 'select' after character creation, got '${st.stage}'`);
  assert(st.charactersCount === 1, `Expected 1 character after creation, got ${st.charactersCount}`);
  const selectLvText = await page.textContent('#load-info-lv');
  assert(selectLvText?.trim() === '1', `Newly created character in select screen must be Lv.1, got '${selectLvText}'`);

  // (c) 進入說話之島：原生 1.63 等距天堂實境客戶端，角色與倉庫存檔隔離在 ll286:<user>: 前綴下
  await page.evaluate(() => localStorage.setItem('lineage_idle_save_2', 'USER-OWN-284-SAVE'));
  const enterSlot = st.selectedSlot;
  await page.click('#load-btn-enter');
  try {
    await page.waitForFunction(
      () => {
        const g = window.__lineage.game?.();
        return window.__lineage.getState().gameFrame?.status === 'ready' && g && g.readyChunks >= 1 && g.imagesLoaded >= 2;
      },
      null,
      { timeout: 12000 }
    );
  } catch (err) {
    const diag = await page.evaluate(() => window.__lineage.getState());
    throw new Error(
      `Game ready wait failed: ${err.message} | state=${JSON.stringify(diag)} | badResponses=${JSON.stringify(badResponses.slice(0, 10))} | consoleErrors=${JSON.stringify(consoleErrors.slice(0, 10))}`
    );
  }
  await page.waitForTimeout(1200);

  st = await page.evaluate(() => window.__lineage.getState());
  assert(st.stage === 'game', `Expected stage 'game', got '${st.stage}'`);
  assert(st.gameFrame.mode === 'create', `First entry should create the 286 world save, got ${st.gameFrame.mode}`);
  assert(
    st.mapChunkStatus.includes('7ff88000.json.gz') || st.mapChunkStatus.includes('就緒'),
    `Unexpected mapChunkStatus: ${st.mapChunkStatus}`
  );
  const inGame = await page.evaluate((slot) => {
    const snap = window.__lineage.game();
    const c = document.getElementById('ll-canvas');
    const ctx = c?.getContext('2d');
    const px = ctx ? ctx.getImageData(Math.floor(c.width / 2) - 40, Math.floor(c.height / 2) - 40, 80, 80).data : [];
    let nonDark = 0;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] + px[i + 1] + px[i + 2] > 30) nonDark += 1;
    }
    return {
      visible: Boolean(document.getElementById('ll-game-root') && c && c.width > 300),
      nonDarkPixels: nonDark,
      snap,
      userSave: localStorage.getItem('lineage_idle_save_2'),
      nsSave: Boolean(
        localStorage.getItem(`ll286:${window.__lineage.getState().username.toLowerCase()}:world_slot_${slot}`)
      ),
    };
  }, enterSlot);
  assert(inGame.visible, 'Native isometric game root and canvas should be visible');
  assert(
    inGame.snap.level === 1,
    `Newly created character entering game must start at Lv.1, got Lv.${inGame.snap.level}`
  );
  assert(inGame.nonDarkPixels > 200, `Canvas appears blank near center (${inGame.nonDarkPixels} lit pixels)`);
  assert(inGame.snap.npcsCount > 5, `Expected village NPCs on Talking Island, got ${inGame.snap.npcsCount}`);
  assert(inGame.snap.mobsCount > 10, `Expected Talking Island monsters, got ${inGame.snap.mobsCount}`);
  assert(inGame.userSave === 'USER-OWN-284-SAVE', 'User 284 save must not be touched by 286');
  assert(inGame.nsSave, 'Game world save should be written under the ll286: prefix');
  await page.screenshot({ path: path.join(scratchDir, 'lineage-game-stage.png') });

  // 驗證底部日誌文字未裁切、聊天/指令輸入列、以及狀態紙娃娃／魔法書／背包視窗
  await page.fill('[data-role="chat-input"]', '/loc');
  await page.press('[data-role="chat-input"]', 'Enter');
  await page.waitForTimeout(150);
  const hudCheck = await page.evaluate(() => {
    const lines = [...document.querySelectorAll('.ll-log-line')];
    const minHeight = lines.reduce((acc, el) => Math.min(acc, el.getBoundingClientRect().height), 999);
    const logText = document.querySelector('[data-role="log-box"]')?.textContent || '';
    const logBeforeH = document.querySelector('.ll-log-col')?.getBoundingClientRect().height || 0;
    const radarRect = document.querySelector('[data-role="radar-canvas"]')?.getBoundingClientRect();
    const radarCardRect = document.querySelector('.ll-tr-cluster')?.getBoundingClientRect();
    const tlToolbarRect = document.querySelector('[data-role="tl-toolbar"]')?.getBoundingClientRect();
    const expRect = document.querySelector('.ll-exp-footer')?.getBoundingClientRect();
    const consoleRect = document.querySelector('.ll-center-console')?.getBoundingClientRect();
    const tlInBottomHud = Boolean(document.querySelector('#ll-hud-bottom .ll-br-dock [data-role="tl-toolbar"]'));
    return {
      count: lines.length,
      minHeight,
      logText,
      logBeforeH,
      radarW: radarRect?.width || 0,
      radarCardRight: radarCardRect?.right || 0,
      radarCardTop: radarCardRect?.top ?? 999,
      tlToolbarLeft: tlToolbarRect?.left || 0,
      tlToolbarBottom: tlToolbarRect?.bottom || 0,
      tlInBottomHud,
      expW: expRect?.width || 0,
      consoleCenterDiff: consoleRect ? Math.abs(consoleRect.left + consoleRect.width / 2 - window.innerWidth / 2) : 999,
      vw: window.innerWidth,
      vh: window.innerHeight,
    };
  });
  assert(hudCheck.count >= 1 && hudCheck.minHeight >= 14, `Log line vertically clipped: ${JSON.stringify(hudCheck)}`);
  assert(hudCheck.logText.includes('目前座標'), `Chat /loc command should append location log, got: ${hudCheck.logText}`);
  assert(hudCheck.radarW >= 120, `Top-right minimap radar should render on desktop, got width=${hudCheck.radarW}`);
  assert(
    hudCheck.tlInBottomHud
      && hudCheck.tlToolbarLeft >= hudCheck.vw * 0.45
      && hudCheck.tlToolbarBottom >= hudCheck.vh * 0.75
      && hudCheck.radarCardRight >= hudCheck.vw * 0.75
      && hudCheck.radarCardTop <= 40,
    `Bottom-right status/toolbar or top-right radar alignment wrong: ${JSON.stringify(hudCheck)}`
  );
  assert(hudCheck.expW >= 1400, `Bottom EXP footer should span full viewport, got width=${hudCheck.expW}`);
  assert(hudCheck.consoleCenterDiff <= 140, `Center console should stay horizontally centered, diff=${hudCheck.consoleCenterDiff}`);

  const borderlessPanels = await page.evaluate(() => {
    const selectors = ['.ll-radar-card', '.ll-acc-item', '.ll-chat-col', '.ll-center-console', '.ll-tl-toolbar', '.ll-play-btn'];
    return selectors.map((sel) => {
      const el = document.querySelector(sel);
      const cs = el ? getComputedStyle(el) : null;
      return {
        sel,
        exists: Boolean(el),
        bt: cs?.borderTopWidth || null,
        br: cs?.borderRightWidth || null,
        bb: cs?.borderBottomWidth || null,
        bl: cs?.borderLeftWidth || null,
      };
    });
  });
  assert(
    borderlessPanels.every((p) => p.exists && p.bt === '0px' && p.br === '0px' && p.bb === '0px' && p.bl === '0px'),
    `Expected clean borderless HUD panels: ${JSON.stringify(borderlessPanels)}`
  );
  await page.screenshot({ path: path.join(scratchDir, 'lineage-game-hud.png') });

  // 驗證右下工具列可正常收合展開
  await page.click('[data-act="toggle-tl"]');
  const collapsedOk = await page.evaluate(() => ({
    hasClass: Boolean(document.querySelector('[data-role="tl-toolbar"]')?.classList.contains('collapsed')),
    chevron: document.querySelector('[data-act="toggle-tl"]')?.textContent?.trim(),
  }));
  assert(collapsedOk.hasClass && collapsedOk.chevron === '‹', `Collapse toggle failed: ${JSON.stringify(collapsedOk)}`);
  await page.click('[data-act="toggle-tl"]');

  await page.click('[data-act-chat="toggle-expand"]');
  await page.waitForTimeout(220);
  const expandedH = await page.evaluate(() => document.querySelector('.ll-log-col')?.getBoundingClientRect().height || 0);
  assert(expandedH > hudCheck.logBeforeH + 30, `Chat expand should increase log height (${hudCheck.logBeforeH} -> ${expandedH})`);
  await page.click('[data-act-chat="toggle-expand"]');
  await page.waitForTimeout(180);

  // 互動驗證：木人訓練 (Lv.1)、角色狀態(S)、魔法書(K)、道具／裝備(I)、內掛切換
  const dummyCheck = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    const dummy = w.npcs.find((n) => n.type === 'TrainingDummy');
    if (!dummy) return { found: false };
    const beforeExp = w.player.exp;
    w.teleportTo(dummy.map, dummy.x, dummy.y + 1, 0);
    const modalRet = w.interactOrWalkToNpc(dummy);
    eng.hud.sync(true);
    return {
      found: true,
      openedNpc: Boolean(modalRet) || eng.hud.activeModal === 'npc',
      beforeExp,
      afterExp: w.player.exp,
      dummyAnim: dummy.animState,
    };
  });
  assert(dummyCheck.found, 'Expected at least one TrainingDummy (木人) NPC on map 0');
  assert(!dummyCheck.openedNpc, 'Interacting with TrainingDummy should NOT open NPC dialog');
  assert(
    dummyCheck.afterExp > dummyCheck.beforeExp,
    `Lv.1 hitting TrainingDummy should gain EXP (${dummyCheck.beforeExp} -> ${dummyCheck.afterExp})`
  );

  await page.keyboard.press('KeyS');
  await page.waitForTimeout(180);
  const statusUiCheck = await page.evaluate(() => {
    const win = document.querySelector('.ll-win');
    const cs = win ? getComputedStyle(win) : null;
    return {
      modal: window.__lineage.game()?.activeModal,
      dollSlots: document.querySelectorAll('.ll-doll-stage .ll-doll-grid .ll-doll-slot').length,
      equippedSlots: document.querySelectorAll('.ll-doll-slot.equipped').length,
      hasSlateStats: Boolean(document.querySelector('.ll-status-slate')),
      winBorderWidth: cs?.borderTopWidth || null,
      winBorderColor: cs?.borderTopColor || null,
    };
  });
  assert(
    statusUiCheck.modal === 'status' &&
      statusUiCheck.dollSlots === 11 &&
      statusUiCheck.equippedSlots >= 1 &&
      statusUiCheck.hasSlateStats &&
      statusUiCheck.winBorderWidth === '2px' &&
      statusUiCheck.winBorderColor === 'rgb(72, 70, 66)',
    `Classic status & paperdoll layout mismatch: ${JSON.stringify(statusUiCheck)}`
  );
  await page.screenshot({ path: path.join(scratchDir, 'lineage-game-status.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);

  await page.keyboard.press('KeyK');
  await page.waitForTimeout(150);
  const spellUiCheck = await page.evaluate(() => ({
    modal: window.__lineage.game()?.activeModal,
    gridCells: document.querySelectorAll('.ll-spell-grid-5col .ll-spell-cell').length,
    fSockets: document.querySelectorAll('.ll-f9-tray .ll-f9-socket').length,
    hasFooterStats: Boolean(document.querySelector('.ll-spell-footer .ll-stat-pill-classic')),
  }));
  assert(
    spellUiCheck.modal === 'spells' && spellUiCheck.gridCells >= 20 && spellUiCheck.fSockets === 4 && spellUiCheck.hasFooterStats,
    `Classic spellbook grid layout mismatch: ${JSON.stringify(spellUiCheck)}`
  );
  await page.screenshot({ path: path.join(scratchDir, 'lineage-game-spells.png') });
  await page.click('[data-spell-view="list"]');
  await page.waitForTimeout(100);
  assert(Boolean(await page.$('.ll-spell-list-box')), 'Switching spell view to list should render .ll-spell-list-box');
  await page.click('[data-spell-view="grid"]');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);

  await page.keyboard.press('KeyI');
  await page.waitForTimeout(200);
  const invUiCheck = await page.evaluate(() => ({
    modal: window.__lineage.game()?.activeModal,
    totalSlots: document.querySelectorAll('.ll-inv-grid-4col .ll-inv-slot').length,
    onBadges: document.querySelectorAll('.ll-inv-slot .ll-slot-on').length,
    tooltipText: document.querySelector('.ll-classic-tooltip')?.textContent || '',
    tools: document.querySelectorAll('.ll-bag-footer .ll-inv-tool').length,
  }));
  assert(
    invUiCheck.modal === 'inventory' &&
      invUiCheck.totalSlots >= 24 &&
      invUiCheck.onBadges >= 1 &&
      invUiCheck.tooltipText.includes('重量') &&
      invUiCheck.tools >= 6,
    `Classic 4x6 inventory UI mismatch: ${JSON.stringify(invUiCheck)}`
  );
  await page.screenshot({ path: path.join(scratchDir, 'lineage-game-inventory.png') });
  await page.click('[data-inv-filter="gear"]');
  await page.waitForTimeout(80);
  const gearCount = await page.evaluate(() => document.querySelectorAll('.ll-inv-grid-4col .ll-inv-slot:not(.empty)').length);
  await page.click('[data-inv-filter="all"]');
  await page.waitForTimeout(80);
  const allCount = await page.evaluate(() => document.querySelectorAll('.ll-inv-grid-4col .ll-inv-slot:not(.empty)').length);
  assert(gearCount >= 1 && allCount >= gearCount, `Inventory filter toggle failed: gear=${gearCount}, all=${allCount}`);
  await page.click('[data-toggle-lock]');
  await page.waitForTimeout(80);
  assert(Boolean(await page.$('.ll-inv-slot .ll-slot-lock')), 'Lock button should toggle .ll-slot-lock badge on selected item');
  await page.click('[data-toggle-lock]');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);

  await page.keyboard.press('KeyH');
  await page.waitForTimeout(250);
  assert(
    await page.evaluate(() => window.__lineage.game()?.autoEnabled === true),
    'Pressing KeyH should toggle Auto-Hunt ON'
  );
  await page.keyboard.press('KeyH');
  await page.waitForTimeout(150);

  for (const vp of [
    { width: 1024, height: 768 },
    { width: 844, height: 390 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(200);
    for (const modalKey of [null, 'KeyI', 'KeyK', 'KeyS']) {
      if (modalKey) {
        await page.keyboard.press(modalKey);
        await page.waitForTimeout(140);
      }
      const vpLayout = await page.evaluate(() => {
        const win = document.querySelector('.ll-win');
        const rect = win ? win.getBoundingClientRect() : null;
        return {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          winRight: rect ? Math.round(rect.right) : 0,
          winBottom: rect ? Math.round(rect.bottom) : 0,
        };
      });
      assert(
        vpLayout.scrollWidth <= vpLayout.innerWidth && vpLayout.winRight <= vp.width + 1 && vpLayout.winBottom <= vp.height + 1,
        `Modal/HUD overflow (${modalKey || 'hud'}) on ${vp.width}x${vp.height}: ${JSON.stringify(vpLayout)}`
      );
      if (modalKey) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
      }
    }
  }
  await page.screenshot({ path: path.join(scratchDir, 'lineage-game-mobile.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(150);

  // 透過系統選單回選角大廳，再進同一角色要走讀檔
  await page.click('[data-win="system"]');
  await page.waitForTimeout(150);
  await page.click('[data-sys-act="lobby"]');
  await page.waitForTimeout(300);
  st = await page.evaluate(() => window.__lineage.getState());
  assert(st.stage === 'select' && !st.gameFrame, `Expected back on select cleanly, got ${st.stage}`);
  await page.click('#load-btn-enter');
  await page.waitForFunction(() => window.__lineage.getState().gameFrame?.status === 'ready', null, {
    timeout: 30000,
  });
  st = await page.evaluate(() => window.__lineage.getState());
  assert(st.gameFrame.mode === 'load', `Re-entry should load the 286 world save, got ${st.gameFrame.mode}`);

  // 驗證匯入角色至 Slot 1，並測試重新整理頁面、重新登入後同一角色的遊戲進度完整保留（不可被重建成新角色）。
  await page.click('[data-win="system"]');
  await page.waitForTimeout(120);
  await page.click('[data-sys-act="lobby"]');
  await page.waitForTimeout(300);
  await page.click('[data-slot="1"]');
  await page.waitForTimeout(80);
  await page.click('#load-btn-import');
  await page.waitForTimeout(80);
  await page.fill(
    '#import-json-textarea',
    JSON.stringify({ name: '遠征騎士', classId: 'knight', level: 12, adena: 12500 })
  );
  await page.click('#modal-confirm-import-btn');
  await page.waitForTimeout(200);
  await page.click('#load-btn-enter');
  await page.waitForFunction(() => window.__lineage.getState().gameFrame?.status === 'ready', null, {
    timeout: 30000,
  });
  await page.evaluate(() => {
    const eng = window.__lineage.engine();
    eng.world.player.gold = 424242;
    eng.world.dirtySave = true;
    eng.world.saveWorld(true);
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__lineage && window.__lineage.ready === true, null, { timeout: 15000 });
  await page.fill('#login-username', 'adventurer01');
  await page.fill('#login-password', 'pass1234');
  await page.click('#btn-quick-start');
  await page.waitForFunction(() => window.__lineage.getState().stage === 'select', null, { timeout: 10000 });
  await page.click('[data-slot="1"]');
  await page.waitForTimeout(80);
  await page.click('#load-btn-enter');
  await page.waitForFunction(() => window.__lineage.getState().gameFrame?.status === 'ready', null, {
    timeout: 30000,
  });
  st = await page.evaluate(() => window.__lineage.getState());
  assert(st.gameFrame.mode === 'load', `After reload the 286 world save should load, got ${st.gameFrame.mode}`);
  const lv12ExpState = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    const before = {
      level: w.player.level,
      exp: w.player.exp,
      expPrev: w.player.expPrev,
      expNext: w.player.expNext,
      expText: document.querySelector('[data-role="exp-text"]')?.textContent || '',
    };
    // 驗證 Lv.12 預設角擊殺怪物後經驗百分比確實上升而非卡死 0.00%
    const mob = w.mobs.find((m) => m.hp > 0 && m.exp > 0);
    if (mob) {
      w.player.exp += Math.max(85, mob.exp * 3);
      w.recomputePlayerStats();
    }
    eng.hud.sync(true);
    return {
      before,
      afterExp: w.player.exp,
      afterText: document.querySelector('[data-role="exp-text"]')?.textContent || '',
      gold: window.__lineage.game()?.gold,
    };
  });
  assert(
    lv12ExpState.before.level >= 12 && lv12ExpState.before.exp >= lv12ExpState.before.expPrev,
    `Lv.12 initial exp must be >= expPrev: ${JSON.stringify(lv12ExpState.before)}`
  );
  assert(
    lv12ExpState.afterText !== '0.00%' && parseFloat(lv12ExpState.afterText) > 0,
    `Expected Lv.12 EXP % to advance above 0.00%, got ${lv12ExpState.afterText}`
  );
  const goldAfterReload = lv12ExpState.gold;
  assert(goldAfterReload === 424242, `Game progress lost after reload: gold=${goldAfterReload}`);

  // 驗證金錢（金幣）不計入負重度
  const goldWeightCheck = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    const savedGold = w.player.gold;
    w.player.gold = 0;
    w.recomputePlayerStats();
    const weightAtZeroGold = w.player.weightPercent;
    w.player.gold = 5000000;
    w.recomputePlayerStats();
    const weightAtRichGold = w.player.weightPercent;
    w.player.gold = savedGold;
    w.recomputePlayerStats();
    eng.hud.sync(true);
    return { weightAtZeroGold, weightAtRichGold };
  });
  assert(
    goldWeightCheck.weightAtZeroGold === goldWeightCheck.weightAtRichGold,
    `Gold must not affect weightPercent: ${JSON.stringify(goldWeightCheck)}`
  );

  // 驗證工坊製作、導師學法、中毒與翡翠藥水／旅店休息、遠程怪物設定及死亡復活懲罰
  const craftReady = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    w.addItemToInventory('皮革', 12);
    w.player.gold = Math.max(w.player.gold, 5000);
    const ladar = w.npcs.find((n) => n.name === '拉達');
    if (!ladar) return { ok: false, reason: 'ladar missing' };
    eng.hud.openNpc(ladar);
    return {
      ok: true,
      mode: eng.hud.npcSession?.mode,
      hasCraftBtn: Boolean(document.querySelector('[data-craft-idx]')),
      leatherBefore: w.player.inventory.filter((i) => i.name === '皮革').reduce((s, i) => s + i.count, 0),
      hardBefore: w.player.inventory.filter((i) => i.name === '高級皮革').reduce((s, i) => s + i.count, 0),
    };
  });
  assert(craftReady.ok && craftReady.mode === 'craft' && craftReady.hasCraftBtn, `Craft modal failed: ${JSON.stringify(craftReady)}`);
  await page.screenshot({ path: path.join(scratchDir, 'lineage-game-craft.png') });
  await page.click('[data-craft-idx="0"]');
  await page.waitForTimeout(120);
  const afterCraft = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    const ret = {
      leatherAfter: w.player.inventory.filter((i) => i.name === '皮革').reduce((s, i) => s + i.count, 0),
      hardAfter: w.player.inventory.filter((i) => i.name === '高級皮革').reduce((s, i) => s + i.count, 0),
    };
    eng.hud.closeModal();
    return ret;
  });
  assert(
    afterCraft.hardAfter === craftReady.hardBefore + 1 && afterCraft.leatherAfter === craftReady.leatherBefore - 10,
    `Craft 高級皮革 inventory mismatch: ${JSON.stringify({ craftReady, afterCraft })}`
  );

  // 魔法導師（吉倫）學法 + 翡翠藥水／旅店解毒 + 死亡復活
  const teachReady = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    w.player.level = Math.max(w.player.level, 12);
    w.player.spells = w.player.spells.filter((id) => id !== 1);
    const gereng = w.npcs.find((n) => n.name === '吉倫');
    if (!gereng) return { ok: false };
    eng.hud.openNpc(gereng);
    return { ok: true };
  });
  assert(teachReady.ok, 'Expected 吉倫 on Talking Island');
  await page.click('[data-npc-mode="teach"]');
  await page.waitForTimeout(100);
  const learnBtnExists = await page.evaluate(() => Boolean(document.querySelector('[data-learn-spell="1"]')));
  assert(learnBtnExists, 'Expected teach modal to render learnable spell #1');
  await page.click('[data-learn-spell="1"]');
  await page.waitForTimeout(100);

  const combatAndInn = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    eng.hud.closeModal();
    const learnedHeal = w.player.spells.includes(1);

    // 毒狀態與翡翠藥水解除
    if (!w.player.inventory.some((i) => i.name === '翡翠藥水')) {
      w.addItemToInventory('翡翠藥水', 1);
    }
    w.player.buffs.poison = performance.now() + 20000;
    eng.hud.sync(true);
    const poisonBadgeVisible = Boolean(document.querySelector('.ll-buff-badge.debuff'));
    const emerald = w.player.inventory.find((i) => i.name === '翡翠藥水');
    if (emerald) w.useItem(emerald.id);
    const poisonClearedByPotion = (w.player.buffs.poison || 0) <= performance.now();

    // 旅店休息（瑟琳娜）解除中毒與補滿體力魔力
    w.player.buffs.poison = performance.now() + 20000;
    w.player.hp = Math.max(1, w.player.hp - 30);
    w.player.mp = Math.max(0, w.player.mp - 5);
    const serena = w.npcs.find((n) => n.name === '瑟琳娜');
    if (serena) w.restAtInn(serena);
    const innRestored = w.player.hp === w.player.maxHp && w.player.mp === w.player.maxMp && (w.player.buffs.poison || 0) <= performance.now();

    // 遠程怪物攻擊範圍確認
    const rangedMob = w.mobs.find((m) => m.attackMode === 'arrow' || m.attackMode === 'spell');

    // 陣亡復活與經驗懲罰不倒扣至前級以下
    const deathRes = w.triggerPlayerDeath('測試陣亡');
    eng.hud.sync(true);

    return {
      learnedHeal,
      poisonBadgeVisible,
      poisonClearedByPotion,
      innRestored,
      rangedMobRange: rangedMob ? rangedMob.range : null,
      deathRes,
      expPrev: w.player.expPrev,
      hpAfterDeath: w.player.hp,
      mapAfterDeath: w.player.map,
    };
  });
  assert(combatAndInn.learnedHeal, 'Should learn spell #1 from 吉倫');
  assert(combatAndInn.poisonBadgeVisible && combatAndInn.poisonClearedByPotion, `Poison badge/cure failed: ${JSON.stringify(combatAndInn)}`);
  assert(combatAndInn.innRestored, `Inn rest should restore HP/MP and cure poison: ${JSON.stringify(combatAndInn)}`);
  assert(combatAndInn.rangedMobRange >= 5, `Expected ranged/caster mob with range >= 5 on map 0, got ${combatAndInn.rangedMobRange}`);
  assert(combatAndInn.deathRes.exp >= combatAndInn.expPrev, `Death EXP penalty must stay >= expPrev: ${JSON.stringify(combatAndInn)}`);
  assert(combatAndInn.mapAfterDeath === 0 && combatAndInn.hpAfterDeath > 0, `Player should revive alive in village: ${JSON.stringify(combatAndInn)}`);

  // 驗證經典法術全套、飢餓系統、多瑪修武、對骷骨卷軸與鑑定／復活卷軸、真實變形
  const spellsAndItems = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    w.player.gold = Math.max(w.player.gold, 25000);
    w.player.level = Math.max(w.player.level, 14);
    for (const sid of [14, 18, 22, 26, 28, 29, 31, 32, 33, 39, 42, 43, 44, 48]) {
      if (!w.player.spells.includes(sid)) w.player.spells.push(sid);
    }
    w.recomputePlayerStats();
    const str0 = w.player.effStr;
    const dex0 = w.player.effDex;
    const mr0 = w.player.mr;
    for (const sid of [14, 26, 31, 32, 42, 43, 48]) {
      w.player.mp = Math.max(w.player.mp, 200);
      w.player.lastSpellAt = 0;
      w.castSpell(sid);
    }
    const strAfter = w.player.effStr;
    const dexAfter = w.player.effDex;
    const mrAfter = w.player.mr;

    // 目標控制／吸血流與 AOE／相消
    const targetMob = w.mobs.find((m) => m.hp > 0);
    let slowActive = false;
    let paraActive = false;
    let clearedByCancel = false;
    if (targetMob) {
      w.player.tx = targetMob.tx - 1;
      w.player.ty = targetMob.ty;
      w.player.targetId = targetMob.id;
      w.player.hp = Math.max(10, w.player.maxHp - 30);
      w.player.mp = Math.max(w.player.mp, 200);
      for (const sid of [29, 33]) {
        w.player.lastSpellAt = 0;
        w.castSpell(sid, targetMob);
      }
      slowActive = (targetMob.slowUntil || 0) > performance.now();
      paraActive = (targetMob.paralyzeUntil || 0) > performance.now();
      w.player.lastSpellAt = 0;
      w.castSpell(44, targetMob);
      clearedByCancel = (targetMob.slowUntil || 0) === 0 && (targetMob.paralyzeUntil || 0) === 0;
      for (const sid of [28, 39, 22, 18]) {
        w.player.lastSpellAt = 0;
        w.castSpell(sid, targetMob);
      }
    }

    // 飢餓檢定與吃肉恢復
    w.player.food = 8;
    eng.hud.sync(true);
    const hungryBadgeText = Array.from(document.querySelectorAll('.ll-buff-badge.debuff')).map((el) => el.textContent.trim()).join(',');
    w.addItemToInventory('肉', 2);
    const meat = w.player.inventory.find((i) => i.name === '肉');
    if (meat) w.useItem(meat.id);
    const foodAfterMeat = w.player.food;

    // 復活卷軸免扣經驗原地復活
    w.addItemToInventory('復活卷軸', 1);
    const resScroll = w.player.inventory.find((i) => i.name === '復活卷軸');
    if (resScroll) w.useItem(resScroll.id);
    const expBeforeBlessRevive = w.player.exp;
    const blessRevive = w.triggerPlayerDeath('復活卷軸庇護測試');

    // 受損武器 + 多瑪修理
    const eqWeapon = w.player.inventory.find((i) => i.equipped && w.worldData.items[i.name]?.kind === 'weapon')
      || w.player.inventory.find((i) => w.worldData.items[i.name]?.kind === 'weapon');
    if (eqWeapon) {
      eqWeapon.equipped = true;
      eqWeapon.brokenCount = 2;
      w.recomputePlayerStats();
    }
    const doma = w.npcs.find((n) => n.name === '多瑪');
    if (doma) eng.hud.openNpc(doma);

    return {
      str0,
      strAfter,
      dex0,
      dexAfter,
      mr0,
      mrAfter,
      slowActive,
      paraActive,
      clearedByCancel,
      hungryBadgeText,
      foodAfterMeat,
      expBeforeBlessRevive,
      blessRevive,
      brokenBeforeFix: eqWeapon?.brokenCount ?? -1,
    };
  });
  assert(
    spellsAndItems.strAfter === spellsAndItems.str0 + 5 && spellsAndItems.dexAfter === spellsAndItems.dex0 + 5,
    `Expected STR/DEX +5 buffs: ${JSON.stringify(spellsAndItems)}`
  );
  assert(spellsAndItems.mrAfter >= spellsAndItems.mr0 + 20, `Expected 魔法屏障 MR +20: ${JSON.stringify(spellsAndItems)}`);
  assert(spellsAndItems.slowActive && spellsAndItems.paraActive && spellsAndItems.clearedByCancel, `Expected 緩速術 & 木乃伊的詛咒 debuffs on mob & dispel by 相消: ${JSON.stringify(spellsAndItems)}`);
  assert(
    spellsAndItems.hungryBadgeText.includes('飢餓') && !spellsAndItems.hungryBadgeText.includes('0s') && spellsAndItems.foodAfterMeat > 10,
    `Hunger badge/recovery failed: ${JSON.stringify(spellsAndItems)}`
  );
  assert(
    spellsAndItems.blessRevive.exp === spellsAndItems.expBeforeBlessRevive && spellsAndItems.blessRevive.penalty === 0 && spellsAndItems.blessRevive.blessed === true,
    `復活卷軸 should grant 0-EXP-loss revival: ${JSON.stringify(spellsAndItems)}`
  );
  assert(spellsAndItems.brokenBeforeFix === 2 && Boolean(await page.$('[data-npc-act="fix"]')), '多瑪 dialogue should expose [data-npc-act="fix"]');
  await page.click('[data-npc-act="fix"]');
  await page.waitForTimeout(100);

  // 未鑑定道具鑑定 + 對骷骨之劍強化的卷軸 + 變形卷軸視覺變身
  const scrollAndMorph = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    eng.hud.closeModal();
    const eqWeapon = w.player.inventory.find((i) => i.equipped && w.worldData.items[i.name]?.kind === 'weapon');
    const brokenAfterFix = eqWeapon?.brokenCount ?? -1;

    w.addItemToInventory('長劍', 1);
    const unidSword = [...w.player.inventory].reverse().find((i) => i.name === '長劍' && !i.equipped);
    if (unidSword) unidSword.identified = false;
    w.addItemToInventory('鑑定卷軸', 1);
    w.addItemToInventory('對骷骨之劍強化的卷軸', 1);
    w.addItemToInventory('變形卷軸', 2);

    const plusBeforeSkel = eqWeapon ? (eqWeapon.plus || 0) : 0;
    const skelScroll = w.player.inventory.find((i) => i.name === '對骷骨之劍強化的卷軸');
    if (skelScroll && eqWeapon) w.useItem(skelScroll.id, eqWeapon.id);
    const plusAfterSkel = eqWeapon ? (eqWeapon.plus || 0) : 0;

    eng.hud.selectedItemId = unidSword?.id || null;
    eng.hud.toggleModal('inventory');
    return {
      brokenAfterFix,
      plusBeforeSkel,
      plusAfterSkel,
      unidId: unidSword?.id || null,
      hasIdentifyBtn: Boolean(document.querySelector('[data-identify-item]')),
    };
  });
  assert(scrollAndMorph.brokenAfterFix === 0, `多瑪 should repair weapon to brokenCount=0: ${JSON.stringify(scrollAndMorph)}`);
  assert(scrollAndMorph.plusAfterSkel === scrollAndMorph.plusBeforeSkel + 1, `對骷骨之劍強化的卷軸 should +1 weapon: ${JSON.stringify(scrollAndMorph)}`);
  assert(scrollAndMorph.hasIdentifyBtn, 'Selected unid gear should display [data-identify-item]');
  await page.click('[data-identify-item]');
  await page.waitForTimeout(100);

  const polyModalReady = await page.evaluate((unidId) => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    const identifiedOk = w.player.inventory.find((i) => i.id === unidId)?.identified === true;
    eng.hud.closeModal();
    const polyScroll = w.player.inventory.find((i) => i.name === '變形卷軸');
    const useRes = polyScroll ? w.useItem(polyScroll.id) : null;
    if (useRes?.openModal) {
      if (useRes.scrollId) eng.hud.pendingPolyScrollId = useRes.scrollId;
      eng.hud.activeModal = useRes.openModal;
      eng.hud.renderModal();
      eng.hud.sync(true);
    }
    return { identifiedOk, hasDkCard: Boolean(document.querySelector('[data-poly-form="dk"]')) };
  }, scrollAndMorph.unidId);
  assert(polyModalReady.identifiedOk && polyModalReady.hasDkCard, `Identify or poly modal failed: ${JSON.stringify(polyModalReady)}`);
  await page.click('[data-poly-form="dk"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(scratchDir, 'lineage-game-poly.png') });

  // 寵物系統（詹森）+ 血盟創立／傳送（血盟執行人）+ 雕像祈禱 + 港口主人 + 同服連線好友視覺渲染
  const petModalReady = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    const polyState = { polyGfx: w.player.polyGfx, polyName: w.player.polyName };
    const jenson = w.npcs.find((n) => n.name === '詹森');
    if (jenson) eng.hud.openNpc(jenson);
    return {
      ...polyState,
      petMode: eng.hud.npcSession?.mode,
      hasDoberman: Boolean(document.querySelector('[data-pet-adopt="doberman"]')),
    };
  });
  assert(
    petModalReady.polyGfx === 110 && petModalReady.polyName === '闇騎士',
    `Polymorph should switch sprite to Dark Knight 110: ${JSON.stringify(petModalReady)}`
  );
  assert(petModalReady.petMode === 'pet' && petModalReady.hasDoberman, `Pet shop failed: ${JSON.stringify(petModalReady)}`);
  await page.click('[data-pet-adopt="doberman"]');
  await page.waitForTimeout(120);
  const petHealRes = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    if (w.player.pet) w.player.pet.hp = Math.max(1, w.player.pet.hp - 25);
    eng.hud.renderModal();
    return { petName: w.player.pet?.name, petGfx: w.player.pet?.gfx, hasHealBtn: Boolean(document.querySelector('[data-pet-heal]')) };
  });
  assert(petHealRes.petName === '杜賓犬' && petHealRes.petGfx === 931 && petHealRes.hasHealBtn, `Adopt pet failed: ${JSON.stringify(petHealRes)}`);
  await page.click('[data-pet-heal]');
  await page.waitForTimeout(100);

  const clanModalReady = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    const petFullHp = w.player.pet ? w.player.pet.hp === w.player.pet.maxHp : false;
    const registrar = w.npcs.find((n) => n.type === 'ClanRegistrar') || w.npcs.find((n) => n.name === '盧卡斯');
    if (registrar) eng.hud.openNpc(registrar);
    return {
      petFullHp,
      clanMode: eng.hud.npcSession?.mode,
      hasInput: Boolean(document.querySelector('#ll-clan-input')),
    };
  });
  assert(clanModalReady.petFullHp && clanModalReady.clanMode === 'clan' && clanModalReady.hasInput, `Clan modal failed: ${JSON.stringify(clanModalReady)}`);
  await page.fill('#ll-clan-input', '亞丁遠征軍');
  await page.click('[data-clan-create="1"]');
  await page.waitForTimeout(120);

  const statueHarborPeers = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    eng.hud.closeModal();
    const clanTitle = document.querySelector('[data-role="char-title"]')?.textContent || '';
    const statue = w.npcs.find((n) => n.name === '潘妮雅的雕像');
    if (statue) w.prayAtStatue(statue);
    w.addItemToInventory('血盟傳送卷軸', 1);
    const clanScroll = w.player.inventory.find((i) => i.name === '血盟傳送卷軸');
    if (clanScroll) w.useItem(clanScroll.id);
    const harbor = w.npcs.find((n) => n.name.includes('港口主人'));
    if (harbor) eng.hud.openNpc(harbor);
    return {
      clanName: w.player.clanName,
      clanTitle,
      hasHarborBtn: Boolean(document.querySelector('[data-npc-mode="harbor"]')),
    };
  });
  assert(
    statueHarborPeers.clanName === '亞丁遠征軍' && statueHarborPeers.clanTitle.includes('《亞丁遠征軍》') && statueHarborPeers.hasHarborBtn,
    `Clan / Harbor UI failed: ${JSON.stringify(statueHarborPeers)}`
  );
  await page.click('[data-npc-mode="harbor"]');
  await page.waitForTimeout(100);
  await page.click('[data-harbor-idx="0"]');
  await page.waitForTimeout(120);
  const peerRenderRes = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    w.setRemotePeers(
      [
        {
          id: 999,
          charName: '亞丁劍士',
          classId: 'knight',
          gfx: 61,
          clanName: '亞丁遠征軍',
          map: 0,
          tx: w.player.tx + 2,
          ty: w.player.ty + 1,
          heading: 4,
          chatText: '組隊練功嗎！',
        },
      ],
      2
    );
    eng.hud.sync(true);
    return { peers: w.remotePeers.length, onlineCount: w.onlineCount };
  });
  assert(peerRenderRes.peers === 1 && peerRenderRes.onlineCount === 2, `Peer injection failed: ${JSON.stringify(peerRenderRes)}`);
  await page.waitForTimeout(220);
  await page.screenshot({ path: path.join(scratchDir, 'lineage-game-pet-clan.png') });

  // 驗證鏡頭拉近、待機腳不亂動、揮擊動畫流暢完整，以及商店自由輸入數量 / -1 / +1 購買
  const polishChecks = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    const sp = eng.sprites;
    const snap = eng.getSnapshot();

    const uniqueFrames = (arr) => new Set(arr.map((f) => `${f?.path}:${f?.sx},${f?.sy}`)).size;
    const idleKnight = [0, 260, 520, 780].map((t) => sp.resolveFrame(61, 'idle', 4, t, 'sword'));
    const idleElf = [0, 260, 520].map((t) => sp.resolveFrame(37, 'idle', 4, t, 'bow'));
    const walkKnight = [0, 220, 440, 660].map((t) => sp.resolveFrame(61, 'walk', 4, t, 'sword'));
    const atkKnight = [0, 220, 420, 580].map((t) => sp.resolveFrame(61, 'attack', 4, t, 'sword', { durationMs: 630 }));
    const dkIdle = sp.resolveFrame(110, 'idle', 4, 150, 'unarmed');

    // 驗證怪物結束 moveTo 後會立刻切回 idle，不會原地踏步
    const idleMob = w.mobs.find((m) => m.hp > 0 && m.map === w.player.map && !m.moveTo);
    let mobResetToIdle = true;
    if (idleMob) {
      idleMob.animState = 'walk';
      w.step(16, performance.now());
      mobResetToIdle = idleMob.animState === 'idle' || Boolean(idleMob.moveTo);
    }

    // 開啟商店介面驗證數量調整控制
    const pandora = w.npcs.find((n) => n.name === '潘朵拉') || w.npcs.find((n) => n.type === 'Merchant');
    w.player.gold += 50000;
    if (pandora) {
      eng.hud.openNpc(pandora);
      eng.hud.npcSession.mode = 'buy';
      eng.hud.renderModal();
    }
    const entries = pandora ? (w.worldData.shops?.[pandora.shopKey || pandora.name] || []) : [];
    const firstEntry = entries[0] || { item: '紅色藥水', price: 30, count: 1 };
    const beforeCount = w.player.inventory
      .filter((it) => it.name === firstEntry.item)
      .reduce((acc, it) => acc + it.count, 0);

    return {
      cameraZoom: snap.cameraZoom,
      idleKnightUnique: uniqueFrames(idleKnight),
      idleElfUnique: uniqueFrames(idleElf),
      walkKnightUnique: uniqueFrames(walkKnight),
      atkKnightUnique: uniqueFrames(atkKnight),
      dkIdlePath: dkIdle?.path || '',
      mobResetToIdle,
      hasShopStepper: Boolean(document.querySelector('[data-shop-step="0:1"]') && document.querySelector('[data-shop-step="0:-1"]')),
      hasShopQtyInput: Boolean(document.querySelector('[data-shop-qty="0"]')),
      goldBefore: w.player.gold,
      firstItemName: firstEntry.item,
      firstItemPrice: firstEntry.price,
      firstItemCount: firstEntry.count || 1,
      beforeCount,
    };
  });
  assert(polishChecks.cameraZoom >= 1.45, `Desktop camera zoom should be zoomed closer (>=1.45): ${polishChecks.cameraZoom}`);
  assert(
    polishChecks.idleKnightUnique === 1 && polishChecks.idleElfUnique === 1,
    `Idle poses must stay completely still without leg walking: ${JSON.stringify(polishChecks)}`
  );
  assert(polishChecks.walkKnightUnique >= 2, `Walk cycle must animate legs: ${polishChecks.walkKnightUnique}`);
  assert(polishChecks.atkKnightUnique >= 3, `Combat attack swing must play full sequence smoothly: ${polishChecks.atkKnightUnique}`);
  assert(polishChecks.dkIdlePath.includes('/110-12.'), `Dark Knight 110 heading 4 idle should use seq 27 (8+4=12): ${polishChecks.dkIdlePath}`);
  assert(polishChecks.mobResetToIdle, 'Idle monsters should not keep walk animation when stationary');
  assert(polishChecks.hasShopStepper && polishChecks.hasShopQtyInput, `Missing shop qty controls: ${JSON.stringify(polishChecks)}`);

  const remasterShopDom = await page.evaluate(() => {
    const win = document.querySelector('.ll-win.shop-win');
    const cs = win ? getComputedStyle(win) : null;
    return {
      hasShopWin: Boolean(win),
      borderWidth: cs?.borderTopWidth || null,
      borderColor: cs?.borderTopColor || null,
      hasPortrait: Boolean(document.querySelector('.ll-shop-portrait')),
      hasTabs: ['all', 'potion', 'scroll', 'other'].every((t) =>
        Boolean(document.querySelector(`[data-shop-tab="${t}"]`))
      ),
      hasSort: Boolean(document.querySelector('[data-shop-sort="1"]')),
      hasReset: Boolean(document.querySelector('[data-shop-reset="1"]')),
      hasBatchBuy: Boolean(document.querySelector('[data-shop-buy-batch="1"]')),
      hasBatchTotal: Boolean(document.querySelector('[data-role="shop-batch-total"]')),
    };
  });
  assert(
    remasterShopDom.hasShopWin &&
      remasterShopDom.borderWidth === '2px' &&
      remasterShopDom.borderColor === 'rgb(72, 70, 66)' &&
      remasterShopDom.hasPortrait &&
      remasterShopDom.hasTabs &&
      remasterShopDom.hasSort &&
      remasterShopDom.hasReset &&
      remasterShopDom.hasBatchBuy &&
      remasterShopDom.hasBatchTotal,
    `Remaster shop layout DOM mismatch: ${JSON.stringify(remasterShopDom)}`
  );

  await page.click('[data-shop-tab="potion"]');
  const potionTabActive = await page.evaluate(() =>
    document.querySelector('[data-shop-tab="potion"]')?.classList.contains('active')
  );
  assert(potionTabActive, 'Clicking potion shop tab should activate it');
  await page.selectOption('[data-shop-sort="1"]', 'price-asc');
  const sortVal = await page.inputValue('[data-shop-sort="1"]');
  assert(sortVal === 'price-asc', `Shop sort should change to price-asc, got ${sortVal}`);
  await page.selectOption('[data-shop-sort="1"]', 'none');
  await page.click('[data-shop-tab="all"]');

  await page.click('[data-shop-step="0:1"]');
  await page.click('[data-shop-step="0:1"]');
  await page.click('[data-shop-step="0:-1"]');
  const afterStepVal = await page.inputValue('[data-shop-qty="0"]');
  assert(afterStepVal === '2', `Shop +1/+1/-1 step should yield 2, got ${afterStepVal}`);

  await page.click('[data-shop-reset="1"]');
  const resetQty = await page.inputValue('[data-shop-qty="0"]');
  const resetBatchTotal = await page.textContent('[data-role="shop-batch-total"]');
  assert(resetQty === '1' && resetBatchTotal?.trim() === '0', `Shop reset failed: qty=${resetQty}, total=${resetBatchTotal}`);

  await page.fill('[data-shop-qty="0"]', '25');
  await page.dispatchEvent('[data-shop-qty="0"]', 'input');
  await page.waitForTimeout(80);
  const totalLabel = await page.textContent('[data-shop-total="0"]');
  const batchTotalLabel = await page.textContent('[data-role="shop-batch-total"]');
  const expectedCost = polishChecks.firstItemPrice * 25;
  assert(
    totalLabel && totalLabel.includes(expectedCost.toLocaleString()) &&
      batchTotalLabel && batchTotalLabel.includes(expectedCost.toLocaleString()),
    `Live shop total should reflect qty 25 (${expectedCost.toLocaleString()}): row=${totalLabel}, batch=${batchTotalLabel}`
  );
  await page.screenshot({ path: path.join(scratchDir, 'lineage-game-shop.png') });

  const origShopVp = page.viewportSize();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  const mobileShopFit = await page.evaluate(() => {
    const win = document.querySelector('.ll-win.shop-win');
    const r = win ? win.getBoundingClientRect() : null;
    return {
      innerW: window.innerWidth,
      scrollW: document.documentElement.scrollWidth,
      left: r ? Math.round(r.left) : null,
      right: r ? Math.round(r.right) : null,
    };
  });
  assert(
    mobileShopFit.scrollW <= mobileShopFit.innerW &&
      mobileShopFit.left !== null &&
      mobileShopFit.left >= 0 &&
      mobileShopFit.right <= mobileShopFit.innerW,
    `Mobile shop modal overflow: ${JSON.stringify(mobileShopFit)}`
  );
  await page.screenshot({ path: path.join(scratchDir, 'lineage-game-shop-mobile.png') });
  if (origShopVp) {
    await page.setViewportSize(origShopVp);
    await page.waitForTimeout(80);
  }

  await page.click('[data-shop-buy="0"]');
  await page.waitForTimeout(100);

  const afterBuyRes = await page.evaluate((itemName) => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    const count = w.player.inventory
      .filter((it) => it.name === itemName)
      .reduce((acc, it) => acc + it.count, 0);
    eng.hud.closeModal();
    return { gold: w.player.gold, count };
  }, polishChecks.firstItemName);
  assert(
    afterBuyRes.gold === polishChecks.goldBefore - expectedCost &&
      afterBuyRes.count === polishChecks.beforeCount + 25 * polishChecks.firstItemCount,
    `Shop custom qty purchase mismatch: ${JSON.stringify(afterBuyRes)} vs ${JSON.stringify(polishChecks)}`
  );

  // 驗證 284 風格設定面板（卡牌排版、音效/音樂 0-100 拉桿、特效/傷害開關、藥水選單、自動練功設定、手機版無溢出）
  await page.click('[data-win="auto"]');
  await page.waitForTimeout(150);
  const settingsUiCheck = await page.evaluate(async () => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    const audio = eng.audio;
    const win = document.querySelector('.ll-win.ll-settings-win');
    const cards = document.querySelectorAll('.ll-set-card').length;
    const switches = document.querySelectorAll('.il-switch').length;
    const sfxOnEl = document.getElementById('set-sfx-on');
    const sfxVolEl = document.getElementById('set-sfx-vol');
    const bgmOnEl = document.getElementById('set-bgm-on');
    const bgmVolEl = document.getElementById('set-bgm-vol');
    const hasActions =
      Boolean(document.querySelector('[data-sys-act="lobby"]')) &&
      Boolean(document.querySelector('[data-sys-act="save"]')) &&
      Boolean(document.querySelector('[data-sys-act="home"]'));

    audio.setMuted(false);
    audio.playBgm('/assets/286/assets/284/bgm/town_talking.mp3');
    await new Promise((r) => setTimeout(r, 250));
    const bgmVolAt50 = audio.bgmAudio?.volume ?? -1;

    // 測試拉桿即時 input 更新文字且不重建 DOM，並實際縮放音樂音量與寫入 localStorage
    sfxVolEl.value = '85';
    sfxVolEl.dispatchEvent(new Event('input', { bubbles: true }));
    const sfxConnectedAfterInput = sfxVolEl.isConnected;
    const sfxLabelAfterInput = document.querySelector('[data-audio-val="sfx"]')?.textContent?.trim();

    bgmVolEl.value = '100';
    bgmVolEl.dispatchEvent(new Event('input', { bubbles: true }));
    const bgmConnectedAfterInput = bgmVolEl.isConnected;
    const bgmLabelAt100 = document.querySelector('[data-audio-val="bgm"]')?.textContent?.trim();
    const bgmVolAt100 = audio.bgmAudio?.volume ?? -1;

    bgmVolEl.value = '0';
    bgmVolEl.dispatchEvent(new Event('input', { bubbles: true }));
    const bgmVolAt0 = audio.bgmAudio?.volume ?? -1;

    // 測試取消勾選 SFX 與拉回常用測試值 (65 / 75) 的持久化
    sfxOnEl.checked = false;
    sfxOnEl.dispatchEvent(new Event('change', { bubbles: true }));
    const savedMutedSfx = JSON.parse(localStorage.getItem('ll286:audio_prefs_v1') || '{}');
    sfxOnEl.checked = true;
    sfxOnEl.dispatchEvent(new Event('change', { bubbles: true }));

    sfxVolEl.value = '65';
    sfxVolEl.dispatchEvent(new Event('input', { bubbles: true }));
    sfxVolEl.dispatchEvent(new Event('change', { bubbles: true }));
    bgmVolEl.value = '75';
    bgmVolEl.dispatchEvent(new Event('input', { bubbles: true }));
    bgmVolEl.dispatchEvent(new Event('change', { bubbles: true }));
    const savedCustomAudio = JSON.parse(localStorage.getItem('ll286:audio_prefs_v1') || '{}');

    // 測試顯示特效/傷害數字 pill 開關 (.il-switch)
    const vfxBtn = document.querySelector('[data-pref-toggle="showVfx"]');
    const dmgBtn = document.querySelector('[data-pref-toggle="showDamageNums"]');
    vfxBtn.click();
    dmgBtn.click();
    const prefsOff = {
      showVfx: w.displayPrefs.showVfx,
      showDamageNums: w.displayPrefs.showDamageNums,
      vfxHasOnClass: document.querySelector('[data-pref-toggle="showVfx"]')?.classList.contains('is-on'),
      ls: JSON.parse(localStorage.getItem('ll286:display_prefs_v1') || '{}'),
    };
    document.querySelector('[data-pref-toggle="showVfx"]')?.click();
    document.querySelector('[data-pref-toggle="showDamageNums"]')?.click();

    // 測試喝水設定與 2 欄功能開關
    const potSel = document.querySelector('[data-auto-select="preferredPot"]');
    const potNum = document.querySelector('[data-auto-num="potThreshold"]');
    const hasteChk = document.querySelector('[data-auto-check="autoHaste"]');
    potSel.value = '橙色藥水';
    potSel.dispatchEvent(new Event('change', { bubbles: true }));
    potNum.value = '62';
    potNum.dispatchEvent(new Event('change', { bubbles: true }));
    hasteChk.checked = true;
    hasteChk.dispatchEvent(new Event('change', { bubbles: true }));

    return {
      hasWin: Boolean(win),
      cards,
      switches,
      hasActions,
      sfxMin: sfxVolEl?.min,
      sfxMax: sfxVolEl?.max,
      bgmMin: bgmVolEl?.min,
      bgmMax: bgmVolEl?.max,
      bgmVolAt50,
      bgmVolAt100,
      bgmVolAt0,
      sfxConnectedAfterInput,
      bgmConnectedAfterInput,
      sfxLabelAfterInput,
      bgmLabelAt100,
      savedMutedSfx,
      savedCustomAudio,
      prefsOff,
      autoAfter: {
        preferredPot: w.player.autoConfig.preferredPot,
        potThreshold: w.player.autoConfig.potThreshold,
        autoHaste: w.player.autoConfig.autoHaste,
      },
    };
  });
  assert(
    settingsUiCheck.hasWin &&
      settingsUiCheck.cards >= 4 &&
      settingsUiCheck.switches >= 2 &&
      settingsUiCheck.hasActions &&
      settingsUiCheck.sfxMin === '0' &&
      settingsUiCheck.sfxMax === '100' &&
      settingsUiCheck.bgmMin === '0' &&
      settingsUiCheck.bgmMax === '100',
    `284 settings panel structure check failed: ${JSON.stringify(settingsUiCheck)}`
  );
  assert(
    settingsUiCheck.sfxConnectedAfterInput &&
      settingsUiCheck.bgmConnectedAfterInput &&
      settingsUiCheck.sfxLabelAfterInput === '85%' &&
      settingsUiCheck.bgmLabelAt100 === '100%' &&
      settingsUiCheck.bgmVolAt50 > 0 &&
      settingsUiCheck.bgmVolAt100 > settingsUiCheck.bgmVolAt50 &&
      settingsUiCheck.bgmVolAt0 === 0 &&
      settingsUiCheck.savedMutedSfx.sfxOn === false &&
      settingsUiCheck.savedCustomAudio.sfxOn === true &&
      settingsUiCheck.savedCustomAudio.sfxVol === 65 &&
      settingsUiCheck.savedCustomAudio.bgmVol === 75,
    `Audio 0-100 slider/toggle check failed: ${JSON.stringify(settingsUiCheck)}`
  );
  assert(
    settingsUiCheck.prefsOff.showVfx === false &&
      settingsUiCheck.prefsOff.showDamageNums === false &&
      settingsUiCheck.prefsOff.vfxHasOnClass === false &&
      settingsUiCheck.prefsOff.ls.showVfx === false &&
      settingsUiCheck.autoAfter.preferredPot === '橙色藥水' &&
      settingsUiCheck.autoAfter.potThreshold === 62 &&
      settingsUiCheck.autoAfter.autoHaste === true,
    `Display prefs / autoConfig check failed: ${JSON.stringify(settingsUiCheck)}`
  );
  await page.screenshot({ path: path.join(scratchDir, 'lineage-game-settings.png') });

  // 手機版 390x844 設定面板溢出與可視範圍驗證
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(120);
  const mobileSettingsOverflow = await page.evaluate(() => {
    const win = document.querySelector('.ll-win.ll-settings-win');
    const r = win ? win.getBoundingClientRect() : null;
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      rect: r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height } : null,
    };
  });
  assert(
    mobileSettingsOverflow.scrollWidth <= mobileSettingsOverflow.innerWidth &&
      mobileSettingsOverflow.rect &&
      mobileSettingsOverflow.rect.left >= 0 &&
      mobileSettingsOverflow.rect.right <= 390.5,
    `Mobile settings panel overflow: ${JSON.stringify(mobileSettingsOverflow)}`
  );
  await page.screenshot({ path: path.join(scratchDir, 'lineage-game-settings-mobile.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(100);

  // 還原預設 50% 音量與自動練功設定再繼續後續 BGM/安全區測試
  await page.evaluate(() => {
    const eng = window.__lineage.engine();
    eng.audio.setSfxOn(true);
    eng.audio.setSfxVol(50);
    eng.audio.setBgmOn(true);
    eng.audio.setBgmVol(50);
    eng.world.player.autoConfig.preferredPot = 'auto';
    eng.world.player.autoConfig.potThreshold = 55;
    eng.world.player.autoConfig.autoHaste = false;
  });
  await page.click('[data-close-modal="1"]');
  await page.waitForTimeout(100);
  assert(
    await page.evaluate(() => !document.querySelector('.ll-win')),
    'Settings modal should close cleanly on close button'
  );

  // 驗證打木人不切換戰鬥音樂、打真怪時 battle 取代原本背景音樂不重疊、同時最多只有 1 軌 <audio> 播放
  const bgmCheck = await page.evaluate(async () => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    const audio = eng.audio;
    w.teleportTo(0, 32578, 32943, 4);
    audio.inCombat = false;
    audio.lastCombatAt = -Infinity;
    audio.update(w, performance.now());

    const dummy = w.npcs.find((n) => n.type === 'TrainingDummy');
    if (dummy) {
      w.player.lastAttackAt = 0;
      w.hitTrainingDummy(dummy, performance.now());
      audio.update(w, performance.now());
    }
    const afterDummyCombat = audio.inCombat;

    // 模擬切換至 battle 背景音樂後檢查所有 <audio> 軌數與未靜音音量
    audio.setMuted(false);
    audio.playBgm('/assets/286/assets/284/bgm/town_talking.mp3');
    audio.lastCombatAt = performance.now();
    audio.update(w, performance.now());
    await new Promise((r) => setTimeout(r, 450));
    const playingDuringBattle = [...audio.bgmEls.values()].filter((el) => !el.paused).length;
    const currentBgmBattle = audio.currentBgm;
    const battleVol = audio.bgmAudio?.volume ?? 0;

    // 脫戰切回區域音樂：同樣不得兩首同時播放
    audio.lastCombatAt = performance.now() - 10000;
    audio.update(w, performance.now());
    await new Promise((r) => setTimeout(r, 450));
    const playingAfterExit = [...audio.bgmEls.values()].filter((el) => !el.paused).length;
    const currentBgmAfter = audio.currentBgm;

    return {
      afterDummyCombat,
      playingDuringBattle,
      currentBgmBattle,
      battleVol,
      playingAfterExit,
      currentBgmAfter,
    };
  });
  assert(bgmCheck.afterDummyCombat === false, `Hitting TrainingDummy should not trigger battle BGM: ${JSON.stringify(bgmCheck)}`);
  assert(
    bgmCheck.playingDuringBattle <= 1 && bgmCheck.playingAfterExit <= 1,
    `Expected at most 1 active BGM <audio> track (no overlap): ${JSON.stringify(bgmCheck)}`
  );
  assert(
    bgmCheck.currentBgmBattle.includes('battle.mp3') && bgmCheck.battleVol <= 0.16 && !bgmCheck.currentBgmAfter.includes('battle.mp3'),
    `Battle BGM switch/volume normalization failed: ${JSON.stringify(bgmCheck)}`
  );

  // 驗證經典練功地圖與 BOSS 接線（Map 22 傑瑞德的試煉地監、巴風特、死靈騎士、巨蟻女皇、獨眼巨人）與怪物不走進安全區
  const dungeonBossCheck = await page.evaluate(async () => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    w.player.hp = w.player.maxHp = Math.max(w.player.maxHp, 800);
    w.player.gold += 5000;

    // (a) 銀騎士之村 NPC 傑瑞德 -> Map 22 傑瑞德的試煉地監（蛇女）
    w.teleportTo(4, 33099, 33352, 4);
    const jared = w.npcs.find((n) => n.name === '傑瑞德');
    if (!jared) return { ok: false, reason: 'missing jared' };
    eng.hud.openNpc(jared);
    document.querySelector('[data-npc-mode="teleport"]')?.click();
    const tpButtons = [...document.querySelectorAll('[data-tp-idx]')];
    const trialBtn = tpButtons.find((b) => (b.closest('.ll-list-row')?.textContent || b.textContent).includes('試煉地監'));
    if (!trialBtn) {
      return {
        ok: false,
        reason: 'missing trial dungeon tp button',
        rows: tpButtons.map((b) => b.closest('.ll-list-row')?.textContent?.trim() || b.textContent),
      };
    }
    trialBtn.click();
    const map22State = {
      map: w.player.map,
      medusaCount: w.mobs.filter((m) => m.name === '蛇女').length,
      walkableMob: w.mobs.every((m) => w.isoMap.isWalkableTile(m.tx, m.ty, m.map)),
    };

    // (b) 各經典地圖 BOSS / 新增生態
    w.teleportTo(2, 32670, 32800, 4);
    const hasBaphomet = w.mobs.some((m) => m.name === '巴風特');
    w.teleportTo(11, 32670, 32800, 4);
    const hasDeathKnight = w.mobs.some((m) => m.name === '死靈騎士');
    w.teleportTo(51, 32768, 32800, 4);
    const hasAntQueen = w.mobs.some((m) => m.name === '巨蟻女皇');
    const hasGiantSoldierAnt = w.mobs.some((m) => m.name === '巨型蟻兵');
    w.teleportTo(4, 33375, 32365, 4);
    const hasCyclops = w.mobs.some((m) => m.name === '獨眼巨人');

    // (c) 說話之島 & 銀騎士安全區與怪物不入城測試
    w.teleportTo(0, 32592, 32911, 4);
    eng.hud.closeModal();
    eng.hud.sync(true);
    const tiZoneBadge = document.querySelector('.ll-zone-badge')?.textContent?.trim() || '';
    const tiHostilesOnSafeBit = w.mobs.filter(
      (m) => m.hp > 0 && !m.spawn?.villageAnimal && w.isoMap.hasSafetyBit(m.tx, m.ty, 0)
    ).length;

    const testMob =
      w.mobs.find((m) => m.hp > 0 && !m.spawn?.villageAnimal && m.aggressive) ||
      w.mobs.find((m) => m.hp > 0 && !m.spawn?.villageAnimal);
    let borderCheck = { ok: false, reason: 'no test mob' };
    if (testMob) {
      const savedPos = {
        tx: testMob.tx,
        ty: testMob.ty,
        homeX: testMob.homeX,
        homeY: testMob.homeY,
        aggressive: Boolean(testMob.aggressive),
      };
      testMob.aggressive = true;
      testMob.tx = 32592;
      testMob.ty = 32908;
      testMob.homeX = 32592;
      testMob.homeY = 32906;
      testMob.aggroTarget = false;
      testMob.lastAttackAt = 0;
      w.player.hp = w.player.maxHp;
      const hpInsideBefore = w.player.hp;
      for (let i = 0; i < 14; i += 1) {
        w.step(200, performance.now() + (i + 1) * 200);
      }
      const mobEnteredSafety = testMob.ty >= 32910 || w.isoMap.hasSafetyBit(testMob.tx, testMob.ty, 0);
      const hpInsideAfter = w.player.hp;
      const aggroWhileInside = testMob.aggroTarget;

      // 玩家走出城外 (一般區域) 怪物可鎖定追擊，退回安全區後立即解除仇恨且不進城
      w.teleportTo(0, 32592, 32906, 4);
      eng.hud.sync(true);
      const wildZoneBadge = document.querySelector('.ll-zone-badge')?.textContent?.trim() || '';
      testMob.tx = 32592;
      testMob.ty = 32908;
      for (let i = 0; i < 4; i += 1) {
        w.step(200, performance.now() + 4000 + i * 200);
      }
      const aggroOutside = testMob.aggroTarget;

      w.teleportTo(0, 32592, 32912, 4);
      eng.hud.sync(true);
      for (let i = 0; i < 6; i += 1) {
        w.step(200, performance.now() + 5000 + i * 200);
      }
      const aggroClearedOnReenter = testMob.aggroTarget === false;
      const mobStillOutside = testMob.ty < 32910 && !w.isoMap.hasSafetyBit(testMob.tx, testMob.ty, 0);

      testMob.tx = savedPos.tx;
      testMob.ty = savedPos.ty;
      testMob.homeX = savedPos.homeX;
      testMob.homeY = savedPos.homeY;
      testMob.aggressive = savedPos.aggressive;
      testMob.aggroTarget = false;
      borderCheck = {
        ok: true,
        mobEnteredSafety,
        hpDeltaInside: hpInsideAfter - hpInsideBefore,
        aggroWhileInside,
        wildZoneBadge,
        aggroOutside,
        aggroClearedOnReenter,
        mobStillOutside,
      };
    }

    w.teleportTo(0, 32578, 32943, 4);
    eng.hud.closeModal();
    return {
      ok: true,
      map22State,
      hasBaphomet,
      hasDeathKnight,
      hasAntQueen,
      hasGiantSoldierAnt,
      hasCyclops,
      tiZoneBadge,
      tiHostilesOnSafeBit,
      borderCheck,
    };
  });
  assert(
    dungeonBossCheck.ok
      && dungeonBossCheck.map22State.map === 22
      && dungeonBossCheck.map22State.medusaCount >= 1
      && dungeonBossCheck.hasBaphomet
      && dungeonBossCheck.hasDeathKnight
      && dungeonBossCheck.hasAntQueen
      && dungeonBossCheck.hasGiantSoldierAnt
      && dungeonBossCheck.hasCyclops,
    `Dungeon/Boss check failed: ${JSON.stringify(dungeonBossCheck)}`
  );
  assert(
    dungeonBossCheck.tiZoneBadge === '安全區域'
      && dungeonBossCheck.tiHostilesOnSafeBit === 0
      && dungeonBossCheck.borderCheck.ok
      && dungeonBossCheck.borderCheck.mobEnteredSafety === false
      && dungeonBossCheck.borderCheck.hpDeltaInside === 0
      && dungeonBossCheck.borderCheck.aggroWhileInside === false
      && dungeonBossCheck.borderCheck.aggroOutside === true
      && dungeonBossCheck.borderCheck.aggroClearedOnReenter === true
      && dungeonBossCheck.borderCheck.mobStillOutside === true,
    `Town safety border guard failed: ${JSON.stringify(dungeonBossCheck)}`
  );

  // 驗證全 64 張地圖接通（世界地圖跨大陸傳送、古魯丁安全區、奇岩地監隨機刷怪、回卷最近城鎮、禁瞬移地圖、風木 2F 穿牆修正）
  const worldMapInit = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    w.player.gold += 5000;
    eng.hud.closeModal();
    eng.hud.toggleModal('map');
    return {
      mapCount: Array.isArray(w.worldData.mapIds) ? w.worldData.mapIds.length : 0,
      collisionCount: Object.keys(w.worldData.collision || {}).length,
      dialogueCount: Object.keys(w.worldData.dialogues || {}).length,
      warpBtns: document.querySelectorAll('[data-world-warp]').length,
      hasGludinBtn: Boolean(document.querySelector('[data-world-warp="3"]')),
    };
  });
  assert(
    worldMapInit.mapCount === 64 &&
      worldMapInit.collisionCount >= 677 &&
      worldMapInit.dialogueCount >= 900 &&
      worldMapInit.warpBtns >= 15 &&
      worldMapInit.hasGludinBtn,
    `Full 64-map world data or World Map modal check failed: ${JSON.stringify(worldMapInit)}`
  );
  await page.click('[data-world-warp="3"]'); // 前往亞丁大陸 古魯丁城鎮 (map 4)
  await page.waitForTimeout(350);

  const mainlandRes = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    const mapBadge = document.querySelector('[data-role="map-name"]')?.textContent || '';
    const zoneBadge = document.querySelector('[data-role="zone-badge"]')?.textContent || '';
    const steve = w.npcs.find((n) => n.name === '史提夫') || w.npcs.find((n) => n.type === 'Teleport');
    if (steve) eng.hud.openNpc(steve);
    const tpCount = document.querySelectorAll('[data-tp-idx]').length;
    eng.hud.closeModal();

    // 在奇岩城附近使用回卷應返回奇岩城而非說話之島
    w.teleportTo(4, 33380, 32790, 4);
    w.addItemToInventory('傳送回家的卷軸', 1);
    const homeScroll = w.player.inventory.find((i) => i.name === '傳送回家的卷軸');
    const recallRes = homeScroll ? w.useItem(homeScroll.id) : null;
    const afterRecall = { map: w.player.map, tx: w.player.tx, ty: w.player.ty, ok: recallRes?.ok };

    // 奇岩地監 1樓 (map 53)：原檔 spawns 為隨機 (0,0)，應自動落於可行走格且不為 (0,0)
    w.teleportTo(53, 32808, 32732, 4);
    const giranDgMobs = w.mobs.filter((m) => m.hp > 0);
    const giranDgNonZero = giranDgMobs.filter((m) => m.tx !== 0 || m.ty !== 0).length;

    // 冒險洞窟 2樓 (map 2) 規則 tele=false：使用瞬間移動的卷軸應被阻擋且座標不變
    w.teleportTo(2, 32662, 32874, 4);
    const beforeBlockedTp = { tx: w.player.tx, ty: w.player.ty };
    w.addItemToInventory('瞬間移動的卷軸', 1);
    const tpScroll = w.player.inventory.find((i) => i.name === '瞬間移動的卷軸');
    const blockedTpRes = tpScroll ? w.useItem(tpScroll.id) : null;
    const afterBlockedTp = {
      map: w.player.map,
      tx: w.player.tx,
      ty: w.player.ty,
      blockedOk: blockedTpRes?.ok === false,
    };

    // 風木城地監 2樓 (map 24) 通道穿牆修正驗證
    const patchV = w.isoMap.getCollisionBytes(32769, 32785, 24);
    const patchH = w.isoMap.getCollisionBytes(32749, 32769, 24);

    // 測完返回說話之島中央維持後續測試一致性
    w.teleportTo(0, 32578, 32943, 4);
    eng.hud.sync(true);

    return {
      mapBadge,
      zoneBadge,
      steveName: steve?.name || null,
      tpCount,
      afterRecall,
      giranDgMobsCount: giranDgMobs.length,
      giranDgNonZero,
      beforeBlockedTp,
      afterBlockedTp,
      patchVOk: patchV ? (patchV[0] & 1) === 0 : false,
      patchHOk: patchH ? (patchH[1] & 1) === 0 : false,
    };
  });
  assert(
    mainlandRes.mapBadge === '亞丁大陸' && mainlandRes.zoneBadge === '安全區域' && mainlandRes.tpCount >= 4,
    `Mainland Gludin arrival or teleporter check failed: ${JSON.stringify(mainlandRes)}`
  );
  assert(
    mainlandRes.afterRecall.ok === true &&
      mainlandRes.afterRecall.map === 4 &&
      Math.abs(mainlandRes.afterRecall.tx - 33437) < 20 &&
      Math.abs(mainlandRes.afterRecall.ty - 32795) < 20,
    `Home scroll near Giran should return to Giran instead of TI: ${JSON.stringify(mainlandRes.afterRecall)}`
  );
  assert(
    mainlandRes.giranDgMobsCount > 0 && mainlandRes.giranDgNonZero === mainlandRes.giranDgMobsCount,
    `Giran Dungeon 1F (map 53) random spawns failed: ${JSON.stringify(mainlandRes)}`
  );
  assert(
    mainlandRes.afterBlockedTp.blockedOk === true &&
      mainlandRes.afterBlockedTp.map === 2 &&
      mainlandRes.afterBlockedTp.tx === mainlandRes.beforeBlockedTp.tx &&
      mainlandRes.afterBlockedTp.ty === mainlandRes.beforeBlockedTp.ty,
    `Map 2 (tele=false) should block teleport scroll: ${JSON.stringify(mainlandRes)}`
  );
  assert(
    mainlandRes.patchVOk && mainlandRes.patchHOk,
    `Map 24 doorway collision patch failed: ${JSON.stringify(mainlandRes)}`
  );

  await page.evaluate(() => window.__lineage.pingWorld());
  await page.waitForTimeout(200);
  st = await page.evaluate(() => window.__lineage.getState());
  assert(st.realtimeLog && st.realtimeLog.includes('pong'), `Expected pong frame in realtimeLog, got: ${st.realtimeLog}`);

  // 驗證新實作 4 項需求：
  // 1) lineagereal.com/ability/ 官方角色數值表與衍生能力面板
  // 2) 武卷／防卷進入強化游標模式，可點擊背包任一未裝備武器／防具並做類型判斷與 Esc 取消
  // 3) 背包滾動後點擊道具／鎖定／使用時捲動軸固定不跳回頂部
  // 4) 奇岩城（中央廣場）與奇岩內城傳送師 NPC 雙向傳送
  await page.evaluate(() => {
    const eng = window.__lineage.engine();
    eng?.hud?.closeModal?.();
  });
  await page.click('[data-win="status"]');
  await page.waitForTimeout(160);
  const abilityCheck = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    const classes = w.worldData?.classes || {};
    const ab = w.player.abilities || {};
    const statusText = document.querySelector('#ll-modal-layer .status-win')?.textContent || '';
    return {
      statusText,
      ab,
      royal: classes.royal ? { baseHp: classes.royal.baseHp, baseMp: classes.royal.baseMp, stats: classes.royal.stats } : null,
      knight: classes.knight ? { baseHp: classes.knight.baseHp, baseMp: classes.knight.baseMp, stats: classes.knight.stats } : null,
      elf: classes.elf ? { baseHp: classes.elf.baseHp, baseMp: classes.elf.baseMp, stats: classes.elf.stats } : null,
      mage: classes.mage ? { baseHp: classes.mage.baseHp, baseMp: classes.mage.baseMp, stats: classes.mage.stats } : null,
    };
  });
  assert(
    abilityCheck.statusText.includes('能力表衍生加成') &&
      abilityCheck.statusText.includes('近戰傷／命') &&
      typeof abilityCheck.ab.meleeDmg === 'number' &&
      typeof abilityCheck.ab.er === 'number' &&
      typeof abilityCheck.ab.mpDiscountCap === 'number' &&
      typeof abilityCheck.ab.acDivisor === 'number' &&
      abilityCheck.royal?.baseHp === 14 &&
      abilityCheck.royal?.baseMp === 2 &&
      abilityCheck.royal?.stats?.str === 13 &&
      abilityCheck.royal?.stats?.cha === 13 &&
      abilityCheck.knight?.baseHp === 16 &&
      abilityCheck.knight?.baseMp === 1 &&
      abilityCheck.knight?.stats?.str === 16 &&
      abilityCheck.knight?.stats?.con === 14 &&
      abilityCheck.elf?.baseHp === 15 &&
      abilityCheck.elf?.baseMp === 4 &&
      abilityCheck.mage?.baseHp === 12 &&
      abilityCheck.mage?.baseMp === 6 &&
      abilityCheck.mage?.stats?.str === 8,
    `Official ability tables or Status modal check failed: ${JSON.stringify(abilityCheck)}`
  );
  await page.screenshot({ path: path.join(scratchDir, 'lineage-ability-status.png') });
  await page.click('[data-close-modal="1"]');
  await page.waitForTimeout(100);

  // 準備足夠道具讓道具欄產生捲軸並測試未裝備武器／防具強化
  const enchantSetup = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    eng.hud.invFilter = 'all';
    const addFreshItem = (name) => {
      const prevLen = w.player.inventory.length;
      if (!w.addItemToInventory(name, 1) || w.player.inventory.length <= prevLen) return null;
      return w.player.inventory[w.player.inventory.length - 1];
    };
    const tmpIds = [];
    for (let i = 0; i < 32; i += 1) {
      const added = addFreshItem('鋼盔');
      if (added?.id) tmpIds.push(added.id);
    }
    const targetSword = addFreshItem('長劍');
    if (targetSword?.id) {
      targetSword.plus = 0;
      targetSword.equipped = false;
      tmpIds.push(targetSword.id);
    }
    const targetJacket = addFreshItem('銀釘皮甲');
    if (targetJacket?.id) {
      targetJacket.plus = 0;
      targetJacket.equipped = false;
      tmpIds.push(targetJacket.id);
    }
    w.addItemToInventory('對武器施法的卷軸', 2);
    w.addItemToInventory('對盔甲施法的卷軸', 2);
    const weaponScroll = w.player.inventory.find((i) => i.name === '對武器施法的卷軸');
    const armorScroll = w.player.inventory.find((i) => i.name === '對盔甲施法的卷軸');
    window.__lineageEnchantTest = {
      tmpIds,
      targetSwordId: targetSword?.id || null,
      targetJacketId: targetJacket?.id || null,
      weaponScrollId: weaponScroll?.id || null,
      armorScrollId: armorScroll?.id || null,
      weaponScrollStartCount: Number(weaponScroll?.count || 0),
      armorScrollStartCount: Number(armorScroll?.count || 0),
    };
    return window.__lineageEnchantTest;
  });
  assert(
    enchantSetup.targetSwordId &&
      enchantSetup.targetJacketId &&
      enchantSetup.weaponScrollId &&
      enchantSetup.armorScrollId,
    `Failed to stage enchant & scroll test items: ${JSON.stringify(enchantSetup)}`
  );

  await page.click('[data-win="inventory"]');
  await page.waitForTimeout(160);

  // 檢查 3) 背包滾動後點擊道具／鎖定／反選不會跳回頂端
  const scrollTarget = await page.evaluate((setup) => {
    const grid = document.querySelector('.ll-inv-grid-4col');
    if (!grid) return { ok: false, reason: 'missing grid' };
    const maxScroll = Math.max(0, grid.scrollHeight - grid.clientHeight);
    if (maxScroll < 80) {
      return { ok: false, reason: `maxScroll=${maxScroll}`, scrollHeight: grid.scrollHeight, clientHeight: grid.clientHeight };
    }
    grid.scrollTop = Math.min(180, maxScroll);
    const skipIds = new Set([
      setup.targetSwordId,
      setup.targetJacketId,
      setup.weaponScrollId,
      setup.armorScrollId,
    ]);
    const gridRect = grid.getBoundingClientRect();
    const visibleSlot = [...grid.querySelectorAll('[data-select-item]')].find((el) => {
      const id = el.getAttribute('data-select-item');
      if (!id || skipIds.has(id)) return false;
      const r = el.getBoundingClientRect();
      return r.top >= gridRect.top + 6 && r.bottom <= gridRect.bottom - 6;
    });
    return {
      ok: Boolean(visibleSlot),
      beforeScrollTop: grid.scrollTop,
      visibleItemId: visibleSlot?.getAttribute('data-select-item') || null,
      maxScroll,
    };
  }, enchantSetup);
  assert(
    scrollTarget.ok && scrollTarget.beforeScrollTop >= 80 && scrollTarget.visibleItemId,
    `Inventory grid did not overflow enough for scroll test: ${JSON.stringify(scrollTarget)}`
  );

  await page.click(`[data-select-item="${scrollTarget.visibleItemId}"]`);
  await page.waitForTimeout(100);
  const afterSelectScroll = await page.evaluate(() => document.querySelector('.ll-inv-grid-4col')?.scrollTop ?? -1);
  assert(
    Math.abs(afterSelectScroll - scrollTarget.beforeScrollTop) <= 4,
    `Inventory scroll jumped after item click: before=${scrollTarget.beforeScrollTop}, after=${afterSelectScroll}`
  );

  await page.click(`[data-toggle-lock="${scrollTarget.visibleItemId}"]`);
  await page.waitForTimeout(100);
  const afterLockScroll = await page.evaluate(() => document.querySelector('.ll-inv-grid-4col')?.scrollTop ?? -1);
  assert(
    Math.abs(afterLockScroll - scrollTarget.beforeScrollTop) <= 4,
    `Inventory scroll jumped after item lock: before=${scrollTarget.beforeScrollTop}, after=${afterLockScroll}`
  );

  // 檢查 2) 武卷／防卷游標強化模式、錯配阻擋與包內未裝備強化
  await page.click(`[data-select-item="${enchantSetup.weaponScrollId}"]`);
  await page.waitForTimeout(100);
  await page.click(`[data-use-selected="${enchantSetup.weaponScrollId}"]`);
  await page.waitForTimeout(120);

  const wpnEnchantUi = await page.evaluate(({ targetSwordId, targetJacketId }) => {
    const win = document.querySelector('.ll-win.inv-win.enchant-targeting');
    const grid = document.querySelector('.ll-inv-grid-4col');
    const banner = document.querySelector('.ll-enchant-banner')?.textContent || '';
    const swordSlot = document.querySelector(`[data-select-item="${targetSwordId}"]`);
    const jacketSlot = document.querySelector(`[data-select-item="${targetJacketId}"]`);
    return {
      hasTargetingClass: Boolean(win),
      banner,
      gridCursor: grid ? getComputedStyle(grid).cursor : '',
      swordEligible: Boolean(swordSlot?.classList.contains('enchant-eligible')),
      jacketIneligible: Boolean(jacketSlot?.classList.contains('enchant-ineligible')),
    };
  }, enchantSetup);
  assert(
    wpnEnchantUi.hasTargetingClass &&
      wpnEnchantUi.banner.includes('對武器施法的卷軸') &&
      wpnEnchantUi.gridCursor.includes('data:image/svg+xml') &&
      wpnEnchantUi.swordEligible &&
      wpnEnchantUi.jacketIneligible,
    `Weapon enchant cursor mode UI failed: ${JSON.stringify(wpnEnchantUi)}`
  );

  // 點擊未裝備防具應阻擋且不消耗武卷
  await page.click(`[data-select-item="${enchantSetup.targetJacketId}"]`);
  await page.waitForTimeout(120);
  const mismatchCheck = await page.evaluate(({ targetJacketId, weaponScrollId }) => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    const jacket = w.player.inventory.find((i) => i.id === targetJacketId);
    const wpnScroll = w.player.inventory.find((i) => i.id === weaponScrollId);
    return {
      warnText: document.querySelector('.ll-enchant-warn')?.textContent || '',
      stillTargeting: Boolean(document.querySelector('.ll-win.inv-win.enchant-targeting')),
      jacketPlus: jacket?.plus ?? -1,
      wpnScrollCount: wpnScroll?.count ?? 0,
    };
  }, enchantSetup);
  assert(
    mismatchCheck.warnText.length > 0 &&
      mismatchCheck.stillTargeting &&
      mismatchCheck.jacketPlus === 0 &&
      mismatchCheck.wpnScrollCount === enchantSetup.weaponScrollStartCount,
    `Mismatched armor click under weapon scroll should warn without consuming scroll: ${JSON.stringify(mismatchCheck)}`
  );
  await page.screenshot({ path: path.join(scratchDir, 'lineage-enchant-mode.png') });

  // 點擊背包未裝備的長劍進行強化 -> +1
  await page.click(`[data-select-item="${enchantSetup.targetSwordId}"]`);
  await page.waitForTimeout(140);
  const afterSwordEnchant = await page.evaluate(({ targetSwordId, weaponScrollId }) => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    const sword = w.player.inventory.find((i) => i.id === targetSwordId);
    const wpnScroll = w.player.inventory.find((i) => i.id === weaponScrollId);
    return {
      swordPlus: sword?.plus ?? -1,
      swordEquipped: Boolean(sword?.equipped),
      wpnScrollCount: wpnScroll?.count ?? 0,
      stillTargeting: Boolean(document.querySelector('.ll-win.inv-win.enchant-targeting')),
    };
  }, enchantSetup);
  assert(
    afterSwordEnchant.swordPlus === 1 &&
      !afterSwordEnchant.swordEquipped &&
      afterSwordEnchant.wpnScrollCount === enchantSetup.weaponScrollStartCount - 1 &&
      !afterSwordEnchant.stillTargeting,
    `Bag weapon enchant failed: ${JSON.stringify(afterSwordEnchant)}`
  );

  // 按 Esc 只應取消強化游標模式，不關閉背包視窗
  await page.click(`[data-select-item="${enchantSetup.weaponScrollId}"]`);
  await page.waitForTimeout(100);
  await page.click(`[data-use-selected="${enchantSetup.weaponScrollId}"]`);
  await page.waitForTimeout(100);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const escCancelCheck = await page.evaluate(() => ({
    invStillOpen: Boolean(document.querySelector('.ll-win.inv-win')),
    targetingActive: Boolean(document.querySelector('.ll-win.inv-win.enchant-targeting')),
  }));
  assert(
    escCancelCheck.invStillOpen && !escCancelCheck.targetingActive,
    `Escape should cancel enchant mode while keeping inventory open: ${JSON.stringify(escCancelCheck)}`
  );

  // 防卷強化背包內未裝備銀釘皮甲（安定 4）-> +1
  await page.click(`[data-select-item="${enchantSetup.armorScrollId}"]`);
  await page.waitForTimeout(100);
  await page.click(`[data-use-selected="${enchantSetup.armorScrollId}"]`);
  await page.waitForTimeout(120);
  await page.click(`[data-select-item="${enchantSetup.targetJacketId}"]`);
  await page.waitForTimeout(140);
  const afterArmorEnchant = await page.evaluate(({ targetJacketId, armorScrollId }) => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    const jacket = w.player.inventory.find((i) => i.id === targetJacketId);
    const armScroll = w.player.inventory.find((i) => i.id === armorScrollId);
    const tmpIds = new Set(window.__lineageEnchantTest?.tmpIds || []);
    w.player.inventory = w.player.inventory.filter((i) => !tmpIds.has(i.id));
    w.recomputePlayerStats?.();
    return {
      jacketPlus: jacket?.plus ?? -1,
      jacketEquipped: Boolean(jacket?.equipped),
      armScrollCount: armScroll?.count ?? 0,
      stillTargeting: Boolean(document.querySelector('.ll-win.inv-win.enchant-targeting')),
    };
  }, enchantSetup);
  assert(
    afterArmorEnchant.jacketPlus === 1 &&
      !afterArmorEnchant.jacketEquipped &&
      afterArmorEnchant.armScrollCount === enchantSetup.armorScrollStartCount - 1 &&
      !afterArmorEnchant.stillTargeting,
    `Bag armor enchant failed: ${JSON.stringify(afterArmorEnchant)}`
  );
  await page.click('[data-close-modal="1"]');
  await page.waitForTimeout(100);

  // 檢查 4) 奇岩城（中央廣場）與奇岩內城傳送師 NPC
  const giranPlazaOpen = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    w.player.gold += 5000;
    w.teleportTo(4, 33432, 32818, 4);
    const plazaTp = w.npcs.find((n) => n.name === '奇岩傳送師' && n.map === 4 && n.type === 'Teleport');
    const innerTp = (w.worldData?.npcs || []).find(
      (n) => n.name === '奇岩內城傳送師' && n.map === 52 && n.type === 'Teleport'
    );
    if (plazaTp) eng.hud.openNpc(plazaTp);
    const tpButtons = [...document.querySelectorAll('[data-tp-idx]')].map((b) => ({
      idx: b.getAttribute('data-tp-idx'),
      text: b.closest('.ll-list-row')?.textContent || b.textContent || '',
    }));
    return {
      hasPlazaTp: Boolean(plazaTp),
      hasInnerTp: Boolean(innerTp),
      plazaCoords: plazaTp ? { x: plazaTp.x, y: plazaTp.y } : null,
      tpButtons,
    };
  });
  const innerRouteBtn = giranPlazaOpen.tpButtons.find((b) => b.text.includes('奇岩內城'));
  assert(
    giranPlazaOpen.hasPlazaTp && giranPlazaOpen.hasInnerTp && innerRouteBtn,
    `Giran Teleporter NPC check failed: ${JSON.stringify(giranPlazaOpen)}`
  );
  await page.screenshot({ path: path.join(scratchDir, 'lineage-giran-teleporter.png') });
  await page.click(`[data-tp-idx="${innerRouteBtn.idx}"]`);
  await page.waitForTimeout(250);

  const giranRoundTrip = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    const afterInnerMap = w.player.map;
    const innerTp = w.npcs.find((n) => n.name === '奇岩內城傳送師' && n.map === 52);
    if (innerTp) eng.hud.openNpc(innerTp);
    const backBtn = [...document.querySelectorAll('[data-tp-idx]')].find((b) =>
      (b.closest('.ll-list-row')?.textContent || b.textContent || '').includes('奇岩城（中央廣場')
    );
    return {
      afterInnerMap,
      backIdx: backBtn?.getAttribute('data-tp-idx') || null,
    };
  });
  assert(
    giranRoundTrip.afterInnerMap === 52 && giranRoundTrip.backIdx !== null,
    `Giran Inner Castle teleport failed: ${JSON.stringify(giranRoundTrip)}`
  );
  await page.click(`[data-tp-idx="${giranRoundTrip.backIdx}"]`);
  await page.waitForTimeout(250);
  const backPlazaPos = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    const out = { map: w.player.map, tx: w.player.tx, ty: w.player.ty };
    eng.hud.closeModal();
    return out;
  });
  assert(
    backPlazaPos.map === 4 && Math.abs(backPlazaPos.tx - 33432) <= 2 && Math.abs(backPlazaPos.ty - 32818) <= 2,
    `Giran Plaza return teleport failed: ${JSON.stringify(backPlazaPos)}`
  );

  // 驗證內掛設定介面新增「裝備損壞自動修復」控制項、磨刀石自動修復與金幣遠程修復
  await page.click('[data-win="auto"]');
  await page.waitForTimeout(160);
  const autoRepairUi = await page.evaluate(() => ({
    chk: Boolean(document.querySelector('[data-auto-check="autoRepairGear"]')),
    mode: document.querySelector('[data-auto-select="autoRepairMode"]')?.value || null,
    thr: document.querySelector('[data-auto-num="autoRepairThreshold"]')?.value || null,
  }));
  assert(
    autoRepairUi.chk && autoRepairUi.mode === 'auto' && autoRepairUi.thr === '1',
    `Auto-repair UI controls missing or unexpected: ${JSON.stringify(autoRepairUi)}`
  );
  await page.screenshot({ path: path.join(scratchDir, 'lineage-autorepair-settings.png') });
  await page.click('[data-close-modal="1"]');
  await page.waitForTimeout(100);

  const autoRepairResult = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    const p = w.player;
    const clsIdx = w.worldData.classes[p.classId]?.clsIdx ?? 0;
    let eqWeapon = p.inventory.find((i) => i.equipped && w.worldData.items[i.name]?.kind === 'weapon');
    if (!eqWeapon) {
      const anyWeapon = p.inventory.find((i) => w.worldData.items[i.name]?.kind === 'weapon');
      if (anyWeapon) {
        w.useItem(anyWeapon);
        eqWeapon = anyWeapon;
      }
    }
    let eqArmor = p.inventory.find(
      (i) => i.equipped && w.worldData.items[i.name]?.kind === 'armor' && (w.worldData.items[i.name]?.ac || 0) >= 2
    );
    if (!eqArmor) {
      const armorEntry = Object.entries(w.worldData.items).find(
        ([, d]) => d.kind === 'armor' && (d.ac || 0) >= 2 && (d.classes?.[clsIdx] ?? 1)
      );
      if (armorEntry) {
        w.addItemToInventory(armorEntry[0], 1, 0, { identified: true });
        const added = p.inventory.find((i) => i.name === armorEntry[0] && !i.equipped);
        if (added) {
          w.useItem(added);
          eqArmor = added;
        }
      }
    }
    if (!eqWeapon || !eqArmor) {
      return { skippedReason: 'missing equipped weapon or armor', hasW: Boolean(eqWeapon), hasA: Boolean(eqArmor) };
    }
    for (let i = p.inventory.length - 1; i >= 0; i -= 1) {
      if (p.inventory[i].name === '磨刀石') p.inventory.splice(i, 1);
    }
    w.recomputePlayerStats();
    const acClean = p.ac;
    p.hp = p.maxHp;
    p.food = 80;
    delete p.buffs.poison;

    // 先測手動使用磨刀石修復單件受損防具
    w.addItemToInventory('磨刀石', 1);
    eqArmor.brokenCount = 1;
    w.recomputePlayerStats();
    const acManualDamaged = p.ac;
    const manualStone = p.inventory.find((i) => i.name === '磨刀石');
    const manualRes = manualStone ? w.useItem(manualStone) : { ok: false };
    const afterManual = {
      ok: Boolean(manualRes?.ok),
      aBroken: eqArmor.brokenCount || 0,
      acRestored: p.ac,
      acManualDamaged,
    };

    // 再測內掛自動修復：給予 2 個磨刀石同時修復受損武器與防具
    w.addItemToInventory('磨刀石', 2);
    eqWeapon.brokenCount = 3;
    eqArmor.brokenCount = 2;
    w.recomputePlayerStats();
    const acDamaged = p.ac;

    p.autoConfig.enabled = true;
    p.autoConfig.autoRepairGear = true;
    p.autoConfig.autoRepairMode = 'auto';
    p.autoConfig.autoRepairThreshold = 1;
    eng.autoHunt.lastTick = 0;
    eng.autoHunt.lastRepairCheckAt = 0;
    eng.autoHunt.step(performance.now() + 2000);
    const stonesAfterWhetstone = p.inventory
      .filter((i) => i.name === '磨刀石')
      .reduce((s, i) => s + (i.count || 0), 0);
    const afterWhetstone = {
      wBroken: eqWeapon.brokenCount || 0,
      aBroken: eqArmor.brokenCount || 0,
      stonesLeft: stonesAfterWhetstone,
      acRestored: p.ac,
    };

    p.gold = Math.max(p.gold, 500);
    const goldBefore = p.gold;
    eqArmor.brokenCount = 2;
    w.recomputePlayerStats();
    eng.autoHunt.lastTick = 0;
    eng.autoHunt.lastRepairCheckAt = 0;
    eng.autoHunt.step(performance.now() + 5000);
    const afterGold = {
      aBroken: eqArmor.brokenCount || 0,
      goldSpent: goldBefore - p.gold,
      acRestored: p.ac,
    };

    p.autoConfig.autoRepairGear = false;
    eqWeapon.brokenCount = 1;
    w.recomputePlayerStats();
    eng.autoHunt.lastTick = 0;
    eng.autoHunt.lastRepairCheckAt = 0;
    eng.autoHunt.step(performance.now() + 8000);
    const afterDisabled = eqWeapon.brokenCount || 0;

    eqWeapon.brokenCount = 0;
    eqArmor.brokenCount = 0;
    p.autoConfig.autoRepairGear = true;
    p.autoConfig.enabled = false;
    eng.autoHunt.onExternalToggle(false);
    w.recomputePlayerStats();
    w.saveWorld(true, { immediate: true });
    return { acClean, afterManual, acDamaged, afterWhetstone, afterGold, afterDisabled };
  });
  assert(
    !autoRepairResult.skippedReason &&
      autoRepairResult.afterManual.ok &&
      autoRepairResult.afterManual.acManualDamaged > autoRepairResult.acClean &&
      autoRepairResult.afterManual.aBroken === 0 &&
      autoRepairResult.afterManual.acRestored === autoRepairResult.acClean &&
      autoRepairResult.acDamaged > autoRepairResult.acClean &&
      autoRepairResult.afterWhetstone.wBroken === 0 &&
      autoRepairResult.afterWhetstone.aBroken === 0 &&
      autoRepairResult.afterWhetstone.stonesLeft === 0 &&
      autoRepairResult.afterWhetstone.acRestored === autoRepairResult.acClean &&
      autoRepairResult.afterGold.aBroken === 0 &&
      autoRepairResult.afterGold.goldSpent >= 60 &&
      autoRepairResult.afterGold.acRestored === autoRepairResult.acClean &&
      autoRepairResult.afterDisabled === 1,
    `Auto-repair behavior failed: ${JSON.stringify(autoRepairResult)}`
  );

  // 驗證魔法書內僅存在分包的法術圖示（例如 11/20）透過分包 Blob 載入，不觸發散檔 404 與 Range 請求
  await page.evaluate(() => {
    const eng = window.__lineage.engine();
    if (eng?.world?.player && !eng.world.player.spells.includes(20)) {
      eng.world.player.spells.push(20);
    }
  });
  await page.click('[data-win="spells"]');
  await page.waitForTimeout(250);
  const spellModalCheck = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('.ll-win-body img')].map((img) => img.getAttribute('src') || '');
    return { imgs, hasModal: Boolean(document.querySelector('.ll-win-title')) };
  });
  assert(spellModalCheck.hasModal && spellModalCheck.imgs.length > 0, `Spells modal check failed: ${JSON.stringify(spellModalCheck)}`);
  await page.click('[data-close-modal="1"]');
  await page.waitForTimeout(100);

  // 驗證 .bin 分包無 Range 碎請求、無不存在於靜態磁碟的散檔請求（確保 Vercel / Cloudflare 零 404），且 CacheStorage 已寫入分包
  const rangeReqs = recordedAssetRequests.filter((r) => r.url.includes('/packs/') && Boolean(r.range));
  assert(rangeReqs.length === 0, `Unexpected HTTP Range pack requests: ${JSON.stringify(rangeReqs.slice(0, 5))}`);
  const missingStaticPaths = recordedAssetRequests
    .map((r) => new URL(r.url).pathname)
    .filter((pathname) => !fs.existsSync(path.join(repoRoot, pathname)));
  assert(
    missingStaticPaths.length === 0,
    `Requests to packed-only paths missing on static CDN: ${JSON.stringify([...new Set(missingStaticPaths)].slice(0, 10))}`
  );
  const manifestFetches = recordedAssetRequests.filter((r) => r.url.endsWith('/art-assets.json')).length;
  assert(manifestFetches === 1, `Expected art-assets.json to be fetched once, got ${manifestFetches}`);
  const cachedPackKeys = await page.evaluate(async () => {
    const c = await caches.open('lineage-286-assets-v1');
    return (await c.keys()).map((req) => req.url).filter((u) => u.includes('/packs/'));
  });
  assert(cachedPackKeys.length > 0, 'Expected CacheStorage lineage-286-assets-v1 to persist .bin packs');

  // 驗證藥水狀態（加速／勇敢藥水）在登出回選角與瀏覽器重載（pagehide/beforeunload）後仍完整保留剩餘時間
  const beforeBuffLogout = await page.evaluate(() => {
    const eng = window.__lineage.engine();
    const w = eng.world;
    w.addItemToInventory('綠色藥水', 1);
    w.addItemToInventory('勇敢藥水', 1);
    const hastePotion = w.player.inventory.find((i) => i.name === '綠色藥水');
    const bravePotion = w.player.inventory.find((i) => i.name === '勇敢藥水');
    if (hastePotion) w.useItem(hastePotion);
    if (bravePotion) w.useItem(bravePotion);
    const buffs = w.getBuffList();
    return {
      activeSlot: Number(w.lobbyChar?.slot ?? 0),
      hasHaste: buffs.some((b) => b.key === 'haste' && b.remainSec > 200),
      hasBrave: buffs.some((b) => b.key === 'brave' && b.remainSec > 200),
      keys: buffs.map((b) => b.key),
    };
  });
  assert(
    beforeBuffLogout.hasHaste && beforeBuffLogout.hasBrave,
    `Failed to activate haste/brave buffs before logout: ${JSON.stringify(beforeBuffLogout)}`
  );
  const buffSlot = beforeBuffLogout.activeSlot;

  await page.click('[data-win="auto"]');
  await page.waitForTimeout(150);
  await page.click('[data-sys-act="lobby"]');
  await page.waitForFunction(() => window.__lineage?.getState?.().stage === 'select', null, { timeout: 10000 });
  await page.waitForTimeout(150);

  const savedBuffsStorage = await page.evaluate((slot) => {
    const user = String(window.__lineage.getState().username || 'adventurer01').toLowerCase();
    const raw = localStorage.getItem(`ll286:${user}:world_slot_${slot}`);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.buffsRemaining || null;
  }, buffSlot);
  assert(
    savedBuffsStorage && Number(savedBuffsStorage.haste) > 200000 && Number(savedBuffsStorage.brave) > 200000,
    `Expected buffsRemaining persisted in localStorage after lobby logout, got: ${JSON.stringify(savedBuffsStorage)}`
  );

  await page.click(`[data-slot="${buffSlot}"]`);
  await page.waitForTimeout(80);
  await page.click('#load-btn-enter');
  await page.waitForFunction(
    () => {
      const g = window.__lineage.game?.();
      return window.__lineage.getState().gameFrame?.status === 'ready' && g && g.readyChunks >= 1;
    },
    null,
    { timeout: 12000 }
  );
  await page.waitForTimeout(250);

  const afterLobbyReenterBuffs = await page.evaluate(() => {
    const w = window.__lineage.engine().world;
    const buffs = w.getBuffList();
    const badges = document.querySelectorAll('[data-role="buff-strip"] .ll-buff-badge').length;
    return {
      haste: buffs.find((b) => b.key === 'haste')?.remainSec || 0,
      brave: buffs.find((b) => b.key === 'brave')?.remainSec || 0,
      badges,
    };
  });
  assert(
    afterLobbyReenterBuffs.haste > 180 && afterLobbyReenterBuffs.brave > 180 && afterLobbyReenterBuffs.badges >= 2,
    `Buffs not preserved after re-entering from lobby: ${JSON.stringify(afterLobbyReenterBuffs)}`
  );
  await page.screenshot({ path: path.join(scratchDir, 'lineage-buff-persist.png') });

  // 模擬瀏覽器直接重整／關閉分頁（beforeunload / pagehide）再重新登入進入角色
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__lineage && window.__lineage.ready === true, null, { timeout: 15000 });
  const postReloadStage = await page.evaluate(() => window.__lineage.getState().stage);
  if (postReloadStage === 'login') {
    await page.fill('#login-username', 'adventurer01');
    await page.fill('#login-password', 'pass1234');
    await page.click('#btn-auth-login');
    await page.waitForFunction(() => window.__lineage?.getState?.().stage === 'select', null, { timeout: 10000 });
  }
  await page.click(`[data-slot="${buffSlot}"]`);
  await page.waitForTimeout(80);
  await page.click('#load-btn-enter');
  await page.waitForFunction(
    () => {
      const g = window.__lineage.game?.();
      return window.__lineage.getState().gameFrame?.status === 'ready' && g && g.readyChunks >= 1;
    },
    null,
    { timeout: 12000 }
  );
  await page.waitForTimeout(250);

  const afterPageReloadBuffs = await page.evaluate(() => {
    const w = window.__lineage.engine().world;
    const buffs = w.getBuffList();
    const out = {
      haste: buffs.find((b) => b.key === 'haste')?.remainSec || 0,
      brave: buffs.find((b) => b.key === 'brave')?.remainSec || 0,
    };
    w.player.buffs = {};
    w.recomputePlayerStats();
    w.saveWorld(true, { immediate: true });
    return out;
  });
  assert(
    afterPageReloadBuffs.haste > 170 && afterPageReloadBuffs.brave > 170,
    `Buffs not preserved after full browser reload: ${JSON.stringify(afterPageReloadBuffs)}`
  );

  // 遊戲畫面沒有導覽列：以 navigate 離開，實境舞台容器要卸載
  await page.evaluate(() => window.__lineage.navigate('/official'));
  await page.waitForTimeout(200);
  assert(
    await page.evaluate(() => !document.getElementById('ll-game-host') && !document.getElementById('ll-game-root')),
    'Game host should unmount after leaving the lobby route'
  );

  // 驗證同一瀏覽器環境重開頁面時，已快取的 art-assets.json 與 .bin 分包不會重抓（0 CDN pack requests）
  const revisitReqs = [];
  const revisitPage = await context.newPage();
  revisitPage.on('request', (req) => {
    if (req.url().startsWith(`${baseOrigin}/assets/286/`)) revisitReqs.push(req.url());
  });
  await revisitPage.goto(pageUrl, { waitUntil: 'load' });
  await revisitPage.waitForFunction(() => window.__lineage && window.__lineage.ready === true, null, { timeout: 15000 });
  await revisitPage.evaluate(() => window.__lineage.navigate('/lobby'));
  try {
    await revisitPage.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="sw-status-text"]');
        return Boolean(el && el.textContent && el.textContent.includes('已快取') && !el.textContent.includes('已快取 0 /'));
      },
      null,
      { timeout: 10000 }
    );
  } catch (err) {
    const diag = await revisitPage.evaluate(async () => {
      const c = await caches.open('lineage-286-assets-v1');
      const keys = (await c.keys()).map((r) => r.url);
      return {
        swText: document.querySelector('[data-testid="sw-status-text"]')?.textContent || null,
        route: window.__lineage?.getState?.()?.route,
        stage: window.__lineage?.getState?.()?.stage,
        assetSummary: window.__lineage?.getState?.()?.assetSummary,
        cacheKeysCount: keys.length,
        hasManifestKey: keys.some((u) => u.includes('art-assets.json')),
      };
    });
    throw new Error(`revisit sw-status-text timeout: ${err.message} | diag=${JSON.stringify(diag)}`);
  }
  await revisitPage.waitForFunction(() => Boolean(window.__lastMapChunkData), null, { timeout: 10000 });
  const revisitSwText = await revisitPage.textContent('[data-testid="sw-status-text"]');
  const revisitDuplicatePacks = revisitReqs.filter((u) => u.endsWith('/art-assets.json') || u.includes('/packs/'));
  assert(
    revisitDuplicatePacks.length === 0,
    `Expected cached manifest & packs on revisit (0 requests), got: ${JSON.stringify(revisitDuplicatePacks)}`
  );
  assert(
    revisitSwText && revisitSwText.includes('已快取'),
    `Expected sw-status-text to show cached pack count, got: ${revisitSwText}`
  );
  await revisitPage.close();

  // 2. 巡覽其餘 8 個視圖並驗證互動與手機版 390x844 零水平溢出
  // (a) /official 官方入口
  await page.click('[data-nav="/official"]');
  await page.waitForTimeout(150);
  const officialTitle = await page.textContent('main');
  assert(officialTitle && officialTitle.includes('1.63'), 'Official stage should render 1.63 content');

  // (b) /guide 首發攻略圖鑑 (243 筆) 與 NPC 對話檢索
  await page.click('[data-nav="/guide"]');
  await page.waitForTimeout(200);
  st = await page.evaluate(() => window.__lineage.getState());
  assert(st.guideTotal === 243, `Expected 243 guide records, got ${st.guideTotal}`);
  await page.click('#btn-search-dialogue');
  await page.waitForTimeout(200);
  st = await page.evaluate(() => window.__lineage.getState());
  assert(st.dialogueResultsCount > 0, 'NPC dialogue search should return results');

  // (c) /form 冒險者論壇：新增主題、發表回覆、按讚
  await page.click('[data-nav="/form"]');
  await page.waitForTimeout(200);
  await page.fill('#forum-title-input', '說話之島打寶路線分享');
  await page.fill('#forum-body-input', '冒險洞窟一樓骷髏區適合新手騎士穩定練功與蒐集金幣。');
  await page.click('#forum-submit-btn');
  await page.waitForTimeout(200);
  await page.fill('#reply-input', '感謝分享！妖精帶弓也很順。');
  await page.click('#reply-submit-btn');
  await page.waitForTimeout(200);
  const forumState = await page.evaluate(() => window.__lineage.getState());
  assert(forumState.forumTopicsCount >= 11, `Expected >= 11 forum topics, got ${forumState.forumTopicsCount}`);

  // (d) /rice 能力骰子模擬器：單次擲骰 + 500 次蒙地卡羅分佈
  await page.click('[data-nav="/rice"]');
  await page.waitForTimeout(150);
  await page.click('[data-dice-class="darkelf"]');
  await page.click('#roll-once-btn');
  await page.click('#simulate-btn');
  await page.waitForTimeout(150);
  const simResultText = await page.textContent('[data-testid="sim-result"]');
  assert(simResultText && simResultText.includes('500'), 'Dice simulation result should show 500 runs');

  // (e) /topup 蛋幣儲值與 Origin Guard 簽章驗證 + Google Play 雙重領取防護
  await page.click('[data-nav="/topup"]');
  await page.waitForTimeout(150);
  await page.click('#checkout-btn');
  await page.waitForTimeout(200);
  await page.click('#webhook-btn');
  await page.waitForTimeout(200);
  await page.click('#gp-verify-btn');
  await page.waitForTimeout(200);
  const topupText = await page.textContent('main');
  assert(topupText && topupText.includes('入帳完成'), 'Topup view should render Origin Pay webhook completion');

  // (f) /gm GM 控制台：載入稽核與切換維護模式
  await page.click('[data-nav="/gm"]');
  await page.waitForTimeout(150);
  await page.click('#gm-load-btn');
  await page.waitForTimeout(200);
  await page.click('#gm-maint-btn');
  await page.waitForTimeout(150);
  await page.click('#gm-maint-btn');
  await page.waitForTimeout(150);
  await page.click('#gm-grant-btn');
  await page.waitForTimeout(150);
  const gmText = await page.textContent('[data-testid="gm-audit-list"]');
  assert(gmText && gmText.includes('grant_eggs'), 'GM audit list should record grant_eggs action');

  // (g) /privacy 與 /privacy2 隱私權政策，並檢查各視圖在手機 390x844 下零水平溢出
  for (const r of ['/official', '/guide', '/form', '/rice', '/topup', '/gm', '/privacy', '/privacy2']) {
    await page.evaluate((route) => window.__lineage.navigate(route), r);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(80);
    const check = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    assert(
      check.scrollWidth <= check.innerWidth,
      `Horizontal overflow on route ${r} at 390x844: scrollWidth=${check.scrollWidth} > innerWidth=${check.innerWidth}`
    );
  }

  // 3. 產出 640x400 精選代表縮圖 thumbs/286.jpg（展示經典 8 職業創角／說話之島冒險大廳）
  const thumbCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 0.5,
  });
  await attachContext(thumbCtx);
  const thumbPage = await thumbCtx.newPage();
  await thumbPage.goto(pageUrl, { waitUntil: 'load' });
  await thumbPage.waitForFunction(() => window.__lineage && window.__lineage.ready === true);
  await thumbPage.evaluate(() => {
    window.__lineage.navigate('/');
    window.__lineage.setStage('create');
  });
  await thumbPage.waitForTimeout(300);
  await thumbPage.screenshot({
    path: thumbOut,
    type: 'jpeg',
    quality: 88,
  });
  await thumbCtx.close();
  console.log(`Saved thumbnail to ${thumbOut}`);

  assert(badResponses.length === 0, `HTTP >= 400 responses detected: ${badResponses.join(' | ')}`);
  assert(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(' | ')}`);
  assert(pageErrors.length === 0, `Uncaught page errors detected: ${pageErrors.join(' | ')}`);
  assert(externalRequests.length === 0, `External network requests detected: ${externalRequests.join(' | ')}`);

  console.log('ALL 286-LINEAGE-WEB ACCEPTANCE CHECKS PASSED!');
} finally {
  await browser.close();
  if (server) server.close();
}
