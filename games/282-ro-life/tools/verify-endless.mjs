// 無盡之塔的驗證程式（在擁有者自己的電腦上跑，不在 Vercel 上）：
//   node --env-file=.env.local games/282-ro-life/tools/verify-endless.mjs [--limit 20] [--dry]
// 需要 RO_DATABASE_URL（和正式站同一個 Neon）與 PLAYWRIGHT_MODULE（playwright 的 index.mjs 路徑）。
// 流程：撈出 status = pending（或一小時沒動靜的 live）的場次 → 依場次的 build 編號找回同一版 web/282-ro-life.html
// （先看工作目錄，再往 git 歷史找）→ 無頭 Chrome 開那一版，用伺服器存的開局快照、種子、操作、選卡重跑
// （引擎內建的重播模式，每 30 格比一次狀態雜湊）→ 寫回結果：
//   verified：全部對上；分數、樓層、塔的點數一律用重跑的結果（不信用戶端自報），點數加進角色的塔進度、上排行榜
//   unranked：找不到那一版、重跑對不上、雜湊缺太多（不加點、不上榜，但不算作弊）
//   （目前沒有任何路徑寫 cheat：保留給之後人工判定）
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RoStore } from '../../../server/ro-life/store.mjs';
import { rebuild } from '../../../server/ro-life/endless.mjs';
import R from '../../../server/ro-life/rules-data.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const PAGE = 'web/282-ro-life.html';
const BUILD_RE = /\{commit:"([0-9a-f]{12})"\},[\w$]+=1e4/;
export const buildOf = (html) => html.match(BUILD_RE)?.[1] ?? null;

// build 編號 → 頁面內容（只找需要的那幾個；工作目錄優先，再往 git 歷史找）
export function findPages(needed, { root = ROOT, maxCommits = 300 } = {}) {
  const found = new Map();
  const want = new Set(needed);
  const take = (html) => { const b = buildOf(html); if (b && want.has(b) && !found.has(b)) found.set(b, html); };
  try { take(readFileSync(join(root, PAGE), 'utf8')); } catch {}
  if (found.size < want.size) {
    const log = spawnSync('git', ['log', '--format=%H', '-n', String(maxCommits), '--', PAGE], { cwd: root, encoding: 'utf8' });
    for (const c of log.stdout.split('\n').filter(Boolean)) {
      if (found.size >= want.size) break;
      const show = spawnSync('git', ['show', `${c}:${PAGE}`], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 });
      if (show.status === 0) take(show.stdout);
    }
  }
  return found;
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.glb': 'model/gltf-binary' };

// 判定（純函式，方便測試）：res 是頁面 __roReplayEndless 的回傳
export function judge(run, res) {
  if (!res) return { status: 'unranked', verdict: { why: 'build' } };
  if (res.error) return { status: 'unranked', verdict: { why: 'error', error: String(res.error).slice(0, 300) } };
  // 技能清單可能是換裝備前選的（合法清單看武器、盾、天賦），所以不算作弊，只是不排名
  if (res.skillsOk === false) return { status: 'unranked', verdict: { why: 'skills', skills: run.snapshot?.endless?.skills ?? [] } };
  const rb = res.rb ?? {};
  const need = Math.floor(run.ticks / R.endless.checkEvery);
  if (run.checks < need - 1) return { status: 'unranked', verdict: { why: 'checks', have: run.checks, need } };
  if (rb.firstBadCheck >= 0) return { status: 'unranked', verdict: { why: 'desync', at: rb.firstBadCheck, ticks: run.ticks } };
  if ((rb.ticks ?? res.ticks) < run.ticks) return { status: 'unranked', verdict: { why: 'short', ticks: rb.ticks ?? res.ticks, want: run.ticks } };
  const c = res.claim ?? {};
  const verdict = { ok: true, ticks: run.ticks, checks: run.checks, ms: rb.ms ?? null, claimed: run.claim ?? null, replay: c, failed: res.failed ?? null };
  return { status: 'verified', verdict, score: Math.round(c.score ?? 0), floor: c.wave ?? 1, points: Math.max(0, Math.round(c.points ?? 0)), best: Math.max(0, c.bestWave ?? 0) };
}

// 跑一批：store 是 RoStore（正式站用 Neon；測試用記憶體），chromium 是 playwright 的 chromium
export async function verifyPending({ store, chromium, limit = 20, dry = false, log = console.log, pages = null, launch = {} }) {
  const runs = await store.endlessPending(limit);
  if (!runs.length) { log('沒有要驗證的場次'); return []; }
  const html = pages ?? findPages(runs.map((r) => r.build));
  const srv = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const m = path.match(/^\/web\/__verify-([0-9a-f]{12})\.html$/);
    if (m && html.has(m[1])) { res.writeHead(200, { 'content-type': TYPES['.html'] }); return res.end(html.get(m[1])); }
    const p = normalize(path).replace(/^\/+/, '');
    if (!/^(assets|vendor)\//.test(p)) { res.writeHead(404); return res.end(); }
    try { const b = await readFile(join(ROOT, p)); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu', '--use-angle=swiftshader', '--mute-audio'], ...launch });
  const out = [];
  try {
    for (const run of runs) {
      let res = null;
      if (html.has(run.build)) {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
        const page = await ctx.newPage();
        try {
          await page.goto(`${base}/web/__verify-${run.build}.html`);
          await page.waitForFunction(() => !document.getElementById('sp-play')?.disabled && typeof window.__roReplayEndless === 'function', null, { timeout: 120_000 });
          const { moves, checks } = rebuild(await store.endlessChunks(run.id), run.ticks, run.checks);
          res = await page.evaluate(async (r) => {
            const skillsOk = window.__roEndlessSkillsOk ? window.__roEndlessSkillsOk(r.char) : null;
            if (skillsOk === false) return { skillsOk };
            const x = await window.__roReplayEndless(r);
            return { ...x, skillsOk };
          }, { charId: run.snapshot.id, char: run.snapshot, wave: run.wave, seed: run.seed, moves, picks: run.picks, ticks: run.ticks, hash: '', checks });
        } catch (e) {
          res = { error: e.message };
        } finally {
          await ctx.close();
        }
      }
      const j = judge(run, res);
      log(`${run.id} ${run.name ?? ''} build=${run.build} ticks=${run.ticks} → ${j.status}${j.status === 'verified' ? ` 分數 ${j.score} 樓層 ${j.floor} 點數 +${j.points}` : ` ${JSON.stringify(j.verdict)}`}`);
      if (!dry) await store.endlessVerdict(run.id, j);
      out.push({ id: run.id, ...j });
    }
  } finally {
    await browser.close();
    srv.close();
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const limit = Number(args[args.indexOf('--limit') + 1]) || 20;
  if (!process.env.RO_DATABASE_URL) throw new Error('要設 RO_DATABASE_URL（node --env-file=.env.local …）');
  if (!process.env.PLAYWRIGHT_MODULE) throw new Error('要設 PLAYWRIGHT_MODULE（playwright 的 index.mjs 路徑）');
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
  await verifyPending({ store: new RoStore(process.env), chromium, limit, dry: args.includes('--dry') });
}
