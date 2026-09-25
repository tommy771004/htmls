import {rules} from '../content/rules.ts';
export type Unit={id:number;player:number;x:number;y:number;target:{x:number;y:number}|null};
export type Command={protocolVersion:1;rulesetHash:string;playerId:number;sequence:number;targetTick:number;commandType:'move';payload:{unitId:number;x:number;y:number}};
export type State={version:1;seed:number;rng:number;tick:number;sequence:number[];units:Unit[];queue:Command[];log:Command[]};
function canonical(value:unknown):string {if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical((value as Record<string,unknown>)[k])).join(',')+'}';}
export function hash(value:unknown):string{let h=2166136261;for(const c of canonical(value)){h=Math.imul(h^c.charCodeAt(0),16777619);}return (h>>>0).toString(16).padStart(8,'0');}
export const rulesetHash=hash(rules);
export function createState(seed:number):State{if(!Number.isSafeInteger(seed)||seed<0||seed>4294967295)throw Error('seed 必須為 uint32');return {version:1,seed,rng:seed||1,tick:0,sequence:[0,0],units:[{id:1,player:0,x:350,y:600,target:null},{id:2,player:0,x:450,y:650,target:null},{id:3,player:0,x:400,y:750,target:null},{id:4,player:1,x:1150,y:600,target:null}],queue:[],log:[]};}
// xorshift32; renderers never advance this stream.
export function nextRandom(state:State):number{let n=state.rng;n^=n<<13;n^=n>>>17;n^=n<<5;state.rng=n>>>0;return state.rng;}
export function submit(state:State, c:Command):void {
 if(!c||c.protocolVersion!==1||c.rulesetHash!==rulesetHash)throw Error('命令版本不符');
 if(!Number.isSafeInteger(c.playerId)||c.playerId<0||c.playerId>1)throw Error('無效玩家');
 if(!Number.isSafeInteger(c.sequence)||c.sequence!==state.sequence[c.playerId]+1)throw Error('重複或錯序命令');
 if(!Number.isSafeInteger(c.targetTick)||c.targetTick<=state.tick||c.targetTick>state.tick+200)throw Error('命令已過期或過遠');
 if(c.commandType!=='move'||!c.payload)throw Error('不支援的命令');
 const u=state.units.find(u=>u.id===c.payload.unitId);
 if(!u||u.player!==c.playerId)throw Error('不可控制敵方單位');
 for(const k of ['x','y'] as const)if(!Number.isSafeInteger(c.payload[k])||c.payload[k]<50||c.payload[k]>1550)throw Error('目標超出地圖');
 const copy=structuredClone(c);state.queue.push(copy);state.queue.sort((a,b)=>a.targetTick-b.targetTick||a.playerId-b.playerId||a.sequence-b.sequence);state.log.push(structuredClone(copy));state.sequence[c.playerId]=c.sequence;
}
export function tick(s:State):void {
 s.tick++;
 s.queue.sort((a,b)=>a.targetTick-b.targetTick||a.playerId-b.playerId||a.sequence-b.sequence);
 while(s.queue.length&&s.queue[0].targetTick===s.tick){const c=s.queue.shift()!;s.units.find(u=>u.id===c.payload.unitId)!.target={x:c.payload.x,y:c.payload.y};}
 for(const u of s.units)if(u.target){u.x+=Math.sign(u.target.x-u.x)*Math.min(5,Math.abs(u.target.x-u.x));u.y+=Math.sign(u.target.y-u.y)*Math.min(5,Math.abs(u.target.y-u.y));if(u.x===u.target.x&&u.y===u.target.y)u.target=null;}
}
export function replay(seed:number,commands:Command[],ticks:number):State{
 const s=createState(seed);const pending=structuredClone(commands).sort((a,b)=>a.targetTick-b.targetTick||a.playerId-b.playerId||a.sequence-b.sequence);
 // Restore accepted commands and per-player sequence; execution order is defined by tick().
 for(const c of [...pending].sort((a,b)=>a.playerId-b.playerId||a.sequence-b.sequence)) {const original=s.tick;s.tick=Math.max(0,c.targetTick-1);submit(s,c);s.tick=original;}
 for(let i=0;i<ticks;i++)tick(s);
 // Preserve original admission order in the authoritative log.
 s.log=structuredClone(commands);
 return s;
}
export function serialize(s:State):string{if(s.tick>100000||s.log.length>10000)throw Error('已超過此階段沙盒存檔容量（100000 ticks / 10000 指令）');return JSON.stringify({format:'brick-sandbox-1',rulesetHash,state:s,checksum:hash(s)});}
export function deserialize(raw:string):State{
 const v=JSON.parse(raw);
 if(!v||v.format!=='brick-sandbox-1'||v.rulesetHash!==rulesetHash||!v.state||v.checksum!==hash(v.state))throw Error('存檔版本不符或內容損壞');
 const s=v.state as State;
 if(s.version!==1||!Number.isSafeInteger(s.tick)||s.tick<0||s.tick>100000||!Array.isArray(s.log)||s.log.length>10000)throw Error('無效存檔狀態');
 const rebuilt=replay(s.seed,s.log,s.tick);
 if(hash(rebuilt)!==hash(s))throw Error('存檔狀態無法由命令重建');
 return structuredClone(s);
}
