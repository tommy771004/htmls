// Canvas 2D 備援：正上方俯視，地面貼圖＋胎痕＋道具俯視小圖＋卡車矩形＋簡化粒子。
import { createFx, KIND } from './fx.js';
import { readTruck, readPickups, readHeader } from '../core.js';

const PROP_TINTS = ['#a8432a', '#3f6a8a', '#d0a23a', '#e6dcc6'];

function avgColor(m) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < m.col.length; i += 4) { if (m.col[i + 3] === 0) continue; r += m.col[i]; g += m.col[i + 1]; b += m.col[i + 2]; n++; }
  return n ? `rgb(${r / n | 0},${g / n | 0},${b / n | 0})` : '#6b5a48';
}

export function createCanvas2DRenderer(canvas, ctx, { meshes, tracks, albedo }) {
  let T = null;
  const perTrack = new Map();
  let cssW = 1, cssH = 1, dpr = 1;
  let insets = { top: 0, right: 0, bottom: 0, left: 0 };
  let view = { s: 1, ox: 0, oy: 0 };
  let time = 0;
  const propCol = meshes.map(avgColor);
  const stats = { drawCalls: 0, particles: 0 };

  function ensure(id) {
    if (!perTrack.has(id)) {
      const track = tracks[id];
      const img = albedo[id] || albedo[0];
      perTrack.set(id, { id, track, img, fx: createFx(track, img, meshes) });
    }
    return perTrack.get(id);
  }

  function refit() {
    if (!T) return;
    const t = T.track;
    const rw = Math.max(40, cssW - insets.left - insets.right), rh = Math.max(40, cssH - insets.top - insets.bottom);
    const s = Math.min(rw * 0.97 / t.width, rh * 0.97 / t.depth);
    view = { s, ox: insets.left + (rw - t.width * s) / 2, oy: insets.top + (rh - t.depth * s) / 2 };
  }

  const sx = (x) => view.ox + (x - T.track.originX) * view.s;
  const sy = (z) => view.oy + (z - T.track.originZ) * view.s;

  function drawTruck(g, t, color, isPlayer) {
    const s = view.s;
    const lift = t.airborne ? 1 + Math.min(0.25, Math.max(0, t.y - T.track.heightAt(t.x, t.z)) * 0.08) : 1;
    const x = sx(t.x), y = sy(t.z);
    // 影子（往右上偏）
    const hOff = Math.max(0, t.y - T.track.heightAt(t.x, t.z)) * s * 0.5;
    g.save();
    g.translate(x + 0.25 * s + hOff, y - 0.2 * s - hOff * 0.6);
    g.rotate(t.yaw);
    g.fillStyle = 'rgba(30,14,6,0.35)';
    g.fillRect(-1.3 * s, -0.9 * s, 2.6 * s, 1.8 * s);
    g.restore();
    g.save();
    g.translate(x, y);
    g.rotate(t.yaw);
    g.scale(lift, lift);
    if (isPlayer) {
      g.strokeStyle = 'rgba(250,220,140,0.9)';
      g.lineWidth = Math.max(1.5, 0.12 * s);
      g.beginPath(); g.arc(0, 0, 2.05 * s, 0.5, Math.PI * 2 - 0.5); g.stroke();
      g.beginPath(); g.moveTo(2.3 * s, -0.7 * s); g.lineTo(3.05 * s, 0); g.lineTo(2.3 * s, 0.7 * s); g.stroke();
    }
    g.fillStyle = '#17120e';
    for (const [wx, wz] of [[0.85, -0.78], [0.85, 0.78], [-0.85, -0.78], [-0.85, 0.78]]) {
      g.save();
      g.translate(wx * s, wz * s);
      if (wx > 0) g.rotate(t.steer * 0.5);
      g.fillRect(-0.42 * s, -0.16 * s, 0.84 * s, 0.32 * s);
      g.restore();
    }
    g.fillStyle = color;
    g.fillRect(-1.25 * s, -0.72 * s, 2.5 * s, 1.44 * s);
    if (t.wet > 0.05) { g.fillStyle = `rgba(40,24,12,${Math.min(0.6, t.wet * 0.6)})`; g.fillRect(-1.25 * s, -0.72 * s, 2.5 * s, 1.44 * s); }
    g.fillStyle = 'rgba(20,16,14,0.55)';
    g.fillRect(-0.2 * s, -0.6 * s, 0.75 * s, 1.2 * s);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(-1.25 * s, -0.72 * s, 2.5 * s, 0.25 * s);
    g.restore();
  }

  // 俯視的道具小圖（局部座標：x0,z0 起、寬 w、深 d，單位是畫面 px）。沒有專屬畫法的就畫平均色方塊。
  function drawProp(g, mesh, x0, z0, w, d, col) {
    const cx = x0 + w / 2, cz = z0 + d / 2, r = Math.min(w, d) / 2;
    const ink = '#2a1a0e';
    g.lineWidth = Math.max(1, r * 0.12);
    g.strokeStyle = ink;
    switch (mesh) {
      case 5: { // 看台：木座＋紅白條紋帆布遮陽
        g.fillStyle = '#6b4a2c';
        g.fillRect(x0, z0, w, d);
        const n = Math.max(4, Math.round(w / Math.max(4, d * 0.5)));
        for (let k = 0; k < n; k++) {
          g.fillStyle = k % 2 ? '#e6dcc6' : '#b8412c';
          g.fillRect(x0 + (w * k) / n, z0, w / n + 0.5, d * 0.62);
        }
        g.fillStyle = 'rgba(23,14,8,0.35)';
        g.fillRect(x0, z0 + d * 0.62, w, d * 0.08);
        g.strokeRect(x0, z0, w, d);
        break;
      }
      case 6: { // 照明燈塔：交叉斜撐的塔身＋燈架
        g.strokeStyle = '#5c5750';
        g.strokeRect(x0 + w * 0.15, z0 + d * 0.15, w * 0.7, d * 0.7);
        g.beginPath();
        g.moveTo(x0 + w * 0.15, z0 + d * 0.15); g.lineTo(x0 + w * 0.85, z0 + d * 0.85);
        g.moveTo(x0 + w * 0.85, z0 + d * 0.15); g.lineTo(x0 + w * 0.15, z0 + d * 0.85);
        g.stroke();
        g.fillStyle = '#f2e6b8';
        g.fillRect(cx - r * 0.55, cz - r * 0.3, r * 1.1, r * 0.6);
        g.strokeStyle = ink;
        g.strokeRect(cx - r * 0.55, cz - r * 0.3, r * 1.1, r * 0.6);
        break;
      }
      case 8: { // 仙人掌：圓形主幹＋兩支手臂，暗色稜線
        g.fillStyle = '#5f7a45';
        for (const [ax, az, ar] of [[0, 0, 0.62], [-0.55, -0.35, 0.34], [0.55, 0.3, 0.3]]) {
          g.beginPath(); g.arc(cx + ax * r, cz + az * r, ar * r, 0, 6.283); g.fill(); g.stroke();
        }
        g.strokeStyle = 'rgba(30,40,20,0.6)';
        g.beginPath(); g.moveTo(cx - r * 0.4, cz); g.lineTo(cx + r * 0.4, cz); g.moveTo(cx, cz - r * 0.4); g.lineTo(cx, cz + r * 0.4); g.stroke();
        break;
      }
      case 2: { // 輪胎堆：一顆顆黑輪胎
        const n = Math.max(1, Math.round(w / Math.max(1, d)));
        const tr = Math.min(d / 2, w / (2 * n));
        for (let k = 0; k < n; k++) {
          const x = x0 + tr + (k * (w - 2 * tr)) / Math.max(1, n - 1);
          g.fillStyle = '#1d1a18';
          g.beginPath(); g.arc(n === 1 ? cx : x, cz, tr * 0.95, 0, 6.283); g.fill();
          g.fillStyle = '#4a4540';
          g.beginPath(); g.arc(n === 1 ? cx : x, cz, tr * 0.42, 0, 6.283); g.fill();
        }
        break;
      }
      case 4: // 油桶
        g.fillStyle = col;
        g.beginPath(); g.arc(cx, cz, r * 0.92, 0, 6.283); g.fill(); g.stroke();
        g.beginPath(); g.arc(cx, cz, r * 0.55, 0, 6.283); g.stroke();
        break;
      case 3: { // 乾草捆：圓角金黃，壓出幾道綁繩
        g.fillStyle = '#c9a052';
        g.fillRect(x0, z0, w, d);
        g.strokeStyle = 'rgba(90,60,20,0.8)';
        g.beginPath();
        for (const f of [0.3, 0.7]) { g.moveTo(x0 + w * f, z0); g.lineTo(x0 + w * f, z0 + d); }
        g.stroke();
        g.strokeStyle = ink;
        g.strokeRect(x0, z0, w, d);
        break;
      }
      case 9: { // 起終點拱門：兩根柱子＋棋盤格橫幅
        g.fillStyle = '#4f3320';
        g.fillRect(x0, z0, w, d * 0.18); g.fillRect(x0, z0 + d * 0.82, w, d * 0.18);
        const n = 8;
        for (let k = 0; k < n; k++) {
          g.fillStyle = k % 2 ? '#ecdfc6' : '#170e08';
          g.fillRect(cx - w * 0.2, z0 + (d * k) / n, w * 0.4, d / n + 0.5);
        }
        break;
      }
      case 10: // 圍欄：細橫條＋柱
        g.fillStyle = '#8a6a44';
        g.fillRect(x0, cz - Math.max(0.5, d * 0.2), w, Math.max(1, d * 0.4));
        g.fillStyle = '#4f3320';
        for (let k = 0; k <= 4; k++) g.fillRect(x0 + (w * k) / 4 - 1, cz - d / 2, 2, d);
        break;
      case 7: // 旗桿：桿子＋車隊色三角旗
        g.fillStyle = '#3b2618';
        g.beginPath(); g.arc(cx, cz, Math.max(1, r * 0.35), 0, 6.283); g.fill();
        g.fillStyle = col;
        g.beginPath(); g.moveTo(cx, cz); g.lineTo(cx + Math.max(w, d) * 0.9, cz - r * 0.5); g.lineTo(cx + Math.max(w, d) * 0.9, cz + r * 0.5); g.closePath(); g.fill();
        break;
      default:
        g.fillStyle = col;
        g.fillRect(x0, z0, w, d);
    }
  }

  function draw(core, dt, opts = {}) {
    if (!T) return;
    dt = opts.paused ? 0 : Math.max(0, Math.min(dt || 0, 0.1));
    time += dt;
    const g = ctx;
    const e = T, t = e.track;
    e.fx.update(core, dt, opts);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#3b2616';
    g.fillRect(0, 0, cssW, cssH);
    g.imageSmoothingEnabled = true;
    g.drawImage(e.img, sx(t.originX), sy(t.originZ), t.width * view.s, t.depth * view.s);
    g.drawImage(e.fx.marks, sx(t.originX), sy(t.originZ), t.width * view.s, t.depth * view.s);
    // 道具
    for (let i = 0; i < t.props.length; i++) {
      const p = t.props[i], m = meshes[p.mesh];
      if (!m) continue;
      const b = m.bbox, s = view.s * (p.scale || 1);
      g.save();
      g.translate(sx(p.x), sy(p.z));
      g.rotate(p.yaw);
      g.fillStyle = 'rgba(30,14,6,0.3)';
      g.fillRect(b.min[0] * s + 0.3 * view.s, b.min[2] * s - 0.25 * view.s, (b.max[0] - b.min[0]) * s, (b.max[2] - b.min[2]) * s);
      drawProp(g, p.mesh, b.min[0] * s, b.min[2] * s, (b.max[0] - b.min[0]) * s, (b.max[2] - b.min[2]) * s, p.mesh === 7 ? PROP_TINTS[i % 4] : propCol[p.mesh]);
      g.restore();
    }
    // 道具（撿取物）
    const s = core.state();
    for (const p of readPickups(s)) {
      if (!p.active || !p.type) continue;
      const r = (0.95 + Math.sin(time * 5 + p.x) * 0.1) * view.s;
      g.strokeStyle = 'rgba(245,225,170,0.55)';
      g.lineWidth = Math.max(1, 0.12 * view.s);
      g.beginPath(); g.arc(sx(p.x), sy(p.z), r * (1.5 + (time * 0.9 % 1)), 0, 6.283); g.stroke();
      g.fillStyle = p.type === 2 ? '#d9b04a' : '#e8e2d2';
      g.strokeStyle = '#2a1a0e';
      g.lineWidth = Math.max(1, 0.1 * view.s);
      g.beginPath(); g.arc(sx(p.x), sy(p.z), r, 0, 6.283); g.fill(); g.stroke();
    }
    const colors = opts.truckColors || PROP_TINTS;
    const showPlayer = !opts.attract && opts.playerMarker !== false && readHeader(s).phase >= 1;
    const trucks = [0, 1, 2, 3].map((k) => readTruck(s, k));
    // 先畫地面的，再畫滯空的
    const order = [0, 1, 2, 3].sort((a, b) => trucks[a].y - trucks[b].y);
    for (const k of order) drawTruck(g, trucks[k], colors[k], k === 0 && showPlayer);
    // 粒子
    const fx = e.fx, d = fx.data;
    stats.particles = fx.count;
    for (let i = 0; i < fx.count; i++) {
      const o = i * fx.stride;
      const kind = d[o + 8], a = d[o + 7];
      const add = a === 0;
      const alpha = add ? 0.9 * (1 - d[o + 10]) : a;
      const inv = add ? 1 : 1 / Math.max(a, 1e-3);
      const c = (v) => Math.min(255, Math.pow(Math.min(1, v * inv), 1 / 2.2) * 255) | 0;
      const px = sx(d[o]), py = sy(d[o + 2]) - (d[o + 1] - t.heightAt(d[o], d[o + 2])) * view.s * 0.3;
      const r = d[o + 3] * view.s * (kind === KIND.RING ? 1 : 0.5);
      g.globalAlpha = Math.min(1, alpha);
      if (kind === KIND.RING) {
        g.strokeStyle = `rgb(${c(d[o + 4])},${c(d[o + 5])},${c(d[o + 6])})`;
        g.lineWidth = Math.max(1, 0.1 * view.s);
        g.beginPath(); g.arc(px, py, r * 0.86, 0, 6.283); g.stroke();
      } else {
        g.fillStyle = `rgb(${c(d[o + 4])},${c(d[o + 5])},${c(d[o + 6])})`;
        g.beginPath(); g.arc(px, py, Math.max(0.8, r), 0, 6.283); g.fill();
      }
    }
    g.globalAlpha = 1;
  }

  return {
    kind: '2d',
    setTrack(id) {
      if (!tracks[id]) id = 0;
      if (T && T.id === id) return;
      T = ensure(id);
      T.fx.reset();
      refit();
    },
    resize(w, h, ratio = globalThis.devicePixelRatio || 1) {
      cssW = Math.max(1, w); cssH = Math.max(1, h);
      dpr = Math.min(2, Math.max(1, ratio));
      canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
      refit();
    },
    draw,
    setInsets(o) { insets = { top: 0, right: 0, bottom: 0, left: 0, ...o }; refit(); },
    trackRectOnScreen: () => (T ? { x: view.ox, y: view.oy, w: T.track.width * view.s, h: T.track.depth * view.s } : { x: 0, y: 0, w: cssW, h: cssH }),
    worldToScreen: (x, y, z) => ({ x: sx(x), y: sy(z) - (y - (T ? T.track.heightAt(x, z) : 0)) * view.s * 0.3, depth: 0.5 }),
    screenToWorld: (x, y) => ({ x: T.track.originX + (x - view.ox) / view.s, y: 0, z: T.track.originZ + (y - view.oy) / view.s }),
    truckScreen(core, k) { const t = readTruck(core.state(), k); return { x: sx(t.x), y: sy(t.z) - 1.6 * view.s * 0.3, depth: 0.5 }; },
    isLost: () => false,
    clearMarks() { if (T) T.fx.reset(); },
    stats,
    destroy() {},
  };
}
