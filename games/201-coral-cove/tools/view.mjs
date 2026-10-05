// 把 GLB 匯入 three（和遊戲同版本）截圖，檢查比例、法線、材質與動畫是否正確匯出。
// node tools/view.mjs <glb> [--node 名稱] [--anim 動作] [--times 0,0.3,0.6] [--view game|front|side|back|top|three]
//   [--dist 公尺] [--target x,y,z] [--cols 4] [--out dist/view/名稱.png]
// 會印出檔內的根節點、動畫清單與該節點的包圍盒（公尺，Y 朝上）。
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { GPU_ARGS, SOFT_ARGS } from './lib.mjs';
import { homedir } from 'node:os';
import { existsSync, readdirSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const glb = argv[0];
if (!glb) { console.log('用法：node tools/view.mjs <glb> [--node n] [--anim a] [--times t,...] [--view v] [--out f]'); process.exit(1); }
const opt = {
  node: arg('node'), anim: arg('anim'), view: arg('view', 'three'),
  times: (arg('times', '0')).split(',').map(Number), dist: arg('dist') ? +arg('dist') : undefined,
  target: arg('target') ? arg('target').split(',').map(Number) : undefined, cols: arg('cols') ? +arg('cols') : undefined,
  groundY: arg('ground') ? +arg('ground') : undefined, fov: arg('fov') ? +arg('fov') : undefined,
};
const out = resolve(process.cwd(), arg('out', `dist/view/${basename(glb, '.glb')}-${opt.node || 'all'}${opt.anim ? '-' + opt.anim : ''}-${opt.view}.png`));
mkdirSync(dirname(out), { recursive: true });
const page0 = resolve(root, 'dist/viewer.html');
const res = await build({ entryPoints: [resolve(root, 'tools/viewer-entry.js')], bundle: true, format: 'iife', write: false, logLevel: 'warning' });
mkdirSync(dirname(page0), { recursive: true });
writeFileSync(page0, `<!doctype html><meta charset=utf-8><body><script>${res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>`);
function chromePath() {
  const base = resolve(homedir(), 'Library/Caches/ms-playwright');
  const dirs = existsSync(base) ? readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse() : [];
  for (const d of dirs) for (const sub of ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
    const p = resolve(base, d, sub); if (existsSync(p)) return p;
  }
}
let browser;
try { browser = await chromium.launch({ headless: true, args: GPU_ARGS, executablePath: chromePath() }); }
catch { browser = await chromium.launch({ headless: true, args: SOFT_ARGS, executablePath: chromePath() }); }
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await page.goto(pathToFileURL(page0).href);
  await page.waitForFunction(() => window.ready);
  const info = await page.evaluate(([b, o]) => window.view(b, o), [readFileSync(resolve(process.cwd(), glb)).toString('base64'), opt]);
  await page.screenshot({ path: out });
  console.log(JSON.stringify(info));
  if (errs.length) console.log('console：' + errs.join(' | '));
  console.log(out);
} finally { await browser.close(); }
