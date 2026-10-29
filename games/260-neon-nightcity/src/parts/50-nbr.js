// ═══ 紐柏林的森林（09-nbr.js、22-nbr.js；plans/260-nurburgring.md）：OSM 森林（09-nbr-dem.js 的土地利用，10 m 一格）每格一到兩棵，
// 艾菲爾山區的雲杉（fir_lo）與山毛櫸（broad_lo，50-assets.js 照外緣山林的遠景樹）。數量是外緣山林的好幾倍，不進 HILL_FOREST（那邊的遠景樹全部常駐）：
// 照 22-nbr.js 的地形塊（1024 m）各建自己的 InstancedMesh，鏡頭 NBR_TREE_IN 內才建、NBR_TREE_OUT 外收掉；賽道、路與路肩、水面附近不種。
// 引道坡（不是真實地形）照高度從草坡漸漸進林。近景（NBR_TREE_NEAR 內）換成 nat_forest 的冷杉與闊葉樹（27-props.js 下載的同一份，loadProps 有快取；
// 每棵四五千面，這裡的林子比外緣山林密好幾倍，半徑比那邊的 190 m 小）。遠景樹每塊一個普通的實例網格（照塊剔除；不走 20-props.js 的實例串流，那邊的包圍球跟著鏡頭、半徑上千公尺，
// 整片樹永遠剔不掉，幀率掉一成以上），鏡頭附近那幾塊自己把近景半徑內的實例抽掉（鏡頭移 8 m 重排一次）═══
const NBR_TREE_IN = 1500, NBR_TREE_OUT = 1900, NBR_TREE_NEAR = 90;
if (NBR && PROPS.fir_lo && (PROPS.broad_lo || PROPS.maple_lo)) {
  const N = nbrGrid(), LU = NBR_LU, lu = new Uint8Array(LU.nx * LU.nz), geos = [PROPS.fir_lo, PROPS.broad_lo || PROPS.maple_lo];
  { const r = nbB64(LU.rle, Uint8Array); for (let k = 0, o = 0; k < r.length; k += 2) { lu.fill(r[k], o, o + r[k + 1]); o += r[k + 1]; } }
  const [ox, oz] = toW(0, 0, SEA_FR), [ex, ez] = toW(1, 0, SEA_FR), rc = ex - ox, rs = ez - oz, fy = Math.atan2(-rs, rc);   // SEA_FR → 世界（剛體）
  const S = NBR_CH * NBR_G, A = nbrApron(), M = new T.Matrix4(), Q = new T.Quaternion(), P = new T.Vector3(), Sc = new T.Vector3(), Y = new T.Vector3(0, 1, 0);
  const hsh = (a, b) => { let h = Math.imul(a, 374761393) + Math.imul(b, 668265263) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
  const forestAt = (x, z) => {   // 0..1：這一格種樹的機率
    if (z < A.z1) return sm01((z - A.z0 - 500) / 900) * .85;
    const i = Math.floor((NBR_OX - x - NBR.D.x0) / LU.cell), j = Math.floor((NBR_OZ - z - NBR.D.z0) / LU.cell);
    return i < 0 || j < 0 || i >= LU.nx || j >= LU.nz ? 0 : lu[j * LU.nx + i] === 1 ? 1 : 0;
  };
  const lawnAt = (x, z) => { const i = Math.round((x - N.gx0) / NBR_G), j = Math.round((z - N.gz0) / NBR_G), q = j * N.nx + i; return i >= 0 && j >= 0 && i < N.nx && j < N.nz && (NBR.lawn && NBR.lawn[q] || NBR.roadR && NBR.roadR[q]); };   // 23-nbr-track.js 的草皮、23-nbr-road.js 的路邊
  const tdAt = (x, z) => { const i = Math.round((x - N.gx0) / NBR_G), j = Math.round((z - N.gz0) / NBR_G); return i < 0 || j < 0 || i >= N.nx || j >= N.nz ? 1e9 : N.TD[j * N.nx + i]; };
  let nat = null; const live = new Set(), nk = PROPS.broad_lo ? 'broad' : 'maple';
  const near = C => {
    if (!nat || !C.trees || C.treeNear) return;
    C.treeNear = C.treeLists.flatMap((L, k) => L.length ? w2Inst(nat[k ? nk : 'fir'], L, 0, NBR_TREE_NEAR) : []).map(m => (m.name = 'nbrTreesNear', m));
    for (const k in C.und) if (C.und[k].length && nat[k + '_patch']) C.treeNear.push(...w2Inst(nat[k + '_patch'], C.und[k], LY.NOREFL, 85).map(m => (m.name = 'nbrUnder', m)));   // 林下層：同外緣山林，85 m 內
  };
  if (W2.on && GLB_VS_I !== GLB_VS) loadProps('nat_forest').then(it => it && glbWarm(Object.values(it).flatMap(x => x.parts), null, true).then(() => { if (!it.fir || !it[nk]) return; nat = it; for (const C of live) near(C); }));
  const unstream = m => { const i = instStreams.indexOf(m.userData.stream); if (i >= 0) instStreams.splice(i, 1); scene.remove(m); m.dispose(); };
  // 遠景樹抽掉近景半徑內的（cut）或放回全部
  const cut = (m, cx, cz, R) => {
    const u = m.userData, src = u.src, dst = m.instanceMatrix.array, n = src.length / 16;
    if (R <= 0) { if (!u.cut) return; dst.set(src); m.count = n; u.cut = false; m.instanceMatrix.needsUpdate = true; return; }
    if (u.cut && (u.cx - cx) ** 2 + (u.cz - cz) ** 2 < 64) return;
    let c = 0; const R2 = R * R;
    for (let q = 0; q < n; q++) { if ((u.xz[q * 2] - cx) ** 2 + (u.xz[q * 2 + 1] - cz) ** 2 < R2) continue; dst.set(src.subarray(q * 16, q * 16 + 16), c * 16); c++; }
    m.count = c; u.cut = true; u.cx = cx; u.cz = cz; m.instanceMatrix.needsUpdate = true;
  };
  function build(C) {
    const L = [[], []], c0 = 10;
    for (let z = C.z0; z < C.z0 + S; z += c0) for (let x = C.x0; x < C.x0 + S; x += c0) {
      const p = forestAt(x + 5, z + 5); if (p <= 0) continue;
      for (let t = 0; t < 2; t++) {
        const ix = Math.round(x / c0), iz = Math.round(z / c0), r0 = hsh(ix * 2 + t, iz);
        if (r0 > p * (t ? .45 : .97)) continue;
        const tx = x + hsh(ix + 91, iz * 3 + t) * c0, tz = z + hsh(ix * 5 + t, iz + 37) * c0;
        if (tdAt(tx, tz) < 6 || lawnAt(tx, tz)) continue;   // 路面＋路肩、23-nbr-track.js 的草皮、村道
        const y = nbrMeshL(tx, tz); if (y < SEA_Y + 2) continue;
        const kind = hsh(Math.floor(tx / 37), Math.floor(tz / 37)) < .55 ? 0 : 1, s = .8 + hsh(ix + t, iz + 5) * .55;
        L[kind].push(tx, y - .15, tz, hsh(ix, iz + t) * 6.283, s * (kind ? 1.2 : 1));
      }
    }
    // 林緣的蕨類與野花（離賽道 80 m 內的林地）：nat_forest 的 *_patch，6 m 一格抽一次（草叢的顏色比 lawnBare 亮一截，鋪在草皮上像一塊塊螢光綠，不放）
    const und = C.und = { fern: [], flower: [] };
    for (let z = C.z0; z < C.z0 + S; z += 6) for (let x = C.x0; x < C.x0 + S; x += 6) {
      const ix = Math.round(x / 6), iz = Math.round(z / 6), r = hsh(ix * 7 + 3, iz * 5 + 1), tx = x + hsh(ix + 13, iz) * 6, tz = z + hsh(ix, iz + 29) * 6, td = tdAt(tx, tz);
      if (td < 4.5 || td > 80 || r > .3) continue;
      const L2 = !lawnAt(tx, tz) && forestAt(tx, tz) > .5 ? (r < .1 ? und.flower : und.fern) : null; if (!L2) continue;
      const y = nbrMeshL(tx, tz); if (y < SEA_Y + 1) continue;
      L2.push({ x: ox + tx * rc - tz * rs, y: y + .02, z: oz + tx * rs + tz * rc, ry: r * 40, s: .8 + hsh(iz, ix) * .5, zn: null });
    }
    C.treeLists = L.map(a => { const o = []; for (let q = 0; q < a.length; q += 5) { const [x, y, z, ry, s] = a.slice(q, q + 5); o.push({ x: ox + x * rc - z * rs, y, z: oz + x * rs + z * rc, ry: ry + fy, s, zn: null }); } return o; });
    const H = S / 2, tiles = [];   // 遠景樹再切成 512 m 的四小塊（視錐與 70-render.js 的霧裡剔除才剔得掉）
    C.treeLists.forEach((L, k) => { const b = [[], [], [], []]; for (const t of L) { const [x, z] = nbrL(t.x, t.z); b[(x - C.x0 >= H ? 1 : 0) + (z - C.z0 >= H ? 2 : 0)].push(t); } for (const q of b) tiles.push([q, k]); });
    return tiles.map(([L, k]) => {
      if (!L.length) return null;
      const m = new T.InstancedMesh(geos[k], MAT.uxI, L.length), xz = new Float32Array(L.length * 2);
      L.forEach((t, q) => { m.setMatrixAt(q, M.compose(P.set(t.x, t.y, t.z), Q.setFromAxisAngle(Y, t.ry), Sc.setScalar(t.s))); xz[q * 2] = t.x; xz[q * 2 + 1] = t.z; });
      m.computeBoundingSphere(); m.name = 'nbrTrees'; m.userData.src = m.instanceMatrix.array.slice(); m.userData.xz = xz; scene.add(m);
      return m;
    }).filter(Boolean);
  }
  let built = 0;
  NBR_TICK.push((x, z, chunks) => {
    let once = false;
    for (const C of chunks) {
      const d = Math.hypot(Math.max(C.x0 - x, x - C.x0 - S, 0), Math.max(C.z0 - z, z - C.z0 - S, 0));
      if (!C.trees && d < NBR_TREE_IN && !once) { C.trees = build(C); live.add(C); near(C); once = true; built++; }
      else if (C.trees && d > NBR_TREE_OUT) { for (const m of [...C.trees, ...C.treeNear || []]) unstream(m); C.trees = C.treeNear = C.treeLists = C.und = null; live.delete(C); }
      if (C.trees) { const R = nat && d < NBR_TREE_NEAR * detailK() + 10 ? (NBR_TREE_NEAR - 6) * detailK() : 0; for (const m of C.trees) cut(m, camera.position.x, camera.position.z, R); }
    }
  });
  NBR.api.trees = () => { let n = 0, ch = 0; for (const C of live) for (const L of C.treeLists) n += L.length; for (const m of scene.children) if (m.name === 'nbrTrees') ch++; let und = 0; for (const C of live) for (const k in C.und) und += C.und[k].length; return { n, und, meshes: ch, built, near: !!nat, tris: geos.map(g => (g.index ? g.index.count : g.attributes.position.count) / 3) }; };
}
