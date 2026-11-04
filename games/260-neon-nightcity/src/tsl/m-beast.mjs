// 材質 "beast"：海獸（21-rigbeast.js）的下載模型 assets/260/beast/turtle_kaiju.glb（tools/beast-glb.mjs 處理過）
// 頂點：原檔沒有骨架，tools/beast-glb.mjs 照部位寫了 _BONE（x＝骨頭編號、y＝權重）；uBn 每根骨頭三列（3×4 的剛體變換，模型座標），
//   0 號是身體（單位矩陣），頂點在原位與骨頭變換後的位置之間照權重內插（法線、切線一樣）。
// 片段：底色、法線（切線空間）、ORM（R 遮蔽、G 粗糙、B 金屬）三張貼圖，照 shade() 打光；剛出水的濕身（uBw.x）讓底色變深、粗糙變小、多一層環境反射，
//   水線以下（uBw.y 是海面高度）再更濕，往上一條條往下流的水痕（uBw.z 是時間）。
const LIBK = '[]NL_T,NOCC_T,SH_N_T,VOL_N_T';
const SH = ['uTime', 'uLampOn', 'uFlash', 'uClipY', 'uWet', 'uFogDen', 'uBeat', 'uRain', 'uLit', 'uLamp', 'uCullR'].map(n => ({ name: n, type: 'float', src: n }))
  .concat([['uCam', 'vec3'], ['uFogCol', 'vec3'], ['uFogHi', 'vec3'], ['uAmbTop', 'vec3'], ['uAmbBot', 'vec3'], ['uFocus', 'vec4']].map(([n, t]) => ({ name: n, type: t, src: n })))
  .concat(['uLP', 'uLC', 'uLD'].map(n => ({ name: n, type: 'vec4', size: 'NL_T', src: n })))
  .concat([['uCity', 'vec4'], ['uGrid', 'vec2'], ['uLampT', 'sampler2D'], ['uLampG', 'vec4'], ['uZone', 'vec4'], ['uDay', 'float'], ['uCloud', 'float'], ['uSun', 'vec3'], ['uSunCol', 'vec3'], ['uSkyTop', 'vec3'], ['uSkyHor', 'vec3'], ['uMoon', 'vec3'],
    ['uHMap', 'sampler2D'], ['uCityM', 'sampler2D'], ['uTMap', 'sampler2D'], ['uFMap', 'sampler2D'], ['uHM', 'vec4'], ['uAHMap', 'sampler2D'], ['uAHM', 'vec4'], ['uAirA', 'vec4'], ['uAirB', 'vec4'], ['uTM', 'vec4'], ['uFM', 'vec4'], ['uGI', 'vec4']].map(([n, t]) => ({ name: n, type: t, src: n })))
  .concat(['uOccA', 'uOccB'].map(n => ({ name: n, type: 'vec4', size: 'NOCC_T', src: n })));
const UNI = [{ name: 'uMap', type: 'sampler2D', src: 'uMap' }, { name: 'uNMap', type: 'sampler2D', src: 'uNMap' }, { name: 'uOrm', type: 'sampler2D', src: 'uOrm' },
  { name: 'uBn', type: 'vec4', size: 'BEAST_BONES', src: 'uBn' }, { name: 'uBw', type: 'vec4', src: 'uBw' }, ...SH];
const VAR = [{ name: 'vW', type: 'vec3', src: 'vW' }, { name: 'vN', type: 'vec3', src: 'vN' }, { name: 'vT', type: 'vec4', src: 'vT' }, { name: 'vUv', type: 'vec2', src: 'vUv' }];
const ATT = [{ name: 'aBn', type: 'vec2', src: '_bone' }, { name: 'aTan', type: 'vec4', src: 'tangent' }];

export default {
"{}": {
  h: '', fog: true, lib: LIBK, libV: false, libF: true, uniforms: UNI, varyings: VAR, attributes: ATT,
  vertex: (TSL, E) => {
    const { vec3, vec4, mat3, int, dot, normalize, mix, Fn } = TSL;
    const { uBn, aBn, aTan, position, normal, uv, modelMatrix, viewMatrix, projectionMatrix, vW, vN, vT, vUv } = E;
    return Fn(() => {
      const i = int(aBn.x).mul(3), w = aBn.y;
      const r0 = uBn.element(i).toVar(), r1 = uBn.element(i.add(1)).toVar(), r2 = uBn.element(i.add(2)).toVar();
      const xf = (p, k) => vec3(dot(r0.xyz, p).add(r0.w.mul(k)), dot(r1.xyz, p).add(r1.w.mul(k)), dot(r2.xyz, p).add(r2.w.mul(k)));
      const p = mix(position, xf(position, 1), w);
      const n = mix(normal, xf(normal, 0), w), t = mix(aTan.xyz, xf(aTan.xyz, 0), w);
      const wp = modelMatrix.mul(vec4(p, 1)).toVar(), M = mat3(modelMatrix);
      vW.assign(wp.xyz);
      vN.assign(normalize(M.mul(n)));
      vT.assign(vec4(normalize(M.mul(t)), aTan.w));
      vUv.assign(uv);
      return projectionMatrix.mul(viewMatrix).mul(wp);
    });
  },
  fragment: (TSL, E) => {
    const { vec3, vec4, If, Discard, normalize, cross, mix, max, min, dot, clamp, reflect, pow, sub, add, mul, smoothstep, fract, sin, abs, Fn } = TSL;
    const { uMap, uNMap, uOrm, uBw, uClipY, uCam, uWet, vW, vN, vT, vUv, frontFacing_, shade, envMap, applyFog } = E;
    return Fn(() => {
      If(vW.y.lessThan(uClipY), () => { Discard(); });
      const base = uMap.sample(vUv).rgb.toVar(), orm = uOrm.sample(vUv).toVar(), tn = uNMap.sample(vUv).xyz.mul(2).sub(1).toVar();
      const N0 = normalize(vN).toVar();
      If(frontFacing_.not(), () => { N0.assign(N0.negate()); });
      const Tt = normalize(vT.xyz.sub(N0.mul(dot(N0, vT.xyz)))).toVar(), Bt = cross(N0, Tt).mul(vT.w).toVar();
      const n = normalize(Tt.mul(tn.x).add(Bt.mul(tn.y)).add(N0.mul(tn.z))).toVar();
      const v = normalize(uCam.sub(vW)).toVar();
      // 濕身：整體（剛出水）＋水線附近＋往下流的水痕
      const dh = vW.y.sub(uBw.y).toVar();
      const streak = smoothstep(.55, .95, abs(sin(vUv.x.mul(310.).add(sin(vUv.y.mul(23.)).mul(2.)))).mul(fract(vUv.y.mul(7.).add(uBw.z.mul(.35)).add(vUv.x.mul(53.)))));
      const wet = clamp(max(uBw.x.mul(add(.7, streak.mul(.3))), sub(1., smoothstep(0., 4., dh)).mul(uBw.w)).add(uWet.mul(.5)), 0., 1.).toVar();
      base.mulAssign(mix(1., .55, wet));
      const rough = clamp(orm.g.mul(mix(1., .35, wet)), .08, 1.).toVar(), metal = clamp(orm.b, 0., 1.).toVar(), ao = orm.r.toVar();
      const c = shade(vW, n, v, base, rough, metal).mul(mix(.3, 1., ao)).toVar();
      const r = reflect(v.negate(), n).toVar();
      const F = add(.04, mul(.96, pow(sub(1., max(dot(n, v), 0.)), 5.))).toVar();
      c.addAssign(envMap(r).mul(F).mul(wet.mul(.9).add(.06)).mul(sub(1., min(rough, 1.).mul(.85))).mul(ao));
      return vec4(applyFog(c, vW), 1.);
    });
  },
},
};
