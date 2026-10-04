// 由共用地圖資料建出整座鹽岬島的 Three.js 場景：地形、海、天空、建築、道路、樹石與地標。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT, MAT_COUNT, EXT, CELL, N } from '../core/map.js';
import { mulberry32, fbm, smooth } from '../core/rng.js';
import { makeTextures, signTexture } from './textures.js';

export const SUN_DIR = new THREE.Vector3(-0.62, 0.36, -0.7).normalize();
export const FOG = new THREE.Color('#d8b892');
const FIELDS = ['#c9b26a', '#8e9a4c', '#a3815a', '#b9a65f', '#7c8a45', '#d1bd7c'].map((c) => new THREE.Color(c));

const BASE = {
  [MAT.plaster]: '#efe8db', [MAT.plasterWarm]: '#e3bf86', [MAT.plasterRose]: '#d69a80', [MAT.plasterSage]: '#b9c3a3', [MAT.concrete]: '#cdc6b8',
  [MAT.brick]: '#ffffff', [MAT.wood]: '#ffffff', [MAT.tile]: '#ffffff', [MAT.roof]: '#ffffff', [MAT.metal]: '#dcd8cf', [MAT.rust]: '#ffffff',
  [MAT.container]: '#ffffff', [MAT.stone]: '#efe7d6', [MAT.trim]: '#5e4b39', [MAT.salt]: '#ffffff', [MAT.car]: '#ffffff', [MAT.tank]: '#ece9e1',
  [MAT.crate]: '#ffffff', [MAT.temple]: '#ffffff', [MAT.glass]: '#ffffff',
};

export function buildWorld(W, renderer) {
  const scene = new THREE.Scene();
  scene.background = FOG.clone();
  scene.fog = new THREE.FogExp2(FOG.getHex(), 0.00032);
  const T = makeTextures();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  for (const t of Object.values(T)) t.anisotropy = Math.min(8, maxAniso);

  // ---- 光 ----
  const hemi = new THREE.HemisphereLight('#c9d2d0', '#8c6c48', 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffd6a0', 2.7);
  sun.position.copy(SUN_DIR).multiplyScalar(300);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 700;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  // ---- 天空 ----
  const sky = new THREE.Mesh(new THREE.SphereGeometry(6000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sun: { value: SUN_DIR } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position.z = gl_Position.w; }',
    fragmentShader: `varying vec3 vD; uniform vec3 sun;
      void main(){ float h = vD.y; vec3 hor = vec3(0.86,0.72,0.55); vec3 mid = vec3(0.66,0.70,0.70); vec3 zen = vec3(0.36,0.47,0.55);
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h)); c = mix(c, zen, smoothstep(0.18, 0.75, h));
        c = mix(c, vec3(0.62,0.52,0.42), smoothstep(0.0, -0.2, h));
        float s = max(dot(normalize(vD), sun), 0.0);
        c += vec3(1.0,0.72,0.42) * pow(s, 8.0) * 0.35 + vec3(1.0,0.86,0.6) * pow(s, 900.0) * 3.0;
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  sky.renderOrder = -10;
  scene.add(sky);

  // ---- 地形 ----
  const terrain = buildTerrainMesh(W, T);
  scene.add(terrain);

  // ---- 海 ----
  const sea = buildSea(W);
  scene.add(sea);

  // ---- 建築方塊 ----
  const mats = makeMaterials(T);
  const bmesh = buildBoxes(W, mats);
  for (const m of bmesh) scene.add(m);
  scene.add(buildCylinders(W, mats, T));
  scene.add(buildRoads(W, T));
  scene.add(buildPads(W, T));
  const veg = buildVegetation(W);
  scene.add(veg);
  scene.add(buildDeco(W, T, mats));

  const world = {
    scene, sun, hemi, sky, sea, terrain,
    update(cam, time) {
      // 陰影只覆蓋鏡頭附近，貼齊陰影貼圖格避免閃爍
      const step = 140 / 2048;
      const tx = Math.round(cam.position.x / step) * step, tz = Math.round(cam.position.z / step) * step;
      // 高空時把陰影鏡頭移開，避免只有一塊區域有地形自陰影
      const high = cam.position.y > 230;
      const ty = high ? -8000 : cam.position.y - 20;
      sun.target.position.set(tx, ty, tz);
      sun.position.set(tx + SUN_DIR.x * 300, ty + SUN_DIR.y * 300, tz + SUN_DIR.z * 300);
      sky.position.copy(cam.position);
      sea.material.uniforms.time.value = time;
      sea.position.x = Math.round(cam.position.x / 50) * 50; sea.position.z = Math.round(cam.position.z / 50) * 50;
      sea.material.uniforms.offset.value.set(sea.position.x, sea.position.z);
    },
  };
  return world;
}

function makeMaterials(T) {
  const M = [];
  const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, ...o });
  M[MAT.plaster] = M[MAT.plasterWarm] = M[MAT.plasterRose] = M[MAT.plasterSage] = std({ map: T.plaster });
  M[MAT.concrete] = std({ map: T.concrete });
  M[MAT.brick] = std({ map: T.brick });
  M[MAT.wood] = std({ map: T.wood, roughness: 0.8 });
  M[MAT.tile] = std({ map: T.tile, roughness: 0.6 });
  M[MAT.roof] = std({ map: T.roof });
  M[MAT.metal] = std({ map: T.metal, roughness: 0.7, metalness: 0.15 });
  M[MAT.rust] = std({ map: T.rust, roughness: 0.85 });
  M[MAT.container] = std({ map: T.container, roughness: 0.75, metalness: 0.1 });
  M[MAT.stone] = std({ map: T.stone });
  M[MAT.trim] = std({ roughness: 0.8 });
  M[MAT.salt] = std({ map: T.salt, roughness: 0.7 });
  M[MAT.car] = std({ roughness: 0.45, metalness: 0.2 });
  M[MAT.tank] = std({ map: T.metal, roughness: 0.55, metalness: 0.2 });
  M[MAT.crate] = std({ map: T.crate });
  M[MAT.temple] = std({ map: T.temple, roughness: 0.7 });
  M[MAT.glass] = std({ map: T.glass, roughness: 0.15, metalness: 0.4 });
  return M;
}

// 每個方塊 6 面，UV 以公尺為單位（貼圖 repeat 決定尺寸）
function buildBoxes(W, mats) {
  const buckets = Array.from({ length: MAT_COUNT }, () => ({ p: [], n: [], u: [], c: [], i: [] }));
  const col = new THREE.Color(), tint = new THREE.Color(), ceilCol = new THREE.Color('#e6e0d4');
  const rnd = mulberry32(5);
  const B = W.B;
  for (let k = 0; k < W.BM.length; k++) {
    const m = W.BM[k];
    const x0 = B[k * 6], y0 = B[k * 6 + 1], z0 = B[k * 6 + 2], x1 = B[k * 6 + 3], y1 = B[k * 6 + 4], z1 = B[k * 6 + 5];
    col.set(BASE[m]);
    if (W.BT[k]) { tint.setHex(W.BT[k]); col.multiply(tint); }
    const v = 0.93 + rnd() * 0.12; col.multiplyScalar(v);
    const faces = [
      [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], 'zy', -1],
      [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], 'zy', 1],
      [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], 'xz', 1],
      [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], 'xz', 1],
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], 'xy', 1],
      [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], 'xy', -1],
    ];
    for (const [a, b, c, d, n, ax, flip] of faces) {
      // 木地板與磁磚樓板的底面是下一層的天花板：改用白灰泥
      const ceil = n[1] < 0 && (m === MAT.wood || m === MAT.tile);
      const bk = ceil ? buckets[MAT.plaster] : buckets[m];
      const fc = ceil ? ceilCol : col;
      const base = bk.p.length / 3;
      for (const q of [a, b, c, d]) {
        bk.p.push(q[0], q[1], q[2]); bk.n.push(n[0], n[1], n[2]);
        const u = ax === 'zy' ? q[2] * flip : q[0] * flip, vv = ax === 'xz' ? q[2] : q[1];
        bk.u.push(u, vv);
        // 牆底略暗，模擬地面反射的遮蔽
        const ao = n[1] === 0 ? 0.82 + 0.18 * Math.min(1, (q[1] - y0) / 1.2 + (y0 > 1 ? 0.6 : 0)) : n[1] < 0 ? 0.75 : 1;
        bk.c.push(fc.r * ao, fc.g * ao, fc.b * ao);
      }
      bk.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const out = [];
  buckets.forEach((bk, m) => {
    if (!bk.p.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(bk.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(bk.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(bk.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(bk.c, 3));
    g.setIndex(bk.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(bk.i, 1) : new THREE.Uint16BufferAttribute(bk.i, 1));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mats[m]);
    mesh.castShadow = m !== MAT.glass; mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    out.push(mesh);
  });
  return out;
}

function vcolor(g, hex) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function uvScale(g, sx, sy) { const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * sx, u.getY(i) * sy); return g; }

function buildCylinders(W, mats, T) {
  const groups = new Map();
  const add = (m, g) => { if (!groups.has(m)) groups.set(m, []); groups.get(m).push(g); };
  for (const c of W.cyls) {
    const [x, z, r, y0, y1, m] = c;
    if (m < 0) continue;
    const h = y1 - y0;
    let g;
    if (m === MAT.salt) {
      g = new THREE.ConeGeometry(r * 1.25, h + 1, 14, 1);
      g.translate(x, y0 + (h + 1) / 2, z);
      g = g.toNonIndexed();
    } else {
      const seg = r > 3 ? 32 : r > 1 ? 16 : 10;
      g = new THREE.CylinderGeometry(r, r, h, seg, 1, false);
      uvScale(g, (Math.PI * 2 * r), h);
      g.translate(x, y0 + h / 2, z);
    }
    const base = BASE[m] || '#ffffff';
    add(m, vcolor(g.index ? g.toNonIndexed() : g, base));
  }
  const grp = new THREE.Group();
  for (const [m, list] of groups) {
    const g = mergeGeometries(list.map((x) => { const y = x.index ? x.toNonIndexed() : x; for (const k of Object.keys(y.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) y.deleteAttribute(k); return y; }));
    const mesh = new THREE.Mesh(g, mats[m]);
    mesh.castShadow = mesh.receiveShadow = true;
    grp.add(mesh);
  }
  void T;
  return grp;
}

function buildTerrainMesh(W, T) {
  const H = W.H;
  const pos = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2);
  // 每個頂點到道路的距離（逐線段光柵化）
  const RD = new Float32Array(N * N).fill(99);
  for (const rd of [...W.roads, W.runway]) {
    const P = rd.pts, R = rd.w / 2 + 6;
    for (let k = 0; k < P.length - 1; k++) {
      const a = P[k], b = P[k + 1];
      const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - R + EXT) / CELL)), i1 = Math.min(N - 1, Math.ceil((Math.max(a[0], b[0]) + R + EXT) / CELL));
      const j0 = Math.max(0, Math.floor((Math.min(a[2], b[2]) - R + EXT) / CELL)), j1 = Math.min(N - 1, Math.ceil((Math.max(a[2], b[2]) + R + EXT) / CELL));
      const vx = b[0] - a[0], vz = b[2] - a[2], L2 = vx * vx + vz * vz || 1;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = -EXT + i * CELL, z = -EXT + j * CELL;
        const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[2]) * vz) / L2));
        const d = Math.hypot(x - a[0] - vx * t, z - a[2] - vz * t) - rd.w / 2;
        if (d < RD[j * N + i]) RD[j * N + i] = d;
      }
    }
  }
  const sand = new THREE.Color('#d8c398'), grass = new THREE.Color('#a8a25c'), green = new THREE.Color('#7b8444'), dirt = new THREE.Color('#b4976a'),
    rock = new THREE.Color('#9b8f7c'), sea = new THREE.Color('#8b8169'), dry = new THREE.Color('#c2ad73'), c = new THREE.Color(), t2 = new THREE.Color();
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i, x = -EXT + i * CELL, z = -EXT + j * CELL, h = H[k];
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
    uv[k * 2] = x / 14; uv[k * 2 + 1] = z / 14;
    const hx = H[j * N + Math.min(N - 1, i + 1)] - H[j * N + Math.max(0, i - 1)], hz = H[Math.min(N - 1, j + 1) * N + i] - H[Math.max(0, j - 1) * N + i];
    const slope = Math.sqrt(hx * hx + hz * hz) / (2 * CELL);
    const n1 = fbm(x / 60, z / 60, 3, 21), n2 = fbm(x / 18 + 4, z / 18, 2, 33);
    c.copy(grass).lerp(green, smooth(0.45, 0.7, n1));
    c.lerp(dry, smooth(0.55, 0.75, n2) * 0.6);
    if (h > 55) c.lerp(dirt, smooth(55, 110, h) * 0.6);
    c.lerp(rock, smooth(0.35, 0.75, slope));
    c.lerp(sand, smooth(3.2, 1.4, h));
    if (h < -0.5) c.lerp(sea, smooth(-0.5, -4, h));
    const rd = RD[k];
    // 路旁的田：斜向格子、四種作物色、田埂略暗
    if (rd > 10 && rd < 150 && h > 2.6 && h < 60 && slope < 0.18) {
      const u = (x * 0.94 + z * 0.34) / 46, w2 = (z * 0.94 - x * 0.34) / 34;
      const fu = Math.floor(u), fw = Math.floor(w2), hsh = fbm(fu * 7.3, fw * 5.1, 1, 77);
      if (hsh > 0.42) {
        const pal = FIELDS[Math.floor(hsh * 997) % FIELDS.length];
        const edge = Math.min(u - fu, 1 - (u - fu), w2 - fw, 1 - (w2 - fw));
        t2.copy(pal); if (edge < 0.05) t2.multiplyScalar(0.72);
        c.lerp(t2, smooth(150, 110, rd) * smooth(10, 20, rd) * 0.82);
      }
    }
    if (rd < 5) { t2.copy(dirt).multiplyScalar(0.92); c.lerp(t2, smooth(5, 0.5, rd) * 0.75); }
    for (const tw of W.towns) { const d = Math.hypot(x - tw.x, z - tw.z); if (d < tw.r + 30) c.lerp(dirt, smooth(tw.r + 30, tw.r * 0.5, d) * 0.45); }
    const v = 0.94 + n2 * 0.12;
    col[k * 3] = c.r * v; col[k * 3 + 1] = c.g * v; col[k * 3 + 2] = c.b * v;
  }
  const idx = new Uint32Array((N - 1) * (N - 1) * 6);
  let o = 0;
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
    const a = j * N + i, b = a + 1, cc = a + N, d = cc + 1;
    // 與 heightAt 相同的對角線：(i,j)-(i+1,j+1)
    idx[o++] = a; idx[o++] = d; idx[o++] = b;
    idx[o++] = a; idx[o++] = cc; idx[o++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: T.ground, roughness: 0.97 });
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

function buildSea(W) {
  // 以高度場算水深：淺灘偏青綠、岸邊有浪花
  const S = N;
  const data = new Uint8Array(S * S * 4);
  for (let k = 0; k < S * S; k++) { const h = W.H[k]; const v = Math.max(0, Math.min(1, (h + 14) / 17)); data[k * 4] = Math.round(v * 255); data[k * 4 + 3] = 255; }
  const ht = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  ht.magFilter = ht.minFilter = THREE.LinearFilter; ht.needsUpdate = true;
  const g = new THREE.PlaneGeometry(9000, 9000, 1, 1); g.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { ht: { value: ht }, time: { value: 0 }, sun: { value: SUN_DIR }, fogC: { value: FOG }, offset: { value: new THREE.Vector2() }, ext: { value: EXT }, cell: { value: CELL }, n: { value: N } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform sampler2D ht; uniform float time, ext, cell, n; uniform vec3 sun, fogC; varying vec3 vW;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 uv = (vW.xz + ext) / (2.*ext) * (n-1.)/n + 0.5/n;
        float h = texture2D(ht, uv).r * 17. - 14.;
        if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) h = -14.;
        if (h > 0.25) discard;
        float depth = clamp(-h, 0., 14.);
        vec3 shallow = vec3(0.42,0.66,0.6), deep = vec3(0.12,0.28,0.33);
        vec3 c = mix(shallow, deep, smoothstep(0.5, 11., depth));
        vec2 p = vW.xz * 0.06;
        float w1 = vn(p + vec2(time*0.25, time*0.11)), w2 = vn(p*2.3 - vec2(time*0.18, -time*0.2));
        vec3 nrm = normalize(vec3((w1-0.5)*0.5 + (w2-0.5)*0.3, 1., (w2-0.5)*0.5 - (w1-0.5)*0.3));
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1. - max(dot(V, nrm), 0.), 4.);
        vec3 skyc = vec3(0.86,0.76,0.62);
        c = mix(c, skyc, fres * 0.6);
        vec3 R = reflect(-V, nrm);
        c += vec3(1.,0.8,0.55) * pow(max(dot(R, sun), 0.), 180.) * 1.6;
        float foam = smoothstep(1.4, 0.0, depth) * (0.55 + 0.45 * sin(time*1.6 - depth*4. + vn(vW.xz*0.2)*6.));
        foam *= smoothstep(0.3, 0.7, vn(vW.xz*0.35 + time*0.2));
        c = mix(c, vec3(0.97,0.95,0.9), clamp(foam, 0., 1.) * 0.85);
        float a = mix(0.62, 0.94, smoothstep(0.0, 3.5, depth));
        float d = length(cameraPosition - vW);
        float f = 1. - exp(-pow(d * 0.00032, 2.));
        c = mix(c, fogC, f);
        gl_FragColor = vec4(c, mix(a, 1., f));
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.renderOrder = 1;
  return mesh;
}

function ribbon(pts, w, y, vLen) {
  const p = [], u = [], idx = [];
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[2] - a[2]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const nx = -dz * w / 2, nz = dx * w / 2;
    if (i > 0) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
    p.push(pts[i][0] + nx, pts[i][1] + y, pts[i][2] + nz, pts[i][0] - nx, pts[i][1] + y, pts[i][2] - nz);
    u.push(0, acc / vLen, 1, acc / vLen);
    if (i > 0) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function buildRoads(W, T) {
  const grp = new THREE.Group();
  // 道路在有自己鋪面的城鎮裡斷開，不從房子底下穿過
  const paved = W.towns.filter((t) => !['village', 'cape', 'radar'].includes(t.kind));
  const pieces = [];
  for (const r of W.roads) {
    let cur = [];
    for (const p of r.pts) {
      const inside = paved.some((t) => (p[0] - t.x) ** 2 + (p[2] - t.z) ** 2 < (t.r * (t.kind === 'oldstreet' ? 0.86 : 0.62)) ** 2);
      if (inside) { if (cur.length > 1) pieces.push(cur); cur = []; } else cur.push(p);
    }
    if (cur.length > 1) pieces.push(cur);
  }
  const roads = mergeGeometries(pieces.map((pts) => ribbon(pts, 7, 0.06, 10)));
  const m = new THREE.MeshStandardMaterial({ map: T.road, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(roads, m); mesh.receiveShadow = true; grp.add(mesh);
  // 跑道
  const rw = W.runway, rp = [];
  const [a, b] = rw.pts;
  for (let k = 0; k <= 40; k++) { const t = k / 40; rp.push([a[0] + (b[0] - a[0]) * t, a[1], a[2] + (b[2] - a[2]) * t]); }
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#6b665d'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '30,28,25' : '200,195,185'},${Math.random() * 0.15})`; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  x.fillStyle = 'rgba(240,236,226,.85)'; x.fillRect(124, 20, 8, 110); x.fillRect(10, 0, 5, 256); x.fillRect(241, 0, 5, 256);
  const rt = new THREE.CanvasTexture(c); rt.wrapS = rt.wrapT = THREE.RepeatWrapping; rt.colorSpace = THREE.SRGBColorSpace; rt.anisotropy = 8;
  const run = new THREE.Mesh(ribbon(rp, rw.w, 0.05, 40), new THREE.MeshStandardMaterial({ map: rt, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  run.receiveShadow = true; grp.add(run);
  return grp;
}

function buildPads(W, T) {
  const kinds = [[], [], []];
  for (const [x0, z0, x1, z1, y, k] of W.pads) {
    const g = new THREE.BoxGeometry(x1 - x0, 0.36, z1 - z0);
    uvScale(g, (x1 - x0), (z1 - z0));
    g.translate((x0 + x1) / 2, y - 0.14, (z0 + z1) / 2);
    kinds[k].push(g);
  }
  const grp = new THREE.Group();
  const mats = [
    new THREE.MeshStandardMaterial({ map: T.asphalt, roughness: 0.92 }),
    new THREE.MeshStandardMaterial({ map: T.pave, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ map: T.concrete, roughness: 0.9 }),
  ];
  kinds.forEach((list, k) => { if (!list.length) return; const m = new THREE.Mesh(mergeGeometries(list), mats[k]); m.receiveShadow = true; grp.add(m); });
  return grp;
}

function buildVegetation(W) {
  const grp = new THREE.Group();
  const rnd = mulberry32(9);
  const lam = (hex, o = {}) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.95, flatShading: true, ...o });
  const blob = (r, detail = 1) => { const g = new THREE.IcosahedronGeometry(r, detail); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const s = 0.82 + rnd() * 0.3; p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.8, p.getZ(i) * s); } g.computeVertexNormals(); return g; };
  // 0 橄欖：矮、樹冠灰綠；1 柏樹：細高；2 行道樹；3 灌木
  const trunk = new THREE.CylinderGeometry(0.16, 0.26, 2.4, 6); trunk.translate(0, 1.2, 0);
  const olive = mergeGeometries([blob(1.7).translate(0, 3.0, 0), blob(1.2).translate(1.1, 2.6, 0.4), blob(1.1).translate(-0.9, 2.7, -0.5)]);
  const cypress = new THREE.ConeGeometry(0.95, 7.5, 7, 3); { const p = cypress.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const bulge = 1 + 0.35 * Math.sin((y / 7.5 + 0.5) * Math.PI); p.setX(i, p.getX(i) * bulge); p.setZ(i, p.getZ(i) * bulge); } cypress.computeVertexNormals(); cypress.translate(0, 4.6, 0); }
  const street = mergeGeometries([blob(2.2).translate(0, 4.2, 0), blob(1.6).translate(1.3, 3.6, 0.6)]);
  const bush = blob(1.1).translate(0, 0.6, 0);
  const defs = [
    { g: olive, m: lam('#8f9867'), trunk: true },
    { g: cypress, m: lam('#4a5631'), trunk: true },
    { g: street, m: lam('#6c7a3d'), trunk: true },
    { g: bush, m: lam('#828a52'), trunk: false },
  ];
  const trunkMat = lam('#6a5236');
  const by = [[], [], [], []];
  for (const t of W.trees) by[t[3]].push(t);
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  const trunkList = W.trees.filter((t) => defs[t[3]].trunk);
  const tm = new THREE.InstancedMesh(trunk, trunkMat, trunkList.length);
  trunkList.forEach((t, i) => { dummy.position.set(t[0], t[1] - 0.2, t[2]); dummy.rotation.set(0, rnd() * 6.28, 0); dummy.scale.setScalar(t[4] * (t[3] === 1 ? 0.8 : 1)); dummy.updateMatrix(); tm.setMatrixAt(i, dummy.matrix); });
  tm.castShadow = true; grp.add(tm);
  defs.forEach((d, k) => {
    const list = by[k]; if (!list.length) return;
    const im = new THREE.InstancedMesh(d.g, d.m, list.length);
    list.forEach((t, i) => {
      dummy.position.set(t[0], t[1] - 0.2, t[2]); dummy.rotation.set(0, rnd() * 6.28, 0); dummy.scale.setScalar(t[4]); dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      col.setHSL(0.17 + (rnd() - 0.5) * 0.05, 0.9, 0.85 + rnd() * 0.25); im.setColorAt(i, col);
    });
    im.castShadow = true; im.receiveShadow = true;
    grp.add(im);
  });
  // 岩石
  const rg = new THREE.IcosahedronGeometry(1, 0); { const p = rg.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.8 + rnd() * 0.4), p.getY(i) * (0.6 + rnd() * 0.3), p.getZ(i) * (0.8 + rnd() * 0.4)); rg.computeVertexNormals(); }
  const rm = new THREE.InstancedMesh(rg, lam('#a99d89'), W.rocks.length);
  W.rocks.forEach((r, i) => { dummy.position.set(r[0], r[1] + r[3] * 0.2, r[2]); dummy.rotation.set(rnd(), rnd() * 6.28, rnd() * 0.4); dummy.scale.set(r[3], r[3] * 0.9, r[3] * 1.1); dummy.updateMatrix(); rm.setMatrixAt(i, dummy.matrix); });
  rm.castShadow = true; rm.receiveShadow = true; grp.add(rm);
  return grp;
}

function buildDeco(W, T, mats) {
  const grp = new THREE.Group();
  const geo = { stone: [], white: [], red: [], dark: [], metal: [], roof: [], salt: [], panW: [], panS: [], glass: [], wheel: [] };
  const signGroup = new THREE.Group();
  const wheel = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10); wheel.rotateZ(Math.PI / 2);
  for (const d of W.deco) {
    if (d.t === 'sign') {
      const tex = signTexture(d.text, d.c);
      const h = Math.min(d.h, d.text.length * 1.1 + 0.4);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, 0.9), [
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }),
        new THREE.MeshStandardMaterial({ color: '#3a2c20' }), new THREE.MeshStandardMaterial({ color: '#3a2c20' }),
        new THREE.MeshStandardMaterial({ color: '#3a2c20' }), new THREE.MeshStandardMaterial({ color: '#3a2c20' }),
      ]);
      // 招牌垂直於立面向外伸
      const rot = d.rot;
      m.position.set(d.x, d.y + h / 2, d.z);
      m.rotation.y = rot * Math.PI / 2;
      const off = new THREE.Vector3(0, 0, 0.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot * Math.PI / 2);
      m.position.add(off);
      m.castShadow = true;
      signGroup.add(m);
    } else if (d.t === 'templeRoof') {
      grp.add(templeRoof(d, mats));
    } else if (d.t === 'cabglass') {
      const g = new THREE.BoxGeometry(d.x1 - d.x0 - 0.1, d.h, d.z1 - d.z0 - 0.1); g.translate((d.x0 + d.x1) / 2, d.y + d.h / 2, (d.z0 + d.z1) / 2); geo.glass.push(g);
    } else if (d.t === 'boom') {
      const g = new THREE.BoxGeometry(2, 2, d.len); g.translate(d.x + 0, d.y + 1, d.z); const g2 = new THREE.BoxGeometry(1.2, 1.2, d.len * 0.7); g2.rotateY(Math.PI / 2); g2.translate(d.x + d.len * 0.35 - 6, d.y + 1, d.z);
      geo.red.push(g.translate(d.len * 0.35, 0, 0).rotateY(0)); geo.red.push(g2);
    } else if (d.t === 'lighthouse') {
      for (let k = 0; k < 3; k++) { const g = new THREE.CylinderGeometry(d.r + 0.03, d.r + 0.03, 2.2, 32, 1, true); g.translate(d.x, d.y + 5 + k * 8, d.z); geo.red.push(g); }
      const lamp = new THREE.CylinderGeometry(d.r * 0.7, d.r * 0.7, 2.6, 16); lamp.translate(d.x, d.y + d.h + 1.3, d.z); geo.glass.push(lamp);
      const cap = new THREE.ConeGeometry(d.r * 0.85, 2.2, 16); cap.translate(d.x, d.y + d.h + 3.7, d.z); geo.red.push(cap);
      const gal = new THREE.CylinderGeometry(d.r + 0.8, d.r + 0.8, 0.3, 24); gal.translate(d.x, d.y + d.h + 0.15, d.z); geo.dark.push(gal);
    } else if (d.t === 'kiln') {
      const g = new THREE.CylinderGeometry(d.r * 0.55, d.r, 3.2, 20); g.translate(d.x, d.y + d.h + 1.6, d.z); geo.stone.push(g);
      const arch = new THREE.BoxGeometry(2.4, 2.8, 1); arch.translate(d.x, d.y + 1.4, d.z + d.r - 0.3); geo.dark.push(arch);
    } else if (d.t === 'tank') {
      const g = new THREE.SphereGeometry(d.r, 24, 6, 0, Math.PI * 2, 0, 0.35); g.translate(d.x, d.y + d.h - d.r * Math.cos(0.35) + 0.02, d.z); geo.white.push(g);
      if (d.ladder) { const l = new THREE.BoxGeometry(0.6, d.h, 0.15); l.translate(d.x, d.y + d.h / 2, d.z + d.r + 0.08); geo.dark.push(l); }
    } else if (d.t === 'radome') {
      const g = new THREE.SphereGeometry(d.r * 1.05, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); g.translate(d.x, d.y + d.h, d.z); geo.white.push(g);
    } else if (d.t === 'mast' || d.t === 'flare' || d.t === 'chimney') {
      const g = new THREE.CylinderGeometry(d.r * 1.3, d.r * 1.3, 1.2, 10); g.translate(d.x, d.y + d.h - 0.6, d.z); geo.red.push(g);
    } else if (d.t === 'pan') {
      const g = new THREE.PlaneGeometry(d.x1 - d.x0 - 1.2, d.z1 - d.z0 - 1.2); g.rotateX(-Math.PI / 2); g.translate((d.x0 + d.x1) / 2, d.y + 0.05, (d.z0 + d.z1) / 2);
      (d.s < 0.55 ? geo.panW : geo.panS).push(g);
      for (const [w2, h2, ox, oz] of [[d.x1 - d.x0, 0.6, 0, -(d.z1 - d.z0) / 2], [d.x1 - d.x0, 0.6, 0, (d.z1 - d.z0) / 2], [0.6, d.z1 - d.z0, -(d.x1 - d.x0) / 2, 0], [0.6, d.z1 - d.z0, (d.x1 - d.x0) / 2, 0]]) {
        const b = new THREE.BoxGeometry(w2, 0.25, h2); b.translate((d.x0 + d.x1) / 2 + ox, d.y + 0.1, (d.z0 + d.z1) / 2 + oz); geo.salt.push(b);
      }
    } else if (d.t === 'wheels') {
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const g = wheel.clone(); if (!d.along) g.rotateY(Math.PI / 2);
        g.translate(d.x + (d.along ? sx * 1.35 : sz * 0.92), d.y + 0.36, d.z + (d.along ? sz * 0.92 : sx * 1.35)); geo.wheel.push(g);
      }
    } else if (d.t === 'plane') {
      grp.add(parkedPlane(d));
    } else if (d.t === 'belfry') {
      const g = new THREE.BoxGeometry(2.2, 3.4, 2.2); g.translate(d.x, d.y + 1.7, d.z - 0.9); geo.white.push(g);
      const c = new THREE.ConeGeometry(1.7, 1.8, 4); c.rotateY(Math.PI / 4); c.translate(d.x, d.y + 4.3, d.z - 0.9); geo.roof.push(c);
    } else if (d.t === 'censer') {
      const g = new THREE.CylinderGeometry(0.9, 0.7, 1.1, 12); g.translate(d.x, d.y + 0.55, d.z); geo.dark.push(g);
      const g2 = new THREE.CylinderGeometry(0.5, 0.9, 0.8, 4); g2.translate(d.x, d.y + 1.5, d.z); geo.dark.push(g2);
    }
  }
  const mk = (list, mat) => { if (!list.length) return; const g = mergeGeometries(list.map((x) => { const y = x.index ? x.toNonIndexed() : x; for (const k of Object.keys(y.attributes)) if (!['position', 'normal', 'uv'].includes(k)) y.deleteAttribute(k); return y; })); const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; grp.add(m); };
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
  mk(geo.stone, std({ map: T.stone, color: '#e9e0cc' }));
  mk(geo.white, std({ color: '#ecebe4', roughness: 0.5 }));
  mk(geo.red, std({ color: '#b84a2c', roughness: 0.6 }));
  mk(geo.dark, std({ color: '#3b3129' }));
  mk(geo.roof, std({ map: T.roof }));
  mk(geo.salt, std({ map: T.salt }));
  mk(geo.wheel, std({ color: '#1e1b18', roughness: 0.9 }));
  mk(geo.panW, std({ color: '#a7c2b8', roughness: 0.12, metalness: 0.2 }));
  mk(geo.panS, std({ map: T.salt, color: '#f4efe4', roughness: 0.6 }));
  if (geo.glass.length) { const g = mergeGeometries(geo.glass.map((x) => { const y = x.index ? x.toNonIndexed() : x; return y; })); grp.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#2f3b3c', roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.55 }))); }
  grp.add(signGroup);
  return grp;
}

// 燕尾脊廟頂：兩坡加上翹起的屋脊
function templeRoof(d, mats) {
  const g = new THREE.Group();
  const w = d.x1 - d.x0, dd = d.z1 - d.z0, cx = (d.x0 + d.x1) / 2, cz = (d.z0 + d.z1) / 2;
  const roofMat = new THREE.MeshStandardMaterial({ color: '#c46a3c', roughness: 0.7, flatShading: true });
  const segs = 10, rise = 3.2;
  const pos = [], idx = [];
  // 兩坡，沿 x 方向向兩端上翹
  for (const side of [-1, 1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs, x = d.x0 + w * u, lift = Math.pow(Math.abs(u - 0.5) * 2, 3) * 0.9;
      pos.push(x, d.y + rise + lift, cz, x, d.y + 0.2 + lift * 0.6, cz + side * dd / 2);
      if (i > 0) { const k = base + (i - 1) * 2; if (side > 0) idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); else idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, roofMat); m.castShadow = true; g.add(m);
  const back = m.clone(); back.material = roofMat.clone(); back.material.side = THREE.BackSide; g.add(back);
  // 燕尾脊
  const ridge = new THREE.BoxGeometry(w * 0.86, 0.5, 0.5); ridge.translate(cx, d.y + rise + 0.25, cz);
  const tail = (s) => { const t = new THREE.BoxGeometry(2.2, 0.4, 0.45); t.rotateZ(s * 0.55); t.translate(cx + s * (w * 0.43 + 0.8), d.y + rise + 0.95, cz); return t; };
  const rm = new THREE.Mesh(mergeGeometries([ridge, tail(1), tail(-1)]), new THREE.MeshStandardMaterial({ color: '#2e5a4c', roughness: 0.6 }));
  rm.castShadow = true; g.add(rm);
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), new THREE.MeshStandardMaterial({ color: '#e2b33c', roughness: 0.3, metalness: 0.5 }));
  pearl.position.set(cx, d.y + rise + 0.9, cz); g.add(pearl);
  void mats;
  return g;
}

function parkedPlane(d) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: '#d8d0bc', roughness: 0.5, metalness: 0.2 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.2, 22, 14), m); body.rotation.z = Math.PI / 2; body.position.y = 2.6;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 28), m); wing.position.set(1, 3.6, 0);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.3), m); tail.position.set(-10, 5, 0);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 9), m); stab.position.set(-10, 3.2, 0);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.62, 3, 14, 1, true), new THREE.MeshStandardMaterial({ color: '#b84a2c' })); stripe.rotation.z = Math.PI / 2; stripe.position.set(4, 2.6, 0);
  for (const o of [body, wing, tail, stab, stripe]) { o.castShadow = true; g.add(o); }
  g.position.set(d.x, d.y, d.z);
  return g;
}
