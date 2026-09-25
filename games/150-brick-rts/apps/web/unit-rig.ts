// Rendering only: no damage, inventory, timers or simulation commands are decided here.
export const unitPoses=['idle','walk','work','attack','hit','death','carry'] as const;
export type UnitPose=typeof unitPoses[number];
export const unitTools=['none','axe','pick','sickle','hammer','basket','sword','spear','bow'] as const;
export type UnitTool=typeof unitTools[number];
export const unitRoles=['villager','swordsman','spearman','archer'] as const;
export type UnitRole=typeof unitRoles[number];
export function samplePose(pose:UnitPose,time:number){
 const t=Math.max(0,Number.isFinite(time)?time:0),walk=Math.sin(t*.012)*.35;
 const p={leftLeg:0,rightLeg:0,leftArm:0,rightArm:0,lean:0,fall:0};
 if(pose==='walk'){p.leftLeg=walk;p.rightLeg=-walk;p.leftArm=-walk*.6;p.rightArm=walk*.6;}
 if(pose==='work'){p.rightArm=-.9+Math.sin(t*.01)*.7;p.leftArm=-.25;}
 if(pose==='attack'){p.rightArm=-1.25+Math.sin(t*.012)*1;p.leftArm=-.45;}
 if(pose==='carry'){p.leftArm=-1.1;p.rightArm=-1.1;}
 if(pose==='hit'&&t>0&&t<300)p.lean=-.24*Math.sin(Math.PI*t/300);
 if(pose==='death')p.fall=Math.min(t/700,1)*Math.PI/2;
 return p;
}
export function createUnitRig(T:any,player:number,box:(w:number,h:number,d:number)=>any,material:(color:string)=>any){
 const root=new T.Group();root.name='body-root';
 const part=(parent:any,x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const mesh=new T.Mesh(box(w,h,d),material(color));mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;};
 const team=player===0?'#45728c':'#b25441';
 function joint(name:string,x:number,y:number,z:number){const group=new T.Group();group.name=name;group.position.set(x,y,z);root.add(group);return group;}
 const leftLeg=joint('hip-left',-.12,.3,0),rightLeg=joint('hip-right',.12,.3,0);
 for(const leg of [leftLeg,rightLeg])part(leg,0,-.3,0,.19,.3,.24,'#44514b');
 part(root,0,.3,0,.46,.4,.32,team);part(root,0,.71,0,.34,.3,.3,'#dfbb7e');part(root,0,1.02,0,.44,.11,.4,player===0?'#cbbc94':'#835243');
 for(const dx of [-.075,.075])part(root,dx,.86,.155,.035,.04,.018,'#3e3a2e');
 const leftArm=joint('shoulder-left',-.19,.67,0),rightArm=joint('shoulder-right',.19,.67,0);
 const sockets:{leftHand:any;rightHand:any}={leftHand:new T.Group(),rightHand:new T.Group()};
 for(const [arm,socket,name] of [[leftArm,sockets.leftHand,'hand-left'],[rightArm,sockets.rightHand,'hand-right']]){part(arm,0,-.28,0,.1,.28,.16,team);part(arm,0,-.38,0,.1,.14,.17,'#dfbb7e');socket.name=name;socket.position.set(0,-.31,.09);arm.add(socket);}
 const outfits=new Map<UnitRole,any>();
 function dress(role:UnitRole){
  if(!unitRoles.includes(role))throw Error('未知模型軍種');
  for(const outfit of outfits.values())outfit.visible=false;
  shield.visible=false;if(role==='villager'){equip('none');return;}
  let outfit=outfits.get(role);
  if(!outfit){outfit=new T.Group();outfit.name=`outfit-${role}`;root.add(outfit);outfits.set(role,outfit);
   if(role==='archer'){
    part(outfit,0,1.1,0,.36,.13,.32,'#667c4e');
    part(outfit,0,.36,-.24,.21,.43,.18,'#8b6746');
    for(const x of [-.06,.06])part(outfit,x,.77,-.24,.025,.2,.025,'#d3b981');
   }else{
    part(outfit,0,1.12,0,.4,.14,.35,'#a5b0ad');
    part(outfit,0,.4,.18,.36,.23,.055,'#a5b0ad');
    if(role==='spearman')part(outfit,0,1.26,0,.065,.15,.25,team);
   }
  }
  outfit.visible=true;shield.visible=role==='swordsman';equip(role==='swordsman'?'sword':role==='spearman'?'spear':'bow');
 }
 const shield=new T.Group();shield.name='shield-left';sockets.leftHand.add(shield);shield.visible=false;
 part(shield,-.12,-.17,.07,.08,.48,.4,'#9d885b');part(shield,-.17,-.11,.07,.03,.34,.28,team);
 const toolMeshes=new Map<UnitTool,any>();let selected:UnitTool='none';
 function makeTool(kind:UnitTool){const group=new T.Group();group.name=`tool-${kind}`;sockets.rightHand.add(group);
 if(kind==='basket'){part(group,-.15,-.12,.16,.4,.28,.34,'#96764c');for(const x of [-.32,.02])part(group,x,.12,.16,.035,.15,.04,'#b79a67');part(group,-.15,.25,.16,.38,.035,.04,'#b79a67');}
 else if(kind==='spear'){part(group,0,-.28,0,.05,1.42,.05,'#967447');part(group,0,1.14,0,.11,.23,.06,'#c6cfca');}
 else if(kind==='bow'){for(const [y,z] of [[-.12,0],[.04,.08],[.2,.12],[.36,.08],[.52,0]])part(group,0,y,z,.065,.17,.06,'#997447');part(group,0,-.12,0,.018,.81,.018,'#d9cba4');}
 else if(kind!=='none'){
 part(group,0,-.08,0,.055,.48,.06,kind==='sword'?'#756449':'#967447');
 if(kind==='axe')part(group,.08,.23,0,.22,.15,.055,'#aab0a3');
 if(kind==='pick')part(group,0,.32,0,.38,.045,.06,'#aab0a3');
 if(kind==='hammer')part(group,0,.28,0,.23,.13,.12,'#979e93');
 if(kind==='sickle'){part(group,.05,.25,0,.15,.045,.05,'#aab0a3');part(group,.11,.16,0,.04,.12,.05,'#aab0a3');}
 if(kind==='sword'){part(group,0,.22,0,.22,.045,.07,'#baa167');part(group,0,.27,0,.07,.46,.045,'#c6cfca');}
 }
 toolMeshes.set(kind,group);return group;
 }
 function equip(kind:UnitTool){if(!unitTools.includes(kind))throw Error('未知模型工具');for(const mesh of toolMeshes.values())mesh.visible=false;selected=kind;if(kind!=='none')(toolMeshes.get(kind)??makeTool(kind)).visible=true;}
 function pose(kind:UnitPose,time:number){if(!unitPoses.includes(kind))throw Error('未知模型姿態');const p=samplePose(kind,time);leftLeg.rotation.x=p.leftLeg;rightLeg.rotation.x=p.rightLeg;leftArm.rotation.x=p.leftArm;rightArm.rotation.x=p.rightArm;root.rotation.x=p.lean;root.rotation.z=-p.fall;root.position.y=.28*Math.sin(p.fall);for(const [tool,mesh] of toolMeshes)mesh.visible=tool===selected&&kind!=='death';}
 return {root,sockets,equip,pose,dress};
}
