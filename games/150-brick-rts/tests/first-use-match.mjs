// Prompt 19 full match against the computer: first visit (normal mode, no ?debug) to the result screen and a new game.
// Only the HUD, keyboard, minimap and pointer are used. Enemy positions come from what blue has seen
// (the fog debugger's memory list, the same knowledge the minimap shows), never from red's state.
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {createState} from '../packages/sim/sim.ts';
import {authoritativeProblem} from '../packages/sim/buildings.ts';
import {clearSegment} from '../packages/sim/navigation.ts';
import {obstacleBounds} from '../packages/content/footprints.ts';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=fileURLToPath(new URL('../test-results/',import.meta.url));fs.mkdirSync(out,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.json':'application/json','.css':'text/css','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
// Blue's side of the opening map (identical in every match: same seed, blue acts only through this flow).
const world=createState(260925,'meadow','ai'),tc=world.map.obstacles.find(o=>o.kind==='town-center'&&!o.red),tcBox=obstacleBounds(tc);
const berries=world.map.obstacles.filter(o=>o.kind==='berries').sort((a,b)=>Math.hypot(a.x-tc.x,a.y-tc.y)-Math.hypot(b.x-tc.x,b.y-tc.y))[0];
const trees=world.map.obstacles.filter(o=>o.kind==='tree'&&o.x<800).sort((a,b)=>Math.hypot(a.x-tc.x,a.y-tc.y)-Math.hypot(b.x-tc.x,b.y-tc.y));
// Blue's own half only (a sensible player's base), nearest to the given point, clear of the other planned site.
function site(kind,from,avoid=[]){const out=[];for(let x=0;x<=800;x+=10)for(let y=0;y<=1400;y+=10){const b=obstacleBounds({kind,x,y});if(b[0]<0||b[2]>800||b[3]>1600)continue;
 if(avoid.some(a=>Math.min(b[2],a[2])>Math.max(b[0],a[0])-60&&Math.min(b[3],a[3])>Math.max(b[1],a[1])-60))continue;out.push({x,y,b,d:Math.hypot(x-from.x,y-from.y)});}
 for(const c of out.sort((a,b)=>a.d-b.d))if(!authoritativeProblem(world,0,kind,c.x,c.y))return c.b;throw Error('no site');}
const barracksBox=site('barracks',{x:700,y:900}),houseBox=site('house',{x:600,y:800},[barracksBox]);
const rally=[...Array(961).keys()].map(n=>({x:50+(n%31)*50,y:50+Math.floor(n/31)*50})).filter(p=>p.x<750&&clearSegment(world.map,p,p)).sort((a,b)=>Math.hypot(a.x-560,a.y-1250)-Math.hypot(b.x-560,b.y-1250))[0];
const browser=await chromium.launch({headless:true});const errors=[],external=[],log=[];
const note=(step,detail)=>{log.push({step,detail});console.log(step,'|',detail);};
let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
 await page.goto(origin+'/web/150-brick-rts.html');await page.waitForFunction(()=>Number(document.querySelector('#tick').textContent)>2);
 const text=id=>page.locator('#'+id).innerText(),tick=()=>page.evaluate(()=>Number(document.querySelector('#tick').textContent));
 const act=async fn=>{const old=await text('notice');await fn();await page.waitForFunction(o=>document.querySelector('#notice').textContent!==o,old,{timeout:5000}).catch(()=>{});return text('notice');};
 async function screenOf(wx,wy,wz){const r=await page.locator('#map').boundingBox(),[fx,fz,halfH,a]=(await page.locator('#map').getAttribute('data-camera')).split(',').map(Number),scale=r.height/(2*halfH),dx=wx-fx,dz=wz-fz;
  return {x:r.x+r.width/2+(dx*Math.cos(a)-dz*Math.sin(a))*scale,y:r.y+r.height/2-(wy-(dx*Math.sin(a)+dz*Math.cos(a)))*Math.SQRT1_2*scale};}
 const centreOf=(box,h=0)=>screenOf((box[0]+box[2])/200,h,(box[1]+box[3])/200);
 // Minimap: the same projection the page draws with (camera heading, 45-degree foreshortening).
 async function minimapAt(wx,wz){const r=await page.locator('#minimap').boundingBox(),a=Number((await page.locator('#map').getAttribute('data-camera')).split(',')[3]),K=Math.SQRT1_2,s=Math.min(r.width/(16*Math.SQRT2),r.height/(16*Math.SQRT2*K))*.96,dx=wx-8,dz=wz-8;
  return {x:r.x+r.width/2+(dx*Math.cos(a)-dz*Math.sin(a))*s,y:r.y+r.height/2+(dx*Math.sin(a)+dz*Math.cos(a))*K*s};}
 // A player who sees the pause banner presses F3; the flow records every such auto-pause.
 let pauses=0;async function keepRunning(){if(await page.locator('#paused-banner').isVisible()&&await page.locator('#result').isHidden()){pauses++;note('自動暫停',await text('notice'));await page.keyboard.press('F3');}}
 async function lookAt(wx,wz){const p=await minimapAt(wx,wz);await page.mouse.click(p.x,p.y);await page.waitForTimeout(60);}
 async function place(key,box,label){await page.keyboard.press(key);const p=await centreOf(box);await page.mouse.move(p.x,p.y);await page.waitForFunction(l=>document.querySelector('#build-reason').textContent.includes(`左鍵放置${l}`),label,{timeout:5000});return act(()=>page.mouse.click(p.x,p.y));}
 note('首次進站',`${await text('notice')}｜對手：${await text('sel-empty-title')}`);assert.match(await text('sel-empty-title'),/對手：電腦/);
 await page.locator('#speed').selectOption('4');
 // Opening: berries, a house, a barracks. Starting stock pays for all three.
 await act(()=>page.keyboard.press('Period'));let p=await centreOf(obstacleBounds(berries),.3);note('村民 1 採野果',await act(()=>page.mouse.click(p.x,p.y,{button:'right'})));
 await act(()=>page.keyboard.press('Period'));note('村民 2 蓋住宅',await place('KeyQ',houseBox,'住宅'));
 await act(()=>page.keyboard.press('Period'));note('村民 3 蓋兵營',await place('KeyW',barracksBox,'兵營'));
 await page.waitForFunction(()=>document.querySelector('#res-pop').textContent==='3/10',undefined,{timeout:60000});note('住宅完工',await text('res-pop'));
 // Barracks: select it, rally south of the base, queue militia as food and gold allow.
 async function selectBarracks(){await lookAt((tcBox[0]+tcBox[2])/200,(tcBox[1]+tcBox[3])/200+2.5);p=await centreOf(barracksBox);await page.mouse.click(p.x,p.y);await page.waitForFunction(()=>document.querySelector('#building-title').textContent==='兵營');}
 await selectBarracks();await page.waitForFunction(()=>/已完工/.test(document.querySelector('#building-status').textContent),undefined,{timeout:60000});
 p=await screenOf(rally.x/100,0,rally.y/100);note('設定集結點',await act(()=>page.mouse.click(p.x,p.y,{button:'right'})));
 const militia=page.locator('#production button[data-train="militia"]');let queued=0;
 async function queueMilitia(){await selectBarracks();while(queued<6&&await militia.isEnabled()){await militia.click();queued++;await page.waitForTimeout(80);}}
 await queueMilitia();note('民兵入列',`${queued} 名｜${await text('res-food')} 食物`);
 // Idle builders chop wood while the army forms.
 for(let i=0;i<2;i++){if(await text('idle-count')==='')break;await page.keyboard.press('Period');const t=trees[i];p=await centreOf(obstacleBounds(t),.6);await page.mouse.click(p.x,p.y,{button:'right'});}
 await page.screenshot({path:out+'match-opening.png'});
 // Wait for the army at the rally point (more militia are queued whenever the berries pay for them).
 // The army is ready when population shows the three villagers plus every queued militia.
 for(let i=0;i<240;i++){await keepRunning();const [used]=(await text('res-pop')).split('/').map(Number);if(used>=3+queued&&queued>=5)break;
  if(queued<6&&Number(await text('res-food'))>=60&&Number(await text('res-gold'))>=20)await queueMilitia();await page.waitForTimeout(1000);}
 note('軍隊集結',`tick ${await tick()}，人口 ${await text('res-pop')}，已排 ${queued} 名民兵`);assert.ok(Number((await text('res-pop')).split('/')[0])>=8,'the army exists');
 // Army: box-select around the rally point and store it as group 1.
 await lookAt(rally.x/100,rally.y/100);const c=await screenOf(rally.x/100,0,rally.y/100);
 await page.mouse.move(c.x-120,c.y-90);await page.mouse.down();await page.mouse.move(c.x+120,c.y+90,{steps:6});await page.mouse.up();
 note('框選軍隊',`${await text('group-summary').catch(()=>'')}｜${await text('notice')}`);await page.keyboard.press('Control+Digit1');
 // March: attack every red building blue knows about until the result screen appears.
 const redTc=world.map.obstacles.find(o=>o.kind==='town-center'&&o.red),redBox=obstacleBounds(redTc);
 await page.evaluate(()=>{const d=document.querySelector('#fog-debug');d.open=true;d.dispatchEvent(new Event('toggle'));});
 await page.keyboard.press('Digit1');await lookAt((redBox[0]+redBox[2])/200,(redBox[1]+redBox[3])/200);
 // March to open ground in front of the red gate (kept clear: the computer leaves a margin round its town centre).
 const front=[...Array(961).keys()].map(n=>({x:50+(n%31)*50,y:50+Math.floor(n/31)*50})).filter(p=>p.y>redBox[3]+60&&clearSegment(world.map,p,p)).sort((a,b)=>Math.hypot(a.x-(redBox[0]+redBox[2])/2,a.y-redBox[3]-150)-Math.hypot(b.x-(redBox[0]+redBox[2])/2,b.y-redBox[3]-150))[0];
 let m=await minimapAt(front.x/100,front.y/100);note('進軍紅方基地',await act(()=>page.mouse.click(m.x,m.y,{button:'right'})));
 let last='',rounds=0;
 while(await page.locator('#result').isHidden()&&rounds<400){rounds++;await page.waitForTimeout(700);await keepRunning();
  if(Number(await tick())>40000)break;
  const known=(await page.locator('.fog-memories').innerText()).split('；').filter(t=>t.startsWith('紅方')).map(t=>{const g=/中心 \(([\d.]+), ([\d.]+)\)/.exec(t);return {label:t.split(' ')[0],x:Number(g[1]),z:Number(g[2])};});
  await page.keyboard.press('Digit1');const busy=/攻擊中|移動中|尋路中|等待讓路/.test(await page.locator('#group-summary').innerText().catch(()=>''))||/攻擊中|移動中|尋路中/.test(await text('selection-list'));
  if(await text('selected')==='未選取'){note('軍隊覆沒',`tick ${await tick()}`);break;}
  if(busy&&rounds%6)continue;
  const target=known.sort((a,b)=>Math.hypot(a.x-12,a.z-4)-Math.hypot(b.x-12,b.z-4))[0];
  if(target){await lookAt(target.x,target.z);const q=await screenOf(target.x,.3,target.z);const n=await act(()=>page.mouse.click(q.x,q.y,{button:'right'}));if(n!==last){note('攻擊',`${target.label} → ${n}`);last=n;}}
  else{m=await minimapAt(10+(rounds%4),3+2*(rounds%3));const n=await act(()=>page.mouse.click(m.x,m.y,{button:'right'}));if(n!==last){note('搜索',n);last=n;}}
  if(rounds%15===0)await page.screenshot({path:out+'match-battle.png'});
 }
 await page.locator('#result').waitFor({state:'visible',timeout:5000});
 const result=await text('result-title');note('對局結果',`${result}｜${await text('result-detail')}`);assert.match(result,/勝利|戰敗/);
 await page.screenshot({path:out+'match-result.png'});
 note('再開一局',await act(()=>page.locator('#result-restart').click()));assert.equal(await page.locator('#result').isHidden(),true);
 await page.waitForFunction(()=>Number(document.querySelector('#tick').textContent)>2);assert.equal(await text('res-pop'),'3/5');assert.match(await text('sel-empty-title'),/對手：電腦/);
 note('自動暫停次數',String(pauses));assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 fs.writeFileSync(out+'first-use-match.json',JSON.stringify(log,null,1));console.log('PASS full match against the computer: opening, army, siege, result screen, new game');
}catch(e){if(page&&!page.isClosed())await page.screenshot({path:out+'match-failure.png'}).catch(()=>{});console.error(e);process.exitCode=1;}
finally{await browser.close();server.close();}
