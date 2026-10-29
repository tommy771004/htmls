// ═══ 紐柏林的建築（09-nbr-dem.js 的 OSM 建築外形與估計高度；plans/260-nurburgring.md）═══
// 民房、教堂：灰泥牆、窗戶，近似長方形的（面積 ≥ 外接矩形 8 成）蓋 40° 的雙坡屋頂（屋脊沿長邊，板岩灰或陶紅），其他平頂；車庫棚子、工商、城堡、塔照種類換牆色。
// 看台：外接矩形朝最近的賽道那一邊是前緣，一階 0.8 m 深、0.4 m 高的座位往後升（座椅色塊一段段換色），後牆、側牆，深的看台加懸挑的頂棚。
// 壓到賽道或進場路的不蓋。幾何是世界座標，照 22-nbr.js 的地形塊分組（遠了霧裡剔掉）；每棟一個外接矩形的碰撞盒 ═══
if (NBR) {
  const N = nbrGrid(), [ox, oz] = toW(0, 0, SEA_FR), [ex, ez] = toW(1, 0, SEA_FR), rc = ex - ox, rs = ez - oz;
  const W = (x, z) => [ox + x * rc - z * rs, oz + x * rs + z * rc], WN = (x, z) => [x * rc - z * rs, x * rs + z * rc];
  const B = NBR_OSM.bld, cnt = nbB64(B.n, Uint16Array), xz = nbB64(B.xz, Int16Array), kind = nbB64(B.k, Uint8Array), hh = nbB64(B.h, Uint8Array);
  const S = NBR_CH * NBR_G, ck = (x, z) => Math.floor((x - N.gx0) / S) + ',' + Math.floor((z - N.gz0) / S);
  const G = new Map(), kitAt = (x, z) => { const key = ck(x, z); let k = G.get(key); if (!k) G.set(key, k = new Kit(true)); return k; };   // 看台（MAT.ux）
  const FC = 256, fk = (x, z) => Math.floor((x - N.gx0) / FC) + ',' + Math.floor((z - N.gz0) / FC), fbuf = () => ({ p: [], n: [], uv: [], b: [], b2: [], idx: [] });
  const FB = new Map(), facAt = (x, z) => { const key = fk(x, z); let e = FB.get(key); if (!e) FB.set(key, e = { B: fbuf(), list: [], x0: N.gx0 + Math.floor((x - N.gx0) / FC) * FC, z0: N.gz0 + Math.floor((z - N.gz0) / FC) * FC, far: null, det: null }); return e; };   // 立面（MAT_FACADE），256 m 一格：遠景與細模
  const RF = new Map(), roofAt = (x, z) => { const key = ck(x, z); let k = RF.get(key); if (!k) RF.set(key, k = new Kit(true)); return k; };   // 遠處的斜屋頂（近處換掉時整塊藏起來）
  const NR = new Map(), nearAt = (x, z) => { const key = ck(x, z); let a = NR.get(key); if (!a) NR.set(key, a = []); return a; };   // 近處才建的斜屋頂
  const tdAt = (x, z) => { const i = Math.round((x - N.gx0) / NBR_G), j = Math.round((z - N.gz0) / NBR_G); return i < 0 || j < 0 || i >= N.nx || j >= N.nz ? 1e9 : N.TD[j * N.nx + i]; };
  const hsh = (a, b) => { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) | 0; h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296; };
  // 一個三角形／四邊形：法線照給的方向決定繞向
  const tri = (k, a, b, c, n, col, mat) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx, l = Math.hypot(gx, gy, gz) || 1, f = gx * n[0] + gy * n[1] + gz * n[2] >= 0 ? 1 : -1;
    for (const p of f > 0 ? [a, b, c] : [a, c, b]) { k.pos.push(p[0], p[1], p[2]); k.nor.push(gx / l * f, gy / l * f, gz / l * f); k.col.push(col.r, col.g, col.b); k.mat.push(mat); }
  };
  const quad2 = (k, a, b, c, d, n, col, mat) => { tri(k, a, b, c, n, col, mat); tri(k, a, c, d, n, col, mat); };
  // 最小外接矩形（SEA_FR）：中心、長邊方向 u、半長 a、半寬 b
  function obb(P) {
    let best = null;
    for (let i = 0; i < P.length; i++) {
      const q = P[(i + 1) % P.length], dx = q[0] - P[i][0], dz = q[1] - P[i][1], l = Math.hypot(dx, dz); if (l < .3) continue;
      const ux = dx / l, uz = dz / l; let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
      for (const [x, z] of P) { const a = x * ux + z * uz, b = -x * uz + z * ux; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
      const ar = (a1 - a0) * (b1 - b0); if (best && ar >= best.ar) continue;
      const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2; best = { ar, cx: ca * ux - cb * uz, cz: ca * uz + cb * ux, ux, uz, a: (a1 - a0) / 2, b: (b1 - b0) / 2 };
    }
    if (best && best.b > best.a) { const { ux, uz } = best; best = { ...best, ux: -uz, uz: ux, a: best.b, b: best.a }; }   // u 沿長邊
    return best;
  }
  const area = P => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };
  const st = { n: 0, skip: 0, stand: 0, gable: 0, col: 0 }, BL = [];   // BL：拉車道用（看台以外）
  // 看台：O 是外接矩形，v 指向背對賽道那一側。混凝土的階梯看台（踏面 0.8 m），每 14 m 左右一條走道（每排兩階、踏步邊黃色防滑條），
  // 座椅是一張張的塑膠椅（座面、椅背、腳座；實例化，450 m 內才畫，遠處換成一條條色帶）、前牆上一道鋼欄杆；後牆是空心磚加壁柱；
  // 深的看台有懸挑頂棚：後面每 8 m 一根鋼柱，柱頂一榀往前伸的桁架（上下弦＋斜腹桿），桁架上每 2 m 一條檁條，上面鋪浪板，前緣一道封簷板
  const SEATH = [0x24344f, 0x26364f, 0x4f565e, 0x6b2421, 0x2a4434], STANDS = [];
  const seatGeo = SEATH.map(c => { const q = new Kit(true); q.box(0, .43, .56, .44, .05, .4, c, 2); q.box(0, .66, .78, .44, .44, .045, c, 2, -.16); q.box(0, .2, .6, .07, .4, .2, 0x3a3d40, TX.galv); return q.build(); });
  function stand(k, O, y0, h, sd) {
    const L = O.a * 2, D = O.b * 2, vx = -O.uz * sd, vz = O.ux * sd, at = (a, b, y) => { const [X, Z] = W(O.cx + O.ux * a + vx * b, O.cz + O.uz * a + vz * b); return [X, y, Z]; };
    const [UX, UZ] = WN(O.ux, O.uz), [VX, VZ] = WN(vx, vz), up = [0, 1, 0], back = [VX, 0, VZ], front = [-VX, 0, -VZ], ry = Math.atan2(VX, VZ);
    const rows = Math.max(3, Math.min(40, Math.floor((D - 1) / .8))), rh = Math.min(.42, Math.max(.3, (h - 3) / rows)), b0 = -O.b, y1 = y0 + 1.6, conc = lin(0xa8a69e), dark = lin(0x4b4d50), nose = lin(0xb89a2a);
    const fk = new Kit(true), seats = SEATH.map(() => []), M4 = new T.Matrix4(), Q4 = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), ry), V3 = new T.Vector3(), S1 = new T.Vector3(1, 1, 1);
    // 走道：照長度均分，每段 12～16 m
    const nSec = Math.max(1, Math.round(L / 14)), sw = L / nSec, AW = 1.2, aisle = a => { const u = (a + O.a) / sw; return Math.abs(u - Math.round(u)) * sw < AW / 2 && Math.round(u) > 0 && Math.round(u) < nSec; };
    quad2(k, at(-O.a, b0, y0 - .5), at(-O.a, b0, y1), at(O.a, b0, y1), at(O.a, b0, y0 - .5), front, conc, TX.conc);   // 前牆
    quad2(k, at(-O.a, b0 - .02, y1 - .55), at(-O.a, b0 - .02, y1 - .05), at(O.a, b0 - .02, y1 - .05), at(O.a, b0 - .02, y1 - .55), front, dark, 2);   // 前牆上緣的深色帶
    for (let a = -O.a; a <= O.a + .01; a += L / Math.max(1, Math.round(L / 2))) { const [X, , Z] = at(a, b0 + .08, 0); k.box(X, y1 + .55, Z, .05, 1.1, .05, 0x6d7276, TX.galv); }   // 欄杆
    for (const hy of [1.08, .55]) k.bar(...at(-O.a, b0 + .08, y1 + hy), ...at(O.a, b0 + .08, y1 + hy), .05, .05, 0x7a7f83, TX.galv);
    for (let r = 0; r < rows; r++) {
      const ya = y1 + r * rh, bA = b0 + r * .8, bB = bA + .8;
      quad2(k, at(-O.a, bA, ya), at(O.a, bA, ya), at(O.a, bB, ya), at(-O.a, bB, ya), up, conc, TX.conc);   // 踏面
      quad2(k, at(-O.a, bB, ya), at(-O.a, bB, ya + rh), at(O.a, bB, ya + rh), at(O.a, bB, ya), front, conc, TX.conc);   // 階
      for (let j = 1; j < nSec; j++) {   // 走道：踏面中間多一階（半高），兩階的邊各一條黃色防滑條
        const ac = -O.a + j * sw, a0 = ac - AW / 2, a1 = ac + AW / 2, bm = bA + .4, ym = ya + rh / 2;
        quad2(k, at(a0, bm, ya + .003), at(a0, bm, ym), at(a1, bm, ym), at(a1, bm, ya + .003), front, conc, TX.conc);
        quad2(k, at(a0, bm, ym), at(a1, bm, ym), at(a1, bB, ym), at(a0, bB, ym), up, conc, TX.conc);
        for (const [bn, yn] of [[bA, ya], [bm, ym]]) quad2(k, at(a0, bn, yn + .006), at(a1, bn, yn + .006), at(a1, bn + .06, yn + .006), at(a0, bn + .06, yn + .006), up, nose, 2);
      }
      for (let j = 0; j < nSec; j++) {   // 座椅：一段一色（大多深藍、灰，少數深紅、深綠）；遠景的色帶
        const r0 = hsh(j + 7, sd * 13 + rows), c = r0 < .55 ? (r0 < .3 ? 0 : 1) : r0 < .8 ? 2 : r0 < .92 ? 3 : 4;
        const a0 = -O.a + j * sw + (j ? AW / 2 : .3), a1 = -O.a + (j + 1) * sw - (j < nSec - 1 ? AW / 2 : .3), n = Math.max(1, Math.floor((a1 - a0) / .5)), cc = lin(SEATH[c]);
        quad2(fk, at(a0, bA + .35, ya + .45), at(a1, bA + .35, ya + .45), at(a1, bA + .75, ya + .45), at(a0, bA + .75, ya + .45), up, cc, 2);
        quad2(fk, at(a0, bA + .76, ya), at(a0, bA + .76, ya + .86), at(a1, bA + .76, ya + .86), at(a1, bA + .76, ya), front, cc, 2);
        for (let q = 0; q < n; q++) { const [X, Y, Z] = at(a0 + (q + .5) * (a1 - a0) / n, bA, ya); seats[c].push(M4.compose(V3.set(X, Y, Z), Q4, S1).clone()); }
      }
    }
    const yt = y1 + rows * rh, bE = b0 + rows * .8, cmu = lin(0x8d8a83);
    quad2(k, at(-O.a, bE, y0 - .5), at(-O.a, bE, yt + 1.2), at(O.a, bE, yt + 1.2), at(O.a, bE, y0 - .5), back, cmu, TX.cmu);   // 後牆
    quad2(k, at(-O.a, bE - .01, yt), at(-O.a, bE - .01, yt + 1.2), at(O.a, bE - .01, yt + 1.2), at(O.a, bE - .01, yt), front, cmu, TX.cmu);   // 最上一排後面的牆
    for (const e of [-1, 1]) {   // 側牆（梯形）
      const sn = [UX * e, 0, UZ * e];
      quad2(k, at(O.a * e, b0, y0 - .5), at(O.a * e, b0, y1), at(O.a * e, bE, yt + 1.2), at(O.a * e, bE, y0 - .5), sn, cmu, TX.cmu);
    }
    const colA = [], nc = Math.max(1, Math.round(L / 8)); for (let j = 0; j <= nc; j++) colA.push(-O.a + L * j / nc);
    for (const a of colA) { const [X, , Z] = at(a, bE + .2, 0); k.box(X, (y0 - .5 + yt + 1.2) / 2, Z, .5, yt + 1.7 - y0, .4, 0x8d8a83, TX.cmu); }   // 後牆的壁柱
    if (D > 8) {   // 懸挑頂棚
      const yr = yt + 4.7, bf = b0 + D * .1, bc = bE + .2, rise = 1.2, yT = b => yr + rise * (bc - b) / (bc - bf), yB = b => yT(b) - 2.2 * (b - bf) / (bc - bf) - .25;
      quad2(k, at(-O.a, bc + .3, yT(bc + .3) + .05), at(O.a, bc + .3, yT(bc + .3) + .05), at(O.a, bf - .2, yT(bf - .2) + .05), at(-O.a, bf - .2, yT(bf - .2) + .05), up, lin(0xb3b6b8), TX.sheet);   // 浪板
      quad2(k, at(-O.a, bc + .3, yT(bc + .3) - .02), at(O.a, bc + .3, yT(bc + .3) - .02), at(O.a, bf - .2, yT(bf - .2) - .02), at(-O.a, bf - .2, yT(bf - .2) - .02), [0, -1, 0], lin(0x8e9193), TX.sheet);
      for (const a of colA) {
        const [X, , Z] = at(a, bc, 0); k.box(X, (yt + yr) / 2, Z, .4, yr - yt + .6, .3, 0x5f6366, TX.galv);   // 鋼柱
        k.bar(...at(a, bc, yT(bc)), ...at(a, bf, yT(bf)), .22, .3, 0x5f6366, TX.galv);   // 上弦
        k.bar(...at(a, bc, yB(bc)), ...at(a, bf, yB(bf)), .2, .22, 0x5f6366, TX.galv);   // 下弦
        const ns = 8; for (let j = 0; j < ns; j++) { const ba = bc + (bf - bc) * j / ns, bb = bc + (bf - bc) * (j + 1) / ns; k.bar(...at(a, ba, j % 2 ? yT(ba) : yB(ba)), ...at(a, bb, j % 2 ? yB(bb) : yT(bb)), .1, .1, 0x5f6366, TX.galv); k.bar(...at(a, bb, yB(bb)), ...at(a, bb, yT(bb)), .08, .08, 0x5f6366, TX.galv); }
      }
      for (let b = bc; b >= bf - .01; b -= 2) k.bar(...at(-O.a, b, yT(b) - .14), ...at(O.a, b, yT(b) - .14), .12, .16, 0x6c7073, TX.galv);   // 檁條
      quad2(k, at(-O.a, bf - .22, yT(bf) - .75), at(-O.a, bf - .22, yT(bf) + .12), at(O.a, bf - .22, yT(bf) + .12), at(O.a, bf - .22, yT(bf) - .75), front, lin(0x2c2f33), TX.sheet);   // 封簷板
      quad2(k, at(-O.a, bc + .32, yT(bc) - .4), at(-O.a, bc + .32, yT(bc) + .1), at(O.a, bc + .32, yT(bc) + .1), at(O.a, bc + .32, yT(bc) - .4), back, lin(0x2c2f33), TX.sheet);   // 後緣的天溝
    }
    const S = { x: O.cx, z: O.cz, r: Math.hypot(O.a, O.b), far: null, near: [] };
    if (fk.pos.length) { S.far = new T.Mesh(fk.build(), MAT.ux); S.far.name = 'nbrSeatsFar'; cityAdd(S.far, null); }
    seats.forEach((list, c) => {
      if (!list.length) return;
      const m = new T.InstancedMesh(seatGeo[c], MAT.uxI, list.length); list.forEach((mm, q) => m.setMatrixAt(q, mm));
      m.computeBoundingSphere(); m.name = 'nbrSeats'; m.visible = false; scene.add(m); S.near.push(m); st.seats = (st.seats || 0) + list.length;
    });
    STANDS.push(S);
    return yt + 6;
  }
  for (let i = 0, o = 0; i < cnt.length; i++) {
    const n = cnt[i], P = []; for (let j = 0; j < n; j++) P.push([NBR_OX - xz[(o + j) * 2] / 2, NBR_OZ - xz[(o + j) * 2 + 1] / 2]); o += n;
    if (P.length > 3 && Math.hypot(P[0][0] - P[n - 1][0], P[0][1] - P[n - 1][1]) < .1) P.pop();
    const O = obb(P); if (!O || P.length < 3) continue;
    let y0 = 1e9, ym = -1e9, bad = false;
    for (const [x, z] of P) { if (tdAt(x, z) < 1.5 || !nbrInL(x, z)) bad = true; const y = nbrMeshL(x, z); y0 = Math.min(y0, y); ym = Math.max(ym, y); }
    if (bad || nbrTrackL(O.cx, O.cz, 2) || ym - y0 > 12 || ym < SEA_Y + 1 || P.some(([x, z]) => nbrPitIn(x, z, 3))) { st.skip++; continue; }   // 維修區大樓（24-nbr-pit.js）照自己的蓋
    const kd = kind[i], h = hh[i] / 4, k = kitAt(O.cx, O.cz), sd = hsh(Math.round(O.cx), Math.round(O.cz)); let top = ym + h;
    if (kd === 0) {   // 看台：前緣朝最近的賽道點
      let best = 1e9, side = 1;
      for (const Tk of [NBR.gp, NBR.ns, NBR.pit]) for (const q of Tk.p) { const d = (q[0] - O.cx) ** 2 + (q[1] - O.cz) ** 2; if (d < best) { best = d; side = (-(q[0] - O.cx) * O.uz + (q[1] - O.cz) * O.ux) > 0 ? -1 : 1; } }
      top = stand(k, O, y0, Math.max(6, h), side); st.stand++;
    } else {
      // 牆：城裡的程式立面（10-city.js 的 MAT_FACADE：窗、窗洞視差、室內映射、夜裡亮燈）。樣式：民房、教堂是灰泥（2），一成半紅磚（0、1）；
      // 工商是灰泥，高的有一部分玻璃帷幕（3）；車庫棚子、塔、城堡是沒有窗的純牆（aB2.w 的 2）。著色器的樓層線是世界高度 gH + k·fh，
      // 所以牆腳往下對齊到最近的樓層線、屋簷照整數層數，窗才不會被牆腳或屋簷切掉
      const res = kd === 1 || kd === 4 || kd === 7, stl = kd === 3 ? (h > 14 && sd < .35 ? 3 : 2) : kd === 5 || kd === 6 ? 7 : kd === 2 ? 2 : sd < .72 ? 2 : sd < .86 ? 0 : 1;
      const solid = kd === 2 || kd === 5 || kd === 6, fh = facFh(stl);
      // 窗從坡上最高那個角的地面以上那條樓層線起算（第一排窗台離地至少 0.3 m）；底下到最低的地面是石砌的牆基（solid，坡地上的房子露出一截）
      let yb = FAC_GH + Math.round((ym - FAC_GH) / fh) * fh; if (yb + .18 * fh < ym + .3) yb += fh;
      const nF = Math.max(1, Math.round((res ? Math.min(h, 8) : h) / fh)), eave = yb + nF * fh + .75;
      BL.push({ O, P, sd });
      const fe = facAt(O.cx, O.cz), Fs = [], flat = !(res && area(P) > O.a * O.b * 4 * .8 && O.b < 9);
      let sa = 0; for (let j = 0; j < P.length; j++) { const p = P[j], q = P[(j + 1) % P.length]; sa += p[0] * q[1] - q[0] * p[1]; }
      const sg = sa > 0 ? 1 : -1;   // 外法線照多邊形的繞向（凹的 L、U 形，用中心判斷會把內凹那幾面翻進去）
      for (let j = 0; j < P.length; j++) {
        let a = P[j], b = P[(j + 1) % P.length]; const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < .05) continue;
        const nx = dz / L * sg, nz = -dx / L * sg;
        const [NX, NZ] = WN(nx, nz); let [AX, AZ] = W(a[0], a[1]), [BX, BZ] = W(b[0], b[1]);
        if ((BX - AX) * NZ - (BZ - AZ) * NX < 0) [AX, AZ, BX, BZ] = [BX, BZ, AX, AZ];   // u 從面向觀看者的左邊算起（右手邊是 (nz, −nx)，09-mass.js 的 facFace）
        Fs.push({ ax: AX, az: AZ, ux: (BX - AX) / L, uz: (BZ - AZ) / L, nx: NX, nz: NZ, w: L });
      }
      // 遠景每面一片（det：鏡頭 SET.fac 內換成 09-mass.js 的 facHoles，窗挖進牆裡）；平頂的屋頂與簷口（照 10-city.js 的 lotAll，三段出挑的線腳）
      const RV = flat ? P.map(([x, z]) => { const [X, Z] = W(x, z); return [X, eave, Z]; }) : null, rtri = flat ? T.ShapeUtils.triangulateShape(P.map(([x, z]) => new T.Vector2(x, z)), []) : null;
      const geo = (B, det) => {
        const A2 = [0, 1, eave, solid ? 2 : 0], S2 = solidOf(A2), SC = [sd, 7, 1, 0], rec = stl === 2 ? .3 : stl === 3 ? .12 : .22;
        for (const F of Fs) {
          const A = [sd, stl, F.w, 0];
          fvq(B, F, 0, F.w, 0, y0 - .6, yb, A, S2);   // 牆基：同一種牆、不開窗
          if (det && !solid && F.w > 2.4) facHoles(B, F, A, A2, stl, eave, yb, eave, rec, null); else fvq(B, F, 0, F.w, 0, yb, eave, A, A2);
          if (flat && stl !== 3) for (const [o, y0b, y1b] of [[.1, eave - .62, eave - .34], [.2, eave - .34, eave - .16], [.36, eave - .16, eave + .06]]) fbx(B, F, -o, F.w + o, 0, o, y0b, y1b, SC, S2, SC, S2);
        }
        if (flat) for (let [i0, i1, i2] of rtri) {
          const A = RV[i0], Bv = RV[i1], Cv = RV[i2]; if ((Bv[0] - A[0]) * (Cv[2] - A[2]) - (Bv[2] - A[2]) * (Cv[0] - A[0]) > 0) [i1, i2] = [i2, i1];   // 從上面看逆時針
          quad(B, RV[i0], RV[i1], RV[i2], RV[i2], [0, 1, 0], 0, 1, [sd, stl, 1, 0], [0, 1, eave, 0]);
        }
      };
      geo(fe.B, false); fe.list.push(geo);
      if (!flat) {   // 雙坡屋頂（外接矩形，屋脊沿長邊）：遠處兩片坡，近處換成 20-roof.js 那套
        const hw = O.b, H = hw * Math.tan(40 * Math.PI / 180), [UX, UZ] = WN(O.ux, O.uz), RY = Math.atan2(UX, UZ), [CX, CZ] = W(O.cx, O.cz);
        const Pp = (a, y, b2) => [CX + UZ * a + UX * b2, y, CZ - UX * a + UZ * b2];   // a 橫過屋脊、b 沿屋脊（和 20-roof.js 的局部框同一個轉法）
        const slate = hsh(Math.round(O.cz * 3), Math.round(O.cx)) < .78, R = { Pp, RY, hw, hd: O.a, H, y0: eave, slate, stl, sd };
        const rcol = lin(slate ? 0x3b3e45 : 0x8a4028), wcol = lin(stl === 0 ? 0x6e3226 : stl === 1 ? 0x6b4d38 : 0x8c8578);
        const kr = roofAt(O.cx, O.cz);
        for (const e of [-1, 1]) {
          quad2(kr, Pp(e * (hw + .3), eave - .3 * Math.tan(.7), -O.a - .35), Pp(e * (hw + .3), eave - .3 * Math.tan(.7), O.a + .35), Pp(0, eave + H, O.a + .35), Pp(0, eave + H, -O.a - .35), [UZ * e, 1, -UX * e], rcol, slate ? TX.slate : TX.tile);
          tri(kr, Pp(-hw, eave, e * O.a), Pp(hw, eave, e * O.a), Pp(0, eave + H, e * O.a), [UX * e, 0, UZ * e], wcol, stl <= 1 ? TX.brick : TX.conc);
        }
        nearAt(O.cx, O.cz).push(R);
        top = eave + H; st.gable++;
      } else top = eave + .06;   // 平頂：立面的屋頂（瀝青、積水），上面 geo 建
    }
    // 碰撞：外接矩形（世界座標的中心與長邊方向）
    const [CX, CZ] = W(O.cx, O.cz), [UX, UZ] = WN(O.ux, O.uz);
    colliders.push({ x0: -O.a, x1: O.a, z0: -O.b, z1: O.b, zn: frameW(CX, CZ, UX, UZ), ly: y0 - 1, hy: top }); st.col++;
    st.n++;
  }
  for (const k of G.values()) if (k.pos.length) { const m = new T.Mesh(k.build(), MAT.ux); m.name = 'nbrStands'; cityAdd(m, null); }
  // 車道：離最近的路 4～90 m 的房子，從朝路那一面的牆中間拉一條微彎的車道接到路中心（23-nbr-road.js 鋪）；中間壓到別棟就改直線，還是壓到就不拉
  if (NBR.roadLay) {
    const OH = new Map(), ok2 = (x, z) => Math.floor(x / 32) + ',' + Math.floor(z / 32);
    for (const b of BL) { const r = Math.hypot(b.O.a, b.O.b) + 2; for (let j = Math.floor((b.O.cz - r) / 32); j <= Math.floor((b.O.cz + r) / 32); j++) for (let i = Math.floor((b.O.cx - r) / 32); i <= Math.floor((b.O.cx + r) / 32); i++) { const key = i + ',' + j; let a = OH.get(key); if (!a) OH.set(key, a = []); a.push(b); } }
    const hit = (x, z, self) => { for (const b of OH.get(ok2(x, z)) || []) { if (b === self) continue; const O = b.O, dx = x - O.cx, dz = z - O.cz; if (Math.abs(dx * O.ux + dz * O.uz) < O.a + 1.2 && Math.abs(-dx * O.uz + dz * O.ux) < O.b + 1.2) return true; } return false; };
    for (const b of BL) {
      const { O, P } = b; let sa = 0; for (let j = 0; j < P.length; j++) { const p = P[j], q = P[(j + 1) % P.length]; sa += p[0] * q[1] - q[0] * p[1]; }
      const r0 = NBR.roadNear(O.cx, O.cz, 90 + O.a); if (!r0) continue;
      let best = null;   // 朝路、離路最近的那一面（夠寬放得下車道）
      for (let j = 0; j < P.length; j++) {
        const a = P[j], c = P[(j + 1) % P.length], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz); if (L < 3.2) continue;
        const nx = dz / L * Math.sign(sa), nz = -dx / L * Math.sign(sa), mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2, d = Math.hypot(r0[0] - mx, r0[1] - mz);
        if (((r0[0] - mx) * nx + (r0[1] - mz) * nz) / d < .35) continue;
        if (!best || d < best.d) best = { d, x: mx + nx * .6, z: mz + nz * .6, nx, nz };
      }
      if (!best) continue;
      const r = NBR.roadNear(best.x, best.z, 90); if (!r || r[2] - r[3] < 3.5) continue;
      const ex2 = r[0], ez2 = r[1], L = r[2], h = (b.sd - .5) * .5 * L, n = Math.max(3, Math.ceil(L / 3));
      // 先垂直牆面走出 2～4 m，再彎過去（二次曲線的控制點往旁邊偏 h）
      const sx = best.x + best.nx * Math.min(4, L * .25), sz = best.z + best.nz * Math.min(4, L * .25), cx = (sx + ex2) / 2 - (ez2 - sz) / L * h, cz = (sz + ez2) / 2 + (ex2 - sx) / L * h;
      const curve = bend => { const Q = [[best.x, best.z]]; for (let t = 0; t <= n; t++) { const u = t / n, w = bend ? 1 : 0, qx = bend ? cx : (sx + ex2) / 2, qz = bend ? cz : (sz + ez2) / 2; Q.push([(1 - u) ** 2 * sx + 2 * u * (1 - u) * qx + u * u * ex2, (1 - u) ** 2 * sz + 2 * u * (1 - u) * qz + u * u * ez2]); } return Q; };
      let Q = curve(true); if (Q.some(([x, z]) => hit(x, z, b))) Q = curve(false); if (Q.some(([x, z]) => hit(x, z, b))) continue;
      NBR.roadLay(Q);
    }
  }
  if (NBR.roadDone) NBR.roadDone();
  const far = new Map();
  for (const [key, k] of RF) if (k.pos.length) { const m = new T.Mesh(k.build(), MAT.ux); m.name = 'nbrRoofFar'; cityAdd(m, null); far.set(key, m); }
  const facMesh = (B2, name) => {   // 同 10-city.js 的 chunkMesh（不進 cityChunks 與 distCull，遠了照霧剔掉）
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(B2.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(B2.n, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(B2.uv, 2));
    g.setAttribute('aB', new T.Float32BufferAttribute(B2.b, 4)); g.setAttribute('aB2', new T.Float32BufferAttribute(B2.b2, 4)); g.setIndex(B2.idx); g.computeBoundingSphere();
    const m = new T.Mesh(g, MAT_FACADE); m.matrixAutoUpdate = false; m.userData.noTess = 1; m.name = name; cityAdd(m, null); return m;
  };
  for (const e of FB.values()) { e.far = facMesh(e.B, 'nbrFacade'); st.fv = (st.fv || 0) + e.B.p.length / 3; e.B = null; }
  // 立面細模：鏡頭 SET.fac 公尺內（同城裡的 facLod）那一格換成窗洞挖進牆裡的版本、遠景那片藏起來；走遠 40 m 再丟掉。一次最多花 4 ms 建（近的先建）
  const facCells = [...FB.values()];
  const facNear = (x, z, budget = 4) => {
    const R = SET.fac * Math.min(1.2, detailK()), t0 = performance.now();
    for (const e of facCells) {
      e.d = Math.hypot(Math.max(e.x0 - x, x - e.x0 - FC, 0), Math.max(e.z0 - z, z - e.z0 - FC, 0));
      if (e.det && (e.d > R + 40 || !R)) { e.det.removeFromParent(); e.det.geometry.dispose(); e.det = null; e.far.visible = true; }
    }
    for (;;) {
      let want = null; for (const e of facCells) if (!e.det && R && e.d < R && (!want || e.d < want.d)) want = e;
      if (!want || performance.now() - t0 > budget) break;
      const B2 = fbuf(); for (const f of want.list) f(B2, true);
      want.det = facMesh(B2, 'nbrFacadeDet'); want.far.visible = false; st.det = (st.det || 0) + 1;
    }
  };
  NBR.facSync = () => { const [x, z] = nbrL(camera.position.x, camera.position.z); facNear(x, z, 1e9); return facCells.filter(e => e.det).length; };
  // 近處的斜屋頂：照 20-roof.js 的雙坡（沿坡的瓦片方塊、出簷、屋脊蓋、三角山牆、沿坡與山牆底的封簷板），加一支紅磚煙囪；
  // 那一塊的遠景屋頂（兩片坡＋山牆三角）跟著藏起來
  function roofs(list) {
    const k = new Kit();
    for (const R of list) {
      const { Pp, RY, hw, hd, H, y0 } = R, box = (a, y, b2, sa, sy, sb, col, mat, rz = 0) => k.box(...Pp(a, y, b2), sa, sy, sb, col, mat, 0, RY, rz);
      const oh = .35, D = hd * 2 + 2 * oh, th = Math.atan2(H, hw), sl = Math.hypot(hw, H), t = .16, ex = .3, rmat = R.slate ? TX.slate : TX.tile, rcol = R.slate ? 0x3b3e45 : 0x9a4a2e;
      const wall = R.stl === 0 ? 0x6e3226 : R.stl === 1 ? 0x6b4d38 : 0x8c8578, wtx = R.stl <= 1 ? TX.brick : TX.conc, trim = 0x8a8070, trimM = TX.stone;
      for (const s2 of [-1, 1]) {
        const L2 = sl + ex / Math.cos(th) + .06, ma = s2 * (hw + ex) / 2 - s2 * .03, my = y0 + H / 2 - ex * Math.tan(th) / 2;
        box(ma + s2 * Math.sin(th) * t / 2, my + Math.cos(th) * t / 2, 0, L2, t, D, rcol, rmat, -s2 * th);
        box(s2 * (hw + ex - .02), y0 - ex * Math.tan(th) - .1, 0, .05, .24, D, trim, trimM);
      }
      box(0, y0 + H + t * .7, 0, .34, .16, D + .04, 0x2c2f34, rmat);
      for (const e of [-1, 1]) {
        k.prism(...Pp(0, y0 - .05, e * (hd - .15)), [[-hw, 0], [hw, 0], [0, H + .05]], .3, wall, wtx, 0, RY);
        for (const s2 of [-1, 1]) k.bar(...Pp(s2 * (hw + .04), y0 - .12, e * (hd + oh - .03)), ...Pp(0, y0 + H + .1, e * (hd + oh - .03)), .07, .26, trim, trimM);
        box(0, y0 - .02, e * (hd + .06), hw * 2 + .1, .16, .14, trim, trimM);
      }
      if (hd > 3.5) { const ca = (R.sd - .5) * hd; box(hw * .45, y0 + H * .7 + .7, ca, .55, H * .6 + 1.2, .55, 0x7a4636, TX.brick); }
    }
    if (!k.pos.length) return null;
    const m = new T.Mesh(k.build(), MAT.ux); m.name = 'nbrRoofs'; cityAdd(m, null); return m;
  }
  const NEAR_IN = 900, NEAR_OUT = 1100, live = new Map();
  NBR_TICK.push((x, z, chunks) => {
    facNear(x, z);
    for (const S2 of STANDS) { const on = Math.hypot(S2.x - x, S2.z - z) - S2.r < 450; for (const m of S2.near) m.visible = on; if (S2.far) S2.far.visible = !on; }
    let once = false;
    for (const ch of chunks) {
      const key = Math.round(ch.i0 / NBR_CH) + ',' + Math.round(ch.j0 / NBR_CH), list = NR.get(key); if (!list) continue;
      const d = Math.hypot(Math.max(ch.x0 - x, x - ch.x0 - S, 0), Math.max(ch.z0 - z, z - ch.z0 - S, 0));
      if (!live.has(key) && d < NEAR_IN && !once) { live.set(key, roofs(list)); once = true; st.nearBuilt = (st.nearBuilt || 0) + 1; }
      else if (live.has(key) && d > NEAR_OUT) { const m = live.get(key); if (m) { m.removeFromParent(); m.geometry.dispose(); } live.delete(key); }
      const fm = far.get(key); if (fm) fm.visible = !live.get(key);
    }
  });

  NBR.bld = st;   // 驗收：__nc.nbr.bld()
}
