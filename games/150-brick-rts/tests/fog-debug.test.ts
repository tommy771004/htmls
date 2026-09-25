import test from 'node:test';
import assert from 'node:assert/strict';
import {fogCellSummary} from '../apps/web/fog-debug.ts';
test('fog inspector uses only observed building memory and retains its timestamp',()=>{
 const view={tick:100,fog:Array(256).fill(0),known:[{obstacle:{kind:'house' as const,x:1100,y:400,red:true},lastSeenTick:42}]};
 assert.equal(fogCellSummary(view,11,4),'格 (11, 4) · 未探索 · 投影 tick 100');view.fog[75]=1;
 assert.match(fogCellSummary(view,11,4),/最後看見 tick 42（58 ticks 前）/);view.tick=101;assert.match(fogCellSummary(view,11,4),/tick 42（59 ticks 前）/);
 assert.doesNotMatch(fogCellSummary(view,10,4),/住宅/);for(const x of [-1,16,NaN,1.2])assert.match(fogCellSummary(view,x,4),/整數/);
});
