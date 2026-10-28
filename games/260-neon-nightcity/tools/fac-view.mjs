// 程式立面截圖：挑幾塊不同風格的程式立面地塊，站到對街看正面（白天與夜晚各一張）
// node tools/fac-view.mjs [輸出資料夾] ；FAC="style:序,..." 指定地塊（預設每種風格各挑一塊）
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../..');
const out = resolve(process.argv[2] || resolve(root, '.cache/fac-view'));
mkdirSync(out, { recursive: true });
const srv = createServer((q, s) => {
  const f = resolve(repo, '.' + decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(repo + sep) || !existsSync(f) || !statSync(f).isFile()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); s.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const { browser, page, log } = await open(`http://127.0.0.1:${srv.address().port}/web/260-neon-nightcity.html`, { w: 1280, h: 800 });
try {
  // FAC_D=0 關掉細模（只看遠景的平牆與視差洞口）
  await page.evaluate((d) => { try { localStorage.removeItem('nc260.motors'); } catch (e) {} window.__nc.start(); window.__nc.menu.set('blur', 0); if (d !== '') window.__nc.menu.set('fac', +d); }, process.env.FAC_D ?? '');
  await page.waitForTimeout(4000);
  const picks = await page.evaluate((spec) => {
    const nc = window.__nc, ok = L => !L.glb && !L.ghost && !L.back && L.b && !L.b.outer && !L.special && L.x1 - L.x0 > 8 && L.z1 - L.z0 > 8;
    for (const id of ['hud', 'touch', 'toast', 'prompt', 'marker']) { const el = document.getElementById(id); if (el) el.style.visibility = 'hidden'; }
    // 種類：bay（凸窗）、bal（陽台）、notch（退角塔樓）、arc（騎樓）、isle（天樞島）、s0..s4（樣式），後面的數字是第幾塊
    const want = (spec || 'bay:0,bay:7,bal:0,bal:5,notch:0,notch:3,s2:4,s3:9,s0:12,s1:6').split(',').map(s => s.split(':'));
    const res = [];
    const has = { any: () => true, isle: L => !L.tiers || L.h < 40, arc: L => L.mass && L.mass.arc, bay: L => L.mass && L.mass.bays.length, bal: L => L.mass && L.mass.bal.length, notch: L => L.mass && L.mass.notch };
    for (const [kind, k] of want) {
      const f = has[kind] || (L => L.style === +kind.slice(1) && L.h < 60);
      const c = nc.city.lots.filter(L => ok(L) && !L.isle === (kind !== 'isle') && f(L)); const L = c[Math.min(+k, c.length - 1)]; if (!L) continue;
      res.push({ i: nc.city.lots.indexOf(L), st: kind, h: +L.h.toFixed(1), rk: L.rk ? L.rk.kind : null, w: +(L.axis === 'z' ? L.x1 - L.x0 : L.z1 - L.z0).toFixed(1) });
    }
    return res;
  }, process.env.FAC || '');
  console.log(JSON.stringify(picks));
  for (const p of picks) for (const [tag, min] of [['day', 14 * 60], ['night', 23 * 60], ['eye', 16 * 60]]) {
    await page.evaluate(([i, min, tag]) => {
      const nc = window.__nc, L = nc.city.lots[i];
      nc.time(min); nc.weather('clear', true);
      const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
      const [nx, nz] = L.axis === 'z' ? [0, L.face] : [L.face, 0];
      const hw = (L.axis === 'z' ? L.z1 - L.z0 : L.x1 - L.x0) / 2;
      const px = cx + nx * (hw + 15), pz = cz + nz * (hw + 15);
      const yaw = Math.atan2(-nx, -nz);
      nc.walk(); nc.tpL(px, pz, yaw);
      // 斜角看正面：相機在對街、往沿街方向偏一點，抬高到 1/3 樓高
      const [tx, tz] = L.axis === 'z' ? [1, 0] : [0, 1], off = (L.axis === 'z' ? L.x1 - L.x0 : L.z1 - L.z0) * .8 + 12;
      const D = hw + 13;
      const c = nc.W(cx + nx * D + tx * off, cz + nz * D + tz * off), t = nc.W(cx + nx * hw, cz + nz * hw);
      const M = L.mass;
      if (M && M.notch && tag !== 'eye') {   // 退角的塔樓：對著退進去的那個角斜看
        const i = M.nk.indexOf(1), C = [[L.x1, L.z1], [L.x1, L.z0], [L.x0, L.z0], [L.x0, L.z1]][i], sx = C[0] > cx ? 1 : -1, sz = C[1] > cz ? 1 : -1;
        const e = nc.W(C[0] + sx * 22, C[1] + sz * 22), t3 = nc.W(C[0], C[1]);
        nc.camAt(e[0], 16, e[1], t3[0], M.yp + 12, t3[1]);
      } else if (tag === 'eye') {   // 走在對面人行道上抬頭看：離牆 12 m、偏一個開間，眼高 1.7 m
        const e = nc.W(cx + nx * (hw + 12) + tx * 4, cz + nz * (hw + 12) + tz * 4), t2 = nc.W(cx + nx * hw - tx * 2, cz + nz * hw - tz * 2);
        nc.camAt(e[0], 1.7, e[1], t2[0], Math.min(L.h * .55, 14), t2[1]);
      } else nc.camAt(c[0], 3 + L.h * .42, c[1], t[0], L.h * .48, t[1]);
    }, [p.i, min, tag]);
    await page.waitForTimeout(500);
    await raf(page); await page.waitForTimeout(400); await raf(page);
    const st = await page.evaluate(() => window.__nc.fac.sync());
    if (p === picks[0] && tag === 'day') console.log('fac', JSON.stringify(st));
    await page.waitForTimeout(1500);
    await raf(page);
    await page.screenshot({ path: `${out}/${p.st}-${p.i}-${tag}.png` });
    if (tag === 'eye') await page.evaluate(() => window.__nc.camAt());
  }
  console.log('errors', log.errors.slice(0, 5), log.pageerrors.slice(0, 5));
} finally { await browser.close(); srv.close(); }
