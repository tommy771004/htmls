// 縮圖：Free Ride 從 SEMI JUMP 全速推進起飛，低角度側拍（背景是星空、探照燈與紅環），
// 車飛到聯結車上方時凍結物理，1280×800 截圖後縮成 thumbs/200.jpg（640×400）
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { open, raf } from './lib.mjs';
mkdirSync('dist', { recursive: true });
const { browser, page } = await open('../../web/200-roadster-arena.html', { w: 1280, h: 800, query: '?mode=free&q=high' });
try {
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const d = window.__rsa.drive, b = d.car.body, yaw = Math.PI / 2;
    b.setTranslation({ x: 20, y: 0.5, z: 40 }, true);
    b.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    b.setLinvel({ x: 40, y: 0, z: 0 }, true);
    window.__rsa.auto = { throttle: 1, boost: true };
    document.getElementById('hud').style.display = 'none';
    d.cam.update = function (dt, p) {
      if (this.camera.fov !== 36) { this.camera.fov = 36; this.camera.updateProjectionMatrix(); }
      this.camera.position.set(p.x - 3.5, p.y - 2.6, p.z - 12);
      this.camera.lookAt(p.x - 0.6, p.y + 0.9, p.z);
    };
  });
  await page.waitForFunction(() => window.__rsa.drive.car.body.translation().x >= 123, null, { timeout: 10000 });
  await page.evaluate(() => { window.__rsa.drive.tick = () => {}; });
  await page.waitForTimeout(300); await raf(page);
  await page.screenshot({ path: 'dist/thumb-full.png' });
} finally { await browser.close(); }
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '-z', '400', '640', 'dist/thumb-full.png', '--out', '../../thumbs/200.jpg'], { stdio: 'ignore' });
console.log('thumbs/200.jpg');
