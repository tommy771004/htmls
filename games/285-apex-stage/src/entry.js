// 主程式入口：整合 Three.js WebGLRenderer (ACESFilmicToneMapping + PCFSoftShadowMap + PMREMGenerator)、
// Cannon-es 剛體與 Raycast 懸吊物理、程序化車模與 PBR 貼圖、Web Audio DSP 引擎聲浪與 90 年代街機 UI。

import * as THREE from 'three';
import {
  CAR_CLASSES,
  CARS,
  PAINT_PRESETS,
  getCarsByClass,
  getCarById
} from './physics/cars.js';
import { PhysicsWorld, SimVehicle } from './physics/vehicle.js';
import { createProceduralTextures } from './graphics/textures.js';
import { buildCarModel } from './graphics/car-builder.js';
import {
  SkidmarkSystem,
  TireParticleSystem,
  buildGarageShowroom,
  DrivingCameraController
} from './graphics/effects.js';
import { TRACK_LIST, buildCircuitTrack, buildProvingGround } from './tracks/tracks.js';
import { ProceduralAudioEngine } from './audio/synth.js';
import { UnifiedInputController } from './input/controller.js';
import { ArcadeUI } from './ui/hud.js';

class ApexStageGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.mode = 'garage'; // 'garage' | 'driving'

    // 選擇狀態
    this.selectedClass = 'C';
    this.classCarIndex = 0;
    this.selectedCar = getCarsByClass(this.selectedClass)[0] || CARS[0];
    this.selectedPaintIdx = 1; // 灣岸電光藍
    this.customPaintObj = null;
    this.selectedTrackId = 'circuit';

    // 展間旋轉台互動狀態
    this.turntableYaw = 0.55;
    this.turntablePitch = 0.18;
    this.isDraggingTurntable = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;

    // 駕駛與單圈計時狀態
    this.simVehicle = null;
    this.carModel = null;
    this.activeTrack = null;
    this.autopilot = false;
    this.countdownTimer = 0;
    this.lapState = {
      lapCount: 1,
      currentLapMs: 0,
      bestLapMs: 0,
      sectorStartMs: 0,
      sectors: [0, 0, 0],
      nextCheckpoint: 1,
      totalCheckpoints: 6
    };

    // 效能監控
    this.fps = 60;
    this._frameCount = 0;
    this._fpsAccum = 0;

    this._initRenderer();
    this._initAudioAndInput();
    this._initUI();
    this._enterGarage();
    this._startLoop();
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 生成程序化 PBR 貼圖與 PMREM 環境反射貼圖
    this.textures = createProceduralTextures(this.renderer);

    // 1. 車庫 3D 場景
    this.garageScene = new THREE.Scene();
    this.garageScene.background = new THREE.Color(0x090b10);
    this.garageScene.fog = new THREE.FogExp2(0x090b10, 0.042);
    this.garageScene.environment = this.textures.envMap;

    const gAmb = new THREE.AmbientLight(0xd0e2ff, 0.75);
    this.garageScene.add(gAmb);

    const gSpot1 = new THREE.SpotLight(0xfff4e4, 85, 25, Math.PI * 0.34, 0.45, 1.5);
    gSpot1.position.set(4.2, 6.8, 4.5);
    gSpot1.castShadow = true;
    gSpot1.shadow.mapSize.set(1024, 1024);
    this.garageScene.add(gSpot1);

    const gSpot2 = new THREE.SpotLight(0x00d8ff, 45, 22, Math.PI * 0.4, 0.5, 1.5);
    gSpot2.position.set(-5.0, 5.2, -4.2);
    this.garageScene.add(gSpot2);

    const gRim = new THREE.DirectionalLight(0xff6a00, 1.8);
    gRim.position.set(0, 3.5, -7.5);
    this.garageScene.add(gRim);

    this.showroom = buildGarageShowroom(this.garageScene);

    // 2. 賽道駕駛 3D 場景
    this.driveScene = new THREE.Scene();
    this.driveScene.background = new THREE.Color(0x182942);
    this.driveScene.fog = new THREE.FogExp2(0x1e324e, 0.0022);
    this.driveScene.environment = this.textures.envMap;

    const dHemi = new THREE.HemisphereLight(0xdceeff, 0x283024, 0.95);
    this.driveScene.add(dHemi);

    this.sunLight = new THREE.DirectionalLight(0xfff1dc, 2.6);
    this.sunLight.position.set(60, 85, 45);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 260;
    const dCam = 85;
    this.sunLight.shadow.camera.left = -dCam;
    this.sunLight.shadow.camera.right = dCam;
    this.sunLight.shadow.camera.top = dCam;
    this.sunLight.shadow.camera.bottom = -dCam;
    this.sunLight.shadow.bias = -0.0005;
    this.driveScene.add(this.sunLight);
    this.driveScene.add(this.sunLight.target);

    // 攝影機與特效系統
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.15, 750);
    this.camController = new DrivingCameraController(this.camera);
    this.physicsWorld = new PhysicsWorld();
    this.skidmarks = new SkidmarkSystem(this.driveScene, 1600);
    this.particles = new TireParticleSystem(this.driveScene, 180);

    // 綁定視窗縮放與車庫滑鼠拖曳環視
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      this.audio.unlock();
      if (this.mode === 'garage') {
        this.isDraggingTurntable = true;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
      }
    });
    window.addEventListener('pointermove', (e) => {
      if (this.isDraggingTurntable && this.mode === 'garage') {
        const dx = e.clientX - this.lastPointerX;
        const dy = e.clientY - this.lastPointerY;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
        this.turntableYaw += dx * 0.0085;
        this.turntablePitch = Math.max(0.06, Math.min(0.52, this.turntablePitch + dy * 0.004));
      }
    });
    window.addEventListener('pointerup', () => {
      this.isDraggingTurntable = false;
    });
  }

  _initAudioAndInput() {
    this.audio = new ProceduralAudioEngine();
    this.input = new UnifiedInputController({
      onFirstInteract: () => this.audio.unlock(),
      onDeviceChange: (dev) => this.ui?.updateDevicePrompts(dev),
      onAction: (act) => this._handleAction(act)
    });
  }

  _initUI() {
    this.ui = new ArcadeUI({
      onSelectClass: (cid) => {
        this.selectClass(cid);
        this.audio.playClunk();
      },
      onPrevCar: () => {
        this.cycleCar(-1);
        this.audio.playBlip(760);
      },
      onNextCar: () => {
        this.cycleCar(1);
        this.audio.playBlip(920);
      },
      onSelectPaintIndex: (idx) => {
        this.selectPaint(idx);
        this.audio.playBlip(1040);
      },
      onCustomColor: (hex) => {
        this.setCustomPaint(hex);
      },
      onCycleTrack: () => {
        this.cycleTrack();
        this.audio.playBlip(840);
      },
      onStartDrive: () => {
        this.audio.playConfirmChord();
        this.startDriving();
      },
      onToggleMute: () => {
        const m = this.audio.toggleMute();
        this.ui.setMuteUI(m);
      },
      onCycleCamera: () => {
        this.camController.cycleMode();
        this.audio.playBlip(960);
      },
      onToggleTransmission: () => {
        if (this.simVehicle) {
          this.simVehicle.toggleTransmission();
          this.audio.playBlip(780);
        }
      },
      onResetCar: () => {
        this.resetCar();
        this.audio.playBlip(620);
      },
      onReturnGarage: () => {
        this.returnGarage();
        this.audio.playClunk();
      },
      onJumpZone: (z) => {
        this.jumpZone(z);
        this.audio.playBlip(980);
      },
      onTouchInput: (key, val) => {
        this.audio.unlock();
        this.input.touchState[key] = val;
      }
    });
  }

  _handleAction(act) {
    switch (act) {
      case 'prevCar':
        this.cycleCar(-1);
        this.audio.playBlip(760);
        break;
      case 'nextCar':
        this.cycleCar(1);
        this.audio.playBlip(920);
        break;
      case 'prevClass': {
        const idx = (CAR_CLASSES.indexOf(this.selectedClass) - 1 + CAR_CLASSES.length) % CAR_CLASSES.length;
        this.selectClass(CAR_CLASSES[idx]);
        this.audio.playClunk();
        break;
      }
      case 'nextClass': {
        const idx = (CAR_CLASSES.indexOf(this.selectedClass) + 1) % CAR_CLASSES.length;
        this.selectClass(CAR_CLASSES[idx]);
        this.audio.playClunk();
        break;
      }
      case 'cyclePaint':
        this.selectPaint((this.selectedPaintIdx + 1) % PAINT_PRESETS.length);
        this.audio.playBlip(1040);
        break;
      case 'cycleTrack':
        this.cycleTrack();
        this.audio.playBlip(840);
        break;
      case 'startDrive':
        this.audio.playConfirmChord();
        this.startDriving();
        break;
      case 'shiftUp':
        if (this.simVehicle) {
          this.simVehicle.setTransmission('MT');
          this.simVehicle.shiftUp();
        }
        break;
      case 'shiftDown':
        if (this.simVehicle) {
          this.simVehicle.setTransmission('MT');
          this.simVehicle.shiftDown();
        }
        break;
      case 'toggleTransmission':
        if (this.simVehicle) {
          this.simVehicle.toggleTransmission();
          this.audio.playBlip(780);
        }
        break;
      case 'cycleCamera':
        this.camController.cycleMode();
        this.audio.playBlip(960);
        break;
      case 'resetCar':
        this.resetCar();
        this.audio.playBlip(620);
        break;
      case 'returnGarage':
        this.returnGarage();
        this.audio.playClunk();
        break;
      case 'mute': {
        const m = this.audio.toggleMute();
        this.ui.setMuteUI(m);
        break;
      }
    }
  }

  // ==================== 車庫選擇與展示邏輯 ====================

  selectClass(classId) {
    if (!CAR_CLASSES.includes(classId)) return;
    this.selectedClass = classId;
    this.classCarIndex = 0;
    const list = getCarsByClass(classId);
    this.selectedCar = list[0];
    this._syncDefaultPaintForCar();
    this._rebuildGarageCarMesh();
    this._refreshGarageUI();
  }

  cycleCar(dir = 1) {
    const list = getCarsByClass(this.selectedClass);
    this.classCarIndex = (this.classCarIndex + dir + list.length) % list.length;
    this.selectedCar = list[this.classCarIndex];
    this._syncDefaultPaintForCar();
    this._rebuildGarageCarMesh();
    this._refreshGarageUI();
  }

  selectCar(carId) {
    const c = getCarById(carId);
    this.selectedClass = c.classId;
    const list = getCarsByClass(c.classId);
    this.classCarIndex = Math.max(0, list.findIndex((x) => x.id === c.id));
    this.selectedCar = c;
    this._syncDefaultPaintForCar();
    if (this.mode === 'garage') {
      this._rebuildGarageCarMesh();
      this._refreshGarageUI();
    } else {
      this.startDriving({ skipCountdown: true });
    }
  }

  _syncDefaultPaintForCar() {
    this.customPaintObj = null;
    const matchIdx = PAINT_PRESETS.findIndex((p) => p.hex.toLowerCase() === this.selectedCar.visual.defaultPaint.toLowerCase());
    this.selectedPaintIdx = matchIdx >= 0 ? matchIdx : 0;
  }

  selectPaint(idx) {
    this.selectedPaintIdx = ((idx % PAINT_PRESETS.length) + PAINT_PRESETS.length) % PAINT_PRESETS.length;
    this.customPaintObj = null;
    const p = PAINT_PRESETS[this.selectedPaintIdx];
    this.carModel?.setPaint(p);
    this._refreshGarageUI();
  }

  setCustomPaint(hex) {
    this.selectedPaintIdx = -1;
    this.customPaintObj = {
      hex,
      metalness: 0.68,
      roughness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06
    };
    this.carModel?.setPaint(this.customPaintObj);
    this._refreshGarageUI();
  }

  getActivePaint() {
    if (this.customPaintObj) return this.customPaintObj;
    return PAINT_PRESETS[this.selectedPaintIdx] || PAINT_PRESETS[0];
  }

  cycleTrack() {
    const idx = TRACK_LIST.findIndex((t) => t.id === this.selectedTrackId);
    this.selectedTrackId = TRACK_LIST[(idx + 1) % TRACK_LIST.length].id;
    this._refreshGarageUI();
  }

  selectTrack(trackId) {
    if (TRACK_LIST.some((t) => t.id === trackId)) {
      this.selectedTrackId = trackId;
      this._refreshGarageUI();
      if (this.mode === 'driving') {
        this.startDriving({ skipCountdown: true });
      }
    }
  }

  _rebuildGarageCarMesh() {
    if (this.carModel && this.carModel.root.parent) {
      this.carModel.root.parent.remove(this.carModel.root);
    }
    this.carModel = buildCarModel(this.selectedCar, this.textures, this.getActivePaint());
    this.carModel.root.position.set(0, 0.16, 0);
    this.showroom.turntable.add(this.carModel.root);
  }

  _refreshGarageUI() {
    const list = getCarsByClass(this.selectedClass);
    this.ui.renderGarageCar(
      this.selectedCar,
      list,
      this.classCarIndex,
      this.selectedPaintIdx,
      this.selectedTrackId
    );
  }

  _enterGarage() {
    this.mode = 'garage';
    this.input.setMode('garage');
    this.audio.setDrivingActive(false);

    if (this.simVehicle) {
      this.simVehicle.destroy();
      this.simVehicle = null;
    }

    this._rebuildGarageCarMesh();
    this._refreshGarageUI();
    this.ui.setScreenMode('garage', this.selectedTrackId);
  }

  returnGarage() {
    this._enterGarage();
  }

  // ==================== 駕駛模式與賽道邏輯 ====================

  startDriving(opts = {}) {
    this.audio.unlock();
    this.mode = 'driving';
    this.input.setMode('driving');

    // 建立或切換賽道場景
    if (this.activeTrack) {
      this.activeTrack.destroy();
      this.activeTrack = null;
    }
    if (this.selectedTrackId === 'proving') {
      this.activeTrack = buildProvingGround(this.driveScene, this.physicsWorld, this.textures);
    } else {
      this.activeTrack = buildCircuitTrack(this.driveScene, this.physicsWorld, this.textures);
    }

    this.skidmarks.clear();

    // 建立物理載具與高精細 3D 車模
    if (this.simVehicle) {
      this.simVehicle.destroy();
    }
    this.simVehicle = new SimVehicle(this.physicsWorld, this.selectedCar);
    const sp = this.activeTrack.startPose;
    this.simVehicle.reset(sp.position, sp.yaw);

    if (this.carModel && this.carModel.root.parent) {
      this.carModel.root.parent.remove(this.carModel.root);
    }
    this.carModel = buildCarModel(this.selectedCar, this.textures, this.getActivePaint());
    this.driveScene.add(this.carModel.root);
    this.carModel.syncFromPhysics(this.simVehicle);

    this.camController.resetToVehicle(this.simVehicle);

    // 初始化單圈與分段計時
    const bestKey = `apex285:best:${this.selectedTrackId}:${this.selectedCar.classId}`;
    let savedBest = 0;
    try {
      savedBest = Number(localStorage.getItem(bestKey)) || 0;
    } catch {}

    this.lapState = {
      lapCount: 1,
      currentLapMs: 0,
      bestLapMs: savedBest,
      sectorStartMs: 0,
      sectors: [0, 0, 0],
      nextCheckpoint: 1,
      totalCheckpoints: this.activeTrack.checkpoints.length,
      bestKey
    };

    this.ui.setScreenMode('driving', this.selectedTrackId);
    this.audio.setDrivingActive(true);

    if (opts.skipCountdown) {
      this.countdownTimer = 0;
      this.ui.showCountdown(null);
    } else {
      this.countdownTimer = 1.8;
      this._lastCountdownInt = 4;
    }
  }

  resetCar() {
    if (!this.simVehicle || !this.activeTrack) return;
    const pos = this.simVehicle.chassisBody.position;
    const pose = this.activeTrack.getNearestResetPose(pos.x, pos.z);
    this.simVehicle.reset(pose.position, pose.yaw);
    this.camController.resetToVehicle(this.simVehicle);
  }

  jumpZone(zoneId) {
    if (!this.simVehicle || !this.activeTrack || !this.activeTrack.zones) return;
    const z = this.activeTrack.zones[zoneId];
    if (!z) return;
    this.simVehicle.reset(new THREE.Vector3(z.x, 0.35, z.z), z.yaw || 0);
    this.camController.resetToVehicle(this.simVehicle);
  }

  /**
   * 更新賽道檢查點防作弊判定、分段計時（S1/S2/S3）與最佳單圈
   */
  _updateLapTiming(dt) {
    if (!this.simVehicle || !this.activeTrack) return;
    this.lapState.currentLapMs += dt * 1000;

    const cps = this.activeTrack.checkpoints;
    if (!cps || !cps.length) return;

    const nextCp = cps[this.lapState.nextCheckpoint];
    const pos = this.simVehicle.chassisBody.position;
    const dist = Math.hypot(pos.x - nextCp.position.x, pos.z - nextCp.position.z);

    if (dist <= nextCp.radius) {
      // 記錄分段時間
      if (nextCp.isSectorEnd === 1) {
        this.lapState.sectors[0] = this.lapState.currentLapMs;
        this.lapState.sectorStartMs = this.lapState.currentLapMs;
      } else if (nextCp.isSectorEnd === 2) {
        this.lapState.sectors[1] = this.lapState.currentLapMs - this.lapState.sectorStartMs;
        this.lapState.sectorStartMs = this.lapState.currentLapMs;
      } else if (nextCp.isSectorEnd === 3 && this.lapState.nextCheckpoint === 0) {
        // 通過終點線完成單圈！
        this.lapState.sectors[2] = this.lapState.currentLapMs - this.lapState.sectorStartMs;
        const finishedMs = this.lapState.currentLapMs;
        if (this.lapState.bestLapMs <= 0 || finishedMs < this.lapState.bestLapMs) {
          this.lapState.bestLapMs = finishedMs;
          try {
            localStorage.setItem(this.lapState.bestKey, String(Math.round(finishedMs)));
          } catch {}
        }
        this.lapState.lapCount++;
        this.lapState.currentLapMs = 0;
        this.lapState.sectorStartMs = 0;
        this.audio.playConfirmChord();
      }

      this.lapState.nextCheckpoint = (this.lapState.nextCheckpoint + 1) % cps.length;
    }
  }

  /**
   * 賽道自動試駕 AI（供實機多圈遙測驗證與展示使用）
   */
  _computeAutopilotInput() {
    if (!this.simVehicle || !this.activeTrack || !this.activeTrack.samples) {
      return { steer: 0, throttle: 0.7, brake: 0, handbrake: false };
    }
    const samples = this.activeTrack.samples;
    const n = samples.length;
    const pos = this.simVehicle.chassisBody.position;

    // 尋找最近樣本點
    let bestIdx = 0;
    let bestDistSq = Infinity;
    for (let i = 0; i < n; i++) {
      const p = samples[i].pt;
      const dSq = (pos.x - p.x) * (pos.x - p.x) + (pos.z - p.z) * (pos.z - p.z);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = i;
      }
    }

    // 依當前車速動態決定前瞻點（Lookahead）與多段彎道曲率預判
    const speedKmh = Math.abs(this.simVehicle.speedKmh);
    const lookStep = Math.max(4, Math.min(12, Math.floor(4 + speedKmh / 32)));
    const targetPt = samples[(bestIdx + lookStep) % n].pt;
    const midPt = samples[(bestIdx + lookStep * 2) % n].pt;
    const farPt = samples[(bestIdx + lookStep * 3) % n].pt;

    // 計算車頭朝向與目標點夾角
    const q = this.simVehicle.chassisBody.quaternion;
    const threeQ = new THREE.Quaternion(q.x, q.y, q.z, q.w);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(threeQ);
    const toTarget = new THREE.Vector3(targetPt.x - pos.x, 0, targetPt.z - pos.z).normalize();

    // 在我們的座標系中：fwd cross toTarget 的 Y 分量 > 0 代表目標在左側（需左轉 steer > 0）
    const crossY = fwd.z * toTarget.x - fwd.x * toTarget.z;
    const dot = fwd.x * toTarget.x + fwd.z * toTarget.z;
    const angleErr = Math.atan2(crossY, dot);

    const steer = Math.max(-1, Math.min(1, angleErr * 2.65));

    // 多段前方曲率預判，提早為急彎減速
    const t0 = samples[bestIdx].tan;
    const t1 = samples[(bestIdx + lookStep) % n].tan;
    const t2 = samples[(bestIdx + lookStep * 2) % n].tan;
    const t3 = samples[(bestIdx + lookStep * 3) % n].tan;
    const c1 = Math.acos(Math.max(-1, Math.min(1, t0.dot(t1))));
    const c2 = Math.acos(Math.max(-1, Math.min(1, t1.dot(t2))));
    const c3 = Math.acos(Math.max(-1, Math.min(1, t2.dot(t3))));
    const turnSeverity = Math.max(c1, c2 * 1.15, c3 * 1.1);

    const targetSpeed = turnSeverity > 0.45
      ? 68
      : turnSeverity > 0.28
      ? 92
      : turnSeverity > 0.14
      ? 125
      : 290;

    let throttle = 0.94;
    let brake = 0.0;
    if (speedKmh > targetSpeed + 6) {
      throttle = 0.0;
      brake = Math.min(0.92, (speedKmh - targetSpeed) / 48);
    } else if (Math.abs(steer) > 0.5 && speedKmh > 82) {
      throttle = 0.32;
    }

    return { steer, throttle, brake, handbrake: false };
  }

  /**
   * 單步推進模擬（同時支援即時動畫迴圈與測試腳本同步快轉）
   */
  stepSimulation(dt) {
    if (this.mode === 'garage') {
      const inp = this.input.poll(dt);
      if (!this.isDraggingTurntable) {
        this.turntableYaw += (0.32 + inp.orbitDeltaX) * dt;
      }
      this.showroom.turntable.rotation.y = this.turntableYaw;

      // 車庫環繞鏡頭（焦點微偏左以讓 3D 轉盤跑車呈現於右側開闊畫面中央，完全避開左側規格卡）
      const camDist = 5.2;
      const camX = -0.52 + Math.sin(this.turntableYaw * 0.15) * 0.3;
      const camY = 1.38 + Math.sin(this.turntablePitch) * 1.5;
      this.camera.fov = 43;
      this.camera.updateProjectionMatrix();
      this.camera.position.set(camX, camY, camDist);
      this.camera.lookAt(-0.52, 0.64, 0);
      return;
    }

    // 駕駛模式
    if (this.countdownTimer > 0) {
      this.countdownTimer -= dt;
      const curInt = Math.ceil(this.countdownTimer * 1.6);
      if (curInt !== this._lastCountdownInt && curInt >= 1 && curInt <= 3) {
        this._lastCountdownInt = curInt;
        this.ui.showCountdown(String(curInt));
        this.audio.playCountdown(false);
      } else if (this.countdownTimer <= 0) {
        this.ui.showCountdown('GO!');
        this.audio.playCountdown(true);
        setTimeout(() => this.ui.showCountdown(null), 650);
      }
    }

    const ctrlInput = this.autopilot ? this._computeAutopilotInput() : this.input.poll(dt);
    this.simVehicle.step(dt, ctrlInput);
    this.carModel.syncFromPhysics(this.simVehicle);

    // 太陽陰影相機跟隨玩家車輛
    const carPos = this.simVehicle.chassisBody.position;
    this.sunLight.position.set(carPos.x + 55, carPos.y + 80, carPos.z + 40);
    this.sunLight.target.position.set(carPos.x, carPos.y, carPos.z);

    this.skidmarks.update(this.simVehicle);
    this.particles.update(dt, this.simVehicle);
    this.camController.update(dt, this.simVehicle);
    this.audio.updateFromVehicle(this.simVehicle);
    this._updateLapTiming(dt);
    this.ui.updateDrivingHUD(this.simVehicle, this.lapState, this.activeTrack, this.camController.mode);
  }

  _startLoop() {
    let lastTime = performance.now();
    const tick = (now) => {
      requestAnimationFrame(tick);
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(0.05, Math.max(0.001, rawDt));

      this._frameCount++;
      this._fpsAccum += rawDt;
      if (this._fpsAccum >= 0.5) {
        this.fps = Math.round((this._frameCount * 1000) / (this._fpsAccum * 1000));
        this._frameCount = 0;
        this._fpsAccum = 0;
      }

      this.stepSimulation(dt);
      const activeScene = this.mode === 'garage' ? this.garageScene : this.driveScene;
      this.renderer.render(activeScene, this.camera);
    };
    requestAnimationFrame(tick);
  }

  getTelemetryInfo() {
    const v = this.simVehicle;
    return {
      mode: this.mode,
      classId: this.selectedClass,
      carId: this.selectedCar.id,
      carName: this.selectedCar.name,
      drivetrain: this.selectedCar.drivetrain,
      trackId: this.selectedTrackId,
      cameraMode: this.camController.mode,
      transmission: v ? v.transmission : 'AT',
      speedKmh: v ? Number(v.speedKmh.toFixed(1)) : 0,
      rpm: v ? Math.round(v.rpm) : 0,
      gear: v ? v.gear : 1,
      boostBar: v ? Number(v.boostBar.toFixed(2)) : 0,
      slipAngleDeg: v ? Number(v.slipAngleDeg.toFixed(2)) : 0,
      maxWheelSlip: v ? Number(v.maxWheelSlip.toFixed(2)) : 0,
      bodyPitchDeg: v ? Number(((v.bodyPitch * 180) / Math.PI).toFixed(2)) : 0,
      bodyRollDeg: v ? Number(((v.bodyRoll * 180) / Math.PI).toFixed(2)) : 0,
      longG: v ? Number(v.longG.toFixed(2)) : 0,
      latG: v ? Number(v.latG.toFixed(2)) : 0,
      onCurb: v ? v.onCurb : false,
      airborne: v ? v.airborne : false,
      dominantSurface: v ? v.dominantSurface : 'asphalt',
      position: v
        ? [
            Number(v.chassisBody.position.x.toFixed(2)),
            Number(v.chassisBody.position.y.toFixed(2)),
            Number(v.chassisBody.position.z.toFixed(2))
          ]
        : [0, 0, 0],
      wheels: v
        ? v.wheels.map((w) => ({
            inContact: w.inContact,
            compression: Number(w.compression.toFixed(2)),
            normalLoad: Math.round(w.normalLoad),
            slipRatio: Number(w.slipRatio.toFixed(2)),
            slipAngleDeg: Number(((w.slipAngle * 180) / Math.PI).toFixed(2)),
            combinedSlip: Number(w.combinedSlip.toFixed(2)),
            surface: w.surface
          }))
        : [],
      lapCount: this.lapState.lapCount,
      currentLapMs: Math.round(this.lapState.currentLapMs),
      bestLapMs: Math.round(this.lapState.bestLapMs),
      nextCheckpoint: this.lapState.nextCheckpoint,
      sectors: this.lapState.sectors.map((s) => Math.round(s)),
      muted: this.audio.muted,
      audioState: this.audio.ctx ? this.audio.ctx.state : 'uninitialized',
      audioPeak: this.audio.getWaveformPeak(),
      activeDevice: this.input.activeDevice,
      fps: this.fps,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles
    };
  }
}

const game = new ApexStageGame();

// 暴露診斷與實機試駕調校介面供 Playwright 與測試腳本操作
window.__apex = {
  ready: true,
  game,
  info: () => game.getTelemetryInfo(),
  selectClass: (cid) => game.selectClass(cid),
  selectCar: (id) => game.selectCar(id),
  selectTrack: (tid) => game.selectTrack(tid),
  selectPaint: (idx) => game.selectPaint(idx),
  setCustomPaint: (hex) => game.setCustomPaint(hex),
  startDriving: (opts = { skipCountdown: true }) => game.startDriving(opts),
  returnGarage: () => game.returnGarage(),
  resetCar: () => game.resetCar(),
  jumpZone: (z) => game.jumpZone(z),
  cycleCamera: () => game.camController.cycleMode(),
  toggleTransmission: () => game.simVehicle?.toggleTransmission(),
  setAutopilot: (on) => {
    game.autopilot = !!on;
  },
  stepPhysics: (steps = 1, overrideInput = null) => {
    game.input.overrideInput = overrideInput;
    for (let i = 0; i < steps; i++) {
      game.stepSimulation(1 / 60);
    }
    game.input.overrideInput = null;
    return game.getTelemetryInfo();
  }
};
