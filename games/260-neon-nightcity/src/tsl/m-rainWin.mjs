// 自動產生（node tools/gen-tsl.mjs），不要手改：改 GLSL 之後重跑產生器
// 材質 "rainWin"：鍵是 defines 的形狀（有值的寫成 *），h 是產生時 GLSL 的雜湊
export default {
"{}": {
  h: "n10ckma56", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vW","type":"vec3","src":"vW"}],
  attributes: [],
  vertex: (TSL, E) => {
    const { vec4, Fn } = TSL;
    const { vUv, vW, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	vUv.assign( uv );
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, vec2, vec3, float, sin, add, select, length, smoothstep, mul, Loop, floor, fract, step, abs, sub, Fn } = TSL;
    const { vUv, vW, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();
    	const p = vUv.mul( vec2( 7.4, 2. ) ).toVar();
    	const c = vec3( .02, .025, .04 ).toVar();

    	Loop( 14, ( { i } ) => {

    		const fi = float( i ).toVar();
    		const bc = vec2( h11( fi.mul( 3.1 ) ).mul( 7.4 ).add( sin( uTime.mul( .1 ).add( fi ) ).mul( .3 ) ), add( .3, h11( fi.mul( 7.7 ) ).mul( 1.4 ) ) ).toVar();
    		const col = select( fi.lessThan( 5. ), vec3( 1., .5, .2 ), select( fi.lessThan( 9. ), vec3( .3, .9, 1. ), select( fi.lessThan( 12. ), vec3( 1., .25, .55 ), vec3( .9, .9, .8 ) ) ) ).toVar();
    		const r = add( .25, h11( fi ).mul( .35 ) ).toVar();
    		c.addAssign( col.mul( smoothstep( r, r.mul( .7 ), length( p.sub( bc ) ) ) ).mul( .5 ).mul( add( .8, mul( .2, sin( uTime.mul( add( 1., fi.mul( .3 ) ) ) ) ) ) ) );

    	} );

    	const g = p.mul( vec2( 9., 7. ) ).toVar();
    	const gi = floor( g ).toVar(), gf = fract( g ).sub( .5 ).toVar();
    	const drop = smoothstep( .18, .1, length( gf.sub( vec2( h21( gi ), h21( gi.add( 2. ) ) ).sub( .5 ).mul( .5 ) ) ) ).mul( step( .55, h21( gi.add( 5. ) ) ) ).toVar();
    	const s = vec2( p.x.mul( 6. ), p.y.add( uTime.mul( add( .5, h11( floor( p.x.mul( 6. ) ) ).mul( .8 ) ) ) ) ).toVar();
    	const streak = smoothstep( .08, .0, abs( fract( s.x ).sub( .5 ) ).sub( .02 ) ).mul( step( .75, h11( floor( s.x ) ) ) ).mul( smoothstep( .0, .5, fract( s.y.mul( .3 ).add( h11( floor( s.x ) ) ) ) ) ).toVar();
    	c.assign( c.mul( sub( 1., drop.mul( .4 ) ) ).add( drop.mul( c ).mul( 2.5 ) ).add( streak.mul( vec3( .12, .14, .18 ) ) ) );
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
