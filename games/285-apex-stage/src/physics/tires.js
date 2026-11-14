// 輪胎抓地力與滑移曲線模型（Pacejka Magic Formula 簡化版 + 摩擦橢圓耦合 + 路面材質係數）
// 計算四輪獨立的縱向滑移率（Slip Ratio κ）與側向滑移角（Slip Angle α）

export const SURFACE_TYPES = {
  asphalt: { id: 'asphalt', name: 'ASPHALT', grip: 1.00, rollingResist: 0.012, bumpAmp: 0.0, dustColor: 0xeeeeee, isOffroad: false },
  curb:    { id: 'curb',    name: 'CURB',    grip: 0.94, rollingResist: 0.018, bumpAmp: 0.018, dustColor: 0xf5f5f5, isOffroad: false },
  skidpad: { id: 'skidpad', name: 'SKIDPAD', grip: 0.86, rollingResist: 0.010, bumpAmp: 0.0, dustColor: 0xf0f4f8, isOffroad: false },
  gravel:  { id: 'gravel',  name: 'GRAVEL',  grip: 0.68, rollingResist: 0.032, bumpAmp: 0.012, dustColor: 0xc2a077, isOffroad: true },
  dirt:    { id: 'dirt',    name: 'DIRT',    grip: 0.62, rollingResist: 0.038, bumpAmp: 0.016, dustColor: 0x9c7a54, isOffroad: true },
  grass:   { id: 'grass',   name: 'GRASS',   grip: 0.54, rollingResist: 0.045, bumpAmp: 0.014, dustColor: 0x7c9458, isOffroad: true }
};

/**
 * Pacejka Magic Formula: y(x) = D * sin(C * atan(B*x - E*(B*x - atan(B*x))))
 * x: normalized slip (radians for lateral, ratio for longitudinal)
 */
export function pacejka(slip, B, C, D, E) {
  const bx = B * slip;
  return D * Math.sin(C * Math.atan(bx - E * (bx - Math.atan(bx))));
}

/**
 * 計算單輪縱向滑移率（Slip Ratio）與側向滑移角（Slip Angle）及對應輪胎力
 * @param {object} params
 * @returns {{ fx: number, fy: number, slipRatio: number, slipAngle: number, combinedSlip: number, effectiveGrip: number }}
 */
export function computeTireForces(params) {
  const {
    normalLoad,          // 垂直載荷 N (含動態重量轉移與下壓力)
    vLong,               // 輪胎接地中心縱向速度 m/s (前向為正)
    vLat,                // 輪胎接地中心側向速度 m/s (右向為正)
    wheelOmega,          // 輪胎角速度 rad/s
    wheelRadius,         // 輪胎半徑 m
    driveForce,          // 引擎傳遞至該輪之縱向驅動力 N
    brakeForce,          // 該輪煞車阻力 N
    isHandbrake,         // 是否拉起手煞車（後輪鎖死與側滑增益）
    baseTireGrip,        // 車輛基礎輪胎抓地係數
    lateralStiffness,    // 車輛側向剛度係數
    surfaceId,           // 路面種類 ('asphalt'|'curb'|'skidpad'|'gravel'|'dirt'|'grass')
    offroadFactor,       // 車輛越野適應力 (0.45 ~ 0.98)
    isRear,              // 是否為後輪
    oversteerFactor,     // 車款轉向過度傾向
    throttle             // 當前油門開度 0~1
  } = params;

  if (normalLoad <= 1) {
    return { fx: 0, fy: 0, slipRatio: 0, slipAngle: 0, combinedSlip: 0, effectiveGrip: 0 };
  }

  const surf = SURFACE_TYPES[surfaceId] || SURFACE_TYPES.asphalt;
  // 越野路面依車輛 offroadFactor 決定抓地力折損程度（拉力車在砂石泥地保有高抓地力）
  let surfaceGrip = surf.grip;
  if (surf.isOffroad) {
    surfaceGrip = surf.grip * (0.62 + 0.52 * offroadFactor);
  }

  // 輪胎載荷敏感度（Load Sensitivity）：垂直載荷倍增時，摩擦係數微幅遞減，這產生真實的重量轉移轉向特性
  const refLoad = 3200;
  const loadSensitivity = Math.pow(Math.max(0.25, normalLoad / refLoad), -0.06);
  const mu = baseTireGrip * surfaceGrip * loadSensitivity;
  const maxForce = mu * normalLoad;

  // 1. 側向滑移角 Slip Angle α (radians)
  const absVLong = Math.max(1.2, Math.abs(vLong));
  const slipAngle = Math.atan2(vLat, absVLong);

  // 2. 縱向滑移率 Slip Ratio κ
  const wheelGroundSpeed = wheelOmega * wheelRadius;
  const rawSlipRatio = (wheelGroundSpeed - vLong) / Math.max(1.8, Math.abs(vLong), Math.abs(wheelGroundSpeed));
  const slipRatio = Math.max(-1.5, Math.min(1.5, rawSlipRatio));

  // 3. 計算期望縱向力 Fx
  let desiredFx = driveForce;
  if (brakeForce > 0) {
    // 煞車方向與滾動方向相反，低速平滑收斂避免抖動
    const brakeDir = Math.abs(vLong) > 0.35 ? -Math.sign(vLong) : -vLong / 0.35;
    desiredFx += brakeDir * brakeForce;
  }

  // 滾動阻力
  const rollResist = -Math.sign(vLong) * Math.min(Math.abs(vLong) * 15, surf.rollingResist * normalLoad);
  desiredFx += rollResist;

  // 4. Pacejka 側向抓地曲線 Fy
  // B: 剛度因子, C: 形狀因子 (1.35), D: 峰值 (1.0), E: 曲率 (-0.25 讓峰值後平滑衰減，易於救車與控甩)
  const B_lat = lateralStiffness * (surf.isOffroad ? 0.78 : 1.0);
  const normFy = -pacejka(slipAngle, B_lat, 1.35, 1.0, -0.35);

  // 低速側向阻尼（防止低速時 atan2 造成的微小擺動）
  const lowSpeedBlend = Math.min(1.0, Math.hypot(vLong, vLat) / 2.2);
  let desiredFy = normFy * maxForce * lowSpeedBlend;

  // 5. 手煞車甩尾與後驅動力滑胎（Power Oversteer & Handbrake Drift）
  let rearLateralScale = 1.0;
  if (isRear) {
    if (isHandbrake) {
      // 手煞車鎖死後輪：大幅降低後輪側向抓地力，立刻誘發華麗甩尾
      rearLateralScale *= 0.42;
      const hbBrake = -Math.sign(vLong || 1) * maxForce * 0.72;
      desiredFx = hbBrake;
    } else if (throttle > 0.45 && oversteerFactor > 0.15 && Math.abs(slipAngle) > 0.04) {
      // RWD / 高馬力車款出彎重油門時，後輪因縱向輸出吃掉摩擦圓而產生可控的 Power Oversteer
      const powerSlide = Math.min(0.42, (throttle - 0.35) * oversteerFactor * 0.85);
      rearLateralScale *= (1.0 - powerSlide);
    }
  }
  desiredFy *= rearLateralScale;

  // 6. 摩擦圓耦合（Friction Circle Coupling，縱向加速賦予 1.42x 街機推進抓地峰值，側向維持擬真滑移極限）
  const maxLongForce = maxForce * 1.42;
  const fxClamped = Math.max(-maxLongForce, Math.min(maxLongForce, desiredFx));
  const fyMaxAvailable = maxForce * rearLateralScale;
  const nx = fxClamped / Math.max(1, maxLongForce);
  const ny = desiredFy / Math.max(1, fyMaxAvailable);
  const mag = Math.hypot(nx, ny);

  let fx = fxClamped;
  let fy = desiredFy;
  if (mag > 1.0) {
    // 超出摩擦圓極限時，保留部分側向導向力避免完全失控推頭
    const scale = 1.0 / mag;
    fx = fxClamped * scale;
    fy = desiredFy * Math.max(scale, 0.58);
  }

  // 綜合滑移指標（用於觸發胎痕 Skidmarks、輪胎白煙與尖叫音效）
  const angleSlipNorm = Math.min(1.5, Math.abs(slipAngle) / 0.16);
  const ratioSlipNorm = Math.min(1.5, Math.abs(slipRatio) / 0.22);
  const handbrakeBonus = (isRear && isHandbrake && Math.abs(vLong) > 3.0) ? 0.85 : 0;
  const combinedSlip = Math.min(1.5, Math.max(angleSlipNorm, ratioSlipNorm * 0.85) + handbrakeBonus);

  return {
    fx,
    fy,
    slipRatio,
    slipAngle,
    combinedSlip,
    effectiveGrip: mu
  };
}
