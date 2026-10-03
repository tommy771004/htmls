import * as THREE from 'three';
import { mulberry32, createNoise2D, smoothstep } from '../core/noise.js';
import { SEED } from './terrain.js';
import { LAYER_NO_REFLECT } from './environment.js';

const CELL = 16;
const LOD_NEAR = 14;
const LOD_FAR = 46;
const FAR_DENSITY = 0.3;

const vertexShader = /* glsl */ `
  attribute vec3 aOffset;
  attribute vec4 aParams; // yaw, 高度, 排序用亂數(0..1 遞增), 相位/色偏

  uniform float uTime;
  uniform vec2 uWindDir;
  uniform float uWindStrength;
  uniform vec3 uPlayer;
  uniform float uRadius;
  uniform float uWidth;
  uniform vec3 uFirePos;
  uniform vec3 uFireColor;
  uniform vec3 uSpotPos;
  uniform vec3 uSpotDir;
  uniform vec3 uSpotColor;
  uniform vec2 uSpotCos; // 外圈、內圈的 cos

  varying float vY;
  varying vec3 vFire;
  varying float vTint;
  varying vec3 vWorld;

  #include <common>
  #include <fog_pars_vertex>
  #include <shadowmap_pars_vertex>

  void main() {
    float dist = distance(aOffset.xz, cameraPosition.xz);
    float lodT = smoothstep(${LOD_NEAR.toFixed(1)}, ${LOD_FAR.toFixed(1)}, dist);

    // 遠處逐步抽稀（亂數門檻），留下的葉片加寬補回覆蓋率，避免 LOD 跳動
    float keep = mix(1.0, ${FAR_DENSITY.toFixed(2)}, lodT);
    float alive = smoothstep(0.0, 0.06, keep - aParams.z);
    float edge = 1.0 - smoothstep(uRadius * 0.75, uRadius, dist);
    float h = aParams.y * alive * edge;
    float w = uWidth * mix(1.0, 2.1, lodT);

    float c = cos(aParams.x);
    float s = sin(aParams.x);
    float t = position.y;
    float t2 = t * t;
    vec3 p = vec3(position.x * w * c, t * h, -position.x * w * s);

    // 風：大尺度陣風沿風向掃過 + 每根草自己的抖動
    float phase = aParams.w * 6.2831;
    float along = dot(aOffset.xz, uWindDir);
    float gust = sin(along * 0.07 - uTime * 1.1) * 0.5 + 0.5;
    gust *= sin(along * 0.023 + aOffset.x * 0.011 - uTime * 0.37) * 0.5 + 0.5;
    float flutter = sin(uTime * (2.4 + aParams.w * 1.5) + phase + along * 0.6);
    float bend = uWindStrength * (0.1 + 0.75 * gust + 0.13 * flutter);
    vec2 lean = uWindDir * bend + vec2(sin(phase), cos(phase)) * 0.14;

    // 玩家踩過時把草往外推
    vec2 away = aOffset.xz - uPlayer.xz;
    float pd = length(away);
    float push = (1.0 - smoothstep(0.25, 1.4, pd)) * step(abs(aOffset.y - uPlayer.y), 2.0);
    lean += (away / max(pd, 1e-3)) * push * 0.85;

    p.xz += lean * t2 * h;
    p.y -= min(dot(lean, lean), 1.0) * t2 * h * 0.4;

    // worldPosition / transformedNormal 是 three 內建陰影 chunk 需要的名字
    vec4 worldPosition = vec4(aOffset + p, 1.0);
    vec3 transformedNormal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    vWorld = worldPosition.xyz;
    vec4 mvPosition = viewMatrix * worldPosition;
    gl_Position = projectionMatrix * mvPosition;
    vY = t;
    vTint = aParams.w;
    float fd = distance(aOffset, uFirePos);
    vFire = uFireColor * (1.0 - smoothstep(12.0, 28.0, fd)) / pow(max(fd, 1.0), 1.7);
    vec3 sp = aOffset + vec3(0.0, h * 0.5, 0.0) - uSpotPos;
    float sd = length(sp);
    float cone = smoothstep(uSpotCos.x, uSpotCos.y, dot(sp / max(sd, 1e-3), uSpotDir));
    vFire += uSpotColor * cone * (1.0 - smoothstep(30.0, 55.0, sd)) / pow(max(sd, 1.0), 1.5);
    #include <fog_vertex>
    #include <shadowmap_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uTip;
  uniform vec3 uAmbient;
  uniform vec3 uSun;
  uniform vec3 uSunDir;

  varying float vY;
  varying float vTint;
  varying vec3 vFire;
  varying vec3 vWorld;

  #include <common>
  #include <packing>
  #include <bsdfs>
  #include <fog_pars_fragment>
  #include <lights_pars_begin>
  #include <shadowmap_pars_fragment>
  #include <shadowmask_pars_fragment>

  void main() {
    vec3 col = mix(uBase, uTip, vY * vY);
    col *= 0.82 + 0.36 * vTint;
    col *= mix(0.82, 1.08, vY); // 根部假 AO
    // 少數草葉的尖端畫成小花（白、黃、紫），遠看是草地上的點點色彩
    float flower = step(0.955, vTint) * smoothstep(0.74, 0.9, vY);
    float kind = fract(vTint * 37.0);
    vec3 petal = kind < 0.4 ? vec3(0.95, 0.93, 0.85) : kind < 0.75 ? vec3(0.95, 0.78, 0.12) : vec3(0.55, 0.32, 0.8);
    col = mix(col, petal, flower);
    // 太陽直射要乘上陰影（樹下的草會變暗）；逆光看過去時葉片透光發亮
    float shadow = getShadowMask();
    vec3 toEye = normalize(cameraPosition - vWorld);
    float backlit = pow(max(dot(-toEye, uSunDir), 0.0), 4.0) * vY;
    vec3 light = uAmbient + uSun * shadow * (1.0 + backlit * 1.3) + vFire;
    gl_FragColor = vec4(col * light, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function makeBlade() {
  // 三段收尖的葉片：7 個頂點、5 個三角形
  const pos = new Float32Array([
    -0.5, 0, 0, 0.5, 0, 0,
    -0.4, 0.38, 0, 0.4, 0.38, 0,
    -0.25, 0.72, 0, 0.25, 0.72, 0,
    0, 1, 0,
  ]);
  const idx = new Uint16Array([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6]);
  return { pos: new THREE.BufferAttribute(pos, 3), idx: new THREE.BufferAttribute(idx, 1) };
}

export class Grass {
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;
    this.blade = makeBlade();
    this.patchNoise = createNoise2D(SEED + 21);
    this.cells = new Map();
    this.pool = [];
    this.queue = [];
    this.lastCell = null;
    this.radius = 64;
    this.density = 8;
    this.capacity = 0;
    this.bladeCount = 0;

    this.uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      THREE.UniformsLib.lights,
      {
        uTime: { value: 0 },
        uWindDir: { value: new THREE.Vector2(1, 0) },
        uWindStrength: { value: 0.3 },
        uPlayer: { value: new THREE.Vector3() },
        uRadius: { value: this.radius },
        uWidth: { value: 0.085 },
        // 根部顏色要接近地面的草地貼圖，草才像是從地上長出來的
        uBase: { value: new THREE.Color().setRGB(88 / 255, 104 / 255, 46 / 255, THREE.SRGBColorSpace) },
        uTip: { value: new THREE.Color().setRGB(136 / 255, 158 / 255, 76 / 255, THREE.SRGBColorSpace) },
        uAmbient: { value: new THREE.Color(1, 1, 1) },
        uSun: { value: new THREE.Color(0, 0, 0) },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uFirePos: { value: new THREE.Vector3(0, -999, 0) },
        uFireColor: { value: new THREE.Color(0, 0, 0) },
        uSpotPos: { value: new THREE.Vector3() },
        uSpotDir: { value: new THREE.Vector3(0, 0, -1) },
        uSpotColor: { value: new THREE.Color(0, 0, 0) },
        uSpotCos: { value: new THREE.Vector2(0.8, 0.95) },
      },
    ]);
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      side: THREE.DoubleSide,
      fog: true,
      lights: true, // 要用 three 的陰影 uniform 就必須開
    });
    this.setQuality(this.radius, this.density);
  }

  setQuality(radius, density) {
    if (radius === this.radius && density === this.density && this.capacity) return;
    for (const cell of this.cells.values()) this.#dispose(cell);
    for (const cell of this.pool) this.#dispose(cell);
    this.cells.clear();
    this.pool.length = 0;
    this.queue.length = 0;
    this.lastCell = null;
    this.radius = radius;
    this.density = density;
    this.capacity = Math.ceil(CELL * CELL * density);
    this.uniforms.uRadius.value = radius;
  }

  #dispose(cell) {
    this.scene.remove(cell.mesh);
    cell.mesh.geometry.dispose();
  }

  #allocate() {
    const cell = this.pool.pop();
    if (cell) return cell;
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', this.blade.pos);
    geo.setIndex(this.blade.idx);
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 3), 3));
    geo.setAttribute('aParams', new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 4), 4));
    geo.boundingSphere = new THREE.Sphere();
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.layers.set(LAYER_NO_REFLECT);
    return { mesh, count: 0, cx: 0, cz: 0 };
  }

  #generate(ci, cj) {
    const cell = this.#allocate();
    const geo = cell.mesh.geometry;
    const off = geo.attributes.aOffset.array;
    const par = geo.attributes.aParams.array;
    const rand = mulberry32((ci * 92837111) ^ (cj * 689287499) ^ SEED);
    const x0 = ci * CELL;
    const z0 = cj * CELL;
    let n = 0;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < this.capacity; i++) {
      const x = x0 + rand() * CELL;
      const z = z0 + rand() * CELL;
      const yaw = rand() * Math.PI;
      const hr = rand();
      const tint = rand();
      const f = this.terrain.fertility(x, z);
      if (f <= 0 || rand() > f) continue;
      const y = this.terrain.getHeight(x, z);
      const patch = this.patchNoise(x * 0.03, z * 0.03) * 0.5 + 0.5;
      off[n * 3] = x;
      off[n * 3 + 1] = y;
      off[n * 3 + 2] = z;
      par[n * 4] = yaw;
      par[n * 4 + 1] = (0.25 + 0.42 * patch) * (0.7 + 0.6 * hr) * (0.6 + 0.4 * f);
      par[n * 4 + 3] = tint;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      n++;
    }
    // 位置本身是亂數序，所以直接用序號當抽稀門檻，instanceCount 就能從尾端裁掉
    for (let i = 0; i < n; i++) par[i * 4 + 2] = i / n;
    geo.attributes.aOffset.needsUpdate = true;
    geo.attributes.aParams.needsUpdate = true;
    geo.instanceCount = n;
    const midY = n ? (minY + maxY) / 2 : 0;
    geo.boundingSphere.center.set(x0 + CELL / 2, midY, z0 + CELL / 2);
    geo.boundingSphere.radius = CELL * 0.75 + (n ? (maxY - minY) / 2 : 0) + 1.5;
    cell.count = n;
    cell.cx = x0;
    cell.cz = z0;
    cell.mesh.visible = n > 0;
    this.scene.add(cell.mesh);
    return cell;
  }

  #cellDistance(cell, x, z) {
    const dx = Math.max(cell.cx - x, 0, x - (cell.cx + CELL));
    const dz = Math.max(cell.cz - z, 0, z - (cell.cz + CELL));
    return Math.hypot(dx, dz);
  }

  /** @param budget 這個 frame 最多生成幾格（初始化時給 Infinity） */
  update(dt, camPos, playerPos, env, budget = 2) {
    const u = this.uniforms;
    u.uTime.value += dt;
    u.uWindDir.value.copy(env.wind.dir);
    u.uWindStrength.value = env.wind.strength;
    u.uPlayer.value.copy(playerPos);
    u.uAmbient.value.copy(env.grassAmbient);
    u.uSun.value.copy(env.grassSun);
    u.uSunDir.value.copy(env.lightDir);

    const ci = Math.floor(camPos.x / CELL);
    const cj = Math.floor(camPos.z / CELL);
    const cellKey = ci + ':' + cj;
    if (cellKey !== this.lastCell) {
      this.lastCell = cellKey;
      const r = Math.ceil(this.radius / CELL);
      this.queue.length = 0;
      for (let i = ci - r; i <= ci + r; i++) {
        for (let j = cj - r; j <= cj + r; j++) {
          const k = i + ':' + j;
          if (this.cells.has(k)) continue;
          const d = Math.hypot((i + 0.5) * CELL - camPos.x, (j + 0.5) * CELL - camPos.z);
          if (d < this.radius + CELL * 0.71) this.queue.push({ i, j, k, d });
        }
      }
      this.queue.sort((a, b) => b.d - a.d); // 近的排最後，pop 先拿到
      for (const [k, cell] of this.cells) {
        if (this.#cellDistance(cell, camPos.x, camPos.z) > this.radius + CELL) {
          this.scene.remove(cell.mesh);
          this.pool.push(cell);
          this.cells.delete(k);
        }
      }
    }
    while (budget-- > 0 && this.queue.length) {
      const q = this.queue.pop();
      if (!this.cells.has(q.k)) this.cells.set(q.k, this.#generate(q.i, q.j));
    }

    let total = 0;
    for (const cell of this.cells.values()) {
      if (!cell.count) continue;
      const d = this.#cellDistance(cell, camPos.x, camPos.z);
      const keep = 1 + (FAR_DENSITY - 1) * smoothstep(LOD_NEAR, LOD_FAR, d);
      const n = d > this.radius ? 0 : Math.min(cell.count, Math.ceil(cell.count * keep) + 1);
      cell.mesh.geometry.instanceCount = n;
      cell.mesh.visible = n > 0;
      total += n;
    }
    this.bladeCount = total;
  }
}
