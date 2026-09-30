// 賽道小地圖：由 track.path 畫成 SVG（路寬用 half_width，跳台／水坑／泥地／坡道分色，起點線與行車方向）。

const F = { JUMP: 1, WATER: 2, MUD: 4, CHECK: 8, RAMP: 16 };

export function miniMap(track, { cls = 'minimap', label = '' } = {}) {
  if (!track || !track.path || track.path.length < 3) return `<svg class="${cls}" viewBox="0 0 30 20"></svg>`;
  const path = track.path;
  const n = path.length;
  let minX = Infinity; let minZ = Infinity; let maxX = -Infinity; let maxZ = -Infinity;
  for (const p of path) {
    minX = Math.min(minX, p.x - p.hw); maxX = Math.max(maxX, p.x + p.hw);
    minZ = Math.min(minZ, p.z - p.hw); maxZ = Math.max(maxZ, p.z + p.hw);
  }
  const pad = 3;
  const vx = minX - pad; const vz = minZ - pad;
  const vw = maxX - minX + pad * 2; const vh = maxZ - minZ + pad * 2;
  const f1 = (v) => v.toFixed(1);
  // 底：整條路面（圓頭線段，寬度逐段）
  let base = '';
  let edge = '';
  let marks = '';
  for (let i = 0; i < n; i++) {
    const a = path[i];
    const b = path[(i + 1) % n];
    const w = (a.hw + b.hw);
    const seg = `x1="${f1(a.x)}" y1="${f1(a.z)}" x2="${f1(b.x)}" y2="${f1(b.z)}"`;
    edge += `<line ${seg} stroke-width="${f1(w + 1.6)}"/>`;
    base += `<line ${seg} stroke-width="${f1(w)}"/>`;
    const fl = a.flags | 0;
    let c = '';
    if (fl & F.WATER) c = 'mm-water';
    else if (fl & F.MUD) c = 'mm-mud';
    else if (fl & F.JUMP) c = 'mm-jump';
    else if (fl & F.RAMP) c = 'mm-ramp';
    if (c) marks += `<line class="${c}" ${seg} stroke-width="${f1(w * 0.72)}"/>`;
  }
  // 起點線：垂直於行進方向
  const p0 = path[0];
  const p1 = path[1];
  const dx = p1.x - p0.x; const dz = p1.z - p0.z;
  const L = Math.hypot(dx, dz) || 1;
  const nx = -dz / L; const nz = dx / L;
  const hw = p0.hw + 0.6;
  const start = `<line class="mm-start" x1="${f1(p0.x + nx * hw)}" y1="${f1(p0.z + nz * hw)}" x2="${f1(p0.x - nx * hw)}" y2="${f1(p0.z - nz * hw)}"/>`;
  // 行車方向：起點後方一個小三角
  const k = Math.min(n - 1, 6);
  const q = path[k];
  const q2 = path[(k + 1) % n];
  const ax = q2.x - q.x; const az = q2.z - q.z;
  const al = Math.hypot(ax, az) || 1;
  const ux = ax / al; const uz = az / al;
  const s = 2.2;
  const arrow = `<path class="mm-dir" d="M${f1(q.x + ux * s)} ${f1(q.z + uz * s)}L${f1(q.x - ux * s + uz * s)} ${f1(q.z - uz * s - ux * s)}L${f1(q.x - ux * s - uz * s)} ${f1(q.z - uz * s + ux * s)}Z"/>`;
  return `<svg class="${cls}" viewBox="${f1(vx)} ${f1(vz)} ${f1(vw)} ${f1(vh)}" preserveAspectRatio="xMidYMid meet"${label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true"'}>
<g class="mm-edge" stroke-linecap="round">${edge}</g><g class="mm-road" stroke-linecap="round">${base}</g><g stroke-linecap="round">${marks}</g>${start}${arrow}</svg>`;
}
