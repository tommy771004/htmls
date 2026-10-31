// 材質的 TSL（原本由已刪除的 tools/gen-tsl.mjs 從 GLSL 轉出，現在是著色器的原始碼，直接改這裡）
// 材質 "facade"：鍵是 defines 的形狀（有值的寫成 *），h 是當初轉換時 GLSL 的雜湊（已不使用）
export default {
"{}": {
  h: "exherfwol", fog: true, lib: "[]NL_T,NOCC_T,SH_N_T,VOL_N_T", libV: false, libF: true,
  uniforms: [{"name":"uFacA","type":"sampler2DArray","src":"uFacA"},{"name":"uFacN","type":"sampler2DArray","src":"uFacN"},{"name":"uFac","type":"vec4","src":"uFac"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vUv","type":"vec2","src":"vUv"},{"name":"vB","type":"vec4","src":"vB"},{"name":"vB2","type":"vec4","src":"vB2"}],
  attributes: [{"name":"aB","type":"vec4","src":"aB"},{"name":"aB2","type":"vec4","src":"aB2"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uFacA, uFacN, uFac, vW, vN, vUv, vB, vB2, aB, aB2, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vUv.assign( uv );
    	vB.assign( aB );
    	vB2.assign( aB2 );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { Fn, vec2, floor, mod, step, fract, smoothstep, fwidth, sub, mix, bool, vec3, dot, max, div, mul, add, If, abs, select, min, property, float, length, cos, Loop, sin, clamp, pow, reflect, vec4, Discard, normalize, int, exp, dFdx, dFdy, sign, exp2 } = TSL;
    const { uFacA, uFacN, uFac, vW, vN, vUv, vB, vB2, aB, aB2, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const L =  Fn( ( [ c ] ) => {

    	return c.mul( c );

    }, { c: 'vec3', return: 'vec3' } );

    const brick =  Fn( ( [ q, id ] ) => {

    	const b = q.div( vec2( .23, .076 ) ).toVar();
    	b.x.addAssign( step( 1., mod( floor( b.y ), 2. ) ).mul( .5 ) );
    	id.assign( floor( b ) );
    	const f = fract( b ).toVar();
    	const m = smoothstep( 0., .1, f.y ).mul( smoothstep( 1., .9, f.y ) ).mul( smoothstep( 0., .04, f.x ) ).mul( smoothstep( 1., .96, f.x ) ).toVar();
    	const lod = sub( 1., smoothstep( .12, .45, fwidth( b.y ) ) ).toVar();

    	return mix( .8, m, lod );

    } );

    const oppRefl =  Fn( ( [ p, r, n, seed ] ) => {

    	const done_ = bool( false ).toVar();
    	const ret_ = vec3( 0 ).toVar();
    	const t = div( 18., max( dot( r, n ), .06 ) ).toVar(), hy = p.y.add( r.y.mul( t ) ).toVar(), Ho = add( 9., mul( 16., h21( vec2( seed, 5.3 ) ) ) ).toVar();
    	const env = envMap( r ).toVar();

    	If( hy.greaterThan( Ho ).or( r.y.lessThan( -0.9 ) ), () => {

    		ret_.assign( env );
    		done_.assign( true );

    	} );

    	If( done_.not(), () => {

    		const q = p.add( r.mul( t ) ).toVar();
    		const w = vec2( dot( q.xz, vec2( n.z.negate(), n.x ) ), hy ).toVar();
    		const wc = mix( vec3( .2, .11, .08 ), vec3( .24, .22, .2 ), step( .5, h21( vec2( floor( w.x.div( 30. ) ), seed ) ) ) ).toVar();
    		const win = step( .3, fract( w.x.div( 2.5 ) ) ).mul( step( fract( w.x.div( 2.5 ) ), .75 ) ).mul( step( .2, fract( w.y.div( 3.1 ) ) ) ).mul( step( fract( w.y.div( 3.1 ) ), .78 ) ).mul( step( 4.6, hy ) ).toVar();
    		const c = wc.mul( uAmbTop.mul( .9 ).add( uSunCol.mul( .35 ).mul( max( uSun.x.negate().mul( n.x ).sub( uSun.z.mul( n.z ) ), 0. ) ) ) ).toVar();
    		c.assign( mix( c, uSkyHor.mul( .25 ).add( vec3( .02 ) ), win ) );
    		ret_.assign( mix( env, c.mul( 1.4 ), smoothstep( Ho, Ho.sub( .6 ), hy ).mul( uDay ) ) );
    		done_.assign( true );

    	} );

    	return ret_;

    }, { p: 'vec3', r: 'vec3', n: 'vec3', seed: 'float', return: 'vec3' } );

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

    const shopRoom =  Fn( ( [ o, vd, dim, hs, kind ] ) => {

    	const inv = div( 1., max( abs( vd ), vec3( 1e-4 ) ) ).toVar();
    	const tx = select( vd.x.greaterThan( 0. ), dim.x.sub( o.x ), o.x ).mul( inv.x ).toVar();
    	const ty = select( vd.y.greaterThan( 0. ), dim.y.sub( o.y ), o.y ).mul( inv.y ).toVar();
    	const tz = dim.z.sub( o.z ).mul( inv.z ).toVar();
    	const t = min( tx, min( ty, tz ) ).toVar();
    	const hp = o.add( vd.mul( t ) ).toVar();
    	const lc = select( kind.equal( 5. ), vec3( 1., .93, .82 ), select( kind.equal( 2. ), vec3( 1., .82, .62 ), select( kind.equal( 3. ), vec3( .66, .6, .86 ), select( kind.equal( 4. ), vec3( .9, 1., .95 ), vec3( 1., .98, .94 ) ) ) ) ).toVar();
    	const c = property( 'vec3' );

    	If( t.equal( tz ).or( t.equal( tx ) ), () => {

    		const bw = select( t.equal( tz ), hp.xy, vec2( hp.z, hp.y ) ).toVar();
    		const wn = add( .9, mul( .1, n2( bw.mul( 3. ).add( hs.mul( 7. ) ) ) ) ).toVar();
    		c.assign( vec3( .62, .6, .56 ).mul( wn ) );

    		If( kind.equal( 0. ).or( kind.equal( 4. ) ), () => {

    			const row = floor( bw.y.div( .42 ) ).toVar(), fy = fract( bw.y.div( .42 ) ).toVar();
    			const cw = add( .08, mul( .17, h21( vec2( row, add( 3.7, hs ) ) ) ) ).toVar(), ci = floor( bw.x.div( cw ) ).toVar(), fx = fract( bw.x.div( cw ) ).toVar();
    			const r1 = h21( vec2( ci, row.add( hs.mul( 13. ) ) ) ).toVar(), r2 = h21( vec2( ci.add( 7.1 ), row ) ).toVar(), r3 = h21( vec2( ci, row.add( 2.3 ) ) ).toVar();
    			const pal = select( r1.lessThan( .3 ), vec3( .62, .58, .5 ), select( r1.lessThan( .48 ), vec3( .52, .3, .24 ), select( r1.lessThan( .62 ), vec3( .32, .4, .5 ), select( r1.lessThan( .78 ), vec3( .76, .73, .64 ), select( r1.lessThan( .9 ), vec3( .36, .45, .32 ), vec3( .68, .55, .3 ) ) ) ) ) ).toVar();
    			const prod = pal.mul( add( .7, mul( .4, r2 ) ) ).toVar();
    			const top = add( .3, mul( .5, r3 ) ).toVar();
    			prod.assign( mix( prod, vec3( .86, .84, .8 ), step( abs( fy.sub( .16 ).sub( top.mul( .5 ) ) ), .025 ).mul( step( .55, r2 ) ) ) );
    			const sc = mix( vec3( .26, .25, .24 ), prod, step( .12, fy ).mul( step( fy, top.add( .12 ) ) ).mul( step( .07, fx ) ).mul( step( fx, .95 ) ) ).toVar();
    			sc.assign( mix( sc, vec3( .8, .8, .78 ), step( fy, .045 ) ) );
    			sc.mulAssign( mix( 1., .55, smoothstep( .7, 1., fy ) ) );
    			c.assign( mix( c, sc, step( .3, bw.y ).mul( step( bw.y, 2.1 ) ) ) );
    			c.assign( mix( c, vec3( .42, .4, .38 ), step( 2.1, bw.y ).mul( step( bw.y, 2.22 ) ) ) );

    		} ).ElseIf( kind.equal( 1. ), () => {

    			const cell = vec2( fract( bw.x.div( .8 ) ).sub( .5 ), bw.y.sub( .7 ) ).toVar();
    			const r = length( cell ).toVar();
    			const m = vec3( .8, .8, .77 ).mul( sub( 1., mul( .35, step( .485, abs( cell.x ) ) ) ) ).toVar();
    			m.assign( mix( m, vec3( .62, .63, .64 ), smoothstep( .29, .27, r ) ) );
    			m.assign( mix( m, vec3( .1, .13, .16 ).add( mul( .25, smoothstep( .05, .0, abs( cell.x.add( cell.y.mul( .6 ) ).add( .08 ) ) ) ).mul( step( r, .2 ) ) ), smoothstep( .235, .215, r ) ) );
    			const tl = fract( bw.div( .15 ) ).toVar();
    			c.assign( select( bw.y.lessThan( 1.22 ), m, vec3( .74, .76, .75 ).mul( add( .88, mul( .12, step( .06, min( tl.x, tl.y ) ) ) ) ) ) );

    		} ).ElseIf( kind.equal( 5. ), () => {

    			c.assign( vec3( .74, .71, .66 ).mul( wn ) );

    			Loop( { start: 0, end: 2, name: 'r' }, ( { r } ) => {

    				const ry = select( r.equal( 0 ), 1.9, 1.18 ).toVar(), len = select( r.equal( 0 ), .6, .48 ).toVar(), gw = add( .075, mul( .02, float( r ) ) ).toVar();
    				const gi = floor( bw.x.div( gw ) ).toVar(), gx = fract( bw.x.div( gw ) ).toVar(), g1 = h21( vec2( gi, float( r ).add( hs.mul( 9. ) ) ) ).toVar(), g2 = h21( vec2( gi.add( 3.1 ), float( r ).add( hs ) ) ).toVar();
    				const gc = add( .5, mul( .5, cos( mul( 6.28, g1.mul( .7 ).add( hs.mul( 3. ) ).add( vec3( 0., .33, .67 ) ) ) ) ) ).toVar();
    				gc.assign( mix( vec3( dot( gc, vec3( .33 ) ) ), gc, .5 ).mul( add( .25, mul( .55, g2 ) ) ) );
    				const bot = ry.sub( len ).sub( mul( .22, g2 ) ).toVar();
    				c.assign( mix( c, gc.mul( mix( .7, 1., smoothstep( bot, ry, bw.y ) ) ), step( bot, bw.y ).mul( step( bw.y, ry.sub( .02 ) ) ).mul( step( .1, gx ) ).mul( step( gx, .93 ) ) ) );
    				c.assign( mix( c, vec3( .6, .6, .62 ), step( abs( bw.y.sub( ry ) ), .012 ) ) );

    			} );

    			const sy = bw.y.sub( 2.3 ).toVar(), fi = floor( bw.x.div( .36 ) ).toVar(), fx = fract( bw.x.div( .36 ) ).toVar(), fh = h21( vec2( fi, hs.mul( 5. ) ) ).toVar();
    			const fc = add( .5, mul( .5, cos( mul( 6.28, fh.add( hs.mul( 3. ) ).add( vec3( 0., .33, .67 ) ) ) ) ) ).mul( .45 ).add( .12 ).toVar();
    			c.assign( mix( c, fc.mul( add( .8, mul( .2, step( .5, fract( sy.div( .045 ) ) ) ) ) ), step( 0., sy ).mul( step( sy, add( .1, mul( .12, fh ) ) ) ).mul( step( .12, fx ) ).mul( step( fx, .88 ) ) ) );
    			c.assign( mix( c, vec3( .42, .4, .37 ), step( abs( sy ), .015 ) ) );

    		} ).ElseIf( kind.equal( 2. ), () => {

    			c.assign( select( bw.y.lessThan( 1.0 ), vec3( .3, .21, .15 ).mul( add( .85, mul( .15, step( .5, fract( bw.x.mul( 2.4 ) ) ) ) ) ), vec3( .72, .66, .56 ).mul( wn ) ) );
    			c.assign( mix( c, vec3( .7, .71, .72 ), step( abs( bw.y.sub( 1.02 ) ), .03 ) ) );
    			const menu = step( 1.7, bw.y ).mul( step( bw.y, 2.3 ) ).mul( step( .15, fract( bw.x.mul( .7 ) ) ) ).toVar();
    			c.assign( mix( c, vec3( 1.15, 1.05, .88 ).mul( add( .78, mul( .22, step( .45, fract( bw.y.mul( 13. ) ) ) ) ) ).mul( add( .85, mul( .15, step( .3, fract( bw.x.mul( 6. ) ) ) ) ) ), menu ) );

    		} ).Else( () => {

    			c.assign( vec3( .1, .1, .12 ).mul( wn ) );
    			const g = vec2( fract( bw.x.mul( 1.6 ) ), fract( bw.y.mul( 1.4 ) ) ).toVar(), gi = floor( bw.mul( vec2( 1.6, 1.4 ) ) ).toVar();
    			const q = vec2( g.x.sub( .14 ).div( .72 ), g.y.sub( .17 ).div( .61 ) ).toVar();
    			const tt = uTime.mul( .15 ).add( hs.mul( 7. ) ).toVar();
    			const sc = mix( mix( vec3( .2, .27, .16 ), vec3( .33, .36, .28 ), n2( q.mul( 6. ).add( tt ) ) ), mix( vec3( .5, .58, .72 ), vec3( .18, .3, .52 ), q.y ), smoothstep( .38, .42, q.y.add( mul( .05, sin( q.x.mul( 6. ).add( tt ) ) ) ) ) ).toVar();
    			sc.addAssign( vec3( 1., .88, .66 ).mul( smoothstep( .14, .0, length( q.sub( vec2( fract( tt.mul( .3 ) ), .72 ) ) ) ) ) );
    			sc.mulAssign( add( .8, mul( .15, h21( gi ) ) ).mul( select( kind.equal( 3. ), 1.1, 1.3 ) ) );
    			const scr = step( .14, g.x ).mul( step( g.x, .86 ) ).mul( step( .17, g.y ) ).mul( step( g.y, .78 ) ).mul( step( .4, bw.y ) ).toVar();
    			c.assign( mix( c, vec3( .05 ), step( .1, g.x ).mul( step( g.x, .9 ) ).mul( step( .13, g.y ) ).mul( step( g.y, .82 ) ).mul( step( .4, bw.y ) ) ) );
    			c.assign( mix( c, sc, scr ) );

    		} );

    	} ).ElseIf( vd.y.greaterThan( 0. ), () => {

    		const tf = fract( hp.xz.div( .6 ) ).toVar();
    		c.assign( vec3( .58, .58, .56 ).mul( add( .9, mul( .1, step( .04, min( tf.x, tf.y ) ) ) ) ).add( step( .86, fract( hp.z.div( 1.1 ) ) ).mul( step( .15, fract( hp.x.div( 1.6 ) ) ) ).mul( 3. ) ) );

    	} ).Else( () => {

    		const tl = floor( hp.xz.div( .45 ) ).toVar(), tf = fract( hp.xz.div( .45 ) ).toVar();
    		const ck = mod( tl.x.add( tl.y ), 2. ).toVar();
    		c.assign( select( kind.equal( 5. ), vec3( .44, .32, .22 ).mul( add( .82, mul( .18, h21( vec2( floor( hp.x.div( .16 ) ), floor( hp.z.div( 1.2 ).add( fract( hp.x.mul( 2.3 ) ) ) ).add( hs ) ) ) ) ) ).mul( add( .85, mul( .15, step( .04, fract( hp.x.div( .16 ) ) ) ) ) ), select( kind.equal( 2. ), mix( vec3( .56, .54, .5 ), vec3( .36, .34, .31 ), ck ), mix( vec3( .46, .45, .43 ), vec3( .4, .39, .37 ), ck.mul( .7 ) ) ) ) );
    		c.mulAssign( add( .9, mul( .1, h21( tl.add( hs ) ) ) ).mul( add( .82, mul( .18, step( .03, min( tf.x, tf.y ) ) ) ) ) );

    	} );

    	const px = fract( hs.mul( 31. ) ).mul( dim.x ).mul( .7 ).add( dim.x.mul( .15 ) ).toVar(), pz = dim.z.mul( add( .35, mul( .4, fract( hs.mul( 11. ) ) ) ) ).toVar();
    	const tp = pz.sub( o.z ).div( max( vd.z, 1e-3 ) ).toVar();
    	const pp = o.add( vd.mul( tp ) ).toVar();
    	const dx = abs( pp.x.sub( px ) ).toVar(), py = pp.y.toVar();
    	const body = step( length( vec2( dx, py.sub( 1.6 ).mul( .85 ) ) ), .1 ).add( step( py, 1.47 ).mul( step( .92, py ) ).mul( step( dx, mix( .15, .22, smoothstep( .92, 1.4, py ) ) ) ) ).add( step( py, .95 ).mul( step( dx, .15 ) ).mul( step( .025, dx ) ) ).add( step( py, 1.5 ).mul( step( 1.4, py ) ).mul( step( dx, .05 ) ) ).toVar();
    	const person = clamp( body, 0., 1. ).mul( step( tp, t ) ).mul( step( .35, fract( hs.mul( 23. ) ) ) ).toVar();
    	const cloth = add( .06, mul( .22, add( .5, mul( .5, cos( mul( 6.28, fract( hs.mul( 53. ) ).add( vec3( 0., .33, .67 ) ) ) ) ) ) ) ).toVar();
    	c.assign( mix( c, mix( cloth, vec3( .05, .045, .05 ), step( py, .95 ).mul( .7 ).add( step( 1.5, py ).mul( .5 ) ) ).mul( add( .8, mul( .4, smoothstep( .9, 1.5, py ) ) ) ), person ) );

    	return c.mul( lc ).mul( mix( 1.25, .7, hp.z.div( dim.z ) ) ).mul( mix( .55, .5, uDay ) );

    }, { o: 'vec3', vd: 'vec3', dim: 'vec3', hs: 'float', kind: 'float', return: 'vec3' } );

    const facMul =  Fn( ( [ p, n, v, nW, seed ] ) => {

    	const mk = fract( seed.mul( 5.3 ) ).toVar();
    	const a = select( mk.lessThan( .45 ), L( vec3( .52, .54, .56 ) ), select( mk.lessThan( .75 ), L( vec3( .08, .08, .09 ) ), L( vec3( .24, .19, .14 ) ) ) ).toVar();
    	const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();

    	return shade( p, nW, v, a.mul( .75 ), .4, 0. ).add( envMap( reflect( v.negate(), n ) ).mul( a.mul( .35 ).add( F.mul( .2 ) ) ) );

    }, { p: 'vec3', n: 'vec3', v: 'vec3', nW: 'vec3', seed: 'float', return: 'vec3' } );

    const reveal =  Fn( ( [ p, a, b, r, d ] ) => {

    	const done_ = bool( false ).toVar();
    	const ret_ = vec4( 0 ).toVar();
    	const q = p.add( r.xy.div( r.z ).mul( d ) ).toVar();

    	If( q.x.greaterThan( a.x ).and( q.x.lessThan( b.x ) ).and( q.y.greaterThan( a.y ) ).and( q.y.lessThan( b.y ) ), () => {

    		ret_.assign( vec4( q, 0., 1. ) );
    		done_.assign( true );

    	} );

    	If( done_.not(), () => {

    		const dx = select( r.x.greaterThan( 0. ), b.x.sub( p.x ), p.x.sub( a.x ) ).div( max( abs( r.x ), 1e-5 ) ).mul( r.z ).toVar();
    		const dy = select( r.y.greaterThan( 0. ), b.y.sub( p.y ), p.y.sub( a.y ) ).div( max( abs( r.y ), 1e-5 ) ).mul( r.z ).toVar();
    		ret_.assign( select( dx.lessThan( dy ), vec4( p, 1., dx.div( d ) ), vec4( p, 2., dy.div( d ) ) ) );
    		done_.assign( true );

    	} );

    	return ret_;

    }, { p: 'vec2', a: 'vec2', b: 'vec2', r: 'vec3', d: 'float', return: 'vec4' } );

    const main_ =  Fn( () => {

    	const done_ = bool( false ).toVar();
    	const fragOut_ = vec4( 0.0 ).toVar();

    	If( vW.y.lessThan( uClipY ), () => {

    		Discard();

    	} );

    	const n = normalize( vN ).toVar();
    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const seed = vB.x.toVar(), fw = vB.z.toVar(), shop = vB.w.toVar();
    	const st = int( vB.y.add( .5 ) ).toVar();
    	const u = vUv.x.toVar(), y = vW.y.toVar(), H = vB2.z.toVar();
    	const solid = mod( floor( vB2.w.mul( .5 ) ), 2. ).greaterThan( .5 ).toVar();
    	const flatW = vB2.w.lessThan( 3.5 ).toVar();
    	const c = property( 'vec3' );

    	If( n.y.greaterThan( .5 ).and( solid.not() ), () => {

    		const f = fbm( vW.xz.mul( .5 ) ).toVar();
    		const alb = vec3( .035, .035, .04 ).mul( add( .7, mul( .6, f ) ) ).toVar();

    		If( uFac.x.greaterThan( .5 ), () => {

    			const q = vW.xz.div( 3. ).toVar();
    			alb.assign( L( texA_( uFacA, vec3( q, 4. ) ).rgb ).mul( .6 ).mul( add( .8, mul( .4, f ) ) ) );

    			If( uFac.y.greaterThan( .5 ), () => {

    				const t = texA_( uFacN, vec3( q, 4. ) ).rgb.toVar();
    				n.assign( normalize( n.add( vec3( t.r.mul( 2. ).sub( 1. ), 0., sub( 1., t.g.mul( 2. ) ) ).mul( .8 ) ) ) );

    			} );

    		} );

    		const pud0 = smoothstep( .55, .65, fbm( vW.xz.mul( .15 ).add( seed ) ) ).toVar(), pud = pud0.mul( smoothstep( .05, .6, uWet ) ).toVar();
    		alb.mulAssign( sub( 1., mul( .3, pud0 ).mul( sub( 1., pud ) ) ) );
    		c.assign( shade( vW, n, v, alb, mix( .85, .1, pud ), 0. ) );
    		c.addAssign( envMap( reflect( v.negate(), n ) ).mul( pud ).mul( .35 ) );
    		fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );
    		done_.assign( true );

    	} );

    	If( done_.not(), () => {

    		If( st.equal( 9 ), () => {

    			const uw = vB.z.div( max( vB2.y, 1. ) ).toVar(), du = abs( fract( u.div( uw ) ).sub( .5 ).mul( uw ) ).toVar();
    			const lamp = uLampOn.mul( sub( 1., mul( .75, uDay ) ) ).toVar();

    			If( n.y.greaterThan( 0. ), () => {

    				const tf = fract( vW.xz.div( .5 ) ).toVar();
    				const alb = L( vec3( .5, .48, .45 ) ).mul( add( .85, mul( .15, n2( vW.xz.mul( 3. ) ) ) ) ).mul( add( .82, mul( .18, step( .03, min( tf.x, tf.y ) ) ) ) ).toVar();
    				c.assign( shade( vW, n, v, alb, .5, 0. ).add( alb.mul( vec3( 1., .85, .65 ) ).mul( .9 ).mul( lamp ).mul( exp( du.negate().mul( du ).mul( .25 ) ) ) ) );

    			} ).Else( () => {

    				const alb = L( vec3( .62, .6, .56 ) ).mul( add( .9, mul( .1, fbm( vec2( u, vW.x.add( vW.z ) ).mul( .8 ) ) ) ) ).toVar();
    				c.assign( shade( vW, n, v, alb, .9, 0. ).add( alb.mul( vec3( 1., .85, .65 ) ).mul( .35 ).mul( lamp ).mul( exp( du.negate().mul( du ).mul( .15 ) ) ) ) );
    				c.assign( mix( c, vec3( 1.6, 1.45, 1.2 ).mul( add( .3, mul( .7, lamp ) ) ), step( du, .09 ) ) );

    			} );

    			fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );
    			done_.assign( true );

    		} );

    		If( done_.not(), () => {

    			If( st.equal( 7 ), () => {

    				const alb = L( mix( vec3( .42, .36, .3 ), vec3( .3, .28, .27 ), fract( seed.mul( 3. ) ) ) ).mul( add( .8, mul( .3, fbm( vec2( u, y ).mul( 2. ) ) ) ) ).toVar();
    				c.assign( shade( vW, n, v, alb, .8, 0. ) );
    				fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );
    				done_.assign( true );

    			} );

    			If( done_.not(), () => {

    				const Tn = vec3( n.z, 0., n.x.negate() ).toVar();
    				const V = v.negate().toVar();
    				const vd = vec3( dot( V, Tn ), V.y, dot( V, n.negate() ) ).toVar();
    				const grime = fbm( vec2( u.mul( .6 ), y.mul( .08 ) ).add( seed ) ).toVar();
    				const wall = property( 'vec3' );
    				const rough = float( .85 ).toVar();
    				const bid = property( 'vec2' );
    				const bm = brick( vec2( u, y ), bid ).toVar();
    				const bv = h21( bid.add( seed ) ).toVar();
    				const btint = mix( vec3( 1. ), vec3( 1.07, .93, .84 ), h21( bid.add( 3.1 ) ) ).mul( sub( 1., mul( .42, step( .95, h21( bid.mul( 1.31 ).add( seed ) ) ) ) ) ).toVar();
    				const mortar = L( vec3( .44, .41, .37 ) ).mul( add( .75, mul( .25, grime ) ) ).toVar();

    				If( st.equal( 0 ), () => {

    					wall.assign( mix( mortar, L( vec3( .48, .24, .17 ) ).mul( mix( .72, 1.15, bv ) ).mul( btint ), bm ) );

    				} ).ElseIf( st.equal( 1 ), () => {

    					wall.assign( mix( mortar, L( vec3( .42, .3, .22 ) ).mul( mix( .74, 1.12, bv ) ).mul( btint ), bm ) );

    				} ).ElseIf( st.equal( 2 ), () => {

    					wall.assign( L( vec3( .55, .52, .47 ) ).mul( add( .85, mul( .15, fbm( vec2( u, y ).mul( 3. ) ) ) ) ) );
    					const bl = fract( y.div( .6 ) ).toVar();
    					wall.mulAssign( add( .8, mul( .2, smoothstep( 0., .04, bl ) ) ) );

    				} ).ElseIf( st.equal( 3 ), () => {

    					wall.assign( L( vec3( .22, .24, .27 ) ) );

    				} ).ElseIf( st.equal( 4 ), () => {

    					wall.assign( L( mix( vec3( .36, .5, .5 ), vec3( .55, .4, .44 ), fract( seed.mul( 7. ) ) ) ).mul( add( .85, mul( .15, fbm( vec2( u, y ).mul( 2. ) ) ) ) ) );

    				} ).ElseIf( st.equal( 5 ), () => {

    					wall.assign( L( vec3( .12, .11, .12 ) ).mul( add( .6, mul( .4, bm ) ) ) );

    				} ).ElseIf( st.equal( 8 ), () => {

    					wall.assign( L( vec3( .84, .86, .86 ) ).mul( add( .9, mul( .1, fbm( vec2( u, y ).mul( 2. ) ) ) ) ) );
    					const pj = step( fract( u.div( 1.8 ) ), .025 ).add( step( fract( y.div( 1.7 ) ), .025 ) ).toVar();
    					wall.mulAssign( sub( 1., mul( .22, clamp( pj, 0., 1. ) ) ) );

    				} ).Else( () => {

    					wall.assign( L( vec3( .45, .2, .14 ) ).mul( mix( .8, 1.1, bv ) ).mul( add( .55, mul( .45, bm ) ) ) );

    				} );

    				const nW = n.toVar();

    				If( uFac.x.greaterThan( .5 ).and( st.notEqual( 3 ) ).and( st.notEqual( 5 ) ).and( st.notEqual( 8 ) ), () => {

    					const lay = select( st.equal( 1 ), 1., select( st.equal( 2 ), 2., select( st.equal( 4 ), 3., 0. ) ) ).toVar(), sc = select( st.equal( 1 ), 1.3, select( st.equal( 2 ), 4., select( st.equal( 4 ), 2., 1.4 ) ) ).toVar();
    					const q = vec2( u, y ).div( sc ).add( vec2( fract( seed.mul( 13. ) ), fract( seed.mul( 29. ) ) ) ).toVar();
    					const tint = select( st.equal( 4 ), L( mix( vec3( .62, .86, .84 ), vec3( .95, .72, .74 ), fract( seed.mul( 7. ) ) ) ).mul( 1.25 ), select( st.equal( 2 ), vec3( 1.1 ), vec3( add( .9, mul( .25, fract( seed.mul( 5. ) ) ) ) ).mul( select( st.equal( 1 ), vec3( .92, .86, .8 ), vec3( 1. ) ) ) ) ).toVar();
    					const tA = texA_( uFacA, vec3( q, lay ) ).rgb.toVar();

    					If( st.equal( 2 ), () => {

    						tA.assign( mix( texLA_( uFacA, vec3( q, lay ), 10. ).rgb, tA, .45 ) );

    					} );

    					wall.assign( L( tA ).mul( tint ) );

    					If( uFac.y.greaterThan( .5 ), () => {

    						const tn = texA_( uFacN, vec3( q, lay ) ).toVar();
    						const sg = sign( dot( Tn, dFdx( vW ) ).mul( dFdx( u ) ).add( dot( Tn, dFdy( vW ) ).mul( dFdy( u ) ) ).add( 1e-6 ) ).toVar();
    						nW.assign( normalize( n.add( Tn.mul( sg ).mul( tn.r.mul( 2. ).sub( 1. ) ).add( vec3( 0., sub( 1., tn.g.mul( 2. ) ), 0. ) ).mul( 1.2 ) ) ) );
    						rough.assign( mix( .6, 1., tn.b ) );

    					} );

    				} );

    				wall.mulAssign( sub( 1., mul( .35, grime ).mul( smoothstep( H, 0., y.mul( .6 ) ) ) ) );
    				const edge = min( u, fw.sub( u ) ).toVar();
    				const run = smoothstep( H.sub( 6. ), H.sub( .4 ), y ).mul( smoothstep( .5, .78, n2( vec2( u.mul( 2.1 ).add( seed.mul( 9. ) ), y.mul( .09 ) ) ) ) ).toVar();
    				wall.mulAssign( add( .86, mul( .2, fbm( vec2( u, y ).mul( .12 ).add( seed ) ) ) ).mul( sub( 1., mul( .4, run ) ) ).mul( mix( .7, 1., smoothstep( 0., 1.3, edge ) ) ) );
    				wall.mulAssign( sub( 1., mul( .3, sub( 1., smoothstep( 0., 1.5, y ) ) ).mul( add( .5, mul( .5, n2( vec2( u.mul( 1.3 ), y.mul( 2.5 ) ) ) ) ) ) ) );
    				wall.mulAssign( mix( .6, 1., smoothstep( 0., .9, y ) ) );
    				const gH = float( 4.6 ).toVar();
    				const fh = select( st.equal( 3 ), 3.7, select( st.equal( 2 ).or( st.equal( 8 ) ), 3.4, 3.1 ) ).toVar();
    				const ws = select( st.equal( 3 ), 1.6, select( st.equal( 2 ).or( st.equal( 8 ) ), 2.2, 2.5 ) ).toVar();
    				const nF = floor( H.sub( gH ).sub( .7 ).div( fh ) ).toVar();
    				const cols = max( 1., floor( fw.sub( 1. ).div( ws ) ) ).toVar();
    				const mg = fw.sub( cols.mul( ws ) ).mul( .5 ).toVar();
    				const cu = u.sub( mg ).div( ws ).toVar();
    				const ci = floor( cu ).toVar();
    				const fy = y.sub( gH ).div( fh ).toVar();
    				const fi = floor( fy ).toVar();
    				const f = vec2( fract( cu ), fract( fy ) ).toVar();
    				const wmin = select( st.equal( 3 ), vec2( .03, .06 ), vec2( .27, .18 ) ).toVar(), wmax = select( st.equal( 3 ), vec2( .97, .96 ), vec2( .73, .8 ) ).toVar();
    				const grid = solid.not().and( ci.greaterThanEqual( 0. ) ).and( ci.lessThan( cols ) ).and( fi.greaterThanEqual( 0. ) ).and( fi.lessThan( nF ) ).toVar();
    				const inWin = grid.and( f.x.greaterThan( wmin.x ) ).and( f.x.lessThan( wmax.x ) ).and( f.y.greaterThan( wmin.y ) ).and( f.y.lessThan( wmax.y ) ).toVar();

    				If( grid.and( st.notEqual( 3 ) ).and( st.notEqual( 5 ) ).and( st.notEqual( 8 ) ).and( f.x.greaterThan( wmin.x.add( .03 ) ) ).and( f.x.lessThan( wmax.x.sub( .03 ) ) ).and( f.y.lessThan( wmin.y ).or( f.y.greaterThan( wmax.y ) ) ), () => {

    					const sd = select( f.y.lessThan( wmin.y ), wmin.y.sub( f.y ).mul( fh ), select( fi.add( 1. ).lessThan( nF ), add( 1., wmin.y ).sub( f.y ).mul( fh ), 9. ) ).toVar();
    					wall.mulAssign( sub( 1., mul( .3, smoothstep( .45, .8, n2( vec2( u.mul( 7. ).add( seed.mul( 5. ) ), y.mul( .15 ) ) ) ) ).mul( sub( 1., smoothstep( 0., 1.6, sd ) ) ) ) );

    				} );

    				If( st.notEqual( 3 ).and( st.notEqual( 5 ) ).and( st.notEqual( 8 ) ), () => {

    					const age = fract( seed.mul( 17.3 ) ).toVar();

    					If( solid.not().and( y.greaterThan( gH ) ).and( fi.lessThan( nF ) ), () => {

    						const dF = sub( 1., fract( fy ) ).mul( fh ).toVar(), len = mix( .6, 2., n2( vec2( u.mul( 1.7 ), fi.add( seed.mul( 3. ) ) ) ) ).toVar();
    						wall.mulAssign( sub( 1., add( .28, mul( .25, age ) ).mul( smoothstep( .5, .85, n2( vec2( u.mul( 3.1 ).add( seed.mul( 7. ) ), fi.mul( 5.3 ) ) ) ) ).mul( sub( 1., smoothstep( 0., len, dF ) ) ) ) );

    					} );

    					wall.mulAssign( mix( sub( .84, mul( .12, age ) ), 1., smoothstep( 1., 16., y ) ) );
    					const brk = st.equal( 0 ).or( st.equal( 1 ) ).toVar();
    					const rs = select( brk, vec2( 2.4, 1.8 ), vec2( 3.6, 2.9 ) ).toVar(), rq = vec2( u, y.add( mul( .4, n2( vec2( u.mul( .7 ), seed ) ) ) ) ).div( rs ).toVar(), rc = floor( rq ).toVar(), rf = fract( rq ).sub( .5 ).toVar();
    					const rsh = select( brk, smoothstep( .34, .3, length( rf.mul( vec2( 1., 1.25 ) ) ).add( n2( rq.mul( 4. ) ).sub( .5 ).mul( .3 ) ) ), smoothstep( .5, .45, max( abs( rf.x ), abs( rf.y ) ).add( n2( rq.mul( 9. ) ).sub( .5 ).mul( .04 ) ) ) ).toVar();
    					const rep = step( sub( 1., mul( .08, age ) ), h21( rc.add( seed.mul( 3. ) ) ) ).mul( step( 1.5, y ) ).mul( rsh ).toVar();
    					wall.assign( mix( wall, select( brk, L( vec3( .32, .31, .29 ) ).mul( add( .8, mul( .3, n2( vec2( u, y ).mul( 5. ) ) ) ) ).mul( add( .85, mul( .15, bm ) ) ), wall.mul( vec3( 1.14, 1.11, 1.05 ) ) ), rep.mul( .8 ) ) );

    					If( st.equal( 2 ).or( st.equal( 4 ) ), () => {

    						const pk = fbm( vec2( u, y ).mul( .9 ).add( seed.mul( 5. ) ) ).add( sub( 1., smoothstep( 0., 9., y ) ).mul( .22 ) ).add( age.mul( .1 ) ).toVar();
    						wall.assign( mix( wall, L( vec3( .47, .49, .44 ) ).mul( add( .85, mul( .2, grime ) ) ), smoothstep( .72, .735, pk ) ) );
    						wall.assign( mix( wall, L( vec3( .33, .32, .3 ) ).mul( add( .8, mul( .3, n2( vec2( u, y ).mul( 6. ) ) ) ) ), smoothstep( .8, .815, pk ) ) );

    					} );

    					If( y.greaterThan( .9 ).and( y.lessThan( 2.7 ) ), () => {

    						const pc = floor( u.div( 2.3 ) ).toVar(), pr = h21( vec2( pc, seed.mul( 7. ) ) ).toVar(), px = fract( u.div( 2.3 ) ).toVar(), e = n2( vec2( u, y ).mul( 14. ) ).sub( .5 ).mul( .06 ).toVar();
    						const x0 = add( .15, mul( .25, h21( vec2( pc, 3. ) ) ) ).toVar(), y0 = add( 1.05, mul( .3, pr ) ).toVar();
    						const inP = step( .8, pr ).mul( step( x0.add( e ), px ) ).mul( step( px, x0.add( .3 ).sub( e ) ) ).mul( step( y0.add( e ), y ) ).mul( step( y, y0.add( .75 ).sub( e ) ) ).toVar();
    						wall.assign( mix( wall.mul( add( 1., mul( .1, inP ) ) ), L( vec3( .66, .62, .5 ) ).mul( add( .8, mul( .3, n2( vec2( u, y ).mul( 20. ) ) ) ) ), inP.mul( smoothstep( .55, .62, n2( vec2( u, y ).mul( 7. ).add( pc ) ) ) ) ) );

    					} );

    					const yd = add( .4, mul( .7, age ).mul( add( .6, mul( .4, n2( vec2( u.mul( .6 ).add( seed ), 1. ) ) ) ) ) ).toVar();
    					wall.mulAssign( sub( 1., mul( .22, sub( 1., smoothstep( yd.sub( .15 ), yd, y ) ) ) ) );
    					wall.assign( mix( wall, L( vec3( .68, .66, .61 ) ), mul( .5, exp( pow( y.sub( yd ).div( .045 ), 2. ).negate() ) ).mul( smoothstep( .3, .65, n2( vec2( u.mul( 4. ), y.mul( 9. ) ) ) ) ) ) );
    					wall.assign( mix( wall, wall.mul( 1.3 ).add( L( vec3( .04 ) ) ), sub( 1., smoothstep( .03, .12, edge ) ).mul( sub( 1., smoothstep( 1.4, 2.2, y ) ) ).mul( smoothstep( .4, .6, n2( vec2( u.mul( 3. ), y.mul( 6. ) ) ) ) ) ) );

    				} );

    				wall.mulAssign( sub( 1., mul( .22, uWet ).mul( mix( .6, 1., sub( 1., smoothstep( 0., 3., y ) ) ) ) ) );
    				const sgU = sign( dot( Tn, dFdx( vW ) ).mul( dFdx( u ) ).add( dot( Tn, dFdy( vW ) ).mul( dFdy( u ) ) ).add( 1e-6 ) ).toVar();
    				const rv = vec3( vd.x.mul( sgU ), vd.y, max( vd.z, 1e-3 ) ).toVar();

    				If( inWin.and( flatW ).and( st.notEqual( 5 ) ), () => {

    					const dR = select( st.equal( 2 ), .3, select( st.equal( 4 ), .18, select( st.equal( 3 ), .12, .22 ) ) ).toVar();
    					const h = reveal( vec2( u, y ), vec2( mg.add( ci.add( wmin.x ).mul( ws ) ), gH.add( fi.add( wmin.y ).mul( fh ) ) ), vec2( mg.add( ci.add( wmax.x ).mul( ws ) ), gH.add( fi.add( wmax.y ).mul( fh ) ) ), rv, dR ).toVar();

    					If( h.z.greaterThan( .5 ), () => {

    						const nr = select( h.z.lessThan( 1.5 ), sign( rv.x ).negate().mul( sgU ).mul( Tn ), vec3( 0., sign( rv.y ).negate(), 0. ) ).toVar();
    						const alb = select( st.equal( 3 ), L( vec3( .2, .22, .25 ) ), select( h.z.greaterThan( 1.5 ).and( rv.y.lessThan( 0. ) ), L( vec3( .62, .58, .5 ) ).mul( add( .8, mul( .2, grime ) ) ), wall.mul( .85 ) ) ).toVar();
    						c.assign( shade( vW.sub( n.mul( h.w ).mul( dR ) ), nr, v, alb, .85, select( st.equal( 3 ), .6, 0. ) ).mul( sub( 1., mul( .4, h.w ) ) ) );
    						fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );
    						done_.assign( true );

    					} );

    					If( done_.not(), () => {

    						f.assign( vec2( fract( h.x.sub( mg ).div( ws ) ), fract( h.y.sub( gH ).div( fh ) ) ) );

    					} );

    				} );

    				If( done_.not(), () => {

    					If( y.lessThan( gH ).and( solid.not() ), () => {

    						If( shop.greaterThan( .5 ).and( st.notEqual( 5 ) ), () => {

    							const units = max( vB2.y, 1. ).toVar();
    							const uw = fw.div( units ).toVar();
    							const ui = floor( u.div( uw ) ).toVar();
    							const ux = fract( u.div( uw ) ).toVar();
    							const shut = mod( floor( vB2.x.div( exp2( ui ) ) ), 2. ).toVar();
    							const hs = h21( vec2( ui, seed ) ).toVar();

    							If( st.equal( 6 ), () => {

    								shut.assign( 0. );

    							} );

    							If( flatW.and( ux.greaterThan( .045 ) ).and( ux.lessThan( .955 ) ).and( y.lessThan( 3.42 ) ), () => {

    								const h = reveal( vec2( u, y ), vec2( ui.add( .045 ).mul( uw ), -1 ), vec2( ui.add( .955 ).mul( uw ), 3.42 ), rv, .3 ).toVar();

    								If( h.z.greaterThan( .5 ), () => {

    									const nr = select( h.z.lessThan( 1.5 ), sign( rv.x ).negate().mul( sgU ).mul( Tn ), vec3( 0., -1, 0. ) ).toVar();
    									c.assign( shade( vW.sub( n.mul( h.w ).mul( .3 ) ), nr, v, select( h.z.lessThan( 1.5 ), L( vec3( .3, .28, .26 ) ), L( vec3( .08, .08, .09 ) ) ), .7, 0. ).mul( sub( 1., mul( .35, h.w ) ) ) );
    									fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );
    									done_.assign( true );

    								} );

    								If( done_.not(), () => {

    									u.assign( h.x );
    									y.assign( h.y );
    									ux.assign( fract( u.div( uw ) ) );

    								} );

    							} );

    							If( done_.not(), () => {

    								If( ux.lessThan( .045 ).or( ux.greaterThan( .955 ) ).or( y.greaterThan( 3.42 ) ), () => {

    									const alb = select( y.greaterThan( 3.42 ), L( vec3( .08, .08, .09 ) ), L( vec3( .3, .28, .26 ) ).mul( add( .8, mul( .3, fbm( vec2( u, y ).mul( 4. ) ) ) ) ) ).toVar();

    									If( st.equal( 6 ), () => {

    										alb.assign( L( vec3( .06, .16, .12 ) ) );

    									} );

    									c.assign( shade( vW, n, v, alb, .7, 0. ) );

    								} ).ElseIf( y.lessThan( .42 ), () => {

    									c.assign( shade( vW, n, v, L( vec3( .13, .12, .12 ) ), .4, 0. ) );

    								} ).ElseIf( shut.greaterThan( .5 ), () => {

    									const rib = add( .6, mul( .4, smoothstep( -0.6, .6, sin( y.mul( 42. ) ) ) ) ).toVar();
    									const rust = fbm( vec2( u.mul( 1.3 ), y.mul( .35 ) ).add( hs.mul( 9. ) ) ).toVar();
    									const alb = mix( L( vec3( .37, .38, .37 ) ), L( vec3( .34, .27, .21 ) ), smoothstep( .55, .8, rust ).mul( .7 ) ).mul( rib ).toVar();
    									alb.mulAssign( sub( 1., mul( .3, smoothstep( .5, 0., y ) ) ).mul( add( .9, mul( .1, n2( vec2( u.mul( 6. ), y.mul( .4 ) ) ) ) ) ) );
    									const tw = add( 1.4, mul( 1.2, fract( hs.mul( 7. ) ) ) ).toVar(), th = add( .6, mul( .4, fract( hs.mul( 11. ) ) ) ).toVar();
    									const tc = vec2( ux.mul( uw ).sub( mul( .25, uw ) ).sub( mul( .3, uw ).mul( fract( hs.mul( 5. ) ) ) ), y.sub( .9 ).sub( mul( .5, fract( hs.mul( 3. ) ) ) ) ).toVar();
    									const msk = smoothstep( 1., .6, length( tc.sub( vec2( tw, th ).mul( .5 ) ).div( vec2( tw, th ).mul( .5 ) ) ) ).mul( step( .45, fract( hs.mul( 17. ) ) ) ).toVar();
    									const g = fbm( tc.mul( vec2( 2.4, 3.2 ) ).add( hs.mul( 20. ) ) ).toVar();
    									const gc = L( add( .5, mul( .5, cos( mul( 6.28, hs.add( vec3( 0., .33, .67 ) ) ) ) ) ) ).toVar();
    									gc.assign( mix( vec3( dot( gc, vec3( .33 ) ) ), gc, .5 ).mul( .7 ) );
    									alb.assign( mix( alb, gc, smoothstep( .5, .53, g ).mul( msk ).mul( .85 ) ) );
    									alb.assign( mix( alb, L( vec3( .04 ) ), smoothstep( .025, .0, abs( g.sub( .5 ) ) ).mul( msk ) ) );
    									c.assign( shade( vW, n, v, alb, .5, .3 ) );

    								} ).Else( () => {

    									const dim = vec3( uw.mul( .91 ), 3., 5.2 ).toVar();
    									const o = vec3( ux.sub( .045 ).div( .91 ).mul( dim.x ), y.sub( .42 ), 0. ).toVar();
    									const sk = mod( floor( seed ).mul( 7. ).add( ui.mul( 13. ) ).add( .5 ), 24. ).toVar();
    									const inside = select( st.equal( 6 ), room( o, vd, dim, hs, vec3( 1.1, .6, .28 ).mul( 1.4 ), 0. ), shopRoom( o, vd, dim, hs, select( mod( floor( vB2.x.div( exp2( ui.add( 16. ) ) ) ), 2. ).greaterThan( .5 ), 5., select( sk.lessThan( 8. ), 0., select( sk.lessThan( 9. ), 1., select( sk.lessThan( 15. ), 2., select( sk.lessThan( 19. ), 3., 4. ) ) ) ) ) ) ).toVar();
    									const door = step( .7, ux ).mul( step( ux, .86 ) ).toVar();
    									const frame = max( step( abs( ux.sub( .7 ) ), .008 ), step( abs( ux.sub( .86 ) ), .008 ) ).mul( step( y, 2.6 ) ).add( step( abs( y.sub( 2.6 ) ), .03 ).mul( door ) ).toVar();
    									frame.addAssign( step( abs( y.sub( 2.95 ) ), .025 ) );
    									const F = add( .06, mul( .94, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    									c.assign( inside.mul( .62 ).mul( sub( 1., F.mul( .6 ) ) ).add( oppRefl( vW, reflect( v.negate(), n ), n, seed.add( ui ) ).mul( F.mul( .8 ).add( mul( .06, uDay ) ) ) ) );
    									c.addAssign( shade( vW, n, v, vec3( 0. ), .05, 0. ).mul( .5 ) );
    									c.assign( mix( c, shade( vW, n, v, L( vec3( .12 ) ), .4, .6 ), clamp( frame, 0., 1. ) ) );

    								} );

    							} );

    						} ).ElseIf( st.equal( 5 ), () => {

    							c.assign( shade( vW, n, v, wall.mul( .7 ), .6, 0. ) );

    						} ).Else( () => {

    							const d = abs( u.sub( fw.mul( .5 ) ) ).toVar();

    							If( d.lessThan( .75 ).and( y.lessThan( 2.7 ) ), () => {

    								const dim = vec3( 1.5, 2.7, 4. ).toVar();
    								const inside = room( vec3( u.sub( fw.mul( .5 ) ).add( .75 ), y, 0. ), vd, dim, seed, vec3( 1., .8, .55 ), 0. ).toVar();
    								const fr = step( .7, d ).add( step( 2.62, y ) ).toVar();
    								c.assign( mix( inside.mul( .9 ), shade( vW, n, v, L( vec3( .1, .08, .06 ) ), .5, 0. ), clamp( fr, 0., 1. ) ) );

    							} ).Else( () => {

    								c.assign( shade( vW, select( st.equal( 3 ), n, nW ), v, select( st.equal( 3 ), L( vec3( .3, .31, .33 ) ), wall.mul( .9 ) ), rough, 0. ) );

    							} );

    						} );

    						If( done_.not(), () => {

    							fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );
    							done_.assign( true );

    						} );

    					} );

    					If( done_.not(), () => {

    						If( inWin, () => {

    							const wc = vec2( ci, fi ).toVar();
    							const hs = h21( wc.add( seed.mul( vec2( 1.37, 2.71 ) ) ) ).toVar();
    							const hs2 = h21( wc.mul( 1.7 ).add( seed ) ).toVar();
    							const litP = uLit.mul( select( st.equal( 3 ), step( .55, h21( vec2( fi, seed ) ) ).mul( .9 ).add( .25 ), select( st.equal( 5 ), .2, 1. ) ) ).toVar();
    							const lit = hs.lessThan( litP ).toVar();
    							const lc = mix( vec3( 1., .76, .48 ), vec3( 1., .93, .8 ), hs2 ).toVar();

    							If( st.equal( 5 ), () => {

    								lc.assign( vec3( .9, .2, .6 ).mul( add( .6, mul( .4, sin( uBeat.mul( 6.283 ) ) ) ) ) );

    							} );

    							If( hs2.greaterThanEqual( .92 ), () => {

    								lc.mulAssign( add( .6, mul( .4, fract( sin( floor( uTime.mul( 5. ).add( hs.mul( 20. ) ) ) ).mul( 91. ) ) ) ) );

    							} );

    							lc.assign( select( lit, lc.mul( 1.5 ), mix( lc.mul( .025 ), vec3( .15, .15, .16 ).mul( add( .6, mul( .8, hs2 ) ) ), uDay ) ) );
    							const dim = vec3( ws, fh, select( st.equal( 3 ), 6., 3.4 ) ).toVar();
    							const o = vec3( f.x.mul( ws ), f.y.mul( fh ), 0. ).toVar();
    							const spand = st.equal( 3 ).and( f.y.greaterThan( .78 ) ).and( fract( seed.mul( 7.7 ) ).lessThan( .7 ) ).toVar();
    							const inside = select( spand, vec3( 0. ), room( o, vd, dim, hs, lc, select( st.equal( 3 ), 1., 0. ) ) ).toVar();
    							const wf = f.sub( wmin ).div( wmax.sub( wmin ) ).toVar();
    							const cur = fract( hs.mul( 41. ) ).toVar();

    							If( lit.and( cur.lessThan( .3 ) ), () => {

    								const cov = step( wf.x, add( .28, mul( .1, sin( hs.mul( 9. ) ) ) ) ).add( step( .72, wf.x ) ).toVar();
    								inside.assign( mix( inside, lc.mul( L( vec3( .6, .45, .35 ) ) ).mul( add( .6, mul( .2, sin( wf.x.mul( 60. ) ) ) ) ), clamp( cov, 0., 1. ) ) );

    							} ).ElseIf( lit.and( cur.lessThan( .5 ) ), () => {

    								inside.assign( mix( inside, lc.mul( .5 ).mul( add( .5, mul( .5, step( .35, fract( wf.y.mul( 14. ) ) ) ) ) ), .8 ) );

    							} ).ElseIf( lit.not().and( uDay.greaterThan( 0. ) ).and( cur.greaterThan( .55 ) ), () => {

    								const dl = uAmbTop.mul( .55 ).add( uSunCol.mul( .12 ).mul( max( dot( n, uSun ), 0. ) ) ).toVar();
    								const k = fract( hs.mul( 67. ) ).toVar();
    								const cc = L( mix( vec3( .78, .74, .66 ), mix( vec3( .62, .4, .32 ), vec3( .42, .5, .56 ), fract( hs.mul( 5. ) ) ), step( .5, k ) ) ).mul( dl ).toVar();
    								const cov = select( k.lessThan( .35 ), sub( 1., step( abs( wf.x.sub( .5 ) ), mul( .06, fract( hs.mul( 9. ) ) ) ) ), select( k.lessThan( .7 ), step( sub( .75, mul( .5, fract( hs.mul( 13. ) ) ) ), wf.y ).mul( add( .75, mul( .25, step( .4, fract( wf.y.mul( 16. ) ) ) ) ) ), step( wf.x, .3 ).add( step( .7, wf.x ) ) ) ).toVar();
    								inside.assign( mix( inside, cc.mul( add( .85, mul( .15, sin( wf.x.mul( 55. ) ) ) ) ), clamp( cov, 0., 1. ).mul( uDay ) ) );

    							} );

    							const nG = normalize( n.add( Tn.mul( hs.sub( .5 ) ).mul( .05 ) ).add( vec3( 0., hs2.sub( .5 ).mul( .04 ), 0. ) ) ).toVar();

    							If( st.equal( 3 ), () => {

    								const gk = fract( seed.mul( 17.3 ) ).toVar(), pa = add( .08, mul( .14, fract( hs.mul( 29. ) ) ) ).toVar();
    								const sf = sin( f.mul( 3.1416 ) ).toVar(), cf = cos( f.mul( 3.1416 ) ).toVar();
    								nG.assign( normalize( nG.sub( Tn.mul( sgU ).mul( cf.x ).mul( sf.y ).add( vec3( 0., cf.y.mul( sf.x ), 0. ) ).mul( pa ) ) ) );
    								const gT = select( gk.lessThan( .4 ), vec3( .55, .74, .76 ), select( gk.lessThan( .7 ), vec3( .72, .74, .76 ), vec3( .8, .68, .52 ) ) ).toVar();
    								const R0 = select( gk.lessThan( .4 ), .22, select( gk.lessThan( .7 ), .11, .32 ) ).toVar();
    								const F = R0.add( sub( 1., R0 ).mul( pow( sub( 1., max( dot( nG, v ), 0. ) ), 5. ) ) ).toVar();
    								const rc = oppRefl( vW, reflect( v.negate(), nG ), n, seed.add( fi.mul( .37 ) ) ).mul( mix( vec3( 1. ), gT, .45 ) ).toVar();
    								const bk = select( spand, shade( vW, n, v, gT.mul( L( vec3( .07, .08, .09 ) ) ), .5, 0. ), inside.mul( gT ) ).toVar();
    								c.assign( bk.mul( sub( 1., F ) ).add( rc.mul( F.add( mul( .03, uDay ) ) ) ) );
    								c.addAssign( shade( vW, nG, v, vec3( 0. ), .03, 0. ).mul( .7 ) );

    							} ).Else( () => {

    								const F = add( .05, mul( .95, pow( sub( 1., max( dot( nG, v ), 0. ) ), 5. ) ) ).toVar();
    								const rG = reflect( v.negate(), nG ).toVar();
    								c.assign( inside.mul( sub( 1., F.mul( .5 ) ) ).add( oppRefl( vW, rG, n, seed.add( fi.mul( .37 ) ) ).mul( F.mul( .7 ).add( .04 ).add( mul( .1, uDay ) ) ) ) );
    								c.addAssign( shade( vW, n, v, vec3( 0. ), .04, 0. ).mul( .6 ) );

    							} );

    							If( st.equal( 3 ), () => {

    								const mul = step( f.x, .035 ).add( step( .965, f.x ) ).add( step( f.y, .07 ) ).toVar();
    								c.assign( mix( c, facMul( vW, n, v, nW, seed ), clamp( mul, 0., 1. ) ) );

    							} ).Else( () => {

    								const bar = step( abs( wf.y.sub( .52 ) ), .018 ).add( step( abs( wf.x.sub( .5 ) ), .012 ) ).toVar();
    								c.assign( mix( c, shade( vW, n, v, L( vec3( .85, .82, .75 ) ).mul( .4 ), .6, 0. ), clamp( bar, 0., 1. ) ) );

    							} );

    						} ).Else( () => {

    							const alb = wall.toVar();
    							const rr = rough.toVar();

    							If( grid.and( st.notEqual( 3 ) ), () => {

    								const sill = step( abs( f.y.sub( wmin.y ).add( .03 ) ), .03 ).mul( step( wmin.x.sub( .04 ), f.x ) ).mul( step( f.x, wmax.x.add( .04 ) ) ).toVar();
    								const lintel = step( abs( f.y.sub( wmax.y ).sub( .035 ) ), .035 ).mul( step( wmin.x.sub( .02 ), f.x ) ).mul( step( f.x, wmax.x.add( .02 ) ) ).toVar();
    								const frame = step( wmin.x.sub( .025 ), f.x ).mul( step( f.x, wmax.x.add( .025 ) ) ).mul( step( wmin.y.sub( .02 ), f.y ) ).mul( step( f.y, wmax.y.add( .02 ) ) ).toVar();
    								alb.assign( mix( alb, L( vec3( .15, .12, .1 ) ), frame ) );
    								alb.assign( mix( alb, L( vec3( .62, .58, .5 ) ).mul( add( .8, mul( .2, grime ) ) ), max( sill, lintel ).mul( select( st.equal( 2 ), .5, select( st.equal( 8 ), .25, 1. ) ) ) ) );
    								const streak = smoothstep( .0, .5, wmin.y.sub( f.y ) ).mul( step( wmin.x, f.x ) ).mul( step( f.x, wmax.x ) ).mul( fbm( vec2( u.mul( 8. ), y.mul( .5 ) ) ) ).toVar();
    								alb.mulAssign( sub( 1., streak.mul( .4 ) ) );

    							} );

    							If( st.equal( 3 ), () => {

    								c.assign( facMul( vW, n, v, nW, seed ) );

    								If( y.greaterThan( H.sub( 1.6 ) ).and( mod( vB2.w, 2. ).lessThan( .5 ) ), () => {

    									const led = mix( mix( vec3( .2, .9, 1. ), vec3( 1., .35, .6 ), step( fract( seed.mul( 3. ) ), .5 ) ), vec3( 1. ), .35 ).toVar();
    									c.assign( c.mul( .75 ).add( led.mul( 1.8 ).mul( sub( 1., uDay ) ).mul( step( abs( y.sub( H.sub( .9 ) ) ), .08 ) ) ) );
    									fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );
    									done_.assign( true );

    								} );

    							} ).Else( () => {

    								c.assign( shade( vW, nW, v, alb, rr, 0. ) );

    							} );

    							If( done_.not(), () => {

    								If( st.equal( 4 ), () => {

    									const band = step( abs( f.y.sub( .02 ) ), .018 ).mul( step( 0., fi ) ).mul( step( fi, nF ) ).toVar();
    									const bc = mix( vec3( .15, 1., .9 ), vec3( 1., .2, .6 ), step( .5, fract( seed.mul( 11. ) ) ) ).toVar();
    									c.assign( mix( c, c.mul( .55 ), band.mul( uDay ) ).add( bc.mul( band ).mul( 2.4 ).mul( add( .7, mul( .3, sin( uTime.mul( 2. ).add( u.mul( .6 ) ) ) ) ) ).mul( sub( 1., uDay ) ) ) );

    								} );

    							} );

    						} );

    						If( done_.not(), () => {

    							fragOut_.assign( vec4( applyFog( c, vW ), 1. ) );

    						} );

    					} );

    				} );

    			} );

    		} );

    	} );

    	return fragOut_;

    } );

    return main_;
  },
},
};
