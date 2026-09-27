const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"\x27]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","\x27":"&#39;"}[c]));
const agents = [
  {id:"milo",name:"Milo",role:"全端開發",color:"#d3a382",shirt:0xca795a,x:-3.1,z:-1.8},
  {id:"sage",name:"Sage",role:"測試與品質",color:"#a9b99d",shirt:0x8aab86,x:1.0,z:-1.8},
  {id:"cleo",name:"Cleo",role:"介面設計",color:"#d9bd70",shirt:0xe3b960,x:-3.1,z:1.6},
  {id:"otto",name:"Otto",role:"工程與整合",color:"#a3b7c3",shirt:0x799fae,x:1.0,z:1.6}
].map(a=>({...a,state:"idle",step:0,history:[],task:null}));
let office, selected, toastTimer, repo="studio/little-things", publicRepo="", cwd="~/projects/little-things", issueSource="demo", loading=false;
let issues = [{number:42,title:"讓搜尋記住上次的篩選條件",labels:[{name:"enhancement"}]},{number:43,title:"修正小螢幕上的側欄重疊",labels:[{name:"bug"}]},{number:44,title:"補上登入流程的回歸測試",labels:[{name:"tests"}]}];
const demoIssues=structuredClone(issues), prs = [], jobs = [];
let serial=0;
const dialog=$("dialog");
const completion = $("completion");
function announceCompletion(a, job){
 completion.hidden=false;completion.innerHTML=`<button class="dismiss" aria-label="關閉完成摘要">×</button><span class="eyebrow">✓ DEMO COMPLETE</span><h3>${a.name} 回來報告了。</h3><p>${esc(job.task)}</p><small>4 / 4 示範階段完成 · 草稿待 review</small><button class="report-link">查看摘要 ↗</button>`;
 completion.querySelector(".dismiss").onclick=()=>completion.hidden=true;completion.querySelector(".report-link").onclick=()=>report(a);
}
const statusLabel = a => a.state==="working" ? ["閱讀需求","建立分支","實作中","驗證中"][a.step] : a.state==="done" ? "完成，等你看看" : "有空，隨時聊聊";
function toast(text){$("toast").textContent=text;$("toast").hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("toast").hidden=true,4500);}
function activity(text){$("activity").textContent=text;}
function show(content,eyebrow="AGENT OFFICE"){office?.clearKeys();$("dialog-body").innerHTML=content;$("dialog-eyebrow").textContent=eyebrow;if(!dialog.open)dialog.showModal();}
$("close-dialog").onclick=()=>dialog.close();
dialog.addEventListener("close",()=>{selected=null;office?.clearKeys();});
function render(){
 $("members").innerHTML=agents.map(a=>`<button class="member" data-agent="${a.id}" data-state="${a.state}"><span class="avatar" style="background:${a.color}">${a.name[0]}</span><span class="member-copy"><strong>${a.name}</strong><small>${a.role}</small><p>${statusLabel(a)}</p></span><span class="member-dot"></span></button>`).join("");
 $("members").querySelectorAll("button").forEach(b=>b.onclick=()=>openChat(agents.find(a=>a.id===b.dataset.agent)));
 $("workers").innerHTML=jobs.length ? jobs.slice(-4).reverse().map(j=>`<article class="worker"><div class="worker-header"><span>${j.agent.name.toUpperCase()} / WORKER ${String(j.id).padStart(2,"0")}</span><span>${j.done?"✓ 完成":"● 執行中"}</span></div><code>${esc(j.commands[j.step])}</code><div class="progress"><span style="width:${j.done?100:(j.step+1)*22}%"></span></div></article>`).join("") : `<div class="empty-workers"><span>⌘ _</span><p>桌前有人，終端機還很安靜。<br>指派一個任務，看看工作如何展開。</p></div>`;
 $("worker-count").textContent=jobs.filter(j=>!j.done).length;
 $("pr-count").textContent=prs.length;
 $("issue-count").textContent=issues.length;
 $("first-task").textContent=jobs.length?"＋ 指派新的任務":"＋ 指派第一個任務";
 office?.updateStates();
}
function openChat(a, prefill=""){
 selected=a;$("team-panel").classList.remove("open");
 show(`<h2>Hey, ${a.name}<span style="color:${a.color}">.</span></h2><div class="dialog-sub">${a.role} · ${esc(cwd)} · Claude Code 模擬</div><div class="chat-log" id="chat-log"></div><form id="task-form"><label for="task-input">今天一起做點什麼？</label><textarea id="task-input" maxlength="800" placeholder="例如：處理 issue #42，完成後整理變更摘要" ${a.state==="working"?"disabled":""}>${esc(prefill)}</textarea><div class="quick-tasks"><button type="button" data-task="處理 issue #42">處理 issue #42</button><button type="button" data-task="解掉 main 的合併衝突">解掉 main 的合併衝突</button><button type="button" data-task="檢查並補上回歸測試">補上回歸測試</button></div><button class="primary" ${a.state==="working"?"disabled":""}>${a.state==="working"?"同事正在工作中":"派給 "+a.name+" ↗"}</button></form><p class="notice">示範流程約 16 秒。指令與 PR 為模擬，不會執行 Claude Code 或修改 repo。</p>${a.state==="done"?'<button id="view-report" class="secondary">查看完成報告 ↗</button>':""}`,"A CONVERSATION WITH "+a.name.toUpperCase());
 updateChat(a);
 $("task-form").onsubmit=e=>{e.preventDefault();const task=$("task-input").value.trim();if(!task){$("task-input").setCustomValidity("請寫下想指派的任務");$("task-input").reportValidity();return;}startJob(a,task);};
 $("task-input").oninput=e=>e.target.setCustomValidity("");
 document.querySelectorAll("[data-task]").forEach(b=>b.onclick=()=>{$("task-input").value=b.dataset.task;$("task-input").focus();});
 if($("view-report"))$("view-report").onclick=()=>report(a);
 if(a.state!=="working")$("task-input").focus();
}
function updateChat(a){if(!$("chat-log"))return;$("chat-log").innerHTML=(a.history.length?a.history:[{text:`嗨，我是 ${a.name}。把任務交給我，我會在這裡整理進度。`}]).map(m=>`<div class="chat-bubble ${m.mine?"mine":""}">${esc(m.text)}</div>`).join("");$("chat-log").scrollTop=$("chat-log").scrollHeight;}
function startJob(a,task){
 if(a.state==="working"){toast(a.name+" 正在處理任務，請選另一位同事。");return;}
 if(!task.trim())return;
 const id=++serial, conflict=/衝突|conflict/i.test(task);
 const commands=conflict?["git status --short","git diff --name-only --diff-filter=U","claude -p '<檢查並解決衝突>'","git diff --check","示範完成 · 等待人工 review"]:["git status --short",`git checkout -b agent/${a.id}-${id}`,"claude -p '<任務內容>'","npm test","示範完成 · 草稿 PR 已備妥"];
 a.state="working";a.step=0;a.task=task;a.history.push({mine:true,text:task},{text:"收到！我會先看一下工作區，再開始處理。（模擬）"});
 const job={id,agent:a,task,commands,step:0,done:false,repo,cwd,conflict};jobs.push(job);
 render();if(dialog.open)dialog.close();activity(`${a.name} 開始處理：${task}`);toast(`已派給 ${a.name}。右側可查看 worker 進度。`);
 job.timer=setInterval(()=>{
  job.step++;a.step=Math.min(job.step,3);
  if(job.step>=4){clearInterval(job.timer);job.done=true;a.state="done";a.lastJob=job;a.history.push({text:`完成示範：「${task}」。指令流程已結束，實際程式與測試尚未執行。`});prs.push({id:`DEMO-${id}`,title:task,agent:a.name,repo:job.repo,branch:conflict?"main · 衝突修復示範":`agent/${a.id}-${id}`,conflict});activity(`${a.name} 站起來報告：${task} · 點同事查看摘要`);toast(`${a.name}：任務示範完成，報告準備好了。`);announceCompletion(a,job);}
  render();if(selected===a&&dialog.open)openChat(a);
 },4000);
}
function report(a){
 selected=null;
 const j=a.lastJob;if(!j)return;
 show(`<h2>Good work, ${a.name}.</h2><p>${esc(j.task)}</p><ul class="report-list"><li>已完成需求 → 指令 → 驗證的示範流程</li><li>工作目錄：<code>${esc(j.cwd)}</code></li><li>${j.conflict?"合併衝突解決流程已演示":"示範分支：agent/"+a.id+"-"+j.id}</li><li>草稿紀錄：DEMO-${j.id} · 尚未送出 GitHub</li></ul><p class="notice">這份摘要只記錄互動示範。沒有執行實際程式、測試或 Git 操作；正式環境需接上受控的本機 Claude Code runner。</p><button class="primary" id="back-chat">繼續聊聊 ↗</button>`,"TASK COMPLETE / DEMO");
 $("back-chat").onclick=()=>openChat(a);
}
function issueDialog(){
 selected=null;show(`<h2>A good place to start.</h2><p>把待辦交給最適合的同事。</p><div class="source-line"><span>${issueSource==="demo"?"範例 Issues · studio/little-things":"GitHub 公開資料 · "+esc(publicRepo)}</span><button id="refresh-issues" ${loading?"disabled":""}>${loading?"讀取中…":"↻ 重新整理"}</button></div><div id="issue-list">${issues.length?issues.map((i,index)=>`<article class="issue-card"><small>#${i.number} · ${esc((i.labels||[]).map(l=>typeof l==="string"?l:l.name).join(" / "))}</small><h3>${esc(i.title)}</h3><div><select aria-label="Issue ${i.number} 指派對象" id="assign-${index}">${agents.map(a=>`<option value="${a.id}" ${a.state==="working"?"disabled":""}>${a.name} · ${a.state==="working"?"工作中":a.role}</option>`).join("")}</select><button data-assign="${index}" ${agents.every(a=>a.state==="working")?"disabled":""}>指派 ↗</button></div></article>`).join(""):"<p>目前沒有載入的 issue。</p>"}</div><p class="notice">公開 GitHub 清單為唯讀。這裡的指派只啟動本頁示範，不會修改 GitHub assignee。</p><button id="change-repo" class="secondary">設定 GitHub repo</button>`,"ISSUES / PICK SOMETHING WORTH BUILDING");
 $("refresh-issues").onclick=()=>{if(publicRepo)fetchIssues();else toast("已更新範例清單；設定公開 repo 後可讀取 GitHub。");};
 $("change-repo").onclick=repoDialog;
 document.querySelectorAll("[data-assign]").forEach(b=>b.onclick=()=>{const i=issues[Number(b.dataset.assign)],a=agents.find(a=>a.id===$("assign-"+b.dataset.assign).value);if(a)startJob(a,`處理 issue #${i.number}：${i.title}`);});
}
async function fetchIssues(){
 if(loading)return;loading=true;issueDialog();const target=publicRepo;
 try{const r=await fetch(`https://api.github.com/repos/${target}/issues?state=open&per_page=30`,{headers:{Accept:"application/vnd.github+json"},credentials:"omit",signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error(r.status===403?"GitHub 讀取額度已用完，請稍後重試。":r.status===404?"找不到公開 repo，請檢查 owner/repo。":`GitHub 回應 ${r.status}`);const data=await r.json();if(!Array.isArray(data))throw Error("GitHub 資料格式不符");if(target!==publicRepo)return;issues=data.filter(i=>!i.pull_request);issueSource="github";render();}
 catch(e){toast(e.name==="TimeoutError"?"GitHub 連線逾時，保留上一份清單。":`讀取失敗：${e.message}。保留上一份清單。`);}
 finally{loading=false;if(dialog.open&&$("issue-list"))issueDialog();}
}
function prDialog(){selected=null;show(`<h2>Ready for a second look.</h2><p>同事完成的工作，在這裡等你 review。</p>${prs.length?prs.slice().reverse().map(p=>`<article class="pr-card"><small>${p.id} · ${esc(p.agent)} · DRAFT / 模擬</small><h3>${esc(p.title)}</h3><p>${esc(p.repo)}<br><code>${esc(p.branch)}</code></p><span class="status-pill">待人工驗證 · 未送出</span></article>`).join(""):"<div class=\"empty-workers\"><span>⑂</span><p>還沒有 PR。派出一個任務，<br>完成後會在這裡留下草稿紀錄。</p></div>"}<p class="notice">此處是本頁 agent 的模擬草稿紀錄，沒有建立真正的 GitHub PR。</p>`,"PULL REQUESTS / DEMO");}
function repoDialog(){selected=null;show(`<h2>Make yourself at home.</h2><p>為這間辦公室選一個工作區。</p><form id="repo-form"><label for="cwd-input">本機 git repo 目錄（示範顯示）</label><input id="cwd-input" value="${esc(cwd)}" maxlength="220" required><label for="repo-input">GitHub 公開 repo · owner/repo（選填）</label><input id="repo-input" value="${esc(publicRepo)}" placeholder="例如：microsoft/vscode" pattern="[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+" maxlength="150"><p class="notice">目錄僅作示範設定；網頁無法啟動本機子程序。公開 Issues 會直接向 GitHub 讀取，不需要 token。</p><button class="primary">儲存工作區 ↗</button></form>`,"WORKSPACE SETTINGS");$("repo-form").onsubmit=e=>{e.preventDefault();if(loading){toast("GitHub 清單正在讀取，請稍後再切換工作區。");return;}if(jobs.some(j=>!j.done)){toast("請等目前的示範任務完成，再切換工作區。");return;}cwd=$("cwd-input").value.trim();if(!cwd){toast("請填入工作目錄。");return;}const newRepo=$("repo-input").value.trim();if(newRepo!==publicRepo){issues=newRepo?[]:structuredClone(demoIssues);issueSource=newRepo?"github":"demo";}publicRepo=newRepo;repo=publicRepo||"studio/little-things";$("repo-name").textContent=repo.replace("/"," / ");dialog.close();render();toast("已更新工作區");if(publicRepo)fetchIssues();};}
$("issues-button").onclick=issueDialog;$("prs-button").onclick=prDialog;$("repo-button").onclick=repoDialog;
$("first-task").onclick=()=>openChat(agents.find(a=>a.state!=="working")||agents[0]);
$("about-button").onclick=()=>{selected=null;show(`<h2>A little room for big ideas.</h2><p>WASD 或方向鍵走動，靠近同事按 T。也可以直接點選角色或成員面板派工。</p><ul class="report-list"><li>四位具名同事、worker 指令、起身報告與 PR 草稿：互動模擬。</li><li>GitHub Issues：可唯讀載入公開 repo 的前 30 筆 issues/PRs 中的 issues。</li><li>Join voice：本機麥克風音量檢查；Share screen：本機預覽，不傳送。</li><li>Claude Code 子程序、真實 git 操作與多人通話：尚未串接。</li></ul><button id="about-repo" class="primary">設定工作區 ↗</button>`,"ABOUT THIS INTERACTIVE PROTOTYPE");$("about-repo").onclick=repoDialog;};
$("mobile-team").onclick=()=>$("team-panel").classList.toggle("open");$("close-team").onclick=()=>$("team-panel").classList.remove("open");
let mic=null,audioCtx=null,meterTimer=null,screen=null,micPending=false,screenPending=false;
function stopVoice(){mic?.getTracks().forEach(t=>t.stop());mic=null;audioCtx?.close().catch(()=>{});audioCtx=null;clearInterval(meterTimer);$("voice-button").classList.remove("active-media");$("voice-button").querySelector("span").textContent="Join voice";activity("麥克風已關閉。");}
$("voice-button").onclick=()=>{if(mic){stopVoice();return;}selected=null;show(`<h2>Sound check.</h2><p>開啟麥克風，查看本機輸入音量。這個原型尚未提供多人語音；聲音不會錄製或傳送。</p><button class="primary" id="enable-mic">開啟本機麥克風檢查</button>`,"VOICE / LOCAL PREVIEW");$("enable-mic").onclick=async()=>{if(micPending)return;micPending=true;$("enable-mic").disabled=true;try{if(!navigator.mediaDevices?.getUserMedia)throw Error("此瀏覽器不支援，請用 HTTPS 或 localhost 開啟");mic=await navigator.mediaDevices.getUserMedia({audio:true});audioCtx=new AudioContext();await audioCtx.resume();const source=audioCtx.createMediaStreamSource(mic),analyser=audioCtx.createAnalyser();analyser.fftSize=256;source.connect(analyser);const data=new Uint8Array(analyser.fftSize);mic.getTracks().forEach(t=>t.addEventListener("ended",stopVoice,{once:true}));meterTimer=setInterval(()=>{analyser.getByteTimeDomainData(data);const level=Math.round(Math.sqrt(data.reduce((s,v)=>s+(v-128)**2,0)/data.length)*2);activity(`本機麥克風音量 ${Math.min(100,level)}% · 未連接其他成員 · 按 Mic on 關閉`);},250);$("voice-button").classList.add("active-media");$("voice-button").querySelector("span").textContent="Mic on";dialog.close();toast("本機麥克風已開啟；再次點擊即可關閉。");}catch(e){stopVoice();toast(`無法開啟麥克風：${e.message}`);}finally{micPending=false;if($("enable-mic"))$("enable-mic").disabled=false;}};};
function stopScreen(){screen?.getTracks().forEach(t=>t.stop());screen=null;$("share-preview").hidden=true;$("share-preview").querySelector("video").srcObject=null;$("share-button").classList.remove("active-media");$("share-button").querySelector("span").textContent="Share screen";}
$("share-button").onclick=()=>{if(screen){stopScreen();return;}selected=null;show(`<h2>Show your corner.</h2><p>選擇一個畫面，在本頁顯示本機預覽。這個原型不會將螢幕傳送給其他人或 agent。</p><button id="enable-screen" class="primary">選擇畫面並預覽</button>`,"SCREEN / LOCAL PREVIEW");$("enable-screen").onclick=async()=>{if(screenPending)return;screenPending=true;$("enable-screen").disabled=true;try{if(!navigator.mediaDevices?.getDisplayMedia)throw Error("此瀏覽器不支援螢幕分享");screen=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});screen.getVideoTracks()[0].addEventListener("ended",stopScreen,{once:true});$("share-preview").hidden=false;$("share-preview").querySelector("video").srcObject=screen;$("share-button").classList.add("active-media");$("share-button").querySelector("span").textContent="Sharing";dialog.close();}catch(e){stopScreen();toast(`未開始螢幕預覽：${e.message}`);}finally{screenPending=false;if($("enable-screen"))$("enable-screen").disabled=false;}};};
$("stop-share").onclick=stopScreen;
window.addEventListener("pagehide",()=>{stopVoice();stopScreen();});
render();
try{const {createOffice}=await import("./scene.js");office=createOffice({agents,onChat:openChat,isBlocked:()=>dialog.open,onHint:a=>{$("walk-hint").querySelector("span:nth-child(2)").textContent=a?`按 T 和 ${a.name} 聊聊 · ${statusLabel(a)}`:"走近一位同事，聊聊下一個點子。";}});$("scene-message").textContent="";render();}catch(e){console.warn("Office renderer unavailable",e);$("scene-message").textContent="3D 場景需要 WebGL 2。你仍可從成員面板聊天、派工與查看進度。";}
