// ═══ 繪圖後端的轉接（00-core.js 的 GFX）：WebGPURenderer 不吃 ShaderMaterial（GLSL），每個材質要有一份 TSL 版本 ═══
// three 建管線前會向 R.library.fromMaterial 要「節點材質」：這裡攔下 ShaderMaterial，照登錄表（gfxPort）找改寫好的 TSL 版本，
// 沒有的話給替代材質（依 GLSL 雜湊的顏色加平面明暗；半透明與疊加混色的畫成全透明），記進 gfxMiss（__nc.gfx.miss() 列出還沒改寫的）。
// 混色、深度、正反面這些管線狀態照舊讀原本的 ShaderMaterial；節點材質只提供著色器。uniform 由 gfxU／gfxT 每次 render 從原本的 { value } 讀，
// 所以各 part 照舊改 material.uniforms.x.value 就好。
// 登錄的鍵：材質實例（後製的 pass）或 fragmentShader 字串（同一份 GLSL 的材質共用一個改寫）。改寫放在用到的 part 之後（如 71-gfx-post.js），
// fromMaterial 是第一次畫到時才問，開場的 part 都跑完了
import * as TSL from 'three/tsl';
import { NodeMaterial, TextureNode, Node as TNode, NodeBuilder, FunctionNode, AttributeNode, NodeMaterialObserver, RenderObjectRefreshType } from 'three/webgpu';
import { glslTSL } from '../gfx/glsl-tsl.mjs';
import * as TSL_GEN from '../tsl/index.mjs';
const GFX_PORT = new Map(), gfxMiss = new Map(), gfxNodeOf = new WeakMap();
const gfxPort = (key, build) => { GFX_PORT.set(key, build); };
// WebGPU 的深度是 0..1，WebGL 是 −1..1（?gfx=webgpu-gl 走 WebGPURenderer 的 WebGL2 後端，照 WebGL 的）
const gfxZ = d => R.coordinateSystem === T.WebGPUCoordinateSystem ? d : d.mul(2).sub(1);
// 還沒有值的貼圖 uniform（開場後才建的高度圖、照片材質）先綁一張 1×1
const gfxTex0 = new T.DataTexture(new Uint8Array(4), 1, 1); gfxTex0.needsUpdate = true;
const gfxTexA0 = new T.DataArrayTexture(new Uint8Array(4), 1, 1, 1); gfxTexA0.needsUpdate = true;   // 陣列貼圖（08-tex.js 的照片材質）還沒載入時
// { value } → uniform 節點，每次 render 讀回 value（數字要這樣才跟得上；向量、顏色、矩陣本來就共用同一個物件）；陣列共用同一個陣列
// 00-core.js 的共用 U 放在 renderGroup（一次 render 更新一次、所有物件共用）；材質自己的放在預設的 objectGroup
// name：three 會讓節點結構相同的材質共用同一份節點（NodeManager 的 nodeBuilderCache），更新時才換物件；所以自動轉換的材質不能讀建節點那個材質的
// { value }，要照名字讀當下在畫的材質（frame.material 是原本的 ShaderMaterial）的 uniforms[name]
const gfxShared = new Set(Object.values(U));
const gfxCur = (f, name, o) => { const u = name && f.material && f.material.uniforms && f.material.uniforms[name]; return u ? u.value : o.value; };
// 陣列 uniform（40-people.js 的 uC[9] 等）：元素是 THREE.Color 時型別要給 'color'（給 'vec3' 的話 three 照 .x／.y／.z 讀，全是 NaN，人物變成黑底藍霧）；
// UniformArrayNode 預設每次 render 更新一次，同結構的材質共用節點，所以改成每個物件更新，先換上當下在畫的材質的陣列
function gfxArr(n, name, o) {
  if (!name || gfxShared.has(o)) return n;
  const up = n.update;
  n.updateType = 'object';
  n.update = function (f) { const a = gfxCur(f, name, o); if (a && a !== this.array) this.array = a; return up.call(this, f); };
  return n;
}
function gfxU(o, type, name) {
  const v = o.value;
  // 平的 Float32Array（00-core.js 的 V4A：點光、地上陰影）：每個元素是讀回陣列的 vec4（v4set 原地寫，陣列不換）
  const n = ArrayBuffer.isView(v) ? TSL.uniformArray(Array.from({ length: v.length / 4 }, (_, k) => ({ get x() { return o.value[k * 4]; }, get y() { return o.value[k * 4 + 1]; }, get z() { return o.value[k * 4 + 2]; }, get w() { return o.value[k * 4 + 3]; } })), 'vec4')
    : Array.isArray(v) ? gfxArr(TSL.uniformArray(v, v[0] && v[0].isColor ? 'color' : type), name, o)
    : name && !gfxShared.has(o) ? TSL.uniform(v, type).onObjectUpdate(f => gfxCur(f, name, o)) : TSL.uniform(v, type).onRenderUpdate(() => o.value);
  return gfxShared.has(o) ? n.setGroup(TSL.renderGroup) : n;
}
// 貼圖：回傳「給 uv 取樣」的函式。TextureNode 自己的 update() 要設渲染目標的上下翻轉（WebGPU）與貼圖矩陣，不能用 onRenderUpdate 蓋掉，
// 所以用子類別：每次先從原本的 { value } 換上目前的貼圖再照舊更新；sample()／level() 複製出來的節點也是這個類別，經 getBase() 找到來源。
// 只有翻轉或矩陣時 setup() 才開更新，這裡一律開（每個物件更新一次）
// three 第一次以實際大小重建 GPU 貼圖時 generation 會變，但 bind group 的快取鍵只看貼圖 id 與 version：已經建好的 bind group 還指著舊的 GPU 貼圖
// （22-hmap.js 的高度圖：地上一塊塊舊的日光陰影）。看到 generation 變了就把 version 加一，讓所有綁定重建
const gfxGen = new WeakMap();
class GfxTex extends TextureNode {
  update(f) {
    const b = this.getBase(), o = b._src;
    if (o) { const v = gfxCur(f, b._name, o) || b._v0; if (v !== this.value) this.value = v; }
    const t = this.value, D = R._textures;
    if (this._gfxFlip) this._gfxFlip.value = !!(t && (t.isRenderTargetTexture || t.isFramebufferTexture || t.isDepthTexture));
    if (t && !t.isRenderTargetTexture && D && D.has(t)) { const g = D.get(t).generation, p = gfxGen.get(t); if (p !== undefined && p !== g) t.needsUpdate = true; gfxGen.set(t, g); }
    return super.update(f);
  }
  setup(b) { const r = super.setup(b); if (this.getBase()._src) this.updateType = 'object'; return r; }
  // 自動轉換的 GLSL 照 WebGL 的習慣取樣（v 由下往上）：渲染目標與深度貼圖在 WGSL 裡是左上角原點，three 只在 GLSL 後端自己翻（isFlipY），
  // 這裡照它的做法補上，看當下綁的是不是渲染目標（70-render.js 的路面倒影 tRefl：沒翻的話取到倒影上半的天空，整片一個顏色）。
  // 手寫的 TSL（71-gfx-post.js 的 Q）自己翻過，不經這裡（_gl 只有 gfxAuto 設）
  setupUV(b, uvN) {
    uvN = super.setupUV(b, uvN);
    if (!this.getBase()._gl || b.isFlipY()) return uvN;
    this._gfxFlip ??= TSL.uniform(false);
    uvN = uvN.toVar();
    if (this.sampler) return this._gfxFlip.select(uvN.flipY(), uvN);
    const ty = uvN.getNodeType(b).startsWith('i') ? TSL.int : uvN.getNodeType(b).startsWith('u') ? TSL.uint : TSL.float;   // texelFetch 的座標：轉出來的有 ivec2 也有 vec2
    return this._gfxFlip.select(uvN.setY(ty(TSL.int(TSL.textureSize(this, this.levelNode).y).sub(TSL.int(uvN.y)).sub(1))), uvN);
  }
}
function gfxT(o) {
  const b = gfxTN(o);
  return (uvN, lv) => lv === undefined ? b.sample(uvN) : b.sample(uvN).level(lv);
}
// 貼圖節點本身（.sample(uv)、.sample(ivec).setSampler(false) 是 texelFetch）；arr：sampler2DArray
function gfxTN(o, arr = false, name, gl = false) {
  const v0 = arr ? gfxTexA0 : gfxTex0, base = new GfxTex(o.value || v0); base._src = o; base._v0 = v0; base._name = name; base._gl = gl;
  return TSL.nodeObject(base);
}
// ─── 沒有手寫移植的材質：glsl-tsl.mjs 自動轉（同一份 GLSL 與 defines 的形狀只轉一次）。轉不了的退回替代材質，記進 gfxMiss ───
const gfxAutoT = new Map(), gfxAutoErr = new Map();
// 有值的 defines（FAR 的距離、FARD、CUT 的範圍、MASK_CUT…）：轉出來的 TSL 留名字、執行期由 E 給值（數字或 vecN），
// 所以鍵只看「有哪些 defines」（形狀），不同距離、範圍的材質共用一份；管線照樣依值分開（customProgramCacheKey）
function gfxDefV(d) {
  const o = {};
  for (const [k, v] of Object.entries(d || {})) {
    const s = String(v).trim(); let a;
    if (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) o[k] = TSL.float(+s);   // 包成節點：轉出來的會寫 FARD.add(…)
    else if ((a = s.match(/^(vec[234])\s*\((.*)\)$/))) o[k] = TSL[a[1]](...a[2].split(',').map(Number));
  }
  return o;
}
const gfxTier = Object.fromEntries(Object.entries(GL_TIER).map(([k, v]) => [k, TSL.int(v)]));
const gfxShape = d => JSON.stringify(Object.fromEntries(Object.entries(d || {}).map(([k, v]) => [k, v === '' || v === true ? v : '*'])));
// 每個 ShaderMaterial 都有 name：名字加上 defines 是之後存放轉好的 TSL 的鍵，同一個鍵只能對到同一份 GLSL（沒取名字或撞名的記在 gfxClash）
const gfxByName = new Map(), gfxClash = new Set();
function gfxName(m) {
  const k = (m.name || '?') + gfxShape(m.defines), src = m.vertexShader + '\u0000' + m.fragmentShader, p = gfxByName.get(k);
  if (!m.name) gfxClash.add('沒有名字：' + m.fragmentShader.slice(m.fragmentShader.startsWith(GL_LIB) ? GL_LIB.length : 0).replace(/\s+/g, ' ').trim().slice(0, 80));
  else if (p === undefined) gfxByName.set(k, src);
  else if (p !== src) gfxClash.add('撞名：' + k);
  return k;
}
// three 把有 layout 的 Fn 編成的 WGSL 函式放在跨材質、跨建置的快取（以函式節點為鍵），假設函式只讀參數；轉出來的函式直接讀 uniform 與貼圖，
// 同一個材質第二次建置（倒影、別的 render context）會拿到上次建置的 uniform 名稱。標記的函式改成每個 builder 各建一份
// If／ElseIf／Else 的分支（沒有回傳值的 Fn）：ConditionalNode 在 setup 時經 IsolateNode（另一份快取）建一次分支，generate 前又在外層快取從同一個
// 呼叫節點再 getOutputNode 一次；void 分支的 call() 結果是 null，once 也存不住，所以每建一次就重跑一次函式、裡面的分支又各是新的節點，
// 每多一層巢狀就多一倍（立面 facade 最深的分支一次建置跑 512 次、20.7 萬個節點）。轉出來的分支改成每個 builder 只跑一次，輸出共用
const gfxBr = f => { f.gfxBr = true; return f; };
const gfxIf = (c, f) => {
  const s = TSL.If(c, gfxBr(f)), o = { ElseIf: (c2, f2) => { s.ElseIf(c2, gfxBr(f2)); return o; }, Else: f2 => { s.Else(gfxBr(f2)); return o; } };
  return o;
};
{
  const P = Object.getPrototypeOf(TSL.Fn(() => {}).shaderNode.call()), go = P.getOutputNode;   // ShaderCallNodeInternal 沒有匯出
  P.getOutputNode = function (b) {
    if (!this.shaderNode.jsFunc.gfxBr) return go.call(this, b);
    const m = this.gfxOut || (this.gfxOut = new WeakMap()), k = b.getSubBuildOutput(this);
    let e = m.get(b); if (!e) m.set(b, e = {});
    return e[k] || (e[k] = go.call(this, b));
  };
}
const GFX_TSL = { ...TSL, If: gfxIf, Fn: (f, l) => { const r = TSL.Fn(f, l); r.shaderNode.gfxOwn = true; r.gfxSrc = f; return r; } };
{
  const orig = NodeBuilder.prototype.buildFunctionNode;
  NodeBuilder.prototype.buildFunctionNode = function (sn) {
    if (!sn.gfxOwn) return orig.call(this, sn);
    const c = this.gfxFns || (this.gfxFns = new Map());
    let fn = c.get(sn);
    if (!fn) {
      fn = new FunctionNode();
      const prev = this.currentFunctionNode;
      this.currentFunctionNode = fn; fn.code = this.buildFunctionCode(sn); this.currentFunctionNode = prev;
      c.set(sn, fn);
    }
    return fn;
  };
}
const GFX_GL2TSL = { float: 'float', int: 'int', bool: 'bool', vec2: 'vec2', vec3: 'vec3', vec4: 'vec4', ivec2: 'ivec2', mat3: 'mat3', mat4: 'mat4' };
// 產生好的 TSL（src/tsl/，node tools/gen-tsl.mjs）：鍵是名字＋defines 的形狀，h 是當時 GLSL 的雜湊。對不上（改了 GLSL 沒重新產生）或沒產生到的照舊執行期轉譯，
// 記進 gfxGenMiss（__nc.gfx.gen()）；?tslgen=1 一律轉譯（產生器用）
const GFX_GEN = !/[?&]tslgen=1\b/.test(location.search), gfxGenMiss = new Map();
// 開場時還沒掛到任何物件上的材質（結局 B 才貼的通緝海報 pstMat）：登記在這裡，warm() 一起轉，產生器才拿得到
const gfxLate = [];
const gfxHash = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36) + s.length.toString(36); };
function gfxAuto(m) {
  const nk = gfxName(m), shape = gfxShape(m.defines);
  const key = m.vertexShader + '\u0000' + m.fragmentShader + '\u0000' + shape, dv = gfxDefV(m.defines);
  let t = gfxAutoT.get(key);
  if (t === undefined) {
    const h = gfxHash(key), g = GFX_GEN && TSL_GEN.MAT[m.name] && TSL_GEN.MAT[m.name][shape];
    if (g && g.h === h) t = { ...g, lib: g.lib ? { make: TSL_GEN.LIB[g.lib] } : null };
    else {
      if (GFX_GEN) gfxGenMiss.set(nk, g ? '過期' : '沒產生');
      try { t = glslTSL(m.vertexShader, m.fragmentShader, m.defines, { ...GL_TIER, ...dv }, GL_LIB); t.name = m.name; t.shape = shape; t.h = h; } catch (e) { t = null; gfxAutoErr.set((m.name || '?') + ' ' + e.message.slice(0, 120), m); }
    }
    gfxAutoT.set(key, t);
  }
  if (!t) return null;
  try {
    const E = {
      ...gfxTier, ...dv,
      position: TSL.positionLocal, normal: TSL.normalLocal, uv: TSL.uv(), pGeom_: TSL.positionGeometry, nGeom_: TSL.normalGeometry,
      modelMatrix: TSL.modelWorldMatrix, viewMatrix: TSL.cameraViewMatrix, projectionMatrix: TSL.cameraProjectionMatrix,
      modelViewMatrix: TSL.modelViewMatrix, normalMatrix: TSL.modelNormalMatrix, cameraPosition: TSL.cameraPosition,
      fragCoord_: TSL.vec4(TSL.screenCoordinate.x, TSL.screenSize.y.sub(TSL.screenCoordinate.y), 0, 1), frontFacing_: TSL.frontFacing,
      texA_: (t, p) => t.sample(p.xy).depth(p.z), texLA_: (t, p, lv) => t.sample(p.xy).depth(p.z).level(lv),
      color: TSL.vertexColor().rgb,   // three 替 vertexColors 的 ShaderMaterial 自動加的 attribute vec3 color
    };
    for (const d of t.attributes) E[d.name] = TSL.attribute(d.src, GFX_GL2TSL[d.type] || d.type);
    for (const d of t.varyings) E[d.name] = TSL.varyingProperty(GFX_GL2TSL[d.type] || d.type, 'gv_' + d.name);
    for (const d of t.uniforms) {
      const o = m.uniforms[d.src] || { value: d.type === 'float' ? 0 : null };
      if (d.type.startsWith('sampler')) E[d.name] = gfxTN(o, d.type === 'sampler2DArray', d.src, true);
      else if (o.value === null) E[d.name] = TSL[GFX_GL2TSL[d.type] || 'float'](0);
      else E[d.name] = gfxU(o, d.size ? GFX_GL2TSL[d.type] : undefined, d.src);
    }
    const n = new NodeMaterial();
    // 共用函式庫（GL_LIB）的函式每個階段各建一份（全域變數 gAmb 之類不能跨材質、跨階段共用）
    if (t.libV) Object.assign(E, t.lib.make(GFX_TSL, E));
    n.vertexNode = t.vertex(GFX_TSL, E)();
    if (t.libF) Object.assign(E, t.lib.make(GFX_TSL, E));
    n.fragmentNode = t.fragment(GFX_TSL, E)();
    return n;
  } catch (e) { gfxAutoErr.set((m.name || '?') + ' ' + e.message.slice(0, 120), m); return null; }
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
// 實例矩陣改由頂點屬性 gfxIM0～3 進來（見下面 R._objects.get 的說明）：手寫移植（gfxPort）的、有實例顏色或變形的、頂點緩衝快滿（WebGPU 最多 8 個）的照舊走 three
const gfxIMOn = (o, m) => o.isInstancedMesh === true && !o.instanceColor && !o.morphTexture && Object.keys(o.geometry.attributes).length < 8 &&
  !!m && m.isShaderMaterial === true && !GFX_PORT.has(m) && !GFX_PORT.has(m.fragmentShader);
// 每個 instanceMatrix 一份交錯緩衝：直接用它的陣列，版本、用途、更新範圍都讀它的，各 part 照舊寫 instanceMatrix、設 needsUpdate
const gfxIMs = new WeakMap();
function gfxIMA(o) {
  const im = o.instanceMatrix; let a = gfxIMs.get(im);
  if (!a) {
    const ib = new T.InstancedInterleavedBuffer(im.array, 16, 1);
    Object.defineProperties(ib, { version: { get: () => im.version, set() {} }, usage: { get: () => im.usage, set() {} }, updateRanges: { get: () => im.updateRanges, set() {} } });
    a = {}; for (let i = 0; i < 4; i++) a['gfxIM' + i] = new T.InterleavedBufferAttribute(ib, 4, i * 4);
    gfxIMs.set(im, a);
    o.addEventListener('dispose', () => { for (const k in a) R._attributes.delete(a[k]); });
  }
  return a;
}
// 頂點屬性節點：幾何上沒有這個名字（屬性在物件上），不問幾何、直接宣告成 vec4
class GfxIMAttr extends AttributeNode {
  generate(b) { const a = b.getAttribute(this.getAttributeName(b), 'vec4'); return b.format(a.name, 'vec4', this.getNodeType(b)); }
}
function gfxIMPos(n, m) {
  n.setupPosition = function (b) {
    if (!gfxIMOn(b.object, m)) return NodeMaterial.prototype.setupPosition.call(this, b);
    const M = TSL.mat4(...[0, 1, 2, 3].map(i => TSL.nodeObject(new GfxIMAttr('gfxIM' + i, 'vec4'))));
    TSL.positionLocal.assign(M.mul(TSL.positionLocal).xyz);
    if (b.hasGeometryAttribute('normal')) TSL.normalLocal.assign(TSL.transformNormal(TSL.normalLocal, M));
    return TSL.positionLocal;
  };
}
// 材質自己的 uniform（共用的 U 在 renderGroup，每次 render 都更新）跟上次比：數字、向量／顏色／矩陣（equals）、陣列逐項、貼圖看是哪一張、
// version 與 three 的 GPU 貼圖代數（第一次以實際大小重建時會變，GfxTex.update 要再跑一次）。每個材質每次 render 只比一次
const gfxSnap = new WeakMap();
function gfxSame(p, v) {
  if (v === null || typeof v !== 'object') return p === v;
  if (v.isTexture) { const D = R._textures, g = D && D.has(v) ? D.get(v).generation : -1; return !!p && p.t === v && p.ver === v.version && p.g === g; }
  if (typeof v.equals === 'function') return !!p && p.constructor === v.constructor && p.equals(v);
  if (Array.isArray(v) || ArrayBuffer.isView(v)) { if (!p || p.length !== v.length) return false; for (let i = 0; i < v.length; i++) if (!gfxSame(p[i], v[i])) return false; return true; }
  return p === v;
}
function gfxCopy(v) {
  if (v === null || typeof v !== 'object') return v;
  if (v.isTexture) { const D = R._textures; return { t: v, ver: v.version, g: D && D.has(v) ? D.get(v).generation : -1 }; }
  if (typeof v.clone === 'function' && typeof v.equals === 'function') return v.clone();
  if (Array.isArray(v)) return v.map(gfxCopy);
  if (ArrayBuffer.isView(v)) return v.slice();
  return v;
}
function gfxUniVer(m, rid) {
  let e = gfxSnap.get(m);
  if (!e) gfxSnap.set(m, e = { rid: -1, v: 0, s: new Map() });
  if (e.rid === rid) return e.v;
  e.rid = rid;
  let ch = false;
  for (const k in m.uniforms) {
    const o = m.uniforms[k];
    if (!o || gfxShared.has(o)) continue;
    const p = e.s.get(k);
    if (p !== undefined && gfxSame(p, o.value)) continue;
    e.s.set(k, gfxCopy(o.value)); ch = true;
  }
  if (ch) e.v++;
  return e.v;
}
// 共用 U 裡的貼圖（08-tex.js 的 uVilA／uFacA 下載完才換上、22-hmap.js 的高度圖重建 GPU 貼圖）：gfxUniVer 不看共用的，換了一張或 generation 變了，
// 已經建好的 render object 也要完整更新一次，不然一直綁著第一次畫的時候那張。開場第一幀就畫的物件（21-coast.js 的山坡粗網格，frustumCulled 關掉）
// 原本一直綁著還沒下載的預設貼圖：WebGPU 下山坡一大塊沒有照片法線、整片變暗（邊緣是一塊長方形）
const gfxShTex = [...gfxShared].filter(o => o && (o.value === null || o.value.isTexture)), gfxShSnap = new Map();
let gfxShRid = -1, gfxShV = 0;
function gfxShVer(rid) {
  if (gfxShRid === rid) return gfxShV;
  gfxShRid = rid;
  const D = R._textures;
  for (const o of gfxShTex) {
    const t = o.value, g = t && D && D.has(t) ? D.get(t).generation : -1, p = gfxShSnap.get(o);
    if (p && p.t === t && p.g === g) continue;
    if (p) gfxShV++;
    gfxShSnap.set(o, { t, g });
  }
  return gfxShV;
}
if (GFX !== 'webgl') {
  // ?gfxtrace=1：沒被呼叫的 Fn（TSL 會報 "Fn() was declared but not invoked"）印出它的原始碼開頭，好找是哪個轉出來的函式
  if (/[?&]gfxtrace=1/.test(location.search)) {
    const P = TSL.Fn(() => TSL.float(0)).constructor.prototype, g = P.generate;   // Fn() 回傳 Proxy（沒有 getPrototypeOf），constructor 才拿得到 FnNode
    P.generate = function (b) { console.warn('gfx Fn not invoked:', String(this.gfxSrc || (this.shaderNode && this.shaderNode.jsFunc) || '?').slice(0, 300)); return g.call(this, b); };
  }
  // three 判斷「兩個材質能不能共用同一份節點」（RenderObject 的 getMaterialCacheKey）時，物件型別的屬性一律只記成 {}：GLSL 一樣、defines 不同的材質
  // （glb 的有無 USE_MAP、FAR、CUT 的範圍）在幾何的 attribute 也一樣時會拿到同一份節點。賭場吊燈沒有底色貼圖的燈罩就拿到 USE_MAP 版、取樣空的貼圖，整片黑掉。defines 併進鍵裡
  const cpk = T.ShaderMaterial.prototype.customProgramCacheKey;
  T.ShaderMaterial.prototype.customProgramCacheKey = function () { return cpk.call(this) + JSON.stringify(this.defines || {}); };
  // 實例：three 的 getMaterialCacheKey 對每個 InstancedMesh 加上 object.uuid，因為它的 InstanceNode 把那個物件的 instanceMatrix 直接綁進節點
  // （少的用 uniform 陣列、大小依 count；多的用頂點屬性）：同一份 GLSL 的道具、車流 InstancedMesh 一個物件就建一次（載入時 777 次、約 10 秒）。
  // 自動轉換的材質改成照名字讀頂點屬性 gfxIM0～3（gfxIMPos），屬性由 render object 從自己的物件拿（getAttributes），鍵裡的 uuid 換成固定字串，
  // 版面相同的物件共用一份。三處都看 gfxIMOn，條件要一致
  // 頂點格式：three 的 WebGPUAttributeUtils 單一分量只認 32 位元（float32／sint32／uint32），glb 量化過的 1 分量屬性（城寨窗戶編號 _win 的 unorm16）
  // 報「Vertex format not supported yet」，整條管線建不起來、那些模型畫不出來。第一次用到那份幾何時換成 float32（getX 照 normalized 反正規化，值和 WebGL 一樣）
  const gfxVF = g => {
    if (!g || !g.attributes || g.userData.gfxVF) return; g.userData.gfxVF = 1;
    for (const k in g.attributes) {
      const a = g.attributes[k], A = (a.isInterleavedBufferAttribute ? a.data.array : a.array).constructor;
      if (a.itemSize !== 1 || A === Float32Array || A === Int32Array || A === Uint32Array) continue;
      const f = new Float32Array(a.count); for (let i = 0; i < a.count; i++) f[i] = a.getX(i);
      g.setAttribute(k, new T.BufferAttribute(f, 1));
    }
  };
  const og = R._objects.get;
  R._objects.get = function (...a) {   // RenderObject 沒有匯出：從第一個建出來的拿原型
    const ro = og.apply(this, a); delete R._objects.get;
    const P = Object.getPrototypeOf(ro), mk = P.getMaterialCacheKey, ga = P.getAttributes;
    P.getMaterialCacheKey = function () {
      const o = this.object;
      if (!gfxIMOn(o, this.material)) return mk.call(this);
      this.object = Object.create(o, { uuid: { value: 'gfxIM' } });
      try { return mk.call(this); } finally { this.object = o; }
    };
    P.getAttributes = function () {
      if (this.attributes === null) gfxVF(this.geometry);
      if (this.attributes !== null || !gfxIMOn(this.object, this.material)) return ga.call(this);
      const g = this.geometry, im = gfxIMA(this.object);
      this.geometry = { getAttribute: k => im[k] || g.getAttribute(k) };
      try { ga.call(this); } finally { this.geometry = g; }
      for (const k in im) delete this.attributesId[k];   // 不在幾何上：留著的話 needsGeometryUpdate 每幀都說要重建
      return this.attributes;
    };
    ro.initialCacheKey = ro.getCacheKey();
    return ro;
  };
  // three 只看材質的屬性、物件矩陣與幾何有沒有變（NodeMaterialObserver.equals），沒變的 render object 只更新共用的 uniform：ShaderMaterial 的
  // { value } 改了（包括原地 .set()）它看不到，材質自己的 uniform 與貼圖只在第一次寫進綁定（後製的 pass 一幀換好幾次輸入貼圖）。
  // 每次 render 每個材質比一次自己的 uniform（gfxUniVer），有變就版本加一；render object 記著上次的版本，對不上就完整更新（被剔除一陣子的物件
  // 下次畫到時也會補上）。原本是在材質上掛一個節點讓每個物件每次都完整更新，光環廣場每幀送出 11.8 → 8.9 ms
  const nr = NodeMaterialObserver.prototype.needsRefresh, FULL = RenderObjectRefreshType.FULL;
  NodeMaterialObserver.prototype.needsRefresh = function (ro, f) {
    const r = nr.call(this, ro, f), m = ro.material;
    if (!m.isShaderMaterial) return r;
    const v = gfxUniVer(m, f.renderId), sv = gfxShVer(f.renderId);
    if (ro.gfxV === v && ro.gfxS === sv) return r;
    ro.gfxV = v; ro.gfxS = sv;
    return FULL;
  };
  const lib = R.library, orig = lib.fromMaterial.bind(lib);
  lib.fromMaterial = m => {
    if (!m.isShaderMaterial) return orig(m);
    let n = gfxNodeOf.get(m);
    if (!n) {
      const b = GFX_PORT.get(m) || GFX_PORT.get(m.fragmentShader);
      n = b ? b(m) : gfxAuto(m) || gfxFallback(m);
      if (!b) gfxIMPos(n, m);
      // 建管線時節點材質自己會看的幾個屬性（其餘的管線狀態讀原本的材質）
      n.side = m.side; n.transparent = m.transparent; n.alphaTest = m.alphaTest; n.wireframe = m.wireframe;
      gfxNodeOf.set(m, n);
    }
    return n;
  };
}
const gfxApi = { name: GFX, miss: () => [...gfxMiss].map(([k, n]) => `${n}× ${k}`), ported: () => GFX_PORT.size, auto: () => [...gfxAutoT.values()].filter(Boolean).length, err: () => [...gfxAutoErr.keys()], clash: () => [...gfxClash], names: () => gfxByName.size, keys: () => [...gfxByName.keys()],
  gen: () => [...gfxGenMiss].map(([k, v]) => `${v}：${k}`),   // 沒用到產生好的 TSL 的鍵
  // tools/gen-tsl.mjs：執行期轉好的（?tslgen=1）原樣交出去；warm(root) 不畫、直接把 root 底下所有 ShaderMaterial 轉一次（看不到的物件也算）
  dump: () => { const libs = {}, mats = []; for (const t of gfxAutoT.values()) if (t && t.src) { if (t.lib) libs[t.lib.key] = t.lib.src; mats.push({ name: t.name, shape: t.shape, h: t.h, lib: t.lib ? t.lib.key : null, libV: t.libV, libF: t.libF, uniforms: t.uniforms, varyings: t.varyings, attributes: t.attributes, v: t.src.v, f: t.src.f }); } return { libs, mats }; },
  warm: root => { let k = 0; const f = m => { if (m.isShaderMaterial) { R.library.fromMaterial(m); k++; } }; root.traverse(o => [].concat(o.material || []).forEach(f)); gfxLate.forEach(f); return k; },
  code: () => [...gfxAutoT].filter(([, t]) => t && t.code).map(([k, t]) => ({ glsl: k, v: t.code.v, f: t.code.f })) };
