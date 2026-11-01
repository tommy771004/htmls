// 六器鏢行 — 規則引擎與網路協定單元測試（node:test）
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getElementalMultiplier, getIronShirtAlpha, getSkillScaling,
  computeDerivedStats, resolveCombatHit, attemptWeaponUpgrade,
} from '../src/core/combat.js';
import { createGameWorld } from '../src/core/world_sim.js';
import { OPCODES } from '../src/core/proto.js';

test('五行相剋增減傷公式（金剋木、木剋土、土剋水、水剋火、火剋金 = 1.25x / 反剋 0.80x）', () => {
  assert.equal(getElementalMultiplier(1, 2), 1.25); // 金剋木
  assert.equal(getElementalMultiplier(2, 5), 1.25); // 木剋土
  assert.equal(getElementalMultiplier(5, 3), 1.25); // 土剋水
  assert.equal(getElementalMultiplier(3, 4), 1.25); // 水剋火
  assert.equal(getElementalMultiplier(4, 1), 1.25); // 火剋金
  assert.equal(getElementalMultiplier(1, 4), 0.80); // 金被火反剋
  assert.equal(getElementalMultiplier(1, 3), 1.00); // 非相剋
});

test('四維基礎屬性公式（STR/AGI/CON/INT）與《鐵衣訣》罡氣吸收率 α（0.70 -> 0.85）', () => {
  assert.equal(getIronShirtAlpha(1, false), 0.70);
  assert.equal(getIronShirtAlpha(12, false), 0.85);
  const s1 = computeDerivedStats(
    { statStr: 10, statAgi: 10, statCon: 10, statInt: 10, level: 10, loadoutId: 1, rebirthStage: 0 },
    { type: 'BLADE', baseAtk: 50, upgrade: 0, gems: [] },
    { 801: { layer: 1 } }
  );
  const s2 = computeDerivedStats(
    { statStr: 20, statAgi: 20, statCon: 20, statInt: 20, level: 10, loadoutId: 1, rebirthStage: 0 },
    { type: 'BLADE', baseAtk: 50, upgrade: 0, gems: [] },
    { 801: { layer: 12 } }
  );
  assert.equal(s2.maxWeight - s1.maxWeight, 150); // +10 STR => +150 負重
  assert.equal(s2.maxHp - s1.maxHp, 180);         // +10 CON => +180 HP
  assert.equal(s2.maxMp - s1.maxMp, 120);         // +10 INT => +120 MP
  assert.equal(s2.shieldAlpha, 0.85);
});

test('罡氣傷害分攤與破罡：情況 A（充足）、情況 B（破罡 1.15x 易傷 + 0.5s 硬直）、情況 C（無罡氣全傷）', () => {
  // 情況 A：D_raw = 200, alpha = 0.70, beta = 1.0 => 罡氣扣 140，HP 扣 60
  const resA = resolveCombatHit({
    atkValue: 250, skillMult: 1.0, breakBeta: 1.0, targetDef: 50,
    targetCurShield: 300, targetCurHp: 500, targetAlpha: 0.70,
  });
  assert.equal(resA.caseType, 'A');
  assert.equal(resA.shieldAbsorbed, 140);
  assert.equal(resA.hpDamage, 60);
  assert.equal(resA.isShieldBroken, false);

  // 情況 B：罡氣僅剩 70 (< 140)，破罡
  // HP 傷害 = round(200*(1-0.7) + (200*0.7 - 70/1.0)*1.15) = round(60 + 70*1.15) = round(140.5) = 141
  const resB = resolveCombatHit({
    atkValue: 250, skillMult: 1.0, breakBeta: 1.0, targetDef: 50,
    targetCurShield: 70, targetCurHp: 500, targetAlpha: 0.70,
  });
  assert.equal(resB.caseType, 'B');
  assert.equal(resB.isShieldBroken, true);
  assert.equal(resB.remShield, 0);
  assert.equal(resB.hpDamage, 141);
  assert.equal(resB.staggerSec, 0.5);

  // 情況 C：無罡氣，承受 100% D_raw = 200
  const resC = resolveCombatHit({
    atkValue: 250, skillMult: 1.0, breakBeta: 1.0, targetDef: 50,
    targetCurShield: 0, targetCurHp: 500, targetAlpha: 0.70,
  });
  assert.equal(resC.caseType, 'C');
  assert.equal(resC.hpDamage, 200);
});

test('第十三重「通玄」倍率 +35%、破罡 +20%，與爐溫滿 100% 必成', () => {
  const lv12 = getSkillScaling(101, 12, false);
  const lv13 = getSkillScaling(101, 13, true);
  assert.ok(Math.abs(lv13.mult / lv12.mult - 1.35) < 0.001);
  assert.ok(Math.abs(lv13.breakBeta / lv12.breakBeta - 1.20) < 0.001);

  const wpn = { uid: 'test', baseAtk: 60, upgrade: 5, pity: 0 };
  // +5 -> +6 為必成區間
  const r6 = attemptWeaponUpgrade(wpn, { rng: () => 0.99 });
  assert.equal(r6.success, true);
  assert.equal(wpn.upgrade, 6);

  // 連續失敗爐溫累積至 100% 後必定鍛成 +7
  attemptWeaponUpgrade(wpn, { useProtectScroll: true, rng: () => 0.99 });
  attemptWeaponUpgrade(wpn, { useProtectScroll: true, rng: () => 0.99 });
  attemptWeaponUpgrade(wpn, { useProtectScroll: true, rng: () => 0.99 });
  attemptWeaponUpgrade(wpn, { useProtectScroll: true, rng: () => 0.99 });
  assert.equal(wpn.pity, 100);
  const rPity = attemptWeaponUpgrade(wpn, { useProtectScroll: true, rng: () => 0.99 });
  assert.equal(rPity.success, true);
  assert.equal(rPity.guaranteedByPity, true);
  assert.equal(wpn.upgrade, 7);
});

test('匣中取器封包 C2S_CastLinkedSkill 單一 Tick 切兵器出招、偃甲 7s 上機打斷與遺墟 0 樞力、換手', () => {
  const world = createGameWorld({ restoreSave: false });
  // 移到練功樁旁測試單封包切兵器出招（由白蠟長槍切成柳葉飛針施放 601 碎雨飛針）
  world.char.x = 13.5;
  world.char.z = 7.5;
  assert.equal(world.char.activeWeaponUid, 'wpn-spear-01');
  const castRes = world.castLinkedSkill(601, { targetId: 'dummy-1' });
  assert.equal(castRes.ok, true);
  assert.equal(world.char.activeWeaponUid, 'wpn-thrown-01');
  assert.equal(world.net.packetLog[0].opcode, OPCODES.S2C_COMBAT_DAMAGE_RESULT);

  // 偃甲 7 秒上機：承受超過 30% 最大 HP 傷害即打斷並冷卻 15 秒
  world.toggleMechSummon();
  assert.equal(world.char.mechPhase, 'CASTING_7S');
  world.char.curShield = 0; // 無罡氣下承受重擊
  world.applyDamageToHero({ name: '測試劫鏢匪', element: 4 }, world.char.maxHp * 0.55, 1.0, 1.0, { bypassDodge: true });
  assert.equal(world.char.mechPhase, 'COOLDOWN');
  assert.equal(world.char.mechCdRem, 15.0);

  // 冷卻結束後在地脈之外上機：每 5 秒扣 40 樞力；到偃師遺墟（2001）後 0 消耗
  world.advance(15.2);
  world.toggleMechSummon();
  world.advance(7.2); // 7.2s 完成上機
  assert.equal(world.char.mechPhase, 'ACTIVE_MERGED');
  const gearBeforeCentral = world.char.curGear;
  world.advance(5.2); // 5.2s 地脈之外消耗 40 樞力
  assert.equal(world.char.curGear, gearBeforeCentral - 40);

  world.changeMap(2001); // 偃師遺墟
  const gearBeforeRuins = world.char.curGear;
  world.advance(6.0); // 6.0s 遺墟 0 消耗
  assert.equal(world.char.curGear, gearBeforeRuins);

  // 換手快照（< 300ms）
  const handoff = world.performSessionHandoff('mobile');
  assert.equal(handoff.to_device, 'MOBILE_TOUCH');
  assert.ok(handoff.handoff_latency_ms < 300);
});

test('四季玉珮：每一枚的 id 都對得上 combat.js 的加成（開脈後生效）', async () => {
  const { JADE_CHARMS } = await import('../src/core/data.js');
  const charBase = { statStr: 10, statAgi: 10, statCon: 10, statInt: 10, level: 30, loadoutId: 1, rebirthStage: 1 };
  const wpn = { type: 'BLADE', baseAtk: 50, upgrade: 0, gems: [] };
  const sig = (s) => [s.moveSpeed, s.weaponAtk, s.critDmg, s.maxShield, s.physDef].join('|');
  const base = sig(computeDerivedStats(charBase, wpn, {}, [], []));
  for (const charm of JADE_CHARMS) {
    assert.notEqual(sig(computeDerivedStats(charBase, wpn, {}, [], [{ ...charm, tier: 1 }])), base, charm.id);
  }
  // 凡身（未開脈）不吃玉珮加成
  const plain = { ...charBase, rebirthStage: 0 };
  assert.equal(
    sig(computeDerivedStats(plain, wpn, {}, [], JADE_CHARMS)),
    sig(computeDerivedStats(plain, wpn, {}, [], [])),
  );
});

test('烽燧點過不能重點、淬紋槽有上限、內力不足且藥在冷卻時不出招、讀條中再按一次取消上機', () => {
  const world = createGameWorld({ restoreSave: false, persist: false });
  world.changeMap(1002);
  const real = world.beacons.find((b) => b.isTrue);
  world.char.x = real.x; world.char.z = real.z + 1;
  assert.equal(world.igniteNearestBeacon().ok, true);
  world.advance(2.6);
  assert.equal(real.revealed, true);
  const silver = world.char.silver;
  const again = world.igniteNearestBeacon();
  assert.equal(again.ok, false);
  assert.equal(again.reason, 'ALREADY_HELD');
  world.advance(2.6);
  assert.equal(world.char.silver, silver);

  // 開脈 3 槽、預設已鑲 2 顆：只能再買 1 顆
  world.char.silver = 99999;
  assert.equal(world.buyStallItem('stall-5', 'st-item-9').ok, true);
  const full = world.buyStallItem('stall-5', 'st-item-10');
  assert.equal(full.reason, 'TEMPER_FULL');
  assert.equal(world.equippedTemperStones.length, 3);

  world.changeMap(1001);
  world.char.x = 13.5; world.char.z = 7.5;
  world.char.curMp = 0;
  world.char.potionCd = 1.2;
  const r = world.castLinkedSkill(701, { targetId: 'dummy-1' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'NO_MP');

  world.toggleMechSummon();
  assert.equal(world.char.mechPhase, 'CASTING_7S');
  world.toggleMechSummon();
  assert.equal(world.char.mechPhase, 'INACTIVE');
});

test('存檔帶上懸紅、烽燧、玉珮與淬紋石，重新載入後不會重領懸紅', () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  try {
    const a = createGameWorld({ restoreSave: false });
    a.bounties[0].status = 'CLAIMED';
    a.beacons[1].revealed = true;
    a.beacons[1].owner = '陸遠行';
    a.jadeCharms[0].tier = 3;
    a.equippedTemperStones.push('ATK_FEROCITY');
    a.save();
    const b = createGameWorld({ restoreSave: true });
    assert.equal(b.bounties[0].status, 'CLAIMED');
    assert.equal(b.beacons[1].revealed, true);
    assert.equal(b.jadeCharms[0].tier, 3);
    assert.deepEqual(b.equippedTemperStones, ['DEF_SHIELD', 'DEF_HP', 'ATK_FEROCITY']);
    // persist=false（?fresh=1）不寫回
    const c = createGameWorld({ restoreSave: false, persist: false });
    c.char.silver = 1;
    c.save();
    assert.notEqual(createGameWorld({ restoreSave: true }).char.silver, 1);
  } finally {
    delete globalThis.localStorage;
  }
});

test('不可走區：鏢局院子進不去；出生點、攤位、烽燧、傳送口、NPC 都在可走處且走得到', async () => {
  const { MAPS, MAP_BLOCKERS, INITIAL_STALLS } = await import('../src/core/data.js');
  const world = createGameWorld({ restoreSave: false, persist: false });
  const inside = (mapId, x, z, r = 0) => world.isBlocked(x, z, r, mapId);
  for (const [id, m] of Object.entries(MAPS)) {
    const mapId = Number(id);
    assert.ok(MAP_BLOCKERS[mapId]?.length > 0, `地圖 ${id} 有不可走區`);
    assert.equal(inside(mapId, m.spawn.x, m.spawn.z, 0.4), false, `${m.name} 出生點`);
    // 傳送口觸發半徑 1.75：圓心周圍要有可站的地方（圓心本身不在建築裡）
    for (const p of m.portals) assert.equal(inside(mapId, p.x, p.z, 0.4), false, `${m.name} 傳送口 (${p.x}, ${p.z})`);
  }
  // 攤位：客人站在攤位前 1.4 m（朱砂引路線的終點）
  for (const st of INITIAL_STALLS) assert.equal(inside(1001, st.x, st.z + 1.4, 0.4), false, `攤位 ${st.owner}`);
  // NPC（祁鏢頭、阿檀在門前帳桌）
  for (const [x, z] of [[2.4, 19.2], [-2.9, 19.6]]) assert.equal(inside(1001, x, z, 0.4), false, `鏢局門前 NPC (${x}, ${z})`);
  // 怪物出生點
  for (const e of world.entities) assert.equal(inside(e.mapId, e.spawnX, e.spawnZ, 0.6), false, `${e.name} 出生點`);

  // 從鏢局門前往北走 4 秒：被院牆擋在 z < 21.3
  world.char.x = 1.5; world.char.z = 19;
  world.advance(4, { moveX: 0, moveZ: 1 });
  assert.ok(world.char.z < 21.3, `走不進鏢局 (z=${world.char.z.toFixed(2)})`);
  // 輕功也穿不進去
  world.char.x = 1.5; world.char.z = 19;
  world.castQinggongDash(0, 1);
  assert.ok(world.char.z < 21.3, `輕功穿不進鏢局 (z=${world.char.z.toFixed(2)})`);

  // 烽燧：三座都能從夯土台外點火（點火距離 4.2）
  world.changeMap(1002);
  for (const b of world.beacons) {
    world.char.x = b.x; world.char.z = b.z + 6;
    world.advance(3, { moveX: 0, moveZ: -1 });
    assert.ok(!world.isBlocked(world.char.x, world.char.z, 0.39), `${b.name} 走到台邊停下`);
    assert.ok(Math.hypot(world.char.x - b.x, world.char.z - b.z) <= 4.2, `${b.name} 點火距離內`);
  }
  // 偃師遺墟：從出生點走得到兩座石環
  world.changeMap(2001);
  for (const p of MAPS[2001].portals) {
    world.char.x = MAPS[2001].spawn.x; world.char.z = MAPS[2001].spawn.z;
    for (let i = 0; i < 200 && Math.hypot(p.x - world.char.x, p.z - world.char.z) > 1.5; i++) {
      const dx = p.x - world.char.x, dz = p.z - world.char.z, l = Math.hypot(dx, dz);
      world.advance(0.05, { moveX: dx / l, moveZ: dz / l });
    }
    assert.ok(Math.hypot(p.x - world.char.x, p.z - world.char.z) <= 1.75, `走到 ${p.label}`);
  }
});

test('失敗回饋：烽燧／服藥／出招失敗會跳字，同一原因 1 秒內只提示一次，冷卻只跳字不寫驛報', () => {
  const world = createGameWorld({ restoreSave: false, persist: false });
  const texts = () => world.floatTexts.map((f) => f.text);
  const logs0 = world.chatLogs.length;
  const r1 = world.igniteNearestBeacon();
  assert.equal(r1.reason, 'WRONG_MAP');
  assert.equal(world.chatLogs.length, logs0 + 1);
  world.igniteNearestBeacon();
  assert.equal(world.chatLogs.length, logs0 + 1, '1 秒內不重複寫驛報');
  world.advance(1.1);
  world.igniteNearestBeacon();
  assert.equal(world.chatLogs.length, logs0 + 2, '過 1 秒再提示');

  world.changeMap(1002);
  world.char.x = 0; world.char.z = 12;
  assert.equal(world.igniteNearestBeacon().reason, 'TOO_FAR');
  assert.ok(texts().some((t) => t.includes('走近一點')));

  world.char.potions.hp = 0;
  assert.equal(world.useSmartPotion('HP_RED', false).reason, 'EMPTY');
  assert.ok(texts().some((t) => t.includes('回春丸吃完了')));
  world.char.potions.shield = 5; world.char.potionCd = 1;
  assert.equal(world.useSmartPotion('SHIELD_CYAN', false).reason, 'POTION_CD');
  // 自動服藥失敗不提示
  const n = world.floatTexts.length;
  world.char.potionCd = 0; world.char.potions.cleanse = 0;
  assert.equal(world.useSmartPotion('CLEANSE_PILL', true).ok, false);
  assert.equal(world.floatTexts.length, n);

  world.changeMap(1001);
  world.char.x = 13.5; world.char.z = 7.5;
  assert.equal(world.castLinkedSkill(101, { targetId: 'dummy-1' }).ok, true);
  const logs1 = world.chatLogs.length;
  const cd = world.castLinkedSkill(101, { targetId: 'dummy-1' });
  assert.equal(cd.reason, 'COOLDOWN');
  assert.ok(cd.cdRem > 0);
  assert.ok(texts().some((t) => t.includes('還要')));
  assert.equal(world.chatLogs.length, logs1, '冷卻不寫驛報');
  world.char.staggerSec = 1;
  assert.equal(world.castLinkedSkill(301).reason, 'STAGGERED');
  assert.ok(texts().includes('硬直中，出不了招'));
});

test('進度：晉升只往上一階或分路，不能降階；鍛爐換五行要烏鋼和銅錢', async () => {
  const { REFORGE_ELEMENT_COST } = await import('../src/core/data.js');
  const world = createGameWorld({ restoreSave: false, persist: false });
  assert.equal(world.char.rebirthStage, 1); // 開脈
  assert.equal(world.advanceRebirth(4).reason, 'NOT_NEXT'); // 跳階
  assert.equal(world.advanceRebirth(0).reason, 'NOT_NEXT'); // 降回凡身
  assert.equal(world.advanceRebirth(1).reason, 'SAME_STAGE');
  assert.equal(world.advanceRebirth(3).ok, true); // 開脈 → 逆鋒（走險一路）
  assert.equal(world.advanceRebirth(2).reason, 'NOT_NEXT'); // 換到另一路
  assert.equal(world.advanceRebirth(1).reason, 'NOT_NEXT'); // 降階
  assert.equal(world.advanceRebirth(4).reason, 'NOT_NEXT'); // 另一路的下一階
  assert.equal(world.advanceRebirth(5).ok, true); // 逆鋒 → 焚心
  assert.equal(world.char.rebirthStage, 5);
  assert.equal(world.advanceRebirth(3).ok, false);

  const w = world.weapons[0];
  const el = w.element, iron = world.char.materials.iron, silver = world.char.silver;
  const r = world.reforgeWeaponElement(w.uid);
  assert.equal(r.ok, true);
  assert.equal(w.element, (el % 5) + 1);
  assert.equal(world.char.materials.iron, iron - REFORGE_ELEMENT_COST.iron);
  assert.equal(world.char.silver, silver - REFORGE_ELEMENT_COST.silver);
  world.char.silver = REFORGE_ELEMENT_COST.silver - 1;
  const poor = world.reforgeWeaponElement(w.uid);
  assert.equal(poor.reason, 'NO_SILVER');
  assert.equal(w.element, (el % 5) + 1, '錢不夠不換');
  world.char.silver = 99999; world.char.materials.iron = 0;
  assert.equal(world.reforgeWeaponElement(w.uid).reason, 'NO_IRON');
});
