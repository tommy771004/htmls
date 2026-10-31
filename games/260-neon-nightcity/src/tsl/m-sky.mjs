// 材質的 TSL（原本由已刪除的 tools/gen-tsl.mjs 從 GLSL 轉出，現在是著色器的原始碼，直接改這裡）
// 材質 "sky"：鍵是 defines 的形狀（有值的寫成 *），h 是當初轉換時 GLSL 的雜湊（已不使用）
export default {
"{}": {
  h: "1624aesan7", fog: false, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vD","type":"vec3","src":"vD"}],
  attributes: [],
  vertex: (TSL, E) => {
    const { vec4, normalize, Fn } = TSL;
    const { vD, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	vD.assign( normalize( position ) );
    	const p = projectionMatrix.mul( modelViewMatrix ).mul( vec4( position, 1. ) ).toVar();
    	glPos_.assign( p.xyww );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec4, normalize, max, vec2, clamp, sub, smoothstep, mix, mul, add, vec3, atan, asin, floor, pow, fract, length, sin, dot, step, If, Fn } = TSL;
    const { vD, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();
    	const d = normalize( vD ).toVar();
    	const q = d.xz.div( max( d.y.add( .08 ), .05 ) ).toVar();
    	const cl = fbm( q.mul( .5 ).add( vec2( uTime.mul( .01 ), uTime.mul( .004 ) ) ) ).toVar();
    	const cl2 = fbm( q.mul( 1.3 ).sub( vec2( uTime.mul( .015 ), 0. ) ) ).toVar();
    	const h = clamp( d.y, 0., 1. ).toVar();
    	const dens = smoothstep( sub( 1., uCloud ), sub( 1.25, uCloud.mul( .8 ) ), cl.add( cl2.mul( .45 ) ) ).toVar();
    	const glow = mix( uFogHi.mul( 2.2 ), uFogCol.mul( .6 ), smoothstep( 0., .5, h ) ).toVar();
    	const overcast = glow.mul( add( .55, mul( .7, cl ).mul( cl2 ) ) ).toVar();
    	const clear = mix( uFogHi.mul( 1.5 ), vec3( .003, .005, .012 ), smoothstep( 0., .45, h ) ).toVar();
    	const sc = vec2( atan( d.z, d.x ).mul( 140. ), asin( h ).mul( 140. ) ).toVar();
    	const hs = h21( floor( sc ) ).toVar(), star = pow( smoothstep( .9982, 1., hs ), 2. ).mul( smoothstep( .3, .06, length( fract( sc ).sub( .5 ) ) ) ).mul( add( .75, mul( .25, sin( uTime.mul( 3. ).add( h21( floor( sc ).add( 3. ) ).mul( 40. ) ) ) ) ) ).toVar();
    	clear.addAssign( vec3( .85, .88, 1. ).mul( star ).mul( 2.2 ).mul( smoothstep( .25, .75, h ) ).mul( smoothstep( -0.08, -0.22, uSun.y ) ) );
    	const md = dot( d, uMoon ).toVar();
    	clear.addAssign( vec3( 1., .96, .86 ).mul( smoothstep( .99955, .9997, md ).mul( 2.2 ).add( pow( max( md, 0. ), 80. ).mul( .12 ) ) ).mul( step( 0., uMoon.y ) ) );
    	const night = mix( clear, overcast, dens ).toVar();
    	const sd = max( dot( d, uSun ), 0. ).toVar();
    	const day = mix( uSkyHor, uSkyTop, pow( h, .55 ) ).toVar();
    	day.addAssign( uSunCol.mul( smoothstep( .99962, .9998, sd ).mul( 20. ).add( pow( sd, 14. ).mul( .22 ) ).add( pow( sd, 3. ).mul( .05 ) ) ) );
    	const cloud = uSkyHor.mul( .85 ).add( uSkyTop.mul( .2 ) ).add( uSunCol.mul( .32 ).mul( add( .6, mul( .6, cl2 ) ) ) ).mul( add( .72, mul( .4, cl2 ) ) ).toVar();
    	day.assign( mix( day, cloud, dens.mul( .96 ) ) );
    	const c = mix( night, day, uDay ).toVar();
    	c.addAssign( vec3( .75, .8, 1. ).mul( uFlash ).mul( add( .6, cl ) ).mul( 1.6 ) );

    	If( d.y.lessThan( 0. ), () => {

    		c.assign( uFogCol );

    	} );

    	fragOut_.assign( vec4( c, 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
