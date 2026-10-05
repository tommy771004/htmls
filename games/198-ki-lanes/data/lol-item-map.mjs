// 《英雄聯盟》裝備 → 本作裝備的對照表（逐件手填）。tools/lol-items.mjs 依此產生 src/items-lol.js。
// key 是原作編號（data/lol-items.json 的 id）。欄位：
//   id    本作 id（英數，全場唯一）
//   name  本作名稱（七龍珠、火影、海賊王風格；不沿用原作名稱）
//   psv   被動：{ 被動 key: { k: 種類, ...參數 } }，種類見 src/traits.js 的「裝備效果」一覽；同 key 不疊加
//   act   主動：{ id, cd, name, ... }，見 traits.js 的 useActive
//   note  商店裡顯示的被動／主動說明
//   stats 覆寫換算後的屬性（少用）；gold 覆寫總價
// 數值依本作比例調過：傷害、護盾以原作數值為準，防禦與穿透 ×0.4（本作防禦約是原作的四成）。

// 已經有的裝備（htmls-20 的 19 件與舊道具）：沿用本作的 id 與手調數值，只拿來當新裝備的材料
export const REUSE = {
  1036: 'weights', 1028: 'gi', 1027: 'capsule', 1052: 'scroll', 1018: 'gloves', 1029: 'cloth', 1033: 'cape', 3070: 'tear',
  1001: 'boots', 3006: 'nimbus', 3057: 'sheen', 1053: 'fang', 1038: 'brave', 3802: 'tome', 3076: 'bramble',
  3078: 'trinity', 3031: 'zsword', 3072: 'majin', 3157: 'hourglass', 3026: 'halo', 3075: 'thorn', 3089: 'beerus', 3003: 'staff', 3139: 'holy',
};

const helping = { k: 'onhit', flat: 5, minionOnly: true };
const HELP = '伸出援手：普攻對小兵多造成 5 傷害。';

export const MAP = {
  /* ---------------- 基礎 ---------------- */
  1004: { id: 'bead', name: '聖水滴' },
  1042: { id: 'kunai', name: '苦無' },
  2022: { id: 'crystal', name: '查克拉結晶' },
  1006: { id: 'pill', name: '兵糧丸' },
  1082: { id: 'majinmark', name: '魔人印記', psv: { glory: { k: 'stacks', ap: 4, max: 10, lose: 5 } }, note: '榮耀：參與擊殺英雄疊 1 層（最多 10 層），每層氣功強度 +4；陣亡失去 5 層。' },
  1056: { id: 'dring', name: '修行戒指', psv: { drain: { k: 'mpRegen', v: 1, combat: 2 }, helping }, note: `汲取：每秒回 1 魔力，傷害英雄後 5 秒內每秒回 2。${HELP}` },
  1086: { id: 'dbow', name: '練習彈弓', note: '' },
  1054: { id: 'dshield', name: '道場木盾', psv: { endure: { k: 'regenHit', v: 5 }, helping }, note: `專注忍耐：受到英雄傷害後 8 秒內每秒回 5 血。${HELP}` },
  1055: { id: 'dblade', name: '木刀', note: '' },
  1120: { id: 'dhelm', name: '道場頭盔', psv: { helping }, note: HELP },
  1083: { id: 'scythe', name: '割草鐮', psv: { reap: { k: 'onhitHeal', v: 3 } }, note: '收割：普攻命中回 3 血。' },
  1026: { id: 'tag', name: '起爆符' },
  1037: { id: 'pick', name: '海軍鐵鎬' },
  1058: { id: 'pole', name: '如意棒' },

  /* ---------------- 鞋子 ---------------- */
  3158: { id: 'leafboots', name: '木葉忍鞋', note: '洞見：召喚師技能加速 +10（召喚師技能之後加入）。' },
  3171: { id: 'bloodboots', name: '血繼忍鞋', psv: { noxhaste: { k: 'msAfterCast', ms: 0.12, dur: 4 } }, note: '洞見：召喚師技能加速 +20。諾克薩斯加速：施放技能後 4 秒內移速 +12%。' },
  3008: { id: 'pirateboots', name: '海賊靴', psv: { plunder: { k: 'stacks', ov: 0.006, max: 10 } }, note: '擊殺：參與擊殺英雄時全能吸血 +0.6%，最多 10 層。' },
  3168: { id: 'phoenixboots', name: '不死鳥之靴', psv: { plunder: { k: 'stacks', ov: 0.006, max: 10 }, eternal: { k: 'eternal', dmg: 0.04, heal: 0.12 } }, note: '擊殺：參與擊殺英雄時全能吸血 +0.6%，最多 10 層。永恆不滅：血量高於一半時傷害 +4%，低於一半時受到的治療 +12%。' },
  3009: { id: 'skyboots', name: '舞空靴', psv: { swift: { k: 'slowResist', v: 0.25 } }, note: '身輕如燕：緩速效果 -25%。' },
  3170: { id: 'flickerboots', name: '瞬身靴', psv: { swift: { k: 'slowResist', v: 0.25 }, zeal: { k: 'adaptiveMs', pct: 0.05 } }, note: '身輕如燕：緩速效果 -25%。諾克薩斯狂熱：獲得等於移速 5% 的適性之力。' },
  3020: { id: 'mageboots', name: '魔導士之靴' },
  3175: { id: 'archboots', name: '大魔導士之靴' },
  3047: { id: 'steelboots', name: '海軍鋼靴', psv: { plated: { k: 'autoReduce', pct: 0.1 } }, note: '護甲：承受的普攻傷害 -10%。' },
  3174: { id: 'tekkaiboots', name: '鐵塊戰靴', psv: { plated: { k: 'autoReduce', pct: 0.1 }, physShield: { k: 'hitShield', type: 'phys', base: 40, lv: 6, cd: 20 } }, note: '護甲：承受的普攻傷害 -10%。諾克薩斯耐力：受到英雄的物理傷害後，得到 40＋每級 6 的護盾 5 秒（20 秒一次）。' },
  3111: { id: 'windboots', name: '疾風草鞋' },
  3173: { id: 'seastoneboots', name: '海樓石靴', psv: { magShield: { k: 'hitShield', type: 'magic', base: 40, lv: 6, cd: 20 } }, note: '諾克薩斯意志力：受到英雄的技能傷害後，得到 40＋每級 6 的護盾 5 秒（20 秒一次）。' },

  /* ---------------- 史詩 ---------------- */
  3114: { id: 'idol', name: '神樹之像' },
  3144: { id: 'kabuto', name: '狙擊王彈弓', psv: { bullseye: { k: 'heroProc', dmg: 20, lvDmg: 2, cd: 8, autoCdr: 1 } }, note: '正中紅心：傷害英雄時追加 20＋每級 2 的技能傷害（8 秒一次，每次普攻縮短 1 秒）。' },
  1043: { id: 'windbow', name: '風魔弓', psv: { sting: { k: 'onhit', flat: 15 } }, note: '刺針：普攻多造成 15 物理傷害。' },
  6690: { id: 'feather', name: '疾風羽' },
  1031: { id: 'mesh', name: '鎖帷子' },
  3066: { id: 'skycape', name: '舞空披風' },
  3067: { id: 'firestone', name: '火之意志石' },
  3123: { id: 'executioner', name: '斬首刀', psv: { gwPhys: { k: 'gw', type: 'phys', pct: 0.4 } }, note: '重創效果：對英雄造成物理傷害時施加重傷 3 秒（受到的治療 -40%）。' },
  3801: { id: 'cellbrace', name: '細胞護腕' },
  3916: { id: 'cursebead', name: '詛咒之珠', psv: { gwMagic: { k: 'gw', type: 'magic', pct: 0.4 } }, note: '重創效果：對英雄造成技能傷害時施加重傷 3 秒（受到的治療 -40%）。' },
  1057: { id: 'kicape', name: '抗氣斗篷' },
  3108: { id: 'scroll2', name: '禁術卷軸' },
  1011: { id: 'apebelt', name: '大猿腰帶' },
  2508: { id: 'amaterasu', name: '天照之燼', psv: { kindle: { k: 'skillBurn', dps: 5, dur: 3, monster: 45 } }, note: '燃起燼燄：技能命中後灼燒 3 秒共 15 技能傷害，對野怪再多 45。' },
  3024: { id: 'iceshield', name: '冰河圓盾' },
  3113: { id: 'blueflame', name: '蒼炎' },
  4642: { id: 'yata', name: '八咫鏡' },
  6660: { id: 'firefist', name: '火拳護甲', psv: { immolate: { k: 'immolate', dps: 12, hpK: 0.01, r: 3 } }, note: '獻祭：造成或承受傷害後 3 秒內，每秒對 3 公尺內的敵人造成 12＋額外血量 1% 的技能傷害（對小兵與野怪 ×1.5）。' },
  3082: { id: 'tekkai', name: '鐵塊鎧甲', psv: { rock: { k: 'autoReduce', pct: 0.06 } }, note: '堅若磐石：承受的普攻傷害 -6%。' },
  3134: { id: 'anbu', name: '暗部短刀' },
  3133: { id: 'hammer', name: '金剛錘' },
  2019: { id: 'marine', name: '海軍徽章' },
  3044: { id: 'warhammer', name: '戰鬥錘', psv: { rage: { k: 'msOnAuto', ms: 0.06, dur: 2 } }, note: '暴虐：普攻後 2 秒內移速 +6%。' },
  3145: { id: 'capsulegen', name: '膠囊動力機', psv: { revved: { k: 'heroProc', dmg: 50, lvDmg: 3, cd: 40 } }, note: '引擎發動：傷害英雄時追加 50＋每級 3 的技能傷害（40 秒一次）。' },
  4630: { id: 'blight', name: '氣破寶石' },
  2021: { id: 'drill', name: '螺旋鑽' },
  3051: { id: 'forgeaxe', name: '熔爐斧' },
  3077: { id: 'seaking', name: '海王類之牙', psv: { cleave: { k: 'cleave', pct: 0.4, r: 2.6 } }, act: { id: 'crescent', cd: 10, ad: 0.8, r: 3.2, name: '新月' }, note: '劈砍：近戰普攻對目標周圍的敵人造成 40% 傷害。主動・新月（2／3 鍵）：對周圍 3 公尺的敵人造成 80% 攻擊的物理傷害，冷卻 10 秒。' },
  3086: { id: 'twinblades', name: '雙刀流' },
  3211: { id: 'reaper', name: '死神斗篷' },
  3140: { id: 'byakusash', name: '白眼飾帶', act: { id: 'cleanse', cd: 90, dur: 0, name: '水銀' }, note: '主動・水銀（2／3 鍵）：解除暈眩、冰凍與緩速（擊飛除外），冷卻 90 秒。' },
  3147: { id: 'anbumask', name: '暗部面具', psv: { madness: { k: 'ramp', per: 0.02, max: 0.06 } }, note: '狂亂：與英雄交戰時，每秒傷害 +2%，最多 +6%。' },
  3155: { id: 'samehada', name: '鮫肌', psv: { lifeline: { k: 'lifeline', magicOnly: true, at: 0.3, base: 110, lv: 0, dur: 2.5, cd: 90 } }, note: '命脈：受到技能傷害後血量低於 30% 時，得到 110 的護盾 2.5 秒（90 秒一次）。' },
  3803: { id: 'chakracube', name: '查克拉魔方', psv: { eternity: { k: 'manaHit', pct: 0.1 }, refund: { k: 'refund', pct: 0.25 } }, note: '永續之力：受到英雄傷害時回復 10% 傷害量的魔力；施放技能退還 25% 的魔力消耗。' },
  6670: { id: 'noonquiver', name: '天弓箭筒' },
  2020: { id: 'kubikiri', name: '首切刀柄' },
  3035: { id: 'seastone', name: '海樓石彈' },
  2420: { id: 'timebrace', name: '時之護腕', act: { id: 'stasis', cd: 0, dur: 2.5, once: 'brokenbrace', name: '時間暫停' }, note: '主動・時間暫停（2／3 鍵，只能用一次）：2.5 秒內無敵但無法行動，之後變成碎裂的時之護腕。' },
  2421: { id: 'brokenbrace', name: '碎裂的時之護腕', hidden: true, note: '破碎時間：已經用過，仍可合成。' },
  4632: { id: 'susanoo', name: '須佐護壁', psv: { annul: { k: 'spellShield', cd: 40 } }, note: '無效：擋下下一次敵方英雄的技能（40 秒一次）。' },
};
