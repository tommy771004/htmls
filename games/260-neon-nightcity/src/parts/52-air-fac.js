// ═══ 灰鷺角機場的支援設施（Blender 細模 blender/airfac.py → 內嵌的 airfac.glb；消防車是 airgse.glb 的 gse_arff）═══
// 機場消防站 af_fire（四個車庫，西邊兩個門開著、停兩台消防車，門前再一台；東側兩層值班樓與玻璃瞭望室、西北角水帶塔）、
// 油庫 af_fuel（防溢堤、三座油槽、管架、泵房、裝油棚）、搜索雷達 af_asr、ILS 定位台 af_loc 與下滑台 af_gs、氣象觀測場 af_met、跑道東端的 EMAS af_emas（取代原本的防爆區）與防吹籬 af_blast。
// 位置在 21-air.js 的 AIR_L.fac（SEA_FR）；模型原點在各設施中心地面、沒有旋轉（EMAS 的原點在靠跑道那一端）。全部合成一個網格烘進城市（MAT.ux，吃點光）。
// 第二批：貨運站 af_cargo、試車坪 af_runup、空廚大樓 af_cater、地勤車基地 af_gseb（下面另有說明）。
// 碰撞是 SEA_FR 的盒與世界座標的圓；消防站、油庫、雷達、空廚、地勤車基地（試車坪只有東端在範圍裡）畫進機場島的陰影高度圖（52-air-bld.js 的 ahmGeo；52-air-gse.js 最後 ahmFlush）。
if (AIR_L && PROPS.af_fire) {
  const F = AIR_L.fac, list = [], box = (x0, x1, z0, z1) => colliders.push({ x0, x1, z0, z1, zn: AIR_F });
  const circ = (x, z, r) => { const [X, Z] = airW(x, z); circles.push({ x: X, z: Z, r, w: 1 }); };
  const lamp = (x, y, z, r, i, c = 0xfff2e0) => { const [X, Z] = airW(x, z); signLights.push({ x: X, y, z: Z, col: lin(c), r, i, w: 1 }); };
  const put = (nm, x, z, ry = 0, y = 0, shadow = false) => {
    if (!PROPS[nm]) return; const g = PROPS[nm].clone(); if (ry) g.rotateY(ry); g.translate(x, y, z); list.push(g); if (shadow) ahmGeo(g);
  };
  // 消防站（airfac.py 的 FS_*：車庫 x −24…20、值班樓 20…36、z −14…14，水帶塔 x −28…−24、z −14…−10）
  { const { x, z } = F.fire;
    put('af_fire', x, z, 0, 0, true);
    box(x - 24, x + 20, z - 14, z - 13.1);                                    // 後牆＋裝備櫃
    box(x - 24, x - 23.7, z - 14, z + 14); box(x + 19.7, x + 36, z - 14, z + 14); box(x - 28, x - 24, z - 14, z - 10);   // 西牆、值班樓、水帶塔
    for (const [a, c] of [[-24, -22.7], [-14.3, -11.7], [-3.3, 19.7]]) box(x + a, x + c, z + 13.7, z + 14);   // 正面：門墩與關著的 3、4 號門
    for (const hx of [-26, 37]) circ(x + hx, z + 15.8, .25);                  // 消防栓
    for (const bx of [-18.5, -7.5]) {                                         // 開著的兩個車庫：各停一台、車頭朝機坪
      put('gse_arff', x + bx, z - 1.5, -Math.PI / 2, .12); box(x + bx - 1.6, x + bx + 1.6, z - 7.4, z + 4.4);
      lamp(x + bx, 7.6, z - 2, 14, 3);
    }
    put('gse_arff', x + 9, z + 22, -Math.PI / 2 + .35, .06); { const c = Math.cos(.35), s = Math.sin(.35), hx = 1.6 * c + 5.9 * s, hz = 1.6 * s + 5.9 * c; box(x + 9 - hx, x + 9 + hx, z + 22 - hz, z + 22 + hz); }   // 門前一台（斜停）
    for (const bx of [-18.5, -7.5, 3.5, 14.5]) lamp(x + bx, 6.6, z + 16, 16, 2.5);   // 門楣下的投光
  }
  // 油庫（FU_*：防溢堤 x −62…34、z −22…22；油槽 x −46／−14／18、r 11；泵房 x 42…56、z 4…18；裝油棚 x 64…80、z −2…18）
  if (PROPS.af_fuel) { const { x, z } = F.fuel;
    put('af_fuel', x, z, 0, 0, true);
    box(x - 62, x + 34, z - 22, z - 21.65); box(x - 62, x + 34, z + 21.65, z + 22); box(x - 62, x - 61.65, z - 22, z + 22); box(x + 33.65, x + 34, z - 22, z + 22);
    for (const tx of [-46, -14, 18]) circ(x + tx, z, 11.6);
    box(x + 42, x + 56, z + 4, z + 18); box(x + 56.5, x + 58.5, z + 7, z + 15);
    box(x + 71.4, x + 72.6, z - 1, z + 17);                                   // 裝油島
    for (const cx of [65, 79]) for (const cz of [-1, 17]) circ(x + cx, z + cz, .3);
    for (const cz of [3, 13]) lamp(x + 72, 6.6, z + cz, 18, 3);
    lamp(x + 49, 5.6, z + 19, 12, 2);
  }
  // 搜索雷達（格構塔 ±3 m、設備房 x 4.5…11）
  if (PROPS.af_asr) { const { x, z } = F.asr; put('af_asr', x, z, 0, 0, true); box(x - 3.1, x + 3.1, z - 3.1, z + 3.1); box(x + 4.5, x + 11, z - 2.5, z + 2.5); }
  // ILS 定位台（天線陣沿 z ±24、x 0…2；設備房 x 9…15）、下滑台（桅杆 ±.6、設備房 x 3…8）、氣象觀測場（風速桿）
  if (PROPS.af_loc) { const { x, z } = F.loc; put('af_loc', x, z); for (let i = 0; i < 16; i++) { const zi = z + (i - 7.5) * 3.1; box(x + .35, x + .85, zi - .25, zi + .25); } box(x + 9, x + 15, z - 2, z + 2); }   // 每支天線的桿與墩（天線在 2.5 m 高，人走得過）
  if (PROPS.af_gs) { const { x, z } = F.gs; put('af_gs', x, z); box(x - .6, x + .6, z - .6, z + .6); box(x + 3, x + 8, z - 1.8, z + 1.8); circ(x, z - 9, .1); }
  if (PROPS.af_met) { const { x, z } = F.met; put('af_met', x, z); circ(x + 3, z - 3, .12); box(x - 3.1, x - 1.9, z - 2.5, z - 1.5); box(x - 3.2, x - 1.8, z + 1.5, z + 2.7); }
  if (PROPS.af_emas) for (const e of F.emas) put('af_emas', e.x, AIR_L.rwy.z, e.ry);
  if (PROPS.af_blast) { const { x, z } = F.blast; put('af_blast', x, z); box(x - .4, x + 3.6, z - 30.3, z + 30.3); }   // 防吹籬（百葉面朝西，對著跑道）
  // 第二批：貨運站、試車坪、空廚大樓、地勤車基地（位置是 AIR_L.fac 的 cargo／runup／cater／gseb，場地是 21-air.js 的 AIR_LOTS）
  // 地勤車照 52-air-gse.js：模型車頭 +x，ry = −π/2 車頭朝 +z；碰撞盒直接取轉好、移好的包圍盒（每邊內縮 0.1 m）
  const putV = (nm, x, z, ry, y = .06) => {
    if (!PROPS[nm]) return; const g = PROPS[nm].clone(); g.rotateY(ry); g.translate(x, y, z); g.computeBoundingBox(); list.push(g);
    const { min: a, max: b } = g.boundingBox; box(a.x + .1, b.x - .1, a.z + .1, b.z - .1); return g;
  };
  // 貨運站（airfac.py 的 CG_*：倉庫 x ±70、z ±25；東端辦公樓 x 70…86、z −25…5；西端冷鏈倉 x −86…−70、z −25…13；危險品倉 x −84…−75、z 19…28）
  if (PROPS.af_cargo) { const { x, z } = F.cargo;
    put('af_cargo', x, z);   // 在機場島陰影高度圖（x −2680 以東）外面，不畫 ahmGeo
    box(x - 70, x + 70, z - 26, z + 25); box(x + 70, x + 86, z - 25, z + 5); box(x - 86, x - 70, z - 26, z + 13); box(x - 85.2, x - 73.8, z + 17.8, z + 29.2);
    box(x - 86.3, x - 72.7, z + 16.7, z + 16.9); box(x - 86.3, x - 86.1, z + 16.7, z + 30.3); box(x - 72.9, x - 72.7, z + 16.7, z + 30.3); box(x - 86.3, x - 81.5, z + 30.1, z + 30.3); box(x - 77.5, x - 72.7, z + 30.1, z + 30.3);   // 危險品倉的圍欄（南面留門）
    for (const i of [1, 2, 4, 7, 8, 10]) box(x - 55 + i * 10 - 1.3, x - 55 + i * 10 + 1.3, z - 39.8, z - 26.1);   // 靠在碼頭的半拖車
    for (const xc of [-15, 15]) box(x + xc - 1.75, x + xc + 1.75, z + 25, z + 28.2);                              // 開著的貨櫃口伸出來的滾輪台
    box(x + 47.2, x + 62.3, z + 28.8, z + 30.4); box(x + 50.2, x + 60.1, z + 30.8, z + 32.4); box(x + 26.4, x + 37.6, z + 29.4, z + 31.6);   // 雨遮下的 LD3 與貨盤
    for (let i = 0; i < 6; i++) lamp(x - 50 + i * 20, 6, z - 28.5, 16, 2.2);                                     // 北面碼頭雨遮下
    for (let i = 0; i < 5; i++) lamp(x - 48 + i * 24, 8.8, z + 29.5, 20, 2.8);                                   // 南面（空側）雨遮下
    lamp(x + 78, 2.6, z - 26.5, 8, 1.5);
    // 貨運機坪：一列 ULD 拖板（往東、拖桿在前）在雨遮外；各機位的機鼻位置旁一台地面電源車（照明是 21-air.js 的高桿燈）
    for (let i = 0; i < 4; i++) putV('gse_dolly', x - 30 + i * 5.4, z + 41, 0);
    for (const sx of [-3060, -2960, -2860]) {
      putV('gse_gpu', sx + 8, AIR_LOTS.capron.z0 + 20, -Math.PI / 2);
    }
  }
  // 試車坪（RU_*：三面牆 x −40…34、z ±36，0.6 m 厚，開口朝東；外側鋼柱與斜撐到 6 m；南牆外的控制亭 x 35…40、z 37…40.5）
  if (PROPS.af_runup) { const { x, z } = F.runup;
    put('af_runup', x, z, 0, 0, true);
    box(x - 40.5, x - 39.4, z - 36, z + 36); box(x - 40, x + 34.4, z - 36.5, z - 35.4); box(x - 40, x + 34.4, z + 35.4, z + 36.5);
    box(x - 39.4, x - 35.9, z - 35.1, z + 35.1);   // 導流板（斜面當成實心）
    box(x + 34.8, x + 40.2, z + 36.8, z + 40.7);
    for (const zz of [-20, 0, 20]) lamp(x - 30, 10, z + zz, 30, 3); lamp(x, 10, z, 30, 3);
  }
  // 空廚大樓（CT_*：x ±28、z ±16；南面五個碼頭的門封伸到 z 17.05；東側壓縮機 x 28.5…33.5、z −8…−2，子母車 x 29…32、z 2…6.5）
  // 不在碼頭停空廚車：gse_cater 的車廂是升起來的（接機門的高度），和 1.2 m 的碼頭台對不上
  if (PROPS.af_cater) { const { x, z } = F.cater;
    put('af_cater', x, z, 0, 0, true);
    box(x - 28, x + 28, z - 16, z + 17); box(x + 28.4, x + 33.6, z - 8.2, z - 1.8); box(x + 28.9, x + 32.1, z + 1.9, z + 6.6);
    for (const dx of [-20, 0, 20]) lamp(x + dx, 5.4, z + 19, 14, 2.2);
  }
  // 地勤車基地（gseb()：維修廠 x ±22、z −35…−15；加油島 x −19…−11、z −8.8…−7.2；充電柱 x −4…5、z −11.6；洗車棚 x 8…20、z −12…2）
  if (PROPS.af_gseb) { const { x, z } = F.gseb;
    put('af_gseb', x, z, 0, 0, true);
    box(x - 22, x + 22, z - 35, z - 15); box(x - 19, x - 11, z - 8.8, z - 7.2);
    for (const cx of [-18.5, -11.5]) circ(x + cx, z - 8, .15);
    for (const cx of [8.3, 19.7]) for (const cz of [-11.7, 1.7]) circ(x + cx, z + cz, .2);
    for (const cx of [10.6, 17.4]) box(x + cx - .15, x + cx + .15, z - 5.15, z - 4.85);
    for (let k = 0; k < 4; k++) box(x - 4.25 + k * 3, x - 3.75 + k * 3, z - 11.65, z - 11.25);
    for (const cx of [-15, -6, 3]) for (const s of [-1, 1]) circ(x + cx + s * 3.2, z - 14.4, .14);
    // 停車格（21-air.js：x −20…20 每 5 m 一條線、z 10…22）：車頭朝機坪
    const bay = i => x - 17.5 + i * 5, S = -Math.PI / 2;
    putV('gse_push', bay(0), z + 16, S); putV('gse_belt', bay(1), z + 16, S); putV('gse_gpu', bay(2), z + 16, S); putV('gse_stairs', bay(3), z + 16, S);
    putV('gse_fuel', bay(5), z + 16, S); putV('gse_dolly', bay(6), z + 13, S); putV('gse_dolly', bay(6), z + 18.4, S); putV('gse_tower', bay(7), z + 16, S);
    lamp(bay(7), 8.6, z + 14.8, 30, 9);                 // 停車格的照明燈塔開著
    putV('gse_push', x - 6, z - 10, S);              // 開著的維修廠門口
    putV('gse_belt', x + 2, z - 7.4, Math.PI / 2);   // 插著充電線的電動輸送帶車（車頭朝充電柱）
    lamp(x - 15, 4.4, z - 8, 14, 2.4); lamp(x + 14, 5.2, z - 5, 14, 2.2); lamp(x - 6, 5.2, z - 13.5, 12, 2);
  }
  // 機坪告示牌（airfac.py 的 af_sgn_*，正面朝 +z；ry = π 朝北、π/2 朝東）與 A 字梯：油庫與加油島的禁菸、機坪兩端與地勤車基地出口的速限、
  // 試車坪開口兩側的噴流危險、貨運站與空廚陸側的空側限制、貨運機坪與維修廠前的反光背心
  { const A = AIR_L.apron, S = (n, x, z, ry) => putV('af_sgn_' + n, x, z, ry, 0);
    if (PROPS.af_sgn_nosmoke) { S('nosmoke', F.fuel.x + 60, F.fuel.z + 24, 0); S('nosmoke', F.gseb.x - 21.5, F.gseb.z - 5, 0); }
    if (PROPS.af_sgn_speed) { S('speed', A.x0 + 8, A.z0 + 3, Math.PI / 2); S('speed', A.x1 - 8, A.z0 + 3, -Math.PI / 2); S('speed', F.gseb.x + 23.5, F.gseb.z + 28, 0); }
    if (PROPS.af_sgn_blast) { S('blast', F.runup.x + 37, F.runup.z - 39.5, Math.PI / 2); S('blast', F.runup.x + 37, F.runup.z + 43, Math.PI / 2); }
    if (PROPS.af_sgn_airside) { S('airside', F.cargo.x + 60, F.cargo.z - 57, Math.PI); S('airside', F.cater.x - 10, F.cater.z - 20, Math.PI); }
    if (PROPS.af_sgn_hivis) { S('hivis', F.cargo.x - 55, F.cargo.z + 37.5, 0); S('hivis', F.gseb.x + 9, F.gseb.z - 13.6, 0); }
    if (PROPS.af_stepl) putV('af_stepl', F.gseb.x - 11, F.gseb.z - 13.8, 0);   // 維修廠兩道門之間
  }
  const geo = mergeGeometries(list); for (const g of list) g.dispose();
  if (geo) cityAdd(new T.Mesh(geo, MAT.ux), AIR_ZN);
  if (!(PROPS.gse_fuel && PROPS.gse_belt && PROPS.gse_push && PROPS.gse_stairs)) ahmFlush();   // 有地勤車時 52-air-gse.js 會 flush
  colDirty();
}
