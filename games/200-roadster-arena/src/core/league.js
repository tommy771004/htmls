// 車球聯賽的物理與規則：圓角球場、巨型足球、本機的車（玩家＋AI）、遠端玩家的車（運動學剛體，跟著快照走）。
// 離線時規則（開球、計時、進球、比分）都在這裡跑；連線時規則由房間伺服器裁定，這裡只負責「球歸誰算」與進球偵測。
// 不碰 DOM，Node 測試與瀏覽器共用。
import { Vector3, Quaternion } from 'three';
import { TICK, CAR, BALL, ARENA, LEAGUE, GRAVITY, G_WORLD, G_BALL, G_CAR, G_REMOTE, groups } from './const.js';
import { newWorld, fixedCollider, cuboidCollider } from './world.js';
import { makeCar, stepCar, placeCar, carAxes, emptyInput, turbo } from './car.js';
import { buildArenaMesh, physicsTrimesh, arenaSDF, arenaNormal } from './arena.js';

const _q = new Quaternion(), _f = new Vector3(), _u = new Vector3(), _l = new Vector3(), _d = new Vector3(), _n = new Vector3();
const _a = new Vector3();
export const TEAM_NAMES = ['RED', 'ICE'];

// 開球站位：各隊在自己半場排成 V 字，第一個人在中線前
export function kickoffSpot(team, idx) {
  const own = team === 0 ? -1 : 1;
  const row = Math.floor((idx + 1) / 2), side = idx === 0 ? 0 : (idx % 2 ? 1 : -1);
  const x = side * (12 + row * 9);
  const z = own * (30 + row * 10 + (idx === 0 ? 0 : 6));
  return { x, z, yaw: team === 0 ? 0 : Math.PI };
}

// 加速墊：四個角落與兩側中線各一塊，補冷氣
export const LEAGUE_PADS = [
  [-ARENA.A + 14, -ARENA.B + 20], [ARENA.A - 14, -ARENA.B + 20], [-ARENA.A + 14, ARENA.B - 20], [ARENA.A - 14, ARENA.B - 20],
  [-ARENA.A + 10, 0], [ARENA.A - 10, 0],
].map(([x, z]) => ({ x, z, cool: 0 }));

export class League {
  constructor(R, { online = false } = {}) {
    this.R = R;
    this.online = online;
    const world = this.world = newWorld(R);
    this.mesh = buildArenaMesh();
    const tm = physicsTrimesh(this.mesh);
    fixedCollider(R, world, R.ColliderDesc.trimesh(tm.vertices, tm.indices, R.TriMeshFlags.FIX_INTERNAL_EDGES), 0.4, 0.2);
    cuboidCollider(R, world, 0, -2, 0, ARENA.A + ARENA.GD + 20, 2, ARENA.B + ARENA.GD + 20);
    cuboidCollider(R, world, 0, ARENA.H + 2, 0, ARENA.A + 20, 2, ARENA.B + ARENA.GD + 20);
    this.rayGroups = groups(0xffff, G_WORLD);
    const bd = R.RigidBodyDesc.dynamic().setTranslation(0, BALL.R, 0).setCcdEnabled(true).setAngularDamping(0.4);
    this.ball = world.createRigidBody(bd);
    this.ballCol = world.createCollider(R.ColliderDesc.ball(BALL.R).setMass(BALL.MASS).setRestitution(BALL.REST).setFriction(BALL.FRIC)
      .setCollisionGroups(groups(G_BALL, G_WORLD | G_CAR | G_REMOTE)), this.ball);
    this.ballKinematic = false;
    this.cars = [];     // 本機模擬的車：{ id, team, name, car, bot, local }
    this.remotes = new Map();
    this.score = [0, 0];
    this.clock = LEAGUE.CLOCK;
    this.phase = 'kickoff'; this.phaseT = LEAGUE.KICKOFF;
    this.lastTouch = null; this.touchCool = new Map();
    this.events = [];
    this.overtime = false;
    this.goalWait = 0;
    this.pads = LEAGUE_PADS.map((p) => ({ ...p }));
  }

  addCar(id, team, name, bot = null) {
    const car = makeCar(this.R, this.world, 0, CAR.REST_Y, 0, 0);
    const e = { id, team, name, car, bot, idx: 0 };
    this.cars.push(e);
    this.reindex();
    return e;
  }

  removeCar(id) {
    const i = this.cars.findIndex((c) => c.id === id);
    if (i < 0) return;
    const e = this.cars[i];
    this.world.removeRigidBody(e.car.body);
    this.cars.splice(i, 1);
    this.reindex();
  }

  reindex() {
    const n = [0, 0];
    for (const c of this.cars) c.idx = n[c.team]++;
  }

  // 遠端玩家的車：運動學剛體，位置由快照內插後寫入
  setRemote(id, team, name, st) {
    let r = this.remotes.get(id);
    if (!r) {
      const R = this.R;
      const body = this.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(st.p[0], st.p[1], st.p[2]));
      const [hx, hy, hz] = CAR.HALF, [ox, oy, oz] = CAR.HIT_OFS;
      this.world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(ox, oy, oz).setFriction(0.6)
        .setCollisionGroups(groups(G_REMOTE, G_CAR | G_BALL)), body);
      r = { id, team, name, body, st };
      this.remotes.set(id, r);
    }
    r.team = team; r.name = name; r.st = st;
    r.body.setNextKinematicTranslation({ x: st.p[0], y: st.p[1], z: st.p[2] });
    r.body.setNextKinematicRotation({ x: st.q[0], y: st.q[1], z: st.q[2], w: st.q[3] });
    return r;
  }

  dropRemote(id) {
    const r = this.remotes.get(id);
    if (!r) return;
    this.world.removeRigidBody(r.body);
    this.remotes.delete(id);
  }

  kickoff() {
    for (const c of this.cars) {
      const k = kickoffSpot(c.team, c.idx);
      placeCar(c.car, k.x, CAR.REST_Y + 0.05, k.z, k.yaw);
      c.car.state.gas = Math.max(c.car.state.gas, 40);
    }
    this.placeBall(0, BALL.R + 0.02, 0, 0, 0, 0);
    this.lastTouch = null;
    this.phase = 'kickoff'; this.phaseT = LEAGUE.KICKOFF;
    for (const p of this.pads) p.cool = 0;
  }

  placeBall(x, y, z, vx = 0, vy = 0, vz = 0, w = null) {
    const b = this.ball;
    b.setTranslation({ x, y, z }, true);
    b.setLinvel({ x: vx, y: vy, z: vz }, true);
    b.setAngvel(w ? { x: w[0], y: w[1], z: w[2] } : { x: 0, y: 0, z: 0 }, true);
  }

  // 連線時：球不歸自己管就跟著快照走（運動學）；歸自己就交給物理
  setBallAuthority(mine) {
    if (mine === !this.ballKinematic) return;
    this.ballKinematic = !mine;
    this.ball.setBodyType(mine ? this.R.RigidBodyType.Dynamic : this.R.RigidBodyType.KinematicPositionBased, true);
  }

  ballState() {
    const b = this.ball, p = b.translation(), v = b.linvel(), w = b.angvel(), q = b.rotation();
    return { p: [p.x, p.y, p.z], v: [v.x, v.y, v.z], w: [w.x, w.y, w.z], q: [q.x, q.y, q.z, q.w] };
  }

  frozen() { return this.phase === 'kickoff' || this.phase === 'ended'; }

  tick(inputs) {
    const ev = this.events;
    ev.length = 0;
    const frozen = this.frozen();
    for (const c of this.cars) {
      const s = c.car.state;
      if (c.bot) c.bot.update(this, c, TICK);
      else if (inputs && inputs[c.id]) Object.assign(s.input, inputs[c.id]);
      s.frozen = frozen;
      stepCar(this.world, c.car, TICK, this.rayGroups, ev);
    }
    if (!this.ballKinematic) this.ballPhysics();
    this.hits(ev);
    this.padsUpdate(ev);
    this.world.step();
    this.rules(ev);
    return ev;
  }

  ballPhysics() {
    const b = this.ball, v = b.linvel();
    const sp = Math.hypot(v.x, v.y, v.z);
    let k = 1 - BALL.DRAG * TICK;
    if (sp * k > BALL.MAX_SPEED) k = BALL.MAX_SPEED / sp;
    if (k !== 1) b.setLinvel({ x: v.x * k, y: v.y * k, z: v.z * k }, true);
    const w = b.angvel(), wl = Math.hypot(w.x, w.y, w.z);
    if (wl > BALL.MAX_ANG) { const s = BALL.MAX_ANG / wl; b.setAngvel({ x: w.x * s, y: w.y * s, z: w.z * s }, true); }
    const p = b.translation();
    // 卡出場外（穿牆）就放回中場上空
    if (p.y < -5 || p.y > ARENA.H + 6 || Math.abs(p.x) > ARENA.A + 6 || Math.abs(p.z) > ARENA.B + ARENA.GD + 6) this.placeBall(0, 12, 0);
  }

  // 車碰到球：除了剛體碰撞，再補一點沿車頭方向的衝量（真實質量下球會太「重」，手感不爽快）
  hits(ev) {
    const bp = this.ball.translation(), bv = this.ball.linvel();
    for (const c of this.cars) {
      const cool = this.touchCool.get(c.id) || 0;
      if (cool > 0) this.touchCool.set(c.id, cool - TICK);
      const body = c.car.body;
      const q = carAxes(body, _q, _f, _u, _l);
      const t = body.translation(), v = body.linvel();
      // 球心轉到車身座標，找車殼方盒上的最近點
      _d.set(bp.x - t.x, bp.y - t.y, bp.z - t.z);
      const lx = _d.dot(_l) - CAR.HIT_OFS[0], ly = _d.dot(_u) - CAR.HIT_OFS[1], lz = _d.dot(_f) - CAR.HIT_OFS[2];
      const [hx, hy, hz] = CAR.HALF;
      const cx = Math.max(-hx, Math.min(hx, lx)), cy = Math.max(-hy, Math.min(hy, ly)), cz = Math.max(-hz, Math.min(hz, lz));
      const dist = Math.hypot(lx - cx, ly - cy, lz - cz);
      if (dist > BALL.R + 0.35) continue;
      _n.copy(_l).multiplyScalar(lx - cx).addScaledVector(_u, ly - cy).addScaledVector(_f, lz - cz);
      if (_n.lengthSq() < 1e-6) _n.copy(_d);
      _n.normalize();
      const closing = (v.x - bv.x) * _n.x + (v.y - bv.y) * _n.y + (v.z - bv.z) * _n.z;
      if (closing > 1.5 && (cool <= 0)) {
        // 衝量方向：碰撞法線偏向車頭與上方一點，正面撞球會往前上飛
        _a.copy(_n).addScaledVector(_f, 0.35).addScaledVector(_u, 0.12).normalize();
        const dv = closing * BALL.HIT + 4;
        if (!this.ballKinematic) this.ball.setLinvel({ x: bv.x + _a.x * dv, y: bv.y + _a.y * dv, z: bv.z + _a.z * dv }, true);
        this.touchCool.set(c.id, 0.12);
        this.lastTouch = c.id;
        ev.push({ type: 'touch', id: c.id, team: c.team, speed: closing, bot: !!c.bot });
      } else if (dist < BALL.R + 0.1 && cool <= 0) {
        this.lastTouch = c.id;
        this.touchCool.set(c.id, 0.3);
        ev.push({ type: 'touch', id: c.id, team: c.team, speed: Math.max(0, closing), soft: true, bot: !!c.bot });
      }
    }
  }

  padsUpdate(ev) {
    for (const p of this.pads) {
      p.cool = Math.max(0, p.cool - TICK);
      if (p.cool > 0) continue;
      for (const c of this.cars) {
        const t = c.car.body.translation();
        if (Math.abs(t.x - p.x) < 4 && Math.abs(t.z - p.z) < 4 && t.y < 3) {
          turbo(c.car, 60, 0);
          p.cool = 6;
          ev.push({ type: 'pad', id: c.id, x: p.x, z: p.z });
          break;
        }
      }
    }
  }

  // 進球：球整顆越過球門線、在門框內
  goalCheck() {
    const p = this.ball.translation();
    if (Math.abs(p.x) < ARENA.GW && p.y < ARENA.GH && Math.abs(p.z) > ARENA.B + BALL.R * 0.9) return p.z > 0 ? 0 : 1;
    return -1;
  }

  rules(ev) {
    if (this.online) {
      // 連線時只做本機偵測：球歸自己管才報進球，計時與比分等伺服器；伺服器 1 秒內沒回應就再報一次
      if (this.goalWait > 0) this.goalWait--;
      if (!this.ballKinematic && (this.phase === 'play' || this.phase === 'warmup')) {
        const g = this.goalCheck();
        if (g >= 0 && !this.goalWait) { this.goalWait = 120; ev.push({ type: 'goalClaim', team: g, by: this.lastTouch }); }
      }
      return;
    }
    if (this.phase === 'kickoff') {
      const before = Math.ceil(this.phaseT);
      this.phaseT -= TICK;
      if (Math.ceil(this.phaseT) !== before && this.phaseT > 0) ev.push({ type: 'count', n: Math.ceil(this.phaseT) });
      if (this.phaseT <= 0) { this.phase = 'play'; ev.push({ type: 'go' }); }
    } else if (this.phase === 'play') {
      if (!this.overtime) this.clock = Math.max(0, this.clock - TICK);
      const g = this.goalCheck();
      if (g >= 0) {
        this.score[g]++;
        const by = this.cars.find((c) => c.id === this.lastTouch);
        ev.push({ type: 'goal', team: g, by: by ? by.name : null, byId: this.lastTouch, own: by ? by.team !== g : false, score: this.score.slice() });
        this.phase = 'goal'; this.phaseT = LEAGUE.GOAL_PAUSE;
      } else if (this.clock <= 0 && !this.overtime) {
        // 時間到：球落地才結束；平手進延長賽（先進球的贏）
        const bp = this.ball.translation();
        if (bp.y < BALL.R + 1.5) {
          if (this.score[0] === this.score[1]) { this.overtime = true; ev.push({ type: 'overtime' }); }
          else this.end(ev);
        }
      }
    } else if (this.phase === 'goal') {
      this.phaseT -= TICK;
      if (this.phaseT <= 0) {
        if ((this.clock <= 0 && this.score[0] !== this.score[1]) || this.overtime) this.end(ev);
        else { this.kickoff(); ev.push({ type: 'kickoff' }); }
      }
    } else if (this.phase === 'ended') {
      this.phaseT -= TICK;
      if (this.phaseT <= 0) { this.reset(); ev.push({ type: 'kickoff', fresh: true }); }
    }
  }

  end(ev) {
    this.phase = 'ended'; this.phaseT = LEAGUE.END_PAUSE;
    const w = this.score[0] > this.score[1] ? 0 : 1;
    ev.push({ type: 'end', winner: w, score: this.score.slice() });
  }

  reset() {
    this.score = [0, 0]; this.clock = LEAGUE.CLOCK; this.overtime = false;
    this.kickoff();
  }
}

// ---------------------------------------------------------------------------------------------
// AI：預測球路，找自己趕得上的攔截點，從球後方對準對方球門推進。隊伍裡離球最近的進攻，
// 其次的在球後方支援，最後一個守門，其他人散開卡位。輸出和玩家一樣的輸入結構，物理上不作弊。
const PRED_DT = 1 / 30, PRED_N = 120;

export function predictBall(p, v, out = new Float32Array(PRED_N * 3)) {
  let x = p.x, y = p.y, z = p.z, vx = v.x, vy = v.y, vz = v.z;
  const drag = 1 - BALL.DRAG * PRED_DT;
  for (let i = 0; i < PRED_N; i++) {
    vy -= GRAVITY * PRED_DT;
    vx *= drag; vy *= drag; vz *= drag;
    x += vx * PRED_DT; y += vy * PRED_DT; z += vz * PRED_DT;
    const d = arenaSDF(x, y, z);
    if (d < BALL.R) {
      arenaNormal(x, y, z, _n);
      x += _n.x * (BALL.R - d); y += _n.y * (BALL.R - d); z += _n.z * (BALL.R - d);
      const vn = vx * _n.x + vy * _n.y + vz * _n.z;
      if (vn < 0) { const k = 1 + BALL.REST; vx -= k * vn * _n.x; vy -= k * vn * _n.y; vz -= k * vn * _n.z; }
    }
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
  }
  return out;
}

export const BOT_LEVELS = {
  rookie: { react: 0.4, boost: 0.15, jump: 0.3, speed: 0.75 },
  pro: { react: 0.18, boost: 0.6, jump: 0.8, speed: 0.95 },
  allstar: { react: 0.08, boost: 1, jump: 1, speed: 1 },
};

export class Bot {
  constructor(level = 'pro', seed = 1) {
    this.L = BOT_LEVELS[level] || BOT_LEVELS.pro;
    this.pred = new Float32Array(PRED_N * 3);
    this.think = 0; this.stuck = 0; this.unstick = 0;
    this.target = new Vector3(); this.role = 'attack'; this.urgent = false;
    this.seed = seed; this.t = seed * 1.7;
    this.jumpT = 0;
  }

  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }

  update(lg, me, dt) {
    const inp = me.car.state.input, s = me.car.state, L = this.L;
    Object.assign(inp, emptyInput());
    this.t += dt;
    if (lg.phase !== 'play') { if (lg.phase === 'kickoff' && me.idx === 0) inp.throttle = 0; return; }
    const body = me.car.body, t = body.translation(), v = body.linvel();
    carAxes(body, _q, _f, _u, _l);
    const speed = Math.hypot(v.x, v.y, v.z);
    const bp = lg.ball.translation(), bv = lg.ball.linvel();
    // 空中：放著讓車自己順著飛行方向；倒地就跳
    if (s.contacts === 0) {
      if (s.airTime > 0.1 && this.jumpT > 0) { inp.jump = true; this.jumpT -= dt; }
      return;
    }
    this.think -= dt;
    if (this.think <= 0) { this.think = L.react * (0.7 + this.rnd() * 0.6); this.plan(lg, me, t, speed, bp, bv); }
    // 卡住：倒車打方向脫困
    if (speed < 2 && s.contacts > 0) this.stuck += dt; else this.stuck = Math.max(0, this.stuck - dt * 2);
    if (this.stuck > 1.4) { this.unstick = 0.9; this.stuck = 0; }
    if (this.unstick > 0) { this.unstick -= dt; inp.throttle = -1; inp.steer = Math.sin(this.t * 3) > 0 ? 1 : -1; return; }
    // 開到目標點
    const dx = this.target.x - t.x, dz = this.target.z - t.z;
    const dist = Math.hypot(dx, dz);
    const fx = _f.x, fz = _f.z;
    const ang = Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz);   // 負值：目標在左
    const a = Math.abs(ang);
    inp.steer = Math.max(-1, Math.min(1, ang * 2.4));
    inp.throttle = a > 2.2 && dist < 25 ? -1 : L.speed;
    if (a > 1.2 && speed > 18) inp.handbrake = true;
    const want = this.urgent || this.role === 'attack';
    if (want && a < 0.25 && dist > 18 && s.gas > 15 && this.rnd() < L.boost) inp.boost = true;
    // 球在頭上、很近：跳起來頂，高一點就按住飛
    const rx = bp.x - t.x, rz = bp.z - t.z, rh = Math.hypot(rx, rz);
    const ahead = (rx * _f.x + rz * _f.z) / (rh || 1);
    if (this.role === 'attack' && rh < 10 && ahead > 0.6 && bp.y > 4.5 && bp.y < 16 && s.onGround && this.rnd() < L.jump) {
      inp.jump = true;
      this.jumpT = bp.y > 8 ? (bp.y - 6) * 0.12 : 0;
    }
  }

  plan(lg, me, t, speed, bp, bv) {
    const own = me.team === 0 ? -1 : 1;           // 自家球門在哪一側
    const goalZ = -own * (ARENA.B + 4);           // 對方球門
    // 角色：同隊依離球距離排序
    const mates = lg.cars.filter((c) => c.team === me.team);
    const remote = [...lg.remotes.values()].filter((r) => r.team === me.team);
    const dists = mates.map((c) => { const p = c.car.body.translation(); return { id: c.id, d: Math.hypot(p.x - bp.x, p.z - bp.z) }; });
    for (const r of remote) dists.push({ id: r.id, d: Math.hypot(r.st.p[0] - bp.x, r.st.p[2] - bp.z) });
    dists.sort((x, y) => x.d - y.d);
    const rank = dists.findIndex((x) => x.id === me.id), n = dists.length;
    this.role = rank === 0 ? 'attack' : rank === n - 1 && n > 2 ? 'keeper' : rank === 1 ? 'support' : 'lane';
    this.urgent = false;
    // 球往自家球門跑而且很近：全員回防
    const danger = Math.sign(bv.z) === own && Math.abs(bp.z - own * ARENA.B) < 50 && Math.abs(bv.z) > 6;
    const nearOwn = Math.abs(bp.z - own * ARENA.B) < 28;
    if (this.role === 'keeper' && nearOwn) this.role = 'attack';
    if (this.role === 'keeper' || (danger && rank === 1 && own * (t.z - bp.z) < 0)) {
      // 守門：站在球與自家球門之間
      const gz = own * (ARENA.B - 8);
      const k = 0.25;
      this.target.set(bp.x * k, 0, gz + (bp.z - gz) * k * 0.6);
      this.urgent = danger;
      return;
    }
    if (this.role === 'attack') {
      predictBall(bp, bv, this.pred);
      let pick = PRED_N - 1;
      for (let i = 0; i < PRED_N; i++) {
        const x = this.pred[i * 3], y = this.pred[i * 3 + 1], z = this.pred[i * 3 + 2];
        if (y > 14) continue;
        const reach = Math.hypot(x - t.x, z - t.z) / Math.max(18, speed + 6);
        if (reach <= (i + 1) * PRED_DT) { pick = i; break; }
      }
      const x = this.pred[pick * 3], z = this.pred[pick * 3 + 2];
      // 從球後方（對方球門的反方向）切進去
      const gx = 0 - x, gz = goalZ - z, gl = Math.hypot(gx, gz) || 1;
      const back = BALL.R + 2.2;
      const ux = gx / gl, uz = gz / gl;
      // 自己在球的錯誤一側：先繞到球後方
      const side = (t.x - x) * ux + (t.z - z) * uz;
      if (side > 2) {
        // 繞到球的側邊再切回來，不要直直穿過球
        const px = -uz, pz = ux, sgn = (t.x - x) * px + (t.z - z) * pz >= 0 ? 1 : -1;
        this.target.set(x + px * sgn * (back + 9) - ux * 8, 0, z + pz * sgn * (back + 9) - uz * 8);
      } else this.target.set(x - ux * back * 0.4, 0, z - uz * back * 0.4);
      this.urgent = true;
      return;
    }
    if (this.role === 'support') { this.target.set(bp.x * 0.5, 0, bp.z + own * 32); return; }
    // 散開：依名次分到左右兩側的跑道
    const lane = (rank % 2 ? 1 : -1) * (18 + (rank % 3) * 12);
    this.target.set(lane, 0, bp.z * 0.6 + own * 22);
  }
}
