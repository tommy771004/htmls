// Combat numbers (design_default engineering values, not reference-game data). No imports: shared by
// movement (unit hp), buildings (structure hp) and combat. range/sight are in simulation units
// (Chebyshev distance to the target's centre, or to a building's footprint edge); cooldown in ticks.
export const combatRules={provenance:'design_default',
 units:{
  villager:{hp:25,damage:1,range:50,cooldown:30,sight:0},
  militia:{hp:45,damage:6,range:50,cooldown:20,sight:350},
  archer:{hp:30,damage:4,range:250,cooldown:30,sight:400},
  // Scout: the reference's standard start includes one (research doc); these numbers are design_default.
  // sight here is the automatic-engage radius (vision is visionRules): 0 means the unit only fights when ordered.
  // The scout scouts; it attacks only on an explicit order.
  scout:{hp:45,damage:3,range:50,cooldown:40,sight:0},
 },
 buildings:{'town-center':400,house:150,barracks:300,farm:100,'lumber-camp':200,'mining-camp':200,mill:200,stable:300},
 corpseTicks:40,hitFlashTicks:6,
 // Movement per tick; every value divides the 50-unit node spacing, so a unit always lands exactly on its node.
 speed:{villager:5,militia:5,archer:5,scout:10},
} as const;
export type CombatUnitKind=keyof typeof combatRules.units;
