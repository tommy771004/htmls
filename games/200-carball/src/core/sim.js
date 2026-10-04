// 對局：Rapier 世界、兩台車、一顆球、補給點、計時、進球與重播紀錄。不碰 DOM，瀏覽器與 Node 測試共用。
import { Vector3, Quaternion } from 'three';
import { TICK, GRAVITY, ARENA, BALL, CAR, HIT, PADS_BIG, PADS_SMALL, PAD, KICKOFFS, MATCH, curve } from './const.js';
import { buildArenaMesh, physicsTrimesh } from './arena.js';
import { newCarState, stepCar, carAxes, emptyInput } from './car.js';

const G_ARENA = 0x0001, G_CAR = 0x0002, G_BALL = 0x0004, G_SHELL = 0x0008;
const groups = (member, filter) => ((member & 0xffff) << 16) | (filter & 0xffff);

const REC_HZ = 60, REC_SECONDS = 8;
export const REC_STRIDE = 7 + 2 * 11;   // 球 pos+quat，每台車 pos+quat+加速+轉向+輪轉+離地+隱藏

const _q = new Quaternion(), _a = new Vector3(), _b = new Vector3(), _c = new Vector3(), _d = new Vector3();
const _fwd = new Vector3(), _up = new Vector3(), _left = new Vector3();

export class Sim {
  constructor(R, opts = {}) {
    this.R = R;
    this.opts = opts;
    this.world = new R.World({ x: 0, y: -GRAVITY, z: 0 });
    this.world.timestep = TICK;
    this.world.numSolverIterations = 6;
    this.tick = 0;
    this.time = 0;
    this.events = [];
    this.rayGroups = groups(0xffff, G_ARENA);
    this.mesh = buildArenaMesh();
    this.buildArena();
    this.ball = this.makeBall();
    if (opts.swapCreate) { const b = this.makeCar(1), a = this.makeCar(0); this.cars = [a, b]; } else this.cars = [this.makeCar(0), this.makeCar(1)];
    this.pads = [
      ...PADS_BIG.map(([x, z]) => ({ x, z, big: true, t: 0 })),
      ...PADS_SMALL.map(([x, z]) => ({ x, z, big: false, t: 0 })),
    ];
    this.score = [0, 0];
    this.clock = MATCH.LENGTH;
    this.overtime = false;
    this.phase = 'kickoff';
    this.phaseT = MATCH.COUNTDOWN;
    this.lastTouch = -1;
    this.goalInfo = null;
    this.rec = new Float32Array(REC_HZ * REC_SECONDS * REC_STRIDE);
    this.recCount = 0;
    this.recHead = 0;
    this.kickoffIndex = 0;
    this.resetKickoff(opts.kickoff);
  }

  buildArena() {
    const R = this.R, w = this.world;
    const tm = physicsTrimesh(this.mesh);
    const body = w.createRigidBody(R.RigidBodyDesc.fixed());
    const flags = R.TriMeshFlags.FIX_INTERNAL_EDGES;
    const mk = (desc) => w.createCollider(desc.setFriction(0.35).setRestitution(0.6)
      .setFrictionCombineRule(R.CoefficientCombineRule.Multiply).setRestitutionCombineRule(R.CoefficientCombineRule.Multiply)
      .setCollisionGroups(groups(G_ARENA, 0xffff)), body);
    mk(R.ColliderDesc.trimesh(tm.vertices, tm.indices, flags));
    const { A, B, H, GD } = ARENA;
    mk(R.ColliderDesc.cuboid(A + 4, 2, B + GD + 4).setTranslation(0, -2, 0));
    mk(R.ColliderDesc.cuboid(A + 4, 2, B + GD + 4).setTranslation(0, H + 2, 0));
  }

  makeBall() {
    const R = this.R, w = this.world;
    const body = w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, BALL.R, 0)
      .setCcdEnabled(true).setLinearDamping(BALL.DRAG).setAngularDamping(0.03));
    const col = w.createCollider(R.ColliderDesc.ball(BALL.R).setMass(BALL.MASS)
      .setFriction(1).setRestitution(1)
      .setFrictionCombineRule(R.CoefficientCombineRule.Multiply).setRestitutionCombineRule(R.CoefficientCombineRule.Multiply)
      .setCollisionGroups(groups(G_BALL, 0xffff)), body);
    return { body, col };
  }

  makeCar(team) {
    const R = this.R, w = this.world;
    const body = w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, CAR.REST_Y, 0).setCcdEnabled(true));
    const [hx, hy, hz] = CAR.HALF, [ox, oy, oz] = CAR.HIT_OFS;
    // 碰撞箱拆兩份：對球場無摩擦（牆角彎道擦到車殼也不會掉速），對球與車照原作摩擦 2.0
    const col = w.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(ox, oy, oz).setMass(CAR.MASS)
      .setFriction(2).setRestitution(0.1)
      .setFrictionCombineRule(R.CoefficientCombineRule.Multiply).setRestitutionCombineRule(R.CoefficientCombineRule.Multiply)
      .setCollisionGroups(groups(G_CAR, G_CAR | G_BALL)), body);
    const shell = w.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(ox, oy, oz).setMass(0)
      .setFriction(0).setRestitution(0)
      .setFrictionCombineRule(R.CoefficientCombineRule.Min).setRestitutionCombineRule(R.CoefficientCombineRule.Min)
      .setCollisionGroups(groups(G_SHELL, G_ARENA)), body);
    // 質心放在車身原點（RL 的車也是），轉動慣量用碰撞箱的值放大，被球撞不會亂轉
    const Ix = CAR.MASS / 12 * (4 * hy * hy + 4 * hz * hz) * 1.6, Iy = CAR.MASS / 12 * (4 * hx * hx + 4 * hz * hz) * 1.6, Iz = CAR.MASS / 12 * (4 * hx * hx + 4 * hy * hy) * 1.6;
    col.setMassProperties(CAR.MASS, { x: 0, y: 0, z: 0 }, { x: Ix, y: Iy, z: Iz }, { x: 0, y: 0, z: 0, w: 1 });
    const car = { body, col, shell, team, state: newCarState(team), ray: new R.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 }) };
    return car;
  }

  // 依開球編號擺車，兩隊對稱
  resetKickoff(index) {
    const k = index ?? Math.floor(this.rand() * KICKOFFS.length);
    this.kickoffIndex = k;
    const spot = KICKOFFS[k];
    this.placeBall(0, BALL.R, 0, 0, 0, 0);
    for (const car of this.cars) {
      if (car.state.parked) continue;
      const flip = car.team === 1 ? -1 : 1;
      const x = spot.x * flip, z = spot.z * flip;
      const yaw = car.team === 1 ? spot.yaw + Math.PI : spot.yaw;
      this.placeCar(car, x, CAR.REST_Y, z, yaw);
      const s = car.state;
      s.boost = 33.3; s.demolished = 0;
      s.jumping = false; s.hasJumped = false; s.hasDouble = false; s.hasFlipped = false; s.flipping = false;
      s.input = emptyInput();
    }
    for (const p of this.pads) p.t = 0;
    this.phase = 'kickoff';
    this.phaseT = MATCH.COUNTDOWN;
    this.goalInfo = null;
    this.lastTouch = -1;
  }

  rand() {
    // 簡單的可重現亂數（測試可指定種子）
    this.seed = ((this.seed ?? this.opts.seed ?? 12345) * 1103515245 + 12345) >>> 0;
    return (this.seed >>> 8) / 16777216;
  }

  placeBall(x, y, z, vx = 0, vy = 0, vz = 0, wx = 0, wy = 0, wz = 0) {
    const b = this.ball.body;
    b.setTranslation({ x, y, z }, true);
    b.setLinvel({ x: vx, y: vy, z: vz }, true);
    b.setAngvel({ x: wx, y: wy, z: wz }, true);
    b.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  }

  placeCar(car, x, y, z, yaw = 0, vel = null, quat = null) {
    const b = car.body;
    b.setTranslation({ x, y, z }, true);
    if (quat) b.setRotation(quat, true);
    else { _q.setFromAxisAngle(_a.set(0, 1, 0), yaw); b.setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w }, true); }
    b.setLinvel(vel || { x: 0, y: 0, z: 0 }, true);
    b.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  // 推進一個物理 tick
  step() {
    const dt = TICK;
    this.tick++;
    this.time += dt;
    const ph = this.phase;
    if (ph === 'kickoff') {
      this.phaseT -= dt;
      for (const car of this.cars) car.state.frozen = true;
      if (this.phaseT <= 0) {
        this.phase = 'play';
        this.goTick = this.tick;
        for (const car of this.cars) if (!car.state.parked) car.state.frozen = false;
        this.events.push({ type: 'go' });
      }
    }
    for (const car of this.cars) {
      const s = car.state;
      if (s.demolished > 0) {
        s.demolished -= dt;
        if (s.demolished <= 0) this.respawn(car);
      }
      stepCar(this.world, this.R, car, dt, this.rayGroups, this.events);
    }
    if (ph === 'kickoff') {
      for (const car of this.cars) {
        car.body.setLinvel({ x: 0, y: car.body.linvel().y, z: 0 }, true);
        car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
    // 撞球額外衝量要用碰撞前的相對速度（RocketSim 在碰撞回呼裡算），先存起來
    const bv = this.ball.body.linvel();
    this.preBall = this.preBall || { x: 0, y: 0, z: 0 };
    this.preBall.x = bv.x; this.preBall.y = bv.y; this.preBall.z = bv.z;
    for (const car of this.cars) {
      const v = car.body.linvel();
      car.pre = car.pre || { x: 0, y: 0, z: 0 };
      car.pre.x = v.x; car.pre.y = v.y; car.pre.z = v.z;
    }
    this.world.step();
    this.afterStep(dt);
    if (this.tick % (120 / REC_HZ) === 0) this.record();
  }

  afterStep(dt) {
    const ball = this.ball.body;
    if (this.pendingHit) {
      const v0 = ball.linvel(), h = this.pendingHit;
      ball.setLinvel({ x: v0.x + h.x, y: v0.y + h.y, z: v0.z + h.z }, true);
      this.pendingHit = null;
    }
    const bp = ball.translation();
    // 撞球：Rapier 已經處理剛體碰撞，這裡再加上 RL 的額外衝量，讓車頭的方向與速度決定球路
    if (this.phase !== 'goal') {
      for (const car of this.cars) {
        if (car.state.demolished > 0 || car.state.parked) continue;
        const touch = this.carBallTouch(car, bp);
        if (!touch) continue;
        const s = car.state;
        const fresh = this.tick > s.lastHitTick + 1;
        const cp = car.body.translation(), cv = car.pre, pb = this.preBall;
        _a.set(bp.x - cp.x, bp.y - cp.y, bp.z - cp.z);
        _b.set(pb.x - cv.x, pb.y - cv.y, pb.z - cv.z);
        const rel = Math.min(_b.length(), HIT.MAX_DV);
        if (fresh && rel > 0) {
          carAxes(car.body, _q, _fwd, _up, _left);
          _a.y *= HIT.Z_SCALE;
          _a.normalize();
          _c.copy(_fwd).multiplyScalar(_a.dot(_fwd) * (1 - HIT.FWD_SCALE));
          _a.sub(_c).normalize();
          const add = rel * curve(HIT.CURVE, rel);
          // 延後到下一 tick 才加：讓 Rapier 先把這次的剛體碰撞解完，兩者疊加才是原作的力道
          const ph = this.pendingHit || (this.pendingHit = { x: 0, y: 0, z: 0 });
          ph.x += _a.x * add; ph.y += _a.y * add; ph.z += _a.z * add;
          if (this.phase === 'play' || this.phase === 'kickoff') this.lastTouch = car.team;
          this.events.push({ type: 'hit', car, power: rel, x: bp.x, y: bp.y, z: bp.z });
        }
        s.lastHitTick = this.tick;
      }
    }
    // 車撞車：超音速撞上對手就擊毀
    this.carBump();
    // 球速上限
    const v = ball.linvel();
    const sp = Math.hypot(v.x, v.y, v.z);
    if (sp > BALL.MAX_SPEED) { const k = BALL.MAX_SPEED / sp; ball.setLinvel({ x: v.x * k, y: v.y * k, z: v.z * k }, true); }
    const w = ball.angvel();
    const ws = Math.hypot(w.x, w.y, w.z);
    if (ws > BALL.MAX_ANG) { const k = BALL.MAX_ANG / ws; ball.setAngvel({ x: w.x * k, y: w.y * k, z: w.z * k }, true); }

    this.pickPads(dt);

    if (this.phase === 'play') {
      if (this.noClock) { /* 練習與標題畫面不計時 */ } else if (!this.overtime) {
        this.clock = Math.max(0, this.clock - dt);
        // 時間到要等球落地才結束（RL 的規則）
        if (this.clock <= 0 && ball.translation().y < BALL.R + 0.15) this.timeUp();
      } else this.clock += dt;
      const bz = ball.translation().z;
      if (Math.abs(bz) > ARENA.B + BALL.R) this.onGoal(bz > 0 ? 0 : 1);
    } else if (this.phase === 'goal') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        if (this.goalInfo && this.overtime) { this.phase = 'over'; this.events.push({ type: 'over' }); }
        else if (this.clock <= 0 && !this.overtime) this.timeUp();
        else {
          this.phase = 'post';
          this.events.push({ type: 'postgoal' });
          if (this.opts.autoKickoff) this.kickoffAfterGoal();
        }
      }
    }
  }

  // 時間到：平手進延長賽（黃金進球），否則結束
  timeUp() {
    if (this.score[0] === this.score[1]) {
      this.overtime = true;
      this.clock = 0;
      this.goalInfo = null;
      this.phase = 'post';
      this.events.push({ type: 'overtime' });
      if (this.opts.autoKickoff) this.kickoffAfterGoal();
    } else { this.phase = 'over'; this.events.push({ type: 'over' }); }
  }

  onGoal(team) {
    this.score[team]++;
    const bp = this.ball.body.translation();
    const bv = this.ball.body.linvel();
    const speed = Math.hypot(bv.x, bv.y, bv.z);
    this.goalInfo = { team, scorer: this.lastTouch, speed, x: bp.x, y: bp.y, z: bp.z, tick: this.tick };
    this.phase = 'goal';
    this.phaseT = MATCH.GOAL_PAUSE;
    // 爆炸把附近的車推開，球藏到場外
    for (const car of this.cars) {
      const cp = car.body.translation();
      _a.set(cp.x - bp.x, cp.y - bp.y, cp.z - bp.z);
      const d = _a.length();
      if (d < 18) {
        _a.normalize().multiplyScalar((18 - d) * 1.1);
        const cv = car.body.linvel();
        car.body.setLinvel({ x: cv.x + _a.x, y: cv.y + _a.y + 3, z: cv.z + _a.z }, true);
      }
    }
    this.placeBall(0, -50, 0);
    this.ball.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.ball.body.setGravityScale(0, true);
    this.events.push({ type: 'goal', ...this.goalInfo });
  }

  respawn(car) {
    const z = car.team === 0 ? -46 : 46;
    this.placeCar(car, car.team === 0 ? -6 : 6, CAR.REST_Y, z, car.team === 0 ? 0 : Math.PI);
    car.state.boost = 33.3;
    car.state.demolished = 0;
    car.col.setEnabled(true);
    car.shell.setEnabled(true);
  }

  carBallTouch(car, bp) {
    const b = car.body, t = b.translation(), r = b.rotation();
    _q.set(r.x, r.y, r.z, r.w).invert();
    _d.set(bp.x - t.x, bp.y - t.y, bp.z - t.z).applyQuaternion(_q);
    _d.x -= CAR.HIT_OFS[0]; _d.y -= CAR.HIT_OFS[1]; _d.z -= CAR.HIT_OFS[2];
    const [hx, hy, hz] = CAR.HALF;
    const cx = Math.max(-hx, Math.min(hx, _d.x)), cy = Math.max(-hy, Math.min(hy, _d.y)), cz = Math.max(-hz, Math.min(hz, _d.z));
    const dist = Math.hypot(_d.x - cx, _d.y - cy, _d.z - cz);
    return dist <= BALL.R + 0.03;
  }

  carBump() {
    const [c0, c1] = this.cars;
    if (c0.state.demolished > 0 || c1.state.demolished > 0) return;
    const p0 = c0.body.translation(), p1 = c1.body.translation();
    const d = Math.hypot(p0.x - p1.x, p0.y - p1.y, p0.z - p1.z);
    if (d > 1.9) return;
    let touching = false;
    this.world.contactPair(c0.col, c1.col, (m) => { if (m.numContacts() > 0) touching = true; });
    if (!touching) return;
    if (this.tick < (this.lastBump ?? -100) + 30) return;
    this.lastBump = this.tick;
    for (const [att, vic] of [[c0, c1], [c1, c0]]) {
      const av = att.pre, at = att.body.translation(), vt = vic.body.translation();   // 碰撞前的速度
      _a.set(vt.x - at.x, vt.y - at.y, vt.z - at.z).normalize();
      const closing = av.x * _a.x + av.y * _a.y + av.z * _a.z;
      if (att.state.supersonic && closing > 15 && this.phase === 'play') {
        this.demolish(vic, att);
        att.body.setLinvel({ x: av.x, y: av.y, z: av.z }, true);   // 撞毀的一方直接穿過，不減速
        return;
      }
    }
    this.events.push({ type: 'bump', x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2, z: (p0.z + p1.z) / 2 });
  }

  demolish(car, by) {
    const t = car.body.translation();
    car.state.demolished = 3;
    car.col.setEnabled(false);
    car.shell.setEnabled(false);
    this.events.push({ type: 'demo', car, by, x: t.x, y: t.y, z: t.z });
    car.body.setTranslation({ x: t.x, y: -30, z: t.z }, true);
    car.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  pickPads(dt) {
    for (const p of this.pads) {
      if (p.t > 0) { p.t -= dt; if (p.t <= 0) this.events.push({ type: 'padup', pad: p }); continue; }
      for (const car of this.cars) {
        const s = car.state;
        if (s.demolished > 0 || s.parked || s.boost >= 100) continue;
        const t = car.body.translation();
        const r = p.big ? PAD.BIG_R : PAD.SMALL_R;
        if (t.y > PAD.H || (t.x - p.x) ** 2 + (t.z - p.z) ** 2 > r * r) continue;
        s.boost = p.big ? 100 : Math.min(100, s.boost + PAD.SMALL_AMT);
        p.t = p.big ? PAD.BIG_T : PAD.SMALL_T;
        this.events.push({ type: 'pad', pad: p, car });
        break;
      }
    }
  }

  // 重播紀錄：環狀緩衝，每秒 60 格
  record() {
    const S = REC_STRIDE, cap = this.rec.length / S;
    const o = this.recHead * S, r = this.rec;
    const bt = this.ball.body.translation(), bq = this.ball.body.rotation();
    r[o] = bt.x; r[o + 1] = bt.y; r[o + 2] = bt.z; r[o + 3] = bq.x; r[o + 4] = bq.y; r[o + 5] = bq.z; r[o + 6] = bq.w;
    for (let i = 0; i < 2; i++) {
      const c = this.cars[i], s = c.state, k = o + 7 + i * 11;
      const t = c.body.translation(), q = c.body.rotation();
      r[k] = t.x; r[k + 1] = t.y; r[k + 2] = t.z; r[k + 3] = q.x; r[k + 4] = q.y; r[k + 5] = q.z; r[k + 6] = q.w;
      r[k + 7] = s.boosting ? 1 : 0; r[k + 8] = s.steerVis; r[k + 9] = s.spin; r[k + 10] = s.demolished > 0 ? 1 : (s.onGround ? 0 : 0.5);
    }
    this.recHead = (this.recHead + 1) % cap;
    this.recCount = Math.min(this.recCount + 1, cap);
  }

  // 取出最後 n 格（舊到新）
  recording(seconds) {
    const S = REC_STRIDE, cap = this.rec.length / S;
    // 不要錄到開球倒數（進球太快時重播只從開球那一刻開始）
    const sinceGo = Math.floor((this.tick - (this.goTick ?? 0)) / (120 / REC_HZ));
    const n = Math.max(0, Math.min(this.recCount, Math.round(seconds * REC_HZ), sinceGo));
    const out = new Float32Array(n * S);
    for (let i = 0; i < n; i++) {
      const src = ((this.recHead - n + i) % cap + cap) % cap;
      out.set(this.rec.subarray(src * S, src * S + S), i * S);
    }
    return { frames: out, n, hz: REC_HZ };
  }

  kickoffAfterGoal() {
    this.ball.body.setGravityScale(1, true);
    this.resetKickoff();
  }

  restart() {
    this.score = [0, 0];
    this.clock = MATCH.LENGTH;
    this.overtime = false;
    this.recCount = 0;
    this.kickoffAfterGoal();
  }

  drainEvents() { const e = this.events; this.events = []; return e; }
}

export { CAR, BALL, ARENA };
