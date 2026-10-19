// Node 測試用：建一個特技場世界、放一台車、照輸入函式跑幾個 tick。
import RAPIER from '@dimforge/rapier3d-compat';
import { TICK, G_WORLD, groups } from '../src/core/const.js';
import { newWorld, buildParkPhysics } from '../src/core/world.js';
import { makeCar, stepCar, placeCar, emptyInput, carAxes } from '../src/core/car.js';

let ready = null;
export async function initRapier() {
  if (!ready) {
    // 新版 compat 在 init() 時會印一行棄用警告，測試時不需要
    const warn = console.warn; console.warn = () => {};
    ready = RAPIER.init().finally(() => { console.warn = warn; });
  }
  await ready;
  return RAPIER;
}

export async function parkSim() {
  const R = await initRapier();
  const world = newWorld(R);
  const park = buildParkPhysics(R, world);
  const car = makeCar(R, world);
  const rayGroups = groups(0xffff, G_WORLD);
  const events = [];
  const sim = {
    R, world, park, car, events, t: 0,
    place(x, y, z, yaw, speed = 0) { placeCar(car, x, y, z, yaw, speed); },
    step(input = {}, n = 1, each) {
      for (let i = 0; i < n; i++) {
        Object.assign(car.state.input, emptyInput(), typeof input === 'function' ? input(sim) : input);
        stepCar(world, car, TICK, rayGroups, events);
        world.step();
        sim.t += TICK;
        if (each && each(sim) === false) return false;
      }
      return true;
    },
    pos() { const p = car.body.translation(); return { x: p.x, y: p.y, z: p.z }; },
    vel() { const v = car.body.linvel(); return { x: v.x, y: v.y, z: v.z }; },
    speed() { const v = car.body.linvel(); return Math.hypot(v.x, v.y, v.z); },
    axes() { const o = { fwd: null }; const q = carAxes(car.body); return q; },
    up() { const r = car.body.rotation(); const x = r.x, y = r.y, z = r.z, w = r.w; return { x: 2 * (x * y - w * z), y: 1 - 2 * (x * x + z * z), z: 2 * (y * z + w * x) }; },
  };
  return sim;
}
