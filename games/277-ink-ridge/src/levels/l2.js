// 第二關「寒潭渡」：雪徑奇石 → 繩紮木筏渡濃墨寒潭（跳過橫木）→ 瓦簷石庭推石壓板開鐵閘 → 冰瀑裂縫 → 五層飛簷雪塔。
// 水是死線（y<−1），掉下去回到最後點亮的石燈籠。本關沒有敵人。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PAL, inkMaterial } from '../ink.js';
import { B, rng, rockGeo, cylGeo, hipRoofGeo, withOutline, makePine, makeTorii, makeWallCoping, makeStele, makeCenser, makeGrassField, makeBamboo, makeCliffVines, makeBuilder } from '../kit.js';
import { makeWater } from '../sky.js';

const WATER = -1.2, T1 = 3.8, TOP = 12.8, WALLZ = -97;
const FOG = 0xcfd0cc;

// 五層飛簷雪塔（須彌座石壇＋十二柱木構塔身＋斗拱平座欄杆＋反宇翹角積雪瓦簷＋九輪相輪塔剎）
function makePagoda() {
  const g = new THREE.Group();
  const wood = inkMaterial({ color: 0x5c392c, streak: 0.55, wash: 0.8, crack: 0.25 });
  const roof = inkMaterial({ color: 0x26282e, wash: 0.6, streak: 0.3, snow: 1 });
  const stone = inkMaterial({ color: 0x989892, crack: 0.5, wash: 0.75, snow: 1 });
  const dark = inkMaterial({ color: 0x221d1b, wash: 0.55 });
  const bronze = inkMaterial({ color: 0x34312b, wash: 0.7 });
  const add = (m, ol = 0.018) => { m.castShadow = m.receiveShadow = true; g.add(m); if (ol) g.add(withOutline(m, ol)); return m; };

  // 雙層須彌座石基壇＋正面踏跺石階
  const base1 = add(new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.46, 6.4), stone), 0.02); base1.position.y = 0.23;
  const base2 = add(new THREE.Mesh(new THREE.BoxGeometry(5.76, 0.44, 5.76), stone), 0.018); base2.position.y = 0.68;
  for (let s = 0; s < 3; s++) {
    const st = add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.30), stone), 0.012);
    st.position.set(0, 0.12 + s * 0.26, 3.22 - s * 0.22);
  }

  let y = 0.9, w = 4.15;
  for (let k = 0; k < 5; k++) {
    const h = 2.05 - k * 0.13;
    // 二層以上外挑平座木欄杆
    if (k > 0) {
      const deck = add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.52, 0.10, w + 0.52), dark), 0.012);
      deck.position.y = y + 0.05;
      for (const ry of [0, Math.PI / 2]) {
        for (const sgn of [-1, 1]) {
          const topR = new THREE.Mesh(new THREE.BoxGeometry(w + 0.54, 0.055, 0.055), dark);
          topR.position.set(ry ? sgn * (w / 2 + 0.24) : 0, y + 0.34, ry ? 0 : sgn * (w / 2 + 0.24));
          topR.rotation.y = ry; g.add(topR);
        }
      }
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.08), dark);
        post.position.set(sx * (w / 2 + 0.24), y + 0.22, sz * (w / 2 + 0.24)); g.add(post);
      }
    }

    // 內縮木牆身＋四角倚柱與每面雙間柱
    const coreW = w * 0.92;
    const body = add(new THREE.Mesh(new THREE.BoxGeometry(coreW, h, coreW), wood), 0.018);
    body.position.y = y + h / 2;
    for (const sgn of [-1, 1]) {
      for (const t of [-0.46, -0.16, 0.16, 0.46]) {
        const cx = new THREE.Mesh(new THREE.BoxGeometry(0.13, h, 0.13), dark);
        cx.position.set(t * w, y + h / 2, sgn * (coreW / 2 + 0.02)); g.add(cx);
        const cz = new THREE.Mesh(new THREE.BoxGeometry(0.13, h, 0.13), dark);
        cz.position.set(sgn * (coreW / 2 + 0.02), y + h / 2, t * w); g.add(cz);
      }
    }

    // 四面隔扇門窗（直欞窗條）
    for (const yaw of [0, Math.PI / 2]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(yaw ? coreW + 0.07 : w * 0.30, h * 0.56, yaw ? w * 0.30 : coreW + 0.07), dark);
      win.position.y = y + h * 0.48; g.add(win);
      const lint = new THREE.Mesh(new THREE.BoxGeometry(yaw ? coreW + 0.09 : w * 0.94, 0.11, yaw ? w * 0.94 : coreW + 0.09), dark);
      lint.position.y = y + h - 0.14; g.add(lint);
    }

    // 柱頭斗拱群（每面五朵挑出承托飛簷）
    for (let i = -2; i <= 2; i++) {
      const off = i * (w * 0.21);
      const bx = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, coreW + 0.44), dark);
      bx.position.set(off, y + h - 0.04, 0); g.add(bx);
      const bz = new THREE.Mesh(new THREE.BoxGeometry(coreW + 0.44, 0.16, 0.22), dark);
      bz.position.set(0, y + h - 0.04, off); g.add(bz);
    }

    y += h;
    // 四坡反宇飛簷翹角積雪屋頂＋四角懸掛青銅風鐸
    const rw = w * 1.56;
    const r = add(new THREE.Mesh(hipRoofGeo(rw, rw, 0.64 - k * 0.03, 0.22 - k * 0.02, 0.085, 14), roof), 0.022);
    r.position.y = y + 0.05;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.048, 0.11, 6), bronze);
      bell.position.set(sx * (rw * 0.46), y + 0.12 - k * 0.01, sz * (rw * 0.46));
      g.add(bell);
    }
    y += 0.50;
    w *= 0.83;
  }

  // 塔剎：露盤＋伏鉢＋九輪相輪＋朱紅寶珠＋剎竿
  const basin = add(new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.16, 0.76), dark), 0.014); basin.position.y = y + 0.16;
  const bowl = add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.18, 10), bronze), 0.012); bowl.position.y = y + 0.32;
  const spire = add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.09, 2.35, 8), bronze), 0.014); spire.position.y = y + 1.45;
  for (let i = 0; i < 7; i++) {
    const rr = 0.22 - i * 0.018;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.024, 5, 12), bronze);
    ring.rotation.x = Math.PI / 2; ring.position.y = y + 0.54 + i * 0.19; g.add(ring);
  }
  const orb = add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), inkMaterial({ color: PAL.vermilion, wash: 0.6 })), 0.014);
  orb.position.y = y + 2.02;
  return g;
}

export function buildLevel(scene) {
  const b = makeBuilder(scene, { color: 0x83878d, streak: 0.68, drip: 0.82, crack: 0.52, wash: 0.8, topLight: 0.55, snow: 1 }, 1);
  const { W, rockMat, lanterns, rock, boulders, drip, slab, edge, place, lantern } = b;
  const hints = [];
  const smokeSpots = [];
  const iceMat = inkMaterial({ color: 0xb6ced8, wash: 0.55, grain: 0.45, crack: 0.22 });
  const woodMat = inkMaterial({ color: PAL.wood, streak: 0.68, wash: 0.8, crack: 0.35, snow: 0.82 });
  const darkMat = inkMaterial({ color: PAL.woodDark, streak: 0.45, wash: 0.8, snow: 0.75 });
  const ropeMat = inkMaterial({ color: 0x2c2620, wash: 0.6 });

  scene.add(makeWater(WATER, new THREE.Color(FOG).toArray()));

  // 冰柱：一排倒掛的晶錐
  const R0 = rng(2771);
  const icicles = (x0, x1, y, z, h = 0.7, step = 0.30, into = scene) => {
    for (let x = x0 + step / 2; x < x1; x += step * (0.68 + R0() * 0.62)) {
      const l = h * (0.45 + R0() * 0.72);
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.036 + R0() * 0.042, l, 6), iceMat);
      m.rotation.x = Math.PI; m.position.set(x, y - l / 2, z); into.add(m);
    }
  };

  // 木碼頭：橫鋪積雪木板＋縱樑＋繫船木樁，碰撞維持原範圍
  const dock = (x0, x1, z0, z1) => {
    W.addBox(x0, -0.3, z0, x1, 0, z1);
    const w = x1 - x0, len = z1 - z0;
    const nPlank = Math.max(4, Math.round(len / 0.42));
    const stepZ = len / nPlank;
    for (let i = 0; i < nPlank; i++) {
      const pl = new THREE.Mesh(new THREE.BoxGeometry(w, 0.13, stepZ - 0.03), woodMat);
      pl.position.set((x0 + x1) / 2, -0.065, z0 + (i + 0.5) * stepZ);
      pl.castShadow = pl.receiveShadow = true;
      scene.add(pl, withOutline(pl, 0.015));
    }
    for (const x of [x0 + 0.22, x1 - 0.22]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, len), darkMat);
      beam.position.set(x, -0.20, (z0 + z1) / 2); scene.add(beam);
      for (let z = z0 + 0.3; z < z1; z += 1.5) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.125, 3, 8), darkMat);
        p.position.set(x, -1.5, z); scene.add(p, withOutline(p, 0.014));
      }
    }
    // 碼頭前端左右矮繫船柱（在 x0+0.12、x1-0.12 邊緣，不擋中央上岸）
    for (const x of [x0 + 0.14, x1 - 0.14]) {
      const bol = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.10, 0.26, 8), darkMat);
      bol.position.set(x, 0.12, z0 + 0.22); bol.castShadow = true;
      scene.add(bol, withOutline(bol, 0.012));
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.025, 5, 10), ropeMat);
      coil.rotation.x = Math.PI / 2; coil.position.set(x, 0.14, z0 + 0.22); scene.add(coil);
    }
    icicles(x0, x1, -0.2, z0, 0.52);
  };

  const checkpoint = (x, y, z, sx) => { const L = lantern(x, y, z, 'check', 0); L.line = true; if (sx !== undefined) L.spawn.x = sx; return L; };

  // ---------- 壹 雪徑 ----------
  rock(-5, B, -8, 5, 0, 12);
  rock(-3, B, -14, 3, 0.4, -9.6);
  rock(-3, B, -19, 3, 0, -15.8);
  dock(-1.6, 1.6, -22.5, -19);
  // line：走過燈籠所在的 z 就算點亮，路再寬都不會漏；重生點放回路徑中線
  checkpoint(2, 0, -17.5, 0);
  // 兩側山坡與背後的崖，把起點圍成雪谷，並點綴積雪奇石
  rock(-18, B, 13, 18, 7, 28, { jitter: 0.5, lumpy: 0.35, freq: 0.4 });
  rock(-18, B, -24, -6.5, 5, 13, { jitter: 0.6, lumpy: 0.4, freq: 0.4 });
  rock(6.5, B, -24, 18, 4, 13, { jitter: 0.6, lumpy: 0.4, freq: 0.4 });
  boulders([
    [-4.3, 0.42, -1.8, 0.85, 0.58, 0.78, 101],
    [4.4, 0.48, -2.6, 0.92, 0.64, 0.85, 102],
    [-4.5, 0.55, 5.2, 0.98, 0.68, 0.90, 103],
    [4.5, 0.38, 6.8, 0.78, 0.52, 0.74, 104],
    [-5.8, 1.4, -12.5, 1.15, 0.85, 1.05, 105],
    [5.8, 1.2, -13.2, 1.10, 0.80, 1.00, 106],
  ], true);
  place(makeTorii(4.2, 3.8, 1), 0, 0, -20.6);
  W.addCyl(-2.1, -20.6, 0.24, -2, 3.8); W.addCyl(2.1, -20.6, 0.24, -2, 3.8);

  // ---------- 貳 寒潭：峽谷、木筏、橫木 ----------
  rock(-14, B, -91, -7, 9, -24, { jitter: 0.35, seg: 1.05 });
  rock(7, B, -91, 14, 9, -24, { jitter: 0.35, seg: 1.05 });
  rock(-16, 5, -40, -9, 12, -24, { jitter: 0.5, lumpy: 0.3, noCol: true });
  rock(9, 5, -62, 16, 13, -44, { jitter: 0.5, lumpy: 0.3, noCol: true });
  drip(-14, -7, -24, 8.9, 2.6, 1); drip(7, 14, -24, 8.9, 2.6, 1);
  icicles(-6.9, -6.9 + 0.1, 8.8, -32, 1.1);

  // 橫木 0.32 m 寬、頂 0.32：原地跳要算準時機才過得去，助跑跳則很寬鬆
  const LOGS = [-34, -45, -52.4];
  for (const z of LOGS) {
    W.addBox(-7, 0.04, z - 0.16, 7, 0.32, z + 0.16, { small: true, log: true });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.17, 14.2, 12), woodMat);
    m.rotation.z = Math.PI / 2; m.position.set(0, 0.16, z); m.castShadow = true; scene.add(m, withOutline(m, 0.02));
    // 兩端嵌入岩壁的木托座、藤繩箍環與垂掛冰凌
    for (const sx of [-6.85, 6.85]) {
      const brk = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.48, 0.48), darkMat);
      brk.position.set(sx, 0.16, z); scene.add(brk, withOutline(brk, 0.015));
    }
    for (const x of [-5.2, -3.6, 0, 3.6, 5.2]) {
      const rp = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.032, 6, 12), ropeMat);
      rp.rotation.y = Math.PI / 2; rp.position.set(x, 0.16, z); scene.add(rp);
    }
    icicles(-5.5, 5.5, 0.02, z, 0.34, 0.65);
  }

  // 木筏：七根原木＋前後橫貫壓木＋逐根十字麻繩綑紮＋船底墨水漣漪圈
  const RAFT_V = 2.4, RAFT_L = 5;
  const raft = { z0: -25.1, z1: -57.6, z: -25.1, state: 'idle', t: 0 };
  const raftCol = W.addBox(-1.33, -0.55, raft.z - RAFT_L / 2, 1.33, -0.25, raft.z + RAFT_L / 2, { small: true });
  const raftG = new THREE.Group(); raftG.userData.noBake = true; scene.add(raftG);
  {
    const gs = [], capGs = [];
    for (let i = -3; i <= 3; i++) {
      const len = RAFT_L - 0.04 + ((Math.abs(i) % 2) ? -0.10 : 0.06);
      const c = new THREE.CylinderGeometry(0.182, 0.192, len, 10);
      c.rotateX(Math.PI / 2); c.translate(i * 0.38, -0.44, 0); gs.push(c);
      for (const sz of [-1, 1]) {
        const cap = new THREE.CylinderGeometry(0.15, 0.15, 0.02, 10);
        cap.rotateX(Math.PI / 2); cap.translate(i * 0.38, -0.44, sz * (len / 2 + 0.005)); capGs.push(cap);
      }
    }
    const logs = new THREE.Mesh(mergeGeometries(gs), woodMat); logs.castShadow = logs.receiveShadow = true;
    raftG.add(logs, withOutline(logs, 0.02));
    raftG.add(new THREE.Mesh(mergeGeometries(capGs), darkMat));

    const lashingGs = [];
    for (const z of [-1.9, 1.9]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.82, 0.10, 0.15), darkMat);
      bar.position.set(0, -0.26, z); bar.castShadow = true;
      raftG.add(bar, withOutline(bar, 0.014));
      for (let i = -3; i <= 3; i++) {
        const t1 = new THREE.TorusGeometry(0.14, 0.024, 5, 10);
        t1.rotateY(Math.PI / 4); t1.translate(i * 0.38, -0.32, z); lashingGs.push(t1);
        const t2 = new THREE.TorusGeometry(0.14, 0.024, 5, 10);
        t2.rotateY(-Math.PI / 4); t2.translate(i * 0.38, -0.32, z); lashingGs.push(t2);
      }
    }
    raftG.add(new THREE.Mesh(mergeGeometries(lashingGs), ropeMat));

    // 木筏周圍貼水淡漣漪（呼應參考影片竹筏行過黑水的同心水紋）
    const wakeMat = new THREE.MeshBasicMaterial({ color: 0x5c636b, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false });
    const wake = new THREE.Mesh(new THREE.RingGeometry(1.75, 1.92, 24), wakeMat);
    wake.rotation.x = -Math.PI / 2; wake.scale.set(0.92, 1.58, 1);
    wake.position.y = WATER + 0.022;
    wake.userData.noBake = true;
    raftG.add(wake);
    raft.wake = wake;
  }
  raftG.position.z = raft.z;

  // 潭面的浮冰與峽谷腳的雪岸（只有外觀）
  const R1 = rng(2772);
  for (let i = 0; i < 30; i++) {
    const s = R1() < 0.5 ? -1 : 1, x = s * (3.5 + R1() * 3.2), z = -25.5 - R1() * 36.5, w = 0.48 + R1() * 1.15;
    b.rockGeos.push(cylGeo(x, z, w, -1.32, -1.09, { jitter: w * 0.36, seg: 10 + Math.floor(R1() * 5) }));
  }
  for (let z = -24; z > -62; z -= 5) {
    rock(-7.6, B, z - 5, -6.3 - R1() * 0.5, -0.8, z, { noCol: true, jitter: 0.25 });
    rock(6.3 + R1() * 0.5, B, z - 5, 7.6, -0.8, z, { noCol: true, jitter: 0.25 });
  }

  // ---------- 參 石庭 ----------
  dock(-1.6, 1.6, -64, -60.2);
  rock(-7, B, -80, 7, 0, -64);
  rock(-7, B, -90, 7, T1, -80);
  const lT1 = edge(-7, 7, T1, -80, 1, { name: 'T1' });
  drip(-7, 7, -80, T1 - 0.08, 2.0, 1);
  checkpoint(1.95, 0, -65.8, 0);
  checkpoint(5.5, T1, -81.5);

  // 閘門牆（加積雪瓦簷與門洞石框）：開口 x[-1.5,1.5]，門楣 6.3～7.5
  rock(-14, B, -118, 14, T1, -90);
  rock(-7, T1, -91, -1.5, 7.5, -90, { jitter: 0.08 });
  rock(1.5, T1, -91, 7, 7.5, -90, { jitter: 0.08 });
  rock(-1.5, 6.3, -91, 1.5, 7.5, -90, { jitter: 0.04 });
  scene.add(makeWallCoping(-7.0, -91, 7.0, -90, 7.5, 1));
  icicles(-1.4, 1.4, 6.3, -90, 0.55);
  icicles(-6.8, 6.8, 7.42, -89.98, 0.85, 0.45);

  // 鐵木閘門：帶鍛鐵尖矛下端、鉚釘橫樑與懸吊鐵鍊，往上收進門楣
  const gate = { open: 0, pressed: false, y: 0 };
  const gateCol = W.addBox(-1.5, T1, -90.6, 1.5, 6.3, -90.2, { small: true });
  const gateG = new THREE.Group(); gateG.userData.noBake = true; scene.add(gateG);
  {
    const iron = inkMaterial({ color: 0x22242a, wash: 0.55 });
    for (let x = -1.3; x <= 1.31; x += 0.52) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.42, 0.12), iron);
      m.position.set(x, 1.29, 0); m.castShadow = true; gateG.add(m, withOutline(m, 0.012));
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.22, 4), iron);
      tip.rotation.x = Math.PI; tip.rotation.y = Math.PI / 4; tip.position.set(x, 0.11, 0); gateG.add(tip);
    }
    for (const y of [0.38, 1.26, 2.16]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.13, 0.21), iron);
      m.position.set(0, y, 0); m.castShadow = true; gateG.add(m, withOutline(m, 0.014));
      for (let x = -1.3; x <= 1.31; x += 0.52) {
        const riv = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 5), iron);
        riv.position.set(x, y, 0.11); gateG.add(riv);
      }
    }
  }
  gateG.position.set(0, T1, -90.4);

  // 機關板與連到閘門的雕石刻槽
  const plate = { x: -4, z: -84.2, y: T1, r: 0.8, rBlock: 1.05, k: 0 }; // 石塊蓋住板的三成以上就算壓住
  const plateG = new THREE.Group(); plateG.userData.noBake = true; scene.add(plateG);
  {
    const stone = inkMaterial({ color: 0x8e8c85, crack: 0.35, wash: 0.65 });
    const rim = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.05, 1.78), inkMaterial({ color: 0x5c5b56, wash: 0.5 }));
    rim.position.y = 0.015; plateG.add(rim);
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.10, 1.56), stone);
    p.position.y = 0.04; p.receiveShadow = true; plateG.add(p, withOutline(p, 0.018));
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.52, 4), new THREE.MeshBasicMaterial({ color: PAL.vermilion, side: THREE.DoubleSide }));
    ring.rotation.set(-Math.PI / 2, 0, Math.PI / 4); ring.position.y = 0.095; plateG.add(ring);
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.14, 0.22, 4), new THREE.MeshBasicMaterial({ color: PAL.vermilion, side: THREE.DoubleSide }));
    ring2.rotation.set(-Math.PI / 2, 0, 0); ring2.position.y = 0.095; plateG.add(ring2);
  }
  plateG.position.set(plate.x, plate.y, plate.z);
  const grooveM = new THREE.MeshBasicMaterial({ color: 0x191a1f });
  for (const [x, z, w, d] of [[-1.8, -84.2, 3.6, 0.11], [0, -87.2, 0.11, 6]]) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(w, 0.022, d), grooveM);
    g.position.set(x, T1 + 0.012, z); g.userData.noBake = true; scene.add(g);
  }

  // ---------- 推得動的雕紋石塊 ----------
  const blocks = [];
  const HALF = 0.6, TALL = 1.0;
  const blockMat = inkMaterial({ color: 0xa3a097, crack: 0.55, streak: 0.35, wash: 0.75, snow: 1 });
  const ironTrim = inkMaterial({ color: 0x222328, wash: 0.5 });
  function makeBlock(x, y, z) {
    const g = new THREE.Group(); g.userData.noBake = true; scene.add(g);
    const m = new THREE.Mesh(rockGeo(-HALF, 0, -HALF, HALF, TALL, HALF, { jitter: 0.024, seg: 0.35 }), blockMat);
    m.castShadow = m.receiveShadow = true;
    g.add(m, withOutline(m, 0.02));
    for (const by of [0.12, 0.64, 0.88]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(1.23, by === 0.64 ? 0.10 : 0.06, 1.23), ironTrim);
      band.position.y = by; g.add(band);
    }
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 1.25), new THREE.MeshBasicMaterial({ color: PAL.vermilion }));
    tag.position.y = 0.48; g.add(tag);
    const tag2 = tag.clone(); tag2.rotation.y = Math.PI / 2; g.add(tag2);
    const o = { home: new THREE.Vector3(x, y, z), x, y, z, g, col: W.addBox(x - HALF, y, z - HALF, x + HALF, y + TALL, z + HALF, { block: null, small: true }), ax: 0, az: 0, hold: 0, charge: 0, fall: 0, vy: 0, wait: false, pop: 0, stuck: 0, grind: 0, moved: 0 };
    o.col.block = o; g.position.set(x, y, z); blocks.push(o);
    return o;
  }
  const block1 = makeBlock(3, 0, -73);
  makeBlock(4, T1, -87.5);

  const place2 = (o, x, y, z) => {
    W.moveBox(o.col, x - o.x, y - o.y, z - o.z); o.col.delta.set(0, 0, 0);
    o.x = x; o.y = y; o.z = z; o.g.position.set(x, y, z);
  };
  function clear(o, x, y, z, pp) {
    for (const c of W.cols) {
      if (c === o.col || !c.on) continue;
      if (c.max.y <= y + 0.02 || c.min.y >= y + TALL - 0.02) continue;
      if (c.max.x <= x - HALF || c.min.x >= x + HALF || c.max.z <= z - HALF || c.min.z >= z + HALF) continue;
      return false;
    }
    if (pp && Math.abs(pp.x - x) < HALF + 0.35 && Math.abs(pp.z - z) < HALF + 0.35 && pp.y < y + TALL && pp.y + 1.75 > y) return false;
    return true;
  }
  const supported = (o, x, z) => { const g = W.ground(x, z, 0.05, o.y + 0.05, 0.1); return !!g.col && Math.abs(g.y - o.y) < 0.08; };
  function sendHome(o) { o.wait = true; o.col.on = false; o.g.visible = false; o.fall = 0; o.hold = o.charge = o.stuck = 0; o.g.rotation.set(0, 0, 0); }
  function updateBlock(o, dt, pp) {
    W.moveBox(o.col, 0, 0, 0);
    if (o.pop > 0) { o.pop = Math.max(0, o.pop - dt); const k = 1 - o.pop / 0.3; o.g.scale.setScalar(0.4 + 0.6 * k); }
    if (o.wait) {
      if (clear(o, o.home.x, o.home.y, o.home.z, pp)) {
        place2(o, o.home.x, o.home.y, o.home.z);
        o.wait = false; o.col.on = true; o.g.visible = true; o.pop = 0.3; o.moved = 0;
      }
      return;
    }
    if (o.fall > 0) {
      o.fall += dt; o.vy -= 20 * dt;
      W.moveBox(o.col, 0, o.vy * dt, 0);
      o.y += o.vy * dt; o.g.position.y = o.y; o.g.rotation.x += dt * 1.1; o.g.rotation.z += dt * 0.7;
      if (o.fall > 0.8) { api.sfx.thud(); sendHome(o); }
      return;
    }
    if (o.hold <= 0) { o.charge = 0; o.stuck = Math.max(0, o.stuck - dt * 0.4); return; }
    o.hold -= dt;
    if (o.charge < 0.2) return;
    const nx = o.x + o.ax * 1.6 * dt, nz = o.z + o.az * 1.6 * dt;
    if (!clear(o, nx, o.y, nz)) { o.stuck += dt; return; }
    W.moveBox(o.col, nx - o.x, 0, nz - o.z);
    o.x = nx; o.z = nz; o.g.position.x = nx; o.g.position.z = nz; o.moved += 1.6 * dt;
    o.grind -= dt;
    if (o.grind <= 0) {
      o.grind = 0.32; api.sfx.grind();
      api.vfx?.footstep(o.x - o.ax * 0.55, o.y, o.z - o.az * 0.55, true);
    }
    if (!supported(o, nx, nz)) { o.fall = 0.001; o.vy = 0; o.col.on = false; o.hold = 0; }
  }
  function push(hit, dt, s) {
    const o = hit.c.block;
    if (!o || o.fall > 0 || o.wait) return false;
    const horiz = Math.abs(hit.x) > Math.abs(hit.z);
    if (Math.max(Math.abs(hit.x), Math.abs(hit.z)) < 0.9) return false;
    const ax = horiz ? -Math.sign(hit.x) : 0, az = horiz ? 0 : -Math.sign(hit.z);
    if (ax !== o.ax || az !== o.az) { o.charge = 0; o.ax = ax; o.az = az; }
    o.charge += dt; o.hold = 0.05; // 只蓋過接觸的空檔，放手就停
    // 對位輔助：推的時候把人慢慢吸到石塊中線，方向偏一點或搖桿不準也不會滑出石塊
    const k = Math.min(1, dt * 7);
    if (az) { s.pos.x += (o.x - s.pos.x) * k; s.vel.x = 0; } else { s.pos.z += (o.z - s.pos.z) * k; s.vel.z = 0; }
    return true;
  }

  // ---------- 肆 冰壁 ----------
  rock(-14, T1, -97, -3.5, 9, -91, { jitter: 0.2 });
  rock(9, T1, -97, 14, 9, -91, { jitter: 0.2 });
  rock(-14, T1, -118, 14, TOP, WALLZ, { jitter: 0.12, seg: 1.0 });
  checkpoint(-2.4, T1, -93.8);
  // 凍住的多股冰瀑，貼在壁面（只有外觀）
  {
    const fallMat = inkMaterial({ color: 0xa8c2ce, streak: 0.9, wash: 0.95, crack: 0.55, grain: 0.7 });
    const m = new THREE.Mesh(rockGeo(0.5, T1, WALLZ - 0.2, 8.5, TOP - 0.08, WALLZ + 0.12, { jitter: 0.11, seg: 0.38, freq: 1.5 }), fallMat);
    m.receiveShadow = true; scene.add(m);
    icicles(-3.4, 9.0, TOP - 0.05, WALLZ + 0.06, 1.55, 0.36);
    icicles(0.6, 8.4, T1 + 4.2, WALLZ + 0.11, 0.95, 0.44);
  }
  const lS1 = slab(-2, 2.4, 6.2, WALLZ, 1, { name: 'S1' });
  const lS2 = slab(5.5, 7.5, 10.6, WALLZ, 1, { name: 'S2' });
  const lTop = edge(5, 8, TOP, WALLZ, 1, { name: 'TOP' });
  drip(-3.4, 0.5, WALLZ, TOP - 0.08, 3.2, 1);

  // 冰縫：掛上去 1.5 秒開始裂，3 秒碎掉，3.5 秒後長回來
  const ICE_WARN = 1.5, ICE_BREAK = 3;
  const crackMat = new THREE.LineBasicMaterial({ color: 0x12151a });
  const ice = [];
  function icePlate(x0, x1, y, name) {
    const zo = WALLZ + 0.4;
    const col = W.addBox(x0, y - 0.25, WALLZ, x1, y, zo, { small: true });
    const L = W.addLedge(x0, y, zo, x1, zo, [0, 1], { name });
    const g = new THREE.Group(); g.userData.noBake = true; scene.add(g);
    const sx = x1 - x0;
    const ig = new THREE.BoxGeometry(sx, 0.25, 0.46, Math.max(4, Math.round(sx / 0.32)), 2, 2);
    const ip = ig.attributes.position;
    for (let i = 0; i < ip.count; i++) {
      const vy = ip.getY(i);
      if (vy < 0) ip.setY(i, vy - Math.abs(Math.sin(ip.getX(i) * 4.5)) * 0.07);
    }
    ig.computeVertexNormals();
    const m = new THREE.Mesh(ig, iceMat);
    m.position.set((x0 + x1) / 2, y - 0.125, WALLZ + 0.19); m.castShadow = true; g.add(m, withOutline(m, 0.016));
    icicles(x0, x1, y - 0.25, zo - 0.08, 0.65, 0.26, g);
    const pts = [];
    for (let i = 0; i < 5; i++) {
      let px = x0 + (x1 - x0) * (0.12 + i * 0.19), py = y - 0.005;
      for (let k = 0; k < 4; k++) { const nx = px + (R0() - 0.5) * 0.28, ny = py - 0.072; pts.push(px, py, zo + 0.03, nx, ny, zo + 0.03); px = nx; py = ny; }
    }
    const crack = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), crackMat);
    crack.visible = false; g.add(crack);
    const shards = [];
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08 + R0() * 0.09, 0), iceMat);
      s.visible = false; s.userData.noBake = true; scene.add(s);
      shards.push({ m: s, vy: 0, vx: 0, vz: 0, x0: x0 + (x1 - x0) * R0(), y0: y - 0.1 });
    }
    const o = { L, col, g, crack, shards, t: 0, broken: 0, warned: false, tick: 0, name };
    ice.push(o);
    return o;
  }
  const i1 = icePlate(1, 4.2, 8.4, 'I1');
  const i2 = icePlate(5.9, 7.4, 8.4, 'I2');
  function setIce(o, ok) {
    o.L.on = ok; o.col.on = ok; o.g.visible = ok; o.t = 0; o.warned = false; o.crack.visible = false; o.g.position.x = 0;
    if (ok) { o.broken = 0; for (const s of o.shards) s.m.visible = false; }
  }
  function updateIce(o, dt, t, ps) {
    if (o.broken > 0) {
      o.broken -= dt;
      for (const s of o.shards) if (s.m.visible) {
        s.vy -= 18 * dt; s.m.position.x += s.vx * dt; s.m.position.y += s.vy * dt; s.m.position.z += s.vz * dt; s.m.rotation.x += dt * 5;
        if (s.m.position.y < T1) s.m.visible = false;
      }
      if (o.broken <= 0) setIce(o, true);
      return;
    }
    const held = !!ps && ps.mode === 'hang' && ps.ledge === o.L;
    o.t = held ? o.t + dt : Math.max(0, o.t - dt * 0.5);
    const warn = o.t > ICE_WARN;
    if (warn && !o.warned) api.sfx.crack();
    o.warned = warn; o.crack.visible = warn;
    if (warn) {
      o.g.position.x = Math.sin(t * 70) * 0.008 * (1 + (o.t - ICE_WARN) * 2);
      o.tick -= dt;
      if (o.tick <= 0) {
        o.tick = 0.26 - (o.t - ICE_WARN) * 0.1; api.sfx.tick();
        api.vfx?.frostTrickle((o.L.a.x + o.L.b.x) * 0.5, o.L.y, WALLZ);
      }
    } else o.g.position.x = 0;
    if (o.t >= ICE_BREAK) {
      setIce(o, false); o.broken = 3.5; api.sfx.crack();
      api.vfx?.grabSparks((o.L.a.x + o.L.b.x) * 0.5, o.L.y, WALLZ + 0.35, true);
      for (const s of o.shards) { s.m.visible = true; s.m.position.set(s.x0, s.y0, WALLZ + 0.25); s.vx = (Math.random() - 0.5) * 2.4; s.vy = 1 + Math.random() * 1.6; s.vz = 0.4 + Math.random() * 1.2; }
    }
  }

  // ---------- 伍 雪塔 ----------
  rock(-14, TOP, -118, -9, 15, WALLZ, { jitter: 0.4, lumpy: 0.25 });
  rock(9, TOP, -118, 14, 15, WALLZ, { jitter: 0.4, lumpy: 0.25 });
  rock(-9, TOP, -118, 9, 15, -115, { jitter: 0.4, lumpy: 0.25 });
  boulders([
    [-8.2, TOP + 0.55, -104.5, 0.92, 0.65, 0.85, 201],
    [8.3, TOP + 0.58, -105.2, 0.96, 0.68, 0.88, 202],
    [-6.2, TOP + 0.45, -113.8, 0.82, 0.58, 0.78, 203],
    [6.2, TOP + 0.48, -113.6, 0.85, 0.60, 0.80, 204],
  ], true);
  place(makePagoda(), 0, TOP, -108);
  W.addBox(-3.2, TOP, -111.2, 3.2, TOP + 12, -104.8);
  const fin = lantern(4.6, TOP, -102.6, 'finish', 0);

  // ---------- 遠景：雪嶺 ----------
  const R = rng(278);
  const farGeos = [];
  const farPines = [];
  for (let i = 0; i < 42; i++) {
    const a = R() * Math.PI * 2, d = 70 + R() * 240;
    const x = Math.cos(a) * d, z = -55 + Math.sin(a) * d;
    if (x > -30 && x < 30 && z > -130 && z < 40) continue;
    const r = 6 + R() * 16, top = 4 + R() * 46;
    farGeos.push(cylGeo(x, z, r, B - 20, top, { jitter: r * 0.3, seg: 11 }));
    if (R() < 0.5) farPines.push([x + (R() - 0.5) * r, top, z + (R() - 0.5) * r, 1.5 + R() * 2]);
  }
  for (const [x, z, r, t] of [[-24, -40, 9, 16], [24, -30, 8, 14], [-26, -80, 11, 20], [26, -86, 10, 22], [-24, -112, 8, 24], [22, -116, 9, 26]]) farGeos.push(cylGeo(x, z, r, B, t, { jitter: 1.4, seg: 16 }));
  const farMesh = new THREE.Mesh(mergeGeometries(farGeos), rockMat);
  farMesh.userData.noBake = true;
  scene.add(farMesh);

  const rockMesh = b.finishRocks();

  // 松樹（積雪迎客松：近景精細、遠景輕量）
  const pines = [
    [-3.6, 0, -4.5, 1.1], [4.3, 0, -6.2, 1.3], [-3.8, 0, 7.5, 1.5], [-8.2, 5, -6, 1.4],
    [8.5, 4, 3, 1.5], [-5.4, 0, -68.5, 1.2], [-5.8, 0, -77, 1.45], [5.8, 0, -77.4, 1.1],
    [-6.1, T1, -89.3, 1.05], [-11, 9, -40, 1.6], [11, 9, -32, 1.3], [-10.5, 9, -62, 1.5],
    [10.5, 9, -72, 1.7], [-7, TOP, -100, 1.3], [-7.2, TOP, -112, 1.5], [7.2, TOP, -112, 1.3],
  ];
  for (const [i, [x, y, z, s]] of pines.entries()) {
    place(makePine(61 + i * 5, s, 1, false), x, y, z, i);
    if (Math.abs(x) < 9.5 && y <= TOP) W.addCyl(x, z, 0.16 * s, y, y + 3 * s);
  }
  for (const [i, [x, y, z, s]] of farPines.entries()) place(makePine(1200 + i, s, 1, true), x, y, z, i);

  // 寒潭古碑、三足香爐、風動雪竹、寒蘆芒草與冰崖垂藤（全避開跑跳與推石動線）
  place(makeStele(202, 1.62, 1), -3.4, 0, 1.8, 0.26);
  W.addCyl(-3.4, 1.8, 0.35, 0, 1.85);
  place(makeStele(219, 1.55, 1), -5.8, 0, -66.5, 0.32);
  W.addCyl(-5.8, -66.5, 0.35, 0, 1.8);

  for (const [cx, cy, cz] of [[-2.35, 0, -18.0], [-2.2, TOP, -103.6], [2.2, TOP, -103.6]]) {
    place(makeCenser(1), cx, cy, cz);
    W.addCyl(cx, cz, 0.32, cy, cy + 0.85);
    smokeSpots.push([cx, cy + 0.86, cz]);
  }

  for (const [sd, x, y, z, n, h] of [
    [801, 4.1, 0, 2.6, 6, 4.0], [802, -4.2, 0, -2.5, 5, 3.8],
    [803, 2.7, 0, -18.4, 5, 3.5], [804, 6.1, 0, -69.5, 6, 4.2],
    [805, -6.2, T1, -82.2, 5, 3.8], [806, -8.2, TOP, -102.5, 6, 4.4],
    [807, 8.2, TOP, -102.5, 6, 4.4],
  ]) place(makeBamboo(sd, n, h, 1), x, y, z);

  scene.add(makeGrassField([
    [-3.6, 0, 4.2, 1.05, 10], [3.6, 0, 4.0, 1.0, 9], [-2.6, 0.4, -10.8, 0.9, 8], [2.6, 0.4, -12.6, 0.9, 8],
    [-2.5, 0, -16.8, 1.0, 9], [2.5, 0, -16.6, 1.0, 9], [-6.4, -0.78, -28.5, 1.1, 10], [6.4, -0.78, -36.5, 1.1, 10],
    [-6.4, -0.78, -48.5, 1.1, 10], [6.4, -0.78, -55.5, 1.1, 10], [-6.2, 0, -67.2, 1.1, 10], [6.2, 0, -75.5, 1.1, 10],
    [-6.2, T1, -85.5, 1.05, 9], [6.2, T1, -83.5, 1.05, 9], [-7.6, TOP, -106.5, 1.1, 10], [7.6, TOP, -106.5, 1.1, 10],
  ], 1));

  scene.add(
    makeCliffVines(-13.5, -7.2, 8.9, -24.0, 1, 7, 2.4, 1),
    makeCliffVines(7.2, 13.5, 8.9, -24.0, 1, 7, 2.4, 1),
    makeCliffVines(-6.6, 6.6, T1 - 0.05, -80.0, 1, 9, 1.9, 1),
    makeCliffVines(-13.0, -3.6, 8.9, -91.0, 1, 6, 2.2, 1),
  );

  // 貼崖薄寒霧：降低透明度並貼靠兩岸，保留中央寒潭如墨的深邃黑水反差
  b.fogPuffs({
    n: 14, seed: 47, fog: FOG, near: 38, far: 210, size: 0.34, fadeNear: 28, opacity: 0.18,
    at: (Rr) => [(Rr() < 0.5 ? -1 : 1) * (4.2 + Rr() * 3.8), -0.6 + Rr() * 1.4, -8 - Rr() * 64],
  });

  // ---------- 提示與區段 ----------
  const section = (p) => p.y > TOP - 0.5 && p.z < WALLZ ? '伍 · 雪塔' : p.z < -90.2 ? '肆 · 冰壁' : p.z < -64 ? '參 · 石庭' : p.z < -22.5 ? '貳 · 寒潭' : '壹 · 雪徑';
  const near = (p, o, r) => Math.hypot(p.x - o.x, p.z - o.z) < r && Math.abs(p.y - o.y) < 1.4;
  hints.push(
    { id: 'move', when: (p) => p.z > -2, k: 'WASD 移動，點畫面後用滑鼠轉鏡頭', t: '左下搖桿移動，右半邊拖曳轉鏡頭' },
    { id: 'gap', when: (p) => p.z < -2 && p.z > -9.6 && p.y > -0.2, k: '空白鍵跳過裂隙', t: '按「躍」跳過裂隙' },
    { id: 'raft', when: (p) => p.z < -20.5 && raft.state === 'idle', k: '站上木筏，它會自己渡潭', t: '站上木筏，它會自己渡潭' },
    ...LOGS.map((z, i) => ({ id: `log${i}`, urgent: true, when: (p) => raft.state === 'go' && p.z - z < 8 && p.z - z > 0.3, k: i ? '橫木又來了：跳過去' : '橫木會把人掃下水：跳過去，也可以先跳上橫木', t: i ? '橫木又來了：按「躍」' : '橫木會把人掃下水：按「躍」跳過去' })),
    { id: 'push', when: (p) => near(p, block1, 2.8) && block1.moved < 0.5, k: '貼著石塊往前走就能推，推到高台壁下墊腳', t: '貼著石塊推，推到高台壁下墊腳' },
    { id: 'stack', when: (p) => p.z < -74 && p.y < 2 && block1.z < -78.5, k: '跳上石塊，再跳起抓住高台邊緣', t: '跳上石塊，再跳起抓住高台邊緣' },
    { id: 'reset', urgent: true, when: () => blocks.some((o) => o.stuck > 0.7), k: '石塊卡住了：對它出手（J 或左鍵）就會回原位', t: '石塊卡住了：按「擊」讓它回原位' },
    { id: 'plate', when: (p) => p.y > T1 - 0.3 && p.z < -82 && p.z > -90 && gate.open < 0.1, k: '機關板連著閘門，人一離開就關：把另一塊石頭推上去', t: '機關板連著閘門：把石頭推上去' },
    { id: 'grab2', when: (p, s) => p.z < -92 && p.y < 5 && s !== 'hang', k: '跳起抓住岩縫，往上爬', t: '跑向岩壁按「躍」，抓住岩縫' },
    { id: 'side1', when: (p, s, L) => s === 'hang' && L === lS1 && p.x < 1.1, k: 'D 橫移到冰縫正下方', t: '搖桿往右，移到冰縫正下方' },
    { id: 'up', urgent: true, when: (p, s, L) => s === 'hang' && L === lS1 && p.x >= 1.1, k: 'W 往上攀到冰縫', t: '搖桿往上，攀到冰縫' },
    { id: 'ice', sticky: true, urgent: true, when: (p, s, L) => s === 'hang' && L === i1.L, k: '冰撐不久！D 橫移到右端，D＋空白 側跳', t: '冰撐不久！往右移，搖桿往右＋「躍」' },
    { id: 'ice2', urgent: true, when: (p, s, L) => s === 'hang' && L === i2.L, k: 'W 往上攀，正上方還有一道石縫', t: '搖桿往上，正上方還有一道石縫' },
  );

  // ---------- 機關更新 ----------
  let smokeClock = 0, wakeClock = 0;
  function update(dt, t, pp, ps) {
    smokeClock += dt;
    if (smokeClock > 0.24 && api.vfx) {
      smokeClock = 0;
      const sp = smokeSpots[Math.floor((t * 7) % smokeSpots.length)];
      if (sp) api.vfx.ambientIncense(sp[0], sp[1], sp[2]);
    }
    const on = !!ps && ps.mode === 'ground' && ps.groundCol === raftCol;
    let dz = 0;
    if (raft.state === 'idle') { raft.t = on ? raft.t + dt : 0; if (raft.t > 0.6) { raft.state = 'go'; api.sfx.creak(); } }
    else if (raft.state === 'go') {
      const nz = Math.max(raft.z1, raft.z - RAFT_V * dt);
      dz = nz - raft.z; raft.z = nz;
      wakeClock += dt;
      if (wakeClock > 0.55) { wakeClock = 0; api.vfx?.waterRipple(0, WATER, raft.z + 0.8, 2.6); }
      if (nz <= raft.z1) { raft.state = 'end'; api.sfx.thud(); api.vfx?.waterRipple(0, WATER, raft.z - 1.2, 2.9); }
    }
    W.moveBox(raftCol, 0, 0, dz);
    const bob = Math.sin(t * 1.3) * 0.02;
    raftG.position.set(0, bob, raft.z);
    raftG.rotation.z = Math.sin(t * 0.9) * 0.008;
    if (raft.wake) {
      raft.wake.position.y = WATER - bob + 0.022;
      const pulse = 1 + Math.sin(t * 2.4) * 0.04;
      raft.wake.scale.set(0.92 * pulse, 1.34 * pulse, 1);
      raft.wake.material.opacity = raft.state === 'go' ? 0.52 : 0.28;
    }

    for (const o of blocks) updateBlock(o, dt, pp);
    const onPlate = (x, z, r) => Math.abs(x - plate.x) < r && Math.abs(z - plate.z) < r;
    const pressed = blocks.some((o) => !o.wait && !o.fall && Math.abs(o.y - plate.y) < 0.1 && onPlate(o.x, o.z, plate.rBlock)) ||
      (!!ps && ps.mode === 'ground' && Math.abs(pp.y - plate.y) < 0.2 && onPlate(pp.x, pp.z, plate.r));
    if (pressed !== gate.pressed) { gate.pressed = pressed; api.sfx.grind(); if (pressed) api.sfx.creak(); }
    plate.k += ((pressed ? 1 : 0) - plate.k) * Math.min(1, dt * 12);
    plateG.position.y = plate.y - plate.k * 0.05;
    grooveM.color.setHex(pressed ? 0xb54434 : 0x191a1f);
    gate.open = pressed ? Math.min(1, gate.open + dt / 1.2) : Math.max(0, gate.open - dt / 0.4);
    gateG.position.y = T1 + gate.open * 2.45;
    gateCol.on = gate.open < 0.85;
    for (const o of ice) updateIce(o, dt, t, ps);
  }

  function strike(pos, fwd) {
    for (const o of blocks) {
      if (o.wait || o.fall > 0) continue;
      const dx = o.x - pos.x, dz = o.z - pos.z, d = Math.hypot(dx, dz);
      if (d > 2.2 || Math.abs(o.y - pos.y) > 1.2) continue;
      if ((dx * fwd.x + dz * fwd.z) / Math.max(d, 0.01) < 0.15) continue;
      if (o.x === o.home.x && o.z === o.home.z) continue;
      api.sfx.thud(); sendHome(o);
      return { id: 'block' };
    }
    return null;
  }

  function resetRaft() {
    W.moveBox(raftCol, 0, 0, raft.z0 - raft.z); raftCol.delta.set(0, 0, 0);
    raft.z = raft.z0; raft.state = 'idle'; raft.t = 0; raftG.position.z = raft.z;
  }
  function reset() {
    resetRaft();
    for (const o of blocks) { sendHome(o); place2(o, o.home.x, o.home.y, o.home.z); o.wait = false; o.col.on = true; o.g.visible = true; o.moved = 0; o.g.scale.setScalar(1); }
    gate.open = 0; gate.pressed = false; gateCol.on = true; gateG.position.y = T1;
    for (const o of ice) setIce(o, true);
  }
  const onRespawn = (cp) => { if (cp.pos.z > -40) resetRaft(); };

  b.bake();

  const api = {
    world: W, update, strike, push, reset, onRespawn, lanterns, hints, section, camBlockers: [rockMesh], finish: fin,
    start: { pos: new THREE.Vector3(0, 0, 3.5), yaw: Math.PI },
    kill: (p) => p.y < -1,
    env: {
      fog: [FOG, 36, 215], bg: 0xd4d5d2, hemi: [0xe6ebf0, 0x5a6270, 1.5], sun: [0xf2f0ea, 1.65],
      sky: { paper0: [0.82, 0.83, 0.83], paper1: [0.71, 0.73, 0.75], wash: [0.42, 0.46, 0.53], washK: 0.54 },
      clouds: false, snow: true, water: true,
    },
    meta: {
      name: '寒潭渡', seal: '渡', sub: 'INK RIDGE · 第二關「寒潭渡」',
      text: '過了山門，雪落進黑水。木筏渡過寒潭，石庭要自己墊路，冰壁掛久了會碎。掉進水裡就回到最後點亮的石燈籠。',
      done: '雪塔的燈亮了，寒潭已渡。旅人的路到這裡先告一段落。',
    },
    debug: () => ({
      raft: { state: raft.state, z: raft.z },
      gateOpen: gate.open,
      blocks: blocks.map((o) => ({ x: o.x, y: o.y, z: o.z, wait: o.wait, fall: o.fall > 0 })),
      ice: ice.map((o) => ({ name: o.name, t: o.t, broken: o.broken > 0, on: o.L.on })),
    }),
    ledges: { T1: lT1, S1: lS1, I1: i1.L, I2: i2.L, S2: lS2, TOP: lTop },
    sfx: null,
    vfx: null,
  };
  return api;
}
