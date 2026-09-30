// 用本機 Chrome 無頭開啟單檔並截圖（1440×900、390×844、844×390），同時印出 console 錯誤與外部請求。
// 用法：node tools/shot.mjs [html=../../web/195-sidewinder.html] [--out=shots] [--race[=賽道 0..3]] [--secs=6] [--wait=1500]
//       [--size=1440x900,390x844] [--swiftshader] [--eval "JS 運算式"]
// 預設用真 GPU（Apple 的 Metal ANGLE）；沒有 GPU 的環境加 --swiftshader。--eval 的結果以 RESULT: 開頭印在最後。
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const CHROME = process.env.CHROME || {
  win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
}[process.platform] || '/usr/bin/google-chrome';
export const GPU_ARGS = ['--ignore-gpu-blocklist', '--use-angle=metal'];
export const SWIFTSHADER_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const COMMON_ARGS = ['--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files'];

export async function launch({ swiftshader = process.argv.includes('--swiftshader') } = {}) {
  const gpu = swiftshader ? SWIFTSHADER_ARGS : process.platform === 'darwin' ? GPU_ARGS : ['--ignore-gpu-blocklist'];
  return puppeteer.launch({ executablePath: CHROME, headless: 'new', args: [...gpu, ...COMMON_ARGS] });
}

export function toUrl(p) {
  if (/^(https?|file):/.test(p)) return p;
  const i = p.search(/[?#]/); // 保留 query string
  return i < 0 ? pathToFileURL(resolve(p)).href : pathToFileURL(resolve(p.slice(0, i))).href + p.slice(i);
}

// 等 window.__sw 就緒：__sw.ready 可以是 true／Promise；沒有 ready 欄位就以 __sw.state 存在為準
export async function waitReady(page, timeout = 30000) {
  await page.waitForFunction(() => window.__sw && window.__sw.ready !== false && (window.__sw.ready != null || typeof window.__sw.state === 'function'), { timeout });
  await page.evaluate(() => (window.__sw.ready && typeof window.__sw.ready.then === 'function' ? window.__sw.ready : null));
}

// 等畫面真的畫出最新一格（無頭模式截圖可能拿到前一格）
export const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));

// 開頁並記錄錯誤與請求；allowed(url) 判斷請求是不是單檔自己
export function watch(page, pageUrl) {
  const log = { errors: [], external: [] };
  const self = pageUrl.split(/[?#]/)[0];
  page.on('pageerror', (e) => log.errors.push('pageerror: ' + (e.message || e)));
  page.on('console', (m) => m.type() === 'error' && log.errors.push('console.error: ' + m.text()));
  page.on('request', (r) => {
    const u = r.url();
    if (u.startsWith('data:') || u.startsWith('blob:') || u.split(/[?#]/)[0] === self) return;
    log.external.push(u.length > 120 ? u.slice(0, 120) + '…' : u);
  });
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (!u.startsWith('data:') && !u.startsWith('blob:') && u.split(/[?#]/)[0] !== self) log.errors.push('requestfailed: ' + u.slice(0, 120));
  });
  return log;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const args = process.argv.slice(2);
  const opt = (k, d) => {
    const a = args.find((x) => x === `--${k}` || x.startsWith(`--${k}=`));
    return a == null ? d : a.includes('=') ? a.slice(k.length + 3) : true;
  };
  const evalIdx = args.indexOf('--eval');
  const evalExpr = evalIdx >= 0 ? args.splice(evalIdx, 2)[1] : null;
  const html = args.find((a) => !a.startsWith('--')) || resolve(root, '../../web/195-sidewinder.html');
  const outDir = resolve(root, opt('out', 'shots'));
  const race = opt('race', null);
  const track = race === true ? 0 : race == null ? null : +race;
  const secs = +opt('secs', 6);
  const wait = +opt('wait', 1500);
  const sizes = String(opt('size', '1440x900,390x844,844x390')).split(',').map((s) => s.split('x').map(Number));
  mkdirSync(outDir, { recursive: true });

  const browser = await launch();
  const url = toUrl(html);
  const stem = basename(html.split(/[?#]/)[0], '.html') + (track != null ? `-race${track}` : '');
  let result;
  try {
    for (const [w, h] of sizes) {
      const page = await browser.newPage();
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < h && w < 600, hasTouch: w < h && w < 600 });
      const log = watch(page, url);
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      try {
        await waitReady(page);
      } catch {
        log.errors.push('逾時：window.__sw 沒有就緒');
      }
      if (track != null) {
        await page.evaluate(async (t, s) => {
          const sw = window.__sw;
          await sw.startRace(t, { seed: 7, playerAI: true });
          if (sw.fastForward) await sw.fastForward(s);
        }, track, secs).catch((e) => log.errors.push('startRace: ' + e.message));
      }
      await new Promise((r) => setTimeout(r, wait));
      await settle(page);
      if (evalExpr && result === undefined) result = await page.evaluate(evalExpr).catch((e) => ({ evalError: String(e.message || e) }));
      const renderer = await page.evaluate(() => {
        const c = document.createElement('canvas').getContext('webgl2');
        const d = c && c.getExtension('WEBGL_debug_renderer_info');
        return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : c ? 'webgl2' : '無 WebGL2';
      });
      const file = resolve(outDir, `${stem}-${w}x${h}.png`);
      await page.screenshot({ path: file });
      console.log(`${file}  [${renderer}]`);
      for (const e of log.errors) console.log(`  ${e}`);
      for (const u of log.external) console.log(`  外部請求：${u}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  if (evalExpr) console.log('RESULT: ' + JSON.stringify(result));
}
