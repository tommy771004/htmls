// Test fixture: a real match on the open map against an idle red, played only through logged commands (so saves
// and replays re-derive it): berries, gold, wood and farms, the second and third ages, a monastery and one monk.
// Shared by tests/religion.test.ts and tests/first-use-monastery.mjs.
import {createState,submit,tick,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {authoritativeProblem} from '../packages/sim/buildings.ts';
import type {BuildKind} from '../packages/sim/buildings.ts';
// explore: the scout also rides to the map centre and past every relic (so blue remembers them), and villager 2
// mines the central gold until 225 gold are in stock (enough for Sanctity).
// collect (with explore): the monk then fetches every relic into the monastery, one trip at a time.
export function castleAgeMatch(seed=260925,options:{explore?:boolean;collect?:boolean}={}):State{
 const s=createState(seed,'open','idle');
 const order=(t:string,p:unknown)=>submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:s.sequence[0]+1,targetTick:s.tick+1,commandType:t,payload:p} as never);
 const stock=s.accounts[0].stock,tcB=s.buildings.find(b=>b.player===0&&b.kind==='town-center')!,tc=s.map.obstacles.find(o=>o.id===tcB.id)!;
 const until=(done:()=>boolean,limit=30000)=>{const end=s.tick+limit;while(!done()){if(s.tick>=end)throw Error(`fixture stalled at tick ${s.tick}`);tick(s);}};
 const explored=()=>new Set(s.vision[0].explored);
 const nearest=(kind:string)=>{const seen=explored();return s.map.resources.filter(r=>r.kind===kind&&r.collectible&&seen.has(Math.floor(r.y/100)*s.map.size+Math.floor(r.x/100))).sort((a,b)=>Math.hypot(a.x-tc.x,a.y-tc.y)-Math.hypot(b.x-tc.x,b.y-tc.y))[0];};
 function site(kind:BuildKind){for(let r=300;r<=900;r+=50)for(let a=0;a<24;a++){const x=Math.round((tc.x+Math.cos(a*Math.PI/12)*r)/10)*10,y=Math.round((tc.y+Math.sin(a*Math.PI/12)*r)/10)*10;if(!authoritativeProblem(s,0,kind,x,y))return {x,y};}throw Error('no site for '+kind);}
 const idle=(id:number)=>!s.works[id]&&!s.units.find(u=>u.id===id)?.path.length;
 const build=(ids:number[],kind:BuildKind)=>{order('build',{unitIds:ids,kind,...site(kind)});until(()=>s.buildings.some(b=>b.player===0&&b.kind===kind&&b.complete));};
 // Villager 1 feeds: berries, then its own farms. 2 mines gold, 3 cuts wood.
 order('gather',{unitIds:[1],resourceId:nearest('berries').id});order('gather',{unitIds:[2],resourceId:nearest('gold').id});order('gather',{unitIds:[3],resourceId:nearest('tree').id});
 const feed=()=>{if(!idle(1))return;const farm=s.buildings.find(b=>b.player===0&&b.kind==='farm'&&b.complete&&s.map.resources.find(r=>r.id===`resource-${b.id}`)?.collectible);
  if(farm)order('gather',{unitIds:[1],resourceId:`resource-${farm.id}`});else if(stock.wood>=60&&!s.buildings.some(b=>b.kind==='farm'&&!b.complete))order('build',{unitIds:[1],kind:'farm',...site('farm')});};
 const keepWorking=()=>{for(let i=0;i<20;i++)tick(s);feed();if(idle(3))order('gather',{unitIds:[3],resourceId:nearest('tree').id});if(idle(2))order('gather',{unitIds:[2],resourceId:(nearest('gold')??nearest('tree')).id});};
 const reach=(done:()=>boolean,limit=60000)=>{const end=s.tick+limit;while(!done()){if(s.tick>=end)throw Error(`fixture stalled at tick ${s.tick}: age ${s.ages[0]}, stock ${JSON.stringify(stock)}, work ${JSON.stringify([1,2,3].map(id=>s.works[id]??null))}`);keepWorking();}};
 reach(()=>stock.food>=300);order('train',{buildingId:tcB.id,entryId:'age-2'});until(()=>s.ages[0]===2);
 reach(()=>stock.food>=500&&stock.gold>=200);order('train',{buildingId:tcB.id,entryId:'age-3'});until(()=>s.ages[0]===3);
 reach(()=>stock.wood>=175);build([3],'monastery');order('gather',{unitIds:[3],resourceId:nearest('tree').id});
 reach(()=>stock.gold>=100);const monastery=s.buildings.find(b=>b.player===0&&b.kind==='monastery')!;
 order('train',{buildingId:monastery.id,entryId:'monk'});until(()=>s.units.some(u=>u.player===0&&u.kind==='monk'));
 if(options.explore){const scout=s.units.find(u=>u.player===0&&u.kind==='scout')!,mid=s.map.size*50,rest=()=>['idle','unreachable','stuck'].includes(scout.navigation)&&scout.next===null&&!scout.path.length&&!s.pathJobs.some(j=>j.kind!=='group'&&j.unitId===scout.id);
  const ride=(x:number,y:number)=>{order('move',{unitIds:[scout.id],x,y});tick(s);tick(s);until(rest,6000);};
  ride(mid,mid);for(const r of s.relics)ride(r.x,r.y+100);
  order('gather',{unitIds:[2],resourceId:nearest('gold').id});reach(()=>stock.gold>=225,80000);
  ride(tc.x,tc.y+500);
  if(options.collect){const monk=s.units.find(u=>u.player===0&&u.kind==='monk')!;
   for(const r of s.relics){order('relic',{unitIds:[monk.id],relicId:r.id});until(()=>r.carrier===monk.id,8000);
    order('deposit',{unitIds:[monk.id],buildingId:monastery.id});until(()=>r.monastery===monastery.id,8000);}}}
 return s;
}
