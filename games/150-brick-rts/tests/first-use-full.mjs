// (base copied from first-use-match.mjs) Prompt 19 full match against the computer: first visit (normal mode, no ?debug) to the result screen and a new game.
// Only the HUD, keyboard, minimap and pointer are used. Enemy positions come from what blue has seen
// (the fog debugger's memory list, the same knowledge the minimap shows), never from red's state.
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {createState} from '../packages/sim/sim.ts';
import {authoritativeProblem} from '../packages/sim/buildings.ts';
import {clearSegment,nodeTotal,position} from '../packages/sim/navigation.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=fileURLToPath(new URL('../test-results/',import.meta.url));fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
// Blue's side of the opening map (identical in every match: same seed, blue acts only through this flow).
const world=createState(260925,'open','ai'),tc=world.map.obstacles.find(o=>o.kind==='town-center'&&!o.red),tcBox=obstacleBounds(tc);
const berries=world.map.obstacles.filter(o=>o.kind==='berries').sort((a,b)=>Math.hypot(a.x-tc.x,a.y-tc.y)-Math.hypot(b.x-tc.x,b.y-tc.y))[0];
const mid=world.map.size*50,tcc={x:(tcBox[0]+tcBox[2])/2,y:(tcBox[1]+tcBox[3])/2},axis=Math.hypot(tcc.x-mid,tcc.y-mid),side=(x,y)=>((x-mid)*(tcc.x-mid)+(y-mid)*(tcc.y-mid))/axis;
const trees=world.map.obstacles.filter(o=>o.kind==='tree'&&side(o.x,o.y)>0).sort((a,b)=>Math.hypot(a.x-tc.x,a.y-tc.y)-Math.hypot(b.x-tc.x,b.y-tc.y));
// Blue's own side of the map only (a sensible player's base), nearest to the given point, clear of the other planned site.
function site(kind,from,avoid=[]){const out=[];for(let x=from.x-900;x<=from.x+900;x+=10)for(let y=from.y-900;y<=from.y+900;y+=10){const b=obstacleBounds({kind,x,y});if(b[0]<0||b[1]<0||b[2]>mid*2||b[3]>mid*2)continue;if(Math.min(side(b[0],b[1]),side(b[2],b[1]),side(b[0],b[3]),side(b[2],b[3]))<100)continue;
 if(avoid.some(a=>Math.min(b[2],a[2])>Math.max(b[0],a[0])-60&&Math.min(b[3],a[3])>Math.max(b[1],a[1])-60))continue;out.push({x,y,b,d:Math.hypot(x-from.x,y-from.y)});}
 for(const c of out.sort((a,b)=>a.d-b.d))if(!authoritativeProblem(world,0,kind,c.x,c.y))return c.b;throw Error('no site');}
const tcCentre={x:(tcBox[0]+tcBox[2])/2,y:(tcBox[1]+tcBox[3])/2};
const barracksBox=site('barracks',{x:Math.round(tcCentre.x/10)*10,y:Math.round((tcCentre.y+500)/10)*10}),houseBox=site('house',{x:Math.round((tcCentre.x-400)/10)*10,y:Math.round((tcCentre.y+200)/10)*10},[barracksBox]),farmBox=site('farm',{x:Math.round((tcCentre.x+300)/10)*10,y:Math.round((tcCentre.y+250)/10)*10},[barracksBox,houseBox]);
// Archery range: a few candidate spots, since a walking villager may stand on the first one.
const rangeBoxes=[[450,500],[-450,500],[500,-100],[-500,-100]].map(([dx,dy])=>site('archery-range',{x:Math.round((tcCentre.x+dx)/10)*10,y:Math.round((tcCentre.y+dy)/10)*10},[barracksBox,houseBox,farmBox]));
let rangeBox=rangeBoxes[0];
const gold=world.map.obstacles.filter(o=>o.kind==='gold').sort((a,b)=>Math.hypot(a.x-tc.x,a.y-tc.y)-Math.hypot(b.x-tc.x,b.y-tc.y))[0];
const redTc=world.map.obstacles.find(o=>o.kind==='town-center'&&o.red),redBox=obstacleBounds(redTc),scoutAt=world.map.scouts[0];
const browser=await chromium.launch({headless:true});const errors=[],external=[],log=[],done=new Set();
const note=(step,detail)=>{log.push({step,detail});console.log(step,'|',detail);};
let page;
try{
 // One browser context for the whole flow, so a reload keeps this browser's saved settings like a real one.
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const open=async()=>{page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
  await page.goto(origin+'/web/150-brick-rts.html');await page.waitForFunction(()=>Number(document.querySelector('#tick').textContent)>2);
  // Test instrumentation only: collect every sound name the page records on <body>.
  await page.evaluate(()=>{window.heard=[];new MutationObserver(()=>window.heard.push(document.body.dataset.lastSound)).observe(document.body,{attributes:true,attributeFilter:['data-sounds']});});};
 const text=id=>page.locator('#'+id).innerText(),tick=()=>page.evaluate(()=>Number(document.querySelector('#tick').textContent)),num=async id=>Number(await text(id));
 const act=async fn=>{const old=await text('notice');await fn();await page.waitForFunction(o=>document.querySelector('#notice').textContent!==o,old,{timeout:5000}).catch(()=>{});return text('notice');};
 async function screenOf(wx,wy,wz){const r=await page.locator('#map').boundingBox(),[fx,fz,halfH,a]=(await page.locator('#map').getAttribute('data-camera')).split(',').map(Number),scale=r.height/(2*halfH),dx=wx-fx,dz=wz-fz;
  return {x:r.x+r.width/2+(dx*Math.cos(a)-dz*Math.sin(a))*scale,y:r.y+r.height/2-(wy-(dx*Math.sin(a)+dz*Math.cos(a)))*Math.SQRT1_2*scale};}
 const centreOf=(box,h=0)=>screenOf((box[0]+box[2])/200,h,(box[1]+box[3])/200);
 async function minimapAt(wx,wz){const r=await page.locator('#minimap').boundingBox(),a=Number((await page.locator('#map').getAttribute('data-camera')).split(',')[3]),K=Math.SQRT1_2,n=world.map.size,s=Math.min(r.width/(n*Math.SQRT2),r.height/(n*Math.SQRT2*K))*.96,dx=wx-n/2,dz=wz-n/2;
  return {x:r.x+r.width/2+(dx*Math.cos(a)-dz*Math.sin(a))*s,y:r.y+r.height/2+(dx*Math.sin(a)+dz*Math.cos(a))*K*s};}
 async function lookAt(wx,wz){const p=await minimapAt(wx,wz);await page.mouse.click(p.x,p.y);await page.waitForTimeout(60);}
 const home=async()=>lookAt(tcCentre.x/100,tcCentre.y/100+2);
 async function place(key,box,label){await page.keyboard.press(key);const p=await centreOf(box);await page.mouse.move(p.x,p.y);await page.waitForFunction(l=>document.querySelector('#build-reason').textContent.includes(`左鍵放置${l}`),label,{timeout:5000}).catch(async e=>{throw Error(`${label}: ${await text('build-reason')} | ${await text('notice')}`);});return act(()=>page.mouse.click(p.x,p.y));}
 async function waitFor(fn,arg,ms=120000){await page.waitForFunction(fn,arg,{timeout:ms});}

 // 1. First visit, then graphics quality and volume; both survive a reload.
 await open();note('首次進站',await text('notice'));
 await page.keyboard.press('F10');await page.locator('#quality').selectOption('low');await page.locator('#volume').fill('30');await page.locator('#volume').dispatchEvent('input');
 note('設定畫質與音量',`畫質 ${await page.locator('#map').getAttribute('data-quality')}｜音量 ${await text('volume-value')}`);assert.equal(await page.locator('#map').getAttribute('data-quality'),'low');assert.equal(await text('volume-value'),'30%');
 await page.close();await open();await page.keyboard.press('F10');
 note('重新載入後',`畫質 ${await page.locator('#quality').inputValue()}｜音量 ${await page.locator('#volume').inputValue()}｜畫布 ${await page.locator('#map').getAttribute('data-quality')}`);
 assert.equal(await page.locator('#quality').inputValue(),'low');assert.equal(await page.locator('#volume').inputValue(),'30');assert.equal(await page.locator('#map').getAttribute('data-quality'),'low');done.add('settings');
 // 2. Create the match from the menu: open land, computer, fixed seed.
 await page.locator('#layout').selectOption('open');await page.locator('#opponent').selectOption('ai');await page.locator('#seed').fill('260925');
 note('建立對局',await act(()=>page.locator('#restart').click()));await waitFor(()=>Number(document.querySelector('#tick').textContent)>2);assert.match(await text('sel-empty-title'),/曠野 · 對手：電腦/);
 await page.locator('#speed').selectOption('4');
 // 3. Find villagers; food and wood; delivery; a house and a barracks.
 await act(()=>page.keyboard.press('Period'));let p=await centreOf(obstacleBounds(berries),.3);note('找出村民並採野果',await act(()=>page.mouse.click(p.x,p.y,{button:'right'})));
 await act(()=>page.keyboard.press('Period'));note('造房',await place('KeyQ',houseBox,'住宅'));
 await act(()=>page.keyboard.press('Period'));note('造軍營',await place('KeyW',barracksBox,'兵營'));
 // Not enough wood left for a second barracks: the hotkey explains instead of doing nothing.
 note('資源不足時的說明',await act(()=>page.keyboard.press('KeyW')));assert.match(await text('notice'),/木材不足/);
 await waitFor(()=>Number(document.querySelector('#res-food').textContent)>200);note('送返',`食物 ${await text('res-food')}`);done.add('deliver');
 await waitFor(()=>document.querySelector('#res-pop').textContent==='4/10');note('住宅完工',await text('res-pop'));
 // Builders go to work, both on wood: the archery range and the archers need it (the starting gold pays for three archers).
 for(const [label,box] of [['採木',obstacleBounds(trees[0])],['採木',obstacleBounds(trees[1])]]){await waitFor(()=>document.querySelector('#idle-count').textContent!=='',undefined,90000);await home();await act(()=>page.keyboard.press('Period'));p=await centreOf(box,.4);note(label,await act(()=>page.mouse.click(p.x,p.y,{button:'right'})));}
 // 4. Age up once the berries have paid for it; the berry picker then joins the woodcutter (the archery range needs 175).
 await waitFor(()=>Number(document.querySelector('#res-food').textContent)>=300,undefined,180000);
 await home();await act(()=>page.keyboard.press('KeyH'));const age=page.locator('#production button[data-train="age-2"]');
 note('研究第二時代',await act(()=>age.click()));await waitFor(()=>/第二時代/.test(document.querySelector('#age-name').textContent),undefined,120000);note('升時代',await text('age-name'));done.add('age');
 await waitFor(()=>document.querySelector('#idle-count').textContent!=='',undefined,120000).catch(()=>{});
 const woods=obstacleBounds(trees[0]);
 await home();await act(()=>page.keyboard.press('Period'));p=await centreOf(woods,.4);note('村民 1 採木',await act(()=>page.mouse.click(p.x,p.y,{button:'right'})));
 // 5. Archery range (second age and a finished barracks): the same villager, still selected, lays it out once the wood allows.
 await waitFor(()=>Number(document.querySelector('#res-wood').textContent)>=175,undefined,240000);note('木材',`${await text('res-wood')}（tick ${await tick()}）`);
 await home();await page.keyboard.press('KeyZ');for(const box of rangeBoxes){const q=await centreOf(box);await page.mouse.move(q.x,q.y);await page.waitForTimeout(150);if((await text('build-reason')).includes('左鍵放置靶場')){rangeBox=box;break;}note('靶場預覽',await text('build-reason'));}
 assert.match(await text('build-reason'),/左鍵放置靶場/);{const q=await centreOf(rangeBox);note('造靶場',await act(()=>page.mouse.click(q.x,q.y)));}assert.match(await text('notice'),/前往建造靶場/);
 await waitFor(()=>document.querySelector('#idle-count').textContent!=='',undefined,120000);note('靶場完工',`tick ${await tick()}`);await home();await act(()=>page.keyboard.press('Period'));p=await centreOf(woods,.4);note('回去採木',await act(()=>page.mouse.click(p.x,p.y,{button:'right'})));
 // 6. Soldiers: archers come from the archery range; a quick double click queues two at once.
 await home();p=await centreOf(rangeBox);await page.mouse.click(p.x,p.y);await waitFor(()=>document.querySelector('#building-title').textContent==='靶場');
 const archer=page.locator('#production button[data-train="archer"]');await waitFor(()=>!document.querySelector('#production button[data-train="archer"]').disabled,undefined,120000);
 await archer.dblclick();await page.waitForTimeout(400);note('快速雙擊生產',`佇列 ${await page.locator('#queue').evaluate(q=>q.children.length)} 項｜${await text('notice')}`);
 for(let i=0;i<40;i++){if(await archer.isEnabled())await archer.click();await page.waitForTimeout(700);if((await page.locator('#queue').evaluate(q=>q.children.length))>=4)break;}
 await waitFor(()=>document.querySelector('#queue').children.length===0,undefined,180000).catch(()=>{});note('造兵',`人口 ${await text('res-pop')}`);done.add('train');
 // 7. Scout: click the scout, ride towards the far side until red's town centre is known.
 await lookAt(scoutAt.x/100,scoutAt.y/100);p=await screenOf(scoutAt.x/100,.8,scoutAt.y/100);await page.mouse.click(p.x,p.y);await page.waitForTimeout(150);
 note('選取斥候',await text('unit-name').catch(()=>''));const mid=world.map.size/2,target={x:2*mid-tcCentre.x/100,z:2*mid-tcCentre.y/100};
 let m=await minimapAt(target.x,target.z);note('偵查',await act(()=>page.mouse.click(m.x,m.y,{button:'right'})));
 await page.evaluate(()=>{const d=document.querySelector('#fog-debug');d.open=true;d.dispatchEvent(new Event('toggle'));});
 await waitFor(()=>/紅方城鎮中心/.test(document.querySelector('.fog-memories').textContent),undefined,180000);note('偵查結果',(await page.locator('.fog-memories').innerText()).split('；').find(t=>t.startsWith('紅方城鎮中心')));done.add('scout');
 // 8. Attack, retreat, attack again; resign if the army is lost (a first-time player's honest way out).
 const known=async()=>(await page.locator('.fog-memories').innerText()).split('；').filter(t=>t.startsWith('紅方')).map(t=>{const g=/中心 \(([\d.]+), ([\d.]+)\)/.exec(t);return {label:t.split(' ')[0],x:Number(g[1]),z:Number(g[2])};});
 async function attackNearest(){const list=await known();const t=list.sort((a,b)=>Math.hypot(a.x-redBox[0]/100,a.z-redBox[1]/100)-Math.hypot(b.x-redBox[0]/100,b.z-redBox[1]/100))[0];if(!t)return null;await lookAt(t.x,t.z);const q=await screenOf(t.x,.3,t.z);return act(()=>page.mouse.click(q.x,q.y,{button:'right'}));}
 note('全部軍隊',await act(()=>page.keyboard.press('Comma')));note('攻擊',await attackNearest());done.add('attack');
 await page.waitForTimeout(2500);await page.keyboard.press('Comma');m=await minimapAt(tcCentre.x/100,tcCentre.y/100+3);note('撤退',await act(()=>page.mouse.click(m.x,m.y,{button:'right'})));assert.match(await text('notice'),/移動指令已排入/);done.add('retreat');
 await page.waitForTimeout(2500);await page.keyboard.press('Comma');note('再次攻擊',await attackNearest());
 for(let round=0;round<300&&await page.locator('#result').isHidden();round++){await page.waitForTimeout(800);
  if(await tick()>45000)break;const n=await act(()=>page.keyboard.press('Comma'));
  if(/沒有軍隊/.test(n)){note('軍隊覆沒',`tick ${await tick()}：投降`);await page.keyboard.press('F10');await page.locator('#resign').click();await page.locator('#resign').click();break;}
  if(round%5===0){const r=await attackNearest();if(r&&/攻擊/.test(r)&&round%25===0)note('攻擊',r);}}
 await page.locator('#result').waitFor({state:'visible',timeout:10000});note('勝敗',`${await text('result-title')}｜${await text('result-detail')}`);assert.match(await text('result-title'),/勝利|戰敗/);done.add('result');
 await page.screenshot({path:out+'full-result.png'});
 // 9. Orders after the end are refused plainly; then a new match.
 {const r=await page.locator('#map').boundingBox();p={x:r.x+90,y:r.y+r.height-90};}// an open corner, clear of the result dialog
 note('結束後再下命令',await act(()=>page.mouse.click(p.x,p.y,{button:'right'})));assert.match(await text('notice'),/對局已結束/);
 note('再開局',await act(()=>page.locator('#result-restart').click()));await waitFor(()=>document.querySelector('#result').hidden&&Number(document.querySelector('#tick').textContent)>2);done.add('restart');
 const heard=await page.evaluate(()=>window.heard);note('聽到的音效',[...new Set(heard)].join('、'));
 for(const s of ['select-villager','order','place','built','age'])assert.ok(heard.includes(s),`sound ${s}`);
 assert.deepEqual([...done].sort(),['age','attack','deliver','restart','result','retreat','scout','settings','train']);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 fs.writeFileSync(out+'first-use-full.json',JSON.stringify(log,null,1));console.log('PASS prompt 19 path: settings, match, gather, deliver, build, age up, train, scout, attack, retreat, result, restart');
}catch(e){if(page&&!page.isClosed())await page.screenshot({path:out+'full-failure.png'}).catch(()=>{});console.error(e);process.exitCode=1;}
finally{await browser.close();server.close();}
