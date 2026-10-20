// 魚的側面肖像（吊牌、魚簍清單、圖鑑卡片用）：另開一個小 WebGL 畫布，正交鏡頭從側面拍一張，存成 dataURL 快取。
// 頭朝左（傳統圖鑑的擺法），不做水下染色、不擺尾。
import * as THREE from 'three';
import { fishMesh } from './fishview.js';

const W = 240, H = 104;
const cache = new Map();
let r = null, scene, cam, mesh = null;

function init() {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(W, H, false); r.setClearColor(0x000000, 0);
  r.toneMapping = THREE.NeutralToneMapping;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xf3ead6, 0x4a5546, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 4, 1.5); scene.add(key);
  const a = W / H, h = 0.5;
  cam = new THREE.OrthographicCamera(-h * a, h * a, h, -h, 0.1, 10);
  cam.position.set(3, 0.25, 0); cam.lookAt(0, 0, 0);
}

export function portrait(id) {
  if (cache.has(id)) return cache.get(id);
  let url = '';
  try {
    if (!r) init();
    if (mesh) { scene.remove(mesh); mesh = null; }
    mesh = fishMesh(id, { underwater: false });
    mesh.material.userData.uSwim.value.set(0, 0, 0, 0);
    mesh.scale.setScalar(1.75);
    mesh.rotation.set(0, 0, -0.06);
    scene.add(mesh);
    r.render(scene, cam);
    url = r.domElement.toDataURL('image/png');
  } catch (e) { console.warn('[269] 魚肖像繪製失敗', e); }
  cache.set(id, url);
  return url;
}
