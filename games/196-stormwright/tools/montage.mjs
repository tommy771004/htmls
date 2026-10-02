// 把多張截圖拼成一張：node tools/montage.mjs out.png a.png b.png ...
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { open } from './lib.mjs';
const [out, ...imgs] = process.argv.slice(2);
const html = `<body style="margin:0;background:#222;display:flex;gap:6px">${imgs.map((f) => `<img src="${pathToFileURL(resolve(f)).href}">`).join('')}</body>`;
import { writeFileSync } from 'node:fs';
const tmp = resolve('dist/montage.html'); writeFileSync(tmp, html);
const { browser, page } = await (async () => { const { loadPlaywright } = await import('./lib.mjs'); const ch = await loadPlaywright(); const b = await ch.launch(); const p = await b.newPage({ viewport: { width: 400 * imgs.length, height: 860 } }); await p.goto(pathToFileURL(tmp).href); await p.waitForTimeout(500); return { browser: b, page: p }; })();
await page.screenshot({ path: resolve(out) }); await browser.close();
