// 舞台：renderer、天空、光、追尾鏡頭、後製（GTAO → Bloom → 調色 → Output）。數值對照 ART.md。
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CAMERAS, CAMERA } from '../core/config.js';
import { BNOISE } from './glsl.js';

// 三個時段（天空色同 blender/kit_sky.py 的 TIMES；太陽、霧、曝光、泛光、調色同 blender/refs.py 的 day／dusk／night）
const mixHex = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
export const LOOKS = {
  morning: { top: '#1a63db', hor: '#6fb2f2', lit: '#fffaf0', shade: '#8ea7cf', haze: '#9fc9f2', cover: 0.55, glow: [0.45, 0.15], glowC: [0.42, 0.72, 1.05],
    sun: '#ffe6bd', sunI: 3.2, sunDir: [0.48, 0.62, 0.62], hemi: [mixHex('#a9c3e6', '#c9c4ba', 0.5), '#6f7d52', 1.25], exposure: 0.93, bloom: 0.28, fog: [45, 260],
    gain: [1.04, 1.0, 0.95], lift: [-0.004, -0.004, 0.006], lights: 0 },
  dusk: { top: '#3c5aa0', hor: '#ffb877', lit: '#ffd6a8', shade: '#8a6f9c', haze: '#f0b88a', cover: 0.55, glow: [0.35, 0.15], glowC: [1.0, 0.62, 0.42],
    sun: '#ffa463', sunI: 2.7, sunDir: [0.73, 0.2, 0.66], hemi: [mixHex('#7c80b4', '#b9a49a', 0.5), '#5b4c44', 0.95], exposure: 0.93, bloom: 0.5, fog: [40, 230],
    gain: [1.04, 1.0, 0.96], lift: [0.0, 0.0, 0.004], lights: 0.6 },
  night: { top: '#0b1430', hor: '#26355c', lit: '#3a4b78', shade: '#141d3a', haze: '#27365e', cover: 0.7, glow: [0.2, 0.1], glowC: [0.08, 0.12, 0.25],
    sun: '#a6b8ff', sunI: 0.75, sunDir: [0.26, 0.64, -0.72], hemi: ['#323d63', '#1b1e26', 0.85], exposure: 1.0, bloom: 0.8, fog: [30, 200],
    gain: [1.0, 1.0, 1.03], lift: [0.0, 0.0, 0.01], lights: 1 },
};

/** 畫質：high（桌機）／low（手機：像素比 1.25、不做 GTAO、陰影 1024、霧較近；world.js 另外縮短視窗、不擺花圃草叢） */
export function makeStage(canvas, quality = 'high') {
  const low = quality === 'low';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.25 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;             // r186 沒有 PCFSoftShadowMap
  renderer.toneMapping = THREE.NeutralToneMapping;          // 和參考圖的 Khronos PBR Neutral 同一條曲線
  renderer.toneMappingExposure = 0.93;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#9fc9f2', 45, 260);
  const sky = skyDome(); scene.add(sky);

  // 光：太陽從右後方、仰角 38°；環境光一半天色、一半暖灰（影子不偏藍）
  const hemi = new THREE.HemisphereLight(new THREE.Color('#a9c3e6').lerp(new THREE.Color('#c9c4ba'), 0.5), '#6f7d52', 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe6bd', 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(low ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 140 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const sunDir = new THREE.Vector3(0.48, 0.62, 0.62).normalize();

  const camera = new THREE.PerspectiveCamera(56, 1, 0.2, 700);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 1, 1);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.85;
  gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.5, scale: 1.0, samples: 12 });
  composer.addPass(gtao);
  gtao.enabled = !low;
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.5, 0.92);
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  const cam = { preset: 'near', pos: new THREE.Vector3(), look: new THREE.Vector3(), yaw: 0, init: false };

  function resize(w, h) {
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    fitFov();
  }
  // 直式螢幕：保住最小水平視角，兩側房子才不會掉出畫面
  // 直式螢幕：保住的水平視角較小，鏡頭位置加上 CAMERA.portrait 的差量
  function preset() {
    const P = CAMERAS[cam.preset];
    if (camera.aspect >= 0.8) return P;
    const d = CAMERA.portrait, o = { ...P };
    for (const k of ['height', 'back', 'lookH', 'ahead']) o[k] += d[k];
    return o;
  }
  function fitFov() {
    const P = CAMERAS[cam.preset];
    const hf = camera.aspect >= 0.8 ? CAMERA.minHFov : CAMERA.portrait.minHFov;
    const minV = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(hf) / 2) / camera.aspect);
    camera.fov = Math.max(P.fov, THREE.MathUtils.radToDeg(minV));
    camera.updateProjectionMatrix();
  }
  function follow(bike, dt) {
    const P = preset();
    const k = cam.init ? 1 - Math.exp(-CAMERA.lag * dt) : 1;
    cam.yaw += (bike.yaw * CAMERA.yawFollow - cam.yaw) * (cam.init ? 1 - Math.exp(-CAMERA.yawLag * dt) : 1);
    const fx = Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
    const want = new THREE.Vector3(bike.x - fx * P.back, P.height + (bike.y || 0) * 0.5, bike.z - fz * P.back);   // 跳起來鏡頭跟一半
    const look = new THREE.Vector3(bike.x + fx * P.ahead, P.lookH, bike.z + fz * P.ahead);
    cam.pos.lerp(want, k); cam.look.lerp(look, k);
    if (!cam.init) { cam.pos.copy(want); cam.look.copy(look); cam.init = true; }
    camera.position.copy(cam.pos); camera.lookAt(cam.look);
    // 陰影相機跟著騎士（偏前方），不然整條街只有起點有影子
    const c = new THREE.Vector3(bike.x, 0, bike.z - 14);
    sun.target.position.copy(c); sun.position.copy(c).addScaledVector(sunDir, 70);
  }
  function setPreset(name) { cam.preset = name; fitFov(); }
  // 切時段：天空、霧、太陽、環境光、曝光、泛光、調色一起換；窗玻璃反射用的環境圖也重做
  let envRT = null;
  function setTime(name) {
    const L = LOOKS[name] || LOOKS.morning;
    applySky(sky.material, L);
    scene.fog.color.set(L.haze); scene.fog.near = L.fog[0]; scene.fog.far = low ? Math.min(L.fog[1], 150) : L.fog[1];
    renderer.toneMappingExposure = L.exposure;
    bloom.strength = L.bloom;
    sun.color.set(L.sun); sun.intensity = L.sunI; sunDir.set(...L.sunDir).normalize();
    hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
    grade.uniforms.gain.value.set(...L.gain); grade.uniforms.lift.value.set(...L.lift);
    envRT?.dispose(); envRT = skyEnv(renderer, L);
    return { env: envRT.texture, look: L };
  }
  return { renderer, scene, camera, composer, gtao, bloom, grade, sun, hemi, sky, setTime, quality, low, resize, follow, setPreset, cam };
}

// 手繪積雲天空：雲投影在一片高空平面上（u = 方向.xz / (仰角 + 0.07)），第二次取樣往太陽反方向偏移做亮暗面（同 blender/kit_sky.py）
function applySky(m, L) {
  const u = m.uniforms;
  u.top.value.set(L.top); u.hor.value.set(L.hor); u.haze.value.set(L.haze); u.lit.value.set(L.lit); u.shade.value.set(L.shade);
  u.cover.value = L.cover; u.glow.value.set(...L.glow); u.glowC.value.setRGB(...L.glowC);
}
function skyDome(L = LOOKS.morning) {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, haze: { value: new THREE.Color() }, lit: { value: new THREE.Color() }, shade: { value: new THREE.Color() },
      cover: { value: 0.55 }, drift: { value: 0 }, seed: { value: 3.0 }, glow: { value: new THREE.Vector2() }, glowC: { value: new THREE.Color() },
    },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
    fragmentShader: `uniform vec3 top, hor, haze, lit, shade; uniform float cover, drift, seed; uniform vec2 glow; uniform vec3 glowC; varying vec3 vD;
      ${BNOISE}
      void main(){
        vec3 d = normalize(vD); float h = d.y;
        vec3 c = mix(hor, top, smoothstep(0.0, 0.24, h));
        // Blender 的 Generated＝視線方向（Z 朝上、Y＝遊戲的 −z）；種子放在第三軸，跟 u、v 一起乘 scale
        float zc = max(h, 0.02) + 0.07; vec2 uv = vec2(d.x, -d.z) / zc + vec2(drift, 0.0);
        float n1 = bnoise(vec3(uv, seed), 0.24, 7, 0.58, 0.25), n2 = bnoise(vec3(uv + vec2(-0.35, -0.25), seed), 0.24, 7, 0.58, 0.25);
        float mask = smoothstep(0.6 - cover * 0.16, 0.67 - cover * 0.16, n1) * smoothstep(0.01, 0.09, h);
        vec3 cc = mix(shade, lit, smoothstep(-0.08, 0.05, n1 - n2));
        c = mix(c, cc, mask);
        // 參考圖的 Blender Glare(Bloom) 是把整張圖大幅模糊後混回去：天頂與地平線都被拉向整片天空的平均色（偏青白），
        // 漸層因此很平。用「往平均色混 glow.x，雲多的地方再多 glow.y」近似（雲量取低頻的同一組雜訊）
        float wide = bnoise(vec3(uv, seed), 0.24, 1, 0.5, 0.0);
        c = mix(c, glowC, (glow.x + glow.y * smoothstep(0.4, 0.7, wide)) * smoothstep(-0.05, 0.1, h));
        c = mix(haze, c, smoothstep(-0.02, 0.05, h));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  m.name = 'sky';
  applySky(m, L);
  const s = new THREE.Mesh(new THREE.SphereGeometry(600, 48, 24), m);
  s.frustumCulled = false; s.renderOrder = -1;
  s.onBeforeRender = (r, sc, cam) => s.position.copy(cam.position);
  return s;
}

/** 窗玻璃反射用的環境圖：只放天空的小場景做 PMREM */
export function skyEnv(renderer, L = LOOKS.morning) {
  const sc = new THREE.Scene(); const d = skyDome(L); sc.add(d);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(sc, 0, 0.1, 1000);
  pm.dispose(); d.geometry.dispose(); d.material.dispose();
  return rt;
}

// 調色：亮部微暖、暗部微冷、飽和度 1.08（ART.md 的 ColorBalance＋HueSat），在色調映射之前做
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, gain: { value: new THREE.Vector3(1.04, 1.0, 0.95) }, lift: { value: new THREE.Vector3(-0.004, -0.004, 0.006) }, sat: { value: 1.08 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec3 gain, lift; uniform float sat; varying vec2 vUv;
    void main(){ vec4 t = texture2D(tDiffuse, vUv); vec3 c = t.rgb * gain + lift * (1.0 - min(t.rgb, 1.0));
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = max(mix(vec3(l), c, sat), 0.0); gl_FragColor = vec4(c, t.a); }`,
};
