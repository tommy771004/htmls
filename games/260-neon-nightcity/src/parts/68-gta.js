
// ═══ GTA 式擴充，第一階段（/Users/tommy/Downloads/neon_nightcity_gta_v.md 的 Phase 1）：搶車與撬車、步行瞄準射擊與徒手、
// 車損（白煙 → 黑煙 → 起火 → 爆炸）、被撞或中彈的路人倒地與四散逃跑。非官方同人致敬，與 Rockstar 無關。
// 車流與路邊的車被搶、被打壞時「脫離」車流（detachCar），變成和座駕一樣的獨立載具加進 vehicles（不進車行存檔）。
// 每幀的順序：gtaPre（凍結輸入）→ 原本的開車／走路 → gtaUpdate（射擊、車損、路人、粒子模擬）→ updateCrowds → gtaLate（槍的位置、粒子上傳）
const gta = { weapon: 'fist', aiming: false, aimK: 0, fireT: 0, mag: 12, reserve: 240, reloadT: 0, jack: null, punchT: 0, hold: false, rmb: false, pitch: 0 };
const WEAPONS = { fist: { name: '徒手' }, pistol: { name: '手槍', dmg: 90, rate: .2, mag: 12, range: 150 } };
const TYPE_NAME = { fh_taxi: 'Fairheaven 計程車', fh_cop: 'Fairheaven 警車', il_cop: 'Illinois 警車', e34: 'BMW E34', evo190: '190E EVO', negotiator: 'Negotiator', milano: 'Milano', kiri: 'Kiri', carter: 'Carter', compact: 'Compact', urban: 'Urban', tiara: 'Tiara GT', shvan: 'Shvan 廂型車', lct: 'LCT 3000 貨車', conquer: 'Conquer 皮卡', fvan: '送貨廂型車' };
const HP = 1000, SMOKE_W = 600, SMOKE_B = 350, FIRE = 150;
const _gm = new T.Matrix4(), _gv = V3(), _gv2 = V3(), _gq = new T.Quaternion();

// ─── 粒子：火、煙、火花、碎玻璃、閃光（兩組 instanced 公告板：加色與半透明） ───
const FX_N = LOW ? 500 : 1100;
const FX_VS = /* glsl */`
attribute vec3 iPos; attribute vec4 iCol; attribute vec2 iSz;
varying vec2 vUv; varying vec4 vCol; varying vec3 vW;
void main(){
  vec3 r = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), u = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float c = cos(iSz.y), s = sin(iSz.y);
  vec2 q = mat2(c, s, -s, c) * position.xy;
  vec3 w = iPos + (r * q.x + u * q.y) * iSz.x;
  vW = w; vUv = uv; vCol = iCol;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.);
}`;
const FX_FS = /* glsl */`
${GL_LIB}
varying vec2 vUv; varying vec4 vCol; varying vec3 vW;
void main(){
  vec2 q = vUv - .5; float d = length(q) * 2.;
  float n = n2(vUv * 3.1 + vCol.a * 5.3 + vW.xz * .7);
  float a = smoothstep(1., .25, d + (n - .5) * .5);
  #ifdef ADD
  gl_FragColor = vec4(vCol.rgb * a * vCol.a * exp(-length(vW - uCam) * uFogDen * .6), 1.);
  #else
  // 煙被路燈與霓虹從下方照亮：底色乘上環境光，再加一點暖色的城市光
  vec3 c = vCol.rgb * (uAmbTop * 3. + .32) + vec3(.05, .035, .03) * (1. - vUv.y) + uFlash * .3;
  gl_FragColor = vec4(applyFog(c, vW), a * vCol.a);
  #endif
}`;
function fxMesh(add) {
  const g = new T.InstancedBufferGeometry(); const b = new T.PlaneGeometry(1, 1);
  g.index = b.index; g.setAttribute('position', b.attributes.position); g.setAttribute('uv', b.attributes.uv);
  const at = { iPos: new T.InstancedBufferAttribute(new Float32Array(FX_N * 3), 3), iCol: new T.InstancedBufferAttribute(new Float32Array(FX_N * 4), 4), iSz: new T.InstancedBufferAttribute(new Float32Array(FX_N * 2), 2) };
  for (const k in at) { at[k].setUsage(T.DynamicDrawUsage); g.setAttribute(k, at[k]); }
  g.instanceCount = 0;
  const m = new T.Mesh(g, new T.ShaderMaterial({ uniforms: shared(ALLU), vertexShader: FX_VS, fragmentShader: FX_FS, defines: add ? { ADD: '' } : {}, transparent: true, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending }));
  m.frustumCulled = false; m.renderOrder = add ? 5 : 4; m.layers.set(LY.NOREFL);
  scene.add(m);
  return { m, at, n: 0 };
}
const fxAdd = fxMesh(true), fxAlpha = fxMesh(false);
const parts = [];   // { x, y, z, vx, vy, vz, life, max, s0, s1, kind, r, g, b, a, rot, vr, grav, drag }
const fxLights = [];   // 爆炸與槍口閃光：{ x, y, z, col, r, i, life, max }
const COL = { fire: lin(0xffa040), fireHot: lin(0xfff0b0), spark: lin(0xffd080), muzzle: lin(0xffc070), boom: lin(0xff8a30) };
function emit(kind, x, y, z, o = {}) {
  if (parts.length >= FX_N * 1.8) return;
  const r = Math.random;
  const P = { x, y, z, vx: o.vx ?? 0, vy: o.vy ?? 0, vz: o.vz ?? 0, life: 0, max: o.max ?? 1, s0: o.s0 ?? .3, s1: o.s1 ?? .6, kind, rot: r() * 6.28, vr: (r() - .5) * 2, grav: o.grav ?? 0, drag: o.drag ?? 1.5, a: o.a ?? 1, c: o.c || [1, 1, 1] };
  parts.push(P);
}
function stepFx(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life += dt;
    if (p.life >= p.max) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
    const k = Math.exp(-p.drag * dt);
    p.vx *= k; p.vz *= k; p.vy = p.vy * k - p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.vr * dt;
    if (p.y < .05 && p.grav > 0) { p.y = .05; p.vy *= -.25; p.vx *= .5; p.vz *= .5; }
  }
  for (let i = fxLights.length - 1; i >= 0; i--) { const l = fxLights[i]; l.life += dt; if (l.life >= l.max) fxLights.splice(i, 1); }
}
function uploadFx() {
  fxAdd.n = fxAlpha.n = 0;
  for (const p of parts) {
    const add = p.kind !== 'smoke' && p.kind !== 'dark', M = add ? fxAdd : fxAlpha;
    if (M.n >= FX_N) continue;
    const u = p.life / p.max, k = M.n++;
    const s = p.s0 + (p.s1 - p.s0) * u;
    let a = p.a, c = p.c;
    if (p.kind === 'fire') { a *= (1 - u) * (u < .1 ? u * 10 : 1); c = u < .3 ? [3.2, 2.2, 1.1] : [2.6 * (1 - u) + .5, 1.1 * (1 - u) + .15, .25]; }
    else if (p.kind === 'flash') a *= 1 - u;
    else if (p.kind === 'spark') a *= 1 - u;
    else if (p.kind === 'smoke' || p.kind === 'dark') a *= Math.min(1, u * 5) * (1 - u);
    else if (p.kind === 'glass') a *= 1 - u * u;
    M.at.iPos.array.set([p.x, p.y, p.z], k * 3);
    M.at.iCol.array.set([c[0], c[1], c[2], a], k * 4);
    M.at.iSz.array.set([s, p.rot], k * 2);
  }
  for (const M of [fxAdd, fxAlpha]) { M.m.geometry.instanceCount = M.n; for (const k in M.at) { M.at[k].needsUpdate = true; } }
}
// 爆炸、火花、槍口：組合好的效果
function sparks(x, y, z, n = 8, sp = 4) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, e = Math.random() * 1.2; emit('spark', x, y, z, { vx: Math.cos(a) * sp * Math.cos(e), vy: Math.sin(e) * sp + 1, vz: Math.sin(a) * sp * Math.cos(e), max: .25 + Math.random() * .3, s0: .06, s1: .02, grav: 9, drag: 2, c: [3, 2, 1] }); }
}
function dust(x, y, z, n = 4) {
  for (let i = 0; i < n; i++) emit('smoke', x, y, z, { vx: (Math.random() - .5) * 1.2, vy: .6 + Math.random(), vz: (Math.random() - .5) * 1.2, max: .9 + Math.random() * .6, s0: .15, s1: .7, a: .45, c: [.55, .52, .5] });
}
function glassBurst(x, y, z) {
  for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28; emit('glass', x, y, z, { vx: Math.cos(a) * 2.2, vy: 1 + Math.random() * 2, vz: Math.sin(a) * 2.2, max: .7 + Math.random() * .5, s0: .05, s1: .04, grav: 9.5, drag: 1, c: [1.4, 1.7, 2], a: .8 }); }
}
function fireball(x, y, z, big = 1) {
  for (let i = 0; i < 46 * big; i++) {
    const a = Math.random() * 6.28, e = Math.random() * 1.4, s = 2 + Math.random() * 7;
    emit('fire', x, y + .6, z, { vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(e) * s * .8 + 1.5, vz: Math.sin(a) * Math.cos(e) * s, max: .6 + Math.random() * .8, s0: 1 + Math.random(), s1: 2.6 + Math.random() * 1.5, drag: 3, grav: -1.5 });
  }
  for (let i = 0; i < 28 * big; i++) {
    const a = Math.random() * 6.28, s = 1 + Math.random() * 3;
    emit('dark', x, y + 1, z, { vx: Math.cos(a) * s, vy: 2 + Math.random() * 3, vz: Math.sin(a) * s, max: 2.5 + Math.random() * 2.5, s0: 1.2, s1: 5 + Math.random() * 3, drag: 1.2, a: .85, c: [.05, .045, .04] });
  }
  sparks(x, y + .8, z, 40, 11);
  emit('flash', x, y + 1, z, { max: .28, s0: 5, s1: 9, c: [2, 1.25, .55] });
  fxLights.push({ x, y: y + 2, z, col: COL.boom, r: 38, i: 9, life: 0, max: .9 });
}

// ─── 車流脫離：被搶、被打壞或被波及的車流與路邊車變成獨立載具 ───
const jacked = [];   // detachCar 建出來的載具（最多保留 8 台，舊的離得遠就收掉）
function detachCar(c) {
  const ty = TYPES[c.type], sp = traffic.includes(c) ? c.v || 0 : 0;
  let i = traffic.indexOf(c); if (i >= 0) traffic.splice(i, 1);
  i = parked.indexOf(c);
  if (i >= 0) { parked.splice(i, 1); for (const q of c.circ || []) { const j = circles.indexOf(q); if (j >= 0) circles.splice(j, 1); } }
  const L = typeMesh[c.type].list; i = L.indexOf(c); if (i >= 0) L.splice(i, 1);
  const geo = (ty.geo ? ty.geo() : ty.kit().build()).clone();
  const ins = new T.InstancedBufferAttribute(new Float32Array([0, c.seed || 0, c.palI || 0, 0]), 4);
  geo.setAttribute('aIns', ins);
  const mat = mkUber({ inst: true }); mat.fragmentShader = MAT.uberI.fragmentShader;
  const mesh = new T.InstancedMesh(geo, mat, 1); mesh.setMatrixAt(0, new T.Matrix4()); mesh.computeBoundingSphere();
  const g = new T.Group(), body = new T.Group(); g.add(body); body.add(mesh); scene.add(g);
  const truck = TRUCKS.includes(c.type);
  const v = {
    kind: 'jack', type: c.type, isCar: true, g, body, mat, ins, wheels: [], x: c.x, z: c.z, y: 0, yaw: c.yaw, vx: Math.sin(c.yaw) * sp, vz: Math.cos(c.yaw) * sp,
    yr: 0, steer: 0, spin: 0, roll: 0, pitch: 0, lean: 0, rpm: 0, gear: 1, slip: 0, lights: 0,
    len: ty.len, w: ty.w, rad: ty.w / 2 + .05, off: ty.len * .28, vmax: truck ? 31 : 40, eng: truck ? 8 : 10.5, grip: truck ? 5.5 : 6.8, wb: ty.len * .58, wr: .34,
    name: TYPE_NAME[c.type] || c.type, hp: c.hp ?? HP, police: !!ty.police, seat: null,
  };
  vehicles.push(v); jacked.push(v);
  poseVehicle(v);
  // 太多台時收掉最舊、離玩家遠、沒人坐的
  if (jacked.length > 8) {
    const old = jacked.find(o => o !== player.veh && Math.hypot(o.x - player.x, o.z - player.z) > 50);
    if (old) dropVehicle(old);
  }
  return v;
}
function dropVehicle(v) {
  jacked.splice(jacked.indexOf(v), 1); vehicles.splice(vehicles.indexOf(v), 1);
  scene.remove(v.g); v.g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
}
// 玩家附近的車流（慢於 6 m/s）或路邊車：車身矩形外 1.6 m 內
function nearCar(x, z, pad = 1.6) {
  let best = null, bd = pad;
  for (const c of [...traffic, ...parked]) {
    if (traffic.includes(c) && c.v > 6) continue;
    const ty = TYPES[c.type], fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), dx = x - c.x, dz = z - c.z;
    const a = Math.abs(dx * fx + dz * fz) - ty.len / 2, l = Math.abs(dx * fz - dz * fx) - ty.w / 2;
    const d = Math.hypot(Math.max(a, 0), Math.max(l, 0));
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

// ─── 被拖下車的駕駛與其他臨時路人（倒地 → 爬起 → 逃跑） ───
const extras = crowd(6);
scene.add(extras.mesh);
const extraSt = extras.people.map(() => ({ on: false }));
function spawnExtra(x, z, yaw, fx, fz) {
  let k = extraSt.findIndex(s => !s.on);
  if (k < 0) k = extraSt.reduce((b, s, i) => (s.t > extraSt[b].t ? i : b), 0);
  extras.look(k, {});
  extraSt[k] = { on: true, t: 0, x, z, yaw, vx: fx * 3.2, vz: fz * 3.2, st: 'fall' };
  extras.anim(k, ANIM.die, -uTimeNow(), 1);
  return k;
}
function updateExtras(dt) {
  extraSt.forEach((s, k) => {
    if (!s.on) { extras.place(k, 0, -60, 0, 0); return; }
    s.t += dt;
    if (s.st === 'fall') {
      s.x += s.vx * dt; s.z += s.vz * dt; s.vx *= Math.exp(-5 * dt); s.vz *= Math.exp(-5 * dt);
      if (s.t > 1.5) { s.st = 'up'; s.t = 0; extras.anim(k, ANIM.getup, -uTimeNow(), 1); }
      else if (s.t < 0 && s.t > -.05) s.on = false;   // 中彈倒地的人躺 12 秒後消失
    } else if (s.st === 'up') {
      if (s.t > .9) { s.st = 'run'; s.t = 0; extras.anim(k, ANIM.run, Math.random() * 9, 1.15); }
    } else {
      // 背對玩家跑，撞牆就沿牆滑開
      const ax = s.x - player.x, az = s.z - player.z, al = Math.hypot(ax, az) || 1;
      s.yaw += wrapA(Math.atan2(ax / al, az / al) - s.yaw) * (1 - Math.exp(-4 * dt));
      const r = collideCircle(s.x + Math.sin(s.yaw) * 4.6 * dt, s.z + Math.cos(s.yaw) * 4.6 * dt, .3, false);
      s.x = r.x; s.z = r.z;
      if (s.t > 9 || al > 70) s.on = false;
    }
    extras.place(k, s.x, groundH(s.x, s.z) > 0 ? .15 : 0, s.z, s.yaw);
  });
}

// ─── 路人：中彈或被撞倒地、聽到槍聲四散（40-people 的 pedState 加上 down／panic） ───
function knockPed(k, fx = 0, fz = 0) {
  const ps = pedState[k];
  if (!ps || ps.down > 0) return;
  const p = peds.people[k];
  ps.down = 14; ps.dpos = [p.x + fx * .6, p.z + fz * .6, Math.atan2(-fx, -fz) || p.yaw];
  peds.anim(k, ANIM.die, -uTimeNow(), 1);
  panic(p.x, p.z, 22, 9);
}
function panic(x, z, r, t) {
  pedState.forEach((ps, k) => {
    if (ps.down > 0) return;
    const p = peds.people[k], dx = p.x - x, dz = p.z - z;
    if (dx * dx + dz * dz > r * r) return;
    // 往遠離危險的方向跑：沿著人行道的切線方向判斷
    const [, , tx, tz] = pedPos(ps);
    ps.dir = tx * dx + tz * dz >= 0 ? 1 : -1;
    if (!(ps.panic > 0)) peds.anim(k, ANIM.run, Math.random() * 9, 1.2);
    ps.panic = t + Math.random() * 3;
  });
}

// ─── 搶車：拉開車門把駕駛拖下來（車流），或敲破車窗接線發動（路邊車，1.5 秒） ───
function startJack(c) {
  const moving = traffic.includes(c);
  const v = detachCar(c);
  v.vx = v.vz = 0;
  const lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw);   // 駕駛座在車身左側
  gta.jack = { v, t: 0, dur: moving ? 1.25 : 1.9, moving, x0: player.x, z0: player.z, dx: v.x + lx * (v.w / 2 + .55) + Math.sin(v.yaw) * .35, dz: v.z + lz * (v.w / 2 + .55) + Math.cos(v.yaw) * .35, done: 0 };
  gta.aiming = false;
}
function stepJack(dt) {
  const j = gta.jack, v = j.v;
  j.t += dt;
  const u = Math.min(1, j.t / .3);
  player.x = lerp(j.x0, j.dx, u); player.z = lerp(j.z0, j.dz, u);
  player.yaw = Math.atan2(v.x - player.x, v.z - player.z);
  if (!j.done && j.t > .35) {
    j.done = 1;
    const lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw);
    if (j.moving) { sfx.doorCar(true); spawnExtra(j.dx + lx * .3, j.dz + lz * .3, Math.atan2(lx, lz), lx, lz); toast('把駕駛拖下車'); }
    else { sfx.glassBreak(); glassBurst(j.dx - lx * .3, 1.05, j.dz - lz * .3); toast('敲破車窗，接線發動…'); }
    panic(v.x, v.z, 14, 6);
  }
  if (j.t >= j.dur) { gta.jack = null; enterVehicle(v); toast(`搶到 ${v.name}`); }
}
ctxHooks.push(p => {
  if (p.mode !== 'walk' || p.where !== 'out' || gta.jack || player.down > 0) return null;
  for (const v of vehicles) if (!v.dead && Math.hypot(p.x - v.x, p.z - v.z) < (v.isCar ? 3.2 : 2.2)) return null;   // 自己的車與搶過的車照原本的「上車」
  const c = nearCar(p.x, p.z);
  if (!c) return null;
  const moving = traffic.includes(c);
  return { key: 'F', text: `${moving ? '搶車' : '撬車'} <i>· ${TYPE_NAME[c.type] || c.type}</i>`, fn: () => startJack(c) };
});

// ─── 武器：Tab 換武器、右鍵瞄準、左鍵開火（徒手是出拳）、R 換彈 ───
const gunMesh = (() => {
  const k = new Kit();
  k.box(0, .045, .06, .032, .034, .2, 0x1a1b1e, 15);          // 滑套
  k.box(0, .02, .045, .028, .02, .16, 0x111214, 2);            // 槍身
  k.box(0, -.035, 0, .028, .1, .045, 0x161616, 2, -.25);      // 握把
  k.box(0, .002, .03, .006, .03, .03, 0x111214, 2);            // 扳機護弓
  k.cyl(0, .045, .165, .007, .007, .012, 8, 0x050505, 2, Math.PI / 2);
  const g = k.build(); g.scale(1.25, 1.25, 1.25);
  const m = new T.Mesh(g, MAT.uber); m.matrixAutoUpdate = false; m.visible = false;
  scene.add(m); return m;
})();
function setWeapon(w) {
  if (gta.weapon === w) return;
  gta.weapon = w; sfx.click();
  if (w === 'fist') gta.aiming = false;
  toast(`武器：${WEAPONS[w].name}`);
}
function canFight() { return started && player.where === 'out' && player.mode === 'walk' && !gta.jack && !(player.down > 0) && !dlg.open && !fading; }
// 準星射線：從相機穿過畫面中央，起點移到玩家所在的平面（避免打到相機和玩家之間的東西）
function aimRay() {
  camera.getWorldDirection(_gv);
  const o = camera.position, t0 = Math.max(0, (player.x - o.x) * _gv.x + (player.z - o.z) * _gv.z);
  return { ox: o.x + _gv.x * t0, oy: o.y + _gv.y * t0, oz: o.z + _gv.z * t0, dx: _gv.x, dy: _gv.y, dz: _gv.z };
}
function rayOBB(R, cx, cz, yaw, hw, hl, h) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = fz, rz = -fx, px = R.ox - cx, pz = R.oz - cz;
  const o = [px * rx + pz * rz, R.oy, px * fx + pz * fz], d = [R.dx * rx + R.dz * rz, R.dy, R.dx * fx + R.dz * fz], lo = [-hw, 0, -hl], hi = [hw, h, hl];
  let t0 = 0, t1 = 1e9;
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]) < 1e-9) { if (o[k] < lo[k] || o[k] > hi[k]) return Infinity; continue; }
    let a = (lo[k] - o[k]) / d[k], b = (hi[k] - o[k]) / d[k]; if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return Infinity;
  }
  return t0;
}
function rayCyl(R, cx, cz, r, y0, y1) {
  const px = R.ox - cx, pz = R.oz - cz, a = R.dx * R.dx + R.dz * R.dz, b = px * R.dx + pz * R.dz, c = px * px + pz * pz - r * r;
  if (a < 1e-9) return Infinity;
  const disc = b * b - a * c; if (disc < 0) return Infinity;
  const t = (-b - Math.sqrt(disc)) / a; if (t < 0) return Infinity;
  const y = R.oy + R.dy * t; return y >= y0 && y <= y1 ? t : Infinity;
}
// 射線最先打到的東西：{ t, kind: 'ped'|'extra'|'car'|'veh'|'wall'|'ground', ref }
function castRay(R, maxT) {
  let best = { t: maxT, kind: null, ref: null };
  const hit = (t, kind, ref) => { if (t < best.t) best = { t, kind, ref }; };
  for (let k = 0; k < PED_N; k++) { const ps = pedState[k]; if (ps.down > 0) continue; const p = peds.people[k]; hit(rayCyl(R, p.x, p.z, .32, .1, 1.95), 'ped', k); }
  extraSt.forEach((s, k) => { if (s.on && s.st === 'run') hit(rayCyl(R, s.x, s.z, .32, .1, 1.95), 'extra', k); });
  for (const c of traffic) hit(rayOBB(R, c.x, c.z, c.yaw, TYPES[c.type].w / 2, TYPES[c.type].len / 2, 1.5), 'car', c);
  for (const c of parked) { if ((c.x - R.ox) ** 2 + (c.z - R.oz) ** 2 > (maxT + 5) ** 2) continue; hit(rayOBB(R, c.x, c.z, c.yaw, TYPES[c.type].w / 2, TYPES[c.type].len / 2, 1.5), 'car', c); }
  for (const v of vehicles) if (v !== player.veh) hit(rayOBB(R, v.x, v.z, v.yaw, v.w / 2, v.len / 2, v.isCar ? 1.45 : 1.2), 'veh', v);
  for (const b of activeBoxes) { const t = rayBox(R.ox, R.oz, R.dx * best.t, R.dz * best.t, b); if (t < 1) hit(t * best.t, 'wall', b); }
  if (R.dy < -1e-4) hit(-R.oy / R.dy, 'ground', null);
  return best;
}
function damageCar(c, n) {
  c.hp = (c.hp ?? HP) - n;
  if (traffic.includes(c)) { c.hit = 3 + Math.random() * 2; if (c.honk <= 0) { sfx.horn(c); c.honk = 3; } }
  // 打到冒煙就脫離車流：駕駛下車逃跑，之後和其他載具一樣冒煙、起火、爆炸
  if (c.hp < SMOKE_W) {
    const had = traffic.includes(c), v = detachCar(c);
    if (had) { const lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw); const k = spawnExtra(v.x + lx * 1.4, v.z + lz * 1.4, Math.atan2(lx, lz), lx * .4, lz * .4); extraSt[k].st = 'up'; extras.anim(k, ANIM.getup, -uTimeNow() - .6, 1); }
    return v;
  }
  return null;
}
function damageVeh(v, n) { if (v.dead) return; v.hp -= n; if (v.hp <= 0) explode(v); }
function fire() {
  const W = WEAPONS[gta.weapon];
  if (gta.weapon === 'fist') return punch();
  if (gta.reloadT > 0 || gta.fireT > 0) return;
  if (gta.mag <= 0) { if (gta.reserve > 0) reload(); else { sfx.dry(); toast('沒子彈了'); } return; }
  gta.mag--; gta.fireT = W.rate;
  if (!gta.aiming) player.yaw = camState.yaw;   // 沒瞄準就開槍：先轉向準星
  const R = aimRay(), h = castRay(R, W.range);
  const x = R.ox + R.dx * h.t, y = R.oy + R.dy * h.t, z = R.oz + R.dz * h.t;
  // 槍口閃光與彈道
  gunMesh.updateMatrixWorld(); _gv2.set(0, .045, .2).applyMatrix4(gunMesh.matrixWorld);
  emit('flash', _gv2.x, _gv2.y, _gv2.z, { max: .06, s0: .35, s1: .5, c: [3, 2, 1] });
  fxLights.push({ x: _gv2.x, y: _gv2.y, z: _gv2.z, col: COL.muzzle, r: 9, i: 3, life: 0, max: .06 });
  const n = Math.max(1, Math.min(12, Math.floor(h.t / 4)));
  for (let i = 1; i <= n; i++) { const u = i / (n + 1); emit('spark', lerp(_gv2.x, x, u), lerp(_gv2.y, y, u), lerp(_gv2.z, z, u), { max: .05, s0: .05, s1: .05, c: [2.4, 2, 1.4], a: .6 }); }
  sfx.shot(); camState.shake = Math.max(camState.shake, .12);
  panic(player.x, player.z, 30, 8);
  if (h.kind === 'ped') knockPed(h.ref, R.dx, R.dz);
  else if (h.kind === 'extra') { const s = extraSt[h.ref]; s.st = 'fall'; s.t = -12; s.vx = R.dx * 2; s.vz = R.dz * 2; extras.anim(h.ref, ANIM.die, -uTimeNow(), 1); }
  else if (h.kind === 'car') { sparks(x, y, z, 6, 3); damageCar(h.ref, W.dmg); }
  else if (h.kind === 'veh') { sparks(x, y, z, 6, 3); damageVeh(h.ref, W.dmg); }
  else if (h.kind) { sparks(x, y, z, 5, 2.5); dust(x, y, z, 2); }
  if (gta.mag === 0 && gta.reserve > 0) setTimeout(() => gta.mag === 0 && reload(), 250);
}
function reload() {
  if (gta.weapon !== 'pistol' || gta.reloadT > 0 || gta.mag >= WEAPONS.pistol.mag || gta.reserve <= 0) return;
  gta.reloadT = 1.3; sfx.reload();
}
function punch() {
  if (gta.punchT > 0) return;
  gta.punchT = .55; gta.punchPh = -uTimeNow();
  const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
  setTimeout(() => {
    for (let k = 0; k < PED_N; k++) {
      const p = peds.people[k], dx = p.x - player.x, dz = p.z - player.z, d = Math.hypot(dx, dz);
      if (d < 1.5 && dx * fx + dz * fz > d * .5 && !(pedState[k].down > 0)) { sfx.punch(); knockPed(k, fx, fz); return; }
    }
    sfx.whoosh();
  }, 180);
}

// ─── 車損：冒煙、起火、爆炸；撞到路人 ───
function explode(v) {
  if (v.dead) return;
  v.dead = 1; v.hp = 0; v.burn = 1; v.lights = 0; v.burnT = 0;
  fireball(v.x, v.y, v.z, v.isCar ? 1 : .6);
  sfx.boom(Math.hypot(v.x - camera.position.x, v.z - camera.position.z));
  const dc = Math.hypot(v.x - camera.position.x, v.z - camera.position.z);
  camState.shake = Math.max(camState.shake, clamp(1.2 - dc / 40, 0, 1));
  if (player.veh === v) { exitVehicle(); knockPlayer(player.x - v.x, player.z - v.z); toast(`${v.name} 爆炸了`); }
  // 波及：路人、玩家、附近的車（連鎖爆炸）
  for (let k = 0; k < PED_N; k++) { const p = peds.people[k], dx = p.x - v.x, dz = p.z - v.z, d = Math.hypot(dx, dz); if (d < 8) knockPed(k, dx / (d || 1), dz / (d || 1)); }
  panic(v.x, v.z, 40, 12);
  if (player.mode === 'walk') { const d = Math.hypot(player.x - v.x, player.z - v.z); if (d < 6) knockPlayer(player.x - v.x, player.z - v.z); }
  for (const c of [...traffic, ...parked]) { const d = Math.hypot(c.x - v.x, c.z - v.z); if (d < 7) { const nv = damageCar(c, 900 * (1 - d / 7)); if (nv) nv.hp = Math.min(nv.hp, FIRE + 40 * Math.random()); } }
  for (const o of vehicles) if (o !== v && !o.dead) { const d = Math.hypot(o.x - v.x, o.z - v.z); if (d < 7) o.hp = Math.min(o.hp, o.hp - 900 * (1 - d / 7)); }
  if (v === kestrel) toast(`${v.name} 燒毀了 · 按 V 叫修好的車`);
}
function knockPlayer(dx, dz) {
  const l = Math.hypot(dx, dz) || 1;
  player.down = 2.6; player.kx = dx / l * 5; player.kz = dz / l * 5; player.downPh = -uTimeNow(); player.gotUp = 0;
  gta.aiming = false;
}
function vehDamage(v, dt) {
  if (v.dead) {
    v.burnT += dt;
    if (v.burnT < 18 && Math.random() < dt * 30) emit('fire', v.x + (Math.random() - .5) * v.w * .6, v.y + .9, v.z + (Math.random() - .5) * v.len * .6, { vy: 1.6, max: .7, s0: .5, s1: .2, drag: 1 });
    if (Math.random() < dt * (v.burnT < 30 ? 14 : 3)) emit('dark', v.x, v.y + 1.4, v.z, { vx: (Math.random() - .5) * .6, vy: 2.2, vz: (Math.random() - .5) * .6, max: 3.5, s0: .6, s1: 3.5, drag: .6, a: .7, c: [.05, .045, .04] });
    if (v.burnT < 18 && Math.random() < dt * 2) fxLights.push({ x: v.x, y: v.y + 1.5, z: v.z, col: COL.fire, r: 14, i: 2.2, life: 0, max: .6 });
    return;
  }
  if (v.hp >= SMOKE_W) return;
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), hx = v.x + fx * v.len * .38, hz = v.z + fz * v.len * .38, hy = v.y + (v.isCar ? 1 : .8);
  const rate = v.hp < SMOKE_B ? 26 : 12;
  if (Math.random() < dt * rate) {
    const dark = v.hp < SMOKE_B;
    emit('smoke', hx, hy, hz, { vx: (Math.random() - .5) * .5 - v.vx * .4, vy: 1.4 + Math.random(), vz: (Math.random() - .5) * .5 - v.vz * .4, max: 1.6 + Math.random(), s0: .35, s1: 1.8, drag: .8, a: dark ? .75 : .5, c: dark ? [.06, .055, .05] : [.7, .7, .72] });
  }
  if (v.hp < FIRE) {
    v.hp -= 28 * dt;
    if (Math.random() < dt * 34) emit('fire', hx + (Math.random() - .5) * .6, hy - .1, hz + (Math.random() - .5) * .6, { vy: 1.8, max: .5, s0: .45, s1: .15, drag: 1 });
    if (Math.random() < dt * 4) fxLights.push({ x: hx, y: hy + .4, z: hz, col: COL.fire, r: 10, i: 1.8, life: 0, max: .4 });
    if (v.hp <= 0) explode(v);
  }
}
// 開車撞人：前後兩個碰撞圓附近的路人倒地；撞擊扣血
function vehHits(v, imp) {
  if (imp > 5) damageVeh(v, (imp - 5) * 30);
  const sp = Math.hypot(v.vx, v.vz);
  if (sp < 2.5) return;
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  for (let k = 0; k < PED_N; k++) {
    if (pedState[k].down > 0) continue;
    const p = peds.people[k];
    for (const s of [1, -1]) { const cx = v.x + fx * v.off * s, cz = v.z + fz * v.off * s; if (Math.hypot(p.x - cx, p.z - cz) < v.rad + .35) { knockPed(k, v.vx / sp, v.vz / sp); sfx.impact(sp * .6); break; } }
  }
}

// ─── 每幀 ───
function gtaPre(dt) {
  if (gta.jack || player.down > 0) { inp.mx = inp.mz = 0; inp.run = false; }
}
function gtaUpdate(dt) {
  const out = player.where === 'out';
  gta.fireT = Math.max(0, gta.fireT - dt); gta.punchT = Math.max(0, gta.punchT - dt);
  if (gta.reloadT > 0) { gta.reloadT -= dt; if (gta.reloadT <= 0) { const n = Math.min(WEAPONS.pistol.mag - gta.mag, gta.reserve); gta.mag += n; gta.reserve -= n; } }
  if (!canFight()) gta.aiming = false;
  else gta.aiming = gta.weapon === 'pistol' && (gta.rmb || gta.touchAim);
  gta.aimK = damp(gta.aimK, gta.aiming ? 1 : 0, 12, dt);
  if (gta.hold && canFight() && gta.weapon === 'pistol') fire();
  if (gta.jack) stepJack(dt);
  if (out) {
    for (const v of [...vehicles]) vehDamage(v, dt);
    if (player.mode === 'drive') vehHits(player.veh, gta.lastImp || 0);
    updateExtras(dt);
  }
  gta.lastImp = 0;
  // 玩家倒地：被炸飛後躺著，再爬起來
  if (player.down > 0 && player.mode === 'walk') {
    player.down -= dt;
    const r = collideCircle(player.x + player.kx * dt, player.z + player.kz * dt, .32, false);
    player.x = r.x; player.z = r.z; player.kx *= Math.exp(-4 * dt); player.kz *= Math.exp(-4 * dt);
    if (player.down <= 1 && !player.gotUp) { player.gotUp = 1; player.upPh = -uTimeNow(); }
    if (player.down <= 0) { player.gotUp = 0; player.anim = -1; }
    me.anim(0, player.gotUp ? ANIM.getup : ANIM.die, player.gotUp ? player.upPh : player.downPh, 1);
    me.anim2(0, 0, 0); me.place(0, player.x, player.y, player.z, player.yaw);
  } else if (gta.jack) {
    me.anim(0, gta.jack.moving ? ANIM.interact : (gta.jack.t < .6 ? ANIM.jab : ANIM.crouch), gta.jack.moving ? -uTimeNow() + gta.jack.t : 0, 1);
    me.anim2(0, 0, 0); me.place(0, player.x, player.y, player.z, player.yaw);
  } else if (player.mode === 'walk' && gta.punchT > 0) {
    me.anim(0, ANIM.jab, gta.punchPh, 1); me.anim2(0, 0, 0);
  }
  me.people[0].aimP = gta.aimK > .05 ? -camState.pitch * .9 + .1 : null;
  me.people[0].aimK = gta.aimK;
  stepFx(dt);
}
function gtaLate() {
  // 手槍掛在右手：槍管沿著前臂（瞄準時沿著準星方向）
  const p = me.people[0];
  const show = gta.weapon === 'pistol' && player.mode === 'walk' && player.where === 'out' && me.mesh.visible && p.rig && !(player.down > 0);
  gunMesh.visible = !!show;
  if (show) {
    p.h.updateMatrixWorld(true);
    _gm.multiplyMatrices(p.h.matrixWorld, p.sm.matrix);
    const hand = _gv.setFromMatrixPosition(_gm.clone().multiply(p.bones.hand_r.matrixWorld));
    const elbow = _gv2.setFromMatrixPosition(_gm.clone().multiply(p.bones.lowerarm_r.matrixWorld));
    const dir = hand.clone().sub(elbow).normalize();
    if (gta.aimK > .5) camera.getWorldDirection(dir);
    const m = new T.Matrix4().lookAt(V3(), dir.clone().negate(), V3(0, 1, 0));
    const pos = hand.clone().addScaledVector(dir, .05);
    gunMesh.matrix.copy(m).setPosition(pos); gunMesh.matrixWorldNeedsUpdate = true;
  }
  uploadFx();
  // HUD：準星、武器欄
  const armed = gta.weapon === 'pistol' && player.mode === 'walk' && player.where === 'out' && started;
  const xs = armed ? (gta.aimK > .5 ? 2 : 1) : 0;
  if (hudCache.xh !== xs) { hudCache.xh = xs; const x = $('xhair'); x.classList.toggle('on', xs > 0); x.classList.toggle('aim', xs === 2); $('weap').classList.toggle('on', xs > 0); }
  if (armed) {
    const am = `${gta.mag}|${gta.reserve}`;
    if (hudCache.ammo !== am) { hudCache.ammo = am; $('wAmmo').innerHTML = `${gta.mag} <small>/ ${gta.reserve}</small>`; }
    const rl = gta.reloadT > 0 ? Math.round((1 - gta.reloadT / 1.3) * 100) : 0;
    if (hudCache.rl !== rl) { hudCache.rl = rl; $('wReload').style.setProperty('--r', rl + '%'); }
  }
}

// ─── 輸入：滑鼠按鍵（鎖定游標後）與鍵盤 ───
cvs0().addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse' || !document.pointerLockElement) return;
  if (e.button === 2) gta.rmb = true;
  if (e.button === 0 && canFight()) { if (gta.weapon === 'fist') punch(); else { fire(); } }
});
addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && e.button === 2) gta.rmb = false; });
addEventListener('contextmenu', e => { if (started) e.preventDefault(); });
function cvs0() { return R.domElement; }
function gtaKey(code) {
  if (code === 'Tab') { if (canFight() || player.mode === 'drive') setWeapon(gta.weapon === 'fist' ? 'pistol' : 'fist'); return true; }
  if (code === 'KeyR') { reload(); return true; }
  if (code === 'Aim') { if (canFight() && gta.weapon !== 'pistol') setWeapon('pistol'); gta.touchAim = !gta.touchAim; return true; }
  return false;
}
for (const v of vehicles) v.hp ??= HP;

// 測試 API（window.__nc.gta）
const gtaApi = {
  state: gta, parts, fxLights, jacked, extras: extraSt,
  weapon: setWeapon, fire, punch, reload, aim(on = true) { gta.touchAim = on; },
  // 走到最近的車流或路邊車旁並開始搶（parked：只找路邊車）
  jack(parkedOnly = false) {
    if (player.mode === 'drive') exitVehicle();
    const list = parkedOnly ? parked : traffic, px = player.x, pz = player.z;
    const c = list.reduce((b, o) => (!b || Math.hypot(o.x - px, o.z - pz) < Math.hypot(b.x - px, b.z - pz) ? o : b), null);
    if (!c) return null;
    const lx = Math.cos(c.yaw), lz = -Math.sin(c.yaw);
    player.x = c.x + lx * (TYPES[c.type].w / 2 + 1); player.z = c.z + lz * (TYPES[c.type].w / 2 + 1);
    startJack(c); return c.type;
  },
  near: () => { const c = nearCar(player.x, player.z); return c && c.type; },
  damage(v, n) { damageVeh(v, n); },
  hitCar(c, n) { return damageCar(c, n); },
  explode, knockPed, panic, castRay: () => castRay(aimRay(), 150),
};
