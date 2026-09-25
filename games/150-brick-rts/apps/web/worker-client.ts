import {decodeView} from '../../packages/sim/protocol.ts';
import type {Operation,Recovery,Response,View} from '../../packages/sim/protocol.ts';
type Success=Extract<Response,{ok:true}>;
export class SimulationClient{
 private worker:Worker|null=null;
 private counter=0;
 private pending=new Map<number,{resolve:(r:Success)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 private checkpoint:Recovery;
 private ready=false;
 constructor(seed:number,private update:(v:View)=>void,private failure:(reason:string)=>void){this.checkpoint={seed,commands:[],ticks:0};}
 async connect(){
  this.worker?.terminate();this.ready=false;
  try{this.worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});}
  catch(e){this.fail((e as Error).message);throw e;}
  this.worker.onmessage=event=>{
   const response=event.data as Response;
   if(response?.protocol!==1||!this.pending.has(response.id)){this.fail('Worker 回應協定不符');return;}
   const item=this.pending.get(response.id)!;clearTimeout(item.timer);this.pending.delete(response.id);
   if(!response.ok){item.reject(Error(`tick ${response.tick} / request ${response.id}${response.entityId!==undefined?' / entity '+response.entityId:''}：${response.message}`));return;}
   if(response.commands)this.checkpoint.commands=response.commands;
   if(response.accepted)this.checkpoint.commands.push(response.accepted);
   this.checkpoint.layout=response.layout;this.checkpoint.seed=response.seed;this.checkpoint.ticks=response.tick;
   this.update(decodeView(response));item.resolve(response);
  };
  this.worker.onerror=event=>{event.preventDefault();this.fail('Worker 載入或執行失敗');};
  this.worker.onmessageerror=()=>this.fail('Worker 資料解碼失敗');
  try{await this.send({kind:'recover',checkpoint:structuredClone(this.checkpoint)});this.ready=true;}
  catch(e){this.fail((e as Error).message);throw e;}
 }
 private fail(reason:string){
  this.ready=false;this.worker?.terminate();this.worker=null;
  for(const item of this.pending.values()){clearTimeout(item.timer);item.reject(Error(reason));}this.pending.clear();
  this.failure(`${reason}；已暫停，可重試恢復至最後確認的 tick ${this.checkpoint.ticks}。未確認指令不會自動重送。`);
 }
 private send(operation:Operation):Promise<Success>{
  return new Promise((resolve,reject)=>{
   if(!this.worker){reject(Error('Worker 尚未連線'));return;}
   const id=++this.counter;
   const timer=setTimeout(()=>this.fail('Worker 超過 5 秒未回應'),5000);
   this.pending.set(id,{resolve,reject,timer});
   try{this.worker.postMessage({protocol:1,id,operation});}catch(e){this.fail((e as Error).message);}
  });
 }
 request(operation:Operation){if(!this.ready)return Promise.reject(Error('請先恢復模擬連線'));return this.send(operation);}
}
