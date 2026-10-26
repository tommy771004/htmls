// ═══ 天樞島的塔頂（照曼哈頓下城 1910–30 年代的摩天樓）：10-city.js 的 isleTower 退台塔最上一層上面蓋塔冠（L.crown.kind）：
//   0 不鏽鋼的階梯冠（一層層縮小、每層一圈拱形的亮窗，夜裡點燈）＋細長的尖頂
//   1 哥德式的銅綠尖塔（陡的四坡屋頂、四角的小尖塔、頂上的燈籠亭）
//   2 神殿式的階梯金字塔（三段銅綠的退台、四坡頂、燈籠亭）
// 玻璃塔與其他高過 100 m 的樓：屋頂的機房與天線桅杆，頂上一盞閃的紅色航空障礙燈。填空樓（11-isle.js，世界座標）的屋頂：樓梯間與電梯機房的小屋。
// 屋頂的木水塔與空調箱在 20-props.js（退台塔擺在最上一層上，填空樓也擺）。幾何是邏輯座標的 Kit，每片一個網格 ───
const isleTop = L => L.tiers && L.tiers.length ? L.tiers.at(-1) : { i: 0, y: L.h };
{
  const kits = new Map(), kz = zn => { if (!kits.has(zn)) kits.set(zn, new Kit()); return kits.get(zn); };
  const PAT = 0x5f8a78, PAT2 = 0x4e7466, STEEL = 0xc9ced3, STONE = 0xcdc3ad, LAMP = 0xffd9a0, RED = 0xff2a1a;
  // 底面 w × d 的四坡頂（r = 0 是尖的，> 0 是平台）：先做邊長 1 的方錐再縮放
  const pyramid = (k, x, y, z, w, d, h, color, mat, top = 0) => {
    const g = new T.CylinderGeometry(top * Math.SQRT1_2, Math.SQRT1_2, h, 4, 1); g.rotateY(Math.PI / 4);
    return k.add(g, color, mat, tf(x, y + h / 2, z, 0, 0, 0, w, 1, d));
  };
  // 每一面一排拱窗（亮的方塊），y 是窗台高、h 是窗高
  const windowsRing = (k, x, y, z, w, d, h, n, color, mat) => {
    for (const [ax, sx, sz] of [[0, 1, 0], [1, 0, 1]]) for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
      const t = (i + .5) / n - .5, px = ax ? x + s * (w / 2 + .02) : x + t * w * .86, pz = ax ? z + t * d * .86 : z + s * (d / 2 + .02);
      k.box(px, y + h / 2, pz, sx ? w * .86 / n * .55 : .06, h, sz ? d * .86 / n * .55 : .06, color, mat);
    }
  };
  const spire = (k, x, y, z, h, r, color) => { k.lathe(x, y, z, [[r, 0], [r * .8, h * .08], [r * .45, h * .1], [r * .3, h * .5], [.12, h * .92], [.04, h]], 8, color, 3); k.box(x, y + h + .25, z, .35, .35, .35, RED, 9); };
  let n = 0;
  for (const L of lots) {
    if (!L.isle || L.glb || !L.tiers || !L.tiers.length) continue;
    const t = isleTop(L), cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, w = L.x1 - L.x0 - 2 * t.i, d = L.z1 - L.z0 - 2 * t.i, k = kz(L.zn);
    let y = t.y;
    if (L.crown) {
      const C = L.crown;
      if (C.kind === 0) {   // 不鏽鋼階梯冠
        let sw = w, sd = d;
        for (let s = 0; s < 4; s++) {
          const h = 4.2 - s * .4;
          k.box(cx, y + h / 2, cz, sw, h, sd, s ? STEEL : STONE, s ? 3 : TX.stone);
          windowsRing(k, cx, y + .5, cz, sw, sd, h * .55, Math.max(2, Math.round(sw / 4)), LAMP, 16);
          k.box(cx, y + h + .06, cz, sw + .3, .12, sd + .3, STEEL, 3);
          y += h; sw *= .76; sd *= .76;
        }
        pyramid(k, cx, y, cz, sw, sd, Math.min(sw, sd) * 1.4, STEEL, 3);
        y += Math.min(sw, sd) * 1.4;
        spire(k, cx, y - .5, cz, C.spire || 12, .7, STEEL);
      } else if (C.kind === 1) {   // 哥德式尖塔
        k.box(cx, y + 1.5, cz, w, 3, d, STONE, TX.stone);
        windowsRing(k, cx, y + .6, cz, w, d, 1.8, Math.max(3, Math.round(w / 3)), LAMP, 16);
        const ph = Math.min(w, d) * 1.25;
        pyramid(k, cx, y + 3, cz, w - .6, d - .6, ph, PAT, TX.seam);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {   // 四角的小尖塔
          const px = cx + sx * (w / 2 - .7), pz = cz + sz * (d / 2 - .7);
          k.box(px, y + 4.2, pz, 1.4, 2.4, 1.4, STONE, TX.stone);
          pyramid(k, px, y + 5.4, pz, 1.4, 1.4, 4.5, PAT2, TX.seam);
        }
        y += 3 + ph * .78;
        k.box(cx, y + 1.6, cz, 2.4, 3.2, 2.4, PAT2, TX.seam); windowsRing(k, cx, y + .5, cz, 2.4, 2.4, 2, 1, LAMP, 16);
        pyramid(k, cx, y + 3.2, cz, 2.6, 2.6, 2.2, PAT, TX.seam);
        spire(k, cx, y + 5.2, cz, C.spire || 8, .4, 0x8a7a50);
      } else {   // 神殿式階梯金字塔
        let sw = w, sd = d;
        for (let s = 0; s < 3; s++) { k.box(cx, y + 1.4, cz, sw, 2.8, sd, s ? PAT : STONE, s ? TX.seam : TX.stone); windowsRing(k, cx, y + .4, cz, sw, sd, 1.6, Math.max(2, Math.round(sw / 4)), LAMP, 16); y += 2.8; sw -= 3; sd -= 3; }
        const ph = Math.min(sw, sd) * .9;
        pyramid(k, cx, y, cz, sw, sd, ph, PAT, TX.seam, .22);
        y += ph;
        k.box(cx, y + 1.2, cz, sw * .22, 2.4, sd * .22, LAMP, 16);
        pyramid(k, cx, y + 2.4, cz, sw * .3, sd * .3, 2.4, PAT2, TX.seam);
        if (C.spire) spire(k, cx, y + 4.8, cz, C.spire * .6, .45, STEEL);
      }
      n++;
    } else if (L.htop > 100) {   // 玻璃塔、板樓：機房、天線桅杆
      const mw = Math.min(w, d) * .4;
      k.box(cx, y + 2.2, cz, mw, 4.4, mw * .8, 0x6b6f73, TX.sheet);
      if (L.htop > 150) { k.rod(cx, y + 4.4, cz, cx, y + 4.4 + L.htop * .12, cz, .35, 8, 0xd0d4d8, 15, .1); k.box(cx, y + 4.6 + L.htop * .12, cz, .35, .35, .35, RED, 9); }
      else k.box(cx + mw * .4, y + 4.7, cz, .35, .35, .35, RED, 9);
    }
  }
  // 填空樓：樓梯間（前緣中點往後 40% 的位置）、夠高的加航空障礙燈
  const wk = new Kit();
  for (const f of ISLE_FILL) {
    const top = f.tiers.length ? f.tiers.at(-1).P : f.P, y = f.htop, cx = top.reduce((a, p) => a + p[0], 0) / 4, cz = top.reduce((a, p) => a + p[1], 0) / 4;
    const a = top[f.front], b = top[(f.front + 1) % 4], ry = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    wk.box(cx, y + 1.6, cz, 3.2, 3.2, 4.4, f.style === 3 ? 0x5d6266 : 0x8a8478, f.style === 3 ? TX.sheet : TX.conc, 0, ry);
    if (y > 100) wk.box(cx, y + 3.45, cz, .35, .35, .35, RED, 9);
  }
  for (const [zn, k] of kits) cullAdd(cityAdd(new T.Mesh(k.build(), MAT.ux), zn), CULL_R * 2);
  if (ISLE_FILL.length) cullAdd(cityAdd(new T.Mesh(wk.build(), MAT.ux), null), CULL_R * 2);
  if (location.search.includes('isleLog')) console.log(`天樞島塔冠 ${n} 座`);
}
