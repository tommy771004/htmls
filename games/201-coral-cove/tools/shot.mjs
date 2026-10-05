// 評審截圖：dist/shots/ 下的 overview、follow、close-<動作>、wait、fight、catch、toss、full、bait、creel、pause、mobile、land（手機橫式）。
// node tools/shot.mjs [html] [--only 名稱,名稱]
import { mkdirSync } from 'node:fs';
import { open, raf } from './lib.mjs';

const html = process.argv.slice(2).find((a) => !a.startsWith('--') && a.endsWith('.html')) || '../../web/201-coral-cove.html';
const oi = process.argv.indexOf('--only');
const only = oi > 0 ? process.argv[oi + 1].split(',') : null;
const want = (n) => !only || only.some((o) => n.startsWith(o));
mkdirSync('dist/shots', { recursive: true });
const out = (n) => `dist/shots/${n}.png`;

async function session(opts, fn) {
  const { browser, page, log } = await open(html, opts);
  try {
    await page.waitForTimeout(900);
    await page.evaluate(() => window.__cc.start());
    await fn(page);
    if (log.pageerrors.length || log.errors.length) console.log('錯誤：', log.pageerrors.concat(log.errors).join(' | ').slice(0, 400));
  } finally { await browser.close(); }
}
const ev = (page, f, a) => page.evaluate(f, a);
const snap = async (page, n) => { await raf(page); await page.screenshot({ path: out(n) }); console.log(out(n)); };

await session({ w: 1440, h: 900 }, async (page) => {
  if (want('overview')) {
    await ev(page, () => { window.__cc.hud(false); window.__cc.cam('overview'); });
    await page.waitForTimeout(500); await snap(page, 'overview');
    await ev(page, () => { window.__cc.hud(true); window.__cc.cam('follow'); });
  }
  if (want('follow')) {
    await ev(page, () => window.__cc.place(0.2, -2.5, Math.PI));
    await page.keyboard.down('KeyW'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
    await page.waitForTimeout(900); await snap(page, 'follow');
  }
  if (want('rail')) {
    // 碰撞：往護欄、繫船柱與魚簍一直走，看身體有沒有穿過去
    await ev(page, () => { window.__cc.hud(false); window.__cc.place(0, -3, Math.PI / 2); window.__cc.cam('close'); });
    await page.keyboard.down('KeyD'); await page.waitForTimeout(1400); await page.keyboard.up('KeyD');
    await page.waitForTimeout(400); await snap(page, 'rail-close');
    await ev(page, () => { window.__cc.place(1.8, -10.6, Math.PI / 2); });
    await page.keyboard.down('KeyD'); await page.keyboard.down('KeyS'); await page.waitForTimeout(1500); await page.keyboard.up('KeyS'); await page.keyboard.up('KeyD');
    await page.waitForTimeout(400); await snap(page, 'rail-creel');
    await ev(page, () => { window.__cc.place(-2.0, -8.2, -Math.PI / 2); });
    await page.keyboard.down('KeyA'); await page.keyboard.down('KeyS'); await page.waitForTimeout(1500); await page.keyboard.up('KeyS'); await page.keyboard.up('KeyA');
    await page.waitForTimeout(400); await snap(page, 'rail-bollard');
    console.log('  位置', JSON.stringify((await ev(page, () => window.__cc.state())).pos));
    await ev(page, () => { window.__cc.cam('follow'); window.__cc.hud(true); });
  }
  if (want('close')) {
    await ev(page, () => { window.__cc.hud(false); window.__cc.place(0.3, -10.4, Math.PI * 0.82); window.__cc.cam('close'); });
    const poses = [['idle', 0.5], ['walk', 0.22], ['cast-windup', 0.42], ['cast', 0.55], ['wait', 0.6], ['hook', 0.18], ['reel', 0.3], ['stow', 0.4], ['cheer', 1.0], ['cheer-jump', 0.68]];
    for (const [n, t] of poses) {
      await ev(page, ([a, tt]) => window.__cc.pose(a, tt), [n.split('-')[0], t]);
      await page.waitForTimeout(250); await snap(page, `close-${n}`);
    }
    await ev(page, () => { window.__cc.pose(null); window.__cc.cam('follow'); window.__cc.hud(true); });
  }
  if (['wait', 'bite', 'fight', 'catch', 'toss', 'full', 'bait', 'creel', 'pause'].some(want)) {
    await ev(page, () => { window.__cc.place(0.5, -11.4, Math.PI); window.__cc.cast(0.55); });
    await page.waitForFunction(() => window.__cc.state().phase === 'wait');
    // 等魚游近並輕啄
    await ev(page, () => window.__cc.timeScale(2.5));
    await page.waitForFunction(() => { const s = window.__cc.state(); const f = s.fish.find((x) => x.state === 'interest'); return f && Math.hypot(f.x - s.bob.x, f.z - s.bob.z) < 1.2; }, null, { timeout: 30000 }).catch(() => {});
    await ev(page, () => window.__cc.timeScale(1));
    await page.waitForTimeout(400);
    if (want('wait')) await snap(page, 'wait');
    await ev(page, () => { if (window.__cc.state().phase === 'wait') window.__cc.bite(); });
    await page.waitForTimeout(250);
    if (want('bite')) await snap(page, 'bite');
    await page.keyboard.down('Space');
    await page.waitForTimeout(900);
    if (want('fight')) await snap(page, 'fight');
    await page.keyboard.up('Space');
    await ev(page, () => window.__cc.land('parrot'));
    await page.waitForTimeout(1500);
    if (want('catch')) await snap(page, 'catch');
    await page.waitForTimeout(400);
    await page.keyboard.press('Space');
    // 魚以拋物線飛進平台上的魚簍
    if (want('toss')) { await ev(page, () => window.__cc.timeScale(0.0001)); await page.waitForTimeout(100); await ev(page, () => window.__cc.timeScale(0.3)); await page.waitForTimeout(450); await ev(page, () => window.__cc.timeScale(0.0001)); await snap(page, 'toss'); await ev(page, () => window.__cc.timeScale(1)); }
    await page.waitForTimeout(1400);
    if (want('bait')) { await page.keyboard.press('KeyB'); await page.waitForTimeout(300); await snap(page, 'bait'); await page.keyboard.press('Escape'); }
    if (want('creel')) { await page.keyboard.press('KeyC'); await page.waitForTimeout(300); await snap(page, 'creel'); await page.keyboard.press('Escape'); }
    if (want('pause')) { await page.keyboard.press('KeyP'); await page.waitForTimeout(300); await snap(page, 'pause'); await page.keyboard.press('KeyP'); }
    if (want('full')) {
      await ev(page, () => { window.__cc.setCreel(7); window.__cc.land('tang'); });
      await page.waitForTimeout(700); await page.keyboard.press('Space');
      await page.waitForFunction(() => !document.getElementById('full').classList.contains('hidden'), null, { timeout: 4000 });
      await page.waitForTimeout(400);
      await snap(page, 'full');
    }
  }
});

if (want('mobile')) {
  await session({ w: 390, h: 844, touch: true }, async (page) => {
    await ev(page, () => { window.__cc.place(0.5, -11.4, Math.PI); window.__cc.cast(0.5); });
    await page.waitForFunction(() => window.__cc.state().phase === 'wait');
    await page.waitForTimeout(1200);
    await snap(page, 'mobile');
    await ev(page, () => window.__cc.bite());
    await page.dispatchEvent('#btnMain', 'pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true });
    await page.waitForTimeout(900);
    await snap(page, 'mobile-fight');
    await page.dispatchEvent('#btnMain', 'pointerup', { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true });
    await ev(page, () => window.__cc.land('clown'));
    await page.waitForTimeout(1500);
    await snap(page, 'mobile-catch');
  });
}

// 手機橫式：開場卡（要完整看到「開始釣魚」）與舉魚（魚卡在右、漁夫在左）
if (want('land')) {
  const { browser, page } = await open(html, { w: 667, h: 375, touch: true });
  try {
    await page.waitForTimeout(900);
    await snap(page, 'land-intro');
    await page.tap('#start');
    await ev(page, () => { window.__cc.place(0, -9.5, Math.PI); window.__cc.land('parrot'); });
    await page.waitForTimeout(2200);
    await snap(page, 'land-catch');
  } finally { await browser.close(); }
}
