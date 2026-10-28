// 共用 GLSL：3D 值雜訊與 fbm（地面斑駁、筆刷條紋、天空雲都用這一組）
export const NOISE = /* glsl */ `
float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h13(i), h13(i + vec3(1,0,0)), f.x), mix(h13(i + vec3(0,1,0)), h13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h13(i + vec3(0,0,1)), h13(i + vec3(1,0,1)), f.x), mix(h13(i + vec3(0,1,1)), h13(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p, int oct, float rough){
  float a = 0.5, s = 0.0, n = 0.0;
  for (int k = 0; k < 8; k++){ if (k >= oct) break; s += a * vnoise(p); n += a; p = p * 2.03 + 17.1; a *= rough; }
  return s / n;
}
`;

// Blender 的 Noise Texture（3D、fBM、normalize）逐行移植：Jenkins lookup3 雜湊＋Perlin 梯度雜訊＋distortion。
// 天空用這個，雲的形狀才會和 blender/kit_sky.py 渲染的參考圖是同一套（需要 WebGL2 的 uint）。
export const BNOISE = /* glsl */ `
#define BROT(x, k) (((x) << (k)) | ((x) >> (32u - (k))))
#define BFINAL(a, b, c) { c ^= b; c -= BROT(b, 14u); a ^= c; a -= BROT(c, 11u); b ^= a; b -= BROT(a, 25u); c ^= b; c -= BROT(b, 16u); a ^= c; a -= BROT(c, 4u); b ^= a; b -= BROT(a, 14u); c ^= b; c -= BROT(b, 24u); }
uint bhash3(uint kx, uint ky, uint kz){ uint a, b, c; a = b = c = 0xdeadbeefu + (3u << 2u) + 13u; c += kz; b += ky; a += kx; BFINAL(a, b, c); return c; }
uint bhash2(uint kx, uint ky){ uint a, b, c; a = b = c = 0xdeadbeefu + (2u << 2u) + 13u; b += ky; a += kx; BFINAL(a, b, c); return c; }
float bh2f(float x, float y){ return float(bhash2(floatBitsToUint(x), floatBitsToUint(y))) / float(0xFFFFFFFFu); }
vec3 boffset(float s){ return vec3(100.0 + bh2f(s, 0.0) * 100.0, 100.0 + bh2f(s, 1.0) * 100.0, 100.0 + bh2f(s, 2.0) * 100.0); }
float bgrad(uint h, float x, float y, float z){
  h &= 15u; float u = h < 8u ? x : y; float vt = (h == 12u || h == 14u) ? x : z; float v = h < 4u ? y : vt;
  return ((h & 1u) != 0u ? -u : u) + ((h & 2u) != 0u ? -v : v);
}
float bfade(float t){ return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
float bperlin(vec3 p){
  vec3 fl = floor(p), f = p - fl; ivec3 i = ivec3(fl);
  uint X = uint(i.x), Y = uint(i.y), Z = uint(i.z);
  float u = bfade(f.x), v = bfade(f.y), w = bfade(f.z), u1 = 1.0 - u, v1 = 1.0 - v, w1 = 1.0 - w;
  float g0 = bgrad(bhash3(X, Y, Z), f.x, f.y, f.z), g1 = bgrad(bhash3(X + 1u, Y, Z), f.x - 1.0, f.y, f.z);
  float g2 = bgrad(bhash3(X, Y + 1u, Z), f.x, f.y - 1.0, f.z), g3 = bgrad(bhash3(X + 1u, Y + 1u, Z), f.x - 1.0, f.y - 1.0, f.z);
  float g4 = bgrad(bhash3(X, Y, Z + 1u), f.x, f.y, f.z - 1.0), g5 = bgrad(bhash3(X + 1u, Y, Z + 1u), f.x - 1.0, f.y, f.z - 1.0);
  float g6 = bgrad(bhash3(X, Y + 1u, Z + 1u), f.x, f.y - 1.0, f.z - 1.0), g7 = bgrad(bhash3(X + 1u, Y + 1u, Z + 1u), f.x - 1.0, f.y - 1.0, f.z - 1.0);
  return w1 * (v1 * (g0 * u1 + g1 * u) + v * (g2 * u1 + g3 * u)) + w * (v1 * (g4 * u1 + g5 * u) + v * (g6 * u1 + g7 * u));
}
float bsnoise(vec3 p){ return 0.9820 * bperlin(p); }
// Noise Texture：co × scale → distortion → fBM（detail 取整數，lacunarity 2）→ 0..1
float bnoise(vec3 co, float scale, int detail, float rough, float distortion){
  vec3 p = co * scale;
  if (distortion != 0.0) p += vec3(bsnoise(p + boffset(0.0)), bsnoise(p + boffset(1.0)), bsnoise(p + boffset(2.0))) * distortion;
  float fs = 1.0, amp = 1.0, mx = 0.0, sum = 0.0;
  for (int k = 0; k <= 8; k++){ if (k > detail) break; sum += bsnoise(fs * p) * amp; mx += amp; amp *= rough; fs *= 2.0; }
  return 0.5 * sum / mx + 0.5;
}
`;
