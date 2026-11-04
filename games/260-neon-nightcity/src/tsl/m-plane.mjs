// 材質的 TSL：客機的塗裝（21-air.js 的 airLivery）。從 m-glb.mjs 的 {FAR, DOUBLE} 變體改來：多一個模型座標的 vP，
// 在打光前把白漆的地方塗上灰鷺航空的塗裝（機腹的石板藍弧線、琥珀色細線、尾翼與鷺、機名、註冊號、發動機、蒙皮接縫）
export default {
"{\"FAR\":\"*\",\"DOUBLE\":\"\"}": {
  h: "1pgzi4wgsn", fog: true, lib: "[[\"FAR\",\"*\"]]NL_T,NOCC_T,SH_N_T,VOL_N_T,FAR", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"tLiv","type":"sampler2D","src":"tLiv"},{"name":"uLiv","type":"vec4","src":"uLiv"},{"name":"uLiv2","type":"vec4","src":"uLiv2"},{"name":"uLiv3","type":"vec4","src":"uLiv3"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAHMap","type":"sampler2D","src":"uAHMap"},{"name":"uAHM","type":"vec4","src":"uAHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"},{"name":"vP","type":"vec3","src":"vP"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, vec2, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, tLiv, uLiv, uLiv2, uLiv3, vW, vN, vCol, vPbr, vEmi, vUv, vWin, vP, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vP.assign( position );
    	vUv.assign( vec2( 0 ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn, fwidth, atan, float, sign, exp, sin } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, tLiv, uLiv, uLiv2, uLiv3, vW, vN, vCol, vPbr, vEmi, vUv, vWin, vP, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();

    	If( vW.y.lessThan( uClipY ), () => {

    		Discard();

    	} );

    	If( uFocus.w.greaterThan( 0. ), () => {

    		const ab = uFocus.xyz.sub( uCam ).toVar();
    		const tt = clamp( dot( vW.sub( uCam ), ab ).div( dot( ab, ab ) ), 0., 1. ).toVar();
    		const dd = length( vW.sub( uCam ).sub( ab.mul( tt ) ) ).toVar(), cd = length( vW.sub( uCam ) ).toVar();
    		const fade = max( sub( 1., smoothstep( .5, 1.6, cd ) ), sub( 1., smoothstep( .45, 1., dd ) ).mul( step( tt, .8 ) ).mul( .8 ) ).toVar();

    		If( fract( mul( 52.9829189, fract( dot( fragCoord_.xy, vec2( .06711056, .00583715 ) ) ) ) ).lessThan( fade ), () => {

    			Discard();

    		} );

    	} );

    	const base = vCol.toVar();
    	// ─── 塗裝（灰鷺航空）：模型座標（機頭 +z、機身軸 y = uLiv.x、半徑 uLiv.y、機頭 z uLiv.z、機尾 z uLiv.w），只塗淺色（白漆）的地方 ───
    	const P = vP.toVar();
    	const yc = uLiv.x, R = uLiv.y, zN = uLiv.z, zT = uLiv.w;
    	const ax = abs( P.x ).toVar();
    	const lum = dot( vCol.rgb, vec3( .2126, .7152, .0722 ) ).toVar();
    	const pnt = smoothstep( .3, .5, lum ).toVar();
    	const rr = length( vec2( P.x, P.y.sub( yc ) ) ).toVar();
    	const fus = step( rr, R.mul( 1.08 ) ).toVar();
    	const fin = step( ax, .75 ).mul( step( yc.add( R.mul( 1.04 ) ), P.y ) ).mul( step( P.z, zT.add( 9. ) ) ).toVar();
    	const eng = step( length( vec2( ax.sub( uLiv3.x ), P.y.sub( uLiv2.w ) ) ), uLiv3.w ).mul( step( uLiv3.y, P.z ) ).mul( step( P.z, uLiv3.z ) ).mul( sub( 1., fus ) ).toVar();
    	const slate = vec3( .0137, .0467, .0908 ), amber = vec3( .745, .36, .042 );
    	const fy = max( fwidth( P.y ), 1e-3 ).toVar();
    	const tailK = smoothstep( zT.add( 15. ), zT.add( 3.5 ), P.z ).toVar();
    	const noseK = smoothstep( zN.sub( 12. ), zN.sub( 3. ), P.z ).toVar();
    	const yb = yc.sub( R.mul( .2 ) ).add( R.mul( 1.6 ).mul( tailK.mul( tailK ) ) ).sub( R.mul( .72 ).mul( noseK ) ).toVar();
    	const low = smoothstep( yb.add( fy ), yb.sub( fy ), P.y ).toVar();
    	const s0 = yb.add( R.mul( .06 ) ), s1 = yb.add( R.mul( .13 ) );
    	const strp = smoothstep( s0.sub( fy ), s0.add( fy ), P.y ).mul( smoothstep( s1.add( fy ), s1.sub( fy ), P.y ) ).toVar();
    	const lv = base.rgb.mul( .8 ).toVar();   // 白漆的反照率約 0.8（原模型是 1.0，白天會發光）
    	lv.assign( mix( lv, slate, low.mul( fus ) ) );
    	lv.assign( mix( lv, amber, strp.mul( fus ) ) );
    	// 尾翼：整片石板藍，翼根一條琥珀色；白色的鷺（tLiv 的 G，兩側都朝機頭）
    	const fTop = uLiv2.z, fh = fTop.sub( yc ).sub( R ).toVar();
    	lv.assign( mix( lv, slate, fin ) );
    	lv.assign( mix( lv, amber, fin.mul( smoothstep( yc.add( R.mul( 1.04 ) ).add( fh.mul( .07 ) ), yc.add( R.mul( 1.04 ) ).add( fh.mul( .1 ) ), P.y ) ).mul( smoothstep( yc.add( R.mul( 1.04 ) ).add( fh.mul( .15 ) ), yc.add( R.mul( 1.04 ) ).add( fh.mul( .12 ) ), P.y ) ) ) );
    	const ls = fh.mul( .62 ).toVar(), ly = yc.add( R ).add( fh.mul( .52 ) ).toVar(), lz = mix( uLiv2.x, uLiv2.y, .5 ).sub( fh.mul( .12 ) ).toVar();
    	const lu = lz.add( ls.mul( .5 ) ).sub( P.z ).div( ls ).toVar(), lvv = ly.add( ls.mul( .5 ) ).sub( P.y ).div( ls ).toVar();
    	lu.assign( select( P.x.greaterThan( 0. ), lu, sub( 1., lu ) ) );
    	const inL = step( 0., lu ).mul( step( lu, 1. ) ).mul( step( 0., lvv ) ).mul( step( lvv, 1. ) ).toVar();
    	lv.assign( mix( lv, vec3( .86, .86, .84 ), tLiv.sample( vec2( lu.mul( .5 ), add( .5, lvv.mul( .5 ) ) ) ).g.mul( inL ).mul( fin ) ) );
    	// 機名（窗列上方，兩側都從機頭往後讀）與機尾的註冊號
    	const t0 = yc.add( R.mul( .5 ) ), t1 = yc.add( R.mul( .88 ) ), zA = zN.sub( 5.4 ), Lt = R.mul( 6.6 );
    	const tu = zA.sub( P.z ).div( Lt ).toVar(), tv = t1.sub( P.y ).div( t1.sub( t0 ) ).toVar();
    	tu.assign( select( P.x.greaterThan( 0. ), tu, sub( 1., tu ) ) );
    	const inT = step( 0., tu ).mul( step( tu, 1. ) ).mul( step( 0., tv ) ).mul( step( tv, 1. ) ).mul( fus ).mul( step( R.mul( .3 ), ax ) ).toVar();
    	lv.assign( mix( lv, slate, tLiv.sample( vec2( tu, tv.mul( .5 ) ) ).r.mul( inT ) ) );
    	const r0 = yc.add( R.mul( .42 ) ), r1 = yc.add( R.mul( .62 ) ), zR = zT.add( 12.5 ), Lr = R.mul( 2.4 );
    	const ru = zR.sub( P.z ).div( Lr ).toVar(), rv = r1.sub( P.y ).div( r1.sub( r0 ) ).toVar();
    	ru.assign( select( P.x.greaterThan( 0. ), ru, sub( 1., ru ) ) );
    	const inR = step( 0., ru ).mul( step( ru, 1. ) ).mul( step( 0., rv ) ).mul( step( rv, 1. ) ).mul( fus ).mul( step( R.mul( .3 ), ax ) ).toVar();
    	lv.assign( mix( lv, slate, tLiv.sample( vec2( add( .5, ru.mul( .5 ) ), add( .5, rv.mul( .5 ) ) ) ).b.mul( inR ) ) );
    	// 發動機短艙：石板藍，進氣口一圈琥珀；翼面與水平尾翼：淺灰
    	lv.assign( mix( lv, slate, eng ) );
    	lv.assign( mix( lv, amber, eng.mul( smoothstep( uLiv3.z.sub( .35 ), uLiv3.z.sub( .25 ), P.z ) ) ) );
    	const wing = sub( 1., fus ).mul( sub( 1., fin ) ).mul( sub( 1., eng ) ).toVar();
    	lv.assign( mix( lv, lv.mul( vec3( .7, .72, .74 ) ), wing ) );
    	// 蒙皮接縫：機身每 2.13 m 一道框、兩條縱向搭接；遠了淡掉
    	const fz = max( fwidth( P.z ), 1e-3 ).toVar();
    	const dz = abs( fract( P.z.div( 2.13 ) ).sub( .5 ) ).mul( 2.13 ).toVar();
    	const ang = atan( P.y.sub( yc ), ax ).toVar(), fa = max( fwidth( ang ), 1e-4 ).toVar();
    	const seam = max( sub( 1., smoothstep( .008, fz.mul( 1.5 ).add( .008 ), dz ) ), max( sub( 1., smoothstep( .004, fa.mul( 1.5 ).add( .004 ), abs( ang.sub( .62 ) ) ) ), sub( 1., smoothstep( .004, fa.mul( 1.5 ).add( .004 ), abs( ang.add( .5 ) ) ) ) ) ).mul( fus ).mul( sub( 1., smoothstep( .015, .06, fz ) ) ).toVar();
    	lv.mulAssign( sub( 1., seam.mul( .22 ) ) );
    	// 翼面的接縫：沿翼展每 1.6 m、沿翼弦每 0.9 m（弦向淡一點），遠了淡掉
    	const fx = max( fwidth( ax ), 1e-3 ).toVar();
    	const dw = abs( fract( ax.div( 1.6 ) ).sub( .5 ) ).mul( 1.6 ), dc = abs( fract( P.z.div( .9 ) ).sub( .5 ) ).mul( .9 );
    	const wseam = max( sub( 1., smoothstep( .01, fx.mul( 1.5 ).add( .01 ), dw ) ), sub( 1., smoothstep( .01, fz.mul( 1.5 ).add( .01 ), dc ) ).mul( .6 ) ).mul( wing ).mul( sub( 1., smoothstep( .015, .06, max( fx, fz ) ) ) ).toVar();
    	lv.mulAssign( sub( 1., wseam.mul( .34 ) ) );
    	// 機腹的油污與雨水流痕：下半機身越往下越髒，主翼附近（發動機後 6 m 一帶）最重，沿 z 一條條深淺
    	const belly = smoothstep( yc.sub( R.mul( .15 ) ), yc.sub( R.mul( .95 ) ), P.y ).mul( fus ).toVar();
    	const gz = P.z.sub( uLiv3.z.sub( 6. ) ).toVar(), wgK = exp( gz.mul( gz ).div( -90. ) );
    	const stk = fract( sin( floor( P.z.mul( 2.3 ) ).mul( 91.7 ) ).mul( 43758.5 ) ).toVar();
    	lv.assign( mix( lv, lv.mul( vec3( .7, .68, .62 ) ), belly.mul( wgK.mul( .5 ).add( .22 ) ).mul( stk.mul( .5 ).add( .5 ) ) ) );
    	// 機尾的排氣燻黑
    	lv.assign( mix( lv, lv.mul( .45 ), smoothstep( zT.add( 2.2 ), zT.add( .2 ), P.z ).mul( fus ) ) );
    	base.rgb.assign( mix( base.rgb, lv, pnt ) );

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	const n = normalize( vN ).toVar();

    	If( frontFacing_.not(), () => {

    		n.assign( n.negate() );

    	} );

    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );
    	rough.assign( mix( rough, mix( .5, .26, max( fus, fin ) ), pnt ) );
    	coat.assign( mix( coat, max( fus, fin ).mul( .55 ), pnt ) );

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( 1.5 ) ), () => {

    		const pf = uPaint.w.toVar();

    		If( pf.lessThan( 2.5 ), () => {

    			metal.assign( .55 );
    			rough.assign( .3 );
    			coat.assign( 1. );

    		} ).ElseIf( pf.lessThan( 3.5 ), () => {

    			metal.assign( 0. );
    			rough.assign( .72 );
    			coat.assign( 0. );

    		} ).ElseIf( pf.lessThan( 4.5 ), () => {

    			rough.assign( .22 );
    			coat.assign( 1. );
    			base.rgb.assign( mix( base.rgb, base.rgb.gbr.mul( .7 ).add( vec3( .12, .08, .16 ) ), pow( sub( 1., max( dot( n, v ), 0. ) ), 1.6 ).mul( .85 ) ) );

    		} ).Else( () => {

    			metal.assign( 1. );
    			rough.assign( .06 );
    			coat.assign( 1. );
    			base.rgb.assign( mix( base.rgb, vec3( .9 ), .35 ) );

    		} );

    	} );

    	base.rgb.assign( mix( base.rgb, vec3( .03, .026, .022 ), uM.w ) );
    	rough.assign( mix( rough, .95, uM.w ) );
    	metal.mulAssign( sub( 1., uM.w ) );
    	coat.mulAssign( sub( 1., uM.w ) );
    	const wet = uWet.mul( smoothstep( .55, .95, n.y ) ).toVar();
    	wet.assign( 0. );
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, 1. ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

    	} );

    	const emi = vEmi.rgb.div( max( 1., max( vEmi.r, max( vEmi.g, vEmi.b ) ) ) ).toVar();
    	const k = vEmi.a.toVar();

    	If( abs( fract( k ).sub( .25 ) ).lessThan( .05 ), () => {

    		k.assign( floor( k ) );
    		const mx = max( base.g, base.b ).toVar();
    		emi.mulAssign( select( k.greaterThan( 1.5 ), smoothstep( 1.6, 3.2, base.r.div( max( mx, .015 ) ) ).mul( smoothstep( .015, .08, base.r ) ), max( smoothstep( .1, .45, dot( base.rgb, vec3( .2126, .7152, .0722 ) ) ), sub( 1., base.a ).mul( 1.2 ) ) ) );

    	} ).ElseIf( abs( fract( k ).sub( .5 ) ).lessThan( .05 ), () => {

    		k.assign( floor( k ) );

    	} );

    	c.addAssign( emi.mul( 1.6 ).mul( select( k.greaterThan( 1.5 ), add( .5, uM.y.mul( 2.4 ) ), select( k.greaterThan( .5 ), add( .35, uM.x.mul( 1.4 ) ), uM.z ) ) ).mul( sub( 1., uM.w ) ) );
    	fragOut_.assign( vec4( applyFog( c, uCam.add( vW.sub( uCam ).mul( farK( FAR ) ) ) ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
