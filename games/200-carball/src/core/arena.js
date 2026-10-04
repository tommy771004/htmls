// 球場幾何：同一份參數同時產生畫面網格與物理三角網格，並提供解析的距離場（AI 預測球路、鏡頭不穿牆用）。
// 剖面從地面往上：地面接牆的四分之一圓彎道 → 垂直牆 → 接天花板的彎道。剖面沿圓角矩形繞一圈。
// 兩端球門口的牆從地面挖到球門高，彎道在門柱處截斷，地面平平地延伸進球門。
import { ARENA } from './const.js';

const { A, B, H, RC, R1, R2, GW, GH, GD } = ARENA;
const CX = A - RC, CZ = B - RC;

// 剖面點：w 是離牆面往場內的距離，y 是高度，(nw, ny) 是朝場內的法線
function buildProfile() {
  const pts = [];
  const NR = 16, NC = 14;
  for (let i = 0; i <= NR; i++) {
    const t = (i / NR) * Math.PI / 2;
    pts.push({ w: R1 * (1 - Math.sin(t)), y: R1 * (1 - Math.cos(t)), nw: Math.sin(t), ny: Math.cos(t) });
  }
  const iGH = pts.length;
  const top = H - R2;
  const wallYs = [GH];
  const n = 4;
  for (let i = 1; i <= n; i++) wallYs.push(GH + (top - GH) * i / n);
  for (const y of wallYs) pts.push({ w: 0, y, nw: 1, ny: 0 });
  for (let i = 1; i <= NC; i++) {
    const t = (i / NC) * Math.PI / 2;
    pts.push({ w: R2 * (1 - Math.cos(t)), y: top + R2 * Math.sin(t), nw: Math.cos(t), ny: -Math.sin(t) });
  }
  let v = 0;
  pts[0].v = 0;
  for (let i = 1; i < pts.length; i++) {
    v += Math.hypot(pts[i].w - pts[i - 1].w, pts[i].y - pts[i - 1].y);
    pts[i].v = v;
  }
  return { pts, iGH, iRamp: NR };
}

function range(a, b, step) {
  const n = Math.max(1, Math.ceil(Math.abs(b - a) / step));
  const out = [];
  for (let i = 0; i <= n; i++) out.push(a + (b - a) * i / n);
  return out;
}

// 繞場一圈的站點：P 是圓角中心線上的點，(nx, nz) 是朝外的法線；牆面點 = P + n·(RC - w)
function buildStations() {
  const st = [];
  const push = (px, pz, nx, nz, end) => st.push({ px, pz, nx, nz, end });
  const arc = (cx, cz, a0, a1) => {
    const n = 14;
    for (let i = 1; i < n; i++) {
      const a = a0 + (a1 - a0) * i / n;
      push(cx, cz, Math.cos(a), Math.sin(a), 0);
    }
  };
  const endXs = (dir) => {
    const xs = [...range(-CX, -GW, 2.6), ...range(-GW, GW, 2.4).slice(1), ...range(GW, CX, 2.6).slice(1)];
    return dir > 0 ? xs : xs.reverse();
  };
  for (const x of endXs(1)) push(x, CZ, 0, 1, 1);
  arc(CX, CZ, Math.PI / 2, 0);
  for (const z of range(CZ, -CZ, 2.6)) push(CX, z, 1, 0, 0);
  arc(CX, -CZ, 0, -Math.PI / 2);
  for (const x of endXs(-1)) push(x, -CZ, 0, -1, -1);
  arc(-CX, -CZ, -Math.PI / 2, -Math.PI);
  for (const z of range(-CZ, CZ, 2.6)) push(-CX, z, -1, 0, 0);
  arc(-CX, CZ, Math.PI, Math.PI / 2);
  // 牆面（w = 0）的累計弧長，給貼圖 u
  let u = 0;
  for (let i = 0; i < st.length; i++) {
    const s = st[i], q = st[(i + st.length - 1) % st.length];
    if (i) u += Math.hypot(s.px + s.nx * RC - q.px - q.nx * RC, s.pz + s.nz * RC - q.pz - q.nz * RC);
    s.u = u;
  }
  return st;
}

class MeshBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.idx = []; }
  vert(x, y, z, nx, ny, nz, u, v) {
    this.pos.push(x, y, z); this.nor.push(nx, ny, nz); this.uv.push(u, v);
    return this.pos.length / 3 - 1;
  }
  // 依法線自動決定繞序，三角形一律朝場內
  tri(a, b, c) {
    const p = this.pos, n = this.nor;
    const ax = p[a * 3], ay = p[a * 3 + 1], az = p[a * 3 + 2];
    const ux = p[b * 3] - ax, uy = p[b * 3 + 1] - ay, uz = p[b * 3 + 2] - az;
    const vx = p[c * 3] - ax, vy = p[c * 3 + 1] - ay, vz = p[c * 3 + 2] - az;
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const nx = n[a * 3] + n[b * 3] + n[c * 3], ny = n[a * 3 + 1] + n[b * 3 + 1] + n[c * 3 + 1], nz = n[a * 3 + 2] + n[b * 3 + 2] + n[c * 3 + 2];
    if (cx * cx + cy * cy + cz * cz < 1e-12) return;
    if (cx * nx + cy * ny + cz * nz >= 0) this.idx.push(a, b, c); else this.idx.push(a, c, b);
  }
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }
  out() {
    return { positions: new Float32Array(this.pos), normals: new Float32Array(this.nor), uvs: new Float32Array(this.uv), indices: new Uint32Array(this.idx) };
  }
}

export function buildArenaMesh() {
  const { pts, iGH, iRamp } = buildProfile();
  const st = buildStations();
  const walls = new MeshBuilder();
  const grid = st.map((s) => pts.map((p) => {
    const r = RC - p.w;
    return walls.vert(s.px + s.nx * r, p.y, s.pz + s.nz * r, -s.nx * p.nw, p.ny, -s.nz * p.nw, s.u, p.v);
  }));
  const N = st.length;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, s0 = st[i], s1 = st[j];
    const mx = (s0.px + s1.px) / 2;
    const inGoal = s0.end && s0.end === s1.end && Math.abs(mx) < GW;
    for (let k = inGoal ? iGH : 0; k < pts.length - 1; k++) {
      if (inGoal && k < iGH) continue;
      walls.quad(grid[i][k], grid[j][k], grid[j][k + 1], grid[i][k + 1]);
    }
  }
  // 門柱兩側：彎道被截斷處的封面
  for (const end of [1, -1]) {
    for (const sx of [1, -1]) {
      const x = GW * sx, z = B * end;
      const c = walls.vert(x, 0, z, -sx, 0, 0, 0, 0);
      const arcIdx = [];
      for (let k = 0; k <= iRamp; k++) {
        const p = pts[k];
        arcIdx.push(walls.vert(x, p.y, z - end * p.w, -sx, 0, 0, p.w, p.y));
      }
      for (let k = 0; k < arcIdx.length - 1; k++) walls.tri(c, arcIdx[k], arcIdx[k + 1]);
    }
  }
  // 球門內部：兩側、背板、頂（兩端各一份，畫面要上不同的隊色）
  const goals = [];
  for (const end of [1, -1]) {
    const goal = new MeshBuilder();
    goals.push(goal);
    const z0 = B * end, z1 = (B + GD) * end;
    for (const sx of [1, -1]) {
      const x = GW * sx;
      const a = goal.vert(x, 0, z0, -sx, 0, 0, 0, 0), b = goal.vert(x, 0, z1, -sx, 0, 0, GD, 0);
      const c = goal.vert(x, GH, z1, -sx, 0, 0, GD, GH), d = goal.vert(x, GH, z0, -sx, 0, 0, 0, GH);
      goal.quad(a, b, c, d);
    }
    {
      const a = goal.vert(-GW, 0, z1, 0, 0, -end, 0, 0), b = goal.vert(GW, 0, z1, 0, 0, -end, 2 * GW, 0);
      const c = goal.vert(GW, GH, z1, 0, 0, -end, 2 * GW, GH), d = goal.vert(-GW, GH, z1, 0, 0, -end, 0, GH);
      goal.quad(a, b, c, d);
    }
    {
      const a = goal.vert(-GW, GH, z0, 0, -1, 0, 0, 0), b = goal.vert(GW, GH, z0, 0, -1, 0, 2 * GW, 0);
      const c = goal.vert(GW, GH, z1, 0, -1, 0, 2 * GW, GD), d = goal.vert(-GW, GH, z1, 0, -1, 0, 0, GD);
      goal.quad(a, b, c, d);
    }
  }
  return { walls: walls.out(), goals: goals.map((g) => g.out()), profile: pts, stations: st };
}

// 合併成一份物理三角網格（地面與天花板另外用方塊）
export function physicsTrimesh(mesh) {
  const parts = [mesh.walls, ...mesh.goals];
  let nv = 0, ni = 0;
  for (const p of parts) { nv += p.positions.length; ni += p.indices.length; }
  const v = new Float32Array(nv), ix = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const p of parts) {
    v.set(p.positions, ov);
    const base = ov / 3;
    for (let i = 0; i < p.indices.length; i++) ix[oi + i] = p.indices[i] + base;
    ov += p.positions.length; oi += p.indices.length;
  }
  return { vertices: v, indices: ix };
}

// 場內距離場：正值代表在場內（空氣），值是到最近牆面的距離
export function arenaSDF(x, y, z) {
  const qx = Math.abs(x) - CX, qz = Math.abs(z) - CZ;
  const ox = Math.max(qx, 0), oz = Math.max(qz, 0);
  const rr = RC - (Math.hypot(ox, oz) + Math.min(Math.max(qx, qz), 0));
  let d;
  if (rr < R1 && y < R1) d = R1 - Math.hypot(R1 - rr, R1 - y);
  else if (rr < R2 && H - y < R2) d = R2 - Math.hypot(R2 - rr, R2 - (H - y));
  else d = Math.min(rr, y, H - y);
  // 球門（和場內取聯集）
  const az = Math.abs(z);
  if (az > B - R1 - 2) {
    const g = Math.min(GW - Math.abs(x), y, GH - y, B + GD - az);
    if (g > d) d = g;
  }
  return d;
}

export function arenaNormal(x, y, z, out) {
  const e = 0.02;
  const nx = arenaSDF(x + e, y, z) - arenaSDF(x - e, y, z);
  const ny = arenaSDF(x, y + e, z) - arenaSDF(x, y - e, z);
  const nz = arenaSDF(x, y, z + e) - arenaSDF(x, y, z - e);
  const l = Math.hypot(nx, ny, nz) || 1;
  out.x = nx / l; out.y = ny / l; out.z = nz / l;
  return out;
}
