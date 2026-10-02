// Water maps of the 地圖 round (design_default after aoetw.com's map pages; see docs/aoe2-rules-research.md 地圖):
// Coastal, Mediterranean, Baltic, Continental, Rivers, Highland, Oasis, Scandinavia and Salt Marsh. Every base stays on
// the same landmass as the other (rivers have shallow fords), and fish lie in the water for docks and fishing ships.
import {MapBuilder,standardKit} from './toolkit.ts';
import type {KitItem} from './toolkit.ts';
import type {MapData} from '../navigation.ts';
export const waterMapRules={provenance:'design_default after aoetw.com maps pages (2026-10-02)',
 // 沿海: the sea along one side (half the map the site says; here the south third), both bases on the land side.
 coastal:{angle:[200,235],bases:[.3,.34],sea:21,shoreJitter:3,beach:4,fish:{shore:3,deep:3},forests:{clumps:9,size:[5,10],clearance:850},border:.4},
 // 地中海: a sea in the middle, land all round it.
 mediterranean:{bases:[.36,.4],sea:780,shoreRoad:400,fish:{shore:2,deep:4},neutral:{gold:1,rock:1,ring:[1000,1400]},forests:{clumps:10,size:[5,10],clearance:1000},border:.45},
 // 波羅的海: most of the map is sea; the bases sit in opposite corners of the narrow land strip round it.
 baltic:{bases:[.42,.44],sea:1000,keep:800,corner:650,shoreRoad:500,fish:{shore:3,deep:5},forests:{clumps:8,size:[4,8],clearance:900},border:.35},
 // 大陸: a continent ringed by sea, with an isolated island in a lake in the middle (gold on it); more gold, little wood.
 continental:{bases:[.28,.32],edge:3,lake:430,island:190,fish:{shore:2,deep:3},neutral:{gold:2,rock:1,ring:[600,1100]},forests:{clumps:6,size:[5,9],clearance:950}},
 // 河流: a river down the middle and a branch on each side, crossed by shallow fords.
 rivers:{bases:[.3,.33],fords:[[5,7],[15,16],[25,27]],branchFord:2,fish:{shore:3},forests:{clumps:9,size:[5,10],clearance:1000},border:.4},
 // 高地 (高原): one river with two fords, plateaus with cliffs, thick forest.
 highland:{bases:[.3,.33],fords:[[8,10],[22,24]],plateaus:2,fish:{shore:2},forests:{clumps:14,size:[7,13],clearance:1000},border:.6},
 // 綠洲: desert, a lake in the middle ringed by palms (four gaps), little wood elsewhere.
 oasis:{bases:[.34,.38],lake:350,ring:[450,820],palms:.22,fish:{shore:2},forests:{clumps:3,size:[4,7],clearance:1000},border:.15},
 // 斯堪地維亞: two long fjords with fish at the edges, three boar and many deer per base, gold in the middle, low stone.
 scandinavia:{bases:[.3,.34],fjord:{length:10,from:[6,12]},fish:{shore:3},gold:{pairs:2,ring:[0,400]},forests:{clumps:12,size:[7,12],clearance:1000},border:.6},
 // 鹽沼地: marsh: shallows everywhere (walkable, not buildable) and pools of water, land islands with woods.
 'salt-marsh':{bases:[.3,.34],shallow:[.5,.62],keep:900,fish:{shore:2},forests:{clumps:10,size:[5,9],clearance:950},border:.3}} as const;
export function coastal(seed:number):MapData{const R=waterMapRules.coastal,b=new MapBuilder(seed,'mirrorX','coastal');
 b.bases((R.angle[0]+b.random()*(R.angle[1]-R.angle[0]))*Math.PI/180,[...R.bases]);
 // The shoreline: a row per column pair, the same on both halves.
 const sea=(tx:number)=>R.sea+Math.floor(b.smooth(Math.min(tx,b.size-1-tx),R.sea)*R.shoreJitter);
 b.paint((tx,ty)=>ty>=sea(tx)?'water':ty===sea(tx)-1?'sand':null);
 b.kit(standardKit);b.neutral('gold',1,[300,900]);b.neutral('rock',1,[300,900]);b.fishIn(R.fish.shore,'shore');b.fishIn(R.fish.deep,'deep');
 // A beach clear of woods along the shore (for docks and the walk along the coast).
 b.forests(R.forests.clumps,[...R.forests.size],R.forests.clearance,(tx,ty)=>ty<sea(tx)-R.beach);b.border(R.border,750);return b.finish();}
export function mediterranean(seed:number):MapData{const R=waterMapRules.mediterranean,b=new MapBuilder(seed,'rotate','mediterranean');b.bases(null,[...R.bases]);
 b.paint((x,y,d)=>b.baseDistance(x,y)<750?null:d<R.sea+160*(b.smooth(x,y)-.5)?'water':d<R.sea+160*(b.smooth(x,y)-.5)+100?'sand':null);
 b.kit(standardKit);b.neutral('gold',R.neutral.gold,[...R.neutral.ring]);b.neutral('rock',R.neutral.rock,[...R.neutral.ring]);b.fishIn(R.fish.shore,'shore');b.fishIn(R.fish.deep,'deep');
 // The shore stays a road round the sea: no forest within shoreRoad of it.
 b.forests(R.forests.clumps,[...R.forests.size],R.forests.clearance,(x,y)=>Math.hypot(x*100+50-b.mid,y*100+50-b.mid)>R.sea+R.shoreRoad);b.border(R.border,750);return b.finish();}
export function baltic(seed:number):MapData{const R=waterMapRules.baltic,b=new MapBuilder(seed,'rotate','baltic');b.bases((45+90*Math.floor(b.random()*4))*Math.PI/180,[...R.bases]);
 b.paint((x,y,d)=>d<R.sea+140*(b.smooth(x,y)-.5)&&b.baseDistance(x,y)>R.keep?'water':null);
 b.kit(standardKit);b.neutral('gold',1,[1200,1700]);b.neutral('rock',1,[1200,1700]);b.fishIn(R.fish.shore,'shore');b.fishIn(R.fish.deep,'deep');
 // Woods only deep in the wide corners: the strips along the edges and the shore path round the sea stay open.
 const corner=(x:number,y:number)=>Math.min(Math.abs(x*100+50-b.mid),Math.abs(y*100+50-b.mid))>R.corner&&Math.hypot(x*100+50-b.mid,y*100+50-b.mid)>R.sea+R.shoreRoad;
 b.forests(R.forests.clumps,[...R.forests.size],R.forests.clearance,corner);for(let ty=0;ty<b.size;ty++)for(let tx=0;tx<b.size;tx++)if((tx===0||ty===0||tx===b.size-1||ty===b.size-1)&&corner(tx,ty)&&b.noise(tx,ty)<R.border&&b.pairFree(tx,ty,0)&&b.baseDistance(tx,ty)>=700)b.pair('tree',tx,ty);
 return b.finish();}
export function continental(seed:number):MapData{const R=waterMapRules.continental,b=new MapBuilder(seed,'rotate','continental');b.bases(null,[...R.bases]);
 b.paint((x,y,d)=>{const edge=Math.min(x,y,b.size-1-x,b.size-1-y);return edge<R.edge+Math.floor(b.smooth(x,y)*2)?'water':d<R.island?'grass':d<R.lake?'water':null;});
 b.kit(standardKit);
 // Gold on the island in the middle (reachable only by transport).
 for(let ty=0;ty<b.size;ty++)for(let tx=0;tx<b.size;tx++)if(Math.hypot(tx*100+50-b.mid,ty*100+50-b.mid)<R.island&&b.pairFree(tx,ty,0)&&(tx+ty)%2===0){b.pair('gold',tx,ty);b.isolated.add(ty*b.size+tx);}
 b.neutral('gold',R.neutral.gold,[...R.neutral.ring]);b.neutral('rock',R.neutral.rock,[...R.neutral.ring]);b.fishIn(R.fish.shore,'shore',200,(x,y)=>Math.hypot(x*100+50-b.mid,y*100+50-b.mid)<R.lake+100);b.fishIn(R.fish.deep,'deep');
 b.forests(R.forests.clumps,[...R.forests.size],R.forests.clearance);return b.finish();}
// The middle river (columns 15 and 16, now and then 14 and 17 too) with shallow fords on the given rows.
function river(b:MapBuilder,fords:readonly (readonly [number,number])[]){
 b.paint((tx,ty)=>{const wide=b.smooth(15,ty)>.55,half=wide?2:1;if(Math.abs(tx+.5-b.size/2)>half)return null;return fords.some(([a,z])=>ty>=a&&ty<=z)?'shallow':'water';});}
export function rivers(seed:number):MapData{const R=waterMapRules.rivers,b=new MapBuilder(seed,'mirrorX','rivers');b.bases((170+b.random()*20)*Math.PI/180,[...R.bases]);
 river(b,R.fords);
 // A branch on each side from the map edge to the middle river, on a row clear of the bases, with one ford.
 const c=b.centres[0],cy=Math.floor(c.y/100),row=cy>=b.size/2?Math.max(3,cy-8):Math.min(b.size-5,cy+8),ford=b.int(3,9);
 for(let tx=0;tx<15;tx++)for(const ty of [row,row+1])b.set(tx,ty,tx>=ford&&tx<ford+R.branchFord?'shallow':'water');
 b.kit(standardKit);b.neutral('gold',1,[400,1200]);b.neutral('rock',1,[400,1200]);b.fishIn(R.fish.shore,'shore');
 b.forests(R.forests.clumps,[...R.forests.size],R.forests.clearance);b.border(R.border,750);return b.finish();}
export function highland(seed:number):MapData{const R=waterMapRules.highland,b=new MapBuilder(seed,'mirrorX','highland');b.bases((170+b.random()*20)*Math.PI/180,[...R.bases]);
 river(b,R.fords);
 // Plateaus on each side (height 100, cliff edges) with a two-tile ramp towards the river.
 for(let i=0;i<R.plateaus;i++){const at=b.pick((x,y)=>x>=3&&x<=10&&y>=3&&y<=b.size-4&&b.baseDistance(x,y)>=850,[400,1500],undefined,120);if(!at)continue;const [cx,cy]=at;
  for(let ty=cy-2;ty<=cy+2;ty++)for(let tx=cx-2;tx<=cx+2;tx++)if(b.inside(tx,ty)&&Math.hypot(tx-cx,ty-cy)<=2.2)b.set(tx,ty,'highland',100);
  for(let k=0;k<3;k++)for(const ty of [cy,cy+1])if(b.inside(cx+3+k,ty))b.set(cx+3+k,ty,'highland',75-25*k,false);}
 b.kit(standardKit);b.neutral('gold',1,[500,1300]);b.neutral('rock',1,[500,1300]);b.fishIn(R.fish.shore,'shore');
 b.forests(R.forests.clumps,[...R.forests.size],R.forests.clearance);b.border(R.border,750);return b.finish();}
export function oasis(seed:number):MapData{const R=waterMapRules.oasis,b=new MapBuilder(seed,'rotate','oasis');b.bases(null,[...R.bases]);
 b.paint((x,y,d)=>d<R.lake?'water':'sand');b.kit(standardKit);
 // The palm ring round the lake, with four gaps (to the lake from each side).
 for(let ty=0;ty<b.size;ty++)for(let tx=0;tx<b.size;tx++){const x=tx*100+50-b.mid,y=ty*100+50-b.mid,d=Math.hypot(x,y),a=Math.atan2(y,x),gap=Math.abs(Math.sin(2*a))<.3;
  if(d>=R.ring[0]&&d<=R.ring[1]&&!gap&&b.noise(tx,ty)>R.palms&&b.pairFree(tx,ty,1)&&b.baseDistance(tx,ty)>=600)b.pair('tree',tx,ty);}
 b.neutral('gold',1,[900,1400]);b.neutral('rock',1,[900,1400]);b.fishIn(R.fish.shore,'shore',200);
 b.forests(R.forests.clumps,[...R.forests.size],R.forests.clearance,(x,y)=>Math.hypot(x*100+50-b.mid,y*100+50-b.mid)>R.ring[1]);b.border(R.border,750);return b.finish();}
// Scandinavia's kit: the standard one with two more boar (the site's third boar) and a second deer herd.
const scandinaviaKit=():KitItem[]=>[...standardKit,{kind:'boar',dx:-760,dy:620},{kind:'boar',dx:0,dy:-960},{kind:'hunt',dx:640,dy:-720,count:3}];
export function scandinavia(seed:number):MapData{const R=waterMapRules.scandinavia,b=new MapBuilder(seed,'rotate','scandinavia');b.bases(null,[...R.bases]);
 // A fjord from the west edge on rows clear of the first base (the other, turned, from the east edge).
 const cy=Math.floor(b.centres[0].y/100),cx=Math.floor(b.centres[0].x/100),rows=[R.fjord.from[0],R.fjord.from[1],b.size-1-R.fjord.from[1],b.size-1-R.fjord.from[0]];
 const row=rows.sort((p,q)=>Math.abs(q-cy)-Math.abs(p-cy)||p-q)[0],west=cx>=b.size/2;
 for(let k=0;k<R.fjord.length;k++)for(const ty of [row,row+1]){const tx=west?k:b.size-1-k;b.set(tx,ty,'water');}
 b.kit(scandinaviaKit());b.neutral('gold',R.gold.pairs,[...R.gold.ring],900,2);b.fishIn(R.fish.shore,'shore',200);
 b.forests(R.forests.clumps,[...R.forests.size],R.forests.clearance);b.border(R.border,750);return b.finish();}
export function saltMarsh(seed:number):MapData{const R=waterMapRules['salt-marsh'],b=new MapBuilder(seed,'rotate','salt-marsh');b.bases(null,[...R.bases]);
 b.paint((x,y)=>{if(b.baseDistance(x,y)<R.keep)return null;const n=b.smooth(x,y);return n>R.shallow[1]?'water':n>R.shallow[0]?'shallow':null;});
 b.kit(standardKit);b.neutral('gold',1,[300,1100]);b.neutral('rock',1,[300,1100]);b.fishIn(R.fish.shore,'shore',200);
 b.forests(R.forests.clumps,[...R.forests.size],R.forests.clearance);b.border(R.border,750);return b.finish();}
