// 人物：Quaternius Universal Base Characters 男女底模＋ Universal Animation Library 動畫（CC0），
// 由 blender/people.py 組好（衣物分區材質、髮型、滑板／單車的 IK 姿勢）並以 meshopt 壓縮，打包時內嵌成 #glb-people。
// 每個人是 SkeletonUtils 複製出來的 SkinnedMesh＋自己的 AnimationMixer；衣服、膚色、髮型、髮色依路人編號決定。
// 模型面向 +z，外層包一層轉 180° 的群組，讓 rotation.y = -yaw 時面向 -z（北）。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Builder, P, mat } from './geo.js';

let LIB = null;
let loading = null;

// 內嵌的 gzip＋base64 → GLTF
export function loadPeople() {
  if (loading) return loading;
  loading = (async () => {
    const el = document.getElementById('glb-people');
    if (!el) throw new Error('缺少內嵌的人物模型');
    const bin = Uint8Array.from(atob(el.textContent.trim()), (c) => c.charCodeAt(0));
    const ab = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    await MeshoptDecoder.ready;
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const gltf = await new Promise((res, rej) => loader.parse(ab, '', res, rej));
    const templates = {};
    for (const g of ['Male', 'Female']) {
      const o = gltf.scene.getObjectByName(g);
      if (!o) throw new Error(`人物模型缺少 ${g}`);
      o.position.set(0, 0, 0);
      templates[g] = o;
    }
    // 兩副骨架的骨頭同名，載入器會把後面那副改成「名稱_1」；統一改回原名，動畫軌道也一樣
    const names = new Set();
    templates.Female.traverse((o) => names.add(o.name));
    templates.Male.traverse((o) => names.add(o.name));
    const canon = (n) => {
      const m = /^(.*)_\d+$/.exec(n);
      return m && names.has(m[1]) ? m[1] : n;
    };
    for (const g of ['Male', 'Female']) templates[g].traverse((o) => {
      if (o.isBone) o.name = canon(o.name);
    });
    // 動畫只留旋轉（加上骨盆位移），男女骨架長度不同，不能套用其他骨頭的位移與縮放
    const clips = new Map();
    for (const c of gltf.animations) {
      for (const t of c.tracks) {
        const i = t.name.lastIndexOf('.');
        t.name = canon(t.name.slice(0, i)) + t.name.slice(i);
      }
      c.tracks = c.tracks.filter((t) => t.name.endsWith('.quaternion') || /^(pelvis|root)\.position$/.test(t.name));
      clips.set(c.name, c);
    }
    relax(clips, templates.Male);
    const mats = {};
    gltf.scene.traverse((o) => {
      if (o.isMesh) for (const m of [].concat(o.material)) mats[m.name] = m;
    });
    LIB = { templates, clips, mats };
    return LIB;
  })();
  return loading;
}

// 動畫庫的待機是握拳、雙臂外張的備戰姿勢，放在這副底模上像在擺健美動作：
// 手指往靜止姿勢（張開）放鬆一半；待機再把手肘伸直一些、上臂往下收。握把的動作（開車、單車）不動。
function relax(clips, tpl) {
  const rest = new Map();
  tpl.traverse((o) => o.isBone && rest.set(o.name, o.quaternion.clone()));
  const q = new THREE.Quaternion();
  const each = (t, f) => {
    for (let i = 0; i < t.values.length; i += 4) f(q.fromArray(t.values, i)).toArray(t.values, i);
  };
  for (const [name, c] of clips) {
    if (name === 'Driving_Loop' || name === 'Bike_Loop') continue;
    for (const t of c.tracks) {
      const bone = t.name.slice(0, t.name.lastIndexOf('.'));
      if (/^(thumb|index|middle|ring|pinky)_/.test(bone)) each(t, (v) => v.slerp(rest.get(bone), 0.6));
      else if (name === 'Idle_Loop' && /^lowerarm_/.test(bone)) each(t, (v) => v.slerp(rest.get(bone), 0.3));
    }
  }
  // 上臂：在第 0 幀量出手臂在父骨空間的方向，往正下方轉 40%，整段動畫都套同一個修正
  const idle = clips.get('Idle_Loop');
  if (!idle) return;
  const body = cloneSkinned(tpl);
  const mixer = new THREE.AnimationMixer(body);
  mixer.clipAction(idle).play();
  mixer.update(0);
  body.updateMatrixWorld(true);
  for (const s of ['l', 'r']) {
    const ua = body.getObjectByName(`upperarm_${s}`);
    const la = body.getObjectByName(`lowerarm_${s}`);
    const track = idle.tracks.find((t) => t.name === `upperarm_${s}.quaternion`);
    if (!ua || !la || !track) continue;
    const dir = la.position.clone().applyQuaternion(ua.quaternion).normalize();
    const down = new THREE.Vector3(0, -1, 0).applyQuaternion(ua.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
    const fix = new THREE.Quaternion().setFromUnitVectors(dir, dir.clone().lerp(down, 0.4).normalize());
    each(track, (v) => v.premultiply(fix));
  }
  mixer.stopAllAction();
}

// ── 衣著 ──
const TOPS = [0x3b82c4, 0xe0b23a, 0x6b8f71, 0xb84a4a, 0xe8e4da, 0x2f3540, 0x8a5fb0, 0xd97941, 0x4fa3a5, 0xc7c1b3, 0x7d2f4a, 0x9cb36b, 0x1d1f22, 0xf2efe8];
const BOTS = [0x2b3a55, 0x3a3f46, 0xb9a986, 0x1f2328, 0x55606e, 0x6e5a48, 0x4b6584, 0x2c2c2c];
const SHOES = [0xf2f2f0, 0x24262a, 0x8a6d50, 0xc8ccd2, 0x3d4a66];
const TINTS = [0xfff4ee, 0xffe6d8, 0xd9b49a, 0xa77b5e, 0x6e4a36];
const HAIRC = [0x2a221d, 0x4a3020, 0x7a5434, 0xc9a46a, 0x8c8c8c, 0x1c1c1c];
const HAIRS = { Male: ['Male_Hair_SimpleParted', 'Male_Hair_Buzzed', 'Male_Hair_Beard'], Female: ['Female_Hair_Long', 'Female_Hair_Buns', 'Female_Hair_BuzzedFemale'] };
export const PLAYER_LOOK = { gender: 'Male', top: 0xd65a22, bottom: 0x3e4652, shoe: 0x50555c, longSleeve: true, longPants: true, skin: 0, hair: 0, hairColor: 1 };

export function lookFor(n) {
  const h = (k) => Math.abs(Math.imul(n * 2654435761 + k * 40503, 0x9e3779b1) >>> 7);
  const gender = h(1) % 2 ? 'Female' : 'Male';
  return {
    gender, top: TOPS[h(2) % TOPS.length], bottom: BOTS[h(3) % BOTS.length], shoe: SHOES[h(4) % SHOES.length],
    longSleeve: h(5) % 3 === 0, longPants: h(6) % 3 !== 0, skin: h(7) % TINTS.length, hair: h(8) % 3, hairColor: h(9) % HAIRC.length,
  };
}

const cache = new Map();
function cached(key, make) {
  let m = cache.get(key);
  if (!m) {
    m = make();
    cache.set(key, m);
  }
  return m;
}
const clothMat = (hex) => cached(`c${hex}`, () => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9, metalness: 0 }));
function skinMat(g, tint) {
  return cached(`s${g}${tint}`, () => {
    const m = LIB.mats[`${g}_skin`].clone();
    m.color.setHex(TINTS[tint]);
    m.roughness = 0.62;
    return m;
  });
}
function hairMat(base, c) {
  return cached(`h${base.name}${c}`, () => {
    const m = base.clone();
    m.color.setHex(HAIRC[c]).multiplyScalar(2.2);
    return m;
  });
}

// ── 動作對應 ──
const ANIM = {
  idle: 'Idle_Loop', talk: 'Idle_Talking_Loop', walk: 'Walk_Loop', run: 'Jog_Fwd_Loop', sprint: 'Sprint_Loop', jump: 'Jump_Loop', fall: 'Jump_Loop',
  crouch: 'Crouch_Idle_Loop', swim: 'Swim_Fwd_Loop', sit: 'Sitting_Idle_Loop', drive: 'Driving_Loop', fly: 'Driving_Loop', bike: 'Bike_Loop',
  ride: 'Board_Ride', grind: 'Board_Ride', push: 'Board_Push', crouchride: 'Board_Crouch', air: 'Board_Crouch', grab: 'Board_Grab', bail: 'Roll',
};
// 動畫原本的步速（m/s），用來對齊腳步
const PACE = { Walk_Loop: 1.35, Jog_Fwd_Loop: 3.4, Sprint_Loop: 6.2, Bike_Loop: 4.5, Swim_Fwd_Loop: 1.2 };

class Person {
  constructor(look) {
    this.look = look;
    const t = LIB.templates[look.gender];
    this.model = cloneSkinned(t);
    this.model.rotation.y = Math.PI;
    this.root = new THREE.Group();
    this.root.add(this.model);
    this.meshes = [];
    this.model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.frustumCulled = false;
      this.meshes.push(o);
    });
    this.dress(look);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = new Map();
    this.cur = null;
    this.bones = {};
    this.model.traverse((o) => {
      if (o.isBone) this.bones[o.name] = o;
    });
  }

  dress(L) {
    const g = L.gender;
    const hairName = HAIRS[g][L.hair];
    const skin = skinMat(g, L.skin);
    for (const m of this.meshes) {
      const n = m.material.name || '';
      const name = m.name;
      if (/_Hair_/.test(name) || /_Hair_/.test(m.parent && m.parent.name)) {
        const owner = /_Hair_/.test(name) ? name : m.parent.name;
        m.visible = owner.startsWith(hairName);
        if (m.visible) m.material = hairMat(LIB.mats[n] || m.material, L.hairColor);
        continue;
      }
      if (/_Brows/.test(name) || /_Brows/.test(m.parent && m.parent.name)) {
        // 眉毛的 UV 落在頭髮貼圖的淺色區，直接用髮色素色
        m.material = cached(`b${L.hairColor}`, () => new THREE.MeshStandardMaterial({ color: new THREE.Color(HAIRC[L.hairColor]).multiplyScalar(0.8), roughness: 0.85 }));
        continue;
      }
      if (n.endsWith('_skin')) m.material = skin;
      else if (n.endsWith('_top')) m.material = clothMat(L.top);
      else if (n.endsWith('_sleeve')) m.material = L.longSleeve ? clothMat(L.top) : skin;
      else if (n.endsWith('_bottom')) m.material = clothMat(L.bottom);
      else if (n.endsWith('_shin')) m.material = L.longPants ? clothMat(L.bottom) : skin;
      else if (n.endsWith('_shoe')) m.material = clothMat(L.shoe);
    }
  }

  // 依動作狀態切換動畫；sp：移動速度（對齊步伐）
  play(anim, sp = 0, dt = 0) {
    const name = ANIM[anim] || 'Idle_Loop';
    let a = this.actions.get(name);
    if (!a) {
      const clip = LIB.clips.get(name);
      if (!clip) return;
      a = this.mixer.clipAction(clip);
      if (name === 'Roll' || name === 'Jump_Land') {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      this.actions.set(name, a);
    }
    if (this.cur !== a) {
      a.reset();
      a.time = name === 'Idle_Loop' || name === 'Walk_Loop' ? Math.random() * a.getClip().duration : 0;
      a.play();
      if (this.cur) a.crossFadeFrom(this.cur, anim === 'jump' || anim === 'bail' ? 0.12 : 0.22, false);
      this.cur = a;
    }
    const pace = PACE[name];
    a.timeScale = pace ? Math.min(2.2, Math.max(0.35, sp / pace)) : 1;
    if (dt) this.mixer.update(dt);
  }
}

function buildBackpack(board) {
  const B = new Builder();
  const pack = 0x4a5562;
  B.geom(new THREE.CapsuleGeometry(0.13, 0.22, 4, 10), mat(0, 0.06, 0.2, 1.15, 1, 0.65), pack);
  B.geom(P.box(), mat(0, -0.04, 0.29, 0.2, 0.14, 0.04), 0x3d4752);
  if (board === 'skate') {
    B.geom(P.box(), mat(0, 0.08, 0.33, 0.21, 0.78, 0.025), 0xe8692d);
    B.geom(P.box(), mat(0, 0.08, 0.318, 0.2, 0.76, 0.006), 0x2b2b2b);
    for (const y of [-0.2, 0.36]) {
      B.geom(P.box(), mat(0, y, 0.36, 0.15, 0.03, 0.03), 0xb9bcc0);
      for (const s of [-1, 1]) B.geom(P.cyl(10), mat(s * 0.09, y, 0.375, 0.028, 0.032, 0.028, 0, 0, Math.PI / 2), 0xf3f1ea);
    }
    B.geom(P.cyl(12), mat(0, 0.08, 0.35, 0.07, 0.01, 0.07, Math.PI / 2, 0, 0), 0xf3f1ea);
  } else if (board === 'snow') {
    B.geom(P.box(), mat(0, 0.1, 0.33, 0.26, 1.2, 0.025), 0x2563eb);
    B.geom(P.box(), mat(0, 0.1, 0.345, 0.2, 0.1, 0.05), 0x1f2933);
  }
  return B.build();
}

// ── 玩家角色 ──
const PACK_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.02 });

export class PlayerAvatar {
  constructor() {
    this.root = new THREE.Group();
    this.person = null;
    this.packs = { none: buildBackpack(null), skate: buildBackpack('skate'), snow: buildBackpack('snow') };
    this.pack = new THREE.Mesh(this.packs.skate, PACK_MAT);
    this.pack.castShadow = true;
    this.item = 'skate';
  }

  // 模型載入後才真正建立
  build() {
    this.person = new Person(PLAYER_LOOK);
    this.root.add(this.person.root);
    // 背包掛在上背（spine_03），用靜止姿勢算出相對骨頭的位置
    const chest = this.person.bones.spine_03;
    this.root.updateMatrixWorld(true);
    const rootInv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    const boneRel = new THREE.Matrix4().multiplyMatrices(rootInv, chest.matrixWorld);
    const want = new THREE.Matrix4().makeTranslation(0, new THREE.Vector3().setFromMatrixPosition(boneRel).y - 0.12, -0.06);
    this.pack.matrixAutoUpdate = false;
    this.pack.matrix.copy(boneRel.invert().multiply(want));
    chest.add(this.pack);
  }

  setBackItem(kind) {
    this.item = kind;
    this.pack.geometry = this.packs[kind] || this.packs.none;
  }

  update(state, dt) {
    if (!this.person) return;
    this.person.play(state.anim, state.sp || 0, dt);
  }
}

// ── 路人：每個外觀編號對應一個人（快取），每幀最多新建幾個，避免卡頓 ──
export class Crowd {
  constructor(max = 64) {
    this.max = max;
    this.group = new THREE.Group();
    this.people = new Map();
    this.boards = new THREE.InstancedMesh(boardGeo(), PACK_MAT, max);
    this.boards.count = 0;
    this.boards.frustumCulled = false;
    this.boards.castShadow = true;
    this.boards.setColorAt(0, new THREE.Color(1, 1, 1));
    this.group.add(this.boards);
    this._c = new THREE.Color();
    this._m = new THREE.Matrix4();
    this.frame = 0;
    this.shadows = true;
  }

  // list：[{x,y,z,yaw,anim,phase,look,board?,lean?,sp?}]；cam：攝影機位置（遠處的人降低動畫更新頻率）
  update(list, dt = 1 / 60, cam = null) {
    this.frame++;
    if (!LIB) return;
    const n = Math.min(list.length, this.max);
    const used = new Set();
    let made = 0;
    let nb = 0;
    for (let i = 0; i < n; i++) {
      const s = list[i];
      let key = s.look || 0;
      while (used.has(key)) key += 1000;
      used.add(key);
      let per = this.people.get(key);
      if (!per) {
        if (made >= 3) continue;
        per = new Person(lookFor(key % 1000 + (key >= 1000 ? 77 : 0)));
        per.root.traverse((o) => {
          if (o.isMesh) o.castShadow = this.shadows;
        });
        this.people.set(key, per);
        this.group.add(per.root);
        made++;
      }
      per.root.visible = true;
      per.root.position.set(s.x, s.y + (s.board ? 0.13 : 0), s.z);
      per.root.rotation.set(0, -s.yaw + (s.board ? -Math.PI / 2 : 0), s.board ? (s.lean || 0) * 0.5 : 0, 'YXZ');
      const far = cam ? Math.hypot(s.x - cam.x, s.z - cam.z) > 45 : false;
      const step = far ? 3 : 1;
      per.play(s.anim, s.sp ?? (s.anim === 'walk' ? 1.35 : 0), (this.frame + key) % step === 0 ? dt * step : 0);
      per.seen = this.frame;
      if (s.board) {
        this._m.makeRotationY(-s.yaw);
        this._m.setPosition(s.x, s.y + 0.1, s.z);
        this.boards.setMatrixAt(nb, this._m);
        this.boards.setColorAt(nb, this._c.setHex(s.board === 'snow' ? 0x2a6fdb : 0xffffff));
        nb++;
      }
    }
    // 沒用到的人藏起來；太多就丟掉最久沒出現的
    for (const [k, per] of this.people) {
      if (per.seen !== this.frame) per.root.visible = false;
      if (this.people.size > this.max * 1.5 && this.frame - per.seen > 600) {
        this.group.remove(per.root);
        per.mixer.stopAllAction();
        this.people.delete(k);
      }
    }
    this.boards.count = nb;
    this.boards.instanceMatrix.needsUpdate = true;
    if (this.boards.instanceColor) this.boards.instanceColor.needsUpdate = true;
  }

  setShadows(on) {
    this.shadows = on;
    for (const per of this.people.values()) per.root.traverse((o) => {
      if (o.isMesh) o.castShadow = on;
    });
  }
}

// 板子（板身沿 -z 為前方）
export function boardGeo(kind = 'skate') {
  const B = new Builder();
  if (kind === 'snow') {
    B.geom(P.box(), mat(0, 0.02, 0, 0.3, 0.025, 1.55), 0xffffff);
    B.geom(P.box(), mat(0, 0.045, 0.2, 0.22, 0.05, 0.14), 0x1f2933);
    B.geom(P.box(), mat(0, 0.045, -0.2, 0.22, 0.05, 0.14), 0x1f2933);
    return B.build();
  }
  B.geom(P.box(), mat(0, 0.1, 0, 0.22, 0.022, 0.8), 0xe8692d);
  B.geom(P.box(), mat(0, 0.112, 0, 0.215, 0.004, 0.78), 0x24272b);
  B.geom(P.box(), mat(0, 0.115, -0.43, 0.2, 0.02, 0.1, 0.35, 0, 0), 0xe8692d);
  B.geom(P.box(), mat(0, 0.115, 0.43, 0.2, 0.02, 0.1, -0.35, 0, 0), 0xe8692d);
  for (const z of [-0.27, 0.27]) {
    B.geom(P.box(), mat(0, 0.07, z, 0.17, 0.025, 0.04), 0xb9bcc0);
    for (const s of [-1, 1]) B.geom(P.cyl(10), mat(s * 0.095, 0.035, z, 0.03, 0.035, 0.03, 0, 0, Math.PI / 2), 0xf3f1ea);
  }
  return B.build();
}
