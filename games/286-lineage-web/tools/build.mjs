import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(GAME_ROOT, '../..');
const OUT_HTML = join(REPO_ROOT, 'web/286-lineage-web.html');

const globalsCss = readFileSync(join(GAME_ROOT, 'src/styles/globals.css'), 'utf8');
const authCss = readFileSync(join(GAME_ROOT, 'src/styles/lineage-auth.css'), 'utf8');

const guideJson = JSON.parse(readFileSync(join(GAME_ROOT, 'src/data/captured/guide.json'), 'utf8'));
const releaseScopeJson = JSON.parse(
  readFileSync(join(GAME_ROOT, 'src/data/captured/release-scope.json'), 'utf8'),
);
const forumSeedJson = JSON.parse(
  readFileSync(join(GAME_ROOT, 'src/data/captured/forum-topics.json'), 'utf8'),
);
const dialoguesJson = JSON.parse(
  readFileSync(join(GAME_ROOT, 'src/data/captured/dialogues.json'), 'utf8'),
);

// Extract first 40 NPC dialogues as inline fallback while full dialogues.json loads from ../assets/286/lineage163/dialogues.json
const sampleDialogues = {};
let count = 0;
for (const [k, v] of Object.entries(dialoguesJson)) {
  sampleDialogues[k] = v;
  count += 1;
  if (count >= 40) break;
}

const capturedPayload = JSON.stringify({
  guide: guideJson,
  releaseScope: releaseScopeJson,
  forumSeed: forumSeedJson,
  sampleDialogues,
}).replace(/<\/script>/gi, '<\\/script>');

const appJs = readFileSync(join(GAME_ROOT, 'src/app.js'), 'utf8').replace(
  /<\/script>/gi,
  '<\\/script>',
);

const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>天堂人生 · 1.63 獨立運作平台 — 說話之島大廳、圖鑑與論壇 | #286</title>
  <meta name="description" content="天堂 1.63 說話之島獨立運作平台，整合 4:3 經典登入、8 格角色創立與選擇、243 筆首發攻略圖鑑、冒險者論壇、能力骰子模擬、蛋幣儲值與 GM 稽核控制台。" />
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%230c1118'/%3E%3Cpath d='M16 4l4 8 8 2-6 6 2 8-8-4-8 4 2-8-6-6 8-2z' fill='%23d4ad63'/%3E%3C/svg%3E" type="image/svg+xml" />
  <style>
${globalsCss}
${authCss}
  </style>
</head>
<body>
  <div id="app-root"></div>
  <script>
window.__LINEAGE_CAPTURED_DATA__ = ${capturedPayload};
  </script>
  <script type="module">
${appJs}
  </script>
</body>
</html>
`;

if (/<script[^>]+src=/i.test(html) || /<link[^>]+rel=["']stylesheet["']/i.test(html)) {
  throw new Error('Single-file HTML check failed: external script or stylesheet found');
}

writeFileSync(OUT_HTML, html, 'utf8');
console.log(
  `[286-lineage-web] Built ${OUT_HTML} (${(Buffer.byteLength(html, 'utf8') / 1024).toFixed(1)} KB)`,
);
