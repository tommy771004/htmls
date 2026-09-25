import {buildingStuds,studStyle} from './building-studs.ts';
import {createArchGeometry} from './brick-geometries.ts';
import {militaryBuildingParts,militaryBuildings} from './military-building.ts';
import type {MilitaryBuilding} from './military-building.ts';
import {createCharacterRig} from './character-rig.ts';
import {visibleMeshHits} from './picking.ts';
import {createDetailController,detailLevel} from './lod.ts';
import {economicBuildingParts,economicBuildings} from './economic-building.ts';
import type {EconomicBuilding} from './economic-building.ts';
import {buildingParts} from './building-parts.ts';
import type {BuildingVisual} from './building-parts.ts';
import {createUnitRig,unitPoses,unitTools,unitRoles} from './unit-rig.ts';
import type {UnitPose,UnitTool} from './unit-rig.ts';
import type {MapLayout} from '../../packages/sim/terrain.ts';
import {createTiles,tileAt,groundHeight} from '../../packages/sim/terrain.ts';
import {makeMap} from '../../packages/sim/navigation.ts';
import {walkablePlatforms} from '../../packages/content/footprints.ts';
import type {View} from '../../packages/sim/protocol.ts';
export const brickStyle={studPitch:.5,plateHeight:.16,brickHeight:.32,bevel:.025,roughness:.72,provenance:'original_procedural'} as const;
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
 function staticPart(geo:any,color:string,x:number,y:number,z:number){if(muted)color='#737b72';const key=geo.uuid+color;if(!batches.has(key))batches.set(key,{geo,color,matrices:[]});batches.get(key)!.matrices.push(new T.Matrix4().makeTranslation(x,y+baseHeight,z));}
 function arch(w:number,h:number,d:number){const key=`arch:${w}:${h}:${d}`;if(!geometry.has(key))geometry.set(key,createArchGeometry(T,w,h,d));return geometry.get(key);}
 function brick(x:number,z:number,y:number,w:number,d:number,h:number,color:string,studs=true,shape?:'arch'){staticPart(shape==='arch'?arch(w-.018,h,d-.018):box(w-.018,h,d-.018),color,x+w/2,y,z+d/2);if(studs)for(let a=.25;a<w;a+=.5)for(let b=.25;b<d;b+=.5)staticPart(studGeo,color,x+a,y+h+.04,z+b);}
 function groundBlock(x:number,z:number,height:number,color:string){const h=height+.24,key=`ground:${h}`;if(!geometry.has(key)){const geo=new T.BoxGeometry(1,h,1);geo.translate(0,h/2,0);geometry.set(key,geo);groundGeometries.add(geo);}staticPart(geometry.get(key),color,x+.5,-.24,z+.5);}
 let previewBuildingKind:'house'|EconomicBuilding|MilitaryBuilding='house';
 let previewBuilding:Omit<BuildingVisual,'red'>={ageVariant:2,progress:100,health:100};
 // The model page swaps in the inspected kind; the sandbox draws each obstacle as itself at age 2.
 function house(x:number,z:number,red=false,obstacleKind:'house'|'town-center'='house'){const kind=options.assetPreview?previewBuildingKind:obstacleKind,parts=kind==='house'?buildingParts({...previewBuilding,red}):militaryBuildings.includes(kind as MilitaryBuilding)?militaryBuildingParts(kind as MilitaryBuilding,{...previewBuilding,red}):economicBuildingParts(kind as EconomicBuilding,{...previewBuilding,red});
 for(const p of parts)brick(x+p.x,z+p.z,p.y,p.w,p.d,p.h,p.color,false,p.shape);
 for(const stud of buildingStuds(parts))staticPart(studGeo,stud.color,x+stud.x,stud.y,z+stud.z);}
 function buildWorld(view:View){const seed=view.seed;scene.remove(staticGroup);staticGroup.traverse((o:any)=>{if(o.isInstancedMesh)o.dispose();});staticGroup=new T.Group();scene.add(staticGroup);batches.clear();baseHeight=0;
 const map=options.assetPreview?makeMap(seed,previewLayout):{tiles:view.terrain.map((tile,id)=>({...tile,id,resourceRefs:[],obstacleRefs:[]})),obstacles:view.known.map(k=>k.obstacle),resources:view.resources};worldTiles=map.tiles;platforms=map.obstacles.flatMap(o=>{const p=walkablePlatforms[o.kind];return p?[{x0:o.x+p.rect[0],y0:o.y+p.rect[1],x1:o.x+p.rect[2],y1:o.y+p.rect[3],height:p.height}]:[];});let rng=seed||1;for(const tile of map.tiles){const x=tile.id%16,z=Math.floor(tile.id/16);rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;const n=(rng>>>0)/4294967296;groundBlock(x,z,tile.height/100,!options.assetPreview&&view.fog[tile.id]!==2?(view.fog[tile.id]===1?'#626e64':'#293e38'):tile.terrainType==='cliff'?'#8a8065':tile.terrainType==='stone'?'#a1a28e':tile.terrainType==='highland'?'#879d69':tile.terrainType==='water'?'#4b8291':tile.terrainType==='shallow'?'#86b7b8':tile.terrainType==='sand'?'#d5c598':tile.terrainType==='road'?'#c4b18a':n<.2?'#a6b582':n<.5?'#b5c493':'#becda0');}
 for(const o of map.obstacles){baseHeight=groundHeight(map.tiles,o.x,o.y)/100;muted=!options.assetPreview&&view.fog[tileAt(o.x,o.y)]!==2;const x=o.x/100,z=o.y/100;if(o.kind==='house'||o.kind==='town-center')house(x,z,o.red,o.kind);else if(o.kind==='tree'){brick(x+.15,z+.15,0,.3,.3,.8,'#80664b',false);brick(x-.2,z-.2,.7,1,1,.4,'#67835a');brick(x-.075,z-.075,1.1,.75,.75,.4,'#7e985f');brick(x+.05,z+.05,1.5,.5,.5,.3,'#91a970');}else if(o.kind==='hunt'||o.kind==='livestock'){const color=o.kind==='hunt'?'#99714e':'#e7e2cc';for(const dx of [.1,.45])for(const dz of [.1,.5])brick(x+dx,z+dz,0,.09,.09,.28,'#615643',false);brick(x+.04,z+.06,.25,.54,.55,.35,color,false);brick(x+.16,z+.48,.47,.28,.2,.26,color,false);if(o.kind==='hunt')for(const dx of [.18,.36])brick(x+dx,z+.51,.73,.04,.04,.2,'#715a40',false);}else if(o.kind==='berries'){brick(x+.05,z+.05,0,.55,.55,.45,'#5d824e');for(const dx of [.12,.36])for(const dz of [.12,.36])brick(x+dx,z+dz,.45,.12,.12,.12,'#a84e59',false);}else{brick(x,z,0,.65,.7,.3,o.kind==='gold'?'#b59a48':'#a19f86');brick(x+.15,z+.15,.3,.35,.4,.18,o.kind==='gold'?'#dec36f':'#b8b39c',false);}}
 for(const resource of map.resources??[])if(resource.kind==='fish'&&resource.status==='available'){const x=resource.x/100,z=resource.y/100;baseHeight=groundHeight(map.tiles,resource.x,resource.y)/100;muted=false;for(const offset of [0,.22]){brick(x-.2+offset,z-.1+offset,.025,.25,.1,.05,'#d5e7de',false);brick(x-.27+offset,z-.1+offset,.025,.09,.15,.06,'#bad0ce',false);}}
 baseHeight=0;muted=false;for(const {geo,color,matrices} of batches.values()){const mesh=new T.InstancedMesh(geo,material(color),matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.userData.studs=geo===studGeo;mesh.userData.ground=groundGeometries.has(geo);mesh.castShadow=true;mesh.receiveShadow=true;staticGroup.add(mesh);}
 }
 const units=new Map<number,{group:any;rig:ReturnType<typeof createCharacterRig>;ring:any;player:number;moving:boolean}>();
 const ringGeo=new T.RingGeometry(.4,.47,32);ringGeo.rotateX(-Math.PI/2);geometry.set('ring',ringGeo);const ringMaterial=new T.MeshBasicMaterial({color:'#fff2a1',side:T.DoubleSide});
 function unit(id:number,player:number){const group=new T.Group();scene.add(group);
 const rig=createCharacterRig(T,player,box,material);rig.equip(previewTool);group.add(rig.root);detail.apply(group,zoom);
 const ring=new T.Mesh(ringGeo,ringMaterial);ring.position.y=.025;group.add(ring);units.set(id,{group,rig,ring,player,moving:false});return units.get(id)!;
 }
 let previewRole='villager';
 let previewPose:UnitPose='idle',previewTool:UnitTool='none',previewAnimated=false,poseStart=0;const focus={x:8,y:0,z:8};let worldKey='',angle=Math.PI/4,zoom=1,width=0,height=0,selected=1,latest:View|null=null;
 function cameraUpdate(){if(width<=0||height<=0)return;const aspect=width/Math.max(1,height);const halfH=Math.max(10.5,12/aspect)/zoom;camera.left=-halfH*aspect;camera.right=halfH*aspect;camera.top=halfH;camera.bottom=-halfH;camera.position.set(focus.x+Math.sin(angle)*24,focus.y+24,focus.z+Math.cos(angle)*24);camera.lookAt(focus.x,focus.y,focus.z);camera.updateProjectionMatrix();camera.updateMatrixWorld();detail.apply(scene,zoom);}
 function resize(){const r=canvas.getBoundingClientRect();if(r.width!==width||r.height!==height){width=r.width;height=r.height;renderer.setSize(width,height,false);cameraUpdate();}}
 function update(view:View,id:number){latest=view;selected=id;const key=JSON.stringify([previewBuildingKind,previewBuilding,previewLayout,view.layout,view.seed,view.fog,view.known?.map(k=>k.obstacle),view.resources]);if(worldKey!==key){worldKey=key;buildWorld(view);cameraUpdate();}const alive=new Set(view.units.map(u=>u.id));for(const [key,u] of units)if(!alive.has(key)){scene.remove(u.group);units.delete(key);}
 for(const data of view.units){const u=units.get(data.id)??unit(data.id,data.player);const dx=data.x/100-u.group.position.x,dz=data.y/100-u.group.position.z;if(Math.abs(dx)+Math.abs(dz)>.001)u.group.rotation.y=Math.atan2(dx,dz);u.group.position.set(data.x/100,(groundHeight(worldTiles,data.x,data.y)+standingLift(data.x,data.y))/100,data.y/100);u.ring.visible=data.id===selected;u.moving=data.navigation==='moving';}
 }
 const raycaster=new T.Raycaster(),ground=new T.Plane(new T.Vector3(0,1,0),0);
 function pick(clientX:number,clientY:number):{unitId?:number;x?:number;y?:number}{const r=canvas.getBoundingClientRect();raycaster.setFromCamera(new T.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),camera);
 const hits=detail.withSelectionGeometry(scene,()=>visibleMeshHits(raycaster,[...units.values()].map(u=>u.group)));if(hits.length){let obj=hits[0].object;while(obj.parent&&obj.parent!==scene)obj=obj.parent;for(const [id,u] of units)if(u.group===obj)return {unitId:id};}
 const groundHit=raycaster.intersectObjects(staticGroup.children.filter((mesh:any)=>mesh.userData.ground),false)[0];if(groundHit)return {x:groundHit.point.x,y:groundHit.point.z};return {};}
 function draw(time:number){if(contextLost)return;resize();for(const u of units.values()){const pose=options.assetPreview?previewPose:u.moving?'walk':'idle';u.rig.pose(pose,options.assetPreview?(previewAnimated?time-poseStart:pose==='death'?700:pose==='hit'?150:350):time);u.ring.visible=u.group===units.get(selected)?.group&&pose!=='death';}renderer.render(scene,camera);}
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;canvas.dataset.renderState='context-lost';onFailure(options.assetPreview?'模型繪圖連線中斷，請重新載入模型頁。':'3D 繪圖連線中斷，模擬已暫停；請重新載入頁面後讀取手動存檔。');});
 canvas.dataset.renderer='webgl2';canvas.dataset.renderState='ready';
 return {update,draw,pick,setPreviewBuildingKind:(kind:'house'|EconomicBuilding|MilitaryBuilding)=>{if(!options.assetPreview||(kind!=='house'&&!economicBuildings.includes(kind as EconomicBuilding)&&!militaryBuildings.includes(kind as MilitaryBuilding)))throw Error('未知模型建築');previewBuildingKind=kind;if(latest)update(latest,selected);},setPreviewRole:(role:any)=>{if(!options.assetPreview||(!unitRoles.includes(role)&&role!=='cavalry'))throw Error('僅模型檢視可指定有效軍種');previewRole=role;previewPose='idle';for(const u of units.values()){u.rig.dress(role);u.ring.scale.set(role==='cavalry'?1.8:1,1,role==='cavalry'?1.8:1);detail.apply(u.group,zoom);}},setPreviewBuilding:(visual:Omit<BuildingVisual,'red'>)=>{if(!options.assetPreview)throw Error('僅模型檢視可指定建築外觀');buildingParts({...visual,red:false});previewBuilding={...visual};if(latest)update(latest,selected);},focusPreviewHouse:()=>{if(!options.assetPreview)throw Error('僅模型檢視可聚焦建築');focus.x=4;focus.y=1;focus.z=4.85;zoom=2.5;cameraUpdate();},focusPreviewUnit:(id:number)=>{if(!options.assetPreview)throw Error('僅模型檢視可聚焦代表資產');const u=units.get(id);if(!u)throw Error('找不到人偶');focus.x=u.group.position.x;focus.y=u.group.position.y+.5;focus.z=u.group.position.z;zoom=2.5;cameraUpdate();},setPreviewMotion:(pose:UnitPose,tool:UnitTool,animated:boolean)=>{if(!options.assetPreview)throw Error('僅模型檢視可指定姿態');if((previewRole==='cavalry'&&!['idle','walk','attack'].includes(pose))||!unitPoses.includes(pose)||!unitTools.includes(tool))throw Error('未知模型姿態或工具');previewPose=pose;previewTool=tool;previewAnimated=animated;poseStart=performance.now();for(const u of units.values()){u.rig.equip(tool);detail.apply(u.group,zoom);}},setPreviewLayout:(layout:MapLayout)=>{if(!options.assetPreview)throw Error('僅模型檢視可切換驗收圖');if(!['meadow','coast','acceptance'].includes(layout))throw Error('未知地圖模式');previewLayout=layout;if(latest)update(latest,selected);},zoom:(delta:number)=>{zoom=Math.max(.7,Math.min(2.5,zoom+delta));cameraUpdate();},rotate:()=>{angle+=Math.PI/2;cameraUpdate();},resetCamera:()=>{focus.x=8;focus.y=0;focus.z=8;zoom=1;angle=Math.PI/4;cameraUpdate();},dispose:()=>{renderer.dispose();detail.dispose();for(const geo of geometry.values())geo.dispose();for(const m of materials.values())m.dispose();ringMaterial.dispose();},stats:()=>({detail:detailLevel(zoom),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries})};
}
