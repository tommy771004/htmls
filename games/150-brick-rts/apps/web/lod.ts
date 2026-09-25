// Render-only levels. All dimensions, transforms and selection geometry stay stable.
export type DetailLevel='near'|'medium'|'far';
export function detailLevel(zoom:number):DetailLevel{return zoom>=1.8?'near':zoom>=.9?'medium':'far';}
export function createDetailController(T:any){
 const detailed=new Map<any,any>(),simple=new Map<any,any>();
 function register(geometry:any,w:number,h:number,d:number){
  const low=new T.BoxGeometry(w,h,d);low.translate(0,h/2,0);
  detailed.set(geometry,geometry);detailed.set(low,geometry);simple.set(geometry,low);simple.set(low,low);
 }
 function apply(root:any,zoom:number){const level=detailLevel(zoom);root.traverse((o:any)=>{if(o.isMesh&&detailed.has(o.geometry))o.geometry=(level==='near'?detailed:simple).get(o.geometry);if(o.userData.studs)o.visible=level!=='far';});}
 function withSelectionGeometry<R>(root:any,read:()=>R):R{
  const previous=new Map<any,any>();root.traverse((o:any)=>{if(o.isMesh&&detailed.has(o.geometry)){previous.set(o,o.geometry);o.geometry=detailed.get(o.geometry);}});
  try{return read();}finally{for(const [mesh,geometry] of previous)mesh.geometry=geometry;}
 }
 function dispose(){for(const geometry of new Set(simple.values()))geometry.dispose();simple.clear();detailed.clear();}
 return {register,apply,withSelectionGeometry,dispose};
}
