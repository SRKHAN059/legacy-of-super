# Legacy of Super — Content Authoring Guide

You are writing content for **Legacy of Super**, a browser game that re-creates the GBA action-RPG
*Dragon Ball Z: The Legacy of Goku II* (LoG2, Webfoot 2003) **mechanic-for-mechanic**, but tells the story
of **Dragon Ball Super** (anime episodes 1–131: Beerus → Golden Frieza → Universe 6 → Future Trunks/Zamasu →
Tournament of Power). The engine is finished. Your job is maps, scripts, enemies, bosses, quests and dialogue.

Read these before writing anything:

- `../research/log2_mechanics.md` — what LoG2 is (structure, storytelling method, quest style, bosses).
- `../research/dbs_story.md` — the DBS story bible (arc beats, battles, locations, NPC ideas, chapter plan).
- `src/game/script.ts` — the full `ScriptApi` (every method is documented).
- `src/game/mapdef.ts` — the map format.
- `src/content/dev/sandbox.ts` — a small working example of maps + scripts + a boss (developer content: dev
  server and tests only, never in a production build; see §9).

**Quality bar.** This should feel like a real, finished LoG2-style game: dense hand-made maps with landmarks
and paths (not empty rectangles), NPCs with personality who say different things as the story progresses,
cutscenes staged with walking/facing/emotes/pans/flashes, side quests with rewards, bosses with multiple phases.
Write dialogue in-character and **paraphrase** the anime — never copy dub/sub lines verbatim. Keep jokes and heart.

---

## 1. Hard rules

1. **Only touch your own files.** Each agent owns a folder (e.g. `src/content/world/earth_a/` or
   `src/content/chapters/c03/`). Never edit engine files (`src/engine`, `src/game`, `src/ui`, `src/art`) or other
   agents' folders. If you need an engine change, finish what you can and describe the request in your final report.
   Shared registries you may **call** (not edit): `registerMaps`, `registerOverlay`, `registerScripts`,
   `registerEnemies`, `registerQuests`, `registerItems`, `registerCast`, `registerCreatures`, `registerProp`,
   `registerSpots`, `registerScans`.
2. **Your folder is already registered** in `src/content/index.ts` (its `index.ts` is imported). Put everything in
   your folder and import your other files from your folder's `index.ts`. Do **not** edit `src/content/index.ts`.
3. **Id prefixes.** Everything you create gets your prefix: maps `c03_…` (chapter maps) or the region prefix
   given to world builders (`paozu_…`, `wc_…`), scripts `c03_…`, flags `c03_…`, quests `c03_…`, enemies `c03_…`,
   items `c03_…`, cast `c03_…`. Shared hub map ids are fixed by this guide (§8).
4. **Must pass before you finish:**
   ```
   npx tsc --noEmit
   npx vitest run
   ```
   `tests/content.test.ts` validates every reference (maps, warps, sprites, enemies, items, scripts, bounds).
   `tests/scripts.test.ts` smoke-runs every script referenced by a map with a bot that skips dialogue and
   auto-wins fights; it fails on any `console.error` (unknown actor, item, map, enemy…) or a script that hangs.
   Also add your own chain test in `tests/chapters/<yours>.test.ts` (see §9).
5. Paraphrased dialogue only. Use `{hero}` in text for the active character's name.

---

## 2. Engine facts you must design around (identical to LoG2)

- Screen 240×160, 16-px tiles → 15×10 tiles visible. Maps scroll. Typical outdoor map 32–48 × 24–34 tiles;
  interiors 12–20 × 9–14. Minimum 15×10.
- **Hostile zones** (`hostile: true`) are the only places you can attack/fire. Towns and interiors are safe.
- **Movement** is free 8-way; double-tap to run. No free flight: **flight circles** (`objects: {type:'flight'}`)
  hop to fixed spots; **world-map signs** (`{type:'worldSign'}`) take off to the Mode-7 world map.
- **Save points** (`{type:'save'}`) = Save + Switch Character. Put one at every region entrance, before bosses,
  and in hubs. Saving is only possible there.
- **Level gates** (`barriers`): a coloured wall with a number. Only that `character` at ≥ `level` can break it
  (by hitting it). Colours are automatic. `character` omitted + `openIf` = white story gate that opens by flag.
  Gate colours: Goku orange, Vegeta dark blue, Gohan light blue, Trunks purple, Piccolo green, Mr. Satan red.
  Gates on the critical path (LoG2's grind-and-rotate gates) are **story gates**: one table, `STORY_GATES` in
  `chapters/common.ts`, places them by overlay with their hint triggers and is tested end to end in
  `tests/full_game.test.ts` (see `docs/CHAPTERS.md` Story gates). Don't add another gate across a story route in a
  map file; add a row there. Side gates (caches, trophies) stay in map files as before.
- **Enemies respawn** every time a map is entered (unless they have an `id`, which makes them one-off).
- **Drops** (food = HP, ki orbs = EP) are automatic (ROM drop table). Breakable rocks/jars/crates give drops too.
  A breakable with an `id` and a fixed `item` keeps that item where it fell until it is picked up (leaving the map
  never loses it).
- **Level cap 50, stats cap 100.** EXP per regular kill is clamped by the engine to [1/128, 1/2] of the
  player's current level span, so enemy `exp` only needs to be in the right ballpark for its tier (§6).
  Boss `exp` is paid in full (scripted reward).
- **Party**: Goku, Vegeta, Gohan, Trunks, Piccolo (+ secret Mr. Satan). Characters join at fixed story points
  with LoG2-style rolled stats. The story often forces a character (`force(s, id)` = switchTo + `noSwitch` flag).
  Levels come from EXP and the story gates; a chapter hand-over is only a safety net that lifts the hero who played
  the last chapter to band start − 5, never the bench (see `docs/CHAPTERS.md` Party timeline); `force()` lifts a
  benched character to band start − 3 so a forced segment is never a wall.
- **Fights are sealed**: while `fight`/`clearEnemies` runs, doors, map edges, save discs, world signs, flight circles,
  Whis's Charm **and NPC talk** are off (A throws a punch). Action triggers (`onAction`) still work mid-fight, for
  puzzles like the c08 glyph pillars — never warp from one that can fire mid-fight (a warp that leaves a fight
  abandons it: the fight's script is unwound with a `FightAbandoned` warning).
- **Bosses have poise** (LoG2 chase-lock): a hit stuns a boss for at most 6 frames; after 5 quick hits it breaks free
  (shockwave, ~1 s of stun immunity, a counter move from its phase: teleport/timeSkip/dash/charge/nova/volley/guard).
  Stun techniques (Trunks's Burning Attack, the Spirit Bomb) hold a boss ~1.5 s (regular enemies 4 s), and hitting
  a boss out of its bull-charge wind-up staggers it; both end with the boss breaking free. Mashing A never pins a boss.
- **Dialogue box**: opens at the top automatically when the speaker stands low on screen; L/R move it by hand.
  `ask()` prompts longer than one box are paged; the options open with the last page.

---

## 3. Map format (see `src/game/mapdef.ts`)

```ts
registerMaps([{
  id: 'paozu_forest', name: 'Paozu Forest', music: 'field', hostile: true, region: 'Mt. Paozu',
  legend: { '.': 'grass', ',': 'darkGrass', '=': 'path', '~': 'water', '#': 'cliff', 'd': 'dirt' },
  grid: [ /* rows of equal length, one char per 16px tile */ ],
  props: [['tree', 3, 4], ['pine', 10, 2], { kind: 'rock', x: 7, y: 9 }],
  npcs: [{ id: 'c01_farmer', sprite: 'farmer', x: 12, y: 8, talk: 'c01_farmer_talk', name: 'Farmer', wander: 2, showIf: 'chapter<=2' }],
  enemies: [{ type: 'wolf', x: 20, y: 10 }, { type: 'c01_dreamFrieza', x: 15, y: 6, id: 'c01_dream', showIf: 'c01_sleeping' }],
  warps: [{ x: 5, y: 3, w: 1, h: 1, to: 'paozu_house', tx: 6, ty: 8, dir: 'up', door: true }],
  exits: { west: { to: 'paozu_home' }, north: { to: 'paozu_peaks', offset: -4, showIf: 'c01_peaksOpen', lockedScript: 'c01_tooDangerous' } },
  triggers: [{ id: 'c01_ambush', x: 18, y: 4, w: 3, h: 2, script: 'c01_ambush', once: true, showIf: 'quest:c01_find' }],
  pickups: [{ id: 'del_paozu1', item: 'delicacy', x: 30, y: 20 }],
  barriers: [{ id: 'g15', x: 39, y: 10, w: 1, h: 3, level: 15, character: 'goku' }],
  objects: [{ type: 'save', x: 4, y: 12 }, { type: 'worldSign', x: 2, y: 14 }, { type: 'breakable', x: 9, y: 9, size: 2 }],
}]);
```

**Terrains** (`src/art/tiles.ts`): walkable — `grass darkGrass dirt path sand rock wasteland floor wood carpet tile
arena snow ice alienGrass ruins asphalt cloud marble hellRock metal`; solid — `cliff wall roof void sky` (`sky` = open air around the Lookout / high places);
liquid (solid, beams fly over) — `water deep lava`. Higher-priority terrains blend jagged edges over lower ones
automatically; cliffs cast a shadow on the tile below. Use `cliff` rows/blocks for mountain walls and map borders,
`wall` + `roof` for building shells in interiors, `void` for space/tournament edges (set `backdrop`).

**Props** (`src/art/props.ts`, drawn y-sorted, most are solid): `tree pine palm deadTree alienTree bush rock
boulder smallRock flowers grassTuft sign fenceH fenceV domeHouse capsuleCorp kameHouse hut lamp crate barrel jar
pillar brokenPillar rubble crater statue tower building ruinedBuilding car spaceship pod timeMachine bed table chair
bookshelf tv plant counter stairs caveEntrance pyramid throne floatingRock savePoint chest cactus tent campfire well
mailbox grave portal lookout rug fountain shrine stoneArch`. Prop x/y is the bitmap's **top-left tile**; check the
prop's size in `props.ts` (e.g. `capsuleCorp` is 112×88 px = 7×5.5 tiles, `domeHouse` 56×48, `tree` 32×40).
Need a landmark that doesn't exist? `registerProp('c07_ring', () => { const p = new Painter(w,h); …; return { bmp: finishProp(p), solid: {x,y,w,h} } })`.

**Doors/interiors pattern.** Outdoor: a 1×1 warp on the door tile of a house prop (e.g. `domeHouse` door is at
prop-x+1..+2, prop-y+2 tiles → warp at (x+1, y+2)). Interior: `indoor: true`, top 2–3 rows `wall`, floor rows,
a warp along the bottom-centre edge back outside. **Always place the arrival tile 1 tile away from the reverse warp**
(otherwise you bounce). Arrival must be walkable (not inside a prop's solid box).

**Edge exits**: walking off the map edge into the neighbour. The perpendicular coordinate is kept (+`offset`).
Design neighbouring maps so their shared border has walkable openings that line up. The regional map (R) lays
maps out using these exits, so keep them geometrically consistent. The player arrives 1.2 tiles in from the far
edge, so the first two rows (or columns) behind an opening must be clear, gates included. The wedge scan in
`tests/content.test.ts` (`tests/walkscan.ts`) holds every map to this. It checks that every warp, flight circle,
landing spot and edge position lands on a free feet box. It also checks that every chest, sign, NPC, pickup and
trigger can be reached, and that no gap the player must pass is exactly as wide as the feet box (10×6 px; leave at
least 1 px to spare).

**Coordinates**: everything is in tiles. NPC/enemy `x,y` = the tile they stand on.

**Overlays.** Hub maps are built once by world builders. Chapters add their NPCs/enemies/triggers with
`registerOverlay('cc_yard', { npcs: [...], triggers: [...], onEnter: 'c05_cc_enter' })`. Arrays are appended;
`onEnter` scripts accumulate (each must self-gate). **Gate every overlay element with `showIf`/`hideIf`**
(e.g. `showIf: 'chapter==5'`, `hideIf: 'c05_done'`).

**Conditions** (`showIf`/`hideIf`/`openIf`/`s.check()`): `flag`, `!flag`, `a&b`, `chapter>=3` (`>= <= == > <`),
`has:item`, `char:vegeta` (active character), `quest:id` (active), `done:id` (finished), `world:space` (the world the
player is in: `earth`, `future` or `space`).

**One place at a time.** A named character stands on one map per story point: when the story puts someone elsewhere
(a party, a battlefield, off-world), gate their usual NPC away for that stretch. `showIf` is one conjunction and
`hideIf` one more, so a character with several absences gets one NPC def per stretch (same id, disjoint conditions).
A character who carries the player somewhere (Whis between Earth and space) is gated by `world:`, so he is on the
player's side of the trip. `tests/full_game.test.ts` checks this at every story point of the one-save run.

---

## 4. Scripts (`src/game/script.ts`)

Scripts are async functions registered by id: `registerScripts({ c01_intro: async (s) => { … } })`.
Controls are locked while a script runs (cutscene) unless the script calls `s.free()` (or `fight`, which frees
control during the fight automatically). NPC talk scripts get `s.npc`. Everything is awaited:

```ts
c01_chichi_talk: async (s) => {
  if (s.check('done:c01_radishes')) { await s.say('chichi', 'Dinner\'s at six. Don\'t be late, {hero}!', 'happy'); return; }
  if (s.count('c01_radish') >= 5) {
    s.take('c01_radish', 5);
    await s.talk([['chichi', 'Five radishes! You CAN work when you want to.', 'happy'], ['goku', 'Heh. Can I go train now?']]);
    await s.done('c01_radishes');
    await s.give('cookie', 3);
    return;
  }
  await s.say('chichi', 'Bring me five radishes from the field. And no training until you do!', 'angry');
  await s.quest('c01_radishes');
},
```

Key calls (see doc comments for all): `say(who,text,expr)`, `talk([...])`, `narrate`, `ask(who,text,opts)`,
`flag/set/clear/check/num/inc`, `give/take/has/count`, `quest/done`, `join/switchTo/learn/learnCharged/setForm/
transformNow/outfit/heal/exp`, `chapter(n,title,subtitle)` (title card + sets chapter), `warp(map,x,y,dir)`,
`fadeOut/fadeIn/wait/seconds/shake/flash/tint/letterbox/music/sfx/banner/toast`, `hasScript/call` (run another script inline), `pan(x,y,frames)/follow()`,
`spawn(id,sprite,x,y,dir,name)/remove/walk/walkAll/place/face/pose/sprite/aura/show/silhouette/lift/flyTo/emote/
powerUp/boom/blast/clash`, `spawnEnemy/waitDefeat/clearEnemies`, `fight(type,{x,y,uid,survive,loseOk})`,
`unlockRegion(spotId)`, `worldMap(world)` (entering any map reachable from a landing spot also sets the `world`
flag to that map's world, so story warps between Earth, Future Earth and space need no manual `set('world')`), `free()/lock()`, `carry(label, onBreakScript)/drop()/carrying`
(LoG2 egg-escort: no attacking while carrying, a hit breaks it), `beamStruggle(heroCastId, foeCastId, heroColor,
foeColor, taunts[], pressure)` (unlosable mash-A clash for finales), `scouterDatabase()` (CC computer).
Maps with `ringOut: true` (Tournament of Power) eliminate enemies knocked hard into `void` tiles (counts as a kill;
bosses only if `boss.ringOut`).

Speakers: a cast id (`'bulma'`), an NPC id on the current map, `'hero'`, or `'narrator'`. Expressions:
`neutral happy angry shock sad smirk shout hurt`.

**Staging cutscenes** (LoG2 style): `s.letterbox(true)`, spawn actors off-screen, `walk`/`flyTo` them in, `face`,
`emote`, `pan` the camera to reveal things, `shake`+`flash` for impacts, `boom`/`blast`/`clash` for fights that
happen in cutscenes, `powerUp(id, color)` + `sprite(id, 'gokuSSG')` for transformations, `fadeOut`/`warp`/`fadeIn`
for scene cuts, `narrate('Meanwhile, on Beerus\'s planet...')` for cuts across space and time.

**Boss fights**: `const r = await s.fight('c03_beerus', { x: 12, y: 8, uid: 'c03_beerus1' })`.
Result is `'end'` when the boss reaches `boss.endAt` (LoG2's scripted endings: "ends at 50%" etc.), `'win'` if
killed (`endAt: 0`), `'timeout'` for `survive: 60` fights, `'lose'` with `loseOk: true` (story losses —
the hero is left at 1 HP instead of Game Over). After the fight the boss stays on the map as a puppet you can
script (walk away, `remove`). Spawn the boss as an NPC first for the pre-fight talk, `remove` it, then `fight` at the
same tile.

**Chapter flow** (journal-driven, exactly like LoG2): each chapter opens with `await s.chapter(n, 'Title')`,
sets up the forced character (`s.switchTo`, `s.set('noSwitch')` while forced), adds a **gold** quest whose `region`
is the world-map spot the star should point to, and ends by completing it, granting rewards, and starting the next
chapter's first beat (warp + next chapter script). Side quests are silver/bronze.

```ts
registerQuests([{ id: 'c03_dragonballs', title: 'Gather the seven Dragon Balls', star: 'gold', region: 'spot_westcity',
  desc: 'Bulma\'s Dragon Radar shows the balls scattered across Earth. Pilaf\'s gang has some of them!' }]);
```

---

## 5. Characters, forms and techniques timeline (single source of truth)

| Chapter | Join / unlock (call in your chapter) |
|---|---|
| Prologue | Trunks L6 (`join('trunks',6)`), techs kiBlast + burningAttack, form `ssj`. Trunks leaves the party at the end (`s.state.char('trunks').joined = false`) — his stats carry over to Ch9 like LoG2. |
| 1 | Goku L1 (start). Learns `kamehameha` early in Ch1; regains `ssj` form at King Kai's. |
| 2 | Vegeta joins L8 (bigBang, form `ssj`). Bulma gives the **Scouter** (Select scan, R map). |
| 12→13 | Flag `scouterPlus`: Bulma's Scouter upgrade (LoG2's post-announcement upgrade) — the R map also shows unexplored areas, in grey. `ensureChapterState` grants it at the start of Ch13 at the latest; an act may `s.set('scouterPlus')` earlier in a Bulma beat with a narrator line. |
| 3 | Goku form → `ssg` after the ritual. Dragon Radar obtained. |
| 4 | Whis starts appearing (Delicacy quest giver). |
| 5 | Gohan joins L16 (masenko, form `ssj`), Piccolo joins L18 (specialBeamCannon, form `unweighted`). Master Roshi's charged-melee training (Kame House) becomes available (silver quest; each character talks to Roshi once). |
| 6 | Goku & Vegeta form → `ssb`. Vegeta learns `galickGun`. |
| 7 | Goku uses `ssbkk` in the Hit fight only (`transformNow('ssbkk')`). Super Dragon Balls. |
| 9 | Trunks rejoins L30 (`join('trunks',30)` — stats roll on top of prologue stats), learns `swordBlast`, `learnCharged('trunks')`. |
| 11 | Trunks form → `rage`. Vegito Blue is a scripted relay segment (temporary `outfit`/`sprite` swap). |
| 13 | Gohan form → `ultimate`, learns `kamehameha`; Piccolo learns `hellzoneGrenade`. |
| 14 | Goku learns `spiritBomb`; Vegeta form → `ssbe`, learns `finalFlash`; finale: Goku `transformNow('ui')` (god-mode, like LoG2's SSJ2 Gohan), relay with guests Android 17 / Frieza via `switchTo('android17')` etc. |
| Post | Trophies (L50 gates) → Mr. Satan unlock + alternate ending. |

**Hero level curve** (cap 50), the levels the heroes a player plays reach in each chapter's story fights in the
measured story run (`tests/fixtures/story_fights.json`; per hero in `docs/CHAPTERS.md`'s band table): Prologue Trunks
6–7 · Ch1 1–10 · Ch2 8–12 · Ch3 10–15 · Ch4 15–16 · Ch5 16–19 · Ch6 19–20 · Ch7 20–25 · Ch8 26–28 · Ch9 28–33 ·
Ch10 29–35 · Ch11 34–35 · Ch12 35–37 · Ch13 39–41 · Ch14 41–44 · Post 44–50 (the L50 trophy gates). Tune a chapter's
fights and zones to these levels, not to `CHAPTER_MIN_LEVEL`: that table is the anchor of the hand-over and
forced-fighter safety nets and the floor of a chapter started on its own (tests, `?map=`), and most chapters' heroes
start below it.

---

## 6. Stats and balance

Damage uses the exact LoG2 ROM formula (cubic in STR/POW, END subtracts proportionally — see
`src/game/leveling.ts`). Design enemies by tier using the shared bestiary (`src/content/bestiary.ts`) as reference:

| Tier | Hero lv | HP | STR/POW | END | exp (paced, see below) |
|---|---|---|---|---|---|
| T1 | 1–5 | 35–70 | 6–8 | 3–5 | 15–140 |
| T2 | 6–12 | 150–300 | 12–18 | 8–14 | 120–600 |
| T3 | 13–20 | 400–700 | 20–28 | 15–22 | 300–2500 |
| T4 | 21–28 | 800–1200 | 28–36 | 22–30 | 2000–9000 |
| T5 | 29–36 | 1400–2200 | 36–46 | 30–40 | 5000–20000 |
| T6 | 37–44 | 2500–4000 | 46–58 | 40–50 | 15000–45000 |
| T7 | 45–50 | 4500–6500 | 58–70 | 50–62 | 25000–60000 |

**Bosses** (LoG2's own boss table, mapped to hero level):

| Hero lv | HP | STR / POW / END | exp (scripted, full) |
|---|---|---|---|
| 1–3 (tutorial) | 130–400 | 8–11 / 6–8 / 4–5 | 20–275 |
| 8–12 | 850–1500 | 18–22 / 10–18 / 15–25 | 1500–3000 |
| 15–20 | 2000–3000 | 21–29 / 14–34 / 11–27 | 3400–9000 |
| 21–28 | 3500–5200 | 32–39 / 32–41 / 34–46 | 12000–30000 |
| 29–36 | 4900–6500 | 44–50 / 46–55 / 50–60 | 40000–60000 |
| 37–44 | 6500–8200 | 50–60 / 55–60 / 60–65 | 80000–200000 |
| 45–50 (final/optional) | 8200–12000 | 60–80 / 59–90 / 65–90 | 300000–600000 |

**Late-game engine curve** (no data change needed): hero HP compounds per level while these tables grow linearly,
so the engine scales enemy damage by the attacking stat (`enemyPowerScale`: ×1 up to 28, ×1.32 at 36, ×1.64 at
44, ×1.96 at 52, capped ×2.4 from 63 — every enemy and boss attack, shots and beams included) and trims regular enemies' HP from STR/POW 44
up (`enemyMaxHp`: −25% at 58+; bosses keep their HP). Keep authoring against the tables above; the scouter shows the
trimmed HP. Exploders' death blast hits with max(STR, POW) ×1.1.

**Regular enemies are tuned in play, not only by tier.** The tables above are where to start; what counts is the
hero who walks into the zone, at the level and in the form the story brings: LoG2's per-enemy band is 5-9 melee
strings to drop one and 15 or more of its hits to knock the hero out, and a zone clear costs no knock-out and at most
one Senzu. Lower HP, END and the attack stat to get there, not EXP. `tests/grind.test.ts` holds every hostile zone to
this (§9).

**Regular-enemy EXP sets the pace, LoG2's pace.** LoG2's levelling is slow: measured with the fair bot on LoG2's own
zones (ROM stats and placements, LoG2's hero at that stage; the `tests/grind.test.ts` report), a level costs 0.29–1.56
minutes of clearing below L16, 0.68–1.34 at L16–29, 0.95–1.46 at L30–39 and 2.7–3.1 from L40, and a story gate costs
6.7–14.8 minutes and 70–86 kills. Give a zone's residents the EXP that makes a level cost that long for the hero who
walks in: EXP per minute = level span ÷ minutes per level, and a zone clears at about 4–6 s a kill, so a kill pays
roughly 1/12 to 1/25 of the level span at L16–39 and 1/40 from L40 (the ROM clamp keeps any kill between 1/128 and 1/2
of the span). A LoG2 port keeps its ROM EXP only where it lives at LoG2's level; met earlier, it is paced (the King
Crab is LoG2's L30 Alligator with 300 EXP, not 5,400, at the L12 oasis). The arena, Baba's lake and the post-game
regulars pay the same way. Boss EXP is scripted and untouched by this rule. The grind test holds each level range's
median stage to LoG2's band and each story gate to 5–15 fair-bot minutes (§9).

**Density.** A hostile zone holds about ten regular enemies in reach (LoG2: 12 a reference zone), spread over open
ground at least seven tiles from every way in (a creature that sees the hero arrive jumps them) and clear of the spots
where a story scene fights on that map (sparring rings, warp-in points, boss arenas), unless the scene clears the
wildlife first (`scatterWildlife`, `clearMooks`, `clearWild`) or a flag hides it (`fc_topQuiet`, `done:` of the scene's
quest). A scene that ends in `battle(s)` fights everything on the map. Prefer melee types when filling a zone: a
shooter or flyer adds far more damage per clear than its EXP is worth, and a clear may cost at most one Senzu.

Keep END < 124. Use `resMelee`/`resKi` (0.5 = half damage) for gimmicks (e.g. a ki-resistant shell).
`absorbKi: true` = melee-only boss (LoG2 Androids 19/20 — ki heals them; tell the player via dialogue).
Boss behaviour (`boss.phases`): each phase lists `moves` from `chase shot volley rain beam dash teleport summon
drain charge timeSkip nova guard`, `rest` ticks between moves (60 = relaxed, 30 = aggressive), optional `speed`,
and `until` (HP fraction where the next phase begins). `endAt` = scripted end fraction (0.5, 0.25…) or 0 to require
a kill. Also: `refillAt/refillTo` (Perfect Cell refill), `stamina` (Golden Frieza drain, e.g. 0.004/s),
`minion` + `summon`, `kiColor`, `vulnerableIf` (sealing puzzles: invulnerable until a flag is set), `ringOut`
(note: implement ring-outs in script by checking boss position if needed).

---

## 7. Art you can use

- **Cast** (`src/content/cast.ts`): goku gokuSSJ gokuSSG gokuSSB gokuUI gokuWhis vegeta vegetaSSJ vegetaSSB vegetaSSBE
  vegetaCasual gohan gohanSSJ gohanSuit gohanUltimate futureTrunks futureTrunksSSJ futureTrunksRage piccolo
  piccoloUnweighted mrSatan android17 android17Top frieza goldenFrieza bulma futureBulma chichi videl pan goten
  trunksKid krillin krillinGi android18 tien yamcha roshi chiaotzu majinBuu drBrief panchy dende mrPopo yajirobe jaco
  kingKai shenronAvatar pilaf mai shu futureMai resistance korin beerus whis champa vados supremeKai oldKai zeno
  grandPriest gowasu zamasu gokuBlack blackRose fusedZamasu vegitoBlue frizaSoldier frizaSoldierB frizaSoldierC
  frizaElite sorbet tagoma shisami ginyu cabba cabbaSSJ hit frost botamo monaka kale kaleLSSJ caulifla kefla jiren
  toppo dyspo prideTrooper basil lavender bergamo ribrianne gamisalas poacher babarian universeFighter townsman
  townswoman oldMan kidNpc police scientist farmer reporter waiter bandit banditChief.
  Add more with `registerCast({ c07_magetta: {...HumanoidSpec} }, { c07_magetta: 'Magetta' })` — see
  `src/art/humanoid.ts` for spec fields and `src/art/hair.ts` for hair styles. `?gallery` / `?portraits` (and
  `?creatures`) on the dev server preview all cast (dev-only, see §9).
- **Creatures** (`src/content/creatures.ts`): wolf timberWolf snowWolf direWolf sabertooth iceSabertooth bear greyBear
  boar tRex blueTRex blackTRex raptor redRaptor pterodactyl stormPtero hawk bat cave_bat fireBat snake viper sandSnake
  giantSnake pilafRobot mechTrooper redMech goldMech drone greenDrone goldDrone rescueDrone slime mudSlime voidSlime
  commeson beetle wasp hornet scarab crab kingCrab alienFish. Add with `registerCreatures` (kinds: quadruped dino flyer
  snake robot drone blob bug crab bat; sizes 24/32/40/48).
- **Shared bestiary ids** (`src/content/bestiary.ts`): wolf timberWolf snowWolf direWolf sabertooth iceSabertooth snake
  viper sandSnake giantSnake hawk pterodactyl stormPtero caveBat fireBat raptor redRaptor tRex blueTRex boar bear
  greyBear beetle hornet scarab crab kingCrab drone greenDrone goldDrone pilafRobot mechTrooper redMech goldMech
  slime mudSlime voidSlime bandit banditBrute soldier soldierB soldierC soldierElite.
- **Music ids** (`src/content/music.ts`). World maps: worldmap futureWorld space. Hubs: peaceful (homes) town (Satan
  City) westCity party lookout otherworld (King Kai, Hell, Baba, the Kais) training. Field regions: field (Earth
  countryside) desert wasteland snow islands future (Future Earth ruins) alien beerusPlanet cave. Story: title tense sad
  godly heroic frieza black jiren ending. Tournaments: tournament topArena. Fights: battle (waves, spars) boss (any boss
  without a theme) beerus goldenFrieza hit zamasu (Goku Black and Zamasu) finale (Tournament of Power climax).
  Jingles (play once): victory gameover. Give each map its region's theme (no track on more than 8 maps; see
  `tests/music.test.ts`), call `s.music('<boss theme>')` just before a headline boss fight, hand the map its track back
  with `s.music(s.field.def.music)` when the player stays on the map after a fight, and call `s.music(...)` after
  `s.warp(...)`, never before it: entering a map starts that map's own track. Credits: `await s.credits([...lines])`.
- **Items** (`src/content/items.ts`): senzu cookie fish str1/3/5 pow1/3/5 end1/3/5 delicacy whisStaff scouter
  dragonRadar db1–db7 trophyGoku trophyVegeta trophyGohan trophyTrunks trophyPiccolo. Add key items with
  `registerItems([...])` (prefix ids).

---

## 8. World layout (fixed ids — world builders create these; chapters overlay them)

World-map spots (`registerSpots`, 256×256 texture coords; land is roughly 40–216 on both axes):

| Spot id | Name | World | x,y | Lands on |
|---|---|---|---|---|
| spot_paozu | Mt. Paozu | earth | 96,92 | paozu_valley |
| spot_westcity | West City | earth | 150,118 | wc_streets |
| spot_satancity | Satan City | earth | 118,150 | satan_plaza |
| spot_kame | Kame House | earth | 200,172 | kame_island |
| spot_lookout | The Lookout | earth | 128,62 | korin_base |
| spot_wasteland | Rocky Wasteland | earth | 74,128 | waste_entry |
| spot_desert | Diablo Desert | earth | 92,192 | desert_entry |
| spot_snow | Snowy Highlands | earth | 150,42 | snow_entry |
| spot_monster | Monster Island | earth | 214,84 | (Ch13 owns) |
| spot_future_city | Future West City | future | 150,118 | future_city |
| spot_future_base | Resistance Hideout | future | 120,140 | future_hideout_out |
| spot_kingkai | King Kai's Planet | space | 70,70 | kingkai_planet |
| spot_beerus | Beerus's Planet | space | 128,120 | beerus_grounds |
| spot_nameless | Nameless Planet | space | 190,80 | (Ch7 owns) |
| spot_u10 | Sacred World (U10) | space | 80,186 | u10_sacred |
| spot_zeno | Zeno's Palace | space | 188,186 | zeno_palace |
| spot_space_earth | Earth | space | 128,200 | toWorld earth |

Hub maps (region in parentheses):
- **Mt. Paozu** (world builder A): `paozu_valley` (entry: world sign + save, Gohan & Videl's house exterior, road),
  `paozu_home` (Son house exterior, radish field, river, Goten's training stump), `paozu_house` (interior),
  `gohan_house` (interior), `paozu_forest` (hostile: wolves/snakes/hawks, river, caves), `paozu_peaks` (hostile cliffs,
  waterfall, flight circle to a plateau, gates).
- **Satan City** (A): `satan_plaza` (downtown, statue of Mr. Satan, shops, hotel, TV studio "ZTV" exterior with a
  Mr. Satan L50 gate spot reserved), `satan_mansion` (garden), `satan_mansion_in` (interior), `satan_shop` (interior),
  `satan_dojo` (interior sparring arena).
- **Kame House** (A): `kame_island` (+ boat dock), `kame_house_in`.
- **The Lookout** (A): `korin_base` (Korin Forest at the tower's foot, world sign), `korin_tower` (Korin's room, top of
  the tower; flight circle up to the lookout), `lookout` (Kami's Lookout platform: palace, garden, the Room of Spirit
  and Time door, flight circle down), `lookout_palace_in`.
- **West City** (B): `wc_streets` (city blocks, ramen shop, park, electronics store, police box), `wc_shops` (interior
  row: restaurant/ramen counter), `cc_yard` (Capsule Corp grounds — big `capsuleCorp` prop, lawn for parties, garage,
  pool), `cc_inside` (lobby, lab, kitchen, Bulma's computer room with the Scouter database), `cc_gravity` (gravity room).
- **Rocky Wasteland** (B): `waste_entry`, `waste_canyon`, `waste_mesa` (hostile; big open battlefields — Resurrection 'F'
  happens here).
- **Diablo Desert** (B): `desert_entry`, `desert_oasis`, `pilaf_castle_out`, `pilaf_castle_in` (hostile bandits/robots).
- **Snowy Highlands** (B): `snow_entry`, `snow_peak` (late-game grinding: snowWolf, iceSabertooth, blueTRex dino park
  behind a Goku L40 gate; trophy gates live here).
- **Future Earth** (C): `future_city` (ruined West City, hostile), `future_highway` (hostile), `future_hideout_out`,
  `future_hideout_in` (Resistance base, Future Bulma's lab with the time machine), `future_cc_ruins`.
- **Space** (C): `kingkai_planet` (tiny planet, Bubbles, Gregory, King Kai's house, the road), `beerus_grounds` (Beerus's
  planet: alien trees, pyramid palace exterior, lake), `beerus_palace_in`, `u10_sacred` (Gowasu's garden world:
  marble, alienGrass, pillars, tea table), `zeno_palace` (marble halls floating in void, throne), `top_arena_a`,
  `top_arena_b`, `top_arena_c` (Tournament of Power stage: arena tiles, void edges, pillars/rubble; connect a→b→c),
  `hell_lake` (Hell: hellRock, lava, Frieza's cocoon prop spot).

World builders must include: varied terrain, paths, landmarks, 2–6 breakable rocks per hostile map, a save point
and world sign per region entry, flight circles where cliffs separate areas, placeholder-free generic townsfolk
(with real dialogue about everyday life in the DBS world — Satan City loves Mr. Satan, West City talks about Capsule
Corp), shops as flavour, and **the 25 Earth Delicacies**: A places 9 (Paozu 3, Satan City 3, Kame 1, Lookout 2),
B places 9 (West City 3, Wasteland 2, Desert 2, Snow 2), C places 7 (Future 2, Beerus planet 2, King Kai 1, U10 1,
Zeno 1). Use `pickups: [{ id: 'del_<map>_<n>', item: 'delicacy', x, y }]` — some visible, some `hidden: true`
(examined with A, LoG2 style), some inside chests or behind gates. Also place a few stat capsules (`str1`, `pow1`…)
in chests/behind gates per region.

Ambient townsfolk talk scripts should vary by chapter where cheap (e.g. `s.check('chapter>=5')` → talk about the
Frieza attack). World builders own ambient NPCs; chapter agents own story NPCs via overlays.

---

## 9. Testing your content

1. `npx tsc --noEmit` and `npx vitest run` must pass.
2. Add `tests/chapters/<prefix>.test.ts` that drives your main path headlessly with `Sim` (`tests/sim.ts`):
   ```ts
   const sim = new Sim();
   sim.game.state.data.chapter = 3; sim.game.state.join('goku', 12); sim.game.state.data.active = 'goku';
   sim.start('cc_yard', 10, 12);
   expect(await sim.run('c03_start')).toBe(true);
   expect(sim.errors).toEqual([]);
   expect(sim.game.state.flag('c03_radarGiven')).toBe(true);
   ```
   Chain the chapter's gold-quest beats in order (simulate the player reaching each trigger by running the
   trigger/talk script directly with `sim.start(map)` + `sim.run(id)`), asserting the flags/quests/joins at each step,
   ending with the next chapter's start. This proves the chapter is completable.
3. Browser check (optional): `npm run dev`, then `http://127.0.0.1:5173/?map=<id>&x=<tile>&y=<tile>&char=goku&lv=12&chapter=3`.
   **Developer content is dev-only.** The `?map=` entry (and `?nointro`), the art viewers (`?creatures`,
   `?portraits`, `?gallery=<filter>`), the console harness (`window.__game`, `__t`) and everything in
   `src/content/dev/` (the Test Meadow and Test Arena maps, the sparring robot, their world-map spots and the
   `dev_q1` journal entry) exist only where `import.meta.env.DEV` is true: `npm run dev` and vitest. A production
   build (`npm run build`) folds the flag to false and drops all of it, so none of it reaches a player's journal,
   world map or URL bar. Dev modules export their data and a `register…` function and are registered only from
   `src/content/dev/index.ts` under that flag; keep new debug content there, never as a side effect of another
   import. `tests/content.test.ts` (developer content block) reloads the content with the flag off and checks the
   registries and journal are exactly the dev ones minus the dev content.
4. Fair-play balance (`tests/balance.test.ts`, part of the default suite, about 45-65 s; `npm run test:balance`
   runs it together with the grind sweep of point 5). A
   fair bot (`tests/fairbot.ts`) plays fights with real input only: it takes real damage, eats Senzu through the
   pause menu, transforms and fires techniques, and hunts down free-roam waves by walking distance. The file checks:
   - the harness itself (LoG2 reference bosses, the Senzu menu, record and replay, per-fight caps);
   - per-act `tuned fights` blocks: each tuned beat replayed on its real map from a save holding the recorded party;
   - `every story fight`: every script in the committed recording `tests/fixtures/story_fights.json`, replayed on
     seeds 1-3 (1-8 for a fight that needs a second look). The bands and exemptions are listed in the block's header
     comment: at least 2 of 3 wins (6 of 8), at most 2 Senzu, boss hits ratio at most 6 (9 in the Chapter 14
     finale) and at least 1 for major bosses. Scripted losses, `survive` fights and the post-game superbosses are
     exempt or judged against LoG2's Cooler.

   When you change a fight, its band can move: run the file. When you add, move or remove a story fight, re-record
   the fixture (command in the block's header comment); a fight the replay no longer reaches fails as "not reached".
   Every replay is deterministic (fixed seeds, no wall clock), and a fight still unresolved 7 minutes of play after it
   began is closed as a timeout loss (`capped`), so a stuck fight fails fast and never hangs the suite.

   The full report (5 seeds per fight, level sensitivity for too-hard fights, JSON with a verdict per fight) runs on
   request from a fresh recording:
   ```
   LOS_RECORD_FIGHTS=/tmp/fights.json npx vitest run tests/full_game.test.ts
   LOS_FIGHTS=/tmp/fights.json LOS_BALANCE_OUT=/tmp/balance_report.json npx vitest run tests/balance.test.ts
   ```
   `LOS_ONLY=<enemy type or script id>` narrows it to one fight, `LOS_SEEDS=<n>` changes the seed count, and
   `LOS_REPLAY_TRACE=<file>` writes one JSON line per replay (compare two runs to check determinism).

   A recording rolls its own level-ups (the full-game run is not seeded), so a fresh one moves every hero's stats by a
   point or two: re-run this file and `tests/grind.test.ts` on it before committing it, and keep only the story run
   (the `node -e` filter in the `every story fight` header).
5. Grind zones and story gates (`tests/grind.test.ts`, part of the default suite, about 45 s). LoG2's core loop is
   walking into a hostile zone and fighting its regular enemies for EXP; `clearZone` (`tests/fairbot.ts`) has the fair
   bot do exactly that, sealed in, through real input and real damage both ways, from the save a player has when the
   zone opens (taken from the committed recording). The file checks:
   - the sweep: every hostile map with spawns, at each stage its spawn mixes open (`ZONE_STAGES`; a new hostile map
     without a stage fails), cleared on seeds 1-3 and held to one rule (`RULE`, means over the seeds): no knock-out,
     at most 1 Senzu a clear; median hits to kill at most 10 and hits to KO at least 12 over the zone's types, and not
     a walkover (under 3 to kill with over 40 to KO); every type at most 10 hits to kill and at least 12 to KO (9 for
     a hero of L11 or below, as LoG2's early zones); the regular enemies in reach exactly the stage's `spawns`; two of
     three seeds cleared, never more than 2 enemies left; and at most 5 minutes of clearing per level at the arrival
     level (LoG2's slowest zone takes 3.4). Documented exemptions: a stage's `heavy` types, its one big-bodied enemy
     (the dire wolf, Pilaf's pond King Crab, the red Destroyer, the Universe 4 roamer), each named after the LoG2 enemy
     that stands behind it and held to LoG2's own extremes (25 hits to kill, 4 to KO);
   - the story gates (`STORY_GATES`): each ground from its `arrive` level to its gate level in its own zones, visit
     after visit with HP, EXP and Senzu carried over (20 s per return to a zone), on seeds 1-3. It must cost 5-15
     minutes of fair-bot play (LoG2's own gates cost this bot 6.6-15.2), at most one knock-out on average (LoG2's
     Trunks 30 gate costs this bot 0.33-0.67, its Goku 40 gate about seven) and at most 1 Senzu per visit;
   - the pace (`PACE_BANDS`): the median minutes per level of the swept stages in each level range (L1-15 from
     Chapter 3 on, L16-29, L30-39, L40-50) lies in LoG2's band for that range, 15% either way for seed noise (the
     tutorial's zones, Prologue to Chapter 2, level faster on purpose: Chapters 1-2's story fights are tuned at the
     levels they give);
   - the harness itself: mob attack stats, the LoG2 reference zones against the ROM tables, map entries, knock-out
     counting, goal stops and save chaining.

   When you add or retune a hostile zone, add or update its stage (the failure message prints the enemies in reach
   and every rule it breaks). The report (`LOS_ZONE_REPORT=<file>`, command in the file header) adds LoG2's own zones
   and gates as the reference, per-type numbers and minutes per level; `LOS_ZONE_ONLY=<map>` narrows it and
   `LOS_GRIND_SEEDS=1,2,3,4,5,6,7,8` widens the seeds (worth doing before calling a 3-seed failure real).

## 10. Final report

List: files created, maps (ids + one-line description), scripts, quests, bosses, any engine requests, anything you
couldn't finish. Do not describe the story back — just what exists and how to verify it.

## 11. LoG2-parity notes (deliberate deviations)

Rules where the game knowingly departs from LoG2 (`../research/log2_mechanics.md`) and a reader checking parity
could take the difference for a bug. Each entry names the LoG2 rule, what this game does instead and why; add one
when you knowingly depart from a LoG2 rule. Differences of scale (more chapters, maps, forms and techniques for
the longer DBS story) are covered in §5 and §6 and in `CHAPTERS.md`, not here.

- **Mr. Satan joins alongside Goku instead of replacing him** (LoG2 §16: all five trophies unlock Hercule, who
  *takes Goku's slot*). LoG2's swap follows its story: Goku dies at the Cell Games, so the post-game has no Goku and
  Hercule fills the empty slot. Dragon Ball Super ends with Goku alive (Universe 7 wins the Tournament of Power in
  ep 131 and he goes home with the others), and the post-game opens as him (`post_start` switches to Goku), so
  removing him would contradict the story the game tells and take its lead away from the player. Mr. Satan is
  therefore a sixth roster member (`MAIN_ROSTER` in `src/content/characters.ts`), switched in at save points like
  everyone else. Two LoG2 rules shift with it:
  - Goku's trophy comes from his own L50 gate (`g50_goku` in `snow_peak`) like the other four, where LoG2 gave it
    automatically for beating Cell (Goku left the party there).
  - The join level keeps LoG2's rule (L40 if Goku was strong enough at the final battle, else L1) but reads Goku's
    level when Universe 7 won (`c14_gokuLv` against `SATAN_RULE_GOKU_LEVEL` = 48 in `chapters/act5/post.ts`; that
    file explains why 48 matches LoG2's "L45 at Cell").
  Everything else is LoG2's Hercule: Hercule's base stats and halved stat gains (`satan` in `characters.ts`), the
  Victory Pose camera-flash stun as his only ki technique (6 EP), per-hero NPC reactions (mockery as in LoG2, mixed
  with the fan worship DBS's World Champion gets; the Z Fighters needle him), and the red L50 gate only he can
  break (`ztv_gate` in `satan_plaza`), which opens the ZTV press-conference alternate ending (`post_ztv_ending`).
