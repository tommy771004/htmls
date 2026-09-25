import {createService} from '../../packages/sim/protocol.ts';
const handle=createService();
// Dedicated worker uses the same deterministic service as the headless tests.
const scope=globalThis as unknown as {onmessage:(event:MessageEvent)=>void;postMessage:(value:unknown,transfer:Transferable[])=>void};
scope.onmessage=event=>{const response=handle(event.data);scope.postMessage(response,response.ok?[response.positions]:[]);};
