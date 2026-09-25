import {visionRules} from '../sim/vision.ts';
import {writeFileSync} from 'node:fs';
import {rules,validateRules} from './rules.ts';
const errors=validateRules(rules);if(errors.length)throw Error(errors.join('\n'));
writeFileSync(new URL('../../docs/ruleset-manifest.json',import.meta.url),JSON.stringify(rules,null,2)+'\n');

import {economyRules} from '../sim/economy.ts';
import {terrainRules,terrainDefinitions,resourceDefinitions} from '../sim/terrain.ts';
import {navigationRules,startingResourceRules} from '../sim/navigation.ts';
import {rulesetHash} from '../sim/sim.ts';
writeFileSync(new URL('../../docs/runtime-manifest.json',import.meta.url),JSON.stringify({schemaVersion:9,rulesetHash,provenance:'design_default',navigation:navigationRules,startingResources:startingResourceRules,economy:economyRules,terrain:terrainRules,terrainDefinitions,resourceDefinitions,vision:visionRules,collisionScope:'static house/tree/rock footprints; no unit avoidance'},null,2)+'\n');
