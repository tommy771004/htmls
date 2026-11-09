// Making-of timelapse: Blender UI screenshots (out/shots + manifest.json from build_mcp.py) -> captioned 1920x1080
// frames (laid out in headless Chrome, Hiragino type) -> ffmpeg concat with per-shot hold -> optional tail of the
// final film. Output: ../../assets/279/making.mp4
//
//   node tools/timelapse.mjs [--hold=0.42] [--tail=out/frames] [--out=../../assets/279/making.mp4]
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1] ?? d
const HOLD = +arg('hold', 0.42)
const TAIL = arg('tail', 'out/frames')
const OUT = resolve(ROOT, arg('out', '../../assets/279/making.mp4'))
const CHROME = process.env.CHROME_PATH || join(homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell')

const SHOTS = join(ROOT, 'out/shots')
const man = JSON.parse(readFileSync(join(SHOTS, 'manifest.json'), 'utf8'))
const WORK = join(ROOT, 'out/tl'); rmSync(WORK, { recursive: true, force: true }); mkdirSync(WORK, { recursive: true })

const PH = { model: ['建模', 'Modelling'], materials: ['材質', 'Shading'], lighting: ['打光', 'Lighting'] }
const order = ['model', 'materials', 'lighting']
const counts = Object.fromEntries(order.map(p => [p, man.filter(m => m.phase === p).length]))
const seen = { model: 0, materials: 0, lighting: 0 }

const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
function page(m, i) {
  seen[m.phase]++
  const bars = order.map(p => {
    const f = p === m.phase ? seen[p] / counts[p] : order.indexOf(p) < order.indexOf(m.phase) ? 1 : 0
    return `<div class="seg${p === m.phase ? ' on' : ''}"><i style="width:${(f * 100).toFixed(1)}%"></i><b>${PH[p][0]}</b></div>`
  }).join('')
  const cap = m.caption.replace(/^(建模|材質|打光) · /, '')
  return `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;width:1920px;height:1080px;background:#16130f;overflow:hidden;font-family:"Hiragino Sans","ヒラギノ角ゴシック",sans-serif}
img{position:absolute;left:0;top:0;width:1920px;height:986px;object-fit:cover;object-position:top}
.band{position:absolute;left:0;right:0;bottom:0;height:94px;display:flex;align-items:center;gap:40px;padding:0 44px;color:#efe6d8}
.ph{font-weight:700;font-size:30px;letter-spacing:.06em;min-width:96px}
.cap{flex:1;font-weight:300;font-size:25px;color:#d9cdbb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.n{font:500 20px/1 "SF Mono",Menlo,monospace;color:#8f826f}
.bars{display:flex;gap:10px;width:470px}
.seg{flex:1;position:relative;height:30px}
.seg i{position:absolute;left:0;bottom:0;height:4px;border-radius:2px;background:#e8a04c}
.seg::after{content:"";position:absolute;left:0;right:0;bottom:0;height:4px;border-radius:2px;background:#ffffff1c}
.seg b{position:absolute;left:0;top:0;font-weight:500;font-size:15px;color:#7d7262}
.seg.on b{color:#efe6d8}
</style><img src="file://${join(SHOTS, m.file)}"><div class="band"><div class="ph">${PH[m.phase][0]}</div><div class="cap">${esc(cap)}</div><div class="n">${String(i + 1).padStart(3, '0')} / ${man.length}</div><div class="bars">${bars}</div></div>`
}

const list = [], chapters = []
let tAcc = 0
man.forEach((m, i) => {
  const html = join(WORK, `p${i}.html`), png = join(WORK, `f${String(i).padStart(4, '0')}.png`)
  writeFileSync(html, page(m, i))
  execFileSync(CHROME, ['--headless', '--hide-scrollbars', '--force-device-scale-factor=1', '--allow-file-access-from-files',
    '--window-size=1920,1080', `--screenshot=${png}`, `file://${html}`], { stdio: 'ignore' })
  // longer hold on phase changes and on the last shot of each phase
  const last = i === man.length - 1 || man[i + 1].phase !== m.phase
  if (i === 0 || man[i - 1].phase !== m.phase) chapters.push({ phase: m.phase, name: PH[m.phase][0], t: +tAcc.toFixed(2) })   // concat start = sum of earlier durations
  tAcc += last ? HOLD * 4 : HOLD
  list.push(`file '${png}'`, `duration ${(last ? HOLD * 4 : HOLD).toFixed(3)}`)
})
list.push(list[list.length - 2])
writeFileSync(join(WORK, 'list.txt'), list.join('\n') + '\n')

mkdirSync(dirname(OUT), { recursive: true })
const shotsMp4 = join(WORK, 'shots.mp4')
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(WORK, 'list.txt'),
  '-vf', 'fps=24,format=yuv420p', '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', shotsMp4])

const tailDir = resolve(ROOT, TAIL)
const parts = [shotsMp4]
if (existsSync(tailDir) && readdirSync(tailDir).some(f => f.endsWith('.png'))) {
  const tailMp4 = join(WORK, 'tail.mp4')
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', '24', '-pattern_type', 'glob', '-i', join(tailDir, '*.png'),
    '-t', '5', '-vf', 'scale=1920:1080,format=yuv420p', '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', tailMp4])
  parts.push(tailMp4)
}
if (parts.length === 1) {
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', shotsMp4, '-c', 'copy', '-movflags', '+faststart', OUT])
} else {
  // 0.6 s crossfade from the last screenshot into the finished film
  const d = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', shotsMp4]).toString()
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', parts[0], '-i', parts[1], '-filter_complex',
    `[0][1]xfade=transition=fade:duration=0.6:offset=${(d - 0.6).toFixed(3)},format=yuv420p`,
    '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-movflags', '+faststart', OUT])
  chapters.push({ phase: 'film', name: '成片', t: +(d - 0.6).toFixed(2) })
}
writeFileSync(join(ROOT, 'out/chapters.json'), JSON.stringify(chapters))
console.log(JSON.stringify(chapters))
console.log('timelapse ->', OUT, man.length, 'shots')
