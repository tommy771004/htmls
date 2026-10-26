
// ═══ 可進入的場館：LAZARUS 夜店、AFTERGLOW 酒吧，外加 CHROME WORKS 改裝廠門口（室內在 66-chrome.js）═══
await bootStep(BOOT.venues, '布置夜店與酒吧…');
const ENV = {
  out: { lampOn: 1, wet: 1, fogDen: .016, fog: 0x1a1d26, fogHi: 0x3a2a3a, top: 0x1d2230, bot: 0x241a16 },
  club: { lampOn: 0, wet: 0, fogDen: .05, fog: 0x1c0c26, fogHi: 0x2c1036, top: 0x2c1a3a, bot: 0x180c20 },
  bar: { lampOn: 0, wet: 0, fogDen: .035, fog: 0x1c120c, fogHi: 0x2a1a10, top: 0x40302a, bot: 0x2a1a12 },
};
function applyEnv(e) {
  U.uLampOn.value = e.lampOn; U.uWet.value = e.wet; U.uFogDen.value = e.fogDen;
  U.uFogCol.value.set(e.fog); U.uFogHi.value.set(e.fogHi);
  U.uAmbTop.value.set(e.top); U.uAmbBot.value.set(e.bot);
  // 室內沒有日光；戶外交給 28-sky.js 依時間與天氣算
  if (e === ENV.out) atmApply(); else { U.uDay.value = 0; U.uSunCol.value.set(0, 0, 0); }
}
function placeGeo(scn, geo, list, mat = MAT.uber) { const m = instancedIn(scn, geo, mat, list); return m; }
function instancedIn(scn, geo, mat, list) {
  const m = new T.InstancedMesh(geo, mat, Math.max(1, list.length));
  list.forEach((t, k) => { _o.position.set(t.x, t.y || 0, t.z); _o.rotation.set(0, t.ry || 0, 0); _o.scale.setScalar(t.s || 1); _o.updateMatrix(); m.setMatrixAt(k, _o.matrix); });
  m.count = list.length; m.computeBoundingSphere(); scn.add(m); return m;
}

// ─── 室外：場館門面 ───
const outLights = [...signLights];
const ropeGroup = new T.Group();
{
  const k = new Kit();
  // LAZARUS：黑色門框、洋紅門縫光、雨棚、霓虹草寫招牌
  const cx = CLUB_X, cz = CLUB_Z;
  k.box(cx, 1.4, cz + .06, 2.6, 2.8, .12, 0x0b0a0c, 2);
  k.box(cx, 1.3, cz + .13, 2.0, 2.55, .04, 0x18121a, 10);
  k.box(cx, 2.62, cz + .16, 2.0, .04, .03, 0xff3fa0, 8);
  k.box(cx - 1.02, 1.3, cz + .16, .04, 2.6, .03, 0xff3fa0, 8);
  k.box(cx + 1.02, 1.3, cz + .16, .04, 2.6, .03, 0xff3fa0, 8);
  k.box(cx, 3.35, cz + 1.5, 5.2, .18, 3.0, 0x0c0b0e, 15);
  k.box(cx, 3.24, cz + 2.98, 5.2, .05, .04, 0xff3fa0, 8);
  for (const s of [-1, 1]) k.cyl(cx + s * 2.45, 1.7, cz + 2.85, .05, .05, 3.3, 8, 0x1a1a1e, 15);
  // 排隊動線的鍍鉻柱
  for (let i = 0; i < 6; i++) k.cyl(cx - 2.2 - i * 1.25, .55, cz + 2.4, .04, .05, 1.0, 10, 0xc8ccd2, 3).cyl(cx - 2.2 - i * 1.25, .06, cz + 2.4, .16, .16, .04, 12, 0xc8ccd2, 3);
  // AFTERGLOW：木門、門燈、綠色雨棚
  const bx = BAR_X - 4.6, bz = BAR_Z;
  k.box(bx, 1.25, bz + .07, 1.3, 2.5, .1, 0x2a1810, 10).box(bx, 1.7, bz + .13, .6, .7, .02, 0xffb060, 11).box(bx + .45, 1.2, bz + .14, .06, .06, .06, 0xc8a050, 3);
  k.box(BAR_X, 3.2, bz + .9, 12, .12, 1.8, 0x14301e, 2, -.18);
  k.box(bx, 2.75, bz + .3, .25, .3, .25, 0x1a1a1a, 15).box(bx, 2.6, bz + .3, .18, .05, .18, 0xffb060, 8);
  // CHROME WORKS：捲門外框的青色燈條
  const gx = GAR_X, gz = GAR_Z;
  k.box(gx, 3.75, gz + .1, 10.4, .08, .05, 0x2cf2d8, 8);
  for (const s of [-1, 1]) k.box(gx + s * 5.2, 1.9, gz + .1, .08, 3.75, .05, 0x2cf2d8, 8);
  k.box(gx, 4.75, gz + .33, 5.8, 1.56, .2, 0x111214, 2);   // 招牌底板
  cityAddAny(new T.Mesh(k.build(), MAT.uber));
  signQuad(cx, 5.3, cz + .2, 0, 1, 7.6, 1.9, 'LAZARUS', .7, 0, 1.25, 0xff3fa0, 14);
  signQuad(cx, 3.5, cz + 2.99, 0, 1, 4.6, .86, 'LAZARUS_SMALL', .2, 0, .9, null);
  signQuad(BAR_X + 1.6, 3.95, bz + .14, 0, 1, 5.2, 1.3, 'AFTERGLOW', .4, 0, 1.6, 0xffa040, 10);
  signQuad(gx, 4.75, gz + .45, 0, 1, 5.6, 1.4, 'CHROME', .5, 0, 1.4, 0x2cf2d8, 12);
  outLights.push({ x: cx, y: 3, z: cz + 2.2, col: lin(0xff3fa0), r: 9, i: 1.2 }, { x: bx, y: 2.5, z: bz + 1, col: lin(0xffb060), r: 7, i: .9 }, { x: gx, y: 3.4, z: gz + 2, col: lin(0x2cf2d8), r: 10, i: .9 });
  // 紅絨布繩：獲准入場後撤掉
  const rope = new T.CatmullRomCurve3([V3(cx - 1.2, .85, cz + 1.7), V3(cx, .62, cz + 1.75), V3(cx + 1.2, .85, cz + 1.7)]);
  const rk = new Kit().add(new T.TubeGeometry(rope, 16, .03, 6), 0x8a0a1e, 10);
  for (const s of [-1, 1]) rk.cyl(cx + s * 1.2, .5, cz + 1.7, .04, .05, 1, 10, 0xc8ccd2, 3).cyl(cx + s * 1.2, .06, cz + 1.7, .16, .16, .04, 12, 0xc8ccd2, 3);
  ropeGroup.add(new T.Mesh(rk.build(), MAT.uber)); cityAdd(ropeGroup, zoneAtL(cx, cz));
  // 停車格標線：改裝廠門前
  const pad = new Kit();
  for (const s of [-1, 1]) pad.box(gx + s * 1.6, .025, gz + SW + 4.4, .12, .01, 5.6, 0x2cf2d8, 11);
  pad.box(gx, .025, gz + SW + 1.6, 3.3, .01, .12, 0x2cf2d8, 11);
  const pm = new T.Mesh(pad.build(), MAT.uber); pm.layers.set(LY.NOREFL); cityAddAny(pm);
}
// 室外的點光（店招、場館門口、販賣機……）：生成時是邏輯座標，cityWorld() 換成世界座標；之後加進來的都是世界座標
worldHooks.push(() => { for (const L of outLights) if (!L.w) { [L.x, L.z] = toW(L.x, L.z); L.w = 1; } });
// 紅絨布繩的碰撞：沿繩子排五個小圓（間距 0.6、半徑 0.3，人擠不過去；以前是一個半徑 1.2 的圓，繩子前後各擋 1.2 m）
const ROPE_CIRCLES = [-1.2, -.6, 0, .6, 1.2].map(d => ({ x: CLUB_X + d, z: CLUB_Z + 1.7, r: .3 }));
circles.push(...ROPE_CIRCLES);
// 販賣機（Blender 模型）
{
  const vm = prop('vending_machine', 1.1, 2.2, .9);
  const list = [];
  for (const su of shopUnits) if (!su.special && su.shut && rnd() < .18 && list.length < 14) {
    const x = su.x + su.nx * .5 + su.nz * (su.w * .3), z = su.z + su.nz * .5 - su.nx * (su.w * .3);
    if (!free(x, z, .8)) continue; claim(x, z, .8);
    list.push({ x, y: .15, z, ry: Math.atan2(su.nx, su.nz) }); circles.push({ x, z, r: .55 });
    outLights.push({ x: x + su.nx * .9, y: 1.4, z: z + su.nz * .9, col: lin(0x7fe7ff), r: 5, i: .7 });
  }
  instanced(vm, MAT.uber, list);
}
// 所有室外招牌（店招、立式招牌、廣告牌、場館招牌）合成一個 mesh
const signMesh = (() => {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(signGeo.p, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(signGeo.uv, 2));
  g.setAttribute('aS', new T.Float32BufferAttribute(signGeo.s, 4));
  g.setIndex(signGeo.idx); g.computeBoundingSphere();
  const m = cityAddAny(new T.Mesh(g, MAT_SIGN)); return m;
})();

// ─── LAZARUS 夜店 ───
const clubScene = new T.Scene();
const club = { boxes: [], circles: [], lights: [], people: null, dancers: [] };
{
  const k = new Kit();
  const S = clubScene, B = club.boxes;
  const wall = (x0, x1, z0, z1, h, col = 0x0f0d12, mat = 2) => { k.box((x0 + x1) / 2, h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0, col, mat); B.push({ x0, x1, z0, z1 }); };
  k.box(0, -.05, 16, 24.4, .1, 32.4, 0x0c0b0f, 10);
  k.box(0, 7.25, 16, 24.4, .1, 32.4, 0x060508, 2);
  wall(-12.4, -12, 0, 32, 7.2); wall(12, 12.4, 0, 32, 7.2); wall(-12.4, 12.4, 32, 32.4, 7.2);
  wall(-12.4, -1.6, -.4, 0, 7.2); wall(1.6, 12.4, -.4, 0, 7.2);
  wall(-2.4, -2.0, 0, 6, 3.2); wall(2.0, 2.4, 0, 6, 3.2);
  k.box(0, 3.25, 3, 4.8, .1, 6, 0x0a080c, 2);
  for (let z = .6; z < 6; z += 1.1) k.box(0, 3.18, z, 3.6, .03, .06, 0xff2a3a, 8);
  // 牆面：直條吸音板與霓虹燈管
  for (let z = 7; z < 32; z += .9) for (const s of [-1, 1]) k.box(s * 11.92, 3.4, z, .1, 6.2, .6, 0x17131c, 2);
  for (let z = 8; z < 32; z += 4) for (const s of [-1, 1]) k.box(s * 11.85, 3.5, z, .05, 5.6, .06, z % 8 ? 0xff3fa0 : 0x2cf2d8, 8);
  for (const s of [-1, 1]) k.box(s * 11.85, 2.4, 19, .04, .05, 26, 0x7a2cff, 8);
  // 舞台與 DJ 台
  k.box(0, .45, 29.5, 11, .9, 5, 0x0d0c10, 10); B.push({ x0: -5.5, x1: 5.5, z0: 27, z1: 32 });
  k.box(0, .9, 27.02, 11, .04, .04, 0xff3fa0, 8);
  for (let x = -5; x <= 5; x += 1) k.box(x, .45, 26.99, .5, .04, .02, 0x2cf2d8, 8);
  // 桁架
  for (const s of [-1, 1]) { k.box(s * 7, 6.2, 19, .3, .3, 14.3, 0x2a2c30, 15); k.box(0, 6.2, 19 + s * 7, 14.3, .3, .3, 0x2a2c30, 15); }
  for (const [x, z] of [[-7, 12], [7, 12], [-7, 26], [7, 26]]) k.box(x, 6.7, z, .12, 1, .12, 0x2a2c30, 15);
  // 吧台區
  k.box(-11.3, 1.6, 12.5, .9, .05, 9, 0xffa040, 8);
  k.box(-9.6, 1.08, 12.5, .7, .06, 9.2, 0x111014, 10);
  k.box(-9.6, .53, 12.5, .5, 1.06, 9, 0x1a1418, 2);
  k.box(-9.36, .12, 12.5, .04, .06, 9, 0xff3fa0, 8);
  B.push({ x0: -12, x1: -9.2, z0: 7.8, z1: 17.2 });
  // 卡座
  for (const z of [10, 16, 22]) {
    k.box(10.9, .3, z, 1.6, .6, 3.6, 0x3a0a1e, 2).box(11.6, .9, z, .3, 1.2, 3.6, 0x3a0a1e, 2);
    B.push({ x0: 9.4, x1: 12, z0: z - 1.8, z1: z + 1.8 });
  }
  S.add(new T.Mesh(k.build(), MAT.uber));
  // Blender 道具：DJ 台、音箱塔、酒架、高腳椅、卡座桌
  const fitDJ = propFit('dj_booth');
  instancedIn(S, fitDJ.geo, MAT.uber, [{ x: 0, y: .9, z: 28.3, ry: Math.PI }]);
  // 以 http(s) 開啟時桌面上換成 Andres Torres 的 DJ 控制器（props/club_dj.glb，放大蓋住程式建模的兩個唱盤與混音器；控制面與螢幕朝 DJ）
  propSwap('club', null, 'club_dj', [{ x: 0, y: .9 + 1.4, z: 27.92 }], S, null, 'club_dj');
  instancedIn(S, prop('speaker_stack'), MAT.uber, [{ x: -6.6, z: 28.6, ry: Math.PI }, { x: 6.6, z: 28.6, ry: Math.PI }, { x: -4.4, y: .9, z: 31, ry: Math.PI }, { x: 4.4, y: .9, z: 31, ry: Math.PI }]);
  B.push({ x0: -7.3, x1: -5.9, z0: 27.6, z1: 29.6 }, { x0: 5.9, x1: 7.3, z0: 27.6, z1: 29.6 });
  instancedIn(S, prop('bottle_rack'), MAT.uber, [{ x: -11.7, z: 10.3, ry: Math.PI / 2 }, { x: -11.7, z: 14.7, ry: Math.PI / 2 }]);
  instancedIn(S, prop('bar_stool'), MAT.uber, [8.8, 10.4, 12, 13.6, 15.2, 16.8].map(z => ({ x: -8.7, z })));
  instancedIn(S, prop('club_table'), MAT.uber, [10, 16, 22].map(z => ({ x: 9.2, z, ry: -Math.PI / 2, s: .8 })));
  instancedIn(S, prop('laser_rig'), MAT.uber, [{ x: 0, y: 6.9, z: 19, s: .8 }]);
  for (const z of [8.8, 12, 15.2, 16.8]) club.circles.push({ x: -8.7, z, r: .3 });
  // 舞台後方大螢幕
  const sg = new T.PlaneGeometry(14, 5); const uv = sg.attributes.uv; const c = cells.LAZARUS;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(c.u0, c.u1, uv.getX(i)), lerp(c.v0, c.v1, uv.getY(i)));
  sg.setAttribute('aS', new T.Float32BufferAttribute(new Array(uv.count).fill(0).flatMap(() => [.5, 3, 1.4, 0]), 4));
  const screen = new T.Mesh(sg, MAT_SIGN); screen.position.set(0, 4.3, 31.8); screen.rotation.y = Math.PI; S.add(screen);
}
// LED 舞池：12×12 格，跟著拍子換花樣
const LED_FS = /* glsl */`
${GL_LIB}
varying vec3 vW;
vec3 hue(float h){ return clamp(abs(fract(h + vec3(0., .33, .67)) * 6. - 3.) - 1., 0., 1.); }
void main(){
  vec2 q = vW.xz - vec2(-6., 13.);
  vec2 g = floor(q), f = fract(q);
  float b = uBeat; float bar = floor(b / 8.);
  float pat = mod(bar, 4.);
  vec2 c = g - 5.5;
  float on; float h;
  if (pat < 1.) { on = mod(g.x + g.y + floor(b), 2.); h = .9 + floor(b) * .07; }
  else if (pat < 2.) { float r = length(c); on = smoothstep(1.2, 0., abs(fract(r * .25 - b * .5) - .5) * 4.); h = r * .05 + b * .02; }
  else if (pat < 3.) { on = step(.5, fract((g.x - g.y) * .125 + b * .25)); h = .55 + g.x * .03; }
  else { on = step(.72, h21(g + floor(b) * 7.)); h = h21(g + floor(b)); }
  float edge = smoothstep(.0, .06, f.x) * smoothstep(1., .94, f.x) * smoothstep(.0, .06, f.y) * smoothstep(1., .94, f.y);
  float pulse = .55 + .45 * exp(-fract(b) * 4.);
  vec3 col = hue(h) * on * edge * 1.6 * pulse + vec3(.01);
  vec3 v = normalize(uCam - vW);
  col += shade(vW, vec3(0., 1., 0.), v, vec3(.02), .15, 0.);
  gl_FragColor = vec4(applyFog(col, vW), 1.);
}`;
{
  const g = new T.PlaneGeometry(12, 12); g.rotateX(-Math.PI / 2); g.translate(0, .015, 19);
  clubScene.add(new T.Mesh(g, new T.ShaderMaterial({ uniforms: shared(ALLU), vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`, fragmentShader: LED_FS })));
}
// 搖頭燈光束與雷射：加法混合的錐體與細長面
const BEAM_VS = /* glsl */`varying vec3 vW, vN; varying float vL; varying vec3 vC;
void main(){ vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); vL = uv.y;
  #ifdef USE_INSTANCING_COLOR
  vC = instanceColor;
  #else
  vC = vec3(1.);
  #endif
  gl_Position = projectionMatrix * viewMatrix * w; }`;
const BEAM_FS = /* glsl */`${GL_LIB}
uniform float uK;
varying vec3 vW, vN; varying float vL; varying vec3 vC;
void main(){ vec3 v = normalize(uCam - vW); float e = pow(abs(dot(normalize(vN), v)), 1.5);
  float a = e * pow(clamp(vL, 0., 1.), 1.3) * uK * (.7 + .3 * n2(vec2(vW.y * 2. + uTime * 3., vW.x)));
  gl_FragColor = vec4(vC * a, 1.); }`;
const beamMat = new T.ShaderMaterial({ uniforms: { ...shared(ALLU), uK: { value: .35 } }, vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
const laserMat = beamMat.clone(); laserMat.uniforms = { ...shared(ALLU), uK: { value: 2.4 } };
const HEADS = [[-7, 13], [-7, 17.5], [-7, 22], [7, 13], [7, 17.5], [7, 22], [-3.5, 26], [3.5, 26]];
const beams = (() => {
  const g = new T.CylinderGeometry(.08, 1.1, 8, 16, 1, true); g.translate(0, -4, 0);
  // 圓柱 uv.y：頂端 1、底端 0；光束從燈頭往下，越靠近燈頭越亮
  const m = new T.InstancedMesh(g, beamMat, HEADS.length);
  m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(HEADS.length * 3), 3);
  m.frustumCulled = false; clubScene.add(m); return m;
})();
const lasers = (() => {
  // 兩片交叉的細長面，從任何角度看都不會變成一條看不見的邊
  const a = new T.PlaneGeometry(.03, 22), b2 = new T.PlaneGeometry(.03, 22); b2.rotateY(Math.PI / 2);
  const g = new T.BufferGeometry();
  for (const n of ['position', 'normal', 'uv']) g.setAttribute(n, new T.Float32BufferAttribute([...a.toNonIndexed().attributes[n].array, ...b2.toNonIndexed().attributes[n].array], n === 'uv' ? 2 : 3));
  g.translate(0, -11, 0);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * .6 + .4);
  const m = new T.InstancedMesh(g, laserMat, 12);
  m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(36), 3);
  m.frustumCulled = false; clubScene.add(m); return m;
})();
const mirrorBall = (() => {
  const g = new T.IcosahedronGeometry(.55, 2); g.computeVertexNormals();
  const k = new Kit().add(g, 0xd8dce4, 3).cyl(0, .9, 0, .01, .01, 1.4, 4, 0x222222, 15);
  const m = new T.Mesh(k.build(), MAT.uber); m.position.set(0, 5.2, 19); clubScene.add(m); return m;
})();
// 夜店的人：舞池上的人群、DJ、酒保、吧台邊與卡座的客人
{
  const N = LOW ? 20 : 32;
  const cr = crowd(N + 10);
  const rc = rng(260);
  const spots = [];
  for (let k = 0; k < N; k++) {
    let x, z, tries = 0;
    do { x = -5.4 + rc() * 10.8; z = 13.6 + rc() * 10.8; tries++; } while (tries < 30 && spots.some(s => Math.hypot(s[0] - x, s[1] - z) < 1.05));
    spots.push([x, z]);
    cr.look(k, { r: rc, glowI: rc() < .45 ? 1.8 : 0 });
    if (k === 4) cr.look(k, { ...LUCIA(k), glowI: 1.8 });   // 舞池裡一個 Lucia（掃描模型）
    const a = DANCES[Math.floor(rc() * DANCES.length)];
    cr.anim(k, a, rc() * 10, 1, Math.floor(rc() * 4) / 4);   // 拍點錯開四分之一拍，同一種舞步也不會整齊劃一
    const yaw = Math.atan2(-x * .2, 29 - z) + (rc() - .5) * 1.4;
    cr.place(k, x, 0, z, yaw);
    club.dancers.push(k);
  }
  const extra = [
    [ANIM.dj, 0, .9, 30.2, Math.PI], [ANIM.bartend, -11, 0, 12.5, Math.PI / 2],
    [ANIM.talk, -8.4, 0, 9.6, -Math.PI / 2], [ANIM.idle, -8.3, 0, 14.4, -Math.PI / 2 + .3], [ANIM.talk, -7.6, 0, 15.2, -2.4],
    [ANIM.sit, 10.6, -.3, 9.2, -Math.PI / 2], [ANIM.sit, 10.6, -.3, 10.9, -Math.PI / 2], [ANIM.sit, 10.6, -.3, 16.6, -Math.PI / 2],
    [ANIM.sit, 10.6, -.3, 22.5, -Math.PI / 2], [ANIM.smoke, 2.9, 0, 6.6, Math.PI],
  ];
  extra.forEach(([a, x, y, z, yaw], q) => {
    const k = N + q;
    cr.look(k, { r: rc, glowI: q === 0 ? 2 : rc() < .3 ? 1.5 : 0, coat: q === 1 ? 0 : undefined });
    cr.anim(k, a, rc() * 10, 1, 0); cr.place(k, x, y, z, yaw);
    if (y >= 0 && q > 1) club.circles.push({ x, z, r: .32 });
  });
  cr.flush(); clubScene.add(cr.mesh);
  club.people = cr;
  for (const [x, z] of spots) club.circles.push({ x, z, r: .3, dancer: 1 });
}
const CLUB_SPAWN = { x: 0, z: 2.4, yaw: 0 }, CLUB_EXIT = { x: 0, z: .5 };
const CLUB_FLOOR = { x: 0, z: 19 };
function updateClub(t, beat) {
  const bp = beat * Math.PI * 2;
  const pal = [lin(0xff3fa0), lin(0x2cf2d8), lin(0x7a2cff), lin(0xffae57), lin(0x40ff9a)];
  const bar = Math.floor(beat / 8);
  HEADS.forEach(([x, z], k) => {
    const sw = Math.sin(t * .9 + k * 1.3 + (bar % 2) * Math.sin(bp * .25) * 1.5);
    _o.position.set(x, 6.05, z);
    _o.rotation.set(.5 * sw * (k % 2 ? 1 : -1), 0, (x < 0 ? -1 : 1) * (.35 + .25 * Math.cos(t * .7 + k)), 'YXZ'); _o.scale.set(1, 1, 1); _o.updateMatrix();
    beams.setMatrixAt(k, _o.matrix);
    const c = pal[(k + bar) % pal.length]; const fl = .6 + .4 * Math.exp(-(beat % 1) * 3);
    beams.instanceColor.setXYZ(k, c.r * fl, c.g * fl, c.b * fl);
  });
  beams.instanceMatrix.needsUpdate = true; beams.instanceColor.needsUpdate = true;
  const laserOn = bar % 4 >= 2;
  lasers.visible = laserOn;
  for (let k = 0; k < 12; k++) {
    _o.position.set(0, 3.1, 28.2);
    const fan = (k / 11 - .5) * 1.4 + Math.sin(t * 1.3) * .35;
    _o.rotation.set(Math.PI / 2 - .1 - .07 * Math.sin(t * 2 + k), fan, 0, 'YXZ'); _o.updateMatrix();
    // 平面朝 -y 延伸，轉到朝 -z（朝向舞池）
    lasers.setMatrixAt(k, _o.matrix);
    const c = (bar % 8) >= 6 ? lin(0xff2040) : lin(0x40ff60); lasers.instanceColor.setXYZ(k, c.r, c.g, c.b);
  }
  lasers.instanceMatrix.needsUpdate = true; lasers.instanceColor.needsUpdate = true;
  mirrorBall.rotation.y = t * .6;
  // 燈光：舞池上方移動的彩色燈、吧台暖光、走廊紅光
  club.lights.length = 0;
  for (let k = 0; k < 5; k++) {
    const a = t * .5 + k * 1.26;
    const c = pal[(k + bar) % pal.length];
    club.lights.push({ x: Math.cos(a) * 4, y: 4.5, z: 19 + Math.sin(a) * 4, col: c, r: 10, i: 1.2 * (.6 + .4 * Math.exp(-(beat % 1) * 3)) });
  }
  club.lights.push({ x: 0, y: .6, z: 19, col: pal[bar % pal.length], r: 9, i: .9 });
  club.lights.push({ x: -10.5, y: 2.4, z: 10, col: lin(0xffa040), r: 7, i: 1 }, { x: -10.5, y: 2.4, z: 15, col: lin(0xffa040), r: 7, i: 1 });
  club.lights.push({ x: 0, y: 3, z: 3, col: lin(0xff2a3a), r: 6, i: 1 }, { x: 0, y: 3.5, z: 30, col: lin(0xff3fa0), r: 9, i: 1.2 });
  club.lights.push({ x: 10, y: 2, z: 16, col: lin(0x7a2cff), r: 8, i: .7 });
  const strobe = bar % 16 === 15 && (beat % .5) < .08;
  if (strobe) club.lights.push({ x: 0, y: 6, z: 19, col: V3(1, 1, 1), r: 18, i: 3 });
}

// ─── AFTERGLOW 酒吧 ───
const barScene = new T.Scene();
const bar = { boxes: [], circles: [], lights: [], people: null };
{
  const k = new Kit(), B = bar.boxes, S = barScene;
  const wall = (x0, x1, z0, z1, h, col, mat = 2) => { k.box((x0 + x1) / 2, h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0, col, mat); B.push({ x0, x1, z0, z1 }); };
  for (let x = -7; x < 7; x += .22) k.box(x + .11, -.05, 8, .21, .1, 16, (Math.floor((x + 7) / .22) % 3) ? 0x3a2416 : 0x2e1c10, 10);
  k.box(0, 3.65, 8, 14.4, .1, 16.4, 0x140c08, 2);
  wall(-7.4, -7, 0, 16, 3.6, 0x4a2216); wall(7, 7.4, 0, 16, 3.6, 0x4a2216); wall(-7.4, 7.4, 16, 16.4, 3.6, 0x5a2a1c);
  // 磚牆紋理：一排排略有色差的磚
  for (let y = .1; y < 3.6; y += .16) for (let x = -6.9; x < 6.9; x += .5) k.box(x + (Math.round(y / .16) % 2) * .25, y, 15.98, .46, .12, .04, [0x5e2a1c, 0x6a3020, 0x4e2418][Math.floor(Math.abs(Math.sin(x * 7.1 + y * 13.3)) * 3)], 2);
  // 前牆：門與大窗
  wall(-7.4, -3.7, -.4, 0, 3.6, 0x3a2016); wall(-2.3, -1.2, -.4, 0, 3.6, 0x3a2016); wall(6.2, 7.4, -.4, 0, 3.6, 0x3a2016);
  k.box(2.5, .4, -.2, 7.4, .8, .4, 0x3a2016, 2).box(2.5, 3.2, -.2, 7.4, .8, .4, 0x3a2016, 2);
  B.push({ x0: -1.2, x1: 6.2, z0: -.4, z1: 0 }, { x0: -3.7, x1: -2.3, z0: -.6, z1: -.4 });
  // 護牆板
  for (const [x0, x1, z0, z1] of [[-6.98, -6.9, 0, 16], [6.9, 6.98, 0, 16]]) k.box((x0 + x1) / 2, .6, (z0 + z1) / 2, x1 - x0 + .04, 1.2, z1 - z0, 0x2a180e, 10);
  // 吧台（Blender）與背酒架
  instancedIn(S, prop('bar_counter'), MAT.uber, [{ x: 4.0, z: 5.6, ry: -Math.PI / 2 }, { x: 4.0, z: 10.9, ry: -Math.PI / 2 }]);
  B.push({ x0: 3.4, x1: 7, z0: 2.9, z1: 13.6 });
  instancedIn(S, prop('bottle_rack'), MAT.uber, [{ x: 6.8, z: 5.6, ry: -Math.PI / 2 }, { x: 6.8, z: 10.4, ry: -Math.PI / 2 }]);
  k.box(6.9, 1.9, 8, .05, 2.4, 9.6, 0xffa040, 11);
  instancedIn(S, prop('bar_stool'), MAT.uber, [3.8, 5.2, 6.6, 8, 9.4, 10.8, 12.2].map(z => ({ x: 2.9, z })));
  for (const z of [3.8, 5.2, 6.6, 9.4, 10.8, 12.2]) bar.circles.push({ x: 2.9, z, r: .28 });
  // 點唱機與街機：http(s) 下走進來才換成實體模型（27-props.js）
  const JUKE = [{ x: -5.2, z: 15.4, ry: Math.PI }], ARC = [{ x: -6.4, z: 12.4, ry: Math.PI / 2 }, { x: -6.4, z: 13.6, ry: Math.PI / 2 }];
  propSwap('bar', instancedIn(S, prop('jukebox'), MAT.uber, JUKE), 'jukebox', JUKE);
  propSwap('bar', instancedIn(S, prop('arcade_cab'), MAT.uber, ARC), 'arcade', ARC);
  B.push({ x0: -6, x1: -4.4, z0: 14.8, z1: 16 }, { x0: -7, x1: -5.8, z0: 11.8, z1: 14.2 });
  // 小圓桌與椅子
  for (const [x, z] of [[-4.6, 4], [-4.6, 8], [-1.4, 11]]) {
    k.cyl(x, .74, z, .45, .45, .05, 18, 0x2a1a10, 10).cyl(x, .37, z, .05, .07, .74, 8, 0x1a1a1a, 15).cyl(x, .02, z, .3, .3, .04, 12, 0x1a1a1a, 15);
    for (const a of [0, Math.PI]) { const cx = x + Math.sin(a) * .85, cz = z + Math.cos(a) * .85; k.box(cx, .45, cz, .42, .05, .42, 0x4a2a1a, 2).box(cx, .7, cz + Math.cos(a) * .2, .42, .5, .05, 0x4a2a1a, 2).box(cx, .22, cz, .05, .45, .05, 0x1a1a1a, 15); }
    bar.circles.push({ x, z, r: .55 });
  }
  // 吊燈
  for (const z of [4.5, 8, 11.5]) { k.cyl(2.6, 3.1, z, .005, .005, 1, 4, 0x111111, 15); k.add(new T.ConeGeometry(.22, .22, 14, 1, true), 0x1a3a2a, 15, tf(2.6, 2.55, z)); k.cyl(2.6, 2.47, z, .07, .07, .06, 8, 0xffc070, 8); }
  for (const [x, z] of [[-4.6, 4], [-4.6, 8], [-1.4, 11]]) { k.cyl(x, 3.2, z, .005, .005, .8, 4, 0x111111, 15); k.add(new T.SphereGeometry(.13, 12, 8), 0xffb060, 8, tf(x, 2.75, z)); }
  S.add(new T.Mesh(k.build(), MAT.uber));
  // 店內的 AFTERGLOW 招牌（從店內看是反的）
  const sg = new T.PlaneGeometry(3.2, .8); const uv = sg.attributes.uv; const c = cells.AFTERGLOW;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(c.u0, c.u1, uv.getX(i)), lerp(c.v0, c.v1, uv.getY(i)));
  sg.setAttribute('aS', new T.Float32BufferAttribute(new Array(uv.count).fill(0).flatMap(() => [.3, 0, 1.4, 0]), 4));
  const sm = new T.Mesh(sg, MAT_SIGN); sm.position.set(2.5, 2.45, .12); S.add(sm);
}
// 雨窗：玻璃上的水珠與滑落的水痕，後面是失焦的街燈
const WINDOW_FS = /* glsl */`${GL_LIB}
varying vec2 vUv; varying vec3 vW;
void main(){
  vec2 p = vUv * vec2(7.4, 2.);
  vec3 c = vec3(.02, .025, .04);
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    vec2 bc = vec2(h11(fi * 3.1) * 7.4 + sin(uTime * .1 + fi) * .3, .3 + h11(fi * 7.7) * 1.4);
    vec3 col = fi < 5. ? vec3(1., .5, .2) : fi < 9. ? vec3(.3, .9, 1.) : fi < 12. ? vec3(1., .25, .55) : vec3(.9, .9, .8);
    float r = .25 + h11(fi) * .35;
    c += col * smoothstep(r, r * .7, length(p - bc)) * .5 * (.8 + .2 * sin(uTime * (1. + fi * .3)));
  }
  vec2 g = p * vec2(9., 7.); vec2 gi = floor(g), gf = fract(g) - .5;
  float drop = smoothstep(.18, .1, length(gf - (vec2(h21(gi), h21(gi + 2.)) - .5) * .5)) * step(.55, h21(gi + 5.));
  vec2 s = vec2(p.x * 6., p.y + uTime * (.5 + h11(floor(p.x * 6.)) * .8));
  float streak = smoothstep(.08, .0, abs(fract(s.x) - .5) - .02) * step(.75, h11(floor(s.x))) * smoothstep(.0, .5, fract(s.y * .3 + h11(floor(s.x)))) ;
  c = c * (1. - drop * .4) + drop * c * 2.5 + streak * vec3(.12, .14, .18);
  gl_FragColor = vec4(applyFog(c, vW), 1.);
}`;
{
  const g = new T.PlaneGeometry(7.4, 2.0);
  const m = new T.Mesh(g, new T.ShaderMaterial({ uniforms: shared(ALLU), vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`, fragmentShader: WINDOW_FS }));
  m.position.set(2.5, 1.8, -.05); barScene.add(m);
}
{
  const cr = crowd(8); const rc = rng(41);
  const list = [
    [ANIM.bartend, 5.2, 0, 8, -Math.PI / 2, { top: lin(0x1a1c20), bot: lin(0x101012), skin: SKINS[2], hair: lin(0x8a2a3a), longHair: 1, coat: 0, skirt: 0, hat: 0, glowI: 0 }],
    [ANIM.sit, 2.9, 0, 5.2, Math.PI / 2], [ANIM.sit, 2.9, 0, 6.6, Math.PI / 2], [ANIM.sit, 2.9, 0, 10.8, Math.PI / 2],
    [ANIM.sit, -4.6, -.3, 3.15, 0], [ANIM.sit, -4.6, -.3, 8.85, Math.PI], [ANIM.talk, -1.4, 0, 12.1, Math.PI], [ANIM.idle, -5.2, 0, 14.4, Math.PI],
  ];
  list.forEach(([a, x, y, z, yaw, look], k) => { cr.look(k, look || { r: rc, glowI: 0 }); cr.anim(k, a, rc() * 10, 1); cr.place(k, x, y, z, yaw); if (k > 3 && y === 0) bar.circles.push({ x, z, r: .3 }); });
  cr.flush(); barScene.add(cr.mesh); bar.people = cr;
}
const BAR_SPAWN = { x: -3, z: 2.3, yaw: 0 }, BAR_EXIT = { x: -3, z: .5 };
const JUNO = { x: 2.3, z: 8 };
bar.lights.push(
  { x: 2.6, y: 2.3, z: 4.5, col: lin(0xffb060), r: 6, i: 1.3 }, { x: 2.6, y: 2.3, z: 8, col: lin(0xffb060), r: 6, i: 1.3 }, { x: 2.6, y: 2.3, z: 11.5, col: lin(0xffb060), r: 6, i: 1.3 },
  { x: 6.2, y: 1.8, z: 8, col: lin(0xffa040), r: 6, i: 1.1 }, { x: -5.2, y: 1.2, z: 14.6, col: lin(0xff4fb0), r: 5, i: .9 },
  { x: -4.6, y: 2.5, z: 4, col: lin(0xffb060), r: 4.5, i: .8 }, { x: -4.6, y: 2.5, z: 8, col: lin(0xffb060), r: 4.5, i: .8 }, { x: -1.4, y: 2.5, z: 11, col: lin(0xffb060), r: 4.5, i: .8 },
  { x: 2.5, y: 2.3, z: .8, col: lin(0xffa040), r: 5, i: .8 }, { x: -6, y: 1.3, z: 13, col: lin(0x4ee6ff), r: 4, i: .7 },
);

// ─── 任務：門禁 ───
const QUEST = [
  { text: '進入 LAZARUS', mk: () => ({ name: 'LAZARUS', ...WP(CLUB_X, CLUB_Z + 1.4), y: 2.4, where: 'out' }) },
  { text: '到 AFTERGLOW 找吧台的 Juno', mk: () => player.where === 'bar' ? { name: 'Juno', x: JUNO.x + 2.7, y: 2.1, z: JUNO.z, where: 'bar' } : { name: 'AFTERGLOW', ...WP(BAR_X - 4.6, BAR_Z + .6), y: 2.4, where: 'out' } },
  { text: '把火柴盒拿給 LAZARUS 門口的 Marlo', mk: () => ({ name: 'Marlo', ...WP(BOUNCER.x, BOUNCER.z), y: 2.3, where: 'out' }) },
  { text: '走進 LAZARUS', mk: () => ({ name: 'LAZARUS', ...WP(CLUB_X, CLUB_Z + .4), y: 2.4, where: 'out' }) },
  { text: '在舞池跳一支舞（G）', mk: () => player.where === 'club' ? { name: '舞池', x: CLUB_FLOOR.x, y: 1.2, z: CLUB_FLOOR.z, where: 'club' } : { name: 'LAZARUS', ...WP(CLUB_X, CLUB_Z + .4), y: 2.4, where: 'out' } },
  { text: '雨還沒停，城市是你的', mk: () => null },
];
const quest = { n: 0, danceT: 0 };
function setQuest(n) {
  quest.n = n;
  $('objText').textContent = QUEST[n].text;
  const o = $('obj'); o.classList.remove('flash'); void o.offsetWidth; o.classList.add('flash');
  if (n >= 3) { ropeGroup.visible = false; for (const c of ROPE_CIRCLES) c.r = 0; }
}
// ─── 對話框 ───
const dlg = { open: false, opts: [] };
function dialog(who, text, opts) {
  dlg.open = true; dlg.opts = opts || [{ t: '離開', fn: closeDialog }];
  $('dlgWho').textContent = who; $('dlgText').textContent = text;
  const box = $('dlgOpts'); box.innerHTML = ''; box.classList.toggle('many', dlg.opts.length > 6);   // 選項多（66-chrome.js 的改裝選單）排兩欄
  dlg.opts.forEach((o, i) => {
    const b = document.createElement('button');
    b.innerHTML = i < 10 ? `<kbd>${(i + 1) % 10}</kbd>` : ''; b.append(o.t);
    b.addEventListener('click', () => { sfx.click(); o.fn(); });
    box.append(b);
  });
  $('dialog').classList.add('on'); document.body.classList.add('talking');
  if (document.pointerLockElement) document.exitPointerLock();
}
function closeDialog() { dlg.open = false; $('dialog').classList.remove('on'); document.body.classList.remove('talking'); }
function talkMarlo() {
  if (quest.n === 2) {
    dialog('Marlo · LAZARUS 門口', '……Juno 的火柴盒。好吧，進去。別在裡面惹事，也別在舞池上講電話。', [{ t: '謝了。', fn: () => { closeDialog(); setQuest(3); sfx.rope(); toast('紅絨布繩撤開了'); } }]);
  } else if (quest.n >= 3) {
    dialog('Marlo · LAZARUS 門口', '你已經在名單上了。進去吧，雨會把你的鞋泡壞。');
  } else {
    dialog('Marlo · LAZARUS 門口', '名單上沒有你。今晚只放熟面孔進去，下雨天也一樣。', [
      { t: '我認識 DJ。', fn: () => dialog('Marlo · LAZARUS 門口', '每個站在這裡淋雨的人都認識 DJ。', [{ t: '那要怎樣才能上名單？', fn: askList }, { t: '算了。', fn: closeDialog }]) },
      { t: '要怎樣才能上名單？', fn: askList },
      { t: '算了。', fn: closeDialog },
    ]);
  }
}
function askList() {
  dialog('Marlo · LAZARUS 門口', '去 7 St 跟 Cinder Av 那頭的 AFTERGLOW，找吧台的 Juno。她說你可以，我就說你可以。', [{ t: '7 St 的 AFTERGLOW，記住了。', fn: () => { closeDialog(); if (quest.n < 1) setQuest(1); } }]);
}
function talkJuno() {
  const main = () => dialog('Juno · AFTERGLOW 吧台', quest.n === 1 ? 'Marlo 叫你來的？他每次都這樣，把麻煩推給我。' : '還要什麼？今晚雨大，酒倒是很夠。', [
    ...(quest.n === 1 ? [{ t: '我只想進去聽一場。', fn: () => dialog('Juno · AFTERGLOW 吧台', '這種雨夜，誰不想。拿去，把這個火柴盒拿給他看，上面的夜鷹是我畫的。', [{ t: '收下火柴盒', fn: () => { closeDialog(); setQuest(2); toast('拿到：印著夜鷹的火柴盒'); sfx.pickup(); } }]) }] : []),
    { t: '先來一杯。', fn: () => { player.drinks = (player.drinks || 0) + 1; post.wobble = 1; sfx.glass(); dialog('Juno · AFTERGLOW 吧台', ['雨天特調：琴酒、薑、一點點煙燻。算你半價。', '這杯叫「餘燼」，喝慢一點。', '最後一杯了，我可不想扶你出去。'][Math.min(player.drinks - 1, 2)], [{ t: '再聊聊。', fn: main }, { t: '先這樣。', fn: closeDialog }]); } },
    { t: '先這樣。', fn: closeDialog },
  ]);
  main();
}

// ─── 進出場館 ───
// 每個室內場館一筆：場景、碰撞與燈光（data）、進門位置、HUD 名稱、相機天花板、街上的門與出門位置（door、out 是世界座標）
// 車行與車庫在 65-motors.js 加進來
const VENUES = {
  club: { scene: clubScene, data: club, spawn: CLUB_SPAWN, name: 'LAZARUS', toast: 'LAZARUS', dist: '霓虹區 · 9 St', ceil: 6.6, door: WP(CLUB_X, CLUB_Z), out: spotW({ x: CLUB_X - .2, z: CLUB_Z + 1.0, yaw: Math.PI }) },
  bar: { scene: barScene, data: bar, spawn: BAR_SPAWN, name: 'AFTERGLOW', toast: 'AFTERGLOW 餘燼酒吧', dist: '紅磚巷 · 7 St', ceil: 3.3, door: WP(BAR_X, BAR_Z), out: spotW({ x: BAR_X - 4.6, z: BAR_Z + 1.2, yaw: Math.PI }) },
};
let curScene = scene;
function setWhere(w) {
  player.where = w;
  curScene = w === 'out' ? scene : VENUES[w].scene;
  curScene.add(me.mesh);
  applyEnv(ENV[w]);
  propWake(w);
  if (w === 'out') { activeBoxes = colliders; activeCircles = circles; }
  else { const v = VENUES[w].data; activeBoxes = v.boxes; activeCircles = v.circles; }
  rainMesh.visible = splashMesh.visible = w === 'out';
}
let fading = false;
function transition(fn) {
  if (fading) return; fading = true;
  $('fade').classList.add('on'); sfx.door();
  setTimeout(() => { fn(); camState.snap = true; setTimeout(() => { $('fade').classList.remove('on'); fading = false; }, 120); }, reduceMotion ? 30 : 400);
}
function enterVenue(w, then) {
  transition(() => {
    const sp = VENUES[w].spawn;
    setWhere(w);
    player.x = sp.x; player.z = sp.z; player.yaw = sp.yaw; player.v = 0; player.dance = 0;
    camState.yaw = sp.yaw; camState.pitch = .12;
    if (w === 'club' && quest.n === 3) setQuest(4);
    toast(VENUES[w].toast);
    if (then) then();
  });
}
function exitVenue(then) {
  const w = player.where;
  transition(() => {
    setWhere('out');
    const o = VENUES[w].out;
    player.x = o.x; player.z = o.z; player.yaw = o.yaw;
    player.v = 0; camState.yaw = player.yaw; camState.pitch = .1;
    if (then) then();
  });
}
// 其他模組可以掛進來的互動（車行、車庫）：回傳 { key, text, fn } 或 null
const ctxHooks = [];
const ctxLate = [];   // 比門口、櫃台這些固定的互動提示後問（69-v3-world.js 的招計程車：路過的計程車不該蓋掉門口的「進入」）
// 依位置找出目前可以做的事，回傳 { key, text, fn }
function contextAction() {
  const p = player;
  // 街上的點是邏輯座標（場館門口、車行……），換成世界座標再量；室內的座標本來就是場館自己的
  const near = (x, z, r) => { if (p.where === 'out') [x, z] = toW(x, z); return Math.hypot(p.x - x, p.z - z) < r; };
  if (p.air3) return null;   // 69-v3-crash.js 的空中（跳傘、被拋出去）：地面上的互動都不算
  for (const h of ctxHooks) { const r = h(p, near); if (r) return r; }
  if (p.mode === 'drive') {
    const v = p.veh;
    const rs = resprayCtx(v); if (rs) return rs;   // 通緝中：CHROME WORKS 噴漆消星（69-crew.js）
    const cw = chromeCtx(v); if (cw) return cw;   // 自己的車停在門口：開進 CHROME WORKS 改裝（66-chrome.js）
    return Math.hypot(v.vx, v.vz) < 4 ? { key: 'F', text: v.boat ? '下船' : '下車', fn: exitVehicle } : null;
  }
  if (p.where === 'out') {
    // 門和 Marlo 只差一步：放行之後門優先，之前 Marlo 優先
    if (quest.n >= 3 && near(CLUB_X, CLUB_Z + .6, 1.6)) return { key: 'E', text: '進入 LAZARUS', fn: () => enterVenue('club') };
    if (near(BOUNCER.x, BOUNCER.z, 2.4)) return { key: 'E', text: '跟 Marlo 說話', fn: talkMarlo };
    if (near(CLUB_X, CLUB_Z + .6, 1.6)) return quest.n >= 3 ? { key: 'E', text: '進入 LAZARUS', fn: () => enterVenue('club') } : { key: 'E', text: '門鎖著 <i>· 先跟門口的人談</i>', fn: () => toast('Marlo 擋在門前') };
    if (near(BAR_X - 4.6, BAR_Z + .6, 1.6)) return { key: 'E', text: '進入 AFTERGLOW', fn: () => enterVenue('bar') };
    for (const v of vehicles) if (!v.dead && (v.boat || Math.abs(p.y - (v.y || 0)) < 2.5) && Math.hypot(p.x - v.x, p.z - v.z) < (v.boat ? 6.5 : v.isCar ? 3.2 : 2.2)) return { key: 'F', text: `${v.boat ? '上船' : '上車'} <i>· ${v.name}</i>`, fn: () => enterVehicle(v) };
  } else if (p.where === 'bar') {
    if (near(BAR_EXIT.x, BAR_EXIT.z, 1.5)) return { key: 'E', text: '回到街上', fn: exitVenue };
    if (near(JUNO.x, JUNO.z, 1.8)) return { key: 'E', text: '跟 Juno 說話', fn: talkJuno };
  } else if (p.where === 'club') {
    if (near(CLUB_EXIT.x, CLUB_EXIT.z, 1.5)) return { key: 'E', text: '回到街上', fn: exitVenue };
    if (near(-8.6, 12.5, 2.2)) return { key: 'E', text: '點一杯', fn: () => { sfx.glass(); post.wobble = .6; toast('酒保推來一杯發光的東西'); } };
    if (Math.abs(p.x) < 6 && p.z > 13 && p.z < 25 && !p.dance) return { key: 'G', text: '跳舞', fn: () => toggleDance() };
  }
  for (const h of ctxLate) { const r = h(p, near); if (r) return r; }
  return null;
}
// CHROME WORKS 換色（在改裝廠裡，66-chrome.js 的改裝選單）：第一個選項是這台車的原廠色，換完記在車庫存檔裡
const LIVERIES = [[0x8a1018, '酒紅'], [0x3c4148, '槍灰'], [0x0d3b5c, '午夜藍'], [0xd8d4c8, '珍珠白'], [0x1b1c1f, '消光黑'], [0xc9a227, '香檳金'], [0x2f6a3a, '賽車綠']];
function cycleLivery() {
  const id = kestrel.carId;
  if (CARS[id].glb && !CARS[id].paintable) return toast(`${CARS[id].name} 是原廠彩繪，CHROME WORKS 不敢動`);
  const opts = [[CARS[id].paint, '原廠色'], ...LIVERIES.filter(l => l[0] !== CARS[id].paint)];
  const k = (opts.findIndex(o => o[0] === kestrel.paint) + 1) % opts.length;
  applyCar(kestrel, id, opts[k][0]); poseVehicle(kestrel);
  motors.paint[id] = opts[k][0]; saveMotors();
  sfx.spray(); toast(`塗裝：${opts[k][1]}`);
}
function toggleDance() {
  if (player.mode !== 'walk') return;
  player.dance = player.dance ? 0 : 1 + Math.floor(Math.random() * DANCES.length);
  player.v = 0;
}
function enterVehicle(v) {
  player.mode = 'drive'; player.veh = v; v.lights = v.flood ? 0 : 1;
  me.mesh.visible = v.isCar ? false : true;
  sfx.doorCar(v.isCar); if (!vdIdleTake(v) && !v.flood) sfx.engineOn(v);   // 68-vdetail.js：長按 F 下車沒熄火的車回來不用重新發動；泡水的車發不動
  camState.snap = false;
}
function exitVehicle(keep, idle) {   // keep：留著車速（69-kinema.js 的跳車）；idle：長按 F，引擎不熄（68-vdetail.js）
  const v = player.veh;
  if (v.boat) return boatExit(v);   // 31-boats.js：站到最近的岸上，沒有就下水
  const lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw);   // 車身左側（+x 方向轉到世界）
  let x = v.x + lx * (v.isCar ? 1.5 : .9), z = v.z + lz * (v.isCar ? 1.5 : .9);
  colY = v.y; const r = collideCircle(x, z, .32, false); colY = 0; x = r.x; z = r.z;
  player.x = x; player.z = z; player.y = v.y; player.yaw = v.yaw; player.mode = 'walk'; player.veh = null; player.v = 0;   // y：在快速道路橋面上下車就站在橋面
  v.lights = 0; if (!keep) v.vx = v.vz = 0; v.brakeOn = 0; v.steer = 0;
  me.mesh.visible = true;
  sfx.doorCar(v.isCar);
  if (idle) vdIdleLeave(v); else sfx.engineOff();
}
let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); toastT = 2.6; }
