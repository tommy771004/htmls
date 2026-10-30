// 自動產生（node tools/gen-tsl.mjs），不要手改：改 GLSL 之後重跑產生器
// 材質 "char"：鍵是 defines 的形狀（有值的寫成 *），h 是產生時 GLSL 的雜湊
export default {
"{\"SCAN\":\"*\"}": {
  h: "1qcbmx51sr2", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: true, libF: true,
  uniforms: [{"name":"uC","type":"vec3","size":10,"src":"uC"},{"name":"uGlow","type":"vec4","src":"uGlow"},{"name":"uPat","type":"vec4","src":"uPat"},{"name":"uTrait","type":"vec4","src":"uTrait"},{"name":"uCov","type":"vec4","src":"uCov"},{"name":"uAtlas","type":"sampler2D","src":"uAtlas"},{"name":"uPatC","type":"vec3","src":"uPatC"},{"name":"uInnerC","type":"vec3","src":"uInnerC"},{"name":"uMap","type":"sampler2D","src":"uMap"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec3","src":"vCol"},{"name":"vP","type":"vec3","src":"vP"},{"name":"vWB","type":"vec3","src":"vWB"},{"name":"vWC","type":"vec3","src":"vWC"},{"name":"vSk","type":"vec3","src":"vSk"},{"name":"vWP","type":"vec4","src":"vWP"},{"name":"vWN","type":"vec3","src":"vWN"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vSlot","type":"float","src":"vSlot"}],
  attributes: [{"name":"aSlot","type":"float","src":"aSlot"},{"name":"aPat","type":"vec3","src":"aPat"},{"name":"aUnn","type":"vec3","src":"aUnn"},{"name":"aWP","type":"vec4","src":"aWP"},{"name":"aUnp","type":"vec4","src":"aUnp"},{"name":"aWA","type":"vec4","src":"aWA"},{"name":"aWB","type":"vec4","src":"aWB"},{"name":"aWC","type":"vec4","src":"aWC"},{"name":"aWN","type":"vec4","src":"aWN"}],
  vertex: (TSL, E) => {
    const { vec4, mod, max, step, floor, If, int, mat3, normalize, select, vec3, Fn } = TSL;
    const { uC, uGlow, uPat, uTrait, uCov, uAtlas, uPatC, uInnerC, uMap, vW, vN, vCol, vP, vWB, vWC, vSk, vWP, vWN, vUv, vSlot, aSlot, aPat, aUnn, aWP, aUnp, aWA, aWB, aWC, aWN, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, SCAN, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	vUv.assign( uv );
    	const objectNormal = normal.toVar(), transformed = position.toVar();
    	const cTopU = max( mod( uCov.w, 2. ), uCov.x ).toVar(), cShinU = step( 2.5, aSlot ).mul( step( aSlot, 4.5 ) ).mul( step( aPat.x, uCov.y ) ).toVar();

    	If( aUnp.w.greaterThan( .5 ).and( mod( aUnp.w, 2. ).mul( cTopU ).add( mod( floor( aUnp.w.mul( .5 ) ), 2. ).mul( max( mod( floor( uCov.w.mul( .5 ) ), 2. ), cShinU ) ) ).greaterThan( .5 ) ), () => {

    		transformed.subAssign( aUnp.xyz );
    		objectNormal.assign( aUnn );

    	} );

    	const s = int( aSlot.add( .5 ) ).toVar();
    	const w = modelMatrix.mul( vec4( transformed, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( objectNormal ) ) );
    	vCol.assign( select( s.equal( 10 ), aWA.rgb, uC.element( s ) ) );
    	vWB.assign( aWB.rgb );
    	vWC.assign( aWC.rgb );
    	vWP.assign( aWP );
    	vWN.assign( aWN.xyz );
    	vSk.assign( vec3( uC[ 0 ].r, uC[ 0 ].g, uC[ 0 ].b ) );
    	vP.assign( aPat );
    	vSlot.assign( aSlot );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { dot, clamp, length, Fn, floor, mod, select, vec2, float, min, If, mix, abs, atan, fract, step, max, mul, sub, sin, smoothstep, add, int, Loop, cos, mat2, property, vec3, sqrt, vec4, Discard, normalize, pow } = TSL;
    const { uC, uGlow, uPat, uTrait, uCov, uAtlas, uPatC, uInnerC, uMap, vW, vN, vCol, vP, vWB, vWC, vSk, vWP, vWN, vUv, vSlot, aSlot, aPat, aUnn, aWP, aUnp, aWA, aWB, aWC, aWN, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, SCAN, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const wSeg =  Fn( ( [ p, a, b, w ] ) => {

    	const pa = p.sub( a ).toVar(), ba = b.sub( a ).toVar();

    	return length( pa.sub( ba.mul( clamp( dot( pa, ba ).div( dot( ba, ba ) ), 0., 1. ) ) ) ).sub( w );

    }, { p: 'vec2', a: 'vec2', b: 'vec2', w: 'float', return: 'float' } );

    const wBit =  Fn( ( [ m, k ] ) => {

    	return mod( floor( m.div( k ) ), 2. );

    }, { m: 'float', k: 'float', return: 'float' } );

    const wDigit =  Fn( ( [ p, d, w ] ) => {

    	const m = select( d.lessThan( .5 ), 63., select( d.lessThan( 1.5 ), 6., select( d.lessThan( 2.5 ), 91., select( d.lessThan( 3.5 ), 79., select( d.lessThan( 4.5 ), 102., select( d.lessThan( 5.5 ), 109., select( d.lessThan( 6.5 ), 125., select( d.lessThan( 7.5 ), 7., select( d.lessThan( 8.5 ), 127., 111. ) ) ) ) ) ) ) ) ).toVar();
    	const A = vec2( -0.25, .5 ).toVar(), B = vec2( .25, .5 ).toVar(), C = vec2( .25, 0. ).toVar(), D = vec2( .25, -0.5 ).toVar(), E = vec2( -0.25, -0.5 ).toVar(), F = vec2( -0.25, 0. ).toVar();
    	const r = float( 9. ).toVar();

    	If( wBit( m, 1. ).greaterThan( .5 ), () => {

    		r.assign( min( r, wSeg( p, A, B, w ) ) );

    	} );

    	If( wBit( m, 2. ).greaterThan( .5 ), () => {

    		r.assign( min( r, wSeg( p, B, C, w ) ) );

    	} );

    	If( wBit( m, 4. ).greaterThan( .5 ), () => {

    		r.assign( min( r, wSeg( p, C, D, w ) ) );

    	} );

    	If( wBit( m, 8. ).greaterThan( .5 ), () => {

    		r.assign( min( r, wSeg( p, D, E, w ) ) );

    	} );

    	If( wBit( m, 16. ).greaterThan( .5 ), () => {

    		r.assign( min( r, wSeg( p, E, F, w ) ) );

    	} );

    	If( wBit( m, 32. ).greaterThan( .5 ), () => {

    		r.assign( min( r, wSeg( p, F, A, w ) ) );

    	} );

    	If( wBit( m, 64. ).greaterThan( .5 ), () => {

    		r.assign( min( r, wSeg( p, F, C, w ) ) );

    	} );

    	return r;

    }, { p: 'vec2', d: 'float', w: 'float', return: 'float' } );

    const legA =  Fn( ( [ P ] ) => {

    	const h = P.x.toVar(), ly = select( h.lessThan( .42 ), mix( .09, .077, clamp( h.sub( .1 ).div( .32 ), 0., 1. ) ), select( h.lessThan( .54 ), mix( .077, .045, h.sub( .42 ).div( .12 ) ), mix( .045, .02, clamp( h.sub( .54 ).div( .35 ), 0., 1. ) ) ) ).toVar();

    	return atan( P.z.sub( uCov.z ).add( ly ), abs( P.y ).sub( .11 ) );

    }, { P: 'vec3', return: 'float' } );

    const wearTile =  Fn( ( [ pt, q, col_immutable ] ) => {

    	const col = col_immutable.toVar();

    	If( pt.equal( 7 ), () => {

    		const g = fract( q.mul( vWP.y ) ).toVar();
    		const bu = step( .68, g.x ).toVar(), bh = step( .68, g.y ).toVar();
    		col.assign( mix( col, vWB, bu.add( bh ).mul( .42 ) ) );
    		col.assign( mix( col, vWC, max( step( abs( g.x.sub( .34 ) ), .025 ), step( abs( g.y.sub( .34 ) ), .025 ) ).mul( .9 ) ) );
    		col.assign( mix( col, vWB.mul( .7 ), max( step( abs( g.x.sub( .84 ) ), .012 ), step( abs( g.y.sub( .84 ) ), .012 ) ).mul( .6 ) ) );

    	} );

    	If( pt.equal( 8 ), () => {

    		col.mulAssign( sub( 1., mul( .14, max( step( .86, fract( q.x.mul( 165. ) ) ), step( .86, fract( q.y.mul( 165. ) ) ) ) ) ) );

    	} );

    	If( pt.equal( 9 ), () => {

    		col.mulAssign( add( .8, mul( .2, smoothstep( -0.3, .9, sin( q.x.mul( vWP.y ).mul( 6.2832 ) ) ) ) ) );
    		col.mulAssign( add( .96, mul( .04, sin( q.y.mul( 900. ) ) ) ) );

    	} );

    	If( pt.equal( 10 ), () => {

    		col.mulAssign( add( .92, mul( .1, n2( q.mul( 420. ) ) ) ).sub( mul( .04, n2( q.mul( 60. ) ) ) ) );

    	} );

    	If( pt.equal( 11 ), () => {

    		const g = fract( q.mul( 28. ) ).sub( .5 ).toVar();
    		const sw = abs( sin( length( g ).mul( 22. ).add( atan( g.y, g.x ).mul( 2. ) ) ) ).toVar();
    		col.mulAssign( add( .78, mul( .22, smoothstep( .15, .5, sw ) ) ) );
    		col.mulAssign( add( .85, mul( .2, n2( q.mul( 18. ) ) ) ) );

    	} );

    	If( pt.equal( 12 ), () => {

    		const g = q.mul( vWP.y ).toVar(), ci = floor( g ).toVar(), cf = fract( g ).toVar();
    		const d = float( 9. ).toVar(), an = float( 0. ).toVar(), hh = float( 0. ).toVar();

    		Loop( { start: int( - 1 ), end: 1, name: 'j', condition: '<=' }, ( { j } ) => {

    			Loop( { start: int( - 1 ), end: 1, condition: '<=' }, ( { i } ) => {

    				const o = vec2( float( i ), float( j ) ).toVar();
    				const pp = o.add( .2 ).add( mul( .6, vec2( h21( ci.add( o ) ), h21( ci.add( o ).add( 7.1 ) ) ) ) ).sub( cf ).toVar();
    				const dd = length( pp.mul( vec2( 1., 1.25 ) ) ).toVar();

    				If( dd.lessThan( d ), () => {

    					d.assign( dd );
    					an.assign( atan( pp.y, pp.x ) );
    					hh.assign( h21( ci.add( o ).add( 3.3 ) ) );

    				} );

    			} );

    		} );

    		const blob = step( .15, sin( an.mul( add( 3., floor( hh.mul( 3. ) ) ) ).add( hh.mul( 6.28 ) ) ).add( mul( .25, n2( g.mul( 5. ) ) ) ) ).toVar();
    		col.assign( mix( col, col.mul( .7 ), smoothstep( .24, .2, d ) ) );
    		col.assign( mix( col, vWB, smoothstep( .2, .25, d ).mul( smoothstep( .46, .38, d ) ).mul( blob ) ) );
    		col.mulAssign( add( .9, mul( .2, n2( q.mul( 500. ) ) ) ) );

    	} );

    	If( pt.equal( 13 ), () => {

    		const g = q.mul( vWP.y ).toVar();
    		const t = fract( g.y.mul( 2. ).add( select( mod( floor( g.x ), 2. ).lessThan( 1. ), fract( g.x ), sub( 1., fract( g.x ) ) ).mul( 1.2 ) ) ).toVar();
    		col.assign( mix( col, vWB, step( .5, t ).mul( .8 ) ) );
    		col.mulAssign( add( .9, mul( .18, h21( floor( q.mul( 900. ) ) ) ) ) );

    	} );

    	If( pt.equal( 14 ), () => {

    		const g = q.mul( vWP.y ).toVar();
    		const f = sin( g.x.add( sin( g.y.mul( 1.3 ) ).mul( 2. ) ) ).mul( sin( g.y.add( sin( g.x.mul( .7 ) ).mul( 2. ) ) ) ).toVar();
    		col.assign( mix( col, vWB, smoothstep( .12, .04, abs( f ) ).mul( .85 ) ) );

    	} );

    	If( pt.equal( 15 ), () => {

    		const g = floor( q.mul( vWP.y ) ).toVar(), g2 = floor( q.mul( vWP.y ).mul( .25 ) ).toVar();
    		const h = h21( g2.add( .3 ) ).mul( .6 ).add( h21( g ).mul( .4 ) ).toVar();
    		col.assign( select( h.lessThan( .3 ), vWB, select( h.lessThan( .55 ), col, select( h.lessThan( .78 ), vWC, col.mul( .78 ) ) ) ) );

    	} );

    	If( pt.equal( 16 ), () => {

    		const g = q.mul( vWP.y ).toVar(), ci = floor( g ).toVar(), cf = fract( g ).toVar();
    		const dir = mod( ci.x.add( ci.y ), 2. ).toVar();
    		const sh = select( dir.lessThan( .5 ), sin( cf.x.mul( 3.1416 ) ), sin( cf.y.mul( 3.1416 ) ) ).toVar();
    		col.mulAssign( add( .72, mul( .32, sh ) ) );
    		col.mulAssign( add( .88, mul( .2, h21( ci.add( floor( q.y.mul( 40. ) ) ) ) ) ) );

    	} );

    	If( pt.equal( 17 ), () => {

    		const g = q.mul( vWP.y ).toVar();
    		const f = n2( g ).mul( .6 ).add( n2( g.mul( 2.3 ).add( 4. ) ).mul( .3 ) ).add( n2( g.mul( 6. ) ).mul( .1 ) ).toVar();
    		col.assign( mix( col, vWB, smoothstep( .45, .7, f ) ) );
    		col.assign( mix( col, vWB.mul( .5 ), smoothstep( .68, .85, f ) ) );

    	} );

    	If( pt.equal( 20 ), () => {

    		const g = q.mul( vWP.y ).toVar(), ci = floor( g ).toVar(), cf = fract( g ).sub( .5 ).toVar();
    		const h = h21( ci ).toVar(), an = h.mul( 6.2832 ).toVar();
    		const r = mat2( cos( an ), sin( an ).negate(), sin( an ), cos( an ) ).mul( cf.add( vec2( h21( ci.add( 2. ) ).sub( .5 ), h21( ci.add( 5. ) ).sub( .5 ) ).mul( .2 ) ) ).toVar();

    		If( h21( ci.add( 9. ) ).lessThan( .55 ), () => {

    			const leaf = length( r.mul( vec2( 1., 1.45 ) ) ).sub( .36 ).toVar();
    			const slit = step( abs( fract( atan( r.y, r.x ).mul( 1.6 ).add( .5 ) ).sub( .5 ) ), .07 ).mul( step( .12, length( r ) ) ).toVar();
    			const hole = step( length( r.mul( vec2( 1.4, 1. ) ).sub( vec2( .14, .08 ) ) ), .05 ).add( step( length( r.mul( vec2( 1.4, 1. ) ).add( vec2( .12, .1 ) ) ), .045 ) ).toVar();
    			col.assign( mix( col, vWB.mul( add( .85, mul( .3, step( abs( r.y ), .015 ) ) ) ), step( leaf, 0. ).mul( sub( 1., slit ) ).mul( sub( 1., hole ) ) ) );

    		} ).Else( () => {

    			const body = length( r.sub( vec2( 0., -0.08 ) ).mul( vec2( 1., 1.7 ) ) ).sub( .17 ).toVar();
    			const neck = abs( r.x.sub( .1 ).sub( mul( .07, sin( r.y.mul( 14. ) ) ) ) ).sub( .03 ).add( step( r.y, -0.05 ).mul( 9. ) ).add( step( .28, r.y ).mul( 9. ) ).toVar();
    			const head = length( r.sub( vec2( .06, .3 ) ) ).sub( .055 ).toVar();
    			const leg = abs( r.x.add( .02 ) ).sub( .012 ).add( step( -0.2, r.y ).mul( 9. ) ).add( step( r.y, -0.44 ).mul( 9. ) ).toVar();
    			col.assign( mix( col, vWC, step( min( min( body, neck ), min( head, leg ) ), 0. ) ) );

    		} );

    	} );

    	If( pt.equal( 22 ), () => {

    		col.mulAssign( sub( 1., mul( .3, step( length( fract( q.mul( vWP.y ) ).sub( .5 ) ), .22 ) ) ) );

    	} );

    	If( pt.equal( 23 ), () => {

    		const f = n2( q.mul( 9. ) ).mul( .55 ).add( n2( q.mul( 23. ).add( 3. ) ).mul( .3 ) ).add( n2( q.mul( 70. ) ).mul( .15 ) ).toVar();
    		col.assign( mix( col, col.mul( 1.7 ).add( .07 ), smoothstep( .52, .66, f ) ) );
    		col.mulAssign( add( .9, mul( .12, smoothstep( .04, 0., abs( n2( q.mul( 14. ) ).sub( .5 ) ) ) ) ) );

    	} );

    	If( pt.equal( 24 ), () => {

    		const g = q.mul( vWP.y ).toVar();
    		const cx = fract( g.x ).sub( .5 ).toVar(), t = g.y.mul( 2.4 ).toVar();
    		const s1 = abs( cx.sub( mul( .18, sin( t.mul( 3.1416 ) ) ) ) ).toVar(), s2 = abs( cx.add( mul( .18, sin( t.mul( 3.1416 ) ) ) ) ).toVar();
    		const top = select( mod( floor( t ), 2. ).lessThan( .5 ), s1, s2 ).toVar(), cr = min( s1, s2 ).toVar();
    		const rope = smoothstep( .2, .05, cr ).mul( add( .75, mul( .25, smoothstep( .2, .0, top ) ) ) ).toVar();
    		col.mulAssign( mix( .72, 1.06, rope ).mul( sub( 1., mul( .25, step( .42, abs( cx ) ) ) ) ) );

    	} );

    	If( pt.equal( 25 ), () => {

    		const l = abs( sin( q.x.mul( 38. ).add( sin( q.y.mul( 11. ) ).mul( 1.8 ) ) ) ).toVar();
    		col.assign( mix( col, vWB, smoothstep( .16, .04, l ).mul( .85 ) ) );

    	} );

    	If( pt.equal( 26 ), () => {

    		const g = q.mul( vWP.y ).toVar(), r = vec2( g.x.add( g.y ), g.x.sub( g.y ) ).mul( .7071 ).toVar(), ci = floor( r ).toVar(), cf = fract( r ).sub( .5 ).toVar();
    		const frame = smoothstep( .035, .015, sub( .5, max( abs( cf.x ), abs( cf.y ) ) ) ).toVar();
    		const m = property( 'float' );

    		If( mod( ci.x.add( ci.y ), 2. ).lessThan( .5 ), () => {

    			const an = atan( cf.y, cf.x ).toVar();
    			m.assign( step( length( cf ), add( .2, mul( .08, cos( an.mul( 4. ) ) ) ) ).sub( step( length( cf ), .07 ) ) );

    		} ).Else( () => {

    			m.assign( smoothstep( .03, .01, abs( length( cf ).sub( .2 ) ) ).add( step( length( cf ), .05 ) ) );

    		} );

    		col.assign( mix( col, vWB, clamp( frame.add( m ), 0., 1. ) ) );

    	} );

    	If( pt.equal( 29 ), () => {

    		col.mulAssign( add( .86, mul( .14, step( .5, fract( q.x.mul( .7 ).add( q.y ).mul( 520. ) ) ) ) ) );
    		col.assign( mix( col, col.mul( 1.55 ).add( .05 ), smoothstep( .45, .8, n2( vec2( q.x.mul( 30. ), q.y.mul( 3. ) ) ) ).mul( .7 ) ) );

    		If( vWP.y.greaterThan( .5 ), () => {

    			const sg = q.mul( 46. ).toVar(), si = floor( sg ).toVar();
    			col.assign( mix( col, vec3( .92, .9, .84 ), step( .93, h21( si ) ).mul( step( length( fract( sg ).sub( .5 ) ), add( .07, mul( .13, h21( si.add( 3.1 ) ) ) ) ) ) ) );

    		} );

    	} );

    	If( pt.equal( 30 ), () => {

    		const g = q.mul( vWP.y ).toVar();
    		g.x.addAssign( step( .5, fract( g.y.mul( .5 ) ) ).mul( .5 ) );
    		const d = length( fract( g ).sub( .5 ) ).toVar();
    		col.assign( mix( col, col.mul( .22 ), smoothstep( .3, .26, d ) ) );
    		col.mulAssign( add( .92, mul( .16, smoothstep( .36, .44, d ) ) ) );

    	} );

    	If( pt.equal( 33 ), () => {

    		const c = floor( q.mul( vWP.y ) ).toVar();
    		col.assign( mix( col, vWB, mod( c.x.add( c.y ), 2. ) ) );
    		col.mulAssign( add( .8, mul( .32, n2( q.mul( 900. ) ) ) ) );

    	} );

    	If( pt.equal( 36 ), () => {

    		const base = select( vP.y.greaterThan( 0. ), col, vWC ).toVar();
    		const g = fract( q.mul( vWP.y ) ).toVar();
    		const c2 = mix( base, vWB, step( .62, g.x ).add( step( .62, g.y ) ).mul( .45 ) ).toVar();
    		col.assign( mix( c2, vec3( .85, .82, .7 ), clamp( step( abs( g.x.sub( .3 ) ), .018 ).add( step( abs( g.y.sub( .3 ) ), .018 ) ), 0., 1. ).mul( .6 ) ) );

    	} );

    	If( pt.equal( 37 ), () => {

    		col.mulAssign( add( .88, mul( .12, sin( q.x.mul( 1800. ) ) ) ) );

    	} );

    	If( pt.equal( 38 ), () => {

    		const g = abs( fract( q.mul( vWP.y ) ).sub( .5 ) ).toVar();
    		col.mulAssign( sub( 1., step( g.x, .17 ).add( step( g.y, .17 ) ).mul( .22 ) ) );
    		col.assign( mix( col, vWB, max( step( g.x, .014 ), step( g.y, .014 ) ).mul( .85 ) ) );
    		col.assign( mix( col, vWC, max( step( abs( g.x.sub( .3 ) ), .0045 ), step( abs( g.y.sub( .3 ) ), .0045 ) ).mul( .55 ) ) );

    	} );

    	If( pt.equal( 39 ), () => {

    		col.mulAssign( add( .97, mul( .03, sin( q.x.mul( 900. ).add( q.y.mul( 260. ) ) ) ) ) );

    	} );

    	If( pt.equal( 40 ), () => {

    		const g = q.mul( vWP.y ).toVar();
    		g.x.addAssign( step( .5, fract( g.y.mul( .5 ) ) ).mul( .5 ) );
    		col.assign( mix( col, vWB, smoothstep( .16, .13, length( fract( g ).sub( .5 ) ) ) ) );

    	} );

    	If( pt.equal( 41 ), () => {

    		const w = q.x.mul( vWP.y ).add( sin( q.y.mul( 11. ) ).mul( .5 ) ).add( sin( q.y.mul( 29. ).add( q.x.mul( 8. ) ) ).mul( .18 ) ).add( n2( q.mul( 7. ) ).mul( .6 ) ).toVar();
    		const s = sin( w.mul( 6.2832 ) ).add( n2( q.mul( 34. ) ).mul( .45 ) ).sub( .15 ).toVar();
    		col.assign( mix( col, vWB, smoothstep( .05, .2, s ) ) );
    		col.mulAssign( add( .92, mul( .08, step( .5, fract( q.y.mul( 240. ) ) ) ) ) );

    	} );

    	If( pt.equal( 42 ), () => {

    		const g = q.mul( vWP.y ).toVar(), ci = floor( g ).toVar(), f = fract( g ).sub( .5 ).toVar();
    		const an = h21( ci ).mul( 6.2832 ).toVar(), c = cos( an ).toVar(), sn = sin( an ).toVar();
    		f.assign( vec2( f.x.mul( c ).sub( f.y.mul( sn ) ), f.x.mul( sn ).add( f.y.mul( c ) ) ) );
    		const yy = clamp( f.y.add( .1 ).div( .4 ), 0., 1. ).toVar();
    		const tail = select( f.y.lessThan( -0.1 ).or( f.y.greaterThan( .3 ) ), 9., abs( f.x.sub( mul( .16, yy ).mul( yy ) ) ).sub( mul( .15, sqrt( max( sub( 1., yy ), 0. ) ) ) ) ).toVar();
    		const d = min( length( f.sub( vec2( 0., -0.1 ) ) ).sub( .15 ), tail ).toVar();
    		col.assign( mix( col, vWB, step( d, 0. ) ) );
    		col.assign( mix( col, vWC, clamp( step( abs( d.add( .055 ) ), .012 ).add( step( abs( d.sub( .035 ) ), .01 ) ).add( step( length( f.sub( vec2( 0., -0.07 ) ) ), .045 ) ), 0., 1. ) ) );

    	} );

    	If( pt.equal( 43 ), () => {

    		const g = q.mul( vWP.y ).toVar(), c = fract( g ).sub( .5 ).toVar();
    		const r = length( c ).toVar(), an = atan( c.y, c.x ).toVar();
    		const petal = step( r, add( .2, mul( .09, cos( an.mul( 6. ) ) ) ) ).mul( step( .07, r ) ).add( step( r, .035 ) ).toVar();
    		const h = abs( fract( g.mul( 4. ) ).sub( .5 ) ).toVar();
    		const net = step( .43, max( h.x, h.y ) ).mul( step( .33, r ) ).toVar();
    		col.assign( mix( col, vWB, clamp( petal.add( net ), 0., 1. ).mul( .93 ) ) );

    	} );

    	If( pt.equal( 44 ), () => {

    		const g = q.mul( vWP.y ).toVar(), a = mod( floor( g ), 2. ).toVar();
    		col.assign( mix( col, vWB, a.x.mul( a.y ).add( a.x.add( a.y ).sub( mul( 2., a.x ).mul( a.y ) ).mul( step( .5, fract( g.x.sub( g.y ).mul( 2. ) ) ) ) ) ) );

    	} );

    	If( pt.equal( 45 ), () => {

    		const g = q.mul( vWP.y ).toVar();
    		g.x.addAssign( step( .5, fract( g.y.mul( .5 ) ) ).mul( .5 ) );
    		const d = length( fract( g ).sub( vec2( .5, .3 ) ) ).toVar();
    		col.mulAssign( add( .55, mul( .8, h21( floor( g ) ) ) ).mul( add( .45, mul( .55, smoothstep( .62, .5, d ) ) ) ) );

    	} );

    	If( pt.equal( 46 ), () => {

    		const g = q.mul( 150. ).toVar();
    		col.mulAssign( add( .8, mul( .24, step( .5, fract( g.x ) ).mul( .5 ).add( step( .5, fract( g.y ) ).mul( .5 ) ) ).mul( add( .7, mul( .3, n2( q.mul( 40. ) ) ) ) ) ) );
    		col.assign( mix( col, col.mul( vec3( .6, .53, .43 ) ), smoothstep( .45, .8, n2( q.mul( 7. ) ).mul( .6 ).add( n2( q.mul( 23. ) ).mul( .4 ) ) ).mul( .8 ) ) );

    	} );

    	If( pt.equal( 18 ), () => {

    		const g = q.mul( vWP.y ).toVar(), ci = floor( g ).toVar(), cf = fract( g ).toVar();
    		const dir = mod( ci.x.add( floor( ci.y.mul( .5 ) ).mul( 2. ) ).add( ci.y ), 2. ).toVar();
    		const sh = select( dir.lessThan( .5 ), sin( cf.x.mul( 3.1416 ) ), sin( cf.y.mul( 3.1416 ) ) ).toVar();
    		col.assign( mix( col, vWB, add( .35, mul( .65, sh ) ) ) );

    	} );

    	If( pt.equal( 48 ), () => {

    		col.mulAssign( add( .86, mul( .2, n2( q.mul( 30. ) ) ) ) );
    		col.assign( mix( col, col.mul( 1.8 ).add( .025 ), smoothstep( .62, .86, n2( q.mul( 6. ) ).mul( .7 ).add( n2( q.mul( 17. ) ).mul( .3 ) ) ).mul( .55 ) ) );
    		col.mulAssign( sub( 1., mul( .3, smoothstep( .025, .0, abs( n2( q.mul( 46. ) ).sub( .5 ) ) ) ) ) );

    	} );

    	If( pt.equal( 49 ), () => {

    		const g = q.mul( 90. ).toVar(), f = fract( g ).sub( .5 ).toVar();
    		col.assign( mix( col, vec3( .8, .82, .88 ), step( .94, h21( floor( g ) ) ).mul( smoothstep( .13, .02, length( f ) ) ) ) );

    	} );

    	If( pt.equal( 50 ), () => {

    		col.mulAssign( add( .9, mul( .12, smoothstep( -0.4, .7, sin( q.x.add( q.y ).mul( vWP.y ).mul( 6.2832 ) ) ) ) ) );

    	} );

    	If( pt.equal( 52 ), () => {

    		const d = min( fract( q.x.mul( 6. ).add( mul( .25, sin( q.y.mul( 4. ) ) ) ) ), fract( q.y.mul( 4.3 ).add( mul( .2, sin( q.x.mul( 3. ) ) ) ) ) ).toVar();
    		col.mulAssign( sub( 1., mul( .32, smoothstep( .022, .0, d ) ) ).add( mul( .1, smoothstep( .05, .03, d ) ).mul( step( .022, d ) ) ) );
    		col.mulAssign( add( .95, mul( .05, n2( q.mul( 300. ) ) ) ) );

    	} );

    	If( pt.equal( 54 ), () => {

    		const g = fract( q.mul( vWP.y ) ).toVar(), h = smoothstep( .44, .52, g ).sub( smoothstep( .92, .99, g ) ).toVar();
    		col.assign( mix( col, vWB, h.x.add( h.y ).mul( .5 ) ) );
    		const l = smoothstep( .026, .012, abs( g.sub( .25 ) ) ).toVar();
    		col.assign( mix( col, vWC, max( l.x, l.y ).mul( .8 ) ) );
    		col.mulAssign( add( .9, mul( .12, n2( q.mul( 380. ) ) ) ) );

    	} );

    	If( pt.equal( 55 ), () => {

    		const g = q.mul( 260. ).toVar();
    		col.assign( mix( col, vWB, step( .6, n2( g ).mul( .6 ).add( n2( g.mul( 2.7 ) ).mul( .4 ) ) ).mul( .5 ) ) );
    		col.assign( mix( col, vec3( .86, .68, .3 ), step( .94, h21( floor( q.mul( 420. ) ) ) ).mul( .7 ) ) );
    		col.mulAssign( add( .9, mul( .1, sin( q.x.mul( 1100. ) ) ).mul( sin( q.y.mul( 1100. ) ) ) ) );

    	} );

    	return col;

    } );

    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();

    	If( vW.y.lessThan( uClipY ), () => {

    		Discard();

    	} );

    	const n = normalize( vN ).toVar(), v = normalize( uCam.sub( vW ) ).toVar(), col = vCol.toVar();
    	const rgh = float( .65 ).toVar(), met = float( 0. ).toVar();
    	const emi = vec3( 0. ).toVar();
    	col.assign( uMap.sample( vUv ).rgb );
    	rgh.assign( sub( .60, uRain.mul( .08 ) ) );
    	const c = shade( vW, n, v, col, rgh, 0. ).toVar();
    	c.addAssign( col.mul( pow( sub( 1., max( dot( n, v ), 0. ) ), 3. ) ).mul( uFogHi.mul( sub( 1.2, uDay.mul( .95 ) ) ).add( .018 ) ) );
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
"{}": {
  h: "1ixkark1sqs", lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: true, libF: true,
  uniforms: [{"name":"uC","type":"vec3","size":10,"src":"uC"},{"name":"uGlow","type":"vec4","src":"uGlow"},{"name":"uPat","type":"vec4","src":"uPat"},{"name":"uTrait","type":"vec4","src":"uTrait"},{"name":"uCov","type":"vec4","src":"uCov"},{"name":"uAtlas","type":"sampler2D","src":"uAtlas"},{"name":"uPatC","type":"vec3","src":"uPatC"},{"name":"uInnerC","type":"vec3","src":"uInnerC"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vCol","type":"vec3","src":"vCol"},{"name":"vP","type":"vec3","src":"vP"},{"name":"vWB","type":"vec3","src":"vWB"},{"name":"vWC","type":"vec3","src":"vWC"},{"name":"vSk","type":"vec3","src":"vSk"},{"name":"vWP","type":"vec4","src":"vWP"},{"name":"vWN","type":"vec3","src":"vWN"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vSlot","type":"float","src":"vSlot"}],
  attributes: [{"name":"aSlot","type":"float","src":"aSlot"},{"name":"aPat","type":"vec3","src":"aPat"},{"name":"aUnn","type":"vec3","src":"aUnn"},{"name":"aWP","type":"vec4","src":"aWP"},{"name":"aUnp","type":"vec4","src":"aUnp"},{"name":"aWA","type":"vec4","src":"aWA"},{"name":"aWB","type":"vec4","src":"aWB"},{"name":"aWC","type":"vec4","src":"aWC"},{"name":"aWN","type":"vec4","src":"aWN"}],
  vertex: (TSL, E) => {
    const { vec4, mod, max, step, floor, If, int, mat3, normalize, select, vec3, Fn } = TSL;
    const { uC, uGlow, uPat, uTrait, uCov, uAtlas, uPatC, uInnerC, vW, vN, vCol, vP, vWB, vWC, vSk, vWP, vWN, vUv, vSlot, aSlot, aPat, aUnn, aWP, aUnp, aWA, aWB, aWC, aWN, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	vUv.assign( uv );
    	const objectNormal = normal.toVar(), transformed = position.toVar();
    	const cTopU = max( mod( uCov.w, 2. ), uCov.x ).toVar(), cShinU = step( 2.5, aSlot ).mul( step( aSlot, 4.5 ) ).mul( step( aPat.x, uCov.y ) ).toVar();

    	If( aUnp.w.greaterThan( .5 ).and( mod( aUnp.w, 2. ).mul( cTopU ).add( mod( floor( aUnp.w.mul( .5 ) ), 2. ).mul( max( mod( floor( uCov.w.mul( .5 ) ), 2. ), cShinU ) ) ).greaterThan( .5 ) ), () => {

    		transformed.subAssign( aUnp.xyz );
    		objectNormal.assign( aUnn );

    	} );

    	const s = int( aSlot.add( .5 ) ).toVar();
    	const w = modelMatrix.mul( vec4( transformed, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( objectNormal ) ) );
    	vCol.assign( select( s.equal( 10 ), aWA.rgb, uC.element( s ) ) );
    	vWB.assign( aWB.rgb );
    	vWC.assign( aWC.rgb );
    	vWP.assign( aWP );
    	vWN.assign( aWN.xyz );
    	vSk.assign( vec3( uC[ 0 ].r, uC[ 0 ].g, uC[ 0 ].b ) );
    	vP.assign( aPat );
    	vSlot.assign( aSlot );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { dot, clamp, length, Fn, floor, mod, select, vec2, float, min, If, mix, abs, atan, fract, step, max, mul, sub, sin, smoothstep, add, int, Loop, cos, mat2, property, vec3, sqrt, vec4, Discard, normalize, sign, pow, exp, reflect, cross } = TSL;
    const { uC, uGlow, uPat, uTrait, uCov, uAtlas, uPatC, uInnerC, vW, vN, vCol, vP, vWB, vWC, vSk, vWP, vWN, vUv, vSlot, aSlot, aPat, aUnn, aWP, aUnp, aWA, aWB, aWC, aWN, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const wSeg =  Fn( ( [ p, a, b, w ] ) => {

    	const pa = p.sub( a ).toVar(), ba = b.sub( a ).toVar();

    	return length( pa.sub( ba.mul( clamp( dot( pa, ba ).div( dot( ba, ba ) ), 0., 1. ) ) ) ).sub( w );

    }, { p: 'vec2', a: 'vec2', b: 'vec2', w: 'float', return: 'float' } );

    const wBit =  Fn( ( [ m, k ] ) => {

    	return mod( floor( m.div( k ) ), 2. );

    }, { m: 'float', k: 'float', return: 'float' } );

    const wDigit =  Fn( ( [ p, d, w ] ) => {

    	const m = select( d.lessThan( .5 ), 63., select( d.lessThan( 1.5 ), 6., select( d.lessThan( 2.5 ), 91., select( d.lessThan( 3.5 ), 79., select( d.lessThan( 4.5 ), 102., select( d.lessThan( 5.5 ), 109., select( d.lessThan( 6.5 ), 125., select( d.lessThan( 7.5 ), 7., select( d.lessThan( 8.5 ), 127., 111. ) ) ) ) ) ) ) ) ).toVar();
    	const A = vec2( -0.25, .5 ).toVar(), B = vec2( .25, .5 ).toVar(), C = vec2( .25, 0. ).toVar(), D = vec2( .25, -0.5 ).toVar(), E = vec2( -0.25, -0.5 ).toVar(), F = vec2( -0.25, 0. ).toVar();
    	const r = float( 9. ).toVar();

    	If( wBit( m, 1. ).greaterThan( .5 ), () => {

    		r.assign( min( r, wSeg( p, A, B, w ) ) );

    	} );

    	If( wBit( m, 2. ).greaterThan( .5 ), () => {

    		r.assign( min( r, wSeg( p, B, C, w ) ) );

    	} );

    	If( wBit( m, 4. ).greaterThan( .5 ), () => {

    		r.assign( min( r, wSeg( p, C, D, w ) ) );

    	} );

    	If( wBit( m, 8. ).greaterThan( .5 ), () => {

    		r.assign( min( r, wSeg( p, D, E, w ) ) );

    	} );

    	If( wBit( m, 16. ).greaterThan( .5 ), () => {

    		r.assign( min( r, wSeg( p, E, F, w ) ) );

    	} );

    	If( wBit( m, 32. ).greaterThan( .5 ), () => {

    		r.assign( min( r, wSeg( p, F, A, w ) ) );

    	} );

    	If( wBit( m, 64. ).greaterThan( .5 ), () => {

    		r.assign( min( r, wSeg( p, F, C, w ) ) );

    	} );

    	return r;

    }, { p: 'vec2', d: 'float', w: 'float', return: 'float' } );

    const legA =  Fn( ( [ P ] ) => {

    	const h = P.x.toVar(), ly = select( h.lessThan( .42 ), mix( .09, .077, clamp( h.sub( .1 ).div( .32 ), 0., 1. ) ), select( h.lessThan( .54 ), mix( .077, .045, h.sub( .42 ).div( .12 ) ), mix( .045, .02, clamp( h.sub( .54 ).div( .35 ), 0., 1. ) ) ) ).toVar();

    	return atan( P.z.sub( uCov.z ).add( ly ), abs( P.y ).sub( .11 ) );

    }, { P: 'vec3', return: 'float' } );

    const wearTile =  Fn( ( [ pt, q, col_immutable ] ) => {

    	const col = col_immutable.toVar();

    	If( pt.equal( 7 ), () => {

    		const g = fract( q.mul( vWP.y ) ).toVar();
    		const bu = step( .68, g.x ).toVar(), bh = step( .68, g.y ).toVar();
    		col.assign( mix( col, vWB, bu.add( bh ).mul( .42 ) ) );
    		col.assign( mix( col, vWC, max( step( abs( g.x.sub( .34 ) ), .025 ), step( abs( g.y.sub( .34 ) ), .025 ) ).mul( .9 ) ) );
    		col.assign( mix( col, vWB.mul( .7 ), max( step( abs( g.x.sub( .84 ) ), .012 ), step( abs( g.y.sub( .84 ) ), .012 ) ).mul( .6 ) ) );

    	} );

    	If( pt.equal( 8 ), () => {

    		col.mulAssign( sub( 1., mul( .14, max( step( .86, fract( q.x.mul( 165. ) ) ), step( .86, fract( q.y.mul( 165. ) ) ) ) ) ) );

    	} );

    	If( pt.equal( 9 ), () => {

    		col.mulAssign( add( .8, mul( .2, smoothstep( -0.3, .9, sin( q.x.mul( vWP.y ).mul( 6.2832 ) ) ) ) ) );
    		col.mulAssign( add( .96, mul( .04, sin( q.y.mul( 900. ) ) ) ) );

    	} );

    	If( pt.equal( 10 ), () => {

    		col.mulAssign( add( .92, mul( .1, n2( q.mul( 420. ) ) ) ).sub( mul( .04, n2( q.mul( 60. ) ) ) ) );

    	} );

    	If( pt.equal( 11 ), () => {

    		const g = fract( q.mul( 28. ) ).sub( .5 ).toVar();
    		const sw = abs( sin( length( g ).mul( 22. ).add( atan( g.y, g.x ).mul( 2. ) ) ) ).toVar();
    		col.mulAssign( add( .78, mul( .22, smoothstep( .15, .5, sw ) ) ) );
    		col.mulAssign( add( .85, mul( .2, n2( q.mul( 18. ) ) ) ) );

    	} );

    	If( pt.equal( 12 ), () => {

    		const g = q.mul( vWP.y ).toVar(), ci = floor( g ).toVar(), cf = fract( g ).toVar();
    		const d = float( 9. ).toVar(), an = float( 0. ).toVar(), hh = float( 0. ).toVar();

    		Loop( { start: int( - 1 ), end: 1, name: 'j', condition: '<=' }, ( { j } ) => {

    			Loop( { start: int( - 1 ), end: 1, condition: '<=' }, ( { i } ) => {

    				const o = vec2( float( i ), float( j ) ).toVar();
    				const pp = o.add( .2 ).add( mul( .6, vec2( h21( ci.add( o ) ), h21( ci.add( o ).add( 7.1 ) ) ) ) ).sub( cf ).toVar();
    				const dd = length( pp.mul( vec2( 1., 1.25 ) ) ).toVar();

    				If( dd.lessThan( d ), () => {

    					d.assign( dd );
    					an.assign( atan( pp.y, pp.x ) );
    					hh.assign( h21( ci.add( o ).add( 3.3 ) ) );

    				} );

    			} );

    		} );

    		const blob = step( .15, sin( an.mul( add( 3., floor( hh.mul( 3. ) ) ) ).add( hh.mul( 6.28 ) ) ).add( mul( .25, n2( g.mul( 5. ) ) ) ) ).toVar();
    		col.assign( mix( col, col.mul( .7 ), smoothstep( .24, .2, d ) ) );
    		col.assign( mix( col, vWB, smoothstep( .2, .25, d ).mul( smoothstep( .46, .38, d ) ).mul( blob ) ) );
    		col.mulAssign( add( .9, mul( .2, n2( q.mul( 500. ) ) ) ) );

    	} );

    	If( pt.equal( 13 ), () => {

    		const g = q.mul( vWP.y ).toVar();
    		const t = fract( g.y.mul( 2. ).add( select( mod( floor( g.x ), 2. ).lessThan( 1. ), fract( g.x ), sub( 1., fract( g.x ) ) ).mul( 1.2 ) ) ).toVar();
    		col.assign( mix( col, vWB, step( .5, t ).mul( .8 ) ) );
    		col.mulAssign( add( .9, mul( .18, h21( floor( q.mul( 900. ) ) ) ) ) );

    	} );

    	If( pt.equal( 14 ), () => {

    		const g = q.mul( vWP.y ).toVar();
    		const f = sin( g.x.add( sin( g.y.mul( 1.3 ) ).mul( 2. ) ) ).mul( sin( g.y.add( sin( g.x.mul( .7 ) ).mul( 2. ) ) ) ).toVar();
    		col.assign( mix( col, vWB, smoothstep( .12, .04, abs( f ) ).mul( .85 ) ) );

    	} );

    	If( pt.equal( 15 ), () => {

    		const g = floor( q.mul( vWP.y ) ).toVar(), g2 = floor( q.mul( vWP.y ).mul( .25 ) ).toVar();
    		const h = h21( g2.add( .3 ) ).mul( .6 ).add( h21( g ).mul( .4 ) ).toVar();
    		col.assign( select( h.lessThan( .3 ), vWB, select( h.lessThan( .55 ), col, select( h.lessThan( .78 ), vWC, col.mul( .78 ) ) ) ) );

    	} );

    	If( pt.equal( 16 ), () => {

    		const g = q.mul( vWP.y ).toVar(), ci = floor( g ).toVar(), cf = fract( g ).toVar();
    		const dir = mod( ci.x.add( ci.y ), 2. ).toVar();
    		const sh = select( dir.lessThan( .5 ), sin( cf.x.mul( 3.1416 ) ), sin( cf.y.mul( 3.1416 ) ) ).toVar();
    		col.mulAssign( add( .72, mul( .32, sh ) ) );
    		col.mulAssign( add( .88, mul( .2, h21( ci.add( floor( q.y.mul( 40. ) ) ) ) ) ) );

    	} );

    	If( pt.equal( 17 ), () => {

    		const g = q.mul( vWP.y ).toVar();
    		const f = n2( g ).mul( .6 ).add( n2( g.mul( 2.3 ).add( 4. ) ).mul( .3 ) ).add( n2( g.mul( 6. ) ).mul( .1 ) ).toVar();
    		col.assign( mix( col, vWB, smoothstep( .45, .7, f ) ) );
    		col.assign( mix( col, vWB.mul( .5 ), smoothstep( .68, .85, f ) ) );

    	} );

    	If( pt.equal( 20 ), () => {

    		const g = q.mul( vWP.y ).toVar(), ci = floor( g ).toVar(), cf = fract( g ).sub( .5 ).toVar();
    		const h = h21( ci ).toVar(), an = h.mul( 6.2832 ).toVar();
    		const r = mat2( cos( an ), sin( an ).negate(), sin( an ), cos( an ) ).mul( cf.add( vec2( h21( ci.add( 2. ) ).sub( .5 ), h21( ci.add( 5. ) ).sub( .5 ) ).mul( .2 ) ) ).toVar();

    		If( h21( ci.add( 9. ) ).lessThan( .55 ), () => {

    			const leaf = length( r.mul( vec2( 1., 1.45 ) ) ).sub( .36 ).toVar();
    			const slit = step( abs( fract( atan( r.y, r.x ).mul( 1.6 ).add( .5 ) ).sub( .5 ) ), .07 ).mul( step( .12, length( r ) ) ).toVar();
    			const hole = step( length( r.mul( vec2( 1.4, 1. ) ).sub( vec2( .14, .08 ) ) ), .05 ).add( step( length( r.mul( vec2( 1.4, 1. ) ).add( vec2( .12, .1 ) ) ), .045 ) ).toVar();
    			col.assign( mix( col, vWB.mul( add( .85, mul( .3, step( abs( r.y ), .015 ) ) ) ), step( leaf, 0. ).mul( sub( 1., slit ) ).mul( sub( 1., hole ) ) ) );

    		} ).Else( () => {

    			const body = length( r.sub( vec2( 0., -0.08 ) ).mul( vec2( 1., 1.7 ) ) ).sub( .17 ).toVar();
    			const neck = abs( r.x.sub( .1 ).sub( mul( .07, sin( r.y.mul( 14. ) ) ) ) ).sub( .03 ).add( step( r.y, -0.05 ).mul( 9. ) ).add( step( .28, r.y ).mul( 9. ) ).toVar();
    			const head = length( r.sub( vec2( .06, .3 ) ) ).sub( .055 ).toVar();
    			const leg = abs( r.x.add( .02 ) ).sub( .012 ).add( step( -0.2, r.y ).mul( 9. ) ).add( step( r.y, -0.44 ).mul( 9. ) ).toVar();
    			col.assign( mix( col, vWC, step( min( min( body, neck ), min( head, leg ) ), 0. ) ) );

    		} );

    	} );

    	If( pt.equal( 22 ), () => {

    		col.mulAssign( sub( 1., mul( .3, step( length( fract( q.mul( vWP.y ) ).sub( .5 ) ), .22 ) ) ) );

    	} );

    	If( pt.equal( 23 ), () => {

    		const f = n2( q.mul( 9. ) ).mul( .55 ).add( n2( q.mul( 23. ).add( 3. ) ).mul( .3 ) ).add( n2( q.mul( 70. ) ).mul( .15 ) ).toVar();
    		col.assign( mix( col, col.mul( 1.7 ).add( .07 ), smoothstep( .52, .66, f ) ) );
    		col.mulAssign( add( .9, mul( .12, smoothstep( .04, 0., abs( n2( q.mul( 14. ) ).sub( .5 ) ) ) ) ) );

    	} );

    	If( pt.equal( 24 ), () => {

    		const g = q.mul( vWP.y ).toVar();
    		const cx = fract( g.x ).sub( .5 ).toVar(), t = g.y.mul( 2.4 ).toVar();
    		const s1 = abs( cx.sub( mul( .18, sin( t.mul( 3.1416 ) ) ) ) ).toVar(), s2 = abs( cx.add( mul( .18, sin( t.mul( 3.1416 ) ) ) ) ).toVar();
    		const top = select( mod( floor( t ), 2. ).lessThan( .5 ), s1, s2 ).toVar(), cr = min( s1, s2 ).toVar();
    		const rope = smoothstep( .2, .05, cr ).mul( add( .75, mul( .25, smoothstep( .2, .0, top ) ) ) ).toVar();
    		col.mulAssign( mix( .72, 1.06, rope ).mul( sub( 1., mul( .25, step( .42, abs( cx ) ) ) ) ) );

    	} );

    	If( pt.equal( 25 ), () => {

    		const l = abs( sin( q.x.mul( 38. ).add( sin( q.y.mul( 11. ) ).mul( 1.8 ) ) ) ).toVar();
    		col.assign( mix( col, vWB, smoothstep( .16, .04, l ).mul( .85 ) ) );

    	} );

    	If( pt.equal( 26 ), () => {

    		const g = q.mul( vWP.y ).toVar(), r = vec2( g.x.add( g.y ), g.x.sub( g.y ) ).mul( .7071 ).toVar(), ci = floor( r ).toVar(), cf = fract( r ).sub( .5 ).toVar();
    		const frame = smoothstep( .035, .015, sub( .5, max( abs( cf.x ), abs( cf.y ) ) ) ).toVar();
    		const m = property( 'float' );

    		If( mod( ci.x.add( ci.y ), 2. ).lessThan( .5 ), () => {

    			const an = atan( cf.y, cf.x ).toVar();
    			m.assign( step( length( cf ), add( .2, mul( .08, cos( an.mul( 4. ) ) ) ) ).sub( step( length( cf ), .07 ) ) );

    		} ).Else( () => {

    			m.assign( smoothstep( .03, .01, abs( length( cf ).sub( .2 ) ) ).add( step( length( cf ), .05 ) ) );

    		} );

    		col.assign( mix( col, vWB, clamp( frame.add( m ), 0., 1. ) ) );

    	} );

    	If( pt.equal( 29 ), () => {

    		col.mulAssign( add( .86, mul( .14, step( .5, fract( q.x.mul( .7 ).add( q.y ).mul( 520. ) ) ) ) ) );
    		col.assign( mix( col, col.mul( 1.55 ).add( .05 ), smoothstep( .45, .8, n2( vec2( q.x.mul( 30. ), q.y.mul( 3. ) ) ) ).mul( .7 ) ) );

    		If( vWP.y.greaterThan( .5 ), () => {

    			const sg = q.mul( 46. ).toVar(), si = floor( sg ).toVar();
    			col.assign( mix( col, vec3( .92, .9, .84 ), step( .93, h21( si ) ).mul( step( length( fract( sg ).sub( .5 ) ), add( .07, mul( .13, h21( si.add( 3.1 ) ) ) ) ) ) ) );

    		} );

    	} );

    	If( pt.equal( 30 ), () => {

    		const g = q.mul( vWP.y ).toVar();
    		g.x.addAssign( step( .5, fract( g.y.mul( .5 ) ) ).mul( .5 ) );
    		const d = length( fract( g ).sub( .5 ) ).toVar();
    		col.assign( mix( col, col.mul( .22 ), smoothstep( .3, .26, d ) ) );
    		col.mulAssign( add( .92, mul( .16, smoothstep( .36, .44, d ) ) ) );

    	} );

    	If( pt.equal( 33 ), () => {

    		const c = floor( q.mul( vWP.y ) ).toVar();
    		col.assign( mix( col, vWB, mod( c.x.add( c.y ), 2. ) ) );
    		col.mulAssign( add( .8, mul( .32, n2( q.mul( 900. ) ) ) ) );

    	} );

    	If( pt.equal( 36 ), () => {

    		const base = select( vP.y.greaterThan( 0. ), col, vWC ).toVar();
    		const g = fract( q.mul( vWP.y ) ).toVar();
    		const c2 = mix( base, vWB, step( .62, g.x ).add( step( .62, g.y ) ).mul( .45 ) ).toVar();
    		col.assign( mix( c2, vec3( .85, .82, .7 ), clamp( step( abs( g.x.sub( .3 ) ), .018 ).add( step( abs( g.y.sub( .3 ) ), .018 ) ), 0., 1. ).mul( .6 ) ) );

    	} );

    	If( pt.equal( 37 ), () => {

    		col.mulAssign( add( .88, mul( .12, sin( q.x.mul( 1800. ) ) ) ) );

    	} );

    	If( pt.equal( 38 ), () => {

    		const g = abs( fract( q.mul( vWP.y ) ).sub( .5 ) ).toVar();
    		col.mulAssign( sub( 1., step( g.x, .17 ).add( step( g.y, .17 ) ).mul( .22 ) ) );
    		col.assign( mix( col, vWB, max( step( g.x, .014 ), step( g.y, .014 ) ).mul( .85 ) ) );
    		col.assign( mix( col, vWC, max( step( abs( g.x.sub( .3 ) ), .0045 ), step( abs( g.y.sub( .3 ) ), .0045 ) ).mul( .55 ) ) );

    	} );

    	If( pt.equal( 39 ), () => {

    		col.mulAssign( add( .97, mul( .03, sin( q.x.mul( 900. ).add( q.y.mul( 260. ) ) ) ) ) );

    	} );

    	If( pt.equal( 40 ), () => {

    		const g = q.mul( vWP.y ).toVar();
    		g.x.addAssign( step( .5, fract( g.y.mul( .5 ) ) ).mul( .5 ) );
    		col.assign( mix( col, vWB, smoothstep( .16, .13, length( fract( g ).sub( .5 ) ) ) ) );

    	} );

    	If( pt.equal( 41 ), () => {

    		const w = q.x.mul( vWP.y ).add( sin( q.y.mul( 11. ) ).mul( .5 ) ).add( sin( q.y.mul( 29. ).add( q.x.mul( 8. ) ) ).mul( .18 ) ).add( n2( q.mul( 7. ) ).mul( .6 ) ).toVar();
    		const s = sin( w.mul( 6.2832 ) ).add( n2( q.mul( 34. ) ).mul( .45 ) ).sub( .15 ).toVar();
    		col.assign( mix( col, vWB, smoothstep( .05, .2, s ) ) );
    		col.mulAssign( add( .92, mul( .08, step( .5, fract( q.y.mul( 240. ) ) ) ) ) );

    	} );

    	If( pt.equal( 42 ), () => {

    		const g = q.mul( vWP.y ).toVar(), ci = floor( g ).toVar(), f = fract( g ).sub( .5 ).toVar();
    		const an = h21( ci ).mul( 6.2832 ).toVar(), c = cos( an ).toVar(), sn = sin( an ).toVar();
    		f.assign( vec2( f.x.mul( c ).sub( f.y.mul( sn ) ), f.x.mul( sn ).add( f.y.mul( c ) ) ) );
    		const yy = clamp( f.y.add( .1 ).div( .4 ), 0., 1. ).toVar();
    		const tail = select( f.y.lessThan( -0.1 ).or( f.y.greaterThan( .3 ) ), 9., abs( f.x.sub( mul( .16, yy ).mul( yy ) ) ).sub( mul( .15, sqrt( max( sub( 1., yy ), 0. ) ) ) ) ).toVar();
    		const d = min( length( f.sub( vec2( 0., -0.1 ) ) ).sub( .15 ), tail ).toVar();
    		col.assign( mix( col, vWB, step( d, 0. ) ) );
    		col.assign( mix( col, vWC, clamp( step( abs( d.add( .055 ) ), .012 ).add( step( abs( d.sub( .035 ) ), .01 ) ).add( step( length( f.sub( vec2( 0., -0.07 ) ) ), .045 ) ), 0., 1. ) ) );

    	} );

    	If( pt.equal( 43 ), () => {

    		const g = q.mul( vWP.y ).toVar(), c = fract( g ).sub( .5 ).toVar();
    		const r = length( c ).toVar(), an = atan( c.y, c.x ).toVar();
    		const petal = step( r, add( .2, mul( .09, cos( an.mul( 6. ) ) ) ) ).mul( step( .07, r ) ).add( step( r, .035 ) ).toVar();
    		const h = abs( fract( g.mul( 4. ) ).sub( .5 ) ).toVar();
    		const net = step( .43, max( h.x, h.y ) ).mul( step( .33, r ) ).toVar();
    		col.assign( mix( col, vWB, clamp( petal.add( net ), 0., 1. ).mul( .93 ) ) );

    	} );

    	If( pt.equal( 44 ), () => {

    		const g = q.mul( vWP.y ).toVar(), a = mod( floor( g ), 2. ).toVar();
    		col.assign( mix( col, vWB, a.x.mul( a.y ).add( a.x.add( a.y ).sub( mul( 2., a.x ).mul( a.y ) ).mul( step( .5, fract( g.x.sub( g.y ).mul( 2. ) ) ) ) ) ) );

    	} );

    	If( pt.equal( 45 ), () => {

    		const g = q.mul( vWP.y ).toVar();
    		g.x.addAssign( step( .5, fract( g.y.mul( .5 ) ) ).mul( .5 ) );
    		const d = length( fract( g ).sub( vec2( .5, .3 ) ) ).toVar();
    		col.mulAssign( add( .55, mul( .8, h21( floor( g ) ) ) ).mul( add( .45, mul( .55, smoothstep( .62, .5, d ) ) ) ) );

    	} );

    	If( pt.equal( 46 ), () => {

    		const g = q.mul( 150. ).toVar();
    		col.mulAssign( add( .8, mul( .24, step( .5, fract( g.x ) ).mul( .5 ).add( step( .5, fract( g.y ) ).mul( .5 ) ) ).mul( add( .7, mul( .3, n2( q.mul( 40. ) ) ) ) ) ) );
    		col.assign( mix( col, col.mul( vec3( .6, .53, .43 ) ), smoothstep( .45, .8, n2( q.mul( 7. ) ).mul( .6 ).add( n2( q.mul( 23. ) ).mul( .4 ) ) ).mul( .8 ) ) );

    	} );

    	If( pt.equal( 18 ), () => {

    		const g = q.mul( vWP.y ).toVar(), ci = floor( g ).toVar(), cf = fract( g ).toVar();
    		const dir = mod( ci.x.add( floor( ci.y.mul( .5 ) ).mul( 2. ) ).add( ci.y ), 2. ).toVar();
    		const sh = select( dir.lessThan( .5 ), sin( cf.x.mul( 3.1416 ) ), sin( cf.y.mul( 3.1416 ) ) ).toVar();
    		col.assign( mix( col, vWB, add( .35, mul( .65, sh ) ) ) );

    	} );

    	If( pt.equal( 48 ), () => {

    		col.mulAssign( add( .86, mul( .2, n2( q.mul( 30. ) ) ) ) );
    		col.assign( mix( col, col.mul( 1.8 ).add( .025 ), smoothstep( .62, .86, n2( q.mul( 6. ) ).mul( .7 ).add( n2( q.mul( 17. ) ).mul( .3 ) ) ).mul( .55 ) ) );
    		col.mulAssign( sub( 1., mul( .3, smoothstep( .025, .0, abs( n2( q.mul( 46. ) ).sub( .5 ) ) ) ) ) );

    	} );

    	If( pt.equal( 49 ), () => {

    		const g = q.mul( 90. ).toVar(), f = fract( g ).sub( .5 ).toVar();
    		col.assign( mix( col, vec3( .8, .82, .88 ), step( .94, h21( floor( g ) ) ).mul( smoothstep( .13, .02, length( f ) ) ) ) );

    	} );

    	If( pt.equal( 50 ), () => {

    		col.mulAssign( add( .9, mul( .12, smoothstep( -0.4, .7, sin( q.x.add( q.y ).mul( vWP.y ).mul( 6.2832 ) ) ) ) ) );

    	} );

    	If( pt.equal( 52 ), () => {

    		const d = min( fract( q.x.mul( 6. ).add( mul( .25, sin( q.y.mul( 4. ) ) ) ) ), fract( q.y.mul( 4.3 ).add( mul( .2, sin( q.x.mul( 3. ) ) ) ) ) ).toVar();
    		col.mulAssign( sub( 1., mul( .32, smoothstep( .022, .0, d ) ) ).add( mul( .1, smoothstep( .05, .03, d ) ).mul( step( .022, d ) ) ) );
    		col.mulAssign( add( .95, mul( .05, n2( q.mul( 300. ) ) ) ) );

    	} );

    	If( pt.equal( 54 ), () => {

    		const g = fract( q.mul( vWP.y ) ).toVar(), h = smoothstep( .44, .52, g ).sub( smoothstep( .92, .99, g ) ).toVar();
    		col.assign( mix( col, vWB, h.x.add( h.y ).mul( .5 ) ) );
    		const l = smoothstep( .026, .012, abs( g.sub( .25 ) ) ).toVar();
    		col.assign( mix( col, vWC, max( l.x, l.y ).mul( .8 ) ) );
    		col.mulAssign( add( .9, mul( .12, n2( q.mul( 380. ) ) ) ) );

    	} );

    	If( pt.equal( 55 ), () => {

    		const g = q.mul( 260. ).toVar();
    		col.assign( mix( col, vWB, step( .6, n2( g ).mul( .6 ).add( n2( g.mul( 2.7 ) ).mul( .4 ) ) ).mul( .5 ) ) );
    		col.assign( mix( col, vec3( .86, .68, .3 ), step( .94, h21( floor( q.mul( 420. ) ) ) ).mul( .7 ) ) );
    		col.mulAssign( add( .9, mul( .1, sin( q.x.mul( 1100. ) ) ).mul( sin( q.y.mul( 1100. ) ) ) ) );

    	} );

    	return col;

    } );

    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();

    	If( vW.y.lessThan( uClipY ), () => {

    		Discard();

    	} );

    	const n = normalize( vN ).toVar(), v = normalize( uCam.sub( vW ) ).toVar(), col = vCol.toVar();
    	const rgh = float( .65 ).toVar(), met = float( 0. ).toVar();
    	const emi = vec3( 0. ).toVar();
    	const s = int( vSlot.add( .5 ) ).toVar();
    	const texRgb = uAtlas.sample( vUv ).rgb.toVar();
    	const det = texRgb.mul( 1.2195 ).toVar();
    	const isSkin = select( s.equal( 0 ).or( s.equal( 2 ).and( uPat.w.lessThan( .5 ) ) ).or( s.equal( 4 ).and( uTrait.x.greaterThan( .5 ) ) ).or( s.equal( 10 ).and( int( vWP.w.add( .05 ) ).equal( 14 ) ) ), 1., 0. ).toVar();

    	If( s.lessThanEqual( 5 ).and( vWP.w.greaterThan( .5 ) ), () => {

    		Discard();

    	} );

    	If( uCov.w.greaterThan( .5 ).or( uCov.y.greaterThan( 0. ) ).and( s.greaterThanEqual( 1 ) ).and( s.lessThanEqual( 5 ) ), () => {

    		const cTop = mod( uCov.w, 2. ).toVar(), cBot = mod( floor( uCov.w.mul( .5 ) ), 2. ).toVar(), cShoe = mod( floor( uCov.w.mul( .25 ) ), 2. ).toVar();

    		If( cTop.greaterThan( .5 ).and( s.equal( 1 ).or( s.equal( 2 ) ) ), () => {

    			isSkin.assign( 1. );

    		} );

    		If( cBot.greaterThan( .5 ).or( s.equal( 4 ).and( vP.x.lessThan( uCov.y ) ) ).or( s.equal( 3 ).and( vP.x.lessThan( uCov.y.sub( .04 ) ) ) ).and( s.equal( 3 ).or( s.equal( 4 ) ) ), () => {

    			isSkin.assign( 1. );

    		} );

    		If( s.equal( 5 ).and( cShoe.greaterThan( .5 ) ), () => {

    			Discard();

    		} );

    	} );

    	If( s.equal( 8 ), () => {

    		const eLum = dot( texRgb, vec3( .299, .587, .114 ) ).toVar();
    		const irisM = smoothstep( .43, .25, eLum ).mul( smoothstep( .012, .052, eLum ) ).toVar();
    		const lidAo = mix( .48, 1., smoothstep( .42, -0.2, n.y ) ).toVar();
    		const sclera = texRgb.mul( .90 ).toVar();
    		const iris = vCol.mul( eLum.mul( 5.4 ).add( .035 ) ).toVar();
    		col.assign( mix( sclera, iris, irisM.mul( .88 ) ).mul( lidAo ) );
    		rgh.assign( .06 );

    	} ).ElseIf( isSkin.greaterThan( .5 ), () => {

    		const skinDet = mix( vec3( 1. ), det, add( .92, uTrait.z.mul( .14 ) ) ).toVar();
    		col.assign( select( s.equal( 3 ).or( s.equal( 4 ) ).or( s.equal( 10 ) ), vSk, vCol ).mul( skinDet ) );

    		If( s.equal( 2 ), () => {

    			col.mulAssign( smoothstep( 1.18, 1.12, vP.x ).mul( .08 ).add( .92 ) );

    		} );

    		rgh.assign( clamp( sub( .66, uRain.mul( .09 ) ).add( uTrait.z.mul( .06 ) ), .42, .74 ) );

    		If( s.equal( 0 ), () => {

    			rgh.subAssign( mul( .06, smoothstep( 1.5, 1.6, vP.x ) ).mul( smoothstep( .02, .07, vP.z ) ).mul( smoothstep( .05, .02, abs( vP.y ) ) ) );

    		} );

    		const pd = length( uCam.sub( vW ) ).toVar();

    		If( pd.lessThan( 2.5 ), () => {

    			const pp = vP.mul( 260. ).toVar();
    			const z0 = floor( pp.z ).toVar(), fz = smoothstep( 0., 1., fract( pp.z ) ).toVar();
    			const o = vec2( 17.31, 31.73 ).toVar();
    			const na = mix( n2( pp.xy.add( z0.mul( o ) ) ), n2( pp.xy.add( z0.add( 1. ).mul( o ) ) ), fz ).toVar(), nb = mix( n2( pp.yx.mul( 1.13 ).add( 5.1 ).add( z0.mul( o ) ) ), n2( pp.yx.mul( 1.13 ).add( 5.1 ).add( z0.add( 1. ).mul( o ) ) ), fz ).toVar();
    			n.assign( normalize( n.add( vec3( na.sub( .5 ), nb.sub( .5 ), na.add( nb ).sub( 1. ).mul( .5 ) ).mul( .07 ).mul( smoothstep( 2.5, 1., pd ) ) ) ) );

    		} );

    	} ).ElseIf( s.equal( 10 ), () => {

    		const pt = int( vWP.x.add( .5 ) ).toVar(), tp = int( vWP.w.add( .05 ) ).toVar();
    		const lg = clamp( vWP.w.sub( float( tp ) ).div( .8 ), 0., 1. ).toVar();
    		const aw = abs( vWN ).toVar();
    		const q = select( aw.y.greaterThan( max( aw.z, aw.x ) ), vec2( vP.z, vP.x ), select( aw.z.greaterThan( aw.x ), vec2( vP.y, vP.x ), vec2( vP.y, vP.z ) ) ).toVar();
    		const front = smoothstep( .0, .03, vP.z ).toVar(), back = smoothstep( .0, -0.03, vP.z ).toVar();
    		const sf = vec3( abs( vP.y ).sub( .11 ), vP.x, vP.z.sub( uCov.z ).add( .09 ) ).toVar();

    		If( tp.equal( 0 ), () => {

    			If( pt.equal( 1 ), () => {

    				col.assign( mix( col, vWB, step( .5, fract( vP.x.mul( vWP.y ) ) ) ) );

    			} ).ElseIf( pt.equal( 2 ), () => {

    				const e = vec2( vP.y.sub( .045 ), vP.x.sub( vWP.y ) ).toVar();
    				const ring = smoothstep( .006, .002, abs( length( e ).sub( .055 ) ) ).toVar(), disc = smoothstep( .047, .043, length( e ) ).toVar();
    				const bolt = smoothstep( .006, .002, abs( e.x.mul( 1.6 ).add( e.y ).sub( mul( .006, sign( e.y ) ) ) ) ).mul( disc ).toVar();
    				const txt = step( abs( vP.y.sub( .045 ) ), .06 ).mul( step( abs( vP.x.sub( vWP.y ).add( .085 ) ), .009 ) ).mul( step( .5, fract( vP.y.mul( 95. ) ) ) ).toVar();
    				col.assign( mix( col, vWB, clamp( ring.add( disc.mul( .92 ) ), 0., 1. ).mul( front ) ) );
    				col.assign( mix( col, vWC, clamp( bolt.add( txt ), 0., 1. ).mul( front ) ) );

    			} ).ElseIf( pt.equal( 3 ), () => {

    				const e = vec2( vP.y.mul( 1.3 ).add( vP.z.mul( .7 ) ), vP.x ).mul( vWP.y ).toVar();
    				const a = n2( e ).toVar(), b = n2( e.mul( 1.7 ).add( 11.3 ) ).toVar();
    				col.assign( mix( col, vWB, step( .55, a ) ) );
    				col.assign( mix( col, vWC, step( .62, b ).mul( sub( 1., step( .55, a ).mul( .5 ) ) ) ) );

    			} ).ElseIf( pt.equal( 4 ), () => {

    				col.assign( mix( col, vWC, smoothstep( .022, .018, length( vec2( vP.y, vP.x.sub( vWP.y ) ) ) ).mul( front ) ) );

    			} ).ElseIf( pt.equal( 5 ), () => {

    				const e = vec2( vP.y, vP.x.sub( vWP.y ) ).toVar(), r = vec2( abs( e.x ), e.y ).toVar();
    				const aa = float( .0015 ).toVar();
    				const sun = smoothstep( .084, sub( .084, aa ), length( e.sub( vec2( 0., .025 ) ) ) ).mul( sub( 1., step( e.y, .02 ).mul( step( fract( e.y.mul( 38. ) ), .32 ) ) ) ).toVar();
    				const tw = sub( .0055, r.y.add( .085 ).mul( .012 ) ).toVar();
    				const palm = smoothstep( tw, tw.sub( aa ), abs( r.x.sub( .1 ).sub( r.y.add( .085 ).mul( .12 ) ) ) ).mul( step( -0.085, r.y ) ).mul( step( r.y, .09 ) ).toVar();
    				const tq = vec2( .121, .09 ).toVar();

    				Loop( { start: 0, end: 6, name: 'k' }, ( { k } ) => {

    					const an = add( .25, float( k ).mul( .52 ) ).toVar();
    					const d = vec2( cos( an ), sin( an ) ).toVar(), pp = r.sub( tq ).toVar();
    					const t = clamp( dot( pp, d ), 0., .065 ).toVar();
    					palm.assign( max( palm, smoothstep( .0055, .0035, length( pp.sub( d.mul( t ) ).add( vec2( 0., t.mul( t ).mul( 7. ) ) ) ).add( t.mul( .05 ) ) ) ) );

    				} );

    				const car = step( abs( e.x ), .12 ).mul( step( -0.083, e.y ) ).mul( step( e.y, -0.058 ) ).add( step( abs( e.x.add( .01 ) ), sub( .058, e.y.add( .058 ).mul( .9 ) ) ).mul( step( -0.058, e.y ) ).mul( step( e.y, -0.04 ) ) ).toVar();
    				car.mulAssign( sub( 1., smoothstep( .016, .014, min( length( e.sub( vec2( -0.075, -0.083 ) ) ), length( e.sub( vec2( .075, -0.083 ) ) ) ) ) ) );
    				col.assign( mix( col, vWB, sun.mul( back ) ) );
    				col.assign( mix( col, vWC, clamp( palm.add( car ), 0., 1. ).mul( back ) ) );

    			} ).ElseIf( pt.equal( 6 ), () => {

    				const e = vec2( vP.y, vP.x.sub( vWP.y ) ).div( .03 ).toVar();
    				const spray = n2( e.mul( 9. ) ).mul( .35 ).toVar();
    				const sk = max( step( length( e.sub( vec2( 0., .15 ) ) ).add( spray.mul( .3 ) ), .85 ), step( abs( e.x ), .5 ).mul( step( -0.75, e.y ) ).mul( step( e.y, -0.2 ) ) ).toVar();
    				const hole = step( length( vec2( abs( e.x ).sub( .32 ), e.y.sub( .05 ) ) ), .22 ).add( step( abs( e.x ).mul( 1.3 ).add( e.y.add( .12 ) ), .1 ).mul( step( -0.32, e.y ) ) ).add( step( abs( fract( e.x.mul( 3.5 ) ).sub( .5 ) ), .08 ).mul( step( -0.75, e.y ) ).mul( step( e.y, -0.38 ) ) ).toVar();
    				col.assign( mix( col, vWC, clamp( sk.sub( hole ), 0., 1. ).mul( front ).mul( step( .15, n2( e.mul( 23. ) ).add( .6 ) ) ) ) );

    			} ).ElseIf( pt.equal( 19 ), () => {

    				const e = vec2( abs( vP.y ), vP.x.sub( vWP.y ) ).div( .03 ).toVar();
    				const w1 = length( e.sub( vec2( .62, .38 ) ).mul( mat2( .8, -0.6, .6, .8 ) ).mul( vec2( 1., 1.5 ) ) ).sub( .62 ).toVar();
    				const w2 = length( e.sub( vec2( .5, -0.5 ) ).mul( mat2( .8, .6, -0.6, .8 ) ).mul( vec2( 1., 1.4 ) ) ).sub( .42 ).toVar();
    				const bd = length( e.mul( vec2( 5., 1. ) ) ).sub( .9 ).toVar();
    				const wing = step( min( w1, w2 ), 0. ).toVar(), dots = step( length( fract( e.mul( 4. ) ).sub( .5 ) ), .3 ).toVar();
    				const sp = h21( floor( e.mul( 4. ) ).add( floor( vP.z.mul( 40. ) ) ) ).toVar();
    				col.assign( mix( col, vec3( .78, .8, .86 ).mul( add( .75, mul( .5, sp ) ) ), max( wing.mul( dots ), step( bd, 0. ) ).mul( front ) ) );
    				emi.addAssign( vec3( .5 ).mul( step( .86, sp ) ).mul( wing ).mul( dots ).mul( front ) );

    			} ).ElseIf( pt.equal( 21 ), () => {

    				const g = fract( q.mul( 250. ) ).sub( .5 ).toVar(), c = q.mul( 16. ).toVar(), ci = floor( c ).toVar(), cf = fract( c ).sub( .5 ).toVar();
    				const rr = length( cf.sub( vec2( .08, .1 ) ) ).toVar(), rose = rr.sub( .17 ).toVar(), sw = abs( sin( rr.mul( 46. ).add( atan( cf.y.sub( .1 ), cf.x.sub( .08 ) ).mul( 2. ) ) ) ).toVar();
    				const vine = abs( cf.y.add( .12 ).sub( mul( .1, sin( cf.x.mul( 7. ).add( ci.y.mul( 2. ) ) ) ) ) ).sub( .012 ).toVar();
    				const thorn = step( abs( fract( cf.x.mul( 5. ) ).sub( .5 ) ), .08 ).mul( step( abs( cf.y.add( .12 ).sub( mul( .1, sin( cf.x.mul( 7. ).add( ci.y.mul( 2. ) ) ) ) ) ), .035 ) ).toVar();
    				const emb = max( step( rose, 0. ).mul( step( .55, h21( ci ) ) ), max( step( vine, 0. ), thorn ).mul( step( .35, h21( ci.add( 1.7 ) ) ) ) ).toVar();
    				const bay = mod( mod( floor( fragCoord_.x ), 2. ).mul( 2. ).add( mod( floor( fragCoord_.y ), 2. ).mul( 3. ) ), 4. ).mul( .25 ).toVar();

    				If( emb.lessThan( .5 ).and( bay.lessThan( .5 ) ), () => {

    					col.assign( vSk.mul( .9 ) );
    					rgh.assign( .5 );
    					isSkin.assign( 1. );

    				} ).Else( () => {

    					col.assign( select( emb.greaterThan( .5 ), vWB.mul( select( rose.lessThan( 0. ), add( .7, mul( .3, smoothstep( .1, .5, sw ) ) ), .6 ) ), col ) );

    				} );

    			} ).ElseIf( pt.equal( 31 ), () => {

    				const t = fract( vP.x.mul( 3.2 ).add( vP.y.mul( 1.4 ) ) ).toVar();
    				col.assign( mix( col, mix( vWB, vWC, smoothstep( .6, .95, t ) ), smoothstep( .55, .6, t ).mul( smoothstep( .98, .93, t ) ) ) );
    				const e = vec2( vP.y.add( vP.z.mul( .5 ) ), vP.x ).mul( 9. ).toVar(), ci = floor( e ).toVar(), cf = fract( e ).sub( .5 ).toVar();
    				const h = h21( ci ).toVar(), ca = cos( h.mul( 6. ) ).toVar(), sa = sin( h.mul( 6. ) ).toVar();
    				const r = vec2( ca.mul( cf.x ).add( sa.mul( cf.y ) ), sa.negate().mul( cf.x ).add( ca.mul( cf.y ) ) ).toVar();
    				const board = step( length( r.mul( vec2( 1., 3.2 ) ) ), .36 ).mul( step( .45, h ) ).toVar();
    				col.assign( mix( col, mix( vec3( .95, .93, .86 ), vWB, step( abs( r.x ), .04 ) ), board ) );

    			} ).ElseIf( pt.equal( 32 ), () => {

    				const e = vec2( abs( vP.y ).sub( .11 ), vP.x.sub( vWP.y ) ).div( .07 ).toVar();
    				const r = length( e ).toVar(), an = atan( e.y, e.x ).toVar();
    				const gm = step( abs( r.sub( .78 ) ), .05 ).add( step( abs( r.sub( add( .55, mul( .12, cos( an.mul( 8. ) ) ) ) ) ), .045 ) ).add( step( r, .4 ).mul( step( .15, r ) ).mul( step( .5, fract( an.mul( 2.546 ).add( r.mul( 3. ) ) ) ) ) ).toVar();
    				gm.addAssign( step( abs( e.y.add( 1.2 ) ), .15 ).mul( step( abs( e.x ), .9 ) ).mul( step( .4, fract( e.x.mul( 3.5 ).add( mul( .3, sin( e.y.mul( 12. ) ) ) ) ) ) ) );
    				gm.assign( clamp( gm, 0., 1. ).mul( smoothstep( .2, .5, vWN.z ) ) );
    				col.assign( mix( col, vWC, gm ) );
    				met.assign( max( met, gm ) );

    			} ).ElseIf( pt.equal( 34 ), () => {

    				const d = abs( abs( vP.y ).sub( vWP.y ) ).toVar(), on = step( vP.x, .82 ).mul( smoothstep( .5, .7, abs( vWN.z ) ) ).toVar();
    				col.mulAssign( add( 1., mul( .22, smoothstep( .003, .0, d ) ).sub( mul( .12, smoothstep( .009, .003, d ) ).mul( step( .003, d ) ) ).mul( on ) ) );
    				col.mulAssign( add( .93, mul( .07, n2( vec2( vP.y, vP.x ).mul( 260. ) ) ) ) );

    			} ).ElseIf( pt.equal( 35 ), () => {

    				const k = vP.x.sub( vWP.y ).toVar(), on = step( .015, k ).mul( step( k, .11 ) ).mul( smoothstep( .3, .7, vWN.z ) ).toVar();
    				col.mulAssign( mix( 1., add( .7, mul( .4, smoothstep( -0.6, .9, sin( k.mul( 330. ) ) ) ) ), on ) );
    				col.mulAssign( add( .94, mul( .08, n2( vec2( vP.y, vP.x ).mul( 90. ) ) ) ) );

    			} ).ElseIf( pt.equal( 28 ), () => {

    				col.mulAssign( add( .85, mul( .3, pow( sub( 1., max( dot( n, v ), 0. ) ), 2. ) ) ).add( mul( .06, n2( vP.yx.mul( 300. ) ) ) ) );
    				col.assign( mix( col, col.mul( .6 ), smoothstep( .003, .0, abs( fract( vP.y.mul( 18. ) ).sub( .5 ) ).sub( .45 ) ).mul( .7 ) ) );
    				const u = vP.y.toVar(), t = fract( vP.x.mul( 26. ) ).toVar(), W = float( .02 ).toVar();
    				const on = front.mul( step( .98, vP.x ) ).mul( step( vP.x, 1.24 ) ).toVar();
    				const lace = min( abs( u.sub( mix( W.negate(), W, t ) ) ), abs( u.add( mix( W.negate(), W, t ) ) ) ).sub( .003 ).toVar();
    				const eye = abs( length( vec2( abs( u ).sub( W ).sub( .004 ), t.sub( .5 ).div( 26. ) ) ).sub( .0035 ) ).sub( .0012 ).toVar();
    				col.assign( mix( col, vWC, step( lace, 0. ).mul( step( abs( u ), W ) ).mul( on ) ) );

    				If( eye.lessThan( 0. ).and( on.greaterThan( .5 ) ), () => {

    					col.assign( vec3( .62, .6, .56 ) );
    					met.assign( 1. );

    				} );

    			} ).ElseIf( pt.equal( 47 ), () => {

    				const e = vec2( vP.y.sub( .075 ), vP.x.sub( vWP.y ) ).toVar();
    				const nl = min( min( abs( e.x.add( .022 ) ), abs( e.x.sub( .022 ) ) ), abs( e.x.add( e.y.mul( .63 ) ) ) ).sub( .008 ).toVar();
    				nl.assign( max( nl, max( abs( e.x ).sub( .031 ), abs( e.y ).sub( .036 ) ) ) );
    				col.assign( mix( col, vWB, step( nl, .004 ).mul( front ) ) );
    				col.assign( mix( col, vWC.mul( add( .86, mul( .2, n2( vP.yx.mul( 600. ) ) ) ) ), step( nl, 0. ).mul( front ) ) );
    				const r = vec2( vP.y, vP.x.sub( vWP.y ).sub( .05 ) ).toVar();
    				const rr = length( r.sub( vec2( 0., -0.2 ) ) ).toVar(), an = atan( r.x, r.y.add( .2 ) ).toVar();
    				const cell = fract( an.div( .2 ).add( .5 ) ).toVar(), arc = step( abs( rr.sub( .2 ) ), .022 ).mul( step( abs( an ), .62 ) ).mul( step( .14, cell ) ).mul( step( cell, .86 ) ).toVar();
    				arc.mulAssign( sub( 1., step( abs( rr.sub( .2 ) ), .007 ).mul( step( .45, h21( vec2( floor( an.div( .2 ).add( .5 ) ), 3. ) ) ) ).mul( step( abs( cell.sub( .5 ) ), .2 ) ) ) );
    				const t = r.sub( vec2( 0., -0.1 ) ).toVar();
    				const cup = step( length( t.mul( vec2( 1., 1.5 ) ) ), .045 ).mul( step( -0.01, t.y ) ).add( step( abs( t.x ), .008 ).mul( step( -0.06, t.y ) ).mul( step( t.y, 0. ) ) ).add( step( abs( t.x ), .03 ).mul( step( abs( t.y.add( .068 ) ), .009 ) ) ).toVar();
    				col.assign( mix( col, vWC.mul( add( .86, mul( .2, n2( vP.yx.mul( 600. ) ) ) ) ), clamp( arc.add( cup ), 0., 1. ).mul( back ) ) );

    			} ).ElseIf( pt.equal( 51 ), () => {

    				const e = vec2( vP.y, vP.x.sub( vWP.y ) ).div( .075 ).toVar();
    				const tri = abs( fract( e.x.mul( 2. ).add( .5 ) ).sub( .5 ) ).mul( 2. ).toVar();
    				const body = step( abs( e.x ), 1. ).mul( step( -0.55, e.y ) ).mul( step( e.y, sub( .75, mul( .65, tri ) ) ) ).toVar();
    				const tips = step( length( vec2( fract( e.x.mul( 2. ).add( .5 ) ).sub( .5 ), e.y.sub( .86 ).mul( 2. ) ) ), .22 ).mul( step( abs( e.x ), 1.1 ) ).toVar();
    				const band = step( abs( e.y.add( .72 ) ), .13 ).mul( step( abs( e.x ), 1.12 ) ).toVar();
    				const crown = clamp( body.add( tips ).add( band ), 0., 1. ).mul( back ).toVar();
    				const g = fract( e.mul( 11. ) ).sub( .5 ).toVar();
    				const sp = h21( floor( e.mul( 11. ) ) ).toVar(), rs = step( length( g ), .38 ).mul( crown ).toVar();
    				col.assign( mix( col.mul( sub( 1., mul( .35, crown ) ) ), vec3( .8, .82, .88 ).mul( add( .65, mul( .5, sp ) ) ), rs ) );
    				emi.addAssign( vec3( .9 ).mul( pow( fract( sp.mul( 7.3 ).add( dot( v, vec3( 2.1, 1.3, 1.7 ) ).mul( 1.6 ) ) ), 24. ) ).mul( 2. ).mul( rs ) );

    			} ).ElseIf( pt.equal( 53 ), () => {

    				const e = vec2( vP.y, vP.x.sub( vWP.y ) ).toVar();
    				const dy = e.y.sub( mul( .085, sin( e.x.mul( 15. ) ) ) ).toVar(), w = mul( .03, sub( 1., smoothstep( .12, .17, abs( e.x ) ) ) ).add( .006 ).toVar();
    				const bodyD = step( abs( dy ), w ).mul( step( abs( e.x ), .17 ) ).toVar();
    				const fin = step( w, dy ).mul( step( dy, w.add( .012 ) ) ).mul( step( .45, fract( e.x.mul( 70. ) ) ) ).mul( step( abs( e.x ), .16 ) ).toVar();
    				const head = step( length( e.sub( vec2( .175, mul( .085, sin( 2.62 ) ) ) ).mul( vec2( 1., 1.3 ) ) ), .034 ).toVar();
    				const ce = fract( e.mul( 11. ) ).sub( .5 ).toVar();
    				const cloud = step( abs( length( ce ).sub( .3 ) ), .06 ).mul( step( .0, ce.y ) ).mul( step( .86, h21( floor( e.mul( 11. ) ) ) ) ).mul( sub( 1., bodyD ) ).mul( step( abs( e.x ), .2 ) ).mul( step( abs( e.y ), .19 ) ).toVar();
    				const gold = vec3( .88, .66, .26 ).mul( add( .75, mul( .35, step( .5, fract( e.x.mul( 120. ).add( step( .5, fract( dy.mul( 90. ) ) ).mul( .5 ) ) ) ) ) ) ).toVar();
    				col.assign( mix( col, vec3( .9, .9, .86 ), cloud.mul( back ) ) );
    				col.assign( mix( col, vec3( .72, .1, .08 ), fin.mul( back ) ) );
    				col.assign( mix( col, gold, clamp( bodyD.add( head ), 0., 1. ).mul( back ) ) );
    				col.assign( mix( col, vec3( .05 ), step( length( e.sub( vec2( .19, mul( .085, sin( 2.62 ) ).add( .008 ) ) ) ), .006 ).mul( back ) ) );
    				const t = vec2( vP.y.sub( .075 ), vP.x.sub( vWP.y ).sub( .08 ) ).div( .035 ).toVar();
    				const tg = step( length( t ), 1. ).toVar(), st = step( .55, fract( t.x.mul( 2.6 ).add( mul( .35, sin( t.y.mul( 6. ) ) ) ) ) ).mul( step( .25, abs( t.x ) ) ).toVar(), mz = step( length( t.sub( vec2( 0., -0.35 ) ).mul( vec2( 1., 1.5 ) ) ), .45 ).toVar();
    				col.assign( mix( col, mix( mix( vec3( .9, .45, .08 ), vec3( .03 ), st ), vec3( .95 ), mz ), tg.mul( front ) ) );

    			} ).ElseIf( pt.equal( 56 ), () => {

    				const e = vec2( vP.y, vP.x.sub( vWP.y ) ).toVar();
    				const cf = e.x.add( .117 ).div( .026 ).toVar(), u = fract( cf ).toVar(), h = h21( vec2( floor( cf ), 7. ) ).toVar();
    				const y = e.y.div( .016 ).toVar();
    				const gl = step( abs( u.sub( .3 ) ), .1 ).add( step( .35, h ).mul( step( abs( u.sub( .72 ) ), .09 ) ) ).add( step( .65, h ).mul( step( abs( y.sub( .78 ) ), .14 ) ).mul( step( abs( u.sub( .5 ) ), .32 ) ) ).add( step( abs( abs( y ).sub( .92 ) ), .1 ).mul( step( abs( u.sub( .3 ).sub( y.mul( .1 ) ) ), .14 ) ) ).toVar();
    				gl.mulAssign( step( abs( y ), 1.05 ).mul( step( abs( e.x ), .117 ) ).mul( sub( 1., step( .94, u ) ) ) );
    				col.assign( mix( col, vWC, clamp( gl, 0., 1. ).mul( front ) ) );

    			} ).ElseIf( pt.equal( 58 ), () => {

    				col.mulAssign( sub( 1., mul( .35, step( length( fract( vec2( vP.y.add( vP.z.mul( .4 ) ), vP.x ).mul( 260. ) ).sub( .5 ) ), .17 ) ) ) );
    				const g = vec2( vP.y.add( vP.z.mul( .3 ) ), vP.x ).mul( vec2( 9., 11. ) ).toVar(), c = floor( g ).toVar(), f = fract( g ).toVar();
    				const pc = step( .58, h21( c ) ).mul( step( .12, f.x ) ).mul( step( f.x, .88 ) ).mul( step( .3, f.y ) ).mul( step( f.y, .7 ) ).toVar();
    				const k = h21( c.add( 3.1 ) ).toVar();
    				const bg = select( k.lessThan( .25 ), vec3( .92 ), select( k.lessThan( .5 ), vec3( .95, .78, .1 ), select( k.lessThan( .75 ), vec3( .04 ), vec3( .08, .2, .7 ) ) ) ).toVar();
    				const lg = select( h21( c.add( 5.7 ) ).lessThan( .5 ), step( length( f.sub( vec2( .3, .5 ) ).mul( vec2( 1., 2. ) ) ), .11 ), step( .5, fract( f.x.mul( 5. ) ) ).mul( step( abs( f.y.sub( .5 ) ), .08 ) ) ).toVar();
    				col.assign( mix( col, mix( bg, select( k.lessThan( .5 ), vec3( .06 ), vec3( .95 ) ), lg ), pc ) );

    			} ).ElseIf( pt.equal( 57 ), () => {

    				const arm = step( .2, abs( vP.y ) ).toVar();
    				const qt = select( abs( vWN.y ).greaterThan( abs( vWN.z ) ), vec2( vP.z, vP.x ), vec2( vP.y, vP.x ) ).toVar();
    				const qa = vec2( select( abs( vWN.x ).greaterThan( abs( vWN.z ) ), vP.z, vP.x ), abs( vP.y ) ).toVar();
    				const f = mix( qt, qa, arm ).toVar();
    				const s = n2( vec2( f.x.mul( 260. ), f.y.mul( 22. ) ) ).mul( .65 ).add( n2( vec2( f.x.mul( 610. ), f.y.mul( 60. ) ) ).mul( .35 ) ).toVar();
    				col.assign( mix( vWC, col, smoothstep( .25, .7, s ) ) );
    				col.mulAssign( add( .82, mul( .32, n2( f.mul( vec2( 28., 7. ) ) ) ) ) );

    			} ).ElseIf( pt.equal( 59 ), () => {

    				const bay = mod( mod( floor( fragCoord_.x ), 2. ).mul( 2. ).add( mod( floor( fragCoord_.y ), 2. ).mul( 3. ) ), 4. ).mul( .25 ).toVar();
    				const fr = pow( sub( 1., max( dot( n, v ), 0. ) ), 2. ).toVar();

    				If( bay.lessThan( .5 ).and( fr.lessThan( .55 ) ), () => {

    					Discard();

    				} );

    				col.assign( col.mul( add( .55, mul( .7, fr ) ) ) );
    				emi.addAssign( col.mul( fr ).mul( .25 ) );

    			} ).ElseIf( pt.equal( 60 ), () => {

    				const d = vWP.y.sub( vP.x ).toVar(), a = legA( vP ).toVar();
    				col.mulAssign( add( .92, mul( .1, n2( vec2( a.mul( 30. ), vP.x.mul( 260. ) ) ) ) ) );
    				col.mulAssign( sub( 1., mul( .16, step( d, .055 ) ).mul( smoothstep( .25, .75, abs( fract( a.mul( 9.549 ) ).sub( .5 ) ).mul( 2. ) ) ) ) );
    				col.assign( mix( col, vWB, step( abs( d.sub( .022 ) ), .0055 ) ) );
    				col.assign( mix( col, vWC, step( abs( d.sub( .036 ) ), .0055 ) ) );

    			} ).ElseIf( pt.equal( 61 ), () => {

    				const a = legA( vP ).mul( 7.003 ).toVar(), cu = fract( a ).sub( .5 ).toVar();
    				const st = smoothstep( .1, .42, abs( fract( vP.x.mul( 120. ).add( abs( cu ).mul( 1.3 ) ) ).sub( .5 ) ).mul( 2. ) ).toVar();
    				col.mulAssign( add( .8, mul( .26, st ) ).mul( add( .94, mul( .12, n2( vec2( a, vP.x.mul( 120. ) ) ) ) ) ) );

    			} ).ElseIf( pt.equal( 62 ), () => {

    				const e = select( vP.x.greaterThan( vWP.y ), q, vec2( legA( vP ).mul( .052 ), vP.x ) ).toVar();
    				const gd = abs( fract( vec2( e.x.add( e.y ), e.x.sub( e.y ) ).mul( 62. ) ).sub( .5 ) ).toVar();
    				const line = step( .42, max( gd.x, gd.y ) ).toVar();
    				const bay = mod( mod( floor( fragCoord_.x ), 2. ).mul( 2. ).add( mod( floor( fragCoord_.y ), 2. ).mul( 3. ) ), 4. ).mul( .25 ).toVar();
    				const net = mix( line, step( .7, bay ), smoothstep( 3., 5.5, length( uCam.sub( vW ) ) ) ).toVar();

    				If( net.lessThan( .5 ), () => {

    					col.assign( vSk.mul( .9 ) );
    					rgh.assign( .5 );
    					isSkin.assign( 1. );

    				} ).Else( () => {

    					col.mulAssign( .9 );
    					rgh.assign( .45 );

    				} );

    			} ).ElseIf( pt.equal( 63 ), () => {

    				const a = legA( vP ).toVar();
    				col.mulAssign( add( .84, mul( .3, n2( vec2( a.mul( 70. ), vP.x.mul( 520. ) ) ) ) ) );
    				col.mulAssign( sub( 1., mul( .18, step( vWP.y.sub( vP.x ), .04 ) ).mul( smoothstep( .25, .75, abs( fract( a.mul( 11.14 ) ).sub( .5 ) ).mul( 2. ) ) ) ) );

    			} ).ElseIf( pt.equal( 64 ), () => {

    				const a = floor( legA( vP ).mul( 9.549 ) ).div( 9.549 ).toVar(), h = floor( vP.x.sub( vWP.y ).add( .253 ).mul( 220. ) ).div( 220. ).toVar();
    				const tip = add( .07, mul( .05, add( .5, mul( .5, sin( a.mul( 5. ).add( 1.3 ) ) ) ) ) ).add( mul( .03, n2( vec2( a.mul( 3. ), 4. ) ) ) ).add( mul( .045, pow( abs( sin( a.mul( 4.5 ).add( h.mul( 7. ) ) ) ), 3. ) ) ).toVar();
    				const inF = step( h, tip ).toVar(), t = clamp( h.div( tip ), 0., 1. ).toVar();
    				col.assign( mix( col, mix( vWB, vWC, smoothstep( .3, .85, t ) ), inF ) );
    				col.assign( mix( col, vWC, inF.mul( step( h, tip.mul( .45 ) ) ).mul( step( .5, sin( a.mul( 9. ).add( 2. ) ) ) ) ) );

    			} ).ElseIf( pt.equal( 65 ), () => {

    				const fr = pow( sub( 1., max( dot( n, v ), 0. ) ), 1.5 ).toVar(), d = vWP.y.sub( vP.x ).toVar(), a = legA( vP ).toVar();
    				col.assign( mix( vSk, col, add( .42, mul( .5, fr ) ) ) );

    				If( d.lessThan( .036 ), () => {

    					const c = vec2( a.mul( 3.5 ), vP.x.mul( 90. ) ).toVar(), cf = fract( c ).sub( .5 ).toVar();
    					const fl = length( cf ).sub( .28 ).sub( mul( .08, cos( atan( cf.y, cf.x ).mul( 5. ) ) ) ).toVar();
    					const mesh = step( .35, abs( fract( c.x.mul( 4. ) ).sub( .5 ) ).add( abs( fract( c.y.mul( 4. ) ).sub( .5 ) ) ) ).toVar();
    					col.assign( mix( vSk.mul( .9 ), vWC, max( step( fl, 0. ), mesh.mul( .4 ).add( .5 ) ) ) );

    				} );

    				rgh.assign( .42 );

    			} ).ElseIf( pt.equal( 66 ), () => {

    				const a = legA( vP ).toVar(), u = a.sub( 1.5708 ).mul( .045 ).toVar(), hh = vP.x.sub( vWP.y ).add( .013 ).toVar();
    				col.assign( mix( col, vWB, step( a, -1.1 ).mul( step( -2.4, a ) ) ) );
    				col.assign( mix( col, vWB, step( vWP.y.sub( vP.x ), .008 ) ) );
    				const x = min( abs( u.sub( hh.mul( .9 ) ) ), abs( u.add( hh.mul( .9 ) ) ) ).toVar();
    				col.assign( mix( col, col.mul( .62 ), step( x, .0016 ).mul( step( abs( u ), .016 ) ) ) );
    				col.mulAssign( sub( 1., mul( .12, smoothstep( .3, .7, abs( fract( a.mul( 14.3 ) ).sub( .5 ) ).mul( 2. ) ) ) ) );

    			} ).ElseIf( pt.equal( 67 ), () => {

    				const fr = pow( sub( 1., max( dot( n, v ), 0. ) ), 1.2 ).toVar(), d = vWP.y.sub( vP.x ).toVar();
    				const e = select( vP.x.greaterThan( vWP.y.add( .02 ) ), q, vec2( legA( vP ).mul( .052 ), vP.x ) ).toVar(), g = e.mul( 26. ).toVar(), ci = floor( g ).toVar(), cf = fract( g ).sub( .5 ).toVar();
    				const alt = mod( ci.x.add( ci.y ), 2. ).toVar(), r = length( cf ).toVar(), an = atan( cf.y, cf.x ).toVar();
    				const motif = select( alt.greaterThan( .5 ), step( r, add( .2, mul( .14, abs( cos( an.mul( 2. ) ) ) ) ) ), step( abs( r.sub( .27 ) ), .05 ).add( step( abs( cf.x ), .04 ).mul( step( abs( cf.y ), .17 ) ) ) ).toVar();
    				const lace = step( abs( d.sub( .015 ) ), .015 ).mul( add( .5, mul( .5, step( .3, abs( fract( e.x.mul( 90. ) ).sub( .5 ) ).add( abs( fract( e.y.mul( 90. ) ).sub( .5 ) ) ) ) ) ) ).toVar();
    				col.assign( mix( vSk, col, clamp( add( .3, mul( .6, fr ) ).add( mul( .3, clamp( motif, 0., 1. ) ) ).add( mul( .5, lace ) ), 0., .97 ) ) );
    				rgh.assign( .38 );

    			} ).ElseIf( pt.equal( 68 ), () => {

    				const r = vec2( legA( vP ).mul( .6366 ), vP.x.div( .085 ) ).toVar(), sd = vec2( r.x.add( r.y ), r.x.sub( r.y ) ).toVar(), ci = floor( sd ).toVar();
    				col.assign( mix( col, vWB, mod( ci.x.add( ci.y ), 2. ) ) );
    				col.assign( mix( col, vWC, mod( ci.x, 2. ).mul( mod( ci.y, 2. ) ) ) );
    				const gl = abs( fract( sd ).sub( .5 ) ).toVar();
    				col.assign( mix( col, vec3( .8, .62, .26 ), step( min( gl.x, gl.y ), .018 ) ) );

    			} ).ElseIf( pt.equal( 69 ), () => {

    				const a = legA( vP ).toVar(), u = a.mul( .052 ).toVar(), h = vP.x.toVar();
    				col.mulAssign( add( .85, mul( .35, pow( sub( 1., max( dot( n, v ), 0. ) ), 2. ) ) ) );
    				const tk = step( abs( fract( h.mul( 100. ) ).sub( .5 ) ), .14 ).mul( step( abs( u ), mix( .0035, .009, step( .8, fract( h.mul( 20. ).add( .1 ) ) ) ) ) ).toVar();
    				const tx = step( abs( u.sub( .02 ) ), .0045 ).mul( step( .3, fract( h.mul( 55. ) ) ) ).mul( step( .35, h21( vec2( floor( h.mul( 55. ) ), 3. ) ) ) ).toVar();
    				const sv = clamp( tk.add( tx ), 0., 1. ).toVar();
    				col.assign( mix( col, vWC, sv ) );
    				met.assign( max( met, sv ) );
    				emi.addAssign( vWC.mul( sv ).mul( pow( max( dot( n, v ), 0. ), 6. ) ).mul( .9 ) );

    			} ).ElseIf( pt.equal( 70 ), () => {

    				const a = legA( vP ).toVar(), sd = select( vP.y.greaterThan( 0. ), 1., -1 ).toVar();
    				const e = vec2( a.mul( .052 ).sub( select( sd.greaterThan( 0. ), .055, -0.03 ) ), vP.x.sub( vWP.y ).add( select( sd.greaterThan( 0. ), .1, .14 ) ) ).toVar();
    				const t = fract( atan( e.y, e.x ).div( 6.2832 ).add( length( e ).mul( select( sd.greaterThan( 0. ), 18., 23. ) ) ).add( mul( .18, n2( e.mul( 60. ).add( sd.mul( 7. ) ) ) ) ) ).toVar();
    				col.assign( mix( mix( col, vWB, smoothstep( .28, .4, t ) ), vWC, smoothstep( .62, .74, t ) ) );
    				col.mulAssign( sub( 1., mul( .16, smoothstep( .25, .75, abs( fract( a.mul( 9.549 ) ).sub( .5 ) ).mul( 2. ) ) ) ) );

    			} ).ElseIf( pt.equal( 71 ), () => {

    				col.assign( mix( col, vWB, step( .5, fract( vP.x.div( .05 ) ) ) ) );
    				const d = vWP.y.sub( vP.x ).toVar(), a = legA( vP ).toVar();

    				If( vP.y.lessThan( 0. ).and( d.lessThan( .018 ) ), () => {

    					col.mulAssign( add( .75, mul( .45, n2( vec2( a.mul( 40. ), vP.x.mul( 400. ) ) ) ) ) );
    					col.assign( mix( col, vWB, step( .86, h21( vec2( floor( a.mul( 30. ) ), 1. ) ) ).mul( step( d, mul( .016, h21( vec2( floor( a.mul( 30. ) ), 2. ) ) ) ) ) ) );

    				} );

    			} ).ElseIf( pt.equal( 72 ), () => {

    				const d = vWP.y.sub( vP.x ).toVar(), a = legA( vP ).toVar();

    				If( d.lessThan( .07 ), () => {

    					col.assign( mix( col, vWB, step( abs( d.sub( .017 ) ), .006 ).add( step( abs( d.sub( .051 ) ), .006 ) ) ) );
    					col.assign( mix( col, vWC, step( abs( d.sub( .034 ) ), .0045 ) ) );

    				} ).Else( () => {

    					col.mulAssign( sub( 1., mul( .3, step( length( fract( vec2( a.mul( 22. ), vP.x.mul( 210. ) ) ).sub( .5 ) ), .24 ) ).mul( step( a, -0.6 ) ).mul( step( -2.5, a ) ) ) );

    				} );

    			} ).ElseIf( pt.equal( 73 ), () => {

    				const a = legA( vP ).toVar();
    				col.mulAssign( sub( 1., mul( .13, smoothstep( .25, .75, abs( fract( a.mul( 14.32 ) ).sub( .5 ) ).mul( 2. ) ) ) ) );
    				col.mulAssign( add( .93, mul( .1, n2( vec2( a.mul( 60. ), vP.x.mul( 500. ) ) ) ) ) );

    			} ).ElseIf( pt.equal( 74 ), () => {

    				col.mulAssign( add( .95, mul( .08, n2( q.mul( 300. ) ) ) ) );
    				const g = fract( vec2( sf.z, sf.x.add( sf.y.mul( .3 ) ) ).mul( 330. ) ).sub( .5 ).toVar();
    				col.mulAssign( sub( 1., mul( .55, step( length( g ), .2 ) ).mul( step( .125, sf.z ) ).mul( step( .028, sf.x ) ) ) );

    			} ).ElseIf( pt.equal( 75 ), () => {

    				col.mulAssign( add( .92, mul( .12, n2( q.mul( 420. ) ) ) ) );
    				col.mulAssign( sub( 1., mul( .3, step( abs( sf.z.sub( .158 ) ), .0007 ) ).mul( step( .5, fract( sf.x.add( sf.y ).mul( 260. ) ) ) ).mul( step( .022, sf.x ) ) ) );

    			} ).ElseIf( pt.equal( 76 ), () => {

    				col.mulAssign( mix( 1., .55, smoothstep( .12, .2, sf.z ) ).mul( mix( 1., .7, smoothstep( -0.03, -0.09, sf.z ) ) ).mul( add( .96, mul( .06, n2( q.mul( 200. ) ) ) ) ) );

    			} ).ElseIf( pt.equal( 77 ), () => {

    				col.mulAssign( sub( 1., mul( .22, step( length( fract( q.mul( 320. ) ).sub( .5 ) ), .25 ) ) ) );
    				col.assign( mix( col, col.mul( .72 ), smoothstep( .55, .85, n2( q.mul( 45. ) ) ).mul( .7 ) ) );

    			} ).ElseIf( pt.equal( 78 ), () => {

    				col.mulAssign( add( .86, mul( .18, smoothstep( .2, .8, abs( fract( sf.y.mul( 320. ) ).sub( .5 ) ).mul( 2. ) ) ) ) );
    				const dd = min( wDigit( vec2( sf.z.add( .004 ), sf.y.sub( .135 ) ).div( .011 ), 0., .1 ), wDigit( vec2( sf.z.sub( .004 ), sf.y.sub( .135 ) ).div( .011 ), 7., .1 ) ).toVar();
    				const lat = step( .02, sf.x ).toVar();
    				col.assign( mix( col, vWC, step( dd, 0. ).mul( lat ) ) );
    				emi.addAssign( vWC.mul( 1.4 ).mul( step( dd, 0. ) ).mul( lat ) );

    			} ).ElseIf( pt.equal( 79 ), () => {

    				const g = floor( q.div( .022 ) ).toVar();
    				col.assign( mix( col, vWB, mod( g.x.add( g.y ), 2. ) ) );

    			} ).ElseIf( pt.equal( 80 ), () => {

    				col.mulAssign( add( .8, mul( .3, n2( q.mul( 420. ) ) ).mul( add( .85, mul( .3, n2( q.mul( 60. ) ) ) ) ) ) );

    			} ).ElseIf( pt.equal( 81 ), () => {

    				col.mulAssign( add( .84, mul( .24, n2( q.mul( 380. ) ) ) ) );
    				const ln = step( .135, sf.z ).mul( step( sf.z, .151 ) ).mul( step( abs( fract( sf.z.sub( .135 ).div( .004 ) ).sub( .5 ) ), .12 ) ).mul( step( .4, fract( sf.x.add( sf.y ).mul( 300. ) ) ) ).toVar();
    				col.mulAssign( sub( 1., mul( .35, ln ).mul( step( .02, sf.y ) ) ) );

    			} ).ElseIf( pt.equal( 82 ), () => {

    				const g = fract( vec2( sf.z, sf.x.add( sf.y ) ).mul( 300. ) ).sub( .5 ).toVar();
    				const hole = step( length( g ), .22 ).toVar();
    				const rows = step( abs( sf.z.sub( .15 ) ), .0022 ).add( step( abs( sf.y.sub( .045 ) ), .0022 ).mul( step( -0.05, sf.z ) ).mul( step( sf.z, .13 ) ) ).toVar();
    				const md = vec2( sf.z.sub( .178 ), sf.x.add( .012 ) ).toVar();
    				const med = step( abs( length( md ).sub( .008 ) ), .0018 ).mul( step( .5, fract( atan( md.y, md.x ).mul( 1.43 ) ) ) ).add( step( length( md ), .0015 ) ).toVar();
    				col.mulAssign( mix( 1., .5, smoothstep( .13, .21, sf.z ) ).mul( mix( 1., .7, smoothstep( -0.03, -0.09, sf.z ) ) ) );
    				col.mulAssign( sub( 1., mul( .6, clamp( hole.mul( rows ).add( med ), 0., 1. ) ) ) );

    			} ).ElseIf( pt.equal( 83 ), () => {

    				col.mulAssign( add( .93, mul( .1, n2( q.mul( 350. ) ) ) ) );

    			} ).ElseIf( pt.equal( 84 ), () => {

    				col.assign( mix( vCol, vWB, smoothstep( .17, -0.06, sf.z ) ) );
    				col.mulAssign( add( .84, mul( .22, smoothstep( .25, .75, abs( fract( sf.y.mul( 260. ).add( abs( fract( sf.z.mul( 90. ) ).sub( .5 ) ) ) ).sub( .5 ) ).mul( 2. ) ) ) ) );

    			} ).ElseIf( pt.equal( 85 ), () => {

    				col.mulAssign( add( .82, mul( .26, n2( q.mul( 90. ) ) ) ) );
    				const a = legA( vP ).toVar(), hh = sf.y.toVar(), sh = step( .1, hh ).toVar();
    				const w1 = abs( sin( a.mul( 4. ).add( mul( 1.6, sin( hh.mul( 38. ) ) ) ) ) ).toVar(), w2 = abs( sin( a.mul( 4. ).add( mul( 1.6, sin( hh.mul( 38. ) ) ) ).add( .55 ) ) ).toVar();
    				const fe = step( abs( fract( hh.mul( 60. ).add( abs( sin( a.mul( 4. ) ) ).mul( 2. ) ) ).sub( .5 ) ), .08 ).mul( step( w1, .35 ) ).toVar();
    				col.assign( mix( col, vec3( .88, .82, .68 ), step( w1, .05 ).mul( sh ) ) );
    				col.assign( mix( col, vec3( .16, .7, .68 ), max( step( w2, .045 ), fe.mul( .8 ) ).mul( sh ) ) );

    			} ).ElseIf( pt.equal( 86 ), () => {

    				col.mulAssign( add( .9, mul( .12, n2( q.mul( 700. ) ) ) ) );
    				const tx = step( abs( sf.x.add( .005 ) ), .016 ).mul( step( abs( sf.z.sub( .07 ) ), .004 ) ).mul( step( .4, fract( sf.x.mul( 180. ) ) ) ).mul( step( .6, n.y ) ).toVar();
    				col.mulAssign( sub( 1., mul( .25, tx ) ) );

    			} ).Else( () => {

    				const an = pow( abs( vWN ).add( .001 ), vec3( 4. ) ).toVar();
    				an.divAssign( an.x.add( an.y ).add( an.z ) );
    				const acc = vec3( 0. ).toVar();

    				If( an.y.greaterThan( .02 ), () => {

    					acc.addAssign( wearTile( pt, vec2( vP.z, vP.x ), col ).mul( an.y ) );

    				} );

    				If( an.z.greaterThan( .02 ), () => {

    					acc.addAssign( wearTile( pt, vec2( vP.y, vP.x ), col ).mul( an.z ) );

    				} );

    				If( an.x.greaterThan( .02 ), () => {

    					acc.addAssign( wearTile( pt, vec2( vP.y, vP.z ), col ).mul( an.x ) );

    				} );

    				col.assign( acc );

    			} );

    			If( pt.equal( 32 ).or( pt.equal( 37 ) ).or( pt.equal( 39 ) ).or( pt.equal( 49 ) ).or( pt.equal( 51 ) ).or( pt.equal( 53 ) ), () => {

    				col.mulAssign( add( .8, mul( .55, pow( sub( 1., max( dot( n, v ), 0. ) ), 2. ) ) ) );

    			} );

    			If( pt.equal( 49 ), () => {

    				const cxs = floor( vWP.y ).mul( .01 ).toVar(), hm = fract( vWP.y ).mul( 10. ).toVar();
    				const d = select( abs( vP.y ).lessThan( cxs.sub( .01 ) ), abs( fract( vP.x.sub( hm ).div( .1 ).add( .5 ) ).sub( .5 ) ).mul( .1 ), abs( fract( abs( vP.y ).sub( cxs ).div( .085 ).add( .5 ) ).sub( .5 ) ).mul( .085 ) ).toVar();
    				col.mulAssign( mix( .3, 1., smoothstep( .0015, .012, d ) ) );

    			} );

    			If( pt.equal( 45 ), () => {

    				const g = q.mul( vWP.y ).toVar();
    				g.x.addAssign( step( .5, fract( g.y.mul( .5 ) ) ).mul( .5 ) );
    				emi.addAssign( col.mul( pow( fract( h21( floor( g ) ).mul( 7.3 ).add( dot( v, vec3( 2.1, 1.3, 1.7 ) ).mul( 1.6 ) ) ), 24. ) ).mul( 2.2 ) );
    				rgh.assign( .25 );

    			} );

    		} );

    		const wcode = floor( vWP.z.mul( .1 ) ).toVar();

    		If( tp.equal( 0 ).and( wcode.greaterThanEqual( 10. ) ).and( wcode.lessThan( 100. ) ), () => {

    			const e = vec2( vP.y, vP.x.sub( 1.24 ) ).div( .085 ).toVar();
    			e.x.addAssign( e.y.mul( .12 ) );
    			const dd = min( wDigit( e.sub( vec2( -0.42, 0. ) ), floor( wcode.mul( .1 ) ), .085 ), wDigit( e.sub( vec2( .42, 0. ) ), mod( wcode, 10. ), .085 ) ).toVar();
    			const word = step( abs( e.y.sub( .95 ) ), .1 ).mul( step( abs( e.x ), 1.1 ) ).mul( step( .35, fract( e.x.mul( 4.3 ).add( mul( .2, sin( e.y.mul( 20. ) ) ) ) ) ) ).toVar();
    			col.assign( mix( col, vWB, step( dd, .07 ).mul( front ) ) );
    			col.assign( mix( col, vWC, max( step( dd, 0. ), word ).mul( front ) ) );

    		} ).ElseIf( tp.equal( 0 ).and( wcode.greaterThanEqual( 100. ) ), () => {

    			const e = vec2( abs( vP.y ), vP.x.sub( 1.27 ) ).div( .1 ).toVar();
    			const wing = step( e.x, 1.25 ).mul( step( .08, e.x ) ).mul( step( e.y, mul( .55, e.x ).add( .15 ).sub( mul( .25, e.x ).mul( e.x ) ) ) ).mul( step( mul( .1, e.x ).sub( .25 ).add( mul( .09, abs( sin( e.x.mul( 9. ) ) ) ) ), e.y ) ).toVar();
    			const bodyE = step( length( e.mul( vec2( 3.2, 1.2 ) ).sub( vec2( 0., .1 ) ) ), .55 ).add( step( length( e.sub( vec2( 0., .48 ) ) ), .13 ) ).toVar();
    			const fl = step( e.y, -0.25 ).mul( step( -0.95, e.y ) ).mul( step( abs( e.x ), mul( .3, add( 1., e.y ) ).mul( add( .6, mul( .4, sin( e.y.mul( 18. ).add( e.x.mul( 6. ) ) ) ) ) ) ) ).toVar();
    			col.assign( mix( col, vWB, clamp( wing.add( bodyE ), 0., 1. ).mul( back ) ) );
    			col.assign( mix( col, vWC, fl.mul( back ) ) );

    		} );

    		If( tp.equal( 1 ), () => {

    			col.assign( select( pt.equal( 5 ), col.mul( .82 ), vWB ) );

    		} ).ElseIf( tp.equal( 7 ), () => {

    			col.assign( vWC );

    		} ).ElseIf( tp.equal( 6 ), () => {

    			col.assign( vWB );

    		} ).ElseIf( tp.equal( 8 ), () => {

    			const g = fract( q.mul( vec2( 230., 260. ) ) ).sub( .5 ).toVar();

    			If( length( g ).lessThan( .3 ), () => {

    				Discard();

    			} );

    			col.assign( vWB );

    		} );

    		If( pt.equal( 75 ).and( tp.equal( 1 ) ), () => {

    			col.assign( mix( col, vWC, step( abs( sf.y.sub( .016 ) ), .0011 ).add( step( abs( sf.y.sub( .024 ) ), .0011 ) ) ) );

    		} ).ElseIf( pt.equal( 76 ).and( tp.equal( 7 ) ), () => {

    			col.assign( mix( vWB, vWC, step( .45, fract( sf.z.add( sf.x ).mul( 220. ) ) ) ) );

    		} ).ElseIf( pt.equal( 83 ).and( tp.equal( 1 ) ), () => {

    			col.mulAssign( add( .62, mul( .5, h21( floor( q.mul( 650. ) ) ) ).mul( add( .8, mul( .3, n2( q.mul( 80. ) ) ) ) ) ) );

    		} ).ElseIf( pt.equal( 80 ).and( tp.equal( 1 ) ), () => {

    			col.mulAssign( sub( 1., mul( .16, step( .88, max( fract( q.x.mul( 160. ) ), fract( q.y.mul( 160. ) ) ) ) ) ) );

    		} );

    		If( tp.lessThanEqual( 1 ).and( pt.notEqual( 21 ) ).or( tp.greaterThanEqual( 7 ).and( tp.lessThanEqual( 9 ) ) ), () => {

    			col.mulAssign( add( 1., sin( vP.x.mul( 610. ).add( vP.y.mul( 420. ) ) ).mul( sin( vP.x.mul( 380. ).sub( vP.z.mul( 520. ) ) ) ).mul( .018 ) ) );

    		} );

    		rgh.assign( clamp( vWP.z.sub( wcode.mul( 10. ) ).sub( uRain.mul( .12 ).mul( clamp( n.y, 0., 1. ) ) ), .3, .95 ) );
    		rgh.assign( mix( .48, .95, rgh.sub( .3 ).div( .65 ) ) );

    		If( tp.equal( 2 ), () => {

    			col.assign( vec3( .62, .60, .56 ) );
    			rgh.assign( .32 );
    			met.assign( 1. );

    		} ).ElseIf( tp.equal( 3 ), () => {

    			col.assign( vec3( 1., .7, .3 ) );
    			rgh.assign( .28 );
    			met.assign( 1. );

    		} ).ElseIf( tp.equal( 4 ), () => {

    			emi.assign( vWC.mul( 2.4 ) );
    			col.assign( vWC.mul( .15 ) );
    			rgh.assign( .4 );

    		} ).ElseIf( tp.equal( 5 ), () => {

    			const fr = pow( sub( 1., max( dot( n, v ), 0. ) ), 3. ).toVar();
    			const lc = mix( vWC, vWB, lg ).toVar();
    			col.assign( lc.mul( vWP.y ).add( .01 ) );
    			rgh.assign( .05 );
    			emi.assign( lc.mul( fr ).mul( .22 ) );

    			If( pt.equal( 1 ), () => {

    				col.assign( mix( vec3( .5 ), lc, .3 ) );
    				met.assign( 1. );
    				rgh.assign( .06 );
    				emi.assign( vec3( 0. ) );

    			} ).ElseIf( pt.equal( 2 ), () => {

    				const ir = add( .5, mul( .5, cos( mul( 6.2832, dot( n, v ).mul( .9 ).add( lg.mul( .4 ) ).add( vec3( 0., .33, .67 ) ) ) ) ) ).toVar();
    				col.assign( mix( lc, ir, .55 ).mul( .55 ) );
    				met.assign( 1. );
    				rgh.assign( .07 );
    				emi.assign( ir.mul( fr ).mul( .15 ) );

    			} ).ElseIf( pt.equal( 3 ), () => {

    				If( fr.lessThan( .22 ), () => {

    					Discard();

    				} );

    				col.assign( vec3( .8 ) );
    				rgh.assign( .03 );
    				emi.assign( vec3( fr.mul( .25 ) ) );

    			} );

    		} ).ElseIf( tp.equal( 10 ), () => {

    			col.assign( vCol );
    			rgh.assign( .3 );
    			met.assign( 1. );

    		} ).ElseIf( tp.equal( 6 ), () => {

    			rgh.assign( .2 );

    		} ).ElseIf( tp.equal( 11 ), () => {

    			const h = q.mul( 160. ).toVar(), r = vec2( 1., 1.732 ).toVar(), a = mod( h, r ).sub( r.mul( .5 ) ).toVar(), b2 = mod( h.sub( r.mul( .5 ) ), r ).sub( r.mul( .5 ) ).toVar();
    			const g = select( dot( a, a ).lessThan( dot( b2, b2 ) ), a, b2 ).toVar();
    			const hx = max( abs( g.x ).mul( .866 ).add( abs( g.y ).mul( .5 ) ), abs( g.y ) ).toVar();
    			col.assign( vWB.mul( add( .7, mul( .45, smoothstep( .36, .44, hx ) ) ) ) );
    			rgh.assign( .55 );

    		} ).ElseIf( tp.equal( 12 ), () => {

    			col.assign( vec3( .9, .88, .84 ) );
    			rgh.assign( .25 );
    			emi.assign( vec3( .05, .05, .06 ).mul( pow( sub( 1., max( dot( n, v ), 0. ) ), 2. ) ) );

    		} ).ElseIf( tp.equal( 13 ), () => {

    			col.assign( vWC.mul( add( .74, mul( .34, n2( q.mul( 520. ) ) ) ) ).mul( add( .86, mul( .16, n2( q.mul( 90. ) ) ) ) ) );
    			rgh.assign( .95 );

    		} ).ElseIf( tp.equal( 15 ), () => {

    			col.assign( vWC );
    			rgh.assign( .22 );

    		} );

    		If( pt.greaterThanEqual( 87 ), () => {

    			const fr = pow( sub( 1., max( dot( n, v ), 0. ) ), 2. ).toVar(), glint = dot( v, vec3( 2.1, 1.3, 1.7 ) ).mul( 1.9 ).add( dot( n, vec3( 1.7, 2.3, .9 ) ) ).toVar();

    			If( pt.equal( 87 ).and( tp.equal( 10 ) ), () => {

    				const g = q.mul( 900. ).toVar();
    				const dm = step( length( fract( g ).sub( .5 ) ), .42 ).mul( step( .18, h21( floor( g ).add( 7. ) ) ) ).toVar();
    				col.assign( mix( col, vec3( .86, .88, .92 ), dm.mul( .6 ) ) );
    				met.assign( 1. );
    				rgh.assign( mix( .3, .22, dm ) );
    				emi.addAssign( vec3( 1. ).mul( dm ).mul( pow( fract( h21( floor( g ) ).mul( 7.3 ).add( glint ) ), 28. ) ).mul( 3.2 ) );

    			} ).ElseIf( pt.equal( 88 ), () => {

    				If( tp.equal( 10 ), () => {

    					col.mulAssign( add( .86, mul( .22, h21( floor( vec2( q.x.mul( 2600. ), q.y.mul( 30. ) ) ) ) ) ) );
    					rgh.assign( .3 );

    				} ).ElseIf( tp.equal( 7 ), () => {

    					col.assign( mix( col, vWB, add( .35, mul( .3, n2( q.mul( 900. ) ) ) ) ) );

    				} );

    			} ).ElseIf( pt.equal( 89 ), () => {

    				const g = q.mul( 520. ).toVar();
    				const th = select( mod( floor( g.x ).add( floor( g.y ) ), 2. ).greaterThan( .5 ), fract( g.x ), fract( g.y ) ).toVar();

    				If( tp.lessThanEqual( 1 ), () => {

    					col.mulAssign( add( .8, mul( .24, smoothstep( 0., .5, th ) ).mul( smoothstep( 1., .5, th ) ) ) );

    				} );

    				If( tp.equal( 1 ), () => {

    					emi.addAssign( vec3( .5 ).mul( step( .94, h21( floor( q.mul( 800. ) ) ) ) ).mul( pow( max( dot( n, v ), 0. ), 6. ) ) );

    				} );

    				If( tp.equal( 7 ), () => {

    					emi.addAssign( vWC.mul( add( .25, fr.mul( .6 ) ) ) );

    				} );

    			} ).ElseIf( pt.equal( 90 ).and( tp.equal( 10 ) ), () => {

    				const f = step( .5, fract( q.x.add( q.y ).mul( 800. ) ) ).toVar();
    				col.mulAssign( add( .78, mul( .42, f ) ) );
    				rgh.assign( .28 );
    				emi.addAssign( col.mul( f ).mul( pow( fract( dot( n, vec3( 3.1, 2.2, 1.4 ) ).mul( 4. ).add( dot( v, vec3( 1.3, 2., .7 ) ).mul( 2. ) ) ), 24. ) ).mul( 2. ) );

    			} ).ElseIf( pt.equal( 91 ).and( tp.equal( 0 ) ), () => {

    				const r = fract( vP.x.div( .038 ) ).toVar(), web = step( .16, r ).mul( step( r, .82 ) ).toVar(), tack = step( abs( fract( vP.y.div( .038 ) ).sub( .5 ) ), .05 ).mul( web ).toVar();
    				col.assign( mix( col.mul( .62 ), vWB, web.mul( .55 ) ).mul( sub( 1., mul( .35, tack ) ) ) );
    				col.mulAssign( add( .88, mul( .14, step( .5, fract( q.x.mul( 600. ) ) ) ).mul( step( .5, fract( q.y.mul( 600. ) ) ) ) ) );

    			} ).ElseIf( pt.equal( 92 ), () => {

    				If( tp.equal( 0 ), () => {

    					const g = q.div( .022 ).toVar(), ci = floor( g ).toVar(), f = fract( g ).sub( .5 ).toVar();
    					const r = length( f ).toVar(), a = atan( f.y, f.x ).toVar();
    					const flower = step( r, add( .17, mul( .1, abs( cos( a.mul( 2. ) ) ) ) ) ).mul( step( .06, r ) ).toVar();
    					const star = step( pow( abs( f.x ), .5 ).add( pow( abs( f.y ), .5 ) ), .6 ).toVar();
    					const dia = step( abs( f.x.add( .5 ).sub( step( 0., f.x ) ) ).add( abs( f.y.add( .5 ).sub( step( 0., f.y ) ) ) ), .09 ).toVar();
    					col.assign( mix( col, vWC, clamp( mix( flower, star, mod( ci.x.add( ci.y ), 2. ) ).add( dia ), 0., 1. ) ) );
    					col.mulAssign( add( .92, mul( .1, n2( q.mul( 500. ) ) ) ) );
    					rgh.assign( .45 );

    				} ).ElseIf( tp.equal( 1 ), () => {

    					col.mulAssign( add( .9, mul( .12, n2( q.mul( 700. ) ) ) ) );
    					rgh.assign( .35 );

    				} );

    			} ).ElseIf( pt.equal( 93 ).and( tp.equal( 10 ) ), () => {

    				col.mulAssign( mix( .4, 1.05, clamp( smoothstep( .3, .8, n2( q.mul( 700. ) ) ).mul( .45 ).add( pow( max( dot( n, v ), 0. ), .6 ).mul( .7 ) ), 0., 1. ) ) );
    				rgh.assign( .3 );

    			} ).ElseIf( pt.equal( 94 ), () => {

    				If( tp.equal( 4 ), () => {

    					const hue = add( .5, mul( .5, cos( mul( 6.2832, uTime.mul( .22 ).add( vP.y.mul( 2.5 ) ).add( vec3( 0., .33, .67 ) ) ) ) ) ).toVar();
    					emi.assign( mix( vWC, hue, .6 ).mul( 2.4 ) );
    					col.assign( emi.mul( .06 ) );

    				} ).ElseIf( tp.equal( 0 ), () => {

    					rgh.assign( .25 );

    				} );

    			} ).ElseIf( pt.equal( 95 ), () => {

    				If( tp.equal( 0 ), () => {

    					col.mulAssign( add( .9, mul( .12, n2( q.mul( 500. ) ) ) ) );
    					col.mulAssign( sub( 1., mul( .6, step( length( fract( q.mul( 400. ) ).sub( .5 ) ), .17 ) ).mul( step( .3, aw.y ) ) ) );
    					rgh.assign( .42 );

    				} );

    			} ).ElseIf( pt.equal( 96 ), () => {

    				If( tp.lessThanEqual( 1 ), () => {

    					col.mulAssign( add( .84, mul( .2, step( .5, fract( q.x.mul( 330. ) ) ) ) ).add( mul( .06, n2( q.mul( 900. ) ) ) ) );

    				} ).ElseIf( tp.equal( 7 ).and( vWP.w.sub( float( tp ) ).greaterThan( .004 ) ), () => {

    					const e = vec2( vP.y.mul( 14. ), lg.mul( 7. ) ).toVar();
    					const b = n2( e.mul( 1.2 ) ).mul( .65 ).add( n2( e.mul( 3.1 ) ).mul( .35 ) ).toVar();
    					const spray = add( .5, mul( .5, cos( mul( 6.2832, lg.mul( .9 ).add( vec3( 0., .33, .67 ) ).add( n2( e.mul( .7 ) ).mul( .6 ) ) ) ) ) ).toVar();
    					const drip = step( fract( vP.y.mul( 90. ) ), .25 ).mul( step( lg, b.mul( .9 ).sub( .05 ).add( mul( .25, h21( vec2( floor( vP.y.mul( 90. ) ), 3. ) ) ) ) ) ).toVar();
    					col.assign( mix( vec3( .9, .88, .82 ), spray, step( .48, b ) ) );
    					col.assign( mix( col, vec3( .02 ), step( abs( b.sub( .48 ) ), .02 ) ) );
    					col.assign( mix( col, spray, drip.mul( step( b, .48 ) ) ) );
    					col.assign( mix( col, vec3( .02 ), step( abs( fract( lg.mul( 6. ).add( mul( .3, sin( vP.y.mul( 60. ) ) ) ) ).sub( .5 ) ), .015 ).mul( step( .75, n2( e.mul( .5 ) ) ) ) ) );
    					rgh.assign( .5 );

    				} );

    			} ).ElseIf( pt.equal( 97 ), () => {

    				If( tp.equal( 0 ), () => {

    					const ir = add( .5, mul( .5, cos( mul( 6.2832, dot( n, v ).mul( 2. ).add( dot( n, vec3( 3., 1., 2. ) ) ).add( vec3( 0., .33, .67 ) ) ) ) ) ).toVar();
    					col.assign( mix( vec3( .85 ), ir, .35 ) );
    					rgh.assign( .12 );
    					emi.addAssign( ir.mul( pow( fract( dot( n, vec3( 5.1, 3.3, 4.7 ) ).add( dot( v, vec3( 1., 2., 1.5 ) ) ) ), 20. ) ).mul( 2.5 ) );

    				} );

    			} ).ElseIf( pt.equal( 98 ).and( tp.equal( 0 ) ), () => {

    				const an = pow( aw.add( .001 ), vec3( 4. ) ).toVar();
    				an.divAssign( an.x.add( an.y ).add( an.z ) );
    				col.assign( wearTile( 42, vec2( vP.z, vP.x ), col ).mul( an.y ).add( wearTile( 42, vec2( vP.y, vP.x ), col ).mul( an.z ) ).add( wearTile( 42, vec2( vP.y, vP.z ), col ).mul( an.x ) ) );
    				const f = fract( q.mul( vWP.y ).add( .5 ) ).sub( .5 ).toVar();
    				col.assign( mix( col, vWB, step( length( abs( f ).sub( .07 ) ), .03 ).mul( step( .12, length( f ) ) ).mul( step( length( f ), .2 ) ) ) );
    				col.mulAssign( add( .94, mul( .08, sin( q.x.mul( 1300. ) ) ).mul( sin( q.y.mul( 1300. ) ) ) ) );

    			} ).ElseIf( pt.equal( 99 ), () => {

    				If( tp.equal( 0 ), () => {

    					const d = fract( vP.x.add( vP.y ).div( .03 ) ).toVar();
    					col.assign( mix( col, vWB, step( d, .2 ) ) );
    					col.assign( mix( col, vWC, step( abs( d.sub( .28 ) ), .018 ) ) );
    					col.mulAssign( add( .85, mul( .45, fr ) ) );
    					rgh.assign( .38 );

    				} ).ElseIf( tp.equal( 7 ), () => {

    					const x = vP.y.div( .0265 ).toVar(), y = lg.toVar();
    					col.assign( vWC );

    					If( y.greaterThan( .8 ), () => {

    						col.assign( mix( vCol, vWB, step( abs( y.sub( .89 ) ), .025 ).mul( step( abs( x ), .62 ) ).mul( step( .3, fract( x.mul( 9. ) ) ) ) ) );

    					} ).ElseIf( y.greaterThan( .38 ).and( y.lessThan( .72 ) ).and( x.lessThan( -0.12 ) ).and( x.greaterThan( -0.86 ) ), () => {

    						col.assign( mix( vec3( .55, .6, .66 ), vec3( .82, .72, .62 ), step( length( vec2( x.add( .49 ).mul( .9 ), y.sub( .58 ) ) ), .14 ) ) );

    					} ).ElseIf( y.greaterThan( .4 ).and( y.lessThan( .7 ) ).and( x.greaterThan( .02 ) ).and( x.lessThan( .86 ) ), () => {

    						col.assign( mix( col, vec3( .16, .18, .22 ), step( abs( fract( y.sub( .4 ).div( .1 ) ).sub( .5 ) ), .16 ).mul( step( x, sub( .86, mul( .25, step( .55, y ) ) ) ) ) ) );

    					} ).ElseIf( y.greaterThan( .08 ).and( y.lessThan( .24 ) ).and( abs( x ).lessThan( .8 ) ), () => {

    						col.assign( mix( col, vec3( .04 ), step( .5, h21( vec2( floor( x.mul( 46. ) ), 1. ) ) ) ) );

    					} );

    					rgh.assign( .3 );

    				} );

    			} );

    		} );

    	} ).ElseIf( s.equal( 6 ).or( s.equal( 7 ) ), () => {

    		col.assign( vCol.mul( mix( vec3( 1. ), det, select( s.equal( 6 ), .96, .68 ) ) ) );

    		If( s.equal( 6 ).and( uTrait.z.greaterThan( .45 ) ), () => {

    			const temple = smoothstep( .055, .085, abs( vP.y ) ).mul( smoothstep( 1.56, 1.66, vP.x ) ).toVar();
    			col.assign( mix( col, vec3( .38, .38, .40 ), temple.mul( uTrait.z.sub( .45 ) ).mul( 1.1 ) ) );

    		} );

    		rgh.assign( sub( .48, uRain.mul( .08 ) ) );

    	} ).ElseIf( s.equal( 5 ), () => {

    		const soleM = sub( 1., smoothstep( .015, .019, vP.x ) ).toVar();
    		const groove = sub( 1., mul( .38, exp( pow( vP.x.sub( .0175 ).div( .0025 ), 2. ).negate() ) ) ).toVar();
    		const soleCol = select( uTrait.y.lessThan( .34 ), vec3( .46, .45, .42 ), vec3( .025, .025, .028 ) ).toVar();
    		const collarAo = mix( .66, 1., smoothstep( .112, .078, vP.x ) ).toVar();
    		col.assign( mix( vCol.mul( collarAo ), soleCol, soleM ).mul( groove ) );
    		rgh.assign( mix( add( .38, fract( uTrait.y.mul( 3.1 ) ).mul( .34 ) ), .78, soleM ) );
    		const strip = exp( pow( vP.x.sub( .0195 ).div( .0035 ), 2. ).negate() ).mul( step( .001, uGlow.w ) ).toVar();
    		emi.assign( uGlow.rgb.mul( uGlow.w.mul( .42 ).mul( strip ) ) );

    	} ).Else( () => {

    		const weave = sin( vP.x.mul( 260. ).add( vP.y.mul( 190. ) ) ).mul( sin( vP.x.mul( 190. ).sub( vP.z.mul( 240. ) ) ) ).mul( .025 ).toVar();
    		const foldWave = float( 0. ).toVar();

    		If( s.equal( 1 ), () => {

    			const waistBand = exp( pow( vP.x.sub( .98 ).div( .075 ), 2. ).negate() ).toVar();
    			const chestSide = smoothstep( .07, .17, abs( vP.y ) ).mul( exp( pow( vP.x.sub( 1.28 ).div( .12 ), 2. ).negate() ) ).toVar();
    			foldWave.assign( sin( vP.x.mul( 68. ).add( vP.y.mul( 22. ) ) ).mul( .09 ).mul( waistBand ).add( sin( vP.x.mul( 54. ).sub( abs( vP.y ).mul( 35. ) ) ).mul( .06 ).mul( chestSide ) ) );

    		} ).ElseIf( s.equal( 2 ), () => {

    			const elbow = exp( pow( abs( vP.y ).sub( .33 ).div( .085 ), 2. ).negate() ).toVar();
    			foldWave.assign( sin( abs( vP.y ).mul( 95. ).add( vP.z.mul( 30. ) ) ).mul( .10 ).mul( elbow ) );
    			col.mulAssign( mix( .80, 1., smoothstep( .56, .51, abs( vP.y ) ) ) );

    		} ).ElseIf( s.equal( 3 ), () => {

    			const hemShadow = mix( .66, 1., smoothstep( .965, .915, vP.x ) ).toVar();
    			const lapFold = exp( pow( vP.x.sub( .86 ).div( .065 ), 2. ).negate() ).toVar();
    			foldWave.assign( sin( vP.x.mul( 78. ).add( abs( vP.y ).mul( 28. ) ) ).mul( .08 ).mul( lapFold ) );
    			col.mulAssign( hemShadow );

    		} ).ElseIf( s.equal( 4 ), () => {

    			const kneeFold = exp( pow( vP.x.sub( .50 ).div( .09 ), 2. ).negate() ).toVar();
    			const cuffBreak = exp( pow( vP.x.sub( .145 ).div( .048 ), 2. ).negate() ).toVar();
    			foldWave.assign( sin( vP.x.mul( 82. ).add( vP.z.mul( 24. ) ) ).mul( .085 ).mul( kneeFold ).add( sin( vP.x.mul( 115. ).add( vP.y.mul( 30. ) ) ).mul( .11 ).mul( cuffBreak ) ) );
    			const cuffHem = mix( .72, 1., smoothstep( .105, .135, vP.x ) ).toVar();
    			col.mulAssign( cuffHem );

    		} ).ElseIf( s.equal( 9 ), () => {

    			col.mulAssign( mix( .92, 1.04, det.r ) );

    			If( n.y.lessThan( -0.15 ), () => {

    				col.mulAssign( .62 );

    			} );

    		} );

    		const isTop = select( s.equal( 1 ).or( s.equal( 2 ).and( uPat.w.greaterThan( .5 ) ) ), 1., 0. ).toVar();

    		If( isTop.greaterThan( .5 ), () => {

    			const hemLine = sub( 1., mul( .16, exp( pow( vP.x.sub( .945 ).div( .012 ), 2. ).negate() ) ) ).toVar();
    			col.mulAssign( hemLine );

    			If( uPat.x.greaterThan( .5 ).and( uPat.x.lessThan( 1.5 ) ).and( s.equal( 1 ) ), () => {

    				const frontM = smoothstep( -0.01, .035, vP.z ).mul( step( vP.x, 1.44 ) ).toVar();
    				const openW = add( .044, mul( .018, smoothstep( .96, 1.38, vP.x ) ) ).toVar();
    				const innerM = sub( 1., smoothstep( openW.sub( .005 ), openW.add( .004 ), abs( vP.y ) ) ).mul( frontM ).toVar();
    				const lapelShadow = exp( pow( abs( vP.y ).sub( openW ).div( .007 ), 2. ).negate() ).mul( frontM ).toVar();
    				col.assign( mix( col, uInnerC, innerM.mul( uPat.z ) ) );
    				col.mulAssign( sub( 1., mul( .34, lapelShadow ) ) );

    			} ).ElseIf( uPat.x.greaterThanEqual( 1.5 ).and( uPat.x.lessThan( 2.5 ) ), () => {

    				const rib = sub( 1., smoothstep( .95, .985, vP.x ) ).mul( select( s.equal( 1 ), 1., 0. ) ).add( smoothstep( .52, .56, abs( vP.y ) ).mul( select( s.equal( 2 ), 1., 0. ) ) ).toVar();
    				const pocket = step( .98, vP.x ).mul( step( vP.x, 1.13 ) ).mul( step( abs( vP.y ), .105 ) ).mul( smoothstep( .01, .04, vP.z ) ).mul( select( s.equal( 1 ), 1., 0. ) ).toVar();
    				const pocketEdge = exp( pow( abs( vP.y ).sub( .102 ).div( .005 ), 2. ).negate() ).mul( pocket ).add( exp( pow( vP.x.sub( 1.128 ).div( .005 ), 2. ).negate() ).mul( pocket ) ).toVar();
    				const chestBand = step( 1.24, vP.x ).mul( step( vP.x, 1.30 ) ).mul( smoothstep( -0.01, .03, vP.z ) ).mul( select( s.equal( 1 ), .45, 0. ) ).toVar();
    				col.assign( mix( col, uPatC, chestBand.mul( uPat.z ) ) );
    				col.mulAssign( sub( 1., mul( .22, clamp( rib, 0., 1. ) ) ).mul( sub( 1., mul( .24, clamp( pocketEdge, 0., 1. ) ) ) ) );

    			} ).ElseIf( uPat.x.greaterThanEqual( 2.5 ).and( uPat.x.lessThan( 3.5 ) ), () => {

    				const sleeveM = select( s.equal( 2 ), 1., smoothstep( .145, .165, abs( vP.y ) ).mul( step( 1.26, vP.x ) ) ).toVar();
    				const rib = sub( 1., smoothstep( .95, .98, vP.x ) ).mul( select( s.equal( 1 ), 1., 0. ) ).toVar();
    				col.assign( mix( col, uInnerC, clamp( sleeveM, 0., 1. ).mul( uPat.z ) ) );
    				col.mulAssign( sub( 1., mul( .25, rib ) ) );

    			} ).ElseIf( uPat.x.greaterThanEqual( 3.5 ), () => {

    				const st = smoothstep( .35, .65, fract( vP.x.mul( uPat.y ) ) ).toVar();
    				col.assign( mix( col, uPatC, st.mul( .26 ).mul( uPat.z ) ) );

    			} );

    		} );

    		col.mulAssign( add( 1., weave ) );
    		n.assign( normalize( n.add( vec3( foldWave.mul( .35 ), foldWave, foldWave.mul( .25 ) ) ) ) );
    		const baseRgh = select( s.equal( 3 ).or( s.equal( 4 ) ), .84, select( s.equal( 9 ), .76, mix( .9, .58, uTrait.y ) ) ).toVar();
    		const rainSh = uRain.mul( clamp( n.y, 0., 1. ) ).mul( .45 ).toVar();
    		col.mulAssign( sub( 1., rainSh.mul( .22 ) ) );
    		rgh.assign( clamp( baseRgh.sub( rainSh.mul( .28 ) ), .4, .92 ) );

    	} );

    	const sRgh = select( isSkin.greaterThan( .5 ).or( s.equal( 8 ) ).or( s.equal( 6 ) ).or( met.greaterThan( .5 ) ).or( rgh.lessThan( .25 ) ), rgh, mix( rgh, 1., .55 ) ).toVar();
    	const c = shade( vW, n, v, col, sRgh, met ).toVar();

    	If( s.equal( 10 ).and( met.greaterThan( .5 ) ), () => {

    		c.addAssign( col.mul( envMap( reflect( v.negate(), n ) ) ).mul( sub( 1., rgh.mul( .6 ) ) ).mul( .9 ) );

    	} );

    	If( isSkin.greaterThan( .5 ), () => {

    		const ndl = dot( n, uSun ).toVar();
    		const wrap = max( 0., smoothstep( -0.48, .45, ndl ).sub( max( ndl, 0. ) ) ).toVar();
    		const back = pow( clamp( dot( v, uSun.negate() ), 0., 1. ), 3. ).mul( sub( 1., abs( ndl ).mul( .55 ) ) ).toVar();
    		const sssCol = vec3( 1., .32, .16 ).mul( add( .32, mul( .68, vCol ) ) ).toVar();
    		const E = min( c.div( max( col, vec3( .03 ) ) ), vec3( 3. ) ).toVar();
    		c.addAssign( sssCol.mul( wrap.mul( .28 ).add( back.mul( .14 ) ).mul( uSunCol ).add( col.mul( E ).mul( .14 ) ) ) );

    	} );

    	If( s.equal( 6 ), () => {

    		const hDir = normalize( uSun.add( v ) ).toVar();
    		const tang = normalize( cross( n, vec3( 1., 0., .2 ) ).add( vec3( 0., .0001, 0. ) ) ).toVar();
    		const tdh = dot( tang, hDir ).toVar();
    		const sinTH = sqrt( max( 0., sub( 1., tdh.mul( tdh ) ) ) ).toVar();
    		const specH = pow( sinTH, 28. ).mul( max( 0., dot( n, v ) ) ).toVar();
    		c.addAssign( col.mul( .6 ).add( vec3( .04 ) ).mul( specH ).mul( uSunCol.mul( .22 ).add( uFogHi.mul( .35 ) ) ) );
    		const hU = normalize( vec3( 0., 1., 0. ).add( v ) ).toVar();
    		const tdu = dot( tang, hU ).toVar(), specU = pow( sqrt( max( 0., sub( 1., tdu.mul( tdu ) ) ) ), 36. ).mul( max( 0., n.y ) ).toVar();
    		c.addAssign( col.mul( .5 ).add( vec3( .03 ) ).mul( specU ).mul( min( c.div( max( col, vec3( .03 ) ) ), vec3( 3. ) ) ).mul( .35 ).mul( sub( 1., uDay.mul( .7 ) ) ) );

    	} );

    	const rimScale = select( s.equal( 8 ), .15, select( isSkin.greaterThan( .5 ), .45, .65 ) ).toVar();
    	c.addAssign( col.mul( pow( sub( 1., max( dot( n, v ), 0. ) ), 3.4 ) ).mul( uFogHi.mul( sub( 1.05, uDay.mul( .85 ) ) ).add( .012 ) ).mul( rimScale ) );
    	c.addAssign( emi );
    	fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
