// 釣魚狀態機：explore → charge → cast → wait → bite → fight → catch（→ full），E 隨時收竿（stow）。
// 浮標、麵包、魚鉤、釣線（竿尖到浮標的下垂曲線＋水下一小段）。
import * as THREE from 'three';
import { getStatic, shadowify } from './assets.js';
import { Ribbon } from './ribbon.js';
import { isWater, pierFoot, boatFoot, floorY, REEFS, DECOR, PIER } from './terrain.js';
import { FISH_INFO, CATCHABLE, lenOf } from './fish.js';

const NL = 30;
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
const ease = (u) => u * u * (3 - 2 * u);
// 浮標放大到俯視 17 m 也看得清楚（模型總高 0.14 m → 約 0.45 m）；鉤子跟著放大，麵包丁縮得比鉤子短，
// 鉤眼（模型原點）在 tackle 原點＝水下釣線的終點，麵包串在鉤柄中段，鉤彎與鉤尖從麵包下方露出來
const BOB_S = 3.2, HOOK_S = 3.0, BREAD_S = 1.45;
let tipShown = false;   // 第一次拔河的「先放開」提示只出現一次
// 落點要讓魚游得到：魚在海床高於 −0.8 m 的地方會被「前方太淺」轉開（fish.js avoid() 往前看 1.4 m），
// 繞餌半徑最大 0.9 m，所以落點本身要夠深，周圍 1 m 與 2 m 的一圈也都要比 −0.8 m 深
const BAIT_MIN = 0.95, RING_MIN = 0.82;
function reachable(x, z) {
  if (floorY(x, z) > -BAIT_MIN) return false;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    if (floorY(x + c * 1.0, z + s * 1.0) > -RING_MIN || floorY(x + c * 2.0, z + s * 2.0) > -RING_MIN) return false;
  }
  return true;
}
const randIn = ([a, b]) => a + Math.floor(Math.random() * (b - a + 1));
// 圖鑑：各魚種釣過幾條、最大幾公分，存在 localStorage（不能用時就只在這一場有效）
const LOG_KEY = 'coral-cove.log.v1';
function loadLog() {
  const log = {};
  for (const id of CATCHABLE) log[id] = { n: 0, max: 0 };
  try {
    const raw = JSON.parse(localStorage.getItem(LOG_KEY) || 'null');
    if (raw && typeof raw === 'object') for (const id of CATCHABLE) if (raw[id]) log[id] = { n: Math.max(0, raw[id].n | 0), max: Math.max(0, raw[id].max | 0) };
  } catch { /* 無痕模式或被封鎖：不存 */ }
  return log;
}

export class Fishing {
  constructor(g) {
    this.g = g;
    this.phase = 'explore';
    this.creel = []; this.creelMax = 8; this.bait = 'bread';
    this.power = 0; this.chargeT = 0;
    this.tension = 0; this.dist = 0;
    this.bob = new THREE.Vector3(0, 0, -14);
    this.bobber = getStatic('props', 'bobber'); this.bobber.scale.setScalar(BOB_S); shadowify(this.bobber, true, false);
    this.tackle = new THREE.Group();
    // 麵包丁 bbox y −0.02..0.03、鉤子 bbox y −0.04..0（鉤彎朝 +x）：鉤長 12 cm，麵包串在 y −1.3..−8.5 cm，鉤彎露出約 3.5 cm
    this.bread = getStatic('props', 'bread'); this.bread.scale.setScalar(BREAD_S); shadowify(this.bread, true, false);
    this.bread.position.set(-0.012, -0.056, 0.004); this.bread.rotation.set(0.25, 0.6, -0.18);
    this.hook = getStatic('props', 'hook'); this.hook.scale.setScalar(HOOK_S); shadowify(this.hook, false, false);
    this.tackle.add(this.bread, this.hook);
    g.scene.add(this.bobber, this.tackle);
    this.bobber.visible = this.tackle.visible = false;
    this.line = new Ribbon(NL, '#4b453e', 0.92);
    this.under = new Ribbon(6, '#4b453e', 0.45);
    g.scene.add(this.line.mesh, this.under.mesh);
    this.pts = Array.from({ length: NL }, () => new THREE.Vector3());
    this.upts = Array.from({ length: 6 }, () => new THREE.Vector3());
    this.fish = null; this.nibbler = null;
    this.clickT = 0; this.ripT = 0;
    this.locked = false;   // 卡片／選單開著時不收輸入
    this.posed = false;
    this.log = loadLog();
    this.toss = null; this.creelWob = 0;
  }
  saveLog() { try { localStorage.setItem(LOG_KEY, JSON.stringify(this.log)); } catch { /* 存不了就算了 */ } }
  get fisher() { return this.g.fisher; }

  // ── 輸入 ──
  actionDown() {
    const g = this.g;
    if (this.phase === 'full') { this.confirmFull(); return; }
    if (this.locked) return;
    switch (this.phase) {
      case 'explore':
        if (!this.fisher.deck) { g.ui.toast('到棧橋上才能甩竿'); return; }
        this.phase = 'charge'; this.chargeT = 0; this.power = 0; this.posed = false;
        g.ui.show('ring', true);
        break;
      case 'wait': g.ui.toast('等浮標沉下去再提竿', 1.6); break;
      case 'bite': this.hookFish(); break;
      case 'catch': if (this.catchT > 0.4) this.endCatch(); break;
      default: break;
    }
  }
  // 結算卡開著時空白／Enter／Esc／大圓鈕都等於「放回大海」；剛跳出來的 0.4 秒不收，避免關魚卡那一下連按
  confirmFull() {
    if (this.phase === 'full' && this.fullOpenT > 0.4) this.releaseAll();
  }
  actionUp() {
    if (this.phase === 'charge') this.release(this.power);
  }

  // ── 甩竿 ──
  // 只在面向的 ±1 rad 內找落點，而且在棧橋上不往岸的方向（+Z 兩側約 70° 內）甩、釣線不能壓過 3.2 m 以上的橋面：
  // 背對水面（例如朝岸）時找不到落點就提示，不會把線甩過身後的棧橋
  findTarget(power) {
    const f = this.fisher, d0 = 3 + 9 * power;
    // 有水但太淺（魚到不了）記下來，找不到落點時提示往深處甩
    this.tooShallow = false;
    const ok = (x, z) => {
      if (!isWater(x, z, 0.3) || pierFoot(x, z, 0.4) || boatFoot(x, z, 0.5)) return false;
      if (!reachable(x, z)) { this.tooShallow = true; return false; }
      return true;
    };
    // 從腳下到第一次離開橋面的長度最多 5.6 m（平台深 5.05 m，站在平台後半或走道末端也甩得出去）；
    // 離開橋面之後又越過橋面或繫著的船，超過 1 m 就不甩，免得線橫跨棧橋或船
    const overDeck = (sx, sz, d) => {
      let own = 0, again = 0, out = false;
      for (let s = 0; s < d; s += 0.25) {
        const x = f.pos.x + sx * s, z = f.pos.z + sz * s;
        if (pierFoot(x, z)) { if (out) again++; else own++; } else out = true;
        if (out && boatFoot(x, z)) again++;
      }
      return own * 0.25 > 5.6 ? Infinity : again * 0.25;
    };
    for (const da of [0, 0.15, -0.15, 0.3, -0.3, 0.5, -0.5, 0.75, -0.75, 1.0, -1.0]) {
      const a = f.yaw + da, sx = Math.sin(a), sz = Math.cos(a);
      if (f.deck && sz > 0.35) continue;
      // 先往近處找；輕甩時落點還在平台上，就往遠處推到平台外第一片水面
      const tries = [];
      for (let d = d0; d >= 2.6; d -= 0.4) tries.push(d);
      for (let d = d0 + 0.4; d <= 8; d += 0.4) tries.push(d);
      for (const d of tries) {
        if (f.deck && overDeck(sx, sz, d) > 1.0) continue;
        const x = f.pos.x + sx * d, z = f.pos.z + sz * d;
        if (ok(x, z)) return new THREE.Vector3(x, 0, z);
      }
    }
    return null;
  }
  release(power) {
    const g = this.g, f = this.fisher;
    g.ui.show('ring', false);
    g.ui.clearToast();
    const target = this.findTarget(power);
    if (!target) { g.ui.toast(this.tooShallow ? '這裡水太淺，魚游不過來，往深一點的地方甩' : '這裡甩不了竿，面向海試試', 3); this.phase = 'explore'; f.play('idle', 0.2); return; }
    f.yaw = Math.atan2(target.x - f.pos.x, target.z - f.pos.z);
    const from = f.curName === 'cast' && f.cur ? f.cur.time : 0;
    f.play('cast', 0.08, () => { if (this.phase === 'wait' || this.phase === 'cast') f.play('wait', 0.25); }, from);
    this.phase = 'cast'; this.castT = 0; this.launchAt = Math.max(0.05, 0.55 - from); this.launched = false;
    this.target = target; this.power = power;
    g.audio.whoosh();
  }
  launch() {
    const f = this.fisher;
    this.launched = true;
    this.flyFrom = f.tipWorld(new THREE.Vector3());
    const d = Math.hypot(this.target.x - f.pos.x, this.target.z - f.pos.z);
    this.flyDur = 0.45 + d * 0.045; this.flyU = 0; this.flyH = 1.0 + d * 0.16;
    this.bobber.visible = true; this.tackle.visible = true;
    this.line.mesh.visible = true;
  }
  land() {
    const g = this.g;
    this.bob.copy(this.target);
    this.phase = 'wait'; this.waitT = 0; this.attractT = 0; this.nibbler = null; this.dip = 0;
    g.water.ripple(this.bob.x, this.bob.z, 1.0);
    g.audio.splash(1);
    this.under.mesh.visible = true;
    this.drift = new THREE.Vector3((Math.random() - 0.5) * 0.2, 0, (Math.random() - 0.5) * 0.2);
  }

  // ── 等待與咬鉤 ──
  // 各魚種的行為參數見 fish.js 的 FISH_INFO（輕咬次數、間隔、咬鉤窗、繞圈半徑、觀察、退開、對麵包的興趣）
  engage(f) {
    const info = FISH_INFO[f.id];
    this.nibbler = f; f.state = 'interest';
    this.nibbles = 0; this.need = randIn(info.nibble || [1, 3]);
    this.circleA = Math.atan2(f.pos.z - this.bob.z, f.pos.x - this.bob.x);
    this.nibbleT = (1.0 + Math.random() * 1.2) * (info.gap || 1);
    this.hoverT = info.hover || 0; this.backT = 0;
  }
  nearReef() { return REEFS.some((r) => Math.hypot(this.bob.x - r.x, this.bob.z - r.z) < r.r * 1.5); }
  interest(f) {
    const info = FISH_INFO[f.id];
    let k = info.bread ?? 1;
    if (info.reef) k *= this.nearReef() ? 2 : 0.35;
    return Math.min(1, k);
  }
  // 從 maxD 內挑一條：越近、對麵包越有興趣的越容易被選上
  pickFish(maxD) {
    let best = null, bw = 0;
    for (const f of this.g.fishes.list) {
      if (f.state !== 'roam' || !CATCHABLE.includes(f.id)) continue;
      const d = Math.hypot(f.pos.x - this.bob.x, f.pos.z - this.bob.z);
      if (d > maxD) continue;
      const w = this.interest(f) / (1 + d) * (0.6 + Math.random() * 0.8);
      if (w > bw) { bw = w; best = f; }
    }
    return best;
  }
  baitPos(out = new THREE.Vector3()) {
    const fy = floorY(this.bob.x, this.bob.z);
    return out.set(this.bob.x + this.drift.x, Math.max(-0.5, fy + 0.25), this.bob.z + this.drift.z);
  }
  startBite() {
    const g = this.g;
    this.phase = 'bite'; this.biteT = 0;
    this.biteWin = this.nibbler ? FISH_INFO[this.nibbler.id].biteWin || 0.9 : 0.9;
    g.ui.show('bang', true);
    g.water.ripple(this.bob.x, this.bob.z, 1.4);
    g.water.ripple(this.bob.x, this.bob.z, 0.9);
    g.audio.bite();
  }
  missBite() {
    const g = this.g;
    g.ui.show('bang', false);
    if (this.nibbler) g.fishes.flee(this.nibbler, this.bob);
    this.nibbler = null;
    g.ui.toast('麵包被吃掉了，再甩一次', 3);
    this.retrieve(false);
  }
  hookFish() {
    const g = this.g, f = this.nibbler;
    g.ui.show('bang', false);
    if (!f) { this.retrieve(false); return; }
    this.fish = f; this.nibbler = null;
    f.state = 'hooked'; g.fishes.setFlop(f, true);
    this.phase = 'fight';
    const fi = this.fisher;
    fi.play('hook', 0.06, () => { if (this.phase === 'fight') fi.play('reel', 0.12); });
    g.audio.hookSnd();
    g.water.ripple(this.bob.x, this.bob.z, 1.3);
    this.dist = Math.min(13, Math.hypot(this.bob.x - fi.pos.x, this.bob.z - fi.pos.z));
    this.dir = new THREE.Vector3(this.bob.x - fi.pos.x, 0, this.bob.z - fi.pos.z).normalize();
    this.tension = 0.3; this.stamina = 1; this.pulling = true; this.warn = false; this.side = Math.random() < 0.5 ? -1 : 1; this.pullT = 0.9; this.fullT = 0; this.slackT = 0; this.fightT = 0;
    this.tackle.visible = false; this.under.mesh.visible = false;
    g.ui.show('tension', true);
  }

  // ── 收線拔河 ──
  snap() {
    const g = this.g;
    g.audio.snap();
    g.ui.toast('線斷了！魚帶著浮標跑掉了', 3);
    this.releaseFish();
    this.bobber.visible = false; this.line.mesh.visible = false;
    this.retrieve(true);
  }
  unhook() {
    const g = this.g;
    g.audio.slip();
    g.ui.toast('線太鬆，魚脫鉤了', 3);
    this.releaseFish();
    this.retrieve(false);
  }
  releaseFish() {
    const g = this.g;
    if (this.fish) { g.fishes.setFlop(this.fish, false); g.fishes.flee(this.fish, this.fisher.pos); this.fish = null; }
    if (this.nibbler) { g.fishes.flee(this.nibbler, this.bob); this.nibbler = null; }
    g.ui.show('tension', false); g.ui.show('bang', false);
  }

  // ── 釣起 ──
  landFish(f) {
    const g = this.g;
    g.ui.show('tension', false); g.ui.show('bang', false); g.ui.show('ring', false);
    g.ui.clearToast();
    this.phase = 'catch'; this.catchT = 0; this.fish = f;
    this.preYaw = this.fisher.yaw; this.yawBack = null;   // 舉魚時轉向鏡頭，結束後轉回原本面向的方向
    f.state = 'held'; f.obj.visible = true; g.fishes.setFlop(f, true);
    f.obj.scale.setScalar(f.scale);   // 手上的魚和水裡同樣大小
    this.bobber.visible = false; this.tackle.visible = false; this.under.mesh.visible = false;
    this.fisher.play('cheer', 0.25);
    const info = FISH_INFO[f.id];
    const len = lenOf(f);
    const isBest = this.creel.length > 0 && this.creel.every((c) => c.len < len);
    this.creel.push({ id: f.id, len });
    // 圖鑑：第一次釣到這種魚、或打破這種魚的最大紀錄
    const rec = this.log[f.id], first = rec.n === 0, record = !first && len > rec.max;
    rec.n++; rec.max = Math.max(rec.max, len); this.saveLog();
    this.puffT = 0;
    g.ui.setCreel(this.creel, this.creelMax, true);
    g.ui.showCatch(f.id, len, info.notes[Math.floor(Math.random() * info.notes.length)], isBest, first ? 'new' : record ? 'record' : '');
    g.audio.jingle();
    g.water.ripple(this.fisher.pos.x + this.dir.x * 1.0, this.fisher.pos.z + this.dir.z * 1.0, 0.8);
  }
  endCatch() {
    const g = this.g;
    g.ui.show('card', false);
    this.finishToss();
    if (this.fish) { this.startToss(this.fish); this.fish = null; }
    this.line.mesh.visible = false;
    if (this.preYaw != null) { this.yawBack = this.preYaw; this.preYaw = null; }
    if (this.creel.length >= this.creelMax) {
      // 魚簍滿了：等魚落進魚簍再跳結算卡；卡片出現後 0.4 秒內不收「放回」，避免連按
      this.phase = 'full'; this.locked = true; this.fisher.play('idle', 0.3);
      this.fullPending = true; this.fullOpenT = -99;
      if (!this.toss) this.openFull();
      return;
    }
    this.phase = 'explore'; this.fisher.play('idle', 0.3);
  }
  openFull() {
    const g = this.g;
    this.fullPending = false; this.fullOpenT = 0;
    g.ui.showFull(this.creel);
    g.audio.fanfare();
  }
  // 魚從手上以拋物線飛進平台上的魚簍道具，落入時有聲音、魚簍輕晃，然後才從場景移除
  creelMouth(out) {
    const c = this.g.world && this.g.world.creel;
    if (c) { c.updateMatrixWorld(true); return c.localToWorld(out.set(0, 0.42, 0)); }
    return out.set(DECOR.creel.x, PIER.y + 0.42, DECOR.creel.z);
  }
  startToss(f) {
    const from = f.pos.clone(), to = this.creelMouth(new THREE.Vector3());
    const d = from.distanceTo(to);
    f.state = 'held';
    this.toss = { f, from, to, u: 0, dur: THREE.MathUtils.clamp(0.5 + d * 0.06, 0.6, 1.3), h: 0.7 + Math.min(2.2, d * 0.18), s: f.obj.scale.clone(), yaw: Math.atan2(to.x - from.x, to.z - from.z) };
    this.g.audio.whoosh();
  }
  finishToss() {
    const k = this.toss; if (!k) return;
    this.toss = null;
    this.g.fishes.setFlop(k.f, false);
    this.g.fishes.remove(k.f);
    this.creelWob = 1;
    this.g.audio.creel();
    this.g.ui.bumpCreel();
    if (this.fullPending) this.openFull();
  }
  updateToss(dt, t) {
    const k = this.toss;
    if (k) {
      k.u = Math.min(1, k.u + dt / k.dur);
      const u = k.u, f = k.f;
      f.pos.lerpVectors(k.from, k.to, u); f.pos.y += k.h * 4 * u * (1 - u);
      f.obj.position.copy(f.pos);
      // 頭朝上（手上的姿勢）→ 頂點時橫躺 → 頭朝下鑽進簍口，順便翻一圈
      f.obj.rotation.set(-Math.PI / 2 + Math.PI * u, k.yaw, u * Math.PI * 2 * 0.5, 'YXZ');
      const sh = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3 * 0.65;   // 最後一段縮小鑽進簍口
      f.obj.scale.copy(k.s).multiplyScalar(sh);
      if (u >= 1) this.finishToss();
    }
    // 魚簍輕晃（衰減的左右擺）
    const c = this.g.world && this.g.world.creel;
    if (c) {
      if (this.creelBase == null) this.creelBase = { x: c.rotation.x, z: c.rotation.z };
      if (this.creelWob > 0) {
        this.creelWob = Math.max(0, this.creelWob - dt * 1.4);
        const w = this.creelWob * this.creelWob;
        c.rotation.z = this.creelBase.z + Math.sin(t * 17) * 0.13 * w;
        c.rotation.x = this.creelBase.x + Math.sin(t * 13 + 1) * 0.07 * w;
      }
    }
  }
  releaseAll() {
    const g = this.g;
    if (this.phase !== 'full' || this.fullPending) return;   // Enter 在按鈕上會同時觸發 keydown 與 click，只處理一次
    this.creel = [];
    g.ui.setCreel(this.creel, this.creelMax, true);
    g.ui.show('full', false);
    this.locked = false;
    this.phase = 'explore';
    g.audio.release();
    const fw = this.fisher.forward(tmp);
    for (let i = 0; i < 4; i++) g.water.ripple(this.fisher.pos.x + fw.x * (1.6 + i * 0.5), this.fisher.pos.z + fw.z * (1.6 + i * 0.5), 0.5 + i * 0.25);
    g.ui.toast('魚都游回大海了，再釣一簍吧');
  }

  // ── 收竿 ──
  stow() {
    if (['explore', 'stow', 'catch', 'full'].includes(this.phase)) return;
    if (this.phase === 'charge') { this.g.ui.show('ring', false); this.phase = 'explore'; this.fisher.play('idle', 0.2); return; }
    this.releaseFish();
    this.retrieve(false);
  }
  retrieve(lost) {
    const f = this.fisher;
    this.phase = 'stow'; this.stowT = 0; this.stowFrom = this.bob.clone();
    if (!this.launched) this.stowFrom = f.tipWorld(new THREE.Vector3());
    this.bobLost = lost;
    this.tackle.visible = false; this.under.mesh.visible = false;
    if (!lost && this.launched) this.g.audio.reelIn(0.55);
    f.play('stow', 0.15, () => { if (this.phase === 'stow') this.finishStow(); });
  }
  finishStow() {
    this.phase = 'explore';
    this.bobber.visible = false; this.line.mesh.visible = false;
    this.fisher.play('idle', 0.25);
  }

  // ── 測試 API 用 ──
  forceBite() {
    if (this.phase !== 'wait') return false;
    const g = this.g;
    const f = this.nibbler || g.fishes.nearest(this.bob, Infinity, (x) => CATCHABLE.includes(x.id));
    if (!f) return false;
    if (!this.nibbler) this.engage(f);
    this.baitPos(tmp); f.pos.set(tmp.x + 0.4, tmp.y, tmp.z + 0.4);
    this.startBite();
    return true;
  }
  forceLand(species) {
    const g = this.g;
    if (this.phase === 'catch') this.endCatch();
    if (this.phase === 'full') return false;
    const id = CATCHABLE.includes(species) ? species : null;
    let f = this.fish || this.nibbler;
    if (!f || (id && f.id !== id)) {
      if (this.fish) { g.fishes.setFlop(this.fish, false); this.fish.state = 'roam'; }
      if (this.nibbler) this.nibbler.state = 'roam';
      f = g.fishes.nearest(this.fisher.pos, Infinity, (x) => (id ? x.id === id : CATCHABLE.includes(x.id)));
    }
    if (!f) return false;
    this.nibbler = null;
    this.dir = this.dir || new THREE.Vector3(0, 0, -1);
    this.landFish(f);
    return true;
  }

  // ── 每幀 ──
  update(dt, t) {
    const g = this.g, fi = this.fisher;
    // 舉魚後慢慢轉回原本的方向；玩家自己走動或蓄力轉向就不再管
    if (this.yawBack != null) {
      if (!['explore', 'charge', 'full'].includes(this.phase) || fi.speed > 0.1) this.yawBack = null;
      else {
        let d = this.yawBack - fi.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
        fi.yaw += d * Math.min(1, dt * 6);
        if (Math.abs(d) < 0.01) { fi.yaw = this.yawBack; this.yawBack = null; }
      }
    }
    this.updateToss(dt, t);
    switch (this.phase) {
      case 'charge': {
        this.chargeT += dt;
        const u = (this.chargeT / 1.1) % 2;
        this.power = u < 1 ? u : 2 - u;
        if (!this.posed) fi.hold('cast', Math.min(0.42, this.chargeT * 0.9));
        g.ui.drawRing(this.power);
        break;
      }
      case 'cast': {
        this.castT += dt;
        if (!this.launched && this.castT >= this.launchAt) this.launch();
        if (this.launched) {
          this.flyU = Math.min(1, this.flyU + dt / this.flyDur);
          const u = this.flyU;
          this.bob.lerpVectors(this.flyFrom, this.target, u);
          this.bob.y = this.flyFrom.y * (1 - u) + this.flyH * 4 * u * (1 - u) * 0.6;
          if (u >= 1) this.land();
        }
        break;
      }
      case 'wait': {
        this.waitT += dt; this.attractT += dt;
        if (!this.nibbler && this.attractT > 0.6) {
          this.attractT = 0;
          let f = this.pickFish(6);
          if (f && Math.random() < 0.55 * this.interest(f)) this.engage(f);
          else if (this.waitT > 5) { f = this.pickFish(22); if (f && (this.waitT > 14 || Math.random() < 0.4 + 0.6 * this.interest(f))) this.engage(f); }
        }
        const f = this.nibbler;
        if (f) {
          const info = FISH_INFO[f.id];
          const bp = this.baitPos(tmp);
          const d = Math.hypot(f.pos.x - bp.x, f.pos.z - bp.z);
          const ring = info.ring || 0.6;
          if (this.hoverT > 0 && d < 2.6) {
            // 謹慎的魚：先停在 2 m 外看一陣子才靠近
            this.hoverT -= dt;
            const k = 2.0 / Math.max(d, 0.01);
            f.target.set(bp.x + (f.pos.x - bp.x) * k, bp.y, bp.z + (f.pos.z - bp.z) * k);
          } else if (d < Math.max(1.4, ring + 0.6)) {
            this.circleA += dt * (info.spin || 0.9);
            this.nibbleT -= dt; this.backT -= dt;
            if (this.nibbleT < 0.25) f.target.set(bp.x, bp.y, bp.z);
            if (this.nibbleT <= 0) {
              this.nibbles++; this.dip = 1;
              g.water.ripple(this.bob.x, this.bob.z, 0.6);
              g.audio.plip();
              if (this.nibbles >= this.need) { this.startBite(); break; }
              this.nibbleT = (0.9 + Math.random() * 1.3) * (info.gap || 1);
              if (info.shy) this.backT = 0.8;   // 很會躲的魚：咬一口就退開
            }
            const r = this.backT > 0 ? 1.25 : ring;
            if (this.nibbleT >= 0.25) f.target.set(bp.x + Math.cos(this.circleA) * r, bp.y, bp.z + Math.sin(this.circleA) * r);
          } else f.target.set(bp.x, bp.y, bp.z);
          if (this.waitT > 40) { g.fishes.flee(f, this.bob); this.nibbler = null; this.waitT = 0; }
        }
        this.dip = Math.max(0, this.dip - dt * 3);
        this.bob.y = Math.sin(t * 2.1) * 0.012 - this.dip * 0.12 * Math.sin(this.dip * Math.PI);
        break;
      }
      case 'bite': {
        this.biteT += dt;
        const f = this.nibbler;
        const bp = this.baitPos(tmp);
        if (f) { f.target.set(bp.x + Math.sin(t * 9) * 0.15, bp.y - 0.1, bp.z + Math.cos(t * 7) * 0.15); }
        this.bob.y = -0.36 + Math.sin(t * 23) * 0.025;
        this.ripT -= dt; if (this.ripT <= 0) { this.ripT = 0.28; g.water.ripple(this.bob.x, this.bob.z, 0.6); }
        if (this.biteT > this.biteWin) this.missBite();
        break;
      }
      case 'fight': this.fight(dt, t); break;
      case 'catch': {
        this.catchT += dt;
        // 轉身面向鏡頭炫耀
        { let d = 0.3 - fi.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); fi.yaw += d * Math.min(1, dt * 5); }
        const f = this.fish;
        if (f) {
          fi.handLWorld(tmp);
          const L = (f.info ? f.info.body : 0.3) * f.scale;   // 魚原點在身體中心，從嘴（手）往下垂半條魚
          f.pos.set(tmp.x, tmp.y - L * 0.45, tmp.z);
          f.obj.position.copy(f.pos);
          // 側面（魚身的 ±X）朝向鏡頭，尾鰭的面積才看得到；輕輕左右晃
          const cam = g.camera.position, yaw = Math.atan2(-(cam.z - f.pos.z), cam.x - f.pos.x);
          f.obj.rotation.set(-Math.PI / 2 + Math.sin(t * 9) * 0.06, yaw + Math.sin(t * 1.7) * 0.16, 0, 'YXZ');
          if (f.flop) f.flop.timeScale = 0.55;
          // 河豚被釣起來會鼓成一顆球
          if (f.info && f.info.puff) {
            this.puffT = Math.min(1, (this.puffT || 0) + dt * 1.6);
            const p = ease(this.puffT), s = f.scale;
            f.obj.scale.set(s * (1 + 0.38 * p), s * (1 + 0.42 * p), s * (1 + 0.08 * p));
          }
        }
        if (this.catchT > 4.2) this.endCatch();
        break;
      }
      case 'full': if (!this.fullPending) this.fullOpenT += dt; break;
      case 'stow': {
        this.stowT += dt;
        const u = Math.min(1, this.stowT / 0.55);
        fi.tipWorld(tmp2);
        this.bob.lerpVectors(this.stowFrom, tmp2, ease(u));
        if (u >= 1) { this.bobber.visible = false; this.line.mesh.visible = false; }
        if (this.stowT > 1.4) this.finishStow();
        break;
      }
      default: break;
    }
    this.draw(dt, t);
  }

  fight(dt, t) {
    const g = this.g, fi = this.fisher, f = this.fish;
    if (!f) { this.retrieve(false); return; }
    const held = g.input.actionHeld && !this.locked;
    this.fightT += dt;
    this.pullT -= dt;
    if (this.pullT <= 0) { this.pulling = !this.pulling; this.pullT = this.pulling ? (0.6 + Math.random() * 0.9) * (0.5 + 0.5 * this.stamina) : 0.7 + Math.random() * 0.9; this.side = Math.random() < 0.5 ? -1 : 1; }
    const str = f.info.power * (0.45 + 0.55 * this.stamina);
    // 張力：魚拉時按住會上升（大魚上升得快很多，str²），放開就放線、張力下降；
    // 一直按住的話小魚多半拉得上來，大魚（紅笛鯛、鸚哥魚）會在幾次拉扯後斷線。
    let rate;
    if (held) { rate = this.pulling ? 0.08 + 0.8 * str * str : -0.12; this.dist -= (this.pulling ? 0.45 : 1.6) * dt; }
    else { rate = this.pulling ? -0.1 : -0.45; if (this.pulling) this.dist += 0.8 * str * dt; }
    this.tension = THREE.MathUtils.clamp(this.tension + rate * dt, 0, 1);
    this.stamina = Math.max(0, this.stamina - dt * (held ? 0.07 : 0.03) * (this.pulling ? 1.5 : 1));
    this.dist = Math.min(this.dist, 14);
    // 張力滿的時間會累積（放開時很快消退），累積 1.2 秒斷線
    this.fullT = this.tension >= 0.995 ? this.fullT + dt : Math.max(0, this.fullT - dt * (held ? 0.2 : 1.5));
    this.slackT = this.tension <= 0.02 ? this.slackT + dt : 0;
    this.warn = held && this.tension > 0.85;
    if (!tipShown && held && this.tension > 0.7 && this.pulling) { tipShown = true; g.ui.toast('魚在拉！先放開，等牠累了再收', 3.2); }
    if (this.fullT > 1.2) { this.snap(); return; }
    if (this.slackT > 2.5) { this.unhook(); return; }
    if (this.dist < 1.2) { this.landFish(f); return; }
    // 魚在水面掙扎、被拉向漁夫
    const perp = tmp2.set(-this.dir.z, 0, this.dir.x);
    const lat = (Math.sin(t * 1.6) * 0.5 + (this.pulling ? this.side * 0.6 : 0)) * Math.min(1, this.dist / 3);
    const fx = fi.pos.x + this.dir.x * this.dist + perp.x * lat, fz = fi.pos.z + this.dir.z * this.dist + perp.z * lat;
    f.pos.x += (fx - f.pos.x) * Math.min(1, dt * 6); f.pos.z += (fz - f.pos.z) * Math.min(1, dt * 6);
    f.pos.y = -0.1 + Math.sin(t * 11) * 0.03;
    f.yaw = Math.atan2(this.dir.x, this.dir.z) + (this.pulling ? 0 : Math.PI) + Math.sin(t * 7) * 0.5;
    f.pitch = Math.sin(t * 13) * 0.2;
    f.obj.position.copy(f.pos);
    f.obj.rotation.set(f.pitch, f.yaw, Math.sin(t * 10) * 0.3, 'YXZ');
    if (f.flop) f.flop.timeScale = this.pulling ? 1.3 : 0.8;
    this.bob.set(f.pos.x - this.dir.x * 0.25, 0.0, f.pos.z - this.dir.z * 0.25);
    this.ripT -= dt; if (this.ripT <= 0) { this.ripT = this.pulling ? 0.22 : 0.4; g.water.ripple(f.pos.x, f.pos.z, this.pulling ? 0.9 : 0.55); }
    if (held) { this.clickT -= dt; if (this.clickT <= 0) { this.clickT = 0.075; g.audio.click(1 + this.tension * 0.3); } }
    if (fi.cur && fi.curName === 'reel') fi.cur.timeScale = held ? 1.2 : 0.15;
    g.ui.drawTension(this.tension);
  }

  // 浮標、餌、釣線
  draw(dt, t) {
    const g = this.g, fi = this.fisher;
    const out = ['cast', 'wait', 'bite', 'fight', 'stow'].includes(this.phase) && (this.phase !== 'cast' || this.launched);
    const catchLine = this.phase === 'catch' && this.fish;
    if (!out && !catchLine) { this.line.mesh.visible = false; this.bobber.visible = false; this.tackle.visible = false; this.under.mesh.visible = false; return; }
    const tip = fi.tipWorld(tmp);
    let end;
    if (catchLine) { end = tmp2.copy(this.fish.obj.position); end.y += (this.fish.info ? this.fish.info.body : 0.3) * this.fish.scale * 0.45; this.line.mesh.visible = true; }
    else {
      if (this.bobLost && this.phase === 'stow') { this.line.mesh.visible = false; return; }
      this.bobber.position.copy(this.bob);
      this.bobber.rotation.set(Math.sin(t * 1.7) * 0.12 + (this.phase === 'bite' ? Math.sin(t * 20) * 0.3 : 0), 0, Math.cos(t * 1.3) * 0.12);
      end = tmp2.copy(this.bob); end.y += 0.09 * BOB_S;   // 浮標天線頂
      this.line.mesh.visible = this.bobber.visible;
    }
    if (!this.line.mesh.visible) return;
    const len = tip.distanceTo(end);
    let sag = 0;
    if (this.phase === 'wait' || this.phase === 'bite') sag = 0.1 * len;
    else if (this.phase === 'cast') sag = 0.03 * len;
    else if (this.phase === 'fight') sag = (1 - this.tension) * 0.05 * len;
    else if (this.phase === 'stow') sag = 0.04 * len;
    for (let i = 0; i < NL; i++) {
      const u = i / (NL - 1);
      const p = this.pts[i].lerpVectors(tip, end, u);
      p.y -= sag * 4 * u * (1 - u);
      if (u < 0.97 && !catchLine) p.y = Math.max(p.y, 0.012);
    }
    const H = g.renderer.domElement.clientHeight || innerHeight;
    this.line.update(this.pts, g.camera, 1.7, H);
    // 水下一小段到餌
    if (this.tackle.visible && (this.phase === 'wait' || this.phase === 'bite')) {
      const bp = this.baitPos(new THREE.Vector3());
      bp.x += Math.sin(t * 0.8) * 0.04; bp.z += Math.cos(t * 0.7) * 0.04;
      this.tackle.position.copy(bp); this.tackle.rotation.y = t * 0.3;
      for (let i = 0; i < 6; i++) this.upts[i].lerpVectors(this.bob, bp, i / 5);
      this.under.update(this.upts, g.camera, 1.2, H);
      this.under.mesh.visible = true;
    }
  }
}
