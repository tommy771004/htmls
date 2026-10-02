// The encyclopedia's 戰術技巧 category (the 戰術技巧 round): aoetw.com/ar's openings and micro techniques. Prose from
// packages/content/codex.ts; each opening's steps, allocation, counters and the computer's plan from
// packages/content/openings.ts; accuracy, projectile speeds, Ballistics, stances and spacing read live from the
// simulation (stats.ts, combat.ts, navigation.ts). Pure (no DOM), so node tests import it; codex.ts renders it.
import {rules} from '../../packages/content/rules.ts';
import {civDefs,neutralCiv} from '../../packages/content/civs.ts';
import {tacticProse,tacticLacks,tacticsIntro,tacticsNote,basicUpgradesText,basicUpgradeItems,eagleOpeningInfobox} from '../../packages/content/codex.ts';
import type {TacticProse} from '../../packages/content/codex.ts';
import {openings,unavailableOpenings,gatherNames} from '../../packages/content/openings.ts';
import type {Opening,OpeningStep,Gather} from '../../packages/content/openings.ts';
import {shotOf,buildingShotOf,projectileRules,statsOf} from '../../packages/sim/stats.ts';
import {stances,tacticsRules} from '../../packages/sim/combat.ts';
import type {Stance} from '../../packages/sim/combat.ts';
import {navigationRules} from '../../packages/sim/navigation.ts';
import {costOf,timeTicks} from '../../packages/sim/civ.ts';
import {unitSteps,frameRows,spreadRows} from './codex-elements.ts';
import type {ElementBlock} from './codex-elements.ts';
import {numberText,ageName,stepOwner,lineStepIds} from './codex-model.ts';
export {tacticsIntro,tacticsNote,basicUpgradesText,basicUpgradeItems};
const tick=rules.settings.tickHz;
const nameOf=(id:string)=>rules.entries.find(e=>e.id===id)?.name??id;
const civName=(id:string)=>civDefs.find(c=>c.id===id)?.name??id;
const playable=civDefs.filter(c=>c.id!==neutralCiv).map(c=>c.id);
const tiles=(units:number)=>`${numberText(units/100)} 格`;
const secs=(ticks:number)=>`${numberText(ticks/tick)} 秒`;
const clock=(ticks:number)=>{const s=Math.round(ticks/tick);return `${Math.floor(s/60)} 分${s%60?` ${s%60} 秒`:''}`;};
const resourceNames:Record<string,string>={food:'食物',wood:'木材',gold:'黃金',stone:'石頭'};
const costText=(c:Record<string,number>)=>Object.entries(c).filter(([,v])=>v>0).map(([r,v])=>`${resourceNames[r]} ${v}`).join('、');
// ── Page shape ───────────────────────────────────────────────────────────────────────────────────────────────────────
// The codex's element blocks, plus an opening's build order grouped by phase (check: the coach ticks it off).
export type TacticSteps={kind:'steps';title:string;note:string|null;phases:{label:string;steps:{label:string;check:boolean}[]}[]};
export type TacticBlock=ElementBlock|TacticSteps;
export type TacticPage=TacticProse&{available:boolean;reason:string|null;blocks:TacticBlock[];lacks:readonly {name:string;reason:string}[];source:string};
const facts=(title:string,items:[string,string][],note:string|null=null):ElementBlock=>({kind:'facts',title,note,items:items.map(([label,value])=>({label,value}))});
const table=(title:string,head:string[],rows:string[][],note:string|null=null):ElementBlock=>({kind:'table',title,note,head,rows});
const list=(title:string,items:string[],note:string|null=null):ElementBlock=>({kind:'list',title,note,items});
// ── The list ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// The site's index order: 主流打法 (its own list order), then 控兵技巧.
export const tacticIds=()=>tacticProse.map(p=>p.id);
export function tacticGroups(){
 const item=(p:TacticProse)=>({id:p.id,name:p.name,nameEn:p.nameEn,summary:p.summary,available:p.group==='micro'||!!openings.find(o=>o.id===p.id)});
 return [{id:'opening',label:'主流打法（阿拉伯）',items:tacticProse.filter(p=>p.group==='opening').map(item)},{id:'micro',label:'控兵技巧',items:tacticProse.filter(p=>p.group==='micro').map(item)}];}
// ── Openings ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export const phaseNames:Readonly<Record<OpeningStep['phase'],string>>={dark:'黑暗時代',up:'升第二時代中',feudal:'第二時代',castle:'第三時代'};
export function stepPhases(o:Opening){
 const out:{label:string;steps:{label:string;check:boolean}[]}[]=[];
 for(const s of o.steps){const label=phaseNames[s.phase];let g=out.at(-1);if(!g||g.label!==label){g={label,steps:[]};out.push(g);}g.steps.push({label:s.label,check:!!s.done});}
 return out;}
export const civsText=(ids:readonly string[])=>playable.every(c=>ids.includes(c))?`本作 ${playable.length} 個文明都可以`:ids.map(civName).join('、');
export function infobox(o:Opening):[string,string][]{
 return [['時代',ageName(o.age)],['威力',o.power],['操控難易度',o.difficulty],['優點',o.pros],['缺點',o.cons],['適合文明',civsText(o.civs)],
  ['特別適合',o.best.length?o.best.map(civName).join('、'):'網站沒有點名本作的文明'],['網站頁面',o.page]];}
const trainText=(t:Readonly<Record<string,number>>|undefined)=>t&&Object.keys(t).length?Object.entries(t).map(([k,n])=>`${nameOf(k)} ${n}`).join('、'):null;
const preferText=(p:readonly string[])=>p.map(r=>gatherNames[r as Gather]??nameOf(r)).join('、');
// How the computer plays it here (packages/sim/ai.ts reads the same plan).
export function planFacts(o:Opening):[string,string][]{
 const p=o.plan,out:[string,string][]=[['村民目標',`${p.villagers} 名`],['升第二時代',p.clickOnFood?`村民 ${p.clickAt} 名起，食物一夠就點`:`村民 ${p.clickAt} 名時點`],['織布機',p.loom?'升級前先研究':'不研究']];
 out.push(['兵營',p.forwardBarracks?`點封後派 ${p.forwardBarracks} 名村民到對方附近蓋`:p.barracks==='dark'?`黑暗時代，村民 ${p.barracksAt} 名時蓋`:p.barracks==='up'?'升級中蓋':'開局期間不蓋']);
 for(const [phase,label] of [['dark','黑暗時代的部隊'],['up','升級中的部隊'],['feudal','第二時代的部隊']] as const){const t=trainText(p.train[phase]);if(t)out.push([label,t]);}
 if(p.build.length)out.push(['第二時代加蓋',p.build.map(b=>`${nameOf(b.kind)} ${b.count} 座`).join('、')]);
 if(p.research.length)out.push(['優先研究',p.research.map(nameOf).join('、')]);
 out.push(['騷擾',p.raid?`${p.raid.kinds.map(nameOf).join('與')}湊到 ${p.raid.sendAt} 隻就出發${p.raid.reinforce?'，後續的陸續跟上':''}`:'不派兵騷擾']);
 if(p.towers)out.push(['前置箭塔',`${p.towers.builders} 名村民${p.towers.leave==='click'?'點封後':'開局就'}出發，蓋 ${p.towers.count} 座，依序找對方的${preferText(p.towers.prefer)}`]);
 if(p.castle)out.push(['城堡時代','上第二時代後立刻升第三時代']);
 out.push(['交給一般打法',`${clock(p.until.tick)}${p.until.age?`或到${ageName(p.until.age)}`:''}之後`]);
 return out;}
export const coachText='在選單的「練習開局」選這個打法，畫面會照上面的流程逐步打勾；有打勾記號的步驟會自動檢查，沒有的是提醒。';
function openingPage(p:TacticProse,o:Opening):TacticPage{
 const blocks:TacticBlock[]=[facts('資訊框',infobox(o),'取自網站的資訊框；文明換成本作有的'),
  {kind:'steps',title:'流程',note:'依本作比例換算（村民數約為網站的一半）',phases:stepPhases(o)},
  facts('升級前配置',[['本作',o.allocation],['網站',o.siteAllocation]]),list('反制',[...o.counters]),
  facts('電腦怎麼打',planFacts(o),'選單可以指定電腦用這個開局'),list('練習',[coachText])];
 if(o.notes.length)blocks.push(list('補註',[...o.notes]));
 return {...p,available:true,reason:null,blocks,lacks:tacticLacks[p.id]??[],source:`aoetw.com/${p.slug}`};}
function unavailablePage(p:TacticProse):TacticPage{
 const u=unavailableOpenings.find(u=>u.id===p.id)!,e=eagleOpeningInfobox;
 return {...p,available:false,reason:u.reason,blocks:[facts('資訊框',[['時代',ageName(e.age)],['威力',e.power],['操控難易度',e.difficulty],['優點',e.pros],['缺點',e.cons],['網站的適合文明',e.civs],['網站頁面',u.page]],'網站的資訊框；本作不能玩')],
  lacks:tacticLacks[p.id]??[],source:`aoetw.com/${p.slug}`};}
// ── Micro techniques: the live numbers each one relies on ────────────────────────────────────────────────────────────
export const stanceNames:Readonly<Record<Stance,string>>={aggressive:'攻擊',defensive:'防禦',stand:'堅守',passive:'不還擊'};
export function stanceRows(){
 const what:Record<Stance,[string,string]>={aggressive:['看到就打','一路追下去'],defensive:['看到就打',`離原地 ${tiles(tacticsRules.defensiveLeash)}就放棄、走回原地`],
  stand:['只打射程內的','不移動'],passive:['不主動、不還擊','不移動（下攻擊命令仍會打）']};
 return stances.map(s=>({stance:s,name:stanceNames[s],engage:what[s][0],chase:what[s][1]}));}
const ballistics=()=>({cost:costOf('ballistics',{civ:neutralCiv,age:3,techs:[]}),seconds:timeTicks('ballistics',{civ:neutralCiv,age:3,techs:[]},'university')/tick});
export const ballisticsFacts=():[string,string][]=>{const b=ballistics(),e=rules.entries.find(e=>e.id==='ballistics')!;
 return [['研究',`${nameOf(rules.production.ballistics!)}・${ageName(Number(e.requires.find(r=>r.startsWith('age-'))!.slice(4)))}`],['費用',costText(b.cost)],['時間',`${numberText(b.seconds)} 秒`]];};
// Every ranged step: accuracy, accuracy against a standing target with Thumb Ring or Warwolf, speed, Ballistics.
export type ShotRow={name:string;kind:string;accuracy:number;steady:number|null;speed:number;lead:boolean};
export function shotRows():ShotRow[]{
 const out:ShotRow[]=[];
 for(const s of unitSteps()){const i=lineStepIds(s.kind).indexOf(s.tech),o=stepOwner(s.kind,i),base=shotOf(s.kind,o);if(!base)continue;
  // Against a standing target: Thumb Ring for every civilization that has it, a unique technology for its own (Warwolf).
  const steady=Math.max(...civDefs.map(c=>shotOf(s.kind,{...o,civ:c.id,techs:[...o.techs,'thumb-ring',...c.uniqueTechs.map(t=>t.id)]})!.steady)),led=shotOf(s.kind,{...o,techs:[...o.techs,'ballistics']})!;
  out.push({name:s.name,kind:s.kind,accuracy:base.accuracy,steady:steady>base.accuracy?steady:null,speed:base.speed,lead:led.lead});}
 return out;}
export function buildingShotRows(){
 return Object.keys(projectileRules.buildings).map(k=>{const b=buildingShotOf(k,[]),led=buildingShotOf(k,['ballistics']);return {name:nameOf(k),kind:k,accuracy:b.accuracy,speed:b.speed,lead:led.lead};});}
const perSecond=(speed:number)=>`${numberText(Math.round(speed*tick/100*100)/100)} 格/秒`;
function shotTable(rows:ShotRow[],title:string,note:string|null){
 return table(title,['單位','命中率','靜止目標','彈道速度','彈道學'],rows.map(r=>[r.name,`${r.accuracy}%`,r.steady?`${r.steady}%`:'—',perSecond(r.speed),r.lead?'會預判':'無效']),note);}
const spacingFacts=():[string,string][]=>[['單位的身體',`半徑 ${tiles(navigationRules.radius)}`],['站位間距',`${tiles(navigationRules.spacing)}，一個位置只站一個單位`],['分散移動',`每隔一個位置站一個（間距 ${tiles(navigationRules.spacing*2)}）`]];
const missFacts=():[string,string][]=>[['命中判定',`箭落地時，目標中心在 ${tiles(projectileRules.hitRadius)} 以內才算打中`],
 ['偏掉的箭',`落在瞄準點外 ${tiles(projectileRules.missSpread[0])}～${tiles(projectileRules.missSpread[1])}，打中落點上的敵人`],['近戰',`射程 ${tiles(projectileRules.meleeReach)} 以內的攻擊立刻命中，不會飛`]];
function microBlocks(id:string):TacticBlock[]{
 const blasts=spreadRows().filter(r=>r.effect==='範圍傷害');
 if(id==='pull')return [facts('本作的數字',missFacts()),facts('彈道學',ballisticsFacts(),'研究後弓兵、戰船與防禦建築會預判移動的目標')];
 if(id==='surround')return [table('姿態',['姿態','自動接戰','追擊'],stanceRows().map(r=>[r.name,r.engage,r.chase])),
  facts('巡邏與分散',[['巡邏',`在出發點與目標點之間來回，離端點 ${tiles(tacticsRules.patrolTurn)}就折返，路上照姿態接戰`],spacingFacts()[2]])];
 if(id==='focus')return [table('換目標要重新瞄準的單位',['單位','第一發前的瞄準'],frameRows().map(r=>[r.name,secs(r.ticks)]),'同一個目標連續射擊不必再瞄準'),
  table('命中率不到百分之百的單位',['單位','命中率'],shotRows().filter(r=>r.accuracy<100).map(r=>[r.name,`${r.accuracy}%`]))];
 if(id==='clump')return [facts('站位',spacingFacts().slice(0,2)),table('會一次打中很多隻的攻擊',['單位','範圍','對象'],blasts.map(r=>[r.name,r.radius,r.who]))];
 if(id==='spread'){const slow=shotRows().filter(r=>statsOf(r.kind as Parameters<typeof statsOf>[0]).blast);
  return [facts('分散移動',[spacingFacts()[2]]),table('會爆炸的砲彈要飛多久',['單位','彈道速度','爆炸範圍'],slow.map(r=>[r.name,perSecond(r.speed),blasts.find(b=>b.name===r.name)?.radius??'—']))];}
 if(id==='dodge')return [shotTable(shotRows(),'遠程單位','靜止目標：研究拇指環（巨型投石機是戰狼號）後，打靜止目標的命中率'),
  table('防禦建築',['建築','命中率','彈道速度','彈道學'],buildingShotRows().map(r=>[r.name,`${r.accuracy}%`,perSecond(r.speed),r.lead?'會預判':'無效'])),
  facts('命中與落空',missFacts()),facts('彈道學',ballisticsFacts())];
 if(id==='split')return [table('姿態',['姿態','自動接戰','追擊'],stanceRows().map(r=>[r.name,r.engage,r.chase]),'對方的單位用哪種姿態，決定它會追多遠')];
 return [facts('卡位',[...spacingFacts().slice(0,2),['穿越','單位彼此不能穿過，只能繞路或等待']])];}
function microPage(p:TacticProse):TacticPage{return {...p,available:true,reason:null,blocks:microBlocks(p.id),lacks:tacticLacks[p.id]??[],source:'aoetw.com/ar（控兵技巧）'};}
// ── Pages ────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function tacticPage(id:string):TacticPage|null{
 const p=tacticProse.find(p=>p.id===id);if(!p)return null;
 if(p.group==='micro')return microPage(p);
 const o=openings.find(o=>o.id===id);return o?openingPage(p,o):unavailablePage(p);}
export const tacticPages=()=>tacticIds().map(id=>tacticPage(id)!);
