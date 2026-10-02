// 啟動：建立 ctx、依序建構模組、固定步長主迴圈、window.__sw 測試 API。
import * as THREE from 'three';
import * as config from './config.js';
import { mulberry32, Events } from './shared.js';
import { Render } from './render.js';
import { Terrain } from './terrain.js';
import { Physics } from './physics.js';
import { World } from './world.js';
import { Actor } from './actor.js';
import { PlayerController } from './player.js';
import { ThirdPersonCamera } from './camera.js';
import { Input } from './input.js';
import { createCharacterFactory } from './character.js';
import { Audio } from './audio.js';
import { Combat } from './combat.js';
import { Loot } from './loot.js';
import { Fx } from './fx.js';
import { Build } from './build.js';
import { Storm } from './storm.js';
import { Match } from './match.js';
import { Hud } from './hud.js';
import { Minimap } from './minimap.js';
import { Bots, BOT_NAMES } from './bots.js';
import { makeItem } from './items.js';

const STEP = 1 / 60;
const coarse = matchMedia('(pointer: coarse)').matches;
const ctx = {
  THREE, config, rng: mulberry32(config.SEED), time: { now: 0, dt: 0, frame: 0 }, events: new Events(), actors: [], paused: false,
  quality: coarse ? 'medium' : 'high', settings: { ...config.DEFAULT_SETTINGS },
};
ctx.render = new Render(ctx);           // 設定 ctx.renderer / scene / camera
ctx.terrain = new Terrain(ctx);
ctx.physics = new Physics(ctx);
ctx.world = new World(ctx);
ctx.characters = createCharacterFactory(ctx);
ctx.audio = new Audio(ctx);
ctx.fx = new Fx(ctx);
ctx.loot = new Loot(ctx);
ctx.combat = new Combat(ctx);
ctx.build = new Build(ctx);
ctx.storm = new Storm(ctx);
ctx.input = new Input(ctx);
for (let i = 0; i < config.PLAYERS; i++) {
  const a = new Actor(ctx, i, i === 0, i === 0 ? '阿嵐 RAN' : BOT_NAMES[i - 1]);
  a.outfit = i === 0 ? ctx.characters.playerOutfit : ctx.characters.makeOutfit(ctx.rng);
  a.view = ctx.characters.create(a); a.view.setVisible(false);
  ctx.actors.push(a);
}
ctx.player = ctx.actors[0];
ctx.playerCtl = new PlayerController(ctx);
ctx.cam = new ThirdPersonCamera(ctx);
ctx.match = new Match(ctx);
ctx.hud = new Hud(ctx);
ctx.minimap = new Minimap(ctx);
ctx.bots = new Bots(ctx);
const modules = [ctx.terrain, ctx.world, ctx.physics, ctx.audio, ctx.fx, ctx.loot, ctx.combat, ctx.build, ctx.storm, ctx.input, ctx.playerCtl, ctx.cam, ctx.match, ctx.hud, ctx.minimap, ctx.bots];
modules.forEach((m) => m.init && m.init());
ctx.actors.forEach((a) => a.view.setVisible(true));

function fixed(dt) {
  ctx.time.now += dt; ctx.time.frame++;
  ctx.playerCtl.fixedUpdate(dt);
  if (ctx.match.state === 'menu') return;
  ctx.bots.fixedUpdate(dt);
  for (const a of ctx.actors) a.fixedUpdate(dt);
  ctx.combat.fixedUpdate(dt); ctx.build.fixedUpdate(dt); ctx.loot.fixedUpdate(dt); ctx.storm.fixedUpdate(dt); ctx.match.fixedUpdate(dt);
}
let last = performance.now(), acc = 0, fps = 60;
function frame(nowMs) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (nowMs - last) / 1000); last = nowMs;
  fps += (1 / Math.max(dt, 1e-4) - fps) * 0.05;
  ctx.time.dt = ctx.paused ? 0 : dt;
  if (ctx.paused) ctx.playerCtl.idle();
  else {
    acc += dt; let n = 0;
    while (acc >= STEP && n < 5) { fixed(STEP); acc -= STEP; n++; }
    if (n === 5) acc = 0;
  }
  const d = ctx.time.dt;
  ctx.world.update(d); ctx.terrain.update(d); ctx.match.update(d); ctx.loot.update(d); ctx.build.update(d); ctx.storm.update(d);
  for (const a of ctx.actors) a.view.update(d, a);
  ctx.cam.update(dt); ctx.fx.update(d); ctx.render.update(dt); ctx.hud.update(d); ctx.minimap.update(dt); ctx.audio.update(d);
  ctx.render.render();
  ctx._fps = fps;
}
requestAnimationFrame(frame);

// ---- 測試 API ----
const groundY = (x, z) => ctx.physics.groundHeight(x, z, 1000, 0.38).y;
function putOnGround(a, x, z) {
  a.pos.set(x, groundY(x, z) + 0.02, z); a.vel.set(0, 0, 0); a.state = 'ground'; a.grounded = true;
}
const sw = (window.__sw = {
  ctx, ready: true,
  state() { const p = ctx.player; return { state: ctx.match.state, alive: ctx.match.alive(), playerAlive: p.alive, pstate: p.state, pos: p.pos.toArray(), health: p.health, shield: p.shield, kills: p.kills, building: p.building, phase: ctx.storm.phase, stormState: ctx.storm.state, radius: ctx.storm.radius, selected: p.inventory.selected, mats: { ...p.inventory.mats }, pieces: ctx.build.pieces.size }; },
  start() { ctx.match.start(); },
  restart() { ctx.match.start(); },
  skipToGround(x = 8, z = 30) {
    const m = ctx.match;
    if (m.state === 'menu' || m.state === 'ended') m.start();
    ctx.actors.forEach((a, i) => {
      if (a.state === 'bus' || a.state === 'skydive' || a.state === 'glide') {
        if (a.isPlayer) putOnGround(a, x, z);
        else { const b = ctx.bots.brains[i - 1]; putOnGround(a, b.target.x, b.target.z); }
      }
    });
    m.busT = 999; m.bus.visible = false;
    if (m.state === 'bus') { m.setState('playing'); }
    if (!ctx.storm.active) ctx.storm.start();
    ctx.cam.init = false;
  },
  teleport(x, z) { putOnGround(ctx.player, x, z); ctx.cam.init = false; },
  give(defId, rarity = 2) {
    const inv = ctx.player.inventory, it = makeItem(defId, rarity, defId in { bandage: 1, medkit: 1, minishield: 1, shield: 1 } ? 5 : undefined);
    ctx.player.building = false;
    const r = inv.add(it);
    if (r.added) { let i = inv.slots.indexOf(it); if (i < 0) i = inv.slots.findIndex((s) => s && s.defId === defId); if (i >= 0) inv.selected = i + 1; }
    else { inv.slots[0] = it; inv.selected = 1; }
    return it;
  },
  giveMats(n = 999) { for (const m of ['wood', 'stone', 'metal']) ctx.player.inventory.addMat(m, n); },
  giveAmmo(n = 999) { for (const t of ['light', 'medium', 'heavy', 'shells']) ctx.player.inventory.addAmmo(t, n); },
  killBots(n = 1) { let k = 0; for (const a of ctx.actors) { if (k >= n) break; if (!a.isPlayer && a.alive) { a.takeDamage(9999, { ignoreShield: true, source: ctx.player }); k++; } } return k; },
  spawnBotNear(dist = 12) {
    const p = ctx.player, a = ctx.actors.find((x) => !x.isPlayer && x.alive); if (!a) return null;
    const x = p.pos.x - Math.sin(p.yaw) * dist, z = p.pos.z - Math.cos(p.yaw) * dist;
    putOnGround(a, x, z); a.health = 100; a.shield = 0; a.yaw = a.intent.yaw = p.yaw + Math.PI; return a.id;
  },
  dropItem(defId, rarity = 2, dist = 1) { const p = ctx.player; return ctx.loot.spawn(makeItem(defId, rarity), new THREE.Vector3(p.pos.x - Math.sin(p.yaw) * dist, p.pos.y, p.pos.z - Math.cos(p.yaw) * dist)); },
  spawnChest(dist = 1.5) { const p = ctx.player, c = { x: p.pos.x - Math.sin(p.yaw) * dist, y: p.pos.y, z: p.pos.z - Math.cos(p.yaw) * dist, yaw: 0, opened: false, mesh: null }; ctx.loot.chests.push(c); return c; },
  freezeBots(b = true) { ctx.bots.frozen = !!b; },
  storm: { skip() { ctx.storm.skip(); }, setPhase(n) { ctx.storm.setPhase(n); } },
  fastForward(sec = 1) { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { fixed(STEP); if (ctx.match.state !== 'menu') ctx.cam.update(STEP); } },
  stats() { const i = ctx.renderer.info; return { fps: Math.round(fps), drawCalls: i.render.calls, triangles: i.render.triangles, alive: ctx.match.alive(), phase: ctx.storm.phase, quality: ctx.quality, state: ctx.match.state, pieces: ctx.build.pieces.size, pickups: ctx.loot.pickups.length }; },
  setQuality(q) { ctx.render.setQuality(q); ctx.noAutoQuality = true; },
  // 腳本輸入（覆蓋 input.poll 的結果），例如 press({ moveZ: 1, fire: true })；press(null) 清除
  press(o) { ctx.input.script = o; },
  aimAt(id) { ctx.aimLock = id == null ? null : id; },
  look(yaw, pitch = 0) { ctx.playerCtl.yaw = yaw; ctx.playerCtl.pitch = pitch; },
});
