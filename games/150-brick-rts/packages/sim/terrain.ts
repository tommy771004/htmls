// Explicit engineering rules. No reference-game values are asserted here.
export const terrainRules={provenance:'design_default',size:16,tileSize:100,maxLandStep:25,resourceCapacity:{tree:300,stone:250,gold:250,berries:150,hunt:120,livestock:100,fish:200,farm:250},generationAttempts:8} as const;
export type ResourceKind=keyof typeof terrainRules.resourceCapacity;
export const resourceDefinitions:Record<ResourceKind,{yield:'wood'|'stone'|'gold'|'food';method:'gather'|'hunt'|'herd'|'fish';movement:'land'|'water'}>={tree:{yield:'wood',method:'gather',movement:'land'},stone:{yield:'stone',method:'gather',movement:'land'},gold:{yield:'gold',method:'gather',movement:'land'},berries:{yield:'food',method:'gather',movement:'land'},hunt:{yield:'food',method:'hunt',movement:'land'},livestock:{yield:'food',method:'herd',movement:'land'},fish:{yield:'food',method:'fish',movement:'water'},farm:{yield:'food',method:'gather',movement:'land'}};
export type TerrainType='grass'|'road'|'stone'|'sand'|'highland'|'cliff'|'water'|'shallow';
export type WalkClass='land'|'water'|'both'|'blocked';
export type MapLayout='meadow'|'coast'|'acceptance';
export type Tile={id:number;terrainType:TerrainType;height:number;walkClass:WalkClass;buildability:boolean;resourceRefs:string[];obstacleRefs:string[]};
export type ResourceNode={id:string;kind:ResourceKind;x:number;y:number;capacity:number;remaining:number;collectible:boolean;status:'available'|'depleted';obstacleId:string|null;depletedAt:number|null};
export const terrainDefinitions:Record<TerrainType,{walkClass:WalkClass;buildability:boolean;height:number}>={
 grass:{walkClass:'land',buildability:true,height:0},road:{walkClass:'land',buildability:true,height:0},stone:{walkClass:'land',buildability:true,height:0},sand:{walkClass:'land',buildability:true,height:0},highland:{walkClass:'land',buildability:true,height:100},cliff:{walkClass:'blocked',buildability:false,height:100},water:{walkClass:'water',buildability:false,height:0},shallow:{walkClass:'both',buildability:false,height:0}
};
export function createTiles(layout:MapLayout='meadow',seed=0):Tile[]{
 if(!['meadow','coast','acceptance'].includes(layout))throw Error('未知地圖模式');
 return Array.from({length:256},(_,id)=>{const x=id%16,y=Math.floor(id/16);let terrainType:TerrainType=y===8?'road':'grass';
 if(layout==='coast'){const edge=12+(((seed>>>0)>>>Math.floor(x/4))&1);if(y>=edge)terrainType='water';else if(y===edge-1)terrainType='sand';}
 if(layout==='acceptance'){if(x===7||x===8)terrainType=y>=7&&y<=9?'shallow':'water';else if(x===6||x===9)terrainType='sand';}
 const tile:Tile={id,terrainType,...terrainDefinitions[terrainType],resourceRefs:[],obstacleRefs:[]};
 if(layout==='acceptance'){
 if(x>=2&&x<=5&&y>=11&&y<=14){tile.terrainType=x===2&&y===11?'cliff':x===3&&y===13?'stone':'highland';Object.assign(tile,terrainDefinitions[tile.terrainType]);tile.height=100;}
 if(x===4&&y>=8&&y<=10){tile.terrainType='road';tile.height=(y-7)*25;tile.buildability=false;}
 }
 return tile;});
}
export function groundHeight(tiles:Tile[],x:number,y:number):number{return tiles[tileAt(x,y)]?.height??0;}
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
