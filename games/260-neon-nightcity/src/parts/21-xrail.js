// ═══ 港灣高架線（跨城的鐵路）：疊在港灣快速道路（06-roads.js 的 Harbor Fwy）高架上面的雙線高架鐵路，從西到東橫貫全城 ═══
// 走廊就是快速道路那道縫（片之間沒有建築），柱子立在快速道路的橋墩上、從中央護欄穿出橋面（21-coast.js 的 FWY_PIERS），
// 越過連接道路的地方沒有橋墩就跨過去；分合流點（joins）前後不立柱（中央護欄斷開，車要換線）。軌面 XR_Y，比快速道路的門架與路燈高。
// 快速道路的高架只到東端的平面路口，線越過路口沿空的縫架到城東，那一段（和兩端的坡道上）柱子自己立：避開馬路、步道上改成跨過步道的門形架。
// 三站：兩端的終點站與中間一站，名稱取所在的區名。
// 一列電聯車（21-rail.js 的 w1_train 模型與替身，編成同北嶺鐵道）在三站之間往返，終點站停久一點，出站後走渡線換到自己方向的軌道。
// 座標全部是世界座標（快速道路的中心線本來就是世界座標），網格 cityAdd(…, null)。排在 21-rail 之後（railProxyCar、railGlbCar、RAIL.EXT）
const XR_Y = DECK_H + 10.5, XR_TRK = 2, XR_HW = 3.9, XR_PW = 7.6, XR_PLAT = 118, XR_NEAR = 1500;
const XR = (() => {
  const H = FWY.find(F => F.name === 'Harbor Fwy');
  if (!H || !H.S || !RAIL) return null;
  // 線的範圍：西端從快速道路起點的平面路口後開始；快速道路在東端的平面路口就結束了（後面的縫是空地），線越過它沿縫架到城東
  const end = H.S.at(-1), aS = H.a0 + HR + 8;
  let aE = end - 50;
  while (aE > aS && (() => { const [x, z] = fwyAt(H, aE); return !inCity(x, z) || polyDistPt(CITY_POLY, x, z) < 40; })()) aE -= 10;
  if (aE - aS < 900) return null;
  const at = (a, lat = 0) => { const [x, z, hx, hz] = fwyAt(H, a); return [x - hz * lat, z + hx * lat, hx, hz]; };   // lat：往 (−hz, hx) 那一側
  // 站：兩端各一個（月台從線頭往裡 XR_PLAT），中間一站挑在兩站中點附近、不在快速道路東端的平面路口上
  const joins = (H.joins || []).map(j => j.a);
  const a0 = aS + 6 + XR_PLAT / 2, a2 = aE - 6 - XR_PLAT / 2;
  let am = (a0 + a2) / 2;
  for (let d = 0; d < 400; d += 10) { const c = [am + d, am - d].find(a => Math.abs(a - H.a1) > XR_PLAT / 2 + HR + 20); if (c !== undefined) { am = c; break; } }
  const sts = [a0, am, a2].map((a, i) => {
    const [x, z] = at(a), base = districtW(x, z) || ['西岸', '中城', '東岸'][i];
    return { a, x, z, name: base.replace(/\s.*$/, '') + '站', i };
  });
  // 編成：和北嶺鐵道的電聯車同一套（車頭＋中間＋tail＋中間＋反向的車頭）
  const list = [['cab', 0], ['mid', 0], ['tail', 0], ['mid', 0], ['cab', 1]], EXT = RAIL.EXT;
  let off = 0;
  const cars = list.map(([id, rev]) => {
    const [z0, z1] = EXT[id], fr = rev ? -z0 : z1, bk = rev ? z1 : -z0, c = { id, rev, L: z1 - z0, off: off + fr, mid: (z0 + z1) / 2 * (rev ? -1 : 1), obj: null, on: false, x: 0, z: 0 };
    off += fr + bk + .4; return c;
  });
  return { H, aS, aE, at, joins, sts, cars, trainL: off - .4, uM: { value: new T.Vector4(1, 0, 1, 0) },
    st: 'dwell', i: 0, dir: -1, s: sts[0].a - (off - .4) / 2, v: 0, t: 20, vmax: 22, acc: .9, dec: 1, dep: null, req: false, loaded: false, horned: false, snd: false, joint: 0, trips: 0 };
})();

// ─── 橋面、軌道、柱子、站（一個網格）───
if (XR) {
  const R = XR, k = new Kit(), con = 0x9a958c, con2 = 0x77736b, ball = 0x4a4642, rail = 0x6a6e72, steel = 0x51585e;
  const A0 = R.aS, A1 = R.aE, ST = 4;
  const inSt = a => R.sts.find(s => Math.abs(a - s.a) < XR_PLAT / 2 + 1);
  // 沿線的盒：中心在弧長 a、橫向 lat、高 y，沿線長 len
  const seg = (a, len, lat, y, w, h, col, mat = 2) => { const [x, z, hx, hz] = R.at(a, lat); k.box(x, y, z, len, h, w, col, mat, 0, Math.atan2(-hz, hx)); };
  for (let a = A0; a < A1; a += ST) {
    const m = a + ST / 2, s = inSt(m), hw = s ? XR_PW : XR_HW;
    seg(m, ST + .05, 0, XR_Y - 1.25, 5.2, 2.1, con2);                                   // 箱梁
    seg(m, ST + .05, 0, XR_Y - .2, 2 * hw, .4, con);                                     // 橋面板
    for (const sd of [-1, 1]) {
      seg(m, ST + .05, sd * XR_TRK, XR_Y + .1, 2.7, .22, ball);                          // 道碴
      for (const r of [-.72, .72]) seg(m, ST + .05, sd * XR_TRK + r, XR_Y + .3, .08, .17, rail, 15);   // 鋼軌
      if (!s) seg(m, ST + .05, sd * (hw - .12), XR_Y + .45, .24, 1.1, con);               // 護欄
      else {
        seg(m, ST + .05, sd * (XR_TRK + 1.6 + (XR_PW - XR_TRK - 1.6) / 2), XR_Y + .55, XR_PW - XR_TRK - 1.6, .7, 0x8f8b84);   // 月台
        seg(m, ST + .05, sd * (XR_TRK + 1.75), XR_Y + .91, .3, .02, 0xd8b43a);           // 月台邊的黃線
        seg(m, ST + .05, sd * (XR_PW - .12), XR_Y + 1.35, .24, .9, con);                  // 月台外側的矮牆與扶手
        seg(m, ST + .05, sd * (XR_PW - .12), XR_Y + 2.0, .08, .08, steel, 15);
        seg(m, ST + .05, sd * (XR_TRK + 3.2), XR_Y + 5.4, 5.4, .22, 0xb8bcc0, 10);        // 雨棚
      }
    }
    if (s && Math.round((m - s.a) / ST) % 4 === 0) for (const sd of [-1, 1]) {           // 雨棚的柱子與燈
      const [x, z] = R.at(m, sd * (XR_PW - .7)); k.box(x, XR_Y + 3.1, z, .2, 4.4, .2, steel, 15);
      const [lx, lz] = R.at(m, sd * (XR_TRK + 3)); k.box(lx, XR_Y + 5.22, lz, 1.2, .08, .3, 0xfff2dc, 11);
    }
  }
  // 兩端的車擋
  for (const [a, d] of [[A0, 1], [A1, -1]]) for (const sd of [-1, 1]) { const [x, z, hx, hz] = R.at(a + d * 2, sd * XR_TRK); k.box(x, XR_Y + .75, z, .6, 1.1, 2.4, 0xc23a2a, 2, 0, Math.atan2(-hz, hx)); }
  // 柱子：快速道路的橋墩上（中央護欄那一條）從橋面穿出去；分合流點前後 45 m 不立。沒有橋墩的地方每 26 m 自己立一支（分合流段見下）：
  // 快速道路的坡道上立在中央護欄上；快速道路結束後的縫裡立在地上（離片的路、連接道路夠遠），腳下是縫的步道就改成跨過步道的門形架
  const H = R.H, cols = [], conn = RN.edges.filter(e => e.kind === 'c' || e.kind === 'd' || e.kind === 'f');
  const segD = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
  const nearConn = (x, z, r) => conn.some(e => e.pts.some((q, i) => i && segD(x, z, e.pts[i - 1], q) < (e.hw || HR) + r));
  const onWalk = (x, z) => SEAM_PATH.some(run => run.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < 9));
  const colAt = (a, x, z, y0, legs) => {
    const top = XR_Y - 2.3, [, , hx, hz] = R.at(a), ry = Math.atan2(-hz, hx);
    if (y0 === 0 && inLake(x, z)) y0 = LAKE_Y;   // 天樞島的水道裡：從水底立起
    for (const l of legs) { const [px, pz] = R.at(a, l); k.cyl(px, (y0 + top) / 2, pz, .5, .58, top - y0, 14, con, 2); circles.push({ x: px, z: pz, r: .6, w: 1 }); }   // 橋面上的也擋車（比中央護欄寬）
    k.box(x, top - .3, z, 1.6, 1, legs.length > 1 ? 10.4 : 6.2, con2, 2, 0, ry);
    cols.push(a);
  };
  const JN = 24, nearJ = (a, r) => R.joins.some(j => Math.abs(a - j) < r);
  for (const p of FWY_PIERS) {
    const q = fwyProj(H, p.x, p.z);
    if (q.d > 1.5 || q.a < A0 + 4 || q.a > A1 - 4 || nearJ(q.a, 45)) continue;
    colAt(q.a, p.x, p.z, H.h(q.a), [0]);
  }
  // 分合流段：快速道路在匯入的橋面疊住的地方不立橋墩，這裡改成從地面立整支穿過橋面（中心線離開別條快速道路的橋面才立，分合流點前後 JN 不立）
  const roadC = RN.edges.filter(e => e.kind === 'c' || e.kind === 'd');
  const offOther = (x, z) => FWY.every(F => F === H || fwyProj(F, x, z).d > DECK_W + 1.5);
  // 能不能在 a 立柱：回傳 [柱腳高, 腳的橫向位置]，不行回傳 null
  const site = a => {
    if (nearJ(a, JN)) return null;
    const [x, z] = R.at(a), road = a > H.a0 - 1 && a < H.a1 + 1, h = road ? H.h(a) : 0;
    if (road && (Math.abs(a - H.a0) < HR + 12 || Math.abs(a - H.a1) < HR + 12)) return null;   // 平面路口
    if (road && h >= PIER_H) return nearJ(a, 120) && offOther(x, z) && !roadC.some(e => e.pts.some((q, i) => i && segD(x, z, e.pts[i - 1], q) < (e.hw || HR) + 3)) ? [0, [0]] : null;
    if (road) return nearJ(a, 45) ? null : [h, [0]];   // 坡道上：立在中央護欄上
    if (roadNear(x, z)[0] < HR + SW + 2 || nearConn(x, z, 3) || SEAM_SITES.some(o => Math.hypot(o.x - x, o.z - z) < o.R + 6)) return null;
    return [0, onWalk(x, z) ? [-4.6, 4.6] : [0]];
  };
  const put = a => { const c = site(a); if (!c) return false; const [x, z] = R.at(a); colAt(a, x, z, c[0], c[1]); return true; };
  for (let a = A0 + 6; a < A1 - 4; a += 26) if (!cols.some(c => Math.abs(c - a) < 15)) put(a);
  // 補跨距：兩支之間超過 52 m 的，從中間往外每 2 m 找一個能立的地方，直到補不下去
  for (let pass = 0; pass < 40; pass++) {
    const c = [A0, ...cols.sort((p, q) => p - q), A1]; let added = false;
    for (let i = 1; i < c.length; i++) {
      if (c[i] - c[i - 1] <= 52) continue;
      const m = (c[i] + c[i - 1]) / 2, half = (c[i] - c[i - 1]) / 2 - 15;
      for (let d = 0; d <= half && !added; d += 2) added = put(m + d) || (d > 0 && put(m - d));
      if (added) break;
    }
    if (!added) break;
  }
  R.cols = cols.sort((p, q) => p - q);
  // 架空線的電桿：兩線之間，52 m 一支
  for (let a = A0 + 10; a < A1; a += 52) {
    if (inSt(a)) continue;
    const [x, z, hx, hz] = R.at(a); k.box(x, XR_Y + 3.2, z, .28, 6.4, .28, steel, 15).box(x, XR_Y + 6.1, z, .16, .16, 5.6, steel, 15, 0, Math.atan2(-hz, hx));
  }
  for (const sd of [-1, 1]) for (let a = A0; a < A1; a += 26) seg(a + 13, 26.1, sd * XR_TRK, XR_Y + 5.7, .03, .03, 0x2a2c30, 15);   // 架空線
  cityAdd(new T.Mesh(k.build(), MAT.uber), null);
  // 站：雨棚的燈、站名牌（畫布：深灰底、白字、下面一行英文）
  for (const s of R.sts) {
    for (const sd of [-1, 1]) for (const d of [-40, 0, 40]) { const [x, z] = R.at(s.a + d, sd * (XR_TRK + 3)); signLights.push({ x, y: XR_Y + 4.8, z, col: lin(0xfff0d8), r: 24, i: 4, w: 1 }); }
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
    const c = cv.getContext('2d'); c.fillStyle = '#23272b'; c.fillRect(0, 0, 512, 128); c.fillStyle = '#d8b43a'; c.fillRect(0, 0, 14, 128);
    c.fillStyle = '#f2f0ea'; c.font = '600 58px "Avenir Next Condensed","DIN Condensed","Arial Narrow",system-ui,sans-serif'; c.textBaseline = 'middle'; c.fillText(s.name, 40, 52);
    c.fillStyle = '#9aa0a6'; c.font = '26px system-ui, sans-serif'; c.fillText('港灣高架線 · Harbor Skyline', 42, 102);
    const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
    const mt = new T.MeshBasicMaterial({ map: tx, side: T.DoubleSide, toneMapped: false, color: 0xb8b8b8 });
    for (const sd of [-1, 1]) for (const d of [-30, 30]) {
      const [x, z, hx, hz] = R.at(s.a + d, sd * (XR_PW - 1.2)), pl = new T.Mesh(new T.PlaneGeometry(3.2, .8), mt);
      pl.position.set(x, XR_Y + 3.6, z); pl.rotation.y = Math.atan2(sd * hz, -sd * hx); cityAdd(pl, null);   // 正面朝軌道
    }
  }
}

// ─── 列車：程式替身，走近才下載 w1_train 換成模型 ───
function xrBuild(items) {
  for (const c of XR.cars) {
    const o = items ? railGlbCar(items[c.id]) : railProxyCar(c.id);
    o.visible = c.obj ? c.obj.visible : false;
    if (c.obj) { o.position.copy(c.obj.position); o.rotation.copy(c.obj.rotation); c.obj.removeFromParent(); }
    c.obj = o; cityAdd(o, null);
  }
  XR.loaded = !!items;
}
if (XR) xrBuild(null);
// 這一趟的橫向位置：往 +a 開走 +XR_TRK 那一線、往 −a 開走 −XR_TRK；從終點站出發時，出站 80 m 的渡線從進站的那一線換過去
function xrLat(a) {
  const R = XR, own = R.dir * XR_TRK;
  if (!R.dep) return own;
  return R.dep.lat + (own - R.dep.lat) * sstep(0, 80, (a - R.dep.a) * R.dir);
}
// 每幀：站間的加減速、停站、車廂位置、聲音
function xrUpdate(dt) {
  if (!XR) return;
  const R = XR, n = R.sts.length;
  const near = Math.min(...R.sts.map(s => Math.hypot(player.x - s.x, player.z - s.z)), Math.hypot(player.x - R.cars[0].x, player.z - R.cars[0].z));
  if (GLB_ON && !R.req && near < XR_NEAR) { R.req = true; loadProps('w1_train').then(items => { if (items && items.cab && items.mid && items.tail) xrBuild(items); }); }
  if (R.st === 'dwell') {
    R.t -= dt;
    if (R.t <= 0) {
      const nd = R.i === n - 1 ? -1 : R.i === 0 ? 1 : R.dir, term = R.i === 0 || R.i === n - 1;
      if (nd !== R.dir) { R.dir = nd; R.s += nd * R.trainL; }   // 折返：另一端的車頭變成前面（編成前後對稱）
      R.dep = term ? { a: R.s, lat: -R.dir * XR_TRK } : null;
      R.st = 'run'; R.v = 0; R.horned = false; R.trips++;
    }
  } else {
    const tgt = R.sts[R.i + R.dir], stop = tgt.a + R.dir * R.trainL / 2, left = (stop - R.s) * R.dir;
    R.v = Math.min(R.vmax, R.v + R.acc * dt, Math.sqrt(Math.max(0, 2 * R.dec * left)));
    R.s += R.dir * Math.min(R.v * dt, Math.max(0, left));
    if (left < .05) { R.s = stop; R.v = 0; R.i += R.dir; R.st = 'dwell'; R.t = R.i === 0 || R.i === n - 1 ? 40 : 22; }
    if (!R.horned && R.v > 2) { R.horned = true; if (near < 600) sfx.trainHorn(clamp(1 - near / 600, .15, .8)); }
  }
  let nearest = 1e9;
  for (const c of R.cars) {
    const sc = R.s - R.dir * c.off, h = c.L * .36;
    c.on = near < 2400;
    c.obj.visible = c.on;
    const a = R.at(sc - h, xrLat(sc - h)), b = R.at(sc + h, xrLat(sc + h)), x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
    let ux = b[0] - a[0], uz = b[1] - a[1]; const l = Math.hypot(ux, uz) || 1; ux /= l; uz /= l;
    const fwd = R.dir * (c.rev ? -1 : 1);
    c.x = x; c.z = z; c.ux = ux * R.dir; c.uz = uz * R.dir;
    if (!c.on) continue;
    c.obj.position.set(x, XR_Y + .2, z); c.obj.rotation.y = Math.atan2(ux * fwd, uz * fwd);
    nearest = Math.min(nearest, Math.hypot(player.x - x, player.z - z));
  }
  // 行駛聲：北嶺鐵道的列車不在附近時才由這裡出聲（同一個聲音節點）
  const k = R.st === 'run' && !(RAIL && RAIL.snd) ? clamp(1 - nearest / 320, 0, 1) * clamp(R.v / 8, .3, 1) : 0, j = Math.floor(R.s / 18), clack = j !== R.joint;
  R.joint = j; if (k > 0 || R.snd) sfx.trainRun(k, clack); R.snd = k > 0;
}
// 列車頭燈（99-main.js 的 pickLights）
function xrLights() {
  if (!XR || XR.st !== 'run' || atm.lamp < .2) return [];
  const c = XR.cars[0]; if (!c.on) return [];
  const f = c.L / 2 + c.mid + .4, x = c.x + c.ux * f, z = c.z + c.uz * f;
  if (Math.hypot(x - camera.position.x, z - camera.position.z) > 300) return [];
  return [{ x, y: XR_Y + 1.8, z, col: HEAD_COL, r: 60, i: 4 * atm.lamp, dir: [c.ux, -.08, c.uz], cos: .9 }];
}
// 測試 API（99-main.js 的 __nc.props.xrail）
const xrApi = {
  get R() { return XR; }, Y: XR_Y,
  at: (a, lat = 0) => XR && XR.at(a, lat),
  // 列車馬上從第 i 站往 dir 出發
  go(i = 0, dir = 1) { const R = XR; if (!R) return; const arr = i === 0 ? -1 : i === R.sts.length - 1 ? 1 : dir; R.i = i; R.dir = arr; R.s = R.sts[i].a + arr * R.trainL / 2; R.st = 'dwell'; R.t = 0; R.dep = null; },
  tp(i = 0, lat = 16) { const R = XR; if (!R) return; const [x, z, hx, hz] = R.at(R.sts[i].a, lat); window.__nc.tp(x, z, Math.atan2(hz, -hx)); },
};
