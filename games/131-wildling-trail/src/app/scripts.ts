// NPC、告示牌與地上道具的互動劇本。每個劇本都以旗標判斷進度，
// 一次性獎勵在給出的同一步寫入旗標，重複對話不會再拿到。

import { isFainted } from '../core/monster';
import type { PlacedEntity } from '../core/world';
import { getItem } from '../data/items';
import type { GameApp } from './game';
import { buildBoxPanel, buildShopPanel, buildStarterPanel } from './npcPanels';

type Script = (app: GameApp, entity: PlacedEntity) => void;

const say = (app: GameApp, speaker: string, ...texts: string[]) => app.say(texts.map((text) => ({ speaker, text })));

const SCRIPTS: Record<string, Script> = {
  tutor(app) {
    const f = app.p.flags;
    if (!f.gotStarter) {
      app.say(
        [
          { speaker: '禾老師', text: '你來啦！我是禾老師，負責帶芽口村的孩子們第一次出門旅行。' },
          { speaker: '禾老師', text: '野外的野靈會從高草叢裡跳出來。出發前，先從這三隻裡挑一個夥伴吧。' },
        ],
        () => app.openPanel(buildStarterPanel(app)),
      );
      return;
    }
    if (!f.firstCatch) {
      say(app, '禾老師', '捕捉的訣竅：先用招式削弱對手，HP 條變成黃色或紅色時再丟晶籠。', '讓對手睡著或中毒，也會更容易成功。晶籠用完了可以到阿良那裡買。');
      return;
    }
    if (!f.bossDefeated) {
      say(app, '禾老師', '屬性相剋要記得：焰剋苔、苔剋潮、潮剋焰，效果絕佳時傷害是兩倍。', '打不贏的時候，就多在草叢裡鍛鍊，或是抓一隻能剋制對手的野靈。');
      return;
    }
    say(app, '禾老師', '你打贏了場主嵐？了不起！', '圖鑑還沒填滿的話，森林深處說不定還藏著你沒見過的野靈。');
  },

  healer(app) {
    if (app.p.party.length === 0) {
      say(app, '蘇護士', '這裡是治療所。等你有了夥伴，累了就帶牠們來休息吧。');
      return;
    }
    app.ask([{ speaker: '蘇護士', text: '歡迎來到治療所！要讓你的夥伴休息一下嗎？' }], {
      options: ['好，麻煩了', '不用了'],
      cancelIndex: 1,
      onPick: (i) => {
        if (i !== 0) {
          say(app, '蘇護士', '隨時歡迎你回來。');
          return;
        }
        app.healParty();
        const first = app.p.flags.firstCatch && !app.p.flags.healedAfterCatch;
        if (app.p.flags.firstCatch) app.p.flags.healedAfterCatch = true;
        app.autosave();
        const lines = ['……叮咚叮咚♪', '你的夥伴都恢復精神了！'];
        if (first) lines.push('聽說巡林員在風草道北邊等你。夥伴恢復了，就可以進霧苔林了！');
        say(app, '蘇護士', ...lines);
      },
    });
  },

  terminal(app) {
    if (app.p.party.length === 0) {
      app.say(['收納石發出淡淡的光。現在還沒有怪獸可以存放。']);
      return;
    }
    app.sfx('confirm');
    app.openPanel(buildBoxPanel(app));
  },

  shop(app) {
    if (!app.p.flags.gotStarter) {
      say(app, '阿良', '歡迎光臨！……咦，你還沒有夥伴？先去找禾老師吧，買了晶籠也用不上喔。');
      return;
    }
    app.say([{ speaker: '阿良', text: '歡迎光臨！晶籠、莓果露都有，要買點什麼？' }], () => app.openPanel(buildShopPanel(app)));
  },

  kid(app) {
    const f = app.p.flags;
    if (!f.gotStarter) say(app, '小楓', '禾老師在廣場等你喔！就是戴草帽的那位。');
    else if (!f.hasPermit) say(app, '小楓', '我長大也要去霧苔林！聽說守林人朔姊姊超強的。');
    else say(app, '小楓', '你拿到挑戰許可了？好厲害！挑戰場在霧苔林最北邊的石門後面。');
  },

  villageSign(app) {
    app.say(['【芽口村】', '北：風草道・霧苔林・石冠挑戰場']);
  },

  clinicSign(app) {
    app.say(['【治療所】', '蘇護士會免費治療你的夥伴。旁邊的收納石可以存放、取出怪獸。']);
  },

  routeSign(app) {
    app.say(['【風草道】', '高草叢裡有野靈出沒。北：霧苔林（需經巡林員同意）']);
  },

  traveler(app) {
    say(
      app,
      '旅人',
      '我從南方一路走來，發現三種屬性互相剋制：焰燒苔、苔吸潮、潮滅焰。',
      '招式的使用次數用完就只能「拚命」，還會傷到自己。記得常回村子休息。',
    );
  },

  warden(app) {
    const f = app.p.flags;
    if (!f.firstCatch) say(app, '巡林員', '森林的規矩：先學會捕捉野生野靈，才能進霧苔林。在草叢裡用晶籠試試看吧！');
    else if (!f.healedAfterCatch) say(app, '巡林員', '抓到了？很好！不過你的夥伴看起來很累。先回芽口村找蘇護士治療，順便補些晶籠再來。');
    else say(app, '巡林員', '準備好了就進去吧。守林人朔在森林北側，打贏她才能拿到挑戰許可。');
  },

  pickup(app, entity) {
    const item = entity.def.item;
    if (!item || app.p.flags[item.flag]) return;
    app.giveItem(item.id, item.count);
    app.p.flags[item.flag] = true;
    app.sfx('pickup');
    app.autosave();
    app.say([`撿到了${getItem(item.id).name} ×${item.count}！`]);
  },

  ranger(app) {
    if (app.p.defeated.includes('ranger')) {
      say(app, '守林人・朔', '場主嵐的最後一隻是翠翅蛾，速度快又會讓人中毒。', '帶一隻焰屬性的夥伴去，會輕鬆很多。');
      return;
    }
    app.ask(
      [
        { speaker: '守林人・朔', text: '我是守林人朔。想進石冠挑戰場，就先讓我看看你和夥伴的默契。' },
        { speaker: '守林人・朔', text: '我會派出兩隻野靈。準備好了嗎？' },
      ],
      {
        options: ['開始對戰', '還沒準備好'],
        cancelIndex: 1,
        onPick: (i) => {
          if (i !== 0) {
            say(app, '守林人・朔', '去草叢裡多練練吧，我在這裡等你。');
            return;
          }
          if (!app.p.party.some((m) => !isFainted(m))) {
            say(app, '守林人・朔', '你的夥伴都倒下了。先回村子治療吧。');
            return;
          }
          app.startTrainerBattle('ranger', {
            onWin: () =>
              say(
                app,
                '守林人・朔',
                '……不錯的默契。這是石冠挑戰場的挑戰許可，收好。',
                '石門就在我身後。場主嵐很強，先回村子補給再去也不遲。',
              ),
          });
        },
      },
    );
  },

  gatekeeper(app) {
    if (!app.p.flags.hasPermit) say(app, '石門衛', '這裡是石冠挑戰場的入口。只有通過守林人朔試煉、拿到挑戰許可的人才能進去。');
    else if (!app.p.flags.bossDefeated) say(app, '石門衛', '挑戰許可確認無誤。請進，挑戰者。');
    else say(app, '石門衛', '打敗場主的挑戰者！石冠挑戰場隨時為你敞開。');
  },

  forestSign(app) {
    app.say(['【霧苔林】', '深草叢裡的野靈比較強。北側石門通往石冠挑戰場。']);
  },

  boss(app) {
    if (app.p.defeated.includes('boss')) {
      say(app, '場主・嵐', '那一場真痛快。', '世界上還有很多野靈等著你。有空再回來，我們再聊聊。');
      return;
    }
    app.ask(
      [
        { speaker: '場主・嵐', text: '我是石冠挑戰場的場主，嵐。' },
        { speaker: '場主・嵐', text: '能走到這裡，代表朔認可了你。讓我看看你們一路累積的力量！' },
      ],
      {
        options: ['開始挑戰', '再準備一下'],
        cancelIndex: 1,
        onPick: (i) => {
          if (i !== 0) {
            say(app, '場主・嵐', '挑戰場不會跑掉。準備好了再來。');
            return;
          }
          if (!app.p.party.some((m) => !isFainted(m))) {
            say(app, '場主・嵐', '你的夥伴都倒下了。先回村子治療吧。');
            return;
          }
          app.startTrainerBattle('boss', {
            onWin: () =>
              app.say(
                [
                  { speaker: '場主・嵐', text: '……輸了。你和夥伴之間的信任，比我想的更強。' },
                  { speaker: '場主・嵐', text: '石冠挑戰，通過！從今天起，你就是獨當一面的旅行者了。' },
                ],
                () => app.showCleared(),
              ),
          });
        },
      },
    );
  },

  arenaSign(app) {
    app.say(['【石冠挑戰場】', '場主：嵐。三對三，不能逃跑，也不能捕捉對方的野靈。']);
  },

  fan(app) {
    if (app.p.flags.bossDefeated) say(app, '觀眾', '剛剛那場比賽太精彩了！我要把它寫進日記裡！');
    else say(app, '觀眾', '場主嵐的翠翅蛾會讓對手中毒。帶些萬用草會比較安心喔。');
  },
};

export const SCRIPT_NAMES: ReadonlySet<string> = new Set(Object.keys(SCRIPTS));

export function runScript(app: GameApp, entity: PlacedEntity): void {
  const script = SCRIPTS[entity.def.script];
  if (!script) throw new Error(`未實作的劇本：${entity.def.script}`);
  script(app, entity);
}
