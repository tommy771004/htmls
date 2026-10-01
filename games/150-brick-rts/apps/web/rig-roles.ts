import type {UnitPose,UnitRole} from './unit-rig.ts';
import {isMounted,mounts} from './character-rig.ts';
import type {MountedRole} from './character-rig.ts';
// Unique foot units wear the dress of the same name (unit-rig outfits).
const footUniques=['longbowman','woad-raider','throwing-axeman','huskarl','teutonic-knight','berserk','samurai','janissary','chu-ko-nu','petard','hand-cannoneer'] as const;
// Siege engines have their own rigs (siege-rig.ts) and never wear a dress; roleOf leaves them 'villager'.
export const siegeKinds=['ram','mangonel','scorpion','trebuchet','bombard-cannon'] as const;
export type SiegeKind=typeof siegeKinds[number];
export const isSiege=(kind:string):kind is SiegeKind=>(siegeKinds as readonly string[]).includes(kind);
// Ships and the trade cart have their own rigs too (vessel-rig.ts): no dress, no tool; roleOf leaves them 'villager'.
export const shipKinds=['fishing-ship','transport-ship','trade-cog','galley','fire-galley','demolition-raft','cannon-galleon','longboat'] as const;
export const vesselKinds=[...shipKinds,'trade-cart'] as const;
export type VesselKind=typeof vesselKinds[number];
export const isVessel=(kind:string):kind is VesselKind=>(vesselKinds as readonly string[]).includes(kind);
// Line upgrades with a visible look, per unit kind, in research order (ids from packages/sim/stats.ts lineUpgrades).
// The scene shows the latest one researched, for its own units only (the enemy's research is not projected).
export const upgradeLooks:Record<string,readonly string[]>={militia:['two-handed-swordsman','champion'],scout:['hussar'],knight:['cavalier','paladin'],'cavalry-archer':['heavy-cavalry-archer'],camel:['heavy-camel'],ram:['capped-ram','siege-ram'],mangonel:['onager','siege-onager'],scorpion:['heavy-scorpion'],
 // The dock's lines (War Galley turns all three Feudal ships at once).
 galley:['war-galley','galleon'],'fire-galley':['war-galley','fast-fire-ship'],'demolition-raft':['war-galley','heavy-demolition-ship'],'cannon-galleon':['elite-cannon-galleon'],longboat:['elite-longboat']};
export function lookOf(kind:string,techs:readonly string[]):string|null{const line=upgradeLooks[kind]??[];for(let i=line.length-1;i>=0;i--)if(techs.includes(line[i]))return line[i];return null;}
// Which rig a simulated unit kind wears. The scout rides (the rig's mounted 'cavalry' dress).
// The spearman wears the spearman dress, the skirmisher the archer's (with javelins), the knight rides like the scout;
// the mounted unique units have their own mount dress (the war elephant rides an elephant).
export function roleOf(kind:string):UnitRole|MountedRole{return kind==='militia'?'swordsman':kind==='spearman'?'spearman':kind==='archer'||kind==='skirmisher'?'archer':kind==='scout'||kind==='knight'?'cavalry':kind==='monk'?'monk':(footUniques as readonly string[]).includes(kind)?kind as UnitRole:isMounted(kind)?kind:'villager';}
// A mounted rig only animates idle, walk and attack; any other requested pose is shown as idle.
export function poseFor(kind:string,pose:UnitPose):UnitPose{return isMounted(roleOf(kind))&&!['idle','walk','attack'].includes(pose)?'idle':pose;}
// Fallen units lie on foot: a fallen scout is drawn dismounted, in the swordsman dress; a unique rider in its own.
export function corpseRole(kind:string):UnitRole{const role=roleOf(kind);return isMounted(role)?mounts[role].rider:role;}
