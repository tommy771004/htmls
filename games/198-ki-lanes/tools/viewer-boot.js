// 角色檢視頁的入口：和遊戲一樣先載入 GLB 角色模型（經 HTTP 開啟時），再跑 viewer-entry.js。
import { loadGlbHeroes } from '../src/glb.js';

loadGlbHeroes().then(() => import('./viewer-entry.js'));
