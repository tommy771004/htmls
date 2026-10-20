// 地形高度格（每 step 公尺一格），物理碰撞、地形網格與水的深度貼圖共用；sample() 是雙線性內插。
import { height, BOUNDS } from './map.js';

export function buildGrid(step = 2) {
  const nx = Math.round((BOUNDS.x1 - BOUNDS.x0) / step) + 1, nz = Math.round((BOUNDS.z1 - BOUNDS.z0) / step) + 1;
  const h = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) h[j * nx + i] = height(BOUNDS.x0 + i * step, BOUNDS.z0 + j * step);
  const sample = (x, z) => {
    const fx = Math.max(0, Math.min(nx - 1.001, (x - BOUNDS.x0) / step)), fz = Math.max(0, Math.min(nz - 1.001, (z - BOUNDS.z0) / step));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, o = j * nx + i;
    return (h[o] * (1 - u) + h[o + 1] * u) * (1 - v) + (h[o + nx] * (1 - u) + h[o + nx + 1] * u) * v;
  };
  return { nx, nz, step, x0: BOUNDS.x0, z0: BOUNDS.z0, h, sample };
}
