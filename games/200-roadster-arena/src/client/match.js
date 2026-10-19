// 車球聯賽的遊玩：離線（3 對 3，AI 隊友與對手）或連線（房間伺服器裁定，自己的車本機模擬）。
// 遠端的車與不歸自己管的球，依伺服器時間延遲 120 ms 內插；自己的車與自己管的球在兩個 tick 之間內插。
import { Vector3, Quaternion } from 'three';
import { TICK, CAR, BALL, ARENA } from '../core/const.js';
import { League, Bot, kickoffSpot } from '../core/league.js';
import { placeCar } from '../core/car.js';
import { arenaSDF, arenaNormal } from '../core/arena.js';
import { LeagueView, TEAM_PAINT } from './leagueview.js';
import { ChaseCam } from './camera.js';
import { Smoke } from './fx.js';
import { QUALITY } from './gfx.js';
import { RoomConn } from './net.js';

const BOT_NAMES = ['Volt', 'Ohm', 'Farad', 'Hertz', 'Joule', 'Watt', 'Lumen', 'Kelvin', 'Ampere', 'Weber', 'Henry', 'Siemens'];
const CAMS = ['chase', 'ball', 'far'];
const DELAY = 120;
const _p = new Vector3(), _q = new Quaternion(), _v = new Vector3(), _n = new Vector3(), _a = new Vector3();
const _qa = new Quaternion(), _qb = new Quaternion();

const packCar = (car) => {
  const b = car.body, s = car.state, t = b.translation(), r = b.rotation(), v = b.linvel();
  const flags = (s.boosting ? 1 : 0) | (s.hovering ? 2 : 0) | (s.braking ? 4 : 0) | (s.drifting ? 8 : 0) | ((s.lights & 3) << 4);
  const f = (x) => Math.round(x * 1000) / 1000;
  return [f(t.x), f(t.y), f(t.z), f(r.x), f(r.y), f(r.z), f(r.w), f(v.x), f(v.y), f(v.z), flags, f(s.wingH), f(s.wingA), f(s.steerVis)];
};
const packBall = (lg) => {
  const s = lg.ballState(), f = (x) => Math.round(x * 1000) / 1000;
  return [...s.p, ...s.q, ...s.v, ...s.w].map(f);
};

export class Match {
  constructor(gfx, R, settings, { online = null, name = '' } = {}) {
    this.gfx = gfx; this.settings = settings;
    this.lg = new League(R, { online: !!online });
    this.view = new LeagueView(gfx, this.lg);
    this.scene = this.view.scene;
    this.cam = new ChaseCam();
    this.camMode = 'chase';
    this.smoke = new Smoke(this.scene, QUALITY[gfx.q].smoke >> 1);
    this.onEvent = () => {};
    this.acc = 0; this.time = 0;
    this.prev = new Map(); this.cur = new Map();
    this.ballPrev = { p: new Vector3(0, BALL.R, 0), q: new Quaternion() };
    this.ballCur = { p: new Vector3(0, BALL.R, 0), q: new Quaternion() };
    this.remoteBuf = new Map();   // id → [{T, s}]
    this.ballBuf = [];
    this.roster = new Map();      // id → { name, team }
    this.me = null; this.myId = null; this.claimAt = 0;
    this.name = name;
    this.sendAcc = 0;
    if (online) this.connect(online);
    else this.offline();
  }

  offline() {
    this.myId = 'me';
    this.me = this.lg.addCar('me', 0, this.name || '你', null);
    this.roster.set('me', { name: this.name || '你', team: 0 });
    const names = [...BOT_NAMES];
    for (let i = 0; i < 5; i++) {
      const team = i < 2 ? 0 : 1;
      const nm = names.splice((i * 5) % names.length, 1)[0];
      const id = 'bot' + i;
      this.lg.addCar(id, team, nm, new Bot(i < 2 ? 'pro' : 'pro', 11 + i * 7));
      this.roster.set(id, { name: nm, team, bot: true });
    }
    this.syncViews();
    this.lg.kickoff();
    this.snapAll();
    this.emit({ type: 'roster' });
    this.emit({ type: 'count', n: 3 });
  }

  connect({ base, code }) {
    const rc = this.rc = new RoomConn(base, code, this.name);
    this.code = code;
    rc.on('welcome', (m) => {
      this.myId = m.id;
      this.me = this.lg.addCar(m.id, m.team, this.name, null);
      for (const p of m.players) this.roster.set(p.id, { name: p.name, team: p.team });
      this.applyPhase(m);
      this.seq = m.seq || 0;
      this.place(m.idx);
      if (m.ball) this.lg.placeBall(m.ball[0], m.ball[1], m.ball[2]);
      this.lg.setBallAuthority(false);
      this.syncViews();
      this.emit({ type: 'roster' });
      this.emit({ type: 'net', state: 'joined', code });
    });
    rc.on('join', (m) => { this.roster.set(m.p.id, { name: m.p.name, team: m.p.team }); this.emit({ type: 'roster' }); this.emit({ type: 'toast', text: `${m.p.name} 加入了` }); });
    rc.on('leave', (m) => {
      const r = this.roster.get(m.id);
      this.roster.delete(m.id); this.remoteBuf.delete(m.id);
      this.lg.dropRemote(m.id); this.view.removeCar(m.id);
      this.emit({ type: 'roster' });
      if (r) this.emit({ type: 'toast', text: `${r.name} 離開了` });
    });
    rc.on('teams', (m) => {
      for (const p of m.players) {
        this.roster.set(p.id, { name: p.name, team: p.team });
        if (p.id === this.myId && this.me.team !== p.team) { this.me.team = p.team; }
      }
      this.lg.reindex();
      this.syncViews();
      this.emit({ type: 'roster' });
    });
    rc.on('ko', (m) => {
      this.seq = m.seq;
      this.applyPhase(m);
      this.place(m.idx[this.myId] ?? 0);
      this.lg.placeBall(0, BALL.R + 0.02, 0);
      this.lg.setBallAuthority(false);
      this.ballBuf.length = 0;
      this.lg.goalWait = 0;
      this.snapAll();
      this.emit({ type: 'count', n: Math.ceil((m.ends || 3000) / 1000) });
    });
    rc.on('phase', (m) => this.applyPhase(m));
    rc.on('reset', (m) => { this.seq = m.seq; this.lg.setBallAuthority(false); this.ballBuf.length = 0; this.lg.placeBall(m.b[0], m.b[1], m.b[2]); this.lg.goalWait = 0; });
    rc.on('own', (m) => {
      if (m.seq !== this.seq) return;
      const mine = m.id === this.myId;
      this.lg.setBallAuthority(mine);
      if (!mine) { this.ballBuf.length = 0; if (m.b) this.pushBall(rc.serverNow(), m.b); }
      this.owner = m.id;
    });
    rc.on('goal', (m) => {
      this.lg.score = m.score.slice();
      this.lg.setBallAuthority(false);
      this.view.flashGoal(m.team === 0 ? 1 : 0);
      this.emit({ type: 'goal', team: m.team, by: m.by, own: m.own, score: m.score, mine: m.byId === this.myId, warmup: m.warmup });
    });
    rc.on('overtime', () => this.emit({ type: 'overtime' }));
    rc.on('end', (m) => this.emit({ type: 'end', winner: m.winner, score: m.score }));
    rc.on('s', (m) => {
      this.lg.clock = m.k;
      if (m.ph !== this.lg.phase) this.lg.phase = m.ph;
      for (const c of m.c) {
        const id = c[0];
        if (id === this.myId) continue;
        let buf = this.remoteBuf.get(id);
        if (!buf) { buf = []; this.remoteBuf.set(id, buf); }
        buf.push({ T: m.T, s: c.slice(1) });
        if (buf.length > 30) buf.shift();
      }
      if (m.b && m.o !== this.myId) this.pushBall(m.T, m.b);
      // 本機先接手的球被伺服器拒絕（快照裡球權還是別人）：交回去，改跟快照走
      if (m.o !== this.myId && !this.lg.ballKinematic && m.sq === this.seq && performance.now() - this.claimAt > 400) {
        this.lg.setBallAuthority(false);
        this.owner = m.o;
      }
    });
    rc.on('full', () => this.emit({ type: 'net', state: 'full' }));
    rc.on('close', () => { if (!this.disposed) this.emit({ type: 'net', state: 'lost' }); });
  }

  pushBall(T, b) { this.ballBuf.push({ T, b }); if (this.ballBuf.length > 30) this.ballBuf.shift(); }

  applyPhase(m) {
    const was = this.lg.phase;
    this.lg.phase = m.phase; this.lg.clock = m.clock; this.lg.score = m.score.slice(); this.lg.overtime = !!m.overtime;
    if (was !== m.phase) this.emit({ type: 'phase', phase: m.phase });
    if (was === 'kickoff' && m.phase === 'play') this.emit({ type: 'go' });
  }

  place(idx) {
    const k = kickoffSpot(this.me.team, idx);
    placeCar(this.me.car, k.x, CAR.REST_Y + 0.05, k.z, k.yaw);
    this.me.idx = idx;
    this.snapAll();
    this.cam.snap();
  }

  syncViews() {
    for (const c of this.lg.cars) this.view.car(c.id, c.team, c.name || (this.roster.get(c.id) || {}).name || '', { tag: c.id !== this.myId, lights: c.id === this.myId });
  }

  snapAll() {
    for (const c of this.lg.cars) {
      const t = c.car.body.translation(), r = c.car.body.rotation();
      const P = { p: new Vector3(t.x, t.y, t.z), q: new Quaternion(r.x, r.y, r.z, r.w) };
      this.prev.set(c.id, P); this.cur.set(c.id, { p: P.p.clone(), q: P.q.clone() });
    }
    const b = this.lg.ball.translation();
    this.ballPrev.p.set(b.x, b.y, b.z); this.ballCur.p.set(b.x, b.y, b.z);
  }

  emit(e) { this.onEvent(e); }

  action(a) {
    const s = this.me && this.me.car.state;
    if (!s) return;
    if (a === 'cam') { this.camMode = CAMS[(CAMS.indexOf(this.camMode) + 1) % CAMS.length]; this.cam.mode = this.camMode === 'far' ? 'far' : 'chase'; this.emit({ type: 'cam', mode: this.camMode }); }
    else if (a === 'aero') { const C = ['AUTO', 'LOW', 'HIGH']; s.aero = C[(C.indexOf(s.aero) + 1) % 3]; this.emit({ type: 'aero', mode: s.aero }); }
    else if (a === 'suction') { s.suction = s.suction === 'WALL' ? 'GRIP' : 'WALL'; this.emit({ type: 'suction', mode: s.suction }); }
    else if (a === 'lights') { s.lights = (s.lights + 1) % 3; const v = this.view.cars.get(this.myId); if (v) v.model.setLights(s.lights); this.emit({ type: 'lights', mode: s.lights }); }
    else if (a === 'respawn') {
      // 卡住時：放回自己半場
      const k = kickoffSpot(this.me.team, this.me.idx + 2);
      placeCar(this.me.car, k.x, CAR.REST_Y + 0.05, k.z, k.yaw);
      this.snapAll();
      this.cam.snap();
    }
  }

  update(dt, input) {
    if (!this.me) { this.renderOnly(dt); return; }
    const lg = this.lg;
    this.acc += dt;
    let n = 0;
    const online = !!this.rc;
    const now = online ? this.rc.serverNow() - DELAY : 0;
    if (online) this.applyRemotes(now);
    while (this.acc >= TICK && n < 12) {
      this.acc -= TICK; n++;
      if (online && lg.ballKinematic) this.applyBall(now + n * TICK * 1000);
      for (const c of lg.cars) { const P = this.prev.get(c.id), C = this.cur.get(c.id); if (P && C) { P.p.copy(C.p); P.q.copy(C.q); } }
      this.ballPrev.p.copy(this.ballCur.p); this.ballPrev.q.copy(this.ballCur.q);
      const ev = lg.tick({ [this.myId]: input });
      for (const c of lg.cars) {
        const t = c.car.body.translation(), r = c.car.body.rotation();
        const C = this.cur.get(c.id);
        if (C) { C.p.set(t.x, t.y, t.z); C.q.set(r.x, r.y, r.z, r.w); }
      }
      const b = lg.ball.translation(), br = lg.ball.rotation();
      this.ballCur.p.set(b.x, b.y, b.z); this.ballCur.q.set(br.x, br.y, br.z, br.w);
      for (const e of ev) this.handle(e);
    }
    if (n >= 12) this.acc = 0;
    if (online) {
      this.sendAcc += dt;
      if (this.sendAcc >= 0.05) {
        this.sendAcc = 0;
        this.rc.send({ t: 'st', s: packCar(this.me.car) });
        if (!lg.ballKinematic && lg.phase !== 'kickoff') this.rc.send({ t: 'ball', b: packBall(lg), seq: this.seq });
      }
    }
    this.time += dt;
    this.render(dt, this.acc / TICK);
  }

  handle(e) {
    const lg = this.lg;
    if (e.type === 'touch') {
      if (e.id === this.myId) {
        this.view.ballMat.uniforms.glow.value = Math.min(2, e.speed / 10);
        if (this.rc && lg.ballKinematic) {
          // 碰到不歸自己管的球：先在本機接手（立刻有反應），再向伺服器要求
          lg.setBallAuthority(true);
          const v = this.ballVel || [0, 0, 0];
          const p = lg.ball.translation();
          lg.placeBall(p.x, p.y, p.z, v[0], v[1], v[2]);
          this.rc.send({ t: 'claim', b: packBall(lg), seq: this.seq });
          this.claimAt = performance.now();
          this.owner = this.myId;
        }
      }
      if (e.speed > 6) this.emit({ type: 'hit', speed: e.speed, mine: e.id === this.myId });
    } else if (e.type === 'goalClaim') {
      if (this.rc) this.rc.send({ t: 'goal', team: e.team, seq: this.seq, b: packBall(this.lg) });
    } else if (e.type === 'goal') {
      this.view.flashGoal(e.team === 0 ? 1 : 0);
      this.emit({ ...e, mine: e.byId === this.myId });
    } else if (e.type === 'land' && e.car === this.me.car && e.impact > 8) {
      this.cam.shake(Math.min(1, e.impact / 18));
    } else if (e.type === 'kickoff') {
      this.snapAll();
      this.cam.snap();
      this.emit({ type: 'count', n: 3 });
    } else if (e.type === 'pad' && e.id === this.myId) {
      this.emit({ type: 'pad' });
    } else if (['count', 'go', 'end', 'overtime'].includes(e.type)) this.emit(e);
  }

  // 遠端玩家：在緩衝裡找延遲後時間點前後兩筆內插
  applyRemotes(T) {
    for (const [id, buf] of this.remoteBuf) {
      if (!buf.length) continue;
      let i = buf.length - 1;
      while (i > 0 && buf[i - 1].T > T) i--;
      const a = buf[Math.max(0, i - 1)], b = buf[i];
      const span = b.T - a.T;
      const t = span > 0 ? Math.max(0, Math.min(1.2, (T - a.T) / span)) : 1;
      const s = a.s.map((x, k) => (k < 3 || (k >= 7 && k < 10) || k > 10 ? x + (b.s[k] - x) * t : b.s[k]));
      _qa.set(a.s[3], a.s[4], a.s[5], a.s[6]); _qb.set(b.s[3], b.s[4], b.s[5], b.s[6]);
      _qa.slerp(_qb, Math.min(1, t));
      const r = this.roster.get(id) || { name: '?', team: 0 };
      const st = { p: [s[0], s[1], s[2]], q: [_qa.x, _qa.y, _qa.z, _qa.w], v: [s[7], s[8], s[9]], flags: s[10], wingH: s[11], wingA: s[12], steerVis: s[13] };
      this.lg.setRemote(id, r.team, r.name, st);
      const vc = this.view.car(id, r.team, r.name);
      vc.st = vc.st || { spin: 0, wheels: null, aero: 'AUTO', input: { throttle: 0 } };
      vc.st.wingH = st.wingH; vc.st.wingA = st.wingA; vc.st.steerVis = st.steerVis;
      vc.st.boosting = !!(st.flags & 1); vc.st.hovering = !!(st.flags & 2); vc.st.braking = !!(st.flags & 4);
      vc.st.vf = Math.hypot(st.v[0], st.v[2]);
      vc.st.p = st.p; vc.st.q = st.q;
    }
  }

  applyBall(T) {
    const buf = this.ballBuf;
    if (!buf.length) return;
    let i = buf.length - 1;
    while (i > 0 && buf[i - 1].T > T) i--;
    const a = buf[Math.max(0, i - 1)], b = buf[i];
    const span = b.T - a.T;
    // 太舊的快照往前外插一點（最多 0.2 秒）
    let t = span > 0 ? (T - a.T) / span : 1;
    t = Math.max(0, Math.min(t, 1 + 200 / Math.max(span, 16)));
    const x = a.b[0] + (b.b[0] - a.b[0]) * t, y = a.b[1] + (b.b[1] - a.b[1]) * t, z = a.b[2] + (b.b[2] - a.b[2]) * t;
    this.lg.ball.setNextKinematicTranslation({ x, y: Math.max(BALL.R, y), z });
    _qa.set(a.b[3], a.b[4], a.b[5], a.b[6]); _qb.set(b.b[3], b.b[4], b.b[5], b.b[6]); _qa.slerp(_qb, Math.min(1, Math.max(0, t)));
    this.lg.ball.setNextKinematicRotation({ x: _qa.x, y: _qa.y, z: _qa.z, w: _qa.w });
    this.ballVel = [b.b[7], b.b[8], b.b[9]];
  }

  renderOnly(dt) {
    this.view.update(dt, this.ballCur.p, this.ballCur.q, null);
    this.cam.camera.position.set(0, 30, -120); this.cam.camera.lookAt(0, 0, 0);
  }

  render(dt, alpha) {
    const lg = this.lg;
    for (const c of lg.cars) {
      const v = this.view.car(c.id, c.team, c.name, { tag: c.id !== this.myId, lights: c.id === this.myId });
      const P = this.prev.get(c.id), C = this.cur.get(c.id);
      if (!P || !C) continue;
      v.model.group.position.copy(P.p).lerp(C.p, alpha);
      v.model.group.quaternion.copy(P.q).slerp(C.q, alpha);
      v.model.update(c.car.state, dt, this.time);
      // 甩尾冒煙
      const s = c.car.state;
      if (s.drifting && s.speed > 10 && Math.random() < dt * 30) {
        const g = v.model.group.position;
        this.smoke.emit(g.x, 0.5, g.z, 0, 0.8, 0, 1.4, 1, 5, 0.4, 0.55);
      }
    }
    for (const [id, vc] of this.view.cars) {
      if (!vc.st || !vc.st.p || lg.cars.some((c) => c.id === id)) continue;
      vc.model.group.position.set(vc.st.p[0], vc.st.p[1], vc.st.p[2]);
      vc.model.group.quaternion.set(vc.st.q[0], vc.st.q[1], vc.st.q[2], vc.st.q[3]);
      vc.st.spin += vc.st.vf * dt / 0.36;
      vc.model.update(vc.st, dt, this.time);
    }
    const bp = _p.copy(this.ballPrev.p).lerp(this.ballCur.p, alpha);
    const bq = _q.copy(this.ballPrev.q).slerp(this.ballCur.q, alpha);
    const me = this.view.cars.get(this.myId);
    const focus = me ? me.model.group.position : null;
    this.view.update(dt, bp, bq, focus);
    this.view.decayGoal(dt);
    this.smoke.update(dt);
    if (me) {
      const lv = this.me.car.body.linvel(); _v.set(lv.x, lv.y, lv.z);
      this.cam.update(dt, me.model.group.position, me.model.group.quaternion, _v, this.me.car.state, this.camMode === 'ball' ? bp : null);
      // 鏡頭別穿出球場
      const c = this.cam.camera.position;
      const d = arenaSDF(c.x, c.y, c.z);
      if (d < 1.2) { arenaNormal(c.x, c.y, c.z, _n); c.addScaledVector(_n, 1.2 - d); }
    }
  }

  draw(dt) { this.gfx.render(this.scene, this.cam.camera, dt); }

  dispose() {
    this.disposed = true;
    if (this.rc) this.rc.close();
  }
}
