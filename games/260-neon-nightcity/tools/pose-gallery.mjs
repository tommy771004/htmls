// 動作總覽：在路燈下排一列人，每人一種動作，正面與側面各截一張。node tools/pose-gallery.mjs [輸出資料夾]
import { open, raf } from './lib.mjs';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] || 'dist/people';
mkdirSync(out, { recursive: true });
const { browser, page, log } = await open('../../web/260-neon-nightcity.html');
await page.evaluate(() => __nc.start());
const ids = await page.evaluate(() => {
  const { crowd, ANIM, scene, player } = __nc;
  const list = Object.entries(ANIM);
  const cr = crowd(list.length);
  const x0 = player.x, z0 = player.z - 4;
  list.forEach(([n, id], k) => {
    cr.look(k, { female: k % 2 === 1, glowI: 0, top: undefined });
    cr.anim(k, id, 0, n === 'walk' || n === 'umbrella' ? 1 : n === 'run' ? 1.4 : 1);
    cr.place(k, x0 - 7 + k * 1.1, n === 'sit' ? .5 : .15, z0, Math.PI);
  });
  scene.add(cr.mesh);
  window.__gal = { cr, x0, z0 };
  return list.map(([n]) => n);
});
console.log(ids.join(' '));
for (const [name, yaw] of [['front', 0], ['side', Math.PI / 2]]) {
  await page.evaluate((yaw) => {
    const { x0, z0 } = __gal; __nc.me.mesh.visible = false;
    __nc.player.x = x0 + 1; __nc.player.z = z0 - (yaw ? 0 : 6); __nc.look(yaw ? -Math.PI / 2 : 0, .05, 1);
    if (yaw) { __nc.player.x = x0 + 10; }
  }, yaw);
  await page.waitForTimeout(700); await raf(page);
  await page.screenshot({ path: `${out}/gallery-${name}.png` });
}
console.log('errors', log.pageerrors, log.errors.slice(0, 5));
await browser.close();
