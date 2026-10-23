// ═══ 第三階段：三位主角、特殊能力條、角色轉盤與高空切換 ═══
// 數值照 neon_nightcity_gta_v_2.md 第三節：能力條 100，啟動後每秒耗 12.5（最長 8 秒，用真實時間算）。
// 錢包、武器與車庫三人共用；生命、護甲、能力條與所在位置各自記著。開場的主角是 Kael（Kestrel 是他的車）。
// 排在 69-combat 之後、69-police 之前：頂層只能用 69-combat 以前宣告的東西，W、wantedClear 只在函式裡用。

const SP_MAX = 100, SP_DRAIN = 12.5;
const CREW = [
  { id: 'vance', name: 'Vance', zh: '范斯', role: '退休特工', ab: 'bullet', abName: '神經時間減緩', col: '#9cb8f0', hp: 100, armor: 100,
    home: spotW({ x: lerp(avX(4) + HR + SW, avX(5) - HR - SW, .35), z: stZ(3) + HR + SW * .5, yaw: Math.PI, name: '中城公寓' }), idle: ANIM.smoke,
    look: { female: false, top: lin(0x1c2230), bot: lin(0x15171c), skin: SKINS[0], hair: lin(0x5f5a55), coat: 1, skirt: 0, longHair: 0, hat: 0, shoe: SHOES[1], glow: lin(0x9cb8f0), glowI: 1.1, scale: 1.02 } },
  { id: 'kael', name: 'Kael', zh: '凱爾', role: '地下車手', ab: 'reflex', abName: '極限反射駕駛', col: '#62e6d8', hp: 100, armor: 50,
    home: spotW({ x: GAR_X + 5, z: GAR_Z + SW * .5, yaw: Math.PI, name: 'CHROME WORKS' }), idle: ANIM.cross,
    look: { female: false, top: lin(0x2b2420), bot: lin(0x17181c), skin: SKINS[1], hair: HAIRS[0], coat: 1, skirt: 0, longHair: 0, hat: 0, shoe: SHOES[0], glow: lin(0xffae57), glowI: 1.4, scale: 1 } },
  { id: 'jax', name: 'Jax', zh: '賈克斯', role: '軍火走私', ab: 'rage', abName: '腎上腺素狂暴', col: '#ff8a4c', hp: 120, armor: 80,
    home: spotW({ x: lerp(avX(0) + HR + SW, avX(1) - HR - SW, .4), z: stZ(0) + HR + SW * .5, yaw: Math.PI, name: '舊碼頭倉庫' }), idle: ANIM.cross,
    look: { female: false, top: lin(0x3a4430), bot: lin(0x2a2620), skin: SKINS[2], hair: HAIRS[1], coat: 0, skirt: 0, longHair: 0, hat: 1, shoe: SHOES[2], glow: lin(0xff8a4c), glowI: 1.3, scale: 1.06 } },
];
const crew = {
  cur: 1, on: false, sw: null, hurtAcc: 0, crashCd: 0, capsT: 0, tk: 0, nm: new WeakMap(),
  st: CREW.map(c => ({ hp: c.hp, armor: c.armor, sp: 40, x: c.home.x, z: c.home.z, yaw: c.home.yaw, where: 'out' })),
  wheel: { open: false, kb: false, x: 0, y: 0, sel: -1 },
};
crew.st[1].sp = 60;
// 不在操作中的兩位主角：站在自己最後的位置（一開始在家門口）
const crewNpc = crowd(2);
const crewNpcOf = [0, 2];
function crewLook() {
  crewNpcOf.length = 0;
  for (let i = 0; i < 3; i++) if (i !== crew.cur) crewNpcOf.push(i);
  crewNpcOf.forEach((ci, j) => crewNpc.look(j, { r: rng(31 + ci), ...CREW[ci].look }));
}
crewLook();

// ─── 特殊能力條 ───
function spAdd(n) {
  const s = crew.st[crew.cur], was = s.sp;
  s.sp = Math.min(SP_MAX, s.sp + n);
  if (was < SP_MAX && s.sp >= SP_MAX) toast(`${CREW[crew.cur].abName}充滿了 · 按 Caps Lock 或 X 啟動`);
}
// 充能事件（69-combat.js 呼叫）：kill(爆頭, 近戰)、boom、hurt(扣掉的生命)
function spEvent(kind, a, b) {
  skillEvent(kind, a, b);   // 69-v3-skills.js：六圍升級
  if (crew.on || crew.sw) return;
  const ab = CREW[crew.cur].ab;
  if (kind === 'kill') {
    if (ab === 'bullet') { if (a) spAdd(15); if (b && !W.stars) spAdd(20); }   // 爆頭擊殺、沒被通緝時的近戰擊倒（潛行）
    if (ab === 'rage') spAdd(12);
  } else if (kind === 'boom') { if (ab === 'rage') spAdd(12); }
  else if (kind === 'hurt' && ab === 'rage') {
    crew.hurtAcc += a;
    while (crew.hurtAcc >= 10) { crew.hurtAcc -= 10; spAdd(5); }
  }
}
function abilityOn() {
  const c = CREW[crew.cur], s = crew.st[crew.cur];
  if (crew.on || life.dead || crew.sw || player.where !== 'out') return;
  if (s.sp < 10) { toast(`${c.abName}還沒充好`); return; }
  if (c.ab === 'bullet' && player.mode !== 'walk') { toast(`${c.name} 的時間減緩只能下車用`); return; }
  if (c.ab === 'reflex' && player.mode !== 'drive') { toast(`${c.name} 的反射駕駛要在開車時用`); return; }
  crew.on = true; sfx.ability(true); applyAbil();
}
function abilityOff() { if (!crew.on) return; crew.on = false; sfx.ability(false); applyAbil(); }
function abilityToggle() { if (crew.on) abilityOff(); else abilityOn(); }
// 每幀依目前主角與是否啟動改寫 abil（69-combat.js 讀）與子彈時間
function applyAbil() {
  const ab = crew.on ? CREW[crew.cur].ab : '';
  abil.take = ab === 'rage' ? .15 : 1;
  abil.out = ab === 'rage' ? 2 : ab === 'bullet' ? 1.25 : 1;
  abil.spread = abil.recoil = ab === 'bullet' ? .2 : 1;
  abil.melee = ab === 'rage'; abil.knock = ab === 'rage' ? 3 : 1; abil.floor = ab === 'rage' ? 1 : 0;
  abil.drive = ab === 'reflex';
  slowmo.ab = ab === 'bullet' ? .4 : ab === 'reflex' ? .35 : 1;
}
// 擦身而過：開得夠快、和車流的車身距離不到 1 m 又沒撞上，每台車 3 秒內只算一次
function nearMiss(v, now) {
  if (Math.hypot(v.vx, v.vz) < 14 || gta.lastImp > 1) return;
  for (const c of traffic) {
    const d = Math.hypot(c.x - v.x, c.z - v.z);
    if (d > 4.2 || d < 2.3) continue;
    if ((crew.nm.get(c) || -9) > now - 3) continue;
    crew.nm.set(c, now); spAdd(8); skillEvent('near');
  }
}

// ─── 角色轉盤（按住 Q；觸控「角色」）：三格扇形，選中填上該角色的顏色 ───
function crewWheelOpen() {
  const w = crew.wheel;
  if (w.open || arm.wheel.open || life.dead || crew.sw || player.where !== 'out') return;
  w.open = true; w.kb = !!keys.KeyQ; w.x = w.y = 0; w.sel = -1;
  arm.trig = false; slowmo.want = .3;
  drawCrewWheel(); $('crewW').classList.add('on'); document.body.classList.add('wheel');
}
function crewWheelClose(apply) {
  const w = crew.wheel;
  if (!w.open) return;
  w.open = false; $('crewW').classList.remove('on'); document.body.classList.remove('wheel');
  slowmo.want = 1;
  if (apply && w.sel >= 0) crewSwitch(w.sel);
}
function crewWheelMove(dx, dy) {
  const w = crew.wheel;
  w.x += dx; w.y += dy;
  const l = Math.hypot(w.x, w.y);
  if (l > 120) { w.x *= 120 / l; w.y *= 120 / l; }
  if (l < 30) return;
  const s = ((Math.round(Math.atan2(w.x, -w.y) / (Math.PI * 2 / 3)) % 3) + 3) % 3;
  if (s !== w.sel && s !== crew.cur) { w.sel = s; sfx.click(); drawCrewWheel(); }   // 目前操作的角色那格不能選
}
function drawCrewWheel() {
  const w = crew.wheel, R1 = 70, R2 = 176, gap = .03;
  const P = (a, r) => `${(Math.sin(a) * r).toFixed(1)} ${(-Math.cos(a) * r).toFixed(1)}`;
  let s = `<svg viewBox="-190 -190 380 380" aria-hidden="true">`;
  for (let i = 0; i < 3; i++) {
    const c = CREW[i], st = crew.st[i], a0 = (i - .5) * Math.PI * 2 / 3 + gap, a1 = (i + .5) * Math.PI * 2 / 3 - gap, sel = i === w.sel, cur = i === crew.cur;
    const am = (a0 + a1) / 2, cx = Math.sin(am) * 124, cy = -Math.cos(am) * 124;
    const where = cur ? '目前' : `${Math.round(Math.hypot(st.x - player.x, st.z - player.z))} m · ${st.near || c.home.name}`;
    s += `<g class="${sel ? 'sel' : ''}" data-c="${i}" style="--c:${c.col}"><path class="sec${sel ? ' sel' : ''}${cur ? ' none' : ''}" data-c="${i}" d="M${P(a0, R2)} A${R2} ${R2} 0 0 1 ${P(a1, R2)} L${P(a1, R1)} A${R1} ${R1} 0 0 0 ${P(a0, R1)} Z"/>`;
    s += `<rect class="cbar" x="${(cx - 30).toFixed(1)}" y="${(cy - 34).toFixed(1)}" width="60" height="3" rx="1.5"/>`;
    s += `<text x="${cx.toFixed(1)}" y="${(cy - 8).toFixed(1)}">${c.name} <tspan class="sm">${c.zh}</tspan></text>`;
    s += `<text class="sm" x="${cx.toFixed(1)}" y="${(cy + 10).toFixed(1)}">${c.abName}</text>`;
    s += `<text class="sm" x="${cx.toFixed(1)}" y="${(cy + 26).toFixed(1)}">${where}</text></g>`;
  }
  const pick = w.sel >= 0 ? CREW[w.sel] : CREW[crew.cur];
  s += `<circle id="cwC" r="${R1 - 8}"/><text id="cwName" y="-2">${pick.name}</text><text class="sm" y="16">${pick.role}</text></svg>`;
  $('crewW').innerHTML = s;
}
$('crewW').addEventListener('pointerdown', e => {
  if (e.target.id === 'cwC') { e.preventDefault(); crewWheelClose(false); return; }
  const t = e.target.closest('[data-c]'); if (!t) return;
  e.preventDefault(); const i = +t.dataset.c; crew.wheel.sel = i === crew.cur ? -1 : i; crewWheelClose(true);
});

// ─── 切換：鏡頭拉到高空雲層 → 平移到另一位主角上方 → 俯衝下來（真實時間 2.7 秒） ───
const SW_UP = 1, SW_PAN = .7, SW_DOWN = 1, SW_H = 150, CLOUD = lin(0x4e4652);
function crewSwitch(i) {
  if (i === crew.cur || crew.sw || life.dead || fading || dlg.open) return;
  if (W.stars > 0) { toast('通緝中不能切換角色'); return; }
  if (player.swim) { toast('在水裡不能切換角色'); return; }
  if (player.where !== 'out') { toast('到室外才能切換角色'); return; }
  abilityOff();
  if (player.mode === 'drive') exitVehicle();
  if (gta.aiming) gta.aiming = false;
  const st = crew.st[i];
  crew.sw = { i, t: 0, fx: player.x, fz: player.z, tx: st.x, tz: st.z, q0: camera.quaternion.clone(), p0: camera.position.clone(), swapped: false, fog: U.uFogCol.value.clone(), den: U.uFogDen.value };
  sfx.swoosh(true);
}
function crewSave() {
  const s = crew.st[crew.cur];
  s.hp = life.hp; s.armor = life.armor; s.x = player.x; s.z = player.z; s.yaw = player.yaw; s.where = player.where;
  s.near = districtW(player.x, player.z).split(' ')[0];
}
function crewLoad(i) { crewSave(); crewApply(i); }
// 換成第 i 位主角（不先存目前這位；快速讀檔直接用）
function crewApply(i) {
  crew.cur = i;
  const c = CREW[i], s = crew.st[i];
  life.max = c.hp; life.hp = s.hp; life.armor = s.armor; life.hurtT = 9; crew.hurtAcc = 0;
  setWhere('out');
  player.x = s.x; player.z = s.z; player.y = groundH(s.x, s.z); player.yaw = s.yaw; player.v = 0; player.down = 0; player.dance = 0; player.anim = -1;
  camState.yaw = s.yaw; camState.pitch = .16; camState.snap = true;
  me.look(0, { r: rng(9), ...c.look });
  crewLook();
  equip('fist', true);
}
const _cq = new T.Quaternion(), _cp = V3(), _cl = V3();
const ease = u => u < .5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
function skyAt(x, z, out) {
  // 高空鏡頭：在目標南邊一點、往下看（純往下看時 lookAt 會退化）
  camera.position.set(x, SW_H, z - 40); camera.lookAt(x, 0, z);
  out.copy(camera.quaternion);
  return _cl.set(x, SW_H, z - 40);
}
function crewCam() {
  const w = crew.sw;
  if (!w) return;
  w.t += slowmo.raw;
  const t = w.t, normP = camera.position.clone(), normQ = camera.quaternion.clone();
  let gray = 0;
  if (t < SW_UP) {
    const u = ease(t / SW_UP), sky = skyAt(w.fx, w.fz, _cq).clone();
    camera.position.lerpVectors(w.p0, sky, u); camera.quaternion.copy(w.q0).slerp(_cq, Math.min(1, u * 1.3));
    gray = u;
  } else if (t < SW_UP + SW_PAN) {
    const u = ease((t - SW_UP) / SW_PAN);
    skyAt(lerp(w.fx, w.tx, u), lerp(w.fz, w.tz, u), _cq);
    gray = 1;
    if (!w.swapped && u > .5) { w.swapped = true; crewLoad(w.i); sfx.swoosh(false); }
  } else if (t < SW_UP + SW_PAN + SW_DOWN) {
    if (!w.swapped) { w.swapped = true; crewLoad(w.i); }
    const u = ease((t - SW_UP - SW_PAN) / SW_DOWN), sky = skyAt(w.tx, w.tz, _cq).clone();
    camera.position.lerpVectors(sky, normP, u); camera.quaternion.copy(_cq).slerp(normQ, Math.min(1, u * 1.15));
    gray = 1 - u;
  } else {
    crew.sw = null; camera.position.copy(normP); camera.quaternion.copy(normQ);
    U.uFogCol.value.copy(w.fog); U.uFogDen.value = w.den;
    toast(`${CREW[crew.cur].name} · ${CREW[crew.cur].role}`);
  }
  camera.updateMatrixWorld();
  camState.snap = true;   // 這幾幀不做動態模糊
  // 雲層：高空時霧變亮、變濃，像穿過被城市燈光照亮的低雲
  if (crew.sw) { U.uFogCol.value.copy(w.fog).lerp(CLOUD, gray * .7); U.uFogDen.value = w.den + gray * .0015; }
  post.gray = Math.max(post.gray, gray * .55);
}

// ─── 每幀 ───
function crewPre() {
  if (crew.sw) { inp.mx = inp.mz = 0; inp.run = false; inp.thr = inp.brk = inp.steer = 0; inp.hb = false; }
}
function crewUpdate(dt) {
  const c = CREW[crew.cur], s = crew.st[crew.cur], now = uTimeNow();
  crew.crashCd -= dt;
  if (!crew.on && !life.dead && !crew.sw && player.where === 'out') {
    if (c.ab === 'bullet' && life.hp < life.max * .25) spAdd(2 * dt);
    if (player.mode === 'drive') {
      const v = player.veh, sp = Math.hypot(v.vx, v.vz);
      if (c.ab === 'reflex') { if (sp > v.vmax * .8) spAdd(4 * dt); if (v.slip > 3 && sp > 8) spAdd(6 * dt); nearMiss(v, now); }
      if (c.ab === 'rage' && gta.lastImp > 8 && crew.crashCd <= 0) { spAdd(10); crew.crashCd = 1; }
    }
  }
  if (crew.on) {
    s.sp = Math.max(0, s.sp - SP_DRAIN * slowmo.raw);
    if (s.sp <= 0 || life.dead || player.where !== 'out' || (c.ab === 'bullet' && player.mode !== 'walk') || (c.ab === 'reflex' && player.mode !== 'drive')) abilityOff();
  }
  applyAbil();
  // 另外兩位主角站在原地（室外、120 m 內才擺出來）
  crewNpcOf.forEach((ci, j) => {
    const st = crew.st[ci];
    if (st.where === 'out' && Math.hypot(st.x - camera.position.x, st.z - camera.position.z) < 120) {
      crewNpc.place(j, st.x, groundH(st.x, st.z), st.z, st.yaw);
      crewNpc.anim(j, CREW[ci].idle, ci * 1.7, 1);
    } else crewNpc.place(j, 0, -60, 0, 0);
  });
}
function crewLate() {
  crewCam();
  const c = CREW[crew.cur], s = crew.st[crew.cur];
  crew.tk = damp(crew.tk, crew.on ? 1 : 0, crew.on ? 7 : 4, slowmo.raw);
  const k = crew.tk;
  if (k > .01) {
    if (c.ab === 'rage') { post.tint.set(2.4, .8, .15, .8 * k); post.vig = Math.max(post.vig, .45 * k); }
    else if (c.ab === 'bullet') { post.tint.set(.82, .96, 1.18, .38 * k); post.vig = Math.max(post.vig, .25 * k); }
    else { post.tint.set(.86, 1.06, 1.04, .3 * k); post.vig = Math.max(post.vig, .2 * k); }
  } else post.tint.w = 0;
  const v = Math.round(s.sp);
  if (hudCache.sp !== v) { hudCache.sp = v; $('spBar').style.setProperty('--v', v + '%'); }
  const st = (crew.on ? 'on' : '') + (v >= SP_MAX ? ' full' : '');
  if (hudCache.spSt !== st) { hudCache.spSt = st; $('spBar').className = st; }
  if (hudCache.crewC !== c.col) { hudCache.crewC = c.col; $('vitals').style.setProperty('--crew', c.col); }
}

// ─── 按鍵：Q 按住開角色轉盤、X 或 Caps Lock 開關特殊能力 ───
function crewKey(code) {
  if (code === 'KeyQ' || code === 'Crew') { if (crew.wheel.open) crewWheelClose(code === 'KeyQ'); else crewWheelOpen(); return true; }
  if (code === 'KeyX' || code === 'Ability') { abilityToggle(); return true; }
  return false;
}
addEventListener('keyup', e => { if (e.code === 'KeyQ' && crew.wheel.open && crew.wheel.kb) crewWheelClose(true); });
// Caps Lock：macOS 每按一次只送 keydown 或 keyup 其中之一，Windows 兩個都送；250 ms 內只算一次
const capsToggle = e => {
  if (e.code !== 'CapsLock' || !started || dlg.open) return;
  const now = performance.now();
  if (now - crew.capsT < 250) return;
  crew.capsT = now; abilityToggle();
};
addEventListener('keydown', capsToggle); addEventListener('keyup', capsToggle);

// ─── CHROME WORKS 噴漆消星：通緝中但警察沒看到時，開車停到門口付 $1,000 換色換牌，通緝清除 ───
// 60-venues.js 的 contextAction 在開車時先問這裡（ctxHooks 在 60 才宣告，這裡不能在頂層掛）
const RESPRAY = 1000;
function resprayCtx(v) {
  if (!W.stars || Math.hypot(v.x - toW(GAR_X, GAR_Z + SW + 4)[0], v.z - toW(GAR_X, GAR_Z + SW + 4)[1]) > 6 || Math.hypot(v.vx, v.vz) > 2 || motors.test) return null;
  if (W.seen) return { key: 'E', text: '警察還看得到你 <i>· 先甩開視線</i>', fn: () => toast('被盯著的時候 CHROME WORKS 不開門') };
  return { key: 'E', text: `噴漆換牌、甩掉通緝 <i>· ${money(RESPRAY)}</i>`, fn: () => respray(v) };
}
function respray(v) {
  if (motors.cash < RESPRAY) { toast('錢不夠噴漆'); return; }
  transition(() => {
    motors.cash -= RESPRAY; saveMotors();
    const id = v.carId;
    if (v === kestrel && CARS[id] && (!CARS[id].glb || CARS[id].paintable)) {
      const opts = [CARS[id].paint, ...LIVERIES.map(l => l[0])].filter(c => c !== kestrel.paint);
      const c = opts[Math.floor(Math.random() * opts.length)];
      applyCar(kestrel, id, c); poseVehicle(kestrel); motors.paint[id] = c; saveMotors();
    }
    wantedClear('respray'); W.lastVeh = null;
    sfx.spray(); toast(`CHROME WORKS 噴好了 · 警察認不出這台車（${money(RESPRAY)}）`);
  });
}

// 測試 API（window.__nc.gta.crew）
const crewApi = {
  CREW, crew, abil,
  sw: i => crewSwitch(i), sp(n) { crew.st[crew.cur].sp = n; }, on: abilityOn, off: abilityOff,
  wheelOpen: crewWheelOpen, wheelMove: crewWheelMove, wheelClose: crewWheelClose, event: spEvent, respray, resprayCtx,
};
