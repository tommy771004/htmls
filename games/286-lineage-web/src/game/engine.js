// 286 天堂實境客戶端：Canvas 等距主迴圈、攝影機、物件深排序與遮蔽半透明、鼠鍵操控與診斷快照
import { assetUrl } from '../app.js';
import { GameAssetLoader, GameAudioManager } from './assets.js';
import { LineageIsoMap, tileToWorld, worldToTile, tileDistance, HEADING_DELTAS } from './map-iso.js';
import { SpriteRenderer } from './sprites.js';
import { LineageWorld } from './world-state.js';
import { AutoHuntController } from './auto-hunt.js';
import { GameHud } from './hud.js';

export class LineageGameEngine {
  constructor({ mountEl, worldData, character, username, onLobbySync, onReturnToSelect }) {
    this.mountEl = mountEl;
    this.worldData = worldData;
    this.disposed = false;

    this.rootEl = document.createElement('div');
    this.rootEl.id = 'll-game-root';
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'll-canvas';
    this.rootEl.appendChild(this.canvas);
    this.mountEl.appendChild(this.rootEl);

    this.ctx = this.canvas.getContext('2d');
    this.assets = new GameAssetLoader(worldData);
    this.isoMap = new LineageIsoMap(worldData, this.assets);
    this.sprites = new SpriteRenderer(worldData, this.assets);
    this.audio = new GameAudioManager(this.assets);
    this.sprites.preloadEffects();

    this.world = new LineageWorld({
      worldData,
      isoMap: this.isoMap,
      sprites: this.sprites,
      audio: this.audio,
      character,
      username,
      onLobbySync,
    });
    this.autoHunt = new AutoHuntController(this.world);
    this.hud = new GameHud({
      rootEl: this.rootEl,
      world: this.world,
      autoHunt: this.autoHunt,
      onReturnToSelect,
      onActionNearest: (kind) => this.actionNearest(kind),
    });
    this.assets.hydrateSpellIcons(this.worldData, () => this.hud?.sync(true));

    this.world.player.onNpcReady = (npc) => this.hud.openNpc(npc);

    this.viewW = 1280;
    this.viewH = 720;
    this.dpr = 1;
    this.userZoomFactor = 1;
    this.cameraZoom = 1.62;
    this.camX = this.world.player.worldX;
    this.camY = this.world.player.worldY + 32;
    this.hoverTile = null;
    this.hoverEntity = null;
    this.cursorKind = 'arrow';

    this.lastFrameAt = performance.now();
    this.rafId = 0;

    this.#bindEvents();
    this.#handleResize();
    this.isoMap.ensureVisibleChunks(this.world.player.map, this.world.player.tx, this.world.player.ty);
    this.audio.update(this.world);
    this.loop = this.loop.bind(this);
    this.rafId = requestAnimationFrame(this.loop);
  }

  #computeCameraZoom() {
    const minSide = Math.min(this.viewW || 1280, this.viewH || 720);
    const base =
      this.viewW >= 1100
        ? 1.62
        : this.viewW >= 700
          ? 1.48
          : Math.max(1.25, Math.min(1.42, minSide / 310));
    return Math.max(1.15, Math.min(2.05, Number((base * (this.userZoomFactor || 1)).toFixed(3))));
  }

  #bindEvents() {
    this._onResize = () => this.#handleResize();
    this._onPointerMove = (ev) => this.#handlePointerMove(ev);
    this._onPointerUp = (ev) => this.#handlePointerUp(ev);
    this._onPointerDown = (ev) => {
      this._downPos = { x: ev.clientX, y: ev.clientY };
      this.audio?.unlock(this.world);
    };
    this._onKeyDown = (ev) => this.#handleKeyDown(ev);
    this._onWheel = (ev) => {
      if (this.hud.activeModal) return;
      if (Math.abs(ev.deltaY) < 2) return;
      ev.preventDefault();
      const factor = ev.deltaY < 0 ? 1.08 : 0.92;
      this.userZoomFactor = Math.max(0.76, Math.min(1.28, (this.userZoomFactor || 1) * factor));
      this.cameraZoom = this.#computeCameraZoom();
    };

    window.addEventListener('resize', this._onResize);
    window.addEventListener('keydown', this._onKeyDown);
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    this.canvas.addEventListener('pointermove', this._onPointerMove);
    this.canvas.addEventListener('pointerup', this._onPointerUp);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
    this.canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }

  #handleResize() {
    if (this.disposed) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.viewW = Math.max(320, window.innerWidth);
    this.viewH = Math.max(240, window.innerHeight);
    this.cameraZoom = this.#computeCameraZoom();
    this.canvas.width = Math.round(this.viewW * this.dpr);
    this.canvas.height = Math.round(this.viewH * this.dpr);
  }

  #canvasCoords(ev) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      sx: ev.clientX - rect.left,
      sy: ev.clientY - rect.top,
    };
  }

  #pickAtScreen(sx, sy) {
    const zoom = this.cameraZoom || 1.62;
    const visW = this.viewW / zoom;
    const visH = this.viewH / zoom;
    const camLeft = this.camX - visW / 2;
    const camTop = this.camY - visH / 2;
    const wx = camLeft + sx / zoom;
    const wy = camTop + sy / zoom;

    // 1. 優先偵測活著的怪物（點擊身體範圍）
    let bestMob = null;
    let bestMobScore = 1e9;
    for (const m of this.world.mobs) {
      if (m.hp <= 0) continue;
      const dx = Math.abs(wx - m.worldX);
      const dy = wy - m.worldY;
      if (dx <= 26 && dy >= -68 && dy <= 14) {
        const d = Math.hypot(dx, dy + 24);
        if (d < bestMobScore) {
          bestMobScore = d;
          bestMob = m;
        }
      }
    }
    if (bestMob) return { kind: 'mob', entity: bestMob };

    // 2. NPC
    let bestNpc = null;
    let bestNpcScore = 1e9;
    for (const n of this.world.npcs) {
      const dx = Math.abs(wx - n.worldX);
      const dy = wy - n.worldY;
      if (dx <= 26 && dy >= -68 && dy <= 14) {
        const d = Math.hypot(dx, dy + 24);
        if (d < bestNpcScore) {
          bestNpcScore = d;
          bestNpc = n;
        }
      }
    }
    if (bestNpc) return { kind: 'npc', entity: bestNpc };

    // 3. 地面掉落物
    for (const d of this.world.drops) {
      if (Math.abs(wx - d.worldX) <= 20 && Math.abs(wy - d.worldY) <= 14) {
        return { kind: 'drop', entity: d };
      }
    }

    // 4. 等距地面格座標
    const ft = worldToTile(wx, wy);
    return { kind: 'tile', tx: Math.round(ft.x), ty: Math.round(ft.y) };
  }

  #handlePointerMove(ev) {
    const { sx, sy } = this.#canvasCoords(ev);
    const hit = this.#pickAtScreen(sx, sy);
    let nextCursor = 'arrow';
    if (hit.kind === 'mob' || (hit.kind === 'npc' && hit.entity.type === 'TrainingDummy')) {
      this.hoverEntity = hit.entity.id;
      this.hoverTile = { x: hit.entity.tx ?? hit.entity.x, y: hit.entity.ty ?? hit.entity.y };
      nextCursor = 'attack';
    } else if (hit.kind === 'npc' || hit.kind === 'drop') {
      this.hoverEntity = hit.entity.id;
      this.hoverTile = { x: hit.entity.tx ?? hit.entity.x, y: hit.entity.ty ?? hit.entity.y };
      nextCursor = 'talk';
    } else {
      this.hoverEntity = null;
      this.hoverTile = { x: hit.tx, y: hit.ty };
    }

    if (nextCursor !== this.cursorKind) {
      this.cursorKind = nextCursor;
      const curPath = `/lineage163/cursors/${nextCursor}.cur`;
      this.canvas.style.cursor = `url("${assetUrl(curPath)}") 4 4, ${nextCursor === 'attack' ? 'crosshair' : nextCursor === 'talk' ? 'pointer' : 'default'}`;
    }
  }

  #handlePointerUp(ev) {
    if (this._downPos) {
      const moved = Math.hypot(ev.clientX - this._downPos.x, ev.clientY - this._downPos.y);
      if (moved > 10) return;
    }
    const { sx, sy } = this.#canvasCoords(ev);
    const hit = this.#pickAtScreen(sx, sy);
    if (hit.kind === 'mob') {
      this.world.targetMob(hit.entity);
    } else if (hit.kind === 'npc') {
      const readyNpc = this.world.interactOrWalkToNpc(hit.entity);
      if (readyNpc) this.hud.openNpc(readyNpc);
    } else if (hit.kind === 'drop') {
      this.world.pickupOrWalkToDrop(hit.entity);
    } else if (hit.kind === 'tile') {
      this.world.setWalkTarget(hit.tx, hit.ty);
    }
    this.hud.sync(true);
  }

  #handleKeyDown(ev) {
    const tag = ev.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      if (ev.code === 'Escape') {
        ev.preventDefault();
        ev.target.blur();
      }
      return;
    }

    if (ev.code === 'Enter' && !this.hud.activeModal && this.hud.elements?.chatInput) {
      ev.preventDefault();
      this.hud.elements.chatInput.focus();
      return;
    }

    if (ev.code === 'Escape') {
      ev.preventDefault();
      if (this.hud.activeModal) this.hud.closeModal();
      else this.hud.toggleModal('system');
      return;
    }
    if (ev.code === 'KeyI' || ev.code === 'Tab') {
      ev.preventDefault();
      this.hud.toggleModal('inventory');
      return;
    }
    if (ev.code === 'KeyK') {
      this.hud.toggleModal('spells');
      return;
    }
    if (ev.code === 'KeyS' && !ev.ctrlKey && !ev.metaKey) {
      this.hud.toggleModal('status');
      return;
    }
    if (ev.code === 'KeyM') {
      this.hud.toggleModal('map');
      return;
    }
    if (ev.code === 'KeyH') {
      this.autoHunt.toggle();
      this.hud.sync(true);
      return;
    }
    if (ev.code === 'Space') {
      ev.preventDefault();
      this.actionNearest('attack');
      return;
    }

    const fnMatch = /^F([5-9]|1[0-2])$/.exec(ev.code);
    if (fnMatch) {
      ev.preventDefault();
      this.hud.triggerQuickbar(Number(fnMatch[1]) - 5);
      return;
    }
    const numMatch = /^Digit([1-8])$/.exec(ev.code);
    if (numMatch && !this.hud.activeModal) {
      this.hud.triggerQuickbar(Number(numMatch[1]) - 1);
      return;
    }

    // 方向鍵／WASD 微調移動
    const dirMap = {
      ArrowUp: [-1, -1],
      KeyW: [-1, -1],
      ArrowDown: [1, 1],
      KeyX: [1, 1],
      ArrowLeft: [-1, 1],
      KeyA: [-1, 1],
      ArrowRight: [1, -1],
      KeyD: [1, -1],
    };
    const delta = dirMap[ev.code];
    if (delta && !this.hud.activeModal) {
      ev.preventDefault();
      const p = this.world.player;
      const gx = p.tx + delta[0] * 2;
      const gy = p.ty + delta[1] * 2;
      if (this.isoMap.isWalkableTile(gx, gy, p.map)) {
        this.world.setWalkTarget(gx, gy);
      } else {
        for (const [dx, dy] of HEADING_DELTAS) {
          if (dx === delta[0] && dy === delta[1]) continue;
          if (this.isoMap.canStep(p.tx, p.ty, delta[0], delta[1], p.map)) {
            this.world.setWalkTarget(p.tx + delta[0], p.ty + delta[1]);
            break;
          }
        }
      }
    }
  }

  actionNearest(kind) {
    const p = this.world.player;
    if (kind === 'pickup') {
      const drop = this.world.drops
        .filter((d) => d.map === p.map)
        .sort((a, b) => tileDistance(p.tx, p.ty, a.tx, a.ty) - tileDistance(p.tx, p.ty, b.tx, b.ty))[0];
      if (drop) this.world.pickupOrWalkToDrop(drop);
      else this.world.addLog('周圍沒有可拾取的道具。', 'info');
      this.hud.sync(true);
      return;
    }

    const mob = this.world.mobs
      .filter((m) => m.hp > 0 && !m.isPassiveCritter)
      .sort((a, b) => tileDistance(p.tx, p.ty, a.tx, a.ty) - tileDistance(p.tx, p.ty, b.tx, b.ty))[0];
    const mobDist = mob ? tileDistance(p.tx, p.ty, mob.tx, mob.ty) : Infinity;
    const dummy = this.world.npcs
      .filter((n) => n.type === 'TrainingDummy')
      .sort((a, b) => tileDistance(p.tx, p.ty, a.x, a.y) - tileDistance(p.tx, p.ty, b.x, b.y))[0];
    const dummyDist = dummy ? tileDistance(p.tx, p.ty, dummy.x, dummy.y) : Infinity;

    if (dummy && p.level < 5 && dummyDist <= 10 && dummyDist < mobDist) {
      this.world.interactOrWalkToNpc(dummy);
    } else if (mob) {
      this.world.targetMob(mob);
    } else if (dummy) {
      this.world.interactOrWalkToNpc(dummy);
    } else {
      this.world.addLog('附近沒有可攻擊的怪物。', 'info');
    }
    this.hud.sync(true);
  }

  loop(now) {
    if (this.disposed) return;
    const dtMs = Math.min(80, Math.max(1, now - this.lastFrameAt));
    this.lastFrameAt = now;

    this.autoHunt.step(now);
    this.world.step(dtMs, now);
    this.audio.update(this.world, now);

    // 攝影機平滑跟隨主角，依縮放比例略微下移讓底部 HUD 不遮擋角色腳下
    const zoom = this.cameraZoom || 1.62;
    const targetCamX = this.world.player.worldX;
    const targetCamY = this.world.player.worldY + Math.round(52 / zoom);
    this.camX += (targetCamX - this.camX) * Math.min(1, dtMs * 0.014);
    this.camY += (targetCamY - this.camY) * Math.min(1, dtMs * 0.014);

    this.render(now);
    this.hud.sync(false);
    this.rafId = requestAnimationFrame(this.loop);
  }

  render(now) {
    const ctx = this.ctx;
    const p = this.world.player;
    const zoom = this.cameraZoom || 1.62;
    const visW = this.viewW / zoom;
    const visH = this.viewH / zoom;
    ctx.setTransform(this.dpr * zoom, 0, 0, this.dpr * zoom, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, visW, visH);

    const camLeft = this.camX - visW / 2;
    const camTop = this.camY - visH / 2;
    const neededChunks = this.isoMap.ensureVisibleChunks(p.map, p.tx, p.ty);

    // 1. 地面地磚層 (chunk 烘焙畫布)
    for (const ref of neededChunks) {
      const rec = this.isoMap.renderedChunks.get(ref.key);
      if (rec?.groundCanvas) {
        ctx.drawImage(rec.groundCanvas, Math.round(rec.worldX - camLeft), Math.round(rec.worldY - camTop));
      }
    }

    // 2. 平地裝飾層
    const renderList = [];
    for (const ref of neededChunks) {
      const rec = this.isoMap.renderedChunks.get(ref.key);
      if (!rec || rec.status !== 'ready') continue;
      for (const obj of rec.objects) {
        if (!obj.image) continue;
        const sx = obj.x - camLeft;
        const sy = obj.y - camTop;
        if (sx + obj.w < -64 || sy + obj.h < -64 || sx > visW + 64 || sy > visH + 64) {
          continue;
        }
        if (obj.isGroundFlat) {
          ctx.drawImage(obj.image, Math.round(sx), Math.round(sy));
        } else {
          renderList.push({ kind: 'obj', obj, sx, sy, sortY: obj.sortY });
        }
      }
    }

    // 3. 傳送點光圈與游標格提示
    for (const portal of this.worldData.portals || []) {
      if (portal.map !== p.map) continue;
      const wp = tileToWorld(portal.x, portal.y);
      const sx = wp.x - camLeft;
      const sy = wp.y - camTop;
      if (sx < -40 || sy < -40 || sx > visW + 40 || sy > visH + 40) continue;
      const pulse = 0.55 + Math.sin(now * 0.005) * 0.25;
      ctx.save();
      ctx.strokeStyle = `rgba(96, 218, 255, ${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 11);
      ctx.lineTo(sx + 22, sy);
      ctx.lineTo(sx, sy + 11);
      ctx.lineTo(sx - 22, sy);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    if (this.hoverTile) {
      const hw = tileToWorld(this.hoverTile.x, this.hoverTile.y);
      const sx = hw.x - camLeft;
      const sy = hw.y - camTop;
      ctx.save();
      ctx.strokeStyle = this.isoMap.isWalkableTile(this.hoverTile.x, this.hoverTile.y, p.map)
        ? 'rgba(255, 224, 130, 0.55)'
        : 'rgba(248, 113, 113, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy - 12);
      ctx.lineTo(sx + 24, sy);
      ctx.lineTo(sx, sy + 12);
      ctx.lineTo(sx - 24, sy);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // 4. 地面戰利品掉落物
    for (const drop of this.world.drops) {
      if (drop.map !== p.map) continue;
      const sx = drop.worldX - camLeft;
      const sy = drop.worldY - camTop;
      if (sx < -40 || sy < -40 || sx > visW + 40 || sy > visH + 40) continue;
      this.sprites.drawGroundDrop(ctx, drop, sx, sy);
    }

    // 5. 深排序實體：3D 建築樹木 + NPC + 怪物 + 玩家
    for (const npc of this.world.npcs) {
      const sx = npc.worldX - camLeft;
      const sy = npc.worldY - camTop;
      if (sx < -120 || sy < -160 || sx > visW + 120 || sy > visH + 160) continue;
      renderList.push({ kind: 'npc', npc, sx, sy, sortY: npc.worldY });
    }

    for (const mob of this.world.mobs) {
      const sx = mob.worldX - camLeft;
      const sy = mob.worldY - camTop;
      if (sx < -120 || sy < -160 || sx > visW + 120 || sy > visH + 160) continue;
      renderList.push({ kind: 'mob', mob, sx, sy, sortY: mob.worldY });
    }

    renderList.push({
      kind: 'player',
      sx: p.worldX - camLeft,
      sy: p.worldY - camTop,
      sortY: p.worldY,
    });

    if (p.pet && p.pet.hp > 0 && p.pet.map === p.map) {
      const psx = p.pet.worldX - camLeft;
      const psy = p.pet.worldY - camTop;
      if (psx >= -120 && psy >= -160 && psx <= visW + 120 && psy <= visH + 160) {
        renderList.push({ kind: 'pet', pet: p.pet, sx: psx, sy: psy, sortY: p.pet.worldY });
      }
    }

    for (const peer of this.world.remotePeers || []) {
      if (peer.map !== p.map) continue;
      const rsx = peer.worldX - camLeft;
      const rsy = peer.worldY - camTop;
      if (rsx < -120 || rsy < -160 || rsx > visW + 120 || rsy > visH + 160) continue;
      renderList.push({ kind: 'peer', peer, sx: rsx, sy: rsy, sortY: peer.worldY });
    }

    renderList.sort((a, b) => a.sortY - b.sortY);

    for (const item of renderList) {
      if (item.kind === 'obj') {
        const o = item.obj;
        const behindBuilding =
          o.occludes &&
          p.worldY < o.sortY &&
          p.worldX > o.x - 18 &&
          p.worldX < o.x + o.w + 18 &&
          p.worldY > o.y - 36;
        if (behindBuilding) {
          ctx.save();
          ctx.globalAlpha = 0.48;
          ctx.drawImage(o.image, Math.round(item.sx), Math.round(item.sy));
          ctx.restore();
        } else {
          ctx.drawImage(o.image, Math.round(item.sx), Math.round(item.sy));
        }
      } else if (item.kind === 'npc') {
        const n = item.npc;
        this.sprites.drawActor(ctx, {
          gfx: n.renderGfx,
          animState: n.animState,
          heading: n.heading,
          elapsedMs: n.animState === 'idle' ? now : now - (n.animStartedAt || 0),
          durationMs: n.animState === 'damage' ? 340 : 0,
          viewZoom: zoom,
          screenX: item.sx,
          screenY: item.sy,
          name: n.name,
          isNpc: true,
          isTarget: this.hoverEntity === n.id,
        });
      } else if (item.kind === 'mob') {
        const m = item.mob;
        const statusPrefix = (m.paralyzeUntil || 0) > now ? '[麻] ' : (m.slowUntil || 0) > now ? '[緩] ' : '';
        this.sprites.drawActor(ctx, {
          gfx: m.gfx,
          animState: m.animState,
          heading: m.heading,
          elapsedMs: now - (m.animStartedAt || 0),
          durationMs: m.animDurationMs || 0,
          walkRate: (m.slowUntil || 0) > now ? 0.65 : 1,
          viewZoom: zoom,
          screenX: item.sx,
          screenY: item.sy,
          name: `${statusPrefix}${m.name}`,
          hpRatio: m.hp > 0 ? m.hp / Math.max(1, m.maxHp) : 0,
          isTarget: p.targetId === m.id || this.hoverEntity === m.id,
        });
      } else if (item.kind === 'pet') {
        const pet = item.pet;
        this.sprites.drawActor(ctx, {
          gfx: pet.gfx,
          animState: pet.animState || 'idle',
          heading: pet.heading ?? 4,
          elapsedMs: now - (pet.animStartedAt || 0),
          durationMs: pet.animDurationMs || 0,
          viewZoom: zoom,
          screenX: item.sx,
          screenY: item.sy,
          name: `Lv.${pet.level} ${pet.name}`,
          hpRatio: pet.hp / Math.max(1, pet.maxHp),
          isNpc: true,
        });
      } else if (item.kind === 'peer') {
        const peer = item.peer;
        const peerLabel = peer.clanName ? `《${peer.clanName}》${peer.charName}` : peer.charName;
        this.sprites.drawActor(ctx, {
          gfx: peer.gfx,
          animState: peer.animState || 'idle',
          heading: peer.heading ?? 4,
          elapsedMs: now - (peer.animStartedAt || 0),
          viewZoom: zoom,
          screenX: item.sx,
          screenY: item.sy,
          name: peerLabel,
          isPlayer: true,
        });
        if (peer.chatText) {
          const chatPx = Math.max(8, Math.round((12 / Math.pow(Math.max(1, zoom), 0.65)) * 10) / 10);
          ctx.save();
          ctx.font = `bold ${chatPx}px "Noto Sans TC", sans-serif`;
          ctx.textAlign = 'center';
          ctx.lineWidth = Math.max(1.8, 3 / zoom);
          ctx.strokeStyle = 'rgba(0,0,0,0.88)';
          ctx.strokeText(peer.chatText, item.sx, item.sy - 68);
          ctx.fillStyle = '#fff4c2';
          ctx.fillText(peer.chatText, item.sx, item.sy - 68);
          ctx.restore();
        }
      } else if (item.kind === 'player') {
        const activeGfx = (p.buffs.poly || 0) > now && p.polyGfx ? p.polyGfx : p.gfx;
        const playerLabel = p.clanName ? `《${p.clanName}》${p.name}` : p.name;
        this.sprites.drawActor(ctx, {
          gfx: activeGfx,
          animState: p.animState,
          heading: p.heading,
          elapsedMs: now - (p.animStartedAt || 0),
          durationMs: p.animDurationMs || 0,
          walkRate: p.walkRate || 1,
          viewZoom: zoom,
          weaponType: activeGfx === p.gfx ? p.weaponType : 'unarmed',
          screenX: item.sx,
          screenY: item.sy,
          name: playerLabel,
          hpRatio: p.hp / Math.max(1, p.maxHp),
          isPlayer: true,
        });
      }
    }

    // 6. 投射物、法術特效與浮動傷害文字
    for (const pr of this.world.projectiles) {
      this.sprites.drawProjectile(ctx, pr, pr.x - camLeft, pr.y - camTop);
    }

    for (const fx of this.world.effects) {
      this.sprites.drawEffect(ctx, fx, fx.x - camLeft, fx.y - camTop, now - fx.bornAt);
    }

    const dmgFontPx = Math.max(9.5, Math.round((14 / Math.pow(Math.max(1, zoom), 0.55)) * 10) / 10);
    for (const ft of this.world.floatingTexts) {
      const progress = Math.min(1, (now - ft.bornAt) / ft.duration);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - progress * progress);
      ctx.font = `bold ${dmgFontPx}px "Noto Sans TC", sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = Math.max(1.8, 3 / zoom);
      ctx.strokeStyle = 'rgba(0,0,0,0.88)';
      const sx = ft.x - camLeft;
      const sy = ft.y - camTop - progress * 26;
      ctx.strokeText(ft.text, sx, sy);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, sx, sy);
      ctx.restore();
    }
  }

  getSnapshot() {
    const p = this.world.player;
    const readyChunks = [...this.isoMap.renderedChunks.values()].filter((c) => c.status === 'ready').length;
    return {
      map: p.map,
      tx: p.tx,
      ty: p.ty,
      hp: p.hp,
      maxHp: p.maxHp,
      mp: p.mp,
      maxMp: p.maxMp,
      level: p.level,
      exp: p.exp,
      gold: p.gold,
      ac: p.ac,
      weaponType: p.weaponType,
      cameraZoom: Number((this.cameraZoom || 1).toFixed(2)),
      autoEnabled: p.autoConfig.enabled,
      autoStatus: this.autoHunt.statusLabel,
      npcsCount: this.world.npcs.length,
      mobsCount: this.world.mobs.filter((m) => m.hp > 0).length,
      dropsCount: this.world.drops.length,
      readyChunks,
      imagesLoaded: this.assets.stats.imagesLoaded,
      chunksLoaded: this.assets.stats.chunksLoaded,
      activeModal: this.hud.activeModal,
    };
  }

  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('keydown', this._onKeyDown);
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    this.canvas.removeEventListener('pointerup', this._onPointerUp);
    this.canvas.removeEventListener('wheel', this._onWheel);

    this.world.dirtySave = true;
    this.world.saveWorld(true);
    this.audio.dispose();
    this.hud.destroy();
    this.assets.dispose();
    this.rootEl.remove();
  }
}
