// 真實錄音音效：從 Freesound 下載 CC0 錄音的 128 kbps 預覽 MP3 到 assets/260/sfx/，寫出 sfx.json（頁面讀的清單）與 CREDITS.md。
// 每個音檔先開 Freesound 的音效頁確認授權是 CC0（不是就中止），作者與標題從頁面讀。
// 不轉檔：裁切、正規化、淡出與循環接縫都在頁面解碼後做（80-audio.js 的 sfxSlice／sfxLoop），所以這裡只記秒數。
// 例外是各引擎型式的轉速層（ENG）：原檔動輒幾 MB，只照 MP3 音框切出用到的那一兩秒（不重新編碼）到 sfx/eng/，原檔留在 gitignore 的 .cache/sfx/。
// 用法：node tools/sfx.mjs（已下載的檔案會跳過；--force 重抓）
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, '../../assets/260/sfx');
const force = process.argv.includes('--force');

// 單發音：名稱 → 變體 [Freesound id, 起點秒, 長度秒]。長度就是這個音的生命週期，頁面在最後 35% 淡到無聲、到點就停，不留尾音
const ONE = {
  pistol: [[427592, .1, .75], [371440, 0, .5], [391328, 0, .5]],
  smg: [[344143, 0, .34], [371440, 0, .3]],
  rifle: [[427596, .05, .8], [484036, 0, .7], [433858, 0, .65]],
  shotgun: [[427595, .03, .9], [163455, 0, .45]],
  sniper: [[514228, 0, 1.3], [163460, 0, .55]],
  silenced: [[384685, 0, .22], [380185, 0, .18], [369781, 0, .4]],
  ricochet: [[392975, 0, .42]],
  explode: [[244394, 0, 1.9], [47252, 0, 1.4], [136765, 0, 2]],
  rocket: [[840511, .04, 1.3]],
  crash: [[592388, 0, 1.3], [420356, 0, 1], [237375, .36, 1.1]],
  bump: [[151624, 0, .5], [332056, 0, .3], [332058, 0, .55], [329516, .12, .7]],
  punch: [[118513, .03, .22], [390462, 0, .45], [104183, .34, .38], [517744, .44, .24]],
  body: [[276600, .18, .45], [82027, 0, .35], [187136, .32, .45]],
  bodyfall: [[417994, .22, .9]],
  glass: [[141563, .18, 1.2], [587928, .04, 1]],
  bottle: [[212698, .48, .55]],
  step: [.06, .64, 1.22, 1.78, 2.36, 2.96].map((o) => [521590, o, .3]),
  reload: [[396331, 0, .56]],
  dry: [[523087, 0, .14]],
  doorCar: [[208695, .12, .3], [9876, 0, .3], [173009, .3, .35]],
  door: [[266682, .32, .37]],
  horn: [[434878, 0, .25], [170243, 0, .4]],
  splash: [[9508, 0, 1.3]],
  thunder: [[399656, .08, 4.5]],
  trainHorn: [[20065, 0, 1.8]],
  engStart: [[401558, .05, 1.4]],
  engStop: [[401557, 0, 1.4]],
};
// 循環音：[id, 起點, 長度]。頁面多讀 80 ms 和開頭交叉淡化成無縫循環；警笛與旋翼的長度是量好的整數個週期（wail 4.68 s、yelp 0.98 s、旋翼 0.36 s）
const LOOP = {
  engIdle: [401552, .1, 2.9],
  engLow: [401556, .05, 1.95],
  engMed: [401555, .05, 2.65],
  engHigh: [401551, .05, 1.9],
  bikeIdle: [119455, 8.8, 3],
  skid: [71739, 5, 3],
  sirenWail: [159753, 1, 9.36],
  sirenYelp: [58015, .3, 3.92],
  heli: [187678, .1, 5.4],
};

// 各引擎型式的轉速層：型式 → [Freesound id, 起點秒, 長度秒, 這段的基頻 Hz]，基頻由低到高。
// 長度是在 ±2 個週期內找接縫誤差最小的值；基頻是頻譜上的主峰（有半階次峰時取主峰），頁面用它把轉速換成每層的播放速率（80-audio.js 的 ENG_FAM）。
// 片段都挑音高與音量平穩的地方：怠速、空檔拉轉停住的那一下、底盤動力計上同一檔慢慢爬升的區段。
// 只有引擎層可以用 CC BY（標示在 CREDITS 與頁面的看車對話），其他一律 CC0；NC、ND 等授權直接中止。
const ENG = {
  bmw: [[478597, 34.6, 2.292, 84.8], [478597, 3.4, 1.785, 103.6], [415276, 14, 1.395, 271.2]],
  jdm6: [[478597, 34.6, 2.292, 84.8], [496171, .4, .613, 112.4], [496171, 13.4, 2.21, 169.6], [496171, 10, .491, 203.2]],   // 動力計錄音沒有怠速，最低層借 BMW M6 的怠速
  flat6: [[772802, 4.2, 2.455, 35], [55727, 2.6, .794, 58.5], [772802, 33.3, .794, 101.6], [90404, 4.85, .445, 231.5]],
  fer8: [[241083, 20, 2.394, 71.3], [241083, 12.3, 1.602, 110.4], [241083, 7.4, .705, 183]],
  us8: [[760645, 42.2, 1.817, 52.5], [760645, 56, .787, 82.1], [760645, 186, 1.585, 133.2], [760645, 64.4, .69, 149.4]],
  v12: [[112075, 20.4, 1.307, 68], [112075, 14.1, 2.019, 104.3], [112075, 33.1, 1.312, 155.4], [112075, 55.1, .806, 211.3]],
  i4: [[535944, 12, 2.028, 50.5], [535944, 1.5, .607, 117.8], [535944, 9.2, .605, 154.1]],
  bike4: [[211668, 8, 3.249, 38.4], [211668, 1.3, 2.524, 50.5], [428191, 3.4, .607, 178.3], [428191, 12.3, .704, 436.7]],
};

const UA = { 'user-agent': 'Mozilla/5.0 (Macintosh) neon-nightcity-sfx' };
const ids = [...new Set([...Object.values(ONE).flat().map((v) => v[0]), ...Object.values(LOOP).map((v) => v[0])])];
const engIds = [...new Set(Object.values(ENG).flat().map((v) => v[0]))];
const cache = resolve(root, '.cache/sfx');
mkdirSync(out, { recursive: true }); mkdirSync(resolve(out, 'eng'), { recursive: true }); mkdirSync(cache, { recursive: true });
const LIC = { 'publicdomain/zero/1.0': 'CC0 1.0', 'licenses/by/3.0': 'CC BY 3.0', 'licenses/by/4.0': 'CC BY 4.0' };
const src = {};
for (const id of [...ids, ...engIds.filter((i) => !ids.includes(i))]) {
  const page = await (await fetch(`https://freesound.org/s/${id}/`, { headers: UA, redirect: 'follow' })).text();
  const lic = (page.match(/title="Go to the full license text" href="([^"]+)"/) || [])[1] || '';
  const lk = Object.keys(LIC).find((k) => lic.replace(/\/$/, '').endsWith(k));
  if (!lk || (lk !== 'publicdomain/zero/1.0' && !engIds.includes(id))) throw new Error(`${id} 授權不能用（${lic || '找不到授權'}）`);
  const by = (page.match(/<meta property="og:audio:artist" content="([^"]*)"/) || [])[1];
  const title = (page.match(/<meta property="og:audio:title" content="([^"]*)"/) || [])[1];
  const prev = (page.match(/https:\/\/cdn\.freesound\.org\/previews\/[^"]+-hq\.mp3/) || [])[0]
    || ((page.match(/https:\/\/cdn\.freesound\.org\/previews\/[^"]+-lq\.mp3/) || [])[0] || '').replace('-lq.mp3', '-hq.mp3');
  if (!prev) throw new Error(`${id} 找不到預覽 MP3`);
  const f = `${id}.mp3`, p = resolve(ids.includes(id) ? out : cache, f);
  if (force || !existsSync(p)) {
    const r = await fetch(prev, { headers: UA });
    if (!r.ok) throw new Error(`${id} 下載失敗 ${r.status}`);
    writeFileSync(p, Buffer.from(await r.arrayBuffer()));
  }
  src[id] = { f, p, by, lic: LIC[lk], licUrl: `https://creativecommons.org/${lk}/`, t: title.replace(/&amp;/g, '&'), url: `https://freesound.org/s/${id}/` };
  console.log(`${id}\t${LIC[lk]}\t${by}\t${src[id].t}`);
}

// MP3 照音框切段（不重新編碼）：前面多留 0.3 s 給位元儲存槽與解碼器暖機，回傳 [切好的檔案, 新起點秒]
function mp3Cut(buf, t0, t1) {
  let i = 0;
  if (buf.toString('latin1', 0, 3) === 'ID3') i = 10 + ((buf[6] & 127) << 21 | (buf[7] & 127) << 14 | (buf[8] & 127) << 7 | buf[9] & 127);
  const BR1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], BR2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  const frames = []; let t = 0;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) { i++; continue; }
    const ver = (buf[i + 1] >> 3) & 3, lay = (buf[i + 1] >> 1) & 3, bi = buf[i + 2] >> 4, si = (buf[i + 2] >> 2) & 3, pad = (buf[i + 2] >> 1) & 1;
    if (lay !== 1 || bi === 0 || bi === 15 || si === 3 || ver === 1) { i++; continue; }
    const sr = [[11025, 12000, 8000], null, [22050, 24000, 16000], [44100, 48000, 32000]][ver][si], v1 = ver === 3;
    const len = Math.floor((v1 ? 144000 : 72000) * (v1 ? BR1 : BR2)[bi] / sr) + pad, dur = (v1 ? 1152 : 576) / sr;
    if (len < 4 || i + len > buf.length) break;
    frames.push([i, len, t]); t += dur; i += len;
  }
  const k0 = Math.max(0, frames.findIndex((f) => f[2] >= t0 - .3)), k1 = frames.findIndex((f) => f[2] > t1 + .2);
  const sel = frames.slice(k0, k1 < 0 ? frames.length : k1);
  return [Buffer.concat(sel.map(([o, l]) => buf.subarray(o, o + l))), +(t0 - frames[k0][2]).toFixed(3)];
}
const eng = {};
for (const f of readdirSync(resolve(out, 'eng'))) unlinkSync(resolve(out, 'eng', f));
for (const [fam, ls] of Object.entries(ENG)) {
  eng[fam] = ls.map(([id, o, d, hz], k) => {
    const [b, o2] = mp3Cut(readFileSync(src[id].p), o, o + d + .08), f = `eng/${fam}${k}.mp3`;   // 多切 80 ms：循環接縫的交叉淡化要讀到窗外
    writeFileSync(resolve(out, f), b);
    return [f, o2, d, hz];
  });
}
// 清單沒用到的舊檔案拿掉
for (const f of readdirSync(out)) if (/^\d+\.mp3$/.test(f) && !src[f.slice(0, -4)]) { unlinkSync(resolve(out, f)); console.log('移除', f); }

const one = {}, loop = {};
for (const [k, vs] of Object.entries(ONE)) one[k] = vs.map(([id, o, d]) => [src[id].f, o, d]);
for (const [k, [id, o, d]] of Object.entries(LOOP)) loop[k] = [src[id].f, o, d];
writeFileSync(resolve(out, 'sfx.json'), JSON.stringify({ one, loop, eng }) + '\n');

const used = (id) => [...Object.entries(ONE).filter(([, vs]) => vs.some((v) => v[0] === id)).map(([k]) => k), ...Object.entries(LOOP).filter(([, v]) => v[0] === id).map(([k]) => k)].join('、');
const rows = ids.map((id) => `| \`${src[id].f}\` | [${src[id].t.replace(/\|/g, '\\|')}](${src[id].url}) | ${src[id].by} | ${used(id)} |`);
const engRows = Object.entries(ENG).flatMap(([fam, ls]) => ls.map(([id, o, d, hz], k) => `| \`eng/${fam}${k}.mp3\` | [${src[id].t.replace(/\|/g, '\\|')}](${src[id].url}) | ${src[id].by} | [${src[id].lic}](${src[id].licUrl}) | ${fam} 第 ${k + 1} 層（${o}–${+(o + d).toFixed(2)} s，${hz} Hz） |`));
writeFileSync(resolve(out, 'CREDITS.md'), `# assets/260/sfx 音效來源

作品 260 霓虹夜城的真實錄音音效（槍聲、爆炸、撞擊、人聲以外的肢體碰撞、腳步、車門、引擎、輪胎、警笛、直升機等），都是 [Freesound](https://freesound.org/) 上的錄音，檔案是 Freesound 的 128 kbps 預覽 MP3。由 \`games/260-neon-nightcity/tools/sfx.mjs\` 下載（每個檔案下載前都檢查過音效頁上的授權），頁面在解碼後裁切、正規化並淡出。第一張表全部是 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)，CC0 不要求標示，這裡仍列出作者；第二張表是各引擎型式的轉速層，少數是 CC BY（標示如下，遊戲裡車行的看車對話也會列出）。

不使用 Grand Theft Auto V 或任何 Rockstar Games 作品的音效；這些是真實世界的錄音，用來取代原本的合成音。

| 檔案 | 錄音 | 作者 | 用在 |
| :-- | :-- | :-- | :-- |
${rows.join('\n')}

## 引擎轉速層（\`eng/\`）

每台實車依引擎型式用一組真實錄音（對照表在 \`src/parts/80-audio.js\` 的 \`ENG_FAM\`）。每層是從原錄音照 MP3 音框切出的一兩秒（沒有重新編碼），頁面依轉速在相鄰兩層之間交叉淡化並變調。

| 檔案 | 錄音 | 作者 | 授權 | 用在 |
| :-- | :-- | :-- | :-- | :-- |
${engRows.join('\n')}
`);
console.log(`${ids.length} 個檔案、${Object.values(eng).flat().length} 個引擎層 → ${out}`);
