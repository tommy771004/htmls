// 用本機 Chrome 無頭開啟 HTML 並截圖，同時輸出 console 錯誤。
// 用法：node tools/shot.mjs <html路徑或URL> <輸出.png> [等待毫秒=4000] [寬=1280] [高=720] [--eval "JS 運算式"]
// --eval 的結果（JSON）會印在 stdout 最後一行，以 RESULT: 開頭。
import puppeteer from 'puppeteer-core';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const CHROME = process.env.CHROME || {
  win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
}[process.platform] || '/usr/bin/google-chrome';
export const CHROME_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];

export async function launch() {
  return puppeteer.launch({ executablePath: CHROME, headless: 'new', args: CHROME_ARGS });
}

export function toUrl(p) {
  if (/^(https?|file):/.test(p)) return p;
  const i = p.search(/[?#]/); // 保留 query string
  return i < 0 ? pathToFileURL(resolve(p)).href : pathToFileURL(resolve(p.slice(0, i))).href + p.slice(i);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const evalIdx = args.indexOf('--eval');
  let evalExpr = null;
  if (evalIdx >= 0) {
    evalExpr = args[evalIdx + 1];
    args.splice(evalIdx, 2);
  }
  const [input, out, wait = '4000', w = '1280', h = '720'] = args;
  if (!input || !out) {
    console.error('usage: node tools/shot.mjs <html> <out.png> [waitMs] [w] [h] [--eval expr]');
    process.exit(2);
  }
  const browser = await launch();
  const page = await browser.newPage();
  await page.setViewport({ width: +w, height: +h });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log(`[console.${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
  await page.goto(toUrl(input), { waitUntil: 'load', timeout: 60000 });
  await new Promise((r) => setTimeout(r, +wait));
  let result;
  if (evalExpr) {
    try {
      result = await page.evaluate(evalExpr);
    } catch (e) {
      result = { evalError: String(e.message || e) };
    }
  }
  await page.screenshot({ path: out });
  await browser.close();
  if (evalExpr) console.log('RESULT: ' + JSON.stringify(result));
  console.log(`saved ${out}`);
}
