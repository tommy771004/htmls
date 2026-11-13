// 打包：src/entry.js（含 three 0.186.0）→ IIFE，嵌入 src/template.html → ../../web/283-late-checkout.html
// node tools/build.mjs [--dev] [--out 路徑]
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const oi = process.argv.indexOf('--out');
const out = oi > 0 ? resolve(process.cwd(), process.argv[oi + 1]) : resolve(root, '../../web/283-late-checkout.html');
const dev = process.argv.includes('--dev');
const ei = process.argv.indexOf('--entry');
const r = await build({
  entryPoints: [resolve(root, ei > 0 ? process.argv[ei + 1] : 'src/entry.js')],
  bundle: true, format: 'iife', target: 'es2022', write: false,
  minify: !dev, legalComments: 'none', charset: 'utf8', logLevel: 'warning',
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = readFileSync(resolve(root, 'src/template.html'), 'utf8');
writeFileSync(out, tpl.replace('/*BUNDLE*/', () => js));
console.log(`wrote ${out} (${(tpl.length / 1024 + js.length / 1024).toFixed(0)} KB)`);
