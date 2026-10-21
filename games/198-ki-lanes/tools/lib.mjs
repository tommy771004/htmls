// 驗收工具共用：載入 Playwright、啟動 Chromium（先 Metal GPU，失敗退 SwiftShader）、開頁並等待 __ki。
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';

export async function loadPlaywright() {
  const p = process.env.PLAYWRIGHT_MODULE || resolve(homedir(), '.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs');
  if (existsSync(p)) {
    const m = await import(pathToFileURL(p).href);
    return m.chromium || m.default.chromium;
  }
  // 沒有 Playwright 快取時：用 node_modules 的 playwright-core 開系統的 Chrome（CHROME_PATH 可指定）
  const chrome = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  let core;
  try { core = (await import('playwright-core')).chromium; } catch (_) {}
  if (!core || !existsSync(chrome)) throw new Error(`找不到 Playwright：${p}（請設定 PLAYWRIGHT_MODULE，或安裝 playwright-core 並設定 CHROME_PATH）`);
  return { launch: (o = {}) => core.launch({ executablePath: chrome, ...o }) };
}
export const GPU_ARGS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
export const SOFT_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
export const toUrl = (p) => (/^(https?|file):/.test(p) ? p : pathToFileURL(resolve(p)).href);

export const isFont = (u) => /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u);
export const isLocal = (u) => /^(file|data|blob|about):/.test(u) || /^http:\/\/127\.0\.0\.1:\d+\//.test(u);

// 開頁；回傳 { browser, page, log }。log 收集 pageerror / console.error / 外部請求
export async function open(html, { w = 1440, h = 900, touch = false } = {}) {
  const chromium = await loadPlaywright();
  let lastErr;
  for (const args of [GPU_ARGS, SOFT_ARGS]) {
    const browser = await chromium.launch({ headless: true, args });
    try {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const log = { errors: [], pageerrors: [], external: [], gpu: args === GPU_ARGS ? 'metal' : 'swiftshader' };
      page.on('pageerror', (e) => log.pageerrors.push(String(e.message || e)));
      page.on('console', (m) => { if (m.type() === 'error') { const u = (m.location() && m.location().url) || ''; if (!isFont(u) && !/fonts\.(googleapis|gstatic)/.test(m.text())) log.errors.push(m.text()); } });
      page.on('request', (r) => { const u = r.url(); if (!isLocal(u) && !isFont(u)) log.external.push(u); });
      await page.goto(toUrl(html), { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => window.__ki && window.__ki.ready, null, { timeout: 40000 });
      return { browser, page, log };
    } catch (e) { lastErr = e; await browser.close(); }
  }
  throw lastErr;
}

// 靜態檔伺服器（根目錄是整個網站 htmls/）：要載入 ../assets/198/ 的 GLB 角色時，頁面得經 HTTP 開啟。回傳 { url(path), close() }
export async function serveSite() {
  const http = await import('node:http');
  const { readFile } = await import('node:fs/promises');
  const { extname, join, normalize } = await import('node:path');
  const site = resolve(new URL('.', import.meta.url).pathname, '../../..');
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
  const srv = http.createServer(async (q, s) => {
    const p = normalize(decodeURIComponent(new URL(q.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    try { const b = await readFile(join(site, p)); s.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); s.end(b); } catch (_) { s.writeHead(404); s.end(); }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}/`;
  return { url: (p) => base + p.replace(/^\//, ''), close: () => srv.close() };
}
