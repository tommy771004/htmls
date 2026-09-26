// Monastery and monk on the game screen (no ?debug=1). The third-age match comes from tests/castle-age-fixture.ts:
// played only through logged commands, so the page's restore re-derives it. Pointer, keyboard and minimap only:
// pick the monastery, select the monk, walk it to the idle red villager and convert it.
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {serialize} from '../packages/sim/sim.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
import {castleAgeMatch} from './castle-age-fixture.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=fileURLToPath(new URL('../test-results/',import.meta.url));fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const note=(step,detail)=>console.log(step,'|',detail);
const s=castleAgeMatch(),monk=s.units.find(u=>u.player===0&&u.kind==='monk'),red=s.units.find(u=>u.id===4),size=s.map.size;
const monasteryBox=obstacleBounds(s.map.obstacles.find(o=>o.id===s.buildings.find(b=>b.kind==='monastery').id));
note('對局準備',`tick ${s.tick}，第 ${s.ages[0]} 時代，命令 ${s.log.length} 筆，僧侶 #${monk.id} (${monk.x}, ${monk.y})`);
const browser=await chromium.launch({headless:true});const errors=[],external=[];let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
 await page.goto(origin+'/web/150-brick-rts.html');await page.waitForFunction(()=>Number(document.querySelector('#tick').textContent)>2);
 const text=id=>page.locator('#'+id).innerText();
 const act=async fn=>{const old=await text('notice');await fn();await page.waitForFunction(o=>document.querySelector('#notice').textContent!==o,old,{timeout:5000}).catch(()=>{});return text('notice');};
 async function screenOf(wx,wy,wz){const r=await page.locator('#map').boundingBox(),[fx,fz,halfH,a]=(await page.locator('#map').getAttribute('data-camera')).split(',').map(Number),scale=r.height/(2*halfH),dx=wx-fx,dz=wz-fz;
  return {x:r.x+r.width/2+(dx*Math.cos(a)-dz*Math.sin(a))*scale,y:r.y+r.height/2-(wy-(dx*Math.sin(a)+dz*Math.cos(a)))*Math.SQRT1_2*scale};}
 async function minimapAt(wx,wz){const r=await page.locator('#minimap').boundingBox(),a=Number((await page.locator('#map').getAttribute('data-camera')).split(',')[3]),K=Math.SQRT1_2,n=size,sc=Math.min(r.width/(n*Math.SQRT2),r.height/(n*Math.SQRT2*K))*.96,dx=wx-n/2,dz=wz-n/2;
  return {x:r.x+r.width/2+(dx*Math.cos(a)-dz*Math.sin(a))*sc,y:r.y+r.height/2+(dx*Math.sin(a)+dz*Math.cos(a))*K*sc};}
 // 1. Load the save from the menu (the page re-derives it from the command log).
 await page.evaluate(v=>localStorage.setItem('brick-rts:sandbox:1',v),serialize(s));
 await page.keyboard.press('F10');await page.locator('#load').click();await page.waitForFunction(()=>/已恢復/.test(document.querySelector('#notice').textContent));
 await page.waitForFunction(()=>document.querySelector('#age-name').textContent==='第三時代');note('讀取',`${await text('notice')}｜${await text('age-name')}｜人口 ${await text('res-pop')}`);
 // 2. The monastery: picked on the battlefield; its tile trains monks (gold is short for a second one).
 await page.keyboard.press('KeyH');await page.keyboard.press('Escape');await page.waitForTimeout(300);
 for(const [fx,fz,h] of [[0,0,.5],[-.3,.3,.5],[.3,.3,.5],[-.3,-.3,.5],[.3,-.3,.5],[0,0,1.8]]){const q=await screenOf((monasteryBox[0]+monasteryBox[2])/200+fx,h,(monasteryBox[1]+monasteryBox[3])/200+fz);await page.mouse.click(q.x,q.y);await page.waitForTimeout(120);if(await page.evaluate(()=>document.querySelector('#building-title').textContent==='修道院'&&!document.querySelector('#building-panel').hidden))break;}
 assert.equal(await text('building-title'),'修道院');const tile=page.locator('#production button[data-train="monk"]');
 note('修道院',`${await tile.getAttribute('aria-label')}`);assert.match(await tile.getAttribute('aria-label'),/僧侶（黃金 100）/);await page.screenshot({path:out+'monastery-panel.png'});
 // 3. Select the monk with a click on its figure.
 await page.keyboard.press('Escape');let q=await screenOf(monk.x/100,.6,monk.y/100);note('選取僧侶',await act(()=>page.mouse.click(q.x,q.y)));
 assert.equal(await text('unit-name'),'僧侶');note('僧侶面板',`${await text('unit-facts')}｜${await text('unit-status')}`);assert.match(await text('unit-facts'),/信仰 100%/);
 await page.screenshot({path:out+'monastery-monk.png'});
 // 4. Walk towards the red villager with a right click on the minimap, then convert it with a right click on it.
 await page.locator('#speed').selectOption('4');let m=await minimapAt(red.x/100-2.5,red.y/100);note('前往紅方',await act(()=>page.mouse.click(m.x,m.y,{button:'right'})));
 m=await minimapAt(red.x/100,red.y/100);await page.mouse.click(m.x,m.y);// camera to the red villager; keep trying the right click until the monk can see it
 let converted=null;
 for(let i=0;i<40&&!converted;i++){q=await screenOf(red.x/100,.6,red.y/100);const n=await act(()=>page.mouse.click(q.x,q.y,{button:'right'}));if(/轉化紅方村民/.test(n)){converted=n;break;}await page.waitForTimeout(400);}
 note('下令轉化',converted);assert.ok(converted,'the monk was ordered to convert the red villager');
 await page.waitForFunction(()=>/轉化中/.test(document.querySelector('#unit-status').textContent),undefined,{timeout:20000});await page.screenshot({path:out+'monastery-converting.png'});
 await page.waitForFunction(()=>/轉化了紅方村民/.test(document.querySelector('#events').textContent),undefined,{timeout:60000});note('轉化結果',await text('events'));
 await page.waitForFunction(()=>/信仰恢復中/.test(document.querySelector('#unit-status').textContent),undefined,{timeout:5000});note('僧侶狀態',await text('unit-status'));
 await page.screenshot({path:out+'monastery-converted.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS monastery: third age, monastery picked on the battlefield, monk selected, walked by minimap and converted a red villager');
}catch(e){if(page)await page.screenshot({path:out+'monastery-failure.png'}).catch(()=>{});throw e;}finally{await browser.close();server.close();}
