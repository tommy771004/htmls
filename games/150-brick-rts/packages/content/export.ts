import {visionRules} from '../sim/vision.ts';
import {writeFileSync} from 'node:fs';
import {rules,validateRules} from './rules.ts';
const errors=validateRules(rules);if(errors.length)throw Error(errors.join('\n'));
writeFileSync(new URL('../../docs/ruleset-manifest.json',import.meta.url),JSON.stringify(rules,null,2)+'\n');

import {economyRules} from '../sim/economy.ts';
import {terrainRules,terrainDefinitions,resourceDefinitions} from '../sim/terrain.ts';
import {navigationRules,startingResourceRules} from '../sim/navigation.ts';
import {rulesetHash} from '../sim/sim.ts';
import {footprintContract} from './footprints.ts';
writeFileSync(new URL('../../docs/runtime-manifest.json',import.meta.url),JSON.stringify({schemaVersion:10,rulesetHash,provenance:'design_default',navigation:navigationRules,startingResources:startingResourceRules,economy:economyRules,terrain:terrainRules,terrainDefinitions,resourceDefinitions,vision:visionRules,footprints:footprintContract,collisionScope:'static town-center (multi-rect, walkable gate and plinth), house/tree/rock/resource footprints; no unit avoidance'},null,2)+'\n');
