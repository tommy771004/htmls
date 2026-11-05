// Three.js r187 (0.187.0) TSL 程序材質庫 + NodeMaterialInstance 建築灰泥共用著色器
import * as THREE from 'three';
import {
  MeshStandardNodeMaterial,
  MeshBasicNodeMaterial,
  NodeMaterialInstance,
} from 'three/webgpu';
import {
  color,
  float,
  vec2,
  vec3,
  uv,
  time,
  positionWorld,
  normalWorld,
  sin,
  cos,
  abs,
  min,
  max,
  mix,
  pow,
  floor,
  fract,
  clamp,
  length,
  smoothstep,
  hash,
  mx_noise_float,
  materialReference,
  attribute,
} from 'three/tsl';
import { PLINTH, LOOP } from './config.js';

/**
 * 安全讀取 NodeMaterialInstance 屬性：
 * 當 ShadowNode 以內部 ShadowMaterial 覆寫 pass 材質時，自動回退至網格原始材質或主母材質，
 * 避免陰影通道讀取不到自訂實例屬性。
 */
function sharedMaterialRef(prop, type, fallbackMaster) {
  const ref = materialReference(prop, type);
  ref.updateReference = (state) => {
    const m = state.material;
    ref.reference = m && m[prop] !== undefined
      ? m
      : state.object?.material?.[prop] !== undefined
        ? state.object.material
        : fallbackMaster;
    return ref.reference;
  };
  return ref;
}

/**
 * 建立整座微縮城市的材質表：
 * - 利用 r187 新定名的 NodeMaterialInstance 讓四種奶油色歐風建築灰泥／石灰岩共用同一份編譯後的 TSL 著色器
 * - 廣場石板、柏油路面、水池漣漪與攝影棚桌面柔和接觸陰影皆以 TSL 程序計算，零外部貼圖
 */
export function createCityMaterials() {
  // 1. 歐風建築灰泥主母材質（Shared Shader via NodeMaterialInstance）
  const stuccoMaster = new MeshStandardNodeMaterial({
    roughness: 0.84,
    metalness: 0.02,
  });
  stuccoMaster.stuccoTint = new THREE.Color('#f1ebe0');
  stuccoMaster.roughShift = 0.0;

  const wp = positionWorld;
  const fineGrain = mx_noise_float(wp.mul(3.4)).mul(0.032);
  const macroCloud = mx_noise_float(wp.mul(0.45)).mul(0.028);
  // 近地面微幅溫潤暗化（輔助牆腳接地感）
  const groundWarmth = smoothstep(float(0.05), float(1.35), wp.y).mul(0.055).add(0.945);
  const baseTint = sharedMaterialRef('stuccoTint', 'color', stuccoMaster);
  const rShift = sharedMaterialRef('roughShift', 'float', stuccoMaster);

  stuccoMaster.colorNode = baseTint.mul(groundWarmth.add(fineGrain).add(macroCloud));
  stuccoMaster.roughnessNode = clamp(float(0.84).add(rShift).sub(fineGrain.mul(0.9)), 0.55, 0.96);

  const makeStuccoVariant = (hex, roughShift = 0.0) => {
    const inst = new NodeMaterialInstance(stuccoMaster);
    inst.stuccoTint = new THREE.Color(hex);
    inst.roughShift = roughShift;
    return inst;
  };

  const creamMain = makeStuccoVariant('#f1ebe0', 0.0);    // 主牆奶油白
  const creamWarm = makeStuccoVariant('#ece3d3', 0.03);   // 暖米歐風灰泥
  const creamLight = makeStuccoVariant('#f7f3eb', -0.04); // 象牙白線腳／高層牆面
  const limestone = makeStuccoVariant('#e3dacb', 0.05);   // 基座／台階／底座石材

  // 2. 人行道淺米灰石材
  const sidewalk = new MeshStandardNodeMaterial({ roughness: 0.88, metalness: 0.01 });
  const swGridX = abs(fract(wp.x.mul(0.65)).sub(0.5));
  const swGridZ = abs(fract(wp.z.mul(0.65)).sub(0.5));
  const swJoint = smoothstep(float(0.46), float(0.495), max(swGridX, swGridZ));
  const swNoise = mx_noise_float(vec3(wp.x.mul(1.8), float(0.5), wp.z.mul(1.8))).mul(0.025);
  sidewalk.colorNode = mix(
    color('#dfdad0').add(swNoise),
    color('#cbc4b8'),
    swJoint.mul(0.45),
  );

  // 3. 中央廣場暖灰米洞石（Travertine 錯縫石板，重現參考圖的溫潤灰米色拼花）
  const plazaStone = new MeshStandardNodeMaterial({ roughness: 0.82, metalness: 0.02 });
  const row = floor(wp.z.mul(0.95));
  const col = floor(wp.x.mul(0.75).add(hash(row.mul(11.7)).mul(0.5)));
  const fu = fract(wp.x.mul(0.75).add(hash(row.mul(11.7)).mul(0.5)));
  const fv = fract(wp.z.mul(0.95));
  const edgeD = min(min(fu, float(1).sub(fu)), min(fv, float(1).sub(fv)));
  const grout = float(1).sub(smoothstep(float(0.018), float(0.048), edgeD));
  const tileRand = hash(col.mul(19.3).add(row.mul(83.1)));
  const tileCloud = mx_noise_float(vec3(wp.x.mul(0.55), float(1.3), wp.z.mul(0.55))).mul(0.05);
  const tileBase = mix(color('#aba193'), color('#c2b9ab'), tileRand).add(tileCloud);
  plazaStone.colorNode = mix(tileBase, color('#8e8579'), grout.mul(0.55));
  plazaStone.roughnessNode = mix(float(0.79), float(0.92), grout);

  // 4. 柏油車道（深炭灰微粒質感）
  const asphalt = new MeshStandardNodeMaterial({ roughness: 0.86, metalness: 0.03 });
  const aspGrain = mx_noise_float(vec3(wp.x.mul(6.5), float(2.1), wp.z.mul(6.5))).mul(0.028);
  const aspWear = mx_noise_float(vec3(wp.x.mul(0.4), float(0.2), wp.z.mul(0.4))).mul(0.024);
  asphalt.colorNode = color('#34363a').add(aspGrain).add(aspWear);

  // 5. 道路白色標線／斑馬線
  const roadLine = new MeshStandardNodeMaterial({
    color: '#eeebe4',
    roughness: 0.68,
    metalness: 0.02,
  });

  // 6. 暖光室內玻璃窗（柔和琥珀暖光，符合參考圖一樓與公寓窗內的溫暖室內照明）
  const windowWarm = new MeshStandardNodeMaterial({
    roughness: 0.22,
    metalness: 0.1,
  });
  const winGrad = fract(wp.y.mul(0.35));
  const winFlicker = mx_noise_float(wp.mul(0.9)).mul(0.18).add(0.85);
  windowWarm.colorNode = mix(color('#6b5336'), color('#c79a5b'), winGrad);
  windowWarm.emissiveNode = color('#f3be72').mul(float(0.52).mul(winFlicker));

  // 7. 深色窗框／列車車窗玻璃
  const windowDark = new MeshStandardNodeMaterial({
    color: '#2c333b',
    roughness: 0.16,
    metalness: 0.55,
  });

  // 8. 鍛鐵深古銅／鑄鐵欄杆／街燈／車站拱肋
  const wroughtIron = new MeshStandardNodeMaterial({
    color: '#2d2b29',
    roughness: 0.44,
    metalness: 0.68,
  });

  // 9. 鐘塔深板岩青灰尖頂（對齊參考圖鐘塔的深灰綠尖錐屋頂）
  const slateSpire = new MeshStandardNodeMaterial({
    roughness: 0.62,
    metalness: 0.12,
  });
  const slateTex = mx_noise_float(wp.mul(5.0)).mul(0.03);
  slateSpire.colorNode = color('#414d46').add(slateTex);

  // 10. 遮陽傘與雨棚奶油帆布
  const fabricCream = new MeshStandardNodeMaterial({
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const fabWeave = mx_noise_float(wp.mul(9.0)).mul(0.025);
  fabricCream.colorNode = color('#ece4d5').add(fabWeave);

  // 11. 溫潤胡桃木／橡木（涼亭、露天桌椅、長椅、軌道枕木）
  const woodWarm = new MeshStandardNodeMaterial({
    roughness: 0.76,
    metalness: 0.04,
  });
  const woodGrain = mx_noise_float(vec3(wp.x.mul(8.0), wp.y.mul(2.5), wp.z.mul(8.0))).mul(0.045);
  woodWarm.colorNode = color('#8c6849').add(woodGrain);

  const woodDark = new MeshStandardNodeMaterial({
    roughness: 0.82,
    metalness: 0.05,
  });
  woodDark.colorNode = color('#513f33').add(woodGrain.mul(0.7));

  // 12. 鐵軌鋼材與道碴碎石
  const steelRail = new MeshStandardNodeMaterial({
    color: '#5a5e64',
    roughness: 0.34,
    metalness: 0.82,
  });

  const ballast = new MeshStandardNodeMaterial({ roughness: 0.95, metalness: 0.02 });
  const balNoise = mx_noise_float(wp.mul(14.0)).mul(0.055);
  ballast.colorNode = color('#4b4640').add(balNoise);

  // 13. 噴泉與西側水池 TSL 動態波紋水面
  const water = new MeshStandardNodeMaterial({
    roughness: 0.12,
    metalness: 0.18,
  });
  const tSlow = time.mul(1.35);
  const w1 = sin(wp.x.mul(4.2).add(tSlow)).mul(cos(wp.z.mul(4.6).sub(tSlow.mul(0.8))));
  const w2 = sin(wp.x.sub(wp.z).mul(7.5).sub(tSlow.mul(1.4))).mul(0.5);
  const ripple = w1.add(w2).mul(0.5);
  water.colorNode = mix(color('#58748c'), color('#89a7bf'), ripple.mul(0.28).add(0.45));
  water.roughnessNode = clamp(float(0.11).add(ripple.mul(0.04)), 0.05, 0.24);

  // 14. 噴水池水花白沫材質
  const waterFoam = new MeshStandardNodeMaterial({
    color: '#f5f8fa',
    emissive: '#dde8f0',
    emissiveIntensity: 0.22,
    roughness: 0.32,
    metalness: 0.0,
    transparent: true,
    opacity: 0.86,
  });

  // 15. 公園草地、修剪灌木籬與行道樹冠
  const grass = new MeshStandardNodeMaterial({ roughness: 0.92, metalness: 0.0 });
  const grassPatch = mx_noise_float(vec3(wp.x.mul(0.65), float(0.0), wp.z.mul(0.65)));
  const grassFine = mx_noise_float(vec3(wp.x.mul(5.5), float(1.1), wp.z.mul(5.5))).mul(0.035);
  grass.colorNode = mix(color('#566d44'), color('#6d8554'), grassPatch).add(grassFine);

  const hedge = new MeshStandardNodeMaterial({ roughness: 0.88, metalness: 0.0 });
  const hedgeLeaf = mx_noise_float(wp.mul(11.0)).mul(0.05);
  hedge.colorNode = color('#3f5633').add(hedgeLeaf);

  // 樹冠材質（支援 InstancedMesh 實例色差 + 頂部暖陽透光感）
  const foliage = new MeshStandardNodeMaterial({ roughness: 0.84, metalness: 0.0 });
  const leafNoise = mx_noise_float(wp.mul(4.8)).mul(0.065);
  const sunLift = clamp(normalWorld.y.mul(0.5).add(0.5), 0.0, 1.0);
  foliage.colorNode = mix(color('#445936'), color('#748d56'), sunLift).add(leafNoise);

  const trunkBark = new MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0.0 });
  const barkTex = mx_noise_float(vec3(wp.x.mul(9.0), wp.y.mul(3.0), wp.z.mul(9.0))).mul(0.04);
  trunkBark.colorNode = color('#574638').add(barkTex);

  // 16. 花朵／時鐘面／街燈暖光燈罩／石岸鵝卵石
  const blossomWhite = new MeshStandardNodeMaterial({
    color: '#f5f1e8',
    roughness: 0.75,
    metalness: 0.0,
  });

  const clockFace = new MeshStandardNodeMaterial({
    color: '#fbf8f1',
    emissive: '#fff6e3',
    emissiveIntensity: 0.14,
    roughness: 0.45,
    metalness: 0.02,
  });

  const lampGlow = new MeshStandardNodeMaterial({
    color: '#fff4d8',
    emissive: '#ffcf7c',
    emissiveIntensity: 1.35,
    roughness: 0.2,
    metalness: 0.0,
  });

  const tailRed = new MeshStandardNodeMaterial({
    color: '#d9483b',
    emissive: '#ff4d38',
    emissiveIntensity: 0.9,
    roughness: 0.25,
    metalness: 0.1,
  });

  const rockStone = new MeshStandardNodeMaterial({ roughness: 0.88, metalness: 0.02 });
  const rockVar = mx_noise_float(wp.mul(3.2)).mul(0.06);
  rockStone.colorNode = color('#8b867d').add(rockVar);

  // 17. 實例化接觸陰影貼片材質（Contact AO Decals）
  const contactDecal = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const dUv = uv().sub(vec2(0.5, 0.5)).mul(2.0);
  const radial = clamp(float(1.0).sub(length(dUv)), 0.0, 1.0);
  const softFalloff = pow(radial, float(1.85));
  // 讀取 InstancedMesh 每個貼片的濃淡屬性 aStrength（預設 0.36）
  const instStrength = attribute('aStrength', 'float');
  contactDecal.colorNode = color('#1e1b18');
  contactDecal.opacityNode = softFalloff.mul(instStrength);

  // 18. 攝影棚桌面無縫柔和陰影墊（重現參考圖右側高架環線與底座投在米白桌面上的超大柔光箱接觸陰影！）
  const tabletopShadow = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
  });
  // 光源自左前上方 (-X, +Y, +Z) 投向右後方 (+X, -Z)
  const pShiftX = wp.x.sub(4.4);
  const pShiftZ = wp.z.add(2.4);
  const boxDx = max(abs(pShiftX).sub(PLINTH.halfX), float(0.0));
  const boxDz = max(abs(pShiftZ).sub(PLINTH.halfZ), float(0.0));
  const plinthDist = length(vec2(boxDx, boxDz));
  const plinthSoft = float(1.0).sub(smoothstep(float(0.0), float(6.8), plinthDist)).mul(0.32);

  // 高架環線向右後方投射的柔和弧形漫射影（對應參考圖右側那個標誌性的圓弧柔影）
  const loopShiftX = wp.x.sub(LOOP.cx + 7.6);
  const loopShiftZ = wp.z.sub(LOOP.cz - 3.2);
  const clampedX = clamp(loopShiftX, float(-LOOP.halfStraight), float(LOOP.halfStraight));
  const distToCenterline = length(vec2(loopShiftX.sub(clampedX), loopShiftZ));
  const ringDist = abs(distToCenterline.sub(LOOP.radius));
  const loopShadow = float(1.0).sub(smoothstep(float(0.6), float(6.4), ringDist)).mul(0.32);

  // 近底座邊緣的緊密接觸暗線
  const tightDx = max(abs(wp.x).sub(PLINTH.halfX - 0.15), float(0.0));
  const tightDz = max(abs(wp.z).sub(PLINTH.halfZ - 0.15), float(0.0));
  const tightShadow = float(1.0).sub(smoothstep(float(0.0), float(0.95), length(vec2(tightDx, tightDz)))).mul(0.38);

  tabletopShadow.colorNode = color('#23201d');
  tabletopShadow.opacityNode = clamp(max(max(plinthSoft, tightShadow), loopShadow), 0.0, 0.48);

  return {
    stuccoMaster,
    creamMain,
    creamWarm,
    creamLight,
    limestone,
    sidewalk,
    plazaStone,
    asphalt,
    roadLine,
    windowWarm,
    windowDark,
    wroughtIron,
    slateSpire,
    fabricCream,
    woodWarm,
    woodDark,
    steelRail,
    ballast,
    water,
    waterFoam,
    grass,
    hedge,
    foliage,
    trunkBark,
    blossomWhite,
    clockFace,
    lampGlow,
    tailRed,
    rockStone,
    contactDecal,
    tabletopShadow,
  };
}
