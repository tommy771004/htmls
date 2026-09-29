import type {BuildingPart,BuildingVisual} from './building-parts.ts';
// Original brick blacksmith: a stone forge hall open at the front, a tall chimney with a glowing hearth, an anvil on
// a stump and a rack of finished blades. Visual only: the parts confer no research.
export function blacksmithParts(v:BuildingVisual):BuildingPart[]{
 if(![1,2,3,4].includes(v.ageVariant)||![v.progress,v.health].every(n=>Number.isFinite(n)&&n>=0&&n<=100))throw Error('無效鐵匠鋪外觀');
 const p:BuildingPart[]=[],age=v.ageVariant,team=v.red?'#b85c47':'#456e87',wood='#94734c',stone='#a9a693',dark='#5d5a52',roof=age===1?'#b8a074':team;
 const add=(id:string,phase:number,x:number,z:number,y:number,w:number,d:number,h:number,color:string,studs=false,shape?:'arch')=>p.push({id,phase,x,z,y,w,d,h,color,studs,...(shape?{shape}:{})});
 const top=1.28+(age>=3?.16:0);
 add('foundation',0,-.15,-.15,0,3,3,.16,'#b3aa8c');
 // Back and side walls; the front stays open onto the anvil.
 add('back-wall',1,.1,.1,.16,2.5,.2,top-.16,stone);
 for(const x of [.1,2.4])add(`side-wall-${x}`,1,x,.3,.16,.2,1.5,top-.16,stone);
 for(let level=0;level<2;level++)add(`roof-${level}`,2,-.05+level*.3,-.05,top+level*.16,2.9-level*.6,1.95,.16,roof,true);
 // Chimney at the back corner with the hearth's glow at its foot.
 add('chimney',2,1.75,.1,.16,.5,.5,top+.9,dark);add('chimney-cap',3,1.7,.05,top+1.06,.6,.6,.1,'#4a4740');
 add('hearth',1,1.7,.62,.16,.6,.4,.36,dark);add('hearth-fire',3,1.8,.7,.52,.4,.25,.1,'#e8793c');
 // Anvil on a stump in the yard, a quench tub and a rack of blades.
 add('stump',3,.95,1.95,.16,.36,.36,.3,wood);add('anvil',3,.88,1.97,.46,.5,.3,.14,'#6b6f6c');add('anvil-horn',3,1.38,2.03,.5,.14,.18,.08,'#6b6f6c');
 add('tub',3,1.7,2.05,.16,.42,.42,.3,wood);add('tub-water',3,1.76,2.11,.44,.3,.3,.03,'#6a9297');
 add('rack',3,.3,.5,.16,.15,1.1,.75,wood);for(let i=0;i<3;i++)add(`blade-${i}`,3,.28,.6+i*.3,.3,.06,.06,.7,'#c6cfca');
 if(age>=2){add('porch-beam',1,.1,1.75,top-.16,2.5,.16,.16,wood);for(const x of [.1,2.44])add(`porch-post-${x}`,1,x,1.75,.16,.16,.16,top-.32,wood);}
 if(age>=3)for(const x of [-.05,2.6])add(`buttress-${x}`,1,x,.3,.16,.15,.3,top-.32,stone);
 if(age===4){add('bellows',4,2.0,.7,.16,.3,.4,.3,'#7a5c40');add('ridge-crest',4,.9,.4,top+.32,1.0,1.2,.16,roof,true);}
 add('flag-pole',4,2.67,2.63,.16,.06,.06,1.6,wood);add('flag',4,2.24,2.63,1.42,.44,.05,.28,team);
 if(v.health===0)return [p[0],...Array.from({length:12},(_,i)=>({id:`debris-${i}`,phase:0,x:.2+(i%4)*.6,z:.2+Math.floor(i/4)*.7,y:.16,w:.34,d:.3,h:.12,color:stone,studs:false}))];
 return p.filter(a=>a.phase<=Math.min(4,Math.floor(v.progress/20))).filter(a=>v.health>=50||!(a.id==='flag'||a.id==='hearth-fire'||a.id==='chimney-cap'));
}
