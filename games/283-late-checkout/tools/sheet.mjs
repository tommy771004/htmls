// 把多張截圖排成一張接觸印樣：node tools/sheet.mjs out.png 欄數 圖1 圖2 ...
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const [out, cols, ...imgs] = process.argv.slice(2);
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const html = `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px">${imgs.map(f => `<img style="width:100%;display:block" src="data:image/png;base64,${readFileSync(f).toString('base64')}">`).join('')}</body>`;
await page.setContent(html); await page.waitForTimeout(300);
await page.screenshot({ path: out, fullPage: true }); await browser.close();
