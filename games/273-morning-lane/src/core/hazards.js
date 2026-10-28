// 會動的障礙：追人的狗、對向來車、灑水器。純資料＋固定步進，畫面只讀這裡的狀態。
// 狗與灑水器放在非訂戶／任一戶的院子邊；車從前方的左側車道迎面開來，車道前方有騎士就煞停。
import { HAZ, STREET } from './config.js';
import { rng } from './street.js';

/** day：{ dogs, cars, sprinklers }（數量，見 week.js） */
export function makeHazards(street, day = {}) {
  const R = rng(street.seed * 7919 + 17);
  const span = (l) => l.z < -30 && l.z > street.finishZ + 24;
  const take = (pool) => pool.splice(Math.floor(R() * pool.length), 1)[0];
  const dogs = [], cars = [], sprinklers = [];
  const yards = street.lots.filter((l) => !l.sub && span(l));
  for (let k = 0; k < (day.dogs || 0) && yards.length; k++) {
    const l = take(yards), hx = l.side * 9.6, hz = l.z + (R() - 0.5) * 5;
    dogs.push({ id: k, lot: l.id, side: l.side, hx, hz, x: hx, z: hz, yaw: l.side > 0 ? -Math.PI / 2 : Math.PI / 2, v: 0, state: 'sit', t: 0, run: 0 });
  }
  const nc = day.cars || 0;
  for (let k = 0; k < nc; k++) {
    const trig = -16 - (k + 0.2 + R() * 0.6) * (street.length - 70) / nc;
    cars.push({ id: k, trig, x: -1.85, z: 0, v: 0, cruise: HAZ.carSpeed * (0.85 + R() * 0.3), state: 'wait', variant: k % 2, honk: 0 });
  }
  const lawns = street.lots.filter(span);
  for (let k = 0; k < (day.sprinklers || 0) && lawns.length; k++) {
    const l = take(lawns);
    // 植栽帶上、離信箱與樹至少 2.5 m
    let z = l.z + (R() - 0.5) * 8;
    for (let n = 0; n < 8; n++) {
      const near = street.obstacles.some((o) => Math.sign(o.x) === l.side && Math.abs(o.z - z) < 2.5) || Math.abs(l.mailbox.z - z) < 2.5;
      if (!near) break;
      z -= 2.7;
    }
    sprinklers.push({ id: k, lot: l.id, side: l.side, x: l.side * 4.65, z, phase: R() * Math.PI * 2, a: 0, wet: false });
  }
  return { dogs, cars, sprinklers };
}

/** 水柱的方向角：0＝正對馬路（−side 方向），正值往前（−z） */
export const sprayAngle = (s, t) => HAZ.sprSweep * Math.sin((t / HAZ.sprPeriod) * Math.PI * 2 + s.phase);
export const sprayDir = (s, a) => ({ x: -s.side * Math.cos(a), z: -Math.sin(a) });

/** 一步。回傳 { obstacles：這一步會擋路的動態障礙（給 stepBike）、events、wet：騎士在水柱裡 } */
export function stepHazards(H, bike, dt, t) {
  const events = [], obstacles = [];
  for (const d of H.dogs) {
    const dx = bike.x - d.x, dz = bike.z - d.z, dist = Math.hypot(dx, dz);
    if (d.state === 'sit' && bike.z < d.hz + HAZ.dogWake && bike.z > d.hz - 3) { d.state = 'chase'; d.t = 0; events.push({ type: 'bark', dog: d.id }); }
    if (d.state === 'chase') {
      d.t += dt;
      d.v = Math.min(HAZ.dogSpeed, d.v + HAZ.dogAccel * dt);
      const s = Math.min(dist, d.v * dt);
      d.x += (dx / (dist || 1)) * s; d.z += (dz / (dist || 1)) * s; d.yaw = Math.atan2(dx, -dz);
      if (dist < HAZ.dogBite && bike.bumpT === 0) { d.state = 'back'; events.push({ type: 'bite', dog: d.id }); }
      else if (d.t > HAZ.dogChase || dist > 16) { d.state = 'back'; events.push({ type: 'giveup', dog: d.id }); }
    } else if (d.state === 'back') {
      const hx = d.hx - d.x, hz = d.hz - d.z, hd = Math.hypot(hx, hz);
      d.v = 4.0;
      if (hd < 0.1) { d.state = 'home'; d.v = 0; d.yaw = d.side > 0 ? -Math.PI / 2 : Math.PI / 2; }
      else { const s = Math.min(hd, d.v * dt); d.x += (hx / hd) * s; d.z += (hz / hd) * s; d.yaw = Math.atan2(hx, -hz); }
    }
    d.run += d.v * dt;
  }
  for (const c of H.cars) {
    if (c.state === 'wait' && bike.z < c.trig) { c.state = 'drive'; c.z = bike.z - HAZ.carAhead; c.v = c.cruise; }
    if (c.state !== 'drive') continue;
    // 車道前方（+z）7 m 內、車寬範圍內有騎士 → 煞車＋按喇叭
    const ahead = bike.z - c.z, blocked = ahead > 0 && ahead < 2.25 + 7 && Math.abs(bike.x - c.x) < 1.6;
    if (blocked) { if (c.honk <= 0) { events.push({ type: 'honk', car: c.id }); c.honk = 2; } c.v = Math.max(0, c.v - HAZ.carBrake * dt); }
    else c.v = Math.min(c.cruise, c.v + 3 * dt);
    c.honk -= dt;
    c.z += c.v * dt;
    if (c.z > bike.z + 30) c.state = 'gone';
    else obstacles.push({ x: c.x, z: c.z, hw: 0.95, hd: 2.25, kind: 'carMove', car: c.id });
  }
  let wet = false;
  for (const s of H.sprinklers) {
    s.a = sprayAngle(s, t);
    const rx = bike.x - s.x, rz = bike.z - s.z, d = Math.hypot(rx, rz);
    const dir = sprayDir(s, s.a);
    const cos = d > 0.01 ? (rx * dir.x + rz * dir.z) / d : 1;
    const hit = d < HAZ.sprReach && cos > Math.cos(HAZ.sprBeam);
    if (hit && !s.wet) events.push({ type: 'splash', spr: s.id });
    s.wet = hit; wet ||= hit;
  }
  return { obstacles, events, wet };
}

export { STREET };
