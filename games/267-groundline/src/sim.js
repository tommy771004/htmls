// Groundline（267）機場停機坪即時調度模擬核心（純 JS，不依賴 DOM 或 Three.js）

export const STEPS = [
  {
    key: 'arrive',
    label: '到站',
    en: 'ARRIVAL',
    mins: 4,
    delayProb: 0.08,
    vehType: null,
    desc: '滑行進場停靠停止線、接上空橋',
    delayReasons: ['滑行道交叉等待放行', '空橋光學對接微調'],
  },
  {
    key: 'deboard',
    label: '下客',
    en: 'DEBOARD',
    mins: 7,
    delayProb: 0.14,
    vehType: 'baggage',
    vehLabel: '行李拖車',
    desc: '旅客經空橋下機、卸載到站託運行李',
    delayReasons: ['超規行李箱卡住貨艙網', '轉機旅客隨身物品遺留尋回'],
  },
  {
    key: 'clean',
    label: '清潔',
    en: 'CLEANING',
    mins: 8,
    delayProb: 0.16,
    vehType: 'catering',
    vehLabel: '餐車／清潔',
    desc: '客艙清潔整備、升降餐車補充機上餐飲',
    delayReasons: ['客艙飲料翻灑深層清潔', '特殊餐點保溫櫃重新核對'],
  },
  {
    key: 'fuel',
    label: '加油',
    en: 'FUELING',
    mins: 8,
    delayProb: 0.18,
    vehType: 'fuel',
    vehLabel: '加油車',
    desc: '翼下油栓連接加油車、泵入航油',
    delayReasons: ['油栓管線壓力異常重測', '高空逆風臨時追加航油'],
  },
  {
    key: 'board',
    label: '登機',
    en: 'BOARDING',
    mins: 9,
    delayProb: 0.15,
    vehType: 'baggage',
    vehLabel: '行李拖車',
    desc: '出發旅客登機、裝載離場行李櫃',
    delayReasons: ['晚到轉機旅客最終廣播', '託運行李件數二次清點'],
  },
  {
    key: 'pushback',
    label: '推出',
    en: 'PUSHBACK',
    mins: 4,
    delayProb: 0.10,
    vehType: null,
    desc: '收回空橋、後推車推出至滑行道離場',
    delayReasons: ['滑行道尾流間隔管制等待', '後推拖桿插銷安全複檢'],
  },
];

export const GATES = [
  { id: 'G1', num: 1, x: -48, standZ: -6, rotundaX: -51.5, rotundaZ: -23.0, holdX: -54, holdZ: 17.5 },
  { id: 'G2', num: 2, x: -24, standZ: -6, rotundaX: -27.5, rotundaZ: -23.0, holdX: -30, holdZ: 17.5 },
  { id: 'G3', num: 3, x: 0, standZ: -6, rotundaX: -3.5, rotundaZ: -23.0, holdX: -6, holdZ: 17.5 },
  { id: 'G4', num: 4, x: 24, standZ: -6, rotundaX: 20.5, rotundaZ: -23.0, holdX: 18, holdZ: 17.5 },
  { id: 'G5', num: 5, x: 48, standZ: -6, rotundaX: 44.5, rotundaZ: -23.0, holdX: 42, holdZ: 17.5 },
];

export const AIRLINES = [
  { code: 'GL', name: 'Groundline 翠翼航空', color: '#2d8a8a', accent: '#e0634e', model: 'Aircraft_A320', acType: 'A320neo' },
  { code: 'SK', name: 'Skyline 蒼穹航空', color: '#2f65b0', accent: '#e8a838', model: 'Aircraft_B738', acType: 'B737-800' },
  { code: 'SL', name: 'Solstice 日冕航空', color: '#d95f46', accent: '#e8a838', model: 'Aircraft_A321', acType: 'A321neo' },
  { code: 'NW', name: 'Nordic 北風航空', color: '#589c78', accent: '#2d8a8a', model: 'Aircraft_E190', acType: 'A220-300' },
];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function formatClock(mins) {
  const m = ((Math.floor(mins) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function gateById(id) {
  return GATES.find((g) => g.id === id) || GATES[0];
}

export function serviceSpotForGate(gateId, vehType) {
  const g = gateById(gateId);
  if (vehType === 'fuel') {
    return { x: g.x + 5.8, z: g.standZ - 0.8, yaw: 0 };
  }
  if (vehType === 'baggage') {
    return { x: g.x + 3.4, z: g.standZ + 6.2, yaw: -0.22 };
  }
  if (vehType === 'catering') {
    return { x: g.x + 3.0, z: g.standZ - 6.8, yaw: 0.18 };
  }
  return { x: g.x - 3.4, z: g.standZ - 2.0, yaw: -0.15 };
}

export function buildRoadPath(x0, z0, tx, tz) {
  const roadZ = -18.2;
  const pts = [];
  if (Math.hypot(tx - x0, tz - z0) < 2.0) {
    pts.push({ x: tx, z: tz });
    return pts;
  }
  if (Math.abs(z0 - roadZ) > 1.2) {
    pts.push({ x: x0, z: roadZ });
  }
  if (Math.abs(tx - x0) > 1.2) {
    pts.push({ x: tx, z: roadZ });
  }
  pts.push({ x: tx, z: tz });
  return pts;
}

function makeFlightSpec(spec, index) {
  const airline = AIRLINES[index % AIRLINES.length];
  const stepPlans = STEPS.map((s) => ({
    key: s.key,
    label: s.label,
    plannedMins: s.mins,
    elapsedMins: 0,
    extraDelayMins: 0,
    progress: 0,
    status: 'pending', // 'pending' | 'active' | 'done'
    delayed: false,
    delayReason: '',
    delayChecked: false,
    assignedVehicleId: null,
    boosted: false,
  }));

  return {
    id: spec.callsign,
    callsign: spec.callsign,
    airlineCode: airline.code,
    airlineName: airline.name,
    color: airline.color,
    accent: airline.accent,
    modelKey: spec.modelKey || airline.model,
    acType: spec.acType || airline.acType,
    route: spec.route,
    gateId: spec.gateId,
    sta: spec.sta,
    std: spec.sta + 40,
    ata: null,
    atd: null,
    etd: spec.sta + 40,
    priority: spec.priority || 1, // 1: 普通, 2: 優先, 3: 緊急
    state: 'scheduled', // 'scheduled' | 'holding' | 'active' | 'departed'
    stepIndex: 0,
    steps: stepPlans,
    ownDelay: 0,
    gateHoldDelay: 0,
    cascadeDelay: 0,
    cascadeFrom: null,
    bagsTotal: spec.bags || 160,
    bagsHandled: 0,
    fuelNeeded: 100,
    pose: { x: 96, z: 50, yaw: -Math.PI / 2, jetbridgePct: 0, pushbackTug: false, visible: false },
  };
}

export function createWorld(seed = 26701) {
  const rand = mulberry32(seed);
  const startClock = 8 * 60 + 12; // 08:12

  // 建立 15 班橫跨 G1–G5 三波段的航班時刻表
  const rawSchedule = [
    // 第一波（目前在場作業中）
    { callsign: 'GL-101', gateId: 'G1', sta: 7 * 60 + 50, route: 'TPE → HND', bags: 176, modelKey: 'Aircraft_A320', acType: 'A320neo', initStep: 3, initProg: 0.45, initDelay: 6, initReason: '油栓管線壓力異常重測' },
    { callsign: 'SK-102', gateId: 'G2', sta: 7 * 60 + 56, route: 'TPE → ICN', bags: 168, modelKey: 'Aircraft_B738', acType: 'B737-800', initStep: 2, initProg: 0.62, initDelay: 0 },
    { callsign: 'SL-103', gateId: 'G3', sta: 7 * 60 + 42, route: 'TPE → SIN', bags: 194, modelKey: 'Aircraft_A321', acType: 'A321neo', initStep: 4, initProg: 0.72, initDelay: 2, initReason: '晚到轉機旅客最終廣播' },
    { callsign: 'NW-104', gateId: 'G4', sta: 8 * 60 + 4,  route: 'TPE → OKA', bags: 142, modelKey: 'Aircraft_E190', acType: 'A220-300', initStep: 1, initProg: 0.38, initDelay: 0 },
    { callsign: 'GL-105', gateId: 'G5', sta: 8 * 60 + 10, route: 'TPE → KIX', bags: 172, modelKey: 'Aircraft_A320', acType: 'A320neo', initStep: 0, initProg: 0.58, initDelay: 0 },

    // 第二波（後續連鎖航班：緊湊排班，前班只要延誤超過 2 分鐘即產生連鎖波及）
    { callsign: 'GL-201', gateId: 'G1', sta: 8 * 60 + 32, route: 'TPE → NRT', bags: 182, modelKey: 'Aircraft_A321', acType: 'A321neo' },
    { callsign: 'SK-202', gateId: 'G2', sta: 8 * 60 + 36, route: 'TPE → FUK', bags: 160, modelKey: 'Aircraft_B738', acType: 'B737-800' },
    { callsign: 'SL-203', gateId: 'G3', sta: 8 * 60 + 25, route: 'TPE → BKK', bags: 188, modelKey: 'Aircraft_A320', acType: 'A320neo' },
    { callsign: 'NW-204', gateId: 'G4', sta: 8 * 60 + 44, route: 'TPE → NGO', bags: 150, modelKey: 'Aircraft_E190', acType: 'A220-300' },
    { callsign: 'GL-205', gateId: 'G5', sta: 8 * 60 + 50, route: 'TPE → CTS', bags: 174, modelKey: 'Aircraft_B738', acType: 'B737-800' },

    // 第三波（尖峰續接航班）
    { callsign: 'SK-301', gateId: 'G1', sta: 9 * 60 + 14, route: 'TPE → HKG', bags: 178, modelKey: 'Aircraft_B738', acType: 'B737-800' },
    { callsign: 'SL-302', gateId: 'G2', sta: 9 * 60 + 18, route: 'TPE → SGN', bags: 184, modelKey: 'Aircraft_A321', acType: 'A321neo' },
    { callsign: 'GL-303', gateId: 'G3', sta: 9 * 60 + 8,  route: 'TPE → MNL', bags: 166, modelKey: 'Aircraft_A320', acType: 'A320neo' },
    { callsign: 'NW-304', gateId: 'G4', sta: 9 * 60 + 26, route: 'TPE → SDJ', bags: 146, modelKey: 'Aircraft_E190', acType: 'A220-300' },
    { callsign: 'SL-305', gateId: 'G5', sta: 9 * 60 + 32, route: 'TPE → KUL', bags: 190, modelKey: 'Aircraft_A321', acType: 'A321neo' },
  ];

  const flights = rawSchedule.map((s, idx) => {
    const f = makeFlightSpec(s, idx);
    if (typeof s.initStep === 'number') {
      f.state = 'active';
      f.ata = s.sta;
      f.stepIndex = s.initStep;
      for (let i = 0; i < s.initStep; i++) {
        f.steps[i].status = 'done';
        f.steps[i].progress = 1;
        f.steps[i].elapsedMins = f.steps[i].plannedMins;
        f.steps[i].delayChecked = true;
      }
      const cur = f.steps[s.initStep];
      cur.status = 'active';
      cur.progress = s.initProg;
      cur.elapsedMins = +(cur.plannedMins * s.initProg).toFixed(1);
      if (s.initDelay > 0) {
        cur.extraDelayMins = s.initDelay;
        cur.delayed = true;
        cur.delayReason = s.initReason || '地面作業延誤';
        cur.delayChecked = true;
        f.ownDelay = s.initDelay;
      }
      // 計算已處理行李數
      if (s.initStep > 1) {
        f.bagsHandled = Math.round(f.bagsTotal * 0.5);
        if (s.initStep === 4) {
          f.bagsHandled += Math.round(f.bagsTotal * 0.5 * s.initProg);
        }
      } else if (s.initStep === 1) {
        f.bagsHandled = Math.round(f.bagsTotal * 0.5 * s.initProg);
      }
    }
    return f;
  });

  // 建立地勤車隊（加油車×3、行李拖車×3、餐車×3、清潔車×1）
  const vehicles = [
    { id: 'FT-01', name: '加油車 FT-01', type: 'fuel', typeLabel: '加油車', modelKey: 'FuelTruck', homeX: 68, homeZ: -13.5, x: -42.2, z: -6.8, yaw: 0, state: 'servicing', assignedFlightId: 'GL-101', assignedGateId: 'G1', fuelPct: 78, progress: 0.45, waypoints: [] },
    { id: 'FT-02', name: '加油車 FT-02', type: 'fuel', typeLabel: '加油車', modelKey: 'FuelTruck', homeX: 73, homeZ: -13.5, x: 73, z: -13.5, yaw: 0, state: 'idle', assignedFlightId: null, assignedGateId: null, fuelPct: 100, progress: 1, waypoints: [] },
    { id: 'FT-03', name: '加油車 FT-03', type: 'fuel', typeLabel: '加油車', modelKey: 'FuelTruck', homeX: 78, homeZ: -13.5, x: 78, z: -13.5, yaw: 0, state: 'idle', assignedFlightId: null, assignedGateId: null, fuelPct: 92, progress: 1, waypoints: [] },

    { id: 'BG-01', name: '行李拖車 BG-01', type: 'baggage', typeLabel: '行李拖車', modelKey: 'BaggageTug', homeX: -74, homeZ: -14.0, x: 3.4, z: 0.2, yaw: -0.22, state: 'servicing', assignedFlightId: 'SL-103', assignedGateId: 'G3', fuelPct: 100, progress: 0.72, waypoints: [] },
    { id: 'BG-02', name: '行李拖車 BG-02', type: 'baggage', typeLabel: '行李拖車', modelKey: 'BaggageTug', homeX: -69, homeZ: -14.0, x: 27.4, z: 0.2, yaw: -0.22, state: 'servicing', assignedFlightId: 'NW-104', assignedGateId: 'G4', fuelPct: 100, progress: 0.38, waypoints: [] },
    { id: 'BG-03', name: '行李拖車 BG-03', type: 'baggage', typeLabel: '行李拖車', modelKey: 'BaggageTug', homeX: -64, homeZ: -14.0, x: -64, z: -14.0, yaw: 0, state: 'idle', assignedFlightId: null, assignedGateId: null, fuelPct: 100, progress: 1, waypoints: [] },

    { id: 'CT-01', name: '升降餐車 CT-01', type: 'catering', typeLabel: '餐車', modelKey: 'CateringTruck', homeX: -74, homeZ: -21.5, x: -21.0, z: -12.8, yaw: 0.18, state: 'servicing', assignedFlightId: 'SK-102', assignedGateId: 'G2', fuelPct: 100, progress: 0.62, waypoints: [] },
    { id: 'CT-02', name: '升降餐車 CT-02', type: 'catering', typeLabel: '餐車', modelKey: 'CateringTruck', homeX: -69, homeZ: -21.5, x: -69, z: -21.5, yaw: 0, state: 'idle', assignedFlightId: null, assignedGateId: null, fuelPct: 100, progress: 1, waypoints: [] },
    { id: 'CT-03', name: '客艙清潔車 CL-01', type: 'catering', typeLabel: '清潔車', modelKey: 'CleaningVan', homeX: -64, homeZ: -21.5, x: -64, z: -21.5, yaw: 0, state: 'idle', assignedFlightId: null, assignedGateId: null, fuelPct: 100, progress: 1, waypoints: [] },
  ];

  // 綁定初始服務中車輛至航班步驟
  flights[0].steps[3].assignedVehicleId = 'FT-01';
  flights[1].steps[2].assignedVehicleId = 'CT-01';
  flights[2].steps[4].assignedVehicleId = 'BG-01';
  flights[3].steps[1].assignedVehicleId = 'BG-02';

  const world = {
    seed,
    rand,
    clockMins: startClock,
    speed: 1, // 0=暫停, 1, 2, 4, 8
    selectedFlightId: 'GL-101',
    activeTab: 'flights', // 'flights' | 'vehicles' | 'gates'
    flights,
    vehicles,
    history: {
      completedCount: 6,
      onTimeCount: 5,
      totalTurnaroundMins: 234, // 6 班平均 39.0 分
      baseBagsHandled: 940,
    },
    events: [
      { id: 1, time: '08:09', level: 'warn', text: 'GL-101（G1）加油管線壓力重測，延誤 +6m，可能波及後續 GL-201' },
      { id: 2, time: '08:10', level: 'info', text: 'GL-105 降落 27R 跑道，正沿 A 滑行道進入 G5 登機門' },
      { id: 3, time: '08:11', level: 'good', text: 'SL-103（G3）登機進度 72%，行李拖車 BG-01 裝櫃作業中' },
    ],
    nextEventId: 4,
  };

  updateAllPoses(world);
  recalcCascadingDelays(world);
  return world;
}

export function pushEvent(world, level, text) {
  world.events.unshift({
    id: world.nextEventId++,
    time: formatClock(world.clockMins),
    level,
    text,
  });
  if (world.events.length > 24) world.events.length = 24;
}

export function remainingTurnaroundMins(flight) {
  if (flight.state === 'departed') return 0;
  let rem = 0;
  for (let i = flight.stepIndex; i < flight.steps.length; i++) {
    const st = flight.steps[i];
    const totalStepNeed = st.plannedMins + st.extraDelayMins;
    if (i === flight.stepIndex && flight.state === 'active') {
      rem += Math.max(0, totalStepNeed - st.elapsedMins);
    } else {
      rem += totalStepNeed;
    }
  }
  return rem;
}

export function recalcCascadingDelays(world) {
  for (const gate of GATES) {
    const gateFlights = world.flights
      .filter((f) => f.gateId === gate.id && f.state !== 'departed')
      .sort((a, b) => a.sta - b.sta);

    let gateReadyAt = world.clockMins;
    let prevCallsign = null;

    for (let i = 0; i < gateFlights.length; i++) {
      const f = gateFlights[i];
      if (f.state === 'active') {
        const rem = remainingTurnaroundMins(f);
        f.etd = Math.round(world.clockMins + rem);
        f.ownDelay = Math.max(0, Math.round(f.etd - f.std - f.cascadeDelay));
        gateReadyAt = f.etd + 1.5; // 1.5 分鐘機坪淨空緩衝
        prevCallsign = f.callsign;
      } else {
        // 尚未進門（holding 或 scheduled）
        const earliestDock = Math.max(f.sta, gateReadyAt);
        const cascade = Math.max(0, Math.round(earliestDock - f.sta));
        f.cascadeDelay = cascade;
        f.cascadeFrom = cascade > 0 ? prevCallsign : null;
        const plannedTurn = f.steps.reduce((acc, s) => acc + s.plannedMins + s.extraDelayMins, 0);
        f.etd = Math.round(earliestDock + plannedTurn);
        gateReadyAt = f.etd + 1.5;
        prevCallsign = f.callsign;
      }
    }
  }
}

export function getMetrics(world) {
  const activeGates = new Set(
    world.flights.filter((f) => f.state === 'active').map((f) => f.gateId)
  ).size;

  // 準點率：已離場 + 目前在場預計延誤 <= 10 分鐘者
  const activeAndNext = world.flights.filter((f) => f.state === 'active' || f.state === 'holding');
  const onTimeActive = activeAndNext.filter((f) => (f.etd - f.std) <= 10).length;
  const totalMeasured = world.history.completedCount + activeAndNext.length;
  const onTimeRate = totalMeasured > 0
    ? ((world.history.onTimeCount + onTimeActive) / totalMeasured) * 100
    : 100;

  // 平均過站分鐘
  const activeTurnSum = activeAndNext.reduce((acc, f) => acc + Math.max(36, f.etd - (f.ata || f.sta)), 0);
  const avgTurnaround = totalMeasured > 0
    ? (world.history.totalTurnaroundMins + activeTurnSum) / totalMeasured
    : 40.0;

  // 處理行李數
  const currentBags = world.flights.reduce((acc, f) => acc + (f.bagsHandled || 0), 0);
  const totalBags = world.history.baseBagsHandled + currentBags;

  return {
    onTimeRate: +onTimeRate.toFixed(1),
    avgTurnaround: +avgTurnaround.toFixed(1),
    activeGates,
    totalGates: GATES.length,
    totalBags,
  };
}

export function dispatchVehicleToFlight(world, vehicleId, flightId, manualBoost = true) {
  const v = world.vehicles.find((x) => x.id === vehicleId);
  const f = world.flights.find((x) => x.id === flightId);
  if (!v || !f || f.state !== 'active') return false;

  // 若此車原本綁定其他航班，先解除原航班的綁定
  if (v.assignedFlightId && v.assignedFlightId !== f.id) {
    const oldF = world.flights.find((x) => x.id === v.assignedFlightId);
    if (oldF) {
      oldF.steps.forEach((s) => {
        if (s.assignedVehicleId === v.id) s.assignedVehicleId = null;
      });
    }
  }

  // 找出該航班對應此車種的步驟（優先目前步驟，否則下一個需要該車種的步驟）
  let targetStep = f.steps[f.stepIndex];
  if (!targetStep || STEPS[f.stepIndex].vehType !== v.type) {
    const nextIdx = f.steps.findIndex((s, idx) => idx >= f.stepIndex && STEPS[idx].vehType === v.type && s.status !== 'done');
    if (nextIdx !== -1) targetStep = f.steps[nextIdx];
  }

  if (targetStep) {
    targetStep.assignedVehicleId = v.id;
    if (manualBoost) {
      targetStep.boosted = true;
      if (targetStep.extraDelayMins > 1) {
        targetStep.extraDelayMins = Math.max(1, Math.floor(targetStep.extraDelayMins * 0.6));
      }
    }
  }

  const spot = serviceSpotForGate(f.gateId, v.type);
  v.assignedFlightId = f.id;
  v.assignedGateId = f.gateId;
  const dist = Math.hypot(spot.x - v.x, spot.z - v.z);
  if (dist < 1.8) {
    v.state = 'servicing';
    v.x = spot.x;
    v.z = spot.z;
    v.yaw = spot.yaw;
    v.waypoints = [];
  } else {
    v.state = 'enroute';
    v.waypoints = buildRoadPath(v.x, v.z, spot.x, spot.z);
    v.targetYaw = spot.yaw;
  }

  if (manualBoost) {
    pushEvent(world, 'info', `已指派 ${v.name} 前往 ${f.gateId} 支援 ${f.callsign}`);
  }
  recalcCascadingDelays(world);
  return true;
}

export function setFlightPriority(world, flightId, newPriority) {
  const f = world.flights.find((x) => x.id === flightId);
  if (!f) return false;
  const p = Math.max(1, Math.min(3, newPriority));
  f.priority = p;
  const pNames = { 1: '普通', 2: '優先', 3: '★ 緊急' };
  pushEvent(world, p >= 2 ? 'info' : 'good', `${f.callsign}（${f.gateId}）調度優先級設為「${pNames[p]}」`);

  // 若設為高優先且目前步驟缺車，立即自動徵調閒置車輛
  if (f.state === 'active') {
    const curStepDef = STEPS[f.stepIndex];
    const curStep = f.steps[f.stepIndex];
    if (curStepDef && curStepDef.vehType && !curStep.assignedVehicleId) {
      const idleV = world.vehicles.find((v) => v.type === curStepDef.vehType && v.state === 'idle');
      if (idleV) dispatchVehicleToFlight(world, idleV.id, f.id, true);
    }
  }
  recalcCascadingDelays(world);
  return true;
}

export function reassignFlightGate(world, flightId, newGateId) {
  const f = world.flights.find((x) => x.id === flightId);
  const g = GATES.find((x) => x.id === newGateId);
  if (!f || !g || f.gateId === newGateId) return false;
  // 僅允許尚未靠橋或剛在等待機門的航班改派空閒登機門
  const occupied = world.flights.some((other) => other.id !== f.id && other.gateId === newGateId && other.state === 'active');
  if (occupied && f.state === 'active') return false;

  const oldGate = f.gateId;
  f.gateId = newGateId;
  if (f.state === 'holding' && !occupied) {
    f.state = 'active';
    f.ata = Math.round(world.clockMins);
    f.stepIndex = 0;
    f.steps[0].status = 'active';
    f.steps[0].progress = 0.35;
  }
  pushEvent(world, 'good', `${f.callsign} 由 ${oldGate} 改派至 ${newGateId} 登機門，解除連鎖延誤等待`);
  updateAllPoses(world);
  recalcCascadingDelays(world);
  return true;
}

export function triggerSampleDelay(world, flightId) {
  const f = world.flights.find((x) => x.id === (flightId || world.selectedFlightId))
    || world.flights.find((x) => x.state === 'active');
  if (!f || f.state !== 'active') return null;
  const step = f.steps[f.stepIndex];
  const def = STEPS[f.stepIndex];
  const addMins = 6;
  step.extraDelayMins += addMins;
  step.progress = Math.min(0.95, step.elapsedMins / (step.plannedMins + step.extraDelayMins));
  step.delayed = true;
  step.delayReason = def.delayReasons[0] || '突發地面設備延誤';
  f.ownDelay += addMins;
  pushEvent(world, 'warn', `⚠ ${f.callsign}（${f.gateId}）於「${def.label}」發生延誤 +${addMins}m：${step.delayReason}`);
  recalcCascadingDelays(world);
  return f;
}

function autoAssignIdleVehicles(world) {
  // 依航班優先順序 (3 -> 2 -> 1) 與到站時間排序需要車輛的步驟
  const needyFlights = world.flights
    .filter((f) => f.state === 'active')
    .sort((a, b) => (b.priority - a.priority) || (a.sta - b.sta));

  for (const f of needyFlights) {
    const def = STEPS[f.stepIndex];
    const st = f.steps[f.stepIndex];
    if (!def || !def.vehType || st.assignedVehicleId) continue;

    // 尋找該車種的待命車輛（加油車需油量 >= 25%）
    const candidate = world.vehicles.find(
      (v) => v.type === def.vehType && v.state === 'idle' && (v.type !== 'fuel' || v.fuelPct >= 25)
    );
    if (candidate) {
      dispatchVehicleToFlight(world, candidate.id, f.id, false);
    }
  }
}

function sendVehicleHome(v) {
  v.assignedFlightId = null;
  v.assignedGateId = null;
  if (v.type === 'fuel' && v.fuelPct < 35) {
    v.state = 'refilling';
  } else {
    v.state = 'returning';
  }
  v.waypoints = buildRoadPath(v.x, v.z, v.homeX, v.homeZ);
  v.targetYaw = 0;
}

function stepVehicles(world, dtSimMins) {
  const moveSpeedMetersPerMin = 48.0; // 車輛在機坪道路的移動速度
  const maxStepDist = moveSpeedMetersPerMin * dtSimMins;

  for (const v of world.vehicles) {
    if (v.waypoints && v.waypoints.length > 0) {
      let remDist = maxStepDist;
      while (remDist > 0 && v.waypoints.length > 0) {
        const wp = v.waypoints[0];
        const dx = wp.x - v.x;
        const dz = wp.z - v.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.01) {
          v.yaw = Math.atan2(-dx, -dz);
        }
        if (d <= remDist) {
          v.x = wp.x;
          v.z = wp.z;
          remDist -= d;
          v.waypoints.shift();
        } else {
          v.x += (dx / d) * remDist;
          v.z += (dz / d) * remDist;
          remDist = 0;
        }
      }
      if (v.waypoints.length === 0) {
        if (v.state === 'enroute') {
          v.state = 'servicing';
          if (typeof v.targetYaw === 'number') v.yaw = v.targetYaw;
        } else if (v.state === 'returning') {
          v.state = 'idle';
          v.yaw = 0;
        } else if (v.state === 'refilling') {
          v.yaw = 0;
        }
      }
    }

    // 油槽區補油邏輯
    if (v.type === 'fuel') {
      if (v.state === 'refilling' && v.waypoints.length === 0) {
        v.fuelPct = Math.min(100, v.fuelPct + dtSimMins * 18);
        v.progress = v.fuelPct / 100;
        if (v.fuelPct >= 100) {
          v.state = 'idle';
          v.progress = 1;
        }
      } else if (v.state === 'idle' && v.fuelPct < 100) {
        v.fuelPct = Math.min(100, v.fuelPct + dtSimMins * 12);
      }
    }
  }
}

export function updateAllPoses(world) {
  for (const f of world.flights) {
    const gate = gateById(f.gateId);
    if (f.state === 'scheduled' || f.state === 'departed') {
      f.pose.visible = false;
      f.pose.jetbridgePct = 0;
      f.pose.pushbackTug = false;
      continue;
    }

    f.pose.visible = true;
    if (f.state === 'holding') {
      // 在滑行道等待區等候前序延誤航班離場
      f.pose.x = gate.holdX;
      f.pose.z = gate.holdZ;
      f.pose.yaw = Math.PI / 2;
      f.pose.jetbridgePct = 0;
      f.pose.pushbackTug = false;
      continue;
    }

    const st = f.steps[f.stepIndex];
    const p = st ? st.progress : 0;

    if (f.stepIndex === 0) {
      // Step 0: 到站 (跑道降落 → 滑行道 → 彎入機門停止線 → 空橋接合)
      if (p < 0.32) {
        const u = p / 0.32;
        f.pose.x = 88 - u * 135;
        f.pose.z = 50;
        f.pose.yaw = -Math.PI / 2;
        f.pose.jetbridgePct = 0;
      } else if (p < 0.52) {
        const u = (p - 0.32) / 0.20;
        f.pose.x = -47 - u * 14;
        f.pose.z = 50 - u * 26;
        f.pose.yaw = -Math.PI / 2 + u * (Math.PI * 0.75);
        f.pose.jetbridgePct = 0;
      } else if (p < 0.85) {
        const u = (p - 0.52) / 0.33;
        const startX = -61;
        f.pose.x = startX + (gate.x - startX) * Math.min(1, u * 1.25);
        const turnU = Math.max(0, (u - 0.45) / 0.55);
        f.pose.z = 24 + (gate.standZ - 24) * (turnU * turnU * (3 - 2 * turnU));
        f.pose.yaw = (Math.PI / 2) * (1 - turnU);
        f.pose.jetbridgePct = 0;
      } else {
        const u = (p - 0.85) / 0.15;
        f.pose.x = gate.x;
        f.pose.z = gate.standZ;
        f.pose.yaw = 0;
        f.pose.jetbridgePct = Math.max(0, Math.min(1, u));
      }
      f.pose.pushbackTug = false;
    } else if (f.stepIndex >= 1 && f.stepIndex <= 4) {
      // Step 1..4: 停靠於登機門作業中
      f.pose.x = gate.x;
      f.pose.z = gate.standZ;
      f.pose.yaw = 0;
      f.pose.jetbridgePct = 1;
      f.pose.pushbackTug = false;
    } else if (f.stepIndex === 5) {
      // Step 5: 推出與離場滑行
      if (p < 0.22) {
        const u = p / 0.22;
        f.pose.x = gate.x;
        f.pose.z = gate.standZ;
        f.pose.yaw = 0;
        f.pose.jetbridgePct = Math.max(0, 1 - u);
        f.pose.pushbackTug = true;
      } else if (p < 0.65) {
        const u = (p - 0.22) / 0.43;
        const ease = u * u * (3 - 2 * u);
        f.pose.x = gate.x - Math.sin(ease * Math.PI * 0.5) * 10;
        f.pose.z = gate.standZ + (24 - gate.standZ) * ease;
        f.pose.yaw = ease * (Math.PI / 2);
        f.pose.jetbridgePct = 0;
        f.pose.pushbackTug = true;
      } else {
        const u = (p - 0.65) / 0.35;
        f.pose.x = (gate.x - 10) + u * (95 - (gate.x - 10));
        f.pose.z = u < 0.45 ? 24 : 24 + ((u - 0.45) / 0.55) * 26;
        f.pose.yaw = Math.PI / 2;
        f.pose.jetbridgePct = 0;
        f.pose.pushbackTug = false;
      }
    }
  }
}

export function stepWorld(world, dtSimMins) {
  if (dtSimMins <= 0) return;
  world.clockMins += dtSimMins;

  // 1. 檢查時刻表到站航班：若登機門空閒則進場 (active)，若被前班延誤佔用則進入滑行道等待 (holding)
  for (const f of world.flights) {
    if (f.state === 'scheduled' && world.clockMins >= f.sta - 1.5) {
      const gateBusy = world.flights.some(
        (other) => other.id !== f.id && other.gateId === f.gateId && other.state === 'active'
      );
      if (!gateBusy) {
        f.state = 'active';
        f.ata = Math.round(world.clockMins);
        f.stepIndex = 0;
        f.steps[0].status = 'active';
        f.steps[0].progress = 0;
        pushEvent(world, 'info', `${f.callsign}（${f.route}）進場滑行，準備停靠 ${f.gateId} 登機門`);
      } else {
        f.state = 'holding';
        const blocker = world.flights.find(
          (other) => other.id !== f.id && other.gateId === f.gateId && other.state === 'active'
        );
        pushEvent(
          world,
          'warn',
          `⚠ ${f.callsign} 已落地，因 ${f.gateId} 仍由 ${blocker ? blocker.callsign : '前班機'} 佔用，於滑行道等待（連鎖延誤）`
        );
      }
    } else if (f.state === 'holding') {
      f.gateHoldDelay = Math.max(0, Math.round(world.clockMins - f.sta));
      const gateBusy = world.flights.some(
        (other) => other.id !== f.id && other.gateId === f.gateId && other.state === 'active'
      );
      if (!gateBusy) {
        f.state = 'active';
        f.ata = Math.round(world.clockMins);
        f.stepIndex = 0;
        f.steps[0].status = 'active';
        f.steps[0].progress = 0.25; // 從滑行道等待點直接轉入機門
        pushEvent(world, 'good', `${f.gateId} 淨空，等待中的 ${f.callsign} 開始滑入登機門（累計連鎖等待 +${f.gateHoldDelay}m）`);
      }
    }
  }

  // 2. 自動派車給需要服務的高優先級航班
  autoAssignIdleVehicles(world);

  // 3. 推進每架在場飛機的過站步驟
  for (const f of world.flights) {
    if (f.state !== 'active') continue;
    const step = f.steps[f.stepIndex];
    const def = STEPS[f.stepIndex];
    if (!step || !def) continue;

    // 檢查地勤車輛是否已到位服務
    let vehSpeedFactor = 1.0;
    let activeVehicle = null;
    if (def.vehType) {
      activeVehicle = world.vehicles.find(
        (v) => v.id === step.assignedVehicleId && v.assignedFlightId === f.id
      );
      if (activeVehicle && activeVehicle.state === 'servicing') {
        vehSpeedFactor = step.boosted ? 1.55 : 1.15;
      } else if (activeVehicle && activeVehicle.state === 'enroute') {
        vehSpeedFactor = 0.45; // 車輛在路上，先做前置準備
      } else {
        vehSpeedFactor = 0.30; // 尚無車輛，進度緩慢
      }
    }

    // 優先級加速倍率
    const prioBoost = f.priority === 3 ? 1.35 : f.priority === 2 ? 1.18 : 1.0;

    // 步驟中段檢定隨機延誤事件
    if (!step.delayChecked && step.progress >= 0.42) {
      step.delayChecked = true;
      const effProb = def.delayProb * (f.priority === 3 ? 0.35 : f.priority === 2 ? 0.65 : 1.0) * (step.boosted ? 0.5 : 1.0);
      if (world.rand() < effProb) {
        const extra = 3 + Math.floor(world.rand() * 4);
        step.extraDelayMins += extra;
        step.delayed = true;
        step.delayReason = def.delayReasons[Math.floor(world.rand() * def.delayReasons.length)];
        f.ownDelay += extra;
        pushEvent(world, 'warn', `⚠ ${f.callsign}（${f.gateId}）「${def.label}」延誤 +${extra}m：${step.delayReason}`);
      }
    }

    const totalDuration = Math.max(1, step.plannedMins + step.extraDelayMins);
    const dProg = (dtSimMins * vehSpeedFactor * prioBoost) / totalDuration;
    const prevProg = step.progress;
    step.progress = Math.min(1, step.progress + dProg);
    step.elapsedMins = +(step.progress * totalDuration).toFixed(1);

    // 同步車輛進度與油量消耗
    if (activeVehicle) {
      activeVehicle.progress = step.progress;
      if (activeVehicle.type === 'fuel' && activeVehicle.state === 'servicing') {
        activeVehicle.fuelPct = Math.max(10, +(activeVehicle.fuelPct - (step.progress - prevProg) * 32).toFixed(1));
      }
    }

    // 同步行李裝卸計數
    if (f.stepIndex === 1) {
      f.bagsHandled = Math.round(f.bagsTotal * 0.5 * step.progress);
    } else if (f.stepIndex === 4) {
      f.bagsHandled = Math.round(f.bagsTotal * 0.5 + f.bagsTotal * 0.5 * step.progress);
    }

    // 步驟完成，推進至下一步驟
    if (step.progress >= 1) {
      step.status = 'done';
      if (activeVehicle) {
        sendVehicleHome(activeVehicle);
      }
      if (f.stepIndex < f.steps.length - 1) {
        f.stepIndex += 1;
        const nextStep = f.steps[f.stepIndex];
        nextStep.status = 'active';
        nextStep.progress = 0;
      } else {
        // 完成推出離場！
        f.state = 'departed';
        f.atd = Math.round(world.clockMins);
        f.bagsHandled = f.bagsTotal;
        const totalTurn = Math.max(32, f.atd - (f.ata || f.sta));
        const depDelay = f.atd - f.std;
        world.history.completedCount += 1;
        if (depDelay <= 10) world.history.onTimeCount += 1;
        world.history.totalTurnaroundMins += totalTurn;
        pushEvent(
          world,
          depDelay <= 5 ? 'good' : 'info',
          `✈ ${f.callsign} 從 ${f.gateId} 完成推出起飛（過站 ${totalTurn} 分鐘，${depDelay <= 0 ? '準點' : `延誤 +${depDelay}m`}）`
        );
      }
    }
  }

  // 4. 推進地勤車路徑移動與補油
  stepVehicles(world, dtSimMins);

  // 5. 若所有航班皆已離場，自動循環生成下一波航班以供持續遊玩
  const remainingActive = world.flights.filter((f) => f.state !== 'departed');
  if (remainingActive.length < 5) {
    spawnNextWave(world);
  }

  updateAllPoses(world);
  recalcCascadingDelays(world);
}

function spawnNextWave(world) {
  const routes = ['TPE → NRT', 'TPE → ICN', 'TPE → SIN', 'TPE → KIX', 'TPE → BKK', 'TPE → HND', 'TPE → FUK'];
  const baseMin = Math.ceil(world.clockMins / 10) * 10 + 12;
  GATES.forEach((g, idx) => {
    const num = 400 + world.flights.length + idx + 1;
    const al = AIRLINES[num % AIRLINES.length];
    const spec = {
      callsign: `${al.code}-${num}`,
      gateId: g.id,
      sta: baseMin + idx * 6,
      route: routes[num % routes.length],
      bags: 150 + (num % 5) * 10,
      modelKey: al.model,
      acType: al.acType,
    };
    world.flights.push(makeFlightSpec(spec, num));
  });
}
