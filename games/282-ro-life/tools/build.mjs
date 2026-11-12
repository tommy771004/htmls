// 打包：src/engine/main-DRFCcdKO.js（含 soul_linker 與 PixiJS 8 渲染器模組）＋ src/style.css → 內嵌進 src/template.html，輸出 ../../web/282-ro-life.html。
// 素材（sprites / maps / items / audio / splash）執行時從 window.__RA 讀取（正式站＝Cloudflare，其他＝../assets/282/）；--dev 不額外壓縮。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
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
        // 他人選單只留名字、查看、密語、加好友、檢舉（交易、組隊沒做）；訪客看得到「查看」，其他要登入、對方也不能是訪客。
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
          '...o?{token:o}:{},...i?{mkey:i}:{},...window.__roLobby?.ticket?{rt:window.__roLobby.ticket}:{}}},this.on=t'
        );
        must(
          'e.dev||r.then(()=>re===i&&i.goOnline(e.name,vh(e),kx(e)))',
          'r.then(()=>window.__roLobbyReady).then(()=>re===i&&(!e.dev||window.__roLobby)&&i.goOnline(e.name,vh(e),kx(e)))'
        );
        must(
          'case"welcome":this.retryMs=1e3,this.joined=!0,',
          'case"welcome":this.retryMs=1e3,this.joined=!0,document.body.classList.toggle("ro-social",!!s.social),document.body.classList.toggle("ro-report",!!s.report),document.body.classList.toggle("ro-mail",!!s.mail),document.body.classList.toggle("ro-party",!!s.party),'
        );
        must('const h=!Pa(),u=this.guests.has(e.id)', 'const h=!(Pa()||window.__roLobby?.ticket),u=this.guests.has(e.id)');
        must(
          'n.append(o,i,d,...(y=this.friends)!=null&&y.has(e.name)?[]:[p],r,l)',
          'n.append(o,...document.body.classList.contains("ro-social")?[i,...h||u?[]:[d,...(y=this.friends)!=null&&y.list.some(f=>f.id===e.id)?[]:[p],...document.body.classList.contains("ro-report")?[l]:[]]]:[])' // 名字可能重複，用 id 判斷是不是好友
        );
        must('{t:"friendAdd",name:e.name}', '{t:"friendAdd",name:e.name,id:e.id}'); // 同名時伺服器靠 id 找到點的那個人
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
        must('key:t,run:!0,hm:!0,...s?{token:s}:{},', 'key:t,run:!0,hm:!0,...s?{token:s}:{},...window.__roLobby?.ticket?{rt:window.__roLobby.ticket}:{},');
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
        // 買賣、精煉、信箱還沒搬到伺服器：先照單機的做法在本機算，結果隨存檔上傳、由伺服器記錄（第二步改成伺服器 op）
        must('function Hl(){return!!ee&&!Mt()}', 'function Hl(){return!1}');
        // 無盡之塔的伺服器重跑還沒做：線上角色也先在本機跑（天賦頁、開局都不連 ?endless=1）
        must('const f_=()=>!!ir()&&!0', 'const f_=()=>!1');
        must('if(l&&!i){const k=ir();if(k)', 'if(l&&!i){const k=void 0;if(k)');
        // 關卡中的「在線狀態」連線（原作的 /web/ws）不用；大廳已經有人數與名單
        must('!a.dev&&a.id!=="dev"&&ir()&&(cl=new e3(', '!1&&(cl=new e3(');
        // 資料庫的登入權杖不能送到 Cloudflare 的大廳：大廳只認入場票 rt
        must('this.hello=()=>{const o=ir(),i=or();', 'this.hello=()=>{const o=void 0,i=or();');
        must('const t=yx(),s=ir();e.send(', 'const t=yx(),s=void 0;e.send(');
        // 沒有訪客帳號：登入失效時退回單機，不去建訪客
        must('async function hm(){if(Mt()||ee)return;', 'async function hm(){if(Mt()||ee||window.__roOnline)return;');
        must('function hn(){const a=ee;', 'function hn(){if(window.__roOnline)return void window.__roOffline?.();const a=ee;');
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

const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
if (js.includes('import.meta')) {
  throw new Error('打包結果仍含 import.meta，請檢查 build.mjs 轉換規則');
}

const css = readFileSync(resolve(root, 'src/style.css'), 'utf8')
  .replaceAll('url(../splash/', 'url(../assets/282/splash/');

let html = readFileSync(resolve(root, 'src/template.html'), 'utf8');

// 調整語系、標題與移除外部字型／模組連結，改為單檔內嵌
html = html
  .replace('<head>', () => `<head>\n    ${raScript}\n    ${onlineScript}`)
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
