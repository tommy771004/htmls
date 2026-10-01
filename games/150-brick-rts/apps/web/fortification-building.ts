import type {BuildingPart,BuildingVisual} from './building-parts.ts';
// Original brick fortifications on one tile each: palisade and stone wall segments that join their neighbours, the two
// gates, the outpost and the bombard tower. A wall segment is a central post or pier with an arm out to every linked
// neighbour of the same material (orthogonal arms reach the tile edge; diagonal arms step toward the corner in
// overlapping blocks, the brick way to draw a slant), so a dragged line reads as one continuous wall. Visual only:
// hit points, the gate's passability and the tower's shot live in the sim.
export const wallKinds=['palisade-wall','stone-wall'] as const;
export const gateKinds=['palisade-gate','gate'] as const;
export type WallKind=typeof wallKinds[number];
export type GateKind=typeof gateKinds[number];
// Which neighbouring tiles hold a wall or gate of the same material (n = toward -z, e = toward +x).
export type WallLinks={n:boolean;s:boolean;e:boolean;w:boolean;ne:boolean;nw:boolean;se:boolean;sw:boolean};
export const noLinks:WallLinks={n:false,s:false,e:false,w:false,ne:false,nw:false,se:false,sw:false};
// The material family of a fortification kind (a gate joins the walls of its own material).
export const wallFamily=(kind:string)=>kind==='palisade-wall'||kind==='palisade-gate'?'palisade':kind==='stone-wall'||kind==='gate'?'stone':null;
const check=(v:BuildingVisual,what:string)=>{if(![1,2,3,4].includes(v.ageVariant)||![v.progress,v.health].every(n=>Number.isFinite(n)&&n>=0&&n<=100))throw Error(`無效${what}外觀`);};
const wood='#94734c',oak='#6e5438',dark='#4a4740',stone='#b5b29e',stoneDark='#9d9a88',soil='#806b49',iron='#5b5e5c',flame='#e0a040',spark='#f5dc7a',straw='#b8a074',gilt='#c9a55a';
type Add=(id:string,phase:number,x:number,z:number,y:number,w:number,d:number,h:number,color:string,studs?:boolean)=>void;
function builder(){const p:BuildingPart[]=[];const add:Add=(id,phase,x,z,y,w,d,h,color,studs=false)=>{p.push({id,phase,x,z,y,w,d,h,color,studs});};return {p,add};}
// Construction stages, damage (ornaments go) and rubble, as in the other one-tile buildings.
function finish(p:BuildingPart[],v:BuildingVisual,debris:string,lost:RegExp,count=4){
 if(v.health===0)return [p[0],...Array.from({length:count},(_,i)=>({id:`debris-${i}`,phase:0,x:.1+(i%2)*.45,z:.1+Math.floor(i/2)*.45,y:.04,w:.3,d:.28,h:.1,color:debris,studs:false}))];
 return p.filter(a=>a.phase<=Math.min(4,Math.floor(v.progress/20))).filter(a=>v.health>=50||!lost.test(a.id));}
const diagonals=[['ne',1,-1],['nw',-1,-1],['se',1,1],['sw',-1,1]] as const;
// Palisade: sharpened stakes lashed with a rail. Stone wall: a pier with merlons, coping and slits from the third age.
export function wallParts(kind:WallKind,v:BuildingVisual,links:WallLinks=noLinks):BuildingPart[]{
 check(v,'城牆');if(!wallKinds.includes(kind))throw Error('未知城牆');const {p,add}=builder(),age=v.ageVariant,team=v.red?'#b85c47':'#456e87';
 if(kind==='palisade-wall'){
  const H=1.04+(age>=3?.12:0),stake=(id:string,x:number,z:number,y:number,h:number,w:number,d:number)=>{add(id,1,x,z,y,w,d,h,wood);add(`${id}-tip`,2,x+w*.25,z+d*.25,y+h,w*.5,d*.5,.14,oak);};
  add('foundation',0,.32,.32,0,.36,.36,.06,soil);stake('stake-c',.4,.4,.06,H+.04,.2,.2);
  // The owner's colour: a lashing round the middle stake.
  add('lashing',3,.39,.39,.62,.22,.22,.08,team);
  for(const [dir,dx,dz] of [['e',1,0],['w',-1,0],['s',0,1],['n',0,-1]] as const)if(links[dir]){
   for(let i=1;i<=2;i++)stake(`stake-${dir}-${i}`,dx?.4+.2*i*dx:.41,dz?.4+.2*i*dz:.41,0,H-(i%2)*.06,dx?.2:.18,dz?.2:.18);
   add(`rail-${dir}`,2,dx>0?.6:dx<0?0:.45,dz>0?.6:dz<0?0:.45,.52,dx?.4:.1,dz?.4:.1,.08,oak);}
  for(const [dir,dx,dz] of diagonals)if(links[dir])for(const [i,t] of [.2,.38].entries())stake(`stake-${dir}-${i}`,.39+dx*t,.39+dz*t,0,H-.06*(i+1),.22,.22);
  return finish(p,v,wood,/-tip$|^rail-/);
 }
 const H=.96+(age>=3?.16:0),top=.08+H;
 add('foundation',0,.2,.2,0,.6,.6,.08,stoneDark);add('pier',1,.22,.22,.08,.56,.56,H,stone,true);
 // The owner's colour: a painted shield on the pier, on both faces.
 for(const z of [.2,.78])add(`shield-${z}`,3,.42,z,.42,.16,.02,.2,team);
 for(const [dir,dx,dz] of [['e',1,0],['w',-1,0],['s',0,1],['n',0,-1]] as const)if(links[dir]){
  const x=dx>0?.78:dx<0?0:.25,z=dz>0?.78:dz<0?0:.25,w=dx?.22:.5,d=dz?.22:.5;add(`arm-${dir}`,1,x,z,0,w,d,top,stone,true);
  add(`merlon-${dir}`,2,dx>0?.84:dx<0?.0:.37,dz>0?.84:dz<0?.0:.37,top,dx?.16:.26,dz?.16:.26,.2,stone);
  if(age>=3)add(`slit-${dir}`,3,dx?x+.06:.24,dz?z+.06:.24,.5,dx?.1:.02,dz?.1:.02,.24,dark);}
 for(const [dir,dx,dz] of diagonals)if(links[dir])for(const [i,t] of [.28,.38].entries())add(`arm-${dir}-${i}`,1,.38+dx*t,.38+dz*t,0,.24,.24,top-.04*i,stone,true);
 for(const [x,z] of [[.22,.22],[.64,.22],[.22,.64],[.64,.64]])add(`merlon-c-${x}-${z}`,2,x,z,top,.14,.14,.2,stone);
 if(age>=3)add('coping',3,.3,.3,top,.4,.4,.06,stoneDark);
 return finish(p,v,stone,/^(merlon-[en]|merlon-c-0\.64-0\.64|coping)$/);
}
// Gates: drawn along the wall line (x when the gate joins east or west, or stands alone; z otherwise). Stone: two
// towers with an arched course over oak doors banded in iron and the team colour; palisade: two thick posts, a beam
// and plank doors with a brace.
export function gateParts(kind:GateKind,v:BuildingVisual,links:WallLinks=noLinks):BuildingPart[]{
 check(v,'城門');if(!gateKinds.includes(kind))throw Error('未知城門');const {p,add}=builder(),age=v.ageVariant,team=v.red?'#b85c47':'#456e87';
 if(kind==='gate'){
  const H=1.32+(age>=3?.16:0);
  add('foundation',0,0,.22,0,1,.56,.06,stoneDark);
  for(const [i,x] of [0,.74].entries()){add(`tower-${i}`,1,x,.2,.06,.26,.6,H,stone,true);for(const z of [.2,.66])add(`merlon-${i}-${z}`,2,x+.06,z,.06+H,.14,.14,.18,stone);
   if(age===4){add(`cap-${i}`,3,x+.02,.36,.06+H,.22,.28,.12,team,true);add(`finial-${i}`,4,x+.09,.46,.18+H,.08,.08,.16,gilt);}}
  add('lintel',2,.26,.24,.94,.48,.52,H-.88,stone,true);add('door-l',3,.26,.46,.06,.24,.08,.88,oak);add('door-r',3,.5,.46,.06,.24,.08,.88,oak);
  for(const y of [.24,.62])add(`band-${y}`,3,.28,.44,y,.44,.02,.06,iron);add('crest',3,.42,.42,.98,.16,.04,.18,team);
 }else{
  const H=1.2+(age>=3?.12:0);
  add('foundation',0,0,.3,0,1,.4,.04,soil);
  for(const [i,x] of [0,.78].entries()){add(`post-${i}`,1,x,.38,.04,.22,.24,H,wood);add(`post-${i}-tip`,2,x+.05,.44,.04+H,.12,.12,.14,oak);}
  add('beam',2,.22,.42,.04+H-.16,.56,.16,.14,oak);add('door-l',3,.22,.44,.04,.28,.1,H-.2,wood);add('door-r',3,.5,.44,.04,.28,.1,H-.2,wood);
  for(const [i,y] of [.22,.7].entries())add(`brace-${i}`,3,.24,.42,y,.52,.02,.06,oak);add('pennant',4,.48,.5,.04+H-.02,.06,.04,.28,team);
 }
 const alongZ=!(links.e||links.w)&&(links.n||links.s);
 // Turned a quarter: transpose x and z (the parts stay inside the tile).
 const turned=alongZ?p.map(a=>({...a,x:a.z,z:a.x,w:a.d,d:a.w})):p;
 return finish(turned,v,kind==='gate'?stone:wood,/^(finial-|crest|pennant|post-\d-tip)/);
}
// Outpost: a timber lookout on four legs over a stone footing, a ladder, a railing and a torch burning at one corner;
// later ages raise it and put a roof over it.
export function outpostParts(v:BuildingVisual):BuildingPart[]{
 check(v,'哨站');const {p,add}=builder(),age=v.ageVariant,team=v.red?'#b85c47':'#456e87',deckY=1.18+(age-1)*.14;
 add('foundation',0,.1,.1,0,.8,.8,.1,age>=2?stoneDark:soil);
 for(const [x,z] of [[.14,.14],[.74,.14],[.14,.74],[.74,.74]])add(`leg-${x}-${z}`,1,x,z,.1,.12,.12,deckY-.1,wood);
 for(const y of [.5,.9])add(`brace-${y}`,1,.26,.14,y,.48,.04,.06,oak);
 add('deck',2,.06,.06,deckY,.88,.88,.08,wood,true);
 for(const [x,z,w,d] of [[.06,.06,.88,.06],[.06,.88,.88,.06],[.06,.12,.06,.76],[.88,.12,.06,.76]])add(`rail-${x}-${z}`,3,x,z,deckY+.08,w,d,.2,oak);
 for(const x of [.36,.58])add(`ladder-rail-${x}`,1,x,.88,.1,.04,.04,deckY-.1,oak);for(let i=0;i<4;i++)add(`rung-${i}`,1,.4,.88,.3+i*(deckY-.4)/4,.18,.04,.04,oak);
 add('torch-post',3,.8,.8,deckY+.08,.06,.06,.42,oak);add('torch-cup',3,.78,.78,deckY+.5,.1,.1,.06,iron);add('torch-flame',4,.8,.8,deckY+.56,.06,.06,.12,flame);add('torch-spark',4,.815,.815,deckY+.68,.03,.03,.06,spark);
 if(age>=2){for(const [x,z] of [[.08,.08],[.08,.8]])add(`roof-post-${z}`,3,x,z,deckY+.08,.06,.06,.5,oak);add('roof',3,0,.04,deckY+.58,.6,.9,.08,age>=3?team:straw,true);}
 add('pennant-pole',4,.12,.12,deckY+(age>=2?.66:.08),.04,.04,.34,oak);add('pennant',4,.16,.12,deckY+(age>=2?.86:.28),.22,.03,.12,team);
 return finish(p,v,wood,/^(pennant|torch-spark|torch-flame)/);
}
// Bombard tower: a squat stone drum (octagonal in plan, banded in iron), a gun deck with merlons, a turret under a
// team cap, a bombard run out of the front embrasure and another over the parapet, powder kegs at its foot. Distinct
// from the watch tower grades: wider, lower, stone to the top, and armed with guns rather than a lookout.
export function bombardTowerParts(v:BuildingVisual):BuildingPart[]{
 check(v,'火砲塔');const {p,add}=builder(),team=v.red?'#b85c47':'#456e87',H=.86;
 add('foundation',0,0,0,0,1,1,.12,stoneDark);
 // A battered base course the full tile wide, then the drum (octagonal in plan), banded in iron.
 add('batter',1,.02,.02,.12,.96,.96,.26,stoneDark,true);const y0=.38;
 add('drum',1,.1,.1,y0,.8,.8,H,stone,true);add('drum-x',1,.04,.22,y0,.92,.56,H,stone);add('drum-z',1,.22,.04,y0,.56,.92,H,stone);
 for(const y of [y0+.24,y0+.62])add(`band-${y}`,2,.03,.21,y,.94,.58,.06,iron);
 add('embrasure',2,.34,.96,y0+.26,.32,.02,.28,dark);add('barrel-front',3,.39,.97,y0+.3,.22,.2,.2,iron);add('muzzle',3,.37,1.0,y0+.28,.26,.03,.24,'#3f4240');
 add('deck',2,0,0,y0+H,1,1,.08,stoneDark);const top=y0+H+.08;
 for(const [x,z] of [[0,0],[.4,0],[.8,0],[0,.4],[.8,.4],[0,.8],[.8,.8]])add(`merlon-${x}-${z}`,3,x,z,top,.2,.2,.2,stone);
 // On the deck: a big bombard on a timber bed aimed out over the front parapet, under a team awning post.
 add('gun-bed',3,.3,.24,top,.4,.5,.08,'#6e5438');add('barrel-top',3,.36,.3,top+.08,.28,.62,.24,iron);for(const z of [.44,.66])add(`barrel-band-${z}`,3,.34,z,top+.06,.32,.06,.28,'#3f4240');
 add('barrel-mouth',3,.38,.92,top+.1,.24,.04,.2,'#1f1d1b');
 add('cap-post',3,.06,.44,top,.08,.08,.5,'#6e5438');add('cap',4,.02,.4,top+.5,.24,.2,.06,team,true);
 for(const [x,z] of [[.0,.0],[.84,.0]])add(`keg-${x}`,3,x,z,.12,.16,.16,.18,'#7c5a3a');
 return finish(p,v,stone,/^(cap|barrel-mouth|barrel-band-0\.66|merlon-0\.4-0)$/);
}
