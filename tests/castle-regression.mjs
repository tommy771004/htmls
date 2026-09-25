// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs BROWSER_EXECUTABLE=/path/to/chrome node tests/castle-regression.mjs
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || "playwright");
import http from "node:http";
import path from "node:path";
import os from "node:os";
const root=process.cwd(), output=fs.mkdtempSync(path.join(os.tmpdir(),"castle-qa-"));
const server=http.createServer((req,res)=>{const file=path.resolve(root,"."+new URL(req.url,"http://localhost").pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return}res.setHeader("Content-Type",file.endsWith(".html")?"text/html":file.endsWith(".js")?"text/javascript":"application/octet-stream");res.end(fs.readFileSync(file))});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const origin=`http://127.0.0.1:${server.address().port}`;
import fs from "node:fs";
import assert from "node:assert/strict";
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
try {
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],external=[];
page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});page.on("request",r=>{if(!r.url().startsWith(origin)&&!r.url().startsWith("blob:")&&!r.url().startsWith("data:"))external.push(r.url())});
await page.goto(origin+"/web/142-aurielle-castle.html");await page.waitForSelector("body[data-ready=true]");await page.waitForTimeout(1200);await page.screenshot({path:output+"/castle-desktop.png"});
for(const view of ["front","side","top","hero"]){await page.click(`[data-view=${view}]`);await page.waitForTimeout(350);assert.equal(await page.getAttribute(`[data-view=${view}]`,"aria-pressed"),"true");await page.screenshot({path:`${output}/castle-${view}.png`})}
await page.click("#light");assert(await page.locator("body.night").count());await page.screenshot({path:output+"/castle-night.png"});await page.click("#spin");assert.equal(await page.getAttribute("#spin","aria-pressed"),"true");await page.click("#reset");assert.equal(await page.getAttribute("#spin","aria-pressed"),"false");assert.equal(await page.locator("body.night").count(),0);
const downloadPromise=page.waitForEvent("download");await page.click("#download");const download=await downloadPromise;await download.saveAs(output+"/aurielle-castle.gltf");let data=JSON.parse(fs.readFileSync(output+"/aurielle-castle.gltf"));assert.equal(data.asset.version,"2.0");assert(data.materials.length>=8);assert(data.accessors.every(a=>a.count>0));
const loaded=await page.evaluate(async data=>{const {GLTFLoader}=await import("/vendor/three-0.186.0/addons/loaders/GLTFLoader.js");const result=await new GLTFLoader().parseAsync(JSON.stringify(data),"");let count=0;result.scene.traverse(o=>{if(o.isMesh)count++});return count},data);assert(loaded>=8);
await page.setViewportSize({width:390,height:844});await page.click("#reset");await page.waitForTimeout(400);await page.screenshot({path:output+"/castle-mobile.png"});assert(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));await page.click("[data-view=top]");await page.click("#light");
await page.setViewportSize({width:1440,height:900});await page.click("#reset");await page.waitForTimeout(300);await page.screenshot({path:output+"/castle-thumb.png"});
assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log(JSON.stringify({errors,external,materials:data.materials.length,loadedMeshes:loaded,vertices:data.accessors.filter((_,i)=>i%2===0).reduce((a,b)=>a+b.count,0),gltfBytes:fs.statSync(output+"/aurielle-castle.gltf").size}));} finally {await browser.close();server.close();}
