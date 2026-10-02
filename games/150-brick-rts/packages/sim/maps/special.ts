// Special-start and island maps of the 地圖 round (design_default after aoetw.com's map pages; see
// docs/aoe2-rules-research.md 地圖): Fortress and Arena (bases walled in stone, with Fortress's prebuilt town),
// Nomad (no town centre), Migration (islet starts by a mainland) and the island maps (Islands, Archipelago, Team
// Islands). Offsets are map units (a tile is 100) or tiles from a town centre's tile where noted.
import {MapBuilder,standardKit} from './toolkit.ts';
import type {KitItem} from './toolkit.ts';
import type {MapData,Point} from '../navigation.ts';
// A nomad start adds one town centre's price to each side's stock (rules.ts: 275 wood, 100 stone; the site gives the
// start no numbers).
export const nomadStock={wood:275,stone:100} as const;
export const specialMapRules={provenance:'design_default after aoetw.com maps pages (2026-10-02)',nomadStock,
 // 堡壘: a stone wall ring (Chebyshev `ring` tiles from the town centre's tile; the map edge closes it where it leaves the
 // map) with, inside, the site's 5 farms, 4 watch towers, 4 houses and a barracks (top-left tiles from the town centre's
 // tile; the second player's town is the same turned half round). No gates: the players build them (the site names none).
 // Columns within two tiles of the town centre stay clear north and south of it: both players' villagers start south of
 // their own town centre, which on the turned second town is north. Farms (walkable) lie south of the first's.
 fortress:{bases:[.3,.33],ring:7,kitRadius:560,barracks:[[-5,-3]],houses:[[3,-4],[3,0],[-5,1],[-5,-6]],farms:[[-3,3],[-1,3],[1,3],[-2,5],[0,5]],towers:[[-6,-6],[6,-6],[-6,6],[6,6]],
  neutral:{gold:2,rock:1,ring:[0,800]},deer:{pairs:2,count:3,ring:[500,1300]},forests:{clumps:8,size:[5,10],clearance:1000},border:.35},
 // 圍城: the same walled town in a forest that fills the map but for an open middle (the only way between the bases),
 // a lane from each wall to it, gold and stone just outside each wall on that side, and small pockets with more.
 // (A ring a tile wider than Fortress's: the town has to find room for its own barracks inside.)
 arena:{bases:[.3,.33],ring:8,kitRadius:640,gap:150,open:700,lane:160,density:.12,outside:450,pockets:{pairs:2,radius:130,ring:[850,1250]},
  neutral:{gold:2,rock:1,berries:1,ring:[0,500]},deer:{pairs:2,count:3,ring:[0,600]}},
 // 游牧: sea on three sides (north, west, east: `sea` tiles), no town centre; each side's three villagers stand apart
 // (offsets from where its kit lies) and there is no scout (the site: like Mountain Pass, no scout).
 nomad:{bases:[.25,.28],angle:[172,188],sea:3,jitter:2,scatter:[[-200,-300],[340,-220],[100,330]],fish:{shore:3,deep:3},neutral:{gold:1,rock:1,ring:[300,1100]},forests:{clumps:9,size:[5,10],clearance:900},border:.3},
 // 移民: each side on a small islet near a corner, a mainland in the middle (no boar; the sheep are far, on the
 // mainland's shore facing each islet). The islets carry wood, berries and shore fish only: gold and stone are the
 // mainland's.
 migration:{bases:[.45,.46],islet:540,strait:260,edge:2,trees:10,fish:{shore:3,deep:3},mainlandSheep:{pairs:2,count:4},deer:{pairs:2,count:3},neutral:{gold:2,rock:2,berries:1},forests:{clumps:9,size:[5,10]}},
 // 島嶼: each side's own island; two islets (a mirrored pair, across the base axis) with gold and stone.
 islands:{bases:[.33,.35],island:920,kitScale:1,islets:[{at:1150,radius:260,goods:['gold','rock']}],fish:{shore:3,deep:4},forests:{clumps:7,size:[5,9],clearance:480}},
 // 群島: smaller home islands and four islets: one pair bare, one pair rich (gold, stone, wood and food).
 archipelago:{bases:[.33,.35],island:820,kitScale:1,islets:[{at:1250,radius:200,goods:[]},{at:620,radius:250,goods:['gold','rock','tree','berries']}],fish:{shore:4,deep:4},forests:{clumps:6,size:[4,8],clearance:480}},
 // 團隊群島: with one player a side, each side's team island is a whole half of the map, split by a channel through the
 // middle and ringed by sea.
 'team-islands':{bases:[.3,.33],edge:2,channel:1.6,fish:{shore:4,deep:4},neutral:{gold:1,rock:1},forests:{clumps:9,size:[5,10],clearance:950},border:.35}} as const;
// A kit for a walled town: everything at `radius` from the town centre (between its clear apron and the wall), at the
// standard kit's angles; trees in pairs.
function walledKit(radius:number):KitItem[]{const at=(deg:number)=>({dx:Math.round(Math.cos(deg*Math.PI/180)*radius),dy:Math.round(Math.sin(deg*Math.PI/180)*radius)});
 return [{kind:'tree',...at(-90),group:2},{kind:'tree',...at(-130),group:2},{kind:'tree',...at(-50),group:2},{kind:'gold',...at(0)},{kind:'rock',...at(180)},{kind:'berries',...at(40)},
  {kind:'livestock',...at(140),count:4},{kind:'boar',...at(70)},{kind:'livestock',...at(110),count:2}];}
// The town centre's tile (where wall rings and Fortress's buildings are measured from).
const homeTile=(b:MapBuilder)=>{const c=b.centres[0];return [Math.floor(c.x/100),Math.floor(c.y/100)] as const;};
// A ring of stone wall tiles at Chebyshev `ring` from the town centre's tile (both players: the second's is the mirror).
function wallRing(b:MapBuilder,ring:number){const [cx,cy]=homeTile(b);
 for(let ty=cy-ring;ty<=cy+ring;ty++)for(let tx=cx-ring;tx<=cx+ring;tx++)if(Math.max(Math.abs(tx-cx),Math.abs(ty-cy))===ring&&b.inside(tx,ty))b.pairBuilding('stone-wall',tx*100,ty*100);}
// Inside the wall ring (Chebyshev from the town centre's tile).
const insideRing=(b:MapBuilder,ring:number)=>(tx:number,ty:number)=>{const [cx,cy]=homeTile(b),[mx,my]=b.mirrorTile(cx,cy);return Math.max(Math.abs(tx-cx),Math.abs(ty-cy))<ring||Math.max(Math.abs(tx-mx),Math.abs(ty-my))<ring;};
export function fortress(seed:number):MapData{const R=specialMapRules.fortress,b=new MapBuilder(seed,'rotate','fortress');b.bases(null,[...R.bases]);b.walled=true;
 wallRing(b,R.ring);const [cx,cy]=homeTile(b);
 // The town: positions are each footprint's anchor on its top-left tile (barracks and houses sit 15 in, like the
 // town centre; farms and towers on the tile corner).
 for(const [dx,dy] of R.barracks)b.pairBuilding('barracks',(cx+dx)*100+15,(cy+dy)*100+15);
 for(const [dx,dy] of R.houses)b.pairBuilding('house',(cx+dx)*100+15,(cy+dy)*100+15);
 for(const [dx,dy] of R.farms)b.pairBuilding('farm',(cx+dx)*100,(cy+dy)*100);
 for(const [dx,dy] of R.towers)b.pairBuilding('watch-tower',(cx+dx)*100,(cy+dy)*100);
 b.kit(walledKit(R.kitRadius));const inside=insideRing(b,R.ring+1);
 b.neutral('gold',R.neutral.gold,[...R.neutral.ring]);b.neutral('rock',R.neutral.rock,[...R.neutral.ring]);
 b.animals('hunt',R.deer.pairs,R.deer.count,[...R.deer.ring],(x,y)=>!inside(x,y));
 b.forests(R.forests.clumps,[...R.forests.size],R.forests.clearance,(x,y)=>!inside(x,y));b.border(R.border,900);return b.finish();}
export function arena(seed:number):MapData{const R=specialMapRules.arena,b=new MapBuilder(seed,'rotate','arena');b.bases(null,[...R.bases]);b.walled=true;
 wallRing(b,R.ring);b.kit(walledKit(R.kitRadius));const inside=insideRing(b,R.ring+1),c0=b.centres[0];
 // Gold and stone just outside each wall, on the side facing the middle.
 const toMid=Math.atan2(b.mid-c0.y,b.mid-c0.x),out=(d:number,turn:number):[number,number]=>[Math.floor((c0.x+Math.cos(toMid+turn)*d)/100),Math.floor((c0.y+Math.sin(toMid+turn)*d)/100)];
 for(const [kind,turn] of [['gold',-.5],['rock',.5]] as const){for(const extra of [0,100,200]){const [tx,ty]=out(R.ring*100+R.outside-300+extra,turn);if(b.pairFree(tx,ty,1)&&!inside(tx,ty)){b.pair(kind,tx,ty);break;}}}
 // Pockets: small clearings off the middle, each with a gold or stone pile, joined to the middle by a one-tile path.
 const pockets:{x:number;y:number}[]=[];for(let i=0;i<R.pockets.pairs;i++){const at=b.pick((x,y)=>b.pairFree(x,y,2)&&b.baseDistance(x,y)>=1000&&!inside(x,y),[...R.pockets.ring]);
  if(!at)continue;b.pair(i%2?'rock':'gold',at[0],at[1]);pockets.push({x:at[0]*100+50,y:at[1]*100+50});}
 const nearSegment=(px:number,py:number,a:{x:number;y:number},z:{x:number;y:number},w:number)=>{const dx=z.x-a.x,dy=z.y-a.y,len=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((px-a.x)*dx+(py-a.y)*dy)/len));return Math.hypot(px-(a.x+dx*t),py-(a.y+dy*t))<=w;};
 const middle={x:b.mid,y:b.mid},bases=b.centres.map(c=>({x:c.x,y:c.y})),pocketsAll=pockets.flatMap(p=>[p,b.mirrorPoint(p.x,p.y)]);
 const clear=(tx:number,ty:number)=>{const px=tx*100+50,py=ty*100+50;if(Math.hypot(px-b.mid,py-b.mid)<R.open)return true;if(b.baseDistance(tx,ty)<R.ring*100+R.gap+150)return true;
  if(bases.some(c=>nearSegment(px,py,c,middle,R.lane)))return true;return pocketsAll.some(p=>Math.hypot(px-p.x,py-p.y)<=R.pockets.radius+60||nearSegment(px,py,p,middle,60));};
 b.neutral('gold',R.neutral.gold,[...R.neutral.ring],800);b.neutral('rock',R.neutral.rock,[...R.neutral.ring],800);b.neutral('berries',R.neutral.berries,[...R.neutral.ring],800);
 b.animals('hunt',R.deer.pairs,R.deer.count,[...R.deer.ring],undefined,800);
 // The forest: every other tile (a little thinned by the noise).
 for(let ty=0;ty<b.size;ty++)for(let tx=0;tx<b.size;tx++){const [mx,my]=b.mirrorTile(tx,ty);if(my*b.size+mx<ty*b.size+tx||clear(tx,ty)||b.noise(tx,ty)<R.density)continue;if(b.pairFree(tx,ty,0))b.pair('tree',tx,ty);}
 return b.finish();}
export function nomad(seed:number):MapData{const R=specialMapRules.nomad,b=new MapBuilder(seed,'mirrorX','nomad');b.bases((R.angle[0]+b.random()*(R.angle[1]-R.angle[0]))*Math.PI/180,[...R.bases]);b.nomad=true;
 // Sea on the north, west and east edges (the shoreline the same on both halves).
 b.paint((tx,ty)=>{const j=Math.floor(b.smooth(Math.min(tx,b.size-1-tx),ty)*R.jitter);return Math.min(tx,b.size-1-tx)<R.sea+j||ty<R.sea+j?'water':null;});
 b.kit(standardKit);b.neutral('gold',R.neutral.gold,[...R.neutral.ring]);b.neutral('rock',R.neutral.rock,[...R.neutral.ring]);b.fishIn(R.fish.shore,'shore');b.fishIn(R.fish.deep,'deep');
 b.forests(R.forests.clumps,[...R.forests.size],R.forests.clearance);b.border(R.border,750);
 // No town centre: the spot stays clear (its tiles keep their mark), the three villagers stand apart round it, no scout.
 b.obstacles=b.obstacles.filter(o=>o.kind!=='town-center');b.scouts=undefined;
 const c=b.centres[0],grid=(p:Point)=>({x:Math.round(p.x/50)*50,y:Math.round(p.y/50)*50});
 const first=R.scatter.map(([dx,dy])=>grid({x:c.x+dx,y:c.y+dy}));b.starts=[first,first.map(p=>grid(b.mirrorPoint(p.x,p.y)))];return b.finish();}
// Land of a disc round a point with a ragged edge (the same on a tile and its mirror).
const disc=(b:MapBuilder,tx:number,ty:number,x:number,y:number,r:number,rag=120)=>Math.hypot(tx*100+50-x,ty*100+50-y)<r+rag*(b.smooth(tx,ty)-.5);
export function migration(seed:number):MapData{const R=specialMapRules.migration,b=new MapBuilder(seed,'rotate','migration');b.bases((45+90*Math.floor(b.random()*4))*Math.PI/180,[...R.bases]);
 b.separate=true;b.lean=['gold','stone'];const c0=b.centres[0],c1=b.centres[1];
 // (paint evaluates one tile of each mirrored pair, either side: both islets are tested.)
 // The mainland: all ground at least `strait` beyond either islet and `edge` tiles in from the map's edge.
 const main=(tx:number,ty:number)=>Math.min(tx,ty,b.size-1-tx,b.size-1-ty)>=R.edge&&[c0,c1].every(c=>Math.hypot(tx*100+50-c.x,ty*100+50-c.y)>=R.islet+40+R.strait);
 b.paint((tx,ty)=>disc(b,tx,ty,c0.x,c0.y,R.islet,80)||disc(b,tx,ty,c1.x,c1.y,R.islet,80)||main(tx,ty)?null:'water');
 // The islet: trees and berries on its free land (the town centre's clear apron does not apply on so small a start).
 const islet:[number,number][]=[];for(let ty=0;ty<b.size;ty++)for(let tx=0;tx<b.size;tx++){const d=Math.hypot(tx*100+50-c0.x,ty*100+50-c0.y);if(d<R.islet+60&&d>260&&b.tile(tx,ty).walkClass==='land'&&!b.taken.has(ty*b.size+tx))islet.push([tx,ty]);}
 const away=(tx:number,ty:number)=>{const a=Math.atan2(ty*100+50-c0.y,tx*100+50-c0.x),south=Math.PI/2;return Math.abs(Math.atan2(Math.sin(a-south),Math.cos(a-south)))>.9;};
 const spots=islet.filter(([x,y])=>away(x,y)).sort((p,q)=>Math.atan2(p[1]*100+50-c0.y,p[0]*100+50-c0.x)-Math.atan2(q[1]*100+50-c0.y,q[0]*100+50-c0.x));
 let trees=0,berries=false;for(const [tx,ty] of spots){const [mx,my]=b.mirrorTile(tx,ty);if(b.taken.has(ty*b.size+tx)||b.taken.has(my*b.size+mx))continue;
  if(!berries){b.pair('berries',tx,ty);berries=true;continue;}if(trees<R.trees){b.pair('tree',tx,ty);trees++;}}
 b.fishIn(R.fish.shore,'shore',200,(x,y)=>disc(b,x,y,c0.x,c0.y,R.islet+250,0)||disc(b,x,y,c1.x,c1.y,R.islet+250,0));b.fishIn(R.fish.deep,'deep');
 // The mainland: the sheep near the shore facing each islet, gold, stone, berries, deer and woods.
 const onMain=(x:number,y:number)=>main(x,y)&&[c0,c1].every(c=>Math.hypot(x*100+50-c.x,y*100+50-c.y)>=R.islet+R.strait+160);
 // (The sheep on the mainland's shore facing each islet, across the strait.)
 for(let i=0;i<R.mainlandSheep.pairs;i++){const at=b.pick((x,y)=>onMain(x,y)&&b.pairFree(x,y,1)&&Math.hypot(x*100+50-c0.x,y*100+50-c0.y)<Math.hypot(x*100+50-c1.x,y*100+50-c1.y),[R.islet+R.strait+250,R.islet+R.strait+600],{x:c0.x,y:c0.y});if(at)b.pair('livestock',at[0],at[1],undefined,R.mainlandSheep.count);}
 for(const [kind,pairs] of [['gold',R.neutral.gold],['rock',R.neutral.rock],['berries',R.neutral.berries]] as const)for(let i=0;i<pairs;i++){const at=b.pick((x,y)=>onMain(x,y)&&b.pairFree(x,y,1),[0,1500]);if(at)b.pair(kind,at[0],at[1]);}
 b.animals('hunt',R.deer.pairs,R.deer.count,[0,1500],onMain,0);b.forests(R.forests.clumps,[...R.forests.size],0,onMain);
 // Mines are only reachable by ship from the start; the reach check measures from the first base on foot.
 for(const [a,z] of b.mines){b.isolated.add(a);b.isolated.add(z);}return b.finish();}
// Islands and Archipelago: each side's home island (a disc round its town centre) and islets (mirrored pairs across
// the axis between the bases) carrying goods.
type IslandRules={bases:readonly [number,number];island:number;kitScale:number;islets:readonly {at:number;radius:number;goods:readonly string[];turn?:number}[];fish:{shore:number;deep:number};forests:{clumps:number;size:readonly [number,number];clearance:number}};
function islandMap(b:MapBuilder,R:IslandRules){
 b.bases(null,[...R.bases]);b.separate=true;const c0=b.centres[0],c1=b.centres[1],axis=Math.atan2(c0.y-b.mid,c0.x-b.mid);
 const islets=R.islets.map(i=>{const a=axis+Math.PI/2+(i.turn??0);return {...i,x:b.mid+Math.cos(a)*i.at,y:b.mid+Math.sin(a)*i.at};});
 // Each islet and its mirror (paint tests one tile of each mirrored pair, from either side).
 const both=islets.flatMap(i=>[i,{...i,...b.mirrorPoint(i.x,i.y)}]);
 // A strait at least `strait` wide on each side of the line halfway between the bases keeps the home islands apart.
 const ux=Math.cos(axis),uy=Math.sin(axis),strait=(tx:number,ty:number)=>Math.abs((tx*100+50-b.mid)*ux+(ty*100+50-b.mid)*uy)<200;
 // (and a strait round each islet: the home islands give way to it.)
 const offIslets=(tx:number,ty:number)=>both.every(i=>Math.hypot(tx*100+50-i.x,ty*100+50-i.y)>=i.radius+260);
 b.paint((tx,ty)=>!strait(tx,ty)&&offIslets(tx,ty)&&(disc(b,tx,ty,c0.x,c0.y,R.island)||disc(b,tx,ty,c1.x,c1.y,R.island))||both.some(i=>disc(b,tx,ty,i.x,i.y,i.radius,60))?null:'water');
 b.kit(standardKit.map(k=>({...k,dx:Math.round(k.dx*R.kitScale),dy:Math.round(k.dy*R.kitScale)})));
 const home=(x:number,y:number)=>Math.hypot(x*100+50-c0.x,y*100+50-c0.y)<R.island-150||Math.hypot(x*100+50-c1.x,y*100+50-c1.y)<R.island-150;
 // Islet goods (gold and stone on the islets are reached by ship: the on-foot reach check skips them).
 for(const i of islets){const tiles:[number,number][]=[];for(let ty=0;ty<b.size;ty++)for(let tx=0;tx<b.size;tx++)if(Math.hypot(tx*100+50-i.x,ty*100+50-i.y)<i.radius-40&&b.pairFree(tx,ty,1))tiles.push([tx,ty]);
  tiles.sort((p,q)=>Math.hypot(p[0]*100+50-i.x,p[1]*100+50-i.y)-Math.hypot(q[0]*100+50-i.x,q[1]*100+50-i.y)||p[0]-q[0]||p[1]-q[1]);
  let k=0;for(const kind of i.goods)for(const [tx,ty] of tiles.slice(k)){k++;if(!b.pairFree(tx,ty,1))continue;b.pair(kind==='berries'?'berries':kind,tx,ty);if(kind==='gold'||kind==='rock'){b.isolated.add(ty*b.size+tx);const [mx,my]=b.mirrorTile(tx,ty);b.isolated.add(my*b.size+mx);}break;}}
 b.fishIn(R.fish.shore,'shore');b.fishIn(R.fish.deep,'deep');b.forests(R.forests.clumps,[...R.forests.size],R.forests.clearance,home);return b.finish();}
export function islands(seed:number):MapData{return islandMap(new MapBuilder(seed,'rotate','islands'),specialMapRules.islands);}
export function archipelago(seed:number):MapData{return islandMap(new MapBuilder(seed,'rotate','archipelago'),specialMapRules.archipelago);}
export function teamIslands(seed:number):MapData{const R=specialMapRules['team-islands'],b=new MapBuilder(seed,'rotate','team-islands');b.bases(null,[...R.bases]);b.separate=true;
 const c0=b.centres[0],axis=Math.atan2(c0.y-b.mid,c0.x-b.mid),ux=Math.cos(axis),uy=Math.sin(axis);
 // Sea round the edge and a channel through the middle, square to the axis between the bases.
 b.paint((tx,ty)=>{const edge=Math.min(tx,ty,b.size-1-tx,b.size-1-ty),along=(tx*100+50-b.mid)*ux+(ty*100+50-b.mid)*uy;return edge<R.edge||Math.abs(along)<R.channel*100+60*(b.smooth(tx,ty)-.5)?'water':null;});
 b.kit(standardKit);const own=(x:number,y:number)=>Math.abs((x*100+50-b.mid)*ux+(y*100+50-b.mid)*uy)>R.channel*100+200;
 b.neutral('gold',R.neutral.gold,[300,1300]);b.neutral('rock',R.neutral.rock,[300,1300]);b.fishIn(R.fish.shore,'shore');b.fishIn(R.fish.deep,'deep');
 b.forests(R.forests.clumps,[...R.forests.size],R.forests.clearance,own);b.border(R.border,750);return b.finish();}
