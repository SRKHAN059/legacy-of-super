import { CHARACTERS, type CharId } from '../content/characters';
import { ITEMS } from '../content/items';
import { TRACKS } from '../content/music';
import { MAPS, resolveMap } from '../content/registry';
import { audio } from '../engine/audio';
import { TILE } from '../engine/constants';
import type { Input } from '../engine/input';
import type { Dir } from '../engine/math';
import { SceneStack } from '../engine/scene';
import { ChoiceScene, DialogueScene, type Line } from '../ui/dialogue';
import { GameOverScene } from '../ui/gameover';
import { PauseMenu } from '../ui/pause';
import { RegionMapScene } from '../ui/regionmap';
import { SaveMenu } from '../ui/savemenu';
import { ScouterScene } from '../ui/scouter';
import { TitleCardScene } from '../ui/titlecard';
import { TitleScene } from '../ui/title';
import { WorldMapScene } from '../ui/worldmap';
import { Field } from './field';
import { ScriptApi, SCRIPTS, type ScriptCtx } from './script';
import { GameState, newGame, SaveService } from './state';
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
  hideHud = false;
  /** Hook to intercept player KO (scripted losses). Return true to cancel Game Over. */
  onPlayerDown: (() => boolean) | null = null;
  private transitioning = false;

  constructor(readonly input: Input) {}

  /** Show the title screen. */
  toTitle(): void {
    this.field = null;
    this.lockDepth = 0;
    this.allowControl = false;
    this.scenes.replace(new TitleScene(this));
    this.playMusic('title');
  }

  /** Begin a new game in a save slot. */
  async startNewGame(slot: number): Promise<void> {
    this.slot = slot;
    this.state = new GameState(newGame());
    this.lockDepth = 0;
    const boot = SCRIPTS.newGame;
    if (!boot) throw new Error('Missing "newGame" script');
    await this.runScript('newGame');
  }

  /** Continue from a save slot. */
  continueGame(slot: number): boolean {
    const d = this.saves.load(slot);
    if (!d) return false;
    this.slot = slot;
    this.state = new GameState(d);
    this.lockDepth = 0;
    this.allowControl = false;
    this.startField(d.map, d.x / TILE - 0.5, d.y / TILE - 0.875, d.dir);
    return true;
  }

  /** Create a field for a map at a tile position and make it the base scene. */
  startField(mapId: string, tx: number, ty: number, dir: Dir): Field {
    const def = resolveMap(mapId);
    if (!def) throw new Error(`Unknown map "${mapId}"`);
    const prev = this.field?.player;
    const f = new Field(this, def, tx * TILE + 8, ty * TILE + 14, dir);
    if (prev && prev.cs.id === f.player.cs.id) {
      f.player.formActive = prev.formActive;
      f.player.zGauge = prev.zGauge;
      f.player.refreshSprite();
    }
    this.field = f;
    this.state.data.map = mapId;
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

  /** Fade out, switch map, fade in. */
  async changeMap(mapId: string, tx: number, ty: number, dir: Dir, color = '#000000'): Promise<void> {
    if (this.transitioning) return;
    this.transitioning = true;
    try {
      await this.fadeTo(1, 12, color);
      const f = this.startField(mapId, tx, ty, dir);
      f.fade = 1;
      f.fadeColor = color;
      await this.fadeTo(0, 12, color);
    } finally {
      this.transitioning = false;
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
    if (!f || this.transitioning) return;
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
      console.error(`[script] ${id} failed`, err);
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
    return this.saves.save(this.slot, this.state.data);
  }

  playMusic(id: string): void {
    const t = TRACKS[id];
    if (!t) { if (id) console.warn(`[music] unknown track ${id}`); return; }
    audio.play(id, t);
  }

  // ---- overlays ----
  async openSaveMenu(): Promise<void> { await this.overlay(new SaveMenu(this)); }
  async openPause(): Promise<void> { await this.overlay(new PauseMenu(this)); }
  async openScouter(): Promise<void> { await this.overlay(new ScouterScene(this)); }
  async openRegionMap(): Promise<void> { await this.overlay(new RegionMapScene(this)); }
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

  /** Game Over sequence (LoG2: back to title / last save). */
  async gameOver(): Promise<void> {
    const f = this.field;
    if (!f) return;
    this.lockDepth = 999;
    await f.wait(70);
    await this.fadeTo(1, 30);
    this.lockDepth = 0;
    this.scenes.replace(new GameOverScene(this));
  }
}
