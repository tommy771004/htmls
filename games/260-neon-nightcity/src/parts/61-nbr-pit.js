// ═══ 紐柏林維修區的換胎（24-nbr-pit.js 的 NBR.pitStop；ctxHooks 在 60-venues.js）：開進任一間車間的門口（工作車道或車間裡）停下，按 E 進站，
// 維修組一顆一顆換（氣動扳手聲、對話框列出每一顆），約 2.6 秒換上四條新胎（68-wreck.js 的 tireFix：破胎修好、極速與抓地回到原本的）。
// 換胎只換胎，不修車身。對話框開著的時候輸入是凍住的（99-main.js 的 readInput），車停著不動 ═══
const PIT_WHO = '維修組長';
if (NBR && NBR.pitStop) for (const l of NBR.pitStop.lights) outLights.push({ ...l, col: lin(0xf2f4ff), r: 12, i: 3, w: 1 });   // 24-nbr-pit.js 的車間頂燈（世界座標）
if (NBR && NBR.pitStop) ctxHooks.push(p => {
  if (p.mode !== 'drive' || p.where !== 'out') return null;
  const v = p.veh;
  if (!v || v.boat || v.dead || Math.hypot(v.vx, v.vz) > 1.2) return null;
  const i = NBR.pitStop.boxAt(v.x, v.z);
  return i < 0 ? null : { key: 'E', text: `進站換胎 <i>· ${NBR.pitStop.name(i)}</i>`, fn: () => pitStop(v, i) };
});
function pitStop(v, i) {
  v.vx = v.vz = 0; if ('v' in v) v.v = 0;
  const names = v.isCar === false ? ['前輪', '後輪'] : ['左前', '右前', '左後', '右後'], flat = v.flat || 0, done = [], N = names.length === 2 ? '兩' : '四', t0 = performance.now();
  const show = tail => dialog(PIT_WHO, `「${NBR.pitStop.name(i).split(' · ')[1]}，${flat ? `${flat} 條破胎，` : ''}${N}條新胎——」\n${names.map(n => (done.includes(n) ? '✓ ' : '· ') + n).join('　')}${tail || ''}`, [{ t: '換胎中…', fn: () => {} }]);
  show();
  names.forEach((n, k) => setTimeout(() => { done.push(n); sfx.impact(3.5); sfx.reload(); show(); }, 450 + k * 2000 / names.length));
  setTimeout(() => {
    if (player.veh === v) tireFix(v);
    const s = ((performance.now() - t0) / 1000).toFixed(1);
    dialog(PIT_WHO, `「好了，走！」\n${names.map(n => '✓ ' + n).join('　')}　· ${s} 秒`, [{ t: '出站', fn: closeDialog }]);
    toast(`換上${N}條新胎 · ${s} 秒`);
  }, 2600);
}
// 驗收：把玩家的座駕停到第 i 間門口（先打破 flat 條胎），pitVeh() 看輪胎與對話框
if (NBR && NBR.pitStop) {
  NBR.api.pitCar = (i = 0, flat = 2) => {
    if (player.mode !== 'drive') { setWhere('out'); enterVehicle(kestrel); }
    const v = player.veh, s = NBR.pitStop.pos(i);
    v.x = s.x; v.z = s.z; v.y = s.y; v.yaw = NBR.pitStop.yaw; v.vx = v.vz = 0; v.air = null; poseVehicle(v);
    camState.yaw = v.yaw; camState.snap = true;
    tireList(v).slice(0, flat).forEach(t => tireBurst(v, t, true));
    return NBR.api.pitVeh();
  };
  NBR.api.pitVeh = () => { const v = player.veh; return v && { flat: v.flat, vmax: +v.vmax.toFixed(2), grip: +v.grip.toFixed(3), box: NBR.pitStop.boxAt(v.x, v.z), dlg: dlg.open, ctx: (contextAction() || {}).text || null }; };
}
