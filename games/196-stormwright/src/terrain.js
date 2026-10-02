// 島嶼高度場（SPEC §9）：圓潤丘陵、不規則海岸、沙灘、懸崖、湖與河、土路、港灣、採石坑；
// 地形網格分塊（可視錐裁切）、地面著色在 fragment 完成（沙/岩/土路/鋪石/農田），海面是自訂浪與泡沫著色器。
import * as THREE from 'three';
import { fbm, vnoise, clamp, lerp, smoothstep } from './shared.js';
import { TIME } from './geo.js';
import { SUN_DIR } from './world-sky.js';
import { Flora } from './world-flora.js';

export const POI_SITES = [
  { name: '蜂蜜鎮', en: 'Honeywick', x: 0, z: 20, r: 75 },
  { name: '風車農場', en: 'Pinwheel Farm', x: -205, z: -165, r: 58 },
  { name: '錫罐港', en: 'Tincan Harbor', x: 250, z: 120, r: 55 },
  { name: '菇菇林', en: 'Toadstool Grove', x: -190, z: 185, r: 62 },
  { name: '鵝卵石採場', en: 'Pebblepit', x: 170, z: -195, r: 52 },
];
export const FLAT_Y = 3.5; // 城鎮整平高度（剛好是建造 L=1 的底面）
const HALF = 460, STEP = 2, N = HALF * 2 / STEP + 1;
const ROADS = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 3], [4, 2]];

// 港灣（錫罐港朝外海挖出的水域）、採石坑、湖、河
const HP = POI_SITES[2], HDIR = (() => { const d = Math.hypot(HP.x, HP.z); return { x: HP.x / d, z: HP.z / d }; })();
export const BAY = { cx: HP.x + HDIR.x * 78, cz: HP.z + HDIR.z * 78, hl: 52, hw: 30, dx: HDIR.x, dz: HDIR.z };
const QP = POI_SITES[4];
export const PIT = { cx: QP.x + 6, cz: QP.z - 4, r: 30, top: 11, floor: 2.3 }; // 高台上的採石坑
export const LAKE = { cx: 105, cz: -55, rx: 34, rz: 27, depth: 4.5 };
export const RIVER = (() => { // 湖 → 東岸
  const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push([LAKE.cx + 20 + t * 240, LAKE.cz + Math.sin(t * 7) * 16 + t * 20 + (vnoise(t * 5, 3) - 0.5) * 12]); }
  return pts;
})();
// 土路：二次貝茲曲線（控制點垂直偏移），取樣成折線
export const ROAD_PATHS = ROADS.map(([a, b], k) => {
  const A = POI_SITES[a], B = POI_SITES[b], dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz);
  const off = (vnoise(k * 7.3, 1.1) - 0.5) * L * 0.34, cx = (A.x + B.x) / 2 - dz / L * off, cz = (A.z + B.z) / 2 + dx / L * off;
  const pts = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40, u = 1 - t; pts.push([u * u * A.x + 2 * u * t * cx + t * t * B.x, u * u * A.z + 2 * u * t * cz + t * t * B.z]); }
  return pts;
});

function islandR(ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return 292 + 40 * Math.sin(ang * 2 + 1.3) + 26 * Math.sin(ang * 3 - 0.7) + 16 * Math.sin(ang * 5 + 2) + 46 * (vnoise(c * 1.7 + 9, s * 1.7 + 9) - 0.5);
}
function ptSegDist(px, pz, pts) {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1], dx = bx - ax, dz = bz - az;
    const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
    const d = Math.hypot(px - (ax + dx * t), pz - (az + dz * t)); if (d < best) best = d;
  }
  return best;
}
function rawHeight(x, z) {
  const d = Math.hypot(x, z), ang = Math.atan2(z, x);
  const m = 1 - d / islandR(ang);
  let h;
  if (m < 0) h = Math.max(-8, m * 40 - 0.2);
  else {
    const coast = smoothstep(0, 0.1, m) * 2.1;
    const hn = fbm(x * 0.0062 + 3, z * 0.0062 - 5, 3);
    const rolling = 30 * smoothstep(0.32, 0.8, hn);
    const g = (cx, cz, a, s) => a * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * s * s));
    const bumps = g(-60, -110, 22, 80) + g(-115, 45, 15, 55) + g(60, 150, 13, 50) + g(150, 10, 10, 45);
    const pb = Math.hypot((x - 30) / 72, (z + 232) / 50), plateau = 21 * (1 - smoothstep(0.76, 1.0, pb)); // 有懸崖的高台
    h = coast + (rolling + bumps + plateau) * smoothstep(0.1, 0.5, m) + 1.3 * fbm(x * 0.035, z * 0.035, 3, 7) * smoothstep(0.06, 0.22, m);
  }
  // 湖（先把周圍壓低成緩坡）與河
  const dl = Math.hypot((x - LAKE.cx) / LAKE.rx, (z - LAKE.cz) / LAKE.rz) + (vnoise(x * 0.05, z * 0.05, 5) - 0.5) * 0.18;
  if (dl < 2.2) { h = lerp(h, Math.min(h, 2.6), 1 - smoothstep(1.1, 2.2, dl)); h = lerp(h, -LAKE.depth, 1 - smoothstep(0.62, 1.0, dl)); }
  const dr = ptSegDist(x, z, RIVER);
  if (dr < 18) { h = lerp(h, Math.min(h, 2.2), 1 - smoothstep(5, 18, dr)); if (h > -1.6) h = lerp(h, -1.6, 1 - smoothstep(3.2, 6.2, dr)); }
  for (const p of POI_SITES) { // 先把周圍丘陵壓平緩，再整平城鎮，避免城鎮像坑洞
    const dd = Math.hypot(x - p.x, z - p.z);
    const pull = (1 - smoothstep(p.r * 0.8, p.r * 2.3, dd)) * 0.72;
    if (pull > 0 && h > FLAT_Y) h = lerp(h, FLAT_Y + 0.6, pull);
    const w = 1 - smoothstep(p.r * 0.62, p.r * 1.12, dd);
    if (w > 0) h = lerp(h, FLAT_Y, w);
  }
  // 港灣：橢圓水域切進陸地，岸邊陡降成碼頭邊
  { const lx = (x - BAY.cx) * BAY.dx + (z - BAY.cz) * BAY.dz, lz = -(x - BAY.cx) * BAY.dz + (z - BAY.cz) * BAY.dx;
    const e = Math.hypot(lx / BAY.hl, lz / BAY.hw);
    if (e < 1.15) { const w = 1 - smoothstep(0.86, 1.1, e); h = lerp(h, Math.min(h, -4.2), w); } }
  // 採石場：先墊高成圓形高台（邊緣緩坡），再挖三層階地的坑
  { const dd = Math.hypot(x - PIT.cx, z - PIT.cz), wm = 1 - smoothstep(PIT.r * 1.6, PIT.r * 2.3, dd);
    if (wm > 0) h = lerp(h, PIT.top, wm);
    const u = dd / PIT.r;
    if (u < 1.15) { const t = (1 - Math.min(u, 1)) * 3, q = (Math.floor(t) + smoothstep(0.78, 1, t - Math.floor(t))) / 3, w = 1 - smoothstep(0.95, 1.15, u);
      h = lerp(h, PIT.top - (PIT.top - PIT.floor) * Math.min(1, q * 1.03), w); } }
  return h;
}
// 草地大尺度色彩（頂點色與草叢色共用）：黃綠 → 鮮綠 → 翠綠
const G_A = new THREE.Color('#aaea50'), G_B = new THREE.Color('#62cf3a'), G_C = new THREE.Color('#33b350'), G_D = new THREE.Color('#cdee5c');
export function grassTint(x, z, h, out) {
  const t1 = fbm(x * 0.011 + 20, z * 0.011, 3, 2), t2 = fbm(x * 0.05 + 40, z * 0.05, 2, 4);
  const v = clamp(t1 * 1.5 - 0.25 + (t2 - 0.5) * 0.4, 0, 1);
  if (v < 0.5) out.copy(G_C).lerp(G_B, v * 2); else out.copy(G_B).lerp(G_A, (v - 0.5) * 2);
  out.lerp(G_D, smoothstep(14, 40, h) * 0.3);
  return out;
}

const MASK = 1536, MS = (HALF * 2) / MASK;
export class Terrain {
  static grassTintFn = grassTint;
  constructor(ctx) {
    this.ctx = ctx;
    this.grid = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) this.grid[j * N + i] = rawHeight(-HALF + i * STEP, -HALF + j * STEP);
    this._n = new THREE.Vector3();
    this.mask = new Uint8Array(MASK * MASK * 4);
    this.paintRoads();
    this.stamp(3, PIT.cx, PIT.cz, PIT.r * 1.1, 2);
    this.maskTex = new THREE.DataTexture(this.mask, MASK, MASK, THREE.RGBAFormat);
    this.maskTex.magFilter = this.maskTex.minFilter = THREE.LinearFilter; this.maskTex.wrapS = this.maskTex.wrapT = THREE.ClampToEdgeWrapping; this.maskTex.needsUpdate = true;
    this.buildMesh();
    this.buildOcean();
    this.flora = new Flora(ctx, this);
  }
  heightAt(x, z) {
    const fx = (x + HALF) / STEP, fz = (z + HALF) / STEP;
    if (fx < 0 || fz < 0 || fx >= N - 1 || fz >= N - 1) return -8;
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, g = this.grid, k = j * N + i;
    return (g[k] * (1 - u) + g[k + 1] * u) * (1 - v) + (g[k + N] * (1 - u) + g[k + N + 1] * u) * v;
  }
  normalAt(x, z, out) {
    const e = 1.0, hx = this.heightAt(x + e, z) - this.heightAt(x - e, z), hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return out.set(-hx / (2 * e), 1, -hz / (2 * e)).normalize();
  }
  isWater(x, z) { return this.heightAt(x, z) < 0.05; }
  // ---- 遮罩貼圖（R 土路 / G 鋪石 / B 田土 / A 禁生草）----
  maskAt(x, z, ch) {
    const u = (x + HALF) / MS - 0.5, v = (z + HALF) / MS - 0.5; if (u < 0 || v < 0 || u >= MASK - 1 || v >= MASK - 1) return 0;
    const i = u | 0, j = v | 0; return this.mask[(j * MASK + i) * 4 + ch] / 255;
  }
  stamp(ch, x, z, r, soft = 1.2, v = 1, shape = null, bound = r + soft) {
    const i0 = Math.max(0, Math.floor((x - bound + HALF) / MS)), i1 = Math.min(MASK - 1, Math.ceil((x + bound + HALF) / MS));
    const j0 = Math.max(0, Math.floor((z - bound + HALF) / MS)), j1 = Math.min(MASK - 1, Math.ceil((z + bound + HALF) / MS));
    const m = this.mask;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = -HALF + (i + 0.5) * MS, pz = -HALF + (j + 0.5) * MS;
      const d = shape ? shape(px, pz) : Math.hypot(px - x, pz - z);
      const a = (1 - smoothstep(r - soft, r + soft * 0.4, d)) * v * 255, k = (j * MASK + i) * 4 + ch;
      if (a > m[k]) m[k] = a;
    }
  }
  stampRect(ch, cx, cz, hx, hz, yaw = 0, soft = 0.8, v = 1) {
    const c = Math.cos(yaw), s = Math.sin(yaw), R = Math.hypot(hx, hz);
    this.stamp(ch, cx, cz, 0, soft, v, (px, pz) => { const dx = px - cx, dz = pz - cz, lx = Math.abs(dx * c - dz * s), lz = Math.abs(dx * s + dz * c); return Math.max(lx - hx, lz - hz); }, R + soft + 1);
  }
  paintRoads() {
    // 沿折線蓋章（路心較亮的核心 + 軟邊）
    for (const pts of ROAD_PATHS) for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 0.8);
      for (let k = 0; k <= n; k++) this.stamp(0, lerp(ax, bx, k / n), lerp(az, bz, k / n), 2.1, 0.9);
    }
  }
  uploadMask() { this.maskTex.needsUpdate = true; }
  onRoad(x, z) { return this.maskAt(x, z, 0) > 0.5; }
  surfaceType(x, z) {
    const h = this.heightAt(x, z);
    if (h < 0.05) return 'water';
    if (h < 1.6) return 'sand';
    this.normalAt(x, z, this._n);
    if (this._n.y < 0.74) return 'rock';
    if (this.maskAt(x, z, 0) > 0.5 || this.maskAt(x, z, 1) > 0.5) return 'path';
    return 'grass';
  }
  buildMesh() {
    const CH = 92, NC = Math.ceil((N - 1) / CH), c = new THREE.Color();
    this.chunks = [];
    const mat = (this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0 }));
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uMask = { value: this.maskTex }; sh.uniforms.uPit = { value: new THREE.Vector4(PIT.cx, PIT.cz, PIT.r, PIT.top) };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vN0;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = position; vN0 = normal;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vW; varying vec3 vN0; uniform sampler2D uMask; uniform vec4 uPit;
float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hsh(i), hsh(i+vec2(1,0)), f.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), f.x), f.y); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec2 p = vW.xz; float h = vW.y; float ny = normalize(vN0).y;
  float n1 = vn(p*0.25), n2 = vn(p*1.3), n3 = vn(p*5.5);
  diffuseColor.rgb *= 0.92 + 0.15*n2 + 0.06*(n3-0.5);
  float wob = (n1-0.5)*1.0;
  float sk = 1.0 - smoothstep(1.15+wob, 1.95+wob, h);
  vec3 sand = mix(vec3(0.97,0.83,0.52), vec3(1.0,0.92,0.66), n2);
  sand *= mix(1.0, 0.8, smoothstep(0.6,-0.1,h)) * mix(1.0, 0.55, smoothstep(0.0,-4.5,h));
  diffuseColor.rgb = mix(diffuseColor.rgb, sand, sk);
  float rk = 1.0 - smoothstep(0.52, 0.70 + (n1-0.5)*0.08, ny);
  float strata = 0.5 + 0.5*sin(h*2.4 + n1*4.0);
  vec3 rock = mix(vec3(0.57,0.52,0.50), vec3(0.78,0.68,0.55), strata*0.55 + n2*0.45);
  rock *= 0.9 + 0.2*vn(p*vec2(0.9,0.9) + h*0.7);
  diffuseColor.rgb = mix(diffuseColor.rgb, rock, rk);
  { // 採石坑：礫石與岩層
    float pd = length(p - uPit.xy) / uPit.z, pk = 1.0 - smoothstep(0.98, 1.18, pd);
    vec3 gravel = mix(vec3(0.62,0.58,0.53), vec3(0.80,0.72,0.60), vn(p*0.7) * 0.6 + 0.4*strata) * (0.9 + 0.2*n3);
    diffuseColor.rgb = mix(diffuseColor.rgb, gravel, pk);
  }
  vec4 mk = texture2D(uMask, (p + ${HALF}.0) / ${HALF * 2}.0);
  vec3 dirt = mix(vec3(0.84,0.61,0.34), vec3(0.74,0.51,0.27), n2) * (0.94 + 0.12*n3);
    diffuseColor.rgb = mix(diffuseColor.rgb, dirt, smoothstep(0.1,0.75,mk.r) * (1.0 - rk*0.6));
  vec2 cp = p / 0.9; float row = floor(cp.y); vec2 cf = fract(vec2(cp.x + 0.5*mod(row,2.0), cp.y));
  float gap = smoothstep(0.0,0.07,cf.x) * smoothstep(0.0,0.07,cf.y) * smoothstep(1.0,0.93,cf.x) * smoothstep(1.0,0.93,cf.y);
  vec3 pave = mix(vec3(0.74,0.70,0.66), vec3(0.90,0.86,0.78), hsh(vec2(floor(cp.x + 0.5*mod(row,2.0)), row))) * mix(0.72, 1.0, gap);
  diffuseColor.rgb = mix(diffuseColor.rgb, pave, smoothstep(0.2,0.8,mk.g));
  float row2 = 0.5 + 0.5*sin(p.x*3.4 + sin(p.y*0.2)*0.5);
  vec3 soil = mix(vec3(0.43,0.27,0.16), vec3(0.58,0.39,0.23), row2) * (0.95 + 0.1*n3);
  diffuseColor.rgb = mix(diffuseColor.rgb, soil, smoothstep(0.2,0.8,mk.b));
}`);
    };
    for (let cj = 0; cj < NC; cj++) for (let ci = 0; ci < NC; ci++) {
      const i0 = ci * CH, j0 = cj * CH, i1 = Math.min(N - 1, i0 + CH), j1 = Math.min(N - 1, j0 + CH), w = i1 - i0 + 1, hgt = j1 - j0 + 1;
      let hmax = -99, hmin = 99;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const h = this.grid[j * N + i]; if (h > hmax) hmax = h; if (h < hmin) hmin = h; }
      if (hmax < -5.5) continue; // 全是深海，交給海面著色器
      const pos = new Float32Array(w * hgt * 3), col = new Float32Array(w * hgt * 3), nor = new Float32Array(w * hgt * 3), tmp = new THREE.Vector3();
      for (let j = 0; j < hgt; j++) for (let i = 0; i < w; i++) {
        const gi = i0 + i, gj = j0 + j, x = -HALF + gi * STEP, z = -HALF + gj * STEP, h = this.grid[gj * N + gi], k = (j * w + i) * 3;
        pos[k] = x; pos[k + 1] = h; pos[k + 2] = z;
        this.normalAt(x, z, tmp); nor[k] = tmp.x; nor[k + 1] = tmp.y; nor[k + 2] = tmp.z;
        grassTint(x, z, h, c); col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
      }
      const idx = new Uint32Array((w - 1) * (hgt - 1) * 6); let t = 0;
      for (let j = 0; j < hgt - 1; j++) for (let i = 0; i < w - 1; i++) {
        const a = j * w + i, b = a + 1, d = a + w, e = d + 1;
        idx[t++] = a; idx[t++] = d; idx[t++] = b; idx[t++] = b; idx[t++] = d; idx[t++] = e;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      g.computeBoundingSphere(); g.computeBoundingBox();
      const mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true;
      this.ctx.scene.add(mesh); this.chunks.push(mesh);
    }
    this.mesh = this.chunks[0]; // 相容：舊程式可能讀 terrain.mesh
  }
  buildOcean() {
    // 深度貼圖：值 = 水深 / 8 m（湖、河、港灣一併烘進去）
    const S = 512, data = new Uint8Array(S * S * 4);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const h = this.heightAt(-HALF + (i / (S - 1)) * HALF * 2, -HALF + (j / (S - 1)) * HALF * 2);
      const d = clamp(-h / 8, 0, 1) * 255; const k = (j * S + i) * 4;
      data[k] = d; data[k + 1] = d; data[k + 2] = d; data[k + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
    tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    // 以攝影機為中心的環狀網格（近密遠疏）
    const NR = 56, NS = 96, pos = new Float32Array((NR + 1) * (NS + 1) * 3), idx = [];
    for (let r = 0; r <= NR; r++) for (let s = 0; s <= NS; s++) {
      const rad = 3200 * Math.pow(r / NR, 2.3), a = (s / NS) * Math.PI * 2, k = (r * (NS + 1) + s) * 3;
      pos[k] = Math.cos(a) * rad; pos[k + 1] = 0; pos[k + 2] = Math.sin(a) * rad;
    }
    for (let r = 0; r < NR; r++) for (let s = 0; s < NS; s++) { const a = r * (NS + 1) + s, b = a + 1, c = a + NS + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
    const waveFn = `
vec3 waves(vec2 p, float t){ // 回傳 (高度, dx, dz)
  float h = 0.0; vec2 d = vec2(0.0);
  vec2 k1 = vec2(0.045, 0.02), k2 = vec2(-0.03, 0.06), k3 = vec2(0.11, -0.07), k4 = vec2(0.19, 0.16);
  float a1 = dot(k1,p)+t*0.9, a2 = dot(k2,p)+t*1.15, a3 = dot(k3,p)+t*1.7, a4 = dot(k4,p)+t*2.3;
  h += 0.30*sin(a1) + 0.22*sin(a2) + 0.09*sin(a3) + 0.04*sin(a4);
  d += 0.30*cos(a1)*k1 + 0.22*cos(a2)*k2 + 0.09*cos(a3)*k3 + 0.04*cos(a4)*k4;
  return vec3(h, d);
}`;
    this.oceanMat = new THREE.ShaderMaterial({
      transparent: true, fog: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uTime: TIME, uDepth: { value: tex }, uSun: { value: SUN_DIR }, uCam: { value: new THREE.Vector3() },
        uShallow: { value: new THREE.Color('#58ecd6') }, uMid: { value: new THREE.Color('#22b4ea') }, uDeep: { value: new THREE.Color('#1253c4') }, uSky: { value: new THREE.Color('#8fcdf5') }, uStorm: { value: 0 },
      }]),
      vertexShader: `uniform float uTime; uniform sampler2D uDepth; uniform vec3 uCam; varying vec3 vW; varying float vD;
${waveFn}
#include <fog_pars_vertex>
void main(){
  vec3 p = position; p.x += uCam.x; p.z += uCam.z;
  vD = texture2D(uDepth, (p.xz + ${HALF}.0) / ${HALF * 2}.0).r * 8.0;
  vec3 w = waves(p.xz, uTime);
  p.y += w.x * smoothstep(0.0, 2.5, vD);
  vec4 wp = vec4(p, 1.0); vW = p;
  vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
      fragmentShader: `uniform float uTime; uniform sampler2D uDepth; uniform vec3 uSun, uCam, uShallow, uMid, uDeep, uSky; uniform float uStorm; varying vec3 vW; varying float vD;
${waveFn}
float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hsh(i), hsh(i+vec2(1,0)), f.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), f.x), f.y); }
#include <fog_pars_fragment>
void main(){
  float dm = texture2D(uDepth, (vW.xz + ${HALF}.0) / ${HALF * 2}.0).r * 8.0;
  if (abs(vW.x) > ${HALF}.0 || abs(vW.z) > ${HALF}.0) dm = 8.0;
  vec3 w = waves(vW.xz, uTime);
  vec2 rip = vec2(vn(vW.xz*0.9 + uTime*0.35), vn(vW.xz*0.9 - uTime*0.3 + 17.0)) - 0.5;
  vec3 N = normalize(vec3(-w.y*0.9 - rip.x*0.22, 1.0, -w.z*0.9 - rip.y*0.22));
  vec3 V = normalize(cameraPosition - vW);
  float k = clamp(dm / 6.0, 0.0, 1.0);
  vec3 col = mix(uShallow, uMid, smoothstep(0.0, 0.45, k)); col = mix(col, uDeep, smoothstep(0.35, 1.0, k));
  col *= mix(1.0, 0.45, uStorm);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col = mix(col, uSky, fres * 0.34);
  vec3 L = normalize(uSun); vec3 R = reflect(-L, N);
  float sp = pow(max(dot(R, V), 0.0), 220.0) * 7.0 + pow(max(dot(R, V), 0.0), 18.0) * 0.28;
  col += vec3(1.0, 0.92, 0.75) * sp * (1.0 - uStorm*0.7);
  // 浪頭亮邊
  col += vec3(0.1,0.16,0.18) * smoothstep(0.45, 0.8, w.x*1.1 + rip.x*0.5) * smoothstep(0.3, 2.0, dm);
  // 岸邊泡沫：貼岸白邊 + 向岸推進的白線
  float nz = vn(vW.xz*0.55 + uTime*0.1);
  float edge = 1.0 - smoothstep(0.05, 0.22 + 0.12*sin(uTime*1.3 + vW.x*0.2), dm);
  float ph = dm*1.9 - uTime*0.42;
  float line = smoothstep(0.62, 0.86, sin(ph*6.2832 + nz*2.0)*0.5 + 0.5) * (1.0 - smoothstep(0.5, 2.6, dm)) * smoothstep(0.1, 0.3, dm);
  line *= smoothstep(0.25, 0.6, nz + 0.25*sin(vW.x*0.1));
  float foam = clamp(edge + line*0.8, 0.0, 1.0);
  col = mix(col, vec3(1.0), foam * 0.95);
  float alpha = mix(0.5, 1.0, smoothstep(0.0, 2.6, dm)); alpha = mix(alpha, 1.0, foam);
  gl_FragColor = vec4(col, alpha);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`,
    });
    this.ocean = new THREE.Mesh(geo, this.oceanMat);
    this.ocean.frustumCulled = false; this.ocean.renderOrder = 1;
    this.ctx.scene.add(this.ocean);
  }
  init() { this.flora.init?.(); }
  update(dt) {
    const p = this.ctx.camera.position, u = this.oceanMat.uniforms;
    u.uTime.value = TIME.value; u.uCam.value.set(p.x, 0, p.z); this.ocean.position.set(0, 0, 0);
    const k = this.ctx.render ? this.ctx.render._k || 0 : 0; u.uStorm.value = k; u.uSky.value.set('#8fcdf5').lerp(this.ctx.scene.fog.color, k);
    this.flora.update(dt);
  }
}
