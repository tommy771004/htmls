# 真人比例的身體：Quaternius「Universal Base Characters」Superhero 男／女底模（CC0，和 268 TERRA 的路人同一套），
# 取代以斷面放樣拼出來的皮膚與緊身衣部件，以及 anime_head 的頭顱。衣物、盔甲、靴子與頭髮仍由各英雄的腳本建模。
#   1. 底模（T 字）依骨段擬合到 rig.json 的 A 字綁定姿勢：每根底模骨頭一個「旋轉＋沿骨縮放＋徑向縮放」，以底模權重混合；
#      軀幹改用依高度的縱向重新對應＋橫向縮放，寬度照英雄自己的皮膚／緊身衣部件量出來。
#   2. 顏色：從被取代的部件（skin=1）就近投影 pal／mat／ol，所以袖子、手套、緊身衣的分色照舊。
#   3. 被衣物蓋住的地方：從骨軸往外射線，碰到衣物內壁就把皮膚收進去（留 3 mm），擺動時才不會穿出來。
#   4. 權重直接沿用底模（骨名對應到 198 的骨架），不經過骨熱。
#   5. 頭：和身體同一次擬合（head_map 對到動畫頭顱的顱骨橢球與貼花的眼線），眼窩填平，頸部接縫共用頂點、權重全給頭骨。
# 素材包由 games/197-openworld/tools/fetch-quaternius.py 下載到 games/197-openworld/.cache/（或設 QUATERNIUS_CACHE）。
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.interpolate import poly_3d_calc
from mathutils.kdtree import KDTree

import kit
from kit import smooth

V = Vector
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE = os.environ.get('QUATERNIUS_CACHE') or os.path.normpath(os.path.join(ROOT, '../197-openworld/.cache'))
BODY = os.path.join(CACHE, 'ubc/Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_{}_FullBody.gltf')
G_REAL = 90
# 貼在真人手臂上的環帶（hug_fit 處理過的護腕、臂章、手套）：權重直接抄底下皮膚的底模權重（hug_weights），左右各一個群組
G_HUG_L, G_HUG_R = 50, 51
# 疊在真人身體上的硬殼（貝吉塔的胸背甲、腹甲）：權重照底下真人皮膚最近的三角形內插（ride_weights），和皮膚一起變形
G_RIDE_REAL = 52
FEMALE = {'a18', 'sakura', 'nami'}
# 量不到皮膚部件時，四肢粗細以這兩名英雄的比例當作底模原本的體型
REF = {'Male': 'trunks', 'Female': 'a18'}
REF_R = {
    'trunks': {'arm': 0.05861, 'fore': 0.05522, 'thigh': 0.08237, 'shin': 0.0653},
    'a18': {'arm': 0.0373, 'fore': 0.03604, 'thigh': 0.06065, 'shin': 0.05386},
}
# 女性體型的擬合參數（底模是 Superhero 女性，肩、臂偏運動員；參考的 GK 是窄肩、細臂、頸肩有斜度、腰細）
#   anchor：軀幹縱向改以肩關節為錨（1＝完全，0＝和男性一樣以頸根為錨），見 Fitter.torso_map；越小頸根越低、脖子越長
#   arm／fore：上臂、前臂的徑向縮放再乘上這個倍率（量到的粗細來自 arm_skin，那是男女共用、帶肌肉起伏的手臂）；
#             前臂只決定手腕粗細，前臂的形狀由 fore_belly／fore_kb 重畫（見 Fitter.fore_profile）
#   delt：三角肌（上臂骨段前 delt_k 段與肩頂）往骨軸收的比例，肩頭圓小、不再是一顆凸出的肌肉帽
#   fore_belly：前臂上段肌腹比肘部多鼓的比例（底模的前臂肌群在肘下 0.2 處比上臂下端粗 15%，是「大力水手」手臂的來源）
#   fore_kb：前臂從肘部粗細開始收向手腕的位置（沿骨 0＝肘、1＝腕）
#   fore_e：前臂肘端的粗細相對上臂下端的比例（前臂斷面比上臂扁，從正面、背面看同樣的半徑會顯得比較寬，所以取小於 1）
#   waist／waist_z：腰部左右、前後再收的比例（腰臀比）；waist_u 是腰最細處的軀幹高度（F.y 的 u），
#             waist_up／waist_dn 是往上（漸寬到胸廓）、往下（很快張開到髖）收腰範圍的長度（軀幹長的比例）
#   slope：肩線斜度：頸根到肩頭之間、肩關節以上的軀幹往下壓的最大量（公尺），見 Fitter.shoulder_slope
#   neck_drop：脖子周圍的軀幹（斜方肌頂、頸窩）往下壓的量（公尺），頸根變低、脖子露出更長，見 Fitter.shoulder_slope
FEMALE_FIT = {'anchor': 1.0, 'arm': 0.82, 'fore': 0.92, 'delt': 0.22, 'delt_k': 0.4,
              'fore_e': 0.92, 'fore_belly': 0.03, 'fore_kb': 0.2,
              'waist': 0.14, 'waist_z': 0.06, 'waist_u': 0.35, 'waist_up': 0.4, 'waist_dn': 0.16, 'slope': 0.0, 'neck_drop': 0.0}
# 各英雄的覆寫：娜美的參考脖子細長（露出約 0.45 頭高）、肩線圓滑下斜，頸根不能和 18 號、小櫻一樣抬高
FEMALE_HERO = {
    'nami': {'neck_drop': 0.028, 'slope': 0.012, 'delt': 0.3, 'waist_u': 0.42},   # 低腰牛仔褲，腰在褲頭上方、肚臍附近
    'a18': {'waist_u': 0.27},   # 皮帶繫在腰最細處（參考的脖子短，約 0.25 頭高，不加肩線下壓）
    'sakura': {'waist_u': 0.33},
}


# 男性手臂的擬合參數（前臂輪廓的意思同 FEMALE_FIT；男女都經過 Fitter.fore_profile）
#   被取代的 arm_skin 是加大肌肉的手臂（FZ muscle 1.35 × 各英雄的 muscle、k），前臂從肘到腕幾乎一樣粗（斷面放樣），
#   底模的前臂卻在肘下一團肌腹、往手腕收得很細：中段（0.3～0.7）量出的比例（悟空 0.0645／0.0409＝1.58）整段套上去，
#   肘下那團肌腹被放大成比上臂還粗的「大力水手」前臂（量測：悟空前臂 1.13 頭寬、上臂中段 0.90）。改成和女性一樣畫目標輪廓。
#   參考（FighterZ 立繪、S.H.Figuarts）：前臂最粗處約上臂的 0.9 倍，肘下微鼓後收向手腕。
#   wrist_k：手腕半徑最多是肘部的幾倍。
#   arm_cap：上臂半徑上限（頭半徑 hr 的倍數）。底模 Superhero 男性上臂中段半徑 0.069 m，約悟空頭高的 0.64，已經是 FighterZ 立繪的
#   上臂粗細（0.63 頭）；arm_skin 的上臂量到 0.089 m（×1.29），手臂比參考粗兩成以上。上限取 0.56 hr（悟空 ×1.06），保留一點 FighterZ 的粗壯。
#   fore_e 0.9：量測工具的前臂（肘下 0.25～0.45）和上臂中段的寬度比約 0.93，接近參考的 0.92（悟空 0.58／0.63 頭）。
#   hand_t：手（手掌、四指、拇指）垂直於手腕→中指根方向的縮放再乘的倍率，也就是拳頭的厚度與寬度。
#   handK 是整隻手等比放大（長度也一起變），男性的拳頭長度（腕到拳端）已經接近參考（悟空 0.58 頭高，FighterZ 立繪約 0.63），
#   寬度卻只有 0.38 頭高（立繪約 0.55，拳寬約臉寬的 0.74、和護腕差不多寬）：底模是真人比例的手，握拳後又薄又窄。
#   只靠 handK 把寬度補到參考，拳頭會長到 0.84 頭高、垂到大腿中段；所以長度交給 handK（小幅調整），寬厚另乘 hand_t。
#   hand_t 從手腕（k＝0）漸增、到手掌中段（hand_k1）才是全量：整隻手一起加厚時，手腕那一圈也變成 1.3 倍，
#   比前臂末端、護腕／袖口內壁還粗，從腕環下緣與袖口裡穿出一塊塊皮膚（悟空護腕下緣、卡卡西袖口、比克紅腕環的鋸齒）。
MALE_FIT = {'fore_e': 0.9, 'fore_belly': 0.05, 'fore_kb': 0.25, 'wrist_k': 0.82, 'arm_cap': 0.56, 'hand_t': 1.3, 'hand_k1': 0.55}
# 手的加厚倍率只給 FighterZ 的角色（參考立繪的拳頭約放大 1.2 倍、和護腕一樣寬）。
# 火影與航海王的參考（S.H.Figuarts）是正常比例的手：1.3 倍在遊戲鏡頭下像攤平的大掌（卡卡西的右手寬度接近大腿），只稍微加厚。
# 弗利沙的手是細長的外星人手指（S.H.Figuarts 參考），handK 1.6 已經夠大，不再加厚
# 各英雄的上臂半徑上限（覆寫 MALE_FIT 的 arm_cap）：貝吉塔的參考（01 FighterZ、04 GK）二頭肌和手套口一樣寬、約腰帶寬的 0.45，
# 0.56 hr 時上臂只有 0.119 m 寬，比手套口（0.137 m）還細，撐不起肩甲
ARM_CAP_HERO = {'vegeta': 0.64}
# 男性的肩線下壓（Fitter.shoulder_slope，參數同 FEMALE_FIT 的 slope／neck_drop；沒列的英雄不壓）：
# 特南克斯（GK 第三輪）：底模的斜方肌與三角肌頂比肩關節高 8 cm，外套袖照「真人身體−舊手臂」往外挪時袖根被頂成兩顆比外套肩線高的圓球，
# 正面肩頂只比下巴低 0.15 頭（03 GK 約 0.3 頭、肩線從立領往外下斜）
MALE_SLOPE_HERO = {'trunks': {'slope': 0.03, 'neck_drop': 0.0}}
# 上臂根部（肩關節到沿骨 0.1）的徑向縮放上限（倍數）：沿骨 0.1～0.4 漸變到 arm_r 全量（Fitter.fit）。
# 上臂的徑向縮放以骨軸為中心，腋下、背闊肌邊緣這些混了上臂權重的軀幹頂點也被往外推：
# 貝吉塔上臂 1.44 倍時腋下後方鼓出 2～3 cm，站著就從背甲側緣頂出一排藍色階梯。二頭肌照全量，肩根只到 1.2 倍
ARM_ROOT_HERO = {'vegeta': 1.2}
# 四肢肌肉起伏的加強倍率（Fitter.relief）：底模的三角肌、二頭／三頭肌、前臂肌群、股四頭肌與小腿肚的起伏再放大幾倍。
# 貝吉塔的藍色緊身衣在參考裡肌肉分塊明顯（01、04），只照底模縮放時整條手臂與腿是平滑的圓管
RELIEF_HERO = {'vegeta': 1.0}
HAND_T_HERO = {'frieza': 1.0, 'naruto': 1.1, 'sasuke': 1.1, 'kakashi': 1.08, 'luffy': 1.1, 'zoro': 1.12, 'sanji': 1.05}
# 前臂斷面的扁平度：底模的前臂肌群（肱橈肌、伸肌）在肘下往外側鼓，A 字站姿正面看前臂寬度是前後厚度的 1.3 倍，
# 徑向等比縮放（fore_profile 只看到距骨軸的中位數）縮不掉這個扁度，正面看前臂仍比上臂中段寬（比克 14.3 cm 對 12.5 cm）。
# 參考（S.H.Figuarts 比克：上臂 0.57、前臂 0.48 頭；FighterZ 悟空 0.63／0.58）的前臂正面寬度不超過上臂。
# fore_round：正面寬度最多是前後厚度的幾倍（只收正面方向的半徑，見 Fitter.fore_flat）
FORE_ROUND = 1.0


# 脖子最細處的寬度（正面看）÷ 頭顱高（下巴到頭頂），量自參考圖：悟空 0.6（FighterZ 立繪；S.H.Figuarts 比克同為 0.6）、
# 魯夫 0.5（S.H.Figuarts，細長的頸）、娜美 0.35（P.O.P）。只當上限用（Fitter.fit：不會把脖子加粗）
NECK_W = {'Male': 0.6, 'Female': 0.4}
NECK_W_HERO = {'luffy': 0.5, 'nami': 0.36}


def fem_fit(hid):
    """英雄 hid 的女性擬合參數（FEMALE_FIT 加上 FEMALE_HERO 的覆寫）。torso_map、fit 與 neck_lift 都要讀同一份。"""
    d = dict(FEMALE_FIT)
    d.update(FEMALE_HERO.get(hid, {}))
    return d


def neck_lift(F):
    """換真人身體後，頸根（第七頸椎、斜方肌頂）比 198 頸骨起點 F.y(1.0) 高多少（公尺）。
    只有女性以肩關節為錨時不是 0（見 Fitter.torso_map）；繞後頸的細帶（娜美比基尼的掛脖綁帶）要照它放高，
    不然綁帶落在斜方肌往上隆起的坡上，被皮膚埋住。"""
    hid = F.R.get('id', '')
    if not enabled(hid) or hid not in FEMALE:
        return 0.0
    J, B = load('Female')['J'], F.b
    ys0, ysS, ys1 = J['thigh_l'][0].y, J['upperarm_l'][0].y, J['neck_01'][0].y
    yt0, ytS, yt1 = B['thL'][0].y, B['shL'][0].y, B['neck'][0].y
    ky = (ytS - yt0) / (ysS - ys0)
    return (ytS + (ys1 - ysS) * ky - yt1) * fem_fit(hid)['anchor']


def radial_xf(M, h, t, g):
    """骨段變換 M 之後，再把頂點往骨軸徑向乘上 g(k)：k 是沿骨的位置（0＝起點、1＝終點，兩端之外夾住），h、t 是目標骨段（變換後的座標）。"""
    def f(c):
        p = M @ c if isinstance(M, Matrix) else M(c)
        d = t - h
        k = max(0.0, min(1.0, (p - h).dot(d) / max(d.length_squared, 1e-12)))
        a = h + d * k
        return a + (p - a) * g(k)
    return f


def taper_xf(M, h, t, amt, k1):
    """骨頭起點附近的頂點往骨軸收：沿骨 k 處徑向乘上 1 − amt·(1 − smooth(k / k1))。
    起點之外（肩頂）夾成 k＝0、以關節為中心收，所以肩頭整體變圓、變小。"""
    return radial_xf(M, h, t, lambda k: 1 - amt * (1 - smooth(k / k1)))
G_TORSO_SET = {1, 10, 11, 19}   # heroes 的 G_TORSO、G_PELVIS、G_BELT、G_CHEST


def torso_group(g):
    """登錄英雄專屬、屬於軀幹的綁骨群組（例如小櫻上衣與短褲頭的 G_SAK_WAIST）。
    軀幹部件要讓 torso_map 量到（不然軀幹寬度退回估計值），也不能被 dst_radius 當成手臂量：
    小櫻的上衣沒登錄時，肩頭到腋下的上衣頂點離上臂骨軸不到 16 cm，上臂半徑量成 0.081 m（底模 0.046 m），夾到 1.7 倍，肩膀與上臂又方又壯。"""
    G_TORSO_SET.add(g)
    return g

_SRC = {}
_GH = {}   # 除錯：dst_radius 各群組貢獻的距離
HEAD_ARGS = {}   # anime_head 的物件名 → 參數（換成底模的頭時用）


def enabled(hid):
    """REAL_BODY 環境變數：all（預設）／none／逗號分隔的英雄名單。"""
    v = os.environ.get('REAL_BODY', 'all')
    return v == 'all' or hid in v.split(',')


def skin(ob):
    """標記為要被真人身體取代的部件（皮膚與緊身衣）。"""
    ob['skin'] = 1
    return ob


_PAINT = {}   # paint_id → [(field, pal, mat, reach, refine)]；id 全域唯一（全量建模時各英雄的部件會同名）
_WSAMPLE = None   # repaint() 期間：co → 底模在該點的蒙皮權重 {198 骨名: w}（切線前網格上照重心座標內插）
_WCO = None       # repaint() 正在求值的點（真實座標；鏡射部件的場拿到的是 x 反過來的座標，權重要在真實的點上查）
_WMX = False      # 正在求值的是鏡射那一份：weight_field 的骨名左右對調（場以左側寫成）


def weight_field(bones, thr=0.5, fallback=None):
    """依底模蒙皮權重切色塊的場：bones 這些骨頭的權重合計超過 thr 的地方 ＜0。
    無袖上衣的袖孔這種「手臂和軀幹的分界」，用幾何切面（例如 |x| 鉛直面）切在腋窩時，腋窩的皮膚幾乎和切面平行、還有皺褶，
    站姿看是直線，一抬手腋下攤開，切線就成了來回的鋸齒；權重 0.5 的等值線就是蒙皮把皮膚分給手臂和軀幹的地方，
    抬手時沿著它平順地拉開。只在換真人身體、repaint() 切線時有權重可查，其他時候用 fallback（沒有就整片不塗）。
    權重一律在真實座標上查（鏡射部件也一樣）；bones 照場的寫法用左側骨名，鏡射那一份求值時自動左右對調。"""
    def f(co):
        if _WSAMPLE is None:
            return fallback(co) if fallback else 1.0
        w = _WSAMPLE(_WCO if _WCO is not None else co)
        bs = [b[:-1] + {'L': 'R', 'R': 'L'}[b[-1]] if _WMX and b[-1] in 'LR' else b for b in bones]
        return thr - sum(w.get(b, 0.0) for b in bs)
    return f


def paint(ob, F, field, pal, mat=None, reach=None, refine=0):
    """被取代部件上的解析色塊（例如比克手臂的粉紅肌肉紋）。
    project() 是把舊部件的顏色逐頂點投影到底模、再平滑指示值、併掉小於 60 頂點的色塊島：
    底模手臂的頂點稀，十幾公分的橢圓只分到十幾個頂點，整塊會被併掉。所以這種有明確形狀的色塊改成登錄場函式，
    make() 在投影之後直接用同一個場在底模上切線上色（形狀不受底模頂點密度影響）。
    沒有換真人身體時照舊畫在原部件上。field 用左側座標；heroes.mirror() 鏡射時會記下要把 x 反過來。
    reach：只塗離原部件表面這麼近的底模頂點（場只在那個部件附近有意義，例如不讓手臂的場塗到軀幹）；
    這是硬截斷，截斷線穿過色塊時會沿著底模的面鋸齒，場自己能限制範圍時傳 None。
    refine：切線前把交界附近的面細分幾次（底模手臂的面約 2 cm，幾公分大的小色塊只切到幾條邊，交界是一個八角形）。"""
    if not enabled(F.R.get('id', '')):
        return kit.paint_field(ob, field, pal, mat)
    pid = ob.get('paint_id') or '%s#%d' % (ob.name, len(_PAINT))
    ob['paint_id'] = pid
    _PAINT.setdefault(pid, []).append((field, pal, mat, reach, refine))
    return ob


def refine_near(ob, g, passes):
    """把場 g 的零等值線附近（跨過交界、或離交界不遠）的面平面細分 passes 次，等值切線才有足夠的邊可切。
    新頂點接在後面，權重之後照最近的舊頂點查（和 iso_cut 新增的頂點一樣）。"""
    for _ in range(passes):
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        val = {v: g(V(v.co)) for v in bm.verts}
        es = set()
        for f in bm.faces:
            vs = [val[v] for v in f.verts]
            if min(vs) < 0.4 and max(vs) > -0.4:
                es.update(f.edges)
        if es:
            bm.verts.index_update()
            n0 = len(bm.verts)
            bmesh.ops.subdivide_edges(bm, edges=list(es), cuts=1, use_grid_fill=True, use_single_edge=True)
            # 帶有新頂點的面全部三角化：只切到一條邊的三角形會變成有一個共線頂點的四邊形，匯出時若從那個頂點拉對角線，
            # 另一側的面就有 T 形接點，沿邊裂出一排小縫（透出背後的外框殼，看起來像一串黑點）
            bm.verts.index_update()
            bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3 and any(v.index >= n0 for v in f.verts)])
        bm.to_mesh(ob.data)
        bm.free()
        ob.data.update()


def repaint(ob, skins):
    """把 paint() 登錄的色塊塗到真人身體 ob 上（在 project() 之後）。"""
    for o in skins:
        fields = _PAINT.get(o.get('paint_id'))
        if not fields:
            continue
        mx = bool(o.get('paint_mx', 0))
        bm = bmesh.new()
        bm.from_mesh(o.data)
        tree = BVHTree.FromBMesh(bm)
        bm.free()
        for field, pal, mat, reach, refine in fields:
            def g(co, field=field, reach=reach):
                global _WCO, _WMX
                if reach is not None and tree.find_nearest(co, reach)[0] is None:
                    return 1.0
                _WCO, _WMX = V(co), mx
                try:
                    return field(V((-co.x, co.y, co.z)) if mx else co)
                finally:
                    _WCO, _WMX = None, False
            if refine:
                refine_near(ob, g, refine)
            kit.paint_field(ob, g, pal, mat)
            if os.environ.get('REAL_DEBUG'):
                FP = ob.data.attributes['fpal'].data
                print('  解析色塊 %s%s pal=%d：%d 面' % (o.name, '（鏡射）' if mx else '', pal, sum(1 for f in ob.data.polygons if FP[f.index].value == pal)))


def bone_map(q):
    s = 'L' if q.endswith('_l') else 'R' if q.endswith('_r') else ''
    b = q[:-2] if s else q
    if b == 'spine_02':
        return [('torso', 0.4), ('ribs', 0.6)]
    tbl = {'root': 'hips', 'pelvis': 'hips', 'spine_01': 'torso', 'spine_03': 'ribs', 'neck_01': 'neck', 'Head': 'head',
           'clavicle': 'cl', 'upperarm': 'sh', 'lowerarm': 'el', 'hand': 'wr', 'thigh': 'th', 'calf': 'kn', 'foot': 'an', 'ball': 'to', 'ball_leaf': 'to'}
    if b in tbl:
        return [(tbl[b] + s, 1.0)]
    for f in ('index', 'middle', 'ring', 'pinky'):
        if b.startswith(f):
            return [({'01': 'fa', '02': 'fb'}.get(b.split('_')[1], 'fc') + s, 1.0)]
    if b.startswith('thumb'):
        return [('tb' + s, 1.0)]
    return [('hips', 1.0)]


def head_enabled(hid):
    """REAL_HEAD 環境變數：all（預設）／none／逗號分隔的英雄名單。關掉時沿用 anime_head 的動畫頭顱。"""
    v = os.environ.get('REAL_HEAD', 'all')
    return enabled(hid) and (v == 'all' or hid in v.split(','))


def neighbors(n, polys):
    nb = [set() for _ in range(n)]
    for p in polys:
        for a, b in zip(p, p[1:] + p[:1]):
            nb[a].add(b)
            nb[b].add(a)
    return [list(s) for s in nb]


def fill_eyes(co, nb, eyes):
    """眼窩填平：底模的眼皮開口裡是凹進去的眼窩（眼球是另一個網格，不用）。開口裡的頂點往前推到
    周圍眼皮表面的高度，再在網格上平滑幾輪，動畫眼睛的貼花才畫在一片乾淨、朝前的面上。"""
    for (ex, ey, ez), (rx, ry) in eyes:
        def r2(c):
            return ((c.x - ex) / rx) ** 2 + ((c.y - ey) / ry) ** 2
        inner = [i for i, c in enumerate(co) if c.z > ez - 0.045 and r2(c) < 1.0]
        rim = [co[i] for i, c in enumerate(co) if c.z > ez - 0.012 and 1.0 <= r2(c) < 3.0]

        def zs(c):
            acc = tot = 0.0
            for q in rim:
                w = 1.0 / (((q.x - c.x) ** 2 + (q.y - c.y) ** 2) + 1e-7)
                acc += q.z * w
                tot += w
            return acc / tot
        for i in inner:
            c = co[i]
            co[i] = V((c.x, c.y, max(c.z, zs(c) - 0.0015)))
        # 平滑：開口內與眼皮一圈（r² < 1.8）一起放鬆，外圈固定
        soft = set(inner) | {i for i, c in enumerate(co) if c.z > ez - 0.02 and r2(c) < 1.8}
        for _ in range(8):
            nxt = {}
            for i in soft:
                if nb[i]:
                    m = sum((co[j] for j in nb[i]), V((0, 0, 0))) / len(nb[i])
                    nxt[i] = co[i].lerp(m, 0.6)
            for i, p in nxt.items():
                co[i] = p


def flatten_nose(S, amt, muzzle=0.0):
    """底模鼻子壓平（anime_head 的 nose 參數：1＝底模原本的真人鼻子，0＝完全壓平）。回傳新的座標表，不改 S（底模依性別快取、各英雄共用）。
    鼻子範圍是兩眼之間到人中的橢圓（相對 Head 骨：中線兩側 2.4 cm、眼線下 0.2～6.4 cm、臉的前方）：範圍內的頂點在頭的網格上
    反覆取鄰點平均（範圍外固定），鬆成一片繃在眉心、臉頰與上唇之間的薄膜，再依 1－nose 往那片薄膜靠過去。
    動畫臉的鼻子只是貼花上的一筆，底模的鼻樑與鼻翼留著時，正面看像真人鼻子貼在動畫眼睛下面。
    muzzle：人中與上下唇也一起壓平的程度（弗利沙；底模男性的上唇在眼線下約 7 cm、下唇 8.5 cm、下巴尖 10.5 cm）。
    範圍是眼線下 3.6～10.8 cm、中線兩側 3 cm 的橢圓，下巴尖留在範圍外當固定的邊，壓平後鼻子到下巴是一片光滑的面。"""
    co = list(S['co'])
    if amt <= 0 and muzzle <= 0:
        return co
    hp, eye = S['J']['Head'][0], S['lm']['eye']

    def ell(r, cy, hx, hy, z0):
        if r.z < z0:
            return 0.0
        ex, ey = r.x / hx, (r.y - (eye - cy)) / hy
        return 1.0 - (ex * ex + ey * ey)

    def zone(c):
        r = c - hp
        zn = ell(r, 0.033, 0.024, 0.031, 0.085) if amt > 0 else 0.0
        zm = ell(r, 0.072, 0.03, 0.036, 0.07) if muzzle > 0 else 0.0
        return max(zn, zm)

    def strength(c, z):
        r = c - hp
        zn = ell(r, 0.033, 0.024, 0.031, 0.085)
        zm = ell(r, 0.072, 0.03, 0.036, 0.07)
        return max(amt * smooth(zn / 0.3) if zn > 0 else 0.0, muzzle * smooth(zm / 0.3) if zm > 0 else 0.0)
    zs = {i: zone(co[i]) for i in S['hused']}
    free = [i for i, z in zs.items() if z > 0]
    if not free:
        return co
    nb = neighbors(len(co), S['hpolys'])
    flat = {i: co[i] for i in free}
    for _ in range(120):
        nxt = {}
        for i in free:
            if nb[i]:
                nxt[i] = sum((flat.get(j, co[j]) for j in nb[i]), V((0, 0, 0))) / len(nb[i])
        flat.update(nxt)
    for i in free:
        co[i] = co[i].lerp(flat[i], strength(co[i], zs[i]))
    return co


def load(sex):
    """匯入底模（只取頂點、面與權重，座標轉成 three 空間：+Y 上、面向 +Z）。
    面分成身體（polys）與頭（hpolys：每個頂點的 Head 權重都 ≥ 0.55），兩者共用頂點，接縫是同一圈頂點。"""
    if sex in _SRC:
        return _SRC[sex]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=BODY.format(sex), merge_vertices=True)
    objs = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in objs if o.type == 'ARMATURE')
    body = next(o for o in objs if o.type == 'MESH' and o.name.lower().startswith('superhero'))
    eyes_ob = next(o for o in objs if o.type == 'MESH' and o.name.lower().startswith('eyes'))
    T = lambda p: V((p.x, p.z, -p.y))
    J = {b.name: (T(arm.matrix_world @ b.head_local), T(arm.matrix_world @ b.tail_local)) for b in arm.data.bones}
    me = body.data
    mw = body.matrix_world
    gn = {g.index: g.name for g in body.vertex_groups}
    co = [T(mw @ v.co) for v in me.vertices]
    W = []
    for v in me.vertices:
        ws = [(gn[g.group], g.weight) for g in v.groups if g.weight > 1e-4]
        tot = sum(w for _, w in ws) or 1.0
        W.append([(n, w / tot) for n, w in ws])
    head = [sum(w for n, w in ws if n == 'Head') for ws in W]
    polys = [tuple(p.vertices) for p in me.polygons]
    is_head = [min(head[i] for i in p) >= 0.55 for p in polys]
    # 眼球網格只拿來量眼睛的位置（左右各一顆）
    ec = [T(eyes_ob.matrix_world @ v.co) for v in eyes_ob.data.vertices]
    eyes = []
    for s in (1, -1):
        e = [c for c in ec if c.x * s > 0]
        lo = V((min(c.x for c in e), min(c.y for c in e), min(c.z for c in e)))
        hi = V((max(c.x for c in e), max(c.y for c in e), max(c.z for c in e)))
        eyes.append((((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, hi.z), ((hi.x - lo.x) * 0.62, (hi.y - lo.y) * 0.45)))
    fill_eyes(co, neighbors(len(co), polys), eyes)
    hp = J['Head'][0]
    hv = [c - hp for i, c in enumerate(co) if head[i] > 0.55]
    eye_y = eyes[0][0][1] - hp.y
    crown = max(c.y for c in hv)
    # 下巴：臉中線、前方的頂點裡最低的（脖子在下巴後面，z 較小）
    chin = min(c.y for c in hv if abs(c.x) < 0.02 and c.z > eyes[0][0][2] - hp.z - 0.03)
    # 顱骨斷面：眼睛到頭頂之間（耳朵以上）的寬度與前後範圍
    ys = eye_y + (crown - eye_y) * 0.5
    sl = [c for c in hv if abs(c.y - ys) < 0.006]
    lm = {'eye': eye_y, 'eye_x': abs(eyes[0][0][0]), 'crown': crown, 'chin': chin, 'ys': ys,
          'ax': max(abs(c.x) for c in sl), 'az0': min(c.z for c in sl), 'az1': max(c.z for c in sl)}

    def piece(sel):
        ps = [p for p, k in zip(polys, is_head) if k == sel]
        used = sorted({i for p in ps for i in p})
        return used, ps
    bu, bp = piece(False)
    hu, hpp = piece(True)
    seam = set(bu) & set(hu)
    remap = {o: n for n, o in enumerate(bu)}
    src = {'J': J, 'co': co, 'W': W, 'lm': lm,
           'used': bu, 'polys': [tuple(remap[i] for i in p) for p in bp], 'seam': [i in seam for i in bu],
           'hused': hu, 'hpolys': hpp}
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    _SRC[sex] = src
    return src


# ---------------------------------------------------------------- 骨段擬合
def seg_xf(hs, ts, ht, tt, rad=1.0):
    """把來源骨段 hs→ts 對到目標骨段 ht→tt：繞來源頭旋轉到目標方向、沿骨縮放到目標長度、垂直方向乘 rad。回傳 4×4 矩陣。"""
    ds, dt = ts - hs, tt - ht
    ls, lt = max(ds.length, 1e-6), max(dt.length, 1e-6)
    ds, dt = ds / ls, dt / lt
    S = Matrix.Identity(3) * rad + (lt / ls - rad) * Matrix(((ds.x * ds.x, ds.x * ds.y, ds.x * ds.z), (ds.y * ds.x, ds.y * ds.y, ds.y * ds.z), (ds.z * ds.x, ds.z * ds.y, ds.z * ds.z)))
    Rq = ds.rotation_difference(dt).to_matrix()
    M = (Rq @ S).to_4x4()
    return Matrix.Translation(ht) @ M @ Matrix.Translation(-hs)


def axis_dist(p, h, t):
    d = t - h
    L2 = max(d.length_squared, 1e-12)
    k = max(0.0, min(1.0, (p - h).dot(d) / L2))
    return (p - (h + d * k)).length, k


def median(xs):
    xs = sorted(xs)
    return xs[len(xs) // 2] if xs else None


class Fitter:
    def __init__(self, F, sex, parts, hargs=None):
        self.F, self.sex, self.hargs = F, sex, hargs
        self.S = load(sex)
        self.R = F.R
        self.B = F.b   # 198 骨頭：name → (head, tail)
        self.ff = fem_fit(F.R.get('id', '')) if sex == 'Female' else None   # 女性擬合參數（男性 None）
        self.parts = parts
        self.pts = []   # 被取代部件的頂點（量粗細用）：(co, grp)
        for o in parts:
            g = o.data.attributes.get('grp')
            for i, v in enumerate(o.data.vertices):
                self.pts.append((V(v.co), g.data[i].value if g else 0))

    # 底模某根骨（依骨名）主導的頂點到骨軸的距離中位數
    def src_radius(self, qb, t0=0.3, t1=0.7):
        J, co, W = self.S['J'], self.S['co'], self.S['W']
        h, t = J[qb]
        ds = []
        for c, ws in zip(co, W):
            if any(n == qb and w > 0.7 for n, w in ws):
                d, k = axis_dist(c, h, t)
                if t0 <= k <= t1:
                    ds.append(d)
        return median(ds)

    def src_profile(self, qb, n=10):
        """底模骨頭 qb 主導的頂點沿骨的粗細輪廓（到骨軸距離的中位數，沿骨分 n 段、三點平滑），回傳 k（0..1）→ 半徑。"""
        J, co, W = self.S['J'], self.S['co'], self.S['W']
        h, t = J[qb]
        d = t - h
        bins = [[] for _ in range(n + 1)]
        for c, ws in zip(co, W):
            if any(nm == qb and w > 0.7 for nm, w in ws):
                k = (c - h).dot(d) / max(d.length_squared, 1e-12)
                if -0.05 <= k <= 1.05:
                    bins[max(0, min(n, round(k * n)))].append((c - (h + d * max(0.0, min(1.0, k)))).length)
        m = [median(b) for b in bins]
        for i in range(n + 1):   # 空的段取最近有值的段
            if m[i] is None:
                m[i] = next(m[j] for r in range(1, n + 1) for j in (i - r, i + r) if 0 <= j <= n and m[j] is not None)
        sm = [(m[max(0, i - 1)] + 2 * m[i] + m[min(n, i + 1)]) / 4 for i in range(n + 1)]

        def f(k):
            x = max(0.0, min(1.0, k)) * n
            i = min(n - 1, int(x))
            return sm[i] + (sm[i + 1] - sm[i]) * (x - i)
        return f

    # 被取代部件在 198 某骨段中段的粗細（沒有就回傳 None）
    def dst_radius(self, bone, t0=0.3, t1=0.7, maxd=0.16):
        h, t = self.B[bone]
        side = 1 if bone.endswith('L') else -1 if bone.endswith('R') else 0
        ds = []
        for c, g in self.pts:
            if g in G_TORSO_SET:
                continue
            # 只量同一側的部件：大腿骨軸 16 cm 內會掃到另一條腿的內側（a18、達爾的左大腿多量到右腿 12～18 個頂點）
            if side and c.x * side < 0:
                continue
            d, k = axis_dist(c, h, t)
            if t0 <= k <= t1 and d < maxd:
                ds.append(d)
                if os.environ.get('REAL_DEBUG'):
                    _GH.setdefault(bone, {}).setdefault(g, []).append(d)
        return median(ds) if len(ds) > 20 else None

    def limb_rad(self, qb, bone, key, t=(0.3, 0.7)):
        rs = self.src_radius(qb, *t)
        rd = self.dst_radius(bone, *t)
        if os.environ.get('REAL_DEBUG'):
            print('    群組', {g: (len(v), round(median(v), 4)) for g, v in _GH.pop(bone, {}).items()})
            print('  四肢半徑 %s→%s：被取代部件 %s／底模 %s' % (qb, bone, '%.4f' % rd if rd else '-', '%.4f' % rs if rs else '-'))
        if rd and rs:
            return max(0.6, min(1.7, rd / rs))
        ref = REF_R[REF[self.sex]]
        return max(0.6, min(1.7, self.R[key] / ref[key])) if key else 1.0

    def torso_map(self):
        """軀幹的縱向對應（髖關節→頸根線性）與各高度的橫向縮放（左右、前後、前後中心）。
        女性（fem_fit 的 anchor）改成髖關節→肩關節線性、肩關節以上照同一個比例延伸：
        198 骨架的肩關節只在頸根下 1.5 cm（各英雄都一樣），底模的肩關節在頸根（第七頸椎、斜方肌頂）下 6.4～6.7 cm。
        髖→頸根線性對應時，底模肩關節那一圈軀幹落在 198 肩關節下約 4.7 cm，手臂與鎖骨卻照骨段對到 198 的肩關節：
        三角肌整塊比旁邊的胸側、斜方肌高出 4～5 cm，肩頂和頸根一樣高（方肩、沒有斜方肌的坡），脖子也因此露出很長（0.46～0.48 頭高）。
        男性英雄的方肩、高斜方肌是 FighterZ 的造型，維持髖→頸根的對應。回傳 (xf, ymap, ky)；ky 是髖→肩那段的縮放。"""
        J, B = self.S['J'], self.B
        ys0, ys1 = J['thigh_l'][0].y, J['neck_01'][0].y
        yt0, yt1 = B['thL'][0].y, B['neck'][0].y
        anchor = self.ff['anchor'] if self.ff else 0.0
        if anchor > 0:
            ysS, ytS = J['upperarm_l'][0].y, B['shL'][0].y
            ky = (ytS - yt0) / (ysS - ys0)
            yt1 = yt1 + (ytS + (ys1 - ysS) * ky - yt1) * anchor   # 底模頸根對到的高度
            knots = [(ys0, yt0), (ysS, ytS), (ys1, yt1)]
        else:
            ky = (yt1 - yt0) / (ys1 - ys0)
            knots = [(ys0, yt0), (ys1, yt1)]
        self.neck_root_y = yt1

        def pw(y, ks):
            # 分段線性，兩端照最近一段的斜率延伸
            for (a0, b0), (a1, b1) in zip(ks, ks[1:]):
                if y <= a1 or (a1, b1) == ks[-1]:
                    return b0 + (y - a0) * (b1 - b0) / (a1 - a0)
        ymap = lambda y: pw(y, knots)
        yinv = lambda y: pw(y, [(b, a) for a, b in knots])
        # 量底模軀幹斷面：只取權重主要在骨盆、脊椎與鎖骨的頂點。
        # 鎖骨要算進來：腋窩高度（u=0.8）的胸側與肩前是鎖骨權重，只算脊椎的話底模半寬只量到胸口中間（0.13 m），
        # 英雄的胸寬卻量到腋下（0.25 m），橫向縮放被夾到 1.6；下一列（u=0.67）只有 1.17，胸口上半在 7 cm 內被橫向拉寬 4 成，
        # 而胸側那圈鎖骨權重的頂點照骨段變換、沒有跟著拉，兩邊擠在一起把胸大肌與頸根摺皺，卡通明暗就變成一塊塊的斑
        TB = ('pelvis', 'spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r')
        tor = [c for c, ws in zip(self.S['co'], self.S['W']) if sum(w for n, w in ws if n in TB) > 0.6]
        tgt = [(c, g) for c, g in self.pts if g in G_TORSO_SET]
        F = self.F
        rows = []
        for u in (0.06, 0.21, 0.38, 0.54, 0.67, 0.8):
            yt = F.y(u)
            ys = yinv(yt)
            a = [c for c in tor if abs(c.y - ys) < 0.02]
            b = [c for c, _ in tgt if abs(c.y - yt) < 0.02]
            if len(a) < 10:
                continue
            ax = max(abs(c.x) for c in a)
            az0, az1 = min(c.z for c in a), max(c.z for c in a)
            if len(b) >= 10:
                bx = max(abs(c.x) for c in b)
                bz0, bz1 = min(c.z for c in b), max(c.z for c in b)
            else:   # 沒有軀幹皮膚部件（整個軀幹都在衣服裡）：照斷面表估計
                bx = F.w * 1.12 if u < 0.3 else F.cx * (0.86 + 0.2 * (u - 0.38))
                bz0, bz1 = -F.cz * 0.85, F.cz * 0.9
            rows.append((ys, ax, (az0 + az1) / 2, (az1 - az0) / 2, bx, (bz0 + bz1) / 2, (bz1 - bz0) / 2))
            if os.environ.get('REAL_DEBUG'):
                print('  軀幹 u=%.2f：底模半寬 %.3f 深 %.3f／英雄半寬 %.3f 深 %.3f（%s）→ 橫向 %.2f 前後 %.2f' % (
                    u, ax, (az1 - az0) / 2, bx, (bz1 - bz0) / 2, '量部件' if len(b) >= 10 else '估計', bx / ax, (bz1 - bz0) / (az1 - az0)))
        def at(y):
            if y <= rows[0][0]:
                r = rows[0]
                return r
            for r0, r1 in zip(rows, rows[1:]):
                if y <= r1[0]:
                    k = (y - r0[0]) / (r1[0] - r0[0])
                    return tuple(a + (b - a) * k for a, b in zip(r0, r1))
            return rows[-1]
        # 女性收腰：上面的斷面表只有 6 列，腰身被英雄（198 的直筒軀幹）的寬度拉直（18 號從皮帶到胸下 16 cm 一樣寬，背面看是一根直筒）。
        # 在腰最細處（waist_u）再收 waist／waist_z：往上 waist_up 內漸寬回胸廓（倒三角），往下 waist_dn 內很快張開到髖
        ff = self.ff
        if ff and ff['waist'] > 0:
            yw, hu, hd = F.y(ff['waist_u']), ff['waist_up'] * F.T, ff['waist_dn'] * F.T
            wx, wz = ff['waist'], ff['waist_z']
            if os.environ.get('REAL_DEBUG'):
                print('  收腰：腰 y=%.3f（往上 %.3f、往下 %.3f），左右 %.2f、前後 %.2f' % (yw, hu, hd, wx, wz))
        else:
            yw = None

        def xf(p):
            r = at(p.y)
            _, ax, azc, azh, bx, bzc, bzh = r
            sx = max(0.6, min(1.6, bx / ax))
            sz = max(0.6, min(1.6, bzh / azh))
            y = ymap(p.y)
            if yw is not None:
                b = 1 - smooth((y - yw) / hu if y > yw else (yw - y) / hd)
                sx *= 1 - wx * b
                sz *= 1 - wz * b
            return V((p.x * sx, y, bzc + (p.z - azc) * sz))
        return xf, ymap, ky

    def head_map(self):
        """底模的頭（Head 骨的權重）對到動畫頭顱：頭髮、髮帽與臉部貼花都以頭心 F.c 與 hr 定位，所以頭頂與顱骨寬、前後
        對到 anime_head 的顱骨橢球（cranium），眼睛對到貼花的眼線高度（頭心上 0.01 hr），下巴對到動畫臉的下巴；
        眼睛以上、以下各自縱向縮放（交界 3 cm 內漸變）。下半臉的寬度乘上 cheek×jaw，最後套 hx（頭的橫向比例）。"""
        F, a, lm = self.F, self.hargs, self.S['lm']
        c, hr = F.c, F.hr
        hp = self.S['J']['Head'][0]
        kx, ky, kz = a['cranium']
        te = c.y + 0.01 * hr
        tcrown = c.y + hr * (0.9 * ky + 0.08)
        tchin = c.y - hr * (0.9 * 0.86 * a['face_len'] + 0.06)
        eye = lm['eye']
        su = (tcrown - te) / (lm['crown'] - eye)
        sd = (te - tchin) / (eye - lm['chin'])
        yt = te + (lm['ys'] - eye) * su
        k = math.sqrt(max(0.05, 1 - ((yt - (c.y + 0.08 * hr)) / (0.9 * ky * hr)) ** 2))
        sx = 0.8 * kx * hr * k / lm['ax']
        sz = 0.88 * kz * hr * k / ((lm['az1'] - lm['az0']) / 2)
        zc_s, zc_t = (lm['az0'] + lm['az1']) / 2, c.z - 0.04 * hr
        wf_low = a['cheek'] * a['jaw']
        hx = F.R.get('hx', 1.0)
        self.head_info = {'eye_y': te, 'chin_y': tchin}

        occ, taper = a.get('occ', 0.0), a.get('taper', 0.0)

        def fn(p):
            r = p - hp
            d = r.y - eye
            t = smooth((d + 0.015) / 0.03)
            y = te + d * (sd + (su - sd) * t)
            u = -d / (eye - lm['chin'])   # 眼線 0 → 下巴 1
            wf = 1 + (wf_low - 1) * smooth(u)
            z = zc_t + (r.z - zc_s) * sz
            if taper:
                # 尖下巴：臉的前半部改成從眼睛直線收到下巴（smooth 的 S 形在顴骨下方幾乎不收，臉頰到下顎又寬又長）；
                # 只作用在前方（頭心之前），後腦與頸部接縫照原本的收法，脖子後面才不會被捏細
                lin = 1 + (wf_low - 1) * max(0.0, min(1.0, u)) ** 0.8
                fz = taper * smooth(0.5 + (z - c.z) / (0.8 * hr))
                wf = wf + (lin - wf) * fz
            if occ:
                # 後腦勺：底模的後腦從眼線往下是垂直的平面，接著脖子，背面看是一根和頭一樣寬的柱子。
                # 眼線下 0.6 hr（頸部接縫的上緣，約 −0.63 hr）以下不動；往上漸增，眼線下 0.3 hr 附近最鼓，到眼線上 0.5 hr 交給 round_cranium 的蛋形
                dy = (y - te) / hr
                k = occ * smooth((dy + 0.6) / 0.3) * (1 - smooth(dy / 0.5)) * smooth(-(z - c.z) / (0.5 * hr))
                z = c.z + (z - c.z) * (1 + k)
            x = c.x + r.x * sx * wf * hx
            return V((x, y, c.z + (z - c.z) * (0.5 + 0.5 * hx)))
        return fn

    def fore_profile(self, q, arm_r, fore_r):
        """前臂的徑向倍率 g(k)（乘在 seg_xf(…, fore_r) 之後；男女共用，參數女性取 fem_fit、男性取 MALE_FIT）：
        底模的前臂在肘下 0.1～0.3 有一團前臂肌群（女性中位半徑 0.047 m，比上臂下端的 0.040 m 粗），整段等比縮放後前臂仍比上臂粗（背面看手肘下往外鼓）。
        改成畫一條目標輪廓：肘部接上臂下端的粗細（arm_r × 上臂輪廓在 k＝0.95 × fore_e），上段只微鼓 fore_belly，
        從 fore_kb 開始平滑收到手腕（fore_r × 底模手腕，手環、手套口照舊）；倍率＝目標 ÷（fore_r × 底模輪廓），最多 1。"""
        ff = self.ff or MALE_FIT
        sU, sF = self.src_profile('upperarm_' + q), self.src_profile('lowerarm_' + q)
        r_e, r_w = arm_r * sU(0.95) * ff['fore_e'], fore_r * sF(1.0)
        if 'wrist_k' in ff:
            # 男性：arm_skin 的手腕是扁的粗管（前臂整段放大 1.5 倍後手腕仍有 4.9 cm），手腕最多是肘部的 wrist_k 倍，前臂才收得出錐形
            r_w = min(r_w, r_e * ff['wrist_k'])
        kb, belly = ff['fore_kb'], ff['fore_belly']

        def g(k):
            r = r_e + (r_w - r_e) * smooth((k - kb) / (1 - kb))
            r *= 1 + belly * math.sin(math.pi * min(1.0, k / 0.6))
            # 只收不放：前臂下段底模本來就細（收向手腕），照目標畫反而會變成一根直筒
            return min(1.0, r / max(1e-6, fore_r * sF(k)))
        if os.environ.get('REAL_DEBUG'):
            print('  前臂輪廓 %s：肘 %.4f 腕 %.4f／上臂中段 %.4f；倍率 %s' % (q, r_e, r_w, arm_r * sU(0.5), ' '.join('%.2f' % g(i / 10) for i in range(11))))
        return g

    def fore_flat(self, q, M, h, t, n=10):
        """前臂斷面收扁（見 FORE_ROUND）：把底模前臂（lowerarm 權重＞0.7 的頂點）經 M 變換後，沿骨每 1/n 段量正面方向
        （垂直骨軸、在 xy 平面內，u）與前後方向（w＝骨軸 × u）的寬度（5%～95% 分位），正面寬度超過 FORE_ROUND × 前後寬度的段，
        只把 u 方向的分量乘上比例收回去；手腕端（k＞0.85）漸回 1，接手掌的那圈不動。回傳包好的變換。"""
        J, co, W = self.S['J'], self.S['co'], self.S['W']
        qb = 'lowerarm_' + q
        d = (t - h).normalized()
        u = V((-d.y, d.x, 0)).normalized()
        w = d.cross(u).normalized()
        bins = [[] for _ in range(n + 1)]
        for c, ws in zip(co, W):
            if any(nm == qb and x > 0.7 for nm, x in ws):
                p = M @ c if isinstance(M, Matrix) else M(c)
                k = (p - h).dot(t - h) / (t - h).length_squared
                if -0.05 <= k <= 1.05:
                    r = p - h
                    bins[max(0, min(n, round(k * n)))].append((r.dot(u), r.dot(w)))

        def ext(xs):
            xs = sorted(xs)
            return xs[int(len(xs) * 0.95) - 1] - xs[int(len(xs) * 0.05)] if len(xs) >= 6 else None
        g = []
        for b in bins:
            eu, ew = ext([a for a, _ in b]), ext([z for _, z in b])
            g.append(None if not eu or not ew else min(1.0, FORE_ROUND * ew / eu))
        for i in range(n + 1):
            if g[i] is None:
                g[i] = next((g[j] for r in range(1, n + 1) for j in (i - r, i + r) if 0 <= j <= n and g[j] is not None), 1.0)
        g = [(g[max(0, i - 1)] + 2 * g[i] + g[min(n, i + 1)]) / 4 for i in range(n + 1)]
        if os.environ.get('REAL_DEBUG'):
            print('  前臂收扁 %s：%s' % (q, ' '.join('%.2f' % x for x in g)))

        def gu(k):
            x = max(0.0, min(1.0, k)) * n
            i = min(n - 1, int(x))
            v = g[i] + (g[i + 1] - g[i]) * (x - i)
            return v + (1 - v) * smooth((k - 0.85) / 0.15)

        def f(c):
            p = M @ c if isinstance(M, Matrix) else M(c)
            k = (p - h).dot(t - h) / (t - h).length_squared
            ru = (p - h).dot(u)
            return p - u * (ru * (1 - gu(k)))
        return f

    def fit(self):
        J, B, F = self.S['J'], self.B, self.F
        tx, ymap, ky = self.torso_map()
        X = {}
        for s, q in (('L', 'l'), ('R', 'r')):
            arm_r = self.limb_rad('upperarm_' + q, 'sh' + s, 'arm')
            fore_r = self.limb_rad('lowerarm_' + q, 'el' + s, 'fore')
            ff = self.ff
            fem = ff is not None
            if fem:
                arm_r *= ff['arm']
                fore_r *= ff['fore']
            else:
                rs = self.src_radius('upperarm_' + q)
                cap = ARM_CAP_HERO.get(self.R.get('id', ''), MALE_FIT['arm_cap']) * self.R['hr'] / rs if rs else arm_r
                if os.environ.get('REAL_DEBUG') and arm_r > cap:
                    print('  上臂半徑 %s：%.2f 倍 → 上限 %.2f 倍（%.4f m）' % (q, arm_r, cap, cap * rs))
                arm_r = min(arm_r, cap)
            th_r = self.limb_rad('thigh_' + q, 'th' + s, 'thigh')
            sh_r = self.limb_rad('calf_' + q, 'kn' + s, 'shin')
            r_root = ARM_ROOT_HERO.get(self.R.get('id', ''))
            if r_root and arm_r > r_root:
                X['upperarm_' + q] = radial_xf(seg_xf(J['upperarm_' + q][0], J['lowerarm_' + q][0], B['sh' + s][0], B['el' + s][0], r_root),
                                               B['sh' + s][0], B['el' + s][0], lambda k, g=arm_r / r_root: 1 + (g - 1) * smooth((k - 0.1) / 0.3))
            else:
                X['upperarm_' + q] = seg_xf(J['upperarm_' + q][0], J['lowerarm_' + q][0], B['sh' + s][0], B['el' + s][0], arm_r)
            if fem and ff['delt'] > 0:
                X['upperarm_' + q] = taper_xf(X['upperarm_' + q], B['sh' + s][0], B['el' + s][0], ff['delt'], ff['delt_k'])
            X['lowerarm_' + q] = seg_xf(J['lowerarm_' + q][0], J['hand_' + q][0], B['el' + s][0], B['wr' + s][0], fore_r)
            # 手：手腕→中指根對到 wr→fa；寬度照 198 手掌（四指張開的寬度）
            hk = self.R['handGeo']['k']
            fz = self.R['handGeo']['fz']
            palm_w = (fz[0] - fz[-1]) * hk + 2 * self.R['handGeo']['fr'][0] * hk
            q_w = (J['index_01_' + q][0] - J['pinky_01_' + q][0]).length + 0.02
            hand_r = max(0.7, min(1.8, palm_w / q_w))
            ht = 1.0 if fem else HAND_T_HERO.get(self.R.get('id', ''), MALE_FIT['hand_t'])
            if os.environ.get('REAL_DEBUG'):
                print('  手 %s：198 手掌寬 %.4f／底模 %.4f → 徑向 %.2f 倍、加厚 %.2f（長度 %.2f 倍）' % (q, palm_w, q_w, hand_r, ht, (B['fa' + s][0] - B['wr' + s][0]).length / (J['middle_01_' + q][0] - J['hand_' + q][0]).length))
            Hx = seg_xf(J['hand_' + q][0], J['middle_01_' + q][0], B['wr' + s][0], B['fa' + s][0], hand_r)
            if ht != 1.0:
                # 手腕不加厚，到手掌中段才是全量（見 MALE_FIT 的 hand_k1）；手指（k＞1）照全量
                k1 = MALE_FIT['hand_k1']
                Hx = radial_xf(Hx, B['wr' + s][0], B['fa' + s][0], lambda k, ht=ht, k1=k1: 1 + (ht - 1) * smooth(k / k1))
            X['hand_' + q] = Hx
            hand_r *= ht
            X['lowerarm_' + q] = radial_xf(X['lowerarm_' + q], B['el' + s][0], B['wr' + s][0], self.fore_profile(q, arm_r, fore_r))
            X['lowerarm_' + q] = self.fore_flat(q, X['lowerarm_' + q], B['el' + s][0], B['wr' + s][0])
            # 手指：每一節照中指的對應（fa／fb／fc 的關節位置），四指一起
            fj = [B['fa' + s][0], B['fb' + s][0], B['fc' + s][0], B['fc' + s][1]]
            mj = [J['middle_0%d_' % k + q][0] for k in (1, 2, 3)] + [J['middle_04_leaf_' + q][0]]
            for k in range(3):
                Mk = seg_xf(mj[k], mj[k + 1], fj[k], fj[k + 1], hand_r)
                for f in ('index', 'middle', 'ring', 'pinky'):
                    X['%s_0%d_%s' % (f, k + 1, q)] = Mk
                    if k == 2:
                        X['%s_04_leaf_%s' % (f, q)] = Mk
            # 拇指：整根對到 tb 骨段（樞紐對準 JS 的拇指關節）
            tb = seg_xf(J['thumb_01_' + q][0], J['thumb_04_leaf_' + q][1], B['tb' + s][0], B['tb' + s][1], hand_r)
            for k in ('01', '02', '03', '04_leaf'):
                X['thumb_%s_%s' % (k, q)] = tb
            # 女性改了軀幹的縱向對應（見 torso_map），鎖骨頭要對到軀幹變換後的位置，鎖骨權重和脊椎權重混合的胸口頂端才不會上下錯開
            cl0 = tx(J['clavicle_' + q][0]) if self.ff and self.ff['anchor'] > 0 else B['cl' + s][0]
            X['clavicle_' + q] = seg_xf(J['clavicle_' + q][0], J['upperarm_' + q][0], cl0, B['sh' + s][0], 1.0)
            X['thigh_' + q] = seg_xf(J['thigh_' + q][0], J['calf_' + q][0], B['th' + s][0], B['kn' + s][0], th_r)
            X['calf_' + q] = seg_xf(J['calf_' + q][0], J['foot_' + q][0], B['kn' + s][0], B['an' + s][0], sh_r)
            # 腳：腳踝→腳掌對到 an→to；寬度照小腿的比例
            fr = max(0.8, min(1.4, (sh_r + 1) / 2 * self.R['toe']['s'] / 1.05))
            X['foot_' + q] = seg_xf(J['foot_' + q][0], J['ball_' + q][0], B['an' + s][0], B['to' + s][0], fr)
            bl = (J['ball_leaf_' + q][1] - J['ball_' + q][0]).length
            to_t = B['to' + s][0] + (B['to' + s][1] - B['to' + s][0]).normalized() * bl * (B['to' + s][0] - B['an' + s][0]).length / (J['ball_' + q][0] - J['foot_' + q][0]).length
            X['ball_' + q] = seg_xf(J['ball_' + q][0], J['ball_leaf_' + q][1], B['to' + s][0], to_t, fr)
            X['ball_leaf_' + q] = X['ball_' + q]
        # 脖子：頸根→頭根對到 198 的 neck 骨，粗細照被取代的脖子部件
        nr = None
        nh, nt = B['neck']
        ds = [axis_dist(c, nh, nt + (nt - nh) * 0.5) for c, g in self.pts if g == 12]
        ds = [d for d, k in ds if 0.1 < k < 0.6]
        src = self.src_radius('neck_01', 0.2, 0.8)
        if len(ds) > 20 and src:
            nr = max(0.8, min(1.6, median(ds) / src))
            if os.environ.get('REAL_DEBUG'):
                print('  脖子半徑比 %.2f（被取代部件 %.3f m／底模 %.3f m）' % (median(ds) / src, median(ds), src))
        # 脖子寬度上限：照參考圖的「頸寬／頭高」（NECK_W）。被取代的脖子部件是配合動畫頭顱做的粗管（悟空 r＝0.064、比克 0.062），
        # 換成底模的頭之後頭顱比較窄，脖子顯得又粗（量測：魯夫頸寬 0.58 頭高、娜美 0.45；參考 0.5／0.35）。
        # 底模的頸寬照量測工具的量法：下巴到頸根之間每 1 cm 一層、脖子主導的頂點左右寬度，取最細的一層
        if self.hargs is not None and src:
            a = self.hargs
            hs = self.R['hr'] * (0.9 * a['cranium'][1] + 0.08 + 0.9 * 0.86 * a['face_len'] + 0.06)   # 頭顱高（下巴到頭頂，同 head_map）
            nw = NECK_W_HERO.get(self.R.get('id', ''), NECK_W[self.sex]) * hs
            yc, yr = J['Head'][0].y + self.S['lm']['chin'], J['neck_01'][0].y
            # 只量脖子骨主導的頂點（nr 只縮放這些；下巴底下 Head 主導的那幾圈照 head_map 走，不受 nr 影響）
            nv = [c for c, ws in zip(self.S['co'], self.S['W']) if max(ws, key=lambda t: t[1])[0] == 'neck_01' and abs(c.x) < 0.12]
            rows = []
            y = yc - 0.005
            while y > yr:
                xs = [c.x for c in nv if abs(c.y - y) < 0.005]
                # 左右兩側都要有頂點（男性底模下巴底下只有前後中線附近幾個頂點的那幾層不算）
                if len(xs) >= 4 and min(xs) < -0.02 and max(xs) > 0.02:
                    rows.append(max(xs) - min(xs))
                y -= 0.01
            if rows:
                cap = nw / min(rows)
                if os.environ.get('REAL_DEBUG'):
                    print('  脖子寬度：頭高 %.3f m × %.2f ＝ %.3f m；底模頸寬 %.3f m → 上限 %.2f 倍（原本 %.2f）' % (hs, nw / hs, nw, min(rows), cap, nr or 1.1))
                nr = min(nr or 1.1, cap)
        # 女性的頸根照軀幹的縱向對應放（在 198 頸骨上段，見 torso_map），脖子從那裡接到頭
        n0 = tx(J['neck_01'][0]) if self.ff and self.ff['anchor'] > 0 else nh
        X['neck_01'] = seg_xf(J['neck_01'][0], J['Head'][0], n0, nt, nr or 1.1)
        self.neck_r = (nr or 1.1) * (src or 0.035)   # 脖子半徑（shoulder_slope 用）
        X['Head'] = X['neck_01']
        hf = self.head_map() if self.hargs is not None else None
        TORSO = {'root', 'pelvis', 'spine_01', 'spine_02', 'spine_03'}
        src = self.S['co']
        if hf and (self.hargs.get('nose', 1.0) < 1.0 or self.hargs.get('muzzle', 0.0) > 0):
            src = flatten_nose(self.S, 1.0 - max(0.0, self.hargs['nose']), self.hargs.get('muzzle', 0.0))
        out = []
        for c, ws in zip(src, self.S['W']):
            acc = V((0, 0, 0))
            tot = 0.0
            for n, w in ws:
                if n in TORSO:
                    p = tx(c)
                elif n == 'Head' and hf:
                    p = hf(c)
                else:
                    M = X.get(n)
                    p = tx(c) if M is None else (M @ c) if isinstance(M, Matrix) else M(c)
                acc += p * w
                tot += w
            out.append(acc / (tot or 1.0))
        sp = self.ff or MALE_SLOPE_HERO.get(self.R.get('id', ''))
        if sp and (sp['slope'] > 0 or sp['neck_drop'] > 0):
            self.shoulder_slope(out, sp)
        amt = RELIEF_HERO.get(self.R.get('id', ''))
        if amt:
            self.relief(out, amt)
        if os.environ.get('REAL_DEBUG'):
            self.arm_section_debug(out)
        return out

    def relief(self, out, amt, near=3, far=10, lim=0.006):
        """四肢的肌肉起伏放大 amt 倍（帶通）：每個頂點沿法線離「近鄰平滑 near 輪」的距離是起伏＋整體的弧度，
        再減掉它在更大範圍（far 輪）的平均，只留肌肉尺度的起伏（圓管本身的弧度不會被放大成整條變粗）。
        只作用在上臂、前臂、大腿、小腿的權重上（依權重比例漸變），軀幹、手、脖子與頸部接縫不動；每點最多挪 lim。"""
        S = self.S
        bu = S['used']
        polys = [tuple(bu[i] for i in p) for p in S['polys']]
        nb = neighbors(len(out), polys)
        LIMB = ('upperarm_', 'lowerarm_', 'thigh_', 'calf_')
        seam = {bu[i] for i, f in enumerate(S['seam']) if f}
        wl = [0.0] * len(out)
        for i in bu:
            if i not in seam:
                wl[i] = sum(w for n, w in S['W'][i] if n.startswith(LIMB))
        idx = [i for i in bu if wl[i] > 0.01]
        # 頂點法線（面法線面積加權）
        nrm = [V((0, 0, 0)) for _ in out]
        for p in polys:
            c0 = out[p[0]]
            fn = V((0, 0, 0))
            for a, b in zip(p[1:-1], p[2:]):
                fn += (out[a] - c0).cross(out[b] - c0)
            for i in p:
                nrm[i] += fn
        for i in idx:
            if nrm[i].length > 1e-12:
                nrm[i].normalize()
        ps = list(out)
        for _ in range(near):
            ps = [(ps[i] + sum((ps[j] for j in nb[i]), V((0, 0, 0))) / len(nb[i])) * 0.5 if nb[i] else ps[i] for i in range(len(ps))]
        dn = [(out[i] - ps[i]).dot(nrm[i]) for i in range(len(out))]
        ds = list(dn)
        for _ in range(far):
            ds = [(ds[i] + sum(ds[j] for j in nb[i]) / len(nb[i])) * 0.5 if nb[i] else ds[i] for i in range(len(ds))]
        mv = 0.0
        for i in idx:
            d = max(-lim, min(lim, (dn[i] - ds[i]) * amt * wl[i]))
            out[i] = out[i] + nrm[i] * d
            mv = max(mv, abs(d))
        if os.environ.get('REAL_DEBUG'):
            print('  肌肉起伏 ×%.1f：%d 頂點，最多挪 %.1f mm' % (amt, len(idx), mv * 1000))

    def arm_section_debug(self, out):
        """除錯：左上臂、左前臂沿骨每 0.1 一段，正面看的寬度（垂直骨軸、在 xy 平面內）與前後厚度（z），單位公分。"""
        B, W = self.B, self.S['W']
        for qb, bn in (('upperarm_l', 'shL'), ('lowerarm_l', 'elL')):
            h, t = B[bn]
            d = (t - h).normalized()
            u = V((-d.y, d.x, 0)).normalized()
            rows = {}
            for c, ws in zip(out, W):
                if max(ws, key=lambda x: x[1])[0] != qb:
                    continue
                k = (c - h).dot(t - h) / (t - h).length_squared
                if 0 <= k <= 1:
                    rows.setdefault(round(k * 10), []).append(((c - h).dot(u), c.z))
            print('  斷面 %s：' % qb + ' '.join('%d:%.1f/%.1f' % (i, 100 * (max(a for a, _ in r) - min(a for a, _ in r)), 100 * (max(z for _, z in r) - min(z for _, z in r)))
                                           for i, r in sorted(rows.items())))

    def shoulder_slope(self, out, sp=None):
        """女性的頸肩線（就地改 out）：底模 Superhero 女性的斜方肌是一塊平台，從頸根平平地伸到 |x|≈0.15 才折下三角肌，
        正面看頸根到肩頭幾乎水平、肩頭一個直角（方肩）。anchor 只能整塊上下挪這個平台，挪低時（頸根放低、脖子變長）平台被壓扁，
        和脖子交界成一階台階。所以改在混合完的位置上直接整形，只依位置、不依權重（鎖骨／上臂混合的頂點和旁邊的頂點一起動，不會裂開）：
          neck_drop：離頸軸（xz 距離）超過脖子半徑 rn 的地方，在 rn～rn＋3.5 cm 內漸增地往下壓，頸根往下退、脖子露出更長；
          slope：再依 |x| 從 rn 到肩關節 x 漸增地往下壓，頸根到肩頭成一條下斜的肩線，肩頭的頂也一起壓圓。
        壓的量在肩關節下 7 cm 到肩關節高度之間由 0 漸增到全量（腋下與胸側不動）；頭（含頸部接縫那一圈，Head 權重 > 0）不動。"""
        ff, B, W = sp or self.ff, self.B, self.S['W']
        nh, nt = B['neck']
        zc = nh.z
        ys, xs = B['shL'][0].y, abs(B['shL'][0].x)
        rn = self.neck_r
        y_lo, y_hi = ys - 0.07, ys
        dn, dsl = ff['neck_drop'], ff['slope']
        n = 0
        for i, (c, ws) in enumerate(zip(out, W)):
            if any(nm == 'Head' for nm, _ in ws):
                continue
            g = smooth((c.y - y_lo) / (y_hi - y_lo))
            if g <= 0:
                continue
            r = math.hypot(c.x, c.z - zc)
            d = dn * smooth((r - rn) / 0.035) + dsl * smooth((abs(c.x) - rn) / max(0.02, xs - rn))
            if d > 0:
                out[i] = V((c.x, c.y - d * g, c.z))
                n += 1
        if os.environ.get('REAL_DEBUG'):
            print('  肩線：脖子半徑 %.3f，頸根下壓 %.3f、肩頭再壓 %.3f，%d 頂點' % (rn, dn, dsl, n))


# ---------------------------------------------------------------- 主流程
def make(F, body_parts, name='realbody', hargs=None):
    """body_parts：英雄的全部身體部件（含標記 skin=1 的）。hargs：anime_head 的參數（有就連頭一起換成底模的頭）。
    回傳 (真人身體物件, (KDTree, 每頂點權重 {198 骨名: w}, 被蓋住程度, 是否接縫), 其餘部件, 頭顱物件或 None)。"""
    hid = F.R.get('id', '')
    sex = 'Female' if hid in FEMALE else 'Male'
    skins = [o for o in body_parts if o.get('skin')]
    rest = [o for o in body_parts if not o.get('skin')]
    fitter = Fitter(F, sex, skins, hargs)
    S = fitter.S
    co_all = fitter.fit()
    skull = None
    if hargs is not None:
        hu = S['hused']
        hm = {o: n for n, o in enumerate(hu)}
        mh = bpy.data.meshes.new(name + '_head')
        mh.from_pydata([tuple(co_all[i]) for i in hu], [], [tuple(hm[i] for i in p) for p in S['hpolys']])
        mh.update()
        skull = bpy.data.objects.new(name + '_head', mh)
        bpy.context.scene.collection.objects.link(skull)
        skull['chin_y'] = fitter.head_info['chin_y']
        if not hargs['ears']:
            drop_ears(skull, [S['co'][i] - S['J']['Head'][0] for i in hu], S['lm'])
        if hargs.get('egg'):
            round_cranium(skull, F, fitter.head_info['eye_y'], hargs['egg'])   # 耳朵拿掉之後再量顱骨範圍
        if hargs.get('recede'):
            recede_chin(skull, F, fitter.head_info['eye_y'], fitter.head_info['chin_y'], hargs['recede'])
        if hargs.get('relax'):
            relax_face(skull, F, fitter.head_info['eye_y'], hargs['relax'])
    used = S['used']
    co = [co_all[i] for i in used]
    # 有底模的頭時，接縫那一圈頂點整個跟著頭骨（頭顱是掛在頭骨上的剛體，兩邊的接縫才不會在轉頭時裂開）
    seam = list(S['seam']) if skull else [False] * len(used)
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(c) for c in co], [], S['polys'])
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    # 不重算法線：頭部挖空後是開口網格，重算可能整張翻面；底模原本的繞序就是朝外
    kit.tag(ob, 0, mat=4, grp=G_REAL, ol=1.0)
    weights = []
    for i in used:
        acc = {}
        for n, w in S['W'][i]:
            for b, k in bone_map(n):
                acc[b] = acc.get(b, 0.0) + w * k
        weights.append(acc)
    for i, s in enumerate(seam):
        if s:
            weights[i] = {'head': 1.0}
    dom = [max(w.items(), key=lambda kv: kv[1])[0] for w in weights]
    skin_tree = merged_tree(skins)
    real_tree = BVHTree.FromObject(ob, bpy.context.evaluated_depsgraph_get())
    kd0 = KDTree(len(me.vertices))
    for i, v in enumerate(me.vertices):
        kd0.insert(v.co, i)
    kd0.balance()
    retarget(rest, F, skin_tree, real_tree, kd0, dom)
    float_on([o for o in rest if o.get('wrap')], real_tree)
    # trim＝1 的部件（貼在被取代部件表面上的細飾條，例如小櫻上衣的拉鍊）不算遮住身體：
    # 拉鍊只有 1 公分寬，底下的乳溝離被取代的上衣超過 3.5 cm，被當成「衣物蓋住、又沒有皮膚部件」刪掉，胸口沿拉鍊破一個洞，
    # 從洞裡看到外框殼（側面看是拉鍊旁一排黑色碎片）
    # wrap＝1 的細帶（娜美比基尼的掛脖綁帶）同理：綁帶比底下的斜方肌窄，骨軸射線先穿過綁帶再到皮膚，
    # conform 會把綁帶兩側的皮膚拉回綁帶內側，後頸輪廓上沿綁帶缺一排階梯；改由 float_on 把綁帶整條抬到皮膚外面
    # hug＝環帶（見 hug_fit）也不參與：環帶內壁已經在皮膚外 1.5 mm，底下的皮膚不必收；算成「蓋住」的話那圈皮膚改用骨熱權重，
    # 環帶外露在兩側的皮膚卻是底模權重，一擺手臂環帶連同底下那圈皮膚和手臂錯開（比克遊戲鏡頭下臂章一側懸空、透出背景）
    covered, under, pin = conform(ob, [o for o in rest if not (o.get('trim') or o.get('wrap') or o.get('hug') is not None)], F, dom, seam)
    weights, dom, covered, seam, under, pin = drop_covered(ob, skin_tree, covered, weights, dom, seam, hollow=hollow_mask(ob, rest, F, dom, covered), under=under, pin=pin)
    sy = sum(v.co.y for v, f in zip(ob.data.vertices, seam) if f) / max(1, sum(1 for f in seam if f))   # 頸部接縫的平均高度
    if os.environ.get('REAL_DEBUG') and any(seam):
        sys_ = [v.co.y for v, f in zip(ob.data.vertices, seam) if f]
        print('  頸部接縫高度：%.3f～%.3f m（平均 %.3f）' % (min(sys_), max(sys_), sy))
    cov = spread(ob, covered)
    pin = spread_pin(ob, pin, dom, F)
    # 權重查表要在上色切線之前建立（切線會在邊上插入新頂點，新頂點取最近的舊頂點權重）
    kd = KDTree(len(ob.data.vertices))
    for i, v in enumerate(ob.data.vertices):
        kd.insert(v.co, i)
    kd.balance()
    # 切線前的網格另存一份：上色切線（iso_cut 在邊上插點、refine_near 細分）新增的頂點，權重要照它落在哪個舊面上內插，
    # 不能只取最近的舊頂點。底模頂點約 2 cm 一個，腋下、肩頭這種手臂權重一條邊就從九成掉到一成的地方，
    # 沿色界的新頂點各自跳到兩端其中一個的權重：站姿看不出來，一抬手色界就拉成階梯、三角形互相折疊，外框殼從縫裡露出黑色碎片（小櫻出拳時的肩膀）
    sco, spolys = [V(v.co) for v in ob.data.vertices], [tuple(p.vertices) for p in ob.data.polygons]
    src = (BVHTree.FromPolygons(sco, spolys), sco, spolys)
    project(ob, skins, F, kd, dom)
    global _WSAMPLE
    lk = (kd, weights, None, None, src)

    def wsample(co):
        acc = {}
        for j, t in src_mix(lk, co):
            for b, w in weights[j].items():
                acc[b] = acc.get(b, 0.0) + w * t
        return acc
    _WSAMPLE = wsample
    try:
        repaint(ob, skins)
    finally:
        _WSAMPLE = None
    # 緊貼在衣物底下的皮膚不描外框：外框是沿法線往外撐的反向殼，比「皮膚到衣物內壁 3 mm＋衣物厚度」還厚，
    # 從袖口、衣緣附近的衣物外面穿出一排黑色鋸齒（佐助袖口下緣）。交界的三角形上外框倍率內插，露在外面的皮膚照舊
    OL = ob.data.attributes['ol'].data
    for i, u in enumerate(under):
        if u and not seam[i]:
            OL[i].value = 0.0
    if hargs is not None and hargs.get('soft') and any(seam):
        # soft 的頭（弗利沙）：脖子的外框倍率從接縫的 0.55（和頭顱一樣）往下 10 cm 內漸變回 1。
        # 頭顱 0.55、身體 1.0 時，外框在接縫處粗細跳一階，脖子側面的輪廓線斷成台階；頸肩交界的凹處，粗的反殼也會從皮膚裡穿出成尖刺
        vs = ob.data.vertices
        OL = ob.data.attributes['ol'].data
        OL0 = {V(v.co).to_tuple(5): OL[i].value for i, v in enumerate(vs)}
        # 只改接縫下 10 cm 以上（其他地方保留 project() 從舊部件投影的倍率）
        kit.paint_ol(ob, lambda co: min(OL0[co.to_tuple(5)], 0.55 + 0.45 * smooth((sy - co.y - 0.02) / 0.08)) if co.y > sy - 0.1 else None)
    # 被取代的部件留在場景裡（骨熱替身可能還用到），只是不再併進身體
    return ob, (kd, weights, cov, seam, src, pin), rest, skull


def round_cranium(skull, F, eye_y, egg):
    """眼線以上的顱骨往一個橢球靠攏（anime_head 的 egg）：底模的頭頂偏平、兩側近乎垂直，正面看是方頭，
    弗利沙的頭殼是光滑的蛋形（最寬在太陽穴、往頭頂圓收）。橢球中心在眼線上 0.1 hr，三軸取眼線以上頂點的範圍（前後分開量），
    每個頂點沿中心射線移到橢球面，移動比例從眼線往上 0.35 hr 漸變到 egg（後腦從眼線下 0.4 hr 開始），眼睛以下的臉與頸部接縫不動。"""
    c, hr = F.c, F.hr
    cen = V((c.x, eye_y + 0.1 * hr, c.z - 0.04 * hr))
    vs = skull.data.vertices
    up = [V(v.co) for v in vs if v.co.y > cen.y]
    rx = max(abs(p.x - cen.x) for p in up)
    ry = max(p.y for p in up) - cen.y
    rz0, rz1 = cen.z - min(p.z for p in up), max(p.z for p in up) - cen.z
    n = 0
    for v in vs:
        p = V(v.co)
        d = p - cen
        # 後腦（z<0）與兩側（太陽穴、耳朵補洞處）往下多圓一段到眼線下 0.4 hr：底模的後腦在眼線以下是垂直的平面（參考的後腦往後鼓），
        # 太陽穴是真人的凹窩加耳朵補洞的扇形面，只圓到眼線時側面在交界處高低不平，卡通著色切出一塊塊灰斑；正面（眼睛、臉）不動
        side = smooth((math.atan2(abs(d.x), d.z) - 0.8) / 0.5)
        y0 = eye_y - 0.4 * hr * max(smooth(-d.z / (0.6 * rz0)), side)
        t = egg * smooth((p.y - y0) / (0.35 * hr))
        if t <= 0:
            continue
        q = math.sqrt((d.x / rx) ** 2 + (d.y / ry) ** 2 + (d.z / (rz1 if d.z > 0 else rz0)) ** 2)
        if q < 1e-6:
            continue
        v.co = p.lerp(cen + d / q, t)
        n += 1
    skull.data.update()
    if os.environ.get('REAL_DEBUG'):
        _profile(skull, F, eye_y)
    print('  底模的頭：顱骨圓成蛋形 %d 頂點（半徑 %.3f／%.3f／%.3f～%.3f m）' % (n, rx, ry, rz0, rz1))


def recede_chin(skull, F, eye_y, chin_y, amt):
    """下半臉往後收（anime_head 的 recede，弗利沙）：底模的臉從眼睛到下巴是一面垂直的牆，下巴底面是水平的，側面看是方下巴。
    臉的前半部（頭心之前）從眼線往下漸漸往頭心收，下巴收最多，側面輪廓變成往後斜的尖下巴（參考 05 3/4 側）。
    頸部接縫開口 4 mm 內不動（接縫一動頭身就會裂開），往外 2 cm 內照距離漸漸放開（下巴尖離喉嚨的接縫只有兩三公分，放得太慢下巴底面會留下往前凸的棚子）。"""
    c, hr = F.c, F.hr
    bm = bmesh.new()
    bm.from_mesh(skull.data)
    bm.verts.ensure_lookup_table()
    ring = [v.co.copy() for e in bm.edges if e.is_boundary for v in e.verts]
    rkd = KDTree(len(ring))
    for i, p in enumerate(ring):
        rkd.insert(p, i)
    rkd.balance()
    # 離接縫越近收得越少（照距離連續漸變；用網格圈數截斷的話，下巴底面靠接縫的那幾圈不動、上面往後收，會在下巴底下推出一道往前凸的棚子）
    hold = lambda p: smooth((rkd.find(p)[2] - 0.004) / (0.12 * hr))
    span = max(1e-4, eye_y - chin_y)
    n = 0
    for v in bm.verts:
        p = v.co
        if p.z <= c.z:
            continue
        u = (eye_y - p.y) / span   # 眼線 0 → 下巴 1
        k = amt * smooth(u / 1.05) * smooth((p.z - c.z) / (0.4 * hr)) * hold(p)
        if k > 0:
            v.co = V((p.x, p.y, c.z + (p.z - c.z) * (1 - k)))
            n += 1
    bm.to_mesh(skull.data)
    bm.free()
    skull.data.update()
    print('  底模的頭：下半臉往後收 %d 頂點（下巴 %.0f%%）' % (n, amt * 100))


def relax_face(skull, F, eye_y, iters):
    """眼線以下的臉頰、下顎、太陽穴與耳朵補洞處做 Taubin 平滑（anime_head 的 relax，弗利沙）：
    底模的真人下顎角、咀嚼肌與耳朵補洞的扇形面經過收窄與後腦勺推移後高低不平，卡通著色在側面切出一塊塊三角形的灰斑。
    Taubin（λ 正、μ 負交替）不會像單純平均那樣把頭縮小。頸部接縫開口與往內兩圈的頂點不動（接縫頂點一動頭身就會裂開），
    範圍包含太陽穴：round_cranium 從眼線往上 0.35 hr 漸變到蛋形，部分移動的頂點在太陽穴留下一圈高低不平的帶子（側面看是灰斑），
    所以平滑到眼線上 0.35 hr 都是全量，再往上 0.4 hr 內漸漸停止（頭頂已經是光滑的橢球）。"""
    hr = F.hr
    bm = bmesh.new()
    bm.from_mesh(skull.data)
    bm.verts.ensure_lookup_table()
    fixed = {v for e in bm.edges if e.is_boundary for v in e.verts}
    for _ in range(2):
        fixed |= {u for v in list(fixed) for e in v.link_edges for u in e.verts}
    w = {v: 1 - smooth((v.co.y - eye_y - 0.35 * hr) / (0.4 * hr)) for v in bm.verts if v not in fixed}
    w = {v: k for v, k in w.items() if k > 1e-3}
    nb = {v: [e.other_vert(v) for e in v.link_edges] for v in w}
    p0 = {v: v.co.copy() for v in w}
    for it in range(iters * 2):
        lam = 0.5 if it % 2 == 0 else -0.53
        new = {}
        for v, k in w.items():
            if nb[v]:
                m = sum((u.co for u in nb[v]), V((0, 0, 0))) / len(nb[v])
                new[v] = v.co + (m - v.co) * lam * k
        for v, p in new.items():
            v.co = p
    mv = sum((v.co - p0[v]).length for v in w) / max(1, len(w))
    bm.to_mesh(skull.data)
    bm.free()
    skull.data.update()
    print('  底模的頭：臉頰與下顎平滑 %d 頂點（%d 輪，平均移動 %.1f mm）' % (len(w), iters, mv * 1000))


def _profile(skull, F, eye_y):
    """除錯：頭顱各高度（眼線為 0，以 hr 計）的寬度與前後範圍，以及頸部接縫開口的範圍。"""
    c, hr = F.c, F.hr
    me = skull.data
    cnt = {}
    for e in me.edges:
        cnt[e.key] = 0
    for f in me.polygons:
        for k in f.edge_keys:
            cnt[k] += 1
    bd = {i for k, n in cnt.items() if n == 1 for i in k}
    ps = [V(v.co) for v in me.vertices]
    b = [ps[i] for i in bd]
    if b:
        print('    接縫開口 y %.2f～%.2f hr、z %.2f～%.2f hr（頭心 z 為 0）' % ((min(p.y for p in b) - eye_y) / hr, (max(p.y for p in b) - eye_y) / hr,
                                                         (min(p.z for p in b) - c.z) / hr, (max(p.z for p in b) - c.z) / hr))
    for k in range(12, -12, -1):
        y0 = eye_y + k * 0.1 * hr
        sl = [p for p in ps if abs(p.y - y0) < 0.05 * hr]
        if sl:
            print('    y=%+.1f hr：寬 %.2f、前 %.2f、後 %.2f hr（%d 點）' % (k * 0.1, 2 * max(abs(p.x - c.x) for p in sl) / hr, (max(p.z for p in sl) - c.z) / hr, (min(p.z for p in sl) - c.z) / hr, len(sl)))


def drop_ears(skull, rel, lm, thr=0.058):
    """沒有耳朵（弗利沙）或另外接尖耳（比克）：拿掉底模的耳朵，洞補平。rel：每個頂點在底模裡相對 Head 骨的座標。"""
    eye = lm['eye']
    ear = [abs(c.x) > thr and eye - 0.085 < c.y < eye + 0.045 and -0.075 < c.z < 0.04 for c in rel]
    bm = bmesh.new()
    bm.from_mesh(skull.data)
    bm.verts.ensure_lookup_table()
    # 離頸部接縫三圈以內的不動：耳洞不能和頸部的開口連在一起
    near = {v for e in bm.edges if e.is_boundary for v in e.verts}
    for _ in range(3):
        near |= {u for v in list(near) for e in v.link_edges for u in e.verts}
    for v in near:
        ear[v.index] = False
    kill = [f for f in bm.faces if any(ear[v.index] for v in f.verts)]
    bmesh.ops.delete(bm, geom=kill, context='FACES_ONLY')
    bmesh.ops.delete(bm, geom=[e for e in bm.edges if not e.link_faces], context='EDGES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    # 頸部接縫也是開口，只補耳朵留下的洞（頭頂側、靠兩側的開口）
    hole = [e for e in bm.edges if e.is_boundary]
    # 每個洞：洞緣的中心加一個頂點，沿洞緣做扇形面（繞序照洞緣原本那一面反過來，法線才朝外），再細分、放鬆
    left = set(hole)
    bm.verts.index_update()
    n0 = len(bm.verts)   # 新頂點（扇形中心、細分）都接在後面
    new_f = []
    while left:
        e0 = left.pop()
        loop = [e0]
        v = e0.verts[1]
        while True:
            nxt = next((e for e in v.link_edges if e in left), None)
            if nxt is None:
                break
            left.discard(nxt)
            loop.append(nxt)
            v = nxt.other_vert(v)
        cen = sum((e.verts[0].co for e in loop), V((0, 0, 0))) / len(loop)
        if abs(cen.x) < 0.03:
            continue   # 頸部接縫的開口（在中線上）不補
        cen = bm.verts.new(cen)
        for e in loop:
            f0 = e.link_faces[0]
            lv = list(f0.verts)
            i = lv.index(e.verts[0])
            a_, b_ = (e.verts[0], e.verts[1]) if lv[(i + 1) % len(lv)] == e.verts[1] else (e.verts[1], e.verts[0])
            new_f.append(bm.faces.new((b_, a_, cen)))
    res = {'faces': new_f}
    hs = set(hole)
    bmesh.ops.subdivide_edges(bm, edges=list({e for f in new_f for e in f.edges if e not in hs}), cuts=2, use_grid_fill=True)
    # 洞緣不動，補上的內部頂點（扇形中心與細分出來的）放鬆成平順的一片
    bm.verts.index_update()
    ring = {v for v in bm.verts if v.index >= n0}
    for _ in range(25):
        nxt = {}
        for v in ring:
            nb = [e.other_vert(v) for e in v.link_edges]
            nxt[v] = v.co.lerp(sum((u.co for u in nb), V((0, 0, 0))) / len(nb), 0.5)
        for v, p in nxt.items():
            v.co = p
    bm.to_mesh(skull.data)
    bm.free()
    skull.data.update()
    print('  底模的頭：拿掉耳朵 %d 面、補 %d 面（洞邊 %d）' % (len(kill), len(res['faces']), len(hole)))


def head_paint(head, F, field, pal, mat=None):
    """頭顱上有明確形狀的色塊（弗利沙的紫色圓頂）：和 paint() 同一個想法，不靠 project() 逐頂點投影
    （底模頭頂的頂點稀，投影的標籤平滑後交界會沿三角形鋸齒，太陽穴一帶耳朵補洞的扇形面最明顯），
    dress_head 在投影之後直接用同一個場在底模的頭上切線上色。沒有換底模的頭時照舊畫在動畫頭顱上。
    field 用動畫頭顱（套 hx 之前）的座標。"""
    a = HEAD_ARGS.get(head.name)
    if a is None or not head_enabled(F.R.get('id', '')):
        return kit.paint_field(head, field, pal, mat)
    a.setdefault('paint', []).append((field, pal, mat))
    return head


def dress_head(skull, old, F, hargs):
    """底模的頭上色：顏色與外框倍率從動畫頭顱（old）就近投影；head_paint() 登錄的色塊直接切線上色；鼻子附近外框變細。接上尖耳等額外部件。"""
    kit.tag(skull, hargs['pal'], mat=4, grp=0, ol=0.55)
    n = len(skull.data.vertices)
    kd = KDTree(n)
    for i, v in enumerate(skull.data.vertices):
        kd.insert(v.co, i)
    kd.balance()
    project(skull, [old], F, kd, ['head'] * n, center=F.c + V((0, -F.hr * 0.1, -F.hr * 0.1)), iters=16)
    c, hx = F.c, F.R.get('hx', 1.0)
    for field, pal, mat in hargs.get('paint', []):
        # 底模的頭已經套過 hx（head_map）：換回動畫頭顱的座標再算場
        g = lambda co, field=field: field(V((c.x + (co.x - c.x) / hx, co.y, c.z + (co.z - c.z) / (0.5 + 0.5 * hx))))
        # 交界附近先細分一次：頭頂的面約 2 cm，交界轉彎處（額角）只切到一兩條長邊，會留下一片伸進色塊裡的細長三角形
        refine_near(skull, g, 1)
        kit.paint_field(skull, g, pal, mat)
        # iso_cut 偶爾切不開某些面（face_split 失敗），整面照中心歸一邊，交界就缺一角（後腦兩側各一塊方形缺口）：
        # 把還跨在等值線兩側的面三角化再切一次
        for _ in range(3):
            me = skull.data
            straddle = [f.index for f in me.polygons if min(g(V(me.vertices[k].co)) for k in f.vertices) < -1e-4 < 1e-4 < max(g(V(me.vertices[k].co)) for k in f.vertices)]
            if not straddle:
                break
            bm = bmesh.new()
            bm.from_mesh(me)
            bm.faces.ensure_lookup_table()
            bmesh.ops.triangulate(bm, faces=[bm.faces[i] for i in straddle])
            bm.to_mesh(me)
            bm.free()
            me.update()
            kit.paint_field(skull, g, pal, mat)
        me = skull.data
        FP, FM = me.attributes['fpal'].data, me.attributes['fmat'].data
        for f in me.polygons:
            if FP[f.index].value == pal and g(V(f.center)) > 0:
                FP[f.index].value = hargs['pal']
                FM[f.index].value = 4
        kit._face_to_vert(skull)
        if os.environ.get('REAL_DEBUG'):
            fr = [(f.center.y - c.y) / F.hr for f in me.polygons if FP[f.index].value == pal and abs(f.center.x - c.x) < F.hr * 0.15 and f.center.z > c.z]
            print('  頭顱解析色塊 pal=%d：%d 面，正前方最低 %.2f hr（頭心以上）' % (pal, sum(1 for f in me.polygons if FP[f.index].value == pal), min(fr) if fr else 99))
            fv = lambda f: [g(V(me.vertices[k].co)) for k in f.vertices]
            print('    越界的色塊面 %d、場內沒塗到的面 %d' % (sum(1 for f in me.polygons if FP[f.index].value == pal and max(fv(f)) > 0.002),
                                                    sum(1 for f in me.polygons if FP[f.index].value != pal and min(fv(f)) < -0.002)))
    hr = F.hr
    tip = max((V(v.co) for v in skull.data.vertices if abs(v.co.x - F.c.x) < 0.01 and v.co.y < F.c.y), key=lambda p: p.z)
    kit.paint_ol(skull, lambda co: 0.12 if (co - tip).length < hr * 0.3 else None)
    keep = hargs.get('keep') or []
    parts = []
    sk = [V(v.co) for v in skull.data.vertices]
    tree = BVHTree.FromObject(skull, bpy.context.evaluated_depsgraph_get())
    for o in keep:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)   # 鏡射變形過的部件繞序是反的
        bm.to_mesh(o.data)
        bm.free()
        if o.get('ear'):
            # 尖耳：底模的頭比動畫頭顱窄，整隻耳朵往內挪到貼著頭側（耳根埋進去 4 mm）
            vs = [V(v.co) for v in o.data.vertices]
            sx = 1 if sum(p.x for p in vs) > 0 else -1
            root = min(vs, key=lambda p: (p.x - F.c.x) * sx)
            side = [p for p in sk if (p.x - F.c.x) * sx > 0 and abs(p.y - root.y) < hr * 0.35 and abs(p.z - root.z) < hr * 0.3]
            if side:
                wall = max((p.x - F.c.x) * sx for p in side)
                dx = (wall - 0.004 - (root.x - F.c.x) * sx) * sx
                kit.deform(o, lambda p, dx=dx: V((p.x + dx, p.y, p.z)))
        else:
            # 其他附加部件（比克的額頭隆起）：底模的額頭比較高，沿頭心往外推到貼著表面
            vs = [V(v.co) for v in o.data.vertices]
            cen = sum(vs, V((0, 0, 0))) / len(vs)
            d = cen - F.c
            dist = d.length
            d.normalize()
            hit = tree.ray_cast(F.c, d, hr * 3)
            if hit[0] is not None:
                rad = min((p - cen).length for p in vs)
                push = hit[3] + rad * 0.6 - dist
                if push > 0:
                    kit.deform(o, lambda p, m=d * push: p + m)
        o = kit.subsurf(o, 1)
        hole = o.get('hole')   # (色號, 軸方向 xyz, 孔半徑)：額外部件上要畫的孔（弗利沙太陽穴突起上的黑色耳孔）
        kit.tag(o, hargs['pal'], mat=4, grp=0, ol=0.3 if hole else 0.55)
        if hole:
            pal_h, ax, rh = int(hole[0]), V(hole[1:4]).normalized(), hole[4]
            vs = [V(v.co) for v in o.data.vertices]
            cen = sum(vs, V((0, 0, 0))) / len(vs)
            # 軸外側（離頭心較遠的那面）、離軸 rh 以內塗成孔；兩個連續函式取 max，交界平滑
            kit.paint_field(o, lambda co: max(((co - cen) - ax * (co - cen).dot(ax)).length / rh - 1, -(co - cen).dot(ax) / rh), pal_h, 0)
        parts.append(o)
    if parts:
        chin = skull['chin_y']
        skull = kit.join([skull] + parts, 'realhead')
        skull['chin_y'] = chin
    if hargs.get('soft'):
        skull['soft'] = hargs['soft']   # build_heroes 在 crisp_split 存好 nrm 之後呼叫 soft_normals
    return skull


def fit_cap(o, skull, c, gap, thick):
    """髮帽（加厚過的殼）埋進底模頭顱的部分，沿頭心往外推到貼著頭顱表面（外層離表面 gap＋厚度、內層 gap），
    厚度不變；沒埋進去的地方不動。內外層以頂點法線朝外或朝內分辨（solidify 的內層法線朝內）。"""
    tree = BVHTree.FromObject(skull, bpy.context.evaluated_depsgraph_get())
    moved = 0
    for v in o.data.vertices:
        d = V(v.co) - c
        r = d.length
        if r < 1e-5:
            continue
        d /= r
        hit = tree.ray_cast(c, d, 1.0)
        if hit[0] is None:
            continue
        need = hit[3] + gap + (thick if V(v.normal).dot(d) > 0 else 0.0)
        if r < need:
            v.co = c + d * need
            moved += 1
    o.data.update()
    if os.environ.get('REAL_DEBUG'):
        print('  髮帽貼合頭顱 %s：%d 頂點往外推' % (o.name, moved))


def _skull_graph(me):
    """頭顱以位置併點的鄰接表（crisp_split 在色界切開的重複頂點算同一點）、頸部接縫開口那圈的點，
    與平滑權重（接縫那圈 0、往內第一圈 0.35、第二圈 0.7、其他 1）。"""
    gid, gpos = [], {}
    for v in me.vertices:
        gid.append(gpos.setdefault((round(v.co.x, 5), round(v.co.y, 5), round(v.co.z, 5)), len(gpos)))
    ng = len(gpos)
    nb = [set() for _ in range(ng)]
    ecount = {}
    for f in me.polygons:
        vs = [gid[i] for i in f.vertices]
        for a, b in zip(vs, vs[1:] + vs[:1]):
            if a != b:
                nb[a].add(b)
                nb[b].add(a)
                key = (min(a, b), max(a, b))
                ecount[key] = ecount.get(key, 0) + 1
    # 併點後只被一個面用到的邊＝頸部接縫開口
    ring = {x for key, n in ecount.items() if n == 1 for x in key}
    wt = [1.0] * ng
    lvl, seen = set(ring), set(ring)
    for w in (0.0, 0.35, 0.7):
        for g in lvl:
            wt[g] = w
        lvl = {h for g in lvl for h in nb[g]} - seen
        seen |= lvl
    return gid, ng, nb, ring, wt


def soft_normals(skull, iters, k=0.5):
    """整顆頭的法線在網格上平滑（anime_head 的 soft，弗利沙）：底模頂點稀，經過收下巴（taper）、鼓後腦（occ）與蛋形頭殼（egg）的變形後，
    下顎後方、耳朵補洞處到脖子的相鄰頂點法線差很多，卡通明暗的硬交界切出一塊塊直邊的多邊形灰斑，反殼外框也沿摺痕斷成尖刺。
    只動法線不動形狀；頸部接縫開口那圈固定（之後 seam_normals 和身體對齊），往內兩圈漸漸放開，接縫附近的明暗才接得上身體。"""
    me = skull.data
    nrm = me.attributes['nrm'].data
    gid, ng, nb, ring, wt = _skull_graph(me)
    N = [V((0, 0, 0)) for _ in range(ng)]
    for i in range(len(me.vertices)):
        N[gid[i]] += V(nrm[i].vector)
    for x in N:
        x.normalize()
    for _ in range(iters):
        N2 = []
        for g in range(ng):
            if wt[g] <= 0 or not nb[g]:
                N2.append(N[g])
                continue
            m = sum((N[h] for h in nb[g]), V((0, 0, 0)))
            m.normalize()
            N2.append(N[g].lerp(m, k * wt[g]).normalized())
        N = N2
    for i in range(len(me.vertices)):
        nrm[i].vector = N[gid[i]]
    print('  底模的頭：法線平滑 %d 點、%d 輪（接縫 %d 點固定）' % (ng, iters, len(ring)))


def soft_ao(skull, ao_s, body, ao_b, iters=8, k=0.6):
    """頭顱的烘焙遮蔽也平滑，並和身體在頸部接縫對齊（anime_head 的 soft）：遮蔽在著色器裡會把明暗交界往亮部推，
    頭顱與身體各自烘焙、接縫兩側的值不同，下巴底下的陰影在接縫處切成一條直線，頭顱這側稀疏頂點的雜訊又讓陰影邊緣成鋸齒多邊形。
    接縫那圈取兩側平均（頭顱與身體一起改），頭顱其餘的點在網格上平滑幾輪（接縫固定）。ao_s／ao_b 原地修改。"""
    me = skull.data
    gid, ng, nb, ring, wt = _skull_graph(me)
    kd = KDTree(len(body.data.vertices))
    for i, v in enumerate(body.data.vertices):
        kd.insert(v.co, i)
    kd.balance()
    A, C = [0.0] * ng, [0] * ng
    for i, g in enumerate(gid):
        A[g] += ao_s[i]
        C[g] += 1
    A = [a / max(1, c) for a, c in zip(A, C)]
    rep = {}
    for i, g in enumerate(gid):
        rep.setdefault(g, i)
    if os.environ.get('REAL_DEBUG'):
        ry = sum(me.vertices[rep[g]].co.y for g in ring) / max(1, len(ring))
        def band(vals):
            vals = sorted(vals)
            return '%d 點 %s' % (len(vals), [round(vals[int(k * (len(vals) - 1))], 2) for k in (0, 0.1, 0.5, 0.9, 1)] if vals else [])
        print('    接縫高度 %.3f；頭顱接縫 AO %s' % (ry, band([A[g] for g in ring])))
        for lo, hi in ((0, 0.02), (0.02, 0.05), (0.05, 0.1)):
            print('    頭顱 接縫上 %.2f～%.2f m 前方：%s' % (lo, hi, band([A[gid[i]] for i, v in enumerate(me.vertices) if lo <= v.co.y - ry < hi and v.co.z > 0])))
            print('    身體 接縫下 %.2f～%.2f m 前方：%s' % (lo, hi, band([ao_b[j] for j, v in enumerate(body.data.vertices) if lo <= ry - v.co.y < hi and abs(v.co.x) < 0.08 and v.co.z > 0])))
    for g in ring:
        hits = kd.find_range(me.vertices[rep[g]].co, 1e-5)
        if hits:
            m = (A[g] + sum(ao_b[j] for _c, j, _d in hits) / len(hits)) / 2
            A[g] = m
            for _c, j, _d in hits:
                ao_b[j] = m
    for _ in range(iters):
        A = [A[g] + (sum(A[h] for h in nb[g]) / len(nb[g]) - A[g]) * k * wt[g] if wt[g] > 0 and nb[g] else A[g] for g in range(ng)]
    for i, g in enumerate(gid):
        ao_s[i] = A[g]
    # 下巴底下的脖子：身體這側的頂點更稀（脖子一圈只有十幾個點），被下顎遮住的遮蔽值 0.5～0.8，
    # 著色器的明暗門檻沿這些點的內插切出直邊的多邊形灰斑。接縫上下幾公分的遮蔽減半（照高度連續漸變，接縫兩側用同一個函式，不會切出新的交界），
    # 身體這側再在網格上平滑幾輪
    ry = sum(me.vertices[rep[g]].co.y for g in ring) / max(1, len(ring))
    lift = lambda y: 0.5 * smooth((y - (ry - 0.085)) / 0.045) * (1 - smooth((y - (ry + 0.03)) / 0.04))
    for i, v in enumerate(me.vertices):
        ao_s[i] = 1 - (1 - ao_s[i]) * (1 - lift(v.co.y))
    bv = body.data.vertices
    sel = [ry - 0.1 < v.co.y < ry + 0.01 and abs(v.co.x) < 0.13 for v in bv]
    bn = [[] for _ in bv]
    for e in body.data.edges:
        a, b = e.vertices
        if sel[a] and sel[b]:
            bn[a].append(b)
            bn[b].append(a)
    seam_b = {j for g in ring for _c, j, _d in kd.find_range(me.vertices[rep[g]].co, 1e-5)}
    for _ in range(6):
        ao_b[:] = [ao_b[j] + (sum(ao_b[h] for h in bn[j]) / len(bn[j]) - ao_b[j]) * 0.5 if sel[j] and bn[j] and j not in seam_b else ao_b[j] for j in range(len(bv))]
    for j, v in enumerate(bv):
        if sel[j]:
            ao_b[j] = 1 - (1 - ao_b[j]) * (1 - lift(v.co.y))
    print('  底模的頭：遮蔽平滑 %d 點、%d 輪，接縫 %d 點和身體對齊；下巴底下的脖子遮蔽減半（%d 個身體頂點）' % (ng, iters, len(ring), sum(sel)))


def seam_normals(body, skull):
    """頭顱與身體在頸部接縫的那圈頂點，兩邊各自只算到一側的面：平均兩邊的法線，明暗才接得上。"""
    nb_ = body.data.attributes['nrm'].data
    ns_ = skull.data.attributes['nrm'].data
    kd = KDTree(len(body.data.vertices))
    for i, v in enumerate(body.data.vertices):
        kd.insert(v.co, i)
    kd.balance()
    bm = bmesh.new()
    bm.from_mesh(skull.data)
    edge_v = {v.index for e in bm.edges if e.is_boundary for v in e.verts}
    bm.free()
    k = 0
    if os.environ.get('REAL_DEBUG'):
        ds = sorted(kd.find(skull.data.vertices[i].co)[2] for i in edge_v)
        print('  接縫距離（mm）：', len(ds), [round(d * 1000, 2) for d in ds[::max(1, len(ds) // 8)]])
    for i in edge_v:
        p = skull.data.vertices[i].co
        hits = kd.find_range(p, 1e-5)
        if not hits:
            continue
        nsum = V(ns_[i].vector) + sum((V(nb_[j].vector) for _c, j, _d in hits), V((0, 0, 0))) / len(hits)
        nsum.normalize()
        ns_[i].vector = nsum
        for _c, j, _d in hits:
            nb_[j].vector = nsum
        k += 1
    print('  頸部接縫：%d 頂點對齊法線' % k)



# 手臂（sh／el）也平滑：底模手臂一圈只有十來個頂點，上臂與前臂的卡通明暗交界沿三角形切成一段段折線，
# 再加上底模的肌肉分塊（肱二頭、肱橈肌）各自一塊亮暗，整隻手臂看起來是稜面的。
# 手（wr）與手指也平滑：底模的手一節手指一圈只有 4～6 個頂點，握拳時手背、手腕到手背之間是一階一階的亮暗斑，拳頭像一塊有稜角的積木。
# 手指給得比手背少一點，握拳時指節之間還分得出來
SMOOTH_B = {'neck': 1.0, 'clL': 1.0, 'clR': 1.0, 'ribs': 1.0, 'torso': 0.5, 'shL': 0.8, 'shR': 0.8, 'elL': 0.8, 'elR': 0.8,
            'wrL': 1.0, 'wrR': 1.0, 'faL': 0.7, 'faR': 0.7, 'fbL': 0.7, 'fbR': 0.7, 'fcL': 0.7, 'fcR': 0.7, 'tbL': 0.7, 'tbR': 0.7}


def _smooth_graph(ob, lookup, sel=None):
    """以位置併點（crisp_split 在色界切開的重複頂點算同一點）的鄰接表，與每點的平滑權重（照 SMOOTH_B）。
    sel：只算這些頂點（None＝全部）。回傳 (每頂點的點號, 點數, 鄰接, 權重)。"""
    kd, weights, _cov, seam = lookup[:4]
    me = ob.data
    gid, gpos = [], {}
    for i, v in enumerate(me.vertices):
        if sel is not None and not sel[i]:
            gid.append(-1)
            continue
        key = (round(v.co.x, 5), round(v.co.y, 5), round(v.co.z, 5))
        gid.append(gpos.setdefault(key, len(gpos)))
    ng = len(gpos)
    nb = [set() for _ in range(ng)]
    for e in me.edges:
        a, b = gid[e.vertices[0]], gid[e.vertices[1]]
        if a >= 0 and b >= 0 and a != b:
            nb[a].add(b)
            nb[b].add(a)
    wt = [0.0] * ng
    for key, g in gpos.items():
        _c, j, _d = kd.find(V(key))
        if not seam[j]:
            wt[g] = min(1.0, sum(w * SMOOTH_B.get(b, 0.0) for b, w in weights[j].items()))
    return gid, ng, nb, wt


def smooth_normals(ob, lookup, iters=8, k=0.5):
    """頸部與胸口的法線在網格上平滑幾輪（在 crisp_split 存好 nrm 之後呼叫）。
    底模是低面數的拓撲，鎖骨窩、胸骨上窩、胸鎖乳突肌一帶的三角形大、相鄰頂點的法線差很多，
    逐面內插後在卡通明暗的硬交界上變成一塊塊鋸齒斑（比克整片綠胸口最明顯）。和 anime_head 的 face_normals 同一個想法：
    只動法線、不動形狀，平滑程度照頂點在脖子／鎖骨／胸廓骨上的權重（腹部減半），頸部接縫那圈不動（之後 seam_normals 會和頭對齊）。"""
    me = ob.data
    nrm = me.attributes['nrm'].data
    gid, ng, nb, wt = _smooth_graph(ob, lookup)
    N = [V((0, 0, 0)) for _ in range(ng)]
    for i in range(len(me.vertices)):
        N[gid[i]] += V(nrm[i].vector)
    for x in N:
        x.normalize()
    for _ in range(iters):
        N2 = []
        for g in range(ng):
            if wt[g] <= 0 or not nb[g]:
                N2.append(N[g])
                continue
            m = sum((N[h] for h in nb[g]), V((0, 0, 0)))
            m.normalize()
            N2.append(N[g].lerp(m, k * wt[g]).normalized())
        N = N2
    for i in range(len(me.vertices)):
        nrm[i].vector = N[gid[i]]
    print('  真人身體：頸胸法線平滑 %d 點' % sum(1 for w in wt if w > 0))


def smooth_ao(body, ao, lookup, iters=4, k=0.6):
    """烘焙遮蔽（每頂點 28 條射線）在頸胸一帶也平滑幾輪：底模頂點稀，單點的雜訊在著色器裡會把明暗交界推出鋸齒（遮蔽會把交界往亮部推）。
    只動併進身體後屬於真人身體（grp＝G_REAL）的頂點；ao 是 body 每頂點的值，原地修改。"""
    G = body.data.attributes['grp'].data
    sel = [G[i].value == G_REAL for i in range(len(body.data.vertices))]
    gid, ng, nb, wt = _smooth_graph(body, lookup, sel)
    A, C = [0.0] * ng, [0] * ng
    for i, g in enumerate(gid):
        if g >= 0:
            A[g] += ao[i]
            C[g] += 1
    A = [a / max(1, c) for a, c in zip(A, C)]
    for _ in range(iters):
        A = [A[g] + (sum(A[h] for h in nb[g]) / len(nb[g]) - A[g]) * k * wt[g] if wt[g] > 0 and nb[g] else A[g] for g in range(ng)]
    for i, g in enumerate(gid):
        if g >= 0:
            ao[i] = A[g]


def spread(ob, covered, iters=6):
    """被衣物蓋住的程度（0..1）：蓋住的頂點 1，往外沿網格擴散幾圈漸變到 0。"""
    me = ob.data
    n = len(me.vertices)
    c = [1.0 if x else 0.0 for x in covered]
    nb = [[] for _ in range(n)]
    for e in me.edges:
        a, b = e.vertices
        nb[a].append(b)
        nb[b].append(a)
    for _ in range(iters):
        c = [max(c[i], 0.75 * max((c[j] for j in nb[i]), default=0.0)) for i in range(n)]
    return c


def spread_pin(ob, pin, dom, F, iters=4, k=0.6, s_max=0.05):
    """釘在硬殼底下的頂點（pin＝骨名集合）往外沿網格擴散幾圈：回傳每頂點 (骨名集合, 釘住比例) 或 None。
    只釘殼底下那一圈的話，袖孔邊上「釘在胸廓」和「跟著上臂」的頂點只隔一條邊，一抬手那一圈三角形被拉成細長的扇形、
    互相折疊，外框殼從縫裡露出一道道黑色斜線；往孔裡漸變幾圈（每圈 ×k），拉伸分散到孔裡的幾排面上。
    主導骨是手臂的頂點（dom）只擴散到肩關節往下 s_max 以內：擴散到上臂內側（袖口那一圈）時，那一圈皮膚被往胸廓拉，
    抬手時袖口內側和手臂分開、袖口浮在空中。"""
    arm = {b + s for b in ('sh', 'el', 'wr') for s in 'LR'}
    if pin is None:
        return None
    me = ob.data
    n = len(me.vertices)
    w = [1.0 if p else 0.0 for p in pin]
    ps = list(pin)
    nb = [[] for _ in range(n)]
    for e in me.edges:
        a, b = e.vertices
        nb[a].append(b)
        nb[b].append(a)
    for _ in range(iters):
        w2, ps2 = list(w), list(ps)
        for i in range(n):
            if dom[i] in arm and (V((abs(me.vertices[i].co.x), me.vertices[i].co.y, me.vertices[i].co.z)) - F.sh).dot(F.da) > s_max:
                continue
            for j in nb[i]:
                if w[j] * k > w2[i]:
                    w2[i] = w[j] * k
                    ps2[i] = ps[j]
        w, ps = w2, ps2
    return [(ps[i], w[i]) if ps[i] and w[i] > 1e-3 else None for i in range(n)]


def merged_tree(objs):
    bm = bmesh.new()
    for o in objs:
        tmp = bmesh.new()
        tmp.from_mesh(o.data)
        m = bpy.data.meshes.new('tmp')
        tmp.to_mesh(m)
        tmp.free()
        bm.from_mesh(m)
        bpy.data.meshes.remove(m)
    t = BVHTree.FromBMesh(bm) if len(bm.faces) else None
    bm.free()
    return t


HAND_BONES = {n + s for n in ('wr', 'fa', 'fb', 'fc', 'tb') for s in 'LR'} | {'head'}


def axis_point(F, b, p, wrist=False):
    """頂點 p（主導骨 b）往外量距離用的骨軸點；手、手指與頭不處理（回傳 None）。
    wrist：手腕那一段（手骨起點往手掌 0.3 以內）也處理，骨軸取手骨；給 conform 用：手腕的皮膚主導骨已經是手骨，
    原本不收進袖口／手套口，加厚的手腕從卡卡西的袖口、比克的紅腕環下緣穿出一塊塊皮膚。"""
    B = F.b
    if wrist and b[:2] == 'wr' and b in B:
        h, t = B[b]
        d = t - h
        k = (p - h).dot(d) / max(d.length_squared, 1e-12)
        return h + d * max(0.0, k) if k < 0.3 else None
    if b in ('hips', 'torso', 'ribs'):
        return V((0, p.y, F.cz * 0.03))
    if b in B and b[:2] in ('sh', 'el', 'th', 'kn', 'cl', 'an', 'to', 'ne'):
        h, t = B[b]
        d = t - h
        k = max(0.0, min(1.0, (p - h).dot(d) / max(d.length_squared, 1e-12)))
        return h + d * k
    return None


def retarget(garments, F, skin_tree, real_tree, kd, dom, reach=0.025, fade=0.03, lim=0.03, iters=12):
    """衣物跟著換身體：每個衣物頂點沿骨軸往外的射線上，原本的皮膚在 dp、真人皮膚在 dr，就把頂點挪 dr−dp。
    離原本皮膚越遠（寬鬆的部分）挪得越少；沒有原本皮膚的地方（例如整條腿都在褲管裡）不動。
    部件可用 fit_reach 放寬「離皮膚多遠還全量挪」（疊在外套上又跨到背心上的背帶，整條都要跟著底下那層挪），
    fit_lim 放寬最多挪多少（套在手臂上的環帶：底模手臂比 arm_skin 細 2～3 cm，3 cm 的上限讓護腕、臂章浮在手臂外一圈）。
    位移量在每個部件的網格上平滑幾輪（射線打不到的頂點只跟著鄰居），衣緣才不會一格一格參差。"""
    if skin_tree is None:
        return
    # 貼在別的衣物表面上的部件（ride_on＝宿主物件名，例如袖子上的臂章）不自己量，照宿主最近頂點的位移一起挪：
    # 各自量的話，窄窄一圈的臂章和整條袖子平滑出來的位移差好幾公釐，臂章就埋進袖子裡
    names = {o.name for o in garments}
    for o in garments:
        if o.get('hug') is not None:
            hug_fit(o, F, real_tree)
    garments = [o for o in garments if o.get('hug') is None]
    hosts = [o for o in garments if not (o.get('ride_on') in names)]
    riders = [o for o in garments if o.get('ride_on') in names]
    moved = {}
    host_polys = {}
    for o in hosts:
        me = o.data
        n = len(me.vertices)
        D = [V((0, 0, 0))] * n
        hit = [False] * n
        for v in me.vertices:
            g = V(v.co)
            _c, j, _d = kd.find(g)
            a = axis_point(F, dom[j], g)
            if a is None:
                continue
            r = g - a
            dg = r.length
            if dg < 1e-4:
                continue
            r /= dg
            hp = skin_tree.ray_cast(a + r * 0.001, r, dg + 0.06)
            hr = real_tree.ray_cast(a + r * 0.001, r, dg + 0.06)
            if hp[0] is None or hr[0] is None:
                continue
            k = 1.0 - smooth((dg - hp[3] - o.get('fit_reach', reach)) / fade)
            lm = o.get('fit_lim', lim)
            D[v.index] = r * (max(-lm, min(lm, hr[3] - hp[3])) * k)
            hit[v.index] = True
        if not any(hit):
            continue
        nb = [[] for _ in range(n)]
        for e in me.edges:
            a, b = e.vertices
            nb[a].append(b)
            nb[b].append(a)
        for _ in range(iters):
            D2 = list(D)
            for i in range(n):
                if nb[i]:
                    m = sum((D[j] for j in nb[i]), V((0, 0, 0))) / len(nb[i])
                    D2[i] = (D[i] + m) * 0.5 if hit[i] else m * 0.9
            D = D2
        moved[o.name] = [(V(v.co), D[v.index]) for v in me.vertices]
        host_polys[o.name] = [tuple(pl.vertices) for pl in me.polygons]
        for v in me.vertices:
            v.co = V(v.co) + D[v.index]
        me.update()
        if os.environ.get('REAL_DEBUG'):
            mv = [d.length for d in D if d.length > 1e-4]
            print('    %-14s %5d/%5d 頂點  平均 %.1f mm' % (o.name, len(mv), n, 1000 * sum(mv) / max(1, len(mv))))
    for o in riders:
        src = moved.get(o['ride_on'])
        if not src:
            continue
        if o.get('ride_bary'):
            # ride_bary：照宿主表面上最近一點的位移（所在面的頂點位移按重心座標內插）。
            # 宿主是有厚度的殼時，最近頂點會在內外殼之間跳（同一格裡一半抄內殼、一半抄外殼），貼片一格格參差；
            # 最近的「面」一定是朝向貼片的那層外殼，位移連續
            pl = host_polys[o['ride_on']]
            bt = BVHTree.FromPolygons([p for p, _d in src], pl)
            me = o.data
            D = [V((0, 0, 0))] * len(me.vertices)
            for v in me.vertices:
                loc, _n, fi, _dd = bt.find_nearest(v.co)
                if loc is None:
                    continue
                ids = pl[fi]
                w = poly_3d_calc([src[i][0] for i in ids], loc)
                D[v.index] = sum((src[i][1] * wi for i, wi in zip(ids, w)), V((0, 0, 0)))
            # ride_rigid：整個部件照平均位移平移（方扣這種小硬件跨在宿主的兩片衣襟之間時，左右半邊的最近面位移不同，方扣被撕成兩半）
            # ride_smooth＝k：位移在部件網格上平滑 k 輪（長帶子跨過衣襟邊緣時，最近面在外層與切邊之間跳，帶子折出小缺角）
            if o.get('ride_rigid') and D:
                m = sum(D, V((0, 0, 0))) / len(D)
                D = [m] * len(D)
            elif o.get('ride_smooth'):
                nb = [[] for _ in range(len(me.vertices))]
                for e in me.edges:
                    a, b = e.vertices
                    nb[a].append(b)
                    nb[b].append(a)
                for _ in range(int(o['ride_smooth'])):
                    D = [(D[i] + sum((D[j] for j in nb[i]), V((0, 0, 0))) / len(nb[i])) * 0.5 if nb[i] else D[i] for i in range(len(D))]
            for v in me.vertices:
                v.co = V(v.co) + D[v.index]
            me.update()
            if os.environ.get('REAL_DEBUG'):
                print('    %-14s 跟著 %s 的表面挪' % (o.name, o['ride_on']))
            continue
        hk = KDTree(len(src))
        for k, (p, _d) in enumerate(src):
            hk.insert(p, k)
        hk.balance()
        for v in o.data.vertices:
            v.co = V(v.co) + src[hk.find(v.co)[1]][1]
        o.data.update()
        if os.environ.get('REAL_DEBUG'):
            print('    %-14s 跟著 %s 挪' % (o.name, o['ride_on']))


def hug_fit(o, F, real_tree, iters=4):
    """直接套在手臂皮膚上的環帶（護腕、臂章、手套；部件標 hug＝與皮膚的間隙）重新貼到真人手臂上：
    從上臂／前臂骨軸往每個頂點打射線，量真人皮膚的距離 hr 與環帶自己內壁的距離 di，整條射線上的頂點一起挪 hr＋hug−di，
    內壁就落在新皮膚外 hug、厚度不變。
    retarget 的「挪 真人皮膚−原本皮膚」在這種環帶上不可靠：原本的皮膚（arm_skin）以骨軸為中心，底模男性的上臂卻偏在骨軸下方 2 cm
    （Quaternius 的上臂骨貼著手臂上緣），同一圈上真人皮膚的距離從 3 cm 到 9 cm；手腕端的射線還會先打到舊手掌的盒子（量到 1.5 cm）。
    位移再被上限（fit_lim）截掉、和鄰點平均之後，護腕整圈比手腕寬 1.6 倍、臂章一側懸空透出背景。"""
    me = o.data
    n = len(me.vertices)
    bm = bmesh.new()
    bm.from_mesh(me)
    own = BVHTree.FromBMesh(bm)
    bm.free()
    gap = float(o['hug'])
    B = F.b
    D = [V((0, 0, 0))] * n
    hit = [False] * n
    for v in me.vertices:
        g = V(v.co)
        sd = 'L' if g.x >= 0 else 'R'
        best = None
        for b in ('sh' + sd, 'el' + sd):
            h, t = B[b]
            d, k = axis_dist(g, h, t)
            if best is None or d < best[0]:
                best = (d, h + (t - h) * k)
        dg, a = best
        if dg < 1e-4:
            continue
        r = (g - a) / dg
        hr = real_tree.ray_cast(a + r * 0.001, r, dg + 0.1)
        if hr[0] is None:
            continue
        hi = own.ray_cast(a + r * 0.001, r, dg)
        di = min(dg, hi[3] + 0.001) if hi[0] is not None else dg
        D[v.index] = r * (hr[3] + 0.001 + gap - di)
        hit[v.index] = True
    nb = [[] for _ in range(n)]
    for e in me.edges:
        x, y = e.vertices
        nb[x].append(y)
        nb[y].append(x)
    for _ in range(iters):
        D = [(D[i] + sum((D[j] for j in nb[i]), V((0, 0, 0))) / len(nb[i])) * 0.5 if hit[i] and nb[i] else
             (sum((D[j] for j in nb[i]), V((0, 0, 0))) / len(nb[i]) if nb[i] else D[i]) for i in range(n)]
    for v in me.vertices:
        v.co = V(v.co) + D[v.index]
    me.update()
    # 內壁（法線朝骨軸）不描外框：反向殼沿法線往內撐約 1 公分，內壁貼在皮膚外 1.5 mm，殼就插進手臂裡；
    # 環帶兩端的內圈法線又往外斜，殼從皮膚表面一塊塊穿出，護腕上緣、腕環下緣一排黑色鋸齒（悟空、比克）。外壁與兩端外緣照舊描線
    OL = me.attributes.get('ol')
    if OL:
        k_in = 0
        for v in me.vertices:
            g = V(v.co)
            sd = 'L' if g.x >= 0 else 'R'
            best = None
            for b in ('sh' + sd, 'el' + sd):
                h, t = B[b]
                d, k = axis_dist(g, h, t)
                if best is None or d < best[0]:
                    best = (d, h + (t - h) * k)
            if V(v.normal).dot(g - best[1]) < 0:
                OL.data[v.index].value = 0.0
                k_in += 1
        if os.environ.get('REAL_DEBUG'):
            print('    %-14s 內壁 %d 頂點不描外框' % (o.name, k_in))
    # 綁骨群組改成 G_HUG：build_heroes 之後照底下皮膚的底模權重綁（hug_weights）
    G = me.attributes.get('grp')
    if G:
        for v in me.vertices:
            G.data[v.index].value = G_HUG_L if v.co.x >= 0 else G_HUG_R
    if os.environ.get('REAL_DEBUG'):
        mv = [d.length for d in D]
        print('    %-14s 貼到真人手臂（間隙 %.1f mm）：平均挪 %.1f mm、最多 %.1f mm，%d/%d 頂點有命中' % (o.name, gap * 1000, 1000 * sum(mv) / max(1, n), 1000 * max(mv), sum(hit), n))


def float_on(garments, real_tree, clear=0.0012, rings=3, iters=3, lim=0.03):
    """貼在皮膚上的細帶（wrap＝1）貼到真人身體表面外 clear：每個頂點量到真人身體最近表面的有號距離（沿表面法線），
    在帶子網格上取鄰居 rings 圈內的最小值（同一個斷面一起動，帶子不會被壓扁成一片），沿法線挪 clear − 最小距離（±lim 內），
    再平滑 iters 輪，帶子沿長度方向才不會一節一節。"""
    for o in garments:
        me = o.data
        n = len(me.vertices)
        dist = [None] * n
        nrm = [V((0, 0, 1))] * n
        for v in me.vertices:
            hit = real_tree.find_nearest(V(v.co), 0.06)
            if hit[0] is None:
                continue
            dist[v.index] = (V(v.co) - hit[0]).dot(hit[1])
            nrm[v.index] = V(hit[1])
        nb = [[] for _ in range(n)]
        for e in me.edges:
            a, b = e.vertices
            nb[a].append(b)
            nb[b].append(a)
        # 斷面最貼近皮膚的頂點（鄰居 rings 圈內的最小距離）要剛好離皮膚 clear：埋太深就推出來，浮太高（皮膚被整形往內收了）就收回去
        for _ in range(rings):
            dist = [min([x for x in [dist[i]] + [dist[j] for j in nb[i]] if x is not None], default=None) for i in range(n)]
        push = [0.0 if x is None else max(-lim, min(lim, clear - x)) for x in dist]
        for _ in range(iters):
            push = [(push[i] + sum(push[j] for j in nb[i]) / len(nb[i])) / 2 if nb[i] else push[i] for i in range(n)]
        for v in me.vertices:
            v.co = V(v.co) + nrm[v.index] * push[v.index]
        me.update()
        if os.environ.get('REAL_DEBUG'):
            print('    %-14s 貼到皮膚：推出最多 %.1f mm、收回最多 %.1f mm' % (o.name, 1000 * max(push), -1000 * min(push)))


def conform(ob, garments, F, dom, seam, gap=0.003):
    """被衣物蓋住的皮膚收進衣物內壁：從主導骨的骨軸往外射線，先碰到衣物就把頂點拉回碰撞點內側。手與手指不處理。
    回傳每個頂點是否被衣物蓋住、是否緊貼在衣物底下（骨軸射線在頂點外 3 cm 內碰到衣物），
    以及緊貼在哪個「釘住」的衣物底下（pin：衣物部件的 pin_bones，見 weights_for；沒有就是 None）。"""
    covered = [False] * len(ob.data.vertices)
    under = [False] * len(ob.data.vertices)
    pin = [None] * len(ob.data.vertices)
    tree = merged_tree(garments)
    if tree is None:
        return covered, under, pin
    # 每個衣物部件可以指定自己的間隙（conform_gap）：merged_tree 依序把各部件的面接在一起，面號區間對回部件
    fgap, n0 = [], 0
    for o in garments:
        n0 += len(o.data.polygons)
        pb = o.get('pin_bones')
        fgap.append((n0, o.get('conform_gap', gap), frozenset(pb) if pb else None))

    def gap_of(fi):
        for end, g, _p in fgap:
            if fi < end:
                return g
        return gap

    def pin_of(fi):
        for end, _g, pb in fgap:
            if fi < end:
                return pb
        return None
    moved = 0
    for i, v in enumerate(ob.data.vertices):
        if seam[i]:
            continue   # 和頭顱共用的接縫不動
        p = V(v.co)
        # 沿法線往外 8 cm 內碰到衣物：從外面看不到（胯下、腋下這種骨軸射線打不準的地方）
        nh = tree.ray_cast(p + v.normal * 0.001, v.normal, 0.08) if dom[i] not in HAND_BONES else (None,)
        if nh[0] is not None:
            covered[i] = True
            # 緊貼在釘住的硬殼底下（沿法線 3 cm 內）也釘住：腋下、側腰這些主導骨是上臂的皮膚，骨軸射線從袖孔穿出去碰不到殼，
            # 原本不釘、跟著上臂走，手往前抬（出拳的護架）時從胸甲側面穿出藍色碎片與外框黑塊（貝吉塔 atk2）
            if nh[3] < 0.03:
                pin[i] = pin_of(nh[2])
        a = axis_point(F, dom[i], p, wrist=True)
        if a is None:
            continue
        r = p - a
        dist = r.length
        if dist < 1e-4:
            continue
        r /= dist
        hit = tree.ray_cast(a + r * 0.001, r, dist + 0.03)
        if hit[0] is None:
            continue
        covered[i] = True
        under[i] = True
        # 只認骨軸射線碰到的衣物（沿法線碰到的不算：露在袖孔裡的三角肌，法線擦過背帶也會被當成蓋住）
        pin[i] = pin_of(hit[2])
        # 骨軸附近先碰到的若是埋在身體裡的衣物（長袖肩頭的圓頂封口伸進軀幹裡），拉回那裡會把皮膚壓扁到骨頭上，
        # 原本就因為 lim < 0.45·dist 不拉、整個頂點留在外套外面（香吉士肩頭從外套和袖子的接縫冒出藍色襯衫）。
        # 跳過這些太靠近骨軸的交點，改用往外的下一層衣物
        t = hit[3] + 0.001   # 交點離骨軸的距離
        g = gap_of(hit[2])
        while t is not None and t - g <= dist * 0.45:
            o = t + 0.0005
            h2 = tree.ray_cast(a + r * o, r, dist + 0.03 - o)
            t, g = (None, g) if h2[0] is None else (o + h2[3], gap_of(h2[2]))
        if t is None:
            continue
        lim = t - g
        if lim < dist and lim > dist * 0.45:
            v.co = a + r * lim
            moved += 1
    print('  真人身體：%d 頂點收進衣物（%d 頂點釘在硬殼底下）' % (moved, sum(1 for p in pin if p)))
    return covered, under, pin


def hollow_mask(ob, garments, F, dom, covered):
    """長袖裡的手臂（要整段刪掉的頂點）：長袖部件標 hollow＝(s0, s1)（沿上臂方向 F.da、從肩關節量的距離），
    主導骨是上臂或前臂、被衣物蓋住、s 在 s0..s1 之間的頂點。手臂皮膚部件被換掉時，袖子裡的底模手臂靠 drop_covered
    的「離皮膚部件太近就留著」留下來，大幅彎肘時（手肘尖的權重一半肩一半肘，線性混合會把袖子和手臂一起壓扁），
    底模的肘尖從袖子的外層穿出來（特南克斯舉手時袖子上一塊深色的洞）。整段袖子裡看不到手臂，直接刪掉；
    袖口那幾公分（s1 之後）留著，從袖口看進去才不是空的。"""
    rng = [o['hollow'] for o in garments if o.get('hollow')]
    if not rng:
        return None
    s0 = min(r[0] for r in rng)
    s1 = max(r[1] for r in rng)
    out = []
    for i, v in enumerate(ob.data.vertices):
        p = V((abs(v.co.x), v.co.y, v.co.z))
        s = (p - F.sh).dot(F.da)
        out.append(bool(covered[i]) and dom[i][:2] in ('sh', 'el') and s0 <= s <= s1 and (p - F.arm_pt(s)).length < 0.12)
    print('  真人身體：長袖裡的手臂 %d 頂點' % sum(out))
    return out


def drop_covered(ob, skin_tree, covered, weights, dom, seam, far=0.035, hollow=None, under=None, pin=None):
    """完全被衣物蓋住、原本也沒有皮膚部件的地方（褲管裡的腿、靴子裡的腳）整塊刪掉：少面數，也不會在擺動時穿出來。
    hollow：另外要刪的頂點（長袖裡的手臂，見 hollow_mask）。"""
    me = ob.data
    keepv = [True] * len(me.vertices)
    for i, v in enumerate(me.vertices):
        if not covered[i] or seam[i]:
            continue
        if hollow is not None and hollow[i]:
            keepv[i] = False
            continue
        if skin_tree is not None:
            hit = skin_tree.find_nearest(V(v.co), far)
            if hit[0] is not None:
                continue
        keepv[i] = False
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    kill = [f for f in bm.faces if not any(keepv[v.index] for v in f.verts)]
    bmesh.ops.delete(bm, geom=kill, context='FACES_ONLY')
    loose = [v for v in bm.verts if not v.link_faces]
    old = [v.index for v in bm.verts if v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.to_mesh(me)
    bm.free()
    me.update()
    print('  真人身體：刪掉 %d 面（被衣物蓋住）' % len(kill))
    return ([weights[i] for i in old], [dom[i] for i in old], [covered[i] for i in old], [seam[i] for i in old],
            [under[i] for i in old] if under else None, [pin[i] for i in old] if pin else None)


def project(ob, skins, F, kd, dom, center=None, iters=6):
    """從被取代的部件投影顏色：從骨軸往外射線，打到原本部件的哪一塊顏色（pal, mat）就是哪一塊（手、手指沒有骨軸，取最近點）。
    各顏色沿網格邊的中點切開再上色，邊界平滑；ol 取最近的部件。"""
    if not skins:
        return
    vs, fs, keys, ols, under = [], [], [], [], []
    for o in skins:
        me = o.data
        FP, FM = me.attributes['fpal'].data, me.attributes['fmat'].data
        OL = me.attributes['ol'].data
        y0 = o.get('proj_y0', -1e9)   # 例如脖子：埋在軀幹裡的那一段不當顏色來源，否則胸口會被塗成一片皮膚
        for f in me.polygons:
            if f.center.y < y0:
                continue
            fs.append(list(range(len(vs), len(vs) + len(f.vertices))))
            vs.extend(V(me.vertices[k].co) for k in f.vertices)
            keys.append((FP[f.index].value, FM[f.index].value))
            # proj_under：埋在別的部件底下的部件（貝吉塔高領裡的脖子）只在射線沒碰到其他部件時才當顏色來源
            under.append(bool(o.get('proj_under')))
            ols.append(max(OL[k].value for k in f.vertices))
    tree = BVHTree.FromPolygons(vs, fs)
    cache = {}

    def along(a, co, reach=0.08):
        """從骨軸點 a 往頂點 co 的射線：回傳 (離頂點的距離, 面) 最小的那一層；射線上可能先後穿過好幾層被取代的部件
        （脖子的皮膚管埋在緊身衣的斜方肌裡、手臂根部埋在軀幹裡），取離這個頂點最近的一層，不是射線碰到的第一層。"""
        r = co - a
        d = r.length
        if d < 1e-4:
            return None
        r /= d
        best, low, t0 = None, None, 0.001
        for _ in range(8):
            h = tree.ray_cast(a + r * t0, r, d + reach - t0)
            if h[0] is None:
                break
            t = t0 + h[3]
            c = (abs(t - d), h[2])
            if under[h[2]]:
                low = c if low is None or c < low else low
            elif best is None or c < best:
                best = c
            t0 = t + 1e-4
        return best or low

    def label(co):
        key = (round(co.x, 5), round(co.y, 5), round(co.z, 5))
        if key in cache:
            return cache[key]
        _c, j, _d = kd.find(co)
        a = center if center is not None else axis_point(F, dom[j], co)
        reach = 0.08
        if center is None and dom[j][:2] == 'cl':
            # 鎖骨的骨頭貼在胸口表面（骨頭起點就在胸骨上緣的皮膚上）：從那裡往脖子根部的頂點打射線，幾乎是貼著皮膚往上，
            # 不是碰不到東西（退回最近點），就是越過頂點打到上面的脖子皮膚管，高領下緣兩側的緊身衣被塗成一塊塊皮膚。
            # 改從軀幹中軸水平往外打（和軀幹的頂點一樣）；底模的脖子根部比舊的斜方肌細好幾公分，射線放長一點
            a, reach = V((0, co.y, F.cz * 0.03)), 0.12
        c = along(a, co, reach) if a is not None else None
        k = keys[c[1]] if c is not None else None
        if k is None:
            h = tree.find_nearest(co)
            k = keys[h[2]] if h[0] is not None else keys[0]
        cache[key] = k
        return k
    me = ob.data
    n = len(me.vertices)
    lab = [label(V(v.co)) for v in me.vertices]
    order = sorted(set(lab), key=lambda k: -lab.count(k))
    if os.environ.get('REAL_DEBUG'):
        print('  投影顏色：', {k: lab.count(k) for k in order})
    # 每種顏色的指示值在網格上平滑幾輪：去掉零星的斑點，交界變成平滑的等值線
    nb = [[] for _ in range(n)]
    for e in me.edges:
        a, b = e.vertices
        nb[a].append(b)
        nb[b].append(a)
    # 小於 60 頂點的色塊島併進周圍的顏色
    seen = [False] * n
    for s0 in range(n):
        if seen[s0]:
            continue
        comp, stack = [], [s0]
        seen[s0] = True
        while stack:
            i = stack.pop()
            comp.append(i)
            for j in nb[i]:
                if not seen[j] and lab[j] == lab[s0]:
                    seen[j] = True
                    stack.append(j)
        if len(comp) < 60:
            cs = set(comp)
            border = [lab[j] for i in comp for j in nb[i] if j not in cs]
            if border:
                m = max(set(border), key=border.count)
                for i in comp:
                    lab[i] = m
    ind = {k: [1.0 if x == k else 0.0 for x in lab] for k in order}
    for k in order:
        x = ind[k]
        for _ in range(iters):
            x = [(x[i] + sum(x[j] for j in nb[i]) / len(nb[i])) * 0.5 if nb[i] else x[i] for i in range(n)]
        ind[k] = x
    # 指示值在面內照重心座標內插（切線前的網格；切線新增的頂點都落在它的邊或面上）。
    # 原本取最近 3 個頂點的反距離加權：沿一條邊不是單調的（第三個點常常是邊外的頂點），iso_cut 的試位法找到的零點和
    # 切開後小面的中心判斷不一致，交界上留下一排細長的三角形尖刺（悟空內衣領口、脖子與藍色內衣的交界）。
    # 線性內插時等值線在每個三角形裡是直線，切點與面的歸屬一致
    sco, spolys = [V(v.co) for v in me.vertices], [tuple(p.vertices) for p in me.polygons]
    stree = BVHTree.FromPolygons(sco, spolys)
    bary = {}

    def mix(co):
        key = (round(co.x, 6), round(co.y, 6), round(co.z, 6))
        if key not in bary:
            hit = stree.find_nearest(co)
            poly = spolys[hit[2]]
            ws = poly_3d_calc([sco[i] for i in poly], hit[0])
            tot = sum(ws) or 1.0
            bary[key] = [(i, w / tot) for i, w in zip(poly, ws)]
        return bary[key]

    def val(k, co):
        x = ind[k]
        return sum(x[i] * w for i, w in mix(co))
    kit.tag(ob, order[0][0], mat=order[0][1], grp=G_REAL, ol=1.0)
    for k in order[1:]:
        others = [m for m in order if m != k]
        kit.paint_field(ob, lambda co, k=k, others=others: max(val(m, co) for m in others) - val(k, co), k[0], k[1])
    OL = me.attributes['ol'].data
    for v in me.vertices:
        h = tree.find_nearest(V(v.co))
        if h[0] is not None:
            OL[v.index].value = ols[h[2]]


def src_mix(lookup, co):
    """真人身體上一點對應到切線前網格的哪些頂點：[(舊頂點號, 比例)]。
    原本就有的頂點（含 crisp_split 切開的重複頂點）直接對到自己；上色切線插進來的新頂點落在某個舊面上，照面內的重心座標內插。"""
    kd, src = lookup[0], lookup[4] if len(lookup) > 4 else None
    _c, j, d = kd.find(co)
    if src is None or d < 1e-6:
        return [(j, 1.0)]
    tree, sco, spolys = src
    hit = tree.find_nearest(co)
    if hit[0] is None or hit[3] > 0.002:
        return [(j, 1.0)]
    poly = spolys[hit[2]]
    ws = poly_3d_calc([sco[k] for k in poly], hit[0])
    out = [(k, w) for k, w in zip(poly, ws) if w > 1e-6]
    tot = sum(w for _k, w in out)
    return [(k, w / tot) for k, w in out] if tot > 0 else [(j, 1.0)]


def weights_for(body, real_lookup, bone_names, W):
    """build_heroes 算出的權重表 W（骨熱，和衣物同一套）中，屬於真人身體（grp＝G_REAL）的頂點：
    露在外面的地方換成底模權重；被衣物蓋住的地方保留骨熱權重（和衣物一起動，扭身時才不會從衣服穿出來），交界漸變。
    骨熱裡的擺動鏈（垂帶、尾巴等）不給身體。
    緊貼在「釘住」的硬殼（衣物部件標 pin_bones，例如貝吉塔的胸甲與背帶）底下的頂點，骨熱只留 pin_bones 裡的骨頭（重新正規化）：
    硬殼本身的綁骨群組只允許胸廓與軀幹，底下的皮膚卻分到骨熱裡的鎖骨與上臂（A 字站姿下袖孔附近的代理體黏著手臂），
    一抬手胸口的皮膚跟著上臂往前上方走、整片從胸甲裡穿出藍色。釘住之後殼和底下的皮膚權重一致，只有袖孔裡露出的部分跟著手臂拉開。"""
    kd, weights, cov, seam = real_lookup[:4]
    pin = real_lookup[5] if len(real_lookup) > 5 else None
    bidx = {n: i for i, n in enumerate(bone_names)}
    main = {i for n, i in bidx.items() if not n[-1].isdigit()}
    G = body.data.attributes['grp'].data
    n = 0
    for i, v in enumerate(body.data.vertices):
        if G[i].value != G_REAL:
            continue
        mix = src_mix(real_lookup, v.co)
        if all(seam[j] for j, _t in mix) and 'head' in bidx:
            W[i] = [(bidx['head'], 1.0)]
            n += 1
            continue
        c = sum(cov[j] * t for j, t in mix)
        acc = {}
        for j, t in mix:
            for b, w in weights[j].items():
                if b in bidx:
                    acc[bidx[b]] = acc.get(bidx[b], 0.0) + w * t * (1 - c)
        heat = [(b, w) for b, w in W[i] if b in main]
        ht = sum(w for _, w in heat)
        if ht > 0:
            for b, w in heat:
                acc[b] = acc.get(b, 0.0) + w / ht * c
        # 釘住的比例（照切線前網格的重心座標內插）與骨頭：混合後的權重只留那些骨頭，再按比例和原本的權重漸變
        pt, pset = 0.0, set()
        if pin is not None:
            for j, t in mix:
                if pin[j]:
                    pt += t * pin[j][1]
                    pset |= {bidx[b] for b in pin[j][0] if b in bidx}
        if pt > 1e-3:
            tot = sum(acc.values()) or 1.0
            ph = {b: w for b, w in acc.items() if b in pset}
            pw = sum(ph.values())
            if pw < 1e-4 * tot:
                ph, pw = {bidx['ribs']: 1.0}, 1.0
            acc = {b: w / tot * (1 - pt) for b, w in acc.items()}
            for b, w in ph.items():
                acc[b] = acc.get(b, 0.0) + w / pw * pt
        ws = sorted(acc.items(), key=lambda bw: -bw[1])[:4]
        tot = sum(w for _, w in ws) or 1.0
        W[i] = [(b, w / tot) for b, w in ws]
        n += 1
        if os.environ.get('REAL_PROBE'):
            px = [float(x) for x in os.environ['REAL_PROBE'].split(',')]
            if (V(v.co) - V(px[:3])).length < px[3]:
                inv = {b: nm for nm, b in bidx.items()}
                print('    探針 (%.3f,%.3f,%.3f) 蓋住 %.2f：%s' % (v.co.x, v.co.y, v.co.z, c, ' '.join('%s:%.2f' % (inv[b], w) for b, w in W[i])))
    return n


def ride_weights(body, W, iters=80):
    """疊在真人身體上的殼（grp＝G_RIDE_REAL）：權重照底下真人皮膚（weights_for 之後的最終權重）最近的三角形，用重心座標內插，
    再在殼自己的網格上平滑 iters 輪：殼是硬的，權重要比底下的皮膚平順得多（只平滑幾輪時，跑步抬腿那一側的腹甲跟著胯下的皺摺折成一段段，
    橫紋斷成鋸齒）；相鄰頂點的最近三角形落在不同肌肉上時權重也不會一格一格跳。
    殼本身用骨熱（只允許胸廓與軀幹）時是剛體，底下的皮膚在袖孔、胯前卻漸漸交給上臂與大腿（spread_pin、底模權重）：
    出拳時上臂根部的皮膚往前移、從胸甲的袖孔前緣穿出藍色碎片和外框黑縫；弓步、跑步時大腿根部往前頂穿腹甲。
    權重抄皮膚之後，殼和底下的皮膚一起動，間隙（胸甲 1.6 cm、腹甲 1～3.6 cm）始終保持。"""
    from mathutils.geometry import barycentric_transform
    me = body.data
    G = me.attributes['grp'].data
    vs = me.vertices
    rid = [i for i in range(len(vs)) if G[i].value == G_RIDE_REAL]
    if not rid:
        return 0
    me.calc_loop_triangles()
    tris = [t.vertices[:] for t in me.loop_triangles if all(G[k].value == G_REAL for k in t.vertices)]
    tree = BVHTree.FromPolygons([V(v.co) for v in vs], tris)
    acc_all = {}
    for i in rid:
        co = V(vs[i].co)
        hit = tree.find_nearest(co)
        if hit[0] is None:
            continue
        a, b, c = tris[hit[2]]
        bc = barycentric_transform(hit[0], V(vs[a].co), V(vs[b].co), V(vs[c].co), V((1, 0, 0)), V((0, 1, 0)), V((0, 0, 1)))
        acc = {}
        for k, t in zip((a, b, c), bc):
            for bn, w in W[k]:
                acc[bn] = acc.get(bn, 0.0) + w * max(0.0, t)
        acc_all[i] = acc
    # 殼在 crisp_split 時沿色界（橫紋邊）切開，同一位置有兩個頂點、網格斷成一條條：只沿邊平滑時每條橫紋各自平滑，
    # 色界兩側權重不同，一擺動橫紋就沿邊錯開成鋸齒、整片像揉皺。同一位置的頂點併成一個節點一起平滑
    rep, key_of = {}, {}
    for i in rid:
        k = tuple(round(c * 1e5) for c in vs[i].co)
        rep[i] = key_of.setdefault(k, i)
    acc_all = {i: acc for i, acc in acc_all.items() if rep[i] == i} | {rep[i]: acc for i, acc in acc_all.items() if rep[i] not in acc_all}
    nb = {i: set() for i in rid if rep[i] == i}
    for e in me.edges:
        x, y = e.vertices
        if x in rep and y in rep and rep[x] != rep[y]:
            nb[rep[x]].add(rep[y])
            nb[rep[y]].add(rep[x])
    for _ in range(iters):
        nxt = {}
        for i, acc in acc_all.items():
            m = dict(acc)
            ns = [acc_all[j] for j in nb[i] if j in acc_all]
            for d in ns:
                for bn, w in d.items():
                    m[bn] = m.get(bn, 0.0) + w / len(ns)
            nxt[i] = m
        acc_all = nxt
    n = 0
    for i in rid:
        acc = acc_all.get(rep[i])
        if acc is None:
            continue
        ws = sorted(acc.items(), key=lambda bw: -bw[1])[:4]
        tot = sum(w for _, w in ws) or 1.0
        W[i] = [(bn, w / tot) for bn, w in ws]
        n += 1
    return n


def hug_weights(body, W):
    """hug 環帶（grp＝G_HUG_L／R）的權重抄最近的真人皮膚頂點（weights_for 之後的最終權重）：和兩側外露的手臂皮膚同一套權重，擺動時整圈貼著手臂走。
    骨熱（在 A 字站姿的聯集代理體上算）會把上臂中段的臂章分一部分給胸廓與鎖骨，底模的上臂卻幾乎全給上臂骨，兩者一擺就錯開；
    皮膚離衣物幾圈內又是底模與骨熱的混合（weights_for 的 cov），所以要抄混合完的結果，不能只抄底模權重。"""
    G = body.data.attributes['grp'].data
    vs = body.data.vertices
    real = [i for i in range(len(vs)) if G[i].value == G_REAL]
    kd = KDTree(len(real))
    for i in real:
        kd.insert(vs[i].co, i)
    kd.balance()
    n = 0
    for i, v in enumerate(vs):
        if G[i].value in (G_HUG_L, G_HUG_R):
            W[i] = list(W[kd.find(v.co)[1]])
            n += 1
    return n
