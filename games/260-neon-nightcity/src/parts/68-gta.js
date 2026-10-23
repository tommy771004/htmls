
// ═══ GTA 式擴充，第一階段（/Users/tommy/Downloads/neon_nightcity_gta_v.md 的 Phase 1）：搶車與撬車、步行瞄準射擊與徒手、
// 車損（白煙 → 黑煙 → 起火 → 爆炸）、被撞或中彈的路人倒地與四散逃跑。非官方同人致敬，與 Rockstar 無關。
// 車流與路邊的車被搶、被打壞時「脫離」車流（detachCar），變成和座駕一樣的獨立載具加進 vehicles（不進車行存檔）。
// 每幀的順序：gtaPre（凍結輸入）→ 原本的開車／走路 → gtaUpdate（車損、路人、粒子模擬；武器在 69-combat.js 的 combatUpdate）
// → policeUpdate（69-police.js）→ updateCrowds → gtaLate（武器擺到手上、粒子上傳）
const gta = { weapon: 'fist', aiming: false, guard: false, aimK: 0, fireT: 0, reloadT: 0, jack: null, punchT: 0, punchPh: 0, actAnim: 0, hold: false, rmb: false, pitch: 0 };
const TYPE_NAME = { fh_taxi: 'Fairheaven 計程車', fh_cop: 'Fairheaven 警車', il_cop: 'Illinois 警車', e34: 'BMW E34', evo190: '190E EVO', negotiator: 'Negotiator', milano: 'Milano', kiri: 'Kiri', carter: 'Carter', compact: 'Compact', urban: 'Urban', tiara: 'Tiara GT', shvan: 'Shvan 廂型車', lct: 'LCT 3000 貨車', conquer: 'Conquer 皮卡', fvan: '送貨廂型車',
  urban_cop: 'Urban 執法休旅', md84: 'MD 84 裝甲車', ambulance: 'Shvan 救護車', canyon_taxi: 'Canyon 計程車', fh: 'Fairheaven LT', il: 'Illinois', tank: '重裝坦克',
  grc_sedan: 'Brougham 轎車', grc_stepvan: 'Stepline 廂型貨車', grc_mailvan: '蝸牛郵務車' };
// 車損階段（neon_nightcity_gta_v_2.md 第一節第 3 點，耐久的比例）：70% 以上只有火花、碎窗淡白煙、40% 濃黑煙且動力少兩成五、15% 起火每秒 −25、歸零爆炸
const HP = 1000, STAGE = { white: .7, black: .4, fire: .15 }, BURN_HP = 25, BOOM_R = 12;
const hpMaxOf = c => c.hpMax || (c.type ? VCLASS[typeClass(c.type)].hp : HP);   // 車流車沒有 hpMax：照車型的級距
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
  vec3 c = vCol.rgb * (uAmbTop * (3. - uDay * 1.5) + .32 + uSunCol * .5) + vec3(.05, .035, .03) * (1. - vUv.y) * (1. - uDay) + uFlash * .3;
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
  const P = { x, y, z, vx: o.vx ?? 0, vy: o.vy ?? 0, vz: o.vz ?? 0, life: 0, max: o.max ?? 1, s0: o.s0 ?? .3, s1: o.s1 ?? .6, kind, rot: r() * 6.28, vr: (r() - .5) * 2, grav: o.grav ?? 0, drag: o.drag ?? 1.5, a: o.a ?? 1, c: o.c || [1, 1, 1], sea: o.sea };
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
    if (p.sea && p.y < SEA_Y && p.vy < 0) { p.life = p.max; continue; }   // 水花（31-boats.js）：掉回水面就消失
    if (p.y < .05 && p.grav > 0 && !p.sea) { p.y = .05; p.vy *= -.25; p.vx *= .5; p.vz *= .5; }
  }
  for (let i = fxLights.length - 1; i >= 0; i--) { const l = fxLights[i]; l.life += dt; if (l.life >= l.max) fxLights.splice(i, 1); }
}
function uploadFx() {
  fxAdd.n = fxAlpha.n = 0;
  for (const p of parts) {
    const add = p.kind !== 'smoke' && p.kind !== 'dark' && p.kind !== 'spray', M = add ? fxAdd : fxAlpha;
    if (M.n >= FX_N) continue;
    const u = p.life / p.max, k = M.n++;
    const s = p.s0 + (p.s1 - p.s0) * u;
    let a = p.a, c = p.c;
    if (p.kind === 'fire') { a *= (1 - u) * (u < .1 ? u * 10 : 1); c = u < .3 ? [3.2, 2.2, 1.1] : [2.6 * (1 - u) + .5, 1.1 * (1 - u) + .15, .25]; }
    else if (p.kind === 'flash') a *= 1 - u;
    else if (p.kind === 'spark') a *= 1 - u;
    else if (p.kind === 'smoke' || p.kind === 'dark') a *= Math.min(1, u * 5) * (1 - u);
    else if (p.kind === 'glass') a *= 1 - u * u;
    else if (p.kind === 'spray') a *= 1 - u;
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
// 一台獨立載具：車流車型的幾何複製一份、自己的材質（煞車燈與燒毀程度各自設定），69-police.js 的警車也用這個建
function buildVeh(type, x, z, yaw, sp = 0, seed = 0, palI = 0, kind = 'jack') {
  const ty = TYPES[type];
  const geo = (ty.geo ? ty.geo() : ty.kit().build()).clone();
  const ins = new T.InstancedBufferAttribute(new Float32Array([0, seed, palI, 0]), 4);
  geo.setAttribute('aIns', ins);
  const mat = mkUber({ inst: true }); mat.fragmentShader = MAT.uberI.fragmentShader;
  const mesh = new T.InstancedMesh(geo, mat, 1); mesh.setMatrixAt(0, new T.Matrix4()); mesh.computeBoundingSphere();
  const g = new T.Group(), body = new T.Group(); g.add(body); body.add(mesh); scene.add(g);
  const truck = TRUCKS.includes(type), heavy = ty.armored;
  const v = {
    kind, type, isCar: true, g, body, mat, ins, wheels: [], x, z, y: 0, yaw, vx: Math.sin(yaw) * sp, vz: Math.cos(yaw) * sp,
    yr: 0, steer: 0, spin: 0, roll: 0, pitch: 0, lean: 0, rpm: 0, gear: 1, slip: 0, lights: 0,
    len: ty.len, w: ty.w, rad: ty.w / 2 + .05, off: ty.len * .28, vmax: heavy ? 30 : truck ? 31 : 40, eng: heavy ? 7 : truck ? 8 : 10.5, grip: truck ? 5.5 : 6.8, wb: ty.len * .58, wr: .34,
    name: TYPE_NAME[type] || type, hp: heavy ? 3500 : HP, mass: heavy ? 4800 : truck ? 2600 : 1600, police: !!ty.police, seat: null,
  };
  vehClass(v, typeClass(type), true);   // 25-cars.js 的級距表：質量、極速、加速、抓地、耐久（之後各模組再依用途覆寫）
  vehicles.push(v);
  return v;
}
function detachCar(c) {
  const sp = traffic.includes(c) ? c.v || 0 : 0;
  let i = traffic.indexOf(c); if (i >= 0) traffic.splice(i, 1);
  i = parked.indexOf(c);
  if (i >= 0) { parked.splice(i, 1); for (const q of c.circ || []) { const j = circles.indexOf(q); if (j >= 0) circles.splice(j, 1); } colDirty(); }
  const L = typeMesh[c.type].list; i = L.indexOf(c); if (i >= 0) L.splice(i, 1);
  const v = buildVeh(c.type, c.x, c.z, c.yaw, sp, c.seed || 0, c.palI || 0);
  v.hpLock = 1;   // 耐久上限就是級距表的（68-wreck.js 的 hpLock：之後被改的 hp 不算上限）
  if (c.hp != null) v.hp = Math.min(v.hp, c.hp);
  if (c.byP) v.byP = c.byP;
  jacked.push(v);
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
  if (ps.fsm) { p.x = ps.fx; p.z = ps.fz; ps.fsm = null; }   // 69-combat.js 的投降、反擊中被打倒
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
    if (ps.fsm === 'fight') return;
    // 離得近的人有三成當場抱頭蹲下（69-combat.js 的 pedFsm），其他人跑開
    if (!ps.fsm && !ps.tough && dx * dx + dz * dz < r * r * .3 && Math.random() < .3) { pedEnter(k, 'cower', t + 2 + Math.random() * 3); return; }
    if (ps.fsm) return;
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
    crime('jack', v.x, v.z);
  }
  if (j.t >= j.dur) { gta.jack = null; enterVehicle(v); toast(`搶到 ${v.name}`); }
}
ctxHooks.push(p => {
  if (p.mode !== 'walk' || p.where !== 'out' || gta.jack || player.down > 0) return null;
  for (const v of vehicles) if (!v.dead && Math.hypot(p.x - v.x, p.z - v.z) < (v.boat ? 6.5 : v.isCar ? 3.2 : 2.2)) return null;   // 自己的車與搶過的車照原本的「上車」
  const c = nearCar(p.x, p.z);
  if (!c) return null;
  const moving = traffic.includes(c);
  return { key: 'F', text: `${moving ? '搶車' : '撬車'} <i>· ${TYPE_NAME[c.type] || c.type}</i>`, fn: () => startJack(c) };
});

// ─── 武器（69-combat.js）：這裡只留共用的射線工具 ───
function canFight() { return started && (player.where === 'out' || player.where === 'bank') && player.mode === 'walk' && !player.swim && !gta.jack && !(player.down > 0) && !dlg.open && !fading; }
// 準星射線：從相機穿過畫面中央，起點移到玩家所在的平面（避免打到相機和玩家之間的東西）
function aimRay() {
  camera.getWorldDirection(_gv);
  const q = player.mode === 'drive' ? player.veh : player;   // 車內射擊：起點移到車子所在的平面
  const o = camera.position, t0 = Math.max(0, (q.x - o.x) * _gv.x + (q.z - o.z) * _gv.z);
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
// 射線最先打到的東西：{ t, kind: 'ped'|'extra'|'car'|'veh'|'wall'|'ground'（69-police.js 的 rayHooks 再加上 'cop'|'heli'）, ref }
const rayHooks = [];
function castRay(R, maxT, skip = player.veh) {
  let best = { t: maxT, kind: null, ref: null };
  const hit = (t, kind, ref) => { if (t < best.t) best = { t, kind, ref }; };
  for (const f of rayHooks) f(R, hit);
  for (let k = 0; k < PED_N; k++) { const ps = pedState[k]; if (ps.down > 0) continue; const p = peds.people[k]; hit(rayCyl(R, p.x, p.z, .32, .1, 1.95), 'ped', k); }
  extraSt.forEach((s, k) => { if (s.on && s.st === 'run') hit(rayCyl(R, s.x, s.z, .32, .1, 1.95), 'extra', k); });
  for (const c of traffic) hit(rayOBB(R, c.x, c.z, c.yaw, TYPES[c.type].w / 2, TYPES[c.type].len / 2, 1.5), 'car', c);
  for (const c of parked) { if ((c.x - R.ox) ** 2 + (c.z - R.oz) ** 2 > (maxT + 5) ** 2) continue; hit(rayOBB(R, c.x, c.z, c.yaw, TYPES[c.type].w / 2, TYPES[c.type].len / 2, 1.5), 'car', c); }
  for (const v of vehicles) if (v !== skip) hit(rayOBB({ ...R, oy: R.oy - v.y }, v.x, v.z, v.yaw, v.w / 2, v.len / 2, v.h || (v.isCar ? 1.45 : 1.2)), 'veh', v);
  for (const b of boxesNear(R.ox, R.oz, 0, R.ox + R.dx * best.t, R.oz + R.dz * best.t)) { if (b.low) continue; const t = rayBox(R.ox, R.oz, R.dx * best.t, R.dz * best.t, b); if (t < 1) hit(t * best.t, 'wall', b); }
  if (R.dy < -1e-4) hit(-R.oy / R.dy, 'ground', null);
  return best;
}
function damageCar(c, n, byP = false) {
  c.hp = (c.hp ?? hpMaxOf(c)) - n;
  if (byP) c.byP = uTimeNow();
  if (traffic.includes(c)) { c.hit = 3 + Math.random() * 2; if (c.honk <= 0) { sfx.horn(c); c.honk = 3; } }
  // 打到冒煙就脫離車流：駕駛下車逃跑，之後和其他載具一樣冒煙、起火、爆炸
  if (c.hp < hpMaxOf(c) * STAGE.white) {
    const had = traffic.includes(c), v = detachCar(c);
    if (had) { const lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw); const k = spawnExtra(v.x + lx * 1.4, v.z + lz * 1.4, Math.atan2(lx, lz), lx * .4, lz * .4); extraSt[k].st = 'up'; extras.anim(k, ANIM.getup, -uTimeNow() - .6, 1); }
    return v;
  }
  return null;
}
// byP：玩家造成的（之後爆炸算玩家的罪，69-police.js 的 crime）
function damageVeh(v, n, byP = false) { if (v.dead || !(n > 0)) return; hpLockOf(v); if (byP) v.byP = uTimeNow(); v.hp -= n; if (v.unit) unitHit(v, byP); if (v.hp <= 0) explode(v); }
// ─── 車損：冒煙、起火、爆炸；撞到路人 ───
function explode(v) {
  if (v.dead) return;
  v.dead = 1; v.hp = 0; v.burn = 1; v.lights = 0; v.burnT = 0;
  const mine = v.byP && uTimeNow() - v.byP < 25;
  if (player.veh === v) { exitVehicle(); if (!v.boat) knockPlayer(player.x - v.x, player.z - v.z); toast(`${v.name} 爆炸了`); }
  // 波及（69-combat.js 的 blast）：路人、警察、玩家、附近的車（連鎖爆炸）
  blast(v.x, v.y, v.z, BOOM_R, v.mass > 4000 ? 520 : 420, mine ? 'player' : null, v);
  if (mine) crime(v.unit ? 'killcop' : 'explode', v.x, v.z);
  marketExplode(v, mine);   // 69-market.js：凡托車款被炸，股價下跌
  if (v.unit) unitDead(v);
  if (v === kestrel) toast(`${v.name} 燒毀了 · 按 V 叫修好的車`);
}
function knockPlayer(dx, dz) {
  if (player.mode !== 'walk' || life.dead) return;
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
  const k = v.hp / hpLockOf(v);
  wreckStage(v, k, dt);   // 68-wreck.js：碎窗、動力衰減與熄火、跳車
  if (k >= STAGE.white) return;
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), hx = v.x + fx * v.len * .38, hz = v.z + fz * v.len * .38, hy = v.y + (v.isCar ? 1 : .8);
  const rate = k < STAGE.black ? 26 : 12;
  if (Math.random() < dt * rate) {
    const dark = k < STAGE.black;
    emit('smoke', hx, hy, hz, { vx: (Math.random() - .5) * .5 - v.vx * .4, vy: 1.4 + Math.random(), vz: (Math.random() - .5) * .5 - v.vz * .4, max: 1.6 + Math.random(), s0: .35, s1: 1.8, drag: .8, a: dark ? .75 : .5, c: dark ? [.06, .055, .05] : [.7, .7, .72] });
  }
  if (k < STAGE.fire) {
    v.hp -= BURN_HP * dt;
    if (Math.random() < dt * 34) emit('fire', hx + (Math.random() - .5) * .6, hy - .1, hz + (Math.random() - .5) * .6, { vy: 1.8, max: .5, s0: .45, s1: .15, drag: 1 });
    if (Math.random() < dt * 4) fxLights.push({ x: hx, y: hy + .4, z: hz, col: COL.fire, r: 10, i: 1.8, life: 0, max: .4 });
    if (v.hp <= 0) explode(v);
  }
}
// 開車撞人：前後兩個碰撞圓附近的路人倒地；撞擊扣血
function vehHits(v, imp) {
  // 撞牆扣血（neon_nightcity_gta_v_2.md：ΔHP = (J/M − 3.5)·18；牆的質量無限大，J/M = (1+e)·v法向，e = .25 和 vehicleCollide 的反彈一致）
  const jm = 1.25 * imp;
  if (jm > 3.5) { damageVeh(v, (jm - 3.5) * 18, false); if (jm > 6) sparks(v.x + Math.sin(v.yaw) * v.len * .45, v.y + .5, v.z + Math.cos(v.yaw) * v.len * .45, Math.min(24, jm * 1.5 | 0), 3 + jm * .3); }
  const sp = Math.hypot(v.vx, v.vz);
  if (sp < 2.5) return;
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  for (let k = 0; k < PED_N; k++) {
    if (pedState[k].down > 0) continue;
    const p = peds.people[k];
    for (const s of [1, -1]) {
      const cx = v.x + fx * v.off * s, cz = v.z + fz * v.off * s;
      if (Math.hypot(p.x - cx, p.z - cz) < v.rad + .35) { const dead = pedRam(k, v, sp); sfx.impact(sp * .6); if (v === player.veh) crime(dead ? 'kill' : 'assault', p.x, p.z); break; }   // pedRam：68-wreck.js 的撞擊傷害與擊飛
    }
  }  // 69-squads.js 的戰鬥員（敵方與搶包賊）：玩家開車撞到就倒
  if (v !== player.veh) return;
  for (const f of SQ.f) {
    if (!fUp(f) || fAlly(f)) continue;
    for (const s of [1, -1]) if (Math.hypot(f.x - v.x - fx * v.off * s, f.z - v.z - fz * v.off * s) < v.rad + .4) { fHit(f, RAM_K * sp * sp, v.vx / sp, v.vz / sp, true); sfx.impact(sp * .6); break; }
  }
}

// ─── 每幀 ───
function gtaPre(dt) {
  crewPre();
  talePre();
  if (gta.jack || player.down > 0 || life.dead || HACK.on) { inp.mx = inp.mz = 0; inp.run = false; inp.thr = inp.brk = inp.steer = 0; }   // HACK：69-heist2.js 的金庫破譯（WASD 用來調波形）
}
function gtaUpdate(dt) {
  const out = player.where === 'out';
  if (player.mode !== 'walk') player.crouch = false;
  gta.fireT = Math.max(0, gta.fireT - dt); gta.punchT = Math.max(0, gta.punchT - dt);
  if (gta.jack) stepJack(dt);
  combatUpdate(dt);
  crewUpdate(dt);
  gpsUpdate();
  phoneUpdate();
  evUpdate();
  marketUpdate(dt);
  heistUpdate(dt);
  squadUpdate(dt);   // 69-squads.js：幫派、傭兵、資產防守、搶劫隊友
  sideUpdate(dt);    // 69-side.js：街頭賽、生存模式、委託、幫派地盤
  aptUpdate();
  if (out) {
    wreckUpdate(dt);   // 68-wreck.js：被撞飛的路人
    for (const v of [...vehicles]) vehDamage(v, dt);
    if (player.mode === 'drive' && !player.veh.fly) vehHits(player.veh, gta.lastImp || 0);   // 69-gunship.js 的直升機自己算撞樓
    updateExtras(dt);
  }
  gta.lastImp = 0;
  // 玩家倒地：被炸飛後躺著，再爬起來（死亡與被捕的姿勢在 69-combat.js）
  if (life.dead) { /* combatUpdate 擺好了 */ }
  else if (player.down > 0 && player.mode === 'walk') {
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
    // 出拳、揮砍、丟擲（69-combat.js 設定 actAnim 與起始相位）
    me.anim(0, gta.actAnim || ANIM.jab, gta.punchPh, 1); me.anim2(0, 0, 0);
  }
  // 瞄準的俯仰：和相機一樣（40-people.js 的 gunPose 照它擺槍，槍口才會對著準星）
  me.people[0].aimP = gta.aimK > .05 ? Math.asin(clamp(camera.getWorldDirection(_gv).y, -1, 1)) : null;
  me.people[0].aimK = gta.guard ? 1 : gta.aimK;
  me.people[0].guard = !ARMS[arm.sel].gun;   // 40-people.js 的 aimArms：徒手舉拳
  stepFx(dt);
}
function gtaLate() {
  combatLate();
  crewLate();
  stuntLate();
  taleLate();   // 69-tale.js：委託的過場鏡頭
  bankGunsLate();   // 69-heist.js：大廳裡 Jax、Kael 與警衛的槍
  uploadFx();
}
for (const v of vehicles) v.hp ??= HP;

// 測試 API（window.__nc.gta；69-combat.js 的 combatApi 與 69-police.js 的 wantedApi 在 99-main 合併進來）
const gtaApi = {
  state: gta, parts, fxLights, jacked, extras: extraSt,
  weapon: w => equip(w), fire: () => { triggerDown(); triggerUp(); }, punch: () => { equip('fist', true); triggerDown(); triggerUp(); }, aim(on = true) { gta.touchAim = on; },
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
