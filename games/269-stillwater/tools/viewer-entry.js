// tools/view.mjs 用的檢視頁：用遊戲同版本的 three 與 GLTFLoader 讀 GLB，依多個動畫時間點分格畫出。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

const W = 1600, H = 900;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.setScissorTest(true);
document.body.style.margin = 0;
document.body.appendChild(renderer.domElement);

window.view = async (b64, opt) => {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const gltf = await new GLTFLoader().parseAsync(bin.buffer, '');
  const info = { nodes: [], anims: gltf.animations.map((a) => `${a.name} ${a.duration.toFixed(2)}s`) };
  gltf.scene.children.forEach((c) => info.nodes.push(c.name));
  const src = opt.node ? gltf.scene.getObjectByName(opt.node) : gltf.scene;
  if (!src) return { error: `找不到節點 ${opt.node}`, ...info };
  const times = opt.times.length ? opt.times : [0];
  const cols = Math.min(times.length, opt.cols || 4), rows = Math.ceil(times.length / cols);
  const cw = Math.floor(W / cols), ch = Math.floor(H / rows);
  for (let i = 0; i < times.length; i++) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(opt.bg || '#cfe9e4');
    scene.add(new THREE.HemisphereLight('#fff6e0', '#7fb8b0', 1.4));
    const sun = new THREE.DirectionalLight('#fff3dc', 2.2);
    sun.position.set(4, 9, 6); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.1, far: 30 });
    scene.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#efdcb6', roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = opt.groundY ?? 0; ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.GridHelper(10, 10, '#b59c76', '#d6c29c'); grid.position.y = (opt.groundY ?? 0) + 0.002; scene.add(grid);
    const obj = skClone(src);
    obj.position.set(0, 0, 0);
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(obj);
    if (opt.anim) {
      const clip = THREE.AnimationClip.findByName(gltf.animations, opt.anim);
      if (!clip) return { error: `找不到動畫 ${opt.anim}`, ...info };
      const mixer = new THREE.AnimationMixer(obj);
      mixer.clipAction(clip).play();
      mixer.setTime(times[i]);
    }
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    if (opt.target) center.fromArray(opt.target);
    const r = opt.dist || Math.max(size.x, size.y, size.z) * 1.6 + 0.5;
    const dirs = { game: [0, 1.6, 1.0], front: [0, 0.15, 1], side: [1, 0.15, 0], back: [0, 0.15, -1], top: [0, 1, 0.001], three: [0.9, 0.7, 1] };
    const d = new THREE.Vector3().fromArray(dirs[opt.view] || dirs.three).normalize();
    const cam = new THREE.PerspectiveCamera(opt.fov || 35, cw / ch, 0.05, 200);
    cam.position.copy(center).addScaledVector(d, r);
    cam.lookAt(center);
    const x = (i % cols) * cw, y = H - (Math.floor(i / cols) + 1) * ch;
    renderer.setViewport(x, y, cw, ch); renderer.setScissor(x, y, cw, ch);
    renderer.render(scene, cam);
    info.box = { min: box.min.toArray().map((v) => +v.toFixed(3)), max: box.max.toArray().map((v) => +v.toFixed(3)) };
  }
  return info;
};
window.ready = true;
