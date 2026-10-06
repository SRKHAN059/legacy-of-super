# Legacy of Super — Chapter Plan

Story source: `../research/dbs_story.md` (read the arc sections for your chapters). Structure source:
`../research/log2_mechanics.md` §10–§14. Engine/authoring rules: `CONTENT_GUIDE.md`.

Every chapter follows LoG2's storytelling method: a title card, a forced perspective character, a gold journal
objective with a world-map star, NPC chatter that tracks progress, in-engine cutscenes (walk/face/emote/pan/flash/
shake/fade), hostile zones to level in, level gates, a mini-boss and a multi-phase boss with a **scripted ending at
an HP threshold**, narrator announcements for new techniques/forms ("Narrator: Goku now has the Kamehameha
technique!"), and a handoff into the next chapter. Side content is silver/bronze quests.

## Handoff contract

- Chapter `N` start script id: `cNN_start` (two digits: `c01_start` … `c14_start`; prologue is `c00_start`).
  The `newGame` script (act 1) calls `c00_start`.
- Every `cNN_start` begins with `ensureChapterState(s, N)` (from `src/content/chapters/common.ts`), then
  `await s.chapter(N, 'Title')`, sets the forced character (`force(s, 'vegeta')` / `unforce(s)`), warps to the
  opening map and adds the chapter's gold quest.
- The last beat of chapter `N` ends with `if (s.hasScript('cMM_start')) await s.call('cMM_start');` for the next
  chapter `MM`.
- Flags/quests/scripts/maps/enemies you create use your chapter prefix (`c05_…`).
- Shared hubs (Guide §8) get your NPCs/triggers through `registerOverlay`, gated `showIf: 'chapter==N'` (or
  your own flags). Chapter-only locations are your own maps (`c07_nameless_arena`).

## Party timeline (repeat of Guide §5, enforced by `ensureChapterState`)

Prologue Trunks L6 (leaves after) · Ch1 Goku L1 · Ch2 Vegeta joins L8 · Ch5 Gohan L16 + Piccolo L18 ·
Ch9 Trunks rejoins L30 · forms/techs per Guide §5. Level curve (the band each chapter is tuned for,
`CHAPTER_MIN_LEVEL` = its start): P 6 · 1: 1–8 · 2: 8–12 · 3: 12–15 · 4: 15–18 · 5: 18–22 · 6: 22–25 · 7: 25–29 ·
8: 29–31 · 9: 30–34 · 10: 34–37 · 11: 37–40 · 12: 40–42 · 13: 42–45 · 14: 45–48.

**Levels come from EXP, as in LoG2.** Characters join at their story level (LoG2's SetMinLevel). Nothing raises a
character to the band in a playthrough that started with the prologue: the band is what normal play plus the
story gates below deliver. The hand-over is only a safety net: the hero who played the chapter that just ended (the
active character when `cNN_start` runs) is lifted to `CHAPTER_MIN_LEVEL[N] - HANDOVER_LEVEL_GAP` (band start − 5)
if they are below it, which only catches a player who avoided nearly every fight. Benched characters are never
raised: they fall behind and must be rotated in to keep up (the story gates, the side gates and the L50 trophies
depend on it). The other safety net is `force(s, id)`: when the story puts a character on the field, they are
lifted to at least band start − 3 (`CHAPTER_MIN_LEVEL[chapter] - FORCED_LEVEL_GAP`) so a forced segment is never a
wall; a character who joined in that chapter keeps their join level. A chapter started standalone (tests, the
`?map=` dev entry) still floors the whole party at `CHAPTER_MIN_LEVEL[N]` and opens the story gates of earlier
chapters, so every chapter remains playable on its own.

### Story gates (LoG2 §6.6: the grind-and-rotate loop)

LoG2 put coloured level gates on the critical path (Piccolo 10 and 25, Vegeta 30, Trunks 30, Goku 40). Ours are
`STORY_GATES` in `chapters/common.ts`: the table places each barrier and its once-only hint trigger by overlay,
so act and world map files stay untouched. Each gate's level is the level its character arrives with by normal play
(`arrive`, what the full-game run measures) plus one or two clears of the hostile zone beside it, computed from the
EXP table and the ROM kill clamp (`tests/full_game.test.ts` asserts 0.5–2 clears and at least 10 kills, and the
full run grinds every gate on real enemies and prints the effort).

| Ch | Gate | Where | Save point (switch) | Grind zone | Arrives | LoG2 parallel |
|---|---|---|---|---|---|---|
| 3 | Vegeta 15 | Pilaf Castle courtyard gate (`pilaf_castle_out`), Dragon Balls 2–3 behind it | outside the gate | Diablo Desert | 12 | Piccolo 10 (first rotation) |
| 7 | Piccolo 24 | walkway to the stadium (`c07_nameless_grounds`) | landing site | crater rim | 20 | Piccolo 25 |
| 9 | Trunks 32 | deep shaft of the mine (`c09_mine`): Excavator, third crystal | beside the shaft | the mine | 30 | Trunks 30 |
| 10 | Goku 34 | Black's courtyard (`c10_lair`), stands after the raid | below the courtyard (Goku is forced) | ruins + future city | 33 | Vegeta 30 (forced) |
| 13 | Gohan 40 | north trail to the poacher camp (`c13_monster_jungle`) | south end of the jungle | the jungle | 39 (Lookout training) | Goku 40 |

Rules every story gate keeps (tested): the required character is in the party and switchable at a save point on
the near side (or is the hero the story is forcing); the far side is unreachable on foot until the gate breaks; the
hint names the character, the level, where to switch and where to train; a hero who resumes beyond a closed gate
(a save from before the gate existed) finds it opened behind them (`rescue`). Gates for a scene that plays beyond
them first (the Chapter 10 raid) only stand once their `standsIf` flag is set.

---

## ACT 1 (folder `chapters/act1`) — Prologue, Chapter 1, Chapter 2

### Prologue — "A Future Without Hope" (Trunks L6) — LoG2 parallel: the Future Trunks tutorial prologue
- `newGame` → `c00_start`: title card, narrator crawl (another timeline, Age 796; Earth ravaged by a man with Goku's
  face). Trunks wakes in `future_hideout_in`; Future Bulma (lab, time machine) and Future Mai give the
  **talk/save tutorials**. `join('trunks', 6)`, techs kiBlast + burningAttack, form `ssj`.
- Supply run into `future_city`/`future_highway`: **melee a boulder** (breakable blocks the path), **ki-blast a
  boulder**, **flight circle** hop, first **hostile zone** (scavenger drones etc.), collect 3 fuel cells (key item).
- A dark silhouette (Goku Black) ambushes: scripted fight (`loseOk` or `survive`) — Trunks is outclassed; Black
  toys with him. **Transformation tutorial**: Trunks powers into SSJ in anger (narrator explains Z/L/B/triangle).
- Black follows him to the hideout: Future Bulma sacrifices herself (keep it off-screen and tasteful: flash, scream,
  silence), Mai shoves Trunks into the time machine. Trunks departs. Set `s.state.char('trunks').joined = false`.
  Narrator: "Meanwhile, in the past…" → `c01_start`.

### Chapter 1 — "A Peaceful World" (Goku L1→8) — LoG2 parallel: Gohan's opening chapter
- Narrator: months after Majin Buu. **Nightmare boss**: Goku dreams of fighting Frieza (tinted `paozu_home`, Dream
  Frieza ≈140 HP tutorial boss, healing rocks) → wakes in `paozu_house`.
- Chi-Chi: Goku must farm (pick up 5 radishes = **pickup tutorial**; radish item `c01_radish`), Goten tags along.
  **Save point**, **run**, and **gate tutorial**: a Goku **L2** gate in `paozu_forest` guards a cave/shrine where Goku
  recalls the Kamehameha (learn `kamehameha` + narrator). First hostile zone tutorial in the forest.
- Visit Gohan & Videl (`paozu_valley`/`gohan_house`): Videl's birthday/gift side quest (bronze) with Goten & Trunks.
  **World-map sign tutorial** → Satan City: Mr. Satan pays Goku his 100M zeni reward (comedy), townsfolk love Satan.
- "Meanwhile on Beerus's planet": Beerus wakes after 39 years, the Oracle Fish prophecy of a Super Saiyan God.
- Goku visits King Kai to train (`kingkai_planet`): regains Super Saiyan (`setForm('goku','ssj')`, narrator).
  Beerus and Whis arrive: scripted fight vs Beerus (`loseOk`; Goku goes all out, loses in a few hits). Beerus leaves
  for Earth → `c02_start`.
- Mini-boss: e.g. a giant sabertooth/T-rex in `paozu_peaks` (≈400 HP). Side quests: Goten's fishing/dino, an
  autograph fetch for a Satan City kid, a farmer's lost goat… (bronze).

### Chapter 2 — "The Destroyer's Feast" (Vegeta joins L8, forced) — LoG2 parallel: Piccolo's join + Hercule parade chain + Mayor's problem
- Vegeta trains in `cc_gravity`; `join('vegeta', 8)`, `force(s,'vegeta')`. Bulma's birthday party (`cc_yard` overlay
  or your own cruise-ship maps `c02_cruise_*`). Bulma gives the **Scouter** (Select = scan, R = regional map tutorial).
- Beerus and Whis crash the party. Vegeta must keep the god happy: a **fetch chain** (pudding — Buu ate it!,
  takoyaki, bingo prizes, ramen…) across West City (`wc_streets`, `wc_shops`), like LoG2's parade chain.
- The Pilaf Gang (Pilaf, Mai, Shu — as kids) try to steal the Dragon Balls (bingo prize): chase + hostile hold below
  deck with Pilaf robots → mini-boss **Pilaf Machine** (≈900 HP, L10).
- Pudding disaster: Beerus rampages, Bulma slaps him and gets slapped → Vegeta's rage (SSJ2 moment): scripted fight vs
  Beerus where Vegeta lands real hits (high HP, `endAt` ≈0.85, `loseOk`). Goku arrives. `unforce`. → `c03_start`.
- Side: **Sparring arena** at `satan_dojo` (or CC): Yamcha (≈800 HP), Krillin (≈1800), Tien (≈2100) one per visit,
  rewards str3/pow3/end3, no EXP (LoG2 §11). Unlocks `spot_westcity`, `spot_kame`.

## ACT 2 (folder `chapters/act2`) — Chapters 3, 4, 5

### Chapter 3 — "Battle of Gods" (Goku L12→15) — LoG2 parallel: the Dragon Ball hunt with radar and puzzle dungeons
- Bulma gives the **Dragon Radar**. The Pilaf Gang scattered/stole the balls: radar hunt across Diablo Desert
  (`desert_*`, `pilaf_castle_in` vault dungeon with a switch/door puzzle and mini-boss **Pilaf Machine Mk-II**),
  Satan City (Mr. Satan keeps one as a trophy — talk him out of it), Kame House (Roshi), Korin (Yajirobe), the
  Lookout (Dende). Use pickups `db1`..`db7` (radar shows them on the R map).
- Summon Shenron at `cc_yard` (big cutscene; register a dragon prop or flash + narration). The ritual: five Saiyans +
  Videl's unborn child (Pan) hold hands → **Super Saiyan God** (`setForm('goku','ssg')`, `sprite` swap, narrator).
- Boss **Beerus** (3 phases: chase/teleport → volley/rain → nova/beam), `endAt` ≈0.5 → cutscene clash into space,
  sphere of destruction, god ki absorbed, Beerus yawns and spares Earth. Unlocks `spot_desert`, `spot_lookout`.

### Chapter 4 — "Student of the Angel" (Vegeta → Goku, L15→18) — LoG2 parallel: the "three years later" training interlude
- Vegeta asks Whis to train him on Beerus's planet (`beerus_grounds`, `beerus_palace_in`); Whis wants Earth food:
  bring dishes → introduces the **25 Earth Delicacies** quest (bronze; reward `whisStaff` at 25, given by Whis; Whis
  is available at `cc_yard` from chapter 4 on and offers travel to Beerus's planet via `s.worldMap('space')`).
- Training: chores and drills (carry heavy water jars with `carry()`, break boulders, chase a creature), then
  "land one hit on Whis" (scripted Whis fight: teleport/guard, `endAt` 0.98 = one clean hit ends it).
- Goku joins (switch); Goku vs Vegeta spar (boss using vegeta sprite, `endAt` 0.5).
- Cutscene in Hell (`hell_lake`): Sorbet and Tagoma use Earth's Dragon Balls to revive Frieza; Frieza vows revenge
  and trains. → `c05_start`. Unlocks `spot_beerus`, `spot_space_earth`.

### Chapter 5 — "Resurrection 'F'" (Gohan joins L16 forced, then Piccolo L18) — LoG2 parallel: Android-saga forced segments
- Jaco crash-lands at `cc_yard`: Frieza's 1,000 soldiers arrive in an hour; Goku and Vegeta can't be reached.
  Gohan (outfit `gohanSuit` → `gohan` gi) and Piccolo answer Bulma's call; Krillin, Tien, Roshi, Jaco fight as NPCs.
- `waste_entry` → `waste_canyon` → `waste_mesa`: waves of Frieza Force soldiers (`soldier`, `soldierB`, `soldierC`,
  `soldierElite` + your own) with `clearEnemies`; mini-bosses **Shisami** and **Tagoma**; Gohan is rusty and gets
  floored → Piccolo takes over (switch) vs **Ginyu-in-Tagoma's-body** (body-change gag), then Frieza arrives:
  scripted **Frieza** fight, Piccolo shields Gohan from a death beam. Goku and Vegeta arrive with Whis. → `c06_start`.
- **Master Roshi's training** (silver, `kame_island` overlay, from chapter 5 on): each character talks to Roshi once
  to `learnCharged` (LoG2 §7). Unlocks `spot_wasteland`.

## ACT 3 (folder `chapters/act3`) — Chapters 6, 7, 8

### Chapter 6 — "Golden Frieza" (Goku → Vegeta, SSB; L22→25) — LoG2 parallel: the Semi-Perfect / Perfect Cell forced relays
- `setForm('goku','ssb')`/`('vegeta','ssb')` with narrator. Goku vs **Frieza (final form)** → Frieza turns Golden →
  **Golden Frieza** (`boss.stamina` drain: stalling works), `endAt` ≈0.3 → Sorbet's ray gun downs Goku (cutscene) →
  Vegeta (forced) vs **Golden Frieza** again → Frieza destroys the Earth (white-out) → in the void Whis rewinds time
  3 minutes → Goku finishes Frieza (**beam struggle** Kamehameha vs Frieza's blast). Vegeta learns `galickGun`.
  Piccolo died shielding Gohan (end of Ch5); Goten and Trunks carry him to the Lookout and Porunga revives him after
  the rewind. Epilogue party at `cc_yard`. → `c07_start`.

### Chapter 7 — "Tournament of Destroyers" (Goku/Vegeta/Piccolo; L25→29) — LoG2 parallel: Cell Games-style match card
- Champa and Vados visit `beerus_grounds` (cutscene); the Super Dragon Ball bet; recruit Team U7 (Goku, Vegeta,
  Piccolo, Buu, "Monaka"). Buu fails the written exam (comedy quiz using `ask`).
- Your maps: `c07_nameless_grounds`, `c07_nameless_arena` (`ringOut: true`, arena tiles over void). Matches as boss
  fights with forced characters: Goku vs **Botamo** (immune to damage: `resMelee`/`resKi` 0 — must ring him out:
  set `boss.ringOut: true`), Goku vs **Frost** (scripted ring-out loss after poison twist), Piccolo vs **Frost**
  (scripted loss), Vegeta vs **Frost**, **Magetta** (heat — HP drain while adjacent; implement as `rain`/aura),
  **Cabba** (Vegeta awakens Cabba's SSJ mid-fight), **Hit** (`timeSkip` moves) — Vegeta loses, then Goku uses Blue
  Kaio-ken (`transformNow('ssbkk')`) and wins by forfeit. Zeno appears; Super Shenron cameo. Unlock `spot_nameless`.

### Chapter 8 — "The Copy" (L29→31) — short interlude
- Goku demands a match with "Monaka", the "strongest fighter in Universe 7"; Beerus fights him himself inside the
  Monaka costume (comedy boss with `endAt` 0.9). Galactic Patrol job on
  planet Potaufeu (your maps `c08_potaufeu_*`): the Commeson creates **Copy-Vegeta** (boss mirroring Vegeta's
  stats; `vulnerableIf` the Commeson core is exposed — a small puzzle) and duplicate Goten/Trunks clones.
  → `c09_start`.

## ACT 4 (folder `chapters/act4`) — Chapters 9, 10, 11

### Chapter 9 — "SOS from the Future" (Trunks rejoins L30, forced) — LoG2 parallel: Trunks returns at L27 with prologue stats
- Trunks escapes Black again (short future scene), arrives at `cc_yard` (crash). `join('trunks', 30)` — stats roll on
  top of the prologue character; `learn('trunks','swordBlast')`, `learnCharged('trunks')`.
- Trust-building spar vs **Vegeta** (boss with vegeta sprite, `endAt` 0.5). Trunks's story told in flashback.
- **Goku Black** appears in the present: Goku vs Black (`endAt` 0.5) → Black's Time Ring pulls him back.
- Bulma repairs the time machine (fuel quest; Cell's old machine idea) → Goku, Vegeta, Trunks go to the future
  (`s.set('world','future')`), Resistance hideout (`future_hideout_in`), Mai. → `c10_start`.

### Chapter 10 — "Gods of Universe 10" (Goku/Vegeta; L34→37)
- Back in the present: the Kais visit Universe 10 (`u10_sacred`): Gowasu, Zamasu; Goku spars **Zamasu** (`endAt`
  0.5); flashback/investigation via the Time Rings; Beerus erases Zamasu. Visit `zeno_palace`: Zeno befriends Goku
  and gives the **Zeno Button** (key item). Optional: Babarian planet mooks (your map).
- Future: **Goku Black (Rosé)** vs Vegeta (scripted loss `loseOk`), Future Zamasu is immortal (fight with
  `vulnerableIf` never set → survive). Retreat. → `c11_start`.

### Chapter 11 — "Project Zero Mortals" (Trunks lead, SSJ Rage; L37→40) — LoG2 parallel: the Cell Games relay finale
- `setForm('trunks','rage')` (narrator). Goku learns the **Mafuba** from Roshi (`kame_island`); fetch the urn and
  the sealing charm (forgotten charm gag). Black clones ravage `future_city`.
- Boss **Goku Black Rosé** (Trunks), sealing attempt on Zamasu (puzzle with `vulnerableIf`), fusion →
  **Fused Zamasu** relay: Goku (SSB) → Vegito Blue (Vegeta with `outfit('vegeta','vegitoBlue')`, `survive` timer) →
  Trunks's Sword of Hope (**beam struggle**). Infinite Zamasu engulfs the sky; Goku presses the Zeno Button; Future
  Zeno erases the timeline. Farewell to Trunks and Mai (Trunks stays playable; narrator explains he visits through
  time). → `c12_start`.

## ACT 5 (folder `chapters/act5`) — Chapters 12, 13, 14, Epilogue, Post-game

### Chapter 12 — "Days of Peace" (hub; L40→42) — LoG2 parallel: free roam before the finale
- Gold quest `c12_days`: complete any 2 of 6 episodes (`EPISODES` / `EPISODES_NEEDED` in `c12.ts`) to continue:
  **Hit's contract** (Goku vs Hit, rooftop at night in `satan_plaza` overlay, `endAt`), **Pan's first flight**
  (babysitting chase), **Great Saiyaman** movie shoot (Gohan, comedy fights vs costumed "Watagash"), **Krillin's
  comeback** (Forest of Terror illusion rush), **"Whose Wish?"** (ep 68) and the **Universe 6 vs. Universe 7 baseball
  game** (ep 70). The first four phone in at `c12_start` and go straight into the Journal; the last two find the player
  at Capsule Corp (King Kai's call, Goten's word about Bulma's secret project and a purple cat) and get their silver
  entries when taken up; Goten's hints and Chi-Chi's reactions at the Son house (`chatter.ts`) cover all six. The bar
  stays at two: the level band and everything after Chapter 12 are tuned for a hero arriving with two episodes' EXP,
  and LoG2's free roam never made the player clear a side list to move on. The four called episodes left over stay
  open through Chapters 13-14 and the post-game; the two at Capsule Corp can be taken up in Chapter 12 or after the
  credits (a "Whose Wish?" already under way can be finished at any time). Unlock `spot_snow` (late-game grinding,
  trophy gates).
- **"Whose Wish?"** (ep 68; `c12_wish.ts`, maps and props `c12_eps_maps.ts`, art `c12_eps_art.ts`, items, journal and
  bestiary `c12_eps_data.ts`; silver `c12_wish`). Pressing A at the tarp on the old time machine pad (`cc_yard`, Chapter
  12 or post-game) starts it: Bulma lends the Dragon Radar for a metal from the Earth's core. Seven Dragon Balls
  (`WISH_BALLS`), one per Earth region, some hidden (A to examine), shown only while the episode is open; Bulma's status
  at the tarp names the next place on the radar. The drill pod (A on the pad) takes a forced Goku down in the heat suit
  (`c12_heatSuit` outfit) to the **Earth's core**, two hostile `indoor` maps (no Whis's Charm; the pod is the way out):
  `c12_core_mantle` (lava rivers with stone bridges, Magma Slime, Cinder Bat, Crust Crab, Lava Serpent, a flight-circle
  ledge with a capsule cache, four coolant vents, a save) and `c12_core_heart` (an arena before the crystal island). The
  heat hazard: a 90 s coolant tank on the HUD (`COOLANT`), refilled by the blue vents; dry, the heat burns 2% of max HP
  a second, never below 1 HP; paused in cutscenes and in the guardian fight. Guardian: the **Mantle Wyrm** (3 phases,
  summons slimes, `endAt` 0, rises from a trigger band across the arena). Cutting the alloy reels Goku back up; Bulma
  takes it (`c12_alloyDelivered`). The pod stays on the pad from the moment Bulma wheels it out (`POD_OUT`), so the core
  can be revisited like any LoG2 dungeon, after the alloy and after the episode: its cache and rocks are never lost and
  its tunnels stay a place to level. With all seven balls in hand the summoning plays on the Capsule Corp lawn: the
  argument over the wishes is a two-round dialogue choice (King Kai, Pilaf, Android 18, Master Roshi and Oolong, Goten
  and Trunks; the one backed first, `c12_wishBacked`, gives a consolation present), Goku lets Gohan make the first wish
  to cure Pan's fever, Beerus smells the time-machine metal and erases the workshop (`c12_labGone`; a crater until the
  story moves on), and Shenron leaves before King Kai's wish (King Kai and Bubbles wait on his planet afterwards). Flags
  `c12_wyrmDown`, `c12_alloyCut`, `c12_summoned`, `c12_wishDone`. Episode 69 (the Dr. Slump crossover) is left out on
  purpose, another property; in Chapter 12 Bulma's last line only sends Goku off to guard the inventors' fair.
- **Baseball** (ep 70; `c12_baseball.ts`, map `c12_ballpark`; silver `c12_ball`). Champa and Vados wait at the Capsule
  Corp garden table (Chapter 12 and post-game); Champa's challenge plays the ninth inning at West City Ballpark as a
  LoG2-scale minigame on the normal controls, the player as Yamcha (a costume over the active hero, no fighting, HUD
  hidden, the map sealed). Top: fly balls to centre field, a chalk ring marks the landing spot, walk or run under it
  (`CATCH_RADIUS`); Magetta, Botamo and Goten make their own outs, so the half always ends. Bottom: Champa's fastball,
  curve and "godly" pitch that stops in mid-air; A as the ball crosses the plate (`SWING_WINDOW`, `SWEET_SPOT`: a home
  run), else the umpires rule the godly pitch illegal (ki); on base, Goku's hit sends Yamcha home and A at the plate
  slides under Botamo's tag (`SLIDE_WINDOW`), else Champa's glowing tag is ruled destruction. Universe 7 bats in one
  order (Goku, Krillin, Gohan, Piccolo, Trunks, Yamcha) and claws back the runs Universe 6 scored with the bases left
  empty, so Yamcha always comes up with two out, the game tied and Goku on deck, and always scores the winning run; how
  it was played is his MVP score (`c12_ballMvp`, at most `MVP_MAX` 6), and `MVP_BONUS` 5 earns Beerus's bonus on top of
  the signed game ball and a capsule. Flag `c12_ballDone`.
- Tests: `tests/chapters/act5.test.ts` "Chapter 12: "Whose Wish?" and the baseball game" (hub count, both chains,
  every wish backer, the heat, map reachability, the core revisited after the episode, the ball game on real input
  and its rally for every score); fair play: `tests/balance.test.ts`
  "tuned fights: Chapter 12, the Earth's core" (the Mantle Wyrm at Goku L37 in Blue, and the mantle tunnels cleared as
  a grind zone with the heat running: no knock-out, at most one Senzu).

### Chapter 13 — "Universe Survival" (L42→45) — LoG2 parallel: the pre-Cell-Games collection chapter
- **Zeno Expo** (eps 78-82, `c13_expo.ts` + `c13_expo_data.ts`, gold `c13_expo` with its star on Zeno's palace): the
  Grand Priest's one-hour deadline (Gohan and Buu join Goku), Universe 9 met at `zeno_palace`, then the bouts in the
  World of Void (`c13_expo`) before both Zenos and every god (Universe 9's Sidra, Roh and Mojito; the hooded Toppo in
  Universe 11's box). The palace meeting stages Universe 7 west of the throne-room carpet and Universe 9 east of it,
  clear of the arch and the pillar ranks. The Expo's rules are canon's: one against one, anything goes, and a match
  goes on until Zeno is satisfied or a fighter cannot continue (Universe 7's ring-out rule does not count).
  - **Buu vs. Basil** (ep 79), played as Buu: an outfit over a forced Goku (Cabba's precedent). Buu is not a party
    member and the guest roster (`CharId`: Android 17, Frieza) would need a new character with its own save data,
    curve and NPC reactions for one bout. Buu has Goku's level and base stats, Ki Blast and Kamehameha, no Z form, and a
    rubber body that snaps back once per bout (at 35% HP, to 75%). Basil's blast through Buu, the blasts Buu bats into
    the stands (one floors Mr. Satan; the hooded Toppo puts another out and scolds Buu, speaking without a face or a
    name) make Buu furious (STR/POW +8). At phase three Buu knocks Basil out of the ring and Goku calls a ring-out, but
    the Grand Priest rules that Universe 7's rules don't apply and the Zenos want more; Basil crawls back in, asks Roh
    for "that", and the "tonic" pumps him into Danger Doping (`c13_basilDoped`; Beerus cries foul, "anything goes").
    `endAt` 0.15: Basil's Wolfgang Pressure, Buu's full-power Kamehameha, and the drug wears off. Back in the stands
    Buu heals Mr. Satan and the Grand Priest mends the ring with a snap of his fingers. No EXP (Goku only lends Buu his
    stats).
  - **Gohan vs. Lavender** (ep 80), forced Gohan: the mist (phase two) blinds him: darkened view, Lavender cloaked, a
    toxin that drains HP (never below 1). Cues: footstep dust, the hiss before a strike, a flicker, a reveal after each
    landed blow, hearing while standing still; Super Saiyan reads his ki like a radar (no cloak) but triples the toxin
    (the first time, `c13_lavender_radar`: Gohan senses him and Whis warns about the poison). Phase three he flies (no
    footsteps). `endAt` 0.3: Gohan's Kamehameha against the poison blast (beam struggle), then he grabs Lavender from
    behind and slams them both into the ring, a double knock-out, a draw. Gohan is
    healed with one of the Supreme Kai's Senzu Beans (canon: Shin brought a bag and offered it mid-bout; Dende is not
    at the Expo), the Supreme Kai tops the pouch up, and the Grand Priest tells every god about the mortal-level ranking
    (Universe 7 3.18, Universe 9 1.86; 1, 5, 8 and 12 exempt) and the erasure.
  - **Goku vs. Bergamo** (ep 81): his speech turns the gods against Goku and Zeno grants his wish (no erasure if
    Universe 9 wins). He grows with the blows he absorbs, at 80% and 55% (`c13_bergamoL`, `c13_bergamoXL`: 1.5x and
    2x sprite, bigger hurtbox, harder hits, slower); `endAt` 0.3: Blue Kaio-ken Kamehameha against the Wolfgang
    Penetrator (beam struggle), a knock-out; he shrinks back as he falls.
  - **Goku vs. Toppo** (eps 81-82): Toppo jumps down uninvited; Goku opens in Super Saiyan; Justice Tornado, the
    Justice Crusher hold, Blue, and a point-blank Kamehameha (Instant Transmission) that tears his uniform; a short
    bout (`endAt` 0.5 or the 45 s `MATCH` clock); as Goku adds Kaio-ken and charges a Kamehameha the Grand Priest stops
    it before anyone dies: a draw. Toppo names Jiren and refuses Goku's handshake; then the Tournament of Power's rules (eight
    universes, ten warriors each, 100 tak / 48 minutes, ring-outs, no killing, weapons or flying, the Super Dragon
    Balls, erasure, about forty hours away).
  - A knock-out at the Expo is never a Game Over: Zeno asks for an encore and the bout restarts (Toppo's ends in the
    draw). Finished bouts set `c13_expoBuu/Gohan/Bergamo/Toppo`, so a replayed Expo (Beerus at Capsule Corp) resumes at
    the next one (Goku comes down from his seat into the ring for Toppo); `c13_expoSeen` when it is over. Cutscene
    beats staged around a fighter are clamped inside the ring (`inRing`), never onto the void. Fair-play checks: `tests/balance.test.ts` "tuned fights: the Zeno
    Expo" (Basil ratio 3.1, Lavender 2.8, Bergamo 3.3, Toppo 4.1; 5/5 seeds, at most 1.2 Senzu).
- Recruit Team U7 (gold `c13_team` with four silver sub-objectives, any order): Krillin & 18; Tien & Roshi;
  **Gohan** trains with Piccolo (`setForm('gohan','ultimate')`, learns `kamehameha`; spar Piccolo); **Android 17**
  on Monster Island (`c13_monster_*`, Galactic Poachers mooks + Poacher boss; Goku vs 17 spar). Piccolo learns
  `hellzoneGrenade`. Then Buu falls asleep → the tenth warrior: **Frieza** revived from `hell_lake` for 24 hours
  (U9 assassins, spar Golden Frieza) → `c13_finish` → `c14_start`.
- **"Meanwhile, in Universe 6"** (`c13_u6.ts`): two cutaways where the anime cuts to Sadala, both played as
  **Cabba** (an outfit over a forced Vegeta: his level and techniques, Z forms set aside, HP/EP stashed and restored
  afterwards; the EXP stays with Vegeta; the hero who was playing gets the controls back, forced or free as before).
  - Part one (eps 88-89, gold `c13_u6`): plays from `c13_check` as soon as Gohan has trained or Tien has joined,
    then cuts back to where the player stood. Champa's planet (`c13_champa_terrace`, Champa and Vados give the
    order) → Sadala old quarter (`c13_sadala_quarter`): Renso's bad leg, a free-roam brawl with five of Caulifla's
    gang (base Cabba, a toast counts the rest down), the hideout, Cabba's Super Saiyan wins Caulifla over; Kale
    watches, jealous.
  - Part two (eps 92-93, gold `c13_u6kale`): runs inside `c13_whis_frieza`, between Goku's Frieza pitch and his visit
    to Hell (ep 93 cuts between them). The crags (`c13_sadala_crags`): Caulifla's first Super Saiyan (the "tingle in
    the back"), spar vs `c13_cauliflaSSJ` (`endAt` 0.55, `loseOk`, called a draw when her stamina gives out), Kale's
    first berserk Legendary form (`c13_kaleBerserk`, "NO EFFECT" via `vulnerableIf`: `survive` 40, or reach Caulifla
    and press A on the `c13_u6ShoutT` trigger to make her step in), Caulifla throws herself between them, Kale's blast
    levels the far ridge and Caulifla talks her down → Champa's verdict (Hit has brought Frost in, ep 91) → back to
    Goku. A save that already had Gohan and Tien in plays part one first, straight into part two.
  - Goku never meets Caulifla and Kale before the tournament (Chapter 14 is their first meeting, as in the anime),
    and Caulifla's Super Saiyan 2 waits for the tournament (Goku shows her in ep 100).
- **Goku vs. Gohan** (ep 90, silver `c13_leader`, `c13_leader.ts`): plays inside `c13_check` the moment Tien and
  Gohan are both done (either order; from the dojo it moves to `c13_training_wilds`, whose wildlife scatters).
  Forced Goku: 2-on-2 round (Tien's Tri-Beam blocked, Goku vs `c13_gohanTag` while Piccolo charges, `survive` 30 /
  `endAt` 0.6), Piccolo's full-body wave ends it, Senzu Beans, then Goku vs `c13_gohanUltimate` (`endAt` 0.4,
  `loseOk`), a Super Saiyan Blue finish; Goku picks Gohan as leader (announced to the team at the Chapter 14
  gathering). The hero who started the beat is restored.
- Side: **7 escaped Monster Island animals** (LoG2's Missing Namekians, bronze `c13_animals`): beach, poacher camp,
  Baba's palace, Mt. Paozu (`paozu_home`), and three in old regions behind coloured gates of three different
  fighters, like LoG2's gated Nameks: the Cliff Bat in the sealed canyon cave (Vegeta 25, `waste_canyon`), the Baby
  Dino in the Highland Peak dino park (Goku 40, `snow_peak`), the Emerald Kite on Turtle Reef's outer atoll (Gohan
  25, `kame_reef`). 17 names the region and the barrier colour of the next missing one. All seven → reward;
  post-game → Jiren's rematch.
- Post-game (bronze `c13_sadala`): Cabba visits Capsule Corp, Sadala (U6) opens on the space map
  (`c13_spot_sadala`); Caulifla (SSJ2) and Kale tag-team rematch in her yard; Sadala townsfolk, Renso and the gang
  react; the crags become a T7 hunting ground.

### Chapter 14 — "The Tournament of Power" (L45→48 + god-mode finale) — LoG2 parallel: the Cell Games gauntlet
- Files: `c14.ts` (start, departure, the three stage relays, epilogue hand-off), `c14_setpieces.ts` (the set pieces
  with their own mechanics), `c14_obni.ts` (ep 103), `c14_veterans.ts` (eps 105-107: Master Roshi, Tien, Frost's
  trap), `c14_guests.ts` (guest costumes), `c14_assist.ts` (fighting partner, invisibility cues, twin boss),
  `c14_kit.ts` (staging and ring-outs), `c14_edge.ts` (cutscene ring-out geometry), `c14_enemies.ts`, `c14_cast.ts`
  (sprites + Scouter entries). Stage maps: `world/farC/top.ts`.
- Staging rule: every Chapter 14 actor and fighter is placed with `onStage`/`stageOn` (`c14_kit.ts`), on a tile the
  hero can walk to. The rings have floating rocks that only a flight circle reaches, fights seal the circles and shots
  stop at the void, so a fighter staged there could never be hit. Fighters also start `FIGHT_MARGIN` (3) tiles clear
  of the void where the platform allows, so a ring-out has to be earned rather than handed out by the spawn.
- Capsule Corp gathering (gold `c14_ready`), Beerus departs → `top_arena_a/b/c` (`ringOut` maps, gold `c14_top`).
  Three relays, one per ring, each run inline (LoG2 hand-offs: fade, the outgoing fighter stays on stage, the next
  forced fighter steps in fresh); a relay left before it is won restarts from its top. Order follows the anime:
  - **Stage A** (west ring, runs on arrival): opening melee waves (Gohan) → Trio de Dangers, U9 erased (Vegeta) →
    Krillin out (nine left) → Goku vs Caulifla (ep 100: Goku shows her Super Saiyan 2, which Chapter 13 leaves for this
    moment, and she copies it on the spot) → berserk Kale (`survive`, Goku), Jiren stops her → **Pride Trooper squad**
    (ep 101, Goku: Kahseral is `vulnerableIf: c14_squadDown` until his four troopers, Tupper, Zoiray, Kettle and
    Cocotte, are down; no summons, as Goku comes straight from surviving Kale, and Caulifla fights at his side as an
    AI partner; Kale takes control and blasts Kahseral out: five troopers lost) → **Kamikaze Fireballs** (ep 102, guest
    Android 17: Kakunsa plus Ribrianne and Rozie untouchable in the back. All three fight in their everyday looks and
    under their everyday names, Sanka Ku, Brianne and Su Roas, on the boss bar and the Scouter, and become Kakunsa,
    Ribrianne and Rozie when they transform together at Kakunsa's first phase change; 17 throws Kakunsa out) →
    **Gohan vs Obni** (ep 103, `c14_obni.ts`: Universe 10's last fighter hides his ki; his pattern summons
    afterimages, `c14_obniImage`, that run a circle around the hero, are drawn faint and cast no shadow, vanish at the
    first touch and fade after five seconds; a second phase at 70%; no ring-out mid-fight. At `endAt` 0.35 canon's
    finish: Gohan lets Obni's punch land to find the real one, a cross-counter, and a Kamehameha throws him out of the
    ring; the locket he drops (his wife and daughter) fades from Gohan's hand as Zeno erases U10) → **Goku & Hit vs
    Dyspo and K'nsi** (ep 104, Goku in SSG; Hit is an AI partner whose Time-Skip freezes his target; K'nsi out, Dyspo
    retreats) → **Master Roshi vs Universe 4** (ep 105, `c14_roshi`, Roshi as a guest: a two-fighter wave, Caway and
    Dercori, who stop dazed at 30% (see below); then canon's finishes: Roshi bats Caway's last blast aside and flexes,
    and she jumps off the stage herself; his Evil Containment Wave seals Dercori in a jar he throws off the stage, and
    Zeno finds it neat, so the Grand Priest allows it. Then Max Power against **Ganos**, who turns into a bird of prey
    at 65% and swoops; `endAt` 0.45, then Roshi's Kamehameha from his own life force (beam struggle) throws Ganos out,
    Roshi's heart stops, and he comes round with a joke) → **Tien and the snipers** (ep 106, `c14_snipers`, Tien as a
    guest while Roshi rests: **Harmira**, the real sniper, lies hidden in a nest across the ring (faint, shadowless) and
    fires at **Prum**, whose mirror body bounces each shot on at Tien; a glint at the scope gives the nest away, the
    shot's first leg points back to it, and Prum is untouchable (`invulnerable`: ki blasts come straight back, fists
    glance off). Tien's Multi-Form sends copies to watch the ring; coming close or landing a blow finds Harmira
    (`c14_sniperFound`), who holds his nest above 97% HP and then fights head-on. At `endAt` 0.6 he shoots the stage out
    from under Tien, Tien's three copies drag him down with Tien, and Vegeta's Galick Gun throws Prum out: eight left)
    → **Frost's trap** (ep 107, `c14_frostTrap`, Roshi again: Frost dodges the first Evil Containment Wave and turns
    the second back on Vegeta, who is sealed in Roshi's jar; Magetta has his ears plugged against Vegeta's insults.
    Roshi fights `c14_frostJar` with Magetta (metal: fists do half; dazed at 30%) at his back until Frost drops the jar
    at `endAt` 0.65; Frost cannot be rung out, as Frieza eliminates him next. Roshi smashes the jar, Vegeta goes Blue
    and throws Magetta out, Frost slips away, and Roshi retires on his own two feet: seven left) →
    Frieza (guest) vs Frost (ep 108) → Goku vs **Jiren** (`spiritBomb`, beam struggle, UI -Sign-) → **Hit vs Jiren**
    (ep 111, cutscene: Time-Skips read, Time Release on one spot, Time Prison, Hit out; Jiren walks away, he is not
    eliminated).
  - **Guests** (`c14_guests.ts`): Master Roshi and Tien are not party members. As Chapter 13 plays Cabba and Chapter
    11 plays Vegito, each is a costume (`outfit`) over a forced Goku: Goku's level, HP/EP growth and stats, the guest's
    own sprite and techniques (Ki Blast and the Kamehameha for both), no Z form. Putting a costume on stashes Goku's HP,
    EP, Z form and technique list (`c14_guestStash`) and steps the guest in fresh; Roshi's Max Power swaps in
    `c14_roshiMax` and adds +12 STR/POW/END, removed exactly when it ends. Taking the costume off gives Goku back
    exactly what he had; stage A takes any costume off before it (re)starts, so a reload mid-episode never leaves Goku
    dressed up. The guests' EXP goes to Goku.
  - **Dazed fighters** (`c14_veterans.ts` `daze`): Caway, Dercori and Magetta are regular fighters that carry a
    `boss.endAt` of 0.3 (`DAZED` in `c14_enemies.ts`). The engine stops any fighter at its `boss.endAt` instead of
    knocking it out, and `daze` then leaves it standing hurt, untouchable and out of the battle, so the scene after the
    fight finishes it the way canon does (and pays its regular EXP). A fighter rung out before that is simply gone, and
    the scene skips it.
  - **Stage B** (central ring, trigger band): Cabba's last stand (ep 112, narrated: Super Saiyan 2 against Universe
    4's Monna, then Frieza throws him out and Vegeta promises to wish Universe 6 back) → Goku shows Caulifla and Kale
    **Super Saiyan 3** (ep 113, cutscene; it drains him too fast to hold against a fusion) and they put on the Potara →
    **Kefla** (-Sign- returns) → **17 & 18 vs Ribrianne** (eps 117-118, 18 as AI partner; Super Ribrianne at her phase
    change; 18 knocks her out; Goku, 17 and 18 throw Rozie out) → **Gohan & Piccolo vs Saonel and Pirina** (ep 118,
    Piccolo as AI partner; twin boss: a downed twin regenerates to 60% unless the other falls within 10 s (HUD
    `REGEN`); canon's twist at the phase change: every Namekian of their world fused into them) → U6 and U2 erased →
    **Gamisalas** (ep 119, Piccolo: invisible except for dust footprints, a shimmer before each strike, a flicker, a
    reveal after each blow the hero lands, and Piccolo's hearing while the hero stands still; then Damom eliminates
    Piccolo, Gohan avenges him, U4 erased) → **Anilaza** (17; reactor puzzle, 18 out, U3 erased).
  - **Stage C** (east ring, trigger band): Vegeta reaches SSB Evolved (`finalFlash`) → Gohan & Frieza vs **Dyspo**
    (Gohan out) → **Toppo (God of Destruction)** vs Vegeta → Goku masters Ultra Instinct vs **Jiren** (god-mode) →
    the last stand (Frieza → Android 17), triple ring-out, 17 is the last one standing → Super Shenron, the wish.
- Journal: the four episodes of eps 103-107 are gold entries that open quietly and close inside their own scripts
  (Chapter 13's cutaway pattern, star on Zeno's palace): `c14_epObni`, `c14_epRoshi`, `c14_epSnipers`,
  `c14_epFrostTrap`.
- Set-piece flags: `c14_prideDone`, `c14_fireballsDone`, `c14_obniDone`, `c14_dyspoTagDone`, `c14_roshiDone`,
  `c14_snipersDone`, `c14_frostTrapDone`, `c14_hitOut`, `c14_ribrianneDone`, `c14_namekDone`, `c14_gamisalasDone`.
  Every set-piece boss is tuned to a LoG2 hits ratio ≤ 4 for its forced fighter (twins ≤ 2.5 each; the guests'
  opponents for Goku L42 in base form, Max Power against Ganos) and stays below Kefla. Partners add only a small
  share of the damage, so the hero still wins the fight; Hit's real help is the opening his freeze gives. A test bot
  that walks up and fights with the real damage rules both ways (no dodging; a Senzu counted at 20% HP) wins every
  set piece with at most four Senzu (two for eps 103-107) and loses a real share of its HP in each; the fair bot
  (`tests/balance.test.ts`, "tuned fights: c14 west ring, eps 103-107") wins each of the new episodes on at least 4
  of 5 seeds with at most 2 Senzu at the story's levels, and plays the whole stage A relay (fourteen fights) from the
  top on the party's one bag of three Senzu: at least 4 of 5 seeds without a knockout. Stage A is the longest relay
  in the game (twice LoG2's seven-fight Cell Games), so its new episodes are tuned to cost well under a full HP bar
  each (Obni about 70%, the others 25-60%), and the relay picks up in the middle of the ring after each time skip
  (`ringCentre`, `c14_edge.ts`) so no set piece is staged against the east exit.
- Free roam between relays (LoG2 hostile zone, 10-12 rivals per ring, T7): between stages A and B fighters of
  Universes 2, 3, 4 and 11 (U9 and U10 are already erased); after stage B only Universe 11's Pride Troopers; in the
  post-game every restored universe trains on all three rings. Relays sweep them first (`fc_topQuiet` during stage A).

### Epilogue & Post-game (`post_` prefix)
- After credits: free roam continues (LoG2 post-game), talk to Whis/Beerus to see the "true ending" scene.
- **Trophies**: L50 gates already exist (world builders): Gohan `paozu_peaks`, Vegeta `waste_mesa`, Trunks/Piccolo/Goku
  `snow_peak`. Collecting all five unlocks **Mr. Satan** as a playable character (`join('satan', …)`; LoG2's rule
  with the mark moved for the steeper L45+ curve: L40 if Goku was L48+ when Universe 7 won (`c14_gokuLv`), else L1)
  with his own NPC reactions. Unlike LoG2's Hercule he joins alongside Goku rather than taking his slot, because
  Goku is alive after the tournament (Guide §11, LoG2-parity notes).
- **Alternate ending**: Mr. Satan at L50 breaks the red ZTV gate in `satan_plaza` → press conference where he claims
  he beat the God of Destruction → credits (`post_ztv_ending`).
- **Delicacies** (25) → Whis gives `whisStaff`. **Monster Island animals** (7) → 17 → optional superboss (Hit, no
  rules / Jiren rematch at `zeno_palace`) with a big reward (pow5 etc.).
