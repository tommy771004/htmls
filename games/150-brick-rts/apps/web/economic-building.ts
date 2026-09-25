import type {BuildingPart,BuildingVisual} from './building-parts.ts';
export const economicBuildings=['lumber-camp','mining-camp','mill','farm','town-center','market','smithy'] as const;
export type EconomicBuilding=typeof economicBuildings[number];
// Original art dimensions only. No economy, capacity or working-state rules.
export function economicBuildingParts(kind:EconomicBuilding,v:BuildingVisual):BuildingPart[]{
 if(!economicBuildings.includes(kind)||![1,2,3,4].includes(v.ageVariant)||![v.progress,v.health].every(n=>Number.isFinite(n)&&n>=0&&n<=100))throw Error('無效經濟建築外觀');
 const p:BuildingPart[]=[],age=v.ageVariant,team=v.red?'#b85c47':'#456e87',wood='#94734c',stone='#aaa994',brass='#bca068',water='#6a9297',height=1.28+(age-1)*.16;
 const add=(id:string,phase:number,x:number,z:number,y:number,w:number,d:number,h:number,color:string,studs=false,shape?:'arch')=>p.push({id,phase,x,z,y,w,d,h,color,studs,...(shape?{shape}:{})});
 add('foundation',0,-.15,-.15,0,3,3,.16,kind==='farm'?'#806b49':'#b3aa8c');
 if(kind==='farm'){
  for(let row=0;row<4;row++){
   add(`furrow-${row}`,1,.12,.12+row*.65,.16,2.45,.36,.12,'#6d563d');
   for(let col=0;col<5;col++){add(`crop-${row}-${col}`,2,.2+col*.47,.19+row*.65,.28,.18,.18,.24,'#879957',true);add(`grain-${row}-${col}`,3,.22+col*.47,.21+row*.65,.52,.14,.14,.13,'#c0ad67');}
  }
  // Age ladder: open rails, fenced plot, stone boundary with gate piers, finished gateway.
  if(age<=2){add('boundary-back',1,0,0,.16,2.7,.08,.12,wood);add('boundary-front',1,0,2.62,.16,2.7,.08,.12,wood);}
  else{
   add('wall-back',1,0,0,.16,2.7,.08,.24,stone);
   for(const [x,w] of [[0,1.08],[1.62,1.08]])add(`wall-front-${x}`,1,x,2.62,.16,w,.08,.24,stone);
   for(const x of [1.08,1.46])add(`gate-pier-${x}`,1,x,2.58,.16,.16,.16,.56,stone,true);
  }
  if(age>=2){
   for(const x of [0,2.62])add(age>=3?`wall-side-${x}`:`boundary-side-${x}`,1,x,.08,.16,.08,2.54,age>=3?.24:.12,age>=3?stone:wood);
   for(const x of [-.12,2.72])for(const z of [-.12,2.72])add(`fence-post-${x}-${z}`,1,x,z,.16,.1,.1,age>=3?.56:.45,age>=3?stone:wood);
  }
  if(age===4){
   add('gate-lintel',1,1.08,2.58,.72,.54,.16,.16,team,true);
   // Scarecrow stands in the gap between the second and third furrows.
   add('scarecrow-post',3,1.3,1.24,.16,.06,.06,.64,wood);
   add('scarecrow-arms',3,1.1,1.24,.8,.46,.06,.06,wood);
   add('scarecrow-head',3,1.25,1.19,.86,.16,.16,.22,'#c7b27a');
   add('scarecrow-hat',3,1.2,1.15,1.08,.26,.24,.06,'#6d563d');
  }
 }else{
  // The town hall is taller so its fixed entrance arch clears a villager standing on the plinth.
  const hallHeight=1.6+(age-1)*.16,towerTop=.16+(age>=3?6:5)*.4,roofY=kind==='mill'?towerTop:kind==='town-center'?hallHeight+.16:height+.16,masonry=kind!=='town-center',postBase=masonry&&age>=2?.4:.16;
  // From the second age, posts stand on stone footings instead of sinking into them.
  for(const x of [.1,2.4])for(const z of [.1,1.8])add(`post-${x}-${z}`,1,x,z,postBase,.16,.16,roofY-postBase,age>=3?stone:wood);
  add('back-brace',1,.1,.1,roofY-.24,2.46,.14,.24,wood);
  if(kind==='market'){
   for(let stripe=0;stripe<6;stripe++)add(`awning-${stripe}`,2,-.05+stripe*.48,-.05,roofY,.48,2.25,.16,stripe%2?'#e4d4ab':team);
  }else for(let level=0;level<3;level++)add(`roof-${level}`,2,-.05+level*.28,-.05,roofY+level*.16,2.9-level*.56,2.25,.16,age===1?'#b8a074':team,true);
  // Shared age vocabulary: stone footings, then a masonry back course and side piers.
  if(masonry&&age>=2)for(const x of [.1,2.4])for(const z of [.1,1.8])add(`footing-${x}-${z}`,1,x-.02,z-.02,.16,.2,.2,.24,stone);
  if(masonry&&age>=3){
   if(kind!=='smithy')add('stone-plinth',1,.28,.1,.16,2.1,.14,.48,stone,true);
   for(const x of [-.04,2.56])for(const z of [.3,1.46])add(`buttress-${x}-${z}`,1,x,z,.16,.14,.3,roofY-.16,stone);
  }
  if(kind==='lumber-camp'){
   for(let row=0;row<3;row++)for(let layer=0;layer<2;layer++)add(`log-${row}-${layer}`,3,.25,.3+row*.28,.16+layer*.2,1.6,.22,.2,wood,true);
   for(const x of [.55,1.75])add(`saw-leg-${x}`,3,x,2.15,.16,.14,.32,.45,'#66563e');
   add('saw-worktop',3,.35,2.08,.61,1.8,.48,.12,wood);add('saw-blade',3,.9,2.24,.73,.85,.06,.14,'#b8c0b9');
   if(age>=2){add('chopping-block',3,2,.9,.16,.35,.35,.3,'#7c674b',true);add('axe-handle',3,2.15,1.05,.46,.05,.05,.4,wood);add('axe-head',3,2.08,1.04,.78,.2,.07,.08,'#b8c0b9');}
   if(age===4){
    // Jib crane outside the roof line; rope and hook hang from the jib.
    add('crane-mast',3,2.5,2.3,.16,.16,.16,roofY+.32,wood);
    add('crane-jib',3,1.2,2.3,roofY+.48,1.46,.16,.16,wood);
    add('crane-rope',3,1.34,2.36,roofY-.32,.04,.04,.8,'#8c8879');
    add('crane-hook',3,1.28,2.3,roofY-.44,.16,.16,.12,'#76817d');
   }
  }else if(kind==='mining-camp'){
   add('hopper-base',3,.35,.4,.16,1.7,.9,.16,wood);
   for(const x of [.35,1.89])add(`hopper-wall-${x}`,3,x,.4,.32,.16,.9,.55,wood);
   add('hopper-back',3,.35,.4,.32,1.7,.16,.55,wood);
   for(let i=0;i<6;i++)add(`ore-${i}`,3,.59+(i%3)*.39,.62+Math.floor(i/3)*.32,.32,.3,.26,.25,i%2?stone:'#c0a557',true);
   add('pick-handle',3,2.42,.8,.16,.06,.06,1.05,wood);add('pick-head',3,2.2,.8,1.12,.5,.08,.1,'#b8c0b9');
   if(age>=2){
    for(const z of [2.3,2.62])add(`rail-${z}`,1,.7,z,.16,1.1,.06,.06,'#76817d');
    add('cart-body',3,1,2.26,.22,.5,.46,.3,'#7c674b');add('cart-ore',3,1.08,2.34,.52,.34,.3,.12,'#c0a557',true);
   }
   if(age===4){
    // Headframe with a hanging bucket over the rail cart.
    for(const x of [.4,1.94])add(`headframe-leg-${x}`,3,x,2.42,.16,.16,.16,roofY+.12,wood);
    add('headframe-beam',3,.4,2.42,roofY+.28,1.7,.16,.16,wood);
    add('headframe-wheel',3,1.1,2.44,roofY+.44,.3,.12,.3,'#76817d');
    add('headframe-rope',3,1.23,2.48,1.2,.04,.04,roofY-.92,'#8c8879');
    add('headframe-bucket',3,1.13,2.38,.96,.24,.24,.24,'#7c674b');
   }
  }else if(kind==='mill'){
   for(let course=0;course<(age>=3?6:5);course++)add(`mill-tower-${course}`,1,.85,.6,.16+course*.4,1,1,.4,course%2?stone:'#c4bfa8',true);
   const hubY=towerTop-.5;
   add('axle',3,1.28,1.6,hubY,.14,.83,.14,wood);
   add('blade-vertical',3,1.26,2.37,hubY-1.12,.18,.1,2.4,'#d6c6a0');
   add('blade-horizontal',3,.15,2.48,hubY,2.4,.1,.18,'#d6c6a0');
   add('hub',3,1.19,2.33,hubY-.04,.32,.29,.28,'#7c674b');
   for(const x of [.22,2.13])add(`grain-bag-${x}`,3,x,.7,.16,.38,.4,.48,'#c5b285',true);
   if(age>=2){add('sail-cloth-upper',3,1.44,2.39,hubY+.36,.3,.06,.84,'#e8dcc0');add('sail-cloth-lower',3,.96,2.39,hubY-1,.3,.06,.8,'#e8dcc0');}
   if(age===4){
    const base=roofY+.48;
    add('cupola-base',2,1,.6,base,.8,.8,.16,stone);
    for(const x of [1,1.68])for(const z of [.6,1.28])add(`cupola-post-${x}-${z}`,3,x,z,base+.16,.12,.12,.4,stone);
    add('cupola-cap',3,.92,.52,base+.56,.96,.96,.16,team,true);
    add('vane-pole',4,1.38,.98,base+.72,.04,.04,.5,'#76817d');
    add('vane-arrow',4,1.42,.98,base+1.06,.3,.03,.12,brass);
   }
  }else if(kind==='town-center'){
   for(const x of [.15,2.05])add(`hall-pier-${x}`,1,x,.15,.16,.5,1.5,hallHeight,stone,true);
   // Fixed arch size in every age: the authority footprint's walkable gate depends on it.
   add('entrance-lintel',1,.65,1.5,.16,1.4,.25,1.6,stone,false,'arch');
   if(hallHeight>1.6)add('entrance-course',1,.65,1.5,1.76,1.4,.25,hallHeight-1.6,stone);
   // Flush paving, not raised steps, so walkers never clip into a stair on the way in.
   add('entrance-paving',3,.95,1.75,.16,.8,1.05,.02,'#c8bea4');
   // The belfry arrives with the second age; later ages raise it on masonry and crown it.
   if(age>=2){
    let towerBase=roofY+.48;
    if(age>=3)for(let course=0;course<2;course++)add(`tower-course-${course}`,2,.87,.65,towerBase+course*.32,.96,.85,.32,stone);
    if(age>=3)towerBase+=.64;
    add('belfry-floor',3,.87,.65,towerBase,.96,.85,.16,stone,true);
    for(const x of [.91,1.63])for(const z of [.69,1.25])add(`belfry-pillar-${x}-${z}`,3,x,z,towerBase+.16,.12,.12,.65,stone);
    add('belfry-top',3,.8,.58,towerBase+.81,1.1,1,.16,team,true);
    add('bell-hanger',3,1.33,.98,towerBase+.55,.05,.05,.26,wood);
    add('bell',3,1.2,.88,towerBase+.4,.3,.28,.22,brass);
    if(age===4){
     const top=towerBase+.97;
     add('spire-0',3,.95,.73,top,.8,.7,.16,team,true);
     add('spire-1',3,1.1,.88,top+.16,.5,.4,.16,team);
     add('spire-2',3,1.23,.98,top+.32,.24,.2,.24,team);
     add('spire-finial',4,1.31,1.04,top+.56,.08,.08,.3,brass);
    }
   }
   add('notice-board',3,.14,1.9,.72,.48,.08,.4,wood);add('notice-paper',3,.2,1.98,.78,.34,.025,.27,'#e5d9b3');
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
   if(age>=2)for(let stripe=0;stripe<6;stripe++)add(`valance-${stripe}`,2,-.05+stripe*.48,2.14,roofY-.12,.48,.06,.12,stripe%2?team:'#e4d4ab');
   if(age>=3)add('arcade-arch',1,.28,1.8,.16,2.1,.16,roofY-.16,stone,false,'arch');
   if(age===4){
    // Pavilion spans two awning stripes, so one damaged stripe leaves it supported.
    const base=roofY+.16;
    add('pavilion-floor',2,.95,.55,base,.9,.9,.12,stone);
    for(const x of [.99,1.69])for(const z of [.59,1.29])add(`pavilion-post-${x}-${z}`,3,x,z,base+.12,.12,.12,.44,wood);
    add('pavilion-roof',3,.87,.47,base+.56,1.06,1.06,.16,team,true);
    add('pavilion-finial',4,1.36,.96,base+.72,.08,.08,.26,brass);
   }
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
   if(age>=2){add('quench-trough',3,1.2,1.26,.16,.7,.36,.24,wood);add('quench-water',3,1.26,1.32,.4,.58,.24,.02,water);}
   if(age>=3)add('side-wall',1,2.4,.28,.16,.16,1.5,.8,stone,true);
   if(age===4){
    // Paddle wheel on the masonry side wall; a visual bellows drive, not a production bonus.
    add('race-channel',1,2.58,.62,.16,.26,.82,.08,wood);
    add('race-water',1,2.6,.64,.24,.22,.78,.04,water);
    add('wheel-axle',3,2.56,1.02,.66,.06,.08,.08,wood);
    add('wheel-paddle-vertical',3,2.62,.98,.28,.12,.16,.8,wood);
    add('wheel-paddle-horizontal',3,2.62,.68,.6,.12,.76,.16,wood);
    add('wheel-hub',3,2.6,.94,.56,.16,.24,.24,'#76817d');
   }
  }
 }
 add('marker-pole',4,2.65,2.7,.16,.06,.06,kind==='farm'?.65:height+.6,wood);
 add('marker-flag',4,2.34,2.7,kind==='farm'?.61:height+.44,.32,.05,.22,team);
 if(v.health===0)return [p[0],...Array.from({length:12},(_,i)=>({id:`debris-${i}`,phase:0,x:.2+(i%4)*.6,z:.2+Math.floor(i/4)*.7,y:.16,w:.34,d:.3,h:.12,color:wood,studs:false}))];
 const built=p.filter(a=>a.phase<=Math.min(4,Math.floor(v.progress/20)));
 if(v.health>=50)return built;
 // Damage drops ornaments and exposed cover; the top roof stays when an age addition rests on it.
 const roofTop=built.find(a=>a.id==='roof-2'),loaded=roofTop&&built.some(a=>a!==roofTop&&Math.abs(a.y-roofTop.y-roofTop.h)<1e-8&&a.x<roofTop.x+roofTop.w&&a.x+a.w>roofTop.x&&a.z<roofTop.z+roofTop.d&&a.z+a.d>roofTop.z);
 return built.filter(a=>!(a.id==='marker-flag'||(a.id==='roof-2'&&!loaded)||/^(awning|valance)-[24]$/.test(a.id)||a.id.startsWith('grain-')||a.id==='blade-horizontal'||a.id.endsWith('-finial')||a.id==='vane-arrow'));
}
