// 角色模型分派：英雄、第 1–5 關敵人、第 6–10 關敵人分在三個檔案。
/* global THREE */
import { HERO_BUILDERS } from './models/heroes.js';
import { FOE1 } from './models/foes1.js';
import { FOE2 } from './models/foes2.js';
import { box, sphere, group, gradientMap, outlineMat, toonify } from './kit.js';

// 回傳 THREE.Group：腳底在 y=0、面向 +Z。userData.height = 頭頂高度；userData.parts 供程序動畫使用。
export function buildUnit(key) {
  const f = HERO_BUILDERS[key] || FOE1[key] || FOE2[key];
  let g;
  try { g = f ? f() : null; } catch (e) { console.warn('model', key, e); g = null; }
  if (!g) g = group(box(0.8, 1.0, 0.6, 0xff00ff, 0, 0.5, 0), sphere(0.35, 0xffccaa, 0, 1.3, 0));
  g.userData.height = g.userData.height || 1.8;
  g.userData.parts = g.userData.parts || {};
  g.userData.key = key;
  // 第 6–10 關敵人已在 foes2 合併；英雄（逐色合併）與第 1–5 關敵人在這裡再自動合併成頂點色網格
  if (f && !FOE2[key]) { try { autoBake(g); } catch (e) { console.warn('bake', key, e); } }
  return g;
}

// ── 自動靜態合併 ─────────────────────────────────
// 先擾動契約部位並掃過 anim(t)，記下會變的物件與材質；其餘「同一骨架群組內不會單獨動」的網格
// 純色 toon 併成一個頂點色網格、其他同材質者各自合併，描邊另併成一個子網格。網址加 ?nomerge=1 可關閉。
let _vc = null;
function vcMat() { return _vc || (_vc = toonify(new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gradientMap() }))); }
function isPlain(m) {
  return m.isMeshToonMaterial && !m.map && !m.transparent && !m.vertexColors && m.side === THREE.FrontSide && (!m.emissive || m.emissive.getHex() === 0);
}
function mergeGeos(list, withColor) {
  let nv = 0, ni = 0;
  for (const m of list) { const g = m.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = withColor ? new Float32Array(nv * 3) : null;
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  let vo = 0, io = 0;
  for (const m of list) {
    m.updateMatrix(); nm.getNormalMatrix(m.matrix);
    const g = m.geometry, Pa = g.attributes.position, Na = g.attributes.normal, c = m.material.color;
    for (let i = 0; i < Pa.count; i++) {
      const k = (vo + i) * 3;
      v.fromBufferAttribute(Pa, i).applyMatrix4(m.matrix); pos[k] = v.x; pos[k + 1] = v.y; pos[k + 2] = v.z;
      v.fromBufferAttribute(Na, i).applyMatrix3(nm).normalize(); nor[k] = v.x; nor[k + 1] = v.y; nor[k + 2] = v.z;
      if (col) { col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b; }
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.getX(i) + vo;
    else for (let i = 0; i < Pa.count; i++) idx[io++] = vo + i;
    vo += Pa.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}
export function autoBake(root) {
  if (typeof location !== 'undefined' && /[?&]nomerge=1/.test(location.search)) return;
  const parts = root.userData.parts, anim = root.userData.anim;
  const keep = new Set(), dynMat = new Set();
  for (const k in parts) for (const o of [].concat(parts[k])) if (o && o.isObject3D) keep.add(o);
  const all = []; root.traverse(o => all.push(o));
  const sig = o => { const p = o.position, q = o.quaternion, s = o.scale; return [p.x, p.y, p.z, q.x, q.y, q.z, q.w, s.x, s.y, s.z, o.visible ? 1 : 0, o.material ? o.material.id : 0, o.geometry ? o.geometry.id : 0].map(n => Math.round(n * 1e4)).join(); };
  const mats = new Set(); for (const o of all) if (o.isMesh && !Array.isArray(o.material)) mats.add(o.material);
  const msig = m => [m.color && m.color.getHex(), m.emissive && m.emissive.getHex(), m.emissiveIntensity, m.opacity, m.visible, m.map && m.map.id].join();
  const base = new Map(all.map(o => [o, sig(o)])), mbase = new Map([...mats].map(m => [m, msig(m)]));
  // 契約部位（含樞紐）可能被 anim 讀取來帶動其他網格（例如後腿跟著前腿），所以掃描時一起擾動
  const pk = ['body', 'head', 'armL', 'armR', 'forearmL', 'forearmR', 'legL', 'legR', 'wingL', 'wingR', 'tail'].map(k => parts[k]).filter(o => o && o.isObject3D);
  const rest = pk.map(o => o.rotation.clone());
  if (anim) {
    for (let i = 0; i <= 140; i++) {
      const t = i * 0.113;
      pk.forEach((o, j) => { o.rotation.set(rest[j].x + Math.sin(t * 3 + j) * 0.4, rest[j].y + Math.cos(t * 2 + j) * 0.3, rest[j].z + Math.sin(t * 5 + j) * 0.3); });
      try { anim(t, 1 / 60); } catch (e) { return; }
      for (const o of all) if (!keep.has(o) && sig(o) !== base.get(o)) keep.add(o);
      for (const m of mats) if (!dynMat.has(m) && msig(m) !== mbase.get(m)) dynMat.add(m);
    }
    pk.forEach((o, j) => o.rotation.copy(rest[j]));
    try { anim(0, 0); } catch (e) { /* 略 */ }
  }
  const nodes = []; root.traverse(o => { if (!o.isMesh) nodes.push(o); });
  for (const node of nodes) {
    const B = new Map();
    for (const c of node.children) {
      if (!c.isMesh || keep.has(c) || c.name === 'outline' || c.isInstancedMesh || c.isSkinnedMesh || Array.isArray(c.material)) continue;
      const m = c.material;
      if (m.map || m.transparent || m.isShaderMaterial || !c.visible || !c.geometry.attributes.normal || c.geometry.attributes.color) continue;
      if (c.children.some(k => k.name !== 'outline')) continue;
      const ol = c.children.filter(k => k.name === 'outline');
      if (ol.some(k => keep.has(k) || !k.visible || k.position.lengthSq() || k.rotation.x || k.rotation.y || k.rotation.z || k.scale.x !== 1 || k.scale.y !== 1 || k.scale.z !== 1)) continue;
      const key = isPlain(m) && !dynMat.has(m) ? 'vc' : m.uuid;
      if (!B.has(key)) B.set(key, []);
      B.get(key).push(c);
    }
    for (const [key, list] of B) {
      if (list.length < 2) continue;
      const geo = mergeGeos(list, key === 'vc');
      const m = new THREE.Mesh(geo, key === 'vc' ? vcMat() : list[0].material);
      m.castShadow = list.some(x => x.castShadow); m.receiveShadow = list.some(x => x.receiveShadow);
      const ol = list.filter(x => x.children.length);
      if (ol.length) {
        const o = new THREE.Mesh(ol.length === list.length ? geo : mergeGeos(ol, false), outlineMat());
        o.name = 'outline'; o.raycast = () => {}; m.add(o);
      }
      for (const x of list) node.remove(x);
      node.add(m);
    }
  }
}
