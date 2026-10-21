// 開發用：展示間四個角度拼一張（最後一張升起尾翼）
import { open, raf } from './lib.mjs';
const out = process.argv[2] || 'dist/views.png';
const extra = process.argv[3] || '';
const { browser, page } = await open('../../web/200-roadster-arena.html', { w: 1600, h: 1000, query: '?mode=show', ready: () => window.__rsa && window.__rsa.show });
try {
  await page.waitForTimeout(600);
  const views = [[0.75, 0.12, 9, 0], [Math.PI / 2, 0.05, 9, 0], [2.5, 0.15, 9, 0], [0.4, 0.6, 9, 1]];
  const shots = [];
  for (const [yaw, pitch, dist, wing] of views) {
    await page.evaluate(([yaw, pitch, dist, wing, extra]) => { const s = __rsa.show; s.orbit.yaw = yaw; s.orbit.pitch = pitch; s.orbit.dist = dist; s.orbit.idle = 0; s.setAero(wing ? "deployed" : "stowed"); s.state.wingH = wing; s.state.wingA = wing * 0.3; s.car.setLights(1); if (extra) eval(extra); }, [yaw, pitch, dist, wing, extra]);
    await page.waitForTimeout(400); await raf(page);
    shots.push((await page.screenshot({ type: 'jpeg', quality: 80 })).toString('base64'));
  }
  await page.setContent(`<body style="margin:0;background:#000;display:grid;grid-template-columns:1fr 1fr">${shots.map((b) => `<img style="width:100%" src="data:image/jpeg;base64,${b}">`).join('')}</body>`);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.screenshot({ path: out });
  console.log(out);
} finally { await browser.close(); }
