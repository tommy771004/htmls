// ─── 武裝直升機（neon_nightcity_gta_v_2.md 搶劫第三節：強攻路線的逃亡載具是「重型防彈裝甲車 + 河岸邊預藏的武裝直升機」） ───
// 玩家可以開：W／S 前進後退、A／D 轉向、Space 爬升、Shift 下降；左鍵（觸控的開火鍵）從兩側火箭莢發射，對準準星的落點。
// 它是 vehicles 裡 fly: true 的載具：99-main.js 開的時候換成 flyHeli，相機拉遠；沒人開時停在原地或往下掉。
// 模型是 traffic.glb 的 AH-64（gunship／gunship_rotor／gunship_tail，PolyDucky 的 CC BY 模型，tools/traffic.mjs 烘的）；
// 沒有這組節點（舊的 traffic.glb）時退回警用直升機機身加程式建模的火箭莢與機鼻機砲。69-police.js 的 partMesh 在函式裡才用。

const GS = { list: [], fireT: 0, side: 1, rk: 16, rkT: 0 };
const GS_RK = 16, GS_RELOAD = 4;
const GS_GLB = !!TRAFFIC_GEO.gunship;
const GS_IDS = GS_GLB ? ['gunship', 'gunship_rotor', 'gunship_tail'] : ['heli', 'heli_rotor', 'heli_tail'];
const GS_POD = GS_GLB ? [2.05, 1.1, 3.4] : [1.45, -.3, 1.2];   // 火箭莢的口（機身座標，x 取左右；AH-64 是短翼下兩組四聯莢的中間）
// 屋頂高度：22-hmap.js 的日光陰影高度圖（世界座標，1.25 m 一格，含實體建築模型）
function roofH(x, z) {
  if ((x - HELIPAD.x) ** 2 + (z - HELIPAD.z) ** 2 < 56) return groundH(x, z) + .13;   // 停機坪的水泥台（下面的 HELIPAD）
  const i = hmI(x), j = hmJ(z);
  if (i < 0 || j < 0 || i >= HM.n || j >= HM.n) return HM_NONE;
  return HM.h[j * HM.n + i];
}
function gunshipKit() {
  const k = new Kit(), dark = 0x22252a, olive = 0x3a4030;
  for (const s of [-1, 1]) {
    k.box(s * 1.05, -.15, .3, .9, .08, .5, dark, 2);   // 短翼
    k.cyl(s * 1.45, -.3, .4, .2, .2, 1.3, 10, olive, 2, Math.PI / 2);   // 火箭莢
    for (let a = 0; a < 6; a++) k.cyl(s * 1.45 + Math.cos(a) * .1, -.3 + Math.sin(a) * .1, 1.06, .035, .035, .02, 6, 0x111111, 2, Math.PI / 2);
  }
  k.cyl(0, -.55, 2.1, .09, .09, .5, 8, dark, 15, Math.PI / 2).box(0, -.42, 1.9, .3, .22, .3, dark, 2);   // 機鼻機砲
  return k.build();
}
// o.kind：'police'／'med' 是 69-v5-civic.js 屋頂停機坪的直升機（警用直升機機身、沒有火箭莢；醫療機身漆成白色加紅十字）
function buildGunship(x, z, yaw, o = {}) {
  const g = new T.Group(), body = new T.Group(), ids = o.kind ? ['heli', 'heli_rotor', 'heli_tail'] : GS_IDS;
  const [hull, rotor, tail] = ids.map(id => partMesh(id, 1, true));
  for (const m of [hull, rotor, tail]) { scene.remove(m); body.add(m); m.count = 1; }
  rotor.material = tail.material = hull.material;
  if (!GS_GLB && !o.kind) body.add(new T.Mesh(gunshipKit(), MAT.uber));
  if (o.kind) heliPaint(hull, body, o.kind);
  g.add(body); scene.add(g);
  const geo = TRAFFIC_GEO[ids[0]] ? TRAFFIC_GEO[ids[0]].geo : null;
  if (geo && !geo.boundingBox) geo.computeBoundingBox();
  const bb = geo ? geo.boundingBox : { min: { x: -1.3, y: 0, z: -5 }, max: { x: 1.3, y: 3, z: 5 } };
  const len = bb.max.z - bb.min.z, w = bb.max.x - bb.min.x;
  const v = {
    kind: 'gunship', fly: true, isCar: true, name: o.kind === 'med' ? '醫療直升機 · 白鷺' : o.kind ? '警用直升機 · 夜巡' : GS_GLB ? '武裝直升機 · 沙隼' : '武裝直升機 · 灰鷺', ids, rockets: !o.kind, g, body, mat: hull.material, wheels: [], hull, rotor, tail, seat: null,
    x, z, y: Math.max(groundH(x, z), roofH(x, z) + .05), yaw, vx: 0, vz: 0, vy: 0, yr: 0, steer: 0, spin: 0, roll: 0, pitch: 0, lean: 0, rot: 0, spool: 0,
    len, w, h: bb.max.y - bb.min.y, rad: 1.5, off: len * .25, wb: 3, wr: .4, vmax: 46, eng: 12, grip: 4, mass: 5200, hp: 2600, hpMax: 2600, hpLock: 1, lights: 0, gear: 1, rpm: .2,
  };
  vehicles.push(v);
  GS.list.push(v);
  gunshipPose(v);
  return v;
}
// 屋頂停機坪的直升機重新上漆：原本的紅色機身漆改成醫療白或警用深藍，兩側加紅十字或白色腰線
function heliPaint(hull, body, kind) {
  const c = hull.geometry.attributes.color, to = kind === 'med' ? [.8, .81, .82] : [.012, .03, .09];
  if (c) for (let i = 0; i < c.count; i++) { const r = c.getX(i), g = c.getY(i), b = c.getZ(i); if (r > .08 && r > g * 2.2 && r > b * 2.2) c.setXYZ(i, ...to); }
  const k = new Kit();
  if (kind === 'med') for (const s of [-1, 1]) k.box(s * .99, .95, .4, .02, .6, .18, 0xd81e2c, 11).box(s * .99, .95, .4, .02, .18, .6, 0xd81e2c, 11);
  else for (const s of [-1, 1]) k.box(s * .97, .7, .2, .02, .14, 2.6, 0xe8ecf0, 2);
  body.add(new T.Mesh(k.build(), MAT.uber));
}
function dropGunship(v) {
  if (player.veh === v) exitVehicle();
  const i = vehicles.indexOf(v); if (i >= 0) vehicles.splice(i, 1);
  GS.list.splice(GS.list.indexOf(v), 1);
  scene.remove(v.g);
  for (const m of [v.hull, v.rotor, v.tail]) m.geometry.dispose();
  v.hull.material.dispose();
}
function gunshipPose(v) {
  const set = (m, p, e) => { m.setMatrixAt(0, _pm4.compose(_pp.set(p[0], p[1], p[2]), _pq4.setFromEuler(e), _one)); m.instanceMatrix.needsUpdate = true; };
  set(v.hull, [0, 0, 0], _pe4.set(0, 0, 0));
  set(v.rotor, piv(v.ids[1]), _pe4.set(0, v.rot, 0));
  set(v.tail, piv(v.ids[2]), _pe4.set(v.rot * 1.6, 0, 0));
}
// 99-main.js 開直升機時呼叫（代替 driveVehicle）；回傳 { imp, vF, aF } 和車一樣
function flyHeli(v, inp, dt) {
  v.spool = Math.min(1, v.spool + dt / 1.6);   // 旋翼轉到全速才離地
  const lift = v.spool >= 1 && !v.dead;
  const gnd = Math.max(groundH(v.x, v.z), roofH(v.x, v.z) + .05, player.where === 'out' && waterDepth(v.x, v.z) > 0 ? SEA_Y + .5 : -1e9);
  const air = v.y - gnd > .4;
  // 爬升／下降
  const wantVy = lift ? (inp.hb ? 9 : 0) - (inp.nitro ? 7 : 0) + (air && !inp.hb && !inp.nitro ? 0 : 0) : -6;
  v.vy = damp(v.vy, wantVy, lift ? 2.2 : .6, dt);
  // 前後推力（機身前傾）、轉向；在地上不能平移
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  let aF = 0;
  if (air) {
    aF = (inp.thr - inp.brk * .7) * v.eng;
    v.vx += fx * aF * dt; v.vz += fz * aF * dt;
    const dr = Math.exp(-.32 * dt); v.vx *= dr; v.vz *= dr;
    // 側向速度慢慢收掉（不會像車子一樣抓地）
    const rx = -fz, rz = fx, vR = v.vx * rx + v.vz * rz, kR = 1 - Math.exp(-1.4 * dt);
    v.vx -= rx * vR * kR; v.vz -= rz * vR * kR;
    const sp = Math.hypot(v.vx, v.vz); if (sp > v.vmax) { v.vx *= v.vmax / sp; v.vz *= v.vmax / sp; }
    v.yr = damp(v.yr, inp.steer * 1.4, 4, dt);
  } else { v.vx *= Math.exp(-6 * dt); v.vz *= Math.exp(-6 * dt); v.yr = damp(v.yr, 0, 6, dt); }
  v.yaw += v.yr * dt;
  // 移動：撞到樓的側面就彈回來（高度圖比機身底還高）
  const ox = v.x, oz = v.z;
  v.x += v.vx * dt; v.z += v.vz * dt;
  let imp = 0;
  const wall = roofH(v.x, v.z) > v.y + .6 || roofH(v.x + fx * v.len * .4, v.z + fz * v.len * .4) > v.y + .6;
  if (wall) { imp = Math.hypot(v.vx, v.vz); v.x = ox; v.z = oz; v.vx *= -.3; v.vz *= -.3; if (imp > 4) damageVeh(v, (imp - 4) * 40, false); }
  v.y += v.vy * dt;
  v.y = Math.min(v.y, 290);   // 升限要高過霓峰塔的屋頂（202 m，69-v5-tower.js）
  const floor = Math.max(groundH(v.x, v.z), roofH(v.x, v.z) + .05);
  if (v.y < floor) { if (v.vy < -7) { imp = Math.max(imp, -v.vy); damageVeh(v, (-v.vy - 7) * 120, false); } v.y = floor; v.vy = Math.max(0, v.vy); }
  // 姿態：加速前傾、轉彎側傾
  const vF = v.vx * fx + v.vz * fz;
  v.pitch = damp(v.pitch, clamp(aF * .018, -.2, .22), 3, dt);
  v.roll = damp(v.roll, clamp(-v.yr * .22, -.25, .25), 3, dt);
  v.rot += dt * 34 * v.spool;
  v.rpm = .3 + .6 * v.spool; v.gear = 1; v.brakeOn = 0; v.slip = 0;
  return { imp, vF, aF };
}
// 每幀：沒人開的直升機停著或往下掉、旋翼慢下來；開火冷卻與火箭莢裝填；擺旋翼
// 手機的 Space／Shift 按鈕：開直升機時是爬升／下降
let gsTouch = null;
function gunshipTouch(fly) {
  if (gsTouch === fly) return;
  gsTouch = fly;
  for (const [k, a, b] of [['Space', '手煞', '爬升'], ['ShiftLeft', '氮氣', '下降']]) { const e = document.querySelector(`#tbtn button[data-k="${k}"]`); if (e) e.textContent = fly ? b : a; }
}
function gunshipStep(dt) {
  gunshipTouch(!!(player.veh && player.veh.fly));
  GS.fireT -= dt;
  if (GS.rk <= 0 && (GS.rkT -= dt) <= 0) { GS.rk = GS_RK; toast('火箭莢裝填完成'); }
  for (const v of [...GS.list]) {
    if (!vehicles.includes(v)) { GS.list.splice(GS.list.indexOf(v), 1); continue; }
    if (player.veh !== v) {
      v.spool = Math.max(0, v.spool - dt / 6);
      const floor = Math.max(groundH(v.x, v.z), roofH(v.x, v.z) + .05);
      if (v.y > floor + .01) { v.vy -= 9.8 * dt; v.y += v.vy * dt; if (v.y <= floor) { if (v.vy < -8 && !v.dead) damageVeh(v, 1e5, false); v.y = floor; v.vy = 0; } }
      v.rot += dt * 34 * v.spool;
      v.pitch = damp(v.pitch, 0, 2, dt); v.roll = damp(v.roll, 0, 2, dt);
    } else if (arm.trig && player.mode === 'drive') gunshipFire();
    gunshipPose(v);
  }
}
// 左鍵：左右火箭莢輪流發射，飛向準星指著的地方
function gunshipFire() {
  const v = player.veh;
  if (!v || !v.fly || !v.rockets || GS.fireT > 0 || life.dead) return;
  if (GS.rk <= 0) { sfx.dry(); return; }
  GS.fireT = .32; GS.rk--; GS.side = -GS.side;
  if (GS.rk <= 0) { GS.rkT = GS_RELOAD; toast(`火箭莢打空了：${GS_RELOAD} 秒後裝填`); }
  const R0 = aimRay(), hit = castRay(R0, 320, v), t = hit.kind ? hit.t : 320;
  const c = Math.cos(v.yaw), s = Math.sin(v.yaw), lx = GS.side * GS_POD[0], lz = GS_POD[2];
  const mx = v.x + lx * c + lz * s, my = v.y + GS_POD[1], mz = v.z - lx * s + lz * c;
  _ad.set(R0.ox + R0.dx * t - mx, R0.oy + R0.dy * t - my, R0.oz + R0.dz * t - mz).normalize();
  launch('rocket', mx, my, mz, _ad.x * 60 + v.vx, _ad.y * 60, _ad.z * 60 + v.vz, 'player', v);
  muzzleFx(mx, my, mz, 1.2); sfx.launch();
  crime('shots', v.x, v.z);
}
// 強攻逃亡的停機坪：灰鷺河濱步道（城市西緣、銀行那條街往西），地上畫一個 H
const HELIPAD = spotW({ x: CITY_X0 - OUT_D * .5, z: stZ(4) + 31, yaw: 0 });
{
  const k = new Kit(), r = 7.5;
  // 墊高 0.16 m 的水泥台（步道鋪面會蓋掉貼地的標線）。材質 6（粗面、albedo 減半）不算積水反射，
  // 不然整片平台會映出霓虹的色塊、蓋掉 H 字，所以顏色調亮一倍
  k.cyl(0, .08, 0, r, r + .12, .16, 40, 0x5a5c60, 6);
  k.cyl(0, .165, 0, r - .35, r - .35, .01, 40, 0xffd23a, 6).cyl(0, .17, 0, r - .75, r - .75, .01, 40, 0x5a5c60, 6);
  k.box(-1.7, .175, 0, .7, .01, 5, 0xffffff, 6).box(1.7, .175, 0, .7, .01, 5, 0xffffff, 6).box(0, .175, 0, 2.7, .01, .7, 0xffffff, 6);
  const m = new T.Mesh(k.build(), MAT.uber);
  m.position.set(HELIPAD.x, groundH(HELIPAD.x, HELIPAD.z), HELIPAD.z); m.rotation.y = HELIPAD.yaw;
  cityAdd(m, null);
}
// 登機：機身比車大，走到 5 m 內就能上
ctxHooks.push((p) => {
  if (p.mode !== 'walk' || p.where !== 'out') return null;
  for (const v of GS.list) if (!v.dead && Math.hypot(p.x - v.x, p.z - v.z) < 5) return { key: 'F', text: `登機 <i>· ${v.name}</i>`, fn: () => { enterVehicle(v); toast(v.rockets ? 'Space 爬升 · Shift 下降 · 左鍵發射火箭' : 'Space 爬升 · Shift 下降'); } };
  return null;
});
const gunshipApi = { GS, HELIPAD, build: (x, z, yaw = 0) => buildGunship(x, z, yaw), drop: dropGunship, fire: () => { GS.fireT = 0; gunshipFire(); }, roofH };
gtaApi.gunship = gunshipApi;
