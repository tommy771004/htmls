// 車球碗：瀏覽器端。載入 Rapier（gzip 內嵌的 WASM）、建立對局、畫面、輸入、鏡頭、音效、重播與 HUD。
import * as THREE from 'three';
import R from '@dimforge/rapier3d-compat';
import { Sim, REC_STRIDE } from '../core/sim.js';
import { Bot, LEVELS } from '../core/ai.js';
import { TICK, ARENA, BALL, CAR, MATCH } from '../core/const.js';
import { emptyInput } from '../core/car.js';
import { buildScene, COLORS } from './scene.js';
import { buildCar, poseCar, buildBall, buildBallMarker } from './models.js';
import { FX } from './fx.js';
import { CameraRig, CAM_NAMES } from './camera.js';
import { Input } from './input.js';
import { Audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const TEAM_NAME = ['白堊', '煤煙'];

async function loadWasm() {
  const el = $('rapier-wasm');
  const b64 = el ? el.textContent.trim() : '';
  if (!b64 || b64.startsWith('<!--')) return;   // 開發模式：用套件內建的
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const ds = new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip')));
  globalThis.__RAPIER_WASM__ = await ds.arrayBuffer();
}

class Game {
  constructor() {
    this.canvas = $('view');
    const renderer = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(this.pixelRatio);

    this.sim = new Sim(R, { seed: (Math.random() * 1e9) | 0 });
    const v = buildScene(renderer, this.sim.mesh);
    this.scene = v.scene; this.padMeshes = v.pads;
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400);
    this.rig = new CameraRig(this.camera);
    this.fx = new FX(this.scene);
    this.carObjs = [buildCar(0), buildCar(1)];
    for (const c of this.carObjs) this.scene.add(c);
    this.ballObj = buildBall();
    this.scene.add(this.ballObj);
    this.marker = buildBallMarker();
    this.scene.add(this.marker);
    this.input = new Input(this.canvas);
    this.audio = new Audio();
    this.bots = [new Bot(this.sim, this.sim.cars[0], 'pro'), new Bot(this.sim, this.sim.cars[1], 'pro')];
    this.level = 'pro';
    this.mode = 'attract';          // attract | match | practice
    this.paused = false;
    this.acc = 0;
    this.timeScale = 1;
    this.slowT = 0;
    this.replay = null;
    this.time = 0;
    this.prev = this.snapshot();
    this.curr = this.snapshot();
    this.lastCount = -1;
    this.bannerT = 0;
    this.feedItems = [];
    this.touchUI = matchMedia('(pointer: coarse)').matches;
    document.body.classList.toggle('touch', this.touchUI);
    this.buildBoostDial();
    this.bindUI();
    this.resize();
    addEventListener('resize', () => this.resize());
    this.sim.resetKickoff();
    this.sim.phase = 'play';
    for (const c of this.sim.cars) c.state.frozen = false;
    this.attractAngle = 0;
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.rig.setAspect(w / h);
    this.fx.setScale(h * this.pixelRatio, THREE.MathUtils.degToRad(this.camera.fov));
  }

  // ---------- 介面 ----------
  bindUI() {
    const levels = $('levels');
    levels.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      this.level = b.dataset.l;
      for (const x of levels.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
    });
    $('start').addEventListener('click', () => this.startMatch('match'));
    $('practice').addEventListener('click', () => this.startMatch('practice'));
    $('resume').addEventListener('click', () => this.setPaused(false));
    $('restart').addEventListener('click', () => { this.setPaused(false); this.startMatch(this.mode); });
    $('toTitle').addEventListener('click', () => { this.setPaused(false); this.toTitle(); });
    $('again').addEventListener('click', () => this.startMatch('match'));
    $('overTitleBtn').addEventListener('click', () => this.toTitle());
    $('pauseBtn').addEventListener('click', () => this.setPaused(true));
    // 瀏覽器會吃掉解除滑鼠鎖定的那一下 Esc：鎖定在比賽中被解除就直接暫停
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      if (locked) { $('lockHint').classList.add('hidden'); this.lockedOnce = true; }
      else if (this.mode !== 'attract' && !this.paused && $('over').classList.contains('hidden')) this.setPaused(true);
    });
    const slider = (id, out, fn, fmt = (v) => v) => { const el = $(id); const f = () => { $(out).textContent = fmt(+el.value); fn(+el.value); }; el.addEventListener('input', f); f(); };
    slider('vol', 'volOut', (v) => this.audio.setVolume(v / 100));
    slider('fov', 'fovOut', (v) => { this.rig.fovH = v; this.resize(); });
    slider('dist', 'distOut', (v) => { this.rig.dist = v / 100; }, (v) => (v / 100).toFixed(1));
    $('loading').classList.add('hidden');
    $('title').classList.remove('hidden');
  }

  buildBoostDial() {
    const g = $('boostTicks'), N = 30;
    const parts = [];
    for (let i = 0; i < N; i++) {
      const a = (-225 + (i / (N - 1)) * 270) * Math.PI / 180;
      const r0 = 56, r1 = i % 5 === 0 ? 70 : 66;
      const x0 = 74 + Math.cos(a) * r0, y0 = 74 + Math.sin(a) * r0, x1 = 74 + Math.cos(a) * r1, y1 = 74 + Math.sin(a) * r1;
      parts.push(`<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke-width="${i % 5 === 0 ? 5 : 4}" stroke-linecap="round"/>`);
    }
    g.innerHTML = `<circle cx="74" cy="74" r="50" fill="rgba(28,26,23,.72)"/>` + parts.join('');
    this.ticks = [...g.querySelectorAll('line')];
    this.lastBoost = -1;
  }

  showScreen(id) {
    for (const s of ['title', 'pause', 'over']) $(s).classList.toggle('hidden', s !== id);
  }

  startMatch(mode) {
    this.audio.start();
    this.mode = mode;
    this.bots[1].setLevel(this.level);
    const sim = this.sim;
    sim.restart();
    sim.noClock = mode === 'practice';
    this.replay = null;
    this.rig.override = null;
    this.timeScale = 1;
    // 進球慢動作／待播重播／中央大字都屬於上一局：在進球後馬上重開時不能帶進新的一局
    this.slowT = 0; this.pendingReplay = null; this.bannerT = 0; $('banner').classList.add('hidden');
    const ai = sim.cars[1];
    ai.state.parked = mode === 'practice';
    if (mode === 'practice') this.parkCar(ai); else { ai.col.setEnabled(true); ai.shell.setEnabled(true); }
    this.showScreen(null);
    $('hud').classList.remove('hidden');
    $('touch').classList.toggle('hidden', !this.touchUI);
    $('replayTag').classList.add('hidden');
    $('clockSub').textContent = mode === 'practice' ? '自由練習' : `對手　${LEVELS[this.level].name}`;
    this.input.wantLock = !this.touchUI;
    $('lockHint').classList.toggle('hidden', this.touchUI || !!this.lockedOnce || !document.body.requestPointerLock);
    this.lastCount = -1;
    this.feedItems = []; this.renderFeed();
    this.prev = this.snapshot(); this.curr = this.snapshot();
  }

  parkCar(car) {
    car.col.setEnabled(false); car.shell.setEnabled(false);
    this.sim.placeCar(car, 0, -20, 0, 0);
    car.body.setGravityScale(0, true);
    car.state.frozen = true;
  }

  toTitle() {
    this.mode = 'attract';
    this.replay = null; this.rig.override = null;
    const ai = this.sim.cars[1];
    ai.body.setGravityScale(1, true); ai.state.parked = false; ai.col.setEnabled(true); ai.shell.setEnabled(true);
    this.sim.restart();
    this.sim.noClock = true;
    $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); $('lockHint').classList.add('hidden'); $('replayTag').classList.add('hidden'); $('banner').classList.add('hidden');
    this.showScreen('title');
    this.input.wantLock = false;
    if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
    this.audio.quiet();
  }

  setPaused(p) {
    if (this.mode === 'attract') return;
    // 結算畫面開著時不能暫停：否則暫停選單會把結算蓋掉，按「繼續」後只剩空球場
    if (p && !$('over').classList.contains('hidden')) return;
    this.paused = p;
    this.pausedAt = performance.now();
    this.showScreen(p ? 'pause' : null);
    $('touch').classList.toggle('hidden', p || !this.touchUI);
    if (p) { this.audio.quiet(); if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); }
  }

  banner(big, sub = '', cls = '', dur = 1.2) {
    const b = $('banner');
    b.className = cls;
    b.innerHTML = `<div class="big">${big}</div>${sub ? `<div class="sub">${sub}</div>` : ''}`;
    this.bannerT = dur;
  }

  feed(text) {
    this.feedItems.unshift({ text, t: 4 });
    this.feedItems.length = Math.min(this.feedItems.length, 4);
    this.renderFeed();
  }
  renderFeed() { $('feed').innerHTML = this.feedItems.map((f) => `<div>${f.text}</div>`).join(''); }

  // ---------- 物理快照（畫面內插用） ----------
  snapshot(out) {
    const o = out || { ball: { p: new THREE.Vector3(), q: new THREE.Quaternion() }, cars: [0, 1].map(() => ({ p: new THREE.Vector3(), q: new THREE.Quaternion() })) };
    const b = this.sim.ball.body;
    const bt = b.translation(), bq = b.rotation();
    o.ball.p.set(bt.x, bt.y, bt.z); o.ball.q.set(bq.x, bq.y, bq.z, bq.w);
    this.sim.cars.forEach((c, i) => { const t = c.body.translation(), q = c.body.rotation(); o.cars[i].p.set(t.x, t.y, t.z); o.cars[i].q.set(q.x, q.y, q.z, q.w); });
    return o;
  }

  // ---------- 主迴圈 ----------
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    let dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    // 手把按鈕每幀都要讀：暫停中按 Start 繼續、重播中按 A 略過（車輛輸入只在比賽推進時才讀）
    this.input.pollPad();
    const actions = this.input.drain();
    for (const a of actions) {
      if (a === 'pause' && performance.now() - (this.pausedAt || 0) > 350) this.setPaused(!this.paused);
      if (a === 'cam' && !this.paused) { this.rig.cycle(); this.updateCamLabel(); }
      if (a === 'skip' && this.replay && this.replay.t > 0.4) this.endReplay();
    }
    if (this.paused) { this.render(); return; }

    if (this.replay) this.updateReplay(dt);
    else this.updateLive(dt);

    this.fx.update(dt * (this.replay ? this.replay.rate : this.timeScale));
    this.updateHUD(dt);
    this.render();
  }

  updateLive(dt) {
    const sim = this.sim;
    // 進球後的慢動作
    if (this.slowT > 0) { this.slowT -= dt; this.timeScale = this.slowT > 0 ? 0.3 : 1; }
    const player = sim.cars[0];
    const playing = this.mode !== 'attract';
    this.acc += dt * this.timeScale;
    let steps = 0;
    while (this.acc >= TICK && steps < 14) {
      this.acc -= TICK; steps++;
      if (playing) this.input.read(player.state.input, !player.state.onGround);
      else this.bots[0].update(TICK);
      if (!sim.cars[1].state.parked) this.bots[1].update(TICK);
      this.snapshot(this.prev);
      sim.step();
      this.snapshot(this.curr);
      this.handleEvents(sim.drainEvents());
      if (this.replay) return;
    }
    if (steps >= 14) this.acc = 0;
    const alpha = this.acc / TICK;
    this.poseLive(alpha, dt);
    // 鏡頭
    if (this.mode === 'attract') {
      this.attractAngle += dt * 0.08;
      const bp = this.curr.ball.p;
      this.rig.override = { pos: new THREE.Vector3(Math.sin(this.attractAngle) * 34, 15, Math.cos(this.attractAngle) * 40), look: new THREE.Vector3(bp.x * 0.5, 2, bp.z * 0.5), k: 2 };
    } else if (sim.phase === 'goal' && sim.goalInfo) {
      // 進球後：鏡頭停在原地看爆炸
      const g = sim.goalInfo;
      if (!this.rig.override) this.rig.override = { pos: this.camera.position.clone(), look: new THREE.Vector3(g.x, Math.max(2, g.y), g.z), k: 3 };
    } else if (sim.cars[0].state.demolished > 0) {
      if (!this.rig.override) this.rig.override = { pos: this.camera.position.clone(), look: this.ballObj.position.clone(), k: 2 };
      this.rig.override.look.copy(this.ballObj.position);
    } else this.rig.override = null;
    const c = this.carView(0);
    const mouse = this.input.takeMouse();
    this.rig.update(dt, c, this.ballVisible() ? this.ballObj.position : null, this.input.look, mouse);
    this.updateMarker();
    this.updateAudio();
  }

  carView(i) {
    const car = this.sim.cars[i], o = this.carObjs[i];
    const v = car.body.linvel();
    this.tmpView = this.tmpView || { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), vel: new THREE.Vector3(), onGround: true };
    this.tmpView.pos.copy(o.position); this.tmpView.quat.copy(o.quaternion); this.tmpView.vel.set(v.x, v.y, v.z);
    this.tmpView.onGround = car.state.onGround;
    return this.tmpView;
  }

  ballVisible() { return !(this.sim.phase === 'goal' && this.sim.goalInfo) && this.sim.phase !== 'post'; }

  poseLive(alpha, dt) {
    const p = this.prev, c = this.curr;
    this.ballObj.position.lerpVectors(p.ball.p, c.ball.p, alpha);
    this.ballObj.quaternion.slerpQuaternions(p.ball.q, c.ball.q, alpha);
    this.ballObj.visible = this.ballVisible();
    const back = this._back || (this._back = new THREE.Vector3());
    const noz = this._noz || (this._noz = new THREE.Vector3());
    this.sim.cars.forEach((car, i) => {
      const o = this.carObjs[i];
      const pos = this._lp || (this._lp = new THREE.Vector3());
      const q = this._lq || (this._lq = new THREE.Quaternion());
      pos.lerpVectors(p.cars[i].p, c.cars[i].p, alpha);
      q.slerpQuaternions(p.cars[i].q, c.cars[i].q, alpha);
      poseCar(o, pos, q, car.state, this.time);
      o.visible = !(car.state.demolished > 0) && !car.state.parked;
      if (car.state.boosting && o.visible) {
        back.set(0, 0, -1).applyQuaternion(q);
        noz.set(0, 0.2, -0.8).applyQuaternion(q).add(pos);
        const v = car.body.linvel();
        this.fx.boost(noz, back, v, i, car.state.supersonic);
      }
    });
    // 補給點
    const pads = this.sim.pads;
    for (let i = 0; i < pads.length; i++) {
      const m = this.padMeshes[i], on = pads[i].t <= 0;
      m.core.material = on ? m.on : m.off;
      if (m.big) { m.core.rotation.y += dt * 1.6; m.core.position.y = 1.05 + Math.sin(this.time * 2 + i) * 0.08; m.core.scale.setScalar(on ? 1 : 0.45); }
    }
  }

  updateMarker() {
    const b = this.ballObj.position;
    const show = this.ballObj.visible && b.y > BALL.R + 0.6 && Math.abs(b.x) < ARENA.A - 3 && Math.abs(b.z) < ARENA.B - 3;
    this.marker.visible = show;
    if (show) { this.marker.position.set(b.x, 0.03, b.z); const s = 1 + Math.min(1, b.y / 15) * 0.6; this.marker.scale.setScalar(s); this.marker.material.opacity = 0.42 - Math.min(0.25, b.y / 60); }
  }

  updateAudio() {
    if (!this.audio.ctx || this.mode === 'attract') return;
    const cam = this.camera.position;
    const right = this._right || (this._right = new THREE.Vector3());
    right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    this.sim.cars.forEach((car, i) => {
      const o = this.carObjs[i];
      if (!o.visible) { this.audio.engine(i, 0, 0, false, 99, 0, true); return; }
      const d = o.position.distanceTo(cam);
      const pan = right.dot(this._b2 = (this._b2 || new THREE.Vector3()).subVectors(o.position, cam).normalize());
      this.audio.engine(i, car.state.speed, car.state.input.throttle, car.state.boosting, i === 0 ? Math.min(d, 3) : d, pan, car.state.onGround);
    });
  }

  handleEvents(events) {
    const sim = this.sim, live = this.mode !== 'attract';
    for (const e of events) {
      switch (e.type) {
        case 'hit': {
          this.fx.hit({ x: e.x, y: e.y, z: e.z }, e.power);
          if (live) {
            const d = this.camera.position.distanceTo(this.ballObj.position);
            this.audio.thump(e.power, d);
            if (e.car === sim.cars[0]) this.rig.shake = Math.max(this.rig.shake, Math.min(0.6, e.power / 50));
          }
          break;
        }
        case 'jump': if (live && e.car === sim.cars[0]) this.audio.jump(); break;
        case 'jump2': if (live && e.car === sim.cars[0]) this.audio.jump(); break;
        case 'flip': if (live && e.car === sim.cars[0]) this.audio.flip(); break;
        case 'land': {
          const t = e.car.body.translation();
          if (t.y < 0.6) this.fx.dust(t, Math.min(16, 4 + e.v * 6));
          if (live && e.car === sim.cars[0]) this.audio.land(e.v);
          break;
        }
        case 'pad': this.fx.pad(e.pad, e.pad.big); if (live && e.car === sim.cars[0]) this.audio.pad(e.pad.big); break;
        case 'bump': if (live) this.audio.bump(); break;
        case 'demo': {
          this.fx.demo(e, COLORS.accent[e.car.team]);
          if (live) {
            this.audio.demo();
            this.feed(`${TEAM_NAME[e.by.team]} 撞毀了 ${TEAM_NAME[e.car.team]}`);
            if (e.car === sim.cars[0]) this.banner('被撞毀', '3 秒後重生', '', 1.6);
          }
          break;
        }
        case 'go': if (live) { this.audio.beep(true); this.banner('開球', '', '', 0.6); } break;
        case 'goal': this.onGoal(e); break;
        case 'postgoal': this.afterGoal(); break;
        case 'overtime':
          if (live) { this.banner('延長賽', '先進球的贏', '', 2); this.audio.whistle(); }
          this.prepKickoff();
          break;
        case 'over': this.onOver(); break;
      }
    }
  }

  onGoal(e) {
    const live = this.mode !== 'attract';
    const p = new THREE.Vector3(e.x, e.y, e.z);
    this.fx.goal(p, e.team);
    this.slowT = 0.9;
    if (!live) return;
    this.audio.goal();
    this.rig.shake = 1;
    const kmh = Math.round(e.speed * 3.6 * 1.0);
    const own = e.scorer >= 0 && e.scorer !== e.team;
    this.banner('進球', `${TEAM_NAME[e.team]}得分${own ? `・${TEAM_NAME[e.scorer]}烏龍球` : ''}　球速 ${kmh} km/h`, `goal${e.team}`, MATCH.GOAL_PAUSE);
    // 重播資料：取到進球這一刻為止
    this.pendingReplay = { rec: this.sim.recording(MATCH.REPLAY_LEN), team: e.team, goal: p };
    if (this.mode === 'practice') this.pendingReplay = null;
  }

  afterGoal() {
    if (this.mode === 'attract' || !this.pendingReplay) { this.prepKickoff(); return; }
    this.startReplay(this.pendingReplay);
    this.pendingReplay = null;
  }

  prepKickoff() {
    this.sim.kickoffAfterGoal();
    this.rig.override = null;
    this.timeScale = 1; this.slowT = 0;
    this.prev = this.snapshot(); this.curr = this.snapshot();
    this.lastCount = -1;
  }

  onOver() {
    if (this.mode === 'attract') { this.sim.restart(); this.sim.noClock = true; return; }
    this.audio.whistle();
    this.audio.quiet();
    const [a, b] = this.sim.score;
    $('overTitle').textContent = a > b ? '勝利' : a < b ? '落敗' : '平手';
    $('f0').textContent = a; $('f1').textContent = b;
    this.showScreen('over');
    $('touch').classList.add('hidden');
    if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
  }

  // ---------- 重播 ----------
  startReplay(data) {
    const { frames, n, hz } = data.rec;
    if (n < 10) { this.prepKickoff(); return; }
    this.replay = { frames, n, hz, t: 0, rate: 1, team: data.team, goal: data.goal, len: (n - 1) / hz, exploded: false };
    this._rdir = null;
    $('replayTag').classList.remove('hidden');
    $('lockHint').classList.add('hidden');
    $('skipHint').textContent = this.touchUI ? '點「跳」略過' : '按跳躍略過';
    $('banner').classList.add('hidden');
    this.audio.quiet();
    this.rig.override = null;
  }

  endReplay() {
    this.replay = null;
    $('replayTag').classList.add('hidden');
    this.prepKickoff();
  }

  updateReplay(dt) {
    const r = this.replay;
    const remain = r.len - r.t;
    r.rate = remain < 1.5 ? 0.32 : 1;
    r.t += dt * r.rate;
    if (r.t >= r.len + 0.6) { this.endReplay(); return; }
    const f = Math.min(r.n - 1.001, r.t * r.hz);
    const i = Math.floor(f), a = f - i;
    const S = REC_STRIDE, F = r.frames;
    const o0 = i * S, o1 = (i + 1) * S;
    const lerp = (k) => F[o0 + k] + (F[o1 + k] - F[o0 + k]) * a;
    const qa = this._qa || (this._qa = new THREE.Quaternion()), qb = this._qb || (this._qb = new THREE.Quaternion());
    this.ballObj.position.set(lerp(0), lerp(1), lerp(2));
    qa.set(F[o0 + 3], F[o0 + 4], F[o0 + 5], F[o0 + 6]); qb.set(F[o1 + 3], F[o1 + 4], F[o1 + 5], F[o1 + 6]);
    this.ballObj.quaternion.slerpQuaternions(qa, qb, a);
    this.ballObj.visible = r.t < r.len;
    const back = this._back || (this._back = new THREE.Vector3()), noz = this._noz || (this._noz = new THREE.Vector3());
    const pos = this._lp || (this._lp = new THREE.Vector3()), q = this._lq || (this._lq = new THREE.Quaternion());
    for (let c = 0; c < 2; c++) {
      const k = 7 + c * 11;
      pos.set(lerp(k), lerp(k + 1), lerp(k + 2));
      qa.set(F[o0 + k + 3], F[o0 + k + 4], F[o0 + k + 5], F[o0 + k + 6]); qb.set(F[o1 + k + 3], F[o1 + k + 4], F[o1 + k + 5], F[o1 + k + 6]);
      q.slerpQuaternions(qa, qb, a);
      const st = { boosting: F[o0 + k + 7] > 0.5, steerVis: lerp(k + 8), spin: lerp(k + 9), wheels: null };
      poseCar(this.carObjs[c], pos, q, st, this.time);
      this.carObjs[c].visible = F[o0 + k + 10] < 1 && !this.sim.cars[c].state.parked;
      if (st.boosting && this.carObjs[c].visible) {
        back.set(0, 0, -1).applyQuaternion(q);
        noz.set(0, 0.2, -0.8).applyQuaternion(q).add(pos);
        this.fx.boost(noz, back, { x: 0, y: 0, z: 0 }, c, false);
      }
    }
    if (r.t >= r.len && !r.exploded) {
      r.exploded = true;
      this.fx.goal(r.goal, r.team);
      this.audio.goal();
      this.rig.shake = 0.8;
    }
    // 鏡頭：前段跟在球後上方（球幾乎不動時改從朝球門的方向看），最後慢動作改從球門側邊看
    const bp = this.ballObj.position;
    const vx = (F[o1] - F[o0]) * r.hz, vz = (F[o1 + 2] - F[o0 + 2]) * r.hz;
    const gx = r.goal.x - bp.x, gz = r.goal.z - bp.z, gl = Math.hypot(gx, gz) || 1;
    const sp = Math.hypot(vx, vz), w = Math.min(1, sp / 6);
    const dir = this._rdir || (this._rdir = new THREE.Vector3(gx / gl, 0, gz / gl));
    const want = new THREE.Vector3(gx / gl * (1 - w) + (sp > 0.01 ? vx / sp : 0) * w, 0, gz / gl * (1 - w) + (sp > 0.01 ? vz / sp : 0) * w).normalize();
    dir.lerp(want, 1 - Math.exp(-dt * 3)).normalize();
    let camPos;
    if (remain > 1.6) camPos = new THREE.Vector3(bp.x - dir.x * 9, Math.max(3, bp.y + 3.5), bp.z - dir.z * 9);
    else {
      const side = r.goal.x >= 0 ? -1 : 1;
      camPos = new THREE.Vector3(side * 16, 5.5, Math.sign(r.goal.z) * (ARENA.B - 14));
    }
    const lim = (v, a) => Math.max(-a, Math.min(a, v));
    camPos.set(lim(camPos.x, ARENA.A - 2), Math.min(ARENA.H - 2, camPos.y), lim(camPos.z, ARENA.B - 1));
    const first = !this.rig.override;
    this.rig.override = { pos: camPos, look: bp.clone(), k: remain > 1.6 ? 5 : 3, snap: first };
    this.rig.update(dt, this.carView(0), null, {}, [0, 0]);
    this.marker.visible = false;
  }

  // ---------- HUD ----------
  updateHUD(dt) {
    const sim = this.sim;
    if (this.bannerT > 0) { this.bannerT -= dt; $('banner').classList.toggle('hidden', this.bannerT <= 0); }
    if (this.mode === 'attract') return;
    $('s0').textContent = sim.score[0]; $('s1').textContent = sim.score[1];
    const c = sim.clock;
    let txt;
    if (this.mode === 'practice') txt = '練習';
    else if (sim.overtime) { const s = Math.floor(c); txt = `+${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
    else { const s = Math.ceil(c); txt = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
    $('clock').textContent = txt;
    // 開球倒數
    if (sim.phase === 'kickoff' && !this.replay) {
      const n = Math.ceil(sim.phaseT);
      if (n !== this.lastCount && n > 0) { this.lastCount = n; this.banner(String(n), '', '', 0.95); this.audio.beep(false); }
    }
    const boost = Math.round(sim.cars[0].state.boost);
    if (boost !== this.lastBoost) {
      this.lastBoost = boost;
      $('boostNum').textContent = boost;
      const lit = Math.round(boost / 100 * this.ticks.length);
      this.ticks.forEach((t, i) => t.setAttribute('stroke', i < lit ? (boost >= 100 ? '#f2c36b' : '#e2a23b') : 'rgba(236,230,214,.18)'));
    }
    for (const f of this.feedItems) f.t -= dt;
    if (this.feedItems.some((f) => f.t <= 0)) { this.feedItems = this.feedItems.filter((f) => f.t > 0); this.renderFeed(); }
  }

  updateCamLabel() {
    $('camName').textContent = CAM_NAMES[this.rig.mode];
    $('cam').className = this.rig.mode === 'ball' ? 'ball' : '';
    const pad = this.input.lastDevice === 'pad';
    $('camHint').textContent = this.rig.mode === 'free' ? (pad ? '右搖桿轉視角 · Y 切換' : '滑鼠或方向鍵轉視角 · Y 切換') : (pad ? 'Y 切換鏡頭' : 'Y 切換鏡頭');
  }

  render() { this.renderer.render(this.scene, this.camera); }
}

async function boot() {
  try {
    await loadWasm();
    await R.init();
  } catch (err) {
    $('loading').innerHTML = '<p>這個瀏覽器無法載入物理引擎（需要 WebAssembly 與 DecompressionStream）</p>';
    console.warn(err);
    return;
  }
  const game = new Game();
  // 測試與除錯用
  window.__cb = {
    game, sim: game.sim,
    start: (mode = 'match', level = 'pro') => { game.level = level; game.startMatch(mode); },
    place: (what, x, y, z, vx = 0, vy = 0, vz = 0, yaw = 0) => {
      if (what === 'ball') game.sim.placeBall(x, y, z, vx, vy, vz);
      else game.sim.placeCar(game.sim.cars[what === 'ai' ? 1 : 0], x, y, z, yaw, { x: vx, y: vy, z: vz });
      game.prev = game.snapshot(); game.curr = game.snapshot();
    },
    play: () => { const s = game.sim; s.phase = 'play'; s.phaseT = 0; s.goTick = s.tick; for (const c of s.cars) if (!c.state.parked) c.state.frozen = false; },
    cam: (mode) => { game.rig.mode = mode; game.updateCamLabel(); },
    goal: (team = 0) => { const s = game.sim; s.placeBall(0, 3, team === 0 ? ARENA.B - 2 : -ARENA.B + 2, 0, 0, team === 0 ? 20 : -20); },
    timeScale: (k) => { game.timeScale = k; },
    freezeAI: (on = true) => { game.sim.cars[1].state.frozen = on; game.bots[1].update = on ? () => {} : Bot.prototype.update.bind(game.bots[1]); },
    state: () => {
      const s = game.sim, c = s.cars[0], t = c.body.translation();
      return { phase: s.phase, score: [...s.score], clock: s.clock, boost: c.state.boost, onGround: c.state.onGround, speed: c.state.speed, pos: { x: t.x, y: t.y, z: t.z }, replay: !!game.replay, mode: game.mode, cam: game.rig.mode };
    },
  };
}

boot();
