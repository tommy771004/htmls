import type {UnitPose,UnitRole} from './unit-rig.ts';
import {isMounted,mounts} from './character-rig.ts';
import type {MountedRole} from './character-rig.ts';
// Unique foot units wear the dress of the same name (unit-rig outfits).
const footUniques=['longbowman','woad-raider','throwing-axeman','huskarl','teutonic-knight','berserk','samurai','janissary','chu-ko-nu'] as const;
// Which rig a simulated unit kind wears. The scout rides (the rig's mounted 'cavalry' dress).
// The spearman wears the spearman dress, the skirmisher the archer's (with javelins), the knight rides like the scout;
// the mounted unique units have their own mount dress (the war elephant rides an elephant).
export function roleOf(kind:string):UnitRole|MountedRole{return kind==='militia'?'swordsman':kind==='spearman'?'spearman':kind==='archer'||kind==='skirmisher'?'archer':kind==='scout'||kind==='knight'?'cavalry':kind==='monk'?'monk':(footUniques as readonly string[]).includes(kind)?kind as UnitRole:isMounted(kind)?kind:'villager';}
// A mounted rig only animates idle, walk and attack; any other requested pose is shown as idle.
export function poseFor(kind:string,pose:UnitPose):UnitPose{return isMounted(roleOf(kind))&&!['idle','walk','attack'].includes(pose)?'idle':pose;}
// Fallen units lie on foot: a fallen scout is drawn dismounted, in the swordsman dress; a unique rider in its own.
export function corpseRole(kind:string):UnitRole{const role=roleOf(kind);return isMounted(role)?mounts[role].rider:role;}
