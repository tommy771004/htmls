import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 2000,
    modulePreload: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  define: {
    // Phaser 會依這兩個旗標決定要不要打包 Canvas／WebGL 渲染器。
    'typeof CANVAS_RENDERER': JSON.stringify(true),
    'typeof WEBGL_RENDERER': JSON.stringify(true),
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/flow/**/*.test.ts'],
    environment: 'node',
  },
});
