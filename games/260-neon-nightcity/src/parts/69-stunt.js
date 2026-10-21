// ═══ 第四階段：飛車特技跳台（跳台位置與模型在 20-props.js 的 RAMPS） ═══
// 車輛物理本來只貼地（30-vehicles.js），這裡補上跳台斜面與拋物線飛行：
// 在斜面上把 v.y、v.pitch 換成斜面高度；衝出邊緣時給垂直速度，之後由 stuntFly() 代替 driveVehicle()（99-main.js）積分到落地。
// 時速 60 以上衝出去算特技：0.4 倍慢動作＋側面固定機位，落地車頭沒歪就依距離與高度給獎金，每座跳台第一次完成加倍。
// 排在 69-police 之後；slowmo.st 由 99-main.js 的 loop 和轉盤、特殊能力取最慢的。

const STUNT_MIN = 60 / 3.6, RAMP_TH = Math.atan2(RAMP_H, RAMP_L);
const stunt = { cam: null, camT: 0, n: 0 };
// 跳台斜面上的位置：a 是從斜坡起點算起的距離（0…RAMP_L）
function rampAt(x, z) {
  for (const r of RAMPS) {
    const a = (x - r.x) * r.dx + (z - r.z) * r.dz + RAMP_L, b = (x - r.x) * r.dz - (z - r.z) * r.dx;
    if (Math.abs(b) < RAMP_W / 2 + .3 && a > -.5 && a < RAMP_L + .6) return { r, a };
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
  if (on.a <= RAMP_L) {
    v.rampA = on.a;
    v.y = Math.max(0, on.a / RAMP_L * RAMP_H); v.pitch = -RAMP_TH * clamp(on.a, 0, 1);
    return;
  }
  if (prev == null) return;
  // 衝出邊緣：水平速度不變，垂直速度依斜面角度
  const vy = vF * Math.sin(RAMP_TH) * 1.35 + 1, qual = vF >= STUNT_MIN && v === player.veh;
  v.air = { vy, t: 0, x0: v.x, z0: v.z, h: RAMP_H, yaw0: v.yaw, qual, r: on.r };
  v.y = RAMP_H;
  if (qual) {
    slowmo.st = .4; stunt.n++;
    // 側面固定機位：跳台邊緣往前 12 m、偏右 11 m、高 3.5 m，看著車
    const r = on.r, rx = r.dz, rz = -r.dx, s = (stunt.n % 2) * 2 - 1;
    stunt.cam = V3(r.x + r.dx * 12 + rx * s * 11, 3.5, r.z + r.dz * 12 + rz * s * 11); stunt.camT = 0;
    sfx.swoosh(true);
  }
}
// 飛行中（99-main.js 用它代替 driveVehicle）：不能轉向加速，只有重力；回傳和 driveVehicle 一樣的欄位
function stuntFly(v, dt) {
  const A = v.air, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), vF = v.vx * fx + v.vz * fz;
  A.t += dt; A.vy -= 9.8 * dt;
  v.x += v.vx * dt; v.z += v.vz * dt; v.y += A.vy * dt;
  A.h = Math.max(A.h, v.y);
  v.pitch = damp(v.pitch, clamp(-Math.atan2(A.vy, Math.max(4, vF)) * .8, -.35, .4), 4, dt);
  v.roll = damp(v.roll, 0, 4, dt); v.spin += vF * dt / v.wr;
  v.rpm = Math.min(1, v.rpm + dt * .6);
  const gh = groundH(v.x, v.z);
  let imp = 0;
  if (v.y <= gh) { imp = stuntLand(v, gh); }
  return { imp, vF, aF: 0 };
}
function stuntLand(v, gh) {
  const A = v.air, hit = -A.vy;
  v.air = null; v.y = gh; v.pitch = .05; v.rampA = null;
  v.vx *= .82; v.vz *= .82;
  camState.shake = Math.max(camState.shake, clamp(hit / 16, .2, .8)); sfx.impact(hit);
  if (hit > 12) damageVeh(v, (hit - 12) * 40);
  if (!A.qual) return hit;
  slowmo.st = 1; stunt.camT = .5;
  const dist = Math.hypot(v.x - A.x0, v.z - A.z0), clean = Math.abs(wrapA(v.yaw - A.yaw0)) < .45 && !v.dead && !life.dead;
  if (!clean) { toast(`特技失敗 · 飛了 ${dist.toFixed(0)} m`); return hit; }
  const first = !motors.stunts.includes(A.r.i);
  const pay = Math.round((200 + dist * 25 + A.h * 150) * (first ? 2 : 1) / 10) * 10;
  if (first) { motors.stunts.push(A.r.i); }
  earn(pay, `特技跳台${first ? `（首次 ${motors.stunts.length}/${RAMPS.length}）` : ''} · ${dist.toFixed(0)} m、高 ${A.h.toFixed(1)} m`);
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
function stuntReset(v) { if (v && v.air) { v.air = null; v.y = groundH(v.x, v.z); if (v === player.veh) { stunt.cam = null; slowmo.st = 1; } } }
// 大地圖：跳台畫成小箭頭（完成過的變暗）
function stuntBig(c, X, Z, s) {
  for (const r of RAMPS) {
    const x = X(r.x), y = Z(r.z), d = 9 / s, done = motors.stunts.includes(r.i);
    c.save(); c.translate(x, y); c.rotate(Math.atan2(r.dz, r.dx));
    c.fillStyle = done ? 'rgba(217,180,42,.45)' : '#d9b42a';
    c.beginPath(); c.moveTo(d, 0); c.lineTo(-d * .7, -d * .7); c.lineTo(-d * .3, 0); c.lineTo(-d * .7, d * .7); c.closePath(); c.fill();
    c.restore();
  }
}

// 測試 API（window.__nc.gta.stunt）
const stuntApi = { stunt, RAMPS, rampAt, reset: stuntReset };
