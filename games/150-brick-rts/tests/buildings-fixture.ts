// Test fixture for the 建築 round's browser flows: a match against an idle red played only through logged commands (so
// the page's save/load re-derives it). Villager 1 picks berries, 2 and 3 cut wood until the stock asked for is there;
// age: research the second age on the way; houses: build that many houses (room for ships) first. scoutTo: the scout rides there first (to explore a dock site or the lake).
import {createState,submit,tick,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import type {MapLayout} from '../packages/sim/terrain.ts';
import {authoritativeProblem} from '../packages/sim/buildings.ts';
export function economyMatch(seed:number,layout:MapLayout,goal:{food?:number;wood?:number;age?:2;houses?:number;scoutTo?:{x:number;y:number};civs?:readonly string[]}):State{
 const s=createState(seed,layout,'idle',goal.civs);
 const order=(t:string,p:unknown)=>submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:s.sequence[0]+1,targetTick:s.tick+1,commandType:t,payload:p} as never);
 const stock=s.accounts[0].stock,tcB=s.buildings.find(b=>b.player===0&&b.kind==='town-center')!,tc=s.map.obstacles.find(o=>o.id===tcB.id)!;
 const until=(done:()=>boolean,limit=30000)=>{const end=s.tick+limit;while(!done()){if(s.tick>=end)throw Error(`fixture stalled at tick ${s.tick}: stock ${JSON.stringify(stock)}`);tick(s);}};
 const explored=()=>new Set(s.vision[0].explored);
 const nearest=(kind:string)=>{const seen=explored();return s.map.resources.filter(r=>r.kind===kind&&r.collectible&&seen.has(Math.floor(r.y/100)*s.map.size+Math.floor(r.x/100))).sort((a,b)=>Math.hypot(a.x-tc.x,a.y-tc.y)-Math.hypot(b.x-tc.x,b.y-tc.y))[0];};
 const idle=(id:number)=>!s.works[id]&&!s.units.find(u=>u.id===id)?.path.length;
 const site=(kind:'house'|'farm')=>{for(let r=300;r<=900;r+=50)for(let i=0;i<24;i++){const x=Math.round((tc.x+Math.cos(i*Math.PI/12)*r)/10)*10,y=Math.round((tc.y+Math.sin(i*Math.PI/12)*r)/10)*10;if(!authoritativeProblem(s,0,kind,x,y))return {x,y};}throw Error(`no ${kind} site`);};
 // Villager 1 feeds: berries while there are any, then a farm of its own.
 const feed=()=>{if(!idle(1))return;const r=nearest('berries');if(r){order('gather',{unitIds:[1],resourceId:r.id});return;}
  const farm=s.buildings.find(b=>b.player===0&&b.kind==='farm'&&b.complete&&s.map.resources.find(v=>v.id===`resource-${b.id}`)?.collectible);
  if(farm)order('gather',{unitIds:[1],resourceId:`resource-${farm.id}`});else if(stock.wood>=60&&!s.buildings.some(b=>b.kind==='farm'&&!b.complete))order('build',{unitIds:[1],kind:'farm',...site('farm')});};
 const work=()=>{feed();for(const id of [2,3])if(idle(id)){const r=nearest('tree');if(r)order('gather',{unitIds:[id],resourceId:r.id});}};
 const reach=(done:()=>boolean,limit=60000)=>{const end=s.tick+limit;while(!done()){if(s.tick>=end)throw Error(`fixture stalled at tick ${s.tick}: stock ${JSON.stringify(stock)}`);work();for(let i=0;i<20;i++)tick(s);}};
 if(goal.scoutTo){const scout=s.units.find(u=>u.player===0&&u.kind==='scout')!;order('move',{unitIds:[scout.id],...goal.scoutTo});tick(s);tick(s);
  until(()=>['idle','unreachable','stuck'].includes(scout.navigation)&&scout.next===null&&!scout.path.length,6000);}
 for(let h=0;h<(goal.houses??0);h++){reach(()=>stock.wood>=30);const n=s.buildings.filter(b=>b.kind==='house').length;order('build',{unitIds:[3],kind:'house',...site('house')});until(()=>s.buildings.filter(b=>b.kind==='house'&&b.complete).length>n);}
 if(goal.age===2){reach(()=>stock.food>=300);order('train',{buildingId:tcB.id,entryId:'age-2'});until(()=>s.ages[0]===2);}
 reach(()=>stock.food>=(goal.food??0)&&stock.wood>=(goal.wood??0));
 return s;
}
