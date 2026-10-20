// 下載 Poly Haven 的 CC0 模型（glTF 1k）到 .cache/polyhaven/<id>/，給 bake.mjs 轉成 .spz。
// 用法：node tools/fetch-assets.mjs
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const POLYHAVEN = [
  'service_pistol', 'bolt_action_rifle_7_62', 'crowbar_01', 'old_gas_mask', 'medical_box',
  'ammo_box', 'medical_tape', 'vintage_radio_transceiver', 'russian_food_cans_01', 'old_military_crate',
];

const exists = p => access(p).then(() => true, () => false);
async function get(url, out) {
  if (await exists(out)) return;
  const r = await fetch(url); if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, Buffer.from(await r.arrayBuffer()));
}
for (const id of POLYHAVEN) {
  const files = await (await fetch('https://api.polyhaven.com/files/' + id)).json();
  const g = files.gltf['1k'].gltf, dir = join(ROOT, '.cache/polyhaven', id);
  await get(g.url, join(dir, `${id}_1k.gltf`));
  for (const [rel, f] of Object.entries(g.include)) await get(f.url, join(dir, rel));
  console.log('ok', id);
}
