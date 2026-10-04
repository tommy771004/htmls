// 車輛控制：Rapier 只負責碰撞，懸吊、抓地、轉向、跳躍、翻滾與空中姿態都由這裡逐 tick 寫進速度。
// 本地座標：+Z 車頭、+Y 車頂、+X 車身左側（右轉是繞車頂軸的負角速度）。
import { Vector3, Quaternion } from 'three';
import { CAR, GRAVITY, CURVATURE, SLIDE_CURV_MUL, curve } from './const.js';
import { arenaSDF, arenaNormal } from './arena.js';

const THROTTLE_CURVE = [[0, CAR.THROTTLE_ACC], [14, 1.6], [14.1, 0]];
const RAY_LEN = 0.417;   // 輪軸接點往下的偵測長度：靜止時壓縮量剛好撐住車重

const _q = new Quaternion(), _fwd = new Vector3(), _up = new Vector3(), _left = new Vector3();
const _p = new Vector3(), _v = new Vector3(), _w = new Vector3(), _a = new Vector3(), _t = new Vector3();
const _n = new Vector3(), _fh = new Vector3(), _rh = new Vector3(), _gn = new Vector3();
const WORLD_UP = new Vector3(0, 1, 0);

const FROZEN = { throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, slide: false };

export function emptyInput() {
  return { throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, slide: false };
}

export function newCarState(team) {
  return {
    team, boost: 33.3,
    input: emptyInput(), prevJump: false,
    contacts: 0, onGround: false, wheels: CAR.WHEELS.map(() => ({ hit: false, dist: RAY_LEN, comp: 0 })),
    groundN: new Vector3(0, 1, 0), prevN: new Vector3(0, 1, 0), autoflip: 0, autoflipDir: 1,
    jumping: false, jumpTime: 0, hasJumped: false, hasDouble: false, hasFlipped: false, sinceJump: 0,
    flipping: false, flipTime: 0, flipAngle: 0, flipP: 0, flipR: 0,
    boosting: false, boostHold: 0, supersonic: false, airTime: 0, groundTime: 0,
    steerVis: 0, spin: 0, speed: 0, lastHitTick: -10, frozen: false,
    demolished: 0,
  };
}

// 讀出車身座標軸（世界座標）
export function carAxes(body, q = _q, fwd = _fwd, up = _up, left = _left) {
  const r = body.rotation();
  q.set(r.x, r.y, r.z, r.w);
  fwd.set(0, 0, 1).applyQuaternion(q);
  up.set(0, 1, 0).applyQuaternion(q);
  left.set(1, 0, 0).applyQuaternion(q);
  return q;
}

export function stepCar(world, R, car, dt, rayGroups, events) {
  const body = car.body, s = car.state;
  if (s.demolished > 0) { s.prevJump = s.input.jump; return; }
  // 開球倒數時車子不能動，但懸吊照算（不然會沉到地板裡）
  const inp = s.frozen ? FROZEN : s.input;
  carAxes(body);
  const t = body.translation(); _p.set(t.x, t.y, t.z);
  const lv = body.linvel(); _v.set(lv.x, lv.y, lv.z);
  const av = body.angvel(); _w.set(av.x, av.y, av.z);
  const m = CAR.MASS;

  // 懸吊：四條射線打球場，彈簧＋阻尼沿車頂方向施力（施力點在輪軸，順便把車身貼齊曲面）
  let contacts = 0;
  _n.set(0, 0, 0);
  const vfPre = _v.dot(_fwd);
  const ray = car.ray;
  ray.dir.x = -_up.x; ray.dir.y = -_up.y; ray.dir.z = -_up.z;
  for (let i = 0; i < 4; i++) {
    const wd = CAR.WHEELS[i], ws = s.wheels[i];
    _a.set(wd.x, wd.y, wd.z).applyQuaternion(_q).add(_p);
    ray.origin.x = _a.x; ray.origin.y = _a.y; ray.origin.z = _a.z;
    const hit = world.castRayAndGetNormal(ray, RAY_LEN, true, undefined, rayGroups, undefined, body);
    if (hit) {
      ws.hit = true; ws.dist = hit.timeOfImpact; ws.comp = RAY_LEN - hit.timeOfImpact;
      // 輪軸點的速度
      _t.copy(_a).sub(_p); const rx = _t.x, ry = _t.y, rz = _t.z;
      const px = _v.x + _w.y * rz - _w.z * ry, py = _v.y + _w.z * rx - _w.x * rz, pz = _v.z + _w.x * ry - _w.y * rx;
      const vUp = px * _up.x + py * _up.y + pz * _up.z;
      let F = CAR.SUSP_STIFF * ws.comp - CAR.SUSP_DAMP * vUp;
      if (F < 0) F = 0;
      const J = F * dt;
      body.applyImpulseAtPoint({ x: _up.x * J, y: _up.y * J, z: _up.z * J }, { x: _a.x, y: _a.y, z: _a.z }, true);
      // 前輪的法線權重較高，車頭先抬，彎道才不會被車殼頂住
      const wgt = wd.front === (vfPre >= 0) ? 2 : 1;
      _n.x += hit.normal.x * wgt; _n.y += hit.normal.y * wgt; _n.z += hit.normal.z * wgt;
      contacts++;
    } else { ws.hit = false; ws.dist = RAY_LEN; ws.comp = 0; }
  }
  s.prevN.copy(s.groundN);
  if (contacts) s.groundN.copy(_n.normalize());
  if (!s.onGround) s.prevN.copy(s.groundN);
  const wasGround = s.onGround;
  s.contacts = contacts;
  s.onGround = contacts >= 3;
  // 施加懸吊衝量後重新讀速度
  const lv2 = body.linvel(); _v.set(lv2.x, lv2.y, lv2.z);
  const av2 = body.angvel(); _w.set(av2.x, av2.y, av2.z);

  const jumpPressed = inp.jump && !s.prevJump;
  s.prevJump = inp.jump;

  if (s.onGround) {
    s.groundTime += dt;
    if (!wasGround && s.airTime > 0.25) events.push({ type: 'land', car, v: s.airTime });
    s.airTime = 0;
    s.autoflip = 0;
    if (!s.jumping && s.groundTime > 0.05) {
      s.hasJumped = false; s.hasDouble = false; s.hasFlipped = false; s.sinceJump = 0; s.flipping = false;
    }
  } else { s.groundTime = 0; s.airTime += dt; }

  // 翻正：車身倒在地上（輪子碰不到、離牆面很近）時按跳躍，彈起並滾回輪子朝下
  let turtled = false;
  if (contacts === 0 && !s.autoflip && arenaSDF(_p.x, _p.y, _p.z) < 0.55) {
    arenaNormal(_p.x, _p.y, _p.z, _gn);
    turtled = _up.dot(_gn) < 0.7;
  }
  if (turtled && jumpPressed) {
    _t.crossVectors(_up, _gn);
    s.autoflipDir = _t.dot(_fwd) >= 0 ? 1 : -1;
    s.autoflip = 0.45;
    _v.addScaledVector(_gn, 3.2);
    events.push({ type: 'jump', car });
  } else if (s.onGround && !s.jumping && jumpPressed) {
    // 跳躍：起跳衝量＋按住 0.2 秒內的持續推力
    s.jumping = true; s.jumpTime = 0; s.hasJumped = true; s.sinceJump = 0;
    _v.addScaledVector(_up, CAR.JUMP_IMPULSE);
    events.push({ type: 'jump', car });
  } else if (!s.onGround && jumpPressed && !s.jumping) {
    const canSecond = !s.hasDouble && !s.hasFlipped && (!s.hasJumped || s.sinceJump < CAR.DOUBLE_JUMP_WINDOW);
    if (canSecond) {
      const dx = -inp.pitch, dy = inp.yaw + inp.roll;
      if (Math.abs(inp.pitch) + Math.abs(inp.yaw) + Math.abs(inp.roll) >= CAR.DODGE_DEADZONE) {
        dodge(car, dx, dy);
        events.push({ type: 'flip', car });
      } else {
        _v.addScaledVector(_up, CAR.JUMP_IMPULSE);
        s.hasDouble = true;
        events.push({ type: 'jump2', car });
      }
    }
  }
  if (s.jumping) {
    s.jumpTime += dt;
    if ((inp.jump || s.jumpTime < CAR.JUMP_MIN) && s.jumpTime < CAR.JUMP_MAX) _v.addScaledVector(_up, CAR.JUMP_ACC * dt);
    else s.jumping = false;
  }
  if (s.hasJumped && !s.onGround) s.sinceJump += dt;

  // 加速
  const wantBoost = inp.boost && s.boost > 0;
  if (wantBoost) s.boostHold = CAR.BOOST_MIN_TIME;
  const boosting = s.boost > 0 && (wantBoost || s.boostHold > 0);
  s.boostHold = Math.max(0, s.boostHold - dt);
  s.boosting = boosting;
  if (boosting) {
    _v.addScaledVector(_fwd, (s.onGround ? CAR.BOOST_ACC_GROUND : CAR.BOOST_ACC_AIR) * dt);
    s.boost = Math.max(0, s.boost - CAR.BOOST_USE * dt);
  }

  if (contacts > 0) {
    const share = contacts / 4;
    let vf = _v.dot(_fwd);
    const vl = _v.dot(_left);
    let dvf = 0;
    const thr = inp.throttle;
    if (thr !== 0 && Math.abs(vf) > 0.25 && Math.sign(thr) !== Math.sign(vf)) {
      dvf = -Math.sign(vf) * Math.min(CAR.BRAKE_ACC * Math.abs(thr) * dt, Math.abs(vf));
    } else if (thr !== 0) {
      dvf = thr * curve(THROTTLE_CURVE, Math.abs(vf)) * dt;
    } else if (!boosting) {
      dvf = -Math.sign(vf) * Math.min(CAR.COAST_ACC * dt, Math.abs(vf));
    }
    // 甩尾時手煞車也會輕微拖慢
    if (inp.slide && s.onGround) dvf -= Math.sign(vf) * Math.min(0.6 * dt, Math.abs(vf));
    _v.addScaledVector(_fwd, dvf * share);
    // 側向抓地：正常幾乎完全吃掉側滑，甩尾時只剩一點
    const grip = inp.slide ? 2.6 : 38;
    const keep = Math.exp(-grip * share * dt);
    _v.addScaledVector(_left, (vl * keep - vl));
    // 平地上沒踩油門又幾乎停住就完全停下；牆上則讓重力慢慢把車拖下來
    if (thr === 0 && !boosting && Math.abs(vf) < 0.25 && _up.y > 0.7) _v.addScaledVector(_fwd, -_v.dot(_fwd));
    // 轉向：照速度查最大曲率，直接設定繞車頂的角速度
    vf = _v.dot(_fwd);
    let k = curve(CURVATURE, Math.abs(vf));
    if (inp.slide) k *= curve(SLIDE_CURV_MUL, Math.abs(vf));
    const target = -inp.steer * k * vf;
    const cur = _w.dot(_up);
    const rate = (inp.slide ? 9 : 22) * share;
    _w.addScaledVector(_up, (target - cur) * (1 - Math.exp(-rate * dt)));
    // 貼著曲面走：把撞進曲面的速度轉回切線方向（保留速率），車身姿態追著地面法線轉，
    // 法線本身的轉速當前饋，牆角彎道才不會一頭撞上去掉速
    if (s.onGround && !s.jumping) {
      const n = s.groundN;
      const sp = _v.length(), vn = _v.dot(n);
      if (vn < 0 && sp > 0.5 && -vn < 0.55 * sp) {
        _v.addScaledVector(n, -vn);
        const lt = _v.length();
        if (lt > 1e-3) _v.multiplyScalar(Math.min(sp, lt * 1.6) / lt);
      }
      _a.crossVectors(s.prevN, n);
      const ffx = _a.x / dt, ffy = _a.y / dt, ffz = _a.z / dt;
      _t.crossVectors(_up, n);
      const yawPart = _w.dot(_up);
      _w.set(ffx + _t.x * 16, ffy + _t.y * 16, ffz + _t.z * 16);
      _w.addScaledVector(_up, yawPart - _w.dot(_up));
    }
    // 貼地力：在牆上或天花板踩油門時加大
    if (s.onGround && !s.jumping) {
      let sticky = CAR.STICKY;
      if (thr !== 0 || boosting) sticky += 1 - Math.abs(_up.y);
      _v.addScaledVector(_up, -sticky * GRAVITY * dt);
    }
    s.steerVis += (inp.steer * Math.min(1, k / 0.69) * 0.55 - s.steerVis) * Math.min(1, dt * 14);
  } else {
    // 空中：油門給一點推力，三軸姿態依 RLBot 量測的力矩與阻尼
    _v.addScaledVector(_fwd, inp.throttle * CAR.AIR_THROTTLE_ACC * dt);
    let p = -_w.dot(_left), y = -_w.dot(_up), r = _w.dot(_fwd);
    if (s.autoflip > 0) {
      s.autoflip = Math.max(0, s.autoflip - dt);
      r += (s.autoflipDir * 6.5 - r) * Math.min(1, dt * 20);
      p *= Math.exp(-dt * 8);
    } else if (s.flipping) {
      s.flipTime += dt;
      s.flipAngle += Math.hypot(p, r) * dt;
      // 翻滾中：往反方向扳可以取消翻轉（flip cancel）
      const cancel = Math.max(0, inp.pitch * Math.sign(-s.flipP)) * (s.flipP !== 0 ? 1 : 0);
      // 翻滾在 218° 左右放手讓阻尼收尾；但如果已經快碰地而輪子還沒朝下，就繼續轉到輪子朝下（原作車頭點地後會順勢滾正）
      let hold = s.flipAngle < 3.8 && s.flipTime < 0.95;
      if (!hold && s.flipAngle < 6.1 && s.flipTime < 1.3 && arenaSDF(_p.x, _p.y, _p.z) < 1.3) {
        arenaNormal(_p.x, _p.y, _p.z, _gn);
        hold = _up.dot(_gn) < 0.75;
      }
      if (hold) {
        p += (s.flipP * CAR.FLIP_RATE * (1 - cancel) - p) * Math.min(1, dt * 30);
        r += (s.flipR * CAR.FLIP_RATE - r) * Math.min(1, dt * 30);
      } else s.flipping = false;
      y += (CAR.T_YAW * inp.yaw - CAR.D_YAW * (1 - Math.abs(inp.yaw)) * y) * dt;
      if (s.flipTime < 0.21 && (_v.y < 0 || s.flipTime < 0.15)) _v.y *= Math.pow(0.65, dt * 120);
    } else {
      p += (CAR.T_PITCH * inp.pitch - CAR.D_PITCH * (1 - Math.abs(inp.pitch)) * p) * dt;
      y += (CAR.T_YAW * inp.yaw - CAR.D_YAW * (1 - Math.abs(inp.yaw)) * y) * dt;
      r += (CAR.T_ROLL * inp.roll - CAR.D_ROLL * r) * dt;
    }
    _w.set(0, 0, 0).addScaledVector(_left, -p).addScaledVector(_up, -y).addScaledVector(_fwd, r);
    s.steerVis *= Math.exp(-dt * 6);
  }

  // 速度上限
  const sp = _v.length();
  if (sp > CAR.MAX_SPEED) _v.multiplyScalar(CAR.MAX_SPEED / sp);
  const wl = _w.length();
  const maxAng = s.flipping ? CAR.FLIP_RATE * 1.05 : CAR.MAX_ANG;
  if (wl > maxAng) _w.multiplyScalar(maxAng / wl);
  body.setLinvel({ x: _v.x, y: _v.y, z: _v.z }, true);
  body.setAngvel({ x: _w.x, y: _w.y, z: _w.z }, true);
  s.speed = _v.length();
  // 超音速：到 22 m/s 進入，掉到 21 以下或維持超過 1 秒沒回到 22 就解除（RocketSim 的規則）
  if (s.speed >= CAR.SUPERSONIC) { s.supersonic = true; s.ssTime = 0; }
  else if (s.supersonic) { s.ssTime = (s.ssTime || 0) + dt; if (s.speed < CAR.SUPERSONIC - 1 || s.ssTime > 1) s.supersonic = false; }
  s.spin += _v.dot(_fwd) * dt / 0.14;
}

// 翻滾（dodge）：速度衝量依車頭水平方向計算，前翻、側翻、後翻各有不同倍率
function dodge(car, dx, dy) {
  const s = car.state;
  const l = Math.hypot(dx, dy) || 1;
  dx /= l; dy /= l;
  if (Math.abs(dx) < 0.1) dx = 0;
  if (Math.abs(dy) < 0.1) dy = 0;
  _fh.set(_fwd.x, 0, _fwd.z);
  if (_fh.lengthSq() < 1e-4) _fh.set(-_up.x, 0, -_up.z);
  _fh.normalize();
  _rh.crossVectors(_fh, WORLD_UP);
  const fs = _v.dot(_fh), ratio = Math.min(1, Math.abs(fs) / CAR.MAX_SPEED);
  const back = Math.abs(fs) < 1 ? dx < 0 : (dx >= 0) !== (fs > 0);
  let ix = dx * CAR.FLIP_VEL, iy = dy * CAR.FLIP_VEL;
  ix *= back ? ((CAR.FLIP_BACK_SCALE - 1) * ratio + 1) * 16 / 15 : ((CAR.FLIP_FWD_SCALE - 1) * ratio + 1);
  iy *= (CAR.FLIP_SIDE_SCALE - 1) * ratio + 1;
  _v.addScaledVector(_fh, ix).addScaledVector(_rh, iy);
  s.hasFlipped = true; s.flipping = true; s.flipTime = 0; s.flipAngle = 0;
  s.flipP = -dx; s.flipR = dy;
}
