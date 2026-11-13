import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME_DIR = path.resolve(HERE, '..');
const SRC_ROOT = process.env.LINEAGE_SRC || '/Users/xieyuanyou/Documents/lineage/app';
const OUT_ASSETS_DIR = path.resolve(GAME_DIR, '../../assets/284');
const OUT_MAP_FILE = path.join(GAME_DIR, 'src/assets-map.json');
const FFMPEG = process.env.FFMPEG_BIN || '/opt/homebrew/bin/ffmpeg';

function isValidMedia(ext, buf) {
  if (!buf || buf.length < 4) return false;
  switch (ext) {
    case '.png':
      return buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    case '.jpg':
    case '.jpeg':
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case '.gif': {
      const h = buf.subarray(0, 6).toString('ascii');
      return h === 'GIF87a' || h === 'GIF89a';
    }
    case '.webp':
      return buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP';
    case '.wav':
      return buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WAVE';
    case '.ogg':
      return buf.subarray(0, 4).toString('ascii') === 'OggS';
    case '.mp3':
      return buf.subarray(0, 3).toString('ascii') === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0);
    default:
      return false;
  }
}

function collectFiles(baseDir, stripRoot) {
  const out = [];
  if (!fs.existsSync(baseDir)) return out;
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name.startsWith('.')) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile()) {
        const rel = path.relative(stripRoot, full).split(path.sep).join('/');
        out.push({ rel, full });
      }
    }
  }
  walk(baseDir);
  return out;
}

function asciiRelFor(logicalRel, outExt) {
  const base = logicalRel.slice(0, logicalRel.length - path.extname(logicalRel).length) + outExt;
  if (/^[A-Za-z0-9_./-]+$/.test(base)) return base;
  const hash = createHash('sha1').update(logicalRel).digest('hex').slice(0, 12);
  return `m/${hash}${outExt}`;
}

const candidates = new Map();
for (const [sub, strip] of [
  [path.join(SRC_ROOT, '.asset-cache'), path.join(SRC_ROOT, '.asset-cache')],
  [path.join(SRC_ROOT, 'public'), SRC_ROOT],
  [path.join(SRC_ROOT, 'assets'), SRC_ROOT],
]) {
  for (const f of collectFiles(sub, strip)) {
    candidates.set(f.rel, f.full);
  }
}

fs.rmSync(OUT_ASSETS_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_ASSETS_DIR, { recursive: true });

const validDirect = new Map();
const needConvert = [];
let skippedInvalid = 0;

for (const [rel, full] of [...candidates.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const ext = path.extname(rel).toLowerCase();
  const buf = fs.readFileSync(full);
  if (!isValidMedia(ext, buf)) {
    skippedInvalid++;
    continue;
  }
  if (ext === '.ogg' || ext === '.gif') {
    needConvert.push({ rel, full, ext });
  } else {
    validDirect.set(rel, { full, ext });
  }
}

const assetsMap = Object.create(null);
let copied = 0;
let converted = 0;
let deduped = 0;

for (const [rel, info] of validDirect.entries()) {
  const asciiRel = asciiRelFor(rel, info.ext);
  const dest = path.join(OUT_ASSETS_DIR, asciiRel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(info.full, dest);
  assetsMap[rel] = `../assets/284/${asciiRel}`;
  copied++;
}

for (const item of needConvert) {
  const stem = item.rel.slice(0, item.rel.length - item.ext.length);
  if (item.ext === '.ogg') {
    const mp3Key = `${stem}.mp3`;
    if (assetsMap[mp3Key]) {
      assetsMap[item.rel] = assetsMap[mp3Key];
      deduped++;
      continue;
    }
    const asciiRel = asciiRelFor(item.rel, '.mp3');
    const dest = path.join(OUT_ASSETS_DIR, asciiRel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', item.full, '-codec:a', 'libmp3lame', '-qscale:a', '4', dest]);
    assetsMap[item.rel] = `../assets/284/${asciiRel}`;
    assetsMap[mp3Key] = `../assets/284/${asciiRel}`;
    converted++;
  } else if (item.ext === '.gif') {
    const pngKey = `${stem}.png`;
    const asciiRel = asciiRelFor(item.rel, '.png');
    const dest = path.join(OUT_ASSETS_DIR, asciiRel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', item.full, '-f', 'apng', '-plays', '0', dest]);
    assetsMap[item.rel] = `../assets/284/${asciiRel}`;
    assetsMap[pngKey] = `../assets/284/${asciiRel}`;
    converted++;
  }
}

const sortedMap = Object.create(null);
for (const k of Object.keys(assetsMap).sort()) sortedMap[k] = assetsMap[k];
fs.writeFileSync(OUT_MAP_FILE, JSON.stringify(sortedMap, null, 2) + '\n', 'utf8');

let badNames = 0;
for (const val of new Set(Object.values(sortedMap))) {
  const rel = val.replace(/^\.\.\/assets\/284\//, '');
  if (!/^[A-Za-z0-9_./-]+$/.test(rel)) badNames++;
}

console.log(
  `prepare-assets done: copied=${copied}, converted=${converted}, deduped=${deduped}, skippedInvalid=${skippedInvalid}, mappedKeys=${Object.keys(sortedMap).length}, badAsciiNames=${badNames}`,
);
if (badNames > 0) process.exit(1);
