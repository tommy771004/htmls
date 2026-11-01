// 六器鏢行 — 抽屜內容（人物、六器匣、鍛爐、偃甲、行會、鏢路圖、懸紅榜、說明）
// 版面：黑漆木櫃底，左右兩欄；資訊卡與清單用麻紙鏢單，選取用靛藍布，確認動作用朱印鈕。

import {
  ELEMENTS, WEAPON_TYPES, REBIRTH_STAGES, REBIRTH_NEXT, REFORGE_ELEMENT_COST, SKILLS, CHARM_TIERS, MECH_TIERS, MAPS, WORLD_MAP_NODES,
} from '../core/data.js';
import { getWeaponAtk, getSkillScaling, getWeaponAuraTier, getWeaponAuraName, UPGRADE_RATES } from '../core/combat.js';
import { weaponSvg, glyphSvg } from './icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const PHASE_NAME = { INACTIVE: '待命', CASTING_7S: '上機中', ACTIVE_MERGED: '已上機', COOLDOWN: '冷卻中' };
const BOUNTY_STATUS = { ACTIVE: '張榜中', ACCEPTED: '已揭榜', CLAIMED: '已結案' };

// 鏢路圖節點字：預設旗在左、字在右（.east 反過來）；跟已排好的節點撞到就依序試「翻到左邊」「字往下掉一行」（.drop），
// 都撞就留撞得最少的。窄地圖（直式、橫式手機）上節點靠得近，固定的左右規則會疊字。
// 碰撞分兩塊量（旗、字各一個外框）：.drop 時字用 transform 下移，按鈕外框不會跟著變，兩塊的聯集又會多算旗旁的空白。
function routeNodeParts(n) {
  return [n.querySelector('.pin'), n.querySelector('.wl')].filter(Boolean).map((e) => e.getBoundingClientRect());
}
function layoutRouteLabels(map) {
  if (!map || !map.isConnected || !map.clientWidth) return;
  const nodes = [...map.querySelectorAll('.wm-node')];
  const placed = [];
  const hit1 = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
  const hit = (A, B) => A.some((a) => B.some((b) => hit1(a, b)));
  const mr = map.getBoundingClientRect();
  const outside = (P) => (P.some((r) => r.left < mr.left - 0.5 || r.right > mr.right + 0.5 || r.bottom > mr.bottom + 0.5) ? 1 : 0);
  // 能玩的三處先排，讓它們保有預設方向
  nodes.sort((a, b) => b.classList.contains('playable') - a.classList.contains('playable'));
  for (const n of nodes) {
    const pref = n.dataset.east === '1';
    const tries = [[pref, false], [!pref, false], [pref, true], [!pref, true]];
    let best = null;
    for (const [east, drop] of tries) {
      n.classList.toggle('east', east);
      n.classList.toggle('drop', drop);
      const parts = routeNodeParts(n);
      const cost = placed.filter((p) => hit(p, parts)).length * 10 + outside(parts) * 5;
      if (!best || cost < best.cost) best = { east, drop, cost, parts };
      if (cost === 0) break;
    }
    n.classList.toggle('east', best.east);
    n.classList.toggle('drop', best.drop);
    placed.push(best.parts);
  }
}

export function createDrawers({ world, sceneView, sfx, ui }) {
  const state = { forgeUid: world.char.activeWeaponUid, martialId: 101, query: '' };

  function skillIcon(sid) {
    const sk = SKILLS[sid];
    return sk?.weapon ? weaponSvg(sk.weapon) : glyphSvg(sid);
  }

  function render(tab, body) {
    const ch = world.char;
    const d = world.getDerived();
    const on = (sel, ev, fn) => body.querySelectorAll(sel).forEach((el) => { el[ev] = (e) => fn(el, e); });
    const rerender = () => render(tab, body);
    body.dataset.view = tab; // CSS 依分頁調版面（直式鏢路圖獨佔整列）；不用 data-tab，hud.js 會把有 data-tab 的元素當頁籤標 active

    if (tab === 'char') {
      const rb = REBIRTH_STAGES[ch.rebirthStage || 0];
      // 晉升只往上走：走過的階位、另一路、還輪不到的，各標一種狀態
      const cur = ch.rebirthStage || 0;
      const passed = new Set();
      for (let s = cur, guard = 0; guard < 8; guard++) {
        const prev = Object.keys(REBIRTH_NEXT).map(Number).find((k) => REBIRTH_NEXT[k].includes(s));
        if (prev === undefined) break;
        passed.add(prev); s = prev;
      }
      const rankBtn = (st) => {
        if (st.stage === cur) return '<span class="tag">現職</span>';
        if ((REBIRTH_NEXT[cur] || []).includes(st.stage)) return `<button type="button" class="btn" data-rebirth="${st.stage}">晉升</button>`;
        if (passed.has(st.stage)) return '<span class="tag dim">已歷</span>';
        const otherPath = rb.path && st.path && st.path !== rb.path;
        return `<button type="button" class="btn" disabled>${otherPath ? '另一路' : '未到'}</button>`;
      };
      const stats = [
        ['STR', '臂力', ch.statStr, '近戰外功 +2.2／點，負重 +15／點'],
        ['AGI', '身法', ch.statAgi, '弓與飛針 +2.4／點，暴擊與閃避微升'],
        ['CON', '根骨', ch.statCon, '生命 +18／點，物防 +1.5／點，拳「沉勁」加成'],
        ['INT', '內息', ch.statInt, '罡氣 +16／點，內力 +12，五行內功 +2.5'],
      ];
      body.innerHTML = `
        <div class="d-pane">
          <div class="card paper">
            <div class="ttl">${esc(ch.name)}</div>
            <div class="sub">${esc(rb.name)}・Lv.${ch.level}・順安鏢局鏢師</div>
            <div class="kv">
              <div><span>外功攻擊</span><b>${d.weaponAtk}</b></div>
              <div><span>五行內功</span><b>${d.innerAtk}</b></div>
              <div><span>物理防禦</span><b>${d.physDef}</b></div>
              <div><span>罡氣吸收 α</span><b>${Math.round(d.shieldAlpha * 100)}%</b></div>
              <div><span>暴擊／暴傷</span><b>${(d.critRate * 100).toFixed(1)}%／${Math.round(d.critDmg * 100)}%</b></div>
              <div><span>負重／移速</span><b>${d.maxWeight}／${d.moveSpeed}</b></div>
              <div><span>銅錢</span><b>${ch.silver}</b></div>
              <div><span>銀票</span><b>${ch.ingots}</b></div>
              <div><span>凶名值</span><b>${ch.karma}</b></div>
              <div><span>聲望</span><b>${ch.fame}</b></div>
            </div>
          </div>
          <h3>四維配點<small>剩 ${ch.freeStatPoints} 點</small></h3>
          <div class="list">
            ${stats.map(([k, n, v, hint]) => `
              <div class="row paper">
                <div><b>${n} ${v}</b><div class="row-sub">${hint}</div></div>
                <button type="button" class="btn" data-add-stat="${k}" ${ch.freeStatPoints <= 0 ? 'disabled' : ''}>加 5</button>
              </div>`).join('')}
          </div>
        </div>
        <div class="d-pane">
          <h3>鏢師階位<small>請祁鏢頭點撥，帳房阿檀登記在冊</small></h3>
          <div class="list">
            ${REBIRTH_STAGES.slice(1).map((st) => `
              <div class="row paper ${ch.rebirthStage === st.stage ? 'sel' : ''}">
                <div><b>${esc(st.name)}</b> <span class="dim">${st.path ? `${esc(st.path)}・` : ''}Lv.${st.reqLv}</span>
                  <div class="row-sub">攻擊 +${st.atkFlat}・屬性攻 +${Math.round(st.elemAmp * 100)}%・淬紋石 ${st.temperSlots} 槽</div></div>
                ${rankBtn(st)}
              </div>`).join('')}
          </div>
          <h3 style="margin-top:14px">四季玉珮<small>養玉露 ${ch.materials.jadeDew}</small></h3>
          <div class="list">
            ${world.jadeCharms.map((c) => `
              <div class="row paper">
                <div><b>${esc(c.name)}</b> <span class="dim">${CHARM_TIERS[c.tier]}・${c.stage} 階</span><div class="row-sub">${esc(c.statLabel)}</div></div>
                <button type="button" class="btn" data-upg-charm="${c.id}" ${c.tier >= 4 || ch.materials.jadeDew <= 0 ? 'disabled' : ''}>${c.tier >= 4 ? '已凝' : (ch.materials.jadeDew <= 0 ? '缺養玉露' : '溫養')}</button>
              </div>`).join('')}
          </div>
        </div>`;
      on('[data-add-stat]', 'onclick', (b) => { world.allocateStat(b.dataset.addStat, Math.min(5, Math.max(1, ch.freeStatPoints))); sfx.playUiTick?.(); rerender(); });
      on('[data-rebirth]', 'onclick', (b) => { if (world.advanceRebirth(Number(b.dataset.rebirth)).ok) sfx.playStamp?.(); rerender(); });
      on('[data-upg-charm]', 'onclick', (b) => { if (world.upgradeJadeCharm(b.dataset.upgCharm)) sfx.playForge(true); rerender(); });
      return;
    }

    if (tab === 'martial') {
      const order = ui.getBoxOrder();
      const sk = SKILLS[state.martialId] || SKILLS[101];
      const m = world.martials[sk.id] || { layer: 1, isTrue: false, linkedWeaponUid: null };
      const sc = getSkillScaling(sk.id, m.layer, m.isTrue);
      const compat = sk.weapon ? world.weapons.filter((w) => w.type === sk.weapon) : [];
      const canTrain = m.layer < 12 ? (ch.materials.martialScroll > 0 || ch.skillPoints >= 150) : ch.materials.trueScroll > 0;
      body.innerHTML = `
        <div class="d-pane">
          <h3>匣中次序<small>鍵 1～6 依此排列，左右挪動隔間</small></h3>
          <div class="list">
            ${order.map((sid, i) => {
              const s = SKILLS[sid];
              const ms = world.martials[sid] || {};
              const w = world.weapons.find((x) => x.uid === ms.linkedWeaponUid);
              return `
                <div class="row paper pick ${sid === sk.id ? 'sel' : ''}" data-pick-martial="${sid}">
                  <div class="row-main">${skillIcon(sid)}<div><b>${i + 1}・${esc(ms.isTrue ? s.trueName : s.name)}</b>
                    <div class="row-sub">${w ? `+${w.upgrade} ${esc(w.name)}` : '未綁兵器'}</div></div></div>
                  <div class="btns">
                    <button type="button" class="btn" data-move="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="往前">前移</button>
                    <button type="button" class="btn" data-move="${i}" data-dir="1" ${i === order.length - 1 ? 'disabled' : ''} aria-label="往後">後移</button>
                  </div>
                </div>`;
            }).join('')}
          </div>
          <h3 style="margin-top:14px">內功與心法<small>鍵 7～9</small></h3>
          <div class="list">
            ${Object.values(SKILLS).filter((s) => s.category === 'INNER_FIVE' || s.category === 'PASSIVE').map((s) => {
              const ms = world.martials[s.id] || { layer: 1 };
              return `<div class="row paper pick ${s.id === sk.id ? 'sel' : ''}" data-pick-martial="${s.id}">
                <div class="row-main">${glyphSvg(s.category === 'PASSIVE' ? 'frenzy' : s.id)}<div><b>${esc(ms.isTrue ? s.trueName : s.name)}</b>
                <div class="row-sub">${ELEMENTS[s.element].name}・${ms.isTrue ? '通玄' : `${ms.layer} 重`}</div></div></div></div>`;
            }).join('')}
          </div>
        </div>
        <div class="d-pane">
          <div class="card paper">
            <div class="ttl">${esc(sc.name)}${m.isTrue ? '<span class="tag xu">通玄</span>' : ''}</div>
            <div class="sub">${m.isTrue ? '第十三重・通玄' : `第 ${m.layer}／12 重`}・${ELEMENTS[sk.element].name}</div>
            <div class="sub">${esc(sk.desc)}</div>
            <div class="kv">
              <div><span>傷害倍率</span><b>${(sc.mult * 100).toFixed(0)}%</b></div>
              <div><span>破罡倍率 β</span><b>${sc.breakBeta.toFixed(2)}×</b></div>
              <div><span>內力消耗</span><b>${sk.mpCost}</b></div>
              <div><span>冷卻</span><b>${sk.cd}s</b></div>
            </div>
            ${sk.weapon ? `
              <label class="lbl" for="selBindWpn">出這招時從匣裡抽哪一把</label>
              <select id="selBindWpn" class="d-select">
                ${compat.map((w) => `<option value="${w.uid}" ${m.linkedWeaponUid === w.uid ? 'selected' : ''}>+${w.upgrade} ${esc(w.name)}（攻擊 ${getWeaponAtk(w)}）</option>`).join('')}
              </select>` : '<div class="sub" style="margin-top:8px">內功與心法徒手施展，不必抽兵器。</div>'}
          </div>
          <div class="btns">
            <button id="btnTrainMartial" type="button" class="btn go wide ${m.isTrue ? 'done' : ''}" ${m.isTrue || !canTrain ? 'disabled' : ''}>
              ${m.isTrue ? '已成第十三重' : (m.layer < 12
                ? (canTrain ? `修煉升重（手札 ${ch.materials.martialScroll}・SP ${ch.skillPoints}）` : `缺手札與 SP（升一重要 150 SP）`)
                : (canTrain ? `突破「通玄」（心得 ${ch.materials.trueScroll}）` : '缺《通玄心得》'))}
            </button>
            ${sk.mult > 0 ? '<button id="btnCastNow" type="button" class="btn wide">試招</button>' : ''}
          </div>
        </div>`;
      on('[data-pick-martial]', 'onclick', (row, e) => {
        if (e.target.closest('[data-move]')) return;
        state.martialId = Number(row.dataset.pickMartial);
        rerender();
      });
      on('[data-move]', 'onclick', (b) => {
        ui.moveBoxSlot(Number(b.dataset.move), Number(b.dataset.dir));
        sfx.playUiTick?.();
        rerender();
      });
      const sel = body.querySelector('#selBindWpn');
      if (sel) sel.onchange = () => { world.bindWeaponToSkill(sk.id, sel.value); ui.rebuildSkillBars(); rerender(); };
      const bt = body.querySelector('#btnTrainMartial');
      bt.onclick = () => {
        const res = world.trainOrBreakthroughSkill(sk.id);
        if (res.ok) { sfx.playSkill(sk.weapon || 'SPEAR', res.isTrue, false); ui.rebuildSkillBars(); rerender(); }
      };
      const bc = body.querySelector('#btnCastNow');
      if (bc) bc.onclick = () => { ui.closeDrawer(); world.castLinkedSkill(sk.id); };
      return;
    }

    if (tab === 'forge') {
      const wpn = world.weapons.find((w) => w.uid === state.forgeUid) || world.weapons[0];
      const next = Math.min(12, wpn.upgrade + 1);
      const rate = wpn.upgrade >= 12 ? 1 : (wpn.pity >= 100 ? 1 : (UPGRADE_RATES[next] || 0.12));
      const aura = `${wpn.upgrade >= 7 ? `+${[0, 7, 9, 12][getWeaponAuraTier(wpn.upgrade)]} ` : ''}${getWeaponAuraName(wpn.upgrade)}`;
      const wt = WEAPON_TYPES[wpn.type];
      body.innerHTML = `
        <div class="d-pane">
          <div class="card paper">
            <div class="row-main">${weaponSvg(wpn.type)}<div>
              <div class="ttl">+${wpn.upgrade} ${esc(wpn.name)}</div>
              <div class="sub">${aura}・${esc(wt.passiveName)}：${esc(wt.passiveDesc)}</div></div></div>
            <div class="kv">
              <div><span>兵器攻擊</span><b>${getWeaponAtk(wpn)}</b></div>
              <div><span>五行</span><b>${ELEMENTS[wpn.element].name}</b></div>
              <div><span>下一重成功率</span><b>${wpn.upgrade >= 12 ? '已滿' : `${Math.round(rate * 100)}%`}</b></div>
              <div><span>烏鋼／護器符</span><b>${ch.materials.iron}／${ch.materials.protectScroll}</b></div>
            </div>
            <span class="lbl">爐溫（失敗累積，滿 100% 下一次必成）</span>
            <div class="heat"><i style="width:${wpn.pity}%"></i><span>${wpn.pity}%${wpn.pity >= 100 ? '・下一次必成' : ''}</span></div>
          </div>
          <div class="btns">
            <button id="btnDoUpgrade" type="button" class="btn go wide" ${wpn.upgrade >= 12 || ch.materials.iron <= 0 ? 'disabled' : ''}>${wpn.upgrade >= 12 ? '已鍛至 +12' : (ch.materials.iron <= 0 ? '缺百鍊烏鋼' : `投烏鋼鍛器，往 +${next}`)}</button>
            <button id="btnCycleElem" type="button" class="btn wide stack" ${ch.materials.iron < REFORGE_ELEMENT_COST.iron || ch.silver < REFORGE_ELEMENT_COST.silver ? 'disabled' : ''}>換五行 → ${ELEMENTS[(wpn.element % 5) + 1].name}<small>烏鋼 ${REFORGE_ELEMENT_COST.iron}・銅錢 ${REFORGE_ELEMENT_COST.silver}</small></button>
          </div>
          <p class="note" style="margin-top:10px">石老鐵的爐子。鍛器時自動貼一張護器符，失手不碎器。</p>
        </div>
        <div class="d-pane">
          <h3>六器匣<small>挑一把上爐</small></h3>
          <div class="list">
            ${world.weapons.map((w) => `
              <div class="row paper pick ${w.uid === wpn.uid ? 'sel' : ''}" data-pick-wpn="${w.uid}">
                <div class="row-main">${weaponSvg(w.type)}<div><b>+${w.upgrade} ${esc(w.name)}</b>
                  <div class="row-sub">${ELEMENTS[w.element].short}・攻擊 ${getWeaponAtk(w)}・爐溫 ${w.pity}%</div></div></div>
                <button type="button" class="btn ${ch.activeWeaponUid === w.uid ? 'on' : ''}" data-equip-now="${w.uid}">${ch.activeWeaponUid === w.uid ? '在手' : '取出'}</button>
              </div>`).join('')}
          </div>
        </div>`;
      on('[data-pick-wpn]', 'onclick', (row, e) => {
        if (e.target.closest('[data-equip-now]')) return;
        state.forgeUid = row.dataset.pickWpn;
        rerender();
      });
      on('[data-equip-now]', 'onclick', (b) => {
        world.char.activeWeaponUid = b.dataset.equipNow;
        state.forgeUid = b.dataset.equipNow;
        world.syncCaps(false);
        ui.rebuildSkillBars();
        rerender();
      });
      body.querySelector('#btnDoUpgrade').onclick = () => {
        const res = world.upgradeWeapon(wpn.uid, { useProtect: true });
        if (res.ok) sfx.playForge(res.success);
        ui.rebuildSkillBars();
        rerender();
      };
      body.querySelector('#btnCycleElem').onclick = () => {
        if (world.reforgeWeaponElement(wpn.uid).ok) sfx.playForge(true);
        ui.rebuildSkillBars();
        rerender();
      };
      return;
    }

    if (tab === 'mech') {
      const t = MECH_TIERS[ch.mechTier];
      const free = !!MAPS[ch.mapId]?.isFreeGearZone;
      body.innerHTML = `
        <div class="d-pane">
          <div class="card paper">
            <div class="row-main">${glyphSvg('mech')}<div><div class="ttl">${esc(t.name)}</div><div class="sub">第 ${ch.mechTier} 階・${PHASE_NAME[ch.mechPhase] || ch.mechPhase}</div></div></div>
            <div class="kv">
              <div><span>樞力</span><b>${free ? '地脈不耗' : `${Math.round(ch.curGear)}／${ch.maxGear}`}</b></div>
              <div><span>承傷分攤</span><b>${Math.round(t.absorb * 100)}%</b></div>
              <div><span>上機攻擊</span><b>+${t.atkBonus}</b></div>
              <div><span>所在</span><b>${esc(MAPS[ch.mapId].name)}</b></div>
            </div>
            <div class="sub" style="margin-top:8px">${free ? '機樞地脈：上機與維持都不耗樞力。' : '地脈之外：坐在偃甲裡每 5 秒耗 40 點樞力。'}上機要讀條 7 秒，期間受創超過三成氣血會被打斷。</div>
          </div>
          <div class="btns">
            <button id="btnDrawerSummonMech" type="button" class="btn go wide">${ch.mechPhase === 'ACTIVE_MERGED' ? '離開偃甲' : (ch.mechPhase === 'CASTING_7S' ? '收起樞輪（取消上機）' : '上機（7 秒）')}</button>
            ${ch.mapId === 2001 ? '' : '<button id="btnInstantOtherworld" type="button" class="btn wide">前往偃師遺墟</button>'}
          </div>
        </div>
        <div class="d-pane">
          <h3>重鑄<small>機樞核心 ${ch.materials.mechCores}</small></h3>
          <div class="list">
            ${[1, 2, 3].map((n) => {
              const ti = MECH_TIERS[n];
              return `<div class="row paper ${ch.mechTier === n ? 'sel' : ''}">
                <div><b>第 ${n} 階・${esc(ti.name)}</b><div class="row-sub">承傷 ${Math.round(ti.absorb * 100)}%・攻擊 +${ti.atkBonus}</div></div>
                ${n === ch.mechTier + 1 ? `<button id="btnUpgMech" type="button" class="btn" ${ch.materials.mechCores < 2 ? 'disabled' : ''}>${ch.materials.mechCores < 2 ? '缺機樞核心' : '耗 2 核心重鑄'}</button>` : `<span class="dim">${ch.mechTier >= n ? '已成' : '待前階'}</span>`}
              </div>`;
            }).join('')}
          </div>
          <h3 style="margin-top:14px">偃甲專屬技<small>上機後鍵 1、2</small></h3>
          <div class="list">
            ${[9001, 9002].map((sid) => `<div class="row paper"><div class="row-main">${glyphSvg(sid)}<div><b>${SKILLS[sid].name}</b><div class="row-sub">${esc(SKILLS[sid].desc.replace('【偃甲專屬】', ''))}</div></div></div></div>`).join('')}
          </div>
        </div>`;
      body.querySelector('#btnDrawerSummonMech').onclick = () => { ui.closeDrawer(); world.toggleMechSummon(); };
      const bo = body.querySelector('#btnInstantOtherworld');
      if (bo) bo.onclick = () => { world.changeMap(2001); ui.closeDrawer(); };
      const bu = body.querySelector('#btnUpgMech');
      if (bu) bu.onclick = () => { if (world.upgradeMechTier().ok) sfx.playMechAwaken(); rerender(); };
      return;
    }

    if (tab === 'market') {
      const resultsHtml = () => world.searchStalls(state.query).map(({ stall, item }) => {
        const short = !stall.isConsigned && ch.silver < item.priceSilver;
        return `
              <div class="row paper mk">
                <div class="mk-main"><b>${esc(item.name)}</b>
                  <div class="row-sub">${esc(stall.title)}・${esc(item.desc)}</div></div>
                <span class="mk-price">${item.priceSilver.toLocaleString('en-US')}<small>銅錢</small></span>
                <div class="btns">
                  <button type="button" class="btn" data-nav-stall="${stall.id}">引路</button>
                  ${stall.isConsigned ? '<span class="dim mk-own">自家</span>' : `<button type="button" class="btn go" data-buy-stall="${stall.id}" data-buy-item="${item.id}" ${short ? 'disabled title="銅錢不夠"' : ''}>${short ? '錢不夠' : '買'}</button>`}
                </div>
              </div>`;
      }).join('') || '<p class="note">行會帳上找不到這樣貨。</p>';
      body.innerHTML = `
        <div class="d-pane">
          <h3>全攤檢索<small id="mkSilver">銅錢 ${ch.silver}</small></h3>
          <input id="inpMarketSearch" class="d-input" type="text" placeholder="搜兵器、烏鋼、通玄心得、聚罡散" value="${esc(state.query)}" autocomplete="off">
          <div id="marketResults" class="list" style="margin-top:8px">${resultsHtml()}</div>
        </div>
        <div class="d-pane">
          <div class="card paper">
            <div class="ttl">寄攤</div>
            <div class="sub">攤位託給渡口行會代看 24 時辰，人不在也照賣。${world.getPlayerStall() ? `目前掛著：${esc(world.getPlayerStall().title)}` : '目前沒有寄攤。'}</div>
            <div class="btns" style="margin-top:8px"><button id="btnSetupMyStall" type="button" class="btn go">${world.getPlayerStall() ? '續寄 24 時辰' : '託行會寄攤'}</button></div>
          </div>
          <div class="card paper">
            <div class="ttl">朱砂引路</div>
            <div class="sub">在左欄點「引路」，地上會畫出一條朱紅虛線，帶你走到攤前。走路時攤招會收成小牌，免得誤觸。</div>
            <div class="btns" style="margin-top:8px"><button id="btnBrowseStall" type="button" class="btn ${ch.browseStallMode ? 'on' : ''}">${ch.browseStallMode ? '攤招常開中' : '攤招常開'}</button></div>
          </div>
        </div>`;
      // 搜尋框不重建：只換結果清單，注音／倉頡組字才不會被打斷
      const list = body.querySelector('#marketResults');
      const bindResults = () => {
        list.querySelectorAll('[data-nav-stall]').forEach((b) => { b.onclick = () => { world.navigateToStall(b.dataset.navStall); ui.closeDrawer(); }; });
        list.querySelectorAll('[data-buy-stall]').forEach((b) => {
          b.onclick = () => {
            if (world.buyStallItem(b.dataset.buyStall, b.dataset.buyItem).ok) sfx.playForge(true);
            refreshResults();
          };
        });
      };
      const refreshResults = () => {
        list.innerHTML = resultsHtml();
        const sv = body.querySelector('#mkSilver');
        if (sv) sv.textContent = `銅錢 ${ch.silver}`;
        bindResults();
      };
      bindResults();
      const inp = body.querySelector('#inpMarketSearch');
      inp.addEventListener('input', (e) => {
        if (e.isComposing) return;
        state.query = inp.value;
        refreshResults();
      });
      inp.addEventListener('compositionend', () => { state.query = inp.value; refreshResults(); });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !e.isComposing) { e.preventDefault(); inp.blur(); ui.closeDrawer(); }
      });
      body.querySelector('#btnSetupMyStall').onclick = () => { world.setupConsignStall(`【${ch.name}】寄攤・烏鋼雜貨`, 1680); sfx.playStamp?.(); rerender(); };
      body.querySelector('#btnBrowseStall').onclick = () => { ch.browseStallMode = !ch.browseStallMode; rerender(); };
      return;
    }

    if (tab === 'bounty') {
      body.innerHTML = `
        <div class="d-pane">
          <h3>懸紅榜<small>揭榜後追拿不加凶名</small></h3>
          <div class="list">
            ${world.bounties.map((b) => `
              <div class="row paper ${b.acceptedByHero && b.status !== 'CLAIMED' ? 'sel' : ''}">
                <div><b style="color:${b.acceptedByHero && b.status !== 'CLAIMED' ? '#ffb19d' : 'var(--cinnabar)'}">${esc(b.targetName)}</b> <span class="dim">凶名 ${b.karma}</span>
                  <div class="row-sub">出沒 ${esc(MAPS[b.targetMapId]?.name)}・懸紅 ${b.rewardSilver} 銅錢・${BOUNTY_STATUS[b.status] || esc(b.status)}</div></div>
                ${b.status === 'CLAIMED' ? '<span class="tag">結案</span>' : `<button type="button" class="btn ${b.acceptedByHero ? 'on' : 'go'}" data-hunt-bounty="${b.id}">${b.acceptedByHero ? '追拿' : '揭榜'}</button>`}
              </div>`).join('')}
          </div>
        </div>
        <div class="d-pane">
          <div class="card paper">
            <div class="ttl">掛懸紅</div>
            <div class="sub">出 2,000 銅錢，在懸紅榜上掛黑風刀客的紅。揭榜的人羅盤上會多一根朱紅追匪針，指著劫鏢匪的方向。</div>
            <div class="btns" style="margin-top:8px"><button id="btnIssueBounty" type="button" class="btn go" ${ch.silver < 2000 ? 'disabled' : ''}>${ch.silver < 2000 ? '銅錢不夠' : '張榜'}</button></div>
          </div>
          <div class="card paper">
            <div class="ttl">亮刃與風沙夜</div>
            <div class="sub">鏢單右上的朱印是亮刃：蓋上後可被攻擊、攻擊 +5%。赤沙驛的風沙夜全區可亮刃，經驗與修為 +30%。點羅盤下的旗子切換分流。</div>
          </div>
        </div>`;
      body.querySelector('#btnIssueBounty').onclick = () => { world.issueBounty('pk-red-1', 2000); sfx.playStamp?.(); rerender(); };
      on('[data-hunt-bounty]', 'onclick', (b) => {
        world.acceptBounty(b.dataset.huntBounty);
        const tb = world.bounties.find((x) => x.id === b.dataset.huntBounty);
        // 已在匪徒出沒的地圖就只鎖定，不傳送（不然會被送回出生點）
        if (tb) { if (world.char.mapId !== tb.targetMapId) world.changeMap(tb.targetMapId); world.char.lockedTargetId = tb.targetId; }
        ui.closeDrawer();
      });
      return;
    }

    if (tab === 'worldmap') {
      const nodeXY = Object.fromEntries(WORLD_MAP_NODES.map((n) => [n.id, n]));
      const link = (a, b) => (nodeXY[a] && nodeXY[b] ? `<path d="M${nodeXY[a].x} ${nodeXY[a].y * 0.69} L${nodeXY[b].x} ${nodeXY[b].y * 0.69}"/>` : '');
      body.innerHTML = `
        <div class="d-pane">
          <div class="route-map paper">
            <svg class="routes" viewBox="0 0 100 69" preserveAspectRatio="none" aria-hidden="true">
              <path class="river" d="M-2 40 Q20 30 38 38 T70 34 T102 44"/>
              ${link('tieling', 'duanqiao')}${link('duanqiao', 'chisha')}${link('bailu', 'chisha')}${link('chisha', 'qingping')}
              ${link('qingping', 'shigu')}${link('qingping', 'heishui')}${link('heishui', 'luoyan')}${link('heishui', 'shuanglin')}
              ${link('shuanglin', 'wangxiang')}${link('wangxiang', 'yunzhan')}${link('yunzhan', 'ruins')}${link('chisha', 'yanhui')}${link('luoyan', 'ruins')}
            </svg>
            ${WORLD_MAP_NODES.map((n) => {
              const here = n.playable && ch.mapId === n.targetMap;
              const attrs = n.playable ? `data-wm-to="${n.targetMap}" title="${esc(n.lv)}"` : `disabled title="${esc(n.lv)}・這段鏢路尚未開放"`;
              return `<button type="button" class="wm-node ${n.playable ? 'playable' : ''} ${here ? 'here' : ''} ${n.x > 70 ? 'east' : ''}" data-east="${n.x > 70 ? 1 : 0}" style="left:${n.x}%;top:${n.y}%" ${attrs}>
                <svg class="pin" viewBox="0 0 12 22" aria-hidden="true"><rect class="pole" x="0" y="0" width="1.6" height="22"/><path class="cl" d="M1.6 1 L11 4.6 L1.6 9 Z"/></svg><span class="wl">${esc(n.name)}</span></button>`;
            }).join('')}
          </div>
        </div>
        <div class="d-pane">
          <h3>走得到的三處</h3>
          <div class="list">
            ${Object.values(MAPS).map((m) => `
              <div class="row paper ${ch.mapId === m.id ? 'sel' : ''}">
                <div><b>${esc(m.name)}</b> <span class="dim">${esc(m.recLv)}</span><div class="row-sub">${esc(m.sub)}・${m.isFreeGearZone ? '偃甲不耗樞力' : '偃甲每 5 秒耗 40 樞力'}</div></div>
                ${ch.mapId === m.id ? '<span class="tag">在此</span>' : `<button type="button" class="btn" data-wm-to="${m.id}">啟程</button>`}
              </div>`).join('')}
          </div>
          <div class="card paper" style="margin-top:10px">
            <div class="sub">赤沙驛烽燧一真二假，守驛人：<b>${esc(world.getOutpostHolder() || '還沒有人點燃')}</b></div>
            <div class="sub">風沙夜：<b>${ch.sandstormNight ? '正颳著（經驗與修為 +30%）' : '未起'}</b></div>
          </div>
        </div>`;
      layoutRouteLabels(body.querySelector('.route-map'));
      requestAnimationFrame(() => layoutRouteLabels(body.querySelector('.route-map')));
      on('[data-wm-to]', 'onclick', (b) => {
        const to = Number(b.dataset.wmTo);
        if (to !== ch.mapId) { world.changeMap(to); sfx.playDash(); }
        ui.closeDrawer();
      });
      return;
    }

    if (tab === 'handoff') {
      // 說明：操作鍵位與機制；只留一個「操作模式」切換（電腦匣列／手機扇匣）
      const mode = ui.getHudMode();
      body.innerHTML = `
        <div class="d-pane">
          <div class="card paper help">
            <div class="ttl">操作</div>
            <p><b>電腦</b>：<kbd>WASD</kbd> 走（滑鼠左鍵點地面也可）、左鍵點目標鎖定、右鍵拖曳轉視角、滾輪縮放；<kbd>1</kbd>～<kbd>6</kbd> 匣中取器出招、<kbd>7</kbd>～<kbd>9</kbd> 內功、<kbd>Space</kbd> 輕功、<kbd>Q</kbd><kbd>E</kbd><kbd>R</kbd> 服藥、<kbd>V</kbd> 偃甲、<kbd>F</kbd> 點烽燧、<kbd>Z</kbd> 狩獵、<kbd>M</kbd> 靜音；<kbd>C</kbd><kbd>K</kbd><kbd>U</kbd><kbd>T</kbd><kbd>B</kbd><kbd>G</kbd><kbd>J</kbd><kbd>H</kbd> 開抽屜、<kbd>Esc</kbd> 收起。</p>
            <p><b>手機</b>：左下搖桿，推到外圈放開是輕功；右下扇匣中央大鍵出目前在手的兵器，扇上六格各抽一器。</p>
          </div>
          <h3>操作模式<small>同一位鏢師，換到哪種裝置都接著走</small></h3>
          <div class="btns">
            <button id="btnHandoffPc" type="button" class="btn wide ${mode === 'pc' ? 'on' : ''}">電腦匣列</button>
            <button id="btnHandoffMob" type="button" class="btn wide ${mode === 'mobile' ? 'on' : ''}">手機扇匣</button>
          </div>
          <p class="note" style="margin-top:8px">自動服聚罡散：罡氣 ≤ ${Math.round(ch.autoShieldThreshold * 100)}%。</p>
        </div>
        <div class="d-pane">
          <div class="card paper help">
            <p><b>罡氣與破罡</b>：罡氣未破時吸收七到八成半傷害；被擊穿那一下，溢出傷害吃 1.15 倍，人還會僵 0.5 秒。罡氣掉到兩成半以下，鏢單會閃朱邊。</p>
            <p><b>六器被動</b>：刀「斷骨」、劍「遊絲」、槍「長驅」、拳「沉勁」、弓「貫日」、飛針「淬毒」。</p>
            <p><b>五行</b>：金剋木、木剋土、土剋水、水剋火、火剋金（剋 1.25 倍，被剋 0.8 倍）。</p>
            <p><b>酣戰</b>：出招命中會攢酣戰值，攢滿點左小匣的酣戰鈕，12 秒內傷害 +25%、冷卻縮短。</p>
            <p><b>偃甲</b>：上機讀條 7 秒，期間受創超過三成氣血會被打斷；偃師遺墟的機樞地脈不耗樞力。</p>
          </div>
        </div>`;
      body.querySelector('#btnHandoffPc').onclick = () => { ui.handoff('pc'); rerender(); };
      body.querySelector('#btnHandoffMob').onclick = () => { ui.handoff('mobile'); rerender(); };
    }
  }

  return { render, state };
}
