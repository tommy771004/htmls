// ═══ 第五階段：支線活動的共用部分（街頭賽 69-race、生存模式 69-survival、支線委託 69-tale、幫派地盤 69-turf） ═══
// 同一時間只會有一項活動（side.act）。搶劫、資產防守、幫派追殺或通緝中不能開始；活動進行中也不會冒出運鈔車、街頭事件與資產防守。
// 活動物件：{ kind, name, label（任務框小標 html）, step(dt), hud() → { text, bar（0–100，-1 不畫）, num, low }, mark() → missionMark 的格式,
//            fail(why)（陣亡、被捕、換角色時呼叫）, clear()（收掉場上的東西） }
// 任務框沿用搶劫的計時條樣式；結算畫面沿用 #heistDone。存檔在 motors.side（65-motors.js 第 6 版）。
// 排在 69-safehouse 之後、69-squads 之前：這裡只有函式，用到的東西都在呼叫時才找。

const side = { act: null };
// 不能開始的原因（可以開始就回傳空字串）
function sideBusy() {
  if (side.act) return `${side.act.name}進行中`;
  if (heist.st !== 'off' && heist.st !== 'plan') return '搶劫進行中';
  if (SQ.def) return `${SQ.def.name}正被${GANG_NAME}攻擊`;
  if (SQ.chase) return `${GANG_NAME}還在追你`;
  if (W.stars) return '先甩掉警察';
  if (crew.sw || life.dead || player.where !== 'out') return '現在不行';
  return '';
}
function sideStart(act) {
  side.act = act;
  heistObjLabel(act.label);
  gps.t = 0;
}
function sideEnd() {
  const a = side.act;
  if (!a) return;
  side.act = null;
  a.clear && a.clear();
  $('obj').classList.remove('heist'); $('objSub').classList.remove('bar', 'low'); setText('objNum', '');
  heistObjLabel(null);
  gps.t = 0;
}
const sideMark = () => side.act && side.act.mark ? side.act.mark() : null;
// 結算畫面（沿用搶劫的 #heistDone）：rows 是 [[項目, 數值], …]，hi 是要標亮的那一列
function sideDone(title, sub, rows, hi = -1) {
  const el = $('heistDone');
  el.querySelector('b').textContent = title; el.querySelector('small').textContent = sub;
  $('hpRows').innerHTML = rows.map(([a, b], i) => `<dt${i === hi ? ' class="net"' : ''}>${a}</dt><dd${i === hi ? ' class="net"' : ''}>${b}</dd>`).join('');
  el.classList.add('on'); heist.doneT = 5;
}
const fmtT = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
function sideUpdate(dt) {
  raceIdle(dt); survIdle(dt); taleIdle(dt); turfIdle(dt);
  const a = side.act;
  if (!a) return;
  if (life.dead) { a.fail(life.dead === 'busted' ? '被捕了' : '陣亡了'); return; }
  if (crew.sw) { if (!a.duo) a.fail('換了角色'); return; }   // duo：主線任務裡雙主角互換（69-w0-story.js）
  a.step(dt);
  if (side.act !== a) return;
  const h = a.hud(), o = $('obj'), sub = $('objSub');
  o.classList.add('heist');
  setText('objText', h.text);
  sub.classList.toggle('bar', h.bar >= 0);
  if (h.bar >= 0) sub.style.setProperty('--v', clamp(h.bar, 0, 100).toFixed(1) + '%');
  sub.classList.toggle('low', !!h.low);
  setText('objNum', h.num || '');
}
// 小地圖與大地圖（90-hud.js、91-map.js）
function sideBlips(add) { storyBlips(add); raceBlips(add); survBlips(add); taleBlips(add); turfBlips(add); }
function sideMini(ctx, P2, zoom) { storyMini(ctx, P2, zoom); raceMini(ctx, P2, zoom); survMini(ctx, P2, zoom); turfMini(ctx, P2, zoom); taleMini(ctx, P2, zoom); }
function sideBig(c, X, Z, s) { turfBig(c, X, Z, s); raceBig(c, X, Z, s); }
// 戰鬥員池（69-squads.js）的空位；不夠 n 個就先收倒地最久的（倒地的人佔著位置 20 秒）
const fFreeN = () => SQ.f.filter(f => !f.on).length;
function fRoom(n) {
  // 先收畫面外的，再收倒地最久的；畫面裡的身體交給 69-squads.js 的 bodyKeep 留在原地
  const dn = SQ.f.filter(f => f.on && f.state === 'down').map(f => ({ f, s: onScreen(f.x, f.z) })).sort((p, q) => p.s - q.s || p.f.downT - q.f.downT);
  while (fFreeN() < n && dn.length) { const { f, s } = dn.shift(); if (s) bodyKeep(f); fFree(f); }
}
// 立在地上的霓虹圈（街頭賽的檢查點、各活動的起點）：圓環法線沿 (dx, dz)
let ringGeo = null;
function neonRing(col, r = 6) {
  ringGeo ||= new T.TorusGeometry(1, .035, 8, 56);
  const m = new T.Mesh(ringGeo, new T.MeshBasicMaterial({ color: col, transparent: true, opacity: .9, blending: T.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
  m.scale.setScalar(r); m.visible = false; m.frustumCulled = false; scene.add(m);
  return m;
}
function ringAt(m, x, z, dx, dz, y) { m.position.set(x, groundH(x, z) + (y ?? m.scale.x * .8), z); m.rotation.set(0, Math.atan2(dx, dz), 0); m.visible = true; }

// 測試 API（window.__nc.gta.side）
const sideApi = { side, busy: sideBusy, end: sideEnd, room: fRoom, bodies: () => bodySt.filter(b => b.on).length };
