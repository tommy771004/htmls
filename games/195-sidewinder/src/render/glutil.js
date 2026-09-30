// WebGL2 小工具：編譯、程式、貼圖。

export function program(gl, vs, fs, label) {
  const mk = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(`${label} 著色器編譯失敗：${log}`);
    }
    return s;
  };
  const p = gl.createProgram();
  const v = mk(gl.VERTEX_SHADER, vs), f = mk(gl.FRAGMENT_SHADER, fs);
  gl.attachShader(p, v); gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) {
    throw new Error(`${label} 連結失敗：${gl.getProgramInfoLog(p)}`);
  }
  gl.deleteShader(v); gl.deleteShader(f);
  // 預先查好 uniform 位置
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) || 0;
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
  }
  return { p, u };
}

export function texture(gl, src, { srgb = false, mips = true, repeat = false, premult = false } = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premult);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.texImage2D(gl.TEXTURE_2D, 0, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  if (mips) gl.generateMipmap(gl.TEXTURE_2D);
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  if (aniso && mips) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
  return t;
}

// 可平鋪的數值雜訊：r 低頻、g 中頻、b 高頻、a 白雜訊
export function noiseData(size = 256) {
  const out = new Uint8Array(size * size * 4);
  let seed = 0x9e3779b9;
  const rand = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  const layer = (cells) => {
    const g = new Float32Array(cells * cells);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return (x, y) => {
      const fx = x / size * cells, fy = y / size * cells;
      const i = Math.floor(fx), j = Math.floor(fy);
      let u = fx - i, v = fy - j;
      u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
      const at = (a, b) => g[((b % cells) + cells) % cells * cells + ((a % cells) + cells) % cells];
      return (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v;
    };
  };
  const L = [layer(8), layer(16)], M = [layer(32), layer(64)], H = [layer(64), layer(128)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const k = (y * size + x) * 4;
      out[k] = (L[0](x, y) * 0.65 + L[1](x, y) * 0.35) * 255;
      out[k + 1] = (M[0](x, y) * 0.6 + M[1](x, y) * 0.4) * 255;
      out[k + 2] = (H[0](x, y) * 0.55 + H[1](x, y) * 0.45) * 255;
      out[k + 3] = rand() * 255;
    }
  }
  return out;
}
