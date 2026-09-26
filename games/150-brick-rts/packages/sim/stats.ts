// Combat numbers (design_default engineering values, not reference-game data). No imports: shared by
// movement (unit hp), buildings (structure hp) and combat. range/sight are in simulation units
// (Chebyshev distance to the target's centre, or to a building's footprint edge); cooldown in ticks.
export const combatRules={provenance:'design_default',
 units:{
  villager:{hp:25,damage:1,range:50,cooldown:30,sight:0},
  militia:{hp:45,damage:6,range:50,cooldown:20,sight:350},
  archer:{hp:30,damage:4,range:250,cooldown:30,sight:400},
 },
 buildings:{'town-center':400,house:150,barracks:300,farm:100},
 corpseTicks:40,hitFlashTicks:6,
} as const;
export type CombatUnitKind=keyof typeof combatRules.units;
