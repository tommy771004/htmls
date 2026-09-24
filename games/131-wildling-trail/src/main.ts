// 進入點：組合 GameApp（流程）、Phaser 場景（畫面）、DOM 手帳（介面）、輸入與音效。

import Phaser from 'phaser';
import { SETTINGS_KEY } from './app/constants';
import { GameApp } from './app/game';
import type { Button } from './app/types';
import type { KeyValueStorage } from './core/save';
import { getMap } from './data/maps';
import { STARTERS } from './data/species';
import { Sound, type SoundId } from './view/audio';
import { BattleScene } from './view/BattleScene';
import { Input } from './view/input';
import { ShowcaseScene } from './view/ShowcaseScene';
import { DomUI } from './view/ui';
import { VIEW_H, VIEW_W, WorldScene } from './view/WorldScene';
import './view/style.css';

/** localStorage 在私密模式或被封鎖時可能直接丟例外，包一層避免白畫面。 */
function safeStorage(): KeyValueStorage | null {
  try {
    const s = window.localStorage;
    const probe = '__wildling_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const app = new GameApp({ storage: safeStorage(), seed: seedParam ? Number(seedParam) : undefined });
// 第一次開啟時沿用系統的「減少動態效果」偏好。
try {
  if (!localStorage.getItem(SETTINGS_KEY) && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    app.updateSettings({ reducedMotion: true });
  }
} catch {
  // 無法讀取 localStorage 時維持預設值。
}
const sound = new Sound();
const world = new WorldScene();
const battle = new BattleScene();
const showcase = new ShowcaseScene();
let ui: DomUI;
let fading = false;
let lastBump = 0;

const reduced = () => app.settings.reducedMotion;
world.reducedMotion = reduced;
battle.reducedMotion = reduced;
showcase.reducedMotion = reduced;
battle.playSound = (id) => play(id);

function play(id: SoundId): void {
  sound.enabled = app.settings.sound;
  sound.play(id);
}

app.onEffect((e) => {
  if (e.kind === 'sfx') play(e.id);
  else if (e.kind === 'bump') {
    const now = performance.now();
    if (now - lastBump > 260) {
      lastBump = now;
      play('bump');
    }
  } else if (e.kind === 'mapChanged') ui?.showBanner(getMap(e.map).name);
  else if (e.kind === 'saved' && e.ok && app.mode !== 'dialog') ui?.showToast('進度已儲存');
});

// ---------- 輸入 ----------

function isDir(b: Button): b is 'up' | 'down' | 'left' | 'right' {
  return b === 'up' || b === 'down' || b === 'left' || b === 'right';
}

function press(b: Button): void {
  if (fading || app.mode === 'transition') return;
  if ((b === 'confirm' || b === 'cancel') && ui.typing) {
    ui.typer.finish();
    return;
  }
  const mode = app.mode;
  if ((mode === 'battle' || mode === 'result') && battle.busy) {
    if (b === 'confirm' || b === 'cancel') battle.skip();
    return;
  }
  if (mode === 'explore' && isDir(b) && world.busy) return;
  guarded(() => app.press(b));
}

function select(i: number): void {
  if (fading || app.mode === 'transition') return;
  if (ui.typing) {
    ui.typer.finish();
    return;
  }
  if ((app.mode === 'battle' || app.mode === 'result') && battle.busy) return;
  guarded(() => app.select(i));
}

function guarded(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    ui.fatal(err instanceof Error ? err.message : String(err));
    throw err;
  }
}

// ---------- 轉場 ----------

async function runTransition(): Promise<void> {
  const t = app.transition;
  if (!t || fading) return;
  fading = true;
  const instant = reduced();
  const fade = ui.fade;
  fade.classList.toggle('battle', t.kind === 'battleIn');
  const wait = (ms: number) => new Promise((r) => setTimeout(r, instant ? 0 : ms));
  if (t.kind === 'battleIn' && !instant) {
    for (let i = 0; i < 2; i++) {
      fade.classList.add('on');
      await wait(110);
      fade.classList.remove('on');
      await wait(90);
    }
  }
  fade.classList.add('on');
  await wait(t.kind === 'whiteout' ? 600 : 200);
  guarded(() => app.endTransition());
  syncScenes();
  if (app.battle && app.battle.phase === 'events' && t.kind === 'battleIn') {
    battle.reset(app.battle.setup.bg);
    lastSerial = null;
  }
  await wait(60);
  fade.classList.remove('on');
  fade.classList.remove('battle');
  await wait(180);
  fading = false;
}

// ---------- 場景切換與戰鬥動畫 ----------

let lastSerial: number | null = null;
let lastGrowthSerial: number | null = null;

function show(name: 'world' | 'battle' | 'showcase'): void {
  for (const s of [world, battle, showcase]) {
    const sys = s.sys;
    if (!sys.settings || sys.settings.status < Phaser.Scenes.RUNNING) continue;
    const active = sys.settings.key === name;
    if (active) {
      if (sys.isSleeping()) sys.wake();
      if (!sys.isVisible()) sys.setVisible(true);
    } else {
      if (sys.isVisible()) sys.setVisible(false);
      if (sys.isActive()) sys.sleep();
    }
  }
}

function syncScenes(): void {
  const mode = app.mode;
  if (!app.progress || mode === 'title') {
    showcase.show([...STARTERS], false);
    show('showcase');
    return;
  }
  if (mode === 'cleared') {
    showcase.show(app.p.party.map((m) => m.species), true);
    show('showcase');
    return;
  }
  if (app.battle) {
    show('battle');
    return;
  }
  if (mode !== 'transition') show('world');
}

function driveBattle(): void {
  const session = app.battle;
  if (!session) {
    lastSerial = null;
    lastGrowthSerial = null;
    return;
  }
  if (app.mode === 'battle') {
    const vm = session.vm();
    if (vm.phase === 'events' && vm.serial !== lastSerial) {
      lastSerial = vm.serial;
      const serial = vm.serial;
      void battle.playEvent(vm.snap, vm.cues, () => {
        // 純動畫事件（沒有文字）播完自動前進。
        const now = app.battle?.vm();
        if (now && now.phase === 'events' && now.serial === serial && now.text === '') guarded(() => app.battle!.advance());
      });
    }
  } else if (app.mode === 'result') {
    const vm = session.resultVM();
    if (vm.serial !== lastGrowthSerial) {
      lastGrowthSerial = vm.serial;
      void battle.playGrowth(vm.cue, vm.focus?.species ?? null, () => undefined);
    }
  }
}

// ---------- 主迴圈 ----------

let lastTime = performance.now();
function frame(now: number): void {
  const dt = now - lastTime;
  lastTime = now;
  try {
    app.tick(dt);
    if (app.transition) void runTransition();
    if (!fading) syncScenes();
    driveBattle();
    const held = input.heldDir;
    if (held && app.mode === 'explore' && !fading && !world.busy) guarded(() => app.press(held));
    ui.render();
  } catch (err) {
    ui.fatal(err instanceof Error ? err.message : String(err));
    return;
  }
  requestAnimationFrame(frame);
}

const input = new Input(document.getElementById('app')!);

function boot(): void {
  ui = new DomUI(app, { press, select });
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: VIEW_W,
    height: VIEW_H,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#0f0c09',
    banner: false,
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [],
    callbacks: {
      postBoot: (game) => {
        game.scene.add('world', world, true, { app });
        game.scene.add('battle', battle, true);
        game.scene.add('showcase', showcase, true);
        syncScenes();
        requestAnimationFrame(frame);
      },
    },
  });
  input.attach(press, () => sound.unlock());
}

window.addEventListener('error', (e) => {
  ui?.fatal(e.message);
});

try {
  boot();
} catch (err) {
  const sheet = document.getElementById('sheet');
  if (sheet) sheet.textContent = `遊戲無法啟動：${err instanceof Error ? err.message : String(err)}`;
}

// 測試與除錯用：Playwright 會讀取這個物件確認狀態。
(window as unknown as { __wildling: unknown }).__wildling = { app, world, battle };
