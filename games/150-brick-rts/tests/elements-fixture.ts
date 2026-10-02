// Test fixture for the 遊戲元素 round's browser flow (tests/first-use-elements.mjs): an open-map match against an idle red,
// played only through logged commands so the page's save/load re-derives it. Blue grows to seven villagers on food, wood
// and gold, reaches the third age, builds a barracks, a blacksmith and a siege workshop, trains two militia and a ram,
// and keeps a stock for the page's orders. Red's lone villager walks over and knocks hit points off a blue house built
// away from the town centre (out of its arrows), then walks home: the house the page repairs.
import {createState,submit,tick,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {authoritativeProblem} from '../packages/sim/buildings.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
export type ElementsMatch={s:State;house:string;barracks:string;ram:number;militia:number[]};
export function elementsMatch(seed=260925):ElementsMatch{
 const s=createState(seed,'open','idle',['britons','franks']);
 const order=(t:string,p:unknown,player=0)=>submit(s,{protocolVersion:1,rulesetHash,playerId:player,sequence:s.sequence[player]+1,targetTick:s.tick+1,commandType:t,payload:p} as never);
 const stock=s.accounts[0].stock,tcB=s.buildings.find(b=>b.player===0&&b.kind==='town-center')!,tc=s.map.obstacles.find(o=>o.id===tcB.id)!;
 const [tx0,ty0,tx1,ty1]=obstacleBounds(tc),tcc={x:(tx0+tx1)/2,y:(ty0+ty1)/2};
 const explored=()=>new Set(s.vision[0].explored);
 const nearest=(kind:string)=>{const seen=explored();return s.map.resources.filter(r=>r.kind===kind&&r.collectible&&seen.has(Math.floor(r.y/100)*s.map.size+Math.floor(r.x/100))).sort((a,b)=>Math.hypot(a.x-tcc.x,a.y-tcc.y)-Math.hypot(b.x-tcc.x,b.y-tcc.y))[0];};
 const idle=(id:number)=>!s.works[id]&&!s.units.find(u=>u.id===id)?.path.length;
 const site=(kind:string,from=300,to=900)=>{for(let r=from;r<=to;r+=50)for(let i=0;i<24;i++){const x=Math.round((tcc.x+Math.cos(i*Math.PI/12)*r)/10)*10,y=Math.round((tcc.y+Math.sin(i*Math.PI/12)*r)/10)*10;if(!authoritativeProblem(s,0,kind as never,x,y))return {x,y};}throw Error(`no ${kind} site`);};
 const villagers=()=>s.units.filter(u=>u.player===0&&u.kind==='villager').map(u=>u.id).sort((a,b)=>a-b);
 // Who does what: villager 1 food (berries, then a farm), the next two wood, the rest gold; a builder is borrowed per job.
 const job=(id:number)=>id===villagers()[0]?'food':villagers().indexOf(id)<3?'wood':'gold';
 const work=()=>{for(const id of villagers()){if(!idle(id))continue;const want=job(id);
   if(want==='food'){const r=nearest('berries');if(r){order('gather',{unitIds:[id],resourceId:r.id});continue;}
    const farm=s.buildings.find(b=>b.player===0&&b.kind==='farm'&&b.complete&&s.map.resources.find(v=>v.id===`resource-${b.id}`)?.collectible);
    if(farm)order('gather',{unitIds:[id],resourceId:`resource-${farm.id}`});else if(stock.wood>=60&&!s.buildings.some(b=>b.kind==='farm'&&!b.complete))order('build',{unitIds:[id],kind:'farm',...site('farm')});continue;}
   const r=nearest(want==='wood'?'tree':'gold')??nearest('tree');if(r)order('gather',{unitIds:[id],resourceId:r.id});}};
 const reach=(done:()=>boolean,limit=80000)=>{const end=s.tick+limit;while(!done()){if(s.tick>=end)throw Error(`fixture stalled at tick ${s.tick}: stock ${JSON.stringify(stock)}`);work();for(let i=0;i<20;i++)tick(s);}};
 // Build with the last villager and wait for it (the others keep working).
 const raise=(kind:string,from=300,to=900)=>{reach(()=>!!villagers().length);const before=s.nextBuildingId,id=villagers()[villagers().length-1];order('build',{unitIds:[id],kind,...site(kind,from,to)});
  for(let i=0;i<2;i++)tick(s);const b=s.buildings.find(b=>b.id===`building-${before}`);if(!b)throw Error(`${kind} not placed: ${JSON.stringify(s.transactions.at(-1))}`);reach(()=>b.complete);return b;};
 const train=(at:string,entryId:string)=>{const n=s.units.filter(u=>u.player===0&&u.kind===entryId).length;order('train',{buildingId:at,entryId});reach(()=>s.units.filter(u=>u.player===0&&u.kind===entryId).length>n);};
 for(let h=0;h<2;h++){reach(()=>stock.wood>=30);raise('house');}
 for(let v=0;v<4;v++){reach(()=>stock.food>=50);train(tcB.id,'villager');}
 reach(()=>stock.food>=300);order('train',{buildingId:tcB.id,entryId:'age-2'});reach(()=>s.ages[0]===2);
 reach(()=>stock.wood>=150);const barracks=raise('barracks');reach(()=>stock.wood>=150);raise('blacksmith');
 reach(()=>stock.food>=500&&stock.gold>=200);order('train',{buildingId:tcB.id,entryId:'age-3'});reach(()=>s.ages[0]===3);
 reach(()=>stock.wood>=200);const workshop=raise('siege-workshop');
 for(let m=0;m<2;m++){reach(()=>stock.food>=60&&stock.gold>=20);train(barracks.id,'militia');}
 reach(()=>stock.wood>=160&&stock.gold>=75);train(workshop.id,'ram');
 // The house red damages: built 700 or more from the town centre, out of reach of its arrows.
 reach(()=>stock.wood>=30);const house=raise('house',700,1100);
 // Stock for the page: a militia (60 food, 20 gold) and the repair (half a house's wood).
 reach(()=>stock.food>=200&&stock.wood>=200&&stock.gold>=80);
 const redVillager=s.units.find(u=>u.player===1&&u.kind==='villager')!;
 // It walks over until the house is in its sight, then strikes it.
 const hb=obstacleBounds(s.map.obstacles.find(o=>o.id===house.id)!),seen=()=>s.vision[1].known.some(k=>k.obstacle.id===house.id);
 order('move',{unitIds:[redVillager.id],x:Math.round((hb[0]+hb[2])/2/50)*50,y:hb[3]+100},1);
 {const end=s.tick+8000;while(!seen()){if(s.tick>=end)throw Error('red never saw the house');tick(s);}}
 order('attack',{unitIds:[redVillager.id],target:{kind:'building',id:house.id}},1);
 const end=s.tick+20000;while(house.hp>house.maxHp-60){if(s.tick>=end)throw Error(`red never dented the house: ${house.hp}/${house.maxHp}`);tick(s);}
 const home=s.map.obstacles.find(o=>o.kind==='town-center'&&o.red)!;order('move',{unitIds:[redVillager.id],x:home.x+150,y:home.y+350},1);
 // Blue's villagers stop, so the page's stock moves only with its own orders (the repair, a militia).
 order('stop',{unitIds:villagers()});for(let i=0;i<40;i++)tick(s);
 return {s,house:house.id,barracks:barracks.id,ram:s.units.find(u=>u.player===0&&u.kind==='ram')!.id,militia:s.units.filter(u=>u.player===0&&u.kind==='militia').map(u=>u.id).sort((a,b)=>a-b)};
}
