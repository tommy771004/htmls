// 特技場的單機遊玩：Free Ride 與 Time Attack 共用同一個 Rapier 世界與畫面。
// 物理以固定 120 Hz 推進，畫面在兩個 tick 之間內插；規則事件丟給 onEvent（HUD 與音效）。
import { Vector3, Quaternion } from 'three';
import { TICK, CAR, MPH, G_WORLD, groups } from '../core/const.js';
import { newWorld, buildParkPhysics } from '../core/world.js';
import { makeCar, stepCar, placeCar, carAxes } from '../core/car.js';
import { FreeRide, TimeAttack, GHOST_HZ, medalFor } from '../core/stunt.js';
import { TA } from '../core/park.js';
import { ParkView } from './parkview.js';
import { Roadster } from './roadster.js';
import { ChaseCam } from './camera.js';
import { Smoke, FireTrail } from './fx.js';
import { QUALITY } from './gfx.js';
import { store } from './store.js';

const AERO_CYCLE = ['AUTO', 'LOW', 'HIGH'];
const _p = new Vector3(), _q = new Quaternion(), _v = new Vector3(), _f = new Vector3(), _u = new Vector3(), _l = new Vector3();
const _a = new Vector3(), _b = new Vector3();
const _qa = new Quaternion(), _qb = new Quaternion();

export class Drive {
  constructor(gfx, R, settings) {
    this.gfx = gfx; this.R = R;
    const world = this.world = newWorld(R);
    this.park = buildParkPhysics(R, world);
    this.car = makeCar(R, world);
    this.rayGroups = groups(0xffff, G_WORLD);
    this.view = new ParkView(gfx, this.park);
    const scene = this.scene = this.view.scene;
    this.model = new Roadster({ lights: true, paint: settings.paint });
    scene.add(this.model.group);
    this.ghost = new Roadster({ ghost: true });
    this.ghost.group.visible = false;
    scene.add(this.ghost.group);
    this.cam = new ChaseCam();
    if (settings.cam) this.cam.mode = settings.cam;
    this.smoke = new Smoke(scene, QUALITY[gfx.q].smoke);
    this.fire = [new FireTrail(scene), new FireTrail(scene)];
    this.fireT = 0;
    this.acc = 0; this.time = 0;
    this.prevP = new Vector3(); this.prevQ = new Quaternion();
    this.curP = new Vector3(); this.curQ = new Quaternion();
    this.safe = null; this.safeT = 0;
    this.events = [];
    this.onEvent = () => {};
    this.mode = null;
  }

  // 主選單背景：車停在起終點拱門前，尾翼升起，不推進物理
  menuPose() {
    this.mode = 'menu';
    this.reset(-4, CAR.REST_Y, -262, 0.5);
    this.model.setLights(1);
    this.view.setGates(0, false);
    this.ghost.group.visible = false;
    const g = this.model.group;
    g.position.copy(this.curP); g.quaternion.copy(this.curQ);
  }

  menuFrame(dt) {
    this.time += dt;
    const s = this.car.state;
    s.wingH += (1 - s.wingH) * Math.min(1, dt * 2); s.wingA += (0.3 - s.wingA) * Math.min(1, dt * 2);
    this.model.update(s, dt, this.time);
    this.view.update(dt, this.curP);
    this.smoke.update(dt);
  }

  start(mode) {
    this.mode = mode;
    this.model.setLights(this.car.state.lights);
    const s = this.car.state;
    s.gas = CAR.GAS_MAX; s.frozen = false;
    if (mode === 'ta') {
      this.rules = new TimeAttack(this.park);
      this.best = store.best(TA.name);
      const st = TA.start;
      this.reset(st.x, CAR.REST_Y + 0.05, st.z, st.yaw);
      this.view.setGates(0, true);
    } else {
      this.rules = new FreeRide(this.park);
      const prog = store.progress();
      Object.assign(this.rules.done, prog.done || {});
      this.reset(0, CAR.REST_Y + 0.05, -200, 0);
      this.view.setGates(0, false);
    }
    this.ghost.group.visible = false;
    this.cam.snap();
  }

  reset(x, y, z, yaw, speed = 0) {
    placeCar(this.car, x, y, z, yaw, speed);
    this.syncPose(true);
    this.cam.snap();
    this.safe = [x, z, yaw]; this.safeT = 0;
  }

  syncPose(both) {
    const t = this.car.body.translation(), r = this.car.body.rotation();
    if (both) { this.curP.set(t.x, t.y, t.z); this.curQ.set(r.x, r.y, r.z, r.w); }
    this.prevP.copy(this.curP); this.prevQ.copy(this.curQ);
    this.curP.set(t.x, t.y, t.z); this.curQ.set(r.x, r.y, r.z, r.w);
  }

  respawn() {
    if (this.mode === 'ta' && this.rules.phase === 'run') {
      const [x, z, yaw] = this.rules.respawnPoint();
      this.reset(x, CAR.REST_Y + 0.05, z, yaw);
    } else if (this.mode === 'ta') return;
    else { const [x, z, yaw] = this.safe || [0, -200, 0]; this.reset(x, CAR.REST_Y + 0.05, z, yaw); }
    this.emit({ type: 'respawn' });
  }

  restart() { if (this.mode === 'ta') this.start('ta'); }

  emit(e) { this.onEvent(e); }

  action(a) {
    const s = this.car.state;
    if (a === 'cam') { this.cam.cycle(); this.emit({ type: 'cam', mode: this.cam.mode }); }
    else if (a === 'aero') { s.aero = AERO_CYCLE[(AERO_CYCLE.indexOf(s.aero) + 1) % 3]; this.emit({ type: 'aero', mode: s.aero }); }
    else if (a === 'suction') { s.suction = s.suction === 'WALL' ? 'GRIP' : 'WALL'; this.emit({ type: 'suction', mode: s.suction }); }
    else if (a === 'lights') { s.lights = (s.lights + 1) % 3; this.model.setLights(s.lights); this.emit({ type: 'lights', mode: s.lights }); }
    else if (a === 'respawn') this.respawn();
    else if (a === 'restart') this.restart();
  }

  // input：這一幀的車輛輸入（會複製進車輛狀態）
  update(dt, input) {
    const car = this.car, s = car.state;
    Object.assign(s.input, input);
    this.acc += dt;
    let n = 0;
    while (this.acc >= TICK && n < 12) {
      this.acc -= TICK; n++;
      this.tick();
    }
    if (n >= 12) this.acc = 0;
    this.time += dt;
    this.render(dt, this.acc / TICK);
  }

  tick() {
    const car = this.car, s = car.state, ev = this.events;
    ev.length = 0;
    stepCar(this.world, car, TICK, this.rayGroups, ev);
    this.world.step();
    this.rules.update(car, TICK, ev);
    this.syncPose(false);
    const p = this.curP;
    // 安全點：四輪著地、車身正、慢慢記
    this.safeT += TICK;
    if (s.contacts === 4 && s.groundN.y > 0.97 && p.y < 1 && this.safeT > 0.5) {
      carAxes(car.body, _q, _f, _u, _l);
      this.safe = [p.x, p.z, Math.atan2(_f.x, _f.z)]; this.safeT = 0;
    }
    if (p.y < -15 || Math.abs(p.x) > 520 || Math.abs(p.z) > 520) this.respawn();
    for (const e of ev) this.handle(e);
  }

  handle(e) {
    const s = this.car.state;
    if (e.type === 'land' && e.impact > 6) { this.cam.shake(Math.min(1, e.impact / 18)); this.dust(1 + e.impact * 0.15); }
    if (e.type === 'speed88') this.fireT = 2.5;
    if (e.type === 'objective') { const prog = store.progress(); prog.done = { ...this.rules.done }; store.saveProgress(prog); }
    if (this.mode === 'ta') {
      const R = this.rules;
      if (e.type === 'gate') {
        this.view.setGates(R.next, true);
        const b = this.best && this.best.splits && this.best.splits[e.i];
        e.delta = b != null ? e.time - b : null;
      }
      if (e.type === 'finish') {
        this.view.setGates(TA.gates.length, false);
        const prev = this.best ? this.best.time : null;
        e.medal = medalFor(e.time);
        e.prev = prev;
        e.improved = prev == null || e.time < prev;
        const bs = this.best && this.best.splits;
        e.delta = bs ? e.time - this.best.time : null;
        if (e.improved) { store.saveBest(TA.name, e.time, e.splits, R.ghost); this.best = store.best(TA.name); }
        store.addRun({ time: e.time, at: Date.now() });
      }
    }
    this.emit(e);
  }

  dust(k) {
    const p = this.curP;
    for (let i = 0; i < 10 * k; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.5 + Math.random() * 1.5;
      this.smoke.emit(p.x + Math.cos(a) * r, 0.4, p.z + Math.sin(a) * r, Math.cos(a) * 5 * k, 0.6, Math.sin(a) * 5 * k, 1.2 + Math.random(), 1.2, 4 + k, 0.35, 0.35);
    }
  }

  render(dt, alpha) {
    const car = this.car, s = car.state;
    _p.copy(this.prevP).lerp(this.curP, alpha);
    _q.copy(this.prevQ).slerp(this.curQ, alpha);
    const g = this.model.group;
    g.position.copy(_p); g.quaternion.copy(_q);
    this.model.update(s, dt, this.time);
    const lv = car.body.linvel(); _v.set(lv.x, lv.y, lv.z);
    this.cam.update(dt, _p, _q, _v, s);
    this.view.update(dt, _p);
    this.emitFx(dt, _p, _q);
    this.updateGhost();
  }

  emitFx(dt, p, q) {
    const s = this.car.state;
    _f.set(0, 0, 1).applyQuaternion(q); _u.set(0, 1, 0).applyQuaternion(q); _l.set(1, 0, 0).applyQuaternion(q);
    // 甩尾與原地燒胎的輪胎煙：從兩個後輪著地點冒出
    const burn = s.input.throttle > 0.5 && s.input.handbrake && s.speed < 6 && s.contacts >= 3;
    const drift = s.drifting && s.speed > 8;
    const rate = burn ? 70 : drift ? 26 + Math.abs(s.slip) * 70 : 0;
    for (const wi of [2, 3]) {
      const wd = CAR.WHEELS[wi];
      _a.set(wd.x, wd.y - CAR.REST_Y + 0.05, wd.z).applyQuaternion(q).add(p);
      if (rate && s.wheels[wi].hit) {
        const k = rate * dt;
        for (let i = 0; i < Math.floor(k) + (Math.random() < k % 1 ? 1 : 0); i++) {
          this.smoke.emit(_a.x + (Math.random() - 0.5) * 0.4, _a.y + 0.2, _a.z + (Math.random() - 0.5) * 0.4,
            -_f.x * 2 + (Math.random() - 0.5) * 2, 0.8 + Math.random(), -_f.z * 2 + (Math.random() - 0.5) * 2,
            1.6 + Math.random() * 1.4, 0.8, 5 + Math.random() * 3, 0.5, 0.62);
        }
      }
    }
    // 冷氣升力：離地近時往下吹起地面的灰
    if (s.hovering && p.y < 7) {
      const k = 30 * dt * (1 - p.y / 7);
      for (let i = 0; i < Math.ceil(k); i++) {
        const a = Math.random() * Math.PI * 2;
        this.smoke.emit(p.x + Math.cos(a), 0.4, p.z + Math.sin(a), Math.cos(a) * 9, 0.4, Math.sin(a) * 9, 1.0, 1, 4.5, 0.25, 0.5);
      }
    }
    this.smoke.update(dt);
    // 88 mph 的火焰胎痕：跨過 88 之後 2.5 秒，或 88 以上還在噴冷氣
    this.fireT = Math.max(0, this.fireT - dt);
    const fireOn = s.contacts >= 3 && s.speed * MPH >= 86 && (this.fireT > 0 || s.boosting);
    for (let k = 0; k < 2; k++) {
      const wd = CAR.WHEELS[2 + k];
      _b.set(wd.x, -CAR.REST_Y + 0.02, wd.z).applyQuaternion(q).add(p);
      this.fire[k].update(dt, fireOn, _b, _l, 0.16);
    }
  }

  updateGhost() {
    const R = this.rules, gh = this.best && this.best.ghost;
    const vis = this.mode === 'ta' && gh && gh.length >= 14 && R.phase !== 'countdown';
    this.ghost.group.visible = !!vis;
    if (!vis) return;
    const f = (R.time + (R.phase === 'run' ? this.acc : 0)) * GHOST_HZ;
    const nF = gh.length / 7;
    const i = Math.min(nF - 2, Math.floor(f)), t = Math.min(1, f - i);
    if (i < 0) return;
    const o = i * 7, o2 = o + 7;
    this.ghost.group.position.set(gh[o] + (gh[o2] - gh[o]) * t, gh[o + 1] + (gh[o2 + 1] - gh[o + 1]) * t, gh[o + 2] + (gh[o2 + 2] - gh[o + 2]) * t);
    _qa.set(gh[o + 3], gh[o + 4], gh[o + 5], gh[o + 6]); _qb.set(gh[o2 + 3], gh[o2 + 4], gh[o2 + 5], gh[o2 + 6]);
    this.ghost.group.quaternion.copy(_qa.slerp(_qb, t));
    // 跑完之後幽靈停在終點附近淡掉
    this.ghost.ghostMat.opacity = f > nF ? Math.max(0, 0.22 - (f - nF) / GHOST_HZ * 0.2) : 0.22;
  }

  draw(dt) { this.gfx.render(this.scene, this.cam.camera, dt); }
}
