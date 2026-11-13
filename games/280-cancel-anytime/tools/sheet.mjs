// 把多張截圖排成一張對照表：node tools/sheet.mjs <輸出.png> <欄數> <每格寬> <圖1> <圖2> ...
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
const [out, cols, cw, ...imgs] = process.argv.slice(2);
const cells = imgs.map(p => `<figure><img src="data:image/png;base64,${readFileSync(p).toString('base64')}"><figcaption>${basename(p)}</figcaption></figure>`).join('');
const html = `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(${cols},${cw}px);gap:4px;width:max-content"><style>figure{margin:0;position:relative}img{width:${cw}px;display:block}figcaption{position:absolute;left:0;top:0;background:#000c;color:#fff;font:11px monospace;padding:1px 4px}</style>${cells}</body>`;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: cols * cw + (cols - 1) * 4, height: 600 } });
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
