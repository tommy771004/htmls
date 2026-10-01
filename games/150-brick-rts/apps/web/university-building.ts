import type {BuildingPart,BuildingVisual} from './building-parts.ts';
import {obstacleFootprints} from '../../packages/content/footprints.ts';
// Original brick university on the 3x3 footprint: a lecture hall behind a columned porch (a lectern with an open book on
// it and a scroll rack on the side wall), an observatory tower at the back corner and a treadwheel crane in the yard
// lifting a dressed stone. Ages change the structure: a plastered timber hall under straw with a wooden lookout (1); a
// sandstone hall on a stone plinth under a team roof, stone tower (2); taller walls with arched windows, the observatory
// drum with its telescope, the crane's jib and load (3); a stepped dome over the hall, an armillary ring on the
// observatory and a gilt clock face (4). Visual only: research and the techs' effects live in the sim.
export function universityParts(v:BuildingVisual):BuildingPart[]{
 if(![1,2,3,4].includes(v.ageVariant)||![v.progress,v.health].every(n=>Number.isFinite(n)&&n>=0&&n<=100))throw Error('無效學院外觀');
 const p:BuildingPart[]=[],age=v.ageVariant,team=v.red?'#b85c47':'#456e87';
 const wood='#94734c',oak='#6e5438',plaster='#e3d7b8',sand='#d6b77e',stone='#c4bba2',straw='#b8a074',dark='#4a4740',brass='#b8964a',gilt='#c9a55a',paper='#efe6cc',leather='#7a4a32';
 const add=(id:string,phase:number,x:number,z:number,y:number,w:number,d:number,h:number,color:string,studs=false,shape?:'arch')=>p.push({id,phase,x,z,y,w,d,h,color,studs,...(shape?{shape}:{})});
 const f=obstacleFootprints.university;
 add('foundation',0,f.x/100,f.y/100,0,f.width/100,f.depth/100,.16,'#b3aa8c');
 const wall=age===1?plaster:sand,roof=age===1?straw:team,trim=age===1?wood:stone;
 const wallTop=1.28+(age>=3?.32:0),beamY=wallTop-.36,towerTop=[1.9,2.2,2.5,2.8][age-1];
 // Lecture hall (x .05-2.05, z .1-1.5) with its door on the porch side.
 add('hall',1,.05,.1,.16,2,1.4,wallTop-.16,wall);
 // First age: timber posts at the visible corners; later a stone plinth course along the yard side.
 if(age===1){for(const x of [.05,1.95])add(`timber-front-${x}`,1,x,1.5,.24,.1,.06,beamY-.24,wood);for(const z of [.1,1.4])add(`timber-side-${z}`,1,2.05,z,.16,.06,.1,wallTop-.16,wood);}
 else add('plinth',1,2.05,.1,.16,.06,1.4,.2,stone);
 // Porch: a raised floor, four columns and the beam that roofs it (held by the columns and the hall front).
 add('porch',1,.1,1.5,.16,1.9,.5,.08,trim);add('step',1,.7,2,.16,.7,.18,.05,trim);
 for(const [i,x] of [.18,.62,1.34,1.78].entries())add(`column-${i}`,1,x,1.76,.24,.14,.14,beamY-.24,age===1?wood:'#e6dcc3');
 add('porch-beam',2,.1,1.5,beamY,1.9,.42,.14,trim);
 // Stepped hip roof, a fourth tier from the third age.
 const tiers=age>=3?4:3;for(let level=0;level<tiers;level++)add(`roof-${level}`,2,-.05+level*.25,level*.15,wallTop+level*.16,2.2-level*.5,1.6-level*.3,.16,roof,true);
 // Door and windows on the porch face; the side facing the yard has square windows.
 add('door',3,.82,1.5,.24,.46,.04,age>=3?.8:.64,'#5a4632',false,'arch');
 for(const x of [.36,1.46])add(`window-front-${x}`,3,x,1.5,.62,.24,.03,age>=3?.5:.26,'#3f4a4c',false,age>=3?'arch':undefined);
 for(const z of [.82,1.14])add(`window-side-${z}`,3,2.05,z,.66,.03,.2,.3,'#3f4a4c');
 // Lectern with an open book on the porch; scroll rack against the far side wall.
 add('lectern-post',3,.46,1.66,.24,.06,.06,.34,oak);add('lectern-top',3,.4,1.6,.58,.2,.16,.05,oak);
 add('book',3,.42,1.62,.63,.16,.12,.025,leather);add('book-pages',3,.43,1.63,.655,.14,.1,.02,paper);
 add('scroll-rack',1,-.1,.35,.16,.15,.9,.78,oak);
 for(let row=0;row<3;row++)for(let col=0;col<4;col++)add(`scroll-${row}-${col}`,3,-.13,.42+col*.2,.26+row*.22,.03,.1,.1,paper);
 // Observatory tower (x 2.15-2.75, z .1-.7) behind the yard.
 add('tower',1,2.15,.1,.16,.6,.6,towerTop-.16,age===1?wood:stone);
 add('tower-deck',2,2.1,.05,towerTop,.7,.7,.1,trim);
 const deck=towerTop+.1;
 if(age<=2){add('tower-cap',2,2.15,.1,deck,.6,.6,.16,roof,true);add('tower-cap-2',2,2.3,.25,deck+.16,.3,.3,.16,roof,true);
  for(const [x,z] of [[2.1,.05],[2.75,.05],[2.1,.7],[2.75,.7]])add(`rail-${x}-${z}`,3,x,z,deck,.05,.05,.14,oak);}
 else{
  // The observatory drum with a sighting slit facing the yard and a brass telescope pushed out through it.
  add('observatory',3,2.2,.15,deck,.5,.5,.32,stone);add('sight-slit',3,2.41,.65,deck+.04,.08,.02,.26,dark);
  add('observatory-cap',3,2.15,.1,deck+.32,.6,.6,.12,roof,true);add('observatory-cap-2',3,2.3,.25,deck+.44,.3,.3,.12,roof,true);
  add('telescope',4,2.42,.67,deck+.2,.07,.36,.07,brass);add('telescope-lens',4,2.41,1.03,deck+.19,.09,.04,.09,dark);
 }
 if(age===4){
  // Armillary ring on a post above the observatory, and a clock face on the tower's yard side.
  const top=deck+.56;add('armillary-post',4,2.42,.37,top,.06,.06,.1,gilt);
  add('armillary-low',4,2.26,.38,top+.1,.36,.04,.04,gilt);add('armillary-high',4,2.26,.38,top+.42,.36,.04,.04,gilt);
  for(const x of [2.22,2.62])add(`armillary-side-${x}`,4,x,.38,top+.1,.04,.04,.36,gilt);
  add('armillary-band',4,2.26,.38,top+.24,.36,.04,.04,brass);add('armillary-ball',4,2.39,.34,top+.46,.12,.12,.12,gilt);
  add('clock',3,2.32,.7,towerTop-.62,.26,.03,.26,'#efe9da');add('clock-hand',3,2.44,.73,towerTop-.56,.03,.02,.14,dark);
  // Stepped dome over the hall on the top roof tier.
  const r=wallTop+tiers*.16;add('dome-drum',3,.75,.5,r,.6,.6,.2,stone);
  for(const [i,s] of [.5,.36,.22].entries())add(`dome-${i}`,3,1.05-s/2,.8-s/2,r+.2+[0,.14,.26][i],s,s,[.14,.12,.1][i],team);
  add('dome-finial',4,1.01,.76,r+.56,.08,.08,.2,gilt);
 }
 // Treadwheel crane in the yard: two octagonal rims on a timber sill joined by treads and an axle; from the third age a
 // mast and a jib lift a dressed stone on a rope.
 add('crane-sill',1,2.12,1.62,.16,.66,1.2,.08,oak);
 // Each rim is an octagon of blocks meeting face to face, with a cross of spokes; the axle and treads span the rims.
 const segments:[string,number,number,number,number][]=[['bottom',1.92,2.38,.24,.34],['top',1.92,2.38,1.06,1.16],['low-a',1.76,1.92,.28,.52],['side-a',1.7,1.76,.48,.92],['high-a',1.76,1.92,.88,1.1],['low-b',2.38,2.54,.28,.52],['side-b',2.54,2.6,.48,.92],['high-b',2.38,2.54,.88,1.1],['spoke-v',2.11,2.19,.34,1.06],['spoke-a',1.76,2.11,.65,.73],['spoke-b',2.19,2.54,.65,.73]];
 for(const [rim,x] of [['a',2.18],['b',2.64]] as const)for(const [name,z0,z1,y0,y1] of segments)add(`wheel-${rim}-${name}`,3,x,z0,y0,.08,z1-z0,y1-y0,wood);
 add('wheel-axle',3,2.26,2.11,.65,.38,.08,.08,dark);
 for(const [z,y] of [[1.98,.24],[2.26,.24],[1.72,.6],[2.52,.6],[1.98,1.08]])add(`tread-${z}-${y}`,3,2.26,z,y,.38,.08,.08,wood);
 // The mast stands at the yard's back corner and the jib reaches forward over the wheel, clear of the porch.
 if(age>=3){add('crane-mast',3,2.74,1.62,.24,.1,.12,1.8,oak);add('crane-jib',4,2.74,1.74,1.94,.1,1.1,.1,oak);
  add('crane-rope',4,2.77,2.72,1.36,.04,.04,.58,'#d8c48a');add('crane-load',4,2.66,2.62,1.14,.19,.22,.22,'#b5b29e');}
 add('flag-pole',4,-.12,2.72,.16,.06,.06,1.6,wood);add('flag',4,-.06,2.72,1.48,.44,.05,.28,team);
 if(v.health===0)return [p[0],...Array.from({length:12},(_,i)=>({id:`debris-${i}`,phase:0,x:.1+(i%4)*.65,z:.15+Math.floor(i/4)*.85,y:.16,w:.36,d:.3,h:.12,color:i%3?wall:stone,studs:false}))];
 // Damage: the flag, the telescope, the armillary, the crane's load and one porch column go; everything left stays held.
 const lost=/^(flag|telescope|telescope-lens|armillary-.*|crane-rope|crane-load|column-1|dome-finial|clock-hand)$/;
 return p.filter(a=>a.phase<=Math.min(4,Math.floor(v.progress/20))).filter(a=>v.health>=50||!lost.test(a.id));
}
