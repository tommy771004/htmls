import type {ResourceNode,Tile} from './terrain.ts';
// Animals (no imports beyond types: shared by combat, work, vision and the map generator).
// Sheep, deer and boar are units that walk on the node grid; their food becomes a carcass resource when they die.
// Values: design_default. The reference's food amounts, hit points and speeds were recalled, not checked against a
// named build, so they are recorded in docs/aoe2-rules-research.md as unverified.
export type AnimalKind='sheep'|'deer'|'boar'|'wolf'|'jaguar';
export const animalKinds:readonly AnimalKind[]=['sheep','deer','boar','wolf','jaguar'];
// Hostile animals (the 地圖 round): they hunt units by themselves and leave no food. The jaguar (猶加敦) is the wolf's
// American counterpart with the same numbers (aoetw.com units/Wolf: the jaguar shares the wolf's stats).
export const hostileKinds:readonly AnimalKind[]=['wolf','jaguar'];
export const isHostile=(kind:string)=>(hostileKinds as readonly string[]).includes(kind);
// Owner index of wild animals and of sheep nobody has found yet (players are 0 and 1).
export const GAIA=2;
export const isAnimal=(kind:string):kind is AnimalKind=>(animalKinds as readonly string[]).includes(kind);
export const animalRules={provenance:'design_default',
 // Food in the carcass; which resource kind the carcass is (sheep herd, the others hunt).
 food:{sheep:100,deer:140,boar:340,wolf:0,jaguar:0},carcass:{sheep:'livestock',deer:'hunt',boar:'hunt',wolf:'hunt',jaguar:'hunt'},
 // A sheep belongs to the only player with a unit (other than an animal) within captureRange; with both sides near it
 // keeps its owner. An owned sheep lets its owner see a little ground round it (visionRules.sheepRadius).
 // A sheep within holdRange of one of its owner's buildings cannot be taken.
 captureRange:200,holdRange:400,
 // A struck deer runs fleeDistance away from the hunter; a struck boar charges its attacker (combatRules.units.boar).
 fleeDistance:350,boarLeash:700,
 // Villager hunting: damage per strike, ticks between strikes, reach (Chebyshev, to the animal's centre).
 hunt:{damage:3,cooldown:30,range:{sheep:50,deer:150,boar:150,wolf:50,jaguar:50}},
 // Hostile animals (aoetw.com units/Wolf): sight 4 / 6 / 12 tiles by difficulty (簡單 / 標準 / 困難 and 最難), a tile of
 // sight being 100 here; they never go for monks, the scout line or siege, and never for buildings; they chase up to
 // hostileLeash from where they started the chase, then give up.
 hostileSight:{easy:400,standard:600,hard:1200,hardest:1200},hostileIgnore:['monk','scout'],hostileLeash:900,
 // A carcass loses one food every decayTicks, whether or not anyone is working it.
 decayTicks:100,
 // Villagers stand this close (Chebyshev) to a carcass or a shore fish to work it.
 pointReach:100,fishReach:150,
 // Ids of animals start here, apart from player units, so trained units keep the ids they always had.
 firstId:900001} as const;
// owner: set for a player's starting sheep; absent for wild animals (GAIA).
export type AnimalSpawn={kind:AnimalKind;x:number;y:number;owner?:number};
export const carcassId=(animalId:number)=>`resource-carcass-${animalId}`;
// The dead animal's food, lying where it fell (no obstacle: villagers stand round it).
export function makeCarcass(map:{size:number;tiles:Tile[];resources:ResourceNode[]},animal:{id:number;kind:AnimalKind;x:number;y:number}){
 const id=carcassId(animal.id),capacity=animalRules.food[animal.kind];if(!capacity||map.resources.some(r=>r.id===id))return;
 map.resources.push({id,kind:animalRules.carcass[animal.kind],x:animal.x,y:animal.y,capacity,remaining:capacity,collectible:true,status:'available',obstacleId:null,depletedAt:null});
 map.tiles[Math.floor(animal.y/100)*map.size+Math.floor(animal.x/100)].resourceRefs.push(id);
}
