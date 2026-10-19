// 車輛控制：Rapier 只負責碰撞；懸吊、抓地、轉向、甩尾、跳躍、冷氣推進、空中姿態都由這裡逐 tick 寫進速度。
// 不碰 DOM，瀏覽器與 Node 測試共用。
import { Vector3, Quaternion } from 'three';
import { CAR, GRAVITY, curve, G_CAR, G_BALL, G_SHELL, G_WORLD, G_REMOTE, groups } from './const.js';

const _q = new Quaternion(), _fwd = new Vector3(), _up = new Vector3(), _left = new Vector3();
const _p = new Vector3(), _v = new Vector3(), _w = new Vector3(), _a = new Vector3(), _t = new Vector3();
const _n = new Vector3();
const WORLD_UP = new Vector3(0, 1, 0);

export function emptyInput() {
  return { throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false };
}

export function newCarState() {
  return {
    input: emptyInput(), prevJump: false, frozen: false,
    aero: 'AUTO', suction: 'GRIP', lights: 1,
    gas: CAR.GAS_MAX, gasIdle: 0,
    contacts: 0, onGround: false, wheels: CAR.WHEELS.map(() => ({ hit: false, comp: 0 })),
    groundN: new Vector3(0, 1, 0), prevN: new Vector3(0, 1, 0),
    airTime: 0, groundTime: 0, jumpLock: 0, jumpHeld: 0, sinceJump: 9,
    autoflip: 0, autoflipDir: 1, turtleT: 0,
    drifting: false, driftT: 0, slip: 0,
    boosting: false, hovering: false, braking: false,
    wingH: 0, wingA: 0, steerVis: 0, spin: 0, speed: 0, vf: 0,
    launchY: 0, maxAirY: 0,
  };
}

// 建立車身剛體與兩份碰撞箱：車殼對場地無摩擦（擦到曲面不掉速），對球與車有摩擦
export function makeCar(R, world, x = 0, y = CAR.REST_Y, z = 0, yaw = 0) {
  const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x, y, z).setCcdEnabled(true)
    .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }));
  const [hx, hy, hz] = CAR.HALF, [ox, oy, oz] = CAR.HIT_OFS;
  const col = world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(ox, oy, oz)
    .setFriction(0.6).setRestitution(0.15)
    .setCollisionGroups(groups(G_CAR, G_CAR | G_BALL | G_REMOTE)), body);
  const shell = world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(ox, oy, oz).setMass(0)
    .setFriction(0).setRestitution(0)
    .setFrictionCombineRule(R.CoefficientCombineRule.Min).setRestitutionCombineRule(R.CoefficientCombineRule.Min)
    .setCollisionGroups(groups(G_SHELL, G_WORLD)), body);
  // 質心壓低、轉動慣量放大：被撞不會亂轉，姿態仍由控制器直接寫角速度
  const m = CAR.MASS, k = 1.4;
  const Ix = m / 12 * (4 * hy * hy + 4 * hz * hz) * k, Iy = m / 12 * (4 * hx * hx + 4 * hz * hz) * k, Iz = m / 12 * (4 * hx * hx + 4 * hy * hy) * k;
  col.setMassProperties(m, { x: 0, y: 0.1, z: 0 }, { x: Ix, y: Iy, z: Iz }, { x: 0, y: 0, z: 0, w: 1 });
  return { body, col, shell, state: newCarState(), ray: new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }) };
}

export function carAxes(body, q = _q, fwd = _fwd, up = _up, left = _left) {
  const r = body.rotation();
  q.set(r.x, r.y, r.z, r.w);
  fwd.set(0, 0, 1).applyQuaternion(q);
  up.set(0, 1, 0).applyQuaternion(q);
  left.set(1, 0, 0).applyQuaternion(q);
  return q;
}

export function placeCar(car, x, y, z, yaw, speed = 0) {
  const b = car.body;
  b.setTranslation({ x, y, z }, true);
  b.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
  b.setLinvel({ x: Math.sin(yaw) * speed, y: 0, z: Math.cos(yaw) * speed }, true);
  b.setAngvel({ x: 0, y: 0, z: 0 }, true);
  const s = car.state;
  s.drifting = false; s.airTime = 0; s.jumpLock = 0; s.autoflip = 0; s.hovering = false; s.turtleT = 0;
  s.groundN.set(0, 1, 0); s.prevN.set(0, 1, 0);
}

// 一個 tick。rayGroups：懸吊射線打得到的群組。events：推入 {type, …}
export function stepCar(world, car, dt, rayGroups, events) {
  const body = car.body, s = car.state;
  const inp = s.frozen ? FROZEN : s.input;
  carAxes(body);
  const t = body.translation(); _p.set(t.x, t.y, t.z);
  const lv = body.linvel(); _v.set(lv.x, lv.y, lv.z);
  const av = body.angvel(); _w.set(av.x, av.y, av.z);
  const aero = CAR.AERO[s.aero] || CAR.AERO.AUTO;

  // 懸吊：四條射線沿車底方向打場地，彈簧＋阻尼沿車頂方向施力
  let contacts = 0;
  _n.set(0, 0, 0);
  const vfPre = _v.dot(_fwd);
  const ray = car.ray;
  ray.dir.x = -_up.x; ray.dir.y = -_up.y; ray.dir.z = -_up.z;
  for (let i = 0; i < 4; i++) {
    const wd = CAR.WHEELS[i], ws = s.wheels[i];
    _a.set(wd.x, wd.y, wd.z).applyQuaternion(_q).add(_p);
    ray.origin.x = _a.x; ray.origin.y = _a.y; ray.origin.z = _a.z;
    const hit = s.jumpLock > 0.12 ? null : world.castRayAndGetNormal(ray, CAR.RAY, true, undefined, rayGroups, undefined, body);
    if (hit) {
      ws.hit = true; ws.comp = CAR.RAY - hit.timeOfImpact;
      _t.copy(_a).sub(_p);
      const px = _v.x + _w.y * _t.z - _w.z * _t.y, py = _v.y + _w.z * _t.x - _w.x * _t.z, pz = _v.z + _w.x * _t.y - _w.y * _t.x;
      const vUp = px * _up.x + py * _up.y + pz * _up.z;
      let F = CAR.SUSP_K * ws.comp - CAR.SUSP_C * vUp;
      if (F < 0) F = 0;
      if (F > 90000) F = 90000;
      const J = F * dt;
      body.applyImpulseAtPoint({ x: _up.x * J, y: _up.y * J, z: _up.z * J }, { x: _a.x, y: _a.y, z: _a.z }, true);
      const wgt = wd.front === (vfPre >= 0) ? 2 : 1;
      _n.x += hit.normal.x * wgt; _n.y += hit.normal.y * wgt; _n.z += hit.normal.z * wgt;
      contacts++;
    } else { ws.hit = false; ws.comp = 0; }
  }
  s.prevN.copy(s.groundN);
  if (contacts) s.groundN.copy(_n.normalize());
  if (!s.onGround) s.prevN.copy(s.groundN);
  const wasGround = s.onGround;
  s.contacts = contacts;
  s.onGround = contacts >= 3;
  const lv2 = body.linvel(); _v.set(lv2.x, lv2.y, lv2.z);
  const av2 = body.angvel(); _w.set(av2.x, av2.y, av2.z);

  const jumpPressed = inp.jump && !s.prevJump;
  s.prevJump = inp.jump;
  s.jumpLock = Math.max(0, s.jumpLock - dt);
  s.sinceJump += dt;

  if (s.onGround) {
    if (!wasGround && s.airTime > 0.2) {
      // 落地保速：輪子朝下著地時，把速度轉到地面切線方向，只損失一點
      const vn = _v.dot(s.groundN), sp = _v.length();
      const upright = _up.dot(s.groundN);
      if (upright > 0.55 && vn < 0) {
        _v.addScaledVector(s.groundN, -vn);
        const lt = _v.length();
        if (lt > 1e-3) _v.multiplyScalar(Math.min(sp * 0.94, lt + (-vn) * 0.55) / lt);
      }
      events.push({ type: 'land', car, air: s.airTime, upright, impact: -vn, height: s.maxAirY - s.launchY });
    }
    s.groundTime += dt; s.airTime = 0; s.autoflip = 0; s.hovering = false;
  } else {
    if (wasGround) { s.launchY = _p.y; s.maxAirY = _p.y; events.push({ type: 'launch', car, speed: _v.length() }); }
    s.groundTime = 0; s.airTime += dt;
    if (_p.y > s.maxAirY) s.maxAirY = _p.y;
  }

  // 翻正：四輪朝天倒在地上時，按跳躍彈起來滾回輪子朝下；倒太久自動翻
  let turtled = false;
  if (contacts === 0 && _up.y < 0.25 && !s.autoflip) {
    ray.origin.x = _p.x; ray.origin.y = _p.y; ray.origin.z = _p.z;
    ray.dir.x = _up.x; ray.dir.y = _up.y; ray.dir.z = _up.z;
    turtled = !!world.castRay(ray, 1.3, true, undefined, rayGroups, undefined, body);
    ray.dir.x = 0; ray.dir.y = -1; ray.dir.z = 0;
    const down = world.castRay(ray, 1.6, true, undefined, rayGroups, undefined, body);
    turtled = turtled || (!!down && _v.length() < 4);
  }
  s.turtleT = turtled ? s.turtleT + dt : 0;
  if (turtled && (jumpPressed || s.turtleT > 1.6)) {
    s.autoflip = 0.5;
    _t.crossVectors(_up, WORLD_UP);
    s.autoflipDir = _t.dot(_fwd) >= 0 ? 1 : -1;
    _v.y += 5.5;
    s.jumpLock = 0.3;
    events.push({ type: 'jump', car });
  } else if (s.onGround && jumpPressed && s.jumpLock <= 0) {
    _v.addScaledVector(_up, CAR.JUMP);
    s.jumpLock = 0.25; s.sinceJump = 0; s.jumpHeld = 0;
    events.push({ type: 'jump', car });
  }

  // 冷氣推進：Shift 往前推；空中按住空白鍵是升力（起跳後要先放開或按住超過 0.18 秒）
  if (inp.jump) s.jumpHeld += dt; else s.jumpHeld = 0;
  let using = false;
  const boosting = inp.boost && s.gas > 0;
  if (boosting) {
    _v.addScaledVector(_fwd, (contacts ? CAR.BOOST_ACC : CAR.BOOST_AIR_ACC) * dt);
    s.gas = Math.max(0, s.gas - CAR.BOOST_USE * dt);
    using = true;
  }
  if (boosting && !s.boosting) events.push({ type: 'boost', car });
  s.boosting = boosting;
  const hover = !s.onGround && contacts < 2 && inp.jump && s.gas > 0 && (s.sinceJump > 0.18 || s.airTime > 0.25) && !s.autoflip;
  if (hover) {
    _v.addScaledVector(_up, CAR.HOVER_ACC * dt);
    s.gas = Math.max(0, s.gas - CAR.HOVER_USE * dt);
    using = true;
  }
  if (hover && !s.hovering) events.push({ type: 'hover', car });
  s.hovering = hover;
  if (using) s.gasIdle = 0;
  else { s.gasIdle += dt; if (s.gasIdle > CAR.GAS_DELAY) s.gas = Math.min(CAR.GAS_MAX, s.gas + CAR.GAS_REGEN * dt); }

  // 空氣阻力（地面全額、空中六成）與主動尾翼的空氣煞車
  const sp0 = _v.length();
  let vfNow = _v.dot(_fwd);
  s.braking = inp.throttle < -0.2 && vfNow > 6;
  if (sp0 > 0.01) {
    let dragA = CAR.DRAG * aero.drag * sp0 * sp0 * (contacts ? 1 : 0.6);
    if (s.aero === 'AUTO' && s.braking && sp0 > 22) dragA += 7;
    _v.multiplyScalar(Math.max(0, sp0 - dragA * dt) / sp0);
  }

  if (contacts > 0) {
    const share = contacts / 4;
    let vf = _v.dot(_fwd);
    const vl = _v.dot(_left);
    const sp = Math.hypot(vf, vl);
    const thr = inp.throttle;
    let dvf = 0;
    if (thr !== 0 && Math.abs(vf) > 1 && Math.sign(thr) !== Math.sign(vf)) {
      dvf = -Math.sign(vf) * Math.min(CAR.BRAKE * Math.abs(thr) * dt, Math.abs(vf));
    } else if (thr > 0) {
      dvf = thr * curve(CAR.THROTTLE, Math.max(0, vf)) * dt;
    } else if (thr < 0) {
      dvf = vf > -CAR.REVERSE_MAX ? thr * 14 * dt : 0;
    } else if (!boosting) {
      dvf = -Math.sign(vf) * Math.min(CAR.COAST * dt, Math.abs(vf));
    }
    if (inp.handbrake) dvf -= Math.sign(vf) * Math.min(4 * dt, Math.abs(vf));
    _v.addScaledVector(_fwd, dvf * share);

    // 甩尾：手煞車、高速點煞打方向、或側滑角已經夠大就進入；滑角收回來才結束
    const slip = Math.atan2(vl, Math.max(Math.abs(vf), 0.5));
    s.slip = slip;
    if (s.onGround && sp > 9 && (inp.handbrake || (thr < -0.2 && vf > 14 && Math.abs(inp.steer) > 0.5) || Math.abs(slip) > 0.32)) {
      if (!s.drifting) { s.drifting = true; s.driftT = 0; events.push({ type: 'driftStart', car }); }
    }
    if (s.drifting) {
      s.driftT += dt;
      if ((!inp.handbrake && Math.abs(slip) < 0.1 && s.driftT > 0.3) || sp < 5 || !s.onGround) {
        s.drifting = false; events.push({ type: 'driftEnd', car, t: s.driftT });
      }
    }
    const grip = s.drifting ? CAR.DRIFT_GRIP * (thr > 0 ? 1 : 1.8) : CAR.GRIP * aero.grip;
    const keep = Math.exp(-grip * share * dt);
    _v.addScaledVector(_left, vl * keep - vl);
    // 甩尾時油門把車推向車頭方向，出彎才有力
    if (s.drifting && thr > 0) _v.addScaledVector(_fwd, 4 * thr * share * dt);
    // 平地幾乎停住又沒油門：完全停下
    if (thr === 0 && !boosting && Math.abs(vf) < 0.4 && _up.y > 0.8) _v.addScaledVector(_fwd, -_v.dot(_fwd));

    // 轉向：照速度查最大曲率，直接設定繞車頂的角速度；甩尾時方向盤直接控制偏航率，放開時車頭追回速度方向
    vf = _v.dot(_fwd);
    const k = curve(CAR.CURVATURE, Math.abs(vf)) * Math.sqrt(aero.grip);
    let target, rate;
    if (s.drifting) {
      target = -inp.steer * (1.25 + 1.3 * Math.min(1, sp / 30)) * Math.sign(vf || 1) + 2.2 * slip * (1 - Math.abs(inp.steer) * 0.6);
      rate = 7 * share;
    } else {
      target = -inp.steer * k * vf;
      rate = 18 * share;
    }
    const cur = _w.dot(_up);
    _w.addScaledVector(_up, (target - cur) * (1 - Math.exp(-rate * dt)));

    // 貼著曲面走：撞進曲面的速度轉回切線方向（保留速率），車身姿態追著地面法線。
    // 高速過迴圈時常只剩兩輪著地，兩輪就要接手，不然車頭會直直插進彎道
    if (contacts >= 2 && s.jumpLock <= 0) {
      const n = s.groundN;
      const spd = _v.length(), vn = _v.dot(n);
      if (vn < 0 && spd > 0.5 && -vn < 0.6 * spd) {
        _v.addScaledVector(n, -vn);
        const lt = _v.length();
        if (lt > 1e-3) _v.multiplyScalar(Math.min(spd, lt * 1.6) / lt);
      }
      _a.crossVectors(s.prevN, n);
      const ffx = _a.x / dt, ffy = _a.y / dt, ffz = _a.z / dt;
      _t.crossVectors(_up, n);
      const yawPart = _w.dot(_up);
      _w.set(ffx + _t.x * 14, ffy + _t.y * 14, ffz + _t.z * 14);
      _w.addScaledVector(_up, yawPart - _w.dot(_up));
      // 貼地力：下壓尾翼隨速度加大；在牆上踩油門加大；吸附系統 WALL 檔直接吸住接觸面
      let sticky = CAR.STICKY + aero.down * Math.min(1, spd / 60);
      if (thr !== 0 || boosting) sticky += (1 - Math.abs(_up.y)) * 0.8;
      if (s.suction === 'WALL') sticky = Math.max(sticky, CAR.WALL_STICKY);
      _v.addScaledVector(_up, -sticky * GRAVITY * dt);
    }
    s.steerVis += (inp.steer * Math.min(1, k / 0.15) * 0.5 - s.steerVis) * Math.min(1, dt * 12);
  } else {
    s.drifting = false;
    // 空中：油門給一點推力；三軸角加速度＋沒輸入時的阻尼；升力飛行時側推自動扶正滾轉
    _v.addScaledVector(_fwd, inp.throttle * 2 * dt);
    let p = -_w.dot(_left), y = -_w.dot(_up), r = _w.dot(_fwd);
    if (s.autoflip > 0) {
      s.autoflip = Math.max(0, s.autoflip - dt);
      r += (s.autoflipDir * 7 - r) * Math.min(1, dt * 20);
      p *= Math.exp(-dt * 8);
    } else {
      const ip = inp.pitch, iy = inp.yaw, ir = inp.roll;
      // 開下跳台（不是自己起跳）的前 0.25 秒：吃掉台口給的俯仰轉速，高速下車頭才不會往下栽
      if (s.airTime < 0.25 && s.sinceJump > 0.5 && !ip) p *= Math.exp(-dt * 30);
      p += (CAR.AIR_PITCH * ip - CAR.AIR_DAMP * (1 - Math.abs(ip)) * p) * dt;
      y += (CAR.AIR_YAW * iy - CAR.AIR_DAMP * (1 - Math.abs(iy)) * y) * dt;
      r += (CAR.AIR_ROLL * ir - CAR.AIR_DAMP * 1.4 * (1 - Math.abs(ir)) * r) * dt;
      // 沒有俯仰輸入時，車頭慢慢順著飛行方向（落地坡才接得住）；正在翻的時候不干涉
      if (!s.hovering && !ip && !ir && s.airTime > 0.3 && Math.abs(p) < 2.5) {
        const vf = _v.dot(_fwd), vu = _v.dot(_up);
        if (vf > 8) p += (Math.atan2(vu, vf) * 1.6 - p) * Math.min(1, dt * 2.2);
      }
      if (s.hovering && !ir) {
        // 側推：把車身滾回水平、俯仰也慢慢收回
        const bank = Math.asin(Math.max(-1, Math.min(1, _left.y)));
        r += (-bank * 5 - r) * Math.min(1, dt * 6);
        if (!ip) { const pitchAng = Math.asin(Math.max(-1, Math.min(1, _fwd.y))); p += (pitchAng * 3 - p) * Math.min(1, dt * 4); }
      }
    }
    _w.set(0, 0, 0).addScaledVector(_left, -p).addScaledVector(_up, -y).addScaledVector(_fwd, r);
    s.steerVis *= Math.exp(-dt * 6);
  }

  const spd = _v.length();
  if (spd > CAR.MAX_SPEED) _v.multiplyScalar(CAR.MAX_SPEED / spd);
  const wl = _w.length();
  const maxAng = s.autoflip > 0 ? 8 : CAR.MAX_ANG;
  if (wl > maxAng) _w.multiplyScalar(maxAng / wl);
  body.setLinvel({ x: _v.x, y: _v.y, z: _v.z }, true);
  body.setAngvel({ x: _w.x, y: _w.y, z: _w.z }, true);
  s.speed = _v.length();
  s.vf = _v.dot(_fwd);
  s.spin += s.vf * dt / 0.36;

  // 主動尾翼：AUTO 依速度升起、煞車時立起當空氣煞車；LOW 收平；HIGH 全升
  let wh = 0, wa = 0.05;
  if (s.aero === 'HIGH') { wh = 1; wa = 0.32; }
  else if (s.aero === 'AUTO') { wh = s.speed > 24 || s.braking || s.hovering ? 1 : 0; wa = s.braking && s.speed > 18 ? 1.0 : (s.hovering ? 0.45 : 0.16); }
  s.wingH += (wh - s.wingH) * Math.min(1, dt * 5);
  s.wingA += (wa - s.wingA) * Math.min(1, dt * 7);
}

const FROZEN = emptyInput();

// 加速墊：補冷氣、往車頭方向推一把
export function turbo(car, amount = 40, kick = 10) {
  const s = car.state, b = car.body;
  s.gas = Math.min(CAR.GAS_MAX, s.gas + amount);
  carAxes(b);
  const v = b.linvel();
  b.setLinvel({ x: v.x + _fwd.x * kick, y: v.y + _fwd.y * kick, z: v.z + _fwd.z * kick }, true);
}
