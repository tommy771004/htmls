import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url)),output=fileURLToPath(new URL('../test-results/',import.meta.url));fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'text/javascript');res.end(fs.readFileSync(file));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true});
let page;const diagnostics=[];
try{page=await browser.newPage({viewport:{width:1200,height:900}});const errors=[];page.on('console',m=>diagnostics.push({type:m.type(),text:m.text()}));await page.addInitScript(()=>{window.renderEvents=[];document.addEventListener('webglcontextlost',()=>window.renderEvents.push({event:'context-lost',time:performance.now()}),true);});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.error(m.text());});await page.goto(`http://127.0.0.1:${server.address().port}/web/150-brick-rts-models.html`);await page.waitForFunction(()=>document.querySelector('#stats').textContent.includes('Draw calls'));const overview=await page.locator('#scene').screenshot();await page.locator('#focus-unit').click();assert.notDeepEqual(await page.locator('#scene').screenshot(),overview);
for(const [pose,tool] of [['work','axe'],['work','pick'],['work','sickle'],['work','hammer'],['carry','basket'],['attack','sword'],['hit','none'],['death','none']]){await page.locator('#pose').selectOption(pose);await page.locator('#tool').selectOption(tool);await page.screenshot({path:output+`rig-focus-${pose}-${tool}.png`,fullPage:true});}
for(const role of ['swordsman','spearman','archer','cavalry']){await page.locator('#unit-role').selectOption(role);await page.locator('#pose').selectOption('idle');await page.screenshot({path:output+`role-${role}.png`,fullPage:true});await page.locator('#turn').click();await page.screenshot({path:output+`role-${role}-side.png`,fullPage:true});for(let i=0;i<3;i++)await page.locator('#turn').click();}assert.equal(await page.locator('#pose option[value="death"]').evaluate(option=>option.disabled),true);await page.locator('#pose').selectOption('walk');await page.locator('#animate').check();await page.waitForTimeout(160);await page.screenshot({path:output+'cavalry-walk.png',fullPage:true});await page.locator('#animate').uncheck();await page.locator('#unit-role').selectOption('villager');assert.equal(await page.locator('#pose option[value="death"]').evaluate(option=>option.disabled),false);
// Civilization unique units: each outfit arrives with its own weapon; mounted ones only offer idle, walk and attack.
{const unique={longbowman:'longbow','woad-raider':'sword','throwing-axeman':'throwing-axe',huskarl:'sword','teutonic-knight':'great-sword',berserk:'war-axe',samurai:'katana',janissary:'musket','chu-ko-nu':'repeater',cataphract:'spear',mameluke:'scimitar',mangudai:'bow','war-elephant':'spear'},mounted=['cataphract','mameluke','mangudai','war-elephant'],shots=new Set();
 for(const [role,weapon] of Object.entries(unique)){await page.locator('#unit-role').selectOption(role);assert.equal(await page.locator('#tool').inputValue(),weapon,role);assert.equal(await page.locator('#pose option[value="death"]').evaluate(option=>option.disabled),mounted.includes(role),role);
  await page.locator('#pose').selectOption('attack');await page.locator('#animate').check();await page.waitForTimeout(120);await page.locator('#animate').uncheck();await page.locator('#pose').selectOption('idle');
  const shot=await page.locator('#scene').screenshot();shots.add(shot.toString('base64'));await page.screenshot({path:output+`unique-${role}.png`,fullPage:true});}
 assert.equal(shots.size,Object.keys(unique).length,'every unique unit renders differently');await page.locator('#unit-role').selectOption('villager');await page.locator('#tool').selectOption('none');await page.locator('#pose').selectOption('idle');
 console.log('PASS thirteen unique unit outfits with their weapons and mounted pose limits');}
// The 單位 round: the cavalry archer and the camel rider ride (idle, walk, attack only), the petard carries a keg, the
// siege engines swap in their own rigs (no work or carry pose, no tool) and the trebuchet shows both states. Each model
// renders differently; every line-upgrade look changes the model and clearing it restores the base look exactly.
{const units={'cavalry-archer':'bow',camel:'scimitar',petard:'powder-keg',ram:'none',mangonel:'none',scorpion:'none','trebuchet-packed':'none','trebuchet-unpacked':'none'},mounted=['cavalry-archer','camel'],siege=['ram','mangonel','scorpion','trebuchet-packed','trebuchet-unpacked'],shots=new Set();let looks=0;
 const disabled=value=>page.locator(`#pose option[value="${value}"]`).evaluate(option=>option.disabled);
 const graded=async role=>{const base=await page.locator('#scene').screenshot();for(const look of await page.locator('#unit-grade option:not([disabled])').evaluateAll(o=>o.map(x=>x.value).filter(Boolean))){await page.locator('#unit-grade').selectOption(look);
  assert.notDeepEqual(await page.locator('#scene').screenshot(),base,role+' '+look);await page.screenshot({path:output+`grade-${look}.png`,fullPage:true});await page.locator('#unit-grade').selectOption('');assert.ok((await page.locator('#scene').screenshot()).equals(base),role+' '+look+' clears');looks++;}};
 for(const [role,weapon] of Object.entries(units)){await page.locator('#unit-role').selectOption(role);assert.equal(await page.locator('#tool').inputValue(),weapon,role);
  assert.equal(await disabled('death'),mounted.includes(role),role);assert.equal(await disabled('work'),mounted.includes(role)||siege.includes(role),role);assert.equal(await page.locator('#tool').isDisabled(),siege.includes(role),role);
  await page.locator('#pose').selectOption('attack');await page.locator('#animate').check();await page.waitForTimeout(120);await page.locator('#animate').uncheck();await page.locator('#pose').selectOption('idle');
  shots.add((await page.locator('#scene').screenshot()).toString('base64'));await page.screenshot({path:output+`unit-${role}.png`,fullPage:true});await graded(role);}
 assert.equal(shots.size,Object.keys(units).length,'every new unit renders differently');
 for(const role of ['swordsman','cavalry']){await page.locator('#unit-role').selectOption(role);await page.locator('#pose').selectOption('idle');await graded(role);}
 assert.equal(looks,12,'twelve line-upgrade looks');
 await page.locator('#unit-role').selectOption('villager');assert.equal(await page.locator('#unit-grade').isDisabled(),true);await page.locator('#tool').selectOption('none');await page.locator('#pose').selectOption('idle');
 console.log('PASS cavalry archer, camel rider, petard, four siege engines (trebuchet packed and unpacked) and twelve line-upgrade looks');}
// The 科技 round: the hand cannoneer (foot, hand cannon, aimed firing) and the bombard cannon (siege rig, no tool, no
// work or carry). Each renders differently from the other and from the janissary; firing changes the model.
{const units={'hand-cannoneer':'hand-cannon','bombard-cannon':'none',janissary:'musket'},shots=new Set();
 for(const [role,weapon] of Object.entries(units)){await page.locator('#unit-role').selectOption(role);assert.equal(await page.locator('#tool').inputValue(),weapon,role);
  const siege=role==='bombard-cannon';assert.equal(await page.locator('#pose option[value="work"]').evaluate(o=>o.disabled),siege,role);assert.equal(await page.locator('#tool').isDisabled(),siege,role);
  await page.locator('#pose').selectOption('idle');const idle=await page.locator('#scene').screenshot();shots.add(idle.toString('base64'));await page.screenshot({path:output+`tech-unit-${role}.png`,fullPage:true});
  await page.locator('#pose').selectOption('attack');assert.notDeepEqual(await page.locator('#scene').screenshot(),idle,role+' attack pose');await page.screenshot({path:output+`tech-unit-${role}-attack.png`,fullPage:true});
  await page.locator('#pose').selectOption('death');await page.screenshot({path:output+`tech-unit-${role}-death.png`,fullPage:true});await page.locator('#pose').selectOption('idle');}
 assert.equal(shots.size,3,'hand cannoneer, bombard cannon and janissary render differently');
 await page.locator('#unit-role').selectOption('villager');await page.locator('#tool').selectOption('none');await page.locator('#pose').selectOption('idle');
 console.log('PASS hand cannoneer and bombard cannon models with their firing and wreck poses');}
await page.locator('#pose').selectOption('walk');await page.locator('#animate').check();const a=await page.screenshot();await page.waitForTimeout(170);assert.notDeepEqual(await page.screenshot(),a);await page.locator('#animate').uncheck();await page.locator('#pose').selectOption('idle');await page.locator('#reset').click();assert.ok((await page.locator('#scene').screenshot()).equals(overview),'villager overview restoration mismatch: '+await page.locator('#error').textContent());await page.locator('#focus-house').click();const intact=await page.locator('#scene').screenshot();for(const age of ['1','2','3','4']){await page.locator('#building-age').selectOption(age);await page.screenshot({path:output+`house-age-${age}.png`,fullPage:true});}for(const progress of ['0','20','40','60','100']){await page.locator('#building-progress').selectOption(progress);await page.screenshot({path:output+`house-progress-${progress}.png`,fullPage:true});}for(const health of ['35','0']){await page.locator('#building-health').selectOption(health);assert.notDeepEqual(await page.locator('#scene').screenshot(),intact);await page.screenshot({path:output+`house-health-${health}.png`,fullPage:true});}await page.locator('#building-age').selectOption('2');await page.locator('#building-health').selectOption('100');assert.ok((await page.locator('#scene').screenshot()).equals(intact),'building restoration mismatch: '+await page.locator('#error').textContent());assert.deepEqual(errors,[]);for(const kind of ['lumber-camp','mining-camp','mill','farm','town-center','market','smithy','barracks','archery-range','stable']){await page.locator('#building-kind').selectOption(kind);await page.screenshot({path:output+`economic-${kind}.png`,fullPage:true});await page.locator('#turn').click();await page.screenshot({path:output+`economic-${kind}-side.png`,fullPage:true});for(let i=0;i<3;i++)await page.locator('#turn').click();await page.locator('#building-progress').selectOption('20');await page.locator('#building-progress').selectOption('100');await page.locator('#building-health').selectOption('0');await page.locator('#building-health').selectOption('100');}
for(const kind of ['barracks','archery-range','stable']){
 await page.locator('#building-kind').selectOption(kind);let previous;
 for(const age of ['1','2','3','4']){
  await page.locator('#building-age').selectOption(age);
  const intactAge=await page.locator('#scene').screenshot();if(previous)assert.notDeepEqual(intactAge,previous);previous=intactAge;
  await page.screenshot({path:output+`military-${kind}-age-${age}.png`,fullPage:true});
  await page.locator('#turn').click();await page.screenshot({path:output+`military-${kind}-age-${age}-side.png`,fullPage:true});for(let i=0;i<3;i++)await page.locator('#turn').click();
  for(const progress of ['0','20','40','60','100'])await page.locator('#building-progress').selectOption(progress);
  for(const health of ['35','0','100'])await page.locator('#building-health').selectOption(health);
  assert.ok((await page.locator('#scene').screenshot()).equals(intactAge),kind+' age '+age+' restores exactly');
 }
}
await page.locator('#building-age').selectOption('2');
console.log('PASS twelve military age models, opposite views, construction and damage restoration');
// Castle (4x4): four ages change the structure, construction and damage restore exactly; then the regional styles.
{await page.locator('#building-kind').selectOption('castle');let previous;
 for(const age of ['1','2','3','4']){await page.locator('#building-age').selectOption(age);const intactAge=await page.locator('#scene').screenshot();if(previous)assert.notDeepEqual(intactAge,previous,'castle age '+age);previous=intactAge;
  await page.screenshot({path:output+`castle-age-${age}.png`,fullPage:true});await page.locator('#turn').click();await page.screenshot({path:output+`castle-age-${age}-side.png`,fullPage:true});for(let i=0;i<3;i++)await page.locator('#turn').click();
  for(const progress of ['0','20','40','60','100'])await page.locator('#building-progress').selectOption(progress);for(const health of ['35','0','100'])await page.locator('#building-health').selectOption(health);
  assert.ok((await page.locator('#scene').screenshot()).equals(intactAge),'castle age '+age+' restores exactly');}
 await page.locator('#building-age').selectOption('2');
 for(const kind of ['castle','barracks','house']){await page.locator('#building-kind').selectOption(kind);const neutral=await page.locator('#scene').screenshot(),styled=new Set();
  for(const style of ['west','central','mideast','eastasia']){await page.locator('#building-style').selectOption(style);const shot=await page.locator('#scene').screenshot();assert.notDeepEqual(shot,neutral,kind+' '+style);styled.add(shot.toString('base64'));await page.screenshot({path:output+`style-${kind}-${style}.png`,fullPage:true});}
  assert.equal(styled.size,4,kind+' styles differ from each other');await page.locator('#building-style').selectOption('neutral');assert.ok((await page.locator('#scene').screenshot()).equals(neutral),kind+' neutral restores');}
 console.log('PASS castle ages and four regional building styles');}
// University (3x3): four ages change the structure, construction and damage restore exactly, and every regional style
// changes it; then back to the house.
{await page.locator('#building-kind').selectOption('university');let previous;
 for(const age of ['1','2','3','4']){await page.locator('#building-age').selectOption(age);const intactAge=await page.locator('#scene').screenshot();if(previous)assert.notDeepEqual(intactAge,previous,'university age '+age);previous=intactAge;
  await page.screenshot({path:output+`university-age-${age}.png`,fullPage:true});await page.locator('#turn').click();await page.screenshot({path:output+`university-age-${age}-side.png`,fullPage:true});for(let i=0;i<3;i++)await page.locator('#turn').click();
  for(const progress of ['0','20','40','60','100']){await page.locator('#building-progress').selectOption(progress);if(age==='4')await page.screenshot({path:output+`university-stage-${progress}.png`,fullPage:true});}
  for(const health of ['35','0','100']){await page.locator('#building-health').selectOption(health);if(age==='4'&&health!=='100')await page.screenshot({path:output+`university-health-${health}.png`,fullPage:true});}
  assert.ok((await page.locator('#scene').screenshot()).equals(intactAge),'university age '+age+' restores exactly');}
 const neutral=await page.locator('#scene').screenshot(),styled=new Set();
 for(const style of ['west','central','mideast','eastasia']){await page.locator('#building-style').selectOption(style);const shot=await page.locator('#scene').screenshot();assert.notDeepEqual(shot,neutral,'university '+style);styled.add(shot.toString('base64'));await page.screenshot({path:output+`style-university-${style}.png`,fullPage:true});}
 assert.equal(styled.size,4,'university styles differ');await page.locator('#building-style').selectOption('neutral');assert.ok((await page.locator('#scene').screenshot()).equals(neutral),'university neutral restores');
 await page.locator('#building-age').selectOption('2');
 console.log('PASS university ages, construction, damage restoration and four regional styles');}
for(const kind of ['lumber-camp','mining-camp','mill','farm','town-center','market','smithy']){
 await page.locator('#building-kind').selectOption(kind);let previous;
 for(const age of ['1','2','3','4']){
  await page.locator('#building-age').selectOption(age);
  const intactAge=await page.locator('#scene').screenshot();if(previous)assert.notDeepEqual(intactAge,previous,kind+' age '+age+' must change the rendered model');previous=intactAge;
  await page.screenshot({path:output+`economic-${kind}-age-${age}.png`,fullPage:true});
  await page.locator('#turn').click();await page.screenshot({path:output+`economic-${kind}-age-${age}-side.png`,fullPage:true});for(let i=0;i<3;i++)await page.locator('#turn').click();
  for(const progress of ['0','20','40','60','100'])await page.locator('#building-progress').selectOption(progress);
  for(const health of ['35','0','100'])await page.locator('#building-health').selectOption(health);
  assert.ok((await page.locator('#scene').screenshot()).equals(intactAge),kind+' age '+age+' restores exactly');
 }
}
await page.locator('#building-age').selectOption('2');
console.log('PASS twenty-eight economic age models, opposite views, construction and damage restoration');
await page.locator('#building-kind').selectOption('house');assert.ok((await page.locator('#scene').screenshot()).equals(intact),'house restored after economic assets');
const lodStats={};for(const [name,clicks] of [['near',0],['medium',3],['far',3]]){for(let i=0;i<clicks;i++)await page.locator('#far').click();await page.waitForFunction(level=>document.querySelector('#stats').textContent.includes('LOD '+level),name);const text=await page.locator('#stats').textContent();lodStats[name]=Number(text.match(/Triangles (\d+)/)[1]);await page.screenshot({path:output+`lod-${name}.png`,fullPage:true});}assert.ok(lodStats.near>lodStats.medium&&lodStats.medium>lodStats.far,JSON.stringify(lodStats));await page.locator('#focus-house').click();assert.ok((await page.locator('#scene').screenshot()).equals(intact),'near detail restores exactly');fs.writeFileSync(output+'lod-stats.json',JSON.stringify(lodStats,null,2));console.log('PASS detail triangle reduction and restoration '+JSON.stringify(lodStats));
assert.deepEqual(await page.evaluate(()=>window.renderEvents),[]);assert.equal(await page.locator('#error').isVisible(),false);
await page.locator('#scene').evaluate(canvas=>canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
await page.waitForFunction(()=>document.querySelector('#scene').dataset.renderState==='context-lost');
assert.equal(await page.locator('#error').isVisible(),true);assert.equal(await page.locator('#stats').textContent(),'繪圖已停止');
assert.equal(await page.locator('footer button:enabled,footer select:enabled,footer input:enabled').count(),0);
await page.screenshot({path:output+'model-context-lost.png',fullPage:true});await page.locator('#reload').click();
await page.waitForFunction(()=>document.querySelector('#stats').textContent.includes('Draw calls'));
assert.equal(await page.locator('#error').isVisible(),false);assert.equal(await page.locator('#focus-unit').isEnabled(),true);
await page.locator('#scene').evaluate(canvas=>{const gl=canvas.getContext('webgl2');for(const method of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced'])gl[method]=()=>{throw Error('injected render failure');};});
await page.waitForFunction(()=>document.querySelector('#error').textContent.includes('injected render failure'));
assert.equal(await page.locator('#stats').textContent(),'繪圖已停止');assert.equal(await page.locator('#pose').isEnabled(),false);assert.deepEqual(errors,[]);
await page.locator('#reload').click();await page.waitForFunction(()=>document.querySelector('#stats').textContent.includes('Draw calls'));assert.equal(await page.locator('#error').isVisible(),false);
console.log('PASS render exception is reported and reload restores controls');console.log('PASS model context loss stops controls and reload restores renderer');console.log('PASS building ages, construction stages, damage, bounded rubble and visual repair');console.log('PASS focus, six tools, work/carry/attack/hit/death previews, playback, reset; '+browser.version());
}catch(error){
 if(page){await page.screenshot({path:output+'model-failure.png',fullPage:true}).catch(()=>{});diagnostics.push(await page.evaluate(()=>({url:location.href,error:document.querySelector('#error')?.textContent,stats:document.querySelector('#stats')?.textContent,renderState:document.querySelector('#scene')?.dataset.renderState,events:window.renderEvents})).catch(()=>({pageUnavailable:true})));}
 fs.writeFileSync(output+'model-failure.json',JSON.stringify({failure:String(error),diagnostics},null,2));throw error;
}finally{await browser.close();server.close();}
