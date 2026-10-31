// 材質的 TSL（原本由已刪除的 tools/gen-tsl.mjs 從 GLSL 轉出，現在是著色器的原始碼，直接改這裡）
// 共用函式庫（原本 00-core.js 的 GL_LIB）：鍵是它用到的 defines，make(TSL, E) 回傳函式與全域變數
export default {
"[]NL_T,NOCC_T,SH_N_T,VOL_N_T": (TSL, E) => {
  const { sin, fract, Fn, vec2, dot, vec3, floor, mul, sub, mix, float, Loop, bool, If, sqrt, smoothstep, add, normalize, max, pow, mat3, ivec2, int, Break, select, Continue, min, length, clamp, abs, cos, inverseSqrt, atan, exp, step } = TSL;
  const { uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T } = E;




  const h11 =  Fn( ( [ n ] ) => {

  	return fract( sin( n ).mul( 43758.5453123 ) );

  }, { n: 'float', return: 'float' } );

  const h21 =  Fn( ( [ p_immutable ] ) => {

  	const p = p_immutable.toVar();
  	p.assign( fract( p.mul( vec2( 123.34, 456.21 ) ) ) );
  	p.addAssign( dot( p, p.add( 45.32 ) ) );

  	return fract( p.x.mul( p.y ) );

  }, { p: 'vec2', return: 'float' } );

  const hw =  Fn( ( [ p ] ) => {

  	const q = fract( vec3( p.xyx ).mul( .1031 ) ).toVar();
  	q.addAssign( dot( q, q.yzx.add( 33.33 ) ) );

  	return fract( q.x.add( q.y ).mul( q.z ) );

  }, { p: 'vec2', return: 'float' } );

  const n2 =  Fn( ( [ p ] ) => {

  	const i = floor( p ).toVar(), f = fract( p ).toVar();
  	f.assign( f.mul( f ).mul( sub( 3., mul( 2., f ) ) ) );

  	return mix( mix( h21( i ), h21( i.add( vec2( 1, 0 ) ) ), f.x ), mix( h21( i.add( vec2( 0, 1 ) ) ), h21( i.add( vec2( 1, 1 ) ) ), f.x ), f.y );

  }, { p: 'vec2', return: 'float' } );

  const fbm =  Fn( ( [ p_immutable ] ) => {

  	const p = p_immutable.toVar();
  	const a = float( .5 ).toVar(), s = float( 0. ).toVar();

  	Loop( 4, () => {

  		s.addAssign( a.mul( n2( p ) ) );
  		p.assign( p.mul( 2.03 ).add( 17.1 ) );
  		a.mulAssign( .5 );

  	} );

  	return s;

  }, { p: 'vec2', return: 'float' } );

  const SODIUM = vec3( 1.0, .46, .16 );
  const LEDW = vec3( .55, .78, 1.0 );

  const lampK =  Fn( ( [ lp, p, n, v, shin ] ) => {

  	const done_ = bool( false ).toVar();
  	const ret_ = vec2( 0 ).toVar();
  	const L = lp.sub( p ).toVar();
  	const d2 = dot( L, L ).toVar();

  	If( d2.greaterThan( 420. ), () => {

  		ret_.assign( vec2( 0. ) );
  		done_.assign( true );

  	} );

  	If( done_.not(), () => {

  		const d = sqrt( d2 ).toVar();
  		L.divAssign( d );
  		const win = sub( 1., d2.div( 420. ) ).toVar();
  		win.mulAssign( win );
  		const cone = smoothstep( .0, .6, L.y ).toVar();
  		const att = win.mul( cone ).mul( 26. ).div( add( 4., d2 ) ).toVar();
  		const hv = normalize( L.add( v ) ).toVar();
  		ret_.assign( att.mul( vec2( max( dot( n, L ), 0. ), pow( max( dot( n, hv ), 0. ), shin ).mul( shin.add( 8. ) ).mul( .05 ) ) ) );
  		done_.assign( true );

  	} );

  	return ret_;

  }, { lp: 'vec3', p: 'vec3', n: 'vec3', v: 'vec3', shin: 'float', return: 'vec2' } );

  const NOLIGHT = mat3( vec3( 0. ), vec3( 0. ), vec3( 0. ) );

  const lampGrid =  Fn( ( [ p, n, v, shin ] ) => {

  	const done_ = bool( false ).toVar();
  	const ret_ = mat3( 0 ).toVar();

  	If( uLampOn.lessThan( .5 ), () => {

  		ret_.assign( NOLIGHT );
  		done_.assign( true );

  	} );

  	If( done_.not(), () => {

  		const cs = SODIUM.mul( 2.1 ).mul( uLamp ).toVar(), cl = LEDW.mul( 1.5 ).mul( uLamp ).toVar();
  		const c = ivec2( floor( p.xz.sub( uLampG.xy ).div( 16. ) ) ).toVar();

  		If( c.x.lessThan( 0 ).or( c.y.lessThan( 0 ) ).or( c.x.greaterThanEqual( int( uLampG.z ) ) ).or( c.y.greaterThanEqual( int( uLampG.w ) ) ), () => {

  			ret_.assign( NOLIGHT );
  			done_.assign( true );

  		} );

  		If( done_.not(), () => {

  			const dif = vec3( 0. ).toVar(), spc = vec3( 0. ).toVar();

  			Loop( { start: 0, end: 16, name: 'k' }, ( { k } ) => {

  				const L = uLampT.sample( ivec2( c.x.mul( 16 ).add( k ), c.y ) ).setSampler( false ).toVar();

  				If( L.w.lessThan( .5 ), () => {

  					Break();

  				} );

  				const lk = lampK( vec3( L.x, add( 6.1, L.w ), L.y ), p, n, v, shin ).toVar();
  				const lc = select( L.z.lessThan( .5 ), cs, select( L.z.lessThan( 1.5 ), cl, vec3( 1., .7, .42 ).mul( 1.6 ).mul( uLamp ) ) ).toVar();
  				dif.addAssign( lc.mul( lk.x ) );
  				spc.addAssign( lc.mul( lk.y ) );

  			} );

  			ret_.assign( mat3( dif, spc, vec3( 0. ) ) );
  			done_.assign( true );

  		} );

  	} );

  	return ret_;

  }, { p: 'vec3', n: 'vec3', v: 'vec3', shin: 'float', return: 'mat3' } );

  const pointLights =  Fn( ( [ p, n, v, shin ] ) => {

  	const dif = vec3( 0. ).toVar(), spc = vec3( 0. ).toVar();

  	Loop( NL_T, ( { i } ) => {

  		const lp = uLP.element( i ).toVar();

  		If( lp.w.lessThanEqual( 0. ), () => {

  			Continue();

  		} );

  		const L = lp.xyz.sub( p ).toVar();
  		const d2 = dot( L, L ).toVar();
  		const r2 = lp.w.mul( lp.w ).toVar();

  		If( d2.greaterThan( r2 ), () => {

  			Continue();

  		} );

  		const d = sqrt( d2 ).toVar();
  		L.divAssign( d );
  		const win = sub( 1., d2.div( r2 ) ).toVar();
  		win.mulAssign( win );
  		const ld = uLD.element( i ).toVar();
  		const sp = select( ld.w.greaterThan( -1.5 ), smoothstep( ld.w, ld.w.add( .14 ), dot( L.negate(), ld.xyz ) ), 1. ).toVar();
  		const col = uLC.element( i ).rgb.mul( win ).mul( sp ).mul( 8. ).div( add( 2., d2 ) ).toVar();
  		dif.addAssign( col.mul( max( dot( n, L ), 0. ) ).mul( select( uLC.element( i ).a.greaterThan( .5 ), 1., 1. ) ) );
  		const hv = normalize( L.add( v ) ).toVar();
  		spc.addAssign( col.mul( pow( max( dot( n, hv ), 0. ), shin ) ).mul( shin.add( 8. ) ).mul( .05 ) );

  	} );

  	return mat3( dif, spc, vec3( 0. ) );

  }, { p: 'vec3', n: 'vec3', v: 'vec3', shin: 'float', return: 'mat3' } );

  const leafVis =  Fn( ( [ q, d, k ] ) => {

  	const done_ = bool( false ).toVar();
  	const ret_ = float( 0 ).toVar();

  	If( uTM.w.lessThanEqual( 0. ).or( q.y.greaterThan( uTM.w ) ), () => {

  		ret_.assign( 1. );
  		done_.assign( true );

  	} );

  	If( done_.not(), () => {

  		const lt = float( 1. ).toVar(), t = add( .3, hw( q.xz.mul( 7.3 ) ).mul( .8 ) ).toVar();

  		Loop( 10, () => {

  			const r = vec3( q.x.add( d.x.mul( t ) ), q.y.add( t.mul( k ) ), q.z.add( d.y.mul( t ) ) ).toVar();

  			If( r.y.greaterThan( uTM.w ), () => {

  				Break();

  			} );

  			const tb = uTMap.sample( r.xz.sub( uTM.xy ).mul( uTM.z ) ).level( 0. ).rg.toVar();

  			If( r.y.lessThan( tb.r ).and( r.y.greaterThan( tb.g ) ), () => {

  				const e = min( tb.r.sub( r.y ), r.y.sub( tb.g ) ).toVar();
  				lt.mulAssign( sub( 1., smoothstep( .38, .62, n2( r.xz.mul( .95 ).add( vec2( r.y.mul( .7 ), r.y.negate().mul( .4 ) ) ) ) ).mul( mix( .45, .8, smoothstep( 0., 1.2, e ) ) ) ) );

  				If( lt.lessThan( .18 ), () => {

  					ret_.assign( .18 );
  					done_.assign( true );
  					Break();

  				} );

  			} );

  			If( done_.not(), () => {

  				t.addAssign( add( .9, t.mul( .14 ) ) );

  			} );

  		} );

  		If( done_.not(), () => {

  			ret_.assign( lt );
  			done_.assign( true );

  		} );

  	} );

  	return ret_;

  }, { q: 'vec3', d: 'vec2', k: 'float', return: 'float' } );

  const forestVis =  Fn( ( [ q, d, k ] ) => {

  	const done_ = bool( false ).toVar();
  	const ret_ = float( 0 ).toVar();
  	const u0 = q.xz.sub( uFM.xy ).mul( uFM.z ).toVar();

  	If( uFM.w.lessThanEqual( 0. ).or( u0.x.lessThan( 0. ) ).or( u0.y.lessThan( 0. ) ).or( u0.x.greaterThan( 1. ) ).or( u0.y.greaterThan( 1. ) ), () => {

  		ret_.assign( 1. );
  		done_.assign( true );

  	} );

  	If( done_.not(), () => {

  		const lt = float( 1. ).toVar(), t = add( .3, hw( q.xz.mul( 5.1 ) ).mul( 1.1 ) ).toVar();

  		Loop( 10, () => {

  			const r = vec3( q.x.add( d.x.mul( t ) ), q.y.add( t.mul( k ) ), q.z.add( d.y.mul( t ) ) ).toVar();
  			const tb = uFMap.sample( r.xz.sub( uFM.xy ).mul( uFM.z ) ).level( 0. ).rg.toVar();

  			If( r.y.lessThan( tb.r ).and( r.y.greaterThan( tb.g ) ), () => {

  				const e = min( tb.r.sub( r.y ), r.y.sub( tb.g ) ).toVar();
  				lt.mulAssign( sub( 1., smoothstep( .36, .6, n2( r.xz.mul( .8 ).add( vec2( r.y.mul( .6 ), r.y.negate().mul( .35 ) ) ) ) ).mul( mix( .5, .85, smoothstep( 0., 1.5, e ) ) ) ) );

  				If( lt.lessThan( .15 ), () => {

  					ret_.assign( .15 );
  					done_.assign( true );
  					Break();

  				} );

  			} );

  			If( done_.not(), () => {

  				t.addAssign( add( 1.1, t.mul( .2 ) ) );

  			} );

  		} );

  		If( done_.not(), () => {

  			ret_.assign( lt );
  			done_.assign( true );

  		} );

  	} );

  	return ret_;

  }, { q: 'vec3', d: 'vec2', k: 'float', return: 'float' } );

  const sunVis =  Fn( ( [ p, n ] ) => {

  	const done_ = bool( false ).toVar();
  	const ret_ = float( 0 ).toVar();
  	const sl = max( length( uSun.xz ), 1e-3 ).toVar();
  	const d = uSun.xz.div( sl ).toVar();
  	const k = uSun.y.div( sl ).toVar();
  	const q = p.add( vec3( n.x, 0., n.z ).mul( 1.3 ) ).add( vec3( 0., .2, 0. ) ).toVar();
  	const vis = float( 1. ).toVar(), t = float( .9 ).toVar();

  	Loop( SH_N_T, () => {

  		const ry = q.y.add( t.mul( k ) ).toVar();

  		If( ry.greaterThan( uHM.w ), () => {

  			Break();

  		} );

  		const uv = q.xz.add( d.mul( t ) ).sub( uHM.xy ).mul( uHM.z ).toVar();

  		If( uv.x.lessThan( 0. ).or( uv.y.lessThan( 0. ) ).or( uv.x.greaterThan( 1. ) ).or( uv.y.greaterThan( 1. ) ), () => {

  			Break();

  		} );

  		const h = uHMap.sample( uv ).level( 0. ).r.toVar();
  		vis.assign( min( vis, clamp( ry.sub( h ).div( add( .3, t.mul( .02 ) ) ), 0., 1. ) ) );

  		If( vis.lessThan( .02 ), () => {

  			ret_.assign( 0. );
  			done_.assign( true );
  			Break();

  		} );

  		If( done_.not(), () => {

  			t.assign( t.mul( 1.18 ).add( .9 ) );

  		} );

  	} );

  	If( done_.not(), () => {

  		ret_.assign( vis.mul( leafVis( q, d, k ) ).mul( forestVis( q, d, k ) ) );
  		done_.assign( true );

  	} );

  	return ret_;

  }, { p: 'vec3', n: 'vec3', return: 'float' } );

  const occlude =  Fn( ( [ p ] ) => {

  	const done_ = bool( false ).toVar();
  	const ret_ = vec2( 0 ).toVar();
  	const amb = float( 1. ).toVar(), sun = float( 1. ).toVar();

  	If( p.y.greaterThan( .4 ), () => {

  		ret_.assign( vec2( 1. ) );
  		done_.assign( true );

  	} );

  	If( done_.not(), () => {

  		const sd = select( uSun.y.greaterThan( .06 ), uSun.xz.div( uSun.y ), vec2( 0. ) ).toVar();
  		const lit = uSunCol.r.add( uSunCol.g ).greaterThan( .001 ).toVar();

  		Loop( NOCC_T, ( { i } ) => {

  			const A = uOccA.element( i ).toVar(), B = uOccB.element( i ).toVar();

  			If( B.x.lessThanEqual( 0. ), () => {

  				Continue();

  			} );

  			const d = p.xz.sub( A.xy ).toVar();

  			If( dot( d, d ).greaterThan( 1600. ), () => {

  				Continue();

  			} );

  			const f = vec2( A.w, A.z ).toVar(), r = vec2( A.z, A.w.negate() ).toVar();
  			const l = vec2( dot( d, f ), dot( d, r ) ).toVar();
  			const ext = length( max( abs( l ).sub( B.xy ), 0. ) ).toVar();
  			amb.assign( min( amb, mix( .3, 1., smoothstep( 0., add( .35, B.y.mul( .5 ) ), ext ) ) ) );

  			If( lit, () => {

  				const a = vec2( dot( d, f ), dot( d, r ) ).toVar(), b = a.add( vec2( dot( sd, f ), dot( sd, r ) ).mul( B.z ) ).toVar();
  				const t0 = float( 0. ).toVar(), t1 = float( 1. ).toVar();

  				Loop( { start: 0, end: 4, name: 's' }, () => {

  					const m1 = mix( t0, t1, .382 ).toVar(), m2 = mix( t0, t1, .618 ).toVar();

  					If( length( max( abs( mix( a, b, m1 ) ).sub( B.xy ), 0. ) ).lessThan( length( max( abs( mix( a, b, m2 ) ).sub( B.xy ), 0. ) ) ), () => {

  						t1.assign( m2 );

  					} ).Else( () => {

  						t0.assign( m1 );

  					} );

  				} );

  				sun.assign( min( sun, smoothstep( 0., .2, length( max( abs( mix( a, b, t0.add( t1 ).mul( .5 ) ) ).sub( B.xy ), 0. ) ) ) ) );

  			} );

  		} );

  		ret_.assign( vec2( amb, sun ) );
  		done_.assign( true );

  	} );

  	return ret_;

  }, { p: 'vec3', return: 'vec2' } );

  const skyVis =  Fn( ( [ p, n ] ) => {

  	const q = p.add( vec3( n.x, 0., n.z ).mul( 1.3 ) ).toVar();
  	const nx = n.xz.toVar();
  	const nl = length( nx ).toVar();
  	nx.assign( select( nl.greaterThan( .05 ), nx.div( nl ), vec2( 0. ) ) );
  	const occ = float( 0. ).toVar(), ws = float( 0. ).toVar();

  	Loop( 5, ( { i } ) => {

  		const a = float( i ).mul( 1.2566 ).add( .3 ).toVar();
  		const d = vec2( cos( a ), sin( a ) ).toVar();
  		const w = mix( 1., max( dot( d, nx ), 0. ).mul( 2. ), min( nl.mul( 1.4 ), 1. ) ).toVar();

  		If( w.lessThan( .01 ), () => {

  			Continue();

  		} );

  		const tg = float( 0. ).toVar(), r = float( 6. ).toVar();

  		Loop( { start: 0, end: 2, name: 'k' }, () => {

  			tg.assign( max( tg, uHMap.sample( q.xz.add( d.mul( r ) ).sub( uHM.xy ).mul( uHM.z ) ).level( 0. ).r.sub( q.y ).div( r ) ) );
  			r.mulAssign( 2.7 );

  		} );

  		occ.addAssign( w.mul( clamp( tg.mul( inverseSqrt( add( 1., tg.mul( tg ) ) ) ), 0., 1. ) ) );
  		ws.addAssign( w );

  	} );

  	return sub( 1., occ.div( max( ws, 1e-3 ) ) );

  }, { p: 'vec3', n: 'vec3', return: 'float' } );

  const gSun = float( -1 ), gAmb = float( -1 ), gOccS = float( 1. ), gSky = float( -1 );

  const shade =  Fn( ( [ p, n, v, alb, rough, metal ] ) => {

  	const shin = mix( 300., 5., rough ).toVar();

  	If( gAmb.lessThan( 0. ), () => {

  		const oc = occlude( p ).toVar();
  		gAmb.assign( oc.x );
  		gOccS.assign( oc.y );

  	} );

  	If( gSky.lessThan( 0. ), () => {

  		gSky.assign( select( uGI.x.greaterThan( 0. ).and( dot( p.sub( uCam ), p.sub( uCam ) ).lessThan( 67600. ) ), mix( 1., skyVis( p, n ), uGI.x ), 1. ) );

  	} );

  	const dif = mix( uAmbBot, uAmbTop.mul( gSky ), n.y.mul( .5 ).add( .5 ) ).add( uFlash.mul( vec3( .6, .66, .85 ) ).mul( add( .35, mul( .65, max( n.y, 0. ) ) ) ) ).toVar();

  	If( uGI.y.greaterThan( 0. ), () => {

  		const side = sub( 1., abs( n.y ) ).toVar();
  		const bn = uSunCol.mul( uGI.y ).toVar();
  		dif.addAssign( bn.mul( vec3( .5, .42, .36 ) ).mul( add( .06, mul( .5, max( uSun.y, 0. ) ) ) ).mul( max( n.y.negate(), 0. ).add( side.mul( .5 ) ) ).mul( .5 ) );
  		dif.addAssign( bn.mul( vec3( .62, .46, .36 ) ).mul( max( dot( vec3( n.x, 0., n.z ).negate(), uSun ), 0. ) ).mul( side ).mul( sub( 1.15, gSky ) ).mul( .32 ) );

  	} );

  	const spc = vec3( 0 ).toVar();
  	const lg = lampGrid( p, n, v, shin ).toVar(), pl = pointLights( p, n, v, shin ).toVar();
  	dif.addAssign( lg[ 0 ].add( pl[ 0 ] ) );
  	spc.addAssign( lg[ 1 ].add( pl[ 1 ] ) );
  	dif.mulAssign( gAmb );
  	spc.mulAssign( gAmb );

  	If( uSunCol.r.add( uSunCol.g ).greaterThan( .001 ), () => {

  		const nl = dot( n, uSun ).toVar();

  		If( nl.greaterThan( 0. ), () => {

  			If( gSun.lessThan( 0. ), () => {

  				gSun.assign( sunVis( p, n ).mul( gOccS ) );

  			} );

  			const sc = uSunCol.mul( gSun ).toVar();
  			dif.addAssign( sc.mul( nl ) );
  			const hv = normalize( uSun.add( v ) ).toVar();
  			spc.addAssign( sc.mul( pow( max( dot( n, hv ), 0. ), shin ) ).mul( shin.add( 8. ) ).mul( .025 ).mul( nl ) );

  		} );

  	} );

  	const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
  	const ks = mix( vec3( F.add( .02 ) ), alb, metal ).mul( sub( 1., rough.mul( .8 ) ) ).toVar();

  	return alb.mul( sub( 1., metal ) ).mul( dif ).add( ks.mul( spc ) );

  }, { p: 'vec3', n: 'vec3', v: 'vec3', alb: 'vec3', rough: 'float', metal: 'float', return: 'vec3' } );

  // s：窗格平滑（0 原樣、1 淡成平均的城市光帶）。車漆這種彎曲的鏡面反射窗格會碎成一塊塊彩色方塊，車身的材質傳 1（envMapS）
  const envMapS =  Fn( ( [ r, s ] ) => {

  	const y = r.y.toVar();
  	const az = atan( r.z, r.x ).toVar();
  	const cell = floor( az.mul( 22. ) ).toVar();
  	const band = exp( abs( y.sub( .04 ) ).negate().mul( 11. ) ).toVar();
  	const on = step( .42, h21( vec2( cell, floor( y.mul( 30. ) ) ) ) ).toVar();
  	const lc = mix( SODIUM.mul( 1.4 ), vec3( .25, .95, 1. ), step( .6, h21( vec2( cell, 3. ) ) ) ).toVar();
  	lc.assign( mix( lc, vec3( 1., .25, .55 ), step( .82, h21( vec2( cell, 7. ) ) ) ) );
  	on.assign( mix( on, .58, s ) );   // 亮窗的比例
  	lc.assign( mix( lc, vec3( .95, .67, .54 ), s ) );   // 三種窗色依出現比例的平均
  	const sky = mix( uFogHi.mul( 1.6 ), vec3( .012, .012, .02 ), smoothstep( .0, .7, y ) ).toVar();
  	sky.addAssign( band.mul( add( .06, on.mul( .55 ).mul( lc ).mul( mix( smoothstep( .0, .08, fract( az.mul( 22. ) ) ).mul( smoothstep( 1., .92, fract( az.mul( 22. ) ) ) ), .92, s ) ) ) ) );

  	If( y.lessThan( 0. ), () => {

  		sky.assign( mix( uFogCol.mul( 1.2 ), vec3( .006 ), smoothstep( 0., -0.35, y ) ).add( band.mul( .25 ).mul( lc ).mul( on ) ) );

  	} );

  	If( uDay.greaterThan( .001 ), () => {

  		const dc = mix( uSkyHor, uSkyTop, smoothstep( 0., .55, y ) ).toVar();
  		dc.addAssign( uSunCol.mul( pow( max( dot( r, uSun ), 0. ), 350. ).mul( 5. ).add( pow( max( dot( r, uSun ), 0. ), 8. ).mul( .12 ) ) ) );

  		If( y.lessThan( 0. ), () => {

  			dc.assign( mix( uFogCol, uFogCol.mul( .3 ), smoothstep( 0., -0.35, y ) ) );

  		} );

  		sky.assign( mix( sky, dc, uDay ) );

  	} );

  	return sky.add( uFlash.mul( .6 ).mul( vec3( .6, .65, .85 ) ).mul( max( y, 0. ) ) );

  }, { r: 'vec3', s: 'float', return: 'vec3' } );
  const envMap =  Fn( ( [ r ] ) => envMapS( r, 1. ), { r: 'vec3', return: 'vec3' } );   // 使用者：晚上地面與物體映出奇怪的七彩色塊（夜景窗格每格隨機鈉黃／青／洋紅，護欄、濕路面上一格一格跳色）：全部改用平滑的城市光帶

  const applyFog =  Fn( ( [ c_immutable, p ] ) => {

  	const c = c_immutable.toVar();
  	const d = p.sub( uCam ).toVar();
  	const dist = length( d ).toVar();
  	const hf = exp( max( p.y, 0. ).negate().mul( .02 ) ).toVar(), D = add( .5, mul( .5, hf ) ).toVar();
  	const hk = smoothstep( 20., 120., uCam.y ).mul( uCityM.sample( p.xz.sub( uHM.xy ).mul( uHM.z ) ).r ).toVar(), yc = max( uCam.y, 0. ).toVar(), yp = max( p.y, 0. ).toVar(), dy = abs( yc.sub( yp ) ).toVar();
  	const Da = select( dy.greaterThan( 1. ), mul( 20., abs( exp( yp.negate().div( 20. ) ).sub( exp( yc.negate().div( 20. ) ) ) ) ).div( dy ), exp( yp.negate().div( 20. ) ) ).toVar();
  	D.assign( mix( D, min( D, add( .02, Da ) ), hk ) );

  	If( uAirB.x.greaterThan( 0. ), () => {

  		const q = p.xz.sub( uAirA.xy ).toVar(), lq = abs( vec2( dot( q, uAirA.zw ), dot( q, vec2( uAirA.w.negate(), uAirA.z ) ) ) ).sub( uAirB.xy ).toVar();
  		D.assign( mix( D, min( D, add( .02, Da ) ), smoothstep( 20., 120., uCam.y ).mul( sub( 1., smoothstep( 0., 80., max( lq.x, lq.y ) ) ) ) ) );

  	} );

  	const x = dist.mul( uFogDen ).mul( D ).toVar();
  	// 使用者：拿掉霧氣。近處與中距離不再起霧，只在原本就整片進霧的距離前（夜裡的指數霧 x ≈ 4.6、白天的平方指數霧 x ≈ 2.15，都是 99%）淡出，
  	// 藏住 420 m 外不畫的建築（10-city.js 的 distCull）；淡出的終點不比原本遠，70-render.js 的 fogCull 與 20-props.js 遠景樹的剔除照舊成立
  	const f = smoothstep( .5, 1., x.div( mix( 4.6, 2.15, uDay ) ) ).toVar();
  	f.assign( max( f, hk.mul( smoothstep( .6, .97, length( d.xz ).div( uCullR ) ) ) ) );
  	const dir = d.div( max( dist, 1e-3 ) ).toVar();
  	const fc = mix( uFogCol, uFogHi, smoothstep( -0.05, .45, dir.y ) ).mul( add( 1., uFlash.mul( 1.5 ) ) ).toVar();
  	const sd = max( dot( dir, uSun ), 0. ).toVar(), ph = sd.mul( sd ).mul( sd ).mul( .25 ).add( pow( sd, 24. ).mul( .9 ) ).toVar();
  	fc.addAssign( uSunCol.mul( ph ).mul( uGI.w ) );

  	If( uGI.z.greaterThan( 0. ), () => {

  		const ya = max( uCam.y, 0. ).toVar(), yb = max( p.y, 0. ).toVar(), dh = yb.sub( ya ).toVar();
  		const Dm = select( abs( dh ).greaterThan( .3 ), mul( 7., exp( ya.negate().div( 7. ) ).sub( exp( yb.negate().div( 7. ) ) ) ).div( dh ), exp( yb.negate().div( 7. ) ) ).toVar();
  		const fm = sub( 1., exp( dist.negate().mul( uGI.z ).mul( Dm ) ) ).toVar();
  		c.assign( mix( c, uFogCol.mul( 1.08 ).add( uSunCol.mul( ph ).mul( .6 ) ), fm ) );

  	} );

  	return mix( c, fc, clamp( f, 0., 1. ) );

  }, { c: 'vec3', p: 'vec3', return: 'vec3' } );

  const farK =  Fn( ( [ k ] ) => {

  	return mix( k, 1., smoothstep( 40., 180., uCam.y ) );

  }, { k: 'float', return: 'float' } );

  return { h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK };
},
"[[\"FAR\",\"*\"]]NL_T,NOCC_T,SH_N_T,VOL_N_T,FAR": (TSL, E) => {
  const { sin, fract, Fn, vec2, dot, vec3, floor, mul, sub, mix, float, Loop, bool, If, sqrt, smoothstep, add, normalize, max, pow, mat3, ivec2, int, Break, select, Continue, min, length, clamp, abs, cos, inverseSqrt, atan, exp, step } = TSL;
  const { uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR } = E;




  const h11 =  Fn( ( [ n ] ) => {

  	return fract( sin( n ).mul( 43758.5453123 ) );

  }, { n: 'float', return: 'float' } );

  const h21 =  Fn( ( [ p_immutable ] ) => {

  	const p = p_immutable.toVar();
  	p.assign( fract( p.mul( vec2( 123.34, 456.21 ) ) ) );
  	p.addAssign( dot( p, p.add( 45.32 ) ) );

  	return fract( p.x.mul( p.y ) );

  }, { p: 'vec2', return: 'float' } );

  const hw =  Fn( ( [ p ] ) => {

  	const q = fract( vec3( p.xyx ).mul( .1031 ) ).toVar();
  	q.addAssign( dot( q, q.yzx.add( 33.33 ) ) );

  	return fract( q.x.add( q.y ).mul( q.z ) );

  }, { p: 'vec2', return: 'float' } );

  const n2 =  Fn( ( [ p ] ) => {

  	const i = floor( p ).toVar(), f = fract( p ).toVar();
  	f.assign( f.mul( f ).mul( sub( 3., mul( 2., f ) ) ) );

  	return mix( mix( h21( i ), h21( i.add( vec2( 1, 0 ) ) ), f.x ), mix( h21( i.add( vec2( 0, 1 ) ) ), h21( i.add( vec2( 1, 1 ) ) ), f.x ), f.y );

  }, { p: 'vec2', return: 'float' } );

  const fbm =  Fn( ( [ p_immutable ] ) => {

  	const p = p_immutable.toVar();
  	const a = float( .5 ).toVar(), s = float( 0. ).toVar();

  	Loop( 4, () => {

  		s.addAssign( a.mul( n2( p ) ) );
  		p.assign( p.mul( 2.03 ).add( 17.1 ) );
  		a.mulAssign( .5 );

  	} );

  	return s;

  }, { p: 'vec2', return: 'float' } );

  const SODIUM = vec3( 1.0, .46, .16 );
  const LEDW = vec3( .55, .78, 1.0 );

  const lampK =  Fn( ( [ lp, p, n, v, shin ] ) => {

  	const done_ = bool( false ).toVar();
  	const ret_ = vec2( 0 ).toVar();
  	const L = lp.sub( p ).toVar();
  	const d2 = dot( L, L ).toVar();

  	If( d2.greaterThan( 420. ), () => {

  		ret_.assign( vec2( 0. ) );
  		done_.assign( true );

  	} );

  	If( done_.not(), () => {

  		const d = sqrt( d2 ).toVar();
  		L.divAssign( d );
  		const win = sub( 1., d2.div( 420. ) ).toVar();
  		win.mulAssign( win );
  		const cone = smoothstep( .0, .6, L.y ).toVar();
  		const att = win.mul( cone ).mul( 26. ).div( add( 4., d2 ) ).toVar();
  		const hv = normalize( L.add( v ) ).toVar();
  		ret_.assign( att.mul( vec2( max( dot( n, L ), 0. ), pow( max( dot( n, hv ), 0. ), shin ).mul( shin.add( 8. ) ).mul( .05 ) ) ) );
  		done_.assign( true );

  	} );

  	return ret_;

  }, { lp: 'vec3', p: 'vec3', n: 'vec3', v: 'vec3', shin: 'float', return: 'vec2' } );

  const NOLIGHT = mat3( vec3( 0. ), vec3( 0. ), vec3( 0. ) );

  const lampGrid =  Fn( ( [ p, n, v, shin ] ) => {

  	const done_ = bool( false ).toVar();
  	const ret_ = mat3( 0 ).toVar();

  	If( uLampOn.lessThan( .5 ), () => {

  		ret_.assign( NOLIGHT );
  		done_.assign( true );

  	} );

  	If( done_.not(), () => {

  		const cs = SODIUM.mul( 2.1 ).mul( uLamp ).toVar(), cl = LEDW.mul( 1.5 ).mul( uLamp ).toVar();
  		const c = ivec2( floor( p.xz.sub( uLampG.xy ).div( 16. ) ) ).toVar();

  		If( c.x.lessThan( 0 ).or( c.y.lessThan( 0 ) ).or( c.x.greaterThanEqual( int( uLampG.z ) ) ).or( c.y.greaterThanEqual( int( uLampG.w ) ) ), () => {

  			ret_.assign( NOLIGHT );
  			done_.assign( true );

  		} );

  		If( done_.not(), () => {

  			const dif = vec3( 0. ).toVar(), spc = vec3( 0. ).toVar();

  			Loop( { start: 0, end: 16, name: 'k' }, ( { k } ) => {

  				const L = uLampT.sample( ivec2( c.x.mul( 16 ).add( k ), c.y ) ).setSampler( false ).toVar();

  				If( L.w.lessThan( .5 ), () => {

  					Break();

  				} );

  				const lk = lampK( vec3( L.x, add( 6.1, L.w ), L.y ), p, n, v, shin ).toVar();
  				const lc = select( L.z.lessThan( .5 ), cs, select( L.z.lessThan( 1.5 ), cl, vec3( 1., .7, .42 ).mul( 1.6 ).mul( uLamp ) ) ).toVar();
  				dif.addAssign( lc.mul( lk.x ) );
  				spc.addAssign( lc.mul( lk.y ) );

  			} );

  			ret_.assign( mat3( dif, spc, vec3( 0. ) ) );
  			done_.assign( true );

  		} );

  	} );

  	return ret_;

  }, { p: 'vec3', n: 'vec3', v: 'vec3', shin: 'float', return: 'mat3' } );

  const pointLights =  Fn( ( [ p, n, v, shin ] ) => {

  	const dif = vec3( 0. ).toVar(), spc = vec3( 0. ).toVar();

  	Loop( NL_T, ( { i } ) => {

  		const lp = uLP.element( i ).toVar();

  		If( lp.w.lessThanEqual( 0. ), () => {

  			Continue();

  		} );

  		const L = lp.xyz.sub( p ).toVar();
  		const d2 = dot( L, L ).toVar();
  		const r2 = lp.w.mul( lp.w ).toVar();

  		If( d2.greaterThan( r2 ), () => {

  			Continue();

  		} );

  		const d = sqrt( d2 ).toVar();
  		L.divAssign( d );
  		const win = sub( 1., d2.div( r2 ) ).toVar();
  		win.mulAssign( win );
  		const ld = uLD.element( i ).toVar();
  		const sp = select( ld.w.greaterThan( -1.5 ), smoothstep( ld.w, ld.w.add( .14 ), dot( L.negate(), ld.xyz ) ), 1. ).toVar();
  		const col = uLC.element( i ).rgb.mul( win ).mul( sp ).mul( 8. ).div( add( 2., d2 ) ).toVar();
  		dif.addAssign( col.mul( max( dot( n, L ), 0. ) ).mul( select( uLC.element( i ).a.greaterThan( .5 ), 1., 1. ) ) );
  		const hv = normalize( L.add( v ) ).toVar();
  		spc.addAssign( col.mul( pow( max( dot( n, hv ), 0. ), shin ) ).mul( shin.add( 8. ) ).mul( .05 ) );

  	} );

  	return mat3( dif, spc, vec3( 0. ) );

  }, { p: 'vec3', n: 'vec3', v: 'vec3', shin: 'float', return: 'mat3' } );

  const leafVis =  Fn( ( [ q, d, k ] ) => {

  	const done_ = bool( false ).toVar();
  	const ret_ = float( 0 ).toVar();

  	If( uTM.w.lessThanEqual( 0. ).or( q.y.greaterThan( uTM.w ) ), () => {

  		ret_.assign( 1. );
  		done_.assign( true );

  	} );

  	If( done_.not(), () => {

  		const lt = float( 1. ).toVar(), t = add( .3, hw( q.xz.mul( 7.3 ) ).mul( .8 ) ).toVar();

  		Loop( 10, () => {

  			const r = vec3( q.x.add( d.x.mul( t ) ), q.y.add( t.mul( k ) ), q.z.add( d.y.mul( t ) ) ).toVar();

  			If( r.y.greaterThan( uTM.w ), () => {

  				Break();

  			} );

  			const tb = uTMap.sample( r.xz.sub( uTM.xy ).mul( uTM.z ) ).level( 0. ).rg.toVar();

  			If( r.y.lessThan( tb.r ).and( r.y.greaterThan( tb.g ) ), () => {

  				const e = min( tb.r.sub( r.y ), r.y.sub( tb.g ) ).toVar();
  				lt.mulAssign( sub( 1., smoothstep( .38, .62, n2( r.xz.mul( .95 ).add( vec2( r.y.mul( .7 ), r.y.negate().mul( .4 ) ) ) ) ).mul( mix( .45, .8, smoothstep( 0., 1.2, e ) ) ) ) );

  				If( lt.lessThan( .18 ), () => {

  					ret_.assign( .18 );
  					done_.assign( true );
  					Break();

  				} );

  			} );

  			If( done_.not(), () => {

  				t.addAssign( add( .9, t.mul( .14 ) ) );

  			} );

  		} );

  		If( done_.not(), () => {

  			ret_.assign( lt );
  			done_.assign( true );

  		} );

  	} );

  	return ret_;

  }, { q: 'vec3', d: 'vec2', k: 'float', return: 'float' } );

  const forestVis =  Fn( ( [ q, d, k ] ) => {

  	const done_ = bool( false ).toVar();
  	const ret_ = float( 0 ).toVar();
  	const u0 = q.xz.sub( uFM.xy ).mul( uFM.z ).toVar();

  	If( uFM.w.lessThanEqual( 0. ).or( u0.x.lessThan( 0. ) ).or( u0.y.lessThan( 0. ) ).or( u0.x.greaterThan( 1. ) ).or( u0.y.greaterThan( 1. ) ), () => {

  		ret_.assign( 1. );
  		done_.assign( true );

  	} );

  	If( done_.not(), () => {

  		const lt = float( 1. ).toVar(), t = add( .3, hw( q.xz.mul( 5.1 ) ).mul( 1.1 ) ).toVar();

  		Loop( 10, () => {

  			const r = vec3( q.x.add( d.x.mul( t ) ), q.y.add( t.mul( k ) ), q.z.add( d.y.mul( t ) ) ).toVar();
  			const tb = uFMap.sample( r.xz.sub( uFM.xy ).mul( uFM.z ) ).level( 0. ).rg.toVar();

  			If( r.y.lessThan( tb.r ).and( r.y.greaterThan( tb.g ) ), () => {

  				const e = min( tb.r.sub( r.y ), r.y.sub( tb.g ) ).toVar();
  				lt.mulAssign( sub( 1., smoothstep( .36, .6, n2( r.xz.mul( .8 ).add( vec2( r.y.mul( .6 ), r.y.negate().mul( .35 ) ) ) ) ).mul( mix( .5, .85, smoothstep( 0., 1.5, e ) ) ) ) );

  				If( lt.lessThan( .15 ), () => {

  					ret_.assign( .15 );
  					done_.assign( true );
  					Break();

  				} );

  			} );

  			If( done_.not(), () => {

  				t.addAssign( add( 1.1, t.mul( .2 ) ) );

  			} );

  		} );

  		If( done_.not(), () => {

  			ret_.assign( lt );
  			done_.assign( true );

  		} );

  	} );

  	return ret_;

  }, { q: 'vec3', d: 'vec2', k: 'float', return: 'float' } );

  const sunVis =  Fn( ( [ p, n ] ) => {

  	const done_ = bool( false ).toVar();
  	const ret_ = float( 0 ).toVar();
  	const sl = max( length( uSun.xz ), 1e-3 ).toVar();
  	const d = uSun.xz.div( sl ).toVar();
  	const k = uSun.y.div( sl ).toVar();
  	const q = p.add( vec3( n.x, 0., n.z ).mul( 1.3 ) ).add( vec3( 0., .2, 0. ) ).toVar();
  	const vis = float( 1. ).toVar(), t = float( .9 ).toVar();

  	Loop( SH_N_T, () => {

  		const ry = q.y.add( t.mul( k ) ).toVar();

  		If( ry.greaterThan( uHM.w ), () => {

  			Break();

  		} );

  		const uv = q.xz.add( d.mul( t ) ).sub( uHM.xy ).mul( uHM.z ).toVar();

  		If( uv.x.lessThan( 0. ).or( uv.y.lessThan( 0. ) ).or( uv.x.greaterThan( 1. ) ).or( uv.y.greaterThan( 1. ) ), () => {

  			Break();

  		} );

  		const h = uHMap.sample( uv ).level( 0. ).r.toVar();
  		vis.assign( min( vis, clamp( ry.sub( h ).div( add( .3, t.mul( .02 ) ) ), 0., 1. ) ) );

  		If( vis.lessThan( .02 ), () => {

  			ret_.assign( 0. );
  			done_.assign( true );
  			Break();

  		} );

  		If( done_.not(), () => {

  			t.assign( t.mul( 1.18 ).add( .9 ) );

  		} );

  	} );

  	If( done_.not(), () => {

  		ret_.assign( vis.mul( leafVis( q, d, k ) ).mul( forestVis( q, d, k ) ) );
  		done_.assign( true );

  	} );

  	return ret_;

  }, { p: 'vec3', n: 'vec3', return: 'float' } );

  const occlude =  Fn( ( [ p ] ) => {

  	const done_ = bool( false ).toVar();
  	const ret_ = vec2( 0 ).toVar();
  	const amb = float( 1. ).toVar(), sun = float( 1. ).toVar();

  	If( p.y.greaterThan( .4 ), () => {

  		ret_.assign( vec2( 1. ) );
  		done_.assign( true );

  	} );

  	If( done_.not(), () => {

  		const sd = select( uSun.y.greaterThan( .06 ), uSun.xz.div( uSun.y ), vec2( 0. ) ).toVar();
  		const lit = uSunCol.r.add( uSunCol.g ).greaterThan( .001 ).toVar();

  		Loop( NOCC_T, ( { i } ) => {

  			const A = uOccA.element( i ).toVar(), B = uOccB.element( i ).toVar();

  			If( B.x.lessThanEqual( 0. ), () => {

  				Continue();

  			} );

  			const d = p.xz.sub( A.xy ).toVar();

  			If( dot( d, d ).greaterThan( 1600. ), () => {

  				Continue();

  			} );

  			const f = vec2( A.w, A.z ).toVar(), r = vec2( A.z, A.w.negate() ).toVar();
  			const l = vec2( dot( d, f ), dot( d, r ) ).toVar();
  			const ext = length( max( abs( l ).sub( B.xy ), 0. ) ).toVar();
  			amb.assign( min( amb, mix( .3, 1., smoothstep( 0., add( .35, B.y.mul( .5 ) ), ext ) ) ) );

  			If( lit, () => {

  				const a = vec2( dot( d, f ), dot( d, r ) ).toVar(), b = a.add( vec2( dot( sd, f ), dot( sd, r ) ).mul( B.z ) ).toVar();
  				const t0 = float( 0. ).toVar(), t1 = float( 1. ).toVar();

  				Loop( { start: 0, end: 4, name: 's' }, () => {

  					const m1 = mix( t0, t1, .382 ).toVar(), m2 = mix( t0, t1, .618 ).toVar();

  					If( length( max( abs( mix( a, b, m1 ) ).sub( B.xy ), 0. ) ).lessThan( length( max( abs( mix( a, b, m2 ) ).sub( B.xy ), 0. ) ) ), () => {

  						t1.assign( m2 );

  					} ).Else( () => {

  						t0.assign( m1 );

  					} );

  				} );

  				sun.assign( min( sun, smoothstep( 0., .2, length( max( abs( mix( a, b, t0.add( t1 ).mul( .5 ) ) ).sub( B.xy ), 0. ) ) ) ) );

  			} );

  		} );

  		ret_.assign( vec2( amb, sun ) );
  		done_.assign( true );

  	} );

  	return ret_;

  }, { p: 'vec3', return: 'vec2' } );

  const skyVis =  Fn( ( [ p, n ] ) => {

  	const q = p.add( vec3( n.x, 0., n.z ).mul( 1.3 ) ).toVar();
  	const nx = n.xz.toVar();
  	const nl = length( nx ).toVar();
  	nx.assign( select( nl.greaterThan( .05 ), nx.div( nl ), vec2( 0. ) ) );
  	const occ = float( 0. ).toVar(), ws = float( 0. ).toVar();

  	Loop( 5, ( { i } ) => {

  		const a = float( i ).mul( 1.2566 ).add( .3 ).toVar();
  		const d = vec2( cos( a ), sin( a ) ).toVar();
  		const w = mix( 1., max( dot( d, nx ), 0. ).mul( 2. ), min( nl.mul( 1.4 ), 1. ) ).toVar();

  		If( w.lessThan( .01 ), () => {

  			Continue();

  		} );

  		const tg = float( 0. ).toVar(), r = float( 6. ).toVar();

  		Loop( { start: 0, end: 2, name: 'k' }, () => {

  			tg.assign( max( tg, uHMap.sample( q.xz.add( d.mul( r ) ).sub( uHM.xy ).mul( uHM.z ) ).level( 0. ).r.sub( q.y ).div( r ) ) );
  			r.mulAssign( 2.7 );

  		} );

  		occ.addAssign( w.mul( clamp( tg.mul( inverseSqrt( add( 1., tg.mul( tg ) ) ) ), 0., 1. ) ) );
  		ws.addAssign( w );

  	} );

  	return sub( 1., occ.div( max( ws, 1e-3 ) ) );

  }, { p: 'vec3', n: 'vec3', return: 'float' } );

  const gSun = float( -1 ), gAmb = float( -1 ), gOccS = float( 1. ), gSky = float( -1 );

  const shade =  Fn( ( [ p, n, v, alb, rough, metal ] ) => {

  	const shin = mix( 300., 5., rough ).toVar();

  	If( gAmb.lessThan( 0. ), () => {

  		const oc = occlude( p ).toVar();
  		gAmb.assign( oc.x );
  		gOccS.assign( oc.y );

  	} );

  	If( gSky.lessThan( 0. ), () => {

  		gSky.assign( select( uGI.x.greaterThan( 0. ).and( dot( p.sub( uCam ), p.sub( uCam ) ).lessThan( 67600. ) ), mix( 1., skyVis( p, n ), uGI.x ), 1. ) );

  	} );

  	const dif = mix( uAmbBot, uAmbTop.mul( gSky ), n.y.mul( .5 ).add( .5 ) ).add( uFlash.mul( vec3( .6, .66, .85 ) ).mul( add( .35, mul( .65, max( n.y, 0. ) ) ) ) ).toVar();

  	If( uGI.y.greaterThan( 0. ), () => {

  		const side = sub( 1., abs( n.y ) ).toVar();
  		const bn = uSunCol.mul( uGI.y ).toVar();
  		dif.addAssign( bn.mul( vec3( .5, .42, .36 ) ).mul( add( .06, mul( .5, max( uSun.y, 0. ) ) ) ).mul( max( n.y.negate(), 0. ).add( side.mul( .5 ) ) ).mul( .5 ) );
  		dif.addAssign( bn.mul( vec3( .62, .46, .36 ) ).mul( max( dot( vec3( n.x, 0., n.z ).negate(), uSun ), 0. ) ).mul( side ).mul( sub( 1.15, gSky ) ).mul( .32 ) );

  	} );

  	const spc = vec3( 0 ).toVar();
  	const lg = lampGrid( p, n, v, shin ).toVar(), pl = pointLights( p, n, v, shin ).toVar();
  	dif.addAssign( lg[ 0 ].add( pl[ 0 ] ) );
  	spc.addAssign( lg[ 1 ].add( pl[ 1 ] ) );
  	dif.mulAssign( gAmb );
  	spc.mulAssign( gAmb );

  	If( uSunCol.r.add( uSunCol.g ).greaterThan( .001 ), () => {

  		const nl = dot( n, uSun ).toVar();

  		If( nl.greaterThan( 0. ), () => {

  			If( gSun.lessThan( 0. ), () => {

  				gSun.assign( sunVis( p, n ).mul( gOccS ) );

  			} );

  			const sc = uSunCol.mul( gSun ).toVar();
  			dif.addAssign( sc.mul( nl ) );
  			const hv = normalize( uSun.add( v ) ).toVar();
  			spc.addAssign( sc.mul( pow( max( dot( n, hv ), 0. ), shin ) ).mul( shin.add( 8. ) ).mul( .025 ).mul( nl ) );

  		} );

  	} );

  	const F = add( .04, mul( .96, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
  	const ks = mix( vec3( F.add( .02 ) ), alb, metal ).mul( sub( 1., rough.mul( .8 ) ) ).toVar();

  	return alb.mul( sub( 1., metal ) ).mul( dif ).add( ks.mul( spc ) );

  }, { p: 'vec3', n: 'vec3', v: 'vec3', alb: 'vec3', rough: 'float', metal: 'float', return: 'vec3' } );

  // s：窗格平滑（0 原樣、1 淡成平均的城市光帶）。車漆這種彎曲的鏡面反射窗格會碎成一塊塊彩色方塊，車身的材質傳 1（envMapS）
  const envMapS =  Fn( ( [ r, s ] ) => {

  	const y = r.y.toVar();
  	const az = atan( r.z, r.x ).toVar();
  	const cell = floor( az.mul( 22. ) ).toVar();
  	const band = exp( abs( y.sub( .04 ) ).negate().mul( 11. ) ).toVar();
  	const on = step( .42, h21( vec2( cell, floor( y.mul( 30. ) ) ) ) ).toVar();
  	const lc = mix( SODIUM.mul( 1.4 ), vec3( .25, .95, 1. ), step( .6, h21( vec2( cell, 3. ) ) ) ).toVar();
  	lc.assign( mix( lc, vec3( 1., .25, .55 ), step( .82, h21( vec2( cell, 7. ) ) ) ) );
  	on.assign( mix( on, .58, s ) );   // 亮窗的比例
  	lc.assign( mix( lc, vec3( .95, .67, .54 ), s ) );   // 三種窗色依出現比例的平均
  	const sky = mix( uFogHi.mul( 1.6 ), vec3( .012, .012, .02 ), smoothstep( .0, .7, y ) ).toVar();
  	sky.addAssign( band.mul( add( .06, on.mul( .55 ).mul( lc ).mul( mix( smoothstep( .0, .08, fract( az.mul( 22. ) ) ).mul( smoothstep( 1., .92, fract( az.mul( 22. ) ) ) ), .92, s ) ) ) ) );

  	If( y.lessThan( 0. ), () => {

  		sky.assign( mix( uFogCol.mul( 1.2 ), vec3( .006 ), smoothstep( 0., -0.35, y ) ).add( band.mul( .25 ).mul( lc ).mul( on ) ) );

  	} );

  	If( uDay.greaterThan( .001 ), () => {

  		const dc = mix( uSkyHor, uSkyTop, smoothstep( 0., .55, y ) ).toVar();
  		dc.addAssign( uSunCol.mul( pow( max( dot( r, uSun ), 0. ), 350. ).mul( 5. ).add( pow( max( dot( r, uSun ), 0. ), 8. ).mul( .12 ) ) ) );

  		If( y.lessThan( 0. ), () => {

  			dc.assign( mix( uFogCol, uFogCol.mul( .3 ), smoothstep( 0., -0.35, y ) ) );

  		} );

  		sky.assign( mix( sky, dc, uDay ) );

  	} );

  	return sky.add( uFlash.mul( .6 ).mul( vec3( .6, .65, .85 ) ).mul( max( y, 0. ) ) );

  }, { r: 'vec3', s: 'float', return: 'vec3' } );
  const envMap =  Fn( ( [ r ] ) => envMapS( r, 1. ), { r: 'vec3', return: 'vec3' } );   // 使用者：晚上地面與物體映出奇怪的七彩色塊（夜景窗格每格隨機鈉黃／青／洋紅，護欄、濕路面上一格一格跳色）：全部改用平滑的城市光帶

  const applyFog =  Fn( ( [ c_immutable, p ] ) => {

  	const c = c_immutable.toVar();
  	const d = p.sub( uCam ).toVar();
  	const dist = length( d ).toVar();
  	const hf = exp( max( p.y, 0. ).negate().mul( .02 ) ).toVar(), D = add( .5, mul( .5, hf ) ).toVar();
  	const hk = smoothstep( 20., 120., uCam.y ).mul( uCityM.sample( p.xz.sub( uHM.xy ).mul( uHM.z ) ).r ).toVar(), yc = max( uCam.y, 0. ).toVar(), yp = max( p.y, 0. ).toVar(), dy = abs( yc.sub( yp ) ).toVar();
  	const Da = select( dy.greaterThan( 1. ), mul( 20., abs( exp( yp.negate().div( 20. ) ).sub( exp( yc.negate().div( 20. ) ) ) ) ).div( dy ), exp( yp.negate().div( 20. ) ) ).toVar();

  	If( uAirB.x.greaterThan( 0. ), () => {

  		const q = p.xz.sub( uAirA.xy ).toVar(), lq = abs( vec2( dot( q, uAirA.zw ), dot( q, vec2( uAirA.w.negate(), uAirA.z ) ) ) ).sub( uAirB.xy ).toVar();
  		D.assign( mix( D, min( D, add( .02, Da ) ), smoothstep( 20., 120., uCam.y ).mul( sub( 1., smoothstep( 0., 80., max( lq.x, lq.y ) ) ) ) ) );

  	} );

  	const x = dist.mul( uFogDen ).mul( D ).toVar();
  	// 使用者：拿掉霧氣。近處與中距離不再起霧，只在原本就整片進霧的距離前（夜裡的指數霧 x ≈ 4.6、白天的平方指數霧 x ≈ 2.15，都是 99%）淡出，
  	// 藏住 420 m 外不畫的建築（10-city.js 的 distCull）；淡出的終點不比原本遠，70-render.js 的 fogCull 與 20-props.js 遠景樹的剔除照舊成立
  	const f = smoothstep( .5, 1., x.div( mix( 4.6, 2.15, uDay ) ) ).toVar();
  	const dir = d.div( max( dist, 1e-3 ) ).toVar();
  	const fc = mix( uFogCol, uFogHi, smoothstep( -0.05, .45, dir.y ) ).mul( add( 1., uFlash.mul( 1.5 ) ) ).toVar();
  	const sd = max( dot( dir, uSun ), 0. ).toVar(), ph = sd.mul( sd ).mul( sd ).mul( .25 ).add( pow( sd, 24. ).mul( .9 ) ).toVar();
  	fc.addAssign( uSunCol.mul( ph ).mul( uGI.w ) );

  	If( uGI.z.greaterThan( 0. ), () => {

  		const ya = max( uCam.y, 0. ).toVar(), yb = max( p.y, 0. ).toVar(), dh = yb.sub( ya ).toVar();
  		const Dm = select( abs( dh ).greaterThan( .3 ), mul( 7., exp( ya.negate().div( 7. ) ).sub( exp( yb.negate().div( 7. ) ) ) ).div( dh ), exp( yb.negate().div( 7. ) ) ).toVar();
  		const fm = sub( 1., exp( dist.negate().mul( uGI.z ).mul( Dm ) ) ).toVar();
  		c.assign( mix( c, uFogCol.mul( 1.08 ).add( uSunCol.mul( ph ).mul( .6 ) ), fm ) );

  	} );

  	return mix( c, fc, clamp( f, 0., 1. ) );

  }, { c: 'vec3', p: 'vec3', return: 'vec3' } );

  const farK =  Fn( ( [ k ] ) => {

  	return mix( k, 1., smoothstep( 40., 180., uCam.y ) );

  }, { k: 'float', return: 'float' } );

  return { h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, envMapS, applyFog, farK };
},
};
