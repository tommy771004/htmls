// 鏡頭附近的草叢：以 2 公尺遮罩避開道路、鋪面、建築與海灘，隨鏡頭移動重新撒在固定的世界格上。
import * as THREE from 'three';
import { heightAt, EXT } from '../core/map.js';
import { hash2 } from '../core/rng.js';

const MASK_CELL = 2;
const MN = Math.ceil((EXT * 2) / MASK_CELL);

function buildMask(W) {
  const m = new Uint8Array(MN * MN);
  const fill = (x0, z0, x1, z1) => {
    const i0 = Math.max(0, Math.floor((x0 + EXT) / MASK_CELL)), i1 = Math.min(MN - 1, Math.floor((x1 + EXT) / MASK_CELL));
    const j0 = Math.max(0, Math.floor((z0 + EXT) / MASK_CELL)), j1 = Math.min(MN - 1, Math.floor((z1 + EXT) / MASK_CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) m[j * MN + i] = 1;
  };
  for (const b of W.buildings) fill(b.x0 - 1, b.z0 - 1, b.x1 + 1, b.z1 + 1);
  for (const p of W.pads) fill(p[0], p[1], p[2], p[3]);
  for (const d of W.deco) if (d.t === 'pan') fill(d.x0, d.z0, d.x1, d.z1);
  const B = W.B;
  for (let k = 0; k < W.BM.length; k++) if (B[k * 6 + 4] - B[k * 6 + 1] > 0.3) fill(B[k * 6], B[k * 6 + 2], B[k * 6 + 3], B[k * 6 + 5]);
  for (const rd of [...W.roads, W.runway]) {
    const P = rd.pts, hw = rd.w / 2 + 1.2;
    for (let k = 0; k < P.length - 1; k++) {
      const a = P[k], b = P[k + 1], L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.ceil(L / 1.5);
      for (let s = 0; s <= n; s++) { const t = s / n, x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t; fill(x - hw, z - hw, x + hw, z + hw); }
    }
  }
  return m;
}

function bladeTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const bx = 8 + Math.random() * 112, h = 50 + Math.random() * 74, lean = (Math.random() - 0.5) * 30;
    const g = x.createLinearGradient(0, 128, 0, 128 - h);
    const v = Math.random();
    g.addColorStop(0, `rgb(${70 + v * 30},${80 + v * 25},${40})`); g.addColorStop(1, `rgb(${190 + v * 40},${178 + v * 30},${110})`);
    x.fillStyle = g;
    x.beginPath(); x.moveTo(bx - 2.5, 128); x.quadraticCurveTo(bx + lean * 0.4, 128 - h * 0.6, bx + lean, 128 - h); x.quadraticCurveTo(bx + lean * 0.4 + 1, 128 - h * 0.55, bx + 2.5, 128); x.fill();
  }
  // 透明處是黑色，縮圖層會把黑色混進草葉；不用 mipmap 避免遠處變黑
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
  return t;
}

export function makeGrass(W, scene) {
  const mask = buildMask(W);
  const COUNT = 7000, R = 42, STEP = 1.05;
  const q1 = new THREE.PlaneGeometry(1.3, 0.75); q1.translate(0, 0.37, 0);
  const q2 = q1.clone(); q2.rotateY(Math.PI / 2);
  const q3 = q1.clone(); q3.rotateY(Math.PI / 4);
  const geo = new THREE.BufferGeometry();
  const merged = [q1, q2, q3].map((g) => g.toNonIndexed());
  const pos = [], uv = [], nor = [];
  for (const g of merged) { pos.push(...g.attributes.position.array); uv.push(...g.attributes.uv.array); for (let i = 0; i < g.attributes.position.count; i++) nor.push(0, 1, 0); }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const uniforms = { gtime: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({ map: bladeTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.gtime = uniforms.gtime;
    sh.vertexShader = 'uniform float gtime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      vec4 wp = instanceMatrix * vec4(0.,0.,0.,1.);
      float sway = sin(gtime * 1.7 + wp.x * 0.35 + wp.z * 0.21) * 0.12 * position.y;
      transformed.x += sway; transformed.z += sway * 0.6;
      #endif`);
  };
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);
  mesh.count = 0; mesh.frustumCulled = false; mesh.receiveShadow = true;
  scene.add(mesh);
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  let cx = 1e9, cz = 1e9;
  return {
    mesh,
    update(cam, time, enabled) {
      uniforms.gtime.value = time;
      mesh.visible = enabled;
      if (!enabled) return;
      if (Math.hypot(cam.position.x - cx, cam.position.z - cz) < 5) return;
      cx = cam.position.x; cz = cam.position.z;
      let n = 0;
      const i0 = Math.floor((cx - R) / STEP), i1 = Math.floor((cx + R) / STEP), j0 = Math.floor((cz - R) / STEP), j1 = Math.floor((cz + R) / STEP);
      for (let j = j0; j <= j1 && n < COUNT; j++) for (let i = i0; i <= i1 && n < COUNT; i++) {
        const r1 = hash2(i, j, 5), r2 = hash2(i, j, 9);
        if (r1 > 0.55) continue;
        const x = (i + r2) * STEP, z = (j + hash2(i, j, 13)) * STEP;
        const dx = x - cx, dz = z - cz; if (dx * dx + dz * dz > R * R) continue;
        const mi = Math.floor((x + EXT) / MASK_CELL), mj = Math.floor((z + EXT) / MASK_CELL);
        if (mi < 0 || mj < 0 || mi >= MN || mj >= MN || mask[mj * MN + mi]) continue;
        const h = heightAt(W.H, x, z);
        if (h < 2.4 || h > 95) continue;
        const s = 0.7 + r1 * 1.1;
        dummy.position.set(x, h - 0.05, z); dummy.rotation.set(0, r2 * 6.28, 0); dummy.scale.set(s, s * (0.8 + hash2(i, j, 21) * 0.6), s); dummy.updateMatrix();
        mesh.setMatrixAt(n, dummy.matrix);
        col.setRGB(0.82 + r2 * 0.3, 0.84 + r1 * 0.25, 0.7 + r2 * 0.2); mesh.setColorAt(n, col);
        n++;
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    },
  };
}
