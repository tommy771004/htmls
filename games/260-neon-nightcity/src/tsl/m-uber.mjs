// 材質的 TSL（原本由已刪除的 tools/gen-tsl.mjs 從 GLSL 轉出，現在是著色器的原始碼，直接改這裡）
// 材質 "uber"：鍵是 defines 的形狀（有值的寫成 *），h 是當初轉換時 GLSL 的雜湊（已不使用）
export default {
"{\"DOUBLE\":\"\"}": {
  h: "14ufciac9s", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAHMap","type":"sampler2D","src":"uAHMap"},{"name":"uAHM","type":"vec4","src":"uAHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec3","src":"vCol"},{"name":"vMat","type":"float","src":"vMat"},{"name":"vIns","type":"vec4","src":"vIns"}],
  attributes: [{"name":"color","type":"vec3","src":"color"},{"name":"aMat","type":"float","src":"aMat"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, vW, vN, vCol, vMat, vIns, color, aMat, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const lp = vec4( position, 1. ).toVar();
    	const nn = normal.toVar();
    	const w = modelMatrix.mul( lp ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( nn ) ) );
    	vCol.assign( color );
    	vMat.assign( aMat );
    	vIns.assign( vec4( 0 ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, int, float, vec3, add, sin, abs, select, mix, reflect, pow, Fn } = TSL;
    const { uM, vW, vN, vCol, vMat, vIns, color, aMat, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	const n = normalize( vN ).toVar();

    	If( frontFacing_.not(), () => {

    		n.assign( n.negate() );

    	} );

    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const m = int( vMat.add( .5 ) ).toVar();
    	const alb = vCol.toVar();
    	const rough = float( .7 ).toVar(), metal = float( 0. ).toVar(), envK = float( 0. ).toVar();
    	const emi = vec3( 0 ).toVar();

    	If( m.equal( 0 ), () => {

    		rough.assign( .22 );
    		envK.assign( .75 );

    	} ).ElseIf( m.equal( 1 ), () => {

    		alb.mulAssign( .12 );
    		rough.assign( .04 );
    		envK.assign( 1.1 );

    	} ).ElseIf( m.equal( 2 ), () => {

    		rough.assign( .85 );

    	} ).ElseIf( m.equal( 3 ), () => {

    		rough.assign( .14 );
    		metal.assign( 1. );
    		envK.assign( 1. );

    	} ).ElseIf( m.equal( 4 ), () => {

    		emi.assign( vCol.mul( add( .2, uM.x.mul( 1.7 ) ) ) );
    		alb.mulAssign( .2 );

    	} ).ElseIf( m.equal( 5 ), () => {

    		const b = max( uM.y, vIns.x ).toVar();
    		emi.assign( vCol.mul( add( .7, b.mul( 2.6 ) ) ) );
    		alb.mulAssign( .2 );

    	} ).ElseIf( m.equal( 6 ), () => {

    		rough.assign( .92 );
    		alb.mulAssign( .5 );

    	} ).ElseIf( m.equal( 7 ), () => {

    		rough.assign( .3 );
    		metal.assign( 1. );
    		envK.assign( .6 );

    	} ).ElseIf( m.equal( 8 ), () => {

    		emi.assign( vCol.mul( 2.4 ).mul( uM.z ).mul( add( .9, mul( .1, sin( uTime.mul( 2.3 ).add( vIns.y.mul( 9. ) ) ) ) ) ) );
    		alb.mulAssign( .1 );

    	} ).ElseIf( m.equal( 9 ), () => {

    		emi.assign( vCol.mul( step( .5, fract( uTime.mul( 1.3 ).add( vIns.y ) ) ) ).mul( 2.6 ) );

    	} ).ElseIf( m.equal( 10 ), () => {

    		rough.assign( .5 );

    	} ).ElseIf( m.equal( 11 ), () => {

    		emi.assign( vCol.mul( 1.1 ).mul( uM.z ) );
    		alb.mulAssign( .3 );

    	} ).ElseIf( m.greaterThanEqual( 12 ).and( m.lessThanEqual( 14 ) ), () => {

    		const on = select( abs( vIns.x.sub( float( m.sub( 12 ) ) ) ).lessThan( .5 ), 1., 0. ).toVar();
    		emi.assign( vCol.mul( add( .04, on.mul( 3.4 ) ) ) );
    		alb.mulAssign( .15 );

    	} ).ElseIf( m.equal( 15 ), () => {

    		rough.assign( .5 );
    		metal.assign( .8 );
    		envK.assign( .3 );

    	} ).ElseIf( m.equal( 16 ), () => {

    		emi.assign( vCol.mul( uLampOn ).mul( 1.6 ) );
    		alb.assign( vec3( .03 ) );
    		rough.assign( .08 );
    		envK.assign( 1. );

    	} );

    	alb.assign( mix( alb, vec3( .025, .022, .02 ), uM.w ) );
    	rough.assign( mix( rough, .95, uM.w ) );
    	metal.mulAssign( sub( 1., uM.w ) );
    	envK.mulAssign( sub( 1., uM.w ) );
    	emi.mulAssign( sub( 1., uM.w ) );
    	const wet = uWet.mul( smoothstep( .55, .95, n.y ) ).mul( sub( 1., step( 4., float( m ) ).mul( step( float( m ), 9. ) ) ) ).toVar();
    	rough.assign( mix( rough, rough.mul( .35 ), wet ) );
    	alb.mulAssign( sub( 1., mul( .3, wet ) ) );
    	const c = shade( vW, n, v, alb, rough, metal ).toVar();

    	If( envK.greaterThan( 0. ).or( wet.greaterThan( .1 ) ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		c.addAssign( envMapS( r, 1. ).mul( max( envK, wet.mul( .5 ) ) ).mul( mix( select( m.equal( 0 ), max( F, .1 ), F ), 1., metal ) ).mul( sub( 1., rough.mul( .9 ) ) ) );

    	} );

    	c.addAssign( emi );
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"FAR\":\"*\",\"FARD\":\"*\"}": {
  h: "16gdbczca1", fog: true, lib: "[[\"FAR\",\"*\"]]NL_T,NOCC_T,SH_N_T,VOL_N_T,FAR", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAHMap","type":"sampler2D","src":"uAHMap"},{"name":"uAHM","type":"vec4","src":"uAHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec3","src":"vCol"},{"name":"vMat","type":"float","src":"vMat"},{"name":"vIns","type":"vec4","src":"vIns"}],
  attributes: [{"name":"color","type":"vec3","src":"color"},{"name":"aMat","type":"float","src":"aMat"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, vW, vN, vCol, vMat, vIns, color, aMat, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR, FARD } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const lp = vec4( position, 1. ).toVar();
    	const nn = normal.toVar();
    	const w = modelMatrix.mul( lp ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( nn ) ) );
    	vCol.assign( color );
    	vMat.assign( aMat );
    	vIns.assign( vec4( 0 ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, int, float, vec3, add, sin, abs, select, mix, reflect, pow, Fn } = TSL;
    const { uM, vW, vN, vCol, vMat, vIns, color, aMat, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR, FARD, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	const n = normalize( vN ).toVar();
    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const m = int( vMat.add( .5 ) ).toVar();
    	const alb = vCol.toVar();
    	const rough = float( .7 ).toVar(), metal = float( 0. ).toVar(), envK = float( 0. ).toVar();
    	const emi = vec3( 0 ).toVar();

    	If( m.equal( 0 ), () => {

    		rough.assign( .22 );
    		envK.assign( .75 );

    	} ).ElseIf( m.equal( 1 ), () => {

    		alb.mulAssign( .12 );
    		rough.assign( .04 );
    		envK.assign( 1.1 );

    	} ).ElseIf( m.equal( 2 ), () => {

    		rough.assign( .85 );

    	} ).ElseIf( m.equal( 3 ), () => {

    		rough.assign( .14 );
    		metal.assign( 1. );
    		envK.assign( 1. );

    	} ).ElseIf( m.equal( 4 ), () => {

    		emi.assign( vCol.mul( add( .2, uM.x.mul( 1.7 ) ) ) );
    		alb.mulAssign( .2 );

    	} ).ElseIf( m.equal( 5 ), () => {

    		const b = max( uM.y, vIns.x ).toVar();
    		emi.assign( vCol.mul( add( .7, b.mul( 2.6 ) ) ) );
    		alb.mulAssign( .2 );

    	} ).ElseIf( m.equal( 6 ), () => {

    		rough.assign( .92 );
    		alb.mulAssign( .5 );

    	} ).ElseIf( m.equal( 7 ), () => {

    		rough.assign( .3 );
    		metal.assign( 1. );
    		envK.assign( .6 );

    	} ).ElseIf( m.equal( 8 ), () => {

    		emi.assign( vCol.mul( 2.4 ).mul( uM.z ).mul( add( .9, mul( .1, sin( uTime.mul( 2.3 ).add( vIns.y.mul( 9. ) ) ) ) ) ) );
    		alb.mulAssign( .1 );

    	} ).ElseIf( m.equal( 9 ), () => {

    		emi.assign( vCol.mul( step( .5, fract( uTime.mul( 1.3 ).add( vIns.y ) ) ) ).mul( 2.6 ) );

    	} ).ElseIf( m.equal( 10 ), () => {

    		rough.assign( .5 );

    	} ).ElseIf( m.equal( 11 ), () => {

    		emi.assign( vCol.mul( 1.1 ).mul( uM.z ) );
    		alb.mulAssign( .3 );

    	} ).ElseIf( m.greaterThanEqual( 12 ).and( m.lessThanEqual( 14 ) ), () => {

    		const on = select( abs( vIns.x.sub( float( m.sub( 12 ) ) ) ).lessThan( .5 ), 1., 0. ).toVar();
    		emi.assign( vCol.mul( add( .04, on.mul( 3.4 ) ) ) );
    		alb.mulAssign( .15 );

    	} ).ElseIf( m.equal( 15 ), () => {

    		rough.assign( .5 );
    		metal.assign( .8 );
    		envK.assign( .3 );

    	} ).ElseIf( m.equal( 16 ), () => {

    		emi.assign( vCol.mul( uLampOn ).mul( 1.6 ) );
    		alb.assign( vec3( .03 ) );
    		rough.assign( .08 );
    		envK.assign( 1. );

    	} );

    	alb.assign( mix( alb, vec3( .025, .022, .02 ), uM.w ) );
    	rough.assign( mix( rough, .95, uM.w ) );
    	metal.mulAssign( sub( 1., uM.w ) );
    	envK.mulAssign( sub( 1., uM.w ) );
    	emi.mulAssign( sub( 1., uM.w ) );
    	const wet = uWet.mul( smoothstep( .55, .95, n.y ) ).mul( sub( 1., step( 4., float( m ) ).mul( step( float( m ), 9. ) ) ) ).toVar();
    	wet.assign( 0. );
    	rough.assign( mix( rough, rough.mul( .35 ), wet ) );
    	alb.mulAssign( sub( 1., mul( .3, wet ) ) );
    	const c = shade( vW, n, v, alb, rough, metal ).toVar();

    	If( envK.greaterThan( 0. ).or( wet.greaterThan( .1 ) ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		c.addAssign( envMapS( r, 1. ).mul( max( envK, wet.mul( .5 ) ) ).mul( mix( select( m.equal( 0 ), max( F, .1 ), F ), 1., metal ) ).mul( sub( 1., rough.mul( .9 ) ) ) );

    	} );

    	c.addAssign( emi );
    	const fd = length( vW.sub( uCam ) ).toVar();
    	fragOut_.assign( vec4( applyFog( c, uCam.add( vW.sub( uCam ).mul( select( fd.greaterThan( FARD ), FARD.add( fd.sub( FARD ).mul( farK( FAR ) ) ).div( fd ), 1. ) ) ) ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{\"FAR\":\"*\"}": {
  h: "llsbyqc9q", fog: true, lib: "[[\"FAR\",\"*\"]]NL_T,NOCC_T,SH_N_T,VOL_N_T,FAR", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAHMap","type":"sampler2D","src":"uAHMap"},{"name":"uAHM","type":"vec4","src":"uAHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec3","src":"vCol"},{"name":"vMat","type":"float","src":"vMat"},{"name":"vIns","type":"vec4","src":"vIns"}],
  attributes: [{"name":"color","type":"vec3","src":"color"},{"name":"aMat","type":"float","src":"aMat"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, vW, vN, vCol, vMat, vIns, color, aMat, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const lp = vec4( position, 1. ).toVar();
    	const nn = normal.toVar();
    	const w = modelMatrix.mul( lp ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( nn ) ) );
    	vCol.assign( color );
    	vMat.assign( aMat );
    	vIns.assign( vec4( 0 ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, int, float, vec3, add, sin, abs, select, mix, reflect, pow, floor, fwidth, exp, Fn } = TSL;
    const { uM, vW, vN, vCol, vMat, vIns, color, aMat, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	const n = normalize( vN ).toVar();
    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const m = int( vMat.add( .5 ) ).toVar();
    	const alb = vCol.toVar();
    	const rough = float( .7 ).toVar(), metal = float( 0. ).toVar(), envK = float( 0. ).toVar();
    	const emi = vec3( 0 ).toVar();
    	const wA = float( 0. ).toVar();   // 材質 20（機場柏油）自己的濕度：這個變體其他材質一律不濕（客機、地勤車也走 MAT.far）

    	If( m.equal( 0 ), () => {

    		rough.assign( .22 );
    		envK.assign( .75 );

    	} ).ElseIf( m.equal( 1 ), () => {

    		alb.mulAssign( .12 );
    		rough.assign( .04 );
    		envK.assign( 1.1 );

    	} ).ElseIf( m.equal( 2 ), () => {

    		rough.assign( .85 );

    	} ).ElseIf( m.equal( 3 ), () => {

    		rough.assign( .14 );
    		metal.assign( 1. );
    		envK.assign( 1. );

    	} ).ElseIf( m.equal( 4 ), () => {

    		emi.assign( vCol.mul( add( .2, uM.x.mul( 1.7 ) ) ) );
    		alb.mulAssign( .2 );

    	} ).ElseIf( m.equal( 5 ), () => {

    		const b = max( uM.y, vIns.x ).toVar();
    		emi.assign( vCol.mul( add( .7, b.mul( 2.6 ) ) ) );
    		alb.mulAssign( .2 );

    	} ).ElseIf( m.equal( 6 ), () => {

    		rough.assign( .92 );
    		alb.mulAssign( .5 );

    	} ).ElseIf( m.equal( 7 ), () => {

    		rough.assign( .3 );
    		metal.assign( 1. );
    		envK.assign( .6 );

    	} ).ElseIf( m.equal( 8 ), () => {

    		emi.assign( vCol.mul( 2.4 ).mul( uM.z ).mul( add( .9, mul( .1, sin( uTime.mul( 2.3 ).add( vIns.y.mul( 9. ) ) ) ) ) ) );
    		alb.mulAssign( .1 );

    	} ).ElseIf( m.equal( 9 ), () => {

    		emi.assign( vCol.mul( step( .5, fract( uTime.mul( 1.3 ).add( vIns.y ) ) ) ).mul( 2.6 ) );

    	} ).ElseIf( m.equal( 10 ), () => {

    		rough.assign( .5 );

    	} ).ElseIf( m.equal( 11 ), () => {

    		emi.assign( vCol.mul( 1.1 ).mul( uM.z ) );
    		alb.mulAssign( .3 );

    	} ).ElseIf( m.greaterThanEqual( 12 ).and( m.lessThanEqual( 14 ) ), () => {

    		const on = select( abs( vIns.x.sub( float( m.sub( 12 ) ) ) ).lessThan( .5 ), 1., 0. ).toVar();
    		emi.assign( vCol.mul( add( .04, on.mul( 3.4 ) ) ) );
    		alb.mulAssign( .15 );

    	} ).ElseIf( m.equal( 20 ), () => {

    		// 機場的柏油（21-air.js：跑道、平行滑行道、連絡道、快速脫離滑行道、跑道頭的防爆區，和疊在上面的橡膠擦痕與補縫）：雨天變濕（wA），
    		// 主輪軌跡與鋪面的凹處積水（SEA_FR 座標的雜訊，沿跑道方向拉長），下雨時積水上有漣漪；水面是低粗糙度＋環境反射，跑道燈在 shade 裡有銳利的反光。
    		// 漣漪比像素小時淡掉（遠處不閃）
    		const hs = ( c ) => { const t = fract( vec3( c.x, c.y, c.x ).mul( .1031 ) ).toVar(); t.addAssign( dot( t, t.yzx.add( 33.33 ) ) ); return fract( t.x.add( t.y ).mul( t.z ) ); };
    		const vn = ( p ) => { const i = floor( p ).toVar(), f = fract( p ).toVar(), w = f.mul( f ).mul( sub( 3., f.mul( 2. ) ) ).toVar();
    			return mix( mix( hs( i ), hs( i.add( vec2( 1., 0. ) ) ), w.x ), mix( hs( i.add( vec2( 0., 1. ) ) ), hs( i.add( vec2( 1., 1. ) ) ), w.x ), w.y ); };
    		const q = vW.xz.sub( uAirA.xy ).toVar();
    		const p = vec2( dot( q, uAirA.zw ), q.x.mul( uAirA.w ).sub( q.y.mul( uAirA.z ) ) ).add( 4000. ).toVar();
    		const pm = vn( p.mul( vec2( .045, .2 ) ) ).mul( .62 ).add( vn( p.mul( .55 ) ).mul( .38 ) ).toVar();
    		const pud = smoothstep( .58, .72, pm.add( vn( p.mul( 3.1 ) ).sub( .5 ).mul( .1 ) ) ).mul( smoothstep( .15, .7, uWet ) ).toVar();   // 邊緣用細的雜訊打散，水膜慢慢變厚
    		const rp = vec2( 0. ).toVar();
    		for ( const k of [ 0, 1 ] ) {   // 兩層錯開的格子，每格一圈往外擴的水紋（照 uRain 決定有幾格在下）
    			const qq = p.mul( 1.6 ).add( vec2( .37 * k, .71 * k ) ).toVar();
    			const ci = floor( qq ).toVar(), cf = fract( qq ).sub( .5 ).toVar();
    			const h = hs( ci.add( 13. * k ) ).toVar();
    			const off = vec2( hs( ci.add( 3.1 ) ), hs( ci.add( 7.7 ) ) ).sub( .5 ).mul( .5 ).toVar();
    			const tt = fract( uTime.mul( 1.2 ).add( h ) ).toVar();
    			const d = cf.sub( off ).toVar(), r = length( d ).toVar();
    			rp.addAssign( d.div( max( r, 1e-3 ) ).mul( exp( pow( r.sub( tt.mul( .42 ) ).mul( 28. ), 2. ).negate() ).mul( sub( 1., tt ) ).mul( step( h, uRain ) ) ) );
    		}
    		const fw = max( fwidth( p.x ), fwidth( p.y ) ).toVar();
    		rp.mulAssign( pud.mul( uRain ).mul( sub( 1., smoothstep( .05, .2, fw ) ) ).mul( .35 ) );
    		n.assign( normalize( n.sub( vec3( rp.x.mul( uAirA.z ).add( rp.y.mul( uAirA.w ) ), 0., rp.x.mul( uAirA.w ).sub( rp.y.mul( uAirA.z ) ) ) ) ) );
    		alb.mulAssign( mix( 1., .55, pud ) );
    		rough.assign( mix( .85, .05, pud ) );
    		envK.assign( pud.mul( pud ).mul( .75 ) );
    		wA.assign( uWet );

    	} ).ElseIf( m.equal( 15 ), () => {

    		rough.assign( .5 );
    		metal.assign( .8 );
    		envK.assign( .3 );

    	} ).ElseIf( m.equal( 16 ), () => {

    		emi.assign( vCol.mul( uLampOn ).mul( 1.6 ) );
    		alb.assign( vec3( .03 ) );
    		rough.assign( .08 );
    		envK.assign( 1. );

    	} ).ElseIf( m.equal( 17 ), () => {

    		// 機場停車場的停車格線（21-air.js 的 lot）：沿 SEA_FR x 每 3 m 一條 14 cm 的白線（uAirA = 島中心、SEA_FR x 軸的世界方向）。
    		// 線的覆蓋照像素的足跡做盒狀濾波（週期脈衝的積分相減），遠處淡成平均的灰，不會像薄方塊那樣變成點陣
    		const lx = dot( vW.xz.sub( uAirA.xy ), uAirA.zw ).toVar();
    		const fw = max( fwidth( lx ), .002 ).toVar();
    		const xa = lx.sub( fw.mul( .5 ) ).div( 3. ).toVar(), xb = lx.add( fw.mul( .5 ) ).div( 3. ).toVar();
    		const ia = floor( xa ).mul( .14 ).add( clamp( fract( xa ).mul( 3. ), 0., .14 ) ), ib = floor( xb ).mul( .14 ).add( clamp( fract( xb ).mul( 3. ), 0., .14 ) );
    		const cov = clamp( ib.sub( ia ).div( fw ), 0., 1. ).toVar();
    		alb.assign( mix( alb, vec3( .74, .73, .7 ), cov.mul( .88 ) ) );
    		rough.assign( .85 );

    	} ).ElseIf( m.equal( 18 ), () => {

    		// 機場圍籬的鐵絲網（21-air.js 的 fence）：網面是一片薄板，菱形網目（10 cm、鐵絲 1.2 cm）照像素足跡做盒狀濾波得到覆蓋率，
    		// 用螢幕上的抖動丟掉沒蓋到的像素；網目比像素小時覆蓋率淡到 0（遠處只剩柱子與橫管，不會變成一片雜點）
    		const u = vW.x.mul( n.z ).sub( vW.z.mul( n.x ) ).toVar();
    		const ga = u.add( vW.y ).div( .1 ).add( .085 ).toVar(), gb = u.sub( vW.y ).div( .1 ).add( .085 ).toVar();
    		const fa = max( fwidth( ga ), .001 ).toVar(), fb = max( fwidth( gb ), .001 ).toVar();
    		const ia0 = ga.sub( fa.mul( .5 ) ).toVar(), ia1 = ga.add( fa.mul( .5 ) ).toVar(), ib0 = gb.sub( fb.mul( .5 ) ).toVar(), ib1 = gb.add( fb.mul( .5 ) ).toVar();
    		const ca = floor( ia1 ).mul( .17 ).add( clamp( fract( ia1 ), 0., .17 ) ).sub( floor( ia0 ).mul( .17 ).add( clamp( fract( ia0 ), 0., .17 ) ) ).div( fa ).toVar();
    		const cb = floor( ib1 ).mul( .17 ).add( clamp( fract( ib1 ), 0., .17 ) ).sub( floor( ib0 ).mul( .17 ).add( clamp( fract( ib0 ), 0., .17 ) ) ).div( fb ).toVar();
    		const cv = sub( 1., sub( 1., clamp( ca, 0., 1. ) ).mul( sub( 1., clamp( cb, 0., 1. ) ) ) ).mul( sub( 1., smoothstep( .2, .4, max( fa, fb ) ) ) ).toVar();

    		If( fract( mul( 52.9829189, fract( dot( fragCoord_.xy, vec2( .06711056, .00583715 ) ) ) ) ).greaterThanEqual( cv ), () => {

    			Discard();

    		} );

    		rough.assign( .45 );
    		metal.assign( .7 );
    		envK.assign( .3 );

    	} ).ElseIf( m.equal( 19 ), () => {

    		// 機場的漆線（21-air.js 的 M、快速脫離滑行道的引導線與等候線）：沿跑道方向拉長的大片磨損，加上細碎的掉漆（掉漆處透出底下的柏油）。
    		// 座標是島中心起算、轉到 SEA_FR 軸向（uAirA）；細碎掉漆的格子比像素小時改用平均覆蓋率，遠看是均勻變暗，不會閃
    		const hs = ( c ) => { const t = fract( vec3( c.x, c.y, c.x ).mul( .1031 ) ).toVar(); t.addAssign( dot( t, t.yzx.add( 33.33 ) ) ); return fract( t.x.add( t.y ).mul( t.z ) ); };
    		const vn = ( p ) => { const i = floor( p ).toVar(), f = fract( p ).toVar(), w = f.mul( f ).mul( sub( 3., f.mul( 2. ) ) ).toVar();
    			return mix( mix( hs( i ), hs( i.add( vec2( 1., 0. ) ) ), w.x ), mix( hs( i.add( vec2( 0., 1. ) ) ), hs( i.add( vec2( 1., 1. ) ) ), w.x ), w.y ); };
    		const q = vW.xz.sub( uAirA.xy ).toVar();
    		const p = vec2( dot( q, uAirA.zw ), q.x.mul( uAirA.w ).sub( q.y.mul( uAirA.z ) ) ).add( 4000. ).toVar();
    		const big = vn( p.mul( vec2( .045, .32 ) ) ).toVar();
    		const wear = smoothstep( .3, .85, big ).mul( .55 ).add( .12 ).toVar();
    		const fine = vn( p.mul( 5.3 ) ).mul( .6 ).add( vn( p.mul( 14.1 ) ).mul( .4 ) ).toVar();
    		const thr = sub( .7, wear.mul( .45 ) ).toVar();
    		const fw = max( fwidth( p.x ), fwidth( p.y ) ).toVar();
    		const chip = mix( smoothstep( thr.sub( .03 ), thr.add( .03 ), fine ), wear.mul( .8 ), smoothstep( .03, .18, fw ) ).toVar();
    		alb.assign( mix( alb.mul( sub( 1., big.mul( .16 ) ) ), vec3( .024, .025, .028 ), chip ) );
    		rough.assign( .8 );
    		// 反光玻璃珠：光從視線方向來時反射回去（回歸反射）。把視線當法線丟給 pointLights，鏡面那一欄就是「光的方向貼近視線」的窄瓣（shin 60），
    		// 只算還有漆的地方；從車上開頭燈看，前方的標線會亮起來，其他角度看不出差別
    		const pb = pointLights( vW, v, v, 60. ).toVar();
    		emi.addAssign( pb[ 1 ].mul( vCol ).mul( sub( 1., chip ) ).mul( .35 ) );
    		wA.assign( uWet.mul( .7 ) );   // 漆面也會濕（比柏油少一點），不然雨天標線比旁邊暗

    	} );

    	alb.assign( mix( alb, vec3( .025, .022, .02 ), uM.w ) );
    	rough.assign( mix( rough, .95, uM.w ) );
    	metal.mulAssign( sub( 1., uM.w ) );
    	envK.mulAssign( sub( 1., uM.w ) );
    	emi.mulAssign( sub( 1., uM.w ) );
    	const wet = uWet.mul( smoothstep( .55, .95, n.y ) ).mul( sub( 1., step( 4., float( m ) ).mul( step( float( m ), 9. ) ) ) ).toVar();
    	wet.assign( wA );
    	rough.assign( mix( rough, rough.mul( .35 ), wet ) );
    	alb.mulAssign( sub( 1., mul( .3, wet ) ) );
    	const c = shade( vW, n, v, alb, rough, metal ).toVar();

    	If( envK.greaterThan( 0. ).or( wet.greaterThan( .1 ) ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		c.addAssign( envMapS( r, 1. ).mul( max( envK, wet.mul( .28 ) ) ).mul( mix( select( m.equal( 0 ), max( F, .1 ), F ), 1., metal ) ).mul( sub( 1., rough.mul( .9 ) ) ) );

    	} );

    	c.addAssign( emi );
    	fragOut_.assign( vec4( applyFog( c, uCam.add( vW.sub( uCam ).mul( farK( FAR ) ) ) ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{}": {
  h: "ey6hzzc9h", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAHMap","type":"sampler2D","src":"uAHMap"},{"name":"uAHM","type":"vec4","src":"uAHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec3","src":"vCol"},{"name":"vMat","type":"float","src":"vMat"},{"name":"vIns","type":"vec4","src":"vIns"}],
  attributes: [{"name":"color","type":"vec3","src":"color"},{"name":"aMat","type":"float","src":"aMat"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, vW, vN, vCol, vMat, vIns, color, aMat, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const lp = vec4( position, 1. ).toVar();
    	const nn = normal.toVar();
    	const w = modelMatrix.mul( lp ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( nn ) ) );
    	vCol.assign( color );
    	vMat.assign( aMat );
    	vIns.assign( vec4( 0 ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, int, float, vec3, add, sin, abs, select, mix, reflect, pow, Fn } = TSL;
    const { uM, vW, vN, vCol, vMat, vIns, color, aMat, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	const n = normalize( vN ).toVar();
    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const m = int( vMat.add( .5 ) ).toVar();
    	const alb = vCol.toVar();
    	const rough = float( .7 ).toVar(), metal = float( 0. ).toVar(), envK = float( 0. ).toVar();
    	const emi = vec3( 0 ).toVar();

    	If( m.equal( 0 ), () => {

    		rough.assign( .22 );
    		envK.assign( .75 );

    	} ).ElseIf( m.equal( 1 ), () => {

    		alb.mulAssign( .12 );
    		rough.assign( .04 );
    		envK.assign( 1.1 );

    	} ).ElseIf( m.equal( 2 ), () => {

    		rough.assign( .85 );

    	} ).ElseIf( m.equal( 3 ), () => {

    		rough.assign( .14 );
    		metal.assign( 1. );
    		envK.assign( 1. );

    	} ).ElseIf( m.equal( 4 ), () => {

    		emi.assign( vCol.mul( add( .2, uM.x.mul( 1.7 ) ) ) );
    		alb.mulAssign( .2 );

    	} ).ElseIf( m.equal( 5 ), () => {

    		const b = max( uM.y, vIns.x ).toVar();
    		emi.assign( vCol.mul( add( .7, b.mul( 2.6 ) ) ) );
    		alb.mulAssign( .2 );

    	} ).ElseIf( m.equal( 6 ), () => {

    		rough.assign( .92 );
    		alb.mulAssign( .5 );

    	} ).ElseIf( m.equal( 7 ), () => {

    		rough.assign( .3 );
    		metal.assign( 1. );
    		envK.assign( .6 );

    	} ).ElseIf( m.equal( 8 ), () => {

    		emi.assign( vCol.mul( 2.4 ).mul( uM.z ).mul( add( .9, mul( .1, sin( uTime.mul( 2.3 ).add( vIns.y.mul( 9. ) ) ) ) ) ) );
    		alb.mulAssign( .1 );

    	} ).ElseIf( m.equal( 9 ), () => {

    		emi.assign( vCol.mul( step( .5, fract( uTime.mul( 1.3 ).add( vIns.y ) ) ) ).mul( 2.6 ) );

    	} ).ElseIf( m.equal( 10 ), () => {

    		rough.assign( .5 );

    	} ).ElseIf( m.equal( 11 ), () => {

    		emi.assign( vCol.mul( 1.1 ).mul( uM.z ) );
    		alb.mulAssign( .3 );

    	} ).ElseIf( m.greaterThanEqual( 12 ).and( m.lessThanEqual( 14 ) ), () => {

    		const on = select( abs( vIns.x.sub( float( m.sub( 12 ) ) ) ).lessThan( .5 ), 1., 0. ).toVar();
    		emi.assign( vCol.mul( add( .04, on.mul( 3.4 ) ) ) );
    		alb.mulAssign( .15 );

    	} ).ElseIf( m.equal( 15 ), () => {

    		rough.assign( .5 );
    		metal.assign( .8 );
    		envK.assign( .3 );

    	} ).ElseIf( m.equal( 16 ), () => {

    		emi.assign( vCol.mul( uLampOn ).mul( 1.6 ) );
    		alb.assign( vec3( .03 ) );
    		rough.assign( .08 );
    		envK.assign( 1. );

    	} );

    	alb.assign( mix( alb, vec3( .025, .022, .02 ), uM.w ) );
    	rough.assign( mix( rough, .95, uM.w ) );
    	metal.mulAssign( sub( 1., uM.w ) );
    	envK.mulAssign( sub( 1., uM.w ) );
    	emi.mulAssign( sub( 1., uM.w ) );
    	const wet = uWet.mul( smoothstep( .55, .95, n.y ) ).mul( sub( 1., step( 4., float( m ) ).mul( step( float( m ), 9. ) ) ) ).toVar();
    	rough.assign( mix( rough, rough.mul( .35 ), wet ) );
    	alb.mulAssign( sub( 1., mul( .3, wet ) ) );
    	const c = shade( vW, n, v, alb, rough, metal ).toVar();

    	If( envK.greaterThan( 0. ).or( wet.greaterThan( .1 ) ), () => {

    		const r = reflect( v.negate(), n ).toVar();
    		const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		c.addAssign( envMapS( r, 1. ).mul( max( envK, wet.mul( .5 ) ) ).mul( mix( select( m.equal( 0 ), max( F, .1 ), F ), 1., metal ) ).mul( sub( 1., rough.mul( .9 ) ) ) );

    	} );

    	c.addAssign( emi );
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
