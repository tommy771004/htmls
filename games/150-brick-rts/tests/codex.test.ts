import test from 'node:test';
import assert from 'node:assert/strict';
import {civDefs,neutralCiv,deferredTechs,uniqueUnitOwner} from '../packages/content/civs.ts';
import {rules} from '../packages/content/rules.ts';
import {civProse,uniqueUnitText,referenceOnlyNames,classLabel,architectureLabel,codexIntro} from '../packages/content/codex.ts';
import {civDetail,civList,codexCivs,roleOf,rangeText} from '../apps/web/codex-model.ts';
import {statsOf,speedOf} from '../packages/sim/stats.ts';
import type {CombatUnitKind} from '../packages/sim/stats.ts';
import {costOf,timeTicks,civAvailable} from '../packages/sim/civ.ts';

const tick=rules.settings.tickHz;
test('every civilization has prose, and every unique unit and reference-only item a text', ()=>{
 assert.ok(codexIntro.includes('aoetw.com')&&codexIntro.includes('團隊加成')&&codexIntro.includes('尚未實作'));
 for(const c of civDefs){const p=civProse[c.id];assert.ok(p,c.id);assert.ok(p.summary.length>=40,`${c.id} summary`);assert.ok(p.strategy.length>=40,`${c.id} strategy`);
  assert.ok(architectureLabel[c.architecture],c.architecture);
  for(const u of c.uniqueUnits)assert.ok(uniqueUnitText[u]?.length>10,`${u} text`);
  for(const id of c.missingLater)assert.ok(referenceOnlyNames[id],`${c.id} ${id} name`);}
 // Reference sources for every playable civilization (the Settlers are this game's own).
 for(const c of civDefs)if(c.id!==neutralCiv)assert.ok(civProse[c.id].sources.some(s=>s.startsWith('civs/')),c.id);
});
test('the prose carries no percentages or bonus numbers the rules already hold', ()=>{
 for(const [id,p] of Object.entries(civProse))for(const t of [p.summary,p.strategy])assert.doesNotMatch(t,/[+＋-]\s?\d|\d\s?%|％/,id);
 for(const [id,t] of Object.entries(uniqueUnitText))assert.doesNotMatch(t,/\d/,id);
});
test('the list puts the Settlers last and marks the match civilizations', ()=>{
 const list=civList(['britons','franks']);
 assert.equal(list.length,civDefs.length);assert.equal(list.at(-1)!.id,neutralCiv);
 assert.equal(list.find(c=>c.id==='britons')!.role,'self');assert.equal(list.find(c=>c.id==='franks')!.role,'rival');assert.equal(list.find(c=>c.id==='goths')!.role,null);
 assert.equal(roleOf('celts',['celts','celts']),'both');
 // Groups stay contiguous (the list renders one heading per architecture).
 const seen:string[]=[];for(const c of list){if(seen.at(-1)!==c.group){assert.ok(!seen.includes(c.group),c.group);seen.push(c.group);}}
 assert.deepEqual(codexCivs().map(c=>c.id),list.map(c=>c.id));
});
test('unique unit numbers are the simulation numbers for that civilization', ()=>{
 for(const c of civDefs)for(const u of civDetail(c.id).units){
  const kind=u.id as CombatUnitKind,o3={civ:c.id,age:3,techs:[]},st=statsOf(kind,o3);
  assert.deepEqual(u.cost,costOf(kind,o3),`${kind} cost`);assert.equal(u.seconds,timeTicks(kind,o3,rules.production[kind]!)/tick,`${kind} time`);
  assert.equal(u.stats.hp,st.hp);assert.equal(u.stats.damage,st.damage);assert.equal(u.stats.range,st.range);assert.deepEqual(u.stats.armor,st.armor);
  assert.equal(u.stats.cooldown,st.cooldown);assert.equal(u.stats.speed,speedOf(kind,o3));assert.deepEqual(Object.fromEntries(u.stats.bonus.map(b=>[b.vs,b.value])),st.bonus);
  assert.equal(u.stats.regen,st.regen??0);assert.equal(u.stats.extraShots,st.extraShots??0);assert.equal(u.stats.splash,st.splash??0);
  assert.ok(u.elite,`${kind} elite`);const o4={civ:c.id,age:4,techs:[u.elite!.id]},el=statsOf(kind,o4);
  assert.equal(u.elite!.id,`elite-${kind}`);assert.deepEqual(u.elite!.cost,costOf(u.elite!.id,{civ:c.id,age:4,techs:[]}));
  assert.equal(u.elite!.stats.hp,el.hp);assert.equal(u.elite!.stats.damage,el.damage);assert.equal(u.elite!.stats.range,el.range);assert.deepEqual(u.elite!.stats.armor,el.armor);
  // Every bonus class, unit class and range reads in Chinese.
  for(const s of [u.stats,u.elite!.stats])for(const b of s.bonus)assert.ok(classLabel[b.vs],`${kind} bonus ${b.vs}`);
  for(const k of st.classes)assert.ok(classLabel[k],`${kind} class ${k}`);
  // Trained where the rules say (the Longboat at the dock, every other unique unit at the castle).
  assert.ok(u.name&&u.name!==kind);assert.equal(u.at,rules.entries.find(e=>e.id===rules.production[kind])!.name);assert.equal(u.elite!.age,4);}
 assert.deepEqual(civDetail('vikings').units.map(u=>[u.id,u.at]),[['berserk','城堡'],['longboat','碼頭']]);
 // Spot checks that the civilization's effects reach the page: the Goths' cheaper Huskarl, the Britons' longer range.
 const goth=civDetail('goths').units[0];assert.ok(goth.cost.food<rules.entries.find(e=>e.id==='huskarl')!.cost.food);
 assert.equal(rangeText(civDetail('britons').units[0].stats.range),`射程 ${statsOf('longbowman',{civ:'britons',age:3,techs:[]}).range/100} 格`);
 assert.equal(rangeText(50),'近戰');
});
test('deferred unique technologies never appear as implemented, and each says why', ()=>{
 const all=civDefs.flatMap(c=>civDetail(c.id).techs);
 assert.equal(all.length,civDefs.reduce((n,c)=>n+c.uniqueTechs.length,0));
 for(const id of deferredTechs){const t=all.find(t=>t.id===id);assert.ok(t,id);assert.equal(t.implemented,false,id);assert.equal(t.cost,null);assert.ok(t.reason,`${id} reason`);
  assert.ok(!rules.entries.some(e=>e.id===id),`${id} is not a rules entry`);}
 for(const t of all.filter(t=>t.implemented)){const c=civDefs.find(c=>c.uniqueTechs.some(u=>u.id===t.id))!;
  assert.deepEqual(t.cost,costOf(t.id,{civ:c.id,age:t.age,techs:[]}),t.id);assert.ok(t.effects.length,`${t.id} effects`);
  assert.ok(civAvailable(c.id,t.id),`${t.id} available to ${c.id}`);}
});
test('bonus groups: team bonuses apart, unique-technology effects only on their cards', ()=>{
 for(const c of civDefs){const d=civDetail(c.id),ut=new Set(c.uniqueTechs.map(t=>t.id));
  assert.equal(d.team.length,c.effects.filter(e=>e.scope==='team'&&!(e.trigger.tech&&ut.has(e.trigger.tech))).length,c.id);
  assert.equal(d.bonuses.length+d.team.length+d.techs.reduce((n,t)=>n+t.effects.length,0),c.effects.length,c.id);
  // Every omitted reference item shows once: in the list or on a technology card.
  const shown=d.omitted.length+d.techs.reduce((n,t)=>n+t.partial.length+(t.implemented?0:1),0);assert.equal(shown,c.omitted.length,c.id);}
 // The Mongols' Light Cavalry bonus waits on a regular technology: still a civilization bonus.
 assert.ok(civDetail('mongols').bonuses.some(t=>t.includes('輕騎兵')));
 assert.deepEqual(civDetail('britons').team,['靶場生產速度 +20%']);
});
test('the tech-tree difference lists only what the civilization really lacks', ()=>{
 for(const c of civDefs){const d=civDetail(c.id),listed=d.tree.flatMap(g=>g.entries.map(e=>e.id)),civ=rules.civilizations.find(x=>x.id===c.id)!;
  for(const id of listed){assert.ok(civ.unavailable.includes(id),`${c.id} ${id}`);assert.ok(!civAvailable(c.id,id));}
  // Other civilizations' unique content is not repeated on every page; the civ's own missing entries all are.
  for(const id of listed)assert.ok(!uniqueUnitOwner[id]||uniqueUnitOwner[id]===c.id,`${c.id} lists ${id}`);
  for(const id of c.missing)assert.ok(listed.includes(id),`${c.id} misses ${id}`);
  for(const g of d.tree)for(const e of g.entries){const producer=rules.production[e.id];assert.equal(g.building,producer??'',e.id);}
  assert.deepEqual(d.later.map(e=>e.id),[...c.missingLater]);}
 // The Settlers lack only the Castle and what it offers to every civilization.
 assert.deepEqual(civDetail(neutralCiv).tree.flatMap(g=>g.entries.map(e=>e.id)).sort(),['castle','conscription','hoardings','petard','sappers','trebuchet']);
 assert.deepEqual(civDetail('turks').tree.find(g=>g.building==='barracks')!.entries.map(e=>e.id),['pikeman','halberdier']);
});
// ── Category 單位 ──
import {unitLines,unitLine,pendingLines,unitGroups,unitsOverview,codexSections,lineStepIds,stepOwner,minAge,civsLacking,unitLineKinds} from '../apps/web/codex-model.ts';
import {aoetwUnits,unitText,unitCounters,unitCategories,unitPendingReasons,aoetwUnitExtras,unitsIntro} from '../packages/content/codex.ts';
import {lineUpgrades} from '../packages/sim/stats.ts';
import {unitKinds} from '../packages/sim/movement.ts';
import {isAnimal} from '../packages/sim/fauna.ts';

// The 遊戲元素 round adds its category after 建築.
test('the category switch offers only the categories the book has: 文明, 單位, 科技, 建築, 遊戲元素, 戰術技巧 and 科技樹', ()=>{
 assert.deepEqual(codexSections.map(s=>s.label),['文明','單位','科技','建築','遊戲元素','戰術技巧','科技樹']);assert.deepEqual(codexSections.map(s=>s.id),['civs','units','techs','buildings','elements','tactics','tree']);
});
test('every unit kind but the animals, and every line upgrade, appears exactly once', ()=>{
 const lines=unitLines(),kinds=unitKinds.filter(k=>!isAnimal(k));
 assert.deepEqual(lines.map(l=>l.id).sort(),[...kinds].sort());assert.deepEqual(unitLineKinds(),kinds);
 const steps=lines.flatMap(l=>l.steps.map(s=>s.id));assert.equal(new Set(steps).size,steps.length,'no step twice');
 // Every line upgrade is one step (War Galley is three: the galley, fire and demolition lines each take it).
 assert.deepEqual(lines.flatMap(l=>l.steps.slice(1).map(s=>s.tech)).sort(),lineUpgrades.map(u=>u.id).sort());
 // Steps keep the research order of lineUpgrades.
 for(const l of lines)assert.deepEqual(l.steps.slice(1).map(s=>s.tech),lineUpgrades.filter(u=>u.kind===l.id).map(u=>u.id),l.id);
 assert.deepEqual(unitLine('fire-galley').steps.map(s=>[s.id,s.tech]),[['fire-galley','fire-galley'],['fire-ship','war-galley'],['fast-fire-ship','fast-fire-ship']]);
 assert.deepEqual(unitLine('demolition-raft').steps.map(s=>s.name),['自爆筏','爆破船','重型爆破船']);
 // In the list: once per grouping, by category and by building.
 for(const by of ['category','building'] as const){const ids=unitGroups(by).flatMap(g=>g.items.filter(i=>!i.pending).map(i=>i.id));assert.deepEqual([...ids].sort(),[...kinds].sort(),by);}
});
test('every number on a unit card is the simulation number', ()=>{
 for(const l of unitLines()){const kind=l.id as CombatUnitKind,o0=stepOwner(kind,0);
  assert.deepEqual(o0,{civ:neutralCiv,age:minAge(kind),techs:[]});
  assert.deepEqual(l.train.cost,costOf(kind,o0),`${kind} cost`);assert.equal(l.train.seconds,timeTicks(kind,o0,rules.production[kind]!)/tick,`${kind} time`);
  assert.equal(l.train.age,minAge(kind));assert.equal(l.producer,rules.production[kind]);
  l.steps.forEach((s,i)=>{const o=stepOwner(kind,i),st=statsOf(kind,o);
   assert.deepEqual(o.techs,lineStepIds(kind).slice(1,i+1));assert.equal(s.tech,lineStepIds(kind)[i]);assert.equal(s.age,minAge(s.tech));
   assert.equal(s.stats.hp,st.hp,`${s.id} hp`);assert.equal(s.stats.damage,st.damage,`${s.id} damage`);assert.equal(s.stats.range,st.range);assert.deepEqual(s.stats.armor,st.armor);
   assert.equal(s.stats.cooldown,st.cooldown);assert.equal(s.stats.speed,speedOf(kind,o));assert.deepEqual(Object.fromEntries(s.stats.bonus.map(b=>[b.vs,b.value])),st.bonus);
   assert.equal(s.stats.minRange,st.minRange??0);assert.equal(s.stats.blast,st.blast??0);assert.equal(s.stats.passThrough,st.passThrough??0);
   assert.equal(s.stats.buildingsOnly,!!st.buildingsOnly);assert.equal(s.stats.selfDestruct,!!st.selfDestruct);assert.equal(s.stats.setup,st.setup??0);
   assert.equal(s.stats.regen,st.regen??0);assert.equal(s.stats.extraShots,st.extraShots??0);assert.equal(s.stats.splash,st.splash??0);
   for(const b of s.stats.bonus)assert.ok(classLabel[b.vs],`${s.id} bonus ${b.vs}`);
   if(i===0)assert.equal(s.research,null);
   else{const at=rules.production[s.tech]!;assert.deepEqual(s.research!.cost,costOf(s.tech,o),`${s.id} research cost`);assert.equal(s.research!.seconds,timeTicks(s.tech,o,at)/tick);
    assert.equal(s.research!.at,rules.entries.find(e=>e.id===at)!.name);assert.equal(s.name,lineUpgrades.find(u=>u.id===s.tech&&u.kind===kind)!.name);}});
  for(const k of statsOf(kind,o0).classes)assert.ok(classLabel[k],`${kind} class ${k}`);}
 // The new mechanics reach the cards: minimum range, blast, pass-through, buildings only, packing, self-destruct.
 const by=(k:string)=>unitLine(k as CombatUnitKind).steps[0].stats;
 assert.ok(by('mangonel').minRange>0&&by('mangonel').blast>0);assert.ok(by('scorpion').passThrough>0);
 assert.ok(by('trebuchet').buildingsOnly&&by('trebuchet').setup>0);assert.ok(by('petard').selfDestruct);assert.ok(by('ram').buildingsOnly);
 assert.ok(unitLine('mangonel').steps.at(-1)!.stats.blast>by('mangonel').blast,'Siege Onager has the wider blast');
});
test('civilization lists on unit cards are the rules lists', ()=>{
 // A civilization lacking the research or the line's first unit lacks the step (the Vikings have no fire ships).
 for(const l of unitLines()){for(const s of l.steps)assert.deepEqual(s.lacks,rules.civilizations.filter(c=>c.unavailable.includes(s.tech)||c.unavailable.includes(l.id)).map(c=>c.id),s.id);
  assert.equal(l.owner,uniqueUnitOwner[l.id]??null,l.id);}
 for(const c of rules.civilizations)for(const id of c.unavailable)if(unitLines().some(l=>l.steps.some(s=>s.tech===id)))assert.ok(civsLacking(id).includes(c.id),`${c.id} ${id}`);
 assert.ok(unitLine('fire-galley').steps[1].lacks.includes('vikings'));
 assert.ok(unitLine('camel').steps[0].lacks.includes('britons'));assert.deepEqual(unitLine('trebuchet').steps[0].lacks,[neutralCiv]);
});
test('reference units the game lacks are listed with a reason, each once', ()=>{
 const game=new Set(unitLines().flatMap(l=>l.steps.map(s=>s.id))),pending=pendingLines(),ids=pending.flatMap(p=>p.steps.map(s=>s.id));
 assert.equal(new Set(ids).size,ids.length);
 assert.deepEqual([...ids].sort(),aoetwUnits.filter(u=>!game.has(u.id)).map(u=>u.id).sort());
 const reasons=Object.values(unitPendingReasons) as string[];
 for(const p of pending){assert.ok(reasons.includes(p.reason),`${p.id} reason`);assert.ok(p.text.length>10,`${p.id} text`);assert.ok(unitCategories.some(c=>c.id===p.primary),p.id);}
 const reason=(id:string)=>pending.find(p=>p.steps.some(s=>s.id===id))!.reason;
 // Chemistry brought the generic gunpowder units: they are lines of their own now, not pending.
 for(const id of ['hand-cannoneer','bombard-cannon']){assert.ok(!ids.includes(id),id);assert.ok(unitLines().some(l=>l.id===id),id);}
 assert.equal(reason('arambai'),unitPendingReasons.civ);assert.equal(reason('eagle-warrior'),unitPendingReasons.expansion);assert.equal(reason('steppe-lancer'),unitPendingReasons.expansion);
 // The dock's and the market's units are lines of their own now (the War Galley research reaches three of them).
 for(const id of ['galley','war-galley','galleon','fire-ship','demolition-ship','longboat','trade-cart','trade-cog','fishing-ship','transport-ship','cannon-galleon'])assert.ok(!ids.includes(id),id);
 assert.equal(reason('turtle-ship'),unitPendingReasons.civ);
 // The listing shows them too, and the Imperial Camel also on the camel card as a later step.
 for(const by of ['category','building'] as const)assert.deepEqual(unitGroups(by).flatMap(g=>g.items.filter(i=>i.pending).map(i=>i.id)).sort(),pending.map(p=>p.id).sort());
 assert.ok(unitLine('camel').later.some(x=>x.id==='imperial-camel'&&x.reason===unitPendingReasons.civ));
});
test('unit prose: every reference unit and every line has text, without numbers', ()=>{
 assert.ok(unitsIntro.includes('aoetw.com')&&unitsIntro.includes('design_default')&&unitsIntro.includes('碼頭')&&unitsIntro.includes('化學'));
 for(const u of aoetwUnits){assert.ok(unitText[u.id]?.length>10,`${u.id} text`);assert.doesNotMatch(unitText[u.id],/\d/,u.id);
  for(const c of u.categories)assert.ok(unitCategories.some(x=>x.label===c),`${u.id} ${c}`);if(u.from)assert.ok(aoetwUnits.some(x=>x.id===u.from),`${u.id} from`);}
 for(const l of unitLines()){assert.ok(l.text.length>10,`${l.id} text`);const c=unitCounters[l.id];assert.ok(c?.strong&&c.weak,`${l.id} counters`);
  assert.doesNotMatch(c.strong+c.weak,/\d/,l.id);assert.ok(l.sources.length,`${l.id} source`);}
 // The overview counts what the lists hold; animals, heroes and editor units only as a footnote count.
 const o=unitsOverview();assert.equal(o.lines,unitLines().length);assert.equal(o.pending,pendingLines().reduce((n,p)=>n+p.steps.length,0));assert.deepEqual(o.extras,{...aoetwUnitExtras});
 // Every reference page is shown once; only the elite unique upgrades have none of their own (they share their unit's).
 const refIds=new Set(aoetwUnits.map(u=>u.id)),steps=unitLines().flatMap(l=>l.steps),unpaged=steps.filter(s=>!refIds.has(s.id));
 assert.equal(steps.length,o.steps);assert.equal(steps.length-unpaged.length+o.pending,aoetwUnits.length);
 for(const s of unpaged)assert.ok(s.id.startsWith('elite-')&&uniqueUnitOwner[s.id],s.id);
});
// ── Category 科技 ──
import {techPages,techPage,uniqueTechPages,pendingTechs,techGroups,techsOverview,genericTechIds,techEffectLines,techVariants,prereqChain} from '../apps/web/codex-model.ts';
import {aoetwTechs,techText,techPendingReasons,techBuildingText,techsIntro,techsMissingText,techPartials} from '../packages/content/codex.ts';
import {techEffects} from '../packages/content/techs.ts';
import {techEffectText} from '../packages/sim/tech.ts';
import {blacksmith} from '../packages/sim/stats.ts';

test('every technology entry but the age-ups and unit line upgrades appears exactly once', ()=>{
 const lineIds=new Set(lineUpgrades.map(u=>u.id)),want=rules.entries.filter(e=>e.kind==='technology'&&!e.id.startsWith('age-')&&!lineIds.has(e.id)).map(e=>e.id);
 const gen=techPages().map(t=>t.id),uni=uniqueTechPages().filter(t=>t.implemented).map(t=>t.id),shown=[...gen,...uni];
 assert.equal(new Set(shown).size,shown.length,'no technology twice');assert.deepEqual([...shown].sort(),[...want].sort());
 assert.deepEqual(gen,genericTechIds());for(const id of gen)assert.ok(!uniqueUnitOwner[id],id);
 // In the list: every one once per grouping, and the line upgrades nowhere (they are on the 單位 cards).
 for(const by of ['building','age'] as const){const ids=techGroups(by).flatMap(g=>g.items.filter(i=>!i.pending).map(i=>i.id));assert.deepEqual([...ids].sort(),[...want].sort(),by);
  for(const id of lineIds)assert.ok(!techGroups(by).some(g=>g.items.some(i=>i.id===id)),`${by} ${id}`);}
});
test('every number on a technology card is the simulation number', ()=>{
 for(const t of techPages()){const o={civ:neutralCiv,age:minAge(t.id),techs:[]},at=rules.production[t.id]!;
  assert.equal(t.building,at);assert.equal(t.age,minAge(t.id));assert.deepEqual(t.cost,costOf(t.id,o),`${t.id} cost`);assert.equal(t.seconds,timeTicks(t.id,o,at)/tick,`${t.id} time`);
  // Civilization variants: exactly the civilizations whose cost or time differ, with their numbers.
  for(const c of civDefs){if(c.id===neutralCiv||!civAvailable(c.id,t.id))continue;const oc={...o,civ:c.id},v=t.variants.find(x=>x.civ===c.id);
   const differs=timeTicks(t.id,oc,at)!==timeTicks(t.id,o,at)||JSON.stringify(costOf(t.id,oc))!==JSON.stringify(costOf(t.id,o));
   assert.equal(!!v,differs,`${t.id} ${c.id}`);if(v){assert.deepEqual(v.cost,costOf(t.id,oc));assert.equal(v.seconds,timeTicks(t.id,oc,at)/tick);assert.ok(v.texts.length,`${t.id} ${c.id} why`);}}
  for(const v of t.variants)assert.ok(civAvailable(v.civ,t.id),`${t.id} ${v.civ}`);
  // Prerequisites: the requires chain without ages and the building.
  for(const r of t.requires)assert.ok(!r.id.startsWith('age-')&&r.id!==at);
  for(const q of rules.entries.find(e=>e.id===t.id)!.requires)if(!q.startsWith('age-')&&q!==at)assert.ok(t.requires.some(r=>r.id===q),`${t.id} needs ${q}`);}
 assert.deepEqual(prereqChain('crop-rotation').map(r=>r.id),['horse-collar','heavy-plow']);assert.deepEqual(prereqChain('keep').map(r=>r.id),['guard-tower']);
 assert.deepEqual(techPage('chemistry').unlocks.map(u=>u.id).sort(),['bombard-cannon','bombard-tower-tech','cannon-galleon','elite-cannon-galleon','hand-cannoneer']);
 assert.ok(techPage('bombard-tower-tech').effects.includes('可以建造火砲塔'));
 // The free ones read as free: the Franks' farm technologies, the Turks' Chemistry; the Vikings get the carts with the age.
 for(const [id,civ] of [['horse-collar','franks'],['chemistry','turks'],['herbal-medicine','teutons'],['town-watch','byzantines']] as const)assert.ok(techVariants(id).find(v=>v.civ===civ)?.free,`${civ} ${id}`);
 assert.deepEqual(techPage('wheelbarrow').grants.map(g=>g.civ),['vikings']);
 assert.equal(techVariants('loom').find(v=>v.civ==='goths')?.seconds,0,'Goths: Loom at once');
});
test('effect lines are the effect records, and every technology has some', ()=>{
 for(const t of techPages()){assert.ok(t.effects.length,`${t.id} effects`);assert.deepEqual(t.effects,techEffectLines(t.id));
  const fx=techEffects.filter(e=>e.trigger.tech===t.id).map(e=>e.text.replace(`${t.name}：`,''));
  assert.deepEqual(t.effects.slice(0,fx.length),fx,t.id);
  if(techEffectText[t.id])assert.ok(t.effects.includes(techEffectText[t.id]),t.id);
  if(blacksmith[t.id]){const b=blacksmith[t.id],line=t.effects.at(-1)!;if(b.attack)assert.match(line,new RegExp(`攻擊 \\+${b.attack}`));if(b.pierce)assert.match(line,new RegExp(`遠程護甲 \\+${b.pierce}`));}
  // Civilization-specific effects switched on by a generic technology are listed apart.
  assert.deepEqual(t.civEffects.map(e=>e.text),civDefs.flatMap(c=>c.effects.filter(e=>e.trigger.tech===t.id).map(e=>e.text)));}
 // Every effect record of a generic technology reaches its card.
 for(const e of techEffects)assert.ok(techPage(e.trigger.tech!).effects.includes(e.text.replace(/^[^：]+：/,'')),e.id);
 assert.ok(techPage('sanctity').effects[0].includes('15'));assert.ok(techPage('block-printing').effects[0].includes('格'));
});
test('civilizations lacking a technology are the rules lists', ()=>{
 for(const t of techPages()){assert.deepEqual(t.lacks,rules.civilizations.filter(c=>c.unavailable.includes(t.id)).map(c=>c.id),t.id);
  for(const c of t.lacks)assert.ok(!civAvailable(c,t.id));}
 assert.ok(techPage('thumb-ring').lacks.includes('britons'));assert.ok(techPage('conscription').lacks.includes(neutralCiv));
});
test('unique technologies by civilization: implemented ones with civ numbers, deferred ones with a reason', ()=>{
 const uni=uniqueTechPages();assert.equal(uni.length,civDefs.reduce((n,c)=>n+c.uniqueTechs.length,0));
 for(const t of uni){const c=civDefs.find(c=>c.id===t.civ)!;assert.ok(c.uniqueTechs.some(u=>u.id===t.id),t.id);assert.ok(techText[t.id]?.length>10,`${t.id} text`);
  if(t.implemented){assert.deepEqual(t.cost,costOf(t.id,{civ:c.id,age:t.age,techs:[]}),t.id);assert.ok(t.effects.length,t.id);}
  else{assert.ok(deferredTechs.includes(t.id),t.id);assert.ok(t.reason,`${t.id} reason`);assert.equal(t.cost,null);}}
 // Listed under their civilization in the building view.
 for(const c of civDefs.filter(c=>c.uniqueTechs.length))assert.deepEqual(techGroups('building').find(g=>g.id===`civ-${c.id}`)!.items.map(i=>i.id),c.uniqueTechs.map(t=>t.id),c.id);
});
test('aoetw technologies the game lacks are listed once, each with a reason', ()=>{
 const game=new Set([...rules.entries.map(e=>e.id),...civDefs.flatMap(c=>c.uniqueTechs.map(t=>t.id))]),pend=pendingTechs();
 assert.deepEqual(pend.map(p=>p.id).sort(),aoetwTechs.filter(t=>t.kind!=='age'&&!game.has(t.id)).map(t=>t.id).sort());
 const reasons=Object.values(techPendingReasons) as string[];
 for(const p of pend){assert.ok(reasons.includes(p.reason),`${p.id} reason`);assert.ok(p.text.length>10,`${p.id} text`);assert.ok(p.at,`${p.id} building`);}
 const reason=(id:string)=>pend.find(p=>p.id===id)!.reason;
 for(const id of ['cartography','coinage','banking'])assert.equal(reason(id),techPendingReasons.allies,id);
 // Ballistics is in the game from the 戰術技巧 round.
 assert.ok(techPages().some(t=>t.id==='ballistics')&&!pend.some(p=>p.id==='ballistics'),'ballistics');
 assert.equal(reason('murder-holes'),techPendingReasons.minRange);
 // The dock's, the market's and the university's other technologies are in the game now.
 for(const id of ['guilds','caravan','careening','dry-dock','shipwright','gillnets','heated-shot','fortified-wall','bombard-tower-tech'])assert.ok(techPages().some(t=>t.id===id)&&!pend.some(p=>p.id===id),id);
 assert.equal(reason('tracking'),techPendingReasons.tracking);assert.equal(reason('spies'),techPendingReasons.regicide);assert.equal(reason('atlatl'),techPendingReasons.civ);
 // Every aoetw technology is accounted for: in the game (generic or unique), pending, or one of the four ages.
 const ids=new Set([...techPages().map(t=>t.id),...uniqueTechPages().map(t=>t.id),...pend.map(p=>p.id)]);
 for(const t of aoetwTechs)assert.ok(ids.has(t.id)||t.kind==='age',t.id);
 for(const by of ['building','age'] as const)assert.deepEqual(techGroups(by).flatMap(g=>g.items.filter(i=>i.pending).map(i=>i.id)).sort(),[...pend.map(p=>p.id),...deferredTechs].sort(),by);
});
test('technology prose: an intro, every building and every aoetw technology a text without numbers', ()=>{
 assert.ok(techsIntro.includes('aoetw.com')&&techsIntro.includes('design_default'));
 for(const w of ['市集','盟友','彈道學','拇指環','近射孔','追蹤','間諜'])assert.ok(techsMissingText.includes(w),w);
 for(const t of aoetwTechs){assert.ok(techText[t.id]?.length>10,`${t.id} text`);assert.doesNotMatch(techText[t.id],/\d/,t.id);
  // This game's names: no site names for buildings and ages.
  assert.doesNotMatch(techText[t.id],/軍營|射箭場|兵工廠|封建|帝王|城堡時代/,t.id);}
 for(const g of techGroups('building'))if(!g.id.startsWith('civ-'))assert.ok(techBuildingText[g.id],g.id);
 for(const id of Object.keys(techPartials))assert.ok(genericTechIds().includes(id),id);
 const o=techsOverview();assert.equal(o.generic,genericTechIds().length);assert.equal(o.pending,pendingTechs().length);assert.equal(o.lineUpgrades,lineUpgrades.length);
 assert.equal(o.unique+o.deferred,uniqueTechPages().length);for(const a of o.ages)assert.deepEqual(a.cost,costOf(a.id,{civ:neutralCiv,age:minAge(a.id),techs:[]}));
});
// ── Category 建築 ──
import {buildingPages,buildingPage,pendingBuildings,buildingGroupsBy,buildingsOverview,buildingSheet,buildingUpgrades,touchesBuilding} from '../apps/web/codex-model.ts';
import {aoetwBuildings,buildingText,buildingGroups,buildingPendingReasons,buildingPartials,buildingsIntro,buildingsMissingText} from '../packages/content/codex.ts';
import {buildKinds,buildingRules} from '../packages/sim/buildings.ts';
import {defenseRules,garrisonCapacity} from '../packages/sim/defense.ts';
import {buildingHpOf,buildingTargetOf} from '../packages/sim/stats.ts';
import {arrowsOf,housingBonus,producedAt} from '../packages/sim/civ.ts';
import {obstacleFootprints} from '../packages/content/footprints.ts';

test('every buildable kind appears exactly once, in both groupings', ()=>{
 const pages=buildingPages();assert.deepEqual(pages.map(b=>b.id),[...buildKinds]);
 for(const by of ['group','age'] as const){const ids=buildingGroupsBy(by).flatMap(g=>g.items.filter(i=>!i.pending).map(i=>i.id));assert.deepEqual([...ids].sort(),[...buildKinds].sort(),by);
  assert.deepEqual(buildingGroupsBy(by).flatMap(g=>g.items.filter(i=>i.pending).map(i=>i.id)).sort(),pendingBuildings().map(b=>b.id).sort(),by);}
 for(const b of pages)assert.ok(buildingGroups.some(g=>g.id===b.group),b.id);
});
test('every number on a building card is the simulation number', ()=>{
 const tick=rules.settings.tickHz;
 for(const b of buildingPages()){const o={civ:neutralCiv,age:minAge(b.id),techs:[] as string[]},f=obstacleFootprints[b.id as keyof typeof obstacleFootprints];
  assert.equal(b.age,minAge(b.id));assert.deepEqual(b.cost,costOf(b.id,o),`${b.id} cost`);assert.equal(b.seconds,(buildingRules.required as Record<string,number>)[b.id]/tick,`${b.id} time`);
  assert.equal(b.sheet.hp,buildingHpOf(b.id,o),`${b.id} hp`);assert.deepEqual(b.sheet.armor,buildingTargetOf(b.id,o).armor);
  assert.equal(b.sheet.housing,(buildingRules.capacity as Record<string,number>)[b.id]+housingBonus(o,b.id),`${b.id} housing`);
  assert.equal(b.sheet.garrison,garrisonCapacity({civs:[neutralCiv],ages:[o.age],techs:[[]]},{kind:b.id,player:0}),`${b.id} garrison`);
  assert.deepEqual([b.footprint.width,b.footprint.depth],[f.width/100,f.depth/100]);
  const def=defenseRules.arrows[b.id];assert.equal(!!b.sheet.arrows,!!def,`${b.id} arrows`);
  if(def){const mod=arrowsOf(o,b.id);assert.equal(b.sheet.arrows!.count,def.base+mod.extra);assert.equal(b.sheet.arrows!.damage,def.damage+mod.damage);assert.equal(b.sheet.arrows!.range,def.range+mod.range);
   for(const x of b.sheet.arrows!.bonus)assert.ok(classLabel[x.vs],`${b.id} bonus ${x.vs}`);}
  // What it trains and researches: its production list (unique content, the Castle's and the Longboat at the dock, is named by civilization instead).
  const made=producedAt(b.id,o).filter(id=>!uniqueUnitOwner[id]);assert.deepEqual([...b.trains,...b.researches].map(x=>x.id).sort(),[...made].sort(),b.id);
  assert.equal(b.uniqueHere,producedAt(b.id,o).some(id=>uniqueUnitOwner[id]),b.id);
  // Upgrades: cost and time of the research, numbers after it.
  b.steps.forEach((st,i)=>{const at=rules.production[st.id]!,so={civ:neutralCiv,age:minAge(st.id),techs:[] as string[]};assert.deepEqual(st.cost,costOf(st.id,so));assert.equal(st.seconds,timeTicks(st.id,so,at)/tick);
   assert.deepEqual(st.sheet,buildingSheet(b.id,{civ:neutralCiv,age:Math.max(b.age,minAge(st.id)),techs:buildingUpgrades(b.id).slice(0,i+1)}));});
  // Civilization variants: exactly the civilizations whose cost or numbers differ at that age, with their numbers.
  for(const c of civDefs){if(c.id===neutralCiv||!civAvailable(c.id,b.id))continue;const oc={...o,civ:c.id},v=b.variants.find(x=>x.civ===c.id);
   const differs=JSON.stringify(costOf(b.id,oc))!==JSON.stringify(b.cost)||JSON.stringify(buildingSheet(b.id,oc))!==JSON.stringify(b.sheet);
   assert.equal(!!v,differs,`${b.id} ${c.id}`);if(v){assert.deepEqual(v.cost,costOf(b.id,oc));assert.ok(v.texts.length,`${b.id} ${c.id} why`);}}
  for(const v of b.variants)assert.ok(civAvailable(v.civ,b.id));
  assert.deepEqual(b.lacks,rules.civilizations.filter(c=>c.unavailable.includes(b.id)).map(c=>c.id),b.id);}
 // Spot checks: the civilization effects of this round reach the cards.
 assert.equal(buildingPage('dock').variants.find(v=>v.civ==='persians')!.sheet.hp,2*buildingPage('dock').sheet.hp);
 assert.ok(buildingPage('market').variants.find(v=>v.civ==='saracens')!.cost.wood<buildingPage('market').cost.wood);
 assert.ok(buildingPage('town-center').variants.find(v=>v.civ==='britons')!.cost.wood<buildingPage('town-center').cost.wood);
 assert.deepEqual(buildingPage('watch-tower').steps.map(s=>s.id),['guard-tower','keep']);assert.deepEqual(buildingPage('gate').steps.map(s=>s.id),['fortified-wall']);
 assert.ok(buildingPage('watch-tower').steps[1].sheet.hp>buildingPage('watch-tower').steps[0].sheet.hp);
 assert.deepEqual(buildingPage('bombard-tower').requires.map(r=>r.id),['chemistry','bombard-tower-tech']);
 assert.ok(buildingPage('bombard-tower').civEffects.some(e=>e.civ==='turks'));assert.ok(!buildingPage('bombard-tower').civEffects.some(e=>e.civ==='byzantines'),'only civilizations that can build it');
 assert.ok(buildingPage('castle').uniqueHere&&buildingPage('dock').uniqueHere&&!buildingPage('barracks').uniqueHere);
 assert.deepEqual(buildingPage('dock').unique,[{civ:'vikings',names:['維京大戰船','精銳維京大戰船']}]);
 assert.ok(buildingPage('stone-wall').perSegment&&buildingPage('palisade-wall').perSegment&&!buildingPage('gate').perSegment);assert.equal(buildingPage('fish-trap').builders,'漁船');
});
test('civilization and technology effects on a building card are the effect records that touch it', ()=>{
 for(const b of buildingPages()){
  for(const t of b.techs){assert.ok(!buildingUpgrades(b.id).includes(t.id));assert.deepEqual(t.texts.length,techEffects.filter(e=>e.trigger.tech===t.id&&touchesBuilding(e,b.id)).length,`${b.id} ${t.id}`);}
  // Every civilization effect on a building the civ can build shows once: as a variant's reason or in the list.
  for(const c of civDefs){if(c.id===neutralCiv||!civAvailable(c.id,b.id))continue;const fx=c.effects.filter(e=>touchesBuilding(e,b.id)).map(e=>e.text),v=b.variants.find(x=>x.civ===c.id);
   const shown=[...(v?.texts??[]),...b.civEffects.filter(e=>e.civ===c.id).map(e=>e.text)];assert.deepEqual([...shown].sort(),[...fx].sort(),`${b.id} ${c.id}`);}}
 assert.ok(buildingPage('watch-tower').techs.some(t=>t.id==='heated-shot'));assert.ok(buildingPage('castle').techs.some(t=>t.id==='hoardings'));
 assert.ok(!buildingPage('house').techs.some(t=>t.id==='herbal-medicine'),'nobody goes into a house');
});
test('reference buildings: every aoetw page is a building, an upgrade step, or listed as lacking with a reason', ()=>{
 const pages=buildingPages(),steps=pages.flatMap(b=>b.steps.map(s=>s.id)),pend=pendingBuildings().map(b=>b.id);
 for(const r of aoetwBuildings){const n=(pages.some(b=>b.id===r.id)?1:0)+(steps.includes(r.id)?1:0)+(pend.includes(r.id)?1:0);
  // Upgrades of two buildings (Fortified Wall: stone wall and gate) are a step on each card.
  assert.ok(n===1||r.kind==='upgrade'&&steps.includes(r.id),r.id);}
 assert.equal(new Set(pend).size,pend.length);assert.deepEqual(pend.sort(),['donjon','feitoria','harbor','krepost']);
 for(const b of pendingBuildings()){assert.equal(b.reason,buildingPendingReasons.civ);assert.ok(b.civ&&!civDefs.some(c=>c.name===b.civ),b.id);}
 for(const k of buildKinds)assert.ok(aoetwBuildings.some(r=>r.id===k&&r.kind==='building'),k);
 const o=buildingsOverview();assert.equal(o.buildings,buildKinds.length);assert.equal(o.pending,pendingBuildings().length);assert.equal(o.upgrades,steps.length);
 assert.deepEqual(o.groups.map(g=>g.buildings+g.pending).reduce((a,b)=>a+b,0),buildKinds.length+pend.length);
});
test('building prose: an intro, every page a text without numbers, in this game\'s names', ()=>{
 assert.ok(buildingsIntro.includes('aoetw.com')&&buildingsIntro.includes('design_default'));assert.ok(buildingsMissingText.includes('海港'));
 for(const r of aoetwBuildings){const t=buildingText[r.id];assert.ok(t?.length>10,`${r.id} text`);assert.doesNotMatch(t,/\d/,r.id);assert.doesNotMatch(t,/軍營|射箭場|兵工廠|攻城器製造所|封建|帝王|城堡時代/,r.id);}
 for(const g of buildingGroups){assert.ok(g.text.length>10);assert.doesNotMatch(g.text,/\d/,g.id);}
 for(const [id,t] of Object.entries(buildingPartials)){assert.ok(buildKinds.includes(id as never),id);assert.equal(buildingPage(id).partial,t);}
 for(const b of buildingPages())assert.ok(b.sources.length&&b.text,b.id);
});
// ── 遊戲元素 (the 遊戲元素 round) ─────────────────────────────────────────────────────────────────────────────────
import {elementIds,elementPage,elementPages,elementGroups,classRows,armorExamples,unitSteps,fireRows,fireGroups,frameRows,garrisonRows,repairPerSecond,repairCostOf,repairExamples,
 tauntRows,relicFacts,conversionFacts,spreadRows,teamRows,hpRange,regenRows} from '../apps/web/codex-elements.ts';
import {elementProse,elementLacks,elementsIntro,elementsNote} from '../packages/content/codex.ts';
import {hitDamage,buildingClassArmor} from '../packages/sim/stats.ts';
import {repairRules} from '../packages/sim/repair.ts';
import {carrierRules} from '../packages/sim/garrison.ts';
import {taunts} from '../packages/content/taunts.ts';
import {religionRules} from '../packages/sim/religion.ts';
test('the 遊戲元素 tab follows the 建築 tab and has one page per aoetw element, menu order first, each once',()=>{
 assert.deepEqual(codexSections.map(s=>s.id).slice(0,5),['civs','units','techs','buildings','elements']);assert.equal(codexSections[4].label,'遊戲元素');
 assert.deepEqual(elementIds(),['armor','regeneration','garrison','hit-points','attack','rate-of-fire','frame-delay','area-of-effect','team-bonus','relic','taunts','conversion','line-of-sight']);
 assert.deepEqual(elementGroups().map(g=>g.items.map(i=>i.id)),[elementIds().slice(0,11),['conversion','line-of-sight']]);
 assert.equal(new Set(elementPages().map(p=>p.name)).size,elementIds().length);
 for(const p of elementPages()){assert.ok(p.blocks.length,`${p.id} has tables`);assert.equal(p.source,`aoetw.com/${p.slug}`);assert.ok(Array.isArray(elementLacks[p.id]),`${p.id} lacks listed`);}
 assert.equal(elementPage('nope'),null);
});
test('遊戲元素 prose has no digits; every number is on the tables',()=>{
 for(const t of [elementsIntro,elementsNote])assert.ok(!/\d/.test(t),t);
 for(const p of elementProse){for(const t of [p.name,p.summary,p.text])assert.ok(!/\d/.test(t),`${p.id}: ${t}`);assert.ok(p.text.length>=60,`${p.id} text`);}
 for(const [id,lacks] of Object.entries(elementLacks))for(const l of lacks)assert.ok(!/\d/.test(l.name+l.reason)&&l.reason.length,`${id}: ${l.name}`);
});
test('防禦類型: bonuses and class armor are the simulation numbers; the worked examples are hitDamage',()=>{
 const rows=new Map(classRows().map(r=>[r.id,r]));
 const steps=unitSteps(),step=(kind:string,tech:string)=>steps.find(s=>s.kind===kind&&s.tech===tech)!;
 for(const tech of ['spearman','pikeman','halberdier'])assert.ok(rows.get('cavalry')!.bonuses.includes(`${step('spearman',tech).name} +${step('spearman',tech).stats.bonus.cavalry}`),tech);
 assert.ok(rows.get('cavalry')!.armor.includes(`${step('cataphract','cataphract').name} +${step('cataphract','cataphract').stats.classArmor!.cavalry}`));
 for(const [b,v] of Object.entries(buildingClassArmor))assert.ok(rows.get('building')!.armor.includes(`${rules.entries.find(e=>e.id===b)!.name} +${v}`),b);
 assert.ok(rows.get('castle')!.buildings.includes('城堡')&&rows.get('wall-gate')!.buildings.length===4);
 // Every listed class has an attacker or an armor; every unit bonus of every step appears under its class.
 for(const r of rows.values())assert.ok(r.bonuses.length||r.armor.length,r.id);
 for(const s of steps)for(const [c,v] of Object.entries(s.stats.bonus))if(v)assert.ok(rows.get(c)?.bonuses.some(b=>b.endsWith(` +${v}`)),`${s.name} vs ${c}`);
 for(const ex of armorExamples()){const [a,t]=ex.title.split('打');const sa=steps.find(s=>s.name===a)!,st=steps.find(s=>s.name===t)!;assert.ok(sa&&st,ex.title);
  assert.equal(ex.total,hitDamage(sa.stats,st.stats),ex.title);assert.ok(ex.lines.at(-1)!.includes(String(ex.total)));}
 assert.ok(armorExamples()[1].lines.some(l=>l.includes('騎兵護甲')),'the cataphract example shows class armor');
});
test('射速, 開火間隔, 擴散範圍: intervals, aims and radii are the simulation numbers',()=>{
 const steps=unitSteps();
 for(const r of fireRows()){const s=steps.find(s=>s.name===r.name);if(s)assert.equal(r.ticks,s.stats.cooldown,r.name);}
 assert.equal(fireRows().length,steps.filter(s=>s.stats.attack!=='none').length+Object.keys(defenseRules.arrows).length);
 assert.deepEqual(fireGroups().flatMap(g=>g.names).sort(),fireRows().map(r=>r.name).sort());
 for(let i=1;i<fireGroups().length;i++)assert.ok(fireGroups()[i].ticks>fireGroups()[i-1].ticks);
 assert.deepEqual(frameRows().map(r=>r.name).sort(),steps.filter(s=>(s.stats.frameDelay??0)>0).map(s=>s.name).sort());
 for(const r of frameRows())assert.equal(r.ticks,steps.find(s=>s.name===r.name)!.stats.frameDelay);
 const spread=spreadRows();
 for(const s of steps.filter(s=>s.stats.blast))assert.ok(spread.some(r=>r.name===s.name&&r.effect==='範圍傷害'&&r.radius===`${s.stats.blast!/100} 格`&&r.who.startsWith(s.stats.friendlyFire?'敵我不分':'只傷敵人')),s.name);
 assert.ok(spread.some(r=>r.name.includes('後勤'))&&spread.some(r=>r.name.includes('戰狼號')),'unique technologies that add a spread');
});
test('駐軍, 血量, 回血: capacities, repair rates and costs, heal rates from the simulation',()=>{
 const rows=garrisonRows(),cap=(name:string)=>rows.find(r=>r.place===name)!.capacity;
 for(const k of Object.keys(defenseRules.capacity))assert.equal(cap(rules.entries.find(e=>e.id===k)!.name),String(garrisonCapacity({civs:[neutralCiv],ages:[4],techs:[[]]},{kind:k,player:0})),k);
 for(const [k,n] of Object.entries(defenseRules.rallyGarrison))assert.equal(cap(rules.entries.find(e=>e.id===k)!.name),String(n),k);
 const ram=carrierRules.ram.capacity;assert.ok(rows.at(-1)!.capacity===`${ram.ram}／${ram['capped-ram']}／${ram['siege-ram']}`);
 assert.deepEqual(repairPerSecond('building'),{first:repairRules.buildingRate*tick/100,extra:repairRules.buildingRate*tick/200});
 assert.deepEqual(repairPerSecond('unit'),{first:repairRules.unitRate*tick/100,extra:repairRules.unitRate*tick/200});
 for(const e of repairExamples){const c=costOf(e,{civ:neutralCiv,age:4,techs:[]}),r=repairCostOf(e);
  assert.equal(r.wood,Math.floor((e==='town-center'?c.wood*2:c.wood)*repairRules.costShare),e);assert.equal(r.stone,e==='town-center'?0:Math.floor(c.stone*repairRules.costShare),e);}
 const hp=hpRange();assert.equal(hp.buildingHigh.hp,Math.max(...buildKinds.map(b=>buildingHpOf(b))));assert.equal(hp.unitLow.hp,Math.min(...unitSteps().map(s=>s.stats.hp)));
 const regen=regenRows();assert.equal(regen[0].rate,`每分鐘 ${statsOf('berserk',{civ:'vikings',age:4,techs:[]}).regen} 點`);
 assert.equal(regen[1].rate,`每分鐘 ${60*tick/defenseRules.healTicks} 點`);assert.equal(regen[2].rate,`每分鐘 ${60*tick/defenseRules.healTicks*defenseRules.healRate.castle} 點`);
});
test('團隊加分, 聖物, 嘲諷語音, 招降: from the civilizations, religion rules and the taunt table',()=>{
 const team=teamRows();assert.equal(team.length,civDefs.length-1);
 for(const c of civDefs.filter(c=>c.id!==neutralCiv))assert.equal(team.find(t=>t.civ===c.name)!.texts.length,c.effects.filter(e=>e.scope==='team').length,c.id);
 assert.deepEqual(relicFacts(),{count:religionRules.relics.count,goldEvery:religionRules.relics.goldTicks/tick,perMonastery:religionRules.relics.perMonastery,victory:relicFacts().victory});
 assert.equal(relicFacts().victory,`${Math.floor(religionRules.relics.victoryTicks/tick/60)} 分 ${religionRules.relics.victoryTicks/tick%60} 秒`);
 assert.equal(tauntRows().length,42);assert.deepEqual(tauntRows().map(t=>[t.n,t.zh,t.en]),taunts.map(t=>[t.n,t.zh,t.en]));
 assert.deepEqual(tauntRows().filter(t=>!t.spoken).map(t=>t.n),[11,39,40,41]);
 const c=conversionFacts();assert.deepEqual([c.min,c.max,c.chance,c.faithMin,c.faithMax],[religionRules.attempts.min,religionRules.attempts.max,religionRules.attemptChance,religionRules.faithAttempts.min,religionRules.faithAttempts.max]);
 assert.equal(c.never.length,religionRules.unconvertibleBuildings.length);
});

// ── 戰術技巧 ────────────────────────────────────────────────────────────────────────────────────────────────────────
import {tacticIds,tacticGroups,tacticPage,tacticPages,stepPhases,infobox,planFacts,civsText,shotRows,buildingShotRows,stanceRows,ballisticsFacts,phaseNames,coachText} from '../apps/web/codex-tactics.ts';
import {tacticProse,tacticLacks,tacticsIntro,tacticsNote,basicUpgradesText} from '../packages/content/codex.ts';
import {openings,unavailableOpenings} from '../packages/content/openings.ts';
import {shotOf,buildingShotOf,projectileRules} from '../packages/sim/stats.ts';
import {stances,tacticsRules} from '../packages/sim/combat.ts';
test('the 戰術技巧 tab follows 遊戲元素; openings in the site\'s list order, then the micro techniques, each once',()=>{
 // The 科技樹 round's tab comes after it.
 assert.deepEqual(codexSections.map(s=>s.id).slice(-3,-1),['elements','tactics']);assert.equal(codexSections.at(-2)!.label,'戰術技巧');
 assert.deepEqual(tacticIds(),['armstower','scrush','archerstar','armstar','brushtof','brushfc','towerrush','eglerush','fontrush','bbrush','pull','surround','focus','clump','spread','dodge','split','block']);
 assert.deepEqual(tacticGroups().map(g=>g.items.map(i=>i.id)),[tacticIds().slice(0,10),tacticIds().slice(10)]);
 // Every playable opening has a page, the eagle opening is listed but not playable, and nothing else is.
 assert.deepEqual(tacticGroups()[0].items.filter(i=>i.available).map(i=>i.id).sort(),openings.map(o=>o.id).sort());
 assert.deepEqual(tacticGroups()[0].items.filter(i=>!i.available).map(i=>i.id),unavailableOpenings.map(u=>u.id));
 for(const p of tacticPages()){assert.ok(p.blocks.length,p.id);assert.ok(Array.isArray(tacticLacks[p.id]),`${p.id} lacks listed`);assert.equal(p.available,p.group==='micro'||!!openings.find(o=>o.id===p.id),p.id);}
 const egle=tacticPage('eglerush')!;assert.equal(egle.reason,unavailableOpenings[0].reason);assert.equal(tacticPage('nope'),null);
});
test('戰術技巧 prose has no digits; the step labels and numbers come from the data',()=>{
 for(const t of [tacticsIntro,tacticsNote,basicUpgradesText,coachText])assert.ok(!/\d/.test(t),t);
 for(const p of tacticProse){for(const t of [p.name,p.summary,p.text,p.how??''])assert.ok(!/\d/.test(t),`${p.id}: ${t}`);assert.ok(p.text.length>=60,`${p.id} text`);assert.equal(!!p.how,p.group==='micro',p.id);}
 for(const [id,lacks] of Object.entries(tacticLacks))for(const l of lacks)assert.ok(!/\d/.test(l.name+l.reason)&&l.reason.length,`${id}: ${l.name}`);
});
test('opening pages: infobox, steps, allocation, counters and the computer\'s plan are the opening data',()=>{
 for(const o of openings){const p=tacticPage(o.id)!,block=(t:string)=>p.blocks.find(b=>b.title===t)!;
  const steps=block('流程') as Extract<typeof p.blocks[number],{kind:'steps'}>;
  assert.deepEqual(steps.phases.flatMap(g=>g.steps.map(s=>[g.label,s.label,s.check])),o.steps.map(s=>[phaseNames[s.phase],s.label,!!s.done]),o.id);
  assert.deepEqual(steps.phases,stepPhases(o));
  assert.deepEqual((block('資訊框') as {items:{label:string;value:string}[]}).items.map(i=>[i.label,i.value]),infobox(o));
  assert.ok(infobox(o).some(([l,v])=>l==='適合文明'&&v===civsText(o.civs)));
  assert.deepEqual((block('升級前配置') as {items:{value:string}[]}).items.map(i=>i.value),[o.allocation,o.siteAllocation]);
  assert.deepEqual((block('反制') as {items:string[]}).items,[...o.counters]);
  const plan=planFacts(o);assert.deepEqual((block('電腦怎麼打') as {items:{label:string;value:string}[]}).items.map(i=>[i.label,i.value]),plan);
  assert.ok(plan.some(([l,v])=>l==='村民目標'&&v===`${o.plan.villagers} 名`)&&plan.some(([l,v])=>l==='升第二時代'&&v.includes(`村民 ${o.plan.clickAt} 名`)),o.id);
  if(o.plan.towers)assert.ok(plan.some(([l,v])=>l==='前置箭塔'&&v.includes(`蓋 ${o.plan.towers!.count} 座`)),o.id);
  if(o.plan.raid)assert.ok(plan.some(([l,v])=>l==='騷擾'&&v.includes(`${o.plan.raid!.sendAt} 隻`)),o.id);}
});
test('micro pages: accuracy, projectile speed, Ballistics and stances are the simulation numbers',()=>{
 const rows=shotRows();assert.ok(rows.length>=20);
 for(const r of rows){const s=unitSteps().find(s=>s.name===r.name)!,o=stepOwner(s.kind,lineStepIds(s.kind).indexOf(s.tech)),shot=shotOf(s.kind,o)!;
  assert.deepEqual([r.accuracy,r.speed],[shot.accuracy,shot.speed],r.name);assert.equal(r.lead,shotOf(s.kind,{...o,techs:[...o.techs,'ballistics']})!.lead,r.name);}
 // Thumb Ring makes the archer sure of a standing target; Warwolf the trebuchet; the hand cannoneer never.
 assert.equal(rows.find(r=>r.kind==='archer')!.steady,100);assert.equal(rows.find(r=>r.kind==='trebuchet')!.steady,100);assert.equal(rows.find(r=>r.kind==='hand-cannoneer')!.steady,null);
 assert.equal(rows.find(r=>r.kind==='archer')!.lead,true);assert.equal(rows.find(r=>r.kind==='hand-cannoneer')!.lead,false);
 for(const b of buildingShotRows())assert.deepEqual([b.accuracy,b.speed,b.lead],[buildingShotOf(b.kind).accuracy,buildingShotOf(b.kind).speed,buildingShotOf(b.kind,['ballistics']).lead]);
 const dodge=tacticPage('dodge')!.blocks.find(b=>b.title==='遠程單位') as {rows:string[][]};
 assert.equal(dodge.rows.length,rows.length);assert.equal(dodge.rows[0][3],`${rows[0].speed*tick/100} 格/秒`);
 const miss=tacticPage('dodge')!.blocks.find(b=>b.title==='命中與落空') as {items:{value:string}[]};assert.ok(miss.items[0].value.includes(`${projectileRules.hitRadius/100} 格`));
 assert.deepEqual(stanceRows().map(r=>r.stance),[...stances]);assert.ok(stanceRows()[1].chase.includes(`${tacticsRules.defensiveLeash/100} 格`));
 const b=ballisticsFacts();assert.equal(b[1][1],`木材 ${costOf('ballistics',{civ:neutralCiv,age:3,techs:[]}).wood}、黃金 ${costOf('ballistics',{civ:neutralCiv,age:3,techs:[]}).gold}`);
});
// ── 科技樹 (the 科技樹 round) ─────────────────────────────────────────────────────────────────────────────────────────
import {civTree,treeNodes,treeMark,treeBlockOrder,treeIntro,treeNote} from '../apps/web/codex-tree.ts';
import type {TreeMatch} from '../apps/web/codex-tree.ts';
import {lineUpgrades as treeLines} from '../packages/sim/stats.ts';
const treeEntries=(civ:string)=>rules.entries.filter(e=>!uniqueUnitOwner[e.id]||uniqueUnitOwner[e.id]===civ).map(e=>e.id).sort();
test('the 科技樹 tab: every entry of a civilization\'s tree appears exactly once, in the site\'s block order',()=>{
 assert.equal(codexSections.at(-1)!.id,'tree');assert.equal(codexSections.at(-1)!.label,'科技樹');
 assert.doesNotMatch(treeIntro,/\d/);assert.ok(treeNote.includes('aoetw.com'));
 // The site's fourteen blocks in page order, with the villagers' build block after the town centre.
 assert.deepEqual([...treeBlockOrder],['barracks','archery-range','stable','siege-workshop','castle','town-center','build','mill','lumber-camp','mining-camp','dock','blacksmith','market','monastery','university']);
 for(const c of civDefs){const t=civTree(c.id),nodes=treeNodes(t).filter(n=>!n.alias&&n.kind!=='ref'),ids=nodes.map(n=>n.id);
  for(const id of treeEntries(c.id))assert.equal(ids.filter(x=>x===id).length,1,`${c.id} ${id}`);
  // Anything else is another civilization's unique item the site shows greyed in a common block (the dock's longboat).
  for(const n of nodes.filter(n=>!treeEntries(c.id).includes(n.id))){assert.ok(uniqueUnitOwner[n.id]&&uniqueUnitOwner[n.id]!==c.id,`${c.id} ${n.id}`);assert.equal(n.available,false);}
  assert.deepEqual(t.blocks.map(b=>b.id),[...treeBlockOrder],c.id);}
 // The castle shows the civilization's own unique unit and technologies; the neutral civilization has none.
 const castle=(civ:string)=>civTree(civ).blocks.find(b=>b.id==='castle')!.columns.flat().flatMap(c=>c.nodes).map(n=>n.id);
 for(const id of ['longbowman','elite-longbowman','yeomen','warwolf'])assert.ok(castle('britons').includes(id),id);
 assert.ok(!castle('britons').includes('berserk'));assert.ok(!treeNodes(civTree(neutralCiv)).some(n=>n.unique&&n.available));
});
test('科技樹 availability marks equal the rules for every civilization; reference items are marked, not playable',()=>{
 for(const c of civDefs){const t=civTree(c.id);
  for(const n of treeNodes(t)){if(n.kind==='ref'){assert.equal(n.available,false,n.id);assert.ok(n.reason,n.id);continue;}
   const want=n.alias?civAvailable(c.id,n.id)&&civAvailable(c.id,treeLines.find(l=>l.id===n.id&&n.key.endsWith(`:${n.id}`)&&n.key.startsWith(`${l.kind}:`))!.kind):civAvailable(c.id,n.id);
   assert.equal(n.available,want,`${c.id} ${n.key}`);}}
 // Without reference items nothing faint is drawn.
 assert.ok(!treeNodes(civTree('britons',false)).some(n=>n.kind==='ref'));
 assert.ok(treeNodes(civTree('britons')).some(n=>n.id==='eagle-scout'&&n.kind==='ref'));
});
test('科技樹 follows the site\'s grid; every connector drawn is a real prerequisite or line step',()=>{
 const lineOf=(kind:string)=>[kind,...treeLines.filter(l=>l.kind===kind).map(l=>l.id)];
 const holds=(a:any,b:any)=>a.kind==='ref'&&b.kind==='ref'||!!rules.entries.find(e=>e.id===b.id)?.requires.includes(a.id)||
  treeLines.some(l=>l.id===b.id&&lineOf(l.kind).indexOf(b.id)===lineOf(l.kind).indexOf(a.id)+1&&lineOf(l.kind).includes(a.id));
 for(const c of civDefs)for(const b of civTree(c.id).blocks)for(const col of b.columns){
  col.forEach((cell,r)=>{cell.links.forEach((on,i)=>{if(on)assert.ok(holds(cell.nodes[i],cell.nodes[i+1]),`${c.id} ${cell.nodes[i].id}→${cell.nodes[i+1].id}`);});
   if(cell.down){const below=col.findIndex((x,rr)=>rr>r&&x.nodes.length);assert.ok(below>r&&col[below].up,`${c.id} ${b.id} down`);
    assert.ok(holds(cell.nodes.at(-1),col[below].nodes[0]),`${c.id} ${cell.nodes.at(-1)!.id}↓${col[below].nodes[0].id}`);
    for(let rr=r+1;rr<below;rr++)assert.ok(col[rr].pipe&&!col[rr].nodes.length);}});}
 const cells=(civ:string,block:string)=>{const b=civTree(civ).blocks.find(x=>x.id===block)!;return b.ages.map((age,r)=>[age,b.columns.map(col=>col[r].nodes.map(n=>`${n.name}${n.alias?'*':''}`).join('|'))] as [number,string[]]);};
 // War Galley is one research: the galley's column shows it, the fire galley's and demolition raft's what it makes of them.
 assert.deepEqual(cells('britons','dock').find(([age])=>age===3)![1].slice(0,3),['火戰船*','爆破船*','弩砲戰船']);
 // The town centre's rows from the Dark Age; the build block by age.
 assert.deepEqual(civTree('britons').blocks.find(b=>b.id==='town-center')!.ages,[1,2,3]);
 assert.deepEqual(cells('britons','build'),[[1,['民居','木牆','木門','哨站']],[2,['箭塔','石牆','城門','']],[4,['火砲塔','世界奇觀','','']]]);
 // Cross-block notes: Chemistry for the gunpowder units, the bombard tower's technology, the towers' University upgrades.
 const node=(id:string)=>treeNodes(civTree('turks')).find(n=>n.id===id&&!n.alias)!;
 for(const id of ['hand-cannoneer','bombard-cannon','cannon-galleon'])assert.deepEqual(node(id).needs,['化學'],id);
 assert.deepEqual(node('bombard-tower').needs,['火砲塔技術']);assert.deepEqual(node('watch-tower').leads,['防禦箭塔','大型箭塔']);
 // The site's arrow from Cartography to Caravan is not a prerequisite here: not drawn.
 const market=civTree('britons').blocks.find(b=>b.id==='market')!;assert.equal(market.columns[0][0].down,false);
});
test('科技樹 match marks: researched, owned, in progress, possible now, short of resources, not yet, not in the tree',()=>{
 const m:TreeMatch={civ:'britons',age:2,techs:['loom','fletching'],stock:{food:120,wood:100,gold:40,stone:0},
  buildings:[{kind:'town-center',complete:true,queue:[{entryId:'villager'}]},{kind:'barracks',complete:true,queue:[]},{kind:'archery-range',complete:false,queue:[]},{kind:'blacksmith',complete:true,queue:[]}],units:{villager:6,militia:2}};
 const t=civTree('britons'),node=(id:string)=>treeNodes(t).find(n=>n.id===id&&!n.alias)!,state=(id:string)=>treeMark(node(id),m);
 assert.equal(state('loom').state,'done');assert.equal(state('age-2').state,'done');assert.equal(state('fletching').state,'done');
 assert.equal(state('villager').state,'queued');assert.deepEqual([state('militia').state,state('militia').count],['owned',2]);
 assert.equal(state('archery-range').state,'queued');assert.deepEqual([state('barracks').state,state('barracks').count],['owned',1]);
 // Man-at-Arms: a standing barracks, the second age, 100 food 40 gold: possible now; Feudal-age Forging lacks food.
 assert.equal(state('man-at-arms').state,'ready');assert.equal(state('forging').state,'short');
 // The Castle and the Crossbowman need the third age: not yet.
 assert.equal(state('castle').state,'later');assert.equal(state('crossbowman').state,'later');
 // Not in the Britons' tree, and not in this game.
 assert.equal(state('hussar').state,'off');assert.equal(treeMark(treeNodes(t).find(n=>n.id==='eagle-scout')!,m).state,'ref');
});
