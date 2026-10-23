// ═══ 人、事、物的碰撞響應與位移解算（使用者的《人、事、物交互碰撞與物理位移演算規格書》） ═══
// 偵測沿用 30-vehicles.js 的 collideCircle 與 10-city.js 的 boxesNear／circlesNear，這裡只管撞上以後誰退、退多少、往哪飛。
// 規格書裡已經由別的模組做掉的部分照原本的：車撞牆的擦牆與反彈（30-vehicles.js 的 vehicleCollide）、撞出擋風玻璃（69-v3-crash.js）、
// 撞斷路燈與消防栓水柱（69-v3-break.js）、撞人擊飛（68-wreck.js 的 pedRam）、爆炸與側撞翻車（68-roll.js）、車疊在車頂上跟著走（68-roll.js 的 under）。
// · 推動層級：建築與地形 W = 0（不動），其他依質量 M 取逆質量 W = 1/M（25-cars.js 的級距表：戰車 4800、貨車 2600、車 1100–2000、機車 220–280、人 85）。
//   兩物穿透 d 時各退 max(d − δ, 0)·β·W_i/(W_A+W_B)（δ = 1 cm、β = 0.8），同一幀迭代 4 次。
// · 車車（kinVehicles，69-combat.js 的 vehPairs 呼叫）：位置修正的迴圈裡也推牆，被夾在牆邊的車把牆的反推傳給後面的車；速度用法線＋庫侖切向衝量（序列衝量 4 次），
//   接觸點的力臂讓車打轉（PIT，v.yk 另外積分、v.slideT 期間抓地力剩四分之一）。同一台車兩個接觸法線夾角超過 135°、推的那台 M·v ≥ 6000 就算夾扁：扣血、往旁邊擠出去、車身往上拱。
// · 人的擊飛與滑行：路人走 68-wreck.js 的 ps.fly（pedFly）；警察與戰鬥員用 kinSlide（拋物線、落地彈一下、庫侖摩擦 μg = 6.5 m/s² 滑行、撞牆吃掉法向速度）；
//   玩家被拋起來借 69-v3-crash.js 的 player.air3（kind 'eject'）。
// · 人與人（kinWalk，40-people.js 的 updatePlayerWalk 呼叫）：對等的軟性分離；衝刺撞人讓對方踉蹌 0.8 m，背後 0.6 m 有障礙或落差就直接倒；
//   近戰出拳前吸附到打得到的距離（kinLunge）、打不倒的人退 0.45 m；被轟飛滑得快的路人會把擋在路上的人撞倒（保齡球）。
// · 人與車：停著的車被人推得動一點（m/(M+m)）；車把人夾在牆上（夾扁、往上彈）；高速跳車（F，時速 15 以上，車繼續滑）；劫車時駕駛座那側貼牆就改從副駕側拉人（kinDoorSide），
//   駕駛被拖到車門外後方約 1.4 m，玩家最後 0.25 秒滑進駕駛座。
// · 事：爆炸依距離衰減把人拋飛（3 + 11f、往上 1 + 5f）；霰彈 6 m 內打倒的人往後飛約 3.5 m；子彈稍微推動沒人開的車。
// 沒做：消防車水砲（沒有消防車；消防栓水柱是 69-v3-break.js 的）、玩家站在車頂隨車移動（玩家不會站上車頂，翻越是直接翻過去）。規格書貼上來時公式與程式碼都掉了，δ、β、門檻與速度是補的，見 HANDOFF。

const KIN = { slop: .01, beta: .8, iters: 4, e: .25, mu: .45, muG: 6.5, g: 9.8, crushDot: -.7, crushP: 6000, man: 85, jump: 4 };
const massOf = v => v.mass || (v.isCar ? 1600 : 280);   // 和 69-combat.js 原本的 vehPairs 一樣
const vehI = v => v.boat || v.fly ? Infinity : massOf(v) * (v.len * v.len + v.w * v.w) / 12;   // 船與直升機不被撞得打轉
const kin = { crush: 0, crushWalk: 0, lunge: null, last: null, barge: 0, jump: 0, door: 0, bowl: 0 };

// ─── 警察與戰鬥員：擊飛與滑行（o 有 x、z 與 kx、kz 水平速度、ky 離地高度、kvy 垂直速度） ───
const kinOn = o => !!(o.kx || o.kz || o.ky > 0 || o.kvy > 0);
function kinLaunch(o, vx, vz, vy = 0) { o.kx = vx; o.kz = vz; o.kvy = vy; o.ky = vy > 0 ? Math.max(o.ky || 0, .01) : o.ky || 0; }
function kinSlide(o, dt, r = .32) {
  if (!kinOn(o)) return false;
  if (o.ky > 0 || o.kvy > 0) {
    o.kvy -= KIN.g * dt; o.ky += o.kvy * dt;
    if (o.ky <= 0) { o.ky = 0; o.kvy = o.kvy < -3.5 ? -o.kvy * .22 : 0; o.kx *= .7; o.kz *= .7; }   // 落地：彈一下，水平速度掉三成
  } else {
    const sp = Math.hypot(o.kx, o.kz);
    if (sp < .05) { o.kx = o.kz = 0; return false; }
    const k = Math.max(0, sp - KIN.muG * dt) / sp; o.kx *= k; o.kz *= k;
  }
  const res = collideCircle(o.x + o.kx * dt, o.z + o.kz * dt, r, false);
  if (res.hit) {   // 撞牆：吃掉往牆裡的速度，再彈一點回來
    const nl = Math.hypot(res.nx, res.nz) || 1, nx = res.nx / nl, nz = res.nz / nl, vn = o.kx * nx + o.kz * nz;
    if (vn < 0) { o.kx -= vn * nx * 1.15; o.kz -= vn * nz * 1.15; }
  }
  o.x = res.x; o.z = res.z;
  return true;
}
// 爆炸：衝量依距離線性衰減，拋飛速度 3 + 11f、往上 1 + 5f
const blastV = (ox, oz, x, z, r) => { const dx = ox - x, dz = oz - z, d = Math.hypot(dx, dz) || 1, f = clamp(1 - d / r, 0, 1); return [dx / d * (3 + 11 * f), dz / d * (3 + 11 * f), 1 + 5 * f, f]; };
function kinBlast(o, x, z, r) { const [vx, vz, vy] = blastV(o.x, o.z, x, z, r); kinLaunch(o, vx, vz, vy); }
// 路人飛出去：68-wreck.js 的 ps.fly（wreckUpdate 積分、撞牆彈回、落地滑到停）；fresh：剛被 knockPed 打倒，從原地飛（knockPed 預設往前挪了 .6 m）
function pedFly(k, vx, vz, vy, fresh) {
  const ps = pedState[k];
  if (!ps || !(ps.down > 0) || !ps.dpos) return;
  if (fresh && !ps.fly) { const p = peds.people[k]; ps.dpos[0] = p.x; ps.dpos[1] = p.z; }
  const base = groundH(ps.dpos[0], ps.dpos[1]) > 0 ? .15 : 0;
  ps.fly = { vx, vz, vy, y: ps.fly ? ps.fly.y : base, spin: 0 };
}
function kinBlastPed(k, x, z, r) {
  const p = peds.people[k], [vx, vz, vy] = blastV(p.x, p.z, x, z, r);
  pedFly(k, vx, vz, vy, true);
}
// 玩家被炸飛：夠近（f > .45）才拋到半空，其他照 knockPlayer 往後倒；回傳 true 表示拋起來了
function kinBlastMe(x, z, r) {
  if (player.mode !== 'walk' || player.where !== 'out' || player.air3 || player.swim || life.dead) return false;
  const [vx, vz, vy, f] = blastV(player.x, player.z, x, z, r);
  if (f <= .45) return false;
  launchMe(vx, vz, vy, 0);
  return true;
}
// 借 69-v3-crash.js 的拋出流程：air3 在空中積分、撞樓、落地時扣 dmg（乘上 skK.take）
function launchMe(vx, vz, vy, dmg) {
  player.y += .05;
  player.air3 = { kind: 'eject', vx, vy, vz, dmg, t: 0 };
  player.down = 99; player.downPh = -uTimeNow(); player.gotUp = 0; player.kx = player.kz = 0;
  gta.aiming = false;
}
// 近戰：打倒的人往後摔，沒倒的人退 0.45 m（v₀ = √(2·μg·0.45) ≈ 2.4）
function kinPunch(o, fx, fz) {
  if (!o || typeof o !== 'object') return;
  if (o.state === 'down') kinLaunch(o, fx * 3.2, fz * 3.2, .6); else kinLaunch(o, fx * 2.4, fz * 2.4);
}
// 路人踉蹌：dist 公尺、T 秒內退完（線性減速），站著的人偏移量記在 ps.dx／dz（投降、反擊中的人直接移 ps.fx／fz）
function kinStumble(k, fx, fz, dist = .45, T = .3) {
  const ps = pedState[k];
  if (!ps || ps.down > 0) return;
  ps.sv = { vx: fx * 2 * dist / T, vz: fz * 2 * dist / T, T, t: 0 };
}
// 霰彈 6 m 內打倒的人往後飛：空中約 1.3 m、落地再滑約 2 m
function kinBlow(h, R) {
  const l = Math.hypot(R.dx, R.dz) || 1, ux = R.dx / l, uz = R.dz / l;
  if (h.kind === 'ped') { const ps = pedState[h.ref]; if (ps && ps.down > 0 && !ps.stun) pedFly(h.ref, ux * 7.4, uz * 7.4, 1.5, !ps.fly); }
  else if (h.kind === 'extra') { const s = extraSt[h.ref]; if (s.st === 'fall') { s.vx = ux * 12; s.vz = uz * 12; } }
  else if ((h.kind === 'cop' || h.kind === 'fighter') && h.ref.state === 'down') kinLaunch(h.ref, ux * 6.3, uz * 6.3, 1.5);
}

// ─── 車車：迭代位置修正、序列衝量、打轉、夾扁 ───
// 和原本 vehPairs 一樣的過濾：看不到的、高度差一個車身（直升機、從斷橋或跳台飛過去）、疊在車頂上的不算
function kinPairOk(A, B) {
  if (A.g && !A.g.visible || B.g && !B.g.visible) return false;
  if (Math.abs((A.y || 0) - (B.y || 0)) > 1.2 || A.under === B || B.under === A) return false;
  return Math.hypot(A.x - B.x, A.z - B.z) <= (A.len + B.len) / 2 + 1;
}
// 兩車前後兩個碰撞圓之間穿透最深的一對；n 從 B 指向 A，p 是接觸點
function vehContact(A, B) {
  let best = null;
  const fax = Math.sin(A.yaw), faz = Math.cos(A.yaw), fbx = Math.sin(B.yaw), fbz = Math.cos(B.yaw);
  for (const sa of [1, -1]) for (const sb of [1, -1]) {
    const ax = A.x + fax * A.off * sa, az = A.z + faz * A.off * sa, bx = B.x + fbx * B.off * sb, bz = B.z + fbz * B.off * sb;
    const dx = ax - bx, dz = az - bz, d = Math.hypot(dx, dz), rr = A.rad + B.rad;
    if (d < rr && d > 1e-4 && (!best || rr - d > best.pen)) { const nx = dx / d, nz = dz / d, q = B.rad - (rr - d) / 2; best = { nx, nz, pen: rr - d, px: bx + nx * q, pz: bz + nz * q }; }
  }
  return best;
}
// 位置專用的推牆（可以重複呼叫）：兩個碰撞圓各自推出建築、路燈、路邊車；回傳推出方向。船與直升機不推（各自有自己的碰撞）
function vehWall(v) {
  if (v.boat || v.fly) return null;
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  let nx = 0, nz = 0;
  for (const s of [1, -1]) {
    const cx = v.x + fx * v.off * s, cz = v.z + fz * v.off * s;
    colY = v.y || 0;
    const r = collideCircle(cx, cz, v.rad, false);
    colY = 0;
    if (r.hit) { v.x += r.x - cx; v.z += r.z - cz; nx += r.nx; nz += r.nz; }
  }
  const l = Math.hypot(nx, nz);
  return l > 1e-6 ? [nx / l, nz / l] : null;
}
// 有人開的車：轉向的角速度 yr 是真的；沒人開的車只剩撞出來的 yk
const vehDriven = v => v === player.veh || !v.dead && (v.ai || v.unit && v.unit.drive);
const yawRate = v => (vehDriven(v) ? v.yr || 0 : 0) + (v.yk || 0);
const ptV = (v, r) => { const w = yawRate(v); return [v.vx + w * r[1], v.vz - w * r[0]]; };   // 前方 = (sin, cos)：點 r 的速度 = v + ω·(r.z, −r.x)
const armN = (r, nx, nz) => r[1] * nx - r[0] * nz;   // 力臂：衝量 P 在 r 產生的轉矩 = r.z·P.x − r.x·P.z
function kinImpulse(P, px, pz) {
  const { A, B } = P;
  A.vx += px * P.wA; A.vz += pz * P.wA; if (P.iA < Infinity) A.yk = (A.yk || 0) + armN(P.rA, px, pz) / P.iA;
  B.vx -= px * P.wB; B.vz -= pz * P.wB; if (P.iB < Infinity) B.yk = (B.yk || 0) - armN(P.rB, px, pz) / P.iB;
}
function kinRel(P) { const a = ptV(P.A, P.rA), b = ptV(P.B, P.rB); return [a[0] - b[0], a[1] - b[1]]; }
function kinVehicles(L) {
  const pairs = [];
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (kinPairOk(L[i], L[j])) pairs.push({ A: L[i], B: L[j], c: null });
  if (!pairs.length) return;
  const hit = new Set(), wall = new Map(), log = new Map();
  const note = (v, nx, nz, src) => { let a = log.get(v); if (!a) log.set(v, a = []); a.push({ nx, nz, src, cl: (src.vx - v.vx) * nx + (src.vz - v.vz) * nz }); };
  // ① 位置修正：車對車只推 β 份、留 δ 的容差，牆在同一個迴圈裡（牆的 W = 0，反推經由被夾的車傳回來）
  for (let it = 0; it < KIN.iters; it++) {
    for (const P of pairs) {
      const c = vehContact(P.A, P.B);
      if (!c) continue;
      if (!P.c) { P.c = c; note(P.A, c.nx, c.nz, P.B); note(P.B, -c.nx, -c.nz, P.A); }
      const wA = 1 / massOf(P.A), wB = 1 / massOf(P.B), k = Math.max(0, c.pen - KIN.slop) * KIN.beta / (wA + wB);
      P.A.x += c.nx * k * wA; P.A.z += c.nz * k * wA; P.B.x -= c.nx * k * wB; P.B.z -= c.nz * k * wB;
      hit.add(P.A); hit.add(P.B);
    }
    for (const v of hit) { const n = vehWall(v); if (n) wall.set(v, n); }
  }
  // ② 速度：序列衝量 4 次。法線帶恢復係數 e（接近速度 1 m/s 以下不彈），切向庫侖摩擦 |Jt| ≤ μJ，接觸點的力臂讓車打轉；牆只吃掉往牆裡的速度
  const act = pairs.filter(P => P.c);
  for (const P of act) {
    const { A, B, c } = P;
    P.wA = 1 / massOf(A); P.wB = 1 / massOf(B); P.iA = vehI(A); P.iB = vehI(B);
    P.rA = [c.px - A.x, c.pz - A.z]; P.rB = [c.px - B.x, c.pz - B.z];
    P.mn = 1 / (P.wA + P.wB + armN(P.rA, c.nx, c.nz) ** 2 / P.iA + armN(P.rB, c.nx, c.nz) ** 2 / P.iB);
    P.mt = 1 / (P.wA + P.wB + armN(P.rA, -c.nz, c.nx) ** 2 / P.iA + armN(P.rB, -c.nz, c.nx) ** 2 / P.iB);
    const [rx, rz] = kinRel(P), vn0 = rx * c.nx + rz * c.nz;
    P.bias = vn0 < -1 ? -KIN.e * vn0 : 0; P.J = 0; P.Jt = 0;
  }
  for (let it = 0; it < KIN.iters; it++) {
    for (const P of act) {
      const { nx, nz } = P.c, tx = -nz, tz = nx;
      let [rx, rz] = kinRel(P);
      const J0 = P.J; P.J = Math.max(0, J0 + (P.bias - (rx * nx + rz * nz)) * P.mn);
      kinImpulse(P, nx * (P.J - J0), nz * (P.J - J0));
      [rx, rz] = kinRel(P);
      const T0 = P.Jt; P.Jt = clamp(T0 - (rx * tx + rz * tz) * P.mt, -KIN.mu * P.J, KIN.mu * P.J);
      kinImpulse(P, tx * (P.Jt - T0), tz * (P.Jt - T0));
    }
    for (const [v, n] of wall) { const vn = v.vx * n[0] + v.vz * n[1]; if (vn < 0) { v.vx -= vn * n[0]; v.vz -= vn * n[1]; } }
  }
  for (const v of hit) {
    if (!v.yk) continue;
    v.yk = clamp(v.yk, -3.5, 3.5);
    if (Math.abs(v.yk) > .6) v.slideT = Math.max(v.slideT || 0, Math.min(1.5, Math.abs(v.yk) * .5));   // 被撞得打轉：側滑一陣子
  }
  // ③ 傷害、翻車、音效、罪責：速度變化超過 3.5 m/s 的部分 ×18（neon_nightcity_gta_v_2.md）
  for (const P of act) {
    const { A, B, c } = P, dvA = P.J * P.wA, dvB = P.J * P.wB;
    damageVeh(A, Math.max(0, (dvA - 3.5) * 18), B === player.veh);
    damageVeh(B, Math.max(0, (dvB - 3.5) * 18), A === player.veh);
    rollHit(A, dvA, c.nx, c.nz); rollHit(B, dvB, -c.nx, -c.nz);   // 68-roll.js：側面被撞得夠猛就翻
    if (dvA + dvB > 7) sparks(c.px, Math.max(A.y || 0, B.y || 0) + .6, c.pz, 10, 4);
    if (A !== player.veh && B !== player.veh) continue;
    const mine = A === player.veh ? A : B, other = mine === A ? B : A, dv = mine === A ? dvA : dvB;
    if (dv > 2) { sfx.impact(dv); camState.shake = Math.max(camState.shake, Math.min(1, dv / 14)); }
    if (other.unit && dv > 2) crime('ramcop', other.x, other.z);
  }
  // ④ 夾扁：同一台車有兩個接觸法線夾角超過 135°（另一邊是牆、路邊車或另一台車），推的那台 M·v ≥ 6000
  const now = uTimeNow();
  for (const [v, a] of log) {
    if ((v.crushT || 0) > now || v.boat || v.fly) continue;
    const ns = [...a], w = wall.get(v);
    if (w) ns.push({ nx: w[0], nz: w[1], src: null, cl: 0 });
    const p = ns.find(p => p.src && massOf(p.src) * p.cl >= KIN.crushP && ns.some(q => q !== p && q.nx * p.nx + q.nz * p.nz < KIN.crushDot));
    if (p) crushVeh(v, p);
  }
}
function crushVeh(v, p) {
  v.crushT = uTimeNow() + 1.2; kin.crush++;
  damageVeh(v, massOf(v) > 3000 ? 150 : 320, p.src === player.veh);
  sparks(v.x, (v.y || 0) + .9, v.z, 24, 6); glassBurst(v.x, (v.y || 0) + 1.1, v.z); sfx.impact(14);
  // 往旁邊擠出去（沿著兩個法線的垂直方向，取原本側滑的那一邊）；輕的車身往上拱（68-roll.js 的 rollStart，翻滾很小，落地還是正的）
  const tx = -p.nz, tz = p.nx, s = v.vx * tx + v.vz * tz >= 0 ? 1 : -1;
  v.vx += tx * s * 3; v.vz += tz * s * 3;
  if (massOf(v) <= 3000) rollStart(v, 3.2, (Math.random() - .5) * 2, (Math.random() - .5) * .8);
  if (v === player.veh) camState.shake = 1;
}
// 撞出來的角速度與側滑（driveVehicle 與 coast 每幀呼叫）
function kinYaw(v, dt) {
  if (v.yk) { v.yaw += v.yk * dt; v.yk *= Math.exp(-2.4 * dt); if (Math.abs(v.yk) < .02) v.yk = 0; }
  if (v.slideT > 0) v.slideT -= dt;
}
// 子彈稍微推動沒人開的車（步槍一發約 0.13 m/s，機槍掃久了會推走）
function kinBullet(v, R, dmg) {
  if (vehDriven(v) || v.boat || v.fly || v.tumble || v.flipped) return;
  const k = dmg * 6 / massOf(v), l = Math.hypot(R.dx, R.dz) || 1;
  v.vx += R.dx / l * k; v.vz += R.dz / l * k;
}

// ─── 步行的玩家：車、人（40-people.js 的 updatePlayerWalk 在推完牆之後呼叫） ───
function kinWalk(x, z) {
  const py = player.y, out = player.where === 'out';
  let wall = null, push = null;
  colY = py;
  const w0 = collideCircle(x, z, .36, false, true);   // 稍微放大一點，看是不是正貼著牆（夾扁要用牆的法線）
  colY = 0;
  if (w0.hit) { const l = Math.hypot(w0.nx, w0.nz) || 1; wall = [w0.nx / l, w0.nz / l]; }
  for (let it = 0; it < 3; it++) {
    let moved = false;
    for (const c of traffic) {
      if (Math.abs((c.y || 0) - py) > 2.5) continue;   // 快速道路橋上橋下
      const L = TYPES[c.type].len * .3, rr = TYPES[c.type].w * .5 + .32;
      for (const s of [-1, 1]) {
        const ox = c.x + Math.sin(c.yaw) * L * s, oz = c.z + Math.cos(c.yaw) * L * s, dx = x - ox, dz = z - oz, d = Math.hypot(dx, dz);
        if (d < rr && d > 1e-4) { x = ox + dx / d * rr; z = oz + dz / d * rr; moved = true; }
      }
    }
    // 載具：人的 W 比車大得多，人退 M/(M+m)；停著的車被推動 m/(M+m)（轎車大約 5%、機車 23%）
    for (const v of vehicles) {
      if (v.g && !v.g.visible || Math.abs((v.y || 0) - py) > 2.5) continue;
      const rr = v.rad + .3, still = Math.hypot(v.vx, v.vz) < .5 && !vehDriven(v) && !v.tumble && !v.flipped && !v.boat && !v.fly && !v.onCar;
      const share = still ? KIN.man / (KIN.man + massOf(v)) : 0;
      for (const s of [-1, 1]) {
        const ox = v.x + Math.sin(v.yaw) * v.off * s, oz = v.z + Math.cos(v.yaw) * v.off * s, dx = x - ox, dz = z - oz, d = Math.hypot(dx, dz);
        if (d >= rr || d < 1e-4) continue;
        const nx = dx / d, nz = dz / d, pen = rr - d;
        x += nx * pen * (1 - share); z += nz * pen * (1 - share);
        if (share) { v.x -= nx * pen * share; v.z -= nz * pen * share; vehWall(v); }
        push = { nx, nz, v }; moved = true;
      }
    }
    if (!moved) break;
    colY = py;
    const r = collideCircle(x, z, .32, false, true);
    colY = 0;
    if (r.hit) { const l = Math.hypot(r.nx, r.nz) || 1; wall = [r.nx / l, r.nz / l]; }
    x = r.x; z = r.z;
  }
  if (!out) return [x, z];
  // 夾扁：車往牆的方向推人（車速 1.2 m/s 以上），牆的法線和車推的方向相反
  if (wall && push && wall[0] * push.nx + wall[1] * push.nz < KIN.crushDot && !(player.down > 0) && (kin.crushWT || 0) < uTimeNow()) {
    const v = push.v, cl = v.vx * push.nx + v.vz * push.nz;   // n 從車指向人：車往人這邊開是正的
    if (cl > 1.2) {
      kin.crushWT = uTimeNow() + 1.5; kin.crushWalk++;
      v.vx -= cl * push.nx; v.vz -= cl * push.nz;   // 牆經由人把車擋下來
      hurtPlayer(35 + cl * 5, v.x, v.z); sfx.impact(10); camState.shake = Math.max(camState.shake, .8);
      player.x = x; player.z = z;
      launchMe(-push.nx * 2.2, -push.nz * 2.2, 5.5, 0);   // 往上彈、滾上引擎蓋
      if (v.unit) crime('resist', v.x, v.z);
      return [x, z];
    }
  }
  // 人與人：對等的軟性分離（各退一半）；衝刺（4 m/s 以上）正面撞上就是肩膀撞人
  const mx = x - player.x, mz = z - player.z, ml = Math.hypot(mx, mz) || 1, run = player.v > 4, now = uTimeNow();
  for (let k = 0; k < PED_N; k++) {
    const ps = pedState[k];
    if (ps.down > 0 || ps.out) continue;
    const p = peds.people[k], dx = x - p.x, dz = z - p.z, d2 = dx * dx + dz * dz;
    if (d2 > .4096 || d2 < 1e-8) continue;
    const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, pen = .64 - d;
    if (run && -(mx * nx + mz * nz) / ml > .5 && !(ps.bargeT > now)) { kinBarge(k, -nx, -nz); x += nx * pen * .3; z += nz * pen * .3; continue; }
    x += nx * pen * .5; z += nz * pen * .5;
    if (ps.fsm) { ps.fx -= nx * pen * .5; ps.fz -= nz * pen * .5; } else { ps.dx -= nx * pen * .5; ps.dz -= nz * pen * .5; }
  }
  for (const o of [...SQ.f.filter(fUp), ...W.cops.filter(c => c.on && c.state === 'act' && !(c.stunT > 0) && !c.rope)]) {
    const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz);
    if (d > .64 || d < 1e-4) continue;
    const nx = dx / d, nz = dz / d, pen = .64 - d;
    if (run && -(mx * nx + mz * nz) / ml > .5 && !(o.bargeT > now)) { o.bargeT = now + 1.2; player.v *= .8; kin.barge++; sfx.impact(2.5); kinLaunch(o, -nx * 3.2, -nz * 3.2); continue; }
    x += nx * pen * .5; z += nz * pen * .5;
    const r = collideCircle(o.x - nx * pen * .5, o.z - nz * pen * .5, .32, false); o.x = r.x; o.z = r.z;
  }
  colY = py;
  const r = collideCircle(x, z, .32, false, true);
  colY = 0;
  return [r.x, r.z];
}
// 肩膀撞人：玩家保留八成速度；對方背後 0.6 m 有牆、設施或高低差就直接倒，否則踉蹌退 0.8 m，脾氣差的回頭揮拳
function kinBarge(k, dx, dz) {
  const ps = pedState[k], p = peds.people[k], now = uTimeNow();
  ps.bargeT = now + 1.2; player.v *= .8; kin.barge++; sfx.impact(2.5);
  const bx = p.x + dx * .6, bz = p.z + dz * .6;
  if (collideCircle(bx, bz, .3, false).hit || Math.abs(groundH(bx, bz) - groundH(p.x, p.z)) > .25) { knockPed(k, dx, dz); pedFly(k, dx * 3.2, dz * 3.2, 1.2, true); return; }
  kinStumble(k, dx, dz, .8, .35);
  if (ps.tough && !ps.fsm) pedEnter(k, 'fight', now + 14);
}
// 近戰吸附：揮拳時前方 reach + 1.1 m 內最近的目標，出手前每幀往它靠到 0.7·reach、身體轉過去
function kinLunge(A) {
  if (player.mode !== 'walk' || player.where !== 'out' || player.down > 0) return;
  const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
  let best = null, bd = A.reach + 1.1;
  const look = (x, z, o) => { const dx = x - player.x, dz = z - player.z, d = Math.hypot(dx, dz); if (d < bd && dx * fx + dz * fz > d * .55) { bd = d; best = o; } };
  for (let k = 0; k < PED_N; k++) if (!(pedState[k].down > 0) && !pedState[k].out) look(peds.people[k].x, peds.people[k].z, { ped: k });
  for (const f of SQ.f) if (fUp(f) && !fAlly(f)) look(f.x, f.z, f);
  for (const c of W.cops) if (c.on && c.state !== 'down') look(c.x, c.z, c);
  if (best && bd > A.reach * .75) kin.lunge = { o: best, want: A.reach * .7, t: A.fist ? .18 : .3, d0: bd };
}
function kinLungeStep(dt) {
  const L = kin.lunge, P = L.o.ped != null ? peds.people[L.o.ped] : L.o;
  L.t -= dt;
  const dx = P.x - player.x, dz = P.z - player.z, d = Math.hypot(dx, dz) || 1;
  player.yaw += wrapA(Math.atan2(dx, dz) - player.yaw) * (1 - Math.exp(-25 * dt));
  if (d > L.want) {
    const m = Math.min(d - L.want, 7 * dt);
    colY = player.y; const r = collideCircle(player.x + dx / d * m, player.z + dz / d * m, .32, false, true); colY = 0;
    player.x = r.x; player.z = r.z;
  }
  me.place(0, player.x, player.y, player.z, player.yaw);
  if (L.t <= 0 || player.mode !== 'walk' || player.down > 0) { kin.last = { d0: L.d0, d1: d }; kin.lunge = null; }
}
// 劫車與跳車：駕駛座那側（車身左側）貼著牆或設施就改走副駕側；回傳 1（左）或 −1（右）
function kinDoorSide(v) {
  for (const s of [1, -1]) {
    const lx = Math.cos(v.yaw) * s, lz = -Math.sin(v.yaw) * s;
    colY = v.y || 0;
    const h = collideCircle(v.x + lx * (v.w / 2 + .55), v.z + lz * (v.w / 2 + .55), .3, false).hit;
    colY = 0;
    if (!h) { if (s < 0) kin.door++; return s; }
  }
  return 1;
}

// ─── 跳車：F 在時速 15 以上（99-main.js），車繼續滑；人往車門那側滾出去，落地扣 (v − 6)·1.3 ───
function jumpOut(v) {
  if (v.boat || v.fly || v.tumble || v.flipped) return false;
  const vx = v.vx, vz = v.vz, sp = Math.hypot(vx, vz), s = kinDoorSide(v), lx = Math.cos(v.yaw) * s, lz = -Math.sin(v.yaw) * s;
  exitVehicle(true);   // 留著車速，車交給 coast() 滑行
  if (s < 0) {   // 左邊貼牆：從右邊出去
    colY = v.y || 0; const r = collideCircle(v.x + lx * (v.isCar ? 1.5 : .9), v.z + lz * (v.isCar ? 1.5 : .9), .32, false); colY = 0;
    player.x = r.x; player.z = r.z;
  }
  v.byP = uTimeNow(); kin.jump++;
  launchMe(vx * .7 + lx * 2.6, vz * .7 + lz * 2.6, 2.2, Math.max(0, sp - 6) * 1.3);
  sfx.impact(Math.min(14, sp * .5));
  toast(v.isCar ? '跳車' : '跳下機車');
  return true;
}

// ─── 每幀（68-gta.js 的 gtaUpdate，在戶外時） ───
function kinUpdate(dt) {
  if (kin.lunge) kinLungeStep(dt);
  // 跳車後滑出去的車：撞到路人一樣會撞飛
  for (const v of vehicles) if (v !== player.veh && v.byP && uTimeNow() - v.byP < 8 && !vehDriven(v) && Math.abs(v.vx) + Math.abs(v.vz) > 5) vehHits(v, 0);
  for (let k = 0; k < PED_N; k++) {
    const ps = pedState[k];
    // 踉蹌：線性減速，T 秒內走完
    if (ps.sv) {
      const s = ps.sv;
      if ((s.t += dt) >= s.T || ps.down > 0) { ps.sv = null; continue; }
      const f = 1 - s.t / s.T;
      if (ps.fsm) { const r = collideCircle(ps.fx + s.vx * f * dt, ps.fz + s.vz * f * dt, .3, false); ps.fx = r.x; ps.fz = r.z; }
      else { ps.dx += s.vx * f * dt; ps.dz += s.vz * f * dt; ps.dodge = Math.max(ps.dodge || 0, .6); }
      continue;
    }
    // 保齡球：被轟飛滑得快（3.5 m/s 以上、離地 1.2 m 以內）的人撞倒路上的人
    const q = ps.fly;
    if (!(ps.down > 0) || !q) continue;
    const sp = Math.hypot(q.vx, q.vz);
    if (sp < 3.5 || q.y > 1.2) continue;
    for (let j = 0; j < PED_N; j++) {
      const pj = pedState[j];
      if (j === k || pj.down > 0 || pj.out) continue;
      const p = peds.people[j];
      if ((p.x - ps.dpos[0]) ** 2 + (p.z - ps.dpos[1]) ** 2 < .36) {
        knockPed(j, q.vx / sp, q.vz / sp); pedFly(j, q.vx * .6, q.vz * .6, Math.max(0, q.vy) * .5 + .5, true);
        q.vx *= .6; q.vz *= .6; kin.bowl++;
      }
    }
  }
}

// 測試 API（window.__nc.gta.kin）
gtaApi.kin = {
  KIN, kin, massOf, jump: () => !!player.veh && jumpOut(player.veh), door: kinDoorSide,
  hit: (x, z, r = .5) => collideCircle(x, z, r, false).hit,
  // 從 (x, z) 往外找一塊 R 公尺內沒有碰撞物的空地，並回傳最空的方向（往前 L 公尺都碰不到東西）
  open(x, z, R = 6, L = 30) {
    for (let s = 0; s < 200; s += 2) for (let a = 0; a < 16; a++) {
      const px = x + Math.sin(a / 16 * 6.2832) * s, pz = z + Math.cos(a / 16 * 6.2832) * s;
      if (collideCircle(px, pz, R, false).hit || waterDepth(px, pz) > 0) continue;
      for (let b = 0; b < 16; b++) {
        const yaw = b / 16 * 6.2832, fx = Math.sin(yaw), fz = Math.cos(yaw);
        let ok = true;
        for (let t = 0; t <= L && ok; t += 1) ok = !collideCircle(px + fx * t, pz + fz * t, 1.4, false).hit;
        if (ok) return { x: px, z: pz, yaw };
      }
      if (s === 0) break;
    }
    return null;
  },
  // 從 (x, z) 往四周找最近的一面平牆：回傳貼牆的點（離牆 r）與牆的法線（從牆往外）
  wall(x, z, r = 1.1, R = 60) {
    let best = null;
    for (let a = 0; a < 32; a++) {
      const dx = Math.sin(a / 32 * 6.2832), dz = Math.cos(a / 32 * 6.2832);
      for (let s = 0; s < R && (!best || s < best.s); s += .25) {
        const c = collideCircle(x + dx * s, z + dz * s, r, false);
        if (!c.hit) continue;
        const l = Math.hypot(c.nx, c.nz) || 1, nx = c.nx / l, nz = c.nz / l;
        if (![1, -1].every(t => collideCircle(c.x - nz * t * 1.5, c.z + nx * t * 1.5, r + .05, false).hit)) continue;   // 左右 1.5 m 也碰得到才是平牆（不是路燈柱）
        if (![.15, 1].every(d => collideCircle(c.x - nx * (r + d), c.z - nz * (r + d), .3, false).hit)) continue;   // 人的大小也擋得住、有 1 m 厚（不是只擋車的東西或薄圍欄）
        best = { s, x: c.x, z: c.z, nx, nz };
        break;
      }
    }
    return best;
  },
  spawn(type, x, z, yaw) { const v = buildVeh(type, x, z, yaw); v.y = groundH(x, z); jacked.push(v); poseVehicle(v); return v; },
  drop: v => { if (jacked.includes(v)) dropVehicle(v); },
  me: () => ({ air: player.air3 ? player.air3.kind : null, y: player.y, down: player.down || 0, kx: player.kx || 0, kz: player.kz || 0 }),
};
