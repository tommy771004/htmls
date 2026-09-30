import {createUnitRig} from './unit-rig.ts';
import type {UnitRole,UnitPose,UnitTool} from './unit-rig.ts';
import {createElephantMount} from './elephant-rig.ts';
// Mounted dresses: which rider dress and weapon sit in the saddle and what the mount looks like. 'cavalry' is the
// scout and knight (unchanged); the unique riders recolour the same horse (the cataphract adds barding); the war
// elephant swaps the horse for a brick elephant with a howdah as the saddle.
export const mountedRoles=['cavalry','cataphract','mameluke','mangudai','war-elephant'] as const;
export type MountedRole=typeof mountedRoles[number];
export const isMounted=(role:string):role is MountedRole=>(mountedRoles as readonly string[]).includes(role);
type HorseLook={coat:string;head:string;mane:string;barding:boolean};
export const mounts:Record<MountedRole,{rider:UnitRole;tool:UnitTool;horse:HorseLook|null}>={
 cavalry:{rider:'swordsman',tool:'spear',horse:{coat:'#957350',head:'#a5835b',mane:'#64533d',barding:false}},
 cataphract:{rider:'cataphract-rider',tool:'spear',horse:{coat:'#6f5a44',head:'#7c6550',mane:'#3e3326',barding:true}},
 mameluke:{rider:'mameluke-rider',tool:'scimitar',horse:{coat:'#d6cdb9',head:'#e0d8c6',mane:'#8b8374',barding:false}},
 mangudai:{rider:'mangudai-rider',tool:'bow',horse:{coat:'#7a5b3c',head:'#8a6a48',mane:'#3e3326',barding:false}},
 'war-elephant':{rider:'mahout',tool:'spear',horse:null},
};
export function createCharacterRig(T:any,player:number,box:(w:number,h:number,d:number)=>any,material:(color:string)=>any){
 const root=new T.Group(),rider=createUnitRig(T,player,box,material);root.add(rider.root);
 const team=player===0?'#45728c':'#b25441';
 let horse:any=null,saddle:any=null,barding:any=null,mounted:MountedRole|null=null,elephant:ReturnType<typeof createElephantMount>|null=null;const legs:any[]=[];
 // Horse meshes by tint, so a unique rider's mount is recoloured in place (materials are shared per colour).
 const tints:Record<'coat'|'head'|'mane',any[]>={coat:[],head:[],mane:[]};
 const part=(parent:any,x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const m=new T.Mesh(box(w,h,d),material(color));m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};
 function makeHorse(){horse=new T.Group();horse.name='horse-root';root.add(horse);
  tints.coat.push(part(horse,0,.62,0,.56,.5,1.15,'#957350'),part(horse,0,.82,.43,.36,.65,.32,'#957350'));
  tints.head.push(part(horse,0,1.22,.61,.38,.28,.52,'#a5835b'));tints.mane.push(part(horse,0,1.5,.5,.3,.14,.12,'#64533d'));
  for(const x of [-.2,.2])part(horse,x,1.39,.67,.03,.04,.05,'#2f3932');
  tints.mane.push(part(horse,0,.72,-.66,.16,.4,.15,'#64533d'));
  part(horse,0,1.12,0,.68,.08,.5,team);
  for(const x of [-.19,.19])for(const z of [-.42,.42]){const leg=new T.Group();leg.name=`horse-leg-${legs.length}`;leg.position.set(x,.62,z);horse.add(leg);legs.push(leg);tints.coat.push(part(leg,0,-.62,0,.15,.62,.17,'#957350'));part(leg,0,-.62,.025,.18,.12,.22,'#514b3c');}
  saddle=new T.Group();saddle.name='rider-saddle';saddle.position.set(0,.9,-.05);horse.add(saddle);
 }
 // Cataphract barding: steel scale over body and neck, a chamfron on the face, a team hem along the bottom.
 function makeBarding(){barding=new T.Group();barding.name='horse-barding';horse.add(barding);const steel='#8f9896';
  part(barding,0,.58,0,.6,.42,1.19,steel);part(barding,0,.56,0,.62,.06,1.21,team);part(barding,0,.84,.43,.4,.5,.36,steel);part(barding,0,1.24,.86,.3,.24,.04,steel);part(barding,0,1.48,.5,.06,.16,.06,team);}
 function dress(role:UnitRole|MountedRole){
  const next=isMounted(role)?role:null;mounted=next;
  if(next){const look=mounts[next];
   if(look.horse){if(!horse)makeHorse();horse.visible=true;if(elephant)elephant.root.visible=false;
    for(const k of ['coat','head','mane'] as const)for(const m of tints[k])m.material=material(look.horse[k]);
    if(look.horse.barding&&!barding)makeBarding();if(barding)barding.visible=look.horse.barding;saddle.add(rider.root);}
   else{if(!elephant){elephant=createElephantMount(T,player,box,material);root.add(elephant.root);}elephant.root.visible=true;if(horse)horse.visible=false;elephant.saddle.add(rider.root);}
   rider.dress(look.rider);rider.equip(look.tool);}
  else{if(horse)horse.visible=false;if(elephant)elephant.root.visible=false;root.add(rider.root);rider.dress(role as UnitRole);}
  rider.seat(!!next);pose('idle',0);
 }
 function pose(kind:UnitPose,time:number){
  if(mounted&&!['idle','walk','attack'].includes(kind))throw Error('騎乘模型目前僅支援待命、行走與攻擊姿態');
  rider.pose(kind,time);
  if(horse){const phase=Number.isFinite(time)?Math.max(0,time)*.012:0,walking=mounted&&mounted!=='war-elephant'&&kind==='walk';legs.forEach((leg,i)=>{const swing=walking?Math.sin(phase+(i===0||i===3?0:Math.PI))*.26:0;leg.rotation.x=swing;leg.position.y=.62+Math.abs(Math.sin(swing))*.14;});}
  if(elephant)elephant.pose(mounted==='war-elephant'?kind:'idle',time);
 }
 return {root,sockets:rider.sockets,equip:rider.equip,dress,pose};
}
