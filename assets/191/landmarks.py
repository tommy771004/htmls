# 191 靜白之家：由 scene_params.json 算出的 3D 地標（投影比對用）
# 純 Python，不依賴 Blender：build_scene.py 與 solve_cameras.py 都匯入這支，兩邊的尺寸永遠同一份。
# 座標：x 向東、y 向北、z 向上（公尺），和 Blender 世界座標相同。
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))


def load_params(path=None):
    with open(path or os.path.join(HERE, 'scene_params.json'), encoding='utf-8') as f:
        return json.load(f)


def landmarks(P):
    """回傳 {名稱: (物件 id, (x, y, z))}；物件 id 用來把誤差歸到哪一件重建結果"""
    R, D, K, I, T = P['room'], P['entry_door'], P['kitchen'], P['island'], P['table']
    W, V, S, C, PA = P['tv_wall'], P['window'], P['sofa'], P['corridor'], P['partition']
    w, d, h = R['w'], R['d'], R['h']
    L = {}

    def add(name, obj, x, y, z):
        L[name] = (obj, (float(x), float(y), float(z)))

    # 房間角（牆與地板、天花的交線）
    add('corner_nw_floor', 'shell', 0, d, 0)
    add('corner_ne_floor', 'shell', w, d, 0)
    add('corner_nw_ceil', 'shell', 0, d, P['ceiling']['living_soffit'])
    add('corner_ne_ceil', 'shell', w, d, P['ceiling']['living_soffit'])
    # 電視
    y0, y1 = W['tv_yc'] - W['tv_w'] / 2, W['tv_yc'] + W['tv_w'] / 2
    z0, z1 = W['tv_zc'] - W['tv_h'] / 2, W['tv_zc'] + W['tv_h'] / 2
    for nm, yy, zz in (('tv_sw_bot', y0, z0), ('tv_sw_top', y0, z1), ('tv_nw_bot', y1, z0), ('tv_nw_top', y1, z1)):
        add(nm.replace('_sw', '_s').replace('_nw', '_n'), 'tv', 0.05, yy, zz)
    # 懸空洞石平台（前緣上下角）
    add('plat_s_top', 'tv_platform', W['plat_d'], W['plat_y0'], W['plat_z1'])
    add('plat_n_top', 'tv_platform', W['plat_d'], W['plat_y1'], W['plat_z1'])
    add('plat_s_bot', 'tv_platform', W['plat_d'], W['plat_y0'], W['plat_z0'])
    add('plat_n_bot', 'tv_platform', W['plat_d'], W['plat_y1'], W['plat_z0'])
    # 層板壁龕
    add('niche_s_bot', 'niche', 0, W['niche_y0'], W['niche_z0'])
    add('niche_n_bot', 'niche', 0, W['niche_y1'], W['niche_z0'])
    add('niche_s_top', 'niche', 0, W['niche_y0'], W['niche_z1'])
    add('niche_n_top', 'niche', 0, W['niche_y1'], W['niche_z1'])
    # 窗（百葉外框）
    add('win_w_bot', 'window', V['x0'], d, V['z0'])
    add('win_e_bot', 'window', V['x1'], d, V['z0'])
    add('win_w_top', 'window', V['x0'], d, V['z1'])
    add('win_e_top', 'window', V['x1'], d, V['z1'])
    # 沙發（西側前緣：座面高與靠背頂）
    add('sofa_s_seat', 'sofa', S['x0'], S['y0'], S['seat'])
    add('sofa_n_seat', 'sofa', S['x0'], S['y1'], S['seat'])
    add('sofa_s_back', 'sofa', S['x0'] + 0.72, S['y0'], S['back'])
    add('sofa_n_back', 'sofa', S['x0'] + 0.72, S['y1'], S['back'])
    # 入口門
    dy = D.get('y', 0.0)
    add('door_w_bot', 'entry_door', D['x0'], dy, 0)
    add('door_e_bot', 'entry_door', D['x1'], dy, 0)
    add('door_w_top', 'entry_door', D['x0'], dy, D['h'])
    add('door_e_top', 'entry_door', D['x1'], dy, D['h'])
    # 廚房高櫃與吊櫃
    add('counter_w_top', 'kitchen', K['x0'], K['d'], K['h'])
    add('counter_tall_top', 'kitchen', K['tall_x0'], K['d'], K['h'])
    add('upper_w_bot', 'kitchen', K['upper_x0'], 0.36, K['upper_z0'])
    add('upper_e_bot', 'kitchen', K['upper_x1'], 0.36, K['upper_z0'])
    add('upper_w_top', 'kitchen', K['upper_x0'], 0.36, K['upper_z1'])
    add('upper_e_top', 'kitchen', K['upper_x1'], 0.36, K['upper_z1'])
    add('tall_w_top', 'kitchen', K['tall_x0'], K['d'], 2.3)
    # 中島與餐桌
    add('island_nw_top', 'island', I['x0'], I['y1'], I['h'])
    add('island_ne_top', 'island', I['x1'], I['y1'], I['h'])
    add('island_sw_top', 'island', I['x0'], I['y0'], I['h'])
    add('island_se_top', 'island', I['x1'], I['y0'], I['h'])
    add('island_ne_bot', 'island', I['x1'], I['y1'], 0)
    add('table_w_tip', 'table', T['x0'], (T['y0'] + T['y1']) / 2, T['h'])
    add('table_n_mid', 'table', (T['x0'] + T['x1']) / 2, T['y1'], T['h'])
    add('table_s_mid', 'table', (T['x0'] + T['x1']) / 2, T['y0'], T['h'])
    for i, pd in enumerate(P['pendants']):
        add('pendant%d_bot' % i, 'pendant%d' % i, pd['x'], pd['y'], pd['z'])
    # 隔屏
    add('part_e_top', 'partition', PA['x1'], PA['y'] + PA['t'], PA['h'])
    add('part_e_bot', 'partition', PA['x1'], PA['y'] + PA['t'], 0)
    # 走廊口
    add('corr_s_bot', 'corridor', w, C['y0'], 0)
    add('corr_n_bot', 'corridor', w, C['y1'], 0)
    add('corr_s_top', 'corridor', w, C['y0'], C['h'])
    add('corr_n_top', 'corridor', w, C['y1'], C['h'])
    add('corr_end_s_bot', 'corridor', C['x1'], C['y0'], 0)
    add('corr_end_n_bot', 'corridor', C['x1'], C['y1'], 0)
    return L


if __name__ == '__main__':
    for k, v in landmarks(load_params()).items():
        print(k, v)
