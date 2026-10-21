# 入口：blender -b --factory-startup --python blender/glb_heroes.py -- [--only vegeta,goku] [--src ~/Downloads]
# 把 Sketchfab 下載的角色 GLB 換到遊戲骨架上，輸出 ../../assets/198/<id>.glb：
#   1. 匯入、清掉動畫、骨架回到靜止姿勢；
#   2. 把手臂、腿擺成遊戲的 A 字綁定姿勢（models.js 的 BIND：肩 0.75、髖 0.1 弧度），套用成網格的靜止形狀；
#   3. 縮放到遊戲身高、雙腳踩地、髖部在原點；
#   4. 原始骨架的權重依骨名對照表併到遊戲的骨頭（hips、torso、ribs、neck、head、cl／sh／el／wr、fa／fb／fc、tb、th／kn／an／to）；
#   5. 量出各關節在綁定姿勢的位置（遊戲座標：y 朝上、z 朝前），寫進 KI 骨架物件的 extras.ki_joints，執行時 heroSkeleton 照它擺骨頭。
# 原始 GLB 不放進 repo（授權與來源見 games/198-ki-lanes/CREDITS.md），預設從 ~/Downloads 讀，--src 可改。
import json
import math
import os
import re
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

V = Vector
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.normpath(os.path.join(ROOT, '..', '..', 'assets', '198'))
BIND = {'shZ': 0.75, 'thZ': 0.1}

# 每名英雄：來源檔（相對 --src）、骨架家族、身高（頭頂到腳底，公尺；照 models.js 的 PROPS）、要丟掉的網格（物件或材質名稱的正規式）
HEROES = {
    'vegeta': {'src': 'vegeta/thesaiyajin_-_vegeta_bodyguard.glb', 'rig': 'mixamo', 'height': 1.72},
    'luffy': {'src': 'Luffy/monkey_d._luffy.glb', 'rig': 'mixamo', 'height': 1.74},
    'zoro': {'src': 'Roronoa/roronoa_zoro_post_timeskip.glb', 'rig': 'bip001', 'height': 1.81, 'drop': r'Weapon'},
    # 原檔把多個型態疊在同一處：三張臉、握拳與張開兩套手、一般褲管與惡魔風腳（火焰）兩套腿；只留臉 10、張手 16／22、褲管 18／24
    'sanji': {'src': 'Vinsmoke/vinsmoke_sanji_post_timeskip.glb', 'rig': 'bountyrush', 'height': 1.8, 'drop': r'^Object_(11|12|14|20|26|28)$'},
    'nami': {'src': 'nami/nami (1).glb', 'rig': 'ccbase', 'height': 1.7, 'drop': r'^material_[67]$'},
    'piccolo': {'src': 'Piccolo/piccolo_dbxv2.glb', 'rig': 'xv2', 'height': 2.12},
    'frieza': {'src': 'Freezer/frieza_-_emperor_of_the_universe.glb', 'rig': 'ue', 'height': 1.59, 'bind': False},
    # 沒有骨架的模型（rig 'auto'）：lm 是正面圖量的關節（u = x / 身高、v = 離地高 / 身高，只量角色左側＝+x；中線關節只給 v），
    # 前後深度取該處網格切片的中點；yaw 是把模型轉成面向 −y 的角度
    'goku': {'src': 'goku/goku.glb', 'rig': 'auto', 'height': 1.85, 'yaw': 180, 'lm': {
        'hips': 0.47, 'torso': 0.55, 'ribs': 0.63, 'neck': 0.778, 'head': 0.81, 'cl': (0.02, 0.747),
        'sh': (0.131, 0.72), 'el': (0.20, 0.595), 'wr': (0.20, 0.495), 'ft': (0.21, 0.41),
        'th': (0.068, 0.458), 'kn': (0.121, 0.269), 'an': (0.152, 0.075)}},
    'a18': {'src': 'android_18/android_18.glb', 'rig': 'auto', 'height': 1.72, 'lm': {
        'hips': 0.52, 'torso': 0.58, 'ribs': 0.68, 'neck': 0.789, 'head': 0.826, 'cl': (0.02, 0.77),
        'sh': (0.095, 0.768), 'el': (0.231, 0.768), 'wr': (0.362, 0.765), 'ft': (0.457, 0.765),
        'th': (0.053, 0.52), 'kn': (0.058, 0.274), 'an': (0.053, 0.035)}},
    'naruto': {'src': '鳴人/naruto_shippuden-_naruto.glb', 'rig': 'auto', 'height': 1.66, 'lm': {
        'hips': 0.49, 'torso': 0.56, 'ribs': 0.66, 'neck': 0.80, 'head': 0.836, 'cl': (0.02, 0.778),
        'sh': (0.095, 0.773), 'el': (0.226, 0.77), 'wr': (0.362, 0.768), 'ft': (0.457, 0.768),
        'th': (0.047, 0.479), 'kn': (0.053, 0.258), 'an': (0.053, 0.054)}},
    'sasuke': {'src': 'Sasuke/sasuke (1).glb', 'rig': 'auto', 'height': 1.68, 'drop': r'^weapon$', 'lm': {
        'hips': 0.46, 'torso': 0.54, 'ribs': 0.65, 'neck': 0.789, 'head': 0.82, 'cl': (0.03, 0.76),
        'sh': (0.126, 0.757), 'el': (0.21, 0.668), 'wr': (0.289, 0.574), 'ft': (0.362, 0.50),
        'th': (0.058, 0.453), 'kn': (0.105, 0.227), 'an': (0.137, 0.059)}},
    'sakura': {'src': 'Sakura/sakura.glb', 'rig': 'auto', 'height': 1.61, 'drop': r'^material_([6-9]|1\d)$', 'lm': {
        'hips': 0.49, 'torso': 0.56, 'ribs': 0.67, 'neck': 0.82, 'head': 0.847, 'cl': (0.02, 0.79),
        'sh': (0.095, 0.789), 'el': (0.189, 0.679), 'wr': (0.278, 0.579), 'ft': (0.357, 0.51),
        'th': (0.053, 0.479), 'kn': (0.084, 0.264), 'an': (0.116, 0.043)}},
    'trunks': {'src': 'trunks/jump_force___future_trunks_by_petventh_dd3369z.glb', 'rig': 'jumpforce', 'height': 1.838, 'drop': r'^(Mat\.5|NM_Eye\.1)$'},  # 劍；NM_Eye.1 是和 Mat.4 重疊的第二組眼白
}

# 骨架家族：清理過的骨名 → 遊戲骨頭（可分給兩根）。清理：去掉 mixamorig: 之類的前綴與匯入時加上的 _數字、.數字 尾碼。
# {S} 換成該家族的左右寫法（sides），對應遊戲的 L／R。目標 'SKIRT' 是衣襬：一半跟髖、一半跟同側大腿（骨頭在中線就兩腿各半）。
# joints 少了手指（fa／fb／fc／tb）時，依前臂長度在手掌方向上補。
RIGS = {
    'mixamo': {
        'weights': [
            (r'Hips', 'hips'), (r'Spine', 'torso'), (r'Spine1', [('torso', 0.5), ('ribs', 0.5)]), (r'Spine2', 'ribs'),
            (r'Neck', 'neck'), (r'Head(Top_End.*)?', 'head'),
            (r'{S}Shoulder', 'cl{s}'), (r'{S}Arm', 'sh{s}'), (r'{S}ForeArm', 'el{s}'), (r'{S}Hand', 'wr{s}'),
            (r'{S}HandThumb\d.*', 'tb{s}'),
            (r'{S}Hand(Index|Middle|Ring|Pinky)1', 'fa{s}'), (r'{S}Hand(Index|Middle|Ring|Pinky)2', 'fb{s}'),
            (r'{S}Hand(Index|Middle|Ring|Pinky)[34].*', 'fc{s}'),
            (r'{S}UpLeg', 'th{s}'), (r'{S}Leg', 'kn{s}'), (r'{S}Foot', 'an{s}'), (r'{S}Toe.*', 'to{s}'),
        ],
        'joints': {
            'hips': 'Hips', 'torso': 'Spine', 'ribs': 'Spine2', 'neck': 'Neck', 'head': 'Head',
            'cl': '{S}Shoulder', 'sh': '{S}Arm', 'el': '{S}ForeArm', 'wr': '{S}Hand',
            'fa': '{S}HandMiddle1', 'fb': '{S}HandMiddle2', 'fc': '{S}HandMiddle3', 'tb': '{S}HandThumb1',
            'th': '{S}UpLeg', 'kn': '{S}Leg', 'an': '{S}Foot', 'to': '{S}ToeBase',
        },
        'sides': {'L': 'Left', 'R': 'Right'},
    },
    # 3ds Max Biped（One Piece 系列的遊戲模型）：Finger0 是拇指、Finger1～4 是食指到小指，後面再接 1、2 是第二、三節
    'bip001': {
        'weights': [
            (r'Bip001( Pelvis)?', 'hips'), (r'Bip001 Spine', 'torso'), (r'Bip001 Spine1', [('torso', 0.5), ('ribs', 0.5)]), (r'Bip001 Spine2', 'ribs'),
            (r'Bip001 Neck', 'neck'), (r'Bip001 Head', 'head'),
            (r'Bip001 {S} Clavicle', 'cl{s}'), (r'Bip001 ({S} UpperArm|{S}UpArmTwist\d*)', 'sh{s}'), (r'Bip001 ({S} Forearm|{S}ForeTwist\d*)', 'el{s}'),
            (r'Bip001 {S} Hand', 'wr{s}'), (r'Bip001 {S} Finger0\d*', 'tb{s}'),
            (r'Bip001 {S} Finger[1-4]', 'fa{s}'), (r'Bip001 {S} Finger[1-4]1', 'fb{s}'), (r'Bip001 {S} Finger[1-4][2-9]', 'fc{s}'),
            (r'Bip001 ({S} Thigh|{S}ThighTwist\d*)', 'th{s}'), (r'Bip001 ({S} Calf|{S}CalfTwist\d*)', 'kn{s}'),
            (r'Bip001 {S} Foot', 'an{s}'), (r'Bip001 {S} Toe.*', 'to{s}'),
            (r'Bone0[2-8]\d', 'SKIRT'),
        ],
        'joints': {
            'hips': 'Bip001 Pelvis', 'torso': 'Bip001 Spine', 'ribs': 'Bip001 Spine2', 'neck': 'Bip001 Neck', 'head': 'Bip001 Head',
            'cl': 'Bip001 {S} Clavicle', 'sh': 'Bip001 {S} UpperArm', 'el': 'Bip001 {S} Forearm', 'wr': 'Bip001 {S} Hand',
            'fa': 'Bip001 {S} Finger2', 'fb': 'Bip001 {S} Finger21', 'fc': 'Bip001 {S} Finger22', 'tb': 'Bip001 {S} Finger0',
            'th': 'Bip001 {S} Thigh', 'kn': 'Bip001 {S} Calf', 'an': 'Bip001 {S} Foot', 'to': 'Bip001 {S} Toe0',
        },
        'sides': {'L': 'L', 'R': 'R'},
    },
    # One Piece Bounty Rush：手掌沒有指骨；suso 是外套下襬
    'bountyrush': {
        'weights': [
            (r'Body_Pelvis|world_joint', 'hips'), (r'Body_Belly', [('torso', 0.6), ('ribs', 0.4)]), (r'Body_Chest', 'ribs'),
            (r'Head_Neck', 'neck'), (r'Head_.*', 'head'),
            (r'{S}Arm_Clavicle', 'cl{s}'), (r'{S}Arm_Upper', 'sh{s}'), (r'{S}Arm_Fore', 'el{s}'), (r'{S}Hand_.*', 'wr{s}'),
            (r'{S}Leg_Thigh', 'th{s}'), (r'{S}Leg_Calf', 'kn{s}'), (r'{S}Foot_Heel', 'an{s}'), (r'{S}Foot_Toe', 'to{s}'),
            (r'[LR]_suso.*', 'SKIRT'),
        ],
        'joints': {
            'hips': 'Body_Pelvis', 'torso': 'Body_Belly', 'ribs': 'Body_Chest', 'neck': 'Head_Neck', 'head': 'Head_Face',
            'cl': '{S}Arm_Clavicle', 'sh': '{S}Arm_Upper', 'el': '{S}Arm_Fore', 'wr': '{S}Hand_Palm',
            'th': '{S}Leg_Thigh', 'kn': '{S}Leg_Calf', 'an': '{S}Foot_Heel', 'to': '{S}Foot_Toe',
        },
        'sides': {'L': 'L', 'R': 'R'},
    },
    # Reallusion Character Creator
    'ccbase': {
        'weights': [
            (r'CC_Base_(Hip|Pelvis)|RL_BoneRoot', 'hips'), (r'CC_Base_Waist', 'torso'), (r'CC_Base_Spine01', [('torso', 0.5), ('ribs', 0.5)]),
            (r'CC_Base_(Spine02|[LR]_RibsTwist|[LR]_Breast)', 'ribs'), (r'CC_Base_NeckTwist0\d', 'neck'), (r'CC_Base_Head', 'head'),
            (r'CC_Base_{S}_Clavicle', 'cl{s}'), (r'CC_Base_{S}_Upperarm(Twist\d+)?', 'sh{s}'),
            (r'CC_Base_{S}_(Forearm(Twist\d+)?|ElbowShareBone)', 'el{s}'), (r'CC_Base_{S}_Hand', 'wr{s}'),
            (r'CC_Base_{S}_Thumb\d', 'tb{s}'), (r'CC_Base_{S}_(Index|Mid|Ring|Pinky)1', 'fa{s}'), (r'CC_Base_{S}_(Index|Mid|Ring|Pinky)2', 'fb{s}'),
            (r'CC_Base_{S}_(Index|Mid|Ring|Pinky)3', 'fc{s}'),
            (r'CC_Base_{S}_Thigh(Twist\d+)?', 'th{s}'), (r'CC_Base_{S}_(Calf(Twist\d+)?|KneeShareBone)', 'kn{s}'),
            (r'CC_Base_{S}_Foot', 'an{s}'), (r'CC_Base_{S}_(ToeBase.*|.*Toe\d)', 'to{s}'),
        ],
        'joints': {
            'hips': 'CC_Base_Pelvis', 'torso': 'CC_Base_Waist', 'ribs': 'CC_Base_Spine02', 'neck': 'CC_Base_NeckTwist01', 'head': 'CC_Base_Head',
            'cl': 'CC_Base_{S}_Clavicle', 'sh': 'CC_Base_{S}_Upperarm', 'el': 'CC_Base_{S}_Forearm', 'wr': 'CC_Base_{S}_Hand',
            'fa': 'CC_Base_{S}_Mid1', 'fb': 'CC_Base_{S}_Mid2', 'fc': 'CC_Base_{S}_Mid3', 'tb': 'CC_Base_{S}_Thumb1',
            'th': 'CC_Base_{S}_Thigh', 'kn': 'CC_Base_{S}_Calf', 'an': 'CC_Base_{S}_Foot', 'to': 'CC_Base_{S}_ToeBase',
        },
        'sides': {'L': 'L', 'R': 'R'},
    },
    # Dragon Ball Xenoverse 2
    'xv2': {
        'weights': [
            (r'b C Pelvis|Root|Center', 'hips'), (r'b C Spine1', 'torso'), (r'b C Spine2', [('torso', 0.5), ('ribs', 0.5)]), (r'b C Chest', 'ribs'),
            (r'b C Neck\d', 'neck'), (r'b C Head|f .*', 'head'),
            (r'b {S} Shoulder', 'cl{s}'), (r'b {S} Arm1', 'sh{s}'), (r'b {S} Arm2', 'el{s}'), (r'b {S} Hand', 'wr{s}'),
            (r'h {S} Thumb\d', 'tb{s}'), (r'h {S} (Index|Middle|Ring|Pinky)1', 'fa{s}'), (r'h {S} (Index|Middle|Ring|Pinky)2', 'fb{s}'),
            (r'h {S} (Index|Middle|Ring|Pinky)3', 'fc{s}'),
            (r'b {S} Leg1', 'th{s}'), (r'b {S} Leg2', 'kn{s}'), (r'b {S} Foot', 'an{s}'), (r'b {S} Toe', 'to{s}'),
        ],
        'joints': {
            'hips': 'b C Pelvis', 'torso': 'b C Spine2', 'ribs': 'b C Chest', 'neck': 'b C Neck1', 'head': 'b C Head',
            'cl': 'b {S} Shoulder', 'sh': 'b {S} Arm1', 'el': 'b {S} Arm2', 'wr': 'b {S} Hand',
            'fa': 'h {S} Middle1', 'fb': 'h {S} Middle2', 'fc': 'h {S} Middle3', 'tb': 'h {S} Thumb1',
            'th': 'b {S} Leg1', 'kn': 'b {S} Leg2', 'an': 'b {S} Foot', 'to': 'b {S} Toe',
        },
        'sides': {'L': 'L', 'R': 'R'},
    },
    # Unreal 人形骨架（Fortnite 角色）
    'ue': {
        'weights': [
            (r'pelvis|root', 'hips'), (r'spine_0[12]', 'torso'), (r'spine_03', [('torso', 0.5), ('ribs', 0.5)]), (r'spine_0[45]', 'ribs'),
            (r'neck_0\d', 'neck'), (r'head', 'head'),
            (r'clavicle_{S}', 'cl{s}'), (r'upperarm(_twist_\d+)?_{S}', 'sh{s}'), (r'lowerarm(_twist_\d+)?_{S}', 'el{s}'),
            (r'hand_{S}|(index|middle|ring|pinky)_metacarpal_{S}', 'wr{s}'), (r'thumb_\d+_{S}', 'tb{s}'),
            (r'(index|middle|ring|pinky)_01_{S}', 'fa{s}'), (r'(index|middle|ring|pinky)_02_{S}', 'fb{s}'), (r'(index|middle|ring|pinky)_03_{S}', 'fc{s}'),
            (r'thigh(_twist_\d+)?_{S}', 'th{s}'), (r'calf(_twist_\d+)?_{S}', 'kn{s}'), (r'foot_{S}', 'an{s}'), (r'ball_{S}', 'to{s}'),
        ],
        'joints': {
            'hips': 'pelvis', 'torso': 'spine_02', 'ribs': 'spine_04', 'neck': 'neck_01', 'head': 'head',
            'cl': 'clavicle_{S}', 'sh': 'upperarm_{S}', 'el': 'lowerarm_{S}', 'wr': 'hand_{S}',
            'fa': 'middle_01_{S}', 'fb': 'middle_02_{S}', 'fc': 'middle_03_{S}', 'tb': 'thumb_01_{S}',
            'th': 'thigh_{S}', 'kn': 'calf_{S}', 'an': 'foot_{S}', 'to': 'ball_{S}',
        },
        'sides': {'L': 'l', 'R': 'r'},
    },
    # Jump Force：CLANK 是膝、TOE1 是踝、TOE2 是腳尖；F_FORE／MIDDLE／MEDICINAL／LITTLE 是食指到小指
    'jumpforce': {
        'weights': [
            (r'WAIST|RESERVE|chr\d+', 'hips'), (r'SPINE1', 'torso'), (r'SPINE2', [('torso', 0.5), ('ribs', 0.5)]), (r'SPINE3|CLOTH_.*', 'ribs'),
            (r'NECK', 'neck'), (r'HEAD|FACE|HAIR.*', 'head'),
            (r'CLAVICLE(ROLL)?_{S}', 'cl{s}'), (r'SHOULDER_{S}', 'sh{s}'), (r'ELBOW(ROLL)?_{S}C?', 'el{s}'), (r'WRIST_{S}|EFFECT_{S}', 'wr{s}'),
            (r'F_THUMB\d_{S}', 'tb{s}'), (r'F_(FORE|MIDDLE|MEDICINAL|LITTLE)1_{S}', 'fa{s}'), (r'F_(FORE|MIDDLE|MEDICINAL|LITTLE)2_{S}', 'fb{s}'),
            (r'F_(FORE|MIDDLE|MEDICINAL|LITTLE)3_{S}', 'fc{s}'),
            (r'THIGH_{S}', 'th{s}'), (r'CLANK_{S}C?|DCLOTH_\d+_{S}', 'kn{s}'), (r'TOE1_{S}', 'an{s}'), (r'TOE2_{S}', 'to{s}'),
        ],
        'joints': {
            'hips': 'WAIST', 'torso': 'SPINE1', 'ribs': 'SPINE3', 'neck': 'NECK', 'head': 'HEAD',
            'cl': 'CLAVICLE_{S}', 'sh': 'SHOULDER_{S}', 'el': 'ELBOW_{S}', 'wr': 'WRIST_{S}',
            'fa': 'F_MIDDLE1_{S}', 'fb': 'F_MIDDLE2_{S}', 'fc': 'F_MIDDLE3_{S}', 'tb': 'F_THUMB1_{S}',
            'th': 'THIGH_{S}', 'kn': 'CLANK_{S}', 'an': 'TOE1_{S}', 'to': 'TOE2_{S}',
        },
        'sides': {'L': 'L', 'R': 'R'},
    },
}

# 自動綁骨產生的骨架直接用遊戲骨名
RIGS['auto'] = {
    'weights': [(n, n) for n in ('hips', 'torso', 'ribs', 'neck', 'head')] +
               [(b + '{S}', b + '{s}') for b in ('cl', 'sh', 'el', 'wr', 'fa', 'fb', 'fc', 'tb', 'th', 'kn', 'an', 'to')],
    'joints': {**{n: n for n in ('hips', 'torso', 'ribs', 'neck', 'head')},
               **{b: b + '{S}' for b in ('cl', 'sh', 'el', 'wr', 'fa', 'fb', 'fc', 'tb', 'th', 'kn', 'an', 'to')}},
    'sides': {'L': 'L', 'R': 'R'},
}

GAME_BONES = ['hips', 'torso', 'ribs', 'neck', 'head'] + [b + s for s in 'LR' for b in ('cl', 'sh', 'el', 'wr', 'fa', 'fb', 'fc', 'tb', 'th', 'kn', 'an', 'to')]
PARENT = {'torso': 'hips', 'ribs': 'torso', 'neck': 'ribs', 'head': 'neck'}
for s in 'LR':
    PARENT.update({'cl' + s: 'ribs', 'sh' + s: 'cl' + s, 'el' + s: 'sh' + s, 'wr' + s: 'el' + s, 'fa' + s: 'wr' + s, 'fb' + s: 'fa' + s,
                   'fc' + s: 'fb' + s, 'tb' + s: 'wr' + s, 'th' + s: 'hips', 'kn' + s: 'th' + s, 'an' + s: 'kn' + s, 'to' + s: 'an' + s})


def args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    o = {'only': None, 'src': os.path.expanduser('~/Downloads')}
    for k, a in enumerate(argv):
        if a == '--only':
            o['only'] = argv[k + 1].split(',')
        elif a == '--src':
            o['src'] = os.path.expanduser(argv[k + 1])
    return o


def clean(name):
    n = re.sub(r'_\d+$', '', name.split(':')[-1])   # 匯入時加的序號（只去一層：UE 的 spine_01 本身就帶數字）
    return re.sub(r'\.\d+$', '', n)                  # CC 的 .N


def compile_rig(fam):
    R = RIGS[fam]
    rules = []
    for pat, tgt in R['weights']:
        if '{S}' in pat:
            for s, S in R['sides'].items():
                t = [(a.format(s=s), w) for a, w in tgt] if isinstance(tgt, list) else [(tgt.format(s=s), 1.0)]
                rules.append((re.compile('^(?:' + pat.replace('{S}', S) + ')$'), t))
        else:
            rules.append((re.compile('^(?:' + pat + ')$'), tgt if isinstance(tgt, list) else [(tgt, 1.0)]))
    return rules


def target_of(rules, bname):
    c = clean(bname)
    for rx, t in rules:
        if rx.match(c):
            return t
    return None


def find_bone(arm, cname):
    for b in arm.data.bones:
        if clean(b.name) == cname:
            return b
    raise KeyError('找不到骨頭 ' + cname)


def sharp_by_angle(me, ang):
    """兩面夾角大於 ang 的邊標成銳邊（匯出時在那裡切開法線），其餘平滑。"""
    bm = bmesh.new()
    bm.from_mesh(me)
    for e in bm.edges:
        e.smooth = not (len(e.link_faces) == 2 and e.calc_face_angle(0) > ang)
    bm.to_mesh(me)
    bm.free()


# ---------------------------------------------------------------- 擺成 A 字
def rotate_about(pb, R, pivot):
    """在骨架空間繞 pivot 旋轉 R（3×3）這根骨頭（子骨跟著走）。"""
    T = Matrix.Translation(pivot) @ R.to_4x4() @ Matrix.Translation(-pivot)
    pb.matrix = T @ pb.matrix
    bpy.context.view_layer.update()


def aim(arm, pb, child_head, target_dir_world):
    """把骨頭從自己的頭指向 child_head（骨架空間）的方向轉到 target_dir_world（世界方向）。"""
    Mi = arm.matrix_world.to_3x3().inverted()
    tgt = (Mi @ target_dir_world).normalized()
    cur = (child_head() - pb.head).normalized()
    rotate_about(pb, cur.rotation_difference(tgt).to_matrix(), pb.head.copy())


def repose(arm, J, sides):
    pbs = arm.pose.bones
    P = lambda key, s: pbs[find_bone(arm, J[key].replace('{S}', sides[s])).name]
    a, t = BIND['shZ'], BIND['thZ']
    for s, sx in (('L', 1), ('R', -1)):
        arm_dir = V((sx * math.sin(a), 0, -math.cos(a)))
        leg_dir = V((sx * math.sin(t), 0, -math.cos(t)))
        sh, el, wr = P('sh', s), P('el', s), P('wr', s)
        aim(arm, sh, lambda: el.head, arm_dir)
        aim(arm, el, lambda: wr.head, arm_dir)
        if 'fb' in J:
            fb = P('fb', s)
            aim(arm, wr, lambda: fb.head, arm_dir)
        th, kn, an = P('th', s), P('kn', s), P('an', s)
        foot_rot = an.matrix.to_3x3().copy()   # 腳掌維持原本的朝向（腳尖朝前、腳底平）
        aim(arm, th, lambda: kn.head, leg_dir)
        aim(arm, kn, lambda: an.head, leg_dir)
        rotate_about(an, foot_rot @ an.matrix.to_3x3().inverted(), an.head.copy())


# ---------------------------------------------------------------- 沒有骨架：依量好的關節建骨架、自動刷權重
def autorig(sc, cfg):
    import numpy as np
    drop = re.compile(cfg['drop']) if cfg.get('drop') else None
    for o in list(sc.objects):
        if o.type == 'MESH' and (o.name.startswith('Icosphere') or (drop and (drop.search(o.name) or any(
                drop.search(s.material.name) for s in o.material_slots if s.material)))):
            bpy.data.objects.remove(o, do_unlink=True)
    meshes = [o for o in sc.objects if o.type == 'MESH']
    Ry = Matrix.Rotation(math.radians(cfg.get('yaw', 0)), 4, 'Z')
    for o in meshes:   # 套用世界變換（含轉向），網格資料就是世界座標
        mw = Ry @ o.matrix_world
        o.parent = None
        o.data.transform(mw)
        o.matrix_world = Matrix.Identity(4)
    for o in list(sc.objects):
        if o.type != 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)
    P = np.array([tuple(v.co) for o in meshes for v in o.data.vertices])
    z0 = P[:, 2].min()
    k = cfg['height'] / (np.percentile(P[:, 2], 99.95) - z0)   # 先縮到遊戲身高（熱擴散權重對尺度敏感）
    for o in meshes:
        o.data.transform(Matrix.Scale(k, 4) @ Matrix.Translation((0, 0, -z0)))
    for o in meshes:   # UV 縫上的重複頂點合起來（不然熱擴散會失敗；UV 存在面角上，不受影響）
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5 * cfg['height'])
        bm.to_mesh(o.data)
        bm.free()
    P = np.array([tuple(v.co) for o in meshes for v in o.data.vertices])
    H = cfg['height']
    lm = cfg['lm']

    def depth(x, z, rx, rz):   # 該處切片的前後中點
        m = (abs(P[:, 0] - x) < rx) & (abs(P[:, 2] - z) < rz)
        if m.sum() < 4:
            return 0.0
        ys = P[m, 1]
        return float((np.percentile(ys, 5) + np.percentile(ys, 95)) / 2)
    J = {}
    for n in ('hips', 'torso', 'ribs', 'neck', 'head'):
        z = lm[n] * H
        J[n] = V((0, depth(0, z, 0.06 * H, 0.02 * H), z))
    for s, sx in (('L', 1), ('R', -1)):
        for n in ('cl', 'sh', 'el', 'wr', 'ft', 'th', 'kn', 'an'):
            x, z = sx * lm[n][0] * H, lm[n][1] * H
            J[n + s] = V((x, depth(x, z, 0.035 * H, 0.035 * H), z))
        a = J['an' + s]
        m = (abs(P[:, 0] - a.x) < 0.06 * H) & (P[:, 2] < a.z)
        tip, heel = float(np.percentile(P[m, 1], 2)), float(np.percentile(P[m, 1], 98))   # 前方是 −y
        J['to' + s] = V((a.x, heel + 0.75 * (tip - heel), 0.03 * H))
        J['tt' + s] = V((a.x, tip, 0.02 * H))
        w, d = J['wr' + s], J['ft' + s] - J['wr' + s]
        for n, f in (('fa', 0.5), ('fb', 0.7), ('fc', 0.85)):
            J[n + s] = w + d * f
        J['tb' + s] = w + d * 0.2 + V((0, -0.25 * d.length, 0))
    tail = {'hips': 'torso', 'torso': 'ribs', 'ribs': 'neck', 'neck': 'head'}
    for s in 'LR':
        tail.update({n + s: c + s for n, c in (('cl', 'sh'), ('sh', 'el'), ('el', 'wr'), ('wr', 'fa'), ('fa', 'fb'), ('fb', 'fc'),
                                               ('fc', 'ft'), ('th', 'kn'), ('kn', 'an'), ('an', 'to'), ('to', 'tt'))})
    ad = bpy.data.armatures.new('AUTO')
    ao = bpy.data.objects.new('AUTO', ad)
    sc.collection.objects.link(ao)
    bpy.context.view_layer.objects.active = ao
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for n in GAME_BONES:
        b = ad.edit_bones.new(n)
        b.head = J[n]
        if n == 'head':
            b.tail = J[n] + V((0, 0, 0.12 * H))
        elif n[:2] == 'tb':
            b.tail = J[n] + (J['fa' + n[2]] - J['wr' + n[2]]) * 0.6
        else:
            b.tail = J[tail[n]]
        eb[n] = b
    for n, p in PARENT.items():
        eb[n].parent = eb[p]
    bpy.ops.object.mode_set(mode='OBJECT')
    # 熱擴散權重：遊戲拆檔多半不封閉、零件分離，直接算常會失敗。先用體素重建一個封閉的代理網格算權重，
    # 再以最近面內插轉移回原網格；仍分不到的頂點改用最近的骨段
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.duplicate()
    if len(bpy.context.selected_objects) > 1:
        bpy.ops.object.join()
    px = bpy.context.view_layer.objects.active
    px.name = 'proxy'
    for g in list(px.vertex_groups):
        px.vertex_groups.remove(g)
    rm = px.modifiers.new('vox', 'REMESH')
    rm.mode = 'VOXEL'
    rm.voxel_size = cfg.get('voxel', 0.008)
    bpy.ops.object.modifier_apply(modifier=rm.name)
    bm = bmesh.new()   # 只留範圍內有關節的連通塊：裡面的眼球、分離的小零件看不到任何骨頭，會讓熱擴散整個解不出來
    bm.from_mesh(px.data)
    seen, parts = set(), []
    for v0 in bm.verts:
        if v0 in seen:
            continue
        comp, stack = [], [v0]
        seen.add(v0)
        while stack:
            v = stack.pop()
            comp.append(v)
            for e in v.link_edges:
                w = e.other_vert(v)
                if w not in seen:
                    seen.add(w)
                    stack.append(w)
        parts.append(comp)
    JP = np.array([tuple(p) for p in J.values()])
    parts.sort(key=len)

    def has_joint(c):
        Q = np.array([tuple(v.co) for v in c])
        lo, hi = Q.min(0) - 0.01 * H, Q.max(0) + 0.01 * H
        return bool(((JP >= lo) & (JP <= hi)).all(1).any())
    bmesh.ops.delete(bm, geom=[v for c in parts[:-1] if not has_joint(c) for v in c], context='VERTS')
    bm.to_mesh(px.data)
    bm.free()
    bpy.ops.object.select_all(action='DESELECT')
    px.select_set(True)
    ao.select_set(True)
    bpy.context.view_layer.objects.active = ao
    px.scale = ao.scale = (10, 10, 10)   # 熱擴散在一公尺上下的尺度容易解不出來，放大十倍再算
    bpy.context.view_layer.update()
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    px.parent = None
    px.scale = ao.scale = (1, 1, 1)
    bpy.context.view_layer.update()
    print('  代理網格 %d 頂點，有權重 %d，群組 %d' % (len(px.data.vertices), sum(1 for v in px.data.vertices if v.groups), len(px.vertex_groups)))
    if os.environ.get('KI_DEBUG'):
        from collections import Counter
        c = Counter(px.vertex_groups[max(v.groups, key=lambda g: g.weight).group].name for v in px.data.vertices if v.groups)
        print('  代理權重', sorted(c.items()))
        print('  關節', {n: tuple(round(x, 3) for x in J[n]) for n in ('clL', 'shL', 'elL', 'wrL', 'ftL')})

    for o in meshes:
        bpy.ops.object.select_all(action='DESELECT')
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        dt = o.modifiers.new('wt', 'DATA_TRANSFER')
        dt.object = px
        dt.use_vert_data = True
        dt.data_types_verts = {'VGROUP_WEIGHTS'}
        dt.vert_mapping = 'POLYINTERP_NEAREST'
        dt.layers_vgroup_select_src = 'ALL'
        dt.layers_vgroup_select_dst = 'NAME'
        bpy.ops.object.datalayout_transfer(modifier=dt.name)
        bpy.ops.object.modifier_apply(modifier=dt.name)
        am = o.modifiers.new('AUTO', 'ARMATURE')
        am.object = ao
        o.parent = ao
    bpy.data.objects.remove(px, do_unlink=True)
    # 越過肩關節的鎖骨權重漸進移給上臂（熱擴散有時把整段上臂算給鎖骨）
    for o in meshes:
        for s in 'LR':
            gc, gs = o.vertex_groups.get('cl' + s), o.vertex_groups.get('sh' + s)
            if not gc:
                continue
            gs = gs or o.vertex_groups.new(name='sh' + s)
            sh, el = J['sh' + s], J['el' + s]
            ax = el - sh
            for v in o.data.vertices:
                w = next((g.weight for g in v.groups if g.group == gc.index), 0)
                if w <= 0:
                    continue
                t = (v.co - sh).dot(ax) / ax.length_squared
                if t > 0:
                    f = min(1.0, t * 4)
                    ws = next((g.weight for g in v.groups if g.group == gs.index), 0)
                    gc.add([v.index], w * (1 - f), 'REPLACE')
                    gs.add([v.index], ws + w * f, 'REPLACE')
    segs = [(n, np.array(tuple(J[n])), np.array(tuple(J[tail[n]] if n in tail else J[n] + V((0, 0, 0.12 * H))))) for n in GAME_BONES if n[:2] != 'tb']
    A = np.array([a for _, a, _ in segs])
    B = np.array([b for _, _, b in segs])
    AB = B - A
    L2 = np.maximum((AB * AB).sum(1), 1e-12)
    fixed = total = 0
    for o in meshes:
        for v in o.data.vertices:
            total += 1
            if sum(g.weight for g in v.groups) > 1e-3:
                continue
            p = np.array(tuple(v.co))
            t = np.clip(((p - A) * AB).sum(1) / L2, 0, 1)
            d = np.linalg.norm(p - (A + AB * t[:, None]), axis=1)
            near = np.argsort(d)[:3]
            w = 1 / np.maximum(d[near], 0.01 * H) ** 4
            for i, wi in zip(near, w / w.sum()):
                if wi > 0.02:
                    n = segs[i][0]
                    (o.vertex_groups.get(n) or o.vertex_groups.new(name=n)).add([v.index], float(wi), 'REPLACE')
            fixed += 1
    print('  自動權重：%d / %d 個頂點改用最近骨段' % (fixed, total))


# ---------------------------------------------------------------- 主流程
def build(hid, cfg, opt):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # bind=False：有些遊戲拆檔的靜止姿勢和蒙皮綁定姿勢對不上（Frieza），不讓匯入器猜綁定姿勢
    bpy.ops.import_scene.gltf(filepath=os.path.join(opt['src'], cfg['src']), guess_original_bind_pose=cfg.get('bind', True))
    sc = bpy.context.scene
    if cfg['rig'] == 'auto':
        autorig(sc, cfg)
    arms = [o for o in sc.objects if o.type == 'ARMATURE']
    arm = max(arms, key=lambda o: len(o.data.bones))
    for o in sc.objects:
        if o.animation_data:
            o.animation_data.action = None
            o.animation_data_clear()
    for pb in arm.pose.bones:
        pb.matrix_basis.identity()
    bpy.context.view_layer.update()
    drop = re.compile(cfg['drop']) if cfg.get('drop') else None
    meshes = [o for o in sc.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' and m.object == arm for m in o.modifiers)
              and not (drop and (drop.search(o.name) or any(drop.search(s.material.name) for s in o.material_slots if s.material)))]
    R = RIGS[cfg['rig']]
    repose(arm, R['joints'], R['sides'])
    # 量關節（世界座標，Blender z 朝上、−y 朝前）
    W = arm.matrix_world
    jw = {}
    for key, nm in R['joints'].items():
        for s in ('L', 'R') if '{S}' in nm else ('',):
            b = arm.pose.bones[find_bone(arm, nm.replace('{S}', R['sides'][s]) if s else nm).name]
            jw[key + s] = W @ b.head
    for s in 'LR':
        if 'fa' not in R['joints']:   # 沒有指骨：手掌長約前臂的 0.72，指節依比例排在前臂的延長線上
            d = jw['wr' + s] - jw['el' + s]
            hand = d.length * 0.72
            d.normalize()
            for k, f in (('fa', 0.45), ('fb', 0.65), ('fc', 0.82)):
                jw[k + s] = jw['wr' + s] + d * f * hand
            jw['tb' + s] = jw['wr' + s] + d * 0.2 * hand + V((0, -0.12 * hand, 0))   # 拇指偏前
        jw['ft' + s] = jw['fc' + s] + (jw['fc' + s] - jw['fb' + s])   # 指尖：中指第三節再往前延伸一節
    # 網格套用目前姿勢，合成一個物件
    dg = bpy.context.evaluated_depsgraph_get()
    for o in meshes:
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        for m in list(o.modifiers):
            if m.type == 'ARMATURE':
                bpy.ops.object.modifier_apply(modifier=m.name)
    for o in sc.objects:
        o.select_set(o in meshes)
    bpy.context.view_layer.objects.active = meshes[0]
    for o in meshes:   # 解除父子關係並保留世界變換
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # 面的繞向與法線：Sketchfab 模型常有翻面、法線不一致，原檔靠 doubleSided 遮掉；遊戲材質只畫正面、外框殼畫背面，
    # 繞向反了會整片變黑。依拓樸把每塊相連的面統一朝外，清掉原檔的自訂法線，改用平滑法線（銳角邊照角度切開）
    for o in meshes:
        me = o.data
        bm = bmesh.new()
        bm.from_mesh(me)
        # 有些原檔每個三角形各自一組頂點：先合併重複頂點（UV 與權重在接縫兩側相同，不受影響），減面與法線才接得起來
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6 * max(o.dimensions))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        if me.has_custom_normals:
            bpy.context.view_layer.objects.active = o
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
        for p in me.polygons:
            p.use_smooth = True
        sharp_by_angle(me, math.radians(cfg.get('sharp', 70)))
    if len(meshes) > 1:
        bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = hid
    # 面數上限（預設 12000 三角形）：塌陷減面會一併內插頂點群組的權重
    cap = cfg.get('tris', 12000)
    n = sum(len(p.vertices) - 2 for p in body.data.polygons)
    if n > cap:
        dm = body.modifiers.new('dec', 'DECIMATE')
        dm.ratio = cap / n
        bpy.ops.object.modifier_apply(modifier=dm.name)
    # 縮放、落地、置中（髖部 x、y 歸零）
    zs = [v.co.z for v in body.data.vertices]
    zs.sort()
    top, bot = zs[int(len(zs) * 0.9995)], zs[0]
    k = cfg['height'] / (top - bot)
    off = V((-jw['hips'].x, -jw['hips'].y, -bot))
    Mx = Matrix.Scale(k, 4) @ Matrix.Translation(off)
    body.data.transform(Mx)
    jw = {n: Mx @ p for n, p in jw.items()}
    # 權重：原始骨頭的群組併到遊戲骨頭
    rules = compile_rig(cfg['rig'])
    bones = {b.name: b for b in arm.data.bones}
    hipx = abs(find_bone(arm, R['joints']['th'].replace('{S}', R['sides']['L'])).head_local.x)

    def skirt(b):   # 衣襬：看骨頭在哪一側
        x = b.head_local.x
        if abs(x) < 0.35 * hipx:
            return [('hips', 0.5), ('thL', 0.25), ('thR', 0.25)]
        return [('hips', 0.5), ('thL' if x > 0 else 'thR', 0.5)]
    tgt = {}
    for g in body.vertex_groups:
        b = bones.get(g.name)
        t = None
        while b is not None and t is None:
            t = target_of(rules, b.name)
            if t and t[0][0] == 'SKIRT':
                t = skirt(b)
            b = b.parent
        tgt[g.index] = t or [('hips', 1.0)]
    nv = len(body.data.vertices)
    acc = [dict() for _ in range(nv)]
    for v in body.data.vertices:
        for ge in v.groups:
            for gb, w in tgt.get(ge.group, ()):
                acc[v.index][gb] = acc[v.index].get(gb, 0) + ge.weight * w
    for g in list(body.vertex_groups):
        body.vertex_groups.remove(g)
    vg = {n: body.vertex_groups.new(name=n) for n in GAME_BONES}
    empty = 0
    for i, a in enumerate(acc):
        top4 = sorted(a.items(), key=lambda kv: -kv[1])[:4]
        tot = sum(w for _, w in top4)
        if tot <= 1e-6:
            empty += 1
            vg['hips'].add([i], 1.0, 'REPLACE')
            continue
        for n, w in top4:
            vg[n].add([i], w / tot, 'REPLACE')
    if empty:
        print('  警告：%d 個頂點沒有權重，給 hips' % empty)
    # 原始骨架與其他物件全部刪掉，只留身體
    for o in list(sc.objects):
        if o != body:
            bpy.data.objects.remove(o, do_unlink=True)
    # 遊戲骨架（只為了輸出權重的骨名；執行時用遊戲自己的骨頭）
    ad = bpy.data.armatures.new('KI')
    ko = bpy.data.objects.new('KI', ad)
    sc.collection.objects.link(ko)
    bpy.context.view_layer.objects.active = ko
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for n in GAME_BONES:
        b = ad.edit_bones.new(n)
        b.head = jw[n]
        b.tail = jw[n] + V((0, 0, 0.05))
        eb[n] = b
    for n, p in PARENT.items():
        eb[n].parent = eb[p]
    bpy.ops.object.mode_set(mode='OBJECT')
    body.parent = ko
    mod = body.modifiers.new('KI', 'ARMATURE')
    mod.object = ko
    # 關節表（遊戲座標：x 同、y＝Blender z、z＝−Blender y）
    g = lambda p: [round(p.x, 5), round(p.z, 5), round(-p.y, 5)]
    ko['ki_joints'] = json.dumps({n: g(p) for n, p in jw.items()})
    ko['ki_height'] = cfg['height']
    # 貼圖縮到 512（遊戲鏡頭下角色約一百多像素高，開場要一次載完十三名英雄）
    tex = cfg.get('tex', 512)
    for im in bpy.data.images:
        if im.size[0] > tex or im.size[1] > tex:
            s = tex / max(im.size)
            im.scale(max(1, int(im.size[0] * s)), max(1, int(im.size[1] * s)))
    tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, hid + '.glb')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_animations=False, export_skins=True,
                              export_extras=True, export_yup=True, export_image_format='JPEG', export_jpeg_quality=85,
                              export_morph=False, export_cameras=False, export_lights=False)
    print('  %s：%d 三角形、%d KB → %s' % (hid, tris, os.path.getsize(out) // 1024, out))


def main():
    opt = args()
    for hid in opt['only'] or list(HEROES):
        build(hid, HEROES[hid], opt)


main()
