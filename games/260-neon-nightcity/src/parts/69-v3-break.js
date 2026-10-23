// ═══ 第三部曲之六：撞得斷的路燈與消防栓 ═══
// 車子以時速 22 km/h 以上撞上去：那根東西的碰撞圓移走（之後不再擋車）、車只減速一成、模型換成往前倒下的一份。
// 路燈：路燈表（00-core.js 的 uLampT）裡那一盞熄掉；下雨或地上有水時斷口漏電 10 秒，2.5 m 內的人觸電倒地（玩家每秒扣血）。
// 消防栓：原地噴 12 秒水柱，1.3 m 內的人被沖倒。
// 機車撞不斷（人會摔出去）；號誌桿與護柱不斷（號誌連著車流的燈號，護柱是擋車用的）。路燈的實體模型（27-props.js 的 w1_grc）若在撞斷之後才下載好，那一盞會重新出現（只有外觀，碰撞與燈光仍是斷的）。
// 排在 69-v3-chem 之前：頂層只用 69 以前的東西。

const BRK_V = 6;   // 撞斷的最低車速（m/s）
const brk = { reg: null, fallen: [], geysers: [], wires: [], n: 0 };
const _brM = new T.Matrix4(), _brM2 = new T.Matrix4(), _brQ = new T.Quaternion(), _brAx = V3();
// 第一次用到才建表：碰撞圓 → 那根設施（世界座標的底座、燈頭）
function brkInit() {
  const reg = new Map(), add = (x, z, kind, hx, hz) => {
    for (const c of [...circlesNear(x, z, .3)]) if (!reg.has(c) && Math.abs(c.r - (kind === 'lamp' ? .22 : .25)) < .01 && Math.hypot(c.x - x, c.z - z) < .05) { reg.set(c, { kind, x, z, hx, hz }); return; }
  };
  for (const l of lampsA) { const [x, z] = toW(l.x, l.z, l.zn), [hx, hz] = toW(l.hx, l.z, l.zn); add(x, z, 'lamp', hx, hz); }
  for (const l of lampsS) { const [x, z] = toW(l.x, l.z, l.zn), [hx, hz] = toW(l.x, l.hz, l.zn); add(x, z, 'lamp', hx, hz); }
  for (const l of lampsC) add(l.x, l.z, 'lamp', l.hx, l.hz);
  for (const h of hydrants) { const [x, z] = toW(h.x, h.z, h.zn); add(x, z, 'hydrant', x, z); }
  brk.reg = reg;
}
// 藏起所有在 (x, z) 的 instance（程式建模、實體模型、光錐、燈罩都一樣處理），回傳在底座的那幾個（拿來做倒下的模型）
function brkHide(x, z, hx, hz) {
  const out = [], zero = _brM2.makeScale(0, 0, 0), near = (a, b) => (a - x) ** 2 + (b - z) ** 2 < .12 || (a - hx) ** 2 + (b - hz) ** 2 < .12;
  for (const S of instStreams) for (let k = 0; k < S.n; k++) {
    if (!near(S.xs[k], S.zs[k])) continue;
    _brM.fromArray(S.mtx, k * 16);
    if ((S.xs[k] - x) ** 2 + (S.zs[k] - z) ** 2 < .12 && _brM.determinant() !== 0 && !(S.m.material.blending === T.AdditiveBlending)) out.push({ m: S.m, mtx: _brM.clone() });
    instSet(S.m, k, zero);
  }
  scene.traverse(o => {
    if (!o.isInstancedMesh || o.userData.stream || o.count > 4000) return;
    for (let k = 0; k < o.count; k++) {
      o.getMatrixAt(k, _brM); const ex = _brM.elements[12], ez = _brM.elements[14];
      if (!near(ex, ez)) continue;
      if ((ex - x) ** 2 + (ez - z) ** 2 < .12 && _brM.determinant() !== 0 && o.material.blending !== T.AdditiveBlending) out.push({ m: o, mtx: _brM.clone() });
      o.setMatrixAt(k, zero); o.instanceMatrix.needsUpdate = true;
    }
  });
  return out;
}
// 路燈表裡這一盞移到很遠（shader 的迴圈碰到 w < 0.5 就停，所以不能把 w 歸零）
function brkLampOff(hx, hz) {
  const tex = U.uLampT.value; if (!tex) return;
  const d = tex.image.data;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > .5 && Math.abs(d[i] - hx) < .05 && Math.abs(d[i + 1] - hz) < .05) { d[i] = d[i + 1] = 1e6; }
  tex.needsUpdate = true;
}
function brkBreak(c, v) {
  const B = brk.reg.get(c); brk.reg.delete(c);
  c.x0 = c.x; c.x = 1e7;   // 不用重建碰撞索引：圓留在原本的格子裡，但位置搬走就碰不到了
  const parts = brkHide(B.x, B.z, B.hx, B.hz);
  const sp = Math.hypot(v.vx, v.vz), dx = v.vx / sp, dz = v.vz / sp;
  v.vx *= .9; v.vz *= .9; damageVeh(v, B.kind === 'lamp' ? 25 : 12, v === player.veh);
  sparks(B.x, .6, B.z, 12, 4); sfx.impact(B.kind === 'lamp' ? 9 : 5);
  if (v === player.veh) camState.shake = Math.max(camState.shake, .35);
  // 倒下的模型：繞底座、沿著車開的方向倒
  _brAx.set(dz, 0, -dx);
  for (const p of parts) {
    const m = new T.InstancedMesh(p.m.geometry, p.m.material, 1); m.frustumCulled = false; m.layers.mask = p.m.layers.mask;
    m.setMatrixAt(0, p.mtx); scene.add(m);
    brk.fallen.push({ m, mtx: p.mtx, x: B.x, z: B.z, ax: _brAx.clone(), a: 0, w: (B.kind === 'lamp' ? 1.6 : 6) + sp * .08, max: B.kind === 'lamp' ? 1.48 : 1.57, hy: B.kind === 'hydrant' ? .35 : 0, t: 0, dx, dz, sp });
  }
  while (brk.fallen.length > 24) { const f = brk.fallen.shift(); scene.remove(f.m); f.m.dispose(); }
  if (B.kind === 'lamp') { brkLampOff(B.hx, B.hz); if (wx.wet > .3 || waterDepth(B.x, B.z) > 0) brk.wires.push({ x: B.x, z: B.z, t: 10, hurtT: 0 }); }
  else brk.geysers.push({ x: B.x, z: B.z, t: 12 });
  brk.n++;
  if (v === player.veh && (W.stars || copSees(B.x, B.z, 40))) crime('assault', B.x, B.z);
}
// 開車前（69-v3-crash.js 的 driveSub、69-v3-world.js 的 aiDrive）：這一幀前後兩個碰撞圓會掃到的路燈、消防栓先撞斷
function breakSweep(v, dt) {
  if (player.where !== 'out' || v.boat || v.fly || !v.isCar) return;   // 機車撞上去是人摔出去（69-v3-crash.js），桿子不斷
  const sp = Math.hypot(v.vx, v.vz);
  if (sp < BRK_V) return;
  if (!brk.reg) brkInit();
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), mx = v.vx * dt, mz = v.vz * dt, L2 = mx * mx + mz * mz;
  for (const s of [1, -1]) {
    const cx = v.x + fx * v.off * s, cz = v.z + fz * v.off * s;
    for (const c of [...circlesNear(cx + mx / 2, cz + mz / 2, v.rad + Math.sqrt(L2) + .5)]) {
      if (!brk.reg.has(c)) continue;
      const t = clamp(((c.x - cx) * mx + (c.z - cz) * mz) / (L2 || 1), 0, 1), d = Math.hypot(cx + mx * t - c.x, cz + mz * t - c.z);
      if (d < v.rad + c.r + .08) brkBreak(c, v);
    }
  }
}
function breakUpdate(dt) {
  for (let i = brk.fallen.length - 1; i >= 0; i--) {
    const f = brk.fallen[i];
    f.t += dt;
    if (f.a < f.max) {
      f.w += dt * 3.5; f.a = Math.min(f.max, f.a + f.w * dt);
      const slide = Math.min(1.2, f.t * f.sp * .1);   // 底座跟著被推出去一點
      _brQ.setFromAxisAngle(f.ax, f.a);
      _brM.makeTranslation(f.x + f.dx * slide, f.hy * Math.min(1, f.t * 3), f.z + f.dz * slide).multiply(_brM2.makeRotationFromQuaternion(_brQ)).multiply(_brM2.makeTranslation(-f.x, 0, -f.z)).multiply(f.mtx);
      f.m.setMatrixAt(0, _brM); f.m.instanceMatrix.needsUpdate = true;
      if (f.a >= f.max && f.max > 1.4) { dust(f.x + f.dx * 3, .2, f.z + f.dz * 3, 5); sfx.impact(4); }
    }
  }
  // 消防栓的水柱：往上噴、把人沖倒
  for (let i = brk.geysers.length - 1; i >= 0; i--) {
    const g = brk.geysers[i];
    g.t -= dt; if (g.t <= 0) { brk.geysers.splice(i, 1); continue; }
    const k = Math.min(1, g.t / 3);
    for (let j = 0; j < 3; j++) if (Math.random() < dt * 30) emit('smoke', g.x + (Math.random() - .5) * .2, .4, g.z + (Math.random() - .5) * .2, { vx: (Math.random() - .5) * 1.2, vy: (7 + Math.random() * 4) * k, vz: (Math.random() - .5) * 1.2, max: 1.4, s0: .08, s1: .35, grav: 9.8, a: .55, c: [.75, .85, .95] });
    if (Math.random() < dt * 6) waterSplash(g.x, g.z, .4);
    for (let q = 0; q < PED_N; q++) { const p = peds.people[q]; if (!(pedState[q].down > 0) && Math.hypot(p.x - g.x, p.z - g.z) < 1.3) knockPed(q, (p.x - g.x) * 2, (p.z - g.z) * 2); }
    if (player.mode === 'walk' && player.where === 'out' && !(player.down > 0) && Math.hypot(player.x - g.x, player.z - g.z) < 1.2) { knockPlayer(player.x - g.x || .1, player.z - g.z); toast('被水柱沖倒了'); }
  }
  // 斷掉的路燈漏電（下雨或有水）
  for (let i = brk.wires.length - 1; i >= 0; i--) {
    const w = brk.wires[i];
    w.t -= dt; if (w.t <= 0) { brk.wires.splice(i, 1); continue; }
    if (Math.random() < dt * 14) sparks(w.x + (Math.random() - .5) * .6, .15, w.z + (Math.random() - .5) * .6, 3, 2);
    if (Math.random() < dt * 5) fxLights.push({ x: w.x, y: .5, z: w.z, col: lin(0x9fc8ff), r: 7, i: 2, life: 0, max: .06 });
    for (let q = 0; q < PED_N; q++) { const p = peds.people[q]; if (!(pedState[q].down > 0) && Math.hypot(p.x - w.x, p.z - w.z) < 2.5) stunPed(q, 6, 0, 0); }
    for (const f of SQ.f) if (f.on && !(f.stunT > 0) && Math.hypot(f.x - w.x, f.z - w.z) < 2.5) { f.stunT = 6; f.stunPh = -uTimeNow(); }
    for (const c of W.cops) if (c.on && c.state !== 'down' && !(c.stunT > 0) && Math.hypot(c.x - w.x, c.z - w.z) < 2.5) stunCop(c, 6);
    if (player.mode === 'walk' && (w.hurtT -= dt) <= 0 && Math.hypot(player.x - w.x, player.z - w.z) < 1.6) { w.hurtT = .5; hurtPlayer(8); sparks(player.x, 1, player.z, 6, 2); }
  }
}
const breakApi = { brk, init: () => { if (!brk.reg) brkInit(); return brk.reg.size; }, sweep: breakSweep, nearest(x, z, kind) { if (!brk.reg) brkInit(); let b = null, bd = 1e9; for (const [c, B] of brk.reg) if (B.kind === kind) { const d = Math.hypot(B.x - x, B.z - z); if (d < bd) { bd = d; b = { ...B, c }; } } return b; } };
