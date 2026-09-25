export type BuildingVisual={ageVariant:1|2|3|4;progress:number;health:number;red:boolean};
export type BuildingPart={id:string;x:number;y:number;z:number;w:number;d:number;h:number;color:string;studs:boolean;phase:number};
// Art state is deliberately separate from gameplay age, construction cost and hit points.
export function buildingParts(visual:BuildingVisual):BuildingPart[]{
 const {ageVariant:age,progress,health,red}=visual;
 if(![1,2,3,4].includes(age)||![progress,health].every(v=>Number.isFinite(v)&&v>=0&&v<=100))throw Error('無效建築外觀狀態');
 const parts:BuildingPart[]=[],team=red?'#b85c47':'#456e87';
 const add=(id:string,phase:number,x:number,z:number,y:number,w:number,d:number,h:number,color:string,studs=false)=>parts.push({id,phase,x,z,y,w,d,h,color,studs});
 add('foundation',0,-.15,-.15,0,2.5,2.3,.16,'#b3aa8c');
 const courses=age+2,wallTop=.16+courses*.32,wall=age<=2?'#dec59b':'#b7b6a5';
 for(let level=0;level<courses;level++){
 const y=.16+level*.32;
 add(`back-${level}`,1,0,0,y,2,.18,.32,wall);
 for(const x of [0,1.82])add(`side-${x}-${level}`,1,x,.18,y,.18,1.64,.32,wall);
 for(const x of [0,1.3])add(`front-${x}-${level}`,1,x,1.82,y,.7,.18,.32,wall);
 if(level>=3)add(`lintel-${level}`,1,.7,1.82,y,.6,.18,.32,wall);
 }
 if(age<=2)for(const x of [0,.64,1.3,1.94])add(`timber-${x}`,1,x,1.98,.16,.06,.06,wallTop-.16,'#80674f');
 else for(const x of [-.05,1.73])add(`buttress-${x}`,1,x,1.78,.16,.32,.3,wallTop-.16,'#999e92');
 const roofBase=wallTop,roof=age===1?'#b8a074':age===2?team:'#677681',levels=age===1?3:4;
 for(let level=0;level<levels;level++)for(let row=0;row<5;row++)add(`roof-${level}-${row}`,2,-.2+level*.25,-.2+row*.5,roofBase+level*.18,2.5-level*.5,.5,.18,roof,true);
 add('door',3,.76,1.98,.16,.48,.06,.92,'#685740');
 add('door-handle',3,.81,2.045,.61,.055,.03,.07,'#c2a664');
 for(const x of [.13,1.47]){add(`window-frame-${x}`,3,x,1.99,.76,.38,.06,.38,'#786b55');add(`window-glass-${x}`,3,x+.04,2.055,.8,.3,.025,.29,'#334b4e');}
 if(age>=2){add('chimney',3,1.5,.3,wallTop,.4,.4,.95,'#b1aa95');add('chimney-cap',3,1.46,.26,wallTop+.95,.48,.48,.1,'#78796b');}
 if(age>=3){add('stone-door-header',3,.66,1.97,1.12,.68,.15,.16,'#d0ceba');add('roof-ridge',3,.7,-.2,roofBase+.72,.7,2.5,.16,team,true);}
 if(age===4){for(const z of [.05,1.55]){add(`dormer-base-${z}`,3,.5,z,roofBase+.36,.5,.4,.64,'#c9c4ae');add(`dormer-cap-${z}`,3,.45,z-.04,roofBase+1,.6,.48,.16,team,true);}add('cargo-platform',3,.75,.7,.16,.5,.6,.12,'#96764c');}
 const poleBase=roofBase+.36;add('flag-pole',4,.27,.25,poleBase,.07,.07,.9,'#786849');add('flag',4,.34,.25,poleBase+.58,.6,.04,.3,team);
 if(health===0){return [parts[0],...Array.from({length:12},(_,i)=>({id:`debris-${i}`,phase:0,x:.1+(i%4)*.43,z:.12+Math.floor(i/4)*.53,y:.16,w:.32,d:.27,h:.12,color:i%3?wall:roof,studs:false}))];}
 const phase=Math.min(4,Math.floor(progress/20));
 return parts.filter(p=>p.phase<=phase).filter(p=>health>=50||!(p.id.startsWith('roof-')&&Number(p.id.split('-')[2])%2===0||p.id==='flag'));
}
