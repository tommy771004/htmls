// ═══ 天樞島的地標大樓：tools/isle-glb.mjs 處理過的 assets/260/isle/<id>.glb（Sketchfab CC BY，作者見 assets/260/isle/CREDITS.md）═══
// 10-city.js 的 ISLE_LM 挑好地塊（L.glb，不蓋程式立面與塔冠）；這裡開場在背景下載（不等），下載好照 27-props.js 的建築做法：
// 依材質合併、逐頂點彎進所在的片（bakeMesh）、預熱後放進場景，距離剔除半徑放大到三倍（三百公尺的塔遠遠就看得到）；
// 日光陰影的高度圖用模型的三角形畫（22-hmap.js 的 hmModel），街區的碰撞盒照模型在人的高度的外形換掉（27-bldfoot.js 的 bldCut／blkFoot）。
// 模型沒有窗戶遮罩：夜裡的窗燈與路燈光是 LMWIN（src/tsl/m-glbLM.mjs）。下載失敗的地塊補回程式立面（lotFallback）。
const ISLE_LM_BASE = new URL('../assets/260/isle/', location.href).href;
const ISLE_LM_ON = { n: 0, failed: [] };   // __nc 驗收用：擺好幾棟
// 夜裡的窗燈：26-glb.js 的 WASH 打的光乘上底色（深藍的玻璃帷幕幾乎看不到），室內光又是整片開間一起亮（紅磚牆會變成一塊塊的格子），所以不用它，另外加一段：
// 每扇窗依 uLit 亂數開燈（暖白為主，偶爾冷白），只亮在玻璃上，白天只留一點
const lmMats = new Map();
function lmMat(src) {
  let m = lmMats.get(src);
  if (!m) {
    m = glbMaterial(src, PROP_INST, 0, false);
    m.name = 'glbLM'; m.defines.LMWIN = '';
    lmMats.set(src, m);
  }
  return m;
}
if (GLB_ON) for (const o of ISLE_LM) {
  const L = o.L; if (!L) continue;
  const key = 'i:' + o.id;
  glbLoader.loadAsync(ISLE_LM_BASE + o.id + '.glb', e => { glbBytes[key] = [e.loaded, e.lengthComputable ? e.total : 0]; }).then(g => warmJob(async () => {
    const clk = warmClock(), e = L.glb, b = L.b, zn = L.zn;
    g.scene.updateMatrixWorld(true);
    const M = new T.Matrix4().compose(V3(e.x, 0, e.z), new T.Quaternion().setFromAxisAngle(V3(0, 1, 0), e.ry), V3(1, 1, 1));
    const byMat = new Map(), wg = [];
    g.scene.traverse(m => {
      if (!m.isMesh) return;
      const geo = floatGeo(m.geometry, m.matrixWorld).applyMatrix4(M), mat = lmMat(m.material);
      if (!byMat.has(mat)) byMat.set(mat, []);
      byMat.get(mat).push(geo); wg.push(geo);
    });
    await clk.tick();
    hmModel(e, wg, frameM4(zn, e.x, e.z)); hmRectL(L.x0 - 1, L.x1 + 1, L.z0 - 1, L.z1 + 1, HM_NONE, false, zn); hmFlush();   // 第二個只標記要重新上傳的範圍
    bldCut(e, wg); blkFoot(b);
    await clk.tick();
    const ms = [];
    for (const [mat, list] of byMat) {
      const geo = list.length > 1 ? mergeGeometries(list) : list[0];
      if (!geo) continue;
      const m = new T.Mesh(geo, mat); m.matrixAutoUpdate = false; m.userData.bld = 'isle'; m.userData.noTess = 1;
      bakeMesh(m, zn); ms.push(m);
      await clk.tick();
    }
    const [wx, wz] = toW(e.x, e.z, zn), [sx, sz] = toW(avX(1), stZ(2));   // 出生點（27-props.js 的 bldReady 同一點）
    await glbWarm(ms, () => Math.hypot(wx - sx, wz - sz) < CULL_R * 3);   // 只有在出生點看得到時才先傳頂點
    for (const m of ms) { scene.add(m); cullAdd(m, CULL_R * 3); }
    perfTags.push(['地標 ' + o.id, clk.ms()]);
    glbDone.add(key); ISLE_LM_ON.n++;
  })).catch(err => { console.warn('天樞島地標下載失敗：' + o.id, err); glbDone.add(key); ISLE_LM_ON.failed.push(o.id); L.h = o.h0; lotFallback([L]); });
}
// 渡輪站泊著的渡輪（assets/260/isle/ferry.glb：chrisw225 的 Star Ferry，CC BY）：世界座標，船底在原點、長邊沿 x；
// 吃水 1.5 m（原檔的紅色船底漆到水線），下載好拿掉 21-isle.js 的替身（替身要整個 removeFromParent，剔除表也要拿掉，不然距離剔除會把它開回來）
const ISLE_FERRY_DRAFT = 1.5;
if (GLB_ON && ISLE_FERRY.fb) glbLoader.loadAsync(ISLE_LM_BASE + 'ferry.glb', e => { glbBytes['i:ferry'] = [e.loaded, e.lengthComputable ? e.total : 0]; }).then(g => warmJob(async () => {
  const clk = warmClock(), F = ISLE_FERRY, ms = [];
  g.scene.updateMatrixWorld(true);
  const M = new T.Matrix4().compose(V3(F.x, SEA_Y - ISLE_FERRY_DRAFT, F.z), new T.Quaternion().setFromAxisAngle(V3(0, 1, 0), Math.atan2(-F.fz, F.fx)), V3(1, 1, 1));
  g.scene.traverse(m => {
    if (!m.isMesh) return;
    const o = new T.Mesh(floatGeo(m.geometry, m.matrixWorld).applyMatrix4(M), glbMaterial(m.material, PROP_INST, 0, true));   // WASH：夜裡依開間透出一點艙內的光
    o.matrixAutoUpdate = false; o.userData.noTess = 1; ms.push(o);
  });
  await clk.tick();
  await glbWarm(ms, () => false);
  const fb = F.fb, i = cullList.indexOf(fb.userData.cull); fb.removeFromParent(); if (i >= 0) cullList.splice(i, 1);
  for (const m of ms) { scene.add(m); cullAdd(m); }
  perfTags.push(['天樞島渡輪', clk.ms()]);
  glbDone.add('i:ferry'); ISLE_LM_ON.ferry = 1;
})).catch(err => { console.warn('天樞島渡輪下載失敗', err); glbDone.add('i:ferry'); });
