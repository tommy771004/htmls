// 新槍模型：assets/278/models/guns/<id>.glb（槍）與 <id>_arms.glb（手臂幾何）。
// 開機先讀 index.json，沒列到的槍不發請求，改用 alias 指到替身：第一人稱與世界都借舊槍，不增加 draw。
// 第一人稱與世界槍共用同一次載入，FAST 快照啟用前全部進場景，之後網格集合不再變動。
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import { ASSET_BASE } from '../../core/assets.js';
import { NEW_GUNS } from './index.js';

/** id → 替身 id。模型載到後從這裡刪掉，所以 alias[id] ?? id 永遠是手上真正要畫的那把。 */
export const alias = Object.fromEntries(NEW_GUNS.map(g => [g.id, g.stand]));
const base = ASSET_BASE + 'models/guns/';
let job = null;

async function load(scene) {
  const index = await fetch(base + 'index.json').then(r => (r.ok ? r.json() : { guns: {} })).catch(() => ({ guns: {} }));
  const out = { index: index.guns, gun: {}, arms: {} }, get = f => LoadAssetContainerAsync(base + f, scene, { pluginExtension: '.glb' });
  await Promise.all(NEW_GUNS.filter(g => index.guns[g.id]).map(async ({ id }) => {
    const [c, a] = await Promise.all([get(id + '.glb'), index.guns[id].arms ? get(id + '_arms.glb') : null]);
    c.addAllToScene(); a?.addAllToScene();
    out.gun[id] = c; if (a) out.arms[id] = a;
    delete alias[id];
  }));
  return out;
}
export function loadNewGuns(scene) { return (job ??= load(scene)); }

/** 第一人稱與世界槍都拿走各自的節點之後呼叫：清掉 glTF 的空根節點與手臂的佔位材質。 */
export async function finishNewGuns() {
  const n = await job;
  for (const c of [...Object.values(n.gun), ...Object.values(n.arms)]) {
    for (const m of c.meshes) if (!m.getTotalVertices() && !m.getChildren().length && !m.isDisposed()) m.dispose(false, false);
  }
  for (const c of Object.values(n.arms)) for (const m of c.materials) m.dispose();
}
