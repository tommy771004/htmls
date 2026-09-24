// DOM 介面：下方的旅行手帳（對話、選單、戰鬥指令）與畫面上的 HUD。
// 只讀取 GameApp 的 view model；點擊項目會轉成 app.select() 或按鍵。

import type { GameApp } from '../app/game';
import type { BattleVM, Button, ListRow, PanelVM } from '../app/types';
import type { SideView } from '../core/battle';
import { getMap } from '../data/maps';
import { SPECIES_LIST, getSpecies } from '../data/species';
import { maxHp } from '../core/monster';
import { spriteUrl } from './textures';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function img(key: string | undefined, cls = 'px', alt = ''): string {
  if (!key) return '';
  const url = spriteUrl(key);
  return url ? `<img class="${cls}" src="${url}" alt="${esc(alt)}" draggable="false">` : '';
}

function bar(hp: number, max: number): string {
  const pct = max > 0 ? Math.max(0, Math.min(100, (hp / max) * 100)) : 0;
  const cls = pct <= 20 ? 'low' : pct <= 50 ? 'mid' : '';
  return `<div class="bar ${cls}"><i style="width:${pct.toFixed(1)}%"></i></div>`;
}

const STATUS_LABEL: Record<string, string> = { burn: '灼傷', poison: '中毒', sleep: '睡眠' };

/** 逐字顯示；instant 時一次顯示完。 */
class Typer {
  serial: number | null = null;
  full = '';
  shown = 0;
  private timer = 0;
  onChange: () => void = () => undefined;

  get typing(): boolean {
    return this.shown < this.full.length;
  }

  start(serial: number, text: string, instant: boolean): void {
    if (serial === this.serial && text === this.full) return;
    this.serial = serial;
    this.full = text;
    this.shown = instant ? text.length : 0;
    window.clearInterval(this.timer);
    if (!instant && text.length > 0) {
      this.timer = window.setInterval(() => {
        this.shown = Math.min(this.full.length, this.shown + 1);
        this.onChange();
        if (!this.typing) window.clearInterval(this.timer);
      }, 26);
    }
    this.onChange();
  }

  finish(): void {
    this.shown = this.full.length;
    window.clearInterval(this.timer);
    this.onChange();
  }

  get text(): string {
    return this.full.slice(0, this.shown);
  }
}

export class DomUI {
  readonly sheet = document.getElementById('sheet')!;
  private readonly hudEnemy = document.getElementById('hud-enemy')!;
  private readonly hudPlayer = document.getElementById('hud-player')!;
  private readonly logo = document.getElementById('logo')!;
  private readonly banner = document.getElementById('banner')!;
  private readonly toast = document.getElementById('toast')!;
  readonly fade = document.getElementById('fade')!;
  private sheetKey = '';
  private hudKey = '';
  readonly typer = new Typer();
  private typerTarget: HTMLElement | null = null;
  private moreEl: HTMLElement | null = null;

  constructor(
    private readonly app: GameApp,
    private readonly actions: { press: (b: Button) => void; select: (i: number) => void },
  ) {
    this.typer.onChange = () => this.paintTyper();
    this.sheet.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i],[data-press]');
      if (el?.dataset.i !== undefined) {
        this.actions.select(Number(el.dataset.i));
        return;
      }
      if (el?.dataset.press) {
        this.actions.press(el.dataset.press as Button);
        return;
      }
      if ((e.target as HTMLElement).closest('.dlg')) this.actions.press('confirm');
    });
  }

  get typing(): boolean {
    return this.typer.typing;
  }

  private paintTyper(): void {
    if (this.typerTarget) this.typerTarget.textContent = this.typer.text;
    if (this.moreEl) this.moreEl.hidden = this.typer.typing;
  }

  showBanner(text: string): void {
    this.banner.hidden = false;
    this.banner.textContent = text;
    this.banner.style.animation = 'none';
    void this.banner.offsetWidth;
    this.banner.style.animation = '';
  }

  showToast(text: string): void {
    this.toast.hidden = false;
    this.toast.textContent = text;
    this.toast.style.animation = 'none';
    void this.toast.offsetWidth;
    this.toast.style.animation = '';
  }

  fatal(message: string): void {
    this.sheet.innerHTML = `<div class="fatal"><p class="err">遊戲發生錯誤，已經停止。</p><p>${esc(message)}</p><p>存檔不會因此遺失。</p><button type="button" onclick="location.reload()">重新載入</button></div>`;
    this.sheetKey = 'fatal';
  }

  // ---------- 每幀更新 ----------

  render(): void {
    if (this.sheetKey === 'fatal') return;
    const app = this.app;
    const mode = app.mode;
    document.documentElement.classList.toggle('reduced', app.settings.reducedMotion);
    this.logo.hidden = mode !== 'title';
    if (mode === 'transition') return;

    let key: string;
    let html: () => string;
    let typed: { serial: number; text: string } | null = null;

    switch (mode) {
      case 'title':
      case 'menu': {
        const vm = app.topPanel!.vm();
        key = `panel|${JSON.stringify(vm)}`;
        html = () => this.panelHtml(vm);
        break;
      }
      case 'dialog': {
        const vm = app.dialog!.vm();
        key = `dlg|${vm.serial}|${vm.choice ? JSON.stringify(vm.choice) : ''}`;
        typed = { serial: vm.serial, text: vm.text };
        html = () => {
          const choices = vm.choice
            ? `<div class="choices">${vm.choice.options
                .map((o, i) => `<button type="button" data-i="${i}" class="${i === vm.choice!.cursor ? 'sel' : ''}">${esc(o)}</button>`)
                .join('')}</div>`
            : '';
          return `<div class="dlg">${vm.speaker ? `<span class="speaker">${esc(vm.speaker)}</span>` : ''}<div class="text-wrap"><span class="text typed"></span>${vm.more || !vm.choice ? '<span class="more" hidden>▼</span>' : ''}</div>${choices}</div>`;
        };
        break;
      }
      case 'battle': {
        const vm = app.battle!.vm();
        key = `battle|${vm.phase}|${vm.serial}|${vm.text}|${JSON.stringify(vm.commands)}|${JSON.stringify(vm.panel)}`;
        if (vm.phase === 'events') typed = { serial: vm.serial, text: vm.text };
        html = () => this.battleHtml(vm);
        break;
      }
      case 'result': {
        const vm = app.battle!.resultVM();
        key = `result|${vm.serial}|${JSON.stringify(vm.panel)}`;
        if (!vm.panel) typed = { serial: vm.serial + 1_000_000, text: vm.text };
        html = () =>
          vm.panel
            ? `<div class="dlg" style="flex:none"><div class="text">${esc(vm.text)}</div></div>${this.panelHtml(vm.panel)}`
            : `<div class="dlg"><div class="text-wrap"><span class="text typed"></span><span class="more" hidden>▼</span></div></div>`;
        break;
      }
      case 'cleared': {
        const vm = app.clearedVM();
        key = `cleared|${JSON.stringify(vm)}`;
        html = () => `<div class="cleared sheet-scroll"><div class="kicker">石冠挑戰・通過</div><h2>旅程告一段落</h2>
          <dl><dt>遊玩時間</dt><dd>${esc(vm.playTime)}</dd><dt>圖鑑</dt><dd>見過 ${vm.seen}・捕捉 ${vm.caught}／${vm.total}</dd>
          <dt>夥伴</dt><dd>${vm.party.map((m) => `${esc(m.name)} Lv.${m.level}`).join('、')}</dd></dl>
          <div class="goal"><p>謝謝你陪野靈們走完這段路。按確認繼續自由探索，把圖鑑填滿吧。</p></div>
          <button type="button" class="opt" data-press="confirm">繼續自由探索</button></div>`;
        break;
      }
      default: {
        key = `explore|${this.exploreKey()}`;
        html = () => this.exploreHtml();
      }
    }

    if (key !== this.sheetKey) {
      this.sheetKey = key;
      this.sheet.innerHTML = html();
      this.typerTarget = this.sheet.querySelector('.typed');
      this.moreEl = this.sheet.querySelector('.more');
      if (typed) this.typer.start(typed.serial, typed.text, app.settings.instantText);
      else this.typer.start(-1, '', true);
      this.paintTyper();
      this.sheet.querySelector('.row.sel, .card.sel')?.scrollIntoView({ block: 'nearest' });
    }
    this.renderHud();
  }

  // ---------- 探索 ----------

  private exploreKey(): string {
    const p = this.app.p;
    const o = this.app.objective();
    return JSON.stringify([p.player.map, p.money, p.dex.caught.length, o?.id, o?.detail, p.party.map((m) => [m.species, m.level, m.hp, m.nickname])]);
  }

  private exploreHtml(): string {
    const p = this.app.p;
    const o = this.app.objective()!;
    const chips = p.party
      .map((m) => {
        const max = maxHp(m);
        const pct = Math.round((m.hp / max) * 100);
        return `<span class="chip${m.hp <= 0 ? ' fainted' : ''}" title="${esc(m.nickname)}">${img(getSpecies(m.species).sprite.icon, 'px', m.nickname)}Lv.${m.level}<span class="mini"><i style="width:${pct}%;${pct <= 20 ? 'background:#c8452c' : pct <= 50 ? 'background:#d99a1f' : ''}"></i></span></span>`;
      })
      .join('');
    return `<div class="sheet-scroll">
      <div class="goal"><div class="kicker">目前目標</div><h2>${esc(o.title)}</h2><p>${esc(o.detail)}</p></div>
      <div class="status-line" style="margin-top:8px"><span>所在地 <b>${esc(getMap(p.player.map).name)}</b></span><span>銅貝 <b>${p.money}</b></span><span>圖鑑 <b>${p.dex.caught.length}/${SPECIES_LIST.length}</b></span></div>
      ${chips ? `<div class="party-strip" style="margin-top:8px">${chips}</div>` : ''}
      <p class="keys"><kbd>方向鍵</kbd>/<kbd>WASD</kbd> 移動・<kbd>Enter</kbd>/<kbd>Z</kbd> 說話調查・<kbd>Esc</kbd>/<kbd>X</kbd> 開選單</p>
    </div>`;
  }

  // ---------- 面板 ----------

  private rowHtml(row: ListRow, i: number, cursor: number): string {
    const cls = ['row', i === cursor ? 'sel' : '', row.icon ? '' : 'noicon', row.disabled ? 'disabled' : '', row.tone ?? ''].filter(Boolean).join(' ');
    const hp = row.hp ? bar(row.hp[0], row.hp[1]) : '';
    const right = row.hp ? `${row.right ?? ''}<br><small>${row.hp[0]}/${row.hp[1]}</small>` : esc(row.right ?? '');
    return `<li class="${cls}" data-i="${i}">${row.icon ? img(row.icon) : ''}<div style="min-width:0"><div class="lbl">${esc(row.label)}</div>${row.sub ? `<div class="sub">${esc(row.sub)}</div>` : ''}${hp}</div><div class="right">${right}</div></li>`;
  }

  panelHtml(vm: PanelVM): string {
    const detail = vm.detail
      ? `<div class="detail">${vm.detail.sprite ? img(vm.detail.sprite) : ''}<div>${vm.detail.title ? `<h3>${esc(vm.detail.title)}</h3>` : ''}${vm.detail.lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div></div>`
      : '';
    if (vm.layout === 'starter') {
      const cards = vm.rows
        .map((r, i) => `<div class="card${i === vm.cursor ? ' sel' : ''}" data-i="${i}">${img(r.icon)}<div class="lbl">${esc(r.label)}</div><div class="right">${esc(r.right ?? '')}</div></div>`)
        .join('');
      return `<div class="panel"><div class="ptitle"><span>${esc(vm.title)}</span></div><div class="sheet-scroll"><div class="starter-grid">${cards}</div>${detail ? `<div style="margin-top:8px">${detail}</div>` : ''}</div>${vm.hint ? `<div class="hint">${esc(vm.hint)}</div>` : '<div></div>'}</div>`;
    }
    if (vm.qty) {
      const q = vm.qty;
      const short = q.total > q.balance;
      return `<div class="panel"><div class="ptitle"><span>${esc(vm.title)}</span></div>
        <div class="qty"><button type="button" data-press="left">−10</button><button type="button" data-press="down">−1</button><span class="num">${q.value}</span><button type="button" data-press="up">+1</button><button type="button" data-press="right">+10</button></div>
        <div class="qty"><span>單價 ${q.price}・合計 <b>${q.total}</b> 銅貝</span><span class="${short ? 'short' : ''}">持有 ${q.balance} 銅貝${short ? '（不夠）' : ''}</span><button type="button" data-press="confirm">購買</button></div></div>`;
    }
    const rows = vm.rows.map((r, i) => this.rowHtml(r, i, vm.cursor)).join('');
    return `<div class="panel"><div class="ptitle"><span>${esc(vm.title)}</span></div><div class="body${detail ? ' has-detail' : ''}"><ul class="rows">${rows}</ul>${detail}</div>${vm.hint ? `<div class="hint">${esc(vm.hint)}</div>` : '<div></div>'}</div>`;
  }

  // ---------- 戰鬥 ----------

  private battleHtml(vm: BattleVM): string {
    if (vm.phase === 'panel' && vm.panel) return this.panelHtml(vm.panel);
    if (vm.phase === 'command' && vm.commands) {
      const cmds = vm.commands.labels
        .map((l, i) => `<button type="button" data-i="${i}" class="${i === vm.commands!.cursor ? 'sel' : ''}">${esc(l)}</button>`)
        .join('');
      return `<div class="dlg"><div class="text">${esc(vm.text)}</div><div class="cmds">${cmds}</div></div>`;
    }
    return `<div class="dlg"><div class="text-wrap"><span class="text typed"></span><span class="more" hidden>▼</span></div></div>`;
  }

  private hudHtml(v: SideView, player: boolean): string {
    const st = v.status !== 'none' ? `<span class="st ${v.status}">${STATUS_LABEL[v.status]}</span>` : '';
    const roster = v.roster.length > 1 ? `<div class="roster">${v.roster.map((r) => `<b class="${r === 'ok' ? '' : r}"></b>`).join('')}</div>` : '';
    return `<div class="row1"><span class="name">${esc(v.name)}${st}</span><span>Lv.${v.level}</span></div>${bar(v.hp, v.maxHp)}${
      player ? `<div class="hpnum">${v.hp}/${v.maxHp}</div><div class="exp"><i style="width:${(v.expPct * 100).toFixed(1)}%"></i></div>` : ''
    }${roster}`;
  }

  private renderHud(): void {
    const mode = this.app.mode;
    const battle = this.app.battle;
    if (!battle || (mode !== 'battle' && mode !== 'result' && mode !== 'transition')) {
      if (this.hudKey !== '') {
        this.hudEnemy.hidden = true;
        this.hudPlayer.hidden = true;
        this.hudKey = '';
      }
      return;
    }
    if (mode === 'result') {
      this.hudEnemy.hidden = true;
      this.hudPlayer.hidden = true;
      this.hudKey = 'result';
      return;
    }
    const snap = battle.vm().snap;
    const key = JSON.stringify(snap);
    if (key === this.hudKey) return;
    this.hudKey = key;
    this.paintHud(this.hudEnemy, snap.enemy, false);
    this.paintHud(this.hudPlayer, snap.player, true);
  }

  /** 名字、等級、狀態沒變時只更新血條寬度，讓 CSS 補間顯示扣血過程。 */
  private paintHud(el: HTMLElement, v: SideView, player: boolean): void {
    el.hidden = !v.visible;
    const shape = JSON.stringify([v.uid, v.name, v.level, v.status, v.roster]);
    if (el.dataset.shape !== shape) {
      el.dataset.shape = shape;
      el.innerHTML = this.hudHtml(v, player);
      return;
    }
    const pct = v.maxHp > 0 ? Math.max(0, Math.min(100, (v.hp / v.maxHp) * 100)) : 0;
    const barEl = el.querySelector<HTMLElement>('.bar');
    if (barEl) {
      barEl.className = `bar ${pct <= 20 ? 'low' : pct <= 50 ? 'mid' : ''}`;
      barEl.querySelector<HTMLElement>('i')!.style.width = `${pct.toFixed(1)}%`;
    }
    const num = el.querySelector('.hpnum');
    if (num) num.textContent = `${v.hp}/${v.maxHp}`;
    const exp = el.querySelector<HTMLElement>('.exp i');
    if (exp) exp.style.width = `${(v.expPct * 100).toFixed(1)}%`;
  }
}
