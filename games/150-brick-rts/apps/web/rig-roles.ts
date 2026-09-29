import type {UnitPose,UnitRole} from './unit-rig.ts';
// Which rig a simulated unit kind wears. The scout rides (the rig's mounted 'cavalry' dress).
// The spearman wears the spearman dress, the skirmisher the archer's (with javelins), the knight rides like the scout.
export function roleOf(kind:string):UnitRole|'cavalry'{return kind==='militia'?'swordsman':kind==='spearman'?'spearman':kind==='archer'||kind==='skirmisher'?'archer':kind==='scout'||kind==='knight'?'cavalry':kind==='monk'?'monk':'villager';}
// A mounted rig only animates idle, walk and attack; any other requested pose is shown as idle.
export function poseFor(kind:string,pose:UnitPose):UnitPose{return roleOf(kind)==='cavalry'&&!['idle','walk','attack'].includes(pose)?'idle':pose;}
// Fallen units lie on foot: a fallen scout is drawn dismounted, in the swordsman dress.
export function corpseRole(kind:string):UnitRole{const role=roleOf(kind);return role==='cavalry'?'swordsman':role;}
