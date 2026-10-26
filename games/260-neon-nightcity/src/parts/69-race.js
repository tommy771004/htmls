// ═══ 第五階段：街頭賽（三條賽道，開車到起點的霓虹圈按 E 報名） ═══
// 賽道是路網路口（大道 i、街 j；在片的邊界上的路口取第一個有這個路口的片）連成的檢查點，路線用 69-gps.js 的 routeTo 接起來（世界座標，換區、轉城都照算）。
// 三名對手是獨立載具（buildVeh，kind 'race'），沿路線折線開：前視點跟著速度拉長，前方路線轉得越急就越早煞車；
// 落後太多會稍微加速、領先太多會放慢（橡皮筋），卡住先倒車，再不行就趁玩家看不到時放回路線上。
// 玩家只要依序穿過檢查點（不必照路線走），第一名拿獎金、第二名拿四成、第三名退報名費；第一次贏某條賽道多五成。最佳成績存在 motors.side.race。
// 下車超過 10 秒、車毀、離下一個檢查點 450 m 以上、陣亡或被捕：棄權。
// 排在 69-police 之後、69-safehouse 之前：只有函式與常數。

const RACE_COL = 0xff3fd2, RACE_HEX = '#ff3fd2', RACE_FIN = 0x3ff2e0;
const RACES = [
  { id: 'neon', name: '霓虹環線', en: 'NEON LOOP', laps: 2, fee: 1000, prize: 6000, nodes: [[1, 1], [3, 1], [6, 1], [6, 3], [6, 5], [4, 5], [1, 5], [1, 3]], loop: true,
    desc: '舊碼頭與霓虹區外圈繞兩圈，四個直角彎。' },
  { id: 'halo', name: '光環衝刺', en: 'HALO SPRINT', laps: 1, fee: 2000, prize: 12000, nodes: [[9, 1], [12, 1], [12, 4], [15, 4], [15, 1], [18, 1], [18, 6], [13, 6], [10, 6]],
    desc: '光環廣場到灰石國宅的單程衝刺，連續 S 彎。' },
  { id: 'south', name: '南岸長征', en: 'SOUTH RUN', laps: 1, fee: 3000, prize: 18000, nodes: [[1, 8], [7, 8], [7, 11], [12, 11], [12, 8], [17, 8], [17, 13], [10, 13], [4, 13]],
    desc: '楓林里穿過公園大道、琥珀工業區，再沿南岸回到珊瑚灘。最長的一條。' },
];
const RIVALS = [['tiara', 'Vex', 9], ['evo190', 'Rin', 3], ['e34', 'Dante', 6]];
// 檢查點與路線（世界座標；第一次用到才算，?zrot 之後一樣對）
function raceGeo(R) {
  if (R.geo) return R.geo;
  const N = R.nodes.map(([i, j]) => { const n = ZONES.map(zn => rnAt(zn, i, j)).find(Boolean); return [n.x, n.z]; });
  const cps = [];
  for (let lap = 0; lap < R.laps; lap++) { for (let k = 1; k < N.length; k++) cps.push(N[k]); if (R.loop) cps.push(N[0]); }
  // 路線：起點接到每個檢查點，去掉重複的點
  const pts = [N[0]], cpS = [];
  let at = N[0];
  for (const c of cps) {
    for (const q of routeTo(at[0], at[1], c[0], c[1]).slice(1)) { const l = pts[pts.length - 1]; if (Math.hypot(q[0] - l[0], q[1] - l[1]) > .5) pts.push([q[0], q[1]]); }
    at = c;
  }
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  // 每個檢查點在路線上的里程：從上一個開始往後找最近的折點
  let k0 = 0;
  for (const c of cps) { let bk = k0, bd = 1e9; for (let k = k0; k < pts.length; k++) { const d = Math.hypot(pts[k][0] - c[0], pts[k][1] - c[1]); if (d < bd) { bd = d; bk = k; } if (d > bd + 120) break; } cpS.push(cum[bk]); k0 = bk + 1; }
  return (R.geo = { start: N[0], cps, pts, cum, cpS, len: cum.at(-1) });
}
// 路線上里程 s 的位置與方向
function polyAt(G, s, hint = 0) {
  const { pts, cum } = G;
  s = clamp(s, 0, G.len);
  let k = Math.max(1, hint);
  while (k > 1 && cum[k - 1] > s) k--;
  while (k < pts.length - 1 && cum[k] < s) k++;
  const a = pts[k - 1], b = pts[k], L = cum[k] - cum[k - 1] || 1, t = (s - cum[k - 1]) / L, dx = (b[0] - a[0]) / L, dz = (b[1] - a[1]) / L;
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx, dz, k };
}
// 把 (x, z) 投影到路線上（從 hint 前後幾段找）：回傳里程與離路線的距離
function polyProj(G, x, z, hint) {
  const { pts, cum } = G;
  let best = { s: 0, d: 1e9, k: hint };
  for (let k = Math.max(1, hint - 2); k < Math.min(pts.length, hint + 6); k++) {
    const [ax, az] = pts[k - 1], [bx, bz] = pts[k], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best.d) best = { s: cum[k - 1] + Math.sqrt(L2) * t, d, k };
  }
  return best;
}

const race = { rings: null, starts: null, startT: 0 };
// 起點的霓虹圈與報名提示（沒在比賽時，離起點 300 m 內才畫）
function raceIdle(dt) {
  if (!race.starts) race.starts = RACES.map(() => neonRing(RACE_FIN, 5.5));
  const busy = side.act && side.act.kind === 'race', out = player.where === 'out';
  RACES.forEach((R, i) => {
    const m = race.starts[i];
    if (busy || !out || Math.hypot(raceGeo(R).start[0] - pX(), raceGeo(R).start[1] - pZ()) > 300) { m.visible = false; return; }
    const G = raceGeo(R), a = G.pts[0], b = G.pts[Math.min(2, G.pts.length - 1)];
    ringAt(m, a[0], a[1], b[0] - a[0], b[1] - a[1]);
    m.material.opacity = .45 + .25 * Math.sin(uTimeNow() * 3 + i);
  });
}
ctxHooks.push(p => {
  if (p.mode !== 'drive' || p.where !== 'out' || side.act) return null;
  const v = p.veh;
  for (const R of RACES) {
    const s = raceGeo(R).start;
    if (Math.hypot(v.x - s[0], v.z - s[1]) < 11 && Math.hypot(v.vx, v.vz) < 6) return { key: 'E', text: `街頭賽 <i>· ${R.name}</i>`, fn: () => raceBoard(R) };
  }
  return null;
});
function raceBoard(R) {
  const best = motors.side.race[R.id], won = motors.side.win.includes(R.id), G = raceGeo(R);
  const why = sideBusy();
  if (why) return dialog(`街頭賽 · ${R.name}`, `${why}。`);
  dialog(`街頭賽 · ${R.name} ${R.en}`, `${R.desc}\n全長 ${(G.len / 1000).toFixed(1)} 公里、${G.cps.length} 個檢查點${R.laps > 1 ? `、${R.laps} 圈` : ''}，三名對手。報名費 ${money(R.fee)}，第一名 ${money(R.prize)}${won ? '' : '（第一次贏多五成）'}。\n最佳成績：${best ? fmtT(best) : '還沒有'}`, [
    { t: `報名（${money(R.fee)}）`, fn: () => { closeDialog(); raceStart(R); } },
    { t: '算了', fn: closeDialog },
  ]);
}
// 起跑格：路線第一段往前 16 m、26 m，左右車道各一台；玩家在右後
function gridSpot(G, n) {
  const p = polyAt(G, 26 - Math.floor(n / 2) * 10), side_ = n % 2 ? 1 : -1, rx = -p.dz, rz = p.dx;
  return { x: p.x + rx * LANE * side_, z: p.z + rz * LANE * side_, yaw: Math.atan2(p.dx, p.dz) };
}
function raceStart(R) {
  const why = sideBusy();
  if (why) { toast(why); return false; }
  const v = player.veh;
  if (!v || player.mode !== 'drive') { toast('要開車才能報名'); return false; }
  if (motors.cash < R.fee) { toast(`報名費不夠，還差 ${money(R.fee - motors.cash)}`); return false; }
  motors.cash -= R.fee; saveMotors();
  const G = raceGeo(R);
  // 玩家的車擺到右後格
  const me = gridSpot(G, 3);
  stuntReset(v);
  v.x = me.x; v.z = me.z; v.yaw = me.yaw; v.vx = v.vz = v.yr = v.steer = 0; v.y = spawnY(v.x, v.z); poseVehicle(v);
  const base = clamp((v.vmax || 50) * .93, 30, 70);
  const rivals = RIVALS.map(([type, name, pal], i) => {
    const sp = gridSpot(G, i), c = buildVeh(type, sp.x, sp.z, sp.yaw, 0, Math.random(), pal, 'race');
    c.name = `${name} 的 ${TYPE_NAME[type]}`; c.y = groundH(c.x, c.z); c.ai = true; c.vmax = base * (1 - i * .025); c.eng = 13 + (2 - i) * .6; c.grip = 8.6; c.mass = 1500;
    poseVehicle(c);
    return { v: c, name, base: c.vmax, s: polyProj(G, c.x, c.z, 1).s, k: 1, lane: (i - 1) * 1.4, stuck: 0, rev: 0, lost: 0, fin: 0 };
  });
  if (!race.rings) race.rings = [neonRing(RACE_COL, 6), neonRing(RACE_COL, 6)];
  const act = {
    kind: 'race', name: '街頭賽', label: `街頭賽 <i>· ${R.name}</i>`, R, G, rivals, st: 'count', t: 3.6, time: 0, cp: 0, out: 0, place: 4, order: [], beep: 4,
    step: dt => raceStep(act, dt), hud: () => raceHud(act), mark: () => raceMark(act), fail: why => raceFail(act, why), clear: () => raceClear(act),
  };
  sideStart(act);
  toast(`${R.name}：倒數開始`);
  return true;
}
function raceProg(a) {   // 玩家的里程：下一個檢查點的里程減掉直線距離
  const c = a.G.cps[a.cp];
  return c ? a.G.cpS[a.cp] - Math.hypot(c[0] - pX(), c[1] - pZ()) : a.G.len + 1e3 - a.order.indexOf('me');
}
function raceStep(a, dt) {
  const v = player.veh, G = a.G;
  if (a.st === 'count') {
    a.t -= dt;
    const n = Math.ceil(a.t);
    if (n !== a.beep && n <= 3) { a.beep = n; if (n > 0) { sfx.beep(); toast(String(n)); } }
    // 倒數時車子停在起跑格（可以踩油門暖胎，不會動）
    if (v) { const me = gridSpot(G, 3); v.x = me.x; v.z = me.z; v.vx = v.vz = 0; }
    for (const r of a.rivals) { r.v.vx = r.v.vz = 0; driveVehicle(r.v, { thr: 0, brk: 1, steer: 0, hb: false }, dt); }
    if (a.t <= 0) { a.st = 'go'; sfx.horn && sfx.horn(); toast('GO！'); }
    return;
  }
  a.time += dt;
  // 玩家：依序穿過檢查點
  const c = G.cps[a.cp];
  if (c && Math.hypot(c[0] - pX(), c[1] - pZ()) < 13) {
    a.cp++; sfx.pickup();
    if (a.cp >= G.cps.length) { a.order.push('me'); return raceFinish(a); }
  }
  // 棄權條件
  if (player.mode !== 'drive' || !v) { a.out += dt; if (a.out > 10) return raceFail(a, '下車太久'); } else a.out = 0;
  if (v && v.dead) return raceFail(a, '車毀了');
  if (c && Math.hypot(c[0] - pX(), c[1] - pZ()) > 450) return raceFail(a, '離賽道太遠');
  const pp = raceProg(a);
  for (const r of a.rivals) rivalStep(a, r, pp, dt);
  if (a.rivals.every(r => r.fin)) { a.late = (a.late || 0) + dt; if (a.late > 90) return raceFail(a, '對手都到終點 90 秒了'); }
  // 名次：跑完的照順序，其他照里程
  const prog = [{ id: 'me', p: raceProg(a) }, ...a.rivals.map(r => ({ id: r.name, p: r.fin ? G.len + 1e3 - a.order.indexOf(r.name) : r.s }))];
  prog.sort((x, y) => y.p - x.p);
  a.place = prog.findIndex(o => o.id === 'me') + 1;
}
function rivalStep(a, r, pp, dt) {
  const v = r.v, G = a.G;
  if (v.dead || player.veh === v) { r.fin = r.fin || -1; return; }
  if (r.fin) { driveVehicle(v, { thr: 0, brk: .6, steer: 0, hb: false }, dt); return; }
  const pr = polyProj(G, v.x, v.z, r.k);
  if (pr.d < 30) { r.s = Math.max(r.s, pr.s); r.k = pr.k; }
  if (r.s >= G.len - 8) { r.fin = 1; a.order.push(r.name); return; }
  // 橡皮筋：落後玩家 250 m 以上最多快兩成，領先 250 m 以上最多慢一成五
  v.vmax = r.base * (1 + clamp((pp - r.s) / 1250, -.15, .2));
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), vF = v.vx * fx + v.vz * fz, sp = Math.max(0, vF);
  // 閃避：前方 6 m＋1.2 秒內、左右 2.4 m 內有車流、路邊車、玩家或其他對手，就往空的那一側偏一個車道；太近就踩煞車
  const look = 6 + sp * 1.2;
  let blk = 1e9, side = 0;
  const test = (x, z, w) => {
    const dx = x - v.x, dz = z - v.z, f = dx * fx + dz * fz;
    if (f < 1 || f > look || f > blk) return;
    const l = dx * -fz + dz * fx;
    if (Math.abs(l) < 2.4 + w) { blk = f; side = l > 0 ? -1 : 1; }
  };
  for (const t of traffic) test(t.x, t.z, 0);
  for (const p of parked) test(p.x, p.z, -.6);
  for (const o of a.rivals) if (o !== r && !o.v.dead) test(o.v.x, o.v.z, 0);
  if (player.where === 'out') test(pX(), pZ(), player.mode === 'drive' ? 0 : -1);
  r.dg = damp(r.dg || 0, blk < look ? side * 3.4 : 0, 3, dt);
  const T = polyAt(G, r.s + 7 + sp * .42, r.k), rx = -T.dz, rz = T.dx;
  const tx = T.x + rx * (r.lane + r.dg), tz = T.z + rz * (r.lane + r.dg);
  const da = wrapA(Math.atan2(tx - v.x, tz - v.z) - v.yaw);
  // 前方路線轉多急：比較現在與 15 m＋1.6 秒後的方向
  const A = polyAt(G, r.s + 4, r.k), B = polyAt(G, r.s + 15 + sp * 1.6, r.k), turn = Math.abs(wrapA(Math.atan2(B.dx, B.dz) - Math.atan2(A.dx, A.dz)));
  const want = turn > 1.2 ? 12 : turn > .7 ? 16 : turn > .35 ? 23 : v.vmax;
  let thr = 1, brk = 0, steer = clamp(da * 2.2, -1, 1);
  if (vF > want + 1) { thr = 0; brk = clamp((vF - want) / 6, .3, 1); }
  if (blk < 3 + sp * .3) { thr = 0; brk = Math.max(brk, .7); }
  if (r.rev > 0) { r.rev -= dt; thr = 0; brk = 1; steer = -(Math.sign(da) || 1); }
  else if (Math.abs(vF) < 1.5) { r.stuck += dt; if (r.stuck > 1.6) { r.rev = 1.1; r.stuck = 0; r.lost++; } }
  else { r.stuck = 0; if (vF > 8) r.lost = 0; }
  // 一直卡住或離路線太遠：玩家看不到時放回路線上
  if ((r.lost > 2 || pr.d > 40) && !onScreen(v.x, v.z)) {
    const p = polyAt(G, r.s, r.k);
    v.x = p.x; v.z = p.z; v.yaw = Math.atan2(p.dx, p.dz); v.vx = p.dx * 8; v.vz = p.dz * 8; v.y = spawnY(v.x, v.z); r.lost = 0; r.rev = 0;
  }
  aiDrive(v, { thr, brk, steer, hb: false }, dt);   // 69-v3-world.js：雨天照濕路面的抓地力
  v.lights = 1;
}
const _rs = V3();
function onScreen(x, z) {
  _rs.set(x, 1, z).project(camera);
  return _rs.z < 1 && Math.abs(_rs.x) < 1.1 && Math.abs(_rs.y) < 1.1 && Math.hypot(x - camera.position.x, z - camera.position.z) < 250;
}
function raceFinish(a) {
  const R = a.R, place = a.order.indexOf('me') + 1, t = a.time, S = motors.side;
  const best = S.race[R.id], rec = !best || t < best, first = place === 1 && !S.win.includes(R.id);
  if (rec) S.race[R.id] = Math.round(t * 10) / 10;
  if (place === 1 && first) S.win.push(R.id);
  const pay = (place === 1 ? R.prize * (first ? 1.5 : 1) : place === 2 ? R.prize * .4 : place === 3 ? R.fee : 0) * storyRaceK();   // 69-w2-ch3.js：3-5 的 MV 上片之後 ×1.2
  sideEnd();
  if (pay) motors.cash += Math.round(pay); saveMotors();
  sideDone(place === 1 ? 'RACE WON' : 'FINISHED', `街頭賽 · ${R.name}`, [['名次', `第 ${place} 名 / 4`], ['時間', fmtT(t) + (rec ? '（新紀錄）' : '')], ['最佳成績', fmtT(S.race[R.id])], ['獎金', money(pay) + (first ? '（首勝加成）' : '')]], 3);
  sfx.ability(place === 1);
}
function raceFail(a, why) {
  sideEnd();
  toast(`街頭賽棄權：${why}`);
}
function raceClear(a) {
  for (const m of race.rings || []) m.visible = false;
  for (const r of a.rivals) {
    const v = r.v;
    v.ai = false;
    if (player.veh === v) { jacked.push(v); continue; }
    const i = vehicles.indexOf(v); if (i >= 0) vehicles.splice(i, 1);
    scene.remove(v.g); v.g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  }
}
// 下兩個檢查點的霓虹圈（最後一個是青色的終點）
function raceRings(a) {
  const G = a.G;
  race.rings.forEach((m, i) => {
    const k = a.cp + i, c = G.cps[k];
    if (!c || a.st === 'count' && i) { m.visible = false; return; }
    const p = polyAt(G, G.cpS[k]);
    ringAt(m, c[0], c[1], p.dx, p.dz);
    m.material.color.setHex(k === G.cps.length - 1 ? RACE_FIN : RACE_COL);
    m.material.opacity = i ? .35 : .9;
  });
}
function raceHud(a) {
  raceRings(a);
  const G = a.G, n = G.cps.length;
  if (a.st === 'count') return { text: `準備起跑：${Math.max(1, Math.ceil(a.t))}`, bar: -1, num: `報名費 ${money(a.R.fee)}` };
  const lap = a.R.laps > 1 ? ` · 第 ${Math.min(a.R.laps, Math.floor(a.cp / (n / a.R.laps)) + 1)}/${a.R.laps} 圈` : '';
  return { text: `檢查點 ${a.cp + 1}/${n}${lap}`, bar: 100 * clamp(raceProg(a) / G.len, 0, 1), num: `第 ${a.place}/4 名 · ${fmtT(a.time)}`, low: a.out > 0 };
}
function raceMark(a) { const c = a.G.cps[a.cp]; return c ? { name: a.cp === a.G.cps.length - 1 ? '終點' : '檢查點', x: c[0], y: 4, z: c[1], where: 'out' } : null; }
function raceMini(ctx, P2, zoom) {
  const a = side.act;
  if (!a || a.kind !== 'race') return;
  ctx.fillStyle = RACE_HEX;
  for (const r of a.rivals) if (!r.v.dead && player.veh !== r.v) { const [x, y] = P2(r.v.x, r.v.z); ctx.beginPath(); ctx.arc(x, y, 5 / zoom * 1.4, 0, 7); ctx.fill(); }
  const c = a.G.cps[a.cp + 1];
  if (c) { const [x, y] = P2(c[0], c[1]); ctx.strokeStyle = RACE_HEX; ctx.lineWidth = 2 / zoom; ctx.beginPath(); ctx.arc(x, y, 7 / zoom * 1.4, 0, 7); ctx.stroke(); }
}
// 大地圖的地點：三條賽道的起點
function raceBlips(add) {
  for (const R of RACES) {
    const G = raceGeo(R), best = motors.side.race[R.id], won = motors.side.win.includes(R.id);
    add('race', { name: `街頭賽 · ${R.name}`, txt: '賽', x: G.start[0], z: G.start[1], type: '街頭賽', rows: [['全長', `${(G.len / 1000).toFixed(1)} km${R.laps > 1 ? ` × ${R.laps} 圈` : ''}`], ['報名費', money(R.fee)], ['第一名', money(R.prize)], ['最佳成績', best ? fmtT(best) : '—'], ['狀態', won ? '贏過' : '還沒贏']], desc: `${R.desc}開車停進起點的霓虹圈按 E 報名。` });
  }
}
// 大地圖：比賽中畫整條路線
function raceBig(c, X, Z, s) {
  const a = side.act;
  if (!a || a.kind !== 'race') return;
  strokeRoute(c, a.G.pts, (x, z) => [X(x), Z(z)], 'rgba(255,63,210,.55)', 4 / s);
}

// 測試 API（window.__nc.gta.race）
const raceApi = {
  RACES, geo: id => raceGeo(RACES.find(R => R.id === id)), start: id => raceStart(RACES.find(R => R.id === id)),
  act: () => side.act && side.act.kind === 'race' ? side.act : null,
  // 直接通過下一個檢查點（把玩家的車放到檢查點上）
  skip() { const a = raceApi.act(); if (!a || !player.veh) return; const c = a.G.cps[a.cp], v = player.veh; v.x = c[0]; v.z = c[1]; v.vx = v.vz = 0; },
};
