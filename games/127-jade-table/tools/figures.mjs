// 127 青雀的大廳／結算 3D 立繪：把 Sketchfab 原檔整理成 assets/jade-table/figures/<角色>.glb。
// 拿掉遊戲擷取模型的頂點色（描邊資料，three 會把它當顏色乘上去，整隻變紅）、陰影面罩與武器，
// 依角色色票重新上色、只留需要的動作，貼圖轉 WebP（最長邊 1024）、meshopt 壓縮。
// gltf-transform、meshoptimizer 與 sharp 借用 197 的 node_modules。
// node tools/figures.mjs [角色…]；原檔目錄預設 ~/Downloads/japan，可用 FIG_SRC 改。
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(resolve(root, '../197-openworld/package.json'));
const imp = (n) => import(pathToFileURL(req.resolve(n)).href);
const { NodeIO } = await imp('@gltf-transform/core');
const { ALL_EXTENSIONS } = await imp('@gltf-transform/extensions');
const { prune, dedup, resample, textureCompress, meshopt } = await imp('@gltf-transform/functions');
const { MeshoptEncoder } = await imp('meshoptimizer');
const sharp = (await imp('sharp')).default;

const SRC = process.env.FIG_SRC || resolve(homedir(), 'Downloads/japan');
const OUT = resolve(root, '../../assets/jade-table/figures');

// drop：要刪的網格／節點（名稱比對）；tint：材質名 → 乘上的底色（sRGB 十六進位）；
// anims：要保留的動作（名稱比對，沒給就全刪）；tex：貼圖最長邊。
// rig 寫進場景的 extras，頁面的 figure3d.mjs 靠它擺姿勢：上臂、前臂、手腕、脊椎、胸、頸、頭的骨頭名
// （three 載入時會拿掉名稱裡的「.」，所以 Arm.L_013 要寫成 ArmL_013），
// lids 是 [上眼皮, 下眼皮] 成對骨頭（眨眼時上往下移），hang 是掛在手臂上、放下手臂後仍要保持 T-pose 時世界朝向的布片，dangle 是沿手臂飄、要改成往下垂的飾帶，idle／win 是動作名的正規式，yaw 修正模型朝向，ink 是描邊寬度，noInk 是不描邊的網格或材質名（正規式，臉部不描邊）。
const side = (l, r) => ({ armL: l[0], foreL: l[1], handL: l[2], armR: r[0], foreR: r[1], handR: r[2] });
export const FIGURES = [
  {
    id: 'qingque', file: 'qingque_-_honkai_starrail', drop: /Face_Mask|Weapon|EyeShadow/i, tint: { Qingque_Mat_Hair: '#5f9a88' },
    rig: {
      ...side(['Shoulder_L_0188', 'Elbow_L_0189', 'Wrist_L_0195'], ['Shoulder_R_0213', 'Elbow_R_0221', 'Wrist_R_0227']),
      spine: 'Spine1_M_016', chest: 'Chest_M_066', neck: 'Neck_M_069', head: 'Head_M_070',
      hang: ['ClothDnL_00_JNT_0192', 'ClothDnR_00_JNT_0224'], dangle: ['RibbonR_c_00_JNT_0197'], noInk: 'Face',
      lids: [
        ['eyeup_inn_L_0134', 'eyedn_inn_L_0131'], ['eyeup_M_L_0135', 'eyedn_M_L_0132'], ['eyeup_out_L_0136', 'eyedn_out_L_0133'],
        ['eyeup_inn_R_0146', 'eyedn_inn_R_0143'], ['eyeup_M_R_0147', 'eyedn_M_R_0144'], ['eyeup_out_R_0148', 'eyedn_out_R_0145'],
      ],
    },
  },
  {
    // 竹隱：alienkatgames 的原創巫女（頭上狐面、手持御幣），原檔面向 -z。有 14 秒的 Idle，勝利姿勢用程式舉手。
    id: 'bamboo', file: 'miko', anims: /\|Idle$/,
    rig: {
      ...side(['UpperArmL_035', 'ElbowL_036', 'ForearmL_037'], ['UpperArmR_056', 'ElbowR_057', 'ForearmR_058']),
      spine: 'Spine1_012', chest: 'Spine2_032', neck: 'Neck_033', head: 'Head_00', idle: 'Idle$', yaw: Math.PI,
    },
  },
  {
    // 月白：tranb95 的原創巫女（Project W）。拿掉弓；原檔的動作是拉弓戰鬥用的，全部不留，改用程式站姿。
    // 原檔自帶反向外殼描邊（Yang_Outline），留著用，頁面不再加描邊（noInk 全部）；寬袖從 T-pose 的下垂方向保持住。
    id: 'moon', file: 'priestess', drop: /^Bow/,
    rig: {
      ...side(['ArmL_013', 'ArmForeL_014', 'HandL_015'], ['ArmR_038', 'ArmForeR_039', 'HandR_040']),
      spine: 'Spine1_03', chest: 'Spine3_05', neck: 'Neck_06', head: 'Head_07', noInk: '.',
      hang: ['Sleeve1L_033', 'Sleeve2L_035', 'Sleeve1R_055', 'Sleeve2R_057'],
    },
  },
  {
    // 遠山：Blood Strike（網易）Katya 的藝伎服裝，遊戲擷取模型、原檔沒有骨架。
    // 先跑 blender/rig_katya.py 綁骨（輸出 .cache/katya_rigged.glb），再從那裡處理。
    id: 'mountain', src: resolve(root, '.cache/katya_rigged.glb'),
    rig: {
      ...side(['UpperArmL', 'ForeArmL', 'HandL'], ['UpperArmR', 'ForeArmR', 'HandR']),
      spine: 'Spine', chest: 'Chest', neck: 'Neck', head: 'Head', noInk: '.',
    },
  },
];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await MeshoptEncoder.ready;
const want = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });

const lin = (h) => [1, 3, 5].map((i) => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });

for (const cfg of FIGURES) {
  if (want.length && !want.includes(cfg.id)) continue;
  const src = cfg.src || resolve(SRC, cfg.file + '.glb');
  if (!existsSync(src)) { console.log(`跳過 ${cfg.id}：找不到 ${src}`); continue; }
  const doc = await io.read(src), rootG = doc.getRoot();
  // 只拿掉網格，節點留著：同名的可能是骨頭（Priestess 的弓有骨頭 Bow_031）。
  for (const node of rootG.listNodes()) {
    const mesh = node.getMesh();
    if (mesh && cfg.drop && (cfg.drop.test(node.getName()) || cfg.drop.test(mesh.getName()))) node.setMesh(null);
  }
  for (const mesh of rootG.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const col = prim.getAttribute('COLOR_0'); if (col) prim.setAttribute('COLOR_0', null);
    const mat = prim.getMaterial(); if (!mat) continue;
    const hex = cfg.tint?.[mat.getName()]; if (hex) mat.setBaseColorFactor([...lin(hex), 1]);
  }
  // 動畫的 sampler 不會跟著 dispose，要一起丟掉，否則 prune 留下它們的關鍵幀（月白多出 3 MB）。
  for (const a of rootG.listAnimations()) if (!cfg.anims?.test(a.getName())) { for (const x of [...a.listChannels(), ...a.listSamplers()]) x.dispose(); a.dispose(); }
  for (const sc of rootG.listScenes()) sc.setExtras({ ...sc.getExtras(), rig: cfg.rig || {} });
  await doc.transform(
    // keepAttributes：原檔是 unlit 材質時 prune 會刪掉 NORMAL，頁面改用 toon 著色要法線（月白整隻變黑）。
    resample(), prune({ keepAttributes: true }), dedup(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [cfg.tex ?? 1024, cfg.tex ?? 1024], quality: 85 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const file = resolve(OUT, cfg.id + '.glb');
  await io.write(file, doc);
  console.log(`${cfg.id}: ${(statSync(file).size / 1e6).toFixed(2)} MB，動作 ${rootG.listAnimations().map((a) => a.getName()).join('、') || '無'}`);
}
