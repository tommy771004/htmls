// ABI 煙霧測試：用 node 載入 release wasm，跑完整一場 4 台 AI 比賽並印出圈速
// 用法：cargo build --release --target wasm32-unknown-unknown && cargo test（產生合成賽道）&& node tests/abi_smoke.mjs [track.bin]
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const core = join(here, '..');
const wasmPath = join(core, 'target/wasm32-unknown-unknown/release/sidewinder_core.wasm');
const bytes = readFileSync(wasmPath);

const mod = await WebAssembly.compile(bytes);
const imports = WebAssembly.Module.imports(mod);
if (imports.length) {
  console.error('wasm 不該有匯入：', imports);
  process.exit(1);
}
const need = ['memory', 'sw_alloc', 'sw_load_track', 'sw_set_truck', 'sw_race_start', 'sw_set_input', 'sw_step',
  'sw_state_ptr', 'sw_state_len', 'sw_events_ptr', 'sw_events_count', 'sw_events_clear', 'sw_upgrade_stat'];
const names = WebAssembly.Module.exports(mod).map((e) => e.name);
const missing = need.filter((n) => !names.includes(n));
if (missing.length) {
  console.error('缺少匯出：', missing);
  process.exit(1);
}
const { exports: x } = await WebAssembly.instantiate(mod, {});
console.log(`wasm ${(statSync(wasmPath).size / 1024).toFixed(1)} KB，匯出 ${names.join(', ')}`);

// 賽道：參數 > blender/out/track_*.bin > cargo test 產生的合成賽道
const cands = process.argv.slice(2);
if (!cands.length) {
  for (let n = 0; n < 4; n++) {
    const p = join(core, `../blender/out/track_${n}.bin`);
    if (existsSync(p)) cands.push(p);
  }
  for (const f of ['serpent_track.bin', 'synth_track.bin']) {
    const p = join(core, 'target', f);
    if (existsSync(p)) cands.push(p);
  }
}
if (!cands.length) {
  console.error('找不到賽道檔；先跑 cargo test 產生 target/synth_track.bin');
  process.exit(1);
}

const mem = () => x.memory.buffer;
const state = () => new Float32Array(mem(), x.sw_state_ptr(), x.sw_state_len());
const EVN = { 1: '倒數', 2: '起跑', 3: '起跳', 4: '落地', 5: '濺水', 6: '泥地', 7: '互撞', 8: '撞牆', 9: '氮氣', 10: '道具', 11: '一圈', 12: '完賽', 13: '最後一圈', 14: '超車' };

let fail = false;
for (const path of cands) {
  const buf = readFileSync(path);
  const ptr = x.sw_alloc(buf.length);
  new Uint8Array(mem(), ptr, buf.length).set(buf);
  const rc = x.sw_load_track(ptr, buf.length);
  if (rc !== 0) {
    console.error(`${path}: sw_load_track = ${rc}`);
    fail = true;
    continue;
  }
  const skills = [0.3, 0.5, 0.7, 1.0];
  skills.forEach((sk, i) => x.sw_set_truck(i, 1, 0, 0, 0, 0, sk));
  x.sw_race_start(42, 4);
  if (x.sw_state_len() !== 176) throw new Error('state len');
  const counts = {};
  const laps = [[], [], [], []];
  let steps = 0;
  const t0 = performance.now();
  while (state()[0] !== 3 && steps < 120 * 240) {
    x.sw_step(1 / 120);
    steps++;
    const n = x.sw_events_count();
    if (n) {
      const e = new Float32Array(mem(), x.sw_events_ptr(), n * 4);
      for (let k = 0; k < n; k++) {
        const ty = e[k * 4];
        counts[EVN[ty] || ty] = (counts[EVN[ty] || ty] || 0) + 1;
        if (ty === 11) laps[e[k * 4 + 1]].push(state()[16 + 32 * e[k * 4 + 1] + 23]);
      }
      x.sw_events_clear();
    }
    const s = state();
    for (let v = 0; v < s.length; v++) if (!Number.isFinite(s[v])) throw new Error(`NaN at ${v}`);
  }
  const ms = performance.now() - t0;
  const s = state();
  console.log(`\n${path.split('/').slice(-2).join('/')}：phase ${s[0]}，比賽時間 ${s[1].toFixed(1)} s，${steps} 步 ${ms.toFixed(0)} ms`);
  for (let k = 0; k < 4; k++) {
    const o = 16 + 32 * k;
    console.log(`  車 ${k} skill ${skills[k]}：名次 ${s[o + 15]}，完賽 ${s[o + 21].toFixed(2)} s，最佳圈 ${s[o + 22].toFixed(2)}，圈速 ${laps[k].map((v) => v.toFixed(2)).join(' / ')}，獎金 ${s[o + 24]}，氮氣剩 ${s[o + 18]}`);
  }
  console.log('  事件：', JSON.stringify(counts));
  if (s[0] !== 3) fail = true;
}
console.log('\n升級：', [0, 1, 2, 3].map((k) => [0, 5].map((l) => x.sw_upgrade_stat(k, l).toFixed(2)).join('→')).join('，'));
process.exit(fail ? 1 : 0);
