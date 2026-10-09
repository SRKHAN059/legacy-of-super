# Legacy of Super

A pixel action-RPG that plays like **Dragon Ball Z: The Legacy of Goku II** (GBA, 2003) but tells the
**Dragon Ball Super** story, from the Battle of Gods through the end of the Tournament of Power. It runs in
the browser at the GBA's 240×160 resolution.

> Personal, non-commercial fan project, made as a model-evaluation exercise. **Not for distribution.**
> The character sprites come from the original game's sheets (see [Credits](#credits)).

## About the game

Legacy of Super is a top-down action-RPG built to play exactly like *The Legacy of Goku II*. Its mechanics were
rebuilt from the original game, including the experience table, stat growth and damage formulas taken from the
cartridge. The story it tells is Dragon Ball Super's.

**How it plays**
- **Real-time combat** in hostile zones: a 3-hit melee combo, charged melee specials, and ki techniques (blasts,
  beams, spreads, stuns) that cost EP. Enemies drop healing items.
- **Transformations** on a charging gauge: Super Saiyan, Super Saiyan God, Super Saiyan Blue, Blue Kaio-ken, Super
  Saiyan Rage, Ultimate Gohan, Golden Frieza, Ultra Instinct and more.
- **Experience and levels to 50**, with LoG2's stat growth. Each character grows differently.
- **A rotating party.** Switch characters at save points. Coloured, numbered level gates only open for one
  character at a set level, so you level the whole team, as in LoG2.
- **Story told LoG2's way:** in-engine cutscenes, portrait dialogue boxes, a narrator, a Journal of gold, silver
  and bronze objectives, and chapter title cards.
- **Exploration:** a Mode-7 world map you fly over across Earth, Future Earth and space; flight circles; region
  maps; hidden items; breakable rocks; Dragon Ball hunts with the Radar.
- **Scouter:** scan characters and enemies to read their stats and lore, and fill the database.

**Playable characters**
- **Main five:** Goku, Vegeta, Gohan, Piccolo and Future Trunks.
- **Guests in the Tournament of Power:** Android 17 and Frieza.
- **Story-only characters:** some episodes put you in the shoes of Cabba, Majin Buu, Master Roshi, Tien and
  Vegito.
- **Secret character:** Mr. Satan, unlocked in the post-game.

**By the numbers**
- A Prologue plus 14 chapters, an epilogue and a post-game.
- About 90 maps in about 28 regions.
- Over 90 boss fights.
- 130+ enemy types.
- 90+ Journal entries.
- 39 original chiptune tracks.

**Side content**
- 25 Earth Delicacies for Whis.
- 7 escaped Monster Island animals.
- The Dragon Balls.
- A Scouter database of nearly 200 entries.
- A sparring dojo.
- Five character trophies behind level-50 gates.
- Post-game superbosses and an alternate ending.

## The story

The story runs from the peace after Majin Buu to the end of the Tournament of Power: anime episodes 1–131, plus
the films *Battle of Gods* and *Resurrection 'F'*, which the anime retells. It is split into five acts. Each
chapter opens with a title card, has its own gold-star objectives, and hands the next chapter the party it needs.

| Act | Chapter | Story (approx. episodes) | Who you play |
|---|---|---|---|
| **1** | Prologue: *A Future Without Hope* | Future Trunks's ruined timeline. Goku Black attacks and Trunks escapes in the time machine (a flash-forward to ep 47) | Future Trunks |
| | 1: *A Peaceful World* | Life after Buu: farming with Chi-Chi, Goten and Gohan's family, Mr. Satan's reward. Beerus wakes and beats Goku at King Kai's (eps 1–5) | Goku |
| | 2: *The Destroyer's Feast* | Bulma's birthday party. Vegeta keeps Beerus happy, the Pilaf Gang crashes it, and the pudding disaster (eps 5–9) | Vegeta |
| **2** | 3: *Battle of Gods* | Dragon Ball hunt with the Radar, the Super Saiyan God ritual, Goku vs. Beerus (eps 9–15) | Goku, Vegeta |
| | 4: *Student of the Angel* | Training with Whis on Beerus's planet. Frieza is revived in Hell (eps 16–19) | Vegeta, Goku |
| | 5: *Resurrection 'F'* | Frieza's 1,000 soldiers, Tagoma and Ginyu, Gohan and Piccolo hold the line (eps 20–23) | Gohan, Piccolo |
| **3** | 6: *Golden Frieza* | Super Saiyan Blue, Golden Frieza, Earth destroyed and time rewound (eps 24–27) | Goku, Vegeta |
| | 7: *Tournament of Destroyers* | Universe 6 vs. 7 on the Nameless Planet: Botamo, Frost, Magetta, Cabba, Hit (eps 28–41) | Goku, Vegeta, Piccolo |
| | 8: *The Copy* | "Monaka", then the Galactic Patrol job on Potaufeu and Copy-Vegeta (eps 42–46) | Goku, Vegeta |
| **4** | 9: *SOS from the Future* | Trunks returns, Goku Black appears, the trip to the future (eps 47–52) | Future Trunks, Goku |
| | 10: *Gods of Universe 10* | Zamasu, Gowasu, the Zeno Button, Goku Black Rosé (eps 53–60) | Goku, Vegeta |
| | 11: *Project Zero Mortals* | Super Saiyan Rage, the Mafuba, Fused Zamasu, Vegito Blue, the Sword of Hope (eps 61–67) | Future Trunks, Goku, Vegeta |
| **5** | 12: *Days of Peace* | An episode hub; play at least 2 of 6: Hit's contract, Pan's first flight, Great Saiyaman, Krillin's comeback, *Whose Wish?* (Earth's core) and the baseball game (eps 68–76) | Goku, Gohan and others |
| | 13: *Universe Survival* | The Zeno Expo (Buu vs. Basil, Gohan vs. Lavender, Goku vs. Bergamo, Goku vs. Toppo), recruiting the Universe 7 team, and Universe 6's Saiyans Caulifla and Kale (eps 77–96) | Goku, Gohan, Vegeta, Cabba, Buu |
| | 14: *The Tournament of Power* | Three rings of relay battles: Pride Troopers, the Kamikaze Fireballs, Kefla, Dyspo, Toppo the Destroyer, and Ultra Instinct against Jiren (eps 97–131) | Goku, Vegeta, Gohan, Android 17, Frieza and others |
| | Epilogue and post-game | The wish, the credits, then free roam: trophies, Mr. Satan, superbosses, the alternate "ZTV" ending | Everyone |

The chapters follow Legacy of Goku II's rhythm:
- a tutorial prologue
- open hub chapters with side quests
- forced-character relays at story peaks
- a final gauntlet in the Cell Games' place, here the Tournament of Power

See [docs/CHAPTERS.md](docs/CHAPTERS.md) for the full beat-by-beat plan.

## Quick start

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev
```

Then open **http://localhost:5173** in a desktop or mobile browser. Click the game once so it gets
keyboard focus and sound.

To play an optimised build instead:

```bash
npm run build
npm run preview
```

Then open **http://localhost:4173**.

## Controls

The game uses the GBA's buttons. Each one has two or three keys, so you can play with the arrows or with WASD.

| GBA button | Keys | On foot | In menus and dialogue |
|---|---|---|---|
| D-pad | Arrow keys / W A S D | Move. Double-tap and hold a direction to **run** | Move the cursor |
| **A** | Z / J / Space | Talk, open, pick up, read signs. In fighting zones: **3-hit combo** (tap A three times). **Hold A** for a charged melee special once Roshi or Trunks has taught one | Confirm, advance text (hold to fast-forward) |
| **B** | X / K | Use the selected **technique** (ki blast, beam, etc.). Hold B on chargeable techniques to power them up | Cancel / back |
| **L** | Q / U | Cycle techniques. The cycle includes **Z** (transform) once a form is unlocked | Pause menu: next page. Dialogue: move the text box to the top |
| **R** | E / I | Open the **region map** (needs the Scouter) | Pause menu: previous page. Dialogue: move the text box to the bottom |
| **Start** | Enter | Pause menu | Close the pause menu |
| **Select** | Shift / Backspace | **Scouter scan**: look up the nearest character or enemy (needs the Scouter) | |

### Touch screens

On a phone or tablet, an on-screen D-pad (with diagonals) and A / B / L / R / Start / Select buttons
appear beside the screen in landscape and below it in portrait.

### Beam struggles

When two beams meet, **mash A or B** to push yours through.

## How to play

**Starting.** On the title screen, choose one of the **3 save files**. An empty file starts a New Game.
Saves are kept in your browser.

**Story and journal.** Follow the **gold-star** objectives in the Journal (pause menu). Silver and bronze stars
are side quests. Characters with something to say are worth talking to: that's how the story moves forward.

**Fighting zones.** Combat only happens in hostile areas, shown by a red scouter icon in the top-right of
the screen. In towns and indoors, A talks and B does nothing.
- **A**: punch combo. The third hit knocks enemies back. On Tournament of Power stages, knock enemies off the
  edge for a **ring-out**.
- **B**: your selected technique. It costs **EP** (the green bar). Press **L** to switch techniques.
- **Transform**: press **L** until **Z** is selected. When the triangle gauge is full, press **B** to power up
  (Super Saiyan, God, Blue, and so on). Forms drain EP and getting hit interrupts the gauge. Press **B** again on
  Z to power down.
- Defeated enemies give **EXP** and can drop healing items.

**Levelling and coloured gates.** Coloured barriers with a number can only be smashed by the character of that
colour at or above that level. Switch characters at a **save point** (the blue disc), then grind in a nearby
zone. This rotate-and-level loop is how Legacy of Goku II plays.

**Getting around.**
- **Signs** marked with the world icon take you to the **world map**.
  - Steer with **left/right**, fly forward with **up**, reverse with **down**.
  - Press **A** over a landing spot to land. **Start** pauses.
- **Yellow flight circles** carry you between points within a region.
- **R** shows the region map (explored areas, gates, save points, and Dragon Balls once you have the Radar).

**Items.** Use healing items and **Senzu Beans** from the pause menu's **Items** page. Senzu Beans restore
everything.

**Side content.**
- 25 hidden **Delicacies**.
- The escaped animals of Chapter 13.
- The Dragon Balls.
- Character trophies behind level-50 gates.
- The full **Scouter database**: scan everyone with Select, then browse your scans on the terminal at Capsule Corp.
- Post-game superbosses and a secret character.

## Saves

- Three save slots are stored in your browser's local storage. Clearing site data erases them.
- To keep a save safe or move it to another device, use **Export** on the title screen's file menu. That gives
  you a save code. Paste the code into **Import** on the other device.
- Options (text speed, volume) are saved separately and apply to every file.

## For developers

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload at http://localhost:5173 |
| `npm run build` | Type-check and build to `dist/` |
| `npm test` | Full test suite, including a bot that plays the whole game on one save |
| `npm run test:balance` | Fair-play balance check over every story fight |
| `npm run typecheck` | TypeScript only |
| `npm run sprites` | Rebuild `src/art/sheets.gen.ts` from the sheets in `assets/sprites/` and the specs in `tools/sprites/specs/` |
| `npm run sprites:preview -- <castId> --out <dir>` | Render a character's frames to PNG |

The dev server also accepts URL parameters (dev builds only):
- `?map=<id>&char=<id>&lv=<n>&chapter=<n>` jumps straight to a map.
- `?gallery` or `?gallery=sheet` shows the sprite gallery.

Project docs:
- [docs/CONTENT_GUIDE.md](docs/CONTENT_GUIDE.md): how content, maps, scripts and sprites are built.
- [docs/CHAPTERS.md](docs/CHAPTERS.md): the chapter-by-chapter story plan.

## Credits

- *Dragon Ball* and *Dragon Ball Super*: Akira Toriyama, Toei Animation, Shueisha, Bandai Namco.
- *Dragon Ball Z: The Legacy of Goku II*: Webfoot Technologies / Atari. This project recreates its mechanics.
- Character sprite sheets: ripped from *The Legacy of Goku II* by **SpYn** (The Spriters Resource). They are used
  here for personal play only.
- Everything else is original to this project: code, maps, music, story scripts, and the remaining art.
