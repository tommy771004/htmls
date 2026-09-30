// 內嵌資產解碼：build 會在 bundle 之前注入 window.__SW_ASSETS（base64 + gzip）。

function b64Bytes(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function gunzip(b64) {
  const stream = new Blob([b64Bytes(b64)]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

// data:image/png;base64,... → ImageBitmap（自己解 base64，避免 data: 網址被當成請求）
async function decodeImage(src) {
  const m = /^data:([^;,]+)?(;base64)?,/.exec(src);
  const type = (m && m[1]) || 'image/png';
  const bytes = b64Bytes(m ? src.slice(m[0].length) : src);
  const blob = new Blob([bytes], { type });
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }); } catch { /* 退回 Image */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { URL.revokeObjectURL(url); }
}

export async function loadAssets(src = globalThis.__SW_ASSETS) {
  if (!src || src.v !== 1) throw new Error('找不到內嵌資產（window.__SW_ASSETS）');
  const [wasmBuf, meshes, tracks, albedo] = await Promise.all([
    gunzip(src.wasm),
    gunzip(src.meshes),
    Promise.all(src.tracks.map(gunzip)),
    Promise.all(src.albedo.map(decodeImage)),
  ]);
  return { wasm: new Uint8Array(wasmBuf), meshes, tracks, albedo };
}
