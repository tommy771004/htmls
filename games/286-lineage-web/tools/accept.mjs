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
  // 騎士獎勵點數為 8 點（STR +4 至上限 20、CON +4 至 18）後即可按「開始遊戲」
  for (let i = 0; i < 4; i += 1) {
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
    const expRect = document.querySelector('.ll-exp-footer')?.getBoundingClientRect();
    const consoleRect = document.querySelector('.ll-center-console')?.getBoundingClientRect();
    return {
      count: lines.length,
      minHeight,
      logText,
      logBeforeH,
      radarW: radarRect?.width || 0,
      expW: expRect?.width || 0,
      consoleCenterDiff: consoleRect ? Math.abs(consoleRect.left + consoleRect.width / 2 - window.innerWidth / 2) : 999,
    };
  });
  assert(hudCheck.count >= 1 && hudCheck.minHeight >= 14, `Log line vertically clipped: ${JSON.stringify(hudCheck)}`);
  assert(hudCheck.logText.includes('目前座標'), `Chat /loc command should append location log, got: ${hudCheck.logText}`);
  assert(hudCheck.radarW >= 120, `Top-right minimap radar should render on desktop, got width=${hudCheck.radarW}`);
  assert(hudCheck.expW >= 1400, `Bottom EXP footer should span full viewport, got width=${hudCheck.expW}`);
  assert(hudCheck.consoleCenterDiff <= 140, `Center console should stay horizontally centered, diff=${hudCheck.consoleCenterDiff}`);

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
  assert(
    await page.evaluate(() => window.__lineage.game()?.activeModal === 'status'),
    'Pressing KeyS should open status paperdoll modal'
  );
  await page.screenshot({ path: path.join(scratchDir, 'lineage-game-status.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);

  await page.keyboard.press('KeyK');
  await page.waitForTimeout(150);
  assert(
    await page.evaluate(() => window.__lineage.game()?.activeModal === 'spells'),
    'Pressing KeyK should open spells modal'
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);

  await page.keyboard.press('KeyI');
  await page.waitForTimeout(200);
  assert(
    await page.evaluate(() => window.__lineage.game()?.activeModal === 'inventory'),
    'Pressing KeyI should open inventory modal'
  );
  await page.screenshot({ path: path.join(scratchDir, 'lineage-game-inventory.png') });
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
    const vpLayout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    assert(
      vpLayout.scrollWidth <= vpLayout.innerWidth,
      `Horizontal overflow in game on ${vp.width}x${vp.height}: ${vpLayout.scrollWidth} > ${vpLayout.innerWidth}`
    );
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
    w.player.mp = Math.max(w.player.mp, 200);
    for (const sid of [14, 26, 31, 32, 42, 43, 48]) {
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
    if (skelScroll) w.useItem(skelScroll.id);
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
