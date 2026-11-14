// 90 年代經典街機風 UI 與極簡 HUD 控制器（致敬 Ridge Racer Type 4 / Gran Turismo / Sega Rally）
// 嚴格保持 >88% 畫面空間留給 3D 賽車與賽道風景，並自動根據鍵盤/手把切換操作提示圖示

import { CAR_CLASSES, CLASS_META, PAINT_PRESETS } from '../physics/cars.js';
import { TRACK_LIST } from '../tracks/tracks.js';

export function formatTimeMs(ms) {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return '--:--.---';
  const totalSec = ms / 1000;
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const millis = Math.floor(ms % 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

export class ArcadeUI {
  constructor(callbacks) {
    this.cb = callbacks;
    this.device = 'keyboard';
    this.minimapCanvas = document.getElementById('minimapCanvas');
    this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;
    this.tachArc = document.getElementById('tachArcFill');
    this.tachRedArc = document.getElementById('tachRedZone');

    this._initGarageDOM();
    this._bindButtons();
  }

  _initGarageDOM() {
    // 1. 建立 D / C / B / A / S 五級切換標籤
    const classBar = document.getElementById('classTabs');
    if (classBar) {
      classBar.innerHTML = CAR_CLASSES.map((cid) => {
        const m = CLASS_META[cid];
        return `<button class="cls-tab" data-class="${cid}" style="--cls-col:${m.color}">
          <span class="cls-letter">${cid}</span>
          <span class="cls-sub">${m.label.split(' ')[0]}</span>
        </button>`;
      }).join('');
    }

    // 2. 建立車漆色票列（含金屬漆、珠光漆、消光漆）
    const paintWrap = document.getElementById('paintSwatches');
    if (paintWrap) {
      paintWrap.innerHTML = PAINT_PRESETS.map((p, idx) => `
        <button class="swatch" data-paint-idx="${idx}" title="${p.name} (${p.type})" style="--sw-col:${p.hex}">
          <span class="sw-type">${p.type[0]}</span>
        </button>
      `).join('');
    }
  }

  _bindButtons() {
    document.getElementById('classTabs')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-class]');
      if (btn && this.cb.onSelectClass) this.cb.onSelectClass(btn.dataset.class);
    });

    document.getElementById('paintSwatches')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-paint-idx]');
      if (btn && this.cb.onSelectPaintIndex) this.cb.onSelectPaintIndex(Number(btn.dataset.paintIdx));
    });

    const customPicker = document.getElementById('customColorPicker');
    if (customPicker) {
      customPicker.addEventListener('input', (e) => {
        if (this.cb.onCustomColor) this.cb.onCustomColor(e.target.value);
      });
    }

    document.getElementById('btnPrevCar')?.addEventListener('click', () => this.cb.onPrevCar?.());
    document.getElementById('btnNextCar')?.addEventListener('click', () => this.cb.onNextCar?.());
    document.getElementById('btnTrackSelect')?.addEventListener('click', () => this.cb.onCycleTrack?.());
    document.getElementById('btnStartDrive')?.addEventListener('click', () => this.cb.onStartDrive?.());
    document.getElementById('btnMute')?.addEventListener('click', () => this.cb.onToggleMute?.());

    // 駕駛 HUD 按鈕
    document.getElementById('btnHudCam')?.addEventListener('click', () => this.cb.onCycleCamera?.());
    document.getElementById('btnHudTrans')?.addEventListener('click', () => this.cb.onToggleTransmission?.());
    document.getElementById('btnHudReset')?.addEventListener('click', () => this.cb.onResetCar?.());
    document.getElementById('btnHudGarage')?.addEventListener('click', () => this.cb.onReturnGarage?.());

    // 測試場快速區域傳送鈕
    document.getElementById('zoneJumpBar')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-zone]');
      if (btn && this.cb.onJumpZone) this.cb.onJumpZone(btn.dataset.zone);
    });

    // 手機觸控虛擬按鍵綁定
    const bindTouch = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      const set = (v, ev) => {
        if (ev) ev.preventDefault();
        if (this.cb.onTouchInput) this.cb.onTouchInput(key, v);
      };
      el.addEventListener('pointerdown', (e) => set(true, e));
      el.addEventListener('pointerup', (e) => set(false, e));
      el.addEventListener('pointercancel', (e) => set(false, e));
      el.addEventListener('pointerleave', (e) => set(false, e));
    };
    bindTouch('tLeft', 'left');
    bindTouch('tRight', 'right');
    bindTouch('tGas', 'throttle');
    bindTouch('tBrake', 'brake');
    bindTouch('tDrift', 'handbrake');
  }

  /**
   * 切換手把 / 鍵盤按鍵提示文字
   */
  updateDevicePrompts(device) {
    this.device = device;
    const isPad = device === 'gamepad';
    const setTxt = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };
    setTxt('hintClass', isPad ? 'LB / RB' : 'Q / E');
    setTxt('hintCar', isPad ? 'D-PAD ◀ ▶' : '◀ / ▶');
    setTxt('hintTrack', isPad ? 'Y 切換場地' : 'T 切換場地');
    setTxt('hintPaint', isPad ? 'X 換色' : 'P 換色');
    setTxt('hintDriveBtn', isPad ? 'A 鍵出賽' : 'ENTER 出賽');
    setTxt('hudHintSteer', isPad ? 'L-STICK 轉向 · RT/LT 油門煞車 · Y 手煞車' : 'WASD/方向鍵 駕駛 · SPACE 手煞車 · SHIFT/CTRL 換檔');
    setTxt('devBadge', isPad ? 'GAMEPAD ACTIVE' : 'KEYBOARD ACTIVE');
  }

  /**
   * 更新車庫規格卡與五維性能條狀圖
   */
  renderGarageCar(carSpec, classCars, carIndexInClass, activePaintIdx, trackId) {
    const clsMeta = CLASS_META[carSpec.classId];

    // 高亮當前 Class Tab
    document.querySelectorAll('#classTabs .cls-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.class === carSpec.classId);
    });

    // 高亮當前車漆 Swatch
    document.querySelectorAll('#paintSwatches .swatch').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.paintIdx) === activePaintIdx);
    });

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setTxt('specClassBadge', `CLASS ${carSpec.classId}`);
    const badgeEl = document.getElementById('specClassBadge');
    if (badgeEl && clsMeta) badgeEl.style.background = clsMeta.color;

    setTxt('specBrand', carSpec.brand);
    setTxt('specName', carSpec.name);
    setTxt('specTagline', carSpec.tagline);
    setTxt('specEngine', carSpec.engineLayout);
    setTxt('specPower', `${carSpec.hp} HP`);
    setTxt('specWeight', `${carSpec.weightKg} KG`);
    setTxt('specDrive', carSpec.drivetrain);
    setTxt('specZeroSixty', `${carSpec.zeroToSixty.toFixed(1)} s`);
    setTxt('specTopSpeed', `${carSpec.topSpeedKmh} KM/H`);
    setTxt('carRosterIndex', `${carIndexInClass + 1} / ${classCars.length}`);

    // 五維性能動畫進度條（Speed, Acceleration, Handling, Braking, Off-Road）
    const stats = carSpec.stats;
    for (const [k, v] of Object.entries(stats)) {
      const fill = document.getElementById(`statFill-${k}`);
      const num = document.getElementById(`statVal-${k}`);
      if (fill) fill.style.width = `${v}%`;
      if (num) num.textContent = String(v);
    }

    // 場地資訊更新
    const trk = TRACK_LIST.find((t) => t.id === trackId) || TRACK_LIST[0];
    setTxt('trackNameLabel', trk.name);
    setTxt('trackSubLabel', trk.subtitle);
  }

  /**
   * 切換車庫畫面與駕駛 HUD
   */
  setScreenMode(mode, trackId = 'circuit') {
    const garageEl = document.getElementById('garageScreen');
    const hudEl = document.getElementById('drivingHud');
    const zoneBar = document.getElementById('zoneJumpBar');
    if (garageEl) garageEl.hidden = mode !== 'garage';
    if (hudEl) hudEl.hidden = mode !== 'driving';
    if (zoneBar) zoneBar.hidden = !(mode === 'driving' && trackId === 'proving');
  }

  setMuteUI(muted) {
    const btn = document.getElementById('btnMute');
    if (btn) {
      btn.textContent = muted ? 'SOUND: OFF [N]' : 'SOUND: ON [N]';
      btn.classList.toggle('muted', muted);
    }
  }

  showCountdown(text) {
    const el = document.getElementById('countdownBanner');
    if (!el) return;
    if (!text) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.textContent = text;
  }

  /**
   * 每幀更新駕駛賽車儀表板（轉速表、時速、檔位、圈速、分段時間與小地圖）
   */
  updateDrivingHUD(simVehicle, lapState, trackObj, cameraMode) {
    if (!simVehicle) return;
    const speedInt = Math.round(Math.abs(simVehicle.speedKmh));
    const speedEl = document.getElementById('hudSpeed');
    if (speedEl) speedEl.textContent = String(speedInt).padStart(3, '0');

    const gearEl = document.getElementById('hudGear');
    if (gearEl) {
      const gStr = simVehicle.gear === -1 ? 'R' : simVehicle.gear === 0 ? 'N' : String(simVehicle.gear);
      gearEl.textContent = gStr;
      gearEl.classList.toggle('rev', simVehicle.gear === -1);
    }

    const transEl = document.getElementById('btnHudTrans');
    if (transEl) transEl.textContent = `${simVehicle.transmission} [M]`;

    const camEl = document.getElementById('btnHudCam');
    if (camEl) camEl.textContent = `${cameraMode} [C]`;

    // 轉速表進度弧（SVG stroke-dashoffset）與超轉換檔提示燈（Shift Light）
    const maxRpm = simVehicle.p.maxRpm;
    const redRpm = simVehicle.p.redlineRpm;
    const rpmRatio = Math.max(0, Math.min(1, simVehicle.rpm / maxRpm));
    if (this.tachArc) {
      const arcLen = 220;
      this.tachArc.style.strokeDashoffset = String(arcLen * (1 - rpmRatio));
      this.tachArc.style.stroke = simVehicle.rpm >= redRpm * 0.94 ? '#ff1f5a' : '#ff5500';
    }

    const rpmNumEl = document.getElementById('hudRpmNum');
    if (rpmNumEl) rpmNumEl.textContent = `${Math.round(simVehicle.rpm)} RPM`;

    const shiftLight = document.getElementById('shiftLight');
    if (shiftLight) {
      const blink = simVehicle.rpm >= redRpm * 0.93;
      shiftLight.classList.toggle('on', blink);
    }

    // 渦輪增壓與路面材質微標籤
    const surfEl = document.getElementById('hudSurface');
    if (surfEl) {
      const boostTxt = simVehicle.spec.audio.hasTurbo
        ? ` · BOOST ${simVehicle.boostBar >= 0 ? '+' : ''}${simVehicle.boostBar.toFixed(2)} BAR`
        : '';
      surfEl.textContent = `${simVehicle.dominantSurface.toUpperCase()}${boostTxt}`;
    }

    // 單圈計時、最佳單圈與 S1/S2/S3 分段計時
    if (lapState) {
      const setTxt = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      };
      setTxt('hudLapCount', `LAP ${lapState.lapCount}`);
      setTxt('hudCurLap', formatTimeMs(lapState.currentLapMs));
      setTxt('hudBestLap', formatTimeMs(lapState.bestLapMs));
      setTxt('hudS1', lapState.sectors[0] ? `${(lapState.sectors[0] / 1000).toFixed(2)}s` : '--.--');
      setTxt('hudS2', lapState.sectors[1] ? `${(lapState.sectors[1] / 1000).toFixed(2)}s` : '--.--');
      setTxt('hudS3', lapState.sectors[2] ? `${(lapState.sectors[2] / 1000).toFixed(2)}s` : '--.--');
      setTxt('hudCpStatus', `CP ${lapState.nextCheckpoint}/${lapState.totalCheckpoints}`);
    }

    // 繪製右上角極簡賽道小地圖
    this._drawMinimap(simVehicle, trackObj);
  }

  _drawMinimap(simVehicle, trackObj) {
    if (!this.minimapCtx || !trackObj || !trackObj.minimapPoints) return;
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const pts = trackObj.minimapPoints;
    if (!pts.length) return;

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    const pad = 28;
    const spanX = Math.max(10, maxX - minX);
    const spanZ = Math.max(10, maxZ - minZ);
    const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanZ);
    const cx = (minX + maxX) * 0.5;
    const cz = (minZ + maxZ) * 0.5;

    const toX = (x) => w * 0.5 + (x - cx) * scale;
    const toY = (z) => h * 0.5 + (z - cz) * scale;

    // 賽道輪廓線
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const px = toX(pts[i].x);
      const py = toY(pts[i].z);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    // 起終點標記
    const p0 = pts[0];
    ctx.fillStyle = '#ffd000';
    ctx.fillRect(toX(p0.x) - 3, toY(p0.z) - 3, 6, 6);

    // 玩家車輛箭頭
    const pos = simVehicle.chassisBody.position;
    const vx = toX(pos.x);
    const vy = toY(pos.z);

    ctx.fillStyle = '#ff5500';
    ctx.beginPath();
    ctx.arc(vx, vy, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
