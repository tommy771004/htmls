// 舊版（米色紙）UI 參考截圖：node ref/ui/shot.cjs → ref/ui/paper-v1-hud.png、paper-v1-results.png（1600×900）
// 現行的玻璃面板 UI 參考圖是從遊戲截的：node tools/uiref.mjs
const path = require('path');
const { chromium } = require(path.join(__dirname, '../../node_modules/playwright-core'));
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  for (const n of ['hud', 'results']) {
    await p.goto('file://' + path.join(__dirname, n + '.html'));
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(__dirname, 'paper-v1-' + n + '.png') });
  }
  await b.close();
})();
