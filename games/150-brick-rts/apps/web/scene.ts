import {buildingStuds,studStyle} from './building-studs.ts';
import {createArchGeometry} from './brick-geometries.ts';
import {militaryBuildingParts,militaryBuildings} from './military-building.ts';
import type {MilitaryBuilding} from './military-building.ts';
import {monasteryParts} from './monastery-building.ts';
import {blacksmithParts} from './blacksmith-building.ts';
import {towerParts,siegeWorkshopParts,towerGradeOf,towerLift} from './defense-building.ts';
import type {TowerGrade} from './defense-building.ts';
import {universityParts} from './university-building.ts';
import {castleParts} from './castle-building.ts';
import {createSiegeRig} from './siege-rig.ts';
import {createVesselRig,vesselFrames} from './vessel-rig.ts';
import type {VesselRig} from './vessel-rig.ts';
import {wallParts,gateParts,outpostParts,bombardTowerParts,wallFamily,noLinks} from './fortification-building.ts';
import type {WallLinks,WallKind,GateKind} from './fortification-building.ts';
import {dockParts,fishTrapParts} from './harbor-building.ts';
import {wonderParts} from './wonder-building.ts';
import type {SiegeRig} from './siege-rig.ts';
import {relicParts} from './relic-model.ts';
import {techIcons} from './tech-icons.ts';
import {createCharacterRig,isMounted,mounts} from './character-rig.ts';
import {createAnimalRig,carcassParts} from './animal-rig.ts';
import type {AnimalLook} from './animal-rig.ts';
import {isAnimal,animalRules} from '../../packages/sim/fauna.ts';
import {roleOf,poseFor,corpseRole,isSiege,siegeKinds,isVessel,vesselKinds,lookOf,upgradeLooks} from './rig-roles.ts';
import {visibleMeshHits} from './picking.ts';
import {createDetailController,detailLevel} from './lod.ts';
import {economicBuildingParts,economicBuildings} from './economic-building.ts';
import type {EconomicBuilding} from './economic-building.ts';
import {buildingParts,regionalParts,architectures} from './building-parts.ts';
import type {BuildingVisual,Architecture} from './building-parts.ts';
import {civById} from '../../packages/content/civs.ts';
import {createUnitRig,unitPoses,unitTools,unitRoles,roleTools} from './unit-rig.ts';
import type {UnitPose,UnitTool} from './unit-rig.ts';
import type {MapLayout} from '../../packages/sim/terrain.ts';
import {createTiles,tileAt,groundHeight,sizeOfTiles} from '../../packages/sim/terrain.ts';
import {makeMap} from '../../packages/sim/navigation.ts';
import {walkablePlatforms,obstacleBounds} from '../../packages/content/footprints.ts';
import type {View} from '../../packages/sim/protocol.ts';
import type {BuildKind} from '../../packages/sim/buildings.ts';
// What each soldier holds: the skirmisher throws javelins (a spear), the knight fights with a sword; a unique unit holds
// the weapon its dress arrives with (a mounted one, its rider's).
export const weaponOf=(kind:string):UnitTool=>kind==='militia'||kind==='knight'?'sword':kind==='archer'?'bow':kind==='scout'||kind==='spearman'||kind==='skirmisher'?'spear':kind==='monk'?'staff':uniqueWeapon(kind);
const uniqueWeapon=(kind:string):UnitTool=>{const role=roleOf(kind);return isMounted(role)?mounts[role].tool:role==='villager'?'none':roleTools[role];};
// Unique units with HUD portraits (the unit kinds appended in packages/sim/movement.ts), then the 單位 round's kinds
// that wear a dress (the siege engines are shot with their own rigs).
const iconUniques=['longbowman','woad-raider','throwing-axeman','huskarl','teutonic-knight','berserk','cataphract','war-elephant','mameluke','janissary','chu-ko-nu','samurai','mangudai','cavalry-archer','camel','petard','hand-cannoneer'] as const;
// Health bar height and selection ring size by body: horses raise the rider, the war elephant carries a howdah, the
// camel rider sits on the hump; siege engines by their frame (a standing trebuchet is far taller than a packed one).
const frameOfRole=(role:string)=>role==='war-elephant'?{bar:3.05,ring:2.4}:role==='camel'?{bar:2.95,ring:2}:isMounted(role)?{bar:2.3,ring:1.8}:{bar:1.42,ring:1};
const siegeFrames:Record<string,{bar:number;ring:number}>={ram:{bar:1.35,ring:1.6},mangonel:{bar:1.45,ring:1.8},scorpion:{bar:1.2,ring:1.5},trebuchet:{bar:1.3,ring:2.3},'bombard-cannon':{bar:1.3,ring:1.7}};
export const unitFrame=(kind:string,unpacked=false)=>kind==='trebuchet'&&unpacked?{bar:2.9,ring:2.4}:siegeFrames[kind]??vesselFrames[kind]??frameOfRole(roleOf(kind));
// The two-handed swordsman and the champion (own units) take up the great sword and drop the shield.
const gradedWeapon=(kind:string,look:string|null):UnitTool=>look==='two-handed-swordsman'||look==='champion'?'great-sword':weaponOf(kind);
// Regional architecture group of a player's civilization (neutral when unknown: the settlers or an old save).
export const architectureOf=(civs:readonly string[]|undefined,player:number):Architecture=>civById(civs?.[player]??'')?.architecture??'neutral';
// Every obstacle kind drawn as a building (the 建築 round adds the market, the dock and fish trap, walls and gates, the
// outpost, the bombard tower and the wonder; the town centre is buildable too).
export const drawnBuildings=['house','town-center','barracks','lumber-camp','mining-camp','mill','stable','archery-range','monastery','blacksmith','watch-tower','siege-workshop','castle','university','market','dock','fish-trap','outpost','bombard-tower','wonder','palisade-wall','stone-wall','palisade-gate','gate'] as const;
export type DrawnBuilding=typeof drawnBuildings[number];
export const brickStyle={studPitch:.5,plateHeight:.16,brickHeight:.32,bevel:.025,roughness:.62,provenance:'original_procedural'} as const;
// Farm: a 2x2 soil plate with crop rows (walkable in the sim). Foundations show bare soil and a corner stake.
export function farmParts(progress:number,red?:boolean){const out:{x:number;y:number;z:number;w:number;d:number;h:number;color:string;studs:boolean}[]=[{x:0,y:0,z:0,w:2,d:2,h:.1,color:'#806b49',studs:false}];
 if(progress<100){out.push({x:.05,y:.1,z:.05,w:.08,d:.08,h:.4,color:red?'#b85c47':'#456e87',studs:false});return out;}
 for(const z of [.2,.7,1.2,1.7])out.push({x:.15,y:.1,z:z-.1,w:1.7,d:.2,h:.12,color:'#9bb65a',studs:true});
 out.push({x:.05,y:.1,z:.05,w:.08,d:.08,h:.4,color:red?'#b85c47':'#456e87',studs:false});return out;}
export async function createScene(canvas:HTMLCanvasElement,onFailure:(message:string)=>void,options:{assetPreview?:boolean}={}){
 // Resolved relative to the shipped web/assets/150-brick-rts/main.js bundle.
 const T=await import(new URL('../../../vendor/three-0.186.0/three.module.js',import.meta.url).href);
 if(!canvas.getContext('webgl2'))throw Error('此裝置無法建立 WebGL2，請使用支援 WebGL2 的瀏覽器。');
 let contextLost=false,previewLayout:MapLayout='meadow';
 const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
 renderer.setClearColor('#d7e0cc');renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
 const detail=createDetailController(T);
 const scene=new T.Scene();const camera=new T.OrthographicCamera(-12,12,10,-10,.1,100);
 const ambient=new T.HemisphereLight('#fff5dc','#819b75',2.1);scene.add(ambient);
 const sun=new T.DirectionalLight('#fff1d8',3);sun.position.set(-4,20,12);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:1,far:60});sun.shadow.normalBias=.03;sun.shadow.radius=2.2;scene.add(sun);sun.target.position.set(8,0,8);scene.add(sun.target);
 // The board rests on a table: a shadow-only plane just under the slab bottom takes the board's contact shadow
 // along its far edges, so the map sits on something instead of floating in the backdrop. Not in staticGroup: picking ignores it.
 const table=new T.Mesh(new T.PlaneGeometry(400,400),new T.ShadowMaterial({opacity:.24}));table.rotation.x=-Math.PI/2;table.position.y=-.25;table.receiveShadow=true;scene.add(table);
 const groundGeometries=new Set<any>();const geometry=new Map<string,any>(),materials=new Map<string,any>();
 function material(color:string){if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:brickStyle.roughness}));return materials.get(color);}
 function box(w:number,h:number,d:number){const key=`${w}:${h}:${d}`;if(geometry.has(key))return geometry.get(key);
 const b=Math.min(brickStyle.bevel,w/8,h/8,d/8);const shape=new T.Shape();shape.moveTo(-w/2+b,-d/2+b);shape.lineTo(w/2-b,-d/2+b);shape.lineTo(w/2-b,d/2-b);shape.lineTo(-w/2+b,d/2-b);shape.closePath();
 const geo=new T.ExtrudeGeometry(shape,{depth:Math.max(.001,h-2*b),bevelEnabled:true,bevelSize:b,bevelThickness:b,bevelSegments:1,steps:1,curveSegments:1});geo.rotateX(-Math.PI/2);geo.translate(0,b,0);geometry.set(key,geo);detail.register(geo,w,h,d);return geo;}
 const studGeo=new T.CylinderGeometry(studStyle.radius,studStyle.radius,studStyle.height,10);geometry.set('stud',studGeo);
 let staticGroup=new T.Group();scene.add(staticGroup);const batches=new Map<string,{geo:any;color:string;matrices:any[]}>();
 let muted=false,baseHeight=0,worldTiles=createTiles();
 // Visual only: a unit whose body overlaps a walkable plinth stands on it (radius 25 matches navigation).
 let platforms:{x0:number;y0:number;x1:number;y1:number;height:number}[]=[];
 function standingLift(x:number,y:number){let lift=0;for(const p of platforms)if(x>=p.x0-25&&x<=p.x1+25&&y>=p.y0-25&&y<=p.y1+25)lift=Math.max(lift,p.height);return lift;}
 // Static parts are batched per geometry, colour and 8x8-tile chunk, so chunks outside the view are culled
 // (one map-wide batch would be drawn in full every frame, which doubled the frame time on the 32-tile map).
 function staticPart(geo:any,color:string,x:number,y:number,z:number){if(muted)color='#737b72';const key=geo.uuid+color+'@'+Math.floor(x/8)+','+Math.floor(z/8);if(!batches.has(key))batches.set(key,{geo,color,matrices:[]});batches.get(key)!.matrices.push(new T.Matrix4().makeTranslation(x,y+baseHeight,z));}
 function arch(w:number,h:number,d:number){const key=`arch:${w}:${h}:${d}`;if(!geometry.has(key))geometry.set(key,createArchGeometry(T,w,h,d));return geometry.get(key);}
 function brick(x:number,z:number,y:number,w:number,d:number,h:number,color:string,studs=true,shape?:'arch'){staticPart(shape==='arch'?arch(w-.018,h,d-.018):box(w-.018,h,d-.018),color,x+w/2,y,z+d/2);if(studs)for(let a=.25;a<w;a+=.5)for(let b=.25;b<d;b+=.5)staticPart(studGeo,color,x+a,y+h+.04,z+b);}
 function groundBlock(x:number,z:number,height:number,color:string){const h=height+.24,key=`ground:${h}`;if(!geometry.has(key)){
  // Ground tiles are baseplate sections: a slight chamfer on the top edge leaves a fine seam between neighbours, so the
  // board reads as joined plates instead of one printed sheet. Own cache key: never shared with building parts (picking).
  const b=.03,shape=new T.Shape();shape.moveTo(-.5+b,-.5+b);shape.lineTo(.5-b,-.5+b);shape.lineTo(.5-b,.5-b);shape.lineTo(-.5+b,.5-b);shape.closePath();
  const geo=new T.ExtrudeGeometry(shape,{depth:h-2*b,bevelEnabled:true,bevelSize:b,bevelThickness:b,bevelSegments:1,steps:1,curveSegments:1});geo.rotateX(-Math.PI/2);geo.translate(0,b,0);geometry.set(key,geo);groundGeometries.add(geo);}staticPart(geometry.get(key),color,x+.5,-.24,z+.5);}
 let previewBuildingKind:DrawnBuilding|EconomicBuilding|MilitaryBuilding='house',previewStyle:Architecture='neutral';
 let previewBuilding:Omit<BuildingVisual,'red'>={ageVariant:2,progress:100,health:100};
 // Own watch towers show the University's tower upgrade researched (the enemy's research is not projected).
 const ownTower=(view:View):TowerGrade|null=>options.assetPreview?null:towerGradeOf(view.economy?.techs??[]);
 // The model page swaps in the inspected kind and style; the sandbox draws each obstacle as itself in its owner's regional style.
 // links: a wall's or gate's same-material neighbours; land: the dock's quarter turns toward the shore.
 function house(x:number,z:number,red=false,obstacleKind:DrawnBuilding='house',progress=100,age=2,health=100,style:Architecture='neutral',tower:TowerGrade|null=null,links:WallLinks=noLinks,land=0){const kind=options.assetPreview?previewBuildingKind:obstacleKind,visual=options.assetPreview?previewBuilding:{...previewBuilding,progress,health,ageVariant:Math.min(4,Math.max(1,age)) as 1|2|3|4};
 // The model page shows a wall or gate as part of a straight east-west run.
 const joined=options.assetPreview?{...noLinks,e:true,w:true}:links,styleOf=options.assetPreview?previewStyle:style;
 const parts=kind==='wonder'?wonderParts({...visual,red},styleOf):regionalParts(kind==='house'?buildingParts({...visual,red}):kind==='palisade-wall'||kind==='stone-wall'?wallParts(kind as WallKind,{...visual,red},joined):kind==='palisade-gate'||kind==='gate'?gateParts(kind as GateKind,{...visual,red},joined):kind==='outpost'?outpostParts({...visual,red}):kind==='bombard-tower'?bombardTowerParts({...visual,red}):kind==='dock'?dockParts({...visual,red},options.assetPreview?0:land):kind==='fish-trap'?fishTrapParts({...visual,red}):kind==='monastery'?monasteryParts({...visual,red}):kind==='blacksmith'?blacksmithParts({...visual,red}):kind==='watch-tower'?towerParts({...visual,red},tower):kind==='university'?universityParts({...visual,red}):kind==='siege-workshop'?siegeWorkshopParts({...visual,red}):kind==='castle'?castleParts({...visual,red}):militaryBuildings.includes(kind as MilitaryBuilding)?militaryBuildingParts(kind as MilitaryBuilding,{...visual,red}):economicBuildingParts(kind as EconomicBuilding,{...visual,red}),kind==='farm'?'neutral':styleOf);
 for(const p of parts)brick(x+p.x,z+p.z,p.y,p.w,p.d,p.h,p.color,false,p.shape);
 for(const stud of buildingStuds(parts))staticPart(studGeo,stud.color,x+stud.x,stud.y,z+stud.z);}
 // A water tile whose four neighbours are water too: the open lake, drawn a shade deeper than its shore.
 const deepWater=(tiles:{terrainType:string}[],id:number)=>{const n=sizeOfTiles(tiles as any),x=id%n,z=Math.floor(id/n);return [[1,0],[-1,0],[0,1],[0,-1]].every(([dx,dz])=>{const tx=x+dx,tz=z+dz;return tx>=0&&tz>=0&&tx<n&&tz<n&&tiles[tz*n+tx].terrainType==='water';});};
 function buildWorld(view:View){const seed=view.seed;scene.remove(staticGroup);staticGroup.traverse((o:any)=>{if(o.isInstancedMesh)o.dispose();});staticGroup=new T.Group();scene.add(staticGroup);batches.clear();baseHeight=0;
 const map=options.assetPreview?makeMap(seed,previewLayout):{tiles:view.terrain.map((tile,id)=>({...tile,id,resourceRefs:[],obstacleRefs:[]})),obstacles:view.known.map(k=>k.obstacle),resources:view.resources};worldTiles=map.tiles;board=sizeOfTiles(map.tiles);platforms=map.obstacles.flatMap(o=>{const p=walkablePlatforms[o.kind];return p?[{x0:o.x+p.rect[0],y0:o.y+p.rect[1],x1:o.x+p.rect[2],y1:o.y+p.rect[3],height:p.height}]:[];});let rng=seed||1;for(const tile of map.tiles){const x=tile.id%board,z=Math.floor(tile.id/board);rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;const n=(rng>>>0)/4294967296;groundBlock(x,z,tile.height/100,!options.assetPreview&&view.fog[tile.id]!==2?(view.fog[tile.id]===1?'#626e64':'#293e38'):tile.terrainType==='cliff'?'#8a8065':tile.terrainType==='stone'?'#a1a28e':tile.terrainType==='highland'?'#879d69':tile.terrainType==='water'?(deepWater(map.tiles,tile.id)?'#41768a':'#4b8291'):tile.terrainType==='shallow'?'#86b7b8':tile.terrainType==='sand'?'#d5c598':tile.terrainType==='road'?'#c4b18a':n<.2?'#a6b582':n<.5?'#b5c493':'#becda0');}
 // Open water: a few lighter ripple plates on the tiles in view (hashed per tile, so they stay put across rebuilds).
 for(const tile of map.tiles)if(tile.terrainType==='water'&&(options.assetPreview||view.fog[tile.id]===2)){const tx=tile.id%board,tz=Math.floor(tile.id/board);let v=Math.imul(tx+1,73856093)^Math.imul(tz+1,19349663);v=Math.imul(v^v>>>16,0x45d9f3b);v=(v^v>>>16)>>>0;
  if(v%3===0)brick(tx+.12+(v>>3&3)*.1,tz+.2+(v>>5&3)*.15,tile.height/100,.42,.06,.02,'#6fa2ae',false);if(v%5===1)brick(tx+.5-(v>>7&1)*.3,tz+.62,tile.height/100,.28,.05,.02,'#6fa2ae',false);}
 // Walls and gates join their same-material neighbours: tile -> material family of the fortification standing there.
 const fortAt=new Map<string,string>();for(const o of map.obstacles){const f=wallFamily(o.kind);if(f)fortAt.set(`${Math.floor(o.x/100)},${Math.floor(o.y/100)}`,`${f}:${o.red?1:0}`);}
 const linksOf=(o:{kind:string;x:number;y:number;red?:boolean}):WallLinks=>{const tx=Math.floor(o.x/100),tz=Math.floor(o.y/100),me=fortAt.get(`${tx},${tz}`),at=(dx:number,dz:number)=>fortAt.get(`${tx+dx},${tz+dz}`)===me;
  return {n:at(0,-1),s:at(0,1),e:at(1,0),w:at(-1,0),ne:at(1,-1),nw:at(-1,-1),se:at(1,1),sw:at(-1,1)};};
 // The dock turns its shed toward the side with the most land along its edge (ties: north, east, south, west).
 const landOf=(o:{x:number;y:number}):number=>{const tx=Math.floor(o.x/100),tz=Math.floor(o.y/100),dry=(x:number,z:number)=>{if(x<0||z<0||x>=board||z>=board)return 0;const t=map.tiles[z*board+x];return t.terrainType==='water'||t.terrainType==='shallow'?0:1;};
  const sides=[0,1,2].map(i=>[dry(tx+i,tz-1),dry(tx+3,tz+i),dry(tx+i,tz+3),dry(tx-1,tz+i)]).reduce((a,b)=>a.map((v,i)=>v+b[i]),[0,0,0,0]);return sides.indexOf(Math.max(...sides));};
 for(const o of map.obstacles){baseHeight=groundHeight(map.tiles,o.x,o.y)/100;muted=!options.assetPreview&&view.fog[tileAt(o.x,o.y,sizeOfTiles(map.tiles))]!==2;const x=o.x/100,z=o.y/100;if(o.kind==='farm')for(const p of farmParts(o.progress??100,o.red))brick(x+p.x,z+p.z,p.y,p.w,p.d,p.h,p.color,p.studs);
 else if((drawnBuildings as readonly string[]).includes(o.kind))house(x,z,o.red,o.kind as DrawnBuilding,o.progress??100,o.age??2,o.damaged?35:100,options.assetPreview?'neutral':architectureOf(view.civs,o.red?1:0),o.kind==='watch-tower'&&!o.red?ownTower(view):null,wallFamily(o.kind)?linksOf(o):noLinks,o.kind==='dock'?landOf(o):0);else if(o.kind==='tree'){
  // A grove is not one tree repeated: the tile position picks trunk height, crown tiers and leaf shade (same brick sizes, same footprint).
  // Hashed from the position, so a tree keeps its shape when fog or known objects rebuild the world.
  let v=Math.imul(o.x|0,73856093)^Math.imul(o.y|0,19349663);v=Math.imul(v^v>>>16,0x45d9f3b);v=(v^v>>>16)>>>0;const lift=[0,.16,-.12,.08][v&3],leaf=(v>>2)&1?'#5d824e':'#67835a';
  brick(x+.15,z+.15,0,.3,.3,.8+lift,'#80664b',false);brick(x-.2,z-.2,.7+lift,1,1,.4,leaf);brick(x-.075,z-.075,1.1+lift,.75,.75,.4,'#7e985f');
  if((v&3)!==2)brick(x+.05,z+.05,1.5+lift,.5,.5,.3,'#91a970');if((v>>3)%3===0)brick(x+.175,z+.175,(v&3)===2?1.5+lift:1.8+lift,.25,.25,.2,'#91a970',false);}else if(o.kind==='hunt'||o.kind==='livestock'){const color=o.kind==='hunt'?'#99714e':'#e7e2cc';for(const dx of [.1,.45])for(const dz of [.1,.5])brick(x+dx,z+dz,0,.09,.09,.28,'#615643',false);brick(x+.04,z+.06,.25,.54,.55,.35,color,false);brick(x+.16,z+.48,.47,.28,.2,.26,color,false);if(o.kind==='hunt')for(const dx of [.18,.36])brick(x+dx,z+.51,.73,.04,.04,.2,'#715a40',false);}else if(o.kind==='berries'){brick(x+.05,z+.05,0,.55,.55,.45,'#5d824e');for(const dx of [.12,.36])for(const dz of [.12,.36])brick(x+dx,z+dz,.45,.12,.12,.12,'#a84e59',false);}else{brick(x,z,0,.65,.7,.3,o.kind==='gold'?'#b59a48':'#a19f86');brick(x+.15,z+.15,.3,.35,.4,.18,o.kind==='gold'?'#dec36f':'#b8b39c',false);}}
 // Carcasses: the animal lying on its side, shrinking as it is eaten (which animal: by the food it started with).
 for(const resource of map.resources??[])if((resource.kind==='hunt'||resource.kind==='livestock')&&!resource.obstacleId&&resource.status==='available'){const kind=(Object.keys(animalRules.food) as AnimalLook[]).find(k=>animalRules.food[k]===resource.capacity)??'sheep';baseHeight=groundHeight(map.tiles,resource.x,resource.y)/100;muted=false;for(const p of carcassParts(kind,resource.remaining/resource.capacity))brick(resource.x/100+p.x,resource.y/100+p.z,p.y,p.w,p.d,p.h,p.color,false);}
 // Fish: a school in the water, thinning as it is fished (two to five fish), each a body and a tail fin; schools face
 // alternate ways and sit at offsets hashed from the spot, so neighbouring schools do not look stamped.
 for(const resource of map.resources??[])if(resource.kind==='fish'&&resource.status==='available'){const x=resource.x/100,z=resource.y/100;baseHeight=groundHeight(map.tiles,resource.x,resource.y)/100;muted=false;
  let v=Math.imul(resource.x|0,73856093)^Math.imul(resource.y|0,19349663);v=Math.imul(v^v>>>16,0x45d9f3b);v=(v^v>>>16)>>>0;const n=2+Math.round(3*Math.max(0,Math.min(1,resource.remaining/Math.max(1,resource.capacity))));
  for(let i=0;i<n;i++){const ox=[-.26,.06,-.08,.18,-.3][i]+((v>>i)&1)*.04,oz=[-.12,.1,-.3,-.22,.16][i],left=((v>>(i+3))&1)===1;
   brick(x+ox,z+oz,.025,.24,.09,.05,i%2?'#c6dcd6':'#d5e7de',false);brick(left?x+ox+.24:x+ox-.08,z+oz-.02,.025,.08,.13,.06,'#a9c2c0',false);}}
 baseHeight=0;muted=false;for(const {geo,color,matrices} of batches.values()){const mesh=new T.InstancedMesh(geo,material(color),matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.userData.studs=geo===studGeo;mesh.userData.ground=groundGeometries.has(geo);mesh.castShadow=true;mesh.receiveShadow=true;staticGroup.add(mesh);}
 }
 // goal: the latest simulated position; the drawn position eases toward it every frame (sim runs at 20 Hz, screens faster).
 // look: the line-upgrade look shown (own units); unpacked: a trebuchet's state; rigs: the model viewer's rigs by family.
 type AnyRig=ReturnType<typeof createCharacterRig>|ReturnType<typeof createAnimalRig>|SiegeRig|VesselRig;
 const units=new Map<number,{group:any;rig:AnyRig;ring:any;player:number;moving:boolean;activity:string;tool:string;poseStart:number;bar:any;fill:any;goal:any;kind:string;relic:any;look:string|null;unpacked:boolean;rigs?:Map<string,AnyRig>}>();
 // Relics: small dynamic groups, on the ground where the player saw them or on a carrying monk's back.
 function relic(){const g=new T.Group();g.name='relic';for(const p of relicParts){const m=new T.Mesh(box(p.w,p.h,p.d),material(p.color));m.position.set(p.x+p.w/2,p.y,p.z+p.d/2);m.castShadow=true;g.add(m);}return g;}
 const relics=new Map<number,any>();
 const arrows=new Map<string,any>(),arrowGeo=new T.BoxGeometry(.04,.04,1),arrowMaterial=new T.MeshBasicMaterial({color:'#4a3b2a'});
 // Shots in flight (the 戰術技巧 round): one pooled mesh per projectile, by shape, gliding between snapshots along an
 // arc from where it left to where it will land; a puff where it comes down (and at a gun's mouth when it fires).
 type Flight={mesh:any;shape:string;from:{x:number;y:number};to:{x:number;y:number};goal:{x:number;y:number};at:{x:number;y:number};lift:number;fan:number};
 const shapeOf=(kind:string)=>kind==='mangonel'||kind==='trebuchet'?'stone':kind==='bombard-cannon'||kind==='cannon-galleon'||kind==='bombard-tower'?'ball':kind==='hand-cannoneer'||kind==='janissary'?'shot':kind==='scorpion'?'bolt':kind==='throwing-axeman'?'axe':kind==='mameluke'?'javelin':kind==='fire-galley'?'fire':'arrow';
 // arc: the peak above the straight line, in tiles; long: the mesh points along its flight (darts) or tumbles (stones, balls).
 const shapes:Record<string,{geo:any;mat:any;arc:number;long:boolean;puff:number}>={
  arrow:{geo:new T.BoxGeometry(.055,.055,.42),mat:material('#4d3a26'),arc:.45,long:true,puff:.18},
  bolt:{geo:new T.BoxGeometry(.06,.06,.56),mat:material('#4a3b2a'),arc:.2,long:true,puff:.22},
  javelin:{geo:new T.BoxGeometry(.04,.04,.5),mat:material('#7a5c40'),arc:.5,long:true,puff:.18},
  axe:{geo:new T.BoxGeometry(.16,.05,.14),mat:material('#8f969a'),arc:.4,long:false,puff:.18},
  stone:{geo:new T.BoxGeometry(.2,.18,.2),mat:material('#9d9583'),arc:1.8,long:false,puff:.55},
  ball:{geo:new T.SphereGeometry(.09,10,8),mat:material('#2b2a28'),arc:.7,long:false,puff:.45},
  shot:{geo:new T.SphereGeometry(.035,6,5),mat:material('#2b2a28'),arc:.1,long:false,puff:.14},
  fire:{geo:new T.BoxGeometry(.16,.14,.3),mat:new T.MeshBasicMaterial({color:'#f0883e',transparent:true,opacity:.85,depthWrite:false}),arc:.15,long:true,puff:0},
 };
 // Where a shot leaves: a unit's chest, a ship's deck, a building's roof or loopholes.
 const launchLift:Record<string,number>={'town-center':2,'watch-tower':2.6,castle:3.4,'bombard-tower':2.1,trebuchet:1.4,mangonel:.7};
 const flights=new Map<number,Flight>(),flightPool=new Map<string,any[]>();
 const puffGeo=new T.SphereGeometry(.5,8,6),puffs:{mesh:any;start:number;size:number}[]=[],puffPool:any[]=[];
 function puff(x:number,y:number,size:number,color:string){if(size<=0)return;const m=puffPool.pop()??new T.Mesh(puffGeo,new T.MeshBasicMaterial({transparent:true,depthWrite:false}));m.material.color.set(color);m.material.opacity=.55;
  m.position.set(x/100,groundHeight(worldTiles,x,y)/100+.08,y/100);m.scale.setScalar(size*.3);scene.add(m);puffs.push({mesh:m,start:0,size});}
 function land(f:Flight){scene.remove(f.mesh);(flightPool.get(f.shape)??flightPool.set(f.shape,[]).get(f.shape)!).push(f.mesh);puff(f.to.x,f.to.y,shapes[f.shape].puff,'#cdbf9f');}
 const flightPoint=new T.Vector3(),flightAhead=new T.Vector3();
 // Height on the arc at ground position (x, y): straight from launch to the ground, plus a parabola over the flight.
 function flightHeight(f:Flight,x:number,y:number){const total=Math.hypot(f.to.x-f.from.x,f.to.y-f.from.y)||1,t=Math.min(1,Math.max(0,Math.hypot(x-f.from.x,y-f.from.y)/total));
  const start=groundHeight(worldTiles,f.from.x,f.from.y)/100+f.lift,end=groundHeight(worldTiles,f.to.x,f.to.y)/100+.15;return start+(end-start)*t+shapes[f.shape].arc*Math.min(1,total/400)*4*t*(1-t);}
 // fan: a few units sideways to the line of flight (by shot id), so the arrows of one volley read as several.
 function placeFlight(f:Flight,time:number){const ldx=f.to.x-f.from.x,ldy=f.to.y-f.from.y,ll=Math.hypot(ldx,ldy)||1;flightPoint.set((f.at.x-ldy/ll*f.fan)/100,flightHeight(f,f.at.x,f.at.y),(f.at.y+ldx/ll*f.fan)/100);f.mesh.position.copy(flightPoint);
  if(shapes[f.shape].long){const dx=f.to.x-f.from.x,dy=f.to.y-f.from.y,len=Math.hypot(dx,dy)||1,ax=f.at.x+dx/len*12,ay=f.at.y+dy/len*12;flightAhead.set((ax-ldy/ll*f.fan)/100,flightHeight(f,ax,ay),(ay+ldx/ll*f.fan)/100);f.mesh.lookAt(flightAhead);}
  else{f.mesh.rotation.x=time/90;f.mesh.rotation.z=time/130;}}
 // Fallen units: short-lived rigs in the death pose, keyed by unit id (sim corpses, visual only).
 const fallen=new Map<number,{group:any;rig:ReturnType<typeof createCharacterRig>|SiegeRig|VesselRig;start:number}>();
 const barBack=new T.MeshBasicMaterial({color:'#2d3a33'}),barGeo=new T.BoxGeometry(.5,.05,.05);
 const ringGeo=new T.RingGeometry(.4,.47,32);ringGeo.rotateX(-Math.PI/2);geometry.set('ring',ringGeo);const ringMaterial=new T.MeshBasicMaterial({color:'#fff2a1',side:T.DoubleSide});
 function unit(id:number,player:number,kind='villager'){const group=new T.Group();scene.add(group);
 // Animals: their own brick rig, a lower health bar, a neutral bar colour while wild.
 const beast=isAnimal(kind),frame=unitFrame(kind),bar=new T.Group();bar.position.y=beast?(kind==='deer'?1.3:.95):frame.bar;bar.visible=false;const back=new T.Mesh(barGeo,barBack);const fill=new T.Mesh(barGeo,new T.MeshBasicMaterial({color:player===0?'#5f9a6a':player===1?'#c0604c':'#c9b27a'}));fill.position.z=.012;bar.add(back,fill);group.add(bar);
 const rig=beast?createAnimalRig(T,kind as AnimalLook,player,box,material):isSiege(kind)?createSiegeRig(T,kind,player,box,material):isVessel(kind)?createVesselRig(T,kind,player,box,material):createCharacterRig(T,player,box,material);if(!beast&&!isSiege(kind)&&!isVessel(kind)){if(!options.assetPreview&&kind!=='villager')rig.dress(roleOf(kind) as any);rig.equip(previewTool);}group.add(rig.root);detail.apply(group,zoom);
 const ring=new T.Mesh(ringGeo,ringMaterial);ring.position.y=.025;if(!beast)ring.scale.set(frame.ring,1,frame.ring);group.add(ring);units.set(id,{group,rig,ring,player,moving:false,activity:'idle',tool:'none',poseStart:0,bar,fill,goal:null,kind,relic:null as any,look:null,unpacked:false});return units.get(id)!;
 }
 let previewRole='villager';
 // Model viewer: a siege preview id ('trebuchet-packed'/'trebuchet-unpacked' pick the trebuchet's state) or null.
 const previewSiege=(role:string)=>role==='trebuchet-packed'||role==='trebuchet-unpacked'?'trebuchet':isSiege(role)||isVessel(role)?role:null;
 // The viewer swaps a unit between the character rig and a siege rig; each is built once and kept (hidden) in the group,
 // so returning to a character shows exactly the rig it left.
 function previewRig(u:{group:any;rig:AnyRig;player:number;rigs?:Map<string,AnyRig>},family:string){u.rigs??=new Map([['character',u.rig]]);let rig=u.rigs.get(family);
  if(!rig){rig=family==='character'?createCharacterRig(T,u.player,box,material):isVessel(family)?createVesselRig(T,family,u.player,box,material):createSiegeRig(T,family,u.player,box,material);u.group.add(rig.root);u.rigs.set(family,rig);}
  for(const r of u.rigs.values())r.root.visible=r===rig;u.rig=rig;return rig;}
 let previewPose:UnitPose='idle',previewTool:UnitTool='none',previewAnimated=false,poseStart=0;const focus={x:8,y:0,z:8};let worldKey='',angle=Math.PI/4,zoom=1,width=0,height=0,selected=new Set<number>([1]),latest:View|null=null;
 // board: tiles per side of the current map (16 on the test grounds, 32 on the match map); set in buildWorld.
 let board=16;const minZoom=()=>Math.min(.7,.7*16/board);
 function cameraUpdate(){if(width<=0||height<=0)return;const aspect=width/Math.max(1,height);const halfH=Math.max(10.5,12/aspect)/zoom;
 // The sun and its shadow box follow the view (same offset as the original fixed light at the board centre).
 sun.target.position.set(focus.x,0,focus.z);sun.position.set(focus.x-12,20,focus.z+4);const reach=Math.max(14,halfH*aspect*1.1);Object.assign(sun.shadow.camera,{left:-reach,right:reach,top:reach,bottom:-reach});sun.shadow.camera.updateProjectionMatrix();camera.left=-halfH*aspect;camera.right=halfH*aspect;camera.top=halfH;camera.bottom=-halfH;camera.position.set(focus.x+Math.sin(angle)*24,focus.y+24,focus.z+Math.cos(angle)*24);camera.lookAt(focus.x,focus.y,focus.z);camera.updateProjectionMatrix();camera.updateMatrixWorld();detail.apply(scene,zoom);
 // Read by browser flows to aim the pointer at world points: focus x, focus z, half view height, heading.
 canvas.dataset.camera=`${focus.x.toFixed(4)},${focus.z.toFixed(4)},${halfH.toFixed(4)},${angle.toFixed(4)}`;}
 function resize(){const r=canvas.getBoundingClientRect();if(r.width!==width||r.height!==height){width=r.width;height=r.height;renderer.setSize(width,height,false);cameraUpdate();}}
 function update(view:View,ids:number|Iterable<number>){latest=view;selected=new Set(typeof ids==='number'?[ids]:ids);const key=JSON.stringify([previewBuildingKind,previewBuilding,previewStyle,previewLayout,view.layout,view.seed,view.civs,view.fog,view.known?.map(k=>k.obstacle),view.resources,ownTower(view)]);if(worldKey!==key){worldKey=key;const t=performance.now();buildWorld(view);cameraUpdate();
  // Read by performance checks: how often the static world is rebuilt (fog, known objects) and the last cost.
  canvas.dataset.rebuilds=String(Number(canvas.dataset.rebuilds??0)+1);canvas.dataset.rebuildMs=(performance.now()-t).toFixed(1);}const alive=new Set(view.units.map(u=>u.id));for(const [key,u] of units)if(!alive.has(key)){scene.remove(u.group);units.delete(key);}
 for(const data of view.units){
  // A converted unit changes sides: rebuild it in its new owner's colours (at the same spot).
  const kept=units.get(data.id);if(kept&&kept.player!==data.player){scene.remove(kept.group);units.delete(data.id);}
  const u=units.get(data.id)??unit(data.id,data.player,data.kind);const goal=new T.Vector3(data.x/100,(groundHeight(worldTiles,data.x,data.y)+standingLift(data.x,data.y))/100,data.y/100),from=u.goal??u.group.position;
  const dx=goal.x-from.x,dz=goal.z-from.z;if(Math.abs(dx)+Math.abs(dz)>.001)u.group.rotation.y=Math.atan2(dx,dz);
  // New units, the model viewer and jumps of more than 1.5 tiles (load, respawn) snap; ordinary steps are eased in draw().
  if(!u.goal||options.assetPreview||u.group.position.distanceTo(goal)>1.5)u.group.position.copy(goal);u.goal=goal;u.ring.visible=selected.has(data.id);u.moving=data.navigation==='moving';
  // Sim state drives the pose: gathering works with the resource's tool, returning cargo walks with a basket.
  if(!options.assetPreview&&(data.work==='gathering'||data.work==='hunting'||data.action===1)&&!u.moving&&data.target)u.group.rotation.y=Math.atan2(data.target.x/100-u.group.position.x,data.target.y/100-u.group.position.z);
  if(!options.assetPreview){
   // Own units wear their line's latest researched upgrade (the enemy's research is not projected); a trebuchet shows
   // the state the sim projects, packed on its wagon or standing unpacked (cached rigs toggle, nothing is rebuilt).
   const look=data.player===0?lookOf(data.kind,view.economy?.techs??[]):null;if(look!==u.look){u.look=look;u.rig.grade(look);u.tool='';detail.apply(u.group,zoom);}
   if(data.kind==='trebuchet'&&!!data.unpacked!==u.unpacked){u.unpacked=!!data.unpacked;(u.rig as SiegeRig).dress(u.unpacked?'unpacked':'packed');const f=unitFrame('trebuchet',u.unpacked);u.bar.position.y=f.bar;u.ring.scale.set(f.ring,1,f.ring);detail.apply(u.group,zoom);}
   const gathering=(data.work==='gathering'||data.work==='hunting')&&!u.moving,activity=u.moving?(data.cargo?'carry':'walk'):gathering||data.rite?'work':'idle';
   // Food by its source: a spear for the hunt and for shore fish, a knife (sickle) for a carcass, the basket for bushes and fields.
   const source=data.work==='gathering'&&data.target?view.resources.find(r=>r.x===data.target!.x&&r.y===data.target!.y&&!r.obstacleId):undefined,food:UnitTool=data.work==='hunting'||source?.kind==='fish'?'spear':source?'sickle':'basket';
   const weapon:UnitTool=gradedWeapon(data.kind,u.look),tool=data.cargo&&activity!=='work'?'basket':gathering?({wood:'axe',stone:'pick',gold:'pick',food} as Record<string,UnitTool>)[data.workResource??'food']:weapon;
   if(tool!==u.tool){u.rig.equip(tool as UnitTool);u.tool=tool;}
   // A carried relic rides on the monk's back.
   if(data.relic&&!u.relic){u.relic=relic();u.relic.position.set(0,.98,-.3);u.group.add(u.relic);}else if(!data.relic&&u.relic){u.group.remove(u.relic);u.relic=null;}
   // Combat poses follow the projected action; hit/attack clocks restart when the action begins.
   const next=data.action===1&&!u.moving?'attack':data.action===2&&!u.moving?'hit':activity;if(next!==u.activity)u.poseStart=performance.now();u.activity=next;
   const share=Math.max(0,data.hp)/Math.max(1,data.maxHp);u.bar.visible=share<1;u.fill.scale.x=Math.max(.001,share);u.fill.position.x=-.25*(1-share);u.bar.rotation.y=angle-u.group.rotation.y;}}
  const spots=new Set((view.relicSpots??[]).map(r=>r.id));for(const [id,g] of relics)if(!spots.has(id)){scene.remove(g);relics.delete(id);}
  for(const r of view.relicSpots??[]){let g=relics.get(r.id);if(!g){g=relic();scene.add(g);relics.set(r.id,g);}g.position.set(r.x/100,(groundHeight(worldTiles,r.x,r.y)+standingLift(r.x,r.y))/100,r.y/100);}
  // Shots in flight: new ones take a pooled mesh at their launch point; the ones the view no longer lists have landed.
  const inAir=new Set((view.projectiles??[]).map(p=>p.id));for(const [id,f] of flights)if(!inAir.has(id)){land(f);flights.delete(id);}
  for(const p of view.projectiles??[]){let f=flights.get(p.id);
   if(!f){const shape=shapeOf(p.kind),mesh=flightPool.get(shape)?.pop()??new T.Mesh(shapes[shape].geo,shapes[shape].mat);scene.add(mesh);
    f={mesh,shape,from:{...p.from},to:{...p.to},goal:{x:p.x,y:p.y},at:{...p.from},lift:launchLift[p.kind]??.62,fan:((p.id*37)%9-4)*5};flights.set(p.id,f);
    if(shape==='ball'||shape==='shot')puff(p.from.x,p.from.y,shape==='ball'?.4:.16,'#e9e4d8');placeFlight(f,0);}
   f.goal={x:p.x,y:p.y};f.to={...p.to};}
  canvas.dataset.flights=String(flights.size);
  // Arrows from town centres and towers as straight lines: only for a view without flights (older snapshots).
  const flying=new Set((view.projectiles?[]:view.shots??[]).map(v=>`${v.tick}:${v.from.x},${v.from.y}>${v.to.x},${v.to.y}`));for(const [k,m] of arrows)if(!flying.has(k)){scene.remove(m);arrows.delete(k);}
  for(const v of view.projectiles?[]:view.shots??[]){const k=`${v.tick}:${v.from.x},${v.from.y}>${v.to.x},${v.to.y}`;if(arrows.has(k))continue;
   const a=new T.Vector3(v.from.x/100,groundHeight(worldTiles,v.from.x,v.from.y)/100+2.2,v.from.y/100),b=new T.Vector3(v.to.x/100,groundHeight(worldTiles,v.to.x,v.to.y)/100+.6,v.to.y/100);
   const m=new T.Mesh(arrowGeo,arrowMaterial);m.position.copy(a).lerp(b,.5);m.scale.z=a.distanceTo(b);m.lookAt(b);scene.add(m);arrows.set(k,m);}
  // Corpses: create once, pose from the moment they appear, remove when the sim drops them.
  const lying=new Set((view.corpses??[]).map(c=>c.id));for(const [id,f] of fallen)if(!lying.has(id)){scene.remove(f.group);fallen.delete(id);}
  // A destroyed siege engine tips over as a wreck (its own rig); everyone else falls on foot.
  for(const c of view.corpses??[])if(!fallen.has(c.id)){const group=new T.Group();let rig:ReturnType<typeof createCharacterRig>|SiegeRig|VesselRig;if(isSiege(c.kind))rig=createSiegeRig(T,c.kind,c.player,box,material);else if(isVessel(c.kind))rig=createVesselRig(T,c.kind,c.player,box,material);else{const body=createCharacterRig(T,c.player,box,material);if(c.kind!=='villager')body.dress(corpseRole(c.kind));rig=body;}group.add(rig.root);group.position.set(c.x/100,groundHeight(worldTiles,c.x,c.y)/100,c.y/100);scene.add(group);fallen.set(c.id,{group,rig,start:performance.now()});}
 }
 const raycaster=new T.Raycaster(),ground=new T.Plane(new T.Vector3(0,1,0),0);
 function pick(clientX:number,clientY:number):{unitId?:number;x?:number;y?:number}{const r=canvas.getBoundingClientRect();raycaster.setFromCamera(new T.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),camera);
 const hits=detail.withSelectionGeometry(scene,()=>visibleMeshHits(raycaster,[...units.values()].map(u=>u.group)));if(hits.length){let obj=hits[0].object;while(obj.parent&&obj.parent!==scene)obj=obj.parent;for(const [id,u] of units)if(u.group===obj)return {unitId:id};}
 const groundHit=raycaster.intersectObjects(staticGroup.children.filter((mesh:any)=>mesh.userData.ground),false)[0];if(groundHit)return {x:groundHit.point.x,y:groundHit.point.z};return {};}
 // Buildings by their volume (footprint x model height), so a click on a roof means that building, not the ground behind it.
 const buildingHeights:Record<string,number>={'town-center':2.6,barracks:2.2,house:1.9,farm:.25,'lumber-camp':1.9,'mining-camp':1.9,mill:2.6,stable:2.2,'archery-range':2.2,blacksmith:2.4,'watch-tower':3.2,'siege-workshop':2.2,monastery:3.4,castle:4.7,university:3.6,market:2.2,dock:2.4,'fish-trap':.4,outpost:2.1,'bombard-tower':2.4,wonder:4.6,'palisade-wall':1.3,'stone-wall':1.3,'palisade-gate':1.5,gate:1.6};
 function pickBuilding(clientX:number,clientY:number):string|undefined{if(!latest)return;const r=canvas.getBoundingClientRect();raycaster.setFromCamera(new T.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),camera);
  let best:string|undefined,dist=Infinity;const hit=new T.Vector3();
  for(const {obstacle:o} of latest.known){const h=buildingHeights[o.kind]+(o.kind==='watch-tower'&&!o.red?towerLift(ownTower(latest)):0);if(!h||!o.id)continue;const [x0,y0,x1,y1]=obstacleBounds(o),base=groundHeight(worldTiles,o.x,o.y)/100;
   if(raycaster.ray.intersectBox(new T.Box3(new T.Vector3(x0/100,base,y0/100),new T.Vector3(x1/100,base+h,y1/100)),hit)){const d=hit.distanceTo(raycaster.ray.origin);if(d<dist){dist=d;best=o.id;}}}
  return best;}
 // Ground only, ignoring units: the target of a move order.
 function pickGround(clientX:number,clientY:number):{x?:number;y?:number}{const r=canvas.getBoundingClientRect();raycaster.setFromCamera(new T.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),camera);const hit=raycaster.intersectObjects(staticGroup.children.filter((mesh:any)=>mesh.userData.ground),false)[0];return hit?{x:hit.point.x,y:hit.point.z}:{};}
 // Box selection: units whose body centre projects inside the client-space rectangle.
 function unitsInRect(x0:number,y0:number,x1:number,y1:number):number[]{const r=canvas.getBoundingClientRect(),out:number[]=[],p=new T.Vector3();for(const [id,u] of units){if(!u.group.visible)continue;p.set(u.group.position.x,u.group.position.y+.55,u.group.position.z).project(camera);const sx=r.left+(p.x+1)/2*r.width,sy=r.top+(1-p.y)/2*r.height;if(sx>=Math.min(x0,x1)&&sx<=Math.max(x0,x1)&&sy>=Math.min(y0,y1)&&sy<=Math.max(y0,y1))out.push(id);}return out.sort((a,b)=>a-b);}
 let lastDraw=0;
 // Wheel and pinch zoom glide to their goal (a notch or a trackpad stream accumulates); buttons and scripted views stay instant.
 let zoomGoal:number|null=null;
 function draw(time:number){if(contextLost)return;resize();const dt=lastDraw?Math.min(100,Math.max(0,time-lastDraw)):0,ease=1-Math.exp(-dt/60);lastDraw=time;
  if(zoomGoal!==null){zoom+=(zoomGoal-zoom)*(1-Math.exp(-dt/70));if(Math.abs(zoomGoal-zoom)<.002){zoom=zoomGoal;zoomGoal=null;}cameraUpdate();}
  for(const u of units.values())if(u.goal){if(u.group.position.distanceTo(u.goal)<.002)u.group.position.copy(u.goal);else u.group.position.lerp(u.goal,ease);}
  for(const f of flights.values()){f.at.x+=(f.goal.x-f.at.x)*ease;f.at.y+=(f.goal.y-f.at.y)*ease;placeFlight(f,time);}
  for(let i=puffs.length-1;i>=0;i--){const p=puffs[i];if(!p.start)p.start=time;const k=(time-p.start)/380;if(k>=1){scene.remove(p.mesh);puffPool.push(p.mesh);puffs.splice(i,1);continue;}p.mesh.scale.setScalar(p.size*(.3+.7*k));p.mesh.material.opacity=.55*(1-k);}
  stepMarker(time);
  for(const u of units.values()){const pose=options.assetPreview?previewPose:poseFor(u.kind,u.activity as UnitPose);u.rig.pose(pose,options.assetPreview?(previewAnimated?time-poseStart:pose==='death'?700:pose==='hit'?150:350):pose==='hit'?time-u.poseStart:time);u.ring.visible=[...units].some(([id,v])=>v===u&&selected.has(id))&&pose!=='death';}for(const f of fallen.values())f.rig.pose('death',time-f.start);renderer.render(scene,camera);if(++frames%30===0){canvas.dataset.draws=String(renderer.info.render.calls);canvas.dataset.triangles=String(renderer.info.render.triangles);}}
 let frames=0;
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;canvas.dataset.renderState='context-lost';onFailure(options.assetPreview?'模型繪圖連線中斷，請重新載入模型頁。':'3D 繪圖連線中斷，模擬已暫停；請重新載入頁面後讀取手動存檔。');});
 canvas.dataset.renderer='webgl2';canvas.dataset.renderState='ready';
 // Order feedback: a short-lived ground marker where a right-click landed (ring plus cross), coloured by order kind.
 const markerGroup=new T.Group(),markerRing=new T.Mesh(new T.RingGeometry(.22,.3,24),new T.MeshBasicMaterial({color:'#fff2a1',transparent:true,side:T.DoubleSide,depthWrite:false}));markerRing.rotation.x=-Math.PI/2;
 const markerCross=[0,1].map(i=>{const m=new T.Mesh(new T.BoxGeometry(.42,.02,.07),markerRing.material);m.rotation.y=Math.PI/4+i*Math.PI/2;return m;});markerGroup.add(markerRing,...markerCross);markerGroup.visible=false;scene.add(markerGroup);let markerStart=0;
 const markerColors:Record<string,string>={move:'#fff2a1',gather:'#bfe38a',attack:'#e2573f',rally:'#9cc8e6'};
 function setMarker(kind:string,x:number,z:number){markerRing.material.color.set(markerColors[kind]??'#fff2a1');markerGroup.position.set(x,groundHeight(worldTiles,x*100,z*100)/100+.06,z);markerGroup.visible=true;markerStart=0;}
 function stepMarker(time:number){if(!markerGroup.visible)return;if(!markerStart)markerStart=time;const t=(time-markerStart)/700;if(t>=1){markerGroup.visible=false;return;}markerRing.material.opacity=1-t;markerGroup.scale.setScalar(1+.35*t);}
 // Rally point of the selected building: a small blue flag on a pole, shown only while that building is selected.
 const rallyFlag=new T.Group();{const pole=new T.Mesh(box(.05,.9,.05),material('#80674f')),cloth=new T.Mesh(box(.32,.2,.03),material('#456e87'));cloth.position.set(.17,.66,0);rallyFlag.add(pole,cloth);}rallyFlag.visible=false;scene.add(rallyFlag);
 function setRally(p:{x:number;z:number}|null){rallyFlag.visible=!!p;if(p)rallyFlag.position.set(p.x,groundHeight(worldTiles,p.x*100,p.z*100)/100,p.z);}
 // Placement preview: a translucent footprint slab, green when the local check passes, red otherwise.
 const ghost=new T.Mesh(new T.BoxGeometry(1,.3,1),new T.MeshBasicMaterial({color:'#6f9d6a',transparent:true,opacity:.42,depthWrite:false}));ghost.visible=false;scene.add(ghost);
 function setGhost(g:{kind:BuildKind;x:number;y:number;ok:boolean}|null){ghost.visible=!!g;if(!g)return;const [x0,y0,x1,y1]=obstacleBounds({kind:g.kind,x:g.x,y:g.y});
  ghost.scale.set((x1-x0)/100,1,(y1-y0)/100);ghost.position.set((x0+x1)/200,groundHeight(worldTiles,g.x,g.y)/100+.15,(y0+y1)/200);ghost.material.color.set(g.ok?'#6f9d6a':'#b8574a');}
 // A dragged wall: one slab per segment (pooled), each green or red on its own.
 const wallGhosts:InstanceType<typeof T.Mesh>[]=[];
 function setGhosts(list:{kind:BuildKind;x:number;y:number;ok:boolean}[]){
  while(wallGhosts.length<list.length){const m=new T.Mesh(ghost.geometry,new T.MeshBasicMaterial({color:'#6f9d6a',transparent:true,opacity:.42,depthWrite:false}));scene.add(m);wallGhosts.push(m);}
  wallGhosts.forEach((m,i)=>{const g=list[i];m.visible=!!g;if(!g)return;const [x0,y0,x1,y1]=obstacleBounds({kind:g.kind,x:g.x,y:g.y});m.scale.set((x1-x0)/100,1,(y1-y0)/100);m.position.set((x0+x1)/200,groundHeight(worldTiles,g.x,g.y)/100+.15,(y0+y1)/200);(m.material as InstanceType<typeof T.MeshBasicMaterial>).color.set(g.ok?'#6f9d6a':'#b8574a');});}
 // Patrol routes of the selected units: a faint dashed track between the two ends (pooled dashes, one shared material).
 const patrolDash=new T.BoxGeometry(.2,.03,.09),patrolLook=new T.MeshBasicMaterial({color:'#2f5f73',transparent:true,opacity:.72,depthWrite:false}),patrolDashes:InstanceType<typeof T.Mesh>[]=[];
 function setPatrols(routes:{from:{x:number;z:number};to:{x:number;z:number}}[]){
  const spots:{x:number;z:number;a:number}[]=[];
  for(const r of routes){const dx=r.to.x-r.from.x,dz=r.to.z-r.from.z,len=Math.hypot(dx,dz),n=Math.min(60,Math.floor(len/.36));for(let i=0;i<=n;i++){const t=n?i/n:0;spots.push({x:r.from.x+dx*t,z:r.from.z+dz*t,a:Math.atan2(-dz,dx)});}}
  while(patrolDashes.length<spots.length){const m=new T.Mesh(patrolDash,patrolLook);scene.add(m);patrolDashes.push(m);}
  canvas.dataset.patrol=String(spots.length);
  patrolDashes.forEach((m,i)=>{const p=spots[i];m.visible=!!p;if(!p)return;m.position.set(p.x,(groundHeight(worldTiles,p.x*100,p.z*100)+standingLift(p.x*100,p.z*100))/100+.07,p.z);m.rotation.y=p.a;});}
 // HUD art: the same brick parts and rigs rendered once into small transparent PNGs (no icon packs, no network).
 // A second, short-lived WebGL context keeps the battlefield renderer's size and state untouched.
 function renderIcons(size=160):Record<string,string>{
  const off=document.createElement('canvas');off.width=off.height=size;
  const r=new T.WebGLRenderer({canvas:off,antialias:true,alpha:true,preserveDrawingBuffer:true});
  r.outputColorSpace=T.SRGBColorSpace;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.35;r.setClearColor(0x000000,0);
  const s=new T.Scene();s.add(new T.HemisphereLight('#fff5dc','#819b75',2.6));const key=new T.DirectionalLight('#fff1d8',3);key.position.set(-4,20,12);s.add(key);
  const cam=new T.OrthographicCamera(-1,1,1,-1,.1,200),out:Record<string,string>={},corner=new T.Vector3();
  const parts=(list:{x:number;y:number;z:number;w:number;d:number;h:number;color:string;shape?:'arch'}[],studs=true)=>{const g=new T.Group();
   for(const p of list){const m=new T.Mesh(p.shape==='arch'?arch(p.w-.018,p.h,p.d-.018):box(p.w-.018,p.h,p.d-.018),material(p.color));m.position.set(p.x+p.w/2,p.y,p.z+p.d/2);g.add(m);}
   if(studs)for(const st of buildingStuds(list as any)){const m=new T.Mesh(studGeo,material(st.color));m.position.set(st.x,st.y,st.z);g.add(m);}return g;};
  const shoot=(name:string,g:any,view:{angle:number;lift:number;crop?:number;span?:number}={angle:Math.PI/4,lift:1})=>{s.add(g);g.updateMatrixWorld(true);
   const b=new T.Box3().setFromObject(g),c=b.getCenter(new T.Vector3());if(view.crop)c.y=b.min.y+(b.max.y-b.min.y)*view.crop;
   cam.position.set(c.x+Math.sin(view.angle)*30,c.y+30*view.lift,c.z+Math.cos(view.angle)*30);cam.lookAt(c);cam.updateMatrixWorld();
   let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;for(let i=0;i<8;i++){corner.set(i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z).applyMatrix4(cam.matrixWorldInverse);x0=Math.min(x0,corner.x);x1=Math.max(x1,corner.x);y0=Math.min(y0,corner.y);y1=Math.max(y1,corner.y);}
   const half=view.crop?(y1-y0)*(view.span??.36):Math.max(x1-x0,y1-y0)/2*1.06,cx=(x0+x1)/2,cy=view.crop?0:(y0+y1)/2;
   Object.assign(cam,{left:cx-half,right:cx+half,top:cy+half,bottom:cy-half});cam.updateProjectionMatrix();r.render(s,cam);out[name]=off.toDataURL('image/png');s.remove(g);};
  try{
   // Siege engines: the whole engine for both tiles (the trebuchet standing unpacked, its recognisable state).
   for(const kind of siegeKinds){const rig=createSiegeRig(T,kind,0,box,material);if(kind==='trebuchet')rig.dress('unpacked');rig.pose('idle',0);const g=new T.Group();g.add(rig.root);shoot(kind,g,{angle:Math.PI/4,lift:.5});shoot(`${kind}-face`,g,{angle:Math.PI/4,lift:.5});}
   // Ships and the trade cart: three-quarter view from a little higher (a hull reads by its deck).
   for(const kind of vesselKinds){const rig=createVesselRig(T,kind,0,box,material);rig.pose('idle',0);const g=new T.Group();g.add(rig.root);shoot(kind,g,{angle:Math.PI/4,lift:.6});shoot(`${kind}-face`,g,{angle:Math.PI/4,lift:.6});}
   for(const kind of ['sheep','deer','boar'] as const){const rig=createAnimalRig(T,kind,0,box,material);rig.pose('idle',0);const g=new T.Group();g.add(rig.root);shoot(kind,g,{angle:Math.PI/3,lift:.35});shoot(`${kind}-face`,g,{angle:Math.PI/3,lift:.35});}
   for(const kind of ['villager','militia','archer','scout','monk','spearman','skirmisher','knight',...iconUniques]){const rig=createCharacterRig(T,0,box,material);if(kind!=='villager')rig.dress(roleOf(kind) as any);rig.equip(weaponOf(kind));rig.pose('idle',0);
    const g=new T.Group();g.add(rig.root);const role=roleOf(kind);shoot(kind,g,{angle:Math.PI/7,lift:.35});// A rider's face sits high above the horse (higher still in the howdah): frame the upper part tighter.
    // Crops measured so the head sits where the scout's does; the shorter scimitar and bow leave the light riders' box lower.
    shoot(`${kind}-face`,g,role==='war-elephant'?{angle:Math.PI/7,lift:.35,crop:.81,span:.15}:role==='camel'?{angle:Math.PI/7,lift:.35,crop:.89,span:.19}:role==='mameluke'||role==='mangudai'||role==='cavalry-archer'?{angle:Math.PI/7,lift:.35,crop:.84,span:.23}:isMounted(role)?{angle:Math.PI/7,lift:.35,crop:.74,span:.21}:{angle:Math.PI/7,lift:.35,crop:.72});}
   const visual=(age:number)=>({ageVariant:age as 1|2|3|4,progress:100,health:100,red:false});
   for(const age of [1,2,3,4]){shoot(`house-${age}`,parts(buildingParts(visual(age))));shoot(`barracks-${age}`,parts(militaryBuildingParts('barracks',visual(age))));shoot(`stable-${age}`,parts(militaryBuildingParts('stable',visual(age))));shoot(`archery-range-${age}`,parts(militaryBuildingParts('archery-range',visual(age))));shoot(`monastery-${age}`,parts(monasteryParts(visual(age))));shoot(`blacksmith-${age}`,parts(blacksmithParts(visual(age))));shoot(`watch-tower-${age}`,parts(towerParts(visual(age))));shoot(`siege-workshop-${age}`,parts(siegeWorkshopParts(visual(age))));shoot(`castle-${age}`,parts(castleParts(visual(age))));shoot(`university-${age}`,parts(universityParts(visual(age))));shoot(`town-center-${age}`,parts(economicBuildingParts('town-center',visual(age))));for(const camp of ['lumber-camp','mining-camp','mill','market'] as const)shoot(`${camp}-${age}`,parts(economicBuildingParts(camp,visual(age))));
    // The 建築 round's buildings (walls and gates shown in a straight run).
    const run={...noLinks,e:true,w:true};shoot(`dock-${age}`,parts(dockParts(visual(age))));shoot(`fish-trap-${age}`,parts(fishTrapParts(visual(age))));shoot(`outpost-${age}`,parts(outpostParts(visual(age))));shoot(`bombard-tower-${age}`,parts(bombardTowerParts(visual(age))));shoot(`wonder-${age}`,parts(wonderParts(visual(age))));
    for(const k of ['palisade-wall','stone-wall'] as const)shoot(`${k}-${age}`,parts(wallParts(k,visual(age),run)));for(const k of ['palisade-gate','gate'] as const)shoot(`${k}-${age}`,parts(gateParts(k,visual(age),run)));}
   shoot('farm',parts(farmParts(100,false),false));shoot('relic',parts(relicParts.map(p=>({...p,x:p.x+.5,z:p.z+.5})),false));for(const [id,list] of Object.entries(techIcons))shoot(`tech-${id}`,parts(list,false));
   const bush=[{x:.05,y:0,z:.05,w:.55,d:.55,h:.45,color:'#5d824e'},...[.12,.36].flatMap(x=>[.12,.36].map(z=>({x,y:.45,z,w:.12,d:.12,h:.12,color:'#a84e59'})))];
   const tree=[{x:.15,y:0,z:.15,w:.3,d:.3,h:.8,color:'#80664b'},{x:-.2,y:.7,z:-.2,w:1,d:1,h:.4,color:'#67835a'},{x:-.075,y:1.1,z:-.075,w:.75,d:.75,h:.4,color:'#7e985f'},{x:.05,y:1.5,z:.05,w:.5,d:.5,h:.3,color:'#91a970'}];
   const ore=(a:string,b:string)=>[{x:0,y:0,z:0,w:.65,d:.7,h:.3,color:a},{x:.15,y:.3,z:.15,w:.35,d:.4,h:.18,color:b}];
   shoot('food',parts(bush,false));shoot('wood',parts(tree,false));shoot('gold',parts(ore('#b59a48','#dec36f'),false));shoot('stone',parts(ore('#a19f86','#b8b39c'),false));
  }finally{r.dispose();r.forceContextLoss();}
  return out;
 }
 // Minimap needs the camera in board units: focus, heading and the half extents of the orthographic view.
 const cameraView=()=>({x:focus.x,z:focus.z,angle,halfW:(camera.right-camera.left)/2,halfH:(camera.top-camera.bottom)/2});
 // Graphics quality (player setting): high = sharp (device pixels up to 2x) with soft 2048 shadows; medium = 1x
 // pixels, 1024 shadows; low = 0.75x pixels and no shadows. Changing shadows recompiles the materials once.
 function setQuality(level:'high'|'medium'|'low'){
  renderer.setPixelRatio(level==='high'?Math.min(devicePixelRatio,2):level==='medium'?1:.75);width=0;height=0;resize();
  const shadows=level!=='low',size=level==='high'?2048:1024;
  if(renderer.shadowMap.enabled!==shadows||sun.shadow.mapSize.x!==size){renderer.shadowMap.enabled=shadows;sun.castShadow=shadows;sun.shadow.mapSize.set(size,size);sun.shadow.map?.dispose();sun.shadow.map=null;for(const m of materials.values())m.needsUpdate=true;table.material.needsUpdate=true;}
  canvas.dataset.quality=level;}
 return {update,draw,pick,pickGround,pickBuilding,setMarker,setRally,setQuality,unitsInRect,setGhost,setGhosts,setPatrols,renderIcons,cameraView,setPreviewBuildingKind:(kind:DrawnBuilding|EconomicBuilding|MilitaryBuilding)=>{if(!options.assetPreview||(!(drawnBuildings as readonly string[]).includes(kind)&&!economicBuildings.includes(kind as EconomicBuilding)&&!militaryBuildings.includes(kind as MilitaryBuilding)))throw Error('未知模型建築');previewBuildingKind=kind;if(latest)update(latest,selected);},setPreviewStyle:(style:Architecture)=>{if(!options.assetPreview||!architectures.includes(style))throw Error('未知建築風格');previewStyle=style;if(latest)update(latest,selected);},setPreviewRole:(role:any)=>{const siege=previewSiege(role);if(!options.assetPreview||(!unitRoles.includes(role)&&!isMounted(role)&&!siege))throw Error('僅模型檢視可指定有效軍種');previewRole=role;previewPose='idle';
  const frame=siege?unitFrame(siege,role==='trebuchet-unpacked'):frameOfRole(role);
  for(const u of units.values()){const rig=previewRig(u,siege??'character');if(siege==='trebuchet')(rig as SiegeRig).dress(role==='trebuchet-unpacked'?'unpacked':'packed');else if(!siege)(rig as ReturnType<typeof createCharacterRig>).dress(role);rig.grade(null);u.ring.scale.set(frame.ring,1,frame.ring);detail.apply(u.group,zoom);}},
 // Line-upgrade look on the inspected model ('' or null: the base look); dressing again clears it.
 setPreviewGrade:(look:string|null)=>{if(!options.assetPreview||(look&&!Object.values(upgradeLooks).some(line=>line.includes(look))))throw Error('未知升級外觀');for(const u of units.values()){u.rig.grade(look||null);detail.apply(u.group,zoom);}},setPreviewBuilding:(visual:Omit<BuildingVisual,'red'>)=>{if(!options.assetPreview)throw Error('僅模型檢視可指定建築外觀');buildingParts({...visual,red:false});previewBuilding={...visual};if(latest)update(latest,selected);},focusPreviewHouse:()=>{if(!options.assetPreview)throw Error('僅模型檢視可聚焦建築');focus.x=4;focus.y=1;focus.z=4.85;zoomGoal=null;zoom=2.5;cameraUpdate();},focusPreviewUnit:(id:number)=>{if(!options.assetPreview)throw Error('僅模型檢視可聚焦代表資產');const u=units.get(id);if(!u)throw Error('找不到人偶');focus.x=u.group.position.x;focus.y=u.group.position.y+.5;focus.z=u.group.position.z;zoomGoal=null;zoom=2.5;cameraUpdate();},setPreviewMotion:(pose:UnitPose,tool:UnitTool,animated:boolean)=>{if(!options.assetPreview)throw Error('僅模型檢視可指定姿態');if((isMounted(previewRole)&&!['idle','walk','attack'].includes(pose))||!unitPoses.includes(pose)||!unitTools.includes(tool))throw Error('未知模型姿態或工具');previewPose=pose;previewTool=tool;previewAnimated=animated;poseStart=performance.now();for(const u of units.values()){u.rig.equip(tool);detail.apply(u.group,zoom);}},setPreviewLayout:(layout:MapLayout)=>{if(!options.assetPreview)throw Error('僅模型檢視可切換驗收圖');if(!['meadow','coast','acceptance','lakes'].includes(layout))throw Error('未知地圖模式');previewLayout=layout;if(latest)update(latest,selected);},zoom:(delta:number)=>{zoomGoal=null;zoom=Math.max(minZoom(),Math.min(2.5,zoom+delta));cameraUpdate();},wheelZoom:(delta:number)=>{const goal=Math.max(minZoom(),Math.min(2.5,(zoomGoal??zoom)+delta));if(matchMedia('(prefers-reduced-motion: reduce)').matches){zoomGoal=null;zoom=goal;cameraUpdate();}else zoomGoal=goal;},rotate:()=>{angle+=Math.PI/2;cameraUpdate();},
 // Screen-aligned pan (right, away from camera), scaled by zoom and clamped to the board.
 pan:(right:number,up:number)=>{const step=1.2/zoom,c=Math.cos(angle),s=Math.sin(angle);focus.x=Math.max(0,Math.min(board,focus.x+(c*right-s*up)*step));focus.z=Math.max(0,Math.min(board,focus.z+(-s*right-c*up)*step));cameraUpdate();},
 // Opening view of a match: the home town centre, close enough that the base fills the window (wide or tall).
 focusHome:(x:number,z:number)=>{resize();const aspect=width/Math.max(1,height),halfH=Math.max(10.5,12/aspect);zoomGoal=null;zoom=Math.max(1,Math.min(2.5,Math.max(halfH*aspect/10,halfH/6)));focus.x=Math.max(0,Math.min(board,x));focus.z=Math.max(0,Math.min(board,z));cameraUpdate();},
 focusOn:(x:number,z:number)=>{focus.x=Math.max(0,Math.min(board,x));focus.z=Math.max(0,Math.min(board,z));cameraUpdate();},resetCamera:()=>{focus.x=board/2;focus.y=0;focus.z=board/2;zoomGoal=null;zoom=Math.max(minZoom(),16/board);angle=Math.PI/4;cameraUpdate();},dispose:()=>{renderer.dispose();detail.dispose();for(const geo of geometry.values())geo.dispose();for(const m of materials.values())m.dispose();ringMaterial.dispose();},stats:()=>({detail:detailLevel(zoom),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries})};
}
