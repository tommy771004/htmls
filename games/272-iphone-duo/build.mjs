// 打包成單檔 web/272-iphone-duo.html：src/app.mjs（esbuild，three 走 importmap）＋ build/geo.json ＋ src/log.html
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const here = p => new URL(p, import.meta.url);
const esbuild = new URL('../201-coral-cove/node_modules/.bin/esbuild', import.meta.url).pathname;
const app = execFileSync(esbuild, [here('src/app.mjs').pathname, '--bundle', '--format=esm', '--minify', '--external:three', '--external:three/addons/*', '--target=es2022'], { encoding: 'utf8', maxBuffer: 64 << 20 });
const geo = fs.readFileSync(here('build/geo.json'), 'utf8').replace(/</g, '\\u003c');
const html = fs.readFileSync(here('src/page.html'), 'utf8')
  .replace('{{LOG}}', () => fs.readFileSync(here('src/log.html'), 'utf8').trim())
  .replace('{{GEO}}', () => geo)
  .replace('{{APP}}', () => app.trim());
const out = here('../../web/272-iphone-duo.html');
fs.writeFileSync(out, html);
console.log('web/272-iphone-duo.html', (html.length / 1024).toFixed(0), 'KB');
