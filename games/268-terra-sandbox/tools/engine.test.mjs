// 規則層測試：跑 src/core/selftest.js 的全部項目（頁面「測試」分頁跑的是同一份）
import test from 'node:test';
import assert from 'node:assert/strict';
import { runSelfTests } from '../src/core/selftest.js';

const report = runSelfTests();
for (const r of report.results) {
  test(`${r.stage} · ${r.name}`, () => {
    assert.ok(r.passed, r.detail);
  });
}
