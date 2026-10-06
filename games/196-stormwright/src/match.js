// 對戰流程：選單 → 飛艇 → 跳傘 → 對戰 → 勝利／淘汰觀戰（SPEC §12）
import * as THREE from 'three';
import { buildBlimp } from './match-bus.js';

const BUS = { alt: 150, speed: 20, len: 960, openAt: 5 };
const TOTAL = 30;
// 新對局要重設的模組（依序；有 reset() 才呼叫）
const RESET_ORDER = ['physics', 'world', 'build', 'loot', 'storm', 'bots', 'fx', 'combat', 'audio', 'characters', 'render', 'cam', 'playerCtl', 'hud', 'minimap'];

export class Match {
  constructor(ctx) {
    this.ctx = ctx; this.state = 'menu';
    this.busT = 0; this.busStart = new THREE.Vector3(); this.busDir = new THREE.Vector3(1, 0, 0); this.busLen = BUS.len;
    this.startedAt = 0; this.endAt = 0; this.winner = null; this.pendingEnd = 0; this.over = false;
    this.killer = null; this.cause = ''; this.spectateTarget = null; this.spectateLock = 0; this.menuT = 0; this._hid = false;
    this.stats = { shots: 0, hits: 0 }; this.doorOpened = false; this.total = TOTAL;
    const { group, props } = buildBlimp(); this.bus = group; this.props = props; this.bus.visible = false; ctx.scene.add(group);
    ctx.events.on('eliminated', (e) => this.onEliminated(e));
    ctx.events.on('shot', ({ actor, weapon }) => { if (actor === ctx.player && weapon && weapon !== 'pickaxe') this.stats.shots++; });
    ctx.events.on('damage', (d) => { if (d.source === ctx.player && d.target !== ctx.player && d.weapon && d.weapon !== 'pickaxe') this.stats.hits++; });
  }
  busPos(out) { return out.set(this.busStart.x + this.busDir.x * BUS.speed * this.busT, BUS.alt, this.busStart.z + this.busDir.z * BUS.speed * this.busT); }
  canJump() { return this.busT >= BUS.openAt && this.busT <= BUS.len / BUS.speed + 0.5; }
  openIn() { return Math.max(0, BUS.openAt - this.busT); }
  busFrac() { return this.busT / (BUS.len / BUS.speed); }
  routeLeft() { return Math.max(0, BUS.len / BUS.speed - this.busT); }
  alive() { let n = 0; for (const a of this.ctx.actors) if (a.alive) n++; return n; }
  elapsed() { const p = this.ctx.player; return Math.max(0, (this.state === 'ended' ? (p.alive ? this.endAt : p.stats.diedAt) : this.ctx.time.now) - this.startedAt); }

  start() {
    const c = this.ctx;
    c.paused = false; this.over = false; this.winner = null; this.pendingEnd = 0; this.killer = null; this.cause = ''; this.spectateTarget = null; this.doorOpened = false;
    this.stats = { shots: 0, hits: 0 };
    for (const k of RESET_ORDER) { const m = c[k]; if (m && typeof m.reset === 'function') { try { m.reset(); } catch (e) { console.warn('reset 失敗：' + k, e); } } }
    const th = c.rng() * Math.PI * 2, perp = (c.rng() - 0.5) * 240;
    this.busDir.set(Math.cos(th), 0, Math.sin(th));
    this.busStart.set(-this.busDir.x * BUS.len / 2 - this.busDir.z * perp, BUS.alt, -this.busDir.z * BUS.len / 2 + this.busDir.x * perp);
    this.busT = 0;
    const sp = this.busPos(new THREE.Vector3());
    c.actors.forEach((a) => { a.reset(sp); if (a.view) { a.view.emote = false; a.view.setVisible(true); } });
    const yaw = Math.atan2(-this.busDir.x, -this.busDir.z);
    c.playerCtl.yaw = yaw; c.playerCtl.pitch = -0.25;
    c.cam.orbit(null); c.cam.follow(null); c.cam.init = false;
    this.startedAt = c.time.now;
    this.bus.visible = true; this._hid = false;
    this.setState('bus');
  }
  toMenu() {
    this.setState('menu'); this.bus.visible = false; this._hid = false;
    // 清掉上一局留在場上的東西（風暴牆、建材、掉落物、彈道），選單背景的環島鏡頭才不會看到
    const c = this.ctx;
    for (const k of ['storm', 'build', 'combat']) { const m = c[k]; if (m && typeof m.reset === 'function') { try { m.reset(); } catch (e) { console.warn('reset 失敗：' + k, e); } } }
    if (c.loot && typeof c.loot.clear === 'function') c.loot.clear();
    c.actors.forEach((a) => { a.view && (a.view.emote = false); }); c.input.unlock();
  }
  setState(s) { this.state = s; this.ctx.events.emit('matchState', { state: s }); }
  // 飛艇階段結束：開始對戰、風暴計時
  beginPlaying() {
    if (this.state !== 'bus') return;
    this.setState('playing');
  }
  onEliminated({ victim, killer }) {
    if (this.state === 'menu') return;
    if (victim.isPlayer) {
      this.pendingEnd = 1.8; this.killer = killer;
      this.cause = killer ? '被 ' + killer.name + ' 淘汰' : '倒在風暴或墜落中';
      this.spectateTarget = null; this.spectateLock = 0;
      if (this.state === 'bus') this.beginPlaying();
    } else if (this.alive() <= 1) {
      if (this.ctx.player.alive && this.state !== 'ended') this.win();
      else if (!this.ctx.player.alive) this.finish();
    }
  }
  // 玩家死亡後，其餘人打完
  finish() {
    if (this.over) return;
    // 最後兩人同一個 tick 被風暴打死時沒有存活者：冠軍是已經拿到第 1 名的那位
    this.over = true; this.winner = this.ctx.actors.find((a) => a.alive) || this.ctx.actors.find((a) => a.place === 1) || null;
    if (this.winner) this.winner.place = 1;
    this.ctx.events.emit('matchOver', { winner: this.winner });
  }
  win() {
    const p = this.ctx.player;
    this.winner = p; p.place = 1; this.endAt = this.ctx.time.now; this.over = true;
    if (p.view) { p.view.emote = true; p.view.playOneShot && p.view.playOneShot('emote'); }
    p.vel.set(0, 0, 0);
    this.ctx.cam.orbit(p, 6.6);
    this.setState('ended');
    this.ctx.events.emit('matchOver', { winner: p });
  }
  // 觀戰：切換目標（dir = ±1），回傳新目標
  cycleSpectate(dir = 1) {
    if (this.over) return this.spectateTarget;
    const list = this.ctx.actors.filter((a) => a.alive && !a.isPlayer); if (!list.length) return null;
    let i = list.indexOf(this.spectateTarget); i = i < 0 ? 0 : (i + dir + list.length) % list.length;
    this.spectateTarget = list[i]; this.ctx.cam.follow(this.spectateTarget); this.spectateLock = 2;
    return this.spectateTarget;
  }
  _updateSpectate(dt) {
    const c = this.ctx, p = c.player; if (p.alive) return;
    this.spectateLock -= dt;
    let t = this.spectateTarget;
    if (this.over && this.winner) t = this.winner;
    else if (!t || !t.alive) {
      if (t && this.spectateLock > 0) return; // 目標剛死亡：停留片刻再換
      const kill = this.killer && this.killer.alive ? this.killer : null;
      t = kill || this._nearestAlive(p.pos) || null;
      this.spectateLock = 1.2;
    }
    if (t !== this.spectateTarget) { this.spectateTarget = t; if (t) c.cam.follow(t); }
  }
  _nearestAlive(pos) {
    let best = null, bd = 1e9;
    for (const a of this.ctx.actors) if (a.alive && !a.isPlayer) { const d = Math.hypot(a.pos.x - pos.x, a.pos.z - pos.z); if (d < bd) { bd = d; best = a; } }
    return best;
  }
  fixedUpdate(dt) {
    const c = this.ctx, p = c.player;
    if (this.state === 'menu') return;
    if (this.state === 'bus' || this.bus.visible) {
      this.busT += dt;
      const end = BUS.len / BUS.speed;
      if (!this.doorOpened && this.busT >= BUS.openAt) { this.doorOpened = true; c.events.emit('busDoor', {}); }
      if (this.busT >= end) {
        for (const a of c.actors) if (a.alive && a.state === 'bus') { a.intent.deploy = true; a.state = 'skydive'; a.vel.set(this.busDir.x * 20, 0, this.busDir.z * 20); c.events.emit('jump', { actor: a }); }
      }
      if (this.busT >= end + 10) this.bus.visible = false;
    }
    if (this.state === 'bus') {
      // 全員離艇、航線走完、或玩家已落地（可建造／交戰）→ 對戰開始，風暴計時啟動
      let onBus = false; for (const a of c.actors) if (a.alive && a.state === 'bus') { onBus = true; break; }
      if (!onBus || this.busT >= BUS.len / BUS.speed || p.state === 'ground' || p.state === 'air' || !p.alive) this.beginPlaying();
    }
    // 風暴計時：飛艇階段結束（航線走完或全員跳下）才開始
    if (this.state === 'playing' && !c.storm.active && (this.busT >= BUS.len / BUS.speed || !c.actors.some((a) => a.alive && a.state === 'bus'))) c.storm.start();
    if (this.pendingEnd > 0) { this.pendingEnd -= dt; if (this.pendingEnd <= 0 && this.state !== 'ended') { this.endAt = c.time.now; this.setState('ended'); if (this.alive() <= 1) this.finish(); } }
    if ((this.state === 'playing') && p.alive && this.alive() <= 1) this.win();
    else if (!p.alive && this.alive() <= 1 && !this.over && this.state !== 'bus') this.finish();
  }
  update(dt) {
    const c = this.ctx;
    if (this.state === 'menu') {
      // 選單：關掉角色，飛艇繞島緩慢巡航當背景
      if (!this._hid) { c.actors.forEach((a) => a.view && a.view.setVisible(false)); this._hid = true; }
      this.menuT += dt;
      const a = -this.menuT * 0.045 + 1.2, r = 250;
      this.bus.visible = true; this.bus.position.set(Math.cos(a) * r, 120 + Math.sin(this.menuT * 0.3) * 4, Math.sin(a) * r);
      this.bus.rotation.set(0, -a, Math.sin(this.menuT * 0.4) * 0.04);
      this.props.forEach((p) => (p.rotation.z += dt * 22));
      return;
    }
    this._updateSpectate(dt);
    if (!this.bus.visible) return;
    this.busPos(this.bus.position);
    this.bus.rotation.set(0, Math.atan2(-this.busDir.x, -this.busDir.z), Math.sin(c.time.now * 0.5) * 0.025);
    this.bus.position.y += Math.sin(c.time.now * 0.9) * 0.35;
    this.props.forEach((p) => (p.rotation.z += dt * 26));
  }
  // 結算資料
  summary() {
    const p = this.ctx.player, win = this.winner === p;
    const place = win ? 1 : (p.place || (p.alive ? 1 : this.alive() + 1));
    return {
      win, place, total: TOTAL, kills: p.kills, time: this.elapsed(), damage: Math.round(p.stats.damage), builds: p.stats.builds,
      accuracy: this.stats.shots ? Math.min(1, this.stats.hits / this.stats.shots) : 0, shots: this.stats.shots,
      killer: this.killer ? this.killer.name : null, cause: this.cause, winner: this.winner ? this.winner.name : null,
    };
  }
}
