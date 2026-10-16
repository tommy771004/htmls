// Rain particle system, steam vents, AI traffic cars, flying hover-spinners,
// sidewalk umbrella pedestrians, and nightclub LED/laser animators.
import * as THREE from 'three';
import { ROADS, CITY_HALF } from './city.js';

export function buildAtmosphere(scene, assets, city) {
  const root = new THREE.Group();
  root.name = 'AtmosphereRoot';
  scene.add(root);

  // --- 1. Rain Streak System (Follows active camera / player) ---
  const RAIN_COUNT = 2200;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_COUNT * 6); // 2 vertices per raindrop streak
  const rainVel = new Float32Array(RAIN_COUNT);
  const rainBox = 48;
  const rainHeight = 32;

  for (let i = 0; i < RAIN_COUNT; i++) {
    const rx = (Math.random() - 0.5) * rainBox * 2;
    const ry = Math.random() * rainHeight;
    const rz = (Math.random() - 0.5) * rainBox * 2;
    const speed = 26 + Math.random() * 14;
    rainVel[i] = speed;
    const idx = i * 6;
    rainPos[idx] = rx;
    rainPos[idx + 1] = ry;
    rainPos[idx + 2] = rz;
    rainPos[idx + 3] = rx - 0.14;
    rainPos[idx + 4] = ry - 1.35;
    rainPos[idx + 5] = rz - 0.08;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));

  const rainMat = new THREE.LineBasicMaterial({
    color: 0x99d6ff,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  rainLines.frustumCulled = false;
  root.add(rainLines);

  // --- 2. Street Steam Plumes (Rising from steam vents) ---
  const steamGroup = new THREE.Group();
  root.add(steamGroup);
  const steamPuffs = [];
  const puffGeo = new THREE.PlaneGeometry(1.8, 1.8);

  // Create radial soft smoke canvas texture
  const sc = document.createElement('canvas');
  sc.width = 64;
  sc.height = 64;
  const sctx = sc.getContext('2d');
  const grad = sctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(180, 220, 255, 0.36)');
  grad.addColorStop(0.5, 'rgba(120, 175, 230, 0.16)');
  grad.addColorStop(1, 'rgba(40, 70, 110, 0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 64, 64);
  const steamTex = new THREE.CanvasTexture(sc);

  const puffMat = new THREE.MeshBasicMaterial({
    map: steamTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const ventSpots = [
    [-12, -21], [14, -39], [-48, -21], [48, -21],
    [-21, 14], [21, -14], [-72, -21], [72, -21],
    [-21, -72], [21, 44], [0, 21], [-39, 21],
  ];
  for (let i = 0; i < ventSpots.length; i++) {
    const [vx, vz] = ventSpots[i];
    for (let k = 0; k < 2; k++) {
      const m = new THREE.Mesh(puffGeo, puffMat);
      m.position.set(vx, 0.5 + k * 1.4, vz);
      steamGroup.add(m);
      steamPuffs.push({
        mesh: m,
        baseX: vx,
        baseZ: vz,
        phase: Math.random() * Math.PI * 2 + k * 3.1,
      });
    }
  }

  // --- 3. AI Street Traffic Cars ---
  const trafficCars = [];
  const laneOffsets = [-3.4, 3.4]; // Right-hand traffic lanes along ROADS
  let carSeed = 1;
  for (let rIdx = 0; rIdx < ROADS.length; rIdx++) {
    const roadCoord = ROADS[rIdx];
    // Horizontal road (along X, fixed Z)
    for (let dir of [-1, 1]) {
      const count = rIdx === 2 || rIdx === 3 ? 3 : 2;
      for (let c = 0; c < count; c++) {
        const carMesh = assets.cloneModel('vehicles', 'traffic_car');
        const laneZ = roadCoord + (dir > 0 ? 3.5 : -3.5);
        const startX = -CITY_HALF + ((c * 110 + rIdx * 37) % (CITY_HALF * 2));
        carMesh.position.set(startX, 0.02, laneZ);
        carMesh.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
        root.add(carMesh);
        trafficCars.push({
          mesh: carMesh,
          axis: 'x',
          dir,
          speed: 13 + ((carSeed++ * 7) % 9),
          lane: laneZ,
        });
      }
    }
    // Vertical road (along Z, fixed X)
    if (rIdx >= 1 && rIdx <= 4) {
      for (let dir of [-1, 1]) {
        const carMesh = assets.cloneModel('vehicles', 'traffic_car');
        const laneX = roadCoord + (dir > 0 ? -3.5 : 3.5);
        const startZ = -CITY_HALF + ((rIdx * 83 + (dir > 0 ? 40 : 130)) % (CITY_HALF * 2));
        carMesh.position.set(laneX, 0.02, startZ);
        carMesh.rotation.y = dir > 0 ? Math.PI : 0;
        root.add(carMesh);
        trafficCars.push({
          mesh: carMesh,
          axis: 'z',
          dir,
          speed: 12 + ((carSeed++ * 5) % 8),
          lane: laneX,
        });
      }
    }
  }

  // --- 4. Flying Hover-Spinners in Sky Lanes ---
  const spinners = [];
  for (let i = 0; i < 12; i++) {
    const sp = assets.cloneModel('vehicles', 'hover_spinner');
    const altitude = 24 + (i % 4) * 11;
    const radius = 55 + (i % 3) * 38;
    const speed = (i % 2 === 0 ? 1 : -1) * (0.18 + (i % 5) * 0.04);
    const angle = (i / 12) * Math.PI * 2;
    sp.position.set(Math.cos(angle) * radius, altitude, Math.sin(angle) * radius);
    root.add(sp);
    spinners.push({
      mesh: sp,
      altitude,
      radius,
      speed,
      angle,
    });
  }

  // --- 5. Sidewalk Pedestrians (Animated SkinnedMesh with Neon Umbrellas) ---
  const walkers = [];
  const umbrellaGeo = new THREE.ConeGeometry(0.68, 0.32, 8, 1, true);
  const umbrellaColors = [0x00f0ff, 0xff1e8a, 0xffe600, 0x9b4dff];
  const umbrellaMats = umbrellaColors.map(
    (col) =>
      new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
      })
  );

  const sidewalkPaths = [
    { axis: 'x', fixed: -21.2, min: -110, max: 110 },
    { axis: 'x', fixed: -38.8, min: -110, max: 110 },
    { axis: 'x', fixed: 21.2, min: -100, max: 100 },
    { axis: 'z', fixed: -21.2, min: -100, max: 100 },
    { axis: 'z', fixed: 21.2, min: -100, max: 100 },
    { axis: 'z', fixed: -38.8, min: -90, max: 90 },
  ];

  for (let i = 0; i < 18; i++) {
    const path = sidewalkPaths[i % sidewalkPaths.length];
    const w = assets.spawnCharacter({
      paletteIndex: i + 3,
      clip: 'walk',
      timeScale: 0.92 + (i % 4) * 0.08,
    });
    // Attach translucent neon umbrella above head
    const umb = new THREE.Mesh(umbrellaGeo, umbrellaMats[i % umbrellaMats.length]);
    umb.position.set(0, 1.96, 0.08);
    w.root.add(umb);

    const dir = i % 2 === 0 ? 1 : -1;
    const posAlong = path.min + ((i * 29) % (path.max - path.min));
    if (path.axis === 'x') {
      w.root.position.set(posAlong, 0, path.fixed);
      w.root.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      w.root.position.set(path.fixed, 0, posAlong);
      w.root.rotation.y = dir > 0 ? 0 : Math.PI;
    }
    root.add(w.root);
    walkers.push({
      char: w,
      path,
      dir,
      pos: posAlong,
      speed: 1.55 + (i % 3) * 0.25,
    });
  }

  function update(dt, elapsed, focusPos, camera) {
    // 1. Update rain streaks centered around focusPos (keep outside indoor roofs when inside a venue)
    const fx = focusPos.x;
    const fz = focusPos.z;
    const insideV = city.getVenueAt ? city.getVenueAt(fx, fz) : null;
    if (insideV) {
      rainLines.position.set(insideV.doorX, 0, insideV.z0 - rainBox - 2);
    } else {
      rainLines.position.set(fx, 0, fz);
    }

    const posArr = rainGeo.attributes.position.array;
    for (let i = 0; i < RAIN_COUNT; i++) {
      const idx = i * 6;
      let y = posArr[idx + 1] - rainVel[i] * dt;
      let x = posArr[idx] - 3.2 * dt;
      if (y < 0) {
        y += rainHeight;
        x = (Math.random() - 0.5) * rainBox * 2;
      }
      posArr[idx] = x;
      posArr[idx + 1] = y;
      posArr[idx + 3] = x - 0.14;
      posArr[idx + 4] = y - 1.35;
    }
    rainGeo.attributes.position.needsUpdate = true;

    // 2. Steam puffs rising & facing camera
    for (const p of steamPuffs) {
      const t = (elapsed * 0.45 + p.phase) % 1;
      p.mesh.position.y = 0.35 + t * 3.2;
      p.mesh.position.x = p.baseX + Math.sin(elapsed * 1.5 + p.phase) * 0.35;
      const scVal = 0.65 + t * 1.4;
      p.mesh.scale.set(scVal, scVal, scVal);
      if (camera) {
        p.mesh.quaternion.copy(camera.quaternion);
      }
    }

    // 3. AI street traffic cars
    for (const tc of trafficCars) {
      if (tc.axis === 'x') {
        tc.mesh.position.x += tc.dir * tc.speed * dt;
        if (tc.mesh.position.x > CITY_HALF) tc.mesh.position.x = -CITY_HALF;
        if (tc.mesh.position.x < -CITY_HALF) tc.mesh.position.x = CITY_HALF;
      } else {
        tc.mesh.position.z += tc.dir * tc.speed * dt;
        if (tc.mesh.position.z > CITY_HALF) tc.mesh.position.z = -CITY_HALF;
        if (tc.mesh.position.z < -CITY_HALF) tc.mesh.position.z = CITY_HALF;
      }
    }

    // 4. Flying hover spinners
    for (const sp of spinners) {
      sp.angle += sp.speed * dt;
      const nx = Math.cos(sp.angle) * sp.radius;
      const nz = Math.sin(sp.angle) * sp.radius;
      const dx = -Math.sin(sp.angle) * sp.speed;
      const dz = Math.cos(sp.angle) * sp.speed;
      sp.mesh.position.set(nx, sp.altitude + Math.sin(elapsed * 2 + sp.angle) * 0.6, nz);
      sp.mesh.rotation.y = Math.atan2(dx, dz) + Math.PI;
    }

    // 5. Sidewalk pedestrians
    for (const w of walkers) {
      w.pos += w.dir * w.speed * dt;
      if (w.pos > w.path.max) {
        w.pos = w.path.max;
        w.dir = -1;
      } else if (w.pos < w.path.min) {
        w.pos = w.path.min;
        w.dir = 1;
      }
      if (w.path.axis === 'x') {
        w.char.root.position.x = w.pos;
        w.char.root.rotation.y = w.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        w.char.root.position.z = w.pos;
        w.char.root.rotation.y = w.dir > 0 ? 0 : Math.PI;
      }
      // Only update skeletal mixer when within 85m of focus for steady 60fps
      const distSq =
        (w.char.root.position.x - fx) * (w.char.root.position.x - fx) +
        (w.char.root.position.z - fz) * (w.char.root.position.z - fz);
      if (distSq < 7200) {
        w.char.mixer.update(dt);
      }
    }

    // 6. Venue NPC skeletal mixers & PULSE nightclub LED floor + sweeping lasers + holo spinners
    if (city.npcMixers) {
      for (const mixer of city.npcMixers) {
        const rootObj = mixer.getRoot();
        if (rootObj && rootObj.position) {
          // Compute approximate world distance
          const distSq = (rootObj.position.x - fx) * (rootObj.position.x - fx) + (rootObj.position.z - fz) * (rootObj.position.z - fz);
          if (distSq < 6400) {
            mixer.update(dt);
          }
        } else {
          mixer.update(dt);
        }
      }
    }

    if (city.holoSpinners) {
      for (let i = 0; i < city.holoSpinners.length; i++) {
        city.holoSpinners[i].rotation.y += (i % 2 === 0 ? 0.55 : -0.45) * dt;
      }
    }

    // Animate PULSE nightclub dancefloor & lasers when near center block
    if (fx * fx + fz * fz < 4500) {
      const beat = elapsed * (124 / 60) * Math.PI * 2;
      const clubCols = [0x00f0ff, 0xff1e8a, 0xffe600, 0x9b4dff, 0x00ff9d];
      if (city.danceTiles) {
        for (const tile of city.danceTiles) {
          const wave = Math.sin(beat * 0.5 + tile.r * 0.7 + tile.c * 0.7);
          const cIdx = Math.abs(Math.floor(wave * 2.5 + tile.r + tile.c)) % clubCols.length;
          tile.mesh.material.color.setHex(clubCols[cIdx]);
        }
      }
      if (city.clubLasers) {
        for (let i = 0; i < city.clubLasers.length; i++) {
          const item = city.clubLasers[i];
          const beam = item.mesh || item;
          const ph = item.phase || i * 0.9;
          beam.rotation.z = Math.sin(elapsed * 2.4 + ph) * 0.52;
          beam.rotation.x = 0.25 + Math.cos(elapsed * 1.8 + ph * 1.3) * 0.35;
        }
      }
    }

    // Update wet road shader time uniform
    if (city.shaderUniforms && city.shaderUniforms.uTime) {
      city.shaderUniforms.uTime.value = elapsed;
    }
  }

  return {
    root,
    rainLines,
    trafficCars,
    spinners,
    walkers,
    update,
  };
}
