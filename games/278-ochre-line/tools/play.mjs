// 實際玩（node tools/play.mjs <截圖資料夾> [回合數] [寬x高]）：選單點開始、B 開購買點品項、真鍵盤照導航圖走到炸點 A、到了按住 E 安裝、看到敵人用真滑鼠瞄準左鍵開火、死亡觀戰左鍵換人
import { startServer, launch } from './lib/serve.mjs';
const D = process.argv[2], ROUNDS = +(process.argv[3] || 3), [W, H] = (process.argv[4] || '1280x720').split('x').map(Number);
const srv = await startServer(); const errs = [], log = [];
const b = await launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto(srv.url + '/web/278-ochre-line.html'); await p.waitForFunction(() => window.__ol?.ready, null, { timeout: 120000 });
const t0 = Date.now(), T = () => ((Date.now() - t0) / 1000).toFixed(1); let shotN = 0;
const shot = async tag => { const f = `${D}/${String(++shotN).padStart(2, '0')}_${tag}.png`; await p.screenshot({ path: f }); log.push(`${T()} 截圖 ${f.split('/').pop()}`); };
await p.waitForTimeout(1500); await shot('menu');
await p.click('#m-go'); await p.waitForTimeout(1200); await shot('buyphase');
// 鎖定（無頭沒有真的 pointer lock，點一下後自己設 locked）
await p.mouse.click(W / 2, H / 2); await p.evaluate(() => { __ol.input.locked = true; __ol.G.paused = false; document.querySelectorAll('.pn').forEach(e => e.classList.remove('on')); });
// 量滑鼠像素→yaw
await p.mouse.move(W / 2, H / 2); const y0 = await p.evaluate(() => __ol.you.yaw); await p.mouse.move(W / 2 + 100, H / 2); await p.waitForTimeout(50);
const y1 = await p.evaluate(() => __ol.you.yaw); log.push(`${T()} 滑鼠 100px → yaw ${(y1 - y0).toFixed(4)} rad`);
let mx = W / 2 + 100, my = H / 2;
const turn = async (dyaw, dpitch, k) => { const s = await p.evaluate(() => __ol.input.sens * __ol.you.sensK); let px = dyaw / s, py = -dpitch / s; px = Math.max(-400, Math.min(400, px)) * k; py = Math.max(-300, Math.min(300, py)) * k; if (Math.abs(px) < 0.5 && Math.abs(py) < 0.5) return; await p.evaluate(([x, y]) => document.dispatchEvent(new MouseEvent('mousemove', { movementX: x, movementY: y })), [px, py]); /* 走同一個 mousemove 處理器；無頭的座標超出視窗會被夾住 */ };
const buy = async names => { await p.keyboard.press('KeyB'); await p.waitForTimeout(400); for (const n of names) { const ok = await p.evaluate(n => { const b = [...document.querySelectorAll('.it')].find(x => x.querySelector('.nm span')?.textContent === n && !x.disabled); if (!b) return false; b.click(); return true; }, n); log.push(`${T()} 購買 ${n} ${ok ? 'OK' : '買不到'}`); await p.waitForTimeout(250); } await shot('buymenu'); await p.keyboard.press('KeyB'); await p.waitForTimeout(300); await p.evaluate(() => { __ol.input.locked = true; __ol.G.paused = false; }); };
const keysDown = new Set(); const key = async (k, on) => { if (on && !keysDown.has(k)) { keysDown.add(k); await p.keyboard.down(k); } else if (!on && keysDown.has(k)) { keysDown.delete(k); await p.keyboard.up(k); } };
let seen = false, firing = false, planting = false, lastPos = 0, prevPos = ''; const setFire = async on => { if (on && !firing) { firing = true; await p.mouse.down(); } else if (!on && firing) { firing = false; await p.mouse.up(); } };
let lastRound = 0, lastShot = 0, wasAlive = true, lastFeed = '', specClicks = 0;
while (true) {
  const s = await p.evaluate(() => {
    const G = __ol.G, m = G.me, you = __ol.you; if (!m) return null;
    let best = null, bd = 1e9;
    for (const a of G.agents) { if (!a.alive || a.team === m.team) continue; const dx = a.x - m.x, dz = a.z - m.z, d = Math.hypot(dx, dz); if (d > 45) continue;
      const ey = m.y + (m.eye || 1.6); if (!__ol.los(m.x, ey, m.z, a.x, a.y + 1.35, a.z)) continue;
      const yaw = Math.atan2(dx, dz); let dy = yaw - you.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); if (Math.abs(dy) > 1.6) continue; if (d < bd) { bd = d; best = { d, dyaw: dy, dpitch: Math.atan2(a.y + 1.35 - ey, d) - you.pitch, name: a.name }; } }
    const tag = m.team === 0 ? 'site-A' : 'site-A', st = __ol.navStep(m.x, m.y, m.z, tag), S = __ol.LAYOUT.sites.A, inS = m.x >= S.x0 && m.x <= S.x1 && m.z >= S.z0 && m.z <= S.z1 && Math.abs(m.y - S.y) < 1.5;
    const fol = st && !inS ? { d: Math.hypot(st.x - m.x, st.z - m.z), dyaw: Math.atan2(Math.sin(Math.atan2(st.x - m.x, st.z - m.z) - you.yaw), Math.cos(Math.atan2(st.x - m.x, st.z - m.z) - you.yaw)) } : null;
    const plant = inS && m.hasCharge && G.phase === 'live', pos = [m.x.toFixed(1), m.z.toFixed(1)].join(',');
    return { reload: +(m.reloadT || 0).toFixed(2), zone: G.zone, phase: G.phase, round: G.round, score: G.score.join(':'), alive: m.alive, hp: m.hp, cur: m.cur, ammo: m.ammo[m.cur], rsv: m.rsv?.[m.cur], money: m.money, best, fol, plant, inS, pos, feed: [...document.querySelectorAll('#feed > *')].map(e => e.textContent).join(' | '), spec: G.agents[G.specIdx]?.name, banner: document.getElementById('banner')?.textContent || '', over: G.phase === 'over' };
  });
  if (!s) break;
  if (s.feed !== lastFeed) { lastFeed = s.feed; log.push(`${T()} 擊殺列：${s.feed}`); }
  if (s.round !== lastRound) {
    lastRound = s.round; await key('KeyW', false); await setFire(false); log.push(`${T()} === 回合 ${s.round} 比分 ${s.score} 錢 ${s.money} 階段 ${s.phase}`);
    if (s.round > ROUNDS || s.over) break;
    await p.waitForTimeout(300);
    if (s.money >= 2700) await buy(['V11 衝鋒槍', '防彈衣＋頭盔', '煙霧彈']); else if (s.money >= 1000) await buy(['防彈衣']); else await buy([]);
  }
  if (s.over) break;
  if (s.alive && !wasAlive) log.push(`${T()} 復活`);
  if (!s.alive && wasAlive) { log.push(`${T()} 陣亡 hp=${s.hp}`); await key('KeyW', false); await setFire(false); await p.waitForTimeout(300); await shot('death'); await p.waitForTimeout(2500); await shot('spectate'); }
  wasAlive = s.alive;
  if (!s.alive) { if (specClicks < 2 && s.spec) { specClicks++; await p.mouse.click(mx, my); await p.waitForTimeout(800); log.push(`${T()} 觀戰換人 → ${await p.evaluate(() => __ol.G.agents[__ol.G.specIdx]?.name)}`); await shot('spec_next'); } else await p.waitForTimeout(300); continue; }
  specClicks = 0;
  if (s.phase === 'live' || s.phase === 'planted') {
    if (s.best) {
      if (!seen) { seen = true; log.push(`${T()} 看到 ${s.best.name} ${s.best.d.toFixed(1)} m 偏 ${s.best.dyaw.toFixed(2)}`); }
      await key('KeyW', false); await turn(s.best.dyaw, s.best.dpitch, 0.8);
      const on = Math.abs(s.best.dyaw) < 0.05 && Math.abs(s.best.dpitch) < 0.06; await setFire(on);
      if (on && Date.now() - lastShot > 6000) { lastShot = Date.now(); log.push(`${T()} 交火 ${s.best.name} ${s.best.d.toFixed(1)} m hp=${s.hp} ${s.cur} ${s.ammo}/${s.rsv} 換彈${s.reload} 區域${s.zone}`); await shot('fight'); }
    } else {
      seen = false; await setFire(false);
      if (s.ammo === 0 && s.rsv > 0) await p.keyboard.press('KeyR');
      if (s.plant) { await key('KeyW', false); await key('KeyE', true); if (!planting) { planting = true; log.push(`${T()} 開始安裝 ${s.pos}`); await p.waitForTimeout(1500); await shot('plant'); } }
      else { await key('KeyE', false); planting = false; if (s.fol) { await turn(s.fol.dyaw, -0.0, 0.6); await key('KeyW', Math.abs(s.fol.dyaw) < 0.9); } else await key('KeyW', false); }
      if (Date.now() - lastPos > 3000) { lastPos = Date.now(); if (s.pos === prevPos && !s.inS) log.push(`${T()} 卡住？${s.pos} fol=${JSON.stringify(s.fol)} best=${!!s.best} ph=${s.phase} locked=${await p.evaluate(() => __ol.input.locked + "/" + __ol.G.paused)}`); prevPos = s.pos; }
    }
  } else { await key('KeyW', false); await setFire(false); }
  if (Date.now() - lastShot > 15000 && s.alive && s.phase === 'live') { lastShot = Date.now(); await shot('walk'); }
  await p.waitForTimeout(40);
  if (Date.now() - t0 > +(process.env.TMAX || 420000)) { log.push('逾時'); break; }
}
console.log(log.join('\n')); console.log('錯誤', errs.slice(0, 8)); await b.close(); await srv.close();
