// 真實錄音音效：從 Freesound 下載 CC0 錄音的 128 kbps 預覽 MP3 到 assets/260/sfx/，寫出 sfx.json（頁面讀的清單）與 CREDITS.md。
// 每個音檔先開 Freesound 的音效頁確認授權是 CC0（不是就中止），作者與標題從頁面讀。
// 不轉檔：裁切、正規化、淡出與循環接縫都在頁面解碼後做（80-audio.js 的 sfxSlice／sfxLoop），所以這裡只記秒數。
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

const UA = { 'user-agent': 'Mozilla/5.0 (Macintosh) neon-nightcity-sfx' };
const ids = [...new Set([...Object.values(ONE).flat().map((v) => v[0]), ...Object.values(LOOP).map((v) => v[0])])];
mkdirSync(out, { recursive: true });
const src = {};
for (const id of ids) {
  const page = await (await fetch(`https://freesound.org/s/${id}/`, { headers: UA, redirect: 'follow' })).text();
  const lic = (page.match(/title="Go to the full license text" href="([^"]+)"/) || [])[1] || '';
  if (!/publicdomain\/zero\/1\.0/.test(lic)) throw new Error(`${id} 不是 CC0（${lic || '找不到授權'}）`);
  const by = (page.match(/<meta property="og:audio:artist" content="([^"]*)"/) || [])[1];
  const title = (page.match(/<meta property="og:audio:title" content="([^"]*)"/) || [])[1];
  const prev = (page.match(/https:\/\/cdn\.freesound\.org\/previews\/[^"]+-hq\.mp3/) || [])[0]
    || ((page.match(/https:\/\/cdn\.freesound\.org\/previews\/[^"]+-lq\.mp3/) || [])[0] || '').replace('-lq.mp3', '-hq.mp3');
  if (!prev) throw new Error(`${id} 找不到預覽 MP3`);
  const f = `${id}.mp3`, p = resolve(out, f);
  if (force || !existsSync(p)) {
    const r = await fetch(prev, { headers: UA });
    if (!r.ok) throw new Error(`${id} 下載失敗 ${r.status}`);
    writeFileSync(p, Buffer.from(await r.arrayBuffer()));
  }
  src[id] = { f, by, t: title.replace(/&amp;/g, '&'), url: `https://freesound.org/s/${id}/` };
  console.log(`${id}\t${by}\t${src[id].t}`);
}
// 清單沒用到的舊檔案拿掉
for (const f of readdirSync(out)) if (/^\d+\.mp3$/.test(f) && !src[f.slice(0, -4)]) { unlinkSync(resolve(out, f)); console.log('移除', f); }

const one = {}, loop = {};
for (const [k, vs] of Object.entries(ONE)) one[k] = vs.map(([id, o, d]) => [src[id].f, o, d]);
for (const [k, [id, o, d]] of Object.entries(LOOP)) loop[k] = [src[id].f, o, d];
writeFileSync(resolve(out, 'sfx.json'), JSON.stringify({ one, loop }) + '\n');

const used = (id) => [...Object.entries(ONE).filter(([, vs]) => vs.some((v) => v[0] === id)).map(([k]) => k), ...Object.entries(LOOP).filter(([, v]) => v[0] === id).map(([k]) => k)].join('、');
const rows = ids.map((id) => `| \`${src[id].f}\` | [${src[id].t.replace(/\|/g, '\\|')}](${src[id].url}) | ${src[id].by} | ${used(id)} |`);
writeFileSync(resolve(out, 'CREDITS.md'), `# assets/260/sfx 音效來源

作品 260 霓虹夜城的真實錄音音效（槍聲、爆炸、撞擊、人聲以外的肢體碰撞、腳步、車門、引擎、輪胎、警笛、直升機等），全部是 [Freesound](https://freesound.org/) 上授權為 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) 的錄音，檔案是 Freesound 的 128 kbps 預覽 MP3。由 \`games/260-neon-nightcity/tools/sfx.mjs\` 下載（每個檔案下載前都檢查過音效頁上的授權），頁面在解碼後裁切、正規化並淡出。CC0 不要求標示，這裡仍列出作者。

不使用 Grand Theft Auto V 或任何 Rockstar Games 作品的音效；這些是真實世界的錄音，用來取代原本的合成音。

| 檔案 | 錄音 | 作者 | 用在 |
| :-- | :-- | :-- | :-- |
${rows.join('\n')}
`);
console.log(`${ids.length} 個檔案 → ${out}`);
