// 場景道具與地標：噴水池、路燈、車子、貨櫃、風車、筒倉、燈塔、碼頭、船、加油站、起重機、圍欄、乾草堆…
// 可被打的（車、貨櫃、箱子、桶、圍欄）走 Panels；大型地標是靜態裝飾 + 不可破壞 collider。
import * as THREE from 'three';
import { KIND } from './world-panels.js';
import { merge, paint, tinted, instMat, BoxBatch } from './geo.js';

const hot = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler(), _V = new THREE.Vector3(), _S = new THREE.Vector3();
export function mat4(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) { return _M.compose(_V.set(x, y, z), _Q.setFromEuler(_E.set(rx, ry, rz, 'YXZ')), _S.set(sx, sy, sz)).clone(); }

let _carGeo = null;
function carGeo() {
  if (_carGeo) return _carGeo;
  const parts = [];
  const box = (x, y, z, sx, sy, sz, color, tint = 0) => { const g = new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z); g.deleteAttribute('uv'); paint(g, color); tinted(g, tint); parts.push(g); };
  box(0, 0.62, 0, 4.2, 0.7, 1.9, '#ffffff', 1); // 車身
  box(-0.1, 1.2, 0, 2.3, 0.62, 1.7, '#ffffff', 1); // 車廂
  box(-0.1, 1.22, 0, 2.34, 0.4, 1.74, '#2b3d52'); // 車窗
  box(2.12, 0.45, 0, 0.14, 0.22, 1.7, '#8c9199'); box(-2.12, 0.45, 0, 0.14, 0.22, 1.7, '#8c9199'); // 保險桿
  box(2.1, 0.68, 0.6, 0.06, 0.18, 0.3, '#fff0b0'); box(2.1, 0.68, -0.6, 0.06, 0.18, 0.3, '#fff0b0');
  box(-0.1, 1.54, 0, 2.0, 0.05, 1.5, '#ffffff', 1);
  box(1.0, 0.99, 0, 0.9, 0.04, 1.6, '#ffffff', 1); // 引擎蓋
  box(0.4, 0.5, 0.96, 1.2, 0.3, 0.04, '#8a4a2a'); box(-1.3, 0.8, -0.96, 0.9, 0.2, 0.04, '#8a4a2a'); // 鏽斑
  for (const [x, z] of [[1.35, 0.95], [1.35, -0.95], [-1.35, 0.95], [-1.35, -0.95]]) {
    const g = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 10).rotateX(Math.PI / 2).translate(x, 0.42, z); g.deleteAttribute('uv'); paint(g, '#2a2a2e'); tinted(g, 0); parts.push(g);
    const h = new THREE.CylinderGeometry(0.2, 0.2, 0.36, 8).rotateX(Math.PI / 2).translate(x, 0.42, z); h.deleteAttribute('uv'); paint(h, '#c9ccd2'); tinted(h, 0); parts.push(h);
  }
  return (_carGeo = merge(parts));
}
let _barrelGeo = null, _cylGeo = null;
export const cylUnit = () => (_cylGeo ||= (() => { const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 12); g.deleteAttribute('uv'); return g; })());

export class Props {
  constructor(world) { this.W = world; this.ctx = world.ctx; }
  // ---- 靜態碰撞 ----
  solid(cx, cy, cz, hx, hy, hz, yaw = 0, owner = null) { this.ctx.physics.addBox({ cx, cy, cz, hx, hy, hz, yaw, owner, kind: 'prop' }); }
  // 不可破壞地標 owner：打得到、給材料，但不會壞
  landmark(material) { return { kind: 'landmark', harvest: { material }, takeDamage() {} }; }
  cyl(D, x, y, z, rt, rb, h, color, seg = 12) { const g = new THREE.CylinderGeometry(rt, rb, h, seg); D.addGeo(g, mat4(x, y + h / 2, z), color); }
  // ---- 噴水池 ----
  fountain(cl, x, z, y) {
    const D = cl.deco, G = cl.glow;
    this.cyl(D, x, y - 0.4, z, 3.5, 3.6, 1.1, '#d9d4c8', 16); // 池身
    this.cyl(D, x, y + 0.7, z, 3.55, 3.55, 0.18, '#f0ece2', 16); // 池緣
    this.cyl(D, x, y + 0.5, z, 3.1, 3.1, 0.12, hot('#46d8e8', 1.15), 16); // 水面
    this.cyl(D, x, y + 0.5, z, 0.7, 0.9, 1.5, '#cfc9bc', 10); this.cyl(D, x, y + 1.9, z, 1.6, 0.5, 0.35, '#e6e1d4', 12);
    this.cyl(D, x, y + 2.2, z, 0.3, 0.4, 1.0, '#cfc9bc', 8); this.cyl(D, x, y + 3.1, z, 0.9, 0.3, 0.25, '#e6e1d4', 12);
    G.add(x, y + 3.9, z, 0.1, 0.55, 0.1, hot('#bff4ff', 1.6));
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; G.add(x + Math.cos(a) * 1.6, y + 1.0 + Math.sin(i) * 0.05, z + Math.sin(a) * 1.6, 0.05, 0.35, 0.05, hot('#bff4ff', 1.4)); }
    this.solid(x, y + 0.45, z, 3.4, 0.65, 3.4, 0); this.solid(x, y + 0.45, z, 3.4, 0.65, 3.4, Math.PI / 4);
    this.solid(x, y + 2.0, z, 0.55, 1.5, 0.55);
    this.W.addBlocker(x, z, 5);
  }
  lamp(cl, x, z, y, tall = 4.2) {
    const D = cl.deco, G = cl.glow; this.cyl(D, x, y, z, 0.09, 0.14, tall, '#3a3f4a', 6);
    D.add(x, y + tall + 0.1, z, 0.2, 0.06, 0.2, '#3a3f4a'); G.add(x, y + tall + 0.32, z, 0.15, 0.2, 0.15, hot('#ffe2a0', 2.6));
    this.solid(x, y + tall / 2, z, 0.14, tall / 2, 0.14); this.W.addBlocker(x, z, 0.8);
  }
  bench(cl, x, z, y, yaw) {
    const D = cl.deco, c = Math.cos(yaw), s = Math.sin(yaw), w = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    D.add(x, y + 0.5, z, 0.9, 0.05, 0.25, '#b07a45', yaw); const [bx, bz] = w(0, 0.22); D.add(bx, y + 0.85, bz, 0.9, 0.22, 0.04, '#b07a45', yaw);
    for (const sx of [-0.75, 0.75]) { const [px, pz] = w(sx, 0); D.add(px, y + 0.25, pz, 0.05, 0.25, 0.22, '#3a3f4a', yaw); }
    this.solid(x, y + 0.45, z, 0.9, 0.45, 0.3, yaw);
  }
  // ---- 會被打壞的小東西 ----
  crate(cl, x, z, y, s = 1, color = '#c99455') { return cl.panels.add({ pk: 'prop', kind: KIND.plank, mat: 'wood', cx: x, cy: y + s / 2, cz: z, sx: s, sy: s, sz: s, yaw: (x * 7.3 + z * 3.1) % 3, color, hp: 70 * s, debrisColor: color }); }
  barrel(cl, x, z, y, color = '#d8483c') {
    const p = cl.panels; if (!p.types.has('cyl')) p.addType('cyl', cylUnit(), null);
    return p.add({ type: 'cyl', pk: 'prop', kind: KIND.metal, mat: 'metal', cx: x, cy: y + 0.55, cz: z, sx: 0.8, sy: 1.1, sz: 0.8, color, hp: 130, debrisColor: color, cols: [{ cx: x, cy: y + 0.55, cz: z, hx: 0.4, hy: 0.55, hz: 0.4 }] });
  }
  hay(cl, x, z, y, yaw = 0) {
    const p = cl.panels; if (!p.types.has('cyl')) p.addType('cyl', cylUnit(), null);
    const r = 0.8, len = 1.5;
    return p.add({ type: 'cyl', pk: 'prop', kind: KIND.log, mat: 'wood', cx: x, cy: y + r, cz: z, sx: r * 2, sy: len, sz: r * 2, yaw, roll: Math.PI / 2, color: '#e8c15a', hp: 90, debrisColor: '#e8c15a', cols: [{ cx: x, cy: y + r, cz: z, hx: len / 2, hy: r, hz: r * 0.92, yaw }] });
  }
  fence(cl, x0, z0, x1, z1, y, mat = 'wood', h = 1.05) { // 沿線段的圍欄（每 3 m 一塊）
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 3)), yaw = Math.atan2(-(z1 - z0), x1 - x0), D = cl.deco;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, cx = x0 + (x1 - x0) * t, cz = z0 + (z1 - z0) * t, sl = L / n, hh = this.W.ctx.terrain.heightAt(cx, cz), yy = Math.max(y ?? hh, hh);
      cl.panels.add({ pk: 'prop', kind: mat === 'metal' ? KIND.metal : KIND.plank, mat, cx, cy: yy + h / 2, cz, sx: sl - 0.1, sy: h, sz: 0.1, yaw, color: mat === 'metal' ? '#aab4bf' : '#f2ead8', hp: mat === 'metal' ? 160 : 70, debrisColor: mat === 'metal' ? '#aab4bf' : '#f2ead8' });
    }
    for (let i = 0; i <= n; i++) { const t = i / n, cx = x0 + (x1 - x0) * t, cz = z0 + (z1 - z0) * t, hh = this.W.ctx.terrain.heightAt(cx, cz), yy = Math.max(y ?? hh, hh); D.add(cx, yy + h / 2 + 0.08, cz, 0.07, h / 2 + 0.08, 0.07, mat === 'metal' ? '#7d8791' : '#c9b99a'); }
  }
  // ---- 車 ----
  car(cl, x, z, yaw, color) {
    const p = cl.panels; if (!p.types.has('car')) p.addType('car', carGeo(), instMat({ rough: 0.6, metal: 0.25 }));
    const h = Math.max(this.W.ctx.terrain.heightAt(x, z), 0.1) + 0.02;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    return p.add({ type: 'car', pk: 'prop', mat: 'metal', cx: x, cy: h, cz: z, sx: 1, sy: 1, sz: 1, yaw, color, hp: 230, debrisColor: color, cols: [{ cx: x, cy: h + 0.9, cz: z, hx: 2.1, hy: 0.75, hz: 0.95, yaw }] });
  }
  // ---- 貨櫃：中空可進入（地、頂、後、左右牆）----
  container(cl, x, y, z, yaw, color, len = 6, open = true) {
    const w = 2.4, h = 2.6, t = 0.12, cs = Math.cos(yaw), sn = Math.sin(yaw), L2W = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
    const pn = (lx, ly, lz, sx, sy, sz) => { const [px, pz] = L2W(lx, lz); return cl.panels.add({ pk: 'prop', kind: KIND.metal, mat: 'metal', cx: px, cy: y + ly, cz: pz, sx, sy, sz, yaw, color, hp: 260, debrisColor: color }); };
    pn(0, h - t / 2, 0, len, t, w); pn(0, t / 2, 0, len, t, w);
    pn(0, h / 2, w / 2 - t / 2, len, h, t); pn(0, h / 2, -w / 2 + t / 2, len, h, t);
    pn(-len / 2 + t / 2, h / 2, 0, t, h, w);
    if (!open) pn(len / 2 - t / 2, h / 2, 0, t, h, w);
    else { // 半開的門板
      const D = cl.deco; for (const s of [-1, 1]) { const [px, pz] = L2W(len / 2 + 0.7, s * (w / 2 + 0.4)); D.add(px, y + h / 2, pz, 0.04, h / 2 - 0.05, 1.0, new THREE.Color(color).multiplyScalar(0.8), yaw + s * 0.5); }
    }
    this.W.addBlocker(x, z, len / 2 + 1); (this.W.landmarks.containers ||= []).push({ x, y, z, yaw });
    return L2W;
  }
  // 箱子階梯：沿 yaw 的局部 +z 方向由高到低（最高 topH），讓玩家能爬上貨櫃頂
  crateStairs(cl, x, y, z, yaw, topH = 2.6, n = 5, wid = 1.5) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (let i = 0; i < n; i++) {
      const h = topH * (i + 1) / n, lz = 0.9 * (n - 1 - i), px = x + lz * s, pz = z + lz * c;
      cl.panels.add({ pk: 'prop', kind: KIND.plank, mat: 'wood', cx: px, cy: y + h / 2, cz: pz, sx: wid, sy: h, sz: 0.9, yaw, color: i % 2 ? '#c99455' : '#b9833f', hp: 90, debrisColor: '#c99455' });
    }
    this.W.addBlocker(x + (n - 1) * 0.45 * s, z + (n - 1) * 0.45 * c, 3); (this.W.landmarks.crateStairs ||= []).push({ x, y, z, yaw, topH, n });
  }
  // ---- 風車 ----
  windmill(cl, x, z, y, yaw = 0) {
    const D = cl.deco, G = cl.glow, W = this.W, H = 13;
    const tower = new THREE.CylinderGeometry(1.7, 2.7, H, 8); D.addGeo(tower, mat4(x, y + H / 2, z), '#f4e4c1');
    for (let i = 0; i < 4; i++) this.cyl(D, x, y + 2 + i * 3.2, z, 2.7 - (2 + i * 3.2) * 0.075 + 0.05, 2.7 - (2 + i * 3.2) * 0.075 + 0.05, 0.25, '#9a6a3c', 8);
    D.addGeo(new THREE.ConeGeometry(2.4, 2.6, 8), mat4(x, y + H + 1.3, z), '#c94a4a');
    D.add(x, y + 0.9, z - 2.55, 0.6, 0.9, 0.08, '#8a5a33', 0); // 門
    this.solid(x, y + H / 2, z, 2.1, H / 2, 2.1, 0, this.landmark('wood')); this.solid(x, y + H / 2, z, 2.1, H / 2, 2.1, Math.PI / 4, this.landmark('wood'));
    // 風車葉片：獨立 Group，每幀旋轉
    const hub = new THREE.Group(); hub.position.set(x, y + H - 1.2, z - 2.9); hub.rotation.y = yaw;
    const bb = new BoxBatch(); bb.add(0, 4.8, 0, 0.12, 4.8, 0.07, '#7a4a28');
    for (let k = 0; k < 4; k++) bb.add(0.62, 1.7 + k * 1.05, 0.06, 0.52, 0.47, 0.04, k % 2 ? '#fff6e8' : '#e86a4a');
    const bg = bb.geometry(), all = new BoxBatch(); all.add(0, 0, 0, 0.4, 0.4, 0.55, '#7a4a28');
    for (let i = 0; i < 4; i++) all.addGeo(bg, mat4(0, 0, 0, 0, 1, 1, 1, 0, i * Math.PI / 2));
    const mesh = new THREE.Mesh(all.geometry(), W.vcMat); mesh.castShadow = true; hub.add(mesh); cl.parent.add(hub);
    W.spinners.push({ obj: hub, speed: 0.45 });
    W.addBlocker(x, z, 4); W.landmarks.windmill = { x, y, z };
  }
  silo(cl, x, z, y, r = 2.6, h = 11) {
    const D = cl.deco; this.cyl(D, x, y, z, r, r, h, '#e8e2d2', 14);
    for (let i = 0; i < 5; i++) this.cyl(D, x, y + 1.2 + i * 2.1, z, r + 0.05, r + 0.05, 0.14, '#c9c2b0', 14);
    D.addGeo(new THREE.SphereGeometry(r, 14, 6, 0, 6.283, 0, 1.2), mat4(x, y + h, z, 0, 1, 0.8, 1), '#c94a4a');
    D.add(x, y + 0.9, z - r, 0.5, 0.9, 0.05, '#8a5a33');
    this.solid(x, y + h / 2, z, r * 0.78, h / 2, r * 0.78, 0, this.landmark('metal')); this.solid(x, y + h / 2, z, r * 0.78, h / 2, r * 0.78, Math.PI / 4, this.landmark('metal'));
    this.W.addBlocker(x, z, r + 1.5);
  }
  lighthouse(cl, x, z, y) {
    const D = cl.deco, G = cl.glow, H = 22;
    D.addGeo(new THREE.CylinderGeometry(1.7, 3.0, 3, 12), mat4(x, y + 1.5, z), '#9d9a92');
    for (let i = 0; i < 5; i++) { const y0 = 3 + i * 3.6, r0 = 2.7 - i * 0.28, r1 = r0 - 0.28; D.addGeo(new THREE.CylinderGeometry(r1, r0, 3.6, 12), mat4(x, y + y0 + 1.8, z), i % 2 ? '#e2574c' : '#f7f2e8'); }
    this.cyl(D, x, y + 21, z, 2.6, 2.1, 0.35, '#3a3f4a', 12); // 平台
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; D.add(x + Math.cos(a) * 2.5, y + 21.9, z + Math.sin(a) * 2.5, 0.05, 0.5, 0.05, '#3a3f4a'); }
    this.cyl(D, x, y + 21.4, z, 1.3, 1.3, 2.2, '#cfe8f0', 10); // 燈室外殼
    this.cyl(G, x, y + 21.6, z, 0.95, 0.95, 1.5, hot('#ffe08a', 4.2), 10); // 發光燈體（bloom）
    D.addGeo(new THREE.ConeGeometry(1.8, 1.8, 12), mat4(x, y + 24.4, z), '#e2574c');
    D.add(x, y + 1.1, z - 2.9, 0.55, 1.0, 0.06, '#7a4a28');
    this.solid(x, y + H / 2, z, 2.3, H / 2, 2.3, 0, this.landmark('stone')); this.solid(x, y + H / 2, z, 2.3, H / 2, 2.3, Math.PI / 4, this.landmark('stone'));
    this.W.addBlocker(x, z, 5); this.W.landmarks.lighthouse = { x, y, z };
  }
  crane(cl, x, z, y, yaw = 0) { // 起重機（裝飾 + 塔身 collider）
    const D = cl.deco, c = Math.cos(yaw), s = Math.sin(yaw), w = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const H = 17; for (const [a, b] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) { const [px, pz] = w(a, b); D.add(px, y + H / 2, pz, 0.12, H / 2, 0.12, '#f2a83c'); }
    for (let i = 0; i < 8; i++) { const yy = y + 1 + i * 2.1; D.add(x, yy, z, 0.7, 0.05, 0.7, '#f2a83c', yaw); }
    const [bx, bz] = w(6.5, 0); D.add(bx, y + H + 0.6, bz, 9.5, 0.45, 0.45, '#f2a83c', yaw); const [cx, cz] = w(-5.5, 0); D.add(cx, y + H + 0.6, cz, 3.5, 0.5, 0.5, '#e2574c', yaw); D.add(cx, y + H - 0.4, cz, 1.4, 1.1, 1.0, '#8a8f97', yaw);
    const [hx, hz] = w(11, 0); D.add(hx, y + H - 3, hz, 0.03, 3.6, 0.03, '#222'); D.add(hx, y + H - 6.8, hz, 0.35, 0.3, 0.35, '#3a3f4a');
    const [kx, kz] = w(0, 0); D.add(kx, y + H + 1.7, kz, 0.9, 0.9, 0.9, '#f7f2e8', yaw);
    this.solid(x, y + H / 2, z, 0.85, H / 2, 0.85, yaw); this.W.addBlocker(x, z, 3);
  }
  // ---- 碼頭 ----
  pier(cl, x0, z0, dir, len, width, deckY) {
    const D = cl.deco, W = this.W, dx = dir.x, dz = dir.z, px = -dz, pz = dx, yaw = Math.atan2(-dz, dx) , n = Math.ceil(len / 3);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) * (len / n), cx = x0 + dx * t, cz = z0 + dz * t;
      cl.panels.add({ pk: 'floor', kind: KIND.floor, mat: 'wood', cx, cy: deckY - 0.12, cz, sx: len / n, sy: 0.24, sz: width, yaw, color: '#b98450', debrisColor: '#b98450', hp: 160 });
    }
    for (let i = 0; i <= n; i++) for (const sd of [-1, 1]) { const t = i * (len / n), cx = x0 + dx * t + px * sd * (width / 2 - 0.2), cz = z0 + dz * t + pz * sd * (width / 2 - 0.2); this.cyl(D, cx, -4.5, cz, 0.22, 0.26, deckY + 0.6 + 4.5, '#6a4a2e', 6); if (i % 2 === 0) D.add(cx, deckY + 0.55, cz, 0.15, 0.4, 0.15, '#4a3322'); }
    W.addBlocker(x0 + dx * len / 2, z0 + dz * len / 2, len / 2);
  }
  boat(cl, x, z, yaw, color = '#f7f2e8') {
    const D = cl.deco, G = cl.glow, c = Math.cos(yaw), s = Math.sin(yaw), w = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    D.add(x, 0.35, z, 3.4, 0.55, 1.15, color, yaw); D.add(x, 0.95, z, 3.0, 0.1, 1.0, '#c89a5a', yaw);
    const [fx, fz] = w(3.5, 0); D.add(fx, 0.55, fz, 0.9, 0.4, 0.8, color, yaw, 0);
    D.add(x, 0.3, z, 3.45, 0.18, 1.2, '#2a6fb8', yaw);
    const [cx, cz] = w(-0.8, 0); D.add(cx, 1.55, cz, 1.1, 0.6, 0.8, '#fff', yaw); D.add(cx, 2.2, cz, 1.2, 0.08, 0.9, '#e2574c', yaw);
    { const [lx, lz] = w(-1.9, 0); G.add(lx, 1.2, lz, 0.08, 0.08, 0.08, hot('#ffe2a0', 2.4)); }
    this.solid(x, 0.7, z, 3.4, 0.7, 1.15, yaw);
  }
  // 加油站
  gasStation(cl, x, z, yaw, y) {
    const W = this.W, D = cl.deco, G = cl.glow, c = Math.cos(yaw), s = Math.sin(yaw), w = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    // 雨棚：四根柱 + 條紋頂
    const cx = 0, cz = -12;
    for (const [a, b] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) { const [px, pz] = w(cx + a, cz + b); D.add(px, y + 2.6, pz, 0.22, 2.6, 0.22, '#f7f2e8'); this.solid(px, y + 2.6, pz, 0.24, 2.6, 0.24); }
    const [tx, tz] = w(cx, cz); D.add(tx, y + 5.4, tz, 6.2, 0.3, 4.9, '#e2574c', yaw); D.add(tx, y + 5.2, tz, 6.25, 0.08, 4.95, '#fff', yaw);
    this.solid(tx, y + 5.4, tz, 6.2, 0.3, 4.9, yaw);
    // 加油機（可打）
    for (const a of [-2.2, 2.2]) {
      const [px, pz] = w(cx + a, cz); const q = cl.panels.add({ pk: 'prop', kind: KIND.metal, mat: 'metal', cx: px, cy: y + 0.85, cz: pz, sx: 0.8, sy: 1.7, sz: 0.55, yaw, color: '#e2574c', hp: 200, debrisColor: '#e2574c' });
      D.add(px, y + 1.3, pz, 0.36, 0.28, 0.02 + 0.28, '#222', yaw); G.add(px, y + 1.5, pz, 0.2, 0.1, 0.01 + 0.3, hot('#7fffd0', 1.8), yaw);
    }
    // 招牌柱
    const [sx, sz] = w(9, -16); D.add(sx, y + 4.5, sz, 0.15, 4.5, 0.15, '#3a3f4a'); D.add(sx, y + 9.2, sz, 1.8, 0.9, 0.18, '#f2a83c', yaw); G.add(sx, y + 9.2, sz, 1.5, 0.65, 0.2, hot('#ffe14d', 2.0), yaw); this.solid(sx, y + 4.5, sz, 0.2, 4.5, 0.2);
    W.addBlocker(tx, tz, 8); W.landmarks.gas = { x: tx, y, z: tz, yaw };
  }
}
