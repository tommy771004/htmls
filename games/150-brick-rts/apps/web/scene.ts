import type {MapLayout} from '../../packages/sim/terrain.ts';
import {createTiles,tileAt} from '../../packages/sim/terrain.ts';
import {makeMap} from '../../packages/sim/navigation.ts';
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
 const scene=new T.Scene();const camera=new T.OrthographicCamera(-12,12,10,-10,.1,100);
 const ambient=new T.HemisphereLight('#fff5dc','#819b75',2.4);scene.add(ambient);
 const sun=new T.DirectionalLight('#fff1d8',3);sun.position.set(-4,20,12);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:1,far:60});sun.shadow.normalBias=.03;scene.add(sun);sun.target.position.set(8,0,8);scene.add(sun.target);
 const geometry=new Map<string,any>(),materials=new Map<string,any>();
 function material(color:string){if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:brickStyle.roughness}));return materials.get(color);}
 function box(w:number,h:number,d:number){const key=`${w}:${h}:${d}`;if(geometry.has(key))return geometry.get(key);
 const b=Math.min(brickStyle.bevel,w/8,h/8,d/8);const shape=new T.Shape();shape.moveTo(-w/2+b,-d/2+b);shape.lineTo(w/2-b,-d/2+b);shape.lineTo(w/2-b,d/2-b);shape.lineTo(-w/2+b,d/2-b);shape.closePath();
 const geo=new T.ExtrudeGeometry(shape,{depth:Math.max(.001,h-2*b),bevelEnabled:true,bevelSize:b,bevelThickness:b,bevelSegments:1,steps:1,curveSegments:1});geo.rotateX(-Math.PI/2);geo.translate(0,b,0);geometry.set(key,geo);return geo;}
 const studGeo=new T.CylinderGeometry(.13,.13,.08,10);geometry.set('stud',studGeo);
 let staticGroup=new T.Group();scene.add(staticGroup);const batches=new Map<string,{geo:any;color:string;matrices:any[]}>();
 let muted=false;
 function staticPart(geo:any,color:string,x:number,y:number,z:number){if(muted)color='#737b72';const key=geo.uuid+color;if(!batches.has(key))batches.set(key,{geo,color,matrices:[]});batches.get(key)!.matrices.push(new T.Matrix4().makeTranslation(x,y,z));}
 function brick(x:number,z:number,y:number,w:number,d:number,h:number,color:string,studs=true){staticPart(box(w-.018,h,d-.018),color,x+w/2,y,z+d/2);if(studs)for(let a=.25;a<w;a+=.5)for(let b=.25;b<d;b+=.5)staticPart(studGeo,color,x+a,y+h+.04,z+b);}
 function house(x:number,z:number,red=false){const roof=red?'#b85c47':'#456e87';brick(x-.15,z-.15,0,2.5,2.3,.16,'#b3aa8c',false);
 for(let level=0;level<4;level++)for(let a=0;a<2;a++)for(let b=0;b<2;b++)brick(x+a,z+b,.16+level*.32,1,1,.32,level%2?'#e3cba4':'#ddbc90',false);
 // Exterior door, windows and structural timbers; fixed collision proxy stays in sim.
 brick(x+.75,z+2,.16,.5,.05,.92,'#574b39',false);brick(x+.81,z+2.05,.22,.38,.04,.78,'#796448',false);
 brick(x+.83,z+2.09,.63,.06,.04,.07,'#d8b76c',false);
 for(const dx of [.14,1.44]){brick(x+dx,z+2,.79,.42,.06,.43,'#7b654e',false);brick(x+dx+.055,z+2.065,.85,.31,.025,.31,'#334b4e',false);}
 for(const dx of [0,.97,1.94])brick(x+dx,z+1.99,.16,.06,.06,1.3,'#866b50',false);
 brick(x,z+2.01,1.42,2,.06,.11,'#826a50',false);
 for(let level=0;level<4;level++)for(let row=0;row<5;row++)brick(x-.2+level*.25,z-.2+row*.5,1.53+level*.18,2.5-level*.5,.5,.18,roof);
 brick(x+1.5,z+.25,2.03,.5,.5,.8,'#b9a98b');brick(x+1.48,z+.23,2.83,.54,.54,.1,'#7b7665',false);
 brick(x+.25,z+.25,2.37,.07,.07,.9,'#786849',false);brick(x+.32,z+.25,3,.6,.04,.3,roof,false);
 }
 function buildWorld(view:View){const seed=view.seed;scene.remove(staticGroup);staticGroup.traverse((o:any)=>{if(o.isInstancedMesh)o.dispose();});staticGroup=new T.Group();scene.add(staticGroup);batches.clear();
 const map=options.assetPreview?makeMap(seed,previewLayout):{tiles:createTiles(),obstacles:view.known.map(k=>k.obstacle),resources:view.resources};let rng=seed||1;for(const tile of map.tiles){const x=tile.id%16,z=Math.floor(tile.id/16);rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;const n=(rng>>>0)/4294967296;brick(x,z,-.24,1,1,.24,!options.assetPreview&&view.fog[tile.id]!==2?(view.fog[tile.id]===1?'#626e64':'#293e38'):tile.terrainType==='water'?'#4b8291':tile.terrainType==='shallow'?'#86b7b8':tile.terrainType==='sand'?'#d5c598':tile.terrainType==='road'?'#c4b18a':n<.2?'#a6b582':n<.5?'#b5c493':'#becda0',false);}
 for(const o of map.obstacles){muted=!options.assetPreview&&view.fog[tileAt(o.x,o.y)]!==2;const x=o.x/100,z=o.y/100;if(o.kind==='house')house(x,z,o.red);else if(o.kind==='tree'){brick(x+.15,z+.15,0,.3,.3,.8,'#80664b',false);brick(x-.2,z-.2,.7,1,1,.4,'#67835a');brick(x-.075,z-.075,1.1,.75,.75,.4,'#7e985f');brick(x+.05,z+.05,1.5,.5,.5,.3,'#91a970');}else if(o.kind==='hunt'||o.kind==='livestock'){const color=o.kind==='hunt'?'#99714e':'#e7e2cc';for(const dx of [.1,.45])for(const dz of [.1,.5])brick(x+dx,z+dz,0,.09,.09,.28,'#615643',false);brick(x+.04,z+.06,.25,.54,.55,.35,color,false);brick(x+.16,z+.48,.47,.28,.2,.26,color,false);if(o.kind==='hunt')for(const dx of [.18,.36])brick(x+dx,z+.51,.73,.04,.04,.2,'#715a40',false);}else if(o.kind==='berries'){brick(x+.05,z+.05,0,.55,.55,.45,'#5d824e');for(const dx of [.12,.36])for(const dz of [.12,.36])brick(x+dx,z+dz,.45,.12,.12,.12,'#a84e59',false);}else{brick(x,z,0,.65,.7,.3,o.kind==='gold'?'#b59a48':'#a19f86');brick(x+.15,z+.15,.3,.35,.4,.18,o.kind==='gold'?'#dec36f':'#b8b39c',false);}}
 for(const resource of map.resources??[])if(resource.kind==='fish'&&resource.status==='available'){const x=resource.x/100,z=resource.y/100;muted=false;for(const offset of [0,.22]){brick(x-.2+offset,z-.1+offset,.025,.25,.1,.05,'#d5e7de',false);brick(x-.27+offset,z-.1+offset,.025,.09,.15,.06,'#bad0ce',false);}}
 muted=false;for(const {geo,color,matrices} of batches.values()){const mesh=new T.InstancedMesh(geo,material(color),matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.userData.studs=geo===studGeo;mesh.castShadow=true;mesh.receiveShadow=true;staticGroup.add(mesh);}
 }
 const units=new Map<number,{group:any;left:any;right:any;ring:any;player:number;moving:boolean}>();
 const ringGeo=new T.RingGeometry(.4,.47,32);ringGeo.rotateX(-Math.PI/2);geometry.set('ring',ringGeo);const ringMaterial=new T.MeshBasicMaterial({color:'#fff2a1',side:T.DoubleSide});
 function unit(id:number,player:number){const group=new T.Group();scene.add(group);
 const part=(parent:any,x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>{const m=new T.Mesh(box(w,h,d),material(color));m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};
 const left=new T.Group(),right=new T.Group();left.position.set(-.12,.3,0);right.position.set(.12,.3,0);group.add(left,right);part(left,0,-.3,0,.19,.3,.24,'#44514b');part(right,0,-.3,0,.19,.3,.24,'#44514b');
 part(group,0,.3,0,.46,.4,.32,player===0?'#45728c':'#b25441');part(group,0,.71,0,.34,.3,.3,'#dfbb7e');part(group,0,1.02,0,.44,.11,.4,player===0?'#cbbc94':'#835243');
 for(const dx of [-.19,.19]){part(group,dx,.39,0,.1,.28,.16,player===0?'#45728c':'#b25441');part(group,dx,.29,0,.1,.14,.17,'#dfbb7e');}
 for(const dx of [-.075,.075])part(group,dx,.86,.155,.035,.04,.018,'#3e3a2e');
 const ring=new T.Mesh(ringGeo,ringMaterial);ring.position.y=.025;group.add(ring);units.set(id,{group,left,right,ring,player,moving:false});return units.get(id)!;
 }
 let worldKey='',angle=Math.PI/4,zoom=1,width=0,height=0,selected=1,latest:View|null=null;
 function cameraUpdate(){if(width<=0||height<=0)return;const aspect=width/Math.max(1,height);const halfH=Math.max(10.5,12/aspect)/zoom;camera.left=-halfH*aspect;camera.right=halfH*aspect;camera.top=halfH;camera.bottom=-halfH;camera.position.set(8+Math.sin(angle)*24,24,8+Math.cos(angle)*24);camera.lookAt(8,0,8);camera.updateProjectionMatrix();camera.updateMatrixWorld();for(const mesh of staticGroup.children)mesh.visible=!mesh.userData.studs||zoom>=.9;}
 function resize(){const r=canvas.getBoundingClientRect();if(r.width!==width||r.height!==height){width=r.width;height=r.height;renderer.setSize(width,height,false);cameraUpdate();}}
 function update(view:View,id:number){latest=view;selected=id;const key=JSON.stringify([previewLayout,view.seed,view.fog,view.known?.map(k=>k.obstacle),view.resources]);if(worldKey!==key){worldKey=key;buildWorld(view);cameraUpdate();}const alive=new Set(view.units.map(u=>u.id));for(const [key,u] of units)if(!alive.has(key)){scene.remove(u.group);units.delete(key);}
 for(const data of view.units){const u=units.get(data.id)??unit(data.id,data.player);const dx=data.x/100-u.group.position.x,dz=data.y/100-u.group.position.z;if(Math.abs(dx)+Math.abs(dz)>.001)u.group.rotation.y=Math.atan2(dx,dz);u.group.position.set(data.x/100,0,data.y/100);u.ring.visible=data.id===selected;u.moving=data.navigation==='moving';}
 }
 const raycaster=new T.Raycaster(),ground=new T.Plane(new T.Vector3(0,1,0),0);
 function pick(clientX:number,clientY:number):{unitId?:number;x?:number;y?:number}{const r=canvas.getBoundingClientRect();raycaster.setFromCamera(new T.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),camera);
 const hits=raycaster.intersectObjects([...units.values()].map(u=>u.group),true);if(hits.length){let obj=hits[0].object;while(obj.parent&&obj.parent!==scene)obj=obj.parent;for(const [id,u] of units)if(u.group===obj)return {unitId:id};}
 const p=new T.Vector3();if(raycaster.ray.intersectPlane(ground,p))return {x:p.x,y:p.z};return {};}
 function draw(time:number){if(contextLost)return;resize();for(const u of units.values()){const swing=u.moving?Math.sin(time*.012)*.35:0;u.left.rotation.x=swing;u.right.rotation.x=-swing;}renderer.render(scene,camera);}
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;onFailure('3D 繪圖連線中斷，模擬已暫停；請重新載入頁面後讀取手動存檔。');});
 canvas.dataset.renderer='webgl2';
 return {update,draw,pick,setPreviewLayout:(layout:MapLayout)=>{if(!options.assetPreview)throw Error('僅模型檢視可切換驗收圖');if(!['meadow','coast','acceptance'].includes(layout))throw Error('未知地圖模式');previewLayout=layout;if(latest)update(latest,selected);},zoom:(delta:number)=>{zoom=Math.max(.7,Math.min(2.5,zoom+delta));cameraUpdate();},rotate:()=>{angle+=Math.PI/2;cameraUpdate();},resetCamera:()=>{zoom=1;angle=Math.PI/4;cameraUpdate();},dispose:()=>{renderer.dispose();for(const geo of geometry.values())geo.dispose();for(const m of materials.values())m.dispose();ringMaterial.dispose();},stats:()=>({drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries})};
}
