// 啟動、固定步長迴圈、狀態機（選角 → 對戰 → 結算）、場景同步與測試 API。
import * as THREE from 'three';
import { DT, HEROES, HERO_ORDER, TEAM_COLOR, FOUNTAIN, BASE, WAVE_EVERY, KI_BAR, xpToNext } from './config.js';
import { createRenderer } from './render.js';
import { buildMap, heightAt, STRUCTURES, toonGradient } from './map.js';
import { buildHero, buildMinion, buildTower, buildCore } from './models.js';
import { createFx } from './fx.js';
import { audio } from './audio.js';
import {
  createWorld, addUnit, makeHero, spawnWave, updateMinion, updateTower, heroTick, tickStatus, physics, separate, respawnHero, dist, gainXp, addKi, damage, vulnerable,
} from './units.js';
import { heroAct, updateProjectiles, updateZones, wireShots, cast, orderMove, orderAttack, levelSkill, setCharging, spark } from './combat.js';
import { makeBrain, updateAI } from './ai.js';
import { createHud, createSelect, showEnd } from './hud.js';
import { createInput } from './input.js';
import { createMinimap } from './minimap.js';

const canvas = document.getElementById('gl');
const R = createRenderer(canvas);
const { scene, camera, cam } = R;
const map = buildMap(scene, matchMedia('(pointer: coarse)').matches ? 0 : 1);
const fx = createFx(scene, camera);
audio.init();

/* ---------------- 頭像 ---------------- */
const portraits = {};
{
  const rt = new THREE.WebGLRenderTarget(160, 160);
  const ps = new THREE.Scene();
  ps.add(new THREE.HemisphereLight('#fff4e0', '#5a4a3a', 1.6));
  const dl = new THREE.DirectionalLight('#ffffff', 2.4); dl.position.set(2, 3, 4); ps.add(dl);
  const pc = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  const buf = new Uint8Array(160 * 160 * 4), cv = document.createElement('canvas'); cv.width = cv.height = 160;
  const g = cv.getContext('2d'), img = g.createImageData(160, 160);
  for (const id of HERO_ORDER) for (const team of [0, 1]) {
    const rig = buildHero(id, team); ps.add(rig.root);
    for (let i = 0; i < 6; i++) rig.update(1 / 30, { name: 'idle', t: i / 30, k: 0 });
    rig.root.updateMatrixWorld(true);
    const hp = new THREE.Vector3(); rig.head.getWorldPosition(hp);
    pc.position.set(hp.x + 0.55, hp.y + 0.12, hp.z + 1.55); pc.lookAt(hp.x, hp.y - 0.05, hp.z);
    R.renderer.setRenderTarget(rt); R.renderer.setClearColor(0x000000, 0); R.renderer.clear();
    R.renderer.render(ps, pc);
    R.renderer.readRenderTargetPixels(rt, 0, 0, 160, 160, buf);
    for (let y = 0; y < 160; y++) img.data.set(buf.subarray((159 - y) * 640, (160 - y) * 640), y * 640);
    g.clearRect(0, 0, 160, 160); g.putImageData(img, 0, 0);
    portraits[id + team] = cv.toDataURL('image/png');
    ps.remove(rig.root); rig.dispose && rig.dispose();
  }
  R.renderer.setRenderTarget(null); R.renderer.setClearColor(0x000000, 1); rt.dispose();
}

/* ---------------- 狀態 ---------------- */
let G = null, hud = null, input = null, minimap = null;
const rigs = new Map(); // unit.id → { rig, ring }
const showcase = [];
let selectSel = 'homura', selectCam = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
let paused = false, endTimer = -1, recallSnd = null;

const ringGeo = new THREE.RingGeometry(0.95, 1.18, 40).rotateX(-Math.PI / 2);
function ringFor(color, scale = 1) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false })); m.scale.setScalar(scale); m.renderOrder = 2; scene.add(m); return m; }

// 選角展示台：四名英雄站在青隊泉水旁
function buildShowcase() {
  HERO_ORDER.forEach((id, i) => {
    const rig = buildHero(id, 0);
    const a = -0.6 + i * 0.4, x = -70 + Math.cos(a + Math.PI / 4) * 7, z = 70 - Math.sin(a + Math.PI / 4) * 7;
    rig.root.position.set(x, heightAt(x, z), z);
    rig.root.rotation.y = Math.atan2(-60 - x, 60 - z) * 0 + Math.PI * 0.75;
    scene.add(rig.root);
    showcase.push({ id, rig, t: Math.random() * 3, pose: 'idle', poseT: 0 });
  });
}
buildShowcase();

/* ---------------- 選角 ---------------- */
const select = createSelect({
  portraits,
  onPick(id) { selectSel = id; const s = showcase.find((o) => o.id === id); if (s) { s.pose = 'win'; s.poseT = 0; } audio.play('select', { vol: 0.5 }); },
  onStart(id, lane, diff) { startMatch(id, lane, diff); },
});
select.show();

function startMatch(heroId, lane = 1, diff = 1) {
  audio.resume(); audio.play('select');
  clearMatch();
  G = createWorld();
  G.fx = fx; G.cam = cam; G.zones = []; G.timers = [];
  G.later = (d, fn) => G.timers.push({ t: G.time + d, fn });
  G.shake = (amt, ang) => R.shake(amt, ang !== undefined ? new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang)) : null);
  G.sfx = sfx;
  wireShots(G);
  // 隊伍組成：玩家＋兩名隊友（不重複），敵隊三名（不重複）
  const others = HERO_ORDER.filter((h) => h !== heroId).sort(() => Math.random() - 0.5);
  const lanes = [0, 1, 2].filter((l) => l !== lane);
  const P = addUnit(G, makeHero(G, heroId, 0, lane, true));
  G.player = P;
  lanes.forEach((l, i) => { const h = addUnit(G, makeHero(G, others[i], 0, l, false)); h.brain = makeBrain(h, diff); });
  const foes = HERO_ORDER.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  [0, 1, 2].forEach((l, i) => { const h = addUnit(G, makeHero(G, foes[i], 1, l, false)); h.brain = makeBrain(h, diff); });
  // 玩家一開始自動學 Q；AI 自己分配
  levelSkill(G, P, 'Q');
  for (const h of G.heroes) { const f = FOUNTAIN[h.team]; h.x = f[0] + (Math.random() - 0.5) * 4; h.z = f[1] + (Math.random() - 0.5) * 4; h.facing = h.team ? -Math.PI * 0.25 : Math.PI * 0.75; }
  // 場景物件
  for (const u of G.units) attachRig(u);
  G.on('spawn', attachRig);
  wireEvents();
  if (!hud) hud = createHud({ render: R, portraits });
  hud.attach(G);
  hud.bindPlayer(P);
  if (!minimap) minimap = createMinimap(document.getElementById('minimap'), map.groundCanvas);
  if (!input) input = createInput({ G: proxyG, render: R, minimap, hud, audio, onHelp: toggleHelp, onCamToggle: (free) => document.body.classList.toggle('camfree', free) });
  for (const s of showcase) s.rig.root.visible = false;
  cam.target.set(P.x, 0, P.z); cam.look.copy(cam.target); cam.zoom = 1; cam.focus = null;
  G.camFree = false; G.phase = 'play'; paused = false; endTimer = -1;
  select.hide(); document.getElementById('end').className = ''; document.getElementById('hud').classList.add('on');
  document.body.classList.add('playing');
  hud.announce('青隊 對 赤隊', 'good', '摧毀赤隊主堡就獲勝');
}
// input 綁定一次；用代理物件指向目前的 G
const proxyG = new Proxy({}, { get: (_, k) => (G ? G[k] : k === 'phase' ? 'select' : undefined), set: (_, k, v) => { if (G) G[k] = v; return true; } });

function clearMatch() {
  for (const [, r] of rigs) { scene.remove(r.rig.root); r.rig.dispose && r.rig.dispose(); if (r.ring) { scene.remove(r.ring); r.ring.material.dispose(); } }
  rigs.clear();
  if (G) { for (const p of G.projectiles) p.vis && p.vis.remove(); for (const z of G.zones) z.vis && z.vis.remove(); }
}

function attachRig(u) {
  if (rigs.has(u.id)) return;
  let rig, ring = null;
  if (u.kind === 'hero') { rig = buildHero(u.heroId, u.team); ring = ringFor(u.isPlayer ? '#f6c64a' : TEAM_COLOR[u.team], 1); }
  else if (u.kind === 'minion') rig = buildMinion(u.team, u.mkind);
  else if (u.kind === 'tower') rig = buildTower(u.team);
  else rig = buildCore(u.team);
  rig.root.position.set(u.x, heightAt(u.x, u.z), u.z);
  if (u.kind === 'tower' || u.kind === 'core') rig.root.rotation.y = u.team ? Math.PI * 1.25 : Math.PI * 0.25;
  scene.add(rig.root);
  rigs.set(u.id, { rig, ring, u });
}

/* ---------------- 音效 ---------------- */
function sfx(name, at, o = {}) {
  if (!G) return audio.play(name, o);
  let vol = o.vol ?? 1, pan = 0;
  if (at && at.x !== undefined) {
    const d = Math.hypot(at.x - cam.look.x, at.z - cam.look.z);
    if (d > 42) return null;
    vol *= Math.max(0.12, 1 - d / 42);
    pan = Math.max(-1, Math.min(1, (at.x - cam.look.x) / 30));
  }
  return audio.play(name, { ...o, vol, pan });
}

function wireEvents() {
  G.on('levelup', (h) => { fx.levelUp(h, '#ffe08a'); if (h === G.player) audio.play('levelUp'); });
  G.on('kibar', ({ h, bars }) => { if (h === G.player) audio.play(bars >= 5 ? 'kiFull' : 'ki', { vol: 0.6 }); });
  G.on('herodeath', ({ u }) => { sfx('heroDie', u); if (u === G.player) G.shake(0.8); });
  G.on('structure', ({ u }) => { fx.towerFall(u.x, u.z); sfx('towerDown', u, { vol: 1.3 }); if (dist(u, G.player) < 30) G.shake(0.9); });
  G.on('death', ({ u }) => { if (u.kind === 'minion') { sfx('minionDie', u, { vol: 0.5 }); fx.dust(u.x, u.z, 6); } });
  G.on('respawn', (h) => { if (h === G.player) { audio.play('respawn'); if (!G.camFree) cam.target.set(h.x, 0, h.z); } });
  G.on('recall', ({ h, state }) => {
    if (h !== G.player) { if (state === 'done') fx.vanish(h.x, h.z, '#9fe6ff', h, true); return; }
    if (state === 'start') recallSnd = audio.play('recall');
    else { recallSnd && recallSnd.stop && recallSnd.stop(); recallSnd = null; if (state === 'done') fx.vanish(h.x, h.z, '#9fe6ff', h, true); }
  });
  G.on('charge', ({ h, on }) => { if (h === G.player && on) sfx('ki', h, { vol: 0.4 }); });
  G.on('gameover', ({ winner }) => {
    endTimer = 3.2; G.slowmo = 1.6;
    const core = G.structures.find((s) => s.kind === 'core' && s.team !== winner);
    G.camFree = true; cam.target.set(core.x, 0, core.z);
    hud.announce(winner === G.player.team ? '勝利' : '敗北', winner === G.player.team ? 'good big' : 'bad big');
    audio.play(winner === G.player.team ? 'victory' : 'defeat');
  });
}

/* ---------------- 模擬一步 ---------------- */
function step(dt) {
  G.time += dt;
  if (G.time >= G.nextWave) { spawnWave(G); G.nextWave += WAVE_EVERY; }
  for (let i = G.timers.length - 1; i >= 0; i--) if (G.time >= G.timers[i].t) { const t = G.timers[i]; G.timers.splice(i, 1); t.fn(); }
  for (const h of G.heroes) {
    if (!h.alive) { h.deadT += dt; h.respawn -= dt; if (h.respawn <= 0 && G.winner < 0) respawnHero(G, h); continue; }
    tickStatus(h, dt);
    heroTick(G, h, dt);
    if (!h.alive) continue;
    if (h.brain) updateAI(G, h, dt);
    heroAct(G, h, dt);
    physics(G, h, dt);
  }
  for (const m of G.minions) {
    if (!m.alive) { m.deadT += dt; continue; }
    if (m.spawnDelay > 0) { m.spawnDelay -= dt; continue; }
    tickStatus(m, dt); m.anim.t += dt;
    updateMinion(G, m, dt);
    physics(G, m, dt);
  }
  for (const s of G.structures) if (s.alive && G.winner < 0) updateTower(G, s, dt);
  separate(G, dt);
  updateProjectiles(G, dt);
  updateZones(G, dt);
  // 清掉倒下很久的小兵
  for (let i = G.minions.length - 1; i >= 0; i--) {
    const m = G.minions[i];
    if (!m.alive && m.deadT > 1.6) {
      G.minions.splice(i, 1); const j = G.units.indexOf(m); if (j >= 0) G.units.splice(j, 1);
      const r = rigs.get(m.id); if (r) { scene.remove(r.rig.root); rigs.delete(m.id); }
    }
  }
}

/* ---------------- 畫面同步 ---------------- */
function sync(dt, t) {
  for (const [, r] of rigs) {
    const u = r.u, rig = r.rig;
    const gy = heightAt(u.x, u.z);
    if (u.kind === 'hero') {
      rig.root.position.set(u.x, gy + u.y, u.z);
      let dy = u.facing - rig.root.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      rig.root.rotation.y += dy * Math.min(1, dt * 22);
      const vanish = u.action && u.action.name === 'vanish';
      rig.root.visible = !vanish;
      const name = u.alive ? u.anim.name : 'dead';
      rig.update(dt, { name, t: u.alive ? u.anim.t : u.deadT, k: u.alive ? 0 : Math.min(1, u.deadT / 0.7) });
      const aura = !u.alive ? 0 : u.charging ? 1 : u.st.spark > 0 ? 0.85 : u.action && /super|beam|leap/.test(u.action.name) ? 0.9 : u.recall > 0 ? 0.5 : 0;
      rig.setAura(aura, u.recall > 0 ? '#9fe6ff' : u.def.color);
      if (aura > 0.5 && Math.random() < dt * 30) fx.aura(u.x, gy + 1, u.z, u.def.color, 1);
      r.ring.visible = u.alive; r.ring.position.set(u.x, gy + 0.06, u.z);
      if (u.flash > 0 && rig.root.visible) rig.root.visible = Math.floor(t * 40) % 2 === 0 || u.flash < 0.06;
    } else if (u.kind === 'minion') {
      rig.root.position.set(u.x, gy + u.y, u.z);
      let dy = u.facing - rig.root.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      rig.root.rotation.y += dy * Math.min(1, dt * 14);
      rig.root.visible = !(u.spawnDelay > 0);
      rig.update(dt, u.alive ? { name: u.anim.name, t: u.anim.t } : { name: 'dead', t: u.deadT });
    } else if (u.kind === 'tower') rig.update(dt, { charge: u.charge, hp: u.hp / u.maxHp, dead: !u.alive });
    else rig.update(dt, { hp: u.hp / u.maxHp, dead: !u.alive, vulnerable: G && u.alive ? vulnerable(G, u) : false });
  }
}

/* ---------------- 選角畫面的鏡頭 ---------------- */
function syncShowcase(dt, t) {
  for (const s of showcase) {
    s.t += dt; s.poseT += dt;
    if (s.pose === 'win' && s.poseT > 1.4) { s.pose = 'idle'; s.poseT = 0; }
    s.rig.update(dt, { name: s.pose, t: s.poseT, k: 0 });
    s.rig.setAura(s.id === selectSel ? 0.22 : 0, HEROES[s.id].color);
    s.rig.root.visible = true;
  }
  const s = showcase.find((o) => o.id === selectSel);
  const p = s.rig.root.position;
  const portrait = R.size[0] / R.size[1] < 0.9;
  const ang = Math.PI * 0.75 + Math.sin(t * 0.25) * 0.12;
  const wantPos = new THREE.Vector3(p.x + Math.sin(ang) * (portrait ? 7.5 : 5.2), p.y + (portrait ? 2.6 : 2.0), p.z + Math.cos(ang) * (portrait ? 7.5 : 5.2));
  const wantLook = new THREE.Vector3(p.x, p.y + (portrait ? 0.4 : 1.1), p.z);
  // 寬螢幕：角色放在畫面右側，留空間給左邊的說明
  if (!portrait) { const side = new THREE.Vector3(Math.cos(ang), 0, -Math.sin(ang)); wantLook.addScaledVector(side, -1.6); wantPos.addScaledVector(side, -1.6); }
  selectCam.pos.lerp(wantPos, 1 - Math.exp(-dt * 4)); selectCam.look.lerp(wantLook, 1 - Math.exp(-dt * 4));
  camera.position.copy(selectCam.pos); camera.lookAt(selectCam.look);
  R.sun.position.set(p.x + 30, 50, p.z - 20); R.sun.target.position.copy(p);
}
selectCam.pos.set(-60, 6, 76); selectCam.look.set(-68, 1, 68);

/* ---------------- 主迴圈 ---------------- */
let last = performance.now(), acc = 0, simT = 0, fpsAcc = 0, fpsN = 0, qualityChecked = false;
function frame(now) {
  requestAnimationFrame(frame);
  let rdt = Math.min(0.1, (now - last) / 1000); last = now;
  if (rdt <= 0) return;
  fpsAcc += rdt; fpsN++;
  if (!qualityChecked && fpsAcc > 4) { qualityChecked = true; const fps = fpsN / fpsAcc; if (fps < 32) R.setQuality(0); else if (fps < 48) R.setQuality(1); }
  if (G && G.phase !== 'select' && !paused) {
    let scale = 1;
    if (G.hitstop > 0) { G.hitstop -= rdt; scale = 0.04; }
    else if (G.slowmo > 0) { G.slowmo -= rdt; scale = 0.3; }
    input.update(rdt);
    acc += rdt * scale;
    let n = 0;
    while (acc >= DT && n < 8) { acc -= DT; step(DT); n++; }
    if (n === 8) acc = 0;
    const sdt = rdt * scale;
    simT += sdt;
    // 鏡頭
    const P = G.player;
    if (!G.camFree && P) cam.target.set(P.x, heightAt(P.x, P.z), P.z);
    if (cam.focus) cam.focusPos = { x: cam.focus.x, z: cam.focus.z };
    sync(sdt + (scale < 1 ? rdt * 0.02 : 0), simT);
    fx.update(sdt);
    map.update(simT);
    R.updateCamera(rdt, now / 1000);
    hud.update(rdt);
    drawMinimap();
    document.body.classList.toggle('dead', P && !P.alive);
    if (endTimer > 0) { endTimer -= rdt; if (endTimer <= 0) { G.phase = 'end'; document.getElementById('hud').classList.remove('on'); showEnd(G, portraits, () => { document.getElementById('end').className = ''; backToSelect(); }); } }
  } else if (G && paused) {
    R.updateCamera(0, now / 1000);
  } else if (G && G.phase === 'end') {
    fx.update(rdt); map.update(simT += rdt); sync(rdt, simT); R.updateCamera(rdt, now / 1000);
  } else {
    syncShowcase(rdt, now / 1000); fx.update(rdt); map.update(now / 1000);
  }
  fx.setPixelScale(R.size[1]);
  R.render();
}
function drawMinimap() {
  const [W, H] = R.size, pts = [];
  for (const [x, y] of [[0, 0], [W, 0], [W, H], [0, H]]) { const p = R.groundAt(x, y); if (p) pts.push(p); }
  minimap.draw(G, pts.length === 4 ? pts : null);
}
function backToSelect() {
  clearMatch(); G = null;
  document.body.classList.remove('playing', 'dead');
  for (const s of showcase) s.rig.root.visible = true;
  select.show();
}
function toggleHelp() {
  const h = document.getElementById('help');
  const on = !h.classList.contains('on');
  h.classList.toggle('on', on);
  if (G && G.phase === 'play') paused = on;
}
document.getElementById('helpBtn').addEventListener('click', toggleHelp);
document.getElementById('helpClose').addEventListener('click', toggleHelp);
document.getElementById('muteBtn').addEventListener('click', (e) => { audio.resume(); const m = audio.toggleMute(); e.currentTarget.classList.toggle('off', m); });
requestAnimationFrame(frame);

/* ---------------- 測試 API ---------------- */
window.__ki = {
  ready: true,
  get G() { return G; },
  start(id = 'homura', lane = 1, diff = 1) { startMatch(id, lane, diff); return true; },
  state() {
    if (!G) return { phase: 'select' };
    const P = G.player;
    return {
      phase: G.phase, time: +G.time.toFixed(2), winner: G.winner, kills: G.kills.slice(),
      player: { id: P.heroId, hp: Math.round(P.hp), maxHp: Math.round(P.maxHp), ki: Math.round(P.ki), level: P.level, xp: Math.round(P.xp), sp: P.sp, pos: [+P.x.toFixed(2), +P.z.toFixed(2)], alive: P.alive, ranks: { ...P.ranks }, cds: Object.fromEntries(Object.entries(P.cds).map(([k, v]) => [k, +v.toFixed(2)])), action: P.action && P.action.name },
      structures: G.structures.map((s) => ({ id: s.sid, alive: s.alive, hp: Math.round(s.hp) })),
      heroes: G.heroes.map((h) => ({ id: h.heroId, team: h.team, lane: h.lane, level: h.level, alive: h.alive, hp: Math.round(h.hp), k: h.kills, d: h.deaths, pos: [+h.x.toFixed(1), +h.z.toFixed(1)] })),
      minions: G.minions.filter((m) => m.alive).length, combo: G.combo.n,
    };
  },
  fastForward(sec) { const n = Math.round(sec / DT); for (let i = 0; i < n && G.winner < 0; i++) step(DT); G.hitstop = 0; G.slowmo = 0; return this.state(); },
  teleport(x, z) { const P = G.player; P.x = x; P.z = z; P.goal = null; P.target = null; cam.target.set(x, 0, z); cam.look.set(x, 0, z); },
  moveTo(x, z) { orderMove(G, G.player, x, z); },
  attack(i) { const u = typeof i === 'object' ? i : G.units.find((o) => o.id === i); orderAttack(G, G.player, u); },
  cast(k, x, z) { return cast(G, G.player, k, x, z); },
  levelUp(k) { return levelSkill(G, G.player, k); },
  setLevel(n) { const P = G.player; while (P.level < n) gainXp(G, P, xpToNext(P.level) - P.xp); return P.level; },
  give({ ki = 0, xp = 0 } = {}) { addKi(G, G.player, ki); if (xp) gainXp(G, G.player, xp); },
  learnAll() { const P = G.player; for (const k of ['R', 'Q', 'W', 'E', 'Q', 'W', 'E', 'Q', 'W', 'E']) levelSkill(G, P, k); return P.ranks; },
  freezeAI(on = true) { G.aiFrozen = on; },
  spawnEnemyHeroNear(d = 6) { const P = G.player, e = G.heroes.find((h) => h.team !== P.team && h.alive); e.x = P.x + d * 0.7; e.z = P.z - d * 0.7; e.goal = null; e.target = null; e.recall = 0; return e.id; },
  enemyHero() { const e = G.heroes.find((h) => h.team !== G.player.team && h.alive); return e && { id: e.id, x: e.x, z: e.z, hp: e.hp }; },
  destroy(id) { const s = G.structures.find((o) => o.sid === id); if (s && s.alive) { s.hp = 1; damage(G, null, s, 99999, { type: 'true' }); } return s && !s.alive; },
  win() { for (const s of G.structures) if (s.team === 1 && s.alive) { G.structures.filter((o) => o.team === 1 && o.kind === 'tower').forEach((o) => { if (o.alive) { o.hp = 0; o.alive = false; } }); } const c = G.structures.find((o) => o.kind === 'core' && o.team === 1); damage(G, G.player, c, 1e9, { type: 'true' }); },
  lose() { G.structures.filter((o) => o.team === 0 && o.kind === 'tower').forEach((o) => { o.alive = false; o.hp = 0; }); const c = G.structures.find((o) => o.kind === 'core' && o.team === 0); damage(G, G.heroes.find((h) => h.team === 1), c, 1e9, { type: 'true' }); },
  killPlayer() { const P = G.player, e = G.heroes.find((h) => h.team !== P.team); P.st.invuln = 0; P.st.shield = 0; damage(G, e, P, 1e9, { type: 'true', noKi: true }); return P.alive; },
  damageStructure(id, amt) { const s = G.structures.find((o) => o.sid === id); return damage(G, G.player, s, amt, { type: 'L', noKi: true }); },
  camera(x, z, zoom = 1) { G.camFree = true; cam.target.set(x, 0, z); cam.look.set(x, 0, z); cam.zoom = zoom; },
  follow() { G.camFree = false; },
  pick(id) { select.pick(id); },
  pause(on) { paused = on; },
  setQuality(q) { R.setQuality(q); },
  render: R,
};
