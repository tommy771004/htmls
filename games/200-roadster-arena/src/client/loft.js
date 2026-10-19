// 放樣車身：沿車長取一串斷面，每個斷面由 6 個控制點（底中心、底角、最寬處、肩線、上緣、頂中心）
// 做 Catmull-Rom 曲線；斷面參數沿車長也用 Catmull-Rom 平滑。輸出半邊格點，另一半鏡射。
import { BufferGeometry, Float32BufferAttribute } from 'three';

function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

// 依 z 內插斷面參數表（stations 依 z 由大到小）
export function sampleStations(stations, z) {
  const n = stations.length;
  let i = 0;
  while (i < n - 2 && z < stations[i + 1].z) i++;
  const a = stations[Math.max(0, i - 1)], b = stations[i], c = stations[i + 1], d = stations[Math.min(n - 1, i + 2)];
  const t = Math.max(0, Math.min(1, (b.z - z) / (b.z - c.z)));
  const out = { z };
  for (const k of Object.keys(b)) if (k !== 'z') out[k] = cr(a[k], b[k], c[k], d[k], t);
  return out;
}

// 斷面半邊的控制點 → 細分點（從底中心往上繞到頂中心）
export const SEG = [4, 5, 6, 6, 6];   // A-B、B-C、C-D、D-F、F-E 每段細分數
export const J = { A: 0, B: 4, C: 9, D: 15, F: 21, E: 27 };
export function sectionPoints(st) {
  const A = [0, st.yb], B = [st.hw - 0.1, st.yb + 0.01], C = [st.hw, st.ys], D = [st.shx, st.ysh];
  const F = [st.fx, st.fy], E = [0, st.yt];
  const P = [[-B[0], B[1]], A, B, C, D, F, E, [-F[0], F[1]]];
  const out = [];
  for (let s = 1; s <= 5; s++) {
    const n = SEG[s - 1];
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push([cr(P[s - 1][0], P[s][0], P[s + 1][0], P[s + 2][0], t), cr(P[s - 1][1], P[s][1], P[s + 1][1], P[s + 2][1], t)]);
    }
  }
  out.push(E.slice());
  return out;
}

// 產生格點：rings × (半邊點數)。回傳 pos[i][j] = [x, y, z]（x ≥ 0 那一半）
export function loftGrid(stations, rings) {
  const z0 = stations[0].z, z1 = stations[stations.length - 1].z;
  const grid = [], params = [];
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1);
    // 兩端加密：車頭車尾曲率大
    const z = z0 + (z1 - z0) * (t * 0.65 + (0.5 - 0.5 * Math.cos(Math.PI * t)) * 0.35);
    const st = sampleStations(stations, z);
    params.push(st);
    grid.push(sectionPoints(st).map(([x, y]) => [x, y, z]));
  }
  return { grid, params };
}

// 用 face 分類函式把格子切成多份幾何（各自有材質群組）。classify(i, j) 回傳 { part, mat } 或 null
export function buildParts(grid, classify, { mirror = true } = {}) {
  const parts = new Map();
  const get = (name) => {
    if (!parts.has(name)) parts.set(name, { pos: [], uv: [], groups: new Map(), map: new Map() });
    return parts.get(name);
  };
  const rings = grid.length, M = grid[0].length;
  // 累計弧長當 UV：u 沿車長、v 沿斷面
  const vlen = grid.map((row) => { const out = [0]; for (let j = 1; j < row.length; j++) out.push(out[j - 1] + Math.hypot(row[j][0] - row[j - 1][0], row[j][1] - row[j - 1][1])); return out; });
  for (const side of mirror ? [1, -1] : [1]) {
    for (let i = 0; i < rings - 1; i++) {
      for (let j = 0; j < M - 1; j++) {
        const c = classify(i, j, side);
        if (!c) continue;
        const part = get(c.part);
        const key = (ii, jj) => `${ii},${jj},${side}`;
        const vid = (ii, jj) => {
          const k = key(ii, jj);
          if (part.map.has(k)) return part.map.get(k);
          const p = grid[ii][jj];
          const id = part.pos.length / 3;
          part.pos.push(p[0] * side, p[1], p[2]);
          part.uv.push((grid[0][0][2] - p[2]), (vlen[ii][M - 1] - vlen[ii][jj]) * side);
          part.map.set(k, id);
          return id;
        };
        const a = vid(i, j), b = vid(i + 1, j), cc = vid(i + 1, j + 1), d = vid(i, j + 1);
        if (!part.groups.has(c.mat)) part.groups.set(c.mat, []);
        const idx = part.groups.get(c.mat);
        // 繞序：x>0 那半邊外側朝外
        if (side > 0) idx.push(a, b, cc, a, cc, d); else idx.push(a, cc, b, a, d, cc);
      }
    }
  }
  const out = {};
  for (const [name, p] of parts) {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(p.pos, 3));
    g.setAttribute('uv', new Float32BufferAttribute(p.uv, 2));
    const index = [];
    const mats = [];
    for (const [mat, idx] of p.groups) {
      g.addGroup(index.length, idx.length, mats.length);
      mats.push(mat);
      for (const v of idx) index.push(v);
    }
    g.setIndex(index);
    g.computeVertexNormals();
    // 中線上的頂點：法線不該有左右分量（兩半各自算法線會在中線折出一條稜）
    const pos = g.attributes.position, nor = g.attributes.normal;
    for (let k = 0; k < pos.count; k++) {
      if (Math.abs(pos.getX(k)) < 1e-4) {
        const ny = nor.getY(k), nz = nor.getZ(k), l = Math.hypot(ny, nz) || 1;
        nor.setXYZ(k, 0, ny / l, nz / l);
      }
    }
    out[name] = { geometry: g, mats };
  }
  return out;
}
