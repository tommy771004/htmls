// 渲染器、光、陰影、後製、鏡頭跟隨與震動。
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// 天空：漸層球（天頂藍、地平線暖霧），不受霧影響
function skyDome() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(320, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color('#5d9fd0') }, uMid: { value: new THREE.Color('#a9cfe0') }, uHor: { value: new THREE.Color('#e9dfc6') } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }',
    fragmentShader: `varying vec3 vD; uniform vec3 uTop, uMid, uHor;
      void main(){ float y = vD.y; vec3 c = mix(uHor, uMid, smoothstep(-.05, .22, y)); c = mix(c, uTop, smoothstep(.22, .85, y));
        float sun = pow(max(0., dot(normalize(vD), normalize(vec3(.45,.62,-.3)))), 64.); c += vec3(1., .9, .7) * sun * .35;
        gl_FragColor = vec4(c, 1.); }`,
  }));
  m.frustumCulled = false; m.renderOrder = -10;
  return m;
}

// 調色＋暗角：亮部偏暖、暗部偏冷、輕微增加飽和度，極淡的底片顆粒（在顯示色空間處理）
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAspect: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uAspect; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec4 t = texture2D(tDiffuse, vUv); vec3 c = t.rgb;
      float l = dot(c, vec3(.299, .587, .114));
      c = mix(vec3(l), c, 1.07);
      c += (1. - l) * (1. - l) * vec3(-.012, .0, .022);
      c += l * l * vec3(.03, .014, -.02);
      vec2 d = (vUv - .5) * vec2(uAspect, 1.);
      float v = smoothstep(.95, .35, length(d) / max(1., uAspect) * 1.25);
      c *= mix(.8, 1., v);
      c += (h(vUv * 811. + fract(uTime) * 37.) - .5) * .012;
      gl_FragColor = vec4(clamp(c, 0., 1.), t.a);
    }`,
};

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#cfdad0');
  scene.fog = new THREE.Fog('#d6d8c4', 80, 230);
  scene.add(skyDome());

  const hemi = new THREE.HemisphereLight('#fff1dd', '#3b5532', 0.95); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe6bf', 2.35);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera; sc.near = 20; sc.far = 140;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.06; sun.shadow.radius = 2.5;
  scene.add(sun, sun.target);
  const SUN_OFF = new THREE.Vector3(38, 62, -22);
  let shadowHalf = 0;
  function setShadowHalf(h) {
    if (Math.abs(h - shadowHalf) < 0.5) return;
    shadowHalf = h; sc.left = -h; sc.right = h; sc.top = h; sc.bottom = -h; sc.updateProjectionMatrix();
  }
  setShadowHalf(34);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.5, 700);
  const cam = { target: new THREE.Vector3(), look: new THREE.Vector3(), zoom: 1, shake: 0, shakeT: 0, kick: new THREE.Vector3(), punch: 0, follow: true, focus: null, focusK: 0 };

  // 後製：多重取樣的 HDR 目標（EffectComposer 預設不會保留畫布的 MSAA）
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.45, 0.93);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  let quality = 2; // 2 高（bloom＋調色＋4096 陰影）、1 中（陰影 2048）、0 低（無陰影）
  function setQuality(q) {
    quality = q; bloom.enabled = q >= 2; renderer.shadowMap.enabled = q >= 1;
    const ms = q >= 2 ? 4096 : 2048;
    if (sun.shadow.mapSize.x !== ms) { sun.shadow.mapSize.set(ms, ms); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    renderer.setPixelRatio(Math.min(devicePixelRatio, q >= 2 ? 2 : q === 1 ? 1.5 : 1));
    resize();
  }
  let W = 1, H = 1;
  function resize() {
    W = innerWidth; H = innerHeight;
    renderer.setSize(W, H, false); composer.setSize(W, H);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    grade.uniforms.uAspect.value = W / H;
  }
  addEventListener('resize', resize); resize();

  // 鏡頭：俯角約 56°，直式螢幕拉遠
  const dir = new THREE.Vector3(0, Math.sin(56 * Math.PI / 180), Math.cos(56 * Math.PI / 180));
  function updateCamera(dt, t) {
    const aspect = W / H;
    const dist = (aspect < 0.8 ? 38 : aspect < 1.2 ? 33 : 27.5) * cam.zoom * (1 - cam.punch * 0.18);
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
    // 陰影框跟著鏡頭：涵蓋畫面可見的地面，並對齊陰影貼圖的像素格避免移動時閃爍
    const half = (aspect < 0.8 ? 40 : aspect < 1.2 ? 36 : 33) * Math.max(1, cam.zoom);
    setShadowHalf(half);
    const texel = (half * 2) / sun.shadow.mapSize.x;
    const cx = Math.round(cam.look.x / texel) * texel, cz = Math.round((cam.look.z - 3) / texel) * texel;
    sun.position.set(cx + SUN_OFF.x, cam.look.y + SUN_OFF.y, cz + SUN_OFF.z); sun.target.position.set(cx, cam.look.y, cz);
    grade.uniforms.uTime.value = t;
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
