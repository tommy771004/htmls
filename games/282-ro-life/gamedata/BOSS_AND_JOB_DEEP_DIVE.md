# RO Life — 全 Boss AI 招式機制與全職業/武器/技能深度拆解報告

本文件整理自遊戲引擎資料表，完整收錄遊戲內 **25 位 Mini-Boss / MVP 的 AI 狀態機與招式參數**、**20 種武器普攻係數**、以及 **23 個職業與主動技能冷卻/效果機制**。

---

## 1. Boss AI 狀態機 (`class _c`) 運作規則

- **全局冷卻 (GCD)**：MVP 為 `2.2 秒`，Mini-Boss 為 `3.0 秒`（開局每招初始冷卻隨機 `0 ~ 3 秒`）。
- **招式判定 (`ik`)**：所有紅圈 (`circle`)、直線衝鋒 (`line`)、扇形揮砍 (`cone`)、同心圓環 (`ring`) 均附帶 `+10 px` (`Zs = 10`) 的碰撞判定寬容值。
- **血量階段強制觸發 (`HE` / `FE`)**：
  - **Kraken (克拉肯)**：HP 降至 **50%** 時強制觸發 **「深淵之怒 (Furia del abismo)」**，一次召喚 `5` 根克拉肯觸手 (`kraken_leg`)。
  - **Moonlight Flower (月夜貓)**：
    - 一般模式 (`HE`)：HP **66%** 觸發 **「月之鐘 (Campana de la luna)」**（9 秒倒數全屏秒殺 `999` 傷害，玩家必須進入半徑 `150 px` 的金鐘安全區）；HP **33%** 觸發 **「封印之鐘 (Campana sellada)」**（23 秒倒數，金鐘被封印，必須在 20 秒內擊殺旁邊生成的 `175,000 HP` 九尾狐首領 `cat_o_nine_tail` 才能解封金鐘保命！）。
    - 無盡之塔模式 (`FE`)：HP **50%** 觸發一次 10 秒倒數的「月之鐘」。

---

## 2. 全 25 位 Mini-Boss 與 MVP 招式表 (`jl`)

| Boss ID | 名稱 (zh-TW / EN) | 類型 | 等級 | 基礎 HP | 基礎傷害 | 招式清單（名稱 / CD / 射程 / 預警時間 / 傷害倍率 / 機制類型） |
| :--- | :--- | :--- | ---: | ---: | ---: | :--- |
| `eclipse` | **Eclipse**<br><small>Eclipse</small> | `mini` | 3 | 3,400 | 18 | • **月之跳躍** (CD 7s, 射程 460, 預警 1300ms, 2.2x, `leap_slam`)<br>• **衝鋒** (CD 8s, 射程 420, 預警 1100ms, 2x, `line_charge`)<br>• **滿月** (CD 11s, 射程 650, 預警 1050ms, 1.6x, `meteor_barrage`) |
| `vocal` | **Vocal**<br><small>Vocal</small> | `mini` | 7 | 7,500 | 25 | • **震耳之歌** (CD 9s, 射程 210, 預警 1500ms, 2.2x, `point_blank_aoe`)<br>• **蟋蟀跳** (CD 10s, 射程 460, 預警 900ms, 1.6x, `leap_slam` (連發×3))<br>• **尖嘯** (CD 7s, 射程 330, 預警 1100ms, 2x, `frontal_cone_cleave`) |
| `toad` | **Toad**<br><small>Toad</small> | `mini` | 4 | 4,600 | 20 | • **泡泡噴射** (CD 8s, 射程 420, 預警 900ms, 1.6x, `bubble_cone_spray` (連發×2))<br>• **蟾蜍跳** (CD 10s, 射程 480, 預警 950ms, 1.9x, `leap_slam` (連發×2))<br>• **呱呱叫** (CD 11s, 射程 210, 預警 1400ms, 2.2x, `point_blank_aoe`)<br>• **青蛙們！** (CD 18s, 射程 700, 預警 瞬發, 召喚 roda_frog×4, `summon_adds`) |
| `dragon_fly` | **Dragon Fly**<br><small>Dragon Fly</small> | `mini` | 5 | 5,600 | 22 | • **俯衝** (CD 9s, 射程 480, 預警 750ms, 1.6x, `line_charge` (連發×3))<br>• **嗡嗡** (CD 10s, 射程 200, 預警 1300ms, 2.1x, `point_blank_aoe`)<br>• **螫刺** (CD 7s, 射程 280, 預警 850ms, 1.9x, `frontal_cone_cleave`)<br>• **蟲群** (CD 16s, 射程 700, 預警 瞬發, 召喚 chonchon×6, `summon_adds`) |
| `mastering` | **Mastering**<br><small>Mastering</small> | `mvp` | 8 | 52,000 | 44 | • **果凍彈跳** (CD 8s, 射程 480, 預警 1000ms, 1.9x, `leap_slam` (連發×3))<br>• **波利雨** (CD 10s, 射程 650, 預警 1100ms, 1.6x, `meteor_barrage`)<br>• **碾壓** (CD 7s, 射程 200, 預警 1400ms, 2.4x, `point_blank_aoe`)<br>• **大躍進** (CD 11s, 射程 650, 預警 1500ms, 2.8x, `leap_slam`)<br>• **果凍波** (CD 14s, 射程 600, 預警 2400ms, 2.2x, `expanding_concentric_rings`)<br>• **分裂成波利！** (CD 20s, 射程 700, 預警 瞬發, 召喚 poring×8, `summon_adds`) |
| `tarou_bite` | **Biting Tarou**<br><small>Biting Tarou</small> | `mini` | 10 | 5,500 | 23 | • **咬擊** (CD 5s, 射程 220, 預警 700ms, 1.5x, `frontal_cone_cleave`)<br>• **狂暴突進** (CD 9s, 射程 480, 預警 800ms, 1.7x, `line_charge` (連發×3)) |
| `tarou_plague` | **Plague Tarou**<br><small>Plague Tarou</small> | `mini` | 10 | 5,500 | 21 | • **咬擊** (CD 5s, 射程 220, 預警 700ms, 1.5x, `frontal_cone_cleave`)<br>• **地下水道瘟疫** (CD 9s, 射程 650, 預警 1000ms, 1.4x, `plague_poison_pools`) |
| `tarou_burrow` | **Burrowing Tarou**<br><small>Burrowing Tarou</small> | `mini` | 10 | 5,500 | 23 | • **咬擊** (CD 5s, 射程 220, 預警 700ms, 1.5x, `frontal_cone_cleave`)<br>• **鑽地** (CD 11s, 射程 650, 預警 950ms, 1.8x, `burrow_ambush_chain`)<br>• **老鼠們！** (CD 16s, 射程 700, 預警 瞬發, 召喚 tarou×3, `summon_adds`) |
| `golden_thief_bug` | **Golden Thief Bug**<br><small>Golden Thief Bug</small> | `mvp` | 12 | 58,000 | 47 | • **黃金鑽地** (CD 14s, 射程 650, 預警 1100ms, 2.2x, `burrow_ambush_chain`)<br>• **黃金甲殼** (CD 18s, 射程 700, 預警 瞬發, 2.6x, `golden_carapace_guard_burst`)<br>• **貪婪** (CD 13s, 射程 650, 預警 1000ms, 1.6x, `checkerboard_coin_crush`)<br>• **黃金衝鋒** (CD 10s, 射程 520, 預警 900ms, 2x, `line_charge` (連發×3))<br>• **黃金大顎** (CD 6s, 射程 250, 預警 900ms, 2.4x, `frontal_cone_cleave`)<br>• **蟲群** (CD 22s, 射程 700, 預警 瞬發, 召喚 thief_bug×4, `summon_adds`) |
| `angeling` | **Angeling**<br><small>Angeling</small> | `mini` | 22 | 35,100 | 30 | • **聖光** (CD 8s, 射程 650, 預警 1000ms, 1.8x, `meteor_barrage`)<br>• **天使之躍** (CD 8s, 射程 460, 預警 1200ms, 2.2x, `leap_slam`)<br>• **天堂審判** (CD 11s, 射程 210, 預警 1500ms, 2.4x, `point_blank_aoe`) |
| `deviling` | **Deviling**<br><small>Deviling</small> | `mini` | 23 | 58,500 | 36 | • **黑暗球** (CD 8s, 射程 650, 預警 1050ms, 1.7x, `meteor_barrage`)<br>• **惡魔之躍** (CD 8s, 射程 460, 預警 1150ms, 2.2x, `leap_slam`)<br>• **地獄衝鋒** (CD 9s, 射程 460, 預警 1000ms, 2.2x, `line_charge`) |
| `ghostring` | **Ghostring**<br><small>Ghostring</small> | `mini` | 13 | 28,000 | 24 | • **哀嘆** (CD 9s, 射程 220, 預警 1500ms, 2.3x, `point_blank_aoe`)<br>• **幽靈之觸** (CD 9s, 射程 650, 預警 1000ms, 1.7x, `meteor_barrage`)<br>• **消逝** (CD 8s, 射程 650, 預警 1100ms, 2.2x, `blink_ambush`) |
| `penomena` | **Penomena**<br><small>Penomena</small> | `mini` | 15 | 28,000 | 29 | • **觸手** (CD 7s, 射程 650, 預警 1000ms, 1.7x, `meteor_barrage`)<br>• **深海之根** (CD 11s, 射程 650, 預警 1000ms, 2x, `burrow_ambush_chain`)<br>• **毒液潮** (CD 10s, 射程 600, 預警 2600ms, 2x, `expanding_concentric_rings`)<br>• **九頭蛇新芽** (CD 18s, 射程 700, 預警 瞬發, 召喚 hydra×4, `summon_adds`) |
| `drake` | **Drake**<br><small>Drake</small> | `mvp` | 15 | 180,000 | 49 | • **軍刀斬** (CD 6s, 射程 500, 預警 750ms, 2.4x, `frontal_cone_cleave`)<br>• **旋風** (CD 16s, 射程 680, 預警 3300ms, 2.6x, `expanding_concentric_rings`)<br>• **膨脹** (CD 13s, 射程 720, 預警 1500ms, 2.2x, `rotating_cone_waves`)<br>• **全員，到我身邊！** (CD 18s, 射程 700, 預警 瞬發, 召喚 pirate_skel×4, `summon_adds`) |
| `deviace` | **Deviace**<br><small>Deviace</small> | `mini` | 17 | 30,000 | 30 | • **貪婪啃咬** (CD 5s, 射程 230, 預警 750ms, 1.6x, `frontal_cone_cleave`)<br>• **深淵突進** (CD 9s, 射程 480, 預警 800ms, 1.7x, `line_charge` (連發×3))<br>• **旋風** (CD 11s, 射程 220, 預警 1400ms, 2.2x, `point_blank_aoe`) |
| `strouf` | **Strouf**<br><small>Strouf</small> | `mini` | 19 | 50,000 | 35 | • **甩尾** (CD 6s, 射程 260, 預警 900ms, 2x, `frontal_cone_cleave`)<br>• **雷爆術** (CD 9s, 射程 650, 預警 1100ms, 2x, `meteor_barrage`)<br>• **湧浪** (CD 13s, 射程 650, 預警 1500ms, 2x, `rotating_cone_waves`)<br>• **魚群！** (CD 18s, 射程 700, 預警 瞬發, 召喚 phen×4, `summon_adds`) |
| `king_dramoh` | **King Dramoh**<br><small>King Dramoh</small> | `mini` | 20 | 80,000 | 40 | • **鉗擊** (CD 6s, 射程 260, 預警 950ms, 2.2x, `frontal_cone_cleave`)<br>• **國王衝鋒** (CD 9s, 射程 520, 預警 1000ms, 2.2x, `line_charge`)<br>• **泡泡** (CD 10s, 射程 650, 預警 1050ms, 1.7x, `meteor_barrage`)<br>• **鋼鐵巨鉗** (CD 12s, 射程 240, 預警 1500ms, 2.4x, `point_blank_aoe`)<br>• **我的子民們！** (CD 18s, 射程 700, 預警 瞬發, 召喚 vadon×4, `summon_adds`) |
| `kraken` | **Kraken**<br><small>Kraken</small> | `mvp` | 20 | 280,000 | 62 | • **觸手列陣** (CD 8s, 射程 700, 預警 900ms, 1.8x, `tentacle_lane_eruption`)<br>• **交叉鞭打** (CD 7s, 射程 650, 預警 1100ms, 2.2x, `cross_tentacle_slam`)<br>• **墨雲** (CD 12s, 射程 650, 預警 1000ms, 1.4x, `ink_cloud_pools`)<br>• **海妖之擁** (CD 13s, 射程 650, 預警 瞬發, , `ring_then_inner_crush`)<br>• **深淵漩渦** (CD 17s, 射程 600, 預警 3.2s, 3x, `abyssal_vortex_pull`)<br>• **海妖觸手！** (CD 22s, 射程 700, 預警 瞬發, 召喚 kraken_leg×3, `summon_adds`) |
| `vagabond_wolf` | **Vagabond Wolf**<br><small>Vagabond Wolf</small> | `mini` | 24 | 93,600 | 42 | • **連續咬擊** (CD 6s, 射程 230, 預警 650ms, 1.3x, `frontal_cone_cleave` (連發×3))<br>• **狼躍** (CD 9s, 射程 480, 預警 1000ms, 2.2x, `leap_slam` (連發×2))<br>• **狂野突進** (CD 9s, 射程 520, 預警 900ms, 2.2x, `line_charge`)<br>• **大地重擊** (CD 11s, 射程 230, 預警 1400ms, 2.4x, `point_blank_aoe`)<br>• **群狼之嚎** (CD 18s, 射程 700, 預警 瞬發, 召喚 wolf×4, `summon_adds`) |
| `skeleton_general` | **Skeleton General**<br><small>Skeleton General</small> | `mini` | 27 | 71,250 | 46 | • **將軍劈砍** (CD 6s, 射程 250, 預警 900ms, 2.2x, `frontal_cone_cleave`)<br>• **衝啊！** (CD 9s, 射程 500, 預警 1000ms, 2.2x, `line_charge`)<br>• **弓箭手，放箭！** (CD 11s, 射程 650, 預警 1100ms, 1.5x, `meteor_barrage`)<br>• **列隊！** (CD 18s, 射程 700, 預警 瞬發, 召喚 skel_soldier×3, `summon_adds`)<br>• **弓箭手，到我身邊！** (CD 22s, 射程 700, 預警 瞬發, 召喚 skel_archer×2, `summon_adds`) |
| `cat_o_nine_tail` | **Cat O' Nine Tails**<br><small>Cat O' Nine Tails</small> | `mini` | 28 | 112,500 | 52 | • **連續爪擊** (CD 6s, 射程 240, 預警 700ms, 1.5x, `frontal_cone_cleave` (連發×2))<br>• **狐火** (CD 10s, 射程 650, 預警 1050ms, 1.5x, `fireball_rain_with_burning_ground`)<br>• **狐步** (CD 9s, 射程 650, 預警 1000ms, 2.2x, `blink_ambush`)<br>• **九尾** (CD 12s, 射程 240, 預警 1400ms, 2.4x, `point_blank_aoe`)<br>• **姊妹們！** (CD 20s, 射程 700, 預警 瞬發, 召喚 nine_tail×3, `summon_adds`) |
| `hyegun` | **Hyegun**<br><small>Hyegun</small> | `mini` | 29 | 150,000 | 58 | • **殭屍跳** (CD 9s, 射程 520, 預警 850ms, 1.7x, `leap_slam` (連發×4))<br>• **符咒** (CD 10s, 射程 650, 預警 1000ms, 1.6x, `meteor_barrage`)<br>• **死亡之擁** (CD 10s, 射程 220, 預警 1300ms, 2.4x, `point_blank_aoe`)<br>• **大躍進** (CD 8s, 射程 480, 預警 1200ms, 2.4x, `leap_slam`)<br>• **甦醒吧！** (CD 18s, 射程 700, 預警 瞬發, 召喚 bon_gun×4, `summon_adds`) |
| `moonlight` | **Moonlight Flower**<br><small>Moonlight Flower</small> | `mvp` | 30 | 1,000,000 | 80 | • **狐火** (CD 10s, 射程 650, 預警 1100ms, 1.7x, `fireball_rain_with_burning_ground`)<br>• **月步** (CD 9s, 射程 650, 預警 1050ms, 2.4x, `blink_ambush`)<br>• **月之舞** (CD 13s, 射程 650, 預警 900ms, 1.8x, `blink_ambush` (連發×3))<br>• **火焰扇** (CD 7s, 射程 280, 預警 1000ms, 2.4x, `frontal_cone_cleave`)<br>• **火之月** (CD 12s, 射程 260, 預警 1600ms, 2.7x, `point_blank_aoe`)<br>• **九尾** (CD 20s, 射程 700, 預警 瞬發, 召喚 nine_tail×3, `summon_adds`) |
| `eddga` | **Eddga**<br><small>Eddga</small> | `mvp` | 25 | 338,000 | 72 | • **烈焰之爪** (CD 6s, 射程 260, 預警 900ms, 2.4x, `frontal_cone_cleave`)<br>• **燃燒衝鋒** (CD 9s, 射程 560, 預警 1000ms, 2.4x, `line_charge`)<br>• **猛虎撲擊** (CD 9s, 射程 480, 預警 1200ms, 2.6x, `leap_slam`)<br>• **地獄咆哮** (CD 12s, 射程 250, 預警 1600ms, 2.6x, `point_blank_aoe`)<br>• **餘燼之雨** (CD 13s, 射程 700, 預警 1300ms, 1.8x, `fireball_rain_with_burning_ground`)<br>• **到我身邊，大腳熊！** (CD 20s, 射程 700, 預警 瞬發, 召喚 bigfoot×3, `summon_adds`) |
| `orc_hero` | **Orc Hero**<br><small>Orc Hero</small> | `mvp` | 1 | 22,500 | 50 | • **斧劈** (CD 6s, 射程 270, 預警 1000ms, 2.6x, `frontal_cone_cleave`)<br>• **戰吼** (CD 11s, 射程 260, 預警 1600ms, 2.4x, `point_blank_aoe`)<br>• **獸人衝鋒** (CD 8s, 射程 520, 預警 1000ms, 2.4x, `line_charge`)<br>• **英勇之躍** (CD 9s, 射程 480, 預警 1300ms, 2.6x, `leap_slam`) |
| `osiris` | **Osiris**<br><small>Osiris</small> | `mvp` | 1 | 33,000 | 60 | • **木乃伊詛咒** (CD 9s, 射程 650, 預警 1100ms, 1.7x, `meteor_barrage`)<br>• **沙漠之沙** (CD 11s, 射程 260, 預警 1600ms, 2.4x, `point_blank_aoe`)<br>• **傳送** (CD 8s, 射程 480, 預警 1100ms, 2.4x, `leap_slam`) |
| `baphomet` | **Baphomet**<br><small>Baphomet</small> | `mvp` | 1 | 60,000 | 80 | • **黑暗風暴** (CD 10s, 射程 700, 預警 1200ms, 1.8x, `meteor_barrage`)<br>• **鐮刀** (CD 6s, 射程 290, 預警 950ms, 2.8x, `frontal_cone_cleave`)<br>• **衝鋒** (CD 8s, 射程 560, 預警 1000ms, 2.6x, `line_charge`)<br>• **地震** (CD 12s, 射程 290, 預警 1700ms, 2.8x, `point_blank_aoe`) |

---

## 3. 全 20 種武器基礎普攻 (`wn` / `xG`) 數值表

> **劍士 (Swordsman) 與商人 (Merchant) 專屬被動修正**：使用單手近戰武器時普攻傷害 **+75%**，使用雙手近戰武器時普攻傷害 **+125%**。

| 普攻 ID | 名稱 (zh-TW) | 對應武器類型 (`wtype`) | 基礎冷卻 (CD) | 基礎傷害 (`dmg`) | 射程 / 彈速 | 擊退 / 特殊效果 |
| :--- | :--- | :--- | ---: | ---: | :--- | :--- |
| `atk_dagger` | **攻擊：短劍** | 단검 (Dagger) | `0.45s` | `9` | 射程 75 px | — |
| `atk_knuckle` | **攻擊：拳套** | 너클 (Knuckle) | `0.5s` | `10.8` | 射程 72 px | — |
| `atk_fist` | **攻擊：拳頭** | Unarmed / Default | `0.55s` | `11` | 射程 70 px | — |
| `atk_gun` | **攻擊：槍** | 권총 (Pistol), 라이플 (Rifle), 샷건 (Shotgun) | `0.6s` | `10` | 彈速 850 px/s | — |
| `atk_katar` | **攻擊：拳刃** | 카타르 (Katar) | `0.62s` | `13.2` | 射程 80 px | — |
| `atk_bow` | **攻擊：弓** | 활 (Bow) | `0.75s` | `13` | 彈速 700 px/s | — |
| `atk_instrument` | **攻擊：樂器** | 악기 (Instrument) | `0.8s` | `13.6` | 彈速 520 px/s | — |
| `atk_shuriken` | **攻擊：風魔手裡劍** | 수리검 (Huuma Shuriken) | `0.85s` | `12` | 彈速 560 px/s | 穿透 1 |
| `atk_rod` | **攻擊：法杖** | 롯드 (Rod/Staff) | `0.85s` | `12` | 彈速 520 px/s | — |
| `atk_infused` | **攻擊：屬性附加** | Mage/Sage Elemental Infused Rod | `0.85s` | `12` | 彈速 560 px/s | +75% dmg (+150% for 2, +225% for 3); Fire +1 target, Water +20% pierce, Wind +2 projectiles |
| `atk_whip` | **攻擊：鞭子** | 채찍 (Whip) | `0.9s` | `15.5` | 射程 150 px | — |
| `atk_book` | **攻擊：書** | 책 (Book) | `0.95s` | `17.6` | 射程 85 px | 擊退 70 |
| `atk_sword` | **攻擊：劍** | 검 (1H Sword) | `0.98s` | `18.4` | 射程 90 px | — |
| `atk_blunt` | **攻擊：鈍器** | 클럽 (Mace/Club) | `1s` | `18.8` | 射程 85 px | 擊退 90 |
| `atk_spear` | **攻擊：長矛** | 창 (1H Spear) | `1.12s` | `19.6` | 射程 130 px | — |
| `atk_axe` | **攻擊：斧** | 도끼 (1H Axe) | `1.27s` | `25` | 射程 90 px | 擊退 100 |
| `atk_twohand` | **攻擊：雙手劍** | 양손검 (2H Sword) | `1.6s` | `37.6` | 射程 110 px | — |
| `atk_lance` | **攻擊：雙手長矛** | 양손창 (2H Spear/Lance) | `1.75s` | `38.3` | 射程 145 px | — |
| `atk_axe2` | **攻擊：雙手斧** | 양손도끼 (2H Axe) | `1.9s` | `46.8` | 射程 115 px | 擊退 140 |
| `atk_infused_melee` | **攻擊：屬性附加（近戰）** | Elemental Infused Melee (Dagger/Fist/Mace) | `inherits base weapons` | `inherits base weapon` | 扇形 90° | +75% dmg (+150% for 2, +225% for 3); Fire +1 target, Water +25% reach, Wind +10% double cast |

---

## 4. 全職業主動技能冷卻、標籤與異常狀態成長表 (`EE` / `CE` / `kE`)

| 技能 ID | 名稱 (zh-TW / EN) | 類型 (`TE`) | 基礎 CD (`EE`) | 標籤 (`CE`) | 附加狀態與等級成長 (`kE`) | Lv1 說明 (zh-TW) |
| :--- | :--- | :--- | ---: | :--- | :--- | :--- |
| `bash` | **狂擊**<br><small>Bash</small> | `single` | `5s` | `melee, single, physical, neutral` | stun: base 0, +0.1/lv (max 0.8) | 對最近的敵人施以強力一擊。可學會暈眩效果。 |
| `magnum` | **怒爆**<br><small>Magnum Break</small> | `aoe` | `10s` | `aura, area, physical, fire` | — | 在身邊引發火焰爆炸並擊退敵人。 |
| `sword_dance` | **劍舞**<br><small>Sword Dance</small> | `aoe` | `13s` | `aura, area, physical, neutral` | — | 劍舞：從你身邊向外擴展，分三段斬擊脈衝，一段比一段遠。離你越近的敵人會全部吃到。 |
| `provoke` | **挑釁**<br><small>Provoke</small> | `control` | `15s` | `aura, area, neutral` | mark: base 0.2, +0.05/lv | 挑釁附近敵人：5 秒內受到的傷害 +20%。 |
| `demoralizing_shout` | **降低士氣的吶喊**<br><small>Demoralizing Shout</small> | `control` | `20s` | `aura, area, physical, neutral` | weaken: base 0.2, +0.02/lv (max 0.4) | 降低附近敵人士氣的吶喊：6 秒內造成的傷害減少 20%，並對其造成少量傷害。 |
| `shield_bash` | **盾牌衝擊**<br><small>Shield Bash</small> | `projectile` | `10s` | `melee, projectile, pierce, physical, neutral` | — | 向最近的敵人投射光之盾：擊中沿途所有目標。需要盾牌。 |
| `endure` | **霸體**<br><small>Endure</small> | `buff` | `25s` | `buff` | reduction: base 0.24, +0.04/lv (max 0.6) | 你硬扛攻擊：8 秒內受到傷害 -24%。 |
| `hp_recovery` | **快速恢復**<br><small>Increase HP Recovery</small> | `buff` | `20s` | `buff` | heal: base 10, +3/lv | 10 秒內每秒回復 1 HP（共 10 HP）。 |
| `firebolt` | **火箭術**<br><small>Fire Bolt</small> | `multi` | `6s` | `ranged_strike, multi, burst, magic, fire` | — | 火球從天而降砸向最近的敵人。每級多一發。 |
| `coldbolt` | **冰箭術**<br><small>Cold Bolt</small> | `multi` | `6s` | `ranged_strike, multi, burst, magic, water` | slow: base 1.7, +0.3/lv; freeze: base 0, +0.08/lv (max 0.8) | 冰箭從天而降並造成緩速（可學會冰凍）。每級多一發。 |
| `lightning` | **雷擊術**<br><small>Lightning Bolt</small> | `multi` | `7s` | `ranged_strike, multi, burst, magic, wind` | — | 對隨機敵人降下閃電。每級多一發。 |
| `soul_strike` | **聖靈召喚**<br><small>Soul Strike</small> | `multi` | `3.5s` | `ranged_strike, multi, burst, magic, ghost` | — | 靈魂彎曲飛向敵人（對不死族 x2）。每級多一個靈魂。 |
| `napalm` | **心靈爆破**<br><small>Napalm Beat</small> | `aoe` | `6s` | `ranged_strike, area, magic, ghost` | — | 對最近的敵人及其周圍施以幽靈打擊。 |
| `fire_wall` | **火焰之壁**<br><small>Fire Wall</small> | `zone` | `14s` | `ground, area, persistent, magic, fire` | — | 在你與敵人之間升起火牆。 |
| `frost_diver` | **冰凍術**<br><small>Frost Diver</small> | `single` | `7s` | `ranged_strike, single, magic, water` | freeze: base 2.25, +0.3/lv | 沿地面延伸的冰痕，凍結敵人。不造成傷害：純控場。 |
| `sight` | **火狩**<br><small>Sight</small> | `orbit` | `14s` | `orbit, magic, fire` | — | 兩團環繞你旋轉的火焰。 |
| `thunderstorm` | **雷爆術**<br><small>Thunderstorm</small> | `aoe` | `12s` | `ground, area, magic, wind` | — | 在一群敵人上方降下雷暴。 |
| `double_strafe` | **二連矢**<br><small>Double Strafe</small> | `projectile` | `3s` | `projectile, single, physical, neutral` | — | 極快的箭矢齊射，左右交替彎曲射向最近的敵人。 |
| `arrow_shower` | **箭雨**<br><small>Arrow Shower</small> | `aoe` | `10s` | `ranged_strike, area, physical, neutral` | — | 對敵群射出扇形箭矢：命中前方所有敵人並擊退。射出 2 輪。 |
| `arrow_rain` | **箭矢暴雨**<br><small>Arrow Rain</small> | `aoe` | `10s` | `ground, area, physical, neutral` | — | 向天空射出一輪箭矢，隨即落在被標記的敵群上。 |
| `retreat` | **撤退**<br><small>Retreat</small> | `single` | `9s` | `projectile, single, pierce, physical, neutral` | — | 你向後跳離最近的敵人，落地時射出強力一箭，貫穿直線上的一切。1.5 秒內免疫傷害。 |
| `arcane_shot` | **奧術射擊**<br><small>Arcane Shot</small> | `single` | `6s` | `ranged_strike, single, physical, hybrid, ghost` | — | 對射程內最大敵群的中心發射奧術射擊：命中時釋放脈衝，把附近怪物（頭目除外）拉向中心。 |
| `fire_arrow` | **火焰箭**<br><small>Fire Arrow</small> | `aoe` | `8s` | `ranged_strike, area, physical, hybrid, fire` | — | 向最近的敵人拋射火焰箭：如火球般爆炸，對命中範圍內的一切造成傷害並點燃，火花濺射到更外圍燃燒周圍敵人。 |
| `arrow_repel` | **衝鋒箭**<br><small>Arrow Repel</small> | `projectile` | `8s` | `projectile, pierce, physical, neutral` | — | 巨大箭矢，貫穿所有敵人並將其遠遠擊退。 |
| `concentration` | **心神凝聚**<br><small>Improve Concentration</small> | `buff` | `25s` | `buff` | agiDex: base 0.12, +0.02/lv | 10 秒內：AGI 與 DEX +12%。 |
| `heal` | **治癒術**<br><small>Heal</small> | `aoe` | `10s` | `aura, area, magic, holy` | heal: base 13, +4/lv | 光之脈衝：治療自己並傷害周圍敵人（對不死族 x2）。超出最大 HP 的治療量會儲存為恩典：下一次治癒術會將其釋放為額外傷害（最多 +100%）。 |
| `holy_light` | **神聖之光**<br><small>Holy Light</small> | `multi` | `6s` | `ranged_strike, multi, magic, holy` | — | 對視野內的頭目降下聖光柱；若無頭目則落在最大的敵群上：非常強的一擊，也會波及周圍（對不死族 x2）。 |
| `ruwach` | **Ruwach**<br><small>Ruwach</small> | `orbit` | `14s` | `orbit, magic, holy` | — | 環繞你旋轉的光球：碰到敵人時爆裂，傷害周圍所有人，不久後再出現（對不死族 x2）。依 ATK 或 MATK 中較高者成長。 |
| `decrease_agi` | **緩速術**<br><small>Decrease AGI</small> | `control` | `14s` | `aura, area, magic, holy` | slow: base 2.4, +0.4/lv | 使周圍敵人緩速並造成少量神聖傷害的波動。神聖之光與光獵對緩速中的敵人傷害 +30%。 |
| `signum_crucis` | **Signum Crucis**<br><small>Signum Crucis</small> | `zone` | `15s` | `ground, area, persistent, magic, holy` | holy: base 0.2, +0.04/lv | 以神聖之環淨化周圍地面 6 秒：每秒傷害圈內敵人並加以標記。被標記的敵人受到你所有神聖技能的傷害提高（對不死族 x3）。 |
| `aqua_benedicta` | **Aqua Benedicta**<br><small>Aqua Benedicta</small> | `zone` | `14s` | `ground, area, persistent, magic, holy` | heal: base 6, +1.5/lv | 將聖水灑向最近的敵群：水窪持續 6 秒，每秒傷害站在其中的敵人，你站在裡面時會回復 HP。 |
| `blessing` | **天使之賜福**<br><small>Blessing</small> | `buff` | `25s` | `buff` | dmg: base 0.12, +0.02/lv; cast: base 0.2, +0.04/lv | 為自己賜福 12 秒：傷害提高、詠唱加快。 |
| `holy_smite` | **神聖重擊**<br><small>Holy Smite</small> | `single` | `5s` | `melee, single, physical, holy` | fervor: base 3, +1/lv (max 8) | 對最近的敵人施以受祝福的錘擊：兇猛的物理打擊並使其短暫暈眩。每命中一個敵人就祝福你的武器一次：接下來的普通攻擊傷害 +50%，並釋放擊中周圍的神聖波動。需要鈍器、拳套或書本。 |
| `envenom` | **施毒**<br><small>Envenom</small> | `single` | `2.5s` | `melee, single, physical, neutral` | poison: base 1, +0.2/lv | 帶毒的快速刺擊（持續傷害）。 |
| `sand_attack` | **噴砂**<br><small>Sand Attack</small> | `aoe` | `7s` | `melee, area, physical, earth` | blind: base 2.3, +0.3/lv | 撒出扇形沙子：傷害前方所有敵人並致盲 2.3 秒（致盲的敵人會四處遊蕩不攻擊）。 |
| `throw_stone` | **投擲石頭**<br><small>Throw Stone</small> | `single` | `6s` | `melee, projectile, single, physical, neutral` | stun: base 1.15, +0.2/lv | 向最近的敵人丟石頭：紮實的一擊並使其暈眩。 |
| `hiding` | **隱匿**<br><small>Hiding</small> | `buff` | `20s` | `buff` | dmg: base 0.1, +0.02/lv | 每隔一段時間隱身 1.8 秒：敵人碰不到你且你移動更快。現身後 4 秒內傷害提高 10%。 |
| `poison_bomb` | **毒藥瓶**<br><small>Poison Bomb</small> | `aoe` | `11.5s` | `melee, area, physical, neutral` | poison: base 1, +0.2/lv | 向一群敵人丟出毒藥瓶：爆裂後傷害所有敵人，並使其重度中毒 6 秒。 |
| `shadowstep` | **影步**<br><small>Shadowstep</small> | `buff` | `16s` | `buff, melee, physical` | stun: base 1.5, +0.2/lv; flee: base 0.15, +0.01/lv (max 0.6) | 出現在附近最強敵人的背後並使其暈眩；2 秒內迴避 +15%、移動速度 +50%。每次跳躍後 0.5 秒內免疫傷害。 |
| `fan_of_knives` | **飛刀扇**<br><small>Fan of Knives</small> | `aoe` | `9s` | `melee, aura, area, physical, neutral` | — | 在身邊連續擲出兩輪扇形飛刀，命中附近所有敵人。 |
| `caltrops` | **撒菱**<br><small>Caltrops</small> | `zone` | `9s` | `melee, ground, area, persistent, physical, neutral` | — | 在你與敵人之間撒下一排撒菱：踩到的敵人受到傷害並減速。 |
| `mammonite` | **金錢攻擊**<br><small>Mammonite</small> | `single` | `4.5s` | `melee, single, physical, neutral` | — | 對最近的敵人施以非常強力的金幣打擊。 |
| `cart_revolution` | **手推車攻擊**<br><small>Cart Revolution</small> | `aoe` | `11s` | `melee, area, physical, neutral` | — | 用手推車撞向敵人：擊中周圍所有敵人並將其擊飛。 |
| `crazy_uproar` | **大聲吶喊**<br><small>Crazy Uproar</small> | `buff` | `25s` | `buff` | — | 戰吼：接下來 3 個技能多波及 1 個敵人。 |
| `enlarge_weight` | **負重量上升**<br><small>Enlarge Weight Limit</small> | `buff` | `50s` | `buff` | — | HP 低於 20% 時架起手推車：推開周圍所有敵人，4 秒內受到傷害 -80%，但移動速度降低 80%。 |
| `zeny_rain` | **金幣雨**<br><small>Zeny Rain</small> | `aoe` | `9s` | `melee, ground, area, physical, neutral` | — | 讓金幣如雨般落在一片區域：3 次脈衝，每次暈眩 1.2 秒，並在 10 秒內使金錢攻擊對被波及者 +50%。頭目不會暈眩：在這段時間內改為受到所有傷害提高 30%。 |
| `cart_rush` | **手推車衝撞**<br><small>Cart Rush</small> | `aoe` | `9s` | `melee, area, physical, neutral` | — | 推著手推車朝前進方向衝鋒：輾過擋路的敵人並將其推開，殺出一條路。 |
| `vending` | **露天商店**<br><small>Vending</small> | `zone` | `18s` | `melee, ground, area, physical, neutral` | — | 擺下一台自動販賣機：附近敵人會在 2 秒內朝它衝去，接著它爆成金幣雨，傷害周圍所有敵人。 |
| `tornado_kick` | **迴旋踢**<br><small>Tornado Kick</small> | `aoe` | `8s` | `aura, area, physical, neutral` | — | 迴旋踢，擊中並擊退周圍敵人。 |
| `heel_drop` | **砸踢**<br><small>Heel Drop</small> | `single` | `6s` | `melee, single, physical, neutral` | stun: base 1.15, +0.2/lv | 對最近的敵人施以腳跟踢，使其暈眩 1.1 秒。 |
| `roundhouse` | **轉身踢**<br><small>Roundhouse</small> | `aoe` | `8s` | `aura, area, physical, neutral` | — | 迴旋踢，擊中並拋飛周圍敵人。 |
| `counter_kick` | **還擊踢**<br><small>Counter Kick</small> | `aoe` | `6s` | `aura, area, physical, neutral` | — | 被擊中時反擊（每 3.6 秒），造成範圍傷害。 |
| `sprint` | **跑步**<br><small>Sprint</small> | `buff` | `18s` | `buff` | speed: base 0.35, +0.05/lv | 拔腿狂奔：5 秒內速度 +35%。 |
| `shuriken` | **投擲飛鏢**<br><small>Throw Shuriken</small> | `projectile` | `4s` | `projectile, single, physical, neutral` | — | 貫穿的手裡劍。 |
| `kunai` | **投擲飛刀**<br><small>Throw Kunai</small> | `projectile` | `5s` | `projectile, single, physical, neutral` | — | 極快的扇形苦無。 |
| `huuma` | **投擲風魔飛鏢**<br><small>Throw Huuma Shuriken</small> | `projectile` | `8s` | `projectile, pierce, return, physical, neutral` | — | 巨型手裡劍，飛出再飛回，貫穿一切。 |
| `flaming_petals` | **火炎花**<br><small>Flaming Petals</small> | `aoe` | `10s` | `ground, area, magic, fire` | — | 落在敵群上的火焰花瓣。 |
| `lightning_strike` | **雷擊碎**<br><small>Lightning Strike</small> | `aoe` | `12s` | `aura, area, magic, wind` | — | 在你周圍釋放電流。 |
| `triple_action` | **三連攻擊**<br><small>Triple Action</small> | `projectile` | `4s` | `projectile, single, physical, neutral` | — | 扇形三連射。 |
| `rapid_shower` | **五連擊**<br><small>Rapid Shower</small> | `projectile` | `6s` | `projectile, single, physical, neutral` | — | 對最近的敵人連射子彈。 |
| `spread_attack` | **火力全開**<br><small>Spread Attack</small> | `aoe` | `8s` | `aura, area, physical, neutral` | — | 霰彈槍轟擊周圍所有敵人。 |
| `desperado` | **Desperado**<br><small>Desperado</small> | `aoe` | `12s` | `aura, area, physical, neutral` | — | 向四面八方射擊。 |
| `ground_drift` | **四面埋伏**<br><small>Ground Drift</small> | `aoe` | `10s` | `ground, area, physical, neutral` | — | 在敵群上爆炸的手榴彈。 |
| `tracking` | **百步穿楊**<br><small>Tracking</small> | `single` | `10s` | `ranged_strike, single, physical, neutral` | — | 對視野內最強的敵人精準射擊。 |
