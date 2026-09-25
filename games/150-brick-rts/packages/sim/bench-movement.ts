import {writeFileSync,mkdirSync} from 'node:fs';
import {runGateBenchmark} from './benchmark.ts';
const results=[3,8,24,40].map(n=>runGateBenchmark(n));
mkdirSync(new URL('../../test-results/',import.meta.url),{recursive:true});
writeFileSync(new URL('../../test-results/movement-benchmark.json',import.meta.url),JSON.stringify(results,null,2)+'\n');
for(const r of results)console.log(`${r.units} units: settled tick ${r.settledTick}, idle ${r.outcome.idle}/unreachable ${r.outcome.unreachable}/stuck ${r.outcome.stuck}, gate ${r.gateCrossings}, wait ${r.waitTicks}, search ticks ${r.searchTicks}, p95 expanded ${r.p95ExpandedPerSearchTick}, tick ms mean ${r.timing.meanTickMs.toFixed(3)} p95 ${r.timing.p95TickMs.toFixed(3)} max ${r.timing.maxTickMs.toFixed(2)}`);
