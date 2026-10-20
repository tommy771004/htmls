// 從高空看到的地球：Natural Earth 陸地輪廓畫成等距圓柱貼圖（依緯度上色、極區冰層），
// 雲層取樣全球天氣（同一份 baseCover＋鋒面／颶風），夜側點亮大城市與沿岸的燈光，
// 球面依「軌跡下方的經緯度」轉到正下方，並按比例縮小放在相機前方（避免深度緩衝溢位）。
import * as THREE from 'three';
import { LAND } from '../land.js';
import { BIG_CITIES, PLACES } from '../core/places.js';
import { EARTH_R } from '../core/shuttle.js';
import { clamp, fbm, mulberry32, haversine } from '../core/math.js';

const TW = 2048;
const TH = 1024;
const CW = 512;
const CH = 256;

const VS = `varying vec3 vN; varying vec3 vW; varying vec2 vUv;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w; }`;
const FS = `uniform sampler2D uLand; uniform sampler2D uMask; uniform sampler2D uShelf; uniform sampler2D uLights; uniform sampler2D uCloud; uniform vec3 uSunDir; uniform float uAlpha; uniform float uDrift;
varying vec3 vN; varying vec3 vW; varying vec2 vUv;
float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5); }
float vn(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ return vn(p) * 0.5 + vn(p * 2.03) * 0.25 + vn(p * 4.01) * 0.15 + vn(p * 8.1) * 0.1; }
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
  float sd = dot(N, uSunDir);
  float day = smoothstep(-0.12, 0.18, sd);
  // 細節雜訊（貼圖每像素約 20 km，近看用程序雜訊補出海岸的碎形與地表紋理）
  vec2 q = vUv * vec2(2048.0, 1024.0);
  float dn = fbm(q * 0.9);
  float dn2 = fbm(q * 5.0 + 13.0);
  float lat = (vUv.y - 0.5) * 180.0;
  float m = texture2D(uMask, vUv).r;
  float isLand = smoothstep(0.47, 0.53, m + (dn - 0.5) * 0.35 + (dn2 - 0.5) * 0.12);
  float shelf = texture2D(uShelf, vUv).r;
  vec3 sea = mix(vec3(0.012, 0.05, 0.13), vec3(0.03, 0.17, 0.27), smoothstep(0.02, 0.5, shelf + (dn - 0.5) * 0.1));
  sea = mix(sea, vec3(0.78, 0.84, 0.9), smoothstep(71.0, 76.0, abs(lat) + (dn - 0.5) * 6.0)); // 海冰
  vec3 ground = texture2D(uLand, vUv).rgb * (0.78 + 0.32 * dn + 0.2 * (dn2 - 0.5));
  vec3 albedo = mix(sea, ground, isLand);
  float ocean = (1.0 - isLand) * (1.0 - smoothstep(71.0, 76.0, abs(lat)));
  float cl = texture2D(uCloud, vUv + vec2(uDrift, 0.0)).r;
  cl = smoothstep(0.12, 0.72, cl + (fbm(q * 1.6 + 7.0) - 0.5) * 0.7 * (0.4 + cl)) * smoothstep(0.02, 0.15, cl + 0.05);
  vec3 col = albedo * (0.04 + 1.05 * max(sd, 0.0));
  // 海面的太陽反光
  vec3 H = normalize(uSunDir + V);
  col += vec3(1.0, 0.92, 0.8) * pow(max(dot(N, H), 0.0), 90.0) * ocean * 0.9 * day;
  // 雲
  vec3 cloudCol = vec3(0.96) * (0.05 + 1.0 * max(sd + 0.05, 0.0));
  col = mix(col, cloudCol, cl * 0.9);
  // 夜側城市燈光
  vec3 lights = texture2D(uLights, vUv).rgb;
  col += lights * vec3(1.0, 0.72, 0.38) * 1.6 * (1.0 - day) * (1.0 - cl * 0.8);
  // 晨昏線的暖色與大氣邊緣
  float term = exp(-sd * sd * 90.0);
  col += vec3(0.9, 0.35, 0.1) * term * 0.1;
  float rim = pow(1.0 - max(dot(N, V), 0.0), 5.0);
  col = mix(col, vec3(0.35, 0.6, 1.0) * (0.1 + 1.0 * clamp(sd + 0.25, 0.0, 1.0)), rim * 0.6);
  gl_FragColor = vec4(col, uAlpha);
  #include <colorspace_fragment>
}`;

// 0..1 的等距圓柱座標
const ux = (lon) => ((lon + 180) / 360) * TW;
const uy = (lat) => ((90 - lat) / 180) * TH;

function landTexture() {
  // 1) 陸地遮罩（銳利版給海岸線、模糊版給大陸棚的淺水色）
  const mask = document.createElement('canvas');
  mask.width = TW;
  mask.height = TH;
  const m = mask.getContext('2d', { willReadFrequently: true });
  m.fillStyle = '#000';
  m.fillRect(0, 0, TW, TH);
  m.fillStyle = '#fff';
  for (const ring of LAND) {
    m.beginPath();
    ring.forEach(([lon, lat], i) => (i ? m.lineTo(ux(lon), uy(lat)) : m.moveTo(ux(lon), uy(lat))));
    m.closePath();
    m.fill();
  }
  // 南極洲在 1:110m 資料裡是貼著 -90° 的環，補一條保險
  m.fillRect(0, uy(-84), TW, TH - uy(-84));
  const md = m.getImageData(0, 0, TW, TH).data;
  const shelf = document.createElement('canvas');
  shelf.width = TW / 4;
  shelf.height = TH / 4;
  const sh = shelf.getContext('2d');
  sh.filter = 'blur(3px)';
  sh.drawImage(mask, 0, 0, TW / 4, TH / 4);
  // 2) 地表顏色（每個像素都當陸地上色，海陸交界交給著色器用遮罩切）
  const NZ = 256;
  const noise = new Float32Array(NZ * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NZ; i++) noise[j * NZ + i] = fbm(i / 18, j / 18, 4, 4410);
  const out = document.createElement('canvas');
  out.width = TW / 2;
  out.height = TH / 2;
  const o = out.getContext('2d');
  const W2 = TW / 2;
  const H2 = TH / 2;
  const img = o.createImageData(W2, H2);
  const d = img.data;
  for (let y = 0; y < H2; y++) {
    const lat = 90 - ((y + 0.5) / H2) * 180;
    const al = Math.abs(lat);
    for (let x = 0; x < W2; x++) {
      const k = (y * W2 + x) * 4;
      const n = noise[(y % NZ) * NZ + (x % NZ)];
      const n2 = noise[((y * 3) % NZ) * NZ + ((x * 3 + 77) % NZ)];
      // 熱帶雨林 → 副熱帶沙漠 → 溫帶 → 針葉林 → 凍原 → 冰
      const desert = clamp(1 - Math.abs(al - 24) / 11, 0, 1) * clamp(n * 1.6 - 0.1, 0, 1);
      const boreal = clamp((al - 48) / 10, 0, 1);
      const tundra = clamp((al - 62) / 6, 0, 1);
      let r = 0.2 + n * 0.1;
      let g = 0.25 + n * 0.08;
      let b = 0.13 + n * 0.03;
      r += (0.66 - r) * desert;
      g += (0.55 - g) * desert;
      b += (0.36 - b) * desert;
      r += (0.12 - r) * boreal * 0.6;
      g += (0.22 - g) * boreal * 0.6;
      r += (0.5 - r) * tundra;
      g += (0.5 - g) * tundra;
      b += (0.45 - b) * tundra;
      if (al > 74 || lat < -62) {
        r = 0.9;
        g = 0.93;
        b = 0.96;
      }
      const v = 0.85 + n2 * 0.3;
      d[k] = Math.min(255, r * v * 255);
      d[k + 1] = Math.min(255, g * v * 255);
      d[k + 2] = Math.min(255, b * v * 255);
      d[k + 3] = 255;
    }
  }
  o.putImageData(img, 0, 0);
  return { canvas: out, maskCanvas: mask, shelf, mask: md };
}

function lightsTexture(mask) {
  const c = document.createElement('canvas');
  c.width = TW;
  c.height = TH;
  const x = c.getContext('2d');
  x.fillStyle = '#000';
  x.fillRect(0, 0, TW, TH);
  x.globalCompositeOperation = 'lighter';
  const dot = (lon, lat, r, a) => {
    const g = x.createRadialGradient(ux(lon), uy(lat), 0, ux(lon), uy(lat), r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(ux(lon) - r, uy(lat) - r, r * 2, r * 2);
  };
  const cities = [...BIG_CITIES, ...PLACES.filter((p) => p.kind !== 'ocean').map((p) => [p.lat, p.lon])];
  const rnd = mulberry32(3301);
  for (const [lat, lon] of cities) {
    dot(lon, lat, 7, 0.9);
    for (let k = 0; k < 14; k++) dot(lon + (rnd() - 0.5) * 6, lat + (rnd() - 0.5) * 4, 2 + rnd() * 2, 0.35);
  }
  // 人口帶：中緯度陸地上隨機散布的小鎮
  for (let k = 0; k < 5200; k++) {
    const lat = -40 + rnd() * 100;
    const lon = -180 + rnd() * 360;
    const i = (Math.floor(uy(lat)) * TW + Math.floor(ux(lon))) * 4;
    if (mask[i] < 128) continue;
    const near = cities.some(([a, b]) => haversine(a, b, lat, lon) < 1400000);
    const w = (Math.abs(lat) > 20 && Math.abs(lat) < 56 ? 1 : 0.35) * (near ? 1 : 0.4);
    if (rnd() > w) continue;
    dot(lon, lat, 1.4 + rnd() * 1.6, 0.2 + rnd() * 0.3);
  }
  return c;
}

export class Earth {
  constructor(scene) {
    this.scene = scene;
    this.ready = false;
    this.cloudT = -999;
  }

  build() {
    const { canvas, maskCanvas, shelf, mask } = landTexture();
    const land = new THREE.CanvasTexture(canvas);
    land.colorSpace = THREE.SRGBColorSpace;
    const maskTex = new THREE.CanvasTexture(maskCanvas);
    maskTex.anisotropy = 4;
    const shelfTex = new THREE.CanvasTexture(shelf);
    const lights = new THREE.CanvasTexture(lightsTexture(mask));
    this.cloudCanvas = document.createElement('canvas');
    this.cloudCanvas.width = CW;
    this.cloudCanvas.height = CH;
    this.cloudImg = this.cloudCanvas.getContext('2d').createImageData(CW, CH);
    this.cloudTex = new THREE.CanvasTexture(this.cloudCanvas);
    this.cloudTex.wrapS = THREE.RepeatWrapping;
    this.u = {
      uLand: { value: land }, uMask: { value: maskTex }, uShelf: { value: shelfTex }, uLights: { value: lights }, uCloud: { value: this.cloudTex },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uAlpha: { value: 1 }, uDrift: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: true, fog: false });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 96), mat);
    this.mesh.matrixAutoUpdate = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -8;
    this.scene.add(this.mesh);
    this.ready = true;
  }

  // 雲量貼圖：天氣系統的全球雲量（颶風加上螺旋雲帶）
  updateClouds(weather) {
    const d = this.cloudImg.data;
    const cells = weather.allCells();
    for (let y = 0; y < CH; y++) {
      const lat = 90 - ((y + 0.5) / CH) * 180;
      for (let x = 0; x < CW; x++) {
        const lon = -180 + ((x + 0.5) / CW) * 360;
        let c = weather.baseCover(lat, lon);
        for (const cell of cells) {
          const dLat = lat - cell.lat;
          let dLon = lon - cell.lon;
          if (dLon > 180) dLon -= 360;
          if (dLon < -180) dLon += 360;
          const ky = dLat * 111;
          const kx = dLon * 111 * Math.cos((lat * Math.PI) / 180);
          const km = Math.hypot(kx, ky);
          const R = cell.radius;
          if (km > R * 2) continue;
          if (cell.kind === 'hurricane') {
            const a = Math.atan2(ky, kx);
            const arms = 0.5 + 0.5 * Math.sin(a * 2 - Math.log(km + 1) * 4.5 * Math.sign(cell.lat || 1));
            const k = clamp(1 - km / (R * 1.6), 0, 1);
            const eye = km < 14 ? 0 : 1;
            c = Math.max(c, (0.35 + 0.65 * arms) * k * 1.3 * eye);
          } else {
            const k = clamp(1 - km / (R * (cell.kind === 'front' ? 1.4 : 1.2)), 0, 1) * cell.intensity;
            c = Math.max(c, k * (cell.kind === 'front' ? 0.9 : 1));
          }
        }
        const v = clamp((c - 0.14) * 1.55, 0, 1);
        const k = (y * CW + x) * 4;
        d[k] = d[k + 1] = d[k + 2] = v * 255;
        d[k + 3] = 255;
      }
    }
    this.cloudCanvas.getContext('2d').putImageData(this.cloudImg, 0, 0);
    this.cloudTex.needsUpdate = true;
  }

  // alt：相機離地高度；lat/lon：相機正下方；camPos：世界座標；sunDir：世界座標
  update({ alt, lat, lon, cam, center, sunDir, weather, t }) {
    const show = alt > 2500;
    if (!show) {
      if (this.mesh) this.mesh.visible = false;
      return 0;
    }
    if (!this.ready) this.build();
    if (t - this.cloudT > 20 || this.cloudT < 0) {
      this.cloudT = t;
      this.updateClouds(weather);
    }
    const fade = clamp((alt - 2500) / 5000, 0, 1);
    this.mesh.visible = true;
    this.u.uAlpha.value = fade;
    this.u.uSunDir.value.copy(sunDir);
    // 球面座標 → 世界：讓 (lat, lon) 的「東、上、南」對到世界的 +x、+y、+z
    const la = (lat * Math.PI) / 180;
    const lo = (lon * Math.PI) / 180;
    const E = new THREE.Vector3(-Math.sin(lo), 0, -Math.cos(lo));
    const U = new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
    const Nn = new THREE.Vector3(-Math.sin(la) * Math.cos(lo), Math.cos(la), Math.sin(la) * Math.sin(lo));
    const rot = new THREE.Matrix4().set(E.x, E.y, E.z, 0, U.x, U.y, U.z, 0, -Nn.x, -Nn.y, -Nn.z, 0, 0, 0, 0, 1);
    // 真實地心在 center（世界座標），對相機等比縮小到 9000 m 內
    const rel = new THREE.Vector3().subVectors(center, cam);
    const s = 9000 / rel.length();
    const pos = new THREE.Vector3().copy(cam).addScaledVector(rel, s);
    const m = new THREE.Matrix4().makeScale(EARTH_R * s, EARTH_R * s, EARTH_R * s).premultiply(rot).setPosition(pos);
    this.mesh.matrix.copy(m);
    this.mesh.matrixWorldNeedsUpdate = true;
    this.u.uDrift.value = 0;
    return fade;
  }
}
