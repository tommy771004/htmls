// 海面與海上的一切：浪與濕沙（shader）、航跡、帆船與遊艇、租船、水上摩托車、衝浪客、浮標、海鷗、貨輪。
import * as THREE from 'three';
import { Builder, prng, T } from './geo.js';
import { SEA_Z0, SAND_Y, BOAT_SLOTS, JET_SLOTS, BEACH, DECK_Y } from './layout.js';

const TBOX = T.box;
export const SEA_Y = SAND_Y + 0.03;

const seaVert = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const seaFrag = /* glsl */ `
uniform float uTime, uNight, uRain, uCloud;
uniform vec3 uSand, uWet, uShallow, uMid, uDeep, uFoam, uNightTint;
varying vec3 vW;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float x = vW.x, z = vW.z;
  float shore = 44.0 + 1.3 * sin(x * 0.043) + 0.7 * sin(x * 0.131 + 1.3);
  // 浪一波波推上沙灘又退回
  float swash = 1.5 * sin(uTime * 0.62 + x * 0.018) + 0.5 * sin(uTime * 1.1 + x * 0.05);
  float wl = shore + swash;
  float d = z - wl;
  vec3 col;
  if (d < 0.0) {
    // 濕沙：越靠近水越深，最高水位以上漸回乾沙
    float wet = smoothstep(shore - 3.8, shore - 0.6, z);
    col = mix(uSand, uWet, wet);
    float film = smoothstep(-1.2, 0.0, d);
    col = mix(col, uFoam, film * 0.55);
  } else {
    float depth = clamp((z - shore) / 90.0, 0.0, 1.0);
    col = mix(uShallow, uMid, smoothstep(0.0, 0.25, depth));
    col = mix(col, uDeep, smoothstep(0.25, 1.0, depth));
    // 岸邊白浪
    float foam = 1.0 - smoothstep(0.0, 1.1, d);
    // 往岸邊推進的浪線
    float ph = mod(uTime * 1.7 + sin(x * 0.03) * 2.0, 9.0);
    float band = d - (9.0 - ph);
    float wave = (1.0 - smoothstep(0.0, 0.45, abs(band))) * smoothstep(9.5, 2.0, d) * 0.7;
    // 外海的湧浪條紋
    float swell = sin(z * 0.32 + x * 0.06 - uTime * 0.9) * sin(z * 0.11 - x * 0.03 + uTime * 0.4);
    col += vec3(0.035) * swell * smoothstep(4.0, 30.0, d);
    // 細碎反光
    vec2 cell = floor(vW.xz * vec2(0.8, 1.6));
    float g = hash(cell + floor(uTime * 1.5));
    col += vec3(0.08) * step(0.985, g) * (1.0 - uNight) * (1.0 - uCloud) * smoothstep(6.0, 20.0, d);
    col = mix(col, uFoam, clamp(foam + wave, 0.0, 1.0));
  }
  col *= mix(1.0, 0.82, uCloud);
  col = mix(col, col * uNightTint, uNight);
  col = mix(col, vec3(dot(col, vec3(0.33))), uRain * 0.35);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const wakeVert = /* glsl */ `
attribute float aAlpha;
varying float vA;
varying vec2 vUv;
void main() {
  vA = aAlpha;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const wakeFrag = /* glsl */ `
uniform vec3 uColor;
varying float vA;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.55, 1.0, d)) * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;

function geoFrom(build) {
  const b = new Builder();
  build(b);
  return b.geometry();
}

// 船身朝 +z（船頭），原點在吃水線中心
const GEO = {
  rental: () => geoFrom((S) => {
    S.add(TBOX, 0, -0.25, 0, 1.6, 0.75, 3.0, 0, '#f4f1e6');
    S.add(T.cone4, 0, -0.25, 1.5, 1.6, 0.75, 1.3, 0, '#f4f1e6', Math.PI / 2);
    S.add(TBOX, 0, 0.2, 0, 1.64, 0.18, 3.02, 0, '#c8453c');
    S.add(TBOX, 0, 0.42, 0, 1.2, 0.08, 2.4, 0, '#b48a5c');
    S.add(TBOX, 0, -0.1, -1.6, 0.4, 0.9, 0.35, 0, '#2c3d36');
    // 船上的客人：橘色救生衣
    S.add(TBOX, 0, 0.5, -0.5, 0.55, 0.6, 0.35, 0, '#e0763a');
    S.ball(0, 1.05, -0.5, 0.22, '#e8b896');
    S.add(TBOX, 0, 0.5, 0.6, 0.5, 0.55, 0.33, 0, '#2f7f8f');
    S.ball(0, 1.0, 0.6, 0.21, '#c98f6c');
  }),
  jetski: () => geoFrom((S) => {
    S.add(TBOX, 0, -0.2, 0, 0.95, 0.55, 2.0, 0, '#f4f1e6');
    S.add(T.cone4, 0, -0.2, 1.0, 0.95, 0.55, 0.9, 0, '#2e5f9a', Math.PI / 2);
    S.add(TBOX, 0, 0.32, -0.2, 0.5, 0.2, 1.1, 0, '#1f2a2c');
    S.add(TBOX, 0, 0.35, 0.55, 0.7, 0.35, 0.3, 0, '#2e5f9a');
    S.add(TBOX, 0, 0.55, -0.25, 0.45, 0.65, 0.3, 0, '#e0763a');
    S.ball(0, 1.15, -0.2, 0.2, '#d8a383');
  }),
  sail: () => geoFrom((S) => {
    S.add(TBOX, 0, -0.5, 0, 2.2, 1.2, 5.6, 0, '#f4f1e6');
    S.add(T.cone4, 0, -0.5, 2.8, 2.2, 1.2, 2.0, 0, '#f4f1e6', Math.PI / 2);
    S.add(TBOX, 0, 0.65, 0, 2.26, 0.12, 5.62, 0, '#2d5a45');
    S.add(TBOX, 0, 0.7, -0.4, 1.8, 0.1, 4.4, 0, '#b48a5c');
    S.add(TBOX, 0, 0.8, -1.6, 1.2, 0.6, 1.4, 0, '#f4f1e6');
    S.cyl(0, 0.7, 0.6, 0.07, 8.2, '#d8d4c8', 6);
    S.add(T.prism, 0.03, 1.4, -1.0, 0.05, 6.6, 3.0, 0, '#fbf8ee');
    S.add(T.prism, -0.03, 1.2, 1.9, 0.05, 6.4, 2.1, 0, '#efe9da');
  }),
  yacht: () => geoFrom((S) => {
    S.add(TBOX, 0, -0.6, 0, 2.8, 1.5, 7.2, 0, '#f4f1e6');
    S.add(T.cone4, 0, -0.6, 3.6, 2.8, 1.5, 2.6, 0, '#f4f1e6', Math.PI / 2);
    S.add(TBOX, 0, 0.1, 0, 2.86, 0.3, 7.24, 0, '#2a4a6a');
    S.add(TBOX, 0, 0.9, -0.8, 2.0, 1.1, 3.6, 0, '#f4f1e6');
    S.add(TBOX, 0, 1.25, 0.2, 2.04, 0.5, 1.8, 0, '#34444b');
    S.add(TBOX, 0, 2.0, -1.2, 1.4, 0.6, 1.8, 0, '#f4f1e6');
  }),
  surfPaddle: () => geoFrom((S) => {
    S.add(T.ico, 0, -0.08, 0, 0.6, 0.16, 2.4, 0, '#e07a5f');
    S.add(TBOX, 0, 0.05, -0.2, 0.45, 0.28, 1.2, 0, '#1f2a2c');
    S.ball(0, 0.05, 0.5, 0.2, '#d8a383');
  }),
  surfRide: () => geoFrom((S) => {
    S.add(T.ico, 0, -0.08, 0, 0.6, 0.16, 2.4, 0, '#2f7f8f');
    S.add(TBOX, -0.15, 0.05, 0, 0.18, 0.8, 0.22, 0, '#1f2a2c');
    S.add(TBOX, 0.15, 0.05, 0, 0.18, 0.8, 0.22, 0, '#1f2a2c');
    S.add(TBOX, 0, 0.85, 0, 0.5, 0.65, 0.3, 0.3, '#1f2a2c');
    S.ball(0, 1.6, 0, 0.21, '#c98f6c');
    S.add(TBOX, 0, 1.25, 0, 1.6, 0.12, 0.14, 0.3, '#1f2a2c');
  }),
  freighter: () => geoFrom((S) => {
    S.add(TBOX, 0, -1.5, 0, 9, 3.6, 46, 0, '#3f4f5a');
    S.add(T.cone4, 0, -1.5, 23, 9, 3.6, 6, 0, '#3f4f5a', Math.PI / 2);
    S.add(TBOX, 0, -1.5, 0, 9.04, 0.8, 46.04, 0, '#a8462f');
    S.add(TBOX, 0, 2.1, -18, 8, 6, 6, 0, '#efe9da');
    S.add(TBOX, 0, 8.1, -18, 8.4, 0.4, 6.4, 0, '#3f4f5a');
    const cc = ['#c8453c', '#2f7f8f', '#d9a63e', '#5f8790', '#8ea488', '#b5793a'];
    let k = 0;
    for (let z = -12; z < 18; z += 3.2) for (let x = -3; x <= 3; x += 2) for (let y = 0; y < 2; y++) S.add(TBOX, x, 2.1 + y * 1.3, z, 1.9, 1.25, 3.0, 0, cc[(k++ * 7) % cc.length]);
  }),
  buoy: () => geoFrom((S) => {
    S.ball(0, -0.2, 0, 0.45, '#e0763a', 1);
  }),
  gull: () => geoFrom((S) => {
    S.add(TBOX, 0, 0, 0, 0.18, 0.18, 0.7, 0, '#f4f1e6');
    S.add(TBOX, 0.55, 0.12, 0, 1.0, 0.04, 0.32, 0, '#f4f1e6', 0, 0.35);
    S.add(TBOX, -0.55, 0.12, 0, 1.0, 0.04, 0.32, 0, '#f4f1e6', 0, -0.35);
  }),
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);

function pool(scene, geo, n, mat, cast = true) {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.castShadow = cast;
  m.receiveShadow = false;
  m.frustumCulled = false;
  for (let i = 0; i < n; i++) m.setMatrixAt(i, HIDE);
  scene.add(m);
  return m;
}

function place(mesh, i, x, y, z, yaw, roll = 0, pitch = 0, s = 1) {
  _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(pitch, yaw, roll, 'YXZ')), _s.set(s, s, s));
  mesh.setMatrixAt(i, _m);
}

export function createSea(scene) {
  const rnd = prng(77);
  const uniforms = {
    uTime: { value: 0 }, uNight: { value: 0 }, uRain: { value: 0 }, uCloud: { value: 0 },
    uSand: { value: new THREE.Color('#ead9b0') }, uWet: { value: new THREE.Color('#cdb889') },
    uShallow: { value: new THREE.Color('#a8dccb') }, uMid: { value: new THREE.Color('#82c8bb') }, uDeep: { value: new THREE.Color('#5aa6a6') },
    uFoam: { value: new THREE.Color('#f6fbf3') }, uNightTint: { value: new THREE.Color('#3a5470') },
  };
  const seaMat = new THREE.ShaderMaterial({ uniforms, vertexShader: seaVert, fragmentShader: seaFrag });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1000, 560).rotateX(-Math.PI / 2), seaMat);
  sea.position.set(0, SEA_Y, SEA_Z0 + 280);
  sea.receiveShadow = false;
  scene.add(sea);

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const P = {
    rental: pool(scene, GEO.rental(), 6, mat),
    jetski: pool(scene, GEO.jetski(), 6, mat),
    sail: pool(scene, GEO.sail(), 5, mat),
    yacht: pool(scene, GEO.yacht(), 3, mat),
    surfPaddle: pool(scene, GEO.surfPaddle(), 8, mat, false),
    surfRide: pool(scene, GEO.surfRide(), 8, mat),
    buoy: pool(scene, GEO.buoy(), 40, mat, false),
    gull: pool(scene, GEO.gull(), 9, mat, false),
  };
  const freighter = new THREE.Mesh(GEO.freighter(), mat);
  freighter.castShadow = false;
  scene.add(freighter);

  // ── 航跡 ──
  const MAXW = 700;
  const wakeGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(MAXW), 1);
  aAlpha.setUsage(THREE.DynamicDrawUsage);
  wakeGeo.setAttribute('aAlpha', aAlpha);
  const wakeMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#ffffff') } },
    vertexShader: wakeVert, fragmentShader: wakeFrag, transparent: true, depthWrite: false,
  });
  const wakes = new THREE.InstancedMesh(wakeGeo, wakeMat, MAXW);
  wakes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  wakes.frustumCulled = false;
  wakes.renderOrder = 2;
  scene.add(wakes);
  const W = Array.from({ length: MAXW }, () => ({ life: 0, max: 1, x: 0, z: 0, vx: 0, vz: 0, s0: 1, s1: 3, a: 0.7 }));
  let wHead = 0;
  function wake(x, z, vx, vz, s0, s1, life, a = 0.7) {
    const w = W[wHead];
    wHead = (wHead + 1) % MAXW;
    Object.assign(w, { life, max: life, x, z, vx, vz, s0, s1, a });
  }
  // 船尾兩側往外擴的 V 形白浪
  function emit(o, x, z, yaw, speed, back, width) {
    o.acc = (o.acc || 0) + speed;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    while (o.acc > 0.8) {
      o.acc -= 0.8;
      const sx = x - fx * back, sz = z - fz * back;
      for (const side of [-1, 1]) {
        const lx = fz * side, lz = -fx * side;
        wake(sx + lx * width * 0.5, sz + lz * width * 0.5, lx * 1.4 - fx * 0.3, lz * 1.4 - fz * 0.3, 0.9, 2.6, 2.6, 0.6);
      }
      wake(sx, sz, -fx * 0.2, -fz * 0.2, width * 0.8, width * 2.2, 3.2, 0.55);
    }
  }

  // ── 環境船隻 ──
  const sails = Array.from({ length: 5 }, (_, i) => ({
    cx: -140 + i * 70 + rnd() * 20, cz: 120 + rnd() * 90, rx: 40 + rnd() * 40, rz: 14 + rnd() * 18,
    w: (0.012 + rnd() * 0.01) * (rnd() < 0.5 ? 1 : -1), a: rnd() * 6.28, x: 0, z: 0, yaw: 0,
  }));
  const yachts = Array.from({ length: 3 }, (_, i) => ({ z: 100 + i * 55 + rnd() * 20, x: -300 + rnd() * 600, v: (7 + rnd() * 5) * (i % 2 ? -1 : 1) }));
  const ship = { x: -380, z: 330, v: 3.2 };
  const buoys = [];
  for (let x = -96; x <= 130; x += 6) buoys.push([x, 74 + Math.sin(x * 0.07) * 1.5]);
  const gulls = Array.from({ length: 9 }, () => ({ cx: -100 + rnd() * 220, cz: 20 + rnd() * 50, r: 8 + rnd() * 14, y: 13 + rnd() * 7, w: 0.25 + rnd() * 0.3, a: rnd() * 6.28, f: rnd() * 6 }));

  // ── 租船與水上摩托車 ──
  const mkFleet = (slots, home) => slots.map(([x, z], i) => ({ i, x, z, hx: x, hz: z, yaw: home, homeYaw: home, state: 'idle', active: false, t: 0, T: 1, curve: null, onDone: null }));
  const boats = mkFleet(BOAT_SLOTS, 0);
  const jets = mkFleet(JET_SLOTS, 0);
  const surfers = Array.from({ length: 8 }, () => ({ on: false, x: 0, z: 0, yaw: Math.PI, mode: 'paddle', t: 0, tz: 60, v: 0 }));

  function tripCurve(start, pts) {
    const arr = [new THREE.Vector3(start.x, 0, start.z), ...pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), new THREE.Vector3(start.x, 0, start.z)];
    return new THREE.CatmullRomCurve3(arr, false, 'centripetal');
  }

  const api = {
    uniforms,
    setFleet(kind, n) {
      const f = kind === 'boat' ? boats : jets;
      f.forEach((b, i) => { b.active = i < n; });
    },
    freeCraft(kind) {
      const f = kind === 'boat' ? boats : jets;
      return f.find((b) => b.active && b.state === 'idle') || null;
    },
    // 出航：dur 秒後回到原位並呼叫 onDone
    launch(kind, craft, dur, onDone) {
      const s = rnd;
      let pts;
      if (kind === 'boat') {
        const side = s() < 0.5 ? -1 : 1;
        pts = [[craft.hx + side * 3, 72], [18 + side * (20 + s() * 30), 100 + s() * 25], [18 - side * (10 + s() * 25), 135 + s() * 30], [18 - side * (35 + s() * 20), 105 + s() * 20], [craft.hx - side * 6, 78]];
      } else {
        const cx = 95 + s() * 50, cz = 95 + s() * 30;
        pts = [[craft.hx, 66], [cx - 30, cz - 20], [cx + 25, cz - 10], [cx + 5, cz + 25], [cx - 35, cz + 10], [cx + 30, cz + 30], [craft.hx + 4, 74]];
      }
      craft.curve = tripCurve({ x: craft.hx, z: craft.hz }, pts);
      craft.len = craft.curve.getLength();
      craft.state = 'out';
      craft.t = 0;
      craft.T = dur;
      craft.onDone = onDone;
    },
    surferStart() {
      const s = surfers.find((q) => !q.on);
      if (!s) return null;
      const z = BEACH.surf.zone;
      Object.assign(s, { on: true, x: z.x0 + rnd() * (z.x1 - z.x0), z: z.z0 + 1, mode: 'paddle', yaw: 0, t: 0, tz: z.z0 + 6 + rnd() * (z.z1 - z.z0 - 6), v: 0 });
      return s;
    },
    surferEnd(s) { if (s) s.on = false; },
    update(dt, time, speed) {
      uniforms.uTime.value = time;
      // 環境帆船
      sails.forEach((b, i) => {
        b.a += b.w * dt * Math.min(speed, 2);
        const x = b.cx + Math.cos(b.a) * b.rx, z = b.cz + Math.sin(b.a) * b.rz;
        const yaw = Math.atan2(x - b.x, z - b.z);
        const sp = Math.hypot(x - b.x, z - b.z) / Math.max(dt, 1e-3);
        if (b.x || b.z) { b.yaw = yaw; emit(b, x, z, yaw, sp * dt * 0.5, 3.6, 1.6); }
        b.x = x; b.z = z;
        place(P.sail, i, x, SEA_Y + Math.sin(time * 1.3 + i) * 0.08, z, b.yaw, Math.sin(time * 0.9 + i) * 0.05 + 0.12 * Math.sign(b.w));
      });
      P.sail.instanceMatrix.needsUpdate = true;
      yachts.forEach((b, i) => {
        b.x += b.v * dt * Math.min(speed, 2);
        if (b.x > 320) b.x = -320;
        if (b.x < -320) b.x = 320;
        const yaw = b.v > 0 ? Math.PI / 2 : -Math.PI / 2;
        emit(b, b.x, b.z, yaw, Math.abs(b.v) * dt, 4.4, 2.0);
        place(P.yacht, i, b.x, SEA_Y + Math.sin(time * 1.7 + i) * 0.1, b.z, yaw, Math.sin(time * 1.1 + i) * 0.03, -0.03);
      });
      P.yacht.instanceMatrix.needsUpdate = true;
      ship.x += ship.v * dt * Math.min(speed, 2);
      if (ship.x > 420) ship.x = -420;
      freighter.position.set(ship.x, SEA_Y, ship.z);
      freighter.rotation.y = Math.PI / 2;
      emit(ship, ship.x, ship.z, Math.PI / 2, ship.v * dt * 0.6, 26, 6);

      // 租船／水上摩托車
      for (const [fleet, mesh, kind] of [[boats, P.rental, 'boat'], [jets, P.jetski, 'jet']]) {
        fleet.forEach((b, i) => {
          if (!b.active) { mesh.setMatrixAt(i, HIDE); return; }
          let roll = 0, bob = Math.sin(time * 2 + i * 1.7) * 0.06;
          if (b.state === 'out') {
            b.t += dt * speed;
            const u = Math.min(1, b.t / b.T);
            // 出港與進港放慢
            const e = u < 0.08 ? (u / 0.08) ** 2 * 0.04 : u > 0.92 ? 1 - ((1 - u) / 0.08) ** 2 * 0.04 : 0.04 + (u - 0.08) / 0.84 * 0.92;
            const p = b.curve.getPointAt(Math.min(1, Math.max(0, e)));
            const tg = b.curve.getTangentAt(Math.min(0.999, Math.max(0.001, e)));
            const yaw = Math.atan2(tg.x, tg.z);
            let dyaw = yaw - b.yaw;
            while (dyaw > Math.PI) dyaw -= Math.PI * 2;
            while (dyaw < -Math.PI) dyaw += Math.PI * 2;
            b.yaw += dyaw * Math.min(1, dt * 6);
            const sp = Math.hypot(p.x - b.x, p.z - b.z);
            roll = -dyaw * (kind === 'jet' ? 1.2 : 0.5);
            b.x = p.x; b.z = p.z;
            if (u > 0.04 && u < 0.97) emit(b, b.x, b.z, b.yaw, sp * (kind === 'jet' ? 1.3 : 1), kind === 'jet' ? 1.1 : 1.8, kind === 'jet' ? 0.8 : 1.3);
            if (u >= 1) {
              b.state = 'idle'; b.x = b.hx; b.z = b.hz; b.yaw = b.homeYaw;
              const cb = b.onDone; b.onDone = null;
              if (cb) cb();
            }
            if (kind === 'jet') bob += Math.abs(Math.sin(time * 9 + i)) * 0.12;
          }
          place(mesh, i, b.x, SEA_Y + bob, b.z, b.yaw, roll, b.state === 'out' && kind === 'jet' ? -0.08 : 0);
        });
        mesh.instanceMatrix.needsUpdate = true;
      }

      // 衝浪客：划出去 → 等浪 → 站起來乘浪回岸邊 → 再划出去
      surfers.forEach((s, i) => {
        if (!s.on) { P.surfPaddle.setMatrixAt(i, HIDE); P.surfRide.setMatrixAt(i, HIDE); return; }
        s.t += dt * speed;
        const zone = BEACH.surf.zone;
        if (s.mode === 'paddle') {
          s.yaw = 0;
          s.z += 1.2 * dt * speed;
          if (s.z >= s.tz) { s.mode = 'wait'; s.t = 0; }
        } else if (s.mode === 'wait') {
          s.yaw = Math.PI + Math.sin(time + i) * 0.2;
          if (s.t > 2.5 + (i % 3)) { s.mode = 'ride'; s.v = 5 + (i % 3); s.dx = (i % 2 ? 1 : -1) * 1.5; }
        } else {
          s.z -= s.v * dt * speed;
          s.x = Math.min(zone.x1, Math.max(zone.x0, s.x + s.dx * dt * speed));
          s.yaw = Math.atan2(s.dx, -s.v);
          emit(s, s.x, s.z, s.yaw, s.v * dt * speed * 1.2, 1.2, 0.7);
          if (s.z <= zone.z0 - 2) { s.mode = 'paddle'; s.tz = zone.z0 + 6 + rnd() * (zone.z1 - zone.z0 - 6); }
        }
        const riding = s.mode === 'ride';
        place(P.surfPaddle, i, s.x, SEA_Y + Math.sin(time * 2.2 + i) * 0.07, s.z, s.yaw);
        if (riding) P.surfPaddle.setMatrixAt(i, HIDE);
        if (riding) place(P.surfRide, i, s.x, SEA_Y + 0.1, s.z, s.yaw, Math.sin(time * 3 + i) * 0.12);
        else P.surfRide.setMatrixAt(i, HIDE);
      });
      P.surfPaddle.instanceMatrix.needsUpdate = true;
      P.surfRide.instanceMatrix.needsUpdate = true;

      buoys.forEach(([x, z], i) => place(P.buoy, i, x, SEA_Y + Math.sin(time * 1.6 + i * 0.7) * 0.12, z, 0));
      P.buoy.count = buoys.length;
      P.buoy.instanceMatrix.needsUpdate = true;

      gulls.forEach((g, i) => {
        g.a += g.w * dt;
        const x = g.cx + Math.cos(g.a) * g.r, z = g.cz + Math.sin(g.a) * g.r;
        const flap = 1 + Math.sin(time * 9 + g.f) * 0.35;
        _m.compose(_p.set(x, g.y + Math.sin(time * 0.8 + g.f), z), _q.setFromEuler(_e.set(0, g.a + (g.w > 0 ? 0 : Math.PI), 0.25)), _s.set(1.4 * flap, 1.4, 1.4));
        P.gull.setMatrixAt(i, _m);
      });
      P.gull.instanceMatrix.needsUpdate = true;

      // 航跡粒子
      let n = 0;
      for (const w of W) {
        if (w.life <= 0) continue;
        w.life -= dt;
        if (w.life <= 0) continue;
        w.x += w.vx * dt;
        w.z += w.vz * dt;
        const k = 1 - w.life / w.max;
        const s = w.s0 + (w.s1 - w.s0) * k;
        _m.compose(_p.set(w.x, SEA_Y + 0.02, w.z), _q.identity(), _s.set(s, 1, s * 0.6));
        wakes.setMatrixAt(n, _m);
        aAlpha.array[n] = w.a * (1 - k) * (1 - k);
        n++;
      }
      wakes.count = n;
      wakes.instanceMatrix.needsUpdate = true;
      aAlpha.needsUpdate = true;
    },
    stats: () => ({ boatsOut: boats.filter((b) => b.state === 'out').length, jetsOut: jets.filter((b) => b.state === 'out').length, surfers: surfers.filter((s) => s.on).length }),
    boats, jets,
    wakeAt: emit,
  };
  return api;
}
