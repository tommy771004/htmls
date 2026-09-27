import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../../vendor/three-0.186.0/addons/geometries/RoundedBoxGeometry.js';

export function createOffice({agents,onChat,isBlocked,onHint}) {
 const host=document.getElementById('scene'), labels=document.getElementById('nameplates');
 const scene=new THREE.Scene();
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0xeeeeE4,0);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
 host.appendChild(renderer.domElement);
 const camera=new THREE.OrthographicCamera(-10,10,10,-10,.1,100);
 camera.position.set(13,14,19);camera.lookAt(0,.2,0);
 scene.add(new THREE.HemisphereLight(0xfff9e7,0xa6b39b,2.8));
 const sun=new THREE.DirectionalLight(0xffe6bf,4.5);sun.position.set(-3,13,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-11;sun.shadow.camera.right=11;sun.shadow.camera.top=11;sun.shadow.camera.bottom=-11;sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;sun.shadow.radius=4;scene.add(sun);
 const fill=new THREE.DirectionalLight(0xecf8e4,1.2);fill.position.set(8,6,-6);scene.add(fill);
 const materials=new Map(), geometries=new Map();
 function mat(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.82}));return materials.get(color);}
 function box(w,h,d,color,x=0,y=0,z=0,parent=scene,r=.06){const k=[w,h,d,r].join('/');if(!geometries.has(k))geometries.set(k,r?new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)):new THREE.BoxGeometry(w,h,d));const m=new THREE.Mesh(geometries.get(k),mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function sphere(w,h,d,color,x,y,z,parent=scene){const k='sphere';if(!geometries.has(k))geometries.set(k,new THREE.SphereGeometry(1,16,12));const m=new THREE.Mesh(geometries.get(k),mat(color));m.scale.set(w,h,d);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function cylinder(top,bottom,h,color,x,y,z,parent=scene){const k=['c',top,bottom,h].join('/');if(!geometries.has(k))geometries.set(k,new THREE.CylinderGeometry(top,bottom,h,20));const m=new THREE.Mesh(geometries.get(k),mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function group(x,y,z,parent=scene){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
 function graphic(text,w,h,bg,fg,size=55){const c=document.createElement('canvas');c.width=512;c.height=Math.round(512*h/w);const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${size}px Georgia`;const lines=text.split('\n');lines.forEach((l,i)=>ctx.fillText(l,256,c.height/2+(i-(lines.length-1)/2)*size*1.25));const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex}));return m;}
 // The floating architectural model: warm parquet, two open walls and a garden edge.
 box(13.4,.42,10.6,0xd5c5a8,0,-.3,0,scene,.14);
 box(13,.16,10.2,0xe0cfb1,0,-.04,0);
 for(let x=-6.2;x<6.3;x+=.55){box(.012,.007,10,0xbca985,x,.046,0,scene,0);for(let z=-4.7;z<5;z+=1.8)box(.53,.008,.012,0xc5b18f,x+.265,.047,z+((Math.round(x*10)%2)*.4),scene,0);}
 box(13.1,3.0,.2,0xeceadb,0,1.48,-5.05);
 box(.2,3,10.2,0xe7e4d4,-6.55,1.48,0);
 box(13.1,.14,.25,0xc9d0b8,0,3,-5.05);box(.25,.14,10.2,0xc9d0b8,-6.55,3,0);
 box(13,.17,.09,0xb3bba4,0,.15,-4.9);box(.09,.17,10,0xb3bba4,-6.4,.15,0);
 // Back windows with softened blue-green glazing, mullions and a long sill.
 for(const x of [-3.5,-.8]){
  box(2.25,1.7,.07,0x90b8b3,x,1.98,-4.91);
  for(const dx of [-1.16,0,1.16])box(.075,1.84,.12,0xfff9e7,x+dx,1.98,-4.84);
  for(const yy of [1.08,1.96,2.89])box(2.4,.075,.12,0xfff9e7,x,yy,-4.84);
  box(2.55,.12,.4,0xc3b393,x,1.04,-4.72);
  const shine=box(.14,1.58,.015,0xb6d1c1,x-.74,1.98,-4.86);shine.rotation.z=-.18;
 }
 const sign=graphic('little things,\nbig possibilities.',2.15,.88,'#e8e5d4','#56664c',45);sign.position.set(3.12,2.05,-4.92);scene.add(sign);
 // Slatted green cabinet and pinboard on the left wall.
 box(.55,1.2,2.6,0x637d64,-6.04,.64,-2.95);
 for(let z=-4.12;z<-1.7;z+=.2)box(.035,.97,.055,0x8da084,-5.75,.65,z);
 box(.7,.1,2.8,0xdac7a3,-6.03,1.29,-2.95);
 const pin=group(-6.38,2.15,.18);const board=box(2.15,1.22,.09,0xbfa782,0,0,0,pin);pin.rotation.y=Math.PI/2;
 for(let i=0;i<6;i++){const paper=box(.44,.37,.018,[0xefddab,0xd1d9bf,0xeec9a7][i%3],-.7+(i%3)*.65,-.27+Math.floor(i/3)*.55,.065,pin,.01);paper.rotation.z=(i%3-1)*.1; sphere(.024,.024,.024,0x8b7656,paper.position.x,paper.position.y+.12,.09,pin);}
 // A low bookcase below the wall art.
 box(.7,.9,2.1,0xd2b995,-6.02,.48,.55);box(.71,.075,2.13,0xe9d5b2,-6.02,.98,.55);
 for(let i=0;i<10;i++){const b=box(.34,.5+(i%3)*.08,.11,[0x7d9484,0xd2a879,0xb8735b,0xf0e0c5][i%4],-5.8,.63,-.28+i*.18);b.rotation.x=(i%3-1)*.06;}
 function plant(x,z,size=1,y=0){const g=group(x,y,z);cylinder(.25*size,.18*size,.42*size,0xc89170,0,.21*size,0,g);cylinder(.23*size,.23*size,.025*size,0x6b654c,0,.43*size,0,g);cylinder(.025*size,.035*size,.74*size,0x68804c,0,.76*size,0,g);for(let i=0;i<7;i++){const a=i*2.4,leaf=sphere(.15*size,.42*size,.12*size,i%2?0x78995f:0x527948,Math.sin(a)*.22*size,(.7+i*.06)*size,Math.cos(a)*.22*size,g);leaf.rotation.set(Math.cos(a)*.6,0,Math.sin(a)*.6);}return g;}
 plant(-5.7,4.13,1.65);plant(5.7,-4.17,1.65);plant(-6,-3.45,.65,1.35);plant(-6,-2.45,.48,1.35);
 // Coffee corner on the back right.
 box(2.0,1.1,.8,0x8f9f81,4.4,.56,-3.96);box(2.13,.12,.95,0xeee4cb,4.4,1.17,-3.96);
 for(const x of [3.91,4.89]){box(.88,.85,.04,0x9bac8a,x,.57,-3.52);cylinder(.04,.04,.06,0xa48c58,x, .82,-3.48).rotation.x=Math.PI/2;}
 box(.48,.54,.43,0x424f47,4.08,1.48,-4);box(.34,.21,.02,0x282f2b,4.08,1.57,-3.772);box(.3,.055,.31,0x7b8980,4.08,1.28,-3.82);cylinder(.072,.062,.13,0xf2ead6,4.08,1.37,-3.78);
 cylinder(.15,.14,.24,0xe0b563,4.9,1.36,-3.99);cylinder(.17,.17,.04,0xf1e6cc,4.9,1.49,-3.99);
 box(2.05,.1,.37,0xb0a283,4.4,2.36,-4.76);plant(4.85,-4.73,.48,2.43);
 // A cozy lounge: hand-sewn cushions, a striped rug and a coffee table.
 box(2.7,.025,3.55,0xb2bfaa,4.35,.068,1.75,scene,.07);
 for(let z=.13;z<3.5;z+=.18)box(2.45,.009,.035,0xd3dbbf,4.35,.083,z,scene,0);
 const couch=group(5.16,0,1.63);couch.rotation.y=-Math.PI/2;
 box(2.45,.39,.95,0xcb8e68,0,.44,0,couch,.15);box(2.48,.77,.28,0xd49871,0,.97,-.47,couch,.12);
 for(const x of [-1.15,1.15])box(.27,.53,1.07,0xc78761,x,.79,0,couch,.12);
 for(const x of [-.57,.57]){box(1.01,.2,.84,0xe1a47b,x,.7,.05,couch,.12);const cushion=box(.58,.57,.19,x<0?0xe6c987:0xa8b197,x,.98,-.24,couch,.12);cushion.rotation.x=-.13;}
 for(const x of [-.9,.9])for(const z of [-.33,.33])cylinder(.04,.045,.3,0x6f6852,x,.2,z,couch);
 cylinder(.67,.67,.12,0xe2c99f,3.58,.55,1.72);cylinder(.22,.3,.49,0x9c9e7b,3.58,.26,1.72);
 box(.49,.05,.32,0x657f68,3.5,.645,1.7).rotation.y=.17;cylinder(.08,.065,.16,0xf3eedb,3.88,.68,1.73);
 cylinder(.28,.28,.06,0x717e66,5.78,.1,3.85);cylinder(.035,.035,2.12,0x798367,5.78,1.15,3.85);cylinder(.35,.53,.45,0xf0dab0,5.78,2.35,3.85);
 // Four workstations, each with a terminal, peripherals, notebook, mug and lamp.
 const obstacles=[{x:4.3,z:-3.95,w:2.3,d:1.2},{x:5.15,z:1.6,w:1.4,d:2.9},{x:3.58,z:1.72,w:1.5,d:1.5},{x:-5.95,z:-1.2,w:1.2,d:6.3}];
 function desk(a,index){const g=group(a.x,0,a.z);box(2.85,.15,1.32,0xe0bd89,0,1.08,0,g,.08);box(2.65,.05,1.18,0xeccd9c,0,1.176,0,g,.03);
  for(const x of [-1.16,1.16])for(const z of [-.45,.45])box(.09,1,.09,0x738273,x,.52,z,g,.02);
  box(.5,.68,.86,0xc6c9aa,1.02,.66,0,g);for(const y of [.48,.75])box(.22,.024,.035,0x7f8b72,1.02,y,.448,g);
  box(.55,.04,.35,0x424d47,0,1.23,-.2,g);box(.07,.22,.07,0x59675c,0,1.36,-.28,g);box(1.03,.67,.09,0x43534b,0,1.76,-.3,g,.05);
  box(.94,.56,.016,0x243e35,0,1.77,-.243,g,.025);
  // Tiny readable-as-code color blocks embedded in the monitor.
  for(let i=0;i<7;i++){box(.04,.016,.008,0x69836c,-.405,1.98-i*.061,-.23,g,0);const len=[.31,.43,.22,.49,.36,.21,.4][i];box(len,.022,.008,[0xb6c699,0xe3bf8c,0x86bfb1][i%3],-.34+len/2+(i%3)*.04,1.98-i*.061,-.23,g,0);}
  box(.69,.033,.25,0x839187,0,1.231,.32,g,.02);for(let i=0;i<3;i++)for(let k=0;k<8;k++)box(.059,.009,.05,0xc6ccba,-.28+k*.078,1.253,.24+i*.066,g,.004);
  sphere(.075,.028,.105,0x627867,.6,1.235,.32,g);
  cylinder(.086,.07,.18,[0xcd8265,0xb0bc91,0xe1b853,0x7c9caa][index],-.97,1.29,.3,g);cylinder(.065,.065,.009,0x6f583c,-.97,1.385,.3,g);
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.055,.013,8,12),mat(0xd2ba91));handle.position.set(-.87,1.3,.3);g.add(handle);
  const book=box(.36,.036,.5,0xd1d9bf,-.9,1.22,-.35,g,.015);book.rotation.y=-.16;box(.02,.022,.35,0x7d7156,-.7,1.26,-.36,g,.008);
  cylinder(.12,.12,.035,0x667b62,1.05,1.23,-.4,g);cylinder(.024,.024,.57,0x687d61,1.05,1.53,-.4,g);const shade=cylinder(.11,.24,.17,0x93a182,1.02,1.84,-.4,g);shade.rotation.z=.22;
  const chair=group(0,0,1.05,g);box(.71,.15,.67,0x748a6f,0,.62,0,chair,.09);box(.72,.62,.14,0x809377,0,.94,.32,chair,.1);cylinder(.045,.06,.52,0x515f55,0,.32,0,chair);
  for(let i=0;i<5;i++){const leg=box(.065,.06,.49,0x535f56,Math.sin(i*1.256)*.18,.12,Math.cos(i*1.256)*.18,chair,.02);leg.rotation.y=i*1.256;sphere(.075,.055,.075,0x3c4d45,Math.sin(i*1.256)*.39,.07,Math.cos(i*1.256)*.39,chair);}
  obstacles.push({x:a.x,z:a.z,w:3.05,d:1.55});
 }
 function person(color,hair,index){const root=group(0,0,0),body=group(0,0,0,root);const skin=[0xe3b48d,0xb8805e,0xf1c8a1,0xd9aa85,0xe5b992][index];
  box(.48,.58,.33,color,0,.94,0,body,.15);box(.37,.15,.27,0x465b55,0,.59,0,body,.06);
  cylinder(.082,.085,.15,skin,0,1.3,0,body);sphere(.285,.315,.265,skin,0,1.61,0,body);
  sphere(.291,.18,.27,hair,0,1.79,-.028,body);box(.52,.22,.19,hair,0,1.7,-.17,body,.09);
  if(index===2){sphere(.18,.22,.17,hair,0,1.89,-.12,body);sphere(.12,.15,.11,hair,.2,1.6,-.1,body);}
  if(index===1){box(.6,.08,.41,0x6c8768,0,1.82,.08,body,.04);sphere(.28,.17,.25,0x779172,0,1.84,-.03,body);}
  for(const x of [-.095,.095]){sphere(.021,.028,.012,0x3b3931,x,1.62,.253,body);if(index===3){const rim=new THREE.Mesh(new THREE.TorusGeometry(.071,.011,6,20),mat(0x4e5149));rim.position.set(x,1.62,.264);body.add(rim);}}
  sphere(.039,.035,.034,skin,0,1.54,.264,body);box(.06,.012,.013,0x9b6250,0,1.478,.241,body,.005);
  const arms=[];for(const s of [-1,1]){const arm=group(s*.3,1.16,0,body);box(.16,.34,.18,color,0,-.14,0,arm,.07);sphere(.08,.105,.075,skin,0,-.36,0,arm);arms.push(arm);}
  const legs=[];for(const s of [-1,1]){const leg=group(s*.135,.57,0,root);box(.18,.43,.19,0x465b55,0,-.18,0,leg,.05);box(.2,.12,.33,0xf4e9cb,0,-.42,.055,leg,.05);legs.push(leg);}
  return {root,body,arms,legs};
 }
 const actors=agents.map((a,i)=>{desk(a,i);const p=person(a.shirt,[0x674c36,0x473d32,0x765139,0x584a3c][i],i);p.root.position.set(a.x,.19,a.z+.98);const label=document.createElement('div');label.className='nameplate';labels.appendChild(label);p.label=label;p.agent=a;p.root.traverse(o=>o.userData.agent=a);return p;});
 const player=person(0xe4bb63,0x735943,4);player.root.position.set(.3,0,4.1);
 const playerLabel=document.createElement('div');playerLabel.className='nameplate you';playerLabel.innerHTML='<span class="tag">You ↓</span>';labels.appendChild(playerLabel);
 const ring=new THREE.Mesh(new THREE.RingGeometry(.35,.43,40),new THREE.MeshBasicMaterial({color:0x6c8f5b,side:THREE.DoubleSide,transparent:true,opacity:.55}));ring.rotation.x=-Math.PI/2;ring.position.y=.07;scene.add(ring);
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.ShadowMaterial({opacity:.105}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.53;shadow.receiveShadow=true;scene.add(shadow);
 // A small welcome plaque at the open edge.
 const plaque=graphic('THE GOOD WORK ROOM',2.1,.24,'#d5c5a8','#7b795e',24);plaque.position.set(0,-.27,5.312);scene.add(plaque);
 let zoom=1, width=0,height=0;
 function resize(){width=host.clientWidth;height=host.clientHeight;renderer.setSize(width,height);const aspect=width/height;const view=aspect<.85?19.8/aspect:Math.max(13.9,18.5/aspect);camera.left=-view*aspect/2;camera.right=view*aspect/2;camera.top=view/2;camera.bottom=-view/2;camera.zoom=zoom;camera.updateProjectionMatrix();}
 new ResizeObserver(resize).observe(host);resize();
 document.getElementById('zoom-in').onclick=()=>{zoom=Math.min(1.45,zoom+.1);resize();};document.getElementById('zoom-out').onclick=()=>{zoom=Math.max(.7,zoom-.1);resize();};document.getElementById('reset-view').onclick=()=>{zoom=1;resize();};
 const keys=new Set();let nearest=null;
 function clearKeys(){keys.clear();}
 const aliases={arrowup:'w',arrowdown:'s',arrowleft:'a',arrowright:'d'};
 window.addEventListener('keydown',e=>{if(isBlocked()||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement?.tagName))return;const key=aliases[e.key.toLowerCase()]||e.key.toLowerCase();if('wasd'.includes(key)&&key.length===1){e.preventDefault();keys.add(key);}if(key==='t'&&!e.repeat){e.preventDefault();if(nearest)onChat(nearest);}});
 window.addEventListener('keyup',e=>keys.delete(aliases[e.key.toLowerCase()]||e.key.toLowerCase()));window.addEventListener('blur',clearKeys);document.addEventListener('visibilitychange',clearKeys);
 document.querySelectorAll('[data-move]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();if(isBlocked())return;b.setPointerCapture(e.pointerId);keys.add(b.dataset.move);});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>keys.delete(b.dataset.move));});
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();host.addEventListener('pointerdown',e=>{if(isBlocked())return;host.focus();const r=host.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(actors.map(p=>p.root),true);if(hits[0])onChat(hits[0].object.userData.agent);});
 function updateStates(){actors.forEach(p=>{const a=p.agent;const state=a.state==='working'?['閱讀需求','建立分支','實作中','驗證中'][a.step]:a.state==='done'?'✓ 完成，準備報告':'● 隨時可以聊';p.label.innerHTML=`<span class="tag"><span style="color:${a.color}">●</span>${a.name}</span><small>${state}</small>`;});onHint(nearest);}
 function canWalk(x,z){return x>-5.75&&x<5.8&&z>-4.55&&z<4.8&&!obstacles.some(o=>Math.abs(x-o.x)<o.w/2+.22&&Math.abs(z-o.z)<o.d/2+.22);}
 const v=new THREE.Vector3();function placeLabel(label,root,up){v.copy(root.position);v.y+=up;v.project(camera);label.style.left=`${(v.x*.5+.5)*width}px`;label.style.top=`${(-v.y*.5+.5)*height}px`;label.hidden=v.x<-.95||v.x>.95||v.y<-1||v.y>1;}
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let last=performance.now(),time=0;
 function frame(now){const dt=Math.min((now-last)/1000,.05);last=now;if(document.hidden)return;time+=dt;
  let dx=0,dz=0;if(!isBlocked()){const horizontal=Number(keys.has('d'))-Number(keys.has('a')),vertical=Number(keys.has('s'))-Number(keys.has('w'));dx=horizontal*.825+vertical*.565;dz=-horizontal*.565+vertical*.825;}
  const moving=Math.hypot(dx,dz)>.1;if(moving){const norm=Math.hypot(dx,dz),step=dt*3.1;dx=dx/norm*step;dz=dz/norm*step;const p=player.root.position;if(canWalk(p.x+dx,p.z))p.x+=dx;if(canWalk(p.x,p.z+dz))p.z+=dz;player.root.rotation.y=Math.atan2(dx,dz);}
  player.body.position.y=moving&&!reduced.matches?Math.abs(Math.sin(time*10))*.045:0;player.legs.forEach((l,i)=>l.rotation.x=moving?Math.sin(time*10+i*Math.PI)*.48:0);player.arms.forEach((l,i)=>l.rotation.x=moving?Math.sin(time*10-i*Math.PI)*.4:0);
  ring.position.x=player.root.position.x;ring.position.z=player.root.position.z;
  let closest=null,min=2.15;
  actors.forEach((p,i)=>{const a=p.agent,done=a.state==='done',work=a.state==='working';const targetY=done?0:.19;const blend=reduced.matches?1:1-Math.exp(-dt*7);p.root.position.y=THREE.MathUtils.lerp(p.root.position.y,targetY,blend);p.body.position.y=THREE.MathUtils.lerp(p.body.position.y,done?0:-.26,blend);p.root.position.z=THREE.MathUtils.lerp(p.root.position.z,a.z+(done?1.45:.98),blend);p.root.rotation.y=THREE.MathUtils.lerp(p.root.rotation.y,done?.3:work?Math.PI:0,blend);p.legs.forEach(l=>l.rotation.x=THREE.MathUtils.lerp(l.rotation.x,done?0:-1.15,blend));p.arms.forEach((arm,k)=>{arm.rotation.x=done?(k===0?-.8:0):work?-1.1+(reduced.matches?0:Math.sin(time*12+k)*.08):-.28;arm.rotation.z=done&&k===0?-.65+(reduced.matches?0:Math.sin(time*4)*.18):0;});
   placeLabel(p.label,p.root,2.13);const d=player.root.position.distanceTo(p.root.position);if(d<min){min=d;closest=a;}
  });
  if(nearest!==closest){nearest=closest;onHint(nearest);}placeLabel(playerLabel,player.root,2.14);renderer.render(scene,camera);
 }
 renderer.setAnimationLoop(frame);
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer.setAnimationLoop(null);document.getElementById('scene-message').textContent='3D 顯示已中斷。請重新整理；你仍可使用成員面板派工。';});
 updateStates();return {clearKeys,updateStates};
}
