import * as THREE from 'three';
import { damp, clamp } from '../core/noise.js';
import { LAYER_NO_REFLECT } from '../world/environment.js';
import { CAMP_LAYOUT } from '../world/camp.js';

const srgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
const MAG_SIZE = 12;
const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _hit = new THREE.Vector3();
const _muzzle = new THREE.Vector3();

// ---------------------------------------------------------------- 標靶

function targetTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const rings = ['#f4f1e6', '#1d1d1d', '#2b6cb0', '#c53030', '#ecc94b'];
  rings.forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(64, 64, 62 - i * 12, 0, Math.PI * 2);
    g.fill();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

class Target {
  constructor(scene, x, y, z, faceYaw, tex) {
    this.group = new THREE.Group();
    this.group.position.set(x, y, z);
    this.group.rotation.y = faceYaw;
    const wood = new THREE.MeshLambertMaterial({ color: srgb(0.4, 0.29, 0.18) });
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 0.1), wood);
    post.position.y = 0.65;
    post.castShadow = true;
    // 靶板繞底部鉸鏈往後倒
    this.hinge = new THREE.Group();
    this.hinge.position.y = 1.0;
    this.board = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, 0.05, 20),
      [wood, new THREE.MeshLambertMaterial({ map: tex }), wood],
    );
    this.board.rotation.x = Math.PI / 2;
    this.board.position.y = 0.55;
    this.board.castShadow = true;
    this.board.userData.target = this;
    this.hinge.add(this.board);
    this.group.add(post, this.hinge);
    scene.add(this.group);
    this.down = 0; // 倒下後剩餘秒數
    this.angle = 0;
  }

  hit() {
    if (this.down > 0) return false;
    this.down = 3;
    return true;
  }

  update(dt) {
    if (this.down > 0) this.down -= dt;
    this.angle = damp(this.angle, this.down > 0 ? 1.45 : 0, this.down > 0 ? 14 : 4, dt);
    this.hinge.rotation.x = -this.angle;
  }
}

// ---------------------------------------------------------------- 武器與 viewmodel

export class Weapons {
  constructor(game) {
    this.game = game;
    this.mag = MAG_SIZE;
    this.cooldown = 0;
    this.reload = 0;
    this.swing = 0;
    this.swingHit = false;
    this.recoil = 0;
    this.flash = 0;
    this.sway = new THREE.Vector2();
    this.raise = 0; // 0 = 收起, 1 = 舉起
    this.shown = null;
    this.score = 0;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.enableAll();

    // 第一人稱手部＋武器，掛在相機底下
    const { assets, camera, scene } = game;
    this.vm = new THREE.Group();
    this.hands = assets.instance('hands');
    // 手的模型是握拳狀：握把軸沿 Y 穿過原點，武器的握把 anchor 直接對上去
    this.models = { knife: assets.instance('knife'), gun: assets.instance('gun') };
    this.models.knife.position.set(0, 0, 0);
    this.models.knife.rotation.set(1.2, 0, 0); // 正握：刀尖朝前上方、刃口朝前
    this.models.gun.position.set(0, 0.005, 0);
    this.models.gun.rotation.set(0.02, 0, 0);
    this.vm.add(this.hands, this.models.knife, this.models.gun);
    this.vm.traverse((o) => {
      o.layers.set(LAYER_NO_REFLECT);
      o.frustumCulled = false;
      if (o.isMesh) o.castShadow = false;
    });
    this.vm.visible = false;
    camera.add(this.vm);

    this.muzzleLight = new THREE.PointLight(srgb(1, 0.75, 0.4), 0, 14, 1.6);
    scene.add(this.muzzleLight);
    this.flashMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.16),
      new THREE.MeshBasicMaterial({
        color: srgb(1, 0.85, 0.5),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    this.flashMesh.layers.set(LAYER_NO_REFLECT);
    this.flashMesh.position.set(0, 0.088, -0.19);
    this.flashMesh.visible = false;
    this.models.gun.add(this.flashMesh);

    // 彈道線與著彈點共用少量物件，循環使用
    this.tracer = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: srgb(1, 0.9, 0.6), transparent: true, opacity: 0.8, fog: false }),
    );
    this.tracer.frustumCulled = false;
    this.tracer.visible = false;
    this.tracerLife = 0;
    scene.add(this.tracer);
    this.puffs = [];
    const puffGeo = new THREE.IcosahedronGeometry(0.09, 0);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: srgb(0.8, 0.75, 0.65), transparent: true }));
      m.visible = false;
      scene.add(m);
      this.puffs.push({ mesh: m, life: 0 });
    }
    this.puffIndex = 0;

    this.targets = [];
    this.targetMeshes = [];
  }

  /** 營地朝湖反方向擺一排靶 */
  buildTargets() {
    const { scene, terrain } = this.game;
    const tex = targetTexture();
    const f = CAMP_LAYOUT.fire;
    const spots = [
      [-14, -12], [-19, -7], [-24, -15], [-31, -4], [-38, -18], [-47, -9],
    ];
    for (const [dx, dz] of spots) {
      const x = f.x + dx;
      const z = f.z + dz;
      const yaw = Math.atan2(f.x - x, f.z - z);
      const t = new Target(scene, x, terrain.getHeight(x, z), z, yaw, tex);
      this.targets.push(t);
      this.targetMeshes.push(t.board);
    }
  }

  get reserve() {
    return this.game.inventory.count('ammo');
  }

  #aim() {
    const cam = this.game.camera;
    cam.getWorldPosition(_origin);
    cam.getWorldDirection(_dir);
  }

  /** 對場景做 hitscan：地形、樹石、標靶、載具取最近者 */
  #trace(maxDist) {
    const { terrain, colliders } = this.game;
    this.#aim();
    let dist = maxDist;
    let target = null;
    const tHit = terrain.raycast(_origin, _dir, maxDist);
    if (tHit >= 0) dist = tHit;
    const cHit = colliders.raycast(_origin, _dir, dist);
    if (cHit >= 0 && cHit < dist) dist = cHit;
    this.raycaster.set(_origin, _dir);
    this.raycaster.far = dist;
    const hits = this.raycaster.intersectObjects(this.targetMeshes, false);
    if (hits.length) {
      dist = hits[0].distance;
      target = hits[0].object.userData.target;
    } else {
      const vh = this.raycaster.intersectObjects(this.game.vehicles.map((v) => v.group), true);
      if (vh.length) dist = vh[0].distance;
    }
    const any = target || dist < maxDist;
    _hit.copy(_origin).addScaledVector(_dir, dist);
    return { hit: any, target, point: _hit, dist };
  }

  #puff(point) {
    const p = this.puffs[this.puffIndex++ % this.puffs.length];
    p.mesh.position.copy(point);
    p.mesh.visible = true;
    p.life = 0.35;
  }

  #registerHit(target) {
    if (target?.hit()) {
      this.score++;
      this.game.audio.thunk();
      this.game.hud.hitMarker();
    }
  }

  #fire() {
    const { player, hud } = this.game;
    if (this.reload > 0 || this.cooldown > 0) return;
    if (this.mag <= 0) {
      hud.toast(this.reserve > 0 ? '彈匣空了，按 R 換彈' : '沒有子彈了');
      this.cooldown = 0.3;
      this.game.audio.dryFire();
      return;
    }
    this.mag--;
    this.game.audio.shot();
    this.game.wildlife?.scare(player.pos, 90);
    this.cooldown = 0.17;
    this.recoil = 1;
    this.flash = 0.05;
    player.kick += 0.035;
    const res = this.#trace(220);
    this.flashMesh.getWorldPosition(_muzzle);
    const pos = this.tracer.geometry.attributes.position;
    pos.setXYZ(0, _muzzle.x, _muzzle.y, _muzzle.z);
    pos.setXYZ(1, res.point.x, res.point.y, res.point.z);
    pos.needsUpdate = true;
    this.tracer.visible = true;
    this.tracerLife = 0.05;
    this.muzzleLight.position.copy(_muzzle);
    if (res.hit) this.#puff(res.point);
    this.#registerHit(res.target);
  }

  #startReload() {
    if (this.reload > 0 || this.mag >= MAG_SIZE) return;
    if (this.reserve <= 0) {
      this.game.hud.toast('沒有備用子彈');
      return;
    }
    this.reload = 1.3;
    this.game.audio.reload();
  }

  update(dt, input, active) {
    const { inventory, player } = this.game;
    const id = player.vehicle ? null : inventory.equippedId;

    // 切換武器時先放下再舉起
    if (id !== this.shown) {
      this.raise = damp(this.raise, 0, 16, dt);
      if (this.raise < 0.05) {
        this.shown = id;
        this.models.knife.visible = id === 'knife';
        this.models.gun.visible = id === 'gun';
        this.swing = 0;
        this.reload = 0;
      }
    } else {
      this.raise = damp(this.raise, id ? 1 : 0, 10, dt);
    }
    this.vm.visible = !!this.shown && this.raise > 0.02;

    this.cooldown = Math.max(0, this.cooldown - dt);
    const ready = active && this.shown === id && this.raise > 0.8;
    if (ready && id === 'gun') {
      if (input.clicked.has(0)) this.#fire();
      if (input.hit('KeyR')) this.#startReload();
    } else if (ready && id === 'knife') {
      if (input.clicked.has(0) && this.swing <= 0) {
        this.swing = 0.34;
        this.swingHit = false;
        this.game.audio.swish();
      }
    }

    if (this.reload > 0) {
      this.reload -= dt;
      if (this.reload <= 0) {
        const n = inventory.remove('ammo', MAG_SIZE - this.mag);
        this.mag += n;
      }
    }
    if (this.swing > 0) {
      this.swing -= dt;
      if (!this.swingHit && this.swing < 0.2) {
        this.swingHit = true;
        const res = this.#trace(2.4);
        if (res.hit) this.#puff(res.point);
        this.#registerHit(res.target);
      }
    }

    // ---- viewmodel 動畫 ----
    this.recoil = damp(this.recoil, 0, 14, dt);
    this.sway.x = damp(this.sway.x, clamp(-input.mouseDX * 0.0006, -0.04, 0.04), 8, dt);
    this.sway.y = damp(this.sway.y, clamp(input.mouseDY * 0.0006, -0.04, 0.04), 8, dt);
    const bobAmp = player.onGround ? Math.min(player.moveSpeed / 4.3, 1.5) * 0.012 : 0;
    const bx = Math.cos(player.bob) * bobAmp;
    const by = Math.abs(Math.sin(player.bob)) * bobAmp;
    const lower = (1 - this.raise) * 0.35 + (this.reload > 0 ? Math.sin(Math.min(1, (1.3 - this.reload) / 1.3) * Math.PI) * 0.16 : 0);
    const vm = this.vm;
    vm.position.set(0.23 + this.sway.x + bx, -0.21 - lower + this.sway.y - by, -0.5 + this.recoil * 0.05);
    vm.rotation.set(this.recoil * 0.22 - lower * 0.8, this.sway.x * 1.5, 0);
    if (this.swing > 0) {
      // 由右上往左下揮砍
      const k = 1 - this.swing / 0.34;
      const arc = Math.sin(k * Math.PI);
      vm.position.x -= arc * 0.24;
      vm.position.y -= arc * 0.05;
      vm.position.z -= arc * 0.2;
      vm.rotation.x -= arc * 0.5;
      vm.rotation.y += arc * 0.9;
      vm.rotation.z += arc * 0.5;
    }

    // ---- 特效 ----
    this.flash = Math.max(0, this.flash - dt);
    this.flashMesh.visible = this.flash > 0;
    if (this.flash > 0) this.flashMesh.rotation.z = Math.random() * 6.28;
    this.muzzleLight.intensity = this.flash > 0 ? 18 : 0;
    if (this.tracerLife > 0) {
      this.tracerLife -= dt;
      if (this.tracerLife <= 0) this.tracer.visible = false;
    }
    for (const p of this.puffs) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const k = Math.max(p.life / 0.35, 0);
      p.mesh.scale.setScalar(0.4 + (1 - k) * 1.8);
      p.mesh.material.opacity = k * 0.8;
      p.mesh.position.y += dt * 0.6;
      if (p.life <= 0) p.mesh.visible = false;
    }
    for (const t of this.targets) t.update(dt);
  }

  get magSize() {
    return MAG_SIZE;
  }
}
