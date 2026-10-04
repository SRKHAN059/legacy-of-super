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
- `src/content/dev/sandbox.ts` — a small working example of maps + scripts + a boss.

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
- **Enemies respawn** every time a map is entered (unless they have an `id`, which makes them one-off).
- **Drops** (food = HP, ki orbs = EP) are automatic (ROM drop table). Breakable rocks/jars/crates give drops too.
  A breakable with an `id` and a fixed `item` keeps that item where it fell until it is picked up (leaving the map
  never loses it).
- **Level cap 50, stats cap 100.** EXP per regular kill is clamped by the engine to [1/128, 1/2] of the
  player's current level span, so enemy `exp` only needs to be in the right ballpark for its tier (§6).
  Boss `exp` is paid in full (scripted reward).
- **Party**: Goku, Vegeta, Gohan, Trunks, Piccolo (+ secret Mr. Satan). Characters join at fixed story points
  with LoG2-style rolled stats. The story often forces a character (`force(s, id)` = switchTo + `noSwitch` flag).
  Levels come from EXP: a chapter hand-over lifts only the hero who played the last chapter to the new band start,
  never the bench (see `docs/CHAPTERS.md` Party timeline); `force()` lifts a benched character to band start − 3
  so a forced segment is never a wall.
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
maps out using these exits, so keep them geometrically consistent.

**Coordinates**: everything is in tiles. NPC/enemy `x,y` = the tile they stand on.

**Overlays.** Hub maps are built once by world builders. Chapters add their NPCs/enemies/triggers with
`registerOverlay('cc_yard', { npcs: [...], triggers: [...], onEnter: 'c05_cc_enter' })`. Arrays are appended;
`onEnter` scripts accumulate (each must self-gate). **Gate every overlay element with `showIf`/`hideIf`**
(e.g. `showIf: 'chapter==5'`, `hideIf: 'c05_done'`).

**Conditions** (`showIf`/`hideIf`/`openIf`/`s.check()`): `flag`, `!flag`, `a&b`, `chapter>=3` (`>= <= == > <`),
`has:item`, `char:vegeta` (active character), `quest:id` (active), `done:id` (finished).

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

**Hero level curve** (cap 50): Prologue Trunks 6 · Ch1 1–8 · Ch2 8–12 · Ch3 12–15 · Ch4 15–18 · Ch5 18–22 ·
Ch6 22–25 · Ch7 25–29 · Ch8 29–31 · Ch9 30–34 · Ch10 34–37 · Ch11 37–40 · Ch12 40–42 · Ch13 42–45 · Ch14 45–48 · Post 48–50.

---

## 6. Stats and balance

Damage uses the exact LoG2 ROM formula (cubic in STR/POW, END subtracts proportionally — see
`src/game/leveling.ts`). Design enemies by tier using the shared bestiary (`src/content/bestiary.ts`) as reference:

| Tier | Hero lv | HP | STR/POW | END | exp |
|---|---|---|---|---|---|
| T1 | 1–5 | 35–70 | 6–8 | 3–5 | 15–45 |
| T2 | 6–12 | 150–300 | 12–18 | 8–14 | 150–600 |
| T3 | 13–20 | 400–700 | 20–28 | 15–22 | 800–3000 |
| T4 | 21–28 | 800–1200 | 28–36 | 22–30 | 3000–6000 |
| T5 | 29–36 | 1400–2200 | 36–46 | 30–40 | 9000–20000 |
| T6 | 37–44 | 2500–4000 | 46–58 | 40–50 | 25000–45000 |
| T7 | 45–50 | 4500–6500 | 58–70 | 50–62 | 50000–90000 |

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
  `src/art/humanoid.ts` for spec fields and `src/art/hair.ts` for hair styles. `?gallery` / `?portraits` in the
  browser preview all cast.
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
  `tests/music.test.ts`), call `s.music('<boss theme>')` just before a headline boss fight, and call `s.music(...)`
  after `s.warp(...)`, never before it: entering a map starts that map's own track. Credits: `await s.credits([...lines])`.
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

## 10. Final report

List: files created, maps (ids + one-line description), scripts, quests, bosses, any engine requests, anything you
couldn't finish. Do not describe the story back — just what exists and how to verify it.
