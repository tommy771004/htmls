// 截圖：node tools/shot.mjs [w] [h] [touch]；在幾個位置各拍一張到 dist/shot-*.png，並印出錯誤
import { open, raf } from './lib.mjs';
const w = +(process.argv[2] || 1440), h = +(process.argv[3] || 900), touch = process.argv[4] === 'touch';
const { browser, page, log } = await open('../../web/277-ink-ridge.html', { w, h, touch });
await page.waitForTimeout(500);
await page.screenshot({ path: `dist/shot-intro-${w}.png` });
await page.evaluate(() => { window.__ink.start(); window.__ink.manual(true); });
const spots = [['start', 0, 0, 3.5, Math.PI], ['stairs', 0, 0, -4, Math.PI], ['pillars', 0, 3, -19.5, Math.PI], ['wall', 1, 4, -40.5, Math.PI], ['ridge', 9.8, 11, -49, Math.PI], ['court', 4, 11, -76, Math.PI], ['terrace', 2.5, 17, -93, Math.PI]];
for (const [name, x, y, z, yaw] of spots) {
  await page.evaluate(([x, y, z, yaw]) => { window.__ink.teleport(x, y, z, yaw); window.__ink.input({}); window.__ink.step(40); }, [x, y, z, yaw]);
  await raf(page);
  await page.screenshot({ path: `dist/shot-${name}-${w}.png` });
  console.log(name, JSON.stringify(await page.evaluate(() => { const s = window.__ink.state(); return { mode: s.mode, pos: s.pos.map((v) => +v.toFixed(2)), draws: s.draws, tris: s.tris, cloth: s.clothOK }; })));
}
console.log('gpu', log.gpu, 'errors', log.errors.slice(0, 5), 'pageerrors', log.pageerrors.slice(0, 5), 'external', log.external.slice(0, 3), 'warns', log.warns.slice(0, 5));
await browser.close();
