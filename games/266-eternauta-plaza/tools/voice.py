# 任務無線電語音：Kokoro-82M（Apache-2.0）離線合成英文台詞，輸出 8 kHz 單聲道 16-bit WAV 到 assets/266/voice/。
# 無線電的頻寬、失真與雜訊在頁面裡用 WebAudio 即時加，這裡只輸出乾淨人聲。
# 用法：python voice.py <kokoro.onnx> <voices.bin> [id ...]（需要 pip install kokoro-onnx phonemizer-fork numpy）
# kokoro-onnx 附的 espeakng-loader 在 macOS 找不到資料檔，預設改用 Homebrew 的 espeak-ng（brew install espeak-ng），
# 路徑可用 ESPEAK_LIB／ESPEAK_DATA 覆寫。
import json, os, sys, wave, pathlib
import numpy as np
from kokoro_onnx import Kokoro
from kokoro_onnx.config import EspeakConfig

here = pathlib.Path(__file__).resolve().parent
spec = json.loads((here / 'voice-lines.json').read_text())
out = here.parents[2] / 'assets' / '266' / 'voice'
out.mkdir(parents=True, exist_ok=True)
tts = Kokoro(sys.argv[1], sys.argv[2], espeak_config=EspeakConfig(
    lib_path=os.environ.get('ESPEAK_LIB', '/opt/homebrew/lib/libespeak-ng.dylib'),
    data_path=os.environ.get('ESPEAK_DATA', '/opt/homebrew/share/espeak-ng-data')))
only = set(sys.argv[3:])
RATE = 8000
for k, line in spec['lines'].items():
    if only and k not in only: continue
    # 一句可以是字串，或 { text, voice, speed } 換另一個人講（結局的蒙特港反抗軍）
    line = line if isinstance(line, dict) else {'text': line}
    pcm, sr = tts.create(line['text'], voice=line.get('voice', spec['voice']), speed=line.get('speed', spec['speed']), lang='en-us')
    pcm = np.asarray(pcm, dtype=np.float64)
    # 降到 8 kHz 前先低通（簡單的加窗 sinc），避免混疊
    n = np.arange(-64, 65); fc = 3600 / sr
    h = 2 * fc * np.sinc(2 * fc * n) * np.hamming(len(n)); h /= h.sum()
    pcm = np.convolve(pcm, h, mode='same')
    t = np.arange(0, len(pcm) / sr, 1 / RATE)
    pcm = np.interp(t, np.arange(len(pcm)) / sr, pcm)
    # 修掉頭尾的靜音，再正規化到 -1 dBFS
    nz = np.flatnonzero(np.abs(pcm) > 0.01)
    if len(nz): pcm = pcm[max(0, nz[0] - 200): nz[-1] + 400]
    pcm = pcm / max(1e-6, np.abs(pcm).max()) * 0.89
    with wave.open(str(out / f'{k}.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes((pcm * 32767).astype('<i2').tobytes())
    print(k, f'{len(pcm) / RATE:.1f}s')
