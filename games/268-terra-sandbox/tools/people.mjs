// 重建人物模型：Blender 無頭執行 blender/people.py → blender/out/_people_raw.glb，
// 再用 gltfpack（meshopt 壓縮，前端以 three 內附的 MeshoptDecoder 解）輸出 blender/out/people.glb。
//   node tools/people.mjs     （需要 Blender 5.x 與網路上的 gltfpack；輸出有 commit，打包不需要它們）
import { execFileSync } from 'node:child_process';
import { existsSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const blender = process.env.BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';
const out = resolve(root, 'blender/out/people.glb');
const raw = resolve(root, 'blender/out/_people_raw.glb');
execFileSync(blender, ['-b', '-P', resolve(root, 'blender/people.py')], { stdio: ['ignore', 'inherit', 'inherit'] });
if (!existsSync(out)) throw new Error('Blender 沒有輸出 people.glb');
renameSync(out, raw);
execFileSync('npx', ['--yes', 'gltfpack@1.3.0', '-i', raw, '-o', out, '-c', '-kn', '-km'], { stdio: 'inherit' });
rmSync(raw);
console.log(`${out}: ${(statSync(out).size / 1024).toFixed(0)} KB`);
