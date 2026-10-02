// The 建築 round's land buildings through the real sim (walls and gates, the bombard tower, the market and trade, the
// wonder, a second town centre): createState, commands by submit, ticks. Fixture shortcuts (stock gifts, finished
// foundations, units spawned on a node, full sight) only skip the waiting.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,submit,tick,rulesetHash} from '../packages/sim/sim.ts';
import type {State} from '../packages/sim/sim.ts';
import {makeUnit,closedFor,commandMove} from '../packages/sim/movement.ts';
import type {UnitKind} from '../packages/sim/movement.ts';
import {position,blockedTable,nodeTotal,nodeAt} from '../packages/sim/navigation.ts';
import {maxHpOf} from '../packages/sim/stats.ts';
import type {CombatUnitKind} from '../packages/sim/stats.ts';
import {ownerOf,costOf,arrowsOf} from '../packages/sim/civ.ts';
import {authoritativeProblem,placeBuilding,addWork,wallLine} from '../packages/sim/buildings.ts';
import type {Building,BuildKind} from '../packages/sim/buildings.ts';
import {dropoffNodes} from '../packages/sim/work.ts';
import {strike} from '../packages/sim/combat.ts';
import {marketRules,tradeGold} from '../packages/sim/market.ts';
import {religionRules} from '../packages/sim/religion.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
import {resources} from '../packages/content/rules.ts';
import {neutralCiv} from '../packages/content/civs.ts';

const SEED=260925;
function order(s:State,commandType:string,payload:any,playerId=0){submit(s,{protocolVersion:1,rulesetHash,playerId,sequence:s.sequence[playerId]+1,targetTick:s.tick+1,commandType,payload} as any);}
const tiles=(s:State)=>Array.from({length:s.map.size*s.map.size},(_,i)=>i);
const see=(s:State)=>{for(const v of s.vision){v.visible=tiles(s);v.explored=tiles(s);}};
const run=(s:State,n:number,stop=()=>false)=>{for(let i=0;i<n;i++){see(s);if(stop())return;tick(s);}see(s);};
function match(civs:[string,string]=[neutralCiv,neutralCiv],age=1,layout:'meadow'|'open'='meadow'){const s=createState(SEED,layout,'idle',civs);s.ages=[age,age];see(s);return s;}
function freeNode(s:State,x:number,y:number){const closed=blockedTable(s.map),held=new Set(s.units.flatMap(u=>u.next===null?[u.node]:[u.node,u.next]));let best=-1,d=Infinity;
 for(let n=0;n<nodeTotal(s.map);n++){if(closed[n]||held.has(n))continue;const p=position(s.map,n),e=Math.abs(p.x-x)+Math.abs(p.y-y);if(e<d){d=e;best=n;}}return best;}
function spawn(s:State,player:number,kind:UnitKind,x:number,y:number){const p=position(s.map,freeNode(s,x,y)),u=makeUnit(s.map,s.nextUnitId++,player,p.x,p.y,kind);
 u.hp=maxHpOf(kind as CombatUnitKind,ownerOf(s,player));s.units.push(u);s.units.sort((a,b)=>a.id-b.id);s.accounts[player].populationUsed++;return u;}
const gift=(s:State,p:number,kind:string)=>{const cost=costOf(kind,ownerOf(s,p));for(const k of resources)s.accounts[p].stock[k]+=cost[k];};
// A finished building at a free site nearest the point (fixture: paid, worked through).
function raise(s:State,p:number,kind:BuildKind,near:{x:number;y:number},step=50){const sites:{x:number;y:number;d:number}[]=[];
 for(let y=0;y<s.map.size*100;y+=step)for(let x=0;x<s.map.size*100;x+=step)if(!authoritativeProblem(s,p,kind,x,y))sites.push({x,y,d:Math.hypot(x-near.x,y-near.y)});
 sites.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);assert.ok(sites.length,'a site for '+kind);gift(s,p,kind);
 const b=placeBuilding(s,p,kind,sites[0].x,sites[0].y,`fixture:${s.nextBuildingId}`);while(!b.complete)addWork(s,b);return b;}
const tcOf=(s:State,p=0)=>s.buildings.find(b=>b.player===p&&b.kind==='town-center')!;
// A row of free tiles for a wall (left to right), away from every unit; margin: free rows above and below as well.
function freeRow(s:State,length:number,kind:BuildKind='stone-wall',margin=0){for(let ty=2+margin;ty<s.map.size-2-margin;ty++)for(let tx=1;tx+length<s.map.size-1;tx++){
  let ok=true;for(let dy=-margin;dy<=margin&&ok;dy++)for(let i=0;i<length&&ok;i++)if(authoritativeProblem(s,0,kind,(tx+i)*100,(ty+dy)*100))ok=false;if(ok)return {x:tx*100,y:ty*100};}throw Error('no free row');}

test('a dragged stone wall: one segment a tile on the line, each paid on its own; the money decides how many stand',()=>{
 const s=match([neutralCiv,neutralCiv],2);const a=s.accounts[0];a.stock.stone=12;
 assert.deepEqual(wallLine({x:150,y:250},{x:450,y:550}).map(p=>[p.x,p.y]),[[100,200],[200,300],[300,400],[400,500]],'diagonal line');
 assert.equal(wallLine({x:0,y:0},{x:3000,y:0}).length,24,'at most 24 segments');
 const at=freeRow(s,5),u=s.units.find(u=>u.player===0&&u.kind==='villager')!;
 assert.throws(()=>order(s,'build',{unitIds:[u.id],kind:'house',x:at.x,y:at.y,to:{x:at.x+400,y:at.y}}),/只有城牆可以拖曳/);
 order(s,'build',{unitIds:[u.id],kind:'stone-wall',x:at.x,y:at.y,to:{x:at.x+400,y:at.y}});run(s,2);
 const walls=s.buildings.filter(b=>b.kind==='stone-wall');
 assert.deepEqual(walls.map(b=>[b.x,b.y]),[[at.x,at.y],[at.x+100,at.y]],'two of five segments: 12 stone pays for two');
 assert.equal(a.stock.stone,2);assert.equal(s.transactions.at(-1)!.ok,true);
 // The builder finishes the first segment, then walks on to the next.
 run(s,4000,()=>walls.every(b=>b.complete));assert.ok(walls.every(b=>b.complete),'both segments built by one villager');
 a.stock.stone=0;assert.throws(()=>order(s,'build',{unitIds:[u.id],kind:'stone-wall',x:at.x+200,y:at.y,to:{x:at.x+400,y:at.y}}),/資源不足/);
});

test('a gate replaces its owner\'s wall segment of the same material; nothing is built on a gate; the enemy cannot pass it',()=>{
 const s=match([neutralCiv,neutralCiv],2,'open'),at=freeRow(s,3,'stone-wall',3);
 const wall=[0,1,2].map(i=>{gift(s,0,'stone-wall');const b=placeBuilding(s,0,'stone-wall',at.x+i*100,at.y,`w${i}`);while(!b.complete)addWork(s,b);return b;});
 assert.match(authoritativeProblem(s,1,'gate',at.x+100,at.y)!,/重疊/,'not over the other player\'s wall');
 assert.match(authoritativeProblem(s,0,'palisade-gate',at.x+100,at.y)!,/重疊/,'not a palisade gate on a stone wall');
 gift(s,0,'gate');const gate=placeBuilding(s,0,'gate',at.x+100,at.y,'g');while(!gate.complete)addWork(s,gate);
 assert.ok(!s.buildings.includes(wall[1])&&!s.map.obstacles.some(o=>o.id===wall[1].id),'the middle segment is gone');
 assert.match(authoritativeProblem(s,0,'house',at.x+40,at.y-40)!,/重疊/,'nothing on top of a gate');
 const middle=nodeAt(s.map,{x:at.x+150,y:at.y+50});
 assert.equal(closedFor(s.map,middle,'land',0),false,'open to its owner');assert.equal(closedFor(s.map,middle,'land',1),true,'closed to the enemy');
 // Scouts (they pick no fights) ride to the gate's middle: blue's stands there, red's stops short.
 const blue=spawn(s,0,'scout',at.x+150,at.y+300),red=spawn(s,1,'scout',at.x+150,at.y-200);
commandMove(s,[blue.id],{x:at.x+150,y:at.y+50});commandMove(s,[red.id],{x:at.x+150,y:at.y+50});run(s,400);
 assert.equal(blue.node,middle,'blue walks into its gate');assert.notEqual(red.node,middle,'red is held outside');
});

test('the bombard tower: one 120 shot a volley, nobody inside adds shots; heated shot adds to the arrows against ships',()=>{
 // Red idle: its computer would walk the targets out from under the slow cannonball (shots fly from the 戰術技巧 round on).
 const s=createState(SEED,'meadow','idle');s.ages=[4,4];s.techs[0].push('chemistry','bombard-tower-tech');see(s);s.units=s.units.filter(u=>u.player!==1);
 const tc=tcOf(s),tower=raise(s,0,'bombard-tower',{x:tc.x+500,y:tc.y+600}),watch=raise(s,0,'watch-tower',{x:tc.x-300,y:tc.y+700});
 for(let i=0;i<5;i++){const v=spawn(s,0,'villager',tower.x+150,tower.y+150+i*50);order(s,'garrison',{unitIds:[v.id],buildingId:tower.id});}
 run(s,300,()=>(s.garrison[tower.id]?.units.length??0)===5);assert.equal(s.garrison[tower.id]?.units.length,5);
 // The targets hold still (no attack stance): shots fly from the 戰術技巧 round on, and a walking target dodges them.
 const elephant=spawn(s,1,'war-elephant',tower.x+50,tower.y+300),full=elephant.hp;s.attacks={};s.stances[elephant.id]='passive';
 run(s,200,()=>elephant.hp<full);assert.equal(full-elephant.hp,120-2,'one cannonball: 120 less pierce armor 2');
 const after=elephant.hp;run(s,60);assert.equal(elephant.hp,after,'and nothing until it reloads');
 s.techs[0].push('heated-shot');assert.equal(arrowsOf(ownerOf(s,0),'watch-tower').bonus.ship,6);assert.equal(arrowsOf(ownerOf(s,0),'town-center').bonus.ship,undefined);
 const galley=spawn(s,1,'galley',watch.x+50,watch.y+250),hp=galley.hp;s.stances[galley.id]='passive';
 run(s,100,()=>galley.hp<hp);assert.equal(hp-galley.hp,5+1+7+6-6,'tower arrow 5 (+1 Chemistry), +7 against ships, +6 heated shot, less pierce armor 6');
});

test('the market: shared fair prices move 2 a lot; the fee is 30%, 15% with Guilds, 5% for the Saracens',()=>{
 const s=match(['saracens',neutralCiv],2);raise(s,0,'market',{x:400,y:1000});raise(s,1,'market',{x:1100,y:1000});
 const blue=s.accounts[0],red=s.accounts[1];
 assert.throws(()=>order(s,'market',{action:'sell',resource:'gold'}),/只買賣/);
 const gold=blue.stock.gold;order(s,'market',{action:'sell',resource:'food'});run(s,2);
 assert.equal(blue.stock.gold-gold,95,'Saracens: 100 less 5%');assert.equal(s.market.food,98);assert.equal(blue.ledger.market.food,-100);
 const g1=red.stock.gold;red.stock.food+=100;order(s,'market',{action:'sell',resource:'food'},1);run(s,2);assert.equal(red.stock.gold-g1,69,'red sells at the shared, lower price (98 less 30%, rounded)');
 red.stock.gold+=500;const g2=red.stock.gold;order(s,'market',{action:'buy',resource:'stone'},1);run(s,2);assert.equal(g2-red.stock.gold,169,'130 + 30%');assert.equal(s.market.stone,132);
 s.techs[1].push('guilds');const g3=red.stock.gold;red.stock.wood+=100;order(s,'market',{action:'sell',resource:'wood'},1);run(s,2);assert.equal(red.stock.gold-g3,85,'Guilds: 15%');
 red.stock.food=0;assert.throws(()=>order(s,'market',{action:'sell',resource:'food'},1),/食物不足/);
 let total=0,price:number=marketRules.start.food;for(let i=0;i<40;i++){total+=Math.round(price*0.7);price=Math.max(marketRules.min,price-marketRules.step);}assert.equal(total,1708,'the site\'s example: 4000 food from the start');
});

test('a trade cart loops between its market and the other player\'s, paid at home for each round trip',()=>{
 const s=match([neutralCiv,neutralCiv],2),home=raise(s,0,'market',{x:400,y:1100}),far=raise(s,1,'market',{x:1150,y:1100});
 const cart=spawn(s,0,'trade-cart',home.x+150,home.y+350),o=s.map.obstacles.find(o=>o.id===far.id)!;
 s.vision[0].known.push({obstacle:{...o},lastSeenTick:s.tick});
 assert.throws(()=>order(s,'trade',{unitIds:[cart.id],buildingId:home.id}),/對手/);
 const v=s.units.find(u=>u.player===0&&u.kind==='villager')!;assert.throws(()=>order(s,'trade',{unitIds:[v.id],buildingId:far.id}),/只有貿易/);
 assert.throws(()=>order(s,'attack',{unitIds:[cart.id],target:{kind:'building',id:far.id}}),/不能攻擊/);
 const per=tradeGold(s,'trade-cart',obstacleBounds(s.map.obstacles.find(o=>o.id===home.id)!),obstacleBounds(o));assert.ok(per>0);
 const gold=s.accounts[0].stock.gold;order(s,'trade',{unitIds:[cart.id],buildingId:far.id});
 run(s,4000,()=>s.accounts[0].stock.gold>gold);assert.equal(s.accounts[0].stock.gold-gold,per,'one round trip');assert.equal(s.accounts[0].ledger.trade.gold,per);
 run(s,4000,()=>s.accounts[0].stock.gold>gold+per);assert.equal(s.accounts[0].stock.gold-gold,2*per,'and again');
 order(s,'move',{unitIds:[cart.id],x:cart.x,y:cart.y});run(s,2);assert.equal(s.trades[cart.id],undefined,'any other order ends the route');
});

test('a finished wonder wins after the relic time unless it falls; the earliest wonder decides',()=>{
 const s=match([neutralCiv,neutralCiv],4,'open'),w=raise(s,0,'wonder',{x:1600,y:1600},100);run(s,1);
 assert.deepEqual(s.wonderVictory,{player:0,building:w.id,endsTick:s.tick+religionRules.relics.victoryTicks},'counting');
 const ends=s.wonderVictory!.endsTick;assert.equal(ends,s.wonders[w.id]);
 strike(s,{kind:'building',id:w.id},w.hp,-1);run(s,1);assert.equal(s.wonderVictory,null,'its fall stops the clock');
 const w2=raise(s,0,'wonder',{x:1600,y:1600},100);run(s,1);s.wonders[w2.id]=s.tick+3;run(s,5);
 assert.equal(s.outcome?.reason,'wonder');assert.equal(s.outcome?.winner,0);
});

test('a second town centre: Castle Age, Britons pay half its wood; it trains villagers and takes every resource',()=>{
 const s=match(['britons',neutralCiv],3);assert.equal(costOf('town-center',ownerOf(s,0)).wood,138);assert.equal(costOf('town-center',ownerOf(s,1)).wood,275);
 s.ages[0]=2;const v=s.units.find(u=>u.player===0&&u.kind==='villager')!;
 assert.throws(()=>order(s,'build',{unitIds:[v.id],kind:'town-center',x:900,y:1100}),/第三時代/);s.ages[0]=3;
 const tc=raise(s,0,'town-center',{x:500,y:1100});assert.equal(s.accounts[0].populationCap,10,'houses 5 more');
 assert.ok(dropoffNodes(s.map,0,'gold').length>dropoffNodes(createState(SEED,'meadow','idle').map,0,'gold').length,'a drop-off for gold too');
 gift(s,0,'villager');const n=s.units.length;order(s,'train',{buildingId:tc.id,entryId:'villager'});run(s,1000,()=>s.units.length>n);
 assert.equal(s.units.length,n+1);
});

test('a dragged palisade replays from its logged command to the same state',async()=>{
 const {replay,hash}=await import('../packages/sim/sim.ts');
 const s=createState(SEED,'open','idle');for(let i=0;i<2;i++)tick(s);
 const tc=tcOf(s),explored=new Set(s.vision[0].explored);let at:{x:number;y:number}|null=null;
 for(let ty=0;ty<s.map.size&&!at;ty++)for(let tx=0;tx+3<s.map.size&&!at;tx++)if([0,1,2,3].every(i=>explored.has(ty*s.map.size+tx+i)&&!authoritativeProblem(s,0,'palisade-wall',(tx+i)*100,ty*100))&&Math.abs(tx*100-tc.x)<800)at={x:tx*100,y:ty*100};
 assert.ok(at,'a free explored row');const v=s.units.find(u=>u.player===0&&u.kind==='villager')!;
 order(s,'build',{unitIds:[v.id],kind:'palisade-wall',x:at!.x,y:at!.y,to:{x:at!.x+300,y:at!.y}});for(let i=0;i<600;i++)tick(s);
 assert.equal(s.buildings.filter(b=>b.kind==='palisade-wall').length,4);assert.ok(s.buildings.filter(b=>b.kind==='palisade-wall').some(b=>b.complete));
 assert.equal(hash(replay(SEED,s.log,s.tick,'open','idle')),hash(s));
});
