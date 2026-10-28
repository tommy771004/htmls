// ═══ 山坡別墅區走得進去：山路、平台與別墅的地面，別墅的牆、樓梯與欄杆的碰撞，相機的地板與天花板 ═══
// 別墅的平面是建置時放進來的 VILLA_PLAN（tools/villa-plan.mjs → blender/out/villa_walls.json，Blender 座標：x 右、+y 朝路，
// 換到別墅局部（遊戲）座標是 (x, −y)，再照 h.ry 轉到世界；和 hill_homes.glb、27-props.js 的家具同一套）。
// 地面：06-roads.js 的 DECKS（玩家與自己開的車都先問 deckAt）。外緣外、山網格上的點依序是：別墅的樓板、踏階、平台（梯段）與戶外平台
// → 平台與車道 → 山路路面 → 別墅區山坡（HILL_VIL.h，和畫出來的細分網格同一個高度）；城裡、北嶺公園、雲梯城寨、機場島、光格島、海邊不管（回傳 null）。
// 牆：每段牆扣掉門洞（車庫門關著），門洞另有一個門扇的盒（69-villa.js 開門時拿掉），家具照佔地框（L 型沙發與廚房分塊），陽台與木平台的欄杆，每層一組盒（ly／hy 只擋那一層，30-vehicles.js 的 colY），框是別墅自己的 frameW；
// 樓梯：一樓那層四周是欄杆（起跑那一段開著），上一層的梯井四周是欄杆（抵達那一段開著），U 型梯兩段中間的隔板；平台：比外面高或低的那一邊有一道盒，
// 只擋比平台低的人（hy），車道那段開著；路邊車庫整塊擋、車庫頂可以走，人行門的電梯上前院（H.lift）。外緣靠山那一側的隱形高牆（10-city.js shoreRing 的 edge 牆）在每條山路的路口開口。
// 69-villa.js 接看房、購買與睡覺存檔；window.__nc.villa 是這裡的資料與查詢。
const VILLA = { homes: [], sale: [], grid: new Map(), boxes: 0, gaps: 0 };
const VILLA_WATER = new Set(['pool', 'spa', 'fountain']);
const villaCell = (x, z) => Math.floor(x / 64) * 4096 + Math.floor(z / 64);
// 世界 → Blender 座標（別墅局部 x、z 再把 z 反過來）
const villaLocal = (H, X, Z) => { const dx = X - H.h.x, dz = Z - H.h.z; return [dx * H.c - dz * H.s, -(dx * H.s + dz * H.c)]; };
const villaWorld = (H, bx, by) => [H.h.x + bx * H.c - by * H.s, H.h.z - bx * H.s - by * H.c];
const inR = (r, x, y) => x >= r[0] && x <= r[1] && y >= r[2] && y <= r[3];
// 家具佔地裡真的有東西的幾塊：[u0, u1, v0, v1]，u 是寬（模型的 −X → +X）、v 是深（正面 → 背面）的比例。blender/villa_furn.py 匯出的模型
// 量 8 cm–1 m 高的頂點（L 型沙發：靠背那排與右邊那一翼；廚房：背面的高櫃與檯面、前面的中島與吧台椅，中間是走道）
const VILLA_SUB = { sofa_l: [[0, 1, .73, 1], [.73, 1, 0, .73]], kitchen: [[0, 1, .72, 1], [.3, .98, 0, .3]] };
function villaSub(r, face, [u0, u1, v0, v1]) {   // 比例 → Blender 座標的框（朝向同 27-props.js 的 YAW：−y 是正面朝 −y）
  const [x0, x1, y0, y1] = r, W = x1 - x0, D = y1 - y0;
  if (face === '-y') return [x0 + u0 * W, x0 + u1 * W, y0 + v0 * D, y0 + v1 * D];
  if (face === '+y') return [x1 - u1 * W, x1 - u0 * W, y1 - v1 * D, y1 - v0 * D];
  if (face === '+x') return [x1 - v1 * W, x1 - v0 * W, y0 + u0 * D, y0 + u1 * D];
  return [x0 + v0 * W, x0 + v1 * W, y1 - u1 * D, y1 - u0 * D];
}
// 別墅裡的地面：y 往上 1.2 m 以內最高的面（樓板、踏階、平台、戶外平台；泳池是池底），都不是回傳 null
function villaFloor(H, bx, by, y) {
  if (!inR(H.bb, bx, by)) return null;
  const P = H.P, b = H.h.y;
  let best = null;
  const add = v => { if (v <= y + 1.2 && (best === null || v > best)) best = v; };
  for (const lv of P.lv) {
    const r = lv.r.find(r => inR(r, bx, by));
    if (r && !(lv.L > 0 && r[4] === 'void')) add(b + lv.z + .025);
  }
  for (const o of P.o) if (bx >= o[2] && bx <= o[3] && by >= o[4] && by <= o[5]) add(b + (P.lv.find(l => l.L === o[0]) || P.lv[0]).z + (VILLA_WATER.has(o[1]) ? -1.2 : .025));
  for (const st of P.st) {
    if (!inR(st.hole, bx, by)) continue;
    for (const t of st.treads) if (inR(t, bx, by)) add(b + t[4]);
    if (st.landing && inR(st.landing, bx, by)) add(b + st.landing[4]);
  }
  return best;
}
// 平台與車道（別墅局部的遊戲座標 lx、lz：−z 朝路）
function villaPad(H, lx, lz) {
  const [px0, px1, pz0, pz1] = H.h.pad, [dx, gap, yr, dr] = H.h.drv;
  if (lx >= px0 && lx <= px1 && lz >= pz0 && lz <= pz1) return H.h.y;
  if (dr) { if (Math.abs(lx - dx) <= 1.8 && lz >= pz0 - gap - .4 && lz < pz0) return yr + (H.h.y - yr) * clamp((lz - pz0 + gap) / gap, 0, 1); }   // 斜坡車道
  else if (Math.abs(lx - dx) <= HILL_GAR_W / 2 + .1 && lz >= pz0 - gap - .1 && lz < pz0) return H.h.y;   // 路邊車庫的頂（前院往路那邊延伸）
  return null;
}
const villaNear = (X, Z) => VILLA.grid.get(villaCell(X, Z)) || [];
// 外緣外的山坡上（DECKS 的一項，也給相機用）：回傳腳下的面；H 是所在的別墅（有的話）
function hillDeck(X, Z, y) {
  if (!HILL.roadD || inCity(X, Z)) return null;
  for (const H of villaNear(X, Z)) {
    const [bx, by] = villaLocal(H, X, Z), f = villaFloor(H, bx, by, y);
    if (f !== null) return f;
    const p = villaPad(H, bx, -by);
    if (p !== null) return p;
  }
  if (parkGround(X, Z) !== null || encGround(X, Z) !== null || airLandW(X, Z) || tronLandW(X, Z) || shoreAt(X, Z)) return null;
  const h = HILL_VIL.h ? HILL_VIL.h(X, Z) : hillMeshH(X, Z);
  if (!Number.isFinite(h)) return null;
  return HILL.roadD(X, Z) < HILL.roadHW + 1.1 ? hillMeshH(X, Z) + .25 : h;
}
// 所在的別墅、層與房間（69-villa.js 的進出提示）
function villaWhere(X, Z, y) {
  for (const H of villaNear(X, Z)) {
    const [bx, by] = villaLocal(H, X, Z);
    if (!inR(H.bb, bx, by)) continue;
    let at = null;
    for (const lv of H.P.lv) if (y > H.h.y + lv.z - .6) { const r = lv.r.find(r => inR(r, bx, by)); if (r && r[4] !== 'void') at = { H, L: lv.L, room: r }; }
    if (at) return at;
  }
  return null;
}
{
  // ─── 外緣的隱形高牆：每條山路的路口開一個路寬加兩側路肩的口 ───
  for (const [mx, mz] of HILL.mouths || []) for (const b of colliders.filter(b => b.edge)) {
    const f = b.zn, u = (mx - f.ox) * f.c - (mz - f.oz) * f.s, v = (mx - f.ox) * f.s + (mz - f.oz) * f.c;
    if (Math.abs(v) > 10) continue;
    const g0 = u - HILL.roadHW - 1.6, g1 = u + HILL.roadHW + 1.6;
    if (g1 < b.x0 || g0 > b.x1) continue;
    colliders.splice(colliders.indexOf(b), 1);
    if (g0 > b.x0) colliders.push({ ...b, x1: g0 });
    if (g1 < b.x1) colliders.push({ ...b, x0: g1 });
    VILLA.gaps++;
  }
  // ─── 每棟別墅 ───
  const sale = [];
  for (const h of HILL_HOMES) {
    const nm = HOME_V[h.v][0], P = VILLA_PLAN[nm];
    if (!P) continue;
    const c = Math.cos(h.ry), s = Math.sin(h.ry), f = frameW(h.x, h.z, c, -s);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const lv of P.lv) for (const r of lv.r) { x0 = Math.min(x0, r[0]); x1 = Math.max(x1, r[1]); y0 = Math.min(y0, r[2]); y1 = Math.max(y1, r[3]); }
    for (const o of P.o) { x0 = Math.min(x0, o[2]); x1 = Math.max(x1, o[3]); y0 = Math.min(y0, o[4]); y1 = Math.max(y1, o[5]); }
    const H = { h, P, nm, f, c, s, bb: [x0 - .3, x1 + .3, y0 - .3, y1 + .3] };
    VILLA.homes.push(H);
    // 格子：別墅（含平台）外接圓碰到的每一格
    const [px0, px1, pz0, pz1] = h.pad, R = Math.max(Math.hypot(Math.max(-px0, px1, -x0, x1), Math.max(-pz0 + h.drv[1], pz1, y1, -y0)), 10) + 2;
    for (let cx = Math.floor((h.x - R) / 64); cx <= Math.floor((h.x + R) / 64); cx++) for (let cz = Math.floor((h.z - R) / 64); cz <= Math.floor((h.z + R) / 64); cz++) {
      const k = cx * 4096 + cz; let L = VILLA.grid.get(k); if (!L) VILLA.grid.set(k, L = []); L.push(H);
    }
    // Blender 的矩形 → 別墅框裡的盒（遊戲座標 z = −y）
    const box = (bx0, bx1, by0, by1, ly, hy) => { colliders.push({ x0: bx0, x1: bx1, z0: -by1, z1: -by0, zn: f, ly, hy, villa: 1 }); VILLA.boxes++; };
    const lvZ = L => (P.lv.find(l => l.L === L) || {}).z;
    // 牆：扣掉門洞（車庫門除外）；擋這一層到上一層樓板下
    P.lv.forEach((lv, k) => {
      const ly = h.y + lv.z - .3, hy = h.y + (P.lv[k + 1] ? P.lv[k + 1].z : lv.z + lv.h + .3) - .3;
      for (const [ax, ay, bx, by, t, open] of lv.w) {
        const alongX = Math.abs(ay - by) < 1e-6, th = t === 'ext' ? .12 : .06, cc = alongX ? ay : ax;
        let parts = [[Math.min(alongX ? ax : ay, alongX ? bx : by), Math.max(alongX ? ax : ay, alongX ? bx : by)]];
        for (const [o0, o1, kind] of open || []) {
          if (kind === 'garage') continue;
          parts = parts.flatMap(([p0, p1]) => o1 <= p0 || o0 >= p1 ? [[p0, p1]] : [...(o0 > p0 ? [[p0, o0]] : []), ...(o1 < p1 ? [[o1, p1]] : [])]);
        }
        for (const [p0, p1] of parts) if (p1 - p0 > .05) alongX ? box(p0, p1, cc - th, cc + th, ly, hy) : box(cc - th, cc + th, p0, p1, ly, hy);
      }
    });
    // 家具：佔地框內縮 5 cm（tools/villa-plan.mjs 檢查過不壓牆、不擋門）；L 型沙發與廚房照模型量出來的形狀分幾塊（VILLA_SUB），其他整個框
    for (const [L, id, , , face, , , r] of P.f) {
      if (!r) continue;
      const z = lvZ(L), hy = h.y + z + (id === 'plant' || id === 'lamp' ? 1.2 : id === 'kitchen' ? .95 : .6);
      for (const q of VILLA_SUB[id] || [[0, 1, 0, 1]]) { const [x0, x1, y0, y1] = villaSub(r, face, q); box(x0 + .05, x1 - .05, y0 + .05, y1 - .05, h.y + z - .3, hy); }
    }
    // 門扇與拉門（hill_homes.py 的 villa_doors.json）：關著的那一扇擋人（hy 由 69-villa.js 開門時拿掉、關好再放回）；鎖不鎖在下面挑完出售的再定
    H.doors = (P.dr || []).map(([name, L, kind, px, py, th0, mv, dx0, dx1, dy0, dy1, ext, z]) => {
      const cx = (dx0 + dx1) / 2, cy = (dy0 + dy1) / 2, tx = dx1 - dx0 < .12 ? .06 - (dx1 - dx0) / 2 : 0, ty = dy1 - dy0 < .12 ? .06 - (dy1 - dy0) / 2 : 0;
      box(dx0 - tx, dx1 + tx, dy0 - ty, dy1 + ty, h.y + z - .3, h.y + z + 2.3);
      const b = colliders[colliders.length - 1];
      return { name, L, kind, px, py, th0, mv, cx, cy, ext, z, b, hy: b.hy, a: 0, lock: false };
    });
    // 樓梯：同一個梯井在每一層的四邊；起跑（entry）與抵達（arrive）的那一段開著
    const holes = new Map();
    for (const st of P.st) {
      const k = st.hole.join(), up = st.L + 1;
      if (!holes.has(k)) holes.set(k, { r: st.hole, lv: new Map() });
      const E = holes.get(k).lv;
      (E.get(st.L) || E.set(st.L, { open: [], climb: null }).get(st.L)).open.push(st.entry);
      E.get(st.L).climb = lvZ(up);
      (E.get(up) || E.set(up, { open: [], climb: null }).get(up)).open.push(st.arrive);
      // U 型梯兩段中間的隔板（玻璃或實牆）
      if (st.ty === 'U') {
        const [hx0, hx1, hy0, hy1] = st.hole, Lf = st.Lr - 1.1, ax = st.dir[1], sg = st.dir[0] === '-' ? -1 : 1, z0 = lvZ(st.L), z1 = lvZ(up);
        if (ax === 'y') { const xm = (hx0 + hx1) / 2, ya = sg > 0 ? hy0 : hy1 - Lf, yb = sg > 0 ? hy0 + Lf : hy1; box(xm - .04, xm + .04, ya, yb, h.y + z0 - .3, h.y + z1 - .35); }
        else { const ym = (hy0 + hy1) / 2, xa = sg > 0 ? hx0 : hx1 - Lf, xb = sg > 0 ? hx0 + Lf : hx1; box(xa, xb, ym - .04, ym + .04, h.y + z0 - .3, h.y + z1 - .35); }
      }
    }
    for (const { r: [hx0, hx1, hy0, hy1], lv: E } of holes.values()) for (const [L, { open, climb }] of E) {
      const z = lvZ(L), ly = h.y + z - .3, hy = climb !== null ? h.y + climb - .35 : h.y + z + 2.5;
      // 四邊：[固定座標, 沿哪一軸, 起, 迄]；開口是離 entry／arrive 點最近的那一邊上、那個點所在的半邊（I 型梯整邊）
      const edges = [[hy0, 'x', hx0, hx1], [hy1, 'x', hx0, hx1], [hx0, 'y', hy0, hy1], [hx1, 'y', hy0, hy1]];
      const cut = edges.map(() => []);
      for (const [ex, ey] of open) {
        let bi = 0, bd = 1e9;
        edges.forEach(([cc, ax], i) => { const d = Math.abs((ax === 'x' ? ey : ex) - cc); if (d < bd) { bd = d; bi = i; } });
        const [, ax, a0, a1] = edges[bi], p = ax === 'x' ? ex : ey, half = (a1 - a0) / 2, wide = P.st.some(st => st.hole.join() === [hx0, hx1, hy0, hy1].join() && st.ty === 'I');
        cut[bi].push(wide ? [a0, a1] : p < a0 + half ? [a0, a0 + half] : [a0 + half, a1]);
      }
      edges.forEach(([cc, ax, a0, a1], i) => {
        let parts = [[a0, a1]];
        for (const [o0, o1] of cut[i]) parts = parts.flatMap(([p0, p1]) => o1 <= p0 || o0 >= p1 ? [[p0, p1]] : [...(o0 > p0 ? [[p0, o0]] : []), ...(o1 < p1 ? [[o1, p1]] : [])]);
        for (const [p0, p1] of parts) if (p1 - p0 > .05) ax === 'x' ? box(p0, p1, cc - .04, cc + .04, ly, hy) : box(cc - .04, cc + .04, p0, p1, ly, hy);
      });
    }
    // 陽台、露台、木平台的欄杆：每 0.5 m 看邊外 25 cm 那一點，是同一層的房間、別的戶外面（泳池也算，人會掉進池裡）就開著；
    // 樓上的都擋，一樓的看外面（平台或山坡）比樓板低 0.7 m 以上才擋。連續擋住的幾點併成一道盒，高到樓板上 0.95 m
    const RAIL_OK = new Set(['balcony', 'terrace', 'deck', 'loggia']);
    for (const o of P.o) {
      const [L, kind, ox0, ox1, oy0, oy1] = o;
      if (!RAIL_OK.has(kind)) continue;
      const lv = P.lv.find(l => l.L === L) || P.lv[0], fz = h.y + lv.z;
      const open = (bx, by) => {
        if (lv.r.some(r => inR(r, bx, by)) || P.o.some(q => q !== o && q[0] === L && bx >= q[2] && bx <= q[3] && by >= q[4] && by <= q[5])) return true;
        if (L > 0) return false;
        const pd = villaPad(H, bx, -by); if (pd !== null) return pd > fz - .7;
        const [X, Z] = villaWorld(H, bx, by), g = HILL_VIL.h ? HILL_VIL.h(X, Z) : hillMeshH(X, Z);
        return !Number.isFinite(g) || g > fz - .7;
      };
      for (const [ax, cc, a0, a1, nx, ny] of [['x', oy0, ox0, ox1, 0, -1], ['x', oy1, ox0, ox1, 0, 1], ['y', ox0, oy0, oy1, -1, 0], ['y', ox1, oy0, oy1, 1, 0]]) {
        const n = Math.max(1, Math.round((a1 - a0) / .5)), st = [];
        for (let k = 0; k < n; k++) { const t = a0 + (a1 - a0) * (k + .5) / n, bx = ax === 'x' ? t : cc + nx * .25, by = ax === 'x' ? cc + ny * .25 : t; st.push(!open(bx, by)); }
        for (let k = 0; k < n;) {
          if (!st[k]) { k++; continue; }
          let e = k; while (e < n && st[e]) e++;
          const p0 = a0 + (a1 - a0) * k / n, p1 = a0 + (a1 - a0) * e / n, o0 = ax === 'x' ? cc + ny * .04 : cc + nx * .04;
          ax === 'x' ? box(p0, p1, Math.min(cc, o0) - .04, Math.max(cc, o0) + .04, fz - .3, fz + .95) : box(Math.min(cc, o0) - .04, Math.max(cc, o0) + .04, p0, p1, fz - .3, fz + .95);
          k = e;
        }
      }
    }
    // 平台的邊：每 2 m 一段看外面 1.5 m（山坡）比平台高（切坡的擋土牆）或低（基座）超過一個台階，那一段加一道盒，只擋比那一段上緣低的人；
    // 前緣的車道（斜坡車道 ±1.9 m、路邊車庫整個車庫頂）開著
    const ext = (lx, lz) => { const X = h.x + lx * c + lz * s, Z = h.z - lx * s + lz * c, v = HILL_VIL.h ? HILL_VIL.h(X, Z) : hillMeshH(X, Z); return Number.isFinite(v) ? v : h.y; };
    const [dx, gap, yr, dr] = h.drv, gw = dr ? 1.9 : HILL_GAR_W / 2 + .1;
    const sides = [[pz0 - .3, pz0, px0, px1, 'x', -1], [pz1, pz1 + .3, px0, px1, 'x', 1], [px0 - .3, px0, pz0, pz1, 'z', -1], [px1, px1 + .3, pz0, pz1, 'z', 1]];
    sides.forEach(([c0, c1, a0, a1, ax, sg], i) => {
      const n = Math.max(1, Math.round((a1 - a0) / 2));
      for (let k = 0; k < n; k++) {
        let p0 = a0 + (a1 - a0) * k / n, p1 = a0 + (a1 - a0) * (k + 1) / n, mx = -1e9, mn = 1e9;
        for (const t of [0, .5, 1]) { const a = p0 + (p1 - p0) * t, v = ax === 'x' ? ext(a, sg < 0 ? pz0 - 1.5 : pz1 + 1.5) : ext(sg < 0 ? px0 - 1.5 : px1 + 1.5, a); mx = Math.max(mx, v); mn = Math.min(mn, v); }
        if (mx < h.y + .5 && mn > h.y - .7) continue;
        const hy = Math.max(h.y, mx) - .45;
        const parts = i === 0 ? [[p0, Math.min(p1, dx - gw)], [Math.max(p0, dx + gw), p1]] : [[p0, p1]];
        for (const [q0, q1] of parts) if (q1 - q0 > .1) {
          if (ax === 'x') colliders.push({ x0: q0, x1: q1, z0: c0, z1: c1, zn: f, hy, villa: 1 }); else colliders.push({ x0: c0, x1: c1, z0: q0, z1: q1, zn: f, hy, villa: 1 });
          VILLA.boxes++;
        }
      }
    });
    // 路邊車庫：整塊擋住比車庫頂低的人；車庫頂上的電梯口擋人；捲門左邊的人行門與電梯口之間是電梯（69-villa.js 按 E 上下）
    if (!dr) {
      const W2 = HILL_GAR_W / 2, lz0 = pz0 - gap, lw = (lx, lz) => [h.x + lx * c + lz * s, h.z - lx * s + lz * c];
      colliders.push({ x0: dx - W2, x1: dx + W2, z0: lz0, z1: pz0, zn: f, hy: h.y - .45, villa: 1 });
      colliders.push({ x0: dx - 4.5, x1: dx - 3, z0: lz0 + .2, z1: lz0 + 1.7, zn: f, ly: h.y - .3, hy: h.y + 2.4, villa: 1 }); VILLA.boxes += 2;
      const [bX, bZ] = lw(dx - 3.75, lz0 - .9), [tX, tZ] = lw(dx - 3.75, lz0 + 2.4);
      H.lift = { lo: { x: bX, z: bZ, y: yr, yaw: h.ry + Math.PI }, hi: { x: tX, z: tZ, y: h.y, yaw: h.ry } };   // lo.y 在下面 DECKS 登錄後照地面重算
    }
    // 相機：別墅裡（不在梯井）照那一層的天花板；地板照 hillDeck（山網格的 hillH 比平台高時，相機不會被墊到天花板上）
    WALKS.push({ zn: f, bb: [Math.min(px0, x0) - 2, Math.max(px1, x1) + 2, Math.min(pz0 - h.drv[1], -y1) - 2, Math.max(pz1, -y0) + 2],
      y: (lx, lz, y0, cam) => { if (!cam) return undefined; const [X, Z] = toW(lx, lz, f), g = hillDeck(X, Z, y0); return g === null ? undefined : g; },
      ceil: (lx, lz, y0) => {
        const bx = lx, by = -lz;
        if (!inR(H.bb, bx, by) || P.st.some(st => inR(st.hole, bx, by))) return undefined;
        let cl;
        for (const lv of P.lv) if (y0 > h.y + lv.z - .6) { const r = lv.r.find(r => inR(r, bx, by)); cl = r && r[4] !== 'void' ? h.y + lv.z + lv.h - .15 : undefined; }
        return cl;
      } });
    if (!sale[h.v] || Math.hypot(h.x - CITY_C[0], h.z - CITY_C[1]) < Math.hypot(sale[h.v].h.x - CITY_C[0], sale[h.v].h.z - CITY_C[1])) sale[h.v] = H;
  }
  // 出售的：每型一棟（離市中心最近的那棟），69-market.js 的 ESTATES 裡 hv1…hv5；大門外 1 m 是看房的位置，主臥的床是睡覺的位置
  sale.forEach((H, v) => {
    if (!H) return;
    const P = H.P, L0 = P.lv[0], fd = L0.d.find(d => d[3] === 'front');
    if (!fd) return;
    const [x, y, , , ax] = fd, cand = ax === 'x' ? [[x, y + 1], [x, y - 1]] : [[x + 1, y], [x - 1, y]];
    const k = L0.r.some(r => inR(r, ...cand[0])) ? 1 : 0, [dX, dZ] = villaWorld(H, ...cand[k]), [iX, iZ] = villaWorld(H, ...cand[1 - k]);   // 門外那一點不在一樓的房間裡
    const bed = P.f.find(q => q[1] === 'bed' && q[0] > 0) || P.f.find(q => q[1] === 'bed'),   // 主臥：樓上第一張床（plan 裡主臥排在前面）
      [nX, nZ] = bed ? villaWorld(H, bed[2], bed[3]) : [iX, iZ];
    H.est = 'hv' + (v + 1);
    H.door = { x: dX, z: dZ, y: H.h.y + L0.z, yaw: Math.atan2(iX - dX, iZ - dZ) };
    H.nap = { x: nX, z: nZ, y: H.h.y + (bed ? P.lv.find(l => l.L === bed[0]).z : 0), r: bed && bed[7] && [bed[7][0] - .9, bed[7][1] + .9, bed[7][2] - .9, bed[7][3] + .9] };   // r：床的佔地外擴 0.9 m（69-villa.js 的睡覺提示）
    VILLA.sale.push(H);
  });
  // 私人住宅的外門鎖著（69-villa.js 走近不開、提示「私人住宅」）；出售的那棟與屋裡的門都開得了
  for (const H of VILLA.homes) for (const d of H.doors) d.lock = !!d.ext && !H.est;
}
DECKS.push(hillDeck);
for (const H of VILLA.homes) if (H.lift) { const o = H.lift.lo, g = hillDeck(o.x, o.z, o.y + 1); if (g !== null) o.y = g; }
