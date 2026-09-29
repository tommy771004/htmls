import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {makeUnit} from '../packages/sim/movement.ts';
import type {UnitKind} from '../packages/sim/movement.ts';
import {position,nodeTotal} from '../packages/sim/navigation.ts';
import {authoritativeProblem} from '../packages/sim/buildings.ts';
import {religionRules,faithOf,convertRangeOf} from '../packages/sim/religion.ts';
import {maxHpOf,combatRules} from '../packages/sim/stats.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
function order(s:State,commandType:string,payload:any,playerId=0){submit(s,{protocolVersion:1,rulesetHash,playerId,sequence:s.sequence[playerId]+1,targetTick:s.tick+1,commandType,payload} as any);}
// Test fixtures (not in the command log): place a unit on the free node nearest a point; grant a technology.
function spawn(s:State,player:number,kind:UnitKind,x:number,y:number){let best=-1,dist=Infinity;const held=new Set(s.units.map(u=>u.node)),closed=new Set(s.map.blocked);
 for(let n=0;n<nodeTotal(s.map);n++){if(closed.has(n)||held.has(n))continue;const p=position(s.map,n),d=Math.abs(p.x-x)+Math.abs(p.y-y);if(d<dist){dist=d;best=n;}}
 const p=position(s.map,best),u=makeUnit(s.map,s.nextUnitId++,player,p.x,p.y,kind);s.units.push(u);s.units.sort((a,b)=>a.id-b.id);s.accounts[player].populationUsed++;return u;}
const run=(s:State,n:number,stop=(_:State)=>false)=>{for(let i=0;i<n&&!stop(s);i++)tick(s);};
const grant=(s:State,player:number,...techs:string[])=>s.techs[player].push(...techs);
// Ticks from the order until the red villager changes sides (the monk starts 300 away, inside range).
function conversionTicks(seed:number,faith=false){const s=createState(seed),v=s.units.find(u=>u.id===4)!,m=spawn(s,0,'monk',v.x-300,v.y);if(faith)grant(s,1,'faith');run(s,2);
 order(s,'convert',{unitIds:[m.id],targetId:v.id});const start=s.tick;run(s,2000,s=>s.units.find(u=>u.id===4)!.player===0);return s.tick-start;}

test('conversion attempts: never before the 4th, always by the 10th; Faith moves them to the 6th and 14th',()=>{
 const I=religionRules.attemptTicks,plain=[1,2,3,4,5,6,7,8,9,10,11,12].map(seed=>conversionTicks(seed)),faithful=[1,2,3,4,5,6].map(seed=>conversionTicks(seed,true));
 for(const t of plain){assert.ok(t>=4*I&&t<=10*I,`plain ${t}`);assert.equal(t%I,0,'on an attempt tick');}
 for(const t of faithful)assert.ok(t>=6*I&&t<=14*I,`faith ${t}`);
 assert.ok(new Set(plain).size>2,'the attempt that succeeds varies with the seed');
});

test('Atonement lets monks convert monks; Sanctity adds 15 hit points to monks in the field and new ones',()=>{
 const s=createState(260925),v=s.units.find(u=>u.id===4)!,m=spawn(s,0,'monk',v.x-300,v.y),enemy=spawn(s,1,'monk',v.x-150,v.y+100);run(s,2);
 assert.throws(()=>order(s,'convert',{unitIds:[m.id],targetId:enemy.id}),/贖罪/);grant(s,0,'atonement');
 order(s,'convert',{unitIds:[m.id],targetId:enemy.id});run(s,400,()=>enemy.player===0);assert.equal(enemy.player,0);
 assert.equal(maxHpOf('monk',['sanctity']),combatRules.units.monk.hp+15);
 // Sanctity through research: existing monks gain the hit points.
 const t=createState(260925);t.vision[0].explored=Array.from({length:256},(_,i)=>i);Object.assign(t.accounts[0].stock,{food:3000,wood:1000,gold:2000});t.ages[0]=3;
 let site:{x:number;y:number}|null=null;for(let y=650;y<=1200&&!site;y+=50)for(let x=500;x<=1100&&!site;x+=50)if(!authoritativeProblem(t,0,'monastery',x,y))site={x,y};
 order(t,'build',{unitIds:[1,2,3],kind:'monastery',...site});run(t,3000,t=>t.buildings.some(b=>b.kind==='monastery'&&b.complete));
 const mon=t.buildings.find(b=>b.kind==='monastery')!,old=spawn(t,0,'monk',site!.x,site!.y+400);
 order(t,'train',{buildingId:mon.id,entryId:'sanctity'});tick(t);assert.throws(()=>order(t,'train',{buildingId:mon.id,entryId:'sanctity'}),/已在研究中/);run(t,410);
 assert.ok(t.techs[0].includes('sanctity'));assert.equal(old.hp,45);assert.throws(()=>order(t,'train',{buildingId:mon.id,entryId:'sanctity'}),/已研究/);
 order(t,'train',{buildingId:mon.id,entryId:'monk'});run(t,420);assert.equal(t.units.filter(u=>u.kind==='monk'&&u.player===0).at(-1)!.hp,45,'a new monk has them too');
 // Imperial-age technologies wait for the fourth age.
 assert.throws(()=>order(t,'train',{buildingId:mon.id,entryId:'illumination'}),/需要第四時代/);
});

test('Illumination halves the faith recharge; Block Printing lengthens the conversion range',()=>{
 const s=createState(260925),v=s.units.find(u=>u.id===4)!,m=spawn(s,0,'monk',v.x-300,v.y);run(s,2);
 order(s,'convert',{unitIds:[m.id],targetId:v.id});run(s,400,()=>v.player===0);
 run(s,religionRules.rechargeTicks/2);assert.ok(faithOf(s,m.id)<1);grant(s,0,'illumination');assert.equal(faithOf(s,m.id),1);
 assert.equal(convertRangeOf(s,0),religionRules.convertRange);grant(s,0,'block-printing');assert.equal(convertRangeOf(s,0),religionRules.convertRange+religionRules.printingRange);
});

test('without Theocracy every monk of a group rests after a conversion; with it only the converter',()=>{
 for(const theocracy of [false,true]){const s=createState(260925),v=s.units.find(u=>u.id===4)!,a=spawn(s,0,'monk',v.x-300,v.y),b=spawn(s,0,'monk',v.x-300,v.y+100);if(theocracy)grant(s,0,'theocracy');run(s,2);
  order(s,'convert',{unitIds:[a.id,b.id],targetId:v.id});run(s,400,()=>v.player===0);assert.equal(v.player,0);
  const rested=[a,b].filter(m=>faithOf(s,m.id)<1).length;assert.equal(rested,theocracy?1:2,`theocracy ${theocracy}`);}
});

test('Heresy: a unit converted from its owner dies instead of changing sides',()=>{
 const s=createState(260925),v=s.units.find(u=>u.id===4)!,m=spawn(s,0,'monk',v.x-300,v.y);grant(s,1,'heresy');run(s,2);const pop=s.accounts[1].populationUsed;
 order(s,'convert',{unitIds:[m.id],targetId:v.id});run(s,400,()=>!s.units.includes(v));
 assert.ok(!s.units.includes(v),'died');assert.equal(s.accounts[1].populationUsed,pop-1);assert.equal(s.accounts[0].populationUsed,4);assert.ok(faithOf(s,m.id)<1,'the monk still spent its faith');
});

test('Redemption: monks convert enemy buildings standing next to them, except town centres, monasteries and farms',()=>{
 const s=createState(260925),redTc=s.buildings.find(b=>b.player===1&&b.kind==='town-center')!,box=obstacleBounds(s.map.obstacles.find(o=>o.id===redTc.id)!);
 // A finished red house next to red's town centre (fixture: red's own foundation completed by hand).
 s.vision[1].explored=Array.from({length:256},(_,i)=>i);let site:{x:number;y:number}|null=null;
 const g=(v:number)=>Math.round(v/10)*10;for(let y=g(box[1]);y<=box[3]+300&&!site;y+=50)for(let x=g(box[0]-400);x<=box[2]+200&&!site;x+=50)if(!authoritativeProblem(s,1,'house',x,y))site={x,y};
 order(s,'build',{unitIds:[4],kind:'house',...site},1);run(s,2000,s=>s.buildings.some(b=>b.player===1&&b.kind==='house'&&b.complete));
 const house=s.buildings.find(b=>b.player===1&&b.kind==='house')!,hb=obstacleBounds(s.map.obstacles.find(o=>o.id===house.id)!);
 const m=spawn(s,0,'monk',hb[0]-250,hb[1]);run(s,3);
 assert.throws(()=>order(s,'convert',{unitIds:[m.id],buildingId:house.id}),/救贖/);grant(s,0,'redemption');
 // Seen for this check only (fixture): a town centre is never convertible.
 const vis=s.vision[0].visible;for(let ty=Math.floor(box[1]/100);ty<=Math.floor((box[3]-1)/100);ty++)for(let tx=Math.floor(box[0]/100);tx<=Math.floor((box[2]-1)/100);tx++)vis.push(ty*16+tx);
 assert.throws(()=>order(s,'convert',{unitIds:[m.id],buildingId:redTc.id}),/城鎮中心、修道院與農田不能被轉化/);
 const [capRed,capBlue]=[s.accounts[1].populationCap,s.accounts[0].populationCap];
 order(s,'convert',{unitIds:[m.id],buildingId:house.id});const start=s.tick;run(s,1500,()=>house.player===0);
 assert.equal(house.player,0,'converted');assert.ok(s.tick-start>=religionRules.buildingTicks.min,'at least 18 s');
 assert.ok(Math.max(hb[0]-m.x,0,m.x-hb[2],hb[1]-m.y,0,m.y-hb[3])<=religionRules.adjacentRange+25,'converted from beside it');
 assert.equal(s.map.obstacles.find(o=>o.id===house.id)!.red,undefined);assert.equal(s.accounts[1].populationCap,capRed-5);assert.equal(s.accounts[0].populationCap,capBlue+5);
});
