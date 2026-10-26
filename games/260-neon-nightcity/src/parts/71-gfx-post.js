// ═══ 後製的 TSL 版本（?gfx=webgpu，02-gfx.js）：70-render.js 的泛光（mPre／mDown／mUp）與合成（mComp），照 GLSL 逐行改寫 ═══
// 70-render.js 照舊用 blit() 換材質畫全螢幕三角形、改 uniforms 的值，這裡只換著色器。體積光（mVol）要 00-core.js 的 GL_LIB，還沒改寫前輸出 0
if (GFX !== 'webgl') {
  const { Fn, If, Loop, vec2, vec3, vec4, float, uv, mix, smoothstep, clamp, max, min, pow, dot, length, fract, sin, cos, abs, positionGeometry } = TSL;
  const passMat = frag => { const m = new NodeMaterial(); m.vertexNode = vec4(positionGeometry.xy, 0, 1); m.fragmentNode = frag; return m; };
  // three 的渲染目標貼圖一律當左上角是原點（WebGPU 原生如此，WebGL2 後端取樣時自己翻），全螢幕三角形的 uv 是左下角原點：取樣用 Q（v 翻過來），
  // 換到 NDC 時 y 也要反過來（ndcOf／uvOf）；70-render.js 傳進來的畫面座標（熱源）是左下角原點
  const Q = vec2(uv().x, uv().y.oneMinus());
  const ndcOf = q => vec2(q.x.mul(2).sub(1), q.y.mul(-2).add(1)), uvOf = n => vec2(n.x.mul(.5).add(.5), n.y.mul(-.5).add(.5));
  const LUM = vec3(.2126, .7152, .0722);
  gfxPort(mPre, m => {
    const u = m.uniforms, src = gfxT(u.tSrc), tx = gfxU(u.uTexel), thr = gfxU(u.uThr);
    // MSAA 邊緣外插偶爾算出 NaN／inf：x ≠ x 擋 NaN，再夾在 0..60
    const tap = o => { const c = src(Q.add(tx.mul(o))).rgb; return min(max(TSL.select(TSL.any(c.notEqual(c)), vec3(0), c), vec3(0)), vec3(60)); };
    return passMat(Fn(() => {
      const c = tap(vec2(-1, -1)).add(tap(vec2(1, -1))).add(tap(vec2(-1, 1))).add(tap(vec2(1, 1))).mul(.25).toVar();
      const w = smoothstep(thr.mul(.7), thr.mul(1.7), max(c.r, max(c.g, c.b)));
      return vec4(min(c.mul(w), vec3(30)), 1);
    })());
  });
  gfxPort(mDown, m => {
    const u = m.uniforms, src = gfxT(u.tSrc), t = gfxU(u.uTexel);
    const s = (x, y) => src(Q.add(t.mul(vec2(x, y)))).rgb;
    return passMat(vec4(s(0, 0).mul(.125)
      .add(s(-2, -2).add(s(2, -2)).add(s(-2, 2)).add(s(2, 2)).mul(.03125))
      .add(s(0, -2).add(s(-2, 0)).add(s(2, 0)).add(s(0, 2)).mul(.0625))
      .add(s(-1, -1).add(s(1, -1)).add(s(-1, 1)).add(s(1, 1)).mul(.125)), 1));
  });
  gfxPort(mUp, m => {
    const u = m.uniforms, src = gfxT(u.tSrc), add = gfxT(u.tAdd), t = gfxU(u.uTexel), k = gfxU(u.uK);
    const s = (x, y) => src(Q.add(t.mul(vec2(x, y)))).rgb;
    const sum = s(0, 0).mul(4).add(s(1, 0).add(s(-1, 0)).add(s(0, 1)).add(s(0, -1)).mul(2)).add(s(1, 1)).add(s(-1, -1)).add(s(1, -1)).add(s(-1, 1));
    return passMat(vec4(add(Q).rgb.add(sum.div(16).mul(k)), 1));
  });
  if (mVol) gfxPort(mVol, () => passMat(vec4(0, 0, 0, 1)));
  gfxPort(mComp, m => {
    const u = m.uniforms, G = k => gfxU(u[k]);
    const tScene = gfxT(u.tScene), tDepth = gfxT(u.tDepth), tBloom = gfxT(u.tBloom), tVol = gfxT(u.tVol);
    const volOn = G('uVolOn'), volT = G('uVolT'), invVP = G('uInvVP'), prevVP = G('uPrevVP'), blur = G('uBlur'), ex = G('uExp'), time = G('uTime'), wob = G('uWob'), flash = G('uFlash'),
      bloomK = G('uBloomK'), gray = G('uGray'), vig = G('uVig'), hurt = G('uHurt'), tint = G('uTint'), fx7 = G('uFx7'), res = G('uRes'), fx = G('uFx'), hi = G('uHi'), heat = gfxU(u.uHeat, 'vec4');
    const h = p => fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453));
    const aces = x => clamp(x.mul(x.mul(2.51).add(.03)).div(x.mul(x.mul(2.43).add(.59)).add(.14)), 0, 1);
    return passMat(Fn(() => {
      const p = Q.toVar();
      If(wob.greaterThan(0), () => { p.addAssign(vec2(sin(p.y.mul(8).add(time.mul(1.7))), cos(p.x.mul(6).add(time.mul(1.3)))).mul(wob.mul(.006))); });
      If(fx7.y.greaterThan(0), () => { p.addAssign(vec2(sin(p.y.mul(14).add(time.mul(3.1))), cos(p.x.mul(11).add(time.mul(2.3)))).mul(fx7.y.mul(.005))); });
      // 動態模糊：深度反推世界座標，投到上一幀的畫面算速度
      const wp = invVP.mul(vec4(ndcOf(p), gfxZ(tDepth(p).x), 1)).toVar(); wp.divAssign(wp.w);
      const pc = prevVP.mul(wp), vel = p.sub(uvOf(pc.xy.div(pc.w))).mul(blur).toVar(), vl = length(vel);
      If(vl.greaterThan(.045), () => { vel.mulAssign(float(.045).div(vl)); });
      const c = vec3(0).toVar(), ws = float(0).toVar(), j = h(p.mul(res).add(time)).sub(.5);
      Loop(9, ({ i }) => { const t = float(i).add(j).div(8).sub(.5), w = float(1).sub(abs(t).mul(.8)); c.addAssign(tScene(p.add(vel.mul(t))).rgb.mul(w)); ws.addAssign(w); });
      c.divAssign(ws);
      c.assign(TSL.select(TSL.any(c.notEqual(c)), vec3(0), c));
      // 邊緣的色散
      const cc = p.sub(.5), edge = dot(cc, cc);
      c.assign(vec3(mix(c.r, tScene(p.sub(cc.mul(edge).mul(.012))).r, fx.x.mul(.6)), c.g, mix(c.b, tScene(p.add(cc.mul(edge).mul(.012))).b, fx.x.mul(.6))));
      If(wob.greaterThan(0), () => { c.assign(mix(c, tScene(p.add(vec2(.012, 0).mul(wob))).rgb, wob.mul(.35))); });
      If(fx7.z.greaterThan(0), () => {
        const o = vec2(.007, .005).mul(fx7.z);
        c.assign(mix(c, tScene(p.add(o)).rgb.add(tScene(p.sub(o)).rgb).add(tScene(p.add(vec2(o.y.negate(), o.x))).rgb).add(tScene(p.add(vec2(o.y, o.x.negate()))).rgb).mul(.25), min(fx7.z, 1).mul(.75)));
      });
      c.addAssign(tBloom(p).rgb.mul(bloomK));
      If(volOn.greaterThan(0), () => { c.addAssign(tVol(p.add(volT.mul(vec2(.5, .5)))).rgb.add(tVol(p.add(volT.mul(vec2(-.5, .5)))).rgb).add(tVol(p.add(volT.mul(vec2(.5, -.5)))).rgb).add(tVol(p.sub(volT.mul(.5))).rgb).mul(.25)); });
      c.mulAssign(ex.mul(flash.mul(.5).add(1)));
      // 高光肩部（場館的 ENV.post.knee／range）
      If(hi.x.greaterThan(0), () => { const L = max(max(c.r, c.g), c.b).toVar(); If(L.greaterThan(hi.x), () => { const e = L.sub(hi.x); c.mulAssign(hi.x.add(e.div(e.div(hi.y).add(1))).div(L)); }); });
      c.assign(aces(c));
      // 調色：暗部偏青、亮部偏暖
      const l = dot(c, LUM).toVar();
      c.assign(mix(c, c.mul(vec3(.86, 1.02, 1.08)), float(1).sub(l).mul(.35)));
      c.assign(mix(c, c.mul(vec3(1.06, 1, .9)), l.mul(.25)));
      c.mulAssign(float(1).sub(edge.mul(.9)));
      If(tint.w.greaterThan(0), () => { c.assign(mix(c, vec3(dot(c, LUM)).mul(tint.rgb).add(c.mul(.25)), tint.w)); });
      // 熱成像（69-v7-bunker.js）
      If(fx7.x.greaterThan(0), () => {
        const ht = float(0).toVar(), th = mix(vec3(.04, .02, .14), vec3(.3, .14, .46), smoothstep(0, .9, dot(c, LUM))).toVar();
        Loop(HEAT_N, ({ i }) => {
          const q = heat.element(i);
          If(q.w.greaterThan(0), () => { const dd = p.sub(vec2(q.x, q.y.oneMinus())).mul(vec2(res.x.div(res.y), .55)); ht.assign(max(ht, float(1).sub(smoothstep(q.z.mul(.35), q.z, length(dd))).mul(q.w))); });
        });
        th.assign(mix(th, mix(vec3(1, .3, .08), vec3(1, .96, .82), smoothstep(.55, 1, ht)).mul(1.3), smoothstep(0, .4, ht)));
        c.assign(mix(c, th, fx7.x));
      });
      // 神經毒氣：發綠；夜視鏡：綠色單色、放大亮度、加雜訊
      If(fx7.y.greaterThan(0), () => { c.assign(mix(c, c.mul(vec3(.5, 1.2, .45)).add(vec3(.03, .09, 0)), fx7.y.mul(.8))); });
      If(fx7.w.greaterThan(0), () => { c.assign(mix(c, vec3(.3, 1, .4).mul(pow(clamp(dot(c, LUM).mul(4), 0, 1), .7)).add(h(p.mul(res).add(fract(time.mul(5)))).sub(.5).mul(.14)), fx7.w)); });
      If(gray.add(vig).add(hurt).greaterThan(0), () => {
        const r = length(cc.mul(vec2(res.x.div(res.y), 1))).mul(1.25).toVar();
        c.assign(mix(c, vec3(dot(c, LUM)).mul(vec3(1.02, 1, .97)), gray));
        c.mulAssign(float(1).sub(vig.mul(smoothstep(.25, 1.05, r)).mul(.92)));
        c.assign(mix(c, vec3(.42, .02, .03), hurt.mul(smoothstep(.45, 1.15, r)).mul(.85)));
      });
      c.assign(pow(max(c, vec3(0)), vec3(1 / 2.2)));
      c.addAssign(h(p.mul(res).add(fract(time.mul(7)))).sub(.5).mul(fx.y.mul(.035)));
      return vec4(c, 1);
    })());
  });
}
