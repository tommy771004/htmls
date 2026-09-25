// Original render geometry. Local origin: center in X/Z, bottom in Y.
// Opening half-width and arc spring height, shared by rendering and footprint tests.
export function archOpening(width:number,height:number){return {radius:Math.min(width*.32,height*.35),spring:height*.55};}
export function createArchGeometry(T:any,width:number,height:number,depth:number){
 if(![width,height,depth].every(n=>Number.isFinite(n)&&n>0))throw Error('拱件尺寸必須為有限正數');
 const half=width/2,{radius,spring}=archOpening(width,height);
 const shape=new T.Shape();shape.moveTo(-half,0);shape.lineTo(-half,height);shape.lineTo(half,height);shape.lineTo(half,0);
 shape.lineTo(radius,0);shape.lineTo(radius,spring);shape.absarc(0,spring,radius,0,Math.PI,false);shape.lineTo(-radius,0);shape.closePath();
 const geometry=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1,curveSegments:8});geometry.translate(0,0,-depth/2);return geometry;
}
