import * as THREE from 'three';
import { mulberry32 } from '../core/noise.js';
import { CAMP } from './terrain.js';
import { makeSoftSprite } from './textures.js';
import { LAYER_NO_REFLECT } from './environment.js';

const srgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

/** 營火：火焰、火星與會閃爍的點光源 */
export class Campfire {
  constructor(scene, terrain, colliders, x, z, photos = {}) {
    const y = terrain.getHeight(x, z);
    this.group = new THREE.Group();
    this.group.position.set(x, y, z);
    this.position = this.group.position;
    this.t = 0;
    const rand = mulberry32(31);

    const stoneMat = new THREE.MeshLambertMaterial({ color: srgb(0.42, 0.41, 0.4), flatShading: true });
    const stoneGeo = new THREE.IcosahedronGeometry(0.2, 0);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const s = new THREE.Mesh(stoneGeo, stoneMat);
      s.position.set(Math.cos(a) * 0.72, 0.08, Math.sin(a) * 0.72);
      s.scale.set(0.9 + rand() * 0.5, 0.7 + rand() * 0.4, 0.9 + rand() * 0.5);
      s.rotation.y = rand() * 6;
      s.castShadow = true;
      this.group.add(s);
    }
    const logMat = new THREE.MeshLambertMaterial({ color: srgb(0.2, 0.13, 0.08) });
    const logGeo = new THREE.CylinderGeometry(0.07, 0.085, 1.0, 6);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const log = new THREE.Mesh(logGeo, logMat);
      log.position.set(Math.cos(a) * 0.2, 0.3, Math.sin(a) * 0.2);
      log.rotation.set(0, -a, 0.95, 'YXZ');
      this.group.add(log);
    }

    // 火焰：三層加色混合的圓錐
    this.flames = [];
    const flameGeo = new THREE.ConeGeometry(0.3, 1, 7, 1, true);
    flameGeo.translate(0, 0.5, 0);
    const flameColors = [srgb(1, 0.32, 0.05), srgb(1, 0.58, 0.1), srgb(1, 0.9, 0.5)];
    flameColors.forEach((color, i) => {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      });
      const f = new THREE.Mesh(flameGeo, mat);
      f.position.y = 0.18;
      f.userData.base = 1 - i * 0.27;
      this.flames.push(f);
      this.group.add(f);
    });

    // 火星
    const count = 26;
    this.emberCount = count;
    this.emberSeed = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) this.emberSeed[i] = rand();
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.embers = new THREE.Points(
      eg,
      new THREE.PointsMaterial({
        color: srgb(1, 0.6, 0.2),
        size: 0.05,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    this.embers.frustumCulled = false;
    this.group.add(this.embers);

    // 煙：少量柔邊粒子往上飄、越高越大越淡
    const sprite = photos.smoke ?? makeSoftSprite();
    const smokeCount = 16;
    this.smokeCount = smokeCount;
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(smokeCount * 3), 3));
    sg.setAttribute('aAge', new THREE.BufferAttribute(new Float32Array(smokeCount), 1));
    this.smokeUniforms = { uMap: { value: sprite }, uScale: { value: 600 }, uTint: { value: new THREE.Color(0.5, 0.5, 0.5) } };
    this.smoke = new THREE.Points(
      sg,
      new THREE.ShaderMaterial({
        uniforms: this.smokeUniforms,
        vertexShader: /* glsl */ `
          attribute float aAge;
          uniform float uScale;
          varying float vAlpha;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = uScale * (0.35 + aAge * 1.5) / max(-mv.z, 0.5);
            vAlpha = sin(aAge * 3.1416) * (1.0 - aAge * 0.5);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D uMap;
          uniform vec3 uTint;
          varying float vAlpha;
          void main() {
            float a = texture2D(uMap, gl_PointCoord).a * vAlpha * 0.32;
            gl_FragColor = vec4(uTint, a);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    );
    this.smoke.frustumCulled = false;
    this.smoke.layers.set(LAYER_NO_REFLECT);
    this.smoke.position.y = 0.9;
    this.group.add(this.smoke);

    this.halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: sprite, color: srgb(1, 0.5, 0.15), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.3 }),
    );
    this.halo.scale.setScalar(3.2);
    this.halo.position.y = 0.7;
    this.halo.layers.set(LAYER_NO_REFLECT);
    this.group.add(this.halo);

    this.light = new THREE.PointLight(srgb(1, 0.52, 0.2), 40, 30, 1.7);
    this.light.position.set(0, 1.0, 0);
    this.group.add(this.light);

    scene.add(this.group);
    colliders.addCircle(x, z, 0.75, y + 0.45);
  }

  update(dt, env) {
    this.t += dt;
    const t = this.t;
    const gust = 0.2 * env.wind.strength;
    this.flames.forEach((f, i) => {
      const flick = 0.82 + 0.18 * Math.sin(t * (9 + i * 3.7) + i) + 0.1 * Math.sin(t * 23.1 + i * 2);
      const b = f.userData.base;
      f.scale.set(b * (1.05 - 0.12 * flick), b * 1.25 * flick, b * (1.05 - 0.12 * flick));
      f.rotation.y = t * (1.2 + i);
      f.rotation.z = gust * env.wind.dir.x * (1 + 0.5 * Math.sin(t * 3 + i));
      f.rotation.x = -gust * env.wind.dir.y;
    });
    const p = this.embers.geometry.attributes.position;
    for (let i = 0; i < this.emberCount; i++) {
      const s0 = this.emberSeed[i * 3];
      const s1 = this.emberSeed[i * 3 + 1];
      const s2 = this.emberSeed[i * 3 + 2];
      const life = (t * (0.35 + s0 * 0.4) + s1) % 1;
      const a = s2 * Math.PI * 2 + life * 3;
      const r = 0.1 + life * (0.25 + s0 * 0.4);
      p.setXYZ(i, Math.cos(a) * r + env.wind.dir.x * life * gust * 3, 0.4 + life * 2.4, Math.sin(a) * r + env.wind.dir.y * life * gust * 3);
    }
    p.needsUpdate = true;

    const sp = this.smoke.geometry.attributes.position;
    const sa = this.smoke.geometry.attributes.aAge;
    for (let i = 0; i < this.smokeCount; i++) {
      const seed = this.emberSeed[i * 3 % this.emberSeed.length];
      const age = (t * 0.2 + i / this.smokeCount) % 1;
      const drift = age * age * (2.5 + env.wind.strength * 9);
      sp.setXYZ(
        i,
        Math.sin(seed * 40 + age * 5) * 0.25 * age + env.wind.dir.x * drift,
        age * 5.5,
        Math.cos(seed * 31 + age * 4) * 0.25 * age + env.wind.dir.y * drift,
      );
      sa.setX(i, age);
    }
    sp.needsUpdate = true;
    sa.needsUpdate = true;
    // 煙本身不發光：顏色跟著環境亮度走，夜裡只被火光染一點橘
    const lum = Math.min(env.grassLight.r + env.grassLight.g + env.grassLight.b, 2.2) * 0.3;
    this.smokeUniforms.uTint.value.setRGB(0.42 * lum + 0.012 * (1 - env.dayFactor), 0.42 * lum + 0.005 * (1 - env.dayFactor), 0.43 * lum);
    this.halo.material.opacity = (0.12 + 0.3 * (1 - env.dayFactor)) * (0.8 + 0.2 * Math.sin(t * 12.7));

    const flicker = 0.85 + 0.1 * Math.sin(t * 11.3) + 0.08 * Math.sin(t * 27.7 + 1.3) + 0.05 * Math.sin(t * 5.1);
    // 白天壓低火光，避免蓋過日照；雨天火勢變小
    this.light.intensity = (14 + 34 * (1 - env.dayFactor)) * flicker * (1 - 0.35 * env.w.rain);
    this.light.position.set(0.05 * Math.sin(t * 13), 0.95 + 0.06 * Math.sin(t * 17), 0.05 * Math.cos(t * 11));
  }

  /** 草用自訂 shader，不吃場景光源，這裡把火光參數直接餵給它 */
  lightGrass(grass) {
    grass.uniforms.uFirePos.value.copy(this.position).y += 1;
    grass.uniforms.uFireColor.value.copy(this.light.color).multiplyScalar((this.light.intensity / Math.PI) * 0.7);
  }
}

/** 營地其他擺設：圍著營火的原木座椅 */
export function buildCampProps(scene, terrain, colliders, fire) {
  const logMat = new THREE.MeshLambertMaterial({ color: srgb(0.33, 0.23, 0.15) });
  const geo = new THREE.CylinderGeometry(0.22, 0.24, 1.9, 8);
  geo.rotateZ(Math.PI / 2);
  for (const a of [2.2, 4.1]) {
    const x = fire.position.x + Math.cos(a) * 2.3;
    const z = fire.position.z + Math.sin(a) * 2.3;
    const y = terrain.getHeight(x, z);
    const log = new THREE.Mesh(geo, logMat);
    log.position.set(x, y + 0.2, z);
    log.rotation.y = -a + Math.PI / 2;
    log.castShadow = log.receiveShadow = true;
    scene.add(log);
    colliders.addBox(x, z, 0.95, 0.24, log.rotation.y, y + 0.44);
  }
}

export const CAMP_LAYOUT = {
  fire: { x: CAMP.x, z: CAMP.z },
  // 帳篷門口朝營火；床放在帳內左側，座標是把帳篷 local (-1.0, -0.6) 轉到世界座標的結果
  tent: { x: CAMP.x - 5.8, z: CAMP.z + 3.7, yaw: 2.14 },
  bed: { x: CAMP.x - 5.77, z: CAMP.z + 4.87, yaw: 2.14 },
  spawn: { x: CAMP.x - 2.5, z: CAMP.z + 4.5 },
  car: { x: CAMP.x - 3, z: CAMP.z + 11, yaw: -1.9 },
};
