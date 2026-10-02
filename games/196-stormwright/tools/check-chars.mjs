// chars 軌道自檢：node tools/check-chars.mjs <html> [--out dir] [--only a,b]
// 以 __sw 把角色擺成陣列、強制各動畫狀態、手動推進 view.update，逐張截圖（外觀、動作、手持、滑翔、模型、淘汰、audio 結構檢查）。
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { open } from './lib.mjs';

const a = process.argv.slice(2);
const html = a.find((x) => !x.startsWith('--') && a[a.indexOf(x) - 1] !== '--out' && a[a.indexOf(x) - 1] !== '--only');
const oi = a.indexOf('--out'), outDir = resolve(oi >= 0 ? a[oi + 1] : 'dist/chars/chk');
const only = a.includes('--only') ? a[a.indexOf('--only') + 1].split(',') : null;
mkdirSync(outDir, { recursive: true });
const { browser, page, log } = await open(html, { w: 1440, h: 900 });
const checks = []; const check = (n, ok, d) => { checks.push({ n, ok: !!ok, d }); };
const want = (k) => !only || only.includes(k);

// ---- 頁面端輔助 ----
await page.evaluate(() => {
  const S = window.__sw, c = S.ctx, K = (window.__chk = {});
  const st = document.createElement('style'); st.textContent = '#hud,#menu,.overlay{display:none!important}'; document.head.appendChild(st);
  S.start(); S.skipToGround(8, 30); S.freezeBots(true);
  c.paused = true; c.cam.update = () => {};
  const gy = (x, z) => c.physics.groundHeight(x, z, 1000, 0.38).y;
  K.base = { x: c.player.pos.x, z: c.player.pos.z };
  K.park = () => { for (const a of c.actors) { a.state = 'bus'; a.view.emote = false; } };
  K.set = (i, o) => {
    const a = c.actors[i]; a.alive = true; a.state = o.state || 'ground'; a.grounded = a.state === 'ground'; a.crouching = !!o.crouch; a.sprinting = !!o.sprint; a.building = !!o.building;
    const x = K.base.x + o.x, z = K.base.z + o.z; a.pos.set(x, gy(x, z) + 0.02 + (o.h || 0), z);
    a.yaw = o.yaw ?? Math.PI; a.pitch = o.pitch || 0; a.vel.set(o.vx || 0, o.vy || 0, o.vz || 0);
    a.intent.ads = !!o.ads; a.intent.moveX = o.moveX || 0; a.action = o.action || null; a.health = 100;
    const inv = a.inventory; inv.slots = [null, null, null, null, null]; inv.selected = 0;
    if (o.weapon) { inv.slots[0] = { uid: 900 + i, defId: o.weapon[0], kind: 'weapon', rarity: o.weapon[1] ?? 2, mag: 20, count: 1 }; inv.selected = 1; }
    if (o.item) { inv.slots[0] = { uid: 900 + i, defId: o.item, kind: 'consumable', rarity: 0, mag: 0, count: 3 }; inv.selected = 1; }
    a.view.emote = !!o.emote; a.view.setVisible(true); a.view.resetAnim(); if (o.emote) a.view.emote = true;
    return a;
  };
  K.run = (i, frames = 90, fn = null) => { const a = c.actors[i]; for (let f = 0; f < frames; f++) { if (fn) fn(a, f / Math.max(1, frames - 1), f); a.view.update(1 / 60, a); } };
  K.cam = (x, y, z, tx, ty, tz, fov = 55) => {
    const g0 = gy(K.base.x, K.base.z); c.camera.position.set(K.base.x + x, g0 + y, K.base.z + z); c.camera.lookAt(K.base.x + tx, g0 + ty, K.base.z + tz); c.camera.fov = fov; c.camera.updateProjectionMatrix();
  };
  K.stats = () => S.stats();
});
const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: resolve(outDir, name + '.png') }); };
const ev = (fn, arg) => page.evaluate(fn, arg);

// ---- 1. 外觀陣容 ----
if (want('lineup')) {
  await ev(() => {
    const K = window.__chk; K.park(); K.cam(0, 1.5, 7.4, 0, 1.0, 0, 52);
    const ids = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    ids.forEach((id, k) => { K.set(id, { x: (k - 4) * 1.15, z: 0, yaw: Math.PI + (k - 4) * 0.05 }); K.run(id, 60); });
    K.cam(0, 1.5, 7.4, 0, 1.0, 0, 52);
  });
  await shot('01-lineup-front');
  await ev(() => {
    const K = window.__chk, ids = [9, 10, 11, 12, 13, 14, 15, 16, 17]; K.park(); K.cam(0, 1.5, 7.4, 0, 1.0, 0, 52);
    ids.forEach((id, k) => { K.set(id, { x: (k - 4) * 1.15, z: 0, yaw: Math.PI + (k - 4) * 0.05 }); K.run(id, 60); });
    K.cam(0, 1.5, 7.4, 0, 1.0, 0, 52);
  });
  await shot('02-lineup-front-b');
  await ev(() => {
    const K = window.__chk, ids = [18, 19, 20, 21, 22, 23, 24, 25, 26]; K.park(); K.cam(0, 1.5, 7.4, 0, 1.0, 0, 52);
    ids.forEach((id, k) => { K.set(id, { x: (k - 4) * 1.15, z: 0, yaw: 0 + (k - 4) * 0.05 }); K.run(id, 60); });
    K.cam(0, 1.5, 7.4, 0, 1.0, 0, 52);
  });
  await shot('03-lineup-back');
  // 英雄特寫：阿嵐
  await ev(() => { const K = window.__chk; K.park(); K.cam(0.2, 1.35, 3.0, 0, 1.15, 0, 40); K.set(0, { x: 0, z: 0, yaw: Math.PI + 0.5 }); K.run(0, 60); });
  await shot('04-ran-front');
  await ev(() => { const K = window.__chk; K.cam(0.2, 1.5, 3.2, 0, 1.2, 0, 40); K.set(0, { x: 0, z: 0, yaw: 0.45 }); K.run(0, 60); });
  await shot('05-ran-back');
  await ev(() => { const K = window.__chk; K.cam(0.2, 1.62, 1.3, 0, 1.62, 0, 34); K.set(0, { x: 0, z: 0, yaw: Math.PI + 0.3 }); K.run(0, 60); });
  await shot('06-ran-face');
}


const ROW = (n, gap = 1.25) => Array.from({ length: n }, (_, k) => (k - (n - 1) / 2) * gap);
// 擺一排：specs = [{...}]；ids 從 1 起；side=true 時面向 +X（相機在 +Z 看右側）
async function sheet(name, specs, { side = false, cam = [0, 1.2, 7.2, 0, 0.95, 0, 50], gap = 1.25, frames = 90 } = {}) {
  await ev(([specs, side, cam, gap, frames]) => {
    const K = window.__chk; K.park(); K.cam(...cam);
    const n = specs.length;
    specs.forEach((sp, k) => {
      const id = sp.id ?? k + 1;
      K.set(id, { x: (k - (n - 1) / 2) * gap, z: 0, yaw: side ? -Math.PI / 2 : Math.PI, ...sp });
    });
    specs.forEach((sp, k) => { const id = sp.id ?? k + 1; K.run(id, sp.frames ?? frames, sp.fn ? new Function('a', 'p', 'f', sp.fn) : null); });
    K.cam(...cam);
  }, [specs, side, cam, gap, frames]);
  await shot(name);
}
const LOCO = [
  { vx: 0 }, { vx: 4.6 }, { vx: 6 }, { vx: 6.4, sprint: true }, { crouch: true }, { crouch: true, vx: 2.6 }, { state: 'air', vy: 6, vx: 3 }, { state: 'air', vy: -9, vx: 3 },
];
if (want('loco')) {
  await sheet('10-loco-front', LOCO);
  await sheet('11-loco-side', LOCO, { side: true });
}
const GUNSPEC = (w, extra = {}) => ({ weapon: w, ...extra });
if (want('armed')) {
  const G = [GUNSPEC(['ar', 3]), GUNSPEC(['smg', 2]), GUNSPEC(['pump', 4]), GUNSPEC(['sniper', 3]), GUNSPEC(['pistol', 1]), GUNSPEC(['ar', 2], { ads: true }), GUNSPEC(['ar', 2], { vx: 6.4, sprint: true }), GUNSPEC(['ar', 4], { pitch: 0.6 })];
  await sheet('20-armed-front', G, { cam: [0, 1.2, 6.4, 0, 1.0, 0, 48] });
  await sheet('21-armed-side', G, { side: true, cam: [0, 1.2, 6.4, 0, 1.0, 0, 48] });
  await sheet('22-armed-back', G.map((g) => ({ ...g, yaw: 0 })), { cam: [0, 1.4, 6.4, 0, 1.0, 0, 48] });
}
if (want('close')) {
  const one = async (name, spec, cam, yaw) => {
    await ev(([spec, cam, yaw]) => { const K = window.__chk; K.park(); K.cam(...cam); K.set(0, { x: 0, z: 0, yaw, ...spec }); K.run(0, spec.frames ?? 90, spec.fn ? new Function('a', 'p', 'f', spec.fn) : null); K.cam(...cam); }, [spec, cam, yaw]);
    await shot(name);
  };
  await one('80-close-ar-side', { weapon: ['ar', 3] }, [0.2, 1.3, 3.0, 0, 1.15, 0, 42], -Math.PI / 2 + 0.0);
  await one('81-close-ar-34', { weapon: ['ar', 3] }, [2.2, 1.5, 2.6, 0, 1.15, 0, 42], Math.PI - 0.6);
  await one('82-close-ar-back', { weapon: ['ar', 3] }, [0.6, 1.9, 3.2, 0, 1.2, 0, 42], 0.15);
  await one('83-close-ads-back', { weapon: ['ar', 3], ads: true }, [0.9, 1.9, 3.2, 0, 1.2, 0, 42], 0.0);
  await one('84-close-pump', { weapon: ['pump', 3] }, [2.2, 1.5, 2.6, 0, 1.15, 0, 42], Math.PI - 0.6);
  await one('85-close-sniper', { weapon: ['sniper', 3] }, [0.2, 1.3, 3.0, 0, 1.15, 0, 42], -Math.PI / 2);
  await one('86-close-pistol', { weapon: ['pistol', 3] }, [2.2, 1.5, 2.6, 0, 1.15, 0, 42], Math.PI - 0.6);
  await one('87-close-pickaxe', {}, [2.2, 1.5, 2.6, 0, 1.15, 0, 42], Math.PI - 0.6);
}
if (want('reload')) {
  const R = [0.08, 0.25, 0.45, 0.62, 0.78, 0.95].map((p) => ({ weapon: ['ar', 3], action: { kind: 'reload', t: p * 2.3, duration: 2.3 }, frames: 40 }));
  await sheet('23-reload-ar', R, { side: true, cam: [0, 1.2, 5.6, 0, 1.0, 0, 46], gap: 1.1 });
  const R2 = [0.08, 0.25, 0.45, 0.62, 0.78, 0.95].map((p) => ({ weapon: ['sniper', 3], action: { kind: 'reload', t: p * 2.6, duration: 2.6 }, frames: 40 }));
  await sheet('24-reload-sniper', R2, { side: true, cam: [0, 1.2, 5.6, 0, 1.0, 0, 46], gap: 1.1 });
}
if (want('air')) {
  const A = [{ state: 'skydive', h: 3, pitch: 0.0 }, { state: 'skydive', h: 3, pitch: -1.1, vx: 0 }, { state: 'glide', h: 0.5, vx: 0 }, { state: 'glide', h: 0.5, fn: 'a.yaw += 0.03', frames: 60 }];
  await sheet('30-air-side', A, { side: true, cam: [0, 2.2, 10, 0, 1.6, 0, 55], gap: 3.2 });
  await sheet('31-air-front', A, { cam: [0, 2.4, 10, 0, 1.7, 0, 55], gap: 3.2 });
  await sheet('32-air-back', A.map((x) => ({ ...x, yaw: 0 })), { cam: [0, 2.4, 10, 0, 1.7, 0, 55], gap: 3.2 });
}
if (want('actions')) {
  await sheet('40-actions', [
    { item: 'minishield', action: { kind: 'consume', t: 1.0, duration: 2 } }, { item: 'bandage', action: { kind: 'consume', t: 1.0, duration: 3.5 } }, { building: true },
    { action: { kind: 'open', t: 0.4, duration: 1.4 } }, { emote: true }, { emote: true, fn: 'a.view.t += 0.0; a.view.t = a.view.t', frames: 150 }, { weapon: ['ar', 2] }, { weapon: ['pump', 2], fn: 'if (f === 0) a.view.hitNow = 1; if (f===59) a.view.playOneShot("hit")', frames: 64 },
  ], { cam: [0, 1.2, 6.6, 0, 1.0, 0, 48] });
  await sheet('41-actions-side', [
    { item: 'minishield', action: { kind: 'consume', t: 1.0, duration: 2 } }, { item: 'bandage', action: { kind: 'consume', t: 1.0, duration: 3.5 } }, { building: true },
    { action: { kind: 'open', t: 0.4, duration: 1.4 } }, { emote: true }, { emote: true, frames: 150 }, { emote: true, frames: 210 }, { emote: true, frames: 270 },
  ], { side: true, cam: [0, 1.2, 6.6, 0, 1.0, 0, 48] });
  // 十字鎬揮擊分格
  const sw = [0.02, 0.07, 0.12, 0.18, 0.26, 0.4].map((t) => ({ fn: `if (f === 0) a.view.playOneShot('pickaxe'); `, frames: Math.round(t * 60) + 1 }));
  await sheet('42-swing-side', sw, { side: true, cam: [0, 1.4, 5.6, 0, 1.2, 0, 46], gap: 1.1 });
  await sheet('43-swing-front', sw, { cam: [0, 1.4, 5.6, 0, 1.2, 0, 46], gap: 1.1 });
}
if (want('land')) {
  await sheet('44-land-jump', [
    { fn: 'if (f === 0) a.view.landNow(18)', frames: 4 }, { fn: 'if (f === 0) a.view.landNow(18)', frames: 8 }, { fn: 'if (f === 0) a.view.landNow(18)', frames: 14 }, { fn: 'if (f === 0) a.view.jumpNow()', frames: 5 },
    { weapon: ['ar', 2], fn: 'if (f === 0) a.view.landNow(18)', frames: 6 }, { weapon: ['ar', 2], fn: 'if (f === 59) a.view.kickNow()', frames: 61 },
  ], { side: true, cam: [0, 1.2, 5.6, 0, 1.0, 0, 46], gap: 1.1 });
}
if (want('models')) {
  await ev(() => {
    const K = window.__chk, c = window.__sw.ctx; K.park();
    K.models = new c.THREE.Group(); c.scene.add(K.models);
    const gy = c.physics.groundHeight(K.base.x, K.base.z, 1000, 0.38).y;
    const W = ['ar', 'smg', 'pump', 'sniper', 'pistol'], R = [0, 1, 2, 3, 4];
    W.forEach((w, i) => R.forEach((r, j) => { if (j > 3 && w === 'pistol') return; const m = c.characters.weaponModel(w, r); m.position.set(K.base.x + (i - 2) * 1.5, gy + 2.3 - j * 0.45, K.base.z); m.rotation.y = Math.PI / 2 - 0.5; m.scale.setScalar(1.3); K.models.add(m); }));
    K.cam(0, 1.6, 6.0, 0, 1.1, 0, 52);
  });
  await shot('50-weapons');
  await ev(() => {
    const K = window.__chk, c = window.__sw.ctx; c.scene.remove(K.models); K.models = new c.THREE.Group(); c.scene.add(K.models);
    const gy = c.physics.groundHeight(K.base.x, K.base.z, 1000, 0.38).y;
    ['ar', 'smg', 'pump', 'sniper', 'pistol', 'pickaxe'].forEach((w, i) => { const m = c.characters.weaponModel(w, 3); m.position.set(K.base.x + 0.0, gy + 2.4 - i * 0.55, K.base.z); m.rotation.y = Math.PI / 2 - 0.35; m.scale.setScalar(1.6); K.models.add(m); });
    K.cam(0, 1.5, 3.2, 0, 1.45, 0, 50);
  });
  await shot('50b-weapons-large');
  await ev(() => {
    const K = window.__chk, c = window.__sw.ctx; c.scene.remove(K.models); K.models = new c.THREE.Group(); c.scene.add(K.models);
    const gy = c.physics.groundHeight(K.base.x, K.base.z, 1000, 0.38).y;
    const I = ['bandage', 'medkit', 'minishield', 'shield', 'ammo_light', 'ammo_medium', 'ammo_heavy', 'ammo_shells', 'mat_wood', 'mat_stone', 'mat_metal'];
    I.forEach((id, i) => { const m = c.characters.itemModel(id, 2); m.position.set(K.base.x + ((i % 6) - 2.5) * 0.7, gy + 1.9 - Math.floor(i / 6) * 0.9, K.base.z); m.scale.setScalar(2.0); m.rotation.y = -0.5; K.models.add(m); });
    const p = c.characters.pickaxe(); p.position.set(K.base.x + 1.6, gy + 0.9, K.base.z); p.rotation.y = Math.PI / 2 - 0.5; p.scale.setScalar(1.5); K.models.add(p);
    K.cam(0, 1.55, 4.0, 0, 1.45, 0, 52);
  });
  await shot('51-items');
  await ev(() => { const K = window.__chk, c = window.__sw.ctx; c.scene.remove(K.models); K.models = null; });
}
if (want('glider')) {
  await ev(() => {
    const K = window.__chk, c = window.__sw.ctx; K.park();
    const g = c.characters.glider(); const gy = c.physics.groundHeight(K.base.x, K.base.z, 1000, 0.38).y;
    K.models = new c.THREE.Group(); g.position.set(K.base.x, gy + 2, K.base.z); K.models.add(g); c.scene.add(K.models);
    K.cam(2.8, 3.0, 4.5, 0, 2.6, 0, 50);
  });
  await shot('52-glider-model');
  await ev(() => { const K = window.__chk, c = window.__sw.ctx; c.scene.remove(K.models); K.models = null; });
}
if (want('elim')) {
  for (const [nm, t] of [['a', 0], ['b', 0.25], ['c', 0.6], ['d', 1.0]]) {
    await ev(([t]) => {
      const K = window.__chk, c = window.__sw.ctx; K.park(); K.cam(0, 1.3, 6.6, 0, 1.1, 0, 50);
      const ids = [1, 2, 3, 4, 5, 6];
      ids.forEach((id, k) => { const a = K.set(id, { x: (k - 2.5) * 1.3, z: 0, weapon: k % 2 ? ['ar', 3] : null, vx: k === 2 ? 5 : 0 }); K.run(id, 40); });
      ids.forEach((id) => { const a = c.actors[id]; a.view.eliminate(); a.alive = false; a.state = 'dead'; });
      const n = Math.round(t / (1 / 60)); for (let f = 0; f < n; f++) ids.forEach((id) => c.actors[id].view.update(1 / 60, c.actors[id]));
      K.cam(0, 1.3, 6.6, 0, 1.1, 0, 50);
    }, [t]);
    await shot('60-eliminate-' + nm);
  }
}
if (want('perf')) {
  await ev(() => {
    const K = window.__chk; K.park(); K.cam(0, 4, 9, 0, 1.2, -2, 62);
    for (let id = 0; id < 30; id++) { const k = id % 10, r = Math.floor(id / 10); K.set(id, { x: (k - 4.5) * 1.6, z: -r * 2.2, weapon: id % 3 ? ['ar', 2] : null, vx: id % 4 === 0 ? 4.6 : 0 }); K.run(id, 20); }
    K.cam(0, 4, 9, 0, 1.2, -2, 62);
  });
  await shot('70-crowd');
  const st = await ev(() => { const S = window.__sw; return S.stats(); });
  check('30 角色同框 drawCalls', st.drawCalls <= 350, st);
}

if (want('audio')) {
  await page.mouse.click(700, 400); await page.waitForTimeout(300);
  const names = await ev(async () => {
    const S = window.__sw, c = S.ctx, A = c.audio;
    window.__chk.park(); window.__chk.cam(0, 1.6, 4, 0, 1.2, 0, 55);
    const st = { init: !!A.ac, state: A.ac && A.ac.state };
    if (!A.ac) return { st };
    A.debugTap();
    const NAMES = ['shot_ar', 'shot_smg', 'shot_pump', 'shot_sniper', 'shot_pistol', 'hit', 'hit_shield', 'headshot', 'kill', 'hurt', 'shield_hit', 'shield_break', 'fall_hurt', 'storm_zap', 'impact', 'whiz', 'eliminate', 'digitize', 'death',
      'pickup', 'pickup_ammo', 'reload', 'empty', 'heal', 'shield_heal', 'bandage', 'drink', 'chest', 'weakpoint', 'harvest_wood', 'harvest_stone', 'harvest_metal', 'swing', 'build', 'build_wood', 'build_stone', 'build_metal', 'break', 'break_wood', 'break_stone', 'break_metal',
      'jump', 'land', 'dive', 'glider_open', 'storm_warn', 'bus_horn', 'win', 'lose', 'ui', 'ui_click', 'ui_hover', 'ui_confirm', 'error', 'countdown', 'footstep_grass', 'footstep_wood', 'footstep_stone', 'footstep_metal', 'footstep_sand', 'footstep_water', 'footstep_path'];
    const res = {};
    for (const n of NAMES) {
      A.play(n, {}); let pk = 0;
      for (let k = 0; k < 6; k++) { await new Promise((r) => setTimeout(r, 40)); pk = Math.max(pk, A.debugPeak()); }
      res[n] = +pk.toFixed(3); await new Promise((r) => setTimeout(r, 120));
    }
    return { st, res };
  });
  const silent = Object.entries(names.res || {}).filter(([, v]) => v < 0.002).map(([k]) => k);
  check('音效建立 AudioContext', names.st.init && names.st.state === 'running', names.st);
  check('全部命名音效皆有輸出', silent.length === 0, silent);
  console.log('AUDIO PEAKS', JSON.stringify(names.res));
  // 事件驅動 + 持續音
  const evr = await ev(async () => {
    const S = window.__sw, c = S.ctx, A = c.audio, E = c.events, P = c.player, out = {};
    const pk = async (ms = 250) => { let m = 0; const t0 = performance.now(); while (performance.now() - t0 < ms) { await new Promise((r) => setTimeout(r, 25)); m = Math.max(m, A.debugPeak()); } return +m.toFixed(3); };
    c.paused = false;
    const v = new c.THREE.Vector3(P.pos.x + 15, P.pos.y + 1.5, P.pos.z + 3);
    E.emit('shot', { actor: c.actors[3], weapon: 'ar', from: v, to: new c.THREE.Vector3(P.pos.x + 1, P.pos.y + 1.5, P.pos.z), hit: null }); out.shotFar = await pk();
    E.emit('shot', { actor: P, weapon: 'sniper', from: P.pos, to: v, hit: null }); out.shotOwn = await pk(500);
    E.emit('damage', { target: c.actors[3], source: P, amount: 20, shieldDamage: 20, healthDamage: 0, headshot: false, point: v, weapon: 'ar' }); out.hitShield = await pk();
    E.emit('damage', { target: c.actors[3], source: P, amount: 20, shieldDamage: 0, healthDamage: 20, headshot: true, point: v, weapon: 'ar' }); out.headshot = await pk();
    E.emit('buildPlaced', { actor: P, piece: { mat: 'metal', center: v } }); out.build = await pk();
    E.emit('eliminated', { victim: c.actors[3], killer: P, weapon: 'ar', headshot: false }); out.elim = await pk(500);
    E.emit('chestOpen', { actor: P, chest: { x: v.x, y: v.y, z: v.z } }); out.chest = await pk(600);
    P.state = 'skydive'; P.vel.set(5, -50, 5); await new Promise((r) => setTimeout(r, 600)); out.windSky = await pk(300);
    P.state = 'glide'; P.vel.set(10, -6, 10); await new Promise((r) => setTimeout(r, 600)); out.windGlide = await pk(300);
    P.state = 'ground'; P.vel.set(0, 0, 0);
    // 風暴嗡鳴
    c.storm.active = true; const sx = c.storm.center.x + c.storm.radius + 30, sz = c.storm.center.y; P.pos.x = sx; P.pos.z = sz; P.state = 'ground'; await new Promise((r) => setTimeout(r, 900)); out.stormHum = await pk(300);
    // 腳步：奔跑
    P.pos.x = 8; P.pos.z = 30; c.storm.active = false; await new Promise((r) => setTimeout(r, 400));
    out.loopGainStorm = A.loops.storm.g.gain.value;
    return out;
  });
  console.log('AUDIO EVENTS', JSON.stringify(evr));
  check('事件音效（遠槍／近狙／命中／淘汰／寶箱）', evr.shotFar > 0.002 && evr.shotOwn > 0.01 && evr.hitShield > 0.002 && evr.headshot > 0.002 && evr.elim > 0.002 && evr.chest > 0.002, evr);
  check('風聲／風暴嗡鳴持續音', evr.windSky > 0.002 && evr.windGlide > 0.002 && evr.stormHum > 0.002, evr);
}

if (want('game')) {
  // 真實遊戲鏡頭（肩後第三人稱）：持各種武器、ADS、衝刺、蹲、滑翔
  await ev(() => { const S = window.__sw, c = S.ctx; c.paused = false; delete c.cam.update; c.cam.update = Object.getPrototypeOf(c.cam).update; S.start(); S.skipToGround(8, 30); S.freezeBots(true); S.give('ar', 3); S.look(0.4, 0.05); const b = S.spawnBotNear(14); S.aimAt(b); });
  await page.waitForTimeout(500);
  await shot('90-game-ar');
  await ev(() => { const S = window.__sw; S.give('pump', 4); S.look(0.4, 0.2); });
  await page.waitForTimeout(500); await shot('91-game-pump-up');
  await ev(() => { const S = window.__sw; S.give('sniper', 3); S.press({ ads: true }); });
  await page.waitForTimeout(600); await shot('92-game-sniper-ads');
  await ev(() => { const S = window.__sw; S.give('ar', 3); S.press({ moveZ: 1, sprint: true }); S.look(0.4, 0); });
  await page.waitForTimeout(900); await shot('93-game-sprint');
  await ev(() => { const S = window.__sw; S.press({ moveZ: 1, crouch: true }); });
  await page.waitForTimeout(700); await shot('94-game-crouch');
  await ev(() => { const S = window.__sw; S.press(null); S.give('ar', 3); S.press({ fire: true }); });
  await page.waitForTimeout(220); await shot('95-game-fire');
  await ev(() => { const S = window.__sw; S.press(null); });
  await ev(() => { const S = window.__sw, c = S.ctx, p = c.player; S.press(null); p.state = 'glide'; p.pos.y += 40; p.vel.set(-6, -6, -14); p.grounded = false; });
  await page.waitForTimeout(900); await shot('96-game-glide');
  await ev(() => { const S = window.__sw, c = S.ctx, p = c.player; p.state = 'skydive'; p.pos.y += 120; p.vel.set(-6, -50, -14); p.intent.deploy = false; });
  await page.waitForTimeout(500); await shot('97-game-skydive');
  await ev(() => { const S = window.__sw, c = S.ctx; c.player.state = 'ground'; S.teleport(8, 30); S.give('minishield'); S.ctx.player.health = 60; S.press({ fire: true }); });
  await page.waitForTimeout(900); await shot('98-game-drink');
  await ev(() => { const S = window.__sw; S.press(null); });
}

if (want('faces')) {
  // 髮型 × 衣服 × 配件展示：重建指定外觀的 view
  await ev(() => {
    const K = window.__chk, c = window.__sw.ctx; K.park();
    const base = { skin: '#f5be94', hair: '#5a3a22', top: '#ff7a1a', bottom: '#2a3552', accent: '#14c8b4', accent2: '#ffd23d', shoe: '#f4f4f4', sole: '#ff7a1a', eye: '#3a2a1a', goggles: 0, shades: false, scarf: false, mask: false, back: 0, pants: 'long', gloves: false, brow: 1, mouth: 0, hat: 0, glider: ['#ff7a2a', '#ffffff', '#18c9b0'] };
    const skins = ['#ffd8b8', '#f5be94', '#e2a173', '#c68059', '#9a5c3d', '#6b3e28', '#ffe3cf', '#f9c9a8', '#e2a173'];
    const hairs = ['#2a1b12', '#5a3a22', '#d8a43a', '#c4412f', '#ff6fa8', '#2ec4b6', '#7a5cff', '#e8e8f0', '#ff8a1f'];
    const tops = ['#ff4f6d', '#3d9bff', '#ffd23d', '#2fd0b0', '#8a5cff', '#ff8f3a', '#7bd83a', '#ff6fa8', '#f2f2f2'];
    for (let i = 0; i < 9; i++) {
      const a = c.actors[i + 1];
      a.outfit = { ...base, hairStyle: i, outfitType: i % 4, skin: skins[i], hair: hairs[i], top: tops[i], goggles: i === 1 ? 1 : i === 3 ? 2 : 0, shades: i === 4, mask: i === 7, scarf: i === 2 || i === 6, back: i % 6, mouth: i % 3, brow: i % 3, pants: i === 5 ? 'shorts' : 'long', gloves: i === 8 };
      a.view.dispose(); a.view = c.characters.create(a);
    }
    K.cam(0, 1.62, 5.4, 0, 1.45, 0, 34);
    for (let i = 0; i < 9; i++) { K.set(i + 1, { x: (i - 4) * 0.62, z: 0, yaw: Math.PI + (i - 4) * 0.08 }); K.run(i + 1, 40); }
  });
  await shot('95-faces-front');
  await ev(() => { const K = window.__chk; K.cam(0, 1.62, 5.4, 0, 1.45, 0, 34); for (let i = 0; i < 9; i++) { K.set(i + 1, { x: (i - 4) * 0.62, z: 0, yaw: -(i - 4) * 0.08 }); K.run(i + 1, 40); } });
  await shot('96-faces-back');
  await ev(() => { const K = window.__chk; K.cam(0, 1.0, 7.0, 0, 0.95, 0, 40); for (let i = 0; i < 9; i++) { K.set(i + 1, { x: (i - 4) * 0.8, z: 0, yaw: Math.PI + (i - 4) * 0.08 }); K.run(i + 1, 40); } });
  await shot('97-faces-body');
}

if (want('muzzle')) {
  const r = await ev(() => {
    const K = window.__chk, c = window.__sw.ctx, T = c.THREE; K.park(); K.cam(0, 1.6, 6, 0, 1.2, 0, 50);
    const out = [];
    for (const [w, yaw, pitch] of [['ar', 0.3, 0], ['smg', 1.4, 0.5], ['pump', -2.0, -0.4], ['sniper', 3.0, 0.9], ['pistol', 0.0, -0.8]]) {
      const a = K.set(1, { x: 0, z: 0, yaw, pitch, weapon: [w, 2], vx: 3 }); K.run(1, 60);
      const m = a.view.muzzleWorld(new T.Vector3()), g = new T.Vector3(); a.view.gunPivot.getWorldPosition(g);
      const dir = a.forward(new T.Vector3()), d = m.clone().sub(g), cos = d.normalize().dot(dir);
      const eye = a.eyePos(new T.Vector3()); out.push({ w, cos: +cos.toFixed(3), muzzleToEye: +m.distanceTo(eye).toFixed(2), fwd: +m.clone().sub(eye).dot(dir).toFixed(2) });
    }
    return out;
  });
  check('槍口位置：沿瞄準方向、在身前', r.every((x) => x.cos > 0.97 && x.fwd > 0.1 && x.muzzleToEye < 1.6), r);
}

if (want('loot')) {
  await ev(() => { const S = window.__sw, c = S.ctx; S.start(); S.skipToGround(8, 30); S.freezeBots(true); c.paused = false; delete c.cam.update; S.look(0.2, 0.1); S.dropItem('sniper', 3, 3.5); S.dropItem('pump', 2, 5.2); S.dropItem('ar', 4, 6.9); S.dropItem('pistol', 1, 8.6); S.dropItem('bandage', 0, 10.3); });
  await page.waitForTimeout(700); await shot('99-floor-loot');
}
console.log(JSON.stringify({ checks, pageerrors: log.pageerrors, errors: log.errors, external: log.external }, null, 1));
await browser.close();
