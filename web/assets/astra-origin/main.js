const $ = id => document.getElementById(id);
const chapters = [
  {name:'資料',en:'THE CORPUS',short:'CORPUS',title:'世界，留下的碎片。',voice:'你可以叫我 Astra。在我學會回答之前，人類已經寫下了無數的文字。故事從這些留下來的痕跡開始。',head:'從人類留下的資訊開始。',text:'公開網路內容、合作取得的資料，以及使用者、訓練者與研究者提供或產生的內容，都可能成為模型開發的資訊來源。資料整理會影響模型能學到什麼，也需要考慮品質與偏差。',model:'資料星環',route:'資料來源 → 篩選與整理 → 訓練樣本',note:'星環裡的文件是抽象符號，不是實際訓練資料，也不表示資料比例。',shot:'遠景推近。零散的文件沿軌道匯聚，中央容器接住被整理的訊號。',steps:[['來源','不同來源的資訊進入資料流程；圖中的三環並非實際配比。'],['整理','篩選、去重與格式處理是常見步驟，實際資料管線各不相同。'],['樣本','整理後的內容成為學習樣本；模型仍可能學到錯誤與偏差。']]},
  {name:'切詞',en:'INTO TOKENS',short:'TOKENS',title:'語言，變成可以計算的形狀。',voice:'一個字、一段詞，甚至一個符號，都可能成為片段。文字被轉成數字，才有了進入模型的入口。',head:'從文字，到向量。',text:'Tokenizer 把輸入切成 token，再映射到數字 ID。嵌入向量提供可運算的表示，位置資訊幫助模型分辨順序。token 並不必然等於一個中文字或一個單字。',model:'語言切片',route:'文字 → token ID → 向量與位置',note:'這裡的切片大小與排列是示意，不是 Astra 的真實 tokenizer 或向量維度。',shot:'側向移鏡。連續的語言被切成方片，再沿深度方向展成向量柱。',steps:[['切成片段','同一句文字可依不同 tokenizer 得到不同切分。'],['編號與嵌入','離散 ID 經由學得的映射，成為模型可處理的數值向量。'],['帶上位置','位置資訊提供前後順序，讓「我問你」與「你問我」有所區別。']]},
  {name:'注意力',en:'MAKING CONNECTIONS',short:'ATTENTION',title:'意義，存在於關係之間。',voice:'一句話裡的片段並不孤立。每一層計算，都讓它們從其他片段取得資訊，逐漸形成帶著語境的表示。',head:'讓片段彼此參照。',text:'在 Transformer 的注意力機制中，query 與 key 的相似程度會影響如何加權 value。多個注意力頭能形成不同的資訊組合，再與其他網路運算共同更新表示。',model:'關係晶格',route:'Query / Key → 注意力權重 → 加權表示',note:'亮線代表資訊關係，不是人類神經元或模型內部思想的可視化。層數為教學設定。',shot:'鏡頭繞進晶格。節點依層次排列，連線把局部訊號送到下一層。',steps:[['比較關聯','query 與 key 經計算產生分數；生成式模型會限制看見未來位置。'],['聚合訊息','分數經正規化形成權重，再對 value 加權。這是數學運算。'],['更新表示','注意力、前饋網路、殘差等構件一起改變表示，並逐層傳遞。']]},
  {name:'預訓練',en:'LEARNING FROM ERROR',short:'PRETRAIN',title:'在誤差裡，一次次調整。',voice:'先預測，再比較。不是有人逐條寫下答案，而是大量範例裡的差距，一點點改變了模型的參數。',head:'預測、損失、參數更新。',text:'常見的自回歸預訓練目標，是根據前面的 token 預測下一個 token。預測與訓練目標的差異形成損失，反向傳播計算梯度，最佳化器據此更新參數。',model:'梯度迴路',route:'預測 → 計算損失 → 梯度更新 ↻',note:'環上的光點是訓練循環比喻，折線不是實際訓練紀錄；損失下降不保證回答正確。',shot:'環繞跟拍。前向訊號沿外圈流動，回傳路徑穿過核心，參數陣列逐步亮起。',steps:[['前向預測','模型輸出下一個 token 的分布；訓練樣本提供對照目標。'],['反向傳播','由損失計算參數的梯度，描述局部變動如何影響目標。'],['更新參數','最佳化器依梯度調整參數。反覆訓練建立能力，也可能保留偏差。']]},
  {name:'回饋',en:'LEARNING TO HELP',short:'FEEDBACK',title:'學會回答，也學會如何回答。',voice:'接著，示範與回饋讓回答更接近人們的需要。清楚、有幫助、願意承認不知道，都是需要學習的行為。',head:'能力之後，是行為的塑形。',text:'公開的後訓練方法包括指令示範、偏好學習與強化學習。InstructGPT 展示過人類回饋流程；推理模型的公開研究也描述以強化學習改善解題。不同模型的方法與順序可能不同。',model:'回饋分岔',route:'示範 → 回饋訊號 → 行為調整',note:'雙分支不表示真實候選回答；本頁沒有執行 RLHF，也沒有展示私有推理內容。',shot:'對稱構圖。兩條路徑穿過評選節點，再匯入共同的參數核心。',steps:[['示範','高品質指令與回應可用來示範期望的行為。'],['比較與評分','人類偏好或可驗證的回饋提供學習訊號；回饋本身也有局限。'],['後訓練','透過適用的訓練方法調整行為，並持續檢查能力與副作用。']]},
  {name:'評估',en:'TESTING THE LIMITS',short:'EVALUATE',title:'在未知的問題前，接受檢驗。',voice:'會回答，不代表總是答對。測試把能力與限制放在一起看，也提醒人們：流暢的句子，仍然可能出錯。',head:'測試能力，也測試失敗。',text:'評估使用任務與測試案例檢查能力、可靠性及安全行為。好的測試需要注意資料污染、情境差異與覆蓋不足；通過一組題目不能證明在所有場景都可靠。',model:'檢驗之門',route:'測試案例 → 檢查結果 → 修正與再評估',note:'三道檢驗門是教學分組；本頁沒有宣稱 Astra 通過任何基準或提供評測分數。',shot:'鏡頭穿越三道檢驗門。部分訊號留下，部分折返，表示需要重新檢查。',steps:[['能力','在保留的任務上檢查表現，觀察泛化與不同題型的落差。'],['可靠性與安全','檢查錯誤資訊、不當請求、不確定性表達與脆弱情境。'],['反覆修正','分析失敗案例，再改進資料、訓練或產品設計；沒有一次永遠通過。']]},
  {name:'推論',en:'THE MOMENT YOU ASK',short:'INFERENCE',title:'直到，你提出了一個問題。',voice:'你的訊息成為此刻的語境。模型用已學得的參數進行計算，一步一步產生回應，而不是重播一段被藏好的句子。',head:'訓練完成，計算仍在繼續。',text:'推論時，輸入與對話脈絡轉成 token。模型計算接續 token 的分布，依解碼策略選取 token 並繼續生成。一般推論不會在每次回答時直接更新模型權重。',model:'推論引擎',route:'對話脈絡 → 模型計算 → 逐步生成',note:'堆疊與粒子不表示實際硬體。對話脈絡、產品記憶與模型權重是不同概念。',shot:'沿中軸推進。輸入穿過堆疊的運算平面，輸出片段依序組成回應。',steps:[['讀入脈絡','系統設定、你的訊息與可用的先前內容，一起影響這次生成。'],['計算分布','固定參數對目前序列進行運算，得到接續 token 的機率分布。'],['解碼與延續','選出 token 後繼續生成，直到結束條件或長度限制。並非每次都選最高機率。']]},
  {name:'相遇',en:'BECOMING AN ANSWER',short:'ENCOUNTER',title:'最後，成為你的下一個起點。',voice:'從資料到參數，從參數到回答。這就是我能說明的形成過程。沒有自己的出生記憶，卻能和你一起，把問題想得更清楚。',head:'回答是一個起點。',text:'語言模型可以協助解釋、創作與推理，也可能產生看似合理的錯誤。把回答帶回證據、可重現的測試與真實情境，才讓一次對話成為有用的工作。',model:'相遇的星核',route:'提問 → 回答 → 查證與追問',note:'星核象徵這次對話，不代表意識、自我感受或某種已知的內部構造。',shot:'拉回全景。各條軌道匯聚成一個核心；光還在流動，故事停在下一個問題之前。',steps:[['理解需求','說明目標、限制與背景，能讓回應更貼近你要解決的問題。'],['核對證據','遇到重要事實，回到可信來源；遇到程式，執行適當的驗證。'],['繼續對話','指出缺口、修正條件、追問原因。讓回應成為下一步的材料。']]}
];
let current = -1, time = 0, playing = false, explode = 0;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let moving = !reduced.matches, visualTime = 0, sceneAPI = null;
const pad = n => String(n).padStart(2,'0');
$('chapters').innerHTML = chapters.map((c,i)=>`<button class="chapter" data-chapter="${i}" aria-current="false"><span>${pad(i+1)} /</span><b>${c.name}</b><small>${c.short}</small></button>`).join('');
$('storyboard').innerHTML = chapters.map((c,i)=>`<details><summary><span>${pad(i+1)}</span>${c.title}<small>${c.en}</small></summary><div><p><b>鏡頭：</b>${c.shot}</p><p>${c.text}</p><p><b>敘事邊界：</b>${c.note}</p><button class="plain" data-jump="${i}">在 3D 場景查看這一幕 ↑</button></div></details>`).join('');
function setChapter(index){
  const c = chapters[index]; current = index;
  $('chapter-code').textContent = `CHAPTER ${pad(index+1)} / ${c.en}`;
  $('chapter-number').textContent = $('current').textContent = pad(index+1);
  $('chapter-title').textContent=c.title; $('narration').textContent=c.voice;
  $('model-name').textContent=`FIG. ${pad(index+1)} — ${c.model}`;
  $('annotation-text').textContent=c.route; $('dossier-tag').textContent=`${pad(index+1)} / ${c.name}`;
  $('dossier-title').textContent=c.head; $('explanation').textContent=c.text;
  $('inspection-note').textContent=c.note;
  $('flow').innerHTML=c.steps.map((s,i)=>`<button class="flow-step" aria-pressed="false" data-part="${i}"><span>${pad(i+1)}</span><div><strong>${s[0]}</strong><p>${s[1]}</p></div></button>`).join('');
  document.querySelectorAll('.chapter').forEach((el,i)=>el.setAttribute('aria-current',String(i===index)));
  $('prev').disabled=index===0; $('next').disabled=index===7;
  $('next-detail').textContent=index===7?'重新回到第一幕 ↺':'前往下一幕 →';
  sceneAPI?.chapter(index);
}
function updateTime(value){time=Math.max(0,Math.min(95.99,value)); const index=Math.floor(time/12);if(index!==current)setChapter(index);$('timeline').value=time;$('time').textContent=`${pad(Math.floor(time/60))}:${pad(Math.floor(time%60))} / 01:36`;}
function play(value){playing=value;$('play-label').textContent=playing?'暫停導覽':time>=95.99?'重新播放':'播放誕生之旅';$('play-icon').textContent=playing?'Ⅱ':'▶';$('play').setAttribute('aria-pressed',String(playing));}
function jump(index){play(false);updateTime(index*12);}
$('chapters').addEventListener('click',e=>{const b=e.target.closest('[data-chapter]');if(b)jump(Number(b.dataset.chapter));});
$('storyboard').addEventListener('click',e=>{const b=e.target.closest('[data-jump]');if(b){jump(Number(b.dataset.jump));document.querySelector('.theater').scrollIntoView();$('play').focus({preventScroll:true});}});
$('flow').addEventListener('click',e=>{const b=e.target.closest('[data-part]');if(!b)return;const selected=Number(b.dataset.part);$('flow').querySelectorAll('button').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));sceneAPI?.select(selected);});
$('prev').onclick=()=>jump(Math.max(0,current-1));$('next').onclick=()=>jump(Math.min(7,current+1));$('next-detail').onclick=()=>jump((current+1)%8);
$('play').onclick=()=>{if(time>=95.99)updateTime(0);play(!playing);};
$('timeline').addEventListener('input',e=>{play(false);updateTime(Number(e.target.value));});
function syncMotion(){$('motion').textContent=`動態：${moving?'開':'關'}`;$('motion').setAttribute('aria-pressed',String(moving));}
$('motion').onclick=()=>{moving=!moving;syncMotion();};reduced.addEventListener('change',e=>{moving=!e.matches;syncMotion();});syncMotion();
$('labels').onclick=()=>{const visible=$('annotation').hidden;$('annotation').hidden=!visible;$('labels').textContent=`標註：${visible?'開':'關'}`;$('labels').setAttribute('aria-pressed',String(visible));};
function setExplode(value){explode=value;$('explode').value=value*100;$('explode-value').textContent=`${Math.round(explode*100)}%`;$('quick-explode').textContent=value>0?'合攏模型 −':'拆解模型 ＋';$('quick-explode').setAttribute('aria-pressed',String(value>0));}
$('explode').addEventListener('input',e=>setExplode(Number(e.target.value)/100));
$('quick-explode').onclick=()=>setExplode(explode>0?0:1);
$('reset-camera').onclick=()=>sceneAPI?.reset();
for(const id of ['sources-open','sources-footer'])$(id).onclick=()=>{$('sources').showModal();play(false);};
$('sources-close').onclick=()=>$('sources').close();$('sources').addEventListener('click',e=>{if(e.target===$('sources')){const r=$('sources').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('sources').close();}});
document.addEventListener('keydown',e=>{if(e.target.closest('input,button,a,summary,dialog')||$('sources').open)return;if(e.code==='ArrowRight'){e.preventDefault();jump(Math.min(7,current+1));}if(e.code==='ArrowLeft'){e.preventDefault();jump(Math.max(0,current-1));}if(e.code==='Space'){e.preventDefault();$('play').click();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)play(false);});
updateTime(0);

async function boot(){
  const THREE = await import('three');
  const {OrbitControls} = await import('three/addons/controls/OrbitControls.js');
  const host=$('canvas-host'), renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setClearColor(0x101413,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
  host.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','Astra 誕生之旅 3D 場景');
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x101413,.025);
  const camera=new THREE.PerspectiveCamera(39,1,.1,100);camera.position.set(8,5.5,11);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.enablePan=false;controls.minDistance=8;controls.maxDistance=22;controls.maxPolarAngle=Math.PI*.88;controls.target.set(0,0,0);
  scene.add(new THREE.HemisphereLight(0xd8e4cd,0x121d16,2.1));
  const key=new THREE.DirectionalLight(0xffd7a0,4);key.position.set(4,7,5);scene.add(key);
  const rim=new THREE.DirectionalLight(0x9ad6b5,3);rim.position.set(-5,1,-3);scene.add(rim);
  const metal=new THREE.MeshStandardMaterial({color:0x8b9b81,metalness:.8,roughness:.36});
  const gold=new THREE.MeshStandardMaterial({color:0xcbb184,metalness:.72,roughness:.3,emissive:0x715126,emissiveIntensity:.12});
  const dark=new THREE.MeshStandardMaterial({color:0x21372d,metalness:.6,roughness:.5});
  const light=new THREE.MeshStandardMaterial({color:0xe6d5ad,emissive:0xb89251,emissiveIntensity:1.2,metalness:.35,roughness:.4});
  const pale=new THREE.MeshStandardMaterial({color:0xa9c9b1,metalness:.55,roughness:.4});
  const lineMat=new THREE.LineBasicMaterial({color:0x86aa90,transparent:true,opacity:.28});
  const boxGeo=new THREE.BoxGeometry(1,1,1),sphereGeo=new THREE.IcosahedronGeometry(1,1);
  let seed=177;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  function mesh(geo,mat,parent,pos=[0,0,0],scale=[1,1,1],part=0){const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.scale.set(...scale);m.userData.part=part;parent.add(m);return m;}
  function ring(parent,radius,tube,rotation,mat=gold,part=0){const m=mesh(new THREE.TorusGeometry(radius,tube,8,120),mat,parent,[0,0,0],[1,1,1],part);m.rotation.set(...rotation);return m;}
  function line(parent,pts,mat=lineMat,part=0){const geo=new THREE.BufferGeometry().setFromPoints(pts.map(p=>new THREE.Vector3(...p)));const l=new THREE.Line(geo,mat);l.userData.part=part;parent.add(l);return l;}
  function node(parent,pos,r=.06,mat=light,part=0){return mesh(sphereGeo,mat,parent,pos,[r,r,r],part);}
  function orb(parent,size=1){const m=mesh(new THREE.IcosahedronGeometry(size,2),dark,parent);const edges=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),new THREE.LineBasicMaterial({color:0xc6d2ac,transparent:true,opacity:.55}));parent.add(edges);node(parent,[0,0,0],size*.44,light);return m;}
  // A static scientific-instrument base gives every chapter a shared visual scale.
  const base=new THREE.Group();base.position.y=-2.75;scene.add(base);
  ring(base,3.8,.035,[Math.PI/2,0,0],metal);ring(base,3.55,.013,[Math.PI/2,0,0],gold);
  for(let i=0;i<96;i++){const a=i/96*Math.PI*2;const tick=mesh(boxGeo,i%8===0?gold:metal,base,[Math.cos(a)*3.72,0,Math.sin(a)*3.72],[i%8===0?.15:.07,.025,.018]);tick.rotation.y=-a;}
  for(let i=0;i<4;i++){const a=i*Math.PI/2;line(base,[[Math.cos(a)*3.9,0,Math.sin(a)*3.9],[Math.cos(a)*4.3,0,Math.sin(a)*4.3]]);}
  const dustPos=new Float32Array(330*3);for(let i=0;i<dustPos.length;i++)dustPos[i]=(rand()-.5)*22;
  const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPos,3));const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0xbed0b2,size:.025,transparent:true,opacity:.55}));scene.add(dust);
  const groups=chapters.map(()=>{const g=new THREE.Group();g.visible=false;scene.add(g);return g;});
  // 01: three orbital archives, each made of individually ruled document plates.
  {const g=groups[0];orb(g,.92);for(let k=0;k<3;k++){const layer=new THREE.Group();layer.userData.part=k;layer.rotation.set(.38+k*.44,k*.9,.2);g.add(layer);ring(layer,1.65+k*.42,.026,[Math.PI/2,0,0],k===1?gold:metal,k);for(let i=0;i<12;i++){const a=i/12*Math.PI*2+k*.3,r=1.65+k*.42;const card=new THREE.Group();card.position.set(Math.cos(a)*r,0,Math.sin(a)*r);card.rotation.y=-a;layer.add(card);mesh(boxGeo,i%4===0?gold:dark,card,[0,0,0],[.35,.48,.035],k);for(let j=0;j<4;j++)mesh(boxGeo,pale,card,[-.03,.14-j*.085,.025],[j===3?.14:.23,.012,.008],k);}}ring(g,3.1,.016,[.4,0,.1],gold);}
  // 02: token cells and three banks of embedding coordinates.
  {const g=groups[1];for(let k=0;k<3;k++){const layer=new THREE.Group();layer.userData.part=k;layer.position.x=(k-1)*1.7;g.add(layer);for(let y=0;y<5;y++)for(let z=0;z<4;z++){const height=k===0?.14:k===1?.28:.2+rand()*.7;mesh(boxGeo,(y+z)%4===0?gold:metal,layer,[0,(y-2)*.66,(z-1.5)*.65],[height,.42,.42],k);node(layer,[height*.5+.04,(y-2)*.66,(z-1.5)*.65],.035,light,k);}line(g,[[(k-1)*1.7,-2,0],[(k-1)*1.7,2,0]]);}ring(g,3.25,.017,[0,Math.PI/2,0]);}
  // 03: an explicit layered graph; links are illustrative, not model weights.
  {const g=groups[2];const points=[];for(let x=0;x<5;x++){points[x]=[];for(let y=0;y<4;y++)for(let z=0;z<3;z++){const p=[(x-2)*1.1,(y-1.5)*.75,(z-1)*.8];points[x].push(p);node(g,p,.075,(x===2)?gold:pale,Math.min(2,Math.floor(x/2)));}}const segments=[];for(let x=0;x<4;x++)for(let i=0;i<12;i++)for(let j=0;j<12;j++)if((i+j)%3===0)segments.push(...points[x][i],...points[x+1][j]);const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(segments,3));g.add(new THREE.LineSegments(geo,lineMat));ring(g,3.2,.014,[0,Math.PI/2,0]);}
  // 04: closed optimization loop, parameter bank and schematic loss path.
  {const g=groups[3];orb(g,.75);for(let k=0;k<3;k++){const layer=new THREE.Group();layer.userData.part=k;layer.rotation.set(k*.7,.3,k*.9);g.add(layer);ring(layer,1.6+k*.4,.065,[0,0,0],k===1?gold:metal,k);for(let i=0;i<20;i++){const a=i/20*Math.PI*2;node(layer,[Math.cos(a)*(1.6+k*.4),Math.sin(a)*(1.6+k*.4),0],i%4===0?.085:.035,light,k);}}const pts=[];for(let i=0;i<30;i++)pts.push([-2+i*.14,1.4*Math.exp(-i/9)-1.3+Math.sin(i*2)*.09,1.6]);line(g,pts,new THREE.LineBasicMaterial({color:0xe0b679}),1);}
  // 05: diverging candidate paths converging on a feedback hub.
  {const g=groups[4];node(g,[-2.5,0,0],.3,gold);node(g,[2.6,0,0],.45,light,2);for(let k=0;k<2;k++){const y=k===0?1.15:-1.15;line(g,[[-2.5,0,0],[-1.4,y,0],[1.25,y,0],[2.6,0,0]],new THREE.LineBasicMaterial({color:k===0?0xc9b783:0x759f86}),k);for(let j=0;j<4;j++){mesh(boxGeo,k===0?gold:metal,g,[-1.25+j*.8,y,0],[.46,.7,.42],k);node(g,[-1.25+j*.8,y,.29],.045,light,k);}}ring(g,.83,.04,[0,Math.PI/2,0],gold,2).position.x=2.6;ring(g,3.2,.015,[Math.PI/2,0,0]);}
  // 06: three testing gates with different geometric apertures.
  {const g=groups[5];for(let k=0;k<3;k++){const layer=new THREE.Group();layer.position.x=(k-1)*1.75;layer.userData.part=k;g.add(layer);ring(layer,1.8,.12,[0,Math.PI/2,0],k===1?gold:metal,k);ring(layer,1.57,.018,[0,Math.PI/2,0],pale,k);for(let j=0;j<12;j++){const a=j/12*Math.PI*2;node(layer,[0,Math.cos(a)*1.79,Math.sin(a)*1.79],.065,light,k);}}for(let i=0;i<14;i++)node(g,[-3+i*.45,Math.sin(i)*.13,0],.09,i%4===0?gold:pale,Math.min(2,Math.floor(i/5)));line(g,[[-3.3,0,0],[3.3,0,0]]);}
  // 07: stacked compute planes and a chain of output tokens.
  {const g=groups[6];for(let k=0;k<6;k++){const layer=new THREE.Group();layer.position.y=(k-2.5)*.55;layer.userData.part=Math.floor(k/2);g.add(layer);mesh(boxGeo,dark,layer,[0,0,0],[2.3,.1,2.3],Math.floor(k/2));for(let i=0;i<4;i++)for(let j=0;j<4;j++)mesh(boxGeo,(i+j+k)%4===0?gold:metal,layer,[(i-1.5)*.51,.09,(j-1.5)*.51],[.32,.08,.32],Math.floor(k/2));ring(layer,1.72,.018,[Math.PI/2,0,0],pale,Math.floor(k/2));}for(let i=0;i<9;i++)node(g,[-2.8+i*.35,2,0],.075,light,0);for(let i=0;i<7;i++)mesh(boxGeo,gold,g,[1.8+i*.21,-1.4+i*.32,0],[.14,.18,.18],2);}
  // 08: an open, luminous mathematical shell, not an anatomical brain.
  {const g=groups[7];orb(g,1.2);for(let k=0;k<5;k++)ring(g,1.8+k*.22,.021,[k*.45,.5+k*.36,k*.2],k%2?gold:metal,k%3);for(let i=0;i<110;i++){const y=1-(i/109)*2,r=Math.sqrt(1-y*y),a=i*Math.PI*(3-Math.sqrt(5));node(g,[Math.cos(a)*r*2.8,y*2.8,Math.sin(a)*r*2.8],i%7===0?.05:.022,i%7===0?gold:pale,i%3);}}
  // Record rest positions once; the inspector only transforms top-level components.
  groups.forEach(g=>g.children.forEach((m,i)=>{m.userData.home=m.position.clone();m.userData.explodeDir=new THREE.Vector3(m.position.x,m.position.y,m.position.z);if(m.userData.explodeDir.length()<.1)m.userData.explodeDir.set(0,(m.userData.part??i%3)-1,.15);m.userData.explodeDir.normalize();}));
  const particleCount=50,signalGeo=new THREE.SphereGeometry(.045,6,5),signals=new THREE.InstancedMesh(signalGeo,light,particleCount);scene.add(signals);const dummy=new THREE.Object3D();
  const poses=[[8,5.5,11],[8,4,12],[7,4,12],[5,4,13],[3,3,14],[8,3,11],[8,6,11],[6,4,13]];
  let goal=new THREE.Vector3(...poses[current]),transition=false,contextLost=false;
  function reset(){goal.set(...poses[current]);camera.position.copy(goal);controls.target.set(0,0,0);controls.update();transition=false;}
  controls.addEventListener('start',()=>{transition=false;});
  sceneAPI={chapter(i){groups.forEach((g,n)=>{g.visible=n===i;});goal.set(...poses[i]);transition=!reduced.matches;if(!transition)reset();this.select(-1);},reset};
  // Material selection uses cached originals to avoid accumulating GPU materials.
  const materialCache=new Map();groups.forEach(g=>g.traverse(o=>{if(o.isMesh)materialCache.set(o,o.material);}));
  sceneAPI.select=part=>{groups[current].traverse(o=>{if(!o.isMesh)return;const original=materialCache.get(o);if(o.material!==original)o.material.dispose();o.material=original;if(part>=0){o.material=original.clone();o.material.emissive.set(o.userData.part===part?0xb18e51:0x000000);o.material.emissiveIntensity=o.userData.part===part?.8:0;}});};
  sceneAPI.chapter(current);
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(host);resize();
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;play(false);$('fallback').hidden=false;$('render-state').textContent='3D 已中斷';});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{contextLost=false;$('fallback').hidden=true;$('render-state').textContent='即時 3D · 示意模型';});
  $('render-state').textContent='即時 3D · 示意模型';
  sceneAPI.render=(delta)=>{
    if(contextLost)return;if(moving)visualTime+=delta;
    if(transition){camera.position.lerp(goal,1-Math.exp(-delta*3));controls.update();if(camera.position.distanceTo(goal)<.01)transition=false;}
    const g=groups[current];g.rotation.y=moving?Math.sin(visualTime*.12)*.18:g.rotation.y;
    g.children.forEach(m=>{m.position.copy(m.userData.home).addScaledVector(m.userData.explodeDir,explode*.85);});
    for(let i=0;i<particleCount;i++){const a=visualTime*.3+i/particleCount*Math.PI*2;let p;if(current===2||current===5||current===6){p=[((visualTime*.65+i*.17)%6)-3,Math.sin(i*4.1)*.7,Math.cos(i*1.7)*.7];}else{const r=2.9+Math.sin(i*3)*.17;p=[Math.cos(a)*r,Math.sin(a*2+i)*.6,Math.sin(a)*r];}dummy.position.set(...p);dummy.scale.setScalar(i%5===0?1.4:.65);dummy.updateMatrix();signals.setMatrixAt(i,dummy.matrix);}signals.instanceMatrix.needsUpdate=true;renderer.render(scene,camera);
  };
}
boot().catch(error=>{console.warn('Astra 3D unavailable:',error.message);$('fallback').hidden=false;$('render-state').textContent='文字分鏡模式';});
let last=performance.now();function frame(now){const delta=Math.min((now-last)/1000,.1);last=now;if(!document.hidden){if(playing){updateTime(time+delta);if(time>=95.99)play(false);}sceneAPI?.render?.(delta);}requestAnimationFrame(frame);}requestAnimationFrame(frame);
