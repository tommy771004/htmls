// 實機驗收與自動化試駕調校腳本（Playwright Headless Chrome）
// 1. 檢查 5 種視窗尺寸（1440x900, 1280x600, 1024x768, 844x390, 390x844）零水平溢出與零報錯
// 2. 驗證車庫 D/C/B/A/S 五級選車、車漆切換與 360 度展台渲染
// 3. 執行多車款（FWD / RWD / AWD）、多場景（筑波賽道完整單圈 + 有明試車場甩尾/跳台/越野砂石）實機試駕與物理遙測驗證
// 4. 驗證 Web Audio API 即時合成引擎聲浪 AnalyserNode 時域波形峰值輸出
// 5. 產出網站縮圖 thumbs/285.jpg (640x400) 與視覺檢驗截圖

import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gameRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(gameRoot, '../..');
const thumbOut = path.join(repoRoot, 'thumbs/285.jpg');
const scratchDir =
  '/Users/tommy/.gemini/antigravity-cli/brain/20f849e1-c8cc-4103-a022-87a68dbe2ce2/scratch';

fs.mkdirSync(scratchDir, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function startStaticServer(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }
      const rel = urlPath === '/' ? '/index.html' : urlPath;
      const filePath = path.join(rootDir, rel);
      if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
  });
}

function findChromeExecutable() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    process.env.CHROME_PATH
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function assert(cond, msg) {
  if (!cond) {
    throw new Error(`ACCEPTANCE FAILED: ${msg}`);
  }
}

const { server, port } = await startStaticServer(repoRoot);
const pageUrl = `http://127.0.0.1:${port}/web/285-apex-stage.html`;

const executablePath = findChromeExecutable();
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
});

const consoleErrors = [];
const pageErrors = [];
const externalRequests = [];

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });
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
      !u.startsWith(`http://127.0.0.1:${port}/`) &&
      !u.startsWith('file://') &&
      !u.startsWith('data:') &&
      !u.startsWith('blob:')
    ) {
      externalRequests.push(u);
    }
  });
  page.on('requestfailed', (req) => {
    consoleErrors.push(`Request failed: ${req.url()}`);
  });

  console.log(`Opening ${pageUrl} ...`);
  await page.goto(pageUrl, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__apex && window.__apex.ready === true, null, { timeout: 15000 });

  // 1. 檢查多視窗尺寸響應式排版與零水平溢出
  const viewports = [
    { width: 1440, height: 900, name: 'desktop-1440x900' },
    { width: 1280, height: 600, name: 'laptop-1280x600' },
    { width: 1024, height: 768, name: 'tablet-1024x768' },
    { width: 844, height: 390, name: 'mobile-landscape-844x390' },
    { width: 390, height: 844, name: 'mobile-portrait-390x844' }
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(120);
    const layout = await page.evaluate(() => ({
      hasViewportMeta: !!document.querySelector('meta[name="viewport"]'),
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      canvasW: document.getElementById('gameCanvas')?.clientWidth || 0,
      canvasH: document.getElementById('gameCanvas')?.clientHeight || 0
    }));
    assert(layout.hasViewportMeta, `Missing <meta name="viewport"> on ${vp.name}`);
    assert(
      layout.scrollWidth <= layout.innerWidth,
      `Horizontal overflow on ${vp.name}: scrollWidth=${layout.scrollWidth} > innerWidth=${layout.innerWidth}`
    );
    assert(layout.canvasW >= vp.width - 2 && layout.canvasH >= vp.height - 2, `Canvas size mismatch on ${vp.name}`);
  }

  // 拍一張手機直向車庫截圖
  await page.screenshot({ path: path.join(scratchDir, 'garage-mobile-390x844.png') });

  // 切回 1440x900 進行車庫展示、五級車款切換與烤漆檢驗
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(150);

  for (const cls of ['D', 'C', 'B', 'A', 'S']) {
    await page.click(`#classTabs .cls-tab[data-class="${cls}"]`);
    await page.waitForTimeout(80);
    const info = await page.evaluate(() => window.__apex.info());
    assert(info.classId === cls, `Expected class ${cls}, got ${info.classId}`);
  }

  // 拍一張 S 級原型賽車在車庫聚光燈旋轉台上的高畫質截圖
  await page.evaluate(() => {
    window.__apex.selectClass('S');
    window.__apex.selectPaint(0); // 烈焰金屬橘
    window.__apex.stepPhysics(25);
  });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(scratchDir, 'garage-desktop-class-s.png') });

  // 2. 點擊「START DRIVE」進入筑波賽道，喚醒 Web Audio 並驗證即時合成引擎聲浪輸出
  await page.evaluate(() => {
    window.__apex.selectCar('akagi-s220'); // Class C RWD
    window.__apex.selectPaint(1); // 灣岸電光藍
    window.__apex.selectTrack('circuit');
  });
  await page.click('#btnStartDrive');
  await page.waitForTimeout(120);

  // 跳過倒數並全油門加速 90 步，量測 Web Audio AnalyserNode 即時波形峰值
  const audioDriveCheck = await page.evaluate(async () => {
    window.__apex.startDriving({ skipCountdown: true });
    window.__apex.stepPhysics(90, { steer: 0, throttle: 1.0, brake: 0, handbrake: false });
    await new Promise((r) => setTimeout(r, 120));
    window.__apex.stepPhysics(10, { steer: 0, throttle: 1.0, brake: 0, handbrake: false });
    return window.__apex.info();
  });
  console.log('Audio & Launch Telemetry (Class C RWD):', {
    audioState: audioDriveCheck.audioState,
    audioPeak: audioDriveCheck.audioPeak,
    speedKmh: audioDriveCheck.speedKmh,
    rpm: audioDriveCheck.rpm,
    gear: audioDriveCheck.gear,
    boostBar: audioDriveCheck.boostBar
  });
  assert(audioDriveCheck.mode === 'driving', 'Should be in driving mode');
  assert(audioDriveCheck.audioState === 'running', `AudioContext should be running, got ${audioDriveCheck.audioState}`);
  assert(audioDriveCheck.audioPeak > 0.005, `Expected non-zero Web Audio waveform peak > 0.005, got ${audioDriveCheck.audioPeak}`);
  assert(audioDriveCheck.speedKmh > 45, `Expected speed > 45 km/h after 100 steps, got ${audioDriveCheck.speedKmh}`);

  // 拍一張筑波賽道追尾視角駕駛截圖
  await page.screenshot({ path: path.join(scratchDir, 'driving-circuit-chase.png') });

  // 3. 筑波賽道（TSUKUBA APEX CIRCUIT）實機完整單圈試駕與遙測驗證
  const circuitLapSummary = await page.evaluate(() => {
    window.__apex.selectCar('stuttgart-gtrs'); // Class A Supercar
    window.__apex.selectPaint(3); // 鈴鹿賽車黃
    window.__apex.selectTrack('circuit');
    window.__apex.startDriving({ skipCountdown: true });
    window.__apex.setAutopilot(true);

    let maxSpeed = 0;
    let maxLatG = 0;
    let minPitchDeg = 0;
    let maxRollDeg = 0;
    let hitCurb = false;
    let maxCheckpointsReached = 0;

    // 推進最多 3600 步（60 秒模擬時間）完成至少一整圈
    for (let step = 0; step < 3600; step++) {
      const info = window.__apex.stepPhysics(1);
      if (info.speedKmh > maxSpeed) maxSpeed = info.speedKmh;
      if (Math.abs(info.latG) > maxLatG) maxLatG = Math.abs(info.latG);
      if (info.bodyPitchDeg < minPitchDeg) minPitchDeg = info.bodyPitchDeg;
      if (Math.abs(info.bodyRollDeg) > maxRollDeg) maxRollDeg = Math.abs(info.bodyRollDeg);
      if (info.onCurb) hitCurb = true;
      if (info.nextCheckpoint > maxCheckpointsReached) maxCheckpointsReached = info.nextCheckpoint;
      if (info.lapCount >= 2 && info.bestLapMs > 0) {
        return {
          completedLap: true,
          stepsTaken: step + 1,
          bestLapMs: info.bestLapMs,
          sectors: info.sectors,
          maxSpeed,
          maxLatG,
          minPitchDeg,
          maxRollDeg,
          hitCurb,
          finalInfo: info
        };
      }
    }
    return {
      completedLap: false,
      maxSpeed,
      maxLatG,
      minPitchDeg,
      maxRollDeg,
      hitCurb,
      maxCheckpointsReached,
      finalInfo: window.__apex.info()
    };
  });

  console.log('Circuit Track Lap Telemetry:', {
    completedLap: circuitLapSummary.completedLap,
    bestLapMs: circuitLapSummary.bestLapMs,
    sectors: circuitLapSummary.sectors,
    maxSpeed: circuitLapSummary.maxSpeed,
    maxLatG: circuitLapSummary.maxLatG,
    minPitchDeg: circuitLapSummary.minPitchDeg,
    maxRollDeg: circuitLapSummary.maxRollDeg
  });

  assert(circuitLapSummary.completedLap, `Autopilot should complete a full lap on Circuit Track (reached CP ${circuitLapSummary.maxCheckpointsReached})`);
  assert(circuitLapSummary.bestLapMs > 15000, `Lap time should be realistic (>15s), got ${circuitLapSummary.bestLapMs}ms`);
  assert(circuitLapSummary.maxSpeed > 125, `Expected top speed > 125 km/h on straight, got ${circuitLapSummary.maxSpeed}`);
  assert(circuitLapSummary.maxRollDeg > 0.3, `Expected measurable body roll in corners, got ${circuitLapSummary.maxRollDeg}`);

  // 4. 有明綜合試車場（ARIAKE PROVING GROUND）：RWD 定圓甩尾、AWD 越野砂石拉力與飛躍跳台測試
  const provingSummary = await page.evaluate(() => {
    window.__apex.setAutopilot(false);
    window.__apex.selectTrack('proving');

    // (a) Class C RWD 於 Skidpad 執行手煞車慣性甩尾
    window.__apex.selectCar('akagi-s220');
    window.__apex.startDriving({ skipCountdown: true });
    window.__apex.jumpZone('skidpad');
    window.__apex.stepPhysics(110, { steer: 0, throttle: 1.0, brake: 0, handbrake: false });
    window.__apex.stepPhysics(28, { steer: 0.85, throttle: 0.9, brake: 0, handbrake: true });
    const driftInfo = window.__apex.stepPhysics(35, { steer: -0.45, throttle: 0.85, brake: 0, handbrake: false });

    // (b) Class B AWD 拉力車於越野砂石區（Off-Road Rally Dirt Zone）高速衝刺
    window.__apex.selectCar('pleiades-wrx555');
    window.__apex.jumpZone('offroad');
    const rallyInfo = window.__apex.stepPhysics(150, { steer: 0.15, throttle: 1.0, brake: 0, handbrake: false });

    // (c) 飛躍跳台區（Stunt Ramps）騰空與四輪懸吊壓縮落地測試
    window.__apex.jumpZone('ramps');
    let sawAirborne = false;
    let maxCompression = 0;
    for (let i = 0; i < 180; i++) {
      const st = window.__apex.stepPhysics(1, { steer: 0, throttle: 1.0, brake: 0, handbrake: false });
      if (st.airborne) sawAirborne = true;
      for (const w of st.wheels) {
        if (w.compression > maxCompression) maxCompression = w.compression;
      }
    }
    const afterRampInfo = window.__apex.info();

    return {
      driftSlipAngle: Math.abs(driftInfo.slipAngleDeg),
      driftWheelSlip: driftInfo.maxWheelSlip,
      rallySurface: rallyInfo.dominantSurface,
      rallySpeedKmh: rallyInfo.speedKmh,
      sawAirborne,
      maxCompression,
      landedSafely: afterRampInfo.wheels.filter((w) => w.inContact).length >= 2
    };
  });

  console.log('Proving Ground Multi-Zone Telemetry:', provingSummary);
  assert(provingSummary.driftWheelSlip > 0.4, `Expected high wheel slip during RWD drift, got ${provingSummary.driftWheelSlip}`);
  assert(
    provingSummary.rallySurface === 'gravel' || provingSummary.rallySurface === 'dirt',
    `Expected gravel/dirt surface in off-road zone, got ${provingSummary.rallySurface}`
  );
  assert(provingSummary.rallySpeedKmh > 65, `Expected AWD rally car speed > 65 km/h on gravel, got ${provingSummary.rallySpeedKmh}`);
  assert(provingSummary.maxCompression > 0.25, `Expected suspension compression > 0.25 on ramps/bumps, got ${provingSummary.maxCompression}`);
  assert(provingSummary.landedSafely, 'Vehicle should remain upright and land safely');

  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(scratchDir, 'driving-proving-ground.png') });

  // 5. 產出 640x400 精選代表縮圖 thumbs/285.jpg（展示筑波賽道上橘色 993 GT-RS 過彎追尾動態與街機 HUD）
  const thumbCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 0.5
  });
  const thumbPage = await thumbCtx.newPage();
  await thumbPage.goto(pageUrl, { waitUntil: 'load' });
  await thumbPage.waitForFunction(() => window.__apex && window.__apex.ready === true);
  await thumbPage.evaluate(() => {
    window.__apex.selectCar('stuttgart-gtrs');
    window.__apex.selectPaint(0); // 烈焰金屬橘
    window.__apex.selectTrack('circuit');
    window.__apex.startDriving({ skipCountdown: true });
    window.__apex.setAutopilot(true);
    window.__apex.stepPhysics(195);
  });
  await thumbPage.waitForTimeout(150);
  await thumbPage.screenshot({
    path: thumbOut,
    type: 'jpeg',
    quality: 88
  });
  await thumbCtx.close();
  console.log(`Saved thumbnail to ${thumbOut}`);

  assert(consoleErrors.length === 0, `Console errors detected: ${consoleErrors.join(' | ')}`);
  assert(pageErrors.length === 0, `Uncaught page errors detected: ${pageErrors.join(' | ')}`);
  assert(externalRequests.length === 0, `External network requests detected: ${externalRequests.join(' | ')}`);

  console.log('ALL ACCEPTANCE & REAL-BROWSER TEST-DRIVE CHECKS PASSED!');
} finally {
  await browser.close();
  server.close();
}
