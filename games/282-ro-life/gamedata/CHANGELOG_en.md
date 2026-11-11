# Changelog

English version of CHANGELOG.md, shown in the game ("News" button, one tab per release) when it is set to English.
Same sections as the Spanish file: «Unreleased» is the draft for the next block and players don't see it; when the
block goes live it is renamed to its version and date (`## Beta 0.2 — November 20, 2026`; 1.0 is kept for leaving beta).
Since Beta 0.2 every item starts with its tag: `[New]`, `[Change]`, `[Improvement]` or `[Fix]` (shown as a coloured badge).

## Beta 0.6.1 — November 11, 2026

A fix for the square being left half-loaded after an update.

### Prontera
- [Fix] After an update, some players were missing NPCs in the square (the Tower Guardian) and some clicks didn't work, such as opening the character sheet, for a few hours. The game now always asks for the sprite list of its own version, and if one is missing, the other NPCs still show up.

## Beta 0.6 — November 11, 2026

The square is split into several named lobbies, the Postman brings in-game mail, x2 and x4 speed on tower floors you already cleared, stories you can skip and lots of fixes.

### Prontera
- [New] Lobbies: the square is split into several named worlds (Asgard, Midgard, Alfheim, Vanaheim), each with its own channels, chat and parties. When you enter Prontera you pick one: the list shows whether it is normal, crowded or full, and marks the one you used last time. When you come back from a run you stay in the same one. You can switch from the label at the top (above the channels). Your friends show up whatever lobby they are in, and whispers and friend requests still reach them. The Endless Tower is the same for everyone. If they are all full, you play offline and the game checks again every minute. You can invite a friend who is in another lobby to your party (the «Invite» button in your friends list): if they accept, they move to your lobby, and when they leave the party the game offers to take them back to theirs.
- [New] The Mail Carrier, in the fountain plaza (south-east, across from the Librarian): the game’s mail. Notices and gifts from the team arrive there, along with anything we recover for your account; attached items are picked up with “Collect”. A “!” shows when you have new mail. Account only.
- [Improvement] Ore Merchant: buttons to select all gear of one quality at once (Common, Uncommon, Rare, Epic or Legendary), within the type filter you have on; anything a character is wearing is left out. Press again to deselect. “Clear selection” removes every mark, and if the sale includes epic or legendary pieces, the confirmation warns you.
- [Improvement] Inventory: “Protect” button in each piece's details. Protected pieces show a padlock, can't be thrown away and the Ore Merchant won't buy them: they aren't marked when you press a quality or one by one. “Unprotect” undoes it. If you trade one away, the other player gets it unprotected.

### Interface and texts
- [Improvement] Title screen: when your account is already signed in, the “Enter” tab no longer shows (you play from the first tab, your account). Below “Play!” there is a “Leave” button that signs you out and brings back Guest, Enter and Create account.
- [Improvement] Inventory (on desktop): hovering an item, card or material shows its stats, no click needed.
- [New] Librarian: two new sections. “Deity by job” shows what every skill’s Deity does for each job (with a slider to see it at each rank) plus the stat Deity. “Gear by slot” lists all the gear that drops in the stages by slot: its ★ (the piece’s own bonus) by tier, and which stage and monster drop it.
- [Change] “Delete progress” is no longer on the character select screen next to “Delete”: it is now under Options › Game › Account (only when Options are opened from the character select screen), and you have to type your account name to confirm it. “Delete” is still there to delete a single character.
- [Improvement] Pieces that can't be traded now show a “Not tradable” tag in their details and tooltip (inventory, equipment, merchant, trade and inspect): starter gear and anything bound to your account, like what you got while playing as a guest.
- [Fix] If loading on the title screen gets stuck (for example after clearing the site data in your browser), the game drops its saved copy and reloads by itself, like a first visit. If it still can’t load, the button says so and lets you retry instead of loading forever.
- [Improvement] News: on large screens the releases are listed in a column on the left with their own scroll and the text next to them, so you can switch between them without losing sight of the list. On mobile it stays as before.

### Party
- [New] If the leader leaves a party run or loses their connection, another party member takes it over and the run goes on for everyone else, with the monsters where they were. Before, it ended for everyone.
- [Fix] When a party run ends because the leader left, it no longer sits for a few seconds with the monsters frozen, and the end screen says “Run finished” instead of “You died”.

### Stories
- [New] If another character on your account has already cleared a story, you can skip it with “Skip story” at the Expedition Captain: you get its reward as if you had cleared it (in the Sunken Ship you pick the weapon; in Prontera Castle, your 2nd job and the badge), but no EXP. It counts as cleared, so the stage that required it opens too.

### Classes
- [Change] Acolyte: Blessing is cast as soon as its cooldown ends, even with no monsters nearby. It is a buff, so it no longer waits for the horde to arrive.
- [Fix] Acolyte: the Epiclesis tree of light (Aqua Benedicta Deity) now gets the same extra duration as the puddle (it was always 5 s, and more duration only delayed it), fires one more ray per extra target from talents and applies your upgrades' on-hit effects.
- [Fix] Acolyte: Divine Judgment (Signum Crucis) now uses your Holy Light: as many columns as its targets, its radius with upgraded area and its on-hit effects, on top of its damage.
- [Fix] Merchant: Zeny Rain no longer spends a Crazy Uproar charge (it gave it no extra enemy: it is an area). The charge is kept for the next skill that does use it.
- [Fix] Mage: Fire Bolt, Cold Bolt and Lightning Bolt no longer land on the same monsters: a bolt keeps its targets until its hit lands (it used to release them when the cast ended, while the bolt was still falling). If everything in its range is already another bolt's target, it reaches farther to go after others; with free targets in range, nothing changes.

### Endless Tower
- [Change] Moonlight Flower in the tower: a single bell, at 50% health and with 10 seconds to get under it, with no sealed bell and no Cat O' Nine Tails. The two long bells ate up the floor's time and there wasn't enough left to kill her. Stages are unchanged.
- [New] x2 and x4 speed in the tower: on floors that character has already cleared, the speed button on the scoreboard (or the V key) speeds the run up. While it is sped up, graphics drop to the minimum; when you reach a floor you have not cleared yet it goes back to normal speed and your graphics on its own. The run counts the same. On slower devices it may not reach x4.
- [Fix] Connection drops in the tower: the server now waits 10 minutes (it was 2) for the game to reconnect, and what you play during the drop counts. If the drop lasts longer, the run ends right then with what reached the server, instead of going on without counting. The Blood Savage dye is given while you are connected.

### Bosses
- [Fix] Moonlight Flower: while she hides during the bell, her poisons, bleeds and burns are paused and resume when she comes back, instead of running out. And no skill targets her while she is hidden: Shadowstep no longer takes you out of the bell by jumping to her invisible spot.

### Gear and cards
- [Change] In-run chests: no more stat cards your character doesn't use. Cast speed only shows up if one of your skills has a cast time (Thief and Rogue won't see it), the STR Dish and Deity of Might only with physical damage, and the INT Dish and Deity of Thought only with magic or healing.
- [Improvement] The warning that a piece can break when refining now shows its icon in a slot with its quality colour, so you can clearly see which piece it is.
- [Improvement] The blacksmith now shows each piece's card slots (in the list, in its details and in the break warning) with diamonds like in the equipment screen: ◆ with a card, ◇ empty. That way you won't break a piece with cards by accident.

### Performance
- [Improvement] Keeping monsters apart from each other takes much less calculation: with big hordes, especially in a party, the game has less work to do each frame. They move the same as before.
- [Improvement] Zeny Rain, the Archer's arrow rain, Sand Attack and the Acolyte's light columns (Holy Light, Divine Judgment…) now follow the effects quality in Options: on medium they drop half the coins, arrows, grains and sparks, and a quarter on low, without trails; on mobile, half. They hit the same.
- [Improvement] Going back to Prontera after a run needs much less memory at once: the square's map is no longer reloaded in full all at once, it is prepared bit by bit behind the loading screen, and the other players show up right after. Downloading your stages' maps while you are in the square no longer takes up the game's memory.

## Beta 0.5.4 — November 10, 2026

Endless Tower scores fixed and Traditional Chinese reviewed.

### Language

- [Improvement] Traditional Chinese reviewed by Syuan from the community: skills and jobs now use their names from the Taiwanese RO server (Soul Linker 悟靈士, Gunslinger 神槍手, Bard 吟遊詩人...) and almost all the game and Librarian texts read more naturally.

### Endless Tower

- [Fix] In runs that reached the highest floors, the ladder kept only about half of the score. It now counts in full, and the runs that came up short have their real score back.

## Beta 0.5.3 — November 9, 2026

A new, more powerful server, a square for many more players with a queue to get in when it's full, and fixes for when the server was overloaded.

### Server

- [Change] The game moves to a new, more powerful dedicated server in Germany. Your accounts, characters, gear and progress move over as they are.

### Prontera

- [Improvement] The square now holds up to 2,000 players at once: it opens as many channels as needed, up to 80.
- [Improvement] When the square is full you no longer get stuck on "Offline": you wait in a queue that shows your place and get in on your own as soon as there's room.

### Gear and cards

- [Fix] Picking up a piece of gear, a card or an egg no longer sounds like a level up: it has its own sound now.

### Fixes

- [Fix] With the server overloaded, if the game couldn't register a run with the server when it started, it could claim that run's loot with an earlier run from another stage when it ended, and nothing came in (gear, cards or eggs). It now keeps trying to register the run for longer and, if the run ends first, waits until it is registered before uploading the loot.
- [Fix] With the server overloaded, a piece you had just earned (especially the reward from the Sunken Ship and Castle stories) could disappear if you put cards in it before the server received the run, and the cards were lost with it. The piece now keeps its cards. Rewards lost this way on November 9 have been given back.
- [Fix] Long tooltips for the skills on the skill bar (and for run items and buffs) could open below the bottom of the screen with a large UI scale or on short screens, where you couldn't read them. They now always fit: when there is no room above, they get wider, move to the side or shrink a little.
- [Fix] Talking to the Chronicler of Deeds froze the game for a few seconds on accounts with lots of gear. It now opens instantly.
- [Fix] Blacksmith: if the server was slow to answer a refine and you closed and reopened the window, the "Refine" button could refine a different piece from the one you had selected (the first one on the list). It now always refines the piece you see, won't let you start another refine until the previous one has an answer, and the risk warning also shows the piece's quality.
- [Fix] With the server overloaded, the game could show "Your account was used on another device" without that being true (often on entering the square) and reload with an earlier save, losing what you had just done. When a save reaches the server but its reply gets lost, the next one now carries on normally.
- [Fix] When the square was full, the party lost its connection as soon as the run started, and on the way back you could be left out of the square and the party. The party now gets into the run and back to the square even when it is full, and players in a party run no longer take up room in the square.
- [Fix] In party runs, picking up lots of gems at once or playing with a huge number of monsters on screen could drop your connection to the party ("Connection lost"). Pickups are now sent together and the server no longer cuts the connection for it.
- [Fix] An Endless Tower run that got cut off right at the end (a connection drop or the server being overloaded) could end up not counting: no floors and no tower points. The game now keeps the server updated on how the run is going and keeps trying to send the ending for a while longer. Runs from November 8 and 9 that ended up like that get back the floors that fit in the time they were played and their tower points.

## Beta 0.5.2 — November 9, 2026

The game in Traditional Chinese, a tabbed chat, a bigger square and Endless Tower adjustments.

### Endless Tower

- [Change] Each floor's minimum score now follows what the floor gives: 80% of the points for killing every monster that shows up in its minute without combo. It used to climb much faster and from floor 21 or 31 it asked for more than you could get (floor 31 asked for about 67,000; now about 35,000). Also, when a new block starts, neither the monsters that show up nor the minimum score drop any more: they stay as on floor 9 of the previous block and climb from there.
- [Change] Tier 2 starts at floor 31 and you can feel it: monsters have triple HP and deal 15% more damage, 30% more of them show up, and every kill is worth 5% more for each floor you climb. The minimum score does not count those extra monsters and points.
- [New] Clearing floor 50 unlocks the Blood Savage dye for all your characters. It shows up like loot before the cards, with your character already wearing it, and you put it on at the Stylist in the plaza.

### Prontera

- [New] The plaza chat now has tabs: each channel (Channel, General, Trade, Party) has its own messages, and you write in the open tab. A red dot marks new messages in the others; whispers show in all of them.
- [New] Options › Language › Chat channels: choose which chat channels you see (Channel, General and Trade). Turning off Channel also hides the speech bubbles in the plaza.
- [Improvement] Twice as many players fit in the plaza: there are now up to 32 channels (16 before).

### Languages

- [New] The game is now available in Traditional Chinese (繁體中文): pick it in Options › Language or in the language selector on the title screen. It is selected by default if your browser is in Chinese.

### Fixes

- [Fix] An Endless Tower run that you rejoined after a connection drop or an update could be voided for no reason. It now keeps counting.

## Beta 0.5.1 — November 8, 2026

Piercing gets stronger, the Endless Tower loads your account's gear and cards, and several fixes.

### Balance

- [Change] Pierce: every enemy pierced is now a new roll, so one shot can pass through several in a row (it used to be one extra at most), capped at 75% with everything added up. Pierce cards give 2% (common) to 10% (legendary), double what they did.
- [Change] Archer (and its 2nd jobs) with a bow: 20% base pierce on their shots.
- [New] Armor and ranged weapons (bows, guns, shuriken, rods and instruments) can roll pierce among their bonuses, in the same slot as crit: +1% per tier of the map they drop on.

### Fixes

- [Fix] The Fan of Knives from Out of the Shadows (when leaving Hiding) only fired one pulse. It now fires the same as the skill: its 2 starting pulses plus those from cards, Deity and the tower.
- [Fix] The maintenance notice appeared hidden behind the Endless Tower score panel. It is now placed below it.
- [Fix] In the Endless Tower, your character sometimes went in without part of its gear or with fewer cards than it wears. The tower now counts every card on your account and the pieces you are wearing, including those from your local save from before you created the account and story rewards.
- [Fix] Endless Tower runs from November 8 that had not counted because of the game's version change have been recovered: they add to your tower points and appear on the ladder.
- [Fix] With the browser's automatic translation turned on, some texts came out mistranslated (the VIT Dish read "+1 years"). The game already has Spanish and English in its options, so the browser no longer translates it.
- [Fix] With the character panel open in the square, what you received in a trade could vanish when you equipped something, moved stats or touched anything else in the panel. The panel now updates as soon as the trade is done.
- [Fix] Some players leaving the Endless Tower came back to Prontera with a black screen and the tower frozen behind it. Leaving a run has been reworked so the tower closes completely before you enter the square, and Deity or floor cards that were open no longer carry over into the square.
- [Fix] Maximize Power (the Merchant's final Blacksmithing talent) did nothing in the Endless Tower, since there is no zeny to spend there. In the tower, Mammonite now always gets its boosted hit without spending zeny.
- [Fix] The 2-slot Main Gauche, Stiletto and Gladius (dropped by Poporing, Soldier Skeleton and Skeleton General) could only be worn by Thief and Ninja. They can now be worn by the same jobs as their 3-slot versions: Swordsman, Mage, Archer, Merchant, Thief and Ninja.
- [Fix] Some hits (like the charged weapon's lightning) could kill a monster again while it was already dying: a boss dropped two pieces, its EXP counted twice and in the Endless Tower the monster scored double. Each monster now counts only once when it dies.
- [Fix] In browsers with anti-tracking protection (such as Helium or Brave), player characters could show stray coloured pixels while monsters and NPCs looked fine. Character colours are now read straight from their images, without going through the canvas those browsers alter.

## Beta 0.5 — November 8, 2026

The Endless Tower arrives, along with the Librarian and the game wiki, lots of melee balance and more optimization for mobile.

### Endless Tower

- [New] The Endless Tower: the Tower Guardian, west of the Prontera square, opens the gate to characters with a 2nd job (earned through the Prontera Castle story). Floors last one minute, with monsters that never stop and a minimum score you need to keep climbing. Every 10 floors the scenery turns into another stage, and floors 10, 20, 30… are MVP floors. At the start you pick a Deity that ranks up every 10 floors, and before each floor an upgrade card chosen from your equipped skills and your basic attack (epic after floors 5 and 10 of each block). Nothing drops inside: the tower points from every run buy permanent upgrades that only count there. You can save a run once and continue it another day. There is a monthly ladder, overall and per 2nd job. It needs a registered account: the server checks every run and its result is the one that counts. It is still in testing, so the numbers may change.

### Accounts

- [Improvement] Up to 15 characters per account (was 10): the character select has one more row.

### Balance

- [Change] Swordsman, Thief and Merchant: their area skills deal 40% more to bosses.
- [Change] Less HP on two MVPs: Golden Thief Bug 58,000 (was 67,500) and Sunken Ship Drake 180,000 (was 200,000).
- [Change] Zeny Rain now marks bosses too (it did nothing to them before): without stunning them, while marked they
  take 30% more damage from everything. Against other monsters it's unchanged (+50% for Mammonite).
- [Change] Sword Dance grows out from you and opens in three pulses, each one reaching further: no more hole in the
  middle, and whatever is close to you takes all three. Extra pulses from cards fit in the same opening. 9 s cooldown
  (was 13).
- [Improvement] Crushing Bash with extra targets: spreads its slams to reach as many different monsters as possible,
  instead of hitting several that are stuck together.
- [Change] Thief: Throw Stone, Fan of Knives and Caltrops scale with STR (melee ATK) like the rest of its skills,
  instead of ranged ATK (DEX).
- [Change] Swordsman and Merchant deal more damage with melee basic attacks: 75% more with a one-handed weapon and 125%
  more with a two-handed one. The Thief, 35% and 50% more.
- [Change] Bash deals much more damage from the start (300 at level 1, was 120) and grows little per level (+3%): 363 at level 8 (was 170).
- [Change] Mammonite deals 15% more damage at level 1 (150) and each level adds a bit less (+15%).
- [Change] Envenom's poison deals 150% more damage.
- [Change] Wandering Shadow (Thief Shadows tree): after Shadowstep's last jump, your basic attacks keep dealing 2000% of their damage for 3 s.
- [Change] Two-Hand Quicken (Swordsman Fury tree) gives +10 Haste per rank to basic attacks (was +6).
- [Change] Berserk (Swordsman Fury tree) also gives +20% melee reach and +10 Haste on basic attacks.
- [Change] Fan of Knives throws two fans in a row from level 1 (was one).
- [Change] Ranged basic attacks (bow, gun, huuma, rod and instrument) and Arrow Repel can only gain +3 projectiles from in-run cards, and those cards are always white (+1 projectile). Deity, talents and gear add on top.
- [Change] The Mage's infused attack no longer gets +projectile cards. Lightning Infusion now gives +2 projectiles (was +1).
- [Change] Pierce is now a chance, and a projectile pierces at most 1 enemy (2 in total). Pierce talents give 20% across all their points: Ice Infusion and Piercing Arrow give 20%; 2-point talents give 10% per point. Cards give 1% (white) to 5% (orange) and the projectile Deity gives 10%. True Sight adds 10% while it lasts.
- [Change] Skills that pierce everything (Arrow Repel, Huuma, Shield Bash…) are unchanged. Skills that pierce by default (Throw Shuriken) now always pierce exactly 1 enemy, no more.
- [Improvement] Chests no longer offer upgrades your character can't use: melee reach only shows up if your basic attack or one of your skills hits in melee, and poison, burn and bleed damage (Damage over Time Elixir and Deity of Torment) only shows up once you have poisoned, burned or made an enemy bleed during the run.
- [Change] Sword Dance Deity: the weapon stays charged with lightning for 5 s after the dance (was 2 s).
- [Change] Frost Diver Deity: Frozen Burst deals 35% of the frozen enemy's max HP to those around it (was 15%), plus
  1% per refine.

### Interface and texts
- [New] The Librarian, southwest of the Prontera square, next to the stylist, is the game's wiki: section by section it explains stats, how ATK and MATK scale, diminishing returns and caps, defense and status effects, every job's skills, the run (elites, hordes, chests, difficulty), gear and refining, stages, pets and more. It has a search box, stat, hit and damage-taken calculators, and charts that use the same formulas as the game. With a controller, the D-pad walks the sections, A enters them and B goes back.
- [New] On the title screen, the «Talents» button opens a page with the talent trees of every class: the 1st jobs and the 2nd jobs, which are still in development and may change.
- [Improvement] Fire Arrow has a new impact: the ground gets scorched with ember cracks and a fire ring that opens to the edge of the splash, instead of the burning ground that filled the screen with extra area and targets. When many land at once, the effect lightens itself.
- [Fix] In a party, a character can no longer go to a stage they haven't unlocked (missing the previous MVP, gearscore,
  Job Lv or its story) just because the leader has: when the trip is proposed they answer no and the party sees in its
  chat what they're missing.
- [New] In a party, the leader can raise the time to pick a card from 10 to 20 seconds when proposing the trip (in the
  difficulty window; the others see it in the proposal).

- [Change] Rain no longer makes a sound: its hiss played all the time, even with the game paused.
- [Change] New title screen: a tower under a stormy sky, with the clouds swirling above it, and monsters from the Payon Cave, plus the odd MVP, walking along the path in front.
- [Change] The title screen has new, darker music to match the background; pressing Play brings back the Prontera theme.
- [Change] On mobile, boss health bars no longer appear at the top of the screen: with two or three bosses they covered half of it. Each boss's health shows on the bar above its head.
- [Fix] After switching the language to English without reloading, the talents that teach a 2nd job skill (Spear Boomerang, Sonic Blow...) kept their Spanish name.
- [New] Buttons, tabs and checkboxes in the interface now make a sound when you press them, with a short, soft tap you barely notice. It follows the “Interface” volume in the options. Skill buttons and touch controls stay silent.
- [Improvement] In the chest, if a card would replace what you already have in that slot (for example, another Deity when you already have one), an orange box at the bottom shows the icon and name of the one you would lose. When you pick it, the card flips over and asks whether you want to swap, with “Yes, swap” and “No” (on keyboard, the same number or Enter for yes and Esc for no).
- [Fix] After switching the language without reloading, card qualities ("Common", "Epic"...) stayed in the previous language.

### Performance

- [Improvement] Lighter Mage infusions on mobile: half the trail particles, no light pool on the ground and simpler lightning arcs. They also follow the effects quality setting: medium shows half the trail and low a quarter. On desktop at high quality they look the same as before.
- [Change] In a party, Mage infusion effects are only shown to the player who has them: teammates see their normal weapon attack. With several mages in the party the screen no longer fills up with projectiles. Damage is unchanged.
- [Change] Square channels now hold 25 players (40 before), and there are more channels. With such a crowded square, phones ran out of memory loading everyone.
- [Fix] Your run now saves itself every 10 seconds. If the game closes suddenly (for example, an iPhone running out of memory), you can continue from there when you come back. Before, it only saved when you quit or sent the game to the background, and a sudden close lost the whole run.
- [Improvement] Lighter runs on mobile: the HUD uses less memory for the whole run, and the level-up cards appear without sparks or looping animations and with a smaller glow. The level-up wings load when the run starts instead of right before the cards.
- [Improvement] A particle limit for the whole run, shared by every effect: stacking projectiles and targets (several Shield Bashes at once, infusions…) no longer throws out thousands of particles and rocks at once. Once the limit is reached, new ones wait until others fade. It is lower on mobile and at medium or low effects quality. Damage and hits are unchanged.
- [Improvement] Lighter Shield Bash with many shields at once: the glow and trails take half the work to draw and look the same, and the rocks and dust are much lighter. On mobile, at most 8 shields are drawn at once (from the sixth on, without glow or trails); the rest still hit but are not shown. Stacked on top of each other they already looked like a single wall.
- [Improvement] On mobile, with many infused Mage projectiles at once, from 40 on the new ones appear as a small glow, without flame, arcs or trail. Damage is unchanged.
- [Improvement] In party runs, the leader sends much less monster data: on the other players’ screens monsters keep walking on their own between messages, and the leader only resends them when they need correcting. With lots of monsters at once, about four times less data is sent.
- [Fix] When you went back to the square and started another run, the square and the previous runs stayed in memory, each scene adding up. Now they are released when you leave them. On mobile, especially iPhone, the second run of a session started with much less free memory than the first.

## Beta 0.4.2 — November 6, 2026

Bosses no longer hurt on contact, tweaks to the Thief, Swordsman and Merchant, and smaller boss bars on mobile.

### Bosses

- [Change] Mini-bosses and MVPs no longer hit you on contact: they only deal damage with their skills. You can stay right next to them while dodging what they throw.

### Balance

- [Change] Envenom stabs twice as often (every 2.5 s instead of every 5 s), hits 2.5 times harder and its poison deals double damage.
- [Change] Bash and Mammonite hit harder from the start: Bash twice as much at level 1 and Mammonite 25% more. Each level adds less damage than before (Bash +6%, Mammonite +17%), so at level 8 they hit the same as before.
- [Change] Treacherous Sweep (Thief Combat tree) only works with daggers or katars. With other weapons it shows as inactive in the tree, like weapon masteries; before, you could take it with a bow and it did nothing.
- [Change] Blade Mastery (Thief Combat tree), on top of its damage, now makes your basic attack scale better with ATK when using a dagger or katar: up to 50% better at rank 5. Late in a run, the dagger no longer falls so far behind the bow.

### Interface and texts

- [Improvement] More compact boss bars on mobile: each boss takes one line, with its name beside the bar, and bosses of the same kind share a row with “×3” and a bar split into one piece each. Cramps no longer fill half the screen.
- [Change] On mobile, the maintenance notice is just a small clock with the countdown, so it doesn’t cover the game. Tap it to read the full message.

### Performance

- [Improvement] When you enter the square, the other players and their pets load a few at a time, nearest first, instead of all at once. On mobile this spreads out the memory needed to enter a crowded square; the players furthest away take a moment longer to show up.

## Beta 0.4.1 — November 6, 2026

A patch for iPhone and party runs.

### Performance

- [Improvement] Lighter character panel: cards and pets load when you open their tab instead of when the panel opens, and only the pets you own get a portrait. It uses less memory on mobile, especially in a crowded square.
- [Improvement] Party runs: the leader only sends the monsters that changed and goes over the full list bit by bit, instead of sending all of it every 3 seconds. With lots of monsters, the messages between players are much smaller.

## Beta 0.4 — November 6, 2026

Much less memory on mobile to stop the crashes on iPhone, /sit in the square and fair play for everyone.

### Prontera

- [New] /sit in the square chat to sit down, like in RO (or the Insert key; you stand up by walking). Everyone else sees you sitting.

### Party

- [Change] Stories (Sunken Ship and Prontera Castle) are played solo: in a party the captain only offers the
  regular stages.

### Accounts

- [Change] Fair play for everyone: with an account, the server only accepts what you get by playing. Gear, cards,
  levels, talents and jobs that show up without a run that gives them no longer stay on the account.
- [Change] When you create an account with your guest progress, characters come in at the level their runs allow.

### Performance

- [Improvement] The game uses a lot less memory on mobile (about 100 MB less in Payon Forest): fewer unexpected closes and reloads, especially on iPhone.
- [Improvement] The Prontera square closes far less often on mobile when it is crowded: other players' pets weigh about 10 times less.
- [Improvement] Monster and map images are no longer kept twice in memory on mobile: about 100 MB less in a Payon Forest run.
- [Improvement] The square no longer piles up memory as players come and go: what belonged to players who left is freed after a while.
- [Improvement] Skill effects load when they are used instead of when the game opens: about 65 MB less on mobile. The first time an effect shows up in a run it may take a moment to appear.
- [Improvement] Death animations of big monsters are stored smaller (barely noticeable): monsters take about a quarter less memory.
- [Improvement] Mage infusions are much lighter to draw (they look the same): with several projectiles at once, the game no longer drags on mobile.
- [Fix] Pets no longer keep running in place when you stop: they come up next to you and stand still.

## Beta 0.3 — November 5, 2026

Friends list, a stylist in the square, gamepad support, security questions for your account and a much smoother experience on mobile, especially on iPhone.

### Prontera
- [New] A Stylist in the square, left of the fountain: change your character's hairstyle, hair color and clothes
  color whenever you like, free of charge, with a preview first. The special dyes are locked, but you can try them in
  the preview: Blood Savage, Bronze Sentry and Black Guard will be earned in the Endless Tower and Shadow by beating
  Shadow Niff (coming soon). It also works with a controller.

### Friends
- [Improvement] On the friend list, someone playing shows «In a run» also when playing solo, with the stage and how
  long they have been in it (it ticks while you look at the list); back in the square their channel shows again. It
  also says if they are in a party.
- [Improvement] Tapping a friend's name opens their menu on top of the list without closing it.
- [Improvement] The «Friends» button in the square shows how many of your friends are in the square right now, next
  to the pending requests (with the number in red), styled like the key hints on the buttons next to it.
- [New] Friend list, like in RO: a «Friends» button in the square. Add someone by their character name or from their
  menu in the square («Add friend»); they get a request and, once they accept, you show up on each other's list
  (also if they were offline: they see it when they log in). The list shows where everyone is (channel, in a run or
  offline); tapping the name of someone in the square opens their menu (whisper, inspect, trade, invite to party,
  go to their channel...). Up to 40 friends per character, account only.

### Party
- [New] In a party the damage meter has two modes, switched with the button on its blue bar: Players (each
  member's damage, as before) and Skills (everyone's skills together, each person in their own colour with a legend
  on top). It remembers the last one.
- [New] In a party run you can keep talking on the Party channel: messages show at the bottom left (they fade on
  their own) and the typing line is always visible: press Enter (on mobile, tap it) to write. Party members still in
  the square see it too, and the other way round.

### Accounts
- [New] Optional security questions: when you create an account you can pick 5 Ragnarok answers (your favourite
  city, monster, MVP, job and pet). If you forget your password, go to Sign in → “Forgot your password?”, answer them
  and set a new one, with 3 tries a week. Existing accounts are offered them when they sign in. You pick them only once, and
  turning them down is permanent, and without them a forgotten password can’t be recovered.
- [Fix] When playing on two devices (PC and phone), one that couldn’t fully store the save it got from the server could
  later upload it without your inventory and leave the account with no gear. That upload is now refused: you get a
  warning and the server save is loaded again.
- [Change] Guest character names are now reserved too: nobody else can take them, and when you create an account your
  characters keep their names (before, you could have to rename one if another player had taken the name meanwhile).
  After 30 days without playing as a guest, those names become free again.

### Balance
- [Change] Discovery gives less and less as it stacks: with elixirs, blessings and Deity added up, one in three or
  four upgrades and items came out legendary. With a lot of discovery it's now around 7%. In exchange, epics are 20%
  more common.

### Interface and texts
- [Fix] Ctrl+C to copy some text (from the chat, say) no longer opens the character window; single-letter shortcuts (C,
  X, M, K) do nothing when pressed with Ctrl, Alt or Cmd.
- [New] The game team (GM) stands out in the square: their name shows in gold and their chat messages are
  highlighted in gold with a GM tag.
- [Change] No more in-game banner with an «Update» button: when a new version arrives while you are in the square, a
  window asks you to reload the page, and the title screen downloads it showing the progress. During a run it waits
  until the run ends; on the title screen and character select it installs by itself, as before.
- [Improvement] Mobile: a quick tap to walk somewhere no longer flashes the joystick; it shows up when you drag your
  finger or keep it still for a quarter of a second.
- [Change] Mobile, controls like Vampire life: the joystick stays where it appears (the base used to follow your
  finger) and a quick tap, without dragging, walks your character to that spot, like a mouse click (in the square,
  tapping an NPC walks you over to talk).
- [Change] Mobile: the camera rotate buttons are gone (they got in the way, in the square and in runs); rotate with two
  fingers.
- [Fix] Title screen on a phone in landscape: Downloads, News, the language and the links sit on the left half with the
  logo, and the sign-in window uses the full height on the right (those buttons covered its top and the links its
  bottom).
- [Improvement] In a party, the Acolyte's support reaches teammates: Blessing blesses those nearby (with the caster's
  level and talents), Heal heals them too, and Aqua Benedicta puddles (and the Epiclesis tree) heal everyone standing
  in them.
- [Improvement] Phone in landscape: every window has a slimmer title and footer, and the Chronicler and Pet Keeper lists
  use the height that is left (the Chronicler's Upgrades barely fit one row).
- [Fix] Mobile: interface pass. In the character panel, Status and Job now show in full on a phone in landscape (the
  stat list and talent trees had no room left), the header takes a single row and in portrait the tabs fit in two
  rows. On level-up, the button to reroll every card no longer ends up off screen. At the end of a run, the button to
  go back is always visible. In the square, the prompt to talk to an NPC sits at the bottom, above the buttons, and NPC
  names no longer pile on top of each other. On character select, the account bar is no longer under the buttons at
  the top.
- [Fix] In a party, the meteor shower didn't start when time ran out against the final boss: each player's countdown
  drifted with however long their run had been paused. Everyone now follows the leader's, and the shower falls on
  everyone at once.
- [Fix] In a party, when several items dropped at once (a boss), after choosing Need or Greed on the first one the
  run kept going while you decided the rest and monsters hit you. It now stays paused until you choose the last one.
- [Improvement] In a party, everyone sees the result of each Need / Greed roll on the big loot card: who wins it and
  everyone's roll. The run stays paused until everyone closes it (or after 6 seconds).
- [Fix] On iPhone, leveling up turned the screen white and sent you back to the login screen.
- [Fix] Mobile, especially iPhone: the game uses much less memory (monsters load when you enter their stage instead of
  all at startup, and the previous map is freed when you change maps), so it no longer reloads by itself after a few
  runs; sounds no longer all load at once on the first tap.
- [New] You can play with a controller (Xbox, PlayStation and most generic ones): left stick to walk, right stick or
  LB/RB to rotate the camera (up/down to zoom) and Start to pause. From the title screen (A Play!, LB/RB between
  guest, log in and create account) to character select, where the D-pad picks a slot and A plays. In Prontera, A
  talks to the NPC next to you, X opens your friends, Y your character and Select goes back to character select;
  ←/→ pick the players around you (their name in red) and A opens their menu; ↑ opens the chat (with the system
  keyboard where there is one) and ↓ the emotes, which now include quick phrases to talk without a keyboard (also
  with the mouse); RT enters the party panel (members, make leader, kick, leave) and B leaves it. In-run windows, the character panel (equipment, inventory, cards, pets, status and talents), expeditions, the
  shop, the blacksmith, the Chronicler, the Pet Keeper, the Stylist, friends and the options are navigated with the D-pad: the
  selection is highlighted in red and shows its tooltip like the mouse does, A presses it, X works as right click
  (remove a talent point, +10 to a stat) and B goes back (close buttons hide while you use the controller). Tabs
  only with LB/RB and inner filters (item types, talent branches) with LT/RT; opening a window or switching tabs
  starts at the first item. In expeditions, A leaves Set out selected and B goes back to the list. In the character
  panel the D-pad walks the equipment slots (each one is picked as you
  pass it), A or → enters its list of pieces with the comparison shown right away and A equips one; X removes the
  piece and Y opens its card sockets, where ←/→ picks a socket (in red) and A inserts the card. Status goes row by
  row and ←/→ lower or raise the stat; in Inventory, Cards and Pets each item shows its details as you pass it and A
  enters its buttons. While you use the controller, the bottom right corner (the party panel moves up to make room) shows what each button does with your
  current selection. Character creation too: stats go row by row (←/→ lower or raise them) and the name is typed
  with the system keyboard where there is one or, without it, «Random» makes one up if it is empty (also with the
  mouse). Trading still needs a mouse or touch screen. The buttons are listed in Options → Controls.
- [Improvement] Rain is softer: fewer, thinner and more see-through drops in several depth layers, so it doesn't
  clutter the screen.
- [Change] The icon of the game installed as an app is now the golden «RO» from the logo instead of the Poring. If
  you already have it installed, your phone or PC updates it by itself after a while (on iPhone, when you add it again).

## Beta 0.2.1 — November 4, 2026

Whispers, an HP bar under your character, RO-style damage numbers and clearer character creation.

### Interface and texts
- [Change] Blatant cheating (gear the game doesn't give, made-up Kafra Points, impossible levels) bans the account
  on the spot, and the connection it came from for 30 days.
- [Change] When creating a character each stat shows what the next point costs, like on the status sheet, and you
  no longer have to spend them all: leftover points can be spent later on the sheet (Character, in the square).
- [Improvement] Your character has its HP bar underneath, like in RO: green, and red below 25%, so you don't have to
  look at the portrait in the corner mid-fight.
- [Change] The Install button no longer floats in the square (on mobile it overlapped other things): it now sits at
  the bottom of Options (⚙), in the square and on character select.
- [Improvement] Playing as a guest, the whisper, trade and party invite buttons in another player's menu are greyed
  out with a note saying an account is needed (also when the other player is the guest), and the chat line and its
  channel button look disabled.
- [New] Whispers in the square: messages only one other player sees, whatever channel they are on. From their menu
  (Whisper, by tapping their character or their name in the chat) or by typing `/w "name" message`; `/r message`
  replies to the last person who whispered to you.
- [Improvement] Damage numbers move like in RO: they pop out big over the target's head, rise, fall in an arc to
  the right and shrink until they vanish. «Straight damage numbers» in Options → Game brings back the old ones.
- [Improvement] Character creation marks with ★ the stat the job deals damage with (STR, DEX or INT); the Acolyte
  has two: INT on the way to Priest and STR on the way to Monk.
- [Fix] The maintenance notice no longer covers anything: in the square it sits under the place name, in a run under
  the timer, and on character select and creation, off to the side.
- [Improvement] When creating a character, each stat explains what it does: hover it, or tap it on mobile.

## Beta 0.2 — November 3, 2026

Two new stages, a revamped Prontera, new bosses and a bonus of its own on every item.

### Stages
- [New] **Prontera Culverts (Lv 9–12):** between Prontera Fields and the Sunken Ship, in the sewers under the city,
  dimly lit by lanterns and blue fog. Thief Bug, Familiar, Tarou, Plankton, Drainliar and Cramp; at minute 3 the
  three **Angry Tarous** show up together (one charges, one poisons the ground and one burrows and calls the rats):
  only the last one to fall drops loot, and the others get enraged. The MVP is the **Golden Thief Bug**, back where
  it belongs.
- [New] **Byalan Island (Lv 16–20):** the first stage of tier 2, in the sunken temple on the 5th floor of the Izlude
  dungeon, with its colonnaded nave, its great stairway and its cloisters in deep-blue gloom. Vadon, Cornutus, Marse,
  Obeaune, Phen, Marine Sphere and Merman; the bosses are **Deviace**, **Strouf** and **King Dramoh**, and the MVP is
  the **Kraken**.
- [Change] **Prontera Fields revamped (Lv 1–8):** Roda Frog, Creamy and Mandragora join in (it does not walk, as in
  RO: it sprouts from the ground near you and lashes you with its roots from afar); the bosses are Eclipse, **Toad**
  (spits bubbles in a fan), **Dragon Fly**, Vocal and, as MVP, a much stronger **Mastering** that splits into Porings,
  leaps on you and makes the ground quake.
- [Change] **Payon Forest is now Lv 21–25** and opens after beating the Kraken.
- [Change] If you already beat the Golden Thief Bug in Prontera, Eddga or Moonlight Flower, you keep everything you
  had unlocked.

### Bosses
- [New] **Kraken:** it barely moves and does everything with its tentacles: rows that sweep across the floor towards
  you, cross-shaped lashes, a ring that surrounds you and then closes in, a vortex that drags you to its maw, ink
  clouds, and tentacles that stay behind hitting you from afar until you break them (at half health they sprout
  everywhere).
- [New] **Penomena, a Sunken Ship boss:** shows up at minute 6 with tentacles that burst out where you stand, sinks to
  surface under your feet, sends a venom tide around itself and sprouts Hydras.
- [New] **Marine Sphere:** if you don't break it in time, it bursts after 10 s and hurts you within 2 m. Before that it
  blinks red, faster and faster.
- [Change] **Race against the final boss:** when a stage's last boss shows up, the timer counts down 2 minutes in red;
  if it reaches 0 before you beat it, the meteor shower starts (it used to be 3 minutes with the timer still counting
  up).
- [Change] **Longer Sunken Ship:** Ghostring at minute 3, Penomena at 6 and Drake at 10 (it was 7), with more than
  twice the HP.
- [Change] **Ghostring** has almost three times the HP (28,000; it was 10,500).
- [Change] **Drake:** Saber Slash, Whirlwind and Swell reach twice as far and give a bit less warning: you can no
  longer fight him from range without moving.
- [Change] **Tougher Moonlight Flower:** 1,000,000 HP, and the Cat O' Nine Tails she summons for the sealed bell has
  175,000 (you have 20 seconds to bring it down and open the bell).
- [Change] **Tier 1 bosses (Prontera Fields, Prontera Culverts and Sunken Ship) deal 25% less damage**, mini-bosses
  and MVPs alike.

### Gear and cards
- [New] **Every item has its own touch:** all dropped gear comes with a bonus of its own, based on what it gives in RO
  and marked with ★ (Apple of Archer DEX, Brooch AGI, Golden Mace more damage to undead, Fire Brand burns, Mirror
  Shield less damage taken...). It is small, comes in every quality and grows with the tier and refine.
- [New] **New cards:** Roda Frog, Creamy, Mandragora, Toad, Dragon Fly, Tarou, Drainliar, Cramp, Vadon, Cornutus,
  Marse, Phen, Obeaune, Marine Sphere, Merman, Deviace, Strouf, King Dramoh and Kraken.
- [New] Merman and Strouf drop the **Trident** (a two-handed spear for Swordsmen) and King Dramoh drops his crown.
  Plankton now drops a Safety Ring, and Mastering can drop the Poring Hat.
- [Change] **More gear:** normal monsters drop gear 50% more often, and mini-boss and MVP weapons drop 5% of the time
  each (it used to be 1 to 9%).

### Party
- [Improvement] **Runs wait for everyone:** the run doesn't start until everyone is in (you can see who is still
  loading and who is already in); then it counts down 5 seconds and starts. If someone isn't in after 45 seconds, it
  starts without them.
- [Improvement] **Party frame in the run:** portrait, job and HP of each party member under your buffs. A downed
  member is marked in red and, if they are off screen, an arrow on the edge shows where they are.
- [Improvement] **Big Need / Greed:** gear, cards and eggs show up on the big loot card, with what they give, and you
  roll from there; the run waits until everyone has chosen. Who still has to choose is much easier to see.
- [Change] **Fuller runs:** with 2 players ×2.5 monsters spawn and with 3, ×3.85, around every player (they used to
  all spawn next to the leader). Normal monsters have ×1.25 HP with 2 and ×2.25 with 3; bosses and MVPs, ×1.75 and ×4.
- [Change] **EXP and zeny:** 80% of what you earn solo with 2 players and 60% with 3, even with more monsters around.
  Elites and chests show up just as often as solo.

### Interface and texts
- [Improvement] **Smoother updates:** when there is a new version, the title screen applies it before loading (only
  the logo with "Updating… X%") instead of loading everything with the old one and reloading a few seconds later.
- [Improvement] **Faster stage loading:** while you are in the square, the maps of the stages you have unlocked
  download in the background, so the first run of each one no longer waits for the download.
- [Improvement] **Sunken Ship (story):** Lain points out the three runes on the barrier's portal and speaks up when
  you reach the first mechanism, when you activate it and when you activate the last one, so it's clear what to do.
- [Improvement] **Map names:** the minimap and the loading screen show the place name ("Sunken Ship deck") instead of
  the internal map name.
- [Improvement] **Reports get reviewed:** player reports and anything odd on accounts are reviewed every day. Anyone
  breaking the rules can be muted in chat or have their account suspended for a few days or for good; the game tells
  them until when and why, and sanctions can be announced in everyone's chat.
- [Improvement] The language buttons in Options and on the main menu are now the same size as the other buttons.
- [Fix] Some Mage talents showed their name in Spanish.
- [Fix] The profile bar is wider: "Create account" no longer wraps onto two lines when you have lots of Kafra Points.
- [Fix] The player menu opened from the lobby chat no longer goes off the bottom of the screen with a larger
  interface size.
- [Fix] In the report window, the circle of each reason is now aligned with its text.
- [Fix] The loading bar on the Play button keeps up with the percentage (at 9x% it used to be barely past halfway).

## Beta 0.1 — November 3, 2026

The first public beta: a life game in the world of Ragnarok Online that you play for free in your browser.

### Jobs
- **6 jobs:** Swordsman, Mage, Archer, Acolyte, Thief and Merchant, each with its own skills and effects, a Deity
  per skill and three talent trees to make your build.
- Taekwon, Ninja and Gunslinger will come later.
- Create your character with the RO look: hairstyle, hair color and clothing dyes, and spend their stats.

### Stages
- **Prontera Fields** (Lv 1–10), **Sunken Ship** (11–15), **Payon Forest** (16–25) and **Payon Cave** (26–30), each
  with its own monsters, minis and a final MVP.
- **Story mode** with Selene, Lain and Haru on the Sunken Ship and in **Prontera Castle** (31–35), which ends with
  your promotion to 2nd job.
- Orc Village and Morroc Pyramids, coming soon.

### The run
- Every level you pick a card: new skills, upgrades or Deity. Chests, magnet, meat, weather and a day–night cycle.
- Difficulty your way before heading out (number of enemies, their damage, HP, speed and events): the harder, the
  more loot.
- Damage meter to see what each skill brings.

### Gear and progress
- Gear from common to legendary, with tiers by map, properties and slots for monster cards.
- Blacksmith to refine with Oridecon and Elunium, and a Kafra Points shop.
- **24 pets:** rare eggs dropped by their monster, intimacy, accessories and evolutions with the Pet Keeper.
- Account achievements and card roll upgrades at the Chronicler of Deeds.
- Your gear's Gearscore opens the harder stages.

### Online
- **Accounts** with a username and password: your progress is saved on the server and you can pick it up from any
  device. You can also play as a guest, with your progress in the browser, and move it to an account later.
- **Online Prontera square:** chat, emotes, channels, player trading and inspecting other characters.
- **Parties of up to 3** that head out to the stage together, with shared monsters and loot and Need / Greed rolls.
- Chat, trading and parties are for players with an account.
- **Report** a player from their menu in the square (insults, cheating, RMT, spam): we review reports by hand.

### Also
- In Spanish and English, with touch controls on mobile, and installable as an app.
- Free and without ads.
