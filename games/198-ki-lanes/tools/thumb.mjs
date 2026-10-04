// 縮圖：1280×800 截圖 → thumbs/198.jpg（640×400）
import { execSync } from 'node:child_process';
import { open } from './lib.mjs';
const { browser, page } = await open('../../web/198-ki-lanes.html', { w: 1280, h: 800 });
const raf = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
await page.evaluate(() => { const k = window.__ki; k.start('homura', 1); k.fastForward(24); k.teleport(-6, 6); k.fastForward(4); k.setLevel(6); k.learnAll(); k.give({ ki: 500 }); k.freezeAI(true); });
const e = await page.evaluate(() => { const k = window.__ki; k.spawnEnemyHeroNear(8); return k.enemyHero(); });
await page.evaluate((e) => window.__ki.cast('R', e.x + 2, e.z - 2), e);
await page.waitForFunction(() => { const a = window.__ki.G.player.action; return a && a.name === 'beam' && a.t > 0.75; }, null, { timeout: 8000, polling: 'raf' });
await page.evaluate(() => { document.getElementById('cutin').className = ''; document.getElementById('speed').style.opacity = 0; document.getElementById('banner').className = ''; });
await raf();
await page.screenshot({ path: 'dist/thumb.png' });
await browser.close();
execSync('sips -s format jpeg -s formatOptions 82 -z 400 640 dist/thumb.png --out ../../thumbs/198.jpg');
console.log('ok');
