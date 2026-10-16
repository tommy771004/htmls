// 資產載入與實例化：解壓內嵌在 HTML 的 gzip+base64 GLB（vehicles、characters、street_props、interior_props），
// 並將蒙皮人物的多材質 primitive 合併為單一支援霓虹自發光的 SkinnedMesh，確保穩定 60fps。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const FILES = ['vehicles', 'characters', 'street_props', 'interior_props'];
const gltf = {};
export const report = { loaded: [], missing: [], placeholders: [] };

async function decodeGLB(name) {
  const el = document.getElementById('glb-' + name);
  if (!el) return null;
  const txt = el.textContent.trim();
  if (!txt) return null;
  const bin = Uint8Array.from(atob(txt), (c) => c.charCodeAt(0));
  const ab = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return await new GLTFLoader().parseAsync(ab, '');
}

export async function loadAllAssets() {
  const results = await Promise.allSettled(FILES.map((f) => decodeGLB(f)));
  results.forEach((r, i) => {
    const f = FILES[i];
    if (r.status === 'fulfilled' && r.value) {
      gltf[f] = r.value;
      report.loaded.push(f);
      prepareScene(r.value);
    } else {
      report.missing.push(f);
    }
  });
}

function prepareScene(g) {
  bakeSkinnedGlow(g.scene);
  bakeStaticMultiMaterial(g.scene);
  const seen = new Set();
  g.scene.traverse((o) => {
    if (!o.isMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) {
      if (seen.has(m)) continue;
      seen.add(m);
      if (m.isMeshStandardMaterial) {
        if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.05) {
          m.emissiveIntensity = Math.max(2.2, m.emissiveIntensity || 2.0);
        }
        m.needsUpdate = true;
      }
    }
  });
}

// 把人物蒙皮網格的多材質子網格烘入頂點色（自發光材質寫入 >1.0 的 HDR 頂點色），合併為單一 SkinnedMesh
function bakeSkinnedGlow(root) {
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
    for (const k of kids) {
      const src = k.geometry;
      const m = k.material;
      const g = new THREE.BufferGeometry();
      for (const a of ['position', 'normal', 'skinIndex', 'skinWeight']) {
        if (src.attributes[a]) g.setAttribute(a, src.attributes[a]);
      }
      if (src.index) g.setIndex(src.index);
      const n = src.attributes.position.count;
      const col = new Float32Array(n * 3);
      const baseC = m.color || new THREE.Color(0.2, 0.25, 0.35);
      const emC = m.emissive || new THREE.Color(0, 0, 0);
      const isGlow = (emC.r + emC.g + emC.b) > 0.08;
      const cr = isGlow ? 1.0 + emC.r * 1.8 : baseC.r;
      const cg = isGlow ? 1.0 + emC.g * 1.8 : baseC.g;
      const cb = isGlow ? 1.0 + emC.b * 1.8 : baseC.b;
      for (let i = 0; i < n; i++) {
        col[i * 3] = cr;
        col[i * 3 + 1] = cg;
        col[i * 3 + 2] = cb;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geos.push(g);
    }
    const merged = mergeGeometries(geos.map((g) => (geos.some((x) => !x.index) && g.index ? g.toNonIndexed() : g)));
    if (!merged) continue;
    const mat = createSkinnedGlowMaterial();
    const k0 = kids[0];
    const sm = new THREE.SkinnedMesh(merged, mat);
    sm.name = grp.name + '_mesh';
    sm.position.copy(k0.position);
    sm.quaternion.copy(k0.quaternion);
    sm.scale.copy(k0.scale);
    sm.bindMode = k0.bindMode;
    for (const k of kids) grp.remove(k);
    grp.add(sm);
    sm.bind(k0.skeleton, k0.bindMatrix);
    for (const k of kids) k.geometry.dispose();
  }
}

const sharedStaticGlowMat = createSkinnedGlowMaterial();

// 將靜態模型（車輛、路燈、霓虹招牌、夜店與酒吧道具）的多材質 primitive 烘入 HDR 頂點色並合併為單一 Mesh，大幅降低 Draw Calls
function bakeStaticMultiMaterial(root) {
  const groups = [];
  root.traverse((o) => {
    if (o.isMesh || !o.children || o.children.length < 2) return;
    const meshKids = o.children.filter(
      (c) => c.isMesh && !c.isSkinnedMesh && c.children.length === 0 && !Array.isArray(c.material)
    );
    if (meshKids.length >= 2) {
      groups.push([o, meshKids]);
    }
  });

  for (const [grp, kids] of groups) {
    const geos = [];
    for (const k of kids) {
      const src = k.geometry;
      const m = k.material;
      const g = new THREE.BufferGeometry();
      for (const a of ['position', 'normal']) {
        if (src.attributes[a]) g.setAttribute(a, src.attributes[a].clone());
      }
      if (src.index) g.setIndex(src.index.clone());
      g.applyMatrix4(k.matrix);
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      const baseC = m.color || new THREE.Color(0.2, 0.25, 0.35);
      const emC = m.emissive || new THREE.Color(0, 0, 0);
      const isGlow = emC.r + emC.g + emC.b > 0.08;
      const cr = isGlow ? 1.0 + emC.r * 1.9 : baseC.r;
      const cg = isGlow ? 1.0 + emC.g * 1.9 : baseC.g;
      const cb = isGlow ? 1.0 + emC.b * 1.9 : baseC.b;
      for (let i = 0; i < n; i++) {
        col[i * 3] = cr;
        col[i * 3 + 1] = cg;
        col[i * 3 + 2] = cb;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geos.push(g);
    }
    const merged = mergeGeometries(
      geos.map((g) => (geos.some((x) => !x.index) && g.index ? g.toNonIndexed() : g))
    );
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, sharedStaticGlowMat);
    mesh.name = grp.name + '_merged';
    for (const k of kids) grp.remove(k);
    grp.add(mesh);
    for (const k of kids) k.geometry.dispose();
  }
}

export function createSkinnedGlowMaterial(tintColor = null) {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.42,
    metalness: 0.28,
  });
  if (tintColor) mat.color.set(tintColor);
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      vec3 glowExcess = max(vColor.rgb - vec3(1.0), vec3(0.0));
      totalEmissiveRadiance += glowExcess * 2.6;
      diffuseColor.rgb = min(vColor.rgb, vec3(1.0));`
    );
  };
  return mat;
}

const staticCache = new Map();
export function getStaticAsset(file, name) {
  const key = `${file}:${name}`;
  let tpl = staticCache.get(key);
  if (!tpl) {
    const src = gltf[file] && gltf[file].scene.getObjectByName(name);
    if (src) {
      tpl = src;
      tpl.userData.fromGLB = true;
    } else {
      tpl = new THREE.Group();
      report.placeholders.push(key);
    }
    staticCache.set(key, tpl);
  }
  const clone = tpl.clone(true);
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  clone.quaternion.identity();
  clone.userData.fromGLB = !!tpl.userData.fromGLB;
  return clone;
}

let humanTemplate = null;
export function getCharacterInstance(accentTint = null) {
  if (!humanTemplate) {
    const g = gltf.characters;
    const rig = g && g.scene.getObjectByName('human_rig');
    const mesh = g && g.scene.getObjectByName('human');
    if (rig) {
      const grp = new THREE.Group();
      grp.name = 'human_tpl';
      rig.position.set(0, 0, 0);
      rig.rotation.set(0, 0, 0);
      grp.add(rig);
      if (mesh && mesh.parent !== rig) grp.add(mesh);
      humanTemplate = { group: grp, clips: g.animations || [], fromGLB: true };
    } else {
      const grp = new THREE.Group();
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 1.75, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x00f0ff })
      );
      box.position.y = 0.88;
      grp.add(box);
      humanTemplate = { group: grp, clips: [], fromGLB: false };
      report.placeholders.push('characters:human_rig');
    }
  }
  const obj = skClone(humanTemplate.group);
  obj.traverse((o) => {
    if (o.isSkinnedMesh) {
      o.frustumCulled = false;
      if (accentTint) {
        o.material = createSkinnedGlowMaterial(accentTint);
      }
    }
  });
  return { obj, clips: humanTemplate.clips, fromGLB: humanTemplate.fromGLB };
}

export function findClip(clips, name) {
  if (!clips) return null;
  return clips.find((c) => c.name === name) || clips.find((c) => c.name.endsWith('|' + name)) || null;
}

const PALETTE_HEX = ['#00f2ff', '#ff2bd6', '#ffaa00', '#00ff88', '#a855f7', '#38bdf8'];

export function spawnCharacter({ paletteIndex = 0, clip = 'idle', timeScale = 1.0 } = {}) {
  const tint = PALETTE_HEX[paletteIndex % PALETTE_HEX.length];
  const { obj, clips, fromGLB } = getCharacterInstance(tint);
  const mixer = new THREE.AnimationMixer(obj);
  const actions = {};
  for (const c of clips) {
    const shortName = c.name.includes('|') ? c.name.split('|').pop() : c.name;
    actions[shortName] = mixer.clipAction(c);
  }
  let currentAction = null;
  let currentClipName = '';

  function play(name, fade = 0.18) {
    if (currentClipName === name && currentAction) return;
    const next = actions[name] || actions.idle || Object.values(actions)[0];
    if (!next) return;
    next.reset();
    next.timeScale = timeScale;
    next.play();
    if (currentAction && currentAction !== next) {
      currentAction.crossFadeTo(next, fade, false);
    }
    currentAction = next;
    currentClipName = name;
  }

  play(clip, 0.01);
  return { root: obj, mixer, actions, play, fromGLB };
}

export async function loadAssets() {
  await loadAllAssets();
  return {
    cloneModel: getStaticAsset,
    getStaticAsset,
    getCharacterInstance,
    spawnCharacter,
    findClip,
    report,
  };
}

