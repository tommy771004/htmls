// 入口：先載入 Sketchfab 角色模型（glb.js；以檔案開啟時直接略過），再啟動遊戲（main.js）。
import { loadGlbHeroes } from './glb.js';

loadGlbHeroes().then(() => import('./main.js'));
