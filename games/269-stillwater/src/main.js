// 進入點：建 WebGL 渲染器、解開內嵌的 GLB，再交給 game.js。
import * as THREE from 'three';
import { loadAll } from './view/assets.js';
import { startGame } from './game.js';

const loading = document.getElementById('loading');
async function boot() {
  const canvas = document.getElementById('gl');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    loading.textContent = '這台裝置無法啟用 WebGL，沒辦法開船。';
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  await loadAll();
  startGame(renderer);
  loading.classList.add('done');
  setTimeout(() => loading.remove(), 600);
}
boot().catch((e) => { console.error(e); loading.textContent = '載入失敗：' + (e && e.message ? e.message : e); });
