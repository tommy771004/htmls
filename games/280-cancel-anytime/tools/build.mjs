// 打包：src/entry.js → IIFE，嵌入 src/template.html → ../../web/280-cancel-anytime.html
// THREE 是全域（頁面先 import three 再執行 bundle）。缺少的模組（平行開發中）會換成空殼。
import { build } from 'esbuild';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// --out web/<name>.html：平行開發時各自輸出到不同檔名（之後要刪掉）
const oi = process.argv.indexOf('--out');
const out = oi > 0 ? resolve(process.cwd(), process.argv[oi + 1]) : resolve(root, '../../web/280-cancel-anytime.html');
const dev = process.argv.includes('--dev');

const STUBS = {
  'models/heroes.js': 'export const HERO_BUILDERS = {};',
  'models/foes1.js': 'export const FOE1 = {};',
  'models/foes2.js': 'export const FOE2 = {};',
  'props.js': `import { box } from './kit.js'; export function buildProp(t,w=1,d=1){ return box(w*1.6,1.2,d*1.6,0x888888,0,0.6,0); } export function buildSurface(t){ const g = new THREE.Group(); return g; }`,
  'scenery.js': `export function buildScenery(){ return new THREE.Group(); } export function themeStyle(){ return { sky:['#8fc3ff','#ffe9c8'], fog:'#ffe9c8', fogNear:60, fogFar:160, hemiSky:'#ffffff', hemiGround:'#776655', hemiIntensity:1.4, sun:'#ffffff', sunIntensity:2.4, sunDir:[0.5,1,0.3], tileTop:['#d9b07a','#c99a62','#b8864e','#a8743e'], tileSide:'#6a4a30', tileEdge:'#3a2a1a', lava:'#8a1a0a', gridLine:'#000', accent:'#ffc531' }; }`,
  'audio.js': `export const SFX = { init(){}, play(){}, music(){}, setMuted(){}, get muted(){ return true; } };`,
};
const stubbed = [];
const stubPlugin = {
  name: 'stubs',
  setup(b) {
    b.onResolve({ filter: /^\.\.?\// }, args => {
      const p = resolve(args.resolveDir, args.path);
      if (existsSync(p)) return null;
      const rel = p.slice(resolve(root, 'src').length + 1);
      if (STUBS[rel]) { stubbed.push(rel); return { path: rel, namespace: 'stub' }; }
      return null;
    });
    b.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: STUBS[args.path], resolveDir: resolve(root, 'src'), loader: 'js' }));
  },
};

const r = await build({
  entryPoints: [resolve(root, 'src/entry.js')],
  bundle: true, format: 'iife', target: 'es2022', write: false,
  minify: !dev, legalComments: 'none', charset: 'utf8',
  plugins: [stubPlugin], logLevel: 'warning',
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = readFileSync(resolve(root, 'src/template.html'), 'utf8');
const html = tpl.replace('/*BUNDLE*/', () => js);
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KB)${stubbed.length ? '  stubs: ' + stubbed.join(', ') : ''}`);
