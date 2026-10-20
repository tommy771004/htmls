import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STEPS,
  GATES,
  createWorld,
  stepWorld,
  getMetrics,
  dispatchVehicleToFlight,
  setFlightPriority,
  reassignFlightGate,
  triggerSampleDelay,
} from '../src/sim.js';

test('Groundline 6-step turnaround pipeline and initial 5-gate state', () => {
  assert.deepEqual(
    STEPS.map((s) => s.label),
    ['到站', '下客', '清潔', '加油', '登機', '推出']
  );
  assert.equal(GATES.length, 5);

  const w = createWorld(26701);
  const m = getMetrics(w);
  assert.equal(m.activeGates, 5);
  assert.ok(m.onTimeRate > 50 && m.onTimeRate <= 100);
  assert.ok(m.avgTurnaround >= 30 && m.avgTurnaround <= 60);
  assert.ok(m.totalBags > 1000);

  // GL-101 初始有 +6m 延誤，連鎖影響後續同在 G1 的 GL-201
  const gl201 = w.flights.find((f) => f.callsign === 'GL-201');
  assert.ok(gl201.cascadeDelay > 0, 'GL-201 應顯示受 GL-101 連鎖延誤影響');
  assert.equal(gl201.cascadeFrom, 'GL-101');
});

test('Vehicle dispatch, priority boost, gate reassignment, and full turnaround completion', () => {
  const w = createWorld(26701);

  // 提高 GL-101 優先級並指派 FT-02 加油車支援
  assert.equal(setFlightPriority(w, 'GL-101', 3), true);
  assert.equal(w.flights[0].priority, 3);
  assert.equal(dispatchVehicleToFlight(w, 'FT-02', 'GL-101', true), true);

  // 手動觸發一次延誤事件並確認連鎖延誤更新
  triggerSampleDelay(w, 'SK-102');
  const sk202 = w.flights.find((f) => f.callsign === 'SK-202');
  assert.ok(sk202.cascadeDelay > 0, 'SK-102 延誤後應連鎖影響同在 G2 的 SK-202');

  // 推進模擬 60 分鐘，驗證航班能走完 到站→下客→清潔→加油→登機→推出 並離場
  for (let i = 0; i < 120; i++) {
    stepWorld(w, 0.5);
  }
  const departed = w.flights.filter((f) => f.state === 'departed');
  assert.ok(departed.length >= 4, `至少 4 架第一波航班應已完成推出離場（實際 ${departed.length}）`);

  // 測試將後續航班改派至其他登機門
  const pending = w.flights.find((f) => f.state === 'scheduled' || f.state === 'holding');
  if (pending) {
    const altGate = GATES.find((g) => g.id !== pending.gateId).id;
    assert.equal(reassignFlightGate(w, pending.id, altGate), true);
    assert.equal(pending.gateId, altGate);
  }
});
