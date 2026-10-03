import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { mulberry32 } from '../core/noise.js';
import { WATER_LEVEL, WORLD_SIZE, HEIGHTMAP_SIZE } from './terrain.js';

/** 以整數波數的正弦波疊出可無縫平鋪的水面 normal map */
function makeWaterNormals(size = 256) {
  const rand = mulberry32(4242);
  const waves = [];
  for (let i = 0; i < 26; i++) {
    const kx = Math.round((rand() * 2 - 1) * 9);
    const ky = Math.round((rand() * 2 - 1) * 9);
    const len = Math.hypot(kx, ky) || 1;
    waves.push({ kx, ky, amp: 1 / len, phase: rand() * Math.PI * 2 });
  }
  const height = new Float32Array(size * size);
  const TAU = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let h = 0;
      for (const w of waves) h += w.amp * Math.sin((w.kx * x + w.ky * y) * (TAU / size) + w.phase);
      height[y * size + x] = h;
    }
  }
  const data = new Uint8Array(size * size * 4);
  const strength = 2.2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = height[y * size + ((x - 1 + size) % size)];
      const r = height[y * size + ((x + 1) % size)];
      const d = height[((y - 1 + size) % size) * size + x];
      const u = height[((y + 1) % size) * size + x];
      let nx = (l - r) * strength;
      let ny = (d - u) * strength;
      const inv = 1 / Math.hypot(nx, ny, 1);
      const k = (y * size + x) * 4;
      data[k] = (nx * inv * 0.5 + 0.5) * 255;
      data[k + 1] = (ny * inv * 0.5 + 0.5) * 255;
      data[k + 2] = (inv * 0.5 + 0.5) * 255;
      data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

const WATER_COLOR = new THREE.Color(0x0b3a44);

export class WaterSurface {
  constructor(scene, terrain, photos = {}) {
    this.scene = scene;
    this.heightTexture = terrain.heightTexture;
    // 有真實的水面法線貼圖就用，沒有才用正弦波合成的
    if (photos.waternormals) {
      this.normals = photos.waternormals;
      this.normals.wrapS = this.normals.wrapT = THREE.RepeatWrapping;
    } else {
      this.normals = makeWaterNormals();
    }
    this.geometry = new THREE.PlaneGeometry(6000, 6000);
    this.mesh = null;
    this.reflectionSize = 0;
    this.skip = 1; // 每幾個 frame 更新一次反射
    this.frame = 0;
    this.setQuality(512, 1);
  }

  /** 反射貼圖尺寸在 Water 建構時決定，換畫質時重建 */
  setQuality(reflectionSize, skip) {
    this.skip = skip;
    if (reflectionSize === this.reflectionSize) return;
    this.reflectionSize = reflectionSize;
    const prevTime = this.mesh ? this.mesh.material.uniforms.time.value : 0;
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.material.uniforms.mirrorSampler.value.dispose();
      this.mesh.material.dispose();
    }
    const water = new Water(this.geometry, {
      textureWidth: reflectionSize,
      textureHeight: reflectionSize,
      waterNormals: this.normals,
      sunDirection: new THREE.Vector3(0, 1, 0),
      sunColor: 0xffffff,
      waterColor: 0x0b3a44,
      distortionScale: 1.6,
      alpha: 0.9,
      fog: true,
      side: THREE.DoubleSide,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.y = WATER_LEVEL;
    water.material.transparent = true;
    // 原 shader 的扭曲量是 1/距離，貼近水面（游泳、划船）時會爆掉而取樣到畫面外，這裡加上上限
    const distortion = '( 0.001 + 1.0 / distance ) * distortionScale';
    if (!water.material.fragmentShader.includes(distortion)) console.warn('[water] shader 版本不同，未套用扭曲上限');
    water.material.fragmentShader = water.material.fragmentShader
      .replace(distortion, `min( ${distortion}, 0.045 )`)
      // 原本只有大尺度波浪，貼近水面時一片平；疊兩層細波紋（遠處會被 mipmap 自然抹平）
      .replace(
        'return noise * 0.5 - 1.0;',
        `vec4 detail = texture2D( normalSampler, uv / 11.0 + vec2( time / 13.0, -time / 17.0 ) ) +
            texture2D( normalSampler, uv / 6.3 - vec2( time / 11.0, time / 19.0 ) );
          return noise * 0.5 - 1.0 + ( detail - 1.0 ) * 0.4;`,
      )
      .replace('uniform vec3 waterColor;', 'uniform vec3 waterColor;\nuniform sampler2D tHeight;\nuniform float uWorld;\nuniform float uHm;\nuniform float uDay;')
      // 用地形高度圖算水深：淺灘偏綠且較透明、岸邊一圈會動的浪花；
      // 水下看到的是水面背面（反射貼圖這時沒更新），改畫成透光的亮水色
      .replace(
        'gl_FragColor = vec4( outgoingLight, alpha );',
        `vec2 huv = ( ( worldPosition.xz / uWorld + 0.5 ) * ( uHm - 1.0 ) + 0.5 ) / uHm;
          float inside = step( abs( worldPosition.x ), uWorld * 0.5 ) * step( abs( worldPosition.z ), uWorld * 0.5 );
          float depth = mix( 20.0, - texture2D( tHeight, huv ).r, inside );
          float a = alpha;
          if ( gl_FrontFacing ) {
            float shallow = exp( - max( depth, 0.0 ) * 0.6 );
            outgoingLight += vec3( 0.04, 0.17, 0.15 ) * uDay * shallow * ( 1.0 - reflectance );
            float fn = texture2D( normalSampler, worldPosition.xz * 0.21 + vec2( time * 0.05, time * 0.03 ) ).r
              + texture2D( normalSampler, worldPosition.xz * 0.47 - vec2( time * 0.04, - time * 0.06 ) ).g;
            float foam = ( 1.0 - smoothstep( 0.02, 0.38, depth + ( fn - 1.0 ) * 0.22 ) )
              * smoothstep( 0.75, 1.1, fn + 0.3 * sin( depth * 22.0 - time * 2.0 ) );
            outgoingLight = mix( outgoingLight, vec3( 1.5 ) * ( 0.1 + 0.9 * uDay ), foam * 0.75 );
            a = max( alpha * mix( 0.3, 1.0, smoothstep( 0.0, 1.5, depth ) ), foam * 0.8 );
          } else {
            outgoingLight = waterColor * ( 5.0 + 5.0 * ( surfaceNormal.x + surfaceNormal.z ) );
          }
          gl_FragColor = vec4( outgoingLight, a );`,
      );
    Object.assign(water.material.uniforms, {
      tHeight: { value: this.heightTexture },
      uWorld: { value: WORLD_SIZE },
      uHm: { value: HEIGHTMAP_SIZE },
      uDay: { value: 1 },
    });
    water.material.uniforms.size.value = 3.5;
    water.material.uniforms.time.value = prevTime;
    water.name = 'water';

    // 反射 pass 會把整個場景再畫一次；低畫質時隔幀更新
    const renderReflection = water.onBeforeRender;
    water.onBeforeRender = (renderer, scene, camera) => {
      if (camera.position.y < WATER_LEVEL) return; // 水下不需要反射
      if (this.frame % this.skip !== 0) return;
      renderReflection(renderer, scene, camera);
    };
    this.mesh = water;
    this.scene.add(water);
  }

  update(dt, env) {
    this.frame++;
    const u = this.mesh.material.uniforms;
    u.time.value += dt * (0.35 + env.wind.strength * 0.5);
    u.sunDirection.value.copy(env.lightDir);
    u.sunColor.value.copy(env.sun.color).multiplyScalar(Math.min(env.sun.intensity / 3, 1));
    u.distortionScale.value = 1.2 + env.wind.strength * 1.6;
    u.waterColor.value.copy(WATER_COLOR).multiplyScalar(0.06 + 0.94 * env.dayFactor);
    u.uDay.value = env.dayFactor * (0.45 + 0.55 * env.w.sun);
  }
}
