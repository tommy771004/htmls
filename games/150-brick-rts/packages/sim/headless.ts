import {performance} from 'node:perf_hooks';
import {createState,submit,tick,hash,replay,serialize,deserialize,rulesetHash} from './sim.ts';
export function runHeadless(seed=260925,ticks=10000){
 if(!Number.isSafeInteger(ticks)||ticks<2||ticks>100000)throw Error('ticks 必須為 2–100000 的整數');
 const state=createState(seed),samples:number[]=[];
 submit(state,{protocolVersion:1,rulesetHash,playerId:0,sequence:1,targetTick:1,commandType:'move',payload:{unitIds:[1],x:1150,y:900}});
 let restored:ReturnType<typeof createState>|null=null;
 for(let i=0;i<ticks;i++){const start=performance.now();tick(state);samples.push(performance.now()-start);if(i===Math.floor(ticks/2)-1)restored=deserialize(serialize(state));else if(restored)tick(restored);}
 const replayed=replay(seed,state.log,ticks);
 if(hash(state)!==hash(replayed)||hash(state)!==hash(restored))throw Error('重播或存讀續跑不一致');
 const ordered=[...samples].sort((a,b)=>a-b);
 return {seed,ticks,rulesetHash,stateHash:hash(state),commands:state.log.length,replayMatches:true,snapshotContinuationMatches:true,measurement:{kind:'node-headless-four-unit-sandbox',node:process.version,platform:process.platform,arch:process.arch,meanTickMs:samples.reduce((a,b)=>a+b,0)/ticks,p95TickMs:ordered[Math.floor(ticks*.95)],maxTickMs:ordered.at(-1),note:'Observed CPU tick timing only; not browser FPS, target hardware certification, or a full-match benchmark.'}};
}
