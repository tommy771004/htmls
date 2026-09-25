import type {BuildingPart} from './building-parts.ts';
// Original design_default geometry dimensions, shared with the renderer.
export const studStyle={pitch:.5,radius:.13,height:.08,seam:.018} as const;
export type BuildingStud={partId:string;x:number;y:number;z:number;color:string};
export function buildingStuds(parts:readonly BuildingPart[]):BuildingStud[]{
 const result:BuildingStud[]=[];
 for(const part of parts){
  if(!part.studs)continue;
  for(let dx=studStyle.pitch/2;dx<part.w;dx+=studStyle.pitch)for(let dz=studStyle.pitch/2;dz<part.d;dz+=studStyle.pitch){
   const x=part.x+dx,z=part.z+dz,bottom=part.y+part.h;
   // Avoid cropped studs at a brick edge as well as studs clipping adjacent parts.
   if(dx-studStyle.radius<studStyle.seam/2||dx+studStyle.radius>part.w-studStyle.seam/2||dz-studStyle.radius<studStyle.seam/2||dz+studStyle.radius>part.d-studStyle.seam/2)continue;
   const covered=parts.some(other=>{
    if(other===part||other.y>=bottom+studStyle.height-1e-8||other.y+other.h<=bottom+1e-8)return false;
    // Conservative outer bounds for arches and bevels: decorative studs may be
    // omitted near those surfaces, but cannot protrude through them.
    const nearestX=Math.max(other.x+studStyle.seam/2,Math.min(x,other.x+other.w-studStyle.seam/2));
    const nearestZ=Math.max(other.z+studStyle.seam/2,Math.min(z,other.z+other.d-studStyle.seam/2));
    return (x-nearestX)**2+(z-nearestZ)**2<studStyle.radius**2-1e-10;
   });
   if(!covered)result.push({partId:part.id,x,y:bottom+studStyle.height/2,z,color:part.color});
  }
 }
 return result;
}
