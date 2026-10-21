// 入口：先載入 Sketchfab 角色模型（glb.js；以檔案開啟時直接略過），再啟動遊戲（main.js）。
// 進度交給 src/index.html 的載入層控制器 __kiBoot（頁面下載階段它就在跑；開發工具開的頁面可能沒有）。
import { loadGlbHeroes } from './glb.js';

const ui = globalThis.__kiBoot;
loadGlbHeroes(undefined, ui && ui.glb)
  .then(() => import('./main.js'))
  .finally(() => ui && ui.done());
