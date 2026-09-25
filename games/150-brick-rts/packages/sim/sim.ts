import type {MapLayout} from './terrain.ts';
import {createVision,updateVision,visionRules} from './vision.ts';
import type {PlayerVision} from './vision.ts';
import {createAccount,reserve,cancelReservation,economyRules} from './economy.ts';
import type {Account} from './economy.ts';
import {terrainRules,terrainDefinitions,resourceDefinitions} from './terrain.ts';
import {rules} from '../content/rules.ts';
import {footprintContract} from '../content/footprints.ts';
import {makeMap,clearSegment,navigationRules,startingResourceRules} from './navigation.ts';
import type {MapData} from './navigation.ts';
import {makeUnit,commandMove,commandStop,stepMovement} from './movement.ts';
import type {Unit,Job} from './movement.ts';
export type {Unit} from './movement.ts';
type Envelope={protocolVersion:1;rulesetHash:string;playerId:number;sequence:number;targetTick:number};
export type MoveCommand=Envelope&{commandType:'move';payload:{unitIds:number[];x:number;y:number}};
export type StopCommand=Envelope&{commandType:'stop';payload:{unitIds:number[]}};
export type Command=MoveCommand|StopCommand|Envelope&{commandType:'reserve';payload:{entryId:string}}|Envelope&{commandType:'cancelReservation';payload:{reservationId:string}};
export type LoggedCommand=Command&{acceptedTick:number};
export type TransactionResult={tick:number;playerId:number;sequence:number;ok:boolean;error?:string};
export type State={version:11;layout:MapLayout;vision:PlayerVision[];accounts:Account[];transactions:TransactionResult[];map:MapData;pathJobs:Job[];nextJobId:number;seed:number;rng:number;tick:number;sequence:number[];units:Unit[];queue:Command[];log:LoggedCommand[]};
function canonical(value:unknown):string {if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';}
export function hash(value:unknown):string{let h=2166136261;for(const c of canonical(value)){h=Math.imul(h^c.charCodeAt(0),16777619);}return (h>>>0).toString(16).padStart(8,'0');}
export const rulesetHash=hash({rules,navigationRules,economyRules,terrainRules,terrainDefinitions,resourceDefinitions,visionRules,startingResourceRules,footprints:footprintContract,simulationVersion:11});
export function createState(seed:number,layout:MapLayout='meadow'):State{if(!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw Error('seed 必須為 uint32');const state:State={version:11,layout,vision:createVision(),accounts:[createAccount(3),createAccount(1)],transactions:[],map:makeMap(seed,layout),pathJobs:[],nextJobId:1,seed,rng:seed||1,tick:0,sequence:[0,0],units:[makeUnit(1,0,350,700),makeUnit(2,0,450,700),makeUnit(3,0,400,800),makeUnit(4,1,1150,700)],queue:[],log:[]};updateVision(state.vision,state.map,state.units,0);return state;}
// xorshift32; renderers never advance this stream.
export function nextRandom(state:State):number{let n=state.rng;n^=n<<13;n^=n>>>17;n^=n<<5;state.rng=n>>>0;return state.rng;}
export function submit(state:State, c:Command):void {
 if(!c||c.protocolVersion!==1||c.rulesetHash!==rulesetHash)throw Error('命令版本不符');
 if(!Number.isSafeInteger(c.playerId)||c.playerId<0||c.playerId>1)throw Error('無效玩家');
 if(!Number.isSafeInteger(c.sequence)||c.sequence!==state.sequence[c.playerId]+1)throw Error('重複或錯序命令');
 if(!Number.isSafeInteger(c.targetTick)||c.targetTick<=state.tick||c.targetTick>state.tick+200)throw Error('命令已過期或過遠');
 if(!c.payload)throw Error('缺少 payload');
 if(c.commandType==='move'||c.commandType==='stop'){
 const ids=c.payload.unitIds;
 if(!Array.isArray(ids)||!ids.length||ids.length>navigationRules.maxGroupSize||!ids.every((id,i)=>Number.isSafeInteger(id)&&(i===0||id>ids[i-1])))throw Error(`單位清單需為 1–${navigationRules.maxGroupSize} 個遞增且不重複的 ID`);
 for(const id of ids){const u=state.units.find(u=>u.id===id);if(!u||u.player!==c.playerId)throw Error('不可控制敵方或不存在的單位');}
 }
 if(c.commandType==='move'){
 for(const k of ['x','y'] as const)if(!Number.isSafeInteger(c.payload[k])||c.payload[k]<50||c.payload[k]>1550)throw Error('目標超出地圖');
 if(!clearSegment(state.map,c.payload,c.payload))throw Error('目標位於建築、資源或不可通行地形的占地內');
 }else if(c.commandType==='reserve'){if(!rules.entries.some(e=>e.id===c.payload.entryId))throw Error('未知預留內容');}
 else if(c.commandType==='cancelReservation'){if(typeof c.payload.reservationId!=='string'||!c.payload.reservationId.startsWith(`${c.playerId}:`))throw Error('不可取消敵方或無效的預留');}
 else throw Error('不支援的命令');
 const copy=structuredClone(c);delete (copy as Partial<LoggedCommand>).acceptedTick;state.queue.push(copy);state.queue.sort((a,b)=>a.targetTick-b.targetTick||a.playerId-b.playerId||a.sequence-b.sequence);state.log.push({...structuredClone(copy),acceptedTick:state.tick});state.sequence[c.playerId]=c.sequence;
}
// Returns observation-only counters (never stored in State or fed back into rules).
export function tick(s:State):{expanded:number} {
 s.tick++;
 s.queue.sort((a,b)=>a.targetTick-b.targetTick||a.playerId-b.playerId||a.sequence-b.sequence);
 while(s.queue.length&&s.queue[0].targetTick===s.tick){const c=s.queue.shift()!;
 if(c.commandType==='move'){commandMove(s,c.payload.unitIds,{x:c.payload.x,y:c.payload.y});continue;}
 if(c.commandType==='stop'){commandStop(s,c.payload.unitIds);continue;}
 {const result:TransactionResult={tick:s.tick,playerId:c.playerId,sequence:c.sequence,ok:true};try{if(c.commandType==='reserve')reserve(s.accounts[c.playerId],`${c.playerId}:${c.sequence}`,c.payload.entryId);else cancelReservation(s.accounts[c.playerId],c.payload.reservationId);}catch(e){result.ok=false;result.error=(e as Error).message;}s.transactions.push(result);continue;}
 }
 // Deterministic movement: shared search budget, node reservations, waiting and bounded replans.
 const stats=stepMovement(s);
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
export function serialize(s:State):string{if(s.tick>100000||s.log.length>10000)throw Error('已超過此階段沙盒存檔容量（100000 ticks / 10000 指令）');return JSON.stringify({format:'brick-sandbox-11',rulesetHash,state:s,checksum:hash(s)});}
export function deserialize(raw:string):State{
 const v=JSON.parse(raw);
 if(!v||v.format!=='brick-sandbox-11'||v.rulesetHash!==rulesetHash||!v.state||v.checksum!==hash(v.state))throw Error('存檔版本不符或內容損壞');
 const s=v.state as State;
 if(s.version!==11||!Number.isSafeInteger(s.tick)||s.tick<0||s.tick>100000||!Array.isArray(s.log)||s.log.length>10000)throw Error('無效存檔狀態');
 const rebuilt=replay(s.seed,s.log,s.tick,s.layout);
 if(hash(rebuilt)!==hash(s))throw Error('存檔狀態無法由命令重建');
 return structuredClone(s);
}
