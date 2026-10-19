// Rapier 世界：特技場（地面、四周圍牆、地物三角網格、方塊障礙）。不碰 DOM。
import { GRAVITY, TICK, G_WORLD, groups } from './const.js';
import { PARK, buildPark } from './park.js';
import { mergeMeshes } from './geom.js';

export function newWorld(R) {
  const world = new R.World({ x: 0, y: -GRAVITY, z: 0 });
  world.timestep = TICK;
  world.numSolverIterations = 4;
  return world;
}

export function fixedCollider(R, world, desc, friction = 0.5, restitution = 0.1) {
  return world.createCollider(desc.setFriction(friction).setRestitution(restitution)
    .setCollisionGroups(groups(G_WORLD, 0xffff)));
}

export function trimeshCollider(R, world, mesh) {
  return fixedCollider(R, world, R.ColliderDesc.trimesh(mesh.positions, mesh.indices, R.TriMeshFlags.FIX_INTERNAL_EDGES));
}

export function cuboidCollider(R, world, x, y, z, hx, hy, hz, yaw = 0) {
  return fixedCollider(R, world, R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z)
    .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }));
}

// 建立特技場的碰撞體，回傳 park（畫面要用同一份幾何）
export function buildParkPhysics(R, world, park = buildPark()) {
  const H = PARK.HALF;
  cuboidCollider(R, world, 0, -5, 0, H + 40, 5, H + 40);
  // 四周圍牆
  const wh = PARK.WALL_H;
  cuboidCollider(R, world, 0, wh / 2, H + 1, H + 2, wh / 2, 1);
  cuboidCollider(R, world, 0, wh / 2, -H - 1, H + 2, wh / 2, 1);
  cuboidCollider(R, world, H + 1, wh / 2, 0, 1, wh / 2, H + 2);
  cuboidCollider(R, world, -H - 1, wh / 2, 0, 1, wh / 2, H + 2);
  for (const p of park.pieces) trimeshCollider(R, world, mergeMeshes([p.top, p.side]));
  for (const b of park.boxes) cuboidCollider(R, world, b.x, b.y, b.z, b.hx, b.hy, b.hz, b.yaw);
  return park;
}
