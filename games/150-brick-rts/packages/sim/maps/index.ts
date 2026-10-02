// The 地圖 round's match maps: one generator per layout (packages/sim/maps/land.ts, water.ts; later special starts and
// island maps add theirs here). navigation.ts makeMap calls generateMatchMap with each retry's seed and validates the
// result like the 'open' map. The catalogue with names and the site's descriptions is packages/content/maps.ts.
import {matchMapLayouts} from '../terrain.ts';
import type {MapLayout,MatchMapLayout} from '../terrain.ts';
import type {MapData} from '../navigation.ts';
import {arabia,blackForest,mongolia,goldRush,yucatan,ghostLake,craterLake,landMapRules} from './land.ts';
import {coastal,mediterranean,baltic,continental,rivers,highland,oasis,scandinavia,saltMarsh,waterMapRules} from './water.ts';
import {fortress,arena,nomad,migration,islands,archipelago,teamIslands,specialMapRules} from './special.ts';
import {standardKit,apron} from './toolkit.ts';
const generators:Record<MatchMapLayout,(seed:number)=>MapData>={arabia,'black-forest':blackForest,coastal,mediterranean,baltic,continental,rivers,highland,
 'ghost-lake':ghostLake,mongolia,oasis,scandinavia,yucatan,'gold-rush':goldRush,'crater-lake':craterLake,'salt-marsh':saltMarsh,
 fortress,arena,nomad,migration,islands,archipelago,'team-islands':teamIslands};
export const isMatchMap=(layout:MapLayout):layout is MatchMapLayout=>(matchMapLayouts as readonly string[]).includes(layout);
export function generateMatchMap(seed:number,layout:MatchMapLayout):MapData{return generators[layout](seed);}
// Everything that shapes these maps, for the ruleset hash (a function: the map modules and navigation.ts import each
// other, so nothing here is read while the modules load).
export const matchMapRules=()=>({standardKit,apron,land:landMapRules,water:waterMapRules,special:specialMapRules});
