// GLSL ES 3.00 著色器。全部在線性空間打光，最後各自做色調映射＋sRGB 編碼（沒有 HDR 緩衝）。

const COMMON = /* glsl */ `
vec3 toLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSrgb(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
// 偏暖的柔肩曲線：暗部保持線性、亮部慢慢收
vec3 tone(vec3 c) {
  c *= 0.82; // 曝光
  vec3 a = c * (2.51 * c + 0.03), b = c * (2.43 * c + 0.59) + 0.14;
  vec3 aces = a / b;
  return mix(c, aces, smoothstep(0.35, 1.4, c));
}
`;

const LIGHT = /* glsl */ `
uniform vec3 uSunDir;   // 指向太陽
uniform vec3 uSunCol;
uniform vec3 uSkyCol;
uniform vec3 uGndCol;
uniform highp sampler2DShadow uShadow;
uniform vec2 uShadowTexel;
float shadowAt(vec4 sp, float ndl) {
  vec3 p = sp.xyz / sp.w * 0.5 + 0.5;
  if (p.x <= 0.0 || p.x >= 1.0 || p.y <= 0.0 || p.y >= 1.0 || p.z >= 1.0) return 1.0;
  float bias = mix(0.0016, 0.0005, clamp(ndl, 0.0, 1.0));
  float z = p.z - bias;
  vec2 o = uShadowTexel * 0.9;
  float s = texture(uShadow, vec3(p.xy + vec2(-o.x, -o.y), z));
  s += texture(uShadow, vec3(p.xy + vec2(o.x, -o.y), z));
  s += texture(uShadow, vec3(p.xy + vec2(-o.x, o.y), z));
  s += texture(uShadow, vec3(p.xy + vec2(o.x, o.y), z));
  return s * 0.25;
}
vec3 hemi(vec3 n) { return mix(uGndCol, uSkyCol, n.y * 0.5 + 0.5); }
`;

export const TERRAIN_VS = /* glsl */ `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec4 aMat;
uniform mat4 uViewProj;
uniform mat4 uLightVP;
out vec3 vWorld;
out vec3 vNrm;
out vec4 vMat;
out vec4 vShadow;
void main() {
  vWorld = aPos;
  vNrm = aNrm;
  vMat = aMat;
  vShadow = uLightVP * vec4(aPos + aNrm * 0.04, 1.0);
  gl_Position = uViewProj * vec4(aPos, 1.0);
}
`;

export const TERRAIN_FS = /* glsl */ `#version 300 es
precision highp float;
${COMMON}
${LIGHT}
in vec3 vWorld;
in vec3 vNrm;
in vec4 vMat;   // r 泥、g 水、b 鬆土、a 內場草
in vec4 vShadow;
uniform sampler2D uAlbedo;
uniform sampler2D uMarks;
uniform sampler2D uNoise;
uniform vec4 uArena;    // originX, originZ, 1/width, 1/depth
uniform vec3 uEdgeCol;  // 場外延伸地面的顏色（線性）
uniform vec3 uEye;
uniform float uTime;
uniform vec4 uPlayer;   // x, z, yaw, alpha
uniform vec3 uPlayerCol;
out vec4 fragColor;

void main() {
  vec2 uv = (vWorld.xz - uArena.xy) * uArena.zw;
  vec3 n = normalize(vNrm);
  vec2 wp = vWorld.xz;
  vec4 nz = texture(uNoise, wp * 0.045);
  vec4 nf = texture(uNoise, wp * 0.31);
  vec4 nh = texture(uNoise, wp * 1.1);

  // 場外：延伸的沙漠地面，越遠越暗，把視線收回場內
  vec2 outside = max(max(-uv, uv - 1.0), 0.0) / uArena.zw;
  float outD = length(outside);
  // 貼圖用 MIRRORED_REPEAT：場外鏡射延伸邊緣的鹼土與植被，再淡到遠處的地色
  vec3 alb = texture(uAlbedo, uv).rgb; // SRGB8_ALPHA8：取樣已是線性
  if (outD > 0.0) {
    vec3 far = uEdgeCol * (0.84 + 0.14 * nz.r) * (0.93 + 0.1 * nf.g);
    // 場外也要有高頻細節：鹼土龜裂的暗細線、零星的灰綠山艾
    float fc = smoothstep(0.03, 0.0, abs(nf.g - 0.5)) + 0.6 * smoothstep(0.025, 0.0, abs(nh.r - 0.5));
    far *= 1.0 - 0.2 * clamp(fc, 0.0, 1.0);
    far *= mix(0.94, 1.05, nh.b);
    float sage = smoothstep(0.8, 0.88, nh.g) * smoothstep(0.35, 0.65, nz.b);
    far = mix(far, vec3(0.19, 0.22, 0.13), sage * 0.55);
    // 鏡射的場邊只保留 1 m 就換成場外地色，土堤的紅色不會被鏡射成一圈模糊的鏽色光暈
    alb = mix(alb, far, smoothstep(0.0, 1.0, outD));
    alb *= mix(1.0, 0.32, smoothstep(0.0, 24.0, outD));
  }

  float mud = vMat.r, water = vMat.g, loose = vMat.b, grass = vMat.a;
  float dirt = clamp(1.0 - mud - water - loose - grass, 0.0, 1.0);

  // 細節：壓實土的細顆粒、鬆土的粗顆粒、草地斑點
  float grain = mix(0.9, 1.08, nf.b) * mix(0.94, 1.05, nh.a);
  float coarse = mix(0.8, 1.16, nh.b) * mix(0.9, 1.08, nf.r);
  float det = dirt * grain + loose * coarse + mud * mix(0.85, 1.1, nf.g) + water + grass * mix(0.72, 1.25, nh.g);
  alb *= det;
  // 乾裂紋：鬆土／場邊出現的暗細線
  float crack = smoothstep(0.035, 0.0, abs(nf.g - 0.5)) * (loose + dirt * 0.25) * (1.0 - water);
  alb *= 1.0 - crack * 0.28;

  // 胎痕（預乘、非 sRGB 上傳）
  vec4 mk = texture(uMarks, uv);
  if (outD <= 0.0 && mk.a > 0.002) {
    vec3 mc = toLin(clamp(mk.rgb / mk.a, 0.0, 1.0));
    alb = alb * (1.0 - mk.a) + mc * mk.a;
  }

  // 泥與水的法線擾動
  vec3 N = n;
  float gloss = 0.0;
  if (mud > 0.01) {
    vec2 d = (vec2(nh.r, nf.a) - 0.5) * 0.35;
    N = normalize(n + vec3(d.x, 0.0, d.y) * mud);
    gloss = mud * (0.35 + 0.4 * nf.b);
  }
  vec2 rip = vec2(0.0);
  if (water > 0.01) {
    vec2 w1 = texture(uNoise, wp * 0.055 + vec2(uTime * 0.012, uTime * 0.007)).rg;
    vec2 w2 = texture(uNoise, wp * 0.09 - vec2(uTime * 0.009, -uTime * 0.014)).gr;
    rip = (w1 + w2 - 1.0);
    N = normalize(mix(N, normalize(vec3(rip.x * 0.5, 1.0, rip.y * 0.5)), water));
    gloss = max(gloss, water);
  }

  float ndl = max(dot(N, uSunDir), 0.0);
  float sh = shadowAt(vShadow, dot(n, uSunDir));
  vec3 V = normalize(uEye - vWorld);
  vec3 col = alb * (uSunCol * ndl * sh + hemi(N));

  // 反射的天空（鏡頭在南方，太陽高光反射不到鏡頭，靠天空漸層與波紋做出濕亮感）
  vec3 R = reflect(-V, N);
  vec3 sky = mix(vec3(0.62, 0.55, 0.44), vec3(0.34, 0.41, 0.46), smoothstep(0.35, 1.0, R.y));
  float fres = 0.06 + 0.94 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
  // 水：混濁灰綠＋波紋反射＋閃光；岸邊是一圈濕暗的泥
  if (water > 0.01) {
    float deep = smoothstep(0.35, 1.0, water);
    vec3 murk = mix(vec3(0.12, 0.11, 0.07), vec3(0.05, 0.068, 0.048), deep);
    vec3 wcol = murk * (uSunCol * 0.45 * max(dot(n, uSunDir), 0.0) * sh + hemi(n));
    float band = rip.x * 1.3 - rip.y * 0.9;
    wcol += sky * (0.06 + fres * 0.4) * clamp(1.0 + band * 1.2, 0.45, 1.7);
    float gl1 = texture(uNoise, wp * 0.45 + vec2(uTime * 0.03, -uTime * 0.022)).r;
    float gl2 = texture(uNoise, wp * 0.21 - vec2(uTime * 0.025, uTime * 0.015)).r;
    float glint = smoothstep(0.54, 0.64, gl1 * gl2) * deep;
    wcol += vec3(0.85, 0.82, 0.7) * glint * 0.22 * sh;
    vec3 shore = alb * 0.45 * (uSunCol * ndl * sh + hemi(n));
    col = mix(col, mix(shore, wcol, smoothstep(0.25, 0.7, water)), smoothstep(0.02, 0.3, water));
  }
  if (mud > 0.01) col += sky * mud * (0.05 + fres * 0.35) * (0.4 + 0.6 * nf.b);
  if (gloss > 0.0) {
    vec3 H = normalize(uSunDir + V);
    float sp = pow(max(dot(N, H), 0.0), mix(24.0, 36.0, water)) * mix(0.6, 0.3, water);
    col += uSunCol * sp * gloss * sh;
  }

  // 玩家標記：地面上的圈＋前方箭頭（跟著地形）
  if (uPlayer.w > 0.0) {
    vec2 d = wp - uPlayer.xy;
    float c = cos(uPlayer.z), s = sin(uPlayer.z);
    vec2 l = vec2(c * d.x + s * d.y, -s * d.x + c * d.y); // x 前、y 右
    float r = length(l);
    float ring = smoothstep(0.11, 0.04, abs(r - 2.05)) * (1.0 - step(1.45, l.x) * step(abs(l.y), 0.85));
    float chev = step(2.25, l.x) * step(l.x, 3.05) * step(abs(l.y), (3.05 - l.x) * 0.95) * (1.0 - step(abs(l.y), (2.75 - l.x) * 0.95) * step(l.x, 2.75));
    float m = max(ring, chev) * uPlayer.w;
    col = mix(col, uPlayerCol * (0.55 + 0.45 * sh) * 1.4, m * 0.9);
  }

  fragColor = vec4(toSrgb(tone(col)), 1.0);
}
`;

export const MESH_VS = /* glsl */ `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec4 aCol;
layout(location=3) in vec4 aM0;
layout(location=4) in vec4 aM1;
layout(location=5) in vec4 aM2;
layout(location=6) in vec4 aM3;
layout(location=7) in vec4 aTint;   // 車色（線性）
layout(location=8) in vec4 aExtra;  // x 濕泥、y 亮度倍率
uniform mat4 uViewProj;
uniform mat4 uLightVP;
out vec3 vWorld;
out vec3 vNrm;
out vec4 vCol;
out vec4 vTint;
out vec4 vExtra;
out vec4 vShadow;
out float vLocalY;
void main() {
  mat4 M = mat4(aM0, aM1, aM2, aM3);
  vec4 w = M * vec4(aPos, 1.0);
  vWorld = w.xyz;
  vNrm = normalize(mat3(M) * aNrm);
  vCol = aCol;
  vTint = aTint;
  vExtra = aExtra;
  vLocalY = aPos.y;
  vShadow = uLightVP * vec4(w.xyz + vNrm * 0.03, 1.0);
  gl_Position = uViewProj * w;
}
`;

export const MESH_FS = /* glsl */ `#version 300 es
precision highp float;
${COMMON}
${LIGHT}
in vec3 vWorld;
in vec3 vNrm;
in vec4 vCol;
in vec4 vTint;
in vec4 vExtra;
in vec4 vShadow;
in float vLocalY;
uniform vec3 uEye;
out vec4 fragColor;
void main() {
  vec3 base = toLin(vCol.rgb);
  float a = vCol.a;
  float paint = 1.0 - step(0.25, a);             // a = 0：車隊塗裝
  float glass = step(0.25, a) * (1.0 - step(0.75, a)); // a = 128：玻璃／燈
  if (paint > 0.5) {
    float lum = dot(base, vec3(0.2126, 0.7152, 0.0722));
    base = vTint.rgb * clamp(lum * 1.15, 0.0, 1.6);
  }
  // 沾泥：下半部先變髒
  float wet = vExtra.x * smoothstep(1.4, -0.2, vLocalY) ;
  base = mix(base, vec3(0.055, 0.032, 0.018), wet * 0.75);

  vec3 N = normalize(vNrm) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 V = normalize(uEye - vWorld);
  float ndl = max(dot(N, uSunDir), 0.0);
  float sh = shadowAt(vShadow, ndl);
  vec3 col = base * (uSunCol * ndl * sh + hemi(N) * 1.1);
  vec3 H = normalize(uSunDir + V);
  float specK = paint * (1.0 - wet) * 0.5 + glass * 0.9 + 0.04;
  col += uSunCol * pow(max(dot(N, H), 0.0), mix(18.0, 90.0, paint + glass)) * specK * sh;
  // 邊緣補光：車身在土色地面上比較跳
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += uSkyCol * rim * 0.22 * (0.4 + paint);
  col += base * glass * 0.45;
  col *= vExtra.y;
  fragColor = vec4(toSrgb(tone(col)), 1.0);
}
`;

// 陰影圖：地形與網格共用（地形用單位矩陣實例）
export const DEPTH_VS = /* glsl */ `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=3) in vec4 aM0;
layout(location=4) in vec4 aM1;
layout(location=5) in vec4 aM2;
layout(location=6) in vec4 aM3;
uniform mat4 uLightVP;
uniform float uInstanced;
void main() {
  mat4 M = uInstanced > 0.5 ? mat4(aM0, aM1, aM2, aM3) : mat4(1.0);
  gl_Position = uLightVP * (M * vec4(aPos, 1.0));
}
`;

export const DEPTH_FS = /* glsl */ `#version 300 es
precision mediump float;
void main() {}
`;

export const PART_VS = /* glsl */ `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aP;   // x y z size
layout(location=2) in vec4 aC;   // 預乘色
layout(location=3) in vec4 aK;   // kind rot f 0
uniform mat4 uViewProj;
uniform vec3 uRight;
uniform vec3 uUp;
out vec2 vUv;
out vec4 vC;
out float vKind;
out float vF;
out vec2 vSeed;
void main() {
  float c = cos(aK.y), s = sin(aK.y);
  vec2 q = vec2(c * aCorner.x - s * aCorner.y, s * aCorner.x + c * aCorner.y);
  vec3 w;
  if (aK.x > 1.5 && aK.x < 2.5) {
    w = aP.xyz + vec3(aCorner.x, 0.0, aCorner.y) * aP.w; // 水圈平貼地面
  } else {
    w = aP.xyz + (uRight * q.x + uUp * q.y) * aP.w * 0.5;
  }
  vUv = aCorner;
  vC = aC;
  vKind = aK.x;
  vF = aK.z;
  vSeed = fract(aP.xz * 0.37 + aK.y * 0.1);
  gl_Position = uViewProj * vec4(w, 1.0);
}
`;

export const PART_FS = /* glsl */ `#version 300 es
precision highp float;
${COMMON}
in vec2 vUv;
in vec4 vC;
in float vKind;
in float vF;
in vec2 vSeed;
uniform sampler2D uNoise;
out vec4 fragColor;
void main() {
  float r = length(vUv);
  float m;
  vec3 shade = vec3(1.0);
  if (vKind < 0.5) {         // 揚塵：有雜訊邊的軟團
    float n = texture(uNoise, vUv * 0.35 + vSeed).g;
    m = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.7);
    shade = vec3(mix(0.78, 1.08, vUv.y * 0.5 + 0.5));
  } else if (vKind < 1.5) {  // 泥塊／水滴：硬邊小球
    m = smoothstep(1.0, 0.82, r);
    vec3 sn = vec3(vUv, sqrt(max(0.0, 1.0 - r * r)));
    shade = vec3(0.55 + 0.6 * max(dot(sn, normalize(vec3(-0.5, 0.6, 0.6))), 0.0));
  } else if (vKind < 2.5) {  // 水圈
    m = smoothstep(0.14, 0.02, abs(r - 0.86)) * step(r, 1.0);
  } else if (vKind < 3.5) {  // 火焰（加法）
    m = pow(max(1.0 - r, 0.0), 1.6);
  } else {                   // 火花（加法）
    m = pow(max(1.0 - r, 0.0), 3.0);
  }
  if (m <= 0.003) discard;
  vec3 rgb = vC.rgb * shade;
  if (vC.a > 0.0) {
    // 半透明：先反預乘做色調映射再乘回
    vec3 c = toSrgb(tone(rgb / vC.a));
    fragColor = vec4(c * vC.a * m, vC.a * m);
  } else {
    fragColor = vec4(toSrgb(tone(rgb)) * m, 0.0);
  }
}
`;
