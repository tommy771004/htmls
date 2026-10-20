// 資產：解開內嵌在頁面的 GLB（gzip＋base64），依 SPEC 的節點名取用；缺檔或缺節點就退回程式佔位幾何。
// 靜態網格把材質底色烘成頂點色、合併成一個 BufferGeometry（InstancedMesh 大量擺放用），
// 契約材質（hull_paint、hat_ribbon、lamp_glow、win_glow）保留成獨立材質讓遊戲換色或點亮。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const FILES = ['boat', 'fisher', 'env', 'fish'];
export const gltf = {};
export const report = { loaded: [], missing: [], placeholders: new Set() };
export const KEEP = new Set(['hull_paint', 'hat_ribbon', 'lamp_glow', 'win_glow']);

async function decode(name) {
  const el = document.getElementById('glb-' + name);
  if (!el) return null;
  const txt = el.textContent.trim();
  if (!txt) return null;
  const bin = Uint8Array.from(atob(txt), (c) => c.charCodeAt(0));
  const ab = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return await new GLTFLoader().parseAsync(ab, '');
}

export async function loadAll() {
  const res = await Promise.allSettled(FILES.map((f) => decode(f)));
  res.forEach((r, i) => {
    const f = FILES[i];
    if (r.status === 'fulfilled' && r.value) { gltf[f] = r.value; report.loaded.push(f); tidy(r.value.scene); }
    else { report.missing.push(f); if (r.status === 'rejected') console.warn(`[269] ${f}.glb 解析失敗，改用佔位幾何`, r.reason); }
  });
}

function tidy(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m.isMeshStandardMaterial) { m.metalness = 0; m.roughness = Math.max(0.55, m.roughness); m.envMapIntensity = 0; }
    }
  });
}

export function node(file, name) {
  const g = gltf[file];
  return g ? g.scene.getObjectByName(name) || null : null;
}

// 把一個節點（含子孫）烘成單一幾何：材質色 × 頂點色寫進 color，座標以節點自身為原點（不含節點本身的位置／旋轉）。
// 契約材質的部分會分開回傳 { geo, special: { 材質名: geo } }。
export function bake(obj, { keepSpecial = true, skip = null } = {}) {
  obj.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
  const base = [], special = {};
  const skipped = (o) => { for (let q = o; q && q !== obj; q = q.parent) if (skip && skip.has(q)) return true; return false; };
  obj.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || skipped(o)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const src = o.geometry;
    const m4 = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const groups = src.groups.length ? src.groups : [{ start: 0, count: src.index ? src.index.count : src.attributes.position.count, materialIndex: 0 }];
    for (const gr of groups) {
      const mat = mats[gr.materialIndex] || mats[0];
      let g = new THREE.BufferGeometry();
      g.setAttribute('position', src.attributes.position);
      if (src.attributes.normal) g.setAttribute('normal', src.attributes.normal);
      if (src.attributes.color) g.setAttribute('color', src.attributes.color);
      if (src.index) g.setIndex(src.index);
      g = g.index ? subIndex(g, gr.start, gr.count) : g;
      g = g.toNonIndexed();
      g.applyMatrix4(m4);
      const n = g.attributes.position.count, col = new Float32Array(n * 3);
      const c = mat.color || new THREE.Color(1, 1, 1);
      const vc = g.attributes.color;
      for (let i = 0; i < n; i++) {
        let r = c.r, gg = c.g, b = c.b;
        if (vc) { r *= vc.getX(i); gg *= vc.getY(i); b *= vc.getZ(i); }
        col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      if (!g.attributes.normal) g.computeVertexNormals();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
      const key = keepSpecial && KEEP.has(mat.name) ? mat.name : null;
      if (key) (special[key] = special[key] || []).push(g); else base.push(g);
    }
  });
  const out = { geo: base.length ? mergeGeometries(base) : null, special: {} };
  for (const [k, list] of Object.entries(special)) out.special[k] = mergeGeometries(list);
  return out;
}
function subIndex(g, start, count) {
  const idx = g.index.array.slice(start, start + count);
  const out = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(g.attributes)) out.setAttribute(k, a);
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

// 靜態場景物件：烘成頂點色、一個材質（契約材質保留為獨立網格）。
// parts：要能單獨動的子節點名（buoy_flag、Oar_L、creel_lid…），各自烘成一個子網格、保留本地變換。
export const VC_MAT = () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0 });
function meshesOf(n, skip) {
  const { geo, special } = bake(n, { skip });
  const out = [];
  if (geo) { const m = new THREE.Mesh(geo, VC_MAT()); m.castShadow = true; m.receiveShadow = true; out.push(m); }
  for (const [k, sg] of Object.entries(special)) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6, metalness: 0, name: k });
    const m = new THREE.Mesh(sg, mat); m.name = k; m.userData.special = k; m.castShadow = true; out.push(m);
  }
  return out;
}
const relMatrix = (root, o) => { root.updateWorldMatrix(true, true); return new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(o.matrixWorld); };
export function staticObject(file, name, fallback, parts = []) {
  const n = node(file, name);
  if (!n) { report.placeholders.add(name); return fallback(); }
  const g = new THREE.Group(); g.name = name;
  const partNodes = parts.map((p) => n.getObjectByName(p)).filter(Boolean);
  const skip = new Set(partNodes);
  for (const m of meshesOf(n, skip)) g.add(m);
  // 有名字的空節點（noticeboard、lantern_mount、wake_L…）保留成空物件給遊戲找位置
  n.traverse((o) => {
    if (o === n || !o.name || skip.has(o) || partNodes.some((p) => p.getObjectById(o.id))) return;
    const e = new THREE.Object3D(); e.name = o.name;
    relMatrix(n, o).decompose(e.position, e.quaternion, e.scale); g.add(e);
  });
  const isIn = (o, anc) => { for (let q = o.parent; q; q = q.parent) if (q === anc) return true; return false; };
  const subs = new Map();
  for (const pn of partNodes) {
    const sub = new THREE.Group(); sub.name = pn.name;
    for (const m of meshesOf(pn, new Set(partNodes.filter((q) => q !== pn && isIn(q, pn))))) sub.add(m);
    subs.set(pn, sub);
  }
  // 巢狀的 part（creel 底下的 creel_lid）掛在最近的父 part 底下
  for (const pn of partNodes) {
    let anc = null;
    for (let q = pn.parent; q && q !== n; q = q.parent) if (subs.has(q)) { anc = q; break; }
    const sub = subs.get(pn);
    relMatrix(anc || n, pn).decompose(sub.position, sub.quaternion, sub.scale);
    (anc ? subs.get(anc) : g).add(sub);
  }
  return g;
}
// 只要幾何（InstancedMesh 用）
export function instGeo(file, name, fallback) {
  const n = node(file, name);
  if (!n) { report.placeholders.add(name); return fallback(); }
  const { geo, special } = bake(n, { keepSpecial: false });
  return geo || fallback();
}
