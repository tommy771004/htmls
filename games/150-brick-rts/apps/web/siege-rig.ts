// Brick battering ram (rendering only): a timber frame on four wheels under a team-coloured roof, with the ram log
// swinging out at the front when it strikes. Same interface as the character and animal rigs.
import type {UnitPose} from './unit-rig.ts';
export function createRamRig(T:any,player:number,box:(w:number,h:number,d:number)=>any,material:(color:string)=>any){
 const root=new T.Group();root.name='siege-ram';const team=player===0?'#45728c':'#b25441',wood='#94734c',dark='#6e5438';
 const part=(parent:any,x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const m=new T.Mesh(box(w,h,d),material(color));m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};
 part(root,0,.22,0,.76,.1,1.3,dark);
 for(const x of [-.36,.36])for(const z of [-.45,.45])part(root,x,0,z,.1,.36,.36,'#5c4a36');
 for(const x of [-.3,.3])part(root,x,.32,0,.1,.55,1.2,wood);
 part(root,0,.86,0,.86,.1,1.36,team);part(root,0,.96,0,.5,.1,1.36,team);
 const log=new T.Group();root.add(log);part(log,0,.4,.2,.24,.24,1.2,'#8a6a45');part(log,0,.38,.82,.3,.28,.12,'#6b6f6c');
 function pose(kind:UnitPose,time:number){const t=Number.isFinite(time)?Math.max(0,time):0;
  log.position.z=kind==='attack'?Math.max(0,Math.sin(t*.008))*.25:0;root.rotation.x=kind==='walk'?Math.sin(t*.02)*.015:kind==='hit'&&t<300?-.05*Math.sin(Math.PI*t/300):0;}
 return {root,sockets:{leftHand:new T.Group(),rightHand:new T.Group()},equip:(_:string)=>{},dress:(_:string)=>{},pose};
}
