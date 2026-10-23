// ═══ 第三階段：GPS 導航（大地圖點一下設導航點，紫線；任務目標黃線） ═══
// 路線沿路網圖（06-roads.js 的 RN）走：起點與終點先投影到最近的路中線，終點那段路的兩端路口各跑一次 rnField（結果快取），
// 起點從所在路段的兩端路口挑總距離最短的，再沿距離遞減的路段走過去（連接道路的折線點也畫出來）。每 0.4 秒（真實時間）重算一次。
// 排在 69-crew 之後、69-police 之前。

const gps = { wp: null, route: null, mroute: null, t: 0 };
const GPS_WP = '#c88cff', GPS_MK = '#ffcc4d';
const rnFieldC = new Map();
const rnFieldOf = id => { let D = rnFieldC.get(id); if (!D) rnFieldC.set(id, D = rnField(id)); return D; };
// 離 (x, z) 最近的路中線上的點：{ x, z, e, u }；從那一點沿路走到路段某一端的路程
function roadPoint(x, z) { const p = rnProject(x, z); return p ? { x: p.x, z: p.z, e: p.e, u: p.u } : { x, z, e: null, u: 0 }; }
const toEnd = (p, n) => n === p.e.a ? p.u : p.e.len - p.u;
// 沿路段 e 從節點 n 走到另一端的折線點（不含 n 本身）
const edgeWalk = (e, n) => (n === e.a ? e.pts.slice(1) : e.pts.slice(0, -1).reverse());
function routeTo(px, pz, tx, tz) {
  const s = roadPoint(px, pz), g = roadPoint(tx, tz);
  if (!s.e || !g.e || s.e === g.e || Math.hypot(s.x - g.x, s.z - g.z) < 6) return [[px, pz], [s.x, s.z], [g.x, g.z], [tx, tz]];
  let best = null;
  for (const gn of [g.e.a, g.e.b]) {
    const D = rnFieldOf(gn.id), tail = toEnd(g, gn);
    for (const sn of [s.e.a, s.e.b]) {
      const c = toEnd(s, sn) + D[sn.id] + tail;
      if (!best || c < best.c) best = { c, sn, gn, D };
    }
  }
  const pts = [[px, pz], [s.x, s.z]];
  let n = best.sn;
  pts.push([n.x, n.z]);
  for (let k = 0; k < 400 && n !== best.gn; k++) {
    let bo = null, bd = best.D[n.id];
    for (const { e } of n.out) { if (e.oneway && e.b === n) continue; const m = e.a === n ? e.b : e.a, v = best.D[m.id] + e.len; if (v < bd + .01 && (!bo || v < bo.v)) bo = { e, m, v }; }
    if (!bo) break;
    for (const q of edgeWalk(bo.e, n)) pts.push([q[0], q[1]]);
    n = bo.m;
  }
  pts.push([g.x, g.z], [tx, tz]);
  return pts;
}
function gpsSet(x, z) { gps.wp = { x, z }; gps.t = 0; sfx.click(); }
function gpsClear() { gps.wp = null; gps.route = null; }
function gpsUpdate() {
  gps.t -= slowmo.raw;
  if (gps.t > 0) return;
  gps.t = .4;
  const out = player.where === 'out', v = player.mode === 'drive' ? player.veh : player, px = v.x, pz = v.z;
  if (gps.wp && out && Math.hypot(gps.wp.x - px, gps.wp.z - pz) < 12) { gpsClear(); toast('抵達導航點'); }
  gps.route = gps.wp && out ? routeTo(px, pz, gps.wp.x, gps.wp.z) : null;
  const mk = missionMark();   // 69-heist.js：搶劫進行中換成搶劫目標
  gps.mroute = mk && mk.where === 'out' && out && Math.hypot(mk.x - px, mk.z - pz) > 25 ? routeTo(px, pz, mk.x, mk.z) : null;
}
function strokeRoute(ctx, pts, P2, col, w) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach(([x, z], k) => { const [a, b] = P2(x, z); if (k) ctx.lineTo(a, b); else ctx.moveTo(a, b); });
  ctx.stroke();
}
// 小地圖（90-hud.js 的 drawMini 在畫好底圖之後呼叫）
function gpsMini(ctx, P2, zoom) {
  if (gps.mroute) strokeRoute(ctx, gps.mroute, P2, GPS_MK, 7 / zoom);
  if (gps.route) strokeRoute(ctx, gps.route, P2, GPS_WP, 7 / zoom);
  if (gps.wp) { const [x, y] = P2(gps.wp.x, gps.wp.z); ctx.fillStyle = GPS_WP; ctx.beginPath(); ctx.arc(x, y, 9 / zoom, 0, 7); ctx.fill(); }
}
// 大地圖：路線與導航點；點地圖設定，點在導航點上取消
function gpsBig(c, X, Z, s) {
  const P2 = (x, z) => [X(x), Z(z)];
  if (gps.mroute) strokeRoute(c, gps.mroute, P2, GPS_MK, 5 / s);
  if (gps.route) strokeRoute(c, gps.route, P2, GPS_WP, 5 / s);
  if (gps.wp) {
    const x = X(gps.wp.x), y = Z(gps.wp.z);
    c.fillStyle = GPS_WP; c.beginPath(); c.moveTo(x, y); c.arc(x, y - 16 / s, 8 / s, Math.PI * .8, Math.PI * .2); c.closePath(); c.fill();
    c.fillStyle = '#1a1220'; c.beginPath(); c.arc(x, y - 16 / s, 3 / s, 0, 7); c.fill();
  }
}
// 測試 API（window.__nc.gta.gps）
const gpsApi = { gps, set: gpsSet, clear: gpsClear, route: routeTo };
