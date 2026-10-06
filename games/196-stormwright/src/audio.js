// WebAudio 即時合成音效（SPEC §15）。第一次使用者手勢才建立 AudioContext。
// 路由：每個音效 → [距離低通 → 傳播延遲 → 立體聲 pan] → master → 壓縮器；遠處與室外另送一條殘響。
// 持續音（風暴嗡鳴、風聲、飛艇引擎、寶箱閃亮、心跳）建一次，每幀用 setTargetAtTime 調整音量／頻率。
import { clamp } from './shared.js';

const TAU = Math.PI * 2;
// 各槍械的聲音配方：crack 高頻爆裂、body 低通噪音、boom 低頻重擊、ref 參考距離
const GUN = {
  ar: { crack: [2800, 0.05, 0.8], snap: 0.5, body: [1200, 0.09, 0.6], boom: [170, 60, 0.12, 0.8], ref: 55, rev: 0.22 },
  smg: { crack: [3700, 0.04, 0.6], snap: 0.35, body: [1700, 0.06, 0.4], boom: [250, 110, 0.07, 0.5], ref: 42, rev: 0.16 },
  pump: { crack: [1800, 0.07, 0.9], snap: 0.4, body: [800, 0.28, 1.0], boom: [100, 38, 0.35, 1.1], low: [300, 0.45, 0.7], ref: 70, rev: 0.34 },
  sniper: { crack: [1500, 0.12, 1.0], snap: 0.8, body: [700, 0.5, 1.0], boom: [72, 28, 0.6, 1.2], low: [220, 0.7, 0.5], ref: 130, rev: 0.5 },
  pistol: { crack: [3100, 0.045, 0.7], snap: 0.4, body: [1400, 0.07, 0.5], boom: [260, 120, 0.08, 0.55], ref: 40, rev: 0.14 },
};
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const PENTA = [0, 2, 4, 7, 9];

export class Audio {
  constructor(ctx) {
    this.ctx = ctx; this.ac = null; this.master = null; this.noiseBuf = null; this.active = 0;
    this.loops = null; this.steps = new Map(); this.lastHitAt = 0; this.shimT = 0; this.heartT = 0; this.consume = null; this.surfT = 0; this.surfCache = 'grass';
    const unlock = () => { this.init(); if (this.ac && this.ac.state === 'suspended') this.ac.resume(); };
    for (const e of ['pointerdown', 'keydown', 'touchstart', 'click']) addEventListener(e, unlock, { passive: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && this.ac && this.ac.state === 'suspended') this.ac.resume(); });
    const ev = ctx.events, P = () => ctx.player;
    ev.on('shot', (e) => this._onShot(e));
    ev.on('damage', (d) => this._onDamage(d));
    ev.on('pickup', ({ actor, item }) => { if (actor === P()) this.play(item && (item.kind === 'ammo' || item.kind === 'mats') ? 'pickup_ammo' : 'pickup', { rarity: item?.rarity || 0 }); });
    ev.on('inventoryFull', ({ actor }) => actor === P() && this.play('error'));
    ev.on('reload', ({ actor, weapon, phase }) => {
      if (phase === 'start') this._reload(actor, weapon);
      else if (phase === 'shell') { const out = this._out(actor === P() ? 0.9 : 0.7, actor === P() ? null : actor.pos, { ref: 12 }); if (out) this._mech('shell', 0, 1, out); }
      else if (phase === 'cancel' && actor === P()) this.play('cancel');
    });
    ev.on('dryFire', ({ actor }) => this.play('empty', actor === P() ? {} : { pos: actor.pos, ref: 10 }));
    ev.on('equip', ({ actor, item }) => { if (actor === P()) this.play('equip', { pitch: item && item.kind === 'weapon' ? 1 : 1.25 }); else if (actor.pos) this.play('equip', { pos: actor.pos, ref: 8, volume: 0.7 }); });
    ev.on('consume', ({ actor, phase }) => { if (actor !== P()) return; if (phase === 'cancel') this.play('cancel'); else if (phase === 'start') this.consume = null; });
    ev.on('shieldBreak', ({ actor, point }) => this.play('shield_break', actor === P() ? {} : { pos: point || actor.pos, ref: 18 }));
    ev.on('impact', (e) => this._onImpact(e));
    ev.on('buildDamaged', ({ piece, point }) => { const now = performance.now(); if (now - (this._bdT || 0) < 45) return; this._bdT = now; this.play('build_hit', { pos: point || piece.center, ref: 14, mat: piece.mat || 'wood' }); });
    ev.on('buildComplete', ({ piece }) => this.play('build_done', { pos: piece.center, ref: 12 }));
    ev.on('panelDestroyed', ({ pos, material }) => this.play('break_' + (material || 'wood'), { pos, ref: 22 }));
    ev.on('propDestroyed', ({ pos, material }) => this.play('break_' + (material || 'wood'), { pos, ref: 22 }));
    ev.on('busDoor', () => this.play('bus_door'));
    ev.on('lightning', ({ strength }) => { this.play('flash', { volume: 0.5 }); const dly = 400 + Math.random() * 2200; setTimeout(() => this.play('thunder', { volume: 0.55 + 0.35 * (1 - dly / 2600) * (strength || 1) }), dly); });
    // 失敗音效由 matchState 'ended'（玩家淘汰時）播；觀戰中其他人分出勝負不要再播一次
    ev.on('matchOver', ({ winner }) => { if (winner === ctx.player) this._end(true); });
    ev.on('harvest', ({ material, point, weakPoint }) => { this.play('harvest_' + material, { pos: point }); if (weakPoint) this.play('weakpoint', { pos: point }); });
    ev.on('buildPlaced', ({ piece, actor }) => this.play('build_' + (piece.mat || 'wood'), { pos: piece.center, own: actor === P() }));
    ev.on('buildDestroyed', ({ piece, collapsed }) => {
      const o = { pos: piece.center, volume: collapsed ? 0.55 : 1 };
      if (collapsed) setTimeout(() => this.play('break_' + (piece.mat || 'wood'), o), Math.random() * 380); else this.play('break_' + (piece.mat || 'wood'), o);
    });
    ev.on('eliminated', ({ victim, killer }) => {
      this.play('digitize', { pos: victim.pos });
      if (victim === P()) this.play('death'); else if (killer === P()) this.play('kill');
    });
    ev.on('chestOpen', ({ chest, actor }) => this.play('chest', { pos: chest, near: actor === P() }));
    ev.on('heal', ({ actor, kind }) => { if (actor === P()) this.play(kind === 'shield' ? 'shield_heal' : 'heal'); });
    ev.on('jump', ({ actor }) => { if (actor.state === 'skydive') { if (actor === P()) this.play('dive'); } else this.play('jump', { pos: actor === P() ? null : actor.pos, ref: 8 }); });
    ev.on('glide', ({ actor }) => this.play('glider_open', { pos: actor === P() ? null : actor.pos, ref: 30 }));
    ev.on('land', ({ actor, speed }) => this._land(actor, speed));
    ev.on('swing', ({ actor }) => this.play('swing', { pos: actor === P() ? null : actor.pos, ref: 10 }));
    ev.on('stormPhase', ({ state }) => state === 'shrinking' && this.play('storm_warn'));
    ev.on('matchState', ({ state }) => {
      if (state === 'ended') this._end(ctx.player.alive);
      else if (state === 'bus') this.play('bus_horn');
    });
  }

  // 新對局：清掉計時、腳步與使用中的循環狀態
  reset() { this.consume = null; this.steps.clear(); this._cd = null; this.shimT = 0; this.heartT = 0; this._endT = 0; }

  // ---------- 建立 ----------
  init() {
    if (this.ac) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const ac = (this.ac = new AC());
      this.master = ac.createGain(); this.master.gain.value = (this.ctx.settings?.volume ?? 0.7) * 0.6;
      this.comp = ac.createDynamicsCompressor(); this.comp.threshold.value = -16; this.comp.knee.value = 18; this.comp.ratio.value = 5; this.comp.attack.value = 0.004; this.comp.release.value = 0.2;
      this.master.connect(this.comp); this.comp.connect(ac.destination);
      const sr = ac.sampleRate;
      const nb = ac.createBuffer(1, sr * 2, sr), d = nb.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = nb;
      // 棕噪（低頻隆隆）
      const bb = ac.createBuffer(1, sr * 3, sr), bd = bb.getChannelData(0); let last = 0;
      for (let i = 0; i < bd.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.2; }
      this.brownBuf = bb;
      // 殘響 IR（室外迴盪 1.8 s，高頻衰減較快）
      const len = Math.floor(sr * 1.8), ir = ac.createBuffer(2, len, sr);
      for (let c = 0; c < 2; c++) { const ch = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const t = i / len; lp += (Math.random() * 2 - 1 - lp) * (0.55 - 0.45 * t); ch[i] = lp * Math.pow(1 - t, 2.4) * (i < 400 ? i / 400 : 1); } }
      this.conv = ac.createConvolver(); this.conv.buffer = ir;
      this.revIn = ac.createGain(); this.revIn.gain.value = 1; this.revOut = ac.createGain(); this.revOut.gain.value = 0.55;
      this.revIn.connect(this.conv); this.conv.connect(this.revOut); this.revOut.connect(this.master);
      this._buildLoops();
    } catch (e) { this.ac = null; }
  }
  setVolume(v) { if (this.master) this.master.gain.setTargetAtTime(v * 0.6, this.ac.currentTime, 0.02); }
  // 測試用：掛一個分析器看輸出振幅
  debugTap() { if (!this.ac) return null; if (!this._tap) { this._tap = this.ac.createAnalyser(); this._tap.fftSize = 2048; this.comp.connect(this._tap); this._buf = new Float32Array(2048); } return this._tap; }
  debugPeak() { const t = this.debugTap(); if (!t) return 0; t.getFloatTimeDomainData(this._buf); let m = 0; for (const v of this._buf) m = Math.max(m, Math.abs(v)); return m; }

  // ---------- 基礎語音 ----------
  _env(g, t, a, d, v) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(Math.max(0.0002, v), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.004, d)); }
  noise(out, { f = 1500, f2 = null, q = 1, d = 0.1, v = 1, type = 'bandpass', t0 = 0, a = 0.002, brown = false, hp = 0 }) {
    const ac = this.ac, s = ac.createBufferSource(); s.buffer = brown ? this.brownBuf : this.noiseBuf; s.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.Q.value = q; const t = ac.currentTime + t0 + 0.002;
    fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + d);
    const g = ac.createGain(); this._env(g, t, a, d, v);
    s.connect(fl); let last = fl;
    if (hp) { const h = ac.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; fl.connect(h); last = h; }
    last.connect(g); g.connect(out); s.start(t, Math.random() * 1.5); s.stop(t + d + 0.03);
    this.active++; s.onended = () => { this.active--; };
  }
  tone(out, { f = 440, f2 = null, d = 0.15, v = 0.5, type = 'sine', t0 = 0, a = 0.003, vib = 0, det = 0 }) {
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + t0 + 0.002;
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + d); if (det) o.detune.value = det;
    if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 6; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + d + 0.03); }
    this._env(g, t, a, d, v); o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.03);
    this.active++; o.onended = () => { this.active--; };
  }
  // 路由：回傳輸入節點；pos 有值時做距離衰減、低通、傳播延遲、左右聲道與殘響
  _out(vol, pos, o = {}) {
    const ac = this.ac, cam = this.ctx.camera;
    if (this.active > 90 && !o.prio) return null;
    const g = ac.createGain(); let last = g, d = 0;
    if (pos) {
      const dx = pos.x - cam.position.x, dy = pos.y - cam.position.y, dz = pos.z - cam.position.z; d = Math.hypot(dx, dy, dz);
      const ref = o.ref || 20; vol *= 1 / (1 + Math.pow(d / ref, 1.35)); if (d > 420 || vol < 0.004 || (!o.prio && d > ref * 3.4)) return null;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = clamp(19000 / (1 + d / (ref * 0.9)), 700, 19000); last.connect(lp); last = lp;
      if (o.delay && d > 28) { const dl = ac.createDelay(1.5); dl.delayTime.value = Math.min(1.2, d / 340); last.connect(dl); last = dl; }
      if (ac.createStereoPanner) {
        const e = cam.matrixWorld.elements; const dot = (dx * e[0] + dy * e[1] + dz * e[2]) / (d + 0.5);
        const p = ac.createStereoPanner(); p.pan.value = clamp(dot * 0.95 * clamp(d / 3, 0, 1), -1, 1); last.connect(p); last = p;
      }
    }
    const dry = ac.createGain(); dry.gain.value = vol; last.connect(dry); dry.connect(this.master);
    const revAmt = clamp((o.rev || 0) * (0.5 + Math.min(1.5, d / 60)), 0, 0.8) * vol;
    if (revAmt > 0.004 && this.revIn) { const s = ac.createGain(); s.gain.value = revAmt; last.connect(s); s.connect(this.revIn); }
    return g;
  }

  // ---------- 事件處理 ----------
  _end(win) { const n = performance.now(); if (n - (this._endT || 0) < 1500) return; this._endT = n; this.play(win ? 'win' : 'lose'); }
  _onImpact({ point, surface, actor, owner, weapon }) {
    if (!this.ac || actor || !point) return; // 打到角色的回饋由 damage 事件負責
    const now = performance.now(); if (now - (this._impT || 0) < 28) return; this._impT = now;
    if (weapon === 'pickaxe' && owner && owner.harvest) return; // 採集音由 harvest 負責
    this.play(surface === 'metal' ? 'ricochet' : 'impact_' + (surface || 'dirt'), { pos: point, ref: 16, volume: weapon === 'pickaxe' ? 0.7 : 0.8 });
  }
  _onShot({ actor, weapon, from, to, projectile }) {
    if (!this.ac) return;
    const P = this.ctx.player, w = weapon || 'ar', own = actor === P;
    if (projectile && w === 'sniper') this.play('sniper_crack', own ? {} : { pos: from, delay: true, ref: 90 });
    this.play('shot_' + w, own ? { rev: GUN[w] ? GUN[w].rev : 0.2 } : { pos: from, delay: true });
    if (own) { if (w === 'pump') this._mech('pump', 0.42); else if (w === 'sniper') this._mech('bolt', 0.6); }
    if (!own && to && from) { // 子彈從耳邊飛過
      const cam = this.ctx.camera.position, ax = from.x, ay = from.y, az = from.z, bx = to.x - ax, by = to.y - ay, bz = to.z - az;
      const L2 = bx * bx + by * by + bz * bz; if (L2 > 1) {
        const t = clamp(((cam.x - ax) * bx + (cam.y - ay) * by + (cam.z - az) * bz) / L2, 0, 1);
        const dx = ax + bx * t - cam.x, dy = ay + by * t - cam.y, dz = az + bz * t - cam.z, dm = Math.hypot(dx, dy, dz);
        if (dm < 7 && t > 0.02 && t < 0.98) this.play('whiz', { pos: { x: cam.x + dx, y: cam.y + dy, z: cam.z + dz }, ref: 4, volume: 0.9 });
      }
    }
  }
  _onDamage({ target, source, amount, shieldDamage, healthDamage, headshot, point, weapon }) {
    if (!this.ac) return;
    const P = this.ctx.player, now = performance.now();
    if (source === P && target !== P) {
      if (now - this.lastHitAt < 35) return; this.lastHitAt = now;
      if (headshot) this.play('headshot');
      else if (shieldDamage > 0 && healthDamage <= 0) this.play('hit_shield');
      else this.play('hit');
    } else if (target === P) {
      if (!source && !weapon) this.play(amount > 12 ? 'fall_hurt' : 'storm_zap');
      else if (healthDamage <= 0) this.play('shield_hit');
      else this.play('hurt');
    } else if (target && target.pos && source) this.play('impact', { pos: point || target.pos, ref: 14 });
  }
  _reload(actor, weapon) {
    if (!this.ac) return;
    const P = this.ctx.player, dur = (actor.action && actor.action.duration) || 2, o = actor === P ? {} : { pos: actor.pos, ref: 12 };
    const out = this._out(actor === P ? 1 : 0.8, o.pos, { ref: o.ref }); if (!out) return;
    const m = (k, t, v = 1) => this._mech(k, t, v, out);
    if (weapon === 'pump') { m('shell', 0.05); }
    else if (weapon === 'sniper') { m('bolt', dur * 0.12); m('shell', dur * 0.45); m('bolt', dur * 0.78); }
    else if (weapon === 'pistol') { m('click', 0.05); m('thunk', dur * 0.5); m('clack', dur * 0.86, 0.8); }
    else { m('click', 0.06); m('thunk', dur * 0.5); m('click', dur * 0.55, 0.6); m('clack', dur * 0.88); }
  }
  _land(actor, speed) {
    if (!this.ac) return;
    const P = this.ctx.player, sp = speed == null ? 6 : speed; if (sp < 3) return;
    const surf = this._surface(actor), k = clamp((sp - 3) / 14, 0.15, 1.1);
    if (actor === P) this.play('land', { surf, k }); else this.play('land', { pos: actor.pos, surf, k, ref: 14 });
  }
  _surface(a) {
    const P = this.ctx.physics;
    try {
      const g = P.groundHeight(a.pos.x, a.pos.z, a.pos.y + 0.2, 0.3);
      if (g.colliderId != null && g.y >= this.ctx.terrain.heightAt(a.pos.x, a.pos.z) - 0.05) { const c = P.cols.get(g.colliderId); const m = c && c.owner && c.owner.mat; if (m) return m; return 'wood'; }
      const s = this.ctx.terrain.surfaceType(a.pos.x, a.pos.z); return s === 'rock' ? 'stone' : s;
    } catch (e) { return 'grass'; }
  }
  // 機械聲：click / clack / thunk / bolt / shell
  _mech(kind, t0 = 0, v = 1, out = null) {
    if (!this.ac) return; out = out || this._out(0.7 * v, null); if (!out) return;
    if (kind === 'click') this.noise(out, { f: 4200, q: 2, d: 0.018, v: 0.5, t0 });
    else if (kind === 'clack') { this.noise(out, { f: 2400, q: 1.5, d: 0.03, v: 0.7, t0 }); this.tone(out, { f: 900, f2: 450, d: 0.03, v: 0.3, type: 'square', t0 }); this.noise(out, { f: 3600, q: 2, d: 0.02, v: 0.4, t0: t0 + 0.07 }); }
    else if (kind === 'thunk') { this.tone(out, { f: 190, f2: 90, d: 0.07, v: 0.6, t0 }); this.noise(out, { f: 600, type: 'lowpass', d: 0.05, v: 0.5, t0 }); this.noise(out, { f: 3000, q: 2, d: 0.015, v: 0.4, t0: t0 + 0.01 }); }
    else if (kind === 'bolt') { this.noise(out, { f: 1800, f2: 3200, q: 2, d: 0.08, v: 0.5, t0 }); this.tone(out, { f: 500, f2: 300, d: 0.05, v: 0.2, type: 'square', t0: t0 + 0.07 }); this.noise(out, { f: 2600, q: 2, d: 0.03, v: 0.6, t0: t0 + 0.13 }); }
    else if (kind === 'shell') { this.noise(out, { f: 3500, q: 3, d: 0.02, v: 0.45, t0 }); this.tone(out, { f: 1300, f2: 800, d: 0.03, v: 0.2, type: 'square', t0: t0 + 0.02 }); this.noise(out, { f: 1500, q: 2, d: 0.03, v: 0.4, t0: t0 + 0.1 }); }
  }

  // ---------- 公開：play(name, { pos, volume, pitch }) ----------
  play(name, o = {}) {
    if (!this.ac || this.ac.state !== 'running') return;
    if (this.ctx.paused && !name.startsWith('ui')) return; // 暫停時只有介面音
    const pit = o.pitch || 1, vol = o.volume ?? 1;
    if (name.startsWith('shot_')) {
      const k = GUN[name.slice(5)] || GUN.ar, r = 1 + (Math.random() - 0.5) * 0.06;
      const out = this._out(vol * (o.pos ? 1 : 0.95), o.pos, { ref: k.ref, delay: o.delay, rev: o.rev ?? k.rev, prio: !o.pos }); if (!out) return;
      this.noise(out, { f: k.crack[0] * pit * r, q: 0.8, d: k.crack[1], v: k.crack[2], a: 0.001 });
      this.noise(out, { f: 7000, type: 'highpass', d: 0.02, v: k.snap, a: 0.001 });
      this.noise(out, { f: k.body[0], type: 'lowpass', d: k.body[1], v: k.body[2] });
      this.tone(out, { f: k.boom[0] * pit * r, f2: k.boom[1], d: k.boom[2], v: k.boom[3], type: 'sine', a: 0.001 });
      this.tone(out, { f: k.boom[0] * 1.5 * pit, f2: k.boom[1] * 1.2, d: k.boom[2] * 0.6, v: k.boom[3] * 0.35, type: 'triangle', a: 0.001 });
      if (k.low) this.noise(out, { f: k.low[0], f2: 90, type: 'lowpass', d: k.low[1], v: k.low[2], brown: true });
      return;
    }
    if (name.startsWith('footstep_')) return this._foot(name.slice(9), o);
    const out = this._out(vol, o.pos, { ref: o.ref, rev: o.rev, delay: o.delay, prio: o.prio });
    if (!out) return;
    const N = (p) => this.noise(out, p), T = (p) => this.tone(out, p);
    switch (name) {
      // --- 命中回饋 ---
      case 'hit': T({ f: 1050 * pit, f2: 760, d: 0.07, v: 0.4, type: 'triangle', a: 0.001 }); N({ f: 2400, q: 2, d: 0.03, v: 0.5, a: 0.001 }); T({ f: 190, f2: 110, d: 0.06, v: 0.45 }); break;
      case 'hit_shield': T({ f: 2100, f2: 1700, d: 0.1, v: 0.35, type: 'triangle', a: 0.001 }); T({ f: 3150, d: 0.14, v: 0.22, a: 0.001 }); N({ f: 5200, q: 3, d: 0.05, v: 0.4, a: 0.001 }); break;
      case 'headshot': T({ f: 1760, d: 0.28, v: 0.4, a: 0.001 }); T({ f: 2637, d: 0.34, v: 0.3, t0: 0.045, a: 0.001 }); T({ f: 3520, d: 0.2, v: 0.14, t0: 0.045 }); N({ f: 3600, q: 2, d: 0.04, v: 0.45, a: 0.001 }); T({ f: 150, f2: 80, d: 0.08, v: 0.5 }); break;
      case 'kill': [0, 4, 7, 12].forEach((s, i) => T({ f: NOTE(72 + s), d: 0.32, v: 0.3, t0: i * 0.06, type: 'triangle' })); T({ f: NOTE(96), d: 0.5, v: 0.14, t0: 0.2 }); break;
      case 'hurt': N({ f: 350, type: 'lowpass', d: 0.16, v: 0.8 }); T({ f: 130, f2: 65, d: 0.16, v: 0.7 }); N({ f: 1800, q: 1, d: 0.05, v: 0.3 }); break;
      case 'shield_hit': N({ f: 4200, q: 1.5, d: 0.1, v: 0.5, a: 0.001 }); T({ f: 900, f2: 450, d: 0.12, v: 0.25, type: 'square' }); T({ f: 2400, f2: 1800, d: 0.14, v: 0.2, type: 'triangle' }); break;
      case 'shield_break': N({ f: 6000, type: 'highpass', d: 0.3, v: 0.5, a: 0.001 }); [3400, 2800, 4200, 3100].forEach((f, i) => T({ f, d: 0.12, v: 0.2, t0: i * 0.025, type: 'triangle' })); T({ f: 600, f2: 200, d: 0.25, v: 0.3, type: 'sawtooth' }); break;
      case 'fall_hurt': T({ f: 90, f2: 40, d: 0.3, v: 1, type: 'sine' }); N({ f: 500, type: 'lowpass', d: 0.25, v: 1 }); N({ f: 2200, q: 1, d: 0.06, v: 0.5 }); break;
      case 'storm_zap': N({ f: 2600, f2: 900, q: 2, d: 0.22, v: 0.6 }); T({ f: 160, f2: 110, d: 0.2, v: 0.5, type: 'sawtooth' }); break;
      case 'impact': N({ f: 700, type: 'lowpass', d: 0.1, v: 0.7 }); T({ f: 200, f2: 90, d: 0.09, v: 0.5 }); break;
      case 'equip': T({ f: 640 * pit, f2: 420, d: 0.04, v: 0.14, type: 'square', a: 0.001 }); N({ f: 2600, q: 2, d: 0.03, v: 0.3, t0: 0.03 }); break;
      case 'cancel': T({ f: 420, f2: 260, d: 0.1, v: 0.16, type: 'triangle' }); break;
      case 'sniper_crack': N({ f: 5200, f2: 1400, q: 1.2, d: 0.22, v: 0.8, a: 0.001 }); T({ f: 90, f2: 40, d: 0.5, v: 0.6 }); N({ f: 800, type: 'lowpass', d: 0.7, v: 0.6, brown: true, t0: 0.03 }); break;
      case 'ricochet': N({ f: 3200, q: 4, d: 0.05, v: 0.6, a: 0.001 }); T({ f: 2400, f2: 900, d: 0.32, v: 0.22, type: 'sine', a: 0.001, vib: 40 }); T({ f: 3600, f2: 1600, d: 0.22, v: 0.1, t0: 0.02 }); break;
      case 'impact_wood': N({ f: 650, q: 1.5, d: 0.06, v: 0.6, a: 0.001 }); T({ f: 180, f2: 110, d: 0.07, v: 0.35, type: 'triangle' }); break;
      case 'impact_stone': N({ f: 2000, q: 1.5, d: 0.05, v: 0.6, a: 0.001 }); N({ f: 5000, q: 3, d: 0.03, v: 0.3, a: 0.001 }); T({ f: 260, f2: 160, d: 0.05, v: 0.2, type: 'square' }); break;
      case 'impact_dirt': case 'impact_grass': N({ f: 420, type: 'lowpass', d: 0.1, v: 0.7, a: 0.002 }); N({ f: 1800, q: 1, d: 0.04, v: 0.2 }); break;
      case 'impact_sand': N({ f: 900, type: 'lowpass', d: 0.12, v: 0.55 }); break;
      case 'impact_water': N({ f: 1000, f2: 2600, q: 1, d: 0.2, v: 0.5, a: 0.004 }); break;
      case 'build_hit': { const m = o.mat || 'wood'; if (m === 'metal') { T({ f: 900, f2: 700, d: 0.1, v: 0.18, type: 'square', a: 0.001 }); N({ f: 3600, q: 3, d: 0.04, v: 0.4, a: 0.001 }); } else if (m === 'stone') { N({ f: 1400, q: 1.5, d: 0.07, v: 0.55, a: 0.001 }); T({ f: 150, f2: 90, d: 0.08, v: 0.4 }); } else { N({ f: 480, q: 1.4, d: 0.07, v: 0.6, a: 0.001 }); T({ f: 150, f2: 100, d: 0.09, v: 0.35, type: 'triangle' }); } break; }
      case 'build_done': T({ f: NOTE(84), d: 0.1, v: 0.12, type: 'triangle' }); T({ f: NOTE(91), d: 0.14, v: 0.1, t0: 0.05, type: 'triangle' }); break;
      case 'bus_door': N({ f: 3000, f2: 900, q: 0.8, d: 0.6, v: 0.5, a: 0.02 }); T({ f: 130, f2: 70, d: 0.25, v: 0.6, t0: 0.5, type: 'triangle' }); [0, 0.14, 0.28].forEach((t) => T({ f: 988, d: 0.12, v: 0.22, t0: t, type: 'triangle' })); break;
      case 'flash': N({ f: 6000, type: 'highpass', d: 0.12, v: 0.4, a: 0.001 }); break;
      case 'thunder': N({ f: 260, f2: 70, type: 'lowpass', d: 2.2, v: 0.9, a: 0.12, brown: true }); N({ f: 900, f2: 200, q: 0.8, d: 0.9, v: 0.3, a: 0.05 }); T({ f: 52, f2: 30, d: 1.6, v: 0.5, a: 0.1 }); break;
      case 'whiz': N({ f: 6500, f2: 2200, q: 3, d: 0.14, v: 0.55, a: 0.02 }); break;
      case 'eliminate': case 'digitize': {
        for (let i = 0; i < 12; i++) T({ f: NOTE(84 + PENTA[i % 5] + 12 * (i % 3 === 0 ? 1 : 0)) * (1 + Math.random() * 0.02), d: 0.09, v: 0.18, t0: i * 0.06 + Math.random() * 0.02, type: i % 2 ? 'square' : 'sine' });
        T({ f: 700, f2: 90, d: 0.7, v: 0.32, type: 'sawtooth' }); N({ f: 5000, f2: 800, q: 1, d: 0.5, v: 0.3, hp: 600 }); break;
      }
      case 'death': T({ f: 440, f2: 70, d: 0.9, v: 0.4, type: 'sawtooth' }); T({ f: 330, f2: 55, d: 1.0, v: 0.3, type: 'square', t0: 0.05 }); N({ f: 3000, f2: 300, d: 0.7, v: 0.35 }); break;
      // --- 道具 ---
      case 'pickup': { const r = o.rarity || 0; const base = 76 + r; T({ f: NOTE(base), d: 0.1, v: 0.3, type: 'triangle' }); T({ f: NOTE(base + 7), d: 0.16, v: 0.3, t0: 0.06, type: 'triangle' }); if (r >= 2) T({ f: NOTE(base + 12), d: 0.25, v: 0.22, t0: 0.12 }); if (r >= 3) T({ f: NOTE(base + 16), d: 0.4, v: 0.18, t0: 0.18 }); break; }
      case 'pickup_ammo': N({ f: 3000, q: 2, d: 0.025, v: 0.5 }); N({ f: 2200, q: 2, d: 0.03, v: 0.45, t0: 0.045 }); T({ f: NOTE(80), d: 0.05, v: 0.15, t0: 0.03 }); break;
      case 'reload': this._mech('click', 0.05); this._mech('thunk', 0.9); this._mech('clack', 1.7); break;
      case 'empty': N({ f: 3800, q: 3, d: 0.018, v: 0.6, a: 0.001 }); T({ f: 700, f2: 400, d: 0.03, v: 0.2, type: 'square' }); break;
      case 'heal': for (let i = 0; i < 5; i++) T({ f: NOTE(72 + i * 4), d: 0.16, v: 0.2, t0: i * 0.055, type: 'sine' }); T({ f: NOTE(91), d: 0.5, v: 0.14, t0: 0.28 }); break;
      case 'shield_heal': T({ f: 400, f2: 1500, d: 0.35, v: 0.28, type: 'triangle' }); for (let i = 0; i < 4; i++) T({ f: NOTE(84 + PENTA[i]), d: 0.2, v: 0.17, t0: 0.12 + i * 0.05 }); N({ f: 5000, type: 'highpass', d: 0.3, v: 0.2, t0: 0.1 }); break;
      case 'bandage': N({ f: 2800, q: 1, d: 0.14, v: 0.35, hp: 1200 }); break;
      case 'drink': T({ f: 300 + Math.random() * 120, f2: 520 + Math.random() * 160, d: 0.09, v: 0.3 }); N({ f: 1000, q: 3, d: 0.05, v: 0.12 }); break;
      case 'chest': {
        N({ f: 500, f2: 1800, q: 2, d: 0.35, v: 0.5 }); T({ f: 110, f2: 70, d: 0.2, v: 0.6, type: 'triangle' });
        [0, 4, 7, 11, 14, 16, 19].forEach((s, i) => T({ f: NOTE(72 + s), d: 0.7, v: 0.2, t0: 0.12 + i * 0.07, type: 'sine', vib: 3 }));
        for (let i = 0; i < 10; i++) T({ f: NOTE(88 + PENTA[Math.floor(Math.random() * 5)] + (Math.random() < 0.5 ? 12 : 0)), d: 0.3, v: 0.09, t0: 0.25 + Math.random() * 0.7 });
        break;
      }
      case 'weakpoint': T({ f: 2300, d: 0.12, v: 0.35, a: 0.001 }); T({ f: 3400, d: 0.18, v: 0.2, a: 0.001, t0: 0.03 }); break;
      // --- 採集／建造 ---
      case 'harvest_wood': N({ f: 520, q: 1.2, d: 0.11, v: 0.8, a: 0.001 }); T({ f: 170, f2: 110, d: 0.12, v: 0.55, type: 'triangle' }); N({ f: 2200, q: 2, d: 0.03, v: 0.4, a: 0.001 }); break;
      case 'harvest_stone': N({ f: 1700, q: 1.2, d: 0.09, v: 0.8, a: 0.001 }); T({ f: 330, f2: 200, d: 0.06, v: 0.35, type: 'square' }); N({ f: 5200, q: 3, d: 0.04, v: 0.35, a: 0.001 }); break;
      case 'harvest_metal': T({ f: 1250, d: 0.4, v: 0.3, type: 'square', a: 0.001 }); T({ f: 1870, d: 0.3, v: 0.2, a: 0.001 }); N({ f: 4200, q: 3, d: 0.06, v: 0.5, a: 0.001 }); T({ f: 2630, d: 0.25, v: 0.12, t0: 0.01 }); break;
      case 'swing': N({ f: 500, f2: 1700, q: 1.5, d: 0.16, v: 0.35, a: 0.05 }); break;
      case 'build': case 'build_wood': this._build(out, 'wood'); break;
      case 'build_stone': this._build(out, 'stone'); break;
      case 'build_metal': this._build(out, 'metal'); break;
      case 'break': case 'break_wood': N({ f: 600, type: 'lowpass', d: 0.4, v: 0.9 }); for (let i = 0; i < 6; i++) { N({ f: 700 + Math.random() * 1500, q: 2, d: 0.04, v: 0.7, t0: Math.random() * 0.35 }); } T({ f: 90, f2: 40, d: 0.35, v: 0.7 }); break;
      case 'break_stone': N({ f: 400, type: 'lowpass', d: 0.55, v: 1 }); for (let i = 0; i < 8; i++) N({ f: 1200 + Math.random() * 2400, q: 3, d: 0.04, v: 0.6, t0: Math.random() * 0.5 }); T({ f: 70, f2: 32, d: 0.5, v: 0.9 }); break;
      case 'break_metal': N({ f: 500, type: 'lowpass', d: 0.4, v: 0.7 }); T({ f: 1150, d: 0.5, v: 0.25, type: 'square', a: 0.001 }); T({ f: 1720, d: 0.4, v: 0.15 }); for (let i = 0; i < 5; i++) N({ f: 2500 + Math.random() * 3000, q: 4, d: 0.03, v: 0.5, t0: Math.random() * 0.4 }); T({ f: 80, f2: 40, d: 0.4, v: 0.7 }); break;
      // --- 移動 ---
      case 'jump': N({ f: 700, f2: 1400, q: 1, d: 0.1, v: 0.22, a: 0.03 }); T({ f: 200, f2: 320, d: 0.07, v: 0.12 }); break;
      case 'land': this._landSnd(out, o.surf || 'grass', o.k ?? 0.5); break;
      case 'dive': N({ f: 400, f2: 3000, q: 0.7, d: 0.8, v: 0.5, a: 0.2, type: 'bandpass' }); T({ f: 180, f2: 90, d: 0.4, v: 0.25, type: 'sine' }); break;
      case 'glider_open': N({ f: 900, f2: 2400, q: 1.2, d: 0.2, v: 0.8, a: 0.004 }); T({ f: 150, f2: 65, d: 0.3, v: 0.7 }); N({ f: 300, type: 'lowpass', d: 0.45, v: 0.5, brown: true }); N({ f: 4500, q: 2, d: 0.08, v: 0.4, t0: 0.12 }); break;
      // --- 流程／UI ---
      case 'storm_warn': [0, 0.5].forEach((t) => { T({ f: 220, f2: 330, d: 0.5, v: 0.28, type: 'sawtooth', t0: t, a: 0.08 }); T({ f: 329, f2: 440, d: 0.5, v: 0.2, type: 'triangle', t0: t, a: 0.08 }); }); N({ f: 120, type: 'lowpass', d: 1.2, v: 0.5, brown: true }); break;
      case 'bus_horn': T({ f: 196, d: 0.6, v: 0.3, type: 'sawtooth', a: 0.04 }); T({ f: 247, d: 0.6, v: 0.25, type: 'sawtooth', a: 0.04 }); T({ f: 294, d: 0.6, v: 0.2, type: 'sawtooth', a: 0.04 }); break;
      case 'win': [0, 4, 7, 12, 7, 12, 16, 19].forEach((s, i) => { T({ f: NOTE(67 + s), d: 0.4, v: 0.3, t0: i * 0.11, type: 'triangle' }); T({ f: NOTE(79 + s), d: 0.3, v: 0.1, t0: i * 0.11 }); }); [0, 4, 7, 12, 16].forEach((s) => T({ f: NOTE(72 + s), d: 1.4, v: 0.16, t0: 0.9, type: 'sine', vib: 2 })); N({ f: 6000, type: 'highpass', d: 0.8, v: 0.18, t0: 0.9 }); break;
      case 'lose': [440, 392, 330, 262].forEach((f, i) => T({ f, d: 0.5, v: 0.3, t0: i * 0.18, type: 'triangle' })); break;
      case 'ui': case 'ui_click': T({ f: 880, f2: 700, d: 0.05, v: 0.12, type: 'square', a: 0.001 }); N({ f: 4000, q: 2, d: 0.02, v: 0.1, a: 0.001 }); break;
      case 'ui_hover': T({ f: 1500, d: 0.03, v: 0.1, type: 'sine', a: 0.001 }); break;
      case 'ui_confirm': T({ f: NOTE(79), d: 0.1, v: 0.25, type: 'triangle' }); T({ f: NOTE(86), d: 0.18, v: 0.25, t0: 0.07, type: 'triangle' }); break;
      case 'error': T({ f: 200, f2: 150, d: 0.18, v: 0.3, type: 'square' }); T({ f: 190, f2: 140, d: 0.18, v: 0.25, type: 'square', t0: 0.09 }); break;
      case 'countdown': T({ f: 660, d: 0.15, v: 0.3, type: 'triangle' }); break;
    }
  }
  _build(out, mat) {
    const N = (p) => this.noise(out, p), T = (p) => this.tone(out, p);
    T({ f: 220, f2: 440, d: 0.09, v: 0.3, type: 'triangle' }); N({ f: 500, f2: 2200, q: 1, d: 0.16, v: 0.35, a: 0.03 });
    if (mat === 'wood') { N({ f: 450, q: 1.5, d: 0.1, v: 0.7, t0: 0.08 }); T({ f: 150, f2: 100, d: 0.14, v: 0.5, t0: 0.08, type: 'triangle' }); N({ f: 1800, q: 2, d: 0.03, v: 0.3, t0: 0.12 }); }
    else if (mat === 'stone') { N({ f: 1500, q: 1.2, d: 0.14, v: 0.6, t0: 0.08 }); T({ f: 110, f2: 60, d: 0.2, v: 0.6, t0: 0.08 }); N({ f: 300, type: 'lowpass', d: 0.2, v: 0.5, t0: 0.08, brown: true }); }
    else { T({ f: 760, d: 0.35, v: 0.2, type: 'square', t0: 0.08, a: 0.001 }); T({ f: 1140, d: 0.3, v: 0.12, t0: 0.08 }); N({ f: 3600, q: 3, d: 0.05, v: 0.4, t0: 0.08, a: 0.001 }); T({ f: 120, f2: 70, d: 0.15, v: 0.4, t0: 0.08 }); }
  }
  _landSnd(out, surf, k) {
    const N = (p) => this.noise(out, p), T = (p) => this.tone(out, p);
    T({ f: 110, f2: 50, d: 0.14 + 0.1 * k, v: 0.8 * k });
    if (surf === 'wood') { N({ f: 450, q: 1.5, d: 0.12, v: 0.8 * k }); T({ f: 160, f2: 100, d: 0.14, v: 0.5 * k, type: 'triangle' }); }
    else if (surf === 'stone' || surf === 'path') { N({ f: 1500, q: 1, d: 0.1, v: 0.8 * k }); N({ f: 400, type: 'lowpass', d: 0.14, v: 0.6 * k }); }
    else if (surf === 'metal') { T({ f: 640, d: 0.3, v: 0.25 * k, type: 'square', a: 0.001 }); N({ f: 3500, q: 3, d: 0.05, v: 0.5 * k }); }
    else if (surf === 'sand') N({ f: 700, type: 'lowpass', d: 0.2, v: 0.7 * k });
    else if (surf === 'water') { N({ f: 900, f2: 2500, q: 1, d: 0.35, v: 0.8 * k }); }
    else { N({ f: 380, type: 'lowpass', d: 0.18, v: 0.9 * k }); N({ f: 2500, q: 1, d: 0.06, v: 0.25 * k }); }
  }
  _foot(surf, o) {
    const k = o.k ?? 1, out = this._out((o.volume ?? 1) * k, o.pos, { ref: 7 }); if (!out) return;
    const N = (p) => this.noise(out, p), T = (p) => this.tone(out, p), r = 0.9 + Math.random() * 0.2;
    switch (surf) {
      case 'wood': N({ f: 520 * r, q: 1.6, d: 0.07, v: 0.7, a: 0.001 }); T({ f: 190 * r, f2: 120, d: 0.08, v: 0.45, type: 'triangle' }); break;
      case 'stone': case 'path': N({ f: 1700 * r, q: 1.2, d: 0.05, v: 0.6, a: 0.001 }); N({ f: 400, type: 'lowpass', d: 0.07, v: 0.4 }); break;
      case 'metal': T({ f: 600 * r, f2: 420, d: 0.12, v: 0.2, type: 'square', a: 0.001 }); N({ f: 3000, q: 3, d: 0.04, v: 0.45, a: 0.001 }); T({ f: 160, f2: 100, d: 0.07, v: 0.3 }); break;
      case 'sand': N({ f: 900 * r, q: 0.8, d: 0.13, v: 0.45, a: 0.02 }); break;
      case 'water': N({ f: 1100 * r, f2: 2200, q: 1.2, d: 0.16, v: 0.55, a: 0.004 }); T({ f: 300 + Math.random() * 300, f2: 700, d: 0.07, v: 0.1 }); break;
      default: N({ f: 420 * r, type: 'lowpass', d: 0.09, v: 0.55, a: 0.004 }); N({ f: 2600 * r, q: 0.8, d: 0.05, v: 0.2, a: 0.004 }); // 草地
    }
  }

  // ---------- 持續音 ----------
  _buildLoops() {
    const ac = this.ac, L = (this.loops = {});
    const loopNoise = (buf, type, f, q) => {
      const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = ac.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(this.master); s.start(0, Math.random()); return { s, fl, g };
    };
    // 風暴嗡鳴：兩個失諧鋸齒波＋棕噪＋慢速顫動
    const sg = ac.createGain(); sg.gain.value = 0; const sf = ac.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 260; sf.Q.value = 3;
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(); o1.type = o2.type = 'sawtooth'; o1.frequency.value = 54; o2.frequency.value = 54.9;
    const og = ac.createGain(); og.gain.value = 0.35; o1.connect(og); o2.connect(og); og.connect(sf); sf.connect(sg); sg.connect(this.master);
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.35; lg.gain.value = 90; lfo.connect(lg); lg.connect(sf.frequency); o1.start(); o2.start(); lfo.start();
    const sn = loopNoise(this.brownBuf, 'lowpass', 380, 0.7); const sw = loopNoise(this.noiseBuf, 'bandpass', 900, 4);
    L.storm = { g: sg, o1, o2, rum: sn, whi: sw, lfo };
    // 風：滑翔／自由落體
    L.wind = loopNoise(this.noiseBuf, 'bandpass', 600, 0.6);
    L.wind2 = loopNoise(this.brownBuf, 'lowpass', 500, 0.5);
    // 飛艇引擎
    const eg = ac.createGain(); eg.gain.value = 0; const ef = ac.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 320; ef.Q.value = 2;
    const e1 = ac.createOscillator(), e2 = ac.createOscillator(), e3 = ac.createOscillator(); e1.type = 'sawtooth'; e2.type = 'sawtooth'; e3.type = 'square'; e1.frequency.value = 46; e2.frequency.value = 47.3; e3.frequency.value = 23;
    const eo = ac.createGain(); eo.gain.value = 0.3; e1.connect(eo); e2.connect(eo); e3.connect(eo); eo.connect(ef); ef.connect(eg); eg.connect(this.master);
    const am = ac.createOscillator(), amg = ac.createGain(); am.frequency.value = 11; amg.gain.value = 0.18; am.connect(amg); amg.connect(eg.gain); e1.start(); e2.start(); e3.start(); am.start();
    const pr = loopNoise(this.noiseBuf, 'bandpass', 500, 1.2); // 螺旋槳呼呼
    L.engine = { g: eg, f: ef, am, amg, prop: pr };
    // 心跳
    L.heart = ac.createGain(); L.heart.gain.value = 0; L.heart.connect(this.master);
  }
  _set(param, v, tc = 0.12) { param.setTargetAtTime(v, this.ac.currentTime, tc); }
  _thump(t0, v) {
    const ac = this.ac, o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + t0; o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(g); g.connect(this.loops.heart); o.start(t); o.stop(t + 0.2);
  }

  update(dt) {
    if (!this.ac || this.ac.state !== 'running') return;
    const c = this.ctx, P = c.player, L = this.loops; if (!P || !L) return;
    const m = c.match, cam = c.camera.position, inGame = m && m.state !== 'menu';
    // 暫停或在選單：所有持續音歸零，不跑後面的邏輯
    if (c.paused || !inGame) {
      for (const g of [L.storm.g, L.storm.rum.g, L.storm.whi.g, L.wind.g, L.wind2.g, L.engine.g, L.engine.prop.g]) this._set(g.gain, 0, 0.08);
      this.consume = null; return;
    }
    // 艙門倒數：最後 3 秒每秒一聲滴
    if (m.state === 'bus' && !m.doorOpened && m.openIn) { const s = Math.ceil(m.openIn()); if (s !== this._cd && s >= 1 && s <= 3) this.play('countdown', { pitch: 1 }); this._cd = s; } else if (m.state !== 'bus') this._cd = null;
    const fa = c.cam && c.cam.focusActor ? c.cam.focusActor() : P; // 觀戰時聽被觀戰者
    // 風暴嗡鳴：圈外 → 滿；圈邊緣外 60 m 內漸強
    let storm = 0;
    if (inGame && c.storm && c.storm.active && fa.alive) {
      const x = fa.pos.x, z = fa.pos.z, st = c.storm;
      if (st.isOutside(x, z)) storm = clamp(0.55 + st.distToSafe(x, z) / 60, 0.55, 1);
      else storm = clamp(1 - (st.radius - Math.hypot(x - st.center.x, z - st.center.y)) / 70, 0, 1) * 0.3; // 靠近圈邊就開始隱約嗡鳴
    }
    const tint = c.render && c.render.stormTint ? c.render.stormTint : 0; storm = Math.max(storm, tint);
    this._set(L.storm.g.gain, storm * 0.55, 0.3); this._set(L.storm.rum.g.gain, storm * 0.5, 0.3); this._set(L.storm.whi.g.gain, storm * 0.05, 0.4);
    this._set(L.storm.whi.fl.frequency, 700 + 500 * Math.sin(c.time.now * 0.4), 0.4);
    // 風聲
    let wind = 0, wf = 600;
    if (inGame && fa.alive) {
      const sp = Math.hypot(fa.vel.x, fa.vel.y, fa.vel.z);
      if (fa.state === 'skydive') { wind = clamp(sp / 60, 0.2, 1) * 0.95; wf = 500 + sp * 18; }
      else if (fa.state === 'glide') { wind = clamp(sp / 22, 0.2, 0.9) * 0.45; wf = 700 + sp * 25; }
      else if (fa.state === 'air' && fa.vel.y < -12) { wind = clamp((-fa.vel.y - 12) / 20, 0, 0.5); wf = 800; }
    }
    this._set(L.wind.g.gain, wind * 0.5, 0.15); this._set(L.wind.fl.frequency, wf, 0.2); this._set(L.wind2.g.gain, wind * 0.4, 0.2);
    // 飛艇引擎（登機時最大聲，跳下後依距離衰減）
    let eng = 0, ef = 320;
    if (m && (m.state === 'bus' || (m.state === 'playing' && m.bus && m.bus.visible))) {
      const bp = m.busPos ? m.busPos(this._bp || (this._bp = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } })) : null;
      const d = bp ? Math.hypot(bp.x - cam.x, bp.y - cam.y, bp.z - cam.z) : 0;
      eng = clamp(1 / (1 + d / 45), 0, 1) * (fa.state === 'bus' ? 1 : 0.9); ef = clamp(900 / (1 + d / 60), 180, 900);
    }
    this._set(L.engine.g.gain, eng * 0.4, 0.25); this._set(L.engine.f.frequency, ef, 0.3); this._set(L.engine.prop.g.gain, eng * 0.1, 0.3); this._set(L.engine.prop.fl.frequency, 400 + eng * 300, 0.5);
    // 寶箱閃亮：最近的未開寶箱
    this.shimT -= dt;
    if (inGame && fa.alive && this.shimT <= 0 && c.loot && c.loot.chests) {
      let best = null, bd = 38;
      for (const ch of c.loot.chests) { if (ch.opened) continue; const d = Math.hypot(ch.x - fa.pos.x, ch.z - fa.pos.z); if (d < bd && Math.abs(ch.y - fa.pos.y) < 12) { bd = d; best = ch; } }
      if (best) {
        const rate = 1.4 + 6 * clamp(1 - bd / 38, 0, 1); this.shimT = 1 / rate * (0.7 + Math.random() * 0.6);
        const out = this._out(0.5, { x: best.x, y: best.y + 0.6, z: best.z }, { ref: 10, rev: 0.25 });
        if (out) { const n = 84 + PENTA[Math.floor(Math.random() * 5)] + (Math.random() < 0.4 ? 12 : 0); this.tone(out, { f: NOTE(n), d: 0.5, v: 0.28, a: 0.004, vib: 2 }); if (Math.random() < 0.5) this.tone(out, { f: NOTE(n + 12), d: 0.3, v: 0.12, t0: 0.05 }); }
      } else this.shimT = 0.4;
    }
    // 心跳
    if (inGame && P.alive && P.health < 32) {
      this.heartT -= dt;
      if (this.heartT <= 0) { const k = clamp((32 - P.health) / 32, 0.2, 1); this.heartT = 1.15 - 0.4 * k; this._thump(0, 0.5 * k); this._thump(0.17, 0.35 * k); }
    }
    // 吃喝：循環小聲
    const act = P.action;
    if (act && act.kind === 'consume' && P.alive) {
      if (!this.consume) this.consume = { t: 0, n: 0 };
      this.consume.t -= dt;
      if (this.consume.t <= 0) {
        const id = act.data && act.data.item ? act.data.item.defId : '';
        if (id.includes('shield')) { this.play('drink', { volume: 0.8 }); this.consume.t = 0.28 + Math.random() * 0.1; } else { this.play('bandage', { volume: 0.7, pitch: 1 + Math.random() * 0.2 }); this.consume.t = 0.2 + Math.random() * 0.1; }
      }
    } else this.consume = null;
    // 腳步：隨角色動畫的步態相位同步
    this.surfT -= dt;
    for (const a of c.actors) {
      if (!a.alive || !a.view || a.state !== 'ground') continue;
      const d = Math.hypot(a.pos.x - cam.x, a.pos.z - cam.z); if (d > 38 && a !== P) continue;
      const sp = Math.hypot(a.vel.x, a.vel.z); if (sp < 1.2) { this.steps.delete(a.id); continue; }
      const idx = Math.floor(a.view.phase / Math.PI), prev = this.steps.get(a.id);
      this.steps.set(a.id, idx);
      if (prev === undefined || prev === idx) continue;
      const k = a.crouching ? 0.4 : a.sprinting ? 1.1 : 0.8;
      this.play('footstep_' + this._surface(a), { pos: a === P || a === fa ? null : a.pos, k });
    }
  }
}
