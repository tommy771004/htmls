// Test fixture for the 戰術技巧 round's control flow (tests/first-use-micro.mjs): an open-map match against an idle red,
// played only through logged commands so the page's save/load re-derives it. Blue grows to seven villagers on food, wood
// and gold, reaches the second age, builds a barracks and an archery range, trains three militia and two archers, and
// gathers the five soldiers on open ground between the town centre and the nearest wild deer (the archers' target).
import {createState,submit,tick,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {authoritativeProblem} from '../packages/sim/buildings.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
export type MicroMatch={s:State;militia:number[];archers:number[];deer:number;open:{x:number;y:number}};
export function microMatch(seed=260925):MicroMatch{
 const s=createState(seed,'open','idle',['britons','franks']);
 const order=(t:string,p:unknown,player=0)=>submit(s,{protocolVersion:1,rulesetHash,playerId:player,sequence:s.sequence[player]+1,targetTick:s.tick+1,commandType:t,payload:p} as never);
 const stock=s.accounts[0].stock,tcB=s.buildings.find(b=>b.player===0&&b.kind==='town-center')!,tc=s.map.obstacles.find(o=>o.id===tcB.id)!;
 const [tx0,ty0,tx1,ty1]=obstacleBounds(tc),tcc={x:(tx0+tx1)/2,y:(ty0+ty1)/2};
 const explored=()=>new Set(s.vision[0].explored);
 const nearest=(kind:string)=>{const seen=explored();return s.map.resources.filter(r=>r.kind===kind&&r.collectible&&seen.has(Math.floor(r.y/100)*s.map.size+Math.floor(r.x/100))).sort((a,b)=>Math.hypot(a.x-tcc.x,a.y-tcc.y)-Math.hypot(b.x-tcc.x,b.y-tcc.y))[0];};
 const idle=(id:number)=>!s.works[id]&&!s.units.find(u=>u.id===id)?.path.length;
 const site=(kind:string,from=300,to=900)=>{for(let r=from;r<=to;r+=50)for(let i=0;i<24;i++){const x=Math.round((tcc.x+Math.cos(i*Math.PI/12)*r)/10)*10,y=Math.round((tcc.y+Math.sin(i*Math.PI/12)*r)/10)*10;if(!authoritativeProblem(s,0,kind as never,x,y))return {x,y};}throw Error(`no ${kind} site`);};
 const villagers=()=>s.units.filter(u=>u.player===0&&u.kind==='villager').map(u=>u.id).sort((a,b)=>a-b);
 // Villager 1 on food (berries, then a farm), the next two on wood, the rest on gold; a builder is borrowed per job.
 const job=(id:number)=>id===villagers()[0]?'food':villagers().indexOf(id)<3?'wood':'gold';
 const work=()=>{for(const id of villagers()){if(!idle(id))continue;const want=job(id);
   if(want==='food'){const r=nearest('berries');if(r){order('gather',{unitIds:[id],resourceId:r.id});continue;}
    const farm=s.buildings.find(b=>b.player===0&&b.kind==='farm'&&b.complete&&s.map.resources.find(v=>v.id===`resource-${b.id}`)?.collectible);
    if(farm)order('gather',{unitIds:[id],resourceId:`resource-${farm.id}`});else if(stock.wood>=60&&!s.buildings.some(b=>b.kind==='farm'&&!b.complete))order('build',{unitIds:[id],kind:'farm',...site('farm')});continue;}
   const r=nearest(want==='wood'?'tree':'gold')??nearest('tree');if(r)order('gather',{unitIds:[id],resourceId:r.id});}};
 const reach=(done:()=>boolean,limit=80000)=>{const end=s.tick+limit;while(!done()){if(s.tick>=end)throw Error(`fixture stalled at tick ${s.tick}: stock ${JSON.stringify(stock)}`);work();for(let i=0;i<20;i++)tick(s);}};
 const raise=(kind:string)=>{reach(()=>!!villagers().length);const before=s.nextBuildingId,id=villagers()[villagers().length-1];order('build',{unitIds:[id],kind,...site(kind)});
  for(let i=0;i<2;i++)tick(s);const b=s.buildings.find(b=>b.id===`building-${before}`);if(!b)throw Error(`${kind} not placed: ${JSON.stringify(s.transactions.at(-1))}`);reach(()=>b.complete);return b;};
 const train=(at:string,entryId:string)=>{const n=s.units.filter(u=>u.player===0&&u.kind===entryId).length;order('train',{buildingId:at,entryId});reach(()=>s.units.filter(u=>u.player===0&&u.kind===entryId).length>n);};
 for(let h=0;h<2;h++){reach(()=>stock.wood>=30);raise('house');}
 for(let v=0;v<4;v++){reach(()=>stock.food>=50);train(tcB.id,'villager');}
 reach(()=>stock.food>=300);order('train',{buildingId:tcB.id,entryId:'age-2'});reach(()=>s.ages[0]===2);
 reach(()=>stock.wood>=150);const barracks=raise('barracks');reach(()=>stock.wood>=175);const range=raise('archery-range');
 for(let m=0;m<3;m++){reach(()=>stock.food>=60&&stock.gold>=20);train(barracks.id,'militia');}
 for(let a=0;a<2;a++){reach(()=>stock.wood>=40&&stock.gold>=30);train(range.id,'archer');}
 // The nearest wild deer, and an open spot two-thirds of the way out to it: the soldiers wait there.
 const deer=s.units.filter(u=>u.kind==='deer').sort((a,b)=>Math.hypot(a.x-tcc.x,a.y-tcc.y)-Math.hypot(b.x-tcc.x,b.y-tcc.y))[0];
 const soldiers=s.units.filter(u=>u.player===0&&(u.kind==='militia'||u.kind==='archer')).map(u=>u.id).sort((a,b)=>a-b);
 const open={x:Math.round((tcc.x+(deer.x-tcc.x)*.6)/50)*50,y:Math.round((tcc.y+(deer.y-tcc.y)*.6)/50)*50};
 order('move',{unitIds:soldiers,x:open.x,y:open.y});
 // Blue's villagers stop, so nothing else moves while the page gives its orders.
 order('stop',{unitIds:villagers()});{const end=s.tick+3000;while(s.units.some(u=>soldiers.includes(u.id)&&(u.path.length||u.next!==null))){if(s.tick>=end)throw Error('soldiers never arrived');tick(s);}}
 for(let i=0;i<20;i++)tick(s);
 return {s,militia:s.units.filter(u=>u.player===0&&u.kind==='militia').map(u=>u.id).sort((a,b)=>a-b),archers:s.units.filter(u=>u.player===0&&u.kind==='archer').map(u=>u.id).sort((a,b)=>a-b),deer:deer.id,open};
}
