// ═══ 第三階段：GPS 導航（大地圖點一下設導航點，紫線；任務目標黃線） ═══
// 路線沿車道圖走：終點先投影到最近的路中線，兩端路口各跑一次 fieldTo（69-police.js 的 Dijkstra），
// 起點從玩家所在路段的兩端路口挑總距離最短的。每 0.4 秒（真實時間）重算一次。
// 排在 69-crew 之後、69-police 之前：fieldTo、nearI 等只在函式裡用。

const gps = { wp: null, route: null, mroute: null, t: 0 };
const GPS_WP = '#c88cff', GPS_MK = '#ffcc4d';
// 離 (x, z) 最近的路中線上的點，與那一段路兩端的路口
function roadPoint(x, z) {
  const i = nearI(x), j = nearJ(z);
  const zA = clamp(z, stZ(0), stZ(NZ)), xS = clamp(x, avX(0), avX(NX));
  const dA = Math.abs(x - avX(i)), dS = Math.abs(z - stZ(j));
  if (dA <= dS) {
    const jf = (zA - Z0) / Q, j0 = clamp(Math.floor(jf), 0, NZ), j1 = clamp(Math.ceil(jf), 0, NZ);
    return { x: avX(i), z: zA, ends: j0 === j1 ? [[i, j0]] : [[i, j0], [i, j1]] };
  }
  const f = (xS - X0) / P, i0 = clamp(Math.floor(f), 0, NX), i1 = clamp(Math.ceil(f), 0, NX);
  return { x: xS, z: stZ(j), ends: i0 === i1 ? [[i0, j]] : [[i0, j], [i1, j]] };
}
const sameSeg = (a, b) => a.ends.length === 2 && b.ends.length === 2 && a.ends.every(([i, j], k) => b.ends[k][0] === i && b.ends[k][1] === j);
function routeTo(px, pz, tx, tz) {
  const s = roadPoint(px, pz), g = roadPoint(tx, tz);
  if (sameSeg(s, g) || Math.hypot(s.x - g.x, s.z - g.z) < 6) return [[px, pz], [s.x, s.z], [g.x, g.z], [tx, tz]];
  let best = null;
  for (const [gi, gj] of g.ends) {
    const D = fieldTo(gi, gj), tail = Math.hypot(avX(gi) - g.x, stZ(gj) - g.z);
    for (const [si, sj] of s.ends) {
      const c = Math.hypot(avX(si) - s.x, stZ(sj) - s.z) + D[NODE(si, sj)] + tail;
      if (!best || c < best.c) best = { c, si, sj, gi, gj, D };
    }
  }
  const pts = [[px, pz], [s.x, s.z]];
  let i = best.si, j = best.sj;
  for (let n = 0; n < 40; n++) {
    pts.push([avX(i), stZ(j)]);
    if (i === best.gi && j === best.gj) break;
    let bi = i, bj = j, bd = best.D[NODE(i, j)];
    for (let d = 0; d < 4; d++) if (hasEdge(i, j, d)) { const ni = i + DIRS[d][0], nj = j + DIRS[d][1], v = best.D[NODE(ni, nj)]; if (v < bd) { bd = v; bi = ni; bj = nj; } }
    if (bi === i && bj === j) break;
    i = bi; j = bj;
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
// 大地圖座標換算（drawBigMap 也用同一套）
function bigMapXf() {
  const W = bigmap.width, H = bigmap.height, s = Math.min(W / mapImg.width, H / mapImg.height);
  return { s, ox: (W - mapImg.width * s) / 2, oy: (H - mapImg.height * s) / 2 };
}
// bigmap 在 90-hud.js 才宣告，頂層這裡直接拿元素
$('bigmap').addEventListener('pointerdown', e => {
  const r = bigmap.getBoundingClientRect(), k = bigmap.width / r.width, f = bigMapXf();
  const mx = ((e.clientX - r.left) * k - f.ox) / f.s, my = ((e.clientY - r.top) * k - f.oy) / f.s;
  const x = mx / MAP_S + MAP_X0, z = my / MAP_S + MAP_Z0;
  if (x < avX(0) - HR || x > avX(NX) + HR || z < stZ(0) - HR || z > stZ(NZ) + HR) return;
  if (gps.wp && Math.hypot(gps.wp.x - x, gps.wp.z - z) < 14) gpsClear(); else gpsSet(x, z);
  gps.t = 0; gpsUpdate(); drawBigMap();
});

// 測試 API（window.__nc.gta.gps）
const gpsApi = { gps, set: gpsSet, clear: gpsClear, route: routeTo };
