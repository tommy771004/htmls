// Brick siege engines (rendering only): the battering ram, mangonel, scorpion, trebuchet and bombard cannon. Same interface as the
// character and animal rigs ({root,sockets,equip,dress,pose}) plus grade(look) for line-upgrade looks on own units.
// They face +z like the villagers. Attack animations read the absolute clock (the scene restarts only 'hit'), so each
// is a loop: the ram log swings, the mangonel arm snaps up against its padded bar, the scorpion bolt flies, the
// trebuchet arm swings over its frame. dress() is the trebuchet's state: 'packed' (folded on a wagon, moving) or
// 'unpacked' (standing frame); the others ignore it. A destroyed engine tips over on its side ('death').
import type {UnitPose} from './unit-rig.ts';
type Box=(w:number,h:number,d:number)=>any;type Material=(color:string)=>any;
const wood='#94734c',dark='#6e5438',iron='#6b6f6c',metal='#9aa3a1',rope='#7a5c40',stone='#a19f86',gold='#c9a55a';
const teamOf=(player:number)=>player===0?'#45728c':'#b25441';
function kit(T:any,box:Box,material:Material){
 const part=(parent:any,x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const m=new T.Mesh(box(w,h,d),material(color));m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};
 const group=(parent:any,name:string,x=0,y=0,z=0)=>{const g=new T.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;};
 // A wheel: a rim block standing on the ground plus a hub and two crossed spokes that turn inside the rim while moving
 // (the rim itself stays put, so the square block never dips into the ground).
 const spokes:any[]=[];
 const wheel=(parent:any,x:number,z:number,size:number)=>{part(parent,x,0,z,.08,size,size,'#5c4a36');const s=group(parent,'wheel-spokes',x+Math.sign(x||1)*.045,size/2,z);
  part(s,0,-size*.42,0,.02,size*.84,.04,'#3f3226');const cross=part(s,0,-size*.42,0,.02,size*.84,.04,'#3f3226');cross.rotation.x=Math.PI/2;cross.position.set(0,0,-size*.42);part(s,0,-.04,0,.03,.08,.08,iron);spokes.push(s);};
 return {part,group,wheel,spokes};
}
// Shared motion: wheels turn and the body sways while moving, a hit rocks it, death tips it onto its side.
function motion(root:any,body:any,spokes:any[],halfWidth:number){
 return (kind:UnitPose,t:number)=>{
  const fall=kind==='death'?Math.min(t/700,1):0;
  for(const s of spokes)s.rotation.x=kind==='walk'?-t*.006:0;
  body.rotation.x=kind==='walk'?Math.sin(t*.02)*.015:kind==='hit'&&t<300?-.05*Math.sin(Math.PI*t/300):0;
  // Rocking about the centre would push one end's wheels into the ground: lift by the drop of the farthest wheel.
  body.position.y=Math.abs(Math.sin(body.rotation.x))*1.35;
  root.rotation.z=fall?-fall*.5:0;root.position.y=Math.sin(fall*.5)*halfWidth;
 };
}
const clock=(time:number)=>Number.isFinite(time)?Math.max(0,time):0;
const noSockets=(T:any)=>({leftHand:new T.Group(),rightHand:new T.Group()});

// Battering ram: a timber frame on four wheels under a team-coloured roof, the ram log swinging out at the front.
// Capped ram: iron plates along the roof; siege ram: also iron side walls and a heavier ram head.
export function createRamRig(T:any,player:number,box:Box,material:Material){
 const root=new T.Group();root.name='siege-ram';const team=teamOf(player),{part,group}=kit(T,box,material);
 const body=group(root,'siege-body');
 part(body,0,.22,0,.76,.1,1.3,dark);
 for(const x of [-.36,.36])for(const z of [-.45,.45])part(body,x,0,z,.1,.36,.36,'#5c4a36');
 for(const x of [-.3,.3])part(body,x,.32,0,.1,.55,1.2,wood);
 part(body,0,.86,0,.86,.1,1.36,team);part(body,0,.96,0,.5,.1,1.36,team);
 const log=group(body,'ram-log');part(log,0,.4,.2,.24,.24,1.2,'#8a6a45');part(log,0,.38,.82,.3,.28,.12,iron);
 const looks=new Map<string,any[]>();
 function grade(look:string|null){for(const g of looks.values())for(const x of g)x.visible=false;if(look!=='capped-ram'&&look!=='siege-ram')return;
  let g=looks.get(look);if(!g){const roof=group(body,`grade-${look}`),head=group(log,`grade-${look}-head`);g=[roof,head];looks.set(look,g);
   for(const x of [-.34,.34]){part(roof,x,.96,0,.18,.04,1.3,metal);for(const z of [-.5,0,.5])part(roof,x,1,z,.04,.02,.04,gold);}
   if(look==='siege-ram'){for(const x of [-.36,.36])part(roof,x,.36,0,.03,.44,1.14,metal);part(head,0,.34,.86,.38,.36,.16,iron);}}
  for(const x of g)x.visible=true;}
 const move=motion(root,body,[],.43);
 function pose(kind:UnitPose,time:number){const t=clock(time);move(kind,t);log.position.z=kind==='attack'?Math.max(0,Math.sin(t*.008))*.25:0;}
 return {root,sockets:noSockets(T),equip:(_:string)=>{},dress:(_:string)=>{},pose,grade};
}

// Mangonel: a low frame on four wheels, a rope torsion skein at the back driving a throwing arm whose bucket rests over
// the windlass; on attack the arm snaps up against the team-padded crossbar and is wound back down.
// Onager: a longer arm, a bigger stone and the frame lengthened behind; siege onager: iron-banded arm and posts.
export function createMangonelRig(T:any,player:number,box:Box,material:Material){
 const root=new T.Group();root.name='siege-mangonel';const team=teamOf(player),{part,group,wheel,spokes}=kit(T,box,material);
 const body=group(root,'siege-body');
 for(const z of [-.62,.3])for(const x of [-.36,.36])wheel(body,x,z,.34);
 for(const x of [-.26,.26]){part(body,x,.22,-.25,.1,.12,1.6,wood);part(body,x*1.21,.25,-.25,.02,.06,1.4,team);}
 for(const z of [.45,-.85])part(body,0,.22,z,.62,.1,.1,dark);
 for(const x of [-.2,.2]){part(body,x,.34,-.12,.1,.72,.1,wood);const brace=part(body,x,.34,.4,.07,.62,.07,dark);brace.rotation.x=-.75;}
 part(body,0,.86,-.12,.5,.12,.12,wood);part(body,0,.84,-.2,.36,.16,.04,team);
 // Torsion skein and the windlass that winds the arm down.
 part(body,0,.34,-.3,.44,.18,.18,rope);part(body,0,.34,-.95,.5,.1,.1,'#5c4a36');for(const x of [-.29,.29])part(body,x,.28,-.95,.04,.22,.04,dark);
 const arm=group(body,'mangonel-arm',0,.43,-.3);
 // Arm along local +y; the bucket opens toward local +z (up while the arm lies back).
 const makeArm=(name:string,len:number,cup:number)=>{const a=group(arm,name);part(a,0,0,0,.09,len,.09,wood);part(a,0,len-.1,.06,cup,.16,cup-.02,'#5c4a36');const s=part(a,0,len-.08,.06+cup/2,cup*.6,cup*.6,.1,stone);return {a,s};};
 const short=makeArm('arm-mangonel',.75,.24),long=makeArm('arm-onager',.95,.3);long.a.visible=false;
 const bands=group(long.a,'arm-bands');for(const y of [.2,.45,.7])part(bands,0,y,0,.11,.04,.11,iron);bands.visible=false;
 const extension=group(body,'onager-frame');for(const x of [-.26,.26])part(extension,x,.22,-1.18,.1,.12,.3,wood);part(extension,0,.22,-1.28,.62,.1,.1,dark);extension.visible=false;
 const plates=group(body,'siege-onager-plates');for(const x of [-.2,.2])part(plates,x*1.3,.5,-.12,.02,.36,.12,iron);plates.visible=false;
 function grade(look:string|null){const onager=look==='onager'||look==='siege-onager';short.a.visible=!onager;long.a.visible=onager;extension.visible=onager;bands.visible=look==='siege-onager';plates.visible=look==='siege-onager';}
 const rest=-1.4,fire=.12,move=motion(root,body,spokes,.45);
 function pose(kind:UnitPose,time:number){const t=clock(time);move(kind,t);
  // Loop: snap up (10%), hold against the bar, wind back down; the stone is gone until the arm is nearly down again.
  let angle=rest,loaded=true;if(kind==='attack'){const f=(t%1600)/1600;angle=f<.1?rest+(fire-rest)*(1-(1-f/.1)**2):f<.25?fire:fire+(rest-fire)*(f-.25)/.75;loaded=f<.08||f>.85;}
  arm.rotation.x=angle;short.s.visible=long.s.visible=loaded;}
 return {root,sockets:noSockets(T),equip:(_:string)=>{},dress:(_:string)=>{},pose,grade};
}

// Scorpion: a large torsion crossbow on a pedestal, on a four-wheeled cart behind a team-panelled mantlet. On attack the
// bolt flies off the stock and the bow kicks; a new bolt is laid on after the reload.
// Heavy scorpion: the mantlet faced with iron and iron caps on the bow arms.
export function createScorpionRig(T:any,player:number,box:Box,material:Material){
 const root=new T.Group();root.name='siege-scorpion';const team=teamOf(player),{part,group,wheel,spokes}=kit(T,box,material);
 const body=group(root,'siege-body');
 for(const z of [-.35,.35])for(const x of [-.32,.32])wheel(body,x,z,.28);
 part(body,0,.2,0,.56,.08,.9,dark);part(body,0,.28,.46,.62,.36,.05,wood);part(body,0,.33,.49,.44,.24,.02,team);
 part(body,0,.28,-.05,.14,.36,.14,wood);part(body,0,.28,-.05,.26,.06,.26,dark);
 const bow=group(body,'scorpion-bow',0,.64,-.05);
 part(bow,0,0,-.05,.12,.1,1,wood);part(bow,0,-.04,.42,.22,.18,.12,dark);for(const sx of [-1,1]){part(bow,sx*.14,-.12,.42,.08,.32,.1,rope);part(bow,sx*.3,.02,.4,.24,.07,.07,wood);part(bow,sx*.5,.02,.32,.18,.07,.07,wood);part(bow,sx*.6,.02,.24,.06,.08,.06,metal);
  const cord=part(bow,sx*.3,.05,-.03,.015,.015,.81,'#d9cba4');cord.rotation.y=sx*Math.atan2(.6,.54);}
 part(bow,0,-.06,-.5,.3,.08,.08,dark);for(const sx of [-1,1])part(bow,sx*.17,-.14,-.5,.03,.16,.03,dark);
 const bolt=group(bow,'scorpion-bolt');part(bolt,0,.1,-.1,.04,.04,.8,'#d9cba4');part(bolt,0,.09,.32,.07,.06,.1,iron);part(bolt,0,.09,-.48,.02,.08,.1,'#efe9da');
 const armour=group(body,'heavy-scorpion-plates');part(armour,0,.3,.515,.64,.32,.02,iron);for(const x of [-.24,0,.24])part(armour,x,.58,.53,.04,.04,.02,gold);
 const caps=group(bow,'heavy-scorpion-caps');for(const sx of [-1,1])part(caps,sx*.6,0,.24,.09,.11,.09,iron);armour.visible=caps.visible=false;
 function grade(look:string|null){armour.visible=caps.visible=look==='heavy-scorpion';}
 const move=motion(root,body,spokes,.4);
 function pose(kind:UnitPose,time:number){const t=clock(time);move(kind,t);
  let fly=0,shown=true,kick=0;if(kind==='attack'){const f=(t%1300)/1300;if(f<.1){fly=f/.1*1.6;kick=.1*(1-f/.1);}else shown=f>.55;}
  bolt.position.z=fly;bolt.visible=shown&&fly<1.5;bow.rotation.x=-.08-kick;}
 return {root,sockets:noSockets(T),equip:(_:string)=>{},dress:(_:string)=>{},pose,grade};
}

// Trebuchet in two states. Packed: the arm, the folded frame and the counterweight (under a team cloth) on a four-
// wheeled wagon. Unpacked: two tall braced uprights on ground beams carrying the arm; the short end holds the
// counterweight (team band), the long end a sling that rests on the ground behind. On attack the counterweight drops and
// the arm swings over the top. State follows UnitView.unpacked via dress('packed'|'unpacked').
export const trebuchetStates=['packed','unpacked'] as const;
export type TrebuchetState=typeof trebuchetStates[number];
export function createTrebuchetRig(T:any,player:number,box:Box,material:Material){
 const root=new T.Group();root.name='siege-trebuchet';const team=teamOf(player),{part,group,wheel,spokes}=kit(T,box,material);
 const body=group(root,'siege-body');
 const packed=group(body,'trebuchet-packed');
 for(const z of [-.7,.7])for(const x of [-.4,.4])wheel(packed,x,z,.4);
 part(packed,0,.3,0,.7,.1,1.9,dark);for(const x of [-.33,.33])part(packed,x,.4,0,.06,.12,1.9,wood);
 part(packed,.14,.4,-.12,.14,.14,2.3,'#8a6a45');part(packed,-.16,.4,-.1,.12,.12,1.6,wood);part(packed,-.16,.52,-.1,.12,.12,1.4,wood);
 part(packed,.05,.4,.55,.5,.4,.45,'#5c4a36');part(packed,.05,.8,.55,.54,.06,.5,team);part(packed,.05,.52,.79,.4,.28,.02,team);
 part(packed,.14,.54,-.95,.18,.06,.18,'#c9b27a');part(packed,0,.3,1.12,.08,.08,.4,wood);
 const standing=group(body,'trebuchet-unpacked');
 for(const x of [-.42,.42]){part(standing,x,0,0,.14,.14,2.2,wood);part(standing,x,.14,0,.14,1.9,.14,wood);
  for(const [z,a] of [[.85,-.63],[-.85,.63]] as const){const brace=part(standing,x,.14,z,.1,1.32,.1,dark);brace.rotation.x=a;}}
 for(const z of [-.9,.9])part(standing,0,0,z,.98,.12,.14,dark);
 part(standing,0,1.95,0,1,.1,.1,iron);part(standing,.42,2.04,0,.03,.42,.03,dark);part(standing,.53,2.28,0,.2,.14,.02,team);
 const arm=group(standing,'trebuchet-arm',0,2,0);
 part(arm,0,-.06,-.7,.12,.12,2.6,'#8a6a45');for(const z of [-1.6,-.9,-.2])part(arm,0,-.07,z,.14,.14,.04,iron);
 part(arm,0,-.7,.5,.5,.55,.5,'#5c4a36');part(arm,0,-.5,.5,.52,.14,.52,team);for(const x of [-.15,.15])part(arm,x,-.15,.5,.04,.15,.04,metal);
 part(arm,0,-.45,-2,.03,.45,.03,'#c9b27a');part(arm,0,-.55,-2,.14,.1,.18,'#8b6746');const shot=part(arm,0,-.47,-2,.12,.1,.12,stone);
 let state:TrebuchetState='packed';standing.visible=false;
 function dress(next:string){if(!(trebuchetStates as readonly string[]).includes(next))throw Error('未知投石機狀態');state=next as TrebuchetState;packed.visible=state==='packed';standing.visible=state==='unpacked';}
 const rest=-.9,fire=1.2,moving=motion(root,body,spokes,.5),standingStill=motion(root,body,[],1);
 function pose(kind:UnitPose,time:number){const t=clock(time);(state==='packed'?moving:standingStill)(kind,t);
  // Loop: the counterweight drops and the arm swings over (15%), holds, then is winched back down.
  let angle=rest,loaded=true;if(kind==='attack'&&state==='unpacked'){const f=(t%2500)/2500;angle=f<.15?rest+(fire-rest)*(f/.15)**2:f<.3?fire:fire+(rest-fire)*(f-.3)/.7;loaded=f<.12||f>.9;}
  arm.rotation.x=angle;shot.visible=loaded;}
 return {root,sockets:noSockets(T),equip:(_:string)=>{},dress,pose,grade:(_:string|null)=>{},state:()=>state};
}
// Bombard cannon: a fat hooped iron barrel (the wide bore ahead of a narrower powder chamber) laid on a timber bed between
// two tall wheels, team boards on the cheeks, a stepped trail on the ground behind with two stone shot on it. On attack
// the barrel slams back along the bed and the carriage jolts (a flash at the muzzle, no smoke), then the crew's work runs
// it forward again. Destroyed: the carriage tips over and the barrel slides off it.
export function createBombardRig(T:any,player:number,box:Box,material:Material){
 const root=new T.Group();root.name='siege-bombard-cannon';const team=teamOf(player),{part,group,wheel,spokes}=kit(T,box,material);
 const body=group(root,'siege-body');
 for(const x of [-.42,.42])wheel(body,x,0,.62);
 part(body,0,.27,0,.92,.08,.08,iron);
 part(body,0,.3,-.05,.5,.1,1.1,dark);for(const x of [-.27,.27]){part(body,x,.4,-.05,.06,.14,1,wood);part(body,x*1.13,.42,-.05,.02,.1,.8,team);}
 part(body,0,.1,-.66,.16,.2,.12,dark);part(body,0,0,-1,.2,.1,.66,dark);part(body,0,.1,-1.26,.24,.06,.1,wood);
 for(const z of [-.82,-.98])part(body,0,.1,z,.12,.12,.12,stone);
 const barrel=group(body,'bombard-barrel',0,.4,0);barrel.rotation.x=-.1;
 part(barrel,0,.04,-.38,.26,.26,.42,'#5b5e5c');part(barrel,0,.08,-.62,.12,.12,.08,'#5b5e5c');
 part(barrel,0,0,.02,.4,.4,.62,'#6b6f6c');for(const z of [-.24,-.1,.08,.24])part(barrel,0,-.02,z,.44,.44,.05,'#3f4240');
 part(barrel,0,-.03,.34,.46,.46,.06,'#3f4240');part(barrel,0,.08,.4,.22,.22,.01,'#1f1d1b');part(barrel,0,.3,-.5,.04,.02,.04,'#1f1d1b');
 const flash=part(barrel,0,.08,.42,.24,.24,.14,'#f2c25a');flash.visible=false;
 const move=motion(root,body,spokes,.46);
 function pose(kind:UnitPose,time:number){const t=clock(time);move(kind,t);
  // Loop: the barrel kicks back along the bed (6%), the carriage jolts, then the barrel is run forward again.
  let back=0,jolt=0,fired=false;if(kind==='attack'){const f=(t%1600)/1600;back=f<.06?.2*Math.sin(Math.PI/2*f/.06):f<.5?.2*(1-(f-.06)/.44):0;jolt=f<.12?Math.sin(Math.PI*f/.12):0;fired=f<.05;}
  const fall=kind==='death'?Math.min(t/700,1):0;
  barrel.position.set(0,.4-.12*fall,-back+.3*fall);barrel.rotation.set(-.1-.04*jolt+.5*fall,0,.35*fall);body.position.z=-.06*jolt;flash.visible=fired;}
 return {root,sockets:noSockets(T),equip:(_:string)=>{},dress:(_:string)=>{},pose,grade:(_:string|null)=>{}};
}
export type SiegeRig=ReturnType<typeof createRamRig>|ReturnType<typeof createMangonelRig>|ReturnType<typeof createScorpionRig>|ReturnType<typeof createTrebuchetRig>|ReturnType<typeof createBombardRig>;
export function createSiegeRig(T:any,kind:string,player:number,box:Box,material:Material):SiegeRig{
 return kind==='mangonel'?createMangonelRig(T,player,box,material):kind==='scorpion'?createScorpionRig(T,player,box,material):kind==='trebuchet'?createTrebuchetRig(T,player,box,material):kind==='bombard-cannon'?createBombardRig(T,player,box,material):createRamRig(T,player,box,material);
}
