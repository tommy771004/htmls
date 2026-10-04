// 開發用：打包 tools/viewer-entry.js → dist/viewer.html，依參數截圖到 dist/view/。
// node tools/viewer.mjs name "ids=goku&anim=idle&ang=30" [w] [h]
import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';
import { loadPlaywright, GPU_ARGS } from './lib.mjs';
const [name = 'lineup', query = '', w = '1600', h = '900'] = process.argv.slice(2);
const r = await build({ entryPoints: ['tools/viewer-entry.js'], bundle: true, format: 'iife', write: false, logLevel: 'warning' });
mkdirSync('dist/view', { recursive: true });
writeFileSync('dist/viewer.html', `<!doctype html><meta charset="utf-8"><style>body{margin:0;overflow:hidden}</style><body></body><script>${r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>`);
const chromium = await loadPlaywright();
const browser = await chromium.launch({ headless: true, args: GPU_ARGS });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto('file://' + process.cwd() + '/dist/viewer.html?' + query);
await page.waitForFunction(() => window.__v && window.__v.ready, null, { timeout: 30000 }).catch(() => {});
await page.screenshot({ path: `dist/view/${name}.png` });
console.log(`dist/view/${name}.png`, errs.length ? errs.slice(0, 5) : 'ok');
await browser.close();
