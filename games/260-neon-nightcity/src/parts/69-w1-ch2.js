// ═══ 主線第二章「容易的一票」（plans/260-story.md）：2-1 內線、2-2 盯車、2-3 收據、2-4 全城通緝、2-5 二樓、2-6 船長 ═══
// 任務表與步驟的寫法見 69-w0-story.js；這裡多了幾種步驟：tail 跟車（可疑值）、truck 炸運鈔車後門、drain 躲進排水道、away 逃離、chase 快艇追逐。
// 運鈔車借 69-events.js 的 ev.truck（tk.story：不掉錢袋、不自己收掉；tk.dest：開到目的地停下），快艇照 31-boats.js 的船造一艘 AI 船。
// 2-4 的五星通緝：任務標 a.noEvade 時 69-police.js 不累積脫離時間（storyNoEvade），躲進排水道才清掉。
// 排在 69-w0-story.js 之後、70-render.js 之前：post、camState、keys 只能在函式裡用。

// ─── 地點 ───
const ST_CROWN = () => taleCorner(6, 2, 1, 1);    // 冠石金融區：鐵庫保全的運鈔車出發的地方
const ST_MID = () => taleCorner(4, 3, -1, 1);     // 中城的路口
const ST_MOTEL = () => taleCorner(4, 9, 1, 1);    // 楓林里汽車旅館前的人行道
const ST_BH = boats.find(b => b.spot.where === '錨灣港') || boats[0];   // 錨灣港碼頭的灣仔快艇
const ST_SHIP = spotW({ x: ST_BH.spot.x, z: ST_BH.spot.z - 9.5, yaw: 0 });   // 船廠的碼頭邊（船在南邊的水裡）
// 離 P 大約 d 公尺的路口轉角
function stCornerAt(P, d) {
  let best = null, bd = 1e9;
  for (let i = 1; i < NX; i++) for (let j = 1; j < NZ; j++) {
    const q = taleCorner(i, j, 1, 1), e = Math.abs(Math.hypot(q.x - P.x, q.z - P.z) - d);
    if (e < bd && groundH(q.x, q.z) > 0) { bd = e; best = q; }
  }
  return best;
}
// 最近的人孔（69-v9-drain.js 的 DR.ents，世界座標）
function stHole(x, z) {
  let best = null, bd = 1e9;
  for (const e of DR.ents) if (e.kind === 'hole') { const [X, Z] = toW(e.x, e.z, e.zn), d = Math.hypot(X - x, Z - z); if (d < bd) { bd = d; best = { x: X, z: Z, name: e.name }; } }
  return best;
}
let st24 = null;
const ST_W24 = () => st24 || (st24 = (() => { const m = ST_MID(), h = stHole(m.x, m.z); return h ? stCornerAt(h, 170) : m; })());
// 路網上離 (x, z) dMin–dMax 公尺、最遠的路口
function stNode(x, z, dMin, dMax) {
  let best = null, bd = -1;
  for (const n of RN.nodes) { const d = Math.hypot(n.x - x, n.z - z); if (d > dMin && d < dMax && d > bd && !n.free) { bd = d; best = n; } }
  return best || RN.nodes[0];
}

// ─── 主線的運鈔車：69-events.js 的 ev.truck，不掉錢袋、任務結束時收掉 ───
function storyTruck(a, near, dest) {
  if (ev.cur) streetEnd();
  if (ev.truck) truckDrop(ev.truck);
  const n = stNode(near.x, near.z, 30, 70), sp = rnLaneSpot(n.x, n.z, 6);
  const v = buildVeh('shvan', sp.x, sp.z, sp.yaw, 0, Math.random(), TRUCK_PAL, 'cash');
  v.name = TRUCK_NAME; v.hp = 2600; v.mass = 3800; v.vmax = 22; v.eng = 7.5; v.y = spawnY(v.x, v.z);
  const tk = ev.truck = { v, route: null, k: 1, state: 'drive', t: 0, stuck: 0, rev: 0, cash: 0, story: 1, dest, spd: dest ? .8 : 1 };
  truckRoute(tk); poseVehicle(v);
  a.truck = tk; a.truckHp0 = v.hp;
  return tk;
}
const truckRear = tk => { const v = tk.v; return { x: v.x - Math.sin(v.yaw) * (v.len / 2 + 1.4), z: v.z - Math.cos(v.yaw) * (v.len / 2 + 1.4), yaw: v.yaw }; };
storyCleanups.push(a => { if (a.truck) { if (ev.truck === a.truck) truckDrop(a.truck); a.truck = null; } });

// ─── 霍利斯的快艇（31-boats.js 的浪刃，AI 駕駛；比灣仔慢一點，追得上） ───
function storyBoat(a, x, z, yaw) {
  const T0 = BOAT_TYPES.wavecut, mat = mkUber({ double: true }), g = new T.Group(), body = new T.Group(); g.add(body); scene.add(g);
  body.add(new T.Mesh(boatKit('wavecut').build(), mat));
  const v = { kind: 'boat', boat: true, isCar: false, type: 'wavecut', g, body, mat, wheels: [], x, z, y: SEA_Y, yaw, vx: 0, vz: 0, yr: 0, steer: 0, spin: 0, roll: 0, pitch: 0, lean: 0,
    len: T0.len, w: T0.w, h: 1.4, rad: T0.w / 2, off: T0.len * .26, vmax: 12.6, eng: T0.eng * .8, grip: 0, wb: T0.len * .6, wr: 1, name: '霍利斯的快艇', rpm: 0, gear: 1, slip: 0, lights: 1,
    seat: [0, -.5], hp: 900, mass: 1400, ai: true, ph: 0, sink: 0, wakeT: 0, stuck: 0, home: { x, z, yaw } };
  vehicles.push(v);
  if (GLB_ON) loadProps('boats').then(it => { if (!it || !it.wavecut || !vehicles.includes(v)) return; const o = propObject(it.wavecut, 0, -BOAT_DRAFT, 0); o.scale.set(Math.min(1, (v.w + .3) / it.wavecut.w), 1, 1); body.children[0].visible = false; body.add(o); }).catch(() => {});
  a.boat = v; a.boatHp0 = v.hp;
  return v;
}
function storyBoatDrop(a) {
  const v = a.boat; if (!v) return;
  a.boat = null;
  if (player.veh === v) return;
  const i = vehicles.indexOf(v); if (i >= 0) vehicles.splice(i, 1);
  scene.remove(v.g); v.body.children[0].geometry.dispose(); v.mat.dispose();   // 模型的幾何與貼圖和碼頭的船共用，不收
}
storyCleanups.push(storyBoatDrop);
// 往遠離玩家的方向開；前方太淺或有東西就換偏角（31-sea.js 的 pbStep 那一套），卡住就倒車
function storyBoatStep(v, dt, stop) {
  if (v.dead) { v.sink = Math.min(4, v.sink + dt * .12); driveBoat(v, IDLE_INP, dt); return; }
  if (stop) { driveBoat(v, { thr: 0, brk: .6, steer: 0, hb: false }, dt); return; }
  const dx = v.x - pX(), dz = v.z - pZ(), d = Math.hypot(dx, dz) || 1;
  v.wander = (v.wander || 0) + dt;
  let hd = Math.atan2(dx / d + Math.sin(v.wander * .13) * .5, dz / d + Math.cos(v.wander * .11) * .5);
  const look = 18 + Math.hypot(v.vx, v.vz) * 1.2;
  const clear = an => {
    const fx = Math.sin(an), fz = Math.cos(an);
    colY = v.y;
    let ok = true;
    for (const k of [.35, .7, 1]) {
      const x = v.x + fx * look * k, z = v.z + fz * look * k, c = collideCircle(x, z, 2.2, false);
      if (boatFloor(x, z) || boatFloor(x + fz * 2.5, z - fx * 2.5) || boatFloor(x - fz * 2.5, z + fx * 2.5) || Math.abs(c.x - x) + Math.abs(c.z - z) > .01) { ok = false; break; }
    }
    colY = 0;
    return ok;
  };
  v.detT = Math.max(0, (v.detT || 0) - dt);
  const offs = v.detT > 0 ? [v.det, 0, .45, -.45, .9, -.9, 1.4, -1.4, 2, -2, 2.8] : [0, .45, -.45, .9, -.9, 1.4, -1.4, 2, -2, 2.8];
  for (const o of offs) if (clear(hd + o)) { if (o && v.detT <= 0) { v.det = o; v.detT = 2.5; } hd += o; break; }
  const err = wrapA(hd - v.yaw), sp = v.vx * Math.sin(v.yaw) + v.vz * Math.cos(v.yaw);
  v.stuck = Math.abs(sp) < 1 ? v.stuck + dt : 0;
  if (v.stuck > 2.5) { v.backT = 2; v.stuck = 0; v.det = v.det > 0 ? -1.4 : 1.4; v.detT = 6; }
  const back = (v.backT = Math.max(0, (v.backT || 0) - dt)) > 0;
  driveBoat(v, { thr: back ? 0 : Math.abs(err) > 1.4 ? .55 : 1, brk: back ? 1 : 0, steer: clamp(err * 2.2, -1, 1) * (back ? -1 : 1), hb: Math.abs(err) > 1.3 && sp > 8 }, dt);
  // 霍利斯回頭開槍（40 m 內）
  if (d < 40 && !life.dead && (v.shotT = (v.shotT ?? 1.5) - dt) <= 0) { npcShoot(v.x, v.y + 1.6, v.z, .14, 6, 1, 'npc'); v.shotT = 1.1 + Math.random() * .8; }
}

// ─── 步驟 ───
// 跟車：太近會起疑（22 m 內越近漲越快），撞到運鈔車直接被發現；離開 140 m 超過 12 秒就跟丟；運鈔車開到目的地停下就完成
STEP.tail = {
  start: (a, s, c) => { c.sus = 0; c.lost = 0; a.susMax = 0; },
  step: (a, s, c, dt) => {
    const tk = a.truck;
    if (!tk || tk.v.dead || tk.state === 'open') { storyFail(a, '運鈔車出事了'); return false; }
    if (player.veh === tk.v) { storyFail(a, '你搶了運鈔車，戲演不下去了'); return false; }
    const d = Math.hypot(tk.v.x - pX(), tk.v.z - pZ());
    if (d < 22) c.sus += dt * (22 - d) / 22 * .3 * (player.mode === 'drive' ? 1 : 1.6);
    else c.sus = Math.max(0, c.sus - dt * .04);
    if (tk.v.hp < a.truckHp0 - 40) c.sus = 1;
    a.susMax = Math.max(a.susMax, c.sus);
    if (c.sus >= 1) { storyFail(a, '運鈔車的司機起疑了'); return false; }
    if (d > 140) { c.lost += dt; if (c.lost > 12) { storyFail(a, '跟丟了'); return false; } } else c.lost = 0;
    return tk.state === 'park' && d < 160;
  },
  hud: (a, s, c) => { const tk = a.truck, d = tk ? Math.round(Math.hypot(tk.v.x - pX(), tk.v.z - pZ())) : 0; return { text: c.lost > 0 ? `${s.text} · 快跟丟了（${Math.ceil(12 - c.lost)} 秒）` : `${s.text} · 可疑 ${Math.round(c.sus * 100)}%`, bar: c.sus * 100, low: c.sus > .65 || c.lost > 0, num: `${d} m` }; },
  mark: a => a.truck ? { name: TRUCK_NAME, x: a.truck.v.x, y: 3, z: a.truck.v.z, where: 'out' } : null,
};
// 炸開運鈔車的後門（69-events.js 的 truckOpen → storyEv('truck')）
STEP.truck = {
  start: (a, s, c) => { c.open = false; a.truckC = c; },   // storyEv('truck') 把 c.open 設起來
  step: (a, s, c) => {
    const tk = a.truck;
    if (!tk) return false;
    if (!c.open && Math.hypot(tk.v.x - pX(), tk.v.z - pZ()) > 260) { storyFail(a, '運鈔車開走了'); return false; }
    return c.open;
  },
  hud: (a, s) => ({ text: s.text, bar: -1, num: a.truck ? `${Math.round(Math.hypot(a.truck.v.x - pX(), a.truck.v.z - pZ()))} m` : '' }),
  mark: a => a.truck ? { name: TRUCK_NAME, x: a.truck.v.x, y: 3, z: a.truck.v.z, where: 'out' } : null,
};
// 躲進排水道：最近的人孔
STEP.drain = {
  start: (a, s, c) => { c.to = stHole(pX(), pZ()); },
  step: () => player.where === 'drain',
  hud: (a, s, c) => ({ text: s.text, bar: -1, num: c.to && player.where === 'out' ? `${Math.round(Math.hypot(c.to.x - pX(), c.to.z - pZ()))} m` : '' }),
  mark: (a, s, c) => { if (player.where === 'out') c.to = stHole(pX(), pZ()); return c.to ? { name: c.to.name, x: c.to.x, y: 1.5, z: c.to.z, where: 'out' } : null; },
};
// 離開某一點 r 公尺以上
STEP.away = {
  start: (a, s, c) => { c.from = s.from ? s.from() : { x: pX(), z: pZ() }; },
  step: (a, s, c) => player.where === 'out' && Math.hypot(pX() - c.from.x, pZ() - c.from.z) > s.r,
  hud: (a, s, c) => ({ text: s.text, bar: Math.min(100, Math.hypot(pX() - c.from.x, pZ() - c.from.z) / s.r * 100), num: `${Math.round(Math.hypot(pX() - c.from.x, pZ() - c.from.z))} / ${s.r} m` }),
};
// 快艇追逐：貼在 14 m 內累積 5 秒，或把船打到剩四成五，霍利斯就停船；離開 260 m 超過 10 秒算他跑掉
STEP.chase = {
  start: (a, s, c) => { c.close = 0; c.lost = 0; a.chaseK = a.k; },
  step: (a, s, c, dt) => {
    const v = a.boat;
    if (!v) return true;
    const d = Math.hypot(v.x - pX(), v.z - pZ());
    if (v.dead) { a.boatDead = 1; return true; }
    if (d < 14) c.close += dt;
    if (d > 260) { c.lost += dt; if (c.lost > 10) { storyFail(a, '霍利斯跑掉了'); return false; } } else c.lost = 0;
    const done = c.close > 5 || v.hp < a.boatHp0 * .45;
    storyBoatStep(v, dt, done);
    return done;
  },
  hud: (a, s, c) => { const v = a.boat, d = v ? Math.round(Math.hypot(v.x - pX(), v.z - pZ())) : 0; return { text: c.lost > 0 ? `${s.text} · 快追丟了（${Math.ceil(10 - c.lost)} 秒）` : s.text, bar: v ? Math.min(100, Math.max(c.close / 5, 1 - (v.hp / a.boatHp0 - .45) / .55) * 100) : -1, low: c.lost > 0, num: `${d} m` }; },
  mark: a => a.boat ? { name: '霍利斯的快艇', x: a.boat.x, y: 2.5, z: a.boat.z, where: 'out' } : null,
};
// 測試（__nc.story.skip）：直接達成各步驟的條件
STEP.tail.skip = a => { const tk = a.truck; if (!tk) return; tk.state = 'park'; const o = player.mode === 'drive' ? player.veh : player; o.x = tk.v.x + 30; o.z = tk.v.z; };
STEP.truck.skip = a => { if (a.truck) truckOpen(a.truck, 1, true); };
STEP.drain.skip = () => { const e = DR.ents.findIndex(e => e.kind === 'hole'); if (player.mode === 'drive') exitVehicle(); if (e >= 0) drEnter(e); };
STEP.away.skip = (a, s, c) => { const o = player.mode === 'drive' ? player.veh : player; o.x = c.from.x + s.r + 5; o.z = c.from.z; };
STEP.chase.skip = a => { if (a.boat) a.boat.hp = a.boatHp0 * .3; };
// 追逐結束以後：船停在原地漂（有人開過去撞也不會跑）
storyCleanups.push(a => { a.noEvade = 0; });
storyTicks.push((a, dt) => { if (a.boat && !(a.cur && a.cur.s.type === 'chase')) storyBoatStep(a.boat, dt, true); });
// 69-police.js：2-4 的腳鐐訊號
function storyNoEvade() { const a = side.act; return !!(a && a.kind === 'story' && a.noEvade); }

// 從二樓的窗戶跳下來：人放到 4.8 m 高、往外跳（69-v3-crash.js 的 air3 'fall' 落地照算摔傷），敵人從兩頭圍過來
function storyWindow(a) {
  const p = ST_MOTEL(), yaw = p.yaw || 0;
  if (player.mode === 'drive') exitVehicle();
  setWhere('out');
  player.x = p.x; player.z = p.z; player.yaw = camState.yaw = yaw; camState.snap = true;
  player.y = groundH(p.x, p.z) + 4.8;
  player.air3 = { kind: 'fall', vx: Math.sin(yaw) * 2.4, vy: 2.2, vz: Math.cos(yaw) * 2.4, t: 0 };
  sfx.glassBreak && sfx.glassBreak();
  const grp = a;
  fRoom(6);
  for (let i = 0; i < 6; i++) {
    const t = (i < 3 ? -.5 : 2.6) + i * .35, r = 16 + (i % 3) * 4, x = p.x + Math.sin(yaw + t) * r, z = p.z + Math.cos(yaw + t) * r;
    const f = fSpawn('gang', x, z, Math.atan2(p.x - x, p.z - z), { gun: ['smg', 'pistol', 'shotgun'][i % 3], esc: i >= 4 });   // 最後兩個是霍爾的人（便衣）
    if (f) f.grp = grp;
  }
  a.motel = { x: p.x, z: p.z };
}

// ─── 任務表 ───
storyAdd([
  { id: '2-1', ch: 2, title: '內線', who: DANE, star: 0, at: () => CREW[DANE].home, giver: 'hollis', giverAt: () => stAt(DANE_L, 2.2, -.4), cast: { rosa: () => stAt(DANE_L, 3.6, .8, -Math.PI / 2) },
    desc: '霍利斯說有一票「容易的」。', sms: '霍利斯：帶上你那個女朋友，來船廠一趟。有一票容易的。',
    steps: [
      { type: 'say', with: 'hollis', lines: [L('hollis', '鐵庫保全，聽過嗎？每天晚上十點，一台運鈔車從冠石金融區開出來。'), L('rosa', '運鈔車有槍、有警報、有保險。'), L('hollis', '這一台沒有。它不載錢，只載「收據」。沒有人會為了收據報警。'), L('dane', '收據值多少？'), L('hollis', '對買家來說？值你媽那間房子再加一棟。'), L('rosa', '……你怎麼知道我媽的房子？'), L('hollis', '夜城很小，甜心。先去盯一次車，記下它走哪條路。')] },
    ] },
  { id: '2-2', ch: 2, title: '盯車', who: DANE, star: 2, sw: [DANE, ROSA], at: ST_CROWN, giver: null,
    desc: '跟著鐵庫保全的運鈔車，記下它的路線。別靠太近。', sms: '霍利斯：十點。冠石金融區。開一台沒人會多看一眼的車。',
    bonus: [{ t: '沒讓司機起疑（可疑值沒超過一半）', ok: a => a.susMax < .5 }, { t: '一路上只開一台車', ok: a => (a.vehs ? a.vehs.size : 0) <= 1 }],
    steps: [
      { type: 'fn', fn: a => storyCar(a, 'grc_sedan', ST_CROWN(), '不起眼的轎車', true) },
      { type: 'say', phone: '霍利斯', lines: [L('霍利斯', '看到那台深綠色的了嗎？就是它。'), L('霍利斯', '保持距離。司機要是在後照鏡裡看你看了兩次，今晚就收工。')] },
      { type: 'car', text: '坐上不起眼的轎車' },
      { type: 'fn', fn: a => { const p = pX(), q = pZ(), d = stNode(p, q, 380, 620); storyTruck(a, { x: p, z: q }, { x: d.x, z: d.z }); toast('運鈔車開出來了（小地圖藍點）'); } },
      { type: 'tail', text: '跟著運鈔車' },
      { type: 'say', lines: [L('dane', '它停了。鐵庫保全的金庫，後門。'), L('rosa', '每天同一條路、同一個時間。'), L('dane', '照霍利斯的說法，車上只有兩個人。'), L('rosa', '照霍利斯的說法。')] },
    ] },
  { id: '2-3', ch: 2, title: '收據', who: ROSA, star: 3, sw: [ROSA, DANE], at: ST_MID, giver: 'dane', giverAt: () => { const p = ST_MID(), [lx, lz] = toL(p.x, p.z); return spotW({ x: lx + 1.6, z: lz, yaw: -Math.PI / 2 }); },
    desc: '中城。用黏性炸彈炸開運鈔車的後門，拿走車上的東西。', sms: '戴恩：東西準備好了。中城，老地方。',
    bonus: [{ t: '4 分鐘內完成', ok: a => a.t < 240 }, { t: '生命沒掉超過 60', ok: a => a.hurt <= 60 }],
    first: () => { S.flags.drive = 1; toast('拿到加密硬碟（劇情道具）'); },
    steps: [
      { type: 'say', with: 'dane', lines: [L('dane', '四顆黏性炸彈。貼在後門，退開，按下去。'), L('rosa', '你從哪裡學的？'), L('dane', '軍隊教的。他們沒教我之後要怎麼找工作。'), L('rosa', '那今晚就算加班。')] },
      { type: 'fn', fn: a => { const A = arm.ammo.sticky; A.mag = Math.max(A.mag, 4); palOn(a, DANE); storyTruck(a, { x: pX(), z: pZ() }, null); toast('運鈔車在附近（小地圖藍點）· 黏性炸彈 ×4'); } },
      { type: 'truck', text: '用黏性炸彈炸開運鈔車後門（G 引爆）' },
      { type: 'fn', fn: a => toast('押車的不是保全——是便衣警察！') },
      { type: 'fight', text: '解決押車的便衣', at: () => a0Rear(), n: 4, guns: ['smg', 'pistol', 'smg', 'rifle'], r: 7, esc: true, hot: true },
      { type: 'collect', text: '拿走車上的東西', item: '硬碟', spots: () => [a0Rear()] },
      { type: 'say', lines: [L('rosa', '沒有錢。一顆硬碟、一本帳。'), L('dane', '押車的那幾個……他們有警徽。'), L('rosa', '霍利斯說這一台沒人會報警。'), L('dane', '因為會來的人本來就是警察。')] },
      { type: 'lose', text: '甩掉警察' },
      { type: 'fn', fn: a => palOff(a) },
    ] },
  { id: '2-4', ch: 2, title: '全城通緝', who: ROSA, star: 4, sw: [ROSA, DANE], at: ST_W24, giver: 'dane', giverAt: () => { const p = ST_W24(), [lx, lz] = toL(p.x, p.z); return spotW({ x: lx + 1.6, z: lz, yaw: -Math.PI / 2 }); },
    desc: '第九分局在追羅莎的腳鐐訊號，五星通緝不會自己消退。躲進地底下。', sms: '奧帝斯：別待在一個地方。所有頻道都在講你們兩個。',
    bonus: [{ t: '90 秒內躲進排水道', ok: a => a.tStep[3] < 90 }, { t: '生命沒掉超過 50', ok: a => a.hurt <= 50 }],
    first: () => { S.cast.kael = 1; S.flags.drainMap = 1; toast('現在可以切換成凱爾了；排水道的入口標在地圖上'); },
    steps: [
      { type: 'say', with: 'dane', lines: [L('dane', '妳聽，整座城的警笛都在響。'), L('rosa', '我們甩掉了啊。'), L('dane', '不是我們。是妳的腳。')] },
      { type: 'say', phone: '奧帝斯', lines: [L('奧帝斯', '他們不是在找車，是在追腳鐐的訊號！第九分局直接接了監控的線。'), L('奧帝斯', '找地底下的地方。混凝土夠厚，訊號就斷。')] },
      { type: 'fn', fn: a => { palOn(a, DANE); a.noEvade = 1; addHeat(99, 5); toast('五星通緝 · 腳鐐訊號被追蹤（躲起來也不會消退）'); } },
      { type: 'drain', text: '躲進排水道（掀開人孔蓋）' },
      { type: 'fn', fn: a => { a.noEvade = 0; wantedClear('evaded'); toast('箱涵裡收不到訊號：腳鐐斷線了'); } },
      { type: 'leave', text: '沿著箱涵走，從出口爬出去' },
      { type: 'fn', fn: a => { const [lx, lz] = toL(pX(), pZ()); a.npc.kael = spotW({ x: lx + 2.4, z: lz + 1.2, yaw: -Math.PI / 2 }); } },
      { type: 'say', with: 'kael', lines: [L('kael', '上車。奧帝斯說你們會從這裡冒出來。'), L('dane', '你是誰？'), L('kael', '開車的。蒙洛的人叫我來接——他想見見全城都在找的那兩個人。'), L('rosa', '蒙洛是誰？'), L('kael', '活下來再說。')] },
      { type: 'fn', fn: a => palOff(a) },
    ] },
  { id: '2-5', ch: 2, title: '二樓', who: DANE, star: 3, sw: [DANE, ROSA], at: ST_MOTEL, giver: 'rosa', giverAt: () => { const p = ST_MOTEL(), [lx, lz] = toL(p.x, p.z); return spotW({ x: lx - 1.6, z: lz, yaw: Math.PI / 2 }); },
    desc: '霍利斯安排兩人躲在楓林里的汽車旅館。', sms: '霍利斯：楓林里汽車旅館，214 號房。錢在路上，先躲幾天。',
    bonus: [{ t: '60 秒內逃出 150 m', ok: a => a.tStep[3] < 60 }, { t: '生命沒掉超過 40', ok: a => a.hurt <= 40 }],
    first: () => { S.flags.motel = 1; },
    steps: [
      { type: 'say', with: 'rosa', lines: [L('rosa', '霍利斯說這裡不會有人來查。'), L('dane', '霍利斯也說那台車只載收據。'), L('rosa', '……今晚輪流睡。')] },
      { type: 'card', k: '楓林里汽車旅館 · 214 號房', t: '凌晨兩點', lines: [
        L('rosa', '戴恩。樓下停了三台車，沒熄火。'),
        L('dane', '赤蠍幫的車。後面那台……是警車，沒開燈。'),
        L('霍爾', '（門外）伊巴拉小姐、默瑟先生。開門，我們好好談。'),
        L('rosa', '窗戶。'),
        L('dane', '這是二樓。'),
        L('rosa', '那就跳得漂亮一點。'),
      ] },
      { type: 'fn', fn: a => { cardOff(); storyWindow(a); palOn(a, ROSA); } },
      { type: 'away', text: '逃離汽車旅館', r: 150, from: () => ST_MOTEL() },
      { type: 'say', lines: [L('dane', '門外那個人，叫我們「默瑟先生」。'), L('rosa', '他知道我們的名字、知道房號。'), L('dane', '只有一個人知道房號。'), L('rosa', '船長。')] },
      { type: 'fn', fn: a => palOff(a) },
    ] },
  { id: '2-6', ch: 2, title: '船長', who: DANE, star: 4, sw: [DANE, ROSA], at: () => CREW[DANE].home, giver: 'rosa', giverAt: () => stAt(DANE_L, -1.6, -.6),
    desc: '回錨灣港的船廠找霍利斯算帳。', sms: '羅莎：我知道他今晚在哪裡。',
    bonus: [{ t: '生命沒掉超過 60', ok: a => a.hurt <= 60 }, { t: '3 分鐘內追上快艇', ok: a => a.tStep[a.chaseK] < 180 }],
    first: () => { S.flags.boat = 1; toast('錨灣港碼頭的快艇可以隨時開走了'); },
    steps: [
      { type: 'say', with: 'rosa', lines: [L('rosa', '他把我們賣了兩次。一次給赤蠍幫，一次給警察。'), L('dane', '他欠我三個月的房租和一條命。'), L('rosa', '那今晚一起收。')] },
      { type: 'fn', fn: a => palOn(a, ROSA) },
      { type: 'go', text: '到船廠的碼頭找霍利斯', to: () => ST_SHIP, r: 12, name: '船廠碼頭' },
      { type: 'fight', text: '打倒霍利斯的人', at: () => ST_SHIP, n: 5, guns: ['shotgun', 'pistol', 'smg', 'pistol', 'rifle'], r: 8, npc: { id: 'hollis', dx: 10 } },
      { type: 'say', with: 'hollis', lines: [L('hollis', '你們不該回來的。'), L('dane', '你說那台車只載收據。'), L('hollis', '它是只載收據啊。只是收據上的名字，你們惹不起。')] },
      { type: 'fn', fn: a => { delete a.npc.hollis; const h = ST_BH.home, [lx, lz] = toL(h.x, h.z); const q = spotW({ x: lx + 18, z: lz + 14, yaw: Math.PI / 2 }); storyBoat(a, q.x, q.z, q.yaw); a.car = ST_BH; a.carHp0 = ST_BH.hp; toast('霍利斯跳上快艇跑了！'); } },
      { type: 'car', text: '坐上碼頭的灣仔快艇' },
      { type: 'fn', fn: a => palOff(a) },
      { type: 'chase', text: '追上霍利斯的快艇' },
      { type: 'say', lines: [L('hollis', '好啦！好啦！我停船！'), L('hollis', '是霍爾逼我的！第九分局的霍爾！那顆硬碟是天際置業的——'), L('dane', '天際置業？要收羅莎她媽房子的那個？')] },
      { type: 'fn', fn: a => { const v = a.boat; if (v && !v.dead) { sfx.shot(); fireball(v.x, v.y + 1, v.z, 1); sfx.boom(Math.hypot(v.x - pX(), v.z - pZ())); v.hp = 0; v.dead = 1; v.lights = 0; } toast('遠處一聲槍響'); } },
      { type: 'say', phone: '霍爾', lines: [L('霍爾', '派克先生不小心掉進海裡了。真可惜，他游泳一向不太行。'), L('霍爾', '你們手上有我的東西。我會去拿。'), L('霍爾', '在那之前——好好享受夜城。')] },
    ] },
]);
const a0Rear = () => { const a = side.act; return a && a.truck ? truckRear(a.truck) : { x: pX(), z: pZ(), yaw: 0 }; };
