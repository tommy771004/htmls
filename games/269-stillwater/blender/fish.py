# 靜水釣遊（269）：55 種魚 → blender/out/fish.glb
# 每種一個靜態網格 f01～f55（編號＝企劃書 #01～#55），全長正規化 1.0 m、頭朝 glTF +Z、原點在身體中心。
# 花紋寫在頂點色 COLOR_0（無貼圖）；不匯出法線（GLTFLoader 會自動用 flatShading，低多邊形切面）。
# 參數化產生器在 fishgen.py：族別（FAMILY）給體型、鰭形與眼位，這裡每種只寫差異與配色花紋。
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/fish.py
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import reset, OUT
from fishgen import FAMILY, build_fish
import bpy, math

reset()

# (編號, 族別, 覆寫參數)。col：back 背／side 體側／belly 腹／fin 鰭／finEdge 鰭緣／tail 尾鰭／tailLow 尾鰭下葉／barbel 觸鬚
# pattern（v：−1 腹～1 背；t：0 吻端～1 尾柄）：bars 橫帶、band 縱帶、spots 斑點、mottle 雲紋、scales 鱗片交錯、patch 局部色塊、grad 沿身漸層、koi 大塊雲斑
SPECIES = [
    # ---------- 第一區 木屋碼頭與靜水淺灘 ----------
    (1, 'cyprinid', dict(depth=0.36, width=0.36, anal=(0.58, 0.80, 0.08, 'long'),
        col=dict(back='#6f7d86', side='#d3d9dc', belly='#eef0ee', fin='#9aa4a6', finEdge='#7d8a8e'), pcol='#c98a74',
        pattern=[('scales', 0.06, -0.6)])),
    (2, 'minnow', dict(depth=0.18,
        col=dict(back='#6b7a4a', side='#b9b47a', belly='#e9c6a0', fin='#a8a070'),
        pattern=[('bars', 9, '#4a5434', 0.45, -0.25, 0.2, 0.95), ('patch', '#d8826a', 0.25, 0.7, -1, -0.55)])),
    (3, 'cyprinid', dict(depth=0.29,
        col=dict(back='#4f6b78', side='#cfd6d2', belly='#f1efe8', fin='#d0603e', finEdge='#b8482e', tail='#8a8e88'),
        dcol='#7a8480', eye='#5a1810', eyeRing='#d8483a', pattern=[('scales', 0.05, -0.5)])),
    (4, 'sunfish', dict(
        col=dict(back='#4f6a4a', side='#7d9a6a', belly='#e2a54a', fin='#5f7258'),
        pattern=[('bars', 6, '#3e5240', 0.4, -0.5, 0.15, 0.95), ('patch', '#1e2a2a', 0.20, 0.30, -0.05, 0.45),
                 ('patch', '#5a7ab0', 0.0, 0.16, -0.4, 0.2)])),
    (5, 'minnow', dict(depth=0.17, width=0.75, asym=-0.1, barbels=[(-0.7, 0.06)], square=0.8,
        col=dict(back='#7a6e55', side='#b3a689', belly='#e6dcc8', fin='#a39678', finEdge='#6a5e48'),
        pattern=[('spots', 0.35, '#4a4232', -0.1, 1.0), ('bars', 8, '#5a5040', 0.3, -0.3, 0.2, 0.95)])),
    (6, 'cyprinid', dict(depth=0.32,
        col=dict(back='#6e6a3a', side='#d9b450', belly='#f0e2b0', fin='#d8452f', finEdge='#b8301e'),
        dcol='#a8503a', pattern=[('scales', 0.08, -0.5)])),
    (7, 'minnow', dict(depth=0.21,
        col=dict(back='#5b6a5e', side='#d5dad6', belly='#f2f2ee', fin='#d9cfa0'),
        pattern=[('band', 0.05, 0.12, '#e9ecea')])),
    (8, 'cyprinid', dict(depth=0.27, width=0.62, caudal='trunc', ped=0.45, tailH=0.66,
        dorsal=[(0.42, 0.56, 0.14, 'round')], anal=(0.64, 0.76, 0.09, 'round'), pect=0.10, pelv=0.10,
        barbels=[(-0.3, 0.04)], eye='#6a1a10', eyeRing='#d0602a',
        col=dict(back='#3d5233', side='#6e8a4a', belly='#c2b36a', fin='#3b4a2e', finEdge='#2e3a24'))),
    (9, 'cyprinid', dict(depth=0.40, width=0.48, hump=0.12, dorsal=[(0.36, 0.66, 0.13, 'long')],
        col=dict(back='#6a5a32', side='#c49a4a', belly='#e9d39a', fin='#8a6a3a'),
        pattern=[('koi', '#e2c27a', 0.2), ('scales', 0.09, -0.6)])),
    (10, 'cyprinid', dict(depth=0.37, width=0.34, tailLen=0.2,
        col=dict(back='#5a6a8a', side='#c2cbe0', belly='#f0d8d8', fin='#d86a5a', finEdge='#c43a2a'),
        pattern=[('band', 0.02, 0.16, '#2fa0a0', 0.45, 1.0), ('patch', '#b04a6a', 0.18, 0.26, 0.1, 0.5)])),
    (11, 'cyprinid', dict(depth=0.35, width=0.66, hump=0.12, maxAt=0.38, dorsal=[(0.34, 0.72, 0.15, 'long')],
        pect=0.13, pelv=0.11, barbels=[(-0.2, 0.09), (-0.6, 0.06)], barbelW=0.009, tailH=0.72, tailLen=0.21,
        col=dict(back='#4a3c24', side='#b58a3e', belly='#e8c98a', fin='#6a4a2a', finEdge='#4a3018', tailLow='#b5503a'),
        acol='#9a4a32', pattern=[('grad', ['#8a6a2e', '#c8963e', '#c9783a'], -0.4, 0.5, 0.5), ('scales', 0.26, -0.7)])),
    # ---------- 第二區 陽光蜿蜒河道中游 ----------
    (12, 'perch', dict(
        col=dict(back='#3e5a34', side='#a8b452', belly='#ecebc8', fin='#d5582e', finEdge='#c0401e', tail='#b0603a'),
        dcol='#6a6e5a', pattern=[('bars', 6, '#2c3a26', 0.42, -0.45, 0.12, 0.92)])),
    (13, 'minnow', dict(depth=0.22, width=0.42, anal=(0.6, 0.8, 0.13, 'long'),
        col=dict(back='#4a6a6a', side='#d2d8d0', belly='#f0e0dc', fin='#e0a080', finEdge='#c8605a'),
        pattern=[('bars', 10, '#4f9a9a', 0.45, -0.4, 0.15, 0.95), ('patch', '#e7a0a0', 0.15, 0.9, -0.85, -0.3)])),
    (14, 'minnow', dict(depth=0.18, width=0.42, mouthY=0.012,
        col=dict(back='#5d7d7a', side='#e3e8e6', belly='#f6f6f2', fin='#c8d0cc'),
        pattern=[('band', 0.1, 0.1, '#f8fbfa')])),
    (15, 'loach', dict(barbels=[(-0.4, 0.05), (-0.8, 0.04), (0.0, 0.03)],
        col=dict(back='#6a5a3e', side='#a89670', belly='#e3d6b8', fin='#8a7a5a'),
        pattern=[('spots', 0.4, '#4a3a28', -0.3, 1.0), ('band', 0.0, 0.12, '#5a4a32', 0.1, 1.0)])),
    (16, 'cyprinid', dict(depth=0.27,
        col=dict(back='#3c4f55', side='#c9c4a8', belly='#ece8d8', fin='#c8704a', finEdge='#b05030'),
        dcol='#5a5a50', pattern=[('scales', 0.06, -0.5)])),
    (17, 'cyprinid', dict(depth=0.42, width=0.32, hump=0.18, maxAt=0.42, anal=(0.52, 0.82, 0.10, 'long'),
        col=dict(back='#4e4232', side='#b98a52', belly='#e3cba0', fin='#5a4a3a'),
        pattern=[('scales', 0.08, -0.5)])),
    (18, 'salmonid', dict(depth=0.22, dorsal=[(0.30, 0.62, 0.24, 'sail')], fork=0.4,
        col=dict(back='#4f5a63', side='#b9c1c4', belly='#ece8e4', fin='#8a7a80'),
        dcol='#7a4a6a', finEdge='#c45a5a',
        pattern=[('spots', 0.25, '#2a2e34', -0.2, 0.8, 0.1, 0.5)])),
    (19, 'salmonid', dict(
        col=dict(back='#6d7a3a', side='#e6c048', belly='#e86a3a', fin='#d8a040', finEdge='#f4f0e0'),
        pattern=[('bars', 9, '#7a8a4a', 0.4, -0.25, 0.12, 0.9), ('band', -0.05, 0.12, '#d55a3a'),
                 ('spots', 0.2, '#3a3a20', 0.45, 1.0)])),
    (20, 'eel', dict(depth=0.11, caudal='round',
        col=dict(back='#8a6a4a', side='#c9a26a', belly='#efe0c4', fin='#c9a26a', finEdge='#5a9ac0'),
        pattern=[('bars', 7, '#4a3a2a', 0.38, -0.7, 0.05, 1.0), ('spots', 0.18, '#5a9ac0', -0.3, 0.8)])),
    (21, 'minnow', dict(depth=0.20, width=0.72, asym=-0.15, maxAt=0.35, barbels=[(-0.4, 0.07), (-0.8, 0.06)],
        dorsal=[(0.40, 0.52, 0.15, 'tri')], fork=0.45,
        col=dict(back='#6a5a3a', side='#c79a52', belly='#ecdcb4', fin='#c8784a', finEdge='#a0502a'),
        pattern=[('scales', 0.08, -0.5)])),
    (22, 'salmonid', dict(depth=0.27, width=0.48, hump=0.14, maxAt=0.38, tailH=0.7, fork=0.3,
        dorsal=[(0.32, 0.54, 0.20, 'sail')], pect=0.11,
        col=dict(back='#b5862e', side='#e8e2d0', belly='#fbf6ee', fin='#d8a040', finEdge='#f0d070', tail='#c09040'),
        pattern=[('grad', ['#e8b040', '#d89a30', '#b5862e'], 0.25, 1.0, 0.85), ('spots', 0.25, '#2a2418', 0.5, 1.0),
                 ('band', -0.25, 0.12, '#e07a4a', 0.15, 0.95)])),
    # ---------- 第三區 松林樹蔭與沉木緩流 ----------
    (23, 'perch', dict(depth=0.27, width=0.5, dorsal=[(0.26, 0.46, 0.13, 'spiny'), (0.47, 0.66, 0.12, 'round')],
        col=dict(back='#2f4a2f', side='#7d9a5a', belly='#e6e2c0', fin='#5a6a46'),
        pattern=[('band', 0.0, 0.16, '#2a3a24', 0.1, 1.0), ('mottle', '#3a5030', 0.25, 0.3)])),
    (24, 'catfish', dict(depth=0.19, barbels=[(0.5, 0.14), (-0.3, 0.12), (-0.8, 0.10), (-0.5, 0.08)],
        col=dict(back='#4a3a2a', side='#7a6040', belly='#d8c8a0', fin='#4a3a2a', barbel='#3a2e22'),
        pattern=[('mottle', '#3a2e22', 0.4, -0.3)])),
    (25, 'sunfish', dict(
        col=dict(back='#4f6a3a', side='#8aa45a', belly='#f0b040', fin='#6a7a4a'),
        pattern=[('spots', 0.35, '#e0903a', -0.4, 0.7), ('patch', '#1e2a20', 0.20, 0.29, -0.05, 0.45),
                 ('patch', '#d84a2a', 0.26, 0.30, 0.15, 0.4), ('patch', '#5aa0a0', 0.02, 0.18, -0.3, 0.3)])),
    (26, 'minnow', dict(depth=0.18, width=0.85, asym=-0.12, mouthY=-0.03, dorsal=[(0.38, 0.52, 0.12, 'tri')],
        col=dict(back='#4a4232', side='#a08a62', belly='#ecead8', fin='#7a6a4a'),
        pattern=[('band', 0.0, 0.12, '#5a4a36', 0.15, 1.0), ('scales', 0.05, -0.5)])),
    (27, 'pike', dict(depth=0.14,
        col=dict(back='#2e4a2a', side='#7aa05a', belly='#e8e4c0', fin='#5a7a46'),
        pattern=[('mottle', '#2a3a20', 0.45, -0.5)])),
    (28, 'eel', dict(depth=0.14, width=0.85, dorsal=[(0.32, 0.40, 0.06, 'round'), (0.45, 0.96, 0.06, 'long')],
        anal=(0.52, 0.96, 0.06, 'long'), barbels=[(-0.9, 0.06)], pect=0.06, pelv=0.04,
        col=dict(back='#4a4a2e', side='#8a8456', belly='#d8d2a8', fin='#6a6a44'),
        pattern=[('mottle', '#2e2e1e', 0.42, -0.6)])),
    (29, 'catfish', dict(depth=0.18, width=0.75, dorsal=[(0.24, 0.30, 0.06, 'tri')], adipose=None,
        anal=(0.42, 0.97, 0.07, 'long'), caudal='round', barbels=[(0.6, 0.32), (-0.7, 0.10), (-0.4, 0.08)],
        col=dict(back='#3a3640', side='#6a6470', belly='#c8c4c0', fin='#4a4650', barbel='#2e2a32'),
        pattern=[('mottle', '#2a2830', 0.3, -0.2)])),
    (30, 'cyprinid', dict(depth=0.31, width=0.58, hump=0.08, dorsal=[(0.36, 0.68, 0.12, 'long')], barbels=[(-0.3, 0.05)],
        col=dict(back='#4a3a4a', side='#c08a8a', belly='#f0d8b8', fin='#8a5a7a', finEdge='#5a3a5a'),
        pattern=[('grad', ['#e0a060', '#c08a8a', '#8a5a9a'], -0.5, 0.6, 0.6), ('scales', 0.1, -0.6)])),
    (31, 'eel', dict(depth=0.15, width=0.8, caudal='round', tailH=0.62, dorsal=[(0.28, 0.94, 0.07, 'long')],
        anal=(0.50, 0.94, 0.07, 'long'), pect=0.07, pelv=0.05, snoutR=0.4, blunt=0.6,
        col=dict(back='#3a4030', side='#7a7a5a', belly='#d8d0b0', fin='#4a4a38'),
        pattern=[('bars', 8, '#2a2a20', 0.35, -0.4, 0.15, 1.0), ('mottle', '#2a2a20', 0.2, 0.0), ('patch', '#d8783a', 0.94, 1.0, -0.2, 0.3)])),
    (32, 'cyprinid', dict(depth=0.28, width=0.5, barbels=[(-0.3, 0.05)], dorsal=[(0.36, 0.68, 0.16, 'long')],
        pect=0.16, pelv=0.13, tailLen=0.25, tailH=0.8, fork=0.35, pectScale=1.3,
        col=dict(back='#9aa89a', side='#e6ece6', belly='#f6f8f4', fin='#e8eee8', finEdge='#b8c8bc'),
        pattern=[('koi', '#5a7a62', 0.35), ('koi', '#7a8a84', 0.15)])),
    (33, 'gar', dict(depth=0.13, width=0.8,
        col=dict(back='#4a4a32', side='#8a8a5a', belly='#d8d0a8', fin='#6a6a44'),
        pattern=[('scales', 0.12, -0.8), ('spots', 0.25, '#2a2a1a', -0.6, 1.0, 0.3, 1.0)])),
    # ---------- 第四區 亂石急流與峽谷河灣 ----------
    (34, 'catfish', dict(depth=0.17, width=0.9, headWide=0.8, flatHead=0.25, barbels=[], adipose=None,
        dorsal=[(0.30, 0.42, 0.08, 'spiny'), (0.46, 0.72, 0.09, 'round')], anal=(0.56, 0.74, 0.07, 'round'),
        pect=0.16, pectScale=1.3, pectSpread=0.9, caudal='round', eyeV=0.7, eyeR=0.03,
        col=dict(back='#5a5040', side='#8a7a5a', belly='#d8ccb0', fin='#6a604a', finEdge='#3a3226'),
        pattern=[('bars', 4, '#3a3226', 0.4, 0.0, 0.25, 0.95), ('mottle', '#3a3226', 0.25, -0.2)])),
    (35, 'perch', dict(depth=0.18, width=0.6, maxAt=0.35, tailLen=0.16,
        dorsal=[(0.28, 0.46, 0.10, 'spiny'), (0.50, 0.68, 0.10, 'round')], anal=(0.64, 0.76, 0.07, 'round'),
        col=dict(back='#5a6a4a', side='#a8b080', belly='#e8c890', fin='#2f6a6a', finEdge='#d8703a'),
        dcol='#d8703a', pattern=[('bars', 8, '#2f6a6a', 0.4, -0.6, 0.2, 0.98), ('patch', '#d8703a', 0.35, 0.95, -0.85, -0.5)])),
    (36, 'minnow', dict(depth=0.21, width=0.5, mouthY=-0.035, tipLen=0.04,
        col=dict(back='#4a5a5a', side='#c8d0cc', belly='#f0f0ec', fin='#d0703a', finEdge='#b0502a'),
        dcol='#6a7270', pattern=[('scales', 0.05, -0.5)])),
    (37, 'salmonid', dict(
        col=dict(back='#4f6a4a', side='#c8c8b0', belly='#f0ece4', fin='#8a8a70'),
        pattern=[('band', 0.0, 0.18, '#d86a7a', 0.08, 1.0), ('spots', 0.3, '#2a2a2a', -0.2, 1.0)])),
    (38, 'catfish', dict(depth=0.19, width=0.7, caudal='fork', fork=0.45, tailH=0.6, anal=(0.62, 0.78, 0.07, 'round'),
        dorsal=[(0.28, 0.36, 0.13, 'tri')], barbels=[(0.5, 0.12), (-0.3, 0.08), (-0.7, 0.07), (-0.9, 0.06)],
        col=dict(back='#5a5a56', side='#9a9890', belly='#e0ddd4', fin='#7a7872'),
        pattern=[('spots', 0.45, '#3a3a38', -0.4, 1.0)])),
    (39, 'minnow', dict(depth=0.22, width=0.45, maxAt=0.42, blunt=0.45, dorsal=[(0.48, 0.60, 0.14, 'tri')],
        col=dict(back='#3e5260', side='#dfe4e6', belly='#f6f6f4', fin='#b07a6a', finEdge='#8a5a4a'),
        pattern=[('scales', 0.04, -0.5)])),
    (40, 'salmonid', dict(
        col=dict(back='#5a6a3a', side='#c8b47a', belly='#e8dcc0', fin='#9a8a5a'),
        pattern=[('patch', '#d83a2a', 0.02, 0.17, -1.0, -0.55), ('spots', 0.45, '#2a2a1a', -0.4, 1.0, 0.45, 1.0),
                 ('spots', 0.12, '#2a2a1a', 0.2, 1.0, 0.1, 0.45)])),
    (41, 'sturgeon', dict(
        col=dict(back='#4a5058', side='#7a8088', belly='#e0dccc', fin='#5a6068', scute='#c8c4b4', barbel='#d8d0c0'))),
    (42, 'pike', dict(depth=0.15,
        col=dict(back='#2e4636', side='#5f8a5a', belly='#f0eccc', fin='#a8603a', finEdge='#7a4020'),
        pattern=[('spots', 0.42, '#d8d8a0', -0.5, 0.75, 0.1, 1.0)])),
    (43, 'salmonid', dict(depth=0.19, width=0.6, maxAt=0.4, dorsal=[(0.40, 0.54, 0.11, 'tri')],
        col=dict(back='#5a3a32', side='#c0503a', belly='#e8c8b0', fin='#8a4a3a'),
        pattern=[('spots', 0.25, '#2a1a1a', -0.3, 1.0), ('grad', ['#a8603a', '#c0503a', '#b03a30'], -0.4, 0.6, 0.5)])),
    (44, 'arapaima', dict(depth=0.17, width=0.72, hump=0.04,
        col=dict(back='#3e4a3e', side='#8a947a', belly='#e0d8c0', fin='#5a4a3a', tail='#a8402e', finEdge='#c84a32'),
        pattern=[('grad', ['#8a947a', '#8a947a', '#a87a5a', '#b8402e', '#b8402e'], -0.7, 0.6, 1.0), ('scales', 0.16, -0.8)])),
    # ---------- 第五區 上游瀑布潭與秘境深淵 ----------
    (45, 'salmonid', dict(depth=0.17, width=0.45, dorsal=[(0.42, 0.54, 0.11, 'tri')], fork=0.45,
        col=dict(back='#8ab0a0', side='#e0ece8', belly='#f6faf8', fin='#d0e0da'),
        pattern=[('band', 0.05, 0.1, '#f8fbfa')])),
    (46, 'salmonid', dict(depth=0.24, width=0.45, snoutR=0.15, fork=0.45,
        col=dict(back='#5a6e7e', side='#dfe4e8', belly='#f6f6f4', fin='#a8b4bc'),
        pattern=[('scales', 0.05, -0.4)])),
    (47, 'salmonid', dict(depth=0.27, hump=0.2, maxAt=0.36, mouthY=-0.01, tipLen=0.045,
        col=dict(back='#c83a2a', side='#d8483a', belly='#e88a6a', fin='#4a6a3a'),
        pattern=[('patch', '#4a6a3a', 0.0, 0.2, -1.0, 1.0)])),
    (48, 'salmonid', dict(depth=0.25, width=0.4, fork=0.45,
        col=dict(back='#2e4a6a', side='#c8d4dc', belly='#f0f2f4', fin='#8a9aac'),
        pattern=[('scales', 0.05, -0.4)])),
    (49, 'salmonid', dict(depth=0.24,
        col=dict(back='#2a4a7a', side='#4a7ab0', belly='#e8904a', fin='#d8603a', finEdge='#f6f6f2'),
        pattern=[('spots', 0.3, '#f0b0a0', -0.3, 0.8)])),
    (50, 'salmonid', dict(depth=0.24, fork=0.12,
        col=dict(back='#2e3e2a', side='#5a6a3a', belly='#e8783a', fin='#d8603a', finEdge='#f6f6f2'),
        pattern=[('mottle', '#8aa060', 0.35, 0.35), ('spots', 0.15, '#d84a3a', -0.3, 0.3), ('spots', 0.12, '#6a9ad8', -0.3, 0.3)])),
    (51, 'sturgeon', dict(snout='paddle', scutes=False, barbels=[], depth=0.14, width=0.6, eyeV=0.3,
        col=dict(back='#5a6a7a', side='#a8b4c0', belly='#e8ecf0', fin='#7a8898', paddle='#6a7a8a'))),
    (52, 'salmonid', dict(depth=0.22, fork=0.55,
        col=dict(back='#2a3a3a', side='#5a6a62', belly='#e8e4d8', fin='#4a5a54'),
        pattern=[('spots', 0.45, '#d8d8b8', -0.4, 1.0)])),
    (53, 'cyprinid', dict(depth=0.30, width=0.52, barbels=[(-0.3, 0.05)], pect=0.17, pectScale=1.4, pectSpread=1.0,
        dorsal=[(0.36, 0.68, 0.13, 'long')], tailLen=0.22,
        col=dict(back='#3a5a8a', side='#e8c048', belly='#f6f0e0', fin='#c86ab0', finEdge='#5ab0c8', tail='#e0a040'),
        pattern=[('grad', ['#d8483a', '#e8903a', '#e8c848', '#6ab06a', '#4a80c8', '#8a5ab8'], -0.6, 0.85, 0.9), ('scales', 0.1, -0.6)])),
    (54, 'catfish', dict(depth=0.18, width=0.8, anal=(0.45, 0.96, 0.08, 'long'), caudal='round', adipose=None,
        barbels=[(0.6, 0.38), (-0.5, 0.18), (-0.8, 0.14)], eye='#c82020', eyeRing='#f0a0a0',
        col=dict(back='#e8d8d0', side='#f4e8e2', belly='#fbf4f0', fin='#f0c8c0', barbel='#f0d0c8'))),
    (55, 'dragon', dict(ribbon=0.5, pect=0.16, pectScale=1.7, tailLen=0.27, tailH=0.85, barbelW=0.008,
        dorsal=[(0.50, 0.93, 0.15, 'long')], anal=(0.46, 0.93, 0.15, 'long'),
        col=dict(back='#c8d8e0', side='#f0f2f4', belly='#fbfaf6', fin='#c8b8e8', finEdge='#f0d890', tail='#d0c0f0'),
        pattern=[('grad', ['#e8f4f2', '#a8e0d8', '#c8b8e8', '#f0d8a0', '#e8c0d8'], -0.7, 1.0, 0.75), ('scales', 0.1, -0.6)])),
]


def params(fam, over):
    P = dict(FAMILY[fam])
    P.update(over)
    for k in ('dcol', 'acol', 'pcol', 'vcol'):
        if isinstance(P.get(k), str):
            from fishgen import hexlin
            P[k] = hexlin(P[k])
    if 'finEdge' in P and isinstance(P['finEdge'], str):
        P['col']['finEdge'] = P.pop('finEdge')
    return P


m = bpy.data.materials.new('fish')
m.use_nodes = True
nt = m.node_tree
bsdf = nt.nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value = 0.55
attr = nt.nodes.new('ShaderNodeVertexColor')
attr.layer_name = 'Color'
nt.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
m.use_backface_culling = False   # 鰭是單片，雙面

for (n, fam, over) in SPECIES:
    o = build_fish(f'f{n:02d}', params(fam, over))
    o.data.materials.append(m)
    o.location = ((n - 1) % 8 * 1.4, ((n - 1) // 8) * 0.8, 0)   # 只是排版預覽，遊戲會重設

os.makedirs(OUT, exist_ok=True)
path = os.path.join(OUT, 'fish.glb')
bpy.ops.export_scene.gltf(
    filepath=path, export_format='GLB', export_animations=False, export_yup=True, export_apply=False,
    export_cameras=False, export_lights=False, export_extras=False, export_texcoords=False,
    export_normals=False, export_materials='EXPORT', export_vertex_color='ACTIVE', export_all_vertex_colors=False,
)
print(f'ok  fish.glb  {os.path.getsize(path) / 1024:.0f} KB')
