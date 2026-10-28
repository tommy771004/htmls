// 載入內嵌的 glb（gzip＋base64，見 tools/build.mjs）並把材質標籤換成執行時材質：
//   paint_b<筆刷>_r<粗糙度>[_e<自發光>] → 頂點色＋世界座標的筆刷條紋（參考圖 Painted 材質的執行時版本）
//   glass → 深藍、低粗糙、吃天空環境圖；leaf／grass → 葉形／草葉形的 alphaMap（陰影也跟著挖洞）
// 每個資產整理成 parts：[{ geometry, material, matrix }]，給 InstancedMesh 用。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { NOISE } from './glsl.js';

async function bytes(id) {
  const el = document.getElementById('glb-' + id);
  if (!el) throw new Error('缺少模型 ' + id);
  const bin = Uint8Array.from(atob(el.textContent.trim()), (c) => c.charCodeAt(0));
  const ds = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(ds).arrayBuffer();
}

const mats = {};
let envMap = null;
export function setEnv(t) { envMap = t; for (const m of Object.values(mats)) if (m.isMeshStandardMaterial && m.userData.env) { m.envMap = t; m.needsUpdate = true; } }

function maskTex(kind) {
  const w = 64, h = 128, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x + 0.5) / w, v = 1 - (y + 0.5) / h;
    const inside = kind === 'leaf' ? Math.abs(u - 0.5) * 2 < 0.85 * Math.pow(Math.sin(Math.PI * v), 0.9) : Math.abs(u - 0.5) * 2 < 1 - v;
    const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = inside ? 255 : 0; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.flipY = true; t.colorSpace = THREE.NoColorSpace;
  return t;
}

/** 手繪感：世界座標的拉長雜訊調亮度（Blender：Object 座標 ×(1,1,6)，雜訊尺度 2.4，映射 0.3–0.7） */
export function painted(m, brush, emit = 0) {
  m.userData.brush = brush;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uBrush = { value: brush }; sh.uniforms.uEmit = { value: emit };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wpP = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
        wpP = instanceMatrix * wpP;
        #endif
        vWP = (modelMatrix * wpP).xyz;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nuniform float uBrush, uEmit;\n' + NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float bn = smoothstep(0.3, 0.7, fbm(vec3(vWP.x, vWP.y * 6.0, vWP.z) * 2.4, 5, 0.62));
        diffuseColor.rgb *= 1.0 + (bn - 0.5) * uBrush * 1.4;`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance += vColor.rgb * uEmit;\n#endif');
  };
  m.customProgramCacheKey = () => 'painted';
  return m;
}

export function material(tag) {
  if (mats[tag]) return mats[tag];
  let m;
  if (tag.startsWith('paint')) {
    const b = parseFloat(tag.split('_b')[1]), r = parseFloat(tag.split('_r')[1]), e = tag.includes('_e') ? parseFloat(tag.split('_e')[1]) : 0;
    m = painted(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: r, metalness: 0 }), b, e * 0.15);
  } else if (tag === 'glass') {
    m = new THREE.MeshStandardMaterial({ color: '#33506d', roughness: 0.12, metalness: 0.15, envMap, envMapIntensity: 1.4 });
    m.userData.env = true;
  } else if (tag === 'leaf' || tag === 'grass') {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, alphaMap: maskTex(tag), alphaTest: 0.5, side: THREE.DoubleSide });
    // 葉片的透光：一點點自發光（同色），背光面不會死黑
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * 0.16;'); };
    m.customProgramCacheKey = () => 'foliage';
  } else {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  }
  m.name = tag;
  mats[tag] = m;
  return m;
}

/** 讀一組 glb → { 資產名: { parts, box } } */
export async function loadGroup(id) {
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await new Promise(async (res, rej) => loader.parse(await bytes(id), '', res, rej));
  const scene = gltf.scene; scene.updateMatrixWorld(true);
  const out = {};
  for (const node of scene.children) {
    const parts = [];
    node.traverse((o) => {
      if (!o.isMesh) return;
      const tag = (o.material && o.material.name) || 'paint_b0.10_r0.80';
      if (tag === 'grass') {               // 草葉的法線一律朝上（參考圖的草也是這樣打光）
        const n = o.geometry.attributes.normal;
        if (n) { const a = new Float32Array(n.count * 3); for (let i = 0; i < n.count; i++) a[i * 3 + 1] = 1; o.geometry.setAttribute('normal', new THREE.BufferAttribute(a, 3)); }
      }
      parts.push({ geometry: o.geometry, material: material(tag), matrix: o.matrixWorld.clone(), tag });
    });
    const box = new THREE.Box3();
    for (const p of parts) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox.clone().applyMatrix4(p.matrix)); }
    out[node.name] = { parts, box, extras: node.userData };
  }
  return out;
}

export async function loadAll() {
  const [houses, lod, nature, props, rider] = await Promise.all(['houses', 'housesLod', 'nature', 'props', 'rider'].map(loadGroup));
  // 遠景版房子（屋瓦一排一條）：名稱加 lod: 前綴，world.js 在騎士前方 70 m 外換用
  const far = Object.fromEntries(Object.entries(lod).map(([k, v]) => ['lod:' + k, v]));
  return { ...houses, ...far, ...nature, ...props, ...rider };
}
