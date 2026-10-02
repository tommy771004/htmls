// The encyclopedia's 遊戲元素 category (the 遊戲元素 round): one page per aoetw.com element, each a prose summary from
// packages/content/codex.ts and tables read live from the simulation (stats.ts, defense.ts, religion.ts, repair.ts,
// garrison.ts, naval.ts, vision.ts, taunts.ts). Pure (no DOM), so node tests import it; codex.ts renders it.
import {rules} from '../../packages/content/rules.ts';
import {civDefs,neutralCiv} from '../../packages/content/civs.ts';
import {elementProse,elementLacks,elementsIntro,elementsNote,classLabel} from '../../packages/content/codex.ts';
import type {ElementProse} from '../../packages/content/codex.ts';
import {taunts} from '../../packages/content/taunts.ts';
import {techEffects} from '../../packages/content/techs.ts';
import {statsOf,lineUpgrades,buildingHpOf,buildingClassesOf,buildingClassArmor} from '../../packages/sim/stats.ts';
import type {CombatUnitKind,UnitStats} from '../../packages/sim/stats.ts';
import {defenseRules,garrisonCapacity} from '../../packages/sim/defense.ts';
import {religionRules} from '../../packages/sim/religion.ts';
import {repairRules} from '../../packages/sim/repair.ts';
import {carrierRules} from '../../packages/sim/garrison.ts';
import {navalRules} from '../../packages/sim/naval.ts';
import {visionRules} from '../../packages/sim/vision.ts';
import {revealTicks} from '../../packages/sim/combat.ts';
import {buildKinds} from '../../packages/sim/buildings.ts';
import {costOf,garrisonHealScale,healRateScale,transportCapacityOf} from '../../packages/sim/civ.ts';
import type {Owner} from '../../packages/sim/civ.ts';
import {unitLineKinds,lineStepIds,stepOwner,numberText,ageName,techPages} from './codex-model.ts';
export {elementsIntro,elementsNote};
const tick=rules.settings.tickHz;
const nameOf=(id:string)=>rules.entries.find(e=>e.id===id)?.name??id;
const label=(c:string)=>classLabel[c]??c;
const tiles=(units:number)=>`${numberText(units/100)} 格`;
const secs=(ticks:number)=>`${numberText(ticks/tick)} 秒`;
const perMinute=(everyTicks:number)=>numberText(60*tick/everyTicks);
const neutral=(age=4,techs:string[]=[]):Owner=>({civ:neutralCiv,age,techs});
// ── Page shape ───────────────────────────────────────────────────────────────────────────────────────────────────────
// A table (first column names the row), a set of labelled facts, a plain list, a worked damage example or the taunts.
export type ElementTable={kind:'table';title:string;note:string|null;head:string[];rows:string[][]};
export type ElementFacts={kind:'facts';title:string;note:string|null;items:{label:string;value:string}[]};
export type ElementList={kind:'list';title:string;note:string|null;items:string[]};
export type ElementExample={kind:'example';title:string;note:string|null;attacker:string;target:string;lines:string[];total:number};
export type ElementTaunts={kind:'taunts';title:string;note:string|null;rows:{n:number;zh:string;en:string;spoken:boolean}[]};
export type ElementBlock=ElementTable|ElementFacts|ElementList|ElementExample|ElementTaunts;
export type ElementPage=ElementProse&{blocks:ElementBlock[];lacks:readonly {name:string;reason:string}[];source:string};
const table=(title:string,head:string[],rows:string[][],note:string|null=null):ElementTable=>({kind:'table',title,note,head,rows});
const facts=(title:string,items:[string,string][],note:string|null=null):ElementFacts=>({kind:'facts',title,note,items:items.map(([label,value])=>({label,value}))});
const list=(title:string,items:string[],note:string|null=null):ElementList=>({kind:'list',title,note,items});
// ── Units as the codex reads them: every line step, with its owner's research (the neutral civilization) ──────────────
export type StepStats={kind:CombatUnitKind;tech:string;name:string;stats:UnitStats};
export function unitSteps():StepStats[]{
 return unitLineKinds().flatMap(kind=>lineStepIds(kind).map((tech,i)=>({kind,tech,name:i?lineUpgrades.find(u=>u.id===tech&&u.kind===kind)!.name:nameOf(kind),stats:statsOf(kind,stepOwner(kind,i))})));}
// One line's values written once per change: 長槍兵 +12、長矛兵 +18 (a step repeating the one before is left out).
function perStep(steps:StepStats[],value:(s:StepStats)=>number,fmt:(v:number)=>string){
 const out:string[]=[];let last:{kind:string;v:number}|null=null;
 for(const s of steps){const v=value(s);if(!v){last={kind:s.kind,v};continue;}if(last&&last.kind===s.kind&&last.v===v)continue;out.push(`${s.name} ${fmt(v)}`);last={kind:s.kind,v};}
 return out;}
const signed=(v:number)=>v>0?`+${v}`:String(v);
// ── 防禦類型 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// Every class a unit or a building carries here, in the label table's order (then any other).
export function armorClasses(){
 const steps=unitSteps(),seen=new Set<string>();for(const s of steps)for(const c of s.stats.classes)seen.add(c);for(const b of buildKinds)for(const c of buildingClassesOf(b))seen.add(c);
 const order=Object.keys(classLabel);return [...seen].filter(c=>c!=='animal').sort((a,b)=>(order.indexOf(a)+1||999)-(order.indexOf(b)+1||999)||(a<b?-1:1));}
export type ClassRow={id:string;label:string;units:string[];buildings:string[];bonuses:string[];armor:string[]};
export function classRows():ClassRow[]{
 const steps=unitSteps();
 return armorClasses().map(c=>{
  const units=[...new Set(steps.filter(s=>s.stats.classes.includes(c)).map(s=>nameOf(s.kind)))];
  const buildings=buildKinds.filter(b=>buildingClassesOf(b).includes(c)).map(nameOf);
  const bonuses=[...perStep(steps,s=>s.stats.bonus[c]??0,v=>`+${v}`),
   ...Object.entries(defenseRules.arrows).filter(([,a])=>a.bonus?.[c]).map(([b,a])=>`${nameOf(b)}的箭 +${a.bonus![c]}`)];
  const armor=[...perStep(steps,s=>s.stats.classArmor?.[c]??0,signed),
   ...(c==='building'?Object.entries(buildingClassArmor).map(([b,v])=>`${nameOf(b)} ${signed(v)}`):[])];
  return {id:c,label:label(c),units,buildings,bonuses,armor};})
  // Grouping classes nothing keys a bonus or an armor on (散兵, 戰艦 …) are the game's bookkeeping, not armor classes.
  .filter(r=>r.bonuses.length||r.armor.length);}
// One hit broken into its parts, the parts summing to hitDamage.
export function damageExample(attacker:{name:string;stats:UnitStats},target:{name:string;stats:UnitStats}):ElementExample{
 const a=attacker.stats,t=target.stats,kind=a.attack==='pierce'?'遠程':'近戰',armor=a.attack==='pierce'?t.armor[1]:t.armor[0],base=Math.max(0,a.damage-armor);
 const lines=[`攻擊 ${a.damage} − ${kind}護甲 ${armor} = ${base}`];let sum=base;
 for(const c of t.classes){const b=a.bonus[c];if(!b)continue;const ca=t.classArmor?.[c]??0,part=Math.max(0,b-ca);sum+=part;
  lines.push(`對${label(c)} +${b}${ca?` − ${label(c)}護甲 ${ca} = ${part}`:''}`);}
 const total=Math.max(1,sum);lines.push(`合計 ${total}${total!==sum?'（至少一點）':''}`);
 return {kind:'example',title:`${attacker.name}打${target.name}`,note:null,attacker:attacker.name,target:target.name,lines,total};}
const stepOf=(kind:CombatUnitKind,tech:string)=>{const i=lineStepIds(kind).indexOf(tech);return {name:i?lineUpgrades.find(u=>u.id===tech&&u.kind===kind)!.name:nameOf(kind),stats:statsOf(kind,stepOwner(kind,Math.max(0,i)))};};
export const armorExamples=()=>[damageExample(stepOf('spearman','halberdier'),stepOf('war-elephant','war-elephant')),damageExample(stepOf('spearman','pikeman'),stepOf('cataphract','cataphract'))];
function armorPage(){
 const rows=classRows();
 return [table('類型一覽',['類型','單位','建築','有加成的攻擊者','類型護甲'],rows.map(r=>[r.label,r.units.join('、')||'—',r.buildings.join('、')||'—',r.bonuses.join('、')||'—',r.armor.join('、')||'—']),
  '只列有攻擊者加成或類型護甲的類型；數值寫到該兵種的升級步驟，「類型護甲」只列不是零的'),...armorExamples()];}
// ── 攻擊 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function attackGroups(){const kinds=unitLineKinds(),base=(k:CombatUnitKind)=>statsOf(k,neutral(1)).attack;
 return {melee:kinds.filter(k=>base(k)==='melee').map(nameOf),pierce:kinds.filter(k=>base(k)==='pierce').map(nameOf),none:kinds.filter(k=>base(k)==='none').map(nameOf),
  buildings:Object.keys(defenseRules.arrows).map(nameOf)};}
export function attackExtremes(){
 const armed=unitSteps().filter(s=>s.stats.attack!=='none'),hi=armed.reduce((a,b)=>b.stats.damage>a.stats.damage?b:a),lo=armed.reduce((a,b)=>b.stats.damage<a.stats.damage?b:a);
 const arrows=Object.entries(defenseRules.arrows),bhi=arrows.reduce((a,b)=>b[1].damage>a[1].damage?b:a),blo=arrows.reduce((a,b)=>b[1].damage<a[1].damage?b:a);
 return {highest:{name:hi.name,value:hi.stats.damage},lowest:{name:lo.name,value:lo.stats.damage},building:{name:nameOf(bhi[0]),value:bhi[1].damage},buildingLow:{name:nameOf(blo[0]),value:blo[1].damage}};}
function attackPage(){const g=attackGroups(),x=attackExtremes();
 return [table('近戰與遠程',['攻擊方式','單位與建築'],[['近戰（扣近戰護甲）',g.melee.join('、')],['遠程（扣遠程護甲）',[...g.pierce,...g.buildings.map(b=>`${b}的箭`)].join('、')],['沒有攻擊',g.none.join('、')]]),
  facts('最高與最低',[['單位攻擊最高',`${x.highest.name} ${x.highest.value}`],['單位攻擊最低',`${x.lowest.name} ${x.lowest.value}`],['建築攻擊最高',`${x.building.name} ${x.building.value}`],['建築攻擊最低',`${x.buildingLow.name} ${x.buildingLow.value}`]],'未研究任何科技、不加文明加成')];}
// ── 射速、開火間隔 ─────────────────────────────────────────────────────────────────────────────────────────────────
export function fireRows(){
 const units=unitSteps().filter(s=>s.stats.attack!=='none').map(s=>({name:s.name,ticks:s.stats.cooldown}));
 const buildings=Object.entries(defenseRules.arrows).map(([b,a])=>({name:`${nameOf(b)}（箭）`,ticks:a.cooldown}));
 return [...units,...buildings].sort((a,b)=>a.ticks-b.ticks||(a.name<b.name?-1:1));}
// Units sharing an interval on one row, fastest first (the site's table lists them the same way).
export function fireGroups(){const out:{ticks:number;names:string[]}[]=[];for(const r of fireRows()){const last=out[out.length-1];if(last&&last.ticks===r.ticks)last.names.push(r.name);else out.push({ticks:r.ticks,names:[r.name]});}return out;}
function firePage(){
 return [table('射擊間隔',['兩次攻擊間隔','單位'],fireGroups().map(g=>[secs(g.ticks),g.names.join('、')]),'由快到慢；每一步升級各列一次，未研究射速科技')];}
export const frameRows=()=>unitSteps().filter(s=>(s.stats.frameDelay??0)>0).map(s=>({name:s.name,ticks:s.stats.frameDelay!})).sort((a,b)=>a.ticks-b.ticks||(a.name<b.name?-1:1));
function framePage(){const rows=frameRows();
 return [table('有開火間隔的單位',['單位','第一發前的瞄準'],rows.map(r=>[r.name,secs(r.ticks)])),
  list('沒有開火間隔',['所有近戰單位','所有船隻','會射箭的建築'])];}
// ── 擴散範圍 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
type Spread={name:string;effect:string;radius:string;who:string};
const spreadOf=(name:string,st:UnitStats):Spread[]=>{const out:Spread[]=[];
 if(st.blast)out.push({name,effect:'範圍傷害',radius:tiles(st.blast),who:st.friendlyFire?'敵我不分（射擊者除外）':'只傷敵人'});
 if(st.trample)out.push({name,effect:`踐踏（目標傷害的 ${numberText(st.trample*100)}%）`,radius:tiles(50),who:'只傷敵人'});
 if(st.splash)out.push({name,effect:`踐踏 ${st.splash} 點`,radius:tiles(50),who:'只傷敵人'});
 if(st.passThrough)out.push({name,effect:'貫穿（後方敵兵受一半攻擊）',radius:`目標後 ${tiles(st.passThrough)}`,who:'只傷敵人'});
 if(st.buildingSplash)out.push({name,effect:'撞擊建築時波及',radius:tiles(st.buildingSplash),who:'只傷敵方建築'});
 return out;};
const spreadKey=(st:UnitStats)=>JSON.stringify([st.blast??0,!!st.friendlyFire,st.trample??0,st.splash??0,st.passThrough??0,st.buildingSplash??0]);
export function spreadRows():Spread[]{
 const out=unitSteps().flatMap(s=>spreadOf(s.name,s.stats));
 // A civilization's unique technology that adds one (Logistica, Warwolf): the unit with that research.
 for(const c of civDefs)for(const t of c.uniqueTechs)for(const kind of unitLineKinds()){
  const o:Owner={civ:c.id,age:4,techs:[t.id]},with_=statsOf(kind,o),without=statsOf(kind,{...o,techs:[]});
  if(spreadKey(with_)!==spreadKey(without))out.push(...spreadOf(`${nameOf(kind)}（${c.name}・${t.name}）`,with_).filter(r=>!spreadOf('',without).some(w=>w.effect===r.effect&&w.radius===r.radius)));}
 return out;}
function spreadPage(){const rows=spreadRows();
 return [table('有範圍效果的攻擊',['單位','效果','範圍','對象'],rows.map(r=>[r.name,r.effect,r.radius,r.who]))];}
// ── 血量、回血 ───────────────────────────────────────────────────────────────────────────────────────────────────────
export function hpRange(){
 const steps=unitSteps(),lo=steps.reduce((a,b)=>b.stats.hp<a.stats.hp?b:a),hi=steps.reduce((a,b)=>b.stats.hp>a.stats.hp?b:a);
 const bs=buildKinds.map(b=>({name:nameOf(b),hp:buildingHpOf(b)})),blo=bs.reduce((a,b)=>b.hp<a.hp?b:a),bhi=bs.reduce((a,b)=>b.hp>a.hp?b:a);
 return {unitLow:{name:lo.name,hp:lo.stats.hp},unitHigh:{name:hi.name,hp:hi.stats.hp},buildingLow:blo,buildingHigh:bhi};}
// Hit points a repairer restores a second (the first one, each further one), buildings and units.
export const repairPerSecond=(kind:'building'|'unit')=>{const r=(kind==='building'?repairRules.buildingRate:repairRules.unitRate)*tick/100;return {first:r,extra:r/2};};
// A full repair's cost for the neutral civilization (the town centre: twice the wood, no stone).
export function repairCostOf(entry:string){const c={...costOf(entry,neutral())};if(entry==='town-center'){c.wood*=2;c.stone=0;}
 return Object.fromEntries(Object.entries(c).map(([k,v])=>[k,Math.floor(v*repairRules.costShare)])) as Record<string,number>;}
const resNames:Record<string,string>={food:'食物',wood:'木材',gold:'黃金',stone:'石頭'};
const costText=(c:Record<string,number>)=>Object.entries(c).filter(([,v])=>v>0).map(([k,v])=>`${resNames[k]} ${v}`).join('、')||'免費';
export const repairExamples=['house','castle','town-center','ram','galley'];
function hpPage(){const x=hpRange(),b=repairPerSecond('building'),u=repairPerSecond('unit');
 return [facts('生命的範圍',[['單位最少',`${x.unitLow.name} ${x.unitLow.hp}`],['單位最多',`${x.unitHigh.name} ${x.unitHigh.hp}`],['建築最少',`${x.buildingLow.name} ${x.buildingLow.hp}`],['建築最多',`${x.buildingHigh.name} ${x.buildingHigh.hp}`]],'未研究任何科技、不加文明加成'),
  facts('修理',[['建築',`第一名村民每秒 ${numberText(b.first)} 點，每多一名再加 ${numberText(b.extra)} 點`],['攻城器與船隻',`第一名村民每秒 ${numberText(u.first)} 點，每多一名再加 ${numberText(u.extra)} 點`],
   ['費用',`修滿一次是原價的 ${numberText(repairRules.costShare*100)}%，依修回的生命逐點扣款`],['城鎮中心','不收石頭，木材加倍'],
   ['距離',`攻城器 ${tiles(repairRules.siegeReach)}以內，船隻在岸上 ${tiles(repairRules.shipReach)}以內`],['不能修理',repairRules.unrepairable.map(nameOf).join('、')]]),
  table('修滿一次的費用',['修理對象','費用'],repairExamples.map(e=>[nameOf(e),costText(repairCostOf(e))]),'拓荒者（無文明加成）')];}
export function regenRows(){
 const tc=defenseRules.healTicks,castle=tc/(defenseRules.healRate.castle??1),herbal=garrisonHealScale(neutral(3,['herbal-medicine']),'town-center');
 const berserk=statsOf('berserk',{civ:'vikings',age:4,techs:[]}).regen??0,gang=statsOf('berserk',{civ:'vikings',age:4,techs:['berserkergang']}).regen??0;
 const monk=religionRules.healTicks,byz=healRateScale({civ:'byzantines',age:3,techs:[]});
 return [{source:nameOf('berserk'),rate:`每分鐘 ${berserk} 點`,note:`研究狂戰士幫後每分鐘 ${gang} 點`},
  {source:'駐軍：城鎮中心、箭塔、火砲塔、生產建築',rate:`每分鐘 ${perMinute(tc)} 點`,note:`草藥治療後 ×${numberText(herbal)}`},
  {source:'駐軍：城堡',rate:`每分鐘 ${perMinute(castle)} 點`,note:`草藥治療後 ×${numberText(herbal)}`},
  {source:'僧侶治療（每名僧侶）',rate:`每分鐘 ${perMinute(monk)} 點`,note:`拜占庭的團隊加成 ×${numberText(byz)}；攻城器與船隻不能治療`}];}
function regenPage(){return [table('回復生命的方式',['來源','速度','備註'],regenRows().map(r=>[r.source,r.rate,r.note]))];}
// ── 駐軍 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const at=(kind:string,civ=neutralCiv)=>garrisonCapacity({civs:[civ],ages:[4],techs:[[]]},{kind,player:0});
export function garrisonRows(){
 const rows=Object.keys(defenseRules.capacity).map(k=>({place:nameOf(k),capacity:String(at(k)),who:'村民與徒步單位（見下方）',arrows:defenseRules.arrows[k]?.shots===false?'裡面的單位不加砲彈':'村民與徒步弓兵加箭（見下方）'}));
 for(const [k,n] of Object.entries(defenseRules.rallyGarrison))rows.push({place:nameOf(k),capacity:String(n),who:'只收自己訓練的單位（把集結點設在建築上）',arrows:'—'});
 const t=transportCapacityOf(neutral(4,[]),navalRules.transportCapacity),t2=transportCapacityOf(neutral(4,['careening']),navalRules.transportCapacity),t3=transportCapacityOf(neutral(4,['careening','dry-dock']),navalRules.transportCapacity);
 rows.push({place:nameOf('transport-ship'),capacity:`${t}（航海技術 ${t2}、船塢 ${t3}）`,who:'陸上單位',arrows:'—'});
 const ram=carrierRules.ram;
 rows.push({place:`${nameOf('ram')}／${lineUpgrades.find(u=>u.id==='capped-ram')!.name}／${lineUpgrades.find(u=>u.id==='siege-ram')!.name}`,capacity:`${ram.capacity.ram}／${ram.capacity['capped-ram']}／${ram.capacity['siege-ram']}`,who:'步兵與徒步弓兵',
  arrows:`每名步兵：速度 +${numberText(ram.speedPerInfantry*100)}%、對建築 +${ram.buildingPerInfantry}（上限 ${ram.buildingCap.ram}／${ram.buildingCap['capped-ram']}／${ram.buildingCap['siege-ram']}）`});
 return rows;}
function garrisonPage(){
 const teutons=Object.keys(defenseRules.capacity).filter(k=>at(k,'teutons')!==at(k)).map(k=>`${nameOf(k)} ${at(k,'teutons')}`);
 return [table('可以進駐的地方',['地方','容量','誰能進去','進駐的效果'],garrisonRows().map(r=>[r.place,r.capacity,r.who,r.arrows])),
  facts('規則',[['受損撤出',`建築生命剩 ${defenseRules.ejectPercent}% 以下時全部撤出，也不能進駐`],['鐘聲','村民躲進最近、還有空位的城鎮中心、箭塔或城堡；再按一次回去工作'],
   ['條頓',teutons.length?`容量變成 ${teutons.join('、')}`:'—']]),
  list('可以進駐城鎮中心、箭塔、火砲塔與城堡的單位',defenseRules.canGarrison.map(nameOf)),list('進駐後每名多射一支箭',defenseRules.addsArrow.map(nameOf),'火砲塔除外')];}
// ── 團隊加分 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export const teamRows=()=>civDefs.filter(c=>c.id!==neutralCiv).map(c=>({civ:c.name,texts:c.effects.filter(e=>e.scope==='team').map(e=>e.text.replace(/^團隊加成：/,''))}));
function teamPage(){return [table('各文明的團隊加分',['文明','團隊加分'],teamRows().map(r=>[r.civ,r.texts.join('；')||'—']),'一對一沒有盟友：只對自己生效')];}
// ── 聖物 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const clock=(ticks:number)=>{const s=Math.round(ticks/tick),m=Math.floor(s/60);return `${m} 分 ${s%60} 秒`;};
export const relicFacts=()=>{const r=religionRules.relics;return {count:r.count,goldEvery:r.goldTicks/tick,perMonastery:r.perMonastery,victory:clock(r.victoryTicks)};};
function relicPage(){const r=relicFacts();
 return [facts('聖物',[['地圖上的數量',`對戰圖 ${r.count} 個`],['產生黃金',`每個聖物每 ${numberText(r.goldEvery)} 秒 1 黃金`],['每座修道院',`最多放 ${r.perMonastery} 個`],['聖物勝利',`收齊後撐過 ${r.victory}`],['搬運','只有僧侶能搬；搬著聖物不能轉化或進駐']])];}
// ── 嘲諷語音 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export const tauntRows=()=>taunts.map(t=>({n:t.n,zh:t.zh,en:t.en,spoken:!/^（.*）$/.test(t.zh)}));
function tauntPage():ElementBlock[]{return [{kind:'taunts',title:`全部 ${taunts.length} 句`,note:'按輸入鍵打開聊天列，編號放在最前面',rows:tauntRows()}];}
// ── 招降 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function conversionFacts(){const r=religionRules,s=r.attemptTicks/tick;
 return {range:r.convertRange,printing:r.printingRange,attempt:s,min:r.attempts.min,max:r.attempts.max,chance:r.attemptChance,faithMin:r.faithAttempts.min,faithMax:r.faithAttempts.max,
  building:[r.buildingTicks.min/tick,r.buildingTicks.max/tick],recharge:r.rechargeTicks/tick,never:r.unconvertibleBuildings.map(nameOf)};}
function conversionPage(){const c=conversionFacts();
 const teuton=civDefs.find(x=>x.id==='teutons')?.effects.find(e=>e.kind==='conversionResist');
 const monastery=techPages().filter(t=>t.building==='monastery');
 return [facts('招降的步驟',[['射程',`${tiles(c.range)}（活字印刷 +${tiles(c.printing)}）`],['每次嘗試',`約 ${numberText(c.attempt)} 秒`],
   ['單位',`第 ${c.min} 次起每次 ${c.chance}% 成功，第 ${c.max} 次一定成功`],['研究了忠誠信仰的對手',`第 ${c.faithMin} 次起、第 ${c.faithMax} 次一定成功`],
   ['建築（要研究救贖）',`${numberText(c.building[0])}–${numberText(c.building[1])} 秒`],['信仰恢復',`${numberText(c.recharge)} 秒（啟蒙減半）`],
   ['永遠不能招降',c.never.join('、')],['條頓',teuton?teuton.text.replace(/^團隊加成：/,''):'—']]),
  list('修道院的相關科技',monastery.map(t=>`${t.name}：${t.effects.join('；')||t.text}`))];}
// ── 視野 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function sightRows(){const v=visionRules;
 return [['一般單位',tiles(v.unitRadius)],[nameOf('scout'),tiles(v.scoutRadius)],['羊',tiles(v.sheepRadius)],
  [`${nameOf('house')}、${nameOf('barracks')}、${nameOf('market')}、${nameOf('dock')}、城門`,tiles(v.houseRadius)],[nameOf('town-center'),tiles(v.townCenterRadius)],
  [`${nameOf('watch-tower')}、${nameOf('bombard-tower')}、${nameOf('castle')}`,tiles(v.towerRadius)],[nameOf('outpost'),v.outpostRadius.map((r,i)=>`${ageName(i+1)} ${tiles(r)}`).join('、')],
  ['城牆',tiles(v.wallRadius)],[nameOf('wonder'),tiles(v.wonderRadius)]] as [string,string][];}
function sightPage(){
 const techs=techEffects.filter(e=>e.kind==='los').map(e=>e.text),civs=civDefs.flatMap(c=>c.effects.filter(e=>e.kind==='los').map(e=>`${c.name}：${e.text}`));
 return [table('看得多遠',['單位或建築','視野半徑'],sightRows()),list('增加視野的科技',techs),list('增加視野的文明加成',civs),
  facts('被看不到的敵人打到時',[['看見攻擊者',`${secs(revealTicks)}，攻擊者所在的那一格`]])];}
// ── The pages ────────────────────────────────────────────────────────────────────────────────────────────────────────
const builders:Record<string,()=>ElementBlock[]>={armor:armorPage,regeneration:regenPage,garrison:garrisonPage,'hit-points':hpPage,attack:attackPage,'rate-of-fire':firePage,
 'frame-delay':framePage,'area-of-effect':spreadPage,'team-bonus':teamPage,relic:relicPage,taunts:tauntPage,conversion:conversionPage,'line-of-sight':sightPage};
export const elementIds=()=>elementProse.map(p=>p.id);
export function elementPage(id:string):ElementPage|null{const p=elementProse.find(p=>p.id===id);if(!p)return null;
 return {...p,blocks:builders[p.id](),lacks:elementLacks[p.id]??[],source:`aoetw.com/${p.slug}`};}
export const elementPages=()=>elementProse.map(p=>elementPage(p.id)!);
// The list: the site's menu, then the element pages it leaves out.
export const elementGroups=()=>[{label:'網站選單',items:elementProse.filter(p=>p.menu)},{label:'其他條目',items:elementProse.filter(p=>!p.menu)}];
