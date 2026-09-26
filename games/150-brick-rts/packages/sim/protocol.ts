import type {ResourceNode,MapLayout,Tile} from './terrain.ts';
import {projectVision,unitVisible} from './vision.ts';
import type {KnownObstacle} from './vision.ts';
import {createState,submit,tick,hash,replay,serialize,deserialize,rulesetHash} from './sim.ts';
import {faithOf,carrying} from './religion.ts';
import type {LoggedCommand,Opponent} from './sim.ts';
import {navigationStates,unitKinds} from './movement.ts';
import type {UnitKind} from './movement.ts';
import {workPhases} from './work.ts';
import {resourceDefinitions} from './terrain.ts';
import {obstacleBounds} from '../content/footprints.ts';
import type {WorkPhase} from './work.ts';
import {resources} from '../content/rules.ts';
import type {Resource} from '../content/rules.ts';
import type {Stock} from './economy.ts';
import type {BuildKind} from './buildings.ts';
import type {Corpse,Outcome,Target} from './combat.ts';
import {combatRules,maxHpOf} from './stats.ts';
import {tileAt} from './terrain.ts';
import type {Navigation} from './movement.ts';
// Render projection of a unit; internal path/reservation fields stay in the Worker.
// action: 0 none, 1 attacking (fired within the last 10 ticks), 2 hit within combatRules.hitFlashTicks.
// relic: a monk carrying a relic (any visible monk).
// rite: a monk's current work (null, converting or healing, shown for any visible monk); faith: own monks only, 0-100.
export type UnitView={kind:UnitKind;hp:number;maxHp:number;action:number;id:number;player:number;x:number;y:number;navigation:Navigation;target:{x:number;y:number}|null;work:WorkPhase|null;workResource:Resource|null;cargo:{resource:Resource;amount:number}|null;rite:'convert'|'heal'|null;faith:number|null;relic:boolean};
// Own account only; the enemy's stock is never projected.
export type EconomyView={stock:Stock;populationUsed:number;populationReserved:number;populationCap:number;age:number;techs:string[]};
// Own buildings with exact progress, and recent own transaction outcomes (orders that failed at execution).
export type BuildingView={id:string;kind:string;x:number;y:number;work:number;required:number;complete:boolean;hp:number;maxHp:number;queue:{id:number;entryId:string;work:number;required:number}[];rally:{x:number;y:number}|null;relics:number};
// Relics: ground relics the player can see or remembers, how many each side holds in its monasteries (public, as on
// the reference's score line) and the relic-victory countdown, which both sides are told about.
export type RelicView={relicSpots:{id:number;x:number;y:number}[];relicsHeld:number[];relicTotal:number;relicVictory:{player:number;endsTick:number}|null};
export type TransactionView={sequence:number;tick:number;ok:boolean;error?:string};
export type Recovery={seed:number;layout?:MapLayout;opponent?:Opponent;commands:LoggedCommand[];ticks:number};
export type Operation={kind:'convert'|'heal';unitIds:number[];targetId?:number;buildingId?:string}|{kind:'relic';unitIds:number[];relicId:number}|{kind:'deposit';unitIds:number[];buildingId:string}|{kind:'resign'}|{kind:'attack';unitIds:number[];target:Target}|{kind:'move';unitIds:number[];x:number;y:number}|{kind:'stop';unitIds:number[]}|{kind:'gather';unitIds:number[];resourceId:string}|{kind:'build';unitIds:number[];building:BuildKind;x:number;y:number}|{kind:'construct';unitIds:number[];buildingId:string}|{kind:'cancelBuild';buildingId:string}|{kind:'train';buildingId:string;entryId:string}|{kind:'cancelTrain';buildingId:string;itemId:number}|{kind:'rally';buildingId:string;x:number;y:number}|{kind:'advance';count:number}|{kind:'reset';seed:number;layout?:MapLayout;opponent?:Opponent}|{kind:'restore';snapshot:string}|{kind:'snapshot'}|{kind:'replay'}|{kind:'recover';checkpoint:Recovery};
export type Request={protocol:1;id:number;operation:Operation};
export type View={seed:number;layout:MapLayout;size:number;opponent:Opponent;terrain:Omit<Tile,'id'|'resourceRefs'|'obstacleRefs'>[];tick:number;units:UnitView[];economy:EconomyView;corpses:Corpse[];outcome:Outcome|null;buildings:BuildingView[];transactions:TransactionView[];fog:number[];known:KnownObstacle[];resources:ResourceNode[];stateHash:string}&RelicView;
export type Response={protocol:1;id:number;ok:true;seed:number;layout:MapLayout;size:number;opponent:Opponent;terrain:View['terrain'];tick:number;stateHash:string;positions:ArrayBuffer;economy:EconomyView;corpses:Corpse[];outcome:Outcome|null;buildings:BuildingView[];transactions:TransactionView[];fog:number[];known:KnownObstacle[];resources:ResourceNode[];accepted?:LoggedCommand;relicSpots:RelicView['relicSpots'];relicsHeld:number[];relicTotal:number;relicVictory:RelicView['relicVictory'];commands?:LoggedCommand[];snapshot?:string;replayMatches?:boolean}|{protocol:1;id:number;ok:false;tick:number;message:string;entityId?:number};
// Int32 fields per unit in Response.positions; tests/browser.mjs decodes raw buffers with the same number.
export const UNIT_STRIDE=18;const STRIDE=UNIT_STRIDE;
export function decodeView(r:Extract<Response,{ok:true}>):View{
 const values=new Int32Array(r.positions),units:UnitView[]=[];
 for(let i=0;i<values.length;i+=STRIDE)units.push({kind:unitKinds[values[i+11]],hp:values[i+12],maxHp:values[i+13],action:values[i+14],id:values[i],player:values[i+1],x:values[i+2],y:values[i+3],navigation:navigationStates[values[i+6]],target:values[i+4]<0?null:{x:values[i+4],y:values[i+5]},work:values[i+7]>0?workPhases[values[i+7]] as WorkPhase:null,workResource:values[i+10]<0?null:resources[values[i+10]],cargo:values[i+8]<0?null:{resource:resources[values[i+8]],amount:values[i+9]},rite:([null,'convert','heal'] as const)[values[i+15]]??null,faith:values[i+16]<0?null:values[i+16],relic:values[i+17]===1});
 return {seed:r.seed,layout:r.layout,size:r.size,opponent:r.opponent,terrain:r.terrain,tick:r.tick,stateHash:r.stateHash,economy:r.economy,corpses:r.corpses,outcome:r.outcome,buildings:r.buildings,transactions:r.transactions,fog:r.fog,known:r.known,resources:r.resources,relicSpots:r.relicSpots,relicsHeld:r.relicsHeld,relicTotal:r.relicTotal,relicVictory:r.relicVictory,units};
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
    case 'convert':case 'heal':case 'relic':case 'deposit':case 'resign':case 'attack':case 'move':case 'stop':case 'gather':case 'build':case 'construct':case 'cancelBuild':case 'train':case 'cancelTrain':case 'rally':
     if(state.log.length>=10000)throw Error('已達沙盒 10000 指令上限，請儲存或重建');
     {const envelope={acceptedTick:state.tick,protocolVersion:1 as const,rulesetHash,playerId:0,sequence:state.sequence[0]+1,targetTick:state.tick+1};
     const command:LoggedCommand=op.kind==='convert'||op.kind==='heal'?{...envelope,commandType:op.kind,payload:op.buildingId!==undefined?{unitIds:op.unitIds,buildingId:op.buildingId}:{unitIds:op.unitIds,targetId:op.targetId}}:op.kind==='relic'?{...envelope,commandType:'relic',payload:{unitIds:op.unitIds,relicId:op.relicId}}:op.kind==='deposit'?{...envelope,commandType:'deposit',payload:{unitIds:op.unitIds,buildingId:op.buildingId}}:op.kind==='resign'?{...envelope,commandType:'resign',payload:{}}:op.kind==='attack'?{...envelope,commandType:'attack',payload:{unitIds:op.unitIds,target:op.target}}:op.kind==='move'?{...envelope,commandType:'move',payload:{unitIds:op.unitIds,x:op.x,y:op.y}}:op.kind==='gather'?{...envelope,commandType:'gather',payload:{unitIds:op.unitIds,resourceId:op.resourceId}}:op.kind==='build'?{...envelope,commandType:'build',payload:{unitIds:op.unitIds,kind:op.building,x:op.x,y:op.y}}:op.kind==='construct'?{...envelope,commandType:'construct',payload:{unitIds:op.unitIds,buildingId:op.buildingId}}:op.kind==='cancelBuild'?{...envelope,commandType:'cancelBuild',payload:{buildingId:op.buildingId}}:op.kind==='train'?{...envelope,commandType:'train',payload:{buildingId:op.buildingId,entryId:op.entryId}}:op.kind==='cancelTrain'?{...envelope,commandType:'cancelTrain',payload:{buildingId:op.buildingId,itemId:op.itemId}}:op.kind==='rally'?{...envelope,commandType:'rally',payload:{buildingId:op.buildingId,x:op.x,y:op.y}}:{...envelope,commandType:'stop',payload:{unitIds:op.unitIds}};
     submit(state,command);accepted=command;}break;
    case 'advance':
     // Up to 80 ticks per request: one second of play at 4x, so a slow frame never starves the fastest speed.
     if(!Number.isSafeInteger(op.count)||op.count<1||op.count>80||state.tick+op.count>100000)throw Error('步進需為 1–80 ticks，總量不得超過 100000');
     for(let i=0;i<op.count;i++)tick(state);break;
    case 'reset':state=createState(op.seed,op.layout,op.opponent);commands=[];break;
    case 'restore':state=deserialize(op.snapshot);commands=structuredClone(state.log);break;
    case 'recover':{
     if(!op.checkpoint)throw Error('缺少恢復點');
     const candidate=replay(op.checkpoint.seed,op.checkpoint.commands,op.checkpoint.ticks,op.checkpoint.layout,op.checkpoint.opponent);
     state=candidate;commands=structuredClone(state.log);break;
    }
    case 'snapshot':snapshot=serialize(state);break;
    case 'replay':replayMatches=hash(replay(state.seed,state.log,state.tick,state.layout,state.opponent))===hash(state);break;
    default:throw Error('不支援的 operation');
   }
   const visibleUnits=state.units.filter(u=>unitVisible(state.vision[0],u,0,state.map.size));
   const positions=new Int32Array(visibleUnits.length*STRIDE);
   // Work and cargo are only projected for own units; enemy villagers show position and movement only.
   visibleUnits.forEach((u,i)=>{const own=u.player===0,w=own?state.works[u.id]:undefined,c=own?state.cargo[u.id]:undefined;
    // While gathering, the target slot carries the resource footprint centre so the renderer can face it.
    const src=w?.kind==='gather'&&w.phase==='gathering'?state.map.resources.find(r=>r.id===w.resourceId):undefined,box=src?.obstacleId?state.map.obstacles.find(o=>o.id===src.obstacleId):undefined,[bx0,by0,bx1,by1]=box?obstacleBounds(box):[0,0,0,0];
    // While fighting, the target slot carries the victim's position (unit centre or footprint centre).
    const fight=state.attacks[u.id],foe=fight?.target.kind==='unit'?state.units.find(v=>v.id===fight.target.id):undefined,site=fight?.target.kind==='building'?state.map.obstacles.find(o=>o.id===fight.target.id):undefined,sb=site?obstacleBounds(site):null;
    // A monk at work faces the unit it converts or heals.
    const flock=state.rites[u.id]?state.units.find(v=>v.id===state.rites[u.id].target):undefined;
    const target=box?{x:Math.round((bx0+bx1)/2),y:Math.round((by0+by1)/2)}:foe?{x:foe.x,y:foe.y}:flock?{x:flock.x,y:flock.y}:sb?{x:Math.round((sb[0]+sb[2])/2),y:Math.round((sb[1]+sb[3])/2)}:u.target;
    const rite=state.rites[u.id],action=fight&&fight.firedTick>=0&&state.tick-fight.firedTick<10?1:u.hitTick>=0&&state.tick-u.hitTick<combatRules.hitFlashTicks?2:0;
    positions.set([u.id,u.player,u.x,u.y,target?.x??-1,target?.y??-1,navigationStates.indexOf(u.navigation),w?workPhases.indexOf(w.phase):0,c?resources.indexOf(c.resource):-1,c?.amount??0,w?.kind==='gather'?resources.indexOf(resourceDefinitions[state.map.resources.find(r=>r.id===w.resourceId)!.kind].yield):-1,unitKinds.indexOf(u.kind),u.hp,maxHpOf(u.kind,state.techs[u.player]),action,rite?.kind==='convert'?1:rite?.kind==='heal'?2:0,own&&u.kind==='monk'?Math.floor(faithOf(state,u.id)*100):-1,carrying(state,u.id)?1:0],i*STRIDE);});
   const account=state.accounts[0],economy:EconomyView={stock:{...account.stock},populationUsed:account.populationUsed,populationReserved:account.populationReserved,populationCap:account.populationCap,age:state.ages[0],techs:[...state.techs[0]]};
   return {protocol:1,id:req.id,ok:true,seed:state.seed,layout:state.layout,size:state.map.size,opponent:state.opponent,terrain:state.map.tiles.map(({terrainType,height,walkClass,buildability})=>({terrainType,height,walkClass,buildability})),tick:state.tick,stateHash:hash(state),positions:positions.buffer,economy,corpses:state.corpses.filter(c=>c.player===0||state.vision[0].visible.includes(tileAt(c.x,c.y,state.map.size))).map(c=>({...c})),outcome:state.outcome?{...state.outcome}:null,buildings:state.buildings.filter(b=>b.player===0).map(({id,kind,x,y,work,required,complete,queue,rally,hp,maxHp})=>({id,kind,x,y,work,required,complete,hp,maxHp,queue:queue.map(({id,entryId,work,required})=>({id,entryId,work,required})),rally,relics:state.relics.filter(r=>r.monastery===id).length})),relicSpots:state.relicMemory[0].map(r=>({...r})),relicsHeld:[0,1].map(p=>state.relics.filter(r=>r.monastery!==null&&state.buildings.find(b=>b.id===r.monastery)?.player===p).length),relicTotal:state.relics.length,relicVictory:state.relicVictory?{...state.relicVictory}:null,transactions:state.transactions.filter(t=>t.playerId===0).slice(-5).map(({sequence,tick,ok,error})=>({sequence,tick,ok,...(error?{error}:{})})),...projectVision(state.vision[0],state.map.size),accepted,commands,snapshot,replayMatches};
  }catch(error){return {protocol:1,id:Number.isSafeInteger(req?.id)?req.id:0,ok:false,tick:state.tick,message:(error as Error).message,entityId:['attack','move','stop','gather','build','construct','convert','heal','relic','deposit'].includes(req?.operation?.kind as string)?(req.operation as {unitIds?:number[]}).unitIds?.[0]:undefined};}
 };
}
