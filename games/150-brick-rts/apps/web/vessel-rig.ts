// Brick ships and the trade cart (rendering only), with the siege rigs' interface ({root,sockets,equip,dress,pose,grade}).
// Ships face +z (bow forward) and float with the water surface at y = 0: the keel course sits just below it, hidden in the
// water tile, so the hull reads as afloat. Every ship bobs and rolls a little; walking rows the oars and fills the sails,
// work dips the fishing net, attack fires the ship's weapon in a loop (bolt, fire stream, cannon), hit rocks the hull
// and death sinks it bow-up. grade(look) swaps the whole ship for its line upgrade (War Galley, Galleon, Fire Ship...),
// each a distinct build, never a recolour. The trade cart is an ox pulling a two-wheeled cart under a team canvas.
import type {UnitPose} from './unit-rig.ts';
type Box=(w:number,h:number,d:number)=>any;type Material=(color:string)=>any;
const wood='#8a6a45',dark='#5c4a36',deck='#b8955f',plank='#a4824f',iron='#5b5e5c',gilt='#c9a55a',rope='#7a5c40',cloth='#ece2c4',flame='#e0a040',spark='#f5dc7a',keg='#7c5a3a',stone='#a19f86';
const teamOf=(player:number)=>player===0?'#45728c':'#b25441';
const clock=(time:number)=>Number.isFinite(time)?Math.max(0,time):0;
// What a ship's look animates: oars sweep, sails fill, a weapon piece moves, a flash or flame shows.
type Rigging={group:any;oars:any[];sails:{g:any;z:number}[];bolt?:{m:any;z:number};flash?:any[];flames?:any[];net?:any};
function kit(T:any,box:Box,material:Material){
 const part=(parent:any,x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const m=new T.Mesh(box(w,h,d),material(color));m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};
 const group=(parent:any,name:string,x=0,y=0,z=0)=>{const g=new T.Group();g.name=name;g.position.set(x,y,z);parent.add(g);return g;};
 // A hull in courses: a keel below the waterline, the midship block, a bow stepping in three times and rising (sheer),
 // a stern stepping in twice, a lighter deck and gunwale rails. Returns the deck height.
 const hull=(g:any,L:number,B:number,H:number,color:string,trim:string)=>{
  part(g,0,-.12,0,B*.55,.12,L*.62,dark);part(g,0,0,0,B,H,L*.6,color);
  [.78,.54,.3].forEach((s,i)=>part(g,0,0,L*.3+L*.08*(i+.5),B*s,H+.03*(i+1),L*.08,color));
  [.82,.6].forEach((s,i)=>part(g,0,0,-(L*.3+L*.07*(i+.5)),B*s,H+.02*(i+1),L*.07,color));
  part(g,0,H,0,B*.78,.02,L*.56,deck);for(const x of [-1,1])part(g,x*(B/2-.025),H,0,.05,.05,L*.6,trim);
  return H+.02;};
 // A mast with its yard and a square sail (a stripe in the team colour); the cloth is its own group so it can fill.
 const sail=(r:Rigging,z:number,deckY:number,mastH:number,w:number,h:number,color:string,stripe:string)=>{
  part(r.group,0,deckY,z,.06,mastH,.06,wood);const g=group(r.group,'sail',0,0,z);part(g,0,deckY+mastH-.06,0,w+.12,.04,.04,wood);
  part(g,0,deckY+mastH-.08-h,.04,w,h,.02,color);part(g,0,deckY+mastH-.08-h*.62,.055,w,h*.24,.02,stripe);r.sails.push({g,z});};
 // Oars along both sides: pivots on the gunwale, the blade reaching out and down to the water.
 const oars=(r:Rigging,n:number,B:number,deckY:number,z0:number,step:number,len=.42)=>{for(const side of [-1,1])for(let i=0;i<n;i++){const o=group(r.group,'oar',side*B/2,deckY-.04,z0+i*step);o.rotation.z=side*.55;part(o,side*len/2,-.015,0,len,.03,.03,wood);part(o,side*(len-.05),-.03,0,.1,.06,.03,plank);r.oars.push(o);}};
 return {part,group,hull,sail,oars};
}
// Shared motion: a slow bob and roll afloat, the rowing and the filled sails while moving, a jolt when hit, sinking
// bow-up on death. Every ship part keeps scale 1; nothing accumulates (each pose sets absolute transforms).
function afloat(root:any,body:any){
 return (kind:UnitPose,t:number)=>{const fall=kind==='death'?Math.min(t/1400,1):0,hit=kind==='hit'&&t<300?Math.sin(Math.PI*t/300):0;
  body.position.y=fall?0:Math.sin(t*.0024)*.02;body.rotation.z=fall?0:Math.sin(t*.0017)*.03+hit*.08;body.rotation.x=0;
  root.position.y=-fall*.55;root.rotation.x=-fall*.45;root.rotation.z=fall*.18;};
}
function animate(r:Rigging,kind:UnitPose,t:number){
 const moving=kind==='walk'||kind==='carry';
 r.oars.forEach((o,i)=>{o.rotation.y=moving?Math.sin(t*.008+(i%2)*.4)*.4:0;});
 for(const s of r.sails)s.g.position.z=s.z+(moving?.05:0);
 const f=(t%1500)/1500;
 if(r.bolt){r.bolt.m.position.z=r.bolt.z+(kind==='attack'?f*1.1:0);r.bolt.m.visible=kind!=='attack'||f<.55;}
 if(r.flash)r.flash.forEach((m,i)=>{m.visible=kind==='attack'&&(t%1500)<90+i*20;});
 // Fire: the stream flickers between its two blocks four times a second (the reference's 0.25 s attack).
 if(r.flames)r.flames.forEach((m,i)=>{m.visible=kind==='attack'&&(Math.floor(t/125)+i)%2===0;});
 if(r.net){const dip=kind==='work'?(Math.sin(t*.004)+1)/2:0;r.net.rotation.x=.25+dip*.55;}
}
export function createShipRig(T:any,kind:string,player:number,box:Box,material:Material){
 const root=new T.Group();root.name=`ship-${kind}`;const team=teamOf(player),k=kit(T,box,material),{part,group,hull,sail,oars}=k;
 const body=group(root,'ship-body');const looks=new Map<string|null,Rigging>();
 const look=(name:string|null,build:(r:Rigging)=>void)=>{const r:Rigging={group:group(body,`look-${name??'base'}`),oars:[],sails:[]};build(r);r.group.visible=name===null;looks.set(name,r);};
 // A deck ballista at the bow: a stock, two arms and the bolt that flies on attack.
 const ballista=(r:Rigging,y:number,z:number,arm=.3)=>{part(r.group,0,y,z,.08,.06,.26,dark);part(r.group,0,y+.06,z+.08,arm,.04,.04,wood);const m=part(r.group,0,y+.08,z,.03,.03,.3,'#d8c48a');r.bolt={m,z};};
 // Shields hung along the gunwale (team and cream alternating).
 const shields=(r:Rigging,B:number,y:number,z0:number,n:number,step:number)=>{for(const side of [-1,1])for(let i=0;i<n;i++)part(r.group,side*(B/2+.015),y-.1,z0+i*step,.03,.14,.14,i%2?cloth:team);};
 if(kind==='fishing-ship'){
  look(null,r=>{const y=hull(r.group,.9,.42,.24,wood,dark);sail(r,.08,y,.62,.34,.32,cloth,team);
   // A boom over the side with the net hanging from it; work dips it into the water.
   part(r.group,0,y,-.22,.3,.1,.16,keg);const net=group(r.group,'net',.2,y+.36,-.12);part(net,0,0,0,.04,.04,.36,wood);part(net,.02,-.3,.16,.16,.3,.04,'#9aa08a');part(net,.02,-.3,.16,.18,.04,.05,team);r.net=net;
   for(const z of [-.08,.02])part(r.group,-.1,y,z,.12,.06,.08,'#bad0ce');});
 }else if(kind==='transport-ship'){
  look(null,r=>{const y=hull(r.group,1.25,.62,.22,wood,dark);
   // A broad open hold with cargo, a ramp board at the bow and one low mast.
   part(r.group,0,y,-.1,.44,.04,.56,dark);for(const [x,z] of [[-.1,-.24],[.12,-.02]])part(r.group,x,y+.04,z,.18,.16,.18,plank);
   part(r.group,0,y,.48,.36,.05,.12,deck);sail(r,.18,y,.58,.4,.28,cloth,team);oars(r,2,.62,y,-.2,.3);});
 }else if(kind==='trade-cog'){
  look(null,r=>{const y=hull(r.group,1.1,.58,.4,wood,team);
   // A tall round-bellied cog: stern castle, one big square sail, bales and a barrel on deck.
   part(r.group,0,y,-.38,.5,.18,.22,plank);part(r.group,0,y+.18,-.38,.54,.04,.26,dark);sail(r,.08,y,.9,.48,.52,cloth,gilt);
   part(r.group,-.12,y,.22,.16,.14,.16,'#d8c9a6');part(r.group,.1,y,.24,.12,.16,.12,keg);part(r.group,0,y+.9,.08,.12,.06,.04,gilt);});
 }else if(kind==='galley'){
  // Galley: a long oared hull with a bronze ram, one square sail and a bow ballista.
  look(null,r=>{const y=hull(r.group,1.45,.48,.26,wood,dark);part(r.group,0,-.04,.74,.12,.1,.14,'#a07c4a');sail(r,-.05,y,.78,.42,.38,team,cloth);oars(r,3,.48,y,-.36,.22);ballista(r,y,.42);});
  // War galley: a raised forecastle, two masts and shields along the rails.
  look('war-galley',r=>{const y=hull(r.group,1.55,.52,.3,wood,team);part(r.group,0,-.04,.8,.14,.12,.16,iron);part(r.group,0,y,.4,.42,.12,.3,plank);
   sail(r,-.12,y,.86,.46,.42,team,cloth);sail(r,.24,y+.12,.56,.28,.24,cloth,team);oars(r,3,.52,y,-.4,.22);shields(r,.52,y,-.42,4,.2);ballista(r,y+.12,.48);});
  // Galleon: a deep hull with a stern castle, three masts and gilt trim.
  look('galleon',r=>{const y=hull(r.group,1.7,.6,.36,dark,gilt);part(r.group,0,y,-.52,.52,.26,.36,wood);part(r.group,0,y+.26,-.52,.56,.04,.4,gilt);part(r.group,0,y,.48,.46,.12,.26,plank);
   sail(r,-.22,y,1.1,.52,.48,team,cloth);sail(r,.12,y,.96,.48,.42,cloth,team);sail(r,.42,y+.12,.6,.3,.26,team,cloth);shields(r,.6,y,-.3,4,.2);ballista(r,y+.12,.56,.36);
   part(r.group,0,y+1.1,-.22,.14,.08,.04,gilt);});
 }else if(kind==='fire-galley'){
  // Fire galley: a low fast hull, a smoking brazier amidships and a siphon at the bow whose stream flickers on attack.
  const siphon=(r:Rigging,y:number,z:number,size:number)=>{part(r.group,0,y,z,.12,.12,.16,iron);part(r.group,0,y+.04,z+.12,.06,.06,.16,iron);
   r.flames=[part(r.group,0,y+.02,z+.28,size,size*.8,size,flame),part(r.group,0,y+.04,z+.28+size,size*.8,size*.6,size*.9,spark)];};
  look(null,r=>{const y=hull(r.group,1.2,.42,.22,wood,dark);sail(r,-.12,y,.6,.32,.28,cloth,team);oars(r,2,.42,y,-.28,.24);part(r.group,0,y,0,.16,.1,.16,iron);part(r.group,0,y+.1,0,.1,.08,.1,flame);siphon(r,y,.38,.12);});
  // Fire ship: a covered siphon housing in iron and team, a second brazier.
  look('war-galley',r=>{const y=hull(r.group,1.35,.48,.26,wood,team);sail(r,-.16,y,.7,.38,.32,team,cloth);oars(r,3,.48,y,-.36,.2);
   part(r.group,0,y,.3,.3,.18,.2,iron);part(r.group,0,y+.18,.3,.34,.04,.24,team);for(const z of [-.04,.14])part(r.group,0,y,z,.12,.12,.12,flame);siphon(r,y+.04,.42,.14);});
  // Fast fire ship: a long sleek hull with an iron prow, more oars and a twin-nozzle siphon.
  look('fast-fire-ship',r=>{const y=hull(r.group,1.5,.46,.26,dark,gilt);part(r.group,0,-.04,.76,.12,.12,.14,iron);sail(r,-.2,y,.8,.38,.36,team,flame);sail(r,.2,y,.5,.24,.2,cloth,team);oars(r,4,.46,y,-.46,.2);
   for(const x of [-.08,.08])part(r.group,x,y,.44,.06,.06,.18,iron);part(r.group,0,y,.32,.28,.14,.14,iron);siphon(r,y+.06,.5,.16);});
 }else if(kind==='demolition-raft'){
  // Demolition raft: lashed logs heaped with powder kegs and a lit fuse; ship and heavy ship carry more under iron bands.
  const kegs=(r:Rigging,y:number,spots:readonly (readonly [number,number])[],banded:boolean)=>{for(const [x,z] of spots){part(r.group,x,y,z,.14,.16,.14,keg);part(r.group,x,y+.06,z,.15,.03,.15,banded?iron:dark);}
   part(r.group,spots[0][0],y+.16,spots[0][1],.02,.08,.02,rope);part(r.group,spots[0][0],y+.24,spots[0][1],.05,.05,.05,spark);};
  look(null,r=>{for(let i=0;i<5;i++)part(r.group,-.28+i*.14,-.06,0,.12,.12,.78,i%2?wood:plank);for(const z of [-.28,.28])part(r.group,0,.06,z,.72,.04,.06,rope);
   kegs(r,.06,[[-.14,-.12],[.1,-.12],[-.02,.12]],false);part(r.group,.24,.06,.2,.04,.5,.04,wood);part(r.group,.24,.38,.24,.02,.14,.14,team);oars(r,1,.7,.1,-.16,0,.34);});
  look('war-galley',r=>{const y=hull(r.group,.95,.46,.2,wood,team);kegs(r,y,[[-.1,-.16],[.1,-.16],[-.1,.04],[.1,.04],[0,.24]],false);part(r.group,0,y,-.38,.06,.36,.06,wood);part(r.group,0,y+.36,-.38,.08,.08,.08,flame);});
  look('heavy-demolition-ship',r=>{const y=hull(r.group,1.1,.52,.24,dark,iron);kegs(r,y,[[-.12,-.24],[.12,-.24],[-.12,-.04],[.12,-.04],[-.12,.16],[.12,.16],[0,.34]],true);
   for(const z of [-.14,.06])part(r.group,0,y+.16,z,.34,.04,.04,iron);sail(r,-.42,y,.5,.24,.22,team,keg);});
 }else if(kind==='cannon-galleon'){
  // Cannon galleon: a wide deep hull, cannons run out of both sides and the bow, a stern castle; elite: a second gun deck.
  const gun=(r:Rigging,x:number,y:number,z:number,along:boolean)=>{const m=part(r.group,x,y,z,along?.08:.18,.08,along?.2:.08,iron);r.flash??=[];r.flash.push(part(r.group,along?x:x+Math.sign(x)*.12,y,along?z+.13:z,.09,.09,.09,spark));return m;};
  look(null,r=>{const y=hull(r.group,1.55,.64,.34,dark,team);part(r.group,0,y,-.5,.54,.24,.34,wood);part(r.group,0,y+.24,-.5,.58,.04,.38,team);
   for(const z of [-.12,.18])for(const x of [-.34,.34])gun(r,x,y-.16,z,false);gun(r,0,y,.5,true);sail(r,-.06,y,1,.52,.46,cloth,team);sail(r,.3,y,.7,.32,.28,team,cloth);});
  look('elite-cannon-galleon',r=>{const y=hull(r.group,1.7,.7,.4,dark,gilt);part(r.group,0,y,-.56,.6,.34,.4,wood);part(r.group,0,y+.34,-.56,.64,.04,.44,gilt);part(r.group,0,y+.38,-.62,.3,.16,.2,team);
   for(const z of [-.2,.06,.32])for(const x of [-.37,.37]){gun(r,x,y-.2,z,false);}for(const z of [-.06,.2])for(const x of [-.37,.37])gun(r,x,y-.08,z,false);gun(r,0,y,.56,true);
   sail(r,-.12,y,1.16,.58,.52,team,cloth);sail(r,.32,y,.8,.36,.32,cloth,team);part(r.group,0,y+1.16,-.12,.16,.08,.04,gilt);});
 }else if(kind==='longboat'){
  // Longboat: a long low clinker hull, a carved dragon prow and tail, a striped square sail and a shield row.
  const dragon=(r:Rigging,y:number,L:number,color:string)=>{part(r.group,0,y-.02,L*.5,.06,.18,.06,color);part(r.group,0,y+.14,L*.5+.04,.08,.08,.14,color);part(r.group,0,y+.2,L*.5+.12,.04,.04,.06,'#1f1d1b');
   part(r.group,0,y-.02,-L*.47,.06,.14,.06,color);part(r.group,0,y+.12,-L*.47-.06,.05,.06,.1,color);};
  const striped=(r:Rigging,y:number,mast:number,w:number,h:number)=>{part(r.group,0,y,0,.06,mast,.06,wood);const g=group(r.group,'sail',0,0,0);part(g,0,y+mast-.06,0,w+.12,.04,.04,wood);
   for(let i=0;i<5;i++)part(g,-w/2+w*(i+.5)/5,y+mast-.08-h,.04,w/5,h,.02,i%2?cloth:team);r.sails.push({g,z:0});};
  look(null,r=>{const y=hull(r.group,1.6,.44,.18,wood,dark);for(let i=0;i<3;i++)part(r.group,0,.04+i*.05,0,.46-i*.01,.02,.9,i%2?plank:wood);dragon(r,y,1.6,wood);striped(r,y,.8,.44,.36);oars(r,4,.44,y,-.48,.22,.4);shields(r,.44,y+.06,-.52,6,.2);ballista(r,y,.42,.24);});
  look('elite-longboat',r=>{const y=hull(r.group,1.75,.48,.2,dark,gilt);for(let i=0;i<3;i++)part(r.group,0,.04+i*.05,0,.5-i*.01,.02,1,i%2?gilt:wood);dragon(r,y,1.75,gilt);striped(r,y,.96,.5,.44);oars(r,5,.48,y,-.56,.22,.4);shields(r,.48,y+.06,-.58,7,.19);ballista(r,y,.48,.28);});
 }else throw Error(`未知船隻：${kind}`);
 let shown=looks.get(null)!;
 function grade(look:string|null){const next=looks.get(look)??looks.get(null)!;for(const r of looks.values())r.group.visible=r===next;shown=next;}
 const move=afloat(root,body);
 function pose(kind:UnitPose,time:number){const t=clock(time);move(kind,t);animate(shown,kind,t);}
 return {root,sockets:{leftHand:new T.Group(),rightHand:new T.Group()},equip:(_:string)=>{},dress:(_:string)=>{},pose,grade};
}
// Trade cart: an ox in a yoke ahead (+z), two shafts back to a two-wheeled cart with crates, bales and a team canvas
// hoop over them. Walking swings the ox's legs and turns the wheels; a destroyed cart tips over.
export function createTradeCartRig(T:any,player:number,box:Box,material:Material){
 const root=new T.Group();root.name='vessel-trade-cart';const team=teamOf(player),{part,group}=kit(T,box,material);
 const body=group(root,'cart-body'),hide='#8b6a4c',horn='#efe6d2';
 const ox=group(body,'ox',0,0,.5);part(ox,0,.3,0,.32,.3,.56,hide);part(ox,0,.5,.3,.22,.2,.2,hide);part(ox,0,.5,.42,.16,.1,.06,'#5c4a36');for(const x of [-1,1])part(ox,x*.15,.66,.32,.12,.04,.04,horn);
 const legs:any[]=[];for(const [x,z] of [[-.1,.18],[.1,.18],[-.1,-.18],[.1,-.18]]){const l=group(ox,'leg',x,.32,z);part(l,0,-.3,0,.08,.3,.08,'#5c4a36');legs.push(l);}
 part(ox,0,.6,.14,.4,.04,.06,wood);
 for(const x of [-.18,.18])part(body,x,.36,.12,.04,.04,.5,wood);
 const spokes:any[]=[];for(const x of [-.32,.32]){part(body,x,0,-.3,.06,.4,.4,dark);const s=group(body,'wheel-spokes',x+Math.sign(x)*.035,.2,-.3);part(s,0,-.17,0,.02,.34,.04,'#3f3226');part(s,0,-.02,0,.02,.04,.34,'#3f3226');spokes.push(s);}
 part(body,0,.2,-.3,.7,.04,.04,iron);part(body,0,.26,-.3,.56,.08,.62,wood);for(const x of [-.27,.27])part(body,x,.34,-.3,.04,.12,.62,plank);
 part(body,-.1,.34,-.42,.2,.18,.2,'#d8c9a6');part(body,.12,.34,-.2,.16,.16,.16,keg);part(body,.1,.34,-.46,.16,.12,.16,deck);
 // Canvas hoop: two posts and a team-coloured cover over the load.
 for(const z of [-.58,-.02])for(const x of [-.25,.25])part(body,x,.46,z,.03,.3,.03,wood);part(body,0,.76,-.3,.56,.05,.62,team);part(body,0,.81,-.3,.36,.04,.62,cloth);
 function pose(kind:UnitPose,time:number){const t=clock(time),moving=kind==='walk'||kind==='carry',fall=kind==='death'?Math.min(t/700,1):0;
  legs.forEach((l,i)=>{l.rotation.x=moving?Math.sin(t*.012+(i%3?Math.PI:0))*.45:0;});for(const s of spokes)s.rotation.x=moving?-t*.006:0;
  body.rotation.x=kind==='hit'&&t<300?-.05*Math.sin(Math.PI*t/300):0;body.position.y=Math.abs(Math.sin(body.rotation.x))*.6;
  root.rotation.z=-fall*.5;root.position.y=Math.sin(fall*.5)*.36;}
 return {root,sockets:{leftHand:new T.Group(),rightHand:new T.Group()},equip:(_:string)=>{},dress:(_:string)=>{},pose,grade:(_:string|null)=>{}};
}
export type VesselRig=ReturnType<typeof createShipRig>|ReturnType<typeof createTradeCartRig>;
export function createVesselRig(T:any,kind:string,player:number,box:Box,material:Material):VesselRig{
 return kind==='trade-cart'?createTradeCartRig(T,player,box,material):createShipRig(T,kind,player,box,material);
}
// Selection ring and health bar per vessel (the ring's base radius is about 0.43 tiles).
export const vesselFrames:Record<string,{bar:number;ring:number}>={'fishing-ship':{bar:1.15,ring:1.3},'transport-ship':{bar:1.05,ring:1.7},'trade-cog':{bar:1.55,ring:1.5},galley:{bar:1.3,ring:2},'fire-galley':{bar:1.05,ring:1.7},'demolition-raft':{bar:.85,ring:1.3},'cannon-galleon':{bar:1.6,ring:2.1},longboat:{bar:1.25,ring:2.1},'trade-cart':{bar:1.1,ring:1.4}};
