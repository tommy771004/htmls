import {mkdirSync,writeFileSync} from 'node:fs';
import {makeMap,validateMap,validateStartingResources} from '../sim/navigation.ts';
import type {MapLayout} from '../sim/terrain.ts';
const target=new URL('../../docs/maps/',import.meta.url);mkdirSync(target,{recursive:true});
for(const layout of ['meadow','coast','acceptance'] as MapLayout[]){const map=makeMap(260925,layout),errors=validateMap(map);if(errors.length)throw Error(errors.join('\n'));writeFileSync(new URL(`${layout}.json`,target),JSON.stringify({format:'brick-map-example-1',provenance:'design_default',seed:260925,layout,map,startingResources:validateStartingResources(map)},null,2)+'\n');}
