// 六器鏢行：骨架人物（鏢師與 NPC）
//
// 底模：blender/out/actors.glb（Quaternius Universal Base Characters 男女＋ Universal Animation Library 動作，CC0），
// 打包時 gzip＋base64 內嵌成 <script id="glb-actors">。glb 裡身體只有一個皮膚材質，衣著全部在這裡用 TSL 著色器分區上色：
// 以 positionGeometry（蒙皮前的綁定姿勢座標，T 字姿勢、Y 朝上、面向 +Z、左手在 +X）判斷部位，邊界用 fwidth 柔化。
//
// 座標慣例：actor.root 是 THREE.Group，rotation.y = 0 時人物面向 −Z（模型本身面向 +Z，內層轉了 180°）。
// 要面向世界方向 (dx, dz)：root.rotation.y = Math.atan2(-dx, -dz)。
//
// 材質：身體每個性別只有一個節點材質（兩個著色器程式）。衣色、分區開關是「每物件」uniform（onObjectUpdate），
// 數值表依（預設 × 衣色 × 性別）快取共用，所以不論場上有幾種裝扮都不會多編譯著色器。
import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  Fn, uniform, float, vec2, vec3, positionGeometry, uv, texture,
  abs, min, max, mix, smoothstep, fract, atan, fwidth, floor, length, cos, clamp, mx_noise_float, hash,
} from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { makeWeapon, makeStowed, makeCase, loadArms, WEAPON_TYPES } from './weapons.js';

export { WEAPON_TYPES };

// ── 綁定姿勢量測（公尺，glTF 座標）。由 blender/build_actors.py 印出的骨頭位置與網格邊界取得 ──
// ankle=foot 骨、knee=calf 骨、pelvis、waist=spine_01、chest=spine_03、neck=neck_01、head=Head 骨；
// shX／elX／wrX 是上臂／前臂／手腕骨頭的 |x|（T 字姿勢手臂水平），armY 是手臂高度，legX 是腿中心 |x|，top 是頭頂。
export const BIND = {
  Male: { ankle: 0.086, knee: 0.542, pelvis: 0.949, waist: 1.072, chest: 1.311, neck: 1.520, head: 1.600, eye: 1.70, top: 1.81, neckR: 0.078, cs: 0.047, shX: 0.212, elX: 0.463, wrX: 0.706, armY: 1.456, legX: 0.114 },
  Female: { ankle: 0.071, knee: 0.535, pelvis: 0.932, waist: 1.055, chest: 1.291, neck: 1.485, head: 1.550, eye: 1.656, top: 1.767, neckR: 0.07, cs: 0.135, shX: 0.152, elX: 0.392, wrX: 0.641, armY: 1.418, legX: 0.111 },
};

// 衣色（入局帖可選）：主色與搭配的領緣色
export const PALETTES = {
  indigo: { main: 0x2c3e57, trim: 0xece6d8 },
  ochre: { main: 0x7e4620, trim: 0xefe6d2 }, // 偏紅褐的赭石：原本 0x9a6a36 在大堂暖光下跟膚色分不開，看起來像沒穿上衣
  pine: { main: 0x2f4a3c, trim: 0xe8e4d6 },
  moon: { main: 0xd6dbdc, trim: 0x2c3e57 },
};

// 裝扮預設。pal：衣色套用在哪一格（null＝固定配色）。hem：上衣下襬在骨盆下多少公尺（長袍取大值）。
// sleeve：袖長（0＝無袖，1＝到護腕）。head：頭上配件。
const BASE = {
  main: 0x2c3e57, trim: 0xece6d8, belt: 0xa3321f, pants: 0x1c1b1d, wrap: 0xe2d9c4, cord: 0x3b3129, shoe: 0x19181a, sole: 0xe6dcc6,
  bracer: 0x4a2f1e, strap: 0x56381f, apron: 0x5a3a22, apron2: 0x3a2516, mask: 0x161617,
  tails: 'short', hemTrim: 0, sleeve: 1, bracerOn: 1, wrapOn: 1, beltOn: 1, hem: 0.13, slit: 1, strapOn: 0, apronOn: 0, apronFloral: 0, apronTop: 0, maskOn: 0, rough: 0.86,
  skin: 0xffffff, hairColor: 0x17120f, beard: false, head: 'none', box: false, pal: 'main', knot: true,
};
export const PRESETS = {
  // 鏢師：靛藍短打、朱紅腰帶、黑褲、米白綁腿、黑布鞋、護腕，背六器匣
  escort: { strapOn: 1, box: true, head: 'band', bandColor: 0x8c2a1c },
  // 祁鏢頭：深褐長袍、灰鬍
  chief: { main: 0x4b3527, trim: 0xb9a37a, belt: 0x2a1d15, pants: 0x262220, tails: 'long', hem: 0.5, slit: 1, bracerOn: 0, wrapOn: 0, hairColor: 0x8f8b86, beard: true, pal: null, knot: false, shoe: 0x221d1a },
  // 柳三娘：月白衫、碎花圍裙
  herbalist: { main: 0xe3e8e8, trim: 0x5f7f96, belt: 0x5f7f96, pants: 0x4d5f72, wrapOn: 0, bracerOn: 0, hem: 0.2, apronOn: 1, apronFloral: 1, apron: 0x2d4560, apron2: 0x1f3045, pal: 'trim', shoe: 0x34404e, knot: false, hairColor: 0x1d1612 },
  // 石老鐵：粗布衫捲袖、皮圍裙
  smith: { main: 0x5d5850, trim: 0x8a8378, belt: 0x3a2a1c, pants: 0x2c2824, sleeve: 0.5, wrapOn: 0, hem: 0.1, apronOn: 1, apronTop: 1, apron: 0x6b4428, apron2: 0x3d2614, shoe: 0x2a1e16, pal: null, beard: true, hairColor: 0x2b2420, knot: false },
  // 攤販：粗布短打、斗笠
  vendor: { main: 0xa4977a, trim: 0xd9cfb8, belt: 0x6a5a42, pants: 0x585044, wrap: 0xc4b89d, cord: 0x5a4c3a, bracerOn: 0, head: 'hat', pal: 'main', rough: 0.95 },
  // 劫鏢匪：黑衣、蒙面巾、紅腰帶
  bandit: { main: 0x1d1d20, trim: 0x34343a, belt: 0xa3321f, pants: 0x141416, wrap: 0x3c3935, cord: 0x1a1918, bracer: 0x2a221c, maskOn: 1, head: 'band', bandColor: 0x1b1b1d, pal: null },
  // 黑駝寨主（赤沙驛頭目）：赭紅皮長袍、黑腰帶、斗笠、絡腮鬍
  chieftain: { main: 0x6a2c1c, trim: 0xb08d48, belt: 0x1b1b1d, pants: 0x2a2220, wrap: 0x5a4a3a, cord: 0x2a1e16, bracer: 0x3a2a1c, tails: 'long', hem: 0.5, slit: 1, head: 'hat', beard: true, hairColor: 0x2a2018, pal: null, knot: false, shoe: 0x221a14 },
  // 阿檀（帳房）：長衫
  clerk: { main: 0x55687d, trim: 0xe7e1d2, belt: 0x2c3846, pants: 0x232a33, tails: 'long', hem: 0.5, bracerOn: 0, wrapOn: 0, pal: 'main', knot: false, shoe: 0x1c1d22 },
};

const COLOR_KEYS = ['main', 'trim', 'belt', 'pants', 'wrap', 'cord', 'shoe', 'sole', 'bracer', 'strap', 'apron', 'apron2', 'mask', 'skin'];
const NUM_KEYS = ['hemTrim', 'sleeve', 'bracerOn', 'wrapOn', 'beltOn', 'hem', 'slit', 'strapOn', 'apronOn', 'apronFloral', 'apronTop', 'maskOn', 'rough'];

// 語意動作名 → glb 動作
export const ANIMS = {
  idle: 'Idle_Loop', ready: 'Sword_Idle', walk: 'Walk_Loop', run: 'Jog_Fwd_Loop', sprint: 'Sprint_Loop',
  slash: 'Sword_Attack', punch: 'Punch_Cross', cast: 'Spell_Simple_Shoot', roll: 'Roll', sit: 'Sitting_Idle_Loop', hit: 'Hit_Chest',
};
const ONCE = new Set(['slash', 'punch', 'cast', 'roll', 'hit']);
const GRIP_CLIPS = new Set(['Sword_Idle', 'Sword_Attack', 'Punch_Cross']);
const HAIRS = { Male: ['Hair_SimpleParted', 'Hair_Long', 'Hair_Buns'], Female: ['Hair_Buns', 'Hair_Long', 'Hair_BuzzedFemale'] };
const FINGER = /^(thumb|index|middle|ring|pinky)_/;
const GRIP_TILT = 0.3;

// 開場大堂的展示握法（introHold）：待機站姿、手臂自然垂下，兵器方向照下表擺（以角色本身座標：面向 −Z、右手在 +X）。
// 槍立在身側、槍尾著地；刀劍刃尖朝下貼腿；弓左手斜握在身前。拳套不改，飛針收回匣中。
const holdQ = (X, Y, Z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...X).normalize(), new THREE.Vector3(...Y).normalize(), new THREE.Vector3(...Z).normalize()));
const HOLD_Q = {
  SPEAR: holdQ([-1, 0, 0], [0.06, 1, 0], [0, 0, -1]),
  SWORD: holdQ([1, 0, 0], [0, -0.97, -0.24], [0, 0.24, -0.97]),
  BLADE: holdQ([1, 0, 0], [0, -0.97, -0.24], [0, 0.24, -0.97]),
  // 弓：弓面原本正對身體前方，開場鏡頭在斜前方時只看得到一條線。往鏡頭那側轉 36°、上弓臂斜過胸前 17°（牛角弓反曲大，斜太多上梢會落到腰際），弓臂的弧線和弓弦都看得出來
  BOW: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 5, -0.3, 'YZX')).multiply(holdQ([0, 0, 1], [0, 1, 0], [-1, 0, 0])),
};
const _hq1 = new THREE.Quaternion(), _hq2 = new THREE.Quaternion(), _hq3 = new THREE.Quaternion(), _hv = new THREE.Vector3();

let LIB = null;
let loading = null;

// ── 載入 ──
export function loadActors() {
  if (loading) return loading;
  loading = (async () => {
    const arms = loadArms(); // 兵器模型（arms.glb）跟人物一起解，makeWeapon／makeStowed 之後才能同步呼叫
    const el = document.getElementById('glb-actors');
    if (!el) throw new Error('缺少內嵌的人物模型 #glb-actors');
    const bin = Uint8Array.from(atob(el.textContent.trim()), (c) => c.charCodeAt(0));
    const ab = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    const gltf = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
    const templates = {};
    for (const g of ['Male', 'Female']) {
      const o = gltf.scene.getObjectByName(g);
      if (!o) throw new Error(`人物模型缺少 ${g}`);
      o.position.set(0, 0, 0);
      templates[g] = o;
    }
    // 兩副骨架骨頭同名，載入器會把後面那副改成「名稱_1」；統一改回原名，動畫軌道也一樣
    const names = new Set();
    for (const g of ['Male', 'Female']) templates[g].traverse((o) => names.add(o.name));
    const canon = (n) => {
      const m = /^(.*)_\d+$/.exec(n);
      return m && names.has(m[1]) ? m[1] : n;
    };
    for (const g of ['Male', 'Female']) templates[g].traverse((o) => { if (o.isBone) o.name = canon(o.name); });
    // 動畫只留旋轉與骨盆位移：男女骨長不同，不能套其他骨頭的位移與縮放
    const clips = new Map();
    for (const c of gltf.animations) {
      for (const t of c.tracks) {
        const i = t.name.lastIndexOf('.');
        t.name = canon(t.name.slice(0, i)) + t.name.slice(i);
      }
      c.tracks = c.tracks.filter((t) => t.name.endsWith('.quaternion') || /^(pelvis|root)\.position$/.test(t.name));
      clips.set(c.name, c);
    }
    const fists = { r: fingerPose(clips.get('Sword_Idle'), '_r'), l: fingerPose(clips.get('Punch_Cross'), '_l') };
    relax(clips, templates.Male);
    const mats = {};
    gltf.scene.traverse((o) => {
      if (o.isMesh) for (const m of [].concat(o.material)) mats[m.name] = m;
    });
    const rig = {};
    for (const g of ['Male', 'Female']) rig[g] = measureRig(templates[g]);
    LIB = { templates, clips, mats, fists, rig, body: {} };
    for (const g of ['Male', 'Female']) LIB.body[g] = makeBodyMaterial(g, mats[`${g}_skin`]);
    await arms;
    return { clips };
  })();
  return loading;
}

// 動作第 0 幀的手指姿勢（握兵器時覆寫手指用）
function fingerPose(clip, side) {
  const out = new Map();
  if (!clip) return out;
  for (const t of clip.tracks) {
    const bone = t.name.slice(0, t.name.lastIndexOf('.'));
    if (FINGER.test(bone) && bone.endsWith(side) && t.name.endsWith('.quaternion')) out.set(bone, new THREE.Quaternion().fromArray(t.values, 0));
  }
  return out;
}

// 動作庫的待機是握拳、雙臂外張的備戰姿勢：手指往靜止姿勢放鬆，待機把上臂往下收（照 268 的做法）。
// 握兵器的三段動作不動手指。
function relax(clips, tpl) {
  const rest = new Map();
  tpl.traverse((o) => o.isBone && rest.set(o.name, o.quaternion.clone()));
  const q = new THREE.Quaternion();
  const each = (t, f) => {
    for (let i = 0; i < t.values.length; i += 4) f(q.fromArray(t.values, i)).toArray(t.values, i);
  };
  for (const [name, c] of clips) {
    if (GRIP_CLIPS.has(name)) continue;
    for (const t of c.tracks) {
      const bone = t.name.slice(0, t.name.lastIndexOf('.'));
      if (FINGER.test(bone) && rest.has(bone)) each(t, (v) => v.slerp(rest.get(bone), 0.8));
      else if (name === 'Idle_Loop' && /^lowerarm_/.test(bone)) each(t, (v) => v.slerp(rest.get(bone), 0.3));
    }
  }
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

// 綁定姿勢下各骨頭在模型空間的矩陣，以及左右手的握把座標系（掛兵器用）
function measureRig(tpl) {
  tpl.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(tpl.matrixWorld).invert();
  const bind = {};
  tpl.traverse((o) => { if (o.isBone) bind[o.name] = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld); });
  const pos = (n) => new THREE.Vector3().setFromMatrixPosition(bind[n]);
  const grip = {};
  for (const s of ['r', 'l']) {
    const H = pos(`hand_${s}`), I = pos(`index_01_${s}`), P = pos(`pinky_01_${s}`), M = pos(`middle_01_${s}`), T = pos(`thumb_01_${s}`);
    const Y = I.clone().sub(P).normalize(); // 握把軸：小指 → 食指（兵器尖端那頭）
    const A = M.clone().sub(H).normalize(); // 手指伸出的方向
    const Z = A.clone().addScaledVector(Y, -A.dot(Y)).normalize(); // 拳背（刃口）方向
    const X = new THREE.Vector3().crossVectors(Y, Z);
    const toThumb = T.clone().sub(H);
    const palm = toThumb.addScaledVector(Y, -toThumb.dot(Y)).addScaledVector(Z, -toThumb.dot(Z)).normalize(); // 掌心方向
    const C = I.clone().add(P).multiplyScalar(0.5).addScaledVector(Z, 0.028).addScaledVector(palm, 0.03);
    // 握把軸往拳背方向前傾 0.3 rad（實際握劍時劍身與前臂約成 105°；用 Sword_Idle／Sword_Attack 截圖校過）
    const W = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(C).multiply(new THREE.Matrix4().makeRotationX(GRIP_TILT));
    grip[s] = new THREE.Matrix4().copy(bind[`hand_${s}`]).invert().multiply(W);
  }
  return { bind, grip };
}

// ── 身體材質 ──
// 每個 uniform 在畫每個人時從 mesh.userData.dress 取值
function makeBodyMaterial(g, skinMat) {
  const B = BIND[g];
  const U = {};
  for (const k of COLOR_KEYS) U[k] = uniform(new THREE.Color()).onObjectUpdate(({ object }) => object.userData.dress?.c[k]);
  for (const k of NUM_KEYS) U[k] = uniform(0).onObjectUpdate(({ object }) => object.userData.dress?.n[k]);

  const p = positionGeometry;
  const x = p.x, y = p.y, z = p.z;
  const ax = abs(x);
  // 抗鋸齒的階梯：邊界寬度跟著螢幕上的像素變化
  const st = (edge, v) => {
    const w = max(fwidth(v).mul(0.9), 0.0012);
    return smoothstep(edge.sub ? edge.sub(w) : float(edge).sub(w), edge.add ? edge.add(w) : float(edge).add(w), v);
  };
  const band = (v, a, b) => st(a, v).mul(float(1).sub(st(b, v)));
  const one = float(1);

  const neck = float(B.neck), chest = float(B.chest), pelvis = float(B.pelvis), waist = float(B.waist);

  // 手臂（T 字姿勢水平）：|x| 超過肩、且高於胸
  const arm = st(B.shX + 0.03, ax).mul(st(B.chest + 0.04, y));
  const hand = st(B.wrX - 0.006, ax).mul(arm);
  const bracer = U.bracerOn.mul(st(B.wrX - 0.115, ax)).mul(one.sub(hand)).mul(arm);
  const sleeveEnd = mix(float(B.shX + 0.04), float(B.wrX - 0.11), U.sleeve);
  const bareArm = st(sleeveEnd, ax).mul(arm).mul(one.sub(bracer));
  const cuff = band(ax, sleeveEnd.sub(0.045), sleeveEnd).mul(arm).mul(st(0.02, float(0.97).sub(U.sleeve)));

  // 交領右衽：外襟邊從左頸（+x）斜下到右腋（−x），內襟短邊從右頸斜下
  const front = st(-0.012, z);
  const nb = neck.add(0.004);
  const yL1 = neck.add(x.sub(0.045).mul(1.25));
  const yL2 = neck.add(x.negate().sub(0.045).mul(1.6));
  const collarTop = mix(nb, min(nb, max(yL1, yL2)), front);
  const torso = one.sub(arm);
  // 離頸軸的距離：只在脖子一圈內算領口，肩膀上方（斜方肌）仍是衣服
  const rN = length(vec2(x, z.add(0.035)));
  const nearNeck = one.sub(st(B.neckR, rN));
  const headSkin = st(collarTop, y).mul(torso).mul(max(nearNeck, st(neck.add(0.07), y)));
  const collar = band(y, collarTop.sub(0.026), collarTop).mul(max(one.sub(st(B.neckR + 0.012, rN)), front.mul(st(0.004, nb.sub(collarTop)))));
  const lapel = front.mul(band(y, yL1.sub(0.026), yL1)).mul(one.sub(st(-0.006, x))).mul(st(waist.add(0.06), y));
  const trim = clamp(collar.add(lapel), 0, 1).mul(torso).mul(one.sub(headSkin));

  // 腰帶與下襬（側邊開衩）
  const beltY = mix(pelvis, waist, 0.55);
  const belt = U.beltOn.mul(band(y, beltY.sub(0.032), beltY.add(0.032))).mul(torso);
  const side = one.sub(st(0.045, abs(z.add(0.03)))).mul(st(B.legX + 0.035, ax));
  const hemY = mix(pelvis.sub(U.hem), beltY.sub(0.03), side.mul(U.slit));
  const jacket = st(hemY, y);
  const hemLine = band(y, hemY, hemY.add(0.018)).mul(torso);

  // 綁腿：腿中心起算的方位角做螺旋布條＋交叉細繩
  const ang = atan(ax.sub(B.legX), z.add(0.035)).mul(1 / (Math.PI * 2)); // 接縫轉到小腿後側
  const wrap = U.wrapOn.mul(band(y, B.ankle + 0.012, B.knee - 0.05)).mul(one.sub(jacket));
  const f = fract(y.mul(34).add(ang));
  const strip = smoothstep(0.0, 0.2, f).mul(smoothstep(1.0, 0.8, f));
  const c1 = fract(y.mul(8).add(ang)), c2 = fract(y.mul(8).sub(ang));
  const cl = (c) => one.sub(smoothstep(0.03, 0.055, min(c, one.sub(c))));
  const cord = max(cl(c1), cl(c2)).mul(st(B.ankle + 0.035, y)).mul(one.sub(st(B.knee - 0.07, y)));

  // 布鞋與千層底
  const shoe = one.sub(st(float(B.ankle + 0.02).sub(st(0.0, z.add(0.02)).mul(0.035)), y));
  const sole = one.sub(st(0.02, y));

  // 六器匣背帶：繞肩一圈的斜帶＋胸前橫帶
  const sx = float(0.1).add(neck.sub(y).mul(0.5));
  const strap = U.strapOn.mul(band(ax, sx.sub(0.021), sx.add(0.021))).mul(st(chest.sub(0.05), y)).mul(torso).mul(one.sub(headSkin));
  const chestStrap = U.strapOn.mul(front).mul(band(y, chest.add(B.cs - 0.012), chest.add(B.cs + 0.012))).mul(one.sub(st(sx, ax))).mul(torso);

  // 圍裙：正面，從腰（或胸）到膝上
  const apronTop = mix(beltY.add(0.035), chest.add(0.1), U.apronTop);
  const apronW = mix(float(B.legX + 0.1), float(B.legX + 0.06), U.apronTop);
  const frontA = st(-0.02, z);
  const apronBody = U.apronOn.mul(frontA).mul(band(y, float(B.knee + 0.06), apronTop)).mul(one.sub(st(apronW, ax))).mul(torso);
  const apronEdge = one.sub(band(y, float(B.knee + 0.075), apronTop.sub(0.015)).mul(one.sub(st(apronW.sub(0.015), ax))));
  // 碎花：格點上隨機擺小花，五瓣
  const cellP = vec2(x.mul(26), y.mul(26));
  const cell = floor(cellP);
  const lc = fract(cellP).sub(0.5);
  const h1 = hash(cell.x.add(cell.y.mul(57.0)));
  const h2 = hash(cell.x.mul(13.0).add(cell.y.mul(7.0)).add(3.0));
  const off = vec2(h1.sub(0.5).mul(0.4), h2.sub(0.5).mul(0.4));
  const d = lc.sub(off);
  const petal = float(0.2).add(cos(atan(d.y, d.x).mul(5)).mul(0.07));
  const flower = one.sub(smoothstep(petal.sub(0.03), petal, length(d))).mul(st(0.35, h1.add(h2).mul(0.5)));
  const flowerCol = mix(vec3(0.9, 0.88, 0.82), vec3(0.86, 0.55, 0.55), st(0.7, h2));
  const heart = one.sub(smoothstep(0.04, 0.07, length(d)));

  // 蒙面巾：頸部一圈＋臉的下半（眼睛下方）
  const mask = U.maskOn.mul(band(y, neck.sub(0.02), float(B.eye - 0.026))).mul(max(st(-0.015, z), one.sub(st(B.head + 0.005, y)))).mul(torso);

  const tex = texture(skinMat.map, uv()).rgb;
  const skinCol = tex.mul(U.skin);
  // 布紋：細噪聲
  const weave = mx_noise_float(p.mul(vec3(160, 160, 160))).mul(0.045).add(mx_noise_float(p.mul(vec3(14, 22, 14))).mul(0.05)).add(1);

  const colorNode = Fn(() => {
    const col = vec3(U.main).toVar();
    // 下襬旁的布褶陰影
    col.mulAssign(one.sub(band(y, hemY.add(0.018), hemY.add(0.07)).mul(0.12)));
    // 褲子：上衣下襬壓出的陰影
    col.assign(mix(col, U.pants.mul(one.sub(band(y, hemY.sub(0.05), hemY).mul(0.35))), one.sub(jacket)));
    col.assign(mix(col, U.trim.mul(0.8), hemLine.mul(U.hemTrim)));
    col.assign(mix(col, mix(U.wrap.mul(mix(0.72, 1.0, strip)), U.cord, cord), wrap));
    col.assign(mix(col, U.shoe, shoe));
    col.assign(mix(col, U.sole, sole));
    col.assign(mix(col, U.main.mul(1.08), cuff));
    col.assign(mix(col, U.trim, trim));
    col.assign(mix(col, U.belt, belt));
    const apronCol = mix(mix(U.apron, flowerCol, flower.mul(U.apronFloral)), vec3(0.95, 0.85, 0.5), heart.mul(flower).mul(U.apronFloral));
    col.assign(mix(col, mix(apronCol, U.apron2, apronEdge), apronBody));
    col.assign(mix(col, U.strap, max(strap, chestStrap)));
    col.assign(mix(col, U.bracer.mul(one.sub(band(fract(ax.mul(38)), 0.0, 0.12).mul(0.25))), bracer));
    col.mulAssign(weave);
    col.assign(mix(col, skinCol, clamp(headSkin.add(hand).add(bareArm), 0, 1)));
    col.assign(mix(col, U.mask.mul(weave), mask));
    return col;
  })();

  const leather = clamp(bracer.add(strap).add(chestStrap).add(apronBody.mul(one.sub(U.apronFloral))), 0, 1);
  const skinW = clamp(headSkin.add(hand).add(bareArm), 0, 1).mul(one.sub(mask));
  const roughnessNode = mix(mix(U.rough, float(0.5), leather), float(0.58), skinW);

  const m = new MeshStandardNodeMaterial({ name: `${g}_body`, metalness: 0 });
  m.colorNode = colorNode;
  m.roughnessNode = roughnessNode;
  return m;
}

// 裝扮數值表（快取）：每個 mesh 的 userData.dress 指向這裡
const dressCache = new Map();
function dressFor(look) {
  const key = `${look.preset}|${look.palette}|${look.gender}|${look.skin ?? ''}`;
  let d = dressCache.get(key);
  if (d) return d;
  const P = { ...BASE, ...(PRESETS[look.preset] || PRESETS.escort) };
  const pal = PALETTES[look.palette];
  if (pal && P.pal) {
    P[P.pal] = pal.main;
    if (P.pal === 'main') P.trim = pal.trim;
  }
  const c = {};
  for (const k of COLOR_KEYS) c[k] = new THREE.Color(P[k]);
  if (look.skin != null) c.skin.set(look.skin);
  const n = {};
  for (const k of NUM_KEYS) n[k] = P[k];
  // 有下襬布片時：開衩由布片負責；身體被布片蓋住的部分一律畫成上衣色（大步跨開時大腿會穿出布片側邊）
  const TAIL_LEN = { short: 0.2, long: 0.5 };
  if (P.tails) {
    n.slit = 0;
    n.hem = Math.max(n.hem, TAIL_LEN[P.tails] - 0.01);
  }
  // 下襬布片用的數值：整片都是上衣，下緣一道滾邊
  const tail = (L) => ({ c, n: { ...n, hem: L, slit: 0, wrapOn: 0, strapOn: 0, maskOn: 0, hemTrim: 1 } });
  d = { c, n, P, short: tail(TAIL_LEN.short), long: tail(TAIL_LEN.long) };
  dressCache.set(key, d);
  return d;
}

// ── 頭上配件、腰帶結（小網格，掛在骨頭上） ──
const accCache = new Map();
function cached(key, make) {
  let v = accCache.get(key);
  if (!v) { v = make(); accCache.set(key, v); }
  return v;
}
const stdMat = (hex, rough = 0.85, metal = 0) => cached(`m${hex}|${rough}|${metal}`, () => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal }));

// 頭巾：額前一圈布帶，腦後打結垂兩條帶尾。座標是綁定姿勢的模型空間（頭心在 (0, cy, cz)）
function headbandGeo(g) {
  return cached(`band${g}`, () => {
    const B = BIND[g];
    const cy = B.eye + (g === 'Male' ? 0.045 : 0.04);
    const rx = g === 'Male' ? 0.094 : 0.088, rz = g === 'Male' ? 0.108 : 0.1, cz = g === 'Male' ? -0.008 : -0.01;
    const pos = [], idx = [];
    const N = 40, H = 0.032;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      const s = Math.sin(a), c = Math.cos(a);
      const tilt = -c * 0.012; // 前低後高
      for (const [dy, out] of [[-H / 2, 1], [H / 2, 1]]) pos.push(s * rx * out, cy + dy + tilt, cz + c * rz * out);
    }
    for (let i = 0; i < N; i++) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const ring = new THREE.BufferGeometry();
    ring.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    ring.setIndex(idx);
    ring.computeVertexNormals();
    // 結與帶尾
    const knot = new THREE.SphereGeometry(0.02, 10, 8);
    knot.scale(1.3, 0.9, 0.8);
    knot.translate(0, cy + 0.012, cz - rz - 0.008);
    const tails = [];
    for (const s of [-1, 1]) {
      const t = new THREE.PlaneGeometry(0.03, 0.17, 1, 6);
      const a = t.attributes.position;
      for (let i = 0; i < a.count; i++) {
        const yy = a.getY(i);
        const k = (0.085 - yy) / 0.17;
        a.setXYZ(i, a.getX(i) * (1 - k * 0.3) + s * (0.012 + k * 0.03), cy - yy * 0 - (0.085 - yy) + 0.0, cz - rz - 0.012 - k * k * 0.05);
      }
      t.computeVertexNormals();
      tails.push(t);
    }
    return mergeSimple([ring, knot, ...tails]);
  });
}

// 髮髻：頭頂偏後一個圓髻，橫插一支木簪（男性 hair 0 用，疊在短髮上）
function topknotGeo(g) {
  return cached(`tk${g}`, () => {
    const B = BIND[g];
    const prof = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI;
      prof.push(new THREE.Vector2(Math.max(0.001, Math.sin(a) * 0.036), -Math.cos(a) * 0.03));
    }
    const bun = new THREE.LatheGeometry(prof, 20);
    bun.translate(0, B.top + 0.03, -0.035);
    const base = new THREE.CylinderGeometry(0.03, 0.034, 0.016, 20);
    base.translate(0, B.top + 0.006, -0.032);
    return mergeSimple([bun, base]);
  });
}
function hairpinGeo(g) {
  return cached(`pin${g}`, () => {
    const B = BIND[g];
    const pin = new THREE.CylinderGeometry(0.0032, 0.0022, 0.13, 8);
    pin.rotateZ(Math.PI / 2 - 0.12);
    pin.translate(0.005, B.top + 0.034, -0.035);
    const head = new THREE.SphereGeometry(0.0065, 8, 6);
    head.translate(-0.06, B.top + 0.027, -0.035);
    return mergeSimple([pin, head]);
  });
}

// 斗笠：竹篾編的淺圓錐，篾條用頂點色畫
function hatGeo(g) {
  return cached(`hat${g}`, () => {
    const B = BIND[g];
    const pts = [];
    const R = 0.27, Hh = 0.13;
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push(new THREE.Vector2(Math.max(0.002, t * R), Hh * (1 - Math.pow(t, 0.85)) - (t > 0.92 ? (t - 0.92) * 0.15 : 0)));
    }
    const geo = new THREE.LatheGeometry(pts, 48);
    const col = [];
    const straw = new THREE.Color(0xc8ad74), dark = new THREE.Color(0x6e5a36), tmp = new THREE.Color();
    const a = geo.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const r = Math.hypot(a.getX(i), a.getZ(i));
      const th = Math.atan2(a.getZ(i), a.getX(i));
      const ring = 0.5 + 0.5 * Math.cos(r * 160);
      const spoke = 0.5 + 0.5 * Math.cos(th * 48);
      const v = 0.15 + 0.45 * ring * spoke + (r > R * 0.95 ? 0.5 : 0);
      tmp.copy(straw).lerp(dark, Math.min(1, v));
      col.push(tmp.r, tmp.g, tmp.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const inner = geo.clone();
    inner.index.array.reverse();
    inner.translate(0, -0.004, 0);
    const out = mergeSimple([geo, inner]);
    out.translate(0, B.top - 0.035, -0.015);
    return out;
  });
}
const HAT_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });

// 腰帶結：右前側一個結＋兩條垂帶
function knotGeo(g) {
  return cached(`knot${g}`, () => {
    const B = BIND[g];
    const by = B.pelvis + (B.waist - B.pelvis) * 0.55;
    const x0 = -0.105, z0 = g === 'Male' ? 0.1 : 0.098;
    const knot = new THREE.SphereGeometry(0.02, 12, 8);
    knot.scale(1.25, 0.85, 0.65);
    knot.translate(x0, by, z0);
    const parts = [knot];
    for (const [dx, len, sw] of [[-0.012, 0.19, -1], [0.012, 0.15, 1]]) {
      const t = new THREE.PlaneGeometry(0.026, len, 1, 10);
      const a = t.attributes.position;
      for (let i = 0; i < a.count; i++) {
        const k = (len / 2 - a.getY(i)) / len;
        const xs = a.getX(i) / 0.013; // −1..1
        const cut = k > 0.95 ? xs * 0.012 * sw : 0; // 斜剪的帶尾
        a.setXYZ(i, x0 + dx + a.getX(i) * (0.85 + k * 0.35) + sw * k * 0.012, by - 0.018 - k * len + cut, z0 + 0.004 + Math.sin(k * 2.6) * 0.008 + xs * 0.003 * sw);
      }
      t.computeVertexNormals();
      parts.push(t);
      const back = t.clone();
      back.index.array.reverse();
      parts.push(back);
    }
    return mergeSimple(parts);
  });
}

function mergeSimple(list) {
  const pos = [], nor = [], col = [], idx = [];
  let base = 0;
  for (const g0 of list) {
    const g = g0;
    const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      if (c) col.push(c.getX(i), c.getY(i), c.getZ(i)); else col.push(1, 1, 1);
    }
    if (g.index) for (const i of g.index.array) idx.push(i + base);
    else for (let i = 0; i < p.count; i++) idx.push(i + base);
    base += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setIndex(idx);
  return out;
}

// 把綁定姿勢模型空間的物件掛到骨頭上（物件幾何本身用模型空間座標建）
function attachBind(actor, boneName, obj, modelMatrix = null) {
  const bone = actor.bones[boneName];
  const bind = LIB.rig[actor.gender].bind[boneName];
  const m = new THREE.Matrix4().copy(bind).invert();
  if (modelMatrix) m.multiply(modelMatrix);
  m.decompose(obj.position, obj.quaternion, obj.scale);
  bone.add(obj);
  return obj;
}

// ── Actor ──
const LOOK0 = { preset: 'escort', gender: 'Male', hair: 0, palette: null, height: 1, build: 1 };

class Actor {
  constructor(look) {
    this.root = new THREE.Group();
    this.mixer = null;
    this.extras = [];
    this.weapon = null;
    this.held = new Map();
    this.loopName = 'idle';
    this.cur = null;
    this.curName = null;
    this._onFinish = (e) => {
      if (e.action === this.cur && this.curOnce) this.play(this.loopName, { fade: 0.25 });
    };
    this.setLook(look);
  }

  setLook(look) {
    const L = { ...LOOK0, ...this.look, ...look };
    const rebuild = !this.model || L.gender !== this.gender;
    this.look = L;
    if (rebuild) this._build(L.gender);
    this._dress(L);
  }

  _build(g) {
    if (this.model) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.model);
      this.inner.remove(this.model);
    }
    this.gender = g;
    this.model = cloneSkinned(LIB.templates[g]);
    if (!this.inner) {
      this.inner = new THREE.Group();
      this.inner.rotation.y = Math.PI; // 模型面向 +Z，轉成 root 面向 −Z
      this.root.add(this.inner);
    }
    this.inner.add(this.model);
    this.bones = {};
    this.meshes = [];
    this.model.traverse((o) => {
      if (o.isBone) this.bones[o.name] = o;
      if (o.isMesh) {
        o.castShadow = true;
        o.frustumCulled = false;
        this.meshes.push(o);
      }
    });
    this.mixer = new THREE.AnimationMixer(this.model);
    this.mixer.addEventListener('finished', this._onFinish);
    this.actions = new Map();
    this.cur = null;
    const B = BIND[g];
    this.headAnchor = attachBind(this, 'Head', new THREE.Object3D(), new THREE.Matrix4().makeTranslation(0, B.top + 0.22, 0));
    this.headAnchor.name = 'headAnchor';
    // 兵器：手上一把（換類型時換掉）、匣中六件
    this.handR = attachBind(this, 'hand_r', new THREE.Group());
    this.handL = attachBind(this, 'hand_l', new THREE.Group());
    const gr = LIB.rig[g].grip;
    this.handR.matrixAutoUpdate = this.handL.matrixAutoUpdate = true;
    gr.r.decompose(this.handR.position, this.handR.quaternion, this.handR.scale);
    gr.l.decompose(this.handL.position, this.handL.quaternion, this.handL.scale);
    this.held.clear();
    this.fistL = null;
    this.caseObj = null;
    if (this.curName) this.play(this.curName, { fade: 0 });
  }

  _dress(L) {
    const g = this.gender;
    const d = dressFor(L);
    const P = d.P;
    const hairName = HAIRS[g][Math.max(0, Math.min(2, L.hair | 0))];
    const hairHex = L.hairColor ?? P.hairColor;
    for (const m of this.meshes) {
      const n = m.name;
      const owner = /_Hair_|_Brows|_Eyes|_Body|_Tails|_Robe/.test(n) ? n : (m.parent && m.parent.name) || n;
      if (/_Body/.test(owner)) {
        m.material = LIB.body[g];
        m.userData.dress = d;
      } else if (/_Tails|_Robe/.test(owner)) {
        const kind = /_Tails/.test(owner) ? 'short' : 'long';
        m.visible = P.tails === kind;
        m.material = LIB.body[g];
        m.userData.dress = d[kind];
      } else if (/_Hair_Beard/.test(owner)) {
        m.visible = !!(L.beard ?? P.beard) && !P.maskOn;
        m.material = hairMat(LIB.mats[m.material.userData.src || m.material.name] || m.material, hairHex, 'beard');
      } else if (/_Hair_/.test(owner)) {
        m.visible = owner.endsWith(hairName);
        if (m.visible) m.material = hairMat(LIB.mats[m.material.userData.src || m.material.name] || m.material, hairHex, 'hair');
      } else if (/_Brows/.test(owner)) {
        m.material = stdMat(new THREE.Color(hairHex).multiplyScalar(0.75).getHex(), 0.9);
      }
    }
    // 配件
    for (const e of this.extras) e.parent && e.parent.remove(e);
    this.extras = [];
    if (g === 'Male' && hairName === 'Hair_SimpleParted' && P.head !== 'hat') {
      this.extras.push(attachBind(this, 'Head', new THREE.Mesh(topknotGeo(g), stdMat(new THREE.Color(hairHex).multiplyScalar(1.3).getHex(), 0.6))));
      this.extras.push(attachBind(this, 'Head', new THREE.Mesh(hairpinGeo(g), stdMat(0x6b4a2c, 0.5))));
    }
    if (P.head === 'band') {
      this.extras.push(attachBind(this, 'Head', new THREE.Mesh(headbandGeo(g), stdMat(P.bandColor ?? 0x8c2a1c, 0.9))));
    } else if (P.head === 'hat') {
      this.extras.push(attachBind(this, 'Head', new THREE.Mesh(hatGeo(g), HAT_MAT)));
    }
    if (P.knot && P.beltOn) this.extras.push(attachBind(this, 'pelvis', new THREE.Mesh(knotGeo(g), stdMat(new THREE.Color(d.c.belt).getHex(), 0.9))));
    for (const e of this.extras) { e.castShadow = true; e.frustumCulled = false; }
    // 六器匣
    const wantCase = L.box ?? P.box;
    if (wantCase && !this.caseObj) {
      this.caseObj = makeCase();
      const B = BIND[g];
      const at = new THREE.Matrix4().makeTranslation(0, B.chest - 0.12, g === 'Male' ? -0.235 : -0.225);
      attachBind(this, 'spine_03', this.caseObj, at);
      this.stowed = new Map();
      for (const t of WEAPON_TYPES) {
        const s = makeStowed(t);
        if (s) { this.caseObj.add(s); this.stowed.set(t, s); }
      }
    } else if (!wantCase && this.caseObj) {
      this.caseObj.parent.remove(this.caseObj);
      this.caseObj = null;
      this.stowed = null;
    }
    this.model.scale.set(L.build, L.height, L.build);
    this.drawWeapon(this.weapon);
  }

  // 抽出兵器（null＝全部收回匣中）
  // 弓在左手；指虎雙拳各套一個（左手那個另存 fistL，鍛器流光殼只跟 held 裡右手那個）
  drawWeapon(type) {
    this.weapon = type || null;
    for (const [, w] of this.held) w.visible = false;
    if (this.fistL) this.fistL.visible = false;
    if (type) {
      let w = this.held.get(type);
      if (!w) {
        w = makeWeapon(type);
        (type === 'BOW' ? this.handL : this.handR).add(w);
        this.held.set(type, w);
      }
      w.visible = true;
      if (type === 'FIST') {
        if (!this.fistL) {
          this.fistL = makeWeapon('FIST', { left: true });
          this.handL.add(this.fistL);
        }
        this.fistL.visible = true;
      }
    }
    if (this.stowed) for (const [t, s] of this.stowed) s.visible = t !== type;
  }

  // name：語意名（ANIMS 的 key）。once 動作播完回到之前的循環
  play(name, { fade = 0.2, once, speed = 1, at } = {}) {
    const clipName = ANIMS[name] || ANIMS.idle;
    const isOnce = once ?? ONCE.has(name);
    let a = this.actions.get(clipName);
    if (!a) {
      const clip = LIB.clips.get(clipName);
      if (!clip) return null;
      a = this.mixer.clipAction(clip);
      this.actions.set(clipName, a);
    }
    if (isOnce) {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    } else {
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.clampWhenFinished = false;
      this.loopName = name;
    }
    a.timeScale = speed;
    if (this.cur !== a || isOnce) {
      a.reset();
      a.enabled = true;
      if (at != null) a.time = at;
      a.play();
      if (this.cur && this.cur !== a && fade > 0) a.crossFadeFrom(this.cur, fade, false);
      else if (this.cur && this.cur !== a) this.cur.stop();
      this.cur = a;
    }
    this.curName = name;
    this.curOnce = isOnce;
    return a;
  }

  update(dt) {
    this.mixer.update(dt);
    // 手上有兵器時把手指扣成握拳（走路、待機的動作原本是張開的）
    if (this.weapon) {
      for (const side of this.weapon === 'FIST' ? ['r', 'l'] : [this.weapon === 'BOW' ? 'l' : 'r']) {
        for (const [bone, q] of LIB.fists[side]) {
          const b = this.bones[bone];
          if (b) b.quaternion.copy(q);
        }
      }
    }
    if (this.introHold) this._applyHold();
  }

  // 開場展示：兵器照 HOLD_Q 擺正，頭往上抬一點看鏡頭
  setIntroHold(on) {
    this.introHold = !!on;
    if (!on) for (const [, w] of this.held) w.quaternion.identity();
  }

  _applyHold() {
    this.root.updateWorldMatrix(true, false);
    const rootQ = this.root.getWorldQuaternion(_hq1);
    const head = this.bones.Head || this.bones.head;
    if (head && head.parent) {
      head.parent.updateWorldMatrix(true, false);
      const pq = head.parent.getWorldQuaternion(_hq2);
      const right = _hv.set(1, 0, 0).applyQuaternion(rootQ);
      _hq3.setFromAxisAngle(right, 0.15);
      // head.local ← pq⁻¹ · 抬頭 · pq · head.local
      head.quaternion.premultiply(_hq3.premultiply(pq.clone().invert()).multiply(pq));
    }
    const w = this.weapon && this.held.get(this.weapon);
    if (!w || !w.parent) return;
    const Q = HOLD_Q[this.weapon];
    if (!Q) { w.quaternion.identity(); return; }
    w.parent.updateWorldMatrix(true, false);
    const parentQ = w.parent.getWorldQuaternion(_hq2);
    w.quaternion.copy(parentQ.invert().multiply(_hq3.copy(rootQ).multiply(Q)));
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    if (this.root.parent) this.root.parent.remove(this.root);
  }
}

function hairMat(base, hex, kind) {
  return cached(`h${base.name}|${hex}|${kind}`, () => {
    const m = base.clone();
    m.userData.src = base.name;
    m.color.set(hex).multiplyScalar(kind === 'beard' ? 1.7 : 1.9);
    m.roughness = 0.62;
    m.metalness = 0;
    return m;
  });
}

export function createActor(look = {}) {
  if (!LIB) throw new Error('先 await loadActors()');
  return new Actor(look);
}

export function actorsLoaded() {
  return !!LIB;
}

// 預覽與除錯用
export const _debug = { get lib() { return LIB; } };
