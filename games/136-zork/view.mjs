import * as THREE from 'three';
import {createGame,SAVE_KEY,DIRS,NAMES,FIXED,SAFE} from './engine.mjs';
const WORLD=JSON.parse(document.getElementById('world-data').textContent);
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const canvas=$('#world'),modal=$('#modal'),content=$('#modalContent'),mobile=matchMedia('(pointer:coarse)').matches,reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
let stored=null,saveError=false;
try{stored=JSON.parse(localStorage.getItem(SAVE_KEY))}catch{saveError=true}
const game=createGame(WORLD,stored);
let renderer,scene,camera,chunk,hemi,sun,lanternLight,heldMaterials=[],roomLights=[],lantern,knife,colliders=[],targets=[],actors=[],animated=[],textures=[],started=false,paused=true,transitioning=false,keys={},target=null,swing=0,cooldown=0,invincible=0,darkTime=0,seenRevision=-1,toastTime=0,clockTime=0,saveTime=0,walkPhase=0,contextLost=false;
let positions={},seed=1;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const palette={},geos={};const vec=new THREE.Vector3(),matrix=new THREE.Matrix4(),dummy=new THREE.Object3D();
const outdoor=new Set(['WHOUS','NHOUS','SHOUS','EHOUS','FORE1','FORE2','FORE3','CLEAR']);
const roomNames={WHOUS:'白屋西側',NHOUS:'白屋北側',SHOUS:'白屋南側',EHOUS:'白屋後方',KITCH:'廚房',LROOM:'起居室',ATTIC:'閣樓',CELLA:'地窖',MTROL:'巨魔之室',STUDI:'畫室',GALLE:'畫廊',DOME:'穹頂',MTORC:'火炬之室',CAROU:'旋轉圓室',EGYPT:'埃及墓室',ICY:'冰川之室',RUBYR:'紅寶石室',RESES:'水庫南岸',RESEN:'水庫北岸',ATLAN:'沉沒的亞特蘭提斯',STREA:'地下溪流','DAM-R':'三號防洪壩',LOBBY:'水壩大廳',MAINT:'維修室',ECHO:'喧響之室',RIDDL:'謎語之門',MPEAR:'珍珠室',MGRAI:'聖杯室',TEMP1:'神殿',TEMP2:'祭壇',LLD1:'冥界入口',LLD2:'亡者之境',MIRR1:'鏡之室',MIRR2:'鏡之室','CYCLO-R':'獨眼巨人之室','TREAS-R':'寶物室',BLROO:'奇異通道',CLEAR:'林間空地'};
const dynamicText={EHOUS:'You are behind the white house. In one corner of the house there is a small window which is slightly ajar.',KITCH:'A table seems to have been used recently for the preparation of food. A passage leads to the west and a dark staircase can be seen leading upward.',LROOM:'There is a door to the east, a wooden door with strange gothic lettering to the west, and a large oriental rug in the center of the room.',CELLA:'You are in a dark and damp cellar with a narrow passageway leading east, and a crawlway to the south.',DOME:'A wooden railing circles the dome. Below, the darkness drops twenty feet.',ICY:'Giant icicles hang from the walls and ceiling. A mass of ice fills the western half of the room.',MTORC:'In the center of this room there is a white marble pedestal.',RESES:'The reservoir fills this cavern. The far shore is beyond your reach.',RESEN:'The reservoir stretches southward, dark and still.',MIRR1:'There is a large mirror here.',MIRR2:'There is a large mirror here.',LLD1:'Abandon every hope, all ye who enter here. The way is barred by evil spirits.','CYCLO-R':'A cyclops blocks the staircase. He is not very friendly, though he likes people.','DAM-R':'You are standing on the top of Flood Control Dam #3.',CLEAR:'You are in a clearing, with a forest surrounding you on the west and south.'};
const getText=()=>game.rooms[game.s.room].text||dynamicText[game.s.room]||'The empire is silent.';
function mat(name,color,extra={}){return palette[name]||(palette[name]=new THREE.MeshStandardMaterial({color,roughness:.92,...extra}))}
function mesh(geo,m,x=0,y=0,z=0,parent=chunk){const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
function box(m,x,y,z,sx,sy,sz,parent=chunk){const o=mesh(geos.box,m,x,y,z,parent);o.scale.set(sx,sy,sz);return o}
function cyl(m,x,y,z,sx,sy,sz,parent=chunk){const o=mesh(geos.cylinder,m,x,y,z,parent);o.scale.set(sx,sy,sz);return o}
function ball(m,x,y,z,sx,sy,sz,parent=chunk){const o=mesh(geos.sphere,m,x,y,z,parent);o.scale.set(sx,sy,sz);return o}
function rock(m,x,y,z,sx,sy,sz,parent=chunk){const o=mesh(geos.rock,m,x,y,z,parent);o.scale.set(sx,sy,sz);o.rotation.set(rand()*.4,rand()*6,rand()*.4);return o}
function collision(x,z,r){colliders.push({x,z,r})}
function blocked(x,z,pad=.38){if(Math.hypot(x,z)>20)return true;if(started&&!outdoor.has(game.s.room)){for(let i=0;i<8;i++){const a=i*Math.PI/4;if(x*Math.sin(a)-z*Math.cos(a)>15.25-pad)return true;}}return colliders.some(c=>c.box?Math.abs(x-c.x)<c.sx/2+pad&&Math.abs(z-c.z)<c.sz/2+pad:Math.hypot(x-c.x,z-c.z)<c.r+pad)}
function los(x,z,xx,zz){const d=Math.hypot(xx-x,zz-z),n=Math.ceil(d/.4);for(let i=1;i<n;i++){const t=i/n;if(blocked(x+(xx-x)*t,z+(zz-z)*t,0))return false}return true}
function sign(text,x,y,z,rot=0,size=1.4){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#958972';ctx.font='32px Georgia';ctx.textAlign='center';ctx.fillText(text,256,73);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;textures.push(t);const m=new THREE.MeshStandardMaterial({map:t,transparent:true,roughness:1,side:THREE.DoubleSide,depthWrite:false});const o=mesh(new THREE.PlaneGeometry(size,size/4),m,x,y,z);o.rotation.y=rot;return o}
function foliage(){
 const count=mobile?1100:2600,grass=new THREE.InstancedMesh(geos.blade,mat('grass',0x596747,{side:THREE.DoubleSide}),count);
 for(let i=0;i<count;i++){let x=(rand()-.5)*49,z=(rand()-.5)*49;if(Math.abs(x)<1.5||Math.abs(z)<1.5){x+=2.5;z+=2.5}dummy.position.set(x,0,z);dummy.rotation.set(0,rand()*6.28,0);const s=.3+rand()*.75;dummy.scale.set(s,.3+rand()*.8,s);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);grass.setColorAt(i,new THREE.Color().setHSL(.22+rand()*.05,.2+rand()*.2,.18+rand()*.1));}chunk.add(grass);
 const fernCount=mobile?500:1100,fern=new THREE.InstancedMesh(geos.leaf,mat('fern',0x60764e,{side:THREE.DoubleSide}),fernCount);for(let i=0;i<fernCount;i++){const plant=Math.floor(i/10),base=plant*1.73,ang=(i%10)*.63;const x=Math.sin(base*8.1)*18,z=Math.cos(base*5.9)*18;dummy.position.set(x+Math.cos(ang)*.25,.18+(i%5)*.035,z+Math.sin(ang)*.25);dummy.rotation.set(-.7,ang,0);dummy.scale.set(.12,.65,.5);dummy.updateMatrix();fern.setMatrixAt(i,dummy.matrix)}chunk.add(fern);
}
function forest(){
 box(mat('forestground',0x333d27),0,-.15,0,65,.3,65);foliage();
 const n=mobile?110:190,trunks=new THREE.InstancedMesh(geos.cylinder,mat('bark',0x34372c),n),leaves=new THREE.InstancedMesh(geos.sphere,mat('canopy',0x374734),n*2);
 for(let i=0;i<n;i++){const a=rand()*6.283,r=13+rand()*24,x=Math.cos(a)*r,z=Math.sin(a)*r,h=9+rand()*15;dummy.position.set(x,h/2,z);dummy.scale.set(.35+rand()*.5,h,.4+rand()*.5);dummy.rotation.set(.03-rand()*.06,rand()*6,.03-rand()*.06);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);if(r<20)collision(x,z,.65);for(let j=0;j<2;j++){dummy.position.set(x+(rand()-.5)*2,h*.78+j*3,z);dummy.scale.set(4+rand()*2,2.5+rand()*2,4+rand()*2);dummy.rotation.set(0,rand()*6,0);dummy.updateMatrix();leaves.setMatrixAt(i*2+j,dummy.matrix)}}chunk.add(trunks,leaves);
 for(let i=0;i<20;i++){const a=rand()*6.2,r=13+rand()*9;rock(mat('moss',0x4e5942),Math.sin(a)*r,.3,Math.cos(a)*r,1+rand(),.5+rand(),1+rand())}
 // Procedural light shafts: additive, view-faded cone volumes through the canopy.
 const beamMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,uniforms:{t:{value:0}},vertexShader:'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(position,1.0);vN=normalize(normalMatrix*normal);vV=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec2 vUv;varying vec3 vN;varying vec3 vV;uniform float t;void main(){float f=pow(abs(dot(normalize(vN),normalize(vV))),1.4);float noise=.75+.25*sin(vUv.y*47.+vUv.x*61.+t*.2);float a=sin(vUv.y*3.14159)*.045*f*noise;gl_FragColor=vec4(.65,.73,.43,a);}'});
 for(let i=0;i<8;i++){const o=mesh(new THREE.CylinderGeometry(.1,2.8,22,12,1,true),beamMaterial,3+i*3,8,-12+i*2);o.rotation.z=-.35;o.rotation.x=.2;animated.push({kind:'beam',mesh:o})}
 if(['WHOUS','NHOUS','SHOUS','EHOUS'].includes(game.s.room)||!started)house();
}
function house(){
 let x=6,z=-5;if(game.s.room==='EHOUS')x=-8;
 const white=mat('whitewood',0xb7b4a0),dark=mat('timber',0x403e30),roof=mat('roof',0x4c5041);
 box(white,x,2.4,z,8,4.8,6);colliders.push({box:true,x,z,sx:8,sz:6});
 for(let i=0;i<16;i++)box(mat('seams',0x868b77),x,.3+i*.28,z+3.02,8,.035,.03);
 const roofMesh=mesh(geos.roof,roof,x,4.8,z);roofMesh.scale.set(8.8,2.5,6.8);
 box(dark,x,1.55,z+3.06,1.65,3.1,.16);
 for(let i=0;i<3;i++){const plank=box(mat('plank',0x77705a),x,1+i*.6,z+3.17,2.1,.22,.12);plank.rotation.z=i%2?.16:-.12}
 for(const ox of [-2.65,2.65]){box(dark,x+ox,2.6,z+3.04,1.45,1.5,.1);box(mat('windowglass',0x526659,{metalness:.2,roughness:.25}),x+ox,2.6,z+3.11,1.2,1.22,.02);box(white,x+ox,2.6,z+3.14,.08,1.25,.1);box(white,x+ox,2.6,z+3.14,1.2,.08,.1)}
 box(dark,x+2,6,z-.9,.9,4,.9);for(let i=0;i<8;i++)box(white,x-4.1,.28+i*.23,z+1,0.12,.08,4);
}
function dungeon(){
 const id=game.s.room,wood=['KITCH','LROOM','ATTIC'].includes(id),stone=mat('stone',0x4f5149),dark=mat('deepstone',0x333d37),woodmat=mat('floorwood',0x5e4e35);
 box(wood?woodmat:stone,0,-.25,0,42,.5,42);
 if(!wood)for(let i=-6;i<=6;i++){box(mat('floorjoint',0x292f2b),i*2.2,.005,0,.018,.01,30);box(mat('floorjoint',0x292f2b),0,.006,i*2.2,30,.01,.018);}
 for(let i=0;i<8;i++){const a=i*Math.PI/4,x=Math.sin(a)*16,z=-Math.cos(a)*16;const wall=box(wood?mat('plaster',0x989080):dark,x,4,z,13.8,8,1.5);wall.rotation.y=-a;
  for(let j=0;j<5;j++){const b=box(wood?woodmat:stone,x+Math.cos(a)*(j-2)*2.65,1+(j%2)*1.9,z+Math.sin(a)*(j-2)*2.65,2.5,1.5,.25);b.rotation.y=-a;}
 }
 box(dark,0,8.4,0,40,.5,40);
 for(const x of [-10,10])for(const z of [-7,7]){cyl(stone,x,3.3,z,.65,6.6,.65);cyl(stone,x,6.7,z,1,.35,1);collision(x,z,.7)}
 if(wood){for(let i=0;i<20;i++)box(mat('woodseam',0x342f21),(i-10)*1.8,.013,0,.025,.025,30);box(woodmat,4,.95,2,3,.2,1.5);for(const x of [2.8,5.2])for(const z of [1.5,2.5])box(woodmat,x,.5,z,.12,1,.12);colliders.push({box:true,x:4,z:2,sx:3,sz:1.5});}
 if(['RESES','RESEN','STREA','DAM-R','CANY1'].includes(id)){const water=box(mat('water',0x1b3c39,{roughness:.23,metalness:.4,transparent:true,opacity:.86}),0,game.flag('LOW-TIDE')?-.12:.03,-6,22,.035,6);animated.push({kind:'water',mesh:water});for(let i=0;i<9;i++)box(stone,-12+i*3,.07,-2.8,2.8,.15,1);}
 if(id==='ICY'&&!game.flag('GLACIER-FLAG')){for(let i=0;i<9;i++)rock(mat('ice',0x8cb4ad,{roughness:.18,metalness:.25}),-10,2.8,-5+i,2,4+rand()*2,1.2)}
 if(['TEMP1','TEMP2','MGRAI','LLD1','LLD2','EGYPT'].includes(id)){for(const x of [-7,7])for(const z of [-9,-1,7]){cyl(mat('limestone',0x8a846f),x,3.3,z,.65,6.6,.65);box(stone,x,6.5,z,1.6,.45,1.6);collision(x,z,.65)}box(stone,0,.3,-7,5,.6,3)}
 if(id==='DOME'){const rim=mesh(new THREE.TorusGeometry(7,.16,6,48),mat('rail',0x807052),0,1.1,0);rim.rotation.x=Math.PI/2;for(let i=0;i<20;i++){const a=i/20*Math.PI*2;cyl(mat('rail',0x807052),Math.sin(a)*7,.6,Math.cos(a)*7,.08,1.2,.08)}}
 if(id==='CAROU'){const disc=cyl(mat('bronzefloor',0x625f40,{metalness:.5}),0,.05,0,8,.12,8);animated.push({kind:'turn',mesh:disc})}
 if(id.startsWith('MAZ')||id.startsWith('DEAD'))for(let i=0;i<8;i++){const a=rand()*6.28,r=11+rand()*2;rock(stone,Math.sin(a)*r,.5,Math.cos(a)*r,.4+rand(),1+rand(),.7)}
}
const directions={NORTH:[0,-13],SOUTH:[0,13],EAST:[13,0],WEST:[-13,0],NE:[9.2,-9.2],NW:[-9.2,-9.2],SE:[9.2,9.2],SW:[-9.2,9.2],UP:[-4,9],DOWN:[4,9],OUT:[-7,-4],ENTER:[7,-4],EXIT:[-7,4],CLIMB:[4,9],CROSS:[0,-13]};
function portals(){
 const seen=new Set();
 for(const [dir,e] of Object.entries(game.rooms[game.s.room].exits)){
  const same=e.to+'|'+e.flag;if(seen.has(same))continue;seen.add(same);
  let [x,z]=directions[dir];if(game.s.room==='EHOUS'&&e.to==='KITCH'){x=-3;z=-3}
  const rot=Math.atan2(-x,-z),g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;chunk.add(g);
  const m=mat('doorstone',outdoor.has(game.s.room)?0x677553:0x76705c);
  box(m,-1.35,1.5,0,.35,3,.5,g);box(m,1.35,1.5,0,.35,3,.5,g);box(m,0,3.1,0,3,.4,.5,g);
  if(!outdoor.has(game.s.room)){box(mat('portalblack',0x020504),0,1.5,-.4,2.4,3,.08,g);if(['UP','DOWN','CLIMB'].includes(dir))for(let i=0;i<5;i++)box(m,0,i*.12,-i*.25,2.2,.12,.4,g);}
  const label=(DIRS[dir]||dir)+' / '+dir;sign(label,x,3.5,z,rot,2.1);
  targets.push({id:'exit:'+dir,x,z,y:1.5,exit:dir,name:label,text:game.s.visited.includes(e.to)?game.rooms[e.to].name:'一條尚未走過的通道。'});
 }
}
function itemModel(id,parent=chunk){
 const g=new THREE.Group();parent.add(g);const gold=mat('gold',0xbd9651,{metalness:.72,roughness:.35}),iron=mat('iron',0x758477,{metalness:.65,roughness:.4}),wood=mat('itemwood',0x675137),paper=mat('paper',0xb6ae90);
 if(id==='LAMP'){
  cyl(gold,0,.08,0,.25,.12,.25,g);cyl(gold,0,.6,0,.27,.1,.27,g);
  for(let i=0;i<4;i++){const a=i*Math.PI/2;cyl(gold,Math.sin(a)*.19,.34,Math.cos(a)*.19,.025,.48,.025,g)}
  ball(mat('glass',0xcbb881,{transparent:true,opacity:.35,roughness:.2}),0,.34,0,.18,.25,.18,g);
  const flame=ball(mat('lampflame',0xffd684,{emissive:0xe98922,emissiveIntensity:1.2}),0,.33,0,.06,.14,.06,g);g.userData.flame=flame;
  const handle=mesh(new THREE.TorusGeometry(.19,.023,5,12,Math.PI),gold,0,.66,0,g);handle.rotation.z=0;
 }else if(id==='KNIFE'||id==='TRIDE'){box(wood,0,.16,0,.09,.32,.08,g);box(iron,0,.35,0,.3,.04,.05,g);const blade=mesh(geos.cone,iron,0,.67,0,g);blade.scale.set(.095,.65,.025);if(id==='TRIDE'){blade.scale.y=1.2;for(const x of [-.2,.2])box(gold,x,.94,0,.06,.4,.06,g)}}
 else if(['TORCH','CANDL'].includes(id)){cyl(id==='TORCH'?gold:paper,0,.4,0,.08,.8,.08,g);ball(mat('fire',0xffbf63,{emissive:0xff8a28,emissiveIntensity:.8}),0,.96,0,.12,.22,.12,g);}
 else if(id==='RUBY'||id==='PEARL'){for(let i=0;i<(id==='RUBY'?1:12);i++){const a=i/12*Math.PI*2;rock(id==='RUBY'?mat('ruby',0x921e20,{metalness:.3,roughness:.2}):paper,Math.sin(a)*.23,.2,Math.cos(a)*.23,.13,.15,.13,g)}}
 else if(['GRAIL','CHALI','BELL'].includes(id)){cyl(gold,0,.06,0,.23,.08,.23,g);cyl(gold,0,.24,0,.045,.3,.045,g);const cup=mesh(geos.cone,gold,0,.5,0,g);cup.rotation.z=Math.PI;cup.scale.set(.3,.4,.3);}
 else if(id==='ROPE'){for(let i=0;i<4;i++){const o=mesh(geos.torus,mat('rope',0xa59769),0,.04+i*.04,0,g);o.rotation.x=Math.PI/2;o.scale.setScalar(.5-i*.05)}}
 else if(id==='PAINT'){box(gold,0,.55,0,1.5,1.1,.1,g);box(mat('painting',0x566f51),0,.55,.065,1.28,.87,.02,g);for(let i=0;i<7;i++)box(mat('paintgold',0xaaa879),-.5+i*.17,.3+rand()*.35,.08,.1,.3+rand()*.3,.015,g)}
 else if(['BOOK','GUIDE','MATCH'].includes(id)){box(id==='BOOK'?mat('book',0x252522):wood,0,.14,0,.48,.15,.34,g);box(paper,0,.16,.02,.44,.08,.33,g);}
 else if(id==='BOTTL'){cyl(mat('bottleglass',0x6e927b,{transparent:true,opacity:.7,roughness:.2}),0,.24,0,.13,.45,.13,g);cyl(wood,0,.53,0,.07,.14,.07,g);}
 else if(id==='COFFI'){box(gold,0,.27,0,1.8,.5,.72,g);box(mat('coffindetail',0x404e49),0,.535,0,1.3,.035,.12,g);}
 else if(['TRUNK','TROPH'].includes(id)){box(wood,0,.4,0,id==='TROPH'?2:1,.8,.65,g);box(gold,0,.45,.34,.12,.24,.04,g);if(id==='TROPH'){box(wood,0,1.4,0,2,.12,.65,g);for(const x of [-.95,.95])box(wood,x,1,0,.1,.8,.6,g)}}
 else if(['SCREW','WRENC','KEYS'].includes(id)){box(iron,0,.25,0,.08,.48,.08,g);const o=mesh(geos.torus,iron,0,.55,0,g);o.scale.setScalar(.19);}
 else if(id==='REFLE'){box(gold,0,1.4,0,2.1,2.8,.2,g);box(mat('mirror',0x8faaa2,{metalness:1,roughness:.1}),0,1.4,.12,1.85,2.5,.02,g);}
 else if(['RUG','DOOR','PILE','GRATE'].includes(id)){box(id==='RUG'?mat('rug',0x855642):id==='PILE'?mat('leaves',0x60603d):wood,0,.035,0,2.4,.07,1.7,g);if(id==='GRATE')for(let i=0;i<8;i++)box(iron,-1+i*.28,.09,0,.06,.1,1.6,g);}
 else if(['RIDDLE','INSCRIPTION','ALTAR','VOICE','GHOST','RAIL','WINDO'].includes(id)){box(id==='RAIL'?wood:mat('carvedstone',0x777865),0,.75,0,1.8,1.5,.4,g);for(let i=0;i<5;i++)box(gold,0,.4+i*.18,.215,1.2,.025,.015,g);}
 else if(id==='BUTTO'){box(iron,0,.8,0,2,1.4,.3,g);['red','brown','yellow','blue'].forEach((c,i)=>ball(mat('button'+c,{red:0x9c3527,brown:0x695039,yellow:0xc0a541,blue:0x346779}[c]),-.65+i*.44,.8,.21,.14,.14,.08,g));}
 else if(id==='DAM'){cyl(iron,0,1,0,.12,2,.12,g);const wheel=mesh(geos.torus,gold,0,1.5,.2,g);wheel.scale.setScalar(.65);}
 else if(id==='ICE'){rock(mat('icetarget',0xa7c9c0,{roughness:.2}),0,1,0,.7,1.5,.5,g);}
 else if(id==='BONES'){for(let i=0;i<6;i++){const b=box(paper,(i-3)*.12,.1,0,.055,.09,.5,g);b.rotation.y=.4}ball(paper,0,.18,.5,.23,.22,.24,g);}
 else if(id==='LEAK'){cyl(iron,0,.7,0,.2,1.4,.2,g);}
 else{const bag=ball(id==='FOOD'?wood:gold,0,.25,0,.3,.28,.23,g);bag.rotation.z=.2}
 return g;
}
function props(){
 const ids=game.available().filter(id=>!['TROLL','THIEF','CYCLO'].includes(id));
 const pool=Object.keys(game.objects).filter(id=>game.objects[id].initial===game.s.room);for(const id of ['RAIL','RIDDLE','VOICE','ALTAR','INSCRIPTION','REFLE','GRATE'])if(ids.includes(id)&&!pool.includes(id))pool.push(id);ids.forEach(id=>{let i=pool.indexOf(id),r=5.5;if(i<0){i=[...id].reduce((n,c)=>n+c.charCodeAt(0),0)%17;r=3.5;}let a=-Math.PI*.8+i/(Math.max(4,i>=pool.length?17:pool.length))*Math.PI*2,x=Math.sin(a)*r,z=Math.cos(a)*r;
  if(id==='WINDO'){x=-3;z=-4}if(id==='RUG'||id==='DOOR'){x=0;z=-3;if(id==='DOOR')z=-5}
  if(id==='RAIL'){x=0;z=-6}if(id==='TROPH'){x=-5;z=-5}if(id==='LAMP'&&game.s.room==='LROOM'){x=-4;z=-4}
  if(id==='GRATE'){x=5;z=4}if(id==='ICE'){x=-9;z=0}if(id==='VOICE'){x=0;z=-4}
  const g=itemModel(id);g.position.set(x,0,z);positions[id]=[x,z];targets.push({id,x,z,y:id==='RUG'||id==='DOOR'||id==='PILE'||id==='GRATE'?.15:.9,name:NAMES[id]||id,text:game.objects[id]?.text||''});
  if(game.s.lights[id]&&game.s.locations[id]===game.s.room){const l=new THREE.PointLight(0xffc57d,28,10,1.5);l.position.set(x,1.1,z);chunk.add(l);roomLights.push(l)}
 });
 for(const id of game.available().filter(id=>['TROLL','THIEF','CYCLO'].includes(id)))makeActor(id);
}
function makeActor(id){
 const g=new THREE.Group();chunk.add(g);let scale=id==='CYCLO'?1.65:id==='TROLL'?1.2:1;const skin=mat('skin'+id,id==='THIEF'?0x343a30:id==='TROLL'?0x62734e:0x8c7d5b),cloth=mat('cloth',0x302e26);
 const body=box(skin,0,1.05,0,.75,.95,.45,g);ball(skin,0,1.83,0,.37,.4,.34,g);
 const limbs=[];for(const s of [-1,1]){limbs.push(box(cloth,s*.22,.42,0,.23,.85,.28,g));limbs.push(box(skin,s*.55,1.1,0,.2,.9,.24,g))}
 if(id==='THIEF'){const hood=mesh(geos.cone,cloth,0,2,0,g);hood.scale.set(.45,.7,.45);const cape=mesh(geos.cone,cloth,0,1,0,g);cape.scale.set(.65,1.65,.45)}
 const eyes=id==='CYCLO'?[0]:[-.12,.12];for(const x of eyes)ball(mat('eyes',0xc7bc89),x,1.88,.32,.065,.055,.04,g);
 if(id==='TROLL'){box(mat('axe',0x7d8275,{metalness:.4}),.75,1,.2,.12,1.5,.12,g);box(mat('axeblade',0x89938a,{metalness:.5}),.85,1.65,.2,.65,.4,.08,g)}
 g.scale.setScalar(scale);g.position.set(id==='CYCLO'?0:1,0,-5);
 const a={id,mesh:g,limbs,x:g.position.x,z:g.position.z,hp:game.s.enemyHP[id]||999,mode:'patrol',time:0,phase:rand()*6,point:0,last:[0,0],lost:0,wind:0,attackCD:1,stealCD:8};actors.push(a);targets.push({id,x:a.x,z:a.z,y:1.4,name:NAMES[id],text:id==='TROLL'?'A nasty-looking troll, brandishing a bloody axe.':id==='CYCLO'?'He is not very friendly, though he likes people.':'A furtive figure watches your possessions.',actor:a});
}
function disposeChunk(){
 if(!chunk)return;const gs=new Set(),ms=new Set();chunk.traverse(o=>{if(o.geometry&&!Object.values(geos).includes(o.geometry))gs.add(o.geometry);const mats=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];for(const m of mats)if(!Object.values(palette).includes(m))ms.add(m)});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());scene.remove(chunk);textures=[];
}
function buildRoom(){
 disposeChunk();chunk=new THREE.Group();scene.add(chunk);colliders=[];targets=[];actors=[];animated=[];roomLights=[];positions={};seed=[...game.s.room].reduce((n,c)=>n*31+c.charCodeAt(0),7)>>>0;
 const out=outdoor.has(game.s.room),isLit=game.rooms[game.s.room].lit;
 scene.background=new THREE.Color(out?0x738277:0x020302);scene.fog=new THREE.FogExp2(out?0x738277:0x020302,out?.035:.052);
 hemi.intensity=out?1.25:isLit?.48:0;sun.intensity=out?2.4:0;sun.visible=out;
 if(out)forest();else dungeon();portals();props();
 $('#roomname').textContent=roomNames[game.s.room]||game.rooms[game.s.room].name;
 $('#chapter').textContent=out?'ABOVE THE EMPIRE':SAFE.has(game.s.room)?'SANCTUARY · 安全點':'THE GREAT UNDERGROUND EMPIRE';
 camera.position.set(game.s.pos[0],1.7,game.s.pos[1]);camera.rotation.set(game.s.pitch,game.s.yaw,0,'YXZ');updateHUD();renderer.render(scene,camera);
}
function save(){try{localStorage.setItem(SAVE_KEY,game.serialize());$('#saveStatus').textContent='已存於此瀏覽器'}catch{$('#saveStatus').textContent='存檔不可用：瀏覽器儲存空間受限'}saveTime=0;}
function toast(text){$('#toast').textContent=text;toastTime=9}
function updateHUD(){
 $('#health').value=game.s.hp;$('#healthValue').textContent=Math.ceil(game.s.hp);$('#stamina').value=game.s.stamina;$('#score').innerHTML=game.score()+' <small>/ 285</small>';$('#treasures').textContent=game.s.deposited.length+' / 11 寶物';
 $('#lampStatus').textContent=game.has('LAMP')?(game.s.lights.LAMP?'L  提燈亮著':'L  提燈已熄滅'):'在白屋裡尋找提燈';
 lantern.visible=game.has('LAMP');knife.visible=game.has('KNIFE');lantern.userData.flame.visible=!!game.s.lights.LAMP;
}
function afterAction(oldRoom,oldHP){if(game.s.room!==oldRoom){transition();}else{const p=[...game.s.pos],yaw=game.s.yaw;buildRoom();game.s.pos=p;game.s.yaw=yaw;camera.position.set(p[0],1.7,p[1]);}toast(game.message);seenRevision=game.revision;updateHUD();save();if(game.s.won)ending();}
function transition(){transitioning=true;keys={};$('#veil').style.opacity=1;setTimeout(()=>{buildRoom();$('#veil').style.opacity=0;transitioning=false;save();},140);}
function act(verb,id,arg){const old=game.s.room;game.act(verb,id,arg);afterAction(old);}
function show(html){paused=true;keys={};document.exitPointerLock?.();content.innerHTML=html;if(!modal.open)modal.showModal();}
function resume(){modal.close();if(!started)return;paused=false;keys={};if(!mobile)canvas.requestPointerLock?.()?.catch?.(()=>toast('滑鼠鎖定未獲允許。按住畫面拖曳環顧，或使用方向鍵。'));canvas.focus();}
function button(label,verb,id,arg=''){return '<button class="action" data-act="'+verb+'" data-id="'+id+'" data-arg="'+esc(arg)+'">'+label+'</button>'}
function choices(t){
 if(t.exit){const old=game.s.room;game.move(t.exit);if(old!==game.s.room)transition();toast(game.message);updateHUD();save();return;}
 const id=t.id;let html='<div class="eyebrow">EXAMINE / '+esc(game.rooms[game.s.room].name)+'</div><h2>'+esc(t.name)+'</h2><p class="original">'+esc(t.text||getText())+'</p>';
 if(!FIXED.has(id)&&game.objects[id])html+=button('拿起','take',id);
 const acts={WINDO:[['推開窗戶','open']],RUG:[['移開地毯','move']],DOOR:[['打開活門','open']],PILE:[['撥開枯葉','move']],GRATE:[['用鑰匙開鎖','open']],TROPH:[['存入隨身寶物','deposit']],RAIL:[['將麻繩繫在欄杆上','tie'],['解開繩結','untie']],REFLE:[['擦拭鏡面','rub']],ICE:[['把火炬擲向冰川','throw']],DAM:[['轉動閘栓','turn']],LEAK:[['以補漏膠封住裂縫','plug']],GHOST:[['施行驅魔','exorcise']],ALTAR:[['祈禱','pray']]};
 for(const [label,v] of acts[id]||[])html+=button(label,v,id);
 if(id==='CYCLO')html+=button('給予午餐','give',id,'FOOD')+button('給予水','give',id,'WATER');
 if(id==='BUTTO')for(const [c,label] of Object.entries({red:'紅色',brown:'棕色',yellow:'黃色',blue:'藍色'}))html+=button('按下'+label+'按鈕','button',id,c);
 if(['RIDDLE','VOICE','CYCLO','INSCRIPTION'].includes(id))html+='<form id="wordForm" data-id="'+id+'"><label for="word">說出你的答案或話語</label><input id="word" name="word" autocomplete="off" maxlength="60" placeholder="輸入一個詞…"><button class="action" type="submit">說出</button></form>';
 if(game.objects[id]?.read)html+=button('閱讀','read',id);
 if(id==='TROLL'||id==='THIEF')html+='<p>左鍵揮刀 · 右鍵格擋 · Q 擲刀。投出的刀會留在房間裡。</p>';
 show(html);
}
function inventory(){
 let html='<div class="eyebrow">WHAT YOU CARRY</div><h2>行囊</h2><p>'+game.s.inventory.length+' 件物品。原作負重規則：一般最多九件，水瓶內的水也參與拾取檢查。放下的東西會留在當前房間。</p>';
 for(const id of game.s.inventory)html+='<div class="inventory-row"><span>'+esc(NAMES[id])+(game.treasures.includes(id)?' <small>寶物</small>':'')+'</span><div>'+(id in game.s.lights?'<button data-inv="light" data-id="'+id+'">'+(game.s.lights[id]?'熄滅':'點亮')+'</button>':'')+'<button data-inv="drop" data-id="'+id+'">放下</button></div></div>';
 if(!game.s.inventory.length)html+='<p>你兩手空空。</p>';html+='<button class="action" id="journalButton">打開手記 →</button>';show(html);
}
const differences='<h3>保留的原作規則</h3><p>以 1977 年 6 月 Zork 285 重建版本為依據：80 個原始房間節點、原始單向連接與条件、11 件寶物及 285 分。保留開窗、移毯／活門、煙囪限載、骷髏鑰匙、繫繩下降、鏡面交換、水壩黃鈕＋扳手、冰川投火炬、黃金棺繞路、Echo、井的謎語、鐘書燭驅魔、祈禱返林及獨眼巨人的兩種解法。</p><h3>改編與簡化</h3><p>文字命令改成靠近後的動作選單；謎語與魔法詞仍需輸入答案。圖形走廊以房間分塊切換，保留非歐幾何的出口關係；地圖手記只記錄走過的房間。戰鬥改為即時揮刀、格擋與敵人視線 AI，巨魔仍可擲刀解決；獨眼巨人不能砍死。盜賊巡遊範圍縮為三個房間，偷取寶物可在其死亡或抵達寶物室後追回。</p><p>黑暗的原作隨機墜坑，改成移動時倒數警告再受傷；死亡回到安全點快照，避免必需道具永久丟失。維修室淹水由回合改為 45 秒；資料與背包仍一同回存。轉盤保留隨機出口。蠟燭在風洞仍可能熄滅，但禁止誤操作永久燒毀蠟燭、提燈或寶物，避免無解存檔。這個早期版本沒有後期終局，也沒有額外添加電池倒數。</p><h3>原作與來源</h3><p>Tim Anderson、Marc Blank、Bruce Daniels、Dave Lebling。原文短句與地圖依据 <a href="https://github.com/MITDDC/zork-1977-07" target="_blank" rel="noopener">MIT DDC 1977 典藏</a>與 <a href="https://github.com/heasm66/mdlzork/tree/master/zork_285" target="_blank" rel="noopener">Zork 285 重建</a>核對。MIT 持有權利的原始檔依 MIT-0 釋出。本作為非官方改編；所有 3D 場景、角色、植物、聲音均為程式生成，沒有外部模型素材。</p>';
function about(){show('<div class="eyebrow">1977 / ADAPTATION NOTES</div><h2>一個帝國，兩種語言。</h2>'+differences);}
function journal(){
 const visited=game.s.visited;
 let html='<div class="eyebrow">EXPLORER’S JOURNAL</div><h2>'+esc(roomNames[game.s.room]||game.rooms[game.s.room].name)+'</h2><p class="original">'+esc(getText())+'</p><div class="exits">';
 for(const [d,e] of Object.entries(game.rooms[game.s.room].exits))html+='<span>'+DIRS[d]+' → '+(visited.includes(e.to)?esc(game.rooms[e.to].name):'未知')+'</span>';
 html+='</div><p>探索 '+visited.length+' / 80 房間 · '+game.score()+' / 285 分。寶物帶回白屋的櫃子；完整得分還需要走過主要探索地點。</p><details><summary>我的路徑紀錄</summary><pre>'+visited.map(id=>id+' · '+(roomNames[id]||game.rooms[id].name)).join('\n')+'</pre></details><details><summary>需要一點提示？（展開會透露解法）</summary><p>先绕到白屋後方開窗；客廳取燈、移毯、開活門，閣樓取刀與繩。地窖入口會關上，可走畫室煙囪（燈＋一件物品）、迷宮柵門或祈禱回地表。</p><p>巨魔：Q 擲刀可讓牠吞刀；不成功可拾回再投。穹頂：把繩繫在欄杆才下得去。火炬投向冰川後會漂到 Stream，別忘了取回。黃金棺不能走窄道，改走冰川、溪流、水庫。</p><p>水壩：維修室按黃鈕，再用扳手轉動大壩閘栓。藍鈕漏水可用 putty 補好。鏡面可擦拭，前後房間互換。喧響室說 ECHO；謎語室答案 WELL。獨眼巨人可先給 FOOD 再給 WATER，或說 SINBAD 撞開北牆。後者才能取得奇異通道的探索分。</p><p>冥界：帶鐘、書、點亮的蠟燭後驅魔。祭壇祈禱回森林。神殿說 TREASURE 可到寶物室。最終要將十一件寶物（也包含火炬）放回白屋，並走過 KITCH、CELLA、PASS1、BLROO、TREAS-R、LLD2，達到 285 分。</p></details><details><summary>版本與改編差異</summary>'+differences+'</details>';
 show(html);
}
function pauseMenu(){show('<div class="eyebrow">THE WORLD WAITS</div><h2>停在這一頁。</h2><p>WASD 移動 · Shift 快跑 · 滑鼠或方向鍵環顧<br>E 互動 · 左鍵／Space 揮刀 · 右鍵／R 格擋 · Q 擲刀<br>L 提燈 · I 背包 · J 手記 · Esc 暫停<br>觸控：拖曳畫面環顧，左下方向鍵移動。</p><button class="action" id="resume">繼續探索 →</button><button class="action" id="inventoryButton">背包</button><button class="action" id="journalButton">手記與提示</button><button class="action" id="manualSave">儲存進度</button><button class="action" id="newGame">重新開始</button>');save();}
function ending(){show('<div class="eyebrow">MASTER ADVENTURER / 285 POINTS</div><h2>帝國重見天日。</h2><p>十一件寶物安放在白屋的櫃中。你的足跡穿過長夜、鏡面與深水，最後回到了起點。</p><p class="original">The trophy case accepts another contribution.</p><p>你已完成此 1977 年 6 月版本的全部 285 分目標。早期版本沒有後來的 Dungeon Master 終局。</p><button class="action" id="resume">回到白屋，繼續探索 →</button><details><summary>查看改編差異</summary>'+differences+'</details>');save();}
content.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.act){const old=game.s.room;game.act(b.dataset.act,b.dataset.id,b.dataset.arg);if(b.dataset.act==='read'){show('<h2>'+esc(NAMES[b.dataset.id])+'</h2><p class="original">'+esc(game.message)+'</p>');return;}resume();afterAction(old);}
 if(b.dataset.inv){const old=game.s.room;game.act(b.dataset.inv,b.dataset.id);afterAction(old);if(!game.s.won)inventory();}
 if(b.id==='resume')resume();if(b.id==='inventoryButton')inventory();if(b.id==='journalButton')journal();
 if(b.id==='manualSave'){save();b.textContent=$('#saveStatus').textContent}
 if(b.id==='newGame')show('<h2>重新開始？</h2><p>此瀏覽器的這一份冒險存檔會被新遊戲取代。</p><button class="action" id="confirmNew">重新開始</button><button class="action" id="resume">取消，返回遊戲</button>');
 if(b.id==='confirmNew'){game.reset();resume();buildRoom();save();toast('白屋前，另一場冒險開始了。')}
});
content.addEventListener('submit',e=>{if(e.target.id!=='wordForm')return;e.preventDefault();const old=game.s.room;game.act('say',e.target.dataset.id,new FormData(e.target).get('word'));resume();afterAction(old)});
$('#closeModal').onclick=resume;modal.addEventListener('cancel',e=>{e.preventDefault();resume()});$('#about').onclick=about;$('#pauseButton').onclick=pauseMenu;
function toggleLamp(){if(!game.has('LAMP')){toast('白屋裡有一盞黃銅提燈。');return;}game.act('light','LAMP');updateHUD();toast(game.message);save();}
function interact(){if(target&&!paused&&!transitioning)choices(target);}
function hit(thrown=false){
 if(paused||transitioning||cooldown>0)return;if(!game.has('KNIFE')){toast('先在閣樓找到獵刀。');return;}
 if(game.s.stamina<18){toast('你需要喘一口氣。');return;}
 game.s.stamina-=18;cooldown=.55;swing=.42;const forward=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);let chosen=null,dist=thrown?8:2.7;
 for(const a of actors){const dx=a.x-game.s.pos[0],dz=a.z-game.s.pos[1],d=Math.hypot(dx,dz);if(d<dist&&(dx*forward.x+dz*forward.z)/d>.62&&los(game.s.pos[0],game.s.pos[1],a.x,a.z)){chosen=a;dist=d}}
 if(chosen){game.hurtEnemy(chosen.id,thrown?40:28,thrown);toast(game.message);sound('hit');if(game.s.dead.includes(chosen.id)||thrown){buildRoom();save();}}else if(thrown){game.drop('KNIFE');buildRoom();toast('刀落在附近地面。');save();}
 updateHUD();sound('swing');
}
let audioCtx;
function sound(kind){if(!audioCtx)return;const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type=kind==='hit'?'triangle':'sine';o.frequency.setValueAtTime(kind==='hit'?110:kind==='step'?60:350,audioCtx.currentTime);o.frequency.exponentialRampToValueAtTime(30,audioCtx.currentTime+.13);g.gain.setValueAtTime(kind==='step'?.018:.035,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.14);o.start();o.stop(audioCtx.currentTime+.15);}
function actorTick(a,dt){
 if(a.id==='CYCLO'){a.mesh.rotation.y=Math.atan2(game.s.pos[0]-a.x,game.s.pos[1]-a.z);if(game.flag('CYCLOPS-FLAG')){a.mesh.rotation.z=Math.PI/2;a.mesh.position.y=.4;return;}return;}
 const dx=game.s.pos[0]-a.x,dz=game.s.pos[1]-a.z,dist=Math.hypot(dx,dz),visible=los(a.x,a.z,...game.s.pos)&&(dist<4||(dist<10&&game.lit()));a.time+=dt;a.attackCD-=dt;a.stealCD-=dt;
 if(visible){a.last=[...game.s.pos];a.lost=0;if(a.mode==='patrol'||a.mode==='search'){a.mode='alert';a.time=0;}if(a.mode==='alert'&&a.time>.65)a.mode='chase';}
 else if(a.mode==='chase'||a.mode==='alert'){a.lost+=dt;if(a.lost>2.5){a.mode='search';a.time=0;}}
 if(a.mode==='search'&&a.time>4){a.mode='patrol';a.time=0;}
 let goal=a.mode==='chase'?a.last:a.mode==='search'?a.last:[[5,-5],[-5,-4],[-4,4],[4,4]][a.point],speed=a.mode==='chase'?2.25:1.05;
 if(a.mode==='alert')speed=0;const gx=goal[0]-a.x,gz=goal[1]-a.z,len=Math.hypot(gx,gz);
 if(len<.6&&a.mode==='patrol')a.point=(a.point+1)%4;
 if(len>.5&&dist>1.8){const vx=gx/len*speed*dt,vz=gz/len*speed*dt;if(!blocked(a.x+vx,a.z,.5))a.x+=vx;if(!blocked(a.x,a.z+vz,.5))a.z+=vz;}
 if(a.mode==='chase'&&dist<2.3&&a.attackCD<=0){a.wind+=dt;if(a.wind>.75){a.wind=0;a.attackCD=1.5;if(los(a.x,a.z,...game.s.pos)&&invincible<=0){const guard=(keys.Mouse2||keys.KeyR)&&game.s.stamina>12;if(guard)game.s.stamina-=12;const died=game.damage(guard?4:22);invincible=.6;$('#damage').style.opacity=guard?.25:.8;setTimeout(()=>$('#damage').style.opacity=0,170);sound('hit');if(died){transition();toast(game.message);save();return;}}}}else a.wind=0;
 if(a.id==='THIEF'&&dist<2&&a.stealCD<=0){game.steal();toast(game.message);a.stealCD=14;}
 a.mesh.position.set(a.x,Math.sin(a.time*6)*.03,a.z);a.mesh.rotation.y=Math.atan2(dx,dz);a.limbs.forEach((l,i)=>l.rotation.x=Math.sin(a.time*6+i*Math.PI)*.23+(a.wind?-.7:0));
}
function selectTarget(){
 target=null;let best=Infinity;const fw=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
 if(!game.lit()){$('#prompt').hidden=true;return;}
 for(const t of targets){if(t.actor){t.x=t.actor.x;t.z=t.actor.z}const dx=t.x-game.s.pos[0],dz=t.z-game.s.pos[1],dy=t.y-1.7,d=Math.hypot(dx,dz);if(d>3.1||!los(...game.s.pos,t.x,t.z))continue;const len=Math.hypot(dx,dz,dy),dot=(dx*fw.x+dz*fw.z+dy*fw.y)/len;if(dot<.74&&d>1.2)continue;const s=d+(1-dot)*2;if(s<best){best=s;target=t}}
 $('#prompt').hidden=!target;if(target){$('#targetName').textContent=target.name;$('#targetText').textContent=(target.text||'').split('. ')[0].slice(0,150)}
}
function frame(now){
 requestAnimationFrame(frame);const dt=Math.min(.04,(now-(frame.last||now))/1000);frame.last=now;clockTime+=dt;if(!renderer||contextLost)return;
 if(!started){camera.position.set(-8,1.8,10);camera.lookAt(6,2.6,-5);if(!reduced){camera.position.x+=Math.sin(now*.00008)*.35;camera.lookAt(6,2.6,-5)}}
 else if(!paused&&!transitioning&&!document.hidden){
  cooldown=Math.max(0,cooldown-dt);invincible=Math.max(0,invincible-dt);swing=Math.max(0,swing-dt);saveTime+=dt;
  if(keys.ArrowLeft)game.s.yaw+=dt*1.6;if(keys.ArrowRight)game.s.yaw-=dt*1.6;if(keys.ArrowUp)game.s.pitch=Math.min(1.25,game.s.pitch+dt*1.2);if(keys.ArrowDown)game.s.pitch=Math.max(-1.25,game.s.pitch-dt*1.2);
  const f=(keys.KeyW?1:0)-(keys.KeyS?1:0),s=(keys.KeyD?1:0)-(keys.KeyA?1:0),len=Math.hypot(f,s),sprint=keys.ShiftLeft&&game.s.stamina>1,moveSpeed=sprint?6:3.6;
  if(len){let dx=(-Math.sin(game.s.yaw)*f+Math.cos(game.s.yaw)*s)/len*moveSpeed*dt,dz=(-Math.cos(game.s.yaw)*f-Math.sin(game.s.yaw)*s)/len*moveSpeed*dt;const [x,z]=game.s.pos;if(!blocked(x+dx,z))game.s.pos[0]+=dx;if(!blocked(game.s.pos[0],z+dz))game.s.pos[1]+=dz;walkPhase+=dt*moveSpeed;if(Math.floor(walkPhase*1.7)!==Math.floor((walkPhase-dt*moveSpeed)*1.7))sound('step');if(sprint)game.s.stamina=Math.max(0,game.s.stamina-dt*15);}
  if(!sprint&&!swing)game.s.stamina=Math.min(100,game.s.stamina+dt*16);
  camera.position.set(game.s.pos[0],1.7+(!reduced&&len?Math.sin(walkPhase*9)*.025:0),game.s.pos[1]);camera.rotation.set(game.s.pitch,game.s.yaw,0,'YXZ');
  const beforeTick=game.s;game.tick(dt);if(game.s!==beforeTick){transition();toast(game.message);save();return;}for(const a of actors)actorTick(a,dt);
  if(!game.lit()&&len){darkTime+=dt;if(darkTime>2&&darkTime<2.1)toast('看不見的落差就在腳下。立刻停下，按 L 點燈。');if(darkTime>6){game.damage(100);darkTime=0;transition();toast(game.message);}}else darkTime=0;
  selectTarget();if(saveTime>8)save();if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('#toast').textContent=''}
  $('#compass').textContent=game.s.room==='CAROU'?'? / ?':['N','NW','W','SW','S','SE','E','NE'][((Math.round(game.s.yaw/(Math.PI/4))%8)+8)%8];
  updateHUD();const a=actors.find(a=>Math.hypot(a.x-game.s.pos[0],a.z-game.s.pos[1])<9&&los(...game.s.pos,a.x,a.z)&&game.lit());$('#enemy').hidden=!a;if(a){$('#enemyName').textContent=NAMES[a.id];$('#enemyMode').textContent=a.id==='CYCLO'?(game.flag('CYCLOPS-FLAG')?'熟睡':'無法以刀刃擊倒'):({patrol:'巡邏',alert:'察覺',chase:a.wind?'準備攻擊':'追擊',search:'失去目標 · 搜尋'}[a.mode]);$('#enemyHealth').value=game.s.enemyHP[a.id]??100;}
 }
 if(started){
  const carried=Object.entries(game.s.lights).some(([id,on])=>on&&game.has(id));lanternLight.intensity=carried?85*(1+.025*Math.sin(now*.014)):0;
  const nearLight=carried?.8:game.rooms[game.s.room].lit?.6:Math.max(0,...roomLights.map(l=>1-Math.hypot(l.position.x-game.s.pos[0],l.position.z-game.s.pos[1])/8))*.65;for(const m of heldMaterials)m.material.color.copy(m.base).multiplyScalar(nearLight);
  lantern.position.set(.48+Math.sin(walkPhase*5)*.014,-.54,-.65);lantern.rotation.z=.05+Math.sin(walkPhase*4)*.018;
  knife.rotation.z=swing?-.8+Math.sin((.42-swing)/.42*Math.PI)*1.9:-.3;knife.rotation.x=swing?-.5:0;
 }
 for(const a of animated){if(a.kind==='beam')a.mesh.material.uniforms.t.value=clockTime;if(a.kind==='water')a.mesh.position.y+=(Math.sin(now*.002)*.0003);if(a.kind==='turn'&&!reduced)a.mesh.rotation.y=now*.00015;}
 renderer.render(scene,camera);
}
function setup(){
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.35:1.7));renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.outputColorSpace=THREE.SRGBColorSpace;
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(66,innerWidth/innerHeight,.06,90);camera.rotation.order='YXZ';scene.add(camera);
 geos.box=new THREE.BoxGeometry(1,1,1);geos.sphere=new THREE.SphereGeometry(1,10,7);geos.rock=new THREE.IcosahedronGeometry(1,0);geos.cylinder=new THREE.CylinderGeometry(.8,1,1,8);geos.cone=new THREE.ConeGeometry(1,1,8);geos.torus=new THREE.TorusGeometry(1,.11,5,16);geos.roof=new THREE.BufferGeometry();geos.roof.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,.5,.5,0,.5,0,1,.5,.5,0,-.5,-.5,0,-.5,0,1,-.5,-.5,0,-.5,-.5,0,.5,0,1,.5,-.5,0,-.5,0,1,.5,0,1,-.5,.5,0,.5,.5,0,-.5,0,1,-.5,.5,0,.5,0,1,-.5,0,1,.5],3));geos.roof.computeVertexNormals();
 const blade=new THREE.BufferGeometry();blade.setAttribute('position',new THREE.Float32BufferAttribute([-.08,0,0,.08,0,0,.02,1,.08],3));blade.computeVertexNormals();geos.blade=blade;
 const leaf=new THREE.BufferGeometry();leaf.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-1,.42,0,0,1,0,0,0,0,0,1,0,1,.42,0],3));leaf.computeVertexNormals();geos.leaf=leaf;
 hemi=new THREE.HemisphereLight(0xc6d5bf,0x313825,1);scene.add(hemi);sun=new THREE.DirectionalLight(0xdde3b3,2.5);sun.position.set(9,22,-18);scene.add(sun);
 lanternLight=new THREE.PointLight(0xffbe70,0,13,1.7);lanternLight.position.set(.25,-.12,-.4);camera.add(lanternLight);
 chunk=new THREE.Group();scene.add(chunk);lantern=itemModel('LAMP',camera);lantern.scale.setScalar(.34);lantern.visible=false;knife=itemModel('KNIFE',camera);knife.position.set(-.36,-.58,-.58);knife.scale.setScalar(.48);knife.visible=false;
 // Tone the held tools independently: a point light centimeters away otherwise clips brass to white.
 for(const tool of [lantern,knife])tool.traverse(o=>{if(!o.isMesh)return;const source=o.material;o.material=new THREE.MeshBasicMaterial({color:source.color,transparent:source.transparent,opacity:source.opacity,side:source.side,toneMapped:false});heldMaterials.push({material:o.material,base:source.color.clone()});});
 buildRoom();$('#begin').disabled=false;$('#loading').textContent=saveError?'舊存檔無法讀取，將開始新的冒險。':stored?'已找到本機存檔。Begin 將繼續你的旅程。':'80 個房間 · 11 件寶物 · 一盞燈。';if(stored)$('#begin').firstChild.textContent='Continue ';
 requestAnimationFrame(frame);
}
$('#begin').onclick=()=>{
 if(!renderer)return;started=true;paused=false;$('#title').hidden=true;$('#hud').hidden=false;
 try{audioCtx=new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume()}catch{}
 buildRoom();resume();toast('E 互動，L 提燈，I 背包，J 手記。先繞到白屋後方尋找入口。');save();
};
document.addEventListener('keydown',e=>{
 if(!started||modal.open)return;if(['KeyW','KeyA','KeyS','KeyD','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys[e.code]=true;if(e.repeat)return;
 if(e.code==='KeyE')interact();if(e.code==='KeyL')toggleLamp();if(e.code==='KeyI')inventory();if(e.code==='KeyJ'||e.code==='KeyM')journal();if(e.code==='Space')hit();if(e.code==='KeyQ')hit(true);if(e.code==='Escape')pauseMenu();
});
document.addEventListener('keyup',e=>{keys[e.code]=false});
let dragging=false,lastTouch=null;
canvas.addEventListener('pointerdown',e=>{if(!started||paused)return;if(e.pointerType==='touch'){lastTouch=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);return;}if(!document.pointerLockElement){dragging=true;canvas.requestPointerLock?.()?.catch?.(()=>{});}if(e.button===0)hit();if(e.button===2)keys.Mouse2=true});
canvas.addEventListener('pointermove',e=>{
 if(!started||paused)return;let dx=0,dy=0;if(e.pointerType==='touch'&&lastTouch){dx=e.clientX-lastTouch[0];dy=e.clientY-lastTouch[1];lastTouch=[e.clientX,e.clientY]}else if(document.pointerLockElement||dragging){dx=e.movementX;dy=e.movementY}
 game.s.yaw-=dx*.0023;game.s.pitch=Math.max(-1.25,Math.min(1.25,game.s.pitch-dy*.0023));
});
window.addEventListener('pointerup',()=>{dragging=false;lastTouch=null;keys.Mouse2=false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&started&&!modal.open&&!mobile&&!transitioning)pauseMenu();});
window.addEventListener('blur',()=>{keys={};if(started&&!modal.open)pauseMenu()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started){keys={};save();if(!modal.open)pauseMenu()}});
window.addEventListener('beforeunload',()=>{if(started)save()});
window.addEventListener('resize',()=>{if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
for(const b of document.querySelectorAll('[data-key]')){b.onpointerdown=e=>{e.preventDefault();keys[b.dataset.key]=true;b.setPointerCapture(e.pointerId)};b.onpointerup=b.onpointercancel=()=>keys[b.dataset.key]=false;}
$('#touchE').onclick=interact;$('#touchHit').onclick=()=>hit();$('#touchL').onclick=toggleLamp;$('#touchI').onclick=inventory;
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;save();show('<h2>畫面暫時中斷</h2><p>進度已嘗試保存在此瀏覽器。請重新整理頁面繼續。</p>')});
try{setup()}catch(error){$('#loading').textContent='無法啟動 WebGL。請使用支援 WebGL 的瀏覽器，並以網站伺服器開啟本頁。';console.error(error)}
// Read-only instrumentation. Test drivers still use real keyboard, mouse and UI actions.
if(new URLSearchParams(location.search).has('test'))Object.defineProperty(window,'zorkTest',{value:()=>JSON.parse(JSON.stringify({state:game.s,score:game.score(),paused,transitioning,target:target?.id,targets:targets.map(t=>({id:t.id,x:t.x,z:t.z,y:t.y,exit:t.exit})),actors:actors.map(a=>({id:a.id,mode:a.mode,x:a.x,z:a.z})),colliders,resources:renderer?.info.memory,lit:game.lit()}))});
