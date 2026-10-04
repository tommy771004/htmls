# 角色語音：用 VOICEVOX（離線語音合成）念出喊招、打擊與台詞，處理成喊叫的語氣後編成 MP3，內嵌到 src/voices.js。
# 需要：voicevox_core（Python wheel）、onnxruntime 與模型（VOICEVOX 的 download 工具取得）、numpy、lameenc。
#   VV_CORE=/path/to/voicevox_core  python tools/voices/build_voices.py [--only goku] [--wav dist/voices]
# 產物 src/voices.js 有 commit，build 不需要 VOICEVOX。使用的角色要在 README 與頁面標示「VOICEVOX:角色名」。
import base64
import io
import json
import os
import re
import sys
import wave

import lameenc
import numpy as np
from voicevox_core.blocking import Onnxruntime, OpenJtalk, Synthesizer, VoiceModelFile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'src', 'voices.js')
CORE = os.environ.get('VV_CORE', '')

# 角色 → 配音（VOICEVOX 角色與風格）。shout＝喊叫用、talk＝台詞用；pitch／speed／into 是 AudioQuery 的調整
CAST = {
    'goku': {'credit': '白上虎太郎', 'shout': ('白上虎太郎', 'おこ'), 'talk': ('白上虎太郎', 'ふつう'), 'pitch': 0.02, 'speed': 1.08},
    'vegeta': {'credit': '玄野武宏', 'shout': ('玄野武宏', 'ツンギレ'), 'talk': ('玄野武宏', 'ツンギレ'), 'pitch': -0.02, 'speed': 1.05},
    'trunks': {'credit': '剣崎雌雄', 'shout': ('剣崎雌雄', 'ノーマル'), 'talk': ('剣崎雌雄', 'ノーマル'), 'pitch': 0.0, 'speed': 1.08},
    'piccolo': {'credit': '青山龍星', 'shout': ('青山龍星', '熱血'), 'talk': ('青山龍星', '不機嫌'), 'pitch': -0.03, 'speed': 1.0},
    'frieza': {'credit': '†聖騎士 紅桜†', 'shout': ('†聖騎士 紅桜†', 'ノーマル'), 'talk': ('†聖騎士 紅桜†', 'ノーマル'), 'pitch': 0.06, 'speed': 1.0},
    'a18': {'credit': '九州そら', 'shout': ('九州そら', 'ツンツン'), 'talk': ('九州そら', 'ツンツン'), 'pitch': -0.02, 'speed': 1.05},
    'naruto': {'credit': '満別花丸', 'shout': ('満別花丸', '元気'), 'talk': ('満別花丸', 'ボーイ'), 'pitch': -0.02, 'speed': 1.08},
    'sasuke': {'credit': '黒沢冴白', 'shout': ('黒沢冴白', 'ノーマル'), 'talk': ('黒沢冴白', 'ノーマル'), 'pitch': 0.0, 'speed': 1.05},
    'kakashi': {'credit': '離途', 'shout': ('離途', 'シリアス'), 'talk': ('離途', 'ノーマル'), 'pitch': -0.01, 'speed': 1.0},
    'sakura': {'credit': '四国めたん', 'shout': ('四国めたん', 'ツンツン'), 'talk': ('四国めたん', 'ノーマル'), 'pitch': 0.02, 'speed': 1.05},
    'luffy': {'credit': '猫使アル', 'shout': ('猫使アル', 'つよつよ'), 'talk': ('猫使アル', 'うきうき'), 'pitch': 0.0, 'speed': 1.08},
    'zoro': {'credit': '雀松朱司', 'shout': ('雀松朱司', 'ノーマル'), 'talk': ('雀松朱司', 'ノーマル'), 'pitch': -0.04, 'speed': 1.0},
    'sanji': {'credit': '麒ヶ島宗麟', 'shout': ('麒ヶ島宗麟', 'ノーマル'), 'talk': ('麒ヶ島宗麟', 'ノーマル'), 'pitch': 0.0, 'speed': 1.05},
    'nami': {'credit': '春日部つむぎ', 'shout': ('春日部つむぎ', 'ノーマル'), 'talk': ('春日部つむぎ', 'ノーマル'), 'pitch': 0.02, 'speed': 1.05},
}
# 台詞：line → [文字…]（多句時隨機挑一句）。atk、hurt、Q、W、E、R、spark、die 用喊叫風格，win、ready 用台詞風格
LINES = {
    'goku': {
        'atk': ['はっ！', 'だっ！', 'せいっ！', 'でやっ！'],
        'hurt': ['ぐっ！', 'うあっ！'],
        'Q': ['かめはめ、はっ！'],
        'W': ['りゅうせんけんっ！'],
        'E': ['しゅんかんいどう！'],
        'R': ['かーめーはーめー、はーっ！'],
        'spark': ['はあああああっ！'],
        'die': ['うわあああっ！'],
        'win': ['へへっ、おめえ、つええな！'],
        'ready': ['オッス！いくぞ！'],
    },
    'vegeta': {
        'atk': ['ふんっ！', 'はっ！', 'でやあっ！'],
        'hurt': ['ぐあっ！', 'ちいっ！'],
        'Q': ['くたばれっ！'],
        'W': ['でりゃあっ！'],
        'E': ['おそいっ！'],
        'R': ['ファイナル、フラーッシュ！'],
        'spark': ['はあああああっ！'],
        'die': ['ば、ばかなっ！'],
        'win': ['ふん、とうぜんのけっかだ。'],
        'ready': ['サイヤじんのおうじのちから、みせてやる！'],
    },
    'trunks': {
        'atk': ['はっ！', 'やあっ！', 'せいっ！'],
        'hurt': ['くっ！', 'ぐっ！'],
        'Q': ['ませんこう！'],
        'W': ['せんこうざん！'],
        'E': ['とうっ！'],
        'R': ['ヒートドーム、アタック！'],
        'spark': ['はあああああっ！'],
        'die': ['うわあっ！'],
        'win': ['やった！'],
        'ready': ['みらいのために、いくぞ！'],
    },
    'piccolo': {
        'atk': ['ふんっ！', 'はっ！', 'でやっ！'],
        'hurt': ['ぐっ！', 'ちっ！'],
        'Q': ['まくうほういだん！'],
        'W': ['にがさんっ！'],
        'E': ['ふん、きかんな。'],
        'R': ['まかんこうさっぽう！'],
        'spark': ['はああああっ！'],
        'die': ['ぐはっ！'],
        'win': ['ふん、たわいもない。'],
        'ready': ['いくぞ。'],
    },
    'frieza': {
        'atk': ['ほらっ！', 'ふっ！', 'それっ！'],
        'hurt': ['ぐうっ！', 'おのれっ！'],
        'Q': ['しになさい！'],
        'W': ['デスソーサー！'],
        'E': ['どこをみているんです？'],
        'R': ['デスボール！'],
        'spark': ['ホーッホッホッホッ！'],
        'die': ['そ、そんなばかなっ！'],
        'win': ['ホッホッホ、とうぜんのけっかですよ。'],
        'ready': ['さあ、はじめましょうか。'],
    },
    'a18': {
        'atk': ['はっ！', 'やっ！', 'えいっ！'],
        'hurt': ['くっ！', 'きゃっ！'],
        'Q': ['きえんざん！'],
        'W': ['つかまえた！'],
        'E': ['バリア！'],
        'R': ['まとめてきえな！'],
        'spark': ['はあああっ！'],
        'die': ['うそっ！'],
        'win': ['つまらないわね。'],
        'ready': ['さっさとかたづけるわよ。'],
    },
    'naruto': {
        'atk': ['おらっ！', 'うりゃ！', 'だってばよ！'], 'hurt': ['いってぇ！', 'ぐっ！'],
        'Q': ['らせんがん！'], 'W': ['かげぶんしんのじゅつ！'], 'E': ['かわりみ！'], 'R': ['ふうとん、らせんしゅりけん！'],
        'spark': ['いくってばよぉぉ！'], 'die': ['ちくしょう……！'], 'win': ['へへっ、おれのかちだってばよ！'], 'ready': ['うずまきナルト、さんじょう！'],
    },
    'sasuke': {
        'atk': ['ふっ。', 'はっ！', 'おそい。'], 'hurt': ['ちっ！', 'くっ！'],
        'Q': ['ごうかきゅうのじゅつ！'], 'W': ['ちどり！'], 'E': ['みえている。'], 'R': ['きりん！'],
        'spark': ['はああっ！'], 'die': ['……ここまで、か。'], 'win': ['つまらん。'], 'ready': ['じゃまをするな。'],
    },
    'kakashi': {
        'atk': ['ふっ！', 'はっ！'], 'hurt': ['くっ！', 'ぐっ！'],
        'Q': ['すいとん、すいりゅうだん！'], 'W': ['どとん、ついがのじゅつ！'], 'E': ['らいきり！'], 'R': ['かむい！'],
        'spark': ['いくぞ。'], 'die': ['すまない……。'], 'win': ['まあ、こんなところかな。'], 'ready': ['やあ、おまたせ。'],
    },
    'sakura': {
        'atk': ['えいっ！', 'やあっ！', 'しゃーんなろー！'], 'hurt': ['きゃっ！', 'いたっ！'],
        'Q': ['しゃーんなろー！'], 'W': ['どりゃああっ！'], 'E': ['いりょうにんじゅつ！'], 'R': ['てんのこぶし！'],
        'spark': ['いくわよ！'], 'die': ['ごめん、みんな……。'], 'win': ['みた？これがわたしのちからよ！'], 'ready': ['はるのサクラ、いきます！'],
    },
    'luffy': {
        'atk': ['うおりゃ！', 'おらっ！', 'しっしっし！'], 'hurt': ['いてっ！', 'うおっ！'],
        'Q': ['ゴムゴムの、ピストル！'], 'W': ['ゴムゴムの、ロケット！'], 'E': ['ギア、セカンド！'], 'R': ['ゴムゴムの、ギガントピストル！'],
        'spark': ['うおおおおっ！'], 'die': ['はらへった……。'], 'win': ['にくー！にくくいてえ！'], 'ready': ['おれはかいぞくおうになるおとこだ！'],
    },
    'zoro': {
        'atk': ['ふんっ！', 'はっ！'], 'hurt': ['ちっ！', 'ぐっ！'],
        'Q': ['さんじゅうろくポンドほう！'], 'W': ['おにぎり！'], 'E': ['ししそんそん！'], 'R': ['さんぜんせかい！'],
        'spark': ['いくぜ。'], 'die': ['まだ……おわっちゃいねえ……。'], 'win': ['たいしたことねえな。'], 'ready': ['かかってこい。'],
    },
    'sanji': {
        'atk': ['はっ！', 'せいっ！', 'くらえ！'], 'hurt': ['ぐっ！', 'ちっ！'],
        'Q': ['コリエ、シュート！'], 'W': ['ムートン、ショット！'], 'E': ['スカイウォーク！'], 'R': ['ディアブルジャンブ！'],
        'spark': ['もえてきたぜ！'], 'die': ['くそっ……。'], 'win': ['りょうり、かんりょうだ。'], 'ready': ['いちりゅうのコックをなめるなよ。'],
    },
    'nami': {
        'atk': ['えいっ！', 'それっ！'], 'hurt': ['きゃあっ！', 'いたいっ！'],
        'Q': ['サンダーボルト、テンポ！'], 'W': ['クールボール！'], 'E': ['サイクロン、テンポ！'], 'R': ['ゼウス、ブリーズ、テンポ！'],
        'spark': ['いっくわよー！'], 'die': ['うそでしょ……。'], 'win': ['おたから、いただきっ！'], 'ready': ['てんこうは、わたしのみかたよ！'],
    },
}
SHOUT = {'atk', 'hurt', 'Q', 'W', 'E', 'R', 'spark', 'die'}
SR_OUT = 24000


def args():
    a = sys.argv[1:]
    o = {'only': None, 'wav': None}
    for i, x in enumerate(a):
        if x == '--only':
            o['only'] = a[i + 1].split(',')
        elif x == '--wav':
            o['wav'] = a[i + 1]
    return o


def open_synth():
    if not CORE:
        sys.exit('請設定 VV_CORE（VOICEVOX download 工具的輸出資料夾）')
    lib = [f for f in os.listdir(os.path.join(CORE, 'onnxruntime', 'lib')) if f.endswith('.dylib') or f.endswith('.so') or f.endswith('.dll')][0]
    ort = Onnxruntime.load_once(filename=os.path.join(CORE, 'onnxruntime', 'lib', lib))
    dic = [d for d in os.listdir(os.path.join(CORE, 'dict')) if d.startswith('open_jtalk')][0]
    syn = Synthesizer(ort, OpenJtalk(os.path.join(CORE, 'dict', dic)))
    styles = {}
    vdir = os.path.join(CORE, 'models', 'vvms')
    files = {}
    for f in sorted(os.listdir(vdir)):
        if not f.endswith('.vvm') or f.startswith('s'):  # s*.vvm 是串流（歌唱）模型，同名風格不能用來說話
            continue
        with VoiceModelFile.open(os.path.join(vdir, f)) as m:
            for sp in m.metas:
                for st in sp.styles:
                    styles.setdefault((sp.name, st.name), st.id)
                    files[st.id] = os.path.join(vdir, f)
    return syn, styles, files


def wav_to_np(b):
    with wave.open(io.BytesIO(b)) as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    return x, sr


def process(x, sr, shout):
    """去頭尾靜音、喊叫時加一點飽和與壓縮讓聲音更有力，最後正規化並淡出。"""
    a = np.abs(x)
    thr = max(a.max() * 0.02, 1e-4)
    idx = np.where(a > thr)[0]
    if len(idx):
        x = x[max(0, idx[0] - int(sr * 0.01)): idx[-1] + int(sr * 0.06)]
    x = x / (np.abs(x).max() + 1e-9)
    if shout:
        x = np.tanh(x * 1.8) / np.tanh(1.8)
        # 簡單的包絡壓縮：拉近大小聲
        env = np.convolve(np.abs(x), np.ones(int(sr * 0.01)) / int(sr * 0.01), mode='same')
        x = x / np.maximum(env, 0.12) ** 0.35
        x = x / (np.abs(x).max() + 1e-9)
    f = int(sr * 0.015)
    x[-f:] *= np.linspace(1, 0, f)
    return x * 0.95


def to_mp3(x, sr):
    if sr != SR_OUT:
        t = np.arange(int(len(x) * SR_OUT / sr)) * sr / SR_OUT
        x = np.interp(t, np.arange(len(x)), x)
    enc = lameenc.Encoder()
    enc.set_bit_rate(40)
    enc.set_in_sample_rate(SR_OUT)
    enc.set_channels(1)
    enc.set_quality(2)
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes()
    return enc.encode(pcm) + enc.flush()


def main():
    o = args()
    syn, styles, files = open_synth()
    loaded = set()
    prev = {}
    if os.path.exists(OUT):
        m = re.search(r'export const VOICES = (.*?);\n', open(OUT).read(), re.S)
        if m:
            prev = json.loads(m.group(1))
    out = {}
    total = 0
    for hid, cast in CAST.items():
        if o['only'] and hid not in o['only']:
            if hid in prev:
                out[hid] = prev[hid]
            continue
        out[hid] = {}
        for line, texts in LINES[hid].items():
            shout = line in SHOUT
            sp = cast['shout' if shout else 'talk']
            sid = styles.get(sp)
            if sid is None:
                sys.exit('找不到 VOICEVOX 風格 %s（模型還沒下載？）' % (sp,))
            if files[sid] not in loaded:
                with VoiceModelFile.open(files[sid]) as m:
                    syn.load_voice_model(m)
                loaded.add(files[sid])
            out[hid][line] = []
            for i, text in enumerate(texts):
                q = syn.create_audio_query(text, sid)
                q.speed_scale = cast['speed'] * (1.12 if line in ('atk', 'hurt') else 1.0)
                q.pitch_scale = cast['pitch'] + (0.04 if shout else 0.0)
                q.intonation_scale = 1.7 if shout else 1.2
                q.volume_scale = 1.3 if shout else 1.0
                q.pre_phoneme_length = 0.02
                q.post_phoneme_length = 0.06
                x, sr = wav_to_np(syn.synthesis(q, sid))
                x = process(x, sr, shout)
                mp3 = to_mp3(x, sr)
                total += len(mp3)
                out[hid][line].append(base64.b64encode(mp3).decode())
                if o['wav']:
                    os.makedirs(o['wav'], exist_ok=True)
                    with wave.open(os.path.join(o['wav'], '%s_%s_%d.wav' % (hid, line, i)), 'wb') as w:
                        w.setnchannels(1)
                        w.setsampwidth(2)
                        w.setframerate(sr)
                        w.writeframes((x * 32767).astype(np.int16).tobytes())
        print(hid, '完成')
    credits = sorted({c['credit'] for h, c in CAST.items() if h in out})
    with open(OUT, 'w') as f:
        f.write('// 由 tools/voices/build_voices.py 產生，請勿手改。角色語音（VOICEVOX 離線合成、MP3、base64）。\n')
        f.write('// 使用的 VOICEVOX 角色：%s\n' % '、'.join(credits))
        f.write('export const VOICES = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
        f.write('export const VOICE_CREDITS = ' + json.dumps(['VOICEVOX:' + c for c in credits], ensure_ascii=False) + ';\n')
    print('寫入', OUT, '%d KB（MP3 合計 %d KB）' % (os.path.getsize(OUT) // 1024, total // 1024))


main()
