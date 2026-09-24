// 把 vite build 的輸出（dist/）合併成單一 HTML：JS 與 CSS 全部內嵌，
// 寫到作品集的 web/131-wildling-trail.html，部署時不需要任何 build step。

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const target = resolve(root, process.argv[2] ?? '../../web/131-wildling-trail.html');

let html = await readFile(join(dist, 'index.html'), 'utf8');

const scripts = [...html.matchAll(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/g)];
const styles = [...html.matchAll(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/g)];
if (scripts.length !== 1) throw new Error(`預期 1 個 script，找到 ${scripts.length} 個`);

for (const [tag, file] of styles) {
  const css = await readFile(join(dist, file), 'utf8');
  html = html.replace(tag, () => `<style>\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>`);
}
for (const [tag, file] of scripts) {
  const js = await readFile(join(dist, file), 'utf8');
  // 放在 body 最後，DOM 已經就緒；</script 需要跳脫才不會提早結束標籤。
  html = html.replace(tag, '');
  html = html.replace('</body>', () => `<script type="module">\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>\n</body>`);
}

if (/\ssrc="\.\/assets|href="\.\/assets/.test(html)) throw new Error('仍有未內嵌的資源');
await writeFile(target, html);
console.log(`已寫入 ${target}（${(Buffer.byteLength(html) / 1024).toFixed(0)} KB）`);
