// Generate portfolio thumbnail thumbs/259.jpg (640x400 JPEG)
// Captures a dramatic low-angle rainy cyberpunk street shot of the player's Quadra V-Tech
// sports car outside PULSE // 脈衝夜店 with wet neon reflections, kanji holograms, and traffic.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(root, '../../web/259-neon-nightcity.html');
const thumbPath = resolve(root, '../../thumbs/259.jpg');
mkdirSync(dirname(thumbPath), { recursive: true });

const { browser, page } = await open(htmlPath, { w: 1280, h: 800 });
try {
  await page.evaluate(() => {
    const nc = window.__nc;
    // Hide HUD for a clean cinematic thumbnail
    const hudLayer = document.querySelector('.hud-layer');
    if (hudLayer) hudLayer.style.display = 'none';
    const centerNotif = document.querySelector('.center-notifications');
    if (centerNotif) centerNotif.style.display = 'none';

    // Position the player car right in front of PULSE Nightclub neon archway on the wet avenue
    nc.gameplay.carPos.set(-3.2, 0, -24.5);
    nc.gameplay.carYaw = 0.62; // Angled heroically toward camera & street
    nc.gameplay.carGroup.position.copy(nc.gameplay.carPos);
    nc.gameplay.carGroup.rotation.y = nc.gameplay.carYaw;
    if (nc.gameplay.wheels.FL) nc.gameplay.wheels.FL.rotation.y = -0.32;
    if (nc.gameplay.wheels.FR) nc.gameplay.wheels.FR.rotation.y = -0.32;

    // Step atmosphere so raindrops, dancers inside the club doorway, and neon reflections are lively
    for (let i = 0; i < 40; i++) {
      nc.atmosphere.update(0.03, i * 0.03, nc.gameplay.carPos, nc.camera);
    }

    // Set dramatic low-angle 3/4 camera framing the car, wet street reflection, and PULSE club entrance
    nc.camera.position.set(-9.2, 2.05, -31.2);
    nc.camera.lookAt(1.5, 3.8, -12.0);
    nc.renderer.render(nc.scene, nc.camera);
  });

  await raf(page);
  await page.screenshot({
    path: thumbPath,
    type: 'jpeg',
    quality: 88,
  });
  console.log(`Saved thumbnail to ${thumbPath}`);
} finally {
  await browser.close();
}
