// 把程序產生的像素圖（src/art）轉成 Phaser 紋理，以及 DOM 介面用的 data URL。

import type Phaser from 'phaser';
import { buildSprites, type PixelImage } from '../art';

let cache: Map<string, PixelImage> | null = null;
const urls = new Map<string, string>();

export function sprites(): Map<string, PixelImage> {
  if (!cache) cache = buildSprites();
  return cache;
}

function toCanvas(img: PixelImage): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.w;
  canvas.height = img.h;
  const ctx = canvas.getContext('2d')!;
  const data = ctx.createImageData(img.w, img.h);
  data.data.set(img.data);
  ctx.putImageData(data, 0, 0);
  return canvas;
}

/** DOM 用：小圖示直接以 <img> 顯示，CSS 用 image-rendering: pixelated 放大。 */
export function spriteUrl(key: string): string | null {
  const hit = urls.get(key);
  if (hit) return hit;
  const img = sprites().get(key);
  if (!img) return null;
  const url = toCanvas(img).toDataURL('image/png');
  urls.set(key, url);
  return url;
}

export function registerTextures(scene: Phaser.Scene): void {
  for (const [key, img] of sprites()) {
    if (scene.textures.exists(key)) continue;
    scene.textures.addCanvas(key, toCanvas(img));
  }
}
