// 建物室內：以建物種子＋樓層做決定性 BSP 分割。一樓依店家類型擺設，樓上是公寓或辦公室。
// 輸出牆段（已切好門洞）、房間、家具與樓梯間，畫面層與碰撞共用。
import { mulberry32, pick } from './math.js';

const WALL = 0.16;
const DOOR = 1.1;

const ROOM_STYLE = {
  shop: { name: '店面', floor: 0xcdb89a, wall: 0xf3eee4 },
  back: { name: '後場', floor: 0x9aa1a8, wall: 0xe6e3dc },
  lobby: { name: '門廳', floor: 0xd8d2c4, wall: 0xefe9de },
  living: { name: '客廳', floor: 0xb98a5e, wall: 0xf1ebe0 },
  bed: { name: '臥室', floor: 0xa77b55, wall: 0xe7e4f0 },
  kitchen: { name: '廚房', floor: 0xd9d6cf, wall: 0xf5f1e8 },
  bath: { name: '浴室', floor: 0xcfdde3, wall: 0xf4f8f9 },
  office: { name: '辦公區', floor: 0x8e98a3, wall: 0xf2f3f4 },
  meeting: { name: '會議室', floor: 0x7d8792, wall: 0xe9eef2 },
  hall: { name: '走廊', floor: 0xc4bcae, wall: 0xf0ebe2 },
  stairs: { name: '樓梯間', floor: 0x9c9488, wall: 0xdedad2 },
  lodge: { name: '大廳', floor: 0x8a6545, wall: 0xc9a77f },
};

const FLOWER_COLS = [0xe11d48, 0xf59e0b, 0xfde047, 0xf472b6, 0xffffff, 0xa855f7, 0xfb7185, 0xef4444];

export function generateInterior(b, floor = 0) {
  const rnd = mulberry32((b.seed ^ Math.imul(floor + 1, 2654435761)) >>> 0);
  const x0 = b.x0 + 0.35;
  const x1 = b.x1 - 0.35;
  const z0 = b.z0 + 0.35;
  const z1 = b.z1 - 0.35;
  const floors = b.floors;
  const y = floor === 0 ? b.floor0 : b.floor0 + b.groundH + (floor - 1) * b.floorH;
  const height = floor === 0 ? b.groundH : b.floorH;
  const out = { building: b.id, floor, floors, y, height, x0, z0, x1, z1, rooms: [], walls: [], doors: [], furniture: [], lights: [], stairs: null, exit: null };

  // 樓梯間：放在背面角落（遠離店門）
  const front = b.front || 'n';
  const sw = Math.min(3.2, (x1 - x0) * 0.4);
  const sd = Math.min(5.2, (z1 - z0) * 0.4);
  const backZ = front === 's' ? z0 : z1 - sd;
  const leftX = rnd() < 0.5 ? x0 : x1 - sw;
  if (floors > 1) out.stairs = { x0: leftX, z0: backZ, x1: leftX + sw, z1: backZ + sd };

  // 門口
  if (floor === 0 && b.door) {
    out.exit = { x: b.door.x, z: b.door.z, side: b.door.side };
  }

  // 可分割區域
  const regions = [];
  const area = { x0, z0, x1, z1 };
  const isGround = floor === 0;
  const shop = isGround ? b.shop : null;

  if (isGround && shop) {
    // 店面佔前方 ~70%，後場在後面
    const depth = z1 - z0;
    const cut = front === 's' ? z0 + depth * 0.3 : z1 - depth * 0.3;
    const shopRoom = front === 's' ? { x0, z0: cut, x1, z1 } : { x0, z0, x1, z1: cut };
    const backRoom = front === 's' ? { x0, z0, x1, z1: cut } : { x0, z0: cut, x1, z1 };
    addRoom(out, shopRoom, shop.id === 'lodge' ? 'lodge' : 'shop', shop.name);
    addRoom(out, backRoom, 'back');
    wallWithDoor(out, x0, cut, x1, cut, rnd, out.stairs ? avoidX(out.stairs) : null);
    furnishShop(out, shopRoom, shop, front, rnd);
    furnishBack(out, backRoom, rnd);
  } else {
    const office = b.style === 'glass' || (b.style === 'stone' && b.floors > 10);
    if (isGround) {
      const depth = z1 - z0;
      const cut = front === 's' ? z0 + depth * 0.45 : z1 - depth * 0.45;
      const lobby = front === 's' ? { x0, z0: cut, x1, z1 } : { x0, z0, x1, z1: cut };
      const rest = front === 's' ? { x0, z0, x1, z1: cut } : { x0, z0: cut, x1, z1 };
      addRoom(out, lobby, 'lobby');
      furnishLobby(out, lobby, front, rnd);
      wallWithDoor(out, x0, cut, x1, cut, rnd, null);
      regions.push(rest);
    } else regions.push(area);
    for (const r of regions) bsp(out, r, 0, rnd, office);
  }

  // 外牆（不開門洞，店門由 exit 處理）
  const ext = [
    [x0, z0, x1, z0, 'n'],
    [x0, z1, x1, z1, 's'],
    [x0, z0, x0, z1, 'w'],
    [x1, z0, x1, z1, 'e'],
  ];
  for (const [ax, az, bx, bz, side] of ext) {
    if (isGround && side === front) {
      // 門洞置中
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      if (az === bz) {
        out.walls.push({ x0: ax, z0: az, x1: mx - DOOR * 0.7, z1: az, ext: true, glass: !!shop });
        out.walls.push({ x0: mx + DOOR * 0.7, z0: az, x1: bx, z1: az, ext: true, glass: !!shop });
      } else {
        out.walls.push({ x0: ax, z0: az, x1: ax, z1: mz - DOOR * 0.7, ext: true, glass: !!shop });
        out.walls.push({ x0: ax, z0: mz + DOOR * 0.7, x1: ax, z1: bz, ext: true, glass: !!shop });
      }
    } else out.walls.push({ x0: ax, z0: az, x1: bx, z1: bz, ext: true, windows: true });
  }

  if (out.stairs) {
    const s = out.stairs;
    out.rooms.push({ ...s, type: 'stairs', ...style('stairs') });
    out.furniture.push({ kind: 'stairs', x: (s.x0 + s.x1) / 2, z: (s.z0 + s.z1) / 2, w: s.x1 - s.x0 - 0.3, d: s.z1 - s.z0 - 0.3, h: height, rot: 0, color: 0x8d8478 });
  }

  // 天花板燈
  for (const r of out.rooms) {
    const cx = (r.x0 + r.x1) / 2;
    const cz = (r.z0 + r.z1) / 2;
    out.lights.push({ x: cx, z: cz });
  }
  // 家具不能擋樓梯
  if (out.stairs) {
    const s = out.stairs;
    out.furniture = out.furniture.filter((f) => f.kind === 'stairs' || !(f.x > s.x0 - 0.6 && f.x < s.x1 + 0.6 && f.z > s.z0 - 0.6 && f.z < s.z1 + 0.6));
  }
  return out;
}

function style(type) {
  const s = ROOM_STYLE[type];
  return { name: s.name, floorColor: s.floor, wallColor: s.wall };
}
function addRoom(out, r, type, name) {
  const st = style(type);
  out.rooms.push({ ...r, type, ...st, name: name || st.name });
}
function avoidX(s) {
  return [s.x0 - 0.4, s.x1 + 0.4];
}

// 沿一條直線放牆，中間切一個門洞
function wallWithDoor(out, ax, az, bx, bz, rnd, avoid) {
  const horiz = az === bz;
  const a = horiz ? ax : az;
  const b = horiz ? bx : bz;
  const len = b - a;
  if (len < DOOR + 0.8) {
    out.walls.push({ x0: ax, z0: az, x1: bx, z1: bz });
    return;
  }
  let c = a + 0.6 + DOOR / 2 + rnd() * (len - 1.2 - DOOR);
  if (avoid && horiz && c > avoid[0] - DOOR && c < avoid[1] + DOOR) c = avoid[0] - a > b - avoid[1] ? (a + avoid[0]) / 2 : (avoid[1] + b) / 2;
  const d0 = c - DOOR / 2;
  const d1 = c + DOOR / 2;
  if (horiz) {
    out.walls.push({ x0: a, z0: az, x1: d0, z1: az });
    out.walls.push({ x0: d1, z0: az, x1: b, z1: az });
    out.doors.push({ x: c, z: az, axis: 'x' });
  } else {
    out.walls.push({ x0: ax, z0: a, x1: ax, z1: d0 });
    out.walls.push({ x0: ax, z0: d1, x1: ax, z1: b });
    out.doors.push({ x: ax, z: c, axis: 'z' });
  }
}

function bsp(out, r, depth, rnd, office) {
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const minRoom = office ? 5.5 : 3.4;
  const canX = w > minRoom * 2;
  const canZ = d > minRoom * 2;
  const stop = depth >= (office ? 2 : 3) || (!canX && !canZ) || (depth > 1 && rnd() < 0.2 && w * d < 40);
  if (stop) {
    const type = office ? (w * d > 60 ? 'office' : pick(rnd, ['meeting', 'office'])) : pickResidential(rnd, w, d, depth);
    addRoom(out, r, type);
    furnishRoom(out, r, type, rnd);
    return;
  }
  const splitX = canX && (!canZ || w > d ? true : rnd() < 0.35);
  if (splitX) {
    const s = r.x0 + w * (0.38 + rnd() * 0.24);
    wallWithDoor(out, s, r.z0, s, r.z1, rnd);
    bsp(out, { ...r, x1: s }, depth + 1, rnd, office);
    bsp(out, { ...r, x0: s }, depth + 1, rnd, office);
  } else {
    const s = r.z0 + d * (0.38 + rnd() * 0.24);
    wallWithDoor(out, r.x0, s, r.x1, s, rnd);
    bsp(out, { ...r, z1: s }, depth + 1, rnd, office);
    bsp(out, { ...r, z0: s }, depth + 1, rnd, office);
  }
}

function pickResidential(rnd, w, d, depth) {
  const a = w * d;
  if (a < 9) return 'bath';
  if (a < 16) return pick(rnd, ['bath', 'kitchen', 'bed']);
  if (a > 34) return pick(rnd, ['living', 'living', 'bed']);
  return pick(rnd, ['bed', 'kitchen', 'living', 'bed']);
}

function F(out, kind, x, z, w, d, h, color, rot = 0, extra = {}) {
  out.furniture.push({ kind, x, z, w, d, h, color, rot, ...extra });
}

function furnishRoom(out, r, type, rnd) {
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const m = 0.55;
  switch (type) {
    case 'living': {
      const sofa = pick(rnd, [0x56677a, 0x8a5a44, 0x4d6b57, 0x9c8f7a]);
      F(out, 'rug', cx, cz, w * 0.5, d * 0.45, 0.02, pick(rnd, [0xc8a27a, 0x8296a8, 0xb5675a]));
      F(out, 'sofa', cx, r.z1 - m - 0.45, Math.min(2.2, w * 0.6), 0.9, 0.8, sofa);
      F(out, 'table', cx, cz, 1.1, 0.6, 0.42, 0x7a5a3c);
      F(out, 'tv', cx, r.z0 + 0.3, 1.4, 0.3, 1.1, 0x1f2328);
      F(out, 'plant', r.x0 + m, r.z0 + m, 0.5, 0.5, 1.2, 0x2f7d3b);
      if (w > 4) F(out, 'shelf', r.x1 - 0.3, cz, 0.4, 1.6, 1.9, 0x8a6a4a, Math.PI / 2);
      break;
    }
    case 'bed':
      F(out, 'bed', cx, r.z0 + 1.15, 1.6, 2.1, 0.55, pick(rnd, [0xe8e3d8, 0xa9b8c9, 0xd7b8a8]));
      F(out, 'nightstand', cx + 1.15, r.z0 + 0.45, 0.45, 0.45, 0.5, 0x8a6a4a);
      F(out, 'wardrobe', r.x1 - 0.35, r.z1 - 1.0, 0.6, 1.4, 2.0, 0xb79a76, Math.PI / 2);
      if (rnd() < 0.6) F(out, 'plant', r.x0 + m, r.z1 - m, 0.45, 0.45, 1.0, 0x3a7d44);
      break;
    case 'kitchen':
      F(out, 'counter', cx, r.z0 + 0.35, w - 0.6, 0.65, 0.92, 0xe7e2d8);
      F(out, 'fridge', r.x0 + 0.5, r.z0 + 0.45, 0.75, 0.7, 1.85, 0xdfe3e6);
      if (d > 3) {
        F(out, 'table', cx, cz + 0.4, 1.2, 0.8, 0.75, 0x9a7650);
        F(out, 'chair', cx - 0.8, cz + 0.4, 0.45, 0.45, 0.9, 0x5b4636);
        F(out, 'chair', cx + 0.8, cz + 0.4, 0.45, 0.45, 0.9, 0x5b4636);
      }
      break;
    case 'bath':
      F(out, 'tub', r.x0 + 0.85, cz, 0.75, Math.min(1.7, d - 0.4), 0.55, 0xf4f6f7);
      F(out, 'sink', r.x1 - 0.35, r.z0 + 0.5, 0.5, 0.45, 0.85, 0xf4f6f7);
      F(out, 'toilet', r.x1 - 0.4, r.z1 - 0.5, 0.45, 0.6, 0.75, 0xf4f6f7);
      break;
    case 'office': {
      for (let x = r.x0 + 1.4; x < r.x1 - 1.0; x += 2.6) {
        for (let z = r.z0 + 1.4; z < r.z1 - 1.0; z += 2.4) {
          F(out, 'desk', x, z, 1.5, 0.75, 0.74, 0xe9e5dc);
          F(out, 'monitor', x, z - 0.15, 0.6, 0.08, 0.42, 0x1b1f24, 0, { y: 0.74 });
          F(out, 'chair', x, z + 0.6, 0.5, 0.5, 0.9, 0x2b2f36);
        }
      }
      F(out, 'plant', r.x0 + m, r.z0 + m, 0.5, 0.5, 1.4, 0x2f7d3b);
      break;
    }
    case 'meeting':
      F(out, 'table', cx, cz, Math.max(1.2, w - 2.0), Math.max(0.9, d - 2.4), 0.74, 0x6e5a48);
      for (let x = r.x0 + 1.4; x < r.x1 - 1.0; x += 1.0) {
        F(out, 'chair', x, cz - Math.max(0.9, d - 2.4) / 2 - 0.4, 0.5, 0.5, 0.9, 0x2b2f36);
        F(out, 'chair', x, cz + Math.max(0.9, d - 2.4) / 2 + 0.4, 0.5, 0.5, 0.9, 0x2b2f36);
      }
      F(out, 'screen', cx, r.z0 + 0.12, Math.min(2.4, w - 1), 0.08, 1.3, 0x14181d, 0, { y: 0.9 });
      break;
    default:
      break;
  }
}

function frontEdge(r, front) {
  // 回傳店面靠街那一側 z 與往內的方向
  return front === 's' ? { z: r.z1, inward: -1 } : { z: r.z0, inward: 1 };
}

function furnishShop(out, r, shop, front, rnd) {
  const { z: fz, inward } = frontEdge(r, front);
  const backZ = inward > 0 ? r.z1 : r.z0;
  const cx = (r.x0 + r.x1) / 2;
  const w = r.x1 - r.x0;
  const deep = Math.abs(backZ - fz);
  const counterZ = backZ - inward * 0.9;
  const counter = (col = 0x6b4a8a) => {
    F(out, 'counter', r.x1 - Math.min(2.2, w * 0.3), counterZ, Math.min(2.8, w * 0.42), 0.7, 1.0, col);
    F(out, 'register', r.x1 - Math.min(2.2, w * 0.3), counterZ, 0.4, 0.35, 0.25, 0x2a2e33, 0, { y: 1.0 });
  };
  switch (shop.id) {
    case 'flower': {
      // 兩側階梯花架與一桶桶花
      for (const side of [-1, 1]) {
        const x = side < 0 ? r.x0 + 0.55 : r.x1 - 0.55;
        F(out, 'tier', x, (fz + backZ) / 2, 1.0, deep - 2.4, 0.9, 0xb8b2a6, Math.PI / 2);
        for (let t = fz + inward * 1.4; Math.abs(t - fz) < deep - 2.2; t += inward * 0.62) {
          for (const lv of [0, 1]) {
            F(out, 'flowers', x - side * lv * 0.4, t, 0.38, 0.38, 0.5 + lv * 0.3, pick(rnd, FLOWER_COLS), 0, { y: 0.3 + lv * 0.35 });
          }
        }
      }
      for (let k = 0; k < 4; k++) F(out, 'flowers', cx - 1 + k * 0.6, fz + inward * 1.2, 0.4, 0.4, 0.6, pick(rnd, FLOWER_COLS));
      F(out, 'plant', r.x0 + 1.2, backZ - inward * 0.6, 0.6, 0.6, 1.6, 0x2f7d3b);
      counter(0x6b4a8a);
      break;
    }
    case 'cafe':
    case 'pizza':
    case 'ramen':
    case 'deli':
    case 'bakery': {
      counter(shop.id === 'bakery' ? 0xc8a77a : 0x5a3e2b);
      if (shop.id === 'bakery' || shop.id === 'deli') F(out, 'display', cx - 0.8, counterZ, Math.min(2.4, w * 0.35), 0.7, 1.05, 0xdde6ea);
      F(out, 'shelf', cx, backZ - inward * 0.25, Math.min(3.5, w - 1), 0.4, 2.0, 0x7a5a3c);
      for (let x = r.x0 + 1.2; x < r.x1 - 2.6; x += 2.0) {
        for (let t = fz + inward * 1.5; Math.abs(t - fz) < deep - 2.6; t += inward * 2.0) {
          F(out, 'table', x, t, 0.75, 0.75, 0.74, 0x3b3f45);
          F(out, 'chair', x - 0.6, t, 0.42, 0.42, 0.85, 0x9a6b42);
          F(out, 'chair', x + 0.6, t, 0.42, 0.42, 0.85, 0x9a6b42);
        }
      }
      F(out, 'plant', r.x0 + 0.5, fz + inward * 0.5, 0.5, 0.5, 1.3, 0x2f7d3b);
      break;
    }
    case 'books':
    case 'records':
    case 'grocery':
    case 'pharmacy': {
      const col = shop.id === 'grocery' ? 0xd7d9db : shop.id === 'pharmacy' ? 0xf0f2f3 : 0x7a5a3c;
      for (let x = r.x0 + 1.2; x < r.x1 - 1.0; x += 2.0) {
        F(out, 'shelf', x, (fz + backZ) / 2 - inward * 0.3, 0.55, Math.max(1.2, deep - 3.6), 1.8, col, Math.PI / 2, { goods: shop.id });
      }
      for (const side of [-1, 1]) F(out, 'shelf', side < 0 ? r.x0 + 0.25 : r.x1 - 0.25, (fz + backZ) / 2, 0.4, deep - 2, 2.1, col, Math.PI / 2, { goods: shop.id });
      counter(0x3f4a55);
      break;
    }
    case 'laundry':
      for (let x = r.x0 + 0.8; x < r.x1 - 0.6; x += 0.95) F(out, 'washer', x, backZ - inward * 0.5, 0.8, 0.75, 1.0, 0xeef1f3);
      F(out, 'bench', cx, (fz + backZ) / 2, Math.min(3, w - 1.5), 0.45, 0.45, 0x8a6a4a);
      break;
    case 'bike':
    case 'surf':
      for (let x = r.x0 + 1; x < r.x1 - 1; x += 1.2) F(out, shop.id === 'surf' ? 'board' : 'bike', x, (fz + backZ) / 2, 0.3, 1.8, 1.1, pick(rnd, [0xdc2626, 0x2563eb, 0xf59e0b, 0x10b981, 0x111827]));
      counter(0x334155);
      break;
    case 'gallery':
      for (let x = r.x0 + 1.4; x < r.x1 - 1; x += 2.2) F(out, 'frame', x, backZ - inward * 0.06, 1.3, 0.06, 1.0, pick(rnd, [0xf59e0b, 0x2563eb, 0xdc2626, 0x10b981, 0x9333ea]), 0, { y: 1.1 });
      F(out, 'bench', cx, (fz + backZ) / 2, 2.2, 0.5, 0.45, 0x222222);
      break;
    case 'lodge':
      F(out, 'fireplace', r.x0 + 1.2, (fz + backZ) / 2, 0.9, 2.2, 2.4, 0x6b6b6b);
      for (let x = r.x0 + 4; x < r.x1 - 3; x += 4) {
        F(out, 'table', x, (fz + backZ) / 2, 2.4, 0.9, 0.76, 0x7a5232);
        F(out, 'bench', x, (fz + backZ) / 2 - 0.8, 2.4, 0.35, 0.45, 0x6a4a2c);
        F(out, 'bench', x, (fz + backZ) / 2 + 0.8, 2.4, 0.35, 0.45, 0x6a4a2c);
      }
      counter(0x5a3a22);
      break;
    default:
      counter();
  }
}

function furnishBack(out, r, rnd) {
  const cx = (r.x0 + r.x1) / 2;
  F(out, 'shelf', cx, (r.z0 + r.z1) / 2, Math.min(3, r.x1 - r.x0 - 1.5), 0.5, 2.0, 0x8b8f94);
  for (let k = 0; k < 3; k++) F(out, 'box', r.x0 + 0.8 + k * 0.7, r.z0 + 0.6 + rnd() * 0.4, 0.55, 0.55, 0.45 + rnd() * 0.3, 0xb08d5b);
}

function furnishLobby(out, r, front, rnd) {
  const { z: fz, inward } = frontEdge(r, front);
  const backZ = inward > 0 ? r.z1 : r.z0;
  F(out, 'mailbox', r.x0 + 0.3, (fz + backZ) / 2, 0.3, 1.6, 1.4, 0x8a7a5a, Math.PI / 2);
  F(out, 'bench', r.x1 - 1.5, (fz + backZ) / 2, 1.6, 0.45, 0.45, 0x5a4636);
  F(out, 'plant', r.x1 - 0.6, fz + inward * 0.7, 0.55, 0.55, 1.5, 0x2f7d3b);
  F(out, 'rug', (r.x0 + r.x1) / 2, fz + inward * 1.6, 1.8, 1.2, 0.02, pick(rnd, [0x7a2e2e, 0x2e4a7a]));
  F(out, 'elevator', (r.x0 + r.x1) / 2, backZ - inward * 0.1, 1.4, 0.12, 2.3, 0x9aa3ab);
}

// 室內碰撞：牆段當作細長方塊
export function collideInterior(layout, x, z, r) {
  x = Math.max(layout.x0 + r, Math.min(layout.x1 - r, x));
  z = Math.max(layout.z0 + r, Math.min(layout.z1 - r, z));
  const solids = [];
  for (const w of layout.walls) {
    if (w.z0 === w.z1) solids.push({ x0: Math.min(w.x0, w.x1), x1: Math.max(w.x0, w.x1), z0: w.z0 - WALL, z1: w.z0 + WALL });
    else solids.push({ x0: w.x0 - WALL, x1: w.x0 + WALL, z0: Math.min(w.z0, w.z1), z1: Math.max(w.z0, w.z1) });
  }
  for (const f of layout.furniture) {
    if (['rug', 'stairs', 'register', 'monitor', 'frame', 'screen', 'flowers'].includes(f.kind) || f.h < 0.3) continue;
    const rot = Math.abs(Math.sin(f.rot || 0)) > 0.7;
    const hw = (rot ? f.d : f.w) / 2;
    const hd = (rot ? f.w : f.d) / 2;
    solids.push({ x0: f.x - hw, x1: f.x + hw, z0: f.z - hd, z1: f.z + hd });
  }
  for (const s of solids) {
    const cx = Math.max(s.x0, Math.min(x, s.x1));
    const cz = Math.max(s.z0, Math.min(z, s.z1));
    const dx = x - cx;
    const dz = z - cz;
    const d = Math.hypot(dx, dz);
    if (d < r && d > 1e-5) {
      x = cx + (dx / d) * r;
      z = cz + (dz / d) * r;
    }
  }
  return { x, z };
}
