// ═══ 第一、第二航廈（T1、T2）的室內（Blender 細模 blender/airint.py → 內嵌的 airint.glb；擺放、碰撞、步行面、燈在自動產生的 52-air-int-data.js 的 AIR_INT）═══
// T1：兩層。地面層 0.6 m（東門進來是陸側的報到島、自助報到機、托運、航班看板、詢問台；x −27 的安檢線往西是空側；南側 z 18 以南是入境：證照查驗、檢疫、行李轉盤、海關）
//   與 4.4 m 的空側夾層（z 10 到南牆：三座登機門、候機座椅、咖啡店、免稅店、書報店、廁所、貴賓室、祈禱室、淋浴間、轉機櫃台）。
//   上下樓：西邊兩座電扶梯＋一道樓梯（z 2.2 → 8.8）、入境大廳兩座電扶梯（夾層開洞 x −21…−14.4）。
// T2：南面五座門斗（x −20…140）進陸側大廳（三座報到島），x −40 安檢線，往西是一樓空側（證照、商店、往北上夾層的電扶梯與樓梯 x −77…−67）；
//   北側 4.4 m 夾層（z −29.7…−8）四座登機門 B1–B4；夾層開洞（x 4…10.6）的電扶梯下到夾層底下的入境大廳，轉盤、海關，出口在後勤牆 x 140。
// 座標都是航廈中心起算的 SEA_FR（x 東、z 南）；兩座航廈的模型原點也在中心、沒有另外轉。
// 建築與天花解完就一直畫（外殼是單面的、門開著）；家具只在相機靠近那座航廈時畫，遠處看到的是玻璃的假室內。模型走近才解（airIntBuild），碰撞、步行面與燈開場就放。
// 室內的光：各航廈 lights 的點光，加上 lib.mjs 的 shade() 在航廈盒子裡補的一層均勻光（屋頂把天光與日光都遮了）。
const AIR_IN = { meshes: [], st: AIR_L && document.getElementById('glb-airint') ? 0 : 2 };   // st：0 還沒解、1 解模型中、2 好了（失敗或沒有模型也是 2）
const AIR_IN_T = AIR_IN.st ? [] : [
  { d: AIR_INT.t1, at: AIR_L.term, arch: ['air_t1i', 'air_t1c'], meshes: [], vis: false },
  { d: AIR_INT.t2, at: AIR_L.t2, arch: ['air_t2i'], meshes: [], vis: false },
];
for (const Tm of AIR_IN_T) {
  const A = Tm.d, T0 = Tm.at, IX = A.hx, IZ = A.hz;
  // 碰撞（照資料檔，不等模型）：局部盒轉 ry（rotateY：x' = x cos + z sin、z' = −x sin + z cos）再平移，取外框；樓下的東西只擋 3 m 以下（hy）、夾層上的只擋 3 m 以上（ly）
  const col = (x0, x1, z0, z1, ly, hy) => { const b = { x0: T0.x + x0, x1: T0.x + x1, z0: T0.z + z0, z1: T0.z + z1, zn: AIR_F }; if (ly != null) b.ly = ly; if (hy != null) b.hy = hy; colliders.push(b); };
  for (const [x0, x1, z0, z1, ly, hy] of A.col) col(x0, x1, z0, z1, ly, hy);
  const rbox = (b, x, z, ry) => {
    const c = Math.cos(ry), s = Math.sin(ry); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const [u, w] of [[b[0], b[2]], [b[1], b[2]], [b[0], b[3]], [b[1], b[3]]]) { const X = x + u * c + w * s, Z = z - u * s + w * c; x0 = Math.min(x0, X); x1 = Math.max(x1, X); z0 = Math.min(z0, Z); z1 = Math.max(z1, Z); }
    return [x0, x1, z0, z1];
  };
  for (const [n, x, , z, ry, lv, cb] of A.place) {
    const [ly, hy] = lv ? [3, null] : [null, 3];
    for (const b of AIR_INT.lcol[n] || (cb && AIR_INT.bbox[n] ? [AIR_INT.bbox[n]] : [])) { const [a, c, d, e] = rbox(b, x, z, ry); col(a, c, d, e, ly, hy); }
  }
  // 門口：人走得過、車進不來（swim 的盒只擋車，30-vehicles.js）
  for (const [x0, x1, z0, z1] of A.swim) colliders.push({ x0: T0.x + x0, x1: T0.x + x1, z0: T0.z + z0, z1: T0.z + z1, zn: AIR_F, swim: 1 });
  // 步行面：地板、夾層、電扶梯與樓梯的斜面（腳下 0.75 m 以內最高的那一面）；相機的天花（夾層底下、屋頂底面）；人在裡面時相機留在牆內
  const W = A.walk, R = W.roof;
  const roofIn = R.k === 'arch' ? z => R.y - R.r + Math.sqrt(R.r * R.r - z * z) - R.t : z => R.a + R.b * z;   // T1 的拱、T2 摺板屋頂的谷
  const surf = (x, z, y0) => {
    let best; const lim = y0 + .75;
    for (const r of W.flat) if (x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3] && r[4] <= lim && (best === undefined || r[4] > best)) best = r[4];
    for (const r of W.ramp) if (x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3]) {
      const t = r[6] === 'x' ? (x - r[0]) / (r[1] - r[0]) : (z - r[2]) / (r[3] - r[2]), h = r[4] + (r[5] - r[4]) * t;
      if (h <= lim && (best === undefined || h > best)) best = h;
    }
    return best;
  };
  const inside = (x, z) => Math.abs(x) < IX && Math.abs(z) < IZ;
  WALKS.push({ zn: AIR_ZN, bb: [T0.x - IX - 30, T0.x + IX + 30, T0.z - IZ - 30, T0.z + IZ + 30],
    y: (x, z, y0) => surf(x - T0.x, z - T0.z, y0),
    ceil: (x, z, y0) => {
      x -= T0.x; z -= T0.z; if (!inside(x, z)) return undefined;
      let c = roofIn(z) - .4;
      for (const r of W.ceil) if (y0 < r[5] && x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3]) c = Math.min(c, r[4]);
      return c;
    },
    clampCam: (x, z) => {
      const [px, pz] = toL(player.x, player.z, AIR_ZN);
      if (player.where !== 'out' || !inside(px - T0.x, pz - T0.z)) return undefined;
      const lx = x - T0.x, lz = z - T0.z, m = .35, cx = clamp(lx, -IX + m, IX - m), cz = clamp(lz, -IZ + m, IZ - m);
      return cx === lx && cz === lz ? undefined : [T0.x + cx, T0.z + cz];
    } });
  for (const [x, y, z, r, i] of A.lights) { const [X, Z] = airW(T0.x + x, T0.z + z); signLights.push({ x: X, y, z: Z, col: lin(0xfff2e2), r, i, w: 1 }); }
}
if (AIR_IN_T.length) colDirty();
// 模型走近（任一座航廈 900 m 內）才解：解 glb、烘每件家具、照擺放複製合併，分幀做（warmClock，每幀共用 6 ms）；建築一個網格、家具每 24 件一個，每一步都不會卡太久
async function airIntBuild() {
  const ck = warmClock();
  try {
    const g = await decodeGLB('airint'); if (!g) throw new Error('沒有 airint.glb');
    const P = {}; await ck.tick();
    for (const o of g.scene.children) { P[o.name] = bakeProp(o); await ck.tick(); }
    for (const Tm of AIR_IN_T) {
      const T0 = Tm.at, add = (list, keep) => { const geo = mergeGeometries(list); for (const q of list) q.dispose(); if (!geo) return; const m = new T.Mesh(geo, MAT.ux); m.userData.noTess = true; m.visible = keep || Tm.vis; cityAdd(m, AIR_ZN); if (!keep) Tm.meshes.push(m); AIR_IN.meshes.push(m); };   // SEA_FR 是剛體框，不用切長邊
      const l = Tm.arch.filter(n => P[n]).map(n => { const q = P[n].clone(); q.translate(T0.x, 0, T0.z); return q; }); if (l.length) add(l, true); await ck.tick();   // 建築（與 T1 的木格柵天花）一直畫
      let list = [];
      for (const [n, x, y, z, ry] of Tm.d.place) {
        if (!P[n]) continue;
        const q = P[n].clone(); q.rotateY(ry); q.translate(T0.x + x, y, T0.z + z); list.push(q);
        if (list.length >= 24) { add(list); list = []; await ck.tick(); }
      }
      if (list.length) add(list);
    }
    for (const k in P) P[k].dispose();
  } catch (e) { console.warn('airint', e); }
  AIR_IN.st = 2; AIR_IN.ms = ck.ms();
}
// 21-air.js 的 airUpdate 每幀叫：玩家走近就開始解模型；家具只在相機靠近那座航廈（牆外 40 m、低於 80 m）時畫
function airIntTick() {
  if (!AIR_IN_T.length) return;
  if (!AIR_IN.st) { const [x, z] = toL(pX(), pZ(), AIR_ZN); if (AIR_IN_T.some(Tm => Math.hypot(x - Tm.at.x, z - Tm.at.z) < 900)) { AIR_IN.st = 1; warmJob(airIntBuild); } }
  const [x, z] = toL(camera.position.x, camera.position.z, AIR_ZN), lo = camera.position.y < 80;
  for (const Tm of AIR_IN_T) {
    const v = lo && Math.abs(x - Tm.at.x) < Tm.d.hx + 40 && Math.abs(z - Tm.at.z) < Tm.d.hz + 40;
    if (Tm.vis !== v) { Tm.vis = v; for (const m of Tm.meshes) m.visible = v; }
  }
}
