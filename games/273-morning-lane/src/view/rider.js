// 騎士＋腳踏車：Blender 的參考圖模型（blender/export.py 的 rider 組）。
// 靜態部分一份；腿與曲柄依踏板角度換 8 格（pedal0–7）；丟報時手臂換成 armsThrow（往左丟就整台鏡射）；
// 兩個輪子（wheelR／wheelF）依騎過的距離轉；轉向組件（fork：前叉＋龍頭＋把手＋握把）＋前輪繞頭管軸轉，
// 手臂用 morph target（steerNeg／steerPos＝打滿時的姿勢）跟著握把走。
// 原點在兩輪著地點中間，−z 朝前。
import * as THREE from 'three';

export function meshes(asset) {
  const g = new THREE.Group();
  for (const p of asset.parts) {
    const m = new THREE.Mesh(p.geometry, p.material);
    m.matrixAutoUpdate = false; m.matrix.copy(p.matrix);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

export function makeRider(A) {
  const root = new THREE.Group();
  const lean = new THREE.Group(); root.add(lean);
  const body = new THREE.Group(); lean.add(body);
  body.add(meshes(A.rider));
  const pedals = Array.from({ length: 8 }, (_, k) => { const g = meshes(A['pedal' + k]); g.visible = k === 0; body.add(g); return g; });
  const idle = meshes(A.armsIdle), thr = meshes(A.armsThrow); thr.visible = false;
  body.add(idle, thr);
  // 前叉：以頭管下端為原點匯出，繞頭管軸轉；前輪掛在前叉底下一起轉
  const steer = new THREE.Group(); steer.position.fromArray(A.fork.extras.pivot); body.add(steer);
  steer.add(meshes(A.fork));
  const axis = new THREE.Vector3().fromArray(A.fork.extras.axis).normalize();
  // 輪子：以輪軸為原點匯出，掛在輪軸位置
  const wheel = (k, parent, at) => { const w = meshes(A['wheel' + k]); const pv = new THREE.Group(); pv.position.fromArray(A['wheel' + k].extras.hub).sub(at); pv.add(w); parent.add(pv); return { pv, w }; };
  const wR = wheel('R', body, new THREE.Vector3()), wF = wheel('F', steer, steer.position);
  const morph = []; for (const g of [idle, thr]) g.traverse((o) => { if (o.morphTargetInfluences) morph.push(o); });
  root.userData = { lean, body, pedals, idle, thr, wR, wF, steer, axis, rad: A.fork.extras.rad, morph, sv: 0, throwT: 0, throwSide: 1, frame: 0 };
  return root;
}

export function poseRider(root, bike, dt) {
  const u = root.userData;
  root.position.set(bike.x, bike.y || 0, bike.z);
  root.rotation.y = -bike.yaw;
  // 在空中車頭微微上仰（上升時抬、下降時放平）
  u.lean.rotation.x = bike.air ? Math.max(-0.05, Math.min(0.22, bike.vy * 0.06)) : 0;
  u.lean.rotation.z = bike.lean;
  const f = ((Math.floor(bike.pedal / (Math.PI * 2) * 8) % 8) + 8) % 8;
  if (f !== u.frame) { u.pedals[u.frame].visible = false; u.pedals[f].visible = true; u.frame = f; }
  const spin = -bike.pedal * 0.75 / 0.336;            // pedal＝騎過的距離 / 0.75；輪半徑 0.336 m
  u.wR.w.rotation.x = spin; u.wF.w.rotation.x = spin;
  u.throwT = Math.max(0, u.throwT - dt);
  const throwing = u.throwT > 0, mirror = throwing && u.throwSide < 0;
  u.idle.visible = !throwing; u.thr.visible = throwing;
  u.body.scale.x = mirror ? -1 : 1;
  // 轉向：輸入是 −1／0／+1，畫面上平滑過去（約 0.1 s）；往左丟報時整台鏡射，鏡射後繞同一條軸的轉角要反過來
  u.sv += (bike.steer - u.sv) * (1 - Math.exp(-dt * 12));
  const s = mirror ? -u.sv : u.sv;
  u.steer.quaternion.setFromAxisAngle(u.axis, -s * u.rad);
  for (const m of u.morph) { m.morphTargetInfluences[0] = Math.max(0, -s); m.morphTargetInfluences[1] = Math.max(0, s); }
}

export function makePaperMesh(A) {
  const g = meshes(A.paper);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
