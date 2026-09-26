import {buildingStuds,studStyle} from './building-studs.ts';
import {createArchGeometry} from './brick-geometries.ts';
import {militaryBuildingParts,militaryBuildings} from './military-building.ts';
import type {MilitaryBuilding} from './military-building.ts';
import {createCharacterRig} from './character-rig.ts';
import {roleOf,poseFor,corpseRole} from './rig-roles.ts';
import {visibleMeshHits} from './picking.ts';
import {createDetailController,detailLevel} from './lod.ts';
import {economicBuildingParts,economicBuildings} from './economic-building.ts';
import type {EconomicBuilding} from './economic-building.ts';
import {buildingParts} from './building-parts.ts';
import type {BuildingVisual} from './building-parts.ts';
import {createUnitRig,unitPoses,unitTools,unitRoles} from './unit-rig.ts';
import type {UnitPose,UnitTool} from './unit-rig.ts';
import type {MapLayout} from '../../packages/sim/terrain.ts';
import {createTiles,tileAt,groundHeight,sizeOfTiles} from '../../packages/sim/terrain.ts';
import {makeMap} from '../../packages/sim/navigation.ts';
import {walkablePlatforms,obstacleBounds} from '../../packages/content/footprints.ts';
import type {View} from '../../packages/sim/protocol.ts';
export const brickStyle={studPitch:.5,plateHeight:.16,brickHeight:.32,bevel:.025,roughness:.72,provenance:'original_procedural'} as const;
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
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 renderer.setClearColor('#d7e0cc');renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
 const detail=createDetailController(T);
 const scene=new T.Scene();const camera=new T.OrthographicCamera(-12,12,10,-10,.1,100);
 const ambient=new T.HemisphereLight('#fff5dc','#819b75',2.4);scene.add(ambient);
 const sun=new T.DirectionalLight('#fff1d8',3);sun.position.set(-4,20,12);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:1,far:60});sun.shadow.normalBias=.03;scene.add(sun);sun.target.position.set(8,0,8);scene.add(sun.target);
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
 function groundBlock(x:number,z:number,height:number,color:string){const h=height+.24,key=`ground:${h}`;if(!geometry.has(key)){const geo=new T.BoxGeometry(1,h,1);geo.translate(0,h/2,0);geometry.set(key,geo);groundGeometries.add(geo);}staticPart(geometry.get(key),color,x+.5,-.24,z+.5);}
 let previewBuildingKind:'house'|EconomicBuilding|MilitaryBuilding='house';
 let previewBuilding:Omit<BuildingVisual,'red'>={ageVariant:2,progress:100,health:100};
 // The model page swaps in the inspected kind; the sandbox draws each obstacle as itself at age 2.
 function house(x:number,z:number,red=false,obstacleKind:'house'|'town-center'|'barracks'='house',progress=100,age=2,health=100){const kind=options.assetPreview?previewBuildingKind:obstacleKind,visual=options.assetPreview?previewBuilding:{...previewBuilding,progress,health,ageVariant:Math.min(4,Math.max(1,age)) as 1|2|3|4},parts=kind==='house'?buildingParts({...visual,red}):militaryBuildings.includes(kind as MilitaryBuilding)?militaryBuildingParts(kind as MilitaryBuilding,{...visual,red}):economicBuildingParts(kind as EconomicBuilding,{...visual,red});
 for(const p of parts)brick(x+p.x,z+p.z,p.y,p.w,p.d,p.h,p.color,false,p.shape);
 for(const stud of buildingStuds(parts))staticPart(studGeo,stud.color,x+stud.x,stud.y,z+stud.z);}
 function buildWorld(view:View){const seed=view.seed;scene.remove(staticGroup);staticGroup.traverse((o:any)=>{if(o.isInstancedMesh)o.dispose();});staticGroup=new T.Group();scene.add(staticGroup);batches.clear();baseHeight=0;
 const map=options.assetPreview?makeMap(seed,previewLayout):{tiles:view.terrain.map((tile,id)=>({...tile,id,resourceRefs:[],obstacleRefs:[]})),obstacles:view.known.map(k=>k.obstacle),resources:view.resources};worldTiles=map.tiles;board=sizeOfTiles(map.tiles);platforms=map.obstacles.flatMap(o=>{const p=walkablePlatforms[o.kind];return p?[{x0:o.x+p.rect[0],y0:o.y+p.rect[1],x1:o.x+p.rect[2],y1:o.y+p.rect[3],height:p.height}]:[];});let rng=seed||1;for(const tile of map.tiles){const x=tile.id%board,z=Math.floor(tile.id/board);rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;const n=(rng>>>0)/4294967296;groundBlock(x,z,tile.height/100,!options.assetPreview&&view.fog[tile.id]!==2?(view.fog[tile.id]===1?'#626e64':'#293e38'):tile.terrainType==='cliff'?'#8a8065':tile.terrainType==='stone'?'#a1a28e':tile.terrainType==='highland'?'#879d69':tile.terrainType==='water'?'#4b8291':tile.terrainType==='shallow'?'#86b7b8':tile.terrainType==='sand'?'#d5c598':tile.terrainType==='road'?'#c4b18a':n<.2?'#a6b582':n<.5?'#b5c493':'#becda0');}
 for(const o of map.obstacles){baseHeight=groundHeight(map.tiles,o.x,o.y)/100;muted=!options.assetPreview&&view.fog[tileAt(o.x,o.y,sizeOfTiles(map.tiles))]!==2;const x=o.x/100,z=o.y/100;if(o.kind==='farm')for(const p of farmParts(o.progress??100,o.red))brick(x+p.x,z+p.z,p.y,p.w,p.d,p.h,p.color,p.studs);
 else if(o.kind==='house'||o.kind==='town-center'||o.kind==='barracks')house(x,z,o.red,o.kind,o.progress??100,o.age??2,o.damaged?35:100);else if(o.kind==='tree'){brick(x+.15,z+.15,0,.3,.3,.8,'#80664b',false);brick(x-.2,z-.2,.7,1,1,.4,'#67835a');brick(x-.075,z-.075,1.1,.75,.75,.4,'#7e985f');brick(x+.05,z+.05,1.5,.5,.5,.3,'#91a970');}else if(o.kind==='hunt'||o.kind==='livestock'){const color=o.kind==='hunt'?'#99714e':'#e7e2cc';for(const dx of [.1,.45])for(const dz of [.1,.5])brick(x+dx,z+dz,0,.09,.09,.28,'#615643',false);brick(x+.04,z+.06,.25,.54,.55,.35,color,false);brick(x+.16,z+.48,.47,.28,.2,.26,color,false);if(o.kind==='hunt')for(const dx of [.18,.36])brick(x+dx,z+.51,.73,.04,.04,.2,'#715a40',false);}else if(o.kind==='berries'){brick(x+.05,z+.05,0,.55,.55,.45,'#5d824e');for(const dx of [.12,.36])for(const dz of [.12,.36])brick(x+dx,z+dz,.45,.12,.12,.12,'#a84e59',false);}else{brick(x,z,0,.65,.7,.3,o.kind==='gold'?'#b59a48':'#a19f86');brick(x+.15,z+.15,.3,.35,.4,.18,o.kind==='gold'?'#dec36f':'#b8b39c',false);}}
 for(const resource of map.resources??[])if(resource.kind==='fish'&&resource.status==='available'){const x=resource.x/100,z=resource.y/100;baseHeight=groundHeight(map.tiles,resource.x,resource.y)/100;muted=false;for(const offset of [0,.22]){brick(x-.2+offset,z-.1+offset,.025,.25,.1,.05,'#d5e7de',false);brick(x-.27+offset,z-.1+offset,.025,.09,.15,.06,'#bad0ce',false);}}
 baseHeight=0;muted=false;for(const {geo,color,matrices} of batches.values()){const mesh=new T.InstancedMesh(geo,material(color),matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.userData.studs=geo===studGeo;mesh.userData.ground=groundGeometries.has(geo);mesh.castShadow=true;mesh.receiveShadow=true;staticGroup.add(mesh);}
 }
 // goal: the latest simulated position; the drawn position eases toward it every frame (sim runs at 20 Hz, screens faster).
 const units=new Map<number,{group:any;rig:ReturnType<typeof createCharacterRig>;ring:any;player:number;moving:boolean;activity:string;tool:string;poseStart:number;bar:any;fill:any;goal:any;kind:string}>();
 // Fallen units: short-lived rigs in the death pose, keyed by unit id (sim corpses, visual only).
 const fallen=new Map<number,{group:any;rig:ReturnType<typeof createCharacterRig>;start:number}>();
 const barBack=new T.MeshBasicMaterial({color:'#2d3a33'}),barGeo=new T.BoxGeometry(.5,.05,.05);
 const ringGeo=new T.RingGeometry(.4,.47,32);ringGeo.rotateX(-Math.PI/2);geometry.set('ring',ringGeo);const ringMaterial=new T.MeshBasicMaterial({color:'#fff2a1',side:T.DoubleSide});
 function unit(id:number,player:number,kind='villager'){const group=new T.Group();scene.add(group);
 const bar=new T.Group();bar.position.y=1.42;bar.visible=false;const back=new T.Mesh(barGeo,barBack);const fill=new T.Mesh(barGeo,new T.MeshBasicMaterial({color:player===0?'#5f9a6a':'#c0604c'}));fill.position.z=.012;bar.add(back,fill);group.add(bar);
 const rig=createCharacterRig(T,player,box,material);if(!options.assetPreview&&kind!=='villager')rig.dress(roleOf(kind));rig.equip(previewTool);group.add(rig.root);detail.apply(group,zoom);
 const ring=new T.Mesh(ringGeo,ringMaterial);ring.position.y=.025;group.add(ring);units.set(id,{group,rig,ring,player,moving:false,activity:'idle',tool:'none',poseStart:0,bar,fill,goal:null,kind});return units.get(id)!;
 }
 let previewRole='villager';
 let previewPose:UnitPose='idle',previewTool:UnitTool='none',previewAnimated=false,poseStart=0;const focus={x:8,y:0,z:8};let worldKey='',angle=Math.PI/4,zoom=1,width=0,height=0,selected=new Set<number>([1]),latest:View|null=null;
 // board: tiles per side of the current map (16 on the test grounds, 32 on the match map); set in buildWorld.
 let board=16;const minZoom=()=>Math.min(.7,.7*16/board);
 function cameraUpdate(){if(width<=0||height<=0)return;const aspect=width/Math.max(1,height);const halfH=Math.max(10.5,12/aspect)/zoom;
 // The sun and its shadow box follow the view (same offset as the original fixed light at the board centre).
 sun.target.position.set(focus.x,0,focus.z);sun.position.set(focus.x-12,20,focus.z+4);const reach=Math.max(14,halfH*aspect*1.1);Object.assign(sun.shadow.camera,{left:-reach,right:reach,top:reach,bottom:-reach});sun.shadow.camera.updateProjectionMatrix();camera.left=-halfH*aspect;camera.right=halfH*aspect;camera.top=halfH;camera.bottom=-halfH;camera.position.set(focus.x+Math.sin(angle)*24,focus.y+24,focus.z+Math.cos(angle)*24);camera.lookAt(focus.x,focus.y,focus.z);camera.updateProjectionMatrix();camera.updateMatrixWorld();detail.apply(scene,zoom);
 // Read by browser flows to aim the pointer at world points: focus x, focus z, half view height, heading.
 canvas.dataset.camera=`${focus.x.toFixed(4)},${focus.z.toFixed(4)},${halfH.toFixed(4)},${angle.toFixed(4)}`;}
 function resize(){const r=canvas.getBoundingClientRect();if(r.width!==width||r.height!==height){width=r.width;height=r.height;renderer.setSize(width,height,false);cameraUpdate();}}
 function update(view:View,ids:number|Iterable<number>){latest=view;selected=new Set(typeof ids==='number'?[ids]:ids);const key=JSON.stringify([previewBuildingKind,previewBuilding,previewLayout,view.layout,view.seed,view.fog,view.known?.map(k=>k.obstacle),view.resources]);if(worldKey!==key){worldKey=key;const t=performance.now();buildWorld(view);cameraUpdate();
  // Read by performance checks: how often the static world is rebuilt (fog, known objects) and the last cost.
  canvas.dataset.rebuilds=String(Number(canvas.dataset.rebuilds??0)+1);canvas.dataset.rebuildMs=(performance.now()-t).toFixed(1);}const alive=new Set(view.units.map(u=>u.id));for(const [key,u] of units)if(!alive.has(key)){scene.remove(u.group);units.delete(key);}
 for(const data of view.units){const u=units.get(data.id)??unit(data.id,data.player,data.kind);const goal=new T.Vector3(data.x/100,(groundHeight(worldTiles,data.x,data.y)+standingLift(data.x,data.y))/100,data.y/100),from=u.goal??u.group.position;
  const dx=goal.x-from.x,dz=goal.z-from.z;if(Math.abs(dx)+Math.abs(dz)>.001)u.group.rotation.y=Math.atan2(dx,dz);
  // New units, the model viewer and jumps of more than 1.5 tiles (load, respawn) snap; ordinary steps are eased in draw().
  if(!u.goal||options.assetPreview||u.group.position.distanceTo(goal)>1.5)u.group.position.copy(goal);u.goal=goal;u.ring.visible=selected.has(data.id);u.moving=data.navigation==='moving';
  // Sim state drives the pose: gathering works with the resource's tool, returning cargo walks with a basket.
  if(!options.assetPreview&&(data.work==='gathering'||data.action===1)&&!u.moving&&data.target)u.group.rotation.y=Math.atan2(data.target.x/100-u.group.position.x,data.target.y/100-u.group.position.z);
  if(!options.assetPreview){const gathering=data.work==='gathering'&&!u.moving,activity=u.moving?(data.cargo?'carry':'walk'):gathering?'work':'idle';
   const weapon:UnitTool=data.kind==='militia'?'sword':data.kind==='archer'?'bow':data.kind==='scout'?'spear':'none',tool=data.cargo&&activity!=='work'?'basket':gathering?({wood:'axe',stone:'pick',gold:'pick',food:'basket'} as Record<string,UnitTool>)[data.workResource??'food']:weapon;
   if(tool!==u.tool){u.rig.equip(tool as UnitTool);u.tool=tool;}
   // Combat poses follow the projected action; hit/attack clocks restart when the action begins.
   const next=data.action===1&&!u.moving?'attack':data.action===2&&!u.moving?'hit':activity;if(next!==u.activity)u.poseStart=performance.now();u.activity=next;
   const share=Math.max(0,data.hp)/Math.max(1,data.maxHp);u.bar.visible=share<1;u.fill.scale.x=Math.max(.001,share);u.fill.position.x=-.25*(1-share);u.bar.rotation.y=angle-u.group.rotation.y;}}
  // Corpses: create once, pose from the moment they appear, remove when the sim drops them.
  const lying=new Set((view.corpses??[]).map(c=>c.id));for(const [id,f] of fallen)if(!lying.has(id)){scene.remove(f.group);fallen.delete(id);}
  for(const c of view.corpses??[])if(!fallen.has(c.id)){const group=new T.Group();const rig=createCharacterRig(T,c.player,box,material);if(c.kind!=='villager')rig.dress(corpseRole(c.kind));group.add(rig.root);group.position.set(c.x/100,groundHeight(worldTiles,c.x,c.y)/100,c.y/100);scene.add(group);fallen.set(c.id,{group,rig,start:performance.now()});}
 }
 const raycaster=new T.Raycaster(),ground=new T.Plane(new T.Vector3(0,1,0),0);
 function pick(clientX:number,clientY:number):{unitId?:number;x?:number;y?:number}{const r=canvas.getBoundingClientRect();raycaster.setFromCamera(new T.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),camera);
 const hits=detail.withSelectionGeometry(scene,()=>visibleMeshHits(raycaster,[...units.values()].map(u=>u.group)));if(hits.length){let obj=hits[0].object;while(obj.parent&&obj.parent!==scene)obj=obj.parent;for(const [id,u] of units)if(u.group===obj)return {unitId:id};}
 const groundHit=raycaster.intersectObjects(staticGroup.children.filter((mesh:any)=>mesh.userData.ground),false)[0];if(groundHit)return {x:groundHit.point.x,y:groundHit.point.z};return {};}
 // Buildings by their volume (footprint x model height), so a click on a roof means that building, not the ground behind it.
 const buildingHeights:Record<string,number>={'town-center':2.6,barracks:2.2,house:1.9,farm:.25};
 function pickBuilding(clientX:number,clientY:number):string|undefined{if(!latest)return;const r=canvas.getBoundingClientRect();raycaster.setFromCamera(new T.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),camera);
  let best:string|undefined,dist=Infinity;const hit=new T.Vector3();
  for(const {obstacle:o} of latest.known){const h=buildingHeights[o.kind];if(!h||!o.id)continue;const [x0,y0,x1,y1]=obstacleBounds(o),base=groundHeight(worldTiles,o.x,o.y)/100;
   if(raycaster.ray.intersectBox(new T.Box3(new T.Vector3(x0/100,base,y0/100),new T.Vector3(x1/100,base+h,y1/100)),hit)){const d=hit.distanceTo(raycaster.ray.origin);if(d<dist){dist=d;best=o.id;}}}
  return best;}
 // Ground only, ignoring units: the target of a move order.
 function pickGround(clientX:number,clientY:number):{x?:number;y?:number}{const r=canvas.getBoundingClientRect();raycaster.setFromCamera(new T.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),camera);const hit=raycaster.intersectObjects(staticGroup.children.filter((mesh:any)=>mesh.userData.ground),false)[0];return hit?{x:hit.point.x,y:hit.point.z}:{};}
 // Box selection: units whose body centre projects inside the client-space rectangle.
 function unitsInRect(x0:number,y0:number,x1:number,y1:number):number[]{const r=canvas.getBoundingClientRect(),out:number[]=[],p=new T.Vector3();for(const [id,u] of units){if(!u.group.visible)continue;p.set(u.group.position.x,u.group.position.y+.55,u.group.position.z).project(camera);const sx=r.left+(p.x+1)/2*r.width,sy=r.top+(1-p.y)/2*r.height;if(sx>=Math.min(x0,x1)&&sx<=Math.max(x0,x1)&&sy>=Math.min(y0,y1)&&sy<=Math.max(y0,y1))out.push(id);}return out.sort((a,b)=>a-b);}
 let lastDraw=0;
 function draw(time:number){if(contextLost)return;resize();const dt=lastDraw?Math.min(100,Math.max(0,time-lastDraw)):0,ease=1-Math.exp(-dt/60);lastDraw=time;
  for(const u of units.values())if(u.goal){if(u.group.position.distanceTo(u.goal)<.002)u.group.position.copy(u.goal);else u.group.position.lerp(u.goal,ease);}
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
 function setGhost(g:{kind:'house'|'barracks'|'farm';x:number;y:number;ok:boolean}|null){ghost.visible=!!g;if(!g)return;const [x0,y0,x1,y1]=obstacleBounds({kind:g.kind,x:g.x,y:g.y});
  ghost.scale.set((x1-x0)/100,1,(y1-y0)/100);ghost.position.set((x0+x1)/200,groundHeight(worldTiles,g.x,g.y)/100+.15,(y0+y1)/200);ghost.material.color.set(g.ok?'#6f9d6a':'#b8574a');}
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
   for(const kind of ['villager','militia','archer','scout'] as const){const rig=createCharacterRig(T,0,box,material);if(kind!=='villager')rig.dress(roleOf(kind));rig.equip(kind==='militia'?'sword':kind==='archer'?'bow':kind==='scout'?'spear':'none');rig.pose('idle',0);
    const g=new T.Group();g.add(rig.root);shoot(kind,g,{angle:Math.PI/7,lift:.35});// A rider's face sits high above the horse: frame the upper part tighter.
    shoot(`${kind}-face`,g,kind==='scout'?{angle:Math.PI/7,lift:.35,crop:.74,span:.21}:{angle:Math.PI/7,lift:.35,crop:.72});}
   const visual=(age:number)=>({ageVariant:age as 1|2|3|4,progress:100,health:100,red:false});
   for(const age of [1,2,3,4]){shoot(`house-${age}`,parts(buildingParts(visual(age))));shoot(`barracks-${age}`,parts(militaryBuildingParts('barracks',visual(age))));shoot(`town-center-${age}`,parts(economicBuildingParts('town-center',visual(age))));}
   shoot('farm',parts(farmParts(100,false),false));
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
  if(renderer.shadowMap.enabled!==shadows||sun.shadow.mapSize.x!==size){renderer.shadowMap.enabled=shadows;sun.castShadow=shadows;sun.shadow.mapSize.set(size,size);sun.shadow.map?.dispose();sun.shadow.map=null;for(const m of materials.values())m.needsUpdate=true;}
  canvas.dataset.quality=level;}
 return {update,draw,pick,pickGround,pickBuilding,setMarker,setRally,setQuality,unitsInRect,setGhost,renderIcons,cameraView,setPreviewBuildingKind:(kind:'house'|EconomicBuilding|MilitaryBuilding)=>{if(!options.assetPreview||(kind!=='house'&&!economicBuildings.includes(kind as EconomicBuilding)&&!militaryBuildings.includes(kind as MilitaryBuilding)))throw Error('未知模型建築');previewBuildingKind=kind;if(latest)update(latest,selected);},setPreviewRole:(role:any)=>{if(!options.assetPreview||(!unitRoles.includes(role)&&role!=='cavalry'))throw Error('僅模型檢視可指定有效軍種');previewRole=role;previewPose='idle';for(const u of units.values()){u.rig.dress(role);u.ring.scale.set(role==='cavalry'?1.8:1,1,role==='cavalry'?1.8:1);detail.apply(u.group,zoom);}},setPreviewBuilding:(visual:Omit<BuildingVisual,'red'>)=>{if(!options.assetPreview)throw Error('僅模型檢視可指定建築外觀');buildingParts({...visual,red:false});previewBuilding={...visual};if(latest)update(latest,selected);},focusPreviewHouse:()=>{if(!options.assetPreview)throw Error('僅模型檢視可聚焦建築');focus.x=4;focus.y=1;focus.z=4.85;zoom=2.5;cameraUpdate();},focusPreviewUnit:(id:number)=>{if(!options.assetPreview)throw Error('僅模型檢視可聚焦代表資產');const u=units.get(id);if(!u)throw Error('找不到人偶');focus.x=u.group.position.x;focus.y=u.group.position.y+.5;focus.z=u.group.position.z;zoom=2.5;cameraUpdate();},setPreviewMotion:(pose:UnitPose,tool:UnitTool,animated:boolean)=>{if(!options.assetPreview)throw Error('僅模型檢視可指定姿態');if((previewRole==='cavalry'&&!['idle','walk','attack'].includes(pose))||!unitPoses.includes(pose)||!unitTools.includes(tool))throw Error('未知模型姿態或工具');previewPose=pose;previewTool=tool;previewAnimated=animated;poseStart=performance.now();for(const u of units.values()){u.rig.equip(tool);detail.apply(u.group,zoom);}},setPreviewLayout:(layout:MapLayout)=>{if(!options.assetPreview)throw Error('僅模型檢視可切換驗收圖');if(!['meadow','coast','acceptance'].includes(layout))throw Error('未知地圖模式');previewLayout=layout;if(latest)update(latest,selected);},zoom:(delta:number)=>{zoom=Math.max(minZoom(),Math.min(2.5,zoom+delta));cameraUpdate();},rotate:()=>{angle+=Math.PI/2;cameraUpdate();},
 // Screen-aligned pan (right, away from camera), scaled by zoom and clamped to the board.
 pan:(right:number,up:number)=>{const step=1.2/zoom,c=Math.cos(angle),s=Math.sin(angle);focus.x=Math.max(0,Math.min(board,focus.x+(c*right-s*up)*step));focus.z=Math.max(0,Math.min(board,focus.z+(-s*right-c*up)*step));cameraUpdate();},
 // Opening view of a match: the home town centre, close enough that the base fills the window (wide or tall).
 focusHome:(x:number,z:number)=>{resize();const aspect=width/Math.max(1,height),halfH=Math.max(10.5,12/aspect);zoom=Math.max(1,Math.min(2.5,Math.max(halfH*aspect/10,halfH/6)));focus.x=Math.max(0,Math.min(board,x));focus.z=Math.max(0,Math.min(board,z));cameraUpdate();},
 focusOn:(x:number,z:number)=>{focus.x=Math.max(0,Math.min(board,x));focus.z=Math.max(0,Math.min(board,z));cameraUpdate();},resetCamera:()=>{focus.x=board/2;focus.y=0;focus.z=board/2;zoom=Math.max(minZoom(),16/board);angle=Math.PI/4;cameraUpdate();},dispose:()=>{renderer.dispose();detail.dispose();for(const geo of geometry.values())geo.dispose();for(const m of materials.values())m.dispose();ringMaterial.dispose();},stats:()=>({detail:detailLevel(zoom),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries})};
}
