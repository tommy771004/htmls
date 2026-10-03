"""下載 Quaternius（https://quaternius.com，全部 CC0）的人物與動物素材包到 .cache/，給 build-characters.py、build-animals.py 用。

    python3 tools/fetch-quaternius.py          （已有就略過）
    python3 tools/fetch-quaternius.py --force

走的是 itch.io 頁面上「No thanks, just take me to the downloads」那條官方免費下載流程：
先向 /download_url 要一個下載頁，再對每個檔案 POST /file/<upload_id> 換到有時效的下載網址。
素材包合計約 440 MB，只放在 .cache/（已列入 .gitignore），不進 repo。

動物用的是另一包 Ultimate Animated Animals，只放在作者的 Google Drive（ANIMALS_DRIVE），
Drive 常回「Quota exceeded」；遇到時可以在瀏覽器打開資料夾，把 glTF 檔下載到 .cache/animals/。
"""
import json
import os
import re
import subprocess
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, '.cache')

# itch.io 的 slug → (解壓後的資料夾, 要下載的檔名關鍵字)
PACKS = {
    'universal-base-characters': ('ubc', 'Standard'),  # 底模（只用頭）、髮型、眉毛
    'modular-character-outfits-fantasy': ('mco', 'Standard'),  # 農民、遊俠的服裝
    'universal-animation-library': ('ual', 'Standard'),  # 120+ 個動畫，跟上面兩包同一副骨架
    'lowpoly-animated-animals': ('farm', 'Farm Animals'),  # 2018 年的農場動物（馬）
}
ANIMALS_DRIVE = '1uJ3N5HfB7jKTseJUNQr3N4YaN0UuEtHk'  # Ultimate Animated Animals（glTF 子資料夾 1yJXdB1iSrI8Db7hG77zxZ66vKsqIt0ry）
# glTF 子資料夾裡各檔的 ID（https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t）
ANIMAL_FILES = {
    'Deer.gltf': '1iGpXKrqYGyZCPGHPPSuDAoKnOXLhXJ0q',
    'Stag.gltf': '1URNoFeIFblJXPFOV6qwPrxZr5dLZ3YGx',
    'Fox.gltf': '1z-CWoUC2vJxrqgGFTYlMaywpE1ooV-bA',
    'Wolf.gltf': '1lFQoQ9ln2Z2wGuFFWObj9i5jHqUl_ftG',
    'Horse.gltf': '1hbtY8kxnXiPdwYGVY7rWRgU0jl_-Q-LG',
}


def fetch(game, out, want):
    base = f'https://quaternius.itch.io/{game}'
    jar = os.path.join(CACHE, '.itch-cookies')

    def curl(*args):
        return subprocess.run(['curl', '-sSL', '-A', 'Mozilla/5.0', '-c', jar, '-b', jar, *args], capture_output=True, text=True, check=True).stdout

    csrf = re.search(r'name="csrf_token" value="([^"]+)"', curl(base)).group(1)
    page = curl(json.loads(curl('-X', 'POST', '-d', f'csrf_token={csrf}', f'{base}/download_url'))['url'])
    csrf = re.search(r'name="csrf_token" value="([^"]+)"', page).group(1)
    for uid, name in re.findall(r'data-upload_id="(\d+)".*?title="([^"]+)" class="name"', page, re.S):
        if want not in name:
            continue
        url = json.loads(curl('-X', 'POST', '-d', f'csrf_token={csrf}', f'{base}/file/{uid}'))['url']
        zpath = os.path.join(CACHE, name)
        subprocess.run(['curl', '-sSL', '--fail', '-o', zpath, url], check=True)
        with zipfile.ZipFile(zpath) as z:
            z.extractall(out)
        print(f'ok    {game}  {os.path.getsize(zpath) / 1e6:.0f} MB')
        return
    raise RuntimeError(f'找不到檔名含「{want}」的檔案')


def main():
    force = '--force' in sys.argv
    os.makedirs(CACHE, exist_ok=True)
    for game, (folder, want) in PACKS.items():
        out = os.path.join(CACHE, folder)
        if os.path.isdir(out) and os.listdir(out) and not force:
            print(f'skip  {game}')
            continue
        fetch(game, out, want)
    fetch_animals(force)


def fetch_animals(force):
    """Drive 常回 Quota exceeded（拿到一頁 HTML）；失敗就留下提示，不中斷其他步驟"""
    out = os.path.join(CACHE, 'animals')
    os.makedirs(out, exist_ok=True)
    for name, fid in ANIMAL_FILES.items():
        path = os.path.join(out, name)
        if os.path.exists(path) and not force:
            print(f'skip  animals/{name}')
            continue
        url = f'https://drive.usercontent.google.com/download?id={fid}&export=download&confirm=t'
        data = subprocess.run(['curl', '-sSL', '-A', 'Mozilla/5.0', url], capture_output=True, check=True).stdout
        if data[:1] != b'{':
            print(f'FAIL  animals/{name}：Google Drive 拒絕（多半是 Quota exceeded），請用瀏覽器下載到 {out}')
            continue
        with open(path, 'wb') as fh:
            fh.write(data)
        print(f'ok    animals/{name}')


if __name__ == '__main__':
    main()
