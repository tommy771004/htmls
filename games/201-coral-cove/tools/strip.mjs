// 測試退回佔位幾何：把打包後的單檔拿掉指定（或全部）內嵌 GLB，輸出到 dist/
// node tools/strip.mjs <輸出.html> [fisher props reef fish]（不給名稱＝全部拿掉）
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const [out, ...names] = process.argv.slice(2);
let s = readFileSync('../../web/201-coral-cove.html', 'utf8');
for (const n of names.length ? ['fisher', 'props', 'reef', 'fish'].filter((x) => names.includes(x)) : ['fisher', 'props', 'reef', 'fish']) {
  const a = s.indexOf(`<script type="application/octet-stream" id="glb-${n}">`);
  if (a < 0) continue;
  const b = s.indexOf('</script>', a) + 9;
  s = s.slice(0, a) + s.slice(b);
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, s);
console.log(out, (s.length / 1024).toFixed(0) + ' KB');
