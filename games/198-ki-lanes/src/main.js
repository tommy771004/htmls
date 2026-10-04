// 啟動、固定步長迴圈、狀態機（選角 → 對戰 → 結算）、場景同步與測試 API。
import * as THREE from 'three';
import { DT, HEROES, HERO_ORDER, TEAM_COLOR, TEAM_LIGHT, FOUNTAIN, BASE, WAVE_EVERY, KI_BAR, xpToNext, DRAGON } from './config.js';
import { newMatch, stepWorld } from './world.js';
import { updateFog, resetFog } from './fog.js';
import { seen } from './vision.js';
import { buy, eatSenzu, inShop, sell } from './items.js';
import { BUSHES, OBSTACLES, walkable, bushAt, lanePath, laneProgress, pointAlong, distToLane } from './map.js';
import { bossAlive } from './jungle.js';
import { createRenderer } from './render.js';
import { buildMap, heightAt, STRUCTURES, toonGradient } from './map.js';
import { giveBalls } from './dragonballs.js';
import { buildHero, buildMinion, buildTower, buildCore, buildMonster } from './models.js';
import { createFx } from './fx.js';
import { audio } from './audio.js';
import { dist, gainXp, addKi, damage, vulnerable } from './units.js';
import { cast, orderMove, orderAttack, levelSkill, setCharging, spark, placeWard, placeControl } from './combat.js';
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
// portraits：方形大頭（名單、選角、結算）；busts：直式半身（技能列左側、對話框），背景透明
const portraits = {}, busts = {};
{
  const ps = new THREE.Scene();
  ps.add(new THREE.HemisphereLight('#fff4e0', '#5a4a3a', 1.6));
  const dl = new THREE.DirectionalLight('#ffffff', 2.4); dl.position.set(2, 3, 4); ps.add(dl);
  const rim = new THREE.DirectionalLight('#9fd8ff', 1.4); rim.position.set(-3, 1.5, -2); ps.add(rim);
  const pc = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  const shots = [
    { out: portraits, w: 160, h: 160, cam: (hp) => [hp.x + 0.38, hp.y + 0.24, hp.z + 1.1, hp.x, hp.y + 0.1, hp.z] },
    { out: busts, w: 220, h: 264, cam: (hp) => [hp.x + 0.52, hp.y + 0.16, hp.z + 2.15, hp.x - 0.04, hp.y - 0.12, hp.z] },
  ];
  for (const sh of shots) {
    const { w, h } = sh, rt = new THREE.WebGLRenderTarget(w, h);
    const buf = new Uint8Array(w * h * 4), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'), img = g.createImageData(w, h);
    pc.aspect = w / h; pc.updateProjectionMatrix();
    for (const key of HERO_ORDER.flatMap((id) => (sh.out === busts && HEROES[id].ssj ? [id, id + ':ssj'] : [id]))) {
      const [id, form] = key.split(':');
      const rig = buildHero(id, 0); ps.add(rig.root);
      if (form && rig.setForm) rig.setForm(form);
      for (let i = 0; i < 6; i++) rig.update(1 / 30, { name: 'idle', t: i / 30, k: 0 });
      rig.root.updateMatrixWorld(true);
      const hp = new THREE.Vector3(); rig.head.getWorldPosition(hp);
      const c = sh.cam(hp); pc.position.set(c[0], c[1], c[2]); pc.lookAt(c[3], c[4], c[5]);
      R.renderer.setRenderTarget(rt); R.renderer.setClearColor(0x000000, 0); R.renderer.clear();
      R.renderer.render(ps, pc);
      R.renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
      for (let y = 0; y < h; y++) img.data.set(buf.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
      g.clearRect(0, 0, w, h); g.putImageData(img, 0, 0);
      sh.out[key] = cv.toDataURL('image/png');
      ps.remove(rig.root); rig.dispose && rig.dispose();
    }
    rt.dispose();
  }
  R.renderer.setRenderTarget(null); R.renderer.setClearColor(0x000000, 1);
}

/* ---------------- 狀態 ---------------- */
let G = null, hud = null, input = null, minimap = null;
const rigs = new Map(); // unit.id → { rig, ring }
const showcase = [];
let selectSel = 'goku', selectCam = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
let paused = false, endTimer = -1, recallSnd = null;

const ringGeo = new THREE.RingGeometry(0.95, 1.18, 40).rotateX(-Math.PI / 2);
function ringFor(color, scale = 1) { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false })); m.scale.setScalar(scale); m.renderOrder = 2; scene.add(m); return m; }

// 選角展示台：四名英雄站在青隊泉水旁
function buildShowcase() {
  HERO_ORDER.forEach((id, i) => {
    const rig = buildHero(id, 0);
    const a = -0.95 + i * 0.38, x = -70 + Math.cos(a + Math.PI / 4) * 8, z = 70 - Math.sin(a + Math.PI / 4) * 8;
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
  onPick(id) { selectSel = id; const s = showcase.find((o) => o.id === id); if (s) { s.pose = 'win'; s.poseT = 0; } audio.play('select', { vol: 0.5 }); audio.say(id, 'ready', { vol: 0.9 }); },
  onStart(id, lane, diff) { startMatch(id, lane, diff); },
});
select.show();

function startMatch(heroId, lane = 1, diff = 1) {
  audio.resume(); audio.play('select');
  audio.music(true);
  clearMatch();
  G = newMatch({ fx, cam, sfx, shake: (amt, ang) => R.shake(amt, ang !== undefined ? new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang)) : null), player: heroId, lane, diff });
  const P = G.player;
  setTimeout(() => G && G.player === P && voice(P, 'ready'), 700);
  for (const u of G.units) attachRig(u);
  G.on('spawn', attachRig);
  G.on('despawn', (u) => { const r = rigs.get(u.id); if (r) { scene.remove(r.rig.root); r.rig.dispose && r.rig.dispose(); if (r.ring) scene.remove(r.ring); rigs.delete(u.id); } });
  wireEvents();
  resetFog();
  if (!hud) hud = createHud({ render: R, portraits, busts });
  hud.attach(G);
  hud.bindPlayer(P);
  if (!minimap) minimap = createMinimap(document.getElementById('minimap'), map.groundCanvas);
  if (!input) input = createInput({ G: proxyG, render: R, minimap, hud, audio, onHelp: toggleHelp, onCamToggle: (free) => document.body.classList.toggle('camfree', free), onShop: () => hud.toggleShop() });
  for (const s of showcase) s.rig.root.visible = false;
  cam.target.set(P.x, 0, P.z); cam.look.copy(cam.target); cam.zoom = 1; cam.focus = null;
  G.camFree = false; G.phase = 'play'; paused = false; endTimer = -1;
  select.hide(); document.getElementById('end').className = ''; document.getElementById('hud').classList.add('on');
  document.body.classList.add('playing');
  hud.announce('青隊 對 赤隊', 'good', '摧毀赤隊主堡就獲勝　P 開商店');
}
// input 綁定一次；用代理物件指向目前的 G
const proxyG = new Proxy({}, { get: (_, k) => (G ? G[k] : k === 'phase' ? 'select' : undefined), set: (_, k, v) => { if (G) G[k] = v; return true; } });

function clearMatch() {
  for (const [, r] of rigs) { scene.remove(r.rig.root); r.rig.dispose && r.rig.dispose(); if (r.ring) { scene.remove(r.ring); r.ring.material.dispose(); } }
  rigs.clear();
  if (G) { for (const p of G.projectiles) p.vis && p.vis.remove(); for (const z of G.zones) z.vis && z.vis.remove(); }
}

const HERO_VIS = 1.15; // 對戰中英雄外觀放大（碰撞與射程不變），貼近俯視鏡頭下的比例
function attachRig(u) {
  if (rigs.has(u.id)) return;
  let rig, ring = null;
  if (u.kind === 'hero') { rig = buildHero(u.heroId, u.team); rig.root.scale.setScalar(HERO_VIS); ring = ringFor(u.isPlayer ? '#f6c64a' : TEAM_COLOR[u.team], 1); }
  else if (u.kind === 'minion') rig = buildMinion(u.team, u.mkind);
  else if (u.kind === 'monster') rig = buildMonster(u.mkind);
  else if (u.kind === 'ward') rig = buildWard(u.team, u.control);
  else if (u.kind === 'tower') rig = buildTower(u.team);
  else rig = buildCore(u.team);
  rig.root.position.set(u.x, heightAt(u.x, u.z), u.z);
  if (u.kind === 'tower' || u.kind === 'core') rig.root.rotation.y = u.team ? Math.PI * 1.25 : Math.PI * 0.25;
  scene.add(rig.root);
  rigs.set(u.id, { rig, ring, u });
}

// 眼：小型雷達裝置（綠色螢幕、隊伍色底座），會輕輕浮動
const wardGeo = { base: new THREE.CylinderGeometry(0.32, 0.4, 0.22, 10), body: new THREE.SphereGeometry(0.34, 14, 10), screen: new THREE.CircleGeometry(0.24, 16), ant: new THREE.CylinderGeometry(0.03, 0.03, 0.4, 5) };
function buildWard(team, control) {
  const root = new THREE.Group(), bob = new THREE.Group(); root.add(bob);
  const base = new THREE.Mesh(wardGeo.base, new THREE.MeshToonMaterial({ color: TEAM_COLOR[team] })); base.position.y = 0.11; base.castShadow = true; root.add(base);
  const body = new THREE.Mesh(wardGeo.body, new THREE.MeshToonMaterial({ color: '#d8d4c8' })); body.scale.set(1, 0.7, 1); body.castShadow = true; bob.add(body);
  const screen = new THREE.Mesh(wardGeo.screen, new THREE.MeshBasicMaterial({ color: control ? '#ff7a3a' : '#5cff8a', toneMapped: false }));
  if (control) root.scale.setScalar(1.3); screen.position.set(0, 0.06, 0.33); screen.rotation.x = -0.3; bob.add(screen);
  const ant = new THREE.Mesh(wardGeo.ant, new THREE.MeshToonMaterial({ color: '#8a8a8a' })); ant.position.set(0.12, 0.38, 0); bob.add(ant);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: TEAM_LIGHT[team], transparent: true, opacity: 0.5, depthWrite: false })); ring.scale.setScalar(0.7); ring.position.y = 0.05; root.add(ring);
  let t = Math.random() * 6;
  return { root, update(dt, u) { t += dt; bob.position.y = 0.75 + Math.sin(t * 2.4) * 0.08; bob.rotation.y = t * 0.8; const pulse = 0.6 + 0.4 * Math.abs(Math.sin(t * 3)); if (control) screen.material.color.setRGB(1, 0.48 * pulse, 0.22 * pulse); else screen.material.color.setRGB(0.36 * pulse, 1, 0.54 * pulse); ring.material.opacity = 0.35 + 0.25 * Math.sin(t * 4); }, dispose() {} };
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

// 角色語音：依與鏡頭的距離衰減，玩家自己的聲音最清楚；AI 的普攻喊聲降低頻率，避免整場吵雜
function voice(h, line, chance = 1) {
  if (!h || !h.heroId || Math.random() > chance) return;
  const d = Math.hypot(h.x - cam.look.x, h.z - cam.look.z);
  if (d > 36) return;
  const me = h === G.player;
  const vol = (me ? 1 : 0.75) * Math.max(0.2, 1 - d / 36);
  audio.say(h.heroId, line, { vol, pan: Math.max(-1, Math.min(1, (h.x - cam.look.x) / 30)) * 0.6 });
}
function wireEvents() {
  G.on('cast', ({ h, k }) => voice(h, k));
  G.on('swing', ({ h, idx }) => voice(h, 'atk', (idx === 2 ? 0.85 : 0.35) * (h === G.player ? 1 : 0.5)));
  G.on('hit', ({ dst, amount, opts }) => {
    if (!dst || dst.kind !== 'hero' || !dst.alive || amount < dst.maxHp * 0.04) return;
    const heavy = opts.type === 'H' || opts.type === 'skill' || opts.type === 'super';
    voice(dst, 'hurt', heavy ? 0.6 : 0.12);
  });
  G.on('spark', (h) => voice(h, 'spark'));
  G.on('levelup', (h) => { fx.levelUp(h, '#ffe08a'); if (h === G.player) audio.play('levelUp'); });
  G.on('kibar', ({ h, bars }) => { if (h === G.player) audio.play(bars >= 5 ? 'kiFull' : 'ki', { vol: 0.6 }); });
  G.on('herodeath', ({ u }) => { sfx('heroDie', u); voice(u, 'die'); if (u === G.player) G.shake(0.8); });
  G.on('structure', ({ u }) => { fx.towerFall(u.x, u.z); sfx('towerDown', u, { vol: 1.3 }); if (dist(u, G.player) < 30) G.shake(0.9); });
  G.on('death', ({ u }) => { if (u.kind === 'minion') { sfx('minionDie', u, { vol: 0.5 }); fx.dust(u.x, u.z, 6); } });
  G.on('respawn', (h) => { if (h === G.player) { audio.play('respawn'); voice(h, 'ready'); if (!G.camFree) cam.target.set(h.x, 0, h.z); } });
  G.on('recall', ({ h, state }) => {
    if (h !== G.player) { if (state === 'done') fx.vanish(h.x, h.z, '#9fe6ff', h, true); return; }
    if (state === 'start') recallSnd = audio.play('recall');
    else { recallSnd && recallSnd.stop && recallSnd.stop(); recallSnd = null; if (state === 'done') fx.vanish(h.x, h.z, '#9fe6ff', h, true); }
  });
  G.on('charge', ({ h, on }) => { if (h === G.player && on) sfx('ki', h, { vol: 0.4 }); });
  // 龍珠獵人
  G.on('dragonSummon', () => { dragon.balls.visible = true; dragon.t = 0; sfx('kiFull', DRAGON.pit, { vol: 1.2 }); });
  G.on('shenronSpawn', (u) => {
    dragon.balls.visible = false; G.shake(1); hud.flash('#fff3c0', 0.6); sfx('thunder', u, { vol: 1.6 });
    for (let i = 0; i < 6; i++) { const a = i * 1.05; fx.lightning({ x: u.x + Math.cos(a) * 6, y: 22, z: u.z + Math.sin(a) * 6 }, { x: u.x + Math.cos(a) * 2.5, y: 0.3, z: u.z + Math.sin(a) * 2.5 }, '#ffe9a0'); }
    fx.explode(u.x, u.z, '#ffd54a', 6);
  });
  G.on('shenronBolt', ({ x, z, r, delay }) => { const h = fx.target(x, z, r, '#ffe36a', delay); G.later(delay + 0.02, () => h.remove()); });
  G.on('shenronStrike', ({ s: u, x, z, r }) => {
    fx.lightning({ x: x + 1.5, y: 18, z: z - 1.5 }, { x, y: 0.2, z }, '#fff0a0'); fx.lightning({ x: x - 1, y: 16, z: z + 1 }, { x, y: 0.2, z }, '#ffd54a');
    fx.explode(x, z, '#ffd54a', r); sfx('thunder', { x, z }, { vol: 0.9 });
    if (G.player && Math.hypot(G.player.x - x, G.player.z - z) < 14) G.shake(0.45);
  });
  G.on('dragonWish', ({ team }) => { if (team < 0) return; for (const h of G.heroes) if (h.team === team && h.alive) fx.levelUp(h, '#ffd54a'); if (team === G.player.team) { hud.flash('#ffe08a', 0.7); audio.play('victory', { vol: 0.5 }); } });
  G.on('gameover', ({ winner }) => {
    endTimer = 3.2; G.slowmo = 1.6;
    const core = G.structures.find((s) => s.kind === 'core' && s.team !== winner);
    G.camFree = true; cam.target.set(core.x, 0, core.z);
    hud.announce(winner === G.player.team ? '勝利' : '敗北', winner === G.player.team ? 'good big' : 'bad big');
    audio.play(winner === G.player.team ? 'victory' : 'defeat');
    audio.music(false);
    if (winner === G.player.team) setTimeout(() => G && voice(G.player, 'win'), 1300);
  });
}

/* ---------------- 龍珠與神龍降臨的天色 ---------------- */
const dragon = (() => {
  const balls = new THREE.Group(); balls.visible = false; scene.add(balls);
  const mat = new THREE.MeshToonMaterial({ color: '#ffa21f', emissive: '#ff7a00', emissiveIntensity: 0.7, gradientMap: toonGradient() });
  const starMat = new THREE.MeshBasicMaterial({ color: '#d4241c' });
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), mat);
    for (let k = 0; k <= i; k++) { const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), starMat); const a = (k / (i + 1)) * Math.PI * 2; st.position.set(Math.cos(a) * (i ? 0.13 : 0), Math.sin(a) * (i ? 0.13 : 0), 0.41); b.add(st); }
    balls.add(b);
  }
  const base = { hemi: R.hemi.intensity, sun: R.sun.intensity, bg: scene.background.clone(), fog: scene.fog.color.clone() };
  const dark = { bg: new THREE.Color('#2a3a3a'), fog: new THREE.Color('#3c4a44') };
  return { balls, t: 0, k: 0, update(dt) {
    this.t += dt;
    if (balls.visible) balls.children.forEach((b, i) => { const a = this.t * (1.2 + this.t * 0.5) + (i / 7) * Math.PI * 2, r = 2.6 - Math.min(1.4, this.t * 0.2); b.position.set(DRAGON.pit.x + Math.cos(a) * r, 1 + Math.min(6, this.t * 1.1), DRAGON.pit.z + Math.sin(a) * r); b.lookAt(R.camera.position); });
    const want = G && G.dball && (G.dball.phase === 'summon' || (G.shenron && G.shenron.alive)) ? 1 : 0;
    this.k += (want - this.k) * Math.min(1, dt * 0.8);
    const k = this.k;
    R.hemi.intensity = base.hemi * (1 - 0.35 * k); R.sun.intensity = base.sun * (1 - 0.5 * k);
    scene.background.copy(base.bg).lerp(dark.bg, k * 0.8); scene.fog.color.copy(base.fog).lerp(dark.fog, k * 0.7);
  }, reset() { balls.visible = false; this.k = 0; this.update(0); } };
})();

/* ---------------- 模擬一步 ---------------- */
function step(dt) { stepWorld(G, dt); }

/* ---------------- 畫面同步 ---------------- */
function sync(dt, t) {
  const PT = G.player.team;
  for (const [, r] of rigs) {
    const u = r.u, rig = r.rig;
    const gy = heightAt(u.x, u.z);
    const vis = seen(G, PT, u) || !u.alive && u.kind !== 'hero';
    if (u.kind === 'hero') {
      rig.root.position.set(u.x, gy + u.y, u.z);
      let dy = u.facing - rig.root.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      rig.root.rotation.y += dy * Math.min(1, dt * 22);
      const vanish = u.action && u.action.name === 'vanish';
      rig.root.visible = !vanish && vis;
      if (rig.setForm && r.form !== u.form) { if (r.form !== undefined && u.form === 'ssj') fx.transform(u, '#ffd23f'); r.form = u.form; rig.setForm(u.form); }
      const name = u.alive ? u.anim.name : 'dead';
      rig.update(dt, { name, t: u.alive ? u.anim.t : u.deadT, k: u.alive ? 0 : Math.min(1, u.deadT / 0.7) });
      const ssj = u.form === 'ssj';
      const aura = !u.alive ? 0 : u.charging ? 1 : u.st.spark > 0 ? 0.85 : u.action && /beam|overhead/.test(u.action.name) ? 0.9 : u.recall > 0 ? 0.5 : 0;
      const ac = u.recall > 0 ? '#9fe6ff' : ssj ? '#ffd23f' : u.def.color;
      rig.setAura(vis ? aura : 0, ac);
      if (vis && aura > 0.5 && Math.random() < dt * 30) fx.aura(u.x, gy + 1, u.z, ac, 1);
      if (vis && ssj && Math.random() < dt * 14) fx.sparks(u.x, gy + 1.2, u.z, '#fff3a0');
      r.ring.visible = u.alive && vis; r.ring.position.set(u.x, gy + 0.06, u.z);
      if (u.flash > 0 && rig.root.visible) rig.root.visible = Math.floor(t * 40) % 2 === 0 || u.flash < 0.06;
    } else if (u.kind === 'ward') {
      rig.root.position.set(u.x, gy, u.z); rig.root.visible = u.alive && vis; rig.update(dt, u);
    } else if (u.kind === 'minion' || u.kind === 'monster') {
      rig.root.position.set(u.x, gy + u.y, u.z);
      if (rig.noFace) rig.setFacing(u.facing);
      else { let dy = u.facing - rig.root.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; rig.root.rotation.y += dy * Math.min(1, dt * 14); }
      rig.root.visible = !(u.spawnDelay > 0) && vis;
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
    updateFog(G.vision.grids[P.team], rdt, G.vision.on);
    fx.update(sdt);
    dragon.update(sdt);
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
    updateFog(null, rdt, false);
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
  dragon.reset();
  audio.music(false);
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
window.__kiPlace = (h, x, z) => placeWard(G, h, x, z);
window.__kiMove = (h, x, z) => orderMove(G, h, x, z);
window.__ki = {
  audio,
  ready: true,
  get G() { return G; },
  start(id = 'goku', lane = 1, diff = 1) { startMatch(id, lane, diff); return true; },
  state() {
    if (!G) return { phase: 'select' };
    const P = G.player;
    return {
      phase: G.phase, time: +G.time.toFixed(2), winner: G.winner, kills: G.kills.slice(),
      player: { id: P.heroId, hp: Math.round(P.hp), maxHp: Math.round(P.maxHp), ki: Math.round(P.ki), level: P.level, xp: Math.round(P.xp), sp: P.sp, pos: [+P.x.toFixed(2), +P.z.toFixed(2)], alive: P.alive, ranks: { ...P.ranks }, cds: Object.fromEntries(Object.entries(P.cds).map(([k, v]) => [k, +v.toFixed(2)])), action: P.action && P.action.name, gold: Math.floor(P.gold), inv: P.inv.slice(), senzu: P.senzu || 0, form: P.form },
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
  buy(id) { return buy(G, G.player, id); },
  sell(slot) { return sell(G, G.player, slot); },
  ward(x, z) { return placeWard(G, G.player, x, z); },
  control(x, z) { return placeControl(G, G.player, x, z); },
  laneBushes(lane, team) { const p = lanePath(lane, team); return BUSHES.filter((b) => distToLane(b.x, b.z, lane) < 9.5).map((b) => ({ x: b.x, z: b.z, r: b.r, prog: laneProgress(p, b.x, b.z) })); },
  lanePoint(lane, team, prog) { const q = pointAlong(lanePath(lane, team), prog); return { x: q.x, z: q.z }; },
  wards() { return G.wards.filter((w) => w.alive).map((w) => ({ id: w.id, team: w.team, x: w.x, z: w.z })); },
  bushes() { return BUSHES.map((b) => ({ x: b.x, z: b.z, r: b.r })); },
  obstacles() { return OBSTACLES.map((o) => ({ x: o.x, z: o.z, r: o.r })); },
  walkableAt(x, z) { return walkable(x, z, 0.8); },
  inBushAt(x, z) { return bushAt(x, z) > 0; },
  visibleTo(team, id) { const u = G.units.find((o) => o.id === id); return u ? seen(G, team, u) : null; },
  count(ev) { const c = { n: 0 }; G.on(ev, () => c.n++); return () => c.n; },
  listen(ev) { window.__kiEv = window.__kiEv || {}; window.__kiEv[ev] = 0; G.on(ev, () => window.__kiEv[ev]++); },
  senzu() { return eatSenzu(G, G.player); },
  setGold(g) { G.player.gold = g; },
  visible(id) { const u = G.units.find((o) => o.id === id); return u ? seen(G, G.player.team, u) : null; },
  fog(on) { G.vision.on = on; },
  camps() { return G.camps.map((c) => ({ id: c.id, alive: c.mobs.filter((m) => m.alive).length, next: +c.next.toFixed(1) })); },
  boss() { const b = bossAlive(G); return b && { id: b.id, x: b.x, z: b.z, hp: Math.round(b.hp) }; },
  heroes() { return G.heroes.map((h) => ({ id: h.id, hero: h.heroId, team: h.team, form: h.form, gold: Math.floor(h.gold), inv: h.inv.slice(), mode: h.brain && h.brain.mode })); },
  balls(team = 0, n = 7) { giveBalls(G, team, n); return { ...G.dball }; },
  shenron() { const u = G.shenron; return u && { alive: u.alive, hp: Math.round(u.hp), maxHp: Math.round(u.maxHp), x: u.x, z: u.z, anim: u.anim.name }; },
  camera(x, z, zoom = 1) { G.camFree = true; cam.target.set(x, 0, z); cam.look.set(x, 0, z); cam.zoom = zoom; },
  follow() { G.camFree = false; },
  pick(id) { select.pick(id); },
  pause(on) { paused = on; },
  setQuality(q) { R.setQuality(q); },
  render: R,
};
