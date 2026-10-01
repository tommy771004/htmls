import type {BuildingPart,BuildingVisual} from './building-parts.ts';
// Original brick watch tower (one tile: a tapering stone shaft, a timber lookout and a team-coloured roof) and siege
// workshop (an open timber shed with a half-built ram frame, logs and a wheel). Visual only.
const check=(v:BuildingVisual,what:string)=>{if(![1,2,3,4].includes(v.ageVariant)||![v.progress,v.health].every(n=>Number.isFinite(n)&&n>=0&&n<=100))throw Error(`無效${what}外觀`);};
function finish(p:BuildingPart[],v:BuildingVisual,debris:string,keep:(id:string)=>boolean){
 if(v.health===0)return [p[0],...Array.from({length:6},(_,i)=>({id:`debris-${i}`,phase:0,x:(i%3)*.3,z:Math.floor(i/3)*.4,y:.12,w:.26,d:.24,h:.1,color:debris,studs:false}))];
 return p.filter(a=>a.phase<=Math.min(4,Math.floor(v.progress/20))).filter(a=>v.health>=50||keep(a.id));}
// The University's tower upgrades seen on the owner's own towers (the enemy's research is not projected): a guard tower
// stands taller with a stone lookout; a keep taller still, its lookout on corbels with a spire over the roof.
export const towerGrades=['guard-tower','keep'] as const;
export type TowerGrade=typeof towerGrades[number];
export const towerGradeOf=(techs:readonly string[]):TowerGrade|null=>techs.includes('keep')?'keep':techs.includes('guard-tower')?'guard-tower':null;
export const towerLift=(grade:TowerGrade|null)=>grade==='keep'?.64:grade==='guard-tower'?.32:0;
export function towerParts(v:BuildingVisual,grade:TowerGrade|null=null):BuildingPart[]{
 check(v,'箭塔');if(grade!==null&&!towerGrades.includes(grade))throw Error('無效箭塔升級外觀');
 const p:BuildingPart[]=[],age=v.ageVariant,team=v.red?'#b85c47':'#456e87',wood='#94734c',stone='#b5b29e',roof=age===1?'#b8a074':team;
 const add=(id:string,phase:number,x:number,z:number,y:number,w:number,d:number,h:number,color:string,studs=false)=>p.push({id,phase,x,z,y,w,d,h,color,studs});
 const shaft=1.6+(age-1)*.24+towerLift(grade),top=grade?stone:wood;
 add('foundation',0,-.05,-.05,0,1.1,1.1,.12,'#b3aa8c');
 add('shaft',1,.08,.08,.12,.84,.84,shaft*.55,stone);add('shaft-upper',2,.14,.14,.12+shaft*.55,.72,.72,shaft*.45,stone);
 add('door',1,.36,.9,.12,.28,.04,.4,'#6e5a44');
 add('lookout',3,0,0,.12+shaft,1,1,.14,top);for(const [x,z] of [[0,0],[.84,0],[0,.84],[.84,.84]])add(`post-${x}-${z}`,3,x,z,.26+shaft,.16,.16,.36,top);
 if(grade)for(const [x,z,w,d] of [[.16,0,.18,.08],[.66,0,.18,.08],[.16,.92,.18,.08],[.66,.92,.18,.08],[0,.16,.08,.18],[0,.66,.08,.18],[.92,.16,.08,.18],[.92,.66,.08,.18]])add(`${grade}-merlon-${x}-${z}`,3,x,z,.26+shaft,w,d,.16,stone);
 if(grade==='keep')for(const [x,z,w,d] of [[.08,0,.84,.08],[.08,.92,.84,.08],[0,.08,.08,.84],[.92,.08,.08,.84]])add(`keep-corbel-${x}-${z}`,3,x,z,shaft,w,d,.12,'#9d9a88');
 add('roof',4,-.06,-.06,.62+shaft,1.12,1.12,.14,roof,true);add('roof-top',4,.2,.2,.76+shaft,.6,.6,.14,roof,true);
 if(grade==='keep')add('roof-spire',4,.35,.35,.9+shaft,.3,.3,.2,roof);
 // Slits sit on whichever shaft section is at their height (the upper one is narrower).
 if(age>=3)for(let i=0;i<4;i++){const y=.5+i*.3,upper=y>=.12+shaft*.55;add(`slit-${i}`,2,.47,i%2?(upper?.12:.1):(upper?.86:.9),y,.06,.02,.2,'#4a4740');}
 const flagBase=grade==='keep'?1.1+shaft:.9+shaft;add('flag',4,.46,.46,flagBase,.06,.06,.5,wood);add('pennant',4,.52,.46,flagBase+.32,.3,.04,.16,team);
 // The flag stands on the roof top (on the keep's spire), so it falls with it.
 return finish(p,v,stone,id=>!(id==='pennant'||id==='roof-top'||id==='flag'||id==='roof-spire'));
}
export function siegeWorkshopParts(v:BuildingVisual):BuildingPart[]{
 check(v,'攻城器工坊');const p:BuildingPart[]=[],age=v.ageVariant,team=v.red?'#b85c47':'#456e87',wood='#94734c',dark='#6e5438',roof=age===1?'#b8a074':team;
 const add=(id:string,phase:number,x:number,z:number,y:number,w:number,d:number,h:number,color:string,studs=false)=>p.push({id,phase,x,z,y,w,d,h,color,studs});
 const top=1.44;
 add('foundation',0,-.15,-.15,0,3,3,.16,'#b3aa8c');
 for(const x of [.1,2.44])for(const z of [.1,1.65])add(`post-${x}-${z}`,1,x,z,.16,.16,.16,top-.16,wood);
 add('back-wall',1,.1,.1,.16,2.5,.15,top-.16,wood);
 for(let level=0;level<2;level++)add(`roof-${level}`,2,-.05+level*.35,-.05,top+level*.16,2.9-level*.7,1.98,.16,roof,true);
 // A ram frame under construction, a pile of logs and a spare wheel in the yard.
 add('ram-bed',3,.5,.6,.16,1.6,.7,.12,dark);add('ram-log',3,.45,.8,.4,1.8,.3,.3,wood);for(const x of [.6,1.8])add(`ram-rib-${x}`,3,x,.6,.28,.1,.7,.6,dark);
 for(let i=0;i<3;i++)add(`log-${i}`,3,.3,2.05+i*.2,.16,1.4,.18,.18,wood);add('log-top',3,.5,2.15,.34,1.0,.18,.18,wood);
 add('wheel',3,2.1,2.0,.16,.14,.6,.6,dark);add('wheel-hub',3,2.08,2.2,.36,.18,.2,.2,'#c9a55a');
 if(age>=3)add('crane-arm',4,2.2,.3,top-.1,.14,1.2,.14,wood);
 add('flag-pole',4,2.67,2.63,.16,.06,.06,1.6,wood);add('flag',4,2.24,2.63,1.42,.44,.05,.28,team);
 return finish(p,v,wood,id=>!(id==='flag'||id==='crane-arm'));
}
