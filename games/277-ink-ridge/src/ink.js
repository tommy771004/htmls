// 水墨材質：MeshToonMaterial（冷暖三階色調）＋ onBeforeCompile 注入宣紙紋、潑墨水洗、披麻／斧劈乾筆皴擦、
// 岩頂積墨垂流（含水線墨暈邊）、分叉岩裂紋與錯縫石板地面。
import * as THREE from 'three';

export const PAL = {
  paper: 0xe4d6b8, paperHi: 0xd6c29c, stone: 0xb9b4a7, stoneTop: 0xcfc8b6, ink: 0x16171c,
  vermilion: 0xa63a2d, wood: 0x6e5c47, woodDark: 0x483b2f, robe: 0x2e3240, robeLow: 0x363a48,
  sash: 0x8c2a24, scarf: 0xebe2ce, straw: 0xc9ae78, skin: 0xbf987a, pine: 0x222a25, bronze: 0x2c2b29,
  pants: 0x3a3c44, wrap: 0x8e887d,
};

let grad = null;
export function toonGradient() {
  if (grad) return grad;
  // 64 階平滑過渡的三階水墨色階：暗部偏冷黛藍灰、中調沉穩暖灰、亮部偏宣紙暖白，消除 NearestFilter 的鋸齒多邊形邊界
  const W = 64, d = new Uint8Array(W * 4);
  const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;
  for (let i = 0; i < W; i++) {
    const u = i / (W - 1);
    const k1 = sstep(0.28, 0.36, u);
    const k2 = sstep(0.60, 0.70, u);
    const k3 = sstep(0.88, 0.96, u);
    let r = mix(96, 182, k1), g = mix(103, 180, k1), b = mix(116, 175, k1);
    r = mix(r, 238, k2); g = mix(g, 234, k2); b = mix(b, 226, k2);
    r = mix(r, 255, k3); g = mix(g, 252, k3); b = mix(b, 245, k3);
    d[i * 4] = Math.round(r); d[i * 4 + 1] = Math.round(g); d[i * 4 + 2] = Math.round(b); d[i * 4 + 3] = 255;
  }
  grad = new THREE.DataTexture(d, W, 1, THREE.RGBAFormat);
  grad.minFilter = grad.magFilter = THREE.LinearFilter;
  grad.wrapS = grad.wrapT = THREE.ClampToEdgeWrapping;
  grad.generateMipmaps = false;
  grad.needsUpdate = true;
  return grad;
}

export const NOISE_GLSL = /* glsl */`
float inkH(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float inkN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(inkH(i), inkH(i + vec2(1, 0)), f.x), mix(inkH(i + vec2(0, 1)), inkH(i + vec2(1, 1)), f.x), f.y); }
float inkF(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * inkN(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;

const shared = { uTime: { value: 0 } };
export const inkUniforms = shared;

/**
 * opts: color, streak(0..1 垂直墨痕／乾筆皴), drip(墨流長度 m，需要 aTop), crack(0..1), wash(0..1 大塊水洗), grain(0..1),
 *       topLight(頂面提亮), side(THREE.Side), vertexColors
 */
const inkCache = new Map();
export function inkMaterial(opts = {}) {
  if (opts.map) return makeInk(opts);
  const key = JSON.stringify(opts);
  if (!inkCache.has(key)) inkCache.set(key, makeInk(opts));
  return inkCache.get(key);
}
function makeInk(opts) {
  const m = new THREE.MeshToonMaterial({
    color: opts.color ?? PAL.stone, gradientMap: toonGradient(), side: opts.side ?? THREE.FrontSide,
    vertexColors: !!opts.vertexColors, transparent: !!opts.transparent, opacity: opts.opacity ?? 1,
    map: opts.map ?? null, normalMap: opts.normalMap ?? null, alphaTest: opts.alphaTest ?? 0,
  });
  const u = {
    uStreak: { value: opts.streak ?? 0 }, uDrip: { value: opts.drip ?? 0 }, uCrack: { value: opts.crack ?? 0 },
    uWash: { value: opts.wash ?? 0.6 }, uGrain: { value: opts.grain ?? 0.6 }, uTopLight: { value: opts.topLight ?? 0 }, uDesat: { value: opts.desat ?? 0 }, uSnow: { value: opts.snow ?? 0 },
    uSway: { value: opts.sway ?? 0 }, uRim: { value: opts.rim ?? 0 },
    uInk: { value: new THREE.Color(PAL.ink) },
  };
  const hasTop = !!opts.drip, hasSway = !!opts.sway;
  if (hasSway) m.userData.hasSway = true;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u, shared);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vInkW; varying vec3 vInkN;${hasTop ? '\nattribute float aTop; varying float vTop;' : ''}${hasSway ? '\nattribute float aSway;\nuniform float uSway, uTime;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>${hasSway ? `
  if (uSway > 0.0) {
    vec4 swp = modelMatrix * vec4(transformed, 1.0);
    float ph = uTime * 2.15 + swp.x * 0.7 + swp.z * 0.55 + swp.y * 0.3;
    float gust = sin(ph) * 0.68 + sin(ph * 2.3 + 1.4) * 0.32;
    transformed.x += gust * aSway * uSway;
    transformed.z += cos(ph * 0.85 + 0.9) * aSway * uSway * 0.65;
  }` : ''}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
  { vec4 iw = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    iw = instanceMatrix * iw;
  #endif
    vInkW = (modelMatrix * iw).xyz;
    vec3 inrm = objectNormal;
  #ifdef USE_INSTANCING
    inrm = mat3(instanceMatrix) * inrm;
  #endif
    vInkN = normalize(mat3(modelMatrix) * inrm); }${hasTop ? '\n  vTop = aTop;' : ''}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vInkW; varying vec3 vInkN;${hasTop ? ' varying float vTop;' : ''}
uniform float uStreak, uDrip, uCrack, uWash, uGrain, uTopLight, uTime, uDesat, uSnow, uRim; uniform vec3 uInk;
${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  { float il = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(il) * vec3(1.04, 1.0, 0.92), uDesat); }
  float inkSnow = 0.0;
  if (uSnow > 0.0) {
    vec3 sn = normalize(vInkN);
    float pn = inkF(vInkW.xz * 0.65 + 9.0);
    float detail = (inkN(vInkW.xz * 3.8) - 0.5) * 0.16;
    inkSnow = smoothstep(0.33, 0.66, sn.y + (pn - 0.5) * 0.42 + detail);${hasTop ? `
    // 雪從岩頂垂過邊緣，下緣呈自然積雪厚唇與水墨陰影邊
    float eu = abs(sn.x) > abs(sn.z) ? vInkW.z : vInkW.x;
    float over = 0.14 + 0.36 * inkF(vec2(eu * 1.05, 2.0)) + 0.08 * inkN(vec2(eu * 4.2, 5.1));
    float lip = 1.0 - smoothstep(over * 0.72, over, vTop - vInkW.y);
    inkSnow = max(inkSnow, lip * step(-0.03, vTop - vInkW.y));` : ''}
    inkSnow *= uSnow;
    vec3 snowTint = mix(vec3(0.88, 0.91, 0.95), vec3(0.95, 0.96, 0.98), pn);
    diffuseColor.rgb = mix(diffuseColor.rgb, snowTint, inkSnow);
  }`)
      .replace('#include <opaque_fragment>', `
  {
    vec3 n = normalize(vInkN);
    float vert = 1.0 - smoothstep(0.32, 0.76, abs(n.y));
    float up = smoothstep(0.58, 0.94, n.y);
    float under = smoothstep(-0.15, -0.75, n.y);
    float u = abs(n.x) > abs(n.z) ? vInkW.z : vInkW.x;
    vec2 sp = mix(vInkW.xz, vec2(u, vInkW.y), vert);

    // 潑墨底洗（domain-warped 水墨濃淡區塊）
    float warp = inkN(sp * 0.38 + 6.1) * 0.9;
    float wash = inkF(sp * 0.21 + vec2(warp * 0.45, 3.7 - warp * 0.3));
    float wash2 = inkF(sp * 0.68 + 14.2);
    outgoingLight *= mix(1.0, mix(0.76, 1.09, wash * 0.72 + wash2 * 0.28), uWash);
    // 宣紙粗細肌理與飛白顆粒
    float paperGrain = (inkF(sp * 3.4) - 0.5) * 0.14 + (inkN(sp * 14.5) - 0.5) * 0.08;
    outgoingLight *= 1.0 + uGrain * paperGrain;
    outgoingLight *= 1.0 + uTopLight * up * 0.15;
    // 岩底／懸挑下側自然積墨壓暗
    outgoingLight *= 1.0 - under * 0.34;
    if (uRim > 0.001) {
      float fr = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
      outgoingLight += vec3(0.28, 0.26, 0.21) * pow(fr, 2.8) * uRim;
    }

    float kS = 1.0 - inkSnow * 0.88;
    if (uStreak > 0.001) {
      // 披麻皴＋乾筆飛白：長條皴擦內含細密筆毫分叉
      float bend = (inkN(vec2(u * 0.55, vInkW.y * 0.22 + 4.0)) - 0.5) * 0.65;
      float st = inkF(vec2((u + bend) * 2.1, vInkW.y * 0.10 + u * 0.04));
      float bristle = inkN(vec2((u + bend * 0.5) * 16.0, vInkW.y * 0.62));
      float dryBrush = smoothstep(0.44, 0.74, st) * (0.48 + 0.52 * smoothstep(0.28, 0.78, bristle));
      float fine = smoothstep(0.60, 0.84, inkN(vec2(u * 8.5, vInkW.y * 0.42))) * 0.65;
      // 斧劈側鋒折面暗痕（利用水平法線轉折強化山石稜面）
      float facet = smoothstep(0.56, 0.78, inkF(vec2(u * 1.15 - vInkW.y * 0.22, vInkW.y * 0.28 + 9.3)));
      float cun = (dryBrush * 0.72 + fine * 0.35 + facet * 0.28) * vert * uStreak * kS;
      outgoingLight = mix(outgoingLight, outgoingLight * 0.34 + uInk * 0.18, clamp(cun, 0.0, 0.85));

      // 濃墨積染斑塊＋外圈「水線」墨暈邊（模擬墨水在宣紙邊緣乾涸沉積）
      float blotRaw = inkF(sp * 0.17 + vec2(21.0, warp * 0.35));
      float blot = smoothstep(0.59, 0.74, blotRaw) * vert * uStreak * kS;
      float waterRim = (smoothstep(0.56, 0.61, blotRaw) - smoothstep(0.61, 0.68, blotRaw)) * vert * uStreak * kS;
      outgoingLight = mix(outgoingLight, uInk * 1.85, blot * 0.58 + waterRim * 0.32);
    }

    ${hasTop ? `
    // 岩頂沿口濕墨壓邊＋長短參差的垂流墨跡
    float depth = vTop - vInkW.y;
    if (depth > -0.03 && depth < 4.5) {
      float col = inkF(vec2(u * 1.45, 3.3));
      float col2 = inkN(vec2(u * 4.8, 11.7));
      float len = 0.18 + uDrip * (0.25 + col * col * 1.55 + col2 * 0.35);
      float streakMask = smoothstep(0.28, 0.62, inkN(vec2(u * 6.2, 7.1 + depth * 0.18)) + 0.48 * (1.0 - depth / max(len, 0.2)));
      float body = (1.0 - smoothstep(len * 0.62, len, depth)) * step(-0.02, depth) * streakMask * vert;
      float topLip = (1.0 - smoothstep(0.0, 0.16 + 0.14 * col2, depth)) * step(-0.01, depth) * vert;
      float dripRim = (smoothstep(len * 0.55, len * 0.78, depth) - smoothstep(len * 0.78, len, depth)) * streakMask * vert;
      float dripAll = clamp(body * 0.82 + topLip * 0.65 + dripRim * 0.35, 0.0, 1.0) * kS;
      outgoingLight = mix(outgoingLight, uInk * 1.35, dripAll);
    }` : ''}

    if (uCrack > 0.001) {
      // 壁面：主裂隙＋細分叉節理（寬窄隨雜訊收放，尾端尖細）
      float crWarp = (inkN(vec2(u * 1.7, vInkW.y * 0.9)) - 0.5) * 0.09;
      float cr = inkF(vec2(u * 0.92 + crWarp, vInkW.y * 0.31) + 11.0);
      float crMask = smoothstep(0.50, 0.70, inkN(vec2(u * 0.38, vInkW.y * 0.32)));
      float crW = 0.011 + 0.012 * crMask;
      float crk = (1.0 - smoothstep(0.0, crW, abs(cr - 0.5))) * crMask * vert;
      float cr2 = inkN(vec2(u * 2.6 - vInkW.y * 0.45, vInkW.y * 1.1 + 5.4));
      float crk2 = (1.0 - smoothstep(0.0, 0.014, abs(cr2 - 0.5))) * smoothstep(0.62, 0.78, inkN(sp * 0.7 + 2.0)) * vert * 0.55;

      // 頂面：錯縫石板地面（每塊石板獨立濃淡色差＋手鑿抖動灰縫＋局部冰裂細紋＋苔點墨星）
      vec2 wobble = (vec2(inkN(vInkW.xz * 1.15), inkN(vInkW.xz * 1.15 + 5.3)) - 0.5) * 0.16;
      vec2 grid = vInkW.xz / vec2(2.05, 1.42) + wobble;
      float row = floor(grid.y);
      vec2 cellUv = vec2(grid.x + mod(row, 2.0) * 0.5, grid.y);
      vec2 tileId = floor(cellUv);
      vec2 tf = abs(fract(cellUv) - 0.5);
      float tileShade = (inkH(tileId) - 0.5) * 0.11 * up * uCrack * kS;
      outgoingLight *= 1.0 + tileShade;

      float edgeDist = 0.5 - max(tf.x, tf.y);
      float seamMask = smoothstep(0.22, 0.52, inkN(vInkW.xz * 0.42 + 3.0));
      float seam = (1.0 - smoothstep(0.0, 0.026, edgeDist)) * up * seamMask;
      float bevel = (1.0 - smoothstep(0.02, 0.09, edgeDist)) * up * seamMask * 0.22;
      float tileCrack = (1.0 - smoothstep(0.0, 0.015, abs(inkN(vInkW.xz * 1.8 + tileId * 3.1) - 0.5))) * step(0.68, inkH(tileId + 7.7)) * up * 0.42;
      float speck = smoothstep(0.86, 0.93, inkN(vInkW.xz * 9.5)) * up * 0.35;

      float allCrack = clamp((crk * 0.88 + crk2 + seam * 0.68 + bevel + tileCrack + speck * 0.4) * uCrack * kS, 0.0, 0.92);
      outgoingLight = mix(outgoingLight, uInk * 1.25, allCrack);
    }
  }
  #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `ink2${hasTop ? 'T' : ''}${hasSway ? 'S' : ''}`;
  return m;
}

// 描線外殼：沿法線外推、只畫背面（不投射陰影，避免自陰影條紋）
const olCache = new Map();
export function outlineMaterial(width = 0.012, color = PAL.ink) {
  const key = width + ':' + color;
  if (!olCache.has(key)) olCache.set(key, makeOutline(width, color));
  return olCache.get(key);
}
function makeOutline(width, color) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uW = { value: width };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * uW;');
  };
  m.customProgramCacheKey = () => 'outline' + width;
  return m;
}

// 岩縫下方的濃墨垂流（1024×512 高解析度：上緣濃墨積染＋粗細垂流＋乾筆飛白＋墨滴飛濺）
let dripTex = null;
export function dripTexture() {
  if (dripTex) return dripTex;
  const W = 1024, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);

  // 頂部岩唇下的濃墨暈染帶
  const topGr = g.createLinearGradient(0, 0, 0, 96);
  topGr.addColorStop(0, 'rgba(255,255,255,0.98)');
  topGr.addColorStop(0.36, 'rgba(255,255,255,0.72)');
  topGr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = topGr;
  g.beginPath(); g.moveTo(0, 0);
  for (let x = 0; x <= W; x += 16) g.lineTo(x, 34 + rnd() * 54);
  g.lineTo(W, 0); g.closePath(); g.fill();

  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, 24);

  // 大塊波浪積墨團（參考影片攀崖幀岩縫下成片濃墨）
  for (let i = 0; i < 18; i++) {
    const cx = rnd() * W, bw = 48 + rnd() * 110, bh = 55 + Math.pow(rnd(), 1.3) * 160;
    const gr = g.createLinearGradient(0, 0, 0, bh);
    gr.addColorStop(0, `rgba(255,255,255,${(0.75 + rnd() * 0.25).toFixed(2)})`);
    gr.addColorStop(0.75, `rgba(255,255,255,${(0.45 + rnd() * 0.35).toFixed(2)})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(cx - bw * 0.5, 0);
    g.bezierCurveTo(cx - bw * 0.45, bh * 0.65, cx - bw * 0.2, bh, cx + (rnd() - 0.5) * 18, bh);
    g.bezierCurveTo(cx + bw * 0.22, bh, cx + bw * 0.45, bh * 0.6, cx + bw * 0.5, 0);
    g.closePath(); g.fill();
  }

  // 長短交錯的垂直墨流與尾端水滴
  for (let x = -12; x < W + 12; x += 7 + rnd() * 15) {
    const w = 6 + Math.pow(rnd(), 1.4) * 38;
    const L = 56 + Math.pow(rnd(), 1.55) * 420;
    const drift = (rnd() - 0.5) * 18;
    const alpha = 0.55 + rnd() * 0.45;
    const gr = g.createLinearGradient(0, 0, 0, L);
    gr.addColorStop(0, `rgba(255,255,255,${alpha.toFixed(2)})`);
    gr.addColorStop(0.78, `rgba(255,255,255,${(alpha * 0.82).toFixed(2)})`);
    gr.addColorStop(0.94, `rgba(255,255,255,${(alpha * 0.5).toFixed(2)})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + w * 0.12, L * 0.42, x + w * 0.32 + drift * 0.5, L * 0.82, x + w * 0.48 + drift, L);
    g.bezierCurveTo(x + w * 0.64 + drift, L * 0.82, x + w * 0.88 + drift * 0.4, L * 0.42, x + w, 0);
    g.closePath(); g.fill();

    // 尾端懸珠與飛白墨點
    if (rnd() < 0.48 && L < H - 24) {
      g.fillStyle = `rgba(255,255,255,${(0.5 + rnd() * 0.45).toFixed(2)})`;
      const tx = x + w * 0.48 + drift, ty = L + 5 + rnd() * 16, tr = 2.2 + rnd() * 4.5;
      g.beginPath(); g.ellipse(tx, ty, tr * 0.78, tr * 1.25, 0, 0, Math.PI * 2); g.fill();
      if (rnd() < 0.4) { g.beginPath(); g.arc(tx + (rnd() - 0.5) * 6, ty + tr * 2.1 + rnd() * 8, 1.2 + rnd() * 2.2, 0, Math.PI * 2); g.fill(); }
    }
  }
  dripTex = new THREE.CanvasTexture(c);
  dripTex.wrapS = THREE.RepeatWrapping;
  return dripTex;
}
export function dripMaterial() {
  return new THREE.MeshBasicMaterial({
    color: 0x14151a, alphaMap: dripTexture(), transparent: true, depthWrite: false, opacity: 0.95,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide,
  });
}

// 衣襬：細織紋＋直向水墨舊痕，下緣不規則撕裂破損
export function ragTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  let s = 91; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const bg = g.createLinearGradient(0, 0, 0, 256);
  bg.addColorStop(0, '#383d4c'); bg.addColorStop(0.68, '#303443'); bg.addColorStop(1, '#1f222c');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 130; i++) {
    const x = rnd() * 512, w = 1.5 + rnd() * 14;
    g.fillStyle = rnd() < 0.6 ? `rgba(10,11,16,${0.08 + rnd() * 0.28})` : `rgba(138,142,158,${0.04 + rnd() * 0.09})`;
    g.fillRect(x, 0, w, 256);
  }
  for (let y = 0; y < 256; y += 3) {
    g.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.035)';
    g.fillRect(0, y, 512, 1);
  }
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.moveTo(0, 256);
  let x = 0;
  while (x < 512) {
    const h = 14 + rnd() * 36, nx = x + 6 + rnd() * 20;
    g.lineTo(x + (nx - x) * 0.5, 256 - h); g.lineTo(nx, 256 - 5 - rnd() * 11);
    x = nx;
  }
  g.lineTo(512, 256); g.closePath(); g.fill();
  for (let i = 0; i < 12; i++) {
    const cx = rnd() * 512, h = 42 + rnd() * 74, w = 2.5 + rnd() * 7;
    g.beginPath(); g.moveTo(cx - w, 256); g.lineTo(cx + (rnd() - 0.5) * 7, 256 - h); g.lineTo(cx + w, 256); g.closePath(); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
  return t;
}

// 圍巾：素麻經緯布紋＋尾端淡墨渲染與流蘇破損（alphaTest 裁出自然鬚邊）
let scarfTex = null;
export function scarfTexture() {
  if (scarfTex) return scarfTex;
  const W = 256, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  let s = 313; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#efe6d2');
  gr.addColorStop(0.65, '#e6dbc3');
  gr.addColorStop(0.88, '#cfc3aa');
  gr.addColorStop(1, '#9d927e');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // 兩側織邊暗線與中央微摺痕
  g.fillStyle = 'rgba(60,52,42,0.22)';
  g.fillRect(0, 0, 7, H); g.fillRect(W - 7, 0, 7, H);
  g.fillStyle = 'rgba(90,80,66,0.10)';
  g.fillRect(14, 0, 2, H); g.fillRect(W - 16, 0, 2, H);
  for (let x = 0; x < W; x += 4) {
    g.fillStyle = x % 8 === 0 ? 'rgba(255,252,244,0.08)' : 'rgba(65,58,48,0.05)';
    g.fillRect(x, 0, 1.5, H);
  }
  for (let y = 0; y < H; y += 5) {
    g.fillStyle = 'rgba(65,58,48,0.035)';
    g.fillRect(0, y, W, 1);
  }
  // 尾端風塵水墨漬
  for (let i = 0; i < 28; i++) {
    const x = rnd() * W, y = H * (0.55 + rnd() * 0.42), r = 6 + rnd() * 26;
    const rg = g.createRadialGradient(x, y, 1, x, y, r);
    rg.addColorStop(0, `rgba(34,32,36,${(0.08 + rnd() * 0.18).toFixed(2)})`);
    rg.addColorStop(1, 'rgba(34,32,36,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // 尾端破損鬚邊
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.moveTo(0, H);
  let x = 0;
  while (x < W) {
    const h = 10 + rnd() * 38, nx = x + 5 + rnd() * 11;
    g.lineTo(x + (nx - x) * 0.5, H - h);
    g.lineTo(nx, H - 3 - rnd() * 9);
    x = nx;
  }
  g.lineTo(W, H); g.closePath(); g.fill();
  g.globalCompositeOperation = 'source-over';
  scarfTex = new THREE.CanvasTexture(c);
  scarfTex.colorSpace = THREE.SRGBColorSpace;
  return scarfTex;
}

// 斗笠的竹篾放射編織紋（512×512 交錯竹紋＋壓圈竹箍）
export function strawTexture() {
  const S = 512;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(256, 256, 12, 256, 256, 256);
  rg.addColorStop(0, '#b89b66'); rg.addColorStop(0.35, '#d5bc87'); rg.addColorStop(0.82, '#cbb07a'); rg.addColorStop(1, '#9f8452');
  g.fillStyle = rg; g.fillRect(0, 0, S, S);
  // 同心細竹篾圈
  for (let r = 14; r < 252; r += 5) {
    g.strokeStyle = r % 10 === 0 ? 'rgba(72,54,30,0.28)' : 'rgba(255,244,218,0.14)';
    g.lineWidth = 2.2;
    g.beginPath(); g.arc(256, 256, r, 0, Math.PI * 2); g.stroke();
  }
  // 放射竹骨
  g.save(); g.translate(256, 256);
  const N = 144;
  for (let i = 0; i < N; i++) {
    g.rotate((Math.PI * 2) / N);
    g.strokeStyle = i % 4 === 0 ? 'rgba(58,42,24,0.48)' : 'rgba(88,68,38,0.22)';
    g.lineWidth = i % 4 === 0 ? 2.2 : 1.1;
    g.beginPath(); g.moveTo(0, 8); g.lineTo(0, 254); g.stroke();
  }
  g.restore();
  for (const r of [42, 96, 156, 214, 246]) {
    g.strokeStyle = 'rgba(52,38,22,0.58)'; g.lineWidth = 3.5;
    g.beginPath(); g.arc(256, 256, r, 0, Math.PI * 2); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 拔刀橫斬的水墨刀氣貼圖（半月乾筆飛白弧光）
let slashTex = null;
export function slashTexture() {
  if (slashTex) return slashTex;
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.translate(128, 128);
  for (let i = 0; i < 9; i++) {
    const r = 82 + i * 3.5;
    g.strokeStyle = i < 3 ? `rgba(248,242,226,${0.55 - i * 0.12})` : `rgba(22,23,28,${0.65 - (i - 3) * 0.09})`;
    g.lineWidth = 5 - i * 0.4;
    g.beginPath(); g.arc(0, 0, r, -Math.PI * 0.68, Math.PI * 0.42 - i * 0.04); g.stroke();
  }
  slashTex = new THREE.CanvasTexture(c);
  slashTex.colorSpace = THREE.SRGBColorSpace;
  return slashTex;
}
