// ═══ 第五階段：街頭隨機事件（搶包賊、赤蠍幫交易、懸賞逃犯車），和運鈔車共用 69-events.js 的排程 ═══
// 沒被通緝、在戶外、沒在進行支線活動時，每 2–3.5 分鐘挑一件（權重：運鈔車 3、搶包賊 3、交易 2、逃犯車 2），同一時間只有一件（ev.cur）。
//   搶包賊：路人被搶，搶包賊（戰鬥員池的 thief 隊，不開槍）沿路網往遠離你的方向跑，十秒後開始變慢。
//          打倒（拳腳、開槍或開車撞）就掉包：還給失主拿謝禮，或自己留著（錢多、但算搶劫）。比剛出現時再遠 70 m 或一分鐘就跑掉了。
//   赤蠍幫交易：四個赤蠍幫成員在路邊車旁交易（calm，站著聊天），箱子放在車尾。被看到、有人中槍或附近有槍聲就整群開打。
//          撿到箱子給錢；走遠 350 m 就散了。
//   懸賞逃犯車：第九分局懸賞的逃犯開跑車往遠離你的方向逃。炸毀或打到熄火後走到車旁逮捕都給懸賞；
//          逃犯車附近的槍聲與爆炸不算你的罪（69-police.js 的 crime 問 evBountyNear）。跑出 400 m 或四分鐘就失敗。
// 排在 69-squads 之後、69-stunt 之前：fSpawn、fNav、wakeGroup 用的東西都已經宣告。

const ST = { bounty: 'bounty', thief: 'thief', deal: 'deal' };
const EV_W = [['truck', 3], ['thief', 3], ['deal', 2], ['bounty', 2]];
// 69-events.js 的排程到時間就問這裡：挑一件、生不出來回傳 false（20 秒後再試）
function evPick(force) {
  let k = force;
  if (!k) {
    let r = Math.random() * EV_W.reduce((s, w) => s + w[1], 0);
    for (const [n, w] of EV_W) if ((r -= w) < 0) { k = n; break; }
    if (k === 'deal' && turfMine()) k = 'thief';   // 69-turf.js：搶下來的地盤沒有幫派交易
  }
  if (k === 'truck') return truckSpawn();
  return streetSpawn(k || 'thief');
}
function streetSpawn(kind) {
  if (ev.cur || ev.truck) return false;
  const e = kind === 'thief' ? thiefSpawn() : kind === 'deal' ? dealSpawn() : kind === 'bounty' ? bountySpawn() : null;
  if (!e) return false;
  ev.cur = e; e.t = 0;
  return true;
}
// 結束（msg 是要顯示的提示），收掉場上的東西；下一件 2–3.5 分鐘後
function streetEnd(msg) {
  const e = ev.cur;
  if (!e) return;
  ev.cur = null;
  turfFree(e);   // 69-turf.js：還站著的收掉，倒地的留著
  if (e.bag) scene.remove(e.bag.m);
  if (e.v) e.v.ai = false;
  if (e.v && !e.v.dead && player.veh !== e.v) dropVeh(e.v);
  else if (e.v && player.veh === e.v) jacked.push(e.v);
  ev.t = 120 + Math.random() * 90;
  if (msg) toast(msg);
}
function dropVeh(v) {
  v.ai = false;
  const i = vehicles.indexOf(v); if (i >= 0) vehicles.splice(i, 1);
  scene.remove(v.g); v.g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
}
// 往遠離玩家的方向挑一個路口（dMin–dMax 公尺外，而且比現在離玩家更遠）
function fleeNode(x, z, dMin, dMax) {
  const d0 = Math.hypot(x - pX(), z - pZ()), c = [];
  for (const n of RN.nodes) {
    const d = Math.hypot(n.x - x, n.z - z);
    if (d > dMin && d < dMax && Math.hypot(n.x - pX(), n.z - pZ()) > d0 + d * .5) c.push(n);
  }
  const n = c.length ? c[Math.floor(Math.random() * c.length)] : RN.nodes[Math.floor(Math.random() * RN.nodes.length)];
  return [n.x, n.z];
}
function wakeGroup(g) {
  if (!g || g.awake) return;
  g.awake = true;
  for (const f of SQ.f) if (f.on && f.grp === g) { f.calm = false; f.tgtT = 0; }
  if (g.kind === 'deal') toast(`${GANG_NAME}發現你了`);
  else if (g.kind === 'lurk') toast(`${GANG_NAME}盯梢的人動手了`);
}
let caseGeo = null;
function lootMesh(x, z, kind) {
  if (kind === 'bag') { const m = bagMesh(x, z); m.scale.setScalar(.6); return { x, z, m }; }   // 69-events.js 的錢袋縮小
  if (!caseGeo) { const k = new Kit(); k.box(0, .2, 0, .5, .36, .12, 0x1c1d22, 4); k.box(0, .41, 0, .16, .04, .04, 0x8a8f98, 10); caseGeo = k.build(); }
  const m = new T.Mesh(caseGeo, MAT.uber);
  m.position.set(x, groundH(x, z), z); m.rotation.y = Math.random() * 6.3; scene.add(m);
  return { x, z, m };
}

// ─── 搶包賊 ───
function thiefSpawn() {
  // 離你最近（15–90 m）、還站著的路人當失主，搶包賊從他身邊跑出來
  let best = -1, bd = 90;
  for (let k = 0; k < PED_N; k++) {
    const ps = pedState[k], p = peds.people[k];
    if (ps.down > 0 || ps.fsm) continue;
    const d = Math.hypot(p.x - pX(), p.z - pZ());
    if (d > 15 && d < bd) { bd = d; best = k; }
  }
  if (best < 0) return null;
  const p = peds.people[best], e = { kind: ST.thief, ft: 0, goal: null, bag: null, f: null, far: bd + 70 };
  const f = fSpawn('thief', p.x + Math.sin(p.yaw) * 1.2, p.z + Math.cos(p.yaw) * 1.2, Math.atan2(p.x - pX(), p.z - pZ()), { gun: 'pistol' });
  if (!f) return null;
  f.grp = e; e.f = f;
  f.onDown = q => { e.bag = lootMesh(q.x, q.z, 'bag'); toast('搶包賊倒了：去撿包'); };
  panic(p.x, p.z, 14, 5);
  sfx.beep();
  toast('有人被搶了！追上搶包賊（小地圖藍點）');
  return e;
}
function thiefStep(f, dt) {
  const e = ev.cur;
  if (!e || e.f !== f) { fFree(f); return; }
  e.ft += dt;
  const sp = e.ft < 10 ? 5.3 : e.ft < 22 ? 4.3 : 3.5;
  if (!e.goal || Math.hypot(e.goal[0] - f.x, e.goal[1] - f.z) < 6) e.goal = fleeNode(f.x, f.z, 70, 180);
  const nav = fNav(f, e.goal[0], e.goal[1], dt) || e.goal;
  const dx = nav[0] - f.x, dz = nav[1] - f.z, dn = Math.hypot(dx, dz) || 1;
  f.yaw += wrapA(Math.atan2(dx, dz) - f.yaw) * (1 - Math.exp(-9 * dt));
  const r = collideCircle(f.x + Math.sin(f.yaw) * sp * dt, f.z + Math.cos(f.yaw) * sp * dt, .32, false);
  f.x = r.x; f.z = r.z;
  fighters.people[f.k].aimK = 0;
  fighters.anim(f.k, ANIM.run, f.ph += dt * sp / 4.6, 1);
  fighters.place(f.k, f.x, fGround(f), f.z, f.yaw);
}
function thiefLoot(e) {
  scene.remove(e.bag.m); e.bag = null;
  const keep = 2400 + Math.round(Math.random() * 16) * 100;
  dialog('搶回來的包', '包裡有錢包、證件和一疊現金。失主還在剛才那個路口等著。', [
    { t: '還給失主', fn: () => { closeDialog(); earn(1200, '失主的謝禮'); streetEnd('失主連聲道謝'); } },
    { t: `自己留著（$${keep.toLocaleString()}）`, fn: () => { closeDialog(); earn(keep, '包裡的現金'); crime('assault'); streetEnd(); } },
  ]);
}

// ─── 赤蠍幫交易 ───
function dealSpawn() {
  const sp = spawnSpot(120, 220);
  if (!sp) return null;
  const fx = Math.sin(sp.yaw), fz = Math.cos(sp.yaw), rx = -fz, rz = fx;   // 行車方向的右側是路邊
  const cx = sp.x + fx * 12 + rx * (PARK - LANE), cz = sp.z + fz * 12 + rz * (PARK - LANE);
  const v = buildVeh('fvan', cx, cz, sp.yaw, 0, Math.random(), 4, 'deal');
  v.y = spawnY(v.x, v.z); poseVehicle(v);
  const e = { kind: ST.deal, v, grp: null, bag: null, awake: false };
  e.grp = e;
  // 車尾放箱子，四個人圍在車尾和人行道上
  const bx = cx - fx * (v.len / 2 + 1.4), bz = cz - fz * (v.len / 2 + 1.4);
  e.bag = lootMesh(bx, bz, 'case');
  const guns = ['smg', 'pistol', 'shotgun', 'pistol'];
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + .4, x = bx + Math.sin(a) * 1.9 + rx * .8, z = bz + Math.cos(a) * 1.9 + rz * .8;
    const f = fSpawn('gang', x, z, Math.atan2(bx - x, bz - z), { gun: guns[i] });
    if (!f) break;
    f.calm = true; f.grp = e;
  }
  e.cash = 8000 + Math.round(Math.random() * 70) * 100;
  toast(`${GANG_NAME}在附近交易（小地圖藍點）`);
  return e;
}
const dealLeft = e => SQ.f.filter(f => fUp(f) && f.grp === e).length;

// ─── 懸賞逃犯車 ───
function bountySpawn() {
  const sp = spawnSpot(90, 170);
  if (!sp) return null;
  const v = buildVeh(Math.random() < .5 ? 'evo190' : 'tiara', sp.x, sp.z, sp.yaw, 10, Math.random(), 1 + Math.floor(Math.random() * 4), 'bounty');
  v.bounty = true; v.ai = true; v.y = spawnY(v.x, v.z); v.hp0 = v.hp;
  v.name = '懸賞逃犯車';
  const tk = { v, route: null, k: 1, state: 'drive', t: 0, stuck: 0, rev: 0, spd: 1.35, flee: true };
  truckRoute(tk); poseVehicle(v);
  const e = { kind: ST.bounty, v, tk, cash: 5000 + Math.round(Math.random() * 30) * 100, stall: false };
  toast(`${PD.name}懸賞：攔下逃犯車（小地圖藍點）`);
  return e;
}
// 69-police.js 的 crime 問這裡：逃犯車 80 m 內的槍聲與爆炸是在協助辦案
function evBountyNear(x, z) {
  const e = ev.cur;
  return !!(e && e.kind === ST.bounty && Math.hypot(e.v.x - x, e.v.z - z) < 80);
}
function bountyPaid(e, how) {
  earn(e.cash, `${PD.name}懸賞`);
  newsAdd('懸賞逃犯落網', `${PD.name}懸賞的逃犯在街頭被民眾攔下，警方表示感謝。`);
  sideDone('BOUNTY', `${PD.name}懸賞`, [['逃犯', how], ['懸賞', `$${e.cash.toLocaleString()}`]], 1);
  streetEnd();
}

// ─── 每幀（69-events.js 的 evUpdate 結尾呼叫） ───
function streetStep(dt) {
  const e = ev.cur;
  if (!e) return;
  e.t += dt;
  if (life.dead || crew.sw) { streetEnd(); return; }
  const walk = player.mode === 'walk' && player.where === 'out';
  if (e.kind === ST.thief) {
    const f = e.f, d = f.on ? Math.hypot(f.x - pX(), f.z - pZ()) : 0;
    if (e.bag) { if (walk && Math.hypot(player.x - e.bag.x, player.z - e.bag.z) < 1.4) thiefLoot(e); else if (e.t > 150) streetEnd(); return; }
    if (fUp(f) && (d > e.far || e.t > 60)) streetEnd('搶包賊跑掉了');
    else if (!f.on) streetEnd();
  } else if (e.kind === ST.deal) {
    const d = Math.hypot(e.v.x - pX(), e.v.z - pZ());
    if (e.bag && walk && Math.hypot(player.x - e.bag.x, player.z - e.bag.z) < 1.4) {
      scene.remove(e.bag.m); e.bag = null; earn(e.cash, `${GANG_NAME}的交易款`); wakeGroup(e);
    }
    if (!e.bag && (!dealLeft(e) || d > 150)) streetEnd(!dealLeft(e) ? `${GANG_NAME}的交易被你攪了` : '');
    else if (d > 350 || e.t > 420) streetEnd();
  } else if (e.kind === ST.bounty) {
    const v = e.v, d = Math.hypot(v.x - pX(), v.z - pZ());
    if (player.veh === v) { e.tk.state = 'taken'; bountyPaid(e, '連車帶人扣下'); return; }
    if (v.dead) { bountyPaid(e, '車毀'); return; }
    // 打到剩三成就熄火：司機投降，走到車旁 5 m 逮捕
    if (!e.stall && v.hp < v.hp0 * .3) { e.stall = true; e.tk.state = 'stop'; toast('逃犯車熄火了：走過去逮捕'); }
    if (e.tk.state === 'drive' || e.tk.state === 'stop') truckDrive(e.tk, dt);
    if (e.stall && walk && d < 5) { bountyPaid(e, '逮捕'); return; }
    if (d > 400 || e.t > 240) streetEnd('逃犯車跑掉了');
  }
}
// 小地圖與大地圖：69-events.js 的 evMini／evBig 呼叫
function streetPos(e) {
  if (e.kind === ST.thief) return e.bag || (fUp(e.f) ? e.f : null);
  if (e.kind === ST.deal) return e.bag || e.v;
  return e.v.dead ? null : e.v;
}
function streetMini(ctx, P2, zoom) {
  const e = ev.cur, q = e && streetPos(e);
  if (!q || Math.sin(uTimeNow() * 6) < -.4) return;
  const [x, y] = P2(q.x, q.z); ctx.fillStyle = EV_BLUE; ctx.beginPath(); ctx.arc(x, y, 7 / zoom, 0, 7); ctx.fill();
}
function streetBig(c, X, Z, s) {
  const e = ev.cur, q = e && streetPos(e);
  if (q) { c.fillStyle = EV_BLUE; c.beginPath(); c.arc(X(q.x), Z(q.z), 8 / s, 0, 7); c.fill(); }
}
