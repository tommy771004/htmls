// Shared toolkit of the 地圖 round's random maps (design_default, after aoetw.com's map pages; see
// docs/aoe2-rules-research.md). Every match map is 32 tiles a side for two players and fair by construction: whatever
// the generator puts on one tile it also puts on the mirrored tile, either turned half round the centre ('rotate') or
// reflected left to right ('mirrorX'). A map is built in four steps: bases (town centres, starting villagers and the
// scout), terrain (water, shallows, ice, plateaus and ramps), then resources (each base's kit, then neutral resources,
// forests, fish and animals), then finish() turns it all into MapData. Special starts (prebuilt walls, no town centre)
// and island maps plug in through the same calls: building obstacles placed with building(), a map without bases() keeps
// its own starts, and `separate` marks bases on different landmasses.
import {terrainRules,terrainDefinitions,tileAt,createTiles} from '../terrain.ts';
import type {TerrainType,Tile,ResourceKind,MapLayout} from '../terrain.ts';
import {isBuilding,clearSegment,position,nodeTotal,flock,nearest,sideOf,nodeAt,blockedTable} from '../navigation.ts';
import {obstacleBounds} from '../../content/footprints.ts';
import type {MapData,Obstacle,Point} from '../navigation.ts';
import type {AnimalKind} from '../fauna.ts';
import type {ObstacleKind} from '../../content/footprints.ts';
export type Symmetry='rotate'|'mirrorX';
// A base kit item: an offset from the town centre's centre (the gate faces south for both players, so the second
// player's kit is the first one's mirrored tiles). tree: a grove of `group` trees; livestock: the base's own sheep;
// hunt: a deer herd; boar: one boar; count: animals in the flock.
export type KitItem={kind:'tree'|'gold'|'rock'|'berries'|'livestock'|'hunt'|'boar';dx:number;dy:number;group?:number;count?:number};
// The standard kit: the 'open' map's base (navigation.ts openMapRules.kit and its far boar and sheep), this game's
// scaled counterpart of the reference's standard start (8 sheep, 2 boar, 3-4 deer, 3 gold and 2 stone piles at a
// 200-population scale; here the population cap is 40, piles hold 250, so one gold and one stone pile, six sheep).
export const standardKit:readonly KitItem[]=[{kind:'tree',dx:0,dy:-560,group:6},{kind:'gold',dx:520,dy:-60},{kind:'rock',dx:-520,dy:-60},{kind:'berries',dx:480,dy:360},
 {kind:'livestock',dx:-480,dy:340,count:4},{kind:'hunt',dx:0,dy:780,count:3},{kind:'boar',dx:760,dy:620},{kind:'livestock',dx:-760,dy:-620,count:2}];
// Clear ground round each town centre (Chebyshev from its centre): nothing but the kit goes there.
export const apron=420;
type Spot={kind:AnimalKind;x:number;y:number;count:number;within:number;owner?:number;open:number};
export class MapBuilder{
 readonly size=32;readonly world=3200;readonly mid=1600;tiles:Tile[];taken=new Set<number>();obstacles:Obstacle[]=[];spots:Spot[]=[];fish:number[]=[];
 // mines: gold and stone pairs as tile ids (finish() makes sure each can be reached on foot); isolated: mines meant to
 // be out of reach by land (an island's), skipped by that check.
 mines:[number,number][]=[];isolated=new Set<number>();
 centres:{ax:number;ay:number;x:number;y:number}[]=[];starts:Point[][]=[];scouts:Point[]|undefined;separate=false;private rng:number;private salt:number;
 // Special starts (MapData walled / nomad / lean).
 walled=false;nomad=false;lean:string[]|undefined;
 readonly symmetry:Symmetry;
 constructor(seed:number,symmetry:Symmetry,layout:MapLayout){this.symmetry=symmetry;this.rng=seed||1;this.salt=(seed^0x9e3779b9)>>>0;this.tiles=createTiles(layout,seed);}
 random(){let n=this.rng;n^=n<<13;n^=n>>>17;n^=n<<5;this.rng=n>>>0;return this.rng/4294967296;}
 int(lo:number,hi:number){return lo+Math.floor(this.random()*(hi-lo+1));}
 inside(tx:number,ty:number){return tx>=0&&ty>=0&&tx<this.size&&ty<this.size;}
 mirrorTile(tx:number,ty:number):[number,number]{return this.symmetry==='rotate'?[this.size-1-tx,this.size-1-ty]:[this.size-1-tx,ty];}
 mirrorPoint(x:number,y:number):Point{return this.symmetry==='rotate'?{x:this.world-x,y:this.world-y}:{x:this.world-x,y};}
 tile(tx:number,ty:number){return this.tiles[ty*this.size+tx];}
 // A value in [0,1) per tile that is the same on a tile and its mirror (salted by the seed), for irregular shapes.
 noise(tx:number,ty:number){const [mx,my]=this.mirrorTile(tx,ty),a=ty*this.size+tx,b=my*this.size+mx;let v=Math.imul(Math.min(a,b)+1,0x9e3779b1)^this.salt;v=Math.imul(v^v>>>16,0x45d9f3b);v=Math.imul(v^v>>>16,0x45d9f3b);return ((v^v>>>16)>>>0)/4294967296;}
 // Smooth noise: the average of the tile's noise and its neighbours' (blobs and shorelines without single-tile specks).
 smooth(tx:number,ty:number){let t=0,n=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=tx+dx,y=ty+dy;if(this.inside(x,y)){t+=this.noise(x,y);n++;}}return t/n;}
 // Sets a tile and its mirror (height: a plateau or ramp tile's height; otherwise the terrain's own).
 set(tx:number,ty:number,type:TerrainType,height?:number,buildable?:boolean){for(const [x,y] of [[tx,ty],this.mirrorTile(tx,ty)]){const t=this.tile(x,y);Object.assign(t,{terrainType:type,...terrainDefinitions[type]});if(height!==undefined)t.height=height;if(buildable!==undefined)t.buildability=buildable;}}
 // Paints every tile the function names (evaluated on the tile and applied to it and its mirror).
 paint(f:(tx:number,ty:number,d:number)=>TerrainType|{type:TerrainType;height?:number;buildable?:boolean}|null){
  for(let ty=0;ty<this.size;ty++)for(let tx=0;tx<this.size;tx++){const [mx,my]=this.mirrorTile(tx,ty);if(my*this.size+mx<ty*this.size+tx)continue;
   const r=f(tx,ty,Math.hypot(tx*100+50-this.mid,ty*100+50-this.mid));if(!r)continue;const v=typeof r==='string'?{type:r}:r;this.set(tx,ty,v.type,v.height,v.buildable);}}
 // Distance (tile centre) to the nearest town centre's centre.
 baseDistance(tx:number,ty:number){return Math.min(...this.centres.map(c=>Math.hypot(tx*100+50-c.x,ty*100+50-c.y)),Infinity);}
 // The two town centres: the first player at the angle (random when null) and a distance from the map centre (a share
 // of the map's width), the second on the mirrored spot. Anchors snap to the grid the town centre needs (x = 50k + 15,
 // y = 50k), so the second centre may sit up to half a node off the exact mirror.
 bases(angle:number|null,distance:[number,number]){
  const a=angle??this.random()*Math.PI*2,r=this.world*(distance[0]+this.random()*(distance[1]-distance[0]));
  const c0={x:this.mid+Math.cos(a)*r,y:this.mid+Math.sin(a)*r},c1=this.mirrorPoint(c0.x,c0.y);
  this.centres=[c0,c1].map(c=>{const cx=Math.min(this.world-650,Math.max(650,c.x)),cy=Math.min(this.world-750,Math.max(650,c.y)),ax=Math.round((cx-150)/50)*50+15,ay=Math.round((cy-135)/50)*50;return {ax,ay,x:ax+135,y:ay+135};});
  this.starts=this.centres.map(c=>[{x:c.ax+85,y:c.ay+350},{x:c.ax+185,y:c.ay+350},{x:c.ax+135,y:c.ay+450}]);this.scouts=this.centres.map(c=>({x:c.ax+235,y:c.ay+450}));
  this.centres.forEach((c,p)=>{this.obstacles.push({kind:'town-center',x:c.ax,y:c.ay,...(p?{red:true}:{})});
   for(let ty=Math.floor((c.y-150)/100);ty<=Math.floor((c.y+150)/100);ty++)for(let tx=Math.floor((c.x-150)/100);tx<=Math.floor((c.x+150)/100);tx++)this.taken.add(ty*this.size+tx);});
 }
 inApron(tx:number,ty:number){return this.centres.some(c=>Math.max(Math.abs(tx*100+50-c.x),Math.abs(ty*100+50-c.y))<apron+50);}
 // Free for a resource or a tree: inside the border, not used, off the aprons, on buildable land.
 free(tx:number,ty:number,edge=1){if(tx<edge||ty<edge||tx>=this.size-edge||ty>=this.size-edge)return false;const t=this.tile(tx,ty);return !this.taken.has(ty*this.size+tx)&&!this.inApron(tx,ty)&&t.walkClass==='land'&&t.buildability;}
 // Both a tile and its mirror free (and not the same tile), so a placement is always made in pairs.
 pairFree(tx:number,ty:number,edge=1){const [mx,my]=this.mirrorTile(tx,ty);return (mx!==tx||my!==ty)&&this.free(tx,ty,edge)&&this.free(mx,my,edge);}
 private add(kind:string,tx:number,ty:number,owner?:number,count=1){this.taken.add(ty*this.size+tx);const cx=tx*100+50,cy=ty*100+50;
  if(kind==='livestock')this.spots.push({kind:'sheep',x:cx,y:cy,count,within:200,...(owner===undefined?{}:{owner}),open:0});
  else if(kind==='hunt')this.spots.push({kind:'deer',x:cx,y:cy,count,within:200,open:0});
  else if(kind==='boar'||kind==='wolf'||kind==='jaguar')this.spots.push({kind:kind as AnimalKind,x:cx,y:cy,count,within:400,open:16});
  else this.obstacles.push({kind:kind as ObstacleKind,x:tx*100+(kind==='tree'?12:15),y:ty*100+(kind==='tree'?12:15)});}
 // Places a resource on a tile and its mirror (the owner of a sheep flock goes to the base whose kit it is).
 pair(kind:string,tx:number,ty:number,owner?:number,count=1){const [mx,my]=this.mirrorTile(tx,ty);if(kind==='gold'||kind==='rock')this.mines.push([ty*this.size+tx,my*this.size+mx]);this.add(kind,tx,ty,owner,count);this.add(kind,mx,my,owner===undefined?undefined:1-owner,count);}
 // Each base's kit: the first player's items at their offsets (a blocked spot turns round the centre in 15-degree
 // steps, keeping the distance), each on its mirrored tile for the second player. An item with no room is left out
 // (validateStartingResources then rejects the candidate and makeMap retries).
 // With no room at the item's distance, it tries closer in (85%, then 70% of it) before giving up.
 kit(items:readonly KitItem[]){const c=this.centres[0];
  for(const item of items){const base=Math.atan2(item.dy,item.dx);let placed=false;
   for(const scale of [1,.85,.7]){const d=Math.hypot(item.dx,item.dy)*scale;
    for(let step=0;step<24&&!placed;step++){const a=base+(step%2?-1:1)*Math.ceil(step/2)*15*Math.PI/180,tx=Math.floor((c.x+Math.cos(a)*d)/100),ty=Math.floor((c.y+Math.sin(a)*d)/100);
     const cells=item.kind==='tree'?[[0,0],[1,0],[0,1],[1,1],[-1,0],[0,-1],[-1,1],[1,-1]].slice(0,item.group??1).map(([dx,dy])=>[tx+dx,ty+dy]):[[tx,ty]];
     if(cells.every(([x,y])=>this.pairFree(x,y,1))){for(const [x,y] of cells)this.pair(item.kind,x,y,item.kind==='livestock'?0:undefined,item.count??1);placed=true;}}
    if(placed)break;}}
 }
 // A tile at a random angle and a distance (tiles' centres, from the map centre or a given point) that passes the test.
 pick(test:(tx:number,ty:number)=>boolean,ring:[number,number],from:Point={x:this.mid,y:this.mid},tries=60):[number,number]|null{
  for(let k=0;k<tries;k++){const a=this.random()*Math.PI*2,d=ring[0]+this.random()*(ring[1]-ring[0]),tx=Math.floor((from.x+Math.cos(a)*d)/100),ty=Math.floor((from.y+Math.sin(a)*d)/100);
   if(this.inside(tx,ty)&&test(tx,ty))return [tx,ty];}return null;}
 // Neutral resources: count pairs on a ring round the centre, at least clearance from both town centres.
 neutral(kind:'gold'|'rock'|'berries',pairs:number,ring:[number,number],clearance=900,cluster=1){
  for(let i=0;i<pairs;i++){const at=this.pick((x,y)=>this.pairFree(x,y,2)&&this.baseDistance(x,y)>=clearance,ring);if(!at)continue;
   const [tx,ty]=at;for(const [dx,dy] of [[0,0],[1,0],[0,1],[1,1],[-1,0],[0,-1]].slice(0,cluster))if(this.pairFree(tx+dx,ty+dy,2))this.pair(kind,tx+dx,ty+dy);}}
 // Forest clumps grown by a seeded random walk (both mirrored), away from bases; test limits where trees may stand.
 forests(clumps:number,size:[number,number],clearance:number,test:(tx:number,ty:number)=>boolean=()=>true){
  for(let i=0;i<clumps;i++){const at=this.pick((x,y)=>this.pairFree(x,y,1)&&this.baseDistance(x,y)>=clearance&&test(x,y),[0,this.world*.72]);if(!at)continue;let [tx,ty]=at;
   const want=this.int(size[0],size[1]);for(let n=0,k=0;n<want&&k<want*6;k++){if(this.pairFree(tx,ty,1)&&this.baseDistance(tx,ty)>=clearance&&test(tx,ty)){this.pair('tree',tx,ty);n++;}
    const dir=Math.floor(this.random()*4);tx+=dir===0?1:dir===1?-1:0;ty+=dir===2?1:dir===3?-1:0;tx=Math.min(this.size-2,Math.max(1,tx));ty=Math.min(this.size-2,Math.max(1,ty));}}}
 // Trees on the outermost ring of tiles, thinned near bases.
 border(density:number,clearance:number){for(let ty=0;ty<this.size;ty++)for(let tx=0;tx<this.size;tx++){if(tx>0&&ty>0&&tx<this.size-1&&ty<this.size-1)continue;
  const [mx,my]=this.mirrorTile(tx,ty);if(my*this.size+mx<ty*this.size+tx)continue;
  if(this.noise(tx,ty)<density&&this.pairFree(tx,ty,0)&&this.baseDistance(tx,ty)>=clearance)this.pair('tree',tx,ty);}}
 // Wild animals (deer, boar, wolves, jaguars): pairs of flocks on tiles passing the test.
 animals(kind:'hunt'|'boar'|'wolf'|'jaguar',pairs:number,count:number,ring:[number,number],test:(tx:number,ty:number)=>boolean=()=>true,clearance=900){
  for(let i=0;i<pairs;i++){const at=this.pick((x,y)=>this.pairFree(x,y,1)&&this.baseDistance(x,y)>=clearance&&test(x,y),ring);if(at)this.pair(kind,at[0],at[1],undefined,count);}}
 // Water tiles: deep (all eight neighbours water, ships only) or shore (next to land a villager can stand on).
 water(tx:number,ty:number){const t=this.inside(tx,ty)?this.tile(tx,ty):null;return !!t&&t.terrainType==='water';}
 deep(tx:number,ty:number){for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(!this.water(tx+dx,ty+dy))return false;return true;}
 shore(tx:number,ty:number){if(!this.water(tx,ty))return false;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=tx+dx,y=ty+dy;if(this.inside(x,y)&&this.tile(x,y).walkClass==='land'&&this.tile(x,y).height===this.tile(tx,ty).height)return true;}return false;}
 // Fish: pairs on water tiles of the given kind, spacing apart, optionally inside a region.
 fishIn(pairs:number,kind:'deep'|'shore',spacing=300,test:(tx:number,ty:number)=>boolean=()=>true){
  const cands:number[]=[];for(let ty=1;ty<this.size-1;ty++)for(let tx=1;tx<this.size-1;tx++){const [mx,my]=this.mirrorTile(tx,ty);if((mx===tx&&my===ty)||!test(tx,ty))continue;
   if((kind==='deep'?this.deep(tx,ty)&&this.deep(mx,my):this.shore(tx,ty)&&this.shore(mx,my))&&!this.taken.has(ty*this.size+tx))cands.push(ty*this.size+tx);}
  for(let i=cands.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[cands[i],cands[j]]=[cands[j],cands[i]];}
  let placed=0;for(const t of cands){if(placed>=pairs)break;const tx=t%this.size,ty=Math.floor(t/this.size),[mx,my]=this.mirrorTile(tx,ty),m=my*this.size+mx;
   const far=(a:number)=>this.fish.every(f=>Math.hypot((f%this.size-a%this.size)*100,(Math.floor(f/this.size)-Math.floor(a/this.size))*100)>=spacing);
   if(this.taken.has(m)||!far(t)||!far(m))continue;this.fish.push(t,m);this.taken.add(t);this.taken.add(m);placed++;}}
 // A prebuilt building for a player (special starts: walls, towers, houses, farms; packages/sim/buildings.ts
 // initBuildings turns every building obstacle into a finished building of its owner).
 building(kind:ObstacleKind,x:number,y:number,player:number){this.obstacles.push({kind,x,y,...(player?{red:true}:{})});}
 // A prebuilt building for the first player at (x, y) and the same building on the mirrored footprint for the second;
 // the tiles under both are taken.
 pairBuilding(kind:ObstacleKind,x:number,y:number){const f=obstacleBounds({kind,x,y}),a=this.mirrorPoint(f[0],f[1]),c=this.mirrorPoint(f[2],f[3]);
  const spots:[number,number][]=[[x,y],[Math.min(a.x,c.x)+x-f[0],Math.min(a.y,c.y)+y-f[1]]];
  spots.forEach(([px,py],p)=>{this.building(kind,px,py,p);const b=obstacleBounds({kind,x:px,y:py});
   for(let ty=Math.floor(b[1]/100);ty<=Math.floor((b[3]-1)/100);ty++)for(let tx=Math.floor(b[0]/100);tx<=Math.floor((b[2]-1)/100);tx++)if(this.inside(tx,ty))this.taken.add(ty*this.size+tx);});}
 // Everything into MapData: obstacle and resource ids, the fish, blocked nodes, then the flocks on free nodes.
 // Mines out of reach on foot (walled in by trees, a cliff or the shore): the trees round such a pair are cleared, and a
 // pair still out of reach is taken off the map (both mines, so the map stays fair). Reach is measured from the first
 // base's villagers over the land nodes, as a unit walks.
 private reachMines(){const size=this.size,flood=()=>{
   // Provisional ids and tile references, so the path checks use navigation.ts's per-tile obstacle index; finish()
   // assigns the real ones afterwards.
   for(const t of this.tiles)t.obstacleRefs=[];this.obstacles.forEach((o,i)=>{o.id=`obstacle-${i}`;this.tiles[tileAt(o.x,o.y,size)].obstacleRefs.push(o.id);});
   // A walled start is measured as if its walls were gates (the bases' gold and stone outside count as reachable).
   const map={size,tiles:this.tiles,obstacles:this.walled?this.obstacles.filter(o=>!['stone-wall','palisade-wall'].includes(o.kind)):this.obstacles,blocked:[] as number[],starts:this.starts,resources:[],navigationRevision:0,generationAttempt:0} as MapData,side=sideOf(map),total=nodeTotal(map),open=new Uint8Array(total),seen=new Uint8Array(total);
   for(let i=0;i<total;i++)open[i]=clearSegment(map,position(map,i),position(map,i))?1:0;const start=nearest(map,this.starts[0][0]);if(start<0)return {map,seen};const q=[start];seen[start]=1;
   for(let h=0;h<q.length;h++){const id=q[h],x=id%side,y=Math.floor(id/side);for(const n of [x<side-1?id+1:-1,y<side-1?id+side:-1,x>0?id-1:-1,y>0?id-side:-1])if(n>=0&&!seen[n]&&open[n]&&clearSegment(map,position(map,id),position(map,n))){seen[n]=1;q.push(n);}}
   return {map,seen};};
  const mineAt=(t:number)=>this.obstacles.find(o=>(o.kind==='gold'||o.kind==='rock')&&Math.floor(o.y/100)*size+Math.floor(o.x/100)===t);
  const reached=(f:{map:MapData;seen:Uint8Array},t:number)=>{const o=mineAt(t);if(!o)return true;const b=obstacleBounds(o);
   for(let i=0;i<f.seen.length;i++){if(!f.seen[i])continue;const p=position(f.map,i),gap=Math.max(b[0]-p.x,0,p.x-b[2])+Math.max(b[1]-p.y,0,p.y-b[3]);if(gap>0&&gap<=75)return true;}return false;};
  // On a map with the bases on separate landmasses only one mine of a pair can be on the first base's land (the other
  // is its mirror on the second's): one reached is enough.
  const out=(f:{map:MapData;seen:Uint8Array})=>this.mines.filter(([a,b])=>!this.isolated.has(a)&&(this.separate?!reached(f,a)&&!reached(f,b):!reached(f,a)||!reached(f,b)));
  let lost=out(flood());if(!lost.length)return;
  const near=new Set<number>();for(const pair of lost)for(const t of pair)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)near.add(t+dy*size+dx);
  this.obstacles=this.obstacles.filter(o=>o.kind!=='tree'||!near.has(Math.floor(o.y/100)*size+Math.floor(o.x/100)));
  lost=out(flood());const gone=new Set(lost.flat());this.obstacles=this.obstacles.filter(o=>!((o.kind==='gold'||o.kind==='rock')&&gone.has(Math.floor(o.y/100)*size+Math.floor(o.x/100))));this.mines=this.mines.filter(([a])=>!gone.has(a));}
 finish():MapData{
  this.reachMines();for(const t of this.tiles)t.obstacleRefs=[];
  const size=this.size,map:MapData={size,starts:this.starts,...(this.scouts?{scouts:this.scouts}:{}),obstacles:this.obstacles,blocked:[],tiles:this.tiles,resources:[],navigationRevision:0,generationAttempt:0,...(this.separate?{separate:true}:{}),...(this.walled?{walled:true}:{}),...(this.nomad?{nomad:true}:{}),...(this.lean?{lean:[...this.lean]}:{})};
  this.obstacles.forEach((o,index)=>{o.id=`obstacle-${index}`;map.tiles[tileAt(o.x,o.y,size)].obstacleRefs.push(o.id);
   if(!isBuilding(o)){const kind=(o.kind==='rock'?'stone':o.kind) as ResourceKind;const id=`resource-${index}`,capacity=terrainRules.resourceCapacity[kind];map.resources.push({id,kind,x:o.x,y:o.y,capacity,remaining:capacity,collectible:true,status:'available',obstacleId:o.id,depletedAt:null});map.tiles[tileAt(o.x,o.y,size)].resourceRefs.push(id);}});
  for(const t of this.fish){const x=(t%size)*100+50,y=Math.floor(t/size)*100+50,id=`resource-fish-${x}-${y}`,capacity=terrainRules.resourceCapacity.fish;map.resources.push({id,kind:'fish',x,y,capacity,remaining:capacity,collectible:true,status:'available',obstacleId:null,depletedAt:null});map.tiles[t].resourceRefs.push(id);}
  for(let i=0;i<nodeTotal(map);i++)if(!clearSegment(map,position(map,i),position(map,i)))map.blocked.push(i);
  // Flocks come in mirrored pairs (pair() adds a spot and then its mirror): the first is placed on the free nodes
  // nearest its spot, the second on exactly the mirrored nodes when those are free (else as near its own spot as it
  // can), so a flock squeezed off its spot does not end up nearer the other base than its twin.
  map.animals=[];const closed=blockedTable(map);
  for(let i=0;i<this.spots.length;i++){const s=this.spots[i],before=map.animals.length;flock(map,s.kind,s.x,s.y,s.count,s.within,s.owner,s.open);
   const twin=this.spots[i+1],m=this.mirrorPoint(s.x,s.y);if(!twin||twin.kind!==s.kind||twin.count!==s.count||twin.x!==m.x||twin.y!==m.y)continue;
   const held=new Set([...map.starts.flat(),...(map.scouts??[]),...map.animals].map(p=>nodeAt(map,p))),mirrored=map.animals.slice(before).map(a=>({kind:a.kind,...this.mirrorPoint(a.x,a.y),...(twin.owner===undefined?{}:{owner:twin.owner})}));
   if(mirrored.length&&mirrored.every(a=>{const n=nodeAt(map,a);return n>=0&&!closed[n]&&!held.has(n);})){map.animals.push(...mirrored);i++;}}
  return map;}
}
