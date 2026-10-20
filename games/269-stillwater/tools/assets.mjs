// 依序跑 blender/ 下的資產腳本（共用模組 common／meshkit／fishgen／rowing 除外），重建 blender/out/*.glb。
// node tools/assets.mjs [boat fisher env fish ...]   BLENDER=<路徑> 可指定 Blender 執行檔
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const blender = process.env.BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';
const only = process.argv.slice(2);
const LIBS = ['common.py', 'meshkit.py', 'fishgen.py', 'rowing.py'];
const scripts = readdirSync(resolve(root, 'blender')).filter((f) => f.endsWith('.py') && !LIBS.includes(f) && (!only.length || only.includes(f.replace(/\.py$/, '')))).sort();
for (const s of scripts) {
  const out = execFileSync(blender, ['-b', '--factory-startup', '-P', resolve(root, 'blender', s)], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 });
  const lines = out.split('\n').filter((l) => /^ok |Error|Traceback/.test(l));
  console.log(`${s}: ${lines.join(' ') || '（沒有輸出 ok 行，請檢查）'}`);
}
