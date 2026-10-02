// Bot AI（SPEC §16）：29 個，產生 intent。分檔：bots-brain（狀態機）、bots-nav（導航）、bots-combat（感知／戰鬥／建造）。
// 空投 → 滑翔 → 搜刮 → 採集 → 轉圈 → 交戰 → 補給。距玩家 > lodDist 的 bot 以 4 Hz 思考，bot 對 bot 以機率結算。
import { Brain } from './bots-brain.js';
import { TUNE } from './bots-combat.js';

export const BOT_NAMES = ['布丁隊長', 'SnackAttack', '鹹酥雞戰神', '珍奶游擊手', 'NoodleNinja', '蔥油餅騎士', 'PixelPanda', '臭豆腐突擊', 'MochiMage', '滷肉飯勇者', 'TofuTank', '芋圓大師', 'BubbleBandit', '蚵仔煎特攻', 'WaffleWolf', '雞排小隊長', 'CocoaCrusher', '肉圓刺客', 'SushiStorm', '地瓜球魔王', 'PepperPilot', '豆花俠', 'GlitchGoat', '牛肉麵老大', 'DonutDash', '包子小火箭', 'TacoTornado', '麻糬戰士', 'KiwiKnight'];

const NEAR_DT = 1 / 20, FAR_DT = 0.25;
// 對局節奏導演：期望存活人數曲線（含玩家；秒 = 風暴啟動後，約為飛艇結束 = 對局開始後 ~50 s）。
// 實際人數比曲線多 → 提高 bot「主動」開戰的意願；少 → 降低（被打時仍會還擊）。目標：落地 30 → 2:50 約 20 → 5:10 約 12 → 7:30 約 6 → 最終決戰約 9 分（風暴總長 480 s）。
const PACE_CURVE = [[0, 30], [8, 30], [120, 21], [262, 13], [412, 7], [462, 4.5], [495, 3], [518, 2], [900, 1]];
export function targetAlive(t) {
  for (let i = 1; i < PACE_CURVE.length; i++) if (t <= PACE_CURVE[i][0]) { const [t0, v0] = PACE_CURVE[i - 1], [t1, v1] = PACE_CURVE[i]; return v0 + (v1 - v0) * (t - t0) / (t1 - t0); }
  return 1;
}

export class Bots {
  constructor(ctx) {
    this.ctx = ctx; this.brains = []; this.frozen = false;
    this.lodDist = TUNE.lodDist; this.forceFull = false; this.forceSim = false; this.pace = 1; this.paceAt = 0; this.paceOn = true; this.paceLog = [];
    this.perf = { ms: 0, n: 0 }; this.stats = { fights: 0, defend: 0, start: 0, byPhase: [0, 0, 0, 0, 0, 0, 0] };
    ctx.events.on('damage', (d) => this.onDamage(d));
    ctx.events.on('shot', (e) => this.onShot(e));
  }
  init() { this.ctx.actors.forEach((a, i) => { if (!a.isPlayer) this.brains.push(new Brain(this, a, this.brains.length)); }); }
  reset() { this.stormT0 = undefined; this.pace = 1; this.paceAt = 0; this.paceLog = []; this.brains.forEach((b) => b.reset()); this.stats = { fights: 0, defend: 0, start: 0, byPhase: [0, 0, 0, 0, 0, 0, 0] }; }
  // LOD 參考點：玩家活著用玩家，淘汰後用觀戰目標
  viewer() { const c = this.ctx, p = c.player; if (p.alive || !c.cam) return p; const f = c.cam.followTarget || c.cam.spectate; return f && f.alive ? f : p; }
  brainOf(actor) { return actor && !actor.isPlayer ? this.brains[actor.id - 1] : null; }
  // 測試 API
  debug(id) {
    const b = this.brains[id - 1]; if (!b) return null;
    return { state: b.state, target: b.foe ? b.foe.id : null, goal: b.goal ? { x: b.goal.x, z: b.goal.z, kind: b.goal.kind } : null, landing: b.target && b.target.x !== undefined ? { x: b.target.x, z: b.target.z } : null, skill: b.skill, stuck: b.stuckLvl, far: b.far, loot: b.loot ? b.loot.kind : null };
  }
  // 測試用：強制某 bot 前往 (x,z)；clearGoal(id) 解除
  setGoal(id, x, z) { const b = this.brains[id - 1]; if (b) { b.forcedGoal = { x, z }; b.setGoal(x, z, undefined, 'test'); } }
  clearGoal(id) { const b = this.brains[id - 1]; if (b) b.forcedGoal = null; }

  onDamage(d) {
    const b = this.brainOf(d.target); if (!b || !d.source || d.source === d.target) return;
    const now = this.ctx.time.now;
    b.hitBy = d.source; b.hitAt = now; b.lastHurtAt = now; b.hurtAmt += d.amount;
    if (now >= b.buildCd && !b.bseq && Math.random() < 0.2 + 0.75 * b.skill) { b.coverWanted = true; b.coverAt = now + 0.12 + Math.random() * 0.3 + (1 - b.skill) * 0.25; }
  }
  onShot(e) {
    const a = e.actor; if (!a || e.weapon === 'pickaxe') return;
    const own = this.brainOf(a);
    if (own) own.onShot(e.weapon);
    this.noise(a.pos.x, a.pos.z, a);
  }
  // 槍聲：附近還沒有目標的 bot 記下位置
  noise(x, z, src) {
    const now = this.ctx.time.now, R2 = TUNE.hearRange * TUNE.hearRange;
    for (const b of this.brains) {
      if (b.a === src || !b.a.alive) continue;
      const dx = x - b.a.pos.x, dz = z - b.a.pos.z;
      if (dx * dx + dz * dz > R2) continue;
      if (now - b.heardT > 1.5 || dx * dx + dz * dz < (b.heardX - b.a.pos.x) ** 2 + (b.heardZ - b.a.pos.z) ** 2) { b.heardX = x; b.heardZ = z; }
      b.heardT = now;
    }
  }

  fixedUpdate(dt) {
    const c = this.ctx; if (c.match.state === 'menu') return;
    const t0 = performance.now();
    const now = c.time.now;
    // LOD 以「玩家看得到的地方」為準：玩家死亡後觀戰的對象才是鏡頭所在，遠處打鬥也要真的開槍
    const p = this.viewer();
    if (this.paceOn && now >= this.paceAt) {
      this.paceAt = now + 1;
      if (c.storm.active && this.stormT0 === undefined) this.stormT0 = now;
      const t = this.stormT0 === undefined ? 0 : now - this.stormT0, tg = targetAlive(t), alive = c.match.alive();
      if (Math.floor(t / 10) !== Math.floor((t - 1) / 10)) this.paceLog.push([Math.round(t), +this.pace.toFixed(2), alive]);
      if (c.match.state === 'playing') this.pace = Math.min(3, Math.max(0, 1 + 6 * (alive - tg) / tg));   // 比期望曲線多就更積極，少就停止主動開戰
    }
    for (const b of this.brains) {
      const a = b.a;
      if (!a.alive) continue;
      const I = a.intent;
      const ground = a.state === 'ground' || a.state === 'air';
      if (this.frozen && ground) { I.moveX = I.moveZ = 0; I.fire = false; I.jump = false; I.interact = false; I.buildPlace = false; I.reload = false; I.slot = -1; continue; }
      b.clearEdges();
      // LOD
      const dx = a.pos.x - p.pos.x, dz = a.pos.z - p.pos.z;
      b.far = !this.forceFull && dx * dx + dz * dz > this.lodDist * this.lodDist && !(a.state === 'skydive' || a.state === 'glide' || a.state === 'bus');
      b.acc += dt;
      const iv = b.far ? FAR_DT : NEAR_DT;
      if (b.acc >= iv) { const step = b.acc; b.acc = b.far ? Math.random() * 0.03 : 0; b.think(step); }
      b.stepAim(dt);
    }
    this.perf.ms += performance.now() - t0; this.perf.n++;
  }
}
