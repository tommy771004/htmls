// ═══ 繪圖後端的轉接（00-core.js 的 GFX）：WebGPURenderer 不吃 ShaderMaterial（GLSL），每個材質要有一份 TSL 版本 ═══
// three 建管線前會向 R.library.fromMaterial 要「節點材質」：這裡攔下 ShaderMaterial，照登錄表（gfxPort）找改寫好的 TSL 版本，
// 沒有的話給替代材質（依 GLSL 雜湊的顏色加平面明暗；半透明與疊加混色的畫成全透明），記進 gfxMiss（__nc.gfx.miss() 列出還沒改寫的）。
// 混色、深度、正反面這些管線狀態照舊讀原本的 ShaderMaterial；節點材質只提供著色器。uniform 由 gfxU／gfxT 每次 render 從原本的 { value } 讀，
// 所以各 part 照舊改 material.uniforms.x.value 就好。
// 登錄的鍵：材質實例（後製的 pass）或 fragmentShader 字串（同一份 GLSL 的材質共用一個改寫）。改寫放在用到的 part 之後（如 71-gfx-post.js），
// fromMaterial 是第一次畫到時才問，開場的 part 都跑完了
import * as TSL from 'three/tsl';
import { NodeMaterial, TextureNode } from 'three/webgpu';
const GFX_PORT = new Map(), gfxMiss = new Map(), gfxNodeOf = new WeakMap();
const gfxPort = (key, build) => { GFX_PORT.set(key, build); };
// WebGPU 的深度是 0..1，WebGL 是 −1..1（?gfx=webgpu-gl 走 WebGPURenderer 的 WebGL2 後端，照 WebGL 的）
const gfxZ = d => R.coordinateSystem === T.WebGPUCoordinateSystem ? d : d.mul(2).sub(1);
// 還沒有值的貼圖 uniform（開場後才建的高度圖、照片材質）先綁一張 1×1
const gfxTex0 = new T.DataTexture(new Uint8Array(4), 1, 1); gfxTex0.needsUpdate = true;
// { value } → uniform 節點，每次 render 讀回 value（數字要這樣才跟得上；向量、顏色、矩陣本來就共用同一個物件）；陣列共用同一個陣列
// 00-core.js 的共用 U 放在 renderGroup（一次 render 更新一次、所有物件共用）；材質自己的放在預設的 objectGroup
const gfxShared = new Set(Object.values(U));
function gfxU(o, type) {
  const v = o.value;
  const n = Array.isArray(v) ? TSL.uniformArray(v, type) : TSL.uniform(v, type).onRenderUpdate(() => o.value);
  return gfxShared.has(o) ? n.setGroup(TSL.renderGroup) : n;
}
// 貼圖：回傳「給 uv 取樣」的函式。TextureNode 自己的 update() 要設渲染目標的上下翻轉（WebGPU）與貼圖矩陣，不能用 onRenderUpdate 蓋掉，
// 所以用子類別：每次先從原本的 { value } 換上目前的貼圖再照舊更新；sample()／level() 複製出來的節點也是這個類別，經 getBase() 找到來源。
// 只有翻轉或矩陣時 setup() 才開更新，這裡一律開（每個物件更新一次）
class GfxTex extends TextureNode {
  update(f) { const o = this.getBase()._src; if (o) { const v = o.value || gfxTex0; if (v !== this.value) this.value = v; } return super.update(f); }
  setup(b) { const r = super.setup(b); if (this.getBase()._src) this.updateType = 'object'; return r; }
}
function gfxT(o) {
  const base = new GfxTex(o.value || gfxTex0); base._src = o;
  const b = TSL.nodeObject(base);
  return (uvN, lv) => lv === undefined ? b.sample(uvN) : b.sample(uvN).level(lv);
}
function gfxFallback(m) {
  // 很多 GLSL 開頭是同一份 GL_LIB：鍵用去掉它之後的開頭，再加整份的雜湊
  const f = m.fragmentShader, body = f.startsWith(GL_LIB) ? f.slice(GL_LIB.length) : f;
  let fh = 0; for (let i = 0; i < f.length; i++) fh = fh * 31 + f.charCodeAt(i) | 0;
  const k = (m.name || '') + '|' + (fh >>> 0).toString(36) + '|' + body.replace(/\s+/g, ' ').trim().slice(0, 120);
  gfxMiss.set(k, (gfxMiss.get(k) || 0) + 1);
  let h = 0; for (let i = 0; i < k.length; i++) h = h * 31 + k.charCodeAt(i) | 0;
  const n = new NodeMaterial(), col = new T.Color().setHSL((h >>> 0) % 360 / 360, .3, .42);
  n.fragmentNode = m.transparent || m.blending !== T.NormalBlending ? TSL.vec4(0)
    : TSL.vec4(TSL.vec3(col.r, col.g, col.b).mul(TSL.abs(TSL.normalFlat.z).mul(.7).add(.3)), 1);
  return n;
}
if (GFX !== 'webgl') {
  const lib = R.library, orig = lib.fromMaterial.bind(lib);
  lib.fromMaterial = m => {
    if (!m.isShaderMaterial) return orig(m);
    let n = gfxNodeOf.get(m);
    if (!n) {
      // three 只在材質帶節點時每次 render 都完整更新（NodeMaterialObserver.containsNode 看的是原本的材質）：沒有的話材質自己的 uniform 與貼圖
      // 只在第一次寫進綁定，之後改 value 不會生效（後製的 pass 一幀換好幾次輸入貼圖）。掛一個節點上去
      m.gfxRefresh = TSL.float(0);
      const b = GFX_PORT.get(m) || GFX_PORT.get(m.fragmentShader);
      n = b ? b(m) : gfxFallback(m);
      // 建管線時節點材質自己會看的幾個屬性（其餘的管線狀態讀原本的材質）
      n.side = m.side; n.transparent = m.transparent; n.alphaTest = m.alphaTest; n.wireframe = m.wireframe;
      gfxNodeOf.set(m, n);
    }
    return n;
  };
}
const gfxApi = { name: GFX, miss: () => [...gfxMiss].map(([k, n]) => `${n}× ${k}`), ported: () => GFX_PORT.size };
