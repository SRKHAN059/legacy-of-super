# Legacy of Super

A pixel action-RPG that plays like **Dragon Ball Z: The Legacy of Goku II** (GBA, 2003) but tells the
**Dragon Ball Super** story, from the Battle of Gods through the end of the Tournament of Power. It runs in
the browser at the GBA's 240×160 resolution.

> Personal, non-commercial fan project, made as a model-evaluation exercise. **Not for distribution.**
> The character sprites come from the original game's sheets (see [Credits](#credits)).

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
