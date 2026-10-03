import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { mulberry32, smoothstep, lerp, damp, clamp } from '../core/noise.js';
import { makeMoonTexture } from './textures.js';

// 只給主相機看的物件（草、雨、星星、viewmodel）放這層，水面反射相機不會畫到
export const LAYER_NO_REFLECT = 1;

export const WEATHER = {
  clear:    { label: '晴', cloud: 0.28, density: 0.45, haze: 0.0,  fog: 0.0011, rain: 0, wind: 0.35, sun: 1.0 },
  overcast: { label: '陰', cloud: 0.92, density: 0.9,  haze: 0.45, fog: 0.0024, rain: 0, wind: 0.55, sun: 0.38 },
  rain:     { label: '雨', cloud: 1.0,  density: 1.0,  haze: 0.8,  fog: 0.0065, rain: 1, wind: 1.0,  sun: 0.22 },
  fog:      { label: '霧', cloud: 0.6,  density: 0.7,  haze: 1.0,  fog: 0.028,  rain: 0, wind: 0.15, sun: 0.3 },
};
export const WEATHER_ORDER = ['clear', 'overcast', 'rain', 'fog'];

const C = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
const FOG_DAY = C(0.69, 0.78, 0.88);
const FOG_DUSK = C(0.86, 0.60, 0.44);
const FOG_NIGHT = C(0.018, 0.026, 0.05);
const FOG_GREY = C(0.63, 0.66, 0.69);
const FOG_WATER = C(0.04, 0.22, 0.3);
const SUN_NOON = C(1.0, 0.97, 0.9);
const SUN_LOW = C(1.0, 0.56, 0.3);
const MOON_COL = C(0.55, 0.65, 0.95);
const HEMI_SKY_DAY = C(0.62, 0.76, 1.0);
const HEMI_SKY_NIGHT = C(0.16, 0.22, 0.42);
const HEMI_GROUND = C(0.5, 0.47, 0.4);

export class Environment {
  /** @param photos Assets.textures（可選的照片貼圖） */
  constructor(scene, camera, photos = {}) {
    this.photos = photos;
    this.scene = scene;
    this.camera = camera;
    this.time = 9.5; // 0..24 小時
    this.dayLength = 600; // 一整天的秒數
    this.elapsed = 0;

    this.weatherName = 'clear';
    this.auto = true;
    this.nextChange = 90;
    this.w = { ...WEATHER.clear }; // 目前（內插中）的天氣參數
    this.rng = mulberry32(1234);

    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.lightDir = new THREE.Vector3(0, 1, 0);
    this.dayFactor = 1;
    this.wind = { dir: new THREE.Vector2(0.8, 0.6).normalize(), strength: 0.35 };
    this.fogColor = new THREE.Color();
    this.grassLight = new THREE.Color(); // 近似的地面受光（環境＋直射）
    this.grassAmbient = new THREE.Color(); // 草 shader 用：天光
    this.grassSun = new THREE.Color(); // 草 shader 用：太陽直射（會再乘上陰影）
    this.underwater = false;
    this.flash = 0; // 閃電亮度 0..1
    this.strikeIn = 12;
    this.reflash = 0;
    this.onThunder = null;

    scene.fog = new THREE.FogExp2(0xffffff, 0.001);

    // 物理天空（Preetham）+ 內建雲層
    this.sky = new Sky();
    this.sky.scale.setScalar(5000);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    scene.add(this.sky);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -55;
    sc.right = sc.top = 55;
    sc.near = 1;
    sc.far = 320;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.25;
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
    scene.add(this.hemi);

    this.#buildHaze();
    this.#buildStars();
    this.#buildMoon();
    this.#buildRain();
    this.update(0, camera.position);
  }

  setWeather(name, manual = true) {
    if (!WEATHER[name]) return;
    this.weatherName = name;
    if (manual) this.nextChange = this.elapsed + 150;
  }

  cycleWeather() {
    const i = WEATHER_ORDER.indexOf(this.weatherName);
    this.setWeather(WEATHER_ORDER[(i + 1) % WEATHER_ORDER.length]);
  }

  get isNight() {
    return this.time >= 19.5 || this.time < 5.2;
  }

  get clock() {
    const h = Math.floor(this.time);
    const m = Math.floor((this.time - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /** 霧色貼在天空底部，讓遠景與天空在任何天氣下都接得起來 */
  #buildHaze() {
    this.hazeUniforms = {
      uColor: { value: new THREE.Color() },
      uHaze: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.hazeUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uHaze;
        varying vec3 vDir;
        void main() {
          float horizon = 1.0 - smoothstep(-0.02, 0.3, vDir.y);
          float a = clamp(uHaze + horizon * horizon * (1.0 - uHaze), 0.0, 1.0);
          gl_FragColor = vec4(uColor, a);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    this.haze = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), mat);
    this.haze.scale.setScalar(900);
    this.haze.frustumCulled = false;
    this.haze.renderOrder = -8;
    this.scene.add(this.haze);
  }

  #buildStars() {
    const count = 2200;
    const rand = mulberry32(99);
    const pos = new Float32Array(count * 3);
    const mag = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const u = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      pos[i * 3] = Math.cos(a) * s;
      pos[i * 3 + 1] = u;
      pos[i * 3 + 2] = Math.sin(a) * s;
      mag[i] = rand();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
    this.starUniforms = { uOpacity: { value: 0 }, uTime: { value: 0 }, uScale: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.starUniforms,
      vertexShader: /* glsl */ `
        attribute float aMag;
        uniform float uTime;
        uniform float uScale;
        varying float vAlpha;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          float twinkle = 0.75 + 0.25 * sin(uTime * (1.5 + aMag * 4.0) + aMag * 100.0);
          // 接近地平線的星星被大氣吃掉
          float up = normalize(world.xyz - cameraPosition).y;
          vAlpha = (0.35 + 0.65 * aMag * aMag) * twinkle * smoothstep(0.02, 0.25, up);
          gl_PointSize = (1.2 + aMag * aMag * 2.6) * uScale;
          vec4 p = projectionMatrix * viewMatrix * world;
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vAlpha;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.1, length(d)) * vAlpha * uOpacity;
          gl_FragColor = vec4(vec3(0.9, 0.94, 1.0) * 2.6, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    });
    this.stars = new THREE.Points(geo, mat);
    this.stars.scale.setScalar(800);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -9;
    this.stars.layers.set(LAYER_NO_REFLECT);
    this.scene.add(this.stars);
  }

  #buildMoon() {
    // 有月面照片（等距柱狀投影）就貼在球上，沒有才用程序畫的圓盤。
    // 顏色刻意超過 1：畫面是 HDR 再 tone mapping，月亮要夠亮才會帶一點光暈
    const photo = this.photos.moon;
    if (photo) photo.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(4.4, 4.5, 4.9),
      map: photo ?? makeMoonTexture(),
      transparent: true,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    this.moon = new THREE.Mesh(photo ? new THREE.SphereGeometry(1, 28, 18) : new THREE.CircleGeometry(1, 24), mat);
    this.moon.scale.setScalar(26);
    this.moon.frustumCulled = false;
    this.moon.renderOrder = -9;
    this.scene.add(this.moon);
  }

  #buildRain() {
    const count = 7000;
    this.rainCount = count;
    const rand = mulberry32(7);
    const base = new Float32Array(count * 2 * 4);
    for (let i = 0; i < count; i++) {
      const x = rand();
      const y = rand();
      const z = rand();
      const s = rand();
      for (let v = 0; v < 2; v++) {
        const k = (i * 2 + v) * 4;
        base[k] = x;
        base[k + 1] = y;
        base[k + 2] = z;
        base[k + 3] = v === 0 ? s : -s - 1e-3; // 負值代表雨絲尾端
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    geo.setAttribute('aBase', new THREE.BufferAttribute(base, 4));
    this.rainUniforms = {
      uTime: { value: 0 },
      uWind: { value: new THREE.Vector2() },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color(0.7, 0.75, 0.8) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.rainUniforms,
      vertexShader: /* glsl */ `
        attribute vec4 aBase;
        uniform float uTime;
        uniform vec2 uWind;
        varying float vAlpha;
        const vec3 BOX = vec3(36.0, 22.0, 36.0);
        void main() {
          float rnd = abs(aBase.w);
          float speed = 19.0 + rnd * 9.0;
          vec3 p = aBase.xyz * BOX;
          p.y -= uTime * speed;
          p.xz += uWind * uTime;
          // 以相機為中心循環，雨永遠跟著玩家
          p = mod(p - cameraPosition, BOX) - BOX * 0.5;
          if (aBase.w < 0.0) p += vec3(uWind.x * 0.025, 0.5 + rnd * 0.25, uWind.y * 0.025);
          vAlpha = (aBase.w < 0.0 ? 0.0 : 1.0) * smoothstep(18.0, 12.0, length(p.xz));
          gl_Position = projectionMatrix * viewMatrix * vec4(cameraPosition + p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          gl_FragColor = vec4(uColor, vAlpha * uOpacity);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    this.rain = new THREE.LineSegments(geo, mat);
    this.rain.frustumCulled = false;
    this.rain.layers.set(LAYER_NO_REFLECT);
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  setShadowQuality(size) {
    this.sun.castShadow = size > 0;
    if (size > 0 && this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
  }

  update(dt, focus) {
    this.elapsed += dt;
    this.time = (this.time + (dt / this.dayLength) * 24) % 24;

    // ---- 天氣狀態機 ----
    if (this.auto && this.elapsed > this.nextChange) {
      const r = this.rng();
      const next = r < 0.45 ? 'clear' : r < 0.7 ? 'overcast' : r < 0.88 ? 'rain' : 'fog';
      this.weatherName = next === this.weatherName ? 'clear' : next;
      this.nextChange = this.elapsed + 70 + this.rng() * 80;
    }
    const target = WEATHER[this.weatherName];
    const w = this.w;
    for (const k of ['cloud', 'density', 'haze', 'fog', 'rain', 'wind', 'sun']) {
      w[k] = damp(w[k], target[k], 0.35, dt);
    }

    // ---- 閃電：下大雨時不定時打，一次閃兩下 ----
    this.flash *= Math.exp(-dt * 9);
    if (w.rain > 0.6) {
      this.strikeIn -= dt;
      if (this.strikeIn <= 0) {
        this.strikeIn = 9 + this.rng() * 22;
        this.flash = 1;
        this.reflash = 0.14;
        this.onThunder?.(0.4 + this.rng() * 2.2);
      }
    }
    if (this.reflash > 0) {
      this.reflash -= dt;
      if (this.reflash <= 0) this.flash = Math.max(this.flash, 0.7);
    }

    // ---- 太陽 / 月亮 ----
    const a = ((this.time - 6) / 24) * Math.PI * 2;
    this.sunDir.set(Math.cos(a), Math.sin(a), 0.32).normalize();
    const sy = this.sunDir.y;
    const day = smoothstep(-0.36, 0.16, sy); // 日落後留約一個半小時的暮光
    this.dayFactor = day;
    const night = 1 - day;

    const sunUp = smoothstep(-0.04, 0.2, sy);
    const moonUp = smoothstep(0.06, 0.3, -sy);
    if (sy > -0.04) {
      this.lightDir.copy(this.sunDir);
      this.sun.color.copy(SUN_LOW).lerp(SUN_NOON, smoothstep(0.05, 0.45, sy));
      this.sun.intensity = 4.4 * sunUp * w.sun;
    } else {
      this.lightDir.copy(this.sunDir).multiplyScalar(-1);
      this.sun.color.copy(MOON_COL);
      this.sun.intensity = 1.9 * moonUp * lerp(1, 0.3, w.haze);
    }
    // 光源太貼地平線時陰影會拉得極長，稍微抬高
    this.lightDir.y = Math.max(this.lightDir.y, 0.12);
    this.lightDir.normalize();
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(this.lightDir, 150);

    this.hemi.color.copy(HEMI_SKY_NIGHT).lerp(HEMI_SKY_DAY, day);
    this.hemi.groundColor.copy(HEMI_GROUND);
    this.hemi.intensity = lerp(1.35, 3.0, day) * lerp(1, 0.8, w.haze * day);

    const direct = this.sun.intensity * Math.max(this.lightDir.y, 0) * 0.85;
    this.grassAmbient.copy(this.hemi.color).multiplyScalar(this.hemi.intensity / Math.PI);
    this.grassSun.copy(this.sun.color).multiplyScalar(direct / Math.PI);
    this.hemi.intensity += this.flash * 7;
    this.grassLight
      .copy(this.hemi.color)
      .multiplyScalar(this.hemi.intensity)
      .add(_c.copy(this.sun.color).multiplyScalar(direct))
      .multiplyScalar(1 / Math.PI);

    // ---- 天空 ----
    const u = this.sky.material.uniforms;
    // Preetham 天空在太陽一落到地平線下就全黑；把負仰角壓縮，暮光才會慢慢退
    u.sunPosition.value.copy(this.sunDir);
    if (sy < 0) u.sunPosition.value.y = sy * 0.3;
    u.turbidity.value = lerp(2.2, 9, w.haze);
    u.rayleigh.value = lerp(1.6, 0.7, w.haze);
    u.mieCoefficient.value = lerp(0.004, 0.012, w.haze);
    u.mieDirectionalG.value = 0.8;
    u.cloudCoverage.value = w.cloud;
    u.cloudDensity.value = w.density;
    u.cloudSpeed.value = 0.00004;
    u.time.value += dt * (0.5 + w.wind * 2);
    u.showSunDisc.value = w.haze < 0.6 ? 1 : 0;
    this.sky.position.copy(focus);

    // ---- 霧 ----
    const dusk = smoothstep(0.32, 0.0, Math.abs(sy)) * (1 - w.haze);
    this.fogColor.copy(FOG_NIGHT).lerp(FOG_DAY, day).lerp(FOG_DUSK, dusk * 0.7 * smoothstep(-0.3, 0.02, sy));
    const grey = _c.copy(FOG_GREY).multiplyScalar(lerp(0.05, 1, day));
    this.fogColor.lerp(grey, clamp(w.haze * 1.1, 0, 1));
    let density = w.fog * lerp(1.25, 1, day);

    this.underwater = this.camera.position.y < -0.05;
    if (this.underwater) {
      this.fogColor.copy(FOG_WATER).multiplyScalar(lerp(0.12, 1, day));
      density = 0.11;
    }
    if (this.flash > 0.01 && !this.underwater) this.fogColor.lerp(_c.setScalar(0.85), this.flash * 0.55);
    this.scene.fog.color.copy(this.fogColor);
    this.scene.fog.density = density;
    this.hazeUniforms.uColor.value.copy(this.fogColor);
    this.hazeUniforms.uHaze.value = this.underwater ? 1 : smoothstep(0.15, 1, w.haze);
    this.haze.position.copy(this.camera.position);

    // ---- 星星與月亮 ----
    const starVis = night * (1 - smoothstep(0.4, 0.95, w.cloud)) * (this.underwater ? 0 : 1);
    this.starUniforms.uOpacity.value = starVis;
    this.starUniforms.uTime.value = this.elapsed;
    this.stars.visible = starVis > 0.01;
    this.stars.position.copy(this.camera.position);
    this.stars.rotation.z = (this.time / 24) * Math.PI * 2;

    const moonVis = smoothstep(0.0, 0.2, -sy) * (1 - w.haze * 0.9);
    this.moon.visible = moonVis > 0.01 && !this.underwater;
    this.moon.material.opacity = moonVis;
    _v.copy(this.sunDir).multiplyScalar(-1);
    this.moon.position.copy(this.camera.position).addScaledVector(_v, 800);
    this.moon.lookAt(this.camera.position);

    // ---- 風與雨 ----
    this.wind.strength = w.wind * (0.8 + 0.2 * Math.sin(this.elapsed * 0.23));
    const rainOn = w.rain > 0.02 && !this.underwater;
    this.rain.visible = rainOn;
    if (rainOn) {
      this.rainUniforms.uTime.value = this.elapsed;
      this.rainUniforms.uWind.value.copy(this.wind.dir).multiplyScalar(6 * w.wind);
      this.rainUniforms.uOpacity.value = 0.5 * w.rain;
      this.rainUniforms.uColor.value.setScalar(lerp(0.12, 0.75, day));
      this.rain.geometry.setDrawRange(0, Math.floor(this.rainCount * clamp(w.rain, 0, 1)) * 2);
    }
  }
}

const _c = new THREE.Color();
const _v = new THREE.Vector3();
