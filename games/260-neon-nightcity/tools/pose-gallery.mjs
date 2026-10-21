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
  // 出生點在 avX(1) 西邊 9.6 m：人沿著大道中線排成一列，面向 -x
  const x0 = player.x + 9.6, z0 = player.z - 8;
  list.forEach(([n, id], k) => {
    cr.look(k, { female: k % 2 === 1, glowI: 0 });
    cr.anim(k, id, 0, n === 'run' ? 1.4 : 1);
    cr.place(k, x0, n === 'sit' ? .5 : n === 'ride' ? .6 : 0, z0 + k * 1.1, -Math.PI / 2);
  });
  scene.add(cr.mesh);
  window.__gal = { cr, x0, z0 };
  return list.map(([n]) => n);
});
console.log(ids.join(' '));
// 一次拍五個人：相機在那五人正前方（+z 看向 -z 的人群 → 從 -z 往 +z 看人臉）
for (let g = 0; g < 3; g++) {
  for (const side of [0, 1]) {
    await page.evaluate(([g, side]) => {
      const { x0, z0 } = __gal; __nc.me.mesh.visible = false;
      const cz = z0 + (g * 5 + 2) * 1.1;
      __nc.traffic.length = 0;
      if (side) { __nc.player.x = x0 - 1.5; __nc.player.z = cz - 4.6; __nc.look(.3, .02, 2); }
      else { __nc.player.x = x0 - 3.6; __nc.player.z = cz; __nc.look(Math.PI / 2, .02, 2); }
    }, [g, side]);
    await page.waitForTimeout(500); await raf(page);
    await page.screenshot({ path: `${out}/gallery-${g}${side ? 's' : ''}.png`, clip: { x: 220, y: 150, width: 1000, height: 650 } });
  }
}
console.log('errors', log.pageerrors, log.errors.slice(0, 5));
await browser.close();
