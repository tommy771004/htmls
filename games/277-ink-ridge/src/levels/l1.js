// 第一關「試劍崖」：雲海上的手砌石階與奇石、踏石柱、絕壁岩縫、崖道、瓦頂鐘庭、雙滑輪配重吊台、重簷山門與神龕。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PAL, inkMaterial } from '../ink.js';
import { B, rng, rockGeo, cylGeo, hipRoofGeo, gableRoofGeo, withOutline, makePine, makeBellRig, makeTorii, makeWallCoping, makeStele, makeCenser, makeGrassField, makeBamboo, makeCliffVines, makeWaterfall, makeBuilder } from '../kit.js';

export function buildLevel(scene) {
  const b = makeBuilder(scene);
  const { W, rockMat, lanterns, rock, pillar, boulders, drip, slab, edge, edgeX, place, lantern } = b;
  const hints = [];
  const bells = [];
  const smokeSpots = [];
  const waterfalls = [];
  const pulleyWheels = [];

  // 壹 石階：起點台地、八階手鑿錯縫石階（碰撞盒維持原尺寸）、兩側壓邊條石與國畫皴石群
  rock(-5, B, -6, 5, 0, 7);
  const Rst = rng(101);
  for (let k = 0; k < 8; k++) {
    const z0 = -6 - k - 1, z1 = -6 - k, yTop = (k + 1) * 0.375, yBot = Math.max(0, k * 0.375 - 0.18);
    // 物理碰撞維持完整單階盒，確保爬階手感零誤差
    rock(-2.3, 0, z0, 2.3, yTop, z1, { colOnly: true, data: { stair: true } });
    // 視覺拆成 4～5 塊寬窄不一的錯縫青石條，塊間留細微灰縫與自然鑿面起伏
    const nSlabs = k % 2 === 0 ? 4 : 5;
    let curX = -2.26;
    for (let j = 0; j < nSlabs; j++) {
      const rem = 2.26 - curX;
      const w = j === nSlabs - 1 ? rem : (rem / (nSlabs - j)) * (0.82 + Rst() * 0.36);
      const gap = j === nSlabs - 1 ? 0 : 0.035;
      rock(curX, yBot, z0 - 0.03, curX + w - gap, yTop, z1 + 0.02, { noCol: true, jitter: 0.022, seg: 0.45, freq: 1.4 });
      curX += w;
    }
    // 石階兩側護邊石欄基石（在 ±2.3 走道外側，不擋路）
    rock(-2.62, yBot, z0 - 0.05, -2.28, yTop + 0.11, z1 + 0.04, { noCol: true, jitter: 0.03, seg: 0.45 });
    rock(2.28, yBot, z0 - 0.05, 2.62, yTop + 0.11, z1 + 0.04, { noCol: true, jitter: 0.03, seg: 0.45 });
  }
  rock(-5, B, -14, 3, -0.02, -6, { noCol: false });
  rock(2.3, B, -14.5, 6.5, 4.2, -5.5, { jitter: 0.5, freq: 0.6, lumpy: 0.3 });
  rock(4.5, B, -9, 8.5, 6.2, -2, { jitter: 0.6, freq: 0.5, lumpy: 0.4 });
  rock(-7.5, B, -4, -4.6, 1.1, 3, { jitter: 0.5, lumpy: 0.25 });
  rock(-5.5, 0, 4.5, -3.4, 0.9, 6.6, { jitter: 0.35, lumpy: 0.2 });

  // 石階兩側疊石群（穩坐地面或山崖台頂，呼應參考影片開場石階兩側層疊墨石）
  boulders([
    [3.55, 0.42, -4.6, 0.92, 0.62, 0.85, 11],
    [4.25, 0.72, -4.9, 1.15, 0.88, 0.95, 12],
    [3.45, 4.35, -7.8, 0.95, 0.72, 0.92, 13],
    [4.15, 4.55, -11.4, 1.22, 0.92, 1.10, 14],
    [5.35, 6.35, -6.8, 1.35, 0.98, 1.25, 15],
    [-3.45, 0.35, -5.2, 0.78, 0.50, 0.72, 16],
    [-3.85, 0.58, -8.8, 1.05, 0.72, 0.95, 17],
    [-3.25, 2.75, -13.4, 0.82, 0.58, 0.76, 18],
    [3.85, 0.36, 4.8, 0.85, 0.52, 0.75, 19],
  ], true);
  drip(-5, 5, 7, -0.05, 2.2, 1);
  drip(-5, -2.4, -14, -0.05, 2.0, -1);

  // 平台 L1
  rock(-3, B, -20.5, 3, 3, -14);
  edge(-3, 3, 3, -20.5, -1);
  drip(-3, 3, -20.5, 2.92, 2.1, -1);
  lantern(2.2, 3, -16.6, 'check', 0);

  // 貳 踏石：五根石柱（加柱腰岩層凸石與崖底墨流）
  const pil = [[0, -23.6, 3.0], [1.7, -26.9, 3.5], [-0.5, -30.2, 4.0], [1.2, -33.4, 3.6], [0, -36.6, 4.0]];
  for (const [idx, [x, z, t]] of pil.entries()) {
    pillar(x, z, 1.15, t, { jitter: 0.13, seg: 26 });
    // 柱身中下段附生副石筍，豐富剪影但遠低於踏面不影響跳躍
    const ang = idx * 2.1 + 0.6;
    b.rockGeos.push(cylGeo(x + Math.cos(ang) * 0.85, z + Math.sin(ang) * 0.85, 0.52, B, t - 3.2 - (idx % 2) * 1.4, { jitter: 0.16, seg: 14 }));
  }
  // 平台 L2（岩壁腳下）
  rock(-4, B, -44, 10, 4, -38.8);
  edge(-4, 10, 4, -38.8, 1);
  lantern(-3, 4, -40.2, 'check', 0);
  boulders([
    [8.6, 4.55, -42.6, 1.1, 0.75, 0.95, 31],
    [9.3, 4.35, -40.8, 0.72, 0.50, 0.68, 32],
    [-3.4, 4.35, -43.1, 0.78, 0.55, 0.65, 33],
  ], true);

  // 參 岩縫：W1 高壁（x<7.5，頂 16、不可抓），W2 窄道（頂 11、前緣可翻上）
  rock(-12, B, -70, 7.5, 16, -44, { jitter: 0.22, seg: 1.05 });
  rock(7.5, B, -54, 12, 11, -44, { jitter: 0.2, seg: 1.0 });
  const lA = slab(-2, 4, 6.4, -44, 1, { name: 'A' });
  const lB = slab(2.8, 6.6, 8.6, -44, 1, { name: 'B' });
  const lC = slab(8.0, 9.6, 8.6, -44, 1, { name: 'C' });
  const lTop = edge(7.6, 11.9, 11, -44, 1, { name: 'TOP' });
  drip(7.5, 12, -44, 10.95, 2.5);
  drip(-11, 7.4, -44, 15.95, 3.6);
  drip(-9, -3.2, -44, 12.2, 2.8);
  drip(-4, 10, -38.8, 3.92, 2.1, 1);

  // 肆 崖道：W2 → 斷口 2.2 m → W3
  rock(7.5, B, -70, 12, 11, -56.2, { jitter: 0.2, seg: 1.0 });
  edge(7.6, 11.9, 11, -56.2, 1);
  edge(7.6, 11.9, 11, -54, -1);
  edgeX(-44.2, -53.8, 11, 12, 1);
  edgeX(-56.4, -69.8, 11, 12, 1);
  drip(7.5, 12, -56.2, 10.95, 2.6, 1);
  drip(7.5, 12, -54, 10.95, 2.2, -1);
  lantern(10.9, 11, -46.5, 'check', 0);
  // 崖道內壁腳下的碎石壓邊（貼 x=7.55 岩根，不擋 9.8 跑跳線）
  boulders([
    [7.85, 11.28, -48.2, 0.45, 0.35, 0.62, 41],
    [7.82, 11.25, -61.5, 0.48, 0.32, 0.58, 42],
    [7.88, 11.32, -66.8, 0.52, 0.38, 0.66, 43],
  ], false);

  // 伍 鐘庭：庭院 C、左牆（加灰瓦壓簷）、右矮牆（加灰瓦壓簷）、上庭 T（高 6 m）
  rock(-12, B, -90, 12, 11, -70);
  rock(-14, 11, -90, -10, 15.5, -70, { jitter: 0.26 });
  scene.add(makeWallCoping(-13.8, -89.8, -10.1, -70.2, 15.5));
  rock(11.5, 11, -88, 12.2, 11.6, -72, { jitter: 0.04, seg: 0.7 });
  scene.add(makeWallCoping(11.48, -88, 12.22, -72, 11.6));
  rock(-12, B, -113, 12, 17, -90);
  drip(-10, 12, -90, 16.95, 3.1, 1);
  edge(-1.6, 12, 17, -90, 1);
  lantern(9.4, 11, -73.2, 'check', 0);

  // 庭院地面導引墨渠：從鐘亭蜿蜒連向吊台立柱（鐘響後泛起朱金流光，視覺引導吊台啟動）
  let chGlowMat = null;
  {
    const chPts = [
      new THREE.Vector3(0.5, 11.012, -83.5),
      new THREE.Vector3(-0.6, 11.012, -84.6),
      new THREE.Vector3(-2.1, 11.012, -85.4),
      new THREE.Vector3(-3.3, 11.012, -86.6),
      new THREE.Vector3(-4.0, 11.012, -87.3),
    ];
    const chCurve = new THREE.CatmullRomCurve3(chPts);
    const chGeo = new THREE.TubeGeometry(chCurve, 28, 0.095, 5, false);
    chGeo.scale(1, 0.14, 1);
    chGeo.translate(0, 11.012 * (1 - 0.14), 0);
    const ch = new THREE.Mesh(chGeo, inkMaterial({ color: 0x18191e, wash: 0.4 }));
    ch.receiveShadow = true;
    scene.add(ch);
    const glGeo = new THREE.TubeGeometry(chCurve, 28, 0.045, 4, false);
    glGeo.scale(1, 0.16, 1);
    glGeo.translate(0, 11.022 * (1 - 0.16), 0);
    chGlowMat = new THREE.MeshBasicMaterial({ color: 0xd86b38, transparent: true, opacity: 0, depthWrite: false });
    const gl = new THREE.Mesh(glGeo, chGlowMat);
    gl.userData.noBake = true;
    scene.add(gl);
  }

  // 吊台：兩根朱紅高柱（附石柱礎與頂部穿枋斜撐）＋前後雙滑輪橫樑，木台從 11.25 升到 17
  const lift = { x: -4, z: -88.7, y: 11.25, y0: 11.25, y1: 17.0, state: 'down', t: 0 };
  const liftCol = W.addBox(-5.3, lift.y - 0.22, -90.0, -2.7, lift.y, -87.4, { lift: true });
  const liftG = new THREE.Group(); liftG.userData.noBake = true; scene.add(liftG);
  {
    const wood = inkMaterial({ color: PAL.wood, streak: 0.65, wash: 0.8, crack: 0.35 });
    const darkWood = inkMaterial({ color: PAL.woodDark, streak: 0.5, wash: 0.7 });
    const iron = inkMaterial({ color: 0x222328, wash: 0.5 });
    // 六塊厚木板拼成吊台面＋底部雙橫樑＋四角鐵包角與吊環
    for (let i = 0; i < 6; i++) {
      const px = -1.08 + i * 0.432;
      const plk = new THREE.Mesh(new THREE.BoxGeometry(0.405, 0.14, 2.58), wood);
      plk.position.set(px, -0.07, 0); plk.castShadow = plk.receiveShadow = true;
      liftG.add(plk, withOutline(plk, 0.014));
    }
    for (const z of [-0.95, 0.95]) {
      const batten = new THREE.Mesh(new THREE.BoxGeometry(2.64, 0.11, 0.20), darkWood);
      batten.position.set(0, -0.18, z); batten.castShadow = true;
      liftG.add(batten, withOutline(batten, 0.014));
    }
    const ropeM = new THREE.MeshBasicMaterial({ color: 0x18181c });
    for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
      const corner = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.18), iron);
      corner.position.set(x, -0.10, z); liftG.add(corner);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 5, 10), iron);
      ring.position.set(x, 0.04, z); liftG.add(ring);
      const a = new THREE.Vector3(x, 0.04, z), b2 = new THREE.Vector3(0, 2.4, 0);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, a.distanceTo(b2), 5), ropeM);
      r.position.copy(a).add(b2).multiplyScalar(0.5);
      r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b2.clone().sub(a).normalize());
      liftG.add(r);
    }
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.042, 7, 14), iron); hook.position.y = 2.4; liftG.add(hook);
    const shackle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.14, 8), iron); shackle.position.y = 2.24; liftG.add(shackle);

    // 吊台高架立柱與雙滑輪懸臂
    const red = inkMaterial({ color: PAL.vermilion, streak: 0.45, wash: 0.72 });
    const blk = inkMaterial({ color: 0x1e1e22, wash: 0.55 });
    const plinthM = inkMaterial({ color: 0x918c80, crack: 0.45 });
    for (const dx of [-1.85, 1.85]) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.28, 0.54), plinthM);
      base.position.set(lift.x + dx, 11.14, lift.z + 1.5); base.castShadow = true;
      scene.add(base, withOutline(base, 0.018));
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 13, 0.3), red);
      p.position.set(lift.x + dx, 11 + 6.5, lift.z + 1.5); p.castShadow = true;
      scene.add(p, withOutline(p, 0.02));
      // 頂部斜撐雀替
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.2), red);
      br.position.set(lift.x + dx - Math.sign(dx) * 0.34, 23.65, lift.z + 1.5);
      br.rotation.z = Math.sign(dx) * 0.58; scene.add(br, withOutline(br, 0.015));
      W.addBox(lift.x + dx - 0.15, 11, lift.z + 1.35, lift.x + dx + 0.15, 24, lift.z + 1.65);
    }
    const tie = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.22, 0.24), red);
    tie.position.set(lift.x, 22.8, lift.z + 1.5); scene.add(tie, withOutline(tie, 0.018));
    const beam = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.38, 0.44), blk);
    beam.position.set(lift.x, 24.1, lift.z + 1.5); beam.castShadow = true;
    scene.add(beam, withOutline(beam, 0.022));
    // 前後貫穿懸臂樑，分別掛載吊台滑輪（z=lift.z）與配重滑輪（z=lift.z+3.0）
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 3.6), blk);
    arm.position.set(lift.x, 23.82, lift.z + 1.5); arm.castShadow = true;
    scene.add(arm, withOutline(arm, 0.02));
    for (const pz of [lift.z, lift.z + 3.0]) {
      const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.36, 0.18), iron);
      hanger.position.set(lift.x, 23.62, pz); scene.add(hanger);
      const wG = new THREE.Group();
      wG.position.set(lift.x, 23.48, pz); wG.userData.noBake = true; scene.add(wG);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.14, 18), darkWood);
      wheel.rotation.z = Math.PI / 2;
      wG.add(wheel, withOutline(wheel, 0.018));
      for (let sp = 0; sp < 4; sp++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.58, 0.045), iron);
        bar.rotation.x = (sp / 4) * Math.PI; wG.add(bar);
      }
      pulleyWheels.push(wG);
      const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.28, 8), iron);
      axle.rotation.z = Math.PI / 2; axle.position.set(lift.x, 23.48, pz); scene.add(axle);
    }
    const topRope = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 3.0, 5), ropeM);
    topRope.rotation.x = Math.PI / 2; topRope.position.set(lift.x, 23.78, lift.z + 1.5); scene.add(topRope);

    lift.rope = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1, 5), ropeM); lift.rope.userData.noBake = true; scene.add(lift.rope);
    // 配重石：雕鑿束鐵箍石錘，另一側跟著反方向動
    const wGroup = new THREE.Group(); wGroup.userData.noBake = true; scene.add(wGroup);
    const wStone = new THREE.Mesh(rockGeo(-0.45, -0.55, -0.45, 0.45, 0.55, 0.45, { jitter: 0.035, seg: 0.35 }), inkMaterial({ color: 0x8a857b, streak: 0.5, crack: 0.6 }));
    wStone.castShadow = true;
    wGroup.add(wStone, withOutline(wStone, 0.02));
    for (const y of [-0.28, 0.28]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.08, 0.94), iron); strap.position.y = y; wGroup.add(strap);
    }
    const vStrap = new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.14, 0.95), iron); wGroup.add(vStrap);
    const wRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.03, 6, 12), iron); wRing.position.y = 0.60; wGroup.add(wRing);
    lift.weight = wGroup;
    lift.wrope = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1, 5), ropeM); lift.wrope.userData.noBake = true; scene.add(lift.wrope);
  }
  liftG.position.set(lift.x, lift.y, lift.z);
  const weightCol = W.addBox(lift.x - 0.45, 17.3 - 0.55, lift.z + 2.55, lift.x + 0.45, 17.3 + 0.55, lift.z + 3.45);

  const bell1 = makeBellRig(); place(bell1.group, 0.5, 11, -83.5);
  W.addBox(-0.66, 11, -83.62, -0.44, 13.75, -83.38); W.addBox(1.44, 11, -83.62, 1.66, 13.75, -83.38);
  W.addCyl(0.5, -83.5, 0.42, 12.45, 13.6, { noGround: true });
  bells.push({ ...bell1, pos: new THREE.Vector3(0.5, 11, -83.5), y0: 11.5, y1: 13.6, ang: 0, vel: 0, id: 'lift', rung: 0 });

  // 陸 山門：上庭鳥居、瓦簷門牆、重簷飛脊城門樓、銅釘鋪首雙扇木門、第二口鐘、終點石燈籠與精雕神龕
  place(makeTorii(5.2, 4.4), 2.5, 17, -96.5);
  W.addCyl(-0.1, -96.5, 0.24, 17, 21.4); W.addCyl(5.1, -96.5, 0.24, 17, 21.4);
  rock(-12, 17, -102, 0.5, 23, -100, { jitter: 0.12, seg: 1.0 });
  rock(4.5, 17, -102, 14, 23, -100, { jitter: 0.12, seg: 1.0 });
  scene.add(makeWallCoping(-12, -102, 0.5, -100, 23));
  scene.add(makeWallCoping(4.5, -102, 14, -100, 23));
  drip(-12, 0.5, -100, 22.9, 2.8, 1); drip(4.5, 12, -100, 22.9, 2.8, 1);

  {
    const gateWood = inkMaterial({ color: 0x3b2f26, streak: 0.5, wash: 0.7 });
    const gateTile = inkMaterial({ color: 0x222328, wash: 0.7, streak: 0.3 });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.52, 2.2), gateWood);
    lintel.position.set(2.5, 21.56, -101); lintel.castShadow = true; scene.add(lintel, withOutline(lintel, 0.02));
    // 門楣五朵斗拱與椽木
    for (let x = 0.6; x <= 4.41; x += 0.95) {
      const dg = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 2.45), gateWood);
      dg.position.set(x, 21.92, -101); dg.castShadow = true; scene.add(dg, withOutline(dg, 0.015));
    }
    const roofG = new THREE.Mesh(gableRoofGeo(6.9, 3.45, 0.68, 0.11, 0.24, 14, 10), gateTile);
    roofG.position.set(2.5, 22.12, -101); roofG.castShadow = true; scene.add(roofG, withOutline(roofG, 0.025));
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.16, 0.18), gateTile);
    ridge.position.set(2.5, 22.84, -101); scene.add(ridge, withOutline(ridge, 0.016));
    for (const sx of [-0.95, 5.95]) {
      const owl = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.32, 0.24), gateTile);
      owl.position.set(sx, 23.02, -101); scene.add(owl, withOutline(owl, 0.015));
    }
  }
  W.addBox(0.5, 21.3, -102, 4.5, 23, -100);

  const doorMat = inkMaterial({ color: 0x82705a, streak: 0.85, wash: 0.8, crack: 0.3 });
  const ironBand = inkMaterial({ color: 0x262422, wash: 0.5 });
  const brass = inkMaterial({ color: 0xb6914e, wash: 0.5 });
  const doors = [];
  for (const [hx, dir] of [[0.5, 1], [4.5, -1]]) {
    const hinge = new THREE.Group(); hinge.position.set(hx, 17, -100.5); hinge.userData.noBake = true; scene.add(hinge);
    const d = new THREE.Mesh(new THREE.BoxGeometry(2.0, 4.25, 0.2), doorMat); d.position.set(dir * 1.0, 2.125, 0); d.castShadow = true;
    hinge.add(d, withOutline(d, 0.02));
    // 門板豎縫壓條、三道鐵橫帶、門釘排與鋪首銅環
    for (const px of [0.5, 1.0, 1.5]) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.025, 4.2, 0.215), ironBand);
      seam.position.set(dir * px, 2.125, 0); hinge.add(seam);
    }
    for (const y of [0.62, 2.12, 3.55]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.14, 0.235), ironBand);
      band.position.set(dir * 1.0, y, 0); hinge.add(band);
      for (const sx of [0.32, 0.78, 1.24, 1.70]) {
        const stud = new THREE.Mesh(new THREE.SphereGeometry(0.036, 7, 6), brass);
        stud.position.set(dir * sx, y, 0.12); hinge.add(stud);
      }
    }
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 10), brass);
    boss.rotation.x = Math.PI / 2; boss.position.set(dir * 1.68, 1.78, 0.11); hinge.add(boss);
    const knocker = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 12), brass);
    knocker.position.set(dir * 1.68, 1.68, 0.13); hinge.add(knocker);
    doors.push({ hinge, dir });
  }
  const gate = { open: 0, target: 0, col: W.addBox(0.5, 17, -100.8, 4.5, 21.3, -100.2), leaves: [W.addBox(0.42, 17, -102.6, 0.64, 21.3, -100.4, { on: false }), W.addBox(4.36, 17, -102.6, 4.58, 21.3, -100.4, { on: false })] };

  const bell2 = makeBellRig(); place(bell2.group, 8.0, 17, -96.4);
  W.addBox(6.84, 17, -96.52, 7.06, 19.75, -96.28); W.addBox(8.94, 17, -96.52, 9.16, 19.75, -96.28);
  W.addCyl(8.0, -96.4, 0.42, 18.45, 19.6, { noGround: true });
  bells.push({ ...bell2, pos: new THREE.Vector3(8.0, 17, -96.4), y0: 17.5, y1: 19.6, ang: 0, vel: 0, id: 'gate', rung: 0 });
  lantern(-6.6, 17, -92.2, 'check', 0);

  // 門後：奇石夾道、終點石燈籠與飛簷古神龕
  rock(-12, 17, -113, -1.5, 22, -102, { jitter: 0.4, lumpy: 0.2 });
  rock(6.5, 17, -113, 14, 22, -102, { jitter: 0.4, lumpy: 0.2 });
  boulders([
    [-1.1, 17.55, -105.5, 0.75, 0.58, 0.72, 61],
    [6.1, 17.62, -106.2, 0.82, 0.64, 0.78, 62],
    [-0.9, 17.48, -110.2, 0.68, 0.50, 0.65, 63],
    [5.9, 17.52, -110.5, 0.74, 0.56, 0.70, 64],
  ], true);
  const fin = lantern(2.5, 17, -108.4, 'finish', 0);
  {
    const hok = new THREE.Group();
    const wood = inkMaterial({ color: PAL.woodDark, streak: 0.55, wash: 0.7 });
    const stone = inkMaterial({ color: 0x9d988b, crack: 0.5, wash: 0.7 });
    const tile = inkMaterial({ color: 0x202126, wash: 0.65 });
    const red = inkMaterial({ color: PAL.vermilion, wash: 0.6 });
    const addH = (geo, mat, x, y, z, ol = 0.018) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
      hok.add(m); if (ol) hok.add(withOutline(m, ol)); return m;
    };
    addH(new THREE.BoxGeometry(2.1, 0.28, 1.7), stone, 0, 0.14, 0);
    addH(new THREE.BoxGeometry(1.75, 0.42, 1.38), stone, 0, 0.49, 0);
    addH(new THREE.BoxGeometry(0.95, 0.16, 0.28), stone, 0, 0.08, 0.94, 0.012);
    addH(new THREE.BoxGeometry(0.88, 0.16, 0.24), stone, 0, 0.24, 0.80, 0.012);
    addH(new THREE.BoxGeometry(1.36, 1.18, 1.02), wood, 0, 1.29, 0);
    for (const sx of [-0.66, 0.66]) for (const sz of [-0.49, 0.49]) addH(new THREE.BoxGeometry(0.11, 1.22, 0.11), red, sx, 1.30, sz, 0.01);
    // 神龕格扇門與銅鏡
    addH(new THREE.BoxGeometry(0.68, 0.86, 0.06), inkMaterial({ color: 0x2a231d }), 0, 1.22, 0.51, 0.012);
    const mir = addH(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 12), brass, 0, 1.32, 0.54, 0.01);
    mir.rotation.x = Math.PI / 2;
    addH(new THREE.BoxGeometry(1.62, 0.14, 1.26), wood, 0, 1.92, 0, 0.014);
    addH(hipRoofGeo(2.38, 1.98, 0.62, 0.20, 0.09, 10), tile, 0, 2.02, 0, 0.022);
    addH(new THREE.SphereGeometry(0.10, 8, 6), brass, 0, 2.70, 0, 0.012);
    place(hok, 2.5, 17, -111.4);
    W.addBox(1.6, 17, -112.1, 3.4, 19.5, -110.7);
  }

  // ---------- 遠景：雲海裡的石柱林 ----------
  const R = rng(277);
  const farGeos = [];
  const farPines = [];
  for (let i = 0; i < 46; i++) {
    const a = R() * Math.PI * 2, d = 70 + R() * 260;
    const x = Math.cos(a) * d, z = -55 + Math.sin(a) * d;
    if (x > -26 && x < 30 && z > -125 && z < 20) continue;
    const r = 3 + R() * 9, top = -12 + R() * 42;
    farGeos.push(cylGeo(x, z, r, B - 20, top, { jitter: r * 0.25, seg: 11 }));
    if (R() < 0.55) farPines.push([x + (R() - 0.5) * r, top, z + (R() - 0.5) * r, 1.5 + R() * 2]);
  }
  // 近景下方的石柱（墜落與俯瞰時看得到，含左側飛瀑懸崖石柱）
  for (const [x, z, r, t] of [[-14, -30, 4, -6], [-14.2, -32.8, 3.8, 12.6], [16, -24, 3.2, -2], [-18, -58, 5, 4], [22, -60, 4.2, -9], [16.8, -94.8, 4.2, 9.2], [-22, -96, 4, 2]]) farGeos.push(cylGeo(x, z, r, B, t, { jitter: 0.8, seg: 16 }));
  const farMesh = new THREE.Mesh(mergeGeometries(farGeos), rockMat);
  farMesh.userData.noBake = true;
  farMesh.receiveShadow = false;
  scene.add(farMesh);

  const rockMesh = b.finishRocks();

  // 松樹（近景精細迎客松＋崖壁探出懸松，遠景輕量松影）
  const pines = [
    [-4.4, 0, 5.6, 1.1], [-6.2, 1.1, -1, 1.5], [-2.6, 3, -19.4, 0.95], [5.8, 6.2, -5, 1.25],
    [-8, 16, -46, 1.6], [3, 16, -47, 1.3], [-6, 16, -60, 1.8], [-12, 15.5, -76, 1.4],
    [10.6, 11, -86, 1.0], [-9, 17, -95, 1.3], [11, 17, -98.6, 1.2], [-4, 22, -104, 1.6],
    [9, 22, -106, 1.4], [-14, -6, -30, 1.45],
  ];
  for (const [i, [x, y, z, s]] of pines.entries()) {
    place(makePine(31 + i * 7, s, 0, false), x, y, z, i);
    if (y >= 0 && y <= 17) W.addCyl(x, z, 0.16 * s, y, y + 3 * s);
  }
  // 絕壁側生古松（從岩壁斜探入雲海，純視覺地標）
  for (const [i, [x, y, z, s, rx, rz, ry]] of [
    [-3.1, 1.8, -17.2, 0.85, 0.15, 0.48, 1.2],
    [12.0, 8.2, -49.5, 0.95, 0.1, -0.52, -0.6],
    [-11.8, 12.5, -52.0, 1.1, 0.12, 0.55, 0.8],
  ].entries()) {
    const cp = makePine(520 + i * 11, s, 0, false);
    cp.position.set(x, y, z); cp.rotation.set(rx, ry, rz); scene.add(cp);
  }
  for (const [i, [x, y, z, s]] of farPines.entries()) place(makePine(900 + i, s, 0, true), x, y, z, i);

  // 鳥居（入口地標）＋古道殘碑、三足石香爐、風動山竹、墨草叢、懸崖垂藤與遠山飛瀑
  place(makeTorii(4.2, 3.8), 0, 3, -18.6);
  W.addCyl(-2.1, -18.6, 0.24, 3, 6.8); W.addCyl(2.1, -18.6, 0.24, 3, 6.8);

  // 古石碑（起點台地右側與鐘庭一隅，遠離跑跳路線）
  place(makeStele(11, 1.68), 3.4, 0, 1.8, -0.28);
  W.addCyl(3.4, 1.8, 0.35, 0, 1.9);
  place(makeStele(29, 1.52), -8.6, 11, -73.8, 0.35);
  W.addCyl(-8.6, -73.8, 0.35, 11, 12.8);

  // 三足石香爐（鳥居側、鐘庭、神龕前，持續飄出裊裊青煙）
  for (const [cx, cy, cz] of [[-2.35, 3, -16.8], [3.2, 11, -83.2], [0.6, 17, -109.6]]) {
    place(makeCenser(0), cx, cy, cz);
    W.addCyl(cx, cz, 0.32, cy, cy + 0.85);
    smokeSpots.push([cx, cy + 0.86, cz]);
  }

  // 風動山竹叢（山徑起點、石階鳥居旁、鐘庭圍牆邊、山門神龕兩側）
  for (const [sd, x, y, z, n, h] of [
    [701, -4.2, 0, 2.2, 6, 4.2], [702, 4.1, 0, -2.2, 5, 3.8],
    [703, 2.7, 3, -15.2, 5, 3.6], [704, -9.4, 11, -82.5, 7, 4.6],
    [705, 10.6, 11, -78.5, 6, 4.2], [706, -3.2, 17, -104.2, 6, 4.3],
    [707, 7.6, 17, -104.6, 6, 4.4],
  ]) place(makeBamboo(sd, n, h, 0), x, y, z);

  // 風動水墨芒草叢（沿石階護欄外、崖邊石縫、庭院牆根點綴，單一合併網格）
  scene.add(makeGrassField([
    [-3.2, 0, 4.2, 1.1, 10], [3.1, 0, 2.4, 1.0, 9], [-2.85, 0, -4.6, 1.1, 10], [2.85, 0, -4.4, 1.0, 9],
    [-2.75, 1.1, -8.5, 0.95, 8], [-2.7, 2.3, -12.2, 0.95, 8], [-2.5, 3, -15.8, 1.0, 9], [2.4, 3, -17.4, 0.9, 8],
    [-3.4, 4, -42.2, 1.15, 11], [8.2, 4, -41.8, 1.1, 10], [7.9, 11, -47.5, 0.9, 8], [7.9, 11, -60.8, 0.95, 9],
    [-9.6, 11, -74.5, 1.2, 12], [10.8, 11, -74.2, 1.1, 10], [10.8, 11, -84.5, 1.1, 10], [-8.8, 11, -88.2, 1.15, 11],
    [-7.4, 17, -93.2, 1.1, 10], [9.8, 17, -95.2, 1.1, 10], [-1.2, 17, -106.5, 1.0, 9], [6.2, 17, -106.8, 1.0, 9],
  ], 0));

  // 懸崖垂藤（沿斷崖唇口與高牆上緣垂掛搖曳）
  scene.add(
    makeCliffVines(-2.8, 2.8, 2.95, -20.5, -1, 7, 2.2),
    makeCliffVines(-10.5, 6.8, 15.9, -44.0, 1, 12, 3.4),
    makeCliffVines(7.6, 11.8, 10.95, -56.2, 1, 6, 2.4),
    makeCliffVines(-9.5, 11.5, 16.9, -90.0, 1, 12, 2.8),
    makeCliffVines(-11.5, 0.2, 22.9, -100.0, 1, 8, 2.5),
    makeCliffVines(4.8, 11.8, 22.9, -100.0, 1, 6, 2.5),
  );

  // 遠山雲崖飛瀑（左側踏石峽谷與右側上庭遠崖各懸一道白練飛瀑，落入雲海）
  const wf1 = makeWaterfall(-12.5, 12.4, -16, -31.8, 2.6, 0.52);
  const wf2 = makeWaterfall(14.8, 9.0, -18, -93.8, 2.9, -0.62);
  scene.add(wf1, wf2);
  waterfalls.push(wf1, wf2);

  b.fogPuffs({ at: (Rr) => [-34 + Rr() * 70, -14 + Rr() * 12, 12 - Rr() * 130] });

  // ---------- 提示與區段 ----------
  const section = (p) => p.y > 16.5 ? '陸 · 山門' : p.z < -70 ? '伍 · 鐘庭' : p.y > 10.4 ? '肆 · 崖道' : p.z < -38.8 ? '參 · 岩縫' : p.z < -20.5 ? '貳 · 踏石' : '壹 · 石階';
  hints.push(
    { id: 'move', when: (p) => p.z > -6, k: 'WASD 移動，點畫面後用滑鼠轉鏡頭', t: '左下搖桿移動，右半邊拖曳轉鏡頭' },
    { id: 'jump', when: (p) => p.z < -18 && p.z > -22 && p.y > 2.5, k: '空白鍵跳上石柱', t: '按「躍」跳上石柱' },
    { id: 'grab', when: (p, s) => p.z < -41.2 && p.y < 5 && s !== 'hang', k: '助跑跳起，抓住岩縫', t: '跑向岩壁按「躍」，抓住岩縫' },
    { id: 'shimmy', when: (p, s, L) => s === 'hang' && L === lA && p.x < 2.4, k: 'A／D 橫移　S 放手　S＋空白 往後躍', t: '搖桿左右橫移，往下放手' },
    { id: 'hop', when: (p, s, L) => s === 'hang' && L === lA && p.x >= 2.4, k: 'W 往上攀到上一道岩縫', t: '搖桿往上，攀到上一道岩縫' },
    { id: 'side', when: (p, s, L) => s === 'hang' && L === lB && p.x > 5.4, k: 'D＋空白，側跳到右邊的岩縫', t: '搖桿往右＋「躍」，側跳過去' },
    { id: 'climb', when: (p, s, L) => s === 'hang' && (L === lC || L === lTop), k: 'W 上攀，翻上崖頂', t: '搖桿往上，翻上崖頂' },
    { id: 'gap', when: (p) => p.y > 10.5 && p.z < -50 && p.z > -54.2 && p.x > 7, k: '斷崖：助跑跳過去', t: '斷崖：助跑按「躍」跳過去' },
    { id: 'bell', when: (p) => p.z < -78 && p.z > -88 && p.y < 12 && !bells[0].rung, k: 'J 或左鍵出手，敲鐘', t: '靠近鐘按「擊」' },
    { id: 'ride', sticky: true, when: (p) => bells[0].rung && lift.state !== 'top' && p.y < 12 && p.z < -78, k: '鐘聲一響吊台就升，快站上木台', t: '鐘聲一響吊台就升，快站上木台' },
    { id: 'gate', when: (p) => p.y > 16.5 && gate.target === 0 && p.z < -92, k: '敲響山門旁的鐘', t: '敲響山門旁的鐘' },
  );

  // ---------- 機關更新 ----------
  const ring = (b2, power = 1) => { b2.vel += 2.6 * power; b2.rung++; };
  let smokeClock = 0;
  function update(dt, t, pp) {
    for (const wf of waterfalls) wf.material.uniforms.uTime.value = t;
    smokeClock += dt;
    if (smokeClock > 0.22 && api.vfx) {
      smokeClock = 0;
      const sp = smokeSpots[Math.floor((t * 7) % smokeSpots.length)];
      if (sp) api.vfx.ambientIncense(sp[0], sp[1], sp[2]);
    }
    for (const b2 of bells) {
      b2.vel += (-b2.ang * 26 - b2.vel * 1.1) * dt;
      b2.ang += b2.vel * dt;
      b2.pivot.rotation.x = b2.ang * 0.35;
    }
    // 吊台：鐘響 2.0 s 後上升（1.25 m/s），頂端停 9 s 再下降
    let ny = lift.y;
    if (lift.state === 'wait') { lift.t -= dt; if (lift.t <= 0) lift.state = 'up'; }
    else if (lift.state === 'up') { ny = Math.min(lift.y1, lift.y + 1.25 * dt); if (ny >= lift.y1) { lift.state = 'top'; lift.t = 9; } }
    else if (lift.state === 'top') { lift.t -= dt; if (lift.t <= 0) lift.state = 'downmove'; }
    else if (lift.state === 'downmove') {
      ny = Math.max(lift.y0, lift.y - 1.6 * dt);
      if (pp && pp.x > -5.3 - 0.34 && pp.x < -2.7 + 0.34 && pp.z > -90 - 0.34 && pp.z < -87.4 + 0.34 && pp.y < lift.y - 0.3 && pp.y + 1.8 > ny - 0.22) ny = lift.y;
      if (ny <= lift.y0) lift.state = 'down';
    }
    const liftDy = ny - lift.y;
    W.moveBox(liftCol, 0, liftDy, 0);
    lift.y = ny;
    liftG.position.y = lift.y;
    for (const wG of pulleyWheels) wG.rotation.x += liftDy * 3.1;
    if (chGlowMat) {
      const wantGlow = lift.state !== 'down' ? 0.65 + Math.sin(t * 5.5) * 0.2 : 0;
      chGlowMat.opacity += (wantGlow - chGlowMat.opacity) * Math.min(1, dt * 6);
    }
    const hookY = lift.y + 2.4, topY = 23.48;
    lift.rope.scale.y = topY - hookY; lift.rope.position.set(lift.x, (topY + hookY) / 2, lift.z);
    const wy = 11.55 + (lift.y1 - lift.y);
    lift.weight.position.set(lift.x, wy, lift.z + 3.0);
    W.moveBox(weightCol, 0, (wy - 0.55) - weightCol.min.y, 0);
    lift.wrope.scale.y = topY - (wy + 0.58); lift.wrope.position.set(lift.x, (topY + wy + 0.58) / 2, lift.z + 3.0);
    // 山門
    const prevOpen = gate.open;
    gate.open += (gate.target - gate.open) * Math.min(1, dt * 1.3);
    if (gate.open - prevOpen > 0.004 && api.vfx && Math.random() < 0.45) {
      api.vfx.footstep(1.4 + Math.random() * 2.2, 17, -100.5, false);
    }
    for (const d of doors) d.hinge.rotation.y = d.dir * gate.open * (Math.PI / 2);
    gate.col.on = gate.open < 0.9;
    for (const l of gate.leaves) l.on = gate.open > 0.5;
  }

  function strike(pos, fwd) {
    for (const b2 of bells) {
      const dx = b2.pos.x - pos.x, dz = b2.pos.z - pos.z, d = Math.hypot(dx, dz);
      if (d > 2.2 || pos.y + 0.8 > b2.y1 || pos.y + 2.2 < b2.y0) continue;
      if ((dx * fwd.x + dz * fwd.z) / Math.max(d, 0.01) < 0.15 && d > 0.9) continue;
      ring(b2);
      api.vfx?.bellWave(b2.pos.x, b2.pos.y, b2.pos.z);
      if (b2.id === 'lift' && (lift.state === 'down' || lift.state === 'downmove')) { lift.state = 'wait'; lift.t = 2.0; }
      if (b2.id === 'lift' && lift.state === 'top') lift.t = 9;
      if (b2.id === 'gate') gate.target = 1;
      return b2;
    }
    return null;
  }

  function reset() {
    for (const b2 of bells) { b2.ang = b2.vel = 0; b2.rung = 0; }
    gate.open = gate.target = 0; gate.col.on = true; for (const l of gate.leaves) l.on = false;
    W.moveBox(liftCol, 0, lift.y0 - lift.y, 0); lift.y = lift.y0; lift.state = 'down'; lift.t = 0;
    update(0, 0);
  }

  b.bake();

  const camBlockers = [rockMesh];

  const api = {
    world: W, update, strike, reset, lanterns, hints, section, bells, lift, gate, camBlockers, finish: fin,
    start: { pos: new THREE.Vector3(0, 0, 3.5), yaw: Math.PI },
    kill: (p, cp) => p.y < cp.pos.y - 14,
    debug: () => ({ lift: { state: lift.state, y: lift.y }, gate: gate.open, bells: bells.map((x) => x.rung) }),
    ledges: { A: lA, B: lB, C: lC, TOP: lTop },
    vfx: null,
  };
  return api;
}
