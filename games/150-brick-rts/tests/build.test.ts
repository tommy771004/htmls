import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,hash,serialize,deserialize,replay,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {authoritativeProblem,buildingRules} from '../packages/sim/buildings.ts';
import type {BuildKind} from '../packages/sim/buildings.ts';
import {clearSegment} from '../packages/sim/navigation.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
function order(s:State,commandType:string,payload:any){submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:s.sequence[0]+1,targetTick:s.tick+1,commandType,payload} as any);}
// First valid spot scanning outward from a point, deterministic.
function spot(s:State,kind:BuildKind,from:{x:number;y:number},avoid?:number[]){for(let r=0;r<=800;r+=50)for(let dy=-r;dy<=r;dy+=50)for(let dx=-r;dx<=r;dx+=50){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;const x=from.x+dx,y=from.y+dy;
 if(avoid){const box=obstacleBounds({kind,x,y});if(Math.min(box[2],avoid[2])>Math.max(box[0],avoid[0])&&Math.min(box[3],avoid[3])>Math.max(box[1],avoid[1]))continue;}
 if(!authoritativeProblem(s,0,kind,x,y))return {x,y};}throw Error('no spot');}
function noOverlap(s:State){for(let i=0;i<s.units.length;i++)for(let j=i+1;j<s.units.length;j++){const a=s.units[i],b=s.units[j];assert.ok(Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))>=50);}}
const run=(s:State,n:number,stop=(_:State)=>false)=>{for(let i=0;i<n&&!stop(s);i++){const before=s.units.map(u=>({x:u.x,y:u.y}));tick(s);s.units.forEach((u,k)=>assert.ok(clearSegment(s.map,before[k],u)));noOverlap(s);}};

test('a house is paid on placement, blocks ground at once, builds in stages and adds housing',()=>{
 const s=createState(260925),p=spot(s,'house',{x:600,y:800});assert.equal(s.accounts[0].populationCap,5);
 order(s,'build',{unitIds:[1,2],kind:'house',x:p.x,y:p.y});tick(s);
 const b=s.buildings.find(b=>b.kind==='house')!,o=s.map.obstacles.find(o=>o.id===b.id)!;
 assert.equal(s.accounts[0].stock.wood,170);assert.equal(o.progress,0);assert.equal(clearSegment(s.map,{x:p.x+100,y:p.y+100},{x:p.x+100,y:p.y+100}),false);
 const stages=new Set<number>();run(s,2000,t=>{const ob=t.map.obstacles.find(v=>v.id===b.id)!;stages.add(ob.progress??100);return b.complete;});
 assert.equal(b.complete,true);assert.deepEqual([...stages].sort((a,b)=>a-b),[0,20,40,60,80,100]);
 assert.equal(s.accounts[0].populationCap,10);assert.equal(s.accounts[0].reservations.find(r=>r.id===b.reservationId)!.status,'committed');
 assert.equal(b.work,buildingRules.required.house);run(s,5);assert.equal(Object.keys(s.works).length,0);
});
test('two builders finish sooner than one',()=>{
 const time=(ids:number[])=>{const s=createState(260925),p=spot(s,'house',{x:600,y:800});order(s,'build',{unitIds:ids,kind:'house',x:p.x,y:p.y});let t=0;for(;t<3000&&!s.buildings.some(b=>b.kind==='house'&&b.complete);t++)tick(s);return t;};
 const one=time([1]),two=time([1,2]);assert.ok(two<one*.75,`${one} vs ${two}`);
});
test('invalid placements are refused with a reason and cost nothing',()=>{
 const s=createState(260925),before=hash(s),tc=s.map.obstacles.find(o=>o.kind==='town-center'&&!o.red)!;
 const cases:[any,RegExp][]=[[{kind:'house',x:tc.x+35,y:tc.y+50},/重疊/],[{kind:'house',x:620,y:800},/格線/],[{kind:'house',x:1300,y:1300},/探索/],[{kind:'house',x:350,y:650},/單位/],[{kind:'castle',x:600,y:800},/未知/]];
 for(const [p,re] of cases)assert.throws(()=>order(s,'build',{unitIds:[1],...p}),re);
 const coast=createState(260925,'coast');for(const u of coast.units)coast.vision[0].explored.push(...Array.from({length:256},(_,i)=>i));
 assert.match(authoritativeProblem(coast,0,'house',600,1300)??'',/地形/);
 assert.equal(hash(s),before);
});
test('the second of two same-tick orders is refused at execution without a second charge',()=>{
 const s=createState(260925);s.accounts[0].stock.wood=150;s.vision[0].explored=Array.from({length:256},(_,i)=>i);// exploration is not under test here
const a=spot(s,'barracks',{x:700,y:900});order(s,'build',{unitIds:[1],kind:'barracks',x:a.x,y:a.y});
 // Valid on its own at submit time (30 <= 150); the barracks spends the wood first in the same tick.
 const b=spot(s,'house',{x:a.x,y:a.y},obstacleBounds({kind:'barracks',x:a.x,y:a.y}));order(s,'build',{unitIds:[2],kind:'house',x:b.x,y:b.y});tick(s);
 assert.equal(s.accounts[0].stock.wood,0);assert.deepEqual(s.transactions.map(t=>t.ok),[true,false]);assert.match(s.transactions[1].error!,/資源不足/);
 assert.equal(s.buildings.filter(b=>b.kind!=='town-center').length,1);assert.equal(s.works[2],undefined);assert.throws(()=>order(s,'build',{unitIds:[3],kind:'house',x:b.x,y:b.y}),/資源不足/);
});
test('cancelling a foundation refunds in full, frees the ground and stops the builders',()=>{
 const s=createState(260925),p=spot(s,'house',{x:600,y:800});order(s,'build',{unitIds:[1],kind:'house',x:p.x,y:p.y});run(s,120);
 const b=s.buildings.find(b=>b.kind==='house')!;assert.ok(b.work>0&&!b.complete);order(s,'cancelBuild',{buildingId:b.id});tick(s);
 assert.equal(s.accounts[0].stock.wood,200);assert.equal(s.buildings.includes(b),false);assert.equal(clearSegment(s.map,{x:p.x+100,y:p.y+100},{x:p.x+100,y:p.y+100}),true);
 run(s,5);assert.equal(s.works[1],undefined);assert.throws(()=>order(s,'cancelBuild',{buildingId:b.id}),/找不到/);
});
test('a unit whose route crosses a new foundation reroutes and never steps inside it',()=>{
 const s=createState(260925);order(s,'move',{unitIds:[1],x:1200,y:1000});run(s,12);
 const route=[s.units[0].next??s.units[0].node,...s.units[0].path].map(n=>({x:50+(n%31)*50,y:50+Math.floor(n/31)*50}));
 // Put a house on a node of the planned route that is not currently occupied.
 let placed=null as null|{x:number;y:number};for(const p of route.slice(3)){for(const dy of [-200,-150,-100,-50,0])for(const dx of [-200,-150,-100,-50,0]){const x=p.x+dx,y=p.y+dy;if(!authoritativeProblem(s,0,'house',x,y)){placed={x,y};break;}}if(placed)break;}
 assert.ok(placed,'found a spot on the route');order(s,'build',{unitIds:[2],kind:'house',x:placed!.x,y:placed!.y});
 const box=obstacleBounds({kind:'house',x:placed!.x,y:placed!.y},25);
 run(s,1500,t=>t.units[0].navigation==='idle'&&t.tick>40);
 assert.equal(s.units[0].navigation,'idle');assert.ok(Math.abs(s.units[0].x-1200)+Math.abs(s.units[0].y-1000)<=100);
 assert.ok(!(s.units[0].x>box[0]&&s.units[0].x<box[2]&&s.units[0].y>box[1]&&s.units[0].y<box[3]));
});
test('construction survives save/load and replays to the same hash',()=>{
 const s=createState(260925),p=spot(s,'house',{x:600,y:800});order(s,'build',{unitIds:[1,2,3],kind:'house',x:p.x,y:p.y});run(s,150);
 const restored=deserialize(serialize(s));for(let i=0;i<300;i++){tick(s);tick(restored);}assert.equal(hash(s),hash(restored));assert.equal(hash(s),hash(replay(s.seed,s.log,s.tick)));
});
