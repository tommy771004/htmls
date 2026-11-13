import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = path.resolve(HERE, '..');
const SRC_DIR = path.join(GAME_DIR, 'src');
const OUT_FILE = path.resolve(GAME_DIR, '../../web/284-lineage-life.html');
const ASSETS_DIR = path.resolve(GAME_DIR, '../../assets/284');

const PLACEHOLDER_SVG = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<rect width="64" height="64" rx="8" fill="#1e293b" stroke="#475569" stroke-width="2"/>' +
    '<text x="32" y="42" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="bold" fill="#94a3b8">?</text>' +
  '</svg>'
);

function loadAssetsMap() {
  const mapPath = path.join(SRC_DIR, 'assets-map.json');
  if (!fs.existsSync(mapPath)) {
    throw new Error(`Missing ${mapPath}. Run npm run prepare-assets first.`);
  }
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  const missing = [];
  for (const val of new Set(Object.values(map))) {
    const rel = val.replace(/^\.\.\/assets\/284\//, '');
    if (!fs.existsSync(path.join(ASSETS_DIR, rel))) missing.push(val);
  }
  if (missing.length) {
    throw new Error(`Missing ${missing.length} prepared assets (first: ${missing[0]})`);
  }
  return map;
}

function buildCompactAnimManifest(assetsMap) {
  const buckets = Object.create(null);
  const re = /^(assets\/(?:anim|classanim|morphanim)\/[^/]+)\/((?:d\d+\/)?[a-z0-9_]+_)(\d+)\.png$/i;
  for (const key of Object.keys(assetsMap)) {
    const m = re.exec(key);
    if (!m) continue;
    const folder = m[1];
    const prefix = m[2];
    const idx = parseInt(m[3], 10);
    if (!buckets[folder]) buckets[folder] = Object.create(null);
    if (!buckets[folder][prefix]) buckets[folder][prefix] = new Set();
    buckets[folder][prefix].add(idx);
  }
  const manifest = Object.create(null);
  for (const folder of Object.keys(buckets).sort()) {
    const entry = Object.create(null);
    for (const prefix of Object.keys(buckets[folder]).sort()) {
      const set = buckets[folder][prefix];
      let n = 0;
      while (set.has(n)) n++;
      if (n > 0) entry[prefix] = n;
    }
    if (Object.keys(entry).length) manifest[folder] = entry;
  }
  return manifest;
}

function inlineCss(cssFileRel, assetsMap) {
  let css = fs.readFileSync(path.join(SRC_DIR, cssFileRel), 'utf8');
  css = css.replace(/https:\/\/tailwindcss\.com[^\s*]*/g, 'TailwindCSS');
  css = css.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi, (full, _q, rawUrl) => {
    const norm = rawUrl.trim().replace(/^(\.\.\/)+/, '').replace(/^[./]+/, '').replace(/[?#].*$/, '');
    const mapped = assetsMap[norm];
    if (mapped) return `url('${mapped}')`;
    if (/^(?:data:|blob:|\.\.\/assets\/284\/)/i.test(rawUrl.trim())) return full;
    return 'none';
  });
  return `<style data-src="${cssFileRel}">\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>`;
}

function rewriteStaticHtmlImgs(html, assetsMap) {
  return html.replace(/(<img\b[^>]*\bsrc\s*=\s*)(["'])([^"']+)\2/gi, (full, pre, q, rawUrl) => {
    const norm = rawUrl.trim().replace(/^[./]+/, '').replace(/[?#].*$/, '');
    let dec = norm;
    if (dec.indexOf('%') !== -1) {
      try { dec = decodeURIComponent(dec); } catch (_) {}
    }
    const mapped = assetsMap[dec] || assetsMap[norm];
    if (!mapped) return full;
    return `${pre}${q}${mapped}${q}`;
  });
}

function sanitizeInlineJs(jsText, label = 'inline') {
  const out = jsText
    .replace(/https:\/\/placehold\.co\/[^\s"'`<>\\)]+/g, PLACEHOLDER_SVG)
    .replace(/<\/script/gi, '<\\/script');
  new vm.Script(out, { filename: label });
  return out;
}

function build() {
  const assetsMap = loadAssetsMap();
  const compactManifest = buildCompactAnimManifest(assetsMap);
  const assetBridgeJs = sanitizeInlineJs(fs.readFileSync(path.join(SRC_DIR, 'js/asset-bridge.js'), 'utf8'), 'js/asset-bridge.js');

  let html = fs.readFileSync(path.join(SRC_DIR, 'template.html'), 'utf8');

  const cssMatches = [...html.matchAll(/<link\s+rel=["']stylesheet["']\s+href=["'](css\/[^"'?]+)(?:\?[^"']*)?["']\s*>/gi)];
  for (const m of cssMatches) {
    html = html.split(m[0]).join(inlineCss(m[1], assetsMap));
  }

  html = rewriteStaticHtmlImgs(html, assetsMap);

  const headBridge =
    `<script>\n` +
    `window.__LL_ASSETS = ${JSON.stringify(assetsMap)};\n` +
    `${assetBridgeJs}\n` +
    `</script>\n</head>`;
  if (!html.includes('</head>')) throw new Error('Missing </head> in template.html');
  html = html.split('</head>').join(headBridge);

  const scriptMatches = [...html.matchAll(/<script\s+src=["'](js\/[^"'?]+)(?:\?[^"']*)?["']\s*><\/script>/gi)];
  for (const m of scriptMatches) {
    const rel = m[1];
    let body;
    if (rel === 'js/anim-manifest.js') {
      body = `const ANIM_MANIFEST = ${JSON.stringify(compactManifest)};`;
    } else {
      body = sanitizeInlineJs(fs.readFileSync(path.join(SRC_DIR, rel), 'utf8'), rel);
    }
    html = html.split(m[0]).join(`<script data-src="${rel}">\n${body}\n</script>`);
  }

  if (/<link\b[^>]*rel=["']stylesheet["']/i.test(html) || /<script\b[^>]*\ssrc=/i.test(html)) {
    throw new Error('Build invariant failed: external <link rel="stylesheet"> or <script src=...> still present.');
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, html, 'utf8');

  console.log(
    `Built ${path.relative(path.resolve(GAME_DIR, '../..'), OUT_FILE)} ` +
    `(${(Buffer.byteLength(html, 'utf8') / 1024).toFixed(1)} KB HTML, ` +
    `${Object.keys(assetsMap).length} asset keys, ` +
    `${Object.keys(compactManifest).length} anim manifest folders)`
  );
}

build();
