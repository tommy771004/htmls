// Groundline（267）主控制器：串接模擬核心、Three.js 3D 停機坪場景、精簡液態玻璃 UI 與測試 API

import {
  STEPS,
  GATES,
  createWorld,
  stepWorld,
  getMetrics,
  formatClock,
  dispatchVehicleToFlight,
  setFlightPriority,
  reassignFlightGate,
  triggerSampleDelay,
} from './sim.js';
import { createApronScene } from './scene.js';
import { playTone, isMuted, setMuted } from './audio.js';

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const world = createWorld(26701);
let sceneApi = null;

function overallFlightProgress(f) {
  if (f.state === 'departed') return 100;
  if (f.state !== 'active') return 0;
  const totalSteps = f.steps.length;
  const raw = (f.stepIndex + (f.steps[f.stepIndex]?.progress || 0)) / totalSteps;
  return Math.round(Math.max(0, Math.min(100, raw * 100)));
}

function renderTopKPIs() {
  const m = getMetrics(world);
  $('kpiOntime').textContent = `${m.onTimeRate.toFixed(1)}%`;
  $('kpiTurn').textContent = `${m.avgTurnaround.toFixed(1)}m`;
  $('kpiGates').textContent = `${m.activeGates}/${m.totalGates}`;
  $('kpiGateDots').innerHTML = GATES.map((g) => {
    const f = world.flights.find((x) => x.gateId === g.id && x.state === 'active');
    const delayed = f && (f.etd - f.std > 3 || f.ownDelay > 0);
    const cls = f ? (delayed ? 'gdot warn' : 'gdot on') : 'gdot';
    return `<button type="button" class="${cls}" data-focus-gate="${g.id}" title="${g.id}: ${f ? f.callsign : '空閒'}">${g.id}</button>`;
  }).join('');

  $('kpiBags').textContent = m.totalBags.toLocaleString('en-US');

  // 右上時鐘與倍速狀態
  $('simClock').textContent = formatClock(world.clockMins);
  document.querySelectorAll('[data-speed]').forEach((btn) => {
    const s = Number(btn.getAttribute('data-speed'));
    btn.setAttribute('aria-pressed', String(s === world.speed));
  });
}

function renderTimelinePanel() {
  let f = world.flights.find((x) => x.id === world.selectedFlightId);
  if (!f) {
    f = world.flights.find((x) => x.state === 'active') || world.flights[0];
    world.selectedFlightId = f.id;
  }

  const dest = (f.route.split('→')[1] || f.route).trim();
  $('tlGate').textContent = f.gateId;
  $('tlCallsign').textContent = f.callsign;
  $('tlMeta').textContent = `${f.acType} · ${dest}`;
  $('tlSched').textContent = `${formatClock(f.sta)}→${formatClock(f.etd)}`;

  const totalDelay = Math.max(0, f.etd - f.std);
  const badge = $('tlDelayBadge');
  if (f.state === 'departed') {
    badge.textContent = '已離場';
    badge.className = 'badge good';
  } else if (f.cascadeDelay > 0) {
    badge.textContent = `↳ +${totalDelay}m`;
    badge.className = 'badge warn';
  } else if (totalDelay > 2) {
    badge.textContent = `+${totalDelay}m`;
    badge.className = 'badge warn';
  } else {
    badge.textContent = '準點';
    badge.className = 'badge good';
  }

  // 優先順序按鈕狀態
  document.querySelectorAll('[data-set-prio]').forEach((b) => {
    const p = Number(b.getAttribute('data-set-prio'));
    b.setAttribute('aria-pressed', String(f.priority === p));
  });

  // 僅在發生連鎖延誤時顯示極簡警示膠囊
  const nextAtGate = world.flights
    .filter((x) => x.id !== f.id && x.gateId === f.gateId && x.state !== 'departed' && x.sta >= f.sta)
    .sort((a, b) => a.sta - b.sta)[0];

  const chainBox = $('tlChainAlert');
  if (nextAtGate && nextAtGate.cascadeDelay > 0) {
    const freeGate = GATES.find(
      (g) => !world.flights.some((other) => other.gateId === g.id && other.state === 'active')
    );
    chainBox.hidden = false;
    chainBox.innerHTML =
      `<span>↳ ${esc(nextAtGate.callsign)} +${nextAtGate.cascadeDelay}m</span>` +
      (freeGate
        ? `<button type="button" class="mini-act" data-reassign-flight="${nextAtGate.id}" data-reassign-gate="${freeGate.id}">改${freeGate.id}</button>`
        : `<button type="button" class="mini-act" data-select-flight="${nextAtGate.id}">查看</button>`);
  } else if (f.cascadeDelay > 0 && f.cascadeFrom) {
    chainBox.hidden = false;
    chainBox.innerHTML =
      `<span>↳ 受 ${esc(f.cascadeFrom)} +${f.cascadeDelay}m</span>` +
      `<button type="button" class="mini-act" data-select-flight="${esc(f.cascadeFrom)}">前班</button>`;
  } else {
    chainBox.hidden = true;
    chainBox.innerHTML = '';
  }

  // 渲染 6 個過站步驟時間軸：到站→下客→清潔→加油→登機→推出
  $('tlSteps').innerHTML = f.steps
    .map((st, idx) => {
      const def = STEPS[idx];
      const pct = Math.round(st.progress * 100);
      const isCur = f.state === 'active' && f.stepIndex === idx;
      const isDone = st.status === 'done' || f.state === 'departed';
      const cls = [
        'tl-step',
        isDone ? 'done' : isCur ? 'active' : 'pending',
        st.delayed ? 'delayed' : '',
      ]
        .filter(Boolean)
        .join(' ');

      let vehHtml = '';
      if (def.vehType) {
        const assignedV = st.assignedVehicleId
          ? world.vehicles.find((v) => v.id === st.assignedVehicleId)
          : null;
        if (assignedV && assignedV.assignedFlightId === f.id) {
          vehHtml = `<span class="v-tag on">${esc(assignedV.id)}</span>`;
        } else if (!isDone && f.state === 'active') {
          vehHtml = `<button type="button" class="mini-act dispatch" data-dispatch-type="${def.vehType}" data-dispatch-flight="${f.id}">+派車</button>`;
        }
      }

      const timeStr = st.extraDelayMins > 0
        ? `${st.plannedMins}+${st.extraDelayMins}m`
        : `${st.plannedMins}m`;

      return `<div class="${cls}">
        <div class="st-top">
          <span class="st-idx">${idx + 1}</span>
          <b class="st-name">${esc(def.label)}</b>
          <span class="st-time">${timeStr}</span>
        </div>
        <div class="st-foot">
          <div class="st-bar"><i style="width:${isDone ? 100 : pct}%"></i></div>
          ${vehHtml}
        </div>
      </div>`;
    })
    .join('');
}

function renderRightTabs() {
  document.querySelectorAll('[data-tab]').forEach((b) => {
    b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === world.activeTab));
  });

  const activeFlightsCount = world.flights.filter((f) => f.state !== 'departed').length;
  const busyVehCount = world.vehicles.filter((v) => v.state !== 'idle').length;
  const busyGateCount = GATES.filter((g) =>
    world.flights.some((f) => f.gateId === g.id && f.state === 'active')
  ).length;

  $('tabCntFlights').textContent = String(activeFlightsCount);
  $('tabCntVehicles').textContent = `${busyVehCount}/${world.vehicles.length}`;
  $('tabCntGates').textContent = `${busyGateCount}/${GATES.length}`;

  const container = $('tabBody');

  if (world.activeTab === 'flights') {
    const list = world.flights.filter((f) => f.state !== 'departed').slice(0, 10);
    container.innerHTML = list
      .map((f) => {
        const isSel = f.id === world.selectedFlightId;
        const pct = overallFlightProgress(f);
        const curDef = STEPS[f.stepIndex] || STEPS[0];
        const totalDelay = Math.max(0, f.etd - f.std);
        let stateLabel = '';
        if (f.state === 'active') {
          stateLabel = `${curDef.label} ${pct}%`;
        } else if (f.state === 'holding') {
          stateLabel = `等待 ${f.gateId}`;
        } else {
          stateLabel = formatClock(f.sta);
        }

        const delayPill = f.cascadeDelay > 0
          ? `<span class="pill warn">↳+${totalDelay}m</span>`
          : totalDelay > 2
          ? `<span class="pill warn">+${totalDelay}m</span>`
          : `<span class="pill good">準點</span>`;

        const prioLabel = f.priority === 3 ? '★' : f.priority === 2 ? '▲' : '普';

        return `<div class="list-row ${isSel ? 'sel' : ''}" data-select-flight="${f.id}">
          <span class="gate-chip">${f.gateId}</span>
          <b class="callsign">${esc(f.callsign)}</b>
          <span class="step-txt">${esc(stateLabel)}</span>
          <div class="prog-bar"><i style="width:${pct}%"></i></div>
          ${delayPill}
          <button type="button" class="prio-btn p${f.priority}" data-cycle-prio="${f.id}" title="切換優先順序">${prioLabel}</button>
        </div>`;
      })
      .join('');
  } else if (world.activeTab === 'vehicles') {
    const selF = world.flights.find((x) => x.id === world.selectedFlightId);
    container.innerHTML = world.vehicles
      .map((v) => {
        const pct = Math.round((v.progress || 0) * 100);
        let statusTxt = '待命';
        if (v.state === 'servicing') statusTxt = `${v.assignedGateId} · ${v.assignedFlightId}`;
        else if (v.state === 'enroute') statusTxt = `→ ${v.assignedGateId}`;
        else if (v.state === 'returning') statusTxt = '返站';
        else if (v.state === 'refilling') statusTxt = `補油 ${Math.round(v.fuelPct)}%`;

        const canAssign = selF && selF.state === 'active';
        return `<div class="list-row veh-row" data-focus-veh="${v.id}">
          <span class="veh-badge ${v.type}">${esc(v.typeLabel)}</span>
          <b class="callsign">${esc(v.id)}</b>
          <span class="step-txt">${esc(statusTxt)}</span>
          <div class="prog-bar"><i style="width:${pct}%"></i></div>
          ${v.type === 'fuel' ? `<span class="pill ${v.fuelPct < 35 ? 'warn' : 'good'}">${Math.round(v.fuelPct)}%</span>` : ''}
          ${canAssign ? `<button type="button" class="mini-act" data-assign-veh="${v.id}" data-assign-flight="${selF.id}">派往</button>` : ''}
        </div>`;
      })
      .join('');
  } else {
    // 登機門分頁 (G1–G5)
    container.innerHTML = GATES.map((g) => {
      const activeF = world.flights.find((f) => f.gateId === g.id && f.state === 'active');
      const nextF = world.flights
        .filter((f) => f.gateId === g.id && f.state !== 'departed' && f !== activeF)
        .sort((a, b) => a.sta - b.sta)[0];
      const pct = activeF ? overallFlightProgress(activeF) : 0;
      const curStep = activeF ? STEPS[activeF.stepIndex]?.label : '空閒';

      return `<div class="list-row gate-row" data-focus-gate="${g.id}">
        <span class="gate-chip">${g.id}</span>
        <b class="callsign">${activeF ? esc(activeF.callsign) : '空閒'}</b>
        <span class="step-txt">${esc(curStep)}${nextF ? ` → ${esc(nextF.callsign)}` : ''}</span>
        <div class="prog-bar"><i style="width:${pct}%"></i></div>
        ${nextF && nextF.cascadeDelay > 0 ? `<span class="pill warn">↳+${nextF.cascadeDelay}m</span>` : `<span class="pill ${activeF ? 'good' : ''}">${pct}%</span>`}
      </div>`;
    }).join('');
  }
}

function renderApronFloatingLabels() {
  if (!sceneApi) return;
  const host = $('apronLabels');
  const activeList = world.flights.filter((f) => f.pose && f.pose.visible);
  host.innerHTML = activeList
    .map((f) => {
      const scr = sceneApi.projectToScreen(f.pose.x, 6.2, f.pose.z);
      if (!scr.visible || scr.x < 10 || scr.x > window.innerWidth - 10 || scr.y < 40 || scr.y > window.innerHeight - 40) {
        return '';
      }
      const isSel = f.id === world.selectedFlightId;
      const stepLbl = f.state === 'holding' ? '等待' : STEPS[f.stepIndex]?.label || '';
      const delay = Math.max(0, f.etd - f.std);
      const cls = [
        'apron-tag',
        isSel ? 'sel' : '',
        delay > 3 || f.state === 'holding' ? 'warn' : '',
      ]
        .filter(Boolean)
        .join(' ');
      const extraBtns = isSel
        ? `<span class="at-act" data-closeup-flight="${f.id}" title="近景檢視飛機細節">🔍</span>` +
          `<span class="at-act" data-action="inspect-doors" title="開啟／關閉艙門與行李輸送帶">🚪</span>`
        : '';
      return `<div role="button" tabindex="0" class="${cls}" style="transform:translate3d(${scr.x.toFixed(1)}px,${scr.y.toFixed(1)}px,0)" data-select-flight="${f.id}">
        <span class="at-gate">${f.gateId}</span>
        <b>${esc(f.callsign)}</b>
        <span class="at-step">${esc(stepLbl)}</span>
        ${delay > 2 ? `<em class="at-dly">+${delay}m</em>` : ''}
        ${extraBtns}
      </div>`;
    })
    .join('');
}

function renderAllUI() {
  renderTopKPIs();
  renderTimelinePanel();
  renderRightTabs();
  renderApronFloatingLabels();
}

function selectFlight(flightId, focusCam = false) {
  const f = world.flights.find((x) => x.id === flightId);
  if (!f) return;
  world.selectedFlightId = f.id;
  playTone('click');
  if (focusCam && sceneApi) {
    sceneApi.focusFlight(f.id);
  }
  renderAllUI();
}

// 下載內嵌的 glTF (GLB) 資產檔案
async function downloadGLTF() {
  const el = document.getElementById('glb-groundline');
  if (!el) return;
  const bin = Uint8Array.from(atob(el.textContent.trim()), (c) => c.charCodeAt(0));
  const ab = await new Response(
    new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))
  ).arrayBuffer();
  const blob = new Blob([ab], { type: 'model/gltf-binary' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'groundline-apron-assets.glb';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// 全局事件代理
document.addEventListener('click', (e) => {
  const btn = e.target.closest(
    '[data-speed],[data-tab],[data-select-flight],[data-closeup-flight],[data-set-prio],[data-cycle-prio],[data-dispatch-type],[data-assign-veh],[data-focus-gate],[data-reassign-flight],[data-cam],[data-action]'
  );
  if (!btn) return;

  if (btn.hasAttribute('data-closeup-flight')) {
    e.stopPropagation();
    const fid = btn.getAttribute('data-closeup-flight');
    world.selectedFlightId = fid;
    if (sceneApi) sceneApi.focusFlight(fid, true);
    playTone('click');
    renderAllUI();
    return;
  }

  if (btn.hasAttribute('data-speed')) {
    world.speed = Number(btn.getAttribute('data-speed'));
    playTone('click');
    renderAllUI();
    return;
  }

  if (btn.hasAttribute('data-tab')) {
    world.activeTab = btn.getAttribute('data-tab');
    playTone('click');
    renderRightTabs();
    return;
  }

  if (btn.hasAttribute('data-cycle-prio')) {
    e.stopPropagation();
    const fid = btn.getAttribute('data-cycle-prio');
    const f = world.flights.find((x) => x.id === fid);
    if (f) {
      const nextP = f.priority === 3 ? 1 : f.priority + 1;
      setFlightPriority(world, fid, nextP);
      playTone('dispatch');
      renderAllUI();
    }
    return;
  }

  if (btn.hasAttribute('data-set-prio')) {
    const p = Number(btn.getAttribute('data-set-prio'));
    setFlightPriority(world, world.selectedFlightId, p);
    playTone('dispatch');
    renderAllUI();
    return;
  }

  if (btn.hasAttribute('data-dispatch-type')) {
    e.stopPropagation();
    const vType = btn.getAttribute('data-dispatch-type');
    const fid = btn.getAttribute('data-dispatch-flight') || world.selectedFlightId;
    const cand =
      world.vehicles.find((v) => v.type === vType && v.state === 'idle') ||
      world.vehicles.find((v) => v.type === vType);
    if (cand) {
      dispatchVehicleToFlight(world, cand.id, fid, true);
      playTone('dispatch');
      renderAllUI();
    }
    return;
  }

  if (btn.hasAttribute('data-assign-veh')) {
    e.stopPropagation();
    const vid = btn.getAttribute('data-assign-veh');
    const fid = btn.getAttribute('data-assign-flight') || world.selectedFlightId;
    if (dispatchVehicleToFlight(world, vid, fid, true)) {
      playTone('dispatch');
      renderAllUI();
    }
    return;
  }

  if (btn.hasAttribute('data-reassign-flight')) {
    e.stopPropagation();
    const fid = btn.getAttribute('data-reassign-flight');
    const gid = btn.getAttribute('data-reassign-gate');
    if (reassignFlightGate(world, fid, gid)) {
      playTone('dispatch');
      renderAllUI();
    }
    return;
  }

  if (btn.hasAttribute('data-focus-gate')) {
    const gid = btn.getAttribute('data-focus-gate');
    const f = world.flights.find((x) => x.gateId === gid && x.state === 'active');
    if (f) world.selectedFlightId = f.id;
    if (sceneApi) sceneApi.focusGate(gid);
    playTone('click');
    renderAllUI();
    return;
  }

  if (btn.hasAttribute('data-select-flight')) {
    const fid = btn.getAttribute('data-select-flight');
    selectFlight(fid, false);
    return;
  }

  if (btn.hasAttribute('data-cam')) {
    const preset = btn.getAttribute('data-cam');
    if (sceneApi) sceneApi.setCameraPreset(preset);
    playTone('click');
    return;
  }

  if (btn.hasAttribute('data-action')) {
    const act = btn.getAttribute('data-action');
    if (act === 'inject-delay') {
      triggerSampleDelay(world, world.selectedFlightId);
      playTone('warn');
      renderAllUI();
    } else if (act === 'mute') {
      const m = setMuted(!isMuted());
      btn.setAttribute('aria-pressed', String(m));
      btn.textContent = m ? '🔇' : '🔊';
    } else if (act === 'download-gltf') {
      downloadGLTF();
    } else if (act === 'cutaway') {
      if (sceneApi) {
        const on = sceneApi.toggleTerminalCutaway();
        btn.setAttribute('aria-pressed', String(on));
        if (on) sceneApi.setCameraPreset('terminal');
        playTone('click');
      }
    } else if (act === 'night') {
      if (sceneApi) {
        sceneApi.triggerTowerAction();
        btn.setAttribute('aria-pressed', String(sceneApi.envState.nightMode));
        playTone('dispatch');
      }
    } else if (act === 'inspect-doors') {
      e.stopPropagation();
      if (sceneApi) {
        sceneApi.toggleInspectDoors();
        sceneApi.focusFlight(world.selectedFlightId, true);
        playTone('click');
      }
    }
  }
});

async function boot() {
  const canvas = $('glCanvas');
  const hoverTip = $('hoverTip');
  sceneApi = await createApronScene(canvas, world, {
    onSelectFlight(fid) {
      selectFlight(fid, false);
    },
    onSelectVehicle(vid) {
      world.activeTab = 'vehicles';
      playTone('click');
      renderAllUI();
    },
    onDirectDispatchVehicle(vid, fid) {
      if (dispatchVehicleToFlight(world, vid, fid, true)) {
        world.selectedFlightId = fid;
        playTone('dispatch');
        renderAllUI();
      }
    },
    onInteractBuilding(kind) {
      if (kind === 'terminal') {
        const cutBtn = document.querySelector('[data-action="cutaway"]');
        if (cutBtn && sceneApi) cutBtn.setAttribute('aria-pressed', String(sceneApi.envState.terminalCutaway));
        playTone('click');
      } else if (kind === 'tower') {
        const nightBtn = document.querySelector('[data-action="night"]');
        if (nightBtn && sceneApi) nightBtn.setAttribute('aria-pressed', String(sceneApi.envState.nightMode));
        playTone('dispatch');
      } else if (kind === 'fuelfarm') {
        playTone('dispatch');
        renderAllUI();
      } else if (kind === 'depot') {
        const idleV = world.vehicles.find((v) => v.state === 'idle');
        if (idleV && world.selectedFlightId) {
          dispatchVehicleToFlight(world, idleV.id, world.selectedFlightId, true);
          playTone('dispatch');
          renderAllUI();
        }
      } else if (kind === 'gate') {
        playTone('click');
        renderAllUI();
      }
    },
    onHover3D(info) {
      if (!hoverTip) return;
      if (!info || !info.label) {
        hoverTip.hidden = true;
        return;
      }
      let txt = info.label;
      if (sceneApi && sceneApi.envState.selectedVehicleId && info.pickType === 'flight') {
        txt = `點擊將已選地勤車 ${sceneApi.envState.selectedVehicleId} 派往 ${info.flightId}`;
      }
      hoverTip.textContent = txt;
      hoverTip.hidden = false;
      const x = Math.min(window.innerWidth - 260, Math.max(12, info.clientX + 14));
      const y = Math.min(window.innerHeight - 40, Math.max(12, info.clientY - 28));
      hoverTip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    },
  });

  renderAllUI();

  let lastMs = performance.now();
  let uiAccum = 0;

  function loop(nowMs) {
    const dtSec = Math.min(0.1, (nowMs - lastMs) / 1000);
    lastMs = nowMs;

    if (world.speed > 0) {
      const dtSimMins = dtSec * 0.35 * world.speed;
      stepWorld(world, dtSimMins);
    }

    sceneApi.syncScene(nowMs);
    renderApronFloatingLabels();

    uiAccum += dtSec;
    if (uiAccum >= 0.2) {
      uiAccum = 0;
      renderTopKPIs();
      renderTimelinePanel();
      renderRightTabs();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // 暴露測試與自動化驗證 API
  window.__gl = {
    ready: true,
    world,
    scene: sceneApi,
    getMetrics: () => getMetrics(world),
    step(mins = 1) {
      const steps = Math.max(1, Math.ceil(mins / 0.25));
      const dt = mins / steps;
      for (let i = 0; i < steps; i++) stepWorld(world, dt);
      sceneApi.syncScene(performance.now());
      renderAllUI();
      return getMetrics(world);
    },
    selectFlight(id, focus = false) {
      selectFlight(id, focus);
    },
    setSpeed(s) {
      world.speed = s;
      renderAllUI();
    },
    setTab(t) {
      world.activeTab = t;
      renderRightTabs();
    },
    setPriority(fid, p) {
      const ok = setFlightPriority(world, fid, p);
      renderAllUI();
      return ok;
    },
    dispatchVehicle(vid, fid) {
      const ok = dispatchVehicleToFlight(world, vid, fid, true);
      renderAllUI();
      return ok;
    },
    reassignGate(fid, gid) {
      const ok = reassignFlightGate(world, fid, gid);
      renderAllUI();
      return ok;
    },
    triggerDelay(fid) {
      const f = triggerSampleDelay(world, fid);
      renderAllUI();
      return f;
    },
  };
}

boot();
