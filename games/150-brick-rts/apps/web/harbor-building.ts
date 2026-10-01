import type {BuildingPart,BuildingVisual} from './building-parts.ts';
// Original brick dock (3x3 on the water, footprint origin at its corner) and fish trap (2x2 net on the water). The dock
// is drawn with its shore side toward -z, then turned so that side faces the land it was built against (scene.ts
// passes the quarter turns): a plank deck on the water, a boat shed on the shore side, mooring piles and bollards along
// the water edge, a crane swinging a net of catch over the water. Ages change the structure: a straw-roofed shed (1);
// stone footings and a team roof (2); a stone quay along the shore and a taller crane with its load (3); a small
// lighthouse with a brass lamp on the water corner (4). Visual only: training, research and drop-offs live in the sim.
const check=(v:BuildingVisual,what:string)=>{if(![1,2,3,4].includes(v.ageVariant)||![v.progress,v.health].every(n=>Number.isFinite(n)&&n>=0&&n<=100))throw Error(`無效${what}外觀`);};
const wood='#94734c',oak='#6e5438',plank='#a4824f',deck='#8a6c48',stone='#b5b29e',stoneDark='#9d9a88',straw='#b8a074',rope='#d8c48a',iron='#5b5e5c',brass='#b8964a',net='#7c8a78',keg='#7c5a3a',fish='#d5e7de',lamp='#f5dc7a';
// Quarter turns about the centre of a size x size footprint: (x, z) -> (size - z, x) per turn, boxes stay boxes.
export function turnParts(parts:BuildingPart[],size:number,quarters:number):BuildingPart[]{
 let out=parts;for(let q=0;q<((quarters%4)+4)%4;q++)out=out.map(a=>({...a,x:size-a.z-a.d,z:a.x,w:a.d,d:a.w}));return out;}
function finish(p:BuildingPart[],v:BuildingVisual,debris:string,lost:RegExp,size:number){
 if(v.health===0)return [p[0],...Array.from({length:12},(_,i)=>({id:`debris-${i}`,phase:0,x:.15+(i%4)*size/4.4,z:.15+Math.floor(i/4)*size/3.4,y:p[0].h,w:.32*size/3,d:.28*size/3,h:.1,color:debris,studs:false}))];
 return p.filter(a=>a.phase<=Math.min(4,Math.floor(v.progress/20))).filter(a=>v.health>=50||!lost.test(a.id));}
// landSide: quarter turns that bring the shore side (-z in the drawing) round to the land: 0 land at -z, 1 at +x,
// 2 at +z, 3 at -x.
export function dockParts(v:BuildingVisual,landSide=0):BuildingPart[]{
 check(v,'碼頭');const p:BuildingPart[]=[],age=v.ageVariant,team=v.red?'#b85c47':'#456e87';
 const add=(id:string,phase:number,x:number,z:number,y:number,w:number,d:number,h:number,color:string,studs=false)=>p.push({id,phase,x,z,y,w,d,h,color,studs});
 add('foundation',0,0,0,0,3,3,.16,deck);
 for(let i=0;i<6;i++)add(`plank-${i}`,1,.04,.04+i*.49,.16,2.92,.47,.03,i%2?plank:deck);
 const y=.19;
 // Mooring piles at the water edge (z 3) and along both sides, bollards with coiled rope between them.
 for(const x of [0,1.42,2.84])add(`pile-${x}`,1,x,2.84,0,.16,.16,.72,oak);for(const z of [1.5])for(const x of [0,2.84])add(`pile-side-${x}`,1,x,z,0,.16,.16,.6,oak);
 for(const x of [.6,2.2]){add(`bollard-${x}`,3,x,2.7,y,.14,.14,.2,iron);add(`rope-${x}`,3,x-.06,2.66,y,.26,.04,.06,rope);}
 // Boat shed on the shore side: walls, a door toward the water, a roof in tiers.
 const wallH=.96+(age>=3?.16:0),shed=age===1?wood:age===2?plank:stone;
 if(age>=2)for(const x of [.12,1.52])add(`footing-${x}`,1,x,.12,y,.2,1.16,.12,stoneDark);
 const base=age>=2?y+.12:y;add('shed-back',1,.12,.12,base,1.6,.16,wallH,shed);for(const x of [.12,1.56])add(`shed-side-${x}`,1,x,.28,base,.16,1,wallH,shed);
 add('shed-front-l',1,.28,1.12,base,.36,.16,wallH,shed);add('shed-front-r',1,1.2,1.12,base,.36,.16,wallH,shed);add('shed-lintel',1,.64,1.12,base+.62,.56,.16,wallH-.62,shed);
 add('shed-door',3,.64,1.24,base,.56,.04,.6,oak);
 const roofY=base+wallH,roof=age===1?straw:team;for(let i=0;i<3;i++)add(`roof-${i}`,2,.04+i*.26,.06+i*.16,roofY+i*.16,1.8-i*.52,1.36-i*.32,.16,roof,true);
 // Catch on the deck: barrels, a fish basket.
 add('barrel-0',3,1.86,.3,y,.22,.22,.28,keg);add('barrel-1',3,1.86,.56,y,.22,.22,.22,keg);add('basket',3,1.86,1.3,y,.3,.26,.16,'#c9b27a');add('catch',3,1.9,1.34,y+.16,.22,.18,.05,fish);
 // Crane at the shore corner: mast, a jib reaching out over the water, the rope and a net of fish (from the third age).
 const mastH=1.7+(age>=3?.3:0);add('crane-foot',1,2.4,.2,y,.36,.36,.14,stoneDark);add('crane-mast',3,2.5,.3,y+.14,.16,.16,mastH,oak);
 add('crane-jib',3,2.5,.46,y+.14+mastH-.16,.16,1.9,.14,oak);
 if(age>=3){add('crane-rope',4,2.56,2.24,y+.62,.04,.04,mastH-.64,rope);add('crane-net',4,2.46,2.14,y+.4,.24,.24,.22,net);add('crane-fish',4,2.5,2.18,y+.62,.16,.16,.06,fish);}
 if(age>=3)add('quay',1,0,0,y,3,.12,.24,stone,true);
 // Lighthouse on the far water corner.
 if(age===4){add('light-base',3,.1,2.2,y,.5,.5,1.2,stone,true);add('light-room',3,.16,2.26,y+1.2,.38,.38,.26,lamp);add('light-cap',4,.12,2.22,y+1.46,.46,.46,.12,team,true);add('light-top',4,.26,2.36,y+1.58,.18,.18,.14,brass);}
 add('flag-pole',4,2.82,.02,y,.06,.06,1.3,wood);add('flag',4,2.42,.02,y+1.04,.4,.05,.24,team);
 return turnParts(finish(p,v,plank,/^(flag|crane-net|crane-fish|crane-rope|light-top|roof-2|rope-.*)$/,3),3,landSide);
}
// Fish trap: a 2x2 net on the water ringed by floating logs, stakes at the corners, floats in the team colour and fish
// caught in the mesh; a lantern on a stake from the fourth age.
export function fishTrapParts(v:BuildingVisual):BuildingPart[]{
 check(v,'魚網');const p:BuildingPart[]=[],age=v.ageVariant,team=v.red?'#b85c47':'#456e87';
 const add=(id:string,phase:number,x:number,z:number,y:number,w:number,d:number,h:number,color:string,studs=false)=>p.push({id,phase,x,z,y,w,d,h,color,studs});
 add('foundation',0,.12,.12,0,1.76,1.76,.03,net);
 add('log-n',1,0,0,0,2,.14,.1,wood);add('log-s',1,0,1.86,0,2,.14,.1,wood);add('log-w',1,0,.14,0,.14,1.72,.1,wood);add('log-e',1,1.86,.14,0,.14,1.72,.1,wood);
 for(const [x,z] of [[0,0],[1.86,0],[0,1.86],[1.86,1.86]])add(`stake-${x}-${z}`,2,x+.02,z+.02,.1,.1,.1,.42,oak);
 for(const [i,x] of [.5,.95,1.4].entries()){add(`float-n-${i}`,3,x,.02,.1,.1,.1,.08,i%2?'#ece2c4':team);add(`float-s-${i}`,3,x,1.88,.1,.1,.1,.08,i%2?'#ece2c4':team);}
 if(age>=2)for(const t of [.62,1.02,1.42]){add(`mesh-x-${t}`,3,.14,t-.02,.03,1.72,.04,.02,'#5d6b5f');add(`mesh-z-${t}`,3,t-.02,.14,.03,.04,1.72,.02,'#5d6b5f');}
 for(const [x,z] of [[.5,.7],[1.2,1.1],[.8,1.4]])add(`fish-${x}`,3,x,z,.03,.22,.08,.05,fish);
 if(age===4){add('lantern',4,1.87,1.87,.52,.08,.08,.1,lamp);add('lantern-cap',4,1.86,1.86,.62,.1,.1,.04,iron);}
 add('pennant',4,.04,.04,.52,.04,.04,.26,oak);add('pennant-cloth',4,.08,.04,.66,.18,.03,.1,team);
 return finish(p,v,wood,/^(pennant.*|lantern.*|float-.-1)$/,2);
}
