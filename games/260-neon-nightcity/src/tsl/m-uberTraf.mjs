// 材質的 TSL（原本由已刪除的 tools/gen-tsl.mjs 從 GLSL 轉出，現在是著色器的原始碼，直接改這裡）
// 材質 "uberTraf"：鍵是 defines 的形狀（有值的寫成 *），h 是當初轉換時 GLSL 的雜湊（已不使用）
export default {
"{\"INST_EXTRA\":\"\"}": {
  h: "apv8u3cms", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uM","type":"vec4","src":"uM"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec3","src":"vCol"},{"name":"vMat","type":"float","src":"vMat"},{"name":"vIns","type":"vec4","src":"vIns"}],
  attributes: [{"name":"color","type":"vec3","src":"color"},{"name":"aMat","type":"float","src":"aMat"},{"name":"aIns","type":"vec4","src":"aIns"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uM, vW, vN, vCol, vMat, vIns, color, aMat, aIns, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const lp = vec4( position, 1. ).toVar();
    	const nn = normal.toVar();
    	const w = modelMatrix.mul( lp ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( nn ) ) );
    	vCol.assign( color );
    	vMat.assign( aMat );
    	vIns.assign( aIns );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, dot, clamp, length, smoothstep, sub, step, max, vec2, fract, mul, normalize, int, vec3, array, float, add, sin, abs, select, mix, reflect, pow, Fn } = TSL;
    const { uM, vW, vN, vCol, vMat, vIns, color, aMat, aIns, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK } = E;




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

    	If( vIns.w.greaterThan( 0. ).and( fract( mul( 52.9829189, fract( dot( fragCoord_.xy, vec2( .06711056, .00583715 ) ) ) ) ).lessThan( vIns.w ) ), () => {

    		Discard();

    	} );

    	const m = int( vMat.add( .5 ) ).toVar();
    	const PAL = array( [ vec3( 0.1946, 0.0137, 0.0160 ), vec3( 0.0130, 0.0284, 0.0782 ), vec3( 0.1022, 0.1119, 0.1221 ), vec3( 0.0056, 0.0060, 0.0070 ), vec3( 0.6867, 0.6724, 0.6308 ), vec3( 0.0168, 0.0529, 0.0273 ), vec3( 0.0742, 0.0103, 0.0252 ), vec3( 0.4508, 0.3663, 0.2346 ), vec3( 0.0262, 0.1144, 0.1714 ), vec3( 0.1470, 0.0423, 0.0130 ) ] ).toVar();
    	const alb = vCol.toVar();
    	const rough = float( .7 ).toVar(), metal = float( 0. ).toVar(), envK = float( 0. ).toVar();
    	const emi = vec3( 0 ).toVar();

    	If( m.equal( 0 ), () => {

    		rough.assign( .22 );
    		envK.assign( .75 );

    		If( vIns.z.greaterThan( .5 ), () => {

    			alb.assign( PAL.element( int( vIns.z.sub( .5 ) ) ) );

    		} );

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
