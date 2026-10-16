// Automated end-to-end acceptance test suite for 260-neon-nightcity
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(root, '../../web/260-neon-nightcity.html');
const shotDir = resolve(
  '/Users/xieyuanyou/.gemini/antigravity-cli/brain/a7db79b1-92e4-4461-a94e-47acf8a1fac7/scratch'
);
mkdirSync(shotDir, { recursive: true });

function assert(cond, msg) {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
  console.log(`  ✓ ${msg}`);
}

async function runAcceptance() {
  console.log('=== 1. Launching Desktop Viewport (1440x900) ===');
  const { browser, page, log } = await open(htmlPath, { w: 1440, h: 900 });

  try {
    await raf(page);
    await page.waitForTimeout(250);

    // 1. Verify embedded GLB assets & zero placeholders
    const assetReport = await page.evaluate(() => window.__nc.assets.report);
    console.log('  Asset report:', JSON.stringify(assetReport));
    assert(
      assetReport.loaded.length === 4,
      `All 4 Blender GLB packs loaded (${assetReport.loaded.join(', ')})`
    );
    assert(assetReport.missing.length === 0, 'Zero missing GLB packs');
    assert(assetReport.placeholders.length === 0, 'Zero missing model placeholders');

    // 2. Verify driving physics & street scene
    console.log('=== 2. Testing Third-Person Driving & Nitro Boost ===');
    const startStats = await page.evaluate(() => {
      const nc = window.__nc;
      nc.soundscape.init();
      return nc.getStats();
    });
    assert(startStats.mode === 'driving', `Initial mode is driving (at ${JSON.stringify(startStats.pos)})`);

    // Simulate driving forward with boost for 65 frames
    const afterDriveStats = await page.evaluate(() => {
      const nc = window.__nc;
      nc.gameplay.keys.forward = true;
      nc.gameplay.keys.sprint = true;
      for (let i = 0; i < 65; i++) {
        nc.step(1 / 60);
      }
      const st = nc.getStats();
      nc.gameplay.keys.forward = false;
      nc.gameplay.keys.sprint = false;
      return st;
    });
    console.log('  After driving:', JSON.stringify(afterDriveStats));
    assert(afterDriveStats.speedKmh > 40, `Car accelerated to ${afterDriveStats.speedKmh} km/h`);
    assert(
      Math.hypot(afterDriveStats.pos.x - startStats.pos.x, afterDriveStats.pos.z - startStats.pos.z) > 8,
      'Car moved forward along Neon Central Avenue'
    );
    await raf(page);
    await page.screenshot({ path: resolve(shotDir, '01-driving-street.png') });

    // 3. Test Exiting Car (F) & Walking into PULSE Nightclub
    console.log('=== 3. Testing Vehicle Exit (F) & Walking into PULSE // 脈衝夜店 ===');
    const clubStats = await page.evaluate(() => {
      const nc = window.__nc;
      // Exit vehicle first to test toggleVehicleMode
      nc.gameplay.toggleVehicleMode();
      const exitedMode = nc.gameplay.mode;
      // Now teleport to just outside PULSE Nightclub door (0, -17.2) facing North (+Z -> yaw = 0) and walk inside
      nc.gameplay.teleportTo(0, -17.2, 0, 'walking');
      nc.gameplay.keys.forward = true;
      for (let i = 0; i < 95; i++) {
        nc.step(1 / 60);
      }
      nc.gameplay.keys.forward = false;
      // Trigger dance inside the club
      nc.gameplay.triggerContextAction();
      for (let i = 0; i < 30; i++) {
        nc.step(1 / 60);
      }
      return { exitedMode, stats: nc.getStats(), npcCount: nc.city.npcMixers.length };
    });
    console.log('  Club stats:', JSON.stringify(clubStats));
    assert(clubStats.exitedMode === 'walking', 'F key exits car into third-person walking mode');
    assert(
      clubStats.stats.venue === 'PULSE // 脈衝夜店',
      `Walked seamlessly through doorway into ${clubStats.stats.venue}`
    );
    assert(clubStats.stats.dancing === true, 'Player character dancing on LED dancefloor');
    assert(clubStats.npcCount >= 18, `Active skeletal NPC mixers (${clubStats.npcCount})`);
    await raf(page);
    await page.screenshot({ path: resolve(shotDir, '02-pulse-nightclub.png') });

    // 4. Test AFTERGLOW // 餘燼酒吧 interior & ordering drink
    console.log('=== 4. Testing AFTERGLOW // 餘燼酒吧 & Drink Interaction ===');
    const barStats = await page.evaluate(() => {
      const nc = window.__nc;
      nc.hud.handleTeleport('bar_inside');
      nc.gameplay.keys.forward = true;
      for (let i = 0; i < 65; i++) {
        nc.step(1 / 60);
      }
      nc.gameplay.keys.forward = false;
      nc.gameplay.triggerContextAction();
      for (let i = 0; i < 20; i++) {
        nc.step(1 / 60);
      }
      return nc.getStats();
    });
    console.log('  Bar stats:', JSON.stringify(barStats));
    assert(barStats.venue === 'AFTERGLOW // 餘燼酒吧', `Inside ${barStats.venue}`);
    assert(barStats.drinksOrdered === 1, 'Ordered cyberpunk cocktail from bartender');
    await raf(page);
    await page.screenshot({ path: resolve(shotDir, '03-afterglow-bar.png') });

    // 5. Test CHROME WORKS // 電馭改裝廠 & Car Livery Customization
    console.log('=== 5. Testing CHROME WORKS // 電馭改裝廠 & Livery Customization ===');
    const garageStats = await page.evaluate(() => {
      const nc = window.__nc;
      nc.hud.handleTeleport('garage_inside');
      nc.gameplay.triggerContextAction();
      for (let i = 0; i < 25; i++) {
        nc.step(1 / 60);
      }
      return nc.getStats();
    });
    console.log('  Garage stats:', JSON.stringify(garageStats));
    assert(garageStats.venue === 'CHROME WORKS // 電馭改裝廠', `Inside ${garageStats.venue}`);
    assert(garageStats.liveryIndex === 1, 'Customized vehicle neon underglow livery');
    await raf(page);
    await page.screenshot({ path: resolve(shotDir, '04-chrome-garage.png') });

    // 6. Test City Map Modal & HUD Elements
    console.log('=== 6. Testing HUD Clock, Minimap & City Map Modal ===');
    const hudCheck = await page.evaluate(() => {
      const nc = window.__nc;
      nc.hud.toggleMapModal(true);
      const clockText = document.getElementById('hud-clock')?.textContent || '';
      const distText = document.getElementById('hud-district-name')?.textContent || '';
      const modalVisible = !document.getElementById('map-modal')?.hasAttribute('hidden');
      return { clockText, distText, modalVisible };
    });
    assert(/^\d{2}:\d{2}$/.test(hudCheck.clockText), `HUD Clock formatted (${hudCheck.clockText})`);
    assert(hudCheck.distText.length > 0, `HUD District/Venue displayed (${hudCheck.distText})`);
    assert(hudCheck.modalVisible === true, 'Full-city map modal opens cleanly');
    await raf(page);
    await page.screenshot({ path: resolve(shotDir, '05-city-map-modal.png') });

    // Close modal & measure render call budget and frame timing
    const perfStats = await page.evaluate(async () => {
      const nc = window.__nc;
      nc.hud.toggleMapModal(false);
      nc.hud.handleTeleport('pulse_street');
      const t0 = performance.now();
      const frames = 60;
      for (let i = 0; i < frames; i++) {
        nc.step(1 / 60);
      }
      const elapsedMs = performance.now() - t0;
      return {
        avgStepMs: Number((elapsedMs / frames).toFixed(2)),
        drawCalls: nc.renderer.info.render.calls,
        triangles: nc.renderer.info.render.triangles,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    console.log('  Performance stats:', JSON.stringify(perfStats));
    assert(perfStats.drawCalls < 320, `Draw calls within 60fps budget (${perfStats.drawCalls})`);
    assert(!perfStats.overflowX, 'Zero horizontal overflow on 1440x900 desktop');
    assert(log.errors.length === 0, `Zero console errors (${log.errors.length})`);
    assert(log.pageerrors.length === 0, `Zero page errors (${log.pageerrors.length})`);
    assert(log.external.length === 0, `Zero external network requests (${log.external.length})`);
  } finally {
    await browser.close();
  }

  // 7. Test Mobile Portrait (390x844) & Landscape (667x375)
  console.log('=== 7. Testing Mobile Viewports (390x844 & 667x375) ===');
  for (const vp of [
    { w: 390, h: 844, name: '06-mobile-portrait.png' },
    { w: 667, h: 375, name: '07-mobile-landscape.png' },
  ]) {
    const { browser: mb, page: mp, log: mlog } = await open(htmlPath, {
      w: vp.w,
      h: vp.h,
      touch: true,
    });
    try {
      await raf(mp);
      const mCheck = await mp.evaluate(() => {
        const nc = window.__nc;
        nc.step(0.016);
        const touchEl = document.querySelector('.touch-controls');
        const touchDisplay = touchEl ? getComputedStyle(touchEl).display : 'none';
        return {
          touchVisible: touchDisplay === 'flex',
          overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
      assert(mCheck.touchVisible, `Touch controls visible at ${vp.w}x${vp.h}`);
      assert(!mCheck.overflowX, `Zero horizontal overflow at ${vp.w}x${vp.h}`);
      assert(mlog.errors.length === 0, `Zero errors at ${vp.w}x${vp.h}`);
      await mp.screenshot({ path: resolve(shotDir, vp.name) });
    } finally {
      await mb.close();
    }
  }

  console.log('\n🎉 ALL ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
}

runAcceptance().catch((err) => {
  console.error(err);
  process.exit(1);
});
