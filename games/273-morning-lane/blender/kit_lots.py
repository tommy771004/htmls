# 房型清單：參考圖的街區與遊戲匯出的 12 種房子共用（export.py 依序匯出成 house0–house11）。
from kit_common import ST

# 週一路線的一段：每塊地的房型與訂戶旗標（之後 greybox 用同一份資料）
LOTS = [
    # side, i, 房型, 訂戶
    (1, -2, dict(W=10.5, D=8.5, stories=2, roof='front', color='honey', roofc='shingleBrown', door='door1', shutter='shutter1', chimney=False), True),
    (1, -1, dict(W=11.0, D=8.0, stories=1, roof='side', color='robin', roofc='shingleSlate', door='door2', shutter='shutter2', chimney=True), False),
    (1, 0, dict(W=10.0, D=8.5, stories=2, roof='side', color='cream', roofc='shingleRust', door='door3', shutter='shutter1', chimney=True), True),
    (1, 1, dict(W=10.5, D=8.0, stories=1, roof='front', color='terracotta', roofc='shingleSlate', door='door1', shutter='shutter2', chimney=False), True),
    (1, 2, dict(W=11.0, D=8.5, stories=2, roof='front', color='sage', roofc='shingleBrown', door='door2', shutter='shutter3', chimney=True), False),
    (1, 3, dict(W=10.0, D=8.0, stories=1, roof='side', color='butter', roofc='shingleRust', door='door3', shutter='shutter1', chimney=False), True),
    (-1, -2, dict(W=10.0, D=8.0, stories=1, roof='side', color='sage', roofc='shingleBrown', door='door2', shutter='shutter1', chimney=True), False),
    (-1, -1, dict(W=10.5, D=8.5, stories=2, roof='front', color='butter', roofc='shingleSlate', door='door3', shutter='shutter2', chimney=False), True),
    (-1, 0, dict(W=11.0, D=8.0, stories=1, roof='side', color='terracotta', roofc='shingleBrown', door='door1', shutter='shutter3', chimney=True), False),
    (-1, 1, dict(W=10.0, D=8.5, stories=2, roof='front', color='cream', roofc='shingleRust', door='door2', shutter='shutter1', chimney=True), True),
    (-1, 2, dict(W=10.5, D=8.0, stories=1, roof='side', color='honey', roofc='shingleSlate', door='door1', shutter='shutter2', chimney=False), False),
    (-1, 3, dict(W=11.0, D=8.5, stories=2, roof='side', color='robin', roofc='shingleBrown', door='door3', shutter='shutter3', chimney=True), True),
]
LW = ST['lotWidth']
_base = list(LOTS)
for i in range(4, 9):
    for s_ in (1, -1):
        src = [l for l in _base if l[0] == s_][(i + (0 if s_ > 0 else 3)) % 6]
        spec = dict(src[2]); spec['W'] = 10.0 + (i * 7 % 3) * 0.5
        LOTS.append((s_, i, spec, (i * 5 + (s_ > 0)) % 3 != 0))

