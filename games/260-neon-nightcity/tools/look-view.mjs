// 質感比對截圖：固定的機位（雨夜 LAZARUS、夜裡的窄街、清晨的大道、下雨的白天、白天的高架橋下、白天的路面、路緣的垃圾堆、立面外掛物、路人近景），每個機位依序套用幾組選單設定各拍一張
// node tools/look-view.mjs [輸出資料夾]；VARS="ao=0;ao=1"（分號隔開每組，逗號隔開同一組的多個設定；post.x=v 改 __nc.post 的欄位）、ONLY="club,ped" 只拍這幾個機位、Q="&gfx=webgpu" 加網址參數、PAGE=web/ 底下的另一個檔名（和舊版比）、EVAL="運算式" 開場後印出結果
// 以本機 HTTP 開頁（照片材質、實體建築與車才會下載）；固定 gpu=high，動態模糊關掉。輸出 <機位>-<組>.png，再用 ffmpeg 併成左右對照的 <機位>.png
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../..');
const out = resolve(process.argv[2] || resolve(root, '.cache/look'));
mkdirSync(out, { recursive: true });
const vars = (process.env.VARS || '').split(';').map(g => g.split(',').filter(Boolean).map(kv => { const [k, v] = kv.split('='); return [k, v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v]; }));
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;

// 每個機位：時間（分鐘）、天氣、雨量，以及在頁面裡算相機的函式（邏輯座標換世界，回傳 [眼 x, y, z, 目標 x, y, z]）
const STATIONS = {
  club: { time: 23 * 60 + 30, wx: 'rain', rain: .85, cam: nc => { const d = nc.spots.clubDoor; nc.walk(); nc.tpL(d.x + 12, d.z + 6); const e = nc.W(d.x + 15, d.z + 9), t = nc.W(d.x - 2, d.z + 1); return [e[0], 1.7, e[1], t[0], 2.2, t[1]]; } },
  alley: { time: 60, wx: 'clear', cam: nc => sideWalk(nc, 210, 1, 1.2, 1.5) },
  dawn: { time: 6 * 60 + 30, wx: 'clear', cam: nc => sideWalk(nc, 480, 1, 5, 1.7) },
  wetday: { time: 13 * 60, wx: 'rain', rain: .7, cam: nc => { const c = sideWalk(nc, 30, 1, 2.5, 1.7); c[4] = 6; return c; } },   // 下雨的白天：立面的水漬與濕牆
  viaduct: { time: 14 * 60, wx: 'clear', cam: nc => {
    // 快速道路離地 7–12 m、兩側 30 m 內都是陸地的一點：站在橋旁 10 m，看橋下
    for (const e of nc.roads.edges) {
      if (!e.fwy || !e.fwy.h) continue;
      for (let k = 2; k < e.pts.length - 2; k += 2) {
        const h = e.fwy.h(e.a0 + e.cum[k]); if (h < 7 || h > 12) continue;
        const [x, z] = e.pts[k], [x1, z1] = e.pts[k + 1], L = Math.hypot(x1 - x, z1 - z) || 1, nx = -(z1 - z) / L, nz = (x1 - x) / L;
        const ex = x + nx * 10, ez = z + nz * 10;
        if (nc.deckAt ? nc.deckAt(ex, ez) > .5 : false) continue;
        nc.walk(); nc.tp(ex, ez);
        return [ex, 1.6, ez, x - nx * 6 + (x1 - x) / L * 8, 3.5, z - nz * 6 + (z1 - z) / L * 8];
      }
    }
    return null;
  } },
  road: { time: 11 * 60, wx: 'clear', cam: nc => {
    // 白天的一般道路（不是快速道路）：站在車道上 2.2 m 高、看前方 12 m 的路面（路面貼花、輪跡、人孔蓋）
    const e = nc.roads.edges.filter(e => !e.fwy && e.pts.length > 6)[40], k = Math.floor(e.pts.length / 2);
    const [x, z] = e.pts[k], [x1, z1] = e.pts[k + 1], L = Math.hypot(x1 - x, z1 - z) || 1, dx = (x1 - x) / L, dz = (z1 - z) / L;
    nc.walk(); nc.tp(x - dz * 3, z + dx * 3);
    return [x - dz * 3, 2.2, z + dx * 3, x - dz * 3 + dx * 12, 0, z + dx * 3 + dz * 12];
  } },
  trash: { time: 16 * 60, wx: 'clear', cam: nc => {
    // 路緣的垃圾袋堆（20-props.js 的 clutter）：找袋子最密的一堆，站在人行道上 3 m 外、略高看下去
    const B = nc.props.clutter.bag; let best = null, bn = 0;
    for (let i = 0; i < B.length; i += 3) { const n = B.filter(b => Math.hypot(b.x - B[i].x, b.z - B[i].z) < 2).length; if (n > bn) { bn = n; best = B[i]; } }
    nc.walk(); nc.tpL(best.x + 4, best.z + 4);
    const e = nc.W(best.x + 2.6, best.z + 1.6), t = nc.W(best.x, best.z);
    return [e[0], 1.6, e[1], t[0], .4, t[1]];
  } },
  wall: { time: 15 * 60, wx: 'clear', cam: nc => {
    // 立面外掛物（20-props.js 的落水管與室外機）：找一台離落水管不遠、二到四樓的室外機，站在它前方 7 m、抬頭看
    const A = nc.props.wallAcs.flat(), D = nc.props.downpipes;
    const a = A.find(a => a.y < 14 && D.some(d => Math.hypot(d.x - a.x, d.z - a.z) < 8)) || A[0];
    const ox = Math.sin(a.ry), oz = Math.cos(a.ry);
    nc.walk(); nc.tpL(a.x + ox * 7, a.z + oz * 7);
    const e = nc.W(a.x + ox * 7 + oz * 2, a.z + oz * 7 - ox * 2), t = nc.W(a.x, a.z);
    return [e[0], 1.7, e[1], t[0], a.y + .5, t[1]];
  } },
  weeds: { time: 10 * 60, wx: 'clear', cam: nc => {
    // 市區植被（20-props.js 的 weeds）：找牆腳草最多的一般樓房，沿牆低角度看
    const G = nc.props.weeds.grass, lots = nc.city.lots; let bi = -1, bn = 0;
    for (let i = 0; i < lots.length; i++) {
      const L = lots[i]; if (L.ghost || L.glb || L.special) continue;
      const fx = L.axis === 'z' ? null : (L.face > 0 ? L.x1 : L.x0), fz = L.axis === 'z' ? (L.face > 0 ? L.z1 : L.z0) : null;
      let n = 0;
      for (const g of G) if (fz != null ? Math.abs(g.z - fz) < .3 && g.x > L.x0 && g.x < L.x1 : Math.abs(g.x - fx) < .3 && g.z > L.z0 && g.z < L.z1) n++;
      if (n > bn) { bn = n; bi = i; }
    }
    return bi < 0 ? null : sideWalk(nc, bi, 1, 1.4, .9);
  } },
  blob: { time: 21 * 60, wx: 'clear', cam: nc => {
    // 路燈下的暗塊（20-props.js 的 lampBlobs，世界座標）：挑一片拉得最長的，從側面 5 m 看
    const B = nc.props.lampBlobs; let b = B[0];
    for (const o of B) if (o.sz > b.sz && o.sz < 3) b = o;
    const [lx, lz] = nc.L(b.x, b.z), [ex, ez] = nc.W(lx, lz).map((v, i) => v + (i ? -Math.sin(b.ry) : Math.cos(b.ry)) * 5);
    const [px, pz] = nc.L(ex + (ex - b.x), ez + (ez - b.z)); nc.walk(); nc.tpL(px, pz);
    return [ex, 1.7, ez, b.x, 0, b.z];
  } },
  ped: { time: 20 * 60, wx: 'clear', cam: nc => {
    // 夜店門口的保鑣（站著不動）：斜前方 2.4 m、胸口高度
    const b = nc.spots.bouncer, d = nc.spots.clubDoor; nc.walk(); nc.tpL(d.x + 6, d.z + 5);
    const P = nc.W(b.x, b.z), E = nc.W(b.x + 1.2, b.z + 2.2);
    return [E[0], 1.55, E[1], P[0], 1.35, P[1]];
  } },
};
STATIONS.pedday = { ...STATIONS.ped, time: 15 * 60 };   // 同一個保鑣，白天（人物著色對照日光）
STATIONS.pedface = { ...STATIONS.ped, cam: nc => { const b = nc.spots.bouncer, d = nc.spots.clubDoor; nc.walk(); nc.tpL(d.x + 6, d.z + 5); const P = nc.W(b.x, b.z), E = nc.W(b.x + .45, b.z + .9); return [E[0], 1.72, E[1], P[0], 1.66, P[1]]; } };   // 臉的特寫（夜）
// 濕地面的三層（10-city.js 的 wetSurface）：雨夜的高架橋下（橋面底下要乾）、路緣的排水溝（積水只在低的地方）、實體建築的雨棚下、從上面看一個路口（VARS="U.uWetDbg=1" 換成分層的顏色量比例）
STATIONS.wetvia = { ...STATIONS.viaduct, time: 22 * 60, wx: 'rain', rain: .8 };
STATIONS.wetroad = { time: 22 * 60, wx: 'rain', rain: .8, cam: nc => {
  const e = nc.roads.edges.filter(e => !e.fwy && e.pts.length > 6)[40], k = Math.floor(e.pts.length / 2);
  const [x, z] = e.pts[k], [x1, z1] = e.pts[k + 1], L = Math.hypot(x1 - x, z1 - z) || 1, dx = (x1 - x) / L, dz = (z1 - z) / L;
  nc.walk(); nc.tp(x - dz * 10, z + dx * 10);
  return [x - dz * 9.6, 1.6, z + dx * 9.6, x - dz * 5 + dx * 16, 0, z + dx * 5 + dz * 16];
} };
STATIONS.wetwalk = { time: 22 * 60, wx: 'rain', rain: .8, cam: nc => { const i = nc.city.lots.findIndex(L => L.glb && !L.ghost); return i < 0 ? null : sideWalk(nc, i, 1, 2.2, 1.6); } };
STATIONS.wettop = { time: 22 * 60, wx: 'rain', rain: .8, cam: nc => {
  const e = nc.roads.edges.filter(e => !e.fwy && e.pts.length > 6)[40], [x, z] = e.pts[Math.floor(e.pts.length / 2)];
  nc.walk(); nc.tp(x + 12, z + 12);
  return [x + 1, 34, z + 1.5, x, 0, z];
} };
// 程式立面的髒污（10-city.js 的 FACADE_FS：樓板下的雨痕、低樓層較髒、修補、剝漆、撕掉的海報、返潮的鹽霜）與外掛物下的流痕（20-props.js 的 streaks）：
// 陰天下午，挑一棟有窗型冷氣、灰泥或磚牆的程式樓房，站在人行道外緣斜看二、三樓
STATIONS.grime = { time: 16 * 60, wx: 'cloudy', cam: nc => {
  const A = nc.props.streaks || [], lots = nc.city.lots;
  const i = lots.findIndex(L => !L.ghost && !L.glb && !L.special && (L.style === 2 || L.style === 0) && L.h > 14 && A.filter(a => Math.abs(a.x - (L.x0 + L.x1) / 2) < 14 && Math.abs(a.z - (L.z0 + L.z1) / 2) < 14).length > 3);
  if (i < 0) return null;
  const L = lots[i], cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, [nx, nz] = L.axis === 'z' ? [0, L.face] : [L.face, 0], hw = (L.axis === 'z' ? L.z1 - L.z0 : L.x1 - L.x0) / 2;
  const fx = cx + nx * hw, fz = cz + nz * hw; nc.walk(); nc.tpL(fx + nx * 11, fz + nz * 11);
  const e = nc.W(fx + nx * 10 + nz * 3, fz + nz * 10 - nx * 3), t = nc.W(fx, fz); return [e[0], 1.7, e[1], t[0], 7.5, t[1]];
} };
// 雲梯城寨（28-enclave.js）的中庭：加蓋的鐵皮、遮雨棚與晾衣（note.com 那篇的「增建的箱子看起來像玩具」），陰天下午與雨夜
STATIONS.enclave = { time: 15 * 60, wx: 'cloudy', cam: nc => {
  const E = nc.enc; if (!E) return null;
  const c = E.S.lots[0].court, [ex, ez] = E.W(c.x0 + 2, c.z0 + 2), [tx, tz] = E.W(c.x1, c.z1), g = E.ground(ex, ez) || 0;
  nc.walk(); nc.tp(ex, ez); return [ex, g + 1.7, ez, tx, g + 10, tz];
} };
STATIONS.enclaveN = { ...STATIONS.enclave, time: 22 * 60, wx: 'rain', rain: .8 };
// 窗型冷氣底下的流痕（20-props.js 的 streaks）：挑一台三樓以下的，站在 6 m 外看
STATIONS.acstreak = { time: 15 * 60, wx: 'cloudy', cam: nc => {
  const a = (nc.props.streaks || []).find(a => a.y > 6 && a.y < 11 && a.sy > 1.2); if (!a) return null;
  const ox = Math.sin(a.ry), oz = Math.cos(a.ry); nc.walk(); nc.tpL(a.x + ox * 7, a.z + oz * 7);
  const e = nc.W(a.x + ox * 6 + oz * 1.5, a.z + oz * 6 - ox * 1.5), t = nc.W(a.x, a.z); return [e[0], 1.7, e[1], t[0], a.y - .6, t[1]];
} };
// 灰泥牆（style 2）的剝漆、重新上漆、撕掉的海報、返潮鹽霜：正對一棟的立面，近看一樓上下（stucco）與二、三樓（stucco2）
const stuccoCam = ty => new Function(`return nc => {
  const lots = nc.city.lots, i = lots.findIndex(L => !L.ghost && !L.glb && !L.special && L.style === 2 && L.h > 12); if (i < 0) return null;
  const L = lots[i], cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, [nx, nz] = L.axis === 'z' ? [0, L.face] : [L.face, 0], hw = (L.axis === 'z' ? L.z1 - L.z0 : L.x1 - L.x0) / 2;
  const fx = cx + nx * hw, fz = cz + nz * hw; nc.walk(); nc.tpL(fx + nx * 8, fz + nz * 8);
  const e = nc.W(fx + nx * 4.5 + nz * 1.5, fz + nz * 4.5 - nx * 1.5), t = nc.W(fx, fz); return [e[0], 1.6, e[1], t[0], ${ty}, t[1]];
}`)();   // 機位函式是用 toString 送進頁面的，閉包裡的 ty 會不見，所以把數字寫進原始碼
STATIONS.stucco = { time: 15 * 60, wx: 'cloudy', cam: stuccoCam(1.6) };
STATIONS.stucco2 = { time: 15 * 60, wx: 'cloudy', cam: stuccoCam(7) };
// 轉角樓的側面一樓（沒有店面）：撕掉的海報、牆腳返潮與鹽霜、轉角磨損（10-city.js 的 FACADE_FS）
STATIONS.sidewall = { time: 15 * 60, wx: 'cloudy', cam: nc => {
  const L = nc.city.lots.find(L => !L.ghost && !L.glb && !L.special && L.b && L.axis === 'z' && [0, 1, 2].includes(L.style) && L.h > 9 && Math.abs(L.x0 - (L.b.x0 + 4.5)) < .5 && L.z1 - L.z0 > 12);
  if (!L) return null;
  const cz = (L.z0 + L.z1) / 2; nc.walk(); nc.tpL(L.x0 - 3.6, cz + 3);
  const e = nc.W(L.x0 - 3.4, cz + 2.5), t = nc.W(L.x0, cz - 1); return [e[0], 1.6, e[1], t[0], 1.3, t[1]];
} };
STATIONS.viadN = { ...STATIONS.viaduct, time: 22 * 60, wx: 'clear' };   // 高架橋底的暖光（20-props.js 的 LAMP_HEADS t = 2）
function sideWalk(nc, i, side, off, y) {
  // 人行道上離牆 off 公尺、沿街看 20 m 外（稍微偏向牆）：牆腳、店面與地面的交界都在畫面裡
  const L = nc.city.lots[i];
  const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, [nx, nz] = L.axis === 'z' ? [0, L.face] : [L.face, 0], [tx, tz] = [nz, -nx];
  const hw = (L.axis === 'z' ? L.z1 - L.z0 : L.x1 - L.x0) / 2;
  const px = cx + nx * (hw + off), pz = cz + nz * (hw + off);
  nc.walk(); nc.tpL(px - tx * side * 30, pz - tz * side * 30);
  const e = nc.W(px, pz), t = nc.W(px + tx * side * 20 - nx * off * .5, pz + tz * side * 20 - nz * off * .5);
  return [e[0], y, e[1], t[0], y - .3, t[1]];
}

const srv = createServer((q, s) => {
  const f = resolve(repo, '.' + decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(repo + sep) || !existsSync(f) || !statSync(f).isFile()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); s.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const { browser, page, log } = await open(`http://127.0.0.1:${srv.address().port}/web/${process.env.PAGE || '260-neon-nightcity.html'}` + (process.env.Q ? '?' + process.env.Q.replace(/^[?&]/, '') : ''), { w: 1280, h: 800 });
try {
  await page.evaluate(() => { try { localStorage.removeItem('nc260.motors'); } catch (e) {} window.__nc.start(); window.__nc.menu.set('blur', 0); });
  await page.waitForTimeout(4000);
  if (process.env.EVAL) console.log('eval', JSON.stringify(await page.evaluate(e => (0, eval)(e), process.env.EVAL)));
  for (const [name, S] of Object.entries(STATIONS)) {
    if (only && !only.includes(name)) continue;
    const ok = await page.evaluate(([S, cam, sw]) => {
      const nc = window.__nc;
      for (const id of ['hud', 'touch', 'toast', 'prompt', 'marker']) { const el = document.getElementById(id); if (el) el.style.visibility = 'hidden'; }
      nc.time(S.time); nc.weather(S.wx, true); if (S.rain) nc.rain(S.rain);
      const sideWalk = new Function('return ' + sw)();
      const c = new Function('nc', 'sideWalk', 'return (' + cam + ')(nc)')(nc, sideWalk);
      if (!c) return false;
      nc.camAt(...c); return true;
    }, [{ time: S.time, wx: S.wx, rain: S.rain }, S.cam.toString(), sideWalk.toString()]);
    if (!ok) { console.log(name, '找不到機位'); continue; }
    await page.waitForTimeout(800); await raf(page);
    await page.evaluate(() => window.__nc.fac && window.__nc.fac.sync && window.__nc.fac.sync());
    await page.waitForTimeout(2500);
    const shots = [];
    for (let g = 0; g < Math.max(1, vars.length); g++) {
      await page.evaluate(t => window.__nc.time(t), S.time);   // 時間照樣在走：每張都拉回同一刻，光線才比得起來
      if (vars[g]) await page.evaluate(kv => { for (const [k, v] of kv) if (k.startsWith('post.')) window.__nc.post[k.slice(5)] = v; else if (k.startsWith('U.')) window.__nc.U[k.slice(2)].value = v; else window.__nc.menu.set(k, v); }, vars[g]);
      await page.waitForTimeout(400); await raf(page);
      const f = `${out}/${name}-${g}.png`; await page.screenshot({ path: f }); shots.push(f);
    }
    if (shots.length > 1) execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...shots.flatMap(f => ['-i', f]), '-filter_complex', `hstack=inputs=${shots.length}`, `${out}/${name}.png`]);
    console.log(name, 'ok');
  }
  console.log('errors', log.errors.slice(0, 5), log.pageerrors.slice(0, 5));
  if (/gfx=webgpu/.test(process.env.Q || '')) console.log('gfx', JSON.stringify(await page.evaluate(() => { const g = window.__nc.gfx; return { miss: g.miss && g.miss(), err: g.err && g.err() }; })).slice(0, 600));
} finally { await browser.close(); srv.close(); }
