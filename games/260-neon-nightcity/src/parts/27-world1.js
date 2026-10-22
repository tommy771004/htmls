// ═══ World 第四輪（使用者提供的 ~/Downloads/world_1）：不在街區裡的地標與遠景（街區裡的建築由 10-city.js 的 bldPlace 擺）───
// 東灣對岸的三座水泥廠與 Tram Station 剩下的三棟長板樓、鷺嘴岬的石塔與石牆、
// 舊碼頭河岸的木樁階梯與兩座木棧橋入口的鐵絲網。模型是 tools/props.mjs 的 far_／w1_ 組（bld_tram 和街區共用），
// 玩家走近 near 公尺內才下載；以檔案開啟不擺（碰撞也不加）。
const W1_SITES = [];
if (GLB_ON) {
  const E = EAST_BANK_X, C = CITY_CZ;
  W1_SITES.push(
    // 東灣對岸：舊港城（golu、s7，z 約 C−190…C+190）的北邊是水泥廠與筒倉，南邊是廢棄的筒倉廠房；後面一排是長板樓
    { set: 'far_cement', id: 'plant', x: E + 120, z: C - 430, ry: Math.PI / 2, near: 1500 },
    { set: 'far_cement', id: 'tank', x: E + 140, z: C - 620, ry: 0, near: 1500 },
    { set: 'far_cement', id: 'ruin', x: E + 90, z: C + 320, ry: Math.PI / 2, near: 1500 },
    { set: 'bld_tram', id: 'tram_06', x: E + 470, z: C - 470, ry: -Math.PI / 2, near: 1500 },
    { set: 'bld_tram', id: 'tram_02', x: E + 520, z: C + 280, ry: -Math.PI / 2, near: 1500 },
    { set: 'bld_tram', id: 'tram_01', x: E + 300, z: C + 440, ry: -Math.PI / 2, near: 1500 },
  );
  // 舊碼頭的河岸階梯（Mayflower Stairs 掃描）：兩座木棧橋中間，木樁牆面朝河（原檔正面朝 +z，轉成朝 −x），整塊沉到步道面以下，
  // 水面以上只露出牆頂與階梯口
  W1_SITES.push({ set: 'w1_stairs', id: 'stairs', x: CITY_X0 - OUT_D + 4.2, z: stZ(2) + 31, y: -7.02, ry: -Math.PI / 2, near: 500, zn: ZONES[0] });
  // 木棧橋入口兩側各三片鐵絲網（2.9 m 一片，沿河岸），碰撞是一道細牆
  for (const pr of PIERS.filter(p => p.name === 'dock')) {
    const X = pr.x1 + .6;
    for (const [a, dir] of [[pr.z0 - 1, -1], [pr.z1 + 1, 1]]) {
      for (let k = 0; k < 3; k++) W1_SITES.push({ set: 'w1_fence', id: 'wire', x: X, z: a + dir * (1.45 + k * 2.9), ry: Math.PI / 2, near: 400, zn: ZONES[0] });
      addBoxL({ x0: X - .25, x1: X + .25, z0: Math.min(a, a + dir * 8.7), z1: Math.max(a, a + dir * 8.7) });
    }
  }
  // 鷺嘴岬或東灣觀景岬的石塔：離岸最遠、附近沒有樹的地方，四周一圈石塊矮牆，塔門與牆的缺口朝岬角的根部。岬角是世界座標
  let best = null;
  for (const h of CAPES.filter(h => h.name.includes('岬'))) {
    const [x0, x1, z0, z1] = h.bb;
    for (let x = x0; x <= x1; x += 2) for (let z = z0; z <= z1; z += 2) {
      if (!inPoly(h.inn, x, z)) continue;
      let shore = 1e9;
      for (let k = 0; k < h.pts.length; k++) {
        if (!h.wet[k]) continue;
        const p = h.pts[k], q = h.pts[(k + 1) % h.pts.length], dx = q[0] - p[0], dz = q[1] - p[1], t = clamp(((x - p[0]) * dx + (z - p[1]) * dz) / (dx * dx + dz * dz || 1), 0, 1);
        shore = Math.min(shore, Math.hypot(x - p[0] - dx * t, z - p[1] - dz * t));
      }
      let tree = 1e9; for (const t of trees) if (t.zn === null) tree = Math.min(tree, Math.hypot(t.x - x, t.z - z));
      const sc = Math.min(shore - 7, tree - 6) + Math.min(shore, 20) * .05;
      if (!best || sc > best.sc) best = { sc, x, z, h, ring: Math.min(9.3, tree - 1.2, shore - 4.5) };
    }
  }
  if (best && best.sc > 0) {
    const { x, z, h } = best, p0 = h.pts[0], p1 = h.pts.at(-1), door = Math.atan2((p0[0] + p1[0]) / 2 - x, (p0[1] + p1[1]) / 2 - z);   // 朝岬角根部（岸上那兩點的中間）
    W1_SITES.push({ set: 'w1_tower', id: 'tower', x, z, ry: door, near: 900, zn: null });
    addCircleL({ x, z, r: 5.3, w: 1 });
    if (best.ring > 6.5) {
      const R = best.ring, m = Math.floor(2 * Math.PI * R / 4.7);   // 一段 4.6 m，圓周分 m 格，門口那一格空著
      for (let k = 1; k < m; k++) {
        const a = door + k * 2 * Math.PI / m, sx = x + Math.sin(a) * R, sz = z + Math.cos(a) * R, ux = Math.cos(a), uz = -Math.sin(a);   // (ux, uz)：圓的切線＝模型的局部 x
        W1_SITES.push({ set: 'w1_fence', id: 'stone', x: sx, z: sz, ry: a, near: 600, zn: null });
        addBoxL({ x0: 0, x1: 4.6, z0: -.3, z1: .3, low: 1, zn: frameW(sx - ux * 2.3, sz - uz * 2.3, ux, uz) });
      }
    }
  }
}
let w1Tick = 0;
function w1Update() {
  if (!GLB_ON || (w1Tick = (w1Tick + 1) % 30)) return;
  const x = pX(), z = pZ();
  for (const o of W1_SITES) {
    if (o.req) continue;
    const zn = o.zn === undefined ? zoneAtL(o.x, o.z) : o.zn, [ax, az] = zn ? toW(o.x, o.z, zn) : [o.x, o.z];   // zn: null 是世界座標
    o.at = [ax, az];   // 測試 API 用（__nc.props.w1）
    if (Math.hypot(x - ax, z - az) > o.near) continue;
    o.req = true;
    loadProps(o.set).then(items => {
      if (!items || !items[o.id]) return;
      const g = propObject(items[o.id], o.x, o.y || 0, o.z, o.ry || 0);
      if (zn) cityAdd(g, zn); else scene.add(g);
    });
  }
}
