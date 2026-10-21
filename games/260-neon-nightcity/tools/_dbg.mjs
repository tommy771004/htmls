import { open, raf } from './lib.mjs';
const { browser, page, log } = await open('/Users/tommy/Documents/Proj/htmls/web/260-neon-nightcity.html');
await page.evaluate(() => __nc.start());
await page.waitForTimeout(800);
const r = await page.evaluate(async () => {
  const res = {};
  const all = []; __nc.scene.traverse(o => o.isSkinnedMesh && all.push(o)); res.n = all.length; res.bad = [];
  for (const sm of all.slice(0, 12)) {
    const g = sm.geometry, sl = g.attributes.aSlot, va = g.attributes.aVar, P = g.attributes.position;
    const v = sm.position.clone();
    const box = {};
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i); sm.applyBoneTransform(i, v);
      const k = sl.getX(i) + ':' + va.getX(i);
      const b = box[k] ||= { n: 0, min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] };
      b.n++; for (let c = 0; c < 3; c++) { b.min[c] = Math.min(b.min[c], v.getComponent(c)); b.max[c] = Math.max(b.max[c], v.getComponent(c)); }
    }
    for (const k in box) box[k].min = box[k].min.map(x => +x.toFixed(2)), box[k].max = box[k].max.map(x => +x.toFixed(2));
    const big = Object.entries(box).filter(([k, b]) => b.max[1] - b.min[1] > 2.2 || b.max[0] - b.min[0] > 2 || b.min[1] < -.5); if (big.length) res.bad.push({ name: sm.parent.parent.name, big });
    res.box = box;
  }
  return res;
});
console.log(JSON.stringify(r));
await browser.close();
