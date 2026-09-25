// Explicit engineering rules. No reference-game values are asserted here.
export const terrainRules={provenance:'design_default',size:16,tileSize:100,resourceCapacity:{tree:300,stone:250},generationAttempts:8} as const;
export type TerrainType='grass'|'road'|'stone'|'sand'|'highland'|'cliff'|'water'|'shallow';
export type WalkClass='land'|'water'|'both'|'blocked';
export type Tile={id:number;terrainType:TerrainType;height:number;walkClass:WalkClass;buildability:boolean;resourceRefs:string[];obstacleRefs:string[]};
export type ResourceNode={id:string;kind:'tree'|'stone';x:number;y:number;capacity:number;remaining:number;collectible:boolean;status:'available'|'depleted';obstacleId:string|null;depletedAt:number|null};
export const terrainDefinitions:Record<TerrainType,{walkClass:WalkClass;buildability:boolean;height:number}>={
 grass:{walkClass:'land',buildability:true,height:0},road:{walkClass:'land',buildability:true,height:0},stone:{walkClass:'land',buildability:true,height:0},sand:{walkClass:'land',buildability:true,height:0},highland:{walkClass:'land',buildability:true,height:100},cliff:{walkClass:'blocked',buildability:false,height:100},water:{walkClass:'water',buildability:false,height:0},shallow:{walkClass:'both',buildability:false,height:0}
};
export function createTiles():Tile[]{return Array.from({length:256},(_,id)=>{const terrainType:TerrainType=Math.floor(id/16)===8?'road':'grass';return {id,terrainType,...terrainDefinitions[terrainType],resourceRefs:[],obstacleRefs:[]};});}
export function tileAt(x:number,y:number):number{return Math.floor(y/100)*16+Math.floor(x/100);}
export function canTraverse(tile:Tile,movement:'land'|'water'):boolean{return tile.walkClass===movement||tile.walkClass==='both';}
// Internal simulation primitive; a future work system must pair returned yield with cargo.
// Reject before mutation, clamp final harvest, and never yield twice after depletion.
export function extractResource(node:ResourceNode,amount:number,tick:number):number{
 if(!Number.isSafeInteger(amount)||amount<=0||!Number.isSafeInteger(tick)||tick<0)throw Error('無效採集量或 tick');
 if(!node.collectible||node.status==='depleted')return 0;
 const yieldAmount=Math.min(amount,node.remaining);node.remaining-=yieldAmount;
 if(node.remaining===0){node.status='depleted';node.collectible=false;node.depletedAt=tick;}
 return yieldAmount;
}
