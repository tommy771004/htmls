// 規則層測試：跑 src/core/selftest.js 的全部項目（頁面「測試」分頁跑的是同一份）
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { runSelfTests } from '../src/core/selftest.js';
import { registerOsm } from '../src/core/osm.js';

// 頁面啟動時會把內嵌的 data/osm/*.json 登錄進來；Node 直接讀檔
const osmDir = new URL('../data/osm/', import.meta.url);
for (const f of readdirSync(osmDir).filter((x) => x.endsWith('.json'))) registerOsm(f.slice(0, -5), JSON.parse(readFileSync(new URL(f, osmDir), 'utf8')));

const report = runSelfTests();
for (const r of report.results) {
  test(`${r.stage} · ${r.name}`, () => {
    assert.ok(r.passed, r.detail);
  });
}
