// 六器鏢行 — 主程式入口、輸入事件與測試介面 window.__sf

import { createGameWorld } from './core/world_sim.js';
import { MAPS } from './core/data.js';
import { createEscortScene } from './view/scene.js';
import { createEscortSfx } from './ui/sfx.js';
import { createEscortHud } from './ui/hud.js';
import { clearSavedState } from './core/proto.js';

const params = new URLSearchParams(location.search);
const forceWebGL = params.get('gfx') === 'webgl';

const canvas = document.getElementById('glCanvas');
const fresh = params.get('fresh') === '1';
const world = createGameWorld({ restoreSave: !fresh, persist: !fresh });
const sfx = createEscortSfx();
const sceneView = await createEscortScene(canvas, world, { forceWebGL });
const hud = createEscortHud(world, sceneView, sfx);

sceneView.resize(window.innerWidth, window.innerHeight);
window.addEventListener('resize', () => {
  sceneView.resize(window.innerWidth, window.innerHeight);
  hud.applyHudMode();
});

// 鍵盤操作狀態
const keys = new Set();

const DRAWER_KEYS = { KeyC: 'char', KeyK: 'martial', KeyU: 'forge', KeyT: 'mech', KeyB: 'market', KeyG: 'worldmap', KeyJ: 'bounty', KeyH: 'handoff' };

window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) {
    if (e.code === 'Enter' && e.target.id === 'inpHeroName' && hud.isIntroOpen()) hud.startGame();
    if (e.code === 'Escape' && hud.isDrawerOpen() && !e.isComposing) { e.target.blur(); hud.closeDrawer(); }
    return;
  }

  if (hud.isIntroOpen()) {
    if (e.code === 'Enter') hud.startGame();
    return;
  }

  // 抽屜開著：只收 Esc 與抽屜熱鍵，不走路、不出招、不服藥
  if (hud.isDrawerOpen()) {
    if (e.code === 'Escape') hud.closeDrawer();
    else if (DRAWER_KEYS[e.code]) hud.openDrawer(DRAWER_KEYS[e.code]);
    return;
  }
  keys.add(e.code);

  // 數字鍵 1～6：匣中取器（切兵器＋出招同一封包）；7～9：內功；上機後 1、2 是偃甲專屬技
  if (e.code >= 'Digit1' && e.code <= 'Digit9') {
    const sid = hud.slotSkill(Number(e.code.slice(5)) - 1);
    if (sid) {
      sfx.unlock();
      world.castLinkedSkill(sid);
    }
    return;
  }

  switch (e.code) {
    case 'Space':
      e.preventDefault();
      sfx.unlock();
      world.castQinggongDash(0, 0);
      break;
    case 'KeyQ':
      if (world.useSmartPotion('HP_RED', false)?.ok) sfx.playPotion();
      break;
    case 'KeyE':
      if (world.useSmartPotion('SHIELD_CYAN', false)?.ok) sfx.playPotion();
      break;
    case 'KeyR':
      if (world.useSmartPotion('CLEANSE_PILL', false)?.ok) sfx.playPotion();
      break;
    case 'KeyV':
      world.toggleMechSummon();
      break;
    case 'KeyZ':
      world.char.autoHunt = !world.char.autoHunt;
      break;
    case 'KeyF':
      world.igniteNearestBeacon();
      break;
    case 'KeyM':
      hud.setMuted(sfx.toggleMute());
      break;
    default:
      if (DRAWER_KEYS[e.code]) { keys.clear(); hud.openDrawer(DRAWER_KEYS[e.code]); }
      break;
  }
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});
// 切視窗或分頁時會漏掉 keyup：一律清掉按住的鍵與拖曳，免得角色自己一直走
function releaseAllInput() {
  keys.clear();
  dragPointer = null;
}
window.addEventListener('blur', releaseAllInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAllInput(); });

// 滑鼠／單指點擊地面移動或鎖定目標，右鍵／拖曳旋轉視角
let dragPointer = null;
let clickTargetPos = null;

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  if (hud.isIntroOpen() || hud.isDrawerOpen()) return;
  sfx.unlock();
  dragPointer = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false, button: e.button };
});
window.addEventListener('pointermove', (e) => {
  if (!dragPointer || e.pointerId !== dragPointer.id) return;
  const dx = e.clientX - dragPointer.x;
  const dy = e.clientY - dragPointer.y;
  dragPointer.x = e.clientX;
  dragPointer.y = e.clientY;
  if (Math.hypot(e.clientX - dragPointer.startX, e.clientY - dragPointer.startY) > 6) {
    dragPointer.moved = true;
    sceneView.orbitBy(-dx * 0.0065, dy * 0.0045);
  }
});
window.addEventListener('pointerup', (e) => {
  if (!dragPointer || e.pointerId !== dragPointer.id) return;
  const wasClick = !dragPointer.moved && dragPointer.button === 0;
  dragPointer = null;
  if (!wasClick) return;
  const pick = sceneView.pickGroundOrEntity(e.clientX, e.clientY, canvas.getBoundingClientRect());
  if (!pick) return;
  if (pick.type === 'ENTITY') {
    world.char.lockedTargetId = pick.entityId;
    clickTargetPos = null;
  } else if (pick.type === 'GROUND') {
    clickTargetPos = { x: pick.x, z: pick.z };
  }
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  sceneView.zoomBy(e.deltaY * 0.01);
}, { passive: false });

function computeMoveVector() {
  let lx = 0, lz = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) lx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) lx += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) lz -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) lz += 1;

  if (lx !== 0 || lz !== 0) {
    clickTargetPos = null;
    const yaw = sceneView.getCameraAngles().camYaw;
    return {
      moveX: lx * Math.cos(yaw) + lz * Math.sin(yaw),
      moveZ: -lx * Math.sin(yaw) + lz * Math.cos(yaw),
    };
  }

  const joy = hud.getJoyVector();
  if (Math.hypot(joy.x, joy.z) > 0.04) {
    clickTargetPos = null;
    return { moveX: joy.x, moveZ: joy.z };
  }

  if (clickTargetPos) {
    const dx = clickTargetPos.x - world.char.x;
    const dz = clickTargetPos.z - world.char.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.45) {
      clickTargetPos = null;
    } else {
      return { moveX: dx / dist, moveZ: dz / dist };
    }
  }
  return { moveX: 0, moveZ: 0 };
}

// 傳送陣碰撞偵測（走入光柱自動切換地圖，附冷卻防來回彈跳）
let portalCooldown = 0;
function checkPortals(dt) {
  if (portalCooldown > 0) {
    portalCooldown = Math.max(0, portalCooldown - dt);
    return;
  }
  const mapCfg = MAPS[world.char.mapId];
  if (!mapCfg) return;
  for (const p of mapCfg.portals) {
    if (Math.hypot(world.char.x - p.x, world.char.z - p.z) < 1.75) {
      portalCooldown = 3.0;
      clickTargetPos = null;
      world.changeMap(p.toMap);
      sfx.playDash();
      break;
    }
  }
}

// 主渲染與模擬迴圈
let lastTime = performance.now();
let elapsed = 0;
let saveAcc = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
  lastTime = now;
  elapsed += dt;

  const mv = hud.isIntroOpen() || hud.isDrawerOpen() ? { moveX: 0, moveZ: 0 } : computeMoveVector();
  const isMoving = Math.hypot(mv.moveX, mv.moveZ) > 0.04 || !!world.getNavTarget() || world.char.autoHunt;

  world.step(dt, mv);
  checkPortals(dt);
  sceneView.updateVisuals(dt, elapsed, isMoving, sfx);
  sceneView.render();
  if (!hud.isIntroOpen()) {
    hud.updateHud(dt, isMoving);
  }

  // 入局帖還開著時不自動存（還沒立帖，外觀與名號都還沒定）
  if (!hud.isIntroOpen()) saveAcc += dt;
  if (saveAcc >= 5.0) {
    saveAcc = 0;
    world.save();
  }
}
requestAnimationFrame(animate);

// 自動化驗收與效能診斷介面 window.__sf
window.__sf = {
  ready: true,
  world,
  sceneView,
  hud,
  sfx,
  start: () => hud.startGame(),
  state: () => ({
    name: world.char.name,
    mapId: world.char.mapId,
    mapName: MAPS[world.char.mapId]?.name,
    pos: { x: Number(world.char.x.toFixed(2)), z: Number(world.char.z.toFixed(2)) },
    hp: Math.round(world.char.curHp),
    maxHp: world.char.maxHp,
    shield: Math.round(world.char.curShield),
    maxShield: world.char.maxShield,
    mp: Math.round(world.char.curMp),
    mechPhase: world.char.mechPhase,
    mechGear: Math.round(world.char.curGear),
    activeWeapon: world.getActiveWeapon(),
    hudMode: document.getElementById('hud').dataset.hudMode,
    deviceType: world.char.deviceType,
    pkMode: world.char.pkMode,
    autoHunt: world.char.autoHunt,
    lockedTargetId: world.char.lockedTargetId,
    navTarget: world.getNavTarget(),
  }),
  advance: (sec, input) => {
    world.advance(sec, input);
    sceneView.updateVisuals(0.016, elapsed + sec, !!input, sfx);
    sceneView.render();
    if (!hud.isIntroOpen()) hud.updateHud(0.016, !!input);
  },
  info: () => sceneView.info(),
  wipe: () => clearSavedState(),
};
