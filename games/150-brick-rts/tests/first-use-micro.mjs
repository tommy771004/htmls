// The 戰術技巧 round's controls on the game screen (?debug=1, paused start): three militia take the stand-ground stance (E;
// the tile shows pressed and the panel names it), then patrol (A, then a ground click) and turn at the far end; the five
// soldiers move once packed and once with the spread toggle (D) and end farther apart; two archers shoot a deer and their
// arrows are in the air (the canvas's data-flights). The starting match is a fixture of logged commands loaded through the
// menu (tests/micro-fixture.ts). Pointer and keys only; 1440x900 and 390x844, no page errors, no outside requests, no
// sideways scroll on the phone.
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {serialize} from '../packages/sim/sim.ts';
import {microMatch} from './micro-fixture.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=fileURLToPath(new URL('../test-results/',import.meta.url));fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]??'application/octet-stream');fs.createReadStream(file).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const note=(step,detail)=>console.log(step,'|',detail);
const m=microMatch(),s=m.s,unit=id=>s.units.find(u=>u.id===id),deer=unit(m.deer);
note('對局準備',`tick ${s.tick}，第 ${s.ages[0]} 時代，命令 ${s.log.length} 筆，民兵 ${m.militia.join('、')}，弓手 ${m.archers.join('、')}`);
const browser=await chromium.launch({headless:true});const errors=[],external=[];let page;
// How spread out a group stands: each unit's distance to its nearest neighbour (Chebyshev), averaged. A unit that cannot
// reach its own spread station stops beside a neighbour, so the average (not the minimum) is what the spread order moves.
const spacing=(st,ids)=>{const us=ids.map(id=>st.units.find(u=>u.id===id));return us.reduce((t,u)=>t+Math.min(...us.filter(v=>v!==u).map(v=>Math.max(Math.abs(u.x-v.x),Math.abs(u.y-v.y)))),0)/us.length;};
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
 const look=async p=>{const q=await minimapAt(p.x/100,p.y/100);await page.mouse.click(q.x,q.y);await page.waitForTimeout(300);};
 // Runs the game until the tick passes `ticks` more (or a page condition holds), then pauses again.
 async function runFor(ticks){const t0=await num('tick');await page.locator('#pause').click();await page.waitForFunction(t=>Number(document.querySelector('#tick').textContent)>=t,t0+ticks,{timeout:120000});await page.locator('#pause').click();await page.waitForTimeout(200);}
 const step=async()=>{const t=await num('tick');await page.locator('#step').click();await page.waitForFunction(t0=>Number(document.querySelector('#tick').textContent)>t0,t);};
 const saved=async()=>{await page.keyboard.press('F10');await page.locator('#save').click();await page.waitForFunction(()=>/已儲存/.test(document.querySelector('#notice').textContent));return JSON.parse(await page.evaluate(()=>localStorage.getItem('brick-rts:sandbox:1'))).state;};
 // Clicks each unit (Shift adds), so a villager standing near the group is never caught as a box would.
 const pickUnits=async(ids,st)=>{await page.keyboard.press('Escape');for(const [i,id] of ids.entries()){const q=await at(st.units.find(u=>u.id===id));if(i)await page.keyboard.down('Shift');await page.mouse.click(q.x,q.y-10);if(i)await page.keyboard.up('Shift');await page.waitForTimeout(120);}};
 const phone=async name=>{await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);await page.screenshot({path:out+`${name}-390.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`no horizontal overflow at 390 (${name})`);await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(400);};
 await page.evaluate(v=>localStorage.setItem('brick-rts:sandbox:1',v),serialize(s));
 await page.keyboard.press('F10');await page.locator('#load').click();await page.waitForFunction(()=>/已恢復/.test(document.querySelector('#notice').textContent),undefined,{timeout:120000});
 // 1. Stances: the militia's grid shows the four stance tiles (aggressive pressed by default); E makes them stand ground.
 await look(unit(m.militia[0]));await page.keyboard.press('Escape');await page.keyboard.press('Comma');
 // ',' takes all five soldiers; Shift-clicking the two archers (standing apart) leaves the three militia.
 for(const id of m.archers){const q=await at(unit(id));await page.keyboard.down('Shift');await page.mouse.click(q.x,q.y-10);await page.keyboard.up('Shift');await page.waitForTimeout(120);}note('選取民兵',await text('group-summary'));assert.match(await text('group-summary'),/已選取 3 名/);
 for(const id of ['stance-aggressive','stance-defensive','stance-stand','stance-passive','patrol-cmd','spread-cmd'])assert.equal(await page.locator('#'+id).isVisible(),true,`${id} shows for soldiers`);
 assert.equal(await page.locator('#stance-aggressive').getAttribute('aria-pressed'),'true','aggressive is the default');
 note('堅守位置（E）',await act(()=>page.keyboard.press('KeyE')));await step();
 await page.waitForFunction(()=>document.querySelector('#stance-stand').getAttribute('aria-pressed')==='true');
 assert.equal(await page.locator('#stance-aggressive').getAttribute('aria-pressed'),'false');note('姿態',await text('group-summary'));assert.match(await text('group-summary'),/堅守位置/);
 await page.locator('#stance-defensive').hover();await page.waitForTimeout(300);
 await page.screenshot({path:out+'micro-stance.png'});await phone('micro-stance');
 // 2. Patrol: A arms it (the tile shows pressed), a ground click four tiles away starts it; the militia turn at the far end.
 const from=unit(m.militia[0]),far={x:Math.max(150,Math.min(s.map.size*100-150,from.x-400)),y:from.y};
 note('巡邏（A）',await act(()=>page.keyboard.press('KeyA')));assert.equal(await page.locator('#patrol-cmd').getAttribute('aria-pressed'),'true');
 {const q=await at(far);note('點地面',await act(()=>page.mouse.click(q.x,q.y)));}assert.match(await text('notice'),/開始巡邏/);await step();
 await page.waitForFunction(()=>/巡邏中 3/.test(document.querySelector('#group-summary').textContent));note('巡邏中',await text('group-summary'));
 {const dashes=Number(await page.locator('#map').getAttribute('data-patrol'));note('巡邏路線',`${dashes} 段虛線`);assert.ok(dashes>0,'the selected patrol route is drawn');}
 await runFor(150);{const st=await saved(),legs=m.militia.map(id=>st.patrols[id]?.leg);note('巡邏狀態',JSON.stringify(legs));assert.ok(legs.includes('back'),'a militia reached the far end and turned');}
 await page.screenshot({path:out+'micro-patrol.png'});
 // 3. Spread: the five soldiers (',') move once packed, then once with D on; the spread move leaves them farther apart.
 const soldiers=[...m.militia,...m.archers];
 await page.keyboard.press('Comma');note('全部軍隊',await text('group-summary'));assert.match(await text('group-summary'),/已選取 5 名/);
 const packed={x:m.open.x,y:m.open.y-300},spreadTo={x:m.open.x,y:m.open.y+100};
 await look(packed);{const q=await at(packed);note('右鍵移動',await act(()=>page.mouse.click(q.x,q.y,{button:'right'})));}
 await runFor(220);const d1=spacing(await saved(),soldiers);
 note('分散（D）',await act(()=>page.keyboard.press('KeyD')));assert.equal(await page.locator('#spread-cmd').getAttribute('aria-pressed'),'true');
 await look(spreadTo);{const q=await at(spreadTo);note('右鍵移動',await act(()=>page.mouse.click(q.x,q.y,{button:'right'})));}assert.match(await text('notice'),/分散移動/);
 await runFor(220);const d2=spacing(await saved(),soldiers);note('平均最近距離',`集中 ${d1}，分散 ${d2}`);assert.ok(d2>=d1+20,`spread ${d2} wider than packed ${d1}`);
 await page.screenshot({path:out+'micro-spread.png'});
 // 4. Arrows in flight: the archers (aggressive) shoot the deer; the canvas counts the shots in the air.
 await page.keyboard.press('KeyD');const st=await saved(),a0=st.units.find(u=>u.id===m.archers[0]),d=st.units.find(u=>u.id===m.deer);
 await look(a0);await pickUnits(m.archers,st);note('選取弓手',await text('group-summary'));assert.match(await text('group-summary'),/已選取 2 名 · 弓手 ×2/);
 await look(d);{const q=await at(d);note('右鍵鹿',await act(()=>page.mouse.click(q.x,q.y-10,{button:'right'})));}assert.match(await text('notice'),/鹿/);
 await page.locator('#pause').click();const seen=await (await page.waitForFunction(()=>{const n=Number(document.querySelector('#map').dataset.flights??0);return n>0&&n;},undefined,{timeout:60000})).jsonValue();
 await page.screenshot({path:out+'micro-arrows-flight.png'});await page.locator('#pause').click();
 note('飛行中',`${seen} 支箭（弓手 ${a0.x},${a0.y} → 鹿 ${d.x},${d.y}）`);
 await page.screenshot({path:out+'micro-arrows.png'});await phone('micro-arrows');
 note('錯誤',JSON.stringify({errors,external}));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('PASS micro: stand ground pressed, a patrol turned at its far end, a spread move ended wider than a packed one, arrows in flight');
}catch(e){if(page)await page.screenshot({path:out+'micro-failure.png'}).catch(()=>{});throw e;}finally{await browser.close();server.close();}
