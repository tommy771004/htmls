// 小地圖：地面貼圖縮圖＋路線、建築、小兵、英雄與鏡頭框。點擊可移動鏡頭或下移動指令。
import { TEAM_COLOR, TEAM_LIGHT, HEROES } from './config.js';
import { seen } from './vision.js';

export function createMinimap(canvas, groundCanvas) {
  const g = canvas.getContext('2d');
  const bg = document.createElement('canvas');
  const SIZE = 256; bg.width = bg.height = SIZE;
  // 底圖：取地面貼圖中央 ±92 的範圍
  const bgc = bg.getContext('2d');
  const src = groundCanvas.width, half = 130, crop = 92;
  const s0 = ((half - crop) / (half * 2)) * src, sw = (crop * 2 / (half * 2)) * src;
  bgc.drawImage(groundCanvas, s0, s0, sw, sw, 0, 0, SIZE, SIZE);
  bgc.fillStyle = 'rgba(22,17,12,.18)'; bgc.fillRect(0, 0, SIZE, SIZE);
  const toMap = (x, z, w) => [((x + crop) / (crop * 2)) * w, ((z + crop) / (crop * 2)) * w];
  let W = 0;
  return {
    toWorld(px, py) { const w = canvas.clientWidth; return { x: (px / w) * crop * 2 - crop, z: (py / w) * crop * 2 - crop }; },
    draw(G, view) {
      const w = canvas.clientWidth * Math.min(2, devicePixelRatio);
      if (w !== W) { W = w; canvas.width = canvas.height = w; }
      g.drawImage(bg, 0, 0, w, w);
      const k = w / 200;
      for (const s of G.structures) {
        const [x, y] = toMap(s.x, s.z, w);
        g.fillStyle = s.alive ? TEAM_COLOR[s.team] : 'rgba(40,30,20,.6)';
        g.strokeStyle = '#10141f'; g.lineWidth = 1.5 * k;
        if (s.kind === 'core') { g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.lineTo(x + Math.cos(a) * 7 * k, y + Math.sin(a) * 7 * k); } g.closePath(); g.fill(); g.stroke(); }
        else if (s.tier === 'inhib') { g.beginPath(); g.moveTo(x, y - 4 * k); g.lineTo(x + 3.2 * k, y); g.lineTo(x, y + 4 * k); g.lineTo(x - 3.2 * k, y); g.closePath(); g.fill(); g.stroke(); }
        else { g.beginPath(); g.moveTo(x, y - 5 * k); g.lineTo(x + 4 * k, y + 4 * k); g.lineTo(x - 4 * k, y + 4 * k); g.closePath(); g.fill(); g.stroke(); }
      }
      const PT = G.player ? G.player.team : 0;
      for (const c of G.camps || []) {
        const live = c.mobs.some((m) => m.alive);
        const [x, y] = toMap(c.x, c.z, w);
        g.beginPath(); g.arc(x, y, (c.boss ? 6 : 3.6) * k, 0, Math.PI * 2);
        g.fillStyle = live ? (c.boss ? '#ff9a3a' : '#e8b04a') : 'rgba(22,17,12,.5)'; g.fill();
        g.lineWidth = 1.4 * k; g.strokeStyle = '#10141f'; g.stroke();
      }
      if (G.shenron && G.shenron.alive) { const [x, y] = toMap(G.shenron.x, G.shenron.z, w); g.beginPath(); g.arc(x, y, 7 * k, 0, Math.PI * 2); g.fillStyle = '#ffc23d'; g.fill(); g.lineWidth = 1.6 * k; g.strokeStyle = '#10141f'; g.stroke(); g.fillStyle = '#c8231a'; g.font = `900 ${8 * k}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★', x, y + 0.5 * k); }
      for (const wd of G.wards || []) {
        if (!wd.alive || !seen(G, PT, wd)) continue;
        const [x, y] = toMap(wd.x, wd.z, w);
        g.beginPath(); g.arc(x, y, 2.6 * k, 0, Math.PI * 2); g.fillStyle = wd.control ? '#ff9a4a' : wd.team === PT ? '#b8f09a' : '#f07a5c'; g.fill(); g.lineWidth = k; g.strokeStyle = '#10141f'; g.stroke();
      }
      for (const m of G.minions) {
        if (!m.alive || !seen(G, PT, m)) continue;
        const [x, y] = toMap(m.x, m.z, w);
        g.fillStyle = TEAM_LIGHT[m.team]; g.fillRect(x - 1.4 * k, y - 1.4 * k, 2.8 * k, 2.8 * k);
      }
      for (const h of G.heroes) {
        if (!h.alive || !seen(G, PT, h)) continue;
        const [x, y] = toMap(h.x, h.z, w);
        g.beginPath(); g.arc(x, y, (h.isPlayer ? 6.5 : 5) * k, 0, Math.PI * 2);
        g.fillStyle = HEROES[h.heroId].color; g.fill();
        g.lineWidth = 2.2 * k; g.strokeStyle = h.isPlayer ? '#fff4d6' : TEAM_COLOR[h.team]; g.stroke();
      }
      // 鏡頭範圍
      if (view) {
        g.strokeStyle = 'rgba(255,244,214,.85)'; g.lineWidth = 1.4 * k; g.beginPath();
        view.forEach((p, i) => { const [x, y] = toMap(p.x, p.z, w); (i ? g.lineTo : g.moveTo).call(g, x, y); });
        g.closePath(); g.stroke();
      }
    },
  };
}
