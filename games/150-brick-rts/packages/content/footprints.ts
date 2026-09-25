// Existing sandbox geometry, in integer simulation units (100 = 1 world unit).
// Engineering design defaults, not reference-game collision dimensions.
export const obstacleFootprints={
 house:{x:-15,y:-15,width:250,depth:230},
 tree:{x:-20,y:-20,width:100,depth:100},
 rock:{x:0,y:0,width:65,depth:70},
 gold:{x:0,y:0,width:65,depth:70},
 berries:{x:0,y:0,width:65,depth:70},
 hunt:{x:0,y:0,width:65,depth:70},
 livestock:{x:0,y:0,width:65,depth:70},
} as const;
export type ObstacleKind=keyof typeof obstacleFootprints;
export function obstacleBounds(o:{kind:ObstacleKind;x:number;y:number},radius=0):[number,number,number,number]{
 const f=obstacleFootprints[o.kind];
 if(!f||!Number.isSafeInteger(radius)||radius<0)throw Error('無效占地或半徑');
 return [o.x+f.x-radius,o.y+f.y-radius,o.x+f.x+f.width+radius,o.y+f.y+f.depth+radius];
}
