// 關卡共用工具：雜訊、斧劈岩塊與石柱幾何、雕琢山石群、古典飛簷屋頂、黃山迎客松、精雕石燈籠、梵鐘亭、鳥居、關卡建構器。
// 座標：y 朝上，玩家往 −z 前進。崖體底部在 y=B（沉在雲海或水面下）。
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { World } from './physics.js';
import { PAL, inkMaterial, outlineMaterial, dripMaterial } from './ink.js';

export const B = -60;

// ---------- 雜訊 ----------
function hash3(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function vnoise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(ix + dx, iy + dy, iz + dz);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), sx), L(c(0, 1, 0), c(1, 1, 0), sx), sy), L(L(c(0, 0, 1), c(1, 0, 1), sx), L(c(0, 1, 1), c(1, 1, 1), sx), sy), sz);
}
export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9 >>> 0) / 4294967296); }

/** 岩塊：分段的盒子，側面疊加粗細兩層 3D 雜訊與斧劈折面（同位置同位移，無裂縫），頂面保持平 */
export function rockGeo(x0, y0, z0, x1, y1, z1, { jitter = 0.18, seg = 1.15, freq = 0.45, lumpy = 0 } = {}) {
  const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
  const nx = Math.max(1, Math.round(sx / seg));
  const ny = Math.max(1, Math.min(36, Math.round(sy / Math.max(seg, 1.5))));
  const nz = Math.max(1, Math.round(sz / seg));
  const g = new THREE.BoxGeometry(sx, sy, sz, nx, ny, nz);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const nearTop = Math.min(1, Math.max(0, (y1 - y) / 0.55));
    const j = jitter * (0.18 + 0.82 * nearTop);
    const n1x = vnoise3(x * freq, y * freq * 0.48, z * freq) - 0.5;
    const n1z = vnoise3(x * freq + 31, y * freq * 0.48 + 7, z * freq - 13) - 0.5;
    // 細層岩石節理折面（斧劈稜角感）
    const ridgeX = (Math.abs(vnoise3(x * freq * 2.3 + 5, y * freq * 0.9, z * freq * 2.3) - 0.5) - 0.25) * 0.7;
    const ridgeZ = (Math.abs(vnoise3(x * freq * 2.3 - 11, y * freq * 0.9 + 3, z * freq * 2.3 + 9) - 0.5) - 0.25) * 0.7;
    const dx = (n1x * 1.75 + ridgeX * 0.55) * j;
    const dz = (n1z * 1.75 + ridgeZ * 0.55) * j;
    const dy = lumpy ? (vnoise3(x * freq - 5, y * freq, z * freq + 3) - 0.5) * 2 * lumpy * (y > y1 - 0.01 ? 1 : 0.3) : 0;
    p.setXYZ(i, x + dx, y + dy, z + dz);
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  g.setAttribute('aTop', new THREE.BufferAttribute(new Float32Array(p.count).fill(y1), 1));
  return g;
}

/** 踏石／石筍圓柱：帶岩層節理與頂緣自然倒角，頂面保持精確平坦供落腳 */
export function cylGeo(x, z, r, y0, y1, { jitter = 0.14, seg = 24 } = {}) {
  const h = y1 - y0;
  const ny = Math.max(2, Math.min(48, Math.round(h / 1.25)));
  const g = new THREE.CylinderGeometry(r, r * 1.09, h, seg, ny);
  g.translate(x, y0 + h / 2, z);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const X = p.getX(i), Y = p.getY(i), Z = p.getZ(i);
    if (Y > y1 - 0.01) continue;
    const rad = Math.hypot(X - x, Z - z);
    if (rad < 1e-4) continue;
    const strata = (vnoise3(x * 0.2, Y * 1.35, z * 0.2) - 0.5) * 0.06;
    const facet = (vnoise3(X * 0.95, Y * 0.36, Z * 0.95) - 0.5) * 2 * jitter / r;
    const k = 1 + facet + strata;
    p.setXYZ(i, x + (X - x) * k, Y, z + (Z - z) * k);
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  g.setAttribute('aTop', new THREE.BufferAttribute(new Float32Array(p.count).fill(y1), 1));
  return g;
}

/** 皴法山石（共享頂點平滑法線＋層理折帶切面，帶 aTop 可直接併入 rockGeos，告別低面數高爾夫球感） */
export function boulderGeo(cx, cy, cz, rx, ry, rz, seed = 1) {
  const ico = new THREE.IcosahedronGeometry(1, 3);
  ico.deleteAttribute('uv'); ico.deleteAttribute('normal'); // 岩體不帶 uv，否則合併失敗；只留位置才併得起來
  const g = mergeVertices(ico);
  const p = g.attributes.position;
  const ox = (seed * 1.73) % 53, oy = (seed * 2.91) % 47, oz = (seed * 4.19) % 61;
  let maxY = -Infinity;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // 底部壓平嵌入地面，頂部微收成自然石脊台面（折帶皴）
    if (y < -0.2) y = -0.2 + (y + 0.2) * 0.35;
    if (y > 0.55) y = 0.55 + (y - 0.55) * 0.45;
    const n1 = vnoise3(x * 1.35 + ox, y * 1.6 + oy, z * 1.35 + oz) - 0.5;
    const strata = Math.sin(y * 5.2 + n1 * 2.2) * 0.06;
    const ridge = (1 - Math.abs(vnoise3(x * 2.3 - oz, y * 1.9 + ox, z * 2.3 + oy) * 2 - 1)) * 0.16;
    const k = 0.86 + n1 * 0.38 + strata + ridge;
    const wx = cx + x * rx * k, wy = cy + y * ry * (0.88 + n1 * 0.25), wz = cz + z * rz * k;
    if (wy > maxY) maxY = wy;
    p.setXYZ(i, wx, wy, wz);
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  g.setAttribute('aTop', new THREE.BufferAttribute(new Float32Array(p.count).fill(maxY), 1));
  return g;
}

/** 四坡飛簷翹角屋頂（反宇凹曲坡面＋筒瓦溝壟＋四角起翹，供石燈籠、寶塔、神龕使用） */
export function hipRoofGeo(w, d, h, lift = 0.16, thick = 0.08, seg = 16) {
  const g = new THREE.BoxGeometry(w, thick, d, seg, 1, seg);
  const p = g.attributes.position;
  const ribFreq = Math.max(12, Math.round(w * 9));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const nx = Math.abs(x) / (w / 2), nz = Math.abs(z) / (d / 2);
    const r = Math.max(nx, nz), corner = nx * nz;
    const arch = h * Math.pow(Math.max(0, 1 - r), 1.38) + lift * Math.pow(corner, 1.7);
    const along = Math.abs(nx) > Math.abs(nz) ? z / (d / 2) : x / (w / 2);
    const tileRib = y > 0 && r > 0.12 ? Math.sin(along * ribFreq * Math.PI) * 0.014 * Math.min(1, r * 1.4) : 0;
    const taper = y > 0 ? 1 : 0.72 + 0.28 * r;
    p.setY(i, y * taper + arch + tileRib);
  }
  g.computeVertexNormals();
  return g;
}

/** 雙坡懸山／歇山飛簷瓦頂（含筒瓦瓦壟起伏，供鐘亭、山門城樓、圍牆壓簷使用） */
export function gableRoofGeo(w, d, rise, thick = 0.09, lift = 0.14, segX = 24, segZ = 12) {
  const g = new THREE.BoxGeometry(w, thick, d, segX, 1, segZ);
  const p = g.attributes.position;
  const nTiles = Math.max(8, Math.round(w * 4.5));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const nx = Math.abs(x) / (w / 2), nz = Math.abs(z) / (d / 2);
    const arch = rise * Math.pow(Math.max(0, 1 - nz), 1.32) + lift * Math.pow(nx, 2.3) * (0.35 + 0.65 * nz);
    const tileRib = y > 0 && nz > 0.08 ? Math.cos((x / w) * nTiles * Math.PI * 2) * 0.016 : 0;
    p.setY(i, y + arch + tileRib);
  }
  g.computeVertexNormals();
  return g;
}

/** 漸縮扭曲樹幹／枝幹管狀幾何（根部外張、樹皮縱稜、枝梢收細） */
function taperTubeGeo(curve, tubSeg, r0, r1, radSeg = 7, bark = 0.12, flare = false) {
  const g = new THREE.TubeGeometry(curve, tubSeg, 1, radSeg, false);
  const p = g.attributes.position;
  const ring = radSeg + 1;
  const c = new THREE.Vector3();
  for (let i = 0; i <= tubSeg; i++) {
    const t = i / tubSeg;
    curve.getPointAt(t, c);
    const baseR = r0 * (1 - t) + r1 * t;
    const rootK = flare && t < 0.2 ? 1 + Math.pow(1 - t / 0.2, 2) * 0.52 : 1;
    for (let j = 0; j < ring; j++) {
      const idx = i * ring + j;
      const ang = (j / radSeg) * Math.PI * 2;
      const ridge = 1 + bark * Math.sin(ang * 3 + t * 10.5);
      const r = baseR * rootK * ridge;
      p.setXYZ(idx, c.x + (p.getX(idx) - c.x) * r, c.y + (p.getY(idx) - c.y) * r, c.z + (p.getZ(idx) - c.z) * r);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** 黃山松針葉團幾何：合併共享頂點確保描線外殼無裂縫，底平頂拱、邊緣呈攢針點葉團塊 */
function pinePadGeo(seed, sx, sy, sz, detail = 2) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, detail));
  const p = g.attributes.position;
  const ox = (seed * 3.17) % 41, oz = (seed * 5.09) % 37;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const tuft = vnoise3(x * 2.2 + ox, y * 2.0, z * 2.2 + oz);
    const fine = vnoise3(x * 4.5 - oz, y * 3.5 + ox, z * 4.5) - 0.5;
    const r = 0.80 + tuft * 0.38 + fine * 0.10;
    const yf = y < 0 ? y * 0.46 : Math.pow(y, 0.85) * 1.14;
    p.setXYZ(i, x * sx * r, (yf + (tuft - 0.5) * 0.18) * sy, z * sz * r);
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

// ---------- 道具 ----------
export function withOutline(mesh, w = 0.024) {
  const o = new THREE.Mesh(mesh.geometry, outlineMaterial(w));
  o.position.copy(mesh.position); o.rotation.copy(mesh.rotation); o.scale.copy(mesh.scale);
  o.castShadow = false; o.receiveShadow = false; o.userData.isOutline = true;
  return o;
}

export function makePine(seed, s = 1, snow = 0, far = false) {
  const R = rng(seed);
  const g = new THREE.Group();
  const trunkMat = inkMaterial({ color: 0x3b332c, streak: 0.65, wash: 0.7, crack: 0.25, ...(snow ? { snow: snow * 0.35 } : {}) });
  const leafMat = inkMaterial({ color: PAL.pine, wash: 1.0, grain: 1, topLight: 0.45, ...(snow ? { snow } : {}) });
  const leafHiMat = inkMaterial({ color: 0x2d3a32, wash: 0.95, grain: 1, topLight: 0.55, ...(snow ? { snow } : {}) });

  // 蒼勁曲折主幹（先微傾再橫展昂首）
  const leanX = (R() - 0.5) * 1.55, leanZ = (R() - 0.5) * 1.1;
  const pts = [];
  let x = 0, z = 0;
  for (let i = 0; i < 7; i++) {
    pts.push(new THREE.Vector3(x, i * 0.64 * s, z));
    const k = i < 3 ? 0.22 : 0.34;
    x += ((R() - 0.5) * 0.62 + leanX * k) * s;
    z += ((R() - 0.5) * 0.48 + leanZ * k * 0.7) * s;
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const trunk = new THREE.Mesh(taperTubeGeo(curve, far ? 10 : 22, 0.165 * s, 0.038 * s, far ? 5 : 7, 0.14, true), trunkMat);
  g.add(trunk);
  if (!far) g.add(withOutline(trunk, 0.018 * s));

  // 盤根：三道抓石露根
  if (!far) {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + R() * 0.9;
      const rCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * 0.06 * s, 0.24 * s, Math.sin(a) * 0.06 * s),
        new THREE.Vector3(Math.cos(a) * 0.28 * s, 0.07 * s, Math.sin(a) * 0.28 * s),
        new THREE.Vector3(Math.cos(a + 0.25) * 0.52 * s, -0.04 * s, Math.sin(a + 0.25) * 0.52 * s),
      ]);
      const rootM = new THREE.Mesh(taperTubeGeo(rCurve, 7, 0.075 * s, 0.018 * s, 5, 0.1), trunkMat);
      g.add(rootM);
    }
  }

  // 分層虬枝與攢針松葉團（每枝托起 2～3 疊高低錯落的扁松墊）
  const nBr = far ? 4 : 6 + Math.floor(R() * 3);
  const addPadCluster = (center, w, seedBase) => {
    const sub = far ? 1 : 3;
    for (let j = 0; j < sub; j++) {
      const ox = j === 0 ? 0 : (R() - 0.5) * w * 0.95;
      const oz = j === 0 ? 0 : (R() - 0.5) * w * 0.85;
      const oy = j === 0 ? 0.03 * s : (j === 1 ? 0.11 : -0.05) * s;
      const sc = j === 0 ? w : w * (0.58 + R() * 0.25);
      const pg = pinePadGeo(seedBase + j * 13, sc * 1.28, sc * 0.27, sc * 1.02, far ? 1 : 2);
      const pad = new THREE.Mesh(pg, j === 1 ? leafHiMat : leafMat);
      pad.position.set(center.x + ox, center.y + oy, center.z + oz);
      pad.rotation.y = R() * Math.PI * 2;
      g.add(pad);
      if (!far) g.add(withOutline(pad, 0.022 * Math.max(0.8, s * 0.75)));
    }
  };

  for (let i = 0; i < nBr; i++) {
    const t = 0.36 + (i / nBr) * 0.58;
    const base = curve.getPointAt(t);
    // 迎客松特色：下層大枝橫展微垂再挑起，上層短枝斜出
    const ang = (i * 2.39996) + (R() - 0.5) * 0.65;
    const reach = (0.85 + R() * 1.25) * s * (1.32 - t * 0.58);
    const mid = base.clone().add(new THREE.Vector3(Math.cos(ang) * reach * 0.55, (-0.12 + R() * 0.18) * s, Math.sin(ang) * reach * 0.55));
    const tip = base.clone().add(new THREE.Vector3(Math.cos(ang + 0.16) * reach, (0.06 + R() * 0.28) * s, Math.sin(ang + 0.16) * reach));
    const bCurve = new THREE.CatmullRomCurve3([base, mid, tip]);
    const br = new THREE.Mesh(taperTubeGeo(bCurve, far ? 5 : 10, 0.062 * s * (1.2 - t * 0.4), 0.018 * s, far ? 4 : 5, 0.1), trunkMat);
    g.add(br);
    if (!far) g.add(withOutline(br, 0.012 * s));

    // 副枝分叉
    if (!far && i < nBr - 1 && R() < 0.72) {
      const fAng = ang + (R() < 0.5 ? -0.65 : 0.65);
      const fTip = mid.clone().add(new THREE.Vector3(Math.cos(fAng) * reach * 0.48, (0.08 + R() * 0.16) * s, Math.sin(fAng) * reach * 0.48));
      const subBr = new THREE.Mesh(taperTubeGeo(new THREE.CatmullRomCurve3([mid, fTip]), 5, 0.032 * s, 0.014 * s, 4, 0.08), trunkMat);
      g.add(subBr);
      addPadCluster(fTip, (0.42 + R() * 0.24) * s, seed + i * 31 + 99);
    }

    const w = (0.62 + R() * 0.45) * s * (1.22 - t * 0.36);
    addPadCluster(tip, w, seed + i * 19);
  }

  const top = curve.getPointAt(1);
  addPadCluster(top.clone().add(new THREE.Vector3(0, 0.08 * s, 0)), 0.92 * s, seed + 777);

  g.traverse((o) => { if (o.isMesh && !o.userData.isOutline) o.castShadow = !far; });
  return g;
}

export function makeLantern(snow = 0) {
  const g = new THREE.Group();
  const stone = inkMaterial({ color: 0xa9a496, streak: 0.35, wash: 0.75, crack: 0.35, ...(snow ? { snow } : {}) });
  const darkStone = inkMaterial({ color: 0x6f6b62, wash: 0.7, ...(snow ? { snow: snow * 0.5 } : {}) });
  const wood = inkMaterial({ color: 0x3b332c, wash: 0.6 });
  const add = (geo, y, mat = stone, ol = 0.016) => {
    const m = new THREE.Mesh(geo, mat); m.position.y = y; m.castShadow = true; m.receiveShadow = true;
    g.add(m); if (ol) g.add(withOutline(m, ol));
    return m;
  };
  // 雙層台座＋六角反花蓮座
  add(new THREE.BoxGeometry(0.68, 0.12, 0.68), 0.06);
  add(new THREE.CylinderGeometry(0.24, 0.30, 0.12, 6), 0.18);
  // 燈竿＋中節箍環
  add(new THREE.CylinderGeometry(0.105, 0.13, 0.68, 8), 0.58);
  add(new THREE.CylinderGeometry(0.135, 0.135, 0.06, 8), 0.56, darkStone, 0.01);
  // 雕花中台（受座）
  add(new THREE.CylinderGeometry(0.29, 0.18, 0.10, 6), 0.96);
  add(new THREE.BoxGeometry(0.50, 0.07, 0.50), 1.03);
  // 火袋四角立柱與木格窗櫺（點燈時透出暖金火光）
  for (const [sx, sz] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.34, 0.055), stone);
    post.position.set(sx, 1.23, sz); post.castShadow = true; g.add(post);
  }
  for (const ry of [0, Math.PI / 2]) {
    for (const off of [-0.055, 0.055]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.30, 0.36), wood);
      bar.position.set(ry ? 0 : off, 1.23, ry ? off : 0); bar.rotation.y = ry; g.add(bar);
    }
    const hbar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.018, 0.36), wood);
    hbar.position.y = 1.23; hbar.rotation.y = ry; g.add(hbar);
  }
  // 飛簷笠頂＋寶珠請花
  add(hipRoofGeo(0.76, 0.76, 0.28, 0.09, 0.065, 8), 1.43, darkStone, 0.018);
  add(new THREE.CylinderGeometry(0.09, 0.13, 0.05, 8), 1.72, darkStone, 0.01);
  const jewel = new THREE.LatheGeometry([[0, 0], [0.065, 0.03], [0.075, 0.08], [0.035, 0.15], [0, 0.20]].map(([r, y]) => new THREE.Vector2(r, y)), 10);
  add(jewel, 1.74, stone, 0.012);

  // 燈芯紙窗與雙層柔光暈（點亮後隨時間如燭火般微幅呼吸搖曳）
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x2b2621 });
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), glowMat);
  win.position.y = 1.23; win.userData.noBake = true; g.add(win);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), color: 0xffb85c, transparent: true, opacity: 0, depthWrite: false }));
  halo.scale.set(1.95, 1.95, 1); halo.position.y = 1.24; g.add(halo);
  return {
    group: g, halo, glowMat,
    setLit(on) { glowMat.color.set(on ? 0xffc46b : 0x2b2621); halo.material.opacity = on ? 0.68 : 0; },
  };
}

let puffTex = null;
export function puffTexture() {
  if (puffTex) return puffTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,248,232,.52)'); gr.addColorStop(1, 'rgba(255,244,224,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  puffTex = new THREE.CanvasTexture(c);
  return puffTex;
}

export function makeBellRig() {
  // 鐘亭：石柱礎＋木立柱＋穿枋雀替＋懸山飛簷瓦頂（含椽木、正脊鴟吻），內懸精雕青銅梵鐘（龍鈕、袈裟襷、乳釘、撞座）
  const g = new THREE.Group();
  const wood = inkMaterial({ color: PAL.woodDark, streak: 0.65, wash: 0.7 });
  const stone = inkMaterial({ color: 0x948f83, crack: 0.45, wash: 0.7 });
  const tile = inkMaterial({ color: 0x2e2f34, wash: 0.75, streak: 0.3 });
  const bronze = inkMaterial({ color: PAL.bronze, wash: 0.85, grain: 1 });
  const bronzeHi = inkMaterial({ color: 0x3d3a33, wash: 0.7, grain: 0.9 });
  const parts = [];
  const addP = (geo, mat, x, y, z, ol = 0.018) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    g.add(m); if (ol) g.add(withOutline(m, ol));
    return m;
  };

  // 石柱礎＋雙立柱＋斜撐雀替
  for (const x of [-1.05, 1.05]) {
    addP(new THREE.BoxGeometry(0.42, 0.14, 0.42), stone, x, 0.07, 0, 0.015);
    addP(new THREE.CylinderGeometry(0.15, 0.19, 0.12, 8), stone, x, 0.20, 0, 0.014);
    addP(new THREE.BoxGeometry(0.22, 2.58, 0.22), wood, x, 1.52, 0);
    // 柱頭斗拱與雀替斜撐
    addP(new THREE.BoxGeometry(0.36, 0.12, 0.36), wood, x, 2.56, 0, 0.014);
    const brace = addP(new THREE.BoxGeometry(0.34, 0.11, 0.12), wood, x - Math.sign(x) * 0.24, 2.38, 0, 0.012);
    brace.rotation.z = Math.sign(x) * 0.55;
    // 前後腳戧木穩固底座
    for (const sz of [-1, 1]) {
      const foot = addP(new THREE.BoxGeometry(0.12, 0.52, 0.12), wood, x, 0.42, sz * 0.22, 0.012);
      foot.rotation.x = -sz * 0.48;
    }
  }
  // 雙重額枋橫樑
  addP(new THREE.BoxGeometry(2.68, 0.18, 0.24), wood, 0, 2.48, 0);
  addP(new THREE.BoxGeometry(2.88, 0.22, 0.30), wood, 0, 2.72, 0);
  // 屋簷下椽木排
  for (let x = -1.35; x <= 1.36; x += 0.3) {
    addP(new THREE.BoxGeometry(0.06, 0.06, 1.28), wood, x, 2.86, 0, 0);
  }
  // 飛簷懸山瓦頂＋正脊＋脊獸翹角
  addP(gableRoofGeo(3.32, 1.42, 0.34, 0.085, 0.14), tile, 0, 2.94, 0, 0.022);
  addP(new THREE.BoxGeometry(3.38, 0.11, 0.12), tile, 0, 3.31, 0, 0.015);
  for (const sx of [-1.66, 1.66]) {
    const fin = addP(new THREE.BoxGeometry(0.14, 0.20, 0.16), tile, sx, 3.44, 0, 0.014);
    fin.rotation.z = -Math.sign(sx) * 0.25;
    // 簷角懸掛青銅風鐸
    for (const sz of [-0.62, 0.62]) {
      addP(new THREE.CylinderGeometry(0.035, 0.05, 0.11, 6), bronzeHi, sx * 0.94, 2.86, sz, 0);
    }
  }
  // 側懸外置撞木（吊繩懸起於右柱內側，純視覺工藝細節）
  for (const rz of [-0.18, 0.18]) {
    const rp = addP(new THREE.CylinderGeometry(0.012, 0.012, 0.72, 4), bronzeHi, 0.68, 2.18, rz, 0);
    void rp;
  }
  const striker = addP(new THREE.CylinderGeometry(0.055, 0.055, 0.68, 8), wood, 0.68, 1.82, 0, 0.01);
  striker.rotation.x = Math.PI / 2;

  // 鐘樞紐與青銅梵鐘
  const pivot = new THREE.Group(); pivot.position.y = 2.58; pivot.userData.noBake = true; g.add(pivot);
  // 鐵吊環＋龍鈕雙拱
  const link1 = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.018, 6, 12), bronzeHi); link1.position.y = 0.02; pivot.add(link1);
  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.026, 7, 14, Math.PI), bronzeHi); crown.position.y = -0.09; pivot.add(crown);
  const prof = [
    [0.0, -0.06], [0.11, -0.08], [0.22, -0.15], [0.265, -0.32], [0.285, -0.58],
    [0.305, -0.86], [0.355, -1.02], [0.405, -1.09], [0.39, -1.12], [0.34, -1.10],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const bell = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), inkMaterial({ color: PAL.bronze, wash: 0.85, grain: 1, side: THREE.DoubleSide }));
  bell.castShadow = true;
  pivot.add(bell, withOutline(bell, 0.022));
  // 袈裟襷橫箍帶（上中下三道）
  for (const [ry, r0] of [[-0.28, 0.262], [-0.62, 0.292], [-0.96, 0.335]]) {
    const bnd = new THREE.Mesh(new THREE.TorusGeometry(r0, 0.018, 6, 24), bronzeHi);
    bnd.rotation.x = Math.PI / 2; bnd.position.y = ry; pivot.add(bnd);
  }
  // 乳釘陣列與蓮花撞座
  for (let a = 0; a < 4; a++) {
    const th = (a / 4) * Math.PI * 2 + Math.PI / 4;
    for (const dy of [-0.38, -0.49]) {
      for (const da of [-0.14, 0.14]) {
        const stud = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), bronzeHi);
        stud.position.set(Math.cos(th + da) * 0.28, dy, Math.sin(th + da) * 0.28);
        pivot.add(stud);
      }
    }
  }
  for (const sz of [-1, 1]) {
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.03, 12), bronzeHi);
    boss.rotation.x = Math.PI / 2; boss.position.set(0, -0.80, sz * 0.305);
    pivot.add(boss);
  }
  void parts;
  return { group: g, pivot };
}

export function makeTorii(w = 5, h = 4.3, snow = 0) {
  const g = new THREE.Group();
  const sn = snow ? { snow } : {};
  const red = inkMaterial({ color: PAL.vermilion, streak: 0.42, wash: 0.72, ...sn });
  const blk = inkMaterial({ color: 0x1d1e23, wash: 0.55, ...sn });
  const stone = inkMaterial({ color: 0x8d887c, crack: 0.45, wash: 0.7, ...sn });
  const gold = inkMaterial({ color: 0xc29b59, wash: 0.5 });
  const add = (geo, mat, x, y, z, ol = 0.022) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    g.add(m); if (ol) g.add(withOutline(m, ol));
    return m;
  };
  // 龜腹石柱礎＋微內傾朱紅圓柱＋柱頂台輪黑箍
  for (const sx of [-1, 1]) {
    const x = (sx * w) / 2;
    add(new THREE.CylinderGeometry(0.32, 0.37, 0.26, 12), stone, x, 0.13, 0, 0.018);
    add(new THREE.CylinderGeometry(0.25, 0.31, 0.12, 12), blk, x, 0.32, 0, 0.015);
    const p = add(new THREE.CylinderGeometry(0.195, 0.235, h - 0.2, 14), red, x - sx * 0.04, h / 2 + 0.1, 0);
    p.rotation.z = sx * 0.024;
    add(new THREE.CylinderGeometry(0.24, 0.24, 0.14, 14), blk, x - sx * 0.08, h - 0.16, 0, 0.015);
  }
  // 貫樑（Nuki）與左右木楔（Kusabi）
  add(new THREE.BoxGeometry(w + 1.15, 0.24, 0.22), red, 0, h - 0.96, 0);
  for (const sx of [-1, 1]) {
    for (const inner of [-1, 1]) {
      const wedge = add(new THREE.BoxGeometry(0.11, 0.34, 0.28), blk, (sx * w) / 2 + inner * 0.23 - sx * 0.03, h - 0.95, 0, 0.012);
      wedge.rotation.z = inner * 0.14;
    }
  }
  // 島木（Shimaki）＋斗拱墊塊
  add(new THREE.BoxGeometry(w + 1.7, 0.21, 0.36), red, 0, h - 0.20, 0);
  for (const x of [-w / 2 + 0.08, 0, w / 2 - 0.08]) {
    add(new THREE.BoxGeometry(0.46, 0.13, 0.42), blk, x, h - 0.04, 0, 0.014);
  }
  // 笠木（Kasagi）：反宇上翹大樑＋兩端封檐瓦頭
  const kas = new THREE.BoxGeometry(w + 2.25, 0.30, 0.52, 20, 1, 2);
  const kp = kas.attributes.position;
  for (let i = 0; i < kp.count; i++) {
    const x = kp.getX(i), u = Math.abs(x) / ((w + 2.25) / 2);
    kp.setY(i, kp.getY(i) + Math.pow(u, 3.2) * 0.42);
  }
  kas.computeVertexNormals();
  add(kas, blk, 0, h + 0.12, 0, 0.025);

  // 額束與黑漆金框匾額
  add(new THREE.BoxGeometry(0.24, 0.72, 0.18), red, 0, h - 0.58, 0, 0.014);
  add(new THREE.BoxGeometry(0.62, 0.78, 0.12), blk, 0, h - 0.58, 0.08, 0.016);
  add(new THREE.BoxGeometry(0.46, 0.62, 0.135), inkMaterial({ color: 0x2b2520, wash: 0.4 }), 0, h - 0.58, 0.08, 0);
  add(new THREE.BoxGeometry(0.14, 0.34, 0.15), gold, 0, h - 0.58, 0.08, 0);

  // 貫樑下懸草編注連繩（Shimenawa）與隨風微擺的白紙垂（Shide）
  const ropeMat = inkMaterial({ color: 0xc2ab7c, wash: 0.65, streak: 0.4 });
  const shideMat = inkMaterial({ color: 0xf0eadb, wash: 0.3, side: THREE.DoubleSide, sway: 0.05 });
  const ropePts = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10, x = (u - 0.5) * (w - 0.35);
    const sag = Math.sin(u * Math.PI) * 0.16;
    ropePts.push(new THREE.Vector3(x, h - 1.09 - sag, 0.12));
  }
  const shimeCurve = new THREE.CatmullRomCurve3(ropePts);
  const shimeGeo = taperTubeGeo(shimeCurve, 16, 0.032, 0.032, 6, 0.18, false);
  // 中央加粗鼓腹（注連繩特徵）
  const sp = shimeGeo.attributes.position, sc = new THREE.Vector3();
  for (let i = 0; i <= 16; i++) {
    const u = i / 16; shimeCurve.getPointAt(u, sc);
    const belly = 0.55 + Math.sin(u * Math.PI) * 1.15;
    for (let j = 0; j < 7; j++) {
      const idx = i * 7 + j;
      sp.setXYZ(idx, sc.x + (sp.getX(idx) - sc.x) * belly, sc.y + (sp.getY(idx) - sc.y) * belly, sc.z + (sp.getZ(idx) - sc.z) * belly);
    }
  }
  shimeGeo.computeVertexNormals();
  add(shimeGeo, ropeMat, 0, 0, 0, 0.012);
  // 五道閃電折紙垂（高於地面 2.4m 以上，絕不擋視線或碰撞）
  for (const u of [0.2, 0.35, 0.5, 0.65, 0.8]) {
    const pt = shimeCurve.getPointAt(u);
    const sg = new THREE.BufferGeometry();
    const pos = [], sw = [];
    const segs = [[0, 0, -0.05, -0.10], [-0.03, -0.08, 0.04, -0.18], [0.01, -0.16, -0.05, -0.28]];
    for (const [k, [x0, y0, x1, y1]] of segs.entries()) {
      const w0 = 0.032, s0 = (k / 3) * 0.6, s1 = ((k + 1) / 3);
      pos.push(x0 - w0, y0, 0, x0 + w0, y0, 0, x1 - w0, y1, 0.01, x0 + w0, y0, 0, x1 + w0, y1, 0.01, x1 - w0, y1, 0.01);
      sw.push(s0, s0, s1, s0, s1, s1);
    }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    sg.setAttribute('aSway', new THREE.Float32BufferAttribute(sw, 1));
    sg.computeVertexNormals();
    const sm = new THREE.Mesh(sg, shideMat);
    sm.position.set(pt.x, pt.y - 0.02, pt.z + 0.02);
    g.add(sm);
  }
  return g;
}

/** 庭院石牆壓頂灰瓦簷（參考影片庭院幀圍牆頂上的深灰瓦簷，純外觀） */
export function makeWallCoping(x0, z0, x1, z1, yTop, snow = 0) {
  const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
  const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const wid = (alongX ? Math.abs(z1 - z0) : Math.abs(x1 - x0)) + 0.36;
  const tile = inkMaterial({ color: 0x303238, wash: 0.75, streak: 0.35, ...(snow ? { snow } : {}) });
  const g = new THREE.Group();
  const roof = new THREE.Mesh(gableRoofGeo(alongX ? len + 0.3 : wid, alongX ? wid : len + 0.3, 0.18, 0.08, 0.05, alongX ? Math.max(4, Math.round(len)) : 4, alongX ? 4 : Math.max(4, Math.round(len))), tile);
  roof.castShadow = roof.receiveShadow = true;
  g.add(roof, withOutline(roof, 0.018));
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len + 0.32 : 0.12, 0.09, alongX ? 0.12 : len + 0.32), tile);
  ridge.position.y = 0.20; ridge.castShadow = true;
  g.add(ridge);
  g.position.set((x0 + x1) / 2, yTop + 0.03, (z0 + z1) / 2);
  return g;
}

/** 古道殘碑／指路石碑（龜趺須彌座＋風化缺角碑身＋陰刻碑額與朱印） */
export function makeStele(seed = 1, tall = 1.65, snow = 0) {
  const R = rng(seed);
  const g = new THREE.Group();
  const sn = snow ? { snow } : {};
  const stone = inkMaterial({ color: 0x9b9689, streak: 0.55, crack: 0.65, wash: 0.8, ...sn });
  const dark = inkMaterial({ color: 0x2d2c2e, wash: 0.5 });
  const seal = inkMaterial({ color: PAL.vermilion, wash: 0.4 });
  const add = (geo, mat, x, y, z, ol = 0.016) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
    g.add(m); if (ol) g.add(withOutline(m, ol)); return m;
  };
  // 雙層蓮瓣石碑座
  add(new THREE.BoxGeometry(0.96, 0.18, 0.58), stone, 0, 0.09, 0);
  add(new THREE.BoxGeometry(0.78, 0.16, 0.44), stone, 0, 0.25, 0);
  // 風化碑身（頂部圓拱＋自然缺角鑿痕）
  const bg = new THREE.BoxGeometry(0.58, tall, 0.20, 6, 8, 2);
  const bp = bg.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    let x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
    if (y > tall * 0.35) {
      const u = Math.abs(x) / 0.29;
      y -= u * u * 0.14;
      if (x > 0.12) y -= (R() * 0.04 + 0.05) * u; // 右上歲月殘缺角
    }
    x += (vnoise3(x * 4 + seed, y * 3, z * 4) - 0.5) * 0.035;
    z += (vnoise3(x * 4, y * 3 + seed, z * 4) - 0.5) * 0.022;
    bp.setXYZ(i, x, y, z);
  }
  bg.deleteAttribute('uv');
  bg.computeVertexNormals();
  add(bg, stone, 0, 0.32 + tall / 2, 0, 0.018);
  // 正背面碑心凹龕、墨書刻痕與朱砂印記
  for (const sz of [-1, 1]) {
    add(new THREE.BoxGeometry(0.34, tall * 0.62, 0.018), dark, 0, 0.32 + tall * 0.48, sz * 0.102, 0);
    for (const cx of [-0.07, 0.03]) {
      const h = tall * (0.34 + R() * 0.16);
      add(new THREE.BoxGeometry(0.022, h, 0.024), inkMaterial({ color: 0x16171c }), cx, 0.36 + tall * 0.5, sz * 0.106, 0);
    }
    add(new THREE.BoxGeometry(0.075, 0.075, 0.026), seal, -0.08, 0.32 + tall * 0.26, sz * 0.107, 0);
  }
  return g;
}

/** 三足雙耳石香爐（附香灰與三柱紅頭線香，回傳 smokePos 供裊裊香煙粒子使用） */
export function makeCenser(snow = 0) {
  const g = new THREE.Group();
  const sn = snow ? { snow: snow * 0.6 } : {};
  const stone = inkMaterial({ color: 0x7b776e, crack: 0.5, wash: 0.75, ...sn });
  const ash = inkMaterial({ color: 0xbab4a6, wash: 0.4 });
  const stickM = inkMaterial({ color: 0x6e4730, wash: 0.4 });
  const emberM = new THREE.MeshBasicMaterial({ color: 0xff5a26 });
  const add = (geo, mat, x, y, z, ol = 0.014) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
    g.add(m); if (ol) g.add(withOutline(m, ol)); return m;
  };
  add(new THREE.CylinderGeometry(0.36, 0.40, 0.10, 8), stone, 0, 0.05, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const leg = add(new THREE.CylinderGeometry(0.055, 0.042, 0.26, 6), stone, Math.cos(a) * 0.19, 0.20, Math.sin(a) * 0.19, 0.01);
    leg.rotation.z = Math.cos(a) * 0.18; leg.rotation.x = -Math.sin(a) * 0.18;
  }
  const belly = new THREE.LatheGeometry([[0, 0.26], [0.22, 0.28], [0.30, 0.40], [0.26, 0.56], [0.29, 0.62], [0.24, 0.64], [0.21, 0.58]].map(([r, y]) => new THREE.Vector2(r, y)), 14);
  belly.deleteAttribute('uv');
  add(belly, stone, 0, 0, 0, 0.016);
  // 雙側雲耳爐把
  for (const sx of [-1, 1]) {
    const ear = add(new THREE.TorusGeometry(0.09, 0.024, 5, 10, Math.PI * 1.25), stone, sx * 0.28, 0.50, 0, 0.01);
    ear.rotation.z = sx * -1.4;
  }
  add(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 12), ash, 0, 0.58, 0, 0);
  for (const [dx, dz, tilt] of [[-0.03, 0.01, -0.08], [0, -0.02, 0.02], [0.035, 0.015, 0.09]]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.24, 4), stickM);
    st.position.set(dx, 0.70, dz); st.rotation.z = tilt; g.add(st);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 5, 4), emberM);
    tip.position.set(dx - Math.sin(tilt) * 0.12, 0.82, dz); tip.userData.noBake = true; g.add(tip);
  }
  return g;
}

/** 風動水墨山草／芒草叢：合併為單一幾何體，頂點隨 uTime 自然搖曳（零額外 draw call） */
export function makeGrassField(clusters, snow = 0) {
  const mat = inkMaterial({
    color: snow ? 0x6f736d : 0x2c342b, wash: 0.85, grain: 0.8,
    side: THREE.DoubleSide, sway: 0.095, ...(snow ? { snow: snow * 0.55 } : {}),
  });
  const pos = [], sw = [];
  let s = 409; const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (const [cx, cy, cz, sc = 1, n = 9] of clusters) {
    for (let i = 0; i < n; i++) {
      const ang = R() * Math.PI * 2, dist = R() * 0.34 * sc;
      const bx = cx + Math.cos(ang) * dist, bz = cz + Math.sin(ang) * dist;
      const dir = R() * Math.PI * 2;
      const dx = Math.cos(dir), dz = Math.sin(dir);
      const px = -dz, pz = dx;
      const h = (0.36 + R() * 0.48) * sc, lean = (0.14 + R() * 0.28) * sc, w0 = (0.024 + R() * 0.016) * sc;
      // 兩段彎折長草葉（底→中→尖）
      const mx = bx + dx * lean * 0.42, my = cy + h * 0.56, mz = bz + dz * lean * 0.42;
      const tx = bx + dx * lean, ty = cy + h * (0.92 - R() * 0.12), tz = bz + dz * lean;
      const w1 = w0 * 0.55;
      pos.push(
        bx - px * w0, cy - 0.02, bz - pz * w0, bx + px * w0, cy - 0.02, bz + pz * w0, mx - px * w1, my, mz - pz * w1,
        bx + px * w0, cy - 0.02, bz + pz * w0, mx + px * w1, my, mz + pz * w1, mx - px * w1, my, mz - pz * w1,
        mx - px * w1, my, mz - pz * w1, mx + px * w1, my, mz + pz * w1, tx, ty, tz,
      );
      sw.push(0, 0, 0.35, 0, 0.35, 0.35, 0.35, 0.35, 1.0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(sw, 1));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.castShadow = false; m.receiveShadow = true;
  return m;
}

/** 風動水墨山竹叢（竹節修篁＋個字墨竹葉，整叢隨山風輕拂） */
export function makeBamboo(seed = 1, nStalks = 5, tall = 4.0, snow = 0) {
  const R = rng(seed);
  const g = new THREE.Group();
  const stalkMat = inkMaterial({ color: snow ? 0x4c5448 : 0x354233, wash: 0.8, streak: 0.35, sway: 0.06, ...(snow ? { snow: snow * 0.4 } : {}) });
  const leafMat = inkMaterial({ color: snow ? 0x2c362f : 0x1e2821, wash: 0.9, side: THREE.DoubleSide, sway: 0.12, ...(snow ? { snow: snow * 0.7 } : {}) });
  const leafPos = [], leafSw = [];

  for (let i = 0; i < nStalks; i++) {
    const a = (i / nStalks) * Math.PI * 2 + R() * 0.6, rad = 0.08 + R() * 0.32;
    const bx = Math.cos(a) * rad, bz = Math.sin(a) * rad;
    const h = tall * (0.72 + R() * 0.42);
    const lx = Math.cos(a) * (0.28 + R() * 0.35), lz = Math.sin(a) * (0.28 + R() * 0.35);
    const segs = 6;
    const pts = [];
    for (let k = 0; k <= segs; k++) {
      const u = k / segs;
      pts.push(new THREE.Vector3(bx + lx * u * u, h * u, bz + lz * u * u));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const sg = taperTubeGeo(curve, 12, 0.042, 0.016, 5, 0.04, false);
    sg.deleteAttribute('uv');
    const sp = sg.attributes.position;
    const swArr = new Float32Array(sp.count);
    for (let v = 0; v < sp.count; v++) {
      const u = Math.max(0, sp.getY(v) / tall);
      swArr[v] = u * u * 0.85;
    }
    sg.setAttribute('aSway', new THREE.BufferAttribute(swArr, 1));
    const sm = new THREE.Mesh(sg, stalkMat);
    sm.castShadow = true;
    g.add(sm);

    // 竹節環與中上段墨竹葉簇（「個」字／「介」字撇葉）
    for (let k = 2; k <= segs; k++) {
      const u = k / segs, pt = curve.getPointAt(u);
      const nLeaves = 4 + Math.floor(R() * 4);
      for (let j = 0; j < nLeaves; j++) {
        const la = R() * Math.PI * 2, droop = -0.08 - R() * 0.18, len = 0.28 + R() * 0.22;
        const dx = Math.cos(la), dz = Math.sin(la), px = -dz * 0.028, pz = dx * 0.028;
        const mx = pt.x + dx * len * 0.48, my = pt.y + 0.03 + droop * 0.3, mz = pt.z + dz * len * 0.48;
        const tx = pt.x + dx * len, ty = pt.y + droop, tz = pt.z + dz * len;
        leafPos.push(
          pt.x, pt.y, pt.z, mx + px, my, mz + pz, mx - px, my, mz - pz,
          mx + px, my, mz + pz, tx, ty, tz, mx - px, my, mz - pz,
        );
        const sBase = u * u * 0.65;
        leafSw.push(sBase, sBase + 0.22, sBase + 0.22, sBase + 0.22, sBase + 0.55, sBase + 0.22);
      }
    }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(leafPos, 3));
  lg.setAttribute('aSway', new THREE.Float32BufferAttribute(leafSw, 1));
  lg.computeVertexNormals();
  const lm = new THREE.Mesh(lg, leafMat);
  lm.castShadow = true;
  g.add(lm);
  return g;
}

/** 懸崖垂藤：貼著崖壁上緣垂下隨風搖曳的水墨藤蔓與細葉 */
export function makeCliffVines(x0, x1, yTop, zWall, nz = 1, nVines = 8, maxLen = 2.4, snow = 0) {
  const mat = inkMaterial({ color: snow ? 0x3b403c : 0x1d241f, wash: 0.85, side: THREE.DoubleSide, sway: 0.11, ...(snow ? { snow: snow * 0.4 } : {}) });
  const pos = [], sw = [];
  let s = Math.round(Math.abs(x0 * 37 + yTop * 19 + zWall * 13)) + 1;
  const R = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < nVines; i++) {
    const vx = x0 + (x1 - x0) * ((i + 0.2 + R() * 0.6) / nVines);
    const len = maxLen * (0.45 + R() * 0.65);
    const segs = 5;
    let cx = vx, cy = yTop, cz = zWall + nz * 0.08;
    for (let k = 0; k < segs; k++) {
      const u0 = k / segs, u1 = (k + 1) / segs;
      const nx = cx + (R() - 0.5) * 0.14, ny = yTop - len * u1, nzz = zWall + nz * (0.08 + u1 * 0.06);
      const w = 0.018 * (1 - u0 * 0.45);
      pos.push(cx - w, cy, cz, cx + w, cy, cz, nx - w * 0.8, ny, nzz, cx + w, cy, cz, nx + w * 0.8, ny, nzz, nx - w * 0.8, ny, nzz);
      sw.push(u0 * u0, u0 * u0, u1 * u1, u0 * u0, u1 * u1, u1 * u1);
      // 兩側水墨點葉
      for (const side of [-1, 1]) {
        if (R() < 0.78) {
          const lx = nx + side * (0.08 + R() * 0.07), ly = ny - 0.05 - R() * 0.06, lz = nzz + nz * 0.03;
          pos.push(nx, ny + 0.04, nzz, nx + side * 0.03, ny - 0.01, nzz + nz * 0.02, lx, ly, lz);
          sw.push(u1 * u1, u1 * u1 + 0.08, u1 * u1 + 0.18);
        }
      }
      cx = nx; cy = ny; cz = nzz;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(sw, 1));
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

/** 遠山雲崖飛瀑：動態水墨白練＋瀑底水霧（自帶 uTime 流動著色器） */
export function makeWaterfall(x, yTop, yBot, z, width = 2.8, ry = 0) {
  const h = yTop - yBot;
  const g = new THREE.PlaneGeometry(width, h, 8, 24);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const vy = p.getY(i), u = (h / 2 - vy) / h;
    // 頂端越過岩唇微拱流出
    p.setZ(i, Math.sin(Math.min(1, u * 5) * Math.PI * 0.5) * 0.45 + u * 0.35);
  }
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uFogC: { value: new THREE.Color(0xddd2bd) } },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying float vFog;
      void main(){
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFog = smoothstep(55.0, 250.0, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv; varying float vFog; uniform float uTime; uniform vec3 uFogC;
      float h2(vec2 p){ p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 34.2); return fract(p.x * p.y); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        float edge = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
        float topFade = smoothstep(1.0, 0.93, vUv.y);
        float botFade = smoothstep(0.0, 0.20, vUv.y);
        float flow1 = n2(vec2(vUv.x * 9.0, vUv.y * 5.5 + uTime * 2.4));
        float flow2 = n2(vec2(vUv.x * 19.0 + 3.1, vUv.y * 9.0 + uTime * 3.8));
        float streak = smoothstep(0.30, 0.78, flow1 * 0.65 + flow2 * 0.35);
        // 國畫飛白留白水練＋兩側濃墨石影襯底
        vec3 foam = vec3(0.95, 0.92, 0.85);
        vec3 ink = vec3(0.14, 0.15, 0.19);
        vec3 col = mix(ink, foam, smoothstep(0.28, 0.65, streak + 0.18));
        col = mix(col, uFogC, vFog * 0.85);
        float a = edge * topFade * botFade * (0.45 + 0.52 * streak) * (1.0 - vFog * 0.65);
        if (a < 0.02) discard;
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.set(x, (yTop + yBot) / 2, z);
  mesh.rotation.y = ry;
  mesh.userData.noBake = true;
  return mesh;
}

// ---------- 關卡建構器 ----------
/** 碰撞世界＋岩體／墨流的收集器。rockOpts 是岩體材質參數；snow 讓燈籠也積雪 */
export function makeBuilder(scene, rockOpts = {}, snow = 0) {
  const before = new Set(scene.children);
  const W = new World();
  const rockMat = inkMaterial({ color: PAL.stone, streak: 0.82, drip: 1.05, crack: 0.62, wash: 0.8, topLight: 0.82, ...rockOpts });
  const rockGeos = [];
  const drips = [];
  const dripMat = dripMaterial();
  const lanterns = [];

  const rock = (x0, y0, z0, x1, y1, z1, o = {}) => {
    if (!o.colOnly) rockGeos.push(rockGeo(x0, y0, z0, x1, y1, z1, o));
    if (o.noCol) return null;
    return W.addBox(x0, y0, z0, x1, y1, z1, o.data);
  };
  const pillar = (x, z, r, top, o = {}) => { rockGeos.push(cylGeo(x, z, r, B, top, o)); return W.addCyl(x, z, r, B, top); };
  /** 雕琢奇石群（純視覺併入 rockGeos，零額外 draw call；可選加外殼描線讓前景奇石更有國畫勾勒感） */
  const boulders = (items, outline = false) => {
    for (const [i, [cx, cy, cz, rx, ry, rz, sd = i + 1]] of items.entries()) {
      const bg = boulderGeo(cx, cy, cz, rx, ry, rz, sd);
      rockGeos.push(bg);
      if (outline) {
        const ol = new THREE.Mesh(bg, outlineMaterial(0.022));
        ol.castShadow = false; ol.receiveShadow = false; ol.userData.isOutline = true;
        scene.add(ol);
      }
    }
  };
  /** 壁面墨流貼片：x0..x1 寬、從 yTop 往下 h 公尺，貼在 z 平面（n=±1） */
  const drip = (x0, x1, z, yTop, h, nz = 1) => {
    const w = Math.abs(x1 - x0);
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    const rep = Math.max(1, w / 4.2);
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * rep);
    const m = new THREE.Mesh(g, dripMat);
    m.position.set((x0 + x1) / 2, yTop - h / 2, z + 0.032 * nz);
    if (nz < 0) m.rotation.y = Math.PI;
    drips.push(m);
  };
  /** 岩縫凸石：頂面與外緣保持精確供雙手 IK 抓握，下腹斜收嵌入岩壁，下方必配濃墨垂流 */
  const slab = (x0, x1, y, zWall, n = 1, data = {}) => {
    const zo = zWall + 0.4 * n;
    const zMin = Math.min(zWall, zo), zMax = Math.max(zWall, zo);
    const sx = x1 - x0, sy = 0.28, sz = zMax - zMin;
    const g = new THREE.BoxGeometry(sx, sy, sz, Math.max(4, Math.round(sx / 0.4)), 2, 2);
    g.translate((x0 + x1) / 2, y - sy / 2, (zMin + zMax) / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
      const depth = (y - vy) / sy; // 0 = 頂面, 1 = 底面
      if (depth > 0.08) {
        // 下腹往壁面斜收成厚實石樑托，避免在岩唇下方折出懸空薄片
        vz = vz + (zWall - vz) * depth * 0.62;
        const crag = (vnoise3(vx * 1.8, vy * 2.0, vz * 1.8) - 0.5) * 0.09 * depth;
        vy -= crag;
      }
      p.setXYZ(i, vx, vy, vz);
    }
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    g.setAttribute('aTop', new THREE.BufferAttribute(new Float32Array(p.count).fill(y), 1));
    rockGeos.push(g);
    W.addBox(x0, y - 0.25, Math.min(zWall, zo), x1, y, Math.max(zWall, zo));
    drip(x0, x1, zWall, y - 0.16, 1.85 + Math.abs(Math.sin(x0 * 3.1 + y)) * 0.65, n);
    return W.addLedge(x0, y, zo, x1, zo, [0, n], data);
  };
  const edge = (x0, x1, y, z, n, data = {}) => W.addLedge(x0, y, z, x1, z, [0, n], { top: true, ...data });
  const edgeX = (z0, z1, y, x, n, data = {}) => W.addLedge(x, y, z0, x, z1, [n, 0], { top: true, ...data });
  const place = (obj, x, y, z, ry = 0) => { obj.position.set(x, y, z); obj.rotation.y = ry; scene.add(obj); return obj; };
  const lantern = (x, y, z, kind = 'check', yaw = 0) => {
    const L = makeLantern(snow); place(L.group, x, y, z);
    W.addCyl(x, z, 0.3, y, y + 1.8);
    const o = { ...L, pos: new THREE.Vector3(x, y, z), kind, lit: false, yaw, spawn: new THREE.Vector3(x + Math.sin(yaw) * -1.2, y, z + Math.cos(yaw) * -1.2) };
    lanterns.push(o);
    return o;
  };

  /** 合併關卡岩體（統一轉 non-indexed 並正規化屬性，相容所有岩塊／石柱／奇石）、加上墨流貼片 */
  function finishRocks() {
    const norm = rockGeos.map((src) => {
      const g = src.index ? src.toNonIndexed() : src;
      for (const k of Object.keys(g.attributes)) {
        if (k !== 'position' && k !== 'normal' && k !== 'aTop') g.deleteAttribute(k);
      }
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.aTop) g.setAttribute('aTop', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
      return g;
    });
    const rockMesh = new THREE.Mesh(mergeGeometries(norm), rockMat);
    rockMesh.userData.noBake = true;
    rockMesh.castShadow = rockMesh.receiveShadow = true;
    scene.add(rockMesh);
    for (const d of drips) scene.add(d);
    return rockMesh;
  }

  /** 霧團：一個 InstancedMesh，頂點著色器轉成面向鏡頭的公告板，霧化自己算。at(R) 回傳 [x, y, z]。
   *  opacity 可調濃淡（寒潭水面薄霧用低透明度，避免把黑水洗成灰白） */
  function fogPuffs({ n = 46, seed = 41, fog = 0xddd2bd, near = 50, far = 260, size = 1, fadeNear = 0, opacity = 1, at }) {
    const R2 = rng(seed);
    const NP = n;
    const puffMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uFogC: { value: new THREE.Color(fog) }, uNear: { value: near }, uFar: { value: far }, uFN: { value: fadeNear }, uOp: { value: opacity } },
      vertexShader: /* glsl */`
        varying vec2 vUv; varying float vA; varying float vFog;
        uniform float uNear, uFar, uFN, uOp;
        void main(){
          vec3 c = instanceMatrix[3].xyz;
          vec2 sc = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
          vec4 mv = viewMatrix * vec4(c, 1.0);
          mv.xy += position.xy * sc;
          vUv = uv; vA = (0.30 + 0.34 * fract(sin(float(gl_InstanceID) * 12.9898) * 43758.5453)) * uOp;
          vFog = smoothstep(uNear, uFar, -mv.z);
          if (uFN > 0.0) vA *= smoothstep(uFN * 0.35, uFN, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        varying vec2 vUv; varying float vA; varying float vFog; uniform vec3 uFogC;
        void main(){
          float d = length(vUv - 0.5) * 2.0;
          float a = (1.0 - smoothstep(0.0, 1.0, d)) * vA;
          vec3 col = mix(vec3(0.95, 0.94, 0.90), uFogC, vFog);
          gl_FragColor = vec4(col, a);
          #include <colorspace_fragment>
        }`,
    });
    const puffs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), puffMat, NP);
    const pm = new THREE.Matrix4();
    for (let i = 0; i < NP; i++) {
      const sc = (10 + R2() * 22) * size;
      pm.makeScale(sc * 1.8, sc * 0.7, 1).setPosition(...at(R2));
      puffs.setMatrixAt(i, pm);
    }
    puffs.frustumCulled = false; puffs.userData.noBake = true;
    scene.add(puffs);
    return puffs;
  }

  /** 靜態物件依（材質、投影）合併，減少 draw call；noBake 的動態群組也在自身局部座標內合併剛體子網格 */
  function bakeSubtree(root, toLocal) {
    const buckets = new Map(), dead = [];
    const walk = (o) => {
      if (o !== root && o.userData.noBake) {
        if (o.isGroup) bakeSubtree(o, o.matrixWorld.clone().invert());
        return;
      }
      if (o !== root && o.isMesh && !o.isInstancedMesh) {
        const m = o.material, key = m.uuid + (o.castShadow ? 'S' : '') + (o.receiveShadow ? 'R' : '');
        let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        const keepUv = !!(m.map || m.alphaMap);
        const keepSway = !!m.userData?.hasSway;
        for (const k of Object.keys(g.attributes)) {
          if (!(k === 'position' || k === 'normal' || (k === 'uv' && keepUv) || (k === 'aSway' && keepSway))) g.deleteAttribute(k);
        }
        if (!g.attributes.normal) g.computeVertexNormals();
        if (keepUv && !g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        if (keepSway && !g.attributes.aSway) g.setAttribute('aSway', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
        g.applyMatrix4(toLocal ? toLocal.clone().multiply(o.matrixWorld) : o.matrixWorld);
        if (!buckets.has(key)) buckets.set(key, { m, cast: o.castShadow, recv: o.receiveShadow, geos: [], order: o.renderOrder });
        buckets.get(key).geos.push(g);
        dead.push(o);
      }
      for (const c of o.children) walk(c);
    };
    if (root === scene) {
      for (const c of [...scene.children]) if (!before.has(c)) walk(c);
    } else walk(root);
    for (const o of dead) o.parent.remove(o);
    for (const b of buckets.values()) {
      const mesh = new THREE.Mesh(mergeGeometries(b.geos), b.m);
      mesh.castShadow = b.cast; mesh.receiveShadow = b.recv; mesh.renderOrder = b.order;
      root.add(mesh);
    }
  }
  function bake() {
    scene.updateMatrixWorld(true);
    bakeSubtree(scene, null);
  }

  return { W, rockMat, rockGeos, lanterns, rock, pillar, boulders, drip, slab, edge, edgeX, place, lantern, finishRocks, fogPuffs, bake };
}
