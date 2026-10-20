// 地圖：正射地球儀（可拖曳旋轉、滾輪縮放，可切換平面經緯度圖）與 HUD 右下角的小地圖。
import { LAND } from '../land.js';
import { PLACES, LANDMARKS } from '../core/places.js';
import { clamp } from '../core/math.js';

const D2R = Math.PI / 180;

export class GlobeMap {
  constructor(canvas, onPick) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.onPick = onPick;
    this.lat = 30;
    this.lon = -40;
    this.zoom = 1;
    this.flat = false;
    this.showStorms = true;
    this.pick = null;
    this.me = null;
    this.target = null;
    this.cells = [];
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, lat: this.lat, lon: this.lon, moved: 0 };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
      const k = (this.flat ? 360 / (this.cv.clientWidth * this.zoom) : 180 / (this.R() * Math.PI));
      this.lon = drag.lon - dx * k;
      this.lat = clamp(drag.lat + dy * k, -80, 80);
      this.draw();
    });
    canvas.addEventListener('pointerup', (e) => {
      if (drag && drag.moved < 5) {
        const r = canvas.getBoundingClientRect();
        const ll = this.unproject(e.clientX - r.left, e.clientY - r.top);
        if (ll) {
          this.pick = ll;
          this.onPick(ll);
          this.draw();
        }
      }
      drag = null;
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom = clamp(this.zoom * (e.deltaY > 0 ? 0.88 : 1.14), 0.7, 40);
      this.draw();
    }, { passive: false });
  }

  R() {
    return Math.min(this.cv.clientWidth, this.cv.clientHeight) * 0.42 * this.zoom;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.cv.clientWidth;
    const h = this.cv.clientHeight;
    if (!w || !h) return;
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // 經緯度 → 畫面座標（背面回傳 null）
  project(lat, lon, limb = false) {
    const w = this.cv.clientWidth;
    const h = this.cv.clientHeight;
    if (this.flat) {
      const s = (w * this.zoom) / 360;
      let dl = lon - this.lon;
      dl = ((dl + 540) % 360) - 180;
      return [w / 2 + dl * s, h / 2 - (lat - this.lat) * s];
    }
    const R = this.R();
    const p = lat * D2R;
    const l = (lon - this.lon) * D2R;
    const p0 = this.lat * D2R;
    const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
    if (cosc < 0 && !limb) return null;
    let x = R * Math.cos(p) * Math.sin(l);
    let y = R * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l));
    if (cosc < 0) {
      // 背面的點壓到地球邊緣，填色時多邊形才不會跨過正面
      const k = R / (Math.hypot(x, y) || 1);
      x *= k;
      y *= k;
    }
    return [w / 2 + x, h / 2 - y];
  }

  unproject(sx, sy) {
    const w = this.cv.clientWidth;
    const h = this.cv.clientHeight;
    if (this.flat) {
      const s = (w * this.zoom) / 360;
      let lon = this.lon + (sx - w / 2) / s;
      lon = ((lon + 540) % 360) - 180;
      const lat = this.lat - (sy - h / 2) / s;
      return Math.abs(lat) <= 85 ? { lat, lon } : null;
    }
    const R = this.R();
    const x = (sx - w / 2) / R;
    const y = -(sy - h / 2) / R;
    const rho = Math.hypot(x, y);
    if (rho > 1) return null;
    const c = Math.asin(rho);
    const p0 = this.lat * D2R;
    const lat = rho < 1e-9 ? this.lat : Math.asin(Math.cos(c) * Math.sin(p0) + (y * Math.sin(c) * Math.cos(p0)) / rho) / D2R;
    const lon = this.lon + Math.atan2(x * Math.sin(c), rho * Math.cos(p0) * Math.cos(c) - y * Math.sin(p0) * Math.sin(c)) / D2R;
    return { lat, lon: ((lon + 540) % 360) - 180 };
  }

  centerOn(lat, lon) {
    this.lat = clamp(lat, -75, 75);
    this.lon = lon;
  }

  draw() {
    const g = this.ctx;
    const w = this.cv.clientWidth;
    const h = this.cv.clientHeight;
    if (!w) return;
    g.clearRect(0, 0, w, h);
    const R = this.R();
    // 海洋
    g.fillStyle = '#bcd9e0';
    if (this.flat) g.fillRect(0, 0, w, h);
    else {
      g.beginPath();
      g.arc(w / 2, h / 2, R, 0, Math.PI * 2);
      g.fill();
    }
    // 經緯網
    g.strokeStyle = 'rgba(43, 38, 32, 0.10)';
    g.lineWidth = 1;
    for (let lat = -60; lat <= 60; lat += 30) this.path(Array.from({ length: 73 }, (_, k) => [-180 + k * 5, lat]), false);
    for (let lon = -180; lon < 180; lon += 30) this.path(Array.from({ length: 37 }, (_, k) => [lon, -90 + k * 5]), false);
    // 陸地
    g.fillStyle = '#ebe3d1';
    g.strokeStyle = '#a99c84';
    g.lineWidth = 0.8;
    for (const ring of LAND) this.path(ring, true);
    if (!this.flat) {
      const grd = g.createRadialGradient(w / 2 - R * 0.35, h / 2 - R * 0.35, R * 0.1, w / 2, h / 2, R);
      grd.addColorStop(0, 'rgba(255,255,255,0.18)');
      grd.addColorStop(1, 'rgba(60,40,10,0.16)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(w / 2, h / 2, R, 0, Math.PI * 2);
      g.fill();
    }
    // 風暴
    if (this.showStorms) {
      for (const c of this.cells) {
        const p = this.project(c.lat, c.lon);
        if (!p) continue;
        const kmPx = this.flat ? (w * this.zoom) / 360 / 111 : R / 6371;
        if (c.kind === 'front') {
          g.fillStyle = 'rgba(80, 110, 160, 0.10)';
          g.beginPath();
          g.ellipse(p[0], p[1], c.radius * kmPx * 1.4, c.radius * kmPx * 0.6, 0.3, 0, Math.PI * 2);
          g.fill();
        } else if (c.kind === 'hurricane') {
          const r = Math.max(9, c.radius * kmPx);
          g.strokeStyle = 'rgba(124, 58, 237, 0.85)';
          g.lineWidth = 2;
          for (let a = 0; a < 2; a++) {
            g.beginPath();
            for (let k = 0; k <= 30; k++) {
              const t = k / 30;
              const ang = a * Math.PI + t * Math.PI * 1.6;
              g.lineTo(p[0] + Math.cos(ang) * r * t, p[1] + Math.sin(ang) * r * t);
            }
            g.stroke();
          }
          label(g, c.name ? `颶風 ${c.name}` : '颶風', p[0] + r * 0.7, p[1] - r * 0.7, '#5b21b6');
        } else if (c.kind === 'storm') {
          g.fillStyle = 'rgba(124, 58, 237, 0.75)';
          g.beginPath();
          g.arc(p[0], p[1], 4.5, 0, Math.PI * 2);
          g.fill();
          if (c.tornado && this.zoom > 2) label(g, '龍捲風', p[0] + 6, p[1] - 5, '#5b21b6');
        }
      }
    }
    // 地點
    for (const pl of PLACES) {
      const p = this.project(pl.lat, pl.lon);
      if (!p) continue;
      dot(g, p, '#2b2620', 4);
      if (this.zoom > 1.6) label(g, pl.name.split(' · ')[0], p[0] + 6, p[1] + 4, '#2b2620');
    }
    for (const L of LANDMARKS) {
      const p = this.project(L.lat, L.lon);
      if (!p) continue;
      dot(g, p, '#2563eb', 3.5);
      if (this.zoom > 1.6) label(g, L.name, p[0] + 6, p[1] + 4, '#1d4ed8');
    }
    if (this.target && this.me) {
      // 大圓航線
      g.strokeStyle = 'rgba(232, 98, 44, 0.9)';
      g.setLineDash([5, 4]);
      g.lineWidth = 1.6;
      const pts = [];
      for (let k = 0; k <= 64; k++) pts.push(slerp(this.me, this.target, k / 64));
      this.path(pts.map((q) => [q.lon, q.lat]), false);
      g.setLineDash([]);
    }
    if (this.me) {
      const p = this.project(this.me.lat, this.me.lon);
      if (p) {
        g.fillStyle = 'rgba(232, 98, 44, 0.25)';
        g.beginPath();
        g.arc(p[0], p[1], 11, 0, Math.PI * 2);
        g.fill();
        dot(g, p, '#e8622c', 5.5, true);
      }
    }
    if (this.pick) {
      const p = this.project(this.pick.lat, this.pick.lon);
      if (p) {
        g.fillStyle = '#2b2620';
        g.beginPath();
        g.moveTo(p[0], p[1]);
        g.arc(p[0], p[1] - 14, 7, Math.PI * 0.8, Math.PI * 2.2);
        g.closePath();
        g.fill();
        dot(g, [p[0], p[1] - 14], '#fbf7f0', 2.5);
      }
    }
  }

  path(pts, fill) {
    const g = this.ctx;
    g.beginPath();
    let pen = false;
    let last = null;
    const limb = fill && !this.flat;
    if (limb && !pts.some(([lon, lat]) => this.project(lat, lon))) return;
    for (const [lon, lat] of pts) {
      const p = this.project(lat, lon, limb);
      if (!p || (this.flat && last && Math.abs(p[0] - last[0]) > this.cv.clientWidth * 0.5)) {
        pen = false;
        last = p;
        if (!p) continue;
      }
      if (pen) g.lineTo(p[0], p[1]);
      else g.moveTo(p[0], p[1]);
      pen = true;
      last = p;
    }
    if (fill) {
      g.closePath();
      g.fill();
    }
    g.stroke();
  }
}

function dot(g, p, c, r, ring) {
  g.fillStyle = c;
  g.beginPath();
  g.arc(p[0], p[1], r, 0, Math.PI * 2);
  g.fill();
  if (ring) {
    g.strokeStyle = '#fff';
    g.lineWidth = 2;
    g.stroke();
  }
}
function label(g, t, x, y, c) {
  g.font = '600 11px -apple-system, "PingFang TC", "Noto Sans TC", sans-serif';
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(251, 247, 240, 0.9)';
  g.strokeText(t, x, y);
  g.fillStyle = c;
  g.fillText(t, x, y);
}
function slerp(a, b, t) {
  const v = (q) => [Math.cos(q.lat * D2R) * Math.cos(q.lon * D2R), Math.cos(q.lat * D2R) * Math.sin(q.lon * D2R), Math.sin(q.lat * D2R)];
  const A = v(a);
  const B = v(b);
  const d = Math.acos(clamp(A[0] * B[0] + A[1] * B[1] + A[2] * B[2], -1, 1));
  if (d < 1e-6) return a;
  const s = Math.sin(d);
  const k0 = Math.sin((1 - t) * d) / s;
  const k1 = Math.sin(t * d) / s;
  const x = A[0] * k0 + B[0] * k1;
  const y = A[1] * k0 + B[1] * k1;
  const z = A[2] * k0 + B[2] * k1;
  return { lat: Math.atan2(z, Math.hypot(x, y)) / D2R, lon: Math.atan2(y, x) / D2R };
}

// ── 小地圖（北方朝上，比例約 1px = 1.6m）──
const MINI_COL = { road: '#ffffff', major: '#f6d98a', block: '#e8e0d0', building: '#d6ccb9', park: '#c9dfb2', water: '#a9cde0', sand: '#efe2bf', snow: '#f4f6f8', piste: '#9db7e6' };

export function drawMini(cv, world, streamer, p, camYaw, navBearing) {
  const g = cv.getContext('2d');
  const W = cv.width;
  const H = cv.height;
  const s = 0.62; // px / m
  const ox = W / 2 - p.x * s;
  const oz = H / 2 - p.z * s;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = world.kind === 'ski' ? MINI_COL.snow : world.kind === 'ocean' ? MINI_COL.water : MINI_COL.block;
  g.fillRect(0, 0, W, H);
  g.setTransform(s, 0, 0, s, ox, oz);
  const rect = (r, c) => {
    g.fillStyle = c;
    g.fillRect(r.x0, r.z0, r.x1 - r.x0, r.z1 - r.z0);
  };
  const vis = streamer.visible || [];
  const near = vis.filter((v) => v.d < 300);
  for (const v of near) {
    const L = v.chunk.layers;
    for (const w of L.water) rect(w, MINI_COL.water);
    for (const l of L.landuse) rect(l, l.cls === 'sand' ? MINI_COL.sand : l.cls === 'parking' ? '#dcd6cb' : '#d9d4ca');
    for (const pk of L.park) rect(pk, MINI_COL.park);
  }
  if (world.kind === 'hills' || world.kind === 'beach') {
    // 水域：粗略取樣地形
    g.fillStyle = MINI_COL.water;
    const step = 12;
    for (let x = p.x - W / s / 2; x < p.x + W / s / 2; x += step) {
      for (let z = p.z - H / s / 2; z < p.z + H / s / 2; z += step) {
        if (world.terrain(x, z) < world.waterY - 0.2) g.fillRect(x - step / 2, z - step / 2, step, step);
      }
    }
  }
  for (const v of near) {
    for (const r of v.chunk.layers.transportation) {
      if (r.cls === 'piste') {
        g.strokeStyle = r.color;
        g.globalAlpha = 0.35;
        g.lineWidth = r.w;
        g.beginPath();
        g.moveTo(r.x0, r.z0);
        g.lineTo(r.x1, r.z1);
        g.stroke();
        g.globalAlpha = 1;
        continue;
      }
      g.strokeStyle = r.cls === 'primary' || r.cls === 'trunk' ? MINI_COL.major : MINI_COL.road;
      g.lineWidth = r.w * 0.8;
      g.beginPath();
      g.moveTo(r.x0, r.z0);
      g.lineTo(r.x1, r.z1);
      g.stroke();
    }
  }
  for (const v of near) for (const b of v.chunk.layers.building) rect(b, b.shop ? '#e6c9a8' : MINI_COL.building);
  g.setTransform(1, 0, 0, 1, 0, 0);
  // 導航方向
  if (navBearing != null) {
    g.strokeStyle = '#e8622c';
    g.setLineDash([6, 5]);
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(W / 2, H / 2);
    g.lineTo(W / 2 + Math.sin(navBearing) * W, H / 2 - Math.cos(navBearing) * W);
    g.stroke();
    g.setLineDash([]);
  }
  // 視野扇形與玩家箭頭
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(camYaw);
  g.fillStyle = 'rgba(37, 99, 235, 0.14)';
  g.beginPath();
  g.moveTo(0, 0);
  g.arc(0, 0, 60, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
  g.closePath();
  g.fill();
  g.restore();
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(p.yaw);
  g.fillStyle = '#2563eb';
  g.strokeStyle = '#fff';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, -13);
  g.lineTo(9, 10);
  g.lineTo(0, 5);
  g.lineTo(-9, 10);
  g.closePath();
  g.stroke();
  g.fill();
  g.restore();
  g.fillStyle = '#2b2620';
  g.font = '700 18px -apple-system, sans-serif';
  g.fillText('N', 10, 24);
}
