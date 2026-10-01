import type {BuildingPart,BuildingVisual,Architecture} from './building-parts.ts';
// Original brick wonder on the 5x5 footprint: a three-step plinth with a stair on the front (+z), then a monument in
// the owner's regional architecture, each its own silhouette rather than a recolour:
//  neutral (settlers): a stepped ziggurat with a shrine on top;
//  west: a cathedral - a long nave, twin front towers with slate spires, a rose window and a crossing spire;
//  central: a stave church - stacked dark timber roofs with carved ridge heads;
//  mideast: a domed hall - a stepped dome on a drum, four minarets with balconies, an arched portal;
//  eastasia: a five-storey pagoda with wide tiled eaves and a gilt spire.
// Team banners hang on the front in every style. Stages: plinth, walls, roofs, details, finials and banners. Visual
// only: the wonder's countdown lives in the sim.
const check=(v:BuildingVisual)=>{if(![1,2,3,4].includes(v.ageVariant)||![v.progress,v.health].every(n=>Number.isFinite(n)&&n>=0&&n<=100))throw Error('無效世界奇觀外觀');};
const stone='#c4bba2',stoneDark='#9d9a88',sand='#d8c9a6',lime='#e9e1cf',slate='#5d6670',tar='#4a3d30',carved='#6e5438',tile='#3f4a4c',gilt='#c9a55a',dark='#4a4740',glass='#7fa3b0',cream='#efe6cc';
export const wonderStyles=['neutral','west','central','mideast','eastasia'] as const;
export function wonderParts(v:BuildingVisual,style:Architecture='neutral'):BuildingPart[]{
 check(v);if(!wonderStyles.includes(style))throw Error('未知建築風格');
 const p:BuildingPart[]=[],team=v.red?'#b85c47':'#456e87';
 const add=(id:string,phase:number,x:number,z:number,y:number,w:number,d:number,h:number,color:string,studs=false,shape?:'arch')=>p.push({id,phase,x,z,y,w,d,h,color,studs,...(shape?{shape}:{})});
 // A centred square block (x and z centred on c).
 const sq=(id:string,phase:number,c:number,y:number,s:number,h:number,color:string,studs=false)=>add(id,phase,c-s/2,c-s/2,y,s,s,h,color,studs);
 add('foundation',0,0,0,0,5,5,.16,stoneDark);
 add('step-0',1,.2,.2,.16,4.6,4.6,.24,stone,true);add('step-1',1,.45,.45,.4,4.1,4.1,.24,stone,true);
 add('stair-0',1,2,4.8,.16,1,.2,.12,lime);add('stair-1',1,2,4.55,.4,1,.25,.12,lime);
 const top=.64;
 if(style==='neutral'){
  [[3.6,.5],[2.8,.5],[2,.5]].forEach(([s,h],i)=>sq(`tier-${i}`,1,2.5,top+i*.5,s,h,i%2?sand:stone,true));
  const y=top+1.5;sq('shrine',2,2.5,y,1.2,.7,lime);add('shrine-door',3,2.25,3.1,y,.5,.02,.5,dark);sq('shrine-roof',2,2.5,y+.7,1.4,.16,team,true);sq('shrine-roof-1',3,2.5,y+.86,.8,.16,team);sq('finial',4,2.5,y+1.02,.16,.4,gilt);
  for(const [x,z] of [[.22,.22],[4.58,.22],[.22,4.58],[4.58,4.58]]){add(`brazier-${x}-${z}`,3,x,z,.4,.2,.2,.26,dark);add(`fire-${x}-${z}`,4,x+.04,z+.04,.66,.12,.12,.14,'#e0a040');}
 }else if(style==='west'){
  // Nave along z, front facade at +z between two towers.
  add('nave',1,1.3,1,top,2.4,2.9,1.7,sand,true);for(const x of [.9,3.7])for(const z of [1.2,2,2.8])add(`buttress-${x}-${z}`,1,x,z,top,.4,.3,1.2,stone);
  for(let i=0;i<3;i++)add(`nave-roof-${i}`,2,1.2+i*.35,.9,top+1.7+i*.18,2.6-i*.7,3,.18,slate,true);
  for(const [i,x] of [1.1,3.1].entries()){add(`tower-${i}`,1,x,3.9,top,.8,.8,2.6,stone,true);add(`spire-${i}-0`,2,x+.05,3.95,top+2.6,.7,.7,.3,slate);add(`spire-${i}-1`,3,x+.17,4.07,top+2.9,.46,.46,.5,slate);add(`spire-${i}-2`,3,x+.31,4.21,top+3.4,.18,.18,.6,slate);add(`cross-${i}`,4,x+.36,4.26,top+4,.08,.08,.26,gilt);}
  add('facade',1,1.9,3.9,top,1.2,.4,1.9,sand,true);add('portal',3,2.15,4.3,top,.7,.04,.9,dark,false,'arch');add('rose',3,2.25,4.3,top+1.1,.5,.04,.5,glass);add('rose-ring',3,2.2,4.34,top+1.05,.6,.02,.08,gilt);
  const cy=top+1.7+3*.18;sq('crossing',3,2.5,cy,.6,.5,stone);sq('crossing-spire',3,2.5,cy+.5,.36,.5,slate);sq('crossing-tip',4,2.5,cy+1,.12,.36,gilt);
 }else if(style==='central'){
  // Stave church: a dark timber hall, stacked steep roofs, carved heads on the ridge ends.
  sq('hall',1,2.5,top,3,1.1,carved,true);for(const [x,z] of [[.95,.95],[3.75,.95],[.95,3.75],[3.75,3.75]])add(`post-${x}-${z}`,1,x,z,top,.3,.3,1.3,tar);
  [3.6,2.8,2.1,1.4,.8].forEach((s,i)=>{const y=top+1.1+i*.62;sq(`roof-${i}`,2,2.5,y,s,.16,tar,true);if(i<4)sq(`storey-${i}`,2,2.5,y+.16,s*.62,.46,carved);});
  [3.6,2.8,2.1].forEach((s,i)=>{for(const j of [-1,1])add(`head-${i}-${j}`,3,2.5+j*(s/2-.2)-.1,2.4,top+1.1+i*.62+.16,.2,.2,.3,carved);});
  sq('spire',3,2.5,top+1.1+5*.62-.46,.24,.7,tar);sq('finial',4,2.5,top+1.1+5*.62+.24,.12,.3,gilt);
  add('door',3,2.2,4,top,.6,.02,.8,dark,false,'arch');
 }else if(style==='mideast'){
  sq('hall',1,2.5,top,2.8,1.5,sand,true);add('portal-frame',1,1.8,3.9,top,1.4,.3,1.9,lime,true);add('portal',3,2.1,4.2,top,.8,.02,1.2,dark,false,'arch');
  const y=top+1.5;sq('drum',2,2.5,y,1.8,.4,lime);[1.7,1.4,1.05,.7,.36].forEach((s,i)=>sq(`dome-${i}`,2,2.5,y+.4+i*.22,s,.22,i%2?lime:cream,i===0));sq('finial',4,2.5,y+1.5,.1,.36,gilt);
  for(const [x,z] of [[.45,.45],[4.15,.45],[.45,4.15],[4.15,4.15]]){add(`minaret-${x}-${z}`,1,x,z,top,.4,.4,2.8,lime,true);add(`balcony-${x}-${z}`,3,x-.06,z-.06,top+2,.52,.52,.08,sand);
   add(`minaret-cap-${x}-${z}`,2,x+.05,z+.05,top+2.8,.3,.3,.2,cream);add(`minaret-tip-${x}-${z}`,4,x+.16,z+.16,top+3,.08,.08,.24,gilt);}
 }else{
  // Pagoda: five storeys, each a body under a wide eave with upturned corners.
  let y=top;[2.6,2.2,1.8,1.4,1].forEach((s,i)=>{sq(`storey-${i}`,i?2:1,2.5,y,s,.62,i%2?lime:'#b0574a',true);y+=.62;sq(`eave-${i}`,2,2.5,y,s+.6,.12,tile,true);
   for(const [dx,dz] of [[-1,-1],[1,-1],[-1,1],[1,1]])add(`tip-${i}-${dx}-${dz}`,3,2.5+dx*(s/2+.3)-(dx>0?.14:0),2.5+dz*(s/2+.3)-(dz>0?.14:0),y+.12,.14,.14,.12,tile);y+=.12;});
  sq('spire',3,2.5,y,.2,.9,gilt);for(const [i,s] of [.5,.38,.26].entries())sq(`ring-${i}`,3,2.5,y+.2+i*.22,s,.05,gilt);
  add('door',3,2.15,3.81,top,.7,.02,.5,dark);
 }
 // Team banners on the front step (every style).
 for(const x of [.7,3.9]){add(`banner-pole-${x}`,3,x,4.4,.4,.08,.08,1.6,carved);add(`banner-${x}`,4,x+.08,4.42,1.2,.36,.04,.7,team);}
 if(v.health===0)return [p[0],...Array.from({length:16},(_,i)=>({id:`debris-${i}`,phase:0,x:.3+(i%4)*1.15,z:.3+Math.floor(i/4)*1.15,y:.16,w:.5,d:.42,h:.14,color:i%3?stone:sand,studs:false}))];
 const lost=/^(banner-.*|finial|cross-\d|crossing-tip|minaret-tip-.*|ring-2|fire-.*|spire-\d-2|rose-ring)$/;
 return p.filter(a=>a.phase<=Math.min(4,Math.floor(v.progress/20))).filter(a=>v.health>=50||!lost.test(a.id));
}
