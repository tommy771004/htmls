import type {ResourceNode,MapLayout,Tile} from './terrain.ts';
import {projectVision,unitVisible} from './vision.ts';
import type {KnownObstacle} from './vision.ts';
import {createState,submit,tick,hash,replay,serialize,deserialize,rulesetHash} from './sim.ts';
import type {Command,LoggedCommand,Unit} from './sim.ts';
export type Recovery={seed:number;layout?:MapLayout;commands:LoggedCommand[];ticks:number};
export type Operation={kind:'move';unitId:number;x:number;y:number}|{kind:'advance';count:number}|{kind:'reset';seed:number;layout?:MapLayout}|{kind:'restore';snapshot:string}|{kind:'snapshot'}|{kind:'replay'}|{kind:'recover';checkpoint:Recovery};
export type Request={protocol:1;id:number;operation:Operation};
export type View={seed:number;layout:MapLayout;terrain:Omit<Tile,'id'|'resourceRefs'|'obstacleRefs'>[];tick:number;units:Unit[];fog:number[];known:KnownObstacle[];resources:ResourceNode[];stateHash:string};
export type Response={protocol:1;id:number;ok:true;seed:number;layout:MapLayout;terrain:View['terrain'];tick:number;stateHash:string;positions:ArrayBuffer;fog:number[];known:KnownObstacle[];resources:ResourceNode[];accepted?:LoggedCommand;commands?:LoggedCommand[];snapshot?:string;replayMatches?:boolean}|{protocol:1;id:number;ok:false;tick:number;message:string;entityId?:number};
export function decodeView(r:Extract<Response,{ok:true}>):View{
 const values=new Int32Array(r.positions),units:Unit[]=[];
 for(let i=0;i<values.length;i+=7)units.push({id:values[i],player:values[i+1],x:values[i+2],y:values[i+3],navigation:(['idle','searching','moving','unreachable'] as const)[values[i+6]],target:values[i+4]<0?null:{x:values[i+4],y:values[i+5]}});
 return {seed:r.seed,layout:r.layout,terrain:r.terrain,tick:r.tick,stateHash:r.stateHash,fog:r.fog,known:r.known,resources:r.resources,units};
}
// This service owns state. DOM, clocks, rendering and transport never decide rules.
export function createService(){
 let state=createState(260925),lastId=0;
 return (raw:unknown):Response=>{
  const req=raw as Request;
  try{
   if(!req||req.protocol!==1||!Number.isSafeInteger(req.id)||req.id<=lastId)throw Error('訊息版本或 request ID 無效');
   lastId=req.id;
   const op=req.operation;if(!op||typeof op.kind!=='string')throw Error('缺少 operation');
   let accepted:LoggedCommand|undefined,commands:LoggedCommand[]|undefined,snapshot:string|undefined,replayMatches:boolean|undefined;
   switch(op.kind){
    case 'move':
     if(state.log.length>=10000)throw Error('已達沙盒 10000 指令上限，請儲存或重建');
     accepted={acceptedTick:state.tick,protocolVersion:1,rulesetHash,playerId:0,sequence:state.sequence[0]+1,targetTick:state.tick+1,commandType:'move',payload:{unitId:op.unitId,x:op.x,y:op.y}};
     submit(state,accepted);break;
    case 'advance':
     if(!Number.isSafeInteger(op.count)||op.count<1||op.count>20||state.tick+op.count>100000)throw Error('步進需為 1–20 ticks，總量不得超過 100000');
     for(let i=0;i<op.count;i++)tick(state);break;
    case 'reset':state=createState(op.seed,op.layout);commands=[];break;
    case 'restore':state=deserialize(op.snapshot);commands=structuredClone(state.log);break;
    case 'recover':{
     if(!op.checkpoint)throw Error('缺少恢復點');
     const candidate=replay(op.checkpoint.seed,op.checkpoint.commands,op.checkpoint.ticks,op.checkpoint.layout);
     state=candidate;commands=structuredClone(state.log);break;
    }
    case 'snapshot':snapshot=serialize(state);break;
    case 'replay':replayMatches=hash(replay(state.seed,state.log,state.tick,state.layout))===hash(state);break;
    default:throw Error('不支援的 operation');
   }
   const visibleUnits=state.units.filter(u=>unitVisible(state.vision[0],u,0));
   const positions=new Int32Array(visibleUnits.length*7);
   visibleUnits.forEach((u,i)=>positions.set([u.id,u.player,u.x,u.y,u.target?.x??-1,u.target?.y??-1,['idle','searching','moving','unreachable'].indexOf(u.navigation??'idle')],i*7));
   return {protocol:1,id:req.id,ok:true,seed:state.seed,layout:state.layout,terrain:state.map.tiles.map(({terrainType,height,walkClass,buildability})=>({terrainType,height,walkClass,buildability})),tick:state.tick,stateHash:hash(state),positions:positions.buffer,...projectVision(state.vision[0]),accepted,commands,snapshot,replayMatches};
  }catch(error){return {protocol:1,id:Number.isSafeInteger(req?.id)?req.id:0,ok:false,tick:state.tick,message:(error as Error).message,entityId:req?.operation?.kind==='move'?req.operation.unitId:undefined};}
 };
}
