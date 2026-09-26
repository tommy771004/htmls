// 劃記 TALLY CRM build
// 讀 src/，依固定順序內嵌成單檔 web/155-tally-crm.html，並同步產生 src/dev.html。
// 新增 src/pages/*.js 或 src/styles/pages/*.css 不需要改這支檔案。
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, '..', '..', 'web', '155-tally-crm.html');

const CORE_CSS = ['tokens.css', 'base.css', 'components.css', 'shell.css'].map((f) => join(SRC, 'styles', f));
const CORE_JS = ['util', 'icons', 'seed', 'store', 'router', 'ui', 'forms', 'palette', 'shell'].map((f) => join(SRC, 'core', f + '.js'));

const listDir = (dir, ext) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)).sort().map((f) => join(dir, f)) : [];

const cssFiles = [...CORE_CSS, ...listDir(join(SRC, 'styles', 'pages'), '.css')];
const jsFiles = [...CORE_JS, ...listDir(join(SRC, 'pages'), '.js'), join(SRC, 'main.js')];

for (const f of [...cssFiles, ...jsFiles]) {
  if (!existsSync(f)) throw new Error('missing source: ' + relative(ROOT, f));
}

const read = (f) => readFileSync(f, 'utf8');
const banner = (f) => `/* ── ${relative(SRC, f)} ── */\n`;

const css = cssFiles.map((f) => banner(f) + read(f)).join('\n').replace(/<\/style/gi, '<\\/style');
const js = jsFiles
  .map((f) => banner(f) + read(f))
  .join('\n;\n')
  .replace(/<\/script/gi, '<\\/script')
  .replace(/<!--/g, '<\\!--');

const shell = read(join(SRC, 'shell.html'));
if (!shell.includes('/*STYLE*/') || !shell.includes('/*SCRIPT*/')) throw new Error('shell.html placeholders missing');

// split/join 而不是 String.replace：程式碼裡有 NT$ 與 $1，replace 的 $ 樣式會吃掉它們。
const fill = (tpl, key, value) => tpl.split(key).join(value);

const out = fill(fill(shell, '/*STYLE*/', '\n' + css + '\n'), '/*SCRIPT*/', '\n' + js + '\n');
writeFileSync(OUT, out);

// dev.html：同一個骨架，改用 <link>/<script src>，file:// 直接可開。
const rel = (f) => relative(SRC, f).split('\\').join('/');
const dev = fill(
  fill(shell, '<style>/*STYLE*/</style>', cssFiles.map((f) => `<link rel="stylesheet" href="${rel(f)}">`).join('\n')),
  '<script>/*SCRIPT*/</script>',
  jsFiles.map((f) => `<script src="${rel(f)}"></script>`).join('\n'),
).replace('<title>', '<title>[dev] ');
writeFileSync(join(SRC, 'dev.html'), dev);

const kb = (Buffer.byteLength(out) / 1024).toFixed(1);
console.log(`built ${relative(process.cwd(), OUT)} · ${kb} KB · ${cssFiles.length} css · ${jsFiles.length} js`);
