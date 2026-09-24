import fs from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto(process.env.ZORK_URL||'http://127.0.0.1:8135/web/136-zork.html?test=1');
await page.evaluate(()=>localStorage.removeItem('zork-1977-136-v1'));
await page.reload();await page.locator('#begin:enabled').waitFor();await page.screenshot({path:'/tmp/zork-title-final.png'});await page.locator('#begin').click();
const snap=()=>page.evaluate(()=>window.zorkTest());
const pause=ms=>page.waitForTimeout(ms);
let mx=720,my=450;
function angle(v){return Math.atan2(Math.sin(v),Math.cos(v))}
async function aim(x,z,y=1.5){
 for(let i=0;i<8;i++){const q=await snap(),dx=x-q.state.pos[0],dz=z-q.state.pos[1],yaw=Math.atan2(-dx,-dz),pitch=Math.atan2(y-1.7,Math.hypot(dx,dz)),dyaw=angle(yaw-q.state.yaw),dp=pitch-q.state.pitch;if(Math.abs(dyaw)<.025&&Math.abs(dp)<.025)return;
  mx-=dyaw/.0023;my-=dp/.0023;await page.mouse.move(mx,my);await pause(35);
 }
}
function blocked(x,z,cs,pad=.5){return Math.hypot(x,z)>19.5||cs.some(c=>c.box?Math.abs(x-c.x)<c.sx/2+pad&&Math.abs(z-c.z)<c.sz/2+pad:Math.hypot(x-c.x,z-c.z)<c.r+pad)}
function line(a,b,cs){const d=Math.hypot(a[0]-b[0],a[1]-b[1]);for(let i=0;i<=Math.ceil(d/.25);i++){const t=i/Math.max(1,Math.ceil(d/.25));if(blocked(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,cs))return false}return true}
function route(start,goal,cs){
 const end=[goal.x,goal.z];if(line(start,end,cs))return end;
 const step=.7,key=(x,z)=>x+','+z,begin=start.map(v=>Math.round(v/step));const queue=[begin],prev=new Map([[key(...begin),null]]);let found=null;
 for(let i=0;i<queue.length&&i<10000;i++){const [x,z]=queue[i];if(Math.hypot(x*step-end[0],z*step-end[1])<1.2){found=[x,z];break}for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const xx=x+dx,zz=z+dz,k=key(xx,zz);if(prev.has(k)||blocked(xx*step,zz*step,cs)||!line([x*step,z*step],[xx*step,zz*step],cs))continue;prev.set(k,[x,z]);queue.push([xx,zz]);}}
 if(!found)throw Error('No physical route to '+goal.id);
 const path=[];while(found){path.unshift(found.map(v=>v*step));found=prev.get(key(...found))}
 for(let i=path.length-1;i>=0;i--)if(line(start,path[i],cs))return path[i];return path[1];
}
async function approach(id,reach=1.85){
 for(let i=0;i<100;i++){
  const q=await snap();if(q.paused)throw Error('Unexpected pause '+id);
  const t=q.targets.find(v=>v.id===id);if(!t)throw Error('Missing target '+id+' in '+q.state.room);
  const d=Math.hypot(t.x-q.state.pos[0],t.z-q.state.pos[1]);
  if(d<reach){await aim(t.x,t.z,t.y);await pause(50);return t}
  const goal=route(q.state.pos,t,q.colliders);await aim(goal[0],goal[1],1.7);
  const length=Math.hypot(goal[0]-q.state.pos[0],goal[1]-q.state.pos[1]);await page.keyboard.down('KeyW');await pause(Math.min(700,Math.max(50,(Math.min(length,d-reach+.15))/3.6*1000)));await page.keyboard.up('KeyW');await pause(25);
 }
 throw Error('Approach stalled '+id);
}
async function openTarget(id){
 await approach(id);for(let i=0;i<6;i++){const q=await snap();if(q.target===id){await page.keyboard.press('KeyE');await page.locator('#modal[open]').waitFor({timeout:2500});return;}
 const t=q.targets.find(t=>t.id===id);await aim(t.x,t.z,t.y);await page.keyboard.down('KeyW');await pause(120);await page.keyboard.up('KeyW');await pause(80);}
 throw Error('Could not focus '+id);
}
const steps=JSON.parse(fs.readFileSync(new URL('./walkthrough.json',import.meta.url)));
let index=0;
try{
 for(const step of steps){
  await page.waitForFunction(()=>!zorkTest().transitioning,{timeout:4000});let q=await snap();assert.equal(q.state.room,step.room,'step '+index);
  if(step.kind==='move'){
   let id='exit:'+step.dir;if(!q.targets.some(t=>t.id===id)){const room=JSON.parse(fs.readFileSync(new URL('./world.json',import.meta.url))).rooms[step.room];id=q.targets.find(t=>t.exit&&room.exits[t.exit].to===room.exits[step.dir].to)?.id;}
   await approach(id,2.1);q=await snap();if(q.target!==id){const t=q.targets.find(t=>t.id===id);await aim(t.x,t.z,t.y);await pause(80)}
   await page.keyboard.press('KeyE');await pause(200);await page.waitForFunction(()=>!zorkTest().transitioning);
   q=await snap();assert.equal(q.state.room,step.to,'exit '+step.dir+' step '+index);
  }else if(step.kind==='throw'){
   const a=q.actors.find(a=>a.id===step.id);await aim(a.x,a.z,1.45);await page.keyboard.press('KeyQ');await pause(220);
  }else if(step.verb==='light'&&step.id==='LAMP'){await page.keyboard.press('KeyL');await pause(80);
  }else if(['drop','light'].includes(step.verb)){
   await page.keyboard.press('KeyI');await page.locator('#modal[open]').waitFor();await page.locator('[data-inv="'+step.verb+'"][data-id="'+step.id+'"]').click();await page.locator('#closeModal').click();await pause(80);
  }else{
   await openTarget(step.id);
   if(step.verb==='say'){await page.locator('#word').fill(step.arg);await page.locator('#wordForm button').click()}
   else await page.locator('[data-act="'+step.verb+'"][data-id="'+step.id+'"][data-arg="'+step.arg+'"]').click();
   await pause(200);
   if(step.verb==='take')assert((await snap()).state.inventory.includes(step.id),'pickup '+step.id);
  }
  if(index%10===0){q=await snap();console.log(JSON.stringify({step:index,total:steps.length,room:q.state.room,score:q.score,hp:q.state.hp,resources:q.resources}));}
  if(index===15||index===50)await page.screenshot({path:'/tmp/zork-play-'+index+'.png'});
  index++;
 }
 const q=await snap();assert.equal(q.score,285);assert(q.state.won);assert.equal(q.state.deposited.length,11);assert.deepEqual(errors,[]);
 await page.screenshot({path:'/tmp/zork-complete.png'});
 await page.reload();await page.locator('#begin:enabled').waitFor();const loaded=await snap();assert.equal(loaded.score,285);assert(loaded.state.won);
 fs.writeFileSync(new URL('./browser-verification.json',import.meta.url),JSON.stringify({completed:new Date().toISOString(),actions:index,score:q.score,treasures:q.state.deposited,visited:q.state.visited.length,reloadPreserved:true,errors,finalResources:q.resources},null,2));console.log('PASS BROWSER MAINLINE',index,'actions, 285 points, save/reload.');
}catch(e){await page.screenshot({path:'/tmp/zork-failure.png'});fs.writeFileSync('/tmp/zork-failure.json',JSON.stringify({index,step:steps[index],state:await snap(),errors},null,2));console.error('FAIL AT',index,steps[index],e);process.exitCode=1}
finally{await browser.close()}

