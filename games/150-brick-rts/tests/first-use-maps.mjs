// The 地圖 round in the page: the lobby lists the playable maps by expansion with the site's line under the select and a
// preview from the real generator; 黑森林 with seed 777 starts a match on that map; the encyclopedia's 地圖 tab lists the
// site's maps by expansion and a playable map's page draws its generated map with the counts. Then a phone.
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {createState} from '../packages/sim/sim.ts';
import {authoritativeProblem} from '../packages/sim/buildings.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=fileURLToPath(new URL('../test-results/',import.meta.url));fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const note=(step,detail)=>console.log(step,'|',detail);
const browser=await chromium.launch({headless:true});const errors=[],external=[];let page;
const watch=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});};
const tickOf=async p=>Number(await p.locator('#tick').textContent());
const shot=p=>p.evaluate(()=>{const c=document.querySelector('#lobby-preview');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let h=0;for(let i=0;i<d.length;i+=97)h=(h*31+d[i])>>>0;return h;});
const noOverflow=p=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.body.scrollWidth<=innerWidth);
async function codexMap(p,id){
 await p.keyboard.press('F10');await p.locator('#codex-open').click();await p.waitForFunction(()=>!document.querySelector('#codex').hidden);
 await p.locator('#cx-tab-maps').click();await p.waitForSelector('#cx-map-name');
 const groups=await p.locator('#codex .cx-list .cx-group').allTextContents();
 await p.locator(`#codex .cx-uitem[data-map="${id}"]`).click();await p.waitForSelector('#codex canvas.cx-mapview[data-drawn="true"]');
 const name=await p.locator('#cx-map-name').textContent(),facts=await p.locator('#codex .cx-mapfacts').textContent();return {groups,name,facts};}
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});watch(page);
 await page.goto(origin+'/web/150-brick-rts.html');await page.waitForSelector('#lobby:not([hidden])');await page.waitForTimeout(700);
 const groups=await page.locator('#lobby-layout optgroup').evaluateAll(g=>g.map(x=>`${x.label}:${x.children.length}`));note('地圖選單',groups.join('、'));
 assert.equal(groups[0].split(':')[0],'帝王世紀');assert.equal(groups.at(-2).split(':')[0],'本作地圖');assert.equal(groups.at(-1),'練習地圖:3');
 assert.equal(await page.locator('#lobby-layout').inputValue(),'open','曠野 stays the default');
 const before=await shot(page);await page.locator('#lobby-layout').selectOption('black-forest');await page.locator('#lobby-seed').fill('777');await page.waitForTimeout(900);
 const line=await page.locator('#lobby-layout-note').textContent(),after=await shot(page);note('黑森林',line);
 assert.match(line,/封閉/);assert.notEqual(after,before,'the preview redraws for the new map');
 await page.screenshot({path:out+'maps-lobby-1440.png'});
 await page.locator('#lobby-start').click();await page.waitForSelector('#lobby',{state:'hidden'});await page.waitForFunction(()=>Number(document.querySelector('#tick').textContent)>2);
 const world=await page.locator('#world-label').textContent(),title=await page.locator('#sel-empty-title').textContent();note('遊戲開始',`${world}｜${title}`);
 assert.match(world,/黑森林/);assert.match(title,/黑森林/);
 const gr=await codexMap(page,'Gold_Rush');note('百科 淘金潮',`${gr.groups.join('、')}｜${gr.name}｜${gr.facts.slice(0,90)}`);
 assert.deepEqual(gr.groups,['帝王世紀','征服者入侵','失落的帝國','非洲王國','王者崛起','決定版']);assert.match(gr.name,/淘金潮/);assert.match(gr.facts,/狼 \d+ 隻/);assert.match(gr.facts,/藍方基地/);
 await page.screenshot({path:out+'maps-codex-1440.png'});
 // A later-expansion map is listed with its reason and no preview.
 await page.locator('#codex .cx-uitem[data-map="Budapest"]').click();await page.waitForSelector('#cx-map-name:has-text("布達佩斯")');
 assert.equal(await page.locator('#codex canvas.cx-mapview').count(),0);assert.match(await page.locator('#codex .cx-why').textContent(),/之後資料片/);
 await page.locator('#codex .cx-uitem[data-map="overview"]').click();await page.waitForSelector('#cx-map-name:has-text("地圖")');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 // 游牧: no town centre at the start; a villager may place the first one in the Dark Age. The spot is found with the
 // sim (the same seed and choices as the lobby's), the nearest legal one to the first villager.
 const nm=await browser.newPage({viewport:{width:1440,height:900}});watch(nm);
 await nm.goto(origin+'/web/150-brick-rts.html');await nm.waitForSelector('#lobby:not([hidden])');
 await nm.locator('#lobby-blue').selectOption('britons');await nm.locator('#lobby-red').selectOption('franks');
 await nm.locator('#lobby-layout').selectOption('nomad');await nm.locator('#lobby-seed').fill('4242');await nm.waitForTimeout(500);
 await nm.screenshot({path:out+'maps-nomad-lobby.png'});
 await nm.locator('#lobby-start').click();await nm.waitForSelector('#lobby',{state:'hidden'});await nm.waitForFunction(()=>Number(document.querySelector('#tick').textContent)>2);
 assert.equal(await nm.locator('#age-name').textContent(),'第一時代');
 const s=createState(4242,{layout:'nomad',opponent:'ai',civs:['britons','franks']});assert.equal(s.buildings.filter(b=>b.kind==='town-center').length,0,'a nomad start has no town centre');
 const v=s.units.filter(u=>u.player===0&&u.kind==='villager').sort((a,b)=>a.id-b.id)[0];let site=null;
 for(let r=150;r<=800&&!site;r+=50)for(let dx=-r;dx<=r&&!site;dx+=50)for(let dy=-r;dy<=r&&!site;dy+=50){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;const x=Math.round((v.x+dx)/10)*10,y=Math.round((v.y+dy)/10)*10;if(!authoritativeProblem(s,0,'town-center',x,y))site={x,y};}
 assert.ok(site,'a legal town-centre spot near the first villager');
 const text=id=>nm.locator('#'+id).innerText();
 async function screenOf(wx,wz){const r=await nm.locator('#map').boundingBox(),[fx,fz,halfH,a]=(await nm.locator('#map').getAttribute('data-camera')).split(',').map(Number),scale=r.height/(2*halfH),dx=wx-fx,dz=wz-fz;
  return {x:r.x+r.width/2+(dx*Math.cos(a)-dz*Math.sin(a))*scale,y:r.y+r.height/2-(0-(dx*Math.sin(a)+dz*Math.cos(a)))*Math.SQRT1_2*scale};}
 await nm.keyboard.press('h');await nm.waitForTimeout(400);
 assert.match(await text('notice'),/還沒有城鎮中心/,'H with no town centre explains and jumps to the villagers');
 // An idle villager ('.' selects one and centres the camera on it), then the town centre key.
 await nm.keyboard.press('.');await nm.waitForTimeout(400);assert.match(await text('notice'),/村民/);
 // The town centre sits on the build grid's second page (N flips it).
 await nm.keyboard.press('n');await nm.waitForTimeout(300);
 const tcBtn=nm.locator('#build-town-center');assert.equal(await tcBtn.isVisible(),true,'the town centre tile is shown');
 assert.equal(await tcBtn.isDisabled(),false,`the town centre is buildable in the Dark Age on Nomad: ${await tcBtn.getAttribute('aria-label')}`);
 if(await tcBtn.getAttribute('aria-pressed')!=='true')await tcBtn.click();
 const box=obstacleBounds({kind:'town-center',...site}),p=await screenOf((box[0]+box[2])/200,(box[1]+box[3])/200);
 await nm.mouse.move(p.x,p.y);await nm.waitForTimeout(300);note('游牧預覽',await text('build-reason'));assert.match(await text('build-reason'),/左鍵放置城鎮中心/);
 const old=await text('notice');await nm.mouse.click(p.x,p.y);await nm.waitForFunction(o=>document.querySelector('#notice').textContent!==o,old,{timeout:5000});
 note('游牧放置',await text('notice'));assert.match(await text('notice'),/前往建造城鎮中心/);
 await nm.screenshot({path:out+'maps-nomad-1440.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await nm.close();
 // Phone: the lobby still fits; 鬼湖 starts; the 地圖 tab and a map page fit.
 const phone=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});watch(phone);
 await phone.goto(origin+'/web/150-brick-rts.html');await phone.waitForSelector('#lobby:not([hidden])');await phone.waitForTimeout(600);
 await phone.locator('#lobby-layout').selectOption('ghost-lake');await phone.waitForTimeout(500);assert.ok(await noOverflow(phone),'the lobby fits');
 await phone.screenshot({path:out+'maps-lobby-390.png'});
 await phone.locator('#lobby-start').tap();await phone.waitForSelector('#lobby',{state:'hidden'});await phone.waitForFunction(()=>Number(document.querySelector('#tick').textContent)>2);
 assert.match(await phone.locator('#sel-empty-title').textContent(),/鬼湖/);
 const ar=await codexMap(phone,'Arabia');assert.match(ar.name,/阿拉伯/);assert.ok(await noOverflow(phone),'the codex fits');
 const pane=await phone.evaluate(()=>{const d=document.querySelector('#codex .cx-detail');return d.scrollWidth<=d.clientWidth+1;});assert.ok(pane,'the map page fits its pane');
 await phone.screenshot({path:out+'maps-codex-390.png'});note('手機',`鬼湖對局開始；百科 ${ar.name}`);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS maps: the lobby lists the maps by expansion and previews them, a match starts on the chosen map, a Nomad villager places the first town centre in the Dark Age, the 地圖 tab draws generated maps with their counts, the phone layout fits');
}catch(e){if(page)await page.screenshot({path:out+'maps-failure.png'}).catch(()=>{});throw e;}finally{await browser.close();server.close();}
