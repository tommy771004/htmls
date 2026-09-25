import test from 'node:test';
import assert from 'node:assert/strict';
import {makeMap,clearSegment,createPathJob,advancePathJob,position} from '../packages/sim/navigation.ts';
import {groundHeight,terrainRules} from '../packages/sim/terrain.ts';
test('height discontinuities block long segments, cliff contacts and diagonal corner cuts',()=>{
 const map=makeMap(0,'acceptance');
 assert.equal(clearSegment(map,{x:350,y:1050},{x:350,y:1250}),false);
 assert.equal(clearSegment(map,{x:150,y:1250},{x:350,y:1250}),false);
 assert.equal(clearSegment(map,{x:190,y:1090},{x:250,y:1150}),false);
 assert.equal(clearSegment(map,{x:190,y:1250},{x:190,y:1250}),false);
 assert.equal(clearSegment(map,{x:350,y:1250},{x:550,y:1250}),true);
});
test('land routes climb and descend explicit steps without exceeding the allowed height delta',()=>{
 const map=makeMap(0,'acceptance');
 for(const [from,to] of [[{x:350,y:700},{x:450,y:1350}],[{x:450,y:1350},{x:350,y:700}]]){
 const job=createPathJob(map,1,from,to);advancePathJob(map,job,961);assert.equal(job.status,'found');assert.ok(job.path.some(p=>p.x===450&&p.y===950));
 let current={...from},seenHeight=groundHeight(map.tiles,current.x,current.y);
 for(const target of job.path)while(current.x!==target.x||current.y!==target.y){const next={x:current.x+Math.sign(target.x-current.x)*Math.min(5,Math.abs(target.x-current.x)),y:current.x===target.x?current.y+Math.sign(target.y-current.y)*Math.min(5,Math.abs(target.y-current.y)):current.y};assert.ok(clearSegment(map,current,next));const height=groundHeight(map.tiles,next.x,next.y);assert.ok(Math.abs(height-seenHeight)<=terrainRules.maxLandStep);seenHeight=height;current=next;}
 assert.deepEqual(current,to);
 }
});
test('removing a staircase creates an unreachable plateau with bounded work',()=>{
 const map=makeMap(0,'acceptance');map.tiles[9*16+4].height=0;map.blocked=Array.from({length:961},(_,i)=>i).filter(i=>!clearSegment(map,position(i),position(i)));
 const job=createPathJob(map,1,{x:350,y:700},{x:450,y:1350});advancePathJob(map,job,961);assert.equal(job.status,'unreachable');
});
test('water traversal cannot jump even a land-legal step',()=>{
 const map=makeMap(0,'acceptance');map.tiles[8*16+7].height=25;
 assert.equal(clearSegment(map,{x:750,y:750},{x:750,y:850},'water'),false);
 assert.equal(clearSegment(map,{x:750,y:750},{x:750,y:850},'land'),true);
});
