import type {BuildingPart,BuildingVisual} from './building-parts.ts';
export const economicBuildings=['lumber-camp','mining-camp','mill','farm','town-center','market','smithy'] as const;
export type EconomicBuilding=typeof economicBuildings[number];
// Original art dimensions only. No economy, capacity or working-state rules.
export function economicBuildingParts(kind:EconomicBuilding,v:BuildingVisual):BuildingPart[]{
 if(!economicBuildings.includes(kind)||![1,2,3,4].includes(v.ageVariant)||![v.progress,v.health].every(n=>Number.isFinite(n)&&n>=0&&n<=100))throw Error('無效經濟建築外觀');
 const p:BuildingPart[]=[],team=v.red?'#b85c47':'#456e87',wood='#94734c',stone='#aaa994',height=1.28+(v.ageVariant-1)*.16;
 const add=(id:string,phase:number,x:number,z:number,y:number,w:number,d:number,h:number,color:string,studs=false,shape?:'arch')=>p.push({id,phase,x,z,y,w,d,h,color,studs,...(shape?{shape}:{})});
 add('foundation',0,-.15,-.15,0,3,3,.16,kind==='farm'?'#806b49':'#b3aa8c');
 if(kind==='farm'){
  for(let row=0;row<4;row++){
   add(`furrow-${row}`,1,.12,.12+row*.65,.16,2.45,.36,.12,'#6d563d');
   for(let col=0;col<5;col++){add(`crop-${row}-${col}`,2,.2+col*.47,.19+row*.65,.28,.18,.18,.24,'#879957',true);add(`grain-${row}-${col}`,3,.22+col*.47,.21+row*.65,.52,.14,.14,.13,'#c0ad67');}
  }
  add('boundary-back',1,0,0,.16,2.7,.08,.12,wood);add('boundary-front',1,0,2.62,.16,2.7,.08,.12,wood);
 }else{
  const roofY=height+(kind==='mill'?.96:.16);
  for(const x of [.1,2.4])for(const z of [.1,1.8])add(`post-${x}-${z}`,1,x,z,.16,.16,.16,roofY-.16, v.ageVariant>=3?stone:wood);
  add('back-brace',1,.1,.1,roofY-.24,2.46,.14,.24,wood);
  if(kind==='market'){
   for(let stripe=0;stripe<6;stripe++)add(`awning-${stripe}`,2,-.05+stripe*.48,-.05,roofY,.48,2.25,.16,stripe%2?'#e4d4ab':team);
  }else for(let level=0;level<3;level++)add(`roof-${level}`,2,-.05+level*.28,-.05,roofY+level*.16,2.9-level*.56,2.25,.16,v.ageVariant===1?'#b8a074':team,true);
  if(kind==='lumber-camp'){
   for(let row=0;row<3;row++)for(let layer=0;layer<2;layer++)add(`log-${row}-${layer}`,3,.25,.3+row*.28,.16+layer*.2,1.6,.22,.2,wood,true);
   for(const x of [.55,1.75])add(`saw-leg-${x}`,3,x,2.15,.16,.14,.32,.45,'#66563e');
   add('saw-worktop',3,.35,2.08,.61,1.8,.48,.12,wood);add('saw-blade',3,.9,2.24,.73,.85,.06,.14,'#b8c0b9');
  }else if(kind==='mining-camp'){
   add('hopper-base',3,.35,.4,.16,1.7,.9,.16,wood);
   for(const x of [.35,1.89])add(`hopper-wall-${x}`,3,x,.4,.32,.16,.9,.55,wood);
   add('hopper-back',3,.35,.4,.32,1.7,.16,.55,wood);
   for(let i=0;i<6;i++)add(`ore-${i}`,3,.59+(i%3)*.39,.62+Math.floor(i/3)*.32,.32,.3,.26,.25,i%2?stone:'#c0a557',true);
   add('pick-handle',3,2.42,.8,.16,.06,.06,1.05,wood);add('pick-head',3,2.2,.8,1.12,.5,.08,.1,'#b8c0b9');
  }else if(kind==='mill'){
   for(let course=0;course<6;course++)add(`mill-tower-${course}`,1,.85,.6,.16+course*.4,1,1,.4,course%2?stone:'#c4bfa8',true);
   const hubY=height+.75;
   add('axle',3,1.28,1.6,hubY,.14,.83,.14,wood);
   add('blade-vertical',3,1.26,2.37,hubY-1.12,.18,.1,2.4,'#d6c6a0');
   add('blade-horizontal',3,.15,2.48,hubY,2.4,.1,.18,'#d6c6a0');
   add('hub',3,1.19,2.33,hubY-.04,.32,.29,.28,'#7c674b');
   for(const x of [.22,2.13])add(`grain-bag-${x}`,3,x,.7,.16,.38,.4,.48,'#c5b285',true);
  }else if(kind==='town-center'){
   for(const x of [.15,2.05])add(`hall-pier-${x}`,1,x,.15,.16,.5,1.5,height,stone,true);
   add('entrance-lintel',1,.65,1.5,.16,1.4,.25,height-.16,stone,false,'arch');
   for(let level=0;level<3;level++)add(`entrance-step-${level}`,3,.8,2.15+level*.18,.16,.95,.18,.24-level*.08,'#c8bea4');
   const towerBase=roofY+.48;
   add('belfry-floor',3,.87,.65,towerBase,.96,.85,.16,stone,true);
   for(const x of [.91,1.63])for(const z of [.69,1.25])add(`belfry-pillar-${x}-${z}`,3,x,z,towerBase+.16,.12,.12,.65,stone);
   add('belfry-top',3,.8,.58,towerBase+.81,1.1,1,.16,team,true);
   add('bell-hanger',3,1.33,.98,towerBase+.55,.05,.05,.26,wood);
   add('bell',3,1.2,.88,towerBase+.4,.3,.28,.22,'#bca068');
   add('notice-board',3,.14,1.9,.72,.48,.08,.4,wood);add('notice-paper',3,.2,1.99,.78,.34,.025,.27,'#e5d9b3');
   add('cargo-crate',3,2.1,2.1,.16,.42,.42,.38,wood,true);
  }else if(kind==='market'){
   // Keep the central aisle open in the visual; authority navigation is not implied.
   for(const x of [.24,1.94]){
    add(`stall-${x}`,3,x,.35,.16,.52,1.38,.48,wood);
    for(let i=0;i<3;i++)add(`goods-${x}-${i}`,3,x+.08,.48+i*.4,.64,.34,.28,.18,i%2?'#b9a76c':'#8f9e5e',true);
   }
   add('scale-post',3,2.18,1.48,.64,.04,.04,.46,'#8c8879');
   add('scale-beam',3,1.98,1.48,1.1,.44,.04,.04,'#8c8879');
   for(const x of [1.99,2.36]){add(`scale-wire-${x}`,3,x,1.48,.9,.025,.025,.2,'#8c8879');add(`scale-pan-${x}`,3,x-.05,1.43,.87,.13,.13,.04,'#b8b3a0');}
  }else if(kind==='smithy'){
   add('forge-back',1,.28,.22,.16,1.05,.3,1.05,stone,true);
   for(const x of [.28,1.05])add(`forge-side-${x}`,1,x,.52,.16,.28,.7,.85,stone);
   add('forge-lintel',1,.28,.52,1.01,1.05,.7,.2,stone);
   add('cold-hearth',3,.56,.52,.16,.49,.7,.16,'#4e514b');
   add('chimney',3,.55,.28,1.21,.5,.5,roofY-.41,stone,true);
   add('chimney-cap',3,.49,.22,roofY+.8,.62,.62,.12,'#73786d');
   add('anvil-base',3,1.7,1.7,.16,.5,.45,.34,wood);
   add('anvil-neck',3,1.83,1.8,.5,.23,.25,.2,'#76817d');
   add('anvil-face',3,1.6,1.71,.7,.7,.43,.12,'#a0aaa5');
   add('bellows',3,1.34,.56,.16,.65,.5,.25,'#927052');
   add('coal-bin',3,.25,2.14,.16,.65,.42,.22,'#665940');
   for(let i=0;i<3;i++)add(`coal-${i}`,3,.31+i*.17,2.21,.38,.13,.22,.1,'#424944');
  }
 }
 add('marker-pole',4,2.65,2.7,.16,.06,.06,kind==='farm'?.65:height+.6,wood);
 add('marker-flag',4,2.34,2.7,kind==='farm'?.61:height+.44,.32,.05,.22,team);
 if(v.health===0)return [p[0],...Array.from({length:12},(_,i)=>({id:`debris-${i}`,phase:0,x:.2+(i%4)*.6,z:.2+Math.floor(i/4)*.7,y:.16,w:.34,d:.3,h:.12,color:wood,studs:false}))];
 return p.filter(a=>a.phase<=Math.min(4,Math.floor(v.progress/20))).filter(a=>v.health>=50||!(a.id==='marker-flag'||a.id==='roof-2'||a.id==='awning-2'||a.id==='awning-4'||a.id.startsWith('grain-')||a.id==='blade-horizontal'));
}
