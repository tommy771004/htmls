// Land maps of the 地圖 round (design_default after aoetw.com's map pages; see docs/aoe2-rules-research.md 地圖):
// Arabia, Black Forest, Mongolia, Gold Rush, Yucatan, Ghost Lake and Crater Lake. Distances are map units (a tile is
// 100); ring and distance shares are of the map's 3200 width.
import {MapBuilder,standardKit} from './toolkit.ts';
import type {KitItem} from './toolkit.ts';
import type {MapData} from '../navigation.ts';
export const landMapRules={provenance:'design_default after aoetw.com maps pages (2026-10-02)',
 // 阿拉伯: the site's 8 sheep, 2 boar, 3-4 deer, 3 gold and 2 stone at this game's scale is the standard kit with its
 // second boar and four deer; little wood (fewer, smaller clumps), no water, desert patches.
 arabia:{bases:[.29,.34],sand:.6,forests:{clumps:6,size:[5,9],clearance:1000},border:.25,neutral:{gold:1,rock:1,ring:[0,700]}},
 // 黑森林: forest everywhere but each base's clearing, a clearing in the middle and a winding road from each base to it.
 'black-forest':{bases:[.3,.33],kitScale:.8,clearing:820,middle:400,road:150,density:.9,neutral:{gold:1,rock:1,ring:[0,350]}},
 // 蒙古高原: plateaus (height 100, cliffs round them) each with one ramp, some carrying gold or stone.
 mongolia:{bases:[.3,.34],plateaus:3,radius:[2,3],ring:[650,1350],clearance:950,forests:{clumps:8,size:[5,10],clearance:1000},border:.35},
 // 淘金潮: bases near the edge with their kit's single gold pile; a desert centre with a big gold field and many wolves.
 'gold-rush':{bases:[.37,.4],desert:750,gold:{pairs:5,ring:[0,450]},wolves:{pairs:4,ring:[450,900]},stone:1,forests:{clumps:8,size:[5,10],clearance:950},border:.4},
 // 猶加敦: more food by each town centre (deer, sheep, berries), jaguars, thick jungle.
 yucatan:{bases:[.3,.34],forests:{clumps:12,size:[6,12],clearance:1000},border:.5,jaguars:{pairs:2,ring:[0,1500]},neutral:{gold:1,rock:1,ring:[0,700]}},
 // 鬼湖: a frozen lake in the middle (ice: walkable, nothing built or found on it), fewer deer, more gold and stone,
 // wood in small clumps, wolves; the ground is snow.
 'ghost-lake':{bases:[.34,.37],ice:650,forests:{clumps:16,size:[3,5],clearance:900},border:.25,neutral:{gold:2,rock:2,ring:[800,1300]},wolves:{pairs:2,ring:[700,1400]}},
 // 火山湖 (no page on the site; the classic map): a mountain in the middle with a lake in its crater, two ramps up.
 'crater-lake':{bases:[.33,.37],mountain:650,crater:260,fish:2,gold:{pairs:2,ring:[350,600]},forests:{clumps:9,size:[5,10],clearance:1000},border:.4}} as const;
// Arabia's kit: the standard one with a second boar and a fourth deer.
// (Kits are built when a map is made, not when the module loads: the map modules and navigation.ts import each other.)
const arabiaKit=():KitItem[]=>[...standardKit.map(i=>i.kind==='hunt'?{...i,count:4}:i),{kind:'boar',dx:-760,dy:620}];
export function arabia(seed:number):MapData{const R=landMapRules.arabia,b=new MapBuilder(seed,'rotate','arabia');b.bases(null,[...R.bases]);
 b.paint((x,y)=>b.smooth(x,y)>R.sand?'sand':null);b.kit(arabiaKit());
 b.neutral('gold',R.neutral.gold,[...R.neutral.ring]);b.neutral('rock',R.neutral.rock,[...R.neutral.ring]);
 b.forests(R.forests.clumps,[...R.forests.size],R.forests.clearance);b.border(R.border,750);return b.finish();}
// The kit drawn in closer to the town centre (kitScale, never inside 520 of it: the apron), so the whole of it lies
// inside the base's clearing.
export function blackForest(seed:number):MapData{const R=landMapRules['black-forest'],b=new MapBuilder(seed,'rotate','black-forest');b.bases(null,[...R.bases]);b.kit(standardKit.map(i=>{const k=Math.max(R.kitScale,520/Math.hypot(i.dx,i.dy));return {...i,dx:Math.round(i.dx*k),dy:Math.round(i.dy*k)};}));
 b.neutral('gold',R.neutral.gold,[...R.neutral.ring],600);b.neutral('rock',R.neutral.rock,[...R.neutral.ring],600);
 // The road: tiles within R.road of the line from each town centre to the middle, bent by the noise.
 const road=(tx:number,ty:number)=>{const px=tx*100+50,py=ty*100+50;for(const base of b.centres){const dx=b.mid-base.x,dy=b.mid-base.y,len=Math.hypot(dx,dy),t=Math.max(0,Math.min(1,((px-base.x)*dx+(py-base.y)*dy)/(len*len))),bend=(b.noise(tx>>1,ty>>1)-.5)*120;
  if(Math.hypot(px-(base.x+dx*t),py-(base.y+dy*t))<=R.road+bend)return true;}return false;};
 for(let ty=0;ty<b.size;ty++)for(let tx=0;tx<b.size;tx++){const d=Math.hypot(tx*100+50-b.mid,ty*100+50-b.mid);
  if(b.baseDistance(tx,ty)<R.clearing||d<R.middle||road(tx,ty)||b.noise(tx,ty)>R.density)continue;if(b.pairFree(tx,ty,0))b.pair('tree',tx,ty);}
 return b.finish();}
// A plateau (height 100: its edge is a cliff) with one ramp of three steps (75, 50, 25), two tiles wide, on the side
// facing the map centre.
function plateau(b:MapBuilder,cx:number,cy:number,r:number){
 for(let ty=cy-r-1;ty<=cy+r+1;ty++)for(let tx=cx-r-1;tx<=cx+r+1;tx++)if(b.inside(tx,ty)&&Math.hypot(tx-cx,ty-cy)<=r+.4*(b.noise(tx,ty)-.5))b.set(tx,ty,'highland',100);
 const vx=b.mid/100-.5-cx,vy=b.mid/100-.5-cy,dx=Math.abs(vx)>=Math.abs(vy)?Math.sign(vx)||1:0,dy=dx?0:Math.sign(vy)||1;
 // Walk out from the centre to the first tile off the plateau, then lay the ramp.
 let x=cx,y=cy;while(b.inside(x,y)&&b.tile(x,y).height===100){x+=dx;y+=dy;}
 for(let k=0;k<3;k++)for(let w=0;w<2;w++){const tx=x+dx*k+(dx?0:w),ty=y+dy*k+(dy?0:w);if(b.inside(tx,ty))b.set(tx,ty,'highland',75-25*k,false);}
}
export function mongolia(seed:number):MapData{const R=landMapRules.mongolia,b=new MapBuilder(seed,'rotate','mongolia');b.bases(null,[...R.bases]);
 const tops:[number,number][]=[];for(let i=0;i<R.plateaus;i++){const at=b.pick((x,y)=>b.baseDistance(x,y)>=R.clearance+R.radius[1]*100&&tops.every(([px,py])=>Math.hypot(px-x,py-y)>R.radius[1]*2+3)&&(()=>{const [mx,my]=b.mirrorTile(x,y);return Math.hypot(mx-x,my-y)>R.radius[1]*2+4;})(),[...R.ring]);
  if(!at)continue;const r=b.int(R.radius[0],R.radius[1]);plateau(b,at[0],at[1],r);tops.push(at);}
 b.kit(standardKit);
 // Gold and stone on the plateaus first (the site: mines sometimes sit on cliff paths), then anywhere.
 tops.forEach(([x,y],i)=>{if(b.pairFree(x,y,2))b.pair(i%2?'rock':'gold',x,y);});
 b.neutral('gold',1,[0,700]);b.forests(R.forests.clumps,[...R.forests.size],R.forests.clearance);b.border(R.border,750);return b.finish();}
export function goldRush(seed:number):MapData{const R=landMapRules['gold-rush'],b=new MapBuilder(seed,'rotate','gold-rush');b.bases(null,[...R.bases]);
 b.paint((x,y,d)=>d<R.desert+120*(b.noise(x,y)-.5)?'sand':null);b.kit(standardKit);
 b.neutral('gold',R.gold.pairs,[...R.gold.ring],900,2);b.neutral('rock',R.stone,[600,1100]);
 b.animals('wolf',R.wolves.pairs,1,[...R.wolves.ring],()=>true,800);
 b.forests(R.forests.clumps,[...R.forests.size],R.forests.clearance,(x,y)=>Math.hypot(x*100+50-b.mid,y*100+50-b.mid)>R.desert);b.border(R.border,700);return b.finish();}
// Yucatan's kit: the standard one plus a second berry bush, two more sheep and a second deer herd.
const yucatanKit=():KitItem[]=>[...standardKit,{kind:'berries',dx:560,dy:380},{kind:'livestock',dx:420,dy:-600,count:2},{kind:'hunt',dx:-700,dy:760,count:3}];
export function yucatan(seed:number):MapData{const R=landMapRules.yucatan,b=new MapBuilder(seed,'rotate','yucatan');b.bases(null,[...R.bases]);b.kit(yucatanKit());
 b.neutral('gold',R.neutral.gold,[...R.neutral.ring]);b.neutral('rock',R.neutral.rock,[...R.neutral.ring]);b.animals('jaguar',R.jaguars.pairs,1,[...R.jaguars.ring]);
 b.forests(R.forests.clumps,[...R.forests.size],R.forests.clearance);b.border(R.border,750);return b.finish();}
// Ghost Lake's kit: the standard one with a smaller deer herd.
const ghostKit=():KitItem[]=>standardKit.map(i=>i.kind==='hunt'?{...i,count:2}:i);
export function ghostLake(seed:number):MapData{const R=landMapRules['ghost-lake'],b=new MapBuilder(seed,'rotate','ghost-lake');b.bases(null,[...R.bases]);
 b.paint((x,y,d)=>d<R.ice+140*(b.smooth(x,y)-.5)?'ice':'snow');b.kit(ghostKit());
 b.neutral('gold',R.neutral.gold,[...R.neutral.ring]);b.neutral('rock',R.neutral.rock,[...R.neutral.ring]);b.animals('wolf',R.wolves.pairs,1,[...R.wolves.ring]);
 b.forests(R.forests.clumps,[...R.forests.size],R.forests.clearance);b.border(R.border,700);return b.finish();}
export function craterLake(seed:number):MapData{const R=landMapRules['crater-lake'],b=new MapBuilder(seed,'rotate','crater-lake');b.bases(null,[...R.bases]);
 // The mountain (height 100) and the crater lake on top of it (water at the same height, so its shore is walkable).
 b.paint((x,y,d)=>d<R.crater?{type:'water',height:100}:d<R.mountain+90*(b.noise(x,y)-.5)?{type:'highland',height:100}:null);
 // Two ramps (turned half round each other), on the axis across the line between the bases, so neither ends at a
 // base's starting villagers.
 const c=b.centres[0],across=Math.abs(c.x-b.mid)>=Math.abs(c.y-b.mid),dx=across?0:(c.x>=b.mid?1:-1),dy=across?(c.y>=b.mid?1:-1):0;
 let x=Math.floor(b.mid/100)-(dx<0?1:0),y=Math.floor(b.mid/100)-(dy<0?1:0);while(b.inside(x,y)&&b.tile(x,y).height===100){x+=dx;y+=dy;}
 for(let k=0;k<3;k++)for(let w=-1;w<=0;w++){const tx=x+dx*k+(dx?0:w),ty=y+dy*k+(dy?0:w);if(b.inside(tx,ty))b.set(tx,ty,'highland',75-25*k,false);}
 b.kit(standardKit);b.fishIn(R.fish,'shore',200,(tx,ty)=>b.tile(tx,ty).height===100);
 b.neutral('gold',R.gold.pairs,[...R.gold.ring],700);b.neutral('rock',1,[700,1100]);
 b.forests(R.forests.clumps,[...R.forests.size],R.forests.clearance,(tx,ty)=>b.tile(tx,ty).height===0);b.border(R.border,750);return b.finish();}
