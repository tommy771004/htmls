// 由共用地圖資料建出鹽岬島的場景：HDRI 天空與環境光、級聯陰影、PBR 掃描貼圖的建築與地形、
// 窗框玻璃與室內細節、道路標線、樹、電線桿、車輛與道具。外部素材（A）缺少時退回程序貼圖。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CSM } from 'three/addons/csm/CSM.js';
import { MAT, MAT_COUNT, DK, EXT, CELL, N } from '../core/map.js';
import { mulberry32, fbm, smooth, hash2 } from '../core/rng.js';
import { makeTextures, signTexture, hsignTexture } from './textures.js';
import { buildKit } from './kit.js';

export const SUN_DIR = new THREE.Vector3(-0.45, 0.72, -0.53).normalize();
export const FOG = new THREE.Color('#c4cfd6');
const FIELDS = ['#efe2a0', '#c9d98a', '#d9b98c', '#e8d79a', '#b8cc84', '#f2e6b0'].map((c) => new THREE.Color(c));

// 每種材質的貼圖：外部檔名、一張貼圖代表幾公尺、粗糙度、法線強度
const SURF = {
  [MAT.plaster]: ['plaster', 2.4, 0.92, 0.6], [MAT.plasterWarm]: ['plaster', 2.4, 0.92, 0.6], [MAT.plasterRose]: ['plaster', 2.4, 0.92, 0.6], [MAT.plasterSage]: ['plaster', 2.4, 0.92, 0.6],
  [MAT.concrete]: ['concrete', 3, 0.9, 0.7], [MAT.brick]: ['brick', 1.4, 0.88, 1], [MAT.wood]: ['wood', 1.8, 0.62, 0.6], [MAT.tile]: ['tile', 1.2, 0.35, 0.5],
  [MAT.roof]: ['roof', 1.6, 0.8, 1], [MAT.metal]: ['metal', 1.6, 0.55, 1], [MAT.rust]: ['rust', 2, 0.75, 0.8], [MAT.container]: ['metal', 1.2, 0.6, 1.2],
  [MAT.stone]: ['concrete', 2.5, 0.9, 0.8], [MAT.trim]: [null, 1, 0.7, 0], [MAT.salt]: ['sand', 2, 0.85, 0.5], [MAT.car]: [null, 1, 0.4, 0],
  [MAT.tank]: ['metal', 3, 0.5, 0.3], [MAT.crate]: ['wood', 1, 0.8, 0.6], [MAT.temple]: ['plaster', 2, 0.7, 0.4], [MAT.glass]: [null, 1, 0.1, 0], [MAT.facade]: ['facade', 9, 0.25, 0.6], [MAT.siding]: ['siding', 2.2, 0.75, 1], [MAT.hidden]: ['wood', 1.8, 0.6, 0.6], [MAT.invis]: [null, 1, 0.9, 0],
};
const BASE = {
  [MAT.plaster]: '#f4f1ea', [MAT.plasterWarm]: '#efd29e', [MAT.plasterRose]: '#e8b39e', [MAT.plasterSage]: '#cdd8bb', [MAT.concrete]: '#e6e2da',
  [MAT.brick]: '#ffffff', [MAT.wood]: '#ffffff', [MAT.tile]: '#ffffff', [MAT.roof]: '#ffffff', [MAT.metal]: '#ffffff', [MAT.rust]: '#ffffff',
  [MAT.container]: '#ffffff', [MAT.stone]: '#f2ece0', [MAT.trim]: '#3d342b', [MAT.salt]: '#ffffff', [MAT.car]: '#ffffff', [MAT.tank]: '#f4f3ef',
  [MAT.crate]: '#c79a64', [MAT.temple]: '#c4432a', [MAT.glass]: '#ffffff', [MAT.facade]: '#ffffff', [MAT.siding]: '#f4f2ec', [MAT.hidden]: '#b08a5e', [MAT.invis]: '#ffffff',
};
const INTERIOR_OK = new Set([MAT.plaster, MAT.plasterWarm, MAT.plasterRose, MAT.plasterSage, MAT.brick, MAT.concrete, MAT.stone, MAT.siding]);

export function sunFromHDR(t) {
  const img = t?.image; if (!img?.data) return null;
  const { width: w, height: h, data } = img, half = data instanceof Uint16Array;
  const f = (i) => (half ? THREE.DataUtils.fromHalfFloat(data[i]) : data[i]);
  let best = -1, bx = 0, by = 0;
  for (let y = 0; y < h / 2; y += 2) for (let x = 0; x < w; x += 2) {
    const i = (y * w + x) * 4, l = f(i) + f(i + 1) + f(i + 2);
    if (l > best) { best = l; bx = x; by = y; }
  }
  const u = bx / w, v = 1 - by / h;
  const el = (v - 0.5) * Math.PI, az = (u - 0.5) * Math.PI * 2;
  return new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).normalize();
}

export function buildWorld(W, renderer, camera, A, Q) {
  const scene = new THREE.Scene();
  const T = makeTextures();
  const real = !!A?.ok;
  const sunDir = (real && sunFromHDR(A.env)) || SUN_DIR.clone();
  // 太陽太低時影子會拉很長：把仰角夾在 35°～70°
  { const el = Math.asin(sunDir.y); const c = Math.max(0.6, Math.min(1.22, el)); const hz = Math.hypot(sunDir.x, sunDir.z) || 1; sunDir.set(sunDir.x / hz * Math.cos(c), Math.sin(c), sunDir.z / hz * Math.cos(c)); }
  SUN_DIR.copy(sunDir);
  if (real) {
    scene.background = A.sky;
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromEquirectangular(A.env || A.sky).texture;
    scene.environmentIntensity = 0.68;
    pm.dispose();
  } else scene.background = FOG.clone();
  scene.fog = new THREE.FogExp2(FOG.getHex(), 0.00028);

  // ---- 光與陰影 ----
  const hemi = new THREE.HemisphereLight('#dfe9f2', '#7d6a4f', real ? 0.32 : 1.1);
  scene.add(hemi);
  let csm = null, sun = null;
  if (Q.shadows === 'csm') {
    csm = new CSM({ maxFar: 520, cascades: 3, mode: 'practical', parent: scene, shadowMapSize: 2048, lightDirection: sunDir.clone().negate(), camera, lightIntensity: 3.1, lightMargin: 260, lightFar: 1400 });
    csm.fade = true;
    for (const l of csm.lights) { l.color.set('#fff3e2'); l.shadow.bias = -0.0003; l.shadow.normalBias = 0.05; }
  } else {
    sun = new THREE.DirectionalLight('#fff3e2', 3.1);
    sun.castShadow = Q.shadows !== 'none';
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera; sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 600;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
    scene.add(sun, sun.target);
  }
  const csmify = (m) => {
    if (!csm) return m;
    const mine = m.onBeforeCompile;
    csm.setupMaterial(m);
    const hook = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => { hook(sh, r); if (mine && mine !== hook) mine(sh, r); };
    return m;
  };

  // ---- 天空（沒有外部天空時用漸層） ----
  let skyMesh = null;
  if (!real) {
    skyMesh = new THREE.Mesh(new THREE.SphereGeometry(6000, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { sun: { value: sunDir } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position.z = gl_Position.w; }',
      fragmentShader: `varying vec3 vD; uniform vec3 sun; void main(){ float h = vD.y; vec3 c = mix(vec3(0.78,0.83,0.87), vec3(0.36,0.55,0.78), smoothstep(0.0, 0.6, h)); c = mix(c, vec3(0.55,0.53,0.48), smoothstep(0.0,-0.2,h)); float s = max(dot(vD, sun), 0.); c += vec3(1.,0.95,0.85) * (pow(s, 600.) * 4. + pow(s, 12.) * 0.15); gl_FragColor = vec4(c,1.); }`,
    }));
    skyMesh.renderOrder = -10; scene.add(skyMesh);
  }

  const mats = makeMaterials(T, A, csmify);
  for (const m of buildBoxes(W, mats, A)) scene.add(m);
  scene.add(buildDetails(W, csmify));
  scene.add(buildCylinders(W, mats, !!A?.kit));
  const terrain = buildTerrainMesh(W, T, A, csmify);
  scene.add(terrain);
  const sea = buildSea(W, A, sunDir);
  scene.add(sea);
  scene.add(buildRoads(W, T, A, csmify));
  scene.add(buildPads(W, T, A, csmify));
  scene.add(buildVegetation(W, A, csmify));
  scene.add(buildPoles(W, csmify));
  scene.add(buildDeco(W, T, A, mats, csmify));
  scene.add(buildKit(W, A?.kit, csmify, A?.furniture));

  return {
    scene, csm, sun, hemi, sea, terrain, sunDir, csmify,
    update(cam, time) {
      if (csm) csm.update();
      else if (sun) {
        const high = cam.position.y > 230, step = 120 / 1024;
        const tx = Math.round(cam.position.x / step) * step, tz = Math.round(cam.position.z / step) * step, ty = high ? -8000 : cam.position.y - 20;
        sun.target.position.set(tx, ty, tz); sun.position.set(tx + sunDir.x * 300, ty + sunDir.y * 300, tz + sunDir.z * 300);
      }
      if (skyMesh) skyMesh.position.copy(cam.position);
      sea.material.uniforms.time.value = time;
      sea.position.x = Math.round(cam.position.x / 50) * 50; sea.position.z = Math.round(cam.position.z / 50) * 50;
    },
    resize() { if (csm) csm.updateFrustums(); },
  };
}

function repTex(t, size) { if (!t) return null; const c = t.clone(); c.repeat.set(1 / size, 1 / size); c.needsUpdate = true; return c; }

function makeMaterials(T, A, csmify) {
  const M = [];
  const fallback = { [MAT.brick]: T.brick, [MAT.wood]: T.wood, [MAT.tile]: T.tile, [MAT.concrete]: T.concrete, [MAT.metal]: T.metal, [MAT.rust]: T.rust, [MAT.container]: T.container, [MAT.stone]: T.stone, [MAT.roof]: T.roof, [MAT.crate]: T.crate, [MAT.temple]: T.temple, [MAT.salt]: T.salt, [MAT.glass]: T.glass, [MAT.tank]: T.metal };
  for (let m = 0; m < MAT_COUNT; m++) {
    const [name, size, rough, ns] = SURF[m];
    const o = { vertexColors: true, roughness: rough, metalness: m === MAT.metal || m === MAT.tank || m === MAT.container ? 0.25 : 0 };
    if (name && A?.tex[name]) { o.map = repTex(A.tex[name], size); if (A.nrm[name] && ns > 0) { o.normalMap = repTex(A.nrm[name], size); o.normalScale = new THREE.Vector2(ns, ns); } }
    else if (fallback[m]) { o.map = fallback[m].clone(); o.map.repeat.set(1 / size, 1 / size); o.map.needsUpdate = true; }
    else if (m <= MAT.plasterSage || m === MAT.facade || m === MAT.siding) { o.map = T.plaster.clone(); o.map.repeat.set(1 / size, 1 / size); o.map.needsUpdate = true; }
    if (m === MAT.facade) { o.metalness = 0.05; o.roughness = 0.45; o.envMapIntensity = 1.2; }
    M[m] = csmify(new THREE.MeshStandardMaterial(o));
  }
  const wo = { vertexColors: true, roughness: 0.9 };
  if (A?.tex.wall) { wo.map = repTex(A.tex.wall, 2.2); if (A.nrm.wall) { wo.normalMap = repTex(A.nrm.wall, 2.2); wo.normalScale = new THREE.Vector2(0.35, 0.35); } }
  else { wo.map = T.plaster.clone(); wo.map.repeat.set(1 / 2.2, 1 / 2.2); wo.map.needsUpdate = true; }
  wo.envMapIntensity = 0.45; wo.emissive = new THREE.Color('#1d1b18');
  M.wall = csmify(new THREE.MeshStandardMaterial(wo));
  M.ceil = csmify(new THREE.MeshStandardMaterial({ ...wo, emissive: new THREE.Color('#3a3733') }));
  M[MAT.wood].envMapIntensity = 0.45; M[MAT.tile].envMapIntensity = 0.45;
  return M;
}

// 方塊：每面以公尺為 UV；朝建築內側的牆面改用室內白牆、樓板底面當天花板
function buildBoxes(W, mats, A) {
  const keys = [...Array(MAT_COUNT).keys(), 'wall', 'ceil'];
  const buckets = new Map(keys.map((k) => [k, { p: [], n: [], u: [], c: [], i: [] }]));
  const col = new THREE.Color(), tint = new THREE.Color(), white = new THREE.Color('#ebe4d6');
  const rnd = mulberry32(5);
  const B = W.B;
  const hideCars = A && Object.keys(A.cars || {}).length > 0;
  for (let k = 0; k < W.BM.length; k++) {
    const m = W.BM[k];
    if (hideCars && (m === MAT.car || m === MAT.glass)) continue;
    if (m === MAT.hidden && A?.furniture) continue; // 家具的碰撞方塊：外觀由 Blender 模型負責
    if (m === MAT.invis) continue;                 // 橋面、人行道、穀倉屋頂：由其他網格繪製
    const x0 = B[k * 6], y0 = B[k * 6 + 1], z0 = B[k * 6 + 2], x1 = B[k * 6 + 3], y1 = B[k * 6 + 4], z1 = B[k * 6 + 5];
    col.set(BASE[m]);
    if (W.BT[k]) { tint.setHex(W.BT[k]); col.multiply(tint); }
    col.multiplyScalar(0.94 + rnd() * 0.1);
    const bi = W.boxBld[k], bld = bi != null ? W.buildings[bi] : null;
    const tall = y1 - y0 > 1.0;
    const faces = [
      [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], 'zy', -1],
      [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], 'zy', 1],
      [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], 'xz', 1],
      [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], 'xz', 1],
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], 'xy', 1],
      [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], 'xy', -1],
    ];
    for (const [a, b, c, d, n, ax, flip] of faces) {
      let key = m;
      if (n[1] < 0 && (m === MAT.wood || m === MAT.tile || (m === MAT.concrete && bld && y0 > bld.y + 2))) key = 'ceil';
      if (n[1] === 0 && bld && tall && INTERIOR_OK.has(m)) {
        const fx = n[0] > 0 ? x1 : n[0] < 0 ? x0 : (x0 + x1) / 2, fz = n[2] > 0 ? z1 : n[2] < 0 ? z0 : (z0 + z1) / 2;
        const onEdge = (n[0] > 0 && fx > bld.x1 - 0.05) || (n[0] < 0 && fx < bld.x0 + 0.05) || (n[2] > 0 && fz > bld.z1 - 0.05) || (n[2] < 0 && fz < bld.z0 + 0.05);
        if (!onEdge) key = 'wall';
      }
      const bk = buckets.get(key), fc = key === 'wall' || key === 'ceil' ? white : col;
      const base = bk.p.length / 3;
      for (const q of [a, b, c, d]) {
        bk.p.push(q[0], q[1], q[2]); bk.n.push(n[0], n[1], n[2]);
        bk.u.push(ax === 'zy' ? q[2] * flip : q[0] * flip, ax === 'xz' ? q[2] : q[1]);
        const ao = n[1] === 0 ? 0.86 + 0.14 * Math.min(1, (q[1] - y0) / 1.2 + (y0 > 1 ? 0.6 : 0)) : n[1] < 0 && key !== 'ceil' ? 0.8 : 1;
        bk.c.push(fc.r * ao, fc.g * ao, fc.b * ao);
      }
      bk.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const out = [];
  for (const [key, bk] of buckets) {
    if (!bk.p.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(bk.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(bk.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(bk.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(bk.c, 3));
    g.setIndex(bk.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(bk.i, 1) : new THREE.Uint16BufferAttribute(bk.i, 1));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, key === 'wall' ? mats.wall : key === 'ceil' ? mats.ceil : mats[key]);
    mesh.castShadow = key !== MAT.glass; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
    out.push(mesh);
  }
  return out;
}

// 只供繪製的細節：窗框、玻璃、踢腳板、腰牆、燈、暖氣片、冷氣機
function buildDetails(W, csmify) {
  const grp = new THREE.Group();
  const lists = new Map();
  const box = new THREE.BoxGeometry(1, 1, 1);
  for (const d of W.dboxes) {
    const k = d[6];
    if (!lists.has(k)) lists.set(k, []);
    const g = box.clone(); g.scale(d[3] - d[0], d[4] - d[1], d[5] - d[2]); g.translate((d[0] + d[3]) / 2, (d[1] + d[4]) / 2, (d[2] + d[5]) / 2);
    lists.get(k).push(g);
  }
  const M = {
    [DK.frame]: { color: '#f1eee7', roughness: 0.55 }, [DK.base]: { color: '#5b4733', roughness: 0.6 }, [DK.wains]: { color: '#c9c1b1', roughness: 0.75 },
    [DK.lamp]: { color: '#ffffff', emissive: '#fff6e6', emissiveIntensity: 2.2, roughness: 0.3 }, [DK.rad]: { color: '#ecebe6', roughness: 0.45, metalness: 0.3 },
    [DK.ac]: { color: '#dddcd6', roughness: 0.5, metalness: 0.2 }, [DK.dark]: { color: '#2b2824', roughness: 0.7 }, [DK.steel]: { color: '#8e918f', roughness: 0.45, metalness: 0.6 },
    [DK.poster]: { color: '#d8cdb4', roughness: 0.7 },
    [DK.corn]: { color: '#ece7dc', roughness: 0.6 }, [DK.found]: { color: '#8e8a82', roughness: 0.9 },
    [DK.brick]: { color: '#8a4231', roughness: 0.85 }, [DK.fence]: { color: '#f3f1ea', roughness: 0.65 },
  };
  for (const [k, list] of lists) {
    for (let s = 0; s < list.length; s += 2500) {
      const g = mergeGeometries(list.slice(s, s + 2500));
      let mat;
      if (k === DK.glass) mat = new THREE.MeshStandardMaterial({ color: '#7f9aa0', roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.32, envMapIntensity: 2.2, depthWrite: false });
      else mat = new THREE.MeshStandardMaterial(M[k]);
      if (k === DK.ac) addGrill(mat);
      if (k !== DK.glass) csmify(mat);
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = k !== DK.glass && k !== DK.lamp; mesh.receiveShadow = k !== DK.glass;
      if (k === DK.glass) mesh.renderOrder = 2;
      grp.add(mesh);
    }
  }
  return grp;
}
// 冷氣機正面的散熱格柵：用世界座標畫橫條紋
function addGrill(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb *= 0.82 + 0.18 * step(0.5, fract(vWp.y * 22.));');
  };
}

function vcolor(g, hex) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function uvScale(g, sx, sy) { const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * sx, u.getY(i) * sy); return g; }
const strip = (g) => { const y = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(y.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) y.deleteAttribute(k); return y; };

function buildCylinders(W, mats, kit) {
  const groups = new Map();
  const add = (m, g) => { if (!groups.has(m)) groups.set(m, []); groups.get(m).push(g); };
  for (const c of W.cyls) {
    const [x, z, r, y0, y1, m] = c;
    if (m < 0) continue;
    if (kit && m === MAT.tank && r < 0.8) continue; // 屋頂水塔改用 Blender 模型
    const h = y1 - y0;
    let g;
    if (m === MAT.salt) { g = new THREE.ConeGeometry(r * 1.25, h + 1, 18, 1); uvScale(g, r * 6, h); g.translate(x, y0 + (h + 1) / 2, z); }
    else { const seg = r > 3 ? 40 : r > 1 ? 18 : 10; g = new THREE.CylinderGeometry(r, r, h, seg, 1, false); uvScale(g, Math.PI * 2 * r, h); g.translate(x, y0 + h / 2, z); }
    add(m, vcolor(strip(g), BASE[m] || '#ffffff'));
  }
  const grp = new THREE.Group();
  for (const [m, list] of groups) { const mesh = new THREE.Mesh(mergeGeometries(list), mats[m]); mesh.castShadow = mesh.receiveShadow = true; grp.add(mesh); }
  return grp;
}

// ---- 地形：草、草地夾泥、泥土、岩石、沙五層混合 ----
function buildTerrainMesh(W, T, A, csmify) {
  const H = W.H;
  const pos = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2), spl = new Float32Array(N * N * 4);
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
  const c = new THREE.Color(), t2 = new THREE.Color();
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i, x = -EXT + i * CELL, z = -EXT + j * CELL, h = H[k];
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
    uv[k * 2] = x / 4; uv[k * 2 + 1] = z / 4;
    const hx = H[j * N + Math.min(N - 1, i + 1)] - H[j * N + Math.max(0, i - 1)], hz = H[Math.min(N - 1, j + 1) * N + i] - H[Math.max(0, j - 1) * N + i];
    const slope = Math.sqrt(hx * hx + hz * hz) / (2 * CELL);
    const n1 = fbm(x / 70, z / 70, 3, 21), n2 = fbm(x / 22 + 4, z / 22, 2, 33);
    let gd = smooth(0.48, 0.66, n1) * 0.8 + smooth(0.6, 0.75, n2) * 0.3;
    let dirt = 0, rock = smooth(0.32, 0.7, slope) + (h > 80 ? smooth(80, 130, h) * 0.6 : 0), sand = smooth(3.1, 1.7, h);
    const rd = RD[k];
    if (rd < 4.5) dirt = Math.max(dirt, smooth(4.5, 0.5, rd) * 0.85);
    for (const tw of W.towns) { const d = Math.hypot(x - tw.x, z - tw.z); if (d < tw.r + 25) dirt = Math.max(dirt, smooth(tw.r + 25, tw.r * 0.6, d) * (0.45 + n2 * 0.4)); }
    if (h < -0.3) { sand = 1; rock = 0; }
    c.setRGB(0.92, 0.9, 0.82);
    if (rd > 10 && rd < 150 && h > 2.6 && h < 60 && slope < 0.18) {
      const u = (x * 0.94 + z * 0.34) / 46, w2 = (z * 0.94 - x * 0.34) / 34;
      const fu = Math.floor(u), fw = Math.floor(w2), hsh = fbm(fu * 7.3, fw * 5.1, 1, 77);
      if (hsh > 0.42) {
        const pal = FIELDS[Math.floor(hsh * 997) % FIELDS.length];
        const edge = Math.min(u - fu, 1 - (u - fu), w2 - fw, 1 - (w2 - fw));
        const f = smooth(150, 110, rd) * smooth(10, 20, rd);
        t2.copy(pal); c.lerp(t2, f * 0.85);
        if (pal.r > 0.9 && pal.g > 0.85) dirt = Math.max(dirt, f * 0.25);
        if (edge < 0.04) gd = Math.max(gd, f);
      }
    }
    const v = 0.92 + n2 * 0.14;
    col[k * 3] = c.r * v; col[k * 3 + 1] = c.g * v; col[k * 3 + 2] = c.b * v;
    sand = Math.min(1, sand); rock = Math.min(1 - sand, rock); dirt = Math.min(1 - sand - rock, dirt); gd = Math.min(1 - sand - rock - dirt, gd);
    spl[k * 4] = gd; spl[k * 4 + 1] = dirt; spl[k * 4 + 2] = rock; spl[k * 4 + 3] = sand;
  }
  const idx = new Uint32Array((N - 1) * (N - 1) * 6);
  let o = 0;
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
    const a = j * N + i, b = a + 1, cc = a + N, d = cc + 1;
    idx[o++] = a; idx[o++] = d; idx[o++] = b; idx[o++] = a; idx[o++] = cc; idx[o++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('splat', new THREE.BufferAttribute(spl, 4));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const has = A?.tex.grass && A.tex.dirt && A.tex.rock && A.tex.sand && A.tex.grassdirt;
  let m;
  if (has) {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, map: A.tex.grass, normalMap: A.nrm.grass, roughness: 0.95, normalScale: new THREE.Vector2(0.8, 0.8) });
    const U = { tGD: { value: A.tex.grassdirt }, tDirt: { value: A.tex.dirt }, tRock: { value: A.tex.rock }, tSand: { value: A.tex.sand }, nRock: { value: A.nrm.rock }, nDirt: { value: A.nrm.dirt }, nSand: { value: A.nrm.sand } };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 splat; varying vec4 vSplat; varying vec3 vWp;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSplat = splat; vWp = (modelMatrix * vec4(transformed,1.)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec4 vSplat; varying vec3 vWp; uniform sampler2D tGD, tDirt, tRock, tSand, nRock, nDirt, nSand;
        vec4 tri(sampler2D t, vec2 p) { vec4 a = texture2D(t, p * 0.25); vec4 b = texture2D(t, p * 0.061 + vec2(0.37, 0.71)); return mix(a, b, 0.35); }`)
        .replace('#include <map_fragment>', `
        vec2 wp = vWp.xz;
        float wG = clamp(1. - vSplat.x - vSplat.y - vSplat.z - vSplat.w, 0., 1.);
        vec3 alb = tri(map, wp).rgb * wG + tri(tGD, wp).rgb * vSplat.x + tri(tDirt, wp).rgb * vSplat.y + tri(tRock, wp * 0.5).rgb * vSplat.z + tri(tSand, wp).rgb * vSplat.w;
        diffuseColor.rgb *= alb;`)
        .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', `
        vec3 mapN = (texture2D(normalMap, vWp.xz * 0.25).xyz * (wG + vSplat.x) + texture2D(nDirt, vWp.xz * 0.25).xyz * vSplat.y + texture2D(nRock, vWp.xz * 0.125).xyz * vSplat.z + texture2D(nSand, vWp.xz * 0.25).xyz * vSplat.w) * 2.0 - 1.0;`);
    };
  } else m = new THREE.MeshStandardMaterial({ vertexColors: true, map: T.ground, roughness: 0.97, color: '#9aa063' });
  csmify(m);
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
  return mesh;
}

function buildSea(W, A, sunDir) {
  const S = N, data = new Uint8Array(S * S * 4);
  for (let k = 0; k < S * S; k++) { const h = W.H[k]; data[k * 4] = Math.round(Math.max(0, Math.min(1, (h + 14) / 17)) * 255); data[k * 4 + 3] = 255; }
  const ht = new THREE.DataTexture(data, S, S, THREE.RGBAFormat); ht.magFilter = ht.minFilter = THREE.LinearFilter; ht.needsUpdate = true;
  const g = new THREE.PlaneGeometry(9000, 9000, 1, 1); g.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { ht: { value: ht }, sky: { value: A?.sky || null }, hasSky: { value: A?.sky ? 1 : 0 }, time: { value: 0 }, sun: { value: sunDir }, fogC: { value: FOG }, ext: { value: EXT }, n: { value: N } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform sampler2D ht, sky; uniform float time, ext, n, hasSky; uniform vec3 sun, fogC; varying vec3 vW;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 uv = (vW.xz + ext) / (2.*ext) * (n-1.)/n + 0.5/n;
        float h = (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) ? -14. : texture2D(ht, uv).r * 17. - 14.;
        if (h > 0.25) discard;
        float depth = clamp(-h, 0., 14.);
        vec3 shallow = vec3(0.16,0.5,0.52), deep = vec3(0.02,0.12,0.2);
        vec3 c = mix(shallow, deep, smoothstep(0.4, 10., depth));
        vec2 p = vW.xz * 0.08;
        float w1 = vn(p + vec2(time*0.3, time*0.12)), w2 = vn(p*2.7 - vec2(time*0.21, -time*0.24)), w3 = vn(p*7.1 + time*0.5);
        vec3 nrm = normalize(vec3((w1-0.5)*0.35 + (w2-0.5)*0.25 + (w3-0.5)*0.12, 1., (w2-0.5)*0.35 - (w1-0.5)*0.25));
        vec3 V = normalize(cameraPosition - vW);
        float fres = 0.04 + 0.96 * pow(1. - max(dot(V, nrm), 0.), 5.);
        vec3 R = reflect(-V, nrm); R.y = abs(R.y);
        vec3 refl = vec3(0.5,0.64,0.8);
        if (hasSky > 0.5) { vec2 su = vec2(atan(R.z, R.x) / 6.2831853 + 0.5, asin(clamp(R.y,-1.,1.)) / 3.1415927 + 0.5); refl = texture2D(sky, su).rgb; }
        c = mix(c, refl, clamp(fres, 0., 1.) * 0.9);
        c += vec3(1.,0.95,0.85) * pow(max(dot(R, sun), 0.), 400.) * 3.;
        float foam = smoothstep(1.1, 0.0, depth) * (0.55 + 0.45 * sin(time*1.4 - depth*5. + vn(vW.xz*0.2)*6.));
        foam *= smoothstep(0.35, 0.75, vn(vW.xz*0.45 + time*0.15));
        c = mix(c, vec3(0.95,0.96,0.95), clamp(foam, 0., 1.) * 0.9);
        float a = mix(0.55, 0.97, smoothstep(0.0, 3.0, depth));
        float d = length(cameraPosition - vW);
        float f = 1. - exp(-pow(d * 0.00028, 2.));
        c = mix(c, fogC, f);
        gl_FragColor = vec4(c, mix(a, 1., f));
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.renderOrder = 1;
  return mesh;
}

function ribbon(pts, w, y, size) {
  const p = [], u = [], lane = [], idx = [];
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[2] - a[2]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const nx = -dz * w / 2, nz = dx * w / 2;
    if (i > 0) acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
    p.push(pts[i][0] + nx, pts[i][1] + y, pts[i][2] + nz, pts[i][0] - nx, pts[i][1] + y, pts[i][2] - nz);
    u.push(0, acc / size, w / size, acc / size);
    lane.push(0, acc, 1, acc);
    if (i > 0) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
  g.setAttribute('lane', new THREE.Float32BufferAttribute(lane, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// 道路標線：中央黃色虛線、兩側白色邊線；跑道是白色中線與邊線
function laneMarks(m, kind) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 lane; varying vec2 vLane;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLane = lane;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vLane;').replace('#include <map_fragment>', `#include <map_fragment>
      float L = vLane.x, Aa = vLane.y;
      ${kind === 'runway' ? `
      float m1 = step(abs(L - 0.5), 0.006) * step(fract(Aa / 30.), 0.5);
      float m2 = step(abs(L - 0.05), 0.005) + step(abs(L - 0.95), 0.005);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93), clamp(m1 + m2, 0., 1.) * 0.9);` : `
      float cy = step(abs(L - 0.5), 0.012) * step(fract(Aa / 7.), 0.55);
      float ed = step(abs(L - 0.06), 0.009) + step(abs(L - 0.94), 0.009);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.74, 0.22), cy * 0.9);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93), clamp(ed, 0., 1.) * 0.85);`}`);
  };
  return m;
}

function buildRoads(W, T, A, csmify) {
  const grp = new THREE.Group();
  // 城鎮棋盤街道的範圍內不畫主要道路（避免兩層路面）
  const pieces = [];
  for (const r of W.roads) {
    let cur = [];
    for (const p of r.pts) {
      const inside = W.grids.some((g) => p[0] > g[0] + 4 && p[0] < g[2] - 4 && p[2] > g[1] + 4 && p[2] < g[3] - 4);
      if (inside) { if (cur.length > 1) pieces.push(cur); cur = []; } else cur.push(p);
    }
    if (cur.length > 1) pieces.push(cur);
  }
  const asph = A?.tex.asphalt;
  const mk = (kind) => {
    const o = { roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
    if (asph) { o.map = asph; o.normalMap = A.nrm.asphalt; o.normalScale = new THREE.Vector2(0.6, 0.6); } else o.map = T.asphalt;
    return csmify(laneMarks(new THREE.MeshStandardMaterial(o), kind));
  };
  const size = asph ? 4 : 6;
  const mesh = new THREE.Mesh(mergeGeometries(pieces.map((pts) => ribbon(pts, 7, 0.06, size))), mk('road')); mesh.receiveShadow = true; grp.add(mesh);
  const [a, b] = W.runway.pts, rp = [];
  for (let k = 0; k <= 40; k++) { const t = k / 40; rp.push([a[0] + (b[0] - a[0]) * t, a[1], a[2] + (b[2] - a[2]) * t]); }
  const run = new THREE.Mesh(ribbon(rp, W.runway.w, 0.05, size), mk('runway')); run.receiveShadow = true; grp.add(run);
  return grp;
}

function buildPads(W, T, A, csmify) {
  const kinds = [[], [], [], []], lines = [], yellow = [];
  for (const [x0, z0, x1, z1, y, k] of W.pads) {
    const g = new THREE.BoxGeometry(x1 - x0, 0.36, z1 - z0);
    uvScale(g, (x1 - x0), (z1 - z0));
    g.translate((x0 + x1) / 2, y - 0.14, (z0 + z1) / 2);
    kinds[k].push(g);
    if (k === 0) {
      // 街道：中央雙黃線＋兩側白色邊線
      const ax = x1 - x0 >= z1 - z0, L = ax ? x1 - x0 : z1 - z0, Wd = ax ? z1 - z0 : x1 - x0;
      if (Wd < 6 || L < 6) continue;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const strip2 = (off, wd, list) => { const p = new THREE.PlaneGeometry(ax ? L : wd, ax ? wd : L); p.rotateX(-Math.PI / 2); p.translate(cx + (ax ? 0 : off), y + 0.045, cz + (ax ? off : 0)); list.push(p); };
      strip2(-0.12, 0.1, yellow); strip2(0.12, 0.1, yellow);
      strip2(-Wd / 2 + 0.45, 0.12, lines); strip2(Wd / 2 - 0.45, 0.12, lines);
    }
  }
  const grp = new THREE.Group();
  const mat = (name, size, fb) => {
    const o = { roughness: 0.88 };
    if (A?.tex[name]) { o.map = repTex(A.tex[name], size); o.normalMap = repTex(A.nrm[name], size); o.normalScale = new THREE.Vector2(0.7, 0.7); } else { o.map = fb.clone(); o.map.repeat.set(1 / size, 1 / size); o.map.needsUpdate = true; }
    return csmify(new THREE.MeshStandardMaterial(o));
  };
  const pool = new THREE.MeshStandardMaterial({ color: '#4fb3c9', roughness: 0.04, metalness: 0.1, envMapIntensity: 1.6 });
  const mats = [mat('asphalt', 4, T.asphalt), mat('paving', 2, T.pave), mat('concrete2', 4, T.concrete), pool];
  kinds.forEach((list, k) => { if (!list.length) return; const m = new THREE.Mesh(mergeGeometries(list.map(strip)), mats[k]); m.receiveShadow = true; grp.add(m); });
  const paint = (list, color) => { if (!list.length) return; const m = new THREE.Mesh(mergeGeometries(list.map(strip)), csmify(new THREE.MeshStandardMaterial({ color, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }))); m.receiveShadow = true; grp.add(m); };
  paint(yellow, '#d9b13a'); paint(lines, '#e9e6de');
  grp.add(buildBridges(W, csmify));
  return grp;
}

// 橋：混凝土橋面、橋墩、兩側欄杆
function buildBridges(W, csmify) {
  const deck = [], rail = [];
  for (const b of W.bridges || []) {
    const dx = b.bx - b.ax, dz = b.bz - b.az, L = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
    const cx = (b.ax + b.bx) / 2, cz = (b.az + b.bz) / 2;
    const put = (g, list, ox = 0, oy = 0, oz = 0) => { g.translate(ox, oy, oz); g.rotateY(yaw); g.translate(cx, b.y, cz); list.push(g); };
    put(new THREE.BoxGeometry(b.w, 0.9, L + 2), deck, 0, -0.42, 0);
    for (const sx of [-1, 1]) {
      put(new THREE.BoxGeometry(0.35, 0.95, L + 2), rail, sx * (b.w / 2 - 0.18), 0.48, 0);
      put(new THREE.BoxGeometry(0.5, 0.18, L + 2), rail, sx * (b.w / 2 - 0.18), 1.0, 0);
    }
    const nP = Math.max(1, Math.floor(L / 14));
    for (let k = 1; k <= nP; k++) put(new THREE.BoxGeometry(b.w * 0.7, b.y + 4, 1.6), deck, 0, -(b.y + 4) / 2 - 0.8, -L / 2 + L * k / (nP + 1));
  }
  const grp = new THREE.Group();
  if (deck.length) { const m = new THREE.Mesh(mergeGeometries(deck.map(strip)), csmify(new THREE.MeshStandardMaterial({ color: '#a7a39a', roughness: 0.85 }))); m.castShadow = m.receiveShadow = true; grp.add(m); }
  if (rail.length) { const m = new THREE.Mesh(mergeGeometries(rail.map(strip)), csmify(new THREE.MeshStandardMaterial({ color: '#c9c5bb', roughness: 0.7 }))); m.castShadow = m.receiveShadow = true; grp.add(m); }
  return grp;
}

// ---- 樹：樹皮貼圖的樹幹＋樹葉卡片；海邊是棕櫚 ----
function leafCards(rnd, n, rx, ry, rz, cy, size) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const g = new THREE.PlaneGeometry(size, size);
    g.rotateY(rnd() * Math.PI); g.rotateX((rnd() - 0.5) * 1.2); g.rotateZ((rnd() - 0.5) * 0.8);
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
    g.translate(Math.cos(a) * r * rx, cy + (rnd() - 0.5) * 2 * ry * Math.sqrt(1 - r * r), Math.sin(a) * r * rz);
    list.push(g);
  }
  const m = mergeGeometries(list);
  // 法線一律朝外（像一團球），光照比較柔和
  const p = m.attributes.position, nr = m.attributes.normal;
  for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3(p.getX(i), p.getY(i) - cy, p.getZ(i)).normalize(); nr.setXYZ(i, v.x, v.y * 0.7 + 0.3, v.z); }
  return m;
}
function palmFrondTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 512; const x = c.getContext('2d');
  // 羽狀葉：中肋＋兩側細長小葉，越往尖端越短
  for (let i = 0; i < 70; i++) {
    const v = i / 70, y = 506 - v * 500, len = 60 * Math.sin(Math.min(1, v * 1.15) * Math.PI * 0.92 + 0.08) * (1 - v * 0.25);
    for (const sd of [-1, 1]) {
      const g = 36 + Math.random() * 30;
      x.fillStyle = `hsl(${74 + Math.random() * 14},${38 + Math.random() * 18}%,${g}%)`;
      x.beginPath(); x.moveTo(64, y); x.quadraticCurveTo(64 + sd * len * 0.5, y - 10, 64 + sd * len, y + 16); x.quadraticCurveTo(64 + sd * len * 0.5, y - 2, 64, y + 5); x.fill();
    }
  }
  x.strokeStyle = '#8a8a4a'; x.lineWidth = 4; x.beginPath(); x.moveTo(64, 512); x.lineTo(64, 4); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function buildVegetation(W, A, csmify) {
  const grp = new THREE.Group();
  const rnd = mulberry32(9);
  const leafTex = A?.leaves;
  const barkMat = csmify(new THREE.MeshStandardMaterial(A?.tex.bark ? { map: repTex(A.tex.bark, 1.2), normalMap: repTex(A.nrm.bark, 1.2), roughness: 0.95 } : { color: '#6a5236', roughness: 0.95 }));
  const leafMat = (tint) => csmify(new THREE.MeshStandardMaterial(leafTex ? { map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.85, color: tint } : { color: tint, roughness: 0.9, flatShading: true }));
  const trunk = (h, r0, r1, bend = 0) => { const g = new THREE.CylinderGeometry(r1, r0, h, 8, 4); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) / h + 0.5; p.setX(i, p.getX(i) + bend * y * y); } g.translate(0, h / 2, 0); uvScale(g, Math.PI * 2 * r0, h); g.computeVertexNormals(); return g; };
  const crown = (n, rx, ry, cy, size) => (leafTex ? leafCards(rnd, n, rx, ry, rx, cy, size) : new THREE.IcosahedronGeometry(rx, 1).translate(0, cy, 0));
  const types = {
    olive: { trunk: mergeGeometries([trunk(2.2, 0.22, 0.14), trunk(1.6, 0.12, 0.07, 0.6).rotateZ(0.5).translate(0.1, 1.8, 0), trunk(1.4, 0.11, 0.06, -0.5).rotateZ(-0.6).translate(-0.1, 1.7, 0)]), leaves: crown(26, 2.1, 1.1, 3.0, 1.9), tint: '#b4bf8e' },
    cypress: { trunk: trunk(1.6, 0.2, 0.15), leaves: leafTex ? mergeGeometries([0, 1, 2, 3, 4, 5].map((k) => leafCards(rnd, 8, 0.95 - k * 0.12, 0.7, 0.95 - k * 0.12, 1.6 + k * 1.15, 1.4))) : new THREE.ConeGeometry(0.9, 7, 7).translate(0, 4.5, 0), tint: '#6f7f4a' },
    street: { trunk: mergeGeometries([trunk(3.2, 0.25, 0.16), trunk(2.0, 0.13, 0.07, 0.8).rotateZ(0.55).translate(0.15, 2.6, 0), trunk(1.8, 0.12, 0.06, -0.7).rotateZ(-0.5).translate(-0.12, 2.4, 0.1)]), leaves: crown(34, 2.6, 1.6, 4.4, 2.2), tint: '#a3b878' },
    bush: { trunk: null, leaves: crown(12, 1.1, 0.6, 0.7, 1.3), tint: '#9fb177' },
    pine: { trunk: trunk(9, 0.3, 0.12), leaves: leafTex ? mergeGeometries([0, 1, 2, 3, 4, 5, 6].map((k) => leafCards(rnd, 9, 2.3 - k * 0.3, 0.6, 2.3 - k * 0.3, 2.6 + k * 1.15, 1.6))) : new THREE.ConeGeometry(2.2, 9, 8).translate(0, 6.5, 0), tint: '#5d7348' },
  };
  const frondTex = palmFrondTexture();
  const palmTrunk = trunk(7, 0.24, 0.17, 1.2);
  const fronds = [];
  for (let i = 0; i < 13; i++) {
    const len = 4.6 + rnd() * 1.2, droop = 0.5 + rnd() * 0.5;
    const g = new THREE.PlaneGeometry(1.9, len, 2, 10); g.translate(0, len / 2, 0);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const y = p.getY(k), u = y / len, xx = p.getX(k); p.setY(k, y * Math.cos(u * droop * 1.6)); p.setZ(k, -y * Math.sin(u * droop * 1.6) * 0.9 - Math.abs(xx) * 0.25); }
    g.rotateX(-Math.PI / 2 + 0.55 + (i % 3) * 0.12); g.rotateY((i / 13) * Math.PI * 2 + rnd() * 0.25); g.translate(1.15, 7.05, 0);
    fronds.push(g);
  }
  const palmLeaves = mergeGeometries(fronds); palmLeaves.computeVertexNormals();
  { const nr = palmLeaves.attributes.normal; for (let k = 0; k < nr.count; k++) nr.setY(k, Math.abs(nr.getY(k)) * 0.6 + 0.4); }
  const palmMat = csmify(new THREE.MeshStandardMaterial({ map: frondTex, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.75, color: '#e2ead0' }));
  const by = { olive: [], cypress: [], street: [], bush: [], pine: [], palm: [] };
  for (const t of W.trees) {
    let k = ['olive', 'cypress', 'street', 'bush', 'pine'][t[3]];
    if (k === 'olive') k = t[1] < 12 || hash2(Math.floor(t[0]), Math.floor(t[2]), 4) < 0.5 ? 'palm' : 'street';
    by[k].push(t);
  }
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  const inst = (geo, mat, list, colorize) => {
    if (!geo || !list.length) return;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((t, i) => {
      dummy.position.set(t[0], t[1] - 0.15, t[2]); dummy.rotation.set(0, hash2(Math.floor(t[0] * 3), Math.floor(t[2] * 3), 2) * 6.28, 0); dummy.scale.setScalar(t[4]); dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      if (colorize) { const v = hash2(Math.floor(t[0]), Math.floor(t[2]), 7); col.setRGB(0.85 + v * 0.3, 0.88 + v * 0.2, 0.8 + v * 0.2); im.setColorAt(i, col); }
    });
    im.castShadow = true; im.receiveShadow = true;
    grp.add(im);
  };
  for (const [k, def] of Object.entries(types)) { inst(def.trunk, barkMat, by[k], false); inst(def.leaves, leafMat(def.tint), by[k], true); }
  inst(palmTrunk, barkMat, by.palm, false); inst(palmLeaves, palmMat, by.palm, true);
  const rg = new THREE.IcosahedronGeometry(1, 1); { const p = rg.attributes.position; for (let i = 0; i < p.count; i++) { const n = 0.75 + rnd() * 0.45; p.setXYZ(i, p.getX(i) * n, p.getY(i) * n * 0.75, p.getZ(i) * n); } rg.computeVertexNormals(); }
  uvScale(rg, 2, 2);
  const rm = new THREE.InstancedMesh(rg, csmify(new THREE.MeshStandardMaterial(A?.tex.rock ? { map: A.tex.rock, normalMap: A.nrm.rock, roughness: 0.92 } : { color: '#a99d89', flatShading: true })), W.rocks.length);
  W.rocks.forEach((r, i) => { dummy.position.set(r[0], r[1] + r[3] * 0.15, r[2]); dummy.rotation.set(rnd(), rnd() * 6.28, rnd() * 0.4); dummy.scale.set(r[3], r[3] * 0.9, r[3] * 1.1); dummy.updateMatrix(); rm.setMatrixAt(i, dummy.matrix); });
  rm.castShadow = true; rm.receiveShadow = true; grp.add(rm);
  return grp;
}

// ---- 電線桿與電線：沿主要道路一側，每 38 公尺一支 ----
function buildPoles(W, csmify) {
  const grp = new THREE.Group();
  const pole = mergeGeometries([new THREE.CylinderGeometry(0.11, 0.16, 9, 8).translate(0, 4.5, 0), new THREE.BoxGeometry(1.8, 0.12, 0.12).translate(0, 8.4, 0), new THREE.BoxGeometry(1.2, 0.1, 0.1).translate(0, 7.8, 0), new THREE.CylinderGeometry(0.22, 0.22, 0.7, 10).translate(0.45, 7.2, 0.25)].map(strip));
  const spots = [], lines = [];
  for (const r of W.roads) {
    let acc = 0, prev = null;
    for (let i = 1; i < r.pts.length; i++) {
      const a = r.pts[i - 1], b = r.pts[i];
      acc += Math.hypot(b[0] - a[0], b[2] - a[2]);
      if (acc < 38) continue;
      acc = 0;
      const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1;
      const x = b[0] - dz / L * 5.2, z = b[2] + dx / L * 5.2;
      if (W.towns.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < (t.r * 0.7) ** 2)) { prev = null; continue; }
      const cur = { x, y: b[1], z, yaw: Math.atan2(dx, dz) };
      spots.push(cur);
      if (prev) for (const o of [-0.8, 0, 0.8]) {
        const ox = Math.cos(cur.yaw) * o, oz = -Math.sin(cur.yaw) * o, px = Math.cos(prev.yaw) * o, pz = -Math.sin(prev.yaw) * o;
        const A2 = [prev.x + px, prev.y + 8.45, prev.z + pz], B2 = [cur.x + ox, cur.y + 8.45, cur.z + oz];
        for (let s = 0; s < 6; s++) {
          const t0 = s / 6, t1 = (s + 1) / 6, sag = (t) => -1.1 * 4 * t * (1 - t);
          lines.push(A2[0] + (B2[0] - A2[0]) * t0, A2[1] + (B2[1] - A2[1]) * t0 + sag(t0), A2[2] + (B2[2] - A2[2]) * t0, A2[0] + (B2[0] - A2[0]) * t1, A2[1] + (B2[1] - A2[1]) * t1 + sag(t1), A2[2] + (B2[2] - A2[2]) * t1);
        }
      }
      prev = cur;
    }
  }
  const im = new THREE.InstancedMesh(pole, csmify(new THREE.MeshStandardMaterial({ color: '#8f8b83', roughness: 0.85 })), spots.length);
  const d = new THREE.Object3D();
  spots.forEach((s, i) => { d.position.set(s.x, s.y - 0.1, s.z); d.rotation.set(0, s.yaw, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
  im.castShadow = true; grp.add(im);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  grp.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#2a2724', transparent: true, opacity: 0.75 })));
  return grp;
}

function buildDeco(W, T, A, mats, csmify) {
  const grp = new THREE.Group();
  const geo = { stone: [], white: [], red: [], dark: [], metal: [], roof: [], glass: [], wheel: [], hay: [], timber: [], wood: [], gableRoof: new Map(), gableEnd: new Map() };
  const signGroup = new THREE.Group();
  const wheel = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12); wheel.rotateZ(Math.PI / 2);
  const carModels = A ? Object.values(A.cars || {}) : [];
  const carMats = new Map();
  for (const d of W.deco) {
    if (d.t === 'sign') {
      const tex = signTexture(d.text, d.c);
      const h = Math.min(d.h, d.text.length * 1.1 + 0.4);
      const side = new THREE.MeshStandardMaterial({ color: '#3a2c20' });
      const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.12 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, 0.9), [face, face, side, side, side, side]);
      m.position.set(d.x, d.y + h / 2, d.z); m.rotation.y = d.rot * Math.PI / 2;
      m.position.add(new THREE.Vector3(0, 0, 0.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), d.rot * Math.PI / 2));
      m.castShadow = true; signGroup.add(m);
    } else if (d.t === 'gable') {
      const [r, e] = gableGeo(d);
      if (d.rm) vcolor(r, d.rm);
      vcolor(e, d.c ? new THREE.Color(d.c).multiply(new THREE.Color(BASE[d.m] ?? '#ffffff')) : BASE[d.m] ?? '#ffffff');
      const rmat = d.rmat ?? MAT.roof;
      if (!geo.gableRoof.has(rmat)) geo.gableRoof.set(rmat, []);
      geo.gableRoof.get(rmat).push(r);
      const em = [MAT.siding, MAT.brick, MAT.stone, MAT.concrete, MAT.metal].includes(d.m) ? d.m : MAT.plaster;
      if (!geo.gableEnd.has(em)) geo.gableEnd.set(em, []);
      geo.gableEnd.get(em).push(e);
    }
    else if (d.t === 'cabglass') { const g = new THREE.BoxGeometry(d.x1 - d.x0 - 0.1, d.h, d.z1 - d.z0 - 0.1); g.translate((d.x0 + d.x1) / 2, d.y + d.h / 2, (d.z0 + d.z1) / 2); geo.glass.push(g); }
    else if (d.t === 'boom') { const g = new THREE.BoxGeometry(2, 2, d.len); g.translate(d.x + d.len * 0.35, d.y + 1, d.z); geo.red.push(g); }
    else if (d.t === 'lighthouse') {
      for (let k = 0; k < 3; k++) { const g = new THREE.CylinderGeometry(d.r + 0.03, d.r + 0.03, 2.2, 32, 1, true); g.translate(d.x, d.y + 5 + k * 8, d.z); geo.red.push(g); }
      const lamp = new THREE.CylinderGeometry(d.r * 0.7, d.r * 0.7, 2.6, 16); lamp.translate(d.x, d.y + d.h + 1.3, d.z); geo.glass.push(lamp);
      const cap = new THREE.ConeGeometry(d.r * 0.85, 2.2, 16); cap.translate(d.x, d.y + d.h + 3.7, d.z); geo.red.push(cap);
      const gal = new THREE.CylinderGeometry(d.r + 0.8, d.r + 0.8, 0.3, 24); gal.translate(d.x, d.y + d.h + 0.15, d.z); geo.dark.push(gal);
    } else if (d.t === 'tank' && d.silo) {
      const g = new THREE.SphereGeometry(d.r, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2); g.translate(d.x, d.y + d.h, d.z); geo.metal.push(g);
      for (let k = 1; k < 5; k++) { const r = new THREE.CylinderGeometry(d.r + 0.05, d.r + 0.05, 0.18, 24, 1, true); r.translate(d.x, d.y + k * d.h / 5, d.z); geo.metal.push(r); }
    } else if (d.t === 'tank') {
      const g = new THREE.SphereGeometry(d.r, 32, 6, 0, Math.PI * 2, 0, 0.35); g.translate(d.x, d.y + d.h - d.r * Math.cos(0.35) + 0.02, d.z); geo.white.push(g);
      if (d.ladder) { const l = new THREE.BoxGeometry(0.6, d.h, 0.15); l.translate(d.x, d.y + d.h / 2, d.z + d.r + 0.08); geo.metal.push(l); }
    } else if (d.t === 'radome') { const g = new THREE.SphereGeometry(d.r * 1.05, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2); g.translate(d.x, d.y + d.h, d.z); geo.white.push(g); }
    else if (d.t === 'mast' || d.t === 'flare' || d.t === 'chimney') { const g = new THREE.CylinderGeometry(d.r * 1.3, d.r * 1.3, 1.2, 10); g.translate(d.x, d.y + d.h - 0.6, d.z); geo.red.push(g); }
    else if (d.t === 'wheels') {
      if (carModels.length) {
        const src = carModels[Math.floor(hash2(Math.floor(d.x), Math.floor(d.z), 3) * carModels.length)];
        const car = src.clone();
        const bb = new THREE.Box3().setFromObject(car), size = bb.getSize(new THREE.Vector3());
        const longX = size.x > size.z, s = 4.3 / Math.max(size.x, size.z);
        car.scale.setScalar(s);
        car.position.set(d.x, d.y - bb.min.y * s, d.z);
        car.rotation.y = (longX ? 0 : Math.PI / 2) + (d.along ? 0 : Math.PI / 2) + (hash2(Math.floor(d.x), Math.floor(d.z), 9) < 0.5 ? Math.PI : 0);
        car.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = true; o.receiveShadow = true;
          if (!carMats.has(o.material)) {
            const nm = o.material.clone(); nm.roughness = 0.32; nm.metalness = 0.25;
            // Kenney 的色票太飽和：降一半彩度
            nm.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n float lum = dot(diffuseColor.rgb, vec3(0.3,0.59,0.11)); diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, 0.45) * 0.9;'); };
            carMats.set(o.material, csmify(nm));
          }
          o.material = carMats.get(o.material);
        });
        grp.add(car);
      } else for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const g = wheel.clone(); if (!d.along) g.rotateY(Math.PI / 2); g.translate(d.x + (d.along ? sx * 1.35 : sz * 0.92), d.y + 0.36, d.z + (d.along ? sz * 0.92 : sx * 1.35)); geo.wheel.push(g); }
    } else if (d.t === 'plane') grp.add(parkedPlane(d));
    else if (d.t === 'hsign') {
      // 橫式店招：貼在一樓門口上方
      const tex = hsignTexture(d.text, d.c), w = Math.min(d.w, 1.0 + d.text.length * 0.9);
      const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.1 });
      const side = new THREE.MeshStandardMaterial({ color: '#2a2622' });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, 0.14), [side, side, side, side, face, side]);
      m.position.set(d.x, d.y + 0.4, d.z); m.rotation.y = d.rot * Math.PI / 2; m.castShadow = true; signGroup.add(m);
    } else if (d.t === 'wtower') {
      // 紐約式屋頂木造水塔：四根鐵腳、木桶、鐵箍、圓錐頂
      for (const [lx, lz] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) { const g = new THREE.CylinderGeometry(0.08, 0.08, 2.7, 6); g.translate(d.x + lx, d.y + 1.35, d.z + lz); geo.metal.push(g); }
      const deck = new THREE.CylinderGeometry(1.45, 1.45, 0.15, 16); deck.translate(d.x, d.y + 2.72, d.z); geo.timber.push(deck);
      const barrel = new THREE.CylinderGeometry(1.2, 1.28, 3.0, 20); barrel.translate(d.x, d.y + 4.3, d.z); geo.wood.push(barrel);
      for (let k = 0; k < 4; k++) { const b = new THREE.CylinderGeometry(1.27 - k * 0.02, 1.27 - k * 0.02, 0.07, 20, 1, true); b.translate(d.x, d.y + 3.1 + k * 0.85, d.z); geo.dark.push(b); }
      const cone = new THREE.ConeGeometry(1.38, 1.0, 20); cone.translate(d.x, d.y + 6.3, d.z); geo.dark.push(cone);
    } else if (d.t === 'hay') {
      const g = new THREE.CylinderGeometry(0.75, 0.75, 1.5, 16); g.rotateZ(Math.PI / 2); g.rotateY(d.a); g.translate(d.x, d.y + 0.72, d.z); geo.hay.push(g);
    } else if (d.t === 'umbrella') {
      const pole = new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6); pole.translate(d.x, d.y + 1.15, d.z); geo.metal.push(pole);
      const c = new THREE.ConeGeometry(1.5, 0.55, 12, 1, true); c.translate(d.x, d.y + 2.35, d.z);
      (d.c % 2 ? geo.white : geo.red).push(c);
    } else if (d.t === 'wheel') {
      // 水車：兩片輪框＋十二片葉板，側面貼著磨坊
      const parts = [];
      for (const sz of [-0.9, 0.9]) { const t = new THREE.TorusGeometry(3.2, 0.12, 6, 28); t.rotateY(Math.PI / 2); t.translate(0, 0, 0); t.translate(sz, 0, 0); parts.push(t); }
      for (let k = 0; k < 12; k++) { const b = new THREE.BoxGeometry(2.0, 0.08, 0.9); b.translate(0, 3.0, 0); b.rotateX(k * Math.PI / 6); parts.push(b); const sp = new THREE.BoxGeometry(1.9, 3.1, 0.1); sp.translate(0, 1.55, 0); sp.rotateX(k * Math.PI / 6 + 0.26); parts.push(sp); }
      const axle = new THREE.CylinderGeometry(0.25, 0.25, 2.6, 10); axle.rotateZ(Math.PI / 2); parts.push(axle);
      const g = mergeGeometries(parts.map(strip)); g.translate(d.x, d.y + 3.0, d.z); geo.timber.push(g);
    }
  }
  const mk = (list, mat) => { if (!list.length) return; const m = new THREE.Mesh(mergeGeometries(list.map(strip)), mat); m.castShadow = true; m.receiveShadow = true; grp.add(m); };
  const std = (o) => csmify(new THREE.MeshStandardMaterial({ roughness: 0.8, ...o }));
  mk(geo.stone.map((g) => vcolor(strip(g), '#ffffff')), mats[MAT.stone]);
  mk(geo.white, std({ color: '#efefeb', roughness: 0.45 }));
  mk(geo.red, std({ color: '#b84a2c', roughness: 0.55 }));
  mk(geo.dark, std({ color: '#3b3129' }));
  mk(geo.metal, std({ color: '#8e918f', metalness: 0.6, roughness: 0.4 }));
  mk(geo.roof.map((g) => vcolor(strip(g), '#ffffff')), mats[MAT.roof]);
  mk(geo.wheel, std({ color: '#1e1b18', roughness: 0.9 }));
  mk(geo.hay, std({ color: '#c9a95a', roughness: 0.95 }));
  mk(geo.timber, std({ color: '#5a4430', roughness: 0.9 }));
  mk(geo.wood.map((g) => vcolor(strip(g), '#d9c3a2')), mats[MAT.wood]);
  for (const [m, list] of geo.gableRoof) mk(list, mats[m]);
  for (const [m, list] of geo.gableEnd) mk(list, mats[m]);
  if (geo.glass.length) grp.add(new THREE.Mesh(mergeGeometries(geo.glass.map(strip)), new THREE.MeshStandardMaterial({ color: '#4c6468', roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.55 })));
  grp.add(signGroup);
  if (A?.props) {
    const r = mulberry32(31);
    const put = (srcName, n, filter, s = 1) => {
      const src = A.props[srcName]; if (!src) return;
      const blds = W.buildings.filter(filter);
      for (let k = 0; k < n && blds.length; k++) {
        const b = blds[Math.floor(r() * blds.length)], dd = b.doors[0]; if (!dd) continue;
        const o = src.clone(); o.scale.setScalar(s);
        o.position.set(dd[0] + dd[3] * (1.2 + r()) + dd[2] * 0.4, b.y + 0.15, dd[1] - dd[2] * (1.2 + r()) + dd[3] * 0.4);
        o.rotation.y = r() * 6.28;
        o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
        grp.add(o);
      }
    };
    put('metal_jerrycan_green', 30, (b) => b.kind === 'warehouse' || b.kind === 'house');
    put('power_box_01', 18, (b) => b.kind === 'house' && (b.town === 'port' || b.town === 'city'), 1.4);
  }
  return grp;
}

// 依幾何把每個三角形翻成朝外（ok(法線) 為真代表方向正確），連同 uv 一起交換
function outward(g, ok) {
  const p = g.attributes.position.array, u = g.attributes.uv?.array;
  for (let i = 0; i < p.length; i += 9) {
    const ax = p[i + 3] - p[i], ay = p[i + 4] - p[i + 1], az = p[i + 5] - p[i + 2], bx = p[i + 6] - p[i], by = p[i + 7] - p[i + 1], bz = p[i + 8] - p[i + 2];
    if (ok([ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx])) continue;
    for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
    if (u) { const j = (i / 9) * 6; for (let k = 0; k < 2; k++) { const t = u[j + 2 + k]; u[j + 2 + k] = u[j + 4 + k]; u[j + 4 + k] = t; } }
  }
}
// 斜屋頂：兩坡屋面＋兩端山牆
function gableGeo(d) {
  const ax = d.ax === 'z' ? 'z' : 'x';
  const L0 = ax === 'x' ? d.x0 : d.z0, L1 = ax === 'x' ? d.x1 : d.z1, S0 = ax === 'x' ? d.z0 : d.x0, S1 = ax === 'x' ? d.z1 : d.x1;
  const mid = (S0 + S1) / 2, y = d.y, top = d.y + d.rise, half = (S1 - S0) / 2, slope = Math.hypot(half, d.rise);
  const P = (l, s, h) => (ax === 'x' ? [l, h, s] : [s, h, l]);
  const pos = [], uv = [];
  const quad = (a, b, c, e, ua) => { pos.push(...a, ...b, ...c, ...a, ...c, ...e); uv.push(...ua[0], ...ua[1], ...ua[2], ...ua[0], ...ua[2], ...ua[3]); };
  quad(P(L0, S0, y), P(L1, S0, y), P(L1, mid, top), P(L0, mid, top), [[L0, 0], [L1, 0], [L1, slope], [L0, slope]]);
  quad(P(L1, S1, y), P(L0, S1, y), P(L0, mid, top), P(L1, mid, top), [[L1, 0], [L0, 0], [L0, slope], [L1, slope]]);
  const roof = new THREE.BufferGeometry(); roof.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); roof.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  outward(roof, (n) => n[1] > 0);
  roof.computeVertexNormals();
  vcolor(roof, '#ffffff');
  const ends = [];
  const inset = 0.35;
  for (const [l, sgn] of [[L0 + inset, -1], [L1 - inset, 1]]) {
    const a = P(l, S0 + 0.45, y), b = P(l, S1 - 0.45, y), c = P(l, mid, top - 0.12);
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
    tri.setAttribute('uv', new THREE.Float32BufferAttribute(ax === 'x' ? [a[2], a[1], b[2], b[1], c[2], c[1]] : [a[0], a[1], b[0], b[1], c[0], c[1]], 2));
    const out = ax === 'x' ? [sgn, 0, 0] : [0, 0, sgn];
    outward(tri, (n) => n[0] * out[0] + n[2] * out[2] > 0);
    tri.computeVertexNormals();
    ends.push(vcolor(tri, '#f1ede4'));
  }
  return [roof, mergeGeometries(ends)];
}


function parkedPlane(d) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: '#dcd8cc', roughness: 0.4, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.2, 22, 20), m); body.rotation.z = Math.PI / 2; body.position.y = 2.6;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 28), m); wing.position.set(1, 3.6, 0);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.3), m); tail.position.set(-10, 5, 0);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 9), m); stab.position.set(-10, 3.2, 0);
  for (const o of [body, wing, tail, stab]) { o.castShadow = true; g.add(o); }
  g.position.set(d.x, d.y, d.z);
  return g;
}
