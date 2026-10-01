// Existing sandbox geometry, in integer simulation units (100 = 1 world unit).
// Engineering design defaults, not reference-game collision dimensions.
export const obstacleFootprints={
 house:{x:-15,y:-15,width:250,depth:230},
 // Barracks: solid 3x3 foundation for now; its open front is visual only (no walkable interior).
 barracks:{x:-15,y:-15,width:300,depth:300},
 'town-center':{x:-15,y:-15,width:300,depth:300},
 // Farm: a walkable 2x2 field (no blocking rectangle); its extent still stops other buildings.
 farm:{x:0,y:0,width:200,depth:200},
 // Drop-off camps use the 3x3 models (same footprint as the barracks).
 'lumber-camp':{x:-15,y:-15,width:300,depth:300},
 'mining-camp':{x:-15,y:-15,width:300,depth:300},
 mill:{x:-15,y:-15,width:300,depth:300},
 stable:{x:-15,y:-15,width:300,depth:300},
 'archery-range':{x:-15,y:-15,width:300,depth:300},
 monastery:{x:-15,y:-15,width:300,depth:300},
 blacksmith:{x:-15,y:-15,width:300,depth:300},
 'siege-workshop':{x:-15,y:-15,width:300,depth:300},
 university:{x:-15,y:-15,width:300,depth:300},
 // Castle: a solid 4x4 keep (the reference's castle is 4x4).
 castle:{x:-15,y:-15,width:400,depth:400},
 // Watch tower: one tile.
 'watch-tower':{x:0,y:0,width:100,depth:100},
 // The 建築 round. Market and dock: 3x3 like the other production buildings (the reference's market is 4x4, scaled like
 // the university). The dock stands on water next to the shore; ships leave it on the water side.
 market:{x:-15,y:-15,width:300,depth:300},
 dock:{x:0,y:0,width:300,depth:300},
 // Fish trap: a 2x2 net on the water; ships sail over it (no blocking rectangle, like the farm).
 'fish-trap':{x:0,y:0,width:200,depth:200},
 // One-tile structures: the outpost, the bombard tower, and every wall segment and gate (walls are dragged as a line
 // of one-tile segments; a gate takes one segment's place). Gates block only the enemy (movement.ts gate overlay).
 outpost:{x:0,y:0,width:100,depth:100},
 'bombard-tower':{x:0,y:0,width:100,depth:100},
 'palisade-wall':{x:0,y:0,width:100,depth:100},
 'stone-wall':{x:0,y:0,width:100,depth:100},
 'palisade-gate':{x:0,y:0,width:100,depth:100},
 gate:{x:0,y:0,width:100,depth:100},
 // The wonder: a solid 5x5 (the reference's size).
 wonder:{x:0,y:0,width:500,depth:500},
 tree:{x:-20,y:-20,width:100,depth:100},
 rock:{x:0,y:0,width:65,depth:70},
 gold:{x:0,y:0,width:65,depth:70},
 berries:{x:0,y:0,width:65,depth:70},
 hunt:{x:0,y:0,width:65,depth:70},
 livestock:{x:0,y:0,width:65,depth:70},
} as const;
export type ObstacleKind=keyof typeof obstacleFootprints;
export type Rect=[number,number,number,number];
// Town center: only piers, posts, arch flanks, notice board, crate and marker pole block.
// The plinth, hall floor, arch opening, paving and open rear stay walkable.
// Each rect is the ground projection of one model part (tests/footprints.test.ts).
const townCenterBlocking:Rect[]=[
 [15,15,65,165],[205,15,255,165],
 [10,10,26,26],[240,10,256,26],[10,180,26,196],[240,180,256,196],
 // Arch flanks reach past the visible opening: 3D clearance for a villager on the plinth.
 [65,150,97,175],[173,150,205,175],
 [14,190,62,198],[20,198,54,201],[210,210,252,252],[265,270,271,276],
];
export const walkablePlatforms:Partial<Record<ObstacleKind,{rect:Rect;height:number}>>={'town-center':{rect:[-15,-15,285,285],height:16},farm:{rect:[0,0,200,200],height:10}};
export const townCenterEntrance={x:135,y:215} as const;
// Everything that decides collision, for ruleset identity and the exported manifest.
export const footprintContract={provenance:'design_default',obstacleFootprints,townCenterBlocking,walkablePlatforms,townCenterEntrance};
function check(o:{kind:ObstacleKind;x:number;y:number},radius:number){
 if(!obstacleFootprints[o.kind]||!Number.isSafeInteger(radius)||radius<0)throw Error('無效占地或半徑');
}
// Overall extent: vision anchor, map placement and resource clean-up.
export function obstacleBounds(o:{kind:ObstacleKind;x:number;y:number},radius=0):Rect{
 check(o,radius);const f=obstacleFootprints[o.kind];
 return [o.x+f.x-radius,o.y+f.y-radius,o.x+f.x+f.width+radius,o.y+f.y+f.depth+radius];
}
// Blocking rectangles used by navigation; the only collision authority.
export function obstacleRects(o:{kind:ObstacleKind;x:number;y:number},radius=0):Rect[]{
 check(o,radius);
 // Walkable extents: the farm (land units), the fish trap (ships) and gates (their owner; the enemy is held by the
 // per-player gate overlay in movement.ts).
 if(o.kind==='farm'||o.kind==='fish-trap'||o.kind==='gate'||o.kind==='palisade-gate')return [];
 if(o.kind!=='town-center')return [obstacleBounds(o,radius)];
 return townCenterBlocking.map(([x0,y0,x1,y1])=>[o.x+x0-radius,o.y+y0-radius,o.x+x1+radius,o.y+y1+radius]);
}
