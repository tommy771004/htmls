// Three.js raycasting does not use Object3D.visible as an intersection filter.
// Respect visibility throughout the hierarchy, including hidden equipment groups.
export function visibleMeshHits(raycaster:any,roots:any[]):any[]{
 const meshes:any[]=[];
 for(const root of roots)root.traverseVisible((object:any)=>{if(object.isMesh)meshes.push(object);});
 return raycaster.intersectObjects(meshes,false);
}
