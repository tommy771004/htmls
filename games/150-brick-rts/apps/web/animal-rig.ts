// Brick animals (rendering only): sheep, deer and boar built from the same bevelled boxes as everything else.
// Poses follow the character rig's names so the scene can drive both alike: walk swings the legs, attack lunges
// (the boar's charge), hit rocks the body. An owned sheep wears a collar in its owner's colour.
import type {UnitPose} from './unit-rig.ts';
type Part={x:number;y:number;z:number;w:number;h:number;d:number;color:string};
// Body, head and legs per kind (y = bottom of each part; the head faces +z like the villagers).
export const animalLooks={
 sheep:{legs:{h:.26,w:.09,x:.15,z:.2,color:'#4b4439'},body:[{x:0,y:.24,z:0,w:.52,h:.36,d:.7,color:'#ece6d2'},{x:0,y:.56,z:-.05,w:.4,h:.1,d:.52,color:'#f4efdf'}],
  head:[{x:0,y:.4,z:.42,w:.2,h:.22,d:.24,color:'#4b4439'},{x:-.12,y:.54,z:.4,w:.07,h:.04,d:.1,color:'#4b4439'},{x:.12,y:.54,z:.4,w:.07,h:.04,d:.1,color:'#4b4439'}],collar:{y:.36,z:.3}},
 deer:{legs:{h:.42,w:.08,x:.13,z:.24,color:'#8a643f'},body:[{x:0,y:.4,z:0,w:.36,h:.32,d:.76,color:'#a67a4c'},{x:0,y:.42,z:-.4,w:.12,h:.14,d:.06,color:'#efe6d2'}],
  head:[{x:0,y:.62,z:.36,w:.14,h:.3,d:.14,color:'#a67a4c'},{x:0,y:.86,z:.44,w:.16,h:.14,d:.24,color:'#a67a4c'},{x:-.08,y:1,z:.4,w:.03,h:.18,d:.03,color:'#d8c7a0'},{x:.08,y:1,z:.4,w:.03,h:.18,d:.03,color:'#d8c7a0'},{x:-.12,y:1.12,z:.4,w:.1,h:.03,d:.03,color:'#d8c7a0'},{x:.12,y:1.12,z:.4,w:.1,h:.03,d:.03,color:'#d8c7a0'}],collar:null},
 boar:{legs:{h:.22,w:.1,x:.16,z:.26,color:'#3f3226'},body:[{x:0,y:.2,z:0,w:.5,h:.42,d:.86,color:'#5d4a36'},{x:0,y:.62,z:.02,w:.14,h:.08,d:.6,color:'#3f3226'}],
  head:[{x:0,y:.26,z:.48,w:.34,h:.3,d:.24,color:'#5d4a36'},{x:0,y:.3,z:.66,w:.18,h:.14,d:.12,color:'#b89078'},{x:-.12,y:.32,z:.66,w:.04,h:.12,d:.04,color:'#f1ead6'},{x:.12,y:.32,z:.66,w:.04,h:.12,d:.04,color:'#f1ead6'}],collar:null},
} as const;
export type AnimalLook=keyof typeof animalLooks;
// A lying carcass (static world), by the food it started with: the brick body on its side, shrinking as it is eaten.
export function carcassParts(kind:AnimalLook,share:number):Part[]{const look=animalLooks[kind],s=.5+.5*Math.max(0,Math.min(1,share)),b=look.body[0];
 return [{x:-b.h*.6,y:0,z:-b.d*s/2,w:b.h*1.2,h:b.w*.55,d:b.d*s,color:b.color},{x:-.08,y:0,z:b.d*s/2,w:.16,h:.12,d:.16,color:look.head[0].color}];}
export function createAnimalRig(T:any,kind:AnimalLook,player:number,box:(w:number,h:number,d:number)=>any,material:(color:string)=>any){
 const look=animalLooks[kind],root=new T.Group();root.name=`animal-${kind}`;const body=new T.Group();root.add(body);
 const part=(parent:any,p:Part)=>{const m=new T.Mesh(box(p.w,p.h,p.d),material(p.color));m.position.set(p.x,p.y,p.z);m.castShadow=true;parent.add(m);return m;};
 for(const p of look.body)part(body,p);
 const head=new T.Group();head.position.set(0,0,0);body.add(head);for(const p of look.head)part(head,p);
 if(look.collar&&(player===0||player===1))part(body,{x:0,y:look.collar.y,z:look.collar.z,w:.46,h:.08,d:.08,color:player===0?'#45728c':'#b25441'});
 const legs:any[]=[];for(const sx of [-1,1])for(const sz of [-1,1]){const leg=new T.Group();leg.position.set(sx*look.legs.x,look.legs.h,sz*look.legs.z);root.add(leg);legs.push(leg);part(leg,{x:0,y:-look.legs.h,z:0,w:look.legs.w,h:look.legs.h,d:look.legs.w,color:look.legs.color});}
 function pose(kind:UnitPose,time:number){const t=Number.isFinite(time)?Math.max(0,time):0,swing=kind==='walk'?Math.sin(t*.016)*.45:0;
  legs.forEach((leg,i)=>{leg.rotation.x=(i===0||i===3?1:-1)*swing;});
  // Idle: the head dips to graze now and then; attack: a lunge; hit: the body rocks back.
  const graze=kind==='idle'?Math.max(0,Math.sin(t*.0017))*.35:0,lunge=kind==='attack'?Math.max(0,Math.sin(t*.012))*.18:0;
  head.rotation.x=graze;body.position.z=lunge;body.rotation.x=kind==='hit'&&t<300?-.2*Math.sin(Math.PI*t/300):0;root.rotation.z=0;}
 return {root,sockets:{leftHand:new T.Group(),rightHand:new T.Group()},equip:(_:string)=>{},dress:(_:string)=>{},pose};
}
