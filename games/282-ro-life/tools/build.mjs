// 打包：src/engine/main-DRFCcdKO.js（含 soul_linker 與 PixiJS 8 渲染器模組）＋ src/style.css → 內嵌進 src/template.html，輸出 ../../web/282-ro-life.html。
// 素材（sprites / maps / items / audio / splash）執行時從 window.__RA 讀取（正式站＝Cloudflare，其他＝../assets/282/）；--dev 不額外壓縮。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dev = process.argv.includes('--dev');
const outArg = process.argv.find((a) => a.startsWith('--out='));
const outFile = outArg ? resolve(root, outArg.slice(6)) : resolve(root, '../../web/282-ro-life.html');

// 素材根目錄 window.__RA：正式站改從 Cloudflare（assets-worker/，靜態素材請求免費不限量）讀，省下 Vercel 每次約 2,900 個請求；
// 其他網址（本機 npm start、預覽）照舊讀 ../assets/282/。--no-cdn 或 RO_ASSET_CDN= 空字串可關掉。
const ASSET_CDN = process.argv.includes('--no-cdn') ? '' : (process.env.RO_ASSET_CDN ?? 'https://ro-assets.tommy771004.workers.dev/');
const ASSET_HOSTS = ['htmls-ruddy.vercel.app'];
// 線上角色（server/ro-life/game.mjs）：登入且選了「線上」（localStorage 的 ro-life.mode）才用引擎原本的線上模式，
// 把頁面的登入權杖寫成引擎認得的 ro-life-session；其他情況一律單機，並清掉那個 key（單機時引擎也會讀它）。
// __roOffline：伺服器沒開放、登入過期或登出時退回單機並重新載入。
const onlineScript = '<script>window.__roOnline=(()=>{try{const st=JSON.parse(localStorage.getItem("ro-life.cloud.v1")||"null");if(localStorage.getItem("ro-life.mode")==="online"&&st&&st.token&&st.account&&Number.isInteger(+st.account.id)){localStorage.setItem("ro-life-session",JSON.stringify({token:st.token,id:+st.account.id,name:st.account.name||"冒險者"}));return!0}localStorage.removeItem("ro-life-session")}catch{}return!1})();window.__roOffline=()=>{try{localStorage.setItem("ro-life.mode","single");localStorage.removeItem("ro-life-session")}catch{}location.reload()};document.documentElement.classList.toggle("ro-online",window.__roOnline)</script>';
// 合作關卡的收據與伺服器擲骰（引擎的掛點在下面 must() 的「合作關卡獎勵裁決」段落）：
//   __roTripStart(rc)：出發時大廳給的行程收據；__roRunBody(b)：換關卡憑證時帶上
//   __roTripGot(rc)：結算收據到了；__roCoopEnd(coop)：結算前向大廳要結算收據，存檔最多等 1.5 秒（__roTripWait）
//   __roCoopOver(coop, go)：房主結束本局時還有沒擲的骰，請大廳擲完（最多等 2 秒）再結算；回 true＝已接手
const coopScript = '<script>(()=>{let done=null;const held=new WeakSet;window.__roRunBody=b=>window.__roTrip?{...b,trip:window.__roTrip}:b;window.__roTripStart=rc=>{window.__roTrip=rc||void 0;window.__roTripEnd=void 0};window.__roTripGot=rc=>{window.__roTripEnd=rc;done&&done()};window.__roCoopEnd=c=>{try{if(!c||!window.__roRunRc||window.__roTripEnd||window.__roTripWait)return;const ws=c.link&&c.link.ws;if(!ws||ws.readyState!==1)return;ws.send(JSON.stringify({t:"runEnd"}));window.__roTripWait=new Promise(r=>{const fin=()=>{if(done!==fin)return;done=null;window.__roTripWait=null;r()};done=fin;setTimeout(fin,1500)})}catch{}};window.__roCoopOver=(c,go)=>{try{if(!c||!window.__roSrvRoll||!c.isHost||c.over||!c.rolls.size)return!1;if(held.has(c))return!0;held.add(c);c.link.send({k:"rollEnd"});const t0=Date.now(),iv=setInterval(()=>{if(!c.rolls.size||Date.now()-t0>2e3){clearInterval(iv);go()}},50);return!0}catch{return!1}}})()</script>';
const raScript = `<script>window.__RA=window.__RA||(${JSON.stringify(ASSET_CDN)}&&${JSON.stringify(ASSET_HOSTS)}.includes(location.hostname)?${JSON.stringify(ASSET_CDN)}:new URL("../assets/282/",document.baseURI).href)</script>`;

// 尋找可用的 esbuild 模組（本資料夾、鄰近作品 node_modules 或 npx 快取）
async function loadEsbuild() {
  const candidates = [
    resolve(root, 'node_modules/esbuild/lib/main.js'),
    resolve(root, '../278-ochre-line/node_modules/esbuild/lib/main.js'),
    resolve(root, '../201-coral-cove/node_modules/esbuild/lib/main.js'),
    resolve(root, '../197-openworld/node_modules/esbuild/lib/main.js'),
    '/Users/xieyuanyou/.npm/_npx/69f9afb961c37556/node_modules/esbuild/lib/main.js',
  ];
  for (const p of candidates) {
    if (existsSync(p)) return import(pathToFileURL(p).href);
  }
  return import('esbuild');
}

const { build } = await loadEsbuild();

const roRewritePlugin = {
  name: 'ro-life-singlefile',
  setup(b) {
    b.onLoad({ filter: /\.js$/ }, (args) => {
      let src = readFileSync(args.path, 'utf8');

      // 1. 停用 Vite 動態分塊 modulepreload（所有渲染器與字型分塊已由 esbuild 內嵌至同一份 IIFE）
      src = src.replace(
        /const __vite__mapDeps=\(i,m=__vite__mapDeps,d=\(m\.f\|\|\(m\.f=\[[^\]]+\]\)\)\)=>i\.map\(i=>d\[i\]\);/g,
        'const __vite__mapDeps=()=>[];'
      );
      src = src.replace(/,import\.meta\.url\)/g, ',document.baseURI)');

      // 2. soul_linker：將素材根目錄指到 window.__RA（頁首設定；預設 ../assets/282/ 的絕對網址），並將預設語系設為繁體中文（zh-TW）
      if (args.path.includes('soul_linker')) {
        for (const k of ['js', 'tq']) {
          if (!src.includes(`const ${k}="assets/"`)) throw new Error(`soul_linker 找不到 const ${k}="assets/"`);
          src = src.replace(`const ${k}="assets/"`, `const ${k}=window.__RA`);
        }
        src = src.replace(
          'lang:(RM=navigator.language)!=null&&RM.toLowerCase().startsWith("es")?"es":(zM=navigator.language)!=null&&zM.toLowerCase().startsWith("zh")?"zh-TW":"en"',
          'lang:(RM=navigator.language)!=null&&RM.toLowerCase().startsWith("es")?"es":"zh-TW"'
        );
      }

      // 3. main：修正所有相對素材路徑、啟用單機離線／全解鎖模式並移除無後端時的 404 請求
      if (args.path.includes('main-')) {
        // 素材字串改接 window.__RA：樣板字串（含 CSS url(…) 在樣板內）用 ${__RA}，一般字串用 __RA+"…"
        const nAssets = (src.match(/(?<![.\w/])assets\//g) || []).length;
        src = src.replace(/`assets\//g, '`${window.__RA}');
        src = src.replace(/url\(assets\//g, 'url(${window.__RA}');
        src = src.replace(/"assets\//g, 'window.__RA+"');
        const left = src.match(/(?<![.\w/])assets\//g);
        if (left) throw new Error(`main 還有 ${left.length} 處未改的 assets/（共 ${nAssets}）`);
        src = src.replace('"/splash/endless-tower.jpg"', '(window.__RA+"splash/endless-tower.jpg")');
        src = src.replace('"/splash/endless-tower-mask.svg"', '(window.__RA+"splash/endless-tower-mask.svg")');

        // 預設啟用本機模式（Lh = true）：全 14 職業與二轉大師 NPC 解鎖、使用 localStorage 單機存檔；
        // 選了線上（window.__roOnline）就用引擎原本的線上模式，存檔走 /api/ro/game/（server/ro-life/game.mjs）
        src = src.replace('let Lh=!1,Oi=null;', 'let Lh=!window.__roOnline,Oi=null;');

        // 單檔模式下不輪詢 status.json、不註冊 sw.js、不發送遠端遙測與 WebSocket，避免無後端時產生 404 或連線錯誤
        src = src.replace(
          'async function Sd(){try{const a=await fetch("status.json"',
          'async function Sd(){return;try{const a=await fetch("status.json"'
        );
        src = src.replace(
          'function uL(){try{',
          'function uL(){return;try{'
        );
        src = src.replace(
          'function FC(){if(XC(),!("serviceWorker"in navigator))return;',
          'function FC(){if(XC(),!0)return;'
        );
        src = src.replace(
          'async function C0(a=5e3){',
          'async function C0(a=5e3){return[];'
        );
        // 普隆德拉大廳（看得到其他玩家）：只有頁面設定了 window.__roLobby（/api/ro/config 有回大廳網址）才連線，
        // 否則和以前一樣不開 WebSocket。入場票放在 hello 的 rt；本機模式的角色都是 dev，有大廳時也讓它上線。
        // 社交（檢視、密語、好友）要等伺服器的 welcome 帶 social 才顯示：頁面比 Worker 先更新時，舊 Worker 不送它，按鈕就不出現。
        // 他人選單：名字、查看、密語、加好友、交易（welcome 帶 trade 而且自己是線上模式）、檢舉；訪客看得到「查看」，其他要登入、對方也不能是訪客。
        // 檢舉要伺服器 welcome 帶 report 才顯示（舊伺服器收到檢舉不會存）。
        const must = (from, to) => {
          if (!src.includes(from)) throw Error(`build.mjs: 找不到要替換的引擎程式碼：${from.slice(0, 60)}`);
          src = src.replace(from, to);
        };
        must(
          'connect(){if(this.closed)return;this.on.status("connecting"),this.url=Ui(this.lobbyId);',
          'connect(){if(this.closed)return;const __L=window.__roLobby;if(!__L)return void this.on.status("offline");__L.refresh?.();this.on.status("connecting"),this.url=__L.url(this.lobbyId);'
        );
        must(
          '...o?{token:o}:{},...i?{mkey:i}:{}}},this.on=t',
          '...o?{token:o}:{},...i?{mkey:i}:{},...window.__roLobby?.ticket?{rt:window.__roLobby.ticket}:{},...window.__roOnline?{on:1}:{}}},this.on=t'
        );
        must(
          'e.dev||r.then(()=>re===i&&i.goOnline(e.name,vh(e),kx(e)))',
          'r.then(()=>window.__roLobbyReady).then(()=>re===i&&(!e.dev||window.__roLobby)&&i.goOnline(e.name,vh(e),kx(e)))'
        );
        must(
          'case"welcome":this.retryMs=1e3,this.joined=!0,',
          'case"welcome":this.retryMs=1e3,this.joined=!0,document.body.classList.toggle("ro-social",!!s.social),document.body.classList.toggle("ro-report",!!s.report),document.body.classList.toggle("ro-mail",!!s.mail),document.body.classList.toggle("ro-party",!!s.party),document.body.classList.toggle("ro-trade",!!s.trade&&!!window.__roOnline),'
        );
        must('const h=!Pa(),u=this.guests.has(e.id)', 'const h=!(Pa()||window.__roLobby?.ticket),u=this.guests.has(e.id)');
        must(
          'n.append(o,i,d,...(y=this.friends)!=null&&y.has(e.name)?[]:[p],r,l)',
          'n.append(o,...document.body.classList.contains("ro-social")?[i,...h||u?[]:[d,...(y=this.friends)!=null&&y.list.some(f=>f.id===e.id)?[]:[p],...document.body.classList.contains("ro-trade")?[r]:[],...document.body.classList.contains("ro-report")?[l]:[]]]:[])' // 名字可能重複，用 id 判斷是不是好友
        );
        must('{t:"friendAdd",name:e.name}', '{t:"friendAdd",name:e.name,id:e.id}');
        // 交易（伺服器權威，server/ro-life/lobby-trade.mjs＋trade.mjs）：大廳撮合、Vercel 在雙方的伺服器存檔上結算。
        // 伺服器多一個結束原因 offline（有一邊不是線上模式）；按鈕文字原本沒有中文
        must('missing:c("No se ha hecho el comercio: a alguien ya le faltaba algo de lo que ofrecía.")}', 'missing:c("No se ha hecho el comercio: a alguien ya le faltaba algo de lo que ofrecía."),offline:"只有線上角色能交易。"}');
        must('r.textContent=c("Comerciar")', 'r.textContent="交易"'); // 同名時伺服器靠 id 找到點的那個人
        // 組隊：伺服器 welcome 帶 party 才顯示「邀請組隊」；訪客不能邀請、也不能被邀請
        must(
          'if(!((w=this.party)!=null&&w.has(e.id))&&((m=this.party)!=null&&m.canInvite)){',
          'if(document.body.classList.contains("ro-party")&&!h&&!u&&!((w=this.party)!=null&&w.has(e.id))&&((m=this.party)!=null&&m.canInvite)){'
        );
        // 合作關卡的本局連線：原本連 /web/ws-run，改連大廳同一個網址（hello 帶 run:true），並帶入場票讓伺服器對到隊伍
        must(
          'function Yj(a=Gf()){const e=new URL("ws-run",document.baseURI);return e.searchParams.set("l",String(a)),e.href.replace(/^http/,"ws")}',
          'function Yj(a=Gf()){return window.__roLobby?.url(a)??"ws://invalid"}'
        );
        must('key:t,run:!0,hm:!0,...s?{token:s}:{},', 'key:t,run:!0,hm:!0,sr:1,...s?{token:s}:{},...window.__roLobby?.ticket?{rt:window.__roLobby.ticket}:{},');
        // 密語帶對方的 id（從選單點密語、或 /r 回覆最後密語你的人），伺服器在名字也對得上時用 id 找人，不會送錯同名的人
        must(
          'd.onclick=()=>{var f;this.closeMenu(),de("friends"),(f=this.chat)==null||f.whisperTo(e.name)}',
          'd.onclick=()=>{var f;window.__roWhisperTo={name:e.name,id:e.id},this.closeMenu(),de("friends"),(f=this.chat)==null||f.whisperTo(e.name)}'
        );
        must(
          'whisper:(o,i)=>{var r;return!!((r=this.net)!=null&&r.send({t:"whisper",to:o,text:i}))}',
          'whisper:(o,i)=>{var r;return!!((r=this.net)!=null&&r.send({t:"whisper",to:o,text:i,...window.__roWhisperTo?.name===o&&window.__roWhisperTo.id?{id:window.__roWhisperTo.id}:{}}))}'
        );
        must('whisper(e,t,s,n,o,i){e||(op=t),', 'whisper(e,t,s,n,o,i){e||(op=t,window.__roWhisperTo={name:t,id:n}),');
        // 離線好友的那一列加「留言」（伺服器 welcome 帶 mail 才顯示）：點了關掉面板、在聊天框填好「/w "名字" 」
        must(
          '<span class="fr-acts">${y}${p}</span></div>`',
          '<span class="fr-acts">${y}${!r.on&&document.body.classList.contains("ro-mail")?`<button class="ro-btn small" data-act="msg" data-name="${wn(r.name)}">${c("Dejar mensaje")}</button>`:""}${p}</span></div>`'
        );
        must(
          'n.dataset.act==="invite"&&this.actions.inviteFar(o)',
          'n.dataset.act==="invite"?this.actions.inviteFar(o):n.dataset.act==="msg"&&(window.__roWhisperTo=null,this.close(),window.__ro?.lobby?.chat?.whisperTo(o))'
        );
        // 好友面板：登入（有入場票）就能用
        must('const t=!Pa();if(document.getElementById("fr-form")', 'const t=!(Pa()||window.__roLobby?.ticket);if(document.getElementById("fr-form")');
        must('Ue("friends"),Pa()&&this.input.focus()', 'Ue("friends"),(Pa()||window.__roLobby?.ticket)&&this.input.focus()');
        // 單機版引擎的帳號永遠是訪客（Pa() 為 null）：用 Google／LINE 登入、拿到入場票的玩家才開放聊天框、名字不標訪客
        must('this.input.disabled=!Pa()', 'this.input.disabled=!(Pa()||window.__roLobby?.ticket)');
        must('Pa()||G0(this.nameLabel)', 'Pa()||window.__roLobby?.ticket||G0(this.nameLabel)');
        must('if(h||u){const f=document.createElement("small")', 'if(!1){const f=document.createElement("small")');
        // 原作伺服器會把中文訊息分到「中文」頻道並在第一次進大廳時詢問；本作玩家幾乎都講中文、伺服器也不分流，所以不問
        must('firstCnVisit(){if(l3()){', 'firstCnVisit(){if(!1){');
        must(
          'async function nt(a,e,t,s=!1){',
          'async function nt(a,e,t,s=!1){if(!window.__roOnline){if(e.startsWith("ladder"))return{rows:[]};if(e.startsWith("endless"))return{wave:1,skills:[],upgrades:{}};return{ok:!0,id:1,token:"local",name:"Adventurer",rev:1,doc:{}}}'
        );
        // ---- 線上模式（第一步：伺服器只記錄不擋）----
        // API 根目錄：原本是 /web/api/，改到 /api/ro/game/
        must('function h1(){return new URL("api/",document.baseURI).href}', 'function h1(){return new URL("../api/ro/game/",document.baseURI).href}');
        // 買賣、精煉、信箱走伺服器（Hl() 照原作：線上模式為真）：POST game/op 的 buy／sell／refine 由伺服器算、精煉亂數在伺服器，
        // 回傳 {rev, doc} 由引擎 ei() 套用；信箱（郵差 NPC）的內容是市場賣出的錢與到期退回的物品，領附件是 op:'mail'（server/ro-life/market.mjs）
        // 無盡之塔（server/ro-life/endless.mjs）：/api/ro/config 回 endless（RO_ENDLESS=1 且表格在）才對線上角色開放，
        // 否則和以前一樣關著。Vercel 沒有 WebSocket：Pn.socket 換成 __RoHttpSocket（下面），每次 send 變成 POST game/endless/io，
        // 回應裡的訊息照原本的 onmessage 送回引擎；任何失敗都當成斷線（onclose），讓引擎自己 resume 重新對齊。
        // 同一輪同步送出的訊息（例如關頁時的 in＋suspend）用 queueMicrotask 併成一個 keepalive 的 POST。
        must('const f_=()=>!!ir()&&!0', 'const f_=()=>!!ir()&&window.__roEndless===!0');
        must('if(l&&!i){const k=ir();if(k)', 'if(l&&!i){const k=window.__roEndless===!0?ir():void 0;if(k)');
        must(
          'static socket(e){const t=new URL(e);return t.searchParams.set("endless","1"),new WebSocket(t.href)}',
          'static socket(e){return new __RoHttpSocket(new URL("endless/io",h1()).href)}'
        );
        must('class Pn{', `class __RoHttpSocket{constructor(u){this.url=u,this.readyState=0,this.q=[],this.busy=!1,this.token=null,this.run=null,setTimeout(()=>{this.readyState===0&&(this.readyState=1,this.onopen?.())},0)}send(s){if(this.readyState!==1)return;const m=JSON.parse(s);if(m.t==="ping")return;m.token&&(this.token=m.token),m.run&&(this.run=m.run),delete m.token,this.q.push(m),this.q.length===1&&queueMicrotask(()=>this.pump())}async pump(){if(this.busy)return;this.busy=!0;try{for(;this.q.length&&this.readyState===1;){const b=this.q.splice(0),r=await fetch(this.url,{method:"POST",headers:{"content-type":"application/json","x-session":this.token??""},body:JSON.stringify({run:this.run,msgs:b}),keepalive:b.some(m=>m.t==="suspend"||m.t==="end")});if(!r.ok)throw Error(String(r.status));const j=await r.json();for(const m of j.msgs??[]){if(this.readyState!==1)break;m.t==="started"&&(this.run=m.run),this.onmessage?.({data:JSON.stringify(m)})}}}catch{this.fail()}this.busy=!1}fail(){this.readyState<2&&(this.readyState=3,this.onerror?.(),this.onclose?.())}close(){this.readyState<2&&(this.readyState=3,setTimeout(()=>this.onclose?.(),0))}}class Pn{`);
        // 每次 build 的編號（打包結果的雜湊，見下方 BUILD_MARK）：無盡之塔開局時送給伺服器，驗證程式照它找回同一版頁面重跑
        must('i_={commit:"7967a1a"}', 'i_={commit:"__RO_BUILD__"}');
        must('h_={commit:"7967a1a"};const u_=1e4', 'h_={commit:"__RO_BUILD__"};const u_=1e4');
        // 驗證程式（tools/verify-endless.mjs）用：照伺服器存的開局快照、種子、操作重跑一場，回傳引擎的比對結果與最後的樓層、分數
        must('let Rb=null;', 'let Rb=null;window.__roEndlessSkillsOk=A=>{const E=Ph(A),C=lw(lr(A).id,E.learned).filter(({id:I})=>{const N=ce[I];return N.needsShield&&!E.shield?!1:!N.weapons||N.weapons.includes(E.weapon?.wtype??"")}),F=[...new Set(E.starts.map(I=>I.skill))].filter(I=>ce[I]?.create),S=ga(A).skills;return S.every(I=>C.some(N=>N.id===I)||F.includes(I))&&S.filter(I=>!F.includes(I)).length<=Math.max(0,ow(lr(A).rank)-F.length)};window.__roReplayEndless=async r=>{Rb=null,await Zq(r.char,void 0,{...Ta},"endless",null,1,r);const e=z?.endless;return{rb:Rb,claim:e?Gh(e):null,failed:e?.failed??null,state:z?.state??null,ticks:z?.ticks??0}};');
        // 關卡中的「在線狀態」連線（原作的 /web/ws）不用；大廳已經有人數與名單
        must('!a.dev&&a.id!=="dev"&&ir()&&(cl=new e3(', '!1&&(cl=new e3(');
        // 資料庫的登入權杖不能送到 Cloudflare 的大廳：大廳只認入場票 rt
        must('this.hello=()=>{const o=ir(),i=or();', 'this.hello=()=>{const o=void 0,i=or();');
        must('const t=yx(),s=ir();e.send(', 'const t=yx(),s=void 0;e.send(');
        // 沒有訪客帳號：登入失效時退回單機，不去建訪客
        must('async function hm(){if(Mt()||ee)return;', 'async function hm(){if(Mt()||ee||window.__roOnline)return;');
        must('function hn(){const a=ee;', 'function hn(){if(window.__roOnline)return void window.__roOffline?.();const a=ee;');
        // 市場（server/ro-life/market.mjs，頁面在 template.html 的 #market）：把需要的引擎函式掛在 window.__ro.mkt。
        // op 和引擎的 nc() 一樣先送出存檔、套用伺服器回的 {rev, doc}，但錯誤碼原樣丟出（gone／own／kafra／full…）讓市場自己顯示
        must(
          'isDev:Mt,setDev:mk};',
          'isDev:Mt,setDev:mk,mkt:{online:Hl,get:e=>nt("GET",e),op:async e=>{const t=ee;if(!t)throw new Error("offline");await Ma();const s=await nt("POST","op",e);return ee===t&&(ei(t.id,s.rev,s.doc),wr=s.trade),s},acct:F0,gearName:ss,itemName:e=>zo(e,""),cardName:qt,oreName:Ft,icon:Me,cardArt:Fs,tipGear:rc,tipCard:Fh,tip:to,confirm:sa,esc:km,num:Em,lang:Ia,ores:at}};'
        );
        // 市場面板也算一個 UI 面板（手把／鍵盤焦點導覽的清單）
        must('"#petkeeper","#mailbox","#wiki"', '"#petkeeper","#mailbox","#market","#wiki"');
        // 合作關卡獎勵裁決（大廳 server/ro-life/lobby-party.mjs、收據 coop.mjs；頁首的 coopScript 是下面用到的 window.__ro* 函式）
        must(
          's.t==="runWelcome"?(this.on.welcome(s.me,s.host,s.mates),this.on.status("online")):s.t==="runJoin"?this.on.join(s.m):s.t==="runLeave"?this.on.leave(s.mid):s.t==="runHost"?this.on.host(s.mid):s.t==="run"?this.on.data(s.from,s.d):',
          's.t==="runWelcome"?(window.__roSrvRoll=s.roll===1,window.__roRunRc=s.rc===1,this.on.welcome(s.me,s.host,s.mates),this.on.status("online")):s.t==="runJoin"?this.on.join(s.m):s.t==="runLeave"?this.on.leave(s.mid):s.t==="runHost"?(s.roll!==void 0&&(window.__roSrvRoll=s.roll===1),this.on.host(s.mid)):s.t==="runReceipt"?window.__roTripGot?.(s.rc):s.t==="run"?this.on.data(s.from,s.d):'
        );
        must(
          'onData(e,t){var o,i;const s=this.mates.get(e),n=this.game;',
          'onData(e,t){var o,i;if(e===0){t&&t.k==="rolled"&&Array.isArray(t.r)&&(this.rolls.delete(t.id),this.rollDone(t.id,t.r,t.win));return}const s=this.mates.get(e),n=this.game;'
        );
        must(
          'this.isHost?this.rollPicked(this.me,e,t):this.link.send({k:"rollPick",id:e,c:t})',
          'this.isHost&&!window.__roSrvRoll?this.rollPicked(this.me,e,t):this.link.send({k:"rollPick",id:e,c:t})'
        );
        must(
          'rollReady(e){return performance.now()>=e.until||e.who.every(t=>e.picks.has(t)||t!==this.me&&!this.mates.has(t))}',
          'rollReady(e){return!window.__roSrvRoll&&(performance.now()>=e.until||e.who.every(t=>e.picks.has(t)||t!==this.me&&!this.mates.has(t)))}'
        );
        must(
          'resolveRoll(e){var l;const t=this.rolls.get(e);if(!t)return;',
          'resolveRoll(e){var l;if(window.__roSrvRoll)return;const t=this.rolls.get(e);if(!t)return;'
        );
        must(
          'onGameOver:k=>{zn||(mt==null||mt.gameOver(k),Ki(k))}',
          'onGameOver:k=>{zn||window.__roCoopOver?.(mt,()=>{mt==null||mt.gameOver(k),Ki(k)})||(mt==null||mt.gameOver(k),Ki(k))}'
        );
        must(
          'case"partyStart":this.on.partyStart(s.trip);break;',
          'case"partyStart":window.__roTripStart?.(s.rc),this.on.partyStart(s.trip);break;'
        );
        must(
          '{stage:a,mult:t,played:Math.round(s+(Date.now()-o)/1e3)}:{stage:a,mult:t}).then(h=>',
          '{stage:a,mult:t,played:Math.round(s+(Date.now()-o)/1e3)}:{stage:a,mult:t})).then(h=>'
        );
        must(
          'nt("POST","run",e&&s>0?{stage:a,mult:t,played:',
          'nt("POST","run",window.__roRunBody(e&&s>0?{stage:a,mult:t,played:'
        );
        must(
          'pt=a,Fn=!1,!a.dev&&a.id!=="dev"&&!l&&wL(s,!!e,',
          'pt=a,Fn=!1,n||(window.__roTrip=window.__roTripEnd=void 0),!a.dev&&a.id!=="dev"&&!l&&wL(s,!!e,'
        );
        must(
          'function Ki(a,e=!1){var h;if(!z||!pt)return;if(z.endless)return Fn?void 0:hI(a,e);',
          'function Ki(a,e=!1){var h;if(!z||!pt)return;if(z.endless)return Fn?void 0:hI(a,e);window.__roCoopEnd?.(mt);'
        );
        must(
          'function Ma(a=!1,e=!1){if(!ee||Mt()||Ef)return Promise.resolve();',
          'function Ma(a=!1,e=!1){if(!ee||Mt()||Ef)return Promise.resolve();if(window.__roTripWait&&!a)return window.__roTripWait.then(()=>Ma(a,e));'
        );
        must(
          '...i?{run:i}:{},...r?{wipe:r}:{}}',
          '...i?{run:i,...window.__roTripEnd?{trip:window.__roTripEnd}:{}}:{},...r?{wipe:r}:{}}'
        );
        // 規則數值給伺服器用（tools/dump-rules.mjs 從無頭瀏覽器倒成 server/ro-life/rules-data.json）：經驗曲線、能力點、價格、精煉、關卡掉落等級
        must(
          'window.__ro={get run(){return z},',
          'window.__ro={rules:{expNext:Go,jobNext:Ql,ep:Ep,statPts:So,talentPts:yg,jobMax:Zn,jobFactor:i$,baseMax:Jl,sellValue:Wr,cardValue:Yr,orePrice:xy,ores:at,refineRate:Li,refineOre:My,maxRefine:ma,cardSlots:Mh,refinable:a=>!!tl(fe[a]),stageIlvl:ac,stageTier:pf,stageList:Se,talents:Ze,affixGen:Zl,endless:{floorsPerStage:Qt,mvps:_a.map(s=>s.mvp.id),mvpAlias:jT,ups:ih.map(u=>u.id),upMax:Object.fromEntries(ih.map(u=>[u.id,fm(u.id)])),upCost:Object.fromEntries(ih.map(u=>[u.id,Array.from({length:Math.min(fm(u.id),200)},(_,r)=>rv(u,r))])),checkEvery:Nf,step:Gs.STEP}},get run(){return z},'
        );
      }

      return { contents: src, loader: 'js' };
    });
  },
};

const result = await build({
  entryPoints: [resolve(root, 'src/engine/main-DRFCcdKO.js')],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  minify: !dev,
  sourcemap: false,
  write: false,
  legalComments: 'none',
  logLevel: 'warning',
  plugins: [roRewritePlugin],
});

const bundled = result.outputFiles[0].text;
// BUILD_MARK：打包結果（不含編號本身）的 sha256 前 12 碼。模擬只讀這段程式（地圖碰撞等素材另計，改素材時要重新 build）
const buildId = createHash('sha256').update(bundled).digest('hex').slice(0, 12);
if (!bundled.includes('__RO_BUILD__')) throw new Error('build.mjs: 找不到 __RO_BUILD__');
const js = bundled.replaceAll('__RO_BUILD__', buildId).replace(/<\/script/gi, '<\\/script');
if (js.includes('import.meta')) {
  throw new Error('打包結果仍含 import.meta，請檢查 build.mjs 轉換規則');
}

const css = readFileSync(resolve(root, 'src/style.css'), 'utf8')
  .replaceAll('url(../splash/', 'url(../assets/282/splash/');

let html = readFileSync(resolve(root, 'src/template.html'), 'utf8');

// 調整語系、標題與移除外部字型／模組連結，改為單檔內嵌
html = html
  .replace('<head>', () => `<head>\n    ${raScript}\n    ${onlineScript}\n    ${coopScript}`)
  .replace('<html lang="en" translate="no">', '<html lang="zh-Hant" translate="no">')
  .replace(/<link rel="manifest"[^>]*>\s*/g, '')
  .replace(/<link rel="preconnect"[^>]*>\s*/g, '')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/g, '')
  .replace(/<link rel="modulepreload"[^>]*>\s*/g, '')
  .replace(
    '<link rel="stylesheet" crossorigin href="./build/main-kcTI5QFT.css">',
    () => `<style>\n${css}\n</style>`
  )
  .replace(
    '<script type="module" crossorigin src="./build/main-DRFCcdKO.js"></script>',
    ''
  )
  .replaceAll('href="app-icons/', 'href="../assets/282/app-icons/')
  .replace('href="favicon.ico"', 'href="../assets/282/app-icons/favicon-ro-64.png"')
  .replaceAll('src="assets/items/', 'src="../assets/282/items/');

// 將打包後的單一引擎腳本插在 template 的 ENGINE 標記（在 DOM 之後、登入框腳本之前）
const ENGINE_MARK = '<!-- ENGINE: tools/build.mjs 把打包後的引擎腳本插在這一行 -->';
if (!html.includes(ENGINE_MARK)) throw new Error('template.html 缺少引擎插入標記：' + ENGINE_MARK);
html = html.replace(ENGINE_MARK, () => `<script>\n${js}\n</script>`);

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, html, 'utf8');
const mb = (Buffer.byteLength(html) / 1048576).toFixed(2);
console.log(`${outFile}  ${mb} MB`);
