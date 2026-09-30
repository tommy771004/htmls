// 街機固定鏡頭：從南方斜上方俯視，整個場地塞進畫布（可扣掉 UI 保留區），偏心視錐讓場地落在保留區中央。
import { lookAt, frustum, mul, xform, invert } from './math.js';

const DEF_PITCH = 1.03; // 約 59° 俯角

// 場地包圍盒：高度場範圍＋道具高度
export function arenaBounds(track, meshes) {
  const x0 = track.originX, z0 = track.originZ;
  let x1 = x0 + track.width, z1 = z0 + track.depth;
  let ylo = Infinity, yhi = -Infinity;
  for (let i = 0; i < track.height.length; i++) {
    const h = track.height[i];
    if (h < ylo) ylo = h;
    if (h > yhi) yhi = h;
  }
  let bx0 = x0, bz0 = z0;
  for (const p of track.props) {
    const m = meshes[p.mesh];
    const top = p.y + (m ? m.bbox.max[1] * p.scale : 2);
    if (top > yhi) yhi = top;
    const r = m ? Math.max(Math.abs(m.bbox.min[0]), Math.abs(m.bbox.max[0]), Math.abs(m.bbox.min[2]), Math.abs(m.bbox.max[2])) * p.scale : 1;
    bx0 = Math.min(bx0, p.x - r); x1 = Math.max(x1, p.x + r);
    bz0 = Math.min(bz0, p.z - r); z1 = Math.max(z1, p.z + r);
  }
  // 道具可能在高度場外一點點；最多外擴 6 m，避免離群值把場地縮太小
  return {
    x0: Math.max(bx0, x0 - 6), x1: Math.min(x1, x0 + track.width + 6),
    z0: Math.max(bz0, z0 - 6), z1: Math.min(z1, z0 + track.depth + 6),
    y0: ylo, y1: Math.min(yhi, ylo + 14), yTop: yhi,
  };
}

export function createCamera() {
  const cam = {
    view: new Float32Array(16), proj: new Float32Array(16), viewProj: new Float32Array(16), invViewProj: new Float32Array(16),
    eye: [0, 0, 0], right: [1, 0, 0], up: [0, 1, 0], fwd: [0, 0, -1],
    rect: { x: 0, y: 0, w: 1, h: 1 }, // 場地在畫面上的 CSS px 範圍
    cssW: 1, cssH: 1,
  };

  cam.fit = (b, cssW, cssH, insets, hint) => {
    cam.cssW = cssW; cam.cssH = cssH;
    const pitch = hint && hint.pitch > 0.75 && hint.pitch < 1.4 ? hint.pitch : DEF_PITCH;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, cy = b.y0;
    const diag = Math.hypot(b.x1 - b.x0, b.z1 - b.z0);
    const D = diag * 2.1; // 遠一點＝透視很輕
    const eye = [cx, cy + Math.sin(pitch) * D, cz + Math.cos(pitch) * D];
    lookAt(eye, [cx, cy, cz], [0, 1, 0], cam.view);
    cam.eye = eye;
    const v = cam.view;
    cam.right = [v[0], v[4], v[8]]; cam.up = [v[1], v[5], v[9]]; cam.fwd = [-v[2], -v[6], -v[10]];

    // 所有角點投到 tan 空間
    let ax0 = Infinity, ax1 = -Infinity, ay0 = Infinity, ay1 = -Infinity, zn = Infinity, zf = 0;
    for (const x of [b.x0, b.x1]) for (const z of [b.z0, b.z1]) for (const y of [b.y0, b.y1]) {
      const p = xform(v, x, y, z);
      const d = -p[2];
      ax0 = Math.min(ax0, p[0] / d); ax1 = Math.max(ax1, p[0] / d);
      ay0 = Math.min(ay0, p[1] / d); ay1 = Math.max(ay1, p[1] / d);
      zn = Math.min(zn, d); zf = Math.max(zf, d);
    }
    const ins = insets || { top: 0, right: 0, bottom: 0, left: 0 };
    const rx = ins.left, ry = ins.top;
    const rw = Math.max(40, cssW - ins.left - ins.right), rh = Math.max(40, cssH - ins.top - ins.bottom);
    const margin = 0.97;
    const s = Math.min(rw * margin / (ax1 - ax0), rh * margin / (ay1 - ay0)); // px / tan
    const bcx = (ax0 + ax1) / 2, bcy = (ay0 + ay1) / 2;
    const Rcx = rx + rw / 2, Rcy = ry + rh / 2;
    const l = bcx - Rcx / s, r = bcx + (cssW - Rcx) / s;
    const t = bcy + Rcy / s, bt = bcy - (cssH - Rcy) / s;
    const near = Math.max(1, zn * 0.5), far = zf * 1.6 + 50;
    frustum(l * near, r * near, bt * near, t * near, near, far, cam.proj);
    mul(cam.proj, cam.view, cam.viewProj);
    invert(cam.viewProj, cam.invViewProj);
    cam.pxPerTan = s;
    cam.rect = {
      x: Rcx - (bcx - ax0) * s, y: Rcy - (ay1 - bcy) * s,
      w: (ax1 - ax0) * s, h: (ay1 - ay0) * s,
    };
  };

  // 世界 → CSS px（z 為深度 0..1，w<0 表示在鏡頭後）
  cam.worldToScreen = (x, y, z) => {
    const p = xform(cam.viewProj, x, y, z);
    return { x: (p[0] / p[3] * 0.5 + 0.5) * cam.cssW, y: (0.5 - p[1] / p[3] * 0.5) * cam.cssH, depth: p[2] / p[3] * 0.5 + 0.5 };
  };

  // CSS px → 與 y = planeY 平面的交點
  cam.screenToWorld = (sx, sy, planeY = 0) => {
    const nx = sx / cam.cssW * 2 - 1, ny = 1 - sy / cam.cssH * 2;
    const a = xform(cam.invViewProj, nx, ny, -1), c = xform(cam.invViewProj, nx, ny, 1);
    const p0 = [a[0] / a[3], a[1] / a[3], a[2] / a[3]], p1 = [c[0] / c[3], c[1] / c[3], c[2] / c[3]];
    const dy = p1[1] - p0[1];
    if (Math.abs(dy) < 1e-6) return null;
    const t = (planeY - p0[1]) / dy;
    return { x: p0[0] + (p1[0] - p0[0]) * t, y: planeY, z: p0[2] + (p1[2] - p0[2]) * t };
  };

  return cam;
}
