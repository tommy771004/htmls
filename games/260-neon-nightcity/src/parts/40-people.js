
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
  const tpl = {}, geos = {}, bind = {};
  const P = V3(), N = V3(), M = new T.Matrix4(), A = new T.Matrix4(), NM = new T.Matrix3();
  for (const g of ['Male', 'Female']) {
    const grp = gltf.scene.getObjectByName(g);
    const meshes = [];
    grp.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
    const body = meshes.find(m => m.material.name.endsWith('_skin'));
    const sk = body.skeleton, bi = new Map(sk.bones.map((b, i) => [b.name, i])), jb = bi.get('pelvis');
    // 掃描人物（scanGet）換到同一個綁定空間用：身體的 bindMatrixInverse × 骨盆的綁定矩陣、骨名 → 編號
    bind[g] = { M: body.bindMatrixInverse.clone().multiply(sk.boneInverses[jb].clone().invert()), bi };
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
      // 上衣花樣用的座標（公尺）：離腳底的高度、左右、前後；綁定姿勢的高度軸取 y、z 中較長的一邊，以 1.75 m 身高換算
      const bb = new T.Box3().setFromArray(pos), ext = bb.getSize(V3()), up = ext.y >= ext.z ? 1 : 2, sc = 1.75 / Math.max(ext.y, ext.z);
      const pat = new Float32Array(pos.length);
      for (let i = 0; i < pos.length; i += 3) {
        pat[i] = (pos[i + up] - bb.min.getComponent(up)) * sc; pat[i + 1] = pos[i] * sc; pat[i + 2] = pos[i + 3 - up] * sc;
      }
      geo.setAttribute('aPat', new T.BufferAttribute(pat, 3));
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
  return { tpl, geos, clips, seat, bind };
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
attribute vec3 aPat;
uniform vec3 uC[9];
uniform vec4 uGlow, uPat;
varying vec3 vW, vN, vCol, vEmi, vP;
varying float vTop;
#ifdef SCAN
varying vec2 vUv;
#endif
void main(){
  #ifdef SCAN
  vUv = uv;
  #endif
  vec3 objectNormal = normal, transformed = position;
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
  int s = int(aSlot + .5);
  vec4 w = modelMatrix * vec4(transformed, 1.); vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * objectNormal);
  vCol = uC[s];
  vEmi = s == 5 ? uGlow.rgb * uGlow.w * .3 : vec3(0.);   // 鞋子的霓虹飾條
  vP = aPat; vTop = s == 1 || (s == 2 && uPat.w > .5) ? 1. : 0.;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const CHAR_FS = /* glsl */`
${GL_LIB}
uniform vec4 uPat;
uniform vec3 uPatC;
varying vec3 vW, vN, vCol, vEmi, vP;
varying float vTop;
#ifdef SCAN
uniform sampler2D uMap;
varying vec2 vUv;
#endif
void main(){
  if (vW.y < uClipY) discard;
  vec3 n = normalize(vN), v = normalize(uCam - vW), col = vCol;
  #ifdef SCAN
  col = texture2D(uMap, vUv).rgb;   // 掃描人物的底色貼圖（sRGB 貼圖由硬體解成線性）
  #endif
  // 上衣花樣（uPat.x）：1 橫條紋、2 格紋、3 胸前一道寬條、4 肩膀以上拼色（長袖連袖子）；y 是每公尺幾條、z 是濃淡
  if (vTop > .5 && uPat.x > .5) {
    float f = uPat.y, m;
    if (uPat.x < 1.5) m = step(.55, fract(vP.x * f));
    else if (uPat.x < 2.5) m = max(step(.8, fract(vP.x * f)), max(step(.8, fract(vP.y * f)), step(.8, fract(vP.z * f))));
    else if (uPat.x < 3.5) m = step(abs(vP.x - 1.27), .06);
    else m = step(1.36, vP.x);
    col = mix(col, uPatC, m * uPat.z);
  }
  vec3 c = shade(vW, n, v, col, .65, 0.);
  c += col * pow(1. - max(dot(n, v), 0.), 3.) * (uFogHi * (1.5 - uDay * 1.2) + .02);
  c += vEmi;
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;
// 每人一份材質（uniform 不同），共用同一個 program；不能用 clone()，會把共用的 U 也複製掉
const charMat = () => new T.ShaderMaterial({
  uniforms: { ...shared(ALLU), uC: { value: Array.from({ length: 9 }, () => new T.Color()) }, uGlow: { value: new T.Vector4() },
    uPat: { value: new T.Vector4() }, uPatC: { value: new T.Color() } },
  vertexShader: CHAR_VS, fragmentShader: CHAR_FS,
});
// 掃描人物的材質：和同一人的 charMat 共用 uniform 物件，另外帶底色貼圖
const scanMat = (cm, tex) => new T.ShaderMaterial({ uniforms: { ...cm.uniforms, uMap: { value: tex } }, defines: { SCAN: 1 }, vertexShader: CHAR_VS, fragmentShader: CHAR_FS });

// ─── 掃描人物（blender/scan_people.py：沒有骨架的 Sketchfab 人物綁到同一副 Quaternius 骨架）───
// assets/260/people/<id>.glb 只在 http(s) 下載，第一次有人要穿才下載；下載好之前（與以檔案開啟時）照舊是程式換色的身體，
// 下載好後把登記過的人重新 look 一次。幾何換到 PEOPLE 的綁定空間、骨頭編號照骨名對回模板骨架，所以動畫與 IK 都照用。
const SCAN_SEX = { jason: 'Male', lucia: 'Female' };
const SCAN = {}, scanWait = {};
function scanGet(id, p) {
  if (!GLB_ON || !PEOPLE || !SCAN_SEX[id]) return null;
  if (SCAN[id] && (SCAN[id].geo || SCAN[id].fail)) return SCAN[id].geo ? SCAN[id] : null;
  (scanWait[id] ||= new Set()).add(p);   // 下載中再有人要穿也登記，下載好一起重新 look
  if (SCAN[id]) return null;
  SCAN[id] = {};
  glbLoader.loadAsync(`../assets/260/people/${id}.glb`).then(gltf => {
    let m = null;
    gltf.scene.traverse(o => { if (o.isSkinnedMesh && !m) m = o; });
    const g = SCAN_SEX[id], B = PEOPLE.bind[g], ms = m.skeleton, jm = ms.bones.findIndex(b => b.name === 'pelvis');
    const M = B.M.clone().multiply(ms.boneInverses[jm]).multiply(m.bindMatrix), NM = new T.Matrix3().getNormalMatrix(M);
    const src = m.geometry, n = src.attributes.position.count, P = V3();
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    const remap = ms.bones.map(b => B.bi.get(b.name) ?? 0);
    for (let i = 0; i < n; i++) {
      P.fromBufferAttribute(src.attributes.position, i).applyMatrix4(M).toArray(pos, i * 3);
      P.fromBufferAttribute(src.attributes.normal, i).applyMatrix3(NM).normalize().toArray(nor, i * 3);
      for (let k = 0; k < 4; k++) { si[i * 4 + k] = remap[src.attributes.skinIndex.getComponent(i, k)]; sw[i * 4 + k] = src.attributes.skinWeight.getComponent(i, k); }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new T.BufferAttribute(nor, 3));
    geo.setAttribute('uv', src.attributes.uv);
    geo.setAttribute('skinIndex', new T.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new T.BufferAttribute(sw, 4));
    geo.setAttribute('aSlot', new T.BufferAttribute(new Float32Array(n), 1));
    geo.setAttribute('aPat', new T.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setIndex(src.index);
    SCAN[id] = { geo, tex: m.material.map, sex: g };
    for (const q of scanWait[id]) if (q.scanId === id && q.crowd) q.crowd.look(q.k, q.lastLook);
    scanWait[id].clear();
  }).catch(e => { console.warn('掃描人物載入失敗', id, e); SCAN[id] = { fail: true }; });
  return null;
}
const ANIM = { idle: 0, walk: 1, run: 2, danceA: 3, danceB: 4, danceC: 5, sit: 6, bartend: 7, umbrella: 8, dj: 9, cross: 10, talk: 11, ride: 12, punch: 14, smoke: 15,
  die: 16, getup: 17, jab: 18, interact: 19, crouch: 20, aimIdle: 21, aimWalk: 22, swing: 23, handsUp: 24, kneel: 25, throw: 26, aimRun: 27, driveBy: 28, swimIdle: 29, swim: 30, crouchWalk: 31, crouchAim: 32, crouchAimWalk: 33, danceD: 34, danceE: 35, danceF: 36 };
// 動作 → 動畫：rate 是每單位相位走幾秒動畫（行走的相位沿用舊版步頻），beat 是幾拍一輪（跳舞對拍），alt 依相位換另一段
const ACLIP = {
  [ANIM.idle]: { c: 'Idle_Loop' }, [ANIM.walk]: { c: 'Walk_Loop', rate: 1.3 }, [ANIM.run]: { c: 'Jog_Fwd_Loop', rate: .93 },
  [ANIM.danceA]: { c: 'Dance_Loop', beat: 2 }, [ANIM.danceB]: { c: 'Dance_Loop', beat: 2, off: .5 }, [ANIM.danceC]: { c: 'Dance_Loop', beat: 4 },
  // 動畫庫只有一段舞：另外三種舞步是在待機或同一段舞上覆寫上身（OVR），單雙號的人左右相反
  [ANIM.danceD]: { c: 'Idle_Loop' }, [ANIM.danceE]: { c: 'Dance_Loop', beat: 4, off: .25 }, [ANIM.danceF]: { c: 'Dance_Loop', beat: 2, off: .75 },
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
  // 蹲下（Z）：蹲著走、蹲著瞄準（手臂照持槍瞄準覆寫）
  [ANIM.crouchWalk]: { c: 'Crouch_Fwd_Loop' }, [ANIM.crouchAim]: { c: 'Crouch_Idle_Loop' }, [ANIM.crouchAimWalk]: { c: 'Crouch_Fwd_Loop' },
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
// 兩節骨 IK：把 side 這隻手的手腕送到 T（骨架空間），手肘往 pole 那一側彎；上臂、前臂長度取目前姿勢的骨距
const _ikS = V3(), _ikL = V3(), _ikH = V3(), _ikU = V3(), _ikN = V3(), _ikE = V3(), _ikT = V3();
function ikArm(p, side, T, pole, k) {
  const up = p.bones['upperarm_' + side], lo = p.bones['lowerarm_' + side];
  up.getWorldPosition(_ikS); lo.getWorldPosition(_ikL); p.bones['hand_' + side].getWorldPosition(_ikH);
  const a = _ikS.distanceTo(_ikL), b = _ikL.distanceTo(_ikH);
  _ikU.subVectors(T, _ikS);
  const d = clamp(_ikU.length(), Math.abs(a - b) + 1e-4, (a + b) * .999);
  _ikU.normalize();
  const ca = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
  _ikN.copy(pole).addScaledVector(_ikU, -pole.dot(_ikU)).normalize();
  _ikE.copy(_ikS).addScaledVector(_ikU, a * ca).addScaledVector(_ikN, a * sa);
  _ikT.copy(_ikS).addScaledVector(_ikU, d);
  aim(p, 'upperarm_' + side, _ikE.x - _ikS.x, _ikE.y - _ikS.y, _ikE.z - _ikS.z, k);
  aim(p, 'lowerarm_' + side, _ikT.x - _ikE.x, _ikT.y - _ikE.y, _ikT.z - _ikE.z, k);
}
// ─── 持槍姿勢：先依瞄準方向擺好槍，再用兩節骨 IK 把雙手送到這把槍的握把與護木，手掌轉向、手指彎起來握住 ───
// 座標是 arms.glb 擺正後的模型座標（公尺；槍口 +z、上方 +y、+x 是持槍者的左邊），照模型側面量的。
// k：long 槍托抵右肩、上身側轉；pistol 雙手前伸（只在瞄準時，平常照動畫單手拿）；hip 架在右腰；shoulder 扛在右肩
// r 右手掌心、l 左手掌心、b 抵肩（槍托底板）或靠肩（筒身）的點；lh 是左手的握法（HAND，右手一律握手槍式握把）
const GUN_HOLD = {
  pistol: { k: 'pistol', r: [0, -.012, -.055], l: [.035, -.03, -.045], lh: 'cup' },
  stun: { k: 'pistol', r: [0, -.015, -.05], l: [.035, -.035, -.04], lh: 'cup' },
  smg: { k: 'pistol', r: [0, .01, -.02], l: [.035, -.01, -.015], lh: 'cup' },
  rifle: { k: 'long', r: [0, -.03, -.175], l: [0, .075, .15], b: [0, .035, -.41], lh: 'guard' },
  shotgun: { k: 'long', r: [0, 0, -.235], l: [0, .045, .23], b: [0, -.005, -.49], lh: 'guard' },
  sniper: { k: 'long', r: [0, -.045, -.29], l: [0, .0, .12], b: [0, -.015, -.54], lh: 'guard' },
  rpg: { k: 'shoulder', r: [0, -.06, -.04], l: [0, -.065, .09], b: [0, .035, -.24], lh: 'gripL' },
  minigun: { k: 'hip', r: [0, .085, -.4], l: [0, .06, -.1], lh: 'bar' },
};
// 手掌的方向（槍的座標）：y 手腕到指根、n 掌心朝向（掌心貼著握的東西）、c 手指彎曲的程度、t 拇指指的方向、o 手腕離握點往手背退幾公尺
// 骨頭的局部軸（綁定姿勢量的）：y 沿著手指、z 是拇指那一側；右手掌心是 −x、左手掌心是 +x，手指繞局部 x 往掌心彎
const HAND = {
  grip: { y: [.35, -.55, .55], n: [.8, 0, .3], c: 1, t: [.75, -.25, .6] },        // 右手握手槍式握把：指根在握把前下方，掌心朝左前包住握把
  gripL: { y: [-.35, -.55, .55], n: [-.8, 0, .3], c: 1, t: [-.75, -.25, .6] },     // 左手握直立的前握把
  guard: { y: [-.75, .4, .35], n: [0, 1, 0], c: 1.05, o: .012, t: [.15, .15, 1] },        // 左手從下面托住護木，手指繞過右側
  cup: { y: [-.3, -.6, .6], n: [-.8, .4, 0], c: .85, o: .015, t: [-.2, .2, 1] },         // 左手包住右手
  bar: { y: [-.8, -.3, .4], n: [0, -1, 0], c: .9, t: [.2, -.7, -.5] },           // 左手從上面抓提把
};
const FINGER_CURL = [.9, 1.2, .8];
const _hgf = V3(), _hgu = V3(), _hgx = V3(), _hgo = V3(), _hgs = V3(), _hgT = V3(), _hgP = V3(), _hgY = V3(), _hgN = V3(), _hgv = V3(), _hgw = V3(), _hgM = new T.Matrix4(), _hgq = new T.Quaternion(), _hgq2 = new T.Quaternion();
const hgv = (o, a, s = 1) => o.set(0, 0, 0).addScaledVector(_hgx, a[0] * s).addScaledVector(_hgu, a[1] * s).addScaledVector(_hgf, a[2] * s);   // 槍的座標 → 角色空間的方向
// 骨頭繞角色空間的 y 軸轉 a（上身側轉、頭轉回來）
function twistY(p, name, a) {
  const b = p.bones[name];
  b.parent.getWorldQuaternion(_hgq); _hgq2.setFromAxisAngle(_v2.set(0, 1, 0), a);
  b.quaternion.premultiply(_hgq).premultiply(_hgq2).premultiply(_hgq.invert());
}
// 手掌轉到 Y（手腕到指根）、掌心朝 N（角色空間，N 已經和 Y 垂直），w 是混合比例；手指彎曲 curl
function orientHand(p, side, Y, N, curl, w) {
  const b = p.bones['hand_' + side];
  _hgv.copy(N).multiplyScalar(side === 'r' ? -1 : 1);   // 局部 x
  _hgw.crossVectors(_hgv, Y).normalize();
  _hgM.makeBasis(_hgv, Y, _hgw); _hgq2.setFromRotationMatrix(_hgM);
  b.parent.getWorldQuaternion(_hgq); _hgq.invert().multiply(_hgq2);
  b.quaternion.slerp(_hgq, w);
  for (const f of ['index', 'middle', 'ring', 'pinky']) for (let j = 1; j <= 3; j++) {
    const fb = p.bones[`${f}_0${j}_${side}`];
    if (fb) fb.quaternion.multiply(_hgq2.setFromAxisAngle(_v1.set(1, 0, 0), FINGER_CURL[j - 1] * curl * w));
  }
}
const HOLD_ANIM = new Set([ANIM.idle, ANIM.walk, ANIM.run, ANIM.crouch, ANIM.crouchWalk, ANIM.aimIdle, ANIM.aimWalk, ANIM.aimRun, ANIM.crouchAim, ANIM.crouchAimWalk, ANIM.talk]);
// 69-combat.js 的 holdAt 每幀把 p.hold 設成手上的槍；這裡算出槍在角色空間的矩陣 p.gunM（holdAt 下一次就照它擺）
function gunPose(p) {
  const G = GUN_HOLD[p.hold];
  if (!G || !p.sm) return false;
  const m2b = 1 / (p.m2b ||= V3().setFromMatrixScale(p.sm.matrix).x), k = p.aimK ?? 1, P = p.aimP ?? 0;
  if (G.k === 'pistol' && k < .05) return false;
  // 槍身方向：瞄準時沿瞄準俯仰；長槍沒瞄準時槍口朝前下、略往左（低姿戒備），重武器略朝下
  const pitch = G.k === 'pistol' ? P : lerp(G.k === 'long' ? -.62 : -.3, P, k), yaw = G.k === 'long' ? .38 * (1 - k) : 0;
  _hgf.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  _hgx.set(Math.cos(yaw), 0, -Math.sin(yaw)); _hgu.crossVectors(_hgf, _hgx).normalize();
  // 上身側轉（右肩往後、左肩往前），頭轉回來看前面
  const tw = G.k === 'long' ? -lerp(.3, .55, k) : G.k === 'pistol' ? -.12 * k : -.25;
  twistY(p, 'spine_02', tw * .4); twistY(p, 'spine_03', tw * .6); twistY(p, 'neck_01', -tw * .85);
  p.bones.upperarm_r.getWorldPosition(_hgs); p.bones.upperarm_l.getWorldPosition(_hgT);
  if (G.k === 'long') { _hgo.copy(_hgs).addScaledVector(_v1.set(.06, -.035, .05), m2b); hgv(_v2, G.b, m2b); _hgo.sub(_v2); }   // 槍托底板在右肩窩
  else if (G.k === 'shoulder') { _hgo.copy(_hgs).addScaledVector(_v1.set(.03, .11, 0), m2b); hgv(_v2, G.b, m2b); _hgo.sub(_v2); }   // 筒身扛在右肩上
  else if (G.k === 'hip') { _hgo.copy(_hgs).addScaledVector(_v1.set(.1, -.38, .14), m2b); hgv(_v2, G.r, m2b); _hgo.sub(_v2); }   // 後握把在右腰前
  else { _hgo.lerpVectors(_hgs, _hgT, .4).addScaledVector(_v1.set(0, -.05, 0), m2b).addScaledVector(_hgf, .46 * m2b); hgv(_v2, G.r, m2b); _hgo.sub(_v2); }   // 手槍：兩肩之間偏右、往前伸直
  const w = G.k === 'pistol' ? k : 1;
  // 手腕的位置：掌心中央往手腕退 7.5 cm、往手背退 o（預設 3 cm）；拇指另外擺
  for (const side of ['r', 'l']) {
    const H = HAND[side === 'r' ? 'grip' : G.lh];
    hgv(_hgY, H.y).normalize(); hgv(_hgN, H.n); _hgN.addScaledVector(_hgY, -_hgN.dot(_hgY)).normalize();
    hgv(_hgP, side === 'r' ? G.r : G.l, m2b).add(_hgo).addScaledVector(_hgY, -.075 * m2b).addScaledVector(_hgN, -(H.o ?? .03) * m2b);
    ikArm(p, side, _hgP, side === 'r' ? _v1.set(-1, -1.1, -.3) : _v1.set(.5, -1.2, 0), w);
    orientHand(p, side, _hgY, _hgN, H.c, w);
    hgv(_hgv, H.t); aim(p, 'thumb_02_' + side, _hgv.x, _hgv.y, _hgv.z, w); aim(p, 'thumb_03_' + side, _hgv.x, _hgv.y, _hgv.z, w);
    (p.ikErr ||= {})[side] = p.bones['hand_' + side].getWorldPosition(_v2).distanceTo(_hgP) / m2b;   // 手腕離目標幾公尺（測試 API 的 held().ik）
  }
  if (G.k === 'pistol' && k < .5) return true;   // 舉到一半：槍還跟著右手（holdAt 照手腕擺）
  _hgM.makeBasis(_hgx, _hgu, _hgf).scale(_v1.set(m2b, m2b, m2b)).setPosition(_hgo);
  (p.gunM ||= new T.Matrix4()).copy(_hgM); p.gunF = crowdFrame; p.gunId = p.hold;
  return true;
}
// 一隻手握到角色空間的點 C（掌心中央）：H 是 HAND 的握法，方向照目前的 _hgx／_hgu／_hgf 基底（gunPose 的右手也是這樣算）
function gripAt(p, side, C, H, pole, w, m2b) {
  hgv(_hgY, H.y).normalize(); hgv(_hgN, H.n); _hgN.addScaledVector(_hgY, -_hgN.dot(_hgY)).normalize();
  _hgP.copy(C).addScaledVector(_hgY, -.075 * m2b).addScaledVector(_hgN, -(H.o ?? .03) * m2b);
  ikArm(p, side, _hgP, pole, w);
  orientHand(p, side, _hgY, _hgN, H.c, w);
}
// 徒手（或拿近戰武器、投擲物）瞄準：兩拳舉到下巴前，右拳略後（格鬥架式），俯仰跟著瞄準
const FIST = { y: [0, .2, 1], n: [0, -1, 0], c: 1.25, o: .02, t: [0, .2, 1] };
function guardArms(p, k) {
  const m2b = 1 / (p.m2b ||= V3().setFromMatrixScale(p.sm.matrix).x), P = clamp(p.aimP ?? 0, -.5, .5);
  _hgf.set(0, Math.sin(P), Math.cos(P)); _hgx.set(1, 0, 0); _hgu.crossVectors(_hgf, _hgx).normalize();
  p.bones.upperarm_r.getWorldPosition(_hgs); p.bones.upperarm_l.getWorldPosition(_hgT);
  _hgo.lerpVectors(_hgs, _hgT, .5);
  gripAt(p, 'r', _v2.copy(_hgo).addScaledVector(_hgx, -.07 * m2b).addScaledVector(_hgu, .08 * m2b).addScaledVector(_hgf, .24 * m2b), FIST, _v1.set(-1, -1.2, -.2), k, m2b);
  gripAt(p, 'l', _v2.copy(_hgo).addScaledVector(_hgx, .09 * m2b).addScaledVector(_hgu, .1 * m2b).addScaledVector(_hgf, .33 * m2b), FIST, _v1.set(1, -1.2, -.2), k, m2b);
}
function aimArms(p) {
  const k = p.aimK ?? 1, P = p.aimP ?? 0, sy = Math.sin(P), cz = Math.cos(P);
  if (p.hold && crowdFrame - p.holdT <= 2 && GUN_HOLD[p.hold]) return;   // 持槍姿勢在 poseOne 最後做（gunPose）
  if (p.guard && p.sm) { guardArms(p, k); return; }   // 68-gta.js：玩家手上不是槍
  aim(p, 'upperarm_r', -.1, sy, cz, k); aim(p, 'lowerarm_r', -.02, sy, cz, k);
  aim(p, 'upperarm_l', -.42, sy - .32, .85, k); aim(p, 'lowerarm_l', -.8, sy * .6 + .05, .6, k);
}
// 車內射擊（p.dbDir 是角色空間的方向，69-combat.js 的 driveByPlace 每幀設定）：右手握槍從右肩沿瞄準方向伸出 0.5 m、略往上
// （從窗框上伸出去，槍由 holdAt 照手腕擺），左手 IK 握在方向盤上；機車兩手都在把手上，只伸右手
function driveByArm(p, bike) {
  if (!p.sm) return;
  const [x, y, z] = p.dbDir, m2b = 1 / (p.m2b ||= V3().setFromMatrixScale(p.sm.matrix).x);
  _hgf.set(x, y, z).normalize(); _hgx.set(_hgf.z, 0, -_hgf.x).normalize(); _hgu.crossVectors(_hgf, _hgx).normalize();
  p.bones.upperarm_r.getWorldPosition(_hgs); p.bones.upperarm_l.getWorldPosition(_hgT);
  gripAt(p, 'r', _hgo.copy(_hgs).addScaledVector(_hgf, .5 * m2b).addScaledVector(_v2.set(0, 1, 0), .08 * m2b), HAND.grip, _v1.set(-1, -1.1, -.3), 1, m2b);
  if (bike) return;
  _hgf.set(0, .4, 1).normalize(); _hgx.set(1, 0, 0); _hgu.crossVectors(_hgf, _hgx).normalize();
  gripAt(p, 'l', _hgo.copy(_hgT).addScaledVector(_v2.set(-.14, -.3, .36), m2b), HAND.gripL, _v1.set(.5, -1.2, 0), 1, m2b);
}
const sst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const frac = x => x - Math.floor(x);
// 動畫庫沒有的動作：t 是相位時間、b 是拍點
const OVR = {
  // 撐傘的手隨步伐晃一點；抱胸的人呼吸時手臂跟著起伏（每人相位不同）
  [ANIM.umbrella]: (p, t) => { const w = .05 * Math.sin(t * 8.4); aim(p, 'upperarm_r', -.25, -.85, .45 + w); aim(p, 'lowerarm_r', w * .6, .7, .7); },
  [ANIM.cross]: (p, t) => {
    const br = .04 * Math.sin(t * 1.6 + p.k);
    aim(p, 'upperarm_l', .2, -.9, .3 + br); aim(p, 'upperarm_r', -.2, -.9, .3 + br);
    aim(p, 'lowerarm_l', -1, .12 + br, .3); aim(p, 'lowerarm_r', 1, .02 + br, .38);
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
  // 雙手跟著龍頭：向左轉時左把往後、右把往前（30-vehicles.js 的前叉繞轉向軸轉 steer×0.6）
  [ANIM.ride]: p => {
    const v = player.veh, s = v && !v.isCar ? v.steer * .6 : 0;
    aim(p, 'spine_01', 0, .82, .55); aim(p, 'neck_01', s * .3, .9, .45);
    aim(p, 'upperarm_l', .3, -.3, .9 - .5 * s); aim(p, 'upperarm_r', -.3, -.3, .9 + .5 * s);
    aim(p, 'lowerarm_l', -.05, -.45, 1 - .6 * s); aim(p, 'lowerarm_r', .05, -.45, 1 + .6 * s);
    if (p.dbDir) driveByArm(p, true);
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
  [ANIM.crouchAim]: p => aimArms(p), [ANIM.crouchAimWalk]: p => aimArms(p),
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
  // 兩步擺：上身兩拍左右擺一次、每拍點頭，手肘彎著輪流往上頂
  [ANIM.danceD]: (p, t, b) => {
    const m = p.k & 1 ? -1 : 1, [A, B] = m > 0 ? ['l', 'r'] : ['r', 'l'];
    const s = Math.sin(b * Math.PI), h = Math.abs(Math.sin(b * Math.PI * 2));
    aim(p, 'spine_01', .14 * s * m, 1, .06); aim(p, 'spine_02', -.08 * s * m, 1, .08); aim(p, 'neck_01', 0, 1, .1 + .25 * h);
    aim(p, 'upperarm_' + A, m * .45, -.6, .35); aim(p, 'lowerarm_' + A, -m * .15, .15 + .7 * Math.max(0, s), .9);
    aim(p, 'upperarm_' + B, -m * .45, -.6, .35); aim(p, 'lowerarm_' + B, m * .15, .15 + .7 * Math.max(0, -s), .9);
  },
  // 雙手舉高，四拍左右揮一輪
  [ANIM.danceE]: (p, t, b) => {
    const w = Math.sin(b * Math.PI / 2) * (p.k & 1 ? -1 : 1);
    aim(p, 'upperarm_l', .3 + .12 * w, 1, .15); aim(p, 'upperarm_r', -.3 + .12 * w, 1, .15);
    aim(p, 'lowerarm_l', .05 + .45 * w, 1, .05); aim(p, 'lowerarm_r', -.05 + .45 * w, 1, .05);
  },
  // 一手叉腰，另一手前一拍指天、後一拍收回胸前
  [ANIM.danceF]: (p, t, b) => {
    const m = p.k & 1 ? -1 : 1, [A, B] = m > 0 ? ['l', 'r'] : ['r', 'l'];
    const u = frac(b / 2), up = sst(0, .12, u) * sst(.62, .5, u);
    aim(p, 'upperarm_' + B, -m * .35, -.2 + 1.1 * up, .7 - .4 * up); aim(p, 'lowerarm_' + B, -m * .15, .3 + .7 * up, .6 - .5 * up);
    aim(p, 'upperarm_' + A, m * .65, -.65, -.25); aim(p, 'lowerarm_' + A, -m * .55, -.35, .35);
  },
};
const DANCES = [ANIM.danceA, ANIM.danceB, ANIM.danceC, ANIM.punch, ANIM.danceD, ANIM.danceE, ANIM.danceF];
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
        p.cm = charMat();
        p.sm.material = p.cm;
        p.scanMats = {};
        p.sm.boundingSphere = new T.Sphere(V3(0, 1, 0), 1.3);
        // 骨頭矩陣只在擺過姿勢後重算（倒影與主畫面各 render 一次，遠處的人隔幀才擺）
        const sk = p.sm.skeleton;
        sk.update = () => { if (sk.dirty) { T.Skeleton.prototype.update.call(sk); sk.dirty = false; } };
        p.bones = {};
        p.rig.traverse(b => { if (b.isBone) p.bones[b.name] = b; });
        p.mixer = new T.AnimationMixer(p.rig);
        p.acts = new Map();
      }
      const u = p.cm.uniforms, C = u.uC.value;
      p.crowd = api; p.lastLook = o; p.scanId = o.scan || null;
      const sc = o.scan ? scanGet(o.scan, p) : null;
      const skin = o.skin || pick(SKINS), top = o.top || pick(TOPS), bot = o.bot || pick(BOTS), hair = o.hair || pick(HAIRS);
      const long = o.coat ?? (r() < .6 ? 1 : 0), bare = fem && (o.skirt ?? (r() < .3 ? 1 : 0));
      C[0].copy(skin); C[1].copy(top); C[2].copy(long ? top : skin); C[3].copy(bot); C[4].copy(bare ? skin : bot);
      C[5].copy(o.shoe || pick(SHOES)); C[6].copy(hair); C[7].copy(hair).multiplyScalar(.8); C[8].copy(EYES);
      // 花樣不從 r() 取亂數（不改動既有的亂數序列）：依編號與上衣顏色雜湊；指定上衣顏色的人（主角）預設素面
      const hv = frac(Math.sin((p.k + 1) * 12.9898 + top.r * 78.233 + top.b * 37.719) * 43758.5453);
      const pat = o.pat ?? (o.top || hv < .5 ? 0 : 1 + Math.floor(hv * 8) % 4);
      u.uPat.value.set(pat, [0, 11, 8, 1, 1][pat], .85, long);
      u.uPatC.value.copy(TOPS[(TOPS.indexOf(top) + 3 + Math.floor(hv * 40) % 5) % TOPS.length] || TOPS[0]);
      if (u.uPatC.value.equals(top)) u.uPatC.value.copy(top).multiplyScalar(.4);
      p.sm.geometry = PEOPLE.geos[sex][fem ? (o.longHair ? 0 : o.longHair === 0 ? 1 + Math.floor(r() * 2) : Math.floor(r() * 3)) : (o.hat ? 1 : Math.floor(r() * 3))];
      if (sc && sc.sex === sex) { p.sm.geometry = sc.geo; p.sm.material = p.scanMats[o.scan] ||= scanMat(p.cm, sc.tex); }
      else p.sm.material = p.cm;
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
  if (p.hold && crowdFrame - p.holdT <= 2 && HOLD_ANIM.has(id) && (!mix2 || w2 < .5)) gunPose(p);
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
// 掃描的 Lucia（女性、長髮）：重看一次外觀用自己的亂數（下載好之後 scanGet 會拿同一組參數再 look 一次）
const LUCIA = k => ({ r: rng(500 + k), scan: 'lucia', female: true, longHair: 1, glowI: 0 });
const xzW = (x, z, y) => { const [X, Z] = toW(x, z); return [X, y, Z]; };   // 邏輯 (x, z) → peds.place 的世界座標 x, y, z
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
    if (k % 19 === 7) peds.look(k, LUCIA(k));   // 幾個路人換成 Lucia 的掃描模型（http(s) 下載好才換；亂數另外抽，rP 的序列不變）
    peds.anim(k, um ? ANIM.umbrella : ANIM.walk, rP() * 10, pedState[k].v * .78);
    if (um) umbrellas.push(k);
  }
  // 夜店門口排隊的人與保鑣
  for (let q = 0; q < 6; q++) {
    const k = PED_N + q;
    peds.look(k, { r: rP, glowI: q % 2 ? 1.6 : 0 });
    if (q === 2) peds.look(k, LUCIA(k));
    const x = CLUB_X - 4.5 - q * 1.05, z = CLUB_Z + 1.5 + (q % 2) * .3;
    peds.anim(k, q % 3 === 0 ? ANIM.talk : q % 3 === 1 ? ANIM.idle : ANIM.smoke, rP() * 10, 1);
    peds.place(k, ...xzW(x, z, .15), yawW(zoneAtL(x, z), Math.PI / 2 + (rP() - .5) * .8));
    circles.push({ x, z, r: .3 });
  }
  peds.look(PED_N + 6, { top: lin(0x0c0c0e), bot: lin(0x0c0c0e), skin: SKINS[3], hair: HAIRS[0], coat: 1, skirt: 0, longHair: 0, hat: 0, glowI: 0, scale: 1.12 });
  peds.anim(PED_N + 6, ANIM.cross, 0, 1);
  peds.place(PED_N + 6, ...xzW(CLUB_X + 1.6, CLUB_Z + 1.1, .15), yawW(zoneAtL(CLUB_X, CLUB_Z), 0));
  circles.push({ x: CLUB_X + 1.6, z: CLUB_Z + 1.1, r: .35 });
  // 酒吧門口抽菸的人
  peds.look(PED_N + 7, { r: rP, coat: 1 });
  peds.anim(PED_N + 7, ANIM.smoke, 3, 1);
  peds.place(PED_N + 7, ...xzW(BAR_X - 3.2, BAR_Z + .45, .15), yawW(zoneAtL(BAR_X, BAR_Z), .2));
  circles.push({ x: BAR_X - 3.2, z: BAR_Z + .45, r: .3 });
  peds.mesh.count = PED_N + 8;
  scene.add(peds.mesh);
}
const BOUNCER = { x: CLUB_X + 1.6, z: CLUB_Z + 1.1 };   // 邏輯座標（60-venues.js 用到時換算）
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
// 繞街區的路線在邏輯座標算，回傳世界座標的位置與前進方向 [x, z, tx, tz]
const blkZone = b => b.zn ??= zoneAtL((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
const blkW = b => b.wc ??= toW((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, blkZone(b));
function pedPosL(ps) {
  const { b, inset, w, d } = ps;
  let s = ((ps.s % ps.per) + ps.per) % ps.per;
  const x0 = b.x0 + inset, z0 = b.z0 + inset;
  if (s < w) return [x0 + s, z0, 1, 0];
  s -= w; if (s < d) return [x0 + w, z0 + s, 0, 1];
  s -= d; if (s < w) return [x0 + w - s, z0 + d, -1, 0];
  s -= w; return [x0, z0 + d - s, 0, -1];
}
function pedPos(ps) {
  const [x, z, tx, tz] = pedPosL(ps), zn = blkZone(ps.b), [X, Z] = toW(x, z, zn), [TX, TZ] = dirW(zn, tx, tz);
  return [X, Z, TX, TZ];
}
// 行人繞著一個街區走；那個街區離玩家超過 230 m 就換到玩家附近 70–180 m 的街區（城市放大後人不會散到看不到的地方）
const pedBlocks = blocks.filter(b => !b.outer && !b.park);
function pedRelocate(ps, px, pz) {
  for (let n = 0; n < 30; n++) {
    const b = pedBlocks[Math.floor(rP() * pedBlocks.length)], [bx, bz] = blkW(b), d = Math.hypot(bx - px, bz - pz);
    if (d < 70 || d > 180) continue;
    ps.b = b; ps.w = b.x1 - b.x0 - ps.inset * 2; ps.d = b.z1 - b.z0 - ps.inset * 2; ps.per = 2 * (ps.w + ps.d); ps.s = rP() * ps.per; ps.dx = ps.dz = 0;
    return;
  }
}
// 下雨天路人變少：雨越大，越多人躲進室內（沒帶傘的先走）。只在離玩家 55 m 外消失、出現，放到遠處就不會被撞、被瞄準或當目擊者
pedState.forEach((ps, k) => { const h = (k * .6180339887 + .31) % 1; ps.shy = ps.um0 ? h * .6 : .4 + h * .6; });
const PED_AWAY = 2e4;
const PED_DIVE_V = 7, PED_DIVE_T = .9, PED_DIVE_W = .9, PED_DIVE_A = 7;   // 撲開：車速 7 m/s 以上、0.9 秒車程內、車寬外 0.9 m；在框裡每秒往外橫移 7 m（最多 2.6 m）
function updatePeds(dt) {
  let u = 0;
  const ppx = pX(), ppz = pZ(), share = (1 - .5 * clamp((wx.rain - .1) / .8, 0, 1)) * pedTurfShare() * SET.ped;   // SET.ped：Esc 選單的人口密集程度   // 69-turf.js：赤蠍幫的地盤路人少
  pedState.forEach((ps, k) => {
    if (ps.out) { if (ps.shy >= share) return; ps.out = 0; pedRelocate(ps, ppx, ppz); }
    else if (ps.shy >= share && !ps.fsm && !(ps.down > 0) && !(ps.panic > 0)) {
      const p = peds.people[k];
      if ((p.x - ppx) ** 2 + (p.z - ppz) ** 2 > 55 * 55) { ps.out = 1; peds.place(k, PED_AWAY, -50, PED_AWAY, 0); return; }
    }
    if (!ps.fsm && !(ps.down > 0) && !(ps.panic > 0) && (blkW(ps.b)[0] - ppx) ** 2 + (blkW(ps.b)[1] - ppz) ** 2 > 230 * 230) pedRelocate(ps, ppx, ppz);
    // 68-gta.js：中彈或被撞倒地（down 秒數倒數完換個地方重新出現），聽到槍聲爆炸就跑（panic）
    // 69-combat.js：被槍指著投降、抱頭蹲下、脾氣差的人反擊（pedFsm 接手這一幀就 return）
    if (ps.fsm && !(ps.down > 0) && pedFsm(k, ps, dt)) return;
    if (ps.down > 0) {
      ps.down -= dt;
      peds.place(k, ps.dpos[0], ps.fly ? ps.fly.y : groundH(ps.dpos[0], ps.dpos[1]) > 0 ? .15 : 0, ps.dpos[1], ps.dpos[2]);   // fly：68-wreck.js 被車撞飛
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
    // 撲開：玩家的車開得快時，車頭前方 PED_DIVE_T 秒車程、車寬兩側各多 PED_DIVE_W 的長方形裡的人往車身外側撲（從車的中線往外）
    if (player.mode === 'drive' && dd < 40) {
      const v = player.veh, sp = Math.hypot(v.vx, v.vz);
      if (sp > PED_DIVE_V && !v.boat && !v.fly) {
        const fx = v.vx / sp, fz = v.vz / sp, ahead = dx * fx + dz * fz, side = dx * fz - dz * fx, half = (v.w || 1.9) / 2 + PED_DIVE_W;
        if (ahead > -1 && ahead < sp * PED_DIVE_T + (v.len || 4.4) / 2 && Math.abs(side) < half) {
          // side > 0 是車的左邊（左邊的單位向量 (fz, -fx)），往同一邊撲；撲出去之後就不換邊
          const s = ps.dive > 0 ? ps.diveS : side > .05 ? 1 : side < -.05 ? -1 : (k & 1 ? 1 : -1);
          ps.diveS = s;
          ps.dx += fz * s * PED_DIVE_A * dt; ps.dz -= fx * s * PED_DIVE_A * dt; ps.dodge = 1.4; ps.dive = .8;
          if (!(ps.panic > 0)) { ps.panic = 3; peds.anim(k, ANIM.run, rP() * 10, 1.4); }
        }
      }
    }
    ps.dx = damp(ps.dx, 0, ps.dodge > 0 ? .3 : 1.2, dt); ps.dz = damp(ps.dz, 0, ps.dodge > 0 ? .3 : 1.2, dt);
    const lim = ps.dive > 0 ? 2.6 : 1.4; ps.dx = clamp(ps.dx, -lim, lim); ps.dz = clamp(ps.dz, -lim, lim);
    if (ps.dive > 0) ps.dive -= dt;
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
const player = { mode: 'walk', ...WP(avX(1) - 9.6, stZ(2) + 18), y: .15, yaw: yawW(zoneAtL(avX(1), stZ(2)), 0), v: 0, vx: 0, vz: 0, veh: null, walkPh: 0, dance: 0, anim: ANIM.idle, blend: 0, prevAnim: ANIM.idle, where: 'out', stepT: 0 };
const SWIM_Y = .06;   // UAL 的游泳動畫以根骨當水面（踩水骨盆在 -0.33 m、自由式在 -0.08 m）
function updatePlayerWalk(inp, dt, camYaw) {
  if (player.ride && player.ride.metro) { metroRide(inp, dt); return; }   // 69-v9-metro.js：搭地鐵（站在車門旁跟著車走）
  if (player.ride && player.ride.tron) { tronRide(inp, dt, camYaw); return; }   // 21-tron.js：騎光格島的光速機車、坐長椅
  if (player.ride) { aptRide(dt); return; }   // 69-safehouse.js：走樓梯、搭電梯（照路徑走，不受碰撞）
  if (player.air3) { airStep(inp, dt, camYaw); return; }   // 69-v3-crash.js：被拋出車外、自由落體、開傘
  if (vaultStep(dt)) return;                               // 69-v3-crash.js：翻越矮牆與停著的車
  if (V5.lad) { ladStep(inp, dt); return; }               // 69-v5-civic.js：爬外牆鐵梯、翻鐵絲網
  let mx = inp.mx, mz = inp.mz;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  if (ml > .05) { player.dance = 0; player.vig = 0; }   // vig：69-v9-switch.js 切換角色的小劇場動作
  // 相機的前方 = (sin yaw, cos yaw)；右方 = (-cos, sin)
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -fz, rz = fx;
  const wx = fx * mz + rx * mx, wz = fz * mz + rz * mx;
  const aimM = gta.aiming || gta.guard, run = inp.run && ml > .1 && !aimM;
  // 水深超過 1.25 m 改游泳（離開時 1.05 m，避免在邊界來回切換）；涉水時走慢一點
  const depth = player.where === 'out' ? waterDepth(player.x, player.z) : 0, wasSwim = player.swim;
  player.swim = depth > (player.swim ? 1.05 : 1.25);
  if (player.swim !== wasSwim && depth > 0) { sfx.splash(player.swim ? 1 : .5); if (player.swim) { player.dance = 0; arm.trig = false; waterSplash(player.x, player.z, .8); } }
  const wade = player.swim ? 1 : clamp(1 - depth * .5, .45, 1);
  // 蹲下（69-combat.js 的 Z 鍵）：跑起來或水深過膝就站起來；crouchK 給相機降低高度
  if (player.crouch && (run || depth > .4)) player.crouch = false;
  player.crouchK = damp(player.crouchK || 0, player.crouch ? 1 : 0, 10, dt);
  // runK：69-v3-skills.js 的衝刺體力（喘的時候變慢）；skK.crouch：潛行等級讓蹲行快一點
  const rk = player.runK ?? 1, ck = skK.crouch;
  const target = ml > .05 ? (player.swim ? (run ? 2.3 * rk : 1.3) * (player.dive ? 1.15 : 1) : (run ? 4.6 * rk : player.crouch ? (aimM ? 1.1 : 1.3) * ck : aimM ? 1.5 : 1.7) * wade) * Math.min(1, ml) : 0;
  player.v = damp(player.v, target * (player.loadK ?? 1), target > player.v ? 6 : 10, dt);   // loadK：69-v7-casino.js 袋子裡金條太重
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
  colY = player.y;   // 快速道路橋面上的護欄只擋橋上的人、橋下的柱子只擋地面的人（30-vehicles.js）
  let r = skyWalk() ? { x: nx, z: nz } : collideCircle(nx, nz, .32, false, true);   // 塔吊的吊臂上（69-v5-tower.js）只看步行面
  colY = 0;
  let x = r.x, z = r.z;
  if (depth > 0) { [x, z] = farClamp(x, z); if (!tronNear(x, z)) z = Math.min(z, ISLE.z1 + 320); }   // 游不到對岸（21-coast.js 的 farClamp）；光格島附近（21-tron.js）可以游到碼頭的梯子
  // 車流、載具與路人（69-kinema.js：停著的車推得動一點、被車夾在牆上、和路人互相讓開、衝刺撞人）
  if (!skyWalk()) [x, z] = kinWalk(x, z);
  if (player.where === 'out') [x, z] = walkStep(player.x, player.z, x, z, player.y);   // 北嶺鐵道橋的護欄、洞壁、橋墩（20-walk.js）
  player.x = x; player.z = z;
  // 游泳時根骨貼著水面，慢慢上下起伏
  // 從梯子前的缺口上岸（31-boats.js、10-city.js 的 LADDERS）：一下子高 1.6 m，慢一點爬上去
  const fy = player.where === 'out' ? walkY(x, z, player.y, deckAt(x, z, player.y) ?? seaFloor(x, z)) : VENUES[player.where].lvs ? VENUES[player.where].lvY : groundH(x, z);   // 分層的安全屋：所在那一層的地板；戶外是步行面（20-walk.js）、快速道路橋面或地面
  player.y = player.swim ? damp(player.y, SEA_Y - SWIM_Y + Math.sin(uTimeNow() * 2.1) * .04 - (player.diveK || 0) * DIVE_D, 6, dt) : damp(player.y, fy, fy - player.y > .8 ? 4 : 20, dt);
  // 動作混合
  const sp = player.v;
  let a = player.swim ? (sp > .25 ? ANIM.swim : ANIM.swimIdle) : sp > 3 ? ANIM.run : sp > .25 ? ANIM.walk : player.vig || (player.dance ? DANCES[player.dance - 1] : ANIM.idle);
  if (aimM) a = sp > .25 ? ANIM.aimWalk : ANIM.aimIdle;
  if (player.crouch) a = aimM ? (sp > .25 ? ANIM.crouchAimWalk : ANIM.crouchAim) : sp > .25 ? ANIM.crouchWalk : ANIM.crouch;
  if (a !== player.anim) { player.prevAnim = player.anim; player.anim = a; player.blend = 1; }
  player.blend = Math.max(0, player.blend - dt * 5);
  const back = aimM && mdx * Math.sin(player.yaw) + mdz * Math.cos(player.yaw) < -.3 ? -1 : 1;   // 瞄準時往後退：走路動畫倒著播
  const rate = a === ANIM.swim ? .6 + sp * .35 : a === ANIM.run ? sp / 4.6 * 1.45 : a === ANIM.walk || a === ANIM.aimWalk ? sp / 1.7 * .9 * back : a === ANIM.crouchWalk || a === ANIM.crouchAimWalk ? sp * .75 * back : 1;
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
