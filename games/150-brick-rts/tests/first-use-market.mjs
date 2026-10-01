// The 建築 round's market and walls on the game screen (?debug=1, paused start): on the open map in the second age blue's
// villagers build a market; its panel sells food and buys wood at the shared price (each trade moves the price), then a
// palisade wall is dragged out as one line of segments. Pointer and tiles only; the starting match (second age, wood
// and food in stock) is a fixture of logged commands loaded through the menu.
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {serialize} from '../packages/sim/sim.ts';
import {authoritativeProblem,wallLine} from '../packages/sim/buildings.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
import {economyMatch} from './buildings-fixture.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=fileURLToPath(new URL('../test-results/',import.meta.url));fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const note=(step,detail)=>console.log(step,'|',detail);
const s=economyMatch(260925,'open',{age:2,wood:260,food:200,civs:['britons','franks']});
const tc=s.map.obstacles.find(o=>o.kind==='town-center'&&!o.red),tcBox=obstacleBounds(tc),tcc={x:(tcBox[0]+tcBox[2])/2,y:(tcBox[1]+tcBox[3])/2};
// The market: the nearest free 3x3 to the town centre; the wall: six free tiles in a row in front of it (camera side).
let market=null;for(let r=300;r<=900&&!market;r+=50)for(let i=0;i<24;i++){const x=Math.round((tcc.x+Math.cos(i*Math.PI/12)*r)/10)*10,y=Math.round((tcc.y+Math.sin(i*Math.PI/12)*r)/10)*10;if(!authoritativeProblem(s,0,'market',x,y)){market={x,y};break;}}
assert.ok(market,'a market site');const marketBox=obstacleBounds({kind:'market',...market}),mc={x:(marketBox[0]+marketBox[2])/2,y:(marketBox[1]+marketBox[3])/2};
const apart=p=>p.x+100<marketBox[0]-100||p.x>marketBox[2]+100||p.y+100<marketBox[1]-100||p.y>marketBox[3]+100;
let wall=null;for(let r=300;r<=1200&&!wall;r+=100)for(let i=0;i<16&&!wall;i++){const x=Math.floor((tcc.x+Math.cos(i*Math.PI/8)*r)/100)*100,y=Math.floor((tcc.y+Math.sin(i*Math.PI/8)*r)/100)*100,line=wallLine({x,y},{x:x+500,y});
 if(y>=tcBox[3]+100&&line.every(p=>apart(p)&&!authoritativeProblem(s,0,'palisade-wall',p.x,p.y)))wall={from:{x,y},to:{x:x+500,y}};}
assert.ok(wall,'a free row for the wall');
note('對局準備',`tick ${s.tick}，${JSON.stringify(s.accounts[0].stock)}；市集 (${market.x}, ${market.y})，木牆 (${wall.from.x}, ${wall.from.y}) → (${wall.to.x}, ${wall.to.y})`);
const browser=await chromium.launch({headless:true});const errors=[],external=[];let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
 await page.goto(origin+'/web/150-brick-rts.html?debug=1');await page.waitForFunction(()=>document.querySelector('#hash').textContent!=='—');
 const text=id=>page.locator('#'+id).innerText(),num=async id=>Number(await text(id));
 const act=async fn=>{const old=await text('notice');await fn();await page.waitForFunction(o=>document.querySelector('#notice').textContent!==o,old,{timeout:5000}).catch(()=>{});return text('notice');};
 async function screenOf(wx,wz){const r=await page.locator('#map').boundingBox(),[fx,fz,halfH,a]=(await page.locator('#map').getAttribute('data-camera')).split(',').map(Number),scale=r.height/(2*halfH),dx=wx-fx,dz=wz-fz;
  return {x:r.x+r.width/2+(dx*Math.cos(a)-dz*Math.sin(a))*scale,y:r.y+r.height/2-(0-(dx*Math.sin(a)+dz*Math.cos(a)))*Math.SQRT1_2*scale};}
 const at=p=>screenOf(p.x/100,p.y/100);
 async function minimapAt(wx,wz){const r=await page.locator('#minimap').boundingBox(),a=Number((await page.locator('#map').getAttribute('data-camera')).split(',')[3]),K=Math.SQRT1_2,n=s.map.size,sc=Math.min(r.width/(n*Math.SQRT2),r.height/(n*Math.SQRT2*K))*.96,dx=wx-n/2,dz=wz-n/2;
  return {x:r.x+r.width/2+(dx*Math.cos(a)-dz*Math.sin(a))*sc,y:r.y+r.height/2+(dx*Math.sin(a)+dz*Math.cos(a))*K*sc};}
 const look=async p=>{const m=await minimapAt(p.x/100,p.y/100);await page.mouse.click(m.x,m.y);await page.waitForTimeout(300);};
 async function runUntil(check,arg,timeout=120000){await page.locator('#pause').click();await page.waitForFunction(check,arg,{timeout});await page.locator('#pause').click();await page.waitForTimeout(200);}
 const step=async()=>{const t=await num('tick');await page.locator('#step').click();await page.waitForFunction(t0=>Number(document.querySelector('#tick').textContent)>t0,t);};
 const villagers=async()=>{await page.keyboard.press('Escape');await page.locator('[data-unit="1"]').click();await page.locator('[data-unit="2"]').click({modifiers:['Shift']});await page.locator('[data-unit="3"]').click({modifiers:['Shift']});};
 await page.evaluate(v=>localStorage.setItem('brick-rts:sandbox:1',v),serialize(s));
 await page.keyboard.press('F10');await page.locator('#load').click();await page.waitForFunction(()=>/已恢復/.test(document.querySelector('#notice').textContent),undefined,{timeout:90000});
 note('讀取',await text('stock'));
 // The market: tile B on the first page.
 await villagers();await look(mc);assert.equal(await page.locator('#build-market').isVisible(),true,'the market tile is on the first page');
 note('按市集',await act(()=>page.keyboard.press('KeyB')));const m=await at(mc);await page.mouse.move(m.x,m.y);note('預覽',await text('build-reason'));assert.match(await text('build-reason'),/左鍵放置市集/);
 note('放置市集',await act(()=>page.mouse.click(m.x,m.y)));assert.match(await text('notice'),/前往建造市集/);
 await runUntil(()=>[...document.querySelectorAll('#events li')].some(li=>/市集已建造/.test(li.textContent)),undefined,180000);note('市集完工',await text('stock'));
 // Its panel: three goods, a sell and a buy price each (this civilization's fee), shared prices that move with each trade.
 note('選取市集',await act(()=>page.mouse.click(m.x,m.y)));assert.equal(await text('building-title'),'市集');assert.equal(await page.locator('#market-panel').isVisible(),true);
 note('市集面板',`${await text('building-status')}｜${(await text('market-panel')).replace(/\s+/g,' ')}`);
 const sellFood=page.locator('[data-market="sell:food"]'),buyWood=page.locator('[data-market="buy:wood"]');
 const sell0=Number(await sellFood.locator('b').innerText()),buy0=Number(await buyWood.locator('b').innerText());assert.equal(sell0,70);assert.equal(buy0,130);
 await page.screenshot({path:out+'market-panel.png'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);await page.screenshot({path:out+'market-panel-390.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow at 390');
 await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(400);
 const food0=await num('res-food'),gold0=await num('res-gold');
 note('賣出食物',await act(()=>sellFood.click()));await step();note('成交',await text('stock'));
 assert.equal(await num('res-food'),food0-100);assert.equal(await num('res-gold'),gold0+sell0);assert.ok(Number(await sellFood.locator('b').innerText())<sell0,'selling lowers the food price');
 const wood1=await num('res-wood'),gold1=await num('res-gold');
 note('買入木材',await act(()=>buyWood.click()));await step();note('成交',await text('stock'));
 assert.equal(await num('res-wood'),wood1+100);assert.equal(await num('res-gold'),gold1-buy0);assert.ok(Number(await buyWood.locator('b').innerText())>buy0,'buying raises the wood price');
 assert.ok(await page.locator('#production [data-train="trade-cart"]').count(),'the market trains trade carts');
 // A palisade wall: page II (N), press on the first tile, drag to the last, release.
 await villagers();await look({x:wall.from.x+300,y:wall.from.y+50});
 await page.keyboard.press('KeyN');note('按木牆',await act(()=>page.keyboard.press('KeyQ')));assert.match(await text('notice'),/木牆/);
 const a=await at({x:wall.from.x+50,y:wall.from.y+50}),b=await at({x:wall.to.x+50,y:wall.to.y+50});
 await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});note('拖曳預覽',await text('build-reason'));assert.match(await text('build-reason'),/木牆 6 段，共 木材 12/);
 await page.screenshot({path:out+'wall-drag-preview.png'});
 const wood2=await num('res-wood');note('放開',await act(()=>page.mouse.up()));assert.match(await text('notice'),/整列城牆/);await step();
 note('扣款',await text('stock'));assert.equal(await num('res-wood'),wood2-12);
 await runUntil(()=>[...document.querySelectorAll('#events li')].filter(li=>/木牆已建造/.test(li.textContent)).length>=1,undefined,120000);
 await page.screenshot({path:out+'wall-built.png'});
 note('錯誤',JSON.stringify({errors,external}));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS market: market built, sell and buy at the shared price, a dragged palisade wall');
}catch(e){if(page)await page.screenshot({path:out+'market-failure.png'}).catch(()=>{});throw e;}finally{await browser.close();server.close();}
