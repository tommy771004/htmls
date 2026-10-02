import {approach,reach,strike,damageOn} from './combat.ts';
import type {CombatState} from './combat.ts';
import {cancelMovement,commandMove,routeTo} from './movement.ts';
import type {Unit} from './movement.ts';
import {harvestMapResource} from './navigation.ts';
import {statsOf,combatRules} from './stats.ts';
import {obstacleBounds} from '../content/footprints.ts';
import {animalRules,isAnimal,isHostile,GAIA} from './fauna.ts';
import {layerOf} from './movement.ts';
import {settingsOf} from './settings.ts';
// Animal behaviour, once per tick after combat (values in fauna.ts, design_default):
// - a sheep belongs to the only player with a unit within captureRange (found, or taken from the other side), except
//   that one within holdRange of its owner's buildings stays its owner's;
// - a struck deer runs fleeDistance away from whoever struck it;
// - a struck boar charges the first unit that struck it, then whoever else is hunting it, up to boarLeash away;
// - a wolf or jaguar (the 地圖 round) hunts by itself: the nearest unit it can see (sight by the match difficulty), except
//   monks, the scout line, siege and ships, and it chases like a struck boar, never past hostileLeash;
// - a carcass slowly spoils, worked or not (one food per decayTicks).
const halt=(s:CombatState,a:Unit)=>{cancelMovement(s,a.id);Object.assign(a,{path:[],goal:null,target:null,navigation:a.next===null?'idle':'moving'});};
// Sheep ownership (also run when a match is created, so the starting flock is already the player's at tick 0).
export function claimSheep(s:CombatState){
 for(const sheep of s.units){if(sheep.kind!=='sheep')continue;
  const near=new Set<number>();for(const u of s.units)if(!isAnimal(u.kind)&&u.player!==GAIA&&reach(u,sheep)<=animalRules.captureRange)near.add(u.player);
  if(near.size!==1||near.has(sheep.player))continue;
  // A sheep by its owner's buildings stays (the starting flock is not lost to the first scout riding past).
  if(sheep.player!==GAIA&&s.buildings.some(b=>{if(b.player!==sheep.player)return false;const o=s.map.obstacles.find(o=>o.id===b.id);return !!o&&reach(sheep,obstacleBounds(o))<=animalRules.holdRange;}))continue;
  // Changing hands stops the sheep where it is (the old owner's order no longer applies).
  sheep.player=[...near][0];halt(s,sheep);}
}
// What a hostile animal goes for: units on land that are not monks, the scout line or siege (aoetw.com units/Wolf).
const prey_ok=(u:Unit)=>layerOf(u.kind)==='land'&&!(animalRules.hostileIgnore as readonly string[]).includes(u.kind)&&!(u.kind in combatRules.units&&combatRules.units[u.kind as keyof typeof combatRules.units].classes.includes('siege'));
export function stepAnimals(s:CombatState){
 const animals=s.units.filter(u=>isAnimal(u.kind)).sort((a,b)=>a.id-b.id),busy=new Set(s.pathJobs.flatMap(j=>j.kind==='group'?j.unitIds:[j.unitId]));
 for(const id of Object.keys(s.beasts).map(Number))if(!animals.some(a=>a.id===id))delete s.beasts[id];
 claimSheep(s);
 // Hostile animals pick their prey (lowest id on ties); a calm one keeps no state, so nothing is stored until it hunts.
 const sight=animalRules.hostileSight[settingsOf(s as {settings?:never}).difficulty];
 for(const a of animals){if(!isHostile(a.kind)||s.beasts[a.id])continue;
  const prey=s.units.filter(u=>(u.player===0||u.player===1)&&!isAnimal(u.kind)&&prey_ok(u)&&Math.hypot(u.x-a.x,u.y-a.y)<=sight).sort((p,q)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(q.x-a.x,q.y-a.y)||p.id-q.id)[0];
  if(prey)s.beasts[a.id]={foe:prey.id,cooldown:0,repath:0};}
 for(const a of animals){const b=s.beasts[a.id];if(!b)continue;
  const foe=s.units.find(u=>u.id===b.foe&&!isAnimal(u.kind));
  if(a.kind==='sheep'){delete s.beasts[a.id];continue;}
  if(a.kind==='deer'){delete s.beasts[a.id];if(!foe)continue;
   const dx=a.x-foe.x,dy=a.y-foe.y,len=Math.hypot(dx,dy)||1,edge=s.map.size*100-50,clamp=(v:number)=>Math.min(edge,Math.max(50,Math.round(v)));
   try{commandMove(s,[a.id],{x:clamp(a.x+dx/len*animalRules.fleeDistance),y:clamp(a.y+dy/len*animalRules.fleeDistance)});}catch{}
   continue;}
  // Boar: the first attacker, else the nearest unit still hunting or attacking it; none left means it calms down.
  // Wolves and jaguars give up a chase past hostileLeash (and pick again next tick).
  let target=foe&&reach(a,foe)<=(isHostile(a.kind)?animalRules.hostileLeash:animalRules.boarLeash)?foe:undefined;
  if(!target){target=s.units.filter(u=>!isAnimal(u.kind)&&reach(a,u)<=animalRules.boarLeash&&((s.works[u.id] as {prey?:number}|undefined)?.prey===a.id||s.attacks[u.id]?.target.kind==='unit'&&s.attacks[u.id].target.id===a.id)).sort((p,q)=>reach(a,p)-reach(a,q)||p.id-q.id)[0];
   if(!target){delete s.beasts[a.id];halt(s,a);continue;}b.foe=target.id;}
  const stats=statsOf(isHostile(a.kind)?a.kind as 'wolf':'boar');if(b.cooldown>0)b.cooldown--;
  if(reach(a,target)<=stats.range){if(a.next!==null)continue;if(a.path.length||busy.has(a.id))halt(s,a);a.navigation='idle';
   if(b.cooldown===0){b.cooldown=stats.cooldown;strike(s,{kind:'unit',id:target.id},damageOn(s,stats,{kind:'unit',id:target.id}),a.id);}continue;}
  if(a.next!==null)continue;if(b.repath>0&&(a.path.length||busy.has(a.id))){b.repath--;continue;}
  const nodes=approach(s,a,{x:target.x,y:target.y});if(!nodes.length){delete s.beasts[a.id];continue;}routeTo(s,a,nodes);b.repath=20;
 }
 if(s.tick%animalRules.decayTicks===0)for(const r of s.map.resources)if(r.collectible&&r.id.startsWith('resource-carcass-'))harvestMapResource(s.map,r.id,1,s.tick);
}
