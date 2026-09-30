import {obstacleFootprints} from '../../packages/content/footprints.ts';
export type BuildingVisual={ageVariant:1|2|3|4;progress:number;health:number;red:boolean};
export type BuildingPart={id:string;x:number;y:number;z:number;w:number;d:number;h:number;color:string;studs:boolean;phase:number;shape?:'arch'};
// Art state is deliberately separate from gameplay age, construction cost and hit points.
export function buildingParts(visual:BuildingVisual):BuildingPart[]{
 const {ageVariant:age,progress,health,red}=visual;
 if(![1,2,3,4].includes(age)||![progress,health].every(v=>Number.isFinite(v)&&v>=0&&v<=100))throw Error('無效建築外觀狀態');
 const parts:BuildingPart[]=[],team=red?'#b85c47':'#456e87';
 const add=(id:string,phase:number,x:number,z:number,y:number,w:number,d:number,h:number,color:string,studs=false,shape?:'arch')=>parts.push({id,phase,x,z,y,w,d,h,color,studs,...(shape?{shape}:{})});
 const footprint=obstacleFootprints.house;
 add('foundation',0,footprint.x/100,footprint.y/100,0,footprint.width/100,footprint.depth/100,.16,'#b3aa8c');
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
 add('door-handle',3,.81,2.04,.61,.055,.03,.07,'#c2a664');
 for(const x of [.13,1.47]){add(`window-frame-${x}`,3,x,1.99,.76,.38,.06,.38,'#786b55');add(`window-glass-${x}`,3,x+.04,2.05,.8,.3,.025,.29,'#334b4e');}
 if(age>=2){add('chimney',3,1.5,.3,wallTop,.4,.4,.95,'#b1aa95');add('chimney-cap',3,1.46,.26,wallTop+.95,.48,.48,.1,'#78796b');}
 if(age>=3){add('stone-door-header',3,.6,1.97,.16,.8,.15,1.28,'#d0ceba',false,'arch');add('roof-ridge',3,.7,-.2,roofBase+.72,.7,2.5,.16,team,true);}
 if(age===4){for(const z of [.05,1.55]){add(`dormer-base-${z}`,3,.5,z,roofBase+.36,.5,.4,.64,'#c9c4ae');add(`dormer-cap-${z}`,3,.45,z-.04,roofBase+1,.6,.48,.16,team,true);}add('cargo-platform',3,.75,.7,.16,.5,.6,.12,'#96764c');}
 const poleBase=roofBase+.36;add('flag-pole',4,.27,.25,poleBase,.07,.07,.9,'#786849');add('flag',4,.34,.25,poleBase+.58,.6,.04,.3,team);
 if(health===0){return [parts[0],...Array.from({length:12},(_,i)=>({id:`debris-${i}`,phase:0,x:.1+(i%4)*.43,z:.12+Math.floor(i/4)*.53,y:.16,w:.32,d:.27,h:.12,color:i%3?wall:roof,studs:false}))];}
 const phase=Math.min(4,Math.floor(progress/20));
 return parts.filter(p=>p.phase<=phase).filter(p=>health>=50||!(p.id.startsWith('roof-')&&Number(p.id.split('-')[2])%2===0||p.id==='flag'));
}
// Regional architecture (civ groups from packages/content/civs.ts): one shared post-pass over any building's finished
// part list that adds a few silhouette pieces, so a civ reads by shape and not only by team colour. Corner pieces sit
// on the free corners of the lowest roof tier, a crown piece on the highest free roof top; nothing is added before the
// roof stage or to rubble, and every piece stays inside the foundation and rests on the part below it. Visual only.
export const architectures=['neutral','west','central','mideast','eastasia'] as const;
export type Architecture=typeof architectures[number];
const slate='#5d6670',tar='#4a3d30',carved='#6e5438',lime='#e9e1cf',sand='#d8c9a6',tile='#3f4a4c',gilt='#c9a55a';
const eave=(id:string)=>id==='roof'||/^roof-0(-|$)/.test(id)||/^(canopy-roof|awning-\d|keep-roof-0|keep-parapet|hoard-roof-.*)$/.test(id);
const ornament=/flag|pole|pennant|banner|finial|vane|rope|bell|debris|style-/;
export function regionalParts(parts:BuildingPart[],style:Architecture):BuildingPart[]{
 if(!architectures.includes(style))throw Error('未知建築風格');
 if(style==='neutral'||parts.length<2||!parts.some(p=>p.phase>=2))return parts;
 const out=[...parts],base=parts[0],x0=base.x,x1=base.x+base.w,z0=base.z,z1=base.z+base.d;
 // Strict overlap on all three axes (face contact is not a collision).
 const clash=(a:{x:number;y:number;z:number;w:number;h:number;d:number})=>out.some(b=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1e-8&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1e-8&&Math.min(a.z+a.d,b.z+b.d)-Math.max(a.z,b.z)>1e-8);
 type Piece={x:number;z:number;y:number;w:number;d:number;h:number;color:string};
 // A stack of pieces is added only if none of it collides; ids stay unique per slot.
 const place=(slot:string,phase:number,stack:Piece[])=>{if(stack.some(clash)||stack.some(s=>s.x<x0-1e-8||s.z<z0-1e-8||s.x+s.w>x1+1e-8||s.z+s.d>z1+1e-8))return;stack.forEach((s,i)=>out.push({id:`style-${style}-${slot}-${i}`,phase,studs:false,...s}));};
 const eaves=parts.filter(p=>eave(p.id));
 if(eaves.length){const y=Math.min(...eaves.map(p=>p.y)),tier=eaves.filter(p=>Math.abs(p.y-y)<1e-6),top=y+tier[0].h;
  // Eaves may overhang the foundation (the watch tower's roof): corners are pulled back inside it.
  const rx0=Math.max(x0,Math.min(...tier.map(p=>p.x))),rx1=Math.min(x1,Math.max(...tier.map(p=>p.x+p.w))),rz0=Math.max(z0,Math.min(...tier.map(p=>p.z))),rz1=Math.min(z1,Math.max(...tier.map(p=>p.z+p.d))),c=.16;
  for(const [sx,sz] of [[0,0],[1,0],[0,1],[1,1]]){const cx=sx?rx1-c:rx0,cz=sz?rz1-c:rz0,under=tier.find(p=>p.x<=cx+1e-8&&p.x+p.w>=cx+c-1e-8&&p.z<=cz+1e-8&&p.z+p.d>=cz+c-1e-8);if(!under)continue;
   // The second block leans to the outer corner (eave tips, finials).
   const ox=sx?cx+c-.1:cx,oz=sz?cz+c-.1:cz;
   const stack:Piece[]=style==='eastasia'?[{x:cx,z:cz,y:top,w:c,d:c,h:.08,color:under.color},{x:ox,z:oz,y:top+.08,w:.1,d:.1,h:.18,color:under.color}]
    :style==='west'?[{x:cx,z:cz,y:top,w:c,d:c,h:.3,color:slate},{x:cx+.05,z:cz+.05,y:top+.3,w:.06,d:.06,h:.2,color:slate}]
    :style==='central'?[{x:cx+.02,z:cz+.02,y:top,w:.12,d:.12,h:.44,color:tar},{x:ox,z:oz,y:top+.44,w:.1,d:.1,h:.12,color:carved}]
    :[{x:cx,z:cz,y:top,w:c,d:c,h:.18,color:lime},{x:cx+.04,z:cz+.04,y:top+.18,w:.08,d:.08,h:.1,color:lime}];
   place(`corner-${sx}${sz}`,under.phase,stack);}
 }
 // Crowns: the highest free roof tops (all ties, e.g. four castle towers or two dormers) in the upper part of the building.
 const peak=Math.max(...parts.map(p=>p.y+p.h)),free=parts.slice(1).filter(p=>p.w>=.2&&p.d>=.2&&!ornament.test(p.id)&&p.y+p.h>=.6*peak&&!parts.some(o=>o!==p&&Math.abs(o.y-p.y-p.h)<1e-8&&o.x<p.x+p.w&&o.x+o.w>p.x&&o.z<p.z+p.d&&o.z+o.d>p.z)).sort((a,b)=>b.y+b.h-(a.y+a.h)||b.w*b.d-a.w*a.d);
 const crowns=free.filter(p=>free.length&&Math.abs(p.y+p.h-free[0].y-free[0].h)<1e-6&&Math.abs(p.w*p.d-free[0].w*free[0].d)<1e-6);
 crowns.forEach((crown,k)=>{const top=crown.y+crown.h,cx=crown.x+crown.w/2,cz=crown.z+crown.d/2,s=Math.min(crown.w,crown.d),sq=(w:number,y:number,h:number,color:string):Piece=>({x:cx-w/2,z:cz-w/2,y,w,d:w,h,color});
  let stack:Piece[]=[];
  if(style==='west'){const b=Math.min(.6*s,.6);stack=[sq(b,top,.2,slate),sq(b*.66,top+.2,.28,slate),sq(b*.33,top+.48,.36,slate),sq(.06,top+.84,.26,gilt)];}
  else if(style==='mideast'){const b=Math.min(.7*s,.7);stack=[sq(b,top,.16,sand),sq(b*.9,top+.16,.18,lime),sq(b*.72,top+.34,.14,lime),sq(b*.48,top+.48,.12,lime),sq(b*.24,top+.6,.08,lime),sq(.06,top+.68,.26,gilt)];}
  else if(style==='eastasia'){const e=.1,px0=Math.max(x0,crown.x-e),px1=Math.min(x1,crown.x+crown.w+e),pz0=Math.max(z0,crown.z-e),pz1=Math.min(z1,crown.z+crown.d+e),t=.1;
   stack=[{x:px0,z:pz0,y:top,w:px1-px0,d:pz1-pz0,h:.08,color:tile},...[[px0,pz0],[px1-t,pz0],[px0,pz1-t],[px1-t,pz1-t]].map(([x,z])=>({x,z,y:top+.08,w:t,d:t,h:.16,color:tile})),sq(Math.min(.6*s,.6),top+.08,.2,tile),sq(Math.min(.3*s,.3),top+.28,.12,tile),sq(.1,top+.4,.2,gilt)];}
  else{// central: a ridge beam along the longer side with a carved post and head at each end.
   const alongX=crown.w>=crown.d,L=alongX?crown.w:crown.d,r=Math.max(.1,Math.min(.4*L,.5*L-.12));
   const bar=(a0:number,a1:number,y:number,h:number,t:number,color:string):Piece=>alongX?{x:cx+a0,z:cz-t/2,y,w:a1-a0,d:t,h,color}:{x:cx-t/2,z:cz+a0,y,w:t,d:a1-a0,h,color};
   stack=[bar(-r,r,top,.1,.12,tar),bar(-r,-r+.1,top+.1,.5,.1,tar),bar(r-.1,r,top+.1,.5,.1,tar),bar(-r-.12,-r+.1,top+.6,.12,.1,carved),bar(r-.1,r+.12,top+.6,.12,.1,carved)];}
  place(`crown-${k}`,crown.phase,stack);});
 return out;
}
