// 主角：戴斗笠的旅人（程式自建、骨架是巢狀 Group）＋程序動畫＋圍巾與衣襬布料。
// 模型面向本地 +Z；角色的左手在 +X。
import * as THREE from 'three';
import { PAL, inkMaterial, outlineMaterial, strawTexture, ragTexture, scarfTexture, slashTexture } from './ink.js';
import { Cloth } from './cloth.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = (t) => t * t * (3 - 2 * t);

const POSE_KEYS = ['hipY', 'hipRx', 'spRx', 'spRy', 'spRz', 'nkRx', 'shLx', 'shLz', 'elL', 'shRx', 'shRz', 'shRy', 'elR', 'thLx', 'thLz', 'knL', 'thRx', 'thRz', 'knR', 'ftL', 'ftR', 'hipZ', 'curlL', 'curlR', 'sprL', 'sprR', 'tbL', 'tbR', 'wrL', 'wrR', 'devR', 'twR'];
const zeroPose = () => Object.fromEntries(POSE_KEYS.map((k) => [k, 0]));

export function makeHero(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const body = new THREE.Group(); root.add(body);
  const meshes = [];
  const part = (parent, geo, mat, x = 0, y = 0, z = 0, outline = 0.012) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); meshes.push(m);
    if (outline) { const o = new THREE.Mesh(geo, outlineMaterial(outline)); o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.copy(m.scale); parent.add(o); m.userData.ol = o; }
    return m;
  };
  const joint = (parent, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };

  const robe = inkMaterial({ color: PAL.robe, wash: 0.9, grain: 1 });
  const pants = inkMaterial({ color: PAL.pants, wash: 0.7 });
  const wrap = inkMaterial({ color: PAL.wrap, wash: 0.6 });
  const skin = inkMaterial({ color: PAL.skin, wash: 0.3 });
  const sashM = inkMaterial({ color: PAL.sash, wash: 0.6 });
  const dark = inkMaterial({ color: 0x1c1c20, wash: 0.3 });
  const strawM = inkMaterial({ color: 0xffffff, map: strawTexture(), side: THREE.DoubleSide, wash: 0.4 });
  const gourdM = inkMaterial({ color: 0xc39553, wash: 0.6 });

  const hips = joint(body, 0, 0.95, 0);
  const spine = joint(hips, 0, 0.02, 0);
  // 軀幹：腰窄肩寬、前後扁
  const torsoProf = [[0.0, -0.02], [0.155, -0.02], [0.16, 0.12], [0.18, 0.3], [0.2, 0.42], [0.17, 0.5], [0.06, 0.53], [0.0, 0.53]].map(([r, y]) => new THREE.Vector2(r, y));
  const torso = part(spine, new THREE.LatheGeometry(torsoProf, 14), robe);
  torso.scale.set(1, 1, 0.72); torso.userData.ol.scale.copy(torso.scale);
  // 衣領（白色內襯的 V 領）
  const collar = part(spine, new THREE.BoxGeometry(0.16, 0.12, 0.02), inkMaterial({ color: 0xd9d1bd }), 0, 0.45, 0.125, 0);
  collar.rotation.x = -0.2;
  const sash = part(spine, new THREE.CylinderGeometry(0.168, 0.165, 0.1, 16), sashM, 0, 0.05, 0, 0.008);
  sash.scale.z = 0.76; sash.userData.ol.scale.z = 0.76;
  const knot = part(spine, new THREE.BoxGeometry(0.08, 0.07, 0.05), sashM, -0.07, 0.04, 0.13, 0.006);
  const tail1 = part(spine, new THREE.BoxGeometry(0.05, 0.2, 0.015), sashM, -0.09, -0.07, 0.135, 0); tail1.rotation.z = 0.2;
  void knot;
  // 頭、髮、斗笠
  const neck = joint(spine, 0, 0.5, 0.0);
  part(neck, new THREE.CylinderGeometry(0.045, 0.05, 0.08, 8), skin, 0, 0.03, 0, 0);
  const head = joint(neck, 0, 0.08, 0.0);
  part(head, new THREE.SphereGeometry(0.1, 16, 12), skin, 0, 0.08, 0.01);
  part(head, new THREE.SphereGeometry(0.104, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), dark, 0, 0.085, -0.008, 0.006).rotation.x = -0.5;
  const hatProf = [[0.0, 0.2], [0.05, 0.185], [0.16, 0.12], [0.3, 0.05], [0.42, 0.0], [0.44, -0.015]].map(([r, y]) => new THREE.Vector2(r, y));
  const hatGeo = new THREE.LatheGeometry(hatProf, 28);
  { const p = hatGeo.attributes.position, uv = hatGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 0.88 + 0.5, p.getZ(i) / 0.88 + 0.5); }
  const hat = part(head, hatGeo, strawM, 0, 0.13, 0, 0);
  const hatRim = new THREE.Mesh(new THREE.TorusGeometry(0.435, 0.012, 4, 36), new THREE.MeshBasicMaterial({ color: 0x3a2e20 }));
  hatRim.rotation.x = Math.PI / 2; hatRim.position.y = 0.12; head.add(hatRim);
  const strap = part(head, new THREE.TorusGeometry(0.1, 0.006, 4, 16, Math.PI), dark, 0, 0.1, 0.0, 0); strap.rotation.y = Math.PI / 2; strap.rotation.x = Math.PI;
  void hat;

  // 手臂：寬袖
  const arm = (side) => {
    const sh = joint(spine, 0.2 * side, 0.43, 0);
    part(sh, new THREE.SphereGeometry(0.07, 10, 8), robe, 0, 0, 0, 0.01);
    const up = part(sh, new THREE.CylinderGeometry(0.075, 0.11, 0.3, 10), robe, 0, -0.15, 0);
    void up;
    const el = joint(sh, 0, -0.28, 0);
    part(el, new THREE.CylinderGeometry(0.105, 0.075, 0.24, 10), robe, 0, -0.1, 0);
    part(el, new THREE.CylinderGeometry(0.035, 0.032, 0.08, 8), wrap, 0, -0.24, 0, 0.006);
    const hand = joint(el, 0, -0.29, 0);
    part(hand, new THREE.SphereGeometry(0.045, 10, 8), skin, 0, 0, 0, 0.006).scale.set(0.85, 1.15, 1);
    return { sh, el, hand };
  };
  const L = arm(1), Rr = arm(-1);
  // 腿：寬褲＋綁腿＋草鞋
  const leg = (side) => {
    const th = joint(hips, 0.1 * side, -0.02, 0);
    part(th, new THREE.CylinderGeometry(0.1, 0.115, 0.44, 10), pants, 0, -0.22, 0);
    const kn = joint(th, 0, -0.44, 0);
    part(kn, new THREE.CylinderGeometry(0.068, 0.056, 0.4, 10), wrap, 0, -0.2, 0, 0.008);
    for (const y of [-0.08, -0.2, -0.32]) part(kn, new THREE.TorusGeometry(0.064, 0.009, 4, 12), dark, 0, y, 0, 0).rotation.x = Math.PI / 2;
    const ft = joint(kn, 0, -0.43, 0);
    part(ft, new THREE.BoxGeometry(0.09, 0.06, 0.21), dark, 0, 0.0, 0.05, 0.006);
    part(ft, new THREE.BoxGeometry(0.1, 0.02, 0.24), inkMaterial({ color: PAL.straw }), 0, -0.035, 0.05, 0.004);
    return { th, kn, ft };
  };
  const LL = leg(1), RL = leg(-1);

  // 腰間：左刀（黑漆鞘＋銅鯉口／標＋纏繩柄）、右酒葫蘆（木塞＋朱繩穗）
  const brassM = inkMaterial({ color: 0x7b6640, wash: 0.4 });
  const cordM = inkMaterial({ color: 0xd9d1bd, wash: 0.4 });
  const swordSheath = new THREE.Group(); hips.add(swordSheath);
  swordSheath.position.set(0.19, 0.04, 0.02); swordSheath.rotation.set(-1.95, 0, -0.18);
  part(swordSheath, new THREE.CylinderGeometry(0.022, 0.017, 0.72, 10), dark, 0, -0.18, 0, 0.006);
  part(swordSheath, new THREE.CylinderGeometry(0.025, 0.024, 0.035, 10), brassM, 0, 0.165, 0, 0);
  part(swordSheath, new THREE.CylinderGeometry(0.024, 0.024, 0.028, 10), brassM, 0, 0.04, 0, 0);
  part(swordSheath, new THREE.CylinderGeometry(0.019, 0.014, 0.045, 10), brassM, 0, -0.525, 0, 0);
  const sheathHilt = new THREE.Group(); swordSheath.add(sheathHilt);
  part(sheathHilt, new THREE.CylinderGeometry(0.052, 0.052, 0.014, 14), brassM, 0, 0.19, 0, 0.004);
  part(sheathHilt, new THREE.CylinderGeometry(0.018, 0.019, 0.22, 10), cordM, 0, 0.31, 0, 0.005);
  for (let i = 0; i < 4; i++) part(sheathHilt, new THREE.TorusGeometry(0.019, 0.0035, 4, 10), dark, 0, 0.23 + i * 0.045, 0, 0).rotation.x = Math.PI / 2;
  part(sheathHilt, new THREE.CylinderGeometry(0.022, 0.02, 0.022, 10), brassM, 0, 0.425, 0, 0);
  // 劍柄柄首垂掛朱紅劍穗（隨步伐與出刀自然擺動）
  const swordTassel = new THREE.Group();
  swordTassel.position.set(0, 0.438, 0);
  sheathHilt.add(swordTassel);
  part(swordTassel, new THREE.SphereGeometry(0.016, 8, 6), sashM, 0, -0.02, 0, 0);
  part(swordTassel, new THREE.CylinderGeometry(0.005, 0.018, 0.14, 7), sashM, 0, -0.10, 0, 0.004);

  const gourd = new THREE.Group(); hips.add(gourd); gourd.position.set(-0.2, -0.02, 0.03);
  part(gourd, new THREE.SphereGeometry(0.072, 14, 12), gourdM, 0, -0.102, 0, 0.006);
  part(gourd, new THREE.SphereGeometry(0.049, 14, 12), gourdM, 0, -0.005, 0, 0.006);
  part(gourd, new THREE.TorusGeometry(0.034, 0.007, 6, 14), sashM, 0, -0.048, 0, 0).rotation.x = Math.PI / 2;
  part(gourd, new THREE.CylinderGeometry(0.013, 0.015, 0.032, 8), gourdM, 0, 0.046, 0, 0.004);
  part(gourd, new THREE.CylinderGeometry(0.011, 0.009, 0.022, 8), sashM, 0, 0.068, 0, 0);
  const gTassel = part(gourd, new THREE.CylinderGeometry(0.004, 0.012, 0.075, 6), sashM, -0.028, -0.085, 0.022, 0);
  gTassel.rotation.z = -0.22;
  // 腰間雕木行旅腰牌
  const tagG = new THREE.Group(); tagG.position.set(-0.04, 0.01, -0.04); gourd.add(tagG);
  part(tagG, new THREE.BoxGeometry(0.012, 0.085, 0.042), inkMaterial({ color: 0x4a3828, wash: 0.5 }), 0, -0.05, 0, 0.004);
  part(tagG, new THREE.BoxGeometry(0.015, 0.032, 0.018), sashM, 0, -0.048, 0, 0);

  // 背負行旅青竹書筒（斜背於右肩背側，與左側素麻長圍巾左右呼應）
  const scrollCase = new THREE.Group();
  scrollCase.position.set(-0.075, 0.28, -0.145);
  scrollCase.rotation.set(0.08, -0.12, -0.56);
  spine.add(scrollCase);
  const bambooTubeM = inkMaterial({ color: 0x4b533e, streak: 0.45, wash: 0.7 });
  part(scrollCase, new THREE.CylinderGeometry(0.042, 0.042, 0.46, 12), bambooTubeM, 0, 0, 0, 0.006);
  for (const y of [-0.22, -0.09, 0.09, 0.22]) {
    part(scrollCase, new THREE.CylinderGeometry(0.046, 0.046, 0.022, 12), Math.abs(y) > 0.15 ? brassM : dark, 0, y, 0, 0);
  }
  part(scrollCase, new THREE.CylinderGeometry(0.026, 0.026, 0.09, 10), cordM, 0, 0.255, 0, 0.004);
  part(scrollCase, new THREE.TorusGeometry(0.018, 0.004, 5, 10), sashM, 0, 0.25, 0, 0).rotation.x = Math.PI / 2;

  // 出手用的刀（平常藏著）＋半月水墨刀氣
  const blade = new THREE.Group(); Rr.hand.add(blade); blade.visible = false;
  part(blade, new THREE.CylinderGeometry(0.018, 0.019, 0.22, 10), cordM, 0, 0, 0, 0.005);
  part(blade, new THREE.CylinderGeometry(0.052, 0.052, 0.014, 14), brassM, 0, -0.12, 0, 0.004);
  part(blade, new THREE.BoxGeometry(0.016, 0.032, 0.038), brassM, 0, -0.142, 0.004, 0);
  const steel = part(blade, new THREE.BoxGeometry(0.011, 0.68, 0.036), new THREE.MeshBasicMaterial({ color: 0xedeae2 }), 0, -0.47, 0.005, 0.006);
  part(blade, new THREE.BoxGeometry(0.013, 0.56, 0.008), dark, 0, -0.42, -0.008, 0);
  void steel;
  blade.rotation.x = Math.PI / 2; // 刀尖朝前

  const slashMat = new THREE.MeshBasicMaterial({
    map: slashTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  const slashArc = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), slashMat);
  slashArc.rotation.x = -Math.PI / 2;
  slashArc.position.set(0, 1.16, 0.2);
  slashArc.visible = false;
  root.add(slashArc);

  // ---------- 布料 ----------
  root.updateMatrixWorld(true);
  const tmp = new THREE.Vector3();
  const local = (obj, x, y, z, out) => out.set(x, y, z).applyMatrix4(obj.matrixWorld);
  // 衣襬：腰（hips 下緣）往下 5 列，越下越寬
  const SC = 28, SR = 8;
  let bodyK = 1, spineK = 1; // 換上模型後的身體寬度、軀幹長度倍率
  const skirtR = (r) => (0.17 + r * 0.0126) * bodyK;
  const skirtMat = inkMaterial({ color: 0xffffff, map: ragTexture(), alphaTest: 0.5, side: THREE.DoubleSide, wash: 0.5, grain: 0.8 });
  const skirt = new Cloth({
    cols: SC, rows: SR, ring: true, material: skirtMat, damping: 0.97,
    rest: (c, r) => { const a = (c / SC) * Math.PI * 2; return local(hips, Math.sin(a) * skirtR(r), 0.02 - r * 0.066, Math.cos(a) * skirtR(r) * 0.8, new THREE.Vector3()); },
    anchor: (c, out) => { const a = (c / SC) * Math.PI * 2; local(hips, Math.sin(a) * 0.17 * bodyK, 0.03, Math.cos(a) * 0.17 * 0.8 * bodyK, out); },
  });
  skirt.maxRise = 0.0; // 衣襬不會翻到腰帶以上
  scene.add(skirt.mesh);
  const scarfMat = inkMaterial({ color: 0xffffff, map: scarfTexture(), alphaTest: 0.42, side: THREE.DoubleSide, wash: 0.5, grain: 0.65 });
  // 圍巾前段：從左肩垂到膝前（4 欄柔順布紋＋尾端破損流蘇）
  const scarfF = new Cloth({
    cols: 4, rows: 11, material: scarfMat, damping: 0.965,
    rest: (c, r) => { const u = c / 3; return local(spine, 0.13 - u * 0.12, 0.48 * spineK - r * 0.09, 0.16 + Math.sin(u * Math.PI) * 0.012, new THREE.Vector3()); },
    anchor: (c, out) => { const u = c / 3; local(spine, 0.14 - u * 0.1, 0.49 * spineK, 0.1 + u * 0.02 + Math.sin(u * Math.PI) * 0.01, out); },
  });
  // 圍巾後段：從後頸垂到背後、隨風飄
  const scarfB = new Cloth({
    cols: 4, rows: 13, material: scarfMat, damping: 0.97,
    rest: (c, r) => { const u = c / 3; return local(spine, 0.125 - u * 0.135, 0.5 * spineK - r * 0.092, -0.15 - Math.sin(u * Math.PI) * 0.014, new THREE.Vector3()); },
    anchor: (c, out) => { const u = c / 3; local(spine, 0.15 - u * 0.13, 0.5 * spineK, -0.1 - Math.sin(u * Math.PI) * 0.012, out); },
  });
  scene.add(scarfF.mesh, scarfB.mesh);
  const cloths = [skirt, scarfF, scarfB];
  // 碰撞球（每步更新）
  const S = (obj, x, y, z, r) => ({ obj, o: new THREE.Vector3(x, y, z), c: new THREE.Vector3(), r });
  const colliders = [
    S(hips, 0, 0.02, 0, 0.17), S(spine, 0, 0.25, 0.0, 0.19), S(spine, 0, 0.36, 0.02, 0.18),
    S(LL.th, 0, -0.18, 0, 0.13), S(RL.th, 0, -0.18, 0, 0.13), S(LL.kn, 0, 0.0, 0, 0.1), S(RL.kn, 0, 0.0, 0, 0.1), S(LL.kn, 0, -0.2, 0, 0.08), S(RL.kn, 0, -0.2, 0, 0.08),
  ];
  skirt.spheres = colliders.filter((s) => s.obj !== spine);
  // 圍巾要垂在衣襬「外面」：碰撞球比衣襬再大一圈；另加斗笠下緣與頭部，圍巾不會翻到斗笠上
  const scarfCol = [
    S(hips, 0, 0.0, 0, 0.22), S(hips, 0, -0.22, 0, 0.27), S(hips, 0, -0.42, 0, 0.3),
    S(LL.th, 0, -0.22, 0, 0.2), S(RL.th, 0, -0.22, 0, 0.2), S(LL.kn, 0, -0.05, 0, 0.15), S(RL.kn, 0, -0.05, 0, 0.15),
    S(spine, 0, 0.25, 0.0, 0.2), S(spine, 0, 0.38, 0.0, 0.19), S(head, 0, 0.08, 0, 0.16), S(head, 0, 0.16, 0, 0.3),
  ];
  colliders.push(...scarfCol);
  scarfF.spheres = scarfCol;
  scarfB.spheres = scarfCol;
  for (const c of [scarfF, scarfB]) { c.gScale = 1.5; c.upDrag = 0.86; c.maxRise = 0.12; }

  // ---------- 動畫 ----------
  const cur = zeroPose();
  let phase = 0, idleT = 0;
  const J = { hips, spine, neck, L, R: Rr, LL, RL };

  let hipBase = 0.95, rig = null;
  function apply(p) {
    hips.position.y = hipBase + p.hipY;
    hips.rotation.x = p.hipRx;
    spine.rotation.set(p.spRx, p.spRy, p.spRz);
    neck.rotation.x = p.nkRx;
    L.sh.rotation.set(p.shLx, 0, p.shLz); L.el.rotation.x = p.elL;
    Rr.sh.rotation.set(p.shRx, p.shRy, p.shRz); Rr.el.rotation.x = p.elR;
    LL.th.rotation.set(p.thLx, 0, p.thLz); LL.kn.rotation.x = p.knL; LL.ft.rotation.x = p.ftL;
    RL.th.rotation.set(p.thRx, 0, p.thRz); RL.kn.rotation.x = p.knR; RL.ft.rotation.x = p.ftR;
    hips.position.z = p.hipZ;
    if (rig) syncRig(p);
  }

  // 模型骨架的靜止旋轉都是單位旋轉，而且和隱藏的程序骨架同階層，所以關節旋轉可以直接抄。
  // 只有四肢不同：模型靜止時手腳張開，程序骨架是垂直的，要多轉一個校正 C。
  const qA = new THREE.Quaternion();
  function limb(top, mid, gTop, gMid, C, Ci) {
    top.quaternion.multiplyQuaternions(gTop.quaternion, C);
    mid.quaternion.multiplyQuaternions(Ci, qA.multiplyQuaternions(gMid.quaternion, C));
  }
  const qB = new THREE.Quaternion(), qC = new THREE.Quaternion(), qD = new THREE.Quaternion();
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3(), vD = new THREE.Vector3(), vE = new THREE.Vector3();
  const mA = new THREE.Matrix4(), mB = new THREE.Matrix4();

  /** 手指：curl 0＝攤開、1＝握緊；spr 1＝模型原本的張開、0＝併攏；tb 是拇指彎曲 */
  function setFingers(A, curl, spr, tb) {
    for (const f of A.fingers) {
      const [a, c2, d] = f.bones;
      if (f.thumb) {
        a.quaternion.setFromAxisAngle(f.axis, tb * 0.75); c2.quaternion.setFromAxisAngle(f.axis, tb * 0.95); d.quaternion.setFromAxisAngle(f.axis, tb * 0.8);
      } else {
        qB.setFromAxisAngle(f.normal, (1 - spr) * f.fan);
        a.quaternion.setFromAxisAngle(f.axis, curl * 1.3).premultiply(qB);
        c2.quaternion.setFromAxisAngle(f.axis, curl * 1.55); d.quaternion.setFromAxisAngle(f.axis, curl * 1.05);
      }
    }
  }

  /** 雙骨 IK：把手腕放到世界座標 tgt，手掌朝向由 D（手指方向）與 N（掌心方向）決定；w 與 FK 混合 */
  function armIK(A, tgt, D, N, w) {
    spine.updateWorldMatrix(true, false);
    mA.copy(spine.matrixWorld).invert();
    const T = vA.copy(tgt).applyMatrix4(mA);
    spine.getWorldQuaternion(qB).invert();
    const dl = vB.copy(D).applyQuaternion(qB), nl = vC.copy(N).applyQuaternion(qB);
    const d = vD.copy(T).sub(A.S), L0 = d.length(), L = clamp(L0, Math.abs(A.a - A.b) + 0.02, A.a + A.b - 0.002);
    d.divideScalar(L0 || 1);
    const cosA = clamp((A.a * A.a + L * L - A.b * A.b) / (2 * A.a * L), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    const perp = vE.copy(A.pole).addScaledVector(d, -A.pole.dot(d)).normalize();
    const up = new THREE.Vector3().copy(d).multiplyScalar(cosA).addScaledVector(perp, sinA);                 // 上臂方向
    const E = new THREE.Vector3().copy(A.S).addScaledVector(up, A.a);
    const hit = new THREE.Vector3().copy(A.S).addScaledVector(d, L);
    const lo = hit.sub(E).normalize();                                                                       // 前臂方向
    const qSh = new THREE.Quaternion().setFromUnitVectors(A.u0, up);
    const inv = qSh.clone().invert();
    const qEl = new THREE.Quaternion().setFromUnitVectors(A.l0, lo.clone().applyQuaternion(inv));
    // 手掌目標姿態
    const x1 = dl.clone().normalize(), z1 = new THREE.Vector3().crossVectors(x1, nl).normalize(), y1 = new THREE.Vector3().crossVectors(z1, x1);
    mB.makeBasis(x1, y1, z1).multiply(A.R0inv);
    const qT = new THREE.Quaternion().setFromRotationMatrix(mB);
    const qChain = qSh.clone().multiply(qEl);
    const qH = qChain.clone().invert().multiply(qT);
    // 前臂旋轉一半交給肘，手腕才不會扭成麻花
    const ax = A.l0, tw = new THREE.Quaternion(qH.x * 0, 0, 0, qH.w), pr = qH.x * ax.x + qH.y * ax.y + qH.z * ax.z;
    tw.set(ax.x * pr, ax.y * pr, ax.z * pr, qH.w).normalize();
    const half = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), tw, 0.5);
    qEl.multiply(half); qH.premultiply(half.clone().invert());
    A.sh.quaternion.slerp(qSh, w); A.el.quaternion.slerp(qEl, w); A.hand.quaternion.slerp(qH, w);
  }

  function syncRig(p) {
    const b = rig.bones;
    b.hips.position.y = rig.hipY + (hips.position.y - hipBase);
    b.hips.position.z = hips.position.z;
    b.hips.quaternion.copy(hips.quaternion);
    b.spine.quaternion.copy(spine.quaternion);
    b.neck.quaternion.copy(neck.quaternion);
    limb(b.shL, b.elL, L.sh, L.el, rig.cAL, rig.cAL_);
    limb(b.shR, b.elR, Rr.sh, Rr.el, rig.cAR, rig.cAR_);
    limb(b.thL, b.knL, LL.th, LL.kn, rig.cLL, rig.cLL_);
    limb(b.thR, b.knR, RL.th, RL.kn, rig.cLR, rig.cLR_);
    b.ftL.quaternion.multiplyQuaternions(rig.cLL_, LL.ft.quaternion);
    b.ftR.quaternion.multiplyQuaternions(rig.cLR_, RL.ft.quaternion);
    // 手腕：彎曲（往掌心為正）、右手出手時往小指側偏，刀才順著前臂
    const { L: AL, R: AR } = rig.arms;
    AL.hand.quaternion.setFromAxisAngle(AL.flex, p.wrL);
    AR.hand.quaternion.setFromAxisAngle(AR.flex, p.wrR).multiply(qC.setFromAxisAngle(AR.dev, p.devR));
    if (Math.abs(p.twR) > 0.001) AR.el.quaternion.multiply(qD.setFromAxisAngle(AR.l0, p.twR));
    setFingers(AL, p.curlL, p.sprL, p.tbL); setFingers(AR, p.curlR, p.sprR, p.tbR);
    if (ikW > 0.002) { armIK(AL, hands.L.pos, gripD, gripN, ikW); armIK(AR, hands.R.pos, gripD, gripN, ikW); }
  }

  // ---------- 抓握：手腕釘在岩緣上，橫移時雙手輪流換手，上攀時先伸一手，翻上時手留在原地 ----------
  const mkHand = () => ({ t: 0, ledge: null, step: -1, from: 0, to: 0, pos: new THREE.Vector3() });
  const hands = { L: mkHand(), R: mkHand() };
  const GRIP_W = 0.31; // 握距比斗笠略窄，手才露得出來
  const gripD = new THREE.Vector3(0, 0, 1), gripN = new THREE.Vector3(0, -1, 0);
  let ikW = 0, lead = 'L';
  const edgePt = (L, t, out) => out.copy(L.a).addScaledVector(L.dir, clamp(t, 0.04, L.len - 0.04)).addScaledVector(L.n, 0.05).setY(L.y + 0.035);
  const tmpP = new THREE.Vector3();
  function updateGrip(a, dt) {
    const g = a.grip;
    let want = 0;
    if (g && rig) {
      want = a.state === 'mantle' ? (a.prog < 0.62 ? 1 : 0) : 1;
      const L = g.L, yaw = root.rotation.y;
      const sg = Math.sign(L.dir.x * Math.cos(yaw) - L.dir.z * Math.sin(yaw)) || 1; // hero 的左手在 L.dir 的哪一側
      gripD.set(-L.n.x, -0.1, -L.n.z).normalize(); gripN.set(0, -1, -0.1 * 0).addScaledVector(gripD, 0.1).normalize();
      for (const side of ['L', 'R']) {
        const h = hands[side], other = hands[side === 'L' ? 'R' : 'L'], home = g.t + sg * (side === 'L' ? 1 : -1) * GRIP_W;
        if (h.ledge !== L) { h.ledge = L; h.t = home; h.step = -1; }
        let lift = 0;
        if (a.state === 'hang') {
          if (h.step >= 0) {
            h.step = Math.min(1, h.step + dt / 0.15);
            const e = ease(h.step); h.t = lerp(h.from, h.to, e); lift = Math.sin(Math.PI * h.step) * 0.05;
            if (h.step >= 1) h.step = -1;
          } else if (Math.abs(h.t - home) > 0.1 && other.step < 0) {
            h.step = 0; h.from = h.t; h.to = home + Math.sign(home - h.t) * 0.06;
          }
        }
        edgePt(L, h.t, h.pos); h.pos.y += lift;
        if (a.state === 'hop' && g.L2) {
          // 先伸的那隻手早 0.22 秒到
          const k = clamp((g.k - (side === lead ? 0 : 0.22)) / 0.78, 0, 1), e = ease(k);
          edgePt(g.L2, g.t2 + sg * (side === 'L' ? 1 : -1) * GRIP_W, tmpP);
          h.pos.lerp(tmpP, e); h.pos.y += Math.sin(Math.PI * e) * 0.09;
        }
      }
    }
    if (a.state !== 'hop' && a.state !== 'hang') { hands.L.ledge = hands.R.ledge = null; }
    if (a.state === 'hang') lead = a.shimmy > 0.1 ? 'R' : a.shimmy < -0.1 ? 'L' : lead;
    ikW += (want - ikW) * Math.min(1, dt * 22);
    if (want === 0 && ikW < 0.003) ikW = 0;
  }

  /** 換上有骨架的模型（tools/rig_hero.mjs 的產出）：隱藏程式自建的身體，刀、葫蘆與布料留著，骨架比例改成模型的 */
  function useModel(model, skinned) {
    const Jp = model.userData.rig.joints, RH = model.userData.rig.hands;
    const v = (a, c) => new THREE.Vector3(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
    const len = (a, c) => v(a, c).length();
    hipBase = Jp.hips[1]; hips.position.y = hipBase;
    spine.position.y = Jp.spine[1] - Jp.hips[1];
    spineK = (Jp.neck[1] - Jp.spine[1]) / 0.5; neck.position.y = Jp.neck[1] - Jp.spine[1];
    head.position.y = Jp.head[1] - Jp.neck[1];
    bodyK = 1.22;
    for (const [g, sh, el, hd] of [[L, Jp.shL, Jp.elL, Jp.handL], [Rr, Jp.shR, Jp.elR, Jp.handR]]) {
      g.sh.position.set(sh[0] - Jp.spine[0], sh[1] - Jp.spine[1], sh[2] - Jp.spine[2]);
      g.el.position.set(0, -len(el, sh), 0); g.hand.position.set(0, -len(hd, el), 0);
    }
    for (const [g, th, kn, ft] of [[LL, Jp.thL, Jp.knL, Jp.ftL], [RL, Jp.thR, Jp.knR, Jp.ftR]]) {
      g.th.position.set(th[0] - Jp.hips[0], th[1] - Jp.hips[1], th[2] - Jp.hips[2]);
      g.kn.position.set(0, -len(kn, th), 0); g.ft.position.set(0, -len(ft, kn), 0);
    }
    swordSheath.position.x *= 1.2; gourd.position.x *= 1.25; gourd.position.z += 0.05;
    scrollCase.position.set(-0.085 * bodyK, 0.28 * spineK, -0.155 * bodyK);
    for (const s of colliders) { if (s.obj === spine) { s.o.y *= spineK; } s.r *= s.obj === head ? 1 : bodyK; }
    for (const s of scarfCol) if (!colliders.includes(s)) { if (s.obj === spine) s.o.y *= spineK; if (s.obj !== head) s.r *= bodyK; }
    const keep = new Set(); for (const g of [swordSheath, gourd, blade, scrollCase]) g.traverse((o) => keep.add(o));
    body.traverse((o) => { if (o.isMesh && !keep.has(o)) o.visible = false; });
    const bones = {}; model.traverse((o) => { if (o.isBone) bones[o.name] = o; });
    const fix = (a, c, to) => new THREE.Quaternion().setFromUnitVectors(v(c, a).normalize(), new THREE.Vector3(...to).normalize());
    const cAL = fix(Jp.shL, Jp.handL, [0.1, -1, 0]), cAR = fix(Jp.shR, Jp.handR, [-0.1, -1, 0]);
    const cLL = fix(Jp.thL, Jp.ftL, [0, -1, 0]), cLR = fix(Jp.thR, Jp.ftR, [0, -1, 0]);
    const vec = (a) => new THREE.Vector3(...a);
    const armOf = (side) => {
      const H = RH[side], sign = side === 'L' ? 1 : -1;
      const S = vec(Jp['sh' + side]).sub(vec(Jp.spine)), E = vec(Jp['el' + side]), W = vec(Jp['hand' + side]), Sw = vec(Jp['sh' + side]);
      const e1 = vec(H.e1), e2 = vec(H.e2), e3 = vec(H.e3);
      const z0 = new THREE.Vector3().crossVectors(e1, e3).normalize(), y0 = new THREE.Vector3().crossVectors(z0, e1);
      return {
        sh: bones['sh' + side], el: bones['el' + side], hand: bones['hand' + side], S, a: E.distanceTo(Sw), b: W.distanceTo(E),
        u0: E.clone().sub(Sw).normalize(), l0: W.clone().sub(E).normalize(), pole: new THREE.Vector3(sign * 0.72, -0.55, -0.42).normalize(),
        e1, e2, e3, flex: new THREE.Vector3().crossVectors(e1, e3).normalize(), dev: new THREE.Vector3().crossVectors(e1, e2.clone().negate()).normalize(),
        R0inv: new THREE.Matrix4().makeBasis(e1, y0, z0).invert(),
        fingers: H.fingers.map((f) => ({ thumb: f.thumb, fan: f.fan, axis: vec(f.axis), normal: vec(f.normal), bones: f.names.map((n) => bones[n]) })),
      };
    };
    rig = { bones, hipY: bones.hips.position.y, cAL, cAR, cLL, cLR, cAL_: cAL.clone().invert(), cAR_: cAR.clone().invert(), cLL_: cLL.clone().invert(), cLR_: cLR.clone().invert(), arms: { L: armOf('L'), R: armOf('R') } };
    // 刀握在右手拳心：刀柄橫過手掌，刀身從拇指側伸出
    const AR0 = rig.arms.R;
    bones.handR.add(blade);
    blade.rotation.set(0, 0, 0);
    blade.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), AR0.e2.clone().addScaledVector(AR0.e1, 0.18).normalize());
    blade.position.copy(AR0.e1).multiplyScalar(0.08).addScaledVector(AR0.e3, 0.03);
    root.add(model);
    const ol = new THREE.SkinnedMesh(skinned.geometry, outlineMaterial(0.006)); ol.bind(skinned.skeleton, skinned.bindMatrix); ol.frustumCulled = false; skinned.parent.add(ol);
    skinned.frustumCulled = false; skinned.castShadow = true;
    apply(cur); root.updateMatrixWorld(true);
    for (const c of cloths) c.reset();
    syncCloth();
  }

  /**
   * a: { state, speed, vy, shimmy, prog, strike(0..1 或 -1), land(0..1), t, hangSwing }
   */
  function animate(a, dt) {
    const T = zeroPose();
    idleT += dt;
    // 手勢預設：站立時手指自然微彎、略併攏
    T.curlL = T.curlR = 0.42; T.sprL = T.sprR = 0.35; T.tbL = T.tbR = 0.35; T.wrL = T.wrR = 0.12;
    let rate = 14;
    if (a.state === 'ground') {
      const sp = a.speed;
      const run = clamp(sp / 5.4, 0, 1);
      phase += dt * (sp / 1.45) * Math.PI;
      const s = Math.sin(phase), c = Math.cos(phase);
      if (run > 0.05) {
        T.thLx = -0.8 * s * run; T.thRx = 0.8 * s * run;
        T.knL = (0.25 + 0.95 * Math.max(0, Math.sin(phase + 1.3))) * run; T.knR = (0.25 + 0.95 * Math.max(0, Math.sin(phase + 1.3 + Math.PI))) * run;
        T.ftL = -0.2 * s * run; T.ftR = 0.2 * s * run;
        T.shLx = 0.7 * s * run; T.shRx = -0.7 * s * run; T.elL = -0.6 * run; T.elR = -0.6 * run;
        T.shLz = 0.12; T.shRz = -0.12;
        T.hipY = -0.05 * run + 0.045 * Math.abs(c) * run;
        T.spRx = 0.2 * run; T.spRy = -0.12 * s * run; T.nkRx = -0.1 * run;
        rate = 18;
      }
      // 待機：呼吸、重心微移
      const b = Math.sin(idleT * 1.7) * (1 - run);
      T.spRx += 0.03 * b; T.shLz += 0.07 * (1 - run); T.shRz -= 0.07 * (1 - run); T.elL += -0.12 * (1 - run); T.elR += -0.12 * (1 - run);
      T.spRz += 0.02 * Math.sin(idleT * 0.6) * (1 - run); T.hipY += 0.008 * b;
      T.thLz = 0.04 * (1 - run); T.thRz = -0.04 * (1 - run);
      // 跑步半握拳
      T.curlL = T.curlR = lerp(0.42, 0.95, run); T.sprL = T.sprR = lerp(0.35, 0, run); T.tbL = T.tbR = lerp(0.35, 0.9, run); T.wrL = T.wrR = lerp(0.12, 0.1, run);
      // 推石：身體前傾、雙臂前伸、手掌貼石面
      if (a.push) {
        T.spRx = 0.42; T.nkRx = -0.3; T.shLx = T.shRx = -1.35; T.shLz = 0.05; T.shRz = -0.05; T.elL = T.elR = -0.75; T.hipY = -0.05;
        T.curlL = T.curlR = 0.1; T.sprL = T.sprR = 0.95; T.tbL = T.tbR = 0.15; T.wrL = T.wrR = -1.05;
        rate = 12;
      }
    } else if (a.state === 'air') {
      const up = clamp(a.vy / 7, -1, 1);
      if (up > 0) {
        T.thLx = -0.9; T.knL = 1.2; T.thRx = 0.25; T.knR = 0.7; T.shLx = 0.5; T.shRx = -0.9; T.elR = -0.5; T.shLz = 0.35; T.shRz = -0.25; T.spRx = 0.15;
      } else {
        const f = -up;
        T.thLx = lerp(-0.6, -0.3, f); T.knL = lerp(1.0, 0.5, f); T.thRx = lerp(0.1, 0.3, f); T.knR = lerp(0.6, 0.9, f);
        T.shLz = lerp(0.6, 1.3, f); T.shRz = -lerp(0.6, 1.3, f); T.shLx = -0.3; T.shRx = -0.3; T.elL = -0.4; T.elR = -0.4; T.spRx = 0.05;
      }
      // 空中五指張開、手腕後仰，準備搆岩縫
      T.curlL = T.curlR = 0.16; T.sprL = T.sprR = 1; T.tbL = T.tbR = 0.12; T.wrL = T.wrR = -0.25;
      rate = 10;
    } else if (a.state === 'hang' || a.state === 'hop') {
      const sw = Math.sin(idleT * 2.2) * 0.12 + (a.hangSwing || 0);
      const sh = a.shimmy || 0;
      const hp = Math.sin(idleT * 9) * Math.min(1, Math.abs(sh) * 0.8);
      T.shLx = -2.44 + hp * 0.15; T.shRx = -2.44 - hp * 0.15; T.shLz = -0.12 + (sh > 0 ? 0.22 : 0) + hp * 0.12; T.shRz = 0.12 - (sh < 0 ? 0.22 : 0) - hp * 0.12;
      T.elL = -0.08; T.elR = -0.08;
      T.spRx = 0.1; T.nkRx = -0.35;
      T.thLx = -0.15 + sw; T.thRx = 0.1 + sw; T.knL = 0.35; T.knR = 0.5;
      T.thLz = hp * 0.12 + 0.05; T.thRz = hp * 0.12 - 0.05;
      if (a.state === 'hop') { T.shLx = -2.9; T.shRx = -2.9; T.thLx = -0.7; T.knL = 1.1; T.thRx = 0.2; }
      // 身體貼近壁面、提高：手臂才搆得到岩面，手指勾住
      if (rig) { T.hipY = 0.06; T.hipZ = 0.15; T.nkRx = -0.62; }
      T.curlL = T.curlR = 0.3; T.sprL = T.sprR = 0.5; T.tbL = T.tbR = 0.55;
      if (a.state === 'hop') { T.curlL = T.curlR = 0.12; T.sprL = T.sprR = 1; }
      rate = 16;
    } else if (a.state === 'mantle') {
      const p = a.prog;
      if (p < 0.45) {
        const k = ease(p / 0.45);
        T.shLx = lerp(-2.5, -0.9, k); T.shRx = T.shLx; T.elL = lerp(-0.25, -1.9, k * (1 - k) * 4 * 0.6 + k * 0.4); T.elR = T.elL;
        T.spRx = lerp(0.1, 0.5, k); T.thLx = 0; T.knL = 0.4; T.thRx = 0.1; T.knR = 0.4;
      } else if (p < 0.8) {
        const k = ease((p - 0.45) / 0.35);
        T.shLx = lerp(-0.9, 0.3, k); T.shRx = T.shLx; T.elL = -0.6; T.elR = -0.6; T.spRx = lerp(0.5, 0.35, k);
        T.thLx = lerp(0, -1.6, k); T.knL = lerp(0.4, 2.0, k); T.thRx = lerp(0.1, 0.3, k); T.knR = lerp(0.4, 0.9, k); T.hipY = 0;
      } else {
        const k = ease((p - 0.8) / 0.2);
        T.thLx = lerp(-1.6, 0, k); T.knL = lerp(2.0, 0.1, k); T.thRx = lerp(0.3, 0, k); T.knR = lerp(0.9, 0.1, k); T.spRx = lerp(0.35, 0.05, k); T.shLz = 0.1; T.shRz = -0.1;
      }
      // 手掌撐在岩面上，手指張開
      if (rig) { T.hipY = 0.06 * Math.max(0, 1 - p / 0.5); T.hipZ = 0.15 * Math.max(0, 1 - p / 0.5); }
      T.curlL = T.curlR = 0.2; T.sprL = T.sprR = 0.8; T.tbL = T.tbR = 0.4; T.wrL = T.wrR = 0;
      rate = 22;
    }
    // 落地蹲
    if (a.land > 0) { const k = a.land; T.sprL = T.sprR = lerp(T.sprL, 0.8, k); T.curlL = T.curlR = lerp(T.curlL, 0.22, k); T.hipY -= 0.14 * k; T.knL += 0.5 * k; T.knR += 0.5 * k; T.thLx -= 0.3 * k; T.thRx -= 0.3 * k; T.spRx += 0.15 * k; }
    // 出手：右手拔刀橫斬
    if (a.strike >= 0) {
      const s = a.strike;
      if (s < 0.3) { const k = ease(s / 0.3); T.shRx = lerp(T.shRx, -1.3, k); T.shRz = lerp(T.shRz, 1.0, k); T.shRy = 0; T.elR = -1.2 * k; T.spRy = 0.45 * k; }
      else if (s < 0.62) { const k = ease((s - 0.3) / 0.32); T.shRx = -1.45; T.shRz = lerp(1.0, -1.35, k); T.shRy = 0; T.elR = lerp(-1.2, -0.1, k); T.spRy = lerp(0.45, -0.55, k); }
      else { const k = ease((s - 0.62) / 0.38); T.shRx = lerp(-1.45, T.shRx, k); T.shRz = lerp(-1.35, T.shRz, k); T.elR = lerp(-0.1, T.elR, k); T.spRy = lerp(-0.55, 0, k); }
      // 右手全握刀柄、手腕順著刀，左手收成拳
      T.curlR = 1; T.sprR = 0; T.tbR = 1; T.wrR = 0; T.devR = 0.7; T.twR = 0.75; T.curlL = 0.72; T.sprL = 0.1; T.tbL = 0.8;
      rate = 30;
    }
    updateGrip(a, dt);
    blade.visible = a.strike >= 0 && a.strike < 0.9;
    sheathHilt.visible = !blade.visible;
    const swayAmp = 0.12 + Math.min(0.45, (a.speed || 0) * 0.07);
    swordTassel.rotation.x = 1.65 + Math.sin(idleT * 5.2) * swayAmp;
    swordTassel.rotation.z = Math.cos(idleT * 3.9) * swayAmp * 0.7;
    gourd.rotation.z = Math.sin(idleT * 4.4 + 1.2) * swayAmp * 0.35;
    if (a.strike >= 0.25 && a.strike <= 0.74) {
      const u = (a.strike - 0.25) / 0.49;
      slashArc.visible = true;
      slashArc.rotation.z = lerp(0.9, -1.3, ease(Math.min(1, u * 1.25)));
      slashArc.rotation.y = -0.14;
      slashMat.opacity = Math.sin(Math.PI * u) * 0.85;
    } else slashArc.visible = false;
    const k = 1 - Math.exp(-rate * dt);
    for (const key of POSE_KEYS) cur[key] = lerp(cur[key], T[key], k);
    apply(cur);
  }

  let windT = 0;
  function stepCloth(dt, vel, feetY) {
    root.updateMatrixWorld(true);
    for (const s of colliders) s.c.copy(s.o).applyMatrix4(s.obj.matrixWorld);
    windT += dt;
    // 只給環境風；角色本身的速度由 Verlet 的慣性自然帶出，不再重複加
    const w = new THREE.Vector3(Math.sin(windT * 0.7) * 1.0, 0.1, -1.2 + Math.sin(windT * 1.3) * 0.8);
    void vel;
    for (const c of cloths) { c.wind.copy(w); c.floorY = feetY + 0.03; }
    for (let i = 0; i < 2; i++) for (const c of cloths) c.step(dt / 2);
  }
  function syncCloth() { for (const c of cloths) c.sync(); }
  function shiftCloth(dx, dy, dz) { for (const c of cloths) c.shift(dx, dy, dz); }
  function hideBody(v) { body.visible = v; }

  /** 測試用：手骨世界座標與目標的距離、布料最高點 */
  function debugHands() {
    if (!rig) return null;
    root.updateMatrixWorld(true);
    const p = (b) => b.getWorldPosition(new THREE.Vector3());
    return { ik: ikW, L: p(rig.arms.L.hand).distanceTo(hands.L.pos), R: p(rig.arms.R.hand).distanceTo(hands.R.pos), wristY: p(rig.arms.L.hand).y, wrist: p(rig.arms.L.hand).toArray().map((v) => +v.toFixed(3)), tips: rig.arms.L.fingers.map((f) => p(f.bones[2]).toArray().map((v) => +v.toFixed(3))), skirtTop: Math.max(...Array.from({ length: skirt.p.length / 3 }, (_, i) => skirt.p[i * 3 + 1])), hipsY: p(rig.bones.hips).y, feetY: root.position.y };
  }

  return { root, body, debugHands, joints: J, animate, stepCloth, syncCloth, shiftCloth, hideBody, useModel, cloths, hand: Rr.hand, tmp };
}
