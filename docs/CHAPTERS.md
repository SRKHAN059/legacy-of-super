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
Ch9 Trunks rejoins L30 · forms/techs per Guide §5. Level curve: P 6 · 1: 1–8 · 2: 8–12 · 3: 12–15 · 4: 15–18 ·
5: 18–22 · 6: 22–25 · 7: 25–29 · 8: 29–31 · 9: 30–34 · 10: 34–37 · 11: 37–40 · 12: 40–42 · 13: 42–45 · 14: 45–48.

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
  Piccolo is healed by a Senzu. Epilogue party at `cc_yard`. → `c07_start`.

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
- Beerus demands to fight "Monaka" (Goku in disguise — comedy boss with `endAt` 0.9). Galactic Patrol job on
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
- Gold quest: complete any 2 of 4 episodes to continue: **Hit's contract** (Goku vs Hit, rooftop at night in
  `satan_plaza` overlay, `endAt`), **Pan's first flight** (babysitting chase), **Great Saiyaman** movie shoot
  (Gohan, comedy fights vs costumed "Watagash"), **Krillin's comeback** (Forest of Terror illusion rush). Unlock
  `spot_snow` (late-game grinding, trophy gates).

### Chapter 13 — "Universe Survival" (L42→45) — LoG2 parallel: the pre-Cell-Games collection chapter
- Zeno Expo: Goku vs **Toppo** exhibition (`endAt` 0.5); Zeno announces the **Tournament of Power**.
- Recruit Team U7 (gold quest with sub-objectives): Krillin & 18; Tien & Roshi; **Gohan** trains with Piccolo
  (`setForm('gohan','ultimate')`, learns `kamehameha`; spar Piccolo); **Android 17** on Monster Island (your maps
  `c13_monster_*`, Galactic Poachers mooks + Poacher boss; Goku vs 17 spar); **Frieza** revived from `hell_lake`
  for 24 hours (spar Golden Frieza). Buu falls asleep → Frieza takes his place. Piccolo learns `hellzoneGrenade`.
- Side: **7 escaped Monster Island animals** (LoG2's Missing Namekians) — find and return them to 17 → reward
  (post-game) unlocks an optional superboss.

### Chapter 14 — "The Tournament of Power" (L45→48 + god-mode finale) — LoG2 parallel: the Cell Games gauntlet
- `top_arena_a/b/c` (`ringOut` maps). Opening melee with waves of fighters from many universes (`universeFighter`,
  `prideTrooper`, register more), Gohan leads (forced) with swaps. Bosses in order (relay, each with a forced
  character): U9 trio (Basil/Lavender/Bergamo), Kale berserk (`survive`), Caulifla & Kale → **Kefla** (Goku reaches
  UI -Sign- mid-fight: `transformNow('ui')`), U3's robot, **Toppo (God of Destruction)** vs Vegeta
  (`setForm('vegeta','ssbe')`), **Dyspo** (Gohan + Frieza), **Jiren** — Goku masters Ultra Instinct (god-mode, like
  LoG2's SSJ2 Gohan; `transformNow('ui')`), then the last stand: Frieza → Android 17 vs Jiren, ring-out of all three,
  17 is the last one standing. Goku learns `spiritBomb` for the big clash (**beam struggle**). Vegeta learns
  `finalFlash`. 17's wish restores the erased universes → credits.

### Epilogue & Post-game (`post_` prefix)
- After credits: free roam continues (LoG2 post-game), talk to Whis/Beerus to see the "true ending" scene.
- **Trophies**: L50 gates already exist (world builders): Gohan `paozu_peaks`, Vegeta `waste_mesa`, Trunks/Piccolo/Goku
  `snow_peak`. Collecting all five unlocks **Mr. Satan** as a playable character (`join('satan', …)`; LoG2 rule:
  L40 if Goku ≥ L45 else L1) with his own NPC reactions.
- **Alternate ending**: Mr. Satan at L50 breaks the red ZTV gate in `satan_plaza` → press conference where he claims
  he beat the God of Destruction → credits (`post_ztv_ending`).
- **Delicacies** (25) → Whis gives `whisStaff`. **Monster Island animals** (7) → 17 → optional superboss (Hit, no
  rules / Jiren rematch at `zeno_palace`) with a big reward (pow5 etc.).
