// ═══ GLSL → TSL：?gfx=webgpu 時把還沒手寫移植的 ShaderMaterial 自動轉成節點材質（02-gfx.js 的 gfxAuto 呼叫）═══
// 用 three 的 transpiler（GLSLDecoder → TSLEncoder）轉，前後補上它不會的幾件事：
//   · 前處理：#ifdef／#ifndef／#if defined(...)／#else／#endif 照材質的 defines 展開；#include 拿掉（實例化與蒙皮由 three 的節點材質自己做，
//     所以頂點著色器裡乘 instanceMatrix 的地方拿掉，position／normal 對到已經套過實例與蒙皮的 positionLocal／normalLocal；要原始座標的寫 GEOM_POS／GEOM_NRM）
//   · uniform、attribute、varying 的宣告拿掉，改由呼叫端傳進節點（varying 是兩個階段共用名字的 varyingProperty）
//   · 提前 return：TSL 的 If 裡 return 不會離開函式，所以每個函式改成單一出口（ret_ 與 done_，後面的敘述包進 if (!done_)，迴圈裡加 break）
//   · out／inout 參數：不建本地複本、函式不給 layout（內嵌展開，寫進去的就是呼叫端的變數）；void 函式補標成 void（不然呼叫會被 three 丟掉，見 stage()），大的函式要寫成回傳值
//   · 區域變數一律 toVar()（transpiler 只替被改寫的參數這樣做）
//   · main 改成回傳 vec4 的 main_（片段：gl_FragColor；頂點：gl_Position）
//   · 以共用函式庫（GL_LIB）開頭的著色器拆成函式庫＋本體，函式庫只轉一次（libTSL）；依畫質等級的常數與有值的 defines 留名字、由呼叫端給值
// 產出的程式碼字串用 new Function 建成函式，第一次畫到那個材質時建一次（同一份 GLSL 與 defines 的形狀的材質共用）；tools/gen-tsl.mjs 把字串寫進 src/tsl/。
import GLSLDecoder from 'three/examples/jsm/transpiler/GLSLDecoder.js';
import TSLEncoder from 'three/examples/jsm/transpiler/TSLEncoder.js';
import Linker from 'three/examples/jsm/transpiler/Linker.js';
import { VariableDeclaration, Accessor, FunctionCall, Number as NumberNode, Return, Operator, Unary, Conditional, Break } from 'three/examples/jsm/transpiler/AST.js';

// ─── 前處理 ───
function preprocess(src, defs, keep) {
  // 材質的 defines 照 three 的做法放在最前面當 #define（有值的也要代換，例如 FAR）
  src = Object.entries(defs || {}).map(([k, v]) => `#define ${k} ${v === true ? '' : v}`).join('\n') + '\n' + src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const D = new Set(), out = [], stack = [];
  const on = () => stack.every(s => s.on);
  const evalIf = e => {
    const js = e.replace(/defined\s*\(\s*(\w+)\s*\)/g, (_, n) => D.has(n) ? '1' : '0').replace(/\b[A-Za-z_]\w*\b/g, n => D.has(n) ? '1' : '0');
    try { return !!Function('return (' + js + ')')(); } catch (err) { return false; }
  };
  for (const line of src.split('\n')) {
    const t = line.trim();
    let m;
    if ((m = t.match(/^#\s*ifdef\s+(\w+)/))) { const v = D.has(m[1]); stack.push({ on: v, done: v }); continue; }
    if ((m = t.match(/^#\s*ifndef\s+(\w+)/))) { const v = !D.has(m[1]); stack.push({ on: v, done: v }); continue; }
    if ((m = t.match(/^#\s*if\s+(.*)/))) { const v = evalIf(m[1]); stack.push({ on: v, done: v }); continue; }
    if ((m = t.match(/^#\s*elif\s+(.*)/))) { const s = stack.at(-1); s.on = !s.done && evalIf(m[1]); s.done = s.done || s.on; continue; }
    if (/^#\s*else/.test(t)) { const s = stack.at(-1); s.on = !s.done; s.done = true; continue; }
    if (/^#\s*endif/.test(t)) { stack.pop(); continue; }
    if (!on()) continue;
    if ((m = t.match(/^#\s*define\s+(\w+)(.*)$/))) { D.add(m[1]); if (m[2].trim()) out.push(`#define ${m[1]} ${m[2].trim()}`); continue; }
    if (/^#|^precision\b/.test(t)) continue;
    out.push(line);
  }
  // 有值的 #define：直接換掉（transpiler 不認）；單獨的區塊 { ... } 改成 if (true) { ... }（decoder 不認）
  let s = out.join('\n').replace(/([;{}])(\s*)\{/g, '$1$2if (true) {');
  const vals = [];
  s = s.replace(/^#define (\w+) (.*)$/gm, (_, n, v) => { vals.push([n, v]); return ''; });
  for (const [n, v] of vals) if (!keep.has(n)) s = s.replace(new RegExp('\\b' + n + '\\b', 'g'), '(' + v + ')');   // keep：依畫質等級的常數與材質有值的 defines，留名字、由 E 給值
  return s;
}

// ─── 宣告：uniform／attribute／varying 抽出來，從原始碼拿掉 ───
function decls(src, kw) {
  const list = [];
  src = src.replace(new RegExp('\\b' + kw + '\\s+(?:(?:highp|mediump|lowp|flat)\\s+)*(\\w+)\\s+([^;]+);', 'g'), (_, type, names) => {
    for (let n of names.split(',')) { n = n.trim(); const a = n.match(/^(\w+)\s*\[\s*(\w+)\s*\]$/); list.push(a ? { name: a[1], type, size: /^\d+$/.test(a[2]) ? +a[2] : a[2] } : { name: n, type }); }
    return '';
  });
  return { src, list };
}

// ─── 語法樹 ───
const kids = n => {
  const out = [];
  for (const k in n) {
    if (k === 'parent' || k === 'linker') continue;
    const v = n[k];
    if (Array.isArray(v)) { for (const c of v) if (c && c.isASTNode) out.push(c); } else if (v && v.isASTNode) out.push(v);
  }
  return out;
};
const relink = (n, p = null) => { n.parent = p; for (const c of kids(n)) relink(c, n); };
const hasRet = n => n.isReturn || kids(n).some(hasRet);
const isLoop = n => n.isFor || n.isWhile;
const A = name => new Accessor(name);
const set = (name, v) => new Operator('=', A(name), v);

// 單一出口：return 換成 ret_ = 值、done_ = true（迴圈裡再 break），之後的敘述包進 if (!done_)
function exitBlock(list, ctx) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (s.isReturn) {
      if (s.value && ctx.ret) out.push(set('ret_', s.value));
      out.push(set('done_', A('true')));
      if (ctx.loop) out.push(new Break());
      return out;
    }
    if (!hasRet(s)) { out.push(s); continue; }
    if (s.isConditional) { for (let c = s; c; c = c.elseConditional) c.body = exitBlock(c.body, ctx); }
    else if (isLoop(s)) s.body = exitBlock(s.body, { ...ctx, loop: true });
    else if (s.isSwitch) for (const c of s.cases) c.body = exitBlock(c.body, ctx);
    out.push(s);
    if (isLoop(s) && ctx.loop) out.push(new Conditional(A('done_'), [new Break()]));
    if (i < list.length - 1) {
      const rest = exitBlock(list.slice(i + 1), ctx);
      if (rest.length) out.push(new Conditional(new Unary('!', A('done_')), rest));
    }
    return out;
  }
  return out;
}
function singleExit(fn) {
  const b = fn.body, last = b.length - 1;
  const early = b.some((s, i) => (s.isReturn ? i !== last : hasRet(s)));
  if (!early) return;
  const ret = fn.type !== 'void';
  const body = exitBlock(b, { ret, loop: false });
  fn.body = [new VariableDeclaration('bool', 'done_', new FunctionCall('bool', [A('false')])),
    ...(ret ? [new VariableDeclaration(fn.type, 'ret_', new FunctionCall(fn.type, [new NumberNode('0', fn.type.startsWith('i') ? 'int' : 'float')]))] : []),
    ...body, ...(ret ? [new Return(A('ret_'))] : [])];
}
// 數字常數折疊：-數字 併成負數、數字與數字的四則運算先算好（encoder 會把它們照 JS 原樣輸出，接著 .add() 時優先順序就錯了：- .55.add(x)）
function foldNum(n) {
  for (const k in n) {
    if (k === 'parent' || k === 'linker') continue;
    const v = n[k];
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) if (v[i] && v[i].isASTNode) v[i] = foldNum(v[i]); } else if (v && v.isASTNode) n[k] = foldNum(v);
  }
  const num = x => x && x.isNumber && x.type !== 'int' && x.type !== 'uint';
  if (n.isUnary && n.type === '-' && !n.after && num(n.expression)) return new NumberNode(String(-parseFloat(n.expression.value)), n.expression.type);
  if (n.isOperator && '+-*/'.includes(n.type) && n.type.length === 1 && num(n.left) && num(n.right)) {
    const a = parseFloat(n.left.value), b = parseFloat(n.right.value);
    const r = n.type === '+' ? a + b : n.type === '-' ? a - b : n.type === '*' ? a * b : a / b;
    if (Number.isFinite(r)) { const s = String(r); return new NumberNode(/[.e]/.test(s) ? s : s + '.', 'float'); }
  }
  return n;
}
// 布林字面值當初值：包成 bool()（不然會變成 true.toVar()）
function boolLits(n) {
  if (n.isVariableDeclaration && n.value && n.value.isAccessor && (n.value.property === 'true' || n.value.property === 'false')) n.value = new FunctionCall('bool', [n.value]);
  for (const c of kids(n)) boolLits(c);
}

// WGSL 的 varying、attribute 與內建值是 main 的參數：用到它們（或呼叫了用到它們的函式）的函式不能自成一個 WGSL 函式，不給 layout，內嵌展開
// sampler2DArray：texture(t, vec3)／textureLod(t, vec3, lv) 換成 E 的 texA_／texLA_（TSL 要 .sample(uv).depth(層)）
function arrTex(n, arr) {
  if (n.isFunctionCall && (n.name === 'texture' || n.name === 'textureLod') && n.params[0] && n.params[0].isAccessor && arr.has(n.params[0].property)) n.name = n.name === 'texture' ? 'texA_' : 'texLA_';
  for (const c of kids(n)) arrTex(c, arr);
}
function inlineLocal(ast, local) {
  const fns = new Map(ast.body.filter(n => n.isFunctionDeclaration).map(n => [n.name, n]));
  const refs = new Map();
  for (const [name, fn] of fns) {
    // 函式自己的參數與區域變數不算（sunVis 有個區域變數叫 uv，之前被當成 attribute 的 uv，連帶呼叫它的 shade 也內嵌展開到每個材質）
    const r = new Set(), own = new Set((fn.params || []).map(p => p.name)), walk = n => {
      if (n.isVariableDeclaration) for (let d = n; d; d = d.next) own.add(d.name);
      if (n.isAccessor) r.add(String(n.property).split(/[.[]/)[0]); else if (n.isFunctionCall && typeof n.name === 'string') r.add(n.name);
      for (const c of kids(n)) walk(c);
    };
    for (const s of fn.body) walk(s);
    for (const x of own) r.delete(x);
    refs.set(name, r);
  }
  const bad = new Set();
  for (let changed = true; changed;) {
    changed = false;
    for (const [name, r] of refs) if (!bad.has(name) && [...r].some(x => local.has(x) || bad.has(x))) { bad.add(name); changed = true; }
  }
  for (const name of bad) fns.get(name).layout = false;
  return bad;
}

class Encoder extends TSLEncoder {
  emitVariables(node, isRoot = true) {
    const next = node.next;
    node.next = null;
    if (node.value && !this.atTop) node.needsToVar = true;
    let s = super.emitVariables(node, isRoot);
    node.next = next;
    if (next) s += ', ' + this.emitVariables(next, false);
    return s;
  }
  emitFunction(node) {
    for (const p of node.params) if (p.qualifier === 'out' || p.qualifier === 'inout') p.linker.assignments.length = 0;
    this.atTop = false;
    const s = super.emitFunction(node);
    this.atTop = true;
    return s;
  }
}

// 一個階段的 GLSL → 程式碼字串（帶 main_）。out：'fragOut_' 或 'glPos_'（共用函式庫沒有 main）
// 也回傳最上層宣告的名字（函式與全域變數，tops）與不給 layout 的函式（bad）
function stage(src, out, local, arr) {
  const ast = new GLSLDecoder().parse(src);
  for (const fn of ast.body) {
    if (!fn.isFunctionDeclaration) continue;
    if (fn.name === 'main') {
      fn.name = 'main_'; fn.type = 'vec4'; fn.layout = false;
      fn.body = [new VariableDeclaration('vec4', out, new FunctionCall('vec4', [new NumberNode('0.0')])), ...fn.body];
      const f2 = { type: 'void', body: fn.body }; singleExit(f2); fn.body = f2.body;
      fn.body.push(new Return(A(out)));
    } else singleExit(fn);
  }
  foldNum(ast);
  boolLits(ast);
  arrTex(ast, arr);
  const bad = inlineLocal(ast, local);
  const tops = [];
  for (const n of ast.body) if (n.isFunctionDeclaration) { if (n.name !== 'main_') tops.push(n.name); } else if (n.isVariableDeclaration) for (let d = n; d; d = d.next) tops.push(d.name);
  relink(ast);
  new Linker().process(ast);
  const enc = new Encoder();
  enc.atTop = true;
  let code = enc.emit(ast);
  const imports = (code.match(/import \{([^}]*)\} from 'three\/tsl';/) || ['', ''])[1].split(',').map(s => s.trim()).filter(Boolean);
  code = code.replace(/^\/\/ Three\.js Transpiler.*$/m, '').replace(/^import [^\n]*$/gm, '').replace(/\bexport const\b/g, 'const').replace(/\/\*@__PURE__\*\//g, '');
  const voids = ast.body.filter(fn => fn.isFunctionDeclaration && fn.type === 'void' && fn.name !== 'main_').map(fn => fn.name);
  // 沒有回傳值的函式：three 只在 shaderNode.nodeType 是 'void' 時把「單獨一句的呼叫」放進堆疊，那個型別只有 setLayout 會設，
  // 有 out／inout 參數（encoder 不給 layout）或內嵌展開的函式不補標的話，呼叫整句會被丟掉。補標後它們在每個呼叫處展開，
  // 大的函式要寫成回傳值（texMat、lampGrid、pointLights 回傳 mat3，occlude 回傳 vec2），不然著色器與建節點的量暴增、頁面當掉
  if (voids.length) code += `\nfor (const f_ of [${voids.join(', ')}]) f_.shaderNode.nodeType = 'void';\n`;
  return { code, imports, tops, bad };
}

const fix = s => s.replace(/\bgl_FragColor\b/g, 'fragOut_').replace(/\bgl_Position\b/g, 'glPos_').replace(/\bgl_FragCoord\b/g, 'fragCoord_')
  .replace(/\bgl_FrontFacing\b/g, 'frontFacing_').replace(/\btexture2D\s*\(/g, 'texture(');
// 底線開頭的名字（GLB 的 attribute _pbr／_emi／_win）decoder 不認，會把那一句和後面整個函式吞掉（gl_Position 沒設、整個模型消失）：
// 先換成 lu_ 開頭，attribute 再用原名接（d.src）
const us = s => s.replace(/(?<![\w.])_(?=[A-Za-z])/g, 'lu_');
// 呼叫端 E 一定有的內建值；LOCAL 是 WGSL 裡 main 的參數，用到的函式不給 layout
const BUILTIN = ['position', 'normal', 'uv', 'pGeom_', 'nGeom_', 'modelMatrix', 'viewMatrix', 'projectionMatrix', 'modelViewMatrix', 'normalMatrix', 'cameraPosition', 'fragCoord_', 'frontFacing_', 'color', 'texA_', 'texLA_'];
const LOCAL = ['position', 'normal', 'uv', 'pGeom_', 'nGeom_', 'fragCoord_', 'frontFacing_', 'color', 'main_', 'texA_', 'texLA_'];
// 同名時 E（attribute、uniform、varying、內建值、共用函式庫）優先：transpiler 會把 uv、color 之類當成 TSL 的函式 import 進來，拿到的是沒呼叫的 Fn
const head = (imp, names) => `const { ${imp.filter(n => !names.includes(n)).join(', ')} } = TSL;\nconst { ${names.join(', ')} } = E;\n`;

// ─── 共用函式庫（00-core.js 的 GL_LIB）：開頭是它的著色器拆成「函式庫＋本體」 ───
// 函式庫照它用到的 defines（FAR）各轉一次，make(TSL, E) 回傳它的函式與全域變數；每個材質建節點時各呼叫一次（gAmb 這類全域變數不能跨材質共用），
// 本體從 E 拿。函式庫裡不給 layout 的函式（bad）傳給本體：呼叫它們的本體函式也不能給 layout
const libCache = new Map();
function libTSL(lib, gd, keep) {
  const used = Object.entries(gd).filter(([k]) => new RegExp('\\b' + k + '\\b').test(lib)), kept = [...keep].filter(k => new RegExp('\\b' + k + '\\b').test(lib));
  const key = JSON.stringify(used.map(([k, v]) => [k, keep.has(k) ? '*' : v])) + kept.join();
  let L = libCache.get(key);
  if (L) return L;
  const d = decls(us(preprocess(lib, Object.fromEntries(used), keep)), 'uniform');
  for (const u of d.list) u.src = u.name.replace(/^lu_/, '_');
  const st = stage(fix(d.src), null, new Set(LOCAL), new Set(d.list.filter(u => u.type === 'sampler2DArray').map(u => u.name)));
  const names = [...new Set([...d.list.map(u => u.name), ...BUILTIN, ...kept])];
  const src = head(st.imports, names) + st.code + `\nreturn { ${st.tops.join(', ')} };`;
  L = { key, uniforms: d.list, bad: st.bad, tops: st.tops, defs: lib.split('\n').filter(l => /^\s*#\s*define\b/.test(l)).join('\n'), make: new Function('TSL', 'E', src), src };
  libCache.set(key, L);
  return L;
}

// ─── 對外：材質的 GLSL → 建節點的工廠 ───
// 回傳 { uniforms, attributes, varyings, vertex(TSL, E), fragment(TSL, E), lib, libV, libF, src }：E 是 02-gfx.js 的 gfxAuto 接好的節點（uniform、varying、attribute、內建值），
// libV／libF 為真的階段要先把 lib.make(TSL, E) 的函式併進 E
// keep：留名字不代換的常數（00-core.js 的 GL_TIER 與材質有值的 defines），值由呼叫端的 E 給
// lib：共用函式庫的原文（GL_LIB），著色器以它開頭時拆開轉（見 libTSL）
export function glslTSL(vs, fs, defines, keepV = {}, lib = '') {
  // position／normal 對應的是套過實例矩陣的 positionLocal／normalLocal（GLSL 的 instanceMatrix 乘法拿掉）；要幾何原始座標的著色器寫 GEOM_POS／GEOM_NRM（07-kitx.js 的 vP、vNo）
  const gd = { GEOM_POS: 'pGeom_', GEOM_NRM: 'nGeom_', ...defines };
  const keep = new Set(Object.keys(keepV));
  // 以函式庫開頭（前面只有空白）才拆；前面有別的宣告的照舊整份轉
  const at = s => { const i = lib ? s.indexOf(lib) : -1; return i >= 0 && !s.slice(0, i).trim(); }, inV = at(vs), inF = at(fs);
  const L = inV || inF ? libTSL(lib, gd, keep) : null;
  const cut = (s, inL) => inL ? L.defs + '\n' + s.slice(s.indexOf(lib) + lib.length) : s;
  let v = us(preprocess(cut(vs, inV), gd, keep)), f = us(preprocess(cut(fs, inF), gd, keep));
  const U = new Map(), V = new Map(), AT = new Map();
  for (const kw of ['uniform', 'varying', 'attribute']) {
    const dv = decls(v, kw), df = decls(f, kw);
    v = dv.src; f = df.src;
    for (const d of [...dv.list, ...df.list]) { d.src = d.name.replace(/^lu_/, '_'); (kw === 'uniform' ? U : kw === 'varying' ? V : AT).set(d.name, d); }
  }
  // 頂點：實例矩陣由 three 先套在 positionLocal 上
  v = v.replace(/\(\s*instanceMatrix\s*\*\s*vec4\s*\(\s*0\.?0*\s*,\s*0\.?0*\s*,\s*0\.?0*\s*,\s*1\.?0*\s*\)\s*\)\s*\.xyz/g, '(position - pGeom_)')
    .replace(/mat3\s*\(\s*instanceMatrix\s*\)\s*\*/g, '').replace(/\binstanceMatrix\s*\*/g, '');
  // 貼圖也當成區域的：three 在有 layout 的函式裡取樣時，貼圖的綁定不會宣告到那個 WGSL 函式看得到的地方
  const samp = [...U.values()].filter(d => d.type.startsWith('sampler')), arr = new Set(samp.filter(d => d.type === 'sampler2DArray').map(d => d.name));
  const local = new Set([...V.keys(), ...AT.keys(), ...LOCAL]), libBad = L ? L.bad : new Set();
  const sv = stage(fix(v), 'glPos_', inV ? new Set([...local, ...libBad]) : local, arr), sf = stage(fix(f), 'fragOut_', inF ? new Set([...local, ...libBad]) : local, arr);
  const base = [...U.keys(), ...V.keys(), ...AT.keys(), ...BUILTIN, ...keep];
  // 有函式庫的階段：函式庫的 uniform 與函式也從 E 拿（本體自己宣告了同名的就用本體的）
  const names = (s, inL) => [...new Set([...base, ...(inL ? [...L.uniforms.map(u => u.name), ...L.tops] : [])])].filter(n => !s.tops.includes(n));
  const nv = names(sv, inV), nf = names(sf, inF);
  // src：建節點的函式本體（tools/gen-tsl.mjs 照原樣寫進 src/tsl/）
  const src = { v: head(sv.imports, nv) + sv.code + '\nreturn main_;', f: head(sf.imports, nf) + sf.code + '\nreturn main_;' };
  if (L) for (const u of L.uniforms) if (!U.has(u.name)) U.set(u.name, u);
  return { uniforms: [...U.values()], varyings: [...V.values()], attributes: [...AT.values()], vertex: new Function('TSL', 'E', src.v), fragment: new Function('TSL', 'E', src.f),
    lib: L, libV: inV, libF: inF, src, code: { v: sv.code, f: sf.code } };
}
