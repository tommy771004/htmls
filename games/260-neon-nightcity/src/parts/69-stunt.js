// ═══ 第四階段：飛車特技跳台（跳台位置與模型在 20-props.js 的 RAMPS） ═══
// 車輛物理本來只貼地（30-vehicles.js），這裡補上跳台斜面與拋物線飛行：
// 在斜面上把 v.y、v.pitch 換成斜面高度；衝出邊緣時給垂直速度，之後由 stuntFly() 代替 driveVehicle()（99-main.js）積分到落地。
// 時速 60 以上衝出去算特技：0.4 倍慢動作＋側面固定機位，落地車頭沒歪就依距離與高度給獎金，每座跳台第一次完成加倍。
// 空中可以操控車身：左右＝翻滾、油門／煞車＝前後空翻（沒按就慢慢回正、車頭跟著拋物線）。每轉滿一圈獎金多五成；
// 落地時車身歪超過 0.5 rad 算失敗，翻過 1.3 rad（側翻、倒栽蔥）就是翻車：重損，車速剩四成。
// 排在 69-police 之後；slowmo.st 由 99-main.js 的 loop 和轉盤、特殊能力取最慢的。

const STUNT_MIN = 60 / 3.6;
const stunt = { cam: null, camT: 0, n: 0 };
// 二十座跳台加上縫裡的鐵灣高架斷橋（06-roads.js 的 BROKEN，自己的長、高、寬；不算在跳台收集裡）
const JUMPS = [...RAMPS, BROKEN];
const rampL = r => r.L || RAMP_L, rampH = r => r.H || RAMP_H, rampW = r => r.W || RAMP_W;
// 跳台斜面上的位置：a 是從斜坡起點算起的距離（0…斜坡長）
function rampAt(x, z) {
  for (const r of JUMPS) {
    const L = rampL(r), a = (x - r.x) * r.dx + (z - r.z) * r.dz + L, b = (x - r.x) * r.dz - (z - r.z) * r.dx;
    if (Math.abs(b) < rampW(r) / 2 + .3 && a > -.5 && a < L + .6) return { r, a };
  }
  return null;
}
// driveVehicle() 之後呼叫：順向開上斜面就抬高車身，衝過邊緣就起飛
function stuntGround(v, vF) {
  const on = rampAt(v.x, v.z), prev = v.rampA;
  v.rampA = null;
  if (!on) return;
  const along = Math.sin(v.yaw) * on.r.dx + Math.cos(v.yaw) * on.r.dz;
  if (along < .5 || vF < 1) return;   // 倒車或橫著開過去：當成沒有跳台
  const r = on.r, L = rampL(r), H = rampH(r), th = Math.atan2(H, L);
  if (on.a <= L) {
    v.rampA = on.a;
    v.y = Math.max(0, on.a / L * H); v.pitch = -th * clamp(on.a, 0, 1);
    return;
  }
  if (prev == null) return;
  // 衝出邊緣：水平速度不變，垂直速度依斜面角度
  const vy = vF * Math.sin(th) * 1.35 + 1, qual = vF >= STUNT_MIN && v === player.veh;
  v.air = { vy, t: 0, x0: v.x, z0: v.z, h: H, yaw0: v.yaw, qual, r, rr: 0, pr: 0, rolls: 0, flips: 0 };
  v.y = H;
  if (qual) {
    slowmo.st = r.broken ? .25 : .4; stunt.n++;
    // 側面固定機位：跳台邊緣往前 12 m、偏右 11 m、高 3.5 m，看著車（斷橋拉遠拉高，看得到底下的路）
    const rx = r.dz, rz = -r.dx, s = (stunt.n % 2) * 2 - 1, f = r.broken ? 24 : 12, o = r.broken ? 19 : 11;
    stunt.cam = V3(r.x + r.dx * f + rx * s * o, r.broken ? 4.5 : 3.5, r.z + r.dz * f + rz * s * o); stunt.camT = 0;
    sfx.swoosh(true);
  }
}
// 飛行中（99-main.js 用它代替 driveVehicle）：不能轉向加速，只有重力與車身翻轉；回傳和 driveVehicle 一樣的欄位
function stuntFly(v, inp, dt) {
  const A = v.air, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), vF = v.vx * fx + v.vz * fz;
  A.t += dt; A.vy -= 9.8 * dt;
  if (A.qual && A.r.broken) slowmo.st = A.t < .5 ? .25 : .55;   // 斷橋飛得久：起飛那半秒 0.25 倍，之後放快一點
  v.x += v.vx * dt; v.z += v.vz * dt; v.y += A.vy * dt;
  A.h = Math.max(A.h, v.y);
  const st = inp ? inp.steer || 0 : 0, pc = inp ? (inp.thr || 0) - (inp.brk || 0) : 0;
  A.rr = damp(A.rr, -st * 7.5, 5, dt); A.pr = damp(A.pr, pc * 6, 5, dt);
  v.roll += A.rr * dt; v.pitch += A.pr * dt;
  A.rolls += Math.abs(A.rr) * dt; A.flips += Math.abs(A.pr) * dt;
  // 沒在操控、而且還沒翻過頭：慢慢回正，車頭跟著拋物線
  if (Math.abs(st) < .1 && Math.abs(wrapA(v.roll)) < .9) v.roll = damp(wrapA(v.roll), 0, 2.5, dt);
  if (Math.abs(pc) < .1 && Math.abs(wrapA(v.pitch)) < .9) v.pitch = damp(wrapA(v.pitch), clamp(-Math.atan2(A.vy, Math.max(4, vF)) * .8, -.35, .4), 3, dt);
  if (!v.isCar) v.lean = v.roll;
  v.spin += vF * dt / v.wr;
  v.rpm = Math.min(1, v.rpm + dt * .6);
  const gh = groundH(v.x, v.z);
  let imp = 0;
  if (v.y <= gh) { imp = stuntLand(v, gh); }
  return { imp, vF, aF: 0 };
}
function stuntLand(v, gh) {
  const A = v.air, hit = -A.vy, rw = Math.abs(wrapA(v.roll)), pw = Math.abs(wrapA(v.pitch));
  const wreck = rw > 1.3 || pw > 1.2, rolls = Math.floor((A.rolls + .8) / 6.283), flips = Math.floor((A.flips + .8) / 6.283);
  v.air = null; v.y = gh; v.pitch = .05; v.roll = 0; v.lean = 0; v.rampA = null;
  v.vx *= wreck ? .4 : .82; v.vz *= wreck ? .4 : .82;
  camState.shake = Math.max(camState.shake, wreck ? 1 : clamp(hit / 16, .2, .8)); sfx.impact(wreck ? 20 : hit);
  if (wreck) { damageVeh(v, 520); sparks(v.x, .4, v.z, 30, 6); glassBurst(v.x, 1.1, v.z); }
  else if (hit > 12 || rw > .5) damageVeh(v, Math.max(0, hit - 12) * 40 + (rw > .5 ? 120 : 0));
  if (A.r.broken && v === player.veh) brokenLanded(v, Math.hypot(v.x - A.x0, v.z - A.z0), wreck);   // 69-heist.js：逃亡時飛過斷橋就甩開眼前的警察
  if (!A.qual) return hit;
  slowmo.st = 1; stunt.camT = .5;
  const dist = Math.hypot(v.x - A.x0, v.z - A.z0), trick = [rolls ? `翻滾 ×${rolls}` : '', flips ? `空翻 ×${flips}` : ''].filter(Boolean).join('、');
  const clean = !wreck && rw < .5 && pw < .6 && Math.abs(wrapA(v.yaw - A.yaw0)) < .45 && !v.dead && !life.dead;
  if (!clean) { toast(`${wreck ? '翻車了' : '特技失敗'} · 飛了 ${dist.toFixed(0)} m${trick ? ` · ${trick}` : ''}`); return hit; }
  const first = A.r.i != null && !motors.stunts.includes(A.r.i);
  const pay = Math.round((200 + dist * 25 + A.h * 150) * (1 + .5 * (rolls + flips)) * (first ? 2 : 1) / 10) * 10;
  if (first) { motors.stunts.push(A.r.i); }
  earn(pay, `${A.r.broken ? '鐵灣高架斷橋' : '特技跳台'}${first ? `（首次 ${motors.stunts.length}/${RAMPS.length}）` : ''} · ${dist.toFixed(0)} m、高 ${A.h.toFixed(1)} m${trick ? ` · ${trick}` : ''}`);
  return hit;
}
// 鏡頭：crewLate() 之後覆寫，落地後再停 0.5 秒
function stuntLate() {
  for (const v of vehicles) if (v.air && v !== player.veh) stuntReset(v);   // 飛到一半換人、死亡或傳送：直接落地
  if (!stunt.cam) return;
  const v = player.veh;
  if (!v || player.mode !== 'drive' || stunt.camT > 0 && (stunt.camT -= slowmo.raw) <= 0) { stunt.cam = null; slowmo.st = 1; camState.snap = true; return; }
  camera.position.copy(stunt.cam); camera.lookAt(v.x, v.y + .8, v.z);
}
function stuntReset(v) { if (v && v.air) { v.air = null; v.y = groundH(v.x, v.z); v.roll = 0; v.lean = 0; v.pitch = 0; if (v === player.veh) { stunt.cam = null; slowmo.st = 1; } } }
// 測試 API（window.__nc.gta.stunt）
const stuntApi = {
  stunt, RAMPS, rampAt, reset: stuntReset,
  // 每座跳台的助跑道（邊緣前 34 m）與落地、滑行區（後 56 m）有沒有被建築、路燈、樹等擋住：回傳被擋的距離
  probe: () => RAMPS.map(r => {
    const bad = [];
    for (let a = -RAMP_L - 24; a <= 56; a += 2) for (const b of [-1.1, 0, 1.1]) {
      const x = r.x + r.dx * a + r.dz * b, z = r.z + r.dz * a - r.dx * b, q = collideCircle(x, z, .5, false);
      if (Math.hypot(q.x - x, q.z - z) > .05) { bad.push(a); break; }
    }
    return { i: r.i, bad };
  }),
};
