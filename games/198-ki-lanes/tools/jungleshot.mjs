// 開發截圖：野區、戰爭迷霧、大猿
import { mkdirSync } from 'node:fs';
import { open } from './lib.mjs';
mkdirSync('dist/shots', { recursive: true });
const { browser, page, log } = await open('../../web/198-ki-lanes.html', { w: 1440, h: 900 });
const raf = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
const shot = async (n) => { await page.waitForTimeout(700); await raf(); await page.screenshot({ path: `dist/shots/j-${n}.png` }); };
await page.evaluate(() => { const k = window.__ki; k.start('piccolo', 0); k.fastForward(64); k.teleport(-44, -14); k.freezeAI(true); });
await shot('1-camp-fog');
await page.evaluate(() => { const k = window.__ki; k.fastForward(90); k.teleport(28, 28); k.setLevel(8); });
await shot('2-ape');
await page.evaluate(() => { const k = window.__ki, b = k.boss(); k.attack(b.id); k.fastForward(1.2); });
await shot('3-ape-fight');
console.log(log.pageerrors, log.errors.slice(0, 3));
await browser.close();
