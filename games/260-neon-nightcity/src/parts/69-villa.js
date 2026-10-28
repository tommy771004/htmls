// ═══ 山坡別墅：進出提示、看房與購買、睡覺存檔（地面與碰撞在 29-villa.js）═══
// 別墅都是同一個世界裡的房子（player.where 一直是 'out'）：走進門顯示「別墅名 · 房間」，走出來顯示別墅名後面接「室外」。
// 每型出售一棟（VILLA.sale，69-market.js 的 ESTATES 裡 hv1…hv5）：大門外按 E 看房（買下／先進去參觀／再想想），買了以後主臥的床邊按 E 睡一覺
// （時間推進 6 小時、補滿生命、存檔，存檔位置是大門外）。手機的天際置業也買得到，收入是短租（保險箱）。
// 門：私人住宅的外門鎖著，出售的那棟與屋裡的門走近就開（下面的 vdr*）。屋裡（villaWhere 有房間）：雨絲收掉、地面不濕、日光與天光減弱、曝光調高
// （眼睛適應室內；沒有陰影貼圖，日光原本照得進天花板下面）；入夜後附近別墅的房間點燈（villaLights，99-main.js 的 pickLights 收）。
// 排在 69-safehouse 之後：ESTATES、estOwned、estBuy、quickSave、wxPick 等直接用；68-gta.js 每幀呼叫 villaUpdate(dt)。
const villaSt = { at: null, inK: 0 };
// ─── 門扇與拉門：遠景與沒人走近的別墅畫關著的合併模型（每型一組實例 _doors／_doors_g）；玩家 45 m 內的別墅（每型最多 3 棟）把那一棟的
// 合併模型藏起來，改用每扇一個的實例（hill_homes.py 的 vid_drK，原點在鉸鏈、沿 +X），走到 1.6 m 內打開（推門轉 90°、拉門推到旁邊），
// 離開 2.6 m 外關上；開門的那一刻拿掉碰撞盒（29-villa.js 的 d.b），關好才放回 ───
const VDR_NEAR = 3, VDR_R = 45, _vdrZ = new T.Matrix4().makeScale(0, 0, 0), _vdrM = new T.Matrix4(), _vdrO = new T.Object3D();
const vdrType = HOME_V.map(([nm], v) => {
  const L = HILL_HOMES.filter(h => h.v === v), P = VILLA_PLAN[nm];
  if (!L.length || !P || !PROPS[nm + '_doors']) return null;
  const far = [instanced(PROPS[nm + '_doors'], MAT.uxI, L, 0, HILL_SEED, HOME_R)];
  if (PROPS[nm + '_doors_g']) far.push(instanced(PROPS[nm + '_doors_g'], VGLASS, L, 0, null, HOME_R));
  const dummy = Array.from({ length: VDR_NEAR }, () => ({ x: 0, y: -1e4, z: 0, hide: 1, seed: 0, ry: 0, zn: null }));
  const leaves = P.dr.map(([name]) => [PROPS[name], PROPS[name + '_g']].map((g, i) => {
    if (!g) return null;
    const m = instanced(g, i ? VGLASS : MAT.uxI, dummy, 0, i ? null : HILL_SEED); m.frustumCulled = false; return m;
  }));
  return { L, far, leaves, slots: Array(VDR_NEAR).fill(null) };
});
function vdrPose(H) {   // 這棟每一扇的姿勢寫進它的近景實例（開合用 smoothstep）
  const t = vdrType[H.h.v], s = H.vdSlot;
  H.doors.forEach((d, j) => {
    const e = d.a * d.a * (3 - 2 * d.a), yaw = H.h.ry + d.th0 + (d.kind ? 0 : e * d.mv), sl = d.kind ? e * d.mv : 0, [X, Z] = villaWorld(H, d.px, d.py);
    _vdrO.position.set(X + Math.cos(yaw) * sl, H.h.y, Z - Math.sin(yaw) * sl); _vdrO.rotation.set(0, yaw, 0); _vdrO.updateMatrix();
    for (const m of t.leaves[j] || []) if (m) {
      m.setMatrixAt(s, _vdrO.matrix); m.instanceMatrix.needsUpdate = true;
      const a = m.geometry.attributes.aIns; if (a) { a.array[s * 4 + 2] = H.h.seed; a.array[s * 4 + 3] = yaw; a.needsUpdate = true; }
    }
  });
}
function vdrTake(H) {
  const t = vdrType[H.h.v], s = t ? t.slots.indexOf(null) : -1;
  if (s < 0) return;
  t.slots[s] = H; H.vdSlot = s; H.vdK = t.L.indexOf(H.h);
  H.vdOrig = t.far.map(m => m.userData.stream.mtx.slice(H.vdK * 16, H.vdK * 16 + 16));
  for (const m of t.far) instSet(m, H.vdK, _vdrZ);
  vdrPose(H);
}
function vdrRelease(H) {
  const t = vdrType[H.h.v], s = H.vdSlot;
  for (const d of H.doors) { d.a = 0; d.b.hy = d.hy; }
  t.far.forEach((m, i) => instSet(m, H.vdK, _vdrM.fromArray(H.vdOrig[i])));
  for (const L of t.leaves) for (const m of L) if (m) { m.setMatrixAt(s, _vdrZ); m.instanceMatrix.needsUpdate = true; }
  t.slots[s] = null; H.vdSlot = null;
}
function vdrUpdate(dt, p) {
  const out = p.where === 'out', want = out ? VILLA.homes.filter(H => H.doors.length && Math.hypot(H.h.x - p.x, H.h.z - p.z) < VDR_R) : [];
  for (const t of vdrType) if (t) for (const H of t.slots) if (H && !want.includes(H)) vdrRelease(H);
  for (const H of want) if (H.vdSlot == null) vdrTake(H);
  for (const t of vdrType) if (t) for (const H of t.slots) if (H) {
    let ch = false;
    for (const d of H.doors) {
      const [dX, dZ] = villaWorld(H, d.cx, d.cy), r = Math.hypot(p.x - dX, p.z - dZ);
      const go = !d.lock && p.mode === 'walk' && Math.abs(p.y - (H.h.y + d.z)) < 1.8 && r < (d.a > 0 ? 2.6 : 1.6);
      if (go) d.b.hy = -1e9;   // 開門的那一刻就讓人過
      const a = clamp(d.a + (go ? dt : -dt) * 2.2, 0, 1);
      if (a === d.a) continue;
      if (a === 0) { d.b.hy = d.hy; if (r < 14) sfx.door(); }   // 關好才擋人
      d.a = a; ch = true;
    }
    if (ch) vdrPose(H);
  }
}
// 走近鎖著的門（私人住宅）
const vdrLocked = p => {
  for (const H of villaNear(p.x, p.z)) for (const d of H.doors) {
    if (!d.lock || Math.abs(p.y - (H.h.y + d.z)) > 1.5) continue;
    const [dX, dZ] = villaWorld(H, d.cx, d.cy);
    if (Math.hypot(p.x - dX, p.z - dZ) < 1.4) return H;
  }
  return null;
};
// ─── 入夜後附近別墅的房間點燈：相機 40 m 內的別墅，每間（不含梯井、挑空、車庫）天花板下一盞暖白燈，挑離相機最近的 VL_N 盞 ───
const VL_N = Math.max(2, Math.min(6, NL >> 2)), VL_COL = lin(0xffe2b8), VL_SKIP = new Set(['void', 'stair', 'garage']);
function villaLights() {
  if (player.where !== 'out' || atm.lamp < .02 || !VILLA.homes.length) return [];
  const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z, out = [];
  for (const H of villaNear(cx, cz)) {
    if (Math.hypot(H.h.x - cx, H.h.z - cz) > 40) continue;
    for (const lv of H.P.lv) for (const r of lv.r) {
      if (VL_SKIP.has(r[4])) continue;
      const [x, z] = villaWorld(H, (r[0] + r[1]) / 2, (r[2] + r[3]) / 2), y = H.h.y + lv.z + lv.h - .45;
      out.push({ x, y, z, col: VL_COL, r: clamp(Math.hypot(r[1] - r[0], r[3] - r[2]) * .7, 3.5, 8), i: .8 * atm.lamp, d: (x - cx) ** 2 + (z - cz) ** 2 + 6 * (y - cy) ** 2 });
    }
  }
  return out.sort((a, b) => a.d - b.d).slice(0, VL_N);
}
const villaName = H => `${H.P.name}${H.est ? '' : '（私人住宅）'}`;
function villaUpdate(dt = 1 / 60) {
  const p = player;
  vdrUpdate(dt, p);
  if (p.where !== 'out' || p.mode !== 'walk') { villaSt.at = null; villaSt.inK = 0; return; }
  // 讀檔或傳送到山坡上：groundH 不認得外緣外的山，剛落地時人在山裡面，直接放到地面上
  const g = inCity(p.x, p.z) ? null : hillDeck(p.x, p.z, -1e4);
  if (g !== null && p.y < g - 2 && !p.jump) p.y = g;
  const w = villaWhere(p.x, p.z, p.y), k = w ? `${VILLA.homes.indexOf(w.H)}:${w.L}:${w.room[5]}` : null;
  // 屋裡：28-sky.js 的 atmApply 每幀先算好戶外的值（updateWeather 在 gtaUpdate 前），這裡再壓低；透過玻璃看出去也跟著變（雨停、地面乾，見 HANDOFF）
  const ik = villaSt.inK = damp(villaSt.inK, w ? 1 : 0, 4, dt);
  if (ik > .005) {
    U.uWet.value *= 1 - ik; U.uSunCol.value.multiplyScalar(1 - .65 * ik);
    U.uAmbTop.value.multiplyScalar(1 - .35 * ik); U.uAmbBot.value.multiplyScalar(1 - .2 * ik);
    atm.exp *= 1 + .3 * ik;
    if (ik > .5) rainMesh.visible = splashMesh.visible = false;
  }
  if (k === villaSt.at) return;
  const was = villaSt.at; villaSt.at = k;
  if (w) toast(`${villaName(w.H)} · ${w.L ? (w.L + 1) + ' 樓' : '1 樓'}${w.room[5]}`);
  else if (was) toast('室外');
}
function villaBuy(H) {
  const e = ESTATES.find(o => o.id === H.est);
  dialog(`天際置業 · ${e.name}`, `${H.P.name}，外緣山路上的別墅，${H.P.lv.length} 層。門沒鎖，可以先進去看看；買下之後可以在主臥睡覺存檔（時間推進 6 小時、補滿生命），不在家時短租出去，每遊戲小時 ${money(e.rate)}。\n售價 ${money(e.price)}，你身上有 ${money(motors.cash)}。`, [
    { t: `買下（${money(e.price)}）`, fn: () => { closeDialog(); if (estBuy(H.est)) { sfx.pickup(); toast(`${e.name}現在是你的了`); } else toast(`現金不夠，還差 ${money(e.price - motors.cash)}`); } },
    { t: '先進去參觀', fn: () => { closeDialog(); toast('門沒鎖，走近就會開'); } },
    { t: '再想想', fn: closeDialog },
  ]);
}
function villaNap(H) {
  if (W.stars || heist.st !== 'off' && heist.st !== 'plan' || crew.sw || life.dead) { toast(W.stars ? '外面還有警察在找你，睡不著' : '現在不是睡覺的時候'); return; }
  transition(() => {
    clockSt.min = (clockSt.min + 360) % 1440;
    setWeather(wxPick(wxPick(wx.cur)), true);
    life.hp = life.max;
    quickSave({ x: H.door.x, z: H.door.z, yaw: H.door.yaw });
    toast('睡了一覺：時間推進 6 小時，已存檔');
  });
}
ctxHooks.push(p => {
  if (p.mode !== 'walk' || p.where !== 'out' || !VILLA.sale.length) return null;
  // 路邊車庫的電梯（29-villa.js 的 H.lift）：人行門前或車庫頂的電梯口前按 E；私人住宅的鎖著
  for (const H of villaNear(p.x, p.z)) if (H.lift) for (const k of ['lo', 'hi']) {
    const o = H.lift[k], to = H.lift[k === 'lo' ? 'hi' : 'lo'];
    if (Math.abs(p.y - o.y) > 1.5 || Math.hypot(p.x - o.x, p.z - o.z) > 1.3) continue;
    if (!H.est) return { key: 'E', text: `電梯 <i>· ${H.P.name}（私人住宅）</i>`, fn: () => toast('這是私人住宅的電梯，要刷卡') };
    return { key: 'E', text: k === 'lo' ? '搭電梯 <i>· 上前院</i>' : '搭電梯 <i>· 下到路邊車庫</i>', fn: () => transition(() => { player.x = to.x; player.z = to.z; player.y = to.y; player.yaw = to.yaw; camState.snap = true; }) };
  }
  const lk = vdrLocked(p);
  if (lk) return { key: 'E', text: `門鎖著 <i>· ${lk.P.name}（私人住宅）</i>`, fn: () => toast('這是私人住宅，門鎖著；出售的別墅在地圖上標「山坡別墅」') };
  for (const H of VILLA.sale) {
    if (Math.abs(p.y - H.door.y) < 1.5 && Math.hypot(p.x - H.door.x, p.z - H.door.z) < 1.8) {
      const e = ESTATES.find(o => o.id === H.est);
      return estOwned(H.est) ? null : { key: 'E', text: `看房 <i>· ${H.P.name} ${money(e.price)}</i>`, fn: () => villaBuy(H) };
    }
    if (estOwned(H.est) && Math.abs(p.y - H.nap.y) < 1.5 && (H.nap.r ? inR(H.nap.r, ...villaLocal(H, p.x, p.z)) : Math.hypot(p.x - H.nap.x, p.z - H.nap.z) < 2.4)) return { key: 'E', text: '睡一覺 <i>· 推進 6 小時並存檔</i>', fn: () => villaNap(H) };
  }
  return null;
});
