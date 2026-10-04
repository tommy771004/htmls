// 渲染器、光、陰影、後製、鏡頭跟隨與震動。
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9fc7c9');
  scene.fog = new THREE.Fog('#9fc7c9', 70, 170);

  const hemi = new THREE.HemisphereLight('#ffeedd', '#3e5a33', 0.95); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe7c4', 2.3);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -46; sc.right = 46; sc.top = 46; sc.bottom = -46; sc.near = 1; sc.far = 160;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const SUN_OFF = new THREE.Vector3(38, 62, -22);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 400);
  const cam = { target: new THREE.Vector3(), look: new THREE.Vector3(), zoom: 1, shake: 0, shakeT: 0, kick: new THREE.Vector3(), punch: 0, follow: true, focus: null, focusK: 0 };

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.45, 0.93);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let quality = 2; // 2 高（bloom + 陰影）、1 中（陰影）、0 低
  function setQuality(q) {
    quality = q; bloom.enabled = q >= 2; renderer.shadowMap.enabled = q >= 1;
    renderer.setPixelRatio(Math.min(devicePixelRatio, q >= 2 ? 2 : q === 1 ? 1.5 : 1));
    resize();
  }
  let W = 1, H = 1;
  function resize() {
    W = innerWidth; H = innerHeight;
    renderer.setSize(W, H, false); composer.setSize(W, H);
    camera.aspect = W / H; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  // 鏡頭：俯角約 56°，直式螢幕拉遠
  const dir = new THREE.Vector3(0, Math.sin(56 * Math.PI / 180), Math.cos(56 * Math.PI / 180));
  function updateCamera(dt, t) {
    const aspect = W / H;
    const dist = (aspect < 0.8 ? 42 : aspect < 1.2 ? 36 : 30) * cam.zoom * (1 - cam.punch * 0.18);
    cam.look.lerp(cam.target, 1 - Math.exp(-dt * 9));
    let px = cam.look.x, py = cam.look.y, pz = cam.look.z, d = dist;
    if (cam.focus) { // 必殺技特寫
      cam.focusK = Math.min(1, cam.focusK + dt * 6);
    } else cam.focusK = Math.max(0, cam.focusK - dt * 3);
    if (cam.focusK > 0 && cam.focusPos) {
      const k = cam.focusK * cam.focusK * (3 - 2 * cam.focusK);
      px += (cam.focusPos.x - px) * k; pz += (cam.focusPos.z - pz) * k; py += (1.2 - py) * k * 0.5; d *= 1 - 0.55 * k;
    }
    camera.position.set(px + dir.x * d, py + dir.y * d, pz + dir.z * d);
    if (cam.focusK > 0) camera.position.x += Math.sin(t * 0.8) * cam.focusK * 2.5;
    camera.lookAt(px, py, pz);
    // 震動：衰減的隨機位移 + 方向性推擠
    cam.shake = Math.max(0, cam.shake - dt * 2.6);
    cam.punch = Math.max(0, cam.punch - dt * 4);
    if (cam.shake > 0) {
      const s = cam.shake * cam.shake * 0.9;
      camera.position.x += (Math.sin(t * 91) + Math.sin(t * 57)) * s * 0.5;
      camera.position.y += Math.sin(t * 73) * s * 0.5;
      camera.position.z += Math.cos(t * 83) * s * 0.5;
    }
    camera.position.add(cam.kick); cam.kick.multiplyScalar(Math.exp(-dt * 14));
    sun.position.copy(cam.look).add(SUN_OFF); sun.target.position.copy(cam.look);
  }
  function shake(amount, kickDir) {
    cam.shake = Math.min(1.4, Math.max(cam.shake, amount));
    if (kickDir) cam.kick.add(kickDir.clone().multiplyScalar(amount * 0.6));
  }
  function render() { if (quality >= 2) composer.render(); else renderer.render(scene, camera); }

  // 螢幕座標 → 地面座標
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function groundAt(sx, sy, y = 0) {
    ndc.set((sx / W) * 2 - 1, -(sy / H) * 2 + 1); ray.setFromCamera(ndc, camera);
    plane.constant = -y;
    return ray.ray.intersectPlane(plane, hit) ? { x: hit.x, z: hit.z } : null;
  }
  const v = new THREE.Vector3();
  function toScreen(x, y, z) { v.set(x, y, z).project(camera); return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, behind: v.z > 1 }; }

  return { renderer, scene, camera, cam, sun, hemi, bloom, composer, resize, updateCamera, shake, render, groundAt, toScreen, setQuality, get quality() { return quality; }, get size() { return [W, H]; } };
}
