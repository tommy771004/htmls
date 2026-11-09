// 3D 畫面層：棋盤、單位、道具、地表、高亮、鏡頭、粒子與事件演出。
// 單位的所有變形都由每幀的 animateUnit() 統一寫入；事件演出只改 rec 上的參數（wind/strike/sq/lying…）。
/* global THREE */
import { GRID, TILE, LAYER, HEROES, PROPS, SURFACES, bbqMap } from './data.js';
import * as R from './rules.js';
import { buildUnit } from './models.js';
import { buildProp, buildSurface } from './props.js';
import { buildScenery, themeStyle } from './scenery.js';
import { toon, flat, part, box, cyl, sphere, group, textTexture, gradientMap, roundedBoxGeo } from './kit.js';
import { SFX } from './audio.js';

export const W = (x) => x * TILE + TILE / 2;           // 格 → 世界座標
export const topY = (h) => h * LAYER;

// 契約中的部位（存靜止旋轉／位置，動畫以偏移量疊加）
const PART_KEYS = ['body', 'head', 'armL', 'armR', 'forearmL', 'forearmR', 'legL', 'legR', 'wingL', 'wingR', 'tail'];
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const clampA = (v, a) => (v < -a ? -a : v > a ? a : v);
const eOut = t => 1 - Math.pow(1 - t, 3);
const eIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
function hash(x, z, s = 0) {
  let h = (x * 374761393 + z * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// 各主題的地塊雜草色（null = 室內不長草）
const TUFT = { desert: '#a89a4a', parking: '#5e8a3a', suburb: '#3f9a32', swamp: '#5a7a26', temple: '#6a7a2a', sewer: '#2f8a5a', bbq: null, diner: null, rooftop: '#4a7a3a', stage: null };

// 地塊材質的 GLSL 片段
const TILE_COMMON = `
varying vec3 vWp; varying float vUp;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n21(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }`;
const TILE_TOP = `
  float mot = n21(vWp.xz * 1.7) * 0.6 + n21(vWp.xz * 5.3) * 0.4;
  diffuseColor.rgb *= 0.93 + 0.1 * mot;
  diffuseColor.rgb *= mix(0.68, 1.0, smoothstep(0.2, 0.85, vUp));`;
const TILE_COL = `
  float ly = vWp.y / ${LAYER.toFixed(3)};
  float fy = fract(ly);
  float seam = smoothstep(0.0, 0.07, fy) * smoothstep(1.0, 0.9, fy);
  float wav = sin(vWp.x * 2.7 + vWp.z * 1.9) * 0.06 + sin(vWp.x * 7.3 - vWp.z * 5.1) * 0.03;
  float strata = 0.5 + 0.5 * sin((ly + wav) * 18.85);
  float grit = n21(vec2(vWp.x + vWp.z, vWp.y) * 6.0);
  diffuseColor.rgb *= mix(0.72, 1.0, seam) * mix(0.92, 1.04, strata) * (0.95 + 0.08 * grit);
  diffuseColor.rgb *= mix(0.6, 1.0, clamp((vWp.y + 0.7) / 1.4, 0.0, 1.0));`;

export function createView(canvas, overlay) {
  const isTouch = matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(isTouch ? 1.75 : 2, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 400);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x665544, 1.4);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 120 });
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03;
  sun.target.position.set(12, 0, 12);
  scene.add(hemi, sun, sun.target);

  // 天空漸層球
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color(0x88bbff) }, bot: { value: new THREE.Color(0xffeedd) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float t = clamp((normalize(vP - cameraPosition).y + 0.15) * 1.6, 0., 1.); gl_FragColor = vec4(mix(bot, top, t), 1.); }',
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 24, 12), skyMat);
  sky.renderOrder = -10;
  scene.add(sky);

  const world = new THREE.Group(); scene.add(world);
  const fxRoot = new THREE.Group(); scene.add(fxRoot);

  const V = {
    renderer, scene, camera, s: null, units: new Map(), props: new Map(), surf: new Map(), tiles: null,
    speed: 1, anims: [], time: 0, shake: 0, plates: new Map(), floats: [], style: null, sceneryAnim: null,
    hoverId: null, hitStop: 0, ambient: [], dustCol: null,
  };

  // ── 鏡頭 ──
  // yawT/distT/ftx/ftz 是玩家操作的目標；glide、punch、dMul、yOff 是演出用的疊加量
  const cam = { tx: 12, tz: 12, ty: 0.8, yaw: Math.PI * 0.25, yawT: Math.PI * 0.25, pitch: 0.92, pitchT: 0.92, dist: 30, distT: 30, ftx: 12, ftz: 12, glide: null, punch: 0, dMul: 1, dMulT: 1, yOff: 0, yOffT: 0 };
  V.cam = cam;
  V.rotate = (dir) => { cam.yawT += dir * Math.PI / 2; };
  V.rotateFree = (dx) => { cam.yawT += dx; cam.yaw = cam.yawT; };
  V.zoom = (k) => { cam.distT = Math.min(V.maxDist(), Math.max(10, cam.distT * k)); };
  V.maxDist = () => (innerWidth < 700 ? 46 : 34);
  V.focus = (x, z) => { cam.glide = null; cam.ftx = W(x); cam.ftz = W(z); };
  V.pan = (dx, dz) => {
    cam.glide = null;
    const c = Math.cos(cam.yaw), s = Math.sin(cam.yaw);
    cam.ftx = Math.min(26, Math.max(-2, cam.ftx + dx * c + dz * s));
    cam.ftz = Math.min(26, Math.max(-2, cam.ftz - dx * s + dz * c));
  };
  // 平滑滑到某單位（只移動目標點，不改玩家的旋轉與縮放）
  V.focusUnit = (id, o = {}) => {
    let x, z;
    const rec = V.units.get(id);
    if (rec) { x = rec.holder.position.x; z = rec.holder.position.z; }
    else { const u = V.s && R.unitById(V.s, id); if (!u) return; x = W(u.x); z = W(u.z); }
    if (!o.smooth) { cam.glide = null; cam.ftx = x; cam.ftz = z; return; }
    if (cam.glide && Math.hypot(cam.glide.bx - x, cam.glide.bz - z) < 0.05) return;
    const d = Math.hypot(x - cam.ftx, z - cam.ftz);
    if (d < 0.05) return;
    cam.glide = { ax: cam.ftx, az: cam.ftz, bx: x, bz: z, t: 0, dur: Math.min(0.9, 0.38 + d * 0.025) / Math.max(1, V.speed * 0.7) };
  };
  function updateCamera(dt) {
    const k = 1 - Math.exp(-dt * 7), k2 = 1 - Math.exp(-dt * 3);
    cam.yaw += (cam.yawT - cam.yaw) * k;
    cam.dist += (cam.distT - cam.dist) * k;
    cam.pitch += (cam.pitchT - cam.pitch) * k;
    cam.dMul += (cam.dMulT - cam.dMul) * k2;
    cam.yOff += (cam.yOffT - cam.yOff) * k2;
    if (cam.glide) {
      const g = cam.glide; g.t += dt;
      const e = eIO(clamp01(g.t / g.dur));
      cam.ftx = g.ax + (g.bx - g.ax) * e; cam.ftz = g.az + (g.bz - g.az) * e;
      if (g.t >= g.dur) cam.glide = null;
    }
    const kf = cam.glide ? 1 - Math.exp(-dt * 16) : k;
    cam.tx += (cam.ftx - cam.tx) * kf;
    cam.tz += (cam.ftz - cam.tz) * kf;
    cam.punch = Math.max(0, cam.punch - dt * 2.4);
    const dist = cam.dist * cam.dMul * (1 - 0.13 * cam.punch * cam.punch);
    const yaw = cam.yaw + cam.yOff;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    let sx = 0, sy = 0;
    if (V.shake > 0) {
      const a = V.shake * 0.5;
      sx = (Math.sin(V.time * 61) + Math.sin(V.time * 37.3) * 0.6) * a * 0.6; sy = (Math.sin(V.time * 53.7 + 1) + Math.sin(V.time * 29.1) * 0.6) * a * 0.6;
      V.shake = Math.max(0, V.shake - dt * 3);
    }
    camera.position.set(cam.tx + Math.sin(yaw) * cp * dist + sx, cam.ty + sp * dist + sy, cam.tz + Math.cos(yaw) * cp * dist);
    camera.lookAt(cam.tx + sx * 0.5, cam.ty, cam.tz);
  }

  // ── 棋盤 ──
  // 移除時釋放非共用幾何的 GPU 緩衝（快取幾何被釋放後若再用到，three 會自動重新上傳）
  function freeTree(c) { c.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); }
  function clear(g) {
    while (g.children.length) freeTree(g.children.pop());
  }
  const SLAB_H = 0.18;
  const tileTopGeo = roundedBoxGeo(TILE * 0.96, SLAB_H, TILE * 0.96, 0.07); tileTopGeo.userData.shared = true;
  const colGeo = new THREE.BoxGeometry(TILE, 1, TILE); colGeo.userData.shared = true;
  const lavaGeo = new THREE.PlaneGeometry(TILE, TILE); lavaGeo.rotateX(-Math.PI / 2); lavaGeo.userData.shared = true;
  function tileMat(kind) {
    const m = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradientMap() });
    m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp; varying float vUp;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 _wp = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n_wp = instanceMatrix * _wp;\n#endif\nvWp = (modelMatrix * _wp).xyz; vUp = normal.y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + TILE_COMMON)
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + (kind === 'top' ? TILE_TOP : TILE_COL));
    };
    m.customProgramCacheKey = () => 'tile280' + kind;
    return m;
  }
  const topMat = tileMat('top'), colMat = tileMat('col');
  // 熔岩：流動噪聲＋發亮脈動（不受光）
  const lavaMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color(0xff5a1f) } },
    vertexShader: `varying vec2 vW; void main(){ vec4 p = vec4(position, 1.0);
      #ifdef USE_INSTANCING
      p = instanceMatrix * p;
      #endif
      vec4 wp = modelMatrix * p; vW = wp.xz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform float uT; uniform vec3 uC; varying vec2 vW;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n21(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }
      void main(){
        vec2 p = vW * 0.8;
        float a = n21(p + vec2(uT * 0.22, uT * 0.1));
        float b = n21(p * 2.3 - vec2(uT * 0.15, -uT * 0.27) + a * 1.6);
        float v = a * 0.55 + b * 0.45;
        float crust = smoothstep(0.46, 0.66, v);
        float pulse = 0.9 + 0.12 * sin(uT * 2.2 + vW.x * 0.7 + vW.y * 0.4);
        vec3 hot = mix(uC * 1.25, vec3(1.0, 0.92, 0.55), smoothstep(0.42, 0.2, v)) * pulse;
        vec3 col = mix(hot, uC * 0.22, crust);
        col += vec3(1.0, 0.85, 0.5) * smoothstep(0.02, 0.0, abs(v - 0.47)) * 0.5;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  // 地塊貼花圖集（裂縫、污漬、雜草、碎石），白色繪製、用實例顏色上色
  let decalTex = null;
  function decalAtlas() {
    if (decalTex) return decalTex;
    const S = 128, c = document.createElement('canvas'); c.width = S * 4; c.height = S;
    const x = c.getContext('2d');
    let sd = 7; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round';
    // 裂縫
    const crack = (px, py, ang, len, w, d) => {
      x.lineWidth = w; x.beginPath(); x.moveTo(px, py);
      let cx = px, cy = py;
      for (let i = 0; i < 5; i++) { ang += (rnd() - 0.5) * 0.9; cx += Math.cos(ang) * len / 5; cy += Math.sin(ang) * len / 5; x.lineTo(cx, cy); if (d < 2 && rnd() < 0.35) { x.stroke(); crack(cx, cy, ang + (rnd() < 0.5 ? 0.9 : -0.9), len * 0.45, w * 0.6, d + 1); x.lineWidth = w; x.beginPath(); x.moveTo(cx, cy); } }
      x.stroke();
    };
    for (let i = 0; i < 3; i++) crack(64, 64, i * 2.1 + rnd(), 52, 3.2, 0);
    // 污漬
    x.save(); x.translate(S, 0);
    for (let i = 0; i < 9; i++) { const r = 14 + rnd() * 22; const g = x.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.save(); x.translate(64 + (rnd() - 0.5) * 50, 64 + (rnd() - 0.5) * 50); x.fillStyle = g; x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill(); x.restore(); }
    x.restore();
    // 雜草（俯視的放射草葉）
    x.save(); x.translate(S * 2, 0);
    for (let k = 0; k < 3; k++) {
      const cx = 64 + (rnd() - 0.5) * 50, cy = 64 + (rnd() - 0.5) * 50;
      for (let i = 0; i < 11; i++) { const a = rnd() * Math.PI * 2, l = 10 + rnd() * 18; x.beginPath(); x.moveTo(cx + Math.cos(a + 1.57) * 2.4, cy + Math.sin(a + 1.57) * 2.4); x.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); x.lineTo(cx - Math.cos(a + 1.57) * 2.4, cy - Math.sin(a + 1.57) * 2.4); x.fill(); }
    }
    x.restore();
    // 碎石
    x.save(); x.translate(S * 3, 0);
    for (let i = 0; i < 14; i++) { x.globalAlpha = 0.55 + rnd() * 0.45; x.beginPath(); x.ellipse(14 + rnd() * 100, 14 + rnd() * 100, 2 + rnd() * 5, 1.5 + rnd() * 3.5, rnd() * 3, 0, Math.PI * 2); x.fill(); }
    x.restore();
    decalTex = new THREE.CanvasTexture(c);
    decalTex.colorSpace = THREE.SRGBColorSpace; decalTex.anisotropy = 4;
    return decalTex;
  }
  const decalGeos = [0, 1, 2, 3].map(i => {
    const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let j = 0; j < uv.count; j++) uv.setX(j, (i + uv.getX(j) * 0.98 + 0.01) / 4);
    g.userData.shared = true;
    return g;
  });
  const decalMats = [];
  function decalMat(i) {
    if (decalMats[i]) return decalMats[i];
    const m = new THREE.MeshToonMaterial({ color: 0xffffff, map: decalAtlas(), gradientMap: gradientMap(), transparent: true, depthWrite: false, opacity: [0.8, 0.45, 1, 0.85][i], polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    return (decalMats[i] = m);
  }

  const hiGeo = new THREE.PlaneGeometry(TILE * 0.9, TILE * 0.9); hiGeo.rotateX(-Math.PI / 2);
  // 高亮格：圓角邊框＋由行動者向外擴散的脈動波
  const hiMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uO: { value: new THREE.Vector2(12, 12) }, uIn: { value: 1 } },
    vertexShader: `varying vec2 vUv; varying vec3 vC; varying vec2 vW;
      void main(){ vUv = uv; vC = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
        vC = instanceColor;
        #endif
        vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
        p = instanceMatrix * p;
        #endif
        vec4 wp = modelMatrix * p; vW = wp.xz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform float uT; uniform vec2 uO; uniform float uIn; varying vec2 vUv; varying vec3 vC; varying vec2 vW;
      void main(){
        vec2 q = abs(vUv - 0.5) * 2.0;
        float r = 0.22; vec2 dq = q - vec2(1.0 - r);
        float sd = length(max(dq, 0.0)) + min(max(dq.x, dq.y), 0.0) - r;
        if (sd > 0.0) discard;
        float edge = smoothstep(-0.2, -0.07, sd);
        float wave = 0.5 + 0.5 * sin(uT * 4.0 - length(vW - uO) * 0.75);
        float a = (0.2 + 0.12 * wave) + edge * (0.55 + 0.3 * wave);
        gl_FragColor = vec4(vC * (1.0 + edge * 0.25 + wave * 0.1), a * uIn);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false,
  });
  const hi = new THREE.InstancedMesh(hiGeo, hiMat, 400);
  hi.setColorAt(0, new THREE.Color(1, 1, 1));
  hi.count = 0; hi.renderOrder = 5; hi.frustumCulled = false;
  scene.add(hi);
  let hiKey = '', hiIn = 1;
  // 游標框＋目標頭上的跳動箭頭
  const cursor = new THREE.Mesh(new THREE.RingGeometry(0.86, 1.0, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }));
  cursor.rotation.x = -Math.PI / 2; cursor.scale.setScalar(1.38); cursor.visible = false; cursor.renderOrder = 6;
  const cursor2 = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.68, 4, 1, Math.PI / 4), cursor.material);
  cursor2.position.z = 0.001; cursor.add(cursor2);
  scene.add(cursor);
  let cursorY = 0;
  const tgtMark = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.5, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true }));
  tgtMark.rotation.x = Math.PI; tgtMark.visible = false; tgtMark.renderOrder = 9;
  scene.add(tgtMark);
  let tgtRec = null;
  // 範圍圈：旋轉虛線外圈＋向外擴散的填色
  const aoeU = { uT: { value: 0 }, uC: { value: new THREE.Color(0xff8a1f) } };
  const aoeRing = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 72), new THREE.ShaderMaterial({
    uniforms: aoeU, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uC; varying vec2 vP; void main(){ float a = atan(vP.y, vP.x) / 6.28318; if (fract(a * 30.0) < 0.38) discard; gl_FragColor = vec4(uC, 0.95);
      #include <colorspace_fragment>
    }`,
  }));
  aoeRing.rotation.x = -Math.PI / 2; aoeRing.visible = false; aoeRing.renderOrder = 6;
  const aoeDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.ShaderMaterial({
    uniforms: aoeU, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uC; uniform float uT; varying vec2 vP; void main(){ float r = length(vP);
      float w = fract(uT * 0.7); float band = smoothstep(0.09, 0.0, abs(r - w)) * (1.0 - w);
      float a = 0.1 + 0.16 * smoothstep(0.55, 1.0, r) + 0.3 * band;
      gl_FragColor = vec4(uC, a);
      #include <colorspace_fragment>
    }`,
  }));
  aoeDisc.rotation.x = -Math.PI / 2; aoeDisc.visible = false; aoeDisc.renderOrder = 5;
  scene.add(aoeRing, aoeDisc);
  // 路徑：平面緞帶＋往前流動的箭頭紋
  const pathMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } }, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT; varying vec2 vUv; void main(){
      float c = abs(vUv.y - 0.5);
      float f = fract(vUv.x * 1.4 - uT * 1.6 - c * 0.9);
      float chev = smoothstep(0.0, 0.05, f) * smoothstep(0.5, 0.42, f);
      float edge = smoothstep(0.5, 0.42, c);
      float a = edge * (0.32 + 0.63 * chev);
      gl_FragColor = vec4(mix(vec3(0.95, 0.98, 1.0), vec3(1.0, 0.86, 0.3), chev * 0.35), a);
      #include <colorspace_fragment>
    }`,
  });
  const pathLine = new THREE.Mesh(new THREE.BufferGeometry(), pathMat);
  pathLine.renderOrder = 7; pathLine.visible = false; pathLine.frustumCulled = false;
  scene.add(pathLine);
  let pathKey = '';
  // 點擊漣漪
  const ripGeo = new THREE.RingGeometry(0.8, 1, 40); ripGeo.rotateX(-Math.PI / 2);
  const ripples = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(ripGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, opacity: 0 }));
    m.visible = false; m.renderOrder = 6; m.userData = { age: 0, life: 1, max: 1 };
    scene.add(m); ripples.push(m);
  }
  let lavaTiles = [], emberT = 0;

  let loading = false;
  V.loadLevel = (s) => {
    loading = true;
    V.s = s;
    clear(world); clear(fxRoot);
    V.units.clear(); V.props.clear(); V.surf.clear();
    for (const p of V.plates.values()) p.remove();
    V.plates.clear();
    for (const f of V.floats) f.el.remove();
    V.floats = [];
    V.anims = [];
    V.ambient = [];
    V.hoverId = null; V.hitStop = 0; V.lastAtk = null;
    canvas.style.filter = '';
    Object.assign(cam, { glide: null, punch: 0, dMul: 1, dMulT: 1, yOff: 0, yOffT: 0, pitch: 0.92, pitchT: 0.92 });
    pathKey = ''; hiKey = '';
    const L = s.L;
    const st = V.style = themeStyle(L.theme);
    skyMat.uniforms.top.value.set(st.sky[0]); skyMat.uniforms.bot.value.set(st.sky[1]);
    scene.fog = new THREE.Fog(st.fog, st.fogNear || 60, st.fogFar || 150);
    hemi.color.set(st.hemiSky); hemi.groundColor.set(st.hemiGround); hemi.intensity = st.hemiIntensity ?? 1.4;
    sun.color.set(st.sun); sun.intensity = st.sunIntensity ?? 2.4;
    const sd = new THREE.Vector3(...(st.sunDir || [0.5, 1, 0.35])).normalize();
    sun.position.set(12 + sd.x * 50, sd.y * 50, 12 + sd.z * 50);
    V.dustCol = [new THREE.Color(st.tileTop[0]).lerp(new THREE.Color(0xffffff), 0.45).getHex(), new THREE.Color(st.tileTop[1]).lerp(new THREE.Color(0xffffff), 0.3).getHex(), 0xf4efe6];
    buildBoard(s, st);
    // 棋盤外緣裙邊
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(GRID * TILE + 0.6, 0.5, GRID * TILE + 0.6), toon(st.tileEdge));
    skirt.position.set(12, -0.95, 12); skirt.receiveShadow = true;
    world.add(skirt);
    // 場景裝飾
    try {
      const scen = buildScenery(L, L.h === 'bbq' ? bbqMap() : L.h);
      world.add(scen);
      V.ambient = collectAnims(scen);
      V.sceneryAnim = scen.userData.anim || null;
    } catch (e) { console.warn('scenery', e); V.sceneryAnim = null; }
    // 道具
    for (const p of s.props) addPropMesh(p);
    // 地表
    for (const t of s.grid.flat()) if (t.surf && t.surf.type !== 'lava') setSurfMesh(t.x, t.z, t.surf.type);
    // 第 7 關中央肉錘
    if (L.center) {
      const hm = buildProp('hammer', 1, 1);
      hm.position.set(12, 0, 12);
      hm.userData._al = collectAnims(hm);
      world.add(hm);
      V.hammer = hm;
      for (const [x, z] of L.center) {
        const mk = new THREE.Mesh(hiGeo, new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.22, depthWrite: false }));
        mk.position.set(W(x), topY(s.grid[z][x].h) + 0.03, W(z)); world.add(mk);
      }
    } else V.hammer = null;
    if (L.throne) for (const [x, z] of L.throne) {
      const mk = new THREE.Mesh(hiGeo, new THREE.MeshBasicMaterial({ color: 0xff2a8a, transparent: true, opacity: 0.3, depthWrite: false }));
      mk.position.set(W(x), topY(s.grid[z][x].h) + 0.03, W(z)); world.add(mk);
    }
    // 單位
    for (const u of s.units) if (R.alive(u)) addUnitMesh(u);
    cam.ftx = cam.tx = 12; cam.ftz = cam.tz = 12;
    cam.distT = cam.dist = Math.min(V.maxDist(), innerWidth < 700 ? 44 : 31);
    V.setHighlights(null);
    loading = false;
  };

  // 地塊：柱身（岩層線）＋圓角頂板＋熔岩＋貼花
  function buildBoard(s, st) {
    const tiles = s.grid.flat().filter(t => !t.void);
    const cols = new THREE.InstancedMesh(colGeo, colMat, tiles.length);
    const tops = new THREE.InstancedMesh(tileTopGeo, topMat, tiles.length);
    cols.receiveShadow = tops.receiveShadow = true; cols.castShadow = true;
    const m = new THREE.Matrix4(), c = new THREE.Color(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    lavaTiles = tiles.filter(t => t.lava);
    tiles.forEach((t, i) => {
      const top = t.lava ? -0.3 : topY(t.h);
      const colTop = top - 0.07, bottom = -0.7;
      m.makeScale(1, colTop - bottom, 1).setPosition(W(t.x), (colTop + bottom) / 2, W(t.z));
      cols.setMatrixAt(i, m);
      c.set(t.lava ? st.tileEdge : st.tileSide);
      c.offsetHSL(0, 0, (hash(t.x, t.z, 3) - 0.5) * 0.05);
      cols.setColorAt(i, c);
      m.makeTranslation(W(t.x), top + 0.005 - SLAB_H / 2, W(t.z));
      tops.setMatrixAt(i, m);
      if (t.lava) c.set(st.lava).multiplyScalar(0.35);
      else {
        c.set(st.tileTop[t.h]);
        if ((t.x + t.z) % 2) c.offsetHSL(0, 0, -0.03);
        c.offsetHSL((hash(t.x, t.z, 1) - 0.5) * 0.016, (hash(t.x, t.z, 2) - 0.5) * 0.06, (hash(t.x, t.z, 4) - 0.5) * 0.045);
      }
      tops.setColorAt(i, c);
    });
    tops.userData.tiles = tiles;
    world.add(cols, tops);
    V.tiles = tops;
    // 熔岩
    if (lavaTiles.length) {
      lavaMat.uniforms.uC.value.set(st.lava);
      const lv = new THREE.InstancedMesh(lavaGeo, lavaMat, lavaTiles.length);
      lavaTiles.forEach((t, i) => { m.makeTranslation(W(t.x), -0.3 + 0.012, W(t.z)); lv.setMatrixAt(i, m); });
      lv.userData.tiles = lavaTiles;
      world.add(lv);
      V.lavaMesh = lv;
    } else V.lavaMesh = null;
    // 貼花
    const tuft = TUFT[s.L.theme] !== undefined ? TUFT[s.L.theme] : '#5e8a3a';
    const lists = [[], [], [], []];
    for (const t of tiles) {
      if (t.lava) continue;
      const r = hash(t.x, t.z, 11);
      const k = r < 0.15 ? 0 : r < 0.28 ? 1 : r < 0.46 ? (tuft ? 2 : 3) : r < 0.56 ? 3 : -1;
      if (k >= 0) lists[k].push(t);
      if (k === 2 && hash(t.x, t.z, 12) < 0.4) lists[3].push(t);
    }
    lists.forEach((arr, k) => {
      if (!arr.length) return;
      const im = new THREE.InstancedMesh(decalGeos[k], decalMat(k), arr.length);
      im.receiveShadow = true;
      arr.forEach((t, i) => {
        const h1 = hash(t.x, t.z, 20 + k), h2 = hash(t.x, t.z, 30 + k), h3 = hash(t.x, t.z, 40 + k);
        const size = (k === 2 ? 0.7 : 0.9) + h1 * 0.7;
        p.set(W(t.x) + (h2 - 0.5) * (TILE - size) * 0.8, topY(t.h) + 0.012 + k * 0.002, W(t.z) + (h3 - 0.5) * (TILE - size) * 0.8);
        q.setFromEuler(e.set(0, h1 * 6.283, 0));
        m.compose(p, q, sc.set(size, 1, size));
        im.setMatrixAt(i, m);
        if (k === 0) c.set(st.tileTop[t.h]).multiplyScalar(0.55);
        else if (k === 1) c.set(st.tileEdge);
        else if (k === 2) c.set(tuft).offsetHSL(0, 0, (h2 - 0.5) * 0.08);
        else c.set(st.tileTop[t.h]).lerp(new THREE.Color(h1 < 0.5 ? 0xffffff : 0x000000), 0.28);
        im.setColorAt(i, c);
      });
      world.add(im);
    });
  }

  // 影子只給夠大的不透明網格（眼睛、牙齒、半透明煙霧不投影，省掉陰影 pass 的繪製）
  function trimShadows(root, minR) {
    root.updateMatrixWorld(true);
    root.traverse(o => {
      if (!o.isMesh || o.name === 'outline' || !o.castShadow) return;
      const m = o.material;
      if (Array.isArray(m) || m.transparent || m.isMeshBasicMaterial || m.isShaderMaterial) { o.castShadow = false; return; }
      const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
      if (g.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() < minR) o.castShadow = false;
    });
  }
  function collectAnims(root) {
    const out = [];
    root.traverse(o => { if (typeof o.userData.anim === 'function') out.push(o); });
    return out;
  }
  function runAnims(list, dt) {
    for (const o of list) {
      if (o.userData._animErr) continue;
      try { o.userData.anim(V.time, dt); } catch (e) { o.userData._animErr = true; console.warn('anim', e); }
    }
  }

  function propBaseY(p) {
    let h = 0;
    for (let z = p.z; z < p.z + p.d; z++) for (let x = p.x; x < p.x + p.w; x++) { const t = V.s.grid[z] && V.s.grid[z][x]; if (t) h = Math.max(h, t.h); }
    return topY(h);
  }
  function addPropMesh(p) {
    if (!p.alive) return;
    let g;
    try { g = buildProp(p.type, p.w, p.d); } catch (e) { console.warn('prop', p.type, e); g = box(1, 1, 1, 0xff00ff); }
    g.position.set(p.x * TILE + p.w * TILE / 2, propBaseY(p), p.z * TILE + p.d * TILE / 2);
    if (p.type === 'chair') g.rotation.y = (p.x * 7 + p.z * 3) % 6;
    g.userData.pid = p.id;
    g.traverse(o => { if (o.isMesh) o.userData.pid = p.id; });
    g.userData._al = collectAnims(g);
    trimShadows(g, 0.12);
    world.add(g);
    V.props.set(p.id, g);
    return g;
  }
  function setSurfMesh(x, z, type) {
    const k = x + ',' + z;
    const old = V.surf.get(k);
    if (old) { world.remove(old); V.surf.delete(k); }
    if (!type || type === 'lava') return;
    let g;
    try { g = buildSurface(type); } catch (e) { console.warn('surf', type, e); return; }
    g.position.set(W(x), topY(V.s.grid[z][x].h), W(z));
    g.rotation.y = ((x * 13 + z * 7) % 4) * Math.PI / 2;
    g.userData._al = collectAnims(g);
    world.add(g);
    V.surf.set(k, g);
    // 新地表冒出時小小地彈一下
    if (!loading) { g.scale.setScalar(0.3); tweenRaw(260, k2 => g.scale.setScalar(0.3 + 0.7 * eOut(k2) + Math.sin(k2 * Math.PI) * 0.12)); }
  }

  // ── 受擊閃色：暫時換成共用材質的變體（不改動原材質）──
  const FLASH = new Map();
  const FLC = { w: new THREE.Color(0xffffff), r: new THREE.Color(0xff2a2a), g: new THREE.Color(0x7dff8a), y: new THREE.Color(0xffd23f) };
  function flashMat(m, kind) {
    if (!m || Array.isArray(m) || m.isShaderMaterial || !m.isMaterial) return null;
    let c = FLASH.get(m);
    if (!c) FLASH.set(m, (c = {}));
    if (!c[kind]) {
      const f = m.clone();
      if (f.emissive) { f.emissive.copy(FLC[kind]); f.emissiveIntensity = kind === 'w' ? 1.0 : 0.55; }
      else if (f.color) f.color.lerp(FLC[kind], kind === 'w' ? 0.8 : 0.5);
      c[kind] = f;
    }
    return c[kind];
  }
  function applyFlash(rec, kind) {
    if (rec.curFlash === kind) return;
    rec.curFlash = kind;
    for (const it of rec.meshes) {
      const o = it.o;
      if (kind) {
        if (o.material !== it.fm) it.orig = o.material;
        const fm = flashMat(it.orig, kind);
        if (fm) { o.material = fm; it.fm = fm; }
      } else if (it.fm) {
        if (o.material === it.fm) o.material = it.orig;
        it.fm = null;
      }
    }
  }

  // ── 單位 ──
  const ringGeo = new THREE.RingGeometry(0.62, 0.78, 32); ringGeo.rotateX(-Math.PI / 2);
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, 1.05); arrowShape.lineTo(0.32, 0.72); arrowShape.lineTo(0.12, 0.74); arrowShape.lineTo(0.12, 0.5); arrowShape.lineTo(-0.12, 0.5); arrowShape.lineTo(-0.12, 0.74); arrowShape.lineTo(-0.32, 0.72); arrowShape.closePath();
  const arrowGeo = new THREE.ShapeGeometry(arrowShape); arrowGeo.rotateX(Math.PI / 2);
  function addUnitMesh(u) {
    const holder = new THREE.Group();
    let model;
    try { model = buildUnit(u.transformed ? 'lizard2' : u.key); } catch (e) { console.warn(e); model = box(1, 1.6, 1, 0xff00ff); model.userData = { height: 1.6, parts: {} }; }
    trimShadows(model, 0.075);
    model.rotation.order = 'YXZ';
    holder.add(model);
    const col = u.side === 'hero' ? HEROES[u.key].color : (u.boss ? '#ff2a4a' : '#ff6a5a');
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, depthWrite: false }));
    ring.position.y = 0.04; ring.renderOrder = 4;
    const arrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0xffc531, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }));
    arrow.position.y = 0.05; arrow.renderOrder = 4;
    holder.add(ring, arrow);
    const H = model.userData.height || 1.8;
    // 點選用的隱形碰撞體
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, H, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = H / 2; hit.userData.uid = u.id;
    holder.add(hit);
    holder.position.set(W(u.x), topY(V.s.grid[u.z][u.x].h), W(u.z));
    const yaw = Math.atan2(u.f[0], u.f[1]);
    model.rotation.y = yaw;
    world.add(holder);
    const parts = model.userData.parts || {};
    // 各部位的靜止姿勢（有些模型用旋轉擺出拿武器的姿勢），動畫一律以偏移量疊加
    const rest = {}, O = {};
    for (const k of PART_KEYS) {
      const p = parts[k];
      if (p && p.isObject3D) { rest[k] = { r: p.rotation.clone(), p: p.position.clone(), s: p.scale.clone() }; O[k] = [0, 0, 0, 0, 0, 0]; }
    }
    const objs = v => (Array.isArray(v) ? v : v ? [v] : []).filter(o => o && o.isObject3D);
    const eyes = objs(parts.eyes).map(o => ({ o, sy: o.scale.y }));
    const extra = objs(parts.extra).map(o => ({ o, r: o.rotation.clone() }));
    const mouth = parts.mouth && parts.mouth.isObject3D ? { o: parts.mouth, sy: parts.mouth.scale.y } : null;
    let atkArm = 'armR';
    if (parts.weapon && parts.armL) { let o = parts.weapon; while (o && o !== parts.armL && o !== parts.armR) o = o.parent; if (o === parts.armL) atkArm = 'armL'; }
    if (!parts[atkArm] && parts.armL) atkArm = 'armL';
    const meshes = [];
    model.traverse(o => { if (o.isMesh && o.name !== 'outline' && !Array.isArray(o.material)) meshes.push({ o, orig: o.material, fm: null }); });
    const rec = {
      u, holder, model, ring, arrow, hit, parts, rest, O, eyes, extra, mouth, meshes, atkArm, H,
      phase: Math.random() * 6, walk: 0, walkW: 0, walkPh: 0, stepSg: true, yaw, curYaw: yaw, spin: 0,
      lying: u.downed ? 1 : 0, lyingT: u.downed ? 1 : 0, lyingLock: false, siren: null,
      sc: 1, sq: 0, sqV: 0, sqT: 0, lean: 0, topple: 0, sink: 0, popY: 0, dropY: 0, hidden: false,
      mode: null, wind: 0, strike: 0, hitT: 0, hitDir: new THREE.Vector3(0, 0, -1), dodgeT: 0, dodgeS: 1,
      flashK: null, flashT: 0, curFlash: null, blink: 1 + Math.random() * 3, hy: 0, hp: 0,
      activeW: 0, hoverW: 0, cele: null, celeW: 0, lookAt: null, lookUntil: 0, pushed: 0, dead: false,
    };
    rec.arrow.rotation.y = rec.yaw;
    V.units.set(u.id, rec);
    // 名牌
    const plate = document.createElement('div');
    plate.className = 'plate ' + (u.side === 'hero' ? 'hero' : 'foe') + (u.boss ? ' boss' : '');
    plate.innerHTML = `<b class="pn"></b><i class="hp"><i></i></i><span class="ps"></span>`;
    overlay.appendChild(plate);
    V.plates.set(u.id, plate);
    rec.plate = plate;
    updatePlate(rec);
    return rec;
  }
  function updatePlate(rec) {
    const u = rec.u, p = rec.plate;
    if (!p) return;
    p.querySelector('.pn').textContent = u.side === 'hero' ? HEROES[u.key].name : (u.icon || '') + ' ' + shortName(u.name);
    const ratio = Math.max(0, u.hp / u.maxHp);
    const bar = p.querySelector('.hp i');
    bar.style.width = (ratio * 100) + '%';
    p.classList.toggle('low', ratio < 0.35);
    p.querySelector('.ps').textContent = Object.keys(u.st).map(k => (R.alive(u) && STATUS_ICON[k]) || '').join('');
    p.classList.toggle('downed', !!u.downed);
  }
  V.updatePlates = () => { for (const r of V.units.values()) updatePlate(r); };
  V.setActive = (id) => {
    for (const r of V.units.values()) {
      const was = r.active;
      r.active = r.u.id === id;
      if (r.active && !was && !r.u.downed) r.sqV += 2.2; // 輪到時彈一下
    }
  };
  V.hover = (uid) => { V.hoverId = uid ?? null; };

  // ── 高亮 ──
  // h = { reach: [[x,z]], targets: [[x,z,'enemy'|'ally'|'tile']], path: [[x,z]], aoe: {x,z,r}, cursor: [x,z], push: [[x,z]] }
  const C_REACH = new THREE.Color(0x29e0c9), C_FAR = new THREE.Color(0x1d8fa0), C_ENEMY = new THREE.Color(0xff3b4a), C_ALLY = new THREE.Color(0x6dff7a), C_TILE = new THREE.Color(0xffb02e), C_PUSH = new THREE.Color(0xff2aa0);
  V.setHighlights = (h) => {
    const m = new THREE.Matrix4();
    let i = 0;
    const put = (x, z, col, lift = 0) => {
      if (i >= 400) return;
      const t = V.s && V.s.grid[z] && V.s.grid[z][x];
      if (!t) return;
      m.makeTranslation(W(x), (t.lava ? -0.3 : topY(t.h)) + 0.08 + lift, W(z));
      hi.setMatrixAt(i, m); hi.setColorAt(i, col); i++;
    };
    if (h) {
      for (const [x, z, far] of h.reach || []) put(x, z, far ? C_FAR : C_REACH);
      for (const [x, z, k] of h.targets || []) put(x, z, k === 'ally' ? C_ALLY : k === 'tile' ? C_TILE : C_ENEMY, 0.01);
      for (const [x, z] of h.push || []) put(x, z, C_PUSH, 0.02);
    }
    hi.count = i;
    hi.instanceMatrix.needsUpdate = true;
    if (hi.instanceColor) hi.instanceColor.needsUpdate = true;
    // 範圍改變時淡入、波源設在行動者腳下
    const key = h ? (h.reach || []).length + ':' + (h.targets || []).length + ':' + ((h.reach || [])[0] || '') : '';
    if (key !== hiKey) {
      hiKey = key; hiIn = 0;
      const cu = V.s && R.current(V.s);
      if (cu) hiMat.uniforms.uO.value.set(W(cu.x), W(cu.z));
    }
    // 路徑
    if (h && h.path && h.path.length > 1) {
      const k = h.path.map(p => p.join(',')).join(';');
      if (k !== pathKey) { pathKey = k; buildPath(h.path); }
      pathLine.visible = true;
    } else { pathLine.visible = false; pathKey = ''; }
    if (h && h.aoe) {
      const t = V.s.grid[h.aoe.z][h.aoe.x];
      const r = (h.aoe.r + 0.5) * TILE;
      aoeRing.scale.setScalar(r); aoeDisc.scale.setScalar(r);
      aoeRing.position.set(W(h.aoe.x), topY(t.h) + 0.12, W(h.aoe.z));
      aoeDisc.position.copy(aoeRing.position);
      aoeU.uC.value.set(h.aoe.color || 0xff8a1f);
      aoeRing.visible = aoeDisc.visible = true;
    } else aoeRing.visible = aoeDisc.visible = false;
    tgtRec = null;
    if (h && h.cursor) {
      const [x, z] = h.cursor;
      const t = V.s.grid[z] && V.s.grid[z][x];
      if (t) {
        cursorY = (t.lava ? -0.3 : topY(t.h)) + 0.1;
        cursor.position.set(W(x), cursorY, W(z)); cursor.visible = true; cursor.material.color.set(h.cursorColor || 0xffffff);
        if ((h.targets || []).some(q => q[0] === x && q[1] === z)) {
          for (const r of V.units.values()) if (r.u.x === x && r.u.z === z && R.alive(r.u)) { tgtRec = r; break; }
          tgtMark.material.color.set(h.cursorColor || 0xffffff);
        }
      }
    } else cursor.visible = false;
    tgtMark.visible = !!tgtRec;
  };
  function buildPath(path) {
    const pts = [];
    for (let i = 0; i < path.length; i++) {
      const [x, z] = path[i];
      const b = new THREE.Vector3(W(x), topY(V.s.grid[z][x].h) + 0.2, W(z));
      if (i === 0) { pts.push(b); continue; }
      const a = pts[pts.length - 1].clone();
      const hop = Math.abs(b.y - a.y) > 0.1 ? 0.55 : 0;
      for (let j = 1; j <= 6; j++) { const k = j / 6; pts.push(new THREE.Vector3(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k + Math.sin(k * Math.PI) * hop, a.z + (b.z - a.z) * k)); }
    }
    // 起點稍微往前，避免蓋住腳下
    const pos = [], uv = [], idx = [];
    let d = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], pa = pts[Math.max(0, i - 1)], pb = pts[Math.min(pts.length - 1, i + 1)];
      if (i > 0) d += p.distanceTo(pts[i - 1]);
      let tx = pb.x - pa.x, tz = pb.z - pa.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const w = 0.17;
      pos.push(p.x - tz * w, p.y, p.z + tx * w, p.x + tz * w, p.y, p.z - tx * w);
      uv.push(d, 0, d, 1);
      if (i > 0) { const o = (i - 1) * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
    }
    pathLine.geometry.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    pathLine.geometry = g;
  }

  // ── 點選 ──
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  V.pick = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = [];
    for (const rec of V.units.values()) if (!rec.dead) hits.push(rec.hit);
    const hh = ray.intersectObjects(hits, false);
    // 懸吊物
    let pid = null;
    for (const [id, g] of V.props) {
      const p = V.s.props.find(q => q.id === id);
      if (!p || !PROPS[p.type].hang && !(p.maxHp > 0)) continue;
      const ih = ray.intersectObject(g, true);
      if (ih.length && (!hh.length || ih[0].distance < hh[0].distance)) { pid = id; break; }
    }
    if (pid) { const p = V.s.props.find(q => q.id === pid); return { x: p.x, z: p.z, pid }; }
    if (hh.length) { const u = R.unitById(V.s, hh[0].object.userData.uid); if (u && R.alive(u)) return { x: u.x, z: u.z, uid: u.id }; }
    const th = ray.intersectObject(V.tiles, false);
    if (th.length) { const t = V.tiles.userData.tiles[th[0].instanceId]; return { x: t.x, z: t.z }; }
    if (V.lavaMesh) { const lh = ray.intersectObject(V.lavaMesh, false); if (lh.length) { const t = V.lavaMesh.userData.tiles[lh[0].instanceId]; return { x: t.x, z: t.z }; } }
    return null;
  };
  V.project = (x, y, z) => {
    const v = new THREE.Vector3(x, y, z).project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height, vis: v.z < 1 };
  };

  // ── 浮動文字 ──
  V.floatText = (x, z, text, cls = '', yOff = 0) => {
    if (V.floats.some(f => f.tx === x && f.tz === z && f.text === text && f.age < 0.6)) return;
    const el = document.createElement('div');
    el.className = 'float ' + cls;
    el.textContent = text;
    overlay.appendChild(el);
    const t = V.s.grid[z] && V.s.grid[z][x];
    const stack = V.floats.filter(f => f.tx === x && f.tz === z && f.age < 0.6).length;
    V.floats.push({ el, wx: W(x), wy: (t ? topY(t.h) : 0) + 2.3 + yOff + stack * 0.55, wz: W(z), age: 0, life: cls === 'crit' || cls === 'react' ? 2.2 : 1.6, tx: x, tz: z, text });
  };

  // ── 粒子 ──
  const PMAX = 1600;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3), pSize = new Float32Array(PMAX);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  pGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
  const pMat = new THREE.ShaderMaterial({
    vertexColors: true, transparent: true, depthWrite: false,
    vertexShader: 'attribute float size; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = size * (300. / -mv.z); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'varying vec3 vC; void main(){ vec2 d = gl_PointCoord - .5; float r = length(d); if (r > .5) discard; float e = smoothstep(.5, .32, r); gl_FragColor = vec4(mix(vec3(0.1,0.06,0.15), vC, smoothstep(.5,.38,r)), e); }',
  });
  const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; points.renderOrder = 8;
  scene.add(points);
  const parts = [];
  const tmpC = new THREE.Color();
  V.burst = (wx, wy, wz, n, o = {}) => {
    for (let i = 0; i < n && parts.length < PMAX; i++) {
      const a = Math.random() * Math.PI * 2, sp = (o.speed || 4) * (0.4 + Math.random() * 0.8);
      const up = o.up ?? 4;
      tmpC.set(Array.isArray(o.color) ? o.color[i % o.color.length] : (o.color || 0xffffff));
      parts.push({ x: wx + (Math.random() - 0.5) * (o.spread || 0.4), y: wy + Math.random() * (o.h || 0.3), z: wz + (Math.random() - 0.5) * (o.spread || 0.4),
        vx: Math.cos(a) * sp * (o.flat ?? 1), vy: up * (0.5 + Math.random()), vz: Math.sin(a) * sp * (o.flat ?? 1),
        g: o.g ?? -9, life: (o.life || 0.9) * (0.6 + Math.random() * 0.6), age: 0, size: (o.size || 0.35) * (0.6 + Math.random() * 0.8), r: tmpC.r, gg: tmpC.g, b: tmpC.b, drag: o.drag ?? 1.2 });
    }
  };
  function updateParticles(dt) {
    let j = 0;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vy += p.g * dt; const dr = Math.exp(-p.drag * dt); p.vx *= dr; p.vz *= dr;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < -0.5) p.y = -0.5;
      parts[j++] = p;
      const k = j - 1;
      pPos[k * 3] = p.x; pPos[k * 3 + 1] = p.y; pPos[k * 3 + 2] = p.z;
      pCol[k * 3] = p.r; pCol[k * 3 + 1] = p.gg; pCol[k * 3 + 2] = p.b;
      pSize[k] = p.size * (1 - (p.age / p.life) * 0.7);
    }
    parts.length = j;
    pGeo.setDrawRange(0, j);
    pGeo.attributes.position.needsUpdate = pGeo.attributes.color.needsUpdate = pGeo.attributes.size.needsUpdate = true;
  }
  function dust(p, n = 5, s = 1) {
    V.burst(p.x, p.y + 0.05, p.z, n, { color: V.dustCol || [0xeeeeee], up: 1.1, speed: 1.8 * s, g: 1.2, life: 0.55, size: 0.42 * s, drag: 3.5, spread: 0.6 });
  }
  function sparkle(p, n, color, up = 3) {
    V.burst(p.x, p.y, p.z, n, { color, up, speed: 2.2, g: 1.5, life: 1.1, size: 0.28, drag: 2, spread: 0.8, h: 0.6 });
  }

  // 點擊漣漪：x,z 為格座標（可帶小數）
  V.ripple = (x, z, color = 0xffffff, o = {}) => {
    if (!V.s) return;
    const t = V.s.grid[Math.round(z)] && V.s.grid[Math.round(z)][Math.round(x)];
    const y = t ? (t.lava ? -0.3 : topY(t.h)) + 0.1 : 0.1;
    let r = ripples.find(m => !m.visible);
    if (!r) r = ripples.reduce((a, b) => (a.userData.age > b.userData.age ? a : b));
    r.visible = true; r.material.color.set(color); r.material.opacity = 0.9;
    r.userData.age = 0; r.userData.life = o.life || 0.55; r.userData.max = o.r || 1.3;
    r.position.set(W(x), y, W(z)); r.scale.setScalar(0.2);
    if (!o.quiet) V.burst(W(x), y, W(z), 6, { color: [color, 0xffffff], up: 2, speed: 2.5, g: -4, life: 0.4, size: 0.2, spread: 0.3 });
  };
  function updateRipples(dt) {
    for (const r of ripples) {
      if (!r.visible) continue;
      const d = r.userData; d.age += dt;
      const k = d.age / d.life;
      if (k >= 1) { r.visible = false; continue; }
      r.scale.setScalar(d.max * (0.2 + 0.8 * eOut(k)));
      r.material.opacity = 0.9 * (1 - k);
    }
  }

  // ── 投射物（emoji 貼片）──
  function emojiSprite(ch, size = 0.9) {
    const { tex } = textTexture(ch, { size: 96, font: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif', weight: 400 });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.scale.set(size, size, 1); sp.renderOrder = 9;
    return sp;
  }

  // ── 動畫工具 ──
  const wait = (ms) => new Promise(r => setTimeout(r, ms / V.speed));
  V.wait = wait;
  function tween(dur, fn) {
    return new Promise(res => { V.anims.push({ t: 0, dur: dur / V.speed, fn, res }); });
  }
  // 不受倍速影響的小動畫（裝飾用，不等待）
  function tweenRaw(dur, fn) { V.anims.push({ t: 0, dur, fn, res: () => {} }); }
  const unitPos = (u) => new THREE.Vector3(W(u.x), topY(V.s.grid[u.z][u.x].h), W(u.z));
  const tilePos = (x, z) => new THREE.Vector3(W(x), topY((V.s.grid[z] && V.s.grid[z][x] ? V.s.grid[z][x].h : 0)), W(z));
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  async function animMove(rec, path) {
    rec.walk = 1;
    if (rec.active) { const e = path[path.length - 1]; keepInView(tilePos(e[0], e[1])); }
    for (let i = 1; i < path.length; i++) {
      const a = tilePos(path[i - 1][0], path[i - 1][1]), b = tilePos(path[i][0], path[i][1]);
      const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      rec.yaw = yaw;
      const dh = b.y - a.y, big = Math.abs(dh) > 0.1;
      SFX.play('step');
      if (big) rec.sqV += 2.4;
      await tween(big ? 230 : 170, k => {
        rec.holder.position.lerpVectors(a, b, k);
        rec.holder.position.y = a.y + dh * k + Math.sin(k * Math.PI) * (big ? 0.75 : 0.07);
      });
      if (big) { rec.sqV -= 3.4; dust(b, 6); }
    }
    rec.walk = 0;
    rec.sqV -= 1.2;
  }
  async function arc(obj, a, b, dur, h = 2.5, spin = 0, trail = null) {
    await tween(dur, k => {
      obj.position.lerpVectors(a, b, k);
      obj.position.y = a.y + (b.y - a.y) * k + Math.sin(k * Math.PI) * h;
      if (spin) obj.rotation.z = k * spin;
      if (trail && Math.random() < 0.7) V.burst(obj.position.x, obj.position.y, obj.position.z, 1, { color: trail, up: 0.3, speed: 0.4, g: 0, life: 0.35, size: 0.3, spread: 0.1, h: 0 });
    });
  }
  V.unitRec = id => V.units.get(id);
  const _hv = new THREE.Vector3(), _pv = new THREE.Vector3();
  // 目標快出畫面時才把鏡頭滑過去（不打擾玩家自己的視角）
  function keepInView(pos, m = 0.6) {
    _pv.copy(pos).project(camera);
    if (_pv.z > 1 || Math.abs(_pv.x) > m || Math.abs(_pv.y) > m) {
      const d = Math.hypot(pos.x - cam.ftx, pos.z - cam.ftz);
      cam.glide = { ax: cam.ftx, az: cam.ftz, bx: pos.x, bz: pos.z, t: 0, dur: Math.min(0.9, 0.38 + d * 0.025) / Math.max(1, V.speed * 0.7) };
    }
  }
  function handPos(rec, arm, out) {
    const a = rec.parts[arm];
    if (rec.parts.weapon && arm === rec.atkArm && rec.parts.weapon.isObject3D) return rec.parts.weapon.getWorldPosition(out);
    if (a) return a.localToWorld(out.set(0, -0.5 * Math.min(1.4, rec.H / 1.8), 0));
    return out.copy(rec.holder.position).setY(rec.holder.position.y + rec.H * 0.6);
  }

  // ── 事件演出 ──
  const BOOM = {
    fire:   { color: [0xff5a1f, 0xffc531, 0xff2a00], n: 70, up: 6, speed: 5 },
    reveal: { color: [0xff7ac8, 0x6fd3ff, 0xffffff], n: 120, up: 9, speed: 7 },
    vape:   { color: [0xcfffb0, 0xa8ffcf, 0xe8ffe0], n: 80, up: 1.2, speed: 3, g: 0.5, life: 1.8, size: 0.9, drag: 2 },
    slam:   { color: [0xffe0b0, 0xc9a37a, 0xffffff], n: 60, up: 3, speed: 8, flat: 1.4 },
    sludge: { color: [0x3a7cff, 0x1a3c9f, 0x7cc0ff], n: 70, up: 6, speed: 4 },
    geyser: { color: [0xffffff, 0xf2efe6, 0xc9e8ff], n: 160, up: 14, speed: 2.5, life: 1.4, size: 0.5 },
    drone:  { color: [0xc8a070, 0x8a6a40, 0xffffff], n: 50, up: 4, speed: 5 },
    hammer: { color: [0x8a1a0a, 0xc2280e, 0xffc531], n: 90, up: 5, speed: 8, flat: 1.5 },
    zap:    { color: [0x4af0ff, 0xffffff, 0x9dff4a], n: 60, up: 5, speed: 6, size: 0.25 },
    heal:   { color: [0x9dff7a, 0xffffff, 0xc0ffd8], n: 40, up: 3, speed: 1.5, g: 2, life: 1.2 },
    oil:    { color: [0xffc531, 0xff5a1f, 0x7a4a10], n: 120, up: 6, speed: 6 },
    drop:   { color: [0xfff2a0, 0xffffff, 0xff4a6a], n: 90, up: 5, speed: 6 },
    soda:   { color: [0xc9e8ff, 0xffffff, 0x6fb8ff], n: 50, up: 4, speed: 4 },
    sugar:  { color: [0xff7ad0, 0xffe36a, 0xffffff], n: 60, up: 4, speed: 5 },
    psy:    { color: [0xff2a8a, 0xb48cff, 0xffffff], n: 60, up: 4, speed: 5 },
  };
  const BOOM_SHAKE = { fire: 0.5, reveal: 0.9, slam: 0.7, hammer: 1.2, drop: 0.7, oil: 0.6, geyser: 0.6, sludge: 0.4, zap: 0.4 };

  V.play = async (events, ui) => {
    for (const e of events) {
      try { await playOne(e, ui); } catch (err) { console.warn('fx', e.t, err); }
    }
  };
  async function playOne(e, ui) {
    const s = V.s;
    switch (e.t) {
      case 'move': {
        const rec = V.units.get(e.id);
        if (rec && e.path.length > 1) await animMove(rec, e.path);
        break;
      }
      case 'tele': {
        const rec = V.units.get(e.id); if (!rec) break;
        const a = rec.holder.position.clone(), b = tilePos(e.x, e.z);
        if (e.leap) {
          rec.yaw = Math.atan2(b.x - a.x, b.z - a.z);
          await tween(120, k => { rec.sqT = -0.18 * k; });
          rec.sqT = 0; rec.sqV += 3;
          await arc(rec.holder, a, b, 520, 5);
          rec.sqV -= 4.5; V.shake = Math.max(V.shake, 0.8); V.burst(b.x, b.y, b.z, 40, BOOM.slam); V.ripple(e.x, e.z, 0xffffff, { r: 3, life: 0.6, quiet: true });
        } else if (e.thrown) { await arc(rec.holder, a, b, 420, 3); rec.sqV -= 3.5; dust(b, 8); }
        else if (e.mist) {
          V.burst(a.x, a.y + 0.8, a.z, 40, { color: [0x8fffd0, 0xc0fff0], up: 1, g: 1, speed: 1.5, life: 1, size: 0.6 });
          await tween(160, k => { rec.sc = 1 - k * 0.95; });
          rec.holder.position.copy(b);
          V.burst(b.x, b.y + 0.8, b.z, 40, { color: [0x8fffd0, 0xc0fff0], up: 1, g: 1, speed: 1.5, life: 1, size: 0.6 });
          await tween(160, k => { rec.sc = 0.05 + k * 0.95; });
          rec.sc = 1; rec.sqV += 2;
        } else { await tween(200, k => rec.holder.position.lerpVectors(a, b, ease(k))); }
        break;
      }
      case 'face': { const rec = V.units.get(e.id); if (rec) rec.yaw = Math.atan2(rec.u.f[0], rec.u.f[1]); break; }
      case 'attack': await animAttack(e); break;
      case 'yeet': await animYeet(e); break;
      case 'roll': if (ui) await ui.showRoll(e); break;
      case 'dmg': {
        const rec = V.units.get(e.id); if (!rec) break;
        const p = rec.holder.position;
        // 受擊方向：來自最近一次攻擊者
        if (V.lastAtk && V.lastAtk.id !== e.id) rec.hitDir.copy(p).sub(V.lastAtk.pos).setY(0);
        else rec.hitDir.set(-Math.sin(rec.curYaw), 0, -Math.cos(rec.curYaw));
        if (rec.hitDir.lengthSq() < 1e-4) rec.hitDir.set(0, 0, 1);
        rec.hitDir.normalize();
        rec.hitT = 1; rec.flashK = 'hit'; rec.flashT = 0; rec.sqV -= e.crit ? 2.6 : 1.6;
        if (V.lastAtk) { rec.lookAt = V.lastAtk.pos.clone(); rec.lookUntil = V.time + 1.2; }
        V.floatText(rec.u.x, rec.u.z, '−' + e.amt, e.crit ? 'dmg crit' : 'dmg');
        V.burst(p.x, p.y + rec.H * 0.55, p.z, e.crit ? 34 : 14, { color: [0xff3b4a, 0xffffff, 0xffd23f], up: 3, speed: e.crit ? 5 : 3, size: 0.25 });
        if (e.crit) {
          V.hitStop = 0.14; cam.punch = 1; V.shake = Math.max(V.shake, 1.3);
          V.ripple(rec.u.x, rec.u.z, 0xffd23f, { r: 2.2, life: 0.45, quiet: true });
        } else V.shake = Math.max(V.shake, 0.25);
        SFX.play('hit');
        updatePlate(rec);
        if (ui) ui.refresh();
        await wait(e.crit ? 420 : 260);
        break;
      }
      case 'heal': {
        const rec = V.units.get(e.id); if (!rec) break;
        if (e.amt > 0) V.floatText(rec.u.x, rec.u.z, '+' + e.amt, 'heal');
        const p = rec.holder.position;
        V.burst(p.x, p.y + 0.6, p.z, 24, BOOM.heal);
        sparkle(_hv.copy(p).setY(p.y + 0.2), 12, [0x9dff7a, 0xffffff], 4);
        rec.flashK = 'heal'; rec.flashT = 0; rec.sqV += 1.8;
        updatePlate(rec);
        if (ui) ui.refresh();
        await wait(200);
        break;
      }
      case 'float': {
        // 閃過：目標側身閃避
        if (e.cls === 'miss') {
          const x = Math.round(e.x), z = Math.round(e.z);
          for (const r of V.units.values()) if (r.u.x === x && r.u.z === z && !r.dead) { r.dodgeT = 1; r.dodgeS = Math.random() < 0.5 ? -1 : 1; break; }
        }
        V.floatText(Math.round(e.x), Math.round(e.z), e.text, e.cls); await wait(e.cls === 'crit' || e.cls === 'react' ? 420 : 160); break;
      }
      case 'status': { const rec = V.units.get(e.id); if (rec) updatePlate(rec); if (ui) ui.refresh(); break; }
      case 'down': {
        const rec = V.units.get(e.id); if (!rec) break;
        updatePlate(rec);
        // 膝蓋一軟→倒地→彈一下
        rec.lyingLock = true;
        const l0 = rec.lying;
        await tween(150, k => { rec.sqT = -0.16 * k; });
        await tween(260, k => { rec.lying = l0 + (1 - l0) * k * k; });
        rec.lying = rec.lyingT = 1; rec.lyingLock = false; rec.sqT = 0; rec.sqV -= 3;
        dust(rec.holder.position, 10, 1.3); V.shake = Math.max(V.shake, 0.3);
        if (!rec.siren) {
          const sr = group(sphere(0.16, 0xff2030, -0.18, 0, 0, { mat: flat(0xff2030) }), sphere(0.16, 0x2050ff, 0.18, 0, 0, { mat: flat(0x2050ff) }));
          sr.position.y = 1.4; rec.holder.add(sr); rec.siren = sr;
        }
        await wait(160);
        break;
      }
      case 'revive': {
        const rec = V.units.get(e.id); if (!rec) break;
        if (rec.siren) { rec.holder.remove(rec.siren); rec.siren = null; }
        updatePlate(rec);
        // 跳起來轉一圈＋亮晶晶
        rec.lyingLock = true;
        const p = rec.holder.position;
        sparkle(_hv.copy(p).setY(p.y + 0.3), 24, [0xffe36a, 0xffffff, 0x9dff7a], 5);
        rec.flashK = 'heal'; rec.flashT = 0;
        await tween(420, k => { rec.lying = 1 - eOut(clamp01(k * 1.6)); rec.popY = Math.sin(k * Math.PI) * 0.9; rec.spin = eIO(k) * Math.PI * 2; });
        rec.lying = rec.lyingT = 0; rec.lyingLock = false; rec.popY = 0; rec.spin = 0; rec.sqV -= 3;
        dust(p, 6);
        break;
      }
      case 'die': {
        const rec = V.units.get(e.id); if (!rec) break;
        rec.dead = true; rec.walk = 0;
        if (rec.plate) rec.plate.style.opacity = '0';
        const p = rec.holder.position.clone();
        const dir = rec.lying > 0.5 ? 1 : -1;
        // 踉蹌→倒下（重力）→彈跳→沉下並縮小冒煙
        rec.lyingLock = true;
        await tween(170, k => { rec.topple = dir * 0.28 * eOut(k); rec.sqT = -0.1 * k; });
        await tween(260, k => { rec.topple = dir * (0.28 + 1.27 * k * k); });
        rec.sqT = 0; rec.sqV -= 3; V.shake = Math.max(V.shake, 0.35);
        dust(p, 12, 1.4);
        await tween(200, k => { rec.topple = dir * (1.55 - Math.sin(k * Math.PI) * 0.22); });
        V.burst(p.x, p.y + 0.5, p.z, 50, { color: [0xffffff, 0xffd23f, 0xff6b2c], up: 5, speed: 4 });
        V.burst(p.x, p.y + 0.3, p.z, 24, { color: [0xd8d0c8, 0xffffff, 0xa89a8a], up: 1.5, speed: 1.6, g: 1.5, life: 1.1, size: 0.8, drag: 2.5, spread: 1 });
        await tween(320, k => { rec.sink = k * k * 1.2; rec.sc = 1 - 0.55 * k; });
        removeUnit(e.id);
        if (ui) ui.refresh();
        break;
      }
      case 'gone': await animAmbulance(e.id); if (ui) ui.refresh(); break;
      case 'surf': for (const [x, z, ty] of e.cells) setSurfMesh(x, z, ty); break;
      case 'prop': {
        const g = V.props.get(e.pid);
        const p = s.props.find(q => q.id === e.pid);
        if (e.added && p) {
          const ng = addPropMesh(p);
          if (ng) { const y0 = ng.position.y; await tween(260, k => { ng.position.y = y0 + (1 - eOut(k)) * 4; }); dust(ng.position, 8); }
          break;
        }
        if (!g) break;
        if (e.gone) {
          const pos = g.position.clone();
          if (p && (p.type === 'chandelier' || p.type === 'toyball')) {
            const y0 = g.position.y;
            await tween(380, k => { g.position.y = y0 - k * k * 3; });
          } else await tween(120, k => { g.scale.set(1 + k * 0.25, 1 - k * 0.3, 1 + k * 0.25); });
          V.burst(pos.x, pos.y + 0.8, pos.z, 40, { color: [0x9a8a7a, 0xffffff, 0x5a4a3a], up: 5, speed: 4 });
          dust(pos, 10, 1.5);
          world.remove(g); freeTree(g); V.props.delete(e.pid);
        } else if (e.moved && p) {
          g.position.set(W(p.x), topY(s.grid[p.z][p.x].h), W(p.z));
        }
        break;
      }
      case 'boom': {
        const b = tilePos(Math.round(e.x), Math.round(e.z));
        const cx = W(e.x), cz = W(e.z);
        const cfg = BOOM[e.kind] || BOOM.fire;
        if (e.kind === 'drone') await animDrone(cx, b.y, cz);
        if (e.kind === 'hammer' && V.hammer) await animHammer();
        V.burst(cx, b.y + 0.3, cz, Math.round(cfg.n * Math.min(2, 0.6 + (e.r || 1) * 0.4)), Object.assign({ spread: (e.r || 1) * TILE * 0.8 }, cfg));
        if (e.kind === 'geyser') V.burst(cx, b.y, cz, 80, { color: [0xffffff, 0xeef6ff], up: 18, speed: 1, life: 1.6, size: 0.7, spread: 0.6 });
        if (e.kind === 'reveal') V.burst(cx, b.y + 4, cz, 80, { color: [0xff7ac8, 0x6fd3ff], up: 3, speed: 6, g: -2, life: 1.6, size: 0.5 });
        if (BOOM_SHAKE[e.kind]) V.shake = Math.max(V.shake, BOOM_SHAKE[e.kind]);
        V.ripple(e.x, e.z, Array.isArray(cfg.color) ? cfg.color[0] : 0xffffff, { r: ((e.r || 1) + 0.5) * TILE, life: 0.6, quiet: true });
        await wait(260);
        break;
      }
      case 'push': {
        const rec = V.units.get(e.id); if (!rec) break;
        const path = e.path;
        rec.pushed = 1;
        for (let i = 1; i < path.length; i++) {
          const a = tilePos(...path[i - 1]), b = tilePos(...path[i]);
          await tween(130, k => {
            rec.holder.position.x = a.x + (b.x - a.x) * k; rec.holder.position.z = a.z + (b.z - a.z) * k;
            rec.holder.position.y = b.y < a.y ? a.y + (b.y - a.y) * k * k : a.y;
          });
          if (i % 1 === 0) dust(rec.holder.position, 3, 0.8);
        }
        rec.pushed = 0;
        rec.sqV -= e.fall ? 4.5 : 2;
        if (e.fall) { V.shake = Math.max(V.shake, 0.6); const p = rec.holder.position; V.burst(p.x, p.y, p.z, 30, BOOM.slam); }
        break;
      }
      case 'shake': V.shake = Math.max(V.shake, 0.4 * e.power); break;
      case 'sfx': SFX.play(e.name); break;
      case 'phase2': {
        const rec = V.units.get(e.id); if (!rec) break;
        const p = rec.holder.position.clone();
        V.burst(p.x, p.y + 1.5, p.z, 120, { color: [0x9dff4a, 0xffffff, 0x3fd17a], up: 6, speed: 6 });
        V.shake = Math.max(V.shake, 1);
        world.remove(rec.holder); freeTree(rec.model); rec.plate.remove(); V.units.delete(e.id); V.plates.delete(e.id);
        const nr = addUnitMesh(rec.u);
        nr.active = rec.active;
        nr.sc = 0.3;
        await tween(500, k => { nr.sc = 0.3 + 0.7 * eOut(k) + Math.sin(k * Math.PI) * 0.15; });
        nr.sc = 1; nr.sqV -= 3;
        break;
      }
      case 'turn': {
        V.setActive(e.id);
        V.focusUnit(e.id, { smooth: true });
        break;
      }
      case 'round': if (ui) ui.round(e.n); break;
      case 'log': if (ui) ui.log(e.text, e.cls); break;
      case 'over': break;
    }
  }

  async function animAttack(e) {
    const rec = V.units.get(e.id); if (!rec) return;
    const tgt = e.tid ? V.units.get(e.tid) : null;
    const from = rec.holder.position.clone();
    const to = tgt ? tgt.holder.position.clone() : e.at ? tilePos(e.at[0], e.at[1]) : from.clone();
    if (tgt || e.at) rec.yaw = Math.atan2(to.x - from.x, to.z - from.z);
    V.lastAtk = { id: e.id, pos: from.clone() };
    if (to.distanceToSquared(from) > 0.01) { _pv.copy(to).project(camera); if (_pv.z > 1 || Math.abs(_pv.x) > 0.7 || Math.abs(_pv.y) > 0.7) keepInView(to.clone().add(from).multiplyScalar(0.5), 0); }
    rec.lookAt = to.clone(); rec.lookUntil = V.time + 99;
    if (tgt && tgt !== rec) { tgt.lookAt = from.clone(); tgt.lookUntil = V.time + 1.5; }
    const k0 = e.kind;
    const mode = k0 === 'melee' ? 'melee' : k0 === 'shove' ? 'shove' : k0 === 'help' ? 'help' : k0 === 'throw' ? 'throw'
      : k0 === 'ranged' ? (rec.u.key === 'chad' ? 'throw' : 'ranged') : k0 === 'aoe' ? 'cast' : (k0 === 'power' && e.icon === '🧠') ? 'cast' : 'heal';
    rec.mode = mode; rec.wind = 0; rec.strike = 0;
    const hc = mode === 'heal' ? [0x9dff7a, 0xffffff, 0xffe36a] : mode === 'cast' ? [0xffd23f, 0xff7ac8, 0xffffff] : [0xffffff, 0xffe9a8];
    const glow = (n = 1) => {
      for (const arm of mode === 'ranged' || mode === 'throw' ? [rec.atkArm] : ['armL', 'armR']) {
        handPos(rec, arm, _hv);
        V.burst(_hv.x, _hv.y, _hv.z, n, { color: hc, up: 0.8, speed: 0.7, g: 0.6, life: 0.45, size: 0.3, spread: 0.15, h: 0.05 });
      }
    };
    try {
      if (mode === 'melee' || mode === 'shove' || mode === 'help') {
        const dir = to.clone().sub(from).setY(0);
        if (dir.lengthSq() > 1e-4) dir.normalize(); dir.multiplyScalar(mode === 'help' ? 0.25 : 0.75);
        // 預備動作
        await tween(mode === 'help' ? 140 : 160, k => { rec.wind = eOut(k); rec.sqT = -0.1 * k; rec.holder.position.copy(from).addScaledVector(dir, -0.18 * k); });
        if (mode !== 'help') SFX.play(mode === 'shove' ? 'tackle' : 'slam');
        rec.sqT = 0; rec.sqV += 1.5;
        // 出手＋衝刺
        await tween(110, k => {
          rec.strike = eOut(k);
          rec.holder.position.copy(from).addScaledVector(dir, -0.18 + 1.18 * eOut(k));
          if (mode !== 'help') { handPos(rec, rec.atkArm, _hv); V.burst(_hv.x, _hv.y, _hv.z, 1, { color: [0xffffff, 0xfff2c0], up: 0, speed: 0.3, g: 0, life: 0.22, size: 0.35, spread: 0.05, h: 0 }); }
        });
        if (mode !== 'help' && tgt) { const tp = tgt.holder.position; V.burst(tp.x, tp.y + tgt.H * 0.55, tp.z, 10, { color: [0xffffff, 0xffd23f], up: 2.5, speed: 4, size: 0.22, life: 0.35 }); }
        // 收招
        await tween(200, k => { rec.wind = 1 - eOut(k); rec.strike = 1 - eOut(k); rec.holder.position.copy(from).addScaledVector(dir, 1 - eOut(k)); });
        rec.holder.position.copy(from);
      } else if (mode === 'ranged' || mode === 'throw' || (mode === 'cast' && !(k0 === 'aoe' && e.leap))) {
        const charge = mode === 'cast' ? 230 : 160;
        await tween(charge, k => { rec.wind = eOut(k); if (mode === 'cast') glow(1); });
        handPos(rec, rec.atkArm, _hv);
        const a = mode === 'cast' ? from.clone().setY(from.y + rec.H * 0.9) : _hv.clone();
        if (!(a.y > from.y)) a.copy(from).setY(from.y + 1.3);
        const b = to.clone(); b.y += tgt ? tgt.H * 0.55 : 0.3;
        const sp = emojiSprite(e.icon || (mode === 'cast' ? '💥' : '✦'), mode === 'cast' ? 1.1 : 0.8);
        fxRoot.add(sp);
        SFX.play('miss');
        rec.sqV += 1.2;
        const lob = mode === 'throw' || mode === 'cast';
        const fly = arc(sp, a, b, mode === 'cast' ? 420 : 300 + a.distanceTo(b) * 14, mode === 'cast' ? 4 : lob ? 2.4 : 0.4, 0, hc);
        await tween(120, k => { rec.strike = eOut(k); });
        await fly;
        fxRoot.remove(sp);
        V.burst(b.x, b.y, b.z, 14, { color: [0xffffff, 0xffd23f], up: 2, speed: 3, size: 0.25 });
        await tween(150, k => { rec.wind = 1 - k; rec.strike = 1 - k; });
      } else if (mode === 'cast') {
        // 跳躍型範圍技：蹲低蓄力
        await tween(160, k => { rec.wind = eOut(k); rec.sqT = -0.15 * k; });
        rec.sqT = 0; rec.wind = 0;
      } else {
        // 補血／自我強化：雙手高舉
        await tween(200, k => { rec.wind = eOut(k); glow(1); });
        const p = rec.holder.position;
        V.burst(p.x, p.y + rec.H * 0.9, p.z, 20, { color: [0xffd23f, 0xffffff], up: 2, speed: 2, g: 1, size: 0.3 });
        rec.flashK = 'buff'; rec.flashT = 0; rec.sqV += 2.4;
        await wait(120);
        await tween(160, k => { rec.wind = 1 - k; });
      }
    } finally {
      rec.mode = null; rec.wind = 0; rec.strike = 0; rec.sqT = 0;
      rec.lookUntil = V.time + 0.8;
    }
  }

  async function animYeet(e) {
    const rec = V.units.get(e.id); if (!rec) return;
    const a = rec.holder.position.clone(); a.y += 1.6;
    const b = tilePos(e.to[0], e.to[1]); b.y += 0.8;
    let obj, urec = null;
    if (e.pid && V.props.get(e.pid)) { obj = V.props.get(e.pid); }
    else if (e.uid && V.units.get(e.uid)) { urec = V.units.get(e.uid); obj = urec.holder; }
    if (!obj) return;
    rec.yaw = Math.atan2(b.x - a.x, b.z - a.z);
    rec.mode = 'throw'; rec.lookAt = b.clone(); rec.lookUntil = V.time + 2;
    try {
      await tween(150, k => { rec.wind = eOut(k); rec.sqT = -0.08 * k; });
      rec.sqT = 0; rec.sqV += 1.6;
      SFX.play('miss');
      const fly = arc(obj, a, b, 480, 3.5, 6);
      await tween(130, k => { rec.strike = eOut(k); });
      await fly;
      obj.rotation.z = 0;
      if (urec) urec.sqV -= 3.5;
      await tween(140, k => { rec.wind = 1 - k; rec.strike = 1 - k; });
    } finally { rec.mode = null; rec.wind = 0; rec.strike = 0; obj.rotation.z = 0; }
    V.burst(b.x, b.y, b.z, 20, BOOM.slam);
    dust(b.clone().setY(b.y - 0.8), 8, 1.2);
  }

  async function animDrone(x, y, z) {
    const crate = box(1.8, 1.8, 1.8, 0xc8a070, x, y + 14, z);
    const tape = box(1.84, 0.25, 1.84, 0x3a7cff, 0, 0.3, 0);
    crate.add(tape);
    fxRoot.add(crate);
    SFX.play('drone');
    await tween(520, k => { crate.position.y = y + 14 - k * k * 13.1; crate.rotation.y = k * 2; });
    V.shake = 1.2;
    await tween(160, k => crate.scale.set(1 + Math.sin(k * Math.PI) * 0.2, 1 - Math.sin(k * Math.PI) * 0.25, 1 + Math.sin(k * Math.PI) * 0.2));
    await wait(240);
    await tween(300, k => crate.scale.setScalar(1 - k));
    fxRoot.remove(crate);
  }
  async function animHammer() {
    const hm = V.hammer; if (!hm) return;
    const y0 = hm.position.y;
    await tween(220, k => { hm.position.y = y0 + k * 1.5; });
    await tween(180, k => { hm.position.y = y0 + 1.5 - k * k * 6.2; });
    V.shake = 2; cam.punch = 0.8;
    await wait(300);
    await tween(500, k => { hm.position.y = y0 - 4.7 + k * 4.7; });
  }
  async function animAmbulance(id) {
    const rec = V.units.get(id); if (!rec) return;
    const p = rec.holder.position.clone();
    const amb = group(
      box(3.2, 1.6, 1.7, 0xffffff, 0, 1.05, 0), box(1.1, 1.0, 1.66, 0xffffff, 1.9, 0.75, 0),
      box(3.22, 0.28, 1.72, 0xe23b2e, 0, 1.1, 0), box(0.5, 0.18, 0.18, 0xe23b2e, -0.2, 1.4, 0.87, { outline: false }), box(0.18, 0.5, 0.18, 0xe23b2e, -0.2, 1.4, 0.87, { outline: false }),
      cyl(0.36, 0.36, 0.3, 0x222222, -1.0, 0.36, 0.8), cyl(0.36, 0.36, 0.3, 0x222222, 1.2, 0.36, 0.8), cyl(0.36, 0.36, 0.3, 0x222222, -1.0, 0.36, -0.8), cyl(0.36, 0.36, 0.3, 0x222222, 1.2, 0.36, -0.8),
      sphere(0.18, 0xff2030, -0.6, 1.95, 0.3, { mat: flat(0xff2030) }), sphere(0.18, 0x2050ff, -0.6, 1.95, -0.3, { mat: flat(0x2050ff) }),
    );
    amb.children.slice(5, 9).forEach(w => (w.rotation.x = Math.PI / 2));
    amb.position.set(-8, p.y, p.z);
    fxRoot.add(amb);
    await tween(700, k => { amb.position.x = -8 + (p.x - 1 + 8) * ease(k); amb.rotation.z = Math.sin(k * Math.PI * 6) * 0.02; });
    await tween(140, k => { amb.rotation.z = -Math.sin(k * Math.PI) * 0.06; });
    removeUnit(id);
    await wait(250);
    V.floatText(Math.round((p.x - 1) / 2), Math.round((p.z - 1) / 2), '🧾 $50,000 USD', 'bad');
    await tween(700, k => { amb.position.x = p.x - 1 + k * k * 40; if (Math.random() < 0.5) dust(_hv.set(amb.position.x - 1.6, p.y, p.z), 1); });
    fxRoot.remove(amb);
  }
  function removeUnit(id) {
    const rec = V.units.get(id); if (!rec) return;
    world.remove(rec.holder); freeTree(rec.model);
    rec.plate.remove();
    V.units.delete(id); V.plates.delete(id);
    if (V.hoverId === id) V.hoverId = null;
    if (tgtRec === rec) { tgtRec = null; tgtMark.visible = false; }
  }

  // ── 過場與互動演出 ──
  let introAnim = null;
  // 開場：鏡頭由高空斜繞進棋盤、單位依序從天而降
  V.intro = (level) => {
    if (!V.s) return Promise.resolve();
    canvas.style.filter = '';
    const n = typeof level === 'number' ? level : (V.s.L && V.s.L.n) || 1;
    const end = { yaw: cam.yawT, dist: cam.distT, pitch: 0.92 };
    const st = { yaw: end.yaw + (n % 2 ? -1.15 : 1.15), dist: end.dist * 1.85, pitch: 1.3 };
    cam.glide = null; cam.ftx = cam.tx = 12; cam.ftz = cam.tz = 12;
    const recs = [...V.units.values()].sort((a, b) => (a.u.side === 'hero') - (b.u.side === 'hero') || a.u.z - b.u.z);
    recs.forEach((r, i) => { r.drop = { d: 0.28 + 0.5 * (recs.length > 1 ? i / (recs.length - 1) : 0), landed: false }; r.dropY = 12; r.hidden = true; });
    const apply = (k) => {
      const e = eOut(k);
      cam.yaw = cam.yawT = st.yaw + (end.yaw - st.yaw) * e;
      cam.dist = cam.distT = st.dist + (end.dist - st.dist) * e;
      cam.pitch = cam.pitchT = st.pitch + (end.pitch - st.pitch) * e;
      cam.ftx = cam.tx = 12; cam.ftz = cam.tz = 12;
      for (const r of recs) {
        if (!r.drop) continue;
        const p = clamp01((k - r.drop.d) / 0.2);
        r.hidden = p <= 0;
        r.dropY = (1 - p) * (1 - p) * 12;
        if (p >= 1 && !r.drop.landed) {
          r.drop.landed = true; r.sqV -= 4; r.dropY = 0;
          if (k < 0.999) { dust(r.holder.position, 8, 1.2); V.ripple(r.u.x, r.u.z, r.u.side === 'hero' ? 0x29e0c9 : 0xff6a5a, { r: 1.4, life: 0.45, quiet: true }); }
        }
      }
    };
    apply(0);
    return new Promise(res => {
      const a = {
        t: 0, dur: 2200 / V.speed, fn: apply,
        res: () => {
          for (const r of recs) { r.drop = null; r.dropY = 0; r.hidden = false; }
          cam.yawT = cam.yaw = end.yaw; cam.distT = cam.dist = end.dist; cam.pitch = cam.pitchT = end.pitch;
          if (introAnim === a) introAnim = null;
          res();
        },
      };
      introAnim = a;
      V.anims.push(a);
    });
  };
  V.skipIntro = () => { if (introAnim) introAnim.t = introAnim.dur; };
  // 勝利舞／敵方嘲諷
  V.celebrate = (side = 'hero') => {
    if (!V.s) return Promise.resolve();
    const hero = side === 'hero';
    const recs = [...V.units.values()].filter(r => !r.dead && R.alive(r.u) && !r.u.downed && (hero ? r.u.side === 'hero' : r.u.side !== 'hero'));
    if (!recs.length) return wait(300);
    let cx = 0, cz = 0;
    for (const r of recs) { cx += r.holder.position.x; cz += r.holder.position.z; }
    cx /= recs.length; cz /= recs.length;
    cam.glide = { ax: cam.ftx, az: cam.ftz, bx: cx, bz: cz, t: 0, dur: 0.6 / V.speed };
    cam.dMulT = 0.8;
    recs.forEach((r, i) => { r.cele = { t0: V.time, ph: i * 0.55, hero }; r.yaw = Math.atan2(camera.position.x - r.holder.position.x, camera.position.z - r.holder.position.z); });
    let lastC = -1;
    return tween(1600, k => {
      for (const r of recs) {
        r.celeW = Math.min(1, k * 6, (1 - k) * 6);
        if (hero) r.spin = k > 0.35 && k < 0.65 ? eIO((k - 0.35) / 0.3) * Math.PI * 2 : 0;
      }
      const step = Math.floor(k * 5);
      if (step !== lastC && step < 5) {
        lastC = step;
        for (const r of recs) {
          const p = r.holder.position;
          if (hero) V.burst(p.x, p.y + r.H + 1.2, p.z, 14, { color: [0xff3b4a, 0xffd23f, 0x29e0c9, 0xff7ac8, 0x6dff7a], up: 3, speed: 3.5, g: -3, life: 1.3, size: 0.28, drag: 2, spread: 0.6 });
          else V.burst(p.x, p.y + r.H, p.z, 6, { color: [0xff2a4a, 0x1b1226], up: 2, speed: 2, g: -2, life: 0.8, size: 0.3 });
        }
      }
    }).then(() => {
      for (const r of recs) { r.cele = null; r.celeW = 0; r.spin = 0; }
      cam.dMulT = 1;
    });
  };
  // 關卡結束：鏡頭拉遠＋畫面變暗
  V.outro = () => {
    cam.dMulT = 1.4; cam.pitchT = 1.12; cam.yOffT += 0.45;
    return tween(800, k => {
      const e = eOut(k);
      canvas.style.filter = `brightness(${(1 - 0.42 * e).toFixed(3)}) saturate(${(1 - 0.3 * e).toFixed(3)})`;
    });
  };

  // ── 縮圖（頭像）──
  V.portrait = (key, size = 160) => {
    const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xffffff, 0x886655, 2.0));
    const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(2, 3, 4); sc.add(dl);
    const m = buildUnit(key);
    sc.add(m);
    const h = m.userData.height || 1.8;
    const pc = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
    const headY = h * 0.78;
    pc.position.set(h * 0.25, headY + h * 0.06, h * 1.15);
    pc.lookAt(0, headY - h * 0.02, 0);
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(sc, pc);
    const buf = new Uint8Array(size * size * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
    renderer.setRenderTarget(null);
    rt.dispose();
    freeTree(m);
    const c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) img.data.set(buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  };

  // ── 單位每幀動畫（唯一寫入模型變形的地方）──
  function ad(O, k, rx, ry = 0, rz = 0, px = 0, py = 0, pz = 0) {
    const o = O[k]; if (!o) return;
    o[0] += rx; o[1] += ry; o[2] += rz; o[3] += px; o[4] += py; o[5] += pz;
  }
  let activeRec = null;
  function animateUnit(rec, dt) {
    const P = rec.parts, O = rec.O, u = rec.u, model = rec.model;
    const t = V.time + rec.phase, H = rec.H, hs = Math.min(1.5, H / 1.8);
    for (const k in O) { const o = O[k]; o[0] = o[1] = o[2] = o[3] = o[4] = o[5] = 0; }
    const lw = (cur, tgt, rate) => cur + (tgt - cur) * Math.min(1, dt * rate);
    rec.walkW = lw(rec.walkW, rec.walk ? 1 : 0, 12);
    rec.activeW = lw(rec.activeW, rec.active && !u.downed && !rec.mode ? 1 : 0, 6);
    rec.hoverW = lw(rec.hoverW, V.hoverId === u.id && !rec.dead ? 1 : 0, 10);
    if (!rec.lyingLock) rec.lying = lw(rec.lying, rec.lyingT, 8);
    rec.curYaw += wrapA(rec.yaw - rec.curYaw) * Math.min(1, dt * 12);
    const L = rec.lying, up = 1 - L;
    let my = 0, mx = 0, mz = 0, sqX = 0;

    // 呼吸
    const br = Math.sin(t * 2.1);
    ad(O, 'body', 0.025 * br * up, 0, 0, 0, 0.008 * br * up);
    ad(O, 'armL', 0.03 * br, 0, 0.05 + 0.03 * br);
    ad(O, 'armR', 0.03 * br, 0, -0.05 - 0.03 * br);

    // 頭部：看目標／被懸停時看鏡頭／其他人偶爾看行動者
    let lt = null, hp = 0;
    if (rec.lookAt && V.time < rec.lookUntil) lt = rec.lookAt;
    else if (rec.hoverW > 0.4) { lt = camera.position; hp = -0.22; }
    else if (rec.active && V.hoverId != null && V.hoverId !== u.id) { const hr = V.units.get(V.hoverId); if (hr) lt = hr.holder.position; }
    else if (!rec.active && activeRec && activeRec !== rec && ((t * 0.11) % 1) < 0.45) lt = activeRec.holder.position;
    let hy = Math.sin(t * 0.41) * 0.3 + Math.sin(t * 1.13) * 0.08;
    if (lt) hy = clampA(wrapA(Math.atan2(lt.x - rec.holder.position.x, lt.z - rec.holder.position.z) - rec.curYaw), 0.8);
    rec.hy = lw(rec.hy, hy * up, 5); rec.hp = lw(rec.hp, hp, 5);
    ad(O, 'head', rec.hp + Math.sin(t * 0.9) * 0.03, rec.hy);
    ad(O, 'body', 0, rec.hy * 0.18);

    // 走路
    if (rec.walk) {
      const rate = Math.min(36, Math.PI / (0.17 / V.speed));
      rec.walkPh += dt * rate;
    }
    const wW = rec.walkW, ws = Math.sin(rec.walkPh), wc = Math.cos(rec.walkPh);
    if (wW > 0.01) {
      ad(O, 'legL', ws * 0.75 * wW); ad(O, 'legR', -ws * 0.75 * wW);
      ad(O, 'armL', -ws * 0.6 * wW); ad(O, 'armR', ws * 0.6 * wW);
      ad(O, 'forearmL', -0.35 * wW); ad(O, 'forearmR', -0.35 * wW);
      ad(O, 'body', 0.1 * wW, ws * 0.09 * wW, 0, 0, Math.abs(wc) * 0.02 * wW);
      ad(O, 'head', -0.06 * wW, -ws * 0.07 * wW);
      my += Math.abs(wc) * 0.06 * wW * hs;
      const sg = ws >= 0;
      if (rec.walk && sg !== rec.stepSg) { rec.stepSg = sg; dust(rec.holder.position, 3, 0.8); }
    }

    // 輪到行動：準備姿勢＋原地小跳
    const aw = rec.activeW * (1 - wW) * up;
    if (aw > 0.01) {
      const bob = Math.abs(Math.sin(V.time * 4.2));
      my += bob * 0.06 * aw;
      sqX += aw * (bob * 0.045 - 0.022);
      ad(O, 'armL', -0.22 * aw, 0, 0.06 * aw); ad(O, 'armR', -0.22 * aw, 0, -0.06 * aw);
      ad(O, 'forearmL', -0.4 * aw); ad(O, 'forearmR', -0.4 * aw);
      ad(O, 'body', 0.06 * aw);
    }

    // 攻擊姿勢
    if (rec.mode) {
      const wd = rec.wind, sk = rec.strike, A = rec.atkArm, B = A === 'armR' ? 'armL' : 'armR', sd = A === 'armR' ? -1 : 1;
      const FA = A === 'armR' ? 'forearmR' : 'forearmL', LA = A === 'armR' ? 'legR' : 'legL', LB = A === 'armR' ? 'legL' : 'legR';
      switch (rec.mode) {
        case 'melee':
          ad(O, A, -2.5 * wd + 1.75 * sk, 0, sd * 0.25 * wd); ad(O, B, -0.5 * wd + 0.3 * sk); ad(O, FA, -0.6 * wd + 0.5 * sk);
          ad(O, 'body', -0.2 * wd + 0.42 * sk, sd * 0.35 * wd - sd * 0.5 * sk); ad(O, 'head', 0.1 * wd - 0.1 * sk);
          ad(O, LA, -0.45 * sk); ad(O, LB, 0.35 * sk);
          break;
        case 'shove':
          ad(O, 'armL', -0.4 * wd - 1.3 * sk); ad(O, 'armR', -0.4 * wd - 1.3 * sk);
          ad(O, 'body', -0.12 * wd + 0.45 * sk); ad(O, LA, -0.5 * sk); ad(O, LB, 0.4 * sk);
          break;
        case 'help': ad(O, 'body', 0.55 * wd); ad(O, A, -1.3 * wd); ad(O, 'head', 0.2 * wd); break;
        case 'ranged':
          ad(O, A, -1.55 * wd + 0.35 * sk); ad(O, B, -1.1 * wd, 0, -sd * 0.4 * wd);
          ad(O, 'body', -0.06 * wd - 0.12 * sk, sd * 0.2 * wd); ad(O, 'head', 0.05 * wd);
          break;
        case 'throw':
          ad(O, A, -2.9 * wd + 1.6 * sk); ad(O, B, -0.9 * wd + 0.4 * sk);
          ad(O, 'body', -0.25 * wd + 0.4 * sk, sd * 0.4 * wd - sd * 0.4 * sk); ad(O, LA, -0.3 * sk);
          break;
        case 'cast':
          ad(O, 'armL', -2.6 * wd + 1.1 * sk, 0, 0.35 * wd); ad(O, 'armR', -2.6 * wd + 1.1 * sk, 0, -0.35 * wd);
          ad(O, 'body', -0.15 * wd + 0.25 * sk); ad(O, 'head', -0.2 * wd + 0.15 * sk);
          break;
        default:
          ad(O, 'armL', -2.7 * wd, 0, 0.6 * wd); ad(O, 'armR', -2.7 * wd, 0, -0.6 * wd);
          ad(O, 'body', -0.12 * wd); ad(O, 'head', -0.3 * wd);
      }
    }

    // 被推：身體後仰、手亂揮
    if (rec.pushed) { ad(O, 'body', -0.3); ad(O, 'armL', -1.2 + Math.sin(t * 20) * 0.4, 0, 0.6); ad(O, 'armR', -1.2 - Math.sin(t * 20) * 0.4, 0, -0.6); }

    // 受擊
    if (rec.hitT > 0) rec.hitT = Math.max(0, rec.hitT - dt / 0.45);
    const he = rec.hitT * rec.hitT * (3 - 2 * rec.hitT);
    if (he > 0) {
      ad(O, 'body', -0.42 * he); ad(O, 'head', -0.35 * he);
      ad(O, 'armL', -0.7 * he, 0, 0.5 * he); ad(O, 'armR', -0.7 * he, 0, -0.5 * he);
      const j = Math.sin(V.time * 80) * 0.04 * he;
      mx += rec.hitDir.x * 0.3 * he + j; mz += rec.hitDir.z * 0.3 * he;
    }
    // 閃避
    let dodgeZ = 0;
    if (rec.dodgeT > 0) {
      rec.dodgeT = Math.max(0, rec.dodgeT - dt / 0.45);
      const de = Math.sin(rec.dodgeT * Math.PI) * rec.dodgeS;
      mx += Math.cos(rec.curYaw) * 0.45 * de; mz -= Math.sin(rec.curYaw) * 0.45 * de;
      dodgeZ = -0.25 * de;
    }

    // 倒地姿勢
    if (L > 0.01) {
      ad(O, 'armL', -0.4 * L, 0, 1.1 * L); ad(O, 'armR', -0.4 * L, 0, -1.1 * L);
      ad(O, 'legL', 0, 0, 0.25 * L); ad(O, 'legR', 0, 0, -0.25 * L);
      ad(O, 'head', 0.15 * L, 0.5 * L);
    }

    // 慶祝／嘲諷
    if (rec.cele) {
      const cw = rec.celeW, ct = V.time - rec.cele.t0 + rec.cele.ph;
      if (rec.cele.hero) {
        my += Math.abs(Math.sin(ct * 7)) * 0.45 * cw * hs;
        ad(O, 'armL', (-2.8 + Math.sin(ct * 14) * 0.3) * cw, 0, 0.3 * cw);
        ad(O, 'armR', (-2.8 - Math.sin(ct * 14 + 1) * 0.3) * cw, 0, -0.3 * cw);
        ad(O, 'body', 0, Math.sin(ct * 10) * 0.3 * cw); ad(O, 'head', -0.2 * cw);
        ad(O, 'legL', -Math.max(0, Math.sin(ct * 7)) * 0.5 * cw); ad(O, 'legR', -Math.max(0, -Math.sin(ct * 7)) * 0.5 * cw);
      } else {
        my += Math.abs(Math.sin(ct * 9)) * 0.15 * cw * hs;
        ad(O, 'armL', (-1.6 - Math.sin(ct * 12) * 0.6) * cw, 0, 0.2 * cw);
        ad(O, 'armR', (-1.6 + Math.sin(ct * 12) * 0.6) * cw, 0, -0.2 * cw);
        ad(O, 'body', (-0.22 + Math.sin(ct * 16) * 0.06) * cw); ad(O, 'head', -0.15 * cw, Math.sin(ct * 9) * 0.4 * cw);
      }
    }

    // 翅膀、尾巴、搖擺物
    const flap = Math.sin(t * (rec.cele ? 20 : 13));
    if (P.wingL || P.wingR) { ad(O, 'wingL', 0, 0, flap * 0.55); ad(O, 'wingR', 0, 0, -flap * 0.55); my += (Math.sin(t * 13 - 0.6) * 0.04 + 0.02) * up; }
    ad(O, 'tail', Math.sin(t * 2.3) * 0.06, Math.sin(t * (3.1 + wW * 4)) * (0.3 + 0.25 * wW) + Math.sin(t * 25) * 0.25 * he);
    for (let i = 0; i < rec.extra.length; i++) {
      const ex = rec.extra[i];
      ex.o.rotation.x = ex.r.x + Math.sin(t * 2.6 + i * 1.3) * 0.08 + wW * Math.sin(rec.walkPh + i) * 0.15 + he * 0.35 + rec.wind * 0.1;
      ex.o.rotation.z = ex.r.z + Math.cos(t * 2.1 + i * 0.7) * 0.07 + Math.sin(V.time * 30 + i) * 0.12 * he;
    }

    // 眨眼
    rec.blink -= dt;
    let eyeK = 1;
    if (rec.blink < 0) {
      const b = -rec.blink / 0.13;
      eyeK = Math.abs(1 - 2 * clamp01(b));
      if (b >= 1) rec.blink = Math.random() < 0.18 ? 0.18 : 1.8 + Math.random() * 3.5;
    }
    if (L > 0.5) eyeK = 0.12; else if (he > 0.3) eyeK = Math.min(eyeK, 0.35);
    for (const e of rec.eyes) e.o.scale.y = e.sy * Math.max(0.08, eyeK);
    if (rec.mouth) rec.mouth.o.scale.y = rec.mouth.sy * (1 + 1.3 * Math.max(rec.strike, he, rec.celeW * 0.8, rec.wind * 0.3));

    // 套用部位
    for (const k in O) {
      const r = rec.rest[k], o = O[k], p = P[k];
      p.rotation.set(r.r.x + o[0], r.r.y + o[1], r.r.z + o[2]);
      p.position.set(r.p.x + o[3], r.p.y + o[4], r.p.z + o[5]);
    }
    if (P.body && rec.rest.body) { const rs = rec.rest.body.s; P.body.scale.set(rs.x * (1 - 0.006 * br * up), rs.y * (1 + 0.016 * br * up), rs.z * (1 + 0.01 * br * up)); }

    // 擠壓伸展（彈簧）
    const sdt = Math.min(dt, 0.033);
    rec.sqV += ((rec.sqT - rec.sq) * 220 - rec.sqV * 15) * sdt;
    rec.sq = clampA(rec.sq + rec.sqV * sdt, 0.4);
    const q = rec.sq + sqX + (rec.cele ? Math.sin((V.time - rec.cele.t0 + rec.cele.ph) * 14) * 0.05 * rec.celeW : 0);
    const s = rec.sc;
    model.scale.set(s * (1 - q * 0.55), s * (1 + q), s * (1 - q * 0.55));
    // 整體姿態
    const lean = -0.14 * he + (rec.pushed ? -0.15 : 0);
    model.rotation.set(rec.topple + lean, rec.curYaw + rec.spin, L * 1.45 + dodgeZ);
    my += L * 0.32 * hs + rec.dropY + rec.popY + rec.hoverW * 0.12 - rec.sink + Math.abs(Math.sin(rec.topple)) * 0.22 * hs;
    model.position.set(mx, my, mz);
    rec.holder.visible = !rec.hidden;
    rec.arrow.rotation.y = rec.curYaw;

    // 腳下光圈
    const ringO = rec.dead ? 0 : rec.active ? 0.6 + Math.sin(V.time * 6) * 0.35 : 0.55 + rec.hoverW * 0.4;
    rec.ring.material.opacity = ringO;
    rec.arrow.material.opacity = rec.dead ? 0 : 0.95;
    rec.ring.scale.setScalar((rec.u.big ? 1.35 : 1) * (rec.active ? 1.08 + Math.sin(V.time * 6) * 0.05 : 1 + rec.hoverW * (0.12 + Math.sin(V.time * 8) * 0.04)));
    if (rec.siren) { rec.siren.children[0].visible = Math.sin(V.time * 14) > 0; rec.siren.children[1].visible = !rec.siren.children[0].visible; }

    // 閃色
    let fk = null;
    if (rec.flashK) {
      rec.flashT += dt;
      const ft = rec.flashT;
      if (rec.flashK === 'hit') fk = ft < 0.07 ? 'w' : ft < 0.24 ? 'r' : null;
      else if (rec.flashK === 'heal') fk = ft < 0.3 ? 'g' : null;
      else fk = ft < 0.22 ? 'y' : null;
      if (!fk) rec.flashK = null;
    }
    applyFlash(rec, fk);

    // 模型自訂動畫
    const ua = model.userData.anim;
    if (ua && !model.userData._animErr) { try { ua(V.time, dt); } catch (e) { model.userData._animErr = true; console.warn('unit anim', e); } }
  }

  // ── 主迴圈 ──
  let last = performance.now();
  V.resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 48 : 35;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', V.resize);
  V.resize();
  const tmpV = new THREE.Vector3();
  function tick(rdt) {
    // 暴擊頓格：遊戲時間暫時放慢，計時用真實時間
    let dt = rdt;
    if (V.hitStop > 0) { V.hitStop -= rdt; dt = rdt * 0.08; }
    V.time += dt;
    // tweens
    for (let i = V.anims.length - 1; i >= 0; i--) {
      const a = V.anims[i];
      if (!a) continue;
      a.t += dt * 1000;
      const k = Math.min(1, a.t / a.dur);
      try { a.fn(k); } catch (e) { console.warn('tween', e); a.t = a.dur; }
      if (k >= 1 || a.t >= a.dur) { const j = V.anims.indexOf(a); if (j >= 0) V.anims.splice(j, 1); a.res(); }
    }
    updateCamera(rdt);
    // 單位
    activeRec = null;
    for (const rec of V.units.values()) if (rec.active) { activeRec = rec; break; }
    const r = canvas.getBoundingClientRect();
    for (const rec of V.units.values()) {
      animateUnit(rec, dt);
      // 名牌位置
      if (rec.plate) {
        tmpV.copy(rec.holder.position); tmpV.y += rec.H * (rec.lying > 0.5 ? 0.5 : 1) + 0.35 + rec.model.position.y;
        const v = tmpV.project(camera);
        const vis = !rec.hidden && v.z < 1 && v.x > -1.1 && v.x < 1.1 && v.y > -1.1 && v.y < 1.1;
        rec.plate.style.display = vis ? '' : 'none';
        if (vis) rec.plate.style.transform = `translate(${((v.x * 0.5 + 0.5) * r.width).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * r.height).toFixed(1)}px) translate(-50%, -100%)${rec.hoverW > 0.05 ? ` scale(${(1 + rec.hoverW * 0.08).toFixed(3)})` : ''}`;
      }
    }
    // 場景、道具、地表的自訂動畫
    runAnims(V.ambient, dt);
    for (const g of V.props.values()) if (g.userData._al) runAnims(g.userData._al, dt);
    for (const g of V.surf.values()) if (g.userData._al) runAnims(g.userData._al, dt);
    if (V.hammer && V.hammer.userData._al) runAnims(V.hammer.userData._al, dt);
    // 浮動文字
    for (let i = V.floats.length - 1; i >= 0; i--) {
      const f = V.floats[i];
      f.age += rdt;
      if (f.age > f.life) { f.el.remove(); V.floats.splice(i, 1); continue; }
      tmpV.set(f.wx, f.wy + f.age * 0.7, f.wz).project(camera);
      f.el.style.transform = `translate(${((tmpV.x * 0.5 + 0.5) * r.width).toFixed(1)}px, ${((-tmpV.y * 0.5 + 0.5) * r.height).toFixed(1)}px) translate(-50%, -50%) scale(${f.age < 0.12 ? 0.6 + f.age * 3.3 : 1})`;
      f.el.style.opacity = f.age > f.life - 0.35 ? (f.life - f.age) / 0.35 : 1;
    }
    updateParticles(dt);
    updateRipples(rdt);
    // 棋盤特效
    const T = V.time;
    hiIn = Math.min(1, hiIn + rdt / 0.2);
    hiMat.uniforms.uT.value = T; hiMat.uniforms.uIn.value = hiIn;
    lavaMat.uniforms.uT.value = T;
    pathMat.uniforms.uT.value = T;
    aoeU.uT.value = T;
    aoeRing.rotation.z = T * 0.5;
    cursor.rotation.z = T * 0.8;
    cursor2.rotation.z = -T * 1.9;
    if (cursor.visible) { cursor.position.y = cursorY + 0.04 + Math.sin(T * 5) * 0.035; cursor.scale.setScalar(1.38 * (1 + Math.sin(T * 5) * 0.035)); }
    if (tgtRec && V.units.has(tgtRec.u.id)) {
      const p = tgtRec.holder.position;
      tgtMark.position.set(p.x, p.y + tgtRec.H + 0.75 + Math.abs(Math.sin(T * 4.5)) * 0.3, p.z);
      tgtMark.rotation.y = T * 2;
      tgtMark.visible = true;
    } else tgtMark.visible = false;
    // 熔岩冒火星
    if (lavaTiles.length) {
      emberT += dt;
      while (emberT > 0.09) {
        emberT -= 0.09;
        const lt = lavaTiles[(Math.random() * lavaTiles.length) | 0];
        V.burst(W(lt.x) + (Math.random() - 0.5) * 1.6, -0.25, W(lt.z) + (Math.random() - 0.5) * 1.6, 1, { color: [0xffc531, 0xff7a1a, 0xfff0a0], up: 1.6, speed: 0.3, g: 0.6, life: 1.2, size: 0.22, spread: 0.1, h: 0 });
      }
    }
  }
  function frame(now) {
    const rdt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    tick(rdt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (/[?&]vdbg=1/.test(location.search)) window.__view = V; // 除錯用
  // 背景分頁時 rAF 會停：用計時器推進動畫，確保演出 Promise 一定會結束
  setInterval(() => {
    const now = performance.now();
    if (now - last > 400) { const rdt = Math.min(0.5, (now - last) / 1000); last = now; tick(rdt); }
  }, 250);
  return V;
}

function shortName(n) { const i = n.lastIndexOf('・'); return i >= 0 ? n.slice(i + 1) : n; }
const STATUS_ICON = {
  prone: '🫠', stunned: '💫', boxed: '📦', canceled: '🚫', sugar: '🍩', subpoena: '⚖️', nausea: '🤢', palpit: '💓', veins: '💪',
  stealth: '🕶️', cringe: '🤡', psyched: '🔥', shaken: '😵', distracted: '🙈', pineapple: '🍍', intern: '🪪', freedom: '🦅',
};
export { STATUS_ICON };
