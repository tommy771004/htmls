// 輸入：滑鼠鍵盤（右鍵移動／攻擊、QWER 朝游標施放）與觸控（搖桿、自動瞄準技能鍵）。
import { orderMove, orderAttack, orderStop, cast, levelSkill, startRecall, setCharging, spark, placeWard, placeControl } from './combat.js';
import { BUSHES } from './map.js';
import { targetable, dist } from './units.js';
import { seen } from './vision.js';
import { eatSenzu } from './items.js';
import { useActive } from './traits.js';
import { castSummoner, swapSummoner } from './summoners.js';

export function createInput({ G, render, minimap, hud, audio, onHelp, onCamToggle, onShop, isPaused }) {
  const canvas = document.getElementById('gl');
  const mouse = { x: innerWidth / 2, y: innerHeight / 2, world: { x: 0, z: 0 }, held: false, inside: false };
  let holdT = 0, panning = { x: 0, z: 0 };
  const P = () => G.player;
  // 說明畫面暫停時不接受操作（否則按 Q／1／P 仍會施法、吃仙豆、開商店）
  const inMatch = () => G.phase === 'play' && P();
  const live = () => inMatch() && !(isPaused && isPaused());

  function pickUnit(wx, wz) {
    let best = null, bd = 1e9;
    for (const u of G.units) {
      if (!u.alive || u.team === P().team || !targetable(G, u) || !seen(G, P().team, u)) continue;
      const d = Math.hypot(u.x - wx, u.z - wz) - u.radius * (u.kind === 'tower' || u.kind === 'core' ? 0.9 : 1.6);
      if (d < 1.0 && d < bd) { bd = d; best = u; }
    }
    return best;
  }
  function command(sx, sy, marker = true) {
    const w = render.groundAt(sx, sy); if (!w) return;
    const u = pickUnit(w.x, w.z);
    if (u) { orderAttack(G, P(), u); if (marker) G.fx.clickMarker(u.x, u.z, true); }
    else { orderMove(G, P(), w.x, w.z); if (marker) G.fx.clickMarker(w.x, w.z, false); }
  }
  function updateWorld() { const w = render.groundAt(mouse.x, mouse.y); if (w) mouse.world = w; }

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    audio.resume();
    if (e.pointerType === 'touch') return touchDown(e);
    if (!live()) return;
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.held = true; holdT = 0;
    command(e.clientX, e.clientY);
  });
  addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true; });
  addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') mouse.held = false; });
  document.addEventListener('mouseleave', () => { mouse.inside = false; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); render.cam.zoom = Math.max(0.72, Math.min(1.3, render.cam.zoom * (e.deltaY > 0 ? 1.06 : 0.94))); }, { passive: false });

  // 小地圖
  const mm = document.getElementById('minimap');
  mm.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation(); if (!live()) return;
    const r = mm.getBoundingClientRect(), w = minimap.toWorld(e.clientX - r.left, e.clientY - r.top);
    if (e.button === 2 || e.pointerType === 'touch') { orderMove(G, P(), w.x, w.z); G.fx.clickMarker(w.x, w.z, false); }
    else { G.camFree = true; render.cam.target.set(w.x, 0, w.z); onCamToggle && onCamToggle(true); }
  });
  mm.addEventListener('contextmenu', (e) => e.preventDefault());

  const KEYMAP = { KeyQ: 'Q', KeyW: 'W', KeyE: 'E', KeyR: 'R' };
  addEventListener('keydown', (e) => {
    audio.resume();
    if (e.target && e.target.tagName === 'INPUT') { if (e.code === 'Escape') e.target.blur(); return; } // 商店搜尋框打字時不觸發快捷鍵
    if (e.code === 'KeyH' || e.code === 'F1' || (e.code === 'Escape' && G.phase === 'play')) { e.preventDefault(); onHelp(); return; }
    if (!live() || e.repeat && e.code !== 'KeyC') return;
    const k = KEYMAP[e.code];
    if (k) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || e.altKey) { levelSkill(G, P(), k); return; }
      updateWorld();
      if (!cast(G, P(), k, mouse.world.x, mouse.world.z)) hud.el.skills[k].d.classList.add('deny'), setTimeout(() => hud.el.skills[k].d.classList.remove('deny'), 180);
      return;
    }
    if (e.code === 'KeyP') { onShop && onShop(); return; }
    if (e.code === 'Digit1') { eatSenzu(G, P()); return; }
    if (e.code === 'Digit2' || e.code === 'Digit3') { useActive(G, P(), e.code === 'Digit2' ? 0 : 1); return; }
    if (e.code === 'Digit4') { updateWorld(); placeWard(G, P(), mouse.world.x, mouse.world.z); return; }
    if (e.code === 'Digit5') { updateWorld(); placeControl(G, P(), mouse.world.x, mouse.world.z); return; }
    if (e.code === 'KeyF' && e.shiftKey) { swapSummoner(G, P()); return; } // 萬能卷軸：換召喚師技能
    if (e.code === 'KeyF') { updateWorld(); castSummoner(G, P(), mouse.world.x, mouse.world.z); return; }
    if (e.code === 'KeyD') spark(G, P());
    else if (e.code === 'KeyB') startRecall(G, P());
    else if (e.code === 'KeyC') setCharging(G, P(), true);
    else if (e.code === 'KeyS') orderStop(G, P());
    else if (e.code === 'KeyY') { G.camFree = !G.camFree; onCamToggle && onCamToggle(G.camFree); }
    else if (e.code === 'Space') { e.preventDefault(); G.camFree = false; onCamToggle && onCamToggle(false); }
    else if (e.code === 'KeyM') { const m = audio.toggleMute(), b = document.getElementById('muteBtn'); if (b) b.classList.toggle('off', m); }
  });
  addEventListener('keyup', (e) => { if (e.code === 'KeyC' && inMatch()) setCharging(G, P(), false); });

  // 技能列點擊（滑鼠＋觸控共用）
  for (const k of ['Q', 'W', 'E', 'R', 'D', 'B']) {
    const s = hud.el.skills[k];
    s.face.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation(); audio.resume(); if (!live()) return;
      if (k === 'D') return spark(G, P());
      if (k === 'B') return startRecall(G, P());
      const t = autoAim(k);
      if (!cast(G, P(), k, t.x, t.z)) { s.d.classList.add('deny'); setTimeout(() => s.d.classList.remove('deny'), 180); }
    });
    if (s.plus) s.plus.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (live()) levelSkill(G, P(), k); });
  }
  // 自動瞄準：射程內最近的敵方英雄，其次任何敵人，否則朝面向
  function autoAim(k) {
    const h = P(), r = h.def.skills[k].range * 1.1;
    if (mouse.inside && matchMedia('(pointer: fine)').matches) { updateWorld(); return mouse.world; }
    let best = null, bd = 1e9;
    for (const u of G.units) {
      if (!u.alive || u.team === h.team || !targetable(G, u) || !seen(G, h.team, u)) continue;
      const d = dist(u, h) - (u.kind === 'hero' ? 6 : 0);
      if (dist(u, h) < r + 2 && d < bd) { bd = d; best = u; }
    }
    if (best) return { x: best.x, z: best.z };
    return { x: h.x + Math.sin(h.facing) * 6, z: h.z + Math.cos(h.facing) * 6 };
  }

  // 眼的格子：滑鼠在場上就插在游標處，觸控則插在最近的草叢（沒有就插在面前）
  hud.el.ward.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation(); if (!live()) return;
    const h = P();
    if (e.pointerType !== 'touch' && mouse.inside) { updateWorld(); }
    let b = null, bd = 9; for (const k of BUSHES) { const d = Math.hypot(k.x - h.x, k.z - h.z); if (d < bd) { bd = d; b = k; } }
    const t = b || { x: h.x + Math.sin(h.facing) * 5, z: h.z + Math.cos(h.facing) * 5 };
    placeWard(G, h, t.x, t.z);
  });

  hud.el.control.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation(); if (!live()) return;
    const h = P(); let b = null, bd = 9; for (const k of BUSHES) { const d = Math.hypot(k.x - h.x, k.z - h.z); if (d < bd) { bd = d; b = k; } }
    if (e.pointerType !== 'touch' && mouse.inside) { updateWorld(); b = mouse.world; }
    const t = b || { x: h.x + Math.sin(h.facing) * 5, z: h.z + Math.cos(h.facing) * 5 };
    placeControl(G, h, t.x, t.z);
  });

  /* ---------- 觸控 ---------- */
  const stick = document.getElementById('stick'), knob = stick.querySelector('i');
  let stickId = null, stickO = null, stickV = null, stickT = 0;
  stick.addEventListener('pointerdown', (e) => {
    e.preventDefault(); audio.resume(); stickId = e.pointerId; stick.setPointerCapture(e.pointerId);
    const r = stick.getBoundingClientRect(); stickO = { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; moveStick(e);
  });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) moveStick(e); });
  const endStick = (e) => { if (e.pointerId !== stickId) return; stickId = null; stickV = null; knob.style.transform = ''; if (inMatch() && P().goal) orderStop(G, P()); };
  stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);
  function moveStick(e) {
    let dx = e.clientX - stickO.x, dy = e.clientY - stickO.y; const d = Math.hypot(dx, dy), m = stickO.r * 0.8;
    if (d > m) { dx *= m / d; dy *= m / d; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    stickV = d > 8 ? { x: dx / m, y: dy / m } : null;
  }
  const atk = document.getElementById('tAtk');
  atk.addEventListener('pointerdown', (e) => {
    e.preventDefault(); audio.resume(); if (!live()) return;
    const h = P(); let best = null, bd = 1e9;
    for (const u of G.units) {
      if (!u.alive || u.team === h.team || !targetable(G, u) || !seen(G, h.team, u)) continue;
      const d = dist(u, h); if (d > h.range + 7) continue;
      const sc = d - (u.kind === 'hero' ? 4 : 0) + (u.kind === 'tower' || u.kind === 'core' ? 2 : 0);
      if (sc < bd) { bd = sc; best = u; }
    }
    if (best) orderAttack(G, h, best);
  });
  const chg = document.getElementById('tChg');
  chg.addEventListener('pointerdown', (e) => { e.preventDefault(); if (live()) setCharging(G, P(), true); });
  const chgUp = () => { if (inMatch()) setCharging(G, P(), false); };
  chg.addEventListener('pointerup', chgUp); chg.addEventListener('pointercancel', chgUp); chg.addEventListener('pointerleave', chgUp);
  function touchDown(e) { if (!live()) return; command(e.clientX, e.clientY); }

  function update(dt) {
    if (!live()) return;
    const h = P();
    // 按住滑鼠持續移動
    if (mouse.held) { holdT += dt; if (holdT > 0.18 && !h.target) { const w = render.groundAt(mouse.x, mouse.y); if (w) orderMove(G, h, w.x, w.z); } }
    // 搖桿：鏡頭由南往北看，螢幕上 = 世界 -z
    if (stickV) { stickT -= dt; if (stickT <= 0) { stickT = 0.08; orderMove(G, h, h.x + stickV.x * 4, h.z + stickV.y * 4); } }
    // 自由鏡頭：邊緣捲動
    if (G.camFree && mouse.inside && matchMedia('(pointer: fine)').matches) {
      const [W, H] = render.size, e = 18, sp = 40 * dt;
      if (mouse.x < e) render.cam.target.x -= sp; if (mouse.x > W - e) render.cam.target.x += sp;
      if (mouse.y < e) render.cam.target.z -= sp; if (mouse.y > H - e) render.cam.target.z += sp;
      render.cam.target.x = Math.max(-90, Math.min(90, render.cam.target.x)); render.cam.target.z = Math.max(-90, Math.min(90, render.cam.target.z));
    }
  }
  return { update, mouse, updateWorld };
}
