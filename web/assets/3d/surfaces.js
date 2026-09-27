// Small, deterministic height fields. These are material microstructure, not
// photographs: base color, physical scale and geometry remain page-owned.
export function createSurface(THREE, renderer, kind) {
  const size = 128, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
    const value = kind === 'wood'
      ? .5 + .22 * Math.sin(v * 11 + Math.sin(u) * 1.8) + .09 * Math.sin(v * 37 + Math.sin(u * 2))
      : .5 + .18 * Math.sin(u * 32) * Math.cos(v * 32) + .1 * Math.cos(u * 16 + v * 16);
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = Math.round(value * 255);
    data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  return texture;
}
