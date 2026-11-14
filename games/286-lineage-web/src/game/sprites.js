// 286 天堂實境客戶端：主角圖集、怪物／NPC 影格動畫、弓箭投射物、地面掉落物與法術特效繪製器

const WEAPON_ACTION_BASE = {
  unarmed: { walk: 0, atk: 1, dmg: 2, idle: 3 },
  sword: { walk: 4, atk: 5, dmg: 6, idle: 7 },
  dagger: { walk: 24, atk: 25, dmg: 26, idle: 27 },
  bow: { walk: 20, atk: 21, dmg: 22, idle: 23 },
  spear: { walk: 11, atk: 12, dmg: 13, idle: 14 },
  staff: { walk: 40, atk: 41, dmg: 42, idle: 43 },
  twohand: { walk: 4, atk: 5, dmg: 6, idle: 7 },
};

const TICK_MS = 52; // 原版天堂 1 tick 約 40~55ms

export class SpriteRenderer {
  constructor(worldData, assets) {
    this.worldData = worldData;
    this.assets = assets;
    this.metaMap = worldData.spriteMeta || {};
    this.effectsMeta = worldData.effectsMeta || {};
    this.groundItems = worldData.groundItems || {};
    this.preloadStarted = new Set();
  }

  preloadEffects() {
    for (const key of ['167', '169', '189', '744', '745', '747', '748', '751', '170', '10', 'levelup']) {
      const eff = this.effectsMeta[key];
      if (!eff) continue;
      const p = eff.rawPath ? eff.file : `/lineage163/effects/${eff.file}`;
      this.assets.loadImage(p);
    }
    for (let h = 0; h < 8; h += 1) {
      this.assets.loadImage(`/lineage163/projectiles/66-${h}.png`);
    }
    // 常見地上掉落圖示（金幣、紅水、卷軸、長劍、盔甲）
    for (const g of [7, 45, 22, 3, 9, 66]) {
      if (this.groundItems[String(g)]) {
        this.assets.loadImage(`/lineage163/ground-items79/${g}.webp`);
      }
    }
  }

  preloadActor(gfx) {
    const g = String(gfx);
    if (this.preloadStarted.has(g)) return;
    this.preloadStarted.add(g);
    const meta = this.metaMap[g];
    if (!meta) return;
    if (meta.kind === 'player') {
      const seen = new Set();
      for (const ent of Object.values(meta.atlas || {})) {
        if (seen.has(ent.f)) continue;
        seen.add(ent.f);
        this.assets.loadImage(`/lineage163/player-atlases/${ent.f}`);
      }
      return;
    }
    if (!meta.dir) return;
    for (const [actStr, ext] of Object.entries(meta.acts || {})) {
      const act = Number(actStr);
      // 先預載待機、移動與攻擊動作頁（死亡等在觸發時才載入以節省頻寬）
      if (act < 32 || Object.keys(meta.acts).length <= 24) {
        this.assets.loadImage(`/lineage163/${meta.dir}/${g}-${actStr}.${ext}`);
      }
    }
  }

  /**
   * 挑選指定動作與方向之當前影格資訊。
   */
  resolveFrame(gfx, animState, heading, elapsedMs, weaponType = 'unarmed', opts = {}) {
    const g = String(gfx);
    const meta = this.metaMap[g];
    if (!meta) return null;
    this.preloadActor(gfx);

    const h = ((Math.round(heading) % 8) + 8) % 8;

    if (meta.kind === 'player') {
      return this.#resolvePlayerFrame(meta, animState, h, elapsedMs, weaponType, opts);
    }
    return this.#resolveActorFrame(meta, animState, h, elapsedMs, opts);
  }

  #filterValidSteps(meta, seqFrames, h, animState, walkBase = null) {
    if (!seqFrames?.length) return [];
    const hasKey = (baseOff) => {
      if (baseOff < 0) return false;
      const key = String(baseOff + h);
      return meta.kind === 'player' ? Boolean(meta.atlas?.[key]?.r?.length) : Boolean(meta.acts?.[key]);
    };
    let valid = seqFrames.filter(([baseOff]) => hasKey(baseOff));
    if (!valid.length) return [];
    // 移除攻擊起手殘留的走路跨步格，避免揮砍／拉弓前腳閃爍跨出
    if (animState === 'attack' && valid.length >= 3) {
      const leadWalk = walkBase !== null ? walkBase : 0;
      const firstWalk = valid[0][0] === leadWalk;
      const nonWalkCount = valid.filter(([b]) => b !== leadWalk).length;
      if (firstWalk && nonWalkCount >= 2) {
        valid = valid.filter(([b], idx) => idx > 0 || b !== leadWalk);
      }
    }
    return valid;
  }

  #resolvePlayerFrame(meta, animState, h, elapsedMs, weaponType, opts = {}) {
    const wCfg = WEAPON_ACTION_BASE[weaponType] || WEAPON_ACTION_BASE.unarmed;
    const durationMs = opts.durationMs || 0;
    const walkRate = opts.walkRate || 1;

    if (animState === 'idle') {
      // 先找真正的呼吸待機動作（例如 0/734 的 3,7,14,23,27,43 或 闇騎士 110 的 27）
      const idleCandidates = [wCfg.idle, 27, 7, 3, 14, 23, 43];
      for (const actCode of idleCandidates) {
        const valid = this.#filterValidSteps(meta, meta.seq?.[String(actCode)], h, 'idle');
        if (valid.length) {
          const picked = this.#pickSequenceSlot(valid, elapsedMs, true, 0);
          const atl = meta.atlas?.[String(picked[0] + h)];
          if (atl && atl.r?.length) {
            const [rx, ry] = atl.r[picked[1] % atl.r.length];
            return { path: `/lineage163/player-atlases/${atl.f}`, sx: rx, sy: ry, sw: atl.w, sh: atl.h, ax: atl.x, ay: atl.y };
          }
        }
      }
      // 經典職業（男女騎/女妖/女皇）無獨立待機動作：取走路序列第 2 格（雙腳併攏站立），嚴禁輪播走路腳步
      for (const walkCode of [wCfg.walk, 4, 0, 24]) {
        const valid = this.#filterValidSteps(meta, meta.seq?.[String(walkCode)], h, 'idle');
        if (valid.length) {
          const standStep = valid.length === 4 ? valid[1] : valid[0];
          const atl = meta.atlas?.[String(standStep[0] + h)];
          if (atl && atl.r?.length) {
            const [rx, ry] = atl.r[standStep[1] % atl.r.length];
            return { path: `/lineage163/player-atlases/${atl.f}`, sx: rx, sy: ry, sw: atl.w, sh: atl.h, ax: atl.x, ay: atl.y };
          }
        }
        for (const directOff of [walkCode * 8, walkCode]) {
          const atl = meta.atlas?.[String(directOff + h)];
          if (atl && atl.r?.length) {
            const standIdx = atl.r.length === 4 ? 1 : 0;
            const [rx, ry] = atl.r[standIdx];
            return { path: `/lineage163/player-atlases/${atl.f}`, sx: rx, sy: ry, sw: atl.w, sh: atl.h, ax: atl.x, ay: atl.y };
          }
        }
      }
    }

    const candidates = [];
    if (animState === 'walk') candidates.push(wCfg.walk, 4, 0);
    else if (animState === 'attack') candidates.push(wCfg.atk, 5, 1);
    else if (animState === 'spell') candidates.push(19, 18, wCfg.atk, 1);
    else if (animState === 'damage') candidates.push(wCfg.dmg, 6, 2);
    else if (animState === 'die') candidates.push(8);
    else candidates.push(wCfg.idle, 27, 7, 3);

    const loop = animState === 'walk';
    const effElapsed = animState === 'walk' ? elapsedMs * walkRate : elapsedMs;
    const effDuration = animState === 'attack' || animState === 'spell' || animState === 'damage' ? durationMs : 0;

    for (const actCode of candidates) {
      const valid = this.#filterValidSteps(meta, meta.seq?.[String(actCode)], h, animState, wCfg.walk);
      if (valid.length) {
        const picked = this.#pickSequenceSlot(valid, effElapsed, loop, effDuration);
        const key = String(picked[0] + h);
        const atl = meta.atlas?.[key];
        if (atl && atl.r?.length) {
          const fi = picked[1] % atl.r.length;
          const [rx, ry] = atl.r[fi];
          return {
            path: `/lineage163/player-atlases/${atl.f}`,
            sx: rx,
            sy: ry,
            sw: atl.w,
            sh: atl.h,
            ax: atl.x,
            ay: atl.y,
          };
        }
      }
      // 直接以 actOffset*8 + h 或預設目錄偏移查找
      for (const directOff of [actCode * 8, actCode]) {
        const atl = meta.atlas?.[String(directOff + h)];
        if (atl && atl.r?.length) {
          const fi =
            effDuration > 0
              ? Math.min(atl.r.length - 1, Math.floor((Math.max(0, effElapsed) / effDuration) * atl.r.length))
              : loop
                ? Math.floor(effElapsed / (TICK_MS * 4)) % atl.r.length
                : Math.min(atl.r.length - 1, Math.floor(effElapsed / (TICK_MS * 4)));
          const [rx, ry] = atl.r[fi];
          return {
            path: `/lineage163/player-atlases/${atl.f}`,
            sx: rx,
            sy: ry,
            sw: atl.w,
            sh: atl.h,
            ax: atl.x,
            ay: atl.y,
          };
        }
      }
    }

    // 保底取第一個存在的 atlas
    const first = Object.values(meta.atlas || {})[0];
    if (!first) return null;
    const [rx, ry] = first.r[0];
    return {
      path: `/lineage163/player-atlases/${first.f}`,
      sx: rx,
      sy: ry,
      sw: first.w,
      sh: first.h,
      ax: first.x,
      ay: first.y,
    };
  }

  #resolveActorFrame(meta, animState, h, elapsedMs, opts = {}) {
    if (!meta.dir || !meta.acts) return null;
    const durationMs = opts.durationMs || 0;
    const walkRate = opts.walkRate || 1;
    const wantMap = {
      walk: [0, 24, 20, 4],
      attack: [1, 5, 12, 25, 18],
      spell: [18, 19, 30, 1],
      damage: [2, 6, 26],
      die: [8],
      idle: [3, 27, 7, 14, 23, 43, 17, 19],
    };
    const candidates = wantMap[animState] || wantMap.idle;
    const loop = animState === 'walk' || animState === 'idle';
    const effElapsed = animState === 'walk' ? elapsedMs * walkRate : elapsedMs;
    const effDuration = animState === 'attack' || animState === 'spell' || animState === 'damage' ? durationMs : 0;

    for (const actCode of candidates) {
      const valid = this.#filterValidSteps(meta, meta.seq?.[String(actCode)], h, animState, 0);
      if (valid.length) {
        const picked = this.#pickSequenceSlot(valid, effElapsed, loop, effDuration);
        const key = String(picked[0] + h);
        if (meta.acts[key]) {
          return this.#actorGeomFrame(meta, key, picked[1]);
        }
      }
    }

    // 無專屬待機動作時（如僅有移動 seq '0'），待機定格於靜止姿態，絕不原地踏步
    if (animState === 'idle') {
      const walkValid = this.#filterValidSteps(meta, meta.seq?.['0'], h, 'idle');
      if (walkValid.length) {
        const standStep = walkValid.length === 4 ? walkValid[1] : walkValid[0];
        const key = String(standStep[0] + h);
        if (meta.acts[key]) return this.#actorGeomFrame(meta, key, standStep[1]);
      }
    }

    // 依標準天堂方向塊嘗試：0(移動), 8(待機或攻擊), 24(待機/受傷)
    const fallbackBases = animState === 'idle' ? [8, 24, 0] : animState === 'attack' ? [8, 16, 0] : animState === 'die' ? [16, 24, 32] : [0, 8, 24];
    for (const base of fallbackBases) {
      const key = String(base + h);
      if (meta.acts[key]) {
        const geom = meta.geom?.[key];
        const n = Math.max(1, geom?.n || 1);
        const fi =
          animState === 'idle'
            ? n === 4 && base === 0
              ? 1
              : 0
            : Math.floor(effElapsed / (TICK_MS * 4)) % n;
        return this.#actorGeomFrame(meta, key, fi);
      }
    }

    // 取可用方向中最接近或第一個檔案（例如木人只有 116-0..3）
    const availKeys = Object.keys(meta.acts).sort((a, b) => Number(a) - Number(b));
    if (!availKeys.length) return null;
    const pickedKey = meta.acts[String(h % Math.max(1, availKeys.length))]
      ? String(h % Math.max(1, availKeys.length))
      : availKeys[0];
    return this.#actorGeomFrame(meta, pickedKey, animState === 'idle' ? 0 : Math.floor(effElapsed / (TICK_MS * 4)));
  }

  #actorGeomFrame(meta, actKey, frameIndex) {
    const ext = meta.acts[actKey];
    const g = meta.geom?.[actKey] || { w: 128, h: 160, x: -64, y: -132, n: 1 };
    const fi = Math.abs(frameIndex) % Math.max(1, g.n || 1);
    return {
      path: `/lineage163/${meta.dir}/${meta.gfx}-${actKey}.${ext}`,
      sx: fi * g.w,
      sy: 0,
      sw: g.w,
      sh: g.h,
      ax: g.x,
      ay: g.y,
    };
  }

  #pickSequenceSlot(seqList, elapsedMs, loop, durationMs = 0) {
    const totalTicks = seqList.reduce((sum, item) => sum + (item[2] || 4), 0) || 1;
    let tick;
    if (durationMs > 0) {
      const progress = Math.min(1, Math.max(0, elapsedMs / durationMs));
      tick = progress >= 1 ? totalTicks : Math.min(totalTicks - 0.0001, progress * totalTicks);
    } else {
      tick = Math.max(0, Math.floor(elapsedMs / TICK_MS));
    }
    if (loop) {
      tick %= totalTicks;
    } else if (tick >= totalTicks) {
      const last = seqList[seqList.length - 1];
      return [last[0], last[1]];
    }
    let acc = 0;
    for (const [baseOff, fIdx, dur] of seqList) {
      acc += dur || 4;
      if (tick < acc) return [baseOff, fIdx];
    }
    const last = seqList[seqList.length - 1];
    return [last[0], last[1]];
  }

  drawActor(
    ctx,
    {
      gfx,
      animState,
      heading,
      elapsedMs,
      weaponType,
      durationMs = 0,
      walkRate = 1,
      viewZoom = 1,
      screenX,
      screenY,
      isTarget,
      hpRatio,
      name,
      isPlayer,
      isNpc,
      alpha = 1,
    },
  ) {
    const frame = this.resolveFrame(gfx, animState, heading, elapsedMs, weaponType, { durationMs, walkRate });
    ctx.save();
    ctx.globalAlpha = alpha;

    // 腳底陰影
    ctx.fillStyle = isTarget ? 'rgba(255, 210, 74, 0.42)' : 'rgba(6, 10, 16, 0.48)';
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 2, isTarget ? 19 : 15, isTarget ? 9 : 7, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isTarget) {
      ctx.strokeStyle = '#ffd569';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    let drewImg = false;
    if (frame) {
      const img = this.assets.getLoadedImage(frame.path);
      if (img) {
        ctx.drawImage(
          img,
          frame.sx,
          frame.sy,
          frame.sw,
          frame.sh,
          Math.round(screenX + frame.ax),
          Math.round(screenY + frame.ay),
          frame.sw,
          frame.sh,
        );
        drewImg = true;
      }
    }

    if (!drewImg) {
      // 載入瞬間的簡易精靈佔位輪廓（避免空白）
      ctx.fillStyle = isPlayer ? '#f0c56e' : isNpc ? '#7ad0ff' : '#e07a60';
      ctx.beginPath();
      ctx.arc(screenX, screenY - 22, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    const labelScale = Math.max(0.6, Math.min(1, 1 / Math.pow(Math.max(1, viewZoom), 0.72)));

    // 血條與名稱標籤
    if (hpRatio !== null && hpRatio < 1 && animState !== 'die') {
      const barW = Math.round(36 * labelScale);
      const barH = Math.max(3, Math.round(4 * labelScale));
      const pad = Math.max(0.7, labelScale);
      const bx = Math.round(screenX - barW / 2);
      const by = Math.round(screenY - 56);
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(bx - pad, by - pad, barW + pad * 2, barH + pad * 2);
      ctx.fillStyle = hpRatio > 0.5 ? '#d93829' : hpRatio > 0.25 ? '#e67e22' : '#ff2e2e';
      ctx.fillRect(bx, by, Math.max(1, Math.round(barW * Math.max(0, Math.min(1, hpRatio)))), barH);
    }

    if (name && (isPlayer || isNpc || isTarget)) {
      const fontPx = Math.max(8, Math.round(12.5 * labelScale * 10) / 10);
      ctx.font = `bold ${fontPx}px "Noto Sans TC", "PingFang TC", sans-serif`;
      ctx.textAlign = 'center';
      const labelY = Math.round(screenY + 14);
      ctx.lineWidth = Math.max(1.8, 3 * labelScale);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.88)';
      ctx.strokeText(name, screenX, labelY);
      ctx.fillStyle = isPlayer ? '#ffe28a' : isNpc ? '#8cd6ff' : '#ffb499';
      ctx.fillText(name, screenX, labelY);
    }

    ctx.restore();
  }

  drawGroundDrop(ctx, drop, screenX, screenY) {
    const gfxKey = String(drop.groundGfx ?? 7);
    const info = this.groundItems[gfxKey] || this.groundItems['7'] || { x: -12, y: -10, width: 24, height: 20 };
    const path = `/lineage163/ground-items79/${this.groundItems[gfxKey] ? gfxKey : '7'}.webp`;

    ctx.save();
    // 地面微光圈提示
    ctx.fillStyle = 'rgba(255, 224, 120, 0.22)';
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 1, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const img = this.assets.getLoadedImage(path);
    if (img) {
      ctx.drawImage(img, Math.round(screenX + info.x), Math.round(screenY + info.y));
    } else {
      ctx.fillStyle = '#f5cb5c';
      ctx.fillRect(screenX - 5, screenY - 5, 10, 6);
    }
    ctx.restore();
  }

  drawProjectile(ctx, proj, screenX, screenY) {
    const h = ((Math.round(proj.heading) % 8) + 8) % 8;
    const path = `/lineage163/projectiles/66-${h}.png`;
    const img = this.assets.getLoadedImage(path);
    if (img) {
      ctx.drawImage(img, Math.round(screenX - img.width / 2), Math.round(screenY - img.height / 2 - 20));
    } else {
      ctx.fillStyle = '#fff1a6';
      ctx.beginPath();
      ctx.arc(screenX, screenY - 20, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawEffect(ctx, fx, screenX, screenY, elapsedMs) {
    const eff = this.effectsMeta[String(fx.effectId)];
    if (!eff) return;
    const p = eff.rawPath ? eff.file : `/lineage163/effects/${eff.file}`;
    const img = this.assets.getLoadedImage(p);
    if (!img) return;
    const seq = eff.seq?.length ? eff.seq : [[0, 3]];
    const totalTicks = seq.reduce((acc, s) => acc + (s[1] || 2), 0) || 1;
    const tick = Math.floor((elapsedMs / Math.max(180, eff.duration)) * totalTicks);
    let fi = seq[seq.length - 1][0];
    let acc = 0;
    for (const [idx, dur] of seq) {
      acc += dur || 2;
      if (tick < acc) {
        fi = idx;
        break;
      }
    }
    const cellW = Math.round(img.width / Math.max(1, eff.frames));
    const cellH = img.height;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(
      img,
      fi * cellW,
      0,
      cellW,
      cellH,
      Math.round(screenX - cellW / 2),
      Math.round(screenY - cellH * 0.68),
      cellW,
      cellH,
    );
    ctx.restore();
  }
}
