// 驗收工具共用：啟動 Chromium（先 Metal GPU，失敗退 SwiftShader）、開頁並等待 window.__cb。
// Playwright 用本資料夾的 playwright-core；瀏覽器用 ~/Library/Caches/ms-playwright 裡快取的 Chrome for Testing（可用 CHROME_PATH 指定）。
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = resolve(homedir(), 'Library/Caches/ms-playwright');
  const dirs = existsSync(base) ? readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse() : [];
  for (const d of dirs) {
    for (const sub of ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-linux/chrome']) {
      const p = resolve(base, d, sub);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

export const GPU_ARGS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
export const SOFT_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
export const toUrl = (p) => (/^(https?|file):/.test(p) ? p : pathToFileURL(resolve(p)).href);
const isLocal = (u) => /^(file|data|blob|about):/.test(u) || /^(https?|wss?):\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(u);

export async function open(url, { w = 1440, h = 900, touch = false, soft = false, query = '' } = {}) {
  let lastErr;
  for (const args of soft ? [SOFT_ARGS] : [GPU_ARGS, SOFT_ARGS]) {
    const browser = await chromium.launch({ headless: true, args, executablePath: chromePath() });
    try {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const log = { errors: [], warns: [], pageerrors: [], external: [], gpu: args === GPU_ARGS ? 'metal' : 'swiftshader' };
      page.on('pageerror', (e) => log.pageerrors.push(String(e.message || e)));
      page.on('console', (m) => { if (m.type() === 'error') log.errors.push(m.text()); if (m.type() === 'warning') log.warns.push(m.text()); });
      page.on('request', (r) => { const u = r.url(); if (!isLocal(u)) log.external.push(u); });
      await page.goto(toUrl(url) + query, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => window.__cb && window.__cb.game, null, { timeout: 40000 });
      return { browser, page, log };
    } catch (e) { lastErr = e; await browser.close(); }
  }
  throw lastErr;
}
export const raf = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
