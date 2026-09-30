// 渲染器入口：優先 WebGL2，失敗時退回 Canvas 2D。
// assets = { meshes（parseMeshes 結果）, tracks（parseTrack 結果陣列）, albedo（圖片陣列）}
// opts.force2d：強制用 2D 備援（除錯／測試）。
import { createGLRenderer } from './webgl.js';
import { createCanvas2DRenderer } from './canvas2d.js';

export function createRenderer(canvas, assets, opts = {}) {
  const force2d = opts.force2d || /[?&]render=2d\b/.test(globalThis.location?.search || '');
  if (!force2d) {
    let gl = null;
    try {
      gl = canvas.getContext('webgl2', { antialias: true, alpha: false, depth: true, stencil: false, premultipliedAlpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    } catch { gl = null; }
    if (gl) {
      try {
        const r = createGLRenderer(canvas, gl, assets);
        r.canvas = canvas;
        return r;
      } catch (err) {
        console.warn('WebGL2 初始化失敗，改用 2D', err);
        // 這張畫布已綁定 webgl2，換一張新的給 2D 用
        const c2 = canvas.cloneNode(false);
        canvas.replaceWith(c2);
        canvas = c2;
      }
    }
  }
  const ctx = canvas.getContext('2d', { alpha: false });
  const r = createCanvas2DRenderer(canvas, ctx, assets);
  r.canvas = canvas;
  return r;
}
