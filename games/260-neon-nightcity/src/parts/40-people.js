
// ═══ 人物：Quaternius Universal Base Characters 男女底模＋ Universal Animation Library 動畫（CC0） ═══
// blender/people.py 分好衣物材質與髮型、tools/people.mjs 以 meshopt 壓縮成 blender/out/people.glb，打包時內嵌成 #glb-people。
// 男女各依三種髮型，把身體、眉毛、眼睛與那頂頭髮合併成一份蒙皮幾何（aSlot 分區），每人一個 SkeletonUtils 複製的
// SkinnedMesh＋自己的 AnimationMixer，一人一次 draw；衣服、膚色、髮色是每人材質的 uniform。
// 骨架（65 根骨頭）不放進場景圖：網格用 detached 綁定掛在每人的外層節點下，骨頭只在角色空間裡、擺姿勢時才更新，
// 否則每次 render（倒影＋主畫面）都要重算幾千個骨頭矩陣。
// 動畫時間不累加，每幀由 uTime／uBeat 換算（舞池對拍）；動畫庫沒有的動作（調酒、DJ、撐傘、抽菸、抱胸）在播放後覆寫手臂骨頭。
// 角色面向 +z，左手在 +x。
await bootStep(BOOT.people, '行人出門…');
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
const SLOT = { skin: 0, top: 1, sleeve: 2, bottom: 3, shin: 4, shoe: 5 };   // 6 頭髮 7 眉毛 8 眼睛
const HAIR_VARS = { Male: ['SimpleParted', 'Buzzed', 'Beard'], Female: ['Long', 'Buns', 'BuzzedFemale'] };
const PEOPLE = await (async () => {
  const gltf = await embeddedGLB('people');
  // 兩副骨架的骨頭同名，載入器會把後面那副改成「名稱_1」；統一改回原名，動畫軌道也一樣
  const names = new Set();
  gltf.scene.traverse(o => names.add(o.name));
  const canon = n => { const m = /^(.*)_\d+$/.exec(n); return m && names.has(m[1]) ? m[1] : n; };
  gltf.scene.traverse(o => { if (o.isBone) o.name = canon(o.name); });
  // 動畫只留旋轉（加上骨盆位移）：男女骨架長度不同，不能套用其他骨頭的位移
  const clips = new Map();
  for (const c of gltf.animations) {
    for (const t of c.tracks) { const i = t.name.lastIndexOf('.'); t.name = canon(t.name.slice(0, i)) + t.name.slice(i); }
    c.tracks = c.tracks.filter(t => t.name.endsWith('.quaternion') || /^(pelvis|root)\.position$/.test(t.name));
    clips.set(c.name, c);
  }
  const tpl = {}, geos = {};
  const P = V3(), N = V3(), M = new T.Matrix4(), A = new T.Matrix4(), NM = new T.Matrix3();
  for (const g of ['Male', 'Female']) {
    const grp = gltf.scene.getObjectByName(g);
    const meshes = [];
    grp.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
    const body = meshes.find(m => m.material.name.endsWith('_skin'));
    const sk = body.skeleton, bi = new Map(sk.bones.map((b, i) => [b.name, i])), jb = bi.get('pelvis');
    const parts = [];   // 每個網格一段；v 是髮型編號（-1 = 每個人都有）
    for (const m of meshes) {
      const own = m.name + ' ' + (m.parent ? m.parent.name : '');
      const hair = /_Hair_([A-Za-z]+)/.exec(own);
      const s = hair ? 6 : /_Brows/.test(own) ? 7 : /_Eyes/.test(own) ? 8 : SLOT[m.material.name.split('_').pop()] ?? 0;
      const c = { v: hair ? HAIR_VARS[g].indexOf(hair[1]) : -1, pos: [], nor: [], si: [], sw: [], slot: [], idx: [] };
      // 各網格的 inverse bind 可能差一個量化變換：把頂點換到身體那副骨架的綁定空間
      const ms = m.skeleton, jm = ms.bones.findIndex(b => b.name === 'pelvis');
      M.copy(body.bindMatrixInverse).multiply(A.copy(sk.boneInverses[jb]).invert()).multiply(ms.boneInverses[jm]).multiply(m.bindMatrix);
      NM.getNormalMatrix(M);
      const ga = m.geometry.attributes;
      const remap = ms.bones.map(b => bi.get(b.name) ?? 0);
      for (let i = 0; i < ga.position.count; i++) {
        P.fromBufferAttribute(ga.position, i).applyMatrix4(M); c.pos.push(P.x, P.y, P.z);
        N.fromBufferAttribute(ga.normal, i).applyMatrix3(NM).normalize(); c.nor.push(N.x, N.y, N.z);
        for (let k = 0; k < 4; k++) { c.si.push(remap[ga.skinIndex.getComponent(i, k)]); c.sw.push(ga.skinWeight.getComponent(i, k)); }
        c.slot.push(s);
      }
      const ix = m.geometry.index;
      if (ix) for (let i = 0; i < ix.count; i++) c.idx.push(ix.getX(i));
      else for (let i = 0; i < ga.position.count; i++) c.idx.push(i);
      parts.push(c);
    }
    // 每種髮型一份幾何（身體＋那頂頭髮），沒戴的頭髮不必跑頂點 shader
    geos[g] = HAIR_VARS[g].map((_, h) => {
      const pos = [], nor = [], si = [], sw = [], slot = [], idx = [];
      for (const c of parts) {
        if (c.v >= 0 && c.v !== h) continue;
        const base = pos.length / 3;
        pos.push(...c.pos); nor.push(...c.nor); si.push(...c.si); sw.push(...c.sw); slot.push(...c.slot);
        for (const i of c.idx) idx.push(base + i);
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
      geo.setAttribute('skinIndex', new T.Uint16BufferAttribute(si, 4));
      geo.setAttribute('skinWeight', new T.Float32BufferAttribute(sw, 4));
      geo.setAttribute('aSlot', new T.Float32BufferAttribute(slot, 1));
      geo.setIndex(idx);
      return geo;
    });
    const t = new T.Group();
    t.add(grp.getObjectByName('root'));
    const sm = new T.SkinnedMesh(geos[g][0]);
    // 女性骨架在檔案裡平移了 1.2 m（男女並排），inverse bind 帶著這段位移；骨頭移出群組後要補回去
    sm.bind(new T.Skeleton(sk.bones, sk.boneInverses.map(m => m.clone().multiply(grp.matrix))), body.bindMatrix);
    sm.name = 'body';
    t.add(sm);
    tpl[g] = t;
  }
  relaxClips(clips, tpl.Male);
  // 坐姿與騎車的骨盆高度：和舊版程序人物對齊（坐在 y 處的人髖部在 y＋.78，騎士在座位原點上 .87）
  const seat = {};
  const probe = cloneSkinned(tpl.Male), mx = new T.AnimationMixer(probe), pel = probe.getObjectByName('pelvis');
  for (const [c, h] of [['Sitting_Idle_Loop', .78], ['Sitting_Talking_Loop', .78], ['Driving_Loop', .87]]) {
    mx.stopAllAction(); mx.clipAction(clips.get(c)).play(); mx.update(0);
    probe.updateMatrixWorld(true);
    seat[c] = h - pel.getWorldPosition(P).y;
  }
  return { tpl, geos, clips, seat };
})().catch(e => { console.warn('人物模型載入失敗，街上不放人', e); return null; });

// 動畫庫的待機是握拳、雙臂外張的備戰姿勢：手指往靜止姿勢放鬆，待機的手肘伸直一些、上臂往下收（同 268）
function relaxClips(clips, tpl) {
  const rest = new Map();
  tpl.traverse(o => o.isBone && rest.set(o.name, o.quaternion.clone()));
  const q = new T.Quaternion();
  const each = (t, f) => { for (let i = 0; i < t.values.length; i += 4) f(q.fromArray(t.values, i)).toArray(t.values, i); };
  for (const [name, c] of clips) {
    if (name === 'Driving_Loop') continue;
    for (const t of c.tracks) {
      const bone = t.name.slice(0, t.name.lastIndexOf('.'));
      if (/^(thumb|index|middle|ring|pinky)_/.test(bone)) each(t, v => v.slerp(rest.get(bone), .6));
      else if (name === 'Idle_Loop' && /^lowerarm_/.test(bone)) each(t, v => v.slerp(rest.get(bone), .3));
    }
  }
  const idle = clips.get('Idle_Loop');
  const body = cloneSkinned(tpl), mixer = new T.AnimationMixer(body);
  mixer.clipAction(idle).play(); mixer.update(0); body.updateMatrixWorld(true);
  for (const s of ['l', 'r']) {
    const ua = body.getObjectByName(`upperarm_${s}`), la = body.getObjectByName(`lowerarm_${s}`);
    const track = idle.tracks.find(t => t.name === `upperarm_${s}.quaternion`);
    const dir = la.position.clone().applyQuaternion(ua.quaternion).normalize();
    const down = V3(0, -1, 0).applyQuaternion(ua.parent.getWorldQuaternion(new T.Quaternion()).invert());
    const fix = new T.Quaternion().setFromUnitVectors(dir, dir.clone().lerp(down, .4).normalize());
    each(track, v => v.premultiply(fix));
  }
  mixer.stopAllAction();
}

const CHAR_VS = /* glsl */`
${GL_LIB}
#include <skinning_pars_vertex>
attribute float aSlot;
uniform vec3 uC[9];
uniform vec4 uGlow;
varying vec3 vW, vN, vCol, vEmi;
void main(){
  vec3 objectNormal = normal, transformed = position;
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
  int s = int(aSlot + .5);
  vec4 w = modelMatrix * vec4(transformed, 1.); vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * objectNormal);
  vCol = uC[s];
  vEmi = s == 5 ? uGlow.rgb * uGlow.w * .3 : vec3(0.);   // 鞋子的霓虹飾條
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const CHAR_FS = /* glsl */`
${GL_LIB}
varying vec3 vW, vN, vCol, vEmi;
void main(){
  if (vW.y < uClipY) discard;
  vec3 n = normalize(vN), v = normalize(uCam - vW);
  vec3 c = shade(vW, n, v, vCol, .65, 0.);
  c += vCol * pow(1. - max(dot(n, v), 0.), 3.) * (uFogHi * (1.5 - uDay * 1.2) + .02);
  c += vEmi;
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;
// 每人一份材質（uniform 不同），共用同一個 program；不能用 clone()，會把共用的 U 也複製掉
const charMat = () => new T.ShaderMaterial({
  uniforms: { ...shared(ALLU), uC: { value: Array.from({ length: 9 }, () => new T.Color()) }, uGlow: { value: new T.Vector4() } },
  vertexShader: CHAR_VS, fragmentShader: CHAR_FS,
});
const ANIM = { idle: 0, walk: 1, run: 2, danceA: 3, danceB: 4, danceC: 5, sit: 6, bartend: 7, umbrella: 8, dj: 9, cross: 10, talk: 11, ride: 12, punch: 14, smoke: 15,
  die: 16, getup: 17, jab: 18, interact: 19, crouch: 20, aimIdle: 21, aimWalk: 22, swing: 23, handsUp: 24, kneel: 25, throw: 26, aimRun: 27, driveBy: 28, swimIdle: 29, swim: 30 };
// 動作 → 動畫：rate 是每單位相位走幾秒動畫（行走的相位沿用舊版步頻），beat 是幾拍一輪（跳舞對拍），alt 依相位換另一段
const ACLIP = {
  [ANIM.idle]: { c: 'Idle_Loop' }, [ANIM.walk]: { c: 'Walk_Loop', rate: 1.3 }, [ANIM.run]: { c: 'Jog_Fwd_Loop', rate: .93 },
  [ANIM.danceA]: { c: 'Dance_Loop', beat: 2 }, [ANIM.danceB]: { c: 'Dance_Loop', beat: 2, off: .5 }, [ANIM.danceC]: { c: 'Dance_Loop', beat: 4 },
  [ANIM.sit]: { c: 'Sitting_Idle_Loop', alt: 'Sitting_Talking_Loop' }, [ANIM.bartend]: { c: 'Idle_Loop' }, [ANIM.umbrella]: { c: 'Walk_Loop', rate: 1.3 },
  [ANIM.dj]: { c: 'Idle_Loop' }, [ANIM.cross]: { c: 'Idle_Loop' }, [ANIM.talk]: { c: 'Idle_Talking_Loop' }, [ANIM.ride]: { c: 'Driving_Loop' },
  [ANIM.punch]: { c: 'Punch_Cross', beat: 2, alt: 'Punch_Jab' }, [ANIM.smoke]: { c: 'Idle_Loop' },
  // 68-gta.js 用的單次動作（once：相位是開始的時刻，播完停在最後一格；rev：倒著播，倒地動畫倒放當作爬起來）
  [ANIM.die]: { c: 'Death01', once: 1, rate: 1.3 }, [ANIM.getup]: { c: 'Death01', once: 1, rev: 1, rate: 1.9 }, [ANIM.jab]: { c: 'Punch_Jab', once: 1, rate: 1.3 },
  [ANIM.interact]: { c: 'Interact', once: 1, rate: 1.2 }, [ANIM.crouch]: { c: 'Crouch_Idle_Loop' },
  [ANIM.aimIdle]: { c: 'Pistol_Idle_Loop' }, [ANIM.aimWalk]: { c: 'Walk_Loop', rate: 1.3 },
  // 69-combat.js：揮砍（近戰武器）、投降舉手、跪下雙手抱頭（被捕）、丟擲、持槍跑（警察）
  [ANIM.swing]: { c: 'Sword_Attack', once: 1, rate: 1.5 }, [ANIM.handsUp]: { c: 'Idle_Loop' }, [ANIM.kneel]: { c: 'Crouch_Idle_Loop' },
  [ANIM.throw]: { c: 'Punch_Cross', once: 1, rate: 1.2 }, [ANIM.aimRun]: { c: 'Jog_Fwd_Loop', rate: .93 },
  // 69-combat.js：開車時把手伸出車窗開槍（坐姿沿用開車動畫）
  [ANIM.driveBy]: { c: 'Driving_Loop' },
  // 下水：踩水與自由式（40-people.js 的 updatePlayerWalk）
  [ANIM.swimIdle]: { c: 'Swim_Idle_Loop' }, [ANIM.swim]: { c: 'Swim_Fwd_Loop', rate: 1.1 },
};
const clipOf = (id, p) => { const a = ACLIP[id] || ACLIP[0]; return a.alt && p.alt ? a.alt : a.c; };
function clipTime(id, name, t, b) {
  const a = ACLIP[id] || ACLIP[0], d = PEOPLE.clips.get(name).duration;
  if (a.once) { const u = clamp(t * (a.rate || 1), 0, d - 1e-3); return a.rev ? d - 1e-3 - u : u; }
  const u = a.beat ? (b + (a.off || 0)) / a.beat * d : t * (a.rate || 1);
  return ((u % d) + d) % d;
}
// 讓骨頭（指向第一個子骨）轉向角色空間的方向（骨架不在場景裡，世界空間就是角色空間）；w 是和動畫原姿勢的混合比例
const _q1 = new T.Quaternion(), _q2 = new T.Quaternion(), _q3 = new T.Quaternion(), _qi = new T.Quaternion(), _v1 = V3(), _v2 = V3();
function aim(p, name, x, y, z, w = 1) {
  const bone = p.bones[name];
  bone.parent.getWorldQuaternion(_q1);
  _q2.multiplyQuaternions(_q1, bone.quaternion);
  _v1.copy(bone.children[0].position).normalize().applyQuaternion(_q2);
  _v2.set(x, y, z).normalize();
  _q3.setFromUnitVectors(_v1, _v2);
  if (w < 1) _q3.slerp(_qi, 1 - w);
  bone.quaternion.copy(_q1.invert().multiply(_q3.multiply(_q2)));
}
function aimArms(p) {
  const k = p.aimK ?? 1, P = p.aimP ?? 0, sy = Math.sin(P), cz = Math.cos(P);
  // 重型武器（68-gta.js 設定 p.heavy）：轉管機槍抱在腰間，右手握後把、左手托槍管；火箭筒扛在右肩，左手往前扶住筒身
  if (p.heavy === 'hip') {   // 方向是兩節骨 IK 對著握把（腰間）與提把解出來的
    aim(p, 'upperarm_r', -.23, -.82, .52, k); aim(p, 'lowerarm_r', .59, sy * .6 - .35, .73, k);
    aim(p, 'upperarm_l', -.46, -.58, .67, k); aim(p, 'lowerarm_l', -.58, sy * .6 - .39, .71, k);
    return;
  }
  if (p.heavy === 'shoulder') {
    aim(p, 'upperarm_r', -.62, -.43, .66, k); aim(p, 'lowerarm_r', .74, .39 + sy * .6, .55, k);
    aim(p, 'upperarm_l', -.63, sy * .5, .77, k); aim(p, 'lowerarm_l', -.66, .11 + sy * .6, .74, k);
    return;
  }
  aim(p, 'upperarm_r', -.1, sy, cz, k); aim(p, 'lowerarm_r', -.02, sy, cz, k);
  aim(p, 'upperarm_l', -.42, sy - .32, .85, k); aim(p, 'lowerarm_l', -.8, sy * .6 + .05, .6, k);
}
// 車內射擊：右臂整隻沿瞄準方向伸直（p.dbDir 是角色空間的方向，69-combat.js 的 driveByPlace 每幀設定）
function driveByArm(p) { const [x, y, z] = p.dbDir; aim(p, 'upperarm_r', x, y + .4, z); aim(p, 'lowerarm_r', x, y + .08, z); }   // 上臂往上抬，從窗框上伸出去
const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const frac = x => x - Math.floor(x);
// 動畫庫沒有的動作：t 是相位時間、b 是拍點
const OVR = {
  [ANIM.umbrella]: p => { aim(p, 'upperarm_r', -.25, -.85, .45); aim(p, 'lowerarm_r', 0, .7, .7); },
  [ANIM.cross]: p => {
    aim(p, 'upperarm_l', .2, -.9, .3); aim(p, 'upperarm_r', -.2, -.9, .3);
    aim(p, 'lowerarm_l', -1, .12, .3); aim(p, 'lowerarm_r', 1, .02, .38);
  },
  [ANIM.dj]: (p, t) => {
    aim(p, 'upperarm_l', .75, .3, .1); aim(p, 'lowerarm_l', -.55, .8, -.1);
    aim(p, 'upperarm_r', -.25, -.6, .75); aim(p, 'lowerarm_r', .15 + .25 * Math.sin(t * 7), -.25, 1);
  },
  [ANIM.bartend]: (p, t) => {
    if (frac(t * .08) < .5) {
      const sh = .25 * Math.sin(t * 19);
      aim(p, 'upperarm_l', .3, -.45, .85); aim(p, 'upperarm_r', -.3, -.45, .85);
      aim(p, 'lowerarm_l', -.35, .55 + sh, .75); aim(p, 'lowerarm_r', .35, .55 + sh, .75);
    } else { aim(p, 'upperarm_r', -.2, -.75, .6); aim(p, 'lowerarm_r', .1 + .3 * Math.cos(t * 4), -.15, 1); }
  },
  [ANIM.smoke]: (p, t) => {
    const u = frac(t * .1), k = sst(0, .1, u) * sst(.25, .15, u);
    aim(p, 'upperarm_r', -.2, -.9 + .4 * k, .35 + .3 * k); aim(p, 'lowerarm_r', .05 + .3 * k, -.1 + 1.1 * k, 1 - .6 * k);
  },
  [ANIM.sit]: (p, t) => {
    const u = frac(t * .07), k = sst(0, .08, u) * sst(.2, .12, u);
    if (k > .01) { aim(p, 'upperarm_r', -.15, -.55, .8, k); aim(p, 'lowerarm_r', .3, .95, .25, k); }
  },
  // 機車：動畫庫只有開車的坐姿，改成上身前傾、手伸向把手
  [ANIM.ride]: p => {
    aim(p, 'spine_01', 0, .82, .55); aim(p, 'neck_01', 0, .9, .45);
    aim(p, 'upperarm_l', .3, -.3, .9); aim(p, 'upperarm_r', -.3, -.3, .9);
    aim(p, 'lowerarm_l', -.05, -.45, 1); aim(p, 'lowerarm_r', .05, -.45, 1);
    if (p.dbDir) driveByArm(p);
  },
  // 車內射擊：腿往前伸平（收在儀表板下，免得腳從車底露出來）
  [ANIM.driveBy]: p => {
    aim(p, 'thigh_l', .05, -.12, 1); aim(p, 'thigh_r', -.05, -.12, 1); aim(p, 'calf_l', 0, -.25, 1); aim(p, 'calf_r', 0, -.25, 1);
    if (p.dbDir) driveByArm(p);
  },
  [ANIM.danceB]: (p, t, b) => {
    const k = .3 * Math.sin(b * Math.PI * 2);
    aim(p, 'upperarm_l', .35, 1, .1); aim(p, 'upperarm_r', -.35, 1, .1);
    aim(p, 'lowerarm_l', -.2 + k, 1, .2); aim(p, 'lowerarm_r', .2 + k, 1, .2);
  },
  // 持槍瞄準：右臂沿準星的俯仰伸直，左手過來托住（p.aimP 是俯仰角、p.aimK 是瞄準的混合比例，68-gta.js 每幀設定）
  [ANIM.aimIdle]: p => aimArms(p), [ANIM.aimWalk]: p => aimArms(p), [ANIM.aimRun]: p => aimArms(p),
  // 投降：雙手舉過頭；被捕：跪著、雙手抱在腦後
  [ANIM.handsUp]: (p, t) => {
    const s = .04 * Math.sin(t * 9);
    aim(p, 'upperarm_l', .55, .82, .1); aim(p, 'upperarm_r', -.55, .82, .1);
    aim(p, 'lowerarm_l', .08 + s, 1, .05); aim(p, 'lowerarm_r', -.08 - s, 1, .05);
  },
  [ANIM.kneel]: p => {
    aim(p, 'upperarm_l', .85, .45, -.2); aim(p, 'upperarm_r', -.85, .45, -.2);
    aim(p, 'lowerarm_l', -.75, .45, -.45); aim(p, 'lowerarm_r', .75, .45, -.45);
  },
  [ANIM.danceC]: (p, t, b) => {
    const k = Math.sin(b * Math.PI);
    aim(p, 'upperarm_l', .9, -.2 + .6 * Math.max(0, k), .4); aim(p, 'upperarm_r', -.9, -.2 + .6 * Math.max(0, -k), .4);
  },
};
const SKINS = [0xf1c8a8, 0xd9a07a, 0xb57a52, 0x8a5636, 0x5e3a24, 0xe8b894].map(lin);
const HAIRS = [0x15110e, 0x2b1d14, 0x5a3a22, 0xb08a5a, 0x777777, 0x1a1a2a, 0x8a2a3a, 0x3a6a8a].map(lin);
const TOPS = [0x2a2c30, 0x3b2a22, 0x5a1d22, 0x1f2f45, 0x6d6a60, 0x23352a, 0x8a6a3a, 0x111215, 0x4a2a4a, 0x9a9a92, 0x2a4a5a].map(lin);
const BOTS = [0x1a1c22, 0x2a2d35, 0x3a3228, 0x101012, 0x2f3a4a, 0x4a4038].map(lin);
const SHOES = [0x141416, 0x1e1c1a, 0x2a2420, 0xb8b6b0].map(lin);
const GLOWS = [0x2cf2d8, 0xff3fa0, 0xffae57, 0x7af0ff, 0xd6ff3a].map(lin);
const EYES = lin(0x0c0b0a);
const CROWDS = [];
// 建一群人：每人一組外觀與動作。look 的 coat＝長袖、skirt＝露腿、longHair＝長髮女性、glow＝鞋子的霓虹飾條
function crowd(n, cap = n) {
  const group = new T.Group();
  const people = [];
  for (let k = 0; k < cap; k++) people.push({ k, x: 0, y: 0, z: 0, yaw: 0, s: 1, rig: null, a: [0, 0, 1, 0], a2: [0, 0, 1], handL: V3(-.25, 1.2, .3) });
  const api = {
    mesh: group, people,
    look(k, o = {}) {
      const r = o.r || Math.random;
      const pick = arr => arr[Math.floor(r() * arr.length)];
      const p = people[k];
      if (!PEOPLE) return;
      const fem = o.female ?? (o.longHair ? true : o.longHair === 0 ? false : r() < .45);
      const sex = fem ? 'Female' : 'Male';
      if (p.rig && p.sex !== sex) { p.h.remove(p.sm); p.rig = null; }
      const fresh = !p.rig;
      if (fresh) {
        p.sex = sex;
        p.h ||= group.add(new T.Group()).children.at(-1);
        p.rig = cloneSkinned(PEOPLE.tpl[sex]);
        p.sm = p.rig.getObjectByName('body');
        p.rig.remove(p.sm);
        p.sm.bindMode = T.DetachedBindMode;
        p.h.add(p.sm);
        p.sm.material = charMat();
        p.sm.boundingSphere = new T.Sphere(V3(0, 1, 0), 1.3);
        // 骨頭矩陣只在擺過姿勢後重算（倒影與主畫面各 render 一次，遠處的人隔幀才擺）
        const sk = p.sm.skeleton;
        sk.update = () => { if (sk.dirty) { T.Skeleton.prototype.update.call(sk); sk.dirty = false; } };
        p.bones = {};
        p.rig.traverse(b => { if (b.isBone) p.bones[b.name] = b; });
        p.mixer = new T.AnimationMixer(p.rig);
        p.acts = new Map();
      }
      const u = p.sm.material.uniforms, C = u.uC.value;
      const skin = o.skin || pick(SKINS), top = o.top || pick(TOPS), bot = o.bot || pick(BOTS), hair = o.hair || pick(HAIRS);
      const long = o.coat ?? (r() < .6 ? 1 : 0), bare = fem && (o.skirt ?? (r() < .3 ? 1 : 0));
      C[0].copy(skin); C[1].copy(top); C[2].copy(long ? top : skin); C[3].copy(bot); C[4].copy(bare ? skin : bot);
      C[5].copy(o.shoe || pick(SHOES)); C[6].copy(hair); C[7].copy(hair).multiplyScalar(.8); C[8].copy(EYES);
      p.sm.geometry = PEOPLE.geos[sex][fem ? (o.longHair ? 0 : o.longHair === 0 ? 1 + Math.floor(r() * 2) : Math.floor(r() * 3)) : (o.hat ? 1 : Math.floor(r() * 3))];
      const gc = o.glow || pick(GLOWS);
      u.uGlow.value.set(gc.r, gc.g, gc.b, o.glowI ?? (r() < .3 ? 1.6 : 0));
      p.s = o.scale || ((fem ? .95 : 1) * (.94 + r() * .1));
      p.alt = r() < .5;   // 有兩段動畫的動作（坐、出拳）固定用哪一段
      if (fresh) poseOne(p, 0, 0);   // 先擺一次待機，畫面外（倒影裡）的人才不會是 T 字
    },
    anim(k, id, phase = Math.random() * 10, speed = 1, beatOff = 0) { const a = people[k].a; a[0] = id; a[1] = phase; a[2] = speed; a[3] = beatOff; },
    anim2(k, id, w, speed = 1) { const a = people[k].a2; a[0] = id; a[1] = w; a[2] = speed; },
    place(k, x, y, z, yaw) {
      const p = people[k]; p.x = x; p.y = y; p.z = z; p.yaw = yaw;
      if (p.h) { p.h.position.set(x, y, z); p.h.rotation.set(0, yaw, 0); p.h.scale.setScalar(p.s); }
    },
    // 直接給整個變換（騎機車時跟著車身壓車）
    placeM(k, m) {
      const p = people[k];
      if (!p.h) return;
      m.decompose(p.h.position, p.h.quaternion, p.h.scale);
      p.h.scale.multiplyScalar(p.s);
      p.x = p.h.position.x; p.y = p.h.position.y; p.z = p.h.position.z;
    },
    flush() {},
  };
  CROWDS.push(api);
  return api;
}
function act(p, name) {
  let a = p.acts.get(name);
  if (!a) { a = p.mixer.clipAction(PEOPLE.clips.get(name)); p.acts.set(name, a); }
  if (!a.isRunning()) a.play();
  return a;
}
function poseOne(p, t, b) {
  const [id, ph, sp, bo] = p.a, [id2, w2, sp2] = p.a2;
  const n1 = clipOf(id, p), n2 = w2 > .01 ? clipOf(id2, p) : null, mix2 = n2 && n2 !== n1;
  for (const [n, a] of p.acts) if (n !== n1 && !(mix2 && n === n2) && a.isRunning()) a.stop();
  const a1 = act(p, n1);
  a1.time = clipTime(id, n1, t * sp + ph, b + bo); a1.weight = mix2 ? 1 - w2 : 1;
  if (mix2) { const a2 = act(p, n2); a2.time = clipTime(id2, n2, t * sp2 + ph, b + bo); a2.weight = w2; }
  p.mixer.update(0);
  p.sm.position.y = PEOPLE.seat[n1] || 0;
  const f = OVR[id];
  if (f && (!mix2 || w2 < .5)) f(p, t * sp + ph, b + bo);
  p.rig.updateMatrixWorld(true);
  p.sm.skeleton.dirty = true;
  if (id === ANIM.umbrella) p.handL.setFromMatrixPosition(p.bones.hand_r.matrixWorld).y += p.sm.position.y;
}
// 每幀更新目前場景裡、在畫面內的人；遠處的人隔幀更新
const _fr = new T.Frustum(), _pm = new T.Matrix4(), _sph = new T.Sphere(V3(), 1.4);
let crowdFrame = 0;
function updateCrowds(scn) {
  crowdFrame++;
  camera.updateMatrixWorld();
  _fr.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const t = U.uTime.value, b = U.uBeat.value, cp = camera.position;
  for (const c of CROWDS) {
    if (c.mesh.parent !== scn || !c.mesh.visible) continue;
    for (const p of c.people) {
      if (!p.rig) continue;
      _sph.center.set(p.x, p.y + 1, p.z);
      if (!_fr.intersectsSphere(_sph)) continue;
      const d = cp.distanceTo(_sph.center);
      if (d > 35 && (crowdFrame + p.k) % (d > 70 ? 4 : 2)) continue;
      poseOne(p, t, b);
    }
  }
}

// ─── 街上的行人：沿著街區人行道繞圈，多數撐傘 ───
const PED_N = LOW ? 18 : 38;
const peds = crowd(PED_N + 8);
const pedState = [];
const rP = rng(77);
const umbrellas = [];
{
  const inner = blocks.filter(b => !b.outer && !b.park && isOld(b.i, b.j));   // 開場在舊城區（玩家附近），之後 pedRelocate 跟著玩家搬
  for (let k = 0; k < PED_N; k++) {
    const b = inner[Math.floor(rP() * inner.length)];
    const inset = 1.3 + rP() * 2.4;
    const w = b.x1 - b.x0 - inset * 2, d = b.z1 - b.z0 - inset * 2;
    const per = 2 * (w + d);
    const um = rP() < .62;
    pedState.push({ b, inset, w, d, per, s: rP() * per, dir: rP() < .5 ? 1 : -1, v: 1.05 + rP() * .5, um, um0: um, dodge: 0, dx: 0, dz: 0 });
    peds.look(k, { r: rP });
    peds.anim(k, um ? ANIM.umbrella : ANIM.walk, rP() * 10, pedState[k].v * .78);
    if (um) umbrellas.push(k);
  }
  // 夜店門口排隊的人與保鑣
  for (let q = 0; q < 6; q++) {
    const k = PED_N + q;
    peds.look(k, { r: rP, glowI: q % 2 ? 1.6 : 0 });
    const x = CLUB_X - 4.5 - q * 1.05, z = CLUB_Z + 1.5 + (q % 2) * .3;
    peds.anim(k, q % 3 === 0 ? ANIM.talk : q % 3 === 1 ? ANIM.idle : ANIM.smoke, rP() * 10, 1);
    peds.place(k, x, .15, z, Math.PI / 2 + (rP() - .5) * .8);
    circles.push({ x, z, r: .3 });
  }
  peds.look(PED_N + 6, { top: lin(0x0c0c0e), bot: lin(0x0c0c0e), skin: SKINS[3], hair: HAIRS[0], coat: 1, skirt: 0, longHair: 0, hat: 0, glowI: 0, scale: 1.12 });
  peds.anim(PED_N + 6, ANIM.cross, 0, 1);
  peds.place(PED_N + 6, CLUB_X + 1.6, .15, CLUB_Z + 1.1, 0);
  circles.push({ x: CLUB_X + 1.6, z: CLUB_Z + 1.1, r: .35 });
  // 酒吧門口抽菸的人
  peds.look(PED_N + 7, { r: rP, coat: 1 });
  peds.anim(PED_N + 7, ANIM.smoke, 3, 1);
  peds.place(PED_N + 7, BAR_X - 3.2, .15, BAR_Z + .45, .2);
  circles.push({ x: BAR_X - 3.2, z: BAR_Z + .45, r: .3 });
  peds.mesh.count = PED_N + 8;
  scene.add(peds.mesh);
}
const BOUNCER = { x: CLUB_X + 1.6, z: CLUB_Z + 1.1 };
// 雨停了收傘、下雨了撐傘（28-sky.js 的 updateWeather 在雨量跨過門檻時呼叫）；倒地、逃跑或被 69-combat 接手的人等恢復時自己換
function pedUmbrellas(on) {
  pedState.forEach((ps, k) => {
    const want = on && ps.um0;
    if (ps.um === want) return;
    ps.um = want;
    if (!(ps.down > 0) && !(ps.panic > 0) && !ps.fsm) peds.anim(k, want ? ANIM.umbrella : ANIM.walk, rP() * 10, ps.v * .78);
  });
}
const umbMesh = (() => {
  const k = new Kit();
  const cone = new T.ConeGeometry(.62, .32, 10, 1, true);
  k.add(cone, 0xffffff, 10, tf(0, .16, 0));
  k.cyl(0, -.45, 0, .012, .012, .95, 5, 0x222222, 15);
  k.cyl(0, -.94, .03, .02, .02, .12, 5, 0x3a2a1a, 2, .5);
  const g = k.build();
  const m = new T.InstancedMesh(g, MAT.uberD, Math.max(1, umbrellas.length));
  const cols = [0x111214, 0x1a1c22, 0x5a1218, 0x1d2a45, 0x8fa8b8, 0x2c3e2c].map(lin);
  const ic = new Float32Array(Math.max(1, umbrellas.length) * 3);
  umbrellas.forEach((_, i) => { const c = cols[i % cols.length]; ic.set([c.r, c.g, c.b], i * 3); });
  m.instanceColor = new T.InstancedBufferAttribute(ic, 3);
  m.frustumCulled = false; scene.add(m);
  return m;
})();
// uberD 是雙面材質：傘面顏色以 instanceColor 乘上
MAT.uberD.vertexShader = MAT.uberD.vertexShader.replace('vCol = color;', `vCol = color;
  #ifdef USE_INSTANCING_COLOR
  vCol *= instanceColor;
  #endif
  `);
function pedPos(ps) {
  const { b, inset, w, d } = ps;
  let s = ((ps.s % ps.per) + ps.per) % ps.per;
  const x0 = b.x0 + inset, z0 = b.z0 + inset;
  if (s < w) return [x0 + s, z0, 1, 0];
  s -= w; if (s < d) return [x0 + w, z0 + s, 0, 1];
  s -= d; if (s < w) return [x0 + w - s, z0 + d, -1, 0];
  s -= w; return [x0, z0 + d - s, 0, -1];
}
// 行人繞著一個街區走；那個街區離玩家超過 230 m 就換到玩家附近 70–180 m 的街區（城市放大後人不會散到看不到的地方）
const pedBlocks = blocks.filter(b => !b.outer && !b.park);
function pedRelocate(ps, px, pz) {
  for (let n = 0; n < 30; n++) {
    const b = pedBlocks[Math.floor(rP() * pedBlocks.length)], d = Math.hypot((b.x0 + b.x1) / 2 - px, (b.z0 + b.z1) / 2 - pz);
    if (d < 70 || d > 180) continue;
    ps.b = b; ps.w = b.x1 - b.x0 - ps.inset * 2; ps.d = b.z1 - b.z0 - ps.inset * 2; ps.per = 2 * (ps.w + ps.d); ps.s = rP() * ps.per; ps.dx = ps.dz = 0;
    return;
  }
}
function updatePeds(dt) {
  let u = 0;
  const ppx = pX(), ppz = pZ();
  pedState.forEach((ps, k) => {
    if (!ps.fsm && !(ps.down > 0) && !(ps.panic > 0) && ((ps.b.x0 + ps.b.x1) / 2 - ppx) ** 2 + ((ps.b.z0 + ps.b.z1) / 2 - ppz) ** 2 > 230 * 230) pedRelocate(ps, ppx, ppz);
    // 68-gta.js：中彈或被撞倒地（down 秒數倒數完換個地方重新出現），聽到槍聲爆炸就跑（panic）
    // 69-combat.js：被槍指著投降、抱頭蹲下、脾氣差的人反擊（pedFsm 接手這一幀就 return）
    if (ps.fsm && !(ps.down > 0) && pedFsm(k, ps, dt)) return;
    if (ps.down > 0) {
      ps.down -= dt;
      peds.place(k, ps.dpos[0], groundH(ps.dpos[0], ps.dpos[1]) > 0 ? .15 : 0, ps.dpos[1], ps.dpos[2]);
      if (ps.down <= 0 && ps.stun) { ps.stun = 0; ps.panic = 6; peds.anim(k, ANIM.run, rP() * 10, 1); return; }   // 電擊槍：原地爬起來逃跑
      if (ps.down <= 0) { ps.s = rP() * ps.per; ps.dx = ps.dz = 0; ps.panic = 0; peds.anim(k, ps.um ? ANIM.umbrella : ANIM.walk, rP() * 10, ps.v * .78); }
      return;
    }
    if (ps.panic > 0) { ps.panic -= dt; if (ps.panic <= 0) peds.anim(k, ps.um ? ANIM.umbrella : ANIM.walk, rP() * 10, ps.v * .78); }
    ps.s += (ps.panic > 0 ? 4.4 : ps.v) * ps.dir * dt;
    let [x, z, tx, tz] = pedPos(ps);
    tx *= ps.dir; tz *= ps.dir;
    // 被玩家逼近時往旁邊閃
    const px = player.mode === 'drive' ? player.veh.x : player.x, pz = player.mode === 'drive' ? player.veh.z : player.z;
    const dx = x + ps.dx - px, dz = z + ps.dz - pz, dd = Math.hypot(dx, dz);
    const danger = player.mode === 'drive' ? (Math.hypot(player.veh.vx, player.veh.vz) > 3 ? 4.5 : 2.4) : .9;
    if (dd < danger && dd > .01) { ps.dx += dx / dd * (danger - dd) * 4 * dt; ps.dz += dz / dd * (danger - dd) * 4 * dt; ps.dodge = 1.2; }
    ps.dx = damp(ps.dx, 0, ps.dodge > 0 ? .3 : 1.2, dt); ps.dz = damp(ps.dz, 0, ps.dodge > 0 ? .3 : 1.2, dt);
    const lim = 1.4; ps.dx = clamp(ps.dx, -lim, lim); ps.dz = clamp(ps.dz, -lim, lim);
    if (ps.dodge > 0) ps.dodge -= dt;
    x += ps.dx; z += ps.dz;
    const yaw = Math.atan2(tx, tz);
    peds.place(k, x, .15, z, yaw);
    if (ps.um && !(ps.panic > 0)) {
      // 傘柄握在右手（手的位置在上次擺姿勢時記在角色空間）
      const p = peds.people[k], h = p.handL, sc = p.s, c = Math.cos(yaw), s = Math.sin(yaw);
      _o.position.set(x + (h.x * c + h.z * s) * sc, .15 + h.y * sc + .92, z + (h.z * c - h.x * s) * sc);
      _o.rotation.set(.08, yaw, 0); _o.scale.setScalar(1); _o.updateMatrix();
      umbMesh.setMatrixAt(u++, _o.matrix);
    }
  });
  umbMesh.count = u; umbMesh.instanceMatrix.needsUpdate = true;
  peds.flush();
}

// ─── 玩家 ───
const me = crowd(1);
me.look(0, { r: rng(9), female: false, top: lin(0x2b2420), bot: lin(0x17181c), skin: SKINS[1], hair: HAIRS[0], coat: 1, skirt: 0, longHair: 0, hat: 0, shoe: SHOES[0], glow: lin(0xffae57), glowI: 1.4, scale: 1 });
me.anim(0, ANIM.idle, 0, 1);
scene.add(me.mesh);
const player = { mode: 'walk', x: avX(1) - 9.6, z: stZ(2) + 18, y: .15, yaw: 0, v: 0, vx: 0, vz: 0, veh: null, walkPh: 0, dance: 0, anim: ANIM.idle, blend: 0, prevAnim: ANIM.idle, where: 'out', stepT: 0 };
const SWIM_Y = .06;   // UAL 的游泳動畫以根骨當水面（踩水骨盆在 -0.33 m、自由式在 -0.08 m）
function updatePlayerWalk(inp, dt, camYaw) {
  let mx = inp.mx, mz = inp.mz;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  if (ml > .05) player.dance = 0;
  // 相機的前方 = (sin yaw, cos yaw)；右方 = (-cos, sin)
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -fz, rz = fx;
  const wx = fx * mz + rx * mx, wz = fz * mz + rz * mx;
  const aimM = gta.aiming, run = inp.run && ml > .1 && !aimM;
  // 水深超過 1.25 m 改游泳（離開時 1.05 m，避免在邊界來回切換）；涉水時走慢一點
  const depth = player.where === 'out' ? waterDepth(player.x, player.z) : 0, wasSwim = player.swim;
  player.swim = depth > (player.swim ? 1.05 : 1.25);
  if (player.swim !== wasSwim && depth > 0) { sfx.splash(player.swim ? 1 : .5); if (player.swim) { player.dance = 0; arm.trig = false; } }
  const wade = player.swim ? 1 : clamp(1 - depth * .5, .45, 1);
  const target = ml > .05 ? (player.swim ? (run ? 2.3 : 1.3) : (run ? 4.6 : aimM ? 1.5 : 1.7) * wade) * Math.min(1, ml) : 0;
  player.v = damp(player.v, target, target > player.v ? 6 : 10, dt);
  let mdx = Math.sin(player.yaw), mdz = Math.cos(player.yaw);
  if (aimM) {
    // 瞄準時身體對著準星，移動方向照搖桿（側移、後退）
    player.yaw += wrapA(camYaw - player.yaw) * (1 - Math.exp(-18 * dt));
    if (ml > .05) { const l = Math.hypot(wx, wz); player.mvx = wx / l; player.mvz = wz / l; }
    mdx = player.mvx || 0; mdz = player.mvz || 0;
  } else if (ml > .05) {
    const ty = Math.atan2(wx, wz);
    player.yaw += wrapA(ty - player.yaw) * (1 - Math.exp(-12 * dt));
    mdx = Math.sin(player.yaw); mdz = Math.cos(player.yaw);
  }
  const nx = player.x + mdx * player.v * dt, nz = player.z + mdz * player.v * dt;
  let r = collideCircle(nx, nz, .32, false, true);
  let x = r.x, z = r.z;
  if (depth > 0) { x = clamp(x, FAR_BANK_X + 30, EAST_BANK_X - 30); z = Math.min(z, ISLE.z1 + 320); }   // 游不到對岸
  // 車流與座駕也會擋路
  const pushOut = (ox, oz, rr) => { const dx = x - ox, dz = z - oz, d = Math.hypot(dx, dz); if (d < rr && d > 1e-4) { x = ox + dx / d * rr; z = oz + dz / d * rr; } };
  for (const c of traffic) { const L = TYPES[c.type].len * .3; for (const s of [-1, 1]) pushOut(c.x + Math.sin(c.yaw) * L * s, c.z + Math.cos(c.yaw) * L * s, TYPES[c.type].w * .5 + .32); }
  for (const v of vehicles) { const L = v.off; for (const s of [-1, 1]) pushOut(v.x + Math.sin(v.yaw) * L * s, v.z + Math.cos(v.yaw) * L * s, v.rad + .3); }
  for (let k = 0; k < PED_N; k++) { const p = peds.people[k]; pushOut(p.x, p.z, .55); }
  player.x = x; player.z = z;
  // 游泳時根骨貼著水面，慢慢上下起伏
  player.y = player.swim ? damp(player.y, SEA_Y - SWIM_Y + Math.sin(uTimeNow() * 2.1) * .04, 6, dt) : damp(player.y, player.where === 'out' ? seaFloor(x, z) : groundH(x, z), 20, dt);
  // 動作混合
  const sp = player.v;
  let a = player.swim ? (sp > .25 ? ANIM.swim : ANIM.swimIdle) : sp > 3 ? ANIM.run : sp > .25 ? ANIM.walk : player.dance ? [ANIM.danceA, ANIM.danceB, ANIM.danceC, ANIM.punch][player.dance - 1] : ANIM.idle;
  if (aimM) a = sp > .25 ? ANIM.aimWalk : ANIM.aimIdle;
  if (a !== player.anim) { player.prevAnim = player.anim; player.anim = a; player.blend = 1; }
  player.blend = Math.max(0, player.blend - dt * 5);
  const back = aimM && mdx * Math.sin(player.yaw) + mdz * Math.cos(player.yaw) < -.3 ? -1 : 1;   // 瞄準時往後退：走路動畫倒著播
  const rate = a === ANIM.swim ? .6 + sp * .35 : a === ANIM.run ? sp / 4.6 * 1.45 : a === ANIM.walk || a === ANIM.aimWalk ? sp / 1.7 * .9 * back : 1;
  player.walkPh += dt * rate;
  me.anim(0, a, player.walkPh - uTimeNow(), 1, 0);
  me.anim2(0, player.prevAnim, player.blend, 1);
  me.place(0, player.x, player.y, player.z, player.yaw);
  me.flush();
  // 腳步聲
  if (player.swim) {   // 划水聲
    const ph = player.walkPh * 1.4;
    if (sp > .25 && Math.floor(ph) !== Math.floor(player.stepT)) sfx.splash(.25);
    player.stepT = ph;
  } else if (a === ANIM.walk || a === ANIM.run || a === ANIM.aimWalk) {
    const ph = player.walkPh * 2;
    if (Math.floor(ph) !== Math.floor(player.stepT)) sfx.step(a === ANIM.run, player.where !== 'out');
    player.stepT = ph;
  }
}
const uTimeNow = () => U.uTime.value;
