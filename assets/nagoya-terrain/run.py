"""One command: prepare geodata, create Blender scene, annotate render, package."""
import argparse, json, pathlib, subprocess, sys, zipfile
from PIL import Image, ImageDraw, ImageFont
ROOT=pathlib.Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--blender',default='blender');p.add_argument('--skip-prepare',action='store_true');p.add_argument('--font');a,rest=p.parse_known_args()
if not a.skip_prepare: subprocess.run([sys.executable,str(ROOT/'prepare.py'),*rest],check=True)
if '--out' in rest: ROOT=pathlib.Path(rest[rest.index('--out')+1]).resolve()
subprocess.run([a.blender,'--background','--python',str(pathlib.Path(__file__).with_name('blender_build.py')),'--',str(ROOT)],check=True)
d=json.loads((ROOT/'scene.json').read_text())
fontpath=a.font
if not fontpath:
    candidates=list(pathlib.Path('/System/Library/Fonts').glob('*Sans GB*'))+[pathlib.Path('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'),pathlib.Path('C:/Windows/Fonts/msjh.ttc')]
    fontpath=next((str(v) for v in candidates if v.exists()),None)
if not fontpath:raise RuntimeError('Supply --font with a CJK TTF/OTF/TTC font for required map labels')
im=Image.new('RGB',(1600,1360),'#eaece3');raw=Image.open(ROOT/'render-raw.png');im.paste(raw,(0,60),raw)
draw=ImageDraw.Draw(im)
def label(x,y,text,size=22,color='#243c32'):draw.text((x,y),text,font=ImageFont.truetype(fontpath,size),fill=color)
label(55,30,('名古屋城 / ' if d['place']=='愛知県体育館' else '地景切片 / ')+d['place'],38)
label(55,90,f"中心 {d['lat']:.7f} N, {d['lon']:.7f} E · 半徑 {d['radius']:g} m · 高度倍率 1×")
label(55,1208,f"EPSG:{d['epsg']} · 1 unit = 1 m · PLATEAU LOD1 · GSI DEM5A / DEM10B",20)
label(55,1243,'出典：国土地理院 DEM・空中写真（地理院タイル / 国土地理院コンテンツ利用規約）',19)
label(55,1276,'出典：国土交通省 '+d.get('datasetTitle','PLATEAU 名古屋市 2022')+'（CC BY 4.0）・加工して作成',17)
label(55,1308,'底座厚度為展示用途；非地質剖面。照片與建物資料年代可能不同。',18)
im.save(ROOT/'render.jpg',quality=94)
with zipfile.ZipFile(ROOT/'reproduce.zip','w',zipfile.ZIP_DEFLATED) as z:
    for name in ['prepare.py','blender_build.py','run.py','requirements.txt','README.md','sources.json']:
        src=ROOT/name
        if not src.exists():src=pathlib.Path(__file__).with_name(name)
        if src.exists():z.write(src,name)
print('Annotated render and repeatable workflow ready')
