import * as THREE from 'three';
import { clamp, damp, mulberry32 } from '../core/noise.js';
import { LAYER_NO_REFLECT } from '../world/environment.js';
import { mergeStatic } from '../core/merge.js';

const srgb = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
const lambert = (c) => new THREE.MeshLambertMaterial({ color: srgb(...c) });
const TAU = Math.PI * 2;
const ROD_ANGLE = -2.5; // 釣竿相對於手掌的角度，配合釣魚姿勢約朝前上方 45°

/** 把角度差收斂到 [-π, π] */
const wrap = (a) => {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  if (a < -Math.PI) a += TAU;
  return a;
};

/**
 * 程序生成的人形骨架：前方為 -Z，原點在腳底。
 * 關節都是 Group，動畫只改 rotation，不需要 skinning。
 */
export class Humanoid {
  constructor({ skin, shirt, pants, hair, boots = [0.16, 0.12, 0.09], hat = null, sleeves = true, height = 1 }) {
    this.canSit = true;
    const mSkin = lambert(skin);
    const mShirt = lambert(shirt);
    const mPants = lambert(pants);
    const mHair = lambert(hair);
    const mBoots = lambert(boots);
    const mDark = lambert([0.06, 0.05, 0.05]);
    const add = (parent, geo, mat, x, y, z, shadow = false) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    const joint = (parent, x, y, z) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      parent.add(g);
      return g;
    };

    this.group = new THREE.Group();
    this.group.scale.setScalar(height);
    this.hips = joint(this.group, 0, 0.92, 0);
    add(this.hips, new THREE.CapsuleGeometry(0.115, 0.12, 4, 10).rotateZ(Math.PI / 2), mPants, 0, 0, 0, true);

    this.torso = joint(this.hips, 0, 0.06, 0);
    const chest = add(this.torso, new THREE.CapsuleGeometry(0.155, 0.27, 5, 12), mShirt, 0, 0.27, 0, true);
    chest.scale.set(1.18, 1, 0.78);
    add(this.torso, new THREE.CylinderGeometry(0.05, 0.06, 0.09, 8), mSkin, 0, 0.53, 0);

    this.head = joint(this.torso, 0, 0.58, 0);
    const skull = add(this.head, new THREE.SphereGeometry(0.112, 16, 12), mSkin, 0, 0.1, 0, true);
    skull.scale.set(0.95, 1.12, 1.03);
    const hairMesh = add(this.head, new THREE.SphereGeometry(0.121, 16, 10, 0, TAU, 0, Math.PI * 0.56), mHair, 0, 0.115, 0.012);
    hairMesh.scale.set(0.97, 1.1, 1.06);
    hairMesh.rotation.x = 0.28;
    for (const s of [-1, 1]) {
      add(this.head, new THREE.SphereGeometry(0.013, 6, 5), mDark, s * 0.04, 0.115, -0.103);
      add(this.head, new THREE.SphereGeometry(0.022, 6, 5), mSkin, s * 0.107, 0.1, 0); // 耳朵
    }
    add(this.head, new THREE.ConeGeometry(0.016, 0.04, 5).rotateX(-Math.PI / 2), mSkin, 0, 0.085, -0.118);
    if (hat) {
      const mHat = lambert(hat);
      add(this.head, new THREE.CylinderGeometry(0.2, 0.2, 0.012, 16), mHat, 0, 0.17, 0, true);
      add(this.head, new THREE.CylinderGeometry(0.105, 0.12, 0.1, 14), mHat, 0, 0.225, 0);
    }

    const limb = (side, isArm) => {
      if (isArm) {
        const shoulder = joint(this.torso, side * 0.22, 0.45, 0);
        add(shoulder, new THREE.CapsuleGeometry(0.05, 0.2, 4, 8), mShirt, 0, -0.14, 0, true);
        const elbow = joint(shoulder, 0, -0.29, 0);
        add(elbow, new THREE.CapsuleGeometry(0.041, 0.19, 4, 8), sleeves ? mShirt : mSkin, 0, -0.12, 0);
        const hand = add(elbow, new THREE.SphereGeometry(0.047, 8, 6), mSkin, 0, -0.27, 0);
        hand.scale.set(0.85, 1.15, 1);
        hand.userData.keep = true; // 釣竿會掛在手上
        return { root: shoulder, mid: elbow, end: hand };
      }
      const hip = joint(this.hips, side * 0.095, -0.05, 0);
      add(hip, new THREE.CapsuleGeometry(0.075, 0.29, 4, 8), mPants, 0, -0.21, 0, true);
      const knee = joint(hip, 0, -0.43, 0);
      add(knee, new THREE.CapsuleGeometry(0.058, 0.28, 4, 8), mPants, 0, -0.19, 0);
      add(knee, new THREE.BoxGeometry(0.1, 0.085, 0.25), mBoots, 0, -0.4, -0.045);
      return { root: hip, mid: knee };
    };
    this.armL = limb(-1, true);
    this.armR = limb(1, true);
    this.legL = limb(-1, false);
    this.legR = limb(1, false);

    mergeStatic(this.group);
    this.group.traverse((o) => o.layers.set(LAYER_NO_REFLECT));
    this.t = Math.random() * 10;
    this.blend = { sit: 0, walk: 0, fish: 0 };
  }

  /** 依目前的姿勢權重（坐、走、釣魚）算出各關節角度 */
  animate(dt, { walking = 0, sitting = false, fishing = false, phase = 0 }) {
    this.t += dt;
    const b = this.blend;
    b.sit = damp(b.sit, sitting ? 1 : 0, 6, dt);
    b.walk = damp(b.walk, walking, 8, dt);
    b.fish = damp(b.fish, fishing ? 1 : 0, 5, dt);
    const t = this.t;
    const s = Math.sin(phase);
    const w = b.walk;
    const sit = b.sit;
    const breathe = Math.sin(t * 1.6) * 0.012;

    this.hips.position.y = 0.92 - sit * 0.4 + Math.abs(Math.cos(phase)) * 0.025 * w;
    this.hips.rotation.y = s * 0.08 * w;
    this.torso.rotation.set(-0.06 * w - 0.22 * sit + breathe, -s * 0.12 * w, 0);
    this.torso.scale.y = 1 + breathe;

    // 腿：走路時前後擺、抬腿時彎膝；坐下時大腿打平、小腿垂下
    const leg = (L, sign) => {
      const swing = sign * s * 0.62 * w;
      const lift = Math.max(0, -sign * Math.cos(phase)) * 0.85 * w;
      L.root.rotation.x = swing + sit * 1.42;
      L.mid.rotation.x = -lift - sit * 1.3;
    };
    leg(this.legL, 1);
    leg(this.legR, -1);

    // 手臂：走路時與腿反向擺；坐著時伸手烤火；釣魚時右手持竿
    const idle = Math.sin(t * 0.9) * 0.03;
    const arm = (A, sign, fishing) => {
      A.root.rotation.x = -sign * s * 0.5 * w + sit * 0.85 + fishing * 1.05 + idle;
      A.root.rotation.z = sign * (0.08 + sit * 0.1);
      A.mid.rotation.x = 0.18 + 0.3 * w + sit * 0.5 + fishing * 0.35;
    };
    arm(this.armL, 1, b.fish * 0.75);
    arm(this.armR, -1, b.fish);
  }

  /** 頭轉向世界座標的某一點（限制在自然的轉頭角度內） */
  lookAt(yaw, dx, dz, dt, active) {
    const target = active ? clamp(wrap(Math.atan2(-dx, -dz) - yaw), -1.1, 1.1) : Math.sin(this.t * 0.4) * 0.25;
    this.head.rotation.y = damp(this.head.rotation.y, target, 5, dt);
  }
}

/** 目前可用的人物模型：Quaternius 的 CC0 角色（三個 NPC 各一個）＋動畫庫都在才用，否則用程序人形 */
export function bodyKind(assets) {
  return assets.npcClips?.length && assets.has('npcCamper') && assets.has('npcFisher') && assets.has('npcHiker') ? 'rigged' : null;
}

/** Universal Animation Library 的動畫名稱 → 用途 */
const CLIPS = {
  idle: 'Idle_Loop',
  talk: 'Idle_Talking_Loop',
  walk: 'Walk_Loop',
  run: 'Jog_Fwd_Loop',
  sit: 'Sitting_Idle_Loop',
  sitTalk: 'Sitting_Talking_Loop',
};

/**
 * 骨架人物：Quaternius 的角色模型（tools/build-characters.py 組好的頭＋服裝＋髮型），
 * 動畫直接播 Universal Animation Library（同一副 UE 命名的骨架，不需要轉換）。介面與 Humanoid 相同。
 * 待機、說話、走、跑、坐、坐著說話依權重混合；釣魚沒有現成動畫，在待機之上直接擺手臂的骨頭。
 */
export class RiggedBody {
  constructor(assets, { model, height = 1, hair = null }) {
    this.group = new THREE.Group();
    this.model = assets.instance(model);
    this.model.scale.setScalar(height);
    this.group.add(this.model);
    // 頭髮與眉毛的貼圖是灰階（原作在 shader 裡上色），依 look.hair 染色
    const hairColor = hair ? srgb(...hair.map((v) => Math.min(1, v * 2.2))) : null;
    this.model.traverse((o) => {
      o.layers.set(LAYER_NO_REFLECT);
      if (!o.isMesh) return;
      if (hairColor && /hair/i.test(o.material.name)) {
        o.material = o.material.clone();
        o.material.color.copy(hairColor);
      }
      o.frustumCulled = false; // 骨架動畫會讓網格離開 bind pose 的包圍球
      o.castShadow = true;
    });

    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const [key, name] of Object.entries(CLIPS)) {
      const clip = assets.npcClips.find((c) => c.name === name);
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      action.play();
      action.setEffectiveWeight(key === 'idle' ? 1 : 0);
      this.actions[key] = action;
    }
    this.bones = {};
    this.model.traverse((o) => {
      if (o.isBone) this.bones[o.name] = o;
    });
    this.head = this.bones.Head ?? null;
    // 釣竿掛在身體前方的固定位置（釣魚時每格移到右手的位置）
    this.rodMount = new THREE.Group();
    this.rodMount.position.set(0.24 * height, 1.08 * height, -0.2 * height);
    this.rodMount.rotation.x = -0.9;
    this.group.add(this.rodMount);
    this.canSit = !!this.actions.sit;
    this.t = Math.random() * 10;
    this.walkW = 0;
    this.runW = 0;
    this.sitW = 0;
    this.talkW = 0;
    this.fishW = 0;
    this.headYaw = 0;
  }

  /** 把一根骨頭轉到「指向子骨頭的方向」等於給定的世界方向，並依 weight 與動畫姿勢混合（不需要知道骨頭的軸向定義） */
  #aim(name, x, y, z, weight) {
    const bone = this.bones[name];
    const child = bone?.children.find((c) => c.isBone);
    if (!child || weight <= 0.001) return;
    bone.updateWorldMatrix(true, true);
    _a.setFromMatrixPosition(bone.matrixWorld);
    _b.setFromMatrixPosition(child.matrixWorld).sub(_a).normalize();
    _c.set(x, y, z).normalize();
    _q1.setFromUnitVectors(_b, _c);
    bone.getWorldQuaternion(_q2);
    bone.parent.getWorldQuaternion(_q3);
    _q3.invert().multiply(_q1).multiply(_q2);
    bone.quaternion.slerp(_q3, weight);
  }

  /** 釣魚：雙手在身前握竿，右手在上 */
  #fishPose() {
    const yaw = this.group.rotation.y;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const fish = this.fishW;
    const sway = Math.sin(this.t * 0.8) * 0.03;
    this.group.updateMatrixWorld(true);
    this.#aim('upperarm_r', fx * 0.45 + rx * 0.18, -0.85, fz * 0.45 + rz * 0.18, fish);
    this.#aim('lowerarm_r', fx * 0.9 - rx * 0.18, 0.28 + sway, fz * 0.9 - rz * 0.18, fish);
    this.#aim('upperarm_l', fx * 0.4 - rx * 0.12, -0.9, fz * 0.4 - rz * 0.12, fish);
    this.#aim('lowerarm_l', fx * 0.92 + rx * 0.28, 0.02 + sway, fz * 0.92 + rz * 0.28, fish);
    const hand = this.bones.hand_r;
    if (hand) {
      hand.updateWorldMatrix(true, false);
      this.group.worldToLocal(this.rodMount.position.setFromMatrixPosition(hand.matrixWorld));
    }
  }

  animate(dt, { walking = 0, sitting = false, fishing = false, talking = false }) {
    this.t += dt;
    // walking：0 = 站著、1 = 正常步行、超過 1 逐漸變成跑
    this.walkW = damp(this.walkW, clamp(walking, 0, 1), 7, dt);
    this.runW = damp(this.runW, clamp(walking - 1.2, 0, 1), 7, dt);
    this.sitW = damp(this.sitW, sitting && this.canSit ? 1 : 0, 5, dt);
    this.talkW = damp(this.talkW, talking && !fishing ? 1 : 0, 4, dt);
    this.fishW = damp(this.fishW, fishing ? 1 : 0, 5, dt);
    const stand = (1 - this.walkW) * (1 - this.sitW);
    const w = {
      idle: stand * (1 - this.talkW),
      talk: stand * this.talkW,
      walk: this.walkW * (1 - this.runW) * (1 - this.sitW),
      run: this.walkW * this.runW * (1 - this.sitW),
      sit: this.sitW * (1 - this.talkW),
      sitTalk: this.sitW * this.talkW,
    };
    for (const [key, action] of Object.entries(this.actions)) action.setEffectiveWeight(w[key] ?? 0);
    if (this.actions.walk) this.actions.walk.timeScale = 0.75 + 0.35 * Math.min(walking, 1.2);
    this.mixer.update(dt);
    if (this.fishW > 0.001) this.#fishPose();
  }

  lookAt(yaw, dx, dz, dt, active) {
    const target = active ? clamp(wrap(Math.atan2(-dx, -dz) - yaw), -1.0, 1.0) : 0;
    this.headYaw = damp(this.headYaw, target, 5, dt);
    // mixer 每個 frame 會把骨頭重設成動畫姿勢，所以轉頭是疊加在動畫之後；
    // UE 骨架的 Head 以 local X 為長軸，繞「世界的上方向」轉要先換到骨頭的 local 座標
    if (!this.head || Math.abs(this.headYaw) < 1e-4) return;
    this.head.updateWorldMatrix(true, false);
    this.head.parent.getWorldQuaternion(_q3);
    _c.set(0, 1, 0).applyQuaternion(_q3.invert());
    this.head.quaternion.premultiply(_q1.setFromAxisAngle(_c, this.headYaw));
  }
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();

const CAMPER_LINES = {
  day: ['柴火還夠，今晚不怕冷。', '路牌那邊往下走就是碼頭，老陳整天都在那釣魚。', '靶場在營地後面，槍跟子彈就放在火堆旁。', '罐頭省著吃，山坡上偶爾撿得到。'],
  night: ['坐下來烤個火吧。', '天黑了，累了就進帳篷睡，一覺到天亮。', '晚上別跑太遠，手電筒記得帶著。'],
  rain: ['這雨一時半刻停不了。', '還好帳篷不漏水。'],
};
const FISHER_LINES = {
  day: ['噓——魚都被你嚇跑了。', '這湖裡的魚精得很，要有耐心。', '想划船就自己上，就綁在碼頭邊。'],
  night: ['晚上魚反而肯咬餌。', '你看水面那圈漣漪，底下有東西。'],
  rain: ['下雨天魚最活躍，你懂什麼。'],
};
const HIKER_LINES = {
  day: ['我每天繞湖走一圈，比待在營地有意思。', '山坡上有鹿，動作慢一點才不會嚇跑牠們。', '往北一直走會到另一座大湖。'],
  night: ['走了一天，腿都軟了。', '今晚的星星真清楚。'],
  rain: ['淋成落湯雞了……'],
};

class Npc {
  constructor(game, { name, lines, look, x, z }) {
    this.game = game;
    this.name = name;
    this.lines = lines;
    this.lineIndex = 0;
    const kind = bodyKind(game.assets);
    this.body = kind ? new RiggedBody(game.assets, look) : new Humanoid(look);
    this.resting = false;
    this.pos = new THREE.Vector3(x, game.terrain.getHeight(x, z), z);
    this.yaw = 0;
    this.phase = 0;
    this.speed = 0;
    this.target = null;
    this.wait = 0;
    this.sitting = false;
    this.fishing = false;
    this.facePlayer = 0;
    this.collider = game.colliders.addDynamicBox(0.26, 0.26, 0);
    game.scene.add(this.body.group);
    this.sync();
  }

  sync() {
    this.body.group.position.copy(this.pos);
    this.body.group.rotation.y = this.yaw;
    this.collider.x = this.pos.x;
    this.collider.z = this.pos.z;
    this.collider.top = this.pos.y + 1.8;
  }

  distanceTo(p) {
    return Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
  }

  talk() {
    const env = this.game.env;
    const pool = env.w.rain > 0.5 ? this.lines.rain : env.isNight ? this.lines.night : this.lines.day;
    const line = pool[this.lineIndex++ % pool.length];
    this.facePlayer = 4;
    return `${this.name}：${line}`;
  }

  /** 朝 target 走，被樹／物件擋到會沿著滑開。回傳是否已到達 */
  walkTo(dt, target, speed = 1.3, arrive = 0.5) {
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < arrive) {
      this.speed = damp(this.speed, 0, 8, dt);
      return true;
    }
    this.yaw += clamp(wrap(Math.atan2(-dx, -dz) - this.yaw), -3 * dt, 3 * dt);
    this.speed = damp(this.speed, speed, 4, dt);
    this.pos.x -= Math.sin(this.yaw) * this.speed * dt;
    this.pos.z -= Math.cos(this.yaw) * this.speed * dt;
    this.game.colliders.resolve(this.pos, 0.3, this.pos.y, this.collider);
    this.pos.y = this.game.terrain.getHeight(this.pos.x, this.pos.z);
    this.phase += dt * this.speed * 4.2;
    return false;
  }

  faceTo(dt, x, z) {
    this.yaw += clamp(wrap(Math.atan2(-(x - this.pos.x), -(z - this.pos.z)) - this.yaw), -3 * dt, 3 * dt);
  }

  update(dt) {
    const player = this.game.player;
    const near = this.distanceTo(player.pos) < 6 && !player.vehicle;
    this.facePlayer = Math.max(0, this.facePlayer - dt);
    this.think(dt);
    if (this.facePlayer > 0 && !this.sitting && !this.fishing) this.faceTo(dt, player.pos.x, player.pos.z);
    this.sync();
    this.body.animate(dt, {
      walking: clamp(this.speed / 1.3, 0, 1.2),
      sitting: this.sitting,
      fishing: this.fishing,
      talking: this.facePlayer > 0,
      phase: this.phase,
    });
    this.body.lookAt(this.yaw, player.pos.x - this.pos.x, player.pos.z - this.pos.z, dt, near);
    this.sync();
  }

  think() {}
}

/** 白天在營地各處晃、入夜坐到營火旁的原木上 */
class Wanderer extends Npc {
  constructor(game, opts) {
    super(game, opts);
    this.spots = opts.spots;
    this.seat = opts.seat;
    this.spotIndex = opts.startIndex ?? 0;
    this.rand = mulberry32(opts.seed);
    this.wait = 3;
  }

  think(dt) {
    const env = this.game.env;
    const fire = this.game.campfire.position;
    const evening = env.time >= 18.6 || env.time < 5.6;
    if (evening && this.body.canSit === false) {
      // 沒有坐下動畫的模型：走到營火旁、原木外側站著烤火
      const dx = this.seat.x - fire.x;
      const dz = this.seat.z - fire.z;
      const d = Math.hypot(dx, dz) || 1;
      const stand = { x: this.seat.x + (dx / d) * 1.0, z: this.seat.z + (dz / d) * 1.0 };
      if (this.resting || this.walkTo(dt, stand, 1.4, 0.5)) {
        this.resting = true;
        this.speed = damp(this.speed, 0, 8, dt);
        this.faceTo(dt, fire.x, fire.z);
      }
      return;
    }
    this.resting = false;
    if (evening) {
      if (this.sitting) {
        this.speed = 0;
        this.faceTo(dt, fire.x, fire.z);
        return;
      }
      if (this.walkTo(dt, this.seat, 1.4, 0.95)) {
        // 原木本身是 collider，走不進去；夠近就直接坐上去
        this.sitting = true;
        this.pos.x = this.seat.x;
        this.pos.z = this.seat.z;
        this.pos.y = this.game.terrain.getHeight(this.seat.x, this.seat.z);
      }
      return;
    }
    if (this.sitting) {
      // 起身時先退到原木外側，免得卡在 collider 裡
      this.sitting = false;
      const dx = this.pos.x - fire.x;
      const dz = this.pos.z - fire.z;
      const d = Math.hypot(dx, dz) || 1;
      this.pos.x += (dx / d) * 0.75;
      this.pos.z += (dz / d) * 0.75;
    }
    if (this.wait > 0) {
      this.wait -= dt;
      this.speed = damp(this.speed, 0, 8, dt);
      return;
    }
    const spot = this.spots[this.spotIndex % this.spots.length];
    if (this.walkTo(dt, spot, spot.speed ?? 1.25, 0.8)) {
      this.spotIndex++;
      this.wait = spot.wait ?? 5 + this.rand() * 9;
    }
  }
}

/** 站在碼頭盡頭釣魚 */
class Fisher extends Npc {
  constructor(game, opts) {
    super(game, opts);
    this.pos.y = opts.y;
    this.yaw = opts.yaw;
    this.fishing = true;
    const wood = lambert([0.45, 0.33, 0.2]);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.014, 2.6, 5), wood);
    rod.position.set(0, -0.1, -0.02);
    // 程序人形：釣竿握在手上（角度配合釣魚姿勢）；骨架人物：掛在身前的掛點（釣魚時每格移到右手）
    const mount = this.body.rodMount ?? this.body.armR.end;
    this.rodBase = this.body.rodMount ? 0 : ROD_ANGLE;
    rod.rotation.x = this.rodBase;
    rod.geometry.translate(0, 1.1, 0);
    // 釣線與浮標：掛在竿尖，視覺上夠用就好
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 3.1, 3), lambert([0.9, 0.9, 0.9]));
    line.position.set(0, 2.4, 0);
    line.rotation.x = -2.21; // 抵銷手臂與釣竿的傾角，讓線垂直往下
    line.geometry.translate(0, 1.55, 0);
    const bob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), lambert([0.85, 0.15, 0.1]));
    bob.position.set(0, 3.08, 0);
    line.add(bob);
    rod.add(line);
    mount.add(rod);
    rod.traverse((o) => o.layers.set(LAYER_NO_REFLECT));
    this.rod = rod;
  }

  think(dt) {
    // 偶爾抽一下竿
    const t = this.body.t;
    const twitch = Math.max(0, Math.sin(t * 0.35)) ** 24;
    this.rod.rotation.x = this.rodBase + Math.sin(t * 0.8) * 0.03 + twitch * 0.3;
  }
}

/**
 * 三個 NPC：營地的阿哲、碼頭的老陳、繞湖健行的小安。
 * @param dock buildDock() 的回傳值
 */
export function createNpcs(game, layout, lake, dock) {
  const { terrain } = game;
  const fire = layout.fire;
  const seatAt = (angle) => ({ x: fire.x + Math.cos(angle) * 2.3, z: fire.z + Math.sin(angle) * 2.3 });

  const camper = new Wanderer(game, {
    name: '阿哲',
    lines: CAMPER_LINES,
    look: { skin: [0.82, 0.62, 0.48], shirt: [0.62, 0.2, 0.16], pants: [0.2, 0.24, 0.3], hair: [0.1, 0.08, 0.07], model: 'npcCamper' },
    x: fire.x + 3.2,
    z: fire.z + 3.6,
    seat: seatAt(2.2),
    seed: 11,
    spots: [
      { x: fire.x + 2.2, z: fire.z + 3.9 }, // 柴堆
      { x: fire.x + 3.4, z: fire.z - 3.0 }, // 木箱
      { x: fire.x + 2.4, z: fire.z - 0.4, wait: 9 }, // 火邊
      { x: fire.x + 8.5, z: fire.z + 2.5 }, // 往湖邊看
    ],
  });

  // 健行路線：繞著湖找一圈平緩好走的點
  const trail = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    for (let r = lake.r * 1.25; r < lake.r * 2.0; r += 4) {
      const x = lake.x + Math.cos(a) * r;
      const z = lake.z + Math.sin(a) * r;
      if (terrain.getHeight(x, z) > 1.2 && terrain.getNormal(x, z).y > 0.86) {
        trail.push({ x, z, speed: 1.45, wait: i % 4 === 0 ? 7 : 0.5 });
        break;
      }
    }
  }
  // 湖邊地形太陡找不到路線時，退而在營地周圍走
  if (trail.length < 3) {
    trail.length = 0;
    for (const a of [0.4, 1.9, 3.3, 5.0]) trail.push({ x: fire.x + Math.cos(a) * 11, z: fire.z + Math.sin(a) * 11, speed: 1.45 });
  }
  // 從最靠近營地的那一點開始走
  let first = 0;
  trail.forEach((p, i) => {
    if (Math.hypot(p.x - fire.x, p.z - fire.z) < Math.hypot(trail[first].x - fire.x, trail[first].z - fire.z)) first = i;
  });
  const hiker = new Wanderer(game, {
    name: '小安',
    lines: HIKER_LINES,
    look: { skin: [0.9, 0.72, 0.6], shirt: [0.2, 0.42, 0.5], pants: [0.36, 0.3, 0.2], hair: [0.3, 0.18, 0.1], hat: [0.75, 0.66, 0.42], height: 0.95, model: 'npcHiker' },
    x: trail[first].x,
    z: trail[first].z,
    seat: seatAt(4.1),
    seed: 23,
    spots: trail,
    startIndex: first + 1,
  });

  const stand = { x: dock.end.x - Math.sin(dock.yaw) * 0.5, z: dock.end.z - Math.cos(dock.yaw) * 0.5 };
  const fisher = new Fisher(game, {
    name: '老陳',
    lines: FISHER_LINES,
    look: { skin: [0.74, 0.55, 0.42], shirt: [0.36, 0.4, 0.26], pants: [0.22, 0.2, 0.18], hair: [0.6, 0.6, 0.6], hat: [0.3, 0.33, 0.24], sleeves: false, model: 'npcFisher' },
    x: stand.x,
    z: stand.z,
    y: dock.deck,
    yaw: dock.yaw + Math.PI, // 人形的前方是 -Z，碼頭的 +Z 朝湖心
  });

  return [camper, hiker, fisher];
}
