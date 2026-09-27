import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const chapters = [
  ['WIDE SHOT', '「這裡」，其實不只一個地方。', '你看到的是桌面介面；檔案與指令有自己的工作環境；產生回應的模型則透過服務連接。這座模型把三者放在同一張地圖，讓彼此的關係變得可見。', [12, 11, 16], [0, 1, 0]],
  ['CLOSE-UP / INTERFACE', '你打開的，是協作的入口。', '在這次製作情境中，我透過 Codex 桌面與你協作。對話視窗接收需求，顯示進度與成果；眼前這張桌子是介面的空間化比喻，不是對你的房間做掃描。', [-.6, 5, 9], [-4.6, 1.3, .7]],
  ['EXPLODED VIEW / WORKSPACE', '檔案有地址，工作有現場。', '此頁建立於本機 htmls 專案，命令透過 zsh 執行。分層模型把原始檔、工作目錄和執行環境拆開；按「分層展開」，看看抽象的工作區如何疊在一起。', [3.8, 6.5, 9], [-1.35, 1, 0]],
  ['DETAIL / TOOL EXECUTION', '工具，讓文字變成具體的行動。', '需要讀檔、執行命令或檢查網頁時，模型提出工具呼叫，工作環境處理後回傳結果。這裡的機櫃代表工具執行層；不同工具可以在本機或連接的服務執行。', [6.8, 4.4, 8], [2.2, 1.4, -.1]],
  ['ORBIT / MODEL SERVICE', '我知道角色，未必知道座標。', '模型透過服務接收上下文、生成回應或工具呼叫。這個球體代表模型服務，不代表特定機房。實際推論在哪一台 GPU、哪一座資料中心，無法從這次對話確認。', [10, 6, 8], [5.2, 2.2, -1.9]],
  ['TRACKING SHOT / ROUND TRIP', '一次回答，是訊息的一次往返。', '上下文送往模型；需要時，工具呼叫返回工作環境，執行結果再交給模型，最後顯示回應。下方可以播放、暫停或逐步觀察這個簡化流程。', [10, 12, 17], [.1, 1.2, -.5]]
];
const objects = [
  ['A', '桌面入口', '對話、預覽與工作指令的入口。模型的回答在這裡被呈現，工具結果也在這裡成為可追蹤的工作紀錄。', '情境紀錄：Codex 桌面。本模型未讀取使用者螢幕。', [-4.6, 3, .6], 1],
  ['B', '本機工作區', '層板分別代表原始檔、工作目錄與執行環境。它們是概念上的層次，不是磁碟或記憶體的實際硬體結構。', '情境紀錄：htmls 專案 / zsh。僅呈現專案名稱。', [-1.4, 2.8, .8], 2],
  ['C', '工具執行層', '機櫃中的三組模組分別代表檔案、終端與瀏覽器。模型提出操作後，工具執行並回傳結果，模型才有新的觀察依據。', '機櫃為示意；各工具實際執行位置依環境而定。', [2.2, 3.7, 0], 3],
  ['D', '模型服務', '環形核心代表生成回應的模型服務。連線可攜帶上下文、工具呼叫與結果；此圖不揭示模型內部的推理內容。', '未知：資料中心位置、GPU 型號、實際推論拓樸。', [5.1, 4.8, -1.8], 4]
];
const stage = $('viewport'), canvas = $('world');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true});
} catch {
  $('fallback').innerHTML = '這個瀏覽器無法建立 WebGL 2 場景。<small>六幕導覽與流程文字仍可操作，也可閱讀下方完整筆記。</small>';
}
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, .1, 120);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = false;
controls.enablePan = false;
controls.minDistance = 4;
controls.maxDistance = 32;
controls.minPolarAngle = .2;
controls.maxPolarAngle = Math.PI / 2.1;
const cream = new THREE.MeshStandardMaterial({color: '#ece9dc', roughness: .8});
const edge = new THREE.MeshStandardMaterial({color: '#cccbb9', roughness: .8});
const dark = new THREE.MeshStandardMaterial({color: '#354a43', roughness: .55});
const green = new THREE.MeshStandardMaterial({color: '#6d9682', roughness: .55});
const orange = new THREE.MeshStandardMaterial({color: '#c75a36', roughness: .6});
const copper = new THREE.MeshStandardMaterial({color: '#bc8b5c', metalness: .45, roughness: .4});
const black = new THREE.MeshStandardMaterial({color: '#182d28', roughness: .4});
const light = new THREE.MeshStandardMaterial({color: '#b3d8b0', emissive: '#739c67', emissiveIntensity: .35});
const glass = new THREE.MeshPhysicalMaterial({color: '#84b5a8', transparent: true, opacity: .26, roughness: .25, metalness: .05, depthWrite: false, side: THREE.DoubleSide});
function box(parent, size, pos, material = cream) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  m.position.set(...pos); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function cylinder(parent, radius, height, pos, material = dark, sides = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, sides), material);
  m.position.set(...pos); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function textPlane(parent, text, width, pos, {bg = '#f0eee4', color = '#344c40', height = .35} = {}) {
  const c = document.createElement('canvas'); c.width = 768; c.height = 160;
  const ctx = c.getContext('2d'); ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = color; ctx.font = '500 55px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 384, 80);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({map: texture})); m.position.set(...pos); parent.add(m); return m;
}
function tube(points, material, radius = .035) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, radius, 8, false), material); mesh.castShadow = true; scene.add(mesh); return curve;
}
function island(x, z, width, depth, name) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  box(g, [width, .28, depth], [0, .14, 0]); box(g, [width - .15, .1, depth - .15], [0, -.06, 0], edge);
  for (const a of [-1, 1]) for (const b of [-1, 1]) cylinder(g, .08, .18, [a*(width/2-.24), -.19, b*(depth/2-.24)], copper);
  textPlane(g, name, width-.3, [0, .16, depth/2+.006], {height:.16}); return g;
}
const desk = island(-4.5, .6, 3.2, 3.1, 'A / INTERFACE');
box(desk, [2.55, .14, 1.55], [0, 1.08, 0], edge);
for (const x of [-1.07, 1.07]) for (const z of [-.54, .54]) box(desk, [.085, .76, .085], [x, .64, z], dark);
box(desk, [.68, .065, .42], [0, 1.18, -.24], dark);
box(desk, [.13, .44, .11], [0, 1.37, -.3], dark);
box(desk, [1.5, .93, .095], [0, 1.9, -.32], dark);
box(desk, [1.36, .77, .02], [0, 1.91, -.26], black);
// Tiny interface: sidebar, prompt, response and cursor, all actual geometry.
box(desk, [.27, .69, .025], [-.5, 1.92, -.245], green);
for(let i=0;i<5;i++)box(desk,[.66-(i%3)*.13,.025,.015],[.04,2.16-i*.105,-.24],i===0?orange:cream);
box(desk, [.78, .095, .02], [.12, 1.63, -.24], edge);
box(desk, [.93, .05, .36], [-.05, 1.18, .44], cream);
for(let r=0;r<3;r++)for(let k=0;k<10;k++)box(desk,[.065,.016,.063],[-.44+k*.086,1.214,.33+r*.1],edge);
box(desk, [.2, .06, .28], [.74, 1.19, .4], dark);
cylinder(desk,.105,.23,[-1,1.25,.35],orange);
const handle=new THREE.Mesh(new THREE.TorusGeometry(.075,.02,8,20),orange);handle.position.set(-1.12,1.27,.35);desk.add(handle);
// Lamp with angled neck and a reading pool.
cylinder(desk,.16,.04,[.95,1.18,-.45],dark);box(desk,[.035,.6,.035],[.95,1.5,-.45],copper);
const neck=box(desk,[.035,.4,.035],[.84,1.91,-.45],copper);neck.rotation.z=-.7;
const shade=new THREE.Mesh(new THREE.ConeGeometry(.2,.2,32,1,true),green);shade.position.set(.72,2.04,-.45);desk.add(shade);
box(desk,[.65,.12,.63],[0,.62,1.06],orange);box(desk,[.65,.62,.08],[0,.93,1.35],orange);
for(const x of [-.24,.24])for(const z of [.84,1.27])box(desk,[.04,.31,.04],[x,.4,z],dark);
// A small plant and leaves add a familiar human scale.
cylinder(desk,.16,.28,[-1.22,.46,-1.02],edge);
for(let i=0;i<6;i++){const leaf=new THREE.Mesh(new THREE.SphereGeometry(.18,12,8),green);leaf.scale.set(.5,1.9,.7);leaf.position.set(-1.22+Math.sin(i*2.4)*.14,.77+(i%2)*.1,-1.02+Math.cos(i*2.4)*.12);leaf.rotation.z=Math.sin(i)*.7;desk.add(leaf);}
const work = island(-1.2, .5, 2.5, 2.9, 'B / WORKSPACE');
const layers=[];
for(let i=0;i<3;i++){
  const layer=new THREE.Group();layer.position.y=.48+i*.45;work.add(layer);layers.push(layer);
  box(layer,[2.05,.13,2.22],[0,0,0],i===0?dark:cream);
  for(const x of [-.82,.82])for(const z of [-.9,.9])cylinder(layer,.04,.31,[x,.21,z],copper,12);
  textPlane(layer,['ENV / ZSH','PROJECT / HTMLS','SOURCE / FILES'][i],1.8,[0,.025,1.12],{height:.15,bg:i===0?'#354a43':'#f0eee4',color:i===0?'#ece9dc':'#344c40'});
  if(i===0){for(let j=0;j<4;j++)box(layer,[.32,.05,.7],[-.66+j*.44,.09,0],green);}
  if(i===1){for(let j=0;j<5;j++)box(layer,[1.45,.032,.19],[0,.09,-.68+j*.31],j%2?edge:green);}
  if(i===2){for(let j=0;j<3;j++){box(layer,[.46,.55,.065],[-.59+j*.58,.33,-.13+j*.1],j===1?orange:green);box(layer,[.22,.08,.07],[-.7+j*.58,.64,-.13+j*.1],j===1?orange:green);}}
}
const rack = island(2, 0, 2.4, 2.65, 'C / TOOLS');
box(rack,[1.6,2.64,1.4],[0,1.66,0],dark);
box(rack,[1.43,2.43,.035],[0,1.66,.724],black);
for(let i=0;i<9;i++){
  box(rack,[1.31,.205,.14],[0,.61+i*.255,.77],i%3===0?green:edge);
  for(let j=0;j<6;j++)box(rack,[.018,.09,.015],[-.53+j*.064,.61+i*.255,.851],dark);
  box(rack,[.075,.035,.018],[.49,.61+i*.255,.851],light);
}
for(const y of [.88,1.65,2.42])textPlane(rack,['FILES','SHELL','BROWSER'][Math.round((y-.88)/.77)],.5,[.18,y,.86],{height:.1});
for(let j=0;j<7;j++)box(rack,[.018,2.3,.065],[.812,1.68,-.5+j*.16],edge);
box(rack,[.065,2.55,1.35],[.87,1.67,0],glass);
for(let j=0;j<3;j++)tube([[2.6,.5+j*.15,-.7],[3,.5+j*.15,-.9],[3,.3,-1.4],[1.5,.3,-1.5]],j===0?orange:copper,.025);
const model = island(5.1, -1.8, 3.3, 3.3, 'D / MODEL SERVICE');
cylinder(model,1.28,.19,[0,.43,0],dark,64);cylinder(model,1.02,.15,[0,.6,0],edge,64);
for(let i=0;i<12;i++){const a=i/12*Math.PI*2;cylinder(model,.045,.46,[Math.cos(a)*1.13,.77,Math.sin(a)*1.13],copper,12);}
const orb=new THREE.Group();orb.position.y=2.24;model.add(orb);
const shell=new THREE.Mesh(new THREE.IcosahedronGeometry(1.15,1),glass);orb.add(shell);
const wire=new THREE.LineSegments(new THREE.EdgesGeometry(shell.geometry),new THREE.LineBasicMaterial({color:'#719589',transparent:true,opacity:.5}));orb.add(wire);
const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.52,1),green);orb.add(core);
const coreEdge=new THREE.LineSegments(new THREE.EdgesGeometry(core.geometry),new THREE.LineBasicMaterial({color:'#c8decc'}));orb.add(coreEdge);
for(let i=0;i<3;i++){
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.34+i*.09,.018,8,96),i===1?orange:copper);ring.rotation.set(Math.PI/2+i*.48,i*.7,i*.5);orb.add(ring);
}
for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const node=new THREE.Mesh(new THREE.SphereGeometry(.065,12,8),orange);node.position.set(Math.cos(a)*1.15,Math.sin(a*2)*.5,Math.sin(a)*1.15);orb.add(node);}
cylinder(model,.06,1.25,[0,1.2,0],copper);
// Orthogonal routes are illustrative connections, not physical network topology.
const routes = [
  tube([[-4.5,.4,2.3],[-4.5,.45,3],[-2,.45,3],[1,.45,3],[4,.45,3],[5.1,.6,2],[5.1,.8,-1.8]],orange,.045),
  tube([[5.1,.8,-1.8],[4.5,.8,-.7],[4.1,.7,1.3],[2,.6,1.5],[2,1,0]],orange,.045),
  tube([[2,1,0],[2,.65,1.7],[.3,.65,1.7],[-1.2,.7,.5]],green,.04),
  tube([[2.15,1,0],[2.15,.6,1.68],[4.28,.7,1.48],[4.68,.8,-.7],[5.25,.8,-1.8]],green,.04),
  tube([[5.25,.8,-1.8],[5.28,.5,2],[4,.45,3.18],[1,.45,3.18],[-2,.45,3.18],[-4.68,.45,3.18],[-4.68,.4,2.3]],green,.045)
];
const packet=new THREE.Mesh(new THREE.SphereGeometry(.105,16,12),new THREE.MeshBasicMaterial({color:'#f47836'}));scene.add(packet);packet.visible=false;
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.12}));ground.rotation.x=-Math.PI/2;ground.position.y=-.32;ground.receiveShadow=true;scene.add(ground);
const grid=new THREE.GridHelper(18,36,0xc4cbbd,0xd9ddd2);grid.position.y=-.305;grid.material.transparent=true;grid.material.opacity=.46;scene.add(grid);
scene.add(new THREE.HemisphereLight('#fff8df','#8d9f8c',3));
const sun=new THREE.DirectionalLight('#fff6e3',4.1);sun.position.set(-5,12,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:1,far:40});sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;sun.shadow.radius=3;scene.add(sun);
const fill=new THREE.DirectionalLight('#dbede6',1.7);fill.position.set(8,5,-5);scene.add(fill);
if(renderer){renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor('#f2f0e9',0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;$('fallback').hidden=true;}

let current=0, tour=false, tourElapsed=0, transition=null, expanded=false, expansion=0, flowIndex=-1, flowElapsed=0, flowRunning=false, raf=0, last=0, lost=false;
// Keep playback controls next to the model when the lab scrolls out of view.
const flowOverlay=document.createElement('div');flowOverlay.className='flow-overlay';flowOverlay.hidden=true;
flowOverlay.innerHTML='<span id="flow-caption"></span><div><button id="stage-pause">暫停</button><button id="stage-step">下一步 →</button><button id="stage-close" aria-label="關閉流程展示">×</button></div>';
stage.append(flowOverlay);
const hotspotButtons=objects.map((o,i)=>{
  const b=document.createElement('button');b.className='hotspot';b.innerHTML=`<b>${o[0]}</b>${o[1]}`;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>{stopTour();selectScene(o[5]);inspect(i);});$('hotspots').append(b);return b;
});
function inspect(index){
  const o=objects[index];$('object-id').textContent=o[0];$('object-title').textContent=o[1];$('object-description').textContent=o[2];$('object-fact').textContent=o[3];hotspotButtons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
}
function cameraPosition(index){const p=new THREE.Vector3(...chapters[index][3]);const t=new THREE.Vector3(...chapters[index][4]);if(stage.clientWidth<550)p.sub(t).multiplyScalar(index===0||index===5?1.16:1.05).add(t);return p;}
function selectScene(index, immediate=false){
  current=index;const c=chapters[index];$('shot-label').textContent=`0${index+1} / ${c[0]}`;$('scene-title').textContent=c[1];$('scene-description').textContent=c[2];$('chapter-count').textContent=`0${index+1} / 06`;$('view-mode').textContent=index===0?'總覽 / OVERVIEW':c[0];
  document.querySelectorAll('[data-scene]').forEach((b,i)=>{if(i===index)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
  if(index>0&&index<5)inspect(index-1);
  const dest=cameraPosition(index), target=new THREE.Vector3(...c[4]);
  if(immediate||reduced.matches){camera.position.copy(dest);controls.target.copy(target);controls.update();transition=null;}else transition={from:camera.position.clone(),to:dest,startTarget:controls.target.clone(),target,elapsed:0};
  schedule();
}
function stopTour(){tour=false;$('tour').innerHTML='開始六幕導覽 <span>↗</span>';$('tour').setAttribute('aria-pressed','false');}
function syncFlow(){
  const messages=['將需求與可用內容組成上下文，交給模型服務。','模型判斷需要檔案內容，回傳一個工具呼叫。','工作環境執行讀檔，產生工具結果。','工具結果交回模型，成為後續回答的依據。','模型產生回應，由桌面介面呈現。'];
  [...$('flow').children].forEach((li,i)=>{li.classList.toggle('active',i===flowIndex);li.classList.toggle('done',i<flowIndex);if(i===flowIndex)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');});
  $('flow-status').textContent=(flowIndex>=0?`0${flowIndex+1} / `:'')+(messages[flowIndex]||'流程完成。一次協作，也可能重複多次工具迴圈。');
  $('flow-pause').disabled=flowIndex<0||flowIndex>4;$('flow-step').disabled=flowIndex<0||flowIndex>4;$('flow-pause').textContent=flowRunning?'暫停流程':'繼續流程';
  $('request').innerHTML=flowIndex<0?'送出一次請求 <span>→</span>':'重新送出 <span>↺</span>';
  flowOverlay.hidden=flowIndex<0;
  $('flow-caption').textContent=flowIndex<5?`0${flowIndex+1} / ${$('flow').children[flowIndex]?.textContent||''}`:'✓ 一次往返完成';
  $('stage-pause').textContent=flowRunning?'暫停':'繼續';$('stage-pause').disabled=flowIndex<0||flowIndex>4;$('stage-step').disabled=flowIndex<0||flowIndex>4;
}
function advanceFlow(){flowIndex++;flowElapsed=0;if(flowIndex>4){flowRunning=false;packet.visible=false;}syncFlow();schedule();}
function startFlow(){stopTour();selectScene(5);flowIndex=0;flowElapsed=0;flowRunning=!reduced.matches;syncFlow();stage.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'center'});schedule();}
function render(){
  if(!renderer||lost)return;
  const width=stage.clientWidth,height=stage.clientHeight;
  objects.forEach((o,i)=>{const p=new THREE.Vector3(...o[4]);if(i===1)p.y+=expansion*1.2;p.project(camera);const b=hotspotButtons[i];b.style.left=`${(p.x*.5+.5)*width}px`;b.style.top=`${(-p.y*.5+.5)*height}px`;b.hidden=p.z>1||p.z< -1||Math.abs(p.x)>.93||Math.abs(p.y)>.86;});
  renderer.render(scene,camera);
}
function tick(now){
  raf=0;const dt=last?Math.min(now-last,60):0;last=now;
  if(tour){tourElapsed+=dt;const next=Math.min(5,Math.floor(tourElapsed/8000));if(next!==current)selectScene(next);$('tour-progress').style.width=`${Math.min(100,tourElapsed/48000*100)}%`;if(tourElapsed>=48000)stopTour();}
  if(transition){const t=transition;t.elapsed+=dt;const f=Math.min(t.elapsed/1300,1),s=f*f*(3-2*f);camera.position.lerpVectors(t.from,t.to,s);controls.target.lerpVectors(t.startTarget,t.target,s);controls.update();if(f===1)transition=null;}
  const desired=expanded?1:0;expansion=reduced.matches?desired:THREE.MathUtils.damp(expansion,desired,7,dt/1000);if(Math.abs(expansion-desired)<.001)expansion=desired;
  layers.forEach((l,i)=>l.position.y=.48+i*.45+expansion*i*.62);
  if(flowRunning){flowElapsed+=dt;if(flowElapsed>=2600)advanceFlow();}
  if(flowIndex>=0&&flowIndex<5){packet.visible=true;packet.position.copy(routes[flowIndex].getPointAt(Math.min(flowElapsed/2600,1)));}
  render();
  if(tour||transition||flowRunning||expansion!==desired)schedule();else last=0;
}
function schedule(){if(!raf&&!document.hidden&&!lost)raf=requestAnimationFrame(tick);}
function resize(){if(renderer)renderer.setSize(stage.clientWidth,stage.clientHeight,false);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();schedule();}
new ResizeObserver(resize).observe(stage);
controls.addEventListener('start',()=>{transition=null;stopTour();$('view-mode').textContent='自由環繞 / FREE ORBIT';});
controls.addEventListener('change',schedule);
document.querySelectorAll('[data-scene]').forEach(b=>b.addEventListener('click',()=>{stopTour();selectScene(Number(b.dataset.scene));}));
$('tour').disabled=false;$('tour').setAttribute('aria-pressed','false');
$('tour').addEventListener('click',()=>{if(tour){stopTour();return;}tour=true;tourElapsed=0;selectScene(0);$('tour').innerHTML='停止導覽 <span>Ⅱ</span>';$('tour').setAttribute('aria-pressed','true');schedule();});
$('reset').disabled=!renderer;$('reset').addEventListener('click',()=>{stopTour();selectScene(current);});
$('explode').disabled=!renderer;$('explode').addEventListener('click',()=>{stopTour();expanded=!expanded;$('explode').setAttribute('aria-pressed',String(expanded));$('explode').textContent=expanded?'⊟ 合攏層板':'⊞ 分層展開';selectScene(2);});
$('request').disabled=false;$('request').addEventListener('click',startFlow);
$('flow-pause').addEventListener('click',()=>{flowRunning=!flowRunning;syncFlow();schedule();});
$('flow-step').addEventListener('click',()=>{flowRunning=false;advanceFlow();});
$('stage-pause').addEventListener('click',()=>{$('flow-pause').click();});
$('stage-step').addEventListener('click',()=>{$('flow-step').click();});
$('stage-close').addEventListener('click',()=>{flowIndex=-1;flowRunning=false;packet.visible=false;syncFlow();$('flow-status').textContent='流程已關閉，可重新送出一次請求。';schedule();});
canvas.addEventListener('keydown',e=>{
  if(e.altKey||e.ctrlKey||e.metaKey)return;
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','=','Home'].includes(e.key))return;
  e.preventDefault();stopTour();transition=null;
  if(e.key==='Home'){selectScene(current);return;}
  const v=camera.position.clone().sub(controls.target),s=new THREE.Spherical().setFromVector3(v);
  if(e.key==='ArrowLeft')s.theta-=.13;if(e.key==='ArrowRight')s.theta+=.13;if(e.key==='ArrowUp')s.phi-=.1;if(e.key==='ArrowDown')s.phi+=.1;
  if(e.key==='+'||e.key==='=')s.radius*=.9;if(e.key==='-')s.radius*=1.1;
  s.phi=THREE.MathUtils.clamp(s.phi,controls.minPolarAngle,controls.maxPolarAngle);s.radius=THREE.MathUtils.clamp(s.radius,controls.minDistance,controls.maxDistance);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));controls.update();$('view-mode').textContent='自由環繞 / FREE ORBIT';schedule();
});
reduced.addEventListener('change',e=>{if(e.matches){stopTour();flowRunning=false;syncFlow();selectScene(current,true);}});
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(raf);raf=0;last=0;if(!document.hidden)schedule();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(raf);raf=0;last=0;stopTour();flowRunning=false;syncFlow();$('fallback').hidden=false;$('fallback').innerHTML='3D 顯示暫時中斷。<small>文字導覽仍可閱讀；圖形環境恢復後會重新顯示。</small>';$('hotspots').hidden=true;});
canvas.addEventListener('webglcontextrestored',()=>{lost=false;$('fallback').hidden=true;$('hotspots').hidden=false;resize();schedule();});
if(!renderer)$('hotspots').hidden=true;
resize();selectScene(0,true);
