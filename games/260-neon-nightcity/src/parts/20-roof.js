// ═══ 斜屋頂的畫面：19-roofs.js 選好的地塊蓋上雙坡（山牆朝街）、四坡與復折式屋頂 ═══
// 地塊的局部框：a 沿街（寬，中線為 0）、b 沿深（中線為 0，正負兩端是正面與背面）、y 往上；邏輯座標 x、z 由 P() 換過去，
// 方塊零件的 ry 跟著轉（axis 'x' 的地塊轉 90°）。每個街區合併成一個網格（和 20-relief 一樣，distCull 隱藏遠處）。
// 照片參考：海濱灰泥小樓的筒瓦雙坡與圓窗山牆、工廠的立邊鋼板與採光帶、紐約褐石公寓的石板瓦復折式屋頂與老虎窗。
// 側面：隔壁一樣高或更高時屋簷不出挑（排屋的屋頂貼著），隔壁比較矮才出簷、蓋封簷板。
{
  const wallHex = L => L.style === 0 ? 0x6e3226 : L.style === 1 ? 0x6b4d38 : L.style === 2 ? 0x8c8578 : L.style === 5 ? 0x1e1c1e
    : L.style === 4 ? (((L.seed * 7) % 1) < .5 ? 0x5c7f7f : 0x8c6670) : 0x733324;
  const wallTx = L => (L.style === 0 || L.style === 1 || L.style === 6 ? TX.brick : TX.conc);
  const byBlock = new Map();
  for (const L of lots) { const k = L.b || L.zn; if (!byBlock.has(k)) byBlock.set(k, []); byBlock.get(k).push(L); }
  // 側面 s（-1／1：a 的負向／正向）外面緊貼的地塊有多高
  const sideH = (L, s) => {
    let h = 0;
    for (const N of byBlock.get(L.b || L.zn) || []) {
      if (N === L) continue;
      const hit = L.axis === 'z' ? Math.abs((s > 0 ? N.x0 - L.x1 : N.x1 - L.x0)) < .05 && N.z0 < L.z1 - .5 && N.z1 > L.z0 + .5
        : Math.abs((s > 0 ? N.z1 - L.z0 : N.z0 - L.z1)) < .05 && N.x0 < L.x1 - .5 && N.x1 > L.x0 + .5;
      if (hit) h = Math.max(h, N.glb ? 1e3 : N.h + (N.rk ? N.rk.H : 0));
    }
    return h;
  };
  const kits = new Map(), kitOf = L => { const key = L.b ? L.b.i + ',' + L.b.j : 'z' + (L.zn ? L.zn.id : '-'); if (!kits.has(key)) kits.set(key, { k: new Kit(), zn: L.zn }); return kits.get(key).k; };
  const _a = V3(), _b = V3(), _c = V3(), _n = V3();
  for (const L of lots) roofKind(L);   // 先全部決定（sideH 要看隔壁有沒有斜屋頂）
  for (const L of lots) {
    const R = roofKind(L); if (!R) continue;
    const k = kitOf(L), cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, zA = L.axis === 'z';
    // axis 'x'：a 沿 -z、b 沿 +x（轉 90°，左右手不變）
    const P = (a, y, b) => (zA ? [cx + a, y, cz + b] : [cx + b, y, cz - a]);
    const RY = zA ? 0 : Math.PI / 2;
    const box = (a, y, b, sa, sy, sb, col, mat, rz = 0, rx = 0) => k.box(...P(a, y, b), sa, sy, sb, col, mat, rx, RY, rz);
    // 平面多邊形（局部框的點，凸的），朝 out（局部框的方向）那一面
    const poly = (pts, out, col, mat) => {
      pts = pts.filter((p, i) => { const o = pts[(i + 1) % pts.length]; return Math.abs(p[0] - o[0]) + Math.abs(p[1] - o[1]) + Math.abs(p[2] - o[2]) > 1e-4; });   // 重複的點（屋脊長 0）拿掉
      if (pts.length < 3) return;
      const q = pts.map(p => P(...p)), pos = [];
      for (let i = 1; i + 1 < q.length; i++) pos.push(...q[0], ...q[i], ...q[i + 1]);
      _a.fromArray(q[0]); _b.fromArray(q[1]).sub(_a); _c.fromArray(q[2]).sub(_a); _n.crossVectors(_b, _c);
      const o = P(...out); o[0] -= cx; o[2] -= cz;   // 方向只轉不平移
      if (_n.x * o[0] + _n.y * o[1] + _n.z * o[2] < 0) for (let i = 0; i < pos.length; i += 9) for (let j = 0; j < 3; j++) { const t = pos[i + 3 + j]; pos[i + 3 + j] = pos[i + 6 + j]; pos[i + 6 + j] = t; }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      k.add(g, col, mat);
    };
    const hw = R.w / 2, hd = R.dp / 2, y0 = R.y0, H = R.H, wall = wallHex(L), wtx = wallTx(L);
    const beach = R.mat === TX.tile, works = R.mat === TX.seam;
    const trim = beach ? 0xd8d0c0 : works ? 0x3a3e42 : 0x8a8070, trimM = beach ? TX.conc : works ? TX.galv : TX.stone;
    const free = [sideH(L, -1) < L.h - .3, sideH(L, 1) < L.h - .3];
    const t = .16;
    if (R.kind === 'gable') {
      const oh = R.oh, D = R.dp + 2 * oh, th = Math.atan2(H, hw), sl = Math.hypot(hw, H);
      // 兩片坡：方塊沿坡轉 θ，底面貼著坡線；側面隔壁矮就往外出簷 0.3 m（坡順著延長）
      for (const s of [-1, 1]) {
        const ex = free[s > 0 ? 1 : 0] ? .3 : 0, L2 = sl + ex / Math.cos(th) + .06;
        const ma = s * (hw + ex) / 2 - s * .03, my = y0 + H / 2 - ex * Math.tan(th) / 2;
        box(ma + s * Math.sin(th) * t / 2, my + Math.cos(th) * t / 2, 0, L2, t, D, R.col, R.mat, -s * th);
        if (ex) box(s * (hw + ex - .02), y0 - ex * Math.tan(th) - .1, 0, .05, .24, D, trim, trimM);   // 封簷板
      }
      box(0, y0 + H + t * .7, 0, .34, .16, D + .04, works ? 0x4a4e52 : beach ? 0x8a4028 : 0x2c2f34, R.mat);   // 屋脊蓋
      // 山牆：正面與背面的三角牆（牆厚 0.3，外面和立面齊平）、沿坡的封簷板、底下一道線腳、山牆中間的圓窗（工廠是百葉通風口）
      for (const e of [-1, 1]) {
        const bw = e * (hd - .15);
        k.prism(...P(0, y0 - .05, bw), [[-hw, 0], [hw, 0], [0, H + .05]], .3, wall, wtx, 0, RY);
        for (const s of [-1, 1]) k.bar(...P(s * (hw + .04), y0 - .12, e * (hd + oh - .03)), ...P(0, y0 + H + .1, e * (hd + oh - .03)), .07, .26, trim, trimM);
        box(0, y0 - .02, e * (hd + .06), R.w + .1, .16, .14, trim, trimM);
        const wy = y0 + H * .4, wr = Math.min(.55, H * .17, hw * .3);
        if (works) {
          box(0, wy, e * (hd + .02), wr * 2.6, wr * 1.8, .08, 0x2e3236, TX.galv);
          for (let i = 0; i < 5; i++) box(0, wy - wr * .7 + i * wr * .35, e * (hd + .06), wr * 2.4, .05, .06, 0x4a5056, TX.galv, 0, e * .6);
        } else if (wr > .25) {
          k.torus(...P(0, wy, e * (hd + .03)), wr, .07, 20, trim, trimM, 0, RY);
          k.cyl(...P(0, wy, e * (hd - .02)), wr - .03, wr - .03, .06, 20, 0x1a1e24, 0, Math.PI / 2, RY);   // 玻璃（m 0：反射天空）
          box(0, wy, e * (hd + .03), wr * 2 - .1, .045, .05, trim, trimM); box(0, wy, e * (hd + .03), .045, wr * 2 - .1, .05, trim, trimM);   // 十字窗櫺
        }
      }
      // 工廠：兩側坡上各一條採光帶
      if (works) for (const s of [-1, 1]) {
        const u = .55, a = s * hw * (1 - u), y = y0 + H * u + Math.cos(th) * (t + .02);
        box(a, y, 0, 1.4, .04, R.dp * .7, 0x9aa6ac, 10, -s * th);
      }
    } else if (R.kind === 'hip') {
      // 四坡：前後出簷 oh；側面隔壁矮才出簷（ea），一樣高的側面只出 2 cm（排屋貼著）。四片坡同一個斜率 s，
      // 側面出簷比前後少時，斜脊落在側面簷線上往內 d 的地方（兩片坡在那裡等高），不會有裂縫
      const oh = R.oh, s = H / hw, ea = [free[0] ? oh : .02, free[1] ? oh : .02], dd = [oh - ea[0], oh - ea[1]];
      const A0 = -hw - ea[0], A1 = hw + ea[1], B0 = -hd - oh, B1 = hd + oh, yf = y0 - oh * s, ys = [y0 - ea[0] * s, y0 - ea[1] * s];
      const along = hd >= hw, rl = along ? hd - hw : 0, ra = along ? 0 : hw - hd, yt = y0 + (along ? H : hd * s);
      poly([[A0, ys[0], B0 + dd[0]], [A0, ys[0], B1 - dd[0]], [-ra, yt, rl], [-ra, yt, -rl]], [-1, 1, 0], R.col, R.mat);
      poly([[A1, ys[1], B0 + dd[1]], [A1, ys[1], B1 - dd[1]], [ra, yt, rl], [ra, yt, -rl]], [1, 1, 0], R.col, R.mat);
      for (const e of [-1, 1]) {
        const bE = e < 0 ? B0 : B1, bD = d => e < 0 ? B0 + d : B1 - d, bR = e * rl;
        poly([[A0, yf, bE], [A1, yf, bE], [A1, ys[1], bD(dd[1])], [ra, yt, bR], [-ra, yt, bR], [A0, ys[0], bD(dd[0])]], [0, 1, e], R.col, R.mat);
      }
      // 屋脊與四條斜脊的蓋瓦
      const ridgeC = beach ? 0x8a4028 : 0x2c2f34;
      if (along && rl > .05) k.bar(...P(0, yt + .06, -rl), ...P(0, yt + .06, rl), .26, .14, ridgeC, R.mat);
      else if (!along && ra > .05) k.bar(...P(-ra, yt + .06, 0), ...P(ra, yt + .06, 0), .26, .14, ridgeC, R.mat);
      for (const [si, e] of [[0, -1], [1, -1], [0, 1], [1, 1]]) {
        const a = si ? A1 : A0, b = e < 0 ? B0 + dd[si] : B1 - dd[si];
        k.bar(...P(a, ys[si] + .05, b), ...P(si ? ra : -ra, yt + .05, e * rl), .2, .12, ridgeC, R.mat);
      }
      // 封簷板與出簷底下的平頂
      for (const e of [-1, 1]) {
        box((A0 + A1) / 2, yf - .1, e * (hd + oh - .02), A1 - A0, .24, .05, trim, trimM);
        box((A0 + A1) / 2, yf - .2, e * (hd + oh / 2), A1 - A0, .04, oh, trim, trimM);
      }
      for (const si of [0, 1]) if (free[si]) {
        const sg = si ? 1 : -1;
        box(sg * (hw + oh - .02), ys[si] - .1, 0, .05, .24, R.dp, trim, trimM);
        box(sg * (hw + oh / 2), ys[si] - .2, 0, oh, .04, R.dp, trim, trimM);
      }
    } else {
      // 復折式：下段陡坡（往內 1.2 m、高 3 m），側面隔壁一樣高時是直牆（排屋）；頂上平台、壓頂；正面與背面每一列窗一個老虎窗
      const ins = 1.2, out = R.oh, yt = y0 + H;
      const ia = [free[0] ? ins : 0, free[1] ? ins : 0], oa = [free[0] ? out : 0, free[1] ? out : 0];
      const A0 = -hw - oa[0], A1 = hw + oa[1], B0 = -hd - out, B1 = hd + out;
      const T0 = -hw + ia[0], T1 = hw - ia[1], U0 = -hd + ins, U1 = hd - ins;
      poly([[A0, y0, B0], [A1, y0, B0], [T1, yt, U0], [T0, yt, U0]], [0, .3, -1], R.col, R.mat);
      poly([[A0, y0, B1], [A1, y0, B1], [T1, yt, U1], [T0, yt, U1]], [0, .3, 1], R.col, R.mat);
      for (const [s2, sg] of [[0, -1], [1, 1]]) {
        const a0 = s2 ? A1 : A0, a1 = s2 ? T1 : T0;
        poly([[a0, y0, B0], [a0, y0, B1], [a1, yt, U1], [a1, yt, U0]], [sg, .3, 0], free[s2] ? R.col : wall, free[s2] ? R.mat : wtx);
      }
      poly([[T0, yt, U0], [T1, yt, U0], [T1, yt, U1], [T0, yt, U1]], [0, 1, 0], 0x2a2a2c, TX.conc);
      // 底下的簷口線腳（凸出 0.3 m，上下兩層）與頂上的壓頂、鑄鐵欄的頂飾
      for (const e of [-1, 1]) {
        box((A0 + A1) / 2, y0 - .08, e * (hd + out / 2), A1 - A0 + .1, .2, out + .12, trim, trimM);
        box((A0 + A1) / 2, y0 - .26, e * (hd + .06), A1 - A0, .14, .14, trim, trimM);
        box((T0 + T1) / 2, yt + .05, e * (e > 0 ? U1 : -U0), T1 - T0 + .1, .1, .16, trim, trimM);
        for (let a = T0 + .3; a < T1 - .2; a += .5) box(a, yt + .32, e * (e > 0 ? U1 : -U0), .03, .45, .03, 0x1c1c1e, TX.iron);
        box((T0 + T1) / 2, yt + .55, e * (e > 0 ? U1 : -U0), T1 - T0, .04, .04, 0x1c1c1e, TX.iron);
      }
      // 老虎窗：和立面的窗同一個格（20-relief 的 ws、cols、mg），窗框白色、上面一個小山花
      const ws = L.style === 2 ? 2.2 : 2.5, cols = Math.max(1, Math.floor((R.w - 1) / ws)), mg = (R.w - cols * ws) / 2;
      const dw = Math.min(1.35, ws * .56), dh = 1.6, dy = y0 + .45, slope = (ins + out) / H;
      for (const e of [-1, 1]) for (let ci = 0; ci < cols; ci++) {
        if (cols > 3 && ci % 2) continue;
        const a = -hw + mg + (ci + .5) * ws;
        if (a - dw / 2 < T0 + .1 || a + dw / 2 > T1 - .1) continue;
        const fb = e * (hd + out - (dy - y0) * slope - .02);   // 老虎窗正面：落在陡坡上窗底那一點，往上整個凸出坡面
        const depth = 1.3, cb = fb - e * depth / 2;
        box(a, dy + dh / 2, cb, dw + .2, dh, depth, wall === 0x1e1c1e ? 0x3a3a3c : trim, trimM);   // 側板與正面（窗洞另外蓋）
        box(a, dy + dh * .46, fb + e * .01, dw - .16, dh * .72, .04, 0x161a20, 0);                // 玻璃
        box(a, dy + dh * .46, fb + e * .03, dw - .16, .05, .04, trim, trimM);                     // 中間的橫框
        box(a, dy + dh * .46, fb + e * .03, .05, dh * .72, .04, trim, trimM);
        box(a, dy + .02, fb + e * .06, dw + .1, .08, .14, trim, trimM);                           // 窗台
        k.prism(...P(a, dy + dh, cb), [[-(dw + .36) / 2, 0], [(dw + .36) / 2, 0], [0, .5]], depth + .1, R.col, R.mat, 0, RY);   // 小山花頂
        box(a, dy + dh + .02, fb + e * .07, dw + .34, .1, .08, trim, trimM);
      }
    }
    // 煙囪：磚砌、上面一圈石壓頂與兩支陶管；斜屋頂靠一側，復折式在平台上
    if (R.chim) {
      const s = roofHash(L, 5) < .5 ? -1 : 1, b = (roofHash(L, 6) - .5) * R.dp * .5;
      const a = R.kind === 'mansard' ? s * (hw - 1.2 - .6) : s * hw * .42;
      const [px, , pz] = zA ? [cx + a, 0, cz + b] : [cx + b, 0, cz - a];
      const base = roofTop(L, px, pz) - (R.kind === 'mansard' ? 0 : .4), top = y0 + H + 1.1;
      const cw = .9, cd = .6;
      box(a, (base + top) / 2, b, cw, top - base, cd, 0x6e3226, TX.brick);
      box(a, top + .06, b, cw + .14, .12, cd + .14, 0x8a8070, TX.stone);
      for (const o of [-.2, .2]) k.cyl(...P(a + o, top + .3, b), .09, .11, .38, 8, 0x8a4a30, 2);
    }
  }
  for (const { k, zn } of kits.values()) { const m = new T.Mesh(k.build(), MAT.ux); cityAdd(m, zn); cullAdd(m); }
}
