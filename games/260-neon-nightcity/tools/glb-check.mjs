// 實車模型驗收：以本機 HTTP 伺服器開頁（assets/260/ 要能下載），檢查 cars.json 的每台 GLB 都載入、展示廳與車庫換成實車、
// 買一台實車開上街（輪子轉動、轉向）、騎實車機車、CHROME WORKS 換色規則，並且沒有錯誤與外部請求。
//   node tools/glb-check.mjs        SHOT_DIR=… 會存截圖
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, raf } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(root, '../..');
const IDS = Object.keys(JSON.parse(readFileSync(resolve(repo, 'assets/260/cars.json'), 'utf8')));
const shotDir = process.env.SHOT_DIR ? resolve(process.env.SHOT_DIR) : null;
if (shotDir) mkdirSync(shotDir, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.json': 'application/json', '.svg': 'image/svg+xml' };
const srv = createServer((q, s) => {
  const f = resolve(repo, '.' + decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(repo + sep) || !existsSync(f) || !statSync(f).isFile()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); s.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/web/260-neon-nightcity.html`;

let failed = 0;
const check = (c, m) => { console.log(`  ${c ? '✓' : '✗'} ${m}`); if (!c) failed++; };
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { if (shotDir) { await raf(page); await page.screenshot({ path: resolve(shotDir, name + '.png') }); } };
const hideHud = page => ev(page, () => { for (const id of ['toast', 'prompt', 'marker']) { const el = document.getElementById(id); if (el) el.style.visibility = 'hidden'; } });

const { browser, page, log } = await open(url, { w: 1440, h: 900 });
try {
  await ev(page, () => { try { localStorage.removeItem('nc260.motors'); } catch (e) {} });
  await ev(page, () => window.__nc.start());
  await page.waitForTimeout(800);
  const early = await ev(page, () => window.__nc.glb.loaded.slice()), bikes = await ev(page, () => window.__nc.gta.bikes.map(b => b.id));   // bikes：68-gta.js 路邊的街頭機車（走近才建）
  check(early.every(id => id === 'ae86' || id === 'zx6r' || bikes.includes(id)), `開頁時只下載座駕與路邊機車（${early.join(', ') || '還沒下載完'}），其他進車行或車庫才下載`);
  const t0 = Date.now();
  // 真實錄音（80-audio.js，assets/260/sfx/）：http 下載解碼，連開槍後發聲數 3 s 內歸零（單發音都裁好長度，不留尾音）
  await page.waitForFunction(() => window.__nc.sfx.rec.ready, null, { timeout: 30000 });
  const sr = await ev(page, () => window.__nc.sfx.rec);
  check(sr.on && sr.one.length >= 27 && sr.loop.length >= 9 && !sr.fail.length, `錄音音效 ${sr.one.length} 種單發、${sr.loop.length} 種循環${sr.fail.length ? "，失敗 " + sr.fail.join(",") : ""}`);
  await ev(page, () => { for (let i = 0; i < 12; i++) window.__nc.sfx.gun(1, [1, 1.3, 2][i % 3]); window.__nc.sfx.boom(5); window.__nc.sfx.impact(18); });
  await page.waitForTimeout(3000);
  const sv = await ev(page, () => window.__nc.sfx.rec.voices);
  check(sv === 0, `槍聲、爆炸與撞擊 3 s 後全部結束（剩 ${sv} 個）`);
  // 每台實車依引擎型式換成那一型的真實錄音轉速層（80-audio.js 的 ENG_FAM，開到才下載）：任何轉速最多兩層出聲、權重平方和為 1、轉速越高音越高；電動車是合成馬達聲、RX-7 用通用錄音
  const engT = await ev(page, async () => {
    const N = window.__nc, out = {}; N.drive('kestrel'); const id0 = N.player.veh.carId;
    for (const [id, fam] of [['ae86', 'i4'], ['e92', 'bmw'], ['supra', 'jdm6'], ['gt3rs', 'flat6'], ['f40', 'fer8'], ['chall', 'us8'], ['svj', 'v12'], ['zx6r', 'bike4'], ['evija', null], ['rx7', null]]) {
      N.applyCar(id); N.sfx.engineOn(N.player.veh);
      for (let i = 0; i < 100 && fam && N.sfx.rec.fam !== fam; i++) await new Promise(r => setTimeout(r, 100));
      const R = N.sfx.rec, mix = fam && R.fam === fam ? Array.from({ length: 23 }, (_, k) => N.sfx.engMix(.1 + k * .04)) : null;
      // 每個轉速的目標音高：出聲層的 基頻 × 速率（沒被夾住時等於目標），要單調上升
      const pitch = mix && mix.map(m => Math.max(...m.map(([f, w, q]) => (w > .5 ? f * q : 0))));
      out[id] = { fam: R.fam, eng: R.eng, ok: !fam || (mix.every(m => m.filter(l => l[1] > 0).length <= 2 && Math.abs(m.reduce((a, l) => a + l[1] * l[1], 0) - 1) < .01) && pitch.every((p, i) => !i || p >= pitch[i - 1] - .01)), credit: !!N.sfx.engCredit(id) };
    }
    N.applyCar(id0); N.walk(); N.sfx.engineOff(); return out;
  });
  const engBad = Object.entries(engT).filter(([id, r]) => !r.ok || (id === 'evija' ? r.eng !== 'ev' : id === 'rx7' ? r.fam || r.eng !== 'rec' : !r.fam || !r.credit));
  check(!engBad.length, `引擎聲依型式換成真實錄音：${Object.entries(engT).map(([id, r]) => `${id} ${r.fam || r.eng}`).join('、')}${engBad.length ? '；不對：' + engBad.map(([id]) => id).join(',') : ''}`);
  await ev(page, () => window.__nc.loadAllGLB());
  const g = await ev(page, () => window.__nc.glb);
  check(g.on && g.loaded.length === IDS.length && !g.failed.length, `GLB 下載 ${g.loaded.length}/${IDS.length}（${((Date.now() - t0) / 1000).toFixed(1)} s）${g.failed.length ? '，失敗 ' + g.failed.join(',') : ''}`);
  // World 第四輪之二（27-props.js 檔尾）：街道設施、植物與海岸的 8 組模型、快速道路的橋墩（hwy），加上 world_1 第二批的路燈（w1_grc）與觀景解說牌（w1_board）下載好、換掉程式建模；
  // 柏油貼圖（w1_asphalt）不是模型組，下載好就開 ASPH_U
  await page.waitForFunction(() => { const w = window.__nc.props.w2; return w && Object.keys(w.sets).length + w.failed.length >= 11 && (w.swapped.includes('asphalt') || w.failed.includes('w1_asphalt')); }, null, { timeout: 60000 }).catch(() => {});
  const w2 = await ev(page, () => { const w = window.__nc.props.w2; return { sets: Object.keys(w.sets).length, failed: w.failed, swapped: w.swapped.length, has: ['lamps', 'asphalt', 'board'].filter(k => w.swapped.includes(k)), kept: w.kept(), n: w.n, board: w.board }; });
  check(w2.sets === 12 && !w2.failed.length && w2.swapped >= 16 && w2.has.length === 3 && w2.kept === 1 && w2.n.trees > 1000 && w2.n.containers > 500 && w2.n.ebox > 20 && w2.n.pump >= 4 && w2.n.lamps > 3000 && w2.n.pier > 20 && w2.n.crates >= 6 && w2.board, `world_2 模型與橋墩、田園一景 ${w2.sets}/12 組、換掉 ${w2.swapped} 類（含 ${w2.has.join('、')}）、程式建模只留遠景的樹（${w2.kept}）${JSON.stringify(w2.n)}${w2.failed.length ? '，失敗 ' + w2.failed.join(',') : ''}`);
  const grc = await ev(page, () => ['grc_sedan', 'grc_stepvan', 'grc_mailvan'].map(t => window.__nc.parked.filter(p => p.type === t).length));
  check(grc.every(n => n > 10), `gameready_city 的三台車混進路邊停車（轎車 ${grc[0]}、廂型貨車 ${grc[1]}、郵務車 ${grc[2]}）`);
  // 空氣牆（27-bldfoot.js）：模型下載好的街區照模型在人的高度的外形換掉整塊的碰撞盒；舊碼頭紅磚樓的水塔腳之間、醫院急診樓前的空地（都在原本的地塊裡）走得過去
  const foot = await ev(page, async () => {
    const N = window.__nc, out = {};
    for (const [k, lx0, lz0] of [['水塔腳之間', -124.28, -48.82], ['醫院急診樓前', 131.29, -78.5]]) {   // 邏輯座標（?zrot= 轉城時也對得上）
      const [x, z] = N.W(lx0, lz0);
      N.tp(x + 6, z + 6);
      for (let t = 0; t < 60; t++) { const [lx, lz] = N.L(x, z), e = N.props.bld.find(e => e.lots.some(L => lx > L.x0 && lx < L.x1 && lz > L.z0 && lz < L.z1)); if (e && e.cut) { out[k] = { id: e.id, hit: N.col.collide(x, z, .32).hit }; break; } await new Promise(r => setTimeout(r, 250)); }
    }
    const B = [...new Set(N.props.bld.map(e => e.blk).filter(Boolean))];
    out.blocks = B.filter(b => b.footN != null).length; out.all = B.length; out.boxes = N.col.colliders.filter(c => c.blk).length;
    return out;
  });
  check(foot['水塔腳之間'] && !foot['水塔腳之間'].hit && foot['醫院急診樓前'] && !foot['醫院急診樓前'].hit && foot.blocks > 50, `實體建築照模型外形換掉碰撞盒：${foot.blocks}/${foot.all} 個街區、${foot.boxes} 個盒；${['水塔腳之間', '醫院急診樓前'].map(k => k + (foot[k] ? `（${foot[k].id}）${foot[k].hit ? '擋住' : '走得過去'}` : '模型沒下載')).join('、')}`);

  // 沿街模型與程式立面的交界以模型為主（27-bldfoot.js 的 bldAlign／bldSeam）：一樓的牆面推到地塊前緣、和隔壁的程式立面接成一線，兩端的縫照隔壁補起來。
  // 用碰撞格子（模型在人的高度切出來的牆）量每棟的前牆：沿寬度每 0.5 m 從地塊前緣外 1.5 m 往內找第一道牆，取中位數
  const seam = await ev(page, () => {
    const N = window.__nc, C = .25, res = { n: 0, ok: 0, yard: 0, fill: 0, fillG: 0, trees: 0, worst: [] };
    for (const e of N.props.bld) {
      if (!e.row || !e.cut || !e.blk.foot) continue;
      const G = e.blk.foot, L0 = e.lots[0], ax = L0.axis, f = L0.face;
      const a0 = Math.min(...e.lots.map(L => ax === 'z' ? L.x0 : L.z0)), a1 = Math.max(...e.lots.map(L => ax === 'z' ? L.x1 : L.z1)), face = ax === 'z' ? (f > 0 ? L0.z1 : L0.z0) : (f > 0 ? L0.x1 : L0.x0);
      const d = [];
      for (let a = a0 + 1; a <= a1 - 1; a += .5) for (let t = -1.5 + C / 2; t < 30; t += C) {
        const x = ax === 'z' ? a : face - f * t, z = ax === 'z' ? face - f * t : a, i = Math.floor((x - G.x0) / C) + 1, j = Math.floor((z - G.z0) / C) + 1;
        if (i < 1 || j < 1 || i > G.nx - 2 || j > G.nz - 2) break;
        if (G.wall[j * G.nx + i]) { d.push(t - C / 2); break; }
      }
      if (!d.length) continue;
      d.sort((p, q) => p - q);
      const m = d[d.length >> 1];
      res.n++; res.fill += (e.seams || []).length; res.fillG += e.seamG || 0; res.signs = (res.signs || 0) + (e.signs || 0); res.trees += e.treesCut || 0;
      if (m <= .5) res.ok++; else if (m > 3) res.yard++; else res.worst.push(e.id + ' ' + m.toFixed(2));
    }
    return res;
  });
  check(seam.n > 30 && seam.ok >= seam.n * .85 && seam.fill > 10 && seam.fillG > 5 && seam.signs > 10, `沿街模型的一樓牆面貼齊街面：${seam.ok}/${seam.n} 棟（前院 ${seam.yard} 棟，其餘 ${seam.worst.slice(0, 4).join('、') || '無'}），交界補立面 ${seam.fill} 段（模型對模型 ${seam.fillG} 段），補上的店面掛了 ${seam.signs} 塊招牌`);
  // 行道樹讓模型（27-bldfoot.js 的 bldTrees）：留下來（含縮小）的行道樹，枝葉不插進模型伸出來的逃生梯、雨棚；拿掉的樹連碰撞圓一起拿掉
  const tree = await ev(page, () => {
    const N = window.__nc, T = N.props.bld.trees || [], C = N.col.circles || [], res = { cut: 0, small: N.props.bld.reduce((a, e) => a + (e.treesSmall || 0), 0), hitLeft: 0, colLeft: 0 };
    for (const t of T) { if (!t.walk) continue; if (t.hide) { res.cut++; if (C.includes(t.col)) res.colLeft++; } }
    for (const e of N.props.bld) {
      if (!e.over) continue;
      const L0 = e.lots[0], ax = L0.axis, f = L0.face, a0 = e.over.a0, face = ax === 'z' ? (f > 0 ? L0.z1 : L0.z0) : (f > 0 ? L0.x1 : L0.x0);
      for (const t of T) {
        if (!t.walk || t.hide) continue;
        const u = ax === 'z' ? t.x : t.z, d = (ax === 'z' ? t.z - face : t.x - face) * f, reach = 2.2 * t.s;
        if (d <= 0 || d > 4.5) continue;
        for (let i = 0; i < e.over.n; i++) { const c = a0 + i + .5; if (Math.abs(c - u) < reach && e.over.bins[i] - (d - reach) > .35) { res.hitLeft++; break; } }
      }
    }
    return res;
  });
  // 逃生梯、雨棚伸到人行道上方（bldOver 量 2.4–10 m 高）：號誌桿離地塊前緣 3.3 m、路燈桿 3.9 m（20-props.js，燈頭往馬路伸），伸出不到 3 m 就碰不到
  const over = await ev(page, () => { let m = 0, id = '', n = 0; for (const e of window.__nc.props.bld) if (e.over) { n++; const v = Math.max(...e.over.bins); if (v > m) { m = v; id = e.id; } } return { m: +m.toFixed(2), id, n }; });
  check(over.n > 30 && over.m < 3, `模型伸到人行道上方的逃生梯、雨棚最多 ${over.m} m（${over.id}，量了 ${over.n} 棟），碰不到號誌桿與路燈桿`);
  check(tree.cut + tree.small > 10 && !tree.hitLeft && !tree.colLeft,`枝葉會插進模型逃生梯、雨棚的行道樹縮小 ${tree.small} 棵、拿掉 ${tree.cut} 棵（留下來還會插到的 ${tree.hitLeft} 棵、拿掉卻還留著碰撞的 ${tree.colLeft} 棵）`);

  // 展示廳（64-showroom.js，三層樓）：一樓中庭與兩側展廊
  await ev(page, () => window.__nc.enter('show'));
  await page.waitForTimeout(600);
  await ev(page, () => { const nc = window.__nc; nc.player.x = 0; nc.player.z = 22; nc.player.yaw = 0; nc.look(0, -.12, 1); });
  await page.waitForTimeout(500); await hideHud(page);
  const st1 = await ev(page, () => window.__nc.getStats());
  check(st1.triangles > 500000, `展示廳 ${st1.triangles} 個三角形、${st1.drawCalls} 個 draw call、${st1.fps} fps`);
  await shot(page, 'g-show');
  for (const [i, yaw] of [[0, 0], [1, .6], [2, -.6]]) {
    await ev(page, ([yaw]) => { const nc = window.__nc; nc.player.x = 0; nc.player.z = 32; nc.player.yaw = yaw; nc.look(yaw, -.1, 0); }, [yaw]);
    await page.waitForTimeout(400); await shot(page, 'g-show-back' + i);
  }
  // 看車對話：實車有授權標示
  const cars = await ev(page, () => window.__nc.spots.showCars);
  if (process.env.CLOSEUPS) for (const c of cars.filter(c => IDS.includes(c.id) && (!process.env.ONLY || process.env.ONLY.split(',').includes(c.id)))) {
    // 站在車子斜前方、相機拉遠看整台車
    await ev(page, (c) => { const nc = window.__nc, p = nc.player, a = c.yaw + .75; nc.showLevel(c.lv || 0); nc.me.mesh.visible = false; p.x = c.x + Math.sin(a) * 2.2; p.z = c.z + Math.cos(a) * 2.2; p.yaw = a + Math.PI; nc.look(a + Math.PI, -.22, 1); }, c);
    await page.waitForTimeout(350); await hideHud(page); await shot(page, 'c-' + c.id);
    await ev(page, () => { window.__nc.me.mesh.visible = true; });
  }
  const m3 = cars.find(c => c.id === 'e92');
  await ev(page, (c) => { const nc = window.__nc, p = nc.player; nc.showLevel(c.lv || 0); p.x = c.x * .72; p.z = c.z; }, m3);   // 64-showroom.js：車在兩側展廊，站在走道上
  await page.waitForTimeout(250);
  check(/BMW M3 \(E92\)/.test((await ev(page, () => window.__nc.ctx())) || ''), `實車旁的提示：${await ev(page, () => window.__nc.ctx())}`);
  await ev(page, () => window.__nc.carInfo('e92'));
  const dl = await ev(page, () => document.getElementById('dlgText')?.textContent || document.querySelector('#dialog')?.textContent || '');
  check(/CC BY/.test(dl), `看車對話有模型授權：${(dl.match(/模型：[^\n]*/) || [''])[0]}`);
  await shot(page, 'g-dialog');
  // 買下（加錢）→ 換車、上街開
  await ev(page, () => { window.__nc.closeDialog(); window.__nc.motors.cash = 2e6; });
  await ev(page, () => window.__nc.carInfo('e92'));
  await ev(page, () => window.__nc.pick(0)); await ev(page, () => window.__nc.pick(0));
  await page.waitForTimeout(300);
  check(await ev(page, () => window.__nc.motors.owned.includes('e92') && window.__nc.motors.cur === 'e92'), '買下 BMW M3 (E92)');
  await ev(page, () => window.__nc.pick(0));
  await page.waitForTimeout(1800);
  const dv = await ev(page, () => { const nc = window.__nc, v = nc.player.veh; return { mode: nc.player.mode, id: v && v.carId, glbBody: !!(v && v.body.children.some(o => o.isGroup)), wheels: v && v.wheels.length, isCar: v && v.isCar }; });
  check(dv.mode === 'drive' && dv.id === 'e92' && dv.glbBody && dv.wheels === 4, `開著實車 ${JSON.stringify(dv)}`);
  const w0 = await ev(page, () => window.__nc.player.veh.wheels[0].w.rotation.x);
  await page.keyboard.down('KeyW'); await page.keyboard.down('KeyA'); await page.waitForTimeout(1400);
  const w1 = await ev(page, () => { const v = window.__nc.player.veh; return { spin: v.wheels[0].w.rotation.x, steer: v.wheels.find(w => w.front).piv.rotation.y, kmh: Math.hypot(v.vx, v.vz) * 3.6 }; });
  await page.keyboard.up('KeyA'); await page.waitForTimeout(500); await page.keyboard.up('KeyW');
  check(Math.abs(w1.spin - w0) > 1 && Math.abs(w1.steer) > .05, `輪子轉動 ${(w1.spin - w0).toFixed(1)} rad、前輪轉向 ${w1.steer.toFixed(2)}、時速 ${w1.kmh.toFixed(0)}`);
  await hideHud(page);
  await ev(page, () => { const nc = window.__nc; nc.look(nc.player.veh.yaw + 2.4, .02, 0); });
  await page.waitForTimeout(300); await ev(page, () => { const nc = window.__nc; nc.look(nc.player.veh.yaw + 2.4, .02, 0); });
  await shot(page, 'g-drive');
  // CHROME WORKS：可換色的車換色、彩繪車不能換
  await ev(page, () => window.__nc.livery());
  const pe = await ev(page, () => window.__nc.motors.paint.e92);
  check(Number.isInteger(pe), `E92 換色 → #${(pe >>> 0).toString(16)}`);
  await ev(page, () => window.__nc.applyCar('m3gtr'));
  await ev(page, () => window.__nc.livery());
  check(/原廠彩繪/.test(await ev(page, () => document.getElementById('toast').textContent)), 'M3 GTR 彩繪車不能換色');
  // 機車
  await ev(page, () => { const nc = window.__nc; nc.walk(); nc.applyCar('s1krr19'); });
  await page.waitForTimeout(400);
  await ev(page, () => { const nc = window.__nc; nc.drive(); });
  await page.waitForTimeout(300);
  const bk = await ev(page, () => { const v = window.__nc.player.veh; return { isCar: v.isCar, wheels: v.wheels.length, rider: window.__nc.player.mode }; });
  check(!bk.isCar && bk.wheels === 2, `騎實車機車 ${JSON.stringify(bk)}`);
  await page.keyboard.down('KeyW'); await page.keyboard.down('KeyD'); await page.waitForTimeout(1500); await page.keyboard.up('KeyD'); await page.keyboard.up('KeyW');
  await hideHud(page);
  await ev(page, () => { const nc = window.__nc; nc.look((nc.player.veh || nc.player).yaw + 1.9, .05, 0); });
  await page.waitForTimeout(250); await ev(page, () => { const nc = window.__nc; nc.look((nc.player.veh || nc.player).yaw + 1.9, .05, 0); });
  await shot(page, 'g-bike');
  // 新機車的騎乘姿勢
  for (const id of ['zx6r', 'v4']) {
    await ev(page, (id) => { const nc = window.__nc; nc.walk(); nc.applyCar(id); nc.drive(); const v = nc.player.veh; v.vx = v.vz = 0; nc.look(v.yaw + 1.6, .05, 0); }, id);
    await page.waitForTimeout(500); await ev(page, () => { const nc = window.__nc; nc.look(nc.player.veh.yaw + 1.6, .05, 0); });
    await hideHud(page); await shot(page, 'g-ride-' + id);
  }
  // 車行門口：門前兩台展示車與櫥窗剪影，走近才下載
  await ev(page, () => { const nc = window.__nc, d = nc.spots.dealerDoor; nc.walk(); nc.tpL(d.x, d.z + 9, Math.PI); nc.look(nc.player.yaw, .05, 1); });
  await page.waitForTimeout(2500); await hideHud(page);
  const front = await ev(page, () => ({ loaded: window.__nc.glb.loaded.slice(), st: window.__nc.getStats() }));
  check(['f40', 'sf90', 'r34', 'supra', 'nsx', 'zr1'].every(id => front.loaded.includes(id)), `車行門口的實車已下載，${front.st.triangles} 個三角形、${front.st.drawCalls} 個 draw call、${front.st.fps} fps`);
  await shot(page, 'g-storefront');
  // 街景：每台實車停在 LAZARUS 門口拍一張（CITY=1）
  if (process.env.CITY) for (const id of IDS.filter(id => !process.env.ONLY || process.env.ONLY.split(',').includes(id))) {
    await ev(page, (id) => { const nc = window.__nc, d = nc.spots.clubDoor; nc.walk(); nc.applyCar(id); nc.drive(); const v = nc.player.veh, s = nc.Ws(d.x + 10, d.z + 8.9, 1.57); v.x = s.x; v.z = s.z; v.yaw = s.yaw; v.vx = v.vz = 0; nc.look(v.yaw - 3.6, .02, 0); }, id);
    await page.waitForTimeout(900);
    await ev(page, () => { const nc = window.__nc; nc.look(nc.player.veh.yaw - 3.6, .02, 0); });
    await hideHud(page); await shot(page, 'city-' + id);
  }
  // 車庫：擁有的實車停在車格裡
  await ev(page, () => { const nc = window.__nc; nc.walk(); nc.motors.owned.push('gt3rs', 's1krr', 'm4gt3', 'gt3r', 's1krr19', 'm3t24', 'r34', 'f40', 'v4', 'police'); nc.applyCar('ae86'); nc.motors.cur = 'ae86'; nc.garage(); nc.enter('home'); });
  await page.waitForTimeout(600);
  await ev(page, () => { const nc = window.__nc; nc.player.x = 0; nc.player.z = 30; nc.player.yaw = Math.PI; nc.look(Math.PI, -.15, 1); });
  await page.waitForTimeout(500); await hideHud(page);
  await shot(page, 'g-garage');
  await ev(page, () => { const nc = window.__nc; nc.me.mesh.visible = false; nc.player.x = 0; nc.player.z = 6; nc.player.yaw = 0; nc.look(0, -.12, 1); });
  await page.waitForTimeout(500); await hideHud(page);
  await shot(page, 'g-garage-back');
  await ev(page, () => { window.__nc.me.mesh.visible = true; });
  const gs = await ev(page, () => window.__nc.getStats());
  check(gs.drawCalls > 0, `車庫 ${gs.triangles} 個三角形、${gs.drawCalls} 個 draw call`);

  // 島上的基地與對岸的遠景（27-props.js 的 COAST_MODELS）：走近就下載，量模型在所在區（邏輯座標）的範圍，
  // 島上的要整塊落在灰鷗島上、底部在地面附近（原檔有幾公尺的地基）；對岸的要貼著各自的河岸（河岸基礎在水面下二十公尺內）（倫敦的東緣、舊港城的西緣），不能浮在空中或沉到水裡
  // 十五片版圖拿掉了東灣對岸（golu、s7），只測頁面還有的模型；外海的兩座島（鷹巖村、光格島）：底部沉在海面下、頂端在海面上，中心對著原本程式建模的島
  const coastIds = await ev(page, () => window.__nc.props.coast.models.map(o => o.id));
  for (const id of ['ruin', 'office', 'london', 'golu', 's7', 'eze', 'tron'].filter(id => coastIds.includes(id))) {
    await ev(page, (id) => { const nc = window.__nc, o = nc.props.coast.models.find(o => o.id === id); nc.tpL(o.at.x + (o.proxy === 'isle' ? 0 : o.id === 'london' ? 700 : o.proxy === 'eze' || o.proxy === 'tron' ? 0 : -600), o.at.z - (o.proxy === 'tron' ? 1400 : o.proxy === 'eze' ? 700 : 0), 0); }, id);   // 光格島要站在換近景的距離（21-tron.js 的 TRON_NEAR）外，不然遠景會被拿掉
    let done = false;
    for (let i = 0; i < 240 && !done; i++) { await page.waitForTimeout(250); done = await ev(page, (id) => !!window.__nc.props.coast.models.find(o => o.id === id).done, id); }
    const bb = await ev(page, (id) => {
      const C = window.__nc.props.coast, o = C.models.find(o => o.id === id);
      if (!o.obj) return null;
      const inv = o.obj.parent.matrixWorld.clone().invert(), b = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 };
      o.obj.updateMatrixWorld(true);
      o.obj.traverse(m => {
        if (!m.isMesh) return;
        m.geometry.boundingBox || m.geometry.computeBoundingBox();
        const q = m.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld));
        b.x0 = Math.min(b.x0, q.min.x); b.x1 = Math.max(b.x1, q.max.x); b.y0 = Math.min(b.y0, q.min.y); b.y1 = Math.max(b.y1, q.max.y); b.z0 = Math.min(b.z0, q.min.z); b.z1 = Math.max(b.z1, q.max.z);
      });
      for (const k in b) b[k] = Math.round(b[k]);
      return { b, isle: o.proxy === 'isle' ? C.ISLE : null, far: C.FAR_BANK_X, east: C.EAST_BANK_X, at: o.at, sea: window.__nc.sea.SEA_Y };
    }, id);
    let ok = !!bb, why = '';
    if (bb && bb.isle) { const I = bb.isle; ok = bb.b.x0 > I.x0 - 5 && bb.b.x1 < I.x1 + 5 && bb.b.z0 > I.z0 - 5 && bb.b.z1 < I.z1 + 5 && bb.b.y0 > -6 && bb.b.y0 < 2 && bb.b.y1 > 10; why = `島 x ${I.x0}…${I.x1}、z ${I.z0}…${I.z1}`; }
    else if (bb && (id === 'eze' || id === 'tron')) { const cx = (bb.b.x0 + bb.b.x1) / 2, cz = (bb.b.z0 + bb.b.z1) / 2; ok = Math.hypot(cx - bb.at.x, cz - bb.at.z) < 80 && bb.b.y0 < bb.sea - 5 && bb.b.y1 > bb.sea + (id === 'eze' ? 150 : 15); why = `島心 ${Math.round(bb.at.x)}, ${Math.round(bb.at.z)}，海面 ${bb.sea}`; }
    else if (bb && id === 'london') { ok = Math.abs(bb.b.x1 - bb.far) < 60 && bb.b.y0 > -25 && bb.b.y0 < 5 && bb.b.y1 > 40; why = `河岸 x ${bb.far}`; }
    else if (bb) { ok = bb.b.x0 > bb.east - 40 && bb.b.y0 > -25 && bb.b.y0 < 5 && bb.b.y1 > 20; why = `河岸 x ${bb.east}`; }
    check(done && ok, `${id} 的模型擺在該在的地方（邏輯座標範圍 ${JSON.stringify(bb && bb.b)}，${why}）`);
  }

  // 北嶺鐵道橋（10-city.js 的 VIADUCT）：走近就下載，擺好拿掉程式替身；山坡在模型範圍中間貼著模型地面下 1.5 m（hf 雙線性）。
  // 座標是公園框（VIADUCT.zn），擺位置走 __nc.props.rail 的 tp／W；沒有掃描資料（VIADUCT 是 null）時跳過
  if (await ev(page, () => !!window.__nc.props.viaduct)) {
    await ev(page, () => { const nc = window.__nc, V = nc.props.viaduct; nc.props.rail.tp(V.x - 40, V.z + 120, Math.PI); });
    let done = false;
    for (let i = 0; i < 240 && !done; i++) { await page.waitForTimeout(250); done = await ev(page, () => !!window.__nc.props.w1.find(o => o.set === 'far_rail').obj); }
    const vr = await ev(page, () => {
      const nc = window.__nc, V = nc.props.viaduct, d = [];
      for (const [fx, fz] of [[.25, .5], [.5, .5], [.75, .5], [.5, .2], [.5, .8]]) { const x = V.x + V.lx0 + V.W * fx, z = V.z + V.lz0 + V.D * fz; d.push(nc.park.h(x, z) - (V.at(V.W * fx, V.D * fz) + V.y - 1.5)); }
      return { proxy: !!(V.proxy && V.proxy.parent), d: d.map(v => +v.toFixed(2)), deck: +V.deck.toFixed(1) };
    });
    await page.waitForTimeout(800); await hideHud(page); await ev(page, () => { const nc = window.__nc, V = nc.props.viaduct, [x, z] = nc.props.rail.W(V.x, V.z); nc.look(Math.atan2(x - nc.player.x, z - nc.player.z), .12, 0); });
    await page.waitForTimeout(400); await shot(page, 'g-viaduct');
    check(done && !vr.proxy && vr.d.every(v => Math.abs(v) < .05), `北嶺鐵道橋模型已擺上、替身拿掉，山溝貼著模型地面（差 ${vr.d.join('、')} m，橋面 y ${vr.deck}）`);
    // 兩端的洞門與崖壁（w1_tunnel，27-world1.js）：下載好就拿掉那一端的程式替身 e.proxy
    let tun = false;
    for (let i = 0; i < 160 && !tun; i++) { await page.waitForTimeout(250); tun = await ev(page, () => window.__nc.props.w1.filter(o => o.set === 'w1_tunnel').every(o => o.obj)); }
    const tq = await ev(page, () => { const nc = window.__nc; return { n: nc.props.w1.filter(o => o.set === 'w1_tunnel').length, proxy: nc.props.viaduct.ends.filter(e => e.proxy && e.proxy.parent).length }; });
    check(tun && tq.n === 5 && tq.proxy === 0, `北嶺鐵道兩端的洞門與崖壁已擺上（${tq.n} 件）、替身拿掉（剩 ${tq.proxy} 端）`);
  }

  // 北嶺鐵道橋的列車（21-rail.js）：走近就下載 w1_train 換掉程式替身；夜裡停在橋中間截圖（車窗亮著）；沒擺鐵道橋時跳過
  if (await ev(page, () => !!window.__nc.props.rail.R)) {
    let ok = false;
    for (let i = 0; i < 160 && !ok; i++) { await page.waitForTimeout(250); ok = await ev(page, () => window.__nc.props.rail.R.loaded); }
    const t0 = await ev(page, () => { const nc = window.__nc, R = nc.props.rail.R, t = nc.time(); nc.time(21 * 60 + 30); nc.props.rail.go(1, R.len / 2 + 50); R.speed = 0; return t; });
    await page.waitForTimeout(1500); await hideHud(page);
    const tr = await ev(page, () => {
      const nc = window.__nc, V = nc.props.viaduct, R = nc.props.rail.R, [cx, cz] = nc.props.rail.W(V.x + 25, V.z + 48), [tx, tz] = nc.props.rail.W(V.x - 15, V.zc(V.x - 15));
      nc.camAt(cx, V.deck + 9, cz, tx, V.deck + 2, tz);
      return { on: R.cars.filter(c => c.on && c.obj.visible).length, mesh: R.cars.reduce((a, c) => a + c.obj.children.length, 0), win: +R.uM.value.z.toFixed(2) };
    });
    await page.waitForTimeout(500); await shot(page, 'g-train');
    await ev(page, (t) => { const nc = window.__nc, R = nc.props.rail.R; nc.camAt(); nc.time(t); R.speed = 17; R.state = 'wait'; R.tw = 30; }, t0);
    check(ok && tr.on === 5 && tr.mesh > 5 && tr.win > .5, `北嶺鐵道橋的列車換成 Lastochka 模型，五節都在橋上、夜裡車窗亮（${JSON.stringify(tr)}）`);
  }

  // 光格島（21-tron.js）：走近碼頭下載近景（isle_tron 與步行格）、遠景拿掉；開船靠岸下到碼頭；步行格（車道站得上去、樓擋住）、島上（含低於海面的下層街區）不算水；
  // 騎光速機車往前衝、光牆拉長、下車；販賣機、長椅、升降梯；走遠換回遠景。座標都走 tpL／TR.W，zrot 也能跑
  {
    const W = (ms) => page.waitForTimeout(ms);
    await ev(page, () => { const nc = window.__nc, T = nc.props.tron.T, P = T.P; nc.walk(); nc.props.tron.tp((P.x0 + P.x1) / 2, P.z0 + 6, 0); });
    let built = false;
    for (let i = 0; i < 200 && !built; i++) { await W(250); built = await ev(page, () => window.__nc.props.tron.T.built); }
    await W(600);
    const st = await ev(page, () => {
      const nc = window.__nc, TR = nc.props.tron, T = TR.T, D = T.D, far = nc.props.coast.models.find(o => o.id === 'tron'), wk = T.walk, rd = T.edges[0].pts[1], lo = D.lift[1];
      let bld = null;   // 樓裡：陸地上、步行格沒有任何一層
      for (let k = 0; k < wk.nx * wk.nz && !bld; k += 97) { const x = wk.x0 + (k % wk.nx + .5) * wk.res, z = wk.z0 + (Math.floor(k / wk.nx) + .5) * wk.res; if (wk.L[0][k] === -32768 && TR.land(x, z)) bld = [x, z]; }
      return { near: T.nearOn, far: !!(far.obj && far.obj.parent), agents: T.agents.length, parked: T.parked.length, road: TR.y(rd[0], rd[2], rd[1]), rdY: rd[1],
        bld: bld && [TR.y(bld[0], bld[1], 0), TR.open(bld[0], bld[1], 1)], dRoad: nc.sea.depth(...TR.W(rd[0], rd[2])), dPit: nc.sea.depth(...TR.W(lo[0], lo[2])), pitY: lo[1], mask: T.masked };
    });
    check(built && st.near && !st.far && st.agents === 8 && st.parked >= 4 && Math.abs(st.road - st.rdY) < .6 && st.bld && st.bld[0] === null && st.bld[1] === false && st.dRoad === 0 && st.dPit === 0 && st.pitY < -8 && st.mask,
      `光格島近景下載、遠景拿掉，步行格：車道站得上去、樓擋住，島上與下層街區不算水 ${JSON.stringify(st)}`);
    // 開船：島上那艘遊艇，按 F 下到碼頭
    const bd = await ev(page, () => { const nc = window.__nc, b = nc.boat, i = b.list().findIndex(o => o.where === '光格島'); b.board(i); return { i, boat: !!(nc.player.veh && nc.player.veh.boat) }; });
    await W(600); await page.keyboard.press('KeyF'); await W(800);
    const off = await ev(page, () => { const nc = window.__nc, p = nc.player, T = nc.props.tron.T, P = T.P, [rx, rz] = nc.props.tron.L(p.x, p.z);
      return { mode: p.mode, swim: !!p.swim, y: +p.y.toFixed(2), d: nc.park.district(p.x, p.z), pier: rx >= P.x0 && rx <= P.x1 && rz >= P.z0 && rz <= P.z1 }; });
    check(bd.i >= 0 && bd.boat && off.mode === 'walk' && !off.swim && Math.abs(off.y) < .1 && off.d === '光格島' && off.pier, `開光格島的遊艇、按 F 下到碼頭 ${JSON.stringify({ ...bd, ...off })}`);
    // 光速機車：停在路邊那台，按 F 騎上去，按住 W 兩秒，光牆拉長；停下來按 F 下車
    await ev(page, () => { const nc = window.__nc, T = nc.props.tron.T, c = T.parked[0]; nc.time(23 * 60); nc.props.tron.tp(c.x + Math.cos(c.yaw) * 1.2, c.z - Math.sin(c.yaw) * 1.2, 0); });
    await W(500);
    const c0 = await ev(page, () => window.__nc.ctx());
    await page.keyboard.press('KeyF'); await W(400);
    const r0 = await ev(page, () => { const c = window.__nc.props.tron.T.parked[0]; return [c.x, c.z]; });
    await ev(page, () => { const nc = window.__nc; nc.look(nc.player.yaw, .1, 1); });
    await page.keyboard.down('KeyW'); await W(2000); await hideHud(page); await shot(page, 'g-tron-ride'); await page.keyboard.up('KeyW');
    const r1 = await ev(page, (r0) => { const nc = window.__nc, c = nc.props.tron.T.parked[0]; return { ride: !!(nc.player.ride && nc.player.ride.tron), d: +Math.hypot(c.x - r0[0], c.z - r0[1]).toFixed(1), v: +c.v.toFixed(1), trail: c.trail ? c.trail.pts.length : 0 }; }, r0);
    // 按住 S 煞到快停（再按下去會倒車，倒車超過 4 m/s 就不能下車）
    await page.keyboard.down('KeyS');
    for (let i = 0; i < 40; i++) { await W(100); if (await ev(page, () => Math.abs(window.__nc.props.tron.T.parked[0].v) < 1.5)) break; }
    await page.keyboard.up('KeyS'); await W(200);
    await page.keyboard.press('KeyF'); await W(400);
    const r2 = await ev(page, () => { const nc = window.__nc, p = nc.player; return { ride: !!p.ride, mode: p.mode, y: +p.y.toFixed(2) }; });
    check(/騎上光速機車/.test(c0 || '') && r1.ride && r1.d > 20 && r1.trail > 10 && !r2.ride && r2.mode === 'walk' && Math.abs(r2.y) < .6, `騎光速機車：${c0}，衝 ${r1.d} m、光牆 ${r1.trail} 點，下車 ${JSON.stringify(r2)}`);
    // 販賣機（買飲料回血）、長椅（坐下、一動就站起來）、升降梯（到下層街區）：找每樣東西旁邊站得上去的一點
    const near = (it, r) => ev(page, ([it, r]) => {
      const nc = window.__nc, TR = nc.props.tron, T = TR.T;
      for (const o of T.D[it]) for (let a = 0; a < 16; a++) { const x = o[0] + Math.sin(a / 16 * Math.PI * 2) * r, z = o[2] + Math.cos(a / 16 * Math.PI * 2) * r, y = TR.y(x, z, o[1]); if (y != null && Math.abs(y - o[1]) < .6) { nc.props.tron.tp(x, z, 0); nc.player.y = T.S.y + y; return true; } }
      return false;
    }, [it, r]);
    const v0 = await near('vend', 1.3); await W(300);
    const vc = await ev(page, () => { const nc = window.__nc; nc.gta.life.hp = 40; return { t: nc.ctx(), cash: nc.motors.cash }; });
    await page.keyboard.press('KeyE'); await W(300);
    const v1 = await ev(page, () => { const nc = window.__nc; return { cash: nc.motors.cash, hp: Math.round(nc.gta.life.hp) }; });
    check(v0 && /光能飲料/.test(vc.t || '') && v1.cash === vc.cash - 20 && v1.hp >= 70, `販賣機：${vc.t}，$${vc.cash} → $${v1.cash}、生命 40 → ${v1.hp}`);
    const b0 = await near('bench', 1); await W(300);
    const bc = await ev(page, () => window.__nc.ctx());
    await page.keyboard.press('KeyE'); await W(500);
    const b1 = await ev(page, () => { const r = window.__nc.player.ride; return r && r.tron; });
    await page.keyboard.down('KeyW'); await W(400); await page.keyboard.up('KeyW');
    const b2 = await ev(page, () => !!window.__nc.player.ride);   // ride 帶著整台車的 three 物件，直接回傳會把分頁撐爆
    check(b0 && /坐一下/.test(bc || '') && b1 === 'sit' && !b2, `長椅：${bc}，坐下 ${b1}、一動就站起來`);
    const l0 = await ev(page, () => { const nc = window.__nc, T = nc.props.tron.T, L = T.D.lift[0]; nc.props.tron.tp(L[0], L[2], 0); nc.player.y = T.S.y + L[1]; return T.D.lift[1][1]; });
    await W(400);
    const lc = await ev(page, () => window.__nc.ctx());
    await page.keyboard.press('KeyE'); await W(2200);
    const l1 = await ev(page, () => { const nc = window.__nc, p = nc.player; return { y: +p.y.toFixed(2), d: nc.park.district(p.x, p.z), swim: !!p.swim }; });
    check(/下層街區/.test(lc || '') && Math.abs(l1.y - l0) < .6 && l1.d === '光格島' && !l1.swim, `升降梯：${lc} → y ${l1.y}（下層 ${l0}），不算水`);
    // 走遠：近景拿掉、換回遠景
    await ev(page, () => { const nc = window.__nc, T = nc.props.tron.T; nc.props.tron.tp(0, -1400, 0); });
    await W(800);
    const fr = await ev(page, () => { const nc = window.__nc, T = nc.props.tron.T, far = nc.props.coast.models.find(o => o.id === 'tron'); return { near: T.nearOn, far: !!(far.obj && far.obj.parent), nearIn: !!T.near.parent }; });
    check(!fr.near && fr.far && !fr.nearIn, `走遠換回光格島遠景 ${JSON.stringify(fr)}`);
  }

  // 安全屋：走近門口就下載室內模型，換掉程式建模的房間
  for (const id of ['loft', 'villa', 'office', 'mini', 'l16', 'i14']) {
    await ev(page, (id) => { const nc = window.__nc, a = nc.gta.apt.APT[id], d = a.door, f = a.face || 1; nc.motors.props.own.push(id); nc.tpL(d.x, d.z + 6 * f, f > 0 ? Math.PI : 0); }, id);
    let ok = false;
    for (let i = 0; i < 60 && !ok; i++) { await page.waitForTimeout(250); ok = await ev(page, (id) => !window.__nc.gta.apt.APT[id].fb.visible, id); }
    await ev(page, (id) => { const nc = window.__nc; nc.enter(id); nc.look(nc.gta.apt.APT[id].spawn.yaw, .15, 1); }, id);
    await page.waitForTimeout(600); await hideHud(page);
    await shot(page, 'g-' + id);
    const as = await ev(page, () => window.__nc.getStats());
    check(ok && as.where === id, `安全屋 ${id} 的室內模型已換上，${as.triangles} 個三角形、${as.drawCalls} 個 draw call、${as.fps} fps`);
  }

  // 商店街（69-v5-shops.js）：走近就下載服飾店店面、掛衣架、吊靶與射擊位，槍牆與展示櫃擺上實體武器
  {
    await ev(page, () => { const nc = window.__nc; nc.walk(); const [x, z] = nc.gta.v5.mallW(37.5, 6); nc.tp(x, z, nc.gta.v5.yaw('mall', 0)); });
    let ok = false;
    for (let i = 0; i < 80 && !ok; i++) { await page.waitForTimeout(250); ok = await ev(page, () => { const M = window.__nc.gta.v5.MALL; return !M.fb.visible && !M.fg.visible && M.mann.visible; }); }
    const tg = await ev(page, () => window.__nc.gta.v5.MALL.targets.every(t => t.m.children.length === 1));
    await ev(page, () => { const nc = window.__nc, V = nc.gta.v5, [x, z] = V.mallW(37.5, 9); nc.player.x = x; nc.player.z = z; nc.look(V.yaw('mall', 0), -.05, 1); });
    await page.waitForTimeout(600); await hideHud(page);
    await shot(page, 'g-mall');
    check(ok && tg, `商店街模型已換上（店面、假人、槍牆替身藏起來；9 個吊靶 ${tg}）`);
  }

  // 霓峰塔工地（69-v5-tower.js）：大樓三段、桅桿 78 節與塔頂換上模型，程式建模的替身藏起來
  {
    await ev(page, () => { const nc = window.__nc, C = nc.gta.v5.crane, [x, z] = C.jib(24); nc.walk(); nc.tp(x, z, 0); });
    let ok = false;
    for (let i = 0; i < 80 && !ok; i++) { await page.waitForTimeout(250); ok = await ev(page, () => { const C = window.__nc.gta.v5.crane.CR; return !!C.glb && C.lod === 1 && C.glb.every(m => m.visible) && C.fb.every(m => !m.visible); }); }
    const n = await ev(page, () => (window.__nc.gta.v5.crane.CR.glb || []).length);
    check(ok, `霓峰塔模型已換上（${n} 組實例，替身藏起來）`);
  }
} finally {
  check(!log.pageerrors.length, `沒有未捕捉例外 ${log.pageerrors.slice(0, 3).join(' | ')}`);
  check(!log.errors.length, `沒有 console.error ${log.errors.slice(0, 3).join(' | ')}`);
  check(!log.external.length, `沒有外部請求 ${log.external.slice(0, 3).join(' | ')}`);
  await browser.close(); srv.close();
}
console.log(failed ? `✗ ${failed} 項失敗` : '✓ 全部通過');
process.exit(failed ? 1 : 0);
