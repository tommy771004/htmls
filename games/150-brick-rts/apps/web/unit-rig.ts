// Rendering only: no damage, inventory, timers or simulation commands are decided here.
export const unitPoses=['idle','walk','work','attack','hit','death','carry'] as const;
export type UnitPose=typeof unitPoses[number];
// Append-only: the unique units' weapons follow the base tools.
export const unitTools=['none','axe','pick','sickle','hammer','basket','sword','spear','bow','staff','longbow','repeater','musket','throwing-axe','great-sword','war-axe','katana','scimitar','powder-keg','hand-cannon'] as const;
export type UnitTool=typeof unitTools[number];
// Foot dresses. The unique units wear their own outfit over the same body; the *-rider dresses are what the mounted
// unique units wear in the saddle (and when they fall, dismounted). Appended: the cavalry archer and camel riders and the
// petard (a sapper carrying a powder keg), then the 科技 round's hand cannoneer.
export const unitRoles=['villager','swordsman','spearman','archer','monk','longbowman','woad-raider','throwing-axeman','huskarl','teutonic-knight','berserk','samurai','janissary','chu-ko-nu','cataphract-rider','mameluke-rider','mangudai-rider','mahout','cavalry-archer-rider','camel-rider','petard','hand-cannoneer'] as const;
export type UnitRole=typeof unitRoles[number];
// The weapon a dress arrives with (the scene then equips the unit kind's weapon, which matches).
export const roleTools:Record<Exclude<UnitRole,'villager'>,UnitTool>={swordsman:'sword',spearman:'spear',archer:'bow',monk:'staff',longbowman:'longbow','woad-raider':'sword','throwing-axeman':'throwing-axe',huskarl:'sword','teutonic-knight':'great-sword',berserk:'war-axe',samurai:'katana',janissary:'musket','chu-ko-nu':'repeater','cataphract-rider':'spear','mameluke-rider':'scimitar','mangudai-rider':'bow',mahout:'spear','cavalry-archer-rider':'bow','camel-rider':'scimitar',petard:'powder-keg','hand-cannoneer':'hand-cannon'};
// Line upgrades with a look worn by the rider (ids from packages/sim/stats.ts lineUpgrades).
export const riderLooks=['two-handed-swordsman','champion','hussar','heavy-cavalry-archer'] as const;
// Shared palette for the unique outfits (metal, leather, fur, skin, woad, gold) so they batch with the rest.
const skin='#dfbb7e',metal='#9aa3a1',leather='#5a4632',fur='#7d6a52',gold='#c9a55a',woad='#3f5f95',lacquer='#3a3530';
export function samplePose(pose:UnitPose,time:number){
 const t=Math.max(0,Number.isFinite(time)?time:0),walk=Math.sin(t*.012)*.35;
 const p={leftLeg:0,rightLeg:0,leftArm:0,rightArm:0,lean:0,fall:0};
 if(pose==='walk'){p.leftLeg=walk;p.rightLeg=-walk;p.leftArm=-walk*.6;p.rightArm=walk*.6;}
 if(pose==='work'){p.rightArm=-.9+Math.sin(t*.01)*.7;p.leftArm=-.25;}
 if(pose==='attack'){p.rightArm=-1.25+Math.sin(t*.012)*1;p.leftArm=-.45;}
 // Carrying keeps the walk cycle in the legs so a returning villager does not slide.
 if(pose==='carry'){p.leftArm=-1.1;p.rightArm=-1.1;p.leftLeg=walk;p.rightLeg=-walk;}
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
 let seated=false,worn:UnitRole='villager';
 // An outfit is one group on the body plus one on each arm joint (sleeves, pauldrons, a strapped shield swing with the arm).
 const outfits=new Map<UnitRole,any[]>();
 function dress(role:UnitRole){
  if(!unitRoles.includes(role))throw Error('未知模型軍種');
  for(const outfit of outfits.values())for(const g of outfit)g.visible=false;
  for(const look of grades.values())for(const g of look)g.visible=false;
  shield.visible=false;worn=role;if(role==='villager'){equip('none');return;}
  let outfit=outfits.get(role);
  if(!outfit){const o=new T.Group(),la=new T.Group(),ra=new T.Group();o.name=`outfit-${role}`;la.name=`outfit-${role}-arm-left`;ra.name=`outfit-${role}-arm-right`;root.add(o);leftArm.add(la);rightArm.add(ra);outfit=[o,la,ra];outfits.set(role,outfit);
   // Both arms alike (sleeve overlays): x mirrors nothing, the arm joints are symmetric.
   const arms=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{for(const a of [la,ra])part(a,x,y,z,w,h,d,color);};
   if(role==='monk'){
    // Undyed wool habit over the tunic, a hood over the hat, rope belt; the stole keeps the team colour readable.
    const habit='#7a5c40';
    part(o,0,.3,0,.5,.42,.36,habit);part(o,0,.06,0,.44,.26,.34,habit);
    for(const x of [-.09,.09])part(o,x,.34,.185,.07,.38,.02,team);
    part(o,0,.36,0,.52,.04,.38,'#d8c48a');
    part(o,0,.99,-.01,.47,.14,.43,habit);part(o,0,.74,-.17,.4,.3,.06,habit);
   }else if(role==='archer'){
    part(o,0,1.1,0,.36,.13,.32,'#667c4e');
    part(o,0,.36,-.24,.21,.43,.18,'#8b6746');
    for(const x of [-.06,.06])part(o,x,.77,-.24,.025,.2,.025,'#d3b981');
   }else if(role==='longbowman'){
    // Broad-brimmed kettle hat, a belt and a tall quiver of long shafts; the longbow itself carries the silhouette.
    part(o,0,1.1,0,.54,.05,.5,'#6d5a3e');part(o,0,1.15,0,.3,.13,.28,'#6d5a3e');
    part(o,0,.42,0,.48,.05,.34,leather);part(o,.08,.3,-.23,.15,.6,.13,'#8b6746');
    for(const x of [.04,.12])part(o,x,.9,-.23,.03,.18,.03,'#e8e0c8');
   }else if(role==='chu-ko-nu'){
    // Dark lamellar vest with a brass collar, a topknot cap.
    part(o,0,.42,0,.48,.28,.34,'#5b4a3a');part(o,0,.66,0,.3,.04,.35,gold);
    part(o,0,1.1,0,.34,.08,.3,lacquer);part(o,0,1.18,-.02,.12,.1,.12,lacquer);
   }else if(role==='janissary'){
    // The tall white felt börk with its flap falling behind, a brass brow band and a crossed sash.
    part(o,0,1.1,-.02,.32,.36,.3,'#ece6d6');part(o,0,.96,-.2,.28,.4,.06,'#ece6d6');part(o,0,1.1,0,.34,.06,.34,gold);
    part(o,0,.42,0,.48,.07,.34,gold);
   }else if(role==='woad-raider'){
    // No armour: bare chest and arms striped with woad, limed hair standing in spikes, a face band.
    part(o,0,.44,0,.475,.27,.335,skin);for(const y of [.5,.6])part(o,0,y,0,.48,.04,.34,woad);part(o,0,.42,0,.49,.04,.345,leather);
    part(o,0,.8,.15,.3,.04,.012,woad);part(o,0,1.1,0,.4,.1,.36,'#ece6d2');for(const x of [-.12,0,.12])part(o,x,1.2,0,.08,.14,.08,'#ece6d2');
    arms(0,-.3,0,.12,.31,.18,skin);arms(0,-.2,0,.125,.04,.185,woad);
   }else if(role==='throwing-axeman'){
    // Bare head: long red-brown hair tied back and a moustache, a fur cape on the shoulders, two spare axes at the hips
    // (the longbowman's brimmed hat and the woad raider's limed spikes stay the distinct headgear).
    part(o,0,1.02,-.03,.46,.14,.44,'#9a5a30');part(o,0,.76,-.2,.36,.3,.06,'#9a5a30');part(o,0,.79,.155,.2,.04,.02,'#9a5a30');part(o,0,.64,-.02,.52,.08,.38,'#a08a68');
    part(o,0,.42,0,.48,.05,.34,leather);
    for(const x of [-.26,.26]){part(o,x,.26,.06,.04,.22,.04,'#967447');part(o,x,.4,.1,.05,.08,.1,'#aab0a3');}
   }else if(role==='huskarl'){
    // Spangenhelm with a nasal bar, a mail hauberk below a team-coloured chest, a round shield strapped to the left arm.
    part(o,0,1.1,0,.4,.14,.36,metal);part(o,0,1.24,0,.24,.08,.22,metal);part(o,0,.86,.16,.05,.24,.03,metal);
    part(o,0,.3,0,.48,.26,.34,metal);
    part(la,-.14,-.6,.16,.06,.5,.3,team);part(la,-.14,-.5,.16,.06,.3,.5,team);part(la,-.18,-.4,.16,.04,.1,.1,gold);
   }else if(role==='teutonic-knight'){
    // Great helm over the whole head with an eye slit and a crest, a white surcoat with a team cross, steel pauldrons.
    part(o,0,.7,0,.47,.46,.44,metal);part(o,0,.9,.22,.36,.035,.012,'#2c2e2c');part(o,0,1.16,0,.08,.08,.32,team);
    part(o,0,.3,0,.48,.4,.34,'#ece8dc');for(const z of [.17,-.17]){part(o,0,.34,z,.08,.3,.012,team);part(o,0,.5,z,.26,.08,.012,team);}
    arms(0,-.12,0,.15,.14,.2,metal);
   }else if(role==='berserk'){
    // Wolf-pelt hood with ears and snout, a fur mantle over bare arms, a rust beard.
    part(o,0,1.06,-.02,.42,.14,.42,'#8a8272');part(o,0,1.12,.2,.16,.08,.1,'#8a8272');for(const x of [-.13,.13])part(o,x,1.2,-.04,.08,.1,.06,'#8a8272');
    part(o,0,.62,-.02,.54,.12,.38,fur);part(o,0,.3,-.2,.44,.36,.06,fur);part(o,0,.71,.15,.26,.11,.05,'#a35f35');
    arms(0,-.3,0,.12,.28,.18,skin);arms(0,-.3,0,.125,.06,.185,leather);
   }else if(role==='samurai'){
    // Kabuto (lacquer bowl, flared neck guard, gold kuwagata), a dark cuirass laced in team colour and team shoulder plates.
    part(o,0,1.1,0,.4,.14,.38,lacquer);part(o,0,.92,-.06,.52,.16,.36,lacquer);
    for(const x of [-.1,.1])part(o,x,1.16,.17,.04,.26,.02,gold);part(o,0,1.14,.2,.1,.08,.02,gold);
    part(o,0,.4,0,.48,.3,.34,'#4a3a32');for(const y of [.46,.58])part(o,0,y,0,.49,.04,.345,team);
    arms(0,-.24,0,.14,.24,.22,team);arms(0,-.16,0,.145,.03,.225,lacquer);
   }else if(role==='cataphract-rider'){
    // Gilded scale coat, a team cloak and a tall plumed helmet.
    part(o,0,.3,0,.48,.4,.34,'#a89a6a');part(o,0,.32,-.19,.4,.4,.04,team);
    part(o,0,1.1,0,.4,.12,.36,'#a5b0ad');part(o,0,1.22,0,.24,.1,.22,'#a5b0ad');part(o,0,1.32,0,.06,.22,.06,team);
   }else if(role==='mameluke-rider'){
    // A white turban wound round a spiked cap, the team colour in its band, a gold belt.
    part(o,0,1.08,0,.44,.14,.42,'#efe9da');part(o,0,1.12,0,.46,.05,.44,team);part(o,0,1.22,0,.12,.14,.12,gold);
    part(o,0,.42,0,.48,.05,.34,gold);
   }else if(role==='mangudai-rider'){
    // Fur-brimmed steppe hat with a team crown, the deel's crossed flap and a quiver at the hip.
    part(o,0,1.06,0,.48,.1,.44,'#8a6a48');part(o,0,1.16,0,.3,.14,.28,team);part(o,0,1.3,0,.1,.06,.1,gold);
    part(o,.08,.44,.165,.14,.24,.02,'#d8c48a');part(o,.25,.3,-.05,.1,.32,.14,'#8b6746');
   }else if(role==='cavalry-archer-rider'){
    // Peaked leather cap with ear flaps, a short team cape and a quiver slung across the back (the Mangudai's is at the hip).
    const cap='#6b5238';part(o,0,1.01,0,.46,.13,.44,cap);part(o,0,1.14,0,.32,.12,.3,cap);part(o,0,1.26,0,.14,.1,.14,cap);for(const x of [-.2,.2])part(o,x,.84,0,.04,.2,.2,cap);
    part(o,0,.36,-.18,.42,.34,.04,team);part(o,-.1,.4,-.24,.12,.42,.1,'#8b6746');for(const x of [-.13,-.07])part(o,x,.82,-.24,.03,.12,.03,'#efe9da');
   }else if(role==='camel-rider'){
    // Desert headcloth held by a team cord, its tail down the back and a veil over the mouth, a team sash across the robe.
    const cloth='#cdb88e';part(o,0,1,-.01,.47,.16,.45,cloth);part(o,0,.7,-.2,.3,.34,.05,cloth);part(o,0,.74,.16,.32,.1,.02,cloth);part(o,0,1.1,0,.49,.04,.47,team);
    part(o,0,.12,0,.5,.2,.36,'#e8e0c8');part(o,0,.5,.17,.4,.06,.02,team);
   }else if(role==='petard'){
    // Leather skullcap with a team band, a team neckerchief, a bandolier of powder flasks and a lit slow match in the left hand.
    part(o,0,1.01,0,.46,.15,.42,leather);part(o,0,1.03,0,.47,.04,.43,team);part(o,0,.64,0,.4,.06,.34,team);
    part(o,0,.5,.17,.42,.05,.02,'#6e5438');for(const x of [-.12,.02,.14])part(o,x,.36,.17,.06,.1,.05,'#b8964a');
    part(la,0,-.52,.12,.03,.2,.03,'#6e5438');part(la,0,-.34,.12,.045,.045,.045,'#e0a040');
   }else if(role==='hand-cannoneer'){
    // A charcoal felt cap with a soft crown pushed to one side and a pale plume, a quilted buff jack (stitched bands), a ramrod slung across
    // the back, a powder horn and a shot bag at the hips. (The janissary's tall white börk and gold sash stay his own.)
    const jack='#b9a27a',stitch='#9c8660';
    part(o,0,1,0,.46,.14,.42,'#3d3a34');const beret=part(o,-.04,1.13,.01,.34,.06,.32,'#3d3a34');beret.rotation.z=.14;part(o,.14,1.14,-.1,.05,.22,.05,'#e8e0c8');
    part(o,0,.24,0,.49,.4,.34,jack);for(const y of [.36,.5])part(o,0,y,0,.495,.02,.345,stitch);part(o,0,.24,0,.5,.05,.35,leather);
    const rod=part(o,0,.2,-.2,.03,.8,.03,'#5a4632');rod.rotation.z=.6;
    part(o,-.26,.3,.05,.06,.16,.08,'#e3d6b4');part(o,-.26,.44,.05,.07,.04,.09,'#6e5438');part(o,.26,.26,.04,.08,.14,.12,leather);
    arms(0,-.14,0,.12,.12,.18,jack);
   }else if(role==='mahout'){
    part(o,0,1.08,0,.42,.12,.4,team);part(o,0,1.2,0,.14,.06,.14,gold);
   }else{
    part(o,0,1.12,0,.4,.14,.35,'#a5b0ad');
    part(o,0,.4,.18,.36,.23,.055,'#a5b0ad');
    if(role==='spearman')part(o,0,1.26,0,.065,.15,.25,team);
   }
  }
  for(const g of outfit)g.visible=true;shield.visible=role==='swordsman';equip(roleTools[role]);
 }
 // Line-upgrade looks worn over a dress (own units only; the scene passes the latest researched upgrade of the unit's line).
 // Groups are named grade-*, apart from the outfits, and the swordsman's shield goes once he takes a two-handed sword.
 const grades=new Map<string,any[]>();
 function grade(look:string|null){
  for(const g of grades.values())for(const x of g)x.visible=false;
  shield.visible=worn==='swordsman'&&look!=='two-handed-swordsman'&&look!=='champion';
  if(!look||!(riderLooks as readonly string[]).includes(look))return;
  let g=grades.get(look);
  if(!g){const o=new T.Group(),la=new T.Group(),ra=new T.Group();o.name=`grade-${look}`;la.name=`grade-${look}-arm-left`;ra.name=`grade-${look}-arm-right`;root.add(o);leftArm.add(la);rightArm.add(ra);g=[o,la,ra];grades.set(look,g);
   const arms=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{for(const a of [la,ra])part(a,x,y,z,w,h,d,color);};
   if(look==='two-handed-swordsman'||look==='champion'){
    // A deep sallet with a visor slit over the swordsman's cap; the champion adds a team plume, a gilt rim and pauldrons.
    part(o,0,1.06,0,.46,.2,.42,metal);part(o,0,.88,.18,.36,.16,.03,metal);part(o,0,.95,.196,.3,.03,.01,'#2c2e2c');
    if(look==='champion'){part(o,0,1.26,0,.08,.2,.08,team);part(o,0,1.06,0,.47,.03,.43,gold);arms(0,-.12,0,.16,.14,.21,metal);}
   }else if(look==='hussar'){
    // Tall dark fur busby with a team plume and a feathered wing rising behind the shoulders.
    part(o,0,1.08,0,.42,.32,.38,'#3a3530');part(o,.15,1.4,0,.06,.14,.06,team);part(o,0,.5,-.22,.05,1,.05,'#6e5438');
    for(const [y,z] of [[.72,-.27],[.88,-.29],[1.04,-.3],[1.2,-.29],[1.36,-.27]])part(o,0,y,z,.04,.12,.1,'#efe9da');
   }else if(look==='heavy-cavalry-archer'){
    // Mail coat and mail sleeves (the team cape still shows on the back).
    part(o,0,.3,0,.485,.32,.345,metal);part(o,0,.62,0,.36,.05,.33,metal);arms(0,-.26,0,.115,.24,.175,metal);
   }
  }
  for(const x of g)x.visible=true;
 }
 const shield=new T.Group();shield.name='shield-left';sockets.leftHand.add(shield);shield.visible=false;
 part(shield,-.12,-.17,.07,.08,.48,.4,'#9d885b');part(shield,-.17,-.11,.07,.03,.34,.28,team);
 const toolMeshes=new Map<UnitTool,any>();let selected:UnitTool='none';
 function makeTool(kind:UnitTool){const group=new T.Group();group.name=`tool-${kind}`;sockets.rightHand.add(group);
 if(kind==='basket'){part(group,-.15,-.12,.16,.4,.28,.34,'#96764c');for(const x of [-.32,.02])part(group,x,.12,.16,.035,.15,.04,'#b79a67');part(group,-.15,.25,.16,.38,.035,.04,'#b79a67');}
 else if(kind==='spear'){part(group,0,-.28,0,.05,1.42,.05,'#967447');part(group,0,1.14,0,.11,.23,.06,'#c6cfca');}
 else if(kind==='staff'){part(group,0,-.2,0,.05,1.3,.05,'#8a6a45');part(group,0,.49,0,.1,.1,.1,'#c9a55a');}
 else if(kind==='bow'){for(const [y,z] of [[-.12,0],[.04,.08],[.2,.12],[.36,.08],[.52,0]])part(group,0,y,z,.065,.17,.06,'#997447');part(group,0,-.12,0,.018,.81,.018,'#d9cba4');}
 else if(kind==='longbow'){for(const [y,z] of [[-.34,0],[-.12,.06],[.1,.1],[.32,.1],[.54,.06],[.76,0]])part(group,0,y,z,.07,.23,.07,'#a57c4a');part(group,0,-.34,-.01,.016,1.33,.016,'#d9cba4');}
 else if(kind==='repeater'){
  // Repeating crossbow held at the hip: stock pointing forward, the bolt magazine on top, the prod across the front.
  part(group,0,-.02,.18,.07,.08,.56,'#8a6a45');part(group,0,.06,.24,.08,.16,.2,'#6e5438');part(group,0,.02,.42,.56,.05,.05,'#8a6a45');part(group,0,.1,.08,.03,.2,.03,'#6e5438');}
 else if(kind==='musket'){part(group,0,-.3,0,.09,.36,.08,'#7a5a3a');part(group,0,.06,0,.06,.9,.06,'#4a4a48');part(group,0,.3,0,.06,.03,.06,'#c9a55a');part(group,.04,-.02,0,.03,.06,.05,'#c9a55a');}
 else if(kind==='throwing-axe'){
  // Francisca: a short haft and a curved head with a drooping beard, unlike the villager's felling axe.
  part(group,0,-.04,0,.045,.32,.05,'#967447');part(group,.07,.2,0,.1,.08,.05,'#aab0a3');part(group,.12,.12,0,.06,.1,.05,'#aab0a3');part(group,.1,.28,0,.05,.05,.05,'#aab0a3');}
 else if(kind==='great-sword'){part(group,0,-.16,0,.08,.05,.08,'#baa167');part(group,0,-.12,0,.05,.22,.06,'#5a4632');part(group,0,.1,0,.34,.05,.07,'#baa167');part(group,0,.15,0,.1,.8,.05,'#d2d8d4');}
 else if(kind==='war-axe'){part(group,0,-.3,0,.055,1.05,.06,'#6e5438');part(group,.1,.52,0,.18,.22,.05,'#aab0a3');part(group,.16,.4,0,.08,.14,.05,'#aab0a3');part(group,-.06,.6,0,.06,.06,.05,'#aab0a3');}
 else if(kind==='katana'){part(group,0,-.12,0,.045,.2,.05,'#2f2a26');part(group,0,.08,0,.12,.025,.12,'#c9a55a');part(group,0,.105,0,.05,.3,.04,'#dfe4e0');part(group,0,.4,-.015,.05,.25,.04,'#dfe4e0');part(group,0,.64,-.035,.045,.16,.04,'#dfe4e0');}
 else if(kind==='scimitar'){part(group,0,-.1,0,.05,.18,.06,'#5a4632');part(group,0,.08,0,.18,.04,.07,'#c9a55a');part(group,0,.12,0,.05,.24,.04,'#d2d8d4');part(group,0,.34,.03,.07,.16,.04,'#d2d8d4');part(group,0,.48,.07,.07,.1,.04,'#d2d8d4');}
 else if(kind==='powder-keg'){
  // A powder keg hugged against the belly (centred on the body, not the hand), iron hoops and a short lit fuse.
  part(group,-.19,-.2,.13,.34,.38,.3,'#7a5a3a');for(const y of [-.12,.08])part(group,-.19,y,.13,.36,.04,.32,'#4a4a48');part(group,-.19,.18,.13,.26,.03,.22,'#6e5438');part(group,-.12,.21,.18,.03,.1,.03,'#d9cba4');part(group,-.12,.31,.18,.05,.05,.05,'#f5dc7a');}
 else if(kind==='hand-cannon'){
  // Hand cannon: a long wooden tiller running back up the forearm (braced under the arm when aimed) and a short, fat iron
  // tube beyond the fist with two bands and a flared muzzle, the touch hole on top; no smoke. A brief muzzle flash
  // (tool-hand-cannon-flash) shows only while firing.
  part(group,0,-.02,0,.05,.5,.05,'#8a6a45');part(group,0,-.3,0,.12,.28,.12,'#5b5e5c');for(const y of [-.24,-.12])part(group,0,y,0,.135,.035,.135,'#3f4240');
  part(group,0,-.36,0,.15,.06,.15,'#3f4240');part(group,0,-.08,.06,.03,.03,.02,'#2c2e2c');
  const flash=part(group,0,-.46,0,.1,.1,.1,'#f2c25a');flash.name='tool-hand-cannon-flash';flash.visible=false;}
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
 // Firing the hand cannon: both arms level (the tiller under the right arm, the left hand under the tube), a sharp kick up
 // and back on each shot with a flash at the muzzle, then held aim while reloading. Other tools swing as usual.
 function aim(time:number){const t=Math.max(0,Number.isFinite(time)?time:0),f=(t%1400)/1400,kick=f<.12?Math.sin(Math.PI*f/.12):0;
  return {right:-1.5-.3*kick,left:-1.25-.2*kick,lean:-.08*kick||0,flash:f<.07};}
 function pose(kind:UnitPose,time:number){if(!unitPoses.includes(kind))throw Error('未知模型姿態');const p=samplePose(kind,time);
  const firing=kind==='attack'&&selected==='hand-cannon'&&!seated,shot=firing?aim(time):null;if(shot){p.rightArm=shot.right;p.leftArm=shot.left;p.lean=shot.lean;}
  const flash=toolMeshes.get('hand-cannon')?.getObjectByName('tool-hand-cannon-flash');if(flash)flash.visible=!!shot?.flash;leftLeg.rotation.x=seated?0:p.leftLeg;rightLeg.rotation.x=seated?0:p.rightLeg;leftLeg.position.x=seated?-.4:-.12;rightLeg.position.x=seated?.4:.12;leftArm.rotation.x=p.leftArm;rightArm.rotation.x=p.rightArm;root.rotation.x=p.lean;root.rotation.z=-p.fall;root.position.y=.28*Math.sin(p.fall);for(const [tool,mesh] of toolMeshes)mesh.visible=tool===selected&&kind!=='death';}
 return {root,sockets,equip,pose,dress,grade,seat:(value:boolean)=>{seated=value;}};
}
