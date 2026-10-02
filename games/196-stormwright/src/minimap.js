// 小地圖與大地圖（Canvas 2D）：預先烘焙帶山影的地形底圖，疊風暴、下一圈、飛艇航線、POI、玩家箭頭。
import { POI_SITES } from './terrain.js';

const HALF = 440;
const FONT = '"Anton", "Arial Narrow", "PingFang TC", "Heiti TC", "Microsoft JhengHei", sans-serif';
const VIEW = 140; // 小地圖半幅（公尺）

export class Minimap {
  constructor(ctx) {
    this.ctx = ctx; this.mini = document.getElementById('minimap'); this.big = document.getElementById('bigmapc');
    this.base = null; this.t = 0; this.clock = 0;
  }
  init() {
    const S = 512, T = this.ctx.terrain, N = S + 2;
    const H = new Float32Array(N * N);
    const wx = (i) => -HALF + ((i - 1) / S) * HALF * 2;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = T.heightAt(wx(i), wx(j));
    const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), img = g.createImageData(S, S);
    const lerp = (a, b, t) => a + (b - a) * t;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const h = H[(j + 1) * N + i + 1], k = (j * S + i) * 4;
      const shade = Math.max(-0.35, Math.min(0.35, (H[j * N + i] - H[(j + 2) * N + i + 2]) * 0.09));
      let r, gg, b;
      if (h < 0.05) {
        const d = Math.min(1, -h / 7); r = lerp(120, 36, d); gg = lerp(214, 138, d); b = lerp(236, 206, d);
      } else if (h < 1.7) { r = 244; gg = 226; b = 156; }
      else {
        const t = Math.min(1, h / 42), rock = h > 30 ? Math.min(1, (h - 30) / 14) : 0;
        r = lerp(112, 74, t) + rock * 70; gg = lerp(206, 160, t) + rock * 0; b = lerp(78, 60, t) + rock * 80;
        const x = wx(i + 1), z = wx(j + 1);
        if (T.onRoad && T.onRoad(x, z)) { r = 226; gg = 198; b = 140; }
      }
      const f = 1 + shade;
      img.data[k] = Math.max(0, Math.min(255, r * f)); img.data[k + 1] = Math.max(0, Math.min(255, gg * f)); img.data[k + 2] = Math.max(0, Math.min(255, b * f)); img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // 城鎮底色圈
    const px = (x) => ((x + HALF) / (HALF * 2)) * S;
    for (const q of POI_SITES) { g.fillStyle = 'rgba(255,248,226,.32)'; g.beginPath(); g.arc(px(q.x), px(q.z), q.r * 0.62 * S / (HALF * 2), 0, 7); g.fill(); }
    this.base = c;
  }
  // 世界座標 → 畫布座標（可含旋轉）
  _proj(W, view, cx, cz, rot) {
    const sc = W / (view * 2), cs = Math.cos(rot), sn = Math.sin(rot);
    return (x, z) => { const dx = (x - cx) * sc, dz = (z - cz) * sc; return [W / 2 + dx * cs - dz * sn, W / 2 + dx * sn + dz * cs]; };
  }
  draw(cv, full) {
    if (!cv || !this.base) return;
    const c = this.ctx, g = cv.getContext('2d'), W = cv.width, p = c.player, m = c.match, s = c.storm;
    const rotate = !full && c.settings.minimapRotate !== false;
    const focus = (p.alive || !c.cam.spectate) ? p : c.cam.spectate;
    const view = full ? HALF : VIEW, sc = W / (view * 2), k = full ? W / 640 : W / 280; // k：把線寬／字級換算成畫布像素
    const cx = full ? 0 : focus.pos.x, cz = full ? 0 : focus.pos.z, rot = rotate ? focus.yaw : 0;
    const P = this._proj(W, view, cx, cz, rot);
    g.clearRect(0, 0, W, W); g.save();
    // 地形與風暴罩（同一旋轉座標系）
    g.fillStyle = '#58b8e8'; g.fillRect(0, 0, W, W);
    g.save(); g.translate(W / 2, W / 2); g.rotate(rot); g.translate(-cx * sc, -cz * sc);
    g.drawImage(this.base, -HALF * sc, -HALF * sc, HALF * 2 * sc, HALF * 2 * sc);
    if (s.active || full) {
      const pulse = 0.46 + 0.07 * Math.sin(this.clock * 3);
      g.fillStyle = `rgba(143,52,224,${pulse})`; g.beginPath(); g.rect(-5000, -5000, 10000, 10000);
      g.arc(s.center.x * sc, s.center.y * sc, Math.max(0.5, s.radius * sc), 0, Math.PI * 2, true); g.fill('evenodd');
      g.strokeStyle = '#e9c4ff'; g.lineWidth = (full ? 3.5 : 2.6) * k; g.beginPath(); g.arc(s.center.x * sc, s.center.y * sc, Math.max(0.5, s.radius * sc), 0, Math.PI * 2); g.stroke();
      if (s.active && s.next.radius > 0.5 && (s.state === 'waiting' || s.state === 'shrinking')) {
        g.strokeStyle = '#fff'; g.lineWidth = (full ? 3.5 : 2.6) * k; g.setLineDash([8 * k, 6 * k]); g.beginPath(); g.arc(s.next.center.x * sc, s.next.center.y * sc, s.next.radius * sc, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      }
    }
    g.restore();
    // 飛艇航線
    if (m.bus.visible && m.state === 'bus') {
      const a = P(m.busStart.x, m.busStart.z), b = P(m.busStart.x + m.busDir.x * m.busLen, m.busStart.z + m.busDir.z * m.busLen);
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = (full ? 4 : 3) * k; g.setLineDash([10 * k, 8 * k]); g.lineDashOffset = -this.clock * 24 * k;
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]);
      const bp = m.busPos({ set(x, y, z) { return { x, y, z }; } }), q = P(bp.x, bp.z), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      g.save(); g.translate(q[0], q[1]); g.rotate(ang);
      g.fillStyle = '#ff5a5a'; g.strokeStyle = '#0f1d45'; g.lineWidth = 2.5 * k; g.beginPath(); g.ellipse(0, 0, (full ? 16 : 11) * k, (full ? 8 : 6) * k, 0, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#fff3d6'; g.fillRect(-3 * k, -(full ? 8 : 6) * k, 4 * k, (full ? 16 : 12) * k); g.restore();
    }
    // 安全區方向（在圈外時）
    if (s.active && p.alive && !full && s.isOutside(p.pos.x, p.pos.z)) {
      const a = P(p.pos.x, p.pos.z), b = P(s.center.x, s.center.y);
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2.6 * k; g.setLineDash([4 * k, 6 * k]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]);
    }
    // 附近寶箱訊號
    if (!full && p.alive && p.state === 'ground') {
      for (const ch of c.loot.chests) {
        if (ch.opened) continue; const d = Math.hypot(ch.x - p.pos.x, ch.z - p.pos.z); if (d > 38) continue;
        const q = P(ch.x, ch.z), pr = ((this.clock * 1.2) % 1);
        g.strokeStyle = `rgba(255,225,77,${1 - pr})`; g.lineWidth = 2 * k; g.beginPath(); g.arc(q[0], q[1], (3 + pr * 9) * k, 0, 7); g.stroke();
        g.fillStyle = '#ffe14d'; g.strokeStyle = '#0f1d45'; g.lineWidth = 1.5 * k; g.fillRect(q[0] - 3.5 * k, q[1] - 3 * k, 7 * k, 6 * k); g.strokeRect(q[0] - 3.5 * k, q[1] - 3 * k, 7 * k, 6 * k);
      }
    }
    // POI 名稱（保持直立）
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    for (const q of POI_SITES) {
      const [x, z] = P(q.x, q.z); if (x < -50 || x > W + 50 || z < -20 || z > W + 20) continue;
      const fs = (full ? 22 : 12) * k * (full ? 1 : 1);
      g.font = `900 ${fs}px ${FONT}`; g.lineWidth = (full ? 6 : 3.5) * k; g.strokeStyle = 'rgba(15,29,69,.9)'; g.fillStyle = '#fff';
      g.strokeText(q.name, x, z); g.fillText(q.name, x, z);
      if (full) { g.font = `900 ${fs * 0.55}px ${FONT}`; g.lineWidth = 4 * k; g.fillStyle = '#ffe14d'; g.strokeText(q.en.toUpperCase(), x, z + fs * 0.95); g.fillText(q.en.toUpperCase(), x, z + fs * 0.95); }
    }
    // 玩家箭頭
    const q = P(focus.pos.x, focus.pos.z), arr = (full ? 1.5 : 1.15) * k;
    g.save(); g.translate(q[0], q[1]); g.rotate(rotate ? 0 : -focus.yaw); g.scale(arr, arr);
    g.fillStyle = '#ffe14d'; g.strokeStyle = '#0f1d45'; g.lineWidth = 2.6 / 1; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.stroke(); g.fill(); g.restore();
    // 北方標記
    if (rotate) {
      const nx = Math.sin(rot), ny = -Math.cos(rot), e = W / 2 - 14 * k, t = e / Math.max(Math.abs(nx), Math.abs(ny));
      const X = W / 2 + nx * t, Y = W / 2 + ny * t;
      g.fillStyle = '#0f1d45'; g.beginPath(); g.arc(X, Y, 11 * k, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.font = `900 ${15 * k}px ${FONT}`; g.fillText('N', X, Y + k);
    }
    g.restore();
  }
  update(dt) {
    this.clock += dt; this.t += dt;
    if (!this.base) return;
    if (this.ctx.match.state === 'menu') return;
    const open = this.ctx.hud?.mapOpen;
    if (this.t < 1 / 30 && !open) return; this.t = 0;
    this.draw(this.mini, false);
    if (open) this.draw(this.big, true);
  }
}
