import test from 'node:test';
import assert from 'node:assert/strict';
import {createArchGeometry} from '../apps/web/brick-geometries.ts';
import {createDetailController} from '../apps/web/lod.ts';
const T=await import(new URL('../../../vendor/three-0.186.0/three.module.js',import.meta.url).href);
test('arch has an open passage with solid piers and crown at every render level',()=>{
 for(const [w,h,d,clearance] of [[.8,1.28,.15,.85],[1.4,1.28,.25,1.1],[1.4,1.6,.25,1.25]]){const geo=createArchGeometry(T,w,h,d),mesh=new T.Mesh(geo,new T.MeshBasicMaterial({side:T.DoubleSide})),lod=createDetailController(T);mesh.updateMatrixWorld(true);
 const hit=(x:number,y:number)=>new T.Raycaster(new T.Vector3(x,y,1),new T.Vector3(0,0,-1)).intersectObject(mesh).length>0;
 for(const zoom of [2.5,1,.7]){lod.apply(mesh,zoom);assert.equal(hit(0,h*.2),false);assert.equal(hit(0,clearance),false);assert.equal(hit(-w*.45,h*.2),true);assert.equal(hit(w*.45,h*.2),true);assert.equal(hit(0,h*.95),true);assert.equal(mesh.geometry,geo);}
 geo.computeBoundingBox();assert.ok(Math.abs(geo.boundingBox.min.y)<1e-6);assert.ok(Math.abs(geo.boundingBox.max.x-w/2)<1e-6);assert.ok(Array.from(geo.attributes.position.array).every(Number.isFinite));geo.dispose();lod.dispose();}
 for(const value of [0,-1,NaN,Infinity])assert.throws(()=>createArchGeometry(T,value,1,.2));
});
