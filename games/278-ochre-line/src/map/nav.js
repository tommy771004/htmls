// 導航：layout.nav 的圖，開機算全對最短路的下一跳，查詢零配置。
export const nav = { n: 0, x: null, y: null, z: null, next: null, dist: null, id: {}, tags: null };
export function buildNav(L) {
  const N = L.nav.nodes, n = N.length; nav.n = n;
  nav.x = Float32Array.from(N, a => a.x); nav.y = Float32Array.from(N, a => a.y); nav.z = Float32Array.from(N, a => a.z); nav.tags = N.map(a => a.tags);
  N.forEach((a, i) => { nav.id[a.id] = i; });
  const d = new Float32Array(n * n).fill(1e9), nx = new Int16Array(n * n).fill(-1);
  for (let i = 0; i < n; i++) { d[i * n + i] = 0; nx[i * n + i] = i; }
  for (const e of L.nav.edges) {
    const a = nav.id[e.a ?? e[0] ?? e.from], b = nav.id[e.b ?? e[1] ?? e.to]; if (a === undefined || b === undefined) continue;
    const w = Math.hypot(nav.x[a] - nav.x[b], nav.z[a] - nav.z[b], nav.y[a] - nav.y[b]);
    d[a * n + b] = d[b * n + a] = w; nx[a * n + b] = b; nx[b * n + a] = a;
  }
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) { const ik = d[i * n + k]; if (ik >= 1e9) continue; for (let j = 0; j < n; j++) { const s = ik + d[k * n + j]; if (s < d[i * n + j]) { d[i * n + j] = s; nx[i * n + j] = nx[i * n + k]; } } }
  nav.next = nx; nav.dist = d;
}
export function nearest(x, y, z) {
  let b = 0, bd = 1e18;
  for (let i = 0; i < nav.n; i++) { const dx = nav.x[i] - x, dy = (nav.y[i] - y) * 2.5, dz = nav.z[i] - z, q = dx * dx + dy * dy + dz * dz; if (q < bd) { bd = q; b = i; } }
  return b;
}
export function tagged(tag) { const o = []; for (let i = 0; i < nav.n; i++) if (nav.tags[i].includes(tag)) o.push(i); return o; }
