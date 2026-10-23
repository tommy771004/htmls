// ═══ 第二階段：武器庫、武器轉盤與子彈時間、投射物與爆炸、生命與護甲、WASTED／BUSTED、路人反應、載具互撞 ═══
// 數值照 neon_nightcity_gta_v_2.md 的武器表（傷害、射速 rpm、彈匣、換彈秒數、射程 m、散布度）。
// 每幀：combatUpdate 在 gtaUpdate 裡（遊戲時間，會被子彈時間放慢），combatLate 在 gtaLate 裡（武器擺到手上、HUD）。
// 這個檔案排在 68-gta.js 之後、69-police.js 之前：頂層不能碰 70 以後的東西（post、hudCache、camState、inp、keys、started）。

// slot：轉盤上的格子（0 在正上方，順時針）。grip／muzzle 是模型座標（原點在包圍盒中心、+z 朝槍口），握把放在右手。
// head：爆頭倍率；db：車內射擊（1 汽車機車都行、'bike' 只有機車）；stun：電擊槍麻痺秒數
const ARMS = {
  fist: { slot: 0, name: '徒手', melee: 1, fist: 1, dmg: 20, reach: 1.5, cd: .55 },
  baton: { slot: 0, name: '警棍', melee: 1, dmg: 40, reach: 1.8, cd: .6, grip: [0, 0, -.17] },
  bat: { slot: 0, name: '球棒', melee: 1, dmg: 60, reach: 2, cd: .75, grip: [0, 0, -.31] },
  katana: { slot: 0, name: '武士刀', melee: 1, dmg: 85, reach: 2.2, cd: 60 / 90, kill: 1, db: 'bike', grip: [0, 0, -.38] },
  pistol: { slot: 1, name: '手槍', gun: 1, dmg: 28, rpm: 240, mag: 16, rel: 1.2, range: 60, spread: 1.5, head: 2.5, db: 1, f: 1, res: 96, grip: [0, -.035, -.05], muzzle: [0, .035, .1] },
  stun: { slot: 1, name: '電擊槍', gun: 1, stun: 5, dmg: 10, rpm: 20, mag: 1, rel: 3, range: 12, spread: .5, head: 1, db: 1, f: .35, res: 24, grip: [0, -.035, -.05], muzzle: [0, .03, .09] },
  smg: { slot: 2, name: '衝鋒槍', gun: 1, auto: 1, dmg: 22, rpm: 750, mag: 30, rel: 1.6, range: 55, spread: 4.2, head: 2, db: 1, f: .7, res: 240, grip: [0, -.02, -.03], muzzle: [0, .08, .15] },
  rifle: { slot: 3, name: '突擊步槍', gun: 1, auto: 1, dmg: 36, rpm: 650, mag: 40, rel: 2, range: 110, spread: 1.8, head: 2.2, f: 1.3, res: 240, grip: [0, -.03, -.175], muzzle: [0, .07, .42] },
  shotgun: { slot: 4, name: '霰彈槍', gun: 1, dmg: 18, pel: 8, rpm: 70, mag: 8, rel: 2.8, range: 25, spread: 8.5, head: 1.5, db: 'bike', f: 2, res: 48, grip: [0, -.02, -.2], muzzle: [0, .04, .5] },
  sniper: { slot: 5, name: '狙擊槍', gun: 1, scope: 1, dmg: 165, rpm: 45, mag: 6, rel: 2.5, range: 300, spread: .1, head: 3, f: 2.6, res: 30, grip: [0, -.045, -.29], muzzle: [0, -.015, .56] },
  rpg: { slot: 6, name: '火箭筒', gun: 1, rocket: 1, dmg: 500, blast: 10, rpm: 20, mag: 1, rel: 3.5, range: 200, spread: .5, f: 2, res: 8, shoulder: 1, grip: [0, .05, -.15], muzzle: [0, .05, .62] },
  launcher: { slot: 6, name: '榴彈發射器', gun: 1, lob: 1, dmg: 300, blast: 7, rpm: 60, mag: 6, rel: 3.2, range: 90, spread: .8, f: 2, res: 18, grip: [0, -.07, -.15], muzzle: [0, .028, .39] },   // 69-tactics.js：曲射、碰到東西就炸（neon_nightcity_gta_v_2.md 的搶劫 Stage 3，Jax 守大廳）
  minigun: { slot: 6, name: '轉管機槍', gun: 1, auto: 1, spin: .5, dmg: 30, rpm: 1800, mag: 500, rel: 4.5, range: 90, spread: 3.5, head: 1.5, f: .5, res: 1000, grip: [0, .08, -.38], muzzle: [0, 0, .48] },
  grenade: { slot: 7, name: '手榴彈', throw: 1, dmg: 400, blast: 8, fuse: 3, n: 10 },
  gas: { slot: 7, name: '催淚瓦斯', throw: 1, dmg: 0, gas: 1, n: 6 },   // 69-tactics.js 的 gasCloud：1.2 秒後冒煙，煙裡的警察與敵人嗆到動不了
  sticky: { slot: 7, name: '黏性炸彈', throw: 1, dmg: 420, blast: 8, max: 5, n: 8, db: 1, model: 'c4' },
};
const ARM_IDS = Object.keys(ARMS);
const SLOTS = ['近戰', '手槍', '衝鋒槍', '步槍', '霰彈槍', '狙擊槍', '重型', '投擲物'];
const VEH_K = 2.4;   // 子彈打車：車有 1000 血，乘上倍率才打得壞
const PED_HP = 70;
const arm = { sel: 'fist', last: ['fist', 'pistol', 'smg', 'rifle', 'shotgun', 'sniper', 'rpg', 'grenade'], ammo: {}, trig: false, spin: 0, zoomK: 0, bloom: 0, pend: [], stickies: [], wheel: { open: false, kb: false, x: 0, y: 0, slot: -1 } };
for (const id of ARM_IDS) { const A = ARMS[id]; if (A.gun) arm.ammo[id] = { mag: A.mag, res: A.res }; else if (A.throw) arm.ammo[id] = { mag: A.n, res: 0 }; }
const life = { hp: 100, max: 100, armor: 50, hurtT: 9, dead: null, deadT: 0, ph: 0, gone: false, hitCd: 0 };
// 特殊能力的倍率（69-crew.js 每幀依目前主角與是否啟動改寫）：take 受到傷害、out 造成的槍傷、spread／recoil 散布與後座力、melee 近戰一擊必殺、knock 擊飛、floor 生命鎖底
const abil = { take: 1, out: 1, spread: 1, recoil: 1, melee: false, knock: 1, floor: 0, drive: false };
const slowmo = { k: 1, want: 1, ab: 1, st: 1, raw: 1 / 60 };   // want：轉盤與死亡；ab：特殊能力；st：特技跳台

// ─── 武器模型：外層 Group 每幀擺到手上，內層位移 −grip；實體模型（arms.glb）下載前先用程式建模 ───
const ARM_COL = { dark: 0x17181b, mid: 0x2b2d31, wood: 0x5a3a22, steel: 0x8a8d92, olive: 0x3a4430 };
function armKit(id) {
  const k = new Kit(), A = ARMS[id] || {}, g = A.grip || [0, 0, 0], m = A.muzzle || [0, 0, .2];
  if (id === 'gas') { k.cyl(0, 0, 0, .033, .033, .12, 10, 0x59614c, 2); k.cyl(0, .072, 0, .013, .013, .025, 8, ARM_COL.steel, 15); k.box(0, .07, .02, .01, .012, .04, ARM_COL.steel, 15); }
  else if (id === 'grenade') { k.cyl(0, 0, 0, .032, .032, .07, 8, ARM_COL.olive, 2); k.box(0, .045, 0, .012, .02, .03, ARM_COL.steel, 15); }
  else if (id === 'c4' || id === 'sticky') { k.box(0, 0, 0, .1, .04, .2, 0x8a8058, 2); k.box(0, .022, .03, .05, .01, .05, 0x1a1a1a, 2); }
  else if (id === 'rocket') { k.cyl(0, 0, 0, .04, .04, .5, 8, ARM_COL.olive, 2, Math.PI / 2); k.cyl(0, 0, .3, .0, .045, .14, 8, 0x3c3c34, 2, -Math.PI / 2); }
  else if (A.melee) {
    const L = id === 'katana' ? 1 : id === 'bat' ? .84 : .5;
    k.cyl(0, 0, 0, id === 'bat' ? .035 : .015, id === 'bat' ? .018 : .015, L, 8, id === 'bat' ? 0x9a7a52 : id === 'katana' ? 0xc8ccd2 : ARM_COL.dark, id === 'katana' ? 15 : 2, Math.PI / 2);
    k.cyl(0, 0, g[2], .017, .017, .2, 8, 0x111111, 2, Math.PI / 2);
  } else {
    const L = m[2] - g[2] + .1, z = (m[2] + g[2]) / 2;
    k.box(0, m[1] - .01, z - L * .1, .035, .06, L * .7, ARM_COL.dark, 15);
    k.cyl(0, m[1], m[2] - L * .2, .012, .012, L * .45, 8, ARM_COL.mid, 15, Math.PI / 2);
    // 握把、護木與槍托擺在 40-people.js 的 GUN_HOLD 量的手與肩的位置（握點相對 grip），雙手 IK 才會剛好握在替身上
    const H = GUN_HOLD[id], r = H ? H.r : [0, 0, 0];
    k.box(0, g[1] + r[1], g[2] + r[2], .03, .1, .04, ARM_COL.dark, 2, -.25);
    const wood = id === 'shotgun' || id === 'sniper' ? ARM_COL.wood : ARM_COL.dark;
    if (H && H.lh === 'guard') k.box(0, g[1] + H.l[1] + .01, g[2] + H.l[2], .045, .05, .16, wood, 2);
    if (H && H.b) { const z0 = g[2] + H.b[2], z1 = g[2] + r[2]; k.box(0, g[1] + H.b[1] + .025, (z0 + z1) / 2, .04, .085, Math.abs(z1 - z0), wood, 2); }
    else if (L > .5) k.box(0, g[1] - .01, g[2] - .2, .04, .08, .22, wood, 2);
    if (H && H.lh === 'gripL') k.box(0, g[1] + H.l[1], g[2] + H.l[2], .03, .1, .04, ARM_COL.dark, 2, -.25);   // 火箭筒的前握把
    if (id === 'sniper') k.cyl(0, m[1] + .06, g[2] + .15, .02, .02, .3, 8, ARM_COL.dark, 15, Math.PI / 2);
    if (id === 'stun') k.box(0, m[1] + .025, z, .037, .012, L * .5, 0xd9b42a, 2);
    if (id === 'launcher') k.cyl(0, m[1] - .045, g[2] + .17, .055, .055, .13, 12, ARM_COL.olive, 2, Math.PI / 2);   // 轉輪彈巢
    if (id === 'minigun') for (let i = 0; i < 6; i++) k.cyl(Math.cos(i) * .03, Math.sin(i) * .03, z + .1, .008, .008, L * .8, 6, ARM_COL.steel, 15, Math.PI / 2);
  }
  return k.build();
}
const kitGeo = {}, armItems = { v: null }, wModels = [];
function wModel(id) {
  const h = new T.Group(), inner = new T.Group();
  h.matrixAutoUpdate = false; h.add(inner); h.visible = false;
  const A = ARMS[id] || {}, g = A.grip;
  if (g) inner.position.set(-g[0], -g[1], -g[2]);
  inner.add(new T.Mesh(kitGeo[id] ||= armKit(id), MAT.uber));
  h.userData = { id, inner, glb: false };
  scene.add(h); wModels.push(h);
  if (armItems.v) swapGlb(h);
  return h;
}
const GLB_OF = { sticky: 'c4' };
function swapGlb(h) {
  const it = armItems.v && armItems.v[GLB_OF[h.userData.id] || h.userData.id];
  if (!it || h.userData.glb) return;
  h.userData.inner.clear(); h.userData.inner.add(propObject(it, 0, 0, 0)); h.userData.glb = true;
}
// 第一次掏出武器（或警察出動）才下載實體武器模型
function wakeArms() {
  if (wakeArms.p) return; wakeArms.p = loadProps('arms').then(items => { if (!items) return; armItems.v = items; for (const h of wModels) swapGlb(h); });
}
const myGun = {};   // 玩家手上的武器（每種一個）
function heldModel(id) { return myGun[id] ||= wModel(ARMS[id].model || id); }

// 骨頭的世界位置：骨架不在場景圖裡，要乘上角色的 Group 與網格矩陣
const _hm = new T.Matrix4(), _hb = new T.Matrix4(), _hp = V3(), _he = V3(), _hd = V3(), _hl = new T.Matrix4(), _h0 = V3(), UP = V3(0, 1, 0);
function boneW(p, name, out) { _hb.multiplyMatrices(_hm, p.bones[name].matrixWorld); return out.setFromMatrixPosition(_hb); }
function holdAt(h, p, A, dir) {
  p.h.updateMatrixWorld(true); _hm.multiplyMatrices(p.h.matrixWorld, p.sm.matrix);
  // 持槍姿勢（40-people.js 的 gunPose）：下一次擺姿勢時雙手握上來；這一幀已經算好槍的位置就照它擺
  const id = h.userData.id;
  p.hold = id; p.holdT = crowdFrame;
  if (p.gunM && p.gunId === id && crowdFrame - p.gunF <= 2) {
    const g = A.grip || [0, 0, 0];
    h.matrix.multiplyMatrices(_hm, p.gunM).multiply(_hl.makeTranslation(g[0], g[1], g[2])); h.matrixWorldNeedsUpdate = true; h.visible = true;
    return;
  }
  boneW(p, 'hand_r', _hp); boneW(p, 'lowerarm_r', _he);
  _hd.subVectors(_hp, _he).normalize();
  if (A.shoulder) { boneW(p, 'upperarm_r', _hp); _hp.y += .14; _hd.set(Math.sin(p.yaw), 0, Math.cos(p.yaw)); }
  else if (A.melee) _hd.addScaledVector(UP, 1.3).normalize();   // 近戰武器握著朝上，揮的時候跟著前臂轉
  if (dir && !A.melee) _hd.copy(dir);
  _hl.lookAt(_h0, _h0.clone().sub(_hd), UP);
  h.matrix.copy(_hl).setPosition(_hp); h.matrixWorldNeedsUpdate = true; h.visible = true;
}
function muzzleOf(h, A, out) {
  const g = A.grip || [0, 0, 0], m = A.muzzle || [0, 0, .2];
  h.updateMatrixWorld();
  return out.set(m[0] - g[0], m[1] - g[1], m[2] - g[2]).applyMatrix4(h.matrixWorld);
}

// ─── 換武器、轉盤 ───
function owned(id) { const A = ARMS[id], a = arm.ammo[id]; return !A.throw || a.mag > 0; }
function equip(id, quiet = false) {
  if (!ARMS[id] || arm.sel === id) return;
  arm.sel = id; gta.weapon = id; arm.last[ARMS[id].slot] = id;
  gta.reloadT = 0; arm.spin = 0; arm.trig = false;
  if (!ARMS[id].gun) gta.aiming = false;
  if (id !== 'fist') wakeArms();
  if (!quiet) { sfx.click(); toast(`武器：${ARMS[id].name}`); }
}
function wheelOpen() {
  const w = arm.wheel;
  if (w.open || life.dead || player.where !== 'out') return;
  w.open = true; w.kb = !!keys.Tab; w.x = w.y = 0; w.slot = ARMS[arm.sel].slot;
  arm.trig = false; slowmo.want = .3;
  drawWheel(); $('wheel').classList.add('on'); document.body.classList.add('wheel');
}
function wheelClose(apply) {
  const w = arm.wheel;
  if (!w.open) return;
  w.open = false; $('wheel').classList.remove('on'); document.body.classList.remove('wheel');
  slowmo.want = 1;
  if (apply && w.slot >= 0) { const id = arm.last[w.slot]; if (owned(id)) equip(id); }
}
function wheelMove(dx, dy) {
  const w = arm.wheel;
  w.x += dx; w.y += dy;
  const l = Math.hypot(w.x, w.y);
  if (l > 120) { w.x *= 120 / l; w.y *= 120 / l; }
  if (l < 30) return;
  const s = ((Math.round(Math.atan2(w.x, -w.y) / (Math.PI / 4)) % 8) + 8) % 8;
  if (s !== w.slot && owned(arm.last[s])) { w.slot = s; sfx.click(); drawWheel(); }
}
// 同一格裡有好幾把（近戰、重型、投擲物）：滾輪換
function wheelCycle(d) {
  const w = arm.wheel;
  if (w.open) {
    const list = ARM_IDS.filter(id => ARMS[id].slot === w.slot && owned(id));
    if (list.length < 2) return;
    arm.last[w.slot] = list[(list.indexOf(arm.last[w.slot]) + d + list.length) % list.length];
    sfx.click(); drawWheel();
  } else {
    const list = ARM_IDS.filter(owned);
    equip(list[(list.indexOf(arm.sel) + d + list.length) % list.length]);
  }
}
function ammoText(id) {
  const A = ARMS[id], a = arm.ammo[id];
  return A.gun ? `${a.mag} / ${a.res}` : A.pour ? `${a.mag}%` : A.throw ? `× ${a.mag}` : '';
}
const SVGNS = 'http://www.w3.org/2000/svg';
function drawWheel() {
  const el = $('wheel'), w = arm.wheel, R1 = 92, R2 = 228, gap = .022;
  let s = `<svg viewBox="-240 -240 480 480" aria-hidden="true">`;
  const P = (a, r) => `${(Math.sin(a) * r).toFixed(1)} ${(-Math.cos(a) * r).toFixed(1)}`;
  for (let i = 0; i < 8; i++) {
    const a0 = (i - .5) * Math.PI / 4 + gap, a1 = (i + .5) * Math.PI / 4 - gap, id = arm.last[i], ok = owned(id), sel = i === w.slot;
    s += `<g class="${sel ? 'sel' : ''}" data-s="${i}"><path class="sec${sel ? ' sel' : ''}${ok ? '' : ' none'}" data-s="${i}" d="M${P(a0, R2)} A${R2} ${R2} 0 0 1 ${P(a1, R2)} L${P(a1, R1)} A${R1} ${R1} 0 0 0 ${P(a0, R1)} Z"/>`;
    const am = (a0 + a1) / 2, cx = Math.sin(am) * 160, cy = -Math.cos(am) * 160;
    const n = ARM_IDS.filter(k => ARMS[k].slot === i && owned(k)).length;
    s += `<text class="sm" x="${cx.toFixed(1)}" y="${(cy - 16).toFixed(1)}">${SLOTS[i]}${n > 1 ? ` · ${n}` : ''}</text>`;
    s += `<text x="${cx.toFixed(1)}" y="${(cy + 3).toFixed(1)}">${ARMS[id].name}</text>`;
    s += `<text class="sm" x="${cx.toFixed(1)}" y="${(cy + 20).toFixed(1)}">${ok ? ammoText(id) : '沒有'}</text></g>`;
  }
  const cur = arm.last[w.slot] || arm.sel;
  s += `<circle id="wC" r="${R1 - 8}"/><text id="wcName" y="-4">${ARMS[cur].name}</text><text id="wcAmmo" y="22">${ammoText(cur) || '—'}</text></svg>`;
  el.innerHTML = s;
}
// 觸控：點扇形就選；滑鼠沒鎖定時也能點
$('wheel').addEventListener('pointerdown', e => {
  if (e.target.id === 'wC') { e.preventDefault(); wheelClose(false); return; }   // 點中間：不換，關掉
  const t = e.target.closest('[data-s]'); if (!t) return;
  e.preventDefault(); arm.wheel.slot = +t.dataset.s; wheelClose(true);
});

// ─── 開火、換彈、近戰、丟擲 ───
const _mz = V3(), _ad = V3();
function canDriveBy(A) {
  const v = player.veh;
  return started && player.where === 'out' && player.mode === 'drive' && !!A && !!A.db && (A.db === 1 || !v.isCar) && !v.fly && !dlg.open && !fading && !life.dead;
}
function windowMuzzle(out) {
  const v = player.veh, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), rx = -fz, rz = fx;
  camera.getWorldDirection(_ad);
  const side = _ad.x * rx + _ad.z * rz >= 0 ? 1 : -1, hw = v.isCar ? (v.w || 1.8) / 2 + .25 : .45;
  return out.set(v.x + rx * side * hw + fx * .2 + _ad.x * .3, v.y + (v.isCar ? 1.15 : 1.35), v.z + rz * side * hw + fz * .2 + _ad.z * .3);
}
// 車內射擊時把駕駛畫出來：坐在瞄準那一側的車窗邊、右手伸出窗外（99-main.js 在 driveVehicle 之後呼叫；機車只設定手臂方向）
const driveByOn = () => player.mode === 'drive' && gta.aimK > .4 && !!ARMS[arm.sel].gun && canDriveBy(ARMS[arm.sel]);
const _dbm = new T.Matrix4(), _dbq = new T.Quaternion(), _dbe = new T.Euler(), _dbs = V3(1, 1, 1), _dbt = new T.Matrix4();
function driveByPlace(v) {
  const p = me.people[0];
  p.dbDir = null;
  if (!driveByOn()) { if (v.isCar) me.mesh.visible = false; return; }
  camera.getWorldDirection(_ad);
  const c = Math.cos(v.yaw), sn = Math.sin(v.yaw);
  p.dbDir = [_ad.x * c - _ad.z * sn, _ad.y, _ad.x * sn + _ad.z * c];   // 世界 → 角色空間（面向車頭）
  if (!v.isCar) return;
  const side = _ad.x * -c + _ad.z * sn >= 0 ? 1 : -1;   // 朝右邊車窗（+1）或左邊
  me.mesh.visible = true;
  me.anim(0, ANIM.driveBy, 0, 1); me.anim2(0, 0, 0);
  _dbm.compose(_mz.set(v.x, v.y, v.z), _dbq.setFromEuler(_dbe.set(v.pitch, v.yaw, v.roll, 'YXZ')), _dbs);
  // 實車用 tools/seats.mjs 量的座椅高度與前後位置；程式建模的車流車沒有資料，估在車身中心往前兩成
  const db = v.carId && CARS[v.carId] && CARS[v.carId].db;
  _dbm.multiply(db ? _dbt.makeTranslation(-side * (v.w / 2 - .5), db[0] - DB_HIP, db[1]) : _dbt.makeTranslation(-side * (v.w / 2 - .5), DB_SEAT, v.len * .2));
  me.placeM(0, _dbm);
  player.x = v.x; player.z = v.z;
}
const DB_HIP = .87, DB_SEAT = .44 - DB_HIP;   // 開車動畫的骨盆在原點上 .87（40-people.js），車座離地大約 .44（太高頭會穿出車頂）
function triggerDown() {
  if (arm.wheel.open || life.dead) return;
  arm.trig = true;
  if (player.mode === 'drive' && player.veh.fly) return gunshipFire();   // 69-gunship.js：直升機的火箭莢
  const A = ARMS[arm.sel];
  if (!canFight() && !canDriveBy(A)) return;
  if (A.pour) return;   // 69-v3-chem.js：汽油桶按住倒油
  if (A.melee) swing();
  else if (A.throw) throwIt();
  else if (!A.auto) shoot();
}
function triggerUp() { arm.trig = false; }
function reload() {
  const A = ARMS[arm.sel], a = arm.ammo[arm.sel];
  if (!A.gun || gta.reloadT > 0 || a.mag >= A.mag || a.res <= 0) return;
  gta.reloadT = gta.relMax = A.rel * skK.rel; sfx.reload();   // 69-v3-skills.js：射擊等級縮短換彈
}
function finishReload() {
  const A = ARMS[arm.sel], a = arm.ammo[arm.sel];
  if (!A.gun) return;
  const n = Math.min(A.mag - a.mag, a.res); a.mag += n; a.res -= n;
}
function spreadDir(R, deg) {
  const s = Math.tan(deg * Math.PI / 180) * Math.sqrt(Math.random()), a = Math.random() * 6.283;
  // 垂直於射線的兩個軸
  const ux = -R.dz, uz = R.dx, ul = Math.hypot(ux, uz) || 1;
  const vx = R.dy * uz / ul, vy = (R.dz * ux - R.dx * uz) / ul, vz = -R.dy * ux / ul;
  let dx = R.dx + (ux / ul * Math.cos(a) + vx * Math.sin(a)) * s, dy = R.dy + vy * Math.sin(a) * s, dz = R.dz + (uz / ul * Math.cos(a) + vz * Math.sin(a)) * s;
  const l = Math.hypot(dx, dy, dz); return { ox: R.ox, oy: R.oy, oz: R.oz, dx: dx / l, dy: dy / l, dz: dz / l };
}
function tracer(x0, y0, z0, x1, y1, z1, hot = 1) {
  const n = Math.max(1, Math.min(12, Math.floor(Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 4)));
  for (let i = 1; i <= n; i++) { const u = i / (n + 1); emit('spark', lerp(x0, x1, u), lerp(y0, y1, u), lerp(z0, z1, u), { max: .05, s0: .05, s1: .05, c: [2.4 * hot, 2 * hot, 1.4 * hot], a: .6 }); }
}
function muzzleFx(x, y, z, big = 1) {
  emit('flash', x, y, z, { max: .06, s0: .3 * big, s1: .45 * big, c: [3, 2, 1] });
  fxLights.push({ x, y, z, col: COL.muzzle, r: 9, i: 3 * big, life: 0, max: .06 });
}
function shoot() {
  const id = arm.sel, A = ARMS[id], a = arm.ammo[id];
  if (!A.gun || gta.reloadT > 0 || gta.fireT > 0) return;
  if (a.mag <= 0) { if (a.res > 0) reload(); else { sfx.dry(); toast('沒子彈了'); arm.trig = false; } return; }
  a.mag--; gta.fireT = 60 / A.rpm;
  const inCar = player.mode === 'drive';
  if (!gta.aiming && !inCar) player.yaw = camState.yaw;   // 沒瞄準就開槍：先轉向準星
  const R0 = aimRay();
  if (inCar && !(myGun[id] && myGun[id].visible)) windowMuzzle(_mz); else muzzleOf(heldModel(id), A, _mz);   // 車內射擊：手伸出車窗時從槍口出去
  const sil = silOn(id);   // 69-v3-skills.js：消音器
  if (A.stun) { sparks(_mz.x, _mz.y, _mz.z, 4, 1.5); sfx.zap(); }
  else if (sil) { muzzleFx(_mz.x, _mz.y, _mz.z, .35); sfx.gun(.22, .3); }
  else { muzzleFx(_mz.x, _mz.y, _mz.z, A.f >= 2 ? 1.4 : 1); sfx.gun(1, A.f); }
  camState.shake = Math.max(camState.shake, A.f >= 2 ? .3 : .12);
  camState.pitch = clamp(camState.pitch - (A.f >= 2 ? .02 : .006) * (A.scope ? .4 : 1) * abil.recoil * skK.recoil, -.45, 1.15);   // 後座力（射擊等級越高越小）
  if (A.rocket) {
    const hit = castRay(R0, 300), tx = R0.ox + R0.dx * hit.t, ty = R0.oy + R0.dy * hit.t, tz = R0.oz + R0.dz * hit.t;
    _ad.set(tx - _mz.x, ty - _mz.y, tz - _mz.z).normalize();
    launch('rocket', _mz.x, _mz.y, _mz.z, _ad.x * 48, _ad.y * 48, _ad.z * 48, 'player'); sfx.launch();
  } else if (A.lob) lobShot(R0, A);   // 69-tactics.js
  else {
    const moving = player.v > .5 ? 1.4 : 1, deg = (A.spread * (gta.aimK > .5 ? .6 : 1.2) * moving + arm.bloom) * abil.spread * skK.spread;
    for (let i = 0; i < (A.pel || 1); i++) {
      const R = spreadDir(R0, deg), hit = castRay(R, A.range * perchK(A));   // 塔吊上用狙擊鏡射程加倍（69-v5-tower.js）
      const x = R.ox + R.dx * hit.t, y = R.oy + R.dy * hit.t, z = R.oz + R.dz * hit.t;
      if (i < 3) tracer(_mz.x, _mz.y, _mz.z, x, y, z);
      if (player.where === 'out') {
        hitWith(hit, R, A.dmg * abil.out, 'player', A.head, A.stun);
        if (hit.kind === 'veh') kinBullet(hit.ref, R, A.dmg);   // 69-kinema.js：子彈推動沒人開的車
        if ((A.pel || 1) > 1 && hit.t < 6 && !A.stun) kinBlow(hit, R);   // 霰彈近距離把人轟飛
      }
      else if (player.where === 'bank') bankShot(R, A.dmg * abil.out);   // 銀行大廳：射線只算人質與警衛（69-heist.js）
    }
    arm.bloom = Math.min(A.spread * 1.5, arm.bloom + A.spread * .25);
  }
  // 電擊槍沒有槍聲；消音器的槍聲只傳 NOISE.sil（69-police.js 的 crime 用 noise.shotR 當聽得到的範圍）
  if (!A.stun) { noise.shotR = sil ? NOISE.sil : NOISE.shot; noiseAdd(noise.shotR); panic(player.x, player.z, sil ? NOISE.sil : 30, 8); crime('shots', player.x, player.z); }
  if (a.mag === 0 && a.res > 0) arm.pend.push({ t: .25, fn: () => { if (arm.sel === id && a.mag === 0) reload(); } });
}
// 一發子彈（或一顆霰彈）打到東西；by：'player'｜'npc'｜'cop'
function hitWith(h, R, dmg, by, head = 2.5, stun = 0) {
  const x = R.ox + R.dx * h.t, y = R.oy + R.dy * h.t, z = R.oz + R.dz * h.t, mine = by === 'player';
  if (!stun) sfx.bulletHit(h.kind, x, z);
  if (stun && h.kind === 'ped') { stunPed(h.ref, stun, R.dx, R.dz); chemStun(x, z, stun); if (mine) crime('assault', x, z); return; }   // chemStun：雨天電流傳給旁邊的人（69-v3-chem.js）
  if (stun && h.kind === 'cop') { stunCop(h.ref, stun); if (mine) crime('resist', x, z); return; }
  if (stun && h.kind === 'fighter') { const f = h.ref; f.stunT = stun; f.stunPh = -uTimeNow(); sparks(x, y, z, 6, 2); return; }
  if (mine && (h.kind === 'ped' || h.kind === 'cop' || h.kind === 'fighter')) skillEvent('hit');   // 69-v3-skills.js：射擊升級
  if (h.kind === 'ped') { if (hitPed(h.ref, dmg * (y > 1.55 ? head : 1), R.dx, R.dz, mine, x, y, z) && mine) spEvent('kill', y > 1.55); }
  else if (h.kind === 'extra') { const s = extraSt[h.ref]; s.st = 'fall'; s.t = -12; s.vx = R.dx * 2; s.vz = R.dz * 2; extras.anim(h.ref, ANIM.die, -uTimeNow(), 1); blood(x, y, z); if (mine) { crime('kill', x, z); spEvent('kill', y > 1.55); } }
  // tireShot：68-wreck.js 的單顆輪胎；weakHit：69-v3-chem.js 的擋風玻璃（駕駛中彈）與左後油箱（漏油、三倍傷害、第二發起火）
  else if (h.kind === 'car') { sparks(x, y, z, 6, 3); const k = weakHit(h.ref, 'car', x, y, z, mine), d = h.ref.det; if (!tireShot(d || h.ref, x, y, z, dmg, mine)) { if (d) damageVeh(d, dmg * VEH_K * k, mine); else damageCar(h.ref, dmg * VEH_K * k, mine); } }   // det：weakHit 已經把車流車變成載具
  else if (h.kind === 'veh') { sparks(x, y, z, 6, 3); const k = weakHit(h.ref, 'veh', x, y, z, mine); if (!tireShot(h.ref, x, y, z, dmg, mine)) damageVeh(h.ref, dmg * VEH_K * k, mine); }
  else if (h.kind === 'cop') { blood(x, y, z); const hd = y - (h.ref.y || 0) > 1.55; if (copHit(h.ref, dmg * (hd ? head : 1), R.dx, R.dz, mine) && mine) spEvent('kill', hd); }
  else if (h.kind === 'heli') { sparks(x, y, z, 8, 4); heliHit(dmg, mine); }
  else if (h.kind === 'rap') { sparks(x, y, z, 8, 4); rapHit(dmg, mine); }   // 69-tactics.js 的垂降直升機
  else if (h.kind === 'ebox') boxHit(h.ref, dmg, mine);   // 69-market.js：流明電訊的電訊箱
  else if (h.kind === 'fn') { blood(x, y, z); h.ref(dmg, R, mine); }   // 其他會中彈的東西自己處理（69-heist.js 跑出銀行的人質）
  else if (h.kind === 'prop') h.ref(x, y, z, dmg, R, mine);   // 69-v5-street.js：玻璃、電話亭、熱狗攤的瓦斯鋼瓶、護欄
  else if (h.kind === 'fighter') { blood(x, y, z); const hd = y > 1.55; if (fHit(h.ref, dmg * (hd ? head : 1), R.dx, R.dz, mine) && mine) spEvent('kill', hd); }   // 69-squads.js：幫派
  else if (h.kind) { sparks(x, y, z, 5, 2.5); dust(x, y, z, 2); chemHit(x, y, z); }   // 打到地上的油就點著
}
// 電擊槍：路人倒地抽搐幾秒後爬起來逃跑（原地，不重生）；警察倒地幾秒後繼續追
function stunPed(k, t, fx, fz) {
  const ps = pedState[k]; if (!ps || ps.down > 0) return;
  knockPed(k, fx * .3, fz * .3); ps.down = t; ps.stun = 1;
  const p = peds.people[k]; sparks(p.x, 1.1, p.z, 6, 2);
}
function blood(x, y, z) {
  for (let i = 0; i < 6; i++) emit('smoke', x, y, z, { vx: (Math.random() - .5) * 2, vy: Math.random() * 1.5, vz: (Math.random() - .5) * 2, max: .45, s0: .06, s1: .22, grav: 6, a: .85, c: [.28, .015, .02] });
}
function hitPed(k, dmg, fx, fz, mine, x, y, z) {
  const ps = pedState[k];
  if (!ps || ps.down > 0) return;
  if (!(ps.hp > 0)) ps.hp = PED_HP;
  ps.hp -= dmg;
  if (x != null) blood(x, y, z);
  if (ps.hp <= 0) { knockPed(k, fx * abil.knock, fz * abil.knock); if (mine) crime('kill', peds.people[k].x, peds.people[k].z); return true; }
  if (mine) crime('assault', peds.people[k].x, peds.people[k].z);
  // 沒倒的人：脾氣差的反擊，其他人逃跑
  if (ps.tough) pedEnter(k, 'fight', uTimeNow() + 25);
  else if (ps.fsm) pedLeave(k, ps);
}
function swing() {
  if (gta.punchT > 0) return;
  const A = ARMS[arm.sel];
  gta.punchT = A.cd; gta.punchPh = -uTimeNow(); gta.actAnim = A.fist ? ANIM.jab : ANIM.swing;
  arm.pend.push({ t: A.fist ? .18 : .3, fn: () => meleeHit(A) });
  kinLunge(A);   // 69-kinema.js：出手前吸附到打得到的距離
}
function meleeHit(A) {
  const bike = player.mode === 'drive' && !player.veh.isCar;
  if (life.dead || player.mode !== 'walk' && !bike) return;
  const yaw = bike ? player.veh.yaw : player.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw), mine = true;
  const dmg = A.dmg * skK.melee, sneak = player.crouch && !W.stars;   // 69-v3-skills.js：力量加傷害；沒被通緝時蹲著從背後打是暗殺（一擊倒）
  const behind = (x, z, yw) => sneak && (x - player.x) * Math.sin(yw) + (z - player.z) * Math.cos(yw) > 0;
  for (let k = 0; k < PED_N; k++) {
    const p = peds.people[k], dx = p.x - player.x, dz = p.z - player.z, d = Math.hypot(dx, dz), ps = pedState[k];
    if (d < A.reach + (bike ? .4 : 0) && (bike || dx * fx + dz * fz > d * .5) && !(ps.down > 0)) {
      sfx.punch(); skillEvent('melee');
      // 近戰：一般路人一下就倒，脾氣差的會吃掉傷害再反擊；武士刀一刀斃命
      if (A.kill || !ps.tough || abil.melee || behind(p.x, p.z, p.yaw)) { knockPed(k, fx * abil.knock, fz * abil.knock); crime(A.kill || A.dmg >= 60 || abil.melee ? 'kill' : 'assault', p.x, p.z); if (A.kill || abil.melee) spEvent('kill', false, true); }
      else { hitPed(k, dmg, fx, fz, mine, p.x, 1.3, p.z); kinStumble(k, fx, fz); }   // 打不倒：退 0.45 m（69-kinema.js）
      if (ps.down > 0) pedFly(k, fx * 3.2 * abil.knock, fz * 3.2 * abil.knock, .6, true);   // 打倒：往後摔
      return;
    }
  }
  // copMelee／fighterMelee 回傳被打到的人：倒了往後摔、沒倒退 0.45 m（69-kinema.js 的 kinPunch）
  let o = copMelee(player.x, player.z, fx, fz, A.reach, A.kill || abil.melee ? 999 : dmg);
  if (o) { sfx.punch(); skillEvent('melee'); kinPunch(o, fx, fz); return; }
  o = fighterMelee(player.x, player.z, fx, fz, A.reach, A.kill || abil.melee || sneak ? 999 : dmg);
  if (o) { sfx.punch(); skillEvent('melee'); if (sneak) skUp('stl', .8); kinPunch(o, fx, fz); return; }
  for (const v of vehicles) if (v !== player.veh && !v.dead && Math.hypot(v.x - player.x - fx, v.z - player.z - fz) < v.len / 2 + .6 && !A.fist) { sfx.impact(4); damageVeh(v, A.dmg * 1.2, true); return; }
  sfx.whoosh();
}
function throwIt() {
  const id = arm.sel, a = arm.ammo[id], A = ARMS[id];
  if (gta.punchT > 0 || a.mag <= 0) return;
  if (player.where !== 'out') { toast('室內不能丟'); return; }
  if (id === 'sticky' && arm.stickies.length >= A.max) { toast(`最多同時貼 ${A.max} 顆 · 按 G 引爆`); return; }
  gta.punchT = .7; gta.punchPh = -uTimeNow(); gta.actAnim = ANIM.throw;
  if (player.mode === 'walk') player.yaw = camState.yaw;
  arm.pend.push({ t: .28, fn: () => {
    if (life.dead || a.mag <= 0) return;
    a.mag--;
    if (player.mode === 'drive') windowMuzzle(_mz); else muzzleOf(heldModel(id), A, _mz);
    camera.getWorldDirection(_ad);
    const sp = id === 'grenade' ? 15 : 12;
    launch(id, _mz.x, _mz.y, _mz.z, _ad.x * sp, _ad.y * sp + 4, _ad.z * sp, 'player');
    sfx.whoosh();
    if (a.mag <= 0) { const next = ARM_IDS.find(k => ARMS[k].throw && arm.ammo[k].mag > 0); equip(next || 'fist', true); }
  } });
}
function detonate() {
  if (!arm.stickies.length) return false;
  sfx.beep();
  for (const p of arm.stickies.splice(0)) p.t = 1e9;   // stepProj 這一幀引爆
  return true;
}

// ─── 投射物：火箭、坦克砲彈、手榴彈、黏性炸彈 ───
const proj = [];
function launch(kind, x, y, z, vx, vy, vz, by = 'player', skip = null) {
  const h = wModel(kind === 'rocket' || kind === 'shell' ? 'rocket' : kind === 'sticky' ? 'sticky' : kind === 'gas' ? 'gas' : 'grenade');
  const p = { kind, x, y, z, vx, vy, vz, t: 0, h, by, skip, att: null, ax: 0, ay: 0, az: 0, spin: Math.random() * 6 };
  proj.push(p);
  if (kind === 'sticky') arm.stickies.push(p);
  return p;
}
function dropProj(p) {
  proj.splice(proj.indexOf(p), 1);
  scene.remove(p.h); wModels.splice(wModels.indexOf(p.h), 1);
  const i = arm.stickies.indexOf(p); if (i >= 0) arm.stickies.splice(i, 1);
}
const _jq = new T.Quaternion(), _je = new T.Euler(), _js = V3(1, 1, 1), _jv = V3();
function stepProj(dt) {
  for (const p of [...proj]) {
    p.t += dt;
    if (p.kind === 'rocket' || p.kind === 'shell' || p.kind === 'gl') {
      if (p.kind === 'gl') p.vy -= 9.8 * dt;   // 榴彈：曲射
      const sp = Math.hypot(p.vx, p.vy, p.vz), R = { ox: p.x, oy: p.y, oz: p.z, dx: p.vx / sp, dy: p.vy / sp, dz: p.vz / sp };
      const h = castRay(R, sp * dt, p.skip);
      const nearMe = p.by !== 'player' && Math.hypot(player.x - p.x, player.z - p.z, player.y + 1 - p.y) < 1.3;
      if (h.kind || nearMe || p.t > 6) {
        const t = h.kind ? h.t : 0;
        const A = ARMS[p.kind === 'gl' ? 'launcher' : 'rpg'];
        blast(p.x + R.dx * t, p.y + R.dy * t, p.z + R.dz * t, p.kind === 'shell' ? 9 : A.blast, p.kind === 'shell' ? 450 : A.dmg, p.by, null);
        dropProj(p); continue;
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (Math.random() < dt * 60) emit('smoke', p.x, p.y, p.z, { vx: (Math.random() - .5) * .4, vy: .3, vz: (Math.random() - .5) * .4, max: 1.2, s0: .15, s1: .9, a: .55, c: [.6, .6, .62] });
      if (Math.random() < dt * 40 && p.kind !== 'gl') emit('fire', p.x - R.dx * .3, p.y - R.dy * .3, p.z - R.dz * .3, { max: .12, s0: .25, s1: .1, drag: 1 });
      _jq.setFromUnitVectors(_jv.set(0, 0, 1), _ad.set(R.dx, R.dy, R.dz));
    } else {
      // 手榴彈與黏性炸彈：拋物線，落地彈跳（黏性的直接黏住）；黏在車上就跟著車走
      if (p.att) {
        const v = p.att, c = Math.cos(v.yaw), s = Math.sin(v.yaw);
        p.x = v.x + p.ax * c + p.az * s; p.z = v.z - p.ax * s + p.az * c; p.y = v.y + p.ay;
        if (v.dead && p.t < 1e8) p.att = null;
      } else if (!p.stuck) {
        p.vy -= 9.8 * dt;
        let nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
        const gh = groundH(nx, nz) + .05;
        const r = collideCircle(nx, nz, .08, false);
        let car = null;
        for (const v of vehicles) if (!v.dead && Math.abs((nx - v.x) * Math.sin(v.yaw) + (nz - v.z) * Math.cos(v.yaw)) < v.len / 2 && Math.abs((nx - v.x) * Math.cos(v.yaw) - (nz - v.z) * Math.sin(v.yaw)) < v.w / 2 && ny < v.y + 1.5 && ny > v.y - .3) { car = v; break; }
        if (p.kind === 'sticky' && (ny <= gh || r.hit || car)) {
          if (car) { const dx = nx - car.x, dz = nz - car.z, c = Math.cos(car.yaw), s = Math.sin(car.yaw); p.att = car; p.ax = dx * c - dz * s; p.az = dx * s + dz * c; p.ay = Math.max(.5, ny - car.y); }
          else { p.stuck = 1; nx = r.x; nz = r.z; ny = Math.max(ny, gh); }
          p.vx = p.vy = p.vz = 0; sfx.bounce();
        } else {
          if (ny <= gh) { ny = gh; if (p.vy < -1.5) sfx.bounce(); p.vy = -p.vy * .35; p.vx *= .6; p.vz *= .6; }
          if (r.hit) { const l = Math.hypot(r.nx, r.nz) || 1, n0 = r.nx / l, n1 = r.nz / l, vn = p.vx * n0 + p.vz * n1; if (vn < 0) { p.vx -= 1.6 * vn * n0; p.vz -= 1.6 * vn * n1; sfx.bounce(); } nx = r.x; nz = r.z; }
          if (car) { p.vx = -p.vx * .4; p.vz = -p.vz * .4; p.vy = Math.abs(p.vy) * .3; nx = p.x; nz = p.z; }
        }
        p.x = nx; p.y = ny; p.z = nz;
        p.spin += dt * Math.hypot(p.vx, p.vz) * 3;
      }
      const due = p.kind === 'grenade' ? p.t >= ARMS.grenade.fuse : p.kind === 'gas' ? p.t >= 1.2 : p.t > 1e8;
      if (due && p.kind === 'gas') { gasCloud(p.x, p.z, p.by); dropProj(p); continue; }   // 69-tactics.js
      if (due) { const A = ARMS[p.kind]; blast(p.x, p.y, p.z, A.blast, A.dmg, p.by, null); dropProj(p); continue; }
      if (p.kind === 'sticky' && Math.random() < dt * 1.5) emit('flash', p.x, p.y + .05, p.z, { max: .1, s0: .08, s1: .08, c: [3, .3, .2] });
      _jq.setFromEuler(_je.set(p.spin, p.spin * .7, 0));
    }
    p.h.matrix.compose(_jv.set(p.x, p.y, p.z), _jq, _js); p.h.matrixWorldNeedsUpdate = true; p.h.visible = true;
  }
}

// ─── 爆炸：路人、警察、直升機、玩家、車流、載具（連鎖爆炸） ───
function blast(x, y, z, r, dmg, by, skip) {
  const mine = by === 'player';
  chemIgnite(x, z, r * .6); if (mine) noiseAdd(NOISE.blast);   // 69-v3-chem.js：爆炸點燃地上的油
  if (mine) spEvent('boom');
  fireball(x, y, z, r > 9 ? 1.3 : 1);
  const cd = Math.hypot(camera.position.x - x, camera.position.z - z);
  sfx.boom(cd);
  camState.shake = Math.max(camState.shake, clamp(1.2 - cd / 60, 0, 1));
  const fall = d => clamp(1 - d / r, 0, 1);
  for (let k = 0; k < PED_N; k++) {
    const p = peds.people[k], d = Math.hypot(p.x - x, p.z - z);
    if (d < r && !(pedState[k].down > 0)) { knockPed(k, (p.x - x) / (d || 1), (p.z - z) / (d || 1)); kinBlastPed(k, x, z, r); }   // 69-kinema.js：依距離拋飛
  }
  extraSt.forEach((s, k) => { if (s.on && Math.hypot(s.x - x, s.z - z) < r) { s.st = 'fall'; s.t = -12; s.vx = (s.x - x) * .8; s.vz = (s.z - z) * .8; extras.anim(k, ANIM.die, -uTimeNow(), 1); } });
  copBlast(x, y, z, r, dmg, mine);
  evBlast(x, z, r, mine);   // 69-events.js：炸運鈔車後車門
  boxBlast(x, z, r, mine);   // 69-market.js：電訊箱連鎖
  heliBlast(x, y, z, r, dmg, mine);
  rapBlast(x, y, z, r, dmg, mine);   // 69-tactics.js：垂降直升機
  fighterBlast(x, y, z, r, dmg, mine);   // 69-squads.js
  stBlast(x, y, z, r, mine);   // 69-v5-street.js：街道小設施
  if (player.mode === 'walk' && player.where === 'out') {
    const d = Math.hypot(player.x - x, player.z - z, player.y + 1 - y);
    if (d < r) { hurtPlayer(dmg * .3 * fall(d), x, z); if (fall(d) > .2 && !kinBlastMe(x, z, r)) knockPlayer(player.x - x, player.z - z); }   // kinBlastMe：近距離拋到半空（69-kinema.js）
  }
  for (const c of [...traffic, ...parked]) { const d = Math.hypot(c.x - x, c.z - z) - TYPES[c.type].len * .35; if (d < r) { const f = fall(Math.max(0, d)), v = damageCar(c, dmg * 2.2 * f, mine); if (v) { v.vx += (v.x - x) * .6; v.vz += (v.z - z) * .6; if (f > .5) rollKick(v, x, z, f); } } }
  for (const v of [...vehicles]) {
    if (v === skip || v.dead) continue;
    const d = Math.max(0, Math.hypot(v.x - x, v.z - z) - v.len * .35);
    if (d >= r) continue;
    const f = fall(d), l = Math.hypot(v.x - x, v.z - z) || 1, m = (v.mass || 1600) / 1600;
    v.vx += (v.x - x) / l * f * 9 / m; v.vz += (v.z - z) / l * f * 9 / m;
    damageVeh(v, dmg * 2.2 * f, mine);
    if (f > .5 && v.isCar && !v.dead) rollKick(v, x, z, f);   // 68-roll.js：近距離爆炸把車掀翻
  }
  panic(x, z, 45, 10);
  if (mine) crime('blast', x, z);
}

// ─── 玩家的生命與護甲 ───
function hurtPlayer(n, fx, fz) {
  if (life.dead || !(n > 0) || godMode.on) return;
  n *= abil.take;
  const a = Math.min(life.armor, n * .66), hp0 = life.hp;
  life.armor -= a; life.hp -= n - a;
  if (abil.floor && life.hp < abil.floor) life.hp = abil.floor;   // 狂暴：生命鎖在 1
  spEvent('hurt', hp0 - life.hp);
  life.hurtT = 0; life.flash = Math.min(1, (life.flash || 0) + .25 + n / 60);
  sfx.hurt();
  if (life.hp <= 0) { life.hp = 0; die('wasted'); }
}
const godMode = { on: false };
function die(kind) {
  if (life.dead) return;
  v5Die(kind);   // 69-v5-civic.js：座駕要不要拖進拖吊場（要在下車之前問）
  if (player.mode === 'drive') exitVehicle();
  if (gta.jack) gta.jack = null;
  wheelClose(false);
  life.dead = kind; life.deadT = 0; life.gone = false; life.ph = -uTimeNow();
  arm.trig = false; gta.aiming = false; gta.touchAim = false; player.down = 0; player.dance = 0;
  slowmo.want = .35;
  const d = $('death');
  d.classList.toggle('busted', kind === 'busted');
  $('deathW').textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
  $('deathS').textContent = kind === 'busted' ? `被帶回${PD.name} · 保釋金 $2,500` : `送往${HOSP.name} · 醫藥費 ${money(hospFee())}`;
  d.classList.add('on');
  if (kind === 'busted') sfx.busted(); else sfx.wasted();
}
function respawn() {
  const kind = life.dead, S = kind === 'busted' ? PD : HOSP, fee = kind === 'busted' ? 2500 : hospFee();
  if (player.mode === 'drive') exitVehicle();
  setWhere('out');
  player.x = S.x; player.z = S.z; player.yaw = S.yaw; player.y = groundH(S.x, S.z); player.v = 0; player.down = 0; player.anim = -1;
  camState.yaw = S.yaw; camState.pitch = .14; camState.snap = true;
  motors.cash = Math.max(0, motors.cash - fee); saveMotors();
  if (kind === 'busted') { for (const id of ARM_IDS) if (ARMS[id].gun) arm.ammo[id].res = Math.floor(arm.ammo[id].res / 2); }
  else life.armor = 0;
  for (const p of [...proj]) dropProj(p);
  wantedClear();
  life.hp = life.max; life.dead = null; life.gone = false; life.hurtT = 9; life.flash = 0;
  equip('fist', true);
  slowmo.want = 1;
  $('death').classList.remove('on');
  toast(kind === 'busted' ? `${S.name} · 付了保釋金 ${money(fee)}，彈藥被沒收一半` : `${S.name} · 醫藥費 ${money(fee)}（現金的 5%）`);
  v5Respawn(kind);
}
function deathStep() {
  life.deadT += slowmo.raw;
  me.anim(0, life.dead === 'busted' ? (life.deadT < 1.2 ? ANIM.handsUp : ANIM.kneel) : ANIM.die, life.dead === 'busted' ? life.deadT : life.ph, 1);
  me.anim2(0, 0, 0); me.place(0, player.x, player.y, player.z, player.yaw);
  if (life.deadT > 4.2 && !life.gone) { life.gone = true; transition(respawn); }
}

// ─── 路人反應：被槍指著投降、抱頭蹲下、脾氣差的人反擊（帶槍的開槍，沒帶的衝過來揍） ───
pedState.forEach(ps => { ps.hp = PED_HP; ps.tough = Math.random() < .12; ps.armed = ps.tough && Math.random() < .42; });
function pedEnter(k, st, until) {
  const ps = pedState[k], p = peds.people[k];
  if (!ps || ps.down > 0) return;
  if (!ps.fsm) { ps.fx = p.x; ps.fz = p.z; ps.fyaw = p.yaw; }
  ps.fsm = st; ps.fsmT = until; ps.panic = 0;
  ps.shotT = .6 + Math.random() * .8; ps.hitT = .5;
  peds.anim(k, st === 'surr' ? ANIM.handsUp : st === 'cower' ? ANIM.crouch : ps.armed ? ANIM.aimIdle : ANIM.run, Math.random() * 5, 1);
}
// 回到人行道的繞圈：找繞圈上離目前位置最近的點，偏移量慢慢收回
function nearestS(ps, x, z) {
  const { b, inset, w, d } = ps, x0 = b.x0 + inset, z0 = b.z0 + inset;
  const c = [[clamp(x - x0, 0, w), x0 + clamp(x - x0, 0, w), z0], [w + clamp(z - z0, 0, d), x0 + w, z0 + clamp(z - z0, 0, d)], [w + d + clamp(x0 + w - x, 0, w), x0 + w - clamp(x0 + w - x, 0, w), z0 + d], [2 * w + d + clamp(z0 + d - z, 0, d), x0, z0 + d - clamp(z0 + d - z, 0, d)]];
  return c.reduce((best, o) => (Math.hypot(o[1] - x, o[2] - z) < Math.hypot(best[1] - x, best[2] - z) ? o : best))[0];
}
function pedLeave(k, ps) {
  ps.fsm = null;
  ps.s = nearestS(ps, ps.fx, ps.fz);
  const [x, z, tx, tz] = pedPos(ps);
  ps.dx = clamp(ps.fx - x, -1.4, 1.4); ps.dz = clamp(ps.fz - z, -1.4, 1.4); ps.dodge = 1;
  ps.dir = tx * (x - player.x) + tz * (z - player.z) >= 0 ? 1 : -1;
  ps.panic = 4 + Math.random() * 3;
  peds.anim(k, ANIM.run, Math.random() * 9, 1.2);
}
function pedFsm(k, ps, dt) {
  const p = peds.people[k], t = uTimeNow();
  const px = player.mode === 'drive' ? player.veh.x : player.x, pz = player.mode === 'drive' ? player.veh.z : player.z;
  let dx = px - ps.fx, dz = pz - ps.fz, d = Math.hypot(dx, dz);
  const face = Math.atan2(dx, dz);
  if (ps.fsm === 'surr' || ps.fsm === 'cower') {
    if (t > ps.fsmT || life.dead) { pedLeave(k, ps); return false; }
    if (ps.fsm === 'surr') ps.fyaw += wrapA(face - ps.fyaw) * (1 - Math.exp(-6 * dt));
    peds.place(k, ps.fx, groundH(ps.fx, ps.fz) > 0 ? .15 : 0, ps.fz, ps.fyaw);
    return true;
  }
  // fight
  if (t > ps.fsmT || life.dead || player.where !== 'out' || d > 45 || player.mode === 'drive' && !ps.armed) { pedLeave(k, ps); return false; }
  ps.fyaw += wrapA(face - ps.fyaw) * (1 - Math.exp(-8 * dt));
  let sp = 0;
  if (ps.armed) sp = d > 14 ? 3.6 : d < 6 ? -1.4 : 0;
  else sp = d > 1.2 ? 4.4 : 0;
  if (sp) {
    const r = collideCircle(ps.fx + dx / d * sp * dt, ps.fz + dz / d * sp * dt, .3, false);
    ps.fx = r.x; ps.fz = r.z;
  }
  const P = peds.people[k];
  if (ps.armed) {
    peds.anim(k, sp ? ANIM.aimRun : ANIM.aimIdle, ps.walkPh = (ps.walkPh || 0) + dt, sp ? 1 : 1);
    P.aimK = 1; P.aimP = Math.atan2((player.mode === 'drive' ? 1 : 1.2) - 1.45, Math.max(d, 1)) * .9;
    ps.shotT -= dt;
    if (ps.shotT <= 0) {
      ps.shotT = .45 + Math.random() * .7;
      if (losClear(ps.fx, ps.fz, px, pz)) {
        const g = npcGunOf(P);
        npcShoot(g ? g.x : ps.fx, g ? g.y : 1.4, g ? g.z : ps.fz, .45, 9, 1, 'npc');
      }
    }
  } else {
    ps.hitT -= dt;
    if (d < 1.5) {
      if (ps.hitT <= 0) {
        ps.hitT = 1.1; ps.punchT = t;
        peds.anim(k, ANIM.jab, -t, 1);
        arm.pend.push({ t: .2, fn: () => { if (pedState[k].fsm === 'fight' && Math.hypot(player.x - ps.fx, player.z - ps.fz) < 1.8 && player.mode === 'walk') { sfx.punch(); hurtPlayer(7, ps.fx, ps.fz); } } });
      } else if (t - (ps.punchT || 0) > .5) peds.anim(k, ANIM.idle, 0, 1);
    } else peds.anim(k, ANIM.run, ps.walkPh = (ps.walkPh || 0) + dt, 1.1);
  }
  peds.place(k, ps.fx, groundH(ps.fx, ps.fz) > 0 ? .15 : 0, ps.fz, ps.fyaw);
  return true;
}
// 瞄準路人超過 0.2 秒：投降（脾氣差的反擊）；一直瞄著就一直舉手
function aimPeds(dt) {
  const R = aimRay(), h = castRay(R, 40), t = uTimeNow();
  for (let k = 0; k < PED_N; k++) {
    const ps = pedState[k];
    if (h.kind === 'ped' && h.ref === k) {
      ps.aimT = (ps.aimT || 0) + dt;
      if (ps.aimT > .2 && ps.fsm !== 'fight') {
        if (ps.tough) pedEnter(k, 'fight', t + 25);
        else if (ps.fsm === 'surr') ps.fsmT = t + 2.5;
        else pedEnter(k, 'surr', t + 3);
        if (!ps.aimCrime) { ps.aimCrime = 1; crime('aim', peds.people[k].x, peds.people[k].z); }
      }
    } else { ps.aimT = 0; ps.aimCrime = 0; }
  }
}
// 視線：只擋建築街區（扣掉人行道），夠便宜，每幀可以跑幾十次
// 街區是邏輯座標：每塊依所在的區切開、帶上區的框（rayBox 換到框裡算）
const LOS_B = blocks.flatMap(b => zoneClip(b.x0 + SW, b.x1 - SW, b.z0 + SW, b.z1 - SW).flatMap(boxSplitW).map(r => boxToW({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 }, r.zn)));   // 彎曲的片切成 ≤ 36 m 的幾段（10-city.js 的 boxSplitW），邊角才準
function losClear(ax, az, bx, bz) {
  const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), z0 = Math.min(az, bz), z1 = Math.max(az, bz);
  for (const b of LOS_B) if (b.bx1 >= x0 && b.bx0 <= x1 && b.bz1 >= z0 && b.bz0 <= z1 && rayBox(ax, az, bx - ax, bz - az, b) < 1) return false;
  return true;
}

// ─── NPC 手上的槍（帶槍的路人、警察）：每幀依需要從池子取 ───
const npcPool = {}, npcUsed = {};
function npcGunPut(p, kind) {
  const pool = npcPool[kind] ||= [], i = npcUsed[kind] = (npcUsed[kind] || 0) + 1;
  if (i > 12) return null;
  const h = pool[i - 1] ||= wModel(kind);
  holdAt(h, p, ARMS[kind]);
  p.gunH = h; p.gunK = kind;
  return h;
}
const _ng = V3();
function npcGunOf(p) {
  if (!p.gunH || !p.gunH.visible) return null;
  return muzzleOf(p.gunH, ARMS[p.gunK], _ng);
}
// NPC 朝玩家開一槍：命中率依距離、玩家速度；開車時多半打在車上
function npcShoot(ox, oy, oz, acc, dmg, f = 1, by = 'npc') {
  const inV = player.mode === 'drive', tx = inV ? player.veh.x : player.x, tz = inV ? player.veh.z : player.z, ty = inV ? player.veh.y + 1 : player.y + 1.2;
  const d = Math.hypot(tx - ox, tz - oz), sp = inV ? Math.hypot(player.veh.vx, player.veh.vz) : player.v;
  const pHit = acc * clamp(1.1 - d / 70, .12, 1) * (sp > 8 ? .55 : sp > 3 ? .8 : 1) * (player.down > 0 ? .5 : 1) * (inV || !player.crouch ? 1 : crouchCover(ox, oz) ? .12 : .8) * (player.dive ? 0 : 1);   // 潛到水下打不到（69-v3-skills.js）
  const hit = Math.random() < pHit && !life.dead;
  const ex = hit ? 0 : (Math.random() - .5) * 3, ey = hit ? 0 : (Math.random() - .3) * 1.5, ez = hit ? 0 : (Math.random() - .5) * 3;
  muzzleFx(ox, oy, oz, .8);
  tracer(ox, oy, oz, tx + ex, ty + ey, tz + ez, .8);
  sfx.gun(clamp(1 - Math.hypot(ox - camera.position.x, oz - camera.position.z) / 120, 0, .8), f);
  if (!hit) { sparks(tx + ex, Math.max(.1, ty + ey), tz + ez, 3, 2); return false; }
  if (inV) { damageVeh(player.veh, dmg * VEH_K * .6, false); sparks(tx, ty, tz, 4, 2); if (Math.random() < .3) hurtPlayer(dmg * .5, ox, oz); }
  else { hurtPlayer(dmg, ox, oz); blood(tx, ty, tz); }
  return true;
}
// 蹲在車或矮牆後面（Z）：射手到玩家的連線，在玩家身前 2.6 m 內被車（車流、路邊車、載具）或碰撞框擋住。
// 69-police.js 的 coverClear 也問這裡：蹲在掩護後面，警察看不到
function crouchCover(ox, oz) {
  if (!player.crouch || player.mode !== 'walk' || player.where !== 'out') return false;
  const px = player.x, pz = player.z, d = Math.hypot(ox - px, oz - pz);
  if (d < 2.2) return false;
  const ex = px + (ox - px) / d * 2.6, ez = pz + (oz - pz) / d * 2.6;
  const car = (x, z, w, L, yaw) => {
    if (Math.abs(x - px) > 6 || Math.abs(z - pz) > 6) return false;
    for (const s of [-1, 0, 1]) if (segHit(px, pz, ex, ez, x + Math.sin(yaw) * L * .3 * s, z + Math.cos(yaw) * L * .3 * s, w * .55 + .1)) return true;
    return false;
  };
  for (const c of traffic) if (car(c.x, c.z, TYPES[c.type].w, TYPES[c.type].len, c.yaw)) return true;
  for (const c of parked) if (car(c.x, c.z, TYPES[c.type].w, TYPES[c.type].len, c.yaw)) return true;
  for (const v of vehicles) if (!v.dead && v.g.visible !== false && car(v.x, v.z, v.w, v.len, v.yaw)) return true;
  for (const b of boxesNear(px, pz, 3)) if (rayBox(px, pz, ex - px, ez - pz, b) < 1) return true;
  return false;
}
// NPC 朝任意目標開一槍（69-squads.js 的幫派、傭兵與隊友互射，警察打傭兵）：pHit 是命中率，打中就呼叫 onHit
function npcShootAt(ox, oy, oz, tx, ty, tz, pHit, f, onHit) {
  const hit = Math.random() < pHit;
  const ex = hit ? 0 : (Math.random() - .5) * 2.4, ey = hit ? 0 : (Math.random() - .3) * 1.2, ez = hit ? 0 : (Math.random() - .5) * 2.4;
  muzzleFx(ox, oy, oz, .8);
  tracer(ox, oy, oz, tx + ex, ty + ey, tz + ez, .8);
  sfx.gun(clamp(1 - Math.hypot(ox - camera.position.x, oz - camera.position.z) / 120, 0, .8), f);
  if (!hit) { sparks(tx + ex, Math.max(.1, ty + ey), tz + ez, 3, 2); return false; }
  onHit();
  return true;
}

// ─── 載具互撞（玩家座駕、搶來的車、警車、坦克）與被撞的行人 ───
// 兩圓近似車身；ΔHP = max(0, (J/M − 3.5)·18)，恢復係數 0.25（neon_nightcity_gta_v_2.md）
function vehPairs() {
  const L = vehicles;
  kinVehicles(L);   // 69-kinema.js：迭代位置修正（連牆一起）、法線＋切向衝量、PIT 打轉、夾扁
  // 被車撞到的玩家（行走時）
  life.hitCd -= slowmo.raw;
  if (player.mode === 'walk' && !life.dead && life.hitCd <= 0) {
    for (const v of L) {
      const sp = Math.hypot(v.vx, v.vz);
      if (sp < 4 || v.dead || v.y > player.y + 1.5 || player.y > v.y + 2.5) continue;   // 快速道路橋上橋下
      for (const s of [1, -1]) {
        const cx = v.x + Math.sin(v.yaw) * v.off * s, cz = v.z + Math.cos(v.yaw) * v.off * s;
        if (Math.hypot(player.x - cx, player.z - cz) < v.rad + .35) { life.hitCd = .8; sfx.impact(sp * .6, 'ped'); knockPlayer(v.vx, v.vz); hurtPlayer(sp * 3.2, v.x, v.z); break; }
      }
      if (life.hitCd > 0) break;
    }
  }
}
// 沒人開的載具：撞開、炸飛後滑行停下
function coast(dt) {
  for (const v of vehicles) {
    if (v === player.veh || v.unit && v.unit.drive || v.ai || v.fly) continue;   // ai：69-squads.js 自己開的車
    if (rollIdle(v, dt)) continue;   // 68-roll.js：翻滾、翻倒，疊在車頂上的車跟著底下的車
    kinYaw(v, dt);   // 69-kinema.js：被撞得打轉
    if (Math.abs(v.vx) + Math.abs(v.vz) < .05) { v.vx = v.vz = 0; continue; }
    v.x += v.vx * dt; v.z += v.vz * dt;
    const k = Math.exp(-(v.dead ? 2.5 : 1.6) * dt); v.vx *= k; v.vz *= k;
    v.spin += Math.hypot(v.vx, v.vz) * dt / (v.wr || .34);
    vehicleCollide(v, dt);
  }
}

// ─── 每幀 ───
function combatUpdate(dt) {
  for (let i = arm.pend.length - 1; i >= 0; i--) { const p = arm.pend[i]; p.t -= dt; if (p.t <= 0) { arm.pend.splice(i, 1); p.fn(); } }
  const A = ARMS[arm.sel];
  if (gta.reloadT > 0) { gta.reloadT -= dt; if (gta.reloadT <= 0) finishReload(); }
  const fight = (canFight() || canDriveBy(A)) && !life.dead && !arm.wheel.open;
  gta.aiming = fight && !!A.gun && (gta.rmb || !!gta.touchAim);
  gta.guard = fight && !!A.fist && player.mode === 'walk' && (gta.rmb || !!gta.touchAim);   // 徒手按右鍵：舉拳架式（不拉近鏡頭）
  gta.aimK = damp(gta.aimK, gta.aiming ? 1 : 0, 12, dt);
  arm.zoomK = damp(arm.zoomK, gta.aiming && A.scope ? 1 : 0, 14, dt);
  arm.spin = clamp(arm.spin + (arm.trig && fight && A.spin ? 1 : -1) * dt / (A.spin || .5), 0, 1);
  if (arm.trig && fight && A.auto && (!A.spin || arm.spin >= 1)) shoot();
  if (A.spin && arm.trig && fight && arm.spin < 1 && Math.random() < dt * 20) sfx.bounce();
  arm.bloom = Math.max(0, arm.bloom - dt * 5);
  if (gta.aiming && player.where === 'out') aimPeds(dt);
  stepProj(dt);
  if (player.where === 'out') { vehPairs(); coast(dt); }
  life.hurtT += dt;
  if (!life.dead && life.hurtT > 5 && life.hp < life.max / 2) life.hp = Math.min(life.max / 2, life.hp + 5 * dt);
  if (life.dead) deathStep();
}
function combatLate() {
  const p = me.people[0], A = ARMS[arm.sel];
  const walking = player.mode === 'walk' && player.where === 'out' && me.mesh.visible !== false && p.rig && !(player.down > 0) && life.dead !== 'busted';
  // 狙擊鏡：鏡頭進到眼睛，角色藏起來
  if (player.mode === 'walk') me.mesh.visible = arm.zoomK < .6;
  for (const id in myGun) myGun[id].visible = false;
  const showGun = walking && arm.sel !== 'fist' && arm.zoomK < .6 && !(A.throw && arm.ammo[arm.sel].mag <= 0) && life.dead !== 'wasted';
  if (showGun) { if (gta.aimK > .5) camera.getWorldDirection(_ad); holdAt(heldModel(arm.sel), p, A, gta.aimK > .5 ? _ad : null); }
  else if (driveByOn() && p.dbDir && me.mesh.visible !== false && p.rig) { camera.getWorldDirection(_ad); holdAt(heldModel(arm.sel), p, A, _ad); }   // 車窗外的槍
  // NPC 的槍
  for (const k in npcUsed) npcUsed[k] = 0;
  for (let k = 0; k < PED_N; k++) { const ps = pedState[k]; if (ps.fsm === 'fight' && ps.armed && !(ps.down > 0)) npcGunPut(peds.people[k], 'pistol'); }
  policeGuns();
  squadGuns();   // 69-squads.js
  for (const kind in npcPool) npcPool[kind].forEach((h, i) => { if (i >= (npcUsed[kind] || 0)) h.visible = false; });
  // 後製：受傷時邊緣泛紅，死亡時褪成灰階、四角壓暗
  life.flash = Math.max(0, (life.flash || 0) - slowmo.raw * 1.6);
  const low = life.hp < life.max / 4 && !life.dead ? .35 + .15 * Math.sin(uTimeNow() * 6) : 0;
  post.hurt = Math.max(life.flash, low);
  post.gray = life.dead ? clamp(life.deadT / 1.2, 0, 1) : 0;
  post.vig = life.dead ? clamp(life.deadT / .8, 0, 1) : arm.wheel.open ? .55 : arm.zoomK * .3;
  // HUD：準星、武器欄、生命與護甲
  const dby = canDriveBy(A), gun = !!A.gun && (walking || dby && gta.aiming) && started && !life.dead;
  const xs = gun ? (gta.aimK > .5 ? 2 : 1) : 0;
  if (hudCache.xh !== xs) { hudCache.xh = xs; const x = $('xhair'); x.classList.toggle('on', xs > 0 && arm.zoomK < .5); x.classList.toggle('aim', xs === 2); }
  const scope = arm.zoomK > .8;
  if (hudCache.scope !== scope) { hudCache.scope = scope; $('scope').classList.toggle('on', scope); $('xhair').classList.toggle('on', xs > 0 && !scope); }
  const showW = (walking || dby) && started && !life.dead && arm.sel !== 'fist';
  if (hudCache.weapOn !== showW) { hudCache.weapOn = showW; $('weap').classList.toggle('on', showW); }
  if (hudCache.weapUp !== dby) { hudCache.weapUp = dby; $('weap').classList.toggle('up', dby); }   // 開車時疊在速度表上方
  if (showW) {
    if (hudCache.wn !== arm.sel) { hudCache.wn = arm.sel; setText('wName', A.name); }
    const am = A.gun ? `${arm.ammo[arm.sel].mag} <small>/ ${arm.ammo[arm.sel].res}</small>` : A.throw ? `× ${arm.ammo[arm.sel].mag}` : '';
    if (hudCache.ammo !== am) { hudCache.ammo = am; $('wAmmo').innerHTML = am; }
    const rl = gta.reloadT > 0 ? Math.round((1 - gta.reloadT / (gta.relMax || 1)) * 100) : A.spin ? Math.round(arm.spin * 100) : 0;
    if (hudCache.rl !== rl) { hudCache.rl = rl; $('wReload').style.setProperty('--r', rl + '%'); }
  }
  const hp = Math.round(life.hp / life.max * 100), ar = Math.round(life.armor);
  if (hudCache.hp !== hp) { hudCache.hp = hp; const b = $('hpBar'); b.style.setProperty('--v', hp + '%'); b.classList.toggle('low', hp < 25); }
  if (hudCache.ar !== ar) { hudCache.ar = ar; $('arBar').style.setProperty('--v', ar + '%'); }
}

// ─── 輸入：滑鼠（鎖定游標後）左鍵開火、右鍵瞄準、滾輪換武器；Tab 按住開轉盤 ───
R.domElement.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse' || !document.pointerLockElement) return;
  if (e.button === 2) gta.rmb = true;
  if (e.button === 0) triggerDown();
});
addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') return; if (e.button === 2) gta.rmb = false; if (e.button === 0) triggerUp(); });
addEventListener('contextmenu', e => { if (started) e.preventDefault(); });
addEventListener('wheel', e => {
  if (!started || (!document.pointerLockElement && !arm.wheel.open) || life.dead) return;
  e.preventDefault();
  if (player.mode === 'walk' || arm.wheel.open) wheelCycle(e.deltaY > 0 ? 1 : -1);
}, { passive: false });
addEventListener('keyup', e => { if (e.code === 'Tab' && arm.wheel.open && arm.wheel.kb) wheelClose(true); });
function gtaKey(code) {
  if (v5Key(code)) return true;   // 69-v5-civic.js：爬梯子、翻鐵絲網、從屋頂跳下去、店裡的按鍵
  if (crashKey(code)) return true;   // 69-v3-crash.js：空中開傘、走路時空白鍵翻越
  if (crewKey(code)) return true;   // 69-crew.js：Q 角色轉盤、X 特殊能力
  if (code === 'Tab') { if (arm.wheel.open) wheelClose(true); else wheelOpen(); return true; }
  if (life.dead) return true;
  if (code === 'KeyR') { reload(); return true; }
  if (code === 'KeyZ' && player.swim && diveToggle()) return true;   // 69-v3-skills.js：游泳時 Z 是下潛／浮上
  if (code === 'KeyZ' && player.mode === 'walk' && !player.swim && !(player.down > 0)) { player.crouch = !player.crouch; return true; }
  if (code === 'KeyG' && arm.stickies.length) { detonate(); return true; }
  if (code === 'Aim') { if (canFight() && !ARMS[arm.sel].gun) equip(arm.last[1]); gta.touchAim = !gta.touchAim; return true; }
  return false;
}

// 測試 API（window.__nc.gta 底下）
const combatApi = {
  arm, life, ARMS, slowmo, proj, god: godMode, hosp: HOSP, pd: PD,
  equip, shoot, reload, triggerDown, triggerUp, swing, throwIt, detonate, blast, launch,
  hurt: hurtPlayer, die, respawn, wheelOpen, wheelClose, wheelMove, wheelCycle,
  pedEnter, aimPeds, npcShoot, losClear, stunPed, stunCop, canDriveBy: id => canDriveBy(ARMS[id]),
  // 手上武器的位置和右手、左手、頭的世界座標（驗收握把對位用）
  held() {
    const p = me.people[0], h = myGun[arm.sel]; if (!h || !h.visible) return null;
    _hm.multiplyMatrices(p.h.matrixWorld, p.sm.matrix);
    const f = v => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
    return { gun: f(V3().setFromMatrixPosition(h.matrixWorld)), hand: f(boneW(p, 'hand_r', V3())), handL: f(boneW(p, 'hand_l', V3())), neck: f(boneW(p, 'neck_01', V3())), muzzle: f(muzzleOf(h, ARMS[arm.sel], V3())), ik: p.ikErr && { r: +p.ikErr.r.toFixed(3), l: +p.ikErr.l.toFixed(3) } };
  },
  fill() { for (const id of ARM_IDS) { const A = ARMS[id]; if (A.gun) { arm.ammo[id].mag = A.mag; arm.ammo[id].res = A.res; } else if (A.throw) arm.ammo[id].mag = A.n; } life.hp = life.max; life.armor = 100; },
};
