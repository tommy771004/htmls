import {createUnitRig} from './unit-rig.ts';
import type {UnitRole,UnitPose} from './unit-rig.ts';
export function createCharacterRig(T:any,player:number,box:(w:number,h:number,d:number)=>any,material:(color:string)=>any){
 const root=new T.Group(),rider=createUnitRig(T,player,box,material);root.add(rider.root);
 let horse:any=null,saddle:any=null,mounted=false;const legs:any[]=[];
 const part=(parent:any,x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const m=new T.Mesh(box(w,h,d),material(color));m.position.set(x,y,z);m.castShadow=true;parent.add(m);};
 function makeHorse(){horse=new T.Group();horse.name='horse-root';root.add(horse);
  part(horse,0,.62,0,.56,.5,1.15,'#957350');part(horse,0,.82,.43,.36,.65,.32,'#957350');
  part(horse,0,1.22,.61,.38,.28,.52,'#a5835b');part(horse,0,1.5,.5,.3,.14,.12,'#64533d');
  for(const x of [-.2,.2])part(horse,x,1.39,.67,.03,.04,.05,'#2f3932');
  part(horse,0,.72,-.66,.16,.4,.15,'#64533d');
  part(horse,0,1.12,0,.68,.08,.5,player===0?'#45728c':'#b25441');
  for(const x of [-.19,.19])for(const z of [-.42,.42]){const leg=new T.Group();leg.name=`horse-leg-${legs.length}`;leg.position.set(x,.62,z);horse.add(leg);legs.push(leg);part(leg,0,-.62,0,.15,.62,.17,'#957350');part(leg,0,-.62,.025,.18,.12,.22,'#514b3c');}
  saddle=new T.Group();saddle.name='rider-saddle';saddle.position.set(0,.9,-.05);horse.add(saddle);
 }
 function dress(role:UnitRole|'cavalry'){
  mounted=role==='cavalry';if(mounted){if(!horse)makeHorse();horse.visible=true;saddle.add(rider.root);rider.dress('swordsman');rider.equip('spear');}
  else{if(horse)horse.visible=false;root.add(rider.root);rider.dress(role as UnitRole);}
  rider.seat(mounted);pose('idle',0);
 }
 function pose(kind:UnitPose,time:number){
  if(mounted&&!['idle','walk','attack'].includes(kind))throw Error('騎乘模型目前僅支援待命、行走與攻擊姿態');
  rider.pose(kind,time);
  if(horse){const phase=Number.isFinite(time)?Math.max(0,time)*.012:0;legs.forEach((leg,i)=>{const swing=mounted&&kind==='walk'?Math.sin(phase+(i===0||i===3?0:Math.PI))*.26:0;leg.rotation.x=swing;leg.position.y=.62+Math.abs(Math.sin(swing))*.14;});}
 }
 return {root,sockets:rider.sockets,equip:rider.equip,dress,pose};
}
