// ═══ 後製的手寫 TSL（02-gfx.js 的 gfxPort）：70-render.js 的泛光（mPre／mDown／mUp）、環境光遮蔽（mAO／mAOBlur）與合成（mComp），照原本的 GLSL 逐行改寫 ═══
// 70-render.js 照舊用 blit() 換材質畫全螢幕三角形、改 uniforms 的值，這裡只換著色器。體積光（mVol）要共用函式庫（src/tsl/lib.mjs），是 src/tsl/m-vol.mjs
{
  const { Fn, If, Loop, vec2, vec3, vec4, float, uv, mix, smoothstep, clamp, max, min, pow, dot, length, fract, sin, cos, abs, normalize, cross, exp, log, positionGeometry } = TSL;
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
  if (mAO) {
    // 環境光遮蔽：位置與法線都在 Q 的座標裡取（v 往下），法線最後翻向鏡頭，螺旋的方向反過來不影響結果
    gfxPort(mAO, m => {
      const u = m.uniforms, tD = gfxT(u.tDepth), invP = gfxU(u.uInvProj), dt = gfxU(u.uDT), py = gfxU(u.uPy), rad = gfxU(u.uRad), k = gfxU(u.uK), fogD = gfxU(u.uFogD), dayK = gfxU(u.uDayK);
      const vpos = q => { const v = invP.mul(vec4(ndcOf(q), gfxZ(tD(q).x), 1)); return v.xyz.div(v.w); };
      return passMat(Fn(() => {
        const out = vec4(1, 1e4, 0, 1).toVar();
        const q = TSL.floor(Q.div(dt)).add(.5).mul(dt).toVar();   // 對齊到全解析度深度像素的中心（原本 GLSL 的做法）
        If(tD(q).x.lessThan(1), () => {
          const P = vpos(q).toVar();
          const l = vpos(q.sub(vec2(dt.x, 0))), r = vpos(q.add(vec2(dt.x, 0))), b = vpos(q.sub(vec2(0, dt.y))), t = vpos(q.add(vec2(0, dt.y)));
          const dx = TSL.select(abs(r.z.sub(P.z)).lessThan(abs(P.z.sub(l.z))), r.sub(P), P.sub(l));
          const dy = TSL.select(abs(t.z.sub(P.z)).lessThan(abs(P.z.sub(b.z))), t.sub(P), P.sub(b));
          const n = normalize(cross(dx, dy)).toVar(); n.mulAssign(TSL.sign(dot(n, P.negate())));
          const z = P.z.negate().toVar(), ssR = min(rad.mul(py).mul(.5).div(z.mul(dt.y)), float(.12).div(dt.y)).toVar();
          const A = float(1).toVar();
          If(ssR.greaterThan(1.5), () => {
            const a0 = fract(fract(dot(TSL.screenCoordinate.xy, vec2(.06711056, .00583715))).mul(52.9829189)).mul(6.2832);
            const sum = float(0).toVar(), r2 = rad.mul(rad), bias = z.mul(.002).add(.02);
            Loop(AO_N, ({ i }) => {
              const a = float(i).add(.5).div(AO_N), th = a.mul(43.98).add(a0);
              const v = vpos(q.add(vec2(cos(th), sin(th)).mul(a.mul(ssR)).mul(dt))).sub(P).toVar();
              const vv = dot(v, v), f = max(r2.sub(vv), 0);
              sum.addAssign(f.mul(f).mul(f).mul(max(dot(v, n).sub(bias).sub(TSL.sqrt(vv).mul(.2)).div(vv.add(.01)), 0)));
            });
            A.assign(max(0, float(1).sub(sum.mul(k).mul(5).div(r2.mul(r2).mul(r2).mul(AO_N)))));
          });
          const x = z.mul(fogD).mul(.75), fog = mix(float(1).sub(TSL.exp(x.negate())), float(1).sub(TSL.exp(x.mul(x).negate())), dayK);
          out.assign(vec4(mix(A, 1, max(fog, smoothstep(90, 140, z))), z, 0, 1));
        });
        return out;
      })());
    });
    gfxPort(mAOBlur, m => {
      const u = m.uniforms, src = gfxT(u.tSrc), dir = gfxU(u.uDir);
      // 取樣結果直接取 .x／.y，不要先 .rg 再取分量：Chrome 153 的 Tint 遇到「重疊的 swizzle」編不過（swizzle view instruction still has usages after lowering），156 沒事
      return passMat(Fn(() => {
        const c = src(Q).toVar(), s = c.x.toVar(), w = float(1).toVar(), tol = c.y.mul(.06).add(.05);
        for (let i = 1; i <= 3; i++) {
          const k = 1 - i * .25, p = src(Q.add(dir.mul(i))), q = src(Q.sub(dir.mul(i)));
          const kp = max(float(1).sub(abs(p.y.sub(c.y)).div(tol)), 0).mul(k), kq = max(float(1).sub(abs(q.y.sub(c.y)).div(tol)), 0).mul(k);
          s.addAssign(p.x.mul(kp).add(q.x.mul(kq))); w.addAssign(kp.add(kq));
        }
        return vec4(s.div(w), c.y, 0, 1);
      })());
    });
  }
  // 螢幕空間倒影（70-render.js 的 mSSR）：輸出照平面倒影的版面（鏡射相機的畫面），一個像素一條反射光線
  gfxPort(mSSR, m => {
    const u = m.uniforms, G = k => gfxU(u[k]), tS = gfxT(u.tScene), tD = gfxT(u.tDepth);
    const VP = G('uVP'), invVP = G('uInvVP'), invR = G('uInvRVP'), rp = G('uRP'), skyT = G('uSkyTop'), skyH = G('uSkyHor'), fogC = G('uFogCol'), prm = G('uPrm');
    const inScr = n => abs(n.x).lessThan(1).and(abs(n.y).lessThan(1));
    // 上一幀這個 NDC 的深度換成視線深度（clip.w）：反投影的 w 是 1 / clip.w
    const sceneW = (n, d) => float(1).div(invVP.mul(vec4(n, gfxZ(d), 1)).w);
    return passMat(Fn(() => {
      const fp = invR.mul(vec4(ndcOf(Q), gfxZ(float(1)), 1)), D = normalize(fp.xyz.div(fp.w).sub(rp)).toVar();
      const up = max(D.y, 0);
      const out = mix(fogC, mix(skyH, skyT, TSL.sqrt(up)), smoothstep(0, .2, up)).toVar();
      // 方向本身（w = 0）投影到畫面：天空在畫面裡、那裡沒有東西擋（深度 1）就取畫面上的天空
      const cs = VP.mul(vec4(D, 0)).toVar();
      If(cs.w.greaterThan(1e-4), () => {
        const n = cs.xy.div(cs.w).toVar();
        If(inScr(n), () => { const q = uvOf(n); If(tD(q, 0).x.greaterThanEqual(1), () => { out.assign(tS(q, 0).rgb); }); });
      });
      If(D.y.greaterThan(1e-4).and(prm.w.greaterThan(.5)), () => {
        const P0 = rp.add(D.mul(rp.y.negate().div(D.y))).toVar();
        const jit = fract(fract(dot(TSL.screenCoordinate.xy, vec2(.06711056, .00583715))).mul(52.9829189));
        const s = prm.x.mul(jit.add(.5)).toVar(), s0 = float(0).toVar(), hit = float(0).toVar(), lq = vec2(-1).toVar();
        Loop(SSR_N, () => {
          const c = VP.mul(vec4(P0.add(D.mul(s)), 1)).toVar();
          If(c.w.lessThan(.1).or(s.greaterThan(prm.z)), () => { TSL.Break(); });
          const n = c.xy.div(c.w).toVar();
          If(inScr(n).not(), () => { TSL.Break(); });
          const q = uvOf(n).toVar(); lq.assign(q);
          const dz = c.w.sub(sceneW(n, tD(q, 0).x)).toVar();
          // 走到表面後面、而且在厚度內才算碰到；比厚度深是從前景的細東西（樹、桿子、人）後面穿過去，繼續走
          If(dz.greaterThan(0).and(dz.lessThan(s.sub(s0).mul(2).add(.35))), () => { hit.assign(1); TSL.Break(); });
          s0.assign(s); s.assign(s.mul(prm.y).add(.04));
        });
        If(hit.greaterThan(.5), () => {
          const a = s0.toVar(), b = s.toVar();
          for (let k = 0; k < 5; k++) {
            const mid = a.add(b).mul(.5), c = VP.mul(vec4(P0.add(D.mul(mid)), 1)), n = c.xy.div(c.w);
            If(c.w.greaterThan(sceneW(n, tD(uvOf(n), 0).x)), () => { b.assign(mid); }).Else(() => { a.assign(mid); });
          }
          const c = VP.mul(vec4(P0.add(D.mul(b)), 1)), n = c.xy.div(c.w), q = uvOf(n);
          const edge = smoothstep(0, .08, min(min(q.x, q.y.oneMinus()), min(q.x.oneMinus(), q.y)));
          out.assign(mix(out, tS(q, 0).rgb, edge));
        }).ElseIf(lq.x.greaterThanEqual(0), () => {
          // 沒碰到東西就走出畫面（多半是從畫面上緣出去：高處看下來，對街的樓在倒影裡要比畫面裡看得到的更高）：取最後一個還在畫面裡的點的顏色，
          // 大多是樓的上緣或天空，比天空的漸層接近
          out.assign(tS(lq, 0).rgb);
        });
      });
      return vec4(min(max(out, vec3(0)), vec3(60)), 1);
    })());
  });
  // 時間抗鋸齒（70-render.js 的 mTAA）：現在這幀（偏移過的）3×3 鄰域在 YCoCg 算平均與標準差，上一幀的結果照深度反推回去取（Catmull-Rom 五點，不會一幀一幀糊掉），
  // 裁進「平均 ± 1.25σ」的盒子（比最小／最大值的盒子穩：次像素的電線一幀有一幀沒有時不會跟著閃），再和現在這幀混。
  // 都在 Karis 的可逆壓縮（c / (1 + 亮度)）裡做，一顆特別亮的像素不會拖出一片；輸出前解壓回線性 HDR。反推用 3×3 裡最近的深度（物體邊緣跟著前景走）
  gfxPort(mTAA, m => {
    const u = m.uniforms, tC = gfxT(u.tScene), tH = gfxT(u.tHist), tD = gfxT(u.tDepth), invVP = gfxU(u.uInvVP), prevVP = gfxU(u.uPrevVP), tx = gfxU(u.uTexel), prm = gfxU(u.uPrm), jit = gfxU(u.uJit);
    const san = c => min(max(TSL.select(TSL.any(c.notEqual(c)), vec3(0), c), vec3(0)), vec3(60));   // 歷史是回饋的：一個 NaN 會一直留著，每次讀寫都擋
    const tm = c => c.div(dot(c, LUM).add(1)), itm = c => c.div(max(float(1).sub(dot(c, LUM)), .02));
    const ycc = c => vec3(dot(c, vec3(.25, .5, .25)), dot(c, vec3(.5, 0, -.5)), dot(c, vec3(-.25, .5, -.25)));
    const rgb = y => vec3(y.x.add(y.y).sub(y.z), y.x.add(y.z), y.x.sub(y.y).sub(y.z));
    // Catmull-Rom 九點濾波化成五次雙線性取樣（Jimenez 2016）
    const catm = q => {
      const sz = vec2(1).div(tx), sp = q.mul(sz), p1 = TSL.floor(sp.sub(.5)).add(.5), f = sp.sub(p1);
      const w0 = f.mul(f.mul(f.mul(-.5).add(1)).sub(.5)), w1 = f.mul(f).mul(f.mul(1.5).sub(2.5)).add(1), w2 = f.mul(f.mul(f.mul(-1.5).add(2)).add(.5)), w3 = f.mul(f).mul(f.mul(.5).sub(.5));
      const w12 = w1.add(w2), p0 = p1.sub(1).mul(tx), p3 = p1.add(2).mul(tx), p12 = p1.add(w2.div(w12)).mul(tx);
      const s = (x, y) => san(tH(vec2(x, y), 0).rgb);
      const a = w0.x.mul(w12.y), b = w12.x.mul(w0.y), c = w12.x.mul(w12.y), d = w3.x.mul(w12.y), e = w12.x.mul(w3.y);
      return s(p0.x, p12.y).mul(a).add(s(p12.x, p0.y).mul(b)).add(s(p12.x, p12.y).mul(c)).add(s(p3.x, p12.y).mul(d)).add(s(p12.x, p3.y).mul(e)).div(a.add(b).add(c).add(d).add(e));
    };
    return passMat(Fn(() => {
      // 現在這幀：3×3 依離「沒偏移的像素中心」（jit，像素）的距離加權（Blackman-Harris 的高斯近似，Unreal 的做法），不然這幀的偏移會透過混合比例在每條邊上抖
      const cw = vec3(0).toVar(), ws = float(0).toVar(), m1 = vec3(0).toVar(), m2 = vec3(0).toVar(), dmin = float(2).toVar(), dq = Q.toVar();
      for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
        const q = Q.add(tx.mul(vec2(x, y))), c = ycc(tm(san(tC(q, 0).rgb))).toVar(), d = tD(q, 0).x;
        const dd = vec2(x, y).sub(jit), wt = exp(dot(dd, dd).mul(-3));
        cw.addAssign(c.mul(wt)); ws.addAssign(wt);
        m1.addAssign(c); m2.addAssign(c.mul(c));
        dq.assign(TSL.select(d.lessThan(dmin), q, dq)); dmin.assign(min(d, dmin));
      }
      const cur = cw.div(ws).toVar(), out = cur.toVar();
      const wp = invVP.mul(vec4(ndcOf(dq), gfxZ(dmin), 1)).toVar(); wp.divAssign(wp.w);
      const pc = prevVP.mul(wp), pq = uvOf(pc.xy.div(pc.w)).add(Q.sub(dq)).toVar();
      const ok = pc.w.greaterThan(1e-4).and(pq.x.greaterThan(0)).and(pq.x.lessThan(1)).and(pq.y.greaterThan(0)).and(pq.y.lessThan(1));
      If(prm.y.lessThan(.5), () => {
        // 兩個歷史候選：照深度反推的（不動的世界）與同一個畫面位置的（跟著鏡頭走的東西：追車鏡頭裡的玩家車、車內視角的車廂），取離這幀近的。
        // 只有反推的那個時，玩家車的歷史落在後面的路面上，被裁到 3×3 的平均（等於方框模糊），車牌與尾燈糊成一片（2026-11-14 追車對照）
        const hR = ycc(tm(catm(pq))).toVar(), hS = ycc(tm(san(tH(Q, 0).rgb))).toVar();
        const useS = ok.not().or(length(hS.sub(cur)).lessThan(length(hR.sub(cur))));
        const hist = TSL.select(useS, hS, hR).toVar(), px = TSL.select(useS, float(0), length(pq.sub(Q).div(tx))).toVar();
        // 盒子的寬度：畫面不動時放寬到 3σ（次像素的亮點、遠處窗燈每幀因偏移時有時無，盒子太緊會把歷史拉回這一幀，偏移本身就變成閃爍；2026-11-14 夜景量到比沒開還閃 5 倍），
        // 動起來（每幀超過 4 px）收回 1σ，免得拖影
        const mean = m1.div(9), sd = TSL.sqrt(max(m2.div(9).sub(mean.mul(mean)), vec3(0))).mul(mix(3, 1, smoothstep(.5, 4, px)));
        // 裁切：從盒子中心往歷史值的方向，超出盒子就拉回盒面（Playdead 的 clip，比逐分量夾住少偏色）
        const v = hist.sub(mean), ex = sd.add(1e-4), a = abs(v.div(ex)), ma = max(a.x, max(a.y, a.z));
        If(ma.greaterThan(1), () => { hist.assign(mean.add(v.div(ma))); });
        // 現在這幀的權重：平常 prm.x；歷史被裁得多（對不上）時加大，裁過的歷史是鄰域平均、會糊；鏡頭帶著畫面動得快時加大（歷史一直在重新取樣、會越來越軟）；下雨時加大（雨絲每幀換位置）
        const k = max(max(prm.x, mix(prm.x, .3, smoothstep(2, 40, px))), max(prm.z.mul(.3), smoothstep(1, 2.5, ma).mul(.85)));   // 對不上的（動的車、鏡頭晃）幾乎只用這一幀：銳利但有一點鋸齒，比糊掉好
        out.assign(mix(hist, cur, k));
      });
      If(prm.w.greaterThan(1.5), () => { out.assign(ycc(tm(vec3(TSL.select(prm.y.greaterThan(.5), 1, 0), 0, 0)))); });   // dbg 2：重設的那幀標紅
      return vec4(san(itm(rgb(out))), 1);
    })());
  });
  // 眼睛適應：縮圖的 log 亮度，再整張平均（取樣的上下翻轉不影響平均）
  gfxPort(mEyeLum, m => {
    const u = m.uniforms, src = gfxT(u.tSrc), tx = gfxU(u.uTexel);
    const lg = o => log(max(dot(min(src(Q.add(tx.mul(o))).rgb, vec3(60)), LUM), 1e-4));
    return passMat(vec4(lg(vec2(-1, -1)).add(lg(vec2(1, -1))).add(lg(vec2(-1, 1))).add(lg(vec2(1, 1))).mul(.25), 0, 0, 1));
  });
  gfxPort(mEyeAdapt, m => {
    const u = m.uniforms, src = gfxT(u.tSrc), prev = gfxT(u.tPrev), k = gfxU(u.uK), reset = gfxU(u.uReset);
    return passMat(Fn(() => {
      const s = float(0).toVar();
      Loop({ start: 0, end: EYE_H, type: 'int', name: 'ey' }, ({ ey }) => { Loop({ start: 0, end: EYE_W, type: 'int', name: 'ex' }, ({ ex }) => { s.addAssign(src(vec2(float(ex), float(ey)).add(.5).div(vec2(EYE_W, EYE_H))).r); }); });
      const L = s.div(EYE_W * EYE_H), p = prev(vec2(.5));
      return vec4(TSL.select(reset.greaterThan(.5), vec2(L), vec2(mix(p.x, L, k.x), mix(p.y, L, k.y))), 0, 1);
    })());
  });
  gfxPort(mComp, m => {
    const u = m.uniforms, G = k => gfxU(u[k]);
    const tScene = gfxT(u.tScene), tDepth = gfxT(u.tDepth), tBloom = gfxT(u.tBloom), tVol = gfxT(u.tVol), tAO = gfxT(u.tAO), tEye = gfxT(u.tEye);
    const volOn = G('uVolOn'), aoOn = G('uAOOn'), aoThr = G('uAOThr'), eyeOn = G('uEyeOn'), volT = G('uVolT'), invVP = G('uInvVP'), prevVP = G('uPrevVP'), blur = G('uBlur'), ex = G('uExp'), time = G('uTime'), wob = G('uWob'), flash = G('uFlash'),
      bloomK = G('uBloomK'), gray = G('uGray'), vig = G('uVig'), hurt = G('uHurt'), tint = G('uTint'), dayG = G('uDayG'), fx7 = G('uFx7'), res = G('uRes'), fx = G('uFx'), hi = G('uHi'), sharp = G('uSharp'), texel = G('uTexel'), heat = gfxU(u.uHeat, 'vec4');
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
      // 時間抗鋸齒開著時的銳化（只加在畫面上、不回寫歷史，不然會一幀一幀疊出光暈）：中心減上下左右平均，在 Karis 壓縮的亮度裡算，亮點旁邊不出黑邊；動態模糊大時淡掉
      If(sharp.greaterThan(0), () => {
        const k0 = tScene(p).rgb, nb = tScene(p.add(vec2(texel.x, 0))).rgb.add(tScene(p.sub(vec2(texel.x, 0))).rgb).add(tScene(p.add(vec2(0, texel.y))).rgb).add(tScene(p.sub(vec2(0, texel.y))).rgb).mul(.25);
        const t0 = dot(k0, LUM), tn = dot(nb, LUM), d = t0.div(t0.add(1)).sub(tn.div(tn.add(1)));
        c.mulAssign(max(float(1).add(d.mul(sharp).div(max(t0.div(t0.add(1)), .02)).mul(float(1).sub(smoothstep(.002, .01, vl)))), 0));
      });
      // 邊緣的色散
      const cc = p.sub(.5), edge = dot(cc, cc);
      c.assign(vec3(mix(c.r, tScene(p.sub(cc.mul(edge).mul(.012))).r, fx.x.mul(.6)), c.g, mix(c.b, tScene(p.add(cc.mul(edge).mul(.012))).b, fx.x.mul(.6))));
      If(wob.greaterThan(0), () => { c.assign(mix(c, tScene(p.add(vec2(.012, 0).mul(wob))).rgb, wob.mul(.35))); });
      If(fx7.z.greaterThan(0), () => {
        const o = vec2(.007, .005).mul(fx7.z);
        c.assign(mix(c, tScene(p.add(o)).rgb.add(tScene(p.sub(o)).rgb).add(tScene(p.add(vec2(o.y.negate(), o.x))).rgb).add(tScene(p.add(vec2(o.y, o.x.negate()))).rgb).mul(.25), min(fx7.z, 1).mul(.75)));
      });
      // 環境光遮蔽：亮到會泛光的地方不壓暗
      If(aoOn.greaterThan(0), () => { c.mulAssign(mix(tAO(p).r, 1, smoothstep(aoThr.mul(.7), aoThr.mul(1.7), max(c.r, max(c.g, c.b))))); });
      c.addAssign(tBloom(p).rgb.mul(bloomK));
      If(volOn.greaterThan(0), () => { c.addAssign(tVol(p.add(volT.mul(vec2(.5, .5)))).rgb.add(tVol(p.add(volT.mul(vec2(-.5, .5)))).rgb).add(tVol(p.add(volT.mul(vec2(.5, -.5)))).rgb).add(tVol(p.sub(volT.mul(.5))).rgb).mul(.25)); });
      c.mulAssign(ex.mul(flash.mul(.5).add(1)));
      If(eyeOn.greaterThan(0), () => { const e = tEye(vec2(.5)); c.mulAssign(clamp(exp(e.x.sub(e.y).mul(.5)), .55, 1.8)); });   // 眼睛適應
      // 高光肩部（場館的 ENV.post.knee／range）
      If(hi.x.greaterThan(0), () => { const L = max(max(c.r, c.g), c.b).toVar(); If(L.greaterThan(hi.x), () => { const e = L.sub(hi.x); c.mulAssign(hi.x.add(e.div(e.div(hi.y).add(1))).div(L)); }); });
      c.assign(aces(c));
      // 調色：暗部偏青、亮部偏暖
      const l = dot(c, LUM).toVar();
      c.assign(mix(c, c.mul(vec3(.86, 1.02, 1.08)), float(1).sub(l).mul(mix(.35, dayG.y, dayG.x))));   // 白天（uDayG.x）換成 28-sky.js DAYG.cyan
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
      // 白天的飽和度（線性）與對比（gamma 空間的 S 曲線），28-sky.js 的 DAYG
      c.assign(mix(vec3(dot(c, LUM)), c, mix(1, dayG.w, dayG.x)));
      c.assign(pow(max(c, vec3(0)), vec3(1 / 2.2)));
      c.assign(mix(c, smoothstep(0, 1, c), dayG.z.mul(dayG.x)));
      c.addAssign(h(p.mul(res).add(fract(time.mul(7)))).sub(.5).mul(fx.y.mul(.035)));
      return vec4(c, 1);
    })());
  });
}
