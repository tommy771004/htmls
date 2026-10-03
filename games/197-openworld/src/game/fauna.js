// 動物的造型與外部動物模型。
// 鹿與兔子沒有可用的外部模型，所以用「放樣」(loft) 沿脊椎拉出連續的有機曲面，
// 取代原本膠囊＋球拼起來的積木感；毛色用頂點色（背深腹淺）加一張細碎的毛流貼圖。

import * as THREE from 'three';
import { mulberry32, lerp, clamp, smoothstep, damp } from '../core/noise.js';
import { LAYER_NO_REFLECT } from '../world/environment.js';

const TAU = Math.PI * 2;
const _c = new THREE.Color();

/** 細碎的毛流貼圖（灰階，乘在頂點色上） */
let furTexture = null;
function getFurTexture() {
  if (furTexture) return furTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#c8c8c8';
  g.fillRect(0, 0, size, size);
  const rand = mulberry32(606);
  for (let i = 0; i < 2600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 4 + rand() * 9;
    const v = rand() < 0.5 ? 255 : 90;
    g.strokeStyle = `rgba(${v},${v},${v},${0.1 + rand() * 0.22})`;
    g.lineWidth = 0.7;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rand() - 0.5) * 2, y + len);
    g.stroke();
  }
  furTexture = new THREE.CanvasTexture(canvas);
  furTexture.wrapS = furTexture.wrapT = THREE.RepeatWrapping;
  furTexture.colorSpace = THREE.SRGBColorSpace;
  return furTexture;
}

let furMaterial = null;
export function getFurMaterial() {
  if (!furMaterial) furMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, map: getFurTexture() });
  return furMaterial;
}

/**
 * 沿一串斷面放樣出封閉曲面。
 * @param sections [{ p: [x, y, z], rx, ry }]  rx = 水平半徑、ry = 垂直半徑
 * @param colorFn  (sinA, t, p) → [r, g, b]（sRGB）；sinA = 1 是背部、-1 是腹部，t = 沿長度 0..1
 */
export function loft(sections, colorFn, radial = 10) {
  const pos = [];
  const nor = [];
  const uv = [];
  const col = [];
  const idx = [];
  const P = sections.map((s) => new THREE.Vector3(...s.p));
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const push = (p, normal, u, t, sinA) => {
    pos.push(p.x, p.y, p.z);
    nor.push(normal.x, normal.y, normal.z);
    uv.push(u, t * 3);
    const c = colorFn(sinA, t, p);
    _c.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
    col.push(_c.r, _c.g, _c.b);
  };
  const last = sections.length - 1;
  for (let i = 0; i <= last; i++) {
    tangent.copy(P[Math.min(i + 1, last)]).sub(P[Math.max(i - 1, 0)]).normalize();
    side.crossVectors(worldUp, tangent);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    up.crossVectors(tangent, side).normalize();
    const { rx, ry } = sections[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      v.copy(P[i]).addScaledVector(side, ca * rx).addScaledVector(up, sa * ry);
      n.set(0, 0, 0).addScaledVector(side, ca / Math.max(rx, 1e-4)).addScaledVector(up, sa / Math.max(ry, 1e-4)).normalize();
      push(v, n, (j / radial) * 2, i / last, sa);
    }
  }
  const ring = radial + 1;
  for (let i = 0; i < last; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * ring + j;
      idx.push(a, a + 1, a + ring, a + 1, a + ring + 1, a + ring);
    }
  }
  // 兩端各補一個中心點封口
  for (const end of [0, last]) {
    tangent.copy(P[end === 0 ? 0 : last]).sub(P[end === 0 ? 1 : last - 1]).normalize();
    const centre = pos.length / 3;
    push(P[end], tangent, 0.5, end === 0 ? 0 : 1, 0);
    for (let j = 0; j < radial; j++) {
      const a = end * ring + j;
      if (end === 0) idx.push(centre, a + 1, a);
      else idx.push(centre, a, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}

const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const FUR = [0.52, 0.36, 0.22];
const FUR_DARK = [0.34, 0.23, 0.14];
const CREAM = [0.9, 0.86, 0.76];

/** 背深腹淺的毛色；dorsal 越大背部那條深色越明顯 */
const coat = (base, belly, dorsal = 0.5) => (sinA) => {
  const c = mix3(belly, base, smoothstep(-0.75, -0.05, sinA));
  return mix3(c, FUR_DARK, smoothstep(0.7, 1, sinA) * dorsal);
};

function mesh(parent, geo, x, y, z, shadow = false) {
  const m = new THREE.Mesh(geo, getFurMaterial());
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function joint(parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/**
 * 鹿的身體。前方為 -Z，掛在 group（原點在腳底）底下。
 * 回傳動畫需要操作的關節，結構與舊的膠囊版相同。
 */
export function buildDeer(group, buck, darkMat, antlerMat) {
  const body = joint(group, 0, 0.86, 0);
  // 軀幹：臀部 → 腰 → 胸，胸廓最深；尾端收成一點
  const torso = mesh(
    body,
    loft(
      [
        { p: [0, 0.02, 0.56], rx: 0.03, ry: 0.04 },
        { p: [0, 0.03, 0.47], rx: 0.15, ry: 0.19 },
        { p: [0, 0.02, 0.28], rx: 0.2, ry: 0.23 },
        { p: [0, 0.0, 0.02], rx: 0.19, ry: 0.22 },
        { p: [0, -0.01, -0.22], rx: 0.2, ry: 0.25 },
        { p: [0, 0.01, -0.4], rx: 0.17, ry: 0.23 },
        { p: [0, 0.05, -0.52], rx: 0.1, ry: 0.15 },
        { p: [0, 0.08, -0.58], rx: 0.04, ry: 0.07 },
      ],
      (sinA, t, p) => {
        // 臀部後側是白斑
        const c = coat(FUR, CREAM, 0.6)(sinA);
        return mix3(c, CREAM, smoothstep(0.38, 0.5, p.z) * smoothstep(0.5, -0.3, sinA) * 0.9);
      },
      12,
    ),
    0,
    0,
    0,
    true,
  );
  const tail = mesh(
    body,
    loft(
      [
        { p: [0, 0, 0], rx: 0.02, ry: 0.016 },
        { p: [0, 0.05, 0], rx: 0.026, ry: 0.014 },
        { p: [0, 0.11, 0], rx: 0.008, ry: 0.006 },
      ],
      (sinA) => mix3(CREAM, FUR_DARK, smoothstep(0.2, 0.9, sinA)),
      6,
    ),
    0,
    0.14,
    0.52,
  );
  tail.rotation.x = -2.2;
  tail.userData.keep = true;

  // 脖子：基部粗、往上收細，略微前傾的曲線
  const neck = joint(body, 0, 0.1, -0.42);
  mesh(
    neck,
    loft(
      [
        { p: [0, -0.08, 0.04], rx: 0.1, ry: 0.13 },
        { p: [0, 0.04, 0.01], rx: 0.105, ry: 0.13 },
        { p: [0, 0.2, 0.0], rx: 0.08, ry: 0.095 },
        { p: [0, 0.36, 0.0], rx: 0.068, ry: 0.078 },
        { p: [0, 0.46, 0.0], rx: 0.06, ry: 0.066 },
      ],
      (sinA, t) => mix3(coat(FUR, CREAM, 0.3)(-sinA * 0.6), CREAM, smoothstep(0.3, -0.9, sinA) * (1 - t) * 0.5),
      10,
    ),
    0,
    0,
    0,
    true,
  );
  const head = joint(neck, 0, 0.42, 0);
  // 頭：後腦 → 眼眶最寬 → 吻部收窄；下顎與喉部偏白
  const skull = mesh(
    head,
    loft(
      [
        { p: [0, 0.03, 0.09], rx: 0.03, ry: 0.035 },
        { p: [0, 0.04, 0.04], rx: 0.075, ry: 0.08 },
        { p: [0, 0.03, -0.05], rx: 0.082, ry: 0.085 },
        { p: [0, 0.01, -0.14], rx: 0.062, ry: 0.066 },
        { p: [0, -0.01, -0.22], rx: 0.042, ry: 0.046 },
        { p: [0, -0.015, -0.27], rx: 0.036, ry: 0.036 },
        { p: [0, -0.015, -0.29], rx: 0.014, ry: 0.014 },
      ],
      (sinA, t) => mix3(coat(FUR, CREAM, 0.4)(sinA), [0.1, 0.08, 0.07], smoothstep(0.86, 0.98, t)),
      10,
    ),
    0,
    0,
    0,
    true,
  );
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 6), darkMat);
    eye.position.set(side * 0.068, 0.05, -0.085);
    head.add(eye);
    // 耳朵：壓扁的葉片形，內側偏淺
    const ear = mesh(
      head,
      loft(
        [
          { p: [0, 0, 0], rx: 0.016, ry: 0.012 },
          { p: [0, 0.07, 0], rx: 0.04, ry: 0.014 },
          { p: [0, 0.15, 0], rx: 0.008, ry: 0.006 },
        ],
        (sinA) => mix3([0.8, 0.68, 0.6], FUR, smoothstep(-0.3, 0.3, sinA)),
        6,
      ),
      side * 0.065,
      0.09,
      0.03,
    );
    ear.rotation.set(-0.25, side * 0.5, -side * 0.75);
    if (buck) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.017, 0.36, 6), antlerMat);
      beam.position.set(side * 0.06, 0.24, 0.03);
      beam.rotation.set(0.3, 0, -side * 0.38);
      head.add(beam);
      for (const [y, tilt, len] of [[-0.06, 1.0, 0.15], [0.05, 0.75, 0.17], [0.14, 0.5, 0.12]]) {
        const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.01, len, 5), antlerMat);
        tine.position.set(side * 0.025, y, -0.045);
        tine.rotation.set(-tilt, 0, -side * 0.35);
        beam.add(tine);
      }
    }
  }

  // 四肢：大腿肌肉飽滿、往膝蓋收細；小腿細直，末端是深色的蹄
  const legs = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const front = sz < 0;
    const hip = joint(body, sx * 0.11, -0.08, sz * (front ? 0.36 : 0.38));
    mesh(
      hip,
      loft(
        [
          { p: [0, 0.06, 0], rx: 0.05, ry: front ? 0.07 : 0.1 },
          { p: [0, -0.08, front ? 0.0 : 0.02], rx: 0.055, ry: front ? 0.07 : 0.095 },
          { p: [0, -0.26, 0], rx: 0.036, ry: 0.045 },
          { p: [0, -0.4, 0], rx: 0.028, ry: 0.032 },
        ],
        () => FUR,
        8,
      ),
      0,
      0,
      0,
    );
    const knee = joint(hip, 0, -0.38, 0);
    mesh(
      knee,
      loft(
        [
          { p: [0, 0.02, 0], rx: 0.028, ry: 0.032 },
          { p: [0, -0.18, 0], rx: 0.02, ry: 0.024 },
          { p: [0, -0.32, 0], rx: 0.022, ry: 0.026 },
          { p: [0, -0.345, -0.005], rx: 0.03, ry: 0.036 },
          { p: [0, -0.39, -0.01], rx: 0.028, ry: 0.034 },
        ],
        (sinA, t) => mix3(mix3(FUR, CREAM, 0.25), [0.09, 0.08, 0.07], smoothstep(0.82, 0.9, t)),
        7,
      ),
      0,
      0,
      0,
    );
    legs.push({ hip, knee, front, left: sx < 0 });
  }
  return { body, torso, tail, neck, head, skull, legs };
}

const RABBIT = [0.6, 0.52, 0.42];

export function buildRabbit(group, darkMat) {
  const body = joint(group, 0, 0.13, 0);
  const torso = mesh(
    body,
    loft(
      [
        { p: [0, -0.01, 0.2], rx: 0.03, ry: 0.035 },
        { p: [0, 0.0, 0.14], rx: 0.1, ry: 0.11 },
        { p: [0, 0.01, 0.02], rx: 0.105, ry: 0.115 },
        { p: [0, 0.0, -0.09], rx: 0.085, ry: 0.09 },
        { p: [0, 0.03, -0.15], rx: 0.05, ry: 0.06 },
      ],
      coat(RABBIT, CREAM, 0.3),
      10,
    ),
    0,
    0,
    0,
    true,
  );
  const head = mesh(
    body,
    loft(
      [
        { p: [0, 0.0, 0.05], rx: 0.03, ry: 0.035 },
        { p: [0, 0.01, 0.01], rx: 0.062, ry: 0.065 },
        { p: [0, 0.0, -0.05], rx: 0.052, ry: 0.055 },
        { p: [0, -0.015, -0.1], rx: 0.03, ry: 0.032 },
        { p: [0, -0.02, -0.12], rx: 0.012, ry: 0.012 },
      ],
      (sinA, t) => mix3(coat(RABBIT, CREAM, 0.2)(sinA), [0.75, 0.55, 0.55], smoothstep(0.9, 1, t)),
      8,
    ),
    0,
    0.09,
    -0.13,
  );
  for (const side of [-1, 1]) {
    const ear = mesh(
      body,
      loft(
        [
          { p: [0, 0, 0], rx: 0.014, ry: 0.01 },
          { p: [0, 0.07, 0], rx: 0.026, ry: 0.01 },
          { p: [0, 0.15, 0], rx: 0.007, ry: 0.005 },
        ],
        (sinA) => mix3([0.85, 0.66, 0.62], RABBIT, smoothstep(-0.3, 0.3, sinA)),
        6,
      ),
      side * 0.03,
      0.14,
      -0.1,
    );
    ear.rotation.set(0.3, side * 0.3, -side * 0.18);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 5), darkMat);
    eye.position.set(side * 0.047, 0.105, -0.175);
    body.add(eye);
  }
  const tailMesh = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshLambertMaterial({ color: 0xf2efe8 }));
  tailMesh.position.set(0, 0.03, 0.2);
  body.add(tailMesh);
  return { body, torso, head };
}

// ---------------------------------------------------------------- 外部模型：飛鳥

/** 用外部的鳥類模型（含拍翅 morph 動畫）；每隻繞著一個緩慢漂移的中心盤旋 */
export class ModelBirds {
  static available(assets) {
    return ['stork', 'parrot', 'flamingo'].some((k) => assets.has(k));
  }

  constructor(game, centers) {
    this.game = game;
    this.centers = centers;
    const kinds = ['stork', 'parrot', 'flamingo'].filter((k) => game.assets.has(k));
    const rand = mulberry32(8811);
    this.birds = [];
    this.root = new THREE.Group();
    game.scene.add(this.root);
    for (let i = 0; i < 12; i++) {
      const kind = kinds[i % kinds.length];
      const model = game.assets.instance(kind);
      model.traverse((o) => {
        o.layers.set(LAYER_NO_REFLECT);
        o.frustumCulled = false;
        if (o.isMesh) o.castShadow = false;
      });
      const mixer = new THREE.AnimationMixer(model);
      const clip = model.userData.animations?.[0];
      if (clip) {
        const action = mixer.clipAction(clip);
        action.play();
        action.time = rand() * clip.duration;
        action.timeScale = kind === 'parrot' ? 1.6 : 1;
      }
      this.root.add(model);
      this.birds.push({
        model,
        mixer,
        flock: i % centers.length,
        r: 16 + rand() * 30,
        h: 16 + rand() * 22,
        speed: (0.14 + rand() * 0.1) * (rand() < 0.5 ? 1 : -1),
        phase: rand() * TAU,
      });
    }
  }

  update(dt, env) {
    // 天黑或下雨就不飛
    const show = env.dayFactor > 0.35 && env.w.rain < 0.5;
    this.root.visible = show;
    if (!show) return;
    const t = env.elapsed;
    const terrain = this.game.terrain;
    for (const b of this.birds) {
      const c = this.centers[b.flock];
      const drift = t * 0.02 + b.flock * 2;
      const cx = c.x + Math.cos(drift) * c.r;
      const cz = c.z + Math.sin(drift) * c.r;
      const a = t * b.speed + b.phase;
      const x = cx + Math.cos(a) * b.r;
      const z = cz + Math.sin(a) * b.r;
      // 高度相對於地面或水面，飛越山坡時才不會撞進地形
      const ground = Math.max(terrain.getHeight(x, z), 0);
      const y = ground + b.h + Math.sin(t * 0.5 + b.phase) * 2.5;
      b.model.position.set(x, damp(b.model.position.y || y, y, 1.5, dt), z);
      const dir = Math.sign(b.speed);
      b.model.rotation.set(0, Math.atan2(Math.sin(a) * dir, -Math.cos(a) * dir), -dir * 0.3, 'YXZ');
      b.mixer.update(dt);
    }
  }
}

// ---------------------------------------------------------------- 外部模型：野馬群

/** 一小群野馬沿著固定的環形路線小跑；玩家靠近時加速成奔跑 */
export class Herd {
  static available(assets) {
    return assets.has('horse');
  }

  constructor(game, centre) {
    this.game = game;
    const { terrain } = game;
    // 繞著 centre 找一圈平緩、不涉水的落腳點當路線
    this.path = [];
    const candidates = [centre, { x: centre.x - 60, z: centre.z + 40 }, { x: centre.x + 30, z: centre.z + 90 }, { x: centre.x - 120, z: centre.z - 30 }, { x: 0, z: 110 }];
    for (const c of candidates) {
      const path = [];
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU;
        for (let r = 60; r >= 18; r -= 6) {
          const x = c.x + Math.cos(a) * r;
          const z = c.z + Math.sin(a) * r;
          if (terrain.getHeight(x, z) > 0.6 && terrain.getNormal(x, z).y > 0.72) {
            path.push(new THREE.Vector2(x, z));
            break;
          }
        }
      }
      if (path.length > this.path.length) this.path = path;
      if (path.length >= 20) break;
    }
    this.enabled = this.path.length >= 10;
    this.horses = [];
    if (!this.enabled) return;
    this.length = [];
    this.total = 0;
    for (let i = 0; i < this.path.length; i++) {
      this.length.push(this.total);
      this.total += this.path[i].distanceTo(this.path[(i + 1) % this.path.length]);
    }
    const rand = mulberry32(8822);
    const coats = [[1, 1, 1], [0.55, 0.4, 0.3], [0.8, 0.7, 0.55], [0.35, 0.3, 0.28], [0.95, 0.9, 0.82]];
    for (let i = 0; i < 5; i++) {
      const model = game.assets.instance('horse');
      const tint = new THREE.Color().setRGB(...coats[i % coats.length]);
      model.traverse((o) => {
        o.layers.set(LAYER_NO_REFLECT);
        o.frustumCulled = false;
        if (o.isMesh) {
          o.material = o.material.clone();
          o.material.color.multiply(tint);
          o.castShadow = true;
        }
      });
      model.scale.setScalar(0.9 + rand() * 0.2);
      const mixer = new THREE.AnimationMixer(model);
      // Quaternius 的馬有 Idle／Walk／Run／Jump／Death 幾段，取小跑的 Run
      const clips = model.userData.animations ?? [];
      const clip = clips.find((c) => /\|Run$|^Run$/.test(c.name)) ?? clips[0];
      let action = null;
      if (clip) {
        action = mixer.clipAction(clip);
        action.play();
        action.time = rand() * clip.duration;
      }
      game.scene.add(model);
      this.horses.push({ model, mixer, action, lag: i * 4.2 + rand() * 1.5, lane: (rand() - 0.5) * 5, pitch: 0 });
    }
    this.s = 0;
    this.speed = 5;
  }

  #at(s, out) {
    s = ((s % this.total) + this.total) % this.total;
    let i = this.length.length - 1;
    while (i > 0 && this.length[i] > s) i--;
    const a = this.path[i];
    const b = this.path[(i + 1) % this.path.length];
    const seg = a.distanceTo(b) || 1;
    return out.copy(a).lerp(b, clamp((s - this.length[i]) / seg, 0, 1));
  }

  update(dt, player) {
    if (!this.enabled) return;
    const terrain = this.game.terrain;
    let near = false;
    const p = new THREE.Vector2();
    const q = new THREE.Vector2();
    for (const h of this.horses) {
      if (Math.hypot(h.model.position.x - player.pos.x, h.model.position.z - player.pos.z) < 32) near = true;
    }
    this.speed = damp(this.speed, near ? 10 : 5, 1.5, dt);
    this.s += this.speed * dt;
    for (const h of this.horses) {
      this.#at(this.s - h.lag, p);
      this.#at(this.s - h.lag + 2.5, q);
      const dx = q.x - p.x;
      const dz = q.y - p.y;
      const len = Math.hypot(dx, dz) || 1;
      // lane：往路線的側邊錯開，才不會排成一直線
      const x = p.x + (-dz / len) * h.lane;
      const z = p.y + (dx / len) * h.lane;
      const y = terrain.getHeight(x, z);
      const ahead = terrain.getHeight(x + (dx / len) * 1.2, z + (dz / len) * 1.2);
      h.pitch = damp(h.pitch, Math.atan2(ahead - y, 1.2), 6, dt);
      h.model.position.set(x, y, z);
      h.model.rotation.set(h.pitch, Math.atan2(-dx, -dz), 0, 'YXZ');
      if (h.action) h.action.timeScale = this.speed / 9;
      h.mixer.update(dt);
    }
  }
}
