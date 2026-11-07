// 武器平衡實算：真的走 weapons.js 的 fire()，打真實骨架膠囊，寫 dist/balance.md。全部是遊戲實算，不是公式推的。
//   node tools/balance.mjs [--page=dist/x.html] [--trials=200] [--only=range,bots] [--matches=4] [--speed=4]
// range  站定瞄胸口（或頭）開到死，量發數與擊殺時間，再比較有沒有武器被完全取代。bare／armor／head／headA 假設完全壓住後座（每發都回到第 0 發），spray 不壓槍（有甲胸口）
// bots   玩家站在炸點不動：開始受傷到陣亡多久、Bot 命中率；整場比賽走 speed()，命中體才是真的
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { startServer, launch, GAME_DIR, REPO_ROOT } from './lib/serve.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const PAGE = arg('page', ''), TRIALS = +arg('trials', 200), ONLY = arg('only', 'range,bots').split(','), MATCHES = +arg('matches', 4), SPEED = +arg('speed', 4), OUT = arg('out', 'dist/balance.json');
const srv = await startServer(REPO_ROOT, PAGE ? { '/web/_bal.html': resolve(GAME_DIR, PAGE) } : {});
const URL_ = `${srv.url}/web/${PAGE ? '_bal' : '278-ochre-line'}.html?clean=1`;
const br = await launch();
const GUNS = ['knife', 'p9', 'c7', 'r50', 'v11', 'm7', 'b90', 't4', 'ks', 'ar5', 'x10', 's8', 's6', 'l40', 'n9'];
const DIST = [1.5, 3, 6, 10, 15, 25, 40, 60, 74];

async function range() {
  const p = await br.newPage({ viewport: { width: 640, height: 360 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(URL_); await p.waitForFunction(() => window.__ol?.ready, null, { timeout: 120000 });
  const res = await p.evaluate(async ({ GUNS, DIST, TRIALS }) => {
    const O = __ol, G = O.G, W = O.weapons, wait = ms => new Promise(f => setTimeout(f, ms));
    O.startMatch({ side: 'def' }); O.setClean(true); G.time = 0.05; while (G.phase === 'buy') await wait(30); await wait(300);
    const m = G.me, e = G.agents.find(a => a.alive && a.team !== m.team);
    for (const a of G.agents) if (a !== m && a !== e) a.alive = false;   // 其他人不要擋路
    // 找最長的空巷：沿導航節點試八個方向，站姿眼高與胸高都要看得穿
    const N = O.LAYOUT.nav.nodes; let lane = null;
    for (const L of [76, 68, 62, 56, 52, 48, 46]) { for (const n of N) { for (let k = 0; k < 32 && !lane; k++) { const th = k * Math.PI / 16, sx = Math.sin(th), cz = Math.cos(th), ok = [0.5, 1.0, 1.4, 1.7].every(h => O.los(n.x, n.y + h, n.z, n.x + sx * L, n.y + h, n.z + cz * L)); if (ok) lane = { x: n.x, y: n.y, z: n.z, th, sx, cz, L }; } if (lane) break; } if (lane) break; }
    if (!lane) return { err: '找不到 62 m 空巷' };
    G.paused = true; m.hp = 1e6; m.scoped = true; m.ground = true; m.vx = m.vz = 0; m.crouch = false;
    const place = async d => { e.x = e.px = e.rx = lane.x + lane.sx * d; e.y = e.py = e.ry = lane.y; e.z = e.pz = e.rz = lane.z + lane.cz * d; e.vx = e.vz = 0; e.yaw = lane.th + Math.PI; e.crouch = false; await wait(180); };
    m.x = m.px = lane.x; m.y = m.py = lane.y; m.z = m.pz = lane.z; m.eye = 1.7; m.yaw = lane.th;
    const row = {};
    for (const id of GUNS) {
      const w = W[id]; row[id] = {}; m.cur = id; if (w.slot === 1) m.primary = id; else if (w.slot === 2) m.secondary = id;
      m.ammo[id] = 1e6; const gap = 60 / w.rpm;
      for (const d of DIST) {
        if (d > (w.range ?? 0) + 0.5 || d > lane.L - 2 || (d < 3 && id !== 'knife')) continue;   // 1.5 m 只給刀：貼臉時瞄胸口的俯角會穿過膠囊之間的縫
        await place(d); const s = e.soldier; if (!s) return { err: 'e 沒有士兵' };
        const headY = () => (s.caps[1] + s.caps[4]) / 2;   // 第 0 個膠囊是頭
        for (const [tag, armor, helmet, aim, comp] of [['bare', 0, false, 'chest', 1], ['armor', 100, true, 'chest', 1], ['head', 0, false, 'head', 1], ['headA', 100, true, 'head', 1], ['spray', 100, true, 'chest', 0]]) {
          let shots = 0, one = 0, fail = 0; const list = [];
          for (let t = 0; t < TRIALS; t++) {
            e.hp = 1e6; e.armor = armor; e.helmet = helmet; m.burst = 0; m.fireT = 0; m.reloadT = 0; let n = 0, lim = Math.min(w.mag || 12, 200), dead = false;
            const ty = aim === 'head' ? headY() : e.y + 1.3, pitch = Math.atan2(ty - (m.y + m.eye), d), yaw = lane.th;
            while (n < lim) { m.fireT = 0; if (!O.shoot(yaw, pitch)) break; n++; if (comp || gap >= 0.32) m.burst = 0; if (1e6 - e.hp >= 100) { dead = true; break; } }
            if (dead) { shots += n; list.push(n); if (n === 1) one++; } else fail++;
          }
          list.sort((a, b) => a - b);
          row[id][`${tag}@${d}`] = { kill: list.length / TRIALS, one: one / TRIALS, mean: list.length ? shots / list.length : null, med: list.length ? list[list.length >> 1] : null, p90: list.length ? list[(list.length * 0.9) | 0] : null };
        }
      }
    }
    return { lane, row };
  }, { GUNS, DIST, TRIALS });
  await p.close(); return { ...res, errs };
}

// mode=stand：玩家穿甲站在炸點不動，量陣亡時間，比賽本身是 4 對 5，勝率不代表攻守平衡
// mode=fair：玩家當觀眾、對面少一隻，4 對 4 量攻守勝率
async function bots() {
  const one = async (mode, side, k) => {
    const p = await br.newPage({ viewport: { width: 480, height: 270 } }); const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.goto(URL_); await p.waitForFunction(() => window.__ol?.ready, null, { timeout: 300000 });
    const r = await p.evaluate(async ({ mode, side, speed, maxWall, maxDeaths }) => {
      const O = __ol, G = O.G, wait = ms => new Promise(f => setTimeout(f, ms));
      O.startMatch({ side }); O.setClean(true); O.speed(speed);
      const m = G.me, S = O.LAYOUT.sites, out = { rounds: [], plants: [] }, wall0 = performance.now(), f0 = O.ctx.engine.frameId;
      let round = -1, t0 = -1, first = -1, sight = -1, dead = false, simT = 0, last = wall0, set = false, hp0 = 0, planted = false;
      const site = k => { const s = S[k]; return { x: (s.x0 + s.x1) / 2, y: s.y, z: (s.z0 + s.z1) / 2 }; };
      while (G.phase !== 'over' && performance.now() - wall0 < maxWall && out.rounds.length < maxDeaths) {
        await wait(16);
        const n = performance.now(); simT += ((n - last) / 1000) * speed; last = n;
        if (G.phase === 'buy' && G.round !== round) {
          round = G.round; first = sight = t0 = -1; dead = set = false;
          if (mode === 'stand') { m.armor = 100; m.helmet = true; const s = site(round % 2 ? 'A' : 'B'); O.teleport(s.x, s.y, s.z, (round * 77) % 360, 0); }
          if (m.hasCharge) { m.hasCharge = false; const a = G.agents.find(a => a.bot && a.team === m.team); a.hasCharge = true; }
        }
        if ((G.phase === 'live' || G.phase === 'planted') && !set) {
          set = true; t0 = simT; hp0 = m.hp;
          if (mode === 'fair') {
            m.alive = false; const e = G.agents.find(a => a.alive && a.team !== m.team && !a.hasCharge); e.alive = false; e.hp = 0;
            planted = false;
          }
        }
        if (mode === 'fair' && set && G.phase === 'planted' && !planted) {
          planted = true; const c = [0, 0]; for (const a of G.agents) if (a.alive) c[a.team]++;
          out.plants.push({ r: round, t: simT - t0, atk: c[0], def: c[1] });
        }
        if (mode === 'stand' && set && !dead && G.round === round) {
          if (sight < 0 && G.agents.some(a => a.bot && a.alive && a.team !== m.team && a.bot.target === m)) sight = simT;
          if (first < 0 && m.hp < hp0) first = simT;
          if (!m.alive) { dead = true; out.rounds.push({ r: round, t: simT - t0, sight: sight < 0 ? null : simT - sight, hurt: first < 0 ? null : simT - first }); }
        }
      }
      const shots = {}; for (const a of G.agents) if (a.bot) { const t = (shots[a.team] ??= { shots: 0, hits: 0, kills: 0 }); t.shots += a.shots; t.hits += a.hits; t.kills += a.kills; }
      const hist = G.history.map(h => h.winner ?? h.w), why = {}; for (const h of G.history) why[h.why] = (why[h.why] || 0) + 1;
      return { ...out, mode, side, me: m.team, score: [...G.score], winner: G.winner, nRounds: G.history.length, history: G.history.slice(), why, shots, frames: O.ctx.engine.frameId - f0, simT, wall: (performance.now() - wall0) / 1000 };
    }, { mode, side, speed: mode === 'fair' ? SPEED : Math.min(SPEED, 3), maxWall: 780000, maxDeaths: 8 });
    await p.close(); return { ...r, errs };
  };
  const jobs = []; for (let k = 0; k < MATCHES; k++) for (const side of ['atk', 'def']) for (const mode of arg('modes', 'stand,fair').split(',')) jobs.push([mode, side, k]);
  const list = [], W = +arg('par', 4); let i = 0;
  await Promise.all(Array.from({ length: W }, async () => { while (i < jobs.length) { const j = jobs[i++]; let r; try { r = await one(...j); } catch (e) { console.error(`${j} 失敗：${String(e).slice(0, 160)}`); continue; } list.push(r); writeFileSync(resolve(GAME_DIR, OUT), JSON.stringify({ bots: list, trials: TRIALS })); console.error(`${j} 完成 ${r.wall.toFixed(0)} s，${r.nRounds} 回合 ${r.score}，${(r.frames / r.wall).toFixed(0)} fps${r.errs.length ? ' 錯誤 ' + r.errs[0] : ''}`); } }));
  return list;
}

const out = {};
if (ONLY.includes('range')) { out.range = await range(); }
if (ONLY.includes('bots')) { out.bots = await bots(); }
mkdirSync(resolve(GAME_DIR, 'dist'), { recursive: true });
out.trials = TRIALS; writeFileSync(resolve(GAME_DIR, OUT), JSON.stringify(out));
await br.close(); await srv.close();
console.log('寫入', OUT);
