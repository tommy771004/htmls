// 自動產生（node tools/gen-tsl.mjs），不要手改：改 GLSL 之後重跑產生器
// 材質 "char"：鍵是 defines 的形狀（有值的寫成 *），h 是產生時 GLSL 的雜湊
export default {
"{\"SCAN\":\"*\"}": {
  h: "lg6f0hjm8", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: true, libF: true,
  uniforms: [{"name":"uC","type":"vec3","size":9,"src":"uC"},{"name":"uGlow","type":"vec4","src":"uGlow"},{"name":"uPat","type":"vec4","src":"uPat"},{"name":"uPatC","type":"vec3","src":"uPatC"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec3","src":"vCol"},{"name":"vEmi","type":"vec3","src":"vEmi"},{"name":"vP","type":"vec3","src":"vP"},{"name":"vTop","type":"float","src":"vTop"},{"name":"vUv","type":"vec2","src":"vUv"}],
  attributes: [{"name":"aSlot","type":"float","src":"aSlot"},{"name":"aPat","type":"vec3","src":"aPat"}],
  vertex: (TSL, E) => {
    const { vec4, int, mat3, normalize, vec3, select, Fn } = TSL;
    const { uC, uGlow, uPat, uPatC, uMap, vW, vN, vCol, vEmi, vP, vTop, vUv, aSlot, aPat, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, SCAN, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	vUv.assign( uv );
    	const objectNormal = normal.toVar(), transformed = position.toVar();
    	const s = int( aSlot.add( .5 ) ).toVar();
    	const w = modelMatrix.mul( vec4( transformed, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( objectNormal ) ) );
    	vCol.assign( uC.element( s ) );
    	vEmi.assign( select( s.equal( 5 ), uGlow.rgb.mul( uGlow.w ).mul( .3 ), vec3( 0. ) ) );
    	vP.assign( aPat );
    	vTop.assign( select( s.equal( 1 ).or( s.equal( 2 ).and( uPat.w.greaterThan( .5 ) ) ), 1., 0. ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, normalize, property, fract, step, max, abs, mix, dot, sub, pow, Fn } = TSL;
    const { uC, uGlow, uPat, uPatC, uMap, vW, vN, vCol, vEmi, vP, vTop, vUv, aSlot, aPat, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, SCAN, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();

    	If( vW.y.lessThan( uClipY ), () => {

    		Discard();

    	} );

    	const n = normalize( vN ).toVar(), v = normalize( uCam.sub( vW ) ).toVar(), col = vCol.toVar();
    	col.assign( uMap.sample( vUv ).rgb );

    	If( vTop.greaterThan( .5 ).and( uPat.x.greaterThan( .5 ) ), () => {

    		const f = uPat.y.toVar(), m = property( 'float' );

    		If( uPat.x.lessThan( 1.5 ), () => {

    			m.assign( step( .55, fract( vP.x.mul( f ) ) ) );

    		} ).ElseIf( uPat.x.lessThan( 2.5 ), () => {

    			m.assign( max( step( .8, fract( vP.x.mul( f ) ) ), max( step( .8, fract( vP.y.mul( f ) ) ), step( .8, fract( vP.z.mul( f ) ) ) ) ) );

    		} ).ElseIf( uPat.x.lessThan( 3.5 ), () => {

    			m.assign( step( abs( vP.x.sub( 1.27 ) ), .06 ) );

    		} ).Else( () => {

    			m.assign( step( 1.36, vP.x ) );

    		} );

    		col.assign( mix( col, uPatC, m.mul( uPat.z ) ) );

    	} );

    	const c = shade( vW, n, v, col, .65, 0. ).toVar();
    	c.addAssign( col.mul( pow( sub( 1., max( dot( n, v ), 0. ) ), 3. ) ).mul( uFogHi.mul( sub( 1.5, uDay.mul( 1.2 ) ) ).add( .02 ) ) );
    	c.addAssign( vEmi );
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{}": {
  h: "jsuxewjly", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: true, libF: true,
  uniforms: [{"name":"uC","type":"vec3","size":9,"src":"uC"},{"name":"uGlow","type":"vec4","src":"uGlow"},{"name":"uPat","type":"vec4","src":"uPat"},{"name":"uPatC","type":"vec3","src":"uPatC"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec3","src":"vCol"},{"name":"vEmi","type":"vec3","src":"vEmi"},{"name":"vP","type":"vec3","src":"vP"},{"name":"vTop","type":"float","src":"vTop"}],
  attributes: [{"name":"aSlot","type":"float","src":"aSlot"},{"name":"aPat","type":"vec3","src":"aPat"}],
  vertex: (TSL, E) => {
    const { vec4, int, mat3, normalize, vec3, select, Fn } = TSL;
    const { uC, uGlow, uPat, uPatC, vW, vN, vCol, vEmi, vP, vTop, aSlot, aPat, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const objectNormal = normal.toVar(), transformed = position.toVar();
    	const s = int( aSlot.add( .5 ) ).toVar();
    	const w = modelMatrix.mul( vec4( transformed, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( objectNormal ) ) );
    	vCol.assign( uC.element( s ) );
    	vEmi.assign( select( s.equal( 5 ), uGlow.rgb.mul( uGlow.w ).mul( .3 ), vec3( 0. ) ) );
    	vP.assign( aPat );
    	vTop.assign( select( s.equal( 1 ).or( s.equal( 2 ).and( uPat.w.greaterThan( .5 ) ) ), 1., 0. ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, Discard, If, normalize, property, fract, step, max, abs, mix, dot, sub, pow, Fn } = TSL;
    const { uC, uGlow, uPat, uPatC, vW, vN, vCol, vEmi, vP, vTop, aSlot, aPat, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();

    	If( vW.y.lessThan( uClipY ), () => {

    		Discard();

    	} );

    	const n = normalize( vN ).toVar(), v = normalize( uCam.sub( vW ) ).toVar(), col = vCol.toVar();

    	If( vTop.greaterThan( .5 ).and( uPat.x.greaterThan( .5 ) ), () => {

    		const f = uPat.y.toVar(), m = property( 'float' );

    		If( uPat.x.lessThan( 1.5 ), () => {

    			m.assign( step( .55, fract( vP.x.mul( f ) ) ) );

    		} ).ElseIf( uPat.x.lessThan( 2.5 ), () => {

    			m.assign( max( step( .8, fract( vP.x.mul( f ) ) ), max( step( .8, fract( vP.y.mul( f ) ) ), step( .8, fract( vP.z.mul( f ) ) ) ) ) );

    		} ).ElseIf( uPat.x.lessThan( 3.5 ), () => {

    			m.assign( step( abs( vP.x.sub( 1.27 ) ), .06 ) );

    		} ).Else( () => {

    			m.assign( step( 1.36, vP.x ) );

    		} );

    		col.assign( mix( col, uPatC, m.mul( uPat.z ) ) );

    	} );

    	const c = shade( vW, n, v, col, .65, 0. ).toVar();
    	c.addAssign( col.mul( pow( sub( 1., max( dot( n, v ), 0. ) ), 3. ) ).mul( uFogHi.mul( sub( 1.5, uDay.mul( 1.2 ) ) ).add( .02 ) ) );
    	c.addAssign( vEmi );
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
