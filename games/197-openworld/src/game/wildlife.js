import * as THREE from 'three';
import { clamp, damp, mulberry32 } from '../core/noise.js';
import { LAYER_NO_REFLECT } from '../world/environment.js';
import { mergeStatic } from '../core/merge.js';
import { buildDeer, buildRabbit, ModelBirds, Herd } from './fauna.js';
import { CAMP, SEED, WORLD_SIZE, WATER_LEVEL } from '../world/terrain.js';

const srgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
const lambert = (c) => new THREE.MeshLambertMaterial({ color: srgb(...c) });
const TAU = Math.PI * 2;
const ACTIVE_RANGE = 160; // 超過這個距離的動物不更新也不畫
const wrap = (a) => {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  if (a < -Math.PI) a += TAU;
  return a;
};

const MAT = {
  fur: lambert([0.5, 0.34, 0.2]),
  furDark: lambert([0.36, 0.24, 0.15]),
  cream: lambert([0.88, 0.84, 0.74]),
  dark: lambert([0.08, 0.07, 0.06]),
  antler: lambert([0.72, 0.64, 0.5]),
  rabbit: lambert([0.62, 0.55, 0.46]),
};

function part(parent, geo, mat, x, y, z, shadow = false) {
  const m = new THREE.Mesh(geo, mat);
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

/** 所有地面動物共用的移動與狀態邏輯；前方為 -Z、原點在腳底 */
class Critter {
  constructor(game, rand) {
    this.game = game;
    this.rand = rand;
    this.group = new THREE.Group();
    this.group.rotation.order = 'YXZ';
    this.pos = this.group.position;
    this.yaw = rand() * TAU;
    this.heading = this.yaw;
    this.speed = 0;
    this.phase = 0;
    this.state = 'idle';
    this.timer = rand() * 5;
    this.alive = true;
    this.deadT = 0;
    this.scared = 0;
    this.hitMeshes = [];
    game.scene.add(this.group);
  }

  finish() {
    // 命中判定用的 mesh 與之後要做動畫的零件不能被合併掉
    for (const m of this.hitMeshes) {
      m.userData.target = this;
      m.userData.keep = true;
    }
    mergeStatic(this.group);
    this.group.traverse((o) => o.layers.set(LAYER_NO_REFLECT));
  }

  canStand(x, z) {
    const t = this.game.terrain;
    return t.getHeight(x, z) > 0.35 && t.getNormal(x, z).y > 0.62 && Math.hypot(x - CAMP.x, z - CAMP.z) > 9;
  }

  /** 找一個離玩家夠遠、可以站的地方 */
  relocate(minFromPlayer, maxFromCamp) {
    const { terrain, player } = this.game;
    for (let i = 0; i < 60; i++) {
      const a = this.rand() * TAU;
      const r = 25 + this.rand() * maxFromCamp;
      const x = CAMP.x + Math.cos(a) * r;
      const z = CAMP.z + Math.sin(a) * r;
      if (Math.abs(x) > WORLD_SIZE * 0.45 || Math.abs(z) > WORLD_SIZE * 0.45) continue;
      if (terrain.fertility(x, z) < 0.5) continue;
      if (player && Math.hypot(x - player.pos.x, z - player.pos.z) < minFromPlayer) continue;
      this.pos.set(x, terrain.getHeight(x, z), z);
      return true;
    }
    return false;
  }

  step(dt, targetSpeed, turnRate) {
    this.yaw += clamp(wrap(this.heading - this.yaw), -turnRate * dt, turnRate * dt);
    this.speed = damp(this.speed, targetSpeed, 5, dt);
    if (this.speed < 0.02) return;
    const nx = this.pos.x - Math.sin(this.yaw) * this.speed * dt;
    const nz = this.pos.z - Math.cos(this.yaw) * this.speed * dt;
    // 前方不能走（水、陡坡、營地）就轉向
    const ax = nx - Math.sin(this.yaw) * 1.2;
    const az = nz - Math.cos(this.yaw) * 1.2;
    if (!this.canStand(ax, az)) {
      this.heading += (this.rand() < 0.5 ? -1 : 1) * (0.9 + this.rand());
      this.speed *= 0.6;
      return;
    }
    this.pos.x = nx;
    this.pos.z = nz;
    this.game.colliders.resolve(this.pos, this.radius, this.pos.y);
    this.pos.y = this.game.terrain.getHeight(this.pos.x, this.pos.z);
    this.phase += dt * this.speed * this.stride;
  }

  hit() {
    if (!this.alive) return false;
    this.alive = false;
    this.deadT = 0;
    this.speed = 0;
    this.game.pickups.spawn('meat', this.pos.x + 0.5, this.pos.z + 0.3, this.meat);
    this.game.hud.toast(`獵到${this.label}，掉落生肉 ×${this.meat}`);
    return true;
  }

  scare() {
    if (this.alive) this.scared = 6;
  }

  update(dt, player) {
    const dx = this.pos.x - player.pos.x;
    const dz = this.pos.z - player.pos.z;
    const dist = Math.hypot(dx, dz);
    if (!this.alive) {
      // 屍體也要依距離決定顯示：獵到的當下牠可能還在顯示範圍外
      this.group.visible = dist < ACTIVE_RANGE;
      this.deadT += dt;
      this.group.rotation.z = damp(this.group.rotation.z, 1.5, 7, dt);
      // 側躺時身體中心會貼到地面，往上墊半個身寬才不會陷進地裡
      this.pos.y = this.game.terrain.getHeight(this.pos.x, this.pos.z) + 0.22 * Math.min(this.group.rotation.z / 1.5, 1);
      if (this.deadT > 30 && dist > 40 && this.relocate(120, 320)) {
        this.alive = true;
        this.group.rotation.z = 0;
        this.state = 'idle';
      }
      return;
    }
    this.group.visible = dist < ACTIVE_RANGE;
    if (!this.group.visible) return;
    this.scared = Math.max(0, this.scared - dt);
    this.think(dt, player, dist, Math.atan2(-dx, -dz));
    this.group.rotation.y = this.yaw;
    // 身體順著坡度前後傾，才不會在斜坡上水平浮著
    const t = this.game.terrain;
    const fx = -Math.sin(this.yaw) * 0.5;
    const fz = -Math.cos(this.yaw) * 0.5;
    const slope = Math.atan2(t.getHeight(this.pos.x + fx, this.pos.z + fz) - t.getHeight(this.pos.x - fx, this.pos.z - fz), 1);
    this.group.rotation.x = damp(this.group.rotation.x, slope, 8, dt);
    this.pose(dt);
  }
}

class Deer extends Critter {
  constructor(game, rand) {
    super(game, rand);
    this.label = '鹿';
    this.meat = 2;
    this.radius = 0.45;
    this.stride = 3.4;
    this.buck = rand() < 0.4;
    const s = this.buck ? 1.08 : 0.95;
    this.group.scale.setScalar(s);

    const parts = buildDeer(this.group, this.buck, MAT.dark, MAT.antler);
    this.body = parts.body;
    this.tail = parts.tail;
    this.neck = parts.neck;
    this.head = parts.head;
    this.legs = parts.legs;
    this.hitMeshes.push(parts.torso, parts.skull);
    this.graze = 0;
    this.finish();
  }

  think(dt, player, dist, toPlayer) {
    const threat = player.vehicle ? 22 : player.running ? 21 : 13;
    if ((dist < threat || this.scared > 0) && this.state !== 'flee') {
      this.state = 'flee';
      this.timer = 4;
    }
    this.timer -= dt;
    switch (this.state) {
      case 'flee':
        // 背對玩家跑，帶一點左右擺動才不會是一條直線
        if (dist < 70) this.heading = toPlayer + Math.PI + Math.sin(this.phase * 0.15) * 0.5;
        this.step(dt, 8.5, 4);
        if (this.timer <= 0 && dist > 55 && this.scared <= 0) this.#idle();
        break;
      case 'alert':
        this.heading = toPlayer;
        this.step(dt, 0, 2);
        if (dist > 30 || this.timer <= 0) this.#idle();
        break;
      case 'walk':
        this.step(dt, 1.1, 1.5);
        if (dist < 27) this.#alert();
        else if (this.timer <= 0) this.#idle();
        break;
      default:
        this.step(dt, 0, 1);
        if (dist < 27) this.#alert();
        else if (this.timer <= 0) {
          this.state = 'walk';
          this.timer = 3 + this.rand() * 6;
          this.heading = this.yaw + (this.rand() - 0.5) * 2.4;
        }
    }
  }

  #idle() {
    this.state = 'idle';
    this.timer = 4 + this.rand() * 9;
  }

  #alert() {
    this.state = 'alert';
    this.timer = 5 + this.rand() * 4;
  }

  pose(dt) {
    const run = clamp((this.speed - 2) / 5, 0, 1);
    const walk = clamp(this.speed / 1.1, 0, 1) * (1 - run);
    const p = this.phase;
    for (const leg of this.legs) {
      // 走：對角線同步；跑：前腳一組、後腳一組的跳躍步態
      const walkPhase = p + (leg.front === leg.left ? 0 : Math.PI);
      const runPhase = p * 0.75 + (leg.front ? 0 : 2.4) + (leg.left ? 0 : 0.35);
      const swing = Math.sin(walkPhase) * 0.45 * walk + Math.sin(runPhase) * 0.95 * run;
      const lift = Math.max(0, Math.cos(walkPhase)) * 0.6 * walk + Math.max(0, Math.cos(runPhase)) * 1.1 * run;
      leg.hip.rotation.x = swing;
      leg.knee.rotation.x = leg.front ? -lift : lift * 0.6;
    }
    this.body.rotation.x = Math.sin(p * 0.75 + 0.6) * 0.1 * run;
    this.body.position.y = 0.86 + Math.abs(Math.sin(p * 0.75)) * 0.12 * run;

    const grazing = this.state === 'idle' && this.timer > 1.2;
    this.graze = damp(this.graze, grazing ? 1 : 0, 3, dt);
    const nod = Math.sin(this.game.env.elapsed * 3 + this.pos.x) * 0.05 * this.graze;
    this.neck.rotation.x = -0.65 - this.graze * 1.35 + nod - run * 0.35;
    this.head.rotation.x = 0.6 + this.graze * 0.75 + run * 0.3;
    this.tail.rotation.x = -2.2 + (this.state === 'flee' ? 1.6 : Math.sin(this.game.env.elapsed * 5 + this.pos.z) * 0.15);
  }
}

class Rabbit extends Critter {
  constructor(game, rand) {
    super(game, rand);
    this.label = '兔子';
    this.meat = 1;
    this.radius = 0.15;
    this.stride = 5;
    const parts = buildRabbit(this.group, MAT.dark);
    this.body = parts.body;
    this.hitMeshes.push(parts.torso, parts.head);
    this.finish();
  }

  think(dt, player, dist, toPlayer) {
    this.timer -= dt;
    if (dist < (player.running ? 13 : 8) || this.scared > 0) {
      this.state = 'flee';
      this.heading = toPlayer + Math.PI + Math.sin(this.phase * 0.3) * 0.9;
      this.step(dt, 6.5, 7);
      return;
    }
    if (this.state === 'flee') {
      this.state = 'idle';
      this.timer = 2;
    }
    if (this.state === 'hop') {
      this.step(dt, 1.6, 3);
      if (this.timer <= 0) {
        this.state = 'idle';
        this.timer = 2 + this.rand() * 6;
      }
    } else {
      this.step(dt, 0, 1);
      if (this.timer <= 0) {
        this.state = 'hop';
        this.timer = 0.8 + this.rand() * 2;
        this.heading = this.yaw + (this.rand() - 0.5) * 3;
      }
    }
  }

  pose() {
    const moving = clamp(this.speed / 1.5, 0, 1);
    const hop = Math.abs(Math.sin(this.phase));
    this.body.position.y = 0.13 + hop * 0.16 * moving;
    this.body.rotation.x = Math.cos(this.phase * 2) * 0.25 * moving;
  }
}

// ---------------------------------------------------------------- 鳥群

class Birds {
  constructor(game, centers) {
    this.game = game;
    const rand = mulberry32(SEED + 501);
    const count = 28;
    // 一隻鳥 = 身體＋兩片翅膀，翅膀在 vertex shader 裡拍動
    const pos = [
      0, 0, -0.16, 0.035, 0, 0.1, -0.035, 0, 0.1,
      0.03, 0, -0.08, 0.03, 0, 0.07, 0.55, 0, 0.04,
      -0.03, 0, -0.08, -0.55, 0, 0.04, -0.03, 0, 0.07,
    ];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.MeshBasicMaterial({ color: srgb(0.1, 0.1, 0.12), side: THREE.DoubleSide });
    this.time = { value: 0 };
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.time;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float flap = sin(uTime * 9.0 + float(gl_InstanceID) * 1.7);
          transformed.y += abs(position.x) * flap * 0.55;`,
        );
    };
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(LAYER_NO_REFLECT);
    game.scene.add(this.mesh);
    this.birds = [];
    for (let i = 0; i < count; i++) {
      this.birds.push({
        flock: i % centers.length,
        r: 14 + rand() * 30,
        h: 32 + rand() * 26,
        speed: (0.16 + rand() * 0.12) * (rand() < 0.5 ? 1 : -1),
        phase: rand() * TAU,
        scale: 1.2 + rand() * 0.7,
      });
    }
    this.centers = centers;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.p = new THREE.Vector3();
    this.s = new THREE.Vector3();
  }

  update(dt, env) {
    // 天黑或下雨就不飛
    const show = env.dayFactor > 0.35 && env.w.rain < 0.5;
    this.mesh.visible = show;
    if (!show) return;
    this.time.value += dt;
    const t = env.elapsed;
    this.birds.forEach((b, i) => {
      const c = this.centers[b.flock];
      // 整群繞著中心慢慢漂移
      const drift = t * 0.02 + b.flock * 2;
      const cx = c.x + Math.cos(drift) * c.r;
      const cz = c.z + Math.sin(drift) * c.r;
      const a = t * b.speed + b.phase;
      this.p.set(cx + Math.cos(a) * b.r, b.h + Math.sin(t * 0.5 + b.phase) * 3, cz + Math.sin(a) * b.r);
      const dir = Math.sign(b.speed);
      const yaw = Math.atan2(Math.sin(a) * dir, -Math.cos(a) * dir);
      this.q.setFromEuler(this.e.set(0, yaw, -dir * 0.35, 'YXZ'));
      this.mesh.setMatrixAt(i, this.m.compose(this.p, this.q, this.s.setScalar(b.scale)));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- 螢火蟲

class Fireflies {
  constructor(game) {
    const count = 110;
    const rand = mulberry32(SEED + 502);
    const base = new Float32Array(count * 4);
    for (let i = 0; i < count * 4; i++) base[i] = rand();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aBase', new THREE.BufferAttribute(base, 4));
    this.uniforms = { uTime: { value: 0 }, uOpacity: { value: 0 }, uScale: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        attribute vec4 aBase;
        uniform float uTime;
        uniform float uScale;
        varying float vBlink;
        const vec3 BOX = vec3(44.0, 3.0, 44.0);
        void main() {
          vec3 p = aBase.xyz * BOX;
          // 緩慢飄移，並以相機為中心循環
          p.x += sin(uTime * 0.31 + aBase.w * 40.0) * 2.2;
          p.z += cos(uTime * 0.27 + aBase.w * 53.0) * 2.2;
          p.y += sin(uTime * 0.6 + aBase.w * 17.0) * 0.4;
          p.xz = mod(p.xz - cameraPosition.xz, BOX.xz) - BOX.xz * 0.5;
          vec3 world = vec3(cameraPosition.x + p.x, cameraPosition.y - 1.7 + p.y, cameraPosition.z + p.z);
          vBlink = pow(max(sin(uTime * (1.2 + aBase.w * 1.6) + aBase.w * 90.0), 0.0), 3.0) * smoothstep(22.0, 14.0, length(p.xz));
          vec4 mv = viewMatrix * vec4(world, 1.0);
          gl_PointSize = uScale * 60.0 / max(-mv.z, 1.0) + 1.5;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vBlink;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vec3(0.75, 1.0, 0.35) * 1.4, a * a * vBlink * uOpacity);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.layers.set(LAYER_NO_REFLECT);
    game.scene.add(this.points);
  }

  update(dt, env, pixelScale) {
    const vis = (1 - env.dayFactor) * (1 - env.w.rain) * (env.underwater ? 0 : 1);
    this.points.visible = vis > 0.05;
    this.uniforms.uTime.value += dt;
    this.uniforms.uOpacity.value = vis;
    this.uniforms.uScale.value = pixelScale;
  }
}

// ---------------------------------------------------------------- 魚躍漣漪

class Ripples {
  constructor(game) {
    this.game = game;
    this.rand = mulberry32(SEED + 503);
    this.timer = 6;
    this.rings = [];
    const geo = new THREE.RingGeometry(0.82, 1, 28);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, opacity: 0 }));
      mesh.visible = false;
      mesh.layers.set(LAYER_NO_REFLECT);
      mesh.renderOrder = 2;
      game.scene.add(mesh);
      this.rings.push({ mesh, life: 0, delay: 0 });
    }
  }

  update(dt, env) {
    const { player, terrain, audio } = this.game;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 5 + this.rand() * 12;
      for (let tries = 0; tries < 8; tries++) {
        const a = this.rand() * TAU;
        const r = 10 + this.rand() * 40;
        const x = player.pos.x + Math.cos(a) * r;
        const z = player.pos.z + Math.sin(a) * r;
        if (terrain.waterDepth(x, z) < 1.2) continue;
        // 一次魚躍 = 兩圈先後擴散的漣漪
        this.rings.slice(0, 2).forEach((ring, i) => {
          ring.mesh.position.set(x, WATER_LEVEL + 0.04, z);
          ring.life = 1;
          ring.delay = i * 0.35;
        });
        if (r < 35) audio.splash(0.45 * (1 - r / 35));
        break;
      }
    }
    for (const ring of this.rings) {
      if (ring.life <= 0) continue;
      if (ring.delay > 0) {
        ring.delay -= dt;
        continue;
      }
      ring.life -= dt * 0.55;
      const k = 1 - Math.max(ring.life, 0);
      ring.mesh.visible = ring.life > 0;
      ring.mesh.scale.setScalar(0.25 + k * 2.6);
      ring.mesh.material.opacity = (1 - k) * 0.5 * (0.15 + 0.85 * env.dayFactor);
    }
  }
}

// ---------------------------------------------------------------- 總管

export class Wildlife {
  constructor(game, lake) {
    this.game = game;
    const rand = mulberry32(SEED + 500);
    this.animals = [];
    for (let i = 0; i < 9; i++) {
      const deer = new Deer(game, rand);
      if (deer.relocate(35, 280)) this.animals.push(deer);
      else deer.group.visible = false;
    }
    for (let i = 0; i < 12; i++) {
      const rabbit = new Rabbit(game, rand);
      if (rabbit.relocate(18, 150)) this.animals.push(rabbit);
      else rabbit.group.visible = false;
    }
    for (const a of this.animals) game.weapons.targetMeshes.push(...a.hitMeshes);

    const flocks = [
      { x: lake.x, z: lake.z, r: 30 },
      { x: CAMP.x - 60, z: CAMP.z + 40, r: 110 },
    ];
    // 有外部鳥類模型就用（真的有拍翅動畫），沒有才退回三角形剪影
    this.birds = ModelBirds.available(game.assets) ? new ModelBirds(game, flocks) : new Birds(game, flocks);
    this.herd = Herd.available(game.assets) ? new Herd(game, { x: CAMP.x - 95, z: CAMP.z + 75 }) : null;
    this.fireflies = new Fireflies(game);
    this.ripples = new Ripples(game);
  }

  /** 槍聲等巨響：範圍內的動物全部受驚逃跑 */
  scare(pos, radius) {
    for (const a of this.animals) {
      if (Math.hypot(a.pos.x - pos.x, a.pos.z - pos.z) < radius) a.scare();
    }
  }

  update(dt, pixelScale) {
    const { player, env } = this.game;
    for (const a of this.animals) a.update(dt, player);
    this.birds.update(dt, env);
    this.herd?.update(dt, player);
    this.fireflies.update(dt, env, pixelScale);
    this.ripples.update(dt, env);
  }
}
