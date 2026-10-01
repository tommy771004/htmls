// Brick riding camel (rendering only): long legs, a single hump under a team saddle cloth, a neck stepped forward and up
// to a long head. Mounted by the character rig like the horse and the elephant; the saddle sits on the hump.
// The walk is a pace (both legs of one side swing together), which tells a camel from a horse at a glance.
import type {UnitPose} from './unit-rig.ts';
export function createCamelMount(T:any,player:number,box:(w:number,h:number,d:number)=>any,material:(color:string)=>any){
 const root=new T.Group();root.name='camel-root';const team=player===0?'#45728c':'#b25441',coat='#c8a46e',shade='#a9844f',wood='#6e5438';
 const part=(parent:any,x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const m=new T.Mesh(box(w,h,d),material(color));m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};
 const legs:any[]=[];
 for(const x of [-.17,.17])for(const z of [-.4,.42]){const leg=new T.Group();leg.name=`camel-leg-${legs.length}`;leg.position.set(x,.95,z);root.add(leg);legs.push(leg);
  part(leg,0,-.9,0,.12,.9,.13,coat);part(leg,0,-.5,0,.15,.1,.16,shade);part(leg,0,-.95,.02,.18,.07,.2,'#8a6a45');}
 const body=new T.Group();root.add(body);
 // Barrel, hump with a rounded top, belly shade, tail.
 part(body,0,.9,0,.5,.42,1.12,coat);part(body,0,.88,0,.44,.06,1,shade);part(body,0,1.32,-.05,.38,.2,.52,coat);part(body,0,1.52,-.05,.24,.08,.32,coat);
 part(body,0,.98,-.6,.06,.3,.06,shade);part(body,0,.94,-.6,.09,.07,.09,'#5c4a36');
 // Team saddle cloth draped over the barrel, a timber saddle frame on the hump with front and rear horns.
 part(body,0,1.06,-.05,.52,.28,.6,team);part(body,0,1.05,-.05,.53,.04,.61,'#d9bf6f');
 part(body,0,1.56,-.05,.4,.06,.42,wood);part(body,0,1.62,.17,.28,.14,.05,wood);part(body,0,1.62,-.27,.28,.14,.05,wood);
 // Neck: stepped blocks forward and up from the chest; the head group nods while walking.
 part(body,0,.98,.6,.2,.3,.24,coat);part(body,0,1.12,.78,.18,.3,.2,coat);part(body,0,1.32,.9,.16,.36,.18,coat);
 const head=new T.Group();head.name='camel-head';head.position.set(0,1.6,.96);body.add(head);
 part(head,0,0,.08,.2,.2,.36,coat);part(head,0,-.02,.28,.16,.14,.12,shade);part(head,0,.2,-.04,.16,.06,.14,coat);
 for(const sx of [-1,1]){part(head,sx*.1,.12,.06,.02,.04,.05,'#2f3932');part(head,sx*.07,.2,-.06,.04,.08,.04,shade);}
 part(head,0,.04,.08,.22,.03,.2,team);
 const saddle=new T.Group();saddle.name='rider-saddle';saddle.position.set(0,1.62,-.05);body.add(saddle);
 // Heavy camel (line upgrade, own units): a quilted caparison over the cloth and a bronze chest plate.
 let armour:any=null;
 function grade(look:string|null){if(look==='heavy-camel'&&!armour){armour=new T.Group();armour.name='camel-armour';body.add(armour);
   part(armour,0,.9,-.05,.54,.34,.98,'#8a6a45');for(const z of [-.4,-.1,.2])part(armour,0,.9,z,.55,.34,.04,team);part(armour,0,.92,.55,.3,.3,.06,'#b8964a');part(armour,0,1.4,.88,.18,.08,.22,'#b8964a');}
  if(armour)armour.visible=look==='heavy-camel';}
 // A swung leg lifts so its pad clears the ground.
 function pose(kind:UnitPose,time:number){const t=Number.isFinite(time)?Math.max(0,time):0,phase=t*.01,walking=kind==='walk';
  legs.forEach((leg,i)=>{const swing=walking?Math.sin(phase+(i<2?0:Math.PI))*.24:0;leg.rotation.x=swing;leg.position.y=.95+Math.abs(Math.sin(swing))*.12;});
  body.position.y=walking?Math.abs(Math.sin(phase))*.03:0;
  // Walking: the head nods; idle: a slow look around; attack: the head pulls back (the rider strikes).
  head.rotation.x=walking?Math.sin(phase*2)*.08:kind==='attack'?-.18:0;head.rotation.y=kind==='idle'?Math.sin(t*.0015)*.25:0;}
 return {root,saddle,pose,grade};
}
