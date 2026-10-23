// ═══ 第三部曲之四：計程車快速移動、日夜犯罪生態、雨天的 AI 抓地力；第三部曲各模組的每幀入口 v3Update ═══
// 計程車：路上的計程車（30-vehicles.js 的 TAXIS）12 m 內按 E 招手，車子靠停（借用車流的 hit 停車）；走到車旁按 E 坐後座選目的地，
// 淡出淡入直接到（遊戲時間照路程往前推），下車時付車資；錢不夠就是逃票，司機報警（1 星）。F 照舊是搶車。
// 手機「霓虹計程車」叫車：6 秒後到你身邊，一樣選目的地。通緝中不載。

const TAXI_BASE = 30, TAXI_PER_KM = 55;   // 起跳 $30，每公里 $55
const TAXI_HAIL_R = 12, TAXI_SPEED = 11;  // 招手距離；換算車程的平均時速（m/s）
const taxi = { car: null, callT: 0 };
const isTaxi = c => TAXIS.includes(c.type);
const isNight = () => clockSt.min >= 20 * 60 || clockSt.min < 5 * 60;
function taxiFare(x, z) { return Math.round(TAXI_BASE + Math.hypot(x - player.x, z - player.z) / 1000 * TAXI_PER_KM); }
function taxiDests() {
  const h = CREW[crew.cur].home, L = [];
  if (gps.wp) L.push({ n: '導航點', x: gps.wp.x, z: gps.wp.z, yaw: player.yaw });
  L.push({ n: `${h.name}（${CREW[crew.cur].name} 的家）`, x: h.x, z: h.z, yaw: h.yaw });
  for (const [n, lx, lz, yaw] of [['LAZARUS 夜店', CLUB_X - 3, CLUB_Z + 4.5, Math.PI], ['VELOCE MOTORS 車行', DEAL_X - 2.5, DEAL_Z + 3.4, Math.PI]]) { const s = spotW({ x: lx, z: lz, yaw }); L.push({ n, x: s.x, z: s.z, yaw: s.yaw }); }
  return L.slice(0, 3);
}
function taxiRide() {
  if (W.stars) { toast('通緝中，司機搖頭開走了'); taxiFree(); return; }
  const opts = taxiDests().map(d => ({ t: `${d.n} · ${money(taxiFare(d.x, d.z))}`, fn: () => { closeDialog(); taxiGo(d); } }));
  opts.push({ t: '不坐了', fn: () => { closeDialog(); taxiFree(); } });
  dialog('霓虹計程車', gps.wp ? '去哪裡？' : '去哪裡？（想去別的地方，先在地圖上設導航點）', opts);
}
function taxiGo(d) {
  const fare = taxiFare(d.x, d.z), dist = Math.hypot(d.x - player.x, d.z - player.z);
  transition(() => {
    let x = d.x, z = d.z;
    const r = collideCircle(x, z, .4, false); x = r.x; z = r.z;
    setWhere('out'); player.x = x; player.z = z; player.yaw = d.yaw; player.v = 0; player.y = groundH(x, z);
    camState.yaw = d.yaw;
    clockSt.min = (clockSt.min + Math.max(2, Math.round(dist / TAXI_SPEED / 60 * 1.6))) % 1440;   // 車程（含紅燈）推進遊戲時間
    taxiFree();
    if (motors.cash >= fare) { motors.cash -= fare; saveMotors(); toast(`到了 · 車資 ${money(fare)}`); }
    else { motors.cash = 0; saveMotors(); addHeat(HEAT_STAR[0], 1); toast('錢不夠付車資，司機報警了'); }
  });
}
function taxiFree() { if (taxi.car) { taxi.car.hit = Math.min(taxi.car.hit, .5); taxi.car.hailed = false; } taxi.car = null; }
// 互動提示：招手（12 m 內、還沒停的計程車）、坐後座（停好的那台 3.5 m 內）
ctxHooks.push(p => {
  if (p.mode !== 'walk' || p.where !== 'out' || W.stars || life.dead || p.swim) return null;
  const c = taxi.car;
  if (c && traffic.includes(c) && Math.hypot(c.x - p.x, c.z - p.z) < TYPES[c.type].len / 2 + 2 && c.v < 1) return { key: 'E', text: '坐上計程車後座 <i>· F 是搶車</i>', fn: taxiRide };
  if (c) return null;
  let best = null, bd = TAXI_HAIL_R;
  for (const o of traffic) if (isTaxi(o) && !o.turn) { const d = Math.hypot(o.x - p.x, o.z - p.z); if (d < bd) { bd = d; best = o; } }
  return best ? { key: 'E', text: '招計程車', fn: () => { taxi.car = best; best.hailed = true; best.hit = 40; sfx.horn(best); toast('計程車靠邊停了'); } } : null;
});
function taxiSub() { return W.stars ? '通緝中叫不到車' : taxi.callT > 0 ? `車子 ${Math.ceil(taxi.callT)} 秒後到` : `起跳 ${money(TAXI_BASE)} · 每公里 ${money(TAXI_PER_KM)}`; }
function taxiCallOk() { return !W.stars && taxi.callT <= 0 && player.where === 'out' && player.mode === 'walk'; }
function taxiCall() { closePhone(); taxi.callT = 6; toast('叫了計程車 · 6 秒後到'); }
function taxiStep(dt) {
  const c = taxi.car;
  if (c && (!traffic.includes(c) || Math.hypot(c.x - player.x, c.z - player.z) > 60 || W.stars)) taxiFree();
  else if (c) c.hit = Math.max(c.hit, 5);   // 一直停著等你
  if (taxi.callT > 0 && (taxi.callT -= slowmo.raw) <= 0) {
    if (taxiCallOk() && !dlg.open && !fading) { sfx.horn({ x: player.x, z: player.z }); taxiRide(); }
    else toast('計程車到了但找不到你，開走了');
  }
}

// ─── 日夜犯罪生態（69-street.js 的事件挑選、69-turf.js 的盯梢）：白天運鈔車多，晚上幫派交易與盯梢多 ───
function evNightW(kind, w) { const n = isNight(); return w * (kind === 'truck' ? (n ? .5 : 2) : kind === 'deal' ? (n ? 2 : .5) : kind === 'bounty' && n ? 1.3 : 1); }

// ─── 雨天：AI 的車（警車、小隊、賽車對手、運鈔車）也照玩家的濕路面規則（側向抓地少三成、煞車變長） ───
function aiDrive(v, inp, dt) {
  breakSweep(v, dt);
  const g = v.grip, wet = player.where === 'out' ? wx.wet : 0;
  if (!wet) return driveVehicle(v, inp, dt);
  v.grip *= 1 - .3 * wet; v.brkK = 1 - .2 * wet;
  const r = driveVehicle(v, inp, dt);
  v.grip = g; v.brkK = 1;
  return r;
}

// ─── 車輛警報：撬路邊車（68-gta.js 的 startJack，車流車是把人拖下來、不響）敲破車窗後響 ALARM_T 秒，閃雙黃燈；
// 響著的時候 ALARM_COP_R 內有警察就直接 1 星（不用等路人報案），沒有警察也照樣把路人嚇跑
const ALARM_T = 8, ALARM_COP_R = 45;
const alarm = { v: null, t: 0, beep: 0, told: false };
function alarmStep(dt) {
  const j = gta.jack;
  if (j && !j.moving && j.done && !j.alarm) { j.alarm = 1; alarm.v = j.v; alarm.t = ALARM_T; alarm.beep = 0; alarm.told = false; toast('車子的警報響了'); }
  const v = alarm.v;
  if (!v) return;
  if ((alarm.t -= dt) <= 0 || v.dead) { alarm.v = null; return; }
  if ((alarm.beep -= dt) <= 0) {
    alarm.beep = .5;
    if (Math.hypot(v.x - pX(), v.z - pZ()) < 60) sfx.horn(v);
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), L = (v.len || 4.4) * .48, w = (v.w || 1.9) * .42;
    for (const s of [1, -1]) for (const e of [1, -1]) fxLights.push({ x: v.x + fx * L * s + fz * w * e, y: .75, z: v.z + fz * L * s - fx * w * e, col: lin(0xffa21c), r: 6, i: 1.6, life: 0, max: .22 });
    panic(v.x, v.z, 18, 4);
  }
  if (!alarm.told && copNear(v.x, v.z, ALARM_COP_R)) { alarm.told = true; addHeat(HEAT_STAR[0], 1); }
}

// 第三部曲的每幀入口（99-main.js 在 gtaUpdate 之後）
function v3Update(dt) {
  if (!started) return;
  chemUpdate(dt); crashUpdate(dt); skillsUpdate(dt); taxiStep(dt); heist3Update(dt); breakUpdate(dt); alarmStep(dt);
  fuelDraw();
}
gtaApi.v3.taxi = taxi; gtaApi.v3.taxiRide = taxiRide; gtaApi.v3.isNight = isNight; gtaApi.v3.crash = crashApi; gtaApi.v3.evW = evNightW; gtaApi.v3.brk = breakApi; gtaApi.v3.alarm = alarm;
// 驗收用：臨時放一面世界座標的牆（AABB），回傳拆掉它的函式
gtaApi.v3.wall = (x0, z0, x1, z1) => { const b = { x0, x1, z0, z1 }; colliders.push(b); colDirty(); return () => { colliders.splice(colliders.indexOf(b), 1); colDirty(); }; };
