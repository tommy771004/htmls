// 地圖：路線、塔位、障礙物、地面繪製、地形與植被。
import * as THREE from 'three';
import { MAP, BASE, FOUNTAIN, TEAM_COLOR } from './config.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const TOP = [[-70, 58], [-73, 12], [-72, -48], [-63, -63], [-48, -72], [12, -73], [58, -70]];
const MID = [[-58, 58], [58, -58]];
const BOT = TOP.map(([x, z]) => [-x, -z]).reverse();
// LANES[i] = 從青隊（team 0）往赤隊的路點；赤隊使用反向
export const LANES = [TOP, MID, BOT].map((pts) => pts.map(([x, z]) => ({ x, z })));
export const LANE_NAMES = ['上路', '中路', '下路'];
export function lanePath(lane, team) { return team === 0 ? LANES[lane] : LANES[lane].slice().reverse(); }

function polyLen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z); return L; }
export function pointAlong(p, d) {
  for (let i = 1; i < p.length; i++) {
    const l = Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z);
    if (d <= l) { const k = d / l; return { x: p[i - 1].x + (p[i].x - p[i - 1].x) * k, z: p[i - 1].z + (p[i].z - p[i - 1].z) * k, seg: i }; }
    d -= l;
  }
  const e = p[p.length - 1]; return { x: e.x, z: e.z, seg: p.length - 1 };
}
export function distToSeg(px, pz, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz;
  let t = L ? ((px - a.x) * dx + (pz - a.z) * dz) / L : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - a.x - dx * t, pz - a.z - dz * t);
}
export function distToLane(px, pz, lane) { const p = LANES[lane]; let d = 1e9; for (let i = 1; i < p.length; i++) d = Math.min(d, distToSeg(px, pz, p[i - 1], p[i])); return d; }
export function distToLanes(px, pz) { return Math.min(distToLane(px, pz, 0), distToLane(px, pz, 1), distToLane(px, pz, 2)); }
export function nearestLane(px, pz) { let b = 0, bd = 1e9; for (let i = 0; i < 3; i++) { const d = distToLane(px, pz, i); if (d < bd) { bd = d; b = i; } } return b; }
// 路線上離 (px,pz) 最近點的弧長
export function laneProgress(path, px, pz) {
  let best = 1e9, bestD = 0, acc = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
    let t = ((px - a.x) * dx + (pz - a.z) * dz) / (L * L); t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(px - a.x - dx * t, pz - a.z - dz * t);
    if (d < best) { best = d; bestD = acc + t * L; }
    acc += L;
  }
  return bestD;
}
export const riverDist = (x, z) => Math.abs(x - z) / Math.SQRT2;

// 建築：每路外塔、內塔（各隊），主堡
export const STRUCTURES = [];
for (let team = 0; team < 2; team++) {
  for (let lane = 0; lane < 3; lane++) {
    const p = lanePath(lane, team), L = polyLen(p);
    const fr = lane === 1 ? [0.2, 0.39] : [0.16, 0.37];
    ['inner', 'outer'].forEach((tier, k) => {
      const q = pointAlong(p, L * fr[k]);
      STRUCTURES.push({ id: `t${team}${lane}${tier[0]}`, kind: 'tower', tier, team, lane, x: q.x, z: q.z });
    });
  }
  STRUCTURES.push({ id: `core${team}`, kind: 'core', team, x: BASE[team][0], z: BASE[team][1] });
}

// 高度：河道下凹、地圖外圍隆起成山
export function heightAt(x, z) {
  const r = riverDist(x, z);
  let h = 0;
  if (r < 9) { const k = 1 - r / 9; h -= 0.75 * k * k * (3 - 2 * k); }
  const e = Math.max(Math.abs(x), Math.abs(z)) - 92;
  if (e > 0) h += Math.min(e, 30) * 0.32 + Math.sin(x * 0.13) * Math.cos(z * 0.11) * Math.min(e, 10) * 0.25;
  return h;
}

// 障礙物（圓）：樹叢與岩石，避開路線、河道與基地
export const OBSTACLES = [];
{
  const R = rng(198);
  const ok = (x, z, r) => {
    if (Math.abs(x) > 86 - r || Math.abs(z) > 86 - r) return false;
    if (distToLanes(x, z) < 6.2 + r) return false;
    if (riverDist(x, z) < 6.5 + r) return false;
    for (const b of BASE) if (Math.hypot(x - b[0], z - b[1]) < 24 + r) return false;
    for (const o of OBSTACLES) if (Math.hypot(x - o.x, z - o.z) < o.r + r + 3.2) return false;
    return true;
  };
  for (let gx = -84; gx <= 84; gx += 5) for (let gz = -84; gz <= 84; gz += 5) {
    const x = gx + (R() - 0.5) * 4, z = gz + (R() - 0.5) * 4, r = 1.6 + R() * 2.8;
    if (R() < 0.82 && ok(x, z, r)) OBSTACLES.push({ x, z, r, kind: R() < 0.72 ? 'trees' : 'rock', seed: (R() * 1e6) | 0 });
  }
}

// 把圓推出障礙物與地圖邊界；回傳是否有碰撞
export function collide(p, radius) {
  let hit = false;
  for (const o of OBSTACLES) {
    const dx = p.x - o.x, dz = p.z - o.z, rr = o.r + radius, d2 = dx * dx + dz * dz;
    if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1e-4; p.x = o.x + (dx / d) * rr; p.z = o.z + (dz / d) * rr; hit = true; }
  }
  const lim = 88 - radius;
  if (p.x < -lim) { p.x = -lim; hit = true; } if (p.x > lim) { p.x = lim; hit = true; }
  if (p.z < -lim) { p.z = -lim; hit = true; } if (p.z > lim) { p.z = lim; hit = true; }
  return hit;
}
// 線段是否穿過障礙物（給 AI 與瞬移判斷視線）
export function blocked(ax, az, bx, bz, pad = 0) {
  for (const o of OBSTACLES) if (distToSeg(o.x, o.z, { x: ax, z: az }, { x: bx, z: bz }) < o.r + pad) return true;
  return false;
}
export function walkable(x, z, radius) { const p = { x, z }; return !collide(p, radius); }

/* ---------------- 地面貼圖 ---------------- */
const TEX_HALF = 130;
let TEX_PX = 2048;
function paintGround() {
  const c = document.createElement('canvas'); c.width = c.height = TEX_PX;
  const g = c.getContext('2d'), R = rng(7);
  const S = TEX_PX / (TEX_HALF * 2);
  const X = (x) => (x + TEX_HALF) * S, Z = (z) => (z + TEX_HALF) * S;
  g.fillStyle = '#5f9a3c'; g.fillRect(0, 0, TEX_PX, TEX_PX);
  // 草地：大筆刷色塊，野區偏深、路邊偏亮
  for (let i = 0; i < 26000; i++) {
    const x = (R() * 2 - 1) * TEX_HALF, z = (R() * 2 - 1) * TEX_HALF;
    const dl = distToLanes(x, z), edge = Math.max(Math.abs(x), Math.abs(z));
    const jungle = Math.min(1, Math.max(0, (dl - 8) / 14));
    const out = Math.min(1, Math.max(0, (edge - 88) / 10));
    const h = 92 + (R() - 0.5) * 22 - jungle * 6 + out * 12, s = 48 + R() * 16 - jungle * 6, l = 39 + (R() - 0.5) * 9 - jungle * 9 - out * 5;
    g.fillStyle = `hsla(${h},${s}%,${l}%,${0.35 + R() * 0.35})`;
    g.save(); g.translate(X(x), Z(z)); g.rotate(R() * Math.PI);
    g.beginPath(); g.ellipse(0, 0, (1 + R() * 2.6) * S, (0.4 + R() * 0.9) * S, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  // 河岸沙與河床
  const band = (w, col) => {
    g.strokeStyle = col; g.lineWidth = w * S * 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(X(-TEX_HALF), Z(-TEX_HALF)); g.lineTo(X(TEX_HALF), Z(TEX_HALF)); g.stroke();
  };
  band(9.5, '#c9b27a'); band(7.6, '#7d8f5a'); band(6.8, '#3f6f6a');
  // 路線：多層泥土筆觸
  const lanes = (w, col, jit, n = 1) => {
    for (let k = 0; k < n; k++) for (const p of LANES) {
      g.strokeStyle = col; g.lineWidth = (w + (R() - 0.5) * jit) * S; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); p.forEach((q, i) => (i ? g.lineTo : g.moveTo).call(g, X(q.x + (R() - 0.5) * jit), Z(q.z + (R() - 0.5) * jit))); g.stroke();
    }
  };
  lanes(13, 'rgba(120,140,70,.55)', 2, 2);
  lanes(10.5, '#b8955c', 1.2, 1);
  lanes(9, '#c9a76a', 1.5, 2);
  // 路面石板
  for (const p of LANES) {
    const L = polyLen(p);
    for (let d = 0; d < L; d += 0.9) {
      const q = pointAlong(p, d);
      for (let k = 0; k < 4; k++) {
        if (R() < 0.5) continue;
        const ox = (R() - 0.5) * 7.5, oz = (R() - 0.5) * 7.5, s = 0.32 + R() * 0.42;
        g.fillStyle = `hsl(${34 + R() * 10},${20 + R() * 12}%,${58 + R() * 10}%)`;
        g.strokeStyle = 'rgba(90,66,38,.35)'; g.lineWidth = 0.08 * S;
        g.save(); g.translate(X(q.x + ox), Z(q.z + oz)); g.rotate(R() * 3);
        g.beginPath(); for (let v = 0; v < 5; v++) { const a = (v / 5) * Math.PI * 2, rr = s * (0.75 + R() * 0.4) * S; (v ? g.lineTo : g.moveTo).call(g, Math.cos(a) * rr, Math.sin(a) * rr); }
        g.closePath(); g.fill(); g.stroke(); g.restore();
      }
    }
  }
  // 基地：石砌平台與隊伍色紋
  BASE.forEach((b, team) => {
    const cx = X(b[0]), cz = Z(b[1]);
    g.fillStyle = '#b9ab8e'; g.beginPath(); g.arc(cx, cz, 23 * S, 0, Math.PI * 2); g.fill();
    for (let ring = 0; ring < 7; ring++) {
      const r0 = (4 + ring * 2.9) * S, n = 10 + ring * 7;
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2 + ring * 0.3, a1 = ((k + 0.92) / n) * Math.PI * 2 + ring * 0.3;
        g.fillStyle = `hsl(${38 + R() * 8},${14 + R() * 10}%,${66 + R() * 12}%)`;
        g.beginPath(); g.arc(cx, cz, r0 + 2.7 * S, a0, a1); g.arc(cx, cz, r0, a1, a0, true); g.closePath(); g.fill();
      }
    }
    g.strokeStyle = TEAM_COLOR[team]; g.globalAlpha = 0.75; g.lineWidth = 0.7 * S;
    g.beginPath(); g.arc(cx, cz, 15.6 * S, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 0.35 * S; g.beginPath(); g.arc(cx, cz, 17 * S, 0, Math.PI * 2); g.stroke();
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * 15.6 * S, cz + Math.sin(a) * 15.6 * S); g.lineTo(cx + Math.cos(a + 0.12) * 17 * S, cz + Math.sin(a + 0.12) * 17 * S); g.stroke(); }
    g.globalAlpha = 1;
    // 泉水
    const f = FOUNTAIN[team];
    g.fillStyle = '#d7cfb9'; g.beginPath(); g.arc(X(f[0]), Z(f[1]), 5.6 * S, 0, Math.PI * 2); g.fill();
  });
  // 草叢小點與花
  for (let i = 0; i < 9000; i++) {
    const x = (R() * 2 - 1) * TEX_HALF, z = (R() * 2 - 1) * TEX_HALF;
    if (distToLanes(x, z) < 5.5 || riverDist(x, z) < 5) continue;
    const fl = R() < 0.06;
    g.fillStyle = fl ? ['#f4e7b0', '#f2b8a0', '#fff6e0'][(R() * 3) | 0] : `hsla(${80 + R() * 30},55%,${50 + R() * 16}%,.7)`;
    g.fillRect(X(x), Z(z), (fl ? 0.25 : 0.12) * S, (fl ? 0.25 : 0.55) * S);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { tex, canvas: c };
}

function detailTexture() {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), R = rng(99);
  g.fillStyle = '#808080'; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 2600; i++) {
    const x = R() * N, y = R() * N, v = (R() * 120 + 70) | 0;
    g.fillStyle = `rgba(${v},${v},${v},.35)`;
    g.save(); g.translate(x, y); g.rotate(R() * 3);
    for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { g.beginPath(); g.ellipse(dx, dy, 1 + R() * 5, 0.6 + R() * 2, 0, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

/* ---------------- 3D 場景 ---------------- */
let gradMap;
export function toonGradient() {
  if (gradMap) return gradMap;
  const d = new Uint8Array([90, 170, 255]);
  gradMap = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); gradMap.minFilter = gradMap.magFilter = THREE.NearestFilter; gradMap.needsUpdate = true;
  return gradMap;
}
const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra });

export function buildMap(scene, quality = 1) {
  const group = new THREE.Group(); scene.add(group);
  TEX_PX = quality > 0 ? 4096 : 2048;
  const { tex, canvas } = paintGround();
  // 地面
  const seg = quality > 0 ? 260 : 150;
  const geo = new THREE.PlaneGeometry(TEX_HALF * 2, TEX_HALF * 2, seg, seg); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const gmat = new THREE.MeshLambertMaterial({ map: tex });
  // 細節雜訊：以世界座標平鋪，放大時地面不會糊成一片
  const detail = detailTexture();
  gmat.onBeforeCompile = (sh) => {
    sh.uniforms.uDetail = { value: detail };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWxz;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWxz = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uDetail; varying vec2 vWxz;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n float dt1 = texture2D(uDetail, vWxz * 0.19).r, dt2 = texture2D(uDetail, vWxz * 0.047 + 0.37).r;\n diffuseColor.rgb *= 0.8 + 0.26 * dt1 + 0.14 * dt2;');
  };
  const ground = new THREE.Mesh(geo, gmat);
  ground.receiveShadow = true; group.add(ground);

  // 河水
  const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 12.4, 1, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `varying vec2 vUv; varying vec3 vW; uniform float uTime;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      void main(){
        float e = abs(vUv.y-.5)*2.;
        vec2 p = vW.xz*.35; float t=uTime;
        float r = n(p+vec2(t*.6,t*.4))*.6 + n(p*2.3-vec2(t*.5,-t*.3))*.4;
        vec3 deep = vec3(.09,.30,.34), shal = vec3(.22,.50,.50);
        vec3 c = mix(deep, shal, smoothstep(.15,.95,e));
        float streak = smoothstep(.72,.78,r) * (1.-e*.6);
        c += vec3(.55,.78,.74)*streak*.35;
        float foam = smoothstep(.82,.98,e + r*.08);
        c = mix(c, vec3(.86,.92,.86), foam*.7);
        gl_FragColor = vec4(c, mix(.78,.95,foam) * (1.-smoothstep(.97,1.,e)));
      }`,
  }));
  water.rotation.x = -Math.PI / 2; water.rotation.z = -Math.PI / 4; water.position.y = -0.32; water.renderOrder = 1;
  group.add(water);

  // 植被：樹（多球冠）、松、岩石，用 InstancedMesh
  const R = rng(4242);
  const trees = [], pines = [], rocks = [];
  for (const o of OBSTACLES) {
    if (o.kind === 'rock') {
      rocks.push({ x: o.x, z: o.z, s: o.r * 0.95, rot: R() * 6 });
      const n = 1 + ((R() * 3) | 0);
      for (let k = 0; k < n; k++) { const a = R() * 6.28, d = o.r * (0.5 + R() * 0.4); rocks.push({ x: o.x + Math.cos(a) * d, z: o.z + Math.sin(a) * d, s: o.r * (0.3 + R() * 0.3), rot: R() * 6 }); }
    } else {
      const n = Math.max(2, Math.round(o.r * o.r * 0.55));
      for (let k = 0; k < n; k++) {
        const a = R() * 6.28, d = Math.sqrt(R()) * Math.max(0, o.r - 1.1);
        const t = { x: o.x + Math.cos(a) * d, z: o.z + Math.sin(a) * d, s: 0.8 + R() * 0.55, rot: R() * 6, hue: R() };
        (R() < 0.35 ? pines : trees).push(t);
      }
    }
  }
  // 地圖外圍密林
  for (let i = 0; i < (quality > 0 ? 1700 : 900); i++) {
    const x = (R() * 2 - 1) * 128, z = (R() * 2 - 1) * 128;
    const e = Math.max(Math.abs(x), Math.abs(z));
    if (e < 90.5) continue;
    const t = { x, z, s: 1 + R() * 0.8 + Math.min(1, (e - 90) / 20) * 0.6, rot: R() * 6, hue: R() };
    (R() < 0.55 ? pines : trees).push(t);
    if (R() < 0.08) rocks.push({ x: x + 2, z: z + 1, s: 1.5 + R() * 2.5, rot: R() * 6 });
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p3 = new THREE.Vector3(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  const inst = (geom, mat, list, fn) => {
    const im = new THREE.InstancedMesh(geom, mat, list.length);
    list.forEach((t, i) => { fn(t, i, im); });
    im.castShadow = true; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    group.add(im); return im;
  };
  const place = (t, s, im, i, yoff = 0, sy = 1) => { q.setFromAxisAngle(up, t.rot); sc.set(s, s * sy, s); p3.set(t.x, heightAt(t.x, t.z) + yoff, t.z); m4.compose(p3, q, sc); im.setMatrixAt(i, m4); };
  // 闊葉樹：樹幹＋三顆球冠合成一個幾何
  const crown = (() => {
    const parts = [];
    const add = (g, x, y, z) => { g.translate(x, y, z); parts.push(g); };
    add(new THREE.IcosahedronGeometry(1.45, 1), 0, 2.9, 0);
    add(new THREE.IcosahedronGeometry(1.05, 1), 0.8, 2.4, 0.4);
    add(new THREE.IcosahedronGeometry(1.0, 1), -0.7, 2.5, -0.35);
    add(new THREE.IcosahedronGeometry(0.85, 1), 0.1, 3.75, 0.1);
    return mergeGeo(parts);
  })();
  const trunk = new THREE.CylinderGeometry(0.18, 0.3, 2.2, 6); trunk.translate(0, 1.1, 0);
  const crownMat = toon('#ffffff', { flatShading: true });
  const trunkMat = toon('#6b4a2f');
  inst(trunk, trunkMat, trees, (t, i, im) => place(t, t.s, im, i));
  inst(crown, crownMat, trees, (t, i, im) => { place(t, t.s, im, i); col.setHSL(0.24 + t.hue * 0.09, 0.45 + t.hue * 0.15, 0.32 + t.hue * 0.1); im.setColorAt(i, col); });
  // 松樹：疊三層圓錐
  const pine = mergeGeo([0, 1, 2].map((k) => { const g = new THREE.ConeGeometry(1.5 - k * 0.38, 1.9, 7); g.translate(0, 1.7 + k * 1.15, 0); return g; }));
  inst(trunk, trunkMat, pines, (t, i, im) => place(t, t.s * 0.8, im, i));
  inst(pine, toon('#ffffff', { flatShading: true }), pines, (t, i, im) => { place(t, t.s, im, i, 0, 1.15); col.setHSL(0.36 + t.hue * 0.06, 0.38, 0.24 + t.hue * 0.08); im.setColorAt(i, col); });
  // 岩石
  const rockG = new THREE.DodecahedronGeometry(1, 0); {
    const rp = rockG.attributes.position, RR = rng(11);
    for (let i = 0; i < rp.count; i++) rp.setXYZ(i, rp.getX(i) * (0.85 + RR() * 0.3), rp.getY(i) * (0.6 + RR() * 0.25), rp.getZ(i) * (0.85 + RR() * 0.3));
    rockG.computeVertexNormals();
  }
  inst(rockG, toon('#ffffff', { flatShading: true }), rocks, (t, i, im) => { place(t, t.s, im, i, t.s * 0.25); col.setHSL(0.09, 0.08 + (i % 5) * 0.02, 0.46 + (i % 7) * 0.025); im.setColorAt(i, col); });

  // 路邊草簇（小錐）
  const tufts = [];
  for (const p of LANES) {
    const L = polyLen(p);
    for (let d = 0; d < L; d += 0.9) {
      const a = pointAlong(p, d), b = pointAlong(p, d + 0.5), dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
      for (const side of [-1, 1]) {
        if (R() < 0.3) continue;
        const off = 5.2 + R() * 1.8, x = a.x - (dz / l) * off * side, z = a.z + (dx / l) * off * side;
        if (riverDist(x, z) < 5) continue;
        tufts.push({ x, z, s: 0.5 + R() * 0.6, rot: R() * 6, hue: R() });
      }
    }
  }
  const tuftG = mergeGeo([0, 1, 2].map((k) => { const g = new THREE.ConeGeometry(0.12, 0.9, 3); g.rotateZ((k - 1) * 0.35); g.translate((k - 1) * 0.15, 0.4, 0); return g; }));
  const tuftM = inst(tuftG, toon('#ffffff'), tufts, (t, i, im) => { place(t, t.s, im, i); col.setHSL(0.22 + t.hue * 0.08, 0.5, 0.42 + t.hue * 0.12); im.setColorAt(i, col); });
  tuftM.castShadow = false;

  // 基地裝飾：泉水環
  FOUNTAIN.forEach((f, team) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.35, 6, 40), toon('#d8ccb0'));
    ring.rotation.x = Math.PI / 2; ring.position.set(f[0], 0.25, f[1]); ring.castShadow = true; group.add(ring);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(4.7, 40), new THREE.MeshBasicMaterial({ color: TEAM_COLOR[team], transparent: true, opacity: 0.45 }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(f[0], 0.08, f[1]); group.add(pool);
  });

  return { group, ground, water, groundCanvas: canvas, update(t) { water.material.uniforms.uTime.value = t; } };
}

function mergeGeo(list) {
  // 簡易合併（全部轉成非索引並串接 position/normal）
  let n = 0; const ni = list.map((g) => { const x = g.index ? g.toNonIndexed() : g; n += x.attributes.position.count; return x; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (const g of ni) { g.computeVertexNormals(); pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
export { mergeGeo, toon };
