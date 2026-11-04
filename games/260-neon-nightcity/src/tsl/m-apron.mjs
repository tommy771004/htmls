// 材質的 TSL（原本由已刪除的 tools/gen-tsl.mjs 從 GLSL 轉出，現在是著色器的原始碼，直接改這裡）
// 材質 "apron"（21-air.js 的機坪）：從 quay 改來。5 m 混凝土版、版縫、色差與污漬；標線與輪胎痕來自 tApr（機坪局部座標的貼圖，uApr = 原點 xz、1/寬、1/高）；
// 雨天照 quay 的積水與倒影，加上雨滴的漣漪。FAR：從城裡隔著海看得到（霧只算一部分距離，70-render.js 不剔）
export default {
"{\"FAR\":\"*\"}": {
  h: "1p9zdddcem", fog: true, lib: "[[\"FAR\",\"*\"]]NL_T,NOCC_T,SH_N_T,VOL_N_T,FAR", libV: false, libF: true,
  uniforms: [{"name":"uReflMat","type":"mat4","src":"uReflMat"},{"name":"tRefl","type":"sampler2D","src":"tRefl"},{"name":"uReflOn","type":"float","src":"uReflOn"},{"name":"uWetDbg","type":"float","src":"uWetDbg"},{"name":"tApr","type":"sampler2D","src":"tApr"},{"name":"uApr","type":"vec4","src":"uApr"},{"name":"tAprL","type":"sampler2D","src":"tAprL"},{"name":"uAprG","type":"vec4","src":"uAprG"},{"name":"uTime","type":"float","src":"uTime"},{"name":"uLampOn","type":"float","src":"uLampOn"},{"name":"uFlash","type":"float","src":"uFlash"},{"name":"uClipY","type":"float","src":"uClipY"},{"name":"uWet","type":"float","src":"uWet"},{"name":"uFogDen","type":"float","src":"uFogDen"},{"name":"uBeat","type":"float","src":"uBeat"},{"name":"uRain","type":"float","src":"uRain"},{"name":"uLit","type":"float","src":"uLit"},{"name":"uLamp","type":"float","src":"uLamp"},{"name":"uCullR","type":"float","src":"uCullR"},{"name":"uCam","type":"vec3","src":"uCam"},{"name":"uFogCol","type":"vec3","src":"uFogCol"},{"name":"uFogHi","type":"vec3","src":"uFogHi"},{"name":"uAmbTop","type":"vec3","src":"uAmbTop"},{"name":"uAmbBot","type":"vec3","src":"uAmbBot"},{"name":"uFocus","type":"vec4","src":"uFocus"},{"name":"uLP","type":"vec4","size":"NL_T","src":"uLP"},{"name":"uLC","type":"vec4","size":"NL_T","src":"uLC"},{"name":"uLD","type":"vec4","size":"NL_T","src":"uLD"},{"name":"uCity","type":"vec4","src":"uCity"},{"name":"uGrid","type":"vec2","src":"uGrid"},{"name":"uLampT","type":"sampler2D","src":"uLampT"},{"name":"uLampG","type":"vec4","src":"uLampG"},{"name":"uZone","type":"vec4","src":"uZone"},{"name":"uDay","type":"float","src":"uDay"},{"name":"uCloud","type":"float","src":"uCloud"},{"name":"uSun","type":"vec3","src":"uSun"},{"name":"uSunCol","type":"vec3","src":"uSunCol"},{"name":"uSkyTop","type":"vec3","src":"uSkyTop"},{"name":"uSkyHor","type":"vec3","src":"uSkyHor"},{"name":"uMoon","type":"vec3","src":"uMoon"},{"name":"uHMap","type":"sampler2D","src":"uHMap"},{"name":"uCityM","type":"sampler2D","src":"uCityM"},{"name":"uTMap","type":"sampler2D","src":"uTMap"},{"name":"uFMap","type":"sampler2D","src":"uFMap"},{"name":"uHM","type":"vec4","src":"uHM"},{"name":"uAHMap","type":"sampler2D","src":"uAHMap"},{"name":"uAHM","type":"vec4","src":"uAHM"},{"name":"uAirA","type":"vec4","src":"uAirA"},{"name":"uAirB","type":"vec4","src":"uAirB"},{"name":"uTM","type":"vec4","src":"uTM"},{"name":"uFM","type":"vec4","src":"uFM"},{"name":"uGI","type":"vec4","src":"uGI"},{"name":"uOccA","type":"vec4","size":"NOCC_T","src":"uOccA"},{"name":"uOccB","type":"vec4","size":"NOCC_T","src":"uOccB"}],
  varyings: [{"name":"vW","type":"vec3","src":"vW"},{"name":"vN","type":"vec3","src":"vN"},{"name":"vRP","type":"vec4","src":"vRP"},{"name":"vL","type":"vec2","src":"vL"},{"name":"vAx","type":"vec2","src":"vAx"}],
  attributes: [{"name":"aL","type":"vec4","src":"aL"}],
  vertex: (TSL, E) => {
    const { vec4, mat3, normalize, Fn } = TSL;
    const { uReflMat, tRefl, uReflOn, uWetDbg, tApr, uApr, tAprL, uAprG, vW, vN, vRP, vL, vAx, aL, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR } = E;




    const main_ =  Fn( () => {

    	const glPos_ = vec4( 0.0 ).toVar();
    	const w = modelMatrix.mul( vec4( position, 1. ) ).toVar();
    	vW.assign( w.xyz );
    	vN.assign( normalize( mat3( modelMatrix ).mul( normal ) ) );
    	vL.assign( aL.xy );
    	vAx.assign( normalize( modelMatrix.mul( vec4( aL.z, 0., aL.w, 0. ) ).xz ) );
    	vRP.assign( uReflMat.mul( w ) );
    	glPos_.assign( projectionMatrix.mul( viewMatrix ).mul( w ) );

    	return glPos_;

    } );

    return main_;
  },
  fragment: (TSL, E) => {
    const { vec3, Fn, vec2, float, floor, fract, length, pow, exp, sub, step, max, Loop, smoothstep, If, bool, normalize, mix, mul, dot, add, property, reflect, clamp, vec4, min, abs, int, ivec2, Break, atan, cos, sin, fwidth, select } = TSL;
    const { uReflMat, tRefl, uReflOn, uWetDbg, tApr, uApr, tAprL, uAprG, vW, vN, vRP, vL, vAx, aL, position, normal, uv, pGeom_, nGeom_, modelMatrix, viewMatrix, projectionMatrix, modelViewMatrix, normalMatrix, cameraPosition, fragCoord_, frontFacing_, color, texA_, texLA_, NL_T, NOCC_T, SH_N_T, VOL_N_T, FAR, uTime, uLampOn, uFlash, uClipY, uWet, uFogDen, uBeat, uRain, uLit, uLamp, uCullR, uCam, uFogCol, uFogHi, uAmbTop, uAmbBot, uFocus, uLP, uLC, uLD, uCity, uGrid, uLampT, uLampG, uZone, uDay, uCloud, uSun, uSunCol, uSkyTop, uSkyHor, uMoon, uHMap, uCityM, uTMap, uFMap, uHM, uAirA, uAirB, uTM, uFM, uGI, uOccA, uOccB, h11, h21, hw, n2, fbm, SODIUM, LEDW, lampK, NOLIGHT, lampGrid, pointLights, leafVis, forestVis, sunVis, occlude, skyVis, gSun, gAmb, gOccS, gSky, shade, envMap, applyFog, farK } = E;




    const nW =  Fn( ( [ n ] ) => {

    	return vec3( n.x.mul( vAx.x ).sub( n.z.mul( vAx.y ) ), n.y, n.x.mul( vAx.y ).add( n.z.mul( vAx.x ) ) );

    } );

    const ripple =  Fn( ( [ p, t ] ) => {

    	const acc = vec2( 0 ).toVar();

    	Loop( { start: 0, end: 2, name: 'k' }, ( { k } ) => {

    		const q = p.mul( 1.7 ).add( float( k ).mul( vec2( .37, .71 ) ) ).toVar();
    		const ci = floor( q ).toVar(), cf = fract( q ).sub( .5 ).toVar();
    		const hs = h21( ci.add( float( k ).mul( 13. ) ) ).toVar();
    		const off = vec2( h21( ci.add( 3.1 ) ), h21( ci.add( 7.7 ) ) ).sub( .5 ).mul( .5 ).toVar();
    		const tt = fract( t.mul( 1.2 ).add( hs ) ).toVar();
    		const d = cf.sub( off ).toVar();
    		const r = length( d ).toVar();
    		const ring = exp( pow( r.sub( tt.mul( .42 ) ).mul( 28. ), 2. ).negate() ).mul( sub( 1., tt ) ).mul( step( hs, uRain ) ).toVar();
    		acc.addAssign( d.div( max( r, 1e-3 ) ).mul( ring ) );

    	} );

    	return acc;

    }, { p: 'vec2', t: 'float', return: 'vec2' } );

    const reflSample =  Fn( ( [ ruv, blur ] ) => {

    	const c = tRefl.sample( ruv ).rgb.mul( .3 ).toVar();
    	c.addAssign( tRefl.sample( ruv.add( vec2( blur.mul( .15 ), blur ) ) ).rgb.mul( .2 ) );
    	c.addAssign( tRefl.sample( ruv.sub( vec2( blur.mul( .15 ), blur ) ) ).rgb.mul( .2 ) );
    	c.addAssign( tRefl.sample( ruv.add( vec2( 0., blur.mul( 2.2 ) ) ) ).rgb.mul( .15 ) );
    	c.addAssign( tRefl.sample( ruv.sub( vec2( 0., blur.mul( 2.2 ) ) ) ).rgb.mul( .15 ) );

    	return c;

    }, { ruv: 'vec2', blur: 'float', return: 'vec3' } );

    const coverAt =  Fn( ( [ p, o ] ) => {

    	return smoothstep( 1.3, 2.4, uHMap.sample( p.xz.add( o ).sub( uHM.xy ).mul( uHM.z ) ).level( 0. ).r.sub( p.y ) );

    }, { p: 'vec3', o: 'vec2', return: 'float' } );

    const rainCover =  Fn( ( [ p ] ) => {

    	const s = coverAt( p, vec2( 0. ) ).mul( .4 ).add( coverAt( p, vec2( .7, 0. ) ).add( coverAt( p, vec2( -0.7, 0. ) ) ).add( coverAt( p, vec2( 0., .7 ) ) ).add( coverAt( p, vec2( 0., -0.7 ) ) ).mul( .15 ) ).toVar();
    	const tr = uTMap.sample( p.xz.sub( uTM.xy ).mul( uTM.z ) ).level( 0. ).rg.toVar();

    	If( tr.x.greaterThan( 0. ).and( tr.y.greaterThan( p.y.add( 1. ) ) ), () => {

    		s.assign( max( s, .35 ) );

    	} );

    	return s;

    }, { p: 'vec3', return: 'float' } );

    const wetSurfaceR =  Fn( ( [ base_immutable, n, wet_immutable, pud_immutable, paint, rough0 ] ) => {

    	const pud = pud_immutable.toVar();
    	const wet = wet_immutable.toVar();
    	const base = base_immutable.toVar();
    	const done_ = bool( false ).toVar();
    	const ret_ = vec3( 0 ).toVar();
    	const v = normalize( uCam.sub( vW ) ).toVar();
    	const dry = rainCover( vW ).toVar();
    	pud.mulAssign( smoothstep( .05, .6, uWet ).mul( sub( 1., dry ) ) );
    	wet.mulAssign( uWet.mul( sub( 1., dry ) ) );

    	If( uWetDbg.greaterThan( .5 ), () => {

    		return vec3( dry.add( sub( 1., wet ).mul( sub( 1., pud ) ) ), wet.mul( sub( 1., pud ) ), pud ).mul( 2. );

    	} );

    	If( done_.not(), () => {

    		const rim = smoothstep( .05, .35, pud ).mul( sub( 1., smoothstep( .45, .9, pud ) ) ).toVar();
    		base.mulAssign( mix( 1., .7, wet ).mul( mix( 1., .8, pud ) ).mul( sub( 1., mul( .3, rim ) ) ) );
    		const rough = mix( mix( rough0, .3, wet ), .035, pud ).toVar();
    		const c = shade( vW, n, v, base, rough, 0. ).toVar();
    		const F = add( .05, mul( .95, pow( sub( 1., max( dot( n, v ), 0. ) ), 5. ) ) ).toVar();
    		const refl = mix( .3, 1., F ).mul( mix( wet.mul( .55 ), .9, pud ) ).mul( sub( 1., paint.mul( .4 ) ) ).toVar();
    		const rc = property( 'vec3' );

    		If( uReflOn.greaterThan( .5 ), () => {

    			const ruv = vRP.xy.div( vRP.w ).add( n.xz.mul( vec2( .05, .09 ) ).mul( add( 1., mul( 1.5, sub( 1., pud ) ) ) ) ).toVar();
    			const dist = length( vW.sub( uCam ) ).toVar();
    			rc.assign( reflSample( ruv, mix( .024, .003, pud ).div( add( 1., dist.mul( .01 ) ) ) ) );

    		} ).Else( () => {

    			rc.assign( envMap( reflect( v.negate(), n ) ) );

    		} );

    		ret_.assign( mix( c, rc, clamp( refl, 0., 1. ).mul( uWet ) ) );
    		done_.assign( true );

    	} );

    	return ret_;

    } );

    const wetSurface =  Fn( ( [ base, n, wet, pud, paint ] ) => {

    	return wetSurfaceR( base, n, wet, pud, paint, .72 );

    } );

    // 向量標線（21-air.js 的 airApronVec）：照這格的圖元算距離，覆蓋率用螢幕上的像素寬 aa 反鋸齒（比像素細的線照比例變淡，不閃）。回傳 (覆蓋, 色)
    const marks =  Fn( ( [ p, aa ] ) => {

    	const best = vec2( 0. ).toVar();
    	const c = ivec2( floor( p.sub( uAprG.xy ).div( 4. ) ) ).toVar();

    	If( c.x.greaterThanEqual( 0 ).and( c.y.greaterThanEqual( 0 ) ).and( c.x.lessThan( int( uAprG.z ) ) ).and( c.y.lessThan( int( uAprG.w ) ) ), () => {

    		Loop( { start: 0, end: 12, name: 'k' }, ( { k } ) => {

    			const tx = c.x.mul( 12 ).add( k ).toVar();
    			const A = tAprL.sample( ivec2( tx, c.y.mul( 3 ) ) ).setSampler( false ).toVar();
    			const B = tAprL.sample( ivec2( tx, c.y.mul( 3 ).add( 1 ) ) ).setSampler( false ).toVar();
    			const C = tAprL.sample( ivec2( tx, c.y.mul( 3 ).add( 2 ) ) ).setSampler( false ).toVar();

    			If( C.x.lessThan( .5 ), () => {

    				Break();

    			} );

    			const d = float( 0. ).toVar(), along = float( 0. ).toVar(), inner = float( 1. ).toVar();

    			If( C.x.lessThan( 1.5 ), () => {

    				// 線段（butt 端）：d 是到中線的垂直距離，inner 是兩端的截斷
    				const ab = A.zw.sub( A.xy ).toVar(), ap = p.sub( A.xy ).toVar();
    				const len = max( length( ab ), 1e-4 ).toVar();
    				const dir = ab.div( len ).toVar();
    				along.assign( dot( ap, dir ) );
    				d.assign( abs( ap.x.mul( dir.y ).sub( ap.y.mul( dir.x ) ) ) );
    				inner.assign( clamp( min( along, len.sub( along ) ).div( aa ).add( .5 ), 0., 1. ) );

    			} ).ElseIf( C.x.lessThan( 2.5 ), () => {

    				// 圓弧：角度在範圍內是到圓周的距離，範圍外是到端點的距離
    				const v = p.sub( A.xy ).toVar();
    				const a = atan( v.y, v.x ).toVar();

    				If( a.greaterThanEqual( C.y ).and( a.lessThanEqual( C.z ) ), () => {

    					d.assign( abs( length( v ).sub( A.z ) ) );

    				} ).Else( () => {

    					d.assign( min( length( v.sub( vec2( cos( C.y ), sin( C.y ) ).mul( A.z ) ) ), length( v.sub( vec2( cos( C.z ), sin( C.z ) ).mul( A.z ) ) ) ) );

    				} );

    			} ).Else( () => {

    				// 矩形：inner 是在框內；B.z > 0 時是 45° 斜紋（B.z 是條紋的垂直間距），否則實心
    				const o = abs( p.sub( A.xy.add( A.zw ).mul( .5 ) ) ).sub( A.zw.sub( A.xy ).mul( .5 ) ).toVar();
    				const sd = length( max( o, 0. ) ).add( min( max( o.x, o.y ), 0. ) ).toVar();
    				inner.assign( clamp( sd.negate().div( aa ).add( .5 ), 0., 1. ) );

    				If( B.z.greaterThan( 0. ), () => {

    					d.assign( abs( fract( p.x.sub( p.y ).mul( .70711 ).div( B.z ).add( .5 ) ).sub( .5 ) ).mul( B.z ) );

    				} );

    			} );

    			const we = max( B.x, aa.mul( .5 ) ).toVar();
    			const cov = clamp( we.sub( d ).div( aa ).add( .5 ), 0., 1. ).mul( B.x.div( we ) ).mul( inner ).toVar();

    			If( B.z.greaterThan( 0. ).and( C.x.lessThan( 1.5 ) ), () => {

    				// 虛線：沿線的位置在週期裡的哪一段；遠到一個週期不到幾個像素時改成平均（實的比例）
    				const on = B.z.mul( B.w ).toVar();
    				const u = fract( along.div( B.z ) ).mul( B.z ).toVar();
    				const sdl = select( u.lessThan( on ), min( u, on.sub( u ) ), min( u.sub( on ), B.z.sub( u ) ).negate() ).toVar();
    				cov.mulAssign( mix( clamp( sdl.div( aa ).add( .5 ), 0., 1. ), B.w, smoothstep( B.z.mul( .25 ), B.z, aa ) ) );

    			} );

    			If( cov.greaterThan( best.x ), () => {

    				best.assign( vec2( cov, B.y ) );

    			} );

    		} );

    	} );

    	return best;

    }, { p: 'vec2', aa: 'float', return: 'vec2' } );

    const hueCol =  Fn( ( [ g ] ) => {

    	const g3 = g.mul( 3. ).toVar();
    	return mix( mix( mix( vec3( .66, .42, .03 ), vec3( .74, .74, .7 ), clamp( g3, 0., 1. ) ), vec3( .52, .03, .02 ), clamp( g3.sub( 1. ), 0., 1. ) ), vec3( .022, .021, .02 ), clamp( g3.sub( 2. ), 0., 1. ) );

    }, { g: 'float', return: 'vec3' } );

    const main_ =  Fn( () => {

    	const fragOut_ = vec4( 0.0 ).toVar();
    	const p = vL.toVar();
    	const aa = max( length( fwidth( p ) ).mul( .8 ), .002 ).toVar();
    	// 5 m 的混凝土版：版縫（暗的填縫膠）、每塊的色差、大片的污漬與細顆粒
    	const tile = p.div( 5. ).toVar();
    	const tf = fract( tile ).toVar();
    	const ti = floor( tile ).toVar();
    	const joint = smoothstep( .0, .006, tf.x ).mul( smoothstep( 1., .994, tf.x ) ).mul( smoothstep( .0, .006, tf.y ) ).mul( smoothstep( 1., .994, tf.y ) ).toVar();
    	const alb = vec3( .21, .205, .192 ).mul( add( .86, mul( .24, h21( ti ) ) ) ).mul( add( .78, mul( .36, fbm( p.mul( .3 ) ) ) ) ).mul( add( .9, mul( .18, fbm( p.mul( 2.7 ).add( 5. ) ) ) ) ).toVar();
    	alb.mulAssign( mix( .42, 1., joint ) );
    	// 標線與磨耗：向量的線（marks）在下、貼圖的字在上（R 字、G 色：0 黃、1/3 白、2/3 紅、1 黑；B 輪胎痕與油污）
    	const uvA = p.sub( uApr.xy ).mul( uApr.zw ).toVar();
    	const inA = step( 0., uvA.x ).mul( step( uvA.x, 1. ) ).mul( step( 0., uvA.y ) ).mul( step( uvA.y, 1. ) ).toVar();
    	const mk = tApr.sample( clamp( uvA, 0., 1. ) ).mul( inA ).toVar();
    	const ln = marks( p, aa ).toVar();
    	const wear = smoothstep( .2, .8, fbm( p.mul( 1.3 ).add( 9. ) ) ).mul( .38 ).add( .62 ).mul( mix( .7, 1., joint ) ).toVar();
    	const paint = max( ln.x, mk.r ).mul( wear ).toVar();
    	alb.assign( mix( alb, hueCol( ln.y ), ln.x.mul( wear ) ) );
    	alb.assign( mix( alb, hueCol( mk.g ), mk.r.mul( wear ) ) );
    	alb.mulAssign( sub( 1., mk.b.mul( mix( .45, .7, fbm( p.mul( .9 ) ) ) ) ) );
    	// 積水：低窪處與版縫；下雨時積水上有漣漪
    	const pud = clamp( smoothstep( .56, .7, fbm( p.mul( .055 ).add( 4. ) ) ).add( sub( 1., joint ).mul( .4 ) ), 0., 1. ).toVar();
    	const rp = ripple( p.mul( .9 ), uTime ).mul( pud ).mul( uRain ).toVar();
    	const n = normalize( vec3( rp.x.mul( -0.35 ), 1., rp.y.mul( -0.35 ) ) ).toVar();
    	const c = wetSurface( alb, n, .8, pud, paint ).toVar();
    	fragOut_.assign( vec4( applyFog( c, uCam.add( vW.sub( uCam ).mul( farK( FAR ) ) ) ), 1. ) );

    	return fragOut_;

    } );

    return main_;
  },
},
};
