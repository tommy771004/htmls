import {runHeadless} from './headless.ts';
try{console.log(JSON.stringify(runHeadless(Number(process.argv[2]??260925),Number(process.argv[3]??10000)),null,2));}catch(e){console.error((e as Error).message);process.exitCode=1;}
