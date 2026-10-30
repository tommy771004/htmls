// ═══ 山路上的車流與路人：10-city.js 的山路（HILL.paths，每一點 [x, z, 路面高]）上自己跑的一小群車與散步的人，加上幾棟別墅前院站著的住戶 ═══
// 不放進 30-vehicles.js 的 traffic（那邊的車掛在路網的邊上，很多模組照 c.e 找路）與 40-people.js 的 pedState；亂數自己一串（rng(4711)），不動 rT()／rP()。
// 車：靠右（車道中心離路中線 1.6 m），彎道照前方 16 m 的轉角減速，跟前車、讓前方的玩家；開到路底或路口就淡出，搬到相機看不到的地方再淡入（30-vehicles.js 的 ringHidden）。
// 車身用 traffic.glb 的車型與 TRAF_MAT（夜裡照樣亮頭燈尾燈），陰影與頭燈照地借 30-vehicles.js 的材質；碰撞是 dynMore 的兩個圓，被玩家的車撞到就停下來按喇叭。
// 路人：走在路肩（離路中線 3.5 m，護欄在 3.85 m），走到路底停一下再折回，前面有人就停；住戶站在前院（私人住宅，不是出售的那幾棟），講電話、抽菸或發呆
const HILL_TRAF = (() => {
  const R = (HILL.paths || []).map(P => { const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return { P, L, len: L[L.length - 1] }; }).filter(r => r.len > 60);
  const total = R.reduce((a, r) => a + r.len, 0), rh = rng(4711);
  const O = { R, cars: [], walkers: [], residents: [], on: R.length > 0 };
  if (!O.on) return O;
  // 路上 s 公尺那一點：中線位置、路面高與平滑過的切線（前後各 4 m 的差，轉折點不會讓車頭跳）
  const raw = (r, s) => {
    const { P, L } = r; s = clamp(s, 0, r.len);
    let a = 0, b = L.length - 1; while (b - a > 1) { const m = (a + b) >> 1; if (L[m] <= s) a = m; else b = m; }
    const t = (s - L[a]) / ((L[b] - L[a]) || 1), A = P[a], B = P[b];
    return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
  };
  const at = (r, s) => { const p = raw(r, s), q0 = raw(r, s - 4), q1 = raw(r, s + 4), tx = q1[0] - q0[0], tz = q1[1] - q0[1], l = Math.hypot(tx, tz) || 1; return [p[0], p[1], p[2], tx / l, tz / l]; };
  const pickRoad = () => { let u = rh() * total; for (let k = 0; k < R.length; k++) { u -= R[k].len; if (u <= 0) return k; } return R.length - 1; };
  // ─── 車 ───
  const kinds = [...SEDANS, ...SEDANS, ...STREET].filter(t => TYPES[t] && TYPES[t].geo);
  const NC = clamp(Math.round(total / 250), 4, 18);
  for (let n = 0; n < NC; n++) {
    const type = kinds[Math.floor(rh() * kinds.length)], ty = TYPES[type], r = pickRoad();
    O.cars.push({ type, r, s: 20 + rh() * (R[r].len - 40), dir: rh() < .5 ? 1 : -1, v: 0, vmax: Math.min(12, ty.vmax * .8) * (.85 + rh() * .25), pal: Math.floor(rh() * PAL.length), seed: rh(),
      palI: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, brake: 0, fade: 0, out: 0, hit: 0, honk: 0, m: new Float32Array(16),
      circ: [0, 1].map(() => ({ x: 1e6, z: 1e6, r: ty.w * .5, car: 1, hy: 0 })) });
  }
  // 幾何和城裡的車流共用頂點（同一批 BufferAttribute），只有每台車的 aIns 是自己的（直接傳原本的幾何，mkInst 會把城裡那份的 aIns 換成小的）
  const share = g => { const o = new T.BufferGeometry(); for (const k in g.attributes) if (k !== 'aIns') o.setAttribute(k, g.attributes[k]); o.setIndex(g.index); for (const gr of g.groups) o.addGroup(gr.start, gr.count, gr.materialIndex); o.boundingSphere = g.boundingSphere; o.boundingBox = g.boundingBox; return o; };
  const used = [...new Set(O.cars.map(c => c.type))], mesh = {};
  for (const t of used) {
    const ty = TYPES[t], n = O.cars.filter(c => c.type === t).length;
    mesh[t] = { near: mkInst(share(ty.geo()), n), far: ty.far ? mkInst(share(ty.far()), n) : null };
    for (const c of O.cars) if (c.type === t) c.palI = ty.pal ? c.pal + 1 : 0;
  }
  for (const c of O.cars) dynMore.push(...c.circ);
  const shadow = new T.InstancedMesh(shadowMesh.geometry, shadowMesh.material, NC), pool = new T.InstancedMesh(poolMesh.geometry, poolMesh.material, NC);
  for (const m of [shadow, pool]) { m.frustumCulled = false; m.layers.set(LY.NOREFL); m.count = 0; scene.add(m); }
  shadow.renderOrder = 2; pool.renderOrder = 3;
  O.mesh = mesh;
  // ─── 路人 ───
  const NW = clamp(Math.round(total / 350), 4, 12), homes = (typeof VILLA !== 'undefined' ? VILLA.homes : []).filter(H => !H.est);
  const NR = Math.min(6, homes.length), crowdH = crowd(NW + NR);
  for (let k = 0; k < NW; k++) {
    const r = pickRoad(), v = 1 + rh() * .45;
    O.walkers.push({ k, r, s: 10 + rh() * (R[r].len - 20), dir: rh() < .5 ? 1 : -1, v, pause: 0, walk: -1, x: 0, y: 0, z: 0, circ: { x: 1e6, z: 1e6, r: .3, hy: 0 } });
    crowdH.look(k, { r: rh });
    dynMore.push(O.walkers[k].circ);
  }
  const RES_ANIM = [ANIM.phone, ANIM.smoke, ANIM.idle, ANIM.talk];
  for (let n = 0; n < NR; n++) {
    const H = homes.splice(Math.floor(rh() * homes.length), 1)[0], h = H.h, [, , pz0] = h.pad, dx = h.drv[0];
    const lx = dx > 0 ? dx - 3.6 : dx + 3.6, lz = pz0 + 2.2, c = Math.cos(h.ry), s = Math.sin(h.ry);
    const x = h.x + lx * c + lz * s, z = h.z - lx * s + lz * c, k = NW + n;
    crowdH.look(k, { r: rh });
    crowdH.anim(k, RES_ANIM[n % RES_ANIM.length], rh() * 10, 1);
    crowdH.place(k, x, h.y, z, h.ry + Math.PI + (rh() - .5) * .8);
    circles.push({ x, z, r: .3, w: 1, hy: h.y + 2 });
    O.residents.push({ k, x, z, y: h.y, home: H.nm });
  }
  crowdH.mesh.count = NW + NR;
  scene.add(crowdH.mesh);
  O.crowd = crowdH;
  // 淡出的車搬到相機看不到、同一條路前後 30 m 沒有別的車的地方；試六次都不行就下一幀再試
  const respawn = c => {
    for (let t = 0; t < 6; t++) {
      const r = pickRoad(), s = 20 + rh() * (R[r].len - 40), p = at(R[r], s);
      if (!ringHidden(p[0], p[1], p[2] + 1.2)) continue;
      if (O.cars.some(o => o !== c && o.r === r && Math.abs(o.s - s) < 30)) continue;
      Object.assign(c, { r, s, dir: rh() < .5 ? 1 : -1, v: 4, out: 0, fade: 1, hit: 0 });
      return true;
    }
    return false;
  };
  O.update = dt => {
    const pv = player.mode === 'drive' ? player.veh : null, ppx = pv ? pv.x : player.x, ppz = pv ? pv.z : player.z, ppy = pv ? pv.y : player.y;
    const cp = camera.position;
    for (const c of O.cars) {
      const r = R[c.r];
      if (c.out) { c.fade = Math.min(1, c.fade + dt / .8); if (c.fade >= 1) respawn(c); }
      else if (c.fade > 0) c.fade = Math.max(0, c.fade - dt / 1.2);
      // 彎道：前方 16 m 的切線轉了多少
      const a = at(r, c.s), b = at(r, c.s + c.dir * 16);
      const turn = Math.abs(Math.atan2(a[3] * b[4] - a[4] * b[3], a[3] * b[3] + a[4] * b[4]));
      let want = c.vmax * (1 - .55 * Math.min(1, turn / .9)), gap = 99;
      for (const o of O.cars) if (o !== c && o.r === c.r && o.dir === c.dir && !o.out) { const d = (o.s - c.s) * c.dir; if (d > 0 && d < gap) gap = d; }
      // 前方車道上的玩家（人或車）
      const fx = a[3] * c.dir, fz = a[4] * c.dir, rx = ppx - c.x, rz = ppz - c.z, ahead = rx * fx + rz * fz, side = Math.abs(rx * fz - rz * fx);
      if (ahead > 0 && ahead < 22 && side < 3.2 && Math.abs(ppy - c.y) < 3) gap = Math.min(gap, ahead);
      if (gap < 24) want = Math.min(want, Math.max(0, (gap - TYPES[c.type].len / 2 - 4) * 1.1));
      // 被玩家的車撞到：停幾秒、按喇叭
      if (pv && c.hit <= 0 && Math.hypot(pv.x - c.x, pv.z - c.z) < (TYPES[c.type].len + pv.len) * .5 && Math.abs(pv.y - c.y) < 2 && Math.hypot(pv.vx || 0, pv.vz || 0) > 1.5) { c.hit = 3 + rh() * 2; if (c.honk <= 0) { sfx.horn(c); c.honk = 4; } }
      if (c.hit > 0) { c.hit -= dt; want = 0; }
      if (c.honk > 0) c.honk -= dt;
      c.v += clamp(want - c.v, -8 * dt, 2.5 * dt);
      c.brake = want < c.v - .3 || c.v < .3 ? 1 : 0;
      c.s += c.v * dt * c.dir;
      if (!c.out && (c.dir > 0 ? c.s > r.len - 8 : c.s < 6)) c.out = 1;   // 路底（或開回路口）：淡出
      c.s = clamp(c.s, 0, r.len);
      // 位置：中線往行進方向的右邊 1.6 m；車頭朝平滑過的切線；縱坡給車身前後傾
      const p = at(r, c.s), yaw = Math.atan2(p[3] * c.dir, p[4] * c.dir), rgx = -Math.cos(yaw), rgz = Math.sin(yaw);
      c.x = p[0] + rgx * 1.6; c.z = p[1] + rgz * 1.6; c.y = p[2] + .25; c.yaw = yaw;
      const y0 = raw(r, c.s - 2 * c.dir)[2], y1 = raw(r, c.s + 2 * c.dir)[2];
      c.pitch = -Math.atan((y1 - y0) / 4) + (c.brake && c.v > 1 ? -.012 : 0);
      placeCar(c, 0, c.y);
      const L = TYPES[c.type].len * .3;
      c.circ.forEach((q, i) => { const sg = i ? 1 : -1; q.x = c.out && c.fade > .5 ? 1e6 : c.x + Math.sin(yaw) * L * sg; q.z = c.z + Math.cos(yaw) * L * sg; q.hy = c.y + 2; });
    }
    // 畫：近景 40 m、遠景到 CAR_FAR，相機後方不畫
    const e = camera.matrixWorld.elements; let vx = -e[8], vz = -e[10]; const vl = Math.hypot(vx, vz) || 1; vx /= vl; vz /= vl;
    for (const t of used) { const M = mesh[t]; M.n0 = M.n1 = 0; }
    let ks = 0, kp = 0;
    for (const c of O.cars) {
      const dx = c.x - cp.x, dz = c.z - cp.z, d2 = dx * dx + dz * dz;
      if (d2 > 64 && dx * vx + dz * vz < -8 || d2 > CAR_FAR * CAR_FAR) continue;
      const M = mesh[c.type], far = M.far && d2 > LOD_NEAR * LOD_NEAR, m = far ? M.far : M.near, k = far ? M.n1++ : M.n0++;
      m.instanceMatrix.array.set(c.m, k * 16);
      const ia = m.geometry.attributes.aIns.array; ia[k * 4] = c.brake; ia[k * 4 + 1] = c.seed; ia[k * 4 + 2] = c.palI; ia[k * 4 + 3] = c.fade;
      if (c.fade < .6) {
        const ty = TYPES[c.type];
        _o.position.set(c.x, c.y + .02, c.z); _o.rotation.set(0, c.yaw, 0); _o.scale.set(ty.w * 1.25, 1, ty.len * 1.12); _o.updateMatrix(); shadow.setMatrixAt(ks++, _o.matrix);
        _o.position.set(c.x + Math.sin(c.yaw) * ty.len / 2, c.y + .03, c.z + Math.cos(c.yaw) * ty.len / 2); _o.scale.set(4.2, 1, 11); _o.updateMatrix(); pool.setMatrixAt(kp++, _o.matrix);
      }
    }
    for (const t of used) for (const [m, n] of [[mesh[t].near, mesh[t].n0], [mesh[t].far, mesh[t].n1]]) if (m) instPush(m, n, m.geometry.attributes.aIns);
    instPush(shadow, ks); instPush(pool, kp);
    // 路人：路肩上走，前面 1.5 m 有玩家或路底就停
    for (const w of O.walkers) {
      const r = R[w.r], p = at(r, w.s), yaw = Math.atan2(p[3] * w.dir, p[4] * w.dir);
      const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = ppx - w.x, rz = ppz - w.z, ahead = rx * fx + rz * fz;
      const block = ahead > 0 && ahead < 1.8 && Math.abs(rx * fz - rz * fx) < .9 && Math.abs(ppy - w.y) < 2;
      if (w.pause > 0) { w.pause -= dt; if (w.pause <= 0) w.dir = -w.dir; }
      else if (!block) { w.s += w.v * dt * w.dir; if (w.dir > 0 ? w.s > r.len - 4 : w.s < 4) w.pause = 1.5 + rh() * 2; }
      const walking = w.pause <= 0 && !block;
      if (walking !== (w.walk === 1)) { crowdH.anim(w.k, walking ? ANIM.walk : ANIM.idle, rh() * 10, walking ? w.v * .78 : 1); w.walk = walking ? 1 : 0; }
      const q = at(r, w.s), yw = Math.atan2(q[3] * w.dir, q[4] * w.dir);
      w.x = q[0] - Math.cos(yw) * 3.5; w.z = q[1] + Math.sin(yw) * 3.5; w.y = q[2] + .22;
      crowdH.place(w.k, w.x, w.y, w.z, yw);
      w.circ.x = w.x; w.circ.z = w.z; w.circ.hy = w.y + 2;
    }
  };
  return O;
})();
