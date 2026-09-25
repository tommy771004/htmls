import {performance} from 'node:perf_hooks';
import {createState,submit,tick,hash,rulesetHash} from './sim.ts';
import {makeUnit,nodeAt} from './movement.ts';
import {navigationRules} from './navigation.ts';
// Movement workload evidence for prompt 05. Observations only: nothing here feeds back into State.
export function runGateBenchmark(count:number,seed=260925){
 if(!Number.isSafeInteger(count)||count<1||count>navigationRules.maxGroupSize)throw Error('單位數需為 1–40');
 const s=createState(seed),taken=new Set(s.units.map(u=>u.node));let id=10;
 // Blue villagers south of the blue town center, nearest first; the order targets the hall behind the gate.
 const spots:[number,number][]=[];for(let y=700;y<=1000;y+=50)for(let x=200;x<=600;x+=50)spots.push([x,y]);
 spots.sort((a,b)=>Math.abs(a[0]-400)+Math.abs(a[1]-700)-(Math.abs(b[0]-400)+Math.abs(b[1]-700))||a[1]-b[1]||a[0]-b[0]);
 for(const [x,y] of spots){if(s.units.filter(u=>u.player===0).length>=count)break;const n=nodeAt({x,y});if(s.map.blocked.includes(n)||taken.has(n))continue;taken.add(n);s.units.push(makeUnit(id++,0,x,y));}
 s.units.sort((a,b)=>a.id-b.id);
 const blue=s.units.filter(u=>u.player===0),ids=blue.slice(0,count).map(u=>u.id);
 submit(s,{protocolVersion:1,rulesetHash,playerId:0,sequence:1,targetTick:1,commandType:'move',payload:{unitIds:ids,x:400,y:400}});
 const expanded:number[]=[],ms:number[]=[];let waitTicks=0,searchTicks=0,gateCrossings=new Set<number>();
 for(let t=0;t<20000;t++){
  const start=performance.now(),stats=tick(s);ms.push(performance.now()-start);expanded.push(stats.expanded);
  const mine=s.units.filter(u=>ids.includes(u.id));waitTicks+=mine.filter(u=>u.navigation==='waiting').length;if(mine.some(u=>u.navigation==='searching'))searchTicks++;
  for(const u of mine)if(u.x===400&&u.y>=500&&u.y<=525)gateCrossings.add(u.id);
  if(t>2&&!s.pathJobs.length&&mine.every(u=>u.next===null&&!u.path.length))break;
 }
 const pct=(v:number[],p:number)=>{const o=[...v].sort((a,b)=>a-b);return o[Math.min(o.length-1,Math.floor(o.length*p))];};
 const mine=s.units.filter(u=>ids.includes(u.id)),active=expanded.filter(n=>n>0);
 return {units:count,seed,rulesetHash,expansionsPerTick:navigationRules.expansionsPerTick,settledTick:s.tick,stateHash:hash(s),
  outcome:{idle:mine.filter(u=>u.navigation==='idle').length,unreachable:mine.filter(u=>u.navigation==='unreachable').length,stuck:mine.filter(u=>u.navigation==='stuck').length},
  gateCrossings:gateCrossings.size,waitTicks,searchTicks,expandedTotal:expanded.reduce((a,b)=>a+b,0),p95ExpandedPerSearchTick:active.length?pct(active,.95):0,
  timing:{meanTickMs:ms.reduce((a,b)=>a+b,0)/ms.length,p95TickMs:pct(ms,.95),maxTickMs:Math.max(...ms),node:process.version,platform:`${process.platform} ${process.arch}`,note:'CPU observation on this machine; not browser FPS or target-hardware evidence.'}};
}
