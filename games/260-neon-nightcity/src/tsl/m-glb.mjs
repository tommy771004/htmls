// 材質的 TSL（原本由已刪除的 tools/gen-tsl.mjs 從 GLSL 轉出，現在是著色器的原始碼，直接改這裡）
// 材質 "glb"：鍵是 defines 的形狀（有值的寫成 *），h 是當初轉換時 GLSL 的雜湊（已不使用）
export default {
"{\"BLEND\":\"\",\"DOUBLE\":\"\",\"CUT\":\"*\"}": {
  h: "1slecn4gsy", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, vec2, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, CUT } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( vec2( 0 ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, CUT, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();

    	If( vW.y.lessThan( uClipY ), () => {

    		Discard();

    	} );

    	If( vW.x.greaterThan( CUT.x ).and( vW.x.lessThan( CUT.y ) ).and( vW.z.greaterThan( CUT.z ) ).and( vW.z.lessThan( CUT.w ) ).and( vW.y.lessThan( 3.9 ) ), () => {

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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( 1.1 );
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), clamp( base.a.add( sub( 1., max( dot( n, v ), 0. ) ).mul( .25 ) ), 0., 1. ) ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"BLEND\":\"\",\"DOUBLE\":\"\",\"USE_WINMAP\":\"\"}": {
  h: "1c271tugt4", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { abs, vec3, max, div, select, min, property, float, fract, mix, mul, add, step, sub, If, floor, vec2, length, Fn, vec4, Discard, dot, clamp, smoothstep, normalize, pow, reflect, dFdx, dFdy, mod } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




    const room =  Fn( ( [ o, vd, dim, hs, lc, kind ] ) => {

    	const inv = div( 1., max( abs( vd ), vec3( 1e-4 ) ) ).toVar();
    	const tx = select( vd.x.greaterThan( 0. ), dim.x.sub( o.x ), o.x ).mul( inv.x ).toVar();
    	const ty = select( vd.y.greaterThan( 0. ), dim.y.sub( o.y ), o.y ).mul( inv.y ).toVar();
    	const tz = dim.z.sub( o.z ).mul( inv.z ).toVar();
    	const t = min( tx, min( ty, tz ) ).toVar();
    	const hp = o.add( vd.mul( t ) ).toVar();
    	const c = property( 'vec3' );
    	const lit = float( 1. ).toVar();

    	If( t.equal( tz ), () => {

    		const bw = hp.xy.div( dim.xy ).toVar();
    		c.assign( mix( vec3( .56, .52, .47 ), vec3( .47, .48, .49 ), fract( hs.mul( 13. ) ) ).mul( add( .92, mul( .08, n2( hp.xy.mul( 2. ) ) ) ) ) );
    		c.mulAssign( mix( .55, 1., step( .035, bw.y ) ) );

    		If( kind.lessThan( .5 ), () => {

    			const pic = step( .18, bw.x ).mul( step( bw.x, .5 ) ).mul( step( .45, bw.y ) ).mul( step( bw.y, .72 ) ).mul( step( .45, fract( hs.mul( 7. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .16, .1, .06 ), pic ) );
    			const shelf = step( .62, bw.x ).mul( step( bw.x, .92 ) ).mul( step( bw.y, .75 ) ).mul( step( .6, fract( hs.mul( 3. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .2, .13, .08 ).mul( add( .6, mul( .4, step( .5, fract( bw.y.mul( 6. ) ) ) ) ) ), shelf ) );
    			const px = fract( hs.mul( 29. ) ).mul( .6 ).add( .2 ).toVar();
    			const person = step( abs( bw.x.sub( px ) ), sub( .07, mul( .03, step( .55, bw.y ) ) ) ).mul( step( bw.y, add( .62, mul( .08, step( abs( bw.x.sub( px ) ), .035 ) ) ) ) ).mul( step( .72, fract( hs.mul( 17. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .04 ), person ) );

    		} ).ElseIf( kind.lessThan( 1.5 ), () => {

    			c.assign( vec3( .5, .52, .55 ) );
    			const desk = step( bw.y, .32 ).mul( step( .2, bw.y ) ).toVar();
    			c.assign( mix( c, vec3( .18, .2, .22 ), desk ) );
    			const scr = step( .32, bw.y ).mul( step( bw.y, .42 ) ).mul( step( .5, fract( bw.x.mul( 5. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .3, .6, 1. ).mul( 2. ), scr.mul( step( .4, fract( hs.mul( 5. ) ) ) ) ) );

    		} );

    	} ).ElseIf( t.equal( ty ), () => {

    		If( vd.y.greaterThan( 0. ), () => {

    			c.assign( vec3( .75, .72, .66 ) );

    			If( kind.greaterThan( .5 ).and( kind.lessThan( 1.5 ) ), () => {

    				c.addAssign( step( .85, fract( hp.z.mul( .8 ) ) ).mul( 3. ) );

    			} );

    		} ).Else( () => {

    			c.assign( select( kind.greaterThan( .5 ), vec3( .3, .3, .31 ).mul( add( .9, mul( .1, step( .5, fract( hp.x.mul( 1.7 ) ) ) ) ) ), vec3( .33, .25, .18 ).mul( add( .82, mul( .18, h21( vec2( floor( hp.x.div( .16 ) ), hs ) ) ) ) ) ) );

    		} );

    	} ).Else( () => {

    		c.assign( mix( vec3( .56, .52, .47 ), vec3( .47, .48, .49 ), fract( hs.mul( 13. ) ) ).mul( .8 ).mul( mix( .55, 1., step( .035, hp.y.div( dim.y ) ) ) ) );

    	} );

    	const ld = length( hp.sub( vec3( dim.x.mul( .5 ), dim.y.mul( .92 ), dim.z.mul( .45 ) ) ) ).toVar();
    	c.mulAssign( lc.mul( add( .45, div( 1.3, add( 1., ld.mul( ld ).mul( .5 ) ) ) ) ) );

    	return c.mul( mix( 1., .55, hp.z.div( dim.z ) ) );

    }, { o: 'vec3', vd: 'vec3', dim: 'vec3', hs: 'float', lc: 'vec3', kind: 'float', return: 'vec3' } );

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

    	If( abs( n.y ).lessThan( .5 ), () => {

    		const by = vW.y.toVar();
    		base.rgb.mulAssign( mix( add( .68, mul( .12, n2( vW.xz.mul( 1.3 ).add( vW.y.mul( 2.5 ) ) ) ) ), 1., smoothstep( 0., 1.2, by ) ).mul( sub( 1., mul( .2, uWet ).mul( mix( .55, 1., sub( 1., smoothstep( 0., 3., by ) ) ) ) ) ) );

    	} );

    	const wet = uWet.mul( smoothstep( .55, .95, n.y ) ).toVar();
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( 1.1 );
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

    	} );

    	const tg = normalize( vec3( n.z.negate(), 0., n.x ).add( vec3( 1e-4, 0., 0. ) ) ).toVar();
    	const u = dot( vW, tg ).toVar(), wu = dFdx( u ).toVar(), wv = dFdy( u ).toVar(), yu = dFdx( vW.y ).toVar(), yv = dFdy( vW.y ).toVar(), det = wu.mul( yv ).sub( wv.mul( yu ) ).toVar();
    	const upUv = dFdy( vUv ).mul( wu ).sub( dFdx( vUv ).mul( wv ) ).div( select( abs( det ).greaterThan( 1e-9 ), det, 1e9 ) ).toVar();

    	If( uWinMap.sample( vUv ).level( 0. ).r.greaterThan( .5 ), () => {

    		const cell = vec2( floor( uWinMap.sample( vUv ).level( 0. ).g.mul( 255. ).add( .5 ) ), dot( mod( floor( vUv ), 256. ), vec2( 1., 257. ) ) ).add( vWin.mul( 997. ) ).toVar();
    		const hs = hw( cell ).toVar(), hs2 = hw( cell.add( 71.3 ) ).toVar();
    		const vd = vec3( dot( v.negate(), tg ), v.y.negate(), max( dot( v, n ), .05 ) ).toVar(), dim = vec3( 4.2, 3.3, 5. ).toVar();
    		const rs = hw( floor( vec2( u.div( dim.x ), vW.y.div( dim.y ) ) ).add( vWin.mul( 37. ) ) ).toVar();
    		const tall = add( 1., step( .5, uWinMap.sample( vUv.add( upUv.mul( .8 ) ) ).level( 0. ).r ) ).add( step( .5, uWinMap.sample( vUv.sub( upUv.mul( .8 ) ) ).level( 0. ).r ) ).add( step( .5, uWinMap.sample( vUv.add( upUv.mul( 1.6 ) ) ).level( 0. ).r ) ).add( step( .5, uWinMap.sample( vUv.sub( upUv.mul( 1.6 ) ) ).level( 0. ).r ) ).toVar();
    		const office = step( 3.5, tall ).toVar();
    		const lc = select( office.greaterThan( .5 ), mix( vec3( 1., .86, .64 ), vec3( 1., .95, .84 ), hs2 ), mix( vec3( 1., .76, .48 ), vec3( 1., .93, .8 ), hs2 ) ).toVar();
    		const lit = hs.lessThan( uLit.mul( 1.1 ).mul( select( office.greaterThan( .5 ), step( .55, hw( vec2( vWin.mul( 13.1 ), 4.7 ) ) ).mul( .9 ).add( .25 ), 1. ) ) ).toVar();

    		If( vW.y.lessThan( 4.2 ), () => {

    			const sb = hw( vec2( floor( u.div( 6. ) ), vWin.mul( 3.7 ) ) ).toVar();
    			lit.assign( sb.lessThan( .75 ) );
    			lc.assign( mix( vec3( 1., .88, .66 ), vec3( 1., .95, .86 ), step( .5, fract( sb.mul( 7. ) ) ) ) );

    		} );

    		const rl = select( lit, lc.mul( select( office.greaterThan( .5 ), .75, 1.1 ) ), mix( lc.mul( .025 ), vec3( .15, .15, .16 ).mul( add( .6, mul( .8, hs2 ) ) ), uDay ) ).toVar();
    		const inside = room( vec3( mod( u, dim.x ), mod( vW.y, dim.y ), 0. ), vd, dim, rs, rl, office ).toVar();

    		If( lit.and( fract( hs.mul( 41. ) ).lessThan( .3 ) ), () => {

    			inside.assign( mix( inside, rl.mul( .5 ).mul( add( .5, mul( .5, step( .35, fract( vW.y.mul( 4.3 ) ) ) ) ) ), .8 ) );

    		} );

    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const gw = inside.mul( sub( 1., F ) ).add( envMap( reflect( v.negate(), n ) ).mul( F ).mul( .6 ) ).add( c.mul( .25 ) ).toVar();
    		c.assign( mix( gw, c.add( inside.mul( select( lit, .3, 0. ) ) ), uDay ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), clamp( base.a.add( sub( 1., max( dot( n, v ), 0. ) ).mul( .25 ) ), 0., 1. ) ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"BLEND\":\"\",\"DOUBLE\":\"\"}": {
  h: "s5356kgso", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, vec2, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( vec2( 0 ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( 1.1 );
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), clamp( base.a.add( sub( 1., max( dot( n, v ), 0. ) ).mul( .25 ) ), 0., 1. ) ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"BLEND\":\"\"}": {
  h: "10vcw8pgsc", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, vec2, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( vec2( 0 ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	const n = normalize( vN ).toVar();
    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( 1.1 );
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), clamp( base.a.add( sub( 1., max( dot( n, v ), 0. ) ).mul( .25 ) ), 0., 1. ) ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"DOUBLE\":\"\",\"USE_WINMAP\":\"\"}": {
  h: "rdwmvvgst", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { abs, vec3, max, div, select, min, property, float, fract, mix, mul, add, step, sub, If, floor, vec2, length, Fn, vec4, Discard, dot, clamp, smoothstep, normalize, pow, reflect, dFdx, dFdy, mod } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




    const room =  Fn( ( [ o, vd, dim, hs, lc, kind ] ) => {

    	const inv = div( 1., max( abs( vd ), vec3( 1e-4 ) ) ).toVar();
    	const tx = select( vd.x.greaterThan( 0. ), dim.x.sub( o.x ), o.x ).mul( inv.x ).toVar();
    	const ty = select( vd.y.greaterThan( 0. ), dim.y.sub( o.y ), o.y ).mul( inv.y ).toVar();
    	const tz = dim.z.sub( o.z ).mul( inv.z ).toVar();
    	const t = min( tx, min( ty, tz ) ).toVar();
    	const hp = o.add( vd.mul( t ) ).toVar();
    	const c = property( 'vec3' );
    	const lit = float( 1. ).toVar();

    	If( t.equal( tz ), () => {

    		const bw = hp.xy.div( dim.xy ).toVar();
    		c.assign( mix( vec3( .56, .52, .47 ), vec3( .47, .48, .49 ), fract( hs.mul( 13. ) ) ).mul( add( .92, mul( .08, n2( hp.xy.mul( 2. ) ) ) ) ) );
    		c.mulAssign( mix( .55, 1., step( .035, bw.y ) ) );

    		If( kind.lessThan( .5 ), () => {

    			const pic = step( .18, bw.x ).mul( step( bw.x, .5 ) ).mul( step( .45, bw.y ) ).mul( step( bw.y, .72 ) ).mul( step( .45, fract( hs.mul( 7. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .16, .1, .06 ), pic ) );
    			const shelf = step( .62, bw.x ).mul( step( bw.x, .92 ) ).mul( step( bw.y, .75 ) ).mul( step( .6, fract( hs.mul( 3. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .2, .13, .08 ).mul( add( .6, mul( .4, step( .5, fract( bw.y.mul( 6. ) ) ) ) ) ), shelf ) );
    			const px = fract( hs.mul( 29. ) ).mul( .6 ).add( .2 ).toVar();
    			const person = step( abs( bw.x.sub( px ) ), sub( .07, mul( .03, step( .55, bw.y ) ) ) ).mul( step( bw.y, add( .62, mul( .08, step( abs( bw.x.sub( px ) ), .035 ) ) ) ) ).mul( step( .72, fract( hs.mul( 17. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .04 ), person ) );

    		} ).ElseIf( kind.lessThan( 1.5 ), () => {

    			c.assign( vec3( .5, .52, .55 ) );
    			const desk = step( bw.y, .32 ).mul( step( .2, bw.y ) ).toVar();
    			c.assign( mix( c, vec3( .18, .2, .22 ), desk ) );
    			const scr = step( .32, bw.y ).mul( step( bw.y, .42 ) ).mul( step( .5, fract( bw.x.mul( 5. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .3, .6, 1. ).mul( 2. ), scr.mul( step( .4, fract( hs.mul( 5. ) ) ) ) ) );

    		} );

    	} ).ElseIf( t.equal( ty ), () => {

    		If( vd.y.greaterThan( 0. ), () => {

    			c.assign( vec3( .75, .72, .66 ) );

    			If( kind.greaterThan( .5 ).and( kind.lessThan( 1.5 ) ), () => {

    				c.addAssign( step( .85, fract( hp.z.mul( .8 ) ) ).mul( 3. ) );

    			} );

    		} ).Else( () => {

    			c.assign( select( kind.greaterThan( .5 ), vec3( .3, .3, .31 ).mul( add( .9, mul( .1, step( .5, fract( hp.x.mul( 1.7 ) ) ) ) ) ), vec3( .33, .25, .18 ).mul( add( .82, mul( .18, h21( vec2( floor( hp.x.div( .16 ) ), hs ) ) ) ) ) ) );

    		} );

    	} ).Else( () => {

    		c.assign( mix( vec3( .56, .52, .47 ), vec3( .47, .48, .49 ), fract( hs.mul( 13. ) ) ).mul( .8 ).mul( mix( .55, 1., step( .035, hp.y.div( dim.y ) ) ) ) );

    	} );

    	const ld = length( hp.sub( vec3( dim.x.mul( .5 ), dim.y.mul( .92 ), dim.z.mul( .45 ) ) ) ).toVar();
    	c.mulAssign( lc.mul( add( .45, div( 1.3, add( 1., ld.mul( ld ).mul( .5 ) ) ) ) ) );

    	return c.mul( mix( 1., .55, hp.z.div( dim.z ) ) );

    }, { o: 'vec3', vd: 'vec3', dim: 'vec3', hs: 'float', lc: 'vec3', kind: 'float', return: 'vec3' } );

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

    	If( abs( n.y ).lessThan( .5 ), () => {

    		const by = vW.y.toVar();
    		base.rgb.mulAssign( mix( add( .68, mul( .12, n2( vW.xz.mul( 1.3 ).add( vW.y.mul( 2.5 ) ) ) ) ), 1., smoothstep( 0., 1.2, by ) ).mul( sub( 1., mul( .2, uWet ).mul( mix( .55, 1., sub( 1., smoothstep( 0., 3., by ) ) ) ) ) ) );

    	} );

    	const wet = uWet.mul( smoothstep( .55, .95, n.y ) ).toVar();
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

    	} );

    	const tg = normalize( vec3( n.z.negate(), 0., n.x ).add( vec3( 1e-4, 0., 0. ) ) ).toVar();
    	const u = dot( vW, tg ).toVar(), wu = dFdx( u ).toVar(), wv = dFdy( u ).toVar(), yu = dFdx( vW.y ).toVar(), yv = dFdy( vW.y ).toVar(), det = wu.mul( yv ).sub( wv.mul( yu ) ).toVar();
    	const upUv = dFdy( vUv ).mul( wu ).sub( dFdx( vUv ).mul( wv ) ).div( select( abs( det ).greaterThan( 1e-9 ), det, 1e9 ) ).toVar();

    	If( uWinMap.sample( vUv ).level( 0. ).r.greaterThan( .5 ), () => {

    		const cell = vec2( floor( uWinMap.sample( vUv ).level( 0. ).g.mul( 255. ).add( .5 ) ), dot( mod( floor( vUv ), 256. ), vec2( 1., 257. ) ) ).add( vWin.mul( 997. ) ).toVar();
    		const hs = hw( cell ).toVar(), hs2 = hw( cell.add( 71.3 ) ).toVar();
    		const vd = vec3( dot( v.negate(), tg ), v.y.negate(), max( dot( v, n ), .05 ) ).toVar(), dim = vec3( 4.2, 3.3, 5. ).toVar();
    		const rs = hw( floor( vec2( u.div( dim.x ), vW.y.div( dim.y ) ) ).add( vWin.mul( 37. ) ) ).toVar();
    		const tall = add( 1., step( .5, uWinMap.sample( vUv.add( upUv.mul( .8 ) ) ).level( 0. ).r ) ).add( step( .5, uWinMap.sample( vUv.sub( upUv.mul( .8 ) ) ).level( 0. ).r ) ).add( step( .5, uWinMap.sample( vUv.add( upUv.mul( 1.6 ) ) ).level( 0. ).r ) ).add( step( .5, uWinMap.sample( vUv.sub( upUv.mul( 1.6 ) ) ).level( 0. ).r ) ).toVar();
    		const office = step( 3.5, tall ).toVar();
    		const lc = select( office.greaterThan( .5 ), mix( vec3( 1., .86, .64 ), vec3( 1., .95, .84 ), hs2 ), mix( vec3( 1., .76, .48 ), vec3( 1., .93, .8 ), hs2 ) ).toVar();
    		const lit = hs.lessThan( uLit.mul( 1.1 ).mul( select( office.greaterThan( .5 ), step( .55, hw( vec2( vWin.mul( 13.1 ), 4.7 ) ) ).mul( .9 ).add( .25 ), 1. ) ) ).toVar();

    		If( vW.y.lessThan( 4.2 ), () => {

    			const sb = hw( vec2( floor( u.div( 6. ) ), vWin.mul( 3.7 ) ) ).toVar();
    			lit.assign( sb.lessThan( .75 ) );
    			lc.assign( mix( vec3( 1., .88, .66 ), vec3( 1., .95, .86 ), step( .5, fract( sb.mul( 7. ) ) ) ) );

    		} );

    		const rl = select( lit, lc.mul( select( office.greaterThan( .5 ), .75, 1.1 ) ), mix( lc.mul( .025 ), vec3( .15, .15, .16 ).mul( add( .6, mul( .8, hs2 ) ) ), uDay ) ).toVar();
    		const inside = room( vec3( mod( u, dim.x ), mod( vW.y, dim.y ), 0. ), vd, dim, rs, rl, office ).toVar();

    		If( lit.and( fract( hs.mul( 41. ) ).lessThan( .3 ) ), () => {

    			inside.assign( mix( inside, rl.mul( .5 ).mul( add( .5, mul( .5, step( .35, fract( vW.y.mul( 4.3 ) ) ) ) ) ), .8 ) );

    		} );

    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const gw = inside.mul( sub( 1., F ) ).add( envMap( reflect( v.negate(), n ) ).mul( F ).mul( .6 ) ).add( c.mul( .25 ) ).toVar();
    		c.assign( mix( gw, c.add( inside.mul( select( lit, .3, 0. ) ) ), uDay ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"DOUBLE\":\"\"}": {
  h: "14txlmtgsd", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, vec2, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( vec2( 0 ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"FAR\":\"*\",\"BLEND\":\"\",\"DOUBLE\":\"\"}": {
  h: "4jyk67gsy", fog: true, lib: "[[\"FAR\",\"*\"]]NL_T,NOCC_T,SH_N_T,VOL_N_T,FAR", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, vec2, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( vec2( 0 ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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
    	envK.assign( 1.1 );
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), clamp( base.a.add( sub( 1., max( dot( n, v ), 0. ) ).mul( .25 ) ), 0., 1. ) ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"FAR\":\"*\",\"DOUBLE\":\"\"}": {
  h: "1pgzi4wgsn", fog: true, lib: "[[\"FAR\",\"*\"]]NL_T,NOCC_T,SH_N_T,VOL_N_T,FAR", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, vec2, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( vec2( 0 ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
"{\"FAR\":\"*\",\"USE_EMIMAP\":\"\",\"DOUBLE\":\"\"}": {
  h: "1i52l2pgt3", fog: true, lib: "[[\"FAR\",\"*\"]]NL_T,NOCC_T,SH_N_T,VOL_N_T,FAR", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

    	} );

    	const emi = vEmi.rgb.div( max( 1., max( vEmi.r, max( vEmi.g, vEmi.b ) ) ) ).toVar();
    	const k = vEmi.a.toVar();

    	If( abs( fract( k ).sub( .25 ) ).lessThan( .05 ), () => {

    		k.assign( floor( k ) );
    		const mx = max( base.g, base.b ).toVar();
    		emi.mulAssign( select( k.greaterThan( 1.5 ), smoothstep( 1.6, 3.2, base.r.div( max( mx, .015 ) ) ).mul( smoothstep( .015, .08, base.r ) ), max( smoothstep( .1, .45, dot( base.rgb, vec3( .2126, .7152, .0722 ) ) ), sub( 1., base.a ).mul( 1.2 ) ) ) );

    	} ).ElseIf( abs( fract( k ).sub( .5 ) ).lessThan( .05 ), () => {

    		k.assign( floor( k ) );

    	} ).Else( () => {

    		emi.mulAssign( uEmiMap.sample( vUv ).rgb );

    	} );

    	c.addAssign( emi.mul( 1.6 ).mul( select( k.greaterThan( 1.5 ), add( .5, uM.y.mul( 2.4 ) ), select( k.greaterThan( .5 ), add( .35, uM.x.mul( 1.4 ) ), uM.z ) ) ).mul( sub( 1., uM.w ) ) );
    	fragOut_.assign( vec4( applyFog( c, uCam.add( vW.sub( uCam ).mul( farK( FAR ) ) ) ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"FAR\":\"*\",\"USE_MAP\":\"\",\"BLEND\":\"\",\"DOUBLE\":\"\"}": {
  h: "jsvh4fgtb", fog: true, lib: "[[\"FAR\",\"*\"]]NL_T,NOCC_T,SH_N_T,VOL_N_T,FAR", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );
    	const n = normalize( vN ).toVar();

    	If( frontFacing_.not(), () => {

    		n.assign( n.negate() );

    	} );

    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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
    	envK.assign( 1.1 );
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), clamp( base.a.add( sub( 1., max( dot( n, v ), 0. ) ).mul( .25 ) ), 0., 1. ) ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"FAR\":\"*\",\"USE_MAP\":\"\",\"DOUBLE\":\"\",\"USE_WINMAP\":\"\"}": {
  h: "dhcza6gtg", fog: true, lib: "[[\"FAR\",\"*\"]]NL_T,NOCC_T,SH_N_T,VOL_N_T,FAR", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { abs, vec3, max, div, select, min, property, float, fract, mix, mul, add, step, sub, If, floor, vec2, length, Fn, vec4, Discard, dot, clamp, smoothstep, normalize, pow, reflect, dFdx, dFdy, mod } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




    const room =  Fn( ( [ o, vd, dim, hs, lc, kind ] ) => {

    	const inv = div( 1., max( abs( vd ), vec3( 1e-4 ) ) ).toVar();
    	const tx = select( vd.x.greaterThan( 0. ), dim.x.sub( o.x ), o.x ).mul( inv.x ).toVar();
    	const ty = select( vd.y.greaterThan( 0. ), dim.y.sub( o.y ), o.y ).mul( inv.y ).toVar();
    	const tz = dim.z.sub( o.z ).mul( inv.z ).toVar();
    	const t = min( tx, min( ty, tz ) ).toVar();
    	const hp = o.add( vd.mul( t ) ).toVar();
    	const c = property( 'vec3' );
    	const lit = float( 1. ).toVar();

    	If( t.equal( tz ), () => {

    		const bw = hp.xy.div( dim.xy ).toVar();
    		c.assign( mix( vec3( .56, .52, .47 ), vec3( .47, .48, .49 ), fract( hs.mul( 13. ) ) ).mul( add( .92, mul( .08, n2( hp.xy.mul( 2. ) ) ) ) ) );
    		c.mulAssign( mix( .55, 1., step( .035, bw.y ) ) );

    		If( kind.lessThan( .5 ), () => {

    			const pic = step( .18, bw.x ).mul( step( bw.x, .5 ) ).mul( step( .45, bw.y ) ).mul( step( bw.y, .72 ) ).mul( step( .45, fract( hs.mul( 7. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .16, .1, .06 ), pic ) );
    			const shelf = step( .62, bw.x ).mul( step( bw.x, .92 ) ).mul( step( bw.y, .75 ) ).mul( step( .6, fract( hs.mul( 3. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .2, .13, .08 ).mul( add( .6, mul( .4, step( .5, fract( bw.y.mul( 6. ) ) ) ) ) ), shelf ) );
    			const px = fract( hs.mul( 29. ) ).mul( .6 ).add( .2 ).toVar();
    			const person = step( abs( bw.x.sub( px ) ), sub( .07, mul( .03, step( .55, bw.y ) ) ) ).mul( step( bw.y, add( .62, mul( .08, step( abs( bw.x.sub( px ) ), .035 ) ) ) ) ).mul( step( .72, fract( hs.mul( 17. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .04 ), person ) );

    		} ).ElseIf( kind.lessThan( 1.5 ), () => {

    			c.assign( vec3( .5, .52, .55 ) );
    			const desk = step( bw.y, .32 ).mul( step( .2, bw.y ) ).toVar();
    			c.assign( mix( c, vec3( .18, .2, .22 ), desk ) );
    			const scr = step( .32, bw.y ).mul( step( bw.y, .42 ) ).mul( step( .5, fract( bw.x.mul( 5. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .3, .6, 1. ).mul( 2. ), scr.mul( step( .4, fract( hs.mul( 5. ) ) ) ) ) );

    		} );

    	} ).ElseIf( t.equal( ty ), () => {

    		If( vd.y.greaterThan( 0. ), () => {

    			c.assign( vec3( .75, .72, .66 ) );

    			If( kind.greaterThan( .5 ).and( kind.lessThan( 1.5 ) ), () => {

    				c.addAssign( step( .85, fract( hp.z.mul( .8 ) ) ).mul( 3. ) );

    			} );

    		} ).Else( () => {

    			c.assign( select( kind.greaterThan( .5 ), vec3( .3, .3, .31 ).mul( add( .9, mul( .1, step( .5, fract( hp.x.mul( 1.7 ) ) ) ) ) ), vec3( .33, .25, .18 ).mul( add( .82, mul( .18, h21( vec2( floor( hp.x.div( .16 ) ), hs ) ) ) ) ) ) );

    		} );

    	} ).Else( () => {

    		c.assign( mix( vec3( .56, .52, .47 ), vec3( .47, .48, .49 ), fract( hs.mul( 13. ) ) ).mul( .8 ).mul( mix( .55, 1., step( .035, hp.y.div( dim.y ) ) ) ) );

    	} );

    	const ld = length( hp.sub( vec3( dim.x.mul( .5 ), dim.y.mul( .92 ), dim.z.mul( .45 ) ) ) ).toVar();
    	c.mulAssign( lc.mul( add( .45, div( 1.3, add( 1., ld.mul( ld ).mul( .5 ) ) ) ) ) );

    	return c.mul( mix( 1., .55, hp.z.div( dim.z ) ) );

    }, { o: 'vec3', vd: 'vec3', dim: 'vec3', hs: 'float', lc: 'vec3', kind: 'float', return: 'vec3' } );

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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );
    	const n = normalize( vN ).toVar();

    	If( frontFacing_.not(), () => {

    		n.assign( n.negate() );

    	} );

    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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

    	If( abs( n.y ).lessThan( .5 ), () => {

    		const by = vW.y.toVar();
    		base.rgb.mulAssign( mix( add( .68, mul( .12, n2( vW.xz.mul( 1.3 ).add( vW.y.mul( 2.5 ) ) ) ) ), 1., smoothstep( 0., 1.2, by ) ).mul( sub( 1., mul( .2, uWet ).mul( mix( .55, 1., sub( 1., smoothstep( 0., 3., by ) ) ) ) ) ) );

    	} );

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
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

    	} );

    	const tg = normalize( vec3( n.z.negate(), 0., n.x ).add( vec3( 1e-4, 0., 0. ) ) ).toVar();
    	const u = dot( vW, tg ).toVar(), wu = dFdx( u ).toVar(), wv = dFdy( u ).toVar(), yu = dFdx( vW.y ).toVar(), yv = dFdy( vW.y ).toVar(), det = wu.mul( yv ).sub( wv.mul( yu ) ).toVar();
    	const upUv = dFdy( vUv ).mul( wu ).sub( dFdx( vUv ).mul( wv ) ).div( select( abs( det ).greaterThan( 1e-9 ), det, 1e9 ) ).toVar();

    	If( uWinMap.sample( vUv ).level( 0. ).r.greaterThan( .5 ), () => {

    		const cell = vec2( floor( uWinMap.sample( vUv ).level( 0. ).g.mul( 255. ).add( .5 ) ), dot( mod( floor( vUv ), 256. ), vec2( 1., 257. ) ) ).add( vWin.mul( 997. ) ).toVar();
    		const hs = hw( cell ).toVar(), hs2 = hw( cell.add( 71.3 ) ).toVar();
    		const vd = vec3( dot( v.negate(), tg ), v.y.negate(), max( dot( v, n ), .05 ) ).toVar(), dim = vec3( 4.2, 3.3, 5. ).toVar();
    		const rs = hw( floor( vec2( u.div( dim.x ), vW.y.div( dim.y ) ) ).add( vWin.mul( 37. ) ) ).toVar();
    		const tall = add( 1., step( .5, uWinMap.sample( vUv.add( upUv.mul( .8 ) ) ).level( 0. ).r ) ).add( step( .5, uWinMap.sample( vUv.sub( upUv.mul( .8 ) ) ).level( 0. ).r ) ).add( step( .5, uWinMap.sample( vUv.add( upUv.mul( 1.6 ) ) ).level( 0. ).r ) ).add( step( .5, uWinMap.sample( vUv.sub( upUv.mul( 1.6 ) ) ).level( 0. ).r ) ).toVar();
    		const office = step( 3.5, tall ).toVar();
    		const lc = select( office.greaterThan( .5 ), mix( vec3( 1., .86, .64 ), vec3( 1., .95, .84 ), hs2 ), mix( vec3( 1., .76, .48 ), vec3( 1., .93, .8 ), hs2 ) ).toVar();
    		const lit = hs.lessThan( uLit.mul( 1.1 ).mul( select( office.greaterThan( .5 ), step( .55, hw( vec2( vWin.mul( 13.1 ), 4.7 ) ) ).mul( .9 ).add( .25 ), 1. ) ) ).toVar();

    		If( vW.y.lessThan( 4.2 ), () => {

    			const sb = hw( vec2( floor( u.div( 6. ) ), vWin.mul( 3.7 ) ) ).toVar();
    			lit.assign( sb.lessThan( .75 ) );
    			lc.assign( mix( vec3( 1., .88, .66 ), vec3( 1., .95, .86 ), step( .5, fract( sb.mul( 7. ) ) ) ) );

    		} );

    		const rl = select( lit, lc.mul( select( office.greaterThan( .5 ), .75, 1.1 ) ), mix( lc.mul( .025 ), vec3( .15, .15, .16 ).mul( add( .6, mul( .8, hs2 ) ) ), uDay ) ).toVar();
    		const inside = room( vec3( mod( u, dim.x ), mod( vW.y, dim.y ), 0. ), vd, dim, rs, rl, office ).toVar();

    		If( lit.and( fract( hs.mul( 41. ) ).lessThan( .3 ) ), () => {

    			inside.assign( mix( inside, rl.mul( .5 ).mul( add( .5, mul( .5, step( .35, fract( vW.y.mul( 4.3 ) ) ) ) ) ), .8 ) );

    		} );

    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const gw = inside.mul( sub( 1., F ) ).add( envMap( reflect( v.negate(), n ) ).mul( F ).mul( .6 ) ).add( c.mul( .25 ) ).toVar();
    		c.assign( mix( gw, c.add( inside.mul( select( lit, .3, 0. ) ) ), uDay ) );

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
"{\"FAR\":\"*\",\"USE_MAP\":\"\",\"DOUBLE\":\"\"}": {
  h: "hchkdcgt0", fog: true, lib: "[[\"FAR\",\"*\"]]NL_T,NOCC_T,SH_N_T,VOL_N_T,FAR", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );
    	const n = normalize( vN ).toVar();

    	If( frontFacing_.not(), () => {

    		n.assign( n.negate() );

    	} );

    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
"{\"FAR\":\"*\",\"USE_MAP\":\"\",\"USE_EMIMAP\":\"\",\"DOUBLE\":\"\"}": {
  h: "8c9rohgtg", fog: true, lib: "[[\"FAR\",\"*\"]]NL_T,NOCC_T,SH_N_T,VOL_N_T,FAR", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );
    	const n = normalize( vN ).toVar();

    	If( frontFacing_.not(), () => {

    		n.assign( n.negate() );

    	} );

    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

    	} );

    	const emi = vEmi.rgb.div( max( 1., max( vEmi.r, max( vEmi.g, vEmi.b ) ) ) ).toVar();
    	const k = vEmi.a.toVar();

    	If( abs( fract( k ).sub( .25 ) ).lessThan( .05 ), () => {

    		k.assign( floor( k ) );
    		const mx = max( base.g, base.b ).toVar();
    		emi.mulAssign( select( k.greaterThan( 1.5 ), smoothstep( 1.6, 3.2, base.r.div( max( mx, .015 ) ) ).mul( smoothstep( .015, .08, base.r ) ), max( smoothstep( .1, .45, dot( base.rgb, vec3( .2126, .7152, .0722 ) ) ), sub( 1., base.a ).mul( 1.2 ) ) ) );

    	} ).ElseIf( abs( fract( k ).sub( .5 ) ).lessThan( .05 ), () => {

    		k.assign( floor( k ) );

    	} ).Else( () => {

    		emi.mulAssign( uEmiMap.sample( vUv ).rgb );

    	} );

    	c.addAssign( emi.mul( 1.6 ).mul( select( k.greaterThan( 1.5 ), add( .5, uM.y.mul( 2.4 ) ), select( k.greaterThan( .5 ), add( .35, uM.x.mul( 1.4 ) ), uM.z ) ) ).mul( sub( 1., uM.w ) ) );
    	fragOut_.assign( vec4( applyFog( c, uCam.add( vW.sub( uCam ).mul( farK( FAR ) ) ) ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"FAR\":\"*\",\"USE_MAP\":\"\"}": {
  h: "vvljtpgso", fog: true, lib: "[[\"FAR\",\"*\"]]NL_T,NOCC_T,SH_N_T,VOL_N_T,FAR", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );
    	const n = normalize( vN ).toVar();
    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
"{\"MASK\":\"\",\"DOUBLE\":\"\",\"USE_WINMAP\":\"\"}": {
  h: "1n4kddgt3", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { abs, vec3, max, div, select, min, property, float, fract, mix, mul, add, step, sub, If, floor, vec2, length, Fn, vec4, Discard, dot, clamp, smoothstep, normalize, pow, reflect, dFdx, dFdy, mod } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




    const room =  Fn( ( [ o, vd, dim, hs, lc, kind ] ) => {

    	const inv = div( 1., max( abs( vd ), vec3( 1e-4 ) ) ).toVar();
    	const tx = select( vd.x.greaterThan( 0. ), dim.x.sub( o.x ), o.x ).mul( inv.x ).toVar();
    	const ty = select( vd.y.greaterThan( 0. ), dim.y.sub( o.y ), o.y ).mul( inv.y ).toVar();
    	const tz = dim.z.sub( o.z ).mul( inv.z ).toVar();
    	const t = min( tx, min( ty, tz ) ).toVar();
    	const hp = o.add( vd.mul( t ) ).toVar();
    	const c = property( 'vec3' );
    	const lit = float( 1. ).toVar();

    	If( t.equal( tz ), () => {

    		const bw = hp.xy.div( dim.xy ).toVar();
    		c.assign( mix( vec3( .56, .52, .47 ), vec3( .47, .48, .49 ), fract( hs.mul( 13. ) ) ).mul( add( .92, mul( .08, n2( hp.xy.mul( 2. ) ) ) ) ) );
    		c.mulAssign( mix( .55, 1., step( .035, bw.y ) ) );

    		If( kind.lessThan( .5 ), () => {

    			const pic = step( .18, bw.x ).mul( step( bw.x, .5 ) ).mul( step( .45, bw.y ) ).mul( step( bw.y, .72 ) ).mul( step( .45, fract( hs.mul( 7. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .16, .1, .06 ), pic ) );
    			const shelf = step( .62, bw.x ).mul( step( bw.x, .92 ) ).mul( step( bw.y, .75 ) ).mul( step( .6, fract( hs.mul( 3. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .2, .13, .08 ).mul( add( .6, mul( .4, step( .5, fract( bw.y.mul( 6. ) ) ) ) ) ), shelf ) );
    			const px = fract( hs.mul( 29. ) ).mul( .6 ).add( .2 ).toVar();
    			const person = step( abs( bw.x.sub( px ) ), sub( .07, mul( .03, step( .55, bw.y ) ) ) ).mul( step( bw.y, add( .62, mul( .08, step( abs( bw.x.sub( px ) ), .035 ) ) ) ) ).mul( step( .72, fract( hs.mul( 17. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .04 ), person ) );

    		} ).ElseIf( kind.lessThan( 1.5 ), () => {

    			c.assign( vec3( .5, .52, .55 ) );
    			const desk = step( bw.y, .32 ).mul( step( .2, bw.y ) ).toVar();
    			c.assign( mix( c, vec3( .18, .2, .22 ), desk ) );
    			const scr = step( .32, bw.y ).mul( step( bw.y, .42 ) ).mul( step( .5, fract( bw.x.mul( 5. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .3, .6, 1. ).mul( 2. ), scr.mul( step( .4, fract( hs.mul( 5. ) ) ) ) ) );

    		} );

    	} ).ElseIf( t.equal( ty ), () => {

    		If( vd.y.greaterThan( 0. ), () => {

    			c.assign( vec3( .75, .72, .66 ) );

    			If( kind.greaterThan( .5 ).and( kind.lessThan( 1.5 ) ), () => {

    				c.addAssign( step( .85, fract( hp.z.mul( .8 ) ) ).mul( 3. ) );

    			} );

    		} ).Else( () => {

    			c.assign( select( kind.greaterThan( .5 ), vec3( .3, .3, .31 ).mul( add( .9, mul( .1, step( .5, fract( hp.x.mul( 1.7 ) ) ) ) ) ), vec3( .33, .25, .18 ).mul( add( .82, mul( .18, h21( vec2( floor( hp.x.div( .16 ) ), hs ) ) ) ) ) ) );

    		} );

    	} ).Else( () => {

    		c.assign( mix( vec3( .56, .52, .47 ), vec3( .47, .48, .49 ), fract( hs.mul( 13. ) ) ).mul( .8 ).mul( mix( .55, 1., step( .035, hp.y.div( dim.y ) ) ) ) );

    	} );

    	const ld = length( hp.sub( vec3( dim.x.mul( .5 ), dim.y.mul( .92 ), dim.z.mul( .45 ) ) ) ).toVar();
    	c.mulAssign( lc.mul( add( .45, div( 1.3, add( 1., ld.mul( ld ).mul( .5 ) ) ) ) ) );

    	return c.mul( mix( 1., .55, hp.z.div( dim.z ) ) );

    }, { o: 'vec3', vd: 'vec3', dim: 'vec3', hs: 'float', lc: 'vec3', kind: 'float', return: 'vec3' } );

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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	If( base.a.lessThan( .5 ), () => {

    		Discard();

    	} );

    	const n = normalize( vN ).toVar();

    	If( frontFacing_.not(), () => {

    		n.assign( n.negate() );

    	} );

    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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

    	If( abs( n.y ).lessThan( .5 ), () => {

    		const by = vW.y.toVar();
    		base.rgb.mulAssign( mix( add( .68, mul( .12, n2( vW.xz.mul( 1.3 ).add( vW.y.mul( 2.5 ) ) ) ) ), 1., smoothstep( 0., 1.2, by ) ).mul( sub( 1., mul( .2, uWet ).mul( mix( .55, 1., sub( 1., smoothstep( 0., 3., by ) ) ) ) ) ) );

    	} );

    	const wet = uWet.mul( smoothstep( .55, .95, n.y ) ).toVar();
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

    	} );

    	const tg = normalize( vec3( n.z.negate(), 0., n.x ).add( vec3( 1e-4, 0., 0. ) ) ).toVar();
    	const u = dot( vW, tg ).toVar(), wu = dFdx( u ).toVar(), wv = dFdy( u ).toVar(), yu = dFdx( vW.y ).toVar(), yv = dFdy( vW.y ).toVar(), det = wu.mul( yv ).sub( wv.mul( yu ) ).toVar();
    	const upUv = dFdy( vUv ).mul( wu ).sub( dFdx( vUv ).mul( wv ) ).div( select( abs( det ).greaterThan( 1e-9 ), det, 1e9 ) ).toVar();

    	If( uWinMap.sample( vUv ).level( 0. ).r.greaterThan( .5 ), () => {

    		const cell = vec2( floor( uWinMap.sample( vUv ).level( 0. ).g.mul( 255. ).add( .5 ) ), dot( mod( floor( vUv ), 256. ), vec2( 1., 257. ) ) ).add( vWin.mul( 997. ) ).toVar();
    		const hs = hw( cell ).toVar(), hs2 = hw( cell.add( 71.3 ) ).toVar();
    		const vd = vec3( dot( v.negate(), tg ), v.y.negate(), max( dot( v, n ), .05 ) ).toVar(), dim = vec3( 4.2, 3.3, 5. ).toVar();
    		const rs = hw( floor( vec2( u.div( dim.x ), vW.y.div( dim.y ) ) ).add( vWin.mul( 37. ) ) ).toVar();
    		const tall = add( 1., step( .5, uWinMap.sample( vUv.add( upUv.mul( .8 ) ) ).level( 0. ).r ) ).add( step( .5, uWinMap.sample( vUv.sub( upUv.mul( .8 ) ) ).level( 0. ).r ) ).add( step( .5, uWinMap.sample( vUv.add( upUv.mul( 1.6 ) ) ).level( 0. ).r ) ).add( step( .5, uWinMap.sample( vUv.sub( upUv.mul( 1.6 ) ) ).level( 0. ).r ) ).toVar();
    		const office = step( 3.5, tall ).toVar();
    		const lc = select( office.greaterThan( .5 ), mix( vec3( 1., .86, .64 ), vec3( 1., .95, .84 ), hs2 ), mix( vec3( 1., .76, .48 ), vec3( 1., .93, .8 ), hs2 ) ).toVar();
    		const lit = hs.lessThan( uLit.mul( 1.1 ).mul( select( office.greaterThan( .5 ), step( .55, hw( vec2( vWin.mul( 13.1 ), 4.7 ) ) ).mul( .9 ).add( .25 ), 1. ) ) ).toVar();

    		If( vW.y.lessThan( 4.2 ), () => {

    			const sb = hw( vec2( floor( u.div( 6. ) ), vWin.mul( 3.7 ) ) ).toVar();
    			lit.assign( sb.lessThan( .75 ) );
    			lc.assign( mix( vec3( 1., .88, .66 ), vec3( 1., .95, .86 ), step( .5, fract( sb.mul( 7. ) ) ) ) );

    		} );

    		const rl = select( lit, lc.mul( select( office.greaterThan( .5 ), .75, 1.1 ) ), mix( lc.mul( .025 ), vec3( .15, .15, .16 ).mul( add( .6, mul( .8, hs2 ) ) ), uDay ) ).toVar();
    		const inside = room( vec3( mod( u, dim.x ), mod( vW.y, dim.y ), 0. ), vd, dim, rs, rl, office ).toVar();

    		If( lit.and( fract( hs.mul( 41. ) ).lessThan( .3 ) ), () => {

    			inside.assign( mix( inside, rl.mul( .5 ).mul( add( .5, mul( .5, step( .35, fract( vW.y.mul( 4.3 ) ) ) ) ) ), .8 ) );

    		} );

    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const gw = inside.mul( sub( 1., F ) ).add( envMap( reflect( v.negate(), n ) ).mul( F ).mul( .6 ) ).add( c.mul( .25 ) ).toVar();
    		c.assign( mix( gw, c.add( inside.mul( select( lit, .3, 0. ) ) ), uDay ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"MASK\":\"\",\"DOUBLE\":\"\"}": {
  h: "n4b8cfgsn", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, vec2, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( vec2( 0 ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	If( base.a.lessThan( .5 ), () => {

    		Discard();

    	} );

    	const n = normalize( vN ).toVar();

    	If( frontFacing_.not(), () => {

    		n.assign( n.negate() );

    	} );

    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"USE_EMIMAP\":\"\",\"BLEND\":\"\",\"DOUBLE\":\"\"}": {
  h: "1jhmdofgt4", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( 1.1 );
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

    	} );

    	const emi = vEmi.rgb.div( max( 1., max( vEmi.r, max( vEmi.g, vEmi.b ) ) ) ).toVar();
    	const k = vEmi.a.toVar();

    	If( abs( fract( k ).sub( .25 ) ).lessThan( .05 ), () => {

    		k.assign( floor( k ) );
    		const mx = max( base.g, base.b ).toVar();
    		emi.mulAssign( select( k.greaterThan( 1.5 ), smoothstep( 1.6, 3.2, base.r.div( max( mx, .015 ) ) ).mul( smoothstep( .015, .08, base.r ) ), max( smoothstep( .1, .45, dot( base.rgb, vec3( .2126, .7152, .0722 ) ) ), sub( 1., base.a ).mul( 1.2 ) ) ) );

    	} ).ElseIf( abs( fract( k ).sub( .5 ) ).lessThan( .05 ), () => {

    		k.assign( floor( k ) );

    	} ).Else( () => {

    		emi.mulAssign( uEmiMap.sample( vUv ).rgb );

    	} );

    	c.addAssign( emi.mul( 1.6 ).mul( select( k.greaterThan( 1.5 ), add( .5, uM.y.mul( 2.4 ) ), select( k.greaterThan( .5 ), add( .35, uM.x.mul( 1.4 ) ), uM.z ) ) ).mul( sub( 1., uM.w ) ) );
    	fragOut_.assign( vec4( applyFog( c, vW ), clamp( base.a.add( sub( 1., max( dot( n, v ), 0. ) ).mul( .25 ) ), 0., 1. ) ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"USE_EMIMAP\":\"\",\"DOUBLE\":\"\"}": {
  h: "1stmdtcgst", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

    	} );

    	const emi = vEmi.rgb.div( max( 1., max( vEmi.r, max( vEmi.g, vEmi.b ) ) ) ).toVar();
    	const k = vEmi.a.toVar();

    	If( abs( fract( k ).sub( .25 ) ).lessThan( .05 ), () => {

    		k.assign( floor( k ) );
    		const mx = max( base.g, base.b ).toVar();
    		emi.mulAssign( select( k.greaterThan( 1.5 ), smoothstep( 1.6, 3.2, base.r.div( max( mx, .015 ) ) ).mul( smoothstep( .015, .08, base.r ) ), max( smoothstep( .1, .45, dot( base.rgb, vec3( .2126, .7152, .0722 ) ) ), sub( 1., base.a ).mul( 1.2 ) ) ) );

    	} ).ElseIf( abs( fract( k ).sub( .5 ) ).lessThan( .05 ), () => {

    		k.assign( floor( k ) );

    	} ).Else( () => {

    		emi.mulAssign( uEmiMap.sample( vUv ).rgb );

    	} );

    	c.addAssign( emi.mul( 1.6 ).mul( select( k.greaterThan( 1.5 ), add( .5, uM.y.mul( 2.4 ) ), select( k.greaterThan( .5 ), add( .35, uM.x.mul( 1.4 ) ), uM.z ) ) ).mul( sub( 1., uM.w ) ) );
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"USE_MAP\":\"\",\"BLEND\":\"\",\"DOUBLE\":\"\"}": {
  h: "1dw924mgt1", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );
    	const n = normalize( vN ).toVar();

    	If( frontFacing_.not(), () => {

    		n.assign( n.negate() );

    	} );

    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( 1.1 );
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), clamp( base.a.add( sub( 1., max( dot( n, v ), 0. ) ).mul( .25 ) ), 0., 1. ) ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"USE_MAP\":\"\",\"BLEND\":\"\"}": {
  h: "7njkm7gsp", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );
    	const n = normalize( vN ).toVar();
    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( 1.1 );
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), clamp( base.a.add( sub( 1., max( dot( n, v ), 0. ) ).mul( .25 ) ), 0., 1. ) ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"USE_MAP\":\"\",\"DOUBLE\":\"\",\"USE_WINMAP\":\"\"}": {
  h: "mpggohgt6", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { abs, vec3, max, div, select, min, property, float, fract, mix, mul, add, step, sub, If, floor, vec2, length, Fn, vec4, Discard, dot, clamp, smoothstep, normalize, pow, reflect, dFdx, dFdy, mod } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




    const room =  Fn( ( [ o, vd, dim, hs, lc, kind ] ) => {

    	const inv = div( 1., max( abs( vd ), vec3( 1e-4 ) ) ).toVar();
    	const tx = select( vd.x.greaterThan( 0. ), dim.x.sub( o.x ), o.x ).mul( inv.x ).toVar();
    	const ty = select( vd.y.greaterThan( 0. ), dim.y.sub( o.y ), o.y ).mul( inv.y ).toVar();
    	const tz = dim.z.sub( o.z ).mul( inv.z ).toVar();
    	const t = min( tx, min( ty, tz ) ).toVar();
    	const hp = o.add( vd.mul( t ) ).toVar();
    	const c = property( 'vec3' );
    	const lit = float( 1. ).toVar();

    	If( t.equal( tz ), () => {

    		const bw = hp.xy.div( dim.xy ).toVar();
    		c.assign( mix( vec3( .56, .52, .47 ), vec3( .47, .48, .49 ), fract( hs.mul( 13. ) ) ).mul( add( .92, mul( .08, n2( hp.xy.mul( 2. ) ) ) ) ) );
    		c.mulAssign( mix( .55, 1., step( .035, bw.y ) ) );

    		If( kind.lessThan( .5 ), () => {

    			const pic = step( .18, bw.x ).mul( step( bw.x, .5 ) ).mul( step( .45, bw.y ) ).mul( step( bw.y, .72 ) ).mul( step( .45, fract( hs.mul( 7. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .16, .1, .06 ), pic ) );
    			const shelf = step( .62, bw.x ).mul( step( bw.x, .92 ) ).mul( step( bw.y, .75 ) ).mul( step( .6, fract( hs.mul( 3. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .2, .13, .08 ).mul( add( .6, mul( .4, step( .5, fract( bw.y.mul( 6. ) ) ) ) ) ), shelf ) );
    			const px = fract( hs.mul( 29. ) ).mul( .6 ).add( .2 ).toVar();
    			const person = step( abs( bw.x.sub( px ) ), sub( .07, mul( .03, step( .55, bw.y ) ) ) ).mul( step( bw.y, add( .62, mul( .08, step( abs( bw.x.sub( px ) ), .035 ) ) ) ) ).mul( step( .72, fract( hs.mul( 17. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .04 ), person ) );

    		} ).ElseIf( kind.lessThan( 1.5 ), () => {

    			c.assign( vec3( .5, .52, .55 ) );
    			const desk = step( bw.y, .32 ).mul( step( .2, bw.y ) ).toVar();
    			c.assign( mix( c, vec3( .18, .2, .22 ), desk ) );
    			const scr = step( .32, bw.y ).mul( step( bw.y, .42 ) ).mul( step( .5, fract( bw.x.mul( 5. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .3, .6, 1. ).mul( 2. ), scr.mul( step( .4, fract( hs.mul( 5. ) ) ) ) ) );

    		} );

    	} ).ElseIf( t.equal( ty ), () => {

    		If( vd.y.greaterThan( 0. ), () => {

    			c.assign( vec3( .75, .72, .66 ) );

    			If( kind.greaterThan( .5 ).and( kind.lessThan( 1.5 ) ), () => {

    				c.addAssign( step( .85, fract( hp.z.mul( .8 ) ) ).mul( 3. ) );

    			} );

    		} ).Else( () => {

    			c.assign( select( kind.greaterThan( .5 ), vec3( .3, .3, .31 ).mul( add( .9, mul( .1, step( .5, fract( hp.x.mul( 1.7 ) ) ) ) ) ), vec3( .33, .25, .18 ).mul( add( .82, mul( .18, h21( vec2( floor( hp.x.div( .16 ) ), hs ) ) ) ) ) ) );

    		} );

    	} ).Else( () => {

    		c.assign( mix( vec3( .56, .52, .47 ), vec3( .47, .48, .49 ), fract( hs.mul( 13. ) ) ).mul( .8 ).mul( mix( .55, 1., step( .035, hp.y.div( dim.y ) ) ) ) );

    	} );

    	const ld = length( hp.sub( vec3( dim.x.mul( .5 ), dim.y.mul( .92 ), dim.z.mul( .45 ) ) ) ).toVar();
    	c.mulAssign( lc.mul( add( .45, div( 1.3, add( 1., ld.mul( ld ).mul( .5 ) ) ) ) ) );

    	return c.mul( mix( 1., .55, hp.z.div( dim.z ) ) );

    }, { o: 'vec3', vd: 'vec3', dim: 'vec3', hs: 'float', lc: 'vec3', kind: 'float', return: 'vec3' } );

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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );
    	const n = normalize( vN ).toVar();

    	If( frontFacing_.not(), () => {

    		n.assign( n.negate() );

    	} );

    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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

    	If( abs( n.y ).lessThan( .5 ), () => {

    		const by = vW.y.toVar();
    		base.rgb.mulAssign( mix( add( .68, mul( .12, n2( vW.xz.mul( 1.3 ).add( vW.y.mul( 2.5 ) ) ) ) ), 1., smoothstep( 0., 1.2, by ) ).mul( sub( 1., mul( .2, uWet ).mul( mix( .55, 1., sub( 1., smoothstep( 0., 3., by ) ) ) ) ) ) );

    	} );

    	const wet = uWet.mul( smoothstep( .55, .95, n.y ) ).toVar();
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

    	} );

    	const tg = normalize( vec3( n.z.negate(), 0., n.x ).add( vec3( 1e-4, 0., 0. ) ) ).toVar();
    	const u = dot( vW, tg ).toVar(), wu = dFdx( u ).toVar(), wv = dFdy( u ).toVar(), yu = dFdx( vW.y ).toVar(), yv = dFdy( vW.y ).toVar(), det = wu.mul( yv ).sub( wv.mul( yu ) ).toVar();
    	const upUv = dFdy( vUv ).mul( wu ).sub( dFdx( vUv ).mul( wv ) ).div( select( abs( det ).greaterThan( 1e-9 ), det, 1e9 ) ).toVar();

    	If( uWinMap.sample( vUv ).level( 0. ).r.greaterThan( .5 ), () => {

    		const cell = vec2( floor( uWinMap.sample( vUv ).level( 0. ).g.mul( 255. ).add( .5 ) ), dot( mod( floor( vUv ), 256. ), vec2( 1., 257. ) ) ).add( vWin.mul( 997. ) ).toVar();
    		const hs = hw( cell ).toVar(), hs2 = hw( cell.add( 71.3 ) ).toVar();
    		const vd = vec3( dot( v.negate(), tg ), v.y.negate(), max( dot( v, n ), .05 ) ).toVar(), dim = vec3( 4.2, 3.3, 5. ).toVar();
    		const rs = hw( floor( vec2( u.div( dim.x ), vW.y.div( dim.y ) ) ).add( vWin.mul( 37. ) ) ).toVar();
    		const tall = add( 1., step( .5, uWinMap.sample( vUv.add( upUv.mul( .8 ) ) ).level( 0. ).r ) ).add( step( .5, uWinMap.sample( vUv.sub( upUv.mul( .8 ) ) ).level( 0. ).r ) ).add( step( .5, uWinMap.sample( vUv.add( upUv.mul( 1.6 ) ) ).level( 0. ).r ) ).add( step( .5, uWinMap.sample( vUv.sub( upUv.mul( 1.6 ) ) ).level( 0. ).r ) ).toVar();
    		const office = step( 3.5, tall ).toVar();
    		const lc = select( office.greaterThan( .5 ), mix( vec3( 1., .86, .64 ), vec3( 1., .95, .84 ), hs2 ), mix( vec3( 1., .76, .48 ), vec3( 1., .93, .8 ), hs2 ) ).toVar();
    		const lit = hs.lessThan( uLit.mul( 1.1 ).mul( select( office.greaterThan( .5 ), step( .55, hw( vec2( vWin.mul( 13.1 ), 4.7 ) ) ).mul( .9 ).add( .25 ), 1. ) ) ).toVar();

    		If( vW.y.lessThan( 4.2 ), () => {

    			const sb = hw( vec2( floor( u.div( 6. ) ), vWin.mul( 3.7 ) ) ).toVar();
    			lit.assign( sb.lessThan( .75 ) );
    			lc.assign( mix( vec3( 1., .88, .66 ), vec3( 1., .95, .86 ), step( .5, fract( sb.mul( 7. ) ) ) ) );

    		} );

    		const rl = select( lit, lc.mul( select( office.greaterThan( .5 ), .75, 1.1 ) ), mix( lc.mul( .025 ), vec3( .15, .15, .16 ).mul( add( .6, mul( .8, hs2 ) ) ), uDay ) ).toVar();
    		const inside = room( vec3( mod( u, dim.x ), mod( vW.y, dim.y ), 0. ), vd, dim, rs, rl, office ).toVar();

    		If( lit.and( fract( hs.mul( 41. ) ).lessThan( .3 ) ), () => {

    			inside.assign( mix( inside, rl.mul( .5 ).mul( add( .5, mul( .5, step( .35, fract( vW.y.mul( 4.3 ) ) ) ) ) ), .8 ) );

    		} );

    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const gw = inside.mul( sub( 1., F ) ).add( envMap( reflect( v.negate(), n ) ).mul( F ).mul( .6 ) ).add( c.mul( .25 ) ).toVar();
    		c.assign( mix( gw, c.add( inside.mul( select( lit, .3, 0. ) ) ), uDay ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"USE_MAP\":\"\",\"DOUBLE\":\"\"}": {
  h: "1iogj7zgsq", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );
    	const n = normalize( vN ).toVar();

    	If( frontFacing_.not(), () => {

    		n.assign( n.negate() );

    	} );

    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"USE_MAP\":\"\",\"MASK\":\"\",\"DOUBLE\":\"\"}": {
  h: "ynxji5gt0", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );

    	If( base.a.lessThan( .5 ), () => {

    		Discard();

    	} );

    	const n = normalize( vN ).toVar();

    	If( frontFacing_.not(), () => {

    		n.assign( n.negate() );

    	} );

    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"USE_MAP\":\"\",\"MASK\":\"\"}": {
  h: "19vuhkkgso", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );

    	If( base.a.lessThan( .5 ), () => {

    		Discard();

    	} );

    	const n = normalize( vN ).toVar();
    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"USE_MAP\":\"\",\"USE_EMIMAP\":\"\",\"BLEND\":\"\",\"DOUBLE\":\"\"}": {
  h: "e4bpv9gth", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );
    	const n = normalize( vN ).toVar();

    	If( frontFacing_.not(), () => {

    		n.assign( n.negate() );

    	} );

    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( 1.1 );
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

    	} );

    	const emi = vEmi.rgb.div( max( 1., max( vEmi.r, max( vEmi.g, vEmi.b ) ) ) ).toVar();
    	const k = vEmi.a.toVar();

    	If( abs( fract( k ).sub( .25 ) ).lessThan( .05 ), () => {

    		k.assign( floor( k ) );
    		const mx = max( base.g, base.b ).toVar();
    		emi.mulAssign( select( k.greaterThan( 1.5 ), smoothstep( 1.6, 3.2, base.r.div( max( mx, .015 ) ) ).mul( smoothstep( .015, .08, base.r ) ), max( smoothstep( .1, .45, dot( base.rgb, vec3( .2126, .7152, .0722 ) ) ), sub( 1., base.a ).mul( 1.2 ) ) ) );

    	} ).ElseIf( abs( fract( k ).sub( .5 ) ).lessThan( .05 ), () => {

    		k.assign( floor( k ) );

    	} ).Else( () => {

    		emi.mulAssign( uEmiMap.sample( vUv ).rgb );

    	} );

    	c.addAssign( emi.mul( 1.6 ).mul( select( k.greaterThan( 1.5 ), add( .5, uM.y.mul( 2.4 ) ), select( k.greaterThan( .5 ), add( .35, uM.x.mul( 1.4 ) ), uM.z ) ) ).mul( sub( 1., uM.w ) ) );
    	fragOut_.assign( vec4( applyFog( c, vW ), clamp( base.a.add( sub( 1., max( dot( n, v ), 0. ) ).mul( .25 ) ), 0., 1. ) ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"USE_MAP\":\"\",\"USE_EMIMAP\":\"\",\"BLEND\":\"\"}": {
  h: "y4wxd8gt5", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );
    	const n = normalize( vN ).toVar();
    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( 1.1 );
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

    	} );

    	const emi = vEmi.rgb.div( max( 1., max( vEmi.r, max( vEmi.g, vEmi.b ) ) ) ).toVar();
    	const k = vEmi.a.toVar();

    	If( abs( fract( k ).sub( .25 ) ).lessThan( .05 ), () => {

    		k.assign( floor( k ) );
    		const mx = max( base.g, base.b ).toVar();
    		emi.mulAssign( select( k.greaterThan( 1.5 ), smoothstep( 1.6, 3.2, base.r.div( max( mx, .015 ) ) ).mul( smoothstep( .015, .08, base.r ) ), max( smoothstep( .1, .45, dot( base.rgb, vec3( .2126, .7152, .0722 ) ) ), sub( 1., base.a ).mul( 1.2 ) ) ) );

    	} ).ElseIf( abs( fract( k ).sub( .5 ) ).lessThan( .05 ), () => {

    		k.assign( floor( k ) );

    	} ).Else( () => {

    		emi.mulAssign( uEmiMap.sample( vUv ).rgb );

    	} );

    	c.addAssign( emi.mul( 1.6 ).mul( select( k.greaterThan( 1.5 ), add( .5, uM.y.mul( 2.4 ) ), select( k.greaterThan( .5 ), add( .35, uM.x.mul( 1.4 ) ), uM.z ) ) ).mul( sub( 1., uM.w ) ) );
    	fragOut_.assign( vec4( applyFog( c, vW ), clamp( base.a.add( sub( 1., max( dot( n, v ), 0. ) ).mul( .25 ) ), 0., 1. ) ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"USE_MAP\":\"\",\"USE_EMIMAP\":\"\",\"DOUBLE\":\"\"}": {
  h: "ckilk6gt6", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );
    	const n = normalize( vN ).toVar();

    	If( frontFacing_.not(), () => {

    		n.assign( n.negate() );

    	} );

    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

    	} );

    	const emi = vEmi.rgb.div( max( 1., max( vEmi.r, max( vEmi.g, vEmi.b ) ) ) ).toVar();
    	const k = vEmi.a.toVar();

    	If( abs( fract( k ).sub( .25 ) ).lessThan( .05 ), () => {

    		k.assign( floor( k ) );
    		const mx = max( base.g, base.b ).toVar();
    		emi.mulAssign( select( k.greaterThan( 1.5 ), smoothstep( 1.6, 3.2, base.r.div( max( mx, .015 ) ) ).mul( smoothstep( .015, .08, base.r ) ), max( smoothstep( .1, .45, dot( base.rgb, vec3( .2126, .7152, .0722 ) ) ), sub( 1., base.a ).mul( 1.2 ) ) ) );

    	} ).ElseIf( abs( fract( k ).sub( .5 ) ).lessThan( .05 ), () => {

    		k.assign( floor( k ) );

    	} ).Else( () => {

    		emi.mulAssign( uEmiMap.sample( vUv ).rgb );

    	} );

    	c.addAssign( emi.mul( 1.6 ).mul( select( k.greaterThan( 1.5 ), add( .5, uM.y.mul( 2.4 ) ), select( k.greaterThan( .5 ), add( .35, uM.x.mul( 1.4 ) ), uM.z ) ) ).mul( sub( 1., uM.w ) ) );
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"USE_MAP\":\"\",\"USE_EMIMAP\":\"\",\"MASK\":\"\",\"DOUBLE\":\"\"}": {
  h: "fauxdsgtg", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );

    	If( base.a.lessThan( .5 ), () => {

    		Discard();

    	} );

    	const n = normalize( vN ).toVar();

    	If( frontFacing_.not(), () => {

    		n.assign( n.negate() );

    	} );

    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

    	} );

    	const emi = vEmi.rgb.div( max( 1., max( vEmi.r, max( vEmi.g, vEmi.b ) ) ) ).toVar();
    	const k = vEmi.a.toVar();

    	If( abs( fract( k ).sub( .25 ) ).lessThan( .05 ), () => {

    		k.assign( floor( k ) );
    		const mx = max( base.g, base.b ).toVar();
    		emi.mulAssign( select( k.greaterThan( 1.5 ), smoothstep( 1.6, 3.2, base.r.div( max( mx, .015 ) ) ).mul( smoothstep( .015, .08, base.r ) ), max( smoothstep( .1, .45, dot( base.rgb, vec3( .2126, .7152, .0722 ) ) ), sub( 1., base.a ).mul( 1.2 ) ) ) );

    	} ).ElseIf( abs( fract( k ).sub( .5 ) ).lessThan( .05 ), () => {

    		k.assign( floor( k ) );

    	} ).Else( () => {

    		emi.mulAssign( uEmiMap.sample( vUv ).rgb );

    	} );

    	c.addAssign( emi.mul( 1.6 ).mul( select( k.greaterThan( 1.5 ), add( .5, uM.y.mul( 2.4 ) ), select( k.greaterThan( .5 ), add( .35, uM.x.mul( 1.4 ) ), uM.z ) ) ).mul( sub( 1., uM.w ) ) );
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"USE_MAP\":\"\",\"USE_EMIMAP\":\"\"}": {
  h: "3x37wfgsu", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );
    	const n = normalize( vN ).toVar();
    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

    	} );

    	const emi = vEmi.rgb.div( max( 1., max( vEmi.r, max( vEmi.g, vEmi.b ) ) ) ).toVar();
    	const k = vEmi.a.toVar();

    	If( abs( fract( k ).sub( .25 ) ).lessThan( .05 ), () => {

    		k.assign( floor( k ) );
    		const mx = max( base.g, base.b ).toVar();
    		emi.mulAssign( select( k.greaterThan( 1.5 ), smoothstep( 1.6, 3.2, base.r.div( max( mx, .015 ) ) ).mul( smoothstep( .015, .08, base.r ) ), max( smoothstep( .1, .45, dot( base.rgb, vec3( .2126, .7152, .0722 ) ) ), sub( 1., base.a ).mul( 1.2 ) ) ) );

    	} ).ElseIf( abs( fract( k ).sub( .5 ) ).lessThan( .05 ), () => {

    		k.assign( floor( k ) );

    	} ).Else( () => {

    		emi.mulAssign( uEmiMap.sample( vUv ).rgb );

    	} );

    	c.addAssign( emi.mul( 1.6 ).mul( select( k.greaterThan( 1.5 ), add( .5, uM.y.mul( 2.4 ) ), select( k.greaterThan( .5 ), add( .35, uM.x.mul( 1.4 ) ), uM.z ) ) ).mul( sub( 1., uM.w ) ) );
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"USE_MAP\":\"\",\"USE_WINMAP\":\"\"}": {
  h: "891hkkgsu", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { abs, vec3, max, div, select, min, property, float, fract, mix, mul, add, step, sub, If, floor, vec2, length, Fn, vec4, Discard, dot, clamp, smoothstep, normalize, pow, reflect, dFdx, dFdy, mod } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




    const room =  Fn( ( [ o, vd, dim, hs, lc, kind ] ) => {

    	const inv = div( 1., max( abs( vd ), vec3( 1e-4 ) ) ).toVar();
    	const tx = select( vd.x.greaterThan( 0. ), dim.x.sub( o.x ), o.x ).mul( inv.x ).toVar();
    	const ty = select( vd.y.greaterThan( 0. ), dim.y.sub( o.y ), o.y ).mul( inv.y ).toVar();
    	const tz = dim.z.sub( o.z ).mul( inv.z ).toVar();
    	const t = min( tx, min( ty, tz ) ).toVar();
    	const hp = o.add( vd.mul( t ) ).toVar();
    	const c = property( 'vec3' );
    	const lit = float( 1. ).toVar();

    	If( t.equal( tz ), () => {

    		const bw = hp.xy.div( dim.xy ).toVar();
    		c.assign( mix( vec3( .56, .52, .47 ), vec3( .47, .48, .49 ), fract( hs.mul( 13. ) ) ).mul( add( .92, mul( .08, n2( hp.xy.mul( 2. ) ) ) ) ) );
    		c.mulAssign( mix( .55, 1., step( .035, bw.y ) ) );

    		If( kind.lessThan( .5 ), () => {

    			const pic = step( .18, bw.x ).mul( step( bw.x, .5 ) ).mul( step( .45, bw.y ) ).mul( step( bw.y, .72 ) ).mul( step( .45, fract( hs.mul( 7. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .16, .1, .06 ), pic ) );
    			const shelf = step( .62, bw.x ).mul( step( bw.x, .92 ) ).mul( step( bw.y, .75 ) ).mul( step( .6, fract( hs.mul( 3. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .2, .13, .08 ).mul( add( .6, mul( .4, step( .5, fract( bw.y.mul( 6. ) ) ) ) ) ), shelf ) );
    			const px = fract( hs.mul( 29. ) ).mul( .6 ).add( .2 ).toVar();
    			const person = step( abs( bw.x.sub( px ) ), sub( .07, mul( .03, step( .55, bw.y ) ) ) ).mul( step( bw.y, add( .62, mul( .08, step( abs( bw.x.sub( px ) ), .035 ) ) ) ) ).mul( step( .72, fract( hs.mul( 17. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .04 ), person ) );

    		} ).ElseIf( kind.lessThan( 1.5 ), () => {

    			c.assign( vec3( .5, .52, .55 ) );
    			const desk = step( bw.y, .32 ).mul( step( .2, bw.y ) ).toVar();
    			c.assign( mix( c, vec3( .18, .2, .22 ), desk ) );
    			const scr = step( .32, bw.y ).mul( step( bw.y, .42 ) ).mul( step( .5, fract( bw.x.mul( 5. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .3, .6, 1. ).mul( 2. ), scr.mul( step( .4, fract( hs.mul( 5. ) ) ) ) ) );

    		} );

    	} ).ElseIf( t.equal( ty ), () => {

    		If( vd.y.greaterThan( 0. ), () => {

    			c.assign( vec3( .75, .72, .66 ) );

    			If( kind.greaterThan( .5 ).and( kind.lessThan( 1.5 ) ), () => {

    				c.addAssign( step( .85, fract( hp.z.mul( .8 ) ) ).mul( 3. ) );

    			} );

    		} ).Else( () => {

    			c.assign( select( kind.greaterThan( .5 ), vec3( .3, .3, .31 ).mul( add( .9, mul( .1, step( .5, fract( hp.x.mul( 1.7 ) ) ) ) ) ), vec3( .33, .25, .18 ).mul( add( .82, mul( .18, h21( vec2( floor( hp.x.div( .16 ) ), hs ) ) ) ) ) ) );

    		} );

    	} ).Else( () => {

    		c.assign( mix( vec3( .56, .52, .47 ), vec3( .47, .48, .49 ), fract( hs.mul( 13. ) ) ).mul( .8 ).mul( mix( .55, 1., step( .035, hp.y.div( dim.y ) ) ) ) );

    	} );

    	const ld = length( hp.sub( vec3( dim.x.mul( .5 ), dim.y.mul( .92 ), dim.z.mul( .45 ) ) ) ).toVar();
    	c.mulAssign( lc.mul( add( .45, div( 1.3, add( 1., ld.mul( ld ).mul( .5 ) ) ) ) ) );

    	return c.mul( mix( 1., .55, hp.z.div( dim.z ) ) );

    }, { o: 'vec3', vd: 'vec3', dim: 'vec3', hs: 'float', lc: 'vec3', kind: 'float', return: 'vec3' } );

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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );
    	const n = normalize( vN ).toVar();
    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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

    	If( abs( n.y ).lessThan( .5 ), () => {

    		const by = vW.y.toVar();
    		base.rgb.mulAssign( mix( add( .68, mul( .12, n2( vW.xz.mul( 1.3 ).add( vW.y.mul( 2.5 ) ) ) ) ), 1., smoothstep( 0., 1.2, by ) ).mul( sub( 1., mul( .2, uWet ).mul( mix( .55, 1., sub( 1., smoothstep( 0., 3., by ) ) ) ) ) ) );

    	} );

    	const wet = uWet.mul( smoothstep( .55, .95, n.y ) ).toVar();
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

    	} );

    	const tg = normalize( vec3( n.z.negate(), 0., n.x ).add( vec3( 1e-4, 0., 0. ) ) ).toVar();
    	const u = dot( vW, tg ).toVar(), wu = dFdx( u ).toVar(), wv = dFdy( u ).toVar(), yu = dFdx( vW.y ).toVar(), yv = dFdy( vW.y ).toVar(), det = wu.mul( yv ).sub( wv.mul( yu ) ).toVar();
    	const upUv = dFdy( vUv ).mul( wu ).sub( dFdx( vUv ).mul( wv ) ).div( select( abs( det ).greaterThan( 1e-9 ), det, 1e9 ) ).toVar();

    	If( uWinMap.sample( vUv ).level( 0. ).r.greaterThan( .5 ), () => {

    		const cell = vec2( floor( uWinMap.sample( vUv ).level( 0. ).g.mul( 255. ).add( .5 ) ), dot( mod( floor( vUv ), 256. ), vec2( 1., 257. ) ) ).add( vWin.mul( 997. ) ).toVar();
    		const hs = hw( cell ).toVar(), hs2 = hw( cell.add( 71.3 ) ).toVar();
    		const vd = vec3( dot( v.negate(), tg ), v.y.negate(), max( dot( v, n ), .05 ) ).toVar(), dim = vec3( 4.2, 3.3, 5. ).toVar();
    		const rs = hw( floor( vec2( u.div( dim.x ), vW.y.div( dim.y ) ) ).add( vWin.mul( 37. ) ) ).toVar();
    		const tall = add( 1., step( .5, uWinMap.sample( vUv.add( upUv.mul( .8 ) ) ).level( 0. ).r ) ).add( step( .5, uWinMap.sample( vUv.sub( upUv.mul( .8 ) ) ).level( 0. ).r ) ).add( step( .5, uWinMap.sample( vUv.add( upUv.mul( 1.6 ) ) ).level( 0. ).r ) ).add( step( .5, uWinMap.sample( vUv.sub( upUv.mul( 1.6 ) ) ).level( 0. ).r ) ).toVar();
    		const office = step( 3.5, tall ).toVar();
    		const lc = select( office.greaterThan( .5 ), mix( vec3( 1., .86, .64 ), vec3( 1., .95, .84 ), hs2 ), mix( vec3( 1., .76, .48 ), vec3( 1., .93, .8 ), hs2 ) ).toVar();
    		const lit = hs.lessThan( uLit.mul( 1.1 ).mul( select( office.greaterThan( .5 ), step( .55, hw( vec2( vWin.mul( 13.1 ), 4.7 ) ) ).mul( .9 ).add( .25 ), 1. ) ) ).toVar();

    		If( vW.y.lessThan( 4.2 ), () => {

    			const sb = hw( vec2( floor( u.div( 6. ) ), vWin.mul( 3.7 ) ) ).toVar();
    			lit.assign( sb.lessThan( .75 ) );
    			lc.assign( mix( vec3( 1., .88, .66 ), vec3( 1., .95, .86 ), step( .5, fract( sb.mul( 7. ) ) ) ) );

    		} );

    		const rl = select( lit, lc.mul( select( office.greaterThan( .5 ), .75, 1.1 ) ), mix( lc.mul( .025 ), vec3( .15, .15, .16 ).mul( add( .6, mul( .8, hs2 ) ) ), uDay ) ).toVar();
    		const inside = room( vec3( mod( u, dim.x ), mod( vW.y, dim.y ), 0. ), vd, dim, rs, rl, office ).toVar();

    		If( lit.and( fract( hs.mul( 41. ) ).lessThan( .3 ) ), () => {

    			inside.assign( mix( inside, rl.mul( .5 ).mul( add( .5, mul( .5, step( .35, fract( vW.y.mul( 4.3 ) ) ) ) ) ), .8 ) );

    		} );

    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const gw = inside.mul( sub( 1., F ) ).add( envMap( reflect( v.negate(), n ) ).mul( F ).mul( .6 ) ).add( c.mul( .25 ) ).toVar();
    		c.assign( mix( gw, c.add( inside.mul( select( lit, .3, 0. ) ) ), uDay ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"USE_MAP\":\"\"}": {
  h: "1cy9g8igse", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );
    	const n = normalize( vN ).toVar();
    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"WASH\":\"\",\"DOUBLE\":\"\"}": {
  h: "umps5igsn", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, vec2, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( vec2( 0 ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, exp, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

    	} );

    	If( true, () => {

    		const wv = uLamp.mul( sub( 1., smoothstep( .45, .8, abs( n.y ) ) ) ).toVar();
    		const bay = floor( vec2( dot( vW.xz, normalize( vec2( n.z.negate(), n.x ).add( 1e-4 ) ) ).div( 3.1 ), vW.y.div( 3.2 ) ) ).toVar();
    		const room = step( hw( bay.add( floor( vW.xz.div( 40. ) ).mul( 13. ) ) ), uLit.mul( .9 ) ).mul( smoothstep( 1.2, 3., vW.y ) ).toVar();
    		c.addAssign( base.rgb.mul( wv ).mul( vec3( 1., .72, .45 ).mul( add( .06, mul( .7, exp( max( vW.y.sub( .8 ), 0. ).negate().div( 3.5 ) ) ) ) ).add( vec3( 1., .8, .6 ).mul( room ).mul( .35 ) ) ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"WASH\":\"\",\"USE_MAP\":\"\",\"BLEND\":\"\",\"DOUBLE\":\"\"}": {
  h: "eah8a5gtb", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, exp, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );
    	const n = normalize( vN ).toVar();

    	If( frontFacing_.not(), () => {

    		n.assign( n.negate() );

    	} );

    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( 1.1 );
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

    	} );

    	If( true, () => {

    		const wv = uLamp.mul( sub( 1., smoothstep( .45, .8, abs( n.y ) ) ) ).toVar();
    		const bay = floor( vec2( dot( vW.xz, normalize( vec2( n.z.negate(), n.x ).add( 1e-4 ) ) ).div( 3.1 ), vW.y.div( 3.2 ) ) ).toVar();
    		const room = step( hw( bay.add( floor( vW.xz.div( 40. ) ).mul( 13. ) ) ), uLit.mul( .9 ) ).mul( smoothstep( 1.2, 3., vW.y ) ).toVar();
    		c.addAssign( base.rgb.mul( wv ).mul( vec3( 1., .72, .45 ).mul( add( .06, mul( .7, exp( max( vW.y.sub( .8 ), 0. ).negate().div( 3.5 ) ) ) ) ).add( vec3( 1., .8, .6 ).mul( room ).mul( .35 ) ) ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), clamp( base.a.add( sub( 1., max( dot( n, v ), 0. ) ).mul( .25 ) ), 0., 1. ) ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"WASH\":\"\",\"USE_MAP\":\"\",\"BLEND\":\"\"}": {
  h: "1gu4tesgsz", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, exp, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );
    	const n = normalize( vN ).toVar();
    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( 1.1 );
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

    	} );

    	If( true, () => {

    		const wv = uLamp.mul( sub( 1., smoothstep( .45, .8, abs( n.y ) ) ) ).toVar();
    		const bay = floor( vec2( dot( vW.xz, normalize( vec2( n.z.negate(), n.x ).add( 1e-4 ) ) ).div( 3.1 ), vW.y.div( 3.2 ) ) ).toVar();
    		const room = step( hw( bay.add( floor( vW.xz.div( 40. ) ).mul( 13. ) ) ), uLit.mul( .9 ) ).mul( smoothstep( 1.2, 3., vW.y ) ).toVar();
    		c.addAssign( base.rgb.mul( wv ).mul( vec3( 1., .72, .45 ).mul( add( .06, mul( .7, exp( max( vW.y.sub( .8 ), 0. ).negate().div( 3.5 ) ) ) ) ).add( vec3( 1., .8, .6 ).mul( room ).mul( .35 ) ) ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), clamp( base.a.add( sub( 1., max( dot( n, v ), 0. ) ).mul( .25 ) ), 0., 1. ) ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"WASH\":\"\",\"USE_MAP\":\"\",\"DOUBLE\":\"\",\"USE_WINMAP\":\"\"}": {
  h: "1fa8xfsgtg", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { abs, vec3, max, div, select, min, property, float, fract, mix, mul, add, step, sub, If, floor, vec2, length, Fn, vec4, Discard, dot, clamp, smoothstep, normalize, pow, reflect, dFdx, dFdy, mod, exp } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




    const room =  Fn( ( [ o, vd, dim, hs, lc, kind ] ) => {

    	const inv = div( 1., max( abs( vd ), vec3( 1e-4 ) ) ).toVar();
    	const tx = select( vd.x.greaterThan( 0. ), dim.x.sub( o.x ), o.x ).mul( inv.x ).toVar();
    	const ty = select( vd.y.greaterThan( 0. ), dim.y.sub( o.y ), o.y ).mul( inv.y ).toVar();
    	const tz = dim.z.sub( o.z ).mul( inv.z ).toVar();
    	const t = min( tx, min( ty, tz ) ).toVar();
    	const hp = o.add( vd.mul( t ) ).toVar();
    	const c = property( 'vec3' );
    	const lit = float( 1. ).toVar();

    	If( t.equal( tz ), () => {

    		const bw = hp.xy.div( dim.xy ).toVar();
    		c.assign( mix( vec3( .56, .52, .47 ), vec3( .47, .48, .49 ), fract( hs.mul( 13. ) ) ).mul( add( .92, mul( .08, n2( hp.xy.mul( 2. ) ) ) ) ) );
    		c.mulAssign( mix( .55, 1., step( .035, bw.y ) ) );

    		If( kind.lessThan( .5 ), () => {

    			const pic = step( .18, bw.x ).mul( step( bw.x, .5 ) ).mul( step( .45, bw.y ) ).mul( step( bw.y, .72 ) ).mul( step( .45, fract( hs.mul( 7. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .16, .1, .06 ), pic ) );
    			const shelf = step( .62, bw.x ).mul( step( bw.x, .92 ) ).mul( step( bw.y, .75 ) ).mul( step( .6, fract( hs.mul( 3. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .2, .13, .08 ).mul( add( .6, mul( .4, step( .5, fract( bw.y.mul( 6. ) ) ) ) ) ), shelf ) );
    			const px = fract( hs.mul( 29. ) ).mul( .6 ).add( .2 ).toVar();
    			const person = step( abs( bw.x.sub( px ) ), sub( .07, mul( .03, step( .55, bw.y ) ) ) ).mul( step( bw.y, add( .62, mul( .08, step( abs( bw.x.sub( px ) ), .035 ) ) ) ) ).mul( step( .72, fract( hs.mul( 17. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .04 ), person ) );

    		} ).ElseIf( kind.lessThan( 1.5 ), () => {

    			c.assign( vec3( .5, .52, .55 ) );
    			const desk = step( bw.y, .32 ).mul( step( .2, bw.y ) ).toVar();
    			c.assign( mix( c, vec3( .18, .2, .22 ), desk ) );
    			const scr = step( .32, bw.y ).mul( step( bw.y, .42 ) ).mul( step( .5, fract( bw.x.mul( 5. ) ) ) ).toVar();
    			c.assign( mix( c, vec3( .3, .6, 1. ).mul( 2. ), scr.mul( step( .4, fract( hs.mul( 5. ) ) ) ) ) );

    		} );

    	} ).ElseIf( t.equal( ty ), () => {

    		If( vd.y.greaterThan( 0. ), () => {

    			c.assign( vec3( .75, .72, .66 ) );

    			If( kind.greaterThan( .5 ).and( kind.lessThan( 1.5 ) ), () => {

    				c.addAssign( step( .85, fract( hp.z.mul( .8 ) ) ).mul( 3. ) );

    			} );

    		} ).Else( () => {

    			c.assign( select( kind.greaterThan( .5 ), vec3( .3, .3, .31 ).mul( add( .9, mul( .1, step( .5, fract( hp.x.mul( 1.7 ) ) ) ) ) ), vec3( .33, .25, .18 ).mul( add( .82, mul( .18, h21( vec2( floor( hp.x.div( .16 ) ), hs ) ) ) ) ) ) );

    		} );

    	} ).Else( () => {

    		c.assign( mix( vec3( .56, .52, .47 ), vec3( .47, .48, .49 ), fract( hs.mul( 13. ) ) ).mul( .8 ).mul( mix( .55, 1., step( .035, hp.y.div( dim.y ) ) ) ) );

    	} );

    	const ld = length( hp.sub( vec3( dim.x.mul( .5 ), dim.y.mul( .92 ), dim.z.mul( .45 ) ) ) ).toVar();
    	c.mulAssign( lc.mul( add( .45, div( 1.3, add( 1., ld.mul( ld ).mul( .5 ) ) ) ) ) );

    	return c.mul( mix( 1., .55, hp.z.div( dim.z ) ) );

    }, { o: 'vec3', vd: 'vec3', dim: 'vec3', hs: 'float', lc: 'vec3', kind: 'float', return: 'vec3' } );

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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );
    	const n = normalize( vN ).toVar();

    	If( frontFacing_.not(), () => {

    		n.assign( n.negate() );

    	} );

    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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

    	If( abs( n.y ).lessThan( .5 ), () => {

    		const by = vW.y.toVar();
    		base.rgb.mulAssign( mix( add( .68, mul( .12, n2( vW.xz.mul( 1.3 ).add( vW.y.mul( 2.5 ) ) ) ) ), 1., smoothstep( 0., 1.2, by ) ).mul( sub( 1., mul( .2, uWet ).mul( mix( .55, 1., sub( 1., smoothstep( 0., 3., by ) ) ) ) ) ) );

    	} );

    	const wet = uWet.mul( smoothstep( .55, .95, n.y ) ).toVar();
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

    	} );

    	const tg = normalize( vec3( n.z.negate(), 0., n.x ).add( vec3( 1e-4, 0., 0. ) ) ).toVar();
    	const u = dot( vW, tg ).toVar(), wu = dFdx( u ).toVar(), wv = dFdy( u ).toVar(), yu = dFdx( vW.y ).toVar(), yv = dFdy( vW.y ).toVar(), det = wu.mul( yv ).sub( wv.mul( yu ) ).toVar();
    	const upUv = dFdy( vUv ).mul( wu ).sub( dFdx( vUv ).mul( wv ) ).div( select( abs( det ).greaterThan( 1e-9 ), det, 1e9 ) ).toVar();

    	If( uWinMap.sample( vUv ).level( 0. ).r.greaterThan( .5 ), () => {

    		const cell = vec2( floor( uWinMap.sample( vUv ).level( 0. ).g.mul( 255. ).add( .5 ) ), dot( mod( floor( vUv ), 256. ), vec2( 1., 257. ) ) ).add( vWin.mul( 997. ) ).toVar();
    		const hs = hw( cell ).toVar(), hs2 = hw( cell.add( 71.3 ) ).toVar();
    		const vd = vec3( dot( v.negate(), tg ), v.y.negate(), max( dot( v, n ), .05 ) ).toVar(), dim = vec3( 4.2, 3.3, 5. ).toVar();
    		const rs = hw( floor( vec2( u.div( dim.x ), vW.y.div( dim.y ) ) ).add( vWin.mul( 37. ) ) ).toVar();
    		const tall = add( 1., step( .5, uWinMap.sample( vUv.add( upUv.mul( .8 ) ) ).level( 0. ).r ) ).add( step( .5, uWinMap.sample( vUv.sub( upUv.mul( .8 ) ) ).level( 0. ).r ) ).add( step( .5, uWinMap.sample( vUv.add( upUv.mul( 1.6 ) ) ).level( 0. ).r ) ).add( step( .5, uWinMap.sample( vUv.sub( upUv.mul( 1.6 ) ) ).level( 0. ).r ) ).toVar();
    		const office = step( 3.5, tall ).toVar();
    		const lc = select( office.greaterThan( .5 ), mix( vec3( 1., .86, .64 ), vec3( 1., .95, .84 ), hs2 ), mix( vec3( 1., .76, .48 ), vec3( 1., .93, .8 ), hs2 ) ).toVar();
    		const lit = hs.lessThan( uLit.mul( 1.1 ).mul( select( office.greaterThan( .5 ), step( .55, hw( vec2( vWin.mul( 13.1 ), 4.7 ) ) ).mul( .9 ).add( .25 ), 1. ) ) ).toVar();

    		If( vW.y.lessThan( 4.2 ), () => {

    			const sb = hw( vec2( floor( u.div( 6. ) ), vWin.mul( 3.7 ) ) ).toVar();
    			lit.assign( sb.lessThan( .75 ) );
    			lc.assign( mix( vec3( 1., .88, .66 ), vec3( 1., .95, .86 ), step( .5, fract( sb.mul( 7. ) ) ) ) );

    		} );

    		const rl = select( lit, lc.mul( select( office.greaterThan( .5 ), .75, 1.1 ) ), mix( lc.mul( .025 ), vec3( .15, .15, .16 ).mul( add( .6, mul( .8, hs2 ) ) ), uDay ) ).toVar();
    		const inside = room( vec3( mod( u, dim.x ), mod( vW.y, dim.y ), 0. ), vd, dim, rs, rl, office ).toVar();

    		If( lit.and( fract( hs.mul( 41. ) ).lessThan( .3 ) ), () => {

    			inside.assign( mix( inside, rl.mul( .5 ).mul( add( .5, mul( .5, step( .35, fract( vW.y.mul( 4.3 ) ) ) ) ) ), .8 ) );

    		} );

    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const gw = inside.mul( sub( 1., F ) ).add( envMap( reflect( v.negate(), n ) ).mul( F ).mul( .6 ) ).add( c.mul( .25 ) ).toVar();
    		c.assign( mix( gw, c.add( inside.mul( select( lit, .3, 0. ) ) ), uDay ) );

    	} );

    	If( true, () => {

    		const wv = uLamp.mul( sub( 1., smoothstep( .45, .8, abs( n.y ) ) ) ).toVar();
    		const bay = floor( vec2( dot( vW.xz, normalize( vec2( n.z.negate(), n.x ).add( 1e-4 ) ) ).div( 3.1 ), vW.y.div( 3.2 ) ) ).toVar();
    		const room = step( hw( bay.add( floor( vW.xz.div( 40. ) ).mul( 13. ) ) ), uLit.mul( .9 ) ).mul( smoothstep( 1.2, 3., vW.y ) ).toVar();
    		c.addAssign( base.rgb.mul( wv ).mul( vec3( 1., .72, .45 ).mul( add( .06, mul( .7, exp( max( vW.y.sub( .8 ), 0. ).negate().div( 3.5 ) ) ) ) ).add( vec3( 1., .8, .6 ).mul( room ).mul( .35 ) ) ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"WASH\":\"\",\"USE_MAP\":\"\",\"DOUBLE\":\"\"}": {
  h: "1egse9agt0", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, exp, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );
    	const n = normalize( vN ).toVar();

    	If( frontFacing_.not(), () => {

    		n.assign( n.negate() );

    	} );

    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

    	} );

    	If( true, () => {

    		const wv = uLamp.mul( sub( 1., smoothstep( .45, .8, abs( n.y ) ) ) ).toVar();
    		const bay = floor( vec2( dot( vW.xz, normalize( vec2( n.z.negate(), n.x ).add( 1e-4 ) ) ).div( 3.1 ), vW.y.div( 3.2 ) ) ).toVar();
    		const room = step( hw( bay.add( floor( vW.xz.div( 40. ) ).mul( 13. ) ) ), uLit.mul( .9 ) ).mul( smoothstep( 1.2, 3., vW.y ) ).toVar();
    		c.addAssign( base.rgb.mul( wv ).mul( vec3( 1., .72, .45 ).mul( add( .06, mul( .7, exp( max( vW.y.sub( .8 ), 0. ).negate().div( 3.5 ) ) ) ) ).add( vec3( 1., .8, .6 ).mul( room ).mul( .35 ) ) ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"WASH\":\"\",\"USE_MAP\":\"\",\"USE_EMIMAP\":\"\",\"DOUBLE\":\"\"}": {
  h: "rwy7gzgtg", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( uv );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, exp, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	base.mulAssign( uMap.sample( vUv ) );
    	const n = normalize( vN ).toVar();

    	If( frontFacing_.not(), () => {

    		n.assign( n.negate() );

    	} );

    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

    	} );

    	If( true, () => {

    		const wv = uLamp.mul( sub( 1., smoothstep( .45, .8, abs( n.y ) ) ) ).toVar();
    		const bay = floor( vec2( dot( vW.xz, normalize( vec2( n.z.negate(), n.x ).add( 1e-4 ) ) ).div( 3.1 ), vW.y.div( 3.2 ) ) ).toVar();
    		const room = step( hw( bay.add( floor( vW.xz.div( 40. ) ).mul( 13. ) ) ), uLit.mul( .9 ) ).mul( smoothstep( 1.2, 3., vW.y ) ).toVar();
    		c.addAssign( base.rgb.mul( wv ).mul( vec3( 1., .72, .45 ).mul( add( .06, mul( .7, exp( max( vW.y.sub( .8 ), 0. ).negate().div( 3.5 ) ) ) ) ).add( vec3( 1., .8, .6 ).mul( room ).mul( .35 ) ) ) );

    	} );

    	const emi = vEmi.rgb.div( max( 1., max( vEmi.r, max( vEmi.g, vEmi.b ) ) ) ).toVar();
    	const k = vEmi.a.toVar();

    	If( abs( fract( k ).sub( .25 ) ).lessThan( .05 ), () => {

    		k.assign( floor( k ) );
    		const mx = max( base.g, base.b ).toVar();
    		emi.mulAssign( select( k.greaterThan( 1.5 ), smoothstep( 1.6, 3.2, base.r.div( max( mx, .015 ) ) ).mul( smoothstep( .015, .08, base.r ) ), max( smoothstep( .1, .45, dot( base.rgb, vec3( .2126, .7152, .0722 ) ) ), sub( 1., base.a ).mul( 1.2 ) ) ) );

    	} ).ElseIf( abs( fract( k ).sub( .5 ) ).lessThan( .05 ), () => {

    		k.assign( floor( k ) );

    	} ).Else( () => {

    		emi.mulAssign( uEmiMap.sample( vUv ).rgb );

    	} );

    	c.addAssign( emi.mul( 1.6 ).mul( select( k.greaterThan( 1.5 ), add( .5, uM.y.mul( 2.4 ) ), select( k.greaterThan( .5 ), add( .35, uM.x.mul( 1.4 ) ), uM.z ) ) ).mul( sub( 1., uM.w ) ) );
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{}": {
  h: "1pvtmrqgs2", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, vec2, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vCol.assign( color );
    	vPbr.assign( lu_pbr );
    	vEmi.assign( lu_emi );
    	vWin.assign( lu_win );
    	vUv.assign( vec2( 0 ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, mix, min, vec3, pow, reflect, add, select, abs, floor, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vPbr.w.greaterThan( .5 ).and( uPaint.w.greaterThan( .5 ) ).and( uPaint.r.greaterThanEqual( 0. ) ), () => {

    		base.rgb.assign( uPaint.rgb );

    	} );

    	const n = normalize( vN ).toVar();
    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const rough = clamp( vPbr.x, .05, 1. ).toVar(), metal = clamp( vPbr.y, 0., 1. ).toVar(), coat = vPbr.z.toVar();
    	metal.assign( min( metal, mix( .5, 1., step( rough, .15 ) ) ) );

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
    	rough.assign( mix( rough, rough.mul( .4 ), wet ) );
    	const c = shade( vW, n, v, base.rgb, rough, metal ).toVar();
    	const envK = max( coat.mul( .75 ), metal.mul( .9 ) ).toVar();
    	envK.assign( max( envK, wet.mul( .5 ) ) );

    	If( envK.greaterThan( .01 ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const rr = select( coat.greaterThan( .3 ), min( rough, .25 ), rough ).toVar();
    		c.addAssign( envMapS( r, clamp( max( coat, vPbr.w ), 0., 1. ) ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
