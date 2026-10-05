// 水面：y=0 的透明平面。淺處幾乎透明、深處略帶青色，Fresnel 映出淡天色，
// 程序化法線產生細碎的陽光閃爍與淡淡的寬光澤，岸邊與木樁周圍的白色細浪沫，以及浮標／咬鉤／拔河的擴散漣漪。
import * as THREE from 'three';
import { UW } from './underwater.js';
import { DEPTH_BOX, WATER_FX } from './world.js';

const NR = 10, NP = 32;
export function buildWater(scene, depthTex, sunDir) {
  const ripples = Array.from({ length: NR }, () => new THREE.Vector4(0, 0, -99, 0));
  // 木樁／梯腳（x, z, 半徑）與它們的外框，著色器直接算到最近木樁的距離畫浪沫
  const piles = Array.from({ length: NP }, (_, i) => { const q = WATER_FX.piles[i]; return q ? new THREE.Vector3(q[0], q[1], q[2]) : new THREE.Vector3(0, 0, -1); });
  const pb = new THREE.Vector4(1e9, 1e9, -1e9, -1e9);
  for (const [x, z] of WATER_FX.piles) { pb.x = Math.min(pb.x, x - 0.6); pb.y = Math.min(pb.y, z - 0.6); pb.z = Math.max(pb.z, x + 0.6); pb.w = Math.max(pb.w, z + 0.6); }
  // 船身吃水線的半寬表（船本地，s＝0 船頭在 +z、1 船尾板）
  const hull = WATER_FX.hull || { L: 3.14, s: [0, 0.08, 0.2, 0.35, 0.5, 0.65, 0.8, 0.92, 1], w: [0.01, 0.19, 0.39, 0.53, 0.58, 0.57, 0.53, 0.49, 0.45] };
  const uniforms = {
    uTime: UW.uTime,
    uDepth: { value: depthTex },
    uBox: { value: new THREE.Vector3(DEPTH_BOX.x0, DEPTH_BOX.z0, 1 / DEPTH_BOX.size) },
    uSun: { value: sunDir.clone() },
    // 高光專用的「假太陽」：真實太陽在鏡頭後方左上，鏡面反射永遠落在畫面外；
    // 另取一個朝 −Z、偏西的方向，讓跟隨鏡頭（從 +Z 往 −Z 俯視）畫面左上看得到閃光，
    // 又不正好壓在棧橋盡頭前方的落點上。陰影與焦散仍用真實 sunDir。
    uGlint: { value: new THREE.Vector3(-0.4, 0.74, -0.55).normalize() },
    uRip: { value: ripples },
    uShallow: { value: new THREE.Color('#8fe0d2') },
    uMid: { value: new THREE.Color('#58c3c0') },
    uDeep: { value: new THREE.Color('#2f9aa8') },
    uSky: { value: new THREE.Color('#e9f6ef') },
    uFogColor: { value: new THREE.Color('#e6f1e6') },
    uFogRange: { value: new THREE.Vector2(60, 160) },
    uBoat: { value: new THREE.Vector4(0, 0, 0, 0) },   // main.js 設定：船的 x、z、yaw；w > 0 時畫船邊浪沫
    uPiles: { value: piles },
    uPileN: { value: Math.min(NP, WATER_FX.piles.length) },
    uPileBox: { value: pb },
    uHullS: { value: hull.s.slice(0, 9) },
    uHullW: { value: hull.w.slice(0, 9) },
    uHullL: { value: hull.L },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: /* glsl */`
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform sampler2D uDepth; uniform vec3 uBox; uniform vec3 uSun; uniform vec3 uGlint;
      uniform vec4 uRip[${NR}];
      uniform vec3 uShallow, uMid, uDeep, uSky, uFogColor; uniform vec2 uFogRange; uniform vec4 uBoat;
      uniform vec3 uPiles[${NP}]; uniform int uPileN; uniform vec4 uPileBox;
      uniform float uHullS[9]; uniform float uHullW[9]; uniform float uHullL;
      varying vec3 vW;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      vec2 wave(vec2 p, vec2 d, float k, float a, float s) { float ph = dot(d, p) * k + uTime * s; return d * (a * k * cos(ph)); }
      // 船身吃水線輪廓的近似距離（船外為正）：依 s 查半寬表，船頭／船尾外再加縱向距離
      float hullDist(vec2 bl) {
        float s = (uHullL * 0.5 - bl.y) / uHullL;
        float sc = clamp(s, 0.0, 1.0), w = uHullW[8];
        for (int i = 0; i < 8; i++) {
          if (sc >= uHullS[i] && sc <= uHullS[i + 1]) { w = mix(uHullW[i], uHullW[i + 1], (sc - uHullS[i]) / (uHullS[i + 1] - uHullS[i])); break; }
        }
        float dx = abs(bl.x) - w, dz = max(-s, s - 1.0) * uHullL;
        return dz > 0.0 ? length(vec2(max(dx, 0.0), dz)) : dx;
      }
      void main() {
        vec2 p = vW.xz;
        // 船艙裡的水面由船上的遮罩網格（只寫深度）擋掉，跟著船起伏；這裡只算船外一圈浪沫的距離
        float hullD = 9.0;
        if (uBoat.w > 0.0) {
          vec2 bd = p - uBoat.xy; float cs = cos(uBoat.z), sn = sin(uBoat.z);
          hullD = hullDist(vec2(cs * bd.x - sn * bd.y, sn * bd.x + cs * bd.y));
        }
        // 木樁：到最近一根的表面距離
        float pileD = 9.0;
        if (p.x > uPileBox.x && p.y > uPileBox.y && p.x < uPileBox.z && p.y < uPileBox.w) {
          for (int i = 0; i < ${NP}; i++) {
            if (i >= uPileN) break;
            pileD = min(pileD, length(p - uPiles[i].xy) - uPiles[i].z);
          }
        }
        // 深度貼圖範圍外沿用邊緣值（clamp），不會在範圍邊界跳成固定水深
        vec2 uv = (p - uBox.xy) * uBox.z;
        vec4 dt = texture2D(uDepth, clamp(uv, 0.0, 1.0));
        float depth = dt.r * 4.0;
        // 法線：幾道方向波＋細碎噪聲
        vec2 g = vec2(0.0);
        g += wave(p, normalize(vec2(1.0, 0.35)), 1.3, 0.020, 1.2);
        g += wave(p, normalize(vec2(-0.4, 1.0)), 2.1, 0.012, 1.7);
        g += wave(p, normalize(vec2(0.8, -0.7)), 3.7, 0.006, 2.4);
        g += wave(p, normalize(vec2(-1.0, -0.2)), 6.3, 0.003, 3.1);
        float n1 = vnoise(p * 3.1 + vec2(uTime * 0.6, -uTime * 0.4));
        float n2 = vnoise(p * 5.3 - vec2(uTime * 0.5, uTime * 0.7));
        g += (vec2(n1, n2) - 0.5) * 0.09;
        // 漣漪
        float ring = 0.0;
        for (int i = 0; i < ${NR}; i++) {
          vec4 r = uRip[i];
          float age = uTime - r.z;
          if (age < 0.0 || age > 3.2 || r.w <= 0.0) continue;
          vec2 d = p - r.xy; float dist = length(d) + 1e-4;
          float R = 0.08 + age * (0.55 + r.w * 0.5);
          float x = dist - R;
          float env = exp(-x * x * 26.0) * r.w * exp(-age * 1.4);
          g += (d / dist) * sin(x * 30.0) * env * 0.55;
          float x2 = dist - R * 0.6;
          float env2 = exp(-x2 * x2 * 40.0) * r.w * exp(-age * 2.0);
          g += (d / dist) * sin(x2 * 34.0) * env2 * 0.35;
          ring += env * 0.8 + env2 * 0.4;
        }
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 V = normalize(cameraPosition - vW);
        float ndv = max(dot(N, V), 0.0);
        float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
        vec3 col = mix(uShallow, uMid, smoothstep(0.3, 2.0, depth));
        col = mix(col, uDeep, smoothstep(2.0, 3.8, depth));
        float alpha = mix(0.04, 0.3, smoothstep(0.0, 3.6, depth));
        alpha *= smoothstep(0.0, 0.12, depth) * 0.85 + 0.15;
        col = mix(col, uSky, clamp(fres * 1.4, 0.0, 0.8));
        alpha = mix(alpha, 0.9, clamp(fres * 1.1, 0.0, 0.85));
        // 高光（用 uGlint）：陽光在水面細碎閃爍＋很淡的寬光澤。
        // 閃光點的位置與疏密全由兩層高頻噪聲相乘＋高門檻決定（約數公分的小點，隨時間明滅），
        // nh 只當成很寬的分佈範圍，不讓低頻波浪法線把閃光聚成一團。
        vec3 H = normalize(uGlint + V);
        float nh = max(dot(N, H), 0.0);
        float sheen = pow(nh, 30.0) * 0.05;
        float zone = pow(nh, 60.0);   // 越接近鏡面方向閃光越密，遠離時只剩零星幾點
        vec2 q = p * 12.0;
        float tw = vnoise(q + vec2(uTime * 1.9, -uTime * 1.3)) * vnoise(p * 16.0 - vec2(uTime * 1.4, uTime * 2.1));
        float blink = 0.55 + 0.45 * sin(uTime * 7.0 + hash(floor(q * 0.5)) * 37.0);
        float far = length(cameraPosition - vW);
        float sparkle = smoothstep(mix(0.72, 0.52, zone), 0.78, tw) * blink * (0.5 + 0.5 * zone) * (1.0 - smoothstep(45.0, 80.0, far));
        // 白浪沫：岸邊、木樁、漣漪
        float fn = vnoise(p * 4.0 + vec2(uTime * 0.3, 0.0)) * 0.6 + vnoise(p * 9.0 - uTime * 0.5) * 0.4;
        float shore = smoothstep(0.32, 0.0, depth);
        float band = 0.5 + 0.5 * sin(depth * 34.0 - uTime * 1.7 + fn * 4.0);
        float foam = shore * smoothstep(0.35, 0.75, band * 0.6 + fn * 0.55);
        foam += smoothstep(0.08, 0.0, depth) * 0.6;
        // 木樁：貼著水線一圈細白邊，外面再一圈被噪聲切碎、隨時間流動的浪沫
        if (pileD < 0.5) {
          float hug = smoothstep(0.07, 0.0, pileD) * (0.55 + 0.35 * fn);
          float halo = smoothstep(0.32, 0.03, pileD);
          foam += hug + halo * smoothstep(0.42, 0.72, fn + halo * 0.25) * 0.8;
        }
        // 船邊：只留很窄、斷斷續續的一圈（低角度時水面上的浪沫會疊在水線下的船殼前面，太寬就像一層白霧）
        if (hullD < 0.3) {
          float hug = smoothstep(0.035, 0.0, hullD) * smoothstep(0.3, 0.6, fn) * 0.7;
          float halo = smoothstep(0.13, 0.0, hullD);
          foam += hug + halo * smoothstep(0.55, 0.8, fn + halo * 0.15) * 0.6;
        }
        foam += ring * smoothstep(0.35, 0.8, fn + 0.3) * 0.7;
        foam = clamp(foam, 0.0, 1.0);
        col = mix(col, vec3(1.0, 0.99, 0.96), foam * 0.9);
        alpha = max(alpha, foam * 0.85);
        // 高光只把不透明度加一點點，水下的珊瑚與魚仍看得清楚；閃光點顏色推過 1，靠色調映射壓成亮點
        col += vec3(1.0, 0.97, 0.88) * (sheen + sparkle * 3.4);
        alpha = clamp(alpha + (sheen + sparkle) * 0.35, 0.0, 1.0);
        float fd = length(cameraPosition - vW);
        float ff = smoothstep(uFogRange.x, uFogRange.y, fd);
        col = mix(col, uFogColor, ff); alpha = mix(alpha, 1.0, ff);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const geo = new THREE.PlaneGeometry(420, 420, 1, 1); geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 5; mesh.castShadow = false; mesh.receiveShadow = false;
  scene.add(mesh);
  let ri = 0;
  return {
    mesh, uniforms,
    ripple(x, z, amp = 1) { ripples[ri].set(x, z, UW.uTime.value, amp); ri = (ri + 1) % NR; },
  };
}
