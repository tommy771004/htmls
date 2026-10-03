import { defineConfig } from 'vite';

// 模型與貼圖放在網站的 assets/197/（網頁版從 ../assets/197/ 讀取），開發時直接當 publicDir
export default defineConfig({
  base: '/',
  publicDir: '../../assets/197',
  server: { host: '127.0.0.1', port: 5173 },
});
