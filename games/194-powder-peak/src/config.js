// 所有可調參數集中在這裡。調校時只改這個檔。
// 單位：公尺、秒、弧度；速度 m/s（HUD 才換算 km/h）。

export const config = {
  sim: {
    fixedDt: 1 / 120,
    maxSubSteps: 8,
    maxFrameDt: 0.1,
  },

  render: {
    maxPixelRatio: 1.75,
    minPixelRatio: 0.75,
    shadowMapSize: 2048,
    shadowRange: 40,
    fogColor: 0xc3dbf2,
    fogNear: 60,
    fogFar: 420,
    fogRange: true,           // 霧依到鏡頭的距離（非視深）→ 寬畫面邊緣新 chunk 不會在霧 77 % 時冒出來
    skyTop: 0x94c6f2,
    skyHorizon: 0xa8cdf2,     // 附圖天空一路藍到地平線；只在最底下一條薄霧帶接 fogColor
    skyHaze: 0.08,            // 地平線霧帶高度（視線 y 分量）
    sunColor: 0xfff0dc,
    sunIntensity: 2.0,
    hemiSky: 0xdaeaff,        // 天空補光強一點 → 陰影是淡藍而不是深灰（附圖影子約 165,180,194）
    hemiGround: 0xe6ecf6,
    hemiIntensity: 1.6,
    sunDirection: [0.65, 1.0, 0.3], // 光源方向（指向太陽）；右後方 → 影子落在角色左側看得到，背面與柵欄內側仍受光
    toneMapping: 'neutral',   // 'aces' | 'agx' | 'neutral' | 'none'（neutral 最接近附圖，雪保持白）
    exposure: 1.0,
    shadowBias: -0.0004,
    shadowNormalBias: 0.035,
    shadowLightDistance: 150,
    shadowAhead: 0.35,        // 陰影中心往前方偏移（× shadowRange）
    cameraNear: 0.25,
    cameraFar: 3000,
    skyRadius: 2000,
    sunGlow: 0.22,
    // 算繪解析度 / 反鋸齒（perf）
    maxRenderPixels: 2.2e6,   // 畫布算繪像素上限（CSS 寬×高×pr²）；高 DPR 螢幕不再照 DPR 算繪（iGPU 填充率瓶頸）
    antialias: true,          // MSAA；起始算繪像素 > antialiasMaxPixels 時自動關
    antialiasMaxPixels: 2.4e6,
    // 自動畫質（每 qualityWindow 秒量一次平均 fps；見 main.js _updateQuality）
    qualityTargetFps: 60,
    qualityLowFps: 55,        // 連續 qualityDownWindows 個窗低於此 → 降 pixelRatio
    qualityHighFps: 58,       // 連續 qualityUpHold 秒高於此 → 小步回升
    qualityWindow: 1,
    qualityWarmup: 3,         // 開局不量（shader 編譯、第一批 chunk 上傳）；1.5 時開機暫態常被誤判
    qualityChangeWarmup: 1,   // 改解析度後不量
    qualityDownWindows: 2,    // 要連續幾個低窗才降（單一暫態窗不算；舊版開局 12 s 內 1 個窗就降 → 5 次載入 3 次誤降）
    qualityMargin: 0.92,      // 降級比例 = sqrt(fps / target) × margin
    qualityMinScale: 0.85,    // 一步最多降到 × 此值（舊 0.6：一次暫態就直接掉到 0.75）
    qualityMaxScale: 0.92,
    qualityUpStep: 0.1,
    qualityUpHold: 8,
    qualityTitleUpHold: 2,    // 標題畫面達標這麼久就一步回到上限（開機暫態誤降後，玩家按開始前就恢復）
    qualityUpFailWindow: 20,  // 升級後這麼久內又降 → 升級失敗（upHold 加倍）
    qualityMaxUpFails: 2,     // 失敗這麼多次就不再升（防震盪）
    // 改畫布尺寸在這台 iGPU（ANGLE D3D11）上會整個卡 0.2～1.8 s → 滑行中不改，
    // 等「安全時機」（標題 / 暫停 / 結算 / 摔倒翻滾中）才套用；以下兩種情況才在滑行中立刻降
    qualityEmergencyFps: 40,
    qualityEmergencyWindows: 3, // 連續幾個窗 < qualityEmergencyFps
    qualityRideApplyAfter: 8,   // 記下的降級之後又持續偏低這麼多秒（fps 40–55 的背景負載 / 降頻）
    orphanBufferUpdates: true, // 覆寫整個 buffer 時改用 bufferData（不等 GPU；見 main.js patchBufferUploads）
    portraitZoomAspect: 1.3,  // 直式螢幕 aspect 低於此值時放寬視角
    portraitZoomMin: 0.62,
  },

  assets: {
    seed: 1337,
    faceVary: 0.035,          // 每個面亮度隨機擾動（手作感）
    rampSegments: 16,         // 跳台頂面取樣段數（>20 會超過 ramp 400 面預算）
  },

  terrain: {
    chunkLength: 40,
    chunkWidth: 360,          // 地形網格總寬（左右各 180m）
    segmentsZ: 10,
    viewAhead: 440,
    keepBehind: 60,
    startStraight: 150,       // 起跑區長度（直、無障礙）
    difficultyDistance: 4500, // 距離多遠達到最大難度
    overDensityPerKm: 0.1,    // 之後障礙密度每 km 再 +0.1 難度（無盡模式持續變難）
    overDensityMax: 0.5,
    slopeStart: 0.17,         // 坡度 tan(θ)：約 9.6°
    slopeEnd: 0.46,           // 約 24.7°
    halfWidthStart: 22,
    halfWidthEnd: 15,
    curveAmpStart: 6,         // 中心線蜿蜒振幅（m）
    curveAmpEnd: 34,
    curveWavelength: 260,     // 主要蜿蜒波長（m）
    bumpAmp: 0.35,            // 賽道內起伏
    bankRise: 0.018,          // 柵欄外雪丘隆起係數（y = bankRise * u²）；0.045 像峽谷牆會擋住彎道視線
    bankRiseScale: 1,
    bankMax: 40,
    bowl: 0.0025,             // 賽道內微凹
    fenceSpacing: 4,
    // 物件密度（每 chunk 平均數量）：[起始, 最大難度]
    treesInsideCourse: [0.2, 2.6],
    rocksInsideCourse: [0.3, 3.2],
    treesOutside: 26,
    gateSpacing: [95, 70],    // 旗門間距
    gateWidth: [8.5, 5.5],    // 旗門寬度
    rampSpacing: [240, 190],  // 跳台間距（每個跳台連同落地走廊約占 130 m，太密會擠掉旗門）
    rampLength: [9, 11],
    rampHeight: [1.6, 2.6],
    rampHalfWidth: 3.2,
    clearRadius: 8,           // 旗門/跳台周圍不放障礙
    // 形狀
    minCurveRadius: 80,       // 中心線最小曲率半徑
    curveEaseLength: 300,     // 起跑直線後蜿蜒淡入距離
    bumpWavelength: 32,
    bankShoulder: 5,          // 柵欄外平緩路肩寬（放松樹），之後才隆起
    hillAmp: 7,
    hillWavelength: 90,
    // 網格
    meshMargin: 12,
    courseCols: 22,
    marginCols: 6,
    outerCols: 14,
    // 配置
    rampSideTaper: 1.1,
    rampLandingClear: 12,     // 預估落地點之後再保留的淨空（m）
    expectSpeed: [30, 38],    // 預期車速 m/s [起始, 最大難度]：落地距離 / 旗門可達性估算
    rampLandingTime: 2.0,     // 落地走廊長度 = 預期車速 × 此秒數（實測滯空 1.0–1.9 s）
    rampLandingHalfWidth: 5,  // 落地走廊半寬（沿跳台軸線），每公尺再放寬 rampLandingSpread
    rampLandingSpread: 0.04,
    rampApproachClear: 30,    // 跳台前這段不放旗門（對正跳台的時間）
    rampSearchStep: 12,       // 跳台落地線放不進賽道（彎太急）時往前挪的步長
    rampSearchTries: 12,
    gateAfterLanding: 20,     // 落地走廊結束後多遠才放下一個旗門
    rampFunnelGate: 22,       // 跳台前的引導門（放在跳台軸線上）距跳台起點
    rampApproachLine: 45,     // 跳台軸線（弦方向）往前延伸這段也要在賽道內 → 引導門前後不會急彎
    gateMinGap: 40,           // 旗門最小間距
    gateTurnRadiusFactor: 2.5, // 旗門可達性：舒適轉彎半徑 = 此倍數 × 最小轉彎半徑 v/ω(v)
    gateMinRadiusFactor: 2.0,  // 相鄰三個路線節點（含賽道本身的彎）外接圓半徑下限 = 此倍數 × v/ω(v)
    lineClearHalfWidth: [3.2, 2.4], // 旗門連線（理想路線）兩側保證淨空半寬 [起始, 最大難度]
    firstGate: 118,
    firstRamp: 260,
    startBannerDistance: 34,
    nearFenceTrees: 3,
    rocksOutside: 3,
    startChuteHalfWidth: 10,  // 起跑滑道半寬（柵欄往遠方收斂的構圖）
    startChuteHold: 50,
    startChuteEnd: 190,
    // 遠景
    mountainCount: 14,
    mountainRadius: [900, 1150],
    mountainScale: [0.6, 1.0],      // 圓丘群（原始約 850m 寬、175m 高）
    mountainHeightScale: [0.75, 1.15],
    mountainSink: 0,
    mountainSlopeSink: 420,
    mountainHaze: [0.78, 0.22],   // 底部 / 頂部往霧色混合；頂部少混 → 圓丘頂比較白
    cloudCount: 12,
    cloudRadius: [650, 1000],
    cloudHeight: [110, 240],
    cloudScale: [7, 11],
    // 效能
    terrainEmissive: 0.07,
    buildPerUpdate: 1,
    shadowChunksBehind: 1,    // 只有玩家附近這些 chunk 的物件投射陰影
    shadowChunksAhead: 2,
  },

  player: {
    gravity: 9.81,
    radius: 0.45,
    snowFriction: 0.045,
    dragStand: 0.0030,        // a = k * v²
    dragCrouch: 0.0018,
    airDrag: 0.0012,
    crouchThrust: 1.4,        // m/s²，蹲低時額外推力（無 boost 也有一點）
    boostThrust: 1.8,         // m/s²，蹲低且 boost > 0
    boostDrain: 0.22,         // 每秒
    boostRegen: 0.03,         // 每秒被動回充
    boostGate: 0.22,          // 過旗門回充
    boostAirPerSec: 0.12,     // 滯空回充
    maxSpeed: 44,
    // 轉向
    turnRateLow: 2.1,         // rad/s，低速
    turnRateHigh: 1.05,       // rad/s，高速
    turnSpeedRef: 32,         // 轉向率內插用參考速度
    turnResponse: 6.5,        // 角速度趨近目標的速率（慣性）
    crouchTurnScale: 0.65,
    grip: 5.0,                // 側向速度衰減率
    gripSkidFloor: 1.6,       // 最差抓地
    skidLateralRef: 7,        // 側向速度超過此值 → 開始側滑
    carveEfficiency: 0.55,    // 被吃掉的側向動量有多少轉成前進
    brakeWhenPerpendicular: 1.0,
    // 跳躍 / 空中
    jumpSpeed: 5.8,
    airborneEpsilon: 0.06,
    airSpinRate: 2.2,
    airAlignRate: 1.4,
    // 落地
    landWobbleAngle: 0.45,    // rad (~26°)
    landCrashAngle: 0.95,     // rad (~54°)
    landWobbleImpact: 11,     // m/s 法向撞擊（真實跳台不按鍵落地 ≈ 9–10.5 → 必須是 clean；8.5 時九成 wobble）
    landCrashImpact: 15,
    crouchImpactBonus: 4,
    wobbleSpeedKeep: 0.85,
    wobbleDuration: 0.6,
    // 摔倒 / 碰撞
    crashSpeedKeep: 0.25,
    crashDuration: 1.7,
    respawnInvulnerable: 1.5,
    respawnSpeed: 6,
    hitSpeedKeep: 0.5,
    hitCooldown: 0.5,
    airHitAlign: 0.85,        // 空中擦撞後 heading 立刻轉向新速度方向的比例（不然落地側滑角過大必摔）
    obstacleCrashSpeed: 24,
    fenceSpeedKeepPerSec: 0.55,
    // 動畫
    crouchHipDrop: 0.42,
    leanMax: 0.55,
    // 細部手感
    coyoteTime: 0.1,
    stickAccel: 6,            // 著地下壓，避免小起伏就騰空
    microAirTime: 0.2,        // 短於此的滯空放寬落地角度
    skidTurnLoadLow: 24,      // 轉彎側向負荷 ω·v（m/s²）開始側滑
    skidTurnLoadHigh: 46,
    skidResponse: 6,
    crashFriction: 0.6,
    hitRestitution: 0.2,
    hitGlancingKeep: 0.8,
    obstacleHeadOnAngle: 0.61, // 35°
    fenceMargin: 0.4,
    fenceBounce: 0.2,
    fenceSteerAway: 2.5,
    stepUpMax: 0.9,           // 地面突然升高超過此值（跳台側壁）當作牆
    crouchResponse: 10,
    launchNormalMax: 7,       // 高速過跳台的起飛法向速度上限
    launchProbe: 3,
    crouchThrustFade: 16,     // 非 boost 蹲低推力在此速度（m/s）衰減到 0
    lipJumpBonus: 2,          // 唇口按跳躍：起飛法向速度上限 = launchNormalMax + 此值（跳得比較高但不會高到必摔）
    airSpinResponse: 5,       // 空中自轉的角速度爬升速率（空中短按只轉一點；按滿整段飛行才會轉過頭摔倒）
    poleThrust: 1.8,          // m/s²，站姿低速撐杖推力（起步不會慢吞吞）
    poleThrustFade: 7,        // m/s，撐杖推力衰減到 0 的速度
    carveEfficiencyLow: 0.85,
    carveSlipLow: 0.06,
    carveSlipHigh: 0.3,
    jumpBuffer: 0.12,         // 落地前 0.12 s 內按 Space 不會被吃掉，著地即起跳（跳躍緩衝）
  },

  input: {
    steerRamp: 4.5,     // 每秒
    steerReturn: 8,     // 放開回中
  },

  bot: {
    // 取樣式路線規劃（見 bot.js）：候選航向 × 保持時間，推演 planHorizon 秒計成本
    planHorizon: 2.4,
    planDt: 0.1,
    planEvery: 3,
    holdTimes: [0.45, 1.1],
    headingOffsets: [0, 0.05, 0.12, 0.22, 0.35, 0.5, 0.7, 1.0],
    headingGain: 3.2,
    gripModel: 4.5,
    maxHeadingOffCourse: 1.0,
    obstacleMargin: 1.1,
    marginPerSpeed: 0.025,
    fenceMargin: 1.3,
    gateEdgeMargin: 0.7,
    gateMissCost: 700,
    rampSkipCost: 250,
    crouchBelowSpeed: 30,
    jumpChancePerSec: 0.1,
    // 弱化 bot（評估平衡用；預設 0 = 近乎完美的 bot）：?bot=1 時可用 __game.config.bot 調整
    reactionTime: 0,          // 秒：多久才重新判斷一次（> planEvery 步時取這個）；弱化基準 0.45
    aimNoise: 0,              // rad：執行航向的隨機漂移（OU 過程，時間常數 0.6 s）；弱化基準 0.15
  },


  camera: {
    // 鏡頭座標沿坡面：distance 沿坡往上坡量、height 沿坡面法線量（陡坡不會被頂成俯視）
    distance: 4.2,         // 低速（起跑）距離 → 角色頭 0.41 → 板尾 0.90，約佔畫面高度一半（附圖 0.43 → 0.93）
    distanceFast: 5.8,     // 高速距離
    height: 1.75,           // 低速高度（約頭頂高度）
    heightFast: 2.95,
    pullSpeedMin: 4,       // m/s 開始拉遠
    pullSpeedMax: 26,      // m/s 拉到 distanceFast/heightFast
    lookAhead: 12,
    lookHeight: 1.05,
    slopeFollow: 0.8,      // 俯仰跟隨坡度比例
    slopeProbe: 6,
    slopeRate: 2.5,
    follow: 5.5,           // 位置平滑
    dirFollow: 3.0,        // 方向平滑
    airPullback: 1.6,      // 滯空時多拉遠
    airRaise: 0.6,
    airBlendIn: 2.2,
    airBlendOut: 3.5,
    fovBase: 58,
    fovMax: 72,
    fovSpeedRef: 38,
    minClearance: 0.8,
    anchorFollow: 12,
    velDirSpeedMin: 1.5,
    velDirSpeedMax: 9,
    crashFollowScale: 0.4,
    fovFollow: 3,
    shakeDecay: 5.5,
    shakeFreq: 22,
    shakeScale: 0.35,
    shakeMax: 1.5,
    lookHeightFast: 1.25,
    crashPullback: 1.6,
    crashRaise: 0.9,
    crashLookAhead: 3,
    predVelRate: 14,
    // 樹遮擋：鏡頭→角色連線（靠鏡頭那段）穿過樹冠 → 沿連線拉近（二階彈簧，避免一幀跳動）
    treeCanopyScale: 3.0,  // 樹冠半徑 = 樹碰撞半徑 r × 此值
    treeMargin: 0.2,
    occlMinFrac: 0.45,     // 最多拉近到原距離的比例
    occlIn: 9,             // 拉近彈簧角頻率
    occlOut: 2.5,          // 放回彈簧角頻率
    occlFromFrac: 0.4,     // 連線上 t < 此值（角色身邊剛擦過的樹）不算遮擋
  },

  score: {
    pointsPerMeter: 1,
    gateBonus: 20,            // 旗門分 = gateBonus × combo（連續過門數，上限 comboMax）→ 20/40/60/80/100
    comboMax: 5,              // 舊 100 × 8：好的一局旗門占 81% 分數；現在約 35–40%
    airBonusPerSec: 50,       // 60 → 50：跳台（每局 ~20 個）空中分占 19% 偏高
    minAirForBonus: 1.5,      // 原地連跳每次滯空 1.2–1.37 s（舊門檻 0.5 → 連跳每秒 ~70 分，比滑行距離分還多）；跳台飛行 1.6–1.9 s
    lives: 3,
    resultsDelay: 1.5,
    minRealAir: 0.15,         // 小於此滯空不計（地形小起伏）
    landingPopupAir: 0.35,
    fenceEventGap: 0.75,
    // 標題 / 結算展示鏡頭
    // 角色約佔畫面高 47 %、在下半部（附圖 51 %）；舊值 7.2 / 2.4 / 5 / 1.3 只佔 26 % 且被 LOGO / 按鈕蓋住 37～92 %
    attractDistance: 4.3,
    attractHeight: 1.7,
    attractSway: 0.55,
    attractSpeed: 0.16,
    attractLookAhead: 6,      // 注視點在角色前方多遠
    attractLookHeight: 2.2,   // 注視點高度（越高角色越靠畫面下方）
  },

  effects: {
    maxParticles: 1400,
    ambientFlakes: 350,
    sprayPerSpeed: 1.6,
    sprayPerSkid: 10,
    sprayMinSpeed: 3,
    sprayLife: [0.4, 0.9],
    spraySize: [0.1, 0.26],
    sprayLateralKick: 5.5,
    sprayUpKick: 2.4,
    sprayInherit: 0.3,
    gravity: 7,
    drag: 2.6,
    flakeBox: [44, 26, 44],
    flakeAhead: 14,
    flakeFall: [0.5, 1.1],
    flakeSize: [0.05, 0.1],
    flakeAlpha: 0.75,
    groundOffset: 0.04,       // 粒子停在雪面上方多少（m）
    settleLife: 0.3,          // 著地後最多再活幾秒（淡出）
    settleFriction: 14,       // 著地後水平速度衰減率（1/s）
    maxPointScreen: 0.07,     // 單顆粒子最大直徑（佔畫布高度比例）：限制近鏡頭大點的 overdraw
  },

  audio: {
    masterVolume: 0.8,
    glideVolume: 0.85,       // 0.55 → 0.7 → 0.85（ref 拉到 44 後整體變小聲，補回來）
    glideSpeedRef: 44,        // 30 → 44：原本 30 m/s 後雪聲就不再變亮
    glideFreqMin: 350,
    glideFreqMax: 3200,
    rumbleVolume: 0.22,
    skidVolume: 0.42,
    windVolume: 0.3,
    windSpeedMin: 15,
    windSpeedRef: 40,
    windFreqMin: 400,
    windFreqMax: 2400,
    windHighpass: 180,
    windAirMin: 0.1,
    windAirBoost: 1.3,
    sfxVolume: 0.9,
    duckAmount: 0.4,
    duckRelease: 0.22,
    boostCooldown: 0.9,       // boost 音效最短間隔（秒）
  },

  hud: {
    speedMaxKmh: 160,
    gaugeSegments: 12,
    boostSegments: 8,
    boostLow: 0.15,
    minimapInterval: 1 / 30,
    minimapMinAhead: 60,
    minimapMaxAhead: 280,
    minimapGrid: 50,
    minimapLateralBoost: 3,
    popupDuration: 1.25,
    maxPopups: 3,
  },
};
