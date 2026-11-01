// 六器鏢行 — 程式建模的怪物與練功樁（人形的劫鏢匪、頭目、蘆葦小賊改用 chars.js 的骨架人物）
//
// 每隻怪物由幾個可動的部件（Group）組成，每個部件用 Kit 依材質合併成少數 mesh。模型面向 +Z、腳底在原點，
// 所以 root.rotation.y 直接用 world 的 rotY。update(dt, t, st) 的 st：{ speed, attack(0..1), stagger, hp, shield }。
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kit, T, rng } from './kit.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// 部件：在 pivot 位置建一個 Group，fn(k) 以 pivot 為原點建幾何
function part(parent, pivot, fn, seed = 3, name = '') {
  const k = new Kit(seed);
  fn(k);
  const g = k.build({ name });
  g.position.copy(pivot);
  parent.add(g);
  return g;
}

// 凹凸不平的石塊／岩板（icosahedron 加噪聲位移）
export function lumpGeo(r = 1, detail = 1, amt = 0.25, seed = 1, { flatTop = 0 } = {}) {
  let g = new THREE.IcosahedronGeometry(r, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4); // 共用頂點 → 平滑法線（不要低多邊形的切面感）
  const p = g.attributes.position;
  const R = rng(seed);
  const off = [R() * 10, R() * 10, R() * 10];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x / r * 3.1 + off[0]) * Math.sin(y / r * 2.7 + off[1]) * Math.sin(z / r * 3.3 + off[2]);
    const n2 = Math.sin(x / r * 7.3 + off[1]) * Math.sin(z / r * 6.1 + off[2]) * 0.35;
    const s = 1 + (n + n2) * amt;
    let ny = y * s;
    if (flatTop && ny > r * flatTop) ny = r * flatTop + (ny - r * flatTop) * 0.15;
    p.setXYZ(i, x * s, ny, z * s);
  }
  g.computeVertexNormals();
  return g;
}

// 圓角、表面不平的夯土塊／石塊（取代方正的 BoxGeometry）
function blockGeo(w, h, d, seed = 1, amt = 0.05, round = 0.2) {
  let g = new THREE.BoxGeometry(w, h, d, 4, 4, 4);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);
  const p = g.attributes.position;
  const rr = Math.min(w, h, d) * round;
  const ix = w / 2 - rr, iy = h / 2 - rr, iz = d / 2 - rr;
  const R = rng(seed);
  const off = [R() * 10, R() * 10, R() * 10];
  const m = Math.max(w, h, d);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const cx = Math.max(-ix, Math.min(ix, x)), cy = Math.max(-iy, Math.min(iy, y)), cz = Math.max(-iz, Math.min(iz, z));
    v.set(x - cx, y - cy, z - cz);
    if (v.lengthSq() > 1e-10) v.setLength(rr);
    const n = Math.sin(x / m * 9.1 + off[0]) * Math.sin(y / m * 7.7 + off[1]) * Math.sin(z / m * 8.3 + off[2])
      + Math.sin(x / m * 23 + off[1]) * Math.sin(y / m * 19 + off[2]) * 0.3;
    const s = 1 + n * amt;
    p.setXYZ(i, (cx + v.x) * s, (cy + v.y) * (1 + n * amt * 0.5), (cz + v.z) * s);
  }
  g.computeVertexNormals();
  return g;
}

// 沿曲線的管子（藤、尾巴、觸手）
function tubeGeo(points, r, seg = 12, rs = 6, taper = 0) {
  const curve = new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(curve, seg, r, rs, false);
  if (taper) {
    // 依沿線位置收細
    const p = g.attributes.position;
    const per = rs + 1;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const c = curve.getPointAt(t);
      const s = 1 - taper * t;
      for (let j = 0; j < per; j++) {
        const idx = i * per + j;
        p.setXYZ(idx, c.x + (p.getX(idx) - c.x) * s, c.y + (p.getY(idx) - c.y) * s, c.z + (p.getZ(idx) - c.z) * s);
      }
    }
    g.computeVertexNormals();
  }
  return g;
}

// 齒輪盤（關節用）
function gearDisc(k, mat, color, r, t, teeth, m) {
  const s = new THREE.Shape();
  const N = teeth * 4;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rr = i % 4 === 1 || i % 4 === 2 ? r : r * 0.82;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const h = new THREE.Path();
  h.absarc(0, 0, r * 0.28, 0, Math.PI * 2, true);
  s.holes.push(h);
  k.extrude(mat, color, s, t, m);
  k.cyl(mat, color, r * 0.3, r * 0.3, t * 1.6, 10, mul2(m, T(0, 0, 0, Math.PI / 2, 0, 0)));
}
const mul2 = (a, b) => a.clone().multiply(b);

// 腿：兩節（大腿 pivot 在髖、小腿 pivot 在膝）
function leg(parent, hip, upper, lower, r, mat, color, foot = null) {
  const thigh = part(parent, hip, (k) => {
    k.add(mat, new THREE.CapsuleGeometry(r, upper, 3, 8), color, T(0, -upper / 2, 0));
  });
  const shin = part(thigh, V(0, -upper, 0), (k) => {
    k.add(mat, new THREE.CapsuleGeometry(r * 0.8, lower, 3, 8), color, T(0, -lower / 2, 0));
    if (foot) foot(k, lower);
  });
  return { thigh, shin };
}

// ── 泥塘蟾 ──
function buildToad(ent) {
  const big = ent.subKind === 'bigtoad';
  const s = big ? 1.45 : 1.0;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = big ? 0x4f5a2c : 0x6a7436, belly = big ? 0xb9a36a : 0xcdbd84, wart = big ? 0x3c4421 : 0x56602a;
  const torso = part(body, V(0, 0.45 * s, 0), (k) => {
    k.sphere('leaf', skin, 0.5 * s, 18, 12, T(0, 0, 0, 0, 0, 0, 1.05, 0.62, 1.2), 0.02);
    k.sphere('leaf', belly, 0.46 * s, 16, 10, T(0, -0.1 * s, 0.06 * s, 0, 0, 0, 0.95, 0.5, 1.1), 0.02);
    const R = rng(big ? 41 : 17);
    for (let i = 0; i < (big ? 46 : 30); i++) {
      const a = R() * Math.PI * 2, b = R() * 0.9 + 0.15;
      const x = Math.cos(a) * Math.sin(b) * 0.5 * s * 1.03, y = Math.cos(b) * 0.31 * s, z = Math.sin(a) * Math.sin(b) * 0.6 * s;
      k.sphere('leaf', wart, (0.035 + R() * 0.04) * s, 6, 4, T(x, y, z));
    }
    // 背脊兩條腺體
    for (const sx of [-1, 1]) k.sphere('leaf', wart, 0.1 * s, 8, 6, T(sx * 0.2 * s, 0.22 * s, -0.05 * s, 0, 0, 0, 0.7, 0.5, 2.2));
    // 眼睛：凸起、金色虹膜、橫瞳
    for (const sx of [-1, 1]) {
      k.sphere('leaf', skin, 0.14 * s, 10, 8, T(sx * 0.24 * s, 0.24 * s, 0.38 * s));
      k.sphere('bronze', 0xc9a03a, 0.105 * s, 12, 10, T(sx * 0.27 * s, 0.29 * s, 0.44 * s));
      k.box('iron', 0x080806, 0.12 * s, 0.03 * s, 0.03 * s, T(sx * 0.29 * s, 0.3 * s, 0.535 * s, 0, sx * 0.35, 0));
    }
    // 嘴線
    k.torus('iron', 0x2a2a18, 0.36 * s, 0.012 * s, 4, 20, Math.PI * 0.8, T(0, 0.02 * s, 0.22 * s, Math.PI / 2 + 0.25, 0, Math.PI * 0.1));
    if (big) {
      // 背上長了一片荷葉和青苔
      k.cyl('leaf', 0x3f6b35, 0.42, 0.42, 0.015, 18, T(-0.1, 0.36 * s, -0.15, 0.25, 0, 0.15));
      k.sphere('leaf', 0x4a6630, 0.16, 8, 6, T(0.25, 0.3 * s, -0.3, 0, 0, 0, 1.4, 0.4, 1));
    }
  }, 5, 'toad');
  const throat = part(torso, V(0, -0.12 * s, 0.42 * s), (k) => k.sphere('leaf', 0xd8c890, 0.16 * s, 12, 8, T(0, 0, 0, 0, 0, 0, 1.3, 0.8, 0.9)));
  const tongue = part(torso, V(0, -0.02 * s, 0.5 * s), (k) => {
    k.cyl('cloth', 0xc0505a, 0.035 * s, 0.05 * s, 1, 6, T(0, 0, 0.5, Math.PI / 2, 0, 0));
    k.sphere('cloth', 0xc0505a, 0.08 * s, 8, 6, T(0, 0, 1.0));
  });
  tongue.scale.set(1, 1, 0.01);
  // 前腳撐地、後腿折起
  const legs = [];
  for (const sx of [-1, 1]) {
    legs.push(part(body, V(sx * 0.3 * s, 0.35 * s, 0.3 * s), (k) => {
      k.add('leaf', new THREE.CapsuleGeometry(0.07 * s, 0.28 * s, 3, 6), skin, T(sx * 0.08 * s, -0.17 * s, 0.05 * s, 0.2, 0, sx * 0.35));
      for (let f = -1; f <= 1; f++) k.add('leaf', new THREE.CapsuleGeometry(0.025 * s, 0.1 * s, 2, 5), belly, T(sx * 0.14 * s + f * 0.05 * s, -0.33 * s, 0.12 * s, Math.PI / 2 - 0.3, f * 0.4, 0));
    }));
    legs.push(part(body, V(sx * 0.42 * s, 0.3 * s, -0.3 * s), (k) => {
      k.sphere('leaf', skin, 0.2 * s, 10, 8, T(sx * 0.05 * s, 0, 0, 0, 0, 0, 1, 0.75, 1.5));
      k.add('leaf', new THREE.CapsuleGeometry(0.07 * s, 0.32 * s, 3, 6), skin, T(sx * 0.12 * s, -0.18 * s, 0.12 * s, 1.25, 0, 0));
      k.box('leaf', belly, 0.18 * s, 0.03 * s, 0.24 * s, T(sx * 0.14 * s, -0.29 * s, 0.24 * s));
    }));
  }
  let hop = 0;
  return {
    root, headY: 1.0 * s, radius: 0.75 * s,
    update(dt, t, st) {
      throat.scale.setScalar(1 + Math.max(0, Math.sin(t * 5.2 + ent.spawnX)) * 0.35);
      if (st.speed > 0.4) hop += dt * 4.2; else hop = Math.max(0, Math.round(hop) === hop ? hop : hop + dt * 4.2);
      const ph = hop % 1;
      const air = st.speed > 0.4 ? Math.sin(ph * Math.PI) : 0;
      body.position.y = air * 0.32 * s;
      body.rotation.x = -air * 0.35;
      torso.scale.set(1 + (1 - air) * 0.04, 1 - (1 - air) * 0.04 + air * 0.06, 1);
      legs[1].rotation.x = legs[3].rotation.x = -air * 1.1;
      const a = st.attack;
      tongue.scale.z = a > 0 ? Math.max(0.01, Math.sin(Math.min(1, a * 1.6) * Math.PI) * 1.4 * s) : 0.01;
      torso.rotation.x = a > 0 ? -Math.sin(a * Math.PI) * 0.25 : 0;
      root.rotation.z = st.stagger ? Math.sin(t * 30) * 0.08 : 0;
    },
  };
}

// ── 刺藤花 ──
function buildThornvine(ent) {
  const root = new THREE.Group();
  const R = rng(23);
  part(root, V(0, 0, 0), (k) => {
    // 盤根與泥堆
    k.add('earth', lumpGeo(0.55, 1, 0.3, 4), 0x4b3b2a, T(0, 0.05, 0, 0, 0, 0, 1.2, 0.35, 1.2));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + R() * 0.4;
      const pts = [V(0, 0.2, 0), V(Math.cos(a) * 0.45, 0.12, Math.sin(a) * 0.45), V(Math.cos(a) * 0.85, 0.02, Math.sin(a) * 0.85)];
      k.add('wood', tubeGeo(pts, 0.06, 8, 5, 0.8), 0x3d4a24, null);
    }
  }, 7);
  // 三根扭曲的莖（一起擺動）
  const stems = new THREE.Group();
  stems.position.y = 0.2;
  root.add(stems);
  const vine = part(stems, V(0, 0, 0), (k) => {
    for (let s = 0; s < 3; s++) {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const y = i * 0.18;
        const a = i * 0.9 + s * 2.1;
        pts.push(V(Math.cos(a) * 0.09 * (1 - i / 10), y, Math.sin(a) * 0.09 * (1 - i / 10)));
      }
      k.add('leaf', tubeGeo(pts, 0.07, 24, 6, 0.4), 0x37532a, null);
      for (let i = 1; i < 8; i++) {
        const p = pts[i];
        const a = R() * Math.PI * 2;
        k.cone('wood', 0xb8a070, 0.025, 0.14, 4, T(p.x + Math.cos(a) * 0.06, p.y, p.z + Math.sin(a) * 0.06, Math.sin(a) * 1.4, 0, -Math.cos(a) * 1.4));
      }
    }
    // 莖上的葉（鋸齒長葉）
    for (let i = 0; i < 6; i++) {
      const a = i * 1.1, y = 0.25 + i * 0.18;
      k.add('leaf', new THREE.SphereGeometry(0.2, 8, 4), 0x46682f, T(Math.cos(a) * 0.22, y, Math.sin(a) * 0.22, 0, -a, 0.6, 1.4, 0.08, 0.5));
    }
  }, 9);
  // 花頭：外層暗紅花瓣、內圈牙齒狀的萼刺、中心花芯
  const head = new THREE.Group();
  head.position.y = 1.5;
  stems.add(head);
  const petals = [];
  for (let i = 0; i < 7; i++) {
    const pg = part(head, V(0, 0, 0), (k) => {
      k.add('cloth', new THREE.SphereGeometry(0.42, 10, 8, 0, Math.PI * 0.55, 0, Math.PI * 0.5), 0x8e1f2a, T(0, 0, 0, -0.2, 0, 0, 0.9, 1.3, 1.0));
      k.add('cloth', new THREE.SphereGeometry(0.4, 10, 8, 0, Math.PI * 0.4, 0, Math.PI * 0.42), 0xc2433e, T(0, 0.02, 0.02, -0.2, 0.1, 0, 0.88, 1.25, 0.98));
    }, 11 + i);
    pg.rotation.y = (i / 7) * Math.PI * 2;
    petals.push(pg);
  }
  part(head, V(0, 0, 0), (k) => {
    k.sphere('leaf', 0x2f3a1c, 0.2, 12, 8, T(0, -0.05, 0, 0, 0, 0, 1, 0.6, 1));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      k.cone('wood', 0xe8dcb5, 0.03, 0.18, 4, T(Math.cos(a) * 0.14, 0.12, Math.sin(a) * 0.14, Math.sin(a) * -0.5, 0, Math.cos(a) * 0.5));
    }
    k.sphere('paper', 0xd8a23a, 0.08, 8, 6, T(0, 0.04, 0));
  }, 13);
  head.rotation.x = 0.5;
  return {
    root, headY: 2.0, radius: 0.8,
    update(dt, t, st) {
      const sw = Math.sin(t * 1.3 + ent.spawnX) * 0.12;
      stems.rotation.z = sw;
      stems.rotation.x = Math.sin(t * 0.9) * 0.08 + (st.attack > 0 ? Math.sin(st.attack * Math.PI) * 0.7 : 0);
      vine.rotation.y = Math.sin(t * 0.5) * 0.2;
      const open = 0.35 + Math.sin(t * 2.0) * 0.08 + (st.attack > 0 ? Math.sin(st.attack * Math.PI) * 0.5 : 0);
      for (const p of petals) p.rotation.x = -open;
      root.rotation.z = st.stagger ? Math.sin(t * 30) * 0.06 : 0;
    },
  };
}

// ── 石殼螺 ──
function buildSnail(ent) {
  const root = new THREE.Group();
  const foot = part(root, V(0, 0, 0), (k) => {
    k.add('leaf', new THREE.CapsuleGeometry(0.26, 0.9, 4, 10), 0x7b7363, T(0, 0.2, 0.15, Math.PI / 2, 0, 0, 1.2, 1, 0.7));
    k.box('leaf', 0x8a8170, 0.6, 0.06, 1.3, T(0, 0.04, 0.15));
  }, 3);
  const shell = part(root, V(0, 0.55, -0.15), (k) => {
    // 對數螺線殼：沿螺線放樣的管子，越往外越粗
    const pts = [];
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = t * Math.PI * 5.2;
      const r = 0.04 + Math.pow(t, 1.35) * 0.42;
      pts.push(V(Math.sin(a) * 0.05 * t, Math.cos(a) * r, Math.sin(a) * r));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 80, 1, 10, false);
    const p = geo.attributes.position;
    const per = 11;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const c = curve.getPointAt(t);
      const r = 0.03 + Math.pow(t, 1.2) * 0.2;
      const band = (Math.sin(t * 60) > 0.3 ? 0.78 : 1) * (0.75 + t * 0.3);
      for (let j = 0; j < per; j++) {
        const idx = i * per + j;
        p.setXYZ(idx, c.x + (p.getX(idx) - c.x) * r, c.y + (p.getY(idx) - c.y) * r, c.z + (p.getZ(idx) - c.z) * r);
        col[idx * 3] = 0.42 * band; col[idx * 3 + 1] = 0.36 * band; col[idx * 3 + 2] = 0.3 * band;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    k.add('stone', geo, 0xffffff, T(0, 0, 0, 0, Math.PI / 2, 0, 1.35, 1.35, 1.35));
    // 殼上的苔蘚斑與藤壺
    const R = rng(77);
    for (let i = 0; i < 9; i++) k.add('stone', lumpGeo(0.06, 0, 0.3, i), 0x5c6248, T((R() - 0.5) * 0.5, (R() - 0.3) * 0.5, (R() - 0.5) * 0.5));
  }, 5);
  const eyes = part(foot, V(0, 0.35, 0.68), (k) => {
    for (const sx of [-1, 1]) {
      k.cyl('leaf', 0x8a8170, 0.025, 0.035, 0.32, 6, T(sx * 0.08, 0.15, 0.04, 0.35, 0, -sx * 0.25));
      k.sphere('iron', 0x151515, 0.045, 8, 6, T(sx * 0.12, 0.31, 0.1));
    }
  }, 6);
  let crawl = 0;
  return {
    root, headY: 1.35, radius: 0.85,
    update(dt, t, st) {
      crawl += dt * (st.speed > 0.3 ? 5 : 0.8);
      foot.scale.z = 1 + Math.sin(crawl) * 0.08;
      shell.position.y = 0.55 + Math.sin(crawl) * 0.015;
      eyes.rotation.x = Math.sin(t * 1.7) * 0.15;
      eyes.rotation.z = Math.sin(t * 1.1) * 0.12;
      shell.rotation.z = st.attack > 0 ? Math.sin(st.attack * Math.PI) * 0.3 : 0;
      root.rotation.z = st.stagger ? Math.sin(t * 30) * 0.06 : 0;
    },
  };
}

// ── 四足獸共用（赤沙狼、岩蜥） ──
function buildWolf(ent) {
  const root = new THREE.Group();
  const fur = 0xa0532c, back = 0x5e2c18, pale = 0xd8b48a;
  const body = new THREE.Group();
  body.position.y = 0.78;
  root.add(body);
  part(body, V(0, 0, 0), (k) => {
    k.sphere('cloth', fur, 0.34, 14, 10, T(0, 0.02, 0.22, 0, 0, 0, 0.9, 1.0, 1.15)); // 胸
    k.sphere('cloth', fur, 0.3, 14, 10, T(0, 0.04, -0.3, 0, 0, 0, 0.85, 0.85, 1.25)); // 腹臀
    k.sphere('cloth', back, 0.22, 10, 8, T(0, 0.22, 0.02, 0, 0, 0, 0.9, 0.5, 2.2)); // 背脊深色毛
    k.sphere('cloth', pale, 0.22, 10, 8, T(0, -0.16, 0.25, 0, 0, 0, 0.8, 0.6, 1.0)); // 胸前淺毛
    // 頸鬃毛：一圈短錐
    const R = rng(31);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 1.6 - Math.PI * 0.8;
      k.cone('cloth', back, 0.06, 0.24, 4, T(Math.sin(a) * 0.24, 0.22 + Math.cos(a) * 0.08, 0.4 + R() * 0.08, -1.0, 0, -Math.sin(a) * 0.8));
    }
  }, 4);
  const neck = new THREE.Group();
  neck.position.set(0, 0.12, 0.5);
  body.add(neck);
  const head = part(neck, V(0, 0.12, 0.22), (k) => {
    k.sphere('cloth', fur, 0.19, 12, 10, T(0, 0, 0, 0, 0, 0, 1, 0.9, 1.1));
    k.add('cloth', new THREE.CylinderGeometry(0.06, 0.13, 0.32, 8), fur, T(0, -0.04, 0.24, Math.PI / 2 + 0.1, 0, 0)); // 口鼻
    k.sphere('iron', 0x151010, 0.04, 8, 6, T(0, -0.0, 0.41)); // 鼻頭
    for (const sx of [-1, 1]) {
      k.cone('cloth', back, 0.07, 0.2, 5, T(sx * 0.1, 0.2, -0.03, -0.2, 0, -sx * 0.25)); // 耳
      k.sphere('bronze', 0xd9a23a, 0.028, 8, 6, T(sx * 0.09, 0.06, 0.15)); // 眼
    }
  }, 6);
  const jaw = part(head, V(0, -0.1, 0.1), (k) => {
    k.add('cloth', new THREE.CylinderGeometry(0.04, 0.09, 0.26, 8), pale, T(0, -0.02, 0.14, Math.PI / 2 + 0.15, 0, 0));
    for (const sx of [-1, 1]) k.cone('stone', 0xeee6d0, 0.012, 0.05, 4, T(sx * 0.04, 0.03, 0.22));
  }, 7);
  const tail = part(body, V(0, 0.12, -0.62), (k) => {
    k.add('cloth', tubeGeo([V(0, 0, 0), V(0, -0.1, -0.2), V(0, -0.28, -0.42), V(0, -0.36, -0.6)], 0.08, 10, 6, 0.6), fur, null);
    k.sphere('cloth', back, 0.06, 6, 4, T(0, -0.36, -0.6));
  }, 8);
  // 腿：前腿直、後腿有反折的跗關節；大腿肌肉飽滿，小腿細長
  const legs = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const rear = sz < 0;
    const thigh = part(body, V(sx * 0.16, -0.04, rear ? -0.36 : 0.3), (k) => {
      k.sphere('cloth', fur, 0.1, 10, 8, T(0, -0.1, rear ? -0.02 : 0.01, 0, 0, 0, 0.85, rear ? 2.0 : 1.6, rear ? 1.5 : 1.1)); // 肌肉
      k.add('cloth', new THREE.CylinderGeometry(0.055, 0.042, 0.3, 8), fur, T(0, -0.22, 0));
    }, 11);
    const shin = part(thigh, V(0, -0.36, 0), (k) => {
      k.add('cloth', new THREE.CylinderGeometry(0.04, 0.03, 0.34, 7), rear ? back : fur, T(0, -0.17, 0));
      k.sphere('cloth', back, 0.045, 8, 6, T(0, -0.36, 0.04, 0, 0, 0, 1.1, 0.55, 1.6)); // 掌
      for (const dx of [-0.025, 0, 0.025]) k.cone('stone', 0x2a201a, 0.008, 0.035, 4, T(dx, -0.375, 0.11, Math.PI / 2, 0, 0)); // 爪
    }, 12);
    legs.push({ thigh, shin, rear });
  }
  let gait = 0;
  return {
    root, headY: 1.35, radius: 0.9,
    update(dt, t, st) {
      const run = Math.min(1, st.speed / 3);
      gait += dt * (3 + st.speed * 2.8);
      legs.forEach((L, i) => {
        const ph = gait + (i === 0 || i === 3 ? 0 : Math.PI);
        const base = L.rear ? -0.3 : 0.02; // 後腿大腿前傾、跗關節往後折
        L.thigh.rotation.x = base + Math.sin(ph) * 0.6 * run;
        L.shin.rotation.x = (L.rear ? 0.6 : -0.04) + (Math.sin(ph + 1.2) * 0.5 - 0.2) * run;
      });
      body.position.y = 0.78 + Math.abs(Math.sin(gait)) * 0.05 * run + Math.sin(t * 2) * 0.008;
      const a = st.attack;
      neck.rotation.x = a > 0 ? Math.sin(a * Math.PI) * 0.5 : Math.sin(t * 1.5) * 0.05 + 0.1;
      body.position.z = a > 0 ? Math.sin(a * Math.PI) * 0.35 : 0;
      jaw.rotation.x = a > 0 ? Math.sin(a * Math.PI) * 0.7 : 0.05 + Math.max(0, Math.sin(t * 3)) * 0.12 * (1 - run);
      tail.rotation.y = Math.sin(t * (2 + run * 6)) * 0.3;
      tail.rotation.x = -0.25 + run * 0.35;
      root.rotation.z = st.stagger ? Math.sin(t * 30) * 0.06 : 0;
    },
  };
}

function buildLizard(ent) {
  const root = new THREE.Group();
  const hide = 0x8a6a4a, plate = 0x6a5a48, belly = 0xc0a07a;
  const body = new THREE.Group();
  body.position.y = 0.42;
  root.add(body);
  const R = rng(55);
  const torso = part(body, V(0, 0, 0), (k) => {
    k.sphere('stone', hide, 0.36, 14, 10, T(0, 0, 0, 0, 0, 0, 1.1, 0.6, 1.75));
    k.sphere('stone', belly, 0.3, 12, 8, T(0, -0.08, 0, 0, 0, 0, 0.95, 0.4, 1.55));
    // 背上風蝕岩板：一排排斜立的岩片
    for (let i = 0; i < 9; i++) {
      const z = -0.45 + i * 0.12;
      for (const sx of [-1, 0, 1]) {
        if (sx === 0 && i % 2) continue;
        k.add('stone', lumpGeo(0.09 + R() * 0.04, 0, 0.35, i * 3 + sx), sx ? plate : 0x7c6a52, T(sx * 0.15, 0.2 + (sx ? -0.02 : 0.05), z, 0.3, 0, sx * 0.4, 1, 1.4, 0.8));
      }
    }
  }, 4);
  const neck = new THREE.Group();
  neck.position.set(0, 0.04, 0.55);
  body.add(neck);
  const head = part(neck, V(0, 0, 0.18), (k) => {
    k.sphere('stone', hide, 0.18, 12, 8, T(0, 0, 0.05, 0, 0, 0, 1, 0.55, 1.5));
    k.add('stone', lumpGeo(0.07, 0, 0.3, 5), plate, T(0, 0.1, -0.02, 0, 0, 0, 1.2, 0.8, 1));
    for (const sx of [-1, 1]) {
      k.sphere('bronze', 0xe0b040, 0.03, 8, 6, T(sx * 0.12, 0.06, 0.06));
      k.add('stone', lumpGeo(0.05, 0, 0.3, 9 + sx), plate, T(sx * 0.14, 0.08, 0.0));
    }
  }, 6);
  const jaw = part(head, V(0, -0.05, 0.02), (k) => k.sphere('stone', belly, 0.15, 10, 6, T(0, -0.02, 0.12, 0, 0, 0, 0.9, 0.3, 1.3)), 7);
  // 尾巴：四節，左右擺
  const tailSegs = [];
  let parent = body, pivot = V(0, 0, -0.55);
  for (let i = 0; i < 5; i++) {
    const r = 0.17 * (1 - i * 0.17);
    const seg = part(parent, pivot, (k) => {
      k.sphere('stone', hide, r, 10, 8, T(0, 0, -0.17, 0, 0, 0, 1, 0.7, 1.7));
      k.add('stone', lumpGeo(r * 0.45, 0, 0.3, 20 + i), plate, T(0, r * 0.6, -0.17));
    }, 10 + i);
    tailSegs.push(seg);
    parent = seg;
    pivot = V(0, 0, -0.32);
  }
  const legs = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const g = part(body, V(sx * 0.28, -0.04, sz * 0.36), (k) => {
      k.add('stone', new THREE.CapsuleGeometry(0.09, 0.16, 3, 6), hide, T(sx * 0.1, -0.05, 0, 0, 0, sx * 1.1));
      k.add('stone', new THREE.CapsuleGeometry(0.075, 0.18, 3, 6), hide, T(sx * 0.2, -0.2, 0.04, 0.2, 0, sx * 0.15));
      for (let f = -1; f <= 1; f++) k.cone('stone', 0x3a2e22, 0.025, 0.1, 4, T(sx * 0.21 + f * 0.045, -0.33, 0.12, Math.PI / 2, 0, 0));
    }, 30 + legs.length);
    legs.push(g);
  }
  let gait = 0;
  return {
    root, headY: 1.0, radius: 1.0,
    update(dt, t, st) {
      const run = Math.min(1, st.speed / 2.5);
      gait += dt * (2 + st.speed * 3);
      const wav = Math.sin(gait) * 0.25 * run + Math.sin(t * 1.2) * 0.05;
      torso.rotation.y = wav * 0.4;
      neck.rotation.y = -wav * 0.8;
      tailSegs.forEach((s, i) => { s.rotation.y = Math.sin(gait - i * 0.7) * (0.18 + i * 0.05) * (run + 0.2); });
      legs.forEach((L, i) => {
        const ph = gait + (i === 0 || i === 3 ? 0 : Math.PI);
        L.rotation.y = Math.sin(ph) * 0.5 * run;
        L.position.y = -0.04 + Math.max(0, Math.sin(ph)) * 0.06 * run;
      });
      const a = st.attack;
      jaw.rotation.x = a > 0 ? Math.sin(a * Math.PI) * 0.8 : 0;
      neck.rotation.x = a > 0 ? -Math.sin(a * Math.PI) * 0.3 : Math.sin(t * 0.7) * 0.05;
      body.position.z = a > 0 ? Math.sin(a * Math.PI) * 0.3 : 0;
      root.rotation.z = st.stagger ? Math.sin(t * 30) * 0.06 : 0;
    },
  };
}

// ── 夯土石偶 ──
function buildGolem(ent) {
  const root = new THREE.Group();
  const earth = 0x9a7650, earthDk = 0x7a5a3a, beam = 0x4a3524, rope = 0xb59a6a;
  const hips = new THREE.Group();
  hips.position.y = 1.15;
  root.add(hips);
  const torso = part(hips, V(0, 0.1, 0), (k) => {
    // 一層層夯土塊疊成的胸腹
    for (let i = 0; i < 5; i++) {
      const w = 0.95 - Math.abs(i - 3) * 0.08, y = i * 0.2;
      k.add('earth', blockGeo(w, 0.22, 0.62 - Math.abs(i - 3) * 0.04, 40 + i, 0.06, 0.28), i % 2 ? earth : earthDk, T(0, y + 0.1, 0, 0, (i % 2 - 0.5) * 0.06, 0));
    }
    // 木樑與麻繩綑紮
    for (const sx of [-1, 1]) k.box('wood', beam, 0.1, 1.1, 0.1, T(sx * 0.45, 0.5, 0.3, 0, 0, sx * -0.05));
    k.box('wood', beam, 1.1, 0.1, 0.1, T(0, 0.85, 0.33));
    for (const y of [0.3, 0.7]) k.box('cloth', rope, 1.0, 0.04, 0.66, T(0, y, 0));
    // 夯土裡夾的碎石與裂縫，頂上長出的枯草
    const Rg = rng(77);
    for (let i = 0; i < 14; i++) {
      const y = 0.1 + Rg() * 0.85, a = Rg() * Math.PI * 2;
      k.add('stone', lumpGeo(0.035 + Rg() * 0.03, 0, 0.3, 100 + i), 0x8a8070, T(Math.sin(a) * 0.46, y, Math.cos(a) * 0.3));
    }
    for (let i = 0; i < 9; i++) k.cone('reed', 0x9a8a50, 0.012, 0.18 + Rg() * 0.1, 3, T((Rg() - 0.5) * 0.7, 1.0, (Rg() - 0.5) * 0.4, (Rg() - 0.5) * 0.6, 0, (Rg() - 0.5) * 0.6));
    // 胸口貼的符布（黃麻紙）
    k.box('paper', 0x7a5a20, 0.2, 0.32, 0.01, T(0.1, 0.55, 0.335, 0, 0, 0.08));
  }, 5);
  const head = part(torso, V(0, 1.05, 0.02), (k) => {
    k.add('earth', blockGeo(0.46, 0.4, 0.44, 50, 0.06, 0.25), earth, T(0, 0.2, 0));
    k.box('wood', beam, 0.52, 0.06, 0.06, T(0, 0.3, 0.23));
    for (const sx of [-1, 1]) k.box('glow', 0xff8a3a, 0.11, 0.035, 0.02, T(sx * 0.1, 0.2, 0.225));
    k.box('earth', earthDk, 0.2, 0.06, 0.04, T(0, 0.06, 0.22));
  }, 6);
  const arms = [];
  for (const sx of [-1, 1]) {
    const sh = part(torso, V(sx * 0.62, 0.85, 0), (k) => {
      k.add('earth', lumpGeo(0.24, 1, 0.12, 3), earth, T(0, 0, 0, 0, 0, 0, 1.2, 0.9, 1));
      for (let i = 0; i < 3; i++) k.add('earth', blockGeo(0.27, 0.25, 0.27, 60 + i, 0.07, 0.3), i % 2 ? earthDk : earth, T(sx * 0.03, -0.26 - i * 0.24, 0, 0, i * 0.3, 0));
      k.box('cloth', rope, 0.3, 0.04, 0.3, T(sx * 0.03, -0.5, 0));
    }, 7);
    const fore = part(sh, V(sx * 0.03, -0.9, 0), (k) => {
      k.add('earth', blockGeo(0.3, 0.42, 0.3, 70 + sx, 0.07, 0.3), earth, T(0, -0.2, 0));
      k.add('stone', lumpGeo(0.24, 1, 0.2, 8 + sx), 0x7f7466, T(0, -0.52, 0.02, 0, 0, 0, 1, 0.9, 1.1)); // 石拳
    }, 8);
    arms.push({ sh, fore });
  }
  const legs = [];
  for (const sx of [-1, 1]) {
    const th = part(hips, V(sx * 0.28, 0, 0), (k) => {
      k.add('earth', blockGeo(0.36, 0.6, 0.38, 80 + sx, 0.06, 0.28), earthDk, T(0, -0.3, 0));
    }, 9);
    const sn = part(th, V(0, -0.6, 0), (k) => {
      k.add('earth', blockGeo(0.34, 0.5, 0.36, 90 + sx, 0.06, 0.28), earth, T(0, -0.26, 0));
      k.add('stone', lumpGeo(0.2, 0, 0.2, 12), 0x75695a, T(0, -0.5, 0.08, 0, 0, 0, 1.1, 0.5, 1.4));
    }, 10);
    legs.push({ th, sn });
  }
  let gait = 0;
  return {
    root, headY: 2.75, radius: 1.0,
    update(dt, t, st) {
      const walk = Math.min(1, st.speed / 2);
      gait += dt * (1.5 + st.speed * 1.8);
      legs.forEach((L, i) => {
        const ph = gait + i * Math.PI;
        L.th.rotation.x = Math.sin(ph) * 0.45 * walk;
        L.sn.rotation.x = Math.max(0, -Math.sin(ph + 0.6)) * 0.5 * walk;
      });
      hips.position.y = 1.15 - Math.abs(Math.sin(gait)) * 0.05 * walk;
      torso.rotation.z = Math.sin(gait) * 0.06 * walk;
      torso.rotation.y = Math.sin(t * 0.6) * 0.06;
      const a = st.attack;
      arms.forEach((A, i) => {
        const sx = i ? 1 : -1;
        A.sh.rotation.x = a > 0 ? -Math.sin(Math.min(1, a * 1.5) * Math.PI) * 2.2 : -Math.sin(gait + i * Math.PI) * 0.35 * walk;
        A.sh.rotation.z = sx * 0.12;
        A.fore.rotation.x = a > 0 ? -0.4 : -0.25;
      });
      head.rotation.y = Math.sin(t * 0.8) * 0.15;
      root.rotation.z = st.stagger ? Math.sin(t * 30) * 0.05 : 0;
    },
  };
}

// ── 機關傀儡（銅骨傀儡兵／遺墟守門偶） ──
function buildPuppetGuard(ent) {
  const warden = /守門/.test(ent.name || '') || ent.id === 'mob-yx-3';
  const s = warden ? 1.25 : 1.0;
  const root = new THREE.Group();
  const bronze = 0xc0904e, verd = 0x76a68c, wood = 0x7a5436, lac = 0x4a3226;
  const hips = new THREE.Group();
  hips.position.y = 1.0 * s;
  root.add(hips);
  const torso = part(hips, V(0, 0.08 * s, 0), (k) => {
    // 脊柱：一串銅節
    for (let i = 0; i < 6; i++) k.cyl('bronze', i % 2 ? bronze : verd, 0.06 * s, 0.07 * s, 0.1 * s, 8, T(0, i * 0.12 * s, -0.05 * s));
    // 肋籠：銅條弧
    for (let i = 0; i < 4; i++) {
      const y = 0.28 * s + i * 0.12 * s;
      k.torus('bronze', i % 2 ? bronze : 0x9c7a46, (0.26 - i * 0.012) * s, 0.016 * s, 5, 16, Math.PI * 1.5, T(0, y, 0, Math.PI / 2, 0, Math.PI * 0.25));
    }
    // 胸甲：漆木板＋銅鉚
    k.add('woodDark', new THREE.BoxGeometry(0.46 * s, 0.42 * s, 0.05 * s), lac, T(0, 0.55 * s, 0.24 * s, -0.08, 0, 0));
    for (const [x, y] of [[-0.18, 0.72], [0.18, 0.72], [-0.18, 0.38], [0.18, 0.38]]) k.sphere('bronze', bronze, 0.022 * s, 6, 4, T(x * s, y * s, 0.27 * s));
    k.box('glow', 0x4fe6a8, 0.08 * s, 0.08 * s, 0.02 * s, T(0, 0.55 * s, 0.275 * s, 0, 0, Math.PI / 4)); // 胸口樞芯
    // 腰裙：木片
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      k.box('wood', wood, 0.13 * s, 0.32 * s, 0.025 * s, T(Math.sin(a) * 0.22 * s, -0.08 * s, Math.cos(a) * 0.2 * s, 0.15, a, 0));
    }
    gearDisc(k, 'bronze', bronze, 0.12 * s, 0.05 * s, 10, T(0, -0.02 * s, 0.22 * s));
  }, 5);
  const head = part(torso, V(0, 0.82 * s, 0), (k) => {
    k.cyl('bronze', verd, 0.05 * s, 0.05 * s, 0.12 * s, 8, T(0, 0.05 * s, 0));
    // 銅面具：額飾、眉弓、長方形眼洞發光
    k.add('bronze', new THREE.SphereGeometry(0.16 * s, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), bronze, T(0, 0.22 * s, 0, 0, 0, 0, 1, 1.2, 1));
    k.box('bronze', 0x9c7a46, 0.3 * s, 0.24 * s, 0.04 * s, T(0, 0.2 * s, 0.13 * s));
    for (const sx of [-1, 1]) k.box('glow', 0x5af0b0, 0.07 * s, 0.025 * s, 0.01 * s, T(sx * 0.07 * s, 0.24 * s, 0.155 * s, 0, 0, sx * -0.15));
    k.box('bronze', 0x6c5230, 0.06 * s, 0.1 * s, 0.03 * s, T(0, 0.15 * s, 0.16 * s));
    k.cone('bronze', bronze, 0.04 * s, 0.22 * s, 4, T(0, 0.46 * s, -0.02 * s)); // 冠頂
    k.box('cloth', 0x7a2a20, 0.03 * s, 0.3 * s, 0.01 * s, T(0, 0.3 * s, -0.16 * s, 0.4, 0, 0)); // 紅纓
  }, 6);
  const arms = [];
  for (const sx of [-1, 1]) {
    const sh = part(torso, V(sx * 0.3 * s, 0.72 * s, 0), (k) => {
      gearDisc(k, 'bronze', bronze, 0.1 * s, 0.05 * s, 8, T(sx * 0.02 * s, 0, 0, 0, Math.PI / 2, 0));
      k.add('woodDark', new THREE.BoxGeometry(0.16 * s, 0.1 * s, 0.2 * s), lac, T(sx * 0.06 * s, 0.07 * s, 0)); // 肩甲
      k.cyl('bronze', verd, 0.035 * s, 0.03 * s, 0.36 * s, 6, T(sx * 0.04 * s, -0.2 * s, 0));
    }, 7);
    const fa = part(sh, V(sx * 0.04 * s, -0.38 * s, 0), (k) => {
      k.sphere('bronze', bronze, 0.045 * s, 8, 6, T(0, 0, 0));
      k.cyl('bronze', bronze, 0.03 * s, 0.026 * s, 0.32 * s, 6, T(0, -0.16 * s, 0.0));
      k.box('bronze', 0x6c5230, 0.08 * s, 0.1 * s, 0.06 * s, T(0, -0.36 * s, 0));
    }, 8);
    arms.push({ sh, fa });
  }
  // 兵器：銅骨傀儡兵拿戈，守門偶拿盾與錘
  if (warden) {
    part(arms[0].fa, V(-0.05 * s, -0.36 * s, 0.12 * s), (k) => {
      const sh = new THREE.Shape();
      sh.absarc(0, 0, 0.42 * s, 0, Math.PI * 2, false);
      k.extrude('woodDark', lac, sh, 0.06 * s, T(0, 0, 0, 0, 0, 0));
      gearDisc(k, 'bronze', bronze, 0.46 * s, 0.05 * s, 22, T(0, 0, 0.01));
      gearDisc(k, 'bronze', 0x9c7a46, 0.16 * s, 0.07 * s, 10, T(0, 0, 0.05 * s));
    }, 21).rotation.y = -1.2;
    part(arms[1].fa, V(0, -0.38 * s, 0.04 * s), (k) => {
      k.cyl('wood', wood, 0.03 * s, 0.03 * s, 1.0 * s, 6, T(0, 0, 0.3 * s, Math.PI / 2, 0, 0));
      k.add('bronze', lumpGeo(0.17 * s, 1, 0.08, 4), bronze, T(0, 0, 0.82 * s));
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; k.cone('bronze', verd, 0.05 * s, 0.14 * s, 4, T(Math.cos(a) * 0.17 * s, Math.sin(a) * 0.17 * s, 0.82 * s, 0, 0, a - Math.PI / 2)); }
    }, 22);
  } else {
    part(arms[1].fa, V(0, -0.38 * s, 0.04 * s), (k) => {
      k.cyl('wood', wood, 0.022, 0.022, 2.0, 6, T(0, 0.35, 0.05, 0.2, 0, 0));
      k.add('bronze', new THREE.BoxGeometry(0.04, 0.08, 0.42), bronze, T(0, 1.3, 0.33, 0.2, 0, 0)); // 戈頭
      k.cone('bronze', 0xb08d48, 0.04, 0.2, 4, T(0, 1.42, 0.08, 0.2, 0, 0));
      k.box('cloth', 0x8a2a1e, 0.06, 0.2, 0.02, T(0, 1.15, 0.0, 0.2, 0, 0));
    }, 23);
  }
  const legs = [];
  for (const sx of [-1, 1]) {
    const th = part(hips, V(sx * 0.14 * s, 0, 0), (k) => {
      gearDisc(k, 'bronze', bronze, 0.09 * s, 0.04 * s, 8, T(sx * 0.03 * s, 0, 0, 0, Math.PI / 2, 0));
      k.cyl('bronze', verd, 0.04 * s, 0.035 * s, 0.46 * s, 6, T(0, -0.25 * s, 0));
      k.add('woodDark', new THREE.BoxGeometry(0.14 * s, 0.3 * s, 0.05 * s), lac, T(0, -0.2 * s, 0.07 * s));
    }, 11);
    const sn = part(th, V(0, -0.5 * s, 0), (k) => {
      gearDisc(k, 'bronze', 0x9c7a46, 0.06 * s, 0.03 * s, 8, T(0, 0, 0, 0, Math.PI / 2, 0));
      k.cyl('bronze', bronze, 0.035 * s, 0.03 * s, 0.44 * s, 6, T(0, -0.23 * s, 0));
      k.box('bronze', 0x6c5230, 0.13 * s, 0.05 * s, 0.24 * s, T(0, -0.47 * s, 0.05 * s));
    }, 12);
    legs.push({ th, sn });
  }
  // 背上的發條小輪
  const wind = part(torso, V(0, 0.55 * s, -0.2 * s), (k) => {
    k.box('bronze', bronze, 0.03 * s, 0.03 * s, 0.12 * s, T(0, 0, -0.04 * s));
    for (const sx of [-1, 1]) k.sphere('bronze', 0x9c7a46, 0.05 * s, 8, 6, T(sx * 0.1 * s, 0, -0.1 * s, 0, 0, 0, 1.2, 0.6, 0.4));
    k.box('bronze', 0x9c7a46, 0.24 * s, 0.03 * s, 0.025 * s, T(0, 0, -0.1 * s));
  }, 13);
  let gait = 0;
  return {
    root, headY: 1.95 * s, radius: 0.8 * s,
    update(dt, t, st) {
      const walk = Math.min(1, st.speed / 2.2);
      gait += dt * (2 + st.speed * 2.4);
      // 機關步伐：以 step 量化，動作一頓一頓
      const q = (v) => Math.round(v * 4) / 4;
      legs.forEach((L, i) => {
        const ph = gait + i * Math.PI;
        L.th.rotation.x = q(Math.sin(ph) * 0.5 * walk);
        L.sn.rotation.x = q(Math.max(0, -Math.sin(ph + 0.6)) * 0.6 * walk);
      });
      hips.position.y = 1.0 * s + Math.sin(t * 2) * 0.01;
      wind.rotation.z = t * 2.5;
      const a = st.attack;
      arms.forEach((A, i) => {
        const sx = i ? 1 : -1;
        if (i === 1) A.sh.rotation.x = a > 0 ? -Math.sin(Math.min(1, a * 1.4) * Math.PI) * 1.6 : -0.3 - q(Math.sin(gait) * 0.2 * walk);
        else A.sh.rotation.x = warden ? -0.9 : -0.1 + q(Math.sin(gait) * 0.25 * walk);
        A.sh.rotation.z = sx * 0.08;
        A.fa.rotation.x = i === 1 ? -0.5 : (warden ? -0.6 : -0.2);
      });
      head.rotation.y = Math.sin(t * 0.9 + ent.spawnX) * 0.3;
      head.rotation.z = Math.sin(t * 7.3) * 0.015;
      root.rotation.z = st.stagger ? Math.sin(t * 30) * 0.06 : 0;
    },
  };
}

// ── 機樞術偶：獨輪底座、四臂托銅盤、背後一圈轉動的樞輪 ──
function buildPuppetCaster(ent) {
  const root = new THREE.Group();
  const bronze = 0xc0904e, verd = 0x76a68c, lac = 0x4a3226, silk = 0x45648c;
  const base = part(root, V(0, 0.3, 0), (k) => {
    gearDisc(k, 'bronze', bronze, 0.3, 0.12, 16, T(0, 0, 0, 0, Math.PI / 2, 0));
    k.cyl('bronze', verd, 0.06, 0.06, 0.4, 8, T(0, 0, 0, 0, 0, Math.PI / 2));
    k.box('bronze', bronze, 0.5, 0.05, 0.2, T(0, 0.3, 0));
    for (const sx of [-1, 1]) k.box('bronze', bronze, 0.04, 0.3, 0.06, T(sx * 0.22, 0.15, 0));
  }, 3);
  const body = new THREE.Group();
  body.position.y = 0.95;
  root.add(body);
  part(body, V(0, 0, 0), (k) => {
    // 長袍：靛藍絲，木片骨架
    k.cyl('cloth', silk, 0.2, 0.36, 0.7, 12, T(0, -0.05, 0), 0.02, true);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      k.box('woodDark', lac, 0.04, 0.7, 0.02, T(Math.sin(a) * 0.28, -0.05, Math.cos(a) * 0.28, 0, a, Math.cos(a) * 0.1));
    }
    k.sphere('bronze', bronze, 0.22, 12, 8, T(0, 0.38, 0, 0, 0, 0, 1.1, 0.8, 0.85));
    k.sphere('glow', 0x5af0b0, 0.07, 10, 8, T(0, 0.4, 0.17));
    gearDisc(k, 'bronze', 0x9c7a46, 0.14, 0.03, 12, T(0, 0.4, 0.15));
  }, 5);
  const head = part(body, V(0, 0.62, 0), (k) => {
    k.add('bronze', new THREE.SphereGeometry(0.14, 14, 10), bronze, T(0, 0.1, 0, 0, 0, 0, 0.9, 1.2, 0.9));
    // 三隻眼的面具
    for (const [x, y] of [[-0.05, 0.12], [0.05, 0.12], [0, 0.2]]) k.sphere('glow', 0x5af0b0, 0.022, 8, 6, T(x, y, 0.12));
    k.cyl('bronze', 0x9c7a46, 0.17, 0.12, 0.05, 12, T(0, 0.27, 0)); // 冠
    for (let i = 0; i < 5; i++) k.cone('bronze', bronze, 0.02, 0.1, 4, T(Math.cos(i * 1.26) * 0.12, 0.33, Math.sin(i * 1.26) * 0.12));
  }, 6);
  const arms = [];
  for (let i = 0; i < 4; i++) {
    const sx = i % 2 ? 1 : -1, up = i < 2;
    const sh = part(body, V(sx * 0.22, up ? 0.45 : 0.25, 0), (k) => {
      k.sphere('bronze', verd, 0.05, 8, 6);
      k.cyl('bronze', bronze, 0.025, 0.02, 0.38, 6, T(sx * 0.15, -0.08, 0.05, 0, 0, sx * 1.2));
      k.cyl('bronze', bronze, 0.02, 0.018, 0.3, 6, T(sx * 0.32, 0.05, 0.12, 0.6, 0, 0));
      // 托著的銅盤
      k.cyl('bronze', 0xb08d48, 0.13, 0.13, 0.015, 16, T(sx * 0.34, 0.22, 0.24, 0.5, 0, 0));
      k.sphere('glow', up ? 0x5af0b0 : 0xa8f0d0, 0.035, 8, 6, T(sx * 0.34, 0.26, 0.24));
    }, 10 + i);
    arms.push({ sh, sx, up });
  }
  const halo = part(body, V(0, 0.5, -0.3), (k) => {
    gearDisc(k, 'bronze', bronze, 0.62, 0.04, 36, T(0, 0, 0));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      k.box('bronze', verd, 0.03, 0.5, 0.02, T(Math.sin(a) * 0.25, Math.cos(a) * 0.25, 0, 0, 0, -a));
    }
  }, 20);
  const halo2 = part(body, V(0, 0.5, -0.36), (k) => gearDisc(k, 'bronze', 0x9c7a46, 0.32, 0.04, 18, T(0, 0, 0)), 21);
  return {
    root, headY: 2.0, radius: 0.85,
    update(dt, t, st) {
      body.position.y = 0.95 + Math.sin(t * 2.2 + ent.spawnX) * 0.05;
      base.rotation.x += dt * st.speed * 3;
      halo.rotation.z = t * 0.8;
      halo2.rotation.z = -t * 1.6;
      const a = st.attack;
      arms.forEach((A, i) => {
        A.sh.rotation.x = (a > 0 ? -Math.sin(a * Math.PI) * 1.2 : Math.sin(t * 1.6 + i) * 0.15) * (A.up ? 1 : 0.6);
        A.sh.rotation.z = A.sx * (Math.sin(t * 1.2 + i * 1.7) * 0.1);
      });
      head.rotation.y = Math.sin(t * 0.7) * 0.4;
      root.rotation.z = st.stagger ? Math.sin(t * 30) * 0.06 : 0;
    },
  };
}

// ── 偃師千機像：遺墟首領，四臂、背負千機輪，胸艙發光 ──
function buildWarden(ent) {
  const root = new THREE.Group();
  const bronze = 0xb8894c, verd = 0x6e9e84, dark = 0x54402e, stone = 0x7a7a70;
  const hips = new THREE.Group();
  hips.position.y = 1.7;
  root.add(hips);
  part(hips, V(0, 0, 0), (k) => {
    // 石座裙甲
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      k.add('stone', new THREE.BoxGeometry(0.34, 0.7, 0.08), i % 2 ? stone : 0x666158, T(Math.sin(a) * 0.55, -0.3, Math.cos(a) * 0.5, 0.18, a, 0));
    }
    k.cyl('bronze', bronze, 0.55, 0.6, 0.18, 16, T(0, 0.05, 0));
  }, 3);
  const torso = part(hips, V(0, 0.15, 0), (k) => {
    k.add('bronze', new THREE.CylinderGeometry(0.62, 0.45, 1.1, 10), bronze, T(0, 0.6, 0, 0, Math.PI / 10, 0, 1, 1, 0.75));
    // 胸艙：一圈齒框，中間冷綠核心
    gearDisc(k, 'bronze', 0xb08d48, 0.3, 0.08, 18, T(0, 0.75, 0.36));
    k.sphere('glow', 0x4ff0a8, 0.16, 14, 10, T(0, 0.75, 0.36));
    for (let i = 0; i < 4; i++) k.box('bronze', dark, 0.5, 0.05, 0.05, T(0, 0.3 + i * 0.1, 0.33, 0, 0, 0));
    // 肩甲（層疊銅片）
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) k.add('bronze', new THREE.SphereGeometry(0.34 - i * 0.05, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), i % 2 ? verd : bronze, T(sx * 0.68, 1.1 - i * 0.12, 0, 0, 0, -sx * 0.5));
  }, 5);
  const head = part(torso, V(0, 1.25, 0.05), (k) => {
    k.add('bronze', new THREE.BoxGeometry(0.42, 0.5, 0.38, 2, 2, 2), bronze, T(0, 0.25, 0));
    k.box('bronze', 0xb08d48, 0.5, 0.08, 0.42, T(0, 0.48, 0));
    // 面具：縱目
    for (const sx of [-1, 1]) {
      k.cyl('bronze', 0xb08d48, 0.06, 0.06, 0.16, 10, T(sx * 0.11, 0.3, 0.24, Math.PI / 2, 0, 0));
      k.sphere('glow', 0x4ff0a8, 0.045, 8, 6, T(sx * 0.11, 0.3, 0.33));
      k.box('bronze', bronze, 0.16, 0.42, 0.04, T(sx * 0.3, 0.32, 0.0, 0, 0, sx * -0.2)); // 大耳
    }
    k.box('bronze', dark, 0.2, 0.04, 0.02, T(0, 0.12, 0.2));
    gearDisc(k, 'bronze', verd, 0.22, 0.04, 14, T(0, 0.7, -0.05));
  }, 6);
  const arms = [];
  for (let i = 0; i < 4; i++) {
    const sx = i % 2 ? 1 : -1, up = i < 2;
    const sh = part(torso, V(sx * 0.72, up ? 1.0 : 0.55, 0), (k) => {
      gearDisc(k, 'bronze', bronze, 0.16, 0.08, 12, T(0, 0, 0, 0, Math.PI / 2, 0));
      k.cyl('bronze', verd, 0.09, 0.08, 0.7, 8, T(sx * 0.1, -0.38, 0, 0, 0, sx * 0.25));
    }, 10 + i);
    const fa = part(sh, V(sx * 0.2, -0.72, 0), (k) => {
      k.sphere('bronze', bronze, 0.1, 10, 8);
      k.cyl('bronze', bronze, 0.08, 0.1, 0.6, 8, T(0, -0.3, 0.05));
      // 手：銅掌＋三指
      k.add('bronze', new THREE.BoxGeometry(0.2, 0.18, 0.12), 0xb08d48, T(0, -0.66, 0.06));
      for (let f = -1; f <= 1; f++) k.cyl('bronze', bronze, 0.025, 0.02, 0.18, 6, T(f * 0.06, -0.82, 0.08, 0.2, 0, 0));
    }, 20 + i);
    arms.push({ sh, fa, sx, up });
  }
  // 背負千機輪：大小三圈齒輪
  const wheels = [];
  [[1.15, 40, 0, 1.3, -0.55], [0.6, 22, -0.75, 1.9, -0.65], [0.5, 18, 0.8, 1.85, -0.62]].forEach(([r, n, x, y, z], i) => {
    const w = part(torso, V(x, y, z), (k) => {
      gearDisc(k, 'bronze', i ? verd : bronze, r, 0.08, n, T(0, 0, 0));
      for (let j = 0; j < 6; j++) { const a = (j / 6) * Math.PI * 2; k.box('bronze', dark, 0.05, r * 0.8, 0.04, T(Math.sin(a) * r * 0.4, Math.cos(a) * r * 0.4, 0, 0, 0, -a)); }
    }, 30 + i);
    wheels.push(w);
  });
  const legs = [];
  for (const sx of [-1, 1]) {
    const th = part(hips, V(sx * 0.32, -0.1, 0), (k) => {
      k.add('stone', new THREE.CylinderGeometry(0.2, 0.17, 0.85, 10), stone, T(0, -0.42, 0));
      gearDisc(k, 'bronze', bronze, 0.14, 0.06, 10, T(sx * 0.12, 0, 0, 0, Math.PI / 2, 0));
    }, 40);
    const sn = part(th, V(0, -0.85, 0), (k) => {
      k.add('bronze', new THREE.CylinderGeometry(0.17, 0.22, 0.75, 10), bronze, T(0, -0.38, 0));
      k.add('stone', new THREE.BoxGeometry(0.42, 0.14, 0.6), stone, T(0, -0.78, 0.1));
    }, 41);
    legs.push({ th, sn });
  }
  let gait = 0;
  return {
    root, headY: 4.1, radius: 1.7,
    update(dt, t, st) {
      const walk = Math.min(1, st.speed / 2);
      gait += dt * (1.2 + st.speed * 1.4);
      legs.forEach((L, i) => {
        const ph = gait + i * Math.PI;
        L.th.rotation.x = Math.sin(ph) * 0.35 * walk;
        L.sn.rotation.x = Math.max(0, -Math.sin(ph + 0.6)) * 0.4 * walk;
      });
      hips.position.y = 1.7 + Math.sin(t * 1.3) * 0.02;
      wheels[0].rotation.z = t * 0.35;
      wheels[1].rotation.z = -t * 0.66;
      wheels[2].rotation.z = -t * 0.8;
      const a = st.attack;
      arms.forEach((A, i) => {
        const idle = Math.sin(t * 0.9 + i * 1.3) * 0.12;
        A.sh.rotation.x = a > 0 && A.up ? -Math.sin(Math.min(1, a * 1.3) * Math.PI) * 2.0 : (A.up ? -0.25 : -0.6) + idle;
        A.sh.rotation.z = A.sx * (A.up ? 0.35 : 0.15);
        A.fa.rotation.x = A.up ? -0.6 : -0.9;
      });
      head.rotation.y = Math.sin(t * 0.5) * 0.25;
      root.rotation.z = st.stagger ? Math.sin(t * 30) * 0.03 : 0;
    },
  };
}

// ── 練功樁（三臂一腿的木樁），銅皮款包銅箍 ──
function buildDummy(ent) {
  const brass = ent.id === 'dummy-2' || /銅皮/.test(ent.name || '');
  const root = new THREE.Group();
  const wood = brass ? 0x6a4a2c : 0x8a6038;
  part(root, V(0, 0, 0), (k) => {
    // 底座架：兩根立柱＋兩根橫木，樁身用彈性橫樑架著
    for (const sx of [-1, 1]) {
      k.box('wood', 0x5a4028, 0.12, 2.1, 0.12, T(sx * 0.62, 1.05, -0.2));
      k.box('wood', 0x5a4028, 0.12, 0.1, 0.7, T(sx * 0.62, 0.05, -0.05));
    }
    k.box('wood', 0x5a4028, 1.36, 0.1, 0.1, T(0, 1.85, -0.2));
    k.box('wood', 0x5a4028, 1.36, 0.1, 0.1, T(0, 0.55, -0.2));
    k.box('stone', 0x6e6a60, 1.6, 0.06, 1.0, T(0, 0.03, -0.05));
  }, 3);
  const post = part(root, V(0, 0.55, 0), (k) => {
    k.cyl('wood', wood, 0.17, 0.18, 1.55, 14, T(0, 0.72, 0));
    k.sphere('wood', wood, 0.17, 14, 6, T(0, 1.5, 0, 0, 0, 0, 1, 0.4, 1));
    // 三臂（上兩、中一）與一條腿
    for (const sx of [-1, 1]) k.cyl('wood', 0x7a5432, 0.035, 0.04, 0.48, 8, T(sx * 0.1, 1.2, 0.3, Math.PI / 2 - 0.12, sx * 0.25, 0));
    k.cyl('wood', 0x7a5432, 0.04, 0.045, 0.45, 8, T(0, 0.92, 0.3, Math.PI / 2 + 0.15, 0, 0));
    k.add('wood', tubeGeo([V(0, 0.4, 0.12), V(0.05, 0.3, 0.38), V(0.1, 0.05, 0.42)], 0.05, 8, 6), 0x7a5432, null);
    k.box('wood', 0x3a2818, 0.05, 0.05, 0.3, T(0, 1.55, -0.2)); // 樑接頭
    if (brass) for (const y of [0.15, 0.6, 1.05, 1.4]) k.cyl('bronze', 0xb08d48, 0.185, 0.185, 0.06, 16, T(0, y, 0));
    else for (const y of [0.3, 1.3]) k.cyl('cloth', 0xd9c9a4, 0.182, 0.182, 0.14, 14, T(0, y, 0)); // 纏布
    // 朱砂打點記號
    k.box('paper', 0x8a2418, 0.08, 0.08, 0.01, T(0, 1.05, 0.18));
  }, 5);
  let prevHp = 1, wob = 0;
  return {
    root, headY: 2.45, radius: 0.8,
    update(dt, t, st) {
      if (st.hp < prevHp - 1e-4 || st.shield < (this._ps ?? 1) - 1e-4) wob = 1;
      prevHp = st.hp;
      this._ps = st.shield;
      wob = Math.max(0, wob - dt * 1.6);
      post.rotation.x = Math.sin(t * 22) * 0.06 * wob;
      post.rotation.z = Math.sin(t * 17) * 0.04 * wob;
    },
  };
}

export function buildCreature(ent) {
  if (ent.kind === 'DUMMY') return buildDummy(ent);
  switch (ent.subKind) {
    case 'toad':
    case 'bigtoad': return buildToad(ent);
    case 'thornvine': return buildThornvine(ent);
    case 'snail': return buildSnail(ent);
    case 'sandwolf': return buildWolf(ent);
    case 'rocklizard': return buildLizard(ent);
    case 'golem': return buildGolem(ent);
    case 'puppet_guard': return buildPuppetGuard(ent);
    case 'puppet_caster': return buildPuppetCaster(ent);
    case 'warden': return buildWarden(ent);
    default: return buildGolem(ent);
  }
}
