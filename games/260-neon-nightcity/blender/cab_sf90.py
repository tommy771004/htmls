# 霓虹夜城（260）sf90 補上的儀表 → blender/out/cab_sf90.glb ＋ cab_sf90.json，tools/cab-swap.mjs sf90 加進 assets/260/sf90.glb（不切原車內）
# 執行：/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P blender/cab_sf90.py（先跑 node tools/cab-tex.mjs）
# 原模型方向盤後面的遮光罩裡只有一面黑牆（沒有儀表）。這裡只在那面牆前面貼一片寬幅曲面液晶：
# 中間黃底大圓轉速、左導航、右駕駛模式（atlas_sf90，不放廠牌字樣）。
# 對齊原模型：方向盤 sw (.344, .72, .356) 傾角 16；遮光罩後壁在 z .62–.65、y .72–.85，上緣唇邊 y .85–.89（x .28–.43）。
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cab_common import *

PAL = {
    'gauge': dict(col='#ffffff', r=.3, tex='atlas_sf90', emi=.5),
    'gloss_blk': dict(col='#0a0a0c', r=.1),
}
setup('cab_sf90', PAL)

cluster((.344, .785, .608), 8, .26, .26 * 160 / 512, (0, 0, 512, 160), hood=None, frame_mat='gloss_blk')
finish([])
