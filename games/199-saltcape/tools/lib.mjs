// 驗收工具共用：載入 Playwright、啟動 Chromium（先 Metal GPU，失敗退 SwiftShader）、開頁並等待 __sc。
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';

export async function loadPlaywright() {
  const p = process.env.PLAYWRIGHT_MODULE || resolve(homedir(), '.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs');
  if (!existsSync(p)) throw new Error(`找不到 Playwright：${p}（請設定 PLAYWRIGHT_MODULE）`);
  const m = await import(pathToFileURL(p).href);
  return m.chromium || m.default.chromium;
}
export const GPU_ARGS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
export const SOFT_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
export const toUrl = (p) => (/^(https?|file):/.test(p) ? p : pathToFileURL(resolve(p)).href);
const isLocal = (u) => /^(file|data|blob|about):/.test(u) || /^(https?|wss?):\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(u);

export async function open(url, { w = 1440, h = 900, touch = false, soft = false } = {}) {
  const chromium = await loadPlaywright();
  let lastErr;
  for (const args of soft ? [SOFT_ARGS] : [GPU_ARGS, SOFT_ARGS]) {
    const browser = await chromium.launch({ headless: true, args });
    try {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const log = { errors: [], pageerrors: [], external: [], gpu: args === GPU_ARGS ? 'metal' : 'swiftshader' };
      page.on('pageerror', (e) => log.pageerrors.push(String(e.message || e)));
      page.on('console', (m) => { if (m.type() === 'error') log.errors.push(m.text()); });
      page.on('request', (r) => { const u = r.url(); if (!isLocal(u)) log.external.push(u); });
      await page.goto(toUrl(url), { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => window.__sc && window.__sc.ready, null, { timeout: 40000 });
      return { browser, page, log };
    } catch (e) { lastErr = e; await browser.close(); }
  }
  throw lastErr;
}
export const raf = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
