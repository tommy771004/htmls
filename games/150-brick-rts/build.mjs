import * as esbuild from 'esbuild';
import {copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
await copyFile(new URL('apps/web/index.html',import.meta.url),root+'web/150-brick-rts.html');
const options={entryPoints:[fileURLToPath(new URL('apps/web/main.ts',import.meta.url))],bundle:true,format:'esm',target:'es2022',outfile:root+'web/assets/150-brick-rts/main.js'};
if(process.argv.includes('--watch')){const ctx=await esbuild.context(options);await ctx.watch(); console.log('Watching TypeScript. Serve repository root with: python3 -m http.server 8000');}
else await esbuild.build(options);
