// 幾何工具：同一份頂點同時給畫面網格與 Rapier 三角網格。不碰 DOM。
// 剖面掃掠（跳台、U 形牆、騎牆、曲牆）與環形軌道（大迴圈）。

export class MeshBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.idx = []; }
  get count() { return this.pos.length / 3; }
  vert(x, y, z, nx, ny, nz, u, v) {
    this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.uv.push(u, v);
    return this.pos.length / 3 - 1;
  }
  // 依頂點法線決定繞序，三角形一律朝法線那一側
  tri(a, b, c) {
    const p = this.pos, n = this.nor;
    const ax = p[a * 3], ay = p[a * 3 + 1], az = p[a * 3 + 2];
    const ux = p[b * 3] - ax, uy = p[b * 3 + 1] - ay, uz = p[b * 3 + 2] - az;
    const vx = p[c * 3] - ax, vy = p[c * 3 + 1] - ay, vz = p[c * 3 + 2] - az;
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * cx + cy * cy + cz * cz < 1e-12) return;
    const nx = n[a * 3] + n[b * 3] + n[c * 3], ny = n[a * 3 + 1] + n[b * 3 + 1] + n[c * 3 + 1], nz = n[a * 3 + 2] + n[b * 3 + 2] + n[c * 3 + 2];
    if (cx * nx + cy * ny + cz * nz >= 0) this.idx.push(a, b, c); else this.idx.push(a, c, b);
  }
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }
  out() {
    return { positions: new Float32Array(this.pos), normals: new Float32Array(this.nor), uvs: new Float32Array(this.uv), indices: new Uint32Array(this.idx) };
  }
}

// 擺放框架：原點 (x, y, z)、朝向 yaw（車頭 +Z 轉向 +X 的角度）。本地 s 是前方、l 是左方、h 是上方
export function frame(x, z, yaw, y = 0) {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  return {
    x, y, z, yaw,
    p(s, l, h) { return [x + fx * s + fz * l, y + h, z + fz * s - fx * l]; },
    d(s, l, h) { return [fx * s + fz * l, h, fz * s - fx * l]; },
  };
}

function norm2(a, b) { const l = Math.hypot(a, b) || 1; return [a / l, b / l]; }

// 剖面掃掠：profile 是 [s, h] 的折線（s 單調不減），沿左右方向擠出寬 width。
// 回傳頂面（可開）與側面兩份網格，以及霓虹邊線（兩側頂緣、最後的唇邊）
export function sweepRamp(F, profile, width, { top = new MeshBuilder(), side = new MeshBuilder(), cols = 2 } = {}) {
  const hw = width / 2;
  const n = profile.length;
  // 每個剖面點的法線（相鄰兩段切線平均）
  const nrm = profile.map((_, i) => {
    const a = profile[Math.max(0, i - 1)], b = profile[Math.min(n - 1, i + 1)];
    const [ts, th] = norm2(b[0] - a[0], b[1] - a[1]);
    return [-th, ts];
  });
  let v = 0;
  const vs = [0];
  for (let i = 1; i < n; i++) { v += Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]); vs.push(v); }
  const grid = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let c = 0; c <= cols; c++) {
      const l = -hw + width * c / cols;
      const [x, y, z] = F.p(profile[i][0], l, profile[i][1]);
      const [nx, ny, nz] = F.d(nrm[i][0], 0, nrm[i][1]);
      row.push(top.vert(x, y, z, nx, ny, nz, l + hw, vs[i]));
    }
    grid.push(row);
  }
  for (let i = 0; i < n - 1; i++) for (let c = 0; c < cols; c++) top.quad(grid[i][c], grid[i + 1][c], grid[i + 1][c + 1], grid[i][c + 1]);
  // 兩側：剖面下方到地面的面積
  for (const sgn of [1, -1]) {
    const l = hw * sgn;
    const [nx, ny, nz] = F.d(0, sgn, 0);
    for (let i = 0; i < n - 1; i++) {
      const [s0, h0] = profile[i], [s1, h1] = profile[i + 1];
      const a = side.vert(...F.p(s0, l, 0), nx, ny, nz, s0, 0), b = side.vert(...F.p(s1, l, 0), nx, ny, nz, s1, 0);
      const c = side.vert(...F.p(s1, l, h1), nx, ny, nz, s1, h1), d = side.vert(...F.p(s0, l, h0), nx, ny, nz, s0, h0);
      side.quad(a, b, c, d);
    }
  }
  // 前後立面。最後一段是垂直面時，背面往後退一個牆厚（不然和垂直面重疊會 z-fighting），補上頂蓋與兩側
  for (const [i, dir] of [[0, -1], [n - 1, 1]]) {
    let [s, h] = profile[i];
    if (h < 0.01) continue;
    const vert = dir > 0 && n > 1 && Math.abs(profile[n - 2][0] - s) < 1e-3;
    if (vert) {
      const t = 0.8, s1 = s + t;
      const [ux, uy, uz] = F.d(0, 0, 1);
      side.quad(side.vert(...F.p(s, -hw, h), ux, uy, uz, 0, 0), side.vert(...F.p(s, hw, h), ux, uy, uz, width, 0),
        side.vert(...F.p(s1, hw, h), ux, uy, uz, width, t), side.vert(...F.p(s1, -hw, h), ux, uy, uz, 0, t));
      for (const sgn of [1, -1]) {
        const [nx, ny, nz] = F.d(0, sgn, 0), l = hw * sgn;
        const q = [side.vert(...F.p(s, l, 0), nx, ny, nz, s, 0), side.vert(...F.p(s1, l, 0), nx, ny, nz, s1, 0),
          side.vert(...F.p(s1, l, h), nx, ny, nz, s1, h), side.vert(...F.p(s, l, h), nx, ny, nz, s, h)];
        if (sgn > 0) side.quad(...q); else side.quad(q[3], q[2], q[1], q[0]);
      }
      s = s1;
    }
    const [nx, ny, nz] = F.d(dir, 0, 0);
    const a = side.vert(...F.p(s, -hw, 0), nx, ny, nz, 0, 0), b = side.vert(...F.p(s, hw, 0), nx, ny, nz, width, 0);
    const c = side.vert(...F.p(s, hw, h), nx, ny, nz, width, h), d = side.vert(...F.p(s, -hw, h), nx, ny, nz, 0, h);
    side.quad(a, b, c, d);
  }
  const edges = [
    profile.map(([s, h]) => F.p(s, hw, h)),
    profile.map(([s, h]) => F.p(s, -hw, h)),
  ];
  const last = profile[n - 1];
  if (last[1] > 0.5) edges.push([F.p(last[0], -hw, last[1]), F.p(last[0], hw, last[1])]);
  return { top, side, edges };
}

// 橫剖面掃掠（U 形牆、騎牆）：profile 是 [l, h]（左右位置、高度），沿前方擠出 length。
// 實心部分在剖面外側，外緣到 l = ±outer
export function sweepChannel(F, profile, length, outer, { top = new MeshBuilder(), side = new MeshBuilder(), rows = 8 } = {}) {
  const n = profile.length;
  const nrm = profile.map((_, i) => {
    const a = profile[Math.max(0, i - 1)], b = profile[Math.min(n - 1, i + 1)];
    const [tl, th] = norm2(b[0] - a[0], b[1] - a[1]);
    // 朝通道內（上方）的法線
    let nl = -th, nh = tl;
    if (nh < 0 || (Math.abs(nh) < 1e-6 && nl * (a[0] + b[0]) > 0)) { nl = -nl; nh = -nh; }
    return [nl, nh];
  });
  let v = 0;
  const vs = [0];
  for (let i = 1; i < n; i++) { v += Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]); vs.push(v); }
  const grid = [];
  for (let r = 0; r <= rows; r++) {
    const s = length * r / rows;
    grid.push(profile.map(([l, h], i) => {
      const [x, y, z] = F.p(s, l, h);
      const [nx, ny, nz] = F.d(0, nrm[i][0], nrm[i][1]);
      return top.vert(x, y, z, nx, ny, nz, vs[i], s);
    }));
  }
  for (let r = 0; r < rows; r++) for (let i = 0; i < n - 1; i++) top.quad(grid[r][i], grid[r + 1][i], grid[r + 1][i + 1], grid[r][i + 1]);
  // 兩端的封面：剖面點水平投到外緣
  for (const [s, dir] of [[0, -1], [length, 1]]) {
    const [nx, ny, nz] = F.d(dir, 0, 0);
    for (let i = 0; i < n - 1; i++) {
      const [l0, h0] = profile[i], [l1, h1] = profile[i + 1];
      if (h0 < 0.01 && h1 < 0.01) continue;
      const o0 = Math.sign(l0 || l1) * outer, o1 = Math.sign(l1 || l0) * outer;
      const a = side.vert(...F.p(s, l0, h0), nx, ny, nz, l0, h0), b = side.vert(...F.p(s, l1, h1), nx, ny, nz, l1, h1);
      const c = side.vert(...F.p(s, o1, h1), nx, ny, nz, o1, h1), d = side.vert(...F.p(s, o0, h0), nx, ny, nz, o0, h0);
      side.quad(a, b, c, d);
    }
  }
  // 外牆與牆頂
  const ends = [profile[0], profile[n - 1]];
  for (const [l, h] of ends) {
    if (h < 0.5) continue;
    const sg = Math.sign(l);
    const o = sg * outer;
    {
      const [nx, ny, nz] = F.d(0, sg, 0);
      const a = side.vert(...F.p(0, o, 0), nx, ny, nz, 0, 0), b = side.vert(...F.p(length, o, 0), nx, ny, nz, length, 0);
      const c = side.vert(...F.p(length, o, h), nx, ny, nz, length, h), d = side.vert(...F.p(0, o, h), nx, ny, nz, 0, h);
      side.quad(a, b, c, d);
    }
    {
      const [nx, ny, nz] = F.d(0, 0, 1);
      const a = side.vert(...F.p(0, l, h), nx, ny, nz, 0, 0), b = side.vert(...F.p(length, l, h), nx, ny, nz, length, 0);
      const c = side.vert(...F.p(length, o, h), nx, ny, nz, length, 1), d = side.vert(...F.p(0, o, h), nx, ny, nz, 0, 1);
      side.quad(a, b, c, d);
    }
  }
  const edges = [];
  for (const [l, h] of ends) if (h > 0.5) edges.push([F.p(0, l, h), F.p(length, l, h)]);
  for (const s of [0, length]) edges.push(profile.map(([l, h]) => F.p(s, l, h)));
  return { top, side, edges };
}

// 大迴圈：寬 width 的帶子繞半徑 R 的鉛直圓一圈，同時往右側平移 shift（出口錯開入口）。
// 內面可開、外面也有碰撞；入口與出口各接一段坡度漸變的引道
export function loopTrack(F, R, width, shift, { top = new MeshBuilder(), side = new MeshBuilder(), seg = 72, thick = 0.8 } = {}) {
  const hw = width / 2;
  const ease = (t) => t * t * (3 - 2 * t);
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, a = t * Math.PI * 2;
    const l = -shift * ease(t);
    // 圓心在 (s=0, h=R)；起點在正下方
    pts.push({ s: R * Math.sin(a), h: R - R * Math.cos(a), l, ns: -Math.sin(a), nh: Math.cos(a), t });
  }
  const inner = [], outerRow = [];
  for (const p of pts) {
    const rowI = [], rowO = [];
    for (const c of [-1, 1]) {
      const [nx, ny, nz] = F.d(p.ns, 0, p.nh);
      rowI.push(top.vert(...F.p(p.s, p.l + c * hw, p.h), nx, ny, nz, c * hw + hw, p.t * Math.PI * 2 * R));
      const os = p.s - p.ns * thick, oh = p.h - p.nh * thick;
      rowO.push(side.vert(...F.p(os, p.l + c * hw, oh), -nx, -ny, -nz, c * hw + hw, p.t * Math.PI * 2 * R));
    }
    inner.push(rowI); outerRow.push(rowO);
  }
  for (let i = 0; i < seg; i++) {
    top.quad(inner[i][0], inner[i + 1][0], inner[i + 1][1], inner[i][1]);
    // 起點與終點附近的外殼埋在地下，不需要
    if (pts[i].h > 1 || pts[i + 1].h > 1) side.quad(outerRow[i][0], outerRow[i + 1][0], outerRow[i + 1][1], outerRow[i][1]);
  }
  // 兩側邊條
  for (const c of [0, 1]) {
    const sg = c ? 1 : -1;
    for (let i = 0; i < seg; i++) {
      const p = pts[i], q = pts[i + 1];
      if (p.h < 0.3 && q.h < 0.3) continue;
      const [nx, ny, nz] = F.d(0, sg, 0);
      const a = side.vert(...F.p(p.s, p.l + sg * hw, p.h), nx, ny, nz, 0, 0), b = side.vert(...F.p(q.s, q.l + sg * hw, q.h), nx, ny, nz, 1, 0);
      const d = side.vert(...F.p(p.s - p.ns * thick, p.l + sg * hw, p.h - p.nh * thick), nx, ny, nz, 0, 1);
      const e = side.vert(...F.p(q.s - q.ns * thick, q.l + sg * hw, q.h - q.nh * thick), nx, ny, nz, 1, 1);
      side.quad(a, b, e, d);
    }
  }
  const edges = [
    pts.filter((p) => p.h > 0.05 || p.t > 0.02 && p.t < 0.98).map((p) => F.p(p.s, p.l + hw, p.h)),
    pts.filter((p) => p.h > 0.05 || p.t > 0.02 && p.t < 0.98).map((p) => F.p(p.s, p.l - hw, p.h)),
  ];
  return { top, side, edges };
}

// 圓弧剖面：從角度 a0 到 a1，半徑 R，起點 (s0, h0)，切線從水平往上轉
export function arcProfile(R, a0, a1, s0 = 0, h0 = 0, steps = 16) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * i / steps;
    out.push([s0 + R * (Math.sin(a) - Math.sin(a0)), h0 + R * (Math.cos(a0) - Math.cos(a))]);
  }
  return out;
}

export function mergeMeshes(list) {
  let nv = 0, ni = 0;
  for (const m of list) { nv += m.positions.length; ni += m.indices.length; }
  const pos = new Float32Array(nv), nor = new Float32Array(nv), uv = new Float32Array(nv / 3 * 2), idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const m of list) {
    pos.set(m.positions, ov); nor.set(m.normals, ov); uv.set(m.uvs, ov / 3 * 2);
    const base = ov / 3;
    for (let i = 0; i < m.indices.length; i++) idx[oi + i] = m.indices[i] + base;
    ov += m.positions.length; oi += m.indices.length;
  }
  return { positions: pos, normals: nor, uvs: uv, indices: idx };
}
