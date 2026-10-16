// Cyberpunk HUD:
// - Top-left rotating radar minimap (roads, blocks, venues, traffic cars, player arrow, car icon)
// - District & Venue holographic header + advancing night clock (23:42 -> 04:30) + FPS counter
// - Bottom-right digital speedometer, RPM bar, Nitro boost gauge, or On-Foot status panel
// - Full-city interactive map modal [M] with 1-click quick teleport to Nightclub, Bar, Garage, and Districts
// - Mobile responsive virtual joystick & touch action buttons

import { ROADS, CITY_HALF, DISTRICTS, VENUES } from './city.js';

export class CyberHUD {
  constructor(gameplay, soundscape) {
    this.gameplay = gameplay;
    this.soundscape = soundscape;

    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;

    this.elDistrictName = document.getElementById('hud-district-name');
    this.elDistrictSub = document.getElementById('hud-district-sub');
    this.elClock = document.getElementById('hud-clock');
    this.elFps = document.getElementById('hud-fps');
    this.elModeBadge = document.getElementById('hud-mode-badge');
    this.elSpeedVal = document.getElementById('hud-speed-val');
    this.elSpeedUnit = document.getElementById('hud-speed-unit');
    this.elGear = document.getElementById('hud-gear');
    this.elRpmFill = document.getElementById('hud-rpm-fill');
    this.elBoostFill = document.getElementById('hud-boost-fill');
    this.elPrompt = document.getElementById('hud-prompt');
    this.elToast = document.getElementById('hud-toast');
    this.elVenueBanner = document.getElementById('hud-venue-banner');
    this.elMapModal = document.getElementById('map-modal');
    this.elBtnAudio = document.getElementById('btn-audio');
    this.elBtnMode = document.getElementById('btn-mode-switch');

    // Advancing night clock starting at 23:42
    this.gameMinutes = 23 * 60 + 42;
    this.toastTimer = 0;
    this.lastDistrictId = '';
    this.lastVenueId = '';
    this.bannerTimer = 0;

    this.fpsFrames = 0;
    this.fpsAccum = 0;
    this.currentFps = 60;

    this.bindUIEvents();
  }

  bindUIEvents() {
    // Quick teleport buttons (both HUD bar & Map Modal)
    document.querySelectorAll('[data-teleport]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = btn.getAttribute('data-teleport');
        this.handleTeleport(target);
        this.toggleMapModal(false);
      });
    });

    const btnMapOpen = document.getElementById('btn-map-open');
    if (btnMapOpen) {
      btnMapOpen.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMapModal();
      });
    }

    const btnMapClose = document.getElementById('btn-map-close');
    if (btnMapClose) {
      btnMapClose.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMapModal(false);
      });
    }

    if (this.elBtnAudio) {
      this.elBtnAudio.addEventListener('click', (e) => {
        e.stopPropagation();
        const muted = this.soundscape.toggleMute();
        this.elBtnAudio.textContent = muted ? '🔇 音效：關' : '🔊 音效：開';
      });
    }

    if (this.elBtnMode) {
      this.elBtnMode.addEventListener('click', (e) => {
        e.stopPropagation();
        this.gameplay.toggleVehicleMode();
      });
    }

    // Mobile / Touch Buttons
    const bindHold = (id, keyName) => {
      const el = document.getElementById(id);
      if (!el) return;
      const setKey = (val) => {
        this.gameplay.keys[keyName] = val;
        el.classList.toggle('active', val);
      };
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.soundscape.init();
        setKey(true);
      });
      el.addEventListener('pointerup', () => setKey(false));
      el.addEventListener('pointercancel', () => setKey(false));
      el.addEventListener('pointerleave', () => setKey(false));
    };

    bindHold('touch-up', 'forward');
    bindHold('touch-down', 'backward');
    bindHold('touch-left', 'left');
    bindHold('touch-right', 'right');
    bindHold('touch-boost', 'sprint');
    bindHold('touch-drift', 'brake');

    const touchExit = document.getElementById('touch-exit');
    if (touchExit) {
      touchExit.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.soundscape.init();
        this.gameplay.toggleVehicleMode();
      });
    }

    const touchAct = document.getElementById('touch-interact');
    if (touchAct) {
      touchAct.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.soundscape.init();
        this.gameplay.triggerContextAction();
      });
    }
  }

  handleTeleport(target) {
    this.soundscape.init();
    if (target === 'pulse_inside') {
      this.gameplay.teleportTo(0, -10.5, 0, 'walking');
      this.showToast('已抵達 PULSE // 脈衝夜店內部舞池');
    } else if (target === 'pulse_street') {
      this.gameplay.teleportTo(-6, -26.5, Math.PI / 2, 'driving');
      this.showToast('已抵達 PULSE // 脈衝夜店正門大道');
    } else if (target === 'bar_inside') {
      this.gameplay.teleportTo(-60, -9.5, 0, 'walking');
      this.showToast('已抵達 AFTERGLOW // 餘燼酒吧內部吧檯');
    } else if (target === 'garage_inside') {
      this.gameplay.teleportTo(60, -4.0, 0, 'driving');
      this.showToast('已駛入 CHROME WORKS // 電馭改裝廠');
    } else if (target === 'arasaka_plaza') {
      this.gameplay.teleportTo(-90, -82, 0, 'driving');
      this.showToast('已傳送至 荒坂金融區 // ARASAKA CORPO PLAZA');
    } else if (target === 'harbor_highway') {
      this.gameplay.teleportTo(-90, 90, Math.PI / 2, 'driving');
      this.showToast('已傳送至 工業海灣大道 // RAIN HARBOR');
    }
  }

  toggleMapModal(force) {
    if (!this.elMapModal) return;
    const isHidden = this.elMapModal.hasAttribute('hidden');
    const nextShow = typeof force === 'boolean' ? force : isHidden;
    if (nextShow) {
      this.elMapModal.removeAttribute('hidden');
    } else {
      this.elMapModal.setAttribute('hidden', '');
    }
  }

  showToast(msg) {
    if (!this.elToast) return;
    this.elToast.textContent = msg;
    this.elToast.classList.add('visible');
    this.toastTimer = 3.6;
  }

  showVenueBanner(title, subtitle, color = '#00f0ff') {
    if (!this.elVenueBanner) return;
    this.elVenueBanner.innerHTML = `<div class="vb-sub">${subtitle}</div><div class="vb-title" style="color:${color}">${title}</div>`;
    this.elVenueBanner.classList.add('visible');
    this.bannerTimer = 2.8;
  }

  update(dt, trafficCars = []) {
    // 1. FPS meter
    this.fpsFrames++;
    this.fpsAccum += dt;
    if (this.fpsAccum >= 0.4) {
      this.currentFps = Math.min(120, Math.round(this.fpsFrames / this.fpsAccum));
      if (this.elFps) this.elFps.textContent = `${this.currentFps} FPS`;
      this.fpsFrames = 0;
      this.fpsAccum = 0;
    }

    // 2. Advancing Night Clock (1 real second = 1 game minute, loops 22:00 - 04:59)
    this.gameMinutes += dt * 0.85;
    const totalMins = Math.floor(this.gameMinutes) % (24 * 60);
    const hh = String(Math.floor(totalMins / 60)).padStart(2, '0');
    const mm = String(totalMins % 60).padStart(2, '0');
    if (this.elClock) this.elClock.textContent = `${hh}:${mm}`;

    // 3. District & Venue Header
    const venue = this.gameplay.insideVenue;
    const dist = this.gameplay.currentDistrict;
    if (venue) {
      if (this.elDistrictName) {
        this.elDistrictName.textContent = venue.name;
        this.elDistrictName.style.color = venue.color;
      }
      if (this.elDistrictSub) {
        this.elDistrictSub.textContent = `INTERIOR // ${venue.sub || venue.subtitle || ''}`;
      }
      if (this.lastVenueId !== venue.id) {
        this.lastVenueId = venue.id;
        this.showVenueBanner(venue.name, venue.sub || venue.subtitle || '', venue.color);
      }
    } else if (dist) {
      this.lastVenueId = '';
      if (this.elDistrictName) {
        this.elDistrictName.textContent = dist.name;
        this.elDistrictName.style.color = dist.color;
      }
      if (this.elDistrictSub) {
        this.elDistrictSub.textContent = dist.sub;
      }
      if (this.lastDistrictId !== dist.id) {
        this.lastDistrictId = dist.id;
      }
    }

    // 4. Timers for toast & venue banner
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0 && this.elToast) {
        this.elToast.classList.remove('visible');
      }
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0 && this.elVenueBanner) {
        this.elVenueBanner.classList.remove('visible');
      }
    }

    // 5. Speedometer & Mode Badge
    const kmh = Math.round(Math.abs(this.gameplay.speedKmh));
    if (this.elSpeedVal) {
      this.elSpeedVal.textContent = String(kmh).padStart(3, '0');
    }

    if (this.gameplay.mode === 'driving') {
      if (this.elModeBadge) {
        this.elModeBadge.textContent = 'DRIVING // 載具模式';
        this.elModeBadge.className = 'mode-badge driving';
      }
      if (this.elBtnMode) this.elBtnMode.textContent = '🚶 下車步行 (F)';
      if (this.elGear) {
        if (this.gameplay.carSpeed < -0.5) this.elGear.textContent = 'R';
        else if (kmh === 0) this.elGear.textContent = 'N';
        else this.elGear.textContent = `D${Math.min(6, 1 + Math.floor(kmh / 24))}`;
      }
      const rpmPct = Math.min(100, Math.round(((kmh % 28) / 28) * 75 + (kmh > 0 ? 22 : 8)));
      if (this.elRpmFill) this.elRpmFill.style.width = `${rpmPct}%`;
    } else {
      if (this.elModeBadge) {
        this.elModeBadge.textContent = this.gameplay.dancing
          ? 'DANCING // 律動熱舞'
          : 'ON FOOT // 步行探索';
        this.elModeBadge.className = 'mode-badge walking';
      }
      if (this.elBtnMode) this.elBtnMode.textContent = '🚘 登車 / 召喚 (F)';
      if (this.elGear) this.elGear.textContent = this.gameplay.dancing ? '🕺' : 'WALK';
      if (this.elRpmFill) this.elRpmFill.style.width = `${Math.min(100, kmh * 3)}%`;
    }

    if (this.elBoostFill) {
      this.elBoostFill.style.width = `${Math.round(this.gameplay.boostEnergy * 100)}%`;
    }

    if (this.elPrompt) {
      this.elPrompt.textContent = this.gameplay.interactionPrompt;
    }

    // 6. Render Minimap
    this.drawMinimap(trafficCars);
  }

  drawMinimap(trafficCars) {
    const ctx = this.minimapCtx;
    if (!ctx) return;

    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = 1.05; // 1 world meter = 1.05 minimap px

    ctx.clearRect(0, 0, w, h);

    // Circular radar background
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = 'rgba(5, 9, 20, 0.9)';
    ctx.fillRect(0, 0, w, h);

    const pos = this.gameplay.activePos;
    const yaw = this.gameplay.activeYaw;

    // Rotate radar so player's heading is UP (-Y on canvas)
    ctx.translate(cx, cy);
    ctx.rotate(yaw - Math.PI);

    // Draw city roads
    ctx.strokeStyle = 'rgba(28, 52, 88, 0.95)';
    ctx.lineWidth = 14 * scale;
    for (const r of ROADS) {
      // Horizontal road (z = r)
      ctx.beginPath();
      ctx.moveTo((-CITY_HALF - pos.x) * scale, (r - pos.z) * scale);
      ctx.lineTo((CITY_HALF - pos.x) * scale, (r - pos.z) * scale);
      ctx.stroke();

      // Vertical road (x = r)
      ctx.beginPath();
      ctx.moveTo((r - pos.x) * scale, (-CITY_HALF - pos.z) * scale);
      ctx.lineTo((r - pos.x) * scale, (CITY_HALF - pos.z) * scale);
      ctx.stroke();
    }

    // Road center neon lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.lineWidth = 1;
    for (const r of ROADS) {
      ctx.beginPath();
      ctx.moveTo((-CITY_HALF - pos.x) * scale, (r - pos.z) * scale);
      ctx.lineTo((CITY_HALF - pos.x) * scale, (r - pos.z) * scale);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo((r - pos.x) * scale, (-CITY_HALF - pos.z) * scale);
      ctx.lineTo((r - pos.x) * scale, (CITY_HALF - pos.z) * scale);
      ctx.stroke();
    }

    // Draw AI traffic blips
    ctx.fillStyle = 'rgba(255, 230, 0, 0.65)';
    for (const tc of trafficCars) {
      const tx = (tc.mesh.position.x - pos.x) * scale;
      const tz = (tc.mesh.position.z - pos.z) * scale;
      if (tx * tx + tz * tz < cx * cx) {
        ctx.fillRect(tx - 1.5, tz - 1.5, 3, 3);
      }
    }

    // Draw Enterable Venues (PULSE Nightclub, AFTERGLOW Bar, CHROME WORKS Garage)
    for (const v of VENUES) {
      const vx = (v.cx - pos.x) * scale;
      const vz = (v.cz - pos.z) * scale;
      const vw = (v.x1 - v.x0) * scale;
      const vd = (v.z1 - v.z0) * scale;
      ctx.fillStyle = v.color + '44';
      ctx.strokeStyle = v.color;
      ctx.lineWidth = 1.6;
      ctx.fillRect(vx - vw / 2, vz - vd / 2, vw, vd);
      ctx.strokeRect(vx - vw / 2, vz - vd / 2, vw, vd);

      // Door marker dot
      const dx = (v.doorX - pos.x) * scale;
      const dz = (v.doorZ - pos.z) * scale;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(dx, dz, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // If walking, draw parked player car icon
    if (this.gameplay.mode === 'walking') {
      const px = (this.gameplay.carPos.x - pos.x) * scale;
      const pz = (this.gameplay.carPos.z - pos.z) * scale;
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.arc(px, pz, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Draw center player directional chevron (always pointing UP)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#00f0ff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Outer neon ring border
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}
