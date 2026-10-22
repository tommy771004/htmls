// ═══ 第五階段：幫派地盤（赤蠍幫佔著的四個城區） ═══
// 每塊地盤在路口人行道上有一個據點，走到 90 m 內會冒出五個站著聊天的赤蠍幫（calm，69-squads.js）；被看到或你先動手就開戰（side.act）：
// 據點的人是第一波，之後從看不到的路口再來兩波援兵，全部打倒就搶下地盤（motors.side.turf）。離據點 260 m 以上算撤退。
// 搶下的地盤每 3 分鐘（真實時間）收一次保護費；之後每 7–11 分鐘赤蠍幫挑一塊反攻：150 秒內趕到據點、打退兩波，沒趕到或陣亡就丟掉那塊地盤。
// 大地圖把地盤的街區塗成紅色（赤蠍幫）或綠色（你的），每個街區各自換成世界座標（rectW），?zrot 下也對得上。
// 排在 69-survival、69-tale 之後：只有函式，GANG_NAME、fSpawn、spawnSpot、sideStart 都在前面。

const TURFS = [
  { id: 'maple', name: '楓林里', i: 4, j: 9, prize: 5000 },
  { id: 'amber', name: '琥珀工業區', i: 16, j: 9, prize: 7000 },
  { id: 'grey', name: '灰石國宅', i: 16, j: 3, prize: 8000 },
  { id: 'anchor', name: '錨灣港', i: 15, j: 13, prize: 9000 },
];
const TURF_FEE = 600, TURF_INC = 180, TURF_OWN = '#7fe08a';
const turf = { hang: null, incT: TURF_INC, atkT: 420, lurk: null, lurkT: 12, here: null };
const turfOwned = T => motors.side.turf.includes(T.id);
// 據點：路口東南角的人行道（邏輯座標，換到所在區的世界座標）
function turfAt(T) { return T.at ||= WP(avX(T.i) + HR + 2.4, stZ(T.j) + HR + 2.4); }
// 地盤範圍：DISTRICTS 裡同名城區的每個街區
function turfCells(T) {
  if (T.cells) return T.cells;
  const D = DISTRICTS.find(d => d.name.startsWith(T.name)), c = T.cells = [];
  for (let i = D.i0; i < D.i1; i++) for (let j = D.j0; j < D.j1; j++) c.push(rectW(avX(i), avX(i + 1), stZ(j), stZ(j + 1)));
  return c;
}
const turfD = T => { const a = turfAt(T); return Math.hypot(a.x - pX(), a.z - pZ()); };
const turfLeft = g => SQ.f.filter(f => fUp(f) && f.grp === g).length;
function turfWave(a, n, guns) {
  fRoom(n + 1);
  for (let i = 0; i < Math.min(n, fFreeN() - 1); i++) {
    const sp = spawnSpot(50, 110);
    if (!sp) break;
    const f = fSpawn('gang', sp.x + (i % 3 - 1) * 1.3, sp.z + (Math.floor(i / 3) - .5) * 1.3, sp.yaw, { gun: guns[i % guns.length] });
    if (!f) break;
    f.grp = a; f.onDown = () => a.kills++;
  }
}
// 收掉一群人：還站著的直接收，倒地的留到 69-squads.js 自己收
function turfFree(g) { for (const f of SQ.f) if (f.on && f.grp === g) { if (fUp(f)) fFree(f); else { f.grp = null; f.onDown = null; } } }

// ─── 地盤影響街頭 ───
// 玩家所在的地盤（DISTRICTS 的邏輯範圍）：赤蠍幫的地盤路人少三成五（40-people.js 的 updatePeds 問 pedTurfShare），
// 街角三不五時站著兩三個盯梢的（lurk：靠近 7 m 或拔槍才動手，69-squads.js），有時旁邊停著他們的車；
// 搶下來的地盤沒有盯梢的，街頭交易也不會在這裡發生（69-street.js 的 evPick 問 turfMine）。
function turfHere(x = pX(), z = pZ()) {
  const [lx, lz] = toL(x, z);
  for (const T of TURFS) { const D = T.D ||= DISTRICTS.find(d => d.name.startsWith(T.name)); if (lx >= avX(D.i0) && lx < avX(D.i1) && lz >= stZ(D.j0) && lz < stZ(D.j1)) return T; }
  return null;
}
const turfMine = () => !!turf.here && turfOwned(turf.here);
function pedTurfShare() { return player.where === 'out' && turf.here && !turfOwned(turf.here) ? .65 : 1; }
function turfLurk(dt) {
  const T = turf.here, g = turf.lurk;
  if (g) {
    const f0 = SQ.f.find(f => f.on && f.grp === g), d = f0 ? Math.hypot(f0.x - pX(), f0.z - pZ()) : 999;
    if (!f0 || !g.awake && (d > 140 || T && turfOwned(T)) || g.awake && !turfLeft(g)) { turfFree(g); turf.lurk = null; }
    return;
  }
  if (!T || turfOwned(T) || player.where !== 'out' || side.act || turf.hang || W.stars || (turf.lurkT -= dt) > 0) return;
  turf.lurkT = 25 + Math.random() * 20;
  if (fFreeN() < 6 || turfD(T) < 120) return;   // 據點附近已經有一群
  const sp = spawnSpot(45, 80);
  if (!sp || turfHere(sp.x, sp.z) !== T) return;
  // 車道上的點往右手邊挪到人行道，撞到樓就推出來
  const fx = Math.sin(sp.yaw), fz = Math.cos(sp.yaw), rx = -fz, rz = fx, o = HR + 2.2 - LANE;
  const c = collideCircle(sp.x + rx * o, sp.z + rz * o, .5, false), n = 2 + (Math.random() < .5 ? 1 : 0);
  const lg = turf.lurk = { kind: 'lurk', T, awake: false }, guns = ['pistol', 'smg', 'pistol'];
  for (let i = 0; i < n; i++) {
    const t = i / n * Math.PI * 2, x = c.x + Math.sin(t) * 1.3, z = c.z + Math.cos(t) * 1.3;
    const f = fSpawn('gang', x, z, Math.atan2(c.x - x, c.z - z), { gun: guns[i] });
    if (f) { f.calm = true; f.lurk = true; f.grp = lg; }
  }
  if (Math.random() < .5) squadCar('gang', GANG_TYPES[Math.floor(Math.random() * 3)], sp.x + rx * 1.4, sp.z + rz * 1.4, sp.yaw, 0);   // 停在路邊的座車
}

// ─── 據點、保護費、反攻（69-side.js 的 sideUpdate 每幀呼叫） ───
function turfIdle(dt) {
  turf.here = player.where === 'out' ? turfHere() : null;
  turfLurk(dt);
  const own = TURFS.filter(turfOwned), out = player.where === 'out';
  if (own.length && out && !life.dead && (turf.incT -= dt) <= 0) { turf.incT = TURF_INC; earn(own.length * TURF_FEE, '地盤保護費'); }
  if (own.length && out && !sideBusy() && !ev.cur && !turf.hang && (turf.atkT -= dt) <= 0) { turf.atkT = 420 + Math.random() * 240; turfStart(own[Math.floor(Math.random() * own.length)], true); }
  const g = turf.hang;
  if (g) {
    const busy = sideBusy();
    if (g.awake && (!busy || busy === '先甩掉警察')) { turfStart(g.T, false, g); return; }   // 開打的那一刻通常還沒報警
    if (turfOwned(g.T) || turfD(g.T) > 160 || !turfLeft(g)) { turfFree(g); turf.hang = null; }
    return;
  }
  if (side.act || !out || sideBusy() || fFreeN() < 7) return;
  for (const T of TURFS) {
    if (turfOwned(T) || turfD(T) > 90) continue;
    const a = turfAt(T), hg = turf.hang = { kind: 'turf', T, awake: false };
    const guns = ['smg', 'pistol', 'shotgun', 'pistol', 'smg'];
    for (let i = 0; i < 5; i++) {
      const t = i / 5 * Math.PI * 2, x = a.x + Math.sin(t) * 2.2, z = a.z + Math.cos(t) * 2.2;
      const f = fSpawn('gang', x, z, Math.atan2(a.x - x, a.z - z), { gun: guns[i] });
      if (!f) break;
      f.calm = true; f.grp = hg;
    }
    toast(`這裡是${GANG_NAME}的地盤（${T.name}）：清掉據點的人就能搶下來`);
    return;
  }
}

// ─── 地盤戰（def = 反攻時的保衛戰） ───
function turfStart(T, def, hg) {
  const a = {
    kind: 'turf', T, def, name: def ? '地盤保衛' : '地盤戰', label: `<b>${def ? '地盤保衛' : '地盤戰'}</b> · ${T.name}`,
    st: def ? 'go' : 'fight', t: def ? 150 : 0, wave: def ? 0 : 1, waves: def ? 2 : 3, kills: 0, delay: 0,
    step: dt => turfStep(a, dt), hud: () => turfHud(a), mark: () => { const p = turfAt(T); return { name: `${T.name}據點`, x: p.x, y: 2, z: p.z, where: 'out' }; },
    fail: why => turfFail(a, why), clear: () => turfFree(a),
  };
  if (hg) { for (const f of SQ.f) if (f.on && f.grp === hg) { f.grp = a; f.onDown = () => a.kills++; } turf.hang = null; }
  sideStart(a);
  if (def) { sfx.beep(); toast(`${GANG_NAME}要搶回${T.name}：150 秒內趕到據點`); }
  else toast(`地盤戰：打倒${GANG_NAME}`);
}
function turfStep(a, dt) {
  const d = turfD(a.T);
  if (a.st === 'go') {
    a.t -= dt;
    if (d < 60) { a.st = 'fight'; a.wave = 1; turfWave(a, 5, ['pistol', 'smg', 'shotgun']); toast(`${GANG_NAME}到了`); }
    else if (a.t <= 0) turfFail(a, '沒趕到');
    return;
  }
  if (d > 260) { turfFail(a, '撤出了地盤'); return; }
  if (turfLeft(a)) { a.delay = 0; return; }
  if (a.wave >= a.waves) { turfWin(a); return; }
  if ((a.delay += dt) < 3) return;
  a.delay = 0; a.wave++;
  turfWave(a, 4 + a.wave, a.wave >= 3 ? ['rifle', 'smg', 'shotgun'] : ['pistol', 'smg', 'shotgun']);
  toast(`第 ${a.wave} 波：${GANG_NAME}的援兵`);
}
function turfHud(a) {
  if (a.st === 'go') return { text: `趕到${a.T.name}據點`, bar: a.t / 150 * 100, num: `${Math.ceil(a.t)} 秒`, low: a.t < 30 };
  const n = turfLeft(a);
  return { text: n ? `打倒${GANG_NAME} · 第 ${a.wave}/${a.waves} 波` : '援兵快到了', bar: -1, num: n ? `${n} 人` : '' };
}
function turfWin(a) {
  const T = a.T;
  sideEnd();
  if (a.def) {
    earn(3000, '守住地盤');
    sideDone('TURF HELD', `地盤保衛 · ${T.name}`, [['擊倒', `${a.kills} 人`], ['獎金', money(3000)]], 1);
    return;
  }
  motors.side.turf.push(T.id); saveMotors();
  earn(T.prize, `搶下${T.name}`);
  newsAdd(`${T.name.split(' ')[0]}幫派火拼`, `${GANG_NAME}在據點與不明人士爆發槍戰，地盤疑似易主。`);
  turf.atkT = Math.max(turf.atkT, 420); turf.incT = TURF_INC;
  sideDone('TURF TAKEN', `幫派地盤 · ${T.name}`, [['擊倒', `${a.kills} 人`], ['獎金', money(T.prize)], ['保護費', `每 3 分鐘 ${money(TURF_FEE)}`], ['地盤', `${motors.side.turf.length} / ${TURFS.length}`]], 1);
}
function turfFail(a, why) {
  const T = a.T;
  sideEnd();
  if (a.def) {
    motors.side.turf = motors.side.turf.filter(id => id !== T.id); saveMotors();
    toast(`${why}：${T.name}被${GANG_NAME}搶回去了`);
  } else toast(`地盤戰失敗：${why}`);
}

// ─── 地圖 ───
function turfMini(ctx, P2, zoom) {
  for (const T of TURFS) {
    if (turfOwned(T) && !(side.act && side.act.T === T)) continue;
    const a = turfAt(T), [x, y] = P2(a.x, a.z), s = 6 / zoom * 1.4;
    ctx.fillStyle = GANG_COL; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s, y); ctx.fill();
  }
}
function turfBig(c, X, Z, s) {
  for (const T of TURFS) {
    c.fillStyle = turfOwned(T) ? 'rgba(127,224,138,.13)' : 'rgba(255,74,58,.13)';
    c.beginPath();
    for (const q of turfCells(T)) { c.moveTo(X(q[0][0]), Z(q[0][1])); for (let k = 1; k < 4; k++) c.lineTo(X(q[k][0]), Z(q[k][1])); c.closePath(); }
    c.fill();
  }
}
function turfBlips(add) {
  for (const T of TURFS) {
    const a = turfAt(T), own = turfOwned(T);
    add('turf', { name: `${own ? '你的地盤' : GANG_NAME + '地盤'} · ${T.name}`, txt: '幫', x: a.x, z: a.z, type: '幫派地盤', rows: [['狀態', own ? '你的' : GANG_NAME], ['搶下獎金', money(T.prize)], ['保護費', `每 3 分鐘 ${money(TURF_FEE)}`]], desc: own ? `${GANG_NAME}會不定時反攻，手機收到消息就趕回據點。` : `據點在路口的人行道上。走近會被${GANG_NAME}發現，打倒據點的人和兩波援兵就搶下這塊地盤。` });
  }
}

// 測試 API（window.__nc.gta.turf）
const turfApi = {
  here: () => turfHere(), lurk: () => { turf.lurkT = 0; turfLurk(0); return turf.lurk && SQ.f.filter(f => f.on && f.grp === turf.lurk).length; }, lurkG: () => turf.lurk, share: pedTurfShare,
  TURFS, turf, at: id => turfAt(TURFS.find(T => T.id === id)), owned: () => [...motors.side.turf],
  start: (id, def) => { const T = TURFS.find(q => q.id === id); turfStart(T, !!def); return side.act && side.act.T === T; },
  act: () => side.act && side.act.kind === 'turf' ? side.act : null,
  // 把場上這一波全部打倒
  wipe: () => { for (const f of SQ.f) if (fUp(f) && f.grp === side.act) fHit(f, 999, 0, 1, true); },
};
