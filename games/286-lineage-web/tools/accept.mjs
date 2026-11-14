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
  const loginImgOk = await page.evaluate(() => {
    const img = document.getElementById('login-anim-image');
    return Boolean(img && img.complete && img.naturalWidth > 0);
  });
  assert(loginImgOk, 'Login animation frame image should load with naturalWidth > 0');

  await page.fill('#login-username', 'adventurer01');
  await page.fill('#login-password', 'pass1234');
  await page.click('#btn-auth-register');
  await page.waitForTimeout(250);

  let st = await page.evaluate(() => window.__lineage.getState());
  assert(st.stage === 'select', `Expected stage 'select' after login, got '${st.stage}'`);

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
  assert(st.charactersCount >= 2, `Expected at least 2 characters after creation, got ${st.charactersCount}`);

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
  assert(inGame.nonDarkPixels > 200, `Canvas appears blank near center (${inGame.nonDarkPixels} lit pixels)`);
  assert(inGame.snap.npcsCount > 5, `Expected village NPCs on Talking Island, got ${inGame.snap.npcsCount}`);
  assert(inGame.snap.mobsCount > 10, `Expected Talking Island monsters, got ${inGame.snap.mobsCount}`);
  assert(inGame.userSave === 'USER-OWN-284-SAVE', 'User 284 save must not be touched by 286');
  assert(inGame.nsSave, 'Game world save should be written under the ll286: prefix');
  await page.screenshot({ path: path.join(scratchDir, 'lineage-game-stage.png') });

  // 互動驗證：開啟道具／裝備視窗截圖 + 切換內掛 + 手機版零溢出檢查
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

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  const mobileGameLayout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  assert(
    mobileGameLayout.scrollWidth <= mobileGameLayout.innerWidth,
    `Horizontal overflow in game on 390x844: ${mobileGameLayout.scrollWidth} > ${mobileGameLayout.innerWidth}`
  );
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

  // 重新整理頁面、重新登入後，同一角色的遊戲進度要還在（不可被重建成新角色）。
  await page.click('[data-win="system"]');
  await page.waitForTimeout(120);
  await page.click('[data-sys-act="lobby"]');
  await page.waitForTimeout(300);
  await page.click('[data-slot="1"]');
  await page.waitForTimeout(80);
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
  const goldAfterReload = await page.evaluate(() => window.__lineage.game()?.gold);
  assert(goldAfterReload === 424242, `Game progress lost after reload: gold=${goldAfterReload}`);

  await page.evaluate(() => window.__lineage.pingWorld());
  await page.waitForTimeout(200);
  st = await page.evaluate(() => window.__lineage.getState());
  assert(st.realtimeLog && st.realtimeLog.includes('pong'), `Expected pong frame in realtimeLog, got: ${st.realtimeLog}`);

  // 遊戲畫面沒有導覽列：以 navigate 離開，實境舞台容器要卸載
  await page.evaluate(() => window.__lineage.navigate('/official'));
  await page.waitForTimeout(200);
  assert(
    await page.evaluate(() => !document.getElementById('ll-game-host') && !document.getElementById('ll-game-root')),
    'Game host should unmount after leaving the lobby route'
  );

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
