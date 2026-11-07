#!/usr/bin/env node
// 拼合輯：node tools/gun-sheet.mjs out.png cols cellW cellH 標籤=圖檔 ...
// 檔名相對於 games/278-ochre-line。走 chrome-headless-shell，沒有 ImageMagick 也能用。
import { launch, GAME_DIR } from './lib/serve.mjs';
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

const [out, cols, cw, ch, ...items] = process.argv.slice(2);
const n = items.length, C = +cols, W = +cw, H = +ch, R = Math.ceil(n / C);
const b = await launch(), p = await (await b.newContext({ viewport: { width: C * W, height: R * H } })).newPage();
const cell = s => { const i = s.indexOf('='), t = s.slice(0, i), f = resolve(GAME_DIR, s.slice(i + 1)); if (!existsSync(f)) { console.log('缺圖', f); return `<div></div>`; } return `<div style="position:relative;width:${W}px;height:${H}px;overflow:hidden"><img src="data:image/png;base64,${readFileSync(f).toString('base64')}" style="width:100%;height:100%;object-fit:cover"><b style="position:absolute;left:6px;top:4px;color:#fff;font:600 14px sans-serif;background:#000a;padding:2px 6px">${t}</b></div>`; };
await p.setContent(`<body style="margin:0;background:#1a1a1a;display:grid;grid-template-columns:repeat(${C},${W}px)">${items.map(cell).join('')}`);
await p.waitForTimeout(500);
await p.screenshot({ path: resolve(GAME_DIR, out) }); await b.close(); console.log(out);
