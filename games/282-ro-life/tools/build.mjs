// 打包：src/engine/main-DRFCcdKO.js（含 soul_linker 與 PixiJS 8 渲染器模組）＋ src/style.css → 內嵌進 src/template.html，輸出 ../../web/282-ro-life.html。
// 素材（sprites / maps / items / audio / splash）執行時從 ../assets/282/ 讀取；--dev 不額外壓縮。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dev = process.argv.includes('--dev');
const outArg = process.argv.find((a) => a.startsWith('--out='));
const outFile = outArg ? resolve(root, outArg.slice(6)) : resolve(root, '../../web/282-ro-life.html');

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

      // 2. soul_linker：將素材根目錄指到 ../assets/282/，並將預設語系設為繁體中文（zh-TW）
      if (args.path.includes('soul_linker')) {
        src = src.replace(
          'const js="assets/"',
          'const js=new URL("../assets/282/",document.baseURI).href'
        );
        src = src.replace(
          'const tq="assets/"',
          'const tq=new URL("../assets/282/",document.baseURI).href'
        );
        src = src.replace(
          'lang:(RM=navigator.language)!=null&&RM.toLowerCase().startsWith("es")?"es":(zM=navigator.language)!=null&&zM.toLowerCase().startsWith("zh")?"zh-TW":"en"',
          'lang:(RM=navigator.language)!=null&&RM.toLowerCase().startsWith("es")?"es":"zh-TW"'
        );
      }

      // 3. main：修正所有相對素材路徑、啟用單機離線／全解鎖模式並移除無後端時的 404 請求
      if (args.path.includes('main-')) {
        src = src.replace(/(?<![.\w/])assets\//g, '../assets/282/');
        src = src.replace('"/splash/endless-tower.jpg"', '"../assets/282/splash/endless-tower.jpg"');
        src = src.replace('"/splash/endless-tower-mask.svg"', '"../assets/282/splash/endless-tower-mask.svg"');

        // 預設啟用本機模式（Lh = true）：全 14 職業與二轉大師 NPC 解鎖、使用 localStorage 單機存檔
        src = src.replace('let Lh=!1,Oi=null;', 'let Lh=!0,Oi=null;');

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
          'case"welcome":this.retryMs=1e3,this.joined=!0,document.body.classList.toggle("ro-social",!!s.social),document.body.classList.toggle("ro-report",!!s.report),document.body.classList.toggle("ro-mail",!!s.mail),'
        );
        must('const h=!Pa(),u=this.guests.has(e.id)', 'const h=!(Pa()||window.__roLobby?.ticket),u=this.guests.has(e.id)');
        must(
          'n.append(o,i,d,...(y=this.friends)!=null&&y.has(e.name)?[]:[p],r,l)',
          'n.append(o,...document.body.classList.contains("ro-social")?[i,...h||u?[]:[d,...(y=this.friends)!=null&&y.list.some(f=>f.id===e.id)?[]:[p],...document.body.classList.contains("ro-report")?[l]:[]]]:[])' // 名字可能重複，用 id 判斷是不是好友
        );
        must('{t:"friendAdd",name:e.name}', '{t:"friendAdd",name:e.name,id:e.id}'); // 同名時伺服器靠 id 找到點的那個人
        must('if(!((w=this.party)!=null&&w.has(e.id))&&((m=this.party)!=null&&m.canInvite)){', 'if(!1){'); // 組隊還沒做
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
        src = src.replace(
          'async function nt(a,e,t,s=!1){',
          'async function nt(a,e,t,s=!1){if(e.startsWith("ladder"))return{rows:[]};if(e.startsWith("endless"))return{wave:1,skills:[],upgrades:{}};return{ok:!0,id:1,token:"local",name:"Adventurer",rev:1,doc:{}};'
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

const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
if (js.includes('import.meta')) {
  throw new Error('打包結果仍含 import.meta，請檢查 build.mjs 轉換規則');
}

const css = readFileSync(resolve(root, 'src/style.css'), 'utf8')
  .replaceAll('url(../splash/', 'url(../assets/282/splash/');

let html = readFileSync(resolve(root, 'src/template.html'), 'utf8');

// 調整語系、標題與移除外部字型／模組連結，改為單檔內嵌
html = html
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
