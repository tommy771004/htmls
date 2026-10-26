// ═══ CHROME WORKS 的程式建模道具（66-chrome.js 用）：工具櫃、鋼瓶推車、四柱頂高機、馬力機風扇與電腦、強尼的櫃檯 ═══
// 每件在自己的局部座標畫（+z 是正面、+y 朝上、原點在地面的中心），cwFrame 把局部座標換到廠房座標後加進同一個 Kit。
// 細節照實物：圓角鈑金、一格一格的抽屜與鋁把手、腳輪、鋼瓶的肩部與閥、風扇的導風罩與護網；擺放刻意不整齊（抽屜半開、東西歪放）。
function cwFrameM(k, M) {
  const F = Object.create(k);
  F.add = (g, c, m, mx, e) => { k.add(g, c, m, mx ? M.clone().multiply(mx) : M.clone(), e); return F; };
  return F;
}
const cwFrame = (k, x, y, z, ry = 0) => cwFrameM(k, tf(x, y, z, 0, ry, 0));
const CW_ALU = 0xd8dce2, CW_BLK = 0x16171a, CW_TYRE = 0x151515;
// 腳輪：轉向座、輪子（軸沿 x）
function cwCaster(F, x, z, h = .12) {
  F.box(x, h - .012, z, .07, .012, .06, CW_ALU, 3).box(x, h - .045, z, .012, .055, .05, 0x8a8e94, 15);
  F.cyl(x, .045, z, .045, .045, .032, 14, CW_TYRE, TX.rubber, 0, 0, Math.PI / 2).cyl(x, .045, z, .018, .018, .036, 8, 0x8a8e94, 15, 0, 0, Math.PI / 2);
}
// 工具櫃：w × h × d（含腳輪），抽屜由上往下照 pat 的比例分；o.open 是半開的那一格、o.top 檯面（'rubber'／'steel'／null）、o.lid 頂上再疊一個掀蓋工具箱
function cwChest(k, x, y, z, ry, w, h, d, col, o = {}) {
  const F = cwFrame(k, x, y, z, ry), R = rng(o.seed || 7), y0 = o.cast === false ? 0 : .12, tp = o.top === undefined ? 'rubber' : o.top;
  const hb = h - y0 - (tp ? .025 : 0);
  F.rbox(0, y0 + hb / 2, 0, w, hb, d, .018, col, TX.enamel, 0, 0, 0, .006);
  F.box(0, y0 + .025, d / 2 + .002, w - .04, .04, .01, CW_BLK, 2);   // 踢腳板
  const pat = o.pat || [1, 1, 1, 1.4, 1.8, 2.4], sum = pat.reduce((a, b) => a + b), inner = hb - .09;
  let yy = y0 + hb - .025;
  pat.forEach((p, i) => {
    const dh = inner * p / sum, cy = yy - dh / 2, op = o.open === i ? .1 + R() * .12 : 0, fz = d / 2 + .009 + op;
    F.rbox(0, cy, fz, w - .05, dh - .014, .018, .005, col, TX.enamel);
    const hy = cy + dh / 2 - .028;
    F.rod(-w / 2 + .05, hy, fz + .024, w / 2 - .05, hy, fz + .024, .008, 6, CW_ALU, 3);
    for (const s of [-1, 1]) F.box(s * (w / 2 - .05), hy, fz + .014, .014, .018, .022, 0x2a2c30, 15);
    if (op) {   // 拉開的抽屜：兩側板、底板、裡面散著的扳手與套筒
      for (const s of [-1, 1]) F.box(s * (w / 2 - .045), cy - .01, fz - .2, .01, dh - .04, .4, 0x8a8e94, TX.steel);
      F.box(0, cy - dh / 2 + .02, fz - .2, w - .09, .008, .4, 0x1a1b1e, TX.rubber);
      for (let t = 0; t < 6; t++) { const tx = (R() - .5) * (w - .2), tz = fz - .05 - R() * .3; F.box(tx, cy - dh / 2 + .03, tz, .02, .008, .16 + R() * .08, CW_ALU, 3, 0, R() * 3, 0); }
      for (let t = 0; t < 5; t++) F.cyl((R() - .5) * (w - .2), cy - dh / 2 + .045, fz - .06 - R() * .28, .012, .012, .04, 8, CW_ALU, 3);
    }
    yy -= dh;
  });
  F.box(-w / 2 + .14, y0 + hb - .012, d / 2 + .012, .12, .02, .004, CW_ALU, 3);   // 銘牌
  if (tp === 'rubber') F.rbox(0, y0 + hb + .0125, 0, w + .012, .025, d + .012, .008, CW_BLK, TX.rubber);
  else if (tp === 'steel') F.box(0, y0 + hb + .0125, 0, w + .02, .025, d + .02, 0xb8bcc0, TX.steel);
  if (o.handle) for (const s of [-1, 1]) F.rod(w / 2 + .045, y0 + hb - .04, s * (d / 2 - .1), w / 2 + .045, y0 + hb - .04, s * (d / 2 - .1) * .2, .012, 8, CW_ALU, 3), F.box(w / 2 + .022, y0 + hb - .04, s * (d / 2 - .1), .045, .03, .03, 0x2a2c30, 15);
  if (y0) for (const sx of [-1, 1]) for (const sz of [-1, 1]) cwCaster(F, sx * (w / 2 - .07), sz * (d / 2 - .07));
  if (o.lid) {   // 掀蓋工具箱：箱體、三格淺抽屜、圓弧蓋（圓角在 yz 面）、兩側提把
    const b = y0 + hb + (tp ? .025 : 0), lh = o.lid, lw = w - .02, ld = d - .04;
    F.rbox(0, b + lh / 2, 0, lw, lh, ld, .015, col, TX.enamel, 0, 0, 0, .005);
    for (let i = 0; i < 3; i++) { const cy = b + lh - .1 - i * (lh - .14) / 3; F.rbox(0, cy, ld / 2 + .008, lw - .05, (lh - .14) / 3 - .012, .016, .004, col, TX.enamel).rod(-lw / 2 + .06, cy + .02, ld / 2 + .03, lw / 2 - .06, cy + .02, ld / 2 + .03, .006, 6, CW_ALU, 3); }
    F.rbox(0, b + lh + .045, 0, ld, .09, lw, .04, col, TX.enamel, 0, Math.PI / 2, 0);
    F.box(0, b + lh, ld / 2 + .004, lw - .02, .012, .01, CW_ALU, 3);
    for (const s of [-1, 1]) F.rod(s * (lw / 2 + .03), b + lh - .05, -.08, s * (lw / 2 + .03), b + lh - .05, .08, .01, 6, CW_ALU, 3);
  }
  return F;
}
// 氧氣乙炔鋼瓶推車：兩輪手推車、綠色氧氣瓶（細高）與紅色乙炔瓶（粗矮）、閥、減壓錶、纏起來的雙色焊管與焊槍
const cwBottle = (r, H) => [[0, 0], [r * .9, 0], [r, .025], [r, H * .84], [r * .93, H * .9], [r * .66, H * .955], [r * .32, H * .985], [.032, H], [.032, H + .05], [.024, H + .06], [0, H + .06]];
function cwGasCart(k, x, z, ry) {
  const F = cwFrame(k, x, 0, z, ry), fr = 0x2a2c30;
  F.box(0, .03, .03, .62, .022, .36, fr, TX.enamel);
  for (const s of [-1, 1]) { F.rod(s * .3, .04, -.14, s * .3, 1.2, -.2, .016, 8, fr, TX.enamel); F.rod(s * .3, 1.2, -.2, s * .26, 1.32, -.32, .016, 8, fr, TX.enamel); }
  F.rod(-.26, 1.32, -.32, .26, 1.32, -.32, .018, 8, CW_BLK, TX.rubber);
  for (const y of [.42, .95]) F.rod(-.3, y, -.17, .3, y, -.18, .012, 6, fr, TX.enamel);
  F.rod(-.38, .13, -.14, .38, .13, -.14, .012, 6, 0x8a8e94, 15);
  for (const s of [-1, 1]) { F.torus(s * .36, .13, -.14, .1, .032, 18, CW_TYRE, TX.rubber, 0, Math.PI / 2, 0, Math.PI * 2, 8); F.cyl(s * .36, .13, -.14, .07, .07, .045, 14, 0xb8bcc0, 15, 0, 0, Math.PI / 2); }
  const B = [[-.15, .11, 1.36, 0x2f6a3a], [.15, .135, 1.12, 0x7a1418]];
  for (const [bx, r, H, c] of B) {
    F.lathe(bx, .042, .02, cwBottle(r, H), 22, c, TX.enamel);
    F.cyl(bx, .042 + H * .78, .02, r + .004, r + .004, .015, 22, 0xe8e4da, 10);   // 肩部的白色標示環
    const vy = .042 + H + .06;
    F.cyl(bx, vy + .03, .02, .022, .022, .06, 10, 0xc9a24a, 3).cyl(bx, vy + .07, .02, .03, .03, .012, 12, CW_BLK, 2);
    F.box(bx, vy + .03, .06, .03, .03, .06, 0xc9a24a, 3);
    for (const [gx, gy] of [[-.04, .08], [.04, .05]]) F.cyl(bx + gx, vy + gy, .1, .03, .03, .02, 16, CW_ALU, 3, Math.PI / 2, 0, 0).cyl(bx + gx, vy + gy, .111, .025, .025, .002, 16, 0xf4f1ea, 10, Math.PI / 2, 0, 0);
  }
  F.rod(-.3, .98, .14, .3, .98, .16, .006, 4, 0x8a8e94, 15).rod(-.3, .7, .14, .3, .7, .17, .006, 4, 0x8a8e94, 15);   // 固定鋼瓶的鏈條
  for (let i = 0; i < 4; i++) { F.torus(.36, .78 - i * .012, .0, .16 - i * .005, .011, 20, 0x2f6a3a, TX.rubber, 0, Math.PI / 2 + i * .15, .2); F.torus(.365, .77 - i * .012, .02, .155 - i * .005, .011, 20, 0x8a1018, TX.rubber, 0, Math.PI / 2 + i * .15 + .1, .2); }
  F.rod(.33, .62, .05, .42, .5, .25, .014, 8, 0xc9a24a, 3).rod(.42, .5, .25, .45, .47, .33, .007, 6, 0x8a8e94, 3);   // 焊槍
  F.rod(-.15, 1.48, .1, .3, .95, .05, .008, 4, 0x2f6a3a, TX.rubber).rod(.15, 1.25, .1, .33, .95, .07, .008, 4, 0x8a1018, TX.rubber);
}
// 四柱頂高機的固定部分：四支柱（槽鋼、棘齒孔、底板與地腳螺栓、頂蓋）、柱頂橫樑與滑輪、油壓動力單元與操作盒
function cwLift4(k, x, z, col) {
  const F = cwFrame(k, x, 0, z), H = 2.8;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const px = sx * 1.6, pz = sz * 2.7;
    F.rbox(px, H / 2, pz, .26, H, .26, .03, col, TX.enamel, 0, 0, 0, .01);
    F.box(px, H / 2 + .1, pz - sz * .128, .1, H - .5, .012, 0x0e0f11, 15);   // 朝內的槽口
    for (let y = .4; y < H - .2; y += .09) F.box(px, y, pz - sz * .134, .05, .03, .004, 0x5a5e62, 15);
    F.box(px, .01, pz, .42, .02, .42, 0x2a2c30, TX.enamel).box(px, H + .015, pz, .3, .03, .3, 0x2a2c30, TX.enamel);
    for (const bx of [-1, 1]) for (const bz of [-1, 1]) F.cyl(px + bx * .16, .03, pz + bz * .16, .014, .014, .03, 6, 0x9aa0a6, 15).cyl(px + bx * .16, .02, pz + bz * .16, .022, .022, .008, 6, 0x9aa0a6, 15, 0, .5, 0);
    for (let i = 0; i < 5; i++) F.box(px, .12 + i * .08, pz + sz * .132, .2, .04, .004, i % 2 ? CW_BLK : 0xe8c020, 2, 0, 0, .5);   // 柱腳的黑黃警示斜紋
  }
  for (const sz of [-1, 1]) {
    F.rbox(0, H - .02, sz * 2.7, 3.46, .16, .2, .03, col, TX.enamel, 0, 0, 0, .008);
    for (const sx of [-1, 1]) F.cyl(sx * 1.35, H - .02, sz * 2.7 - sz * .11, .06, .06, .03, 16, 0x8a8e94, 15, Math.PI / 2, 0, 0).rod(sx * 1.35, H - .08, sz * 2.7 - sz * .11, sx * 1.48, 1.75, sz * 2.7 - sz * .11, .006, 4, 0x6a6e74, 3);
  }
  // 動力單元（左前柱外側）：馬達、油箱、操作盒
  const ux = -1.6 - .2, uz = -2.7;
  F.box(ux, 1.05, uz, .14, .34, .2, 0x2a2c30, TX.enamel).cyl(ux, 1.38, uz, .075, .075, .32, 16, 0x1a1b1e, TX.enamel).lathe(ux, 1.54, uz, [[.075, 0], [.05, .03], [0, .035]], 12, 0x1a1b1e, TX.enamel);
  F.rod(ux, .9, uz + .08, -1.6, .5, uz + .12, .01, 6, CW_BLK, TX.rubber);
  F.rbox(ux - .01, 1.55, uz + .2, .1, .18, .1, .01, 0xd8d6d0, TX.enamel);
  for (const [by, c] of [[1.6, 0x20c040], [1.52, 0xc01818]]) F.cyl(ux - .065, by, uz + .2, .018, .018, .02, 10, c, 8, 0, 0, Math.PI / 2);
  return F;
}
// 四柱頂高機會動的部分（兩條車道板、橫管、前擋、上翻的後坡板、中間的二次頂車軌道）：在 lift 自己的網格裡，原點在車道板中心
function cwLiftDeck(col) {
  const k = new Kit();
  for (const s of [-1, 1]) {
    k.box(s * .85, 0, 0, .56, .06, 5.2, 0x7a7e84, TX.steel);
    for (const e of [-1, 1]) k.box(s * .85 + e * .29, .025, 0, .025, .11, 5.2, 0x2a2c30, TX.enamel);
    k.prism(s * .85, .03, 2.62, [[-.06, 0], [.06, 0], [.02, .12], [-.04, .12]], .5, 0xe8c020, TX.enamel, 0, Math.PI / 2, 0);
    k.box(s * .85, .2, -2.72, .5, .38, .025, 0x6a6e74, TX.steel, -.35, 0, 0);
    for (let i = 0; i < 8; i++) k.box(s * .85, .03, -2.4 + i * .66, .5, .006, .02, 0x5a5e62, 15);
  }
  for (const z of [-2.5, 2.5]) k.rbox(0, -.07, z, 2.3, .14, .22, .03, col, TX.enamel, 0, 0, 0, .008);
  for (const s of [-1, 1]) k.box(s * .5, .0, 0, .05, .06, 4.6, 0x2a2c30, TX.enamel);
  k.rbox(.0, .07, .6, .7, .1, .45, .02, 0xb3121a, TX.enamel).cyl(0, .16, .6, .05, .06, .1, 12, 0x2a2c30, 15);   // 二次頂車的小千斤頂
  return k;
}
// 馬力機的大風扇：方形外殼、圓形導風罩、五片葉、護網、後面的馬達，放在有腳輪的鋼架上；原點在風扇中心（離地 cy），風往 +z 吹
function cwFan(k, x, cy, z, ry) {
  const F = cwFrame(k, x, cy, z, ry), c = 0x2a2c30, S = .85, D = .46, R = .74;
  for (const [px, py, sx, sy] of [[0, S, 2 * S + .04, .04], [0, -S, 2 * S + .04, .04], [S, 0, .04, 2 * S], [-S, 0, .04, 2 * S]]) F.box(px, py, 0, sx, sy, D, c, TX.enamel);
  F.lathe(0, 0, 0, [[R, -D / 2], [R + .04, -D / 2], [R + .04, D / 2], [R, D / 2], [R, -D / 2]], 40, 0x3a3e44, TX.enamel, Math.PI / 2, 0, 0);
  const arc = []; for (let i = 0; i <= 8; i++) { const a = Math.PI / 2 * (1 - i / 8); arc.push([Math.cos(a) * (R + .03), Math.sin(a) * (R + .03)]); }
  for (let q = 0; q < 4; q++) F.prism(0, 0, D / 2 - .02, [[S, S], [0, S], ...arc, [S, 0]], .03, c, TX.enamel, 0, 0, q * Math.PI / 2);
  for (let i = 0; i < 5; i++) { const B = cwFrameM(F, new T.Matrix4().makeRotationZ(i * Math.PI * 2 / 5)); B.box(0, .38, .02, .2, .56, .014, 0x8a8e94, 15, 0, .45, 0); }
  F.lathe(0, 0, -.02, [[.12, -.08], [.12, .04], [.08, .1], [0, .12]], 20, 0x1a1b1e, TX.enamel, Math.PI / 2, 0, 0);
  for (const r of [.22, .42, .62]) F.torus(0, 0, D / 2 + .01, r, .006, 36, 0x9aa0a6, 15, 0);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; F.rod(Math.cos(a) * .1, Math.sin(a) * .1, D / 2 + .012, Math.cos(a) * R, Math.sin(a) * R, D / 2 + .012, .006, 4, 0x9aa0a6, 15); }
  F.cyl(0, 0, -D / 2 - .16, .17, .17, .32, 20, 0x1a1b1e, TX.enamel, Math.PI / 2, 0, 0);
  for (let i = 0; i < 6; i++) F.torus(0, 0, -D / 2 - .05 - i * .045, .175, .008, 20, 0x2a2c30, 15, 0);
  for (const s of [-1, 1]) {
    F.rod(s * (S + .02), -.3, 0, s * (S + .1), -cy + .14, -.05, .025, 8, c, TX.enamel);
    F.rod(s * (S + .1), -cy + .13, -.45, s * (S + .1), -cy + .13, .45, .025, 8, c, TX.enamel);
    for (const sz of [-1, 1]) cwCaster(cwFrame(F, s * (S + .1), -cy, sz * .4), 0, 0, .12);
  }
  F.rod(-S - .1, -cy + .13, -.45, S + .1, -cy + .13, -.45, .022, 8, c, TX.enamel);
  F.rod(-.3, S + .02, -.1, -.3, S + .14, -.1, .012, 6, CW_ALU, 3).rod(.3, S + .02, -.1, .3, S + .14, -.1, .012, 6, CW_ALU, 3).rod(-.3, S + .14, -.1, .3, S + .14, -.1, .014, 6, CW_BLK, TX.rubber);
}
// 馬力機電腦：有腳輪的機櫃（散熱孔、門）、桌面、大螢幕與副螢幕（ECU 曲線）、鍵盤滑鼠、往後拖的線
function cwDynoDesk(k, x, z, ry) {
  const F = cwFrame(k, x, 0, z, ry), c = 0x2a2c30;
  F.rbox(0, .56, 0, .8, .88, .6, .02, c, TX.enamel, 0, 0, 0, .006);
  F.rbox(-.18, .55, .302, .36, .78, .012, .006, 0x3a3e44, TX.enamel).rbox(.2, .55, .302, .36, .78, .012, .006, 0x3a3e44, TX.enamel);
  for (let i = 0; i < 10; i++) F.box(.2, .3 + i * .05, .31, .26, .012, .004, 0x0c0d0f, 15);
  F.box(-.05, .6, .315, .012, .14, .02, CW_ALU, 3);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cwCaster(F, sx * .32, sz * .22);
  F.rbox(0, 1.015, .04, .96, .03, .74, .01, CW_BLK, TX.rubber);
  F.rbox(.02, 1.04, .24, .46, .018, .16, .006, 0x1a1b1e, TX.rubber);
  for (let r = 0; r < 4; r++) for (let i = 0; i < 14; i++) F.box(-.18 + i * .029, 1.051, .184 + r * .034, .022, .006, .024, 0x2a2c30, 2);
  F.lathe(.36, 1.03, .24, [[.025, 0], [.028, .012], [.015, .025], [0, .028]], 10, 0x1a1b1e, 2);
  F.rbox(-.05, 1.04, -.12, .28, .012, .2, .02, 0x1a1b1e, 15).rod(-.05, 1.04, -.16, -.05, 1.38, -.18, .025, 10, 0x2a2c30, 15);
  const M = cwFrame(F, -.05, 1.52, -.14);
  M.rbox(0, 0, 0, 1.06, .62, .045, .015, 0x0a0c10, 2, -.1).box(0, .01, .026, 1.0, .55, .004, 0x2a8a7a, 11, -.1);
  F.rbox(.48, 1.28, -.02, .38, .26, .03, .01, 0x0a0c10, 2, -.12, -.5).box(.483, 1.285, .0, .34, .22, .003, 0x3a6ad8, 11, -.12, -.5);
  F.box(.46, 1.08, -.18, .14, .06, .12, 0x3a3e44, 15).cyl(.43, 1.115, -.12, .006, .006, .004, 6, 0x20ff60, 8, Math.PI / 2, 0, 0);
  for (let i = 0; i < 3; i++) F.rod(-.1 + i * .05, .98, -.3, -.12 + i * .06, .012, -.42 - i * .04, .009, 4, CW_BLK, TX.rubber).rod(-.12 + i * .06, .012, -.42 - i * .04, -.3 + i * .2, .012, -1.2 - i * .3, .009, 4, CW_BLK, TX.rubber);
}
// 鐵手強尼的櫃檯（面向 +z 是客人那側）：不鏽鋼檯面、前板、底下的層板與零件盒、台虎鉗、診斷電腦、手提工具箱、活塞與機油罐
function cwCounter(k, x, z, ry) {
  const F = cwFrame(k, x, 0, z, ry), W = 3, D = .8, c = 0x3a3e44, R = rng(4242);
  F.rbox(0, .51, D / 2 - .03, W, .86, .05, .015, c, TX.enamel);
  for (const s of [-1, 1]) F.rbox(s * (W / 2 - .02), .51, 0, .04, .86, D, .01, c, TX.enamel);
  F.box(0, .05, D / 2 - .01, W - .02, .1, .04, CW_BLK, TX.rubber);
  for (const y of [.12, .5]) F.box(0, y, -.02, W - .08, .025, D - .1, 0x5a5e62, TX.steel);
  F.rbox(0, .955, .0, D + .1, .05, W + .06, .018, 0xb8bcc0, TX.steel, 0, Math.PI / 2, 0);
  F.box(0, .9, D / 2 + .02, W + .04, .03, .006, CW_ALU, 3);
  for (let i = 0; i < 6; i++) { const bx = -1.2 + i * .44 + R() * .05; F.rbox(bx, .19 + R() * .01, -.05 + R() * .08, .36, .13, .3, .02, [0x1f5fa8, 0xb3121a, 0xe8c020, 0x2a2c30][i % 4], TX.rubber, 0, (R() - .5) * .2, 0); }
  for (let i = 0; i < 4; i++) F.lathe(-1.1 + i * .22 + R() * .05, .525, -.1, [[.06, 0], [.06, .16], [.04, .19], [.015, .2], [.015, .23], [0, .23]], 14, [0x1a3a8a, 0x8a1018, 0xd8a020, 0x2a2c30][i], TX.enamel);
  // 檯面上的東西（高度 .98）
  const T0 = .98, sc = cwFrame(F, -.8, T0, -.1, .15);
  sc.rbox(0, .01, 0, .3, .02, .22, .01, 0x1a1b1e, 15).rod(0, .02, -.05, 0, .26, -.07, .02, 8, 0x2a2c30, 15);
  sc.rbox(0, .42, -.07, .72, .46, .045, .012, 0x0a0c10, 2, -.08).box(0, .425, -.046, .66, .4, .004, 0x2a6a8a, 11, -.08);
  for (let i = 0; i < 5; i++) sc.box(-.12 + (i % 2) * .1, .56 - i * .06, -.043, .36 - (i % 3) * .08, .012, .002, 0x0c1e28, 2, -.08);   // 螢幕上的表單列
  sc.box(.22, .36, -.043, .14, .16, .002, 0xe8b048, 11, -.08);
  sc.rbox(0, .015, .22, .42, .016, .14, .005, 0x1a1b1e, TX.rubber);
  const tb = cwFrame(F, .45, T0, .05, -.25);
  tb.rbox(0, .1, 0, .5, .2, .26, .02, 0xb3121a, TX.enamel).rbox(0, .21, 0, .26, .04, .5, .02, 0xb3121a, TX.enamel, 0, Math.PI / 2, 0);
  tb.torus(0, .25, 0, .1, .012, 12, CW_BLK, TX.rubber, 0, 0, 0, Math.PI, 6);
  for (const s of [-1, 1]) tb.box(s * .17, .17, .132, .04, .05, .01, CW_ALU, 3);
  const vs = cwFrame(F, 1.32, T0, .1, Math.PI / 2);   // 台虎鉗（夾口朝 +x，伸出檯面外）
  vs.box(0, .02, 0, .16, .04, .22, 0x1f5fa8, TX.enamel).rbox(0, .1, .02, .14, .12, .3, .02, 0x1f5fa8, TX.enamel);
  vs.box(0, .14, .19, .16, .08, .04, 0x2a2c30, 15).box(0, .14, .24, .16, .08, .04, 0x2a2c30, 15).rod(0, .1, .27, 0, .1, .42, .012, 8, CW_ALU, 3).rod(-.1, .1, .42, .1, .1, .42, .008, 6, CW_ALU, 3);
  F.lathe(-.1, T0, -.22, [[.045, 0], [.045, .06], [.035, .075], [.035, .09], [0, .09]], 16, 0xb8bcc0, 3);   // 活塞
  F.rod(-.1, T0 + .03, -.22, .08, T0 + .015, -.3, .012, 6, 0x8a8e94, 3);
  F.lathe(.95, T0, -.25, [[.06, 0], [.06, .14], [.05, .16], [.02, .17], [0, .17]], 14, 0x1a6a3a, TX.enamel).rod(.95, T0 + .16, -.25, 1.02, T0 + .2, -.28, .006, 4, CW_ALU, 3);
  F.lathe(-1.35, T0, .18, [[.04, 0], [.042, .1], [0, .1]], 14, 0xf4f1ea, 10).torus(-1.39, T0 + .05, .18, .025, .006, 10, 0xf4f1ea, 10, 0, Math.PI / 2, 0);   // 馬克杯
  F.prism(.1, T0 + .004, .15, [[0, 0], [.22, .03], [.26, .14], [.12, .2], [-.04, .12]], .008, 0xa83a2a, TX.rubber, Math.PI / 2, 0, 0);   // 抹布
}
// 焊接機械臂：六軸工業手臂（底座、轉台、肩、上臂、肘與後配重、前臂、腕、焊槍），焊槍尖端在 (px, py, pz)，手臂所在的鉛直面朝向焊點
function cwRobot(k, bx, bz, px, py, pz) {
  const Y = 0xe8a020, D = 0x2a2c30, L = Math.hypot(px - bx, pz - bz), ux = (px - bx) / L, uz = (pz - bz) / L, nx = -uz, nz = ux;
  k.lathe(bx, 0, bz, [[.55, 0], [.55, .06], [.42, .1], [.4, .32], [.34, .36], [0, .36]], 28, D, TX.enamel);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; k.cyl(bx + Math.cos(a) * .48, .075, bz + Math.sin(a) * .48, .025, .025, .03, 6, 0x9aa0a6, 15); }
  k.lathe(bx, .36, bz, [[.38, 0], [.38, .16], [.3, .26], [0, .26]], 24, Y, TX.enamel);
  const S = [bx + ux * .14, 1.0, bz + uz * .14], W = [px - ux * .3, py + .34, pz - uz * .3];
  const E = [(S[0] + W[0]) / 2 - ux * .15, Math.max(S[1], W[1]) + .72, (S[2] + W[2]) / 2 - uz * .15];
  const joint = (p, r, w, c) => k.rod(p[0] - nx * w, p[1], p[2] - nz * w, p[0] + nx * w, p[1], p[2] + nz * w, r, 20, c, TX.enamel);
  k.rbox(bx + ux * .06, .78, bz + uz * .06, .5, .44, .5, .1, Y, TX.enamel, 0, Math.atan2(ux, uz), 0);
  joint(S, .2, .27, Y); joint(S, .12, .33, D);
  k.bar(S[0], S[1], S[2], E[0], E[1], E[2], .26, .3, Y, TX.enamel);
  joint(E, .16, .2, Y); joint(E, .09, .25, D);
  const bk = [E[0] - (W[0] - E[0]) * .28, E[1] - (W[1] - E[1]) * .28, E[2] - (W[2] - E[2]) * .28];
  k.bar(E[0], E[1], E[2], bk[0], bk[1], bk[2], .26, .26, D, TX.enamel).rod(bk[0] - nx * .1, bk[1], bk[2] - nz * .1, bk[0] + nx * .1, bk[1], bk[2] + nz * .1, .14, 16, D, TX.enamel);
  k.bar(E[0], E[1], E[2], W[0], W[1], W[2], .18, .2, Y, TX.enamel);
  joint(W, .09, .12, D);
  k.rod(W[0], W[1], W[2], px, py + .06, pz, .035, 10, D, 15).rod(px, py + .06, pz, px, py, pz, .022, 10, 0xc87a3a, 3, .012);
  const C = [[bx - ux * .3, .5, bz - uz * .3], [S[0] - ux * .35, S[1] + .2, S[2] - uz * .35], [(S[0] + E[0]) / 2 - nx * .2, (S[1] + E[1]) / 2 + .25, (S[2] + E[2]) / 2 - nz * .2], [E[0] - nx * .2, E[1] + .1, E[2] - nz * .2], [W[0] - nx * .12, W[1] + .1, W[2] - nz * .12]];
  for (let i = 0; i + 1 < C.length; i++) k.rod(...C[i], ...C[i + 1], .03, 8, CW_BLK, TX.rubber);
}
// 木頭工作檯（局部 x 是長邊）：厚木板拼的檯面（每片色差、縫）、四支腳、橫撐、下層板
function cwWoodBench(k, x, z, ry, W, D, H, col) {
  const F = cwFrame(k, x, 0, z, ry), R = rng(77), gx = Math.abs(Math.sin(ry)) > .7 ? TX.woodZ : TX.woodX, gz = gx === TX.woodX ? TX.woodZ : TX.woodX, c = new T.Color(col);
  const shade = v => c.clone().multiplyScalar(v);
  for (let i = 0, n = 5; i < n; i++) F.box((R() - .5) * .02, H - .03, -D / 2 + (i + .5) * D / n, W + (R() - .5) * .03, .06, D / n - .008, shade(.85 + R() * .3), gx);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.box(sx * (W / 2 - .08), (H - .06) / 2, sz * (D / 2 - .08), .09, H - .06, .09, shade(.8), TX.woodY);
  for (const sz of [-1, 1]) F.box(0, H - .12, sz * (D / 2 - .08), W - .2, .1, .05, shade(.75), gx).box(0, .18, sz * (D / 2 - .08), W - .2, .07, .05, shade(.75), gx);
  for (const sx of [-1, 1]) F.box(sx * (W / 2 - .08), H - .12, 0, .05, .1, D - .2, shade(.75), gz);
  for (let i = 0; i < 3; i++) F.box(0, .23, -D / 2 + .15 + i * (D - .3) / 2, W - .2, .025, (D - .3) / 3, shade(.7 + R() * .2), gx);
  return F;
}
// Rook 的收車檯（面向 +z）：直條木板拼的前板（板間留黑縫）、厚檯面、收銀機、帳本、檯燈
function cwWoodCounter(k, x, z, ry, W, D, H, col) {
  const F = cwFrame(k, x, 0, z, ry), R = rng(91), gx = Math.abs(Math.sin(ry)) > .7 ? TX.woodZ : TX.woodX, c = new T.Color(col);
  F.box(0, H / 2, 0, W - .04, H - .06, D - .06, 0x120c08, 2);
  for (let xx = -W / 2 + .07; xx < W / 2; xx += .14) F.box(xx + (R() - .5) * .004, (H - .06) / 2, D / 2 - .02, .128, H - .06 - R() * .02, .03, c.clone().multiplyScalar(.8 + R() * .35), TX.woodY);
  F.rbox(0, H - .03, .03, D + .08, .06, W + .1, .02, c.clone().multiplyScalar(.7), gx, 0, Math.PI / 2, 0);
  F.box(0, .04, D / 2 - .01, W, .08, .04, 0x0c0d0f, 2);
  const cr = cwFrame(F, -.55, H, -.05, .1);   // 收銀機
  cr.rbox(0, .08, 0, .42, .16, .4, .02, 0x2a2c30, TX.enamel).box(0, .17, .1, .38, .02, .16, 0x1a1b1e, 2, -.3);
  for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) cr.box(-.12 + i * .08, .19 + r * .012, .06 + r * .04, .05, .008, .03, 0xd8d6d0, 2, -.3);
  cr.rbox(0, .26, -.12, .22, .1, .04, .01, 0x1a1b1e, 2).box(0, .26, -.098, .18, .05, .004, 0x30ff80, 11);
  F.box(.2, H + .02, .05, .32, .04, .24, 0x2a3a5a, 2, 0, .35, 0).box(.2, H + .045, .05, .3, .01, .22, 0xefe6d2, 10, 0, .35, 0);   // 帳本
  F.lathe(.75, H, -.18, [[.08, 0], [.08, .02], [.02, .03], [0, .03]], 14, 0x1a1b1e, 15).rod(.75, H + .03, -.18, .72, H + .42, -.1, .01, 6, 0x1a1b1e, 15);
  F.lathe(.72, H + .32, -.04, [[0, .14], [.03, .14], [.13, .0], [.12, -.01], [0, .1]], 16, 0x1a5a3a, TX.enamel, .5, 0, 0).cyl(.72, H + .37, -.02, .03, .03, .04, 8, 0xfff0c8, 11);
}
// 皮沙發（面向 +z）：底座、三個坐墊（稍微歪）、三個靠墊、圓扶手、四支短腳、一個歪放的抱枕
function cwSofa(k, x, z, ry, W, col) {
  const F = cwFrame(k, x, 0, z, ry), R = rng(55), c = new T.Color(col), sh = v => c.clone().multiplyScalar(v);
  F.rbox(0, .24, 0, W - .3, .2, .82, .04, sh(.85), 10, 0, 0, 0, .02);
  for (let i = 0; i < 3; i++) { const cx = (i - 1) * (W - .4) / 3; F.rbox(cx, .4, .06, (W - .4) / 3 - .03, .14, .7, .06, sh(.95 + R() * .1), 10, (R() - .5) * .05, (R() - .5) * .04, (R() - .5) * .04, .03); F.rbox(cx, .7, -.3, (W - .4) / 3 - .03, .5, .18, .07, sh(.9 + R() * .1), 10, -.18, 0, (R() - .5) * .04, .04); }
  for (const s of [-1, 1]) F.rbox(s * (W / 2 - .1), .42, 0, .2, .56, .9, .09, sh(.8), 10, 0, 0, 0, .04);
  F.rbox(0, .55, -.38, W - .2, .62, .14, .06, sh(.78), 10, 0, 0, 0, .03);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.lathe(sx * (W / 2 - .12), 0, sz * .36, [[.03, 0], [.04, .1], [.035, .14], [0, .14]], 8, 0x2a1810, TX.woodY);
  F.rbox(W / 2 - .45, .58, -.12, .36, .34, .12, .06, 0x9a7a3a, 10, -.4, .3, .2, .03);
}
// 復古加油機（面向 +z）：底座、圓角機身、計量錶頭（白色錶面、指針、鍍鉻框）、價格窗、油槍掛座與垂下的油管、頂上的燈罩球
function cwPump(k, x, z, ry, col) {
  const F = cwFrame(k, x, 0, z, ry);
  F.rbox(0, .06, 0, .7, .12, .62, .02, 0x1a1b1e, TX.enamel);
  F.rbox(0, .82, 0, .54, 1.4, .5, .1, col, TX.enamel, 0, 0, 0, .03);
  F.rbox(0, 1.72, 0, .6, .4, .56, .16, col, TX.enamel, 0, 0, 0, .03);
  F.cyl(0, 1.72, .285, .19, .19, .02, 32, 0xf4f1ea, 10, Math.PI / 2, 0, 0).torus(0, 1.72, .29, .19, .014, 32, CW_ALU, 3, 0);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; F.box(Math.cos(a) * .15, 1.72 + Math.sin(a) * .15, .297, .008, .03, .002, 0x1a1b1e, 2, 0, 0, a + Math.PI / 2); }
  F.box(.04, 1.75, .3, .11, .008, .003, 0xb3121a, 2, 0, 0, .6);
  F.rbox(0, 1.22, .255, .34, .16, .02, .01, 0x1a1b1e, 2).box(0, 1.22, .266, .3, .12, .003, 0xefe6d2, 11);
  F.box(0, .55, .252, .4, .5, .006, 0xefe6d2, 10).box(0, .55, .256, .3, .06, .003, col, 2);
  F.lathe(0, 1.92, 0, [[.08, 0], [.06, .05], [.06, .08], [0, .08]], 16, CW_ALU, 3);
  F.lathe(0, 2.0, 0, [[0, 0], [.1, .01], [.19, .08], [.22, .2], [.19, .32], [.1, .39], [0, .4]], 24, 0xfff4e0, 11);
  F.torus(0, 2.2, 0, .222, .02, 32, col, 2);
  F.box(.3, 1.1, .12, .06, .24, .14, 0x2a2c30, TX.enamel).rod(.33, 1.18, .12, .36, .95, .2, .02, 8, CW_ALU, 3).rod(.36, .95, .2, .38, .9, .26, .01, 6, CW_ALU, 3);
  F.torus(.3, .62, .12, .42, .022, 20, CW_BLK, TX.rubber, 0, Math.PI / 2, 0, Math.PI * 1.1, 8);
}
// 拆下來的車身鈑件：引擎蓋（有拱度的薄板）與車門（側視輪廓、深色窗框、把手），一片一片歪疊
function cwHood(F, w, l, col) {
  const n = 9, P = [], N = [], U = [];
  for (let i = 0; i < 5; i++) { const t = i / 4; P.push([0, .03 * (1 - (2 * t - 1) ** 2), -l / 2 + l * t]); N.push([1, 0, 0]); U.push([0, 1, 0]); }
  const sec = i => {   // 前窄後寬的拱形薄板：上緣由左到右、下緣由右到左
    const ww = w * (1 - .08 * (i / 4)), top = [];
    for (let j = 0; j <= n; j++) { const xx = -ww / 2 + ww * j / n; top.push([xx, .06 * (1 - (2 * xx / ww) ** 2)]); }
    return [...top, ...top.slice().reverse().map(([a, b]) => [a, b - .014])];
  };
  F.loft(P, N, U, sec, col, 0);
}
function cwDoor(F, col) {
  const out = [[-.55, 0], [.55, 0], [.6, .5], [.48, .94], [-.2, 1.0], [-.5, .58], [-.58, .5]];
  F.prism(0, 0, 0, out, .08, col, 0, -Math.PI / 2, 0, 0, .01);
  F.prism(0, 0, 0, [[-.38, .56], [.48, .56], [.42, .88], [-.16, .92]], .086, 0x0a0c10, 1, -Math.PI / 2, 0, 0);
  F.box(.36, .045, -.42, .14, .02, .03, CW_ALU, 3);
}
// 輪框（正面朝 +z）：桶身（兩側唇邊）、輻條（三款）、中心蓋與螺帽
function cwRim(F, x, y, z, style, col) {
  const G = cwFrame(F, x, y, z);
  G.lathe(0, 0, 0, [[.36, -.11], [.42, -.11], [.42, -.096], [.385, -.086], [.385, .086], [.42, .096], [.42, .11], [.36, .11], [.36, -.11]], 36, col, 3, Math.PI / 2, 0, 0);
  const sp = style === 1 ? 10 : style === 2 ? 6 : 5;
  for (let i = 0; i < sp; i++) {
    const a = i / sp * Math.PI * 2, B = cwFrameM(G, new T.Matrix4().makeRotationZ(a));
    if (style === 2) for (const s of [-1, 1]) B.box(s * .028, .22, .07, .022, .3, .03, col, 3, 0, 0, s * .06);
    else B.box(0, .22, .07, style === 1 ? .02 : .065, .3, .035, col, 3, -.12);
  }
  G.lathe(0, 0, .06, [[.1, 0], [.1, .03], [.06, .05], [0, .055]], 16, col, 3, Math.PI / 2, 0, 0).cyl(0, 0, .12, .035, .035, .01, 12, 0x1a1b1e, 2, Math.PI / 2, 0, 0);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; G.cyl(Math.cos(a) * .07, Math.sin(a) * .07, .11, .011, .011, .02, 6, CW_ALU, 3, Math.PI / 2, 0, 0); }
}
// 尾翼（正面朝 −z 掛在展示板上）：翼型剖面、兩側端板、鵝頸支架
function cwWing(F, w, col, mat) {
  const af = [[0, 0], [.06, .028], [.16, .036], [.28, .018], [.33, .004], [.33, 0], [.2, -.008], [.06, -.01]];
  F.prism(0, 0, 0, af, w, col, mat, 0, Math.PI / 2, 0);
  for (const s of [-1, 1]) F.prism(s * (w / 2 + .006), 0, 0, [[-.04, -.08], [.36, -.06], [.38, .1], [.02, .14]], .012, col, mat, 0, Math.PI / 2, 0);
  for (const s of [-1, 1]) F.bar(s * w * .3, .02, .16, s * w * .3, -.18, .28, .02, .06, 0x2a2c30, 15);
}
// 洞洞板上的手工具：扳手（開口端＋梅花端）、起子、鐵鎚、尖嘴鉗、套筒條；工具掛在 z 平面上，正面朝 −z
function cwTool(F, x, y, kind, R) {
  const z = 0, c = [0xb3121a, 0xe8c020, 0x1f5fa8, 0x1a1b1e][Math.floor(R() * 4)];
  F.rod(x, y + .06, z + .01, x, y + .06, z - .04, .004, 4, CW_ALU, 3);   // 掛勾
  if (kind === 0) { const l = .14 + R() * .12; F.box(x, y - l / 2, z - .02, .018, l, .006, CW_ALU, 3).torus(x, y + .01, z - .02, .022, .006, 10, CW_ALU, 3, 0, 0, 0, Math.PI * 1.4, 4).torus(x, y - l - .015, z - .02, .02, .007, 10, CW_ALU, 3, 0); }
  else if (kind === 1) { const l = .12 + R() * .1; F.rod(x, y, z - .025, x, y - .1, z - .025, .014, 8, c, 2).rod(x, y - .1, z - .025, x, y - .1 - l, z - .025, .004, 6, CW_ALU, 3); }
  else if (kind === 2) { F.rod(x, y - .3, z - .025, x, y, z - .025, .014, 8, 0x8a5a30, TX.woodY).box(x, y + .02, z - .025, .12, .035, .035, 0x2a2c30, 15); }
  else if (kind === 3) { for (const s of [-1, 1]) F.box(x + s * .015, y - .1, z - .022, .016, .2, .008, 0x8a8e94, 3, 0, 0, s * .12).box(x + s * .03, y - .17, z - .022, .022, .1, .014, 0xb3121a, TX.rubber, 0, 0, s * .12); }
  else { F.box(x, y, z - .02, .4, .03, .015, 0xb3121a, TX.enamel); for (let i = 0; i < 8; i++) F.cyl(x - .17 + i * .048, y + .03, z - .03, .009 + i * .0015, .009 + i * .0015, .04, 10, CW_ALU, 3); }
}
// 2 樓老闆辦公室：主管桌（兩側抽屜櫃、前擋板、皮革桌墊、綠罩檯燈、電話、文件）、高背皮椅（五爪腳、氣壓桿）、保險箱（轉盤、把手輪、鉸鏈）
function cwExecDesk(k, x, y, z, ry) {
  const F = cwFrame(k, x, y, z, ry), W = 2.2, D = 1.0, H = .76, c = 0x4a2c18, gx = Math.abs(Math.sin(ry)) > .7 ? TX.woodZ : TX.woodX;
  F.rbox(0, H - .025, 0, D + .06, .05, W + .06, .02, c, gx, 0, Math.PI / 2, 0);
  F.box(0, H / 2 + .05, D / 2 - .03, W - .1, H - .2, .03, 0x3a2414, gx);
  for (const s of [-1, 1]) {
    F.box(s * (W / 2 - .25), (H - .05) / 2, 0, .46, H - .05, D - .06, 0x3a2414, gx);
    for (let i = 0; i < 3; i++) { const cy = .14 + i * .2; F.box(s * (W / 2 - .25), cy, -D / 2 + .02, .42, .18, .02, 0x4a2c18, gx).cyl(s * (W / 2 - .25), cy + .03, -D / 2 + .005, .012, .012, .1, 8, 0xc9a24a, 3, 0, 0, Math.PI / 2); }
  }
  F.rbox(0, H + .004, -.08, .8, .006, .5, .02, 0x1a1210, 10);
  F.lathe(.75, H, .2, [[.07, 0], [.07, .015], [.012, .02], [.012, .32], [0, .32]], 14, 0xc9a24a, 3).rod(.62, H + .33, .2, .88, H + .33, .2, .01, 6, 0xc9a24a, 3);
  F.cyl(.75, H + .38, .2, .07, .07, .3, 16, 0x1a5a3a, 2, 0, 0, Math.PI / 2).cyl(.75, H + .36, .2, .06, .06, .28, 12, 0xfff0c8, 11, 0, 0, Math.PI / 2);
  F.rbox(-.75, H + .03, .1, .2, .05, .22, .02, 0x1a1b1e, 2, 0, .3, 0).rod(-.82, H + .07, .05, -.68, H + .07, .15, .022, 8, 0x1a1b1e, 2);
  for (let i = 0; i < 4; i++) F.box(-.2 + i * .03, H + .003 + i * .003, .25, .21, .002, .3, 0xf4f1ea, 10, 0, .2 - i * .15, 0);
  F.rbox(.3, H + .17, .3, .52, .32, .03, .012, 0x0a0c10, 2, -.1, Math.PI, 0).rod(.3, H, .32, .3, H + .1, .32, .02, 8, 0x1a1b1e, 15);
  F.lathe(-.45, H, -.25, [[.06, 0], [.06, .02], [.045, .025], [0, .025]], 14, 0x2a2a2a, 3).rod(-.43, H + .025, -.25, -.33, H + .03, -.22, .009, 6, 0x6a4a2a, 2);   // 菸灰缸與雪茄
}
function cwExecChair(k, x, y, z, ry) {
  const F = cwFrame(k, x, y, z, ry), lc = 0x1a1210;
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + .3, ex = Math.sin(a) * .32, ez = Math.cos(a) * .32; F.rod(0, .1, 0, ex, .06, ez, .025, 6, 0x2a2c30, 3); F.cyl(ex, .035, ez, .035, .035, .03, 10, CW_BLK, TX.rubber, 0, 0, Math.PI / 2); }
  F.cyl(0, .26, 0, .03, .03, .32, 10, 0x8a8e94, 3).cyl(0, .4, 0, .06, .05, .06, 12, 0x1a1b1e, 2);
  F.rbox(0, .48, .02, .54, .12, .52, .05, lc, 10, 0, 0, 0, .03);
  F.rbox(0, .95, -.26, .52, .82, .12, .1, lc, 10, -.12, 0, 0, .04);
  for (let i = 0; i < 3; i++) F.box(0, .7 + i * .2, -.19 - i * .025, .44, .006, .02, 0x0c0806, 10, -.12);
  for (const s of [-1, 1]) F.rbox(s * .3, .66, .0, .07, .05, .42, .02, lc, 10).rod(s * .3, .5, .1, s * .3, .64, .1, .015, 6, 0x8a8e94, 3);
}
function cwSafe(k, x, y, z, ry) {
  const F = cwFrame(k, x, y, z, ry), c = 0x2c3a34;
  F.rbox(0, .58, 0, .9, 1.08, .86, .04, c, TX.enamel, 0, 0, 0, .015);
  F.rbox(0, .58, .432, .74, .92, .02, .02, c, TX.enamel).box(0, .58, .444, .7, .88, .004, 0x22302a, TX.enamel);
  F.cyl(.0, .78, .45, .07, .07, .03, 24, 0x1a1b1e, 2, Math.PI / 2, 0, 0).cyl(0, .78, .468, .055, .055, .01, 24, 0xc9a24a, 3, Math.PI / 2, 0, 0);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; F.box(Math.cos(a) * .062, .78 + Math.sin(a) * .062, .466, .004, .012, .004, 0x1a1b1e, 2, 0, 0, a + Math.PI / 2); }
  F.torus(0, .5, .48, .1, .012, 20, 0xc9a24a, 3, 0);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; F.rod(0, .5, .48, Math.cos(a) * .1, .5 + Math.sin(a) * .1, .48, .01, 6, 0xc9a24a, 3); F.lathe(Math.cos(a) * .15, .5 + Math.sin(a) * .15, .5, [[.02, 0], [.022, .02], [0, .03]], 8, 0xc9a24a, 3, Math.PI / 2, 0, 0); }
  for (const hy of [.3, .86]) F.cyl(-.38, hy, .45, .03, .03, .12, 12, 0x1a1b1e, 15);
  F.box(0, 1.0, .447, .24, .05, .004, 0xc9a24a, 3);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.box(sx * .38, .02, sz * .36, .1, .04, .1, 0x1a1b1e, 2);
}
// 2 樓載車升降機（貼牆、裝飾）：兩支導軌柱、頂樑、鏈條、懸臂叉、操作盒
function cwCarElevator(k, x, y, z, ry) {
  const F = cwFrame(k, x, y, z, ry), c = 0x2a2c30, Y = 0xe8c020;
  for (const s of [-1, 1]) { F.rbox(s * 2.2, 1.65, 0, .22, 3.3, .22, .02, c, TX.enamel, 0, 0, 0, .008); F.rod(s * 2.05, .1, -.08, s * 2.05, 3.2, -.08, .012, 6, 0x5a5e62, 15); for (let i = 0; i < 6; i++) F.box(s * 2.2, .1 + i * .06, .112, .18, .03, .004, i % 2 ? CW_BLK : Y, 2, 0, 0, .5); }
  F.rbox(0, 3.35, 0, 4.66, .2, .26, .03, c, TX.enamel).box(0, 3.35, .132, 3.4, .14, .004, Y, 2);
  F.box(0, .25, .5, 4.2, .08, .9, 0x5a5e62, TX.steel);
  for (let i = 0; i < 14; i++) F.box(-1.95 + i * .3, .3, .5, .03, .015, .84, 0x6a6e72, TX.steel);   // 防滑條
  for (let i = 0; i < 10; i++) F.box(-1.9 + i * .42, .25, .955, .42, .08, .01, i % 2 ? CW_BLK : Y, 2);   // 前緣警示
  for (const s of [-1, 1]) {
    F.box(s * 1.6, .18, .9, .14, .14, 1.5, c, TX.enamel).rbox(s * 2.05, .4, .45, .1, .4, .9, .02, c, TX.enamel);
    F.cyl(s * 2.2, 1.2, .22, .06, .06, 2.0, 14, 0x9a9ea4, 3).cyl(s * 2.2, .55, .22, .085, .085, .9, 14, c, TX.enamel);   // 油壓缸
    F.rod(s * 2.12, 3.25, .08, s * 2.05, .45, .45, .012, 6, 0x3a3c40, 15).rod(s * 2.28, 3.25, .08, s * 2.05, .45, .45, .012, 6, 0x3a3c40, 15);   // 鏈條
    F.bar(s * 2.2, 2.75, .0, s * 1.6, 3.35, 0, .1, .08, c, TX.enamel);   // 角撐
    F.cyl(s * 2.2, 3.35, .16, .1, .1, .05, 16, 0x5a5e62, TX.steel, Math.PI / 2, 0, 0);   // 鏈輪
  }
  F.rbox(2.55, 1.3, .1, .18, .26, .12, .02, 0xd8d6d0, TX.enamel);
  for (const [by, cc] of [[1.36, 0x20c040], [1.27, 0xc01818]]) F.cyl(2.55, by, .17, .02, .02, .02, 10, cc, 8, Math.PI / 2, 0, 0);
}
