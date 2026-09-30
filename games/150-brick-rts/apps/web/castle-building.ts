import type {BuildingPart,BuildingVisual} from './building-parts.ts';
import {obstacleFootprints} from '../../packages/content/footprints.ts';
// Original brick castle on the 4x4 footprint: four corner towers joined by curtain walls, an arched gatehouse with a
// portcullis in the front wall, and a square keep in the courtyard hung with team banners. Ages change the structure:
// timber hoardings and palisade stakes (1), stone crenellations (2), taller walls, arrow slits and a keep turret (3),
// team conical roofs on drums, gate turrets and a keep spire (4). Visual only: arrows and garrison live in the sim.
export function castleParts(v:BuildingVisual):BuildingPart[]{
 if(![1,2,3,4].includes(v.ageVariant)||![v.progress,v.health].every(n=>Number.isFinite(n)&&n>=0&&n<=100))throw Error('無效城堡外觀');
 const p:BuildingPart[]=[],age=v.ageVariant,team=v.red?'#b85c47':'#456e87',wood='#94734c',straw='#b8a074',stone='#b5b29e',dark='#4a4740',oak='#5a4632';
 const add=(id:string,phase:number,x:number,z:number,y:number,w:number,d:number,h:number,color:string,studs=false,shape?:'arch')=>p.push({id,phase,x,z,y,w,d,h,color,studs,...(shape?{shape}:{})});
 const f=obstacleFootprints.castle;
 add('foundation',0,f.x/100,f.y/100,0,f.width/100,f.depth/100,.16,'#b3aa8c');
 const wallH=1.12+(age>=3?.32:0),wallTop=.16+wallH,towerTop=wallTop+.64,keepTop=.16+[1.6,1.92,2.24,2.24][age-1];
 // Crest along a wall top: palisade stakes in the first age, stone merlons after (same grid, reused brick sizes).
 const crest=(id:string,x:number,z:number,y:number,alongX:boolean)=>age===1?add(`stake-${id}`,2,x+(alongX?.04:.12),z+(alongX?.12:.04),y,.12,.12,.3,wood):add(`merlon-${id}`,2,x,z,y,alongX?.2:.36,alongX?.36:.2,.24,stone);
 // Corner towers (inset .05 from the foundation edge).
 const towers=[[-.1,-.1],[2.9,-.1],[-.1,2.9],[2.9,2.9]] as const;
 for(const [x,z] of towers){const id=`${x}-${z}`;add(`tower-${id}`,1,x,z,.16,.9,.9,towerTop-.16,stone);
  if(age===1){add(`hoard-${id}`,2,x-.05,z-.05,towerTop,1,1,.3,wood);add(`hoard-roof-${id}`,2,x+.05,z+.05,towerTop+.3,.8,.8,.16,straw,true);add(`hoard-cap-${id}`,3,x+.25,z+.25,towerTop+.46,.4,.4,.16,straw);}
  else for(const dx of [0,.35,.7])for(const dz of [0,.35,.7])if(dx!==.35||dz!==.35)add(`tmerlon-${id}-${dx}-${dz}`,2,x+dx,z+dz,towerTop,.2,.2,.24,stone);
  // Arrow slits on the outer (front or back) face.
  if(age>=3)add(`slit-${id}`,3,x+.6,z<0?z-.03:z+.9,towerTop-1,.1,.03,.32,dark);
  if(age===4){add(`drum-${id}`,3,x+.2,z+.2,towerTop,.5,.5,.32,stone);add(`cone-0-${id}`,3,x+.1,z+.1,towerTop+.32,.7,.7,.16,team,true);add(`cone-1-${id}`,3,x+.22,z+.22,towerTop+.48,.46,.46,.16,team);add(`cone-2-${id}`,4,x+.34,z+.34,towerTop+.64,.22,.22,.2,team);}
 }
 // Curtain walls between the towers; the front wall is split by the gatehouse.
 add('wall-back',1,.8,.17,.16,2.1,.36,wallH,stone);add('wall-left',1,.17,.8,.16,.36,2.1,wallH,stone);add('wall-right',1,3.17,.8,.16,.36,2.1,wallH,stone);
 add('wall-front-l',1,.8,3.17,.16,.6,.36,wallH,stone);add('wall-front-r',1,2.3,3.17,.16,.6,.36,wallH,stone);
 for(let i=0;i<5;i++){const at=.9+i*.4;crest(`back-${i}`,at,.17,wallTop,true);crest(`left-${i}`,.17,at,wallTop,false);crest(`right-${i}`,3.17,at,wallTop,false);}
 for(const x of [.88,1.16,2.36,2.64])crest(`front-${x}`,x,3.17,wallTop,true);
 // Gatehouse: a deeper arched block, a course over it, the portcullis in the opening.
 add('gate-arch',1,1.4,3.1,.16,.9,.5,wallH,stone,false,'arch');add('gate-top',2,1.4,3.1,wallTop,.9,.5,.32,stone);
 add('portcullis',3,1.62,3.3,.16,.46,.06,.76,oak);
 if(age>=2)for(const x of [1.4,1.75,2.1])add(`gate-merlon-${x}`,3,x,3.4,wallTop+.32,.2,.2,.24,stone);
 if(age===4)for(const x of [1.4,2.04]){add(`gate-turret-${x}`,3,x,3.1,wallTop+.32,.26,.26,.4,stone);add(`gate-turret-cap-${x}`,4,x-.02,3.08,wallTop+.72,.3,.3,.12,team);}
 // Keep: a square donjon; a straw roof in the first age, then a parapet ring, then a turret and a spire.
 add('keep',1,1.25,1.1,.16,1.2,1.2,keepTop-.16,stone);
 let crown=keepTop;
 if(age===1){add('keep-roof-0',2,1.2,1.05,keepTop,1.3,1.3,.16,straw,true);add('keep-roof-1',2,1.45,1.3,keepTop+.16,.8,.8,.16,straw,true);crown=keepTop+.32;}
 else{add('keep-parapet',2,1.2,1.05,keepTop,1.3,1.3,.12,stone);crown=keepTop+.12;
  for(const dx of [0,.55,1.1])for(const dz of [0,.55,1.1])if(dx!==.55||dz!==.55)add(`keep-merlon-${dx}-${dz}`,2,1.2+dx,1.05+dz,crown,.2,.2,.24,stone);}
 if(age>=3){add('keep-turret',2,1.55,1.4,crown,.6,.6,.64,stone);add('keep-turret-cap',3,1.5,1.35,crown+.64,.7,.7,.16,team,true);crown+=.8;}
 if(age===4){add('keep-spire-0',3,1.65,1.5,crown,.4,.4,.16,team);add('keep-spire-1',4,1.75,1.6,crown+.16,.2,.2,.2,team);crown+=.36;}
 // Banners hang on the keep front and on the front towers' outer faces.
 for(const x of [1.4,2]){add(`banner-keep-${x}`,3,x,2.3,keepTop-1,.3,.04,.8,team);}
 for(const x of [0,3])add(`banner-tower-${x}`,3,x,3.8,towerTop-1.1,.3,.04,.7,team);
 add('flag-pole',4,1.82,1.67,crown,.06,.06,.9,wood);add('flag',4,1.88,1.67,crown+.5,.5,.05,.3,team);
 if(v.health===0)return [p[0],...Array.from({length:12},(_,i)=>({id:`debris-${i}`,phase:0,x:.2+(i%4)*.9,z:.2+Math.floor(i/4)*1.2,y:.16,w:.4,d:.34,h:.12,color:stone,studs:false}))];
 // Damage drops the ornaments and every other crest block; nothing load-bearing goes.
 return p.filter(a=>a.phase<=Math.min(4,Math.floor(v.progress/20))).filter(a=>v.health>=50||!(a.id==='flag'||a.id.startsWith('banner-')||/^(merlon|stake)-.*-[13]$/.test(a.id)||a.id.startsWith('cone-2-')||a.id.startsWith('hoard-cap-')));
}
