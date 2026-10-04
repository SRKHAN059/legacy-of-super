import { CHARACTERS, type CharId } from '../content/characters';
import { ITEMS } from '../content/items';
import { TRACKS } from '../content/music';
import { MAPS, resolveMap } from '../content/registry';
import { SPOTS, worldOfMap, type WorldId } from '../content/world';
import { audio } from '../engine/audio';
import { TILE } from '../engine/constants';
import type { Input } from '../engine/input';
import type { Dir } from '../engine/math';
import { SceneStack } from '../engine/scene';
import { ChoiceScene, DialogueScene, textSettings, type Line } from '../ui/dialogue';
import { GameOverScene } from '../ui/gameover';
import { PauseMenu } from '../ui/pause';
import { RegionMapScene } from '../ui/regionmap';
import { SaveMenu } from '../ui/savemenu';
import { ScouterScene } from '../ui/scouter';
import { ScouterDbScene } from '../ui/scouterdb';
import { BeamStruggleScene, type StruggleOpts } from '../ui/beamstruggle';
import { CreditsScene } from '../ui/credits';
import { TitleCardScene } from '../ui/titlecard';
import { TitleScene } from '../ui/title';
import { WorldMapScene } from '../ui/worldmap';
import { Field } from './field';
import { FightAbandoned, ScriptApi, SCRIPTS, type ScriptCtx } from './script';
import { GameState, newGame, SaveService, type Options, type SaveData } from './state';
import { BrowserStorage } from './storage';

/** Top-level coordinator: owns state, scenes, transitions, saving and the script runner. */
export class Game {
  readonly scenes = new SceneStack();
  readonly saves = new SaveService(new BrowserStorage());
  state: GameState = new GameState(newGame());
  slot = 0;
  field: Field | null = null;
  /** Cutscene depth: >0 locks player input. */
  lockDepth = 0;
  /** Set by scripts to hand control back during fights. */
  allowControl = false;
  /**
   * >0 while a scripted fight (fight / clearEnemies) is running. The field is sealed: warps, map edges,
   * save discs, world signs, flight circles and Whis's Charm are unavailable so the script can't be stranded.
   */
  fightDepth = 0;
  hideHud = false;
  /** Hook to intercept player KO (scripted losses). Return true to cancel Game Over. */
  onPlayerDown: (() => boolean) | null = null;
  /** The map transition (fade out, switch, fade in) in progress, if any. */
  private transition: Promise<void> | null = null;
  /** The Game Over sequence is running: no more map changes until the player continues or quits. */
  private gameOverActive = false;
  /** This run has a save to go back to (continued from one, or saved since New Game). */
  runSaved = false;

  constructor(readonly input: Input) {
    // Options are remembered across sessions (and shown on the title screen) independently of save slots.
    const o = this.saves.loadOptions();
    if (o) Object.assign(this.state.data, o);
    this.applySettings();
  }

  /** True while a door, map edge or story warp is fading between maps (Field locks the player meanwhile). */
  get inTransition(): boolean {
    return this.transition !== null;
  }

  /** Push the current state's options (text speed, music and SFX volume) into the live engine. */
  applySettings(d: SaveData = this.state.data): void {
    textSettings.speed = d.textSpeed;
    audio.musicVolume = d.musicVol;
    audio.sfxVolume = d.sfxVol;
  }

  /** Options changed in a menu: apply them now and remember them for the next session's title screen. */
  optionsChanged(): void {
    this.applySettings();
    const d = this.state.data;
    const o: Options = { textSpeed: d.textSpeed, musicVol: d.musicVol, sfxVol: d.sfxVol };
    this.saves.saveOptions(o);
  }

  /** Forget the running session (locks, fights, overlays) before a title / load / new game. */
  private resetSession(): void {
    this.field = null;
    this.lockDepth = 0;
    this.fightDepth = 0;
    this.allowControl = false;
    this.hideHud = false;
    this.onPlayerDown = null;
    this.gameOverActive = false;
  }

  /** Show the title screen. */
  toTitle(): void {
    this.resetSession();
    this.scenes.replace(new TitleScene(this));
    this.playMusic('title');
  }

  /** Begin a new game in a save slot. Options chosen on the title screen carry over. */
  async startNewGame(slot: number): Promise<void> {
    const prev = this.state.data;
    this.resetSession();
    this.slot = slot;
    this.runSaved = false;
    this.state = new GameState(newGame());
    Object.assign(this.state.data, { textSpeed: prev.textSpeed, musicVol: prev.musicVol, sfxVol: prev.sfxVol });
    this.applySettings();
    const boot = SCRIPTS.newGame;
    if (!boot) throw new Error('Missing "newGame" script');
    await this.runScript('newGame');
  }

  /** Continue from a save slot. Returns false when the slot is empty or unreadable. */
  continueGame(slot: number): boolean {
    const d = this.saves.load(slot);
    if (!d) return false;
    this.resetSession();
    this.slot = slot;
    this.runSaved = true;
    // Options are global: the last values chosen (title or pause menu) apply to every file; the copy inside
    // the save is the fallback when none were stored.
    const o = this.saves.loadOptions();
    if (o) Object.assign(d, o);
    this.state = new GameState(d);
    this.applySettings(d);
    const at = this.resumePoint(d);
    this.startField(at.map, at.tx, at.ty, at.dir);
    return true;
  }

  /**
   * Where a loaded save resumes. A save whose map no longer exists (renamed or removed in an update) lands on
   * an unlocked world-map spot of its world instead of failing to load.
   */
  private resumePoint(d: SaveData): { map: string; tx: number; ty: number; dir: Dir } {
    if (resolveMap(d.map)) return { map: d.map, tx: d.x / TILE - 0.5, ty: d.y / TILE - 0.875, dir: d.dir };
    console.warn(`[save] map "${d.map}" no longer exists; resuming at a landing spot`);
    const world = (this.state.get('world') as WorldId | undefined) ?? 'earth';
    const spots = Object.values(SPOTS).filter((s) => !s.toWorld && resolveMap(s.map));
    const spot = spots.find((s) => s.world === world && d.regions.includes(s.id))
      ?? spots.find((s) => d.regions.includes(s.id)) ?? spots[0];
    if (!spot) throw new Error(`Save map "${d.map}" is unknown and no landing spot exists`);
    this.state.set('world', spot.world);
    return { map: spot.map, tx: spot.tx, ty: spot.ty, dir: 'down' };
  }

  /** Create a field for a map at a tile position and make it the base scene. */
  startField(mapId: string, tx: number, ty: number, dir: Dir): Field {
    const def = resolveMap(mapId);
    if (!def) throw new Error(`Unknown map "${mapId}"`);
    const old = this.field;
    const prev = old?.player;
    const f = new Field(this, def, tx * TILE + 8, ty * TILE + 14, dir);
    if (prev && prev.cs.id === f.player.cs.id) {
      f.player.formActive = prev.formActive;
      f.player.zGauge = prev.zGauge;
      f.player.refreshSprite();
    }
    this.field = f;
    // A scripted fight still waiting on the old map can never finish there: abandon it (see ScriptApi.fight).
    if (old && old !== f) old.abandon();
    this.state.data.map = mapId;
    // Story warps can cross worlds (Earth, Future Earth, space): keep the world map a sign opens in step.
    const world = worldOfMap(mapId);
    if (world) this.state.set('world', world);
    this.scenes.replace(f);
    this.playMusic(def.music);
    const prevName = this.state.get('_lastArea');
    if (prevName !== def.name) { f.showBanner(def.name); this.state.set('_lastArea', def.name); }
    void this.runEnterScripts(def.onEnter);
    return f;
  }

  private async runEnterScripts(e: string | string[] | undefined): Promise<void> {
    const list = Array.isArray(e) ? e : e ? [e] : [];
    for (const id of list) await this.runScript(id);
  }

  /** Animate the field fade overlay toward a target. */
  async fadeTo(target: number, frames: number, color = '#000000'): Promise<void> {
    const f = this.field;
    if (!f) return;
    f.fadeColor = color;
    const start = f.fade;
    for (let i = 1; i <= frames; i++) {
      await f.wait(1);
      f.fade = start + ((target - start) * i) / frames;
    }
    f.fade = target;
  }

  /**
   * Fade out, switch map, fade in. The player is locked for the whole transition (no damage, no talking, no
   * second exit). A story warp requested while another transition runs waits for it, then goes ahead.
   */
  async changeMap(mapId: string, tx: number, ty: number, dir: Dir, color = '#000000'): Promise<void> {
    while (this.transition) await this.transition;
    if (this.gameOverActive || this.field?.player.state === 'dead') return;
    const run = (async () => {
      await this.fadeTo(1, 12, color);
      const f = this.startField(mapId, tx, ty, dir);
      f.fade = 1;
      f.fadeColor = color;
      await this.fadeTo(0, 12, color);
    })();
    const mine = run.catch(() => undefined);
    this.transition = mine;
    try {
      await run;
    } finally {
      if (this.transition === mine) this.transition = null;
    }
  }

  /** Walk off a map edge into the neighbour, keeping the parallel coordinate. */
  async edgeExit(side: 'north' | 'south' | 'east' | 'west', to: string, offset: number, px: number, py: number): Promise<void> {
    const def = MAPS[to];
    if (!def) { console.error(`[game] edge exit to unknown map ${to}`); return; }
    const rows = def.grid.length;
    const cols = def.grid[0].length;
    let tx = px - 0.5;
    let ty = py - 0.875;
    let dir: Dir = 'down';
    if (side === 'north') { ty = rows - 1.2; tx = Math.min(cols - 1, Math.max(0, tx + offset)); dir = 'up'; }
    if (side === 'south') { ty = 0.2; tx = Math.min(cols - 1, Math.max(0, tx + offset)); dir = 'down'; }
    if (side === 'west') { tx = cols - 1.2; ty = Math.min(rows - 1, Math.max(0, ty + offset)); dir = 'left'; }
    if (side === 'east') { tx = 0.2; ty = Math.min(rows - 1, Math.max(0, ty + offset)); dir = 'right'; }
    await this.changeMap(to, tx, ty, dir);
  }

  /** Flight circle: lift off, white-out, land elsewhere. */
  async flyTo(mapId: string, tx: number, ty: number): Promise<void> {
    const f = this.field;
    if (!f || this.transition) return;
    this.lockDepth++;
    try {
      const p = f.player;
      audio.sfx('dash');
      p.pose = 'fly';
      for (let i = 0; i < 24; i++) { await f.wait(1); p.z = i; f.fx.aura(p.x, p.y, '#f8f8d0', 1); }
      await this.changeMap(mapId, tx, ty, p.dir, '#ffffff');
      const nf = this.field;
      if (nf) {
        nf.player.z = 24;
        for (let i = 24; i >= 0; i -= 2) { await nf.wait(1); nf.player.z = i; }
        nf.fx.dust(nf.player.x, nf.player.y);
      }
    } finally {
      this.lockDepth--;
    }
  }

  /** Show dialogue lines; resolves when dismissed. */
  say(lines: Line[]): Promise<void> {
    return new Promise((resolve) => {
      const d: DialogueScene = new DialogueScene(lines, () => { this.scenes.remove(d); this.input.swallow(); resolve(); });
      this.scenes.push(d);
    });
  }

  /** Ask a multiple-choice question. */
  ask(prompt: Line, options: string[]): Promise<number> {
    return new Promise((resolve) => {
      const c: ChoiceScene = new ChoiceScene(prompt, options, (i) => { this.scenes.remove(c); this.input.swallow(); resolve(i); });
      this.scenes.push(c);
    });
  }

  /** Give an item silently. */
  giveQuiet(item: string, qty: number): void {
    const def = ITEMS[item];
    if (!def) { console.error(`[game] unknown item ${item}`); return; }
    this.state.give(item, qty, def.max);
    if (def.kind === 'trophy') {
      const owner = (Object.keys(CHARACTERS) as CharId[]).find((c) => item === `trophy${CHARACTERS[c].name.replace(/[^A-Za-z]/g, '')}`);
      if (owner) this.state.char(owner).trophy = true;
    }
  }

  /** Give an item with LoG2's narrator pickup box. */
  async obtain(item: string, qty = 1): Promise<void> {
    const def = ITEMS[item];
    if (!def) { console.error(`[game] unknown item ${item}`); return; }
    this.giveQuiet(item, qty);
    audio.sfx('item');
    const n = this.state.count(item);
    const extra = def.kind === 'collectible' ? ` (${n}/${def.max})` : '';
    const what = qty > 1 ? `${qty} x ${def.name}` : def.name;
    const lockedHere = this.lockDepth === 0;
    if (lockedHere) this.lockDepth++;
    try {
      await this.say([{ text: `You found ${/^[aeiou]/i.test(what) ? 'an' : 'a'} ${what}!${extra}` }]);
    } finally {
      if (lockedHere) this.lockDepth--;
    }
  }

  /** Run a script by id. Controls are locked for its duration. */
  async runScript(id: string, ctx: ScriptCtx = {}): Promise<void> {
    const fn = SCRIPTS[id];
    if (!fn) { console.error(`[script] missing script "${id}"`); return; }
    this.lockDepth++;
    const prevAllow = this.allowControl;
    this.allowControl = false;
    try {
      await fn(new ScriptApi(this, ctx));
    } catch (err) {
      if (err instanceof FightAbandoned) console.warn(`[script] ${id}: ${err.message}`);
      else console.error(`[script] ${id} failed`, err);
    } finally {
      this.lockDepth = Math.max(0, this.lockDepth - 1);
      this.allowControl = this.lockDepth > 0 ? prevAllow : false;
      if (this.lockDepth === 0 && this.field) { this.field.letterbox = 0; this.field.camera.release(); this.hideHud = false; }
    }
  }

  /** Chapter title card. */
  titleCard(head: string, title: string, subtitle?: string): Promise<void> {
    return new Promise((resolve) => {
      const s: TitleCardScene = new TitleCardScene(head, title, subtitle, () => { this.scenes.remove(s); resolve(); });
      this.scenes.push(s);
    });
  }

  /** Switch the active character (save point or forced by story). */
  switchCharacter(id: CharId): void {
    const c = this.state.char(id);
    if (!c.joined) this.state.join(id, Math.max(1, c.level));
    this.state.data.active = id;
    const f = this.field;
    if (f) {
      f.player.revert();
      f.player.bind(c);
    }
  }

  /** Persist to the current slot. */
  saveGame(): boolean {
    const f = this.field;
    if (f) {
      this.state.data.map = f.def.id;
      this.state.data.x = f.player.x;
      this.state.data.y = f.player.y;
      this.state.data.dir = f.player.dir;
    }
    const ok = this.saves.save(this.slot, this.state.data);
    if (ok) this.runSaved = true;
    return ok;
  }

  playMusic(id: string): void {
    const t = TRACKS[id];
    if (!t) { if (id) console.warn(`[music] unknown track ${id}`); return; }
    audio.play(id, t);
  }

  // ---- overlays ----
  async openSaveMenu(): Promise<void> { await this.overlay(new SaveMenu(this)); }
  async openPause(): Promise<void> { await this.overlay(new PauseMenu(this)); }
  /** Pause menu over the world map (no field underneath). */
  async openPauseOverWorld(): Promise<void> {
    const m = new PauseMenu(this);
    this.scenes.push(m);
    try { await m.done; } finally { this.scenes.remove(m); this.input.swallow(); }
  }
  async openScouter(): Promise<void> { await this.overlay(new ScouterScene(this)); }
  async openRegionMap(): Promise<void> { await this.overlay(new RegionMapScene(this)); }
  async openScouterDb(): Promise<void> { await this.overlay(new ScouterDbScene(this)); }
  async credits(lines: string[]): Promise<void> {
    this.playMusic('ending');
    await this.overlay(new CreditsScene(lines));
  }
  async beamStruggle(o: StruggleOpts): Promise<void> {
    this.hideHud = true;
    try { await this.overlay(new BeamStruggleScene(o)); } finally { this.hideHud = false; }
  }
  async openWorldMap(): Promise<void> {
    if (!this.field) return;
    this.lockDepth++;
    try {
      await this.fadeTo(1, 16, '#ffffff');
      const wm = new WorldMapScene(this);
      this.scenes.replace(wm);
      await wm.done;
    } finally {
      this.lockDepth = Math.max(0, this.lockDepth - 1);
    }
  }

  /** Push a modal scene that resolves via its `done` promise. */
  private async overlay(s: { done: Promise<void> } & import('../engine/scene').Scene): Promise<void> {
    this.lockDepth++;
    this.scenes.push(s);
    try {
      await s.done;
    } finally {
      this.scenes.remove(s);
      this.input.swallow();
      this.lockDepth = Math.max(0, this.lockDepth - 1);
    }
  }

  /** Wait `n` ticks of whichever field is current (survives nothing replacing it; map changes are off). */
  private async frames(n: number): Promise<void> {
    const f = this.field;
    if (f) await f.wait(n);
  }

  /**
   * Game Over sequence (LoG2: back to title / last save). Map changes are refused from here on, so the field
   * this waits on cannot be swapped out from under it.
   */
  async gameOver(): Promise<void> {
    if (!this.field || this.gameOverActive) return;
    this.gameOverActive = true;
    this.lockDepth = 999;
    await this.frames(50);
    await this.say([{ text: 'You have died!' }]);
    await this.fadeTo(1, 30);
    this.lockDepth = 0;
    this.scenes.replace(new GameOverScene(this));
  }

  /**
   * Game Over → Continue: back to this run's last save. A run that was never saved (New Game, even on a file
   * holding an older playthrough) restarts from the beginning instead of loading that other playthrough.
   */
  continueAfterGameOver(): boolean {
    if (this.runSaved) return this.continueGame(this.slot);
    void this.startNewGame(this.slot);
    return true;
  }
}
