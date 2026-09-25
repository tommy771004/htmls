import type {BuildingPart,BuildingVisual} from './building-parts.ts';
export const militaryBuildings=['barracks','archery-range','stable'] as const;
export type MilitaryBuilding=typeof militaryBuildings[number];
// Original visual prototypes; these parts confer no production or combat abilities.
export function militaryBuildingParts(kind:MilitaryBuilding,v:BuildingVisual):BuildingPart[]{
 if(!militaryBuildings.includes(kind)||![1,2,3,4].includes(v.ageVariant)||![v.progress,v.health].every(n=>Number.isFinite(n)&&n>=0&&n<=100))throw Error('無效軍事建築外觀');
 const p:BuildingPart[]=[],team=v.red?'#b85c47':'#456e87',wood='#94734c',stone='#b5b29e',top=1.44+(v.ageVariant-1)*.16;
 const add=(id:string,phase:number,x:number,z:number,y:number,w:number,d:number,h:number,color:string,studs=false,shape?:'arch')=>p.push({id,phase,x,z,y,w,d,h,color,studs,...(shape?{shape}:{})});
 add('foundation',0,-.15,-.15,0,3,3,.16,'#b3aa8c');
 if(kind==='archery-range'){
  for(const x of [.1,2.5]){add(`fence-post-${x}`,1,x,.12,.16,.13,2.1,.5,wood);}
  add('backstop',1,.1,.12,.16,2.53,.18,1.1,wood);
  for(const x of [.36,1.67]){add(`target-leg-${x}`,2,x+.23,.75,.16,.1,.2,.75,wood);add(`target-board-${x}`,2,x,.72,.83,.56,.16,.6,'#cfbd87');add(`target-ring-${x}`,3,x+.1,.89,.93,.36,.03,.4,'#aa5c48');add(`target-center-${x}`,3,x+.2,.93,1.03,.16,.03,.2,'#e5d4a8');}
  add('arrow-rack',3,.22,2.3,.16,.7,.27,.4,wood);
  for(let i=0;i<4;i++)add(`arrow-${i}`,3,.3+i*.14,2.4,.56,.03,.03,.42,'#d2be8f');
 }else{
  for(const x of [.1,2.44])for(const z of [.1,1.65])add(`post-${x}-${z}`,1,x,z,.16,.16,.16,top-.16,v.ageVariant>=3?stone:wood);
  add('back-wall',1,.1,.1,.16,2.5,.15,top-.16,kind==='stable'?wood:stone);
  for(let level=0;level<3;level++)add(`roof-${level}`,2,-.05+level*.28,-.05,top+level*.16,2.9-level*.56,1.98,.16,v.ageVariant===1?'#b8a074':team,true);
  if(kind==='barracks'){
   add('drill-floor',1,.3,1.85,.16,2.1,.85,.08,'#a59a76');
   add('weapon-rack',3,.3,.5,.16,.15,1.1,.75,wood);
   for(let i=0;i<3;i++){add(`spear-shaft-${i}`,3,.32,.6+i*.3,.16,.04,.04,1.15,wood);add(`spear-point-${i}`,3,.28,.58+i*.3,1.31,.12,.08,.2,'#bdc5bd');}
   for(const x of [.5,1.05,1.6]){add(`shield-support-${x}`,3,x,1.9,.24,.08,.15,.62,wood);add(`shield-${x}`,3,x-.08,2.02,.43,.36,.08,.44,team);add(`shield-boss-${x}`,3,x+.04,2.11,.57,.1,.04,.12,'#bca36f');}
  }else{
   for(const x of [.15,1.75]){add(`stall-divider-${x}`,1,x,.35,.16,.1,1.3,.65,wood);add(`hay-${x}`,3,x+.16,.4,.16,.62,.55,.3,'#beac69',true);}
   add('trough-base',3,.6,2.03,.16,1.5,.4,.12,wood);
   for(const z of [2.03,2.35])add(`trough-rim-${z}`,3,.6,z,.28,1.5,.08,.2,wood);
   for(const x of [.6,2.02])add(`trough-end-${x}`,3,x,2.11,.28,.08,.24,.2,wood);
   add('trough-water',3,.69,2.12,.29,1.32,.22,.035,'#6a9297');
   add('saddle-rack',3,2.48,.9,.16,.12,.15,.85,wood);add('spare-saddle',3,2.3,.84,1.01,.45,.4,.16,'#716045');
  }
 }
 // Age additions are structural silhouettes, not research or production state.
 if(v.ageVariant>=2){
  if(kind==='archery-range'){
   for(const x of [.1,2.44])add(`canopy-post-${x}`,1,x,.12,.16,.16,.18,top-.16,wood);
   add('canopy-beam',1,.1,.12,top,2.5,.18,.16,wood);
   add('canopy-roof',2,-.05,-.02,top+.16,2.8,.7,.16,team,true);
  }else{
   for(const x of [.1,2.44])add(`porch-foot-${x}`,1,x-.07,1.58,.16,.3,.3,.32,stone);
   add('porch-beam',1,.1,1.65,top-.16,2.5,.16,.16,wood);
   add('ridge-cap',2,.79,-.05,top+.48,1.22,1.98,.16,team,true);
  }
 }
 if(v.ageVariant>=3){
  if(kind==='archery-range'){
   // Raised masonry backstop and buttresses leave target lanes open.
   add('stone-backstop',1,.1,-.04,.16,2.5,.16,1.28,stone);
   for(const x of [.1,2.3])add(`backstop-buttress-${x}`,1,x,.13,.16,.3,.35,1.12,stone);
   for(let i=0;i<5;i++)add(`backstop-crenel-${i}`,2,.1+i*.5,-.04,1.44,.3,.16,.24,stone,true);
  }else{
   for(const z of [.1,1.6])for(const x of [-.05,2.6])add(`buttress-${x}-${z}`,1,x,z,.16,.15,.3,top-.16,stone);
   add('porch-arch',1,.26,1.65,.16,2.18,.16,top-.16,stone,false,'arch');
  }
 }
 if(v.ageVariant===4){
  if(kind==='archery-range'){
   // Two supported end turrets preserve the range's open-yard identity.
   for(const x of [.1,2.2]){
    add(`turret-base-${x}`,2,x,.05,top+.32,.4,.4,.16,stone);
    for(const dx of [0,.28])add(`turret-post-${x}-${dx}`,3,x+dx,.05,top+.48,.12,.4,.48,stone);
    add(`turret-cap-${x}`,3,x-.05,0,top+.96,.5,.5,.16,team,true);
   }
  }else{
   const base=top+.64;
   add('vent-base',2,.91,.5,base,.96,.8,.16,stone);
   for(const x of [.91,1.71])for(const z of [.5,1.14])add(`vent-post-${x}-${z}`,3,x,z,base+.16,.16,.16,.48,stone);
   add('vent-cap',3,.83,.42,base+.64,1.12,.96,.16,team,true);
   add('vent-crown',4,1.07,.58,base+.8,.64,.64,.16,team,true);
  }
 }
 add('flag-pole',4,2.67,2.63,.16,.06,.06,1.6,wood);add('flag',4,2.24,2.63,1.42,.44,.05,.28,team);
 if(v.health===0)return [p[0],...Array.from({length:12},(_,i)=>({id:`debris-${i}`,phase:0,x:.2+(i%4)*.6,z:.2+Math.floor(i/4)*.7,y:.16,w:.34,d:.3,h:.12,color:wood,studs:false}))];
 return p.filter(a=>a.phase<=Math.min(4,Math.floor(v.progress/20))).filter(a=>v.health>=50||!(a.id==='flag'||a.id.startsWith('target-center')||a.id==='vent-crown'||a.id.startsWith('backstop-crenel')));
}
