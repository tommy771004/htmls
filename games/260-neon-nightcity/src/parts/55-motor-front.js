
// ═══ 室外門面：VELOCE MOTORS 車行的落地窗、雨棚與門前兩台展示車；GARAGE 07 車庫的燈條與招牌 ═══
// 要在 60-venues.js 把 signLights 複製成 outLights、把 signGeo 合成 signMesh 之前執行
{
  const k = new Kit(), dx = DEAL_X, dz = DEAL_Z, gold = 0xffcf6a;
  // 落地展示窗：亮著的店內＋天花板燈帶、鍍鉻直框、底部踢腳板
  for (const s of [-1, 1]) {
    const cx = dx + s * 6.1;
    k.box(cx, 2.3, dz + .03, 9.4, 4.2, .04, 0x8a7c66, 11);
    k.box(cx, 4.05, dz + .06, 9.4, .08, .03, 0xfff2d8, 11);
    k.box(cx, .3, dz + .07, 9.4, .4, .06, 0x111214, 2);
    for (let i = 0; i <= 3; i++) k.box(cx - 4.7 + i * 3.133, 2.3, dz + .08, .1, 4.3, .08, 0xc8ccd2, 3);
  }
  // 玻璃門與金色門框
  k.box(dx, 1.45, dz + .05, 2.6, 2.9, .05, 0x0a0c10, 1);
  k.box(dx, 2.95, dz + .09, 2.8, .1, .08, gold, 3);
  for (const s of [-1, 1]) { k.box(dx + s * 1.36, 1.5, dz + .09, .1, 3.0, .08, gold, 3); k.box(dx + s * .25, 1.15, dz + .12, .04, .9, .04, 0xd8dce2, 3); }
  k.box(dx, 3.75, dz + .05, 2.6, 1.4, .05, 0x5a5044, 11);
  // 雨棚
  k.box(dx, 4.55, dz + .95, 22, .16, 1.9, 0x15161a, 15);
  k.box(dx, 4.47, dz + 1.9, 22, .05, .04, gold, 8);
  k.box(dx, 5.65, dz + .12, 9.2, 2.1, .2, 0x0b0a08, 2);
  // 展示台：低矮的黑色台座、金色燈邊
  const show = [['saetta', dx - 6.5, -Math.PI / 2 + .3], ['furia', dx + 6.5, Math.PI / 2 - .3]];
  for (const [, x] of show) {
    k.box(x, .21, dz + 2.1, 5.4, .12, 2.7, 0x1a1a1e, 10);
    k.box(x, .275, dz + 3.46, 5.4, .02, .03, gold, 8).box(x, .275, dz + .74, 5.4, .02, .03, gold, 8);
  }
  scene.add(new T.Mesh(k.build(), MAT.uber));
  // 店內的車：壓扁的側面剪影貼在亮著的窗後
  for (const [id, x] of [['kanto', dx - 8.8], ['ronin', dx - 3.6], ['lucerna', dx + 3.7], ['meridian', dx + 8.8]]) {
    const m = new T.Mesh(carKit(id, 0x2a2c30).build(), MAT.uber);
    m.position.set(x, .2, dz + .05); m.rotation.y = x < dx ? Math.PI / 2 : -Math.PI / 2; m.scale.set(.02, .92, .92); scene.add(m);
  }
  for (const [id, x, yaw] of show) {
    const m = new T.Mesh(carKit(id).build(), MAT.uber);
    m.position.set(x, .27, dz + 2.1); m.rotation.y = yaw; scene.add(m);
    const L = CARS[id].len * .28;
    for (const s of [-1, 1]) circles.push({ x: x + Math.sin(yaw) * L * s, z: dz + 2.1 + Math.cos(yaw) * L * s, r: 1.15 });
    signLights.push({ x, y: 4.2, z: dz + 2.4, col: lin(0xfff0d8), r: 8, i: 1.1 });
  }
  signQuad(dx, 5.65, dz + .25, 0, 1, 8.8, 2.2, 'VELOCE', .6, 0, 1.5, gold, 12);
  signLights.push({ x: dx, y: 2.6, z: dz + 2.6, col: lin(0xffd8a0), r: 12, i: .9 });
}
{
  const k = new Kit(), hx = HOME_X, hz = HOME_Z, amber = 0xff8a3a;
  // 兩扇捲門外的燈條、壁燈、門前斜紋
  k.box(hx, 3.75, hz - .1, 11.6, .08, .05, amber, 8);
  for (const s of [-1, 1]) k.box(hx + s * 5.8, 1.9, hz - .1, .08, 3.75, .05, amber, 8);
  k.box(hx, 4.9, hz - .33, 5.8, 1.56, .2, 0x111214, 2);
  for (const s of [-1, 1]) { k.box(hx + s * 3.2, 3.25, hz - .14, .26, .34, .2, 0x1a1b1e, 15); k.box(hx + s * 3.2, 3.25, hz - .25, .18, .24, .02, 0xffc890, 11); }
  scene.add(new T.Mesh(k.build(), MAT.uber));
  const pad = new Kit();
  for (let i = 0; i < 11; i++) pad.box(hx - 5 + i, .158, hz - 2.2, .16, .01, 3.6, 0xd89a2a, 11, 0, .5);
  for (const s of [-1, 1]) pad.box(hx + s * 5.6, .158, hz - 2.2, .1, .01, 3.8, 0xd89a2a, 11);
  const pm = new T.Mesh(pad.build(), MAT.uber); pm.layers.set(LY.NOREFL); scene.add(pm);
  signQuad(hx, 4.9, hz - .45, 0, -1, 5.6, 1.4, 'GARAGE07', .3, 0, 1.4, amber, 10);
  signLights.push({ x: hx, y: 3.2, z: hz - 2.2, col: lin(amber), r: 10, i: .9 });
}
