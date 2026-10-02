import { open } from './lib.mjs';
const { browser, page } = await open('dist/match/index.html', { w: 1200, h: 700 });
await page.evaluate(() => { const s = window.__sw; s.start(); });
await page.waitForTimeout(800);
for (const [name, off] of [['side', [-38, 6, -6]], ['front', [-8, 6, -38]], ['rear', [10, 8, 40]]]) {
  await page.evaluate((off) => { const c = window.__sw.ctx; c.cam.update = () => {}; document.getElementById('hud').hidden = true; const b = c.match.bus.position; const r = c.match.bus.rotation.y, cs = Math.cos(r), sn = Math.sin(r); c.camera.position.set(b.x + off[0] * cs + off[2] * sn, b.y + off[1], b.z - off[0] * sn + off[2] * cs); c.camera.lookAt(b.x, b.y + 6, b.z); c.camera.fov = 50; c.camera.updateProjectionMatrix(); }, off);
  await page.waitForTimeout(400); await page.screenshot({ path: `dist/match/bus-${name}.png` });
}
await browser.close();
