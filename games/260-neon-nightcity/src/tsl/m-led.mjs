// 自動產生（node tools/gen-tsl.mjs），不要手改：改 GLSL 之後重跑產生器
// 材質 "led"：鍵是 defines 的形狀（有值的寫成 *），h 是產生時 GLSL 的雜湊
export default {
"{}": {
  h: "17v0ypma2j", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"}],
  attributes: [],
  vertex: (TSL, E) => {
    const { vec4, Fn } = TSL;
    const { vW, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec3, fract, abs, clamp, Fn, vec4, vec2, floor, mod, property, add, length, smoothstep, step, If, exp, mul, normalize } = TSL;
    const { vW, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const hue =  Fn( ( [ h ] ) => {

    	return clamp( abs( fract( h.add( vec3( 0., .33, .67 ) ) ).mul( 6. ).sub( 3. ) ).sub( 1. ), 0., 1. );

    }, { h: 'float', return: 'vec3' } );

    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();
    	const q = vW.xz.sub( vec2( -6, 13. ) ).toVar();
    	const g = floor( q ).toVar(), f = fract( q ).toVar();
    	const b = uBeat.toVar();
    	const bar = floor( b.div( 8. ) ).toVar();
    	const pat = mod( bar, 4. ).toVar();
    	const c = g.sub( 5.5 ).toVar();
    	const on = property( 'float' );
    	const h = property( 'float' );

    	If( pat.lessThan( 1. ), () => {

    		on.assign( mod( g.x.add( g.y ).add( floor( b ) ), 2. ) );
    		h.assign( add( .9, floor( b ).mul( .07 ) ) );

    	} ).ElseIf( pat.lessThan( 2. ), () => {

    		const r = length( c ).toVar();
    		on.assign( smoothstep( 1.2, 0., abs( fract( r.mul( .25 ).sub( b.mul( .5 ) ) ).sub( .5 ) ).mul( 4. ) ) );
    		h.assign( r.mul( .05 ).add( b.mul( .02 ) ) );

    	} ).ElseIf( pat.lessThan( 3. ), () => {

    		on.assign( step( .5, fract( g.x.sub( g.y ).mul( .125 ).add( b.mul( .25 ) ) ) ) );
    		h.assign( add( .55, g.x.mul( .03 ) ) );

    	} ).Else( () => {

    		on.assign( step( .72, h21( g.add( floor( b ).mul( 7. ) ) ) ) );
    		h.assign( h21( g.add( floor( b ) ) ) );

    	} );

    	const edge = smoothstep( .0, .06, f.x ).mul( smoothstep( 1., .94, f.x ) ).mul( smoothstep( .0, .06, f.y ) ).mul( smoothstep( 1., .94, f.y ) ).toVar();
    	const pulse = add( .55, mul( .45, exp( fract( b ).negate().mul( 4. ) ) ) ).toVar();
    	const col = hue( h ).mul( on ).mul( edge ).mul( 1.6 ).mul( pulse ).add( vec3( .01 ) ).toVar();
    	const v = normalize( uCam.sub( vW ) ).toVar();
    	col.addAssign( shade( vW, vec3( 0., 1., 0. ), v, vec3( .02 ), .15, 0. ) );
    	fragOut_.assign( vec4( applyFog( col, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
