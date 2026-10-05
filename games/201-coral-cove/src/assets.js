// 資產：解開內嵌在頁面的 GLB（gzip＋base64），依 SPEC 的節點名取用；缺檔或缺節點就退回程式佔位幾何。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { patchUnderwater } from './underwater.js';
import { fisherPH, fishPH, seaweedPH, PROP_PH, REEF_PH } from './placeholders.js';

const FILES = ['fisher', 'props', 'reef', 'fish'];
const gltf = {};
export const report = { loaded: [], missing: [], placeholders: new Set() };

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
    if (r.status === 'fulfilled' && r.value) { gltf[f] = r.value; report.loaded.push(f); prepare(r.value); }
    else { report.missing.push(f); if (r.status === 'rejected') console.warn(`[201] ${f}.glb 解析失敗，改用佔位幾何`, r.reason); }
  });
}

function prepare(g) {
  bakeSkinned(g.scene);
  const seen = new Set();
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) {
      if (seen.has(m)) continue; seen.add(m);
      if ('flatShading' in m) { m.flatShading = true; m.needsUpdate = true; }
      if (m.isMeshStandardMaterial) { m.metalness = 0; m.roughness = Math.max(0.6, m.roughness); m.envMapIntensity = 0; }
    }
  });
}

// 蒙皮網格（漁夫、魚、海草）在 GLB 裡每個材質一個 primitive，GLTFLoader 會拆成「群組＋N 個共用骨架的 SkinnedMesh」，
// 每條魚 6～9 個 draw call（陰影 pass 再一倍）。這裡把各材質的底色烘成頂點色，合併成單一 SkinnedMesh（同一副骨架與 bindMatrix），
// 材質換成一個 MeshStandardMaterial({ vertexColors, flatShading })。不依賴材質名稱或 primitive 數量。
function bakeSkinned(root) {
  const groups = [];
  root.traverse((o) => {
    if (o.isSkinnedMesh || !o.children.length) return;
    const kids = o.children.filter((c) => c.isSkinnedMesh);
    if (kids.length < 2 || kids.length !== o.children.length) return;
    const sk = kids[0].skeleton;
    if (!kids.every((k) => k.skeleton === sk && !Array.isArray(k.material))) return;
    groups.push([o, kids]);
  });
  for (const [grp, kids] of groups) {
    const geos = [];
    let ds = false, rough = 0;
    for (const k of kids) {
      const src = k.geometry, m = k.material;
      const g = new THREE.BufferGeometry();
      for (const a of ['position', 'normal', 'skinIndex', 'skinWeight']) if (src.attributes[a]) g.setAttribute(a, src.attributes[a]);
      if (src.index) g.setIndex(src.index);
      const n = src.attributes.position.count, col = new Float32Array(n * 3);
      const c = m.color || new THREE.Color(1, 1, 1);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geos.push(g);
      if (m.side === THREE.DoubleSide) ds = true;
      rough += m.roughness ?? 0.8;
    }
    const merged = mergeGeometries(geos.map((g) => (geos.some((x) => !x.index) && g.index ? g.toNonIndexed() : g)));
    if (!merged) continue;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, metalness: 0, roughness: Math.max(0.6, rough / kids.length), side: ds ? THREE.DoubleSide : THREE.FrontSide });
    mat.name = grp.name + '_baked';
    const k0 = kids[0];
    const sm = new THREE.SkinnedMesh(merged, mat);
    sm.name = grp.name + '_mesh';
    sm.position.copy(k0.position); sm.quaternion.copy(k0.quaternion); sm.scale.copy(k0.scale);
    sm.bindMode = k0.bindMode;
    for (const k of kids) grp.remove(k);
    grp.add(sm);
    sm.bind(k0.skeleton, k0.bindMatrix);
    for (const k of kids) { k.geometry.dispose(); }
  }
}

export function shadowify(obj, cast = true, receive = true) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = cast; o.receiveShadow = receive;
    if (o.isSkinnedMesh) o.frustumCulled = false;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    ms.forEach(patchUnderwater);
  });
  return obj;
}

// 靜態節點：回傳一個新的副本（共用幾何與材質），原點與旋轉歸零
const staticCache = new Map();
export function getStatic(file, name) {
  let tpl = staticCache.get(name);
  if (!tpl) {
    const src = gltf[file] && gltf[file].scene.getObjectByName(name);
    if (src) { tpl = src; tpl.userData.fromGLB = true; }
    else {
      const ph = PROP_PH[name] || REEF_PH[name];
      tpl = ph ? ph() : new THREE.Object3D();
      report.placeholders.add(`${file}:${name}`);
    }
    staticCache.set(name, tpl);
  }
  const o = tpl.clone(true);
  o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.quaternion.identity();
  o.userData.fromGLB = !!tpl.userData.fromGLB;
  return o;
}

// 蒙皮資產：骨架 <id>_rig 與蒙皮網格 <id> 可能是兄弟根節點，先收進同一個群組當範本再 SkeletonUtils.clone
const rigCache = new Map();
function rigTemplate(file, id, rigName, ph) {
  if (rigCache.has(rigName)) return rigCache.get(rigName);
  let tpl = null;
  const g = gltf[file];
  const rig = g && g.scene.getObjectByName(rigName);
  if (rig) {
    const grp = new THREE.Group();
    grp.name = rigName + '_tpl';
    const mesh = g.scene.getObjectByName(id);
    const clips = g.animations;
    rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); rig.quaternion.identity();
    grp.add(rig);
    if (mesh && !isDescendant(mesh, rig)) grp.add(mesh);
    // 有些匯出把附件（例如斗笠）放在其他根節點；與網格同名前綴的一起帶上
    tpl = { group: grp, clips, fromGLB: true, hasMesh: !!mesh };
    if (!mesh) report.placeholders.add(`${file}:${id}（找不到網格）`);
  }
  if (!tpl) {
    const p = ph();
    const grp = new THREE.Group(); grp.name = rigName + '_tpl'; grp.add(p.scene);
    tpl = { group: grp, clips: p.clips, fromGLB: false };
    report.placeholders.add(`${file}:${rigName}`);
  }
  rigCache.set(rigName, tpl);
  return tpl;
}
function isDescendant(o, root) { for (let p = o.parent; p; p = p.parent) if (p === root) return true; return false; }

export function getRigged(file, id, rigName = id + '_rig', ph) {
  const tpl = rigTemplate(file, id, rigName, ph);
  const obj = skClone(tpl.group);
  obj.name = rigName + '_inst';
  return { obj, clips: tpl.clips, fromGLB: tpl.fromGLB };
}
export const getFisher = () => getRigged('fisher', 'fisher', 'fisher_rig', fisherPH);
export const getFish = (id) => getRigged('fish', id, id + '_rig', () => fishPH(id));
export const getSeaweed = () => getRigged('reef', 'seaweed', 'seaweed_rig', seaweedPH);

export function findClip(clips, name) {
  if (!clips) return null;
  return clips.find((c) => c.name === name) || clips.find((c) => c.name.endsWith('|' + name)) || null;
}
export const has = (file) => !!gltf[file];
