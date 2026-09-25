import * as esbuild from 'esbuild';
import {copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
await copyFile(new URL('apps/web/index.html',import.meta.url),root+'web/150-brick-rts.html');
const options={entryPoints:['main','worker'].map(name=>fileURLToPath(new URL(`apps/web/${name}.ts`,import.meta.url))),bundle:true,format:'esm',target:'es2022',outdir:root+'web/assets/150-brick-rts'};
if(process.argv.includes('--watch')){const ctx=await esbuild.context(options);await ctx.watch(); console.log('Watching TypeScript. Serve repository root with: python3 -m http.server 8000');}
else await esbuild.build(options);
