// 珊瑚灣垂釣 · CORAL COVE（作品 201）：入口。渲染器、光影、鏡頭、主迴圈與測試 API window.__cc。
import * as THREE from 'three';
import { loadAll, report } from './assets.js';
import { buildWorld } from './world.js';
import { buildWater } from './water.js';
import { Fisher } from './fisher.js';
import { Fishes, CATCHABLE, sampleLen } from './fish.js';
import { Fishing } from './fishing.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { UW } from './underwater.js';

const $ = (id) => document.getElementById(id);
const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches;
if (touch) document.body.classList.add('touch');
const mobile = touch || Math.min(innerWidth, innerHeight) < 600;
const MUTE_KEY = 'coral-cove.mute';
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* 無痕或封鎖 */ } } };

class Game {
  constructor() {
    const canvas = $('view');
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.6 : 2));
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color('#d6efe6');
    scene.fog = new THREE.Fog('#dcefe4', 60, 170);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
    // 光：暖色天光＋太陽（投影跟著玩家附近）
    this.sunDir = new THREE.Vector3(-0.42, 0.82, 0.38).normalize();
    scene.add(new THREE.HemisphereLight('#fff4dc', '#d9c7a0', 1.05));   // 地面色用暖沙色，臉與水下物件的背光面才不會泛青綠
    const sun = this.sun = new THREE.DirectionalLight('#fff0d4', 2.7);
    sun.castShadow = true;
    const sm = mobile ? 1024 : 2048;
    sun.shadow.mapSize.set(sm, sm);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.025;
    scene.add(sun, sun.target);

    this.world = buildWorld(scene, { mobile });
    this.water = buildWater(scene, this.world.depthTex, this.sunDir);
    this.water.uniforms.uBoat.value.set(this.world.boat.position.x, this.world.boat.position.z, this.world.boat.rotation.y, 0.56);
    this.fisher = new Fisher(scene);
    this.fishes = new Fishes(scene, { mobile, piles: this.world.piles });
    this.ui = new UI();
    this.audio = new Audio();
    this.fishing = new Fishing(this);
    this.fisher.place(0, -5.5, Math.PI);

    this.paused = false;
    this.audio.muted = store.get(MUTE_KEY) === '1';
    this.ui.setMuted(this.audio.muted);
    this.input = new Input(canvas, {
      gesture: () => this.audio.start(),
      actionDown: () => {
        if (!this.started) { this.start(); return; }   // 開場卡：空白鍵／點畫面也能開始
        if (this.paused) { this.setPause(false); return; }
        if (this.ui.isOpen('creelPanel')) return;
        this.fishing.actionDown();
      },
      actionUp: () => { if (!this.paused) this.fishing.actionUp(); },
      stow: () => { if (this.started && !this.paused && !this.fishing.locked) this.fishing.stow(); },
      bait: () => this.toggleBait(),
      creel: () => this.toggleCreel(),
      pause: () => { if (this.started && !this.anyPanel()) this.setPause(!this.paused); else if (this.paused) this.setPause(false); },
      mute: () => this.toggleMute(),
      escape: () => {
        if (this.ui.isOpen('baitMenu')) this.toggleBait(false);
        else if (this.ui.isOpen('creelPanel')) this.toggleCreel(false);
        else if (this.paused) this.setPause(false);
        else if (this.fishing.phase === 'catch') this.fishing.endCatch();
        else if (this.fishing.phase === 'full') this.fishing.confirmFull();
        else if (this.started) this.setPause(true);
      },
      enter: () => { if (!this.started) this.start(); else if (this.paused) this.setPause(false); else this.fishing.confirmFull(); },
    });
    this.input.bindButton($('btnMain'), () => this.input.down('btn'), () => this.input.up('btn'));
    this.input.bindButton($('btnStow'), () => { if (this.started && !this.paused && !this.fishing.locked) this.fishing.stow(); }, () => {});
    this.input.bindStick($('stick'), $('knob'));
    $('baitBtn').addEventListener('click', () => this.toggleBait());
    $('creelBox').addEventListener('click', () => this.toggleCreel());
    $('btnPause').addEventListener('click', () => this.setPause(!this.paused));
    $('btnMute').addEventListener('click', () => this.toggleMute());
    $('creelPanel').addEventListener('click', (e) => { if (e.target.closest('#creelClose')) this.toggleCreel(false); });
    $('pauseCard').addEventListener('click', (e) => { if (e.target.closest('#resumeBtn')) this.setPause(false); });
    // 分頁切到背景就自動暫停（連聲音一起停），回來時顯示暫停卡等玩家按繼續
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.started && !this.paused) this.setPause(true, '剛剛切到別的分頁，先幫你暫停了。'); });
    $('start').addEventListener('click', () => this.start());
    $('card').addEventListener('click', () => { if (this.fishing.phase === 'catch') this.fishing.endCatch(); });
    // detail 0＝鍵盤（Enter）觸發的 click，套用 0.4 s 防誤觸；滑鼠與觸控直接放回
    $('full').addEventListener('click', (e) => { if (e.target.closest('#releaseBtn')) { if (e.detail === 0) this.fishing.confirmFull(); else this.fishing.releaseAll(); } });
    $('baitMenu').addEventListener('click', (e) => {
      if (e.target.closest('#baitClose')) { this.toggleBait(false); return; }
      const o = e.target.closest('.opt'); if (!o) return;
      if (o.classList.contains('locked')) { this.ui.toast('這種餌之後開放，先用麵包吧'); return; }
      this.fishing.bait = o.dataset.bait; this.toggleBait(false);
    });
    // 走路的腳步聲：依兩隻腳骨頭的高度，腳落地那一下才響
    this.feet = ['foot_L', 'foot_R'].map((n) => ({ b: this.fisher.obj.getObjectByName(n), up: false })).filter((x) => x.b);
    this.stepPhase = 0;

    this.ui.setCreel([], 8);
    this.camMode = 'follow';
    this.focus = new THREE.Vector3().copy(this.fisher.pos);
    this.camPos = new THREE.Vector3();
    this.started = false;
    this.ts = 1;
    this.t = 0;
    this.hudOn = true;
    this.last = performance.now();
    addEventListener('resize', () => this.resize());
    this.resize();
    this.updateCamera(1, true);
  }
  start() {
    if (this.started) return;
    this.started = true;
    this.audio.start();
    this.ui.show('intro', false);
    this.ui.show('hud', this.hudOn);
    this.ui.toast(this.fisher.deck ? (touch ? '往棧橋盡頭走，按住大圓鈕甩竿' : '往棧橋盡頭走，按住空白鍵甩竿') : '走到棧橋上甩竿', 3.2);
  }
  anyPanel() { return ['baitMenu', 'creelPanel', 'full', 'pauseCard'].some((id) => this.ui.isOpen(id)); }
  // 面板開著時 HUD 設為 inert：Tab 不會跑到面板後面的圓鈕
  syncModal() { const m = this.anyPanel(); if (m !== this.modal) { this.modal = m; $('hud').inert = m; } }
  rememberFocus() { this.returnTo = document.activeElement && document.activeElement !== document.body ? document.activeElement : null; }
  restoreFocus() {
    const r = this.returnTo; this.returnTo = null;
    if (r && r.isConnected && r.getClientRects().length) r.focus({ preventScroll: true });
    else if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  }
  toggleBait(on) {
    const open = on ?? !this.ui.isOpen('baitMenu');
    if (open && (!this.started || this.paused)) return;
    if (open && this.ui.isOpen('creelPanel')) this.toggleCreel(false);
    if (open && this.fishing.phase !== 'explore') { if (this.fishing.phase !== 'full') this.ui.toast('收竿後才能換魚餌（E 收竿）', 2.2); return; }   // 只有走動時能換餌
    if (open === this.ui.isOpen('baitMenu')) return;
    if (open) { this.rememberFocus(); this.ui.showBaitMenu(this.fishing.bait); this.fishing.locked = true; }
    else { this.ui.show('baitMenu', false); this.fishing.locked = this.fishing.phase === 'full'; }
    this.audio.ui(open);
    this.syncModal();
    if (!open) this.restoreFocus();
  }
  // 魚簍面板（C 或點上方魚簍）：這一簍的魚＋圖鑑。釣魚中打開時遊戲暫停（避免拔河時脫鉤）
  toggleCreel(on) {
    const open = on ?? !this.ui.isOpen('creelPanel');
    if (open && (!this.started || this.paused || this.ui.isOpen('full') || this.fishing.phase === 'catch')) return;
    if (open === this.ui.isOpen('creelPanel')) return;
    if (open) {
      if (this.ui.isOpen('baitMenu')) this.toggleBait(false);
      if (this.fishing.phase === 'charge') this.fishing.stow();   // 蓄力中打開就取消蓄力，關面板時不會突然甩出去
      this.rememberFocus(); this.ui.showCreel(this.fishing.creel, this.fishing.creelMax, this.fishing.log);
      this.creelLock = this.fishing.locked; this.fishing.locked = true;
    } else { this.ui.show('creelPanel', false); this.fishing.locked = this.creelLock || this.fishing.phase === 'full'; }
    this.audio.ui(open);
    this.syncModal();
    if (!open) this.restoreFocus();
  }
  setPause(on, why = '') {
    on = !!on;
    if (on === this.paused || (on && !this.started)) return;
    this.paused = on;
    document.body.classList.toggle('paused', on);
    if (on && this.fishing.phase === 'charge') this.fishing.stow();
    this.input.up('all');
    if (on) { this.rememberFocus(); this.ui.showPause(true, why); this.audio.setPaused(true); }
    else { this.ui.showPause(false); this.audio.setPaused(false); this.audio.ui(false); this.last = performance.now(); }
    this.syncModal();
    if (!on) this.restoreFocus();
  }
  toggleMute() {
    this.audio.setMuted(!this.audio.muted);
    this.ui.setMuted(this.audio.muted);
    store.set(MUTE_KEY, this.audio.muted ? '1' : '0');
    this.ui.toast(this.audio.muted ? '已靜音（M 開啟聲音）' : '聲音開啟', 1.4);
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.portrait = w / h < 0.85;
    this.camera.fov = this.portrait ? 50 : 40;
    this.camera.updateProjectionMatrix();
  }
  updateCamera(dt, snap = false) {
    const f = this.fisher, ph = this.fishing.phase;
    const tgt = new THREE.Vector3();
    let dist, pitch, yawOff = 0, lift = 0.6;
    const cam = this.camera;
    if (this.camMode === 'overview') { tgt.set(0, 0, -5); dist = this.portrait ? 78 : 50; pitch = 60; }
    else if (this.camMode === 'hero') {
      // 縮圖／宣傳用：從漁夫背後斜上方看向浮標
      tgt.copy(f.pos).lerp(this.fishing.bob, 0.45); tgt.y = 0.2; dist = this.portrait ? 13 : 11; pitch = 40; yawOff = 0.38;
    } else if (this.camMode === 'close') {
      tgt.copy(f.pos); lift = 1.0; dist = this.portrait ? 6.5 : 4.8; pitch = 24; yawOff = f.yaw + 1.05;
    } else {
      tgt.copy(f.pos);
      const out = ['wait', 'bite', 'fight'].includes(ph) || (ph === 'cast' && this.fishing.launched);
      if (out) tgt.lerp(this.fishing.bob, 0.5);
      tgt.y = Math.max(0, tgt.y * 0.5);
      const minW = this.portrait ? 11 : 15;
      const hw = Math.tan((cam.fov * Math.PI) / 360) * cam.aspect;
      dist = Math.max(this.portrait ? 19 : 17, minW / (2 * hw));
      pitch = 58;
      if (ph === 'catch') {
        // 舉魚：鏡頭繞到漁夫正前方拉近。手機橫式（矮）的魚卡在右側，把漁夫移到卡片左邊空出來的區域正中；
        // 其他窄螢幕的魚卡在上方，把漁夫擺到畫面下半（和 index.html 的 #card 媒體查詢一致）
        yawOff = 0.3; pitch = 30; dist = this.portrait ? 8.5 : 6.8; tgt.y = f.pos.y + 1.0;
        const w = innerWidth, h = innerHeight;
        if (w > h && h <= 520) {
          const cardL = w - 12 - 280, frac = cardL / 2 / w;
          const halfW = Math.tan((cam.fov * Math.PI) / 360) * dist * cam.aspect;
          const sh = (0.5 - frac) * 2 * halfW;
          tgt.x += Math.cos(yawOff) * sh; tgt.z -= Math.sin(yawOff) * sh;
        } else if (w <= 860) { tgt.x -= Math.sin(yawOff) * 1.8; tgt.z -= Math.cos(yawOff) * 1.8; }
      }
    }
    const k = snap ? 1 : 1 - Math.exp(-dt * (this.camMode === 'follow' ? 3.2 : 6));
    this.focus.lerp(tgt, k);
    const p = (pitch * Math.PI) / 180;
    const off = new THREE.Vector3(Math.sin(yawOff) * Math.cos(p), Math.sin(p), Math.cos(yawOff) * Math.cos(p)).multiplyScalar(dist);
    const want = new THREE.Vector3().copy(this.focus).add(off);
    if (snap || this.camMode !== 'follow') this.camPos.copy(want); else this.camPos.lerp(want, k);
    cam.position.copy(this.camPos);
    cam.lookAt(this.focus.x, this.focus.y + (this.camMode === 'close' ? lift : 0), this.focus.z);
    // 陰影相機跟著玩家附近
    const sc = this.camMode === 'overview' ? 34 : 16;
    Object.assign(this.sun.shadow.camera, { left: -sc, right: sc, top: sc, bottom: -sc });
    this.sun.shadow.camera.updateProjectionMatrix();
    const c = this.camMode === 'overview' ? tgt : this.focus;
    this.sun.target.position.set(c.x, 0, c.z);
    this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDir, 30);
    this.scene.fog.near = this.camMode === 'overview' ? 90 : 55;
    this.scene.fog.far = this.camMode === 'overview' ? 220 : 160;
    this.water.uniforms.uFogRange.value.set(this.scene.fog.near, this.scene.fog.far);
  }
  step(dt) {
    this.t += dt;
    UW.uTime.value = this.t;
    const f = this.fisher, fs = this.fishing;
    // 移動（只有 explore 能走；蓄力時可以原地轉向瞄準）
    const mv = this.input.move();
    const canWalk = this.started && fs.phase === 'explore' && !fs.locked && !fs.posed;
    if (canWalk) {
      f.move(mv.x, mv.y, dt);
      if (f.speed > 0.1) { if (f.curName !== 'walk') f.play('walk', 0.18); if (f.cur) f.cur.timeScale = f.speed / 1.6; }
      else if (f.curName === 'walk') f.play('idle', 0.25);
    } else if (fs.phase === 'charge' && Math.hypot(mv.x, mv.y) > 0.2) {
      fs.yawBack = null;
      const ty = Math.atan2(mv.x, mv.y); let d = ty - f.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); f.yaw += d * Math.min(1, dt * 8);
    }
    f.update(fs.posed ? 0 : dt);
    this.footsteps();
    this.world.update(dt, this.t);
    this.fishes.update(dt, this.t);
    fs.update(dt, this.t);
    this.ui.tick(dt);
    this.hints();
  }
  footsteps() {
    const f = this.fisher;
    if (f.curName !== 'walk' || f.speed < 0.1 || !this.feet.length) { for (const s of this.feet) s.up = false; return; }
    const v = new THREE.Vector3();
    for (const s of this.feet) {
      const hgt = s.b.getWorldPosition(v).y - f.pos.y;
      if (s.lo == null) { s.lo = hgt; s.hi = hgt; }
      s.lo = Math.min(s.lo + 0.0005, hgt); s.hi = Math.max(s.hi - 0.0005, hgt);   // 慢慢忘記的最低／最高點
      const span = Math.max(0.02, s.hi - s.lo);
      if (s.up && hgt < s.lo + span * 0.25) { s.up = false; this.audio.step(f.deck); }
      else if (hgt > s.lo + span * 0.6) s.up = true;
    }
  }
  hints() {
    const ph = this.fishing.phase, ui = this.ui, t = touch;
    const press = t ? '點' : '空白', hold = t ? '按住' : '按住';
    if (ph === 'explore') ui.setHint(t ? '按住' : '空白', '甩竿', false, !this.fisher.deck);
    else if (ph === 'charge') ui.setHint('放開', '甩竿', true);
    else if (ph === 'cast' || ph === 'wait' || ph === 'stow') ui.setHint(press, '提竿', false, true);
    else if (ph === 'bite') ui.setHint(press, '提竿', true);
    else if (ph === 'fight') {
      if (this.fishing.warn) ui.setHint('張力太高', '放開', true, false, true);
      else ui.setHint(hold, '收線', !this.input.actionHeld);
    }
    else if (ph === 'catch') ui.setHint(press, '繼續', false);
    else if (ph === 'full') ui.setHint(press, '再釣一簍', false);
    else ui.setHint(press, '甩竿', false, true);
    ui.setStowDim(['explore', 'stow', 'catch', 'full'].includes(ph));
  }
  // 螢幕投影：蓄力環跟著漁夫頭上、「！」跟著浮標
  overlays() {
    const fs = this.fishing, cam = this.camera, w = innerWidth, h = innerHeight;
    const proj = (v) => { v.project(cam); return [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h]; };
    if (fs.phase === 'charge') { const [x, y] = proj(this.fisher.pos.clone().add(new THREE.Vector3(0, 2.6, 0))); this.ui.place(this.ui.el.ring, x, y); }
    if (fs.phase === 'bite') { const [x, y] = proj(new THREE.Vector3(fs.bob.x, 0.75, fs.bob.z)); this.ui.place(this.ui.el.bang, x, y); }
  }
  frame() {
    const now = performance.now(); const raw = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    // 暫停、或釣魚中打開魚簍面板時，世界停住（畫面照畫）
    const frozen = this.paused || (this.ui.isOpen('creelPanel') && this.fishing.phase !== 'explore');
    const dt = frozen ? 0 : raw * this.ts;
    if (dt > 0) this.step(dt);
    this.audio.tick();
    this.syncModal();
    this.updateCamera(raw);
    this.overlays();
    this.renderer.render(this.scene, this.camera);
  }
}

async function boot() {
  if (typeof DecompressionStream === 'undefined') {
    $('loading').textContent = '這個瀏覽器不支援解壓縮模型（需要 DecompressionStream）';
    return;
  }
  await loadAll();
  const game = new Game();
  $('loading').classList.add('hidden');
  game.ui.show('intro', true);
  const loop = () => { game.frame(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  const fs = game.fishing;
  window.__cc = {
    game, ready: true, report: () => ({ loaded: report.loaded, missing: report.missing, placeholders: [...report.placeholders] }),
    start: () => game.start(),
    state: () => ({
      phase: fs.phase, creel: fs.creel.length, creelMax: fs.creelMax, bait: fs.bait,
      pos: { x: +game.fisher.pos.x.toFixed(3), z: +game.fisher.pos.z.toFixed(3) }, yaw: +game.fisher.yaw.toFixed(3),
      deck: game.fisher.deck, tension: +fs.tension.toFixed(3), dist: +fs.dist.toFixed(3), power: +fs.power.toFixed(3),
      bob: { x: +fs.bob.x.toFixed(2), y: +fs.bob.y.toFixed(2), z: +fs.bob.z.toFixed(2) },
      anim: game.fisher.curName,
      fish: game.fishes.list.filter((f) => f.state !== 'gone').map((f) => ({ id: f.id, state: f.state, x: +f.pos.x.toFixed(2), y: +f.pos.y.toFixed(2), z: +f.pos.z.toFixed(2) })),
    }),
    place: (x, z, yaw) => { fs.posed = false; fs.yawBack = null; game.fisher.place(x, z, yaw); game.updateCamera(1, true); },
    cast: (power = 0.6) => { if (fs.phase !== 'explore') return false; if (!game.fisher.deck) return false; fs.phase = 'charge'; fs.release(power); return true; },
    bite: () => fs.forceBite(),
    hook: () => { if (fs.phase !== 'bite') return false; fs.hookFish(); return true; },
    land: (species) => fs.forceLand(species),
    setCreel: (n) => {
      fs.creel = Array.from({ length: Math.max(0, Math.min(fs.creelMax, n)) }, (_, i) => { const id = CATCHABLE[i % CATCHABLE.length]; return { id, len: sampleLen(id, i) }; });
      game.ui.setCreel(fs.creel, fs.creelMax);
    },
    stow: () => fs.stow(),
    timeScale: (s) => { game.ts = s; },
    info: () => ({ calls: game.renderer.info.render.calls, triangles: game.renderer.info.render.triangles, geometries: game.renderer.info.memory.geometries, programs: game.renderer.info.programs?.length }),
    hud: (on) => { game.hudOn = !!on; game.ui.show('hud', on && game.started); document.body.classList.toggle('nohud', !on); },
    cam: (mode) => { game.camMode = mode; game.updateCamera(1, true); },
    pose: (action, t = 0) => { if (!action) { fs.posed = false; game.fisher.resume(); return; } fs.posed = true; game.fisher.play(action, 0); game.fisher.hold(action, t, 0); game.fisher.mixer.update(0); game.fisher.sync(); },
  };
}
boot();
