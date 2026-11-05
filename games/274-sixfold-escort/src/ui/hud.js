// 六器鏢行 — 介面：麻紙鏢單、黃銅羅盤、六器匣、直排鏢旗、觸控扇匣、名牌、入局帖與抽屜
// 場景契約（GLOSSARY 第二輪）：sceneView.setIntro?.(on)、sceneView.setHeroLook?.(look)、sceneView.anchors?.()；
// 沒有提供時一律退回舊邏輯，不報錯。

import { ELEMENTS, LOADOUT_PRESETS, REBIRTH_STAGES, SKILLS, MECH_TIERS, MAPS } from '../core/data.js';
import { weaponSvg, glyphSvg, flagSvg, stampSvg, compassRingSvg } from './icons.js';
import { createDrawers } from './drawers.js';
import { getWeaponAuraName } from '../core/combat.js';

// 六器匣預設次序：刀、劍、槍、拳、弓、飛針（鍵 1～6）；內功鍵 7～9；偃甲上機後鍵 1、2 換成專屬技
export const DEFAULT_BOX = [101, 201, 301, 401, 501, 601];
export const INNER_SKILLS = [701, 702, 704];
export const MECH_SKILLS = [9001, 9002];
export const TABS = [
  { id: 'char', flag: '人物', name: '人物・階位', key: 'C' },
  { id: 'martial', flag: '六器', name: '六器匣・武功', key: 'K' },
  { id: 'forge', flag: '鍛爐', name: '鍛爐', key: 'U' },
  { id: 'mech', flag: '偃甲', name: '偃甲', key: 'T' },
  { id: 'market', flag: '行會', name: '渡口行會・寄攤', key: 'B' },
  { id: 'worldmap', flag: '鏢路', name: '鏢路圖', key: 'G' },
  { id: 'bounty', flag: '懸紅', name: '懸紅榜', key: 'J' },
  { id: 'handoff', flag: '說明', name: '說明・操作', key: 'H' },
];

const LOOK_KEY = 'sixfold_escort_274_look';
const BOX_KEY = 'sixfold_escort_274_box';
const PALETTE_OPTS = [
  { id: 'indigo', name: '靛藍', hex: '#2c3e57' },
  { id: 'ochre', name: '赭石', hex: '#7e4620' },
  { id: 'pine', name: '墨綠', hex: '#2f4a3c' },
  { id: 'moon', name: '月白', hex: '#d6dbdc' },
];
const HAIR_NAMES = { Male: ['髮髻', '披髮', '雙髻'], Female: ['雙髻', '披髮', '短髮'] };
const WEAPON_ORDER = ['BLADE', 'SWORD', 'SPEAR', 'FIST', 'BOW', 'THROWN'];
const WEAPON_SHORT = { BLADE: '刀', SWORD: '劍', SPEAR: '槍', FIST: '拳', BOW: '弓', THROWN: '飛針' };
const CHANNEL_COLOR = {
  系統: '#bfb194', 戰報: '#f08a6c', 警告: '#ff7a5c', 交易: '#d6b878', 鏢局: '#e9dfca', 偃甲: '#b8c7dc', 酣戰: '#d9a441', 懸紅: '#f08a6c', 江湖: '#e9dfca',
};
const CN_NUM = ['一', '二', '三'];

const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const debug = new URLSearchParams(location.search).has('debug');
const safe = (fn) => { try { return fn(); } catch (e) { console.warn('[hud] 場景介面呼叫失敗', e); return undefined; } };
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const fresh = new URLSearchParams(location.search).get('fresh') === '1';

export function createEscortHud(world, sceneView, sfx) {
  const $ = (id) => document.getElementById(id);
  const elHud = $('hud');
  const elIntro = $('intro');
  const elDrawer = $('drawer');
  const elDrawerBody = $('drawerBody');
  const elLabels = $('worldLabels');
  const elCombatArcs = $('combatArcs');
  const arcHpFill = $('arcHpFill');
  const arcShieldFill = $('arcShieldFill');
  const shieldWarnBanner = $('shieldWarnBanner');
  const elHero = $('heroBox');
  const elBreak = $('breakStamp');

  let activeTab = null;
  let lastChatTop = '';
  let lastBarSig = '';
  let lastThreatSig = '';
  let lowShieldSoundTimer = 0;
  let prevHeroShield = world.char.curShield;
  const prevEntShield = new Map();
  let breakTimer = 0;

  // ── 六器匣次序（存 localStorage；舊存檔或資料不合時回到預設） ──
  let boxOrder = DEFAULT_BOX.slice();
  if (!fresh) {
    try {
      const saved = JSON.parse(localStorage.getItem(BOX_KEY) || 'null');
      if (Array.isArray(saved) && saved.length === 6 && DEFAULT_BOX.every((s) => saved.includes(s))) boxOrder = saved;
    } catch { /* 忽略壞掉的存檔 */ }
  }
  function moveBoxSlot(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= boxOrder.length) return;
    [boxOrder[i], boxOrder[j]] = [boxOrder[j], boxOrder[i]];
    if (!fresh) { try { localStorage.setItem(BOX_KEY, JSON.stringify(boxOrder)); } catch { /* 私密模式 */ } }
    rebuildSkillBars();
  }

  // 鍵位 0..8 → 武功 id（偃甲上機後 1、2 換成專屬技，3～6 封匣）
  function slotSkill(idx) {
    const merged = world.char.mechPhase === 'ACTIVE_MERGED';
    if (idx < 6) {
      if (merged) return idx < 2 ? MECH_SKILLS[idx] : null;
      return boxOrder[idx];
    }
    return INNER_SKILLS[idx - 6] ?? null;
  }
  function weaponOfSkill(sid) {
    const m = world.martials[sid];
    const sk = SKILLS[sid];
    if (!sk?.weapon) return null;
    return world.weapons.find((w) => w.uid === m?.linkedWeaponUid) || world.weapons.find((w) => w.type === sk.weapon) || null;
  }
  function cast(sid) {
    if (!sid) return;
    sfx.unlock();
    world.castLinkedSkill(sid);
  }

  // ── 雙模判定 ──
  function detectEffectiveHudMode() {
    if (world.char.hudMode === 'pc' || world.char.hudMode === 'mobile') return world.char.hudMode;
    const isSmallOrTouch = window.innerWidth <= 820 || window.innerHeight <= 480 || navigator.maxTouchPoints > 0;
    return isSmallOrTouch ? 'mobile' : 'pc';
  }
  function applyHudMode() {
    const m = detectEffectiveHudMode();
    elHud.dataset.hudMode = m;
    world.char.deviceType = m === 'mobile' ? 'MOBILE_TOUCH' : 'PC_WEBGPU';
    if (m === 'mobile') layoutTouch();
    resizeCompass();
  }
  function handoff(mode) {
    world.performSessionHandoff(mode);
    applyHudMode();
    rebuildSkillBars();
  }

  // ════════════════ 入局帖 ════════════════
  const look = { preset: 'escort', gender: 'Male', hair: 0, palette: 'indigo', height: 1, build: 1, weapon: 'SPEAR' };
  if (!fresh) {
    try {
      const saved = JSON.parse(localStorage.getItem(LOOK_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        if (saved.gender === 'Male' || saved.gender === 'Female') look.gender = saved.gender;
        if (Number.isInteger(saved.hair) && saved.hair >= 0 && saved.hair <= 2) look.hair = saved.hair;
        if (PALETTE_OPTS.some((p) => p.id === saved.palette)) look.palette = saved.palette;
        if (Number.isFinite(saved.height)) look.height = Math.max(0.9, Math.min(1.1, saved.height));
        if (Number.isFinite(saved.build)) look.build = Math.max(0.9, Math.min(1.1, saved.build));
        if (WEAPON_ORDER.includes(saved.weapon)) look.weapon = saved.weapon;
      }
    } catch { /* 忽略 */ }
  }
  // world 存檔裡已有的欄位優先（gender／hairStyle／activeWeaponUid）
  look.gender = world.char.gender === 'FEMALE' ? 'Female' : 'Male';
  if (Number.isInteger(world.char.hairStyle) && !fresh) look.hair = world.char.hairStyle;
  const wpnNow = world.weapons.find((w) => w.uid === world.char.activeWeaponUid);
  if (wpnNow && (fresh || !localStorage.getItem(LOOK_KEY))) look.weapon = wpnNow.type;

  $('introStamp').outerHTML = stampSvg('順安鏢局', { size: 56 });
  const inpName = $('inpHeroName');
  inpName.value = world.char.name || '陸遠行';

  function radioGroup(container, items, current, onPick) {
    container.innerHTML = items.map((it) => `<button type="button" role="radio" aria-checked="${it.id === current}" data-v="${it.id}">${it.html ?? it.name}</button>`).join('');
    container.querySelectorAll('[data-v]').forEach((b) => {
      b.addEventListener('click', () => {
        container.querySelectorAll('[data-v]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
        onPick(b.dataset.v);
      });
    });
  }
  function renderHair() {
    radioGroup($('segHair'), HAIR_NAMES[look.gender].map((n, i) => ({ id: String(i), name: n })), String(look.hair), (v) => { look.hair = Number(v); pushLook(); });
  }
  radioGroup($('segGender'), [{ id: 'Male', name: '男' }, { id: 'Female', name: '女' }], look.gender, (v) => { look.gender = v; renderHair(); pushLook(); });
  renderHair();
  radioGroup($('segPalette'), PALETTE_OPTS.map((p) => ({ id: p.id, html: `<i style="background-color:${p.hex}"></i><span>${p.name}</span>` })), look.palette, (v) => { look.palette = v; pushLook(); });

  const grid = $('introWpnGrid');
  grid.innerHTML = WEAPON_ORDER.map((t) => {
    const w = world.weapons.find((x) => x.type === t);
    return `<button type="button" class="wpn-opt ${t === look.weapon ? 'sel' : ''}" role="radio" aria-checked="${t === look.weapon}" data-wpn="${w?.uid || ''}" data-type="${t}" title="${w ? w.name : ''}">${weaponSvg(t)}<b>${WEAPON_SHORT[t]}</b></button>`;
  }).join('');
  grid.querySelectorAll('.wpn-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.wpn-opt').forEach((b) => { b.classList.toggle('sel', b === btn); b.setAttribute('aria-checked', String(b === btn)); });
      look.weapon = btn.dataset.type;
      if (btn.dataset.wpn) world.char.activeWeaponUid = btn.dataset.wpn;
      pushLook();
    });
  });
  const rngH = $('rngHeight');
  const rngB = $('rngBuild');
  rngH.value = String(look.height);
  rngB.value = String(look.build);
  rngH.addEventListener('input', () => { look.height = Number(rngH.value); pushLook(); });
  rngB.addEventListener('input', () => { look.build = Number(rngB.value); pushLook(); });

  function pushLook() {
    safe(() => sceneView.setHeroLook?.({ ...look }));
  }
  function persistLook() {
    if (fresh) return; // ?fresh=1 試玩不寫回外觀
    try { localStorage.setItem(LOOK_KEY, JSON.stringify(look)); } catch { /* 私密模式 */ }
  }
  safe(() => sceneView.setIntro?.(true));
  pushLook();

  function startGame() {
    if (elIntro.classList.contains('hidden')) return;
    sfx.unlock();
    const nm = inpName.value.trim();
    if (nm) world.char.name = nm.slice(0, 8);
    world.char.gender = look.gender === 'Female' ? 'FEMALE' : 'MALE';
    world.char.hairStyle = look.hair;
    const w = world.weapons.find((x) => x.type === look.weapon);
    if (w) world.char.activeWeaponUid = w.uid;
    persistLook();
    // 立帖當下就寫存檔：不然 5 秒內重新整理，world 存檔的 gender／hairStyle 還是舊值，會蓋掉剛存的外觀
    safe(() => world.save());
    safe(() => sceneView.setIntro?.(false));
    pushLook();
    elIntro.classList.add('hidden');
    elHud.classList.remove('hidden');
    elCombatArcs.classList.remove('hidden');
    applyHudMode();
    rebuildSkillBars();
    sfx.playStamp?.();
  }
  $('startBtn').addEventListener('click', startGame);

  // ════════════════ 鏢單 ════════════════
  $('btnPk').insertAdjacentHTML('afterbegin', stampSvg('亮刃', { size: 40 }));
  elHero.querySelector('.low-stamp').innerHTML = stampSvg('罡危', { size: 30 });
  $('btnPk').addEventListener('click', () => {
    sfx.unlock();
    if (world.char.channel !== 1 && !world.char.sandstormNight) world.char.channel = 1;
    world.char.pkMode = !world.char.pkMode;
    if (world.char.pkMode) sfx.playStamp?.();
  });
  document.querySelectorAll('[data-loadout]').forEach((btn) => {
    btn.addEventListener('click', () => {
      sfx.unlock();
      world.char.loadoutId = Number(btn.dataset.loadout);
      world.syncCaps(false);
    });
  });

  // ════════════════ 鏢旗頁籤 ════════════════
  const tabHtml = (t, attr) => `<button type="button" class="flag-tab" ${attr}="${t.id}" aria-label="${t.name}（${t.key}）">${flagSvg(t.flag)}<span class="tip">${t.name}<kbd>${t.key}</kbd></span></button>`;
  const elSide = $('sideTabs');
  elSide.innerHTML = TABS.map((t) => tabHtml(t, 'data-open-tab')).join('');
  document.querySelector('.drawer-tabs').innerHTML = TABS.map((t) => tabHtml(t, 'data-tab')).join('');
  const btnMobTabs = $('btnMobileTabs');
  btnMobTabs.insertAdjacentHTML('afterbegin', flagSvg('', { w: 30, h: 40 }));
  btnMobTabs.addEventListener('click', () => {
    const open = !elSide.classList.contains('open');
    elSide.classList.toggle('open', open);
    elSide.classList.toggle('lacq', open);
    btnMobTabs.setAttribute('aria-expanded', String(open));
  });
  elSide.querySelectorAll('[data-open-tab]').forEach((b) => b.addEventListener('click', () => openDrawer(b.dataset.openTab)));
  document.querySelectorAll('.drawer-tabs [data-tab]').forEach((b) => b.addEventListener('click', () => openDrawer(b.dataset.tab)));

  // ════════════════ 羅盤 ════════════════
  const elCompass = $('compass');
  elCompass.insertAdjacentHTML('afterbegin', compassRingSvg(172));
  const radarCanvas = $('radarCanvas');
  const rCtx = radarCanvas.getContext('2d');
  const needle = $('bountyNeedle');
  function resizeCompass() {
    const css = elCompass.getBoundingClientRect().width || 172;
    const inner = Math.max(40, Math.round((css - (css > 140 ? 18 : 14)) * Math.min(2, window.devicePixelRatio || 1)));
    if (radarCanvas.width !== inner) { radarCanvas.width = inner; radarCanvas.height = inner; }
  }
  elCompass.addEventListener('click', () => openDrawer('worldmap'));
  $('mapFlag').addEventListener('click', () => {
    sfx.unlock();
    const ch = world.char;
    // 風沙夜只颳在赤沙驛；其他地圖只在一線（可亮刃）與二線（太平）之間切換
    if (ch.mapId === 1002 && ch.channel === 1 && !ch.sandstormNight) ch.sandstormNight = true;
    else if (ch.sandstormNight) { ch.sandstormNight = false; ch.channel = 2; ch.pkMode = false; }
    else if (ch.channel === 1) { ch.channel = 2; ch.pkMode = false; } else ch.channel = 1;
  });
  $('bountyCompass').addEventListener('click', () => {
    const comp = world.getActiveBountyCompass();
    if (comp) {
      if (world.char.mapId !== comp.bounty.targetMapId) world.changeMap(comp.bounty.targetMapId);
      world.char.lockedTargetId = comp.bounty.targetId;
    } else openDrawer('bounty');
  });
  // 靜音（M 鍵／喇叭鈕）：存 localStorage，?fresh=1 不讀也不寫
  const MUTE_KEY = 'sixfold_escort_274_mute';
  const btnMute = $('btnMute');
  function setMuted(m, persist = true) {
    btnMute.innerHTML = glyphSvg(m ? 'mute' : 'sound');
    btnMute.setAttribute('aria-label', m ? '音效：關' : '音效：開');
    if (persist && !fresh) { try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* 私密模式 */ } }
  }
  let mutedAtStart = false;
  if (!fresh) { try { mutedAtStart = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* 私密模式 */ } }
  setMuted(sfx.setMuted ? sfx.setMuted(mutedAtStart) : false, false);
  btnMute.addEventListener('click', () => setMuted(sfx.toggleMute()));
  $('castBanner').addEventListener('click', () => { if (world.char.mapId === 1002 && !world.getBeaconState()) world.igniteNearestBeacon(); });

  function drawCompass() {
    const W = radarCanvas.width;
    const c = W / 2;
    const ch = world.char;
    rCtx.clearRect(0, 0, W, W);
    rCtx.save();
    rCtx.beginPath();
    rCtx.arc(c, c, c, 0, Math.PI * 2);
    rCtx.clip();
    const g = rCtx.createRadialGradient(c * 0.8, c * 0.7, c * 0.1, c, c, c);
    g.addColorStop(0, '#2b231b');
    g.addColorStop(1, '#14100c');
    rCtx.fillStyle = g;
    rCtx.fillRect(0, 0, W, W);
    const scale = c / 26; // 半徑約 26 公尺
    // 羅盤環上的「北東南西」字盤（icons.js compassRingSvg：168 單位裡半徑 60、字底圓 8.2），換成畫布像素
    const ringW = radarCanvas.parentElement?.clientWidth || 172;
    const kPx = W / (radarCanvas.clientWidth || W);
    const labR = (60 / 168) * ringW * kPx, labDisc = (8.2 / 168) * ringW * kPx;
    // 記號不壓字：落在字盤附近就沿半徑往內縮。超出盤面的不畫（回 null）；pin＝true（傳送口）貼在盤緣
    const P = (x, z, rad = 0, pin = false) => {
      let dx = (x - ch.x) * scale, dy = (z - ch.z) * scale;
      let r = Math.hypot(dx, dy);
      if (r < 1e-6) return [c, c];
      const ux = dx / r, uy = dy / r;
      if (r > c - rad) { if (!pin) return null; r = c - rad; }
      for (const [lx, ly] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const keep = labDisc + rad + 2 * kPx;
        if (Math.hypot(ux * r - lx * labR, uy * r - ly * labR) < keep) {
          // 沿半徑內縮到剛好碰不到字底圓
          const along = ux * lx + uy * ly; // cos(與字盤方向的夾角)
          const perp = Math.sqrt(Math.max(0, 1 - along * along)) * labR;
          if (perp < keep) r = Math.min(r, labR * along - Math.sqrt(keep * keep - perp * perp));
        }
      }
      return [c + ux * r, c + uy * r];
    };
    // 視角扇面
    const yaw = sceneView.getCameraAngles().camYaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const ang = Math.atan2(fz, fx);
    rCtx.fillStyle = 'rgba(214, 184, 120, 0.10)';
    rCtx.beginPath();
    rCtx.moveTo(c, c);
    rCtx.arc(c, c, c * 0.92, ang - 0.55, ang + 0.55);
    rCtx.closePath();
    rCtx.fill();
    // 同心刻線
    rCtx.strokeStyle = 'rgba(176, 141, 72, 0.18)';
    rCtx.lineWidth = Math.max(1, W / 220);
    rCtx.beginPath(); rCtx.arc(c, c, c * 0.5, 0, Math.PI * 2); rCtx.stroke();
    const dot = W / 100;
    const map = MAPS[ch.mapId];
    for (const p of map?.portals || []) {
      const pt = P(p.x, p.z, dot * 3.1, true);
      const [x, y] = pt;
      rCtx.strokeStyle = '#6f8fbf'; rCtx.lineWidth = dot * 0.9;
      rCtx.beginPath(); rCtx.arc(x, y, dot * 2.6, 0, Math.PI * 2); rCtx.stroke();
    }
    if (ch.mapId === 1001) {
      rCtx.fillStyle = '#c9a75e';
      const stalls = world.getPlayerStall() ? [world.getPlayerStall(), ...world.stalls] : world.stalls;
      for (const st of stalls) { const pt = P(st.x, st.z, dot * 2); if (!pt) continue; const [x, y] = pt; rCtx.fillRect(x - dot * 1.4, y - dot * 1.4, dot * 2.8, dot * 2.8); }
    }
    if (ch.mapId === 1002) {
      rCtx.fillStyle = '#d9583f';
      for (const s of world.beacons) {
        const pt = P(s.x, s.z, dot * 2.8);
        if (!pt) continue;
        const [x, y] = pt;
        rCtx.beginPath(); rCtx.moveTo(x, y - dot * 2.6); rCtx.lineTo(x + dot * 2.2, y + dot * 1.6); rCtx.lineTo(x - dot * 2.2, y + dot * 1.6); rCtx.closePath(); rCtx.fill();
      }
    }
    for (const ent of world.getMapEntities(false)) {
      const pt = P(ent.x, ent.z, dot * 2.4);
      if (!pt) continue;
      const [x, y] = pt;
      if (ent.kind === 'BANDIT') {
        rCtx.fillStyle = '#ef5a3c';
        rCtx.beginPath(); rCtx.moveTo(x, y - dot * 2.4); rCtx.lineTo(x + dot * 2.4, y); rCtx.lineTo(x, y + dot * 2.4); rCtx.lineTo(x - dot * 2.4, y); rCtx.closePath(); rCtx.fill();
      } else {
        rCtx.fillStyle = ent.kind === 'BOSS' ? '#e3c07a' : '#d8ccb2';
        rCtx.beginPath(); rCtx.arc(x, y, ent.kind === 'BOSS' ? dot * 2.4 : dot * 1.3, 0, Math.PI * 2); rCtx.fill();
      }
    }
    // 鏢師：黃銅小圈
    rCtx.strokeStyle = '#e8cf92'; rCtx.lineWidth = dot * 1.1;
    rCtx.beginPath(); rCtx.arc(c, c, dot * 2.4, 0, Math.PI * 2); rCtx.stroke();
    rCtx.restore();

    const comp = world.getActiveBountyCompass();
    if (comp && comp.sameMap) {
      needle.style.display = 'block';
      needle.style.transform = `rotate(${(180 - (comp.angle * 180) / Math.PI).toFixed(1)}deg)`;
    } else needle.style.display = 'none';
  }

  // ════════════════ 下中：六器匣與兩側小匣 ════════════════
  const leftBox = $('leftBox');
  const sixBox = $('sixBox');
  const innerBox = $('innerBox');
  const capsHtml = '<span class="cap tl"></span><span class="cap tr"></span><span class="cap bl"></span><span class="cap br"></span>';
  const ringSvg = '<svg class="ring" viewBox="0 0 44 44"><circle class="r0" cx="22" cy="22" r="20"/><circle class="r1" cx="22" cy="22" r="20" stroke-dasharray="125.66" stroke-dashoffset="125.66"/></svg>';
  leftBox.innerHTML = `${capsHtml}
    <button type="button" class="mb" id="btnPcDash" title="輕功・踏浪步 (Space)">${glyphSvg('dash')}<span class="k">空白鍵</span></button>
    <button type="button" class="mb" id="btnPcMech" title="偃甲上機 (V)">${ringSvg}${glyphSvg('mech')}<span class="k">V</span></button>
    <button type="button" class="mb" id="btnAutoHunt" title="自動狩獵 (Z)">${glyphSvg('hunt')}<span class="k">Z</span></button>
    <button type="button" class="mb" id="btnFrenzy" title="酣戰">${ringSvg}${glyphSvg('frenzy')}</button>`;
  innerBox.innerHTML = `${capsHtml}${INNER_SKILLS.map((sid, i) => `
    <button type="button" class="mb" data-inner="${i}" data-cast-skill="${sid}" title="${SKILLS[sid].name} (${7 + i})">${glyphSvg(sid)}<span class="k">${7 + i}</span><span class="cd" data-cd-for="${sid}"></span></button>`).join('')}
    <button type="button" class="mb" id="btnPotHp" title="回春丸 (Q)">${glyphSvg('hp')}<span class="q" id="qHp"></span><span class="k">Q</span></button>
    <button type="button" class="mb" id="btnPotShield" title="聚罡散 (E)">${glyphSvg('shield')}<span class="q" id="qSh"></span><span class="k">E</span></button>
    <button type="button" class="mb" id="btnPotCleanse" title="清心露 (R)">${glyphSvg('cleanse')}<span class="q" id="qCl"></span><span class="k">R</span></button>`;
  innerBox.querySelectorAll('[data-inner]').forEach((b) => b.addEventListener('click', () => cast(Number(b.dataset.castSkill))));
  const potion = (kind) => { sfx.unlock(); if (world.useSmartPotion(kind, false)?.ok) sfx.playPotion(); };
  $('btnPotHp').addEventListener('click', () => potion('HP_RED'));
  $('btnPotShield').addEventListener('click', () => potion('SHIELD_CYAN'));
  $('btnPotCleanse').addEventListener('click', () => potion('CLEANSE_PILL'));
  $('btnPcDash').addEventListener('click', () => { sfx.unlock(); world.castQinggongDash(0, 0); });
  $('btnPcMech').addEventListener('click', () => { sfx.unlock(); world.toggleMechSummon(); });
  $('btnAutoHunt').addEventListener('click', () => { sfx.unlock(); world.char.autoHunt = !world.char.autoHunt; });
  $('btnFrenzy').addEventListener('click', () => { sfx.unlock(); world.activateFrenzy(); });

  function slotHtml(idx, sid) {
    const merged = world.char.mechPhase === 'ACTIVE_MERGED';
    if (!sid) {
      return `<button type="button" class="slot shut" data-slot="${idx}" tabindex="-1" aria-label="封匣"><span class="key">${idx + 1}</span><span class="nm">封</span></button>`;
    }
    const sk = SKILLS[sid];
    const m = world.martials[sid] || {};
    const w = weaponOfSkill(sid);
    const icon = sk.weapon ? weaponSvg(sk.weapon) : glyphSvg(sid);
    return `<button type="button" class="slot ${m.isTrue ? 'true-sk' : ''}" data-slot="${idx}" data-cast-skill="${sid}" title="${m.isTrue ? sk.trueName : sk.name}${w ? `｜+${w.upgrade} ${w.name}` : ''}（${idx + 1}）">
      ${icon}<span class="key">${idx + 1}</span>${w && !merged ? `<span class="upg">+${w.upgrade}</span>` : ''}
      <span class="nm">${m.isTrue ? '<span class="xu">玄</span>' : ''}${sk.name}</span>
      <span class="cd" data-cd-for="${sid}"></span><span class="cdn" data-cdn-for="${sid}"></span></button>`;
  }

  // ════════════════ 觸控：搖桿、藥、扇匣、偃甲鍵 ════════════════
  const fan = $('skillFan');
  const mobPots = $('mobPotions');
  const btnWheelMech = $('btnWheelMech');
  mobPots.innerHTML = `
    <button type="button" class="pot-btn" id="mPotHp" aria-label="回春丸">${glyphSvg('hp')}<span class="q" id="mqHp"></span></button>
    <button type="button" class="pot-btn" id="mPotSh" aria-label="聚罡散">${glyphSvg('shield')}<span class="q" id="mqSh"></span></button>`;
  $('mPotHp').addEventListener('click', () => potion('HP_RED'));
  $('mPotSh').addEventListener('click', () => potion('SHIELD_CYAN'));
  btnWheelMech.innerHTML = `${ringSvg}${glyphSvg('mech')}<span class="sr">偃甲</span>`;
  btnWheelMech.addEventListener('click', () => { sfx.unlock(); world.toggleMechSummon(); });

  let fanGeom = null;
  function layoutTouch() {
    const W = window.innerWidth, H = window.innerHeight;
    const portrait = H > W;
    // 半圓扇：中央大鍵＋沿弧六格；相鄰兩格弦長 2R·sin(Δ/2) ≥ 直徑＋間隙
    const g = portrait
      ? { main: 82, btn: 50, R: 124, start: 186, cx: W - 102, cy: H - 64 }
      : { main: 72, btn: 46, R: 110, start: 189, cx: W - 92, cy: H - 58 };
    const gap = 6;
    g.step = (2 * Math.asin((g.btn + gap) / 2 / g.R) * 180) / Math.PI;
    fanGeom = g;
    const pos = [];
    for (let i = 0; i < 6; i++) {
      const th = ((g.start - i * g.step) * Math.PI) / 180;
      pos.push({ x: g.cx + Math.cos(th) * g.R, y: g.cy - Math.sin(th) * g.R, deg: 90 - (g.start - i * g.step) });
    }
    fanGeom.pos = pos;
    // 藥：直式放搖桿上方，橫式放搖桿右側直排
    const joy = $('joyZone').getBoundingClientRect();
    if (portrait) {
      Object.assign(mobPots.style, { left: `${Math.round(joy.left + 6)}px`, top: `${Math.round(joy.top - 58)}px`, flexDirection: 'row' });
      $('chatBox').style.bottom = `${Math.round(H - joy.top + 72)}px`;
    } else {
      Object.assign(mobPots.style, { left: `${Math.round(joy.right + 8)}px`, top: `${Math.round(H - 8 - 46 * 2 - 8)}px`, flexDirection: 'column' });
    }
    // 偃甲鍵在扇形外：直式在扇的右上方，橫式在扇的左上方
    const mech = portrait
      ? { x: W - 38, y: g.cy - g.R - g.btn / 2 - 52 }
      : { x: pos[0].x - 72, y: H - 34 };
    // 「鏢單」按鈕貼在鏢單下緣
    const hb = elHero.getBoundingClientRect();
    if (hb.height > 0) {
      btnMobTabs.style.top = `${Math.round(hb.bottom + 6)}px`;
      if (portrait) {
        elSide.style.top = `${Math.round(hb.bottom + 58)}px`;
        // 直式：目標卡放在左上鏢單鈕與右上羅盤兩者之下
        const rt = $('rightTop').getBoundingClientRect();
        $('topCenter').style.top = `${Math.round(Math.max(hb.bottom + 52, rt.bottom) + 8)}px`;
      } else {
        elSide.style.top = '';
        $('topCenter').style.top = '';
      }
    }
    Object.assign(btnWheelMech.style, { left: `${Math.round(mech.x - 25)}px`, top: `${Math.round(mech.y - 25)}px` });
    rebuildFan();
  }

  function rebuildFan() {
    if (!fanGeom) return;
    const g = fanGeom;
    const merged = world.char.mechPhase === 'ACTIVE_MERGED';
    const active = world.getActiveWeapon();
    const mainSid = merged ? MECH_SKILLS[0] : (boxOrder.find((sid) => weaponOfSkill(sid)?.uid === active?.uid) || boxOrder[0]);
    let html = `<button type="button" class="fan-btn main" data-fan="main" data-cast-skill="${mainSid}" style="left:${Math.round(g.cx - g.main / 2)}px;top:${Math.round(g.cy - g.main / 2)}px;width:${g.main}px;height:${g.main}px" aria-label="出招"><b>${merged ? '錘' : '攻'}</b><span class="cd" data-cd-for="${mainSid}"></span></button>`;
    for (let i = 0; i < 6; i++) {
      const sid = merged ? (i === 0 ? MECH_SKILLS[1] : null) : slotSkill(i);
      const p = g.pos[i];
      const st = `left:${Math.round(p.x - g.btn / 2)}px;top:${Math.round(p.y - g.btn / 2)}px;width:${g.btn}px;height:${g.btn}px`;
      if (!sid) continue; // 合體期間封住的匣格整格收起，扇上只剩偃甲專屬技
      const sk = SKILLS[sid];
      const w = weaponOfSkill(sid);
      const drawn = !merged && w && w.uid === active?.uid;
      const icon = sk.weapon ? weaponSvg(sk.weapon) : glyphSvg(sid);
      html += `<button type="button" class="fan-btn ${drawn ? 'drawn' : ''}" data-fan="${i}" data-cast-skill="${sid}" style="${st};--tilt:${p.deg.toFixed(0)}deg" aria-label="${sk.name}">${icon}<span class="cd" data-cd-for="${sid}"></span><span class="cdn" data-cdn-for="${sid}"></span></button>`;
    }
    fan.innerHTML = html;
    fan.querySelectorAll('[data-cast-skill]').forEach((b) => b.addEventListener('click', () => cast(Number(b.dataset.castSkill))));
  }

  function rebuildSkillBars() {
    const merged = world.char.mechPhase === 'ACTIVE_MERGED';
    const active = world.getActiveWeapon();
    sixBox.innerHTML = capsHtml + Array.from({ length: 6 }, (_, i) => slotHtml(i, slotSkill(i))).join('');
    sixBox.querySelectorAll('.slot[data-cast-skill]').forEach((b) => {
      const sid = Number(b.dataset.castSkill);
      if (!merged && weaponOfSkill(sid)?.uid === active?.uid) b.classList.add('drawn');
      b.addEventListener('click', () => cast(sid));
    });
    rebuildFan();
  }

  // ── 搖桿（外圈放開＝輕功） ──
  const joyState = { active: false, pointerId: null, dx: 0, dz: 0 };
  const joyZone = $('joyZone');
  const joyKnob = $('joyKnob');
  joyZone.addEventListener('pointerdown', (e) => {
    sfx.unlock();
    joyZone.setPointerCapture?.(e.pointerId);
    joyState.active = true;
    joyState.pointerId = e.pointerId;
    updateJoyFromEvent(e, false);
  });
  joyZone.addEventListener('pointermove', (e) => {
    if (!joyState.active || e.pointerId !== joyState.pointerId) return;
    updateJoyFromEvent(e, false);
  });
  const endJoy = (e) => {
    if (!joyState.active) return;
    updateJoyFromEvent(e, true);
    joyState.active = false;
    joyState.dx = 0;
    joyState.dz = 0;
    joyKnob.style.transform = 'translate(0px, 0px)';
  };
  joyZone.addEventListener('pointerup', endJoy);
  joyZone.addEventListener('pointercancel', endJoy);
  function updateJoyFromEvent(e, isRelease) {
    const r = joyZone.getBoundingClientRect();
    const ox = e.clientX - (r.left + r.width / 2);
    const oy = e.clientY - (r.top + r.height / 2);
    const maxR = r.width * 0.44;
    const dist = Math.hypot(ox, oy);
    const clamped = Math.min(dist, maxR);
    const nx = dist > 2 ? ox / dist : 0;
    const ny = dist > 2 ? oy / dist : 0;
    joyKnob.style.transform = `translate(${(nx * clamped).toFixed(1)}px, ${(ny * clamped).toFixed(1)}px)`;
    const yaw = sceneView.getCameraAngles().camYaw;
    const wx = nx * Math.cos(yaw) + ny * Math.sin(yaw);
    const wz = -nx * Math.sin(yaw) + ny * Math.cos(yaw);
    joyState.dx = wx;
    joyState.dz = wz;
    if (isRelease && dist > maxR * 0.92) world.castQinggongDash(wx, wz);
  }

  // ════════════════ 抽屜 ════════════════
  const drawers = createDrawers({
    world, sceneView, sfx,
    ui: {
      closeDrawer: () => closeDrawer(),
      rebuildSkillBars: () => rebuildSkillBars(),
      getBoxOrder: () => boxOrder.slice(),
      moveBoxSlot,
      handoff,
      getHudMode: () => elHud.dataset.hudMode,
    },
  });
  function openDrawer(tab = 'char') {
    sfx.unlock();
    const t = TABS.find((x) => x.id === tab) || TABS[0];
    activeTab = t.id;
    elDrawer.classList.remove('hidden');
    elHud.classList.add('drawer-open');
    $('drawerTitle').textContent = t.name;
    document.querySelectorAll('[data-tab],[data-open-tab]').forEach((b) => b.classList.toggle('active', (b.dataset.tab || b.dataset.openTab) === t.id));
    elSide.classList.remove('open', 'lacq');
    btnMobTabs.setAttribute('aria-expanded', 'false');
    sfx.playUiTick?.();
    drawers.render(activeTab, elDrawerBody);
  }
  function closeDrawer() {
    activeTab = null;
    elDrawer.classList.add('hidden');
    elHud.classList.remove('drawer-open');
  }
  $('btnCloseDrawer').addEventListener('click', closeDrawer);

  // ════════════════ 黃銅弧尺刻度 ════════════════
  (function drawArcRules() {
    const parts = [];
    const ruler = (cx, a0, a1) => {
      for (let i = 0; i <= 10; i++) {
        const a = ((a0 + ((a1 - a0) * i) / 10) * Math.PI) / 180;
        const r0 = 100, r1 = i % 5 === 0 ? 108 : 104;
        parts.push(`<line class="arc-tick" x1="${(cx + Math.cos(a) * r0).toFixed(1)}" y1="${(95 + Math.sin(a) * r0).toFixed(1)}" x2="${(cx + Math.cos(a) * r1).toFixed(1)}" y2="${(95 + Math.sin(a) * r1).toFixed(1)}"/>`);
      }
      const p = (deg, r) => `${(cx + Math.cos((deg * Math.PI) / 180) * r).toFixed(1)} ${(95 + Math.sin((deg * Math.PI) / 180) * r).toFixed(1)}`;
      parts.push(`<path class="arc-rule" d="M ${p(a0, 100)} A 100 100 0 0 ${a1 > a0 ? 1 : 0} ${p(a1, 100)}"/>`);
    };
    ruler(138.8, 129.8, 230.2);
    ruler(181.2, 50.2, -50.2);
    $('arcRules').innerHTML = parts.join('');
  })();

  // ════════════════ 破罡朱印 ════════════════
  elBreak.innerHTML = `<svg viewBox="0 0 150 150" aria-hidden="true">
    <defs><filter id="stampRough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11"/><feDisplacementMap in="SourceGraphic" scale="3.2"/></filter></defs>
    <g filter="url(#stampRough)">
      <rect x="8" y="8" width="134" height="134" rx="6" fill="#b23a24"/>
      <rect x="17" y="17" width="116" height="116" rx="3" fill="none" stroke="#e8dcc2" stroke-width="2.4"/>
      <text x="75" y="76" text-anchor="middle" dominant-baseline="central" font-size="92" font-weight="900" fill="#e8dcc2" style="font-family:var(--serif)">破</text>
    </g></svg>`;
  const smallStamp = window.matchMedia('(max-width: 820px), (max-height: 520px)');
  let stampBox = null; // 印章的畫面範圍（跳字讓位用）
  // 印的位置：主角頭頂上方（畫面水平中央），不壓在主角身上，也不壓上方的目標框（血量數字）與威脅列；投影失敗時退回 CSS 的 42%。
  // 鎖定目標和出招常在同一幀，目標卡那時還是 empty，所以印在畫面上的期間每幀重算（updateHud 呼叫）。
  // 直式螢幕目標卡＋威脅列很高，夾在中間放不下時先把印縮小（最小 0.55 倍），還放不下就移到主角右側
  function placeStamp() {
    const ch = world.char;
    const W = window.innerWidth, H = window.innerHeight;
    const half0 = smallStamp.matches ? (H <= 520 ? 48 : 58) : 75;
    const head = safe(() => sceneView.projectToScreen(ch.x, ch.mechPhase === 'ACTIVE_MERGED' ? 4.6 : 2.3, ch.z, W, H));
    const card = $('targetCard');
    let cardBottom = card && !card.classList.contains('empty') ? card.getBoundingClientRect().bottom : 0;
    // 目標卡下方緊接的威脅列（#threatRadar）也讓開：只算跨過畫面中線的那一列
    const radar = $('threatRadar');
    if (radar && radar.childElementCount) {
      const rr = radar.getBoundingClientRect();
      if (rr.height > 0 && rr.left < W / 2 + half0 && rr.right > W / 2 - half0) cardBottom = Math.max(cardBottom, rr.bottom);
    }
    const top = Math.max(6, cardBottom + 8);
    const bottom = head ? head.y - 30 : H * 0.42 + half0;
    let half = half0, cx = W / 2, cy;
    if (bottom - top >= half0 * 2) {
      cy = head ? Math.min(H * 0.42, bottom - half0) : H * 0.42;
      cy = Math.max(top + half0, cy);
    } else if (bottom - top >= half0 * 2 * 0.55) {
      half = (bottom - top) / 2;
      cy = top + half;
    } else {
      // 縮到最小也放不下：印放在主角右側（頭頂高度附近），不蓋主角
      half = half0 * 0.7;
      cy = Math.max(top + half, Math.min(H - half - 8, (head ? head.y : H * 0.42) + half * 0.6));
      cx = Math.min(W - half - 8, W / 2 + 40 + half);
    }
    if (half !== elBreak._half || cx !== elBreak._cx) {
      elBreak._half = half; elBreak._cx = cx;
      const sz = half === half0 ? '' : `${(half * 2).toFixed(0)}px`;
      elBreak.style.width = sz; elBreak.style.height = sz;
      elBreak.style.margin = half === half0 ? '' : `${(-half).toFixed(0)}px 0 0 ${(-half).toFixed(0)}px`;
      elBreak.style.left = cx === W / 2 ? '' : `${cx.toFixed(0)}px`;
    }
    elBreak.style.top = `${cy.toFixed(0)}px`;
    // 印本身斜放幾度、外圈有暈，讓位範圍多留 8 px
    const pad = 8;
    stampBox = { l: cx - half - pad, r: cx + half + pad, t: cy - half - pad, b: cy + half + pad };
  }
  function stampBreak() {
    placeStamp();
    elBreak.classList.remove('on');
    void elBreak.offsetWidth; // 重新觸發動畫
    elBreak.classList.add('on');
    breakTimer = 0.8;
    sfx.playStamp?.();
  }

  // ════════════════ 每幀更新 ════════════════
  const elBarHp = $('barHp'), elBarSh = $('barSh'), elBarMp = $('barMp');
  const elTxtHp = $('txtHp'), elTxtSh = $('txtSh'), elTxtMp = $('txtMp');
  const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };
  const setHtml = (el, t) => { if (el._h !== t) { el._h = t; el.innerHTML = t; } };

  function updateHud(dt, isMoving) {
    const ch = world.char;
    const rb = REBIRTH_STAGES[ch.rebirthStage || 0];
    const activeWpn = world.getActiveWeapon();
    const merged = ch.mechPhase === 'ACTIVE_MERGED';

    const barSig = `${ch.mechPhase}-${activeWpn?.uid}-${activeWpn?.upgrade}-${world.weapons.map((w) => w.upgrade).join('')}`;
    if (barSig !== lastBarSig) { lastBarSig = barSig; rebuildSkillBars(); }

    setText($('uiHeroName'), ch.name);
    setText($('uiHeroLv'), `Lv.${ch.level}`);
    setText($('uiRealmBadge'), rb.name.replace(/（.*）/, ''));

    const hpPct = clamp01(ch.curHp / ch.maxHp) * 100;
    const shPct = clamp01(ch.curShield / ch.maxShield) * 100;
    const mpPct = clamp01(ch.curMp / ch.maxMp) * 100;
    elBarHp.style.width = `${hpPct.toFixed(1)}%`;
    elBarSh.style.width = `${shPct.toFixed(1)}%`;
    elBarMp.style.width = `${mpPct.toFixed(1)}%`;
    setHtml(elTxtHp, `${Math.round(ch.curHp)}<span class="mx">/${ch.maxHp}</span>`);
    setHtml(elTxtSh, `${Math.round(ch.curShield)}<span class="mx">/${ch.maxShield}</span>`);
    setHtml(elTxtMp, `${Math.round(ch.curMp)}<span class="mx">/${ch.maxMp}</span>`);

    // 黃銅弧尺
    elCombatArcs.classList.toggle('in-combat', ch.inCombatSec > 0 || ch.pkMode || shPct < 98);
    arcHpFill.setAttribute('stroke-dashoffset', (100 - hpPct).toFixed(1));
    arcShieldFill.setAttribute('stroke-dashoffset', (100 - shPct).toFixed(1));
    const broken = ch.curShield <= 0;
    const low = !broken && shPct <= 25;
    elCombatArcs.classList.toggle('shield-low', low);
    elCombatArcs.classList.toggle('shield-broken', broken);
    arcShieldFill.setAttribute('stroke', low || broken ? '#d9583f' : '#c49a4c');
    elHero.classList.toggle('low', low || broken);
    if (broken) setText(shieldWarnBanner, '破罡・承傷 1.15 倍');
    else if (low) {
      setText(shieldWarnBanner, '罡氣危急・快服聚罡散');
      lowShieldSoundTimer -= dt;
      if (lowShieldSoundTimer <= 0) { lowShieldSoundTimer = 2.6; sfx.playShieldBreak(false); }
    }

    // 破罡偵測：鏢師自己的罡氣，或附近被打破罡氣的對手
    if (prevHeroShield > 0 && ch.curShield <= 0) stampBreak();
    prevHeroShield = ch.curShield;
    for (const ent of world.getMapEntities(true)) {
      const prev = prevEntShield.get(ent.id);
      if (prev !== undefined && prev > 0 && ent.curShield <= 0 && ent.maxShield > 0 && ent.curHp > 0) stampBreak();
      prevEntShield.set(ent.id, ent.curShield);
    }
    if (breakTimer > 0) { breakTimer -= dt; if (breakTimer <= 0) elBreak.classList.remove('on'); else placeStamp(); }

    const btnPk = $('btnPk');
    btnPk.setAttribute('aria-pressed', String(!!ch.pkMode));
    btnPk.title = ch.pkMode ? '亮刃中（點一下收刃）' : '亮刃（開啟後可被攻擊，攻擊 +5%）';
    $('btnAutoHunt').classList.toggle('on', !!ch.autoHunt);
    const btnFrenzy = $('btnFrenzy');
    btnFrenzy.classList.toggle('on', ch.frenzyActiveSec > 0);
    btnFrenzy.title = ch.frenzyActiveSec > 0 ? `酣戰 ${Math.ceil(ch.frenzyActiveSec)} 秒` : `酣戰值 ${Math.round(ch.frenzyGauge)}%`;
    btnFrenzy.querySelector('.r1').setAttribute('stroke-dashoffset', (125.66 * (1 - clamp01(ch.frenzyGauge / 100))).toFixed(1));
    const gearFrac = MAPS[ch.mapId]?.isFreeGearZone ? 1 : clamp01(ch.curGear / ch.maxGear);
    for (const b of [$('btnPcMech'), btnWheelMech]) {
      b.classList.toggle('on', ch.mechPhase === 'ACTIVE_MERGED' || ch.mechPhase === 'CASTING_7S');
      b.querySelector('.r1').setAttribute('stroke-dashoffset', (125.66 * (1 - gearFrac)).toFixed(1));
      b.title = `偃甲・樞力 ${MAPS[ch.mapId]?.isFreeGearZone ? '地脈不耗' : Math.round(ch.curGear)}`;
    }
    document.querySelectorAll('[data-loadout]').forEach((b) => b.classList.toggle('active', Number(b.dataset.loadout) === ch.loadoutId));

    const aura = activeWpn.upgrade >= 7 ? `・${getWeaponAuraName(activeWpn.upgrade)}` : '';
    setText($('uiActiveWpnLabel'), merged ? `坐鎮偃甲・${MECH_TIERS[ch.mechTier].name}` : `在手：+${activeWpn.upgrade} ${activeWpn.name}${aura}`);

    // 冷卻遮罩：匣格由上往下蓋漆蓋，扇格用環形
    document.querySelectorAll('[data-cd-for]').forEach((ov) => {
      const sid = ov.dataset.cdFor;
      const rem = world.skillCooldowns[sid] || 0;
      const frac = rem > 0.05 ? clamp01(rem / (SKILLS[sid]?.cd || 1)) : 0;
      const host = ov.parentElement;
      host.classList.toggle('cooling', frac > 0);
      if (host.classList.contains('fan-btn')) {
        ov.style.background = frac > 0 ? `conic-gradient(rgba(10,8,6,0.78) ${(frac * 360).toFixed(0)}deg, transparent 0)` : '';
      } else ov.style.height = `${(frac * 100).toFixed(1)}%`;
    });
    document.querySelectorAll('[data-cdn-for]').forEach((n) => {
      const rem = world.skillCooldowns[n.dataset.cdnFor] || 0;
      setText(n, rem > 0.05 ? rem.toFixed(1) : '');
    });

    setText($('qHp'), String(ch.potions.hp)); setText($('qSh'), String(ch.potions.shield)); setText($('qCl'), String(ch.potions.cleanse));
    setText($('mqHp'), String(ch.potions.hp)); setText($('mqSh'), String(ch.potions.shield));
    setText($('uiMapName'), MAPS[ch.mapId]?.name || '青萍渡');
    setText($('uiChannel'), ch.sandstormNight ? '風沙夜・全區亮刃' : `${CN_NUM[ch.channel - 1] || ch.channel}線・${ch.channel === 1 ? '可亮刃' : '太平'}`);
    if (debug) setText($('uiNetRtt'), `${world.net.lastRttMs} ms`);

    const comp = world.getActiveBountyCompass();
    setHtml($('bountyCompass'), comp
      ? (comp.sameMap
        ? (elHud.dataset.hudMode === 'mobile' ? `追匪 <b>${comp.dist}</b> 步` : `追匪針 <b>${escHtml(comp.bounty.targetName)}</b> ${comp.dist} 步`)
        : `<b>${escHtml(comp.bounty.targetName)}</b> 在${comp.mapName}`)
      : '懸紅榜');

    // 上中：鎖定目標
    const locked = world.entities.find((e) => e.id === ch.lockedTargetId && e.mapId === ch.mapId && e.curHp > 0 && e.respawnRem <= 0);
    const tgtCard = $('targetCard');
    if (locked) {
      tgtCard.classList.remove('empty');
      const tn = $('tgtName');
      setText(tn, `${locked.name}`);
      tn.classList.toggle('bandit', locked.kind === 'BANDIT');
      setText($('tgtElem'), `Lv.${locked.lv}・${ELEMENTS[locked.element || 0].name}${locked.karma ? `・凶名 ${locked.karma}` : ''}`);
      $('tgtHpBar').style.width = `${((locked.curHp / locked.maxHp) * 100).toFixed(1)}%`;
      setText($('tgtHpTxt'), `${Math.round(locked.curHp)}/${locked.maxHp}`);
      $('tgtShBar').style.width = `${(locked.maxShield > 0 ? (locked.curShield / locked.maxShield) * 100 : 0).toFixed(1)}%`;
      setText($('tgtShTxt'), locked.maxShield > 0 ? `罡 ${Math.round(locked.curShield)}` : '無罡');
    } else tgtCard.classList.add('empty');

    const threats = world.getThreatRadarList();
    const tSig = `${threats.map((t) => `${t.id}:${t.id === ch.lockedTargetId ? 1 : 0}`).join('|')}@${window.innerWidth}x${window.innerHeight}:${elHud.dataset.hudMode}`;
    if (tSig !== lastThreatSig) {
      lastThreatSig = tSig;
      const elRadar = $('threatRadar');
      elRadar.innerHTML = threats.map((t) => `<button type="button" class="threat-tag ${t.kind === 'BANDIT' ? 'bandit' : ''} ${t.id === ch.lockedTargetId ? 'locked' : ''}" data-lock-id="${t.id}">${escHtml(t.name)}</button>`).join('');
      elRadar.querySelectorAll('[data-lock-id]').forEach((b) => { b.onclick = () => { world.char.lockedTargetId = b.dataset.lockId; }; });
      // 只排一列：放不下的從尾巴收起（鎖定中的那個不收），收起的數目寫成「+N」
      const kids = () => [...elRadar.children];
      const wrapped = () => { const k = kids(); return k.length > 1 && k.some((c) => c.offsetTop > k[0].offsetTop + 2); };
      let hidden = 0;
      while (wrapped()) {
        const tags = kids().filter((c) => c.dataset.lockId && !c.classList.contains('locked'));
        if (tags.length <= 1 && kids().length <= 2) break;
        const victim = tags[tags.length - 1];
        if (!victim) break;
        victim.remove();
        hidden++;
        let more = elRadar.querySelector('.threat-more');
        if (!more) { more = document.createElement('span'); more.className = 'threat-tag threat-more'; elRadar.appendChild(more); }
        more.textContent = `+${hidden}`;
      }
    }

    const castBanner = $('castBanner');
    const ignite = world.getBeaconState();
    let bannerText = '';
    if (ch.mechPhase === 'CASTING_7S') bannerText = `偃甲上機 ${ch.mechCastRem.toFixed(1)} 秒・受創過三成會被打斷`;
    else if (ignite) bannerText = `點燃烽燧 ${ignite.rem.toFixed(1)} 秒`;
    else if (ch.mapId === 1002) {
      const nb = world.beacons.find((s) => Math.hypot(s.x - ch.x, s.z - ch.z) < 4.0);
      if (nb) bannerText = !nb.revealed ? `按 F 點燃 ${nb.name}` : (nb.isTrue ? `${nb.name}已點燃・守驛人 ${nb.owner}` : `${nb.name}是假烽燧`);
    }
    castBanner.style.display = bannerText ? 'block' : 'none';
    setText(castBanner, bannerText);

    if (ch.arrivedStallId) { ch.arrivedStallId = null; openDrawer('market'); }

    const topMsg = world.chatLogs[0]?.text || '';
    if (topMsg !== lastChatTop) {
      lastChatTop = topMsg;
      $('chatList').innerHTML = world.chatLogs.slice(0, 8).map((c) => {
        const col = CHANNEL_COLOR[c.ch] || '#d8ccb2';
        return `<div><b style="color:${col}">${escHtml(c.ch)}</b>${escHtml(c.text)}</div>`;
      }).join('');
    }

    drawCompass();
    renderWorldLabels(isMoving);
  }

  // ════════════════ 3D 名牌（木牌一行字；劫鏢匪朱紅） ════════════════
  const labelPool = new Map();
  function labelEl(key, cls, tag = 'div') {
    let el = labelPool.get(key);
    if (!el || el._cls !== cls) {
      if (el) el.remove();
      el = document.createElement(tag);
      el.className = cls;
      el._cls = cls;
      elLabels.appendChild(el);
      labelPool.set(key, el);
    }
    el._used = true;
    return el;
  }
  const KIND_OF = { BANDIT: 'bandit', BOSS: 'boss', MOB: 'mob', DUMMY: 'mob' };
  function plate(key, x, y, name, sub, kind, hpFrac) {
    const el = labelEl(key, `plate ${kind}`);
    const html = `<b>${escHtml(name)}</b>${sub ? `<small>${escHtml(sub)}</small>` : ''}${hpFrac != null && hpFrac < 0.999 ? `<span class="hpl"><i style="width:${(hpFrac * 100).toFixed(0)}%"></i></span>` : ''}`;
    setHtml(el, html);
    // 只在名字／副標變動時量外框（血條寬度不影響木牌大小，避免每幀強制排版）
    const sizeKey = `${name}|${sub || ''}|${hpFrac != null && hpFrac < 0.999 ? 1 : 0}`;
    if (el._sk !== sizeKey || !el._pw) { el._sk = sizeKey; el._pw = el.offsetWidth; el._ph = el.offsetHeight; }
    // 木牌整塊夾在視窗內（直式窄螢幕的攤主牌掛著長攤招，錨點靠邊時會被裁掉）
    const vw = window.innerWidth;
    if (el._pw + 8 < vw) x = Math.max(el._pw / 2 + 4, Math.min(vw - el._pw / 2 - 4, x));
    placePlate(el, x, y, kind);
    el._x = x; el._y = y; el._kind = kind; el._lift = 0;
    return el;
  }
  function placePlate(el, x, y, kind) {
    el.style.left = `${x.toFixed(0)}px`;
    el.style.top = `${y.toFixed(0)}px`;
    // 實際木牌外框壓到介面器物就收起（主角的牌不收；傳送口的指路牌被威脅標籤蓋住時讀不到字，一樣收起，羅盤上仍有傳送口記號）
    el.style.visibility = kind !== 'hero' && underPanel(x, y, el._pw / 2 + 4, el._ph + 2) ? 'hidden' : '';
  }
  // 名牌互相讓位：主角的牌不動、畫在最上層；其他牌從畫面下方（通常較近）往上排，跟已排好的牌重疊就疊到那塊牌上面。
  // 整串最多 PLATE_STACK + 1 塊（最底那塊算第 0 層，往上疊 PLATE_STACK 層）：怪擠成一團時不疊成一長串遮住畫面，
  // 疊不下的牌先收起（威脅列仍列著）；層數跟著底下那塊牌累加，不是看各自抬了多高。
  // 沒被抬、但跟下面的牌左右重疊、中間塞不下另一塊牌（間隙 < 自身高度）的也算疊在它上面。鎖定的目標最先排、一定顯示
  const PLATE_STACK = 2;
  function declutterPlates(list) {
    const rect = (el, lvl = 0) => ({ l: el._x - el._pw / 2 - 2, r: el._x + el._pw / 2 + 2, t: el._y - el._ph - 2, b: el._y, lvl });
    const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
    const placed = list.filter((el) => el._kind === 'hero').map((el) => rect(el));
    const locked = world.char.lockedTargetId ? labelPool.get(`a:${world.char.lockedTargetId}`) : null;
    const rest = list.filter((el) => el._kind !== 'hero').sort((a, b) => (b === locked) - (a === locked) || b._y - a._y);
    for (const el of rest) {
      if (el.style.visibility === 'hidden') continue; // 壓到介面器物、已收起的牌不佔位
      const y0 = el._y;
      let free = false, lvl = 0;
      for (let k = 0; k < 8; k++) {
        const o = placed.find((q) => hit(rect(el), q));
        if (!o) { free = true; break; }
        lvl = Math.max(lvl, o.lvl + 1);
        if (lvl > PLATE_STACK && el !== locked) break;
        el._y = o.t - 1;
      }
      if (free) {
        const r = rect(el);
        for (const q of placed) if (r.l < q.r && r.r > q.l && q.t - r.b > -1 && q.t - r.b < el._ph) lvl = Math.max(lvl, q.lvl + 1);
        if (lvl > PLATE_STACK && el !== locked) free = false;
      }
      if (!free && el !== locked) { el._y = y0; el._lift = 0; el.style.visibility = 'hidden'; continue; }
      placed.push(rect(el, Math.min(lvl, PLATE_STACK)));
      if (el._y !== y0) { el._lift = y0 - el._y; placePlate(el, el._x, el._y, el._kind); }
    }
  }

  // 名牌不壓在介面器物上：估計木牌外框（錨點在牌底中央），碰到鏢單／羅盤／匣／驛報就不畫
  // 整塊器物用自身外框；#topCenter、#skillFan 是鋪滿的容器，改量裡面看得見的子件
  const PANEL_IDS = ['heroBox', 'compass', 'mapFlag', 'bountyCompass', 'chatBox', 'pcBar', 'uiActiveWpnLabel', 'sideTabs', 'btnMobileTabs', 'joyZone', 'mobPotions', 'btnWheelMech'];
  const PANEL_KIDS = ['#topCenter > *', '#threatRadar > *', '#skillFan > *'];
  let panelRects = [];
  function pushRect(el) {
    if (!el || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.width < window.innerWidth * 0.9) panelRects.push(r);
  }
  function collectPanels() {
    panelRects = [];
    for (const id of PANEL_IDS) pushRect(document.getElementById(id));
    for (const sel of PANEL_KIDS) for (const el of document.querySelectorAll(sel)) if (el.id !== 'threatRadar') pushRect(el);
  }
  function underPanel(x, y, halfW = 64, tall = 38) {
    for (const r of panelRects) {
      if (x + halfW > r.left && x - halfW < r.right && y + 4 > r.top && y - tall < r.bottom) return true;
    }
    return false;
  }

  // 跳字（錨點在底邊中央，寬 fw、高 fh）壓到介面器物或「破」印時，找最近的空位：
  // 候選點是貼著壓到的那塊的左、右、下、上緣，再夾回視窗安全區；一輪找不到就從候選點再試一輪，都不行就維持原位
  function dodgePanels(fx, fy, fw, fh, w, h, extra) {
    const rects = extra ? [...panelRects, { left: extra.l, right: extra.r, top: extra.t, bottom: extra.b }] : panelRects;
    const over = (x, y) => rects.find((r) => x + fw / 2 > r.left && x - fw / 2 < r.right && y > r.top && y - fh < r.bottom);
    const clampX = (x) => (fw + 16 < w ? Math.max(fw / 2 + 8, Math.min(w - fw / 2 - 8, x)) : x);
    const clampY = (y) => Math.max(fh + 8, Math.min(h - 8, y));
    if (!over(fx, fy)) return [fx, fy];
    let front = [[fx, fy]];
    for (let round = 0; round < 2; round++) {
      const next = [];
      for (const [x, y] of front) {
        const r = over(x, y);
        if (!r) continue;
        for (const c of [[r.left - fw / 2 - 6, y], [r.right + fw / 2 + 6, y], [x, r.bottom + fh + 6], [x, r.top - 6]]) next.push([clampX(c[0]), clampY(c[1])]);
      }
      const ok = next.filter(([x, y]) => !over(x, y));
      if (ok.length) return ok.reduce((a, b) => (Math.hypot(a[0] - fx, a[1] - fy) <= Math.hypot(b[0] - fx, b[1] - fy) ? a : b));
      front = next;
    }
    return [fx, fy];
  }

  function renderWorldLabels(isMoving) {
    const w = window.innerWidth, h = window.innerHeight;
    const ch = world.char;
    collectPanels();
    for (const el of labelPool.values()) el._used = false;
    const anchors = safe(() => sceneView.anchors?.());
    const hasVendorAnchors = Array.isArray(anchors) && anchors.some((a) => a.kind === 'vendor');

    if (Array.isArray(anchors)) {
      const mobile = elHud.dataset.hudMode === 'mobile';
      const far = mobile ? 15 : 22;
      const fold = isMoving && !ch.browseStallMode;
      const stallsById = new Map((world.getPlayerStall() ? [world.getPlayerStall(), ...world.stalls] : world.stalls).map((st) => [st.id, st]));
      const shown = [];
      for (const a of anchors) {
        if (!a?.pos) continue;
        if (a.kind !== 'hero' && a.kind !== 'portal' && Math.hypot(a.pos.x - ch.x, a.pos.z - ch.z) > far) continue;
        const p = sceneView.projectToScreen(a.pos.x, a.pos.y, a.pos.z, w, h);
        if (!p || p.x < 10 || p.x > w - 10 || p.y < 24 || p.y > h - 30) continue;
        const ent = a.kind === 'mob' || a.kind === 'boss' || a.kind === 'bandit' ? world.entities.find((e) => e.id === a.id) : null;
        const hp = ent && ent.maxHp ? ent.curHp / ent.maxHp : null;
        let sub = a.sub;
        if (a.kind === 'vendor') {
          // 攤主名牌底下掛攤招；走路時收起，只留名字
          const st = stallsById.get(a.id);
          sub = fold ? '' : (st?.title || a.sub);
        }
        const el = plate(`a:${a.id}`, p.x, p.y, a.name, sub, a.kind || 'npc', hp);
        if (a.kind === 'vendor' && !el._bound) { el._bound = true; el.addEventListener('click', () => openDrawer('market')); }
        shown.push(el);
      }
      declutterPlates(shown);
    } else {
      // 退回：自己投影鏢師、怪物與劫鏢匪
      const hp0 = sceneView.projectToScreen(ch.x, 2.3, ch.z, w, h);
      if (hp0) plate('hero', hp0.x, hp0.y, ch.name, null, 'hero', null);
      for (const ent of world.getMapEntities(false)) {
        if (Math.hypot(ent.x - ch.x, ent.z - ch.z) > 20) continue;
        const p = sceneView.projectToScreen(ent.x, ent.kind === 'BOSS' ? 3.5 : 2.25, ent.z, w, h);
        if (!p || p.x < 10 || p.x > w - 10 || p.y < 24 || p.y > h - 30) continue;
        plate(`e:${ent.id}`, p.x, p.y, ent.name, ent.kind === 'BANDIT' ? '劫鏢匪' : null, KIND_OF[ent.kind] || 'mob', ent.curHp / ent.maxHp);
      }
    }

    // 攤招（布招；行走時收成小牌）——場景已有 vendor 名牌時不重複畫
    if (ch.mapId === 1001 && !hasVendorAnchors) {
      const allStalls = world.getPlayerStall() ? [world.getPlayerStall(), ...world.stalls] : world.stalls;
      const fold = isMoving && !ch.browseStallMode;
      for (const st of allStalls) {
        const p = sceneView.projectToScreen(st.x, 2.6, st.z, w, h);
        if (!p || p.x < -60 || p.x > w + 60 || p.y < 30 || p.y > h - 40 || underPanel(p.x, p.y, 80, 40)) continue;
        const el = labelEl(`s:${st.id}`, 'w-stall-sign', 'button');
        el.type = 'button';
        el.classList.toggle('folded', fold);
        setText(el, fold ? st.owner : st.title);
        el.style.left = `${p.x.toFixed(0)}px`;
        el.style.top = `${p.y.toFixed(0)}px`;
        if (!el._bound) { el._bound = true; el.addEventListener('click', () => openDrawer('market')); }
      }
    }

    // 跳字：從名牌頂上往上長（不壓名牌），同一個對象同時好幾則就往上錯開、左右交錯；
    // 招式名大字放在畫面下方，蓋「破」印的那一下先不出
    const anchorById = new Map((Array.isArray(anchors) ? anchors : []).map((a) => [a.id, a]));
    const stackOf = new Map();
    const stamping = breakTimer > 0;
    for (let i = world.floatTexts.length - 1; i >= 0; i--) {
      const ft = world.floatTexts[i];
      const el = labelEl(`f:${i}`, `w-float${ft.big ? ' big' : ''}${ft.kind === 'skill' ? ' skill' : ''}`);
      setText(el, ft.text);
      el.style.color = ft.color;
      const fade = Math.max(0, 1 - ft.age / ft.ttl);
      if (ft.kind === 'skill') {
        const mobileMode = elHud.dataset.hudMode === 'mobile';
        el.style.left = `${(w / 2).toFixed(0)}px`;
        el.style.top = `${(mobileMode ? h * 0.64 : h - 196).toFixed(0)}px`;
        el.style.opacity = stamping ? '0' : fade.toFixed(2);
        continue;
      }
      const a = ft.id ? anchorById.get(ft.id) : null;
      const rise = ft.y - 2.3;
      const p = a ? sceneView.projectToScreen(a.pos.x, a.pos.y + rise, a.pos.z, w, h) : sceneView.projectToScreen(ft.x, ft.y, ft.z, w, h);
      if (!p) { el.style.opacity = '0'; continue; }
      const key = ft.id || `xz:${ft.x.toFixed(1)},${ft.z.toFixed(1)}`;
      const n = stackOf.get(key) || 0;
      stackOf.set(key, n + 1);
      const plateEl = a ? labelPool.get(`a:${a.id}`) : null;
      const lift = (plateEl?._ph || (a ? 30 : 0)) + (plateEl?._lift || 0) + 4 + n * 18;
      const dx = n === 0 ? 0 : (n % 2 ? 14 : -14);
      let fx = p.x + dx;
      let fy = p.y - lift;
      // 「破」印蓋著的時候，落在印章範圍裡的跳字往印章旁邊讓（靠哪邊就往哪邊）
      if (stamping && stampBox) {
        const fw = el.offsetWidth || 60, fh = el.offsetHeight || 20;
        const inCol = fx + fw / 2 > stampBox.l && fx - fw / 2 < stampBox.r;
        // 壓在印上，或被印推到上方的介面器物（目標框、威脅標籤）底下，都要讓
        if (inCol && ((fy > stampBox.t && fy - fh < stampBox.b) || (fy <= stampBox.t && underPanel(fx, fy, fw / 2, fh)))) {
          const cx = (stampBox.l + stampBox.r) / 2;
          const right = stampBox.r + fw / 2 + 6, left = stampBox.l - fw / 2 - 6;
          const side = (x) => Math.max(fw / 2 + 4, Math.min(w - fw / 2 - 4, x));
          // 先往靠近的那邊讓；那邊壓到介面器物（目標框、威脅標籤）就換另一邊，兩邊都壓到就落到印章下緣
          const order = fx >= cx ? [right, left] : [left, right];
          const pick = order.map(side).find((x) => !underPanel(x, fy, fw / 2, fh));
          if (pick !== undefined) fx = pick;
          else { fx = side(fx); fy = stampBox.b + fh + 6; }
        }
      }
      // 跳字整塊夾在視窗安全區內（四邊留 8 px）：貼著畫面頂端或左右緣時不被切掉
      if (el._mt !== ft.text) { el._mt = ft.text; el._fw = el.offsetWidth; el._fh = el.offsetHeight; }
      if (el._fw + 16 < w) fx = Math.max(el._fw / 2 + 8, Math.min(w - el._fw / 2 - 8, fx));
      fy = Math.max(el._fh + 8, Math.min(h - 8, fy));
      // 夾回畫面後壓到介面器物（目標錨點在畫面外時常被夾到右上角的地圖旗、懸紅榜上）：挪到最近的空處
      [fx, fy] = dodgePanels(fx, fy, el._fw || 60, el._fh || 20, w, h, stamping ? stampBox : null);
      el.style.left = `${fx.toFixed(0)}px`;
      el.style.top = `${fy.toFixed(0)}px`;
      el.style.opacity = fade.toFixed(2);
    }

    for (const [k, el] of labelPool) {
      if (!el._used) { el.remove(); labelPool.delete(k); }
    }
  }

  applyHudMode();
  rebuildSkillBars();

  return {
    startGame,
    openDrawer,
    closeDrawer,
    applyHudMode,
    rebuildSkillBars,
    updateHud,
    setMuted,
    slotSkill,
    getLook: () => ({ ...look }),
    getJoyVector: () => ({ x: joyState.dx, z: joyState.dz }),
    isIntroOpen: () => !elIntro.classList.contains('hidden'),
    isDrawerOpen: () => !elDrawer.classList.contains('hidden'),
  };
}
