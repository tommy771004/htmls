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
  assert.deepEqual(u.cost,costOf(kind,o3),`${kind} cost`);assert.equal(u.seconds,timeTicks(kind,o3,'castle')/tick,`${kind} time`);
  assert.equal(u.stats.hp,st.hp);assert.equal(u.stats.damage,st.damage);assert.equal(u.stats.range,st.range);assert.deepEqual(u.stats.armor,st.armor);
  assert.equal(u.stats.cooldown,st.cooldown);assert.equal(u.stats.speed,speedOf(kind,o3));assert.deepEqual(Object.fromEntries(u.stats.bonus.map(b=>[b.vs,b.value])),st.bonus);
  assert.equal(u.stats.regen,st.regen??0);assert.equal(u.stats.extraShots,st.extraShots??0);assert.equal(u.stats.splash,st.splash??0);
  assert.ok(u.elite,`${kind} elite`);const o4={civ:c.id,age:4,techs:[u.elite!.id]},el=statsOf(kind,o4);
  assert.equal(u.elite!.id,`elite-${kind}`);assert.deepEqual(u.elite!.cost,costOf(u.elite!.id,{civ:c.id,age:4,techs:[]}));
  assert.equal(u.elite!.stats.hp,el.hp);assert.equal(u.elite!.stats.damage,el.damage);assert.equal(u.elite!.stats.range,el.range);assert.deepEqual(u.elite!.stats.armor,el.armor);
  // Every bonus class, unit class and range reads in Chinese.
  for(const s of [u.stats,u.elite!.stats])for(const b of s.bonus)assert.ok(classLabel[b.vs],`${kind} bonus ${b.vs}`);
  for(const k of st.classes)assert.ok(classLabel[k],`${kind} class ${k}`);
  assert.ok(u.name&&u.name!==kind);assert.equal(u.at,'城堡');assert.equal(u.elite!.age,4);}
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
 assert.deepEqual(civDetail(neutralCiv).tree.flatMap(g=>g.entries.map(e=>e.id)),['castle']);
 assert.deepEqual(civDetail('turks').tree.find(g=>g.building==='barracks')!.entries.map(e=>e.id),['pikeman']);
});
