/** 格子尺寸：邏輯像素 16×16，畫面依視窗大小以整數倍放大。 */
export const TILE = 16;

export interface TileDef {
  char: string;
  name: string;
  walkable: boolean;
  /** 走進這種格子時才進行野生遭遇判定。 */
  grass: boolean;
  /** 櫃台：可以隔著它和後方的人說話。 */
  counter?: boolean;
  sprite: string;
}

export const TILE_LIST: TileDef[] = [
  { char: '.', name: '草地', walkable: true, grass: false, sprite: 'tile.grass' },
  { char: ',', name: '高草叢', walkable: true, grass: true, sprite: 'tile.tallgrass' },
  { char: '=', name: '泥土路', walkable: true, grass: false, sprite: 'tile.path' },
  { char: 'f', name: '花叢', walkable: true, grass: false, sprite: 'tile.flowers' },
  { char: 'T', name: '樹', walkable: false, grass: false, sprite: 'tile.tree' },
  { char: '~', name: '水', walkable: false, grass: false, sprite: 'tile.water' },
  { char: 'F', name: '木柵欄', walkable: false, grass: false, sprite: 'tile.fence' },
  { char: 'r', name: '岩石', walkable: false, grass: false, sprite: 'tile.rock' },
  { char: '^', name: '屋頂', walkable: false, grass: false, sprite: 'tile.roof' },
  { char: '#', name: '牆', walkable: false, grass: false, sprite: 'tile.wall' },
  { char: 'w', name: '窗', walkable: false, grass: false, sprite: 'tile.window' },
  { char: 'd', name: '門', walkable: false, grass: false, sprite: 'tile.door' },
  { char: 'x', name: '攤位櫃台', walkable: false, grass: false, counter: true, sprite: 'tile.counter' },
  { char: ':', name: '林地', walkable: true, grass: false, sprite: 'tile.forestfloor' },
  { char: ';', name: '深草叢', walkable: true, grass: true, sprite: 'tile.deepgrass' },
  { char: 't', name: '杉樹', walkable: false, grass: false, sprite: 'tile.pine' },
  { char: 'o', name: '石板', walkable: true, grass: false, sprite: 'tile.flagstone' },
  { char: 'P', name: '石柱', walkable: false, grass: false, sprite: 'tile.pillar' },
  { char: 'R', name: '石牆', walkable: false, grass: false, sprite: 'tile.stonewall' },
  { char: 'b', name: '木橋', walkable: true, grass: false, sprite: 'tile.bridge' },
];

export const TILES: Record<string, TileDef> = Object.fromEntries(TILE_LIST.map((t) => [t.char, t]));
