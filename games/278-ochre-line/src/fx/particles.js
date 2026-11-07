// 粒子、彈痕、曳光：固定容量的 thin instance，隱藏用零矩陣，FAST 快照下只更新 buffer。
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Constants } from '@babylonjs/core/Engines/constants.js';

function quadMesh(name, scene, flat = false) {
  const m = new Mesh(name, scene), v = new VertexData();
  v.positions = flat ? [-0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0.5, 0, -0.5] : [-0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, -0.5, 0];
  v.indices = [0, 1, 2, 0, 2, 3]; v.uvs = [0, 0, 0, 1, 1, 1, 1, 0]; v.normals = flat ? [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0] : [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
  v.applyToMesh(m, false); m.isPickable = false; m.alwaysSelectAsActiveMesh = true; m.doNotSyncBoundingInfo = true; m.freezeWorldMatrix();
  return m;
}

function softTex(scene, kind) {
  const t = new DynamicTexture('p_' + kind, 128, scene, false), c = t.getContext();
  const g = c.createRadialGradient(64, 64, 2, 64, 64, 62);
  if (kind === 'fire') { g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,225,160,.9)'); g.addColorStop(0.55, 'rgba(255,130,40,.35)'); g.addColorStop(1, 'rgba(255,80,10,0)'); }
  else { g.addColorStop(0, 'rgba(255,255,255,.75)'); g.addColorStop(0.5, 'rgba(255,255,255,.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
  c.clearRect(0, 0, 128, 128); c.fillStyle = g; c.fillRect(0, 0, 128, 128); t.update(false); t.hasAlpha = true;
  return t;
}

class Pool {
  constructor(mesh, n) {
    this.m = mesh; this.n = n; this.next = 0; this.mat = new Float32Array(n * 16); this.col = new Float32Array(n * 4).fill(1);
    this.life = new Float32Array(n); this.age = new Float32Array(n); this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.size = new Float32Array(n * 2); this.tint = new Float32Array(n * 4); this.g = new Float32Array(n);
    mesh.thinInstanceSetBuffer('matrix', this.mat, 16, false); mesh.thinInstanceSetBuffer('color', this.col, 4, false);
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav = 0) {
    const i = this.next; this.next = (i + 1) % this.n;
    this.life[i] = life; this.age[i] = 0; this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz; this.size[i * 2] = s0; this.size[i * 2 + 1] = s1;
    this.tint[i * 4] = r; this.tint[i * 4 + 1] = g; this.tint[i * 4 + 2] = b; this.tint[i * 4 + 3] = a; this.g[i] = grav;
  }
  /** 公告板：用相機右、上向量組矩陣，不經 Matrix 物件。 */
  update(dt, rx, ry, rz, ux, uy, uz, fx, fy, fz) {
    const M = this.mat;
    for (let i = 0; i < this.n; i++) {
      const o = i * 16;
      if (this.life[i] <= 0) { if (M[o + 15] !== 0) M.fill(0, o, o + 16); continue; }
      this.age[i] += dt;
      const k = this.age[i] / this.life[i];
      if (k >= 1) { this.life[i] = 0; M.fill(0, o, o + 16); continue; }
      const p = i * 3;
      this.vel[p + 1] -= this.g[i] * dt;
      this.pos[p] += this.vel[p] * dt; this.pos[p + 1] += this.vel[p + 1] * dt; this.pos[p + 2] += this.vel[p + 2] * dt;
      const s = this.size[i * 2] + (this.size[i * 2 + 1] - this.size[i * 2]) * k;
      M[o] = rx * s; M[o + 1] = ry * s; M[o + 2] = rz * s; M[o + 3] = 0;
      M[o + 4] = ux * s; M[o + 5] = uy * s; M[o + 6] = uz * s; M[o + 7] = 0;
      M[o + 8] = fx * s; M[o + 9] = fy * s; M[o + 10] = fz * s; M[o + 11] = 0;
      M[o + 12] = this.pos[p]; M[o + 13] = this.pos[p + 1]; M[o + 14] = this.pos[p + 2]; M[o + 15] = 1;
      const c = i * 4, f = 1 - k;
      this.col[c] = this.tint[c]; this.col[c + 1] = this.tint[c + 1]; this.col[c + 2] = this.tint[c + 2]; this.col[c + 3] = this.tint[c + 3] * f;
    }
    this.m.thinInstanceBufferUpdated('matrix'); this.m.thinInstanceBufferUpdated('color');
  }
}

export const fx = { fire: null, soft: null, decal: null, tracer: null, brass: null };
let decalI = 0, tracerI = 0;
const tracerLife = new Float32Array(32);

export function buildFx(ctx) {
  const { scene } = ctx;
  const mk = (name, tex, blend) => {
    const m = new StandardMaterial(name, scene); m.emissiveTexture = tex; m.opacityTexture = tex; m.disableLighting = true; m.backFaceCulling = false; m.alphaMode = blend; m.disableDepthWrite = true; m.useVertexColor = true;
    return m;
  };
  const f = quadMesh('fx_fire', scene); f.material = mk('fxFire', softTex(scene, 'fire'), Constants.ALPHA_ADD); f.material.emissiveColor = new Color3(2, 2, 2); fx.fire = new Pool(f, 128); f.hasVertexAlpha = true;
  const s = quadMesh('fx_soft', scene); s.material = mk('fxSoft', softTex(scene, 'soft'), Constants.ALPHA_COMBINE); s.material.emissiveColor = new Color3(1, 1, 1); fx.soft = new Pool(s, 320); s.hasVertexAlpha = true;
  // 彈痕
  const dt = new DynamicTexture('p_decal', 64, scene, false), c = dt.getContext(), g = c.createRadialGradient(32, 32, 1, 32, 32, 30);
  g.addColorStop(0, 'rgba(10,8,6,.95)'); g.addColorStop(0.3, 'rgba(30,24,18,.75)'); g.addColorStop(1, 'rgba(60,50,40,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); dt.update(false); dt.hasAlpha = true;
  const d = quadMesh('fx_decal', scene); const dm = new StandardMaterial('fxDecal', scene); dm.diffuseTexture = dt; dm.opacityTexture = dt; dm.specularColor = new Color3(0, 0, 0); dm.emissiveColor = new Color3(0.05, 0.05, 0.05); dm.disableDepthWrite = true; dm.zOffset = -2; dm.backFaceCulling = false; d.material = dm;
  fx.decal = { m: d, buf: new Float32Array(160 * 16) }; d.thinInstanceSetBuffer('matrix', fx.decal.buf, 16, false);
  // 曳光：細長方塊
  const tm = quadMesh('fx_tracer', scene); const tmm = new StandardMaterial('fxTracer', scene); tmm.emissiveColor = new Color3(3, 2.4, 1.4); tmm.disableLighting = true; tmm.alphaMode = Constants.ALPHA_ADD; tmm.alpha = 0.55; tmm.backFaceCulling = false; tmm.disableDepthWrite = true; tm.material = tmm;
  fx.tracer = { m: tm, buf: new Float32Array(32 * 16) }; tm.thinInstanceSetBuffer('matrix', fx.tracer.buf, 16, false);
  // 彈殼：八面小方塊，矩陣自己算，不經 Matrix 物件
  const bm = MeshBuilder.CreateBox('fx_brass', { size: 1 }, scene), bmat = new StandardMaterial('fxBrass', scene);
  bmat.disableLighting = true; bmat.emissiveColor = new Color3(0.82, 0.6, 0.24); bm.material = bmat; bm.isPickable = false; bm.alwaysSelectAsActiveMesh = true; bm.doNotSyncBoundingInfo = true; bm.freezeWorldMatrix();
  fx.brass = { m: bm, n: 24, next: 0, buf: new Float32Array(24 * 16), life: new Float32Array(24), big: new Uint8Array(24), pos: new Float32Array(72), vel: new Float32Array(72), ang: new Float32Array(24), spin: new Float32Array(24) };
  bm.thinInstanceSetBuffer('matrix', fx.brass.buf, 16, false);
  return fx;
}

/** 牆面彈痕：n 是表面法線。 */
export function addDecal(x, y, z, nx, ny, nz, s = 0.09) {
  const b = fx.decal.buf, o = decalI * 16; decalI = (decalI + 1) % 160;
  // 切線
  let ux = 0, uy = 1, uz = 0; if (Math.abs(ny) > 0.9) { ux = 1; uy = 0; }
  const tx = uy * nz - uz * ny, ty = uz * nx - ux * nz, tz = ux * ny - uy * nx, l = 1 / (Math.hypot(tx, ty, tz) || 1);
  const rx = tx * l, ry = ty * l, rz = tz * l, qx = ny * rz - nz * ry, qy = nz * rx - nx * rz, qz = nx * ry - ny * rx;
  b[o] = rx * s; b[o + 1] = ry * s; b[o + 2] = rz * s; b[o + 3] = 0; b[o + 4] = qx * s; b[o + 5] = qy * s; b[o + 6] = qz * s; b[o + 7] = 0;
  b[o + 8] = nx * s; b[o + 9] = ny * s; b[o + 10] = nz * s; b[o + 11] = 0; b[o + 12] = x + nx * 0.012; b[o + 13] = y + ny * 0.012; b[o + 14] = z + nz * 0.012; b[o + 15] = 1;
  fx.decal.m.thinInstanceBufferUpdated('matrix');
}

/** 曳光：a→b，粗細 w，面向相機 (cx,cy,cz)。 */
export function addTracer(ax, ay, az, bx, by, bz, cx, cy, cz) {
  const b = fx.tracer.buf, o = tracerI * 16; tracerLife[tracerI] = 0.05; tracerI = (tracerI + 1) % 32;
  const dx = bx - ax, dy = by - ay, dz = bz - az, mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2;
  const vx = cx - mx, vy = cy - my, vz = cz - mz;
  let sx = dy * vz - dz * vy, sy = dz * vx - dx * vz, sz = dx * vy - dy * vx; const l = 0.012 / (Math.hypot(sx, sy, sz) || 1); sx *= l; sy *= l; sz *= l;
  const nx = sy * dz - sz * dy, ny = sz * dx - sx * dz, nz = sx * dy - sy * dx;
  b[o] = sx * 2; b[o + 1] = sy * 2; b[o + 2] = sz * 2; b[o + 3] = 0; b[o + 4] = dx; b[o + 5] = dy; b[o + 6] = dz; b[o + 7] = 0; b[o + 8] = nx; b[o + 9] = ny; b[o + 10] = nz; b[o + 11] = 0; b[o + 12] = mx; b[o + 13] = my; b[o + 14] = mz; b[o + 15] = 1;
}

export function updateFx(dt, cam) {
  const v = cam.getViewMatrix(), m = v.m;   // 右 = 第 0 欄，上 = 第 1 欄，前 = 第 2 欄（反轉置）
  fx.fire.update(dt, m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]);
  fx.soft.update(dt, m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]);
  let any = false;
  for (let i = 0; i < 32; i++) if (tracerLife[i] > 0) { tracerLife[i] -= dt; any = true; if (tracerLife[i] <= 0) fx.tracer.buf.fill(0, i * 16, i * 16 + 16); }
  if (any) fx.tracer.m.thinInstanceBufferUpdated('matrix');
  updateBrass(dt);
}

/** 槍口火光：(dx,dy,dz) 是槍口朝向。一個亮核、朝前噴的火舌、側向小火星，再留一縷砂色煙。 */
export function muzzle(x, y, z, dx, dy, dz, k = 1) {
  const F = fx.fire, S = fx.soft;
  F.spawn(x, y, z, 0, 0, 0, 0.045, 0.34 * k, 0.2 * k, 1, 0.94, 0.8, 1);
  F.spawn(x + dx * 0.1, y + dy * 0.1, z + dz * 0.1, dx * 2, dy * 2, dz * 2, 0.06, 0.26 * k, 0.46 * k, 1, 0.74, 0.38, 0.85);
  F.spawn(x + dx * 0.24, y + dy * 0.24, z + dz * 0.24, dx * 4, dy * 4, dz * 4, 0.05, 0.16 * k, 0.34 * k, 1, 0.62, 0.26, 0.6);
  for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28, r = 0.9 + Math.random(); F.spawn(x, y, z, dx * 4 + Math.cos(a) * r, dy * 4 + Math.sin(a) * r, dz * 4 + Math.cos(a + 1.6) * r, 0.05, 0.05, 0.02, 1, 0.8, 0.45, 0.9); }
  S.spawn(x + dx * 0.12, y + dy * 0.12, z + dz * 0.12, dx * 0.7, 0.35 + dy * 0.7, dz * 0.7, 0.55, 0.1 * k, 0.5 * k, 0.8, 0.74, 0.62, 0.16);
}
/** 拋殼：從拋殼口往右上飛，翻滾落下。 */
export function casing(x, y, z, vx, vy, vz, big = false) {
  const b = fx.brass, i = b.next; b.next = (i + 1) % b.n, b.life[i] = 0.75; b.big[i] = big ? 1 : 0;
  b.pos[i * 3] = x; b.pos[i * 3 + 1] = y; b.pos[i * 3 + 2] = z; b.vel[i * 3] = vx; b.vel[i * 3 + 1] = vy; b.vel[i * 3 + 2] = vz;
  b.ang[i] = Math.random() * 6.28; b.spin[i] = 16 + Math.random() * 14;
}
function updateBrass(dt) {
  const b = fx.brass, M = b.buf; let any = false;
  for (let i = 0; i < b.n; i++) {
    const o = i * 16, p = i * 3;
    if (b.life[i] <= 0) { if (M[o + 15] !== 0) { M.fill(0, o, o + 16); any = true; } continue; }
    b.life[i] -= dt; any = true;
    b.vel[p + 1] -= 9.8 * dt; b.pos[p] += b.vel[p] * dt; b.pos[p + 1] += b.vel[p + 1] * dt; b.pos[p + 2] += b.vel[p + 2] * dt; b.ang[i] += b.spin[i] * dt;
    const c = Math.cos(b.ang[i]), s = Math.sin(b.ang[i]), r = b.big[i] ? 0.0095 : 0.0055, l = b.big[i] ? 0.03 : 0.022;
    M[o] = c * l; M[o + 1] = s * l; M[o + 2] = 0; M[o + 3] = 0; M[o + 4] = -s * r; M[o + 5] = c * r; M[o + 6] = 0; M[o + 7] = 0; M[o + 8] = 0; M[o + 9] = 0; M[o + 10] = r; M[o + 11] = 0;
    M[o + 12] = b.pos[p]; M[o + 13] = b.pos[p + 1]; M[o + 14] = b.pos[p + 2]; M[o + 15] = 1;
  }
  if (any) b.m.thinInstanceBufferUpdated('matrix');
}
export function impact(x, y, z, nx, ny, nz) {
  addDecal(x, y, z, nx, ny, nz);
  for (let i = 0; i < 3; i++) fx.soft.spawn(x, y, z, nx * 1.2 + (Math.random() - 0.5), ny * 1.2 + Math.random() * 0.7, nz * 1.2 + (Math.random() - 0.5), 0.4, 0.1, 0.45, 0.78, 0.68, 0.54, 0.5, 2);
}
export function blood(x, y, z) { for (let i = 0; i < 4; i++) fx.soft.spawn(x, y, z, (Math.random() - 0.5) * 1.6, Math.random() * 1.2, (Math.random() - 0.5) * 1.6, 0.35, 0.08, 0.32, 0.42, 0.05, 0.03, 0.8, 5); }
export function explosion(x, y, z) {
  for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, r = Math.random() * 3; fx.fire.spawn(x, y + 0.3, z, Math.cos(a) * r, Math.random() * 3, Math.sin(a) * r, 0.25 + Math.random() * 0.2, 1, 3, 1, 0.75, 0.45, 0.9); }
  for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28, r = Math.random() * 2; fx.soft.spawn(x, y + 0.4, z, Math.cos(a) * r, Math.random() * 2, Math.sin(a) * r, 1.2 + Math.random(), 1, 4, 0.34, 0.3, 0.26, 0.8); }
}
export function smokePuff(x, y, z) { const a = Math.random() * 6.28, r = Math.random() * 3; fx.soft.spawn(x + Math.cos(a) * r, y + Math.random() * 2.4, z + Math.sin(a) * r, 0, 0.05, 0, 3, 3.4, 4.6, 0.82, 0.8, 0.76, 0.9); }
