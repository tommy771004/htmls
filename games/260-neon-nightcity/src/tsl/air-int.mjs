// 機場建築玻璃後面的室內（interior mapping）：m-uberX 的材質 53（航廈大廳）、56（第二航廈大廳）與 54（空橋通道、塔台基座、機庫工作間的小房間）。
// 玻璃本身是一片平面，這裡從鏡頭沿視線「走進」玻璃後面，跟虛擬的地板、天花、夾層、後牆與幾層直立的剪影（座椅、人、柱）求交，
// 算出那一點的顏色當成自發光（玻璃的反射照舊由 m-uberX 加上去）。
// 座標：p、n 是幾何的原始座標（blender/airbld.py 的遊戲座標，航廈／空橋／塔台的原點在建築中心；機庫的幾何已平移進 SEA_FR）；
// 視線從世界轉回來只差 SEA_FR 的 yaw：uAirA.zw 是 SEA_FR 的 +x 在世界的方向（21-air.js），所以 dL = (dW·(ux,uz), dW.y, dW·(−uz,ux))。
// 玻璃的框：n 是玻璃朝外的法線（都是軸向），t = (n.z, 0, −n.x) 是沿玻璃的方向；s 是進玻璃的深度，視線每進 1 m 的 s，u 走 a、y 走 b。
// 有版面（layout）的 Fn 是真的 WGSL 函式，讀不到 varying：片段的世界座標 vW 要當參數 w 傳進來。
// 寫法：JS 數字放後面（x.mul(2).add(.5)），不要 .5 + 節點（CLAUDE.md 的 bNode 坑）。
export default function airInt(TSL, E) {
  const { Fn, vec2, vec3, vec4, float, floor, fract, abs, min, max, clamp, smoothstep, step, mix, select, length, normalize, dot, exp, sqrt, If } = TSL;
  const { uCam, uAirA, uLamp, uDay, uSkyHor, h21, n2 } = E;
  const BIG = 1e5, sub1 = x => float( 1. ).sub( x );

  // 視線（鏡頭 → 片段）換到建築的局部座標
  const rayL = Fn( ( [ w ] ) => {
    const dW = w.sub( uCam ).toVar();
    return normalize( vec3( dot( dW.xz, uAirA.zw ), dW.y, dot( dW.xz, vec2( uAirA.w.negate(), uAirA.z ) ) ) );
  }, { w: 'vec3', return: 'vec3' } );

  // 人：1.3 m 一格，照 seed 決定有沒有人（dens 越大越稀）、站的位置、身高、衣服與行李；回傳 (rgb, 遮罩)。h 是離地高度
  const person = Fn( ( [ u, h, seed, dens ] ) => {
    const c = floor( u.div( 1.3 ) ).toVar();
    const cx = c.add( .5 ).add( h21( vec2( c, seed.add( 3.1 ) ) ).sub( .5 ).mul( .5 ) ).mul( 1.3 ).toVar();
    const H = h21( vec2( c, seed.add( 7.3 ) ) ).mul( .32 ).add( 1.52 ).toVar(), dx = u.sub( cx ).toVar(), x = abs( dx ).toVar();
    const head = step( length( vec2( x, h.sub( H ).add( .12 ) ) ), .11 ).toVar();
    const torso = step( x, H.sub( .3 ).sub( h ).mul( .07 ).add( .19 ) ).mul( step( .8, h ) ).mul( step( h, H.sub( .2 ) ) ).toVar();
    const legs = step( abs( x.sub( .08 ) ), .065 ).mul( step( h, .86 ) ).mul( step( 0., h ) ).toVar();
    const bag = step( abs( dx.sub( .42 ) ), .17 ).mul( step( h, .6 ) ).mul( step( .04, h ) ).mul( step( .55, h21( vec2( c, seed.add( 11.7 ) ) ) ) ).toVar();
    const m = max( max( head, torso ), max( legs, bag ) ).mul( step( dens, h21( vec2( c, seed ) ) ) ).toVar();
    const t = h21( vec2( c, seed.add( 5.9 ) ) ).toVar();
    const cloth = mix( mix( vec3( .05, .055, .07 ), vec3( .3, .09, .07 ), step( .62, t ) ), mix( vec3( .5, .47, .42 ), vec3( .1, .17, .3 ), step( .3, t ) ), step( .45, fract( t.mul( 7. ) ) ) ).toVar();
    const col = cloth.toVar();
    If( legs.greaterThan( .5 ).and( torso.lessThan( .5 ) ), () => { col.assign( vec3( .05, .055, .07 ).mul( mix( 1., 3., step( .7, fract( t.mul( 13. ) ) ) ) ) ); } );
    If( bag.greaterThan( .5 ).and( torso.lessThan( .5 ) ), () => { col.assign( mix( vec3( .06, .065, .07 ), vec3( .35, .1, .06 ), step( .75, fract( t.mul( 3. ) ) ) ) ); } );
    If( head.greaterThan( .5 ), () => { col.assign( mix( vec3( .4, .28, .2 ), vec3( .06, .05, .045 ), step( h, H.sub( .05 ) ).mul( step( .4, fract( t.mul( 5. ) ) ) ).mul( step( abs( h.sub( H ).add( .04 ) ), .07 ) ) ) ); } );
    return vec4( col, m );
  }, { u: 'float', h: 'float', seed: 'float', dens: 'float', return: 'vec4' } );

  // 候機座椅：9 m 一組（中間 7 m 坐滿、兩端走道），0.62 m 一個座位：椅背、椅面、扶手；回傳 (rgb, 遮罩)
  const seats = Fn( ( [ u, h, seed ] ) => {
    const g = floor( u.div( 9. ) ).toVar(), fu = u.sub( g.mul( 9. ) ).toVar();
    const inG = step( 1., fu ).mul( step( fu, 8. ) ).mul( step( .22, h21( vec2( g, seed ) ) ) ).toVar();
    const fs = fract( fu.div( .62 ) ).toVar();
    const back = step( .06, fs ).mul( step( fs, .94 ) ).mul( step( .44, h ) ).mul( step( h, .92 ) ).toVar();
    const pan = step( .4, h ).mul( step( h, .47 ) ).toVar();
    const arm = step( abs( fs.sub( .0 ) ), .04 ).add( step( .96, fs ) ).mul( step( .3, h ) ).mul( step( h, .62 ) ).toVar();
    const leg = step( abs( fract( fu.div( 1.86 ) ).sub( .5 ) ), .03 ).mul( step( h, .4 ) ).toVar();
    const m = clamp( max( max( back, pan ), max( arm, leg ) ), 0., 1. ).mul( inG ).toVar();
    const col = select( back.greaterThan( .5 ), mix( vec3( .045, .05, .06 ), vec3( .11, .16, .24 ), step( .6, h21( vec2( g, seed.add( 2. ) ) ) ) ), vec3( .32, .33, .34 ) );
    return vec4( col, m );
  }, { u: 'float', h: 'float', seed: 'float', return: 'vec4' } );

  // 商店的店面（後牆）：9 m 一間，石材柱、整面亮著的櫥窗（貨架、商品點）、店招帶上一塊亮的招牌（沒有字）；回傳 (反照率, 自發光)
  const shop = Fn( ( [ u, h, seed ] ) => {
    const bay = floor( u.div( 9. ) ).toVar(), fu = u.sub( bay.mul( 9. ) ).toVar(), k = h21( vec2( bay, seed ) ).toVar();
    const alb = vec3( .46, .45, .43 ).toVar(), emi = vec3( 0. ).toVar();
    alb.mulAssign( sub1( smoothstep( .03, 0., abs( fract( u.div( 1.2 ) ).sub( .5 ) ).sub( .47 ) ).mul( .2 ) ) );
    const pil = step( fu, .55 ).add( step( 8.45, fu ) ).toVar();
    const hue = mix( mix( vec3( 1., .78, .52 ), vec3( .86, .92, 1. ), step( .35, k ) ), mix( vec3( 1., .62, .5 ), vec3( .95, .9, .78 ), step( .5, fract( k.mul( 7. ) ) ) ), step( .7, k ) ).toVar();
    If( pil.lessThan( .5 ).and( h.lessThan( 3.4 ) ).and( h.greaterThan( .05 ) ), () => {
      const shelf = smoothstep( .05, .0, abs( fract( h.div( .55 ) ).sub( .5 ) ).sub( .44 ) ).mul( step( .3, h ) ).toVar();
      const goods = step( .45, n2( vec2( u.mul( 6. ), floor( h.div( .55 ) ).mul( 3. ).add( seed ) ) ) ).mul( step( h, 2.4 ) ).toVar();
      const dark = step( .86, k ).toVar();   // 少數幾間是暗的（打烊、施工圍板）
      alb.assign( mix( vec3( .2 ), vec3( .08, .085, .09 ), goods ) );
      emi.assign( hue.mul( sub1( shelf.mul( .5 ) ) ).mul( sub1( goods.mul( .55 ) ) ).mul( sub1( dark.mul( .9 ) ) ).mul( .9 ) );
    } );
    If( pil.lessThan( .5 ).and( h.greaterThan( 3.6 ) ).and( h.lessThan( 4.35 ) ), () => {
      alb.assign( vec3( .03, .032, .035 ) );
      const lw = h21( vec2( bay, seed.add( 4. ) ) ).mul( 1.6 ).add( 2.2 ).toVar(), lx = h21( vec2( bay, seed.add( 9. ) ) ).mul( 8.4 ).sub( lw ).max( .9 ).toVar();
      const logo = step( lx, fu ).mul( step( fu, lx.add( lw ) ) ).mul( step( abs( h.sub( 3.97 ) ), .17 ) ).toVar();
      const lc = mix( vec3( 1., .97, .92 ), mix( vec3( .95, .55, .2 ), vec3( .3, .6, .95 ), step( .5, fract( k.mul( 11. ) ) ) ), step( .55, fract( k.mul( 5. ) ) ) ).toVar();
      emi.assign( lc.mul( logo ).mul( 1.6 ) );
    } );
    return TSL.mat3( alb, emi, vec3( 0. ) );
  }, { u: 'float', h: 'float', seed: 'float', return: 'mat3' } );

  // 航廈大廳（材質 53）：回傳玻璃後面那一點的亮度
  // 南面（機坪側）：樓板 5.4 m、13 m 進去有一層夾層（頂 11.6）；北面（出境大廳）：玻璃上 8.0–8.8 的深色帶就是二樓樓板，從玻璃就開始；
  // 東面玻璃山牆：看進 60 m 長的大廳，18 m 進去有夾層。天花是屋頂底面的弧（南北面每進 1 m 升 0.37 m；山牆照 u 算弧高）。
  // 共用的大廳：q = (地板 yF, 夾層頂 yM, 夾層從玻璃進去多深 sM, 後牆深 D)，c = (玻璃處的天花高 yC0, 每進 1 m 天花升多少 kC)；沒有夾層時 sM 給很大
  const hallG = Fn( ( [ p, n, w, q, c ] ) => {
    const d = rayL( w ).toVar(), t = vec3( n.z, 0., n.x.negate() ).toVar();
    const ds = max( dot( d, n ).negate(), .03 ).toVar(), a = dot( d, t ).div( ds ).toVar(), b = d.y.div( ds ).toVar();
    const u0 = dot( p, t ).toVar(), y0 = p.y.toVar();
    const yF = q.x.toVar(), yM = q.y.toVar(), sM = q.z.toVar(), D = q.w.toVar(), yC0 = c.x.toVar(), kC = c.y.toVar();
    // 各面的交點（s）：後牆、地板、天花、夾層頂、夾層底、夾層邊
    const sHit = D.toVar(), id = float( 0. ).toVar();
    const sF = select( b.lessThan( -1e-4 ), yF.sub( y0 ).div( b ), float( BIG ) ).toVar();
    If( sF.greaterThan( 0. ).and( sF.lessThan( sHit ) ), () => { sHit.assign( sF ); id.assign( 1. ); } );
    const sC = select( b.sub( kC ).greaterThan( 1e-4 ), yC0.sub( y0 ).div( b.sub( kC ) ), float( BIG ) ).toVar();
    If( sC.greaterThan( 0. ).and( sC.lessThan( sHit ) ), () => { sHit.assign( sC ); id.assign( 2. ); } );
    const sMt = select( b.lessThan( -1e-4 ).and( y0.greaterThan( yM ) ), yM.sub( y0 ).div( b ), float( BIG ) ).toVar();
    If( sMt.greaterThanEqual( sM ).and( sMt.lessThan( sHit ) ), () => { sHit.assign( sMt ); id.assign( 3. ); } );
    const yS = yM.sub( .6 ).toVar(), sMs = select( b.greaterThan( 1e-4 ).and( y0.lessThan( yS ) ), yS.sub( y0 ).div( b ), float( BIG ) ).toVar();
    If( sMs.greaterThanEqual( sM ).and( sMs.lessThan( sHit ) ), () => { sHit.assign( sMs ); id.assign( 4. ); } );
    const yE = y0.add( b.mul( sM ) ).toVar();
    If( sM.greaterThan( .1 ).and( sM.lessThan( sHit ) ).and( yE.greaterThan( yS ) ).and( yE.lessThan( yM.add( 1.05 ) ) ), () => { sHit.assign( sM ); id.assign( 5. ); } );
    const uH = u0.add( a.mul( sHit ) ).toVar(), yH = y0.add( b.mul( sHit ) ).toVar();
    const alb = vec3( .4 ).toVar(), emi = vec3( 0. ).toVar();
    const lampK = uLamp.mul( .6 ).add( .4 ).toVar();
    If( id.equal( 0. ), () => {   // 後牆：樓下與夾層上各一排店面
      const lb = select( yH.greaterThan( yM ).and( sHit.greaterThanEqual( sM ) ), yM, yF ).toVar();
      const r = shop( uH, yH.sub( lb ), lb.add( D ) ).toVar();
      alb.assign( r[ 0 ] ); emi.assign( r[ 1 ].mul( uLamp.mul( .5 ).add( .5 ) ) );
    } ).ElseIf( id.equal( 1. ).or( id.equal( 3. ) ), () => {   // 地板：1.2 m 的石材、縫、天花燈帶的倒影
      const q = vec2( uH, sHit ).div( 1.2 ).toVar(), f = abs( fract( q ).sub( .5 ) ).toVar();
      const grout = smoothstep( .47, .5, max( f.x, f.y ) ).toVar();
      alb.assign( vec3( .5, .49, .46 ).mul( n2( floor( q ).mul( 1.7 ) ).mul( .18 ).add( .82 ) ).mul( sub1( grout.mul( .35 ) ) ) );
      emi.assign( vec3( 1., .95, .86 ).mul( smoothstep( .3, .0, abs( fract( sHit.div( 3.6 ) ).sub( .5 ) ) ) ).mul( .12 ).mul( lampK ) );
    } ).ElseIf( id.equal( 2. ), () => {   // 屋頂底面：沿玻璃的長條燈、吸音板
      const ln = smoothstep( .1, .03, abs( fract( sHit.div( 3.6 ) ).sub( .5 ) ).mul( 3.6 ).sub( .05 ) ).toVar();
      alb.assign( vec3( .56, .55, .52 ).mul( sub1( step( .48, abs( fract( uH.div( .6 ) ).sub( .5 ) ) ).mul( .15 ) ) ) );
      emi.assign( vec3( 1., .96, .88 ).mul( ln ).mul( 2.2 ).mul( lampK ) );
    } ).ElseIf( id.equal( 4. ), () => {   // 夾層底：崁燈點
      const g = fract( vec2( uH, sHit ).div( 2.4 ) ).sub( .5 ).mul( 2.4 ).toVar();
      alb.assign( vec3( .6, .59, .56 ) );
      emi.assign( vec3( 1., .86, .66 ).mul( smoothstep( .13, .07, length( g ) ) ).mul( 3. ).mul( lampK ) );
    } ).Else( () => {   // 夾層邊：白色的樓板封邊、底下一條燈；上面是玻璃欄杆（帶一點綠）
      const hy = yH.sub( yS ).toVar();
      alb.assign( select( hy.lessThan( .65 ), vec3( .7, .7, .68 ), vec3( .16, .2, .19 ) ) );
      emi.assign( vec3( 1., .93, .82 ).mul( step( hy, .08 ) ).mul( 1.6 ).mul( lampK ) );
      If( hy.greaterThan( .65 ), () => {   // 欄杆是透的：後面照樣看得到夾層上的店面，只壓暗
        const r = shop( u0.add( a.mul( D ) ), y0.add( b.mul( D ) ).sub( yM ), yM.add( D ) ).toVar();
        alb.assign( r[ 0 ].mul( .7 ) ); emi.assign( r[ 1 ].mul( .6 ).add( vec3( 1. ).mul( smoothstep( .05, .0, abs( hy.sub( 1.6 ) ) ) ).mul( .4 ) ) );
      } );
    } );
    // 直立的剪影：遠的先畫，近的蓋上去（柱與人 9 m、人與第二排座椅 5 m、夾層上的人、第一排座椅 2.4 m）
    const lay = ( sk, base, fn ) => {
      If( sk.lessThan( sHit ), () => {
        const uk = u0.add( a.mul( sk ) ).toVar(), hk = y0.add( b.mul( sk ) ).sub( base ).toVar();
        const r = fn( uk, hk ).toVar();
        If( r.w.greaterThan( .5 ), () => { alb.assign( r.xyz ); emi.assign( vec3( 0. ) ); } );
      } );
    };
    lay( float( 9. ), yF, ( uk, hk ) => {
      const cu = fract( uk.add( 4.5 ).div( 18. ) ).sub( .5 ).mul( 18. ).toVar(), col = step( abs( cu ), .45 ).mul( step( 0., hk ) ).toVar();
      const pr = person( uk, hk, float( 3. ), float( .74 ) ).toVar();
      return select( col.greaterThan( .5 ), vec4( vec3( .62, .62, .6 ).mul( sqrt( max( cu.div( .45 ).mul( cu.div( .45 ) ).negate().add( 1. ), 0. ) ).mul( .5 ).add( .5 ) ), 1. ), pr );
    } );
    lay( float( 5. ), yF, ( uk, hk ) => { const pr = person( uk, hk, float( 7. ), float( .7 ) ).toVar(); return select( pr.w.greaterThan( .5 ), pr, seats( uk.add( 4.5 ), hk, float( 2. ) ) ); } );
    lay( max( sM, float( .5 ) ).add( 2.8 ), yM, ( uk, hk ) => person( uk, hk, float( 11. ), float( .78 ) ) );
    lay( float( 2.4 ), yF, ( uk, hk ) => { const pr = person( uk, hk, float( 13. ), float( .86 ) ).toVar(); return select( pr.w.greaterThan( .5 ), pr, seats( uk, hk, float( 5. ) ) ); } );
    // 照明：白天是天光加一點燈，入夜是暖白的燈；越深越暗一點
    const amb = vec3( 1., .95, .86 ).mul( uLamp.mul( .42 ) ).add( vec3( .86, .9, 1. ).mul( uDay.mul( .2 ) ) ).add( .03 ).toVar();
    return alb.mul( amb ).add( emi ).mul( exp( sHit.mul( -.012 ) ).mul( .4 ).add( .6 ) ).mul( .8 );
  }, { p: 'vec3', n: 'vec3', w: 'vec3', q: 'vec4', c: 'vec2', return: 'vec3' } );
  const hall = Fn( ( [ p, n, w ] ) => {
    const south = step( .5, n.z ).toVar(), east = step( .5, n.x ).toVar(), north = step( .5, n.z.negate() ).toVar(), u0 = dot( p, vec3( n.z, 0., n.x.negate() ) ).toVar();
    const yF = mix( float( .6 ), float( 5.4 ), south ), yM = mix( float( 8.8 ), float( 11.6 ), south );
    const sM = mix( mix( float( 18. ), float( 0. ), north ), float( 13. ), south );
    const D = mix( mix( float( 60. ), float( 28. ), north ), float( 26. ), south );
    const yC0 = mix( float( 17.7 ), sqrt( max( u0.mul( u0 ).negate().add( 16666.8 ), 0. ) ).sub( 103.3 ), east ), kC = mix( float( .37 ), float( 0. ), east );
    return hallG( p, n, w, vec4( yF, yM, sM, D ), vec2( yC0, kC ) );
  }, { p: 'vec3', n: 'vec3', w: 'vec3', return: 'vec3' } );
  // 第二航廈 T2（材質 56，blender/airbld.py 的 term2）：屋頂底面 y = 17 − 0.08·z（陸側 z +30 低、空側 z −30 高）。
  // 空側（法線 −z）：出境大廳在 4.4 m 的樓層上、沒有夾層、往裡 30 m 是中央的店面；陸側（法線 +z）：入境大廳在地面，12 m 進去有一層 6.2 m 的夾層
  const hall2 = Fn( ( [ p, n, w ] ) => {
    const land = step( .5, n.z ).toVar();
    const q = mix( vec4( 4.4, 1e4, 1e4, 30. ), vec4( .15, 6.2, 12., 30. ), land );
    const c = mix( vec2( 19.4, -.08 ), vec2( 14.6, .08 ), land );
    return hallG( p, n, w, q, c );
  }, { p: 'vec3', n: 'vec3', w: 'vec3', return: 'vec3' } );

  // 小房間（材質 54）：塔台基座的大廳、機庫後面的工作間 —— 3.6 m 寬、6 m 深、4.2 m 一層（輕鋼架天花在 3.3 m），桌子、螢幕、人；
  // 空橋的通道（法線 ±x、|x| < 2、z −12..28 的玻璃）：2.9 m 寬，看過去是對面的玻璃與天空，入夜是通道裡的燈
  const room = Fn( ( [ p, n, w ] ) => {
    const d = rayL( w ).toVar(), t = vec3( n.z, 0., n.x.negate() ).toVar();
    const ds = max( dot( d, n ).negate(), .03 ).toVar(), a = dot( d, t ).div( ds ).toVar(), b = d.y.div( ds ).toVar();
    const u0 = dot( p, t ).toVar(), y0 = p.y.toVar(), out = vec3( 0. ).toVar();
    const corr = step( .5, abs( n.x ) ).mul( step( abs( p.x ), 2. ) ).mul( step( abs( p.z.sub( 8. ) ), 20. ) ).toVar();
    If( corr.greaterThan( .5 ), () => {
      const uF = u0.add( a.mul( 2.9 ) ).toVar(), rib = smoothstep( .09, .05, abs( fract( uF.div( 1.5 ) ).sub( .5 ) ).mul( 1.5 ) ).toVar();
      const pr = person( u0.add( a.mul( 1.4 ) ), y0.add( b.mul( 1.4 ) ).sub( y0 ).add( 1.1 ), float( 21. ), float( .8 ) ).toVar();
      const sky = uSkyHor.mul( uDay.mul( .55 ) ).add( vec3( 1., .9, .74 ).mul( uLamp.mul( .3 ) ) ).toVar();
      out.assign( mix( sky.mul( sub1( rib.mul( .8 ) ) ), pr.xyz.mul( uDay.mul( .2 ).add( uLamp.mul( .4 ) ).add( .03 ) ), pr.w ) );
    } ).Else( () => {
      const W = float( 3.6 ), Dp = float( 6. ), lv = floor( y0.div( 4.2 ) ).toVar(), yF = lv.mul( 4.2 ).add( .05 ).toVar(), yC = yF.add( 3.3 ).toVar();
      const uc = floor( u0.div( W ) ).toVar(), seed = h21( vec2( uc, lv.add( dot( p, vec3( .013, 0., .029 ) ).floor() ) ) ).toVar();
      const sHit = Dp.toVar(), id = float( 0. ).toVar();
      const sS = select( a.greaterThan( 1e-4 ), uc.add( 1. ).mul( W ).sub( u0 ).div( a ), select( a.lessThan( -1e-4 ), uc.mul( W ).sub( u0 ).div( a ), float( BIG ) ) ).toVar();
      If( sS.lessThan( sHit ), () => { sHit.assign( sS ); id.assign( 1. ); } );
      const sF = select( b.lessThan( -1e-4 ), yF.sub( y0 ).div( b ), float( BIG ) ).toVar();
      If( sF.greaterThan( 0. ).and( sF.lessThan( sHit ) ), () => { sHit.assign( sF ); id.assign( 2. ); } );
      const sC = select( b.greaterThan( 1e-4 ), yC.sub( y0 ).div( b ), float( BIG ) ).toVar();
      If( sC.greaterThan( 0. ).and( sC.lessThan( sHit ) ), () => { sHit.assign( sC ); id.assign( 3. ); } );
      const uH = u0.add( a.mul( sHit ) ).toVar(), yH = y0.add( b.mul( sHit ) ).toVar(), fu = uH.sub( uc.mul( W ) ).toVar();
      const lit = step( .28, seed ).toVar(), alb = mix( vec3( .62, .6, .56 ), vec3( .5, .55, .58 ), step( .6, fract( seed.mul( 9. ) ) ) ).toVar(), emi = vec3( 0. ).toVar();
      If( id.equal( 2. ), () => { alb.assign( vec3( .16, .17, .19 ).mul( n2( vec2( uH, sHit ).mul( 3. ) ).mul( .2 ).add( .9 ) ) ); } );
      If( id.equal( 3. ), () => {
        const g = abs( fract( vec2( uH, sHit ).div( vec2( 1.2, 2.4 ) ) ).sub( .5 ) ).toVar();
        alb.assign( vec3( .7 ) ); emi.assign( vec3( .95, .97, 1. ).mul( step( g.x, .24 ).mul( step( g.y, .12 ) ) ).mul( 2.4 ).mul( lit ) );
      } );
      If( id.equal( 0. ), () => {   // 後牆：一塊白板或櫃子
        const hy = yH.sub( yF ).toVar();
        alb.mulAssign( sub1( step( abs( fu.sub( 1.8 ) ), 1.1 ).mul( step( abs( hy.sub( 1.5 ) ), .55 ) ).mul( .15 ) ) );
      } );
      // 桌子與螢幕（1.6 m）、人（3 m）
      const sk = float( 1.6 ).toVar();
      If( sk.lessThan( sHit ), () => {
        const uk = u0.add( a.mul( sk ) ).sub( uc.mul( W ) ).toVar(), hk = y0.add( b.mul( sk ) ).sub( yF ).toVar();
        const desk = step( .35, uk ).mul( step( uk, 3.25 ) ).mul( step( .7, hk ) ).mul( step( hk, .76 ) ).add( step( abs( fract( uk.div( 1.45 ) ).sub( .5 ) ), .03 ).mul( step( hk, .7 ) ).mul( step( .35, uk ) ).mul( step( uk, 3.25 ) ) ).toVar();
        const mon = step( abs( uk.sub( seed.mul( 1.6 ).add( 1. ) ) ), .27 ).mul( step( .82, hk ) ).mul( step( hk, 1.12 ) ).toVar();
        If( desk.greaterThan( .5 ), () => { alb.assign( vec3( .36, .33, .3 ) ); emi.assign( vec3( 0. ) ); } );
        If( mon.greaterThan( .5 ), () => { alb.assign( vec3( .02 ) ); emi.assign( vec3( .5, .7, 1. ).mul( lit ).mul( .9 ) ); } );
      } );
      const sp = float( 3. ).toVar();
      If( sp.lessThan( sHit ), () => {
        const pr = person( u0.add( a.mul( sp ) ), y0.add( b.mul( sp ) ).sub( yF ), seed.mul( 40. ), float( .7 ) ).toVar();
        If( pr.w.greaterThan( .5 ), () => { alb.assign( pr.xyz ); emi.assign( vec3( 0. ) ); } );
      } );
      const amb = vec3( 1., .97, .92 ).mul( uLamp.mul( lit ).mul( .5 ) ).add( vec3( .86, .9, 1. ).mul( uDay.mul( .2 ) ) ).add( .02 ).toVar();
      out.assign( alb.mul( amb ).add( emi.mul( uLamp.mul( .6 ).add( .4 ) ) ).mul( .75 ) );
    } );
    return out;
  }, { p: 'vec3', n: 'vec3', w: 'vec3', return: 'vec3' } );

  return { hall, hall2, room };
}
