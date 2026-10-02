// combat 軌道自檢：node tools/check-combat.mjs [html] [--out dir]
// 以 __sw 腳本驅動：半自動點射、AR 連射、泵動中斷裝填、狙擊彈道（飛行時間＋下墜）、弱點、消耗品、寶箱、撿取／換槍、死亡掉落，並截圖視覺特效。
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { open } from './lib.mjs';

const a = process.argv.slice(2);
const html = a.find((x) => !x.startsWith('--') && a[a.indexOf(x) - 1] !== '--out') || 'dist/combat/index.html';
const oi = a.indexOf('--out');
const outDir = resolve(oi >= 0 ? a[oi + 1] : 'dist/combat/check');
mkdirSync(outDir, { recursive: true });
const checks = []; let failed = 0;
const check = (n, ok, d) => { checks.push({ n, ok: !!ok, d }); if (!ok) { failed++; console.log('FAIL', n, d ?? ''); } else console.log('ok  ', n, d ?? ''); };

async function run(name, w, h, touch) {
  const { browser, page, log } = await open(html, { w, h, touch });
  const sw = (fn, arg) => page.evaluate(fn, arg);
  const wait = (ms) => page.waitForTimeout(ms);
  const shot = (s) => page.screenshot({ path: resolve(outDir, `${name}-${s}.png`) });
  const P = (s) => `${name}:${s}`;
  await sw(() => window.__sw.start()); await wait(300);
  await sw(() => { const s = window.__sw; s.skipToGround(8, 30); s.freezeBots(true); s.giveMats(); s.giveAmmo(); window.__ev = []; for (const n of ['harvest', 'reload', 'shot', 'consume', 'dryFire', 'equip', 'shieldBreak', 'chestOpen', 'pickup', 'impact', 'damage']) s.ctx.events.on(n, (e) => window.__ev.push({ n, e: { phase: e.phase, weakPoint: e.weakPoint, material: e.material, projectile: e.projectile, weapon: e.weapon, surface: e.surface, amount: e.amount, head: e.headshot } })); });
  const evCount = (n) => sw((n) => window.__ev.filter((x) => x.n === n).length, n);
  const clearEv = () => sw(() => (window.__ev.length = 0));
  await wait(500);

  // ---- 半自動：按住不放只開一槍，連點會受射速限制；提前按下被緩衝 ----
  await sw(() => { const s = window.__sw; s.give('pistol', 1); s.look(0, 0); });
  await sw(() => window.__sw.fastForward(0.6));
  let m0 = await sw(() => window.__sw.ctx.player.inventory.current().mag);
  await sw(() => { const s = window.__sw; s.press({ fire: true }); s.fastForward(1.0); s.press(null); });
  let m1 = await sw(() => window.__sw.ctx.player.inventory.current().mag);
  check(P('手槍半自動：按住只開一槍'), m0 - m1 === 1, `${m0}->${m1}`);
  await sw(() => window.__sw.fastForward(0.4));
  // 緩衝：冷卻剩 ~0.08 s 時按下，應在冷卻結束後自動擊發
  m0 = await sw(() => window.__sw.ctx.player.inventory.current().mag);
  await sw(() => { const s = window.__sw; s.press({ fire: true }); s.fastForward(0.02); s.press(null); s.fastForward(0.04); s.press({ fire: true }); s.fastForward(0.02); s.press(null); s.fastForward(0.3); });
  m1 = await sw(() => window.__sw.ctx.player.inventory.current().mag);
  check(P('手槍點兩下（含緩衝）= 2 槍'), m0 - m1 === 2, `${m0}->${m1}`);

  // ---- AR 全自動射速 ----
  await sw(() => { const s = window.__sw; s.give('ar', 2); s.fastForward(0.6); });
  m0 = await sw(() => window.__sw.ctx.player.inventory.current().mag);
  await sw(() => { const s = window.__sw; s.press({ fire: true }); s.fastForward(2); s.press(null); });
  m1 = await sw(() => window.__sw.ctx.player.inventory.current().mag);
  check(P('AR 2 秒 ≈ 11 發'), m0 - m1 >= 10 && m0 - m1 <= 12, `${m0 - m1}`);
  // 換槍準備時間：剛換槍 0.2 s 內不能開槍
  await sw(() => { const s = window.__sw; s.give('smg', 1); s.press({ fire: true }); s.fastForward(0.2); });
  const eqm = await sw(() => window.__sw.ctx.player.inventory.current().mag);
  check(P('換槍準備中不能開火'), eqm === 30, eqm);
  await sw(() => { const s = window.__sw; s.press(null); s.fastForward(0.3); });

  // ---- 空彈：自動換彈、彈藥耗盡 → dryFire ----
  await sw(() => { const s = window.__sw, p = s.ctx.player; s.give('ar', 1); s.fastForward(0.6); p.inventory.current().mag = 1; s.press({ fire: true }); s.fastForward(0.3); s.press(null); });
  const act = await sw(() => window.__sw.ctx.player.action && window.__sw.ctx.player.action.kind);
  check(P('彈匣空自動換彈'), act === 'reload', act);
  await sw(() => window.__sw.fastForward(3));
  await sw(() => { const s = window.__sw, p = s.ctx.player; p.inventory.current().mag = 0; p.inventory.ammo.medium = 0; s.fastForward(0.1); window.__ev.length = 0; s.press({ fire: true }); s.fastForward(0.1); s.press(null); });
  check(P('沒彈藥點擊發出 dryFire'), (await evCount('dryFire')) >= 1);
  await sw(() => { window.__sw.giveAmmo(); });

  // ---- 泵動：逐發裝填、開火中斷 ----
  await sw(() => { const s = window.__sw, p = s.ctx.player; s.give('pump', 2); s.fastForward(0.7); p.inventory.current().mag = 1; p.inventory.ammo.shells = 10; s.press({ reload: true }); s.fastForward(0.05); s.press(null); });
  check(P('泵動開始逐發裝填'), (await sw(() => window.__sw.ctx.player.action && window.__sw.ctx.player.action.kind)) === 'reload');
  await sw(() => window.__sw.fastForward(0.95));
  const pm = await sw(() => window.__sw.ctx.player.inventory.current().mag);
  check(P('泵動每發 0.5 s（~1 s 後 3 發）'), pm === 3, pm);
  await sw(() => { const s = window.__sw; s.press({ fire: true }); s.fastForward(0.05); s.press(null); });
  const pm2 = await sw(() => ({ mag: window.__sw.ctx.player.inventory.current().mag, act: window.__sw.ctx.player.action }));
  check(P('泵動開火中斷裝填並擊發'), pm2.mag === 2 && !pm2.act, JSON.stringify(pm2));
  // 切換取消換彈
  await sw(() => { const s = window.__sw, p = s.ctx.player; s.fastForward(1.3); p.inventory.current().mag = 0; s.press({ reload: true }); s.fastForward(0.1); s.press({ slot: 0 }); s.fastForward(0.05); s.press(null); });
  check(P('切換欄位取消換彈'), !(await sw(() => window.__sw.ctx.player.action)));

  // ---- 準心資料 ----
  const xh = await sw(() => {
    const s = window.__sw, c = s.ctx, p = c.player; s.give('ar', 3); s.press(null); s.fastForward(1.5);
    const idle = c.combat.crosshairSpread(p);
    s.press({ moveZ: 1 }); s.fastForward(0.3); const move = c.combat.crosshairSpread(p); s.press(null); s.fastForward(1.5);
    s.press({ ads: true }); s.fastForward(0.6); const ads = c.combat.crosshairSpread(p); s.press({ ads: true, fire: true }); s.fastForward(1.2); const adsFire = c.combat.crosshairSpread(p); s.press(null);
    return { idle, move, ads, adsFire, px: c.combat.crosshairPixels(p, 1080) };
  });
  check(P('準心：移動 > 站定 > ADS'), xh.move > xh.idle && xh.idle > xh.ads && xh.adsFire > xh.ads, JSON.stringify(xh));
  await sw(() => window.__sw.fastForward(2));

  // ---- 消耗品 ----
  const cons = await sw(() => {
    const s = window.__sw, c = s.ctx, p = c.player, o = {};
    s.give('bandage'); s.fastForward(0.3); p.health = 80; s.press({ fire: true }); s.fastForward(0.4); o.cap = !p.action;           // 80 ≥ 75 不能用繃帶
    p.health = 40; s.fastForward(0.2); o.start = !!p.action; s.fastForward(1.0); o.prog = p.action ? p.action.t / p.action.duration : -1;
    o.slow = Math.hypot(p.vel.x, p.vel.z);
    s.press({ fire: true, slot: 0 }); s.fastForward(0.1); o.cancel = !p.action; s.press(null);
    s.give('bandage'); s.fastForward(0.3); p.health = 40; s.press({ fire: true }); s.fastForward(4.0); o.hp = p.health; s.press(null);
    s.give('minishield'); s.fastForward(0.3); p.shield = 40; s.press({ fire: true }); s.fastForward(2.4); o.sh = p.shield; s.press(null);
    return o;
  });
  check(P('繃帶：血量 ≥75 不可用'), cons.cap);
  check(P('繃帶：按住開始並顯示進度'), cons.start && cons.prog > 0.2 && cons.prog < 0.5, cons.prog);
  check(P('切欄位取消使用'), cons.cancel);
  check(P('繃帶 +15（上限 75）'), Math.abs(cons.hp - 55) < 0.01, cons.hp);
  check(P('小護盾瓶 +25 上限 50'), cons.sh === 50, cons.sh);

  // ---- 近戰與弱點 ----
  const tree = await sw(() => {
    const s = window.__sw, c = s.ctx, p = c.player; const T = c.world.treeRefs.find((r) => !r.dead && Math.hypot(r.x - 8, r.z - 30) > 30 && c.terrain.heightAt(r.x, r.z) > 3);
    // 站在樹南邊 1.8 m，面向樹
    s.teleport(T.x, T.z + 1.9); const yaw = 0; s.look(yaw, 0.0); s.fastForward(0.2);
    return { x: T.x, z: T.z, y: T.y };
  });
  await sw(() => { const s = window.__sw; s.give('ar', 1); s.press({ slot: 0 }); s.fastForward(0.4); s.press(null); s.fastForward(0.3); });
  // 以相機射線對準樹幹中段
  const aimTree = () => sw((t) => { const s = window.__sw, c = s.ctx; for (let i = 0; i < 4; i++) { const cp = c.camera.position, ty = t.y + 1.2; s.look(Math.atan2(-(t.x - cp.x), -(t.z - cp.z)), Math.atan2(ty - cp.y, Math.hypot(t.x - cp.x, t.z - cp.z))); s.fastForward(0.05); } }, tree);
  await aimTree(); await clearEv();
  await sw(() => { window.__sw.ctx.player.inventory.mats.wood = 100; });
  const wood0 = await sw(() => window.__sw.ctx.player.inventory.mats.wood);
  await sw(() => { const s = window.__sw; s.press({ fire: true }); s.fastForward(0.1); });
  const noHitYet = await sw(() => window.__sw.ctx.player.inventory.mats.wood);
  check(P('揮擊命中延遲 ~0.18 s'), noHitYet === wood0, `${wood0}->${noHitYet}`);
  await sw(() => window.__sw.fastForward(0.16));
  const w1 = await sw(() => window.__sw.ctx.player.inventory.mats.wood);
  check(P('採集木材 +7'), w1 - wood0 === 7, w1 - wood0);
  await sw(() => window.__sw.press(null));
  const wk = await sw(() => { const w = window.__sw.ctx.combat.weakPoint; return { active: w.active, p: w.point.toArray(), n: w.normal.toArray() }; });
  check(P('弱點出現'), wk.active, JSON.stringify(wk));
  await sw(() => { window.__sw.fastForward(0.6); });
  // 瞄準弱點再揮一次 → ×2
  await sw(() => {
    const s = window.__sw, c = s.ctx; for (let i = 0; i < 5; i++) { const cp = c.camera.position, w = c.combat.weakPoint.point; s.look(Math.atan2(-(w.x - cp.x), -(w.z - cp.z)), Math.atan2(w.y - cp.y, Math.hypot(w.x - cp.x, w.z - cp.z))); s.fastForward(0.05); }
  });
  await shot('weakpoint');
  await clearEv();
  const wood1 = await sw(() => window.__sw.ctx.player.inventory.mats.wood);
  await sw(() => { const s = window.__sw; s.press({ fire: true }); s.fastForward(0.25); s.press(null); });
  const w2 = await sw(() => window.__sw.ctx.player.inventory.mats.wood);
  const weakEv = await sw(() => window.__ev.filter((x) => x.n === 'harvest').map((x) => x.e.weakPoint));
  check(P('命中弱點 ×2 材料（14）'), w2 - wood1 === 14 && weakEv[0] === true, `${w2 - wood1} ${JSON.stringify(weakEv)}`);

  // ---- 狙擊彈道 ----
  // 找一個站位與方向，使 D 公尺外的目標與眼睛之間沒有遮蔽
  await sw(() => {
    window.__findShot = (D) => {
      const s = window.__sw, c = s.ctx, T = c.THREE;
      for (let k = 0; k < 4000; k++) {
        const x = -250 + Math.random() * 500, z = -250 + Math.random() * 500, hh = c.terrain.heightAt(x, z); if (hh < 3) continue;
        const yaw = Math.random() * 6.28, bx = x - Math.sin(yaw) * D, bz = z - Math.cos(yaw) * D, bh = c.terrain.heightAt(bx, bz); if (bh < 3 || Math.abs(bx) > 380 || Math.abs(bz) > 380) continue;
        const eye = new T.Vector3(x, hh + 1.6, z), tgt = new T.Vector3(bx, bh + 1.1, bz), dir = tgt.clone().sub(eye), L = dir.length(); dir.divideScalar(L);
        if (c.physics.raycast(eye, dir, L - 1, {})) continue; let ok = true; for (let d = 4; d < L - 8; d += 4) { const px = eye.x + dir.x * d, pz = eye.z + dir.z * d; if (eye.y + dir.y * d - Math.max(0, c.terrain.heightAt(px, pz)) < 1.2) { ok = false; break; } } if (ok) return { x, z, yaw, bx, bz };
      }
      return null;
    };
  });
  await sw(() => {
    // 站定位並把 bot 放在 D 公尺外；以實際眼睛位置確認視線無遮蔽，否則換地點重試
    window.__setupShot = (D) => {
      const s = window.__sw, c = s.ctx, p = c.player, T = c.THREE;
      for (let n = 0; n < 12; n++) {
        const sp = window.__findShot(D) || window.__findShot(D * 0.6); if (!sp) continue;
        s.teleport(sp.x, sp.z); s.look(sp.yaw, 0); s.fastForward(0.3);
        const id = c.actors.findIndex((q, i) => i > 0 && q.alive), b = c.actors[id];
        b.pos.set(sp.bx, c.terrain.heightAt(sp.bx, sp.bz) + 0.05, sp.bz); b.vel.set(0, 0, 0); b.state = 'ground'; b.grounded = true; b.health = 100; b.shield = 0; s.fastForward(0.1);
        const eye = p.eyePos(new T.Vector3()), tgt = new T.Vector3(b.pos.x, b.pos.y + 1.0, b.pos.z), dir = tgt.clone().sub(eye), L = dir.length(); dir.divideScalar(L);
        if (!c.physics.raycast(eye, dir, L - 1, {})) return id;
      }
      return -1;
    };
  });
  const snipe = await sw(() => {
    const s = window.__sw, c = s.ctx, p = c.player; let res = null;
    for (let attempt = 0; attempt < 4; attempt++) {   // 路徑上偶有樹幹，換地點重試
      s.give('sniper', 3); s.fastForward(0.8);
      const id = window.__setupShot(100); const b = c.actors[id]; s.aimAt(id);
      s.fastForward(0.3);
      let hit = -1;
      s.press({ ads: true }); s.fastForward(0.4); const t0 = c.time.now; s.press({ ads: true, fire: true }); s.fastForward(1 / 60); s.press({ ads: true });
      const active = c.combat.projectiles.filter((q) => q.active).length;
      for (let i = 0; i < 90 && hit < 0; i++) { s.fastForward(1 / 60); if (b.health < 100 || !b.alive) hit = c.time.now - t0; }
      s.aimAt(null); s.press(null);
      res = { active, hit, health: b.health, alive: b.alive, attempt };
      if (hit > 0) break;
    }
    return res;
  });
  check(P('狙擊是彈道：發射後有飛行中的子彈'), snipe.active >= 1, snipe.active);
  check(P('狙擊 100 m 飛行時間 0.2–0.4 s 並擊殺'), snipe.hit > 0.2 && snipe.hit < 0.4 && !snipe.alive, JSON.stringify(snipe));
  const drop = await sw(() => {
    const s = window.__sw, c = s.ctx, p = c.player; s.give('sniper', 3); s.fastForward(0.8);
    let id = window.__setupShot(330); if (id < 0) id = window.__setupShot(250); const b = c.actors[id]; s.aimAt(id);
    s.fastForward(0.3); s.press({ ads: true }); s.fastForward(0.4); s.press({ ads: true, fire: true }); s.fastForward(1 / 60); s.press(null); s.fastForward(2); s.aimAt(null);
    return { id, health: b.health, alive: b.alive };
  });
  check(P('狙擊 330 m 子彈下墜而未命中'), drop.alive && drop.health === 100, JSON.stringify(drop));

  // ---- 傷害數字資料：護盾／血量／爆頭 ----
  const dmg = await sw(() => {
    const s = window.__sw, c = s.ctx; s.teleport(8, 30); s.give('ar', 0); s.fastForward(0.8); window.__ev.length = 0;
    const id = s.spawnBotNear(10); const b = c.actors[id]; b.health = 100; b.shield = 20;
    let got = null; c.events.on('damage', (d) => { if (d.target === b && !got) got = { sd: d.shieldDamage, hd: d.healthDamage, pt: !!d.point, amount: d.amount }; });
    s.aimAt(id); s.fastForward(0.2); s.press({ fire: true }); s.fastForward(1.5); s.press(null); s.aimAt(null);
    return got;
  });
  check(P('damage 事件含 shield/health/point'), dmg && dmg.pt && dmg.amount > 0, JSON.stringify(dmg));

  // ---- 寶箱與撿取 ----
  const chest = await sw(() => {
    const s = window.__sw, c = s.ctx, p = c.player; s.teleport(8, 30); s.look(0, -0.2); const o = {};
    s.give('pistol', 0); s.press({ slot: 0 }); s.fastForward(0.4); s.press(null);
    const ch = s.spawnChest(1.6); const n0 = c.loot.pickups.length; o.n0 = n0;
    s.press({ interact: true }); s.fastForward(0.7); o.half = ch.opened; s.fastForward(0.9); o.opened = ch.opened; s.press(null);
    o.spawned = c.loot.pickups.length - n0; o.flying = c.loot.flying.length;
    const near = c.loot.nearestChest(p.pos, 60); o.nearest = near ? near.chest !== ch : null;
    return o;
  });
  check(P('寶箱按住 E 未滿 1.4 s 不開，滿了才開'), !chest.half && chest.opened, JSON.stringify(chest));
  check(P('寶箱噴出 4 件（武器/消耗品/彈藥/材料）'), chest.spawned === 4, chest.spawned);
  await sw(() => window.__sw.fastForward(2.0));
  const afterChest = await sw(() => {
    const c = window.__sw.ctx, p = c.player, left = c.loot.pickups.filter((q) => q.item.kind === 'ammo' || q.item.kind === 'mats').length;
    return { left, flying: c.loot.flying.length, nearestPickup: (() => { const n = c.loot.nearestPickup(p); return n ? { kind: n.kind, dist: +n.dist.toFixed(2), name: n.item && n.item.defId } : null; })() };
  });
  check(P('彈藥與材料落地後可自動撿取（或在範圍外）'), afterChest.flying === 0, JSON.stringify(afterChest));
  // 滿背包 E 換槍
  const swap = await sw(() => {
    const s = window.__sw, c = s.ctx, p = c.player, inv = p.inventory; s.teleport(60, 60); s.look(0, 0);
    inv.slots = [null, null, null, null, null];
    for (const d of ['ar', 'pump', 'smg', 'sniper', 'pistol']) s.give(d, 2);
    inv.selected = 2; const held = inv.current();
    const pk = s.dropItem('smg', 4, 0.0); pk.pos.set(p.pos.x + 0.6, p.pos.y, p.pos.z); pk.fly = null; c.loot.flying = c.loot.flying.filter((q) => q !== pk);
    const near = c.loot.nearestPickup(p); const rep = near && near.replaces && near.replaces.defId;
    s.fastForward(0.3); s.press({ interact: true }); s.fastForward(0.1); s.press(null); s.fastForward(0.3);
    const dropped = c.loot.pickups.find((q) => q.item === held);
    return { rep, now: inv.current().defId + inv.current().rarity, dropped: !!dropped };
  });
  check(P('滿背包撿起 = 換掉手上武器並丟出舊的'), swap.rep === 'pump' && swap.now === 'smg3' && swap.dropped, JSON.stringify(swap));
  const swapC = await sw(() => {
    const s = window.__sw, c = s.ctx, p = c.player, inv = p.inventory; inv.selected = 2; const held = inv.current();
    const pk = s.dropItem('medkit', 2, 0); pk.pos.set(p.pos.x + 0.6, p.pos.y, p.pos.z); pk.fly = null; c.loot.flying = c.loot.flying.filter((q) => q !== pk);
    const near = c.loot.nearestPickup(p); const rep = near && near.replaces && near.replaces.defId; let full = 0; const f = () => full++; c.events.on('inventoryFull', f);
    s.fastForward(0.3); s.press({ interact: true }); s.fastForward(0.1); s.press(null); s.fastForward(0.3); c.events.off('inventoryFull', f);
    return { rep, now: inv.current() && inv.current().defId, full, dropped: !!c.loot.pickups.find((q) => q.item === held) };
  });
  check(P('滿背包撿起醫療包 = 換掉手上物品（不是 inventoryFull）'), swapC.now === 'medkit' && swapC.full === 0 && swapC.dropped && swapC.rep, JSON.stringify(swapC));

  // ---- 死亡掉落 ----
  const dd = await sw(() => {
    const s = window.__sw, c = s.ctx, p = c.player; s.teleport(8, 30); s.fastForward(0.3);
    const id = s.spawnBotNear(8); const b = c.actors[id];
    b.inventory.add({ uid: 99999, defId: 'ar', kind: 'weapon', rarity: 3, mag: 30, count: 1 }); b.inventory.addAmmo('medium', 60); b.inventory.addMat('wood', 50);
    const n0 = c.loot.pickups.length; b.takeDamage(999, { ignoreShield: true, source: p }); s.fastForward(0.1);
    return { added: c.loot.pickups.length - n0, flying: c.loot.flying.length };
  });
  check(P('死亡掉落：武器、彈藥、材料'), dd.added >= 3, JSON.stringify(dd));

  // ================= 視覺截圖 =================
  // 相機前方 d 公尺、側移 side 公尺的地面點
  await sw(() => {
    window.__front = (d, side = 0, up = 0) => { const c = window.__sw.ctx, cam = c.camera, T = c.THREE, f = new T.Vector3(); cam.getWorldDirection(f); f.y = 0; f.normalize(); const r = new T.Vector3(-f.z, 0, f.x); const x = cam.position.x + f.x * d + r.x * side, z = cam.position.z + f.z * d + r.z * side; return new T.Vector3(x, c.physics.groundHeight(x, z, 1000, 0.2).y + up, z); };
  });
  // 1) 戰鬥特效：槍口閃光、曳光、彈著、貼花
  await sw(() => { const s = window.__sw, c = s.ctx; s.teleport(8, 30); s.look(0.25, -0.02); c.loot.clear(); c.fx.clear(); s.press({ slot: 0 }); s.fastForward(0.2); s.press(null); s.give('ar', 3); s.fastForward(0.7); });
  await wait(300);
  await sw(() => { window.__sw.press({ fire: true }); });
  await wait(260);
  await sw(() => { window.__sw.ctx.fx.hold = true; });
  await wait(200); await shot('fx-shoot');
  await sw(() => { const s = window.__sw; s.press(null); s.ctx.fx.hold = false; });

  // 2) 各表面彈著並排
  await sw(() => {
    const s = window.__sw, c = s.ctx; s.teleport(8, 30); s.look(0.25, -0.18); s.fastForward(0.3); c.fx.clear();
    const surf = ['grass', 'dirt', 'sand', 'wood', 'stone', 'metal', 'flesh', 'shield'];
    surf.forEach((sf, i) => {
      const stand = sf === 'wood' || sf === 'stone' || sf === 'metal', body = sf === 'flesh' || sf === 'shield';
      const pt = window.__front(5.2, (i - 3.5) * 0.8 + 0.6, stand ? 0.9 : body ? 1.3 : 0.02);
      c.events.emit('impact', { point: pt, normal: stand ? new c.THREE.Vector3(0, 0, 1) : new c.THREE.Vector3(0, 1, 0.3).normalize(), surface: sf, kind: stand ? 'build' : body ? undefined : 'terrain', actor: body ? c.actors[3] : null, head: sf === 'shield', owner: null, weapon: 'ar' });
    });
  });
  await wait(70);
  await sw(() => { window.__sw.ctx.fx.hold = true; });
  await wait(200); await shot('fx-surfaces');
  await sw(() => { window.__sw.ctx.fx.hold = false; });

  // 3) 戰利品展示：各稀有度光柱、消耗品、彈藥、材料、寶箱
  await sw(() => {
    const s = window.__sw, c = s.ctx, p = c.player; s.teleport(8, 30); s.look(0.25, -0.1); s.fastForward(0.3); c.fx.clear(); c.loot.clear();
    const items = [['ar', 4], ['pump', 3], ['sniper', 2], ['smg', 1], ['pistol', 0], ['medkit', 0], ['shield', 0], ['bandage', 0], ['minishield', 0], ['ammo_heavy', 0], ['ammo_medium', 0], ['mat_metal', 0]];
    items.forEach(([d, rar], i) => {
      const row = (i / 6) | 0, col = i % 6, pt = window.__front(6 + row * 3, (col - 2.5) * 1.8, 0);
      const pk = s.dropItem(d, rar, 0); pk.pos.copy(pt); pk.fly = null;
    });
    c.loot.flying.length = 0;
    const ch = s.spawnChest(0); const pt = window.__front(14, 0, 0); ch.x = pt.x; ch.y = pt.y; ch.z = pt.z; ch.yaw = Math.atan2(c.camera.position.x - pt.x, c.camera.position.z - pt.z) + Math.PI;
    s.fastForward(0.5);
  });
  await wait(1500); await shot('loot');
  const cc = await sw(() => ({ calls: window.__sw.stats().drawCalls }));
  check(P('戰利品展示 draw calls ≤ 350'), cc.calls <= 350, cc.calls);
  // 寶箱開啟瞬間
  await sw(() => { const s = window.__sw, c = s.ctx; s.teleport(8, 30); s.look(0.25, -0.12); s.fastForward(0.3); c.fx.clear(); c.loot.clear(); const ch = s.spawnChest(0); const pt = window.__front(5.5, 0.8, 0); ch.x = pt.x; ch.y = pt.y; ch.z = pt.z; ch.yaw = Math.atan2(c.camera.position.x - pt.x, c.camera.position.z - pt.z) + Math.PI; s.fastForward(0.3); });
  await wait(800); await shot('chest-closed');
  await sw(() => { const c = window.__sw.ctx; c.loot.openChest(c.player, c.loot.chests[0]); });
  await wait(140); await shot('chest-open');
  await wait(1400); await shot('chest-open2');

  // 4) 建造粉塵 / 破壞碎片
  await sw(() => {
    const s = window.__sw, c = s.ctx, p = c.player; c.loot.clear(); c.fx.clear(); s.teleport(26, 33); s.look(0, -0.15); s.give('ar', 2); s.fastForward(0.6); s.press({ piece: 'wall', fire: true }); s.fastForward(0.1);
  });
  await wait(250); await shot('build-dust');
  await sw(() => { const s = window.__sw, c = s.ctx; s.press(null); s.fastForward(0.4); const pcs = [...c.build.pieces.values()]; const last = pcs[pcs.length - 1]; if (last) last.takeDamage(9999, { source: c.player }); });
  await wait(220); await shot('build-break');

  // 5) 護盾破裂
  await sw(() => {
    const s = window.__sw, c = s.ctx; c.loot.clear(); c.fx.clear(); s.teleport(8, 30); s.look(0, 0); s.give('ar', 3); s.fastForward(0.8); const id = s.spawnBotNear(7); const b = c.actors[id]; b.health = 100; b.shield = 8; s.aimAt(id); s.fastForward(0.2);
    s.press({ fire: true }); s.fastForward(0.35); s.press(null); c.fx.hold = true;
  });
  await wait(250); await shot('shield-break');
  await sw(() => { window.__sw.ctx.fx.hold = false; window.__sw.aimAt(null); });

  // 6) 狙擊彈道曳光（飛行中）
  await sw(() => {
    const s = window.__sw, c = s.ctx; c.loot.clear(); c.fx.clear(); s.teleport(8, 30); s.look(0.3, 0.03); s.give('sniper', 4); s.fastForward(1); s.press({ ads: false, fire: true }); s.fastForward(0.03); s.press(null);
  });
  await wait(90);
  await sw(() => { window.__sw.ctx.fx.hold = true; });
  await wait(200); await shot('sniper-trail');
  await sw(() => { window.__sw.ctx.fx.hold = false; });

  const stats = await sw(() => window.__sw.stats());
  check(P('無 uncaught exception'), log.pageerrors.length === 0, log.pageerrors.slice(0, 3));
  check(P('無 console.error'), log.errors.length === 0, log.errors.slice(0, 3));
  check(P('無外部請求'), log.external.length === 0, log.external.slice(0, 3));
  console.log(name, JSON.stringify(stats));
  await browser.close();
}
await run('desktop', 1440, 900, false);
await run('mobile', 390, 844, true);
console.log(JSON.stringify({ ok: failed === 0, failed }));
process.exit(failed ? 1 : 0);
