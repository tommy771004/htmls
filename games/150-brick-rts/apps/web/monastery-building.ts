import type {BuildingPart,BuildingVisual} from './building-parts.ts';
// Original brick monastery: a limestone nave with an arched door, a bell tower at the back corner and a walled herb
// garden. Visual only: the parts confer no production, healing or conversion.
export function monasteryParts(v:BuildingVisual):BuildingPart[]{
 if(![1,2,3,4].includes(v.ageVariant)||![v.progress,v.health].every(n=>Number.isFinite(n)&&n>=0&&n<=100))throw Error('無效修道院外觀');
 const p:BuildingPart[]=[],age=v.ageVariant,team=v.red?'#b85c47':'#456e87',wood='#94734c',lime='#d8cfb6',stone='#b9b39d',roof=age===1?'#b8a074':team;
 const add=(id:string,phase:number,x:number,z:number,y:number,w:number,d:number,h:number,color:string,studs=false,shape?:'arch')=>p.push({id,phase,x,z,y,w,d,h,color,studs,...(shape?{shape}:{})});
 const wallTop=1.12+(age>=3?.32:0),towerTop=age<=2?2.24:2.56+(age===4?.32:0);
 add('foundation',0,-.15,-.15,0,3,3,.16,'#b3aa8c');
 // Nave along the depth, door on the front face.
 add('nave',1,.2,.3,.16,1.6,2.2,wallTop-.16,lime);
 add('door',1,.75,2.46,.16,.5,.08,.72,'#6e5a44',false,'arch');
 for(const z of [.8,1.6])for(const x of [.16,1.76])add(`window-${x}-${z}`,1,x,z,.62,.08,.26,.36,'#5b5040');
 for(let level=0;level<3;level++)add(`roof-${level}`,2,.1+level*.3,.2,wallTop+level*.16,1.8-level*.6,2.4,.16,roof,true);
 // Bell tower on the back-right corner: masonry shaft, open belfry on four posts, bell hung from the plate above.
 add('tower',1,2.0,.25,.16,.7,.7,towerTop-.16,age<=2?wood:stone);
 for(const x of [2.0,2.56])for(const z of [.25,.81])add(`belfry-post-${x}-${z}`,2,x,z,towerTop,.14,.14,.48,age<=2?wood:stone);
 add('belfry-plate',2,2.0,.25,towerTop+.48,.7,.7,.12,wood);
 add('bell',3,2.24,.49,towerTop+.26,.22,.22,.22,'#b8964a');add('bell-rope',3,2.33,.58,towerTop+.1,.04,.04,.16,'#d8c48a');
 add('belfry-floor',2,2.0,.25,towerTop-.02,.7,.7,.02,stone);
 add('tower-cap',3,1.95,.2,towerTop+.6,.8,.8,.16,roof,true);add('tower-cap-2',3,2.1,.35,towerTop+.76,.5,.5,.16,roof,true);
 // Walled herb garden to the front right.
 add('garden-soil',1,2.0,1.35,.16,.7,1.25,.06,'#8a6a48');
 for(const z of [1.35,2.5])add(`garden-wall-${z}`,2,2.0,z,.22,.7,.1,.24,stone);
 add('garden-wall-side',2,2.6,1.45,.22,.1,1.05,.24,stone);
 for(const z of [1.6,1.95,2.25])add(`herb-${z}`,3,2.2,z,.22,.26,.2,.16,'#6f8a55',true);
 // Ages: a stone plinth course (2), buttresses and a raised ridge (3), a spire and a round window (4).
 if(age>=2)for(const z of [.3,2.34])add(`plinth-${z}`,1,.14,z,.16,1.72,.16,.24,stone);
 if(age>=3){for(const z of [.6,1.4])for(const x of [.05,1.8])add(`buttress-${x}-${z}`,1,x,z,.16,.15,.3,wallTop-.48,stone);
  add('roof-ridge',2,.5,.3,wallTop+.48,1.0,2.2,.16,roof,true);}
 if(age===4){add('spire',4,2.25,.45,towerTop+.92,.2,.3,.48,roof);add('finial',4,2.3,.5,towerTop+1.4,.1,.2,.16,'#c9a55a');
  add('rose-window',3,.84,2.5,wallTop-.46,.32,.03,.32,'#c9a55a');}
 add('flag-pole',4,.02,2.63,.16,.06,.06,1.6,wood);add('flag',4,.08,2.63,1.42,.44,.05,.28,team);
 if(v.health===0)return [p[0],...Array.from({length:12},(_,i)=>({id:`debris-${i}`,phase:0,x:.2+(i%4)*.6,z:.2+Math.floor(i/4)*.7,y:.16,w:.34,d:.3,h:.12,color:lime,studs:false}))];
 return p.filter(a=>a.phase<=Math.min(4,Math.floor(v.progress/20))).filter(a=>v.health>=50||!(a.id==='flag'||a.id==='bell'||a.id==='bell-rope'||a.id==='finial'));
}
