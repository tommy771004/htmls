import {routeTo,cancelMovement} from './movement.ts';
import type {Unit} from './movement.ts';
import {approach,reach} from './combat.ts';
import type {CombatState} from './combat.ts';
import {combatRules} from './stats.ts';
import {tileAt} from './terrain.ts';
// Monks (reference: aoe2-rules-research.md). Conversion takes a random 5-15 s (100-300 ticks, drawn from the
// match's seeded generator when the monk starts) and then faith recharges for 62 s (1240 ticks) before the next one.
// Buildings need the Redemption technology in the reference, which does not exist here, so none convert. Monks do
// not convert monks: a design choice here (the reference rule, said to need Atonement, is unverified).
// Ranges and the heal rate are design_default: no source gave them in this scale.
export const religionRules={provenance:'design_default; conversion time and recharge from the reference research',
 convertRange:350,healRange:150,healTicks:20,healSight:400,conversionTicks:{min:100,max:300},rechargeTicks:1240,unconvertible:['monk']} as const;
export type Rite={kind:'convert'|'heal';target:number;progress:number;needed:number;repath:number};
export type ReligionState=CombatState&{rites:Record<number,Rite>;faith:Record<number,number>;rng:number};
const random=(s:ReligionState)=>{let n=s.rng;n^=n<<13;n^=n>>>17;n^=n<<5;s.rng=n>>>0;return s.rng;};
// Faith is full once rechargeTicks have passed since the monk's last conversion (a new monk starts full).
export function faithOf(s:ReligionState,monkId:number){const last=s.faith[monkId];return last===undefined?1:Math.min(1,(s.tick-last)/religionRules.rechargeTicks);}
const rangeOf=(kind:Rite['kind'])=>kind==='convert'?religionRules.convertRange:religionRules.healRange;
// Why the rite cannot be ordered or continued (null when it can).
export function riteProblem(s:ReligionState,player:number,kind:Rite['kind'],targetId:number):string|null{
 const t=s.units.find(u=>u.id===targetId);if(!t)return '找不到目標';
 if(kind==='heal'){if(t.player!==player)return '只能治療己方單位';if(t.kind==='monk')return '僧侶不能被治療';return null;}
 if(t.player===player)return '不能轉化己方單位';
 if(!new Set(s.vision[player].visible).has(tileAt(t.x,t.y,s.map.size)))return '找不到目標';
 if((religionRules.unconvertible as readonly string[]).includes(t.kind))return '僧侶不能轉化僧侶';
 return null;
}
export function commandRite(s:ReligionState,monkIds:number[],kind:Rite['kind'],target:number){
 for(const id of monkIds){cancelMovement(s,id);delete s.works[id];delete s.attacks[id];s.rites[id]={kind,target,progress:0,needed:0,repath:0};}
}
export function clearRites(s:ReligionState,unitIds:number[]){for(const id of unitIds)delete s.rites[id];}
function convert(s:ReligionState,monk:Unit,t:Unit){
 const from=s.accounts[t.player],to=s.accounts[monk.player],c=s.cargo[t.id];
 if(c){from.ledger.lost[c.resource]+=c.amount;delete s.cargo[t.id];}
 delete s.works[t.id];delete s.attacks[t.id];delete s.rites[t.id];cancelMovement(s,t.id);
 Object.assign(t,{path:[],goal:null,target:null,navigation:t.next===null?'idle':'moving'});
 // The unit changes sides with its hit points; population moves with it and may exceed the cap (a design choice).
 from.populationUsed--;to.populationUsed++;t.player=monk.player;
 s.faith[monk.id]=s.tick;
}
export function stepReligion(s:ReligionState){
 const monks=s.units.filter(u=>u.kind==='monk').sort((a,b)=>a.id-b.id),busy=new Set(s.pathJobs.flatMap(j=>j.kind==='group'?j.unitIds:[j.unitId]));
 for(const id of Object.keys(s.rites).map(Number))if(!monks.some(m=>m.id===id))delete s.rites[id];
 for(const id of Object.keys(s.faith).map(Number))if(!monks.some(m=>m.id===id))delete s.faith[id];
 // An idle monk heals the nearest wounded own unit it can see (lowest id on ties); conversion is by order only.
 for(const m of monks){if(s.rites[m.id]||s.attacks[m.id]||m.next!==null||m.path.length||busy.has(m.id))continue;
  let best:Unit|null=null,dist=Infinity;
  for(const u of s.units)if(u!==m&&u.player===m.player&&u.kind!=='monk'&&u.hp<combatRules.units[u.kind].hp){const d=reach(m,u);if(d<=religionRules.healSight&&(d<dist||d===dist&&best&&u.id<best.id)){best=u;dist=d;}}
  if(best)s.rites[m.id]={kind:'heal',target:best.id,progress:0,needed:0,repath:0};}
 for(const m of monks){const r=s.rites[m.id];if(!r)continue;const t=s.units.find(u=>u.id===r.target);
  const done=()=>{delete s.rites[m.id];cancelMovement(s,m.id);Object.assign(m,{path:[],goal:null,target:null,navigation:m.next===null?'idle':'moving'});};
  if(!t||riteProblem(s,m.player,r.kind,r.target)||r.kind==='heal'&&t.hp>=combatRules.units[t.kind].hp||r.kind==='convert'&&r.needed===0&&faithOf(s,m.id)<1){done();continue;}
  if(reach(m,t)<=rangeOf(r.kind)){
   if(m.next!==null)continue;
   if(m.path.length||busy.has(m.id)){cancelMovement(s,m.id);m.path=[];m.goal=null;m.target=null;}
   m.navigation='idle';
   if(r.kind==='heal'){if(++r.progress%religionRules.healTicks===0)t.hp=Math.min(combatRules.units[t.kind].hp,t.hp+1);continue;}
   if(r.needed===0){const {min,max}=religionRules.conversionTicks;r.needed=min+random(s)%(max-min+1);}
   if(++r.progress>=r.needed){convert(s,m,t);delete s.rites[m.id];}
   continue;
  }
  if(m.next!==null)continue;
  if(r.repath>0&&(m.path.length||busy.has(m.id))){r.repath--;continue;}
  const nodes=approach(s,m,{x:t.x,y:t.y},rangeOf(r.kind));if(!nodes.length){done();continue;}
  routeTo(s,m,nodes);r.repath=20;
 }
}
