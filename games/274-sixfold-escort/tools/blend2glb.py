# BlenderKit 下載的 .blend 轉成 GLB（給 tools/models.json → pack-models.mjs 用）。
# 用法：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P tools/blend2glb.py -- <原檔.blend> <輸出.glb>
#   輸出放 .cache/models/blenderkit/<uuid 前 8 碼>_<名稱>.glb（.cache/ 不進 git）。
#   會刪掉攝影機、燈光，解開打包在 .blend 裡的貼圖，套用修改器後輸出（+Y 朝上）。
#   之後高模要減面破洞的件，在 models.json 加 prep.bake（tools/prep-models.mjs 會再呼叫 bake-model.py）。
import bpy, sys
src, dst = sys.argv[sys.argv.index('--') + 1:][:2]
bpy.ops.wm.open_mainfile(filepath=src)
# 攝影機、燈光不輸出；隱藏的物件也輸出（use_visible=False）
for o in list(bpy.data.objects):
    if o.type in ('CAMERA', 'LIGHT'):
        bpy.data.objects.remove(o, do_unlink=True)
try:
    bpy.ops.file.unpack_all(method='USE_LOCAL')
except Exception as e:
    print('unpack skip', e)
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_apply=True, export_yup=True, use_visible=False, export_image_format='AUTO')
print('EXPORTED', dst)
