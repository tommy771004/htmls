// 程序化 PBR 貼圖與環境貼圖生成器（Albedo + Normal + Roughness）
// 完全以 Canvas 2D / DataTexture 即時運算，零外部圖片依賴

import * as THREE from 'three';

function createCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * 將灰階高度陣列轉為切線空間法線貼圖（Tangent-Space Normal Map）
 */
function heightToNormalTexture(heightData, width, height, strength = 2.5, repeatX = 1, repeatY = 1) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const ym = (y - 1 + height) % height;
    const yp = (y + 1) % height;
    for (let x = 0; x < width; x++) {
      const xm = (x - 1 + width) % width;
      const xp = (x + 1) % width;
      const hL = heightData[y * width + xm];
      const hR = heightData[y * width + xp];
      const hU = heightData[ym * width + x];
      const hD = heightData[yp * width + x];

      const dx = (hL - hR) * strength;
      const dy = (hU - hD) * strength;
      const dz = 1.0;
      const invLen = 1.0 / Math.hypot(dx, dy, dz);

      const idx = (y * width + x) * 4;
      data[idx] = Math.round((dx * invLen * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((dy * invLen * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

function configureTexture(canvas, isSRGB = true, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (isSRGB) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/**
 * 決定論偽隨機雜訊
 */
function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * 建立全套賽道與車庫 PBR 貼圖集
 */
export function createProceduralTextures(renderer) {
  // 1. 賽道柏油路面貼圖（含瀝青顆粒噪點、中央賽車線橡膠胎痕 Rubbering-in、雙側白線與粗糙度變化）
  const aspW = 512, aspH = 512;
  const aspAlbC = createCanvas(aspW, aspH);
  const aspRghC = createCanvas(aspW, aspH);
  const aspAlbCtx = aspAlbC.getContext('2d');
  const aspRghCtx = aspRghC.getContext('2d');
  const aspAlbImg = aspAlbCtx.createImageData(aspW, aspH);
  const aspRghImg = aspRghCtx.createImageData(aspW, aspH);
  const aspHeight = new Float32Array(aspW * aspH);

  for (let y = 0; y < aspH; y++) {
    for (let x = 0; x < aspW; x++) {
      const u = x / aspW;
      const n1 = hash2(x, y);
      const n2 = hash2(Math.floor(x * 0.5), Math.floor(y * 0.5));
      const grain = n1 * 0.65 + n2 * 0.35;

      // 賽車線橡膠沉積帶（Rubbering-in 在 u = 0.28 與 0.72 附近顏色更深、更光滑）
      const grooveL = Math.exp(-Math.pow((u - 0.30) / 0.11, 2));
      const grooveR = Math.exp(-Math.pow((u - 0.70) / 0.11, 2));
      const rubber = Math.min(1, (grooveL + grooveR) * 0.85);

      // 縱向細微胎痕刷紋
      const streak = hash2(x, Math.floor(y * 0.08)) * 0.12 * rubber;

      let baseLum = 44 + (grain - 0.5) * 22 - rubber * 12 - streak * 18;
      let rough = 215 - rubber * 55 + (grain - 0.5) * 32;

      // 賽道邊緣白線 (u near 0.035 or 0.965)
      const isEdgeLine = (u > 0.022 && u < 0.048) || (u > 0.952 && u < 0.978);
      if (isEdgeLine) {
        const wear = grain * 0.25;
        baseLum = 215 - wear * 45;
        rough = 155;
      }

      const idx = (y * aspW + x) * 4;
      const c = Math.max(18, Math.min(245, Math.round(baseLum)));
      aspAlbImg.data[idx] = c;
      aspAlbImg.data[idx + 1] = c + (isEdgeLine ? 0 : 1);
      aspAlbImg.data[idx + 2] = c + (isEdgeLine ? 0 : 3);
      aspAlbImg.data[idx + 3] = 255;

      const rVal = Math.max(85, Math.min(250, Math.round(rough)));
      aspRghImg.data[idx] = rVal;
      aspRghImg.data[idx + 1] = rVal;
      aspRghImg.data[idx + 2] = rVal;
      aspRghImg.data[idx + 3] = 255;

      aspHeight[y * aspW + x] = grain * (1 - rubber * 0.35);
    }
  }
  aspAlbCtx.putImageData(aspAlbImg, 0, 0);
  aspRghCtx.putImageData(aspRghImg, 0, 0);

  const asphalt = {
    map: configureTexture(aspAlbC, true, 1, 28),
    roughnessMap: configureTexture(aspRghC, false, 1, 28),
    normalMap: heightToNormalTexture(aspHeight, aspW, aspH, 2.6, 1, 28)
  };

  // 2. 路緣石（Curbs）貼圖：紅白相間 + 輪胎擦痕與磨損凹凸
  const crbW = 256, crbH = 256;
  const crbAlbC = createCanvas(crbW, crbH);
  const crbRghC = createCanvas(crbW, crbH);
  const crbAlbCtx = crbAlbC.getContext('2d');
  const crbRghCtx = crbRghC.getContext('2d');
  const crbAlbImg = crbAlbCtx.createImageData(crbW, crbH);
  const crbRghImg = crbRghCtx.createImageData(crbW, crbH);
  const crbHeight = new Float32Array(crbW * crbH);

  for (let y = 0; y < crbH; y++) {
    const v = y / crbH;
    const isRed = v < 0.5;
    // 方塊接縫凹槽
    const seamDist = Math.min(v, Math.abs(v - 0.5), 1 - v);
    const seam = seamDist < 0.025 ? seamDist / 0.025 : 1.0;

    for (let x = 0; x < crbW; x++) {
      const u = x / crbW;
      const grain = hash2(x, y);
      // 輪胎擦過路緣石的黑色磨損痕跡
      const scuff = Math.exp(-Math.pow((u - 0.42) / 0.25, 2)) * (0.25 + 0.45 * hash2(x, Math.floor(y * 0.2)));

      let r = isRed ? 215 : 238;
      let g = isRed ? 32 : 238;
      let b = isRed ? 36 : 240;

      const grime = (grain - 0.5) * 26 - scuff * 115;
      r = Math.max(24, Math.min(250, (r + grime) * seam));
      g = Math.max(24, Math.min(250, (g + grime) * seam));
      b = Math.max(24, Math.min(250, (b + grime) * seam));

      const idx = (y * crbW + x) * 4;
      crbAlbImg.data[idx] = r;
      crbAlbImg.data[idx + 1] = g;
      crbAlbImg.data[idx + 2] = b;
      crbAlbImg.data[idx + 3] = 255;

      const rough = Math.max(110, Math.min(245, Math.round(185 + (grain - 0.5) * 40 - scuff * 35)));
      crbRghImg.data[idx] = rough;
      crbRghImg.data[idx + 1] = rough;
      crbRghImg.data[idx + 2] = rough;
      crbRghImg.data[idx + 3] = 255;

      crbHeight[y * crbW + x] = seam * 0.8 + grain * 0.2;
    }
  }
  crbAlbCtx.putImageData(crbAlbImg, 0, 0);
  crbRghCtx.putImageData(crbRghImg, 0, 0);

  const curb = {
    map: configureTexture(crbAlbC, true, 1, 18),
    roughnessMap: configureTexture(crbRghC, false, 1, 18),
    normalMap: heightToNormalTexture(crbHeight, crbW, crbH, 3.2, 1, 18)
  };

  // 3. 輪胎胎面（Tire Tread）與胎壁字樣（Tire Sidewall）貼圖
  const trdW = 256, trdH = 256;
  const trdAlbC = createCanvas(trdW, trdH);
  const trdAlbCtx = trdAlbC.getContext('2d');
  const trdAlbImg = trdAlbCtx.createImageData(trdW, trdH);
  const trdHeight = new Float32Array(trdW * trdH);

  for (let y = 0; y < trdH; y++) {
    for (let x = 0; x < trdW; x++) {
      const u = x / trdW;
      const v = y / trdH;
      const grain = hash2(x, y);
      // 排水主溝槽 + V 型性能胎紋
      const mainGroove = Math.abs(u - 0.36) < 0.035 || Math.abs(u - 0.64) < 0.035 || Math.abs(u - 0.5) < 0.025;
      const chevron = Math.sin((v * 14 + Math.abs(u - 0.5) * 5) * Math.PI * 2) > 0.68;
      const isGroove = mainGroove || (chevron && Math.abs(u - 0.5) > 0.06 && Math.abs(u - 0.5) < 0.44);

      const h = isGroove ? 0.15 : 0.85 + grain * 0.15;
      trdHeight[y * trdW + x] = h;

      const lum = Math.round((isGroove ? 16 : 32) + grain * 10);
      const idx = (y * trdW + x) * 4;
      trdAlbImg.data[idx] = lum;
      trdAlbImg.data[idx + 1] = lum + 1;
      trdAlbImg.data[idx + 2] = lum + 2;
      trdAlbImg.data[idx + 3] = 255;
    }
  }
  trdAlbCtx.putImageData(trdAlbImg, 0, 0);

  // 胎壁字樣貼圖
  const swC = createCanvas(256, 256);
  const swCtx = swC.getContext('2d');
  swCtx.fillStyle = '#1b1d20';
  swCtx.fillRect(0, 0, 256, 256);
  swCtx.strokeStyle = '#2d3136';
  swCtx.lineWidth = 3;
  swCtx.beginPath();
  swCtx.arc(128, 128, 114, 0, Math.PI * 2);
  swCtx.stroke();
  swCtx.save();
  swCtx.translate(128, 128);
  swCtx.fillStyle = '#d8dee6';
  swCtx.font = 'italic 900 15px "DIN Condensed", Impact, sans-serif';
  swCtx.textAlign = 'center';
  for (let i = 0; i < 2; i++) {
    swCtx.save();
    swCtx.rotate(i * Math.PI);
    swCtx.fillText('APEX RADIAL // PRO-SPEC', 0, -96);
    swCtx.restore();
  }
  swCtx.restore();

  const tire = {
    treadMap: configureTexture(trdAlbC, true, 1, 4),
    treadNormal: heightToNormalTexture(trdHeight, trdW, trdH, 3.8, 1, 4),
    sidewallMap: configureTexture(swC, true, 1, 1)
  };

  // 4. 越野砂石泥地（Gravel / Dirt）與草地（Grass）貼圖
  const grvW = 256, grvH = 256;
  const grvAlbC = createCanvas(grvW, grvH);
  const grvRghC = createCanvas(grvW, grvH);
  const grsAlbC = createCanvas(grvW, grvH);
  const grvHeight = new Float32Array(grvW * grvH);
  const grsHeight = new Float32Array(grvW * grvH);

  const grvAlbCtx = grvAlbC.getContext('2d');
  const grvRghCtx = grvRghC.getContext('2d');
  const grsAlbCtx = grsAlbC.getContext('2d');
  const grvAlbImg = grvAlbCtx.createImageData(grvW, grvH);
  const grvRghImg = grvRghCtx.createImageData(grvW, grvH);
  const grsAlbImg = grsAlbCtx.createImageData(grvW, grvH);

  for (let y = 0; y < grvH; y++) {
    for (let x = 0; x < grvW; x++) {
      const n1 = hash2(x, y);
      const n2 = hash2(Math.floor(x * 0.25), Math.floor(y * 0.25));
      const n3 = hash2(Math.floor(x * 0.1), Math.floor(y * 0.1));
      const pebble = n1 * 0.5 + n2 * 0.35 + n3 * 0.15;

      const idx = (y * grvW + x) * 4;
      // Gravel / Dirt Albedo
      grvAlbImg.data[idx] = Math.round(118 + (pebble - 0.5) * 58);
      grvAlbImg.data[idx + 1] = Math.round(92 + (pebble - 0.5) * 46);
      grvAlbImg.data[idx + 2] = Math.round(66 + (pebble - 0.5) * 38);
      grvAlbImg.data[idx + 3] = 255;

      const rgh = Math.round(210 + (pebble - 0.5) * 40);
      grvRghImg.data[idx] = rgh;
      grvRghImg.data[idx + 1] = rgh;
      grvRghImg.data[idx + 2] = rgh;
      grvRghImg.data[idx + 3] = 255;
      grvHeight[y * grvW + x] = pebble;

      // Grass Albedo
      grsAlbImg.data[idx] = Math.round(54 + (pebble - 0.5) * 28);
      grsAlbImg.data[idx + 1] = Math.round(88 + (pebble - 0.5) * 36);
      grsAlbImg.data[idx + 2] = Math.round(42 + (pebble - 0.5) * 22);
      grsAlbImg.data[idx + 3] = 255;
      grsHeight[y * grvW + x] = n1 * 0.6 + n2 * 0.4;
    }
  }
  grvAlbCtx.putImageData(grvAlbImg, 0, 0);
  grvRghCtx.putImageData(grvRghImg, 0, 0);
  grsAlbCtx.putImageData(grsAlbImg, 0, 0);

  const gravel = {
    map: configureTexture(grvAlbC, true, 16, 16),
    roughnessMap: configureTexture(grvRghC, false, 16, 16),
    normalMap: heightToNormalTexture(grvHeight, grvW, grvH, 3.4, 16, 16)
  };

  const grass = {
    map: configureTexture(grsAlbC, true, 32, 32),
    normalMap: heightToNormalTexture(grsHeight, grvW, grvH, 2.2, 32, 32)
  };

  // 5. 碳纖維斜紋貼圖（用於尾翼、前下巴與後擴散器）
  const cfC = createCanvas(64, 64);
  const cfCtx = cfC.getContext('2d');
  cfCtx.fillStyle = '#141619';
  cfCtx.fillRect(0, 0, 64, 64);
  cfCtx.fillStyle = '#252930';
  for (let y = 0; y < 64; y += 4) {
    for (let x = 0; x < 64; x += 4) {
      const offset = ((y / 4) % 2) * 2;
      cfCtx.fillRect((x + offset) % 64, y, 2, 3);
    }
  }
  const carbon = {
    map: configureTexture(cfC, true, 12, 12)
  };

  // 6. 使用 PMREMGenerator 建立高動態感環境反射貼圖（模擬天空漸層與車庫聚光燈反射）
  let envMap = null;
  if (renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();

    // 天穹漸層球
    const skyGeo = new THREE.SphereGeometry(50, 32, 16);
    const skyCanvas = createCanvas(256, 128);
    const skyCtx = skyCanvas.getContext('2d');
    const grad = skyCtx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0.0, '#102444');
    grad.addColorStop(0.42, '#3a6ea5');
    grad.addColorStop(0.50, '#ffebd2');
    grad.addColorStop(0.54, '#242830');
    grad.addColorStop(1.0, '#0d0f12');
    skyCtx.fillStyle = grad;
    skyCtx.fillRect(0, 0, 256, 128);

    // 加入高光燈帶讓汽車金油層（Clearcoat）反射出銳利流暢的腰線光條
    skyCtx.fillStyle = '#ffffff';
    skyCtx.fillRect(20, 28, 90, 8);
    skyCtx.fillRect(145, 32, 90, 8);
    skyCtx.fillStyle = '#ff9d5c';
    skyCtx.fillRect(0, 60, 256, 4);

    const skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide });
    envScene.add(new THREE.Mesh(skyGeo, skyMat));

    envMap = pmrem.fromScene(envScene, 0.02).texture;
    pmrem.dispose();
  }

  return {
    asphalt,
    curb,
    tire,
    gravel,
    grass,
    carbon,
    envMap
  };
}
