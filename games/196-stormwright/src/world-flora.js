// 近景草叢與花叢：實例化小網格，圍繞攝影機重新鋪設（以格點雜湊決定，位置穩定不閃爍）。
import * as THREE from 'three';
import { hash2, vnoise, smoothstep } from './shared.js';
import { instMat, merge, tinted, TIME } from './geo.js';

const FLOWER_COLS = ['#ff6fa5', '#ffe14d', '#ffffff', '#b57bff', '#ff9a3d', '#6fc8ff', '#ff5a5a'];

function tuftGeo() {
  // 三片交叉的彎曲草葉：底暗頂亮
  const pos = [], col = [], idx = [];
  const blade = (ang, ox, oz, h, w, lean) => {
    const c = Math.cos(ang), s = Math.sin(ang), base = pos.length / 3;
    const pts = [[-w, 0, 0, 0.55], [w, 0, 0, 0.55], [-w * 0.7, h * 0.5, lean * 0.4, 0.9], [w * 0.7, h * 0.5, lean * 0.4, 0.9], [0, h, lean, 1.3]];
    for (const [x, y, z, k] of pts) { pos.push(ox + x * c + z * s, y, oz - x * s + z * c); col.push(k * 0.9, k, k * 0.85); }
    idx.push(base, base + 1, base + 3, base, base + 3, base + 2, base + 2, base + 3, base + 4);
  };
  blade(0, 0, 0, 0.5, 0.06, 0.1); blade(1.05, 0.05, 0.02, 0.4, 0.05, 0.08); blade(2.1, -0.04, 0.05, 0.58, 0.06, 0.13);
  blade(4.2, -0.05, -0.02, 0.46, 0.055, 0.1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  g.computeVertexNormals();
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); // 全部朝上：草受光均勻柔和
  return tinted(g, 1);
}
function flowerGeo() {
  const parts = [];
  const stem = new THREE.CylinderGeometry(0.012, 0.016, 0.28, 3).translate(0, 0.14, 0); tinted(stem, 0);
  const sc = new Float32Array(stem.attributes.position.count * 3); for (let i = 0; i < sc.length; i += 3) { sc[i] = 0.3; sc[i + 1] = 0.75; sc[i + 2] = 0.25; }
  stem.setAttribute('color', new THREE.BufferAttribute(sc, 3)); parts.push(stem);
  // 花瓣：五片菱形略向上翹
  for (let i = 0; i < 5; i++) {
    const g = new THREE.BufferGeometry(), a = (i / 5) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const p = [[0, 0, 0], [-0.028, 0.01, 0.05], [0.028, 0.01, 0.05], [0, 0.022, 0.1]];
    const pos = []; for (const [x, y, z] of p) pos.push(x * ca + z * sa, 0.28 + y, -x * sa + z * ca);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(12).fill(1), 3));
    g.setIndex([0, 2, 1, 1, 2, 3]); g.computeVertexNormals(); tinted(g, 1); parts.push(g);
  }
  const ctr = new THREE.OctahedronGeometry(0.03, 0).translate(0, 0.295, 0); tinted(ctr, 0);
  const cc = new Float32Array(ctr.attributes.position.count * 3); for (let i = 0; i < cc.length; i += 3) { cc[i] = 1.0; cc[i + 1] = 0.78; cc[i + 2] = 0.1; }
  ctr.setAttribute('color', new THREE.BufferAttribute(cc, 3)); parts.push(ctr);
  const leaf = new THREE.BufferGeometry(); leaf.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.05, 0, -0.06, 0.1, 0.1, 0.06, 0.1, 0.1, 0, 0.12, 0.2], 3));
  leaf.setAttribute('color', new THREE.Float32BufferAttribute(new Array(12).fill(0).map((_, i) => (i % 3 === 1 ? 0.8 : 0.3)), 3)); leaf.setIndex([0, 2, 1, 1, 2, 3]); leaf.computeVertexNormals(); tinted(leaf, 0); parts.push(leaf);
  const g = merge(parts); const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); return g;
}

export class Flora {
  constructor(ctx, terrain) {
    this.ctx = ctx; this.T = terrain; this.center = new THREE.Vector3(1e9, 0, 1e9);
    this.maxT = 9000; this.maxF = 2600;
    this.tuft = new THREE.InstancedMesh(tuftGeo(), instMat({ rough: 1, sway: 0.16 }), this.maxT);
    const fm = instMat({ rough: 0.8, sway: 0.5 }); fm.side = THREE.DoubleSide;
    this.flow = new THREE.InstancedMesh(flowerGeo(), fm, this.maxF);
    for (const m of [this.tuft, this.flow]) { m.frustumCulled = false; m.count = 0; m.castShadow = false; m.receiveShadow = false; ctx.scene.add(m); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }
    this.tuft.setColorAt(0, new THREE.Color(1, 1, 1)); this.flow.setColorAt(0, new THREE.Color(1, 1, 1));
    this._c = new THREE.Color(); this._n = new THREE.Vector3(); this._M = new THREE.Matrix4(); this._Q = new THREE.Quaternion(); this._V = new THREE.Vector3(); this._S = new THREE.Vector3(); this._E = new THREE.Euler();
    this.palette = FLOWER_COLS.map((c) => new THREE.Color(c));
    this.dirty = true;
    ctx.events?.on('quality', () => { this.center.set(1e9, 0, 1e9); });
  }
  init() { this.center.set(1e9, 0, 1e9); }
  rebuild(cx, cz) {
    const T = this.T, Q = this.ctx.render?.Q || { grass: 1, flowers: 1 };
    const gd = Q.grass, fd = Q.flowers;
    let nt = 0, nf = 0;
    const M = this._M, Qt = this._Q, V = this._V, S = this._S, E = this._E, col = this._c, nrm = this._n;
    const tc = this.tuft.instanceColor.array, fc = this.flow.instanceColor.array;
    // 草叢：格距 1.0 m，半徑 R；密度由 gd 決定（每格 1~2 簇）
    const R = 30 * Math.min(1, 0.55 + gd * 0.45), cs = 1.2 / Math.sqrt(Math.max(gd, 0.01));
    if (gd > 0) {
      const i0 = Math.floor((cx - R) / cs), i1 = Math.floor((cx + R) / cs), k0 = Math.floor((cz - R) / cs), k1 = Math.floor((cz + R) / cs);
      for (let i = i0; i <= i1 && nt < this.maxT; i++) for (let k = k0; k <= k1 && nt < this.maxT; k++) {
        const x = (i + hash2(i, k, 1)) * cs, z = (k + hash2(i, k, 2)) * cs, d = Math.hypot(x - cx, z - cz);
        if (d > R) continue;
        const h = T.heightAt(x, z); if (h < 1.9) continue;
        if (T.maskAt(x, z, 0) > 0.08 || T.maskAt(x, z, 1) > 0.08 || T.maskAt(x, z, 2) > 0.08 || T.maskAt(x, z, 3) > 0.1) continue;
        T.normalAt(x, z, nrm); if (nrm.y < 0.84) continue;
        const dens = 0.55 + 0.45 * vnoise(x * 0.07, z * 0.07, 3); if (hash2(i, k, 3) > dens) continue;
        const fade = 1 - smoothstep(R - 12, R, d), s = (0.7 + hash2(i, k, 4) * 0.8) * (0.5 + 0.5 * fade);
        E.set(0, hash2(i, k, 5) * 6.28, 0); Qt.setFromEuler(E); V.set(x, h - 0.02, z); S.set(s, s * (0.8 + hash2(i, k, 6) * 0.6), s);
        M.compose(V, Qt, S); this.tuft.setMatrixAt(nt, M);
        T.constructor.grassTintFn(x, z, h, col); const j = 0.88 + hash2(i, k, 7) * 0.3; tc[nt * 3] = col.r * j; tc[nt * 3 + 1] = col.g * j; tc[nt * 3 + 2] = col.b * j;
        nt++;
      }
    }
    // 花：以 ~9 m 的花叢區塊為單位，區塊內各自一種主色，花叢內密集、區塊外零星
    if (fd > 0) {
      const R2 = 24, cs2 = 0.62 / Math.sqrt(fd);
      const i0 = Math.floor((cx - R2) / cs2), i1 = Math.floor((cx + R2) / cs2), k0 = Math.floor((cz - R2) / cs2), k1 = Math.floor((cz + R2) / cs2);
      for (let i = i0; i <= i1 && nf < this.maxF; i++) for (let k = k0; k <= k1 && nf < this.maxF; k++) {
        const x = (i + hash2(i, k, 11)) * cs2, z = (k + hash2(i, k, 12)) * cs2, d = Math.hypot(x - cx, z - cz);
        if (d > R2) continue;
        const pn = vnoise(x * 0.06 + 11, z * 0.06 - 4, 9), patch = smoothstep(0.62, 0.72, pn);
        if (hash2(i, k, 13) > patch * 0.9 + 0.012) continue;
        const h = T.heightAt(x, z); if (h < 2.0) continue;
        if (T.maskAt(x, z, 0) > 0.08 || T.maskAt(x, z, 1) > 0.08 || T.maskAt(x, z, 2) > 0.08 || T.maskAt(x, z, 3) > 0.1) continue;
        T.normalAt(x, z, nrm); if (nrm.y < 0.88) continue;
        const bx = Math.floor((x * 0.06 + 11) * 2.2), bz = Math.floor((z * 0.06 - 4) * 2.2);
        const ci = hash2(bx, bz, 21) < 0.8 ? Math.floor(hash2(bx, bz, 22) * this.palette.length) : Math.floor(hash2(i, k, 23) * this.palette.length);
        const fade = 1 - smoothstep(R2 - 10, R2, d), s = (0.7 + hash2(i, k, 14) * 0.5) * (0.4 + 0.6 * fade);
        E.set(0, hash2(i, k, 15) * 6.28, 0); Qt.setFromEuler(E); V.set(x, h - 0.02, z); S.set(s, s, s);
        M.compose(V, Qt, S); this.flow.setMatrixAt(nf, M);
        const pc = this.palette[ci]; fc[nf * 3] = pc.r; fc[nf * 3 + 1] = pc.g; fc[nf * 3 + 2] = pc.b;
        nf++;
      }
    }
    this.tuft.count = nt; this.flow.count = nf;
    this.tuft.instanceMatrix.needsUpdate = true; this.flow.instanceMatrix.needsUpdate = true;
    this.tuft.instanceColor.needsUpdate = true; this.flow.instanceColor.needsUpdate = true;
    this.center.set(cx, 0, cz);
  }
  update() {
    const c = this.ctx, cam = c.camera.position, T = this.T;
    const gh = Math.max(T.heightAt(cam.x, cam.z), 0), high = cam.y - gh > 40, on = !high && (c.render?.Q?.grass > 0);
    this.tuft.visible = this.flow.visible = on;
    if (!on) return;
    if (Math.hypot(cam.x - this.center.x, cam.z - this.center.z) > 3.5) this.rebuild(cam.x, cam.z);
  }
}
