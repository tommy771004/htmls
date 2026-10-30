// 自動產生（node tools/gen-tsl.mjs），不要手改：改 GLSL 之後重跑產生器
// 材質 "glbI"：鍵是 defines 的形狀（有值的寫成 *），h 是產生時 GLSL 的雜湊
export default {
"{\"BLEND\":\"\",\"DOUBLE\":\"\"}": {
  h: "qaikaqgts", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
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
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




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
    		c.addAssign( envMap( r ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
"{\"DOUBLE\":\"\"}": {
  h: "15spku3gth", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
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
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




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
    		c.addAssign( envMap( r ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
"{\"FAR\":\"*\",\"USE_MAP\":\"\",\"DOUBLE\":\"\"}": {
  h: "1umita6gu4", lib: "[[\"FAR\",\"*\"]]NL_T,NOCC_T,SH_N_T,VOL_N_T,FAR", libV: false, libF: true,
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
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




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
    		c.addAssign( envMap( r ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
"{\"USE_MAP\":\"\",\"BLEND\":\"\",\"DOUBLE\":\"\"}": {
  h: "1t8j744gu5", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
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
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




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
    		c.addAssign( envMap( r ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
  h: "jfhe81gtt", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
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
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




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
    		c.addAssign( envMap( r ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
"{\"USE_MAP\":\"\",\"DOUBLE\":\"\"}": {
  h: "1x4ondpgtu", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
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
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




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
    		c.addAssign( envMap( r ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
  h: "1fnth93gu4", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
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
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




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
    		c.addAssign( envMap( r ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
"{\"USE_MAP\":\"\",\"MASK\":\"\",\"MASK_CUT\":\"*\"}": {
  h: "1ejlh07gu7", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uPaint","type":"vec4","src":"uPaint"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uEmiMap","type":"sampler2D","src":"uEmiMap"},{"name":"uWinMap","type":"sampler2D","src":"uWinMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec4","src":"vCol"},{"name":"vPbr","type":"vec4","src":"vPbr"},{"name":"vEmi","type":"vec4","src":"vEmi"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vWin","type":"float","src":"vWin"}],
  attributes: [{"name":"color","type":"vec4","src":"color"},{"name":"lu_pbr","type":"vec4","src":"_pbr"},{"name":"lu_emi","type":"vec4","src":"_emi"},{"name":"lu_win","type":"float","src":"_win"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, MASK_CUT } = E;




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
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, MASK_CUT, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




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

    	If( base.a.lessThan( MASK_CUT ), () => {

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
    		c.addAssign( envMap( r ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
  h: "pgof8agts", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
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
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




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
    		c.addAssign( envMap( r ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
  h: "qmevtzgul", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
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
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




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
    		c.addAssign( envMap( r ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
  h: "1e5ixuwgua", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
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
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




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
    		c.addAssign( envMap( r ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
  h: "129c7g6guk", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
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
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




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
    		c.addAssign( envMap( r ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
  h: "qmhxhgty", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
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
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




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
    		c.addAssign( envMap( r ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
"{\"USE_MAP\":\"\"}": {
  h: "1i1m1ggti", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
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
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




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
    		c.addAssign( envMap( r ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
"{}": {
  h: "120piw4gt6", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
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
    const { uM, uPaint, uMap, uEmiMap, uWinMap, vW, vN, vCol, vPbr, vEmi, vUv, vWin, color, lu_pbr, lu_emi, lu_win, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




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
    		c.addAssign( envMap( r ).mul( envK ).mul( mix( vec3( max( F, coat.mul( .1 ) ) ), base.rgb, metal ) ).mul( sub( 1., rr.mul( .9 ) ) ) );

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
