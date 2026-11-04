// 材質 "rigFx"：海上鑽油平台（21-rig.js）的特效，鍵是 defines 的形狀：
//   FLAME 火炬臂尖端的火舌（幾片沿風彎、面向相機的雜訊火焰，加成混合）  SMOKE 火焰上方往下風飄的黑煙（預乘 alpha）
//   RAIN  只下在平台四周的斜雨（每條雨絲一片拉長的細條，順風斜落、落到海面消失，被火炬照到的是橘的）  BEAM 拖船探照燈的光柱（開口圓錐，加成）
// 位置都在頂點著色器算（世界座標）；加成的顏色用 applyFog(c) − applyFog(0) 只留下被霧衰減的部分。
//   SPRAY 海獸（21-rigbeast.js）身上往下流、往外甩的水幕（每條一片順著速度拉長的細條，拋物線落回海面，加成）
// uRigP：火炬尖端 xyz、火焰的閃爍；uRigR：平台中心 xz、雨區半徑、雨落到的高度；uRigS：水幕中心 xz、身體半徑、強度；uRigS2：最高點 y、海面 y
import { RIG_WIND } from '../rigwave.mjs';

const LIBK = '[]NL_T,NOCC_T,SH_N_T,VOL_N_T';
const SH = ['uTime', 'uLampOn', 'uFlash', 'uClipY', 'uWet', 'uFogDen', 'uBeat', 'uRain', 'uLit', 'uLamp', 'uCullR'].map(n => ({ name: n, type: 'float', src: n }))
  .concat([['uCam', 'vec3'], ['uFogCol', 'vec3'], ['uFogHi', 'vec3'], ['uAmbTop', 'vec3'], ['uAmbBot', 'vec3'], ['uFocus', 'vec4']].map(([n, t]) => ({ name: n, type: t, src: n })))
  .concat(['uLP', 'uLC', 'uLD'].map(n => ({ name: n, type: 'vec4', size: 'NL_T', src: n })))
  .concat([['uCity', 'vec4'], ['uGrid', 'vec2'], ['uLampT', 'sampler2D'], ['uLampG', 'vec4'], ['uZone', 'vec4'], ['uDay', 'float'], ['uCloud', 'float'], ['uSun', 'vec3'], ['uSunCol', 'vec3'], ['uSkyTop', 'vec3'], ['uSkyHor', 'vec3'], ['uMoon', 'vec3'],
    ['uHMap', 'sampler2D'], ['uCityM', 'sampler2D'], ['uTMap', 'sampler2D'], ['uFMap', 'sampler2D'], ['uHM', 'vec4'], ['uAHMap', 'sampler2D'], ['uAHM', 'vec4'], ['uAirA', 'vec4'], ['uAirB', 'vec4'], ['uTM', 'vec4'], ['uFM', 'vec4'], ['uGI', 'vec4']].map(([n, t]) => ({ name: n, type: t, src: n })))
  .concat(['uOccA', 'uOccB'].map(n => ({ name: n, type: 'vec4', size: 'NOCC_T', src: n })));
const UNI = [{ name: 'uRigP', type: 'vec4', src: 'uRigP' }, { name: 'uRigR', type: 'vec4', src: 'uRigR' }, { name: 'uRigS', type: 'vec4', src: 'uRigS' }, { name: 'uRigS2', type: 'vec4', src: 'uRigS2' }, ...SH];
const VAR = [{ name: 'vW', type: 'vec3', src: 'vW' }, { name: 'vQ', type: 'vec4', src: 'vQ' }];
const base = (attributes, vertex, fragment) => ({ h: '', fog: true, lib: LIBK, libV: false, libF: true, uniforms: UNI, varyings: VAR, attributes, vertex, fragment });
const rs = (TSL, hi, lo, x) => TSL.float(1).sub(TSL.smoothstep(lo, hi, x));   // 反過來的 smoothstep
// 加成：只留下被霧衰減的部分
const addFog = (E, c, p) => E.applyFog(c, p).sub(E.applyFog(c.mul(0), p));
const WX = RIG_WIND[0], WZ = RIG_WIND[1];

// 沿風彎的四邊形：aQ = (角落 x −1..1, 沿長 0..1, 種子, 大小)
const flameVert = (TSL, E) => {
  const { vec3, vec4, normalize, cross, Fn } = TSL;
  const { uRigP, aQ, vW, vQ, cameraPosition, viewMatrix, projectionMatrix } = E;
  return Fn(() => {
    const H = aQ.w.mul(30), Wd = aQ.w.mul(9.5), cy = aQ.y, wv = vec3(WX, 0, WZ);
    const ctr = uRigP.xyz.add(vec3(0, cy.mul(H), 0)).add(wv.mul(cy.mul(cy).mul(H).mul(.8)));
    const ax = normalize(vec3(0, H, 0).add(wv.mul(cy.mul(H).mul(1.6))));
    const w = ctr.add(normalize(cross(ax, ctr.sub(cameraPosition))).mul(aQ.x.mul(Wd)));
    vW.assign(w); vQ.assign(aQ);
    return projectionMatrix.mul(viewMatrix).mul(vec4(w, 1));
  });
};
const smokeVert = (TSL, E) => {
  const { vec3, vec4, normalize, cross, Fn } = TSL;
  const { uRigP, aQ, vW, vQ, cameraPosition, viewMatrix, projectionMatrix } = E;
  return Fn(() => {
    const H = aQ.w.mul(55), Wd = aQ.w.mul(16), cy = aQ.y, wv = vec3(WX, 0, WZ);
    const ctr = uRigP.xyz.add(vec3(WX * 14, 21, WZ * 14)).add(vec3(WX, .5, WZ).mul(cy.mul(H))).add(wv.mul(cy.mul(cy).mul(H).mul(.5)));
    const ax = normalize(vec3(WX, .5, WZ));
    const w = ctr.add(normalize(cross(ax, ctr.sub(cameraPosition))).mul(aQ.x.mul(Wd.mul(cy.mul(1.4).add(.45)))));
    vW.assign(w); vQ.assign(aQ);
    return projectionMatrix.mul(viewMatrix).mul(vec4(w, 1));
  });
};

export default {
'{"FLAME":""}': base([{ name: 'aQ', type: 'vec4', src: 'aQ' }], flameVert, (TSL, E) => {
  const { vec2, vec3, vec4, float, abs, pow, max, mix, smoothstep, clamp, Fn } = TSL;
  const { uTime, uRigP, vQ, vW, n2 } = E;
  return Fn(() => {
    const x = vQ.x, y = vQ.y, s = vQ.z, t = uTime;
    const a1 = n2(vec2(x.mul(1.6).add(s), y.mul(2.2).sub(t.mul(2.8)))).sub(.5).mul(2), a2 = n2(vec2(x.mul(4.2).add(s.mul(3)), y.mul(5.5).sub(t.mul(5.5)))).sub(.5).mul(2);
    const xx = x.add(a1.mul(.28).mul(y.add(.2))).add(a2.mul(.08));
    const wid = pow(max(float(1).sub(y), 0), .55).mul(smoothstep(0, .12, y)).mul(.78).add(.02);
    const body = rs(TSL, 1, .25, abs(xx).div(wid));
    const er = smoothstep(0, .55, a1.mul(.5).add(a2.mul(.3)).add(float(1).sub(y).mul(1.1)).sub(.35));
    const I = clamp(body.mul(er), 0, 1);
    const col = mix(vec3(.9, .12, .02), vec3(1, .45, .07), smoothstep(.15, .5, I)).toVar();
    col.assign(mix(col, vec3(1, .78, .4), smoothstep(.7, .98, I)));
    const c = col.mul(I.mul(uRigP.w).mul(vQ.w.mul(-.35).add(1.2)).mul(1.05));
    return vec4(addFog(E, c, vW), 1);
  });
}),
'{"SMOKE":""}': base([{ name: 'aQ', type: 'vec4', src: 'aQ' }], smokeVert, (TSL, E) => {
  const { vec2, vec3, vec4, abs, smoothstep, clamp, Fn } = TSL;
  const { uTime, uRigP, uAmbTop, vQ, vW, n2, applyFog } = E;
  return Fn(() => {
    const x = vQ.x, y = vQ.y, s = vQ.z, t = uTime;
    const a1 = n2(vec2(x.mul(1.3).add(s), y.mul(1.8).sub(t.mul(.5)))), a2 = n2(vec2(x.mul(3.6).add(s.mul(2)), y.mul(4.2).sub(t.mul(.9))));
    const wid = smoothstep(0, .25, y).mul(.6).add(.4);
    const m = rs(TSL, 1, .3, abs(x).div(wid)).mul(smoothstep(0, .06, y)).mul(rs(TSL, 1, .5, y));
    const a = clamp(m.mul(a1.mul(.9).add(a2.mul(.5)).sub(.3)).mul(1.5), 0, 1).mul(.6);
    const c = vec3(.014, .013, .012).add(uAmbTop.mul(.35)).add(vec3(.32, .1, .02).mul(rs(TSL, .45, 0, y)).mul(uRigP.w).mul(.5));
    return vec4(applyFog(c, vW).mul(a), a);
  });
}),
'{"RAIN":""}': base([{ name: 'aR', type: 'vec4', src: 'aR' }], (TSL, E) => {
  const { vec2, vec3, vec4, float, fract, mod, normalize, cross, length, max, smoothstep, Fn } = TSL;
  const { uTime, uRigR: uRig, aR, position, vW, vQ, cameraPosition, viewMatrix, projectionMatrix } = E;
  return Fn(() => {
    const TOP = 150, HH = 160, SL = .42, R = uRig.z, r = aR;
    const ph = fract(r.z.add(uTime.mul(r.w.mul(.3).add(.85).mul(26 / HH))));
    const y = float(TOP).sub(ph.mul(HH)), drift = float(TOP).sub(y).mul(SL);
    const x = mod(r.x.mul(R.mul(2)).add(drift.mul(WX)), R.mul(2)).sub(R).add(uRig.x), z = mod(r.y.mul(R.mul(2)).add(drift.mul(WZ)), R.mul(2)).sub(R).add(uRig.y);
    const D = normalize(vec3(WX * SL, -1, WZ * SL)), len = r.w.mul(1.4).add(2);
    const b = vec3(x, y, z).add(D.mul(len.mul(position.y)));
    const rt = normalize(cross(D, b.sub(cameraPosition))), dc = length(b.sub(cameraPosition));
    const w = b.add(rt.mul(position.x.mul(max(dc.mul(.0011), .025))));
    // 圓柱形的雨區（邊緣淡掉）、雨頂淡入、落到海面（浪最高約 3 m）以下不畫、離相機太近也淡掉（不然一條條糊在鏡頭上）
    const k = rs(TSL, R, R.mul(.72), length(vec2(x, z).sub(uRig.xy))).mul(rs(TSL, TOP, TOP - 25, y)).mul(smoothstep(uRig.w, uRig.w.add(2.5), y)).mul(smoothstep(2, 8, dc));
    vW.assign(w); vQ.assign(vec4(position.x, k, 0, 0));
    return projectionMatrix.mul(viewMatrix).mul(vec4(w, 1));
  });
}, (TSL, E) => {
  const { vec3, vec4, abs, dot, Fn } = TSL;
  const { uRigP, uAmbTop, uLampOn, vQ, vW } = E;
  return Fn(() => {
    const a = rs(TSL, 1, 0, abs(vQ.x)).mul(vQ.y);
    const dl = uRigP.xyz.sub(vW), fl = vec3(1, .45, .12).mul(uRigP.w.mul(1400).div(dot(dl, dl).add(400)));
    const c = vec3(.07, .08, .095).mul(uLampOn.mul(.6).add(.4)).add(uAmbTop.mul(.55)).add(fl);
    return vec4(addFog(E, c.mul(a).mul(.55), vW), 1);
  });
}),
'{"BEAM":""}': base([], (TSL, E) => {
  const { vec4, Fn } = TSL;
  const { position, modelMatrix, vW, vQ, viewMatrix, projectionMatrix } = E;
  return Fn(() => {
    const w = modelMatrix.mul(vec4(position, 1));
    vW.assign(w.xyz); vQ.assign(vec4(position, 0));
    return projectionMatrix.mul(viewMatrix).mul(w);
  });
}, (TSL, E) => {
  const { vec3, vec4, abs, pow, dot, normalize, cross, dFdx, dFdy, smoothstep, Fn } = TSL;
  const { uLampOn, vQ, vW, uCam } = E;
  return Fn(() => {
    const n = normalize(cross(dFdx(vW), dFdy(vW))), v = normalize(uCam.sub(vW));
    const along = vQ.y.negate();
    const k = pow(abs(dot(n, v)), 1.6).mul(rs(TSL, 1, .1, along)).mul(rs(TSL, 1, 0, along)).mul(smoothstep(0, .12, along)).mul(.16).mul(uLampOn.mul(.75).add(.25));
    return vec4(addFog(E, vec3(1, .93, .8).mul(k), vW), 1);
  });
}),
'{"SPRAY":""}': base([{ name: 'aR', type: 'vec4', src: 'aR' }], (TSL, E) => {
  const { vec3, vec4, float, fract, normalize, cross, length, max, cos, sin, mix, smoothstep, Fn } = TSL;
  const { uTime, uRigS, uRigS2, aR, position, vW, vQ, cameraPosition, viewMatrix, projectionMatrix } = E;
  return Fn(() => {
    // aR = (方位, 起點高度, 相位, 大小)；週期 2.6 s：從身上某個高度往外以 vo 甩出、照重力落下，落到海面以下就不畫
    const r = aR, P = 2.6, a = r.x.mul(6.2832), tt = fract(uTime.div(P).add(r.z)).mul(P);
    const h0 = mix(uRigS2.y.add(1.5), uRigS2.x, r.y.mul(r.y)), vo = mix(1.2, 7.5, r.w), r0 = uRigS.z.mul(mix(.55, 1.05, r.w));
    const dx = cos(a), dz = sin(a), y = h0.sub(tt.mul(tt).mul(4.9));
    const b = vec3(uRigS.x.add(dx.mul(r0.add(vo.mul(tt)))), y, uRigS.y.add(dz.mul(r0.add(vo.mul(tt)))));
    const V = vec3(dx.mul(vo), tt.mul(-9.8).sub(.5), dz.mul(vo)), D = normalize(V), len = length(V).mul(.12).add(1.2);
    const c = b.add(D.mul(len.mul(position.y)));
    const rt = normalize(cross(D, c.sub(cameraPosition))), dc = length(c.sub(cameraPosition));
    const w = c.add(rt.mul(position.x.mul(max(dc.mul(.0016), r.w.mul(.35).add(.12)))));
    const k = uRigS.w.mul(smoothstep(uRigS2.y, uRigS2.y.add(1.5), y)).mul(float(1).sub(smoothstep(P * .7, P, tt))).mul(smoothstep(2, 8, dc));
    vW.assign(w); vQ.assign(vec4(position.x, k, position.y, 0));
    return projectionMatrix.mul(viewMatrix).mul(vec4(w, 1));
  });
}, (TSL, E) => {
  const { vec3, vec4, abs, dot, Fn } = TSL;
  const { uRigP, uAmbTop, uLampOn, uDay, vQ, vW } = E;
  return Fn(() => {
    const a = rs(TSL, 1, 0, abs(vQ.x)).mul(vQ.y).mul(rs(TSL, 1, .55, vQ.z).mul(.7).add(.3));
    const dl = uRigP.xyz.sub(vW), fl = vec3(1, .45, .12).mul(uRigP.w.mul(1400).div(dot(dl, dl).add(400)));
    const c = vec3(.09, .1, .11).mul(uLampOn.mul(.6).add(.4)).add(uAmbTop.mul(.8)).add(vec3(.25, .27, .28).mul(uDay)).add(fl);
    return vec4(addFog(E, c.mul(a).mul(.5), vW), 1);
  });
}),
};
