// 五個 POI 與零散建築的佈局。
import * as THREE from 'three';
import { POI_SITES, FLAT_Y, ROAD_PATHS, BAY, PIT, LAKE } from './terrain.js';
import { KIND } from './world-panels.js';
import { PAINTS, ROOFS, buildHouse } from './world-house.js';
import { hash2 } from './shared.js';

const hot = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
const face = (x, z, tx, tz, quant = true) => { const a = Math.atan2(-(tx - x), -(tz - z)); return quant ? Math.round(a / (Math.PI / 2)) * (Math.PI / 2) : a; };
// accept 測試區（玩家落地 (8,30)、建造測試 (10,33)/(26,33) 朝 -Z）：不放任何實體物件
export const inTest = (x, z, m = 0) => x > -4 - m && x < 38 + m && z > 10 - m && z < 46 + m;

export function buildTowns(W) {
  const T = W.ctx.terrain, rng = W.rng, P = POI_SITES, props = W.props;
  const house = (cl, o) => {
    const corner = [[-o.w / 2, -o.d / 2], [o.w / 2, -o.d / 2], [-o.w / 2, o.d / 2], [o.w / 2, o.d / 2]], c = Math.cos(o.yaw || 0), s = Math.sin(o.yaw || 0);
    let lo = 99, hi = -99;
    for (const [a, b] of corner) { const h = T.heightAt(o.x + a * c + b * s, o.z - a * s + b * c); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    if (lo < 1.4 || hi - lo > (o.slope ?? 1.2)) return null;
    const info = buildHouse(W, cl, o); W.addBlocker(o.x, o.z, info.radius + 1);
    T.stampRect(3, o.x, o.z, o.w / 2 + 1.2, o.d / 2 + 1.2, o.yaw || 0, 0.6); // 禁生草
    return info;
  };
  W.house = house;
  // ================= 蜂蜜鎮 =================
  {
    const cl = W.cluster('hw'), c = P[0];
    T.stamp(1, c.x, c.z, 16, 1.0); // 廣場鋪石
    const fy = FLAT_Y;
    props.fountain(cl, c.x, c.z, fy);
    // 街道（土路）網格
    for (let k = -3; k <= 3; k++) { const ext = 54 - Math.abs(k + 0.5) * 3; T.stampRect(0, c.x, c.z + 10 + k * 20, ext, 1.8, 0, 0.8); T.stampRect(0, c.x + 10 + k * 20, c.z, 1.8, ext, 0, 0.8); }
    T.stamp(1, c.x, c.z, 16, 1.0);
    let n = 0;
    for (let gx = -3; gx <= 3; gx++) for (let gz = -3; gz <= 3; gz++) {
      const x = c.x + gx * 20 + (hash2(gx, gz, 1) - 0.5) * 2, z = c.z + gz * 20 + (hash2(gx, gz, 2) - 0.5) * 2, d = Math.hypot(x - c.x, z - c.z);
      if (d > 62 || d < 25) continue;
      if (Math.abs(x - c.x) < 14 && z < c.z - 36 && z > c.z - 62) continue; // 市政廳
      const w = hash2(gx, gz, 3) < 0.5 ? 8 : 10, dd = hash2(gx, gz, 4) < 0.55 ? 8 : 10;
      if (inTest(x, z, 8)) continue; // 測試區留白
      if (hash2(gx, gz, 5) < 0.1) continue;
      const yaw = face(x, z, c.x, c.z);
      const sw = Math.abs(Math.sin(yaw)) > 0.5; // 轉 90° 後佔用寬深互換，無須處理（house 自帶）
      if (house(cl, { x, z, yaw, w, d: dd, floors: 2, backDoor: rng() < 0.4, loot: 3, chest: 0.5 })) n++;
    }
    // 市政廳
    house(cl, { x: c.x, z: c.z - 48, yaw: Math.PI, w: 14, d: 10, floors: 2, mat: 'stone', wall: '#e8d4a8', roof: '#4f7ee8', trim: '#fff', chimney: false, porch: true, loot: 4, chest: 0.9, base: '#9d9a92' });
    { const [ox, oz] = [c.x, c.z - 48]; // 鐘樓
      cl.deco.add(ox, FLAT_Y + 11.5, oz + 0.5, 1.8, 3.5, 1.8, '#e8d4a8'); cl.deco.add(ox, FLAT_Y + 15.6, oz + 0.5, 2.2, 0.35, 2.2, '#4f7ee8'); cl.deco.addGeo(new THREE.ConeGeometry(2.0, 3.6, 4), new THREE.Matrix4().makeTranslation(ox, FLAT_Y + 17.5, oz + 0.5).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 4)), '#4f7ee8');
      cl.deco.add(ox, FLAT_Y + 12.3, oz + 2.35, 1.0, 1.0, 0.06, '#fff'); cl.glow.add(ox, FLAT_Y + 12.3, oz + 2.42, 0.85, 0.85, 0.03, hot('#fff3c0', 1.5));
      props.solid(ox, FLAT_Y + 11.5, oz + 0.5, 1.8, 3.5, 1.8); }
    // 路燈與長椅
    for (let a = -4; a <= 3; a++) for (let b = -4; b <= 3; b++) { const x = c.x + 10 + a * 20, z = c.z + 10 + b * 20; if (Math.hypot(x - c.x, z - c.z) > 62 || inTest(x, z, 3) || W.blocked(x, z, 1)) continue; props.lamp(cl, x, z, T.heightAt(x, z)); }
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.5, x = c.x + Math.cos(a) * 9, z = c.z + Math.sin(a) * 9; if (inTest(x, z, 2)) continue; props.bench(cl, x, z, fy, -a - Math.PI / 2); }
    // 攤位：木桌 + 條紋雨棚 + 箱子
    for (const [sx, sz, col] of [[-11, 31, '#e2574c'], [-14, 8, '#4f7ee8'], [12, 5, '#f2a83c']]) {
      const D = cl.deco; D.add(sx, fy + 0.5, sz, 1.5, 0.5, 0.6, '#b07a45'); D.add(sx, fy + 2.4, sz, 1.8, 0.07, 1.0, col, 0, 0.1);
      for (const q of [-1.6, 1.6]) D.add(sx + q, fy + 1.2, sz - 0.8, 0.06, 1.2, 0.06, '#8a5a33');
      props.crate(cl, sx - 2.6, sz + 0.2, fy, 0.9); props.crate(cl, sx + 2.4, sz, fy, 0.8, '#d9a35b'); props.solid(sx, fy + 0.5, sz, 1.5, 0.5, 0.6); W.addBlocker(sx, sz, 3);
      W.lootSpots.push({ x: sx, y: fy + 1.05, z: sz + 0.2, inside: false, poi: c.name });
    }
    // 街區裡的行道樹、灌木與花圃
    const TREE = ['#4fd04a', '#66dc4a', '#ffb23a', '#ff9ec7', '#8ae04a'];
    for (let i = 0, k = 0; i < 400 && k < 34; i++) {
      const x = c.x + (rng() - 0.5) * 130, z = c.z + (rng() - 0.5) * 130, d = Math.hypot(x - c.x, z - c.z);
      if (d < 20 || d > 66 || inTest(x, z, 4) || W.blocked(x, z, 2.2) || T.maskAt(x, z, 0) > 0.03 || T.maskAt(x, z, 1) > 0.03) continue;
      const bush = rng() < 0.45, h = T.heightAt(x, z);
      W.natureItems.push(bush ? { type: 'bush', x, y: h, z, s: 0.8 + rng() * 0.7, rot: rng() * 6, color: TREE[rng.int(2)] } : { type: 'broad', x, y: h, z, s: 0.8 + rng() * 0.5, rot: rng() * 6, color: TREE[rng.int(TREE.length)] });
      W.addBlocker(x, z, bush ? 1.1 : 1.6); k++;
    }
    W.stat.hw = n;
  }
  // ================= 風車農場 =================
  {
    const cl = W.cluster('farm'), c = P[1], fy = FLAT_Y;
    // 田地
    const fields = [[-30, 14, 15, 9], [-30, -6, 15, 9], [30, -22, 14, 8]];
    for (const [ox, oz, hx, hz] of fields) {
      T.stampRect(2, c.x + ox, c.z + oz, hx, hz, 0, 1.0); W.addBlocker(c.x + ox, c.z + oz, Math.max(hx, hz) * 0.9);
      for (let i = -hx + 1.2; i < hx - 1; i += 2.0) for (let j = -hz + 1.2; j < hz - 1; j += 1.6) {
        const col = ['#5fcf3a', '#7fd94a', '#e2574c', '#f2a83c', '#a45ad8'][Math.floor(hash2(Math.round(i), Math.round(j), ox) * 5)], hh = 0.35 + hash2(Math.round(i * 3), Math.round(j * 3), 7) * 0.25;
        cl.deco.add(c.x + ox + i, T.heightAt(c.x + ox + i, c.z + oz + j) + hh / 2 + 0.05, c.z + oz + j, 0.38, hh / 2, 0.38, col);
      }
      props.fence(cl, c.x + ox - hx - 1, c.z + oz - hz - 1, c.x + ox + hx + 1, c.z + oz - hz - 1, fy);
      props.fence(cl, c.x + ox - hx - 1, c.z + oz + hz + 1, c.x + ox + hx + 1, c.z + oz + hz + 1, fy);
    }
    // 紅色穀倉：中間兩格大門
    const barn = house(cl, { x: c.x + 12, z: c.z + 10, yaw: 0, w: 12, d: 10, floors: 2, wall: '#c8392f', roof: '#7a5238', trim: '#fff', shutter: '#fff', chimney: false, porch: false, loot: 5, chest: 1, flowers: false, slope: 2,
      pattern: (side, cc, n, L) => { if (side === 'front') { if (L === 0) return cc === 2 || cc === 3 ? 'door' : 'solid'; return cc === 2 || cc === 3 ? 'window' : 'solid'; } if (side === 'back') return L === 1 && cc === 2 ? 'window' : 'solid'; return (cc % 2 === 1 && L === 1) ? 'window' : 'solid'; } });
    if (barn) { const D = cl.deco, bx = c.x + 12, bz = c.z + 10 - 5.2; // 大門的 X 型白框
      for (const s of [-1, 1]) { D.add(bx + s * 1.0, FLAT_Y + 1.6, bz - 0.1, 0.07, 1.9, 0.05, '#fff', 0, 0); D.add(bx + s * 1.0, FLAT_Y + 1.6, bz - 0.1, 0.05, 2.35, 0.04, '#fff', 0, 0.0); }
      for (const s of [-1, 1]) D.add(bx + s * 1.0, FLAT_Y + 1.7, bz - 0.12, 0.05, 1.9, 0.04, '#fff', 0, s * 0.8); }
    house(cl, { x: c.x - 16, z: c.z + 14 - 38, yaw: face(c.x - 16, c.z - 24, c.x, c.z), w: 8, d: 8, floors: 2, wall: '#fff0d6', roof: '#c8392f', backDoor: true, loot: 3 });
    house(cl, { x: c.x - 18, z: c.z + 30 - 42, yaw: Math.PI / 2, w: 8, d: 6, floors: 1, wall: '#f7e8c8', roof: '#4f7ee8', loot: 2, chest: 0.6 });
    house(cl, { x: c.x + 26, z: c.z - 4, yaw: -Math.PI / 2, w: 6, d: 6, floors: 1, wall: '#9fd6a0', roof: '#c9a45a', loot: 2, chest: 0.5 });
    props.silo(cl, c.x + 30, c.z + 14, fy, 2.7, 11); props.silo(cl, c.x + 30, c.z + 20, fy, 2.2, 8.5);
    props.windmill(cl, c.x - 4, c.z - 30, fy, 0.0);
    // 圍欄牧場 + 乾草堆 + 稻草人
    const cx0 = c.x - 8, cz0 = c.z + 24, hw = 11, hd = 7;
    props.fence(cl, cx0 - hw, cz0 - hd, cx0 + hw, cz0 - hd, fy); props.fence(cl, cx0 + hw, cz0 - hd, cx0 + hw, cz0 + hd, fy); props.fence(cl, cx0 + hw, cz0 + hd, cx0 - hw, cz0 + hd, fy); props.fence(cl, cx0 - hw, cz0 + hd, cx0 - hw, cz0 - 1, fy);
    for (let i = 0; i < 11; i++) { const x = c.x + (rng() - 0.5) * 66, z = c.z + (rng() - 0.5) * 66; if (Math.hypot(x - c.x, z - c.z) > 40 || W.blocked(x, z, 2.5)) continue; props.hay(cl, x, z, T.heightAt(x, z), rng() * 3); W.addBlocker(x, z, 1.5); }
    for (const [x, z] of [[c.x - 38, c.z + 3], [c.x + 38, c.z - 14]]) { const D = cl.deco, y = T.heightAt(x, z); D.add(x, y + 1.0, z, 0.06, 1.0, 0.06, '#7a4a28'); D.add(x, y + 1.6, z, 0.8, 0.06, 0.06, '#7a4a28'); D.add(x, y + 1.9, z, 0.3, 0.3, 0.3, '#e8c15a'); D.add(x, y + 2.3, z, 0.45, 0.1, 0.45, '#8a5a33'); D.add(x, y + 2.55, z, 0.22, 0.15, 0.22, '#8a5a33'); }
    for (let i = 0; i < 8; i++) { const a = rng() * 6.28, d = rng.range(10, 36), x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d; if (W.blocked(x, z, 2) || T.maskAt(x, z, 2) > 0.1) continue; props.crate(cl, x, z, T.heightAt(x, z), 1); W.lootSpots.push({ x, y: T.heightAt(x, z) + 1.05, z, inside: false, poi: c.name }); }
  }
  // ================= 錫罐港 =================
  {
    const cl = W.cluster('harbor'), c = P[2], dx = BAY.dx, dz = BAY.dz, px = -dz, pz = dx, fy = FLAT_Y;
    const U = (u, v) => [c.x + dx * u + px * v, c.z + dz * u + pz * v], yawAxis = Math.atan2(-dz, dx);
    // 碼頭：沿軸線找到岸線
    const shoreU = (v) => { for (let u = 10; u < 110; u += 0.5) { const [x, z] = U(u, v); if (T.heightAt(x, z) < 1.2) return u; } return 40; };
    for (const v of [0, 15]) { const u0 = shoreU(v) - 2.5; const [x, z] = U(u0, v); props.pier(cl, x, z, { x: dx, z: dz }, 27 - v * 0.4, 4.6, fy + 0.05); }
    { const u0 = shoreU(0) - 2.5 + 27; const [x, z] = U(u0 - 1, 0); const D = cl.deco;
      cl.panels.add({ pk: 'floor', kind: KIND.floor, mat: 'wood', cx: U(u0, 0)[0], cy: fy - 0.07, cz: U(u0, 0)[1], sx: 4.5, sy: 0.24, sz: 13, yaw: yawAxis, color: '#b98450', debrisColor: '#b98450', hp: 160 });
      for (const sd of [-1, 1]) { const [ax, az] = U(u0, sd * 6); props.cyl(D, ax, -4.5, az, 0.24, 0.28, 4.5 + fy + 0.5, '#6a4a2e', 6); } }
    // 船
    for (const [u, v, col] of [[shoreU(7) + 6, 7.5, '#f7f2e8'], [shoreU(-9) + 12, -9, '#ffe14d'], [shoreU(22) + 10, 22, '#e2574c']]) { const [x, z] = U(u, v); if (T.heightAt(x, z) < -1.5) props.boat(cl, x, z, yawAxis, col); }
    // 倉庫（金屬／磚）
    const wh = [[-8, -28, 16, 10, 'metal', '#8cc8f5', '#e2574c'], [-8, 28, 16, 10, 'stone', '#d9826a', '#4a5568'], [-30, 0, 12, 8, 'metal', '#fff0a8', '#2fb8a0']];
    for (const [u, v, w, d, mt, wall, roof] of wh) { const [x, z] = U(u, v); house(cl, { x, z, yaw: face(x, z, c.x + dx * 30, c.z + dz * 30, false), w, d, floors: d >= 8 && w >= 12 ? 2 : 1, mat: mt, wall, roof, base: '#8d8a84', chimney: false, porch: false, loot: 4, chest: 0.8, flowers: false, slope: 2.2, pitch: 0.38 }); }
    // 貨櫃場：中間列兩層堆疊、可進入
    const cols = ['#e2574c', '#3a8fd8', '#f2a83c', '#4fb06a', '#a45ad8', '#33b5c6'];
    let k = 0;
    for (let row = -1; row <= 1; row += 1) for (let i = 0; i < 3; i++) {
      const [x, z] = U(-14 + i * 6.8, row * 5.2 + (row === 0 ? 0 : row * 0.0)); if (T.heightAt(x, z) < 2) continue;
      props.container(cl, x, fy, z, yawAxis, cols[k++ % cols.length], 6, (i + row) % 2 === 0);
      if ((i + row) % 2 === 1) props.container(cl, x, fy + 2.6, z, yawAxis + (i % 2 ? 0.0 : 0), cols[k++ % cols.length], 6, i % 2 === 0);
      if ((i + row) % 2 === 0 && rng() < 0.7) W.lootSpots.push({ x, y: fy + 0.2, z, inside: true, poi: c.name });
    }
    // 箱子階梯通往一層貨櫃頂（貨櫃局部 +z 側）
    { const [x, z] = U(-14 + 6.8, 5.2); const yawC = yawAxis; const cs2 = Math.cos(yawC), sn2 = Math.sin(yawC); props.crateStairs(cl, x - (-1) * 0 + sn2 * 1.65, fy, z + cs2 * 1.65, yawC + 0.0, 2.6, 5, 1.5); }
    for (let i = 0; i < 10; i++) { const [x, z] = U(rng.range(-24, 8), rng.range(-14, 14)); if (W.blocked(x, z, 2) || T.heightAt(x, z) < 2) continue; (i % 2 ? props.crate(cl, x, z, fy, 1) : props.barrel(cl, x, z, fy, ['#d8483c', '#3a8fd8', '#4fb06a'][i % 3])); W.addBlocker(x, z, 1); }
    // 燈塔：找一個靠水、平坦的點
    let lh = null;
    for (let r = 46; r < 110 && !lh; r += 4) for (let a = 0; a < 6.283; a += 0.3) { const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r, h = T.heightAt(x, z); if (h < 2.2 || h > 6 || W.blocked(x, z, 6)) continue; let near = false; for (let b = 0; b < 6.283; b += 0.8) if (T.heightAt(x + Math.cos(b) * 12, z + Math.sin(b) * 12) < 0) near = true; if (near && Math.hypot(x - c.x, z - c.z) < 100) { lh = [x, z, h]; break; } }
    if (lh) props.lighthouse(cl, lh[0], lh[1], lh[2]); else props.lighthouse(cl, c.x + 34, c.z - 30, Math.max(T.heightAt(c.x + 34, c.z - 30), FLAT_Y));
    // 起重機、油罐、鐵網圍欄、路燈
    { const [x, z] = U(8, -14); props.crane(cl, x, z, fy, yawAxis); }
    for (let i = 0; i < 3; i++) { const [x, z] = U(-34 + i * 7, 26); const y = T.heightAt(x, z); if (y < 2) continue; props.cyl(cl.deco, x, y, z, 2.6, 2.6, 6, ['#f7f2e8', '#e2574c', '#f7f2e8'][i], 14); props.solid(x, y + 3, z, 2.1, 3, 2.1, 0, props.landmark('metal')); props.solid(x, y + 3, z, 2.1, 3, 2.1, Math.PI / 4, props.landmark('metal')); W.addBlocker(x, z, 3.4); }
    { const [a, b] = [U(-34, -20), U(-34, 20)]; props.fence(cl, a[0], a[1], b[0], b[1], fy, 'metal', 1.8); }
    for (const [u, v] of [[-20, -14], [-20, 14], [5, 8], [5, -8], [-35, 0]]) { const [x, z] = U(u, v); if (T.heightAt(x, z) > 2.5 && !W.blocked(x, z, 1)) props.lamp(cl, x, z, T.heightAt(x, z), 5); }
    T.stamp(1, c.x - dx * 10, c.z - dz * 10, 24, 1.2); // 碼頭鋪面
  }
  // ================= 菇菇林 =================
  {
    const cl = W.cluster('grove'), c = P[3], fy = FLAT_Y;
    T.stamp(0, c.x, c.z, 5, 1.0); // 中央空地（土）
    // 營火
    cl.deco.add(c.x, fy + 0.15, c.z, 0.6, 0.15, 0.6, '#5a4a40'); cl.glow.add(c.x, fy + 0.7, c.z, 0.22, 0.45, 0.22, hot('#ffb347', 3.0)); cl.glow.add(c.x, fy + 1.0, c.z, 0.12, 0.3, 0.12, hot('#ffe08a', 3.4));
    props.solid(c.x, fy + 0.3, c.z, 0.6, 0.3, 0.6); W.addBlocker(c.x, c.z, 4);
    for (let i = 0; i < 5; i++) { const a = i * 1.257, x = c.x + Math.cos(a) * 3.4, z = c.z + Math.sin(a) * 3.4; cl.deco.add(x, fy + 0.25, z, 0.55, 0.25, 0.25, '#8a5a33', -a); props.solid(x, fy + 0.25, z, 0.5, 0.25, 0.3, -a); }
    const cabins = [[24, 0.2, 8, 8], [30, 1.15, 7, 7], [26, 2.1, 8, 6], [33, 3.1, 8, 8], [27, 4.0, 6, 6], [31, 5.0, 8, 7], [22, 5.8, 6, 6]];
    const walls = ['#a8714a', '#c08a58', '#8fae6a', '#b9824f', '#d8a766'], roofs = ['#e2574c', '#2fb8a0', '#d9476f', '#f2a83c', '#8a5ad8'];
    let n = 0;
    for (const [d, a, w, dd] of cabins) {
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      if (house(cl, { x, z, yaw: face(x, z, c.x, c.z), w, d: dd, floors: dd >= 8 ? 2 : 1, wallKind: KIND.log, wall: walls[n % walls.length], roof: roofs[n % roofs.length], trim: '#f2e0c0', shutter: '#6a8a4a', base: '#8d8a84', loot: 3, chest: 0.5, pitch: 0.85, slope: 2 })) n++;
    }
    // 小路
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3; T.stampRect(0, c.x + Math.cos(a) * 14, c.z + Math.sin(a) * 14, 8, 1.1, -a, 0.8); }
    // 倒木與石圈
    for (let i = 0; i < 6; i++) { const a = rng() * 6.28, d = rng.range(8, 34), x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d; if (W.blocked(x, z, 2) || T.heightAt(x, z) < 2.5) continue; const y = T.heightAt(x, z); cl.deco.add(x, y + 0.4, z, 1.6, 0.4, 0.4, '#7a4a28', rng() * 3); W.addBlocker(x, z, 1.8); }
  }
  // ================= 鵝卵石採場 =================
  {
    const cl = W.cluster('pit'), c = P[4], fy = PIT.top;
    const ring = [[0.4, 42, 7, 6, 'wood'], [1.9, 43, 6, 6, 'stone'], [3.3, 41, 8, 6, 'wood'], [4.7, 43, 7, 6, 'stone'], [5.8, 41, 8, 8, 'wood']];
    for (const [a, d, w, dd, mt] of ring) { const x = PIT.cx + Math.cos(a) * d, z = PIT.cz + Math.sin(a) * d; house(cl, { x, z, yaw: face(x, z, PIT.cx, PIT.cz), w, d: dd, floors: dd >= 8 ? 2 : 1, mat: mt, wall: mt === 'stone' ? '#b9b2a6' : '#c9a56a', roof: ['#6a7a8a', '#9a6a3c'][mt === 'stone' ? 0 : 1], loot: 3, chest: 0.5, flowers: false, chimney: mt === 'stone', slope: 2 }); }
    props.crane(cl, PIT.cx + 38, PIT.cz - 8, fy, 0.9);
    // 採出的石塊堆（可打、給石頭）：坑底與坑緣
    for (let i = 0; i < 12; i++) { const a = rng() * 6.28, d = rng.range(4, 26), x = PIT.cx + Math.cos(a) * d, z = PIT.cz + Math.sin(a) * d, y = T.heightAt(x, z); if (W.blocked(x, z, 2)) continue; const s = 1.2 + rng() * 0.8; cl.panels.add({ pk: 'prop', kind: KIND.brick, mat: 'stone', cx: x, cy: y + s / 2, cz: z, sx: s * 1.4, sy: s, sz: s, yaw: rng() * 3, color: ['#b8b0a4', '#a39d92', '#c7bfb2'][i % 3], hp: 210, debrisColor: '#b8b0a4' }); W.addBlocker(x, z, 1.4); }
    // 礦車與軌道
    for (let i = 0; i < 12; i++) { const x = PIT.cx - 22 + i * 1.6, z = PIT.cz + 20 + i * 0.2; const y = T.heightAt(x, z); cl.deco.add(x, y + 0.08, z, 0.8, 0.04, 0.05, '#555'); cl.deco.add(x, y + 0.08, z + 0.9, 0.8, 0.04, 0.05, '#555'); cl.deco.add(x, y + 0.04, z + 0.45, 0.06, 0.03, 0.55, '#6a4a2e'); }
    { const x = PIT.cx - 14, z = PIT.cz + 20.5, y = T.heightAt(x, z); cl.panels.add({ pk: 'prop', kind: KIND.metal, mat: 'metal', cx: x, cy: y + 0.7, cz: z, sx: 2.0, sy: 1.0, sz: 1.5, color: '#c9763a', hp: 200, debrisColor: '#c9763a' }); }
    for (let i = 0; i < 6; i++) { const a = rng() * 6.28, d = rng.range(36, 46), x = PIT.cx + Math.cos(a) * d, z = PIT.cz + Math.sin(a) * d; if (!W.blocked(x, z, 2) && T.heightAt(x, z) > 2.5) { props.barrel(cl, x, z, T.heightAt(x, z), '#6a7a8a'); W.lootSpots.push({ x, y: T.heightAt(x, z) + 0.05, z, inside: false, poi: c.name }); } }
  }
  // ================= 零散建築 =================
  {
    const cl = W.cluster('misc');
    // 加油站：靠 0↔2 的路邊
    { const path = ROAD_PATHS[1], p = path[16], q = path[17], yaw = Math.atan2(-(q[0] - p[0]), -(q[1] - p[1])); let gx = p[0] + Math.cos(yaw) * 14, gz = p[1] - Math.sin(yaw) * 14;
      const gy = Math.max(T.heightAt(gx, gz), 3);
      // 店面：小型單層，招牌朝路
      const shop = house(cl, { x: gx, z: gz, yaw: yaw + Math.PI, w: 8, d: 6, floors: 1, wall: '#fff0a8', roof: '#e2574c', trim: '#fff', loot: 3, chest: 0.8, pitch: 0.3, flowers: false, slope: 2.5, chimney: false, porch: false });
      props.gasStation(cl, gx, gz, yaw + Math.PI, gy);
      T.stamp(1, gx, gz - 4, 10, 1.0); }
    // 散落屋舍
    let placed = 0;
    for (let t = 0; t < 400 && placed < 10; t++) {
      const x = rng.range(-300, 300), z = rng.range(-300, 300), h = T.heightAt(x, z);
      if (h < 3 || h > 16 || W.nearPoi(x, z, 1.3) || W.blocked(x, z, 8) || T.maskAt(x, z, 0) > 0.02) continue;
      const w = rng() < 0.5 ? 8 : 6, d = rng() < 0.5 ? 8 : 6;
      if (house(cl, { x, z, yaw: Math.floor(rng() * 4) * Math.PI / 2, w, d, floors: d >= 8 ? 2 : 1, loot: 3, chest: 0.55, slope: 0.9 })) placed++;
    }
    // 路上廢棄車
    const colors = ['#d9534f', '#e0a030', '#3fa7a0', '#6f8fd8', '#b8c0c8', '#8a6fd0'];
    let cars = 0;
    ROAD_PATHS.forEach((path, ri) => {
      for (let i = 4 + ri; i < path.length - 4; i += 9) {
        const p = path[i], q = path[i + 1], yaw = Math.atan2(-(q[1] - p[1]), q[0] - p[0]), side = (i % 2 ? 1 : -1) * 2.9, nx = -(q[1] - p[1]), nz = q[0] - p[0], nl = Math.hypot(nx, nz) || 1;
        const x = p[0] + nx / nl * side, z = p[1] + nz / nl * side;
        if (W.blocked(x, z, 2.5) || T.heightAt(x, z) < 2 || inTest(x, z, 4) || cars > 18) continue;
        props.car(cl, x, z, yaw + (rng() - 0.5) * 0.4 + (rng() < 0.5 ? Math.PI : 0), colors[cars++ % colors.length]); W.addBlocker(x, z, 2.4);
      }
    });
    // 湖邊小碼頭
    { const lx = LAKE.cx - LAKE.rx * 0.85, lz = LAKE.cz; props.pier(cl, lx - 3, lz, { x: 1, z: 0 }, 9, 2.4, 0.9); props.boat(cl, lx + 6, lz + 4, 0.4, '#f2a83c'); }
  }
}
