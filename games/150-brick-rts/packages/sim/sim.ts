import type {MapLayout} from './terrain.ts';
import {createVision,updateVision,visionRules} from './vision.ts';
import type {PlayerVision} from './vision.ts';
import {createAccount,reserve,cancelReservation,economyRules} from './economy.ts';
import type {Account} from './economy.ts';
import {terrainRules,terrainDefinitions,resourceDefinitions} from './terrain.ts';
import {rules} from '../content/rules.ts';
import {footprintContract} from '../content/footprints.ts';
import {combatRules} from './stats.ts';
import {makeMap,clearSegment,navigationRules,startingResourceRules} from './navigation.ts';
import type {MapData} from './navigation.ts';
import {makeUnit,commandMove,commandStop,stepMovement} from './movement.ts';
import type {Unit,Job} from './movement.ts';
import {commandGather,commandBuild,clearWork,stepWork,gatherable} from './work.ts';
import {initBuildings,placeBuilding,cancelBuilding,authoritativeProblem,buildKinds} from './buildings.ts';
import type {Building,BuildKind} from './buildings.ts';
import {enqueue,dequeue,stepProduction,trainable} from './production.ts';
import {commandAttack,clearAttacks,stepCombat,targetProblem} from './combat.ts';
import type {Attack,Corpse,Outcome,Target} from './combat.ts';
import type {Work,Cargo} from './work.ts';
import {tileAt} from './terrain.ts';
export type {Unit} from './movement.ts';
type Envelope={protocolVersion:1;rulesetHash:string;playerId:number;sequence:number;targetTick:number};
export type MoveCommand=Envelope&{commandType:'move';payload:{unitIds:number[];x:number;y:number}};
export type StopCommand=Envelope&{commandType:'stop';payload:{unitIds:number[]}};
export type GatherCommand=Envelope&{commandType:'gather';payload:{unitIds:number[];resourceId:string}};
export type BuildCommand=Envelope&{commandType:'build';payload:{unitIds:number[];kind:BuildKind;x:number;y:number}};
export type ConstructCommand=Envelope&{commandType:'construct';payload:{unitIds:number[];buildingId:string}};
export type CancelBuildCommand=Envelope&{commandType:'cancelBuild';payload:{buildingId:string}};
export type TrainCommand=Envelope&{commandType:'train';payload:{buildingId:string;entryId:string}};
export type CancelTrainCommand=Envelope&{commandType:'cancelTrain';payload:{buildingId:string;itemId:number}};
export type RallyCommand=Envelope&{commandType:'rally';payload:{buildingId:string;x:number;y:number}};
export type AttackCommand=Envelope&{commandType:'attack';payload:{unitIds:number[];target:Target}};
export type Command=AttackCommand|MoveCommand|StopCommand|GatherCommand|BuildCommand|ConstructCommand|CancelBuildCommand|TrainCommand|CancelTrainCommand|RallyCommand|Envelope&{commandType:'reserve';payload:{entryId:string}}|Envelope&{commandType:'cancelReservation';payload:{reservationId:string}};
export type LoggedCommand=Command&{acceptedTick:number};
export type TransactionResult={tick:number;playerId:number;sequence:number;ok:boolean;error?:string};
export type State={navigationSeen:number;buildings:Building[];nextBuildingId:number;ages:number[];nextUnitId:number;nextQueueId:number;attacks:Record<number,Attack>;corpses:Corpse[];outcome:Outcome|null;version:15;works:Record<number,Work>;cargo:Record<number,Cargo>;layout:MapLayout;vision:PlayerVision[];accounts:Account[];transactions:TransactionResult[];map:MapData;pathJobs:Job[];nextJobId:number;seed:number;rng:number;tick:number;sequence:number[];units:Unit[];queue:Command[];log:LoggedCommand[]};
function canonical(value:unknown):string {if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';}
export function hash(value:unknown):string{let h=2166136261;for(const c of canonical(value)){h=Math.imul(h^c.charCodeAt(0),16777619);}return (h>>>0).toString(16).padStart(8,'0');}
export const rulesetHash=hash({rules,navigationRules,economyRules,terrainRules,terrainDefinitions,resourceDefinitions,visionRules,startingResourceRules,footprints:footprintContract,combat:combatRules,simulationVersion:15});
export function createState(seed:number,layout:MapLayout='meadow'):State{if(!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw Error('seed 必須為 uint32');const state:State={buildings:[],nextBuildingId:1,ages:[1,1],nextUnitId:5,nextQueueId:1,attacks:{},corpses:[],outcome:null,version:15,works:{},cargo:{},layout,vision:createVision(),accounts:[createAccount(3),createAccount(1)],transactions:[],map:makeMap(seed,layout),pathJobs:[],nextJobId:1,navigationSeen:0,seed,rng:seed||1,tick:0,sequence:[0,0],units:[makeUnit(1,0,350,700),makeUnit(2,0,450,700),makeUnit(3,0,400,800),makeUnit(4,1,1150,700)],queue:[],log:[]};initBuildings(state);updateVision(state.vision,state.map,state.units,0);return state;}
// xorshift32; renderers never advance this stream.
export function nextRandom(state:State):number{let n=state.rng;n^=n<<13;n^=n>>>17;n^=n<<5;state.rng=n>>>0;return state.rng;}
export function submit(state:State, c:Command):void {
 if(!c||c.protocolVersion!==1||c.rulesetHash!==rulesetHash)throw Error('命令版本不符');
 if(!Number.isSafeInteger(c.playerId)||c.playerId<0||c.playerId>1)throw Error('無效玩家');
 if(!Number.isSafeInteger(c.sequence)||c.sequence!==state.sequence[c.playerId]+1)throw Error('重複或錯序命令');
 if(!Number.isSafeInteger(c.targetTick)||c.targetTick<=state.tick||c.targetTick>state.tick+200)throw Error('命令已過期或過遠');
 if(!c.payload)throw Error('缺少 payload');
 if(state.outcome)throw Error('對局已結束：請再開一局');
 if(c.commandType==='move'||c.commandType==='stop'||c.commandType==='gather'||c.commandType==='build'||c.commandType==='construct'||c.commandType==='attack'){
 const ids=c.payload.unitIds;
 if(!Array.isArray(ids)||!ids.length||ids.length>navigationRules.maxGroupSize||!ids.every((id,i)=>Number.isSafeInteger(id)&&(i===0||id>ids[i-1])))throw Error(`單位清單需為 1–${navigationRules.maxGroupSize} 個遞增且不重複的 ID`);
 for(const id of ids){const u=state.units.find(u=>u.id===id);if(!u||u.player!==c.playerId)throw Error('不可控制敵方或不存在的單位');if(c.commandType!=='move'&&c.commandType!=='stop'&&c.commandType!=='attack'&&u.kind!=='villager')throw Error('只有村民能採集或建造');}
 }
 if(c.commandType==='move'){
 for(const k of ['x','y'] as const)if(!Number.isSafeInteger(c.payload[k])||c.payload[k]<50||c.payload[k]>1550)throw Error('目標超出地圖');
 if(!clearSegment(state.map,c.payload,c.payload))throw Error('目標位於建築、資源或不可通行地形的占地內');
 }else if(c.commandType==='stop'){}
 else if(c.commandType==='attack'){const t=c.payload.target;if(!t||!['unit','building'].includes(t.kind))throw Error('無效的攻擊目標');const problem=targetProblem(state,c.playerId,t);if(problem)throw Error(problem);}
 else if(c.commandType==='build'){
 const {kind,x,y}=c.payload;if(!buildKinds.includes(kind))throw Error('未知的建築種類');
 const problem=authoritativeProblem(state,c.playerId,kind,x,y);if(problem)throw Error(problem);
 const cost=rules.entries.find(e=>e.id===kind)!.cost,stock=state.accounts[c.playerId].stock,short=(Object.keys(cost) as (keyof typeof cost)[]).filter(k=>stock[k]<cost[k]);
 if(short.length)throw Error(`資源不足：${short.map(k=>`${({food:'食物',wood:'木材',gold:'黃金',stone:'石頭'} as const)[k]}需要 ${cost[k]}，目前 ${stock[k]}`).join('；')}`);
 }
 else if(c.commandType==='train'||c.commandType==='cancelTrain'||c.commandType==='rally'){
 const b=state.buildings.find(b=>b.id===c.payload.buildingId);if(!b||b.player!==c.playerId)throw Error('找不到這棟己方建築');
 if(c.commandType==='train'){const problem=trainable(state,c.playerId,b,c.payload.entryId);if(problem)throw Error(problem);}
 else if(c.commandType==='cancelTrain'){if(!b.queue.some(q=>q.id===c.payload.itemId))throw Error('佇列項目已完成或不存在');}
 else{if(!b.complete)throw Error('建築尚未完工');for(const k of ['x','y'] as const)if(!Number.isSafeInteger(c.payload[k])||c.payload[k]<50||c.payload[k]>1550)throw Error('集結點超出地圖');
 if(!clearSegment(state.map,c.payload,c.payload))throw Error('集結點不能設在建築、資源或不可通行地形上');}
 }
 else if(c.commandType==='construct'||c.commandType==='cancelBuild'){
 const b=state.buildings.find(b=>b.id===c.payload.buildingId);if(!b||b.player!==c.playerId)throw Error('找不到這棟己方建築');if(b.complete)throw Error('建築已完工');
 }
 else if(c.commandType==='gather'){
 const r=typeof c.payload.resourceId==='string'?state.map.resources.find(r=>r.id===c.payload.resourceId):undefined;
 // Unexplored resources are unknown to the player: same error as a missing id, so nothing leaks.
 if(!r||!state.vision[c.playerId].explored.includes(tileAt(r.x,r.y)))throw Error('找不到這個資源');
 const problem=gatherable(state.map,r.id);if(problem)throw Error(problem);
 }
 else if(c.commandType==='reserve'){if(!rules.entries.some(e=>e.id===c.payload.entryId))throw Error('未知預留內容');}
 else if(c.commandType==='cancelReservation'){if(typeof c.payload.reservationId!=='string'||!c.payload.reservationId.startsWith(`${c.playerId}:`))throw Error('不可取消敵方或無效的預留');}
 else throw Error('不支援的命令');
 const copy=structuredClone(c);delete (copy as Partial<LoggedCommand>).acceptedTick;state.queue.push(copy);state.queue.sort((a,b)=>a.targetTick-b.targetTick||a.playerId-b.playerId||a.sequence-b.sequence);state.log.push({...structuredClone(copy),acceptedTick:state.tick});state.sequence[c.playerId]=c.sequence;
}
// Returns observation-only counters (never stored in State or fed back into rules).
export function tick(s:State):{expanded:number} {
 s.tick++;
 s.queue.sort((a,b)=>a.targetTick-b.targetTick||a.playerId-b.playerId||a.sequence-b.sequence);
 while(s.queue.length&&s.queue[0].targetTick===s.tick){const c=s.queue.shift()!;
 if(c.commandType==='attack'){if(!targetProblem(s,c.playerId,c.payload.target))commandAttack(s,c.payload.unitIds,c.payload.target);else{clearAttacks(s,c.payload.unitIds);commandStop(s,c.payload.unitIds);}continue;}
 if(c.commandType==='move'||c.commandType==='stop'||c.commandType==='gather'||c.commandType==='build'||c.commandType==='construct')clearAttacks(s,c.payload.unitIds);
 if(c.commandType==='move'){clearWork(s,c.payload.unitIds);commandMove(s,c.payload.unitIds,{x:c.payload.x,y:c.payload.y});continue;}
 if(c.commandType==='stop'){clearWork(s,c.payload.unitIds);commandStop(s,c.payload.unitIds);continue;}
 // Re-validated at execution: the resource may have run out since the order was accepted.
 if(c.commandType==='gather'){if(!gatherable(s.map,c.payload.resourceId))commandGather(s,c.payload.unitIds,c.payload.resourceId);else{clearWork(s,c.payload.unitIds);commandStop(s,c.payload.unitIds);}continue;}
 // Placement and payment are re-checked at execution; a failure is logged as a transaction, the builders stop.
 if(c.commandType==='rally'){const b=s.buildings.find(b=>b.id===c.payload.buildingId);if(b)b.rally={x:c.payload.x,y:c.payload.y};continue;}
 if(c.commandType==='train'||c.commandType==='cancelTrain'){const result:TransactionResult={tick:s.tick,playerId:c.playerId,sequence:c.sequence,ok:true};
  try{if(c.commandType==='train')enqueue(s,c.playerId,c.payload.buildingId,c.payload.entryId,`${c.playerId}:${c.sequence}`);else dequeue(s,c.playerId,c.payload.buildingId,c.payload.itemId);}catch(e){result.ok=false;result.error=(e as Error).message;}
  s.transactions.push(result);continue;}
 if(c.commandType==='build'||c.commandType==='construct'||c.commandType==='cancelBuild'){const result:TransactionResult={tick:s.tick,playerId:c.playerId,sequence:c.sequence,ok:true};
  try{if(c.commandType==='build'){const b=placeBuilding(s,c.playerId,c.payload.kind,c.payload.x,c.payload.y,`${c.playerId}:${c.sequence}`);clearWork(s,c.payload.unitIds);commandBuild(s,c.payload.unitIds,b.id);}
   else if(c.commandType==='construct'){const b=s.buildings.find(b=>b.id===c.payload.buildingId);if(!b||b.complete)throw Error('建築已不存在或已完工');clearWork(s,c.payload.unitIds);commandBuild(s,c.payload.unitIds,b.id);}
   else cancelBuilding(s,c.playerId,c.payload.buildingId);}
  catch(e){result.ok=false;result.error=(e as Error).message;if(c.commandType!=='cancelBuild'){clearWork(s,c.payload.unitIds);commandStop(s,c.payload.unitIds);}}
  s.transactions.push(result);continue;}
 {const result:TransactionResult={tick:s.tick,playerId:c.playerId,sequence:c.sequence,ok:true};try{if(c.commandType==='reserve')reserve(s.accounts[c.playerId],`${c.playerId}:${c.sequence}`,c.payload.entryId);else cancelReservation(s.accounts[c.playerId],c.payload.reservationId);}catch(e){result.ok=false;result.error=(e as Error).message;}s.transactions.push(result);continue;}
 }
 stepProduction(s);
 // Deterministic movement: shared search budget, node reservations, waiting and bounded replans.
 const stats=stepMovement(s);
 stepCombat(s);
 stepWork(s);
 updateVision(s.vision,s.map,s.units,s.tick);
 return stats;
}
export function replay(seed:number,commands:LoggedCommand[],ticks:number,layout:MapLayout='meadow'):State{
 if(!Number.isSafeInteger(ticks)||ticks<0||ticks>100000||!Array.isArray(commands)||commands.length>10000)throw Error('無效重播範圍');
 const s=createState(seed,layout);let previousTick=0;
 for(const c of commands){
 if(!c||!Number.isSafeInteger(c.acceptedTick)||c.acceptedTick<previousTick||c.acceptedTick>ticks)throw Error('無效命令接收時間');
 while(s.tick<c.acceptedTick)tick(s);submit(s,c);previousTick=c.acceptedTick;
 }
 while(s.tick<ticks)tick(s);return s;
}
export function serialize(s:State):string{if(s.tick>100000||s.log.length>10000)throw Error('已超過此階段沙盒存檔容量（100000 ticks / 10000 指令）');return JSON.stringify({format:'brick-sandbox-15',rulesetHash,state:s,checksum:hash(s)});}
export function deserialize(raw:string):State{
 const v=JSON.parse(raw);
 if(!v||v.format!=='brick-sandbox-15'||v.rulesetHash!==rulesetHash||!v.state||v.checksum!==hash(v.state))throw Error('存檔版本不符或內容損壞');
 const s=v.state as State;
 if(s.version!==15||!Number.isSafeInteger(s.tick)||s.tick<0||s.tick>100000||!Array.isArray(s.log)||s.log.length>10000)throw Error('無效存檔狀態');
 const rebuilt=replay(s.seed,s.log,s.tick,s.layout);
 if(hash(rebuilt)!==hash(s))throw Error('存檔狀態無法由命令重建');
 return structuredClone(s);
}
