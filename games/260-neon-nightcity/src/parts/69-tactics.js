// ─── 警察戰術與榴彈（neon_nightcity_gta_v_2.md 第二節第 2 點）：兩星 PIT 推尾、四星催淚瓦斯、四星第二架直升機垂降特警；榴彈發射器的曲射 ───
// 69-police.js 的 driveUnit 問 pitAim、copStep 把垂降中的特警交給 ropeStep、policeUpdate 每幀呼叫 tacticsUpdate

GUN_HOLD.launcher ??= { k: 'long', r: [0, -.07, -.15], l: [0, -.085, .26], b: [0, -.08, -.37], lh: 'gripL' };   // 40-people.js：M32（arms.glb）槍托抵肩，左手握直立的前握把
const TAC = { pitCd: 0, gasT: 6, gasWarn: false, still: 0, ax: 0, az: 0, rap: null, rapT: 10, rapN: 0 };

// ─── PIT：玩家時速 47 km/h 以上，追在後面的警車瞄準車尾一角（偏向自己那一側），碰到就把車尾推開讓玩家打轉 ───
const PIT_V = 13;
function pitAim(u) {
  const P = player.veh;
  if (!P || Math.hypot(P.vx, P.vz) < PIT_V || u.kind === 'tank' || u.v.boat || P.boat) { u.pit = 0; return null; }
  const c = Math.cos(P.yaw), s = Math.sin(P.yaw), dx = u.v.x - P.x, dz = u.v.z - P.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;   // 警車在玩家車身座標的位置（+x 左、+z 車頭）
  if (lz > P.len * .5 + 3 || Math.hypot(lx, lz) > 40) { u.pit = 0; return null; }   // 已經在前面或太遠：改走 boxAim 逼停
  if (!u.pit || Math.abs(lx) > 2.5) u.pit = lx >= 0 ? 1 : -1;
  const ox = u.pit * (P.w / 2 + .2), oz = -P.len * .32;
  return [P.x + ox * c + oz * s + P.vx * .35, P.z - ox * s + oz * c + P.vz * .35, Math.hypot(P.vx, P.vz) + 4];   // 第三個是車速上限：只比玩家快 4 m/s，推尾不是追撞
}
// ─── 逼停（沒在 PIT 的時候）：警車不直接撞玩家的車。在後面或旁邊就從側邊超上去（只比玩家快 5 m/s），
//     超到前面就切進玩家的車道、比玩家慢（把人逼得減速）；玩家慢到 6 m/s 以下時，各自卡住玩家車頭的一角包夾，到位停下讓警員下車
function boxAim(u) {
  const P = player.veh, ps = Math.hypot(P.vx, P.vz);
  const c = Math.cos(P.yaw), s = Math.sin(P.yaw), dx = u.v.x - P.x, dz = u.v.z - P.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;   // 同 pitAim：+x 左、+z 車頭
  if (!u.box) u.box = lx >= 0 ? 1 : -1;
  const at = (ox, oz) => [P.x + ox * c + oz * s + P.vx * .3, P.z - ox * s + oz * c + P.vz * .3];
  if (ps < 6 || lz > P.len * .5 + 1.5) u.cutT = uTimeNow() + 1;   // 正在擋在前面或包夾：這一秒內被玩家追撞不算玩家撞警車（69-kinema.js）
  if (ps < 6) { const o = at(u.box * (P.w / 2 + 1.4), P.len * .5 + 2.2); return [...o, Math.min(12, ps + Math.hypot(o[0] - u.v.x, o[1] - u.v.z) * .8)]; }
  if (lz > P.len * .5 + 1.5) return [...at(0, P.len * .5 + 7 + ps * .3), ps * (lz > P.len * .5 + 5 ? .75 : 1)];
  return [...at(u.box * (P.w / 2 + 2.6), P.len * .5 + 6), ps + 5];
}
function pitStep(dt) {
  TAC.pitCd -= dt;
  const P = player.veh;
  if (P && P.pitSpin) {   // 推到之後的 0.7 秒：車頭一直被扭過去，速度方向不變，所以車子側滑打轉
    const q = P.pitSpin; q.t -= dt;
    P.yaw += q.s * 2.6 * dt;
    if (q.t <= 0) P.pitSpin = null;
  }
  if (!P || player.mode !== 'drive' || W.stars < 2 || TAC.pitCd > 0) return;
  const ps = Math.hypot(P.vx, P.vz);
  if (ps < PIT_V * .8) return;
  const c = Math.cos(P.yaw), s = Math.sin(P.yaw);
  for (const u of W.units) {
    const v = u.v;
    if (!u.pit || v.dead || !u.drive) continue;
    const fx = v.x + Math.sin(v.yaw) * v.len * .5, fz = v.z + Math.cos(v.yaw) * v.len * .5;   // 警車車頭
    const ox = u.pit * P.w / 2, oz = -P.len * .38, cx = P.x + ox * c + oz * s, cz = P.z - ox * s + oz * c;   // 玩家車尾那一角
    if (Math.hypot(fx - cx, fz - cz) > 1.5) continue;
    // 從側後方推：車尾往另一邊甩，車頭朝警車那一側轉（+x 側被推，車頭往 +x 轉，yaw 增加）
    P.pitSpin = { s: u.pit, t: .7 };
    P.vx -= c * u.pit * 2.5; P.vz += s * u.pit * 2.5;
    TAC.pitCd = 4;
    sfx.impact(9); sparks(cx, P.y + .5, cz, 14, 4); camState.shake = Math.max(camState.shake, .5);
    toast('警車 PIT 推尾！');
    return;
  }
}

// ─── 催淚瓦斯：罐子落地 1.2 秒後冒出半徑 5.5 m、12 秒的煙；玩家在煙裡每秒掉 6 點；玩家丟的煙讓警察與敵人嗆到動不了 ───
const GAS = { clouds: [], k: 0, acc: 0, el: null };
function gasCloud(x, z, by) {
  GAS.clouds.push({ x, z, r: 5.5, t: 0, life: 12, by });
  sfx.spray();
  panic(x, z, 25, 8);
  if (by === 'player') crime('assault', x, z);
}
function gasEl() {
  if (GAS.el) return GAS.el;
  const e = document.createElement('div');
  e.id = 'gasFx'; e.setAttribute('aria-hidden', 'true');
  // 視野邊緣泛起灰綠、整個畫面有點糊（眼睛刺痛），強度跟著 GAS.k
  e.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;background:radial-gradient(ellipse at 50% 48%,rgba(150,160,120,0) 30%,rgba(150,160,118,.42) 72%,rgba(118,128,92,.78) 100%);mix-blend-mode:normal';
  document.body.appendChild(e);
  return (GAS.el = e);
}
function gasStep(dt) {
  const px = player.x, pz = player.z;
  let inGas = null;
  for (const g of [...GAS.clouds]) {
    g.t += dt;
    if (g.t > g.life) { GAS.clouds.splice(GAS.clouds.indexOf(g), 1); continue; }
    const grow = Math.min(1, g.t / 1.5), r = g.r * grow, fade = g.t > g.life - 2.5 ? (g.life - g.t) / 2.5 : 1;
    if (Math.random() < dt * 24 * fade) {
      const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * r * .7;
      emit('smoke', g.x + Math.cos(a) * d, .3, g.z + Math.sin(a) * d, { vx: Math.cos(a) * .5, vy: .25 + Math.random() * .3, vz: Math.sin(a) * .5, max: 3 + Math.random() * 2, s0: 1.2, s1: 4, drag: .6, a: .36, c: [.68, .7, .62] });
    }
    if (player.where === 'out' && player.mode === 'walk' && Math.hypot(px - g.x, pz - g.z) < r * fade) inGas = g;
    if (g.by !== 'player' || g.t < .5) continue;
    // 玩家丟的：警察（包括特警）與幫派、傭兵敵人嗆到原地蹲著咳。罐子一落地就算犯罪、附近的人會醒來跑開，
    // 煙要 1.5 秒才長滿，照畫面的半徑算會讓 3–4 m 外的人先跑出去；嗆到的範圍 0.6 秒就到滿
    const rN = g.r * Math.min(1, g.t / .6);
    for (const c of W.cops) if (c.on && c.state !== 'down' && !c.rope && Math.hypot(c.x - g.x, c.z - g.z) < rN && !(c.stunT > .5)) stunCop(c, 3);
    for (const f of SQ.f) if (fUp(f) && !fAlly(f) && Math.hypot(f.x - g.x, f.z - g.z) < rN && !(f.stunT > .5)) { f.stunT = 3; f.stunPh = -uTimeNow(); }
  }
  GAS.k = damp(GAS.k, inGas ? 1 : 0, inGas ? 3 : 1.2, dt);
  if (inGas) {
    GAS.acc += 6 * dt;
    if (GAS.acc >= 3) { GAS.acc -= 3; hurtPlayer(3, inGas.x, inGas.z); }
    if (!TAC.gasWarn) { TAC.gasWarn = true; toast('催淚瓦斯！快離開煙霧'); }
  } else GAS.acc = 0;
  if (GAS.k > .01 || GAS.el) gasEl().style.opacity = GAS.k.toFixed(3);
}
// 四星以上、玩家下車：躲在原地不動 4 秒以上或躲出視線，最近的警員往人（或最後已知位置）丟一罐
function gasThrow(dt) {
  TAC.gasT -= dt;
  if (W.stars < 4 || player.mode !== 'walk' || player.where !== 'out' || life.dead) { TAC.still = 0; return; }
  if (Math.hypot(player.x - TAC.ax, player.z - TAC.az) > 3) { TAC.ax = player.x; TAC.az = player.z; TAC.still = 0; } else TAC.still += dt;
  if (TAC.gasT > 0 || !(TAC.still > 4 || !W.seen && W.lkp)) return;
  const tx = W.seen ? player.x : W.lkp.x, tz = W.seen ? player.z : W.lkp.z;
  let best = null, bd = 32;
  for (const c of W.cops) { if (!c.on || c.state !== 'act' || c.rope || c.stunT > 0) continue; const d = Math.hypot(c.x - tx, c.z - tz); if (d > 7 && d < bd) { bd = d; best = c; } }
  if (!best) return;
  TAC.gasT = 9 + Math.random() * 4;
  const t = 1.1, y0 = 1.6, dx = tx - best.x, dz = tz - best.z;
  launch('gas', best.x, y0, best.z, dx / t, (.2 - y0 + 4.9 * t * t) / t, dz / t, 'cop');
  sfx.whoosh();
  toast('特警丟催淚瓦斯');
}

// ─── 垂降直升機：四星以上第二架直升機，飛到玩家附近空曠的路口上空懸停，放下四條繩子讓特警滑下來，放完就飛走；可以打下來 ───
const ROPE_G = new T.BufferGeometry();
ROPE_G.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(8 * 3), 3));
const ropes = new T.LineSegments(ROPE_G, new T.LineBasicMaterial({ color: 0x17181b }));
ropes.frustumCulled = false; ropes.visible = false; scene.add(ropes);
const ROPE_AT = [[1.15, .55], [-1.15, .55], [1.15, -.45], [-1.15, -.45]];   // 兩側艙門的掛點（機身座標 x, z）
function rapAnchor(h, i) { const [ox, oz] = ROPE_AT[i % 4], c = Math.cos(h.yaw), s = Math.sin(h.yaw); return [h.x + ox * c + oz * s, h.z - ox * s + oz * c]; }
function rapSpot() {
  // 玩家 18–55 m 內、上方最空曠（屋頂最低）的路口
  let best = null, bs = 1e9;
  for (const n of RN.nodes) {
    const d = Math.hypot(n.x - pX(), n.z - pZ());
    if (d < 18 || d > 55) continue;
    const sc = roofAt(n.x, n.z, 1) + Math.abs(d - 30) * .2;
    if (sc < bs) { bs = sc; best = n; }
  }
  return best;
}
function spawnRap() {
  const D = rapSpot();
  if (!D) return null;
  const a = Math.atan2(D.x - pX(), D.z - pZ()) + (Math.random() - .5), g = new T.Group();
  const body = partMesh('heli', 1, true), rotor = partMesh('heli_rotor', 1, true), tail = partMesh('heli_tail', 1, true);
  for (const m of [body, rotor, tail]) { scene.remove(m); g.add(m); m.count = 1; }
  rotor.material = tail.material = body.material;
  scene.add(g);
  const hy = Math.max(groundH(D.x, D.z) + 18, roofAt(D.x, D.z, 1) + 8);
  TAC.rap = { g, body, rotor, tail, x: D.x + Math.sin(a) * 170, z: D.z + Math.cos(a) * 170, y: 60, vx: 0, vz: 0, yaw: a + Math.PI, rot: 0, hp: 1200, dx: D.x, dz: D.z, hy, st: 'in', dropT: 0, n: 0, men: [], doneT: 0, fall: null, mine: false };
  return TAC.rap;
}
function dropRap() {
  const h = TAC.rap; if (!h) return;
  scene.remove(h.g);
  for (const m of [h.body, h.rotor, h.tail]) m.geometry.dispose();
  h.body.material.dispose();
  for (const c of h.men) if (c.rope) c.rope.cut = true;
  TAC.rap = null; ropes.visible = false;
}
function rapHit(dmg, mine) {
  const h = TAC.rap; if (!h || h.fall) return;
  h.hp -= dmg;
  if (mine) crime('resist', h.x, h.z);
  if (h.hp <= 0) {
    h.fall = { vy: 0, spin: 2.5 + Math.random() * 2 }; h.mine = mine;
    for (const c of h.men) if (c.rope) c.rope.cut = true;   // 繩子斷了：還在半空的特警直接摔下來
    sparks(h.x, h.y + 1, h.z, 20, 6); fxLights.push({ x: h.x, y: h.y, z: h.z, col: COL.boom, r: 30, i: 6, life: 0, max: .5 });
  }
}
function rapBlast(x, y, z, r, dmg, mine) {
  const h = TAC.rap; if (!h) return;
  const d = Math.hypot(h.x - x, h.y + 1 - y, h.z - z);
  if (d < r + 2) rapHit(dmg * clamp(1 - d / (r + 2), .3, 1), mine);
}
rayHooks.push((R, hit) => { const h = TAC.rap; if (h && !h.fall) hit(rayCyl(R, h.x, h.z, 2.6, h.y - .4, h.y + 3), 'rap', h); });
// 一名特警沿第 i 條繩子滑下（69-police.js 的 spawnCop 借一台不存在的「車」把人放在掛點正下方）
function rapMan(h, i) {
  const [x, z] = rapAnchor(h, i);
  const c = spawnCop({ v: { x, z, yaw: h.yaw, w: -1.4 } }, 1, true);
  if (!c) return null;
  c.unit = null; c.x = x; c.z = z; c.y = h.y - 1.9; c.rope = { i, vy: -4.5, cut: false };
  h.men.push(c);
  return c;
}
function ropeStep(c, dt) {
  const r = c.rope, h = TAC.rap, gy = groundH(c.x, c.z) > 0 ? .15 : 0;
  const hold = h && !h.fall && !r.cut && c.state !== 'down';
  if (hold) { [c.x, c.z] = rapAnchor(h, r.i); r.vy = -4.5; }
  else r.vy -= 9.8 * dt;
  c.y += r.vy * dt;
  if (c.y <= gy) {
    const hard = r.vy < -9;
    c.y = 0; c.rope = null;
    if (hard && c.state !== 'down') copHit(c, 999, 0, 1, false);
    return;
  }
  copsCrowd.anim(c.k, c.state === 'down' ? ANIM.die : ANIM.handsUp, c.state === 'down' ? -uTimeNow() : 0, 1);   // 舉起雙手握著頭上的繩子
  copsCrowd.place(c.k, c.x, c.y, c.z, c.yaw);
}
function rapStep(dt) {
  TAC.rapT -= dt;
  if (!TAC.rap) {
    if (W.stars >= 4 && TAC.rapT <= 0 && player.where === 'out' && !life.dead && W.cops.filter(c => !c.on).length >= 4) { TAC.rapT = 50; if (spawnRap()) { TAC.rapN++; toast('第二架直升機載著特警飛過來了'); } }
    if (W.stars < 4) TAC.rapT = Math.max(TAC.rapT, 10);
    return;
  }
  const h = TAC.rap;
  h.rot += dt * (h.fall ? 20 : 34);
  if (h.fall) {
    h.fall.vy -= 9.8 * dt; h.y += h.fall.vy * dt; h.yaw += h.fall.spin * dt;
    h.x += h.vx * dt; h.z += h.vz * dt;
    if (Math.random() < dt * 30) emit('dark', h.x, h.y + 1, h.z, { vy: 1.5, max: 2.5, s0: .8, s1: 3, a: .8, c: [.05, .045, .04] });
    if (h.y <= Math.max(groundH(h.x, h.z), roofAt(h.x, h.z, 0))) {
      blast(h.x, h.y, h.z, 10, 520, h.mine ? 'player' : null, null);
      if (h.mine) crime('heli', h.x, h.z);
      dropRap(); return;
    }
  } else {
    if (h.st !== 'out' && (W.stars < 3 || life.dead)) h.st = 'out';
    let gx = h.dx, gz = h.dz, alt;
    const far = Math.hypot(h.dx - h.x, h.dz - h.z);
    if (h.st === 'out') { gx = h.x + (h.x - pX()) * 2; gz = h.z + (h.z - pZ()) * 2; alt = 70; }
    else alt = far > 40 ? Math.max(45, roofAt(h.x + h.vx * 3, h.z + h.vz * 3, 1) + 14) : h.hy;
    const dx = gx - h.x, dz = gz - h.z, d = Math.hypot(dx, dz) || 1, vm = h.st === 'out' ? 26 : Math.min(26, d * .7);
    h.vx = damp(h.vx, dx / d * vm, 1.4, dt); h.vz = damp(h.vz, dz / d * vm, 1.4, dt);
    h.x += h.vx * dt; h.z += h.vz * dt;
    h.y = damp(h.y, alt, alt > h.y ? 1.6 : .9, dt);
    const look = h.st === 'out' ? Math.atan2(h.vx, h.vz) : Math.atan2(pX() - h.x, pZ() - h.z);
    h.yaw += wrapA(look - h.yaw) * (1 - Math.exp(-1.5 * dt));
    if (h.st === 'in' && far < 3 && Math.abs(h.y - h.hy) < 1.5) { h.st = 'hover'; toast('特警垂降！'); }
    if (h.st === 'hover') {
      h.dropT -= dt;
      if (h.n < 4 && h.dropT <= 0) { h.dropT = .8; if (rapMan(h, h.n)) h.n++; else h.n = 4; }
      if (h.n >= 4 && !h.men.some(c => c.rope)) { h.doneT += dt; if (h.doneT > 1.5) h.st = 'out'; }
    }
    if (h.st === 'out' && Math.hypot(h.x - pX(), h.z - pZ()) > 250) { dropRap(); return; }
  }
  // 擺模型（和 69-police.js 的 heliStep 一樣）
  const c = Math.cos(h.yaw), s = Math.sin(h.yaw), tilt = clamp((h.vx * s + h.vz * c) * .012, -.18, .18);
  h.g.position.set(h.x, h.y, h.z); h.g.rotation.set(tilt, h.yaw, 0, 'YXZ');
  const set = (m, p, e) => { m.setMatrixAt(0, _pm4.compose(_pp.set(p[0], p[1], p[2]), _pq4.setFromEuler(e), _one)); m.instanceMatrix.needsUpdate = true; };
  set(h.body, [0, 0, 0], _pe4.set(0, 0, 0));
  set(h.rotor, piv('heli_rotor'), _pe4.set(0, h.rot, 0));
  set(h.tail, piv('heli_tail'), _pe4.set(h.rot * 1.6, 0, 0));
  h.body.material.uniforms.uM.value.set(1, 0, 1, h.fall ? .6 : 0);
  // 繩子：懸停放人的時候四條垂到地面
  const on = h.st === 'hover' && !h.fall;
  ropes.visible = on;
  if (on) {
    const P = ROPE_G.attributes.position;
    for (let i = 0; i < 4; i++) { const [x, z] = rapAnchor(h, i); P.setXYZ(i * 2, x, h.y - .2, z); P.setXYZ(i * 2 + 1, x, groundH(x, z), z); }
    P.needsUpdate = true;
  }
}

// ─── 榴彈發射器（69-combat.js 的 shoot 交給這裡）：對準準星的落點算拋物線，初速約 34 m/s，碰到東西就炸 ───
function lobShot(R0, A) {
  const hit = castRay(R0, A.range), t = hit.kind ? hit.t : A.range;
  const tx = R0.ox + R0.dx * t, ty = R0.oy + R0.dy * t, tz = R0.oz + R0.dz * t;
  const dx = tx - _mz.x, dy = ty - _mz.y, dz = tz - _mz.z, T0 = Math.max(.12, Math.hypot(dx, dz) / 34);
  launch('gl', _mz.x, _mz.y, _mz.z, dx / T0, (dy + 4.9 * T0 * T0) / T0, dz / T0, 'player');
  sfx.launch();
}

function tacticsUpdate(dt) {
  pitStep(dt);
  gasThrow(dt);
  gasStep(dt);
  rapStep(dt);
  gunshipStep(dt);   // 69-gunship.js
}
const tacticsApi = {
  TAC, GAS, PIT_V,
  pitAim: u => pitAim(u), units: () => W.units,
  gas: (x = player.x, z = player.z, by = 'cop') => gasCloud(x, z, by),
  rap: () => spawnRap(), rapState: () => TAC.rap && { st: TAC.rap.st, x: TAC.rap.x, y: TAC.rap.y, z: TAC.rap.z, hy: TAC.rap.hy, n: TAC.rap.n, roping: TAC.rap.men.filter(c => c.rope).length, landed: TAC.rap.men.filter(c => !c.rope && c.on).length, hp: TAC.rap.hp },
  rapHit: n => rapHit(n, true),
  cops: () => W.cops.filter(c => c.on).map(c => ({ x: c.x, z: c.z, y: c.y || 0, rope: !!c.rope, stun: c.stunT || 0, state: c.state, swat: c.swat })),
};
gtaApi.tac = tacticsApi;
