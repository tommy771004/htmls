# -*- coding: utf-8 -*-
"""白模共用零件：握把與護弓照抄 AR5／P9 的尺寸，手臂的握持解才有東西可貼。

只有 <id>.py 還是白模時會用到。換成正式模型後不要再 import 這個檔。
建模座標：X 右、Y 前（槍口）、Z 上，握把在原點，公尺。
"""
import math


def rifle_grip(g, H, mat='grip', frame='poly'):
    """步槍握把、扳機、護弓。尺寸同 AR5，所以 POSE['r'] 可以直接沿用 AR5。"""
    def gsec(s):
        rx = .0135 + .0012 * math.sin(s * 3.14)
        return H.fillet([(-rx, -.021 - .002 * s, .0085), (rx, -.021 - .002 * s, .0085), (rx, .021 + .001 * s, .0095), (-rx, .021 + .001 * s, .0095)], seg=4)
    a = (0, .016, .034); b = (0, -.030, -.074)
    g.add(H.loft_frames(H.grip_stations(a, b, gsec, 6, -.002), 'grip'), mat, H.BW_MID)
    outer = H.fillet([(.018, .032, .002), (.024, -.010, .009), (.082, -.016, .010), (.100, -.003, .006), (.104, .032, .002)], seg=4)
    inner = H.fillet([(.0265, .036, .001), (.0305, -.0040, .006), (.0795, -.0095, .007), (.0935, -.0005, .004), (.0955, .036, .001)], seg=4)
    tg = H.prism(outer, -.0078, .0078, 'yz', 'tg'); H.cut(tg, H.prism(inner, -.02, .02, 'yz'))
    g.add(tg, frame, H.BW_MID)
    g.add(H.prism(H.fillet([(.0590, .034, .0), (.0650, .034, .0), (.0640, .004, .0015), (.0585, .0015, .002), (.0565, .0030, .0)], seg=3), -.0036, .0036, 'yz', 'trg'), 'steel', H.BW_FINE)


def pistol_grip(g, H):
    """手槍握把、扳機、護弓。尺寸同 P9。"""
    def gsec(s):
        rx = .0132 + .0013 * math.sin(s * 3.14)
        return H.fillet([(-rx, -.0235 - .0015 * s, .0090), (rx, -.0235 - .0015 * s, .0090), (rx, .0205 + .0015 * s, .0065), (-rx, .0205 + .0015 * s, .0065)], seg=4)
    a = (0, .0100, .0335); b = (0, -.0235, -.0640)
    g.add(H.loft_frames(H.grip_stations(a, b, gsec, 6, -.0012), 'grip'), 'grip', H.BW_MID)
    outer = H.fillet([(.0160, .0330, .002), (.0220, -.0040, .007), (.0720, -.0085, .004), (.0760, -.0060, .002), (.0800, .0030, .003), (.0815, .0330, .002)], seg=3)
    inner = H.fillet([(.0240, .0350, .001), (.0285, .0010, .005), (.0690, -.0030, .003), (.0735, .0060, .002), (.0750, .0350, .001)], seg=3)
    tg = H.prism(outer, -.0078, .0078, 'yz', 'tg'); H.cut(tg, H.prism(inner, -.02, .02, 'yz'))
    g.add(tg, 'poly', H.BW_MID)
    g.add(H.prism(H.fillet([(.0465, .0340, .0), (.0530, .0340, .0), (.0500, .0180, .004), (.0445, .0065, .002), (.0420, .0070, .001), (.0465, .0180, .005)], seg=3), -.0040, .0040, 'yz', 'trg'), 'steel', H.BW_FINE)


def body(g, H, y0, y1, z0, z1, hw, mat='alum'):
    """機匣或護木：倒角方盒。"""
    g.add(H.box(-hw, hw, y0, y1, z0, z1), mat, H.BW_MID)


def barrel(g, H, y0, y1, r, z):
    g.add(H.cyl((0, z), r, y0, y1, n=20), 'steel', None)


def mag(g, H, y0, y1, z0, z1, hw, x=0.0, mat='poly'):
    """彈匣或彈鏈盒：獨立的 mag 群組，輸出成 <id>_mag 節點。"""
    g.add(H.box(x - hw, x + hw, y0, y1, z0, z1), mat, H.BW_FINE, group='mag')
