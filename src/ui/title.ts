import { PAL } from '../art/color';
import { portrait, spriteSet } from '../art/registry';
import { CHARACTERS } from '../content/characters';
import { MAPS } from '../content/registry';
import { audio } from '../engine/audio';
import { SCREEN_H, SCREEN_W } from '../engine/constants';
import { wrap } from '../engine/fontdata';
import { font, makeBitmap, type Bitmap } from '../engine/gfx';
import { BUTTONS, type Input } from '../engine/input';
import type { Scene } from '../engine/scene';
import type { Game } from '../game/game';
import { decodeSaveCode, SaveCodeError, type SaveData } from '../game/state';
import { IntroScene } from './intro';
import { drawWindow } from './window';

/** Which screen of the title is up. */
export type TitleMode =
  | 'press' | 'menu' | 'files' | 'fileAction' | 'confirmDelete' | 'confirmNew' | 'confirmImport' | 'code' | 'message'
  | 'options' | 'credits';

/** Frames the title waits at PRESS START with no input before replaying the opening (LoG2's attract loop). */
export const ATTRACT_IDLE_FRAMES = 30 * 60;
/** Frames a file-screen message stays up unless dismissed. */
const MESSAGE_FRAMES = 300;
const RED = '#f86060';
/** Shown on the title and file screens when browser storage is blocked. */
const STORAGE_NOTICE = 'No browser storage: saves end with this tab';

let logoCache: Bitmap | null = null;

/** Big two-tone logo rendered from the bitmap font at 2x with an outline. */
function logo(): Bitmap {
  if (logoCache) return logoCache;
  const line1 = 'LEGACY OF';
  const line2 = 'SUPER';
  const { bmp: small, ctx: sctx } = makeBitmap(120, 24);
  font.drawCentered(sctx, line1, 60, 0, '#f8f8f8');
  font.drawCentered(sctx, line2, 60, 11, '#f8c020');
  const { bmp, ctx } = makeBitmap(244, 52);
  // Outline by stamping a dark copy offset in 8 directions.
  const { bmp: dark, ctx: dctx } = makeBitmap(120, 24);
  font.drawCentered(dctx, line1, 60, 0, '#301000');
  font.drawCentered(dctx, line2, 60, 11, '#301000');
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1], [2, 2]]) ctx.drawImage(dark, 0, 0, 120, 24, 2 + dx * 2, 2 + dy * 2, 240, 48);
  ctx.drawImage(small, 0, 0, 120, 24, 2, 2, 240, 48);
  logoCache = bmp;
  return bmp;
}

/** What the file screen shows about a save. */
function describe(d: SaveData): { name: string; level: number; chapter: string; area: string; time: string } {
  const secs = Math.floor(d.playFrames / 60);
  return {
    name: CHARACTERS[d.active].name,
    level: d.chars[d.active].level,
    chapter: d.chapter === 0 ? 'Prologue' : `Ch.${d.chapter}`,
    area: MAPS[d.map]?.name ?? d.map,
    time: `${Math.floor(secs / 3600)}:${String(Math.floor(secs / 60) % 60).padStart(2, '0')}`,
  };
}

// ------------------------------------------------------------------------------------------------ save-code panel

/**
 * Copy / paste panel for save codes. A code is far too long for the 240x160 screen and has to reach the system
 * clipboard, so it is an HTML overlay; the title screen waits on it and ignores game input meanwhile.
 */
export interface SaveCodeUi {
  /** False when the page has no panel (headless tests, a custom embed). */
  readonly available: boolean;
  /** Show a code, try to copy it to the clipboard, and resolve when the player closes the panel. */
  showExport(heading: string, code: string): Promise<void>;
  /**
   * Ask for a code. Each submission goes through `parse`; when it throws, its message is shown and the panel stays
   * open for another try. Resolves with the parsed value, or null when the player cancels.
   */
  promptImport<T>(heading: string, parse: (code: string) => T): Promise<T | null>;
}

interface CodePanelEls {
  root: HTMLElement;
  form: HTMLFormElement;
  title: HTMLElement;
  help: HTMLElement;
  text: HTMLTextAreaElement;
  status: HTMLElement;
  copy: HTMLButtonElement;
  ok: HTMLButtonElement;
  close: HTMLButtonElement;
}

/** The panel declared in index.html (#code-panel); exported so tests can drive it against a stand-in DOM. */
export class DomSaveCodeUi implements SaveCodeUi {
  private els: CodePanelEls | null | undefined;
  private active: { submit(): void; cancel(): void } | null = null;

  get available(): boolean {
    return this.dom() !== null;
  }

  /** Look the panel up once and wire its events; null when the page has none. */
  private dom(): CodePanelEls | null {
    if (this.els !== undefined) return this.els;
    const get = (id: string): HTMLElement | null => (typeof document !== 'undefined' ? document.getElementById(id) : null);
    const root = get('code-panel');
    const form = get('code-form');
    const title = get('code-title');
    const help = get('code-help');
    const text = get('code-text');
    const status = get('code-status');
    const copy = get('code-copy');
    const ok = get('code-ok');
    const close = get('code-close');
    if (!root || !(form instanceof HTMLFormElement) || !title || !help || !(text instanceof HTMLTextAreaElement) || !status
      || !(copy instanceof HTMLButtonElement) || !(ok instanceof HTMLButtonElement) || !(close instanceof HTMLButtonElement)) {
      this.els = null;
      return null;
    }
    const els: CodePanelEls = { root, form, title, help, text, status, copy, ok, close };
    // Keys typed into the panel must not reach the game's window listeners (which also swallow Space/Backspace).
    // Releases are left alone: the A / Start that opened the panel is let go inside it, and the game has to see
    // that, or it would treat the button as still held and drop the next press after the panel closes.
    root.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); this.active?.cancel(); }
      // A code is one line (pasted line breaks are ignored), so Enter in the box submits; Shift+Enter breaks a line.
      // Auto-repeat is ignored: a Start (Enter) still held from opening the panel must not submit or close it.
      if (e.key === 'Enter' && e.target === text && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        if (!e.repeat) this.active?.submit();
      }
    });
    // A click on the dimmed backdrop keeps the focus in the panel, so typing, Enter and Esc keep working there
    // instead of falling through to the game's keyboard handlers.
    root.addEventListener('mousedown', (e) => {
      if (e.target !== root) return;
      e.preventDefault();
      text.focus();
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); this.active?.submit(); });
    close.addEventListener('click', () => this.active?.cancel());
    copy.addEventListener('click', () => void this.copy(false));
    // A shown code is selected whole, ready to copy. Selecting backwards leaves the caret at the start, so the box
    // keeps the beginning of the code in view instead of scrolling to its end.
    text.addEventListener('focus', () => {
      if (!text.readOnly) return;
      text.setSelectionRange(0, text.value.length, 'backward');
      text.scrollTop = 0;
    });
    this.els = els;
    return els;
  }

  showExport(heading: string, code: string): Promise<void> {
    const d = this.dom();
    if (!d) return Promise.resolve();
    return new Promise((resolve) => {
      const done = (): void => { this.hide(d); resolve(); };
      this.open(d, heading, 'Keep this code somewhere safe. Paste it into Import Code on the file screen (on any device) to get this file back.', code, 'export');
      this.active = { submit: done, cancel: done };
      // Focus the (read-only, selected) code rather than a button: releasing the Space (A) that opened the panel
      // over a focused button can click it in some browsers and shut the panel at once. Enter or Esc closes it.
      d.text.focus();
      void this.copy(true);
    });
  }

  promptImport<T>(heading: string, parse: (code: string) => T): Promise<T | null> {
    const d = this.dom();
    if (!d) return Promise.resolve(null);
    return new Promise((resolve) => {
      this.open(d, heading, 'Paste a save code below, then press Import or Enter. A bad or damaged code is refused, and the file is only replaced after you confirm.', '', 'import');
      this.active = {
        submit: () => {
          try {
            const v = parse(d.text.value);
            this.hide(d);
            resolve(v);
          } catch (err) {
            this.say(err instanceof Error ? err.message : 'That code could not be read.', true);
            d.text.focus();
          }
        },
        cancel: () => { this.hide(d); resolve(null); },
      };
      d.text.focus();
    });
  }

  private open(d: CodePanelEls, heading: string, help: string, value: string, kind: 'export' | 'import'): void {
    d.title.textContent = heading;
    d.help.textContent = help;
    d.text.value = value;
    d.text.readOnly = kind === 'export';
    d.text.placeholder = kind === 'import' ? 'LOS1....' : '';
    d.copy.hidden = kind !== 'export';
    d.ok.hidden = kind !== 'import';
    d.close.textContent = kind === 'export' ? 'Close' : 'Cancel';
    this.say('', false);
    d.root.hidden = false;
  }

  private hide(d: CodePanelEls): void {
    this.active = null;
    d.root.hidden = true;
    d.text.value = '';
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }

  private say(msg: string, error: boolean): void {
    const d = this.dom();
    if (!d) return;
    d.status.textContent = msg;
    d.status.classList.toggle('error', error);
  }

  /** Copy the shown code. The automatic attempt on open may be refused outside a user gesture (Safari). */
  private async copy(auto: boolean): Promise<void> {
    const d = this.dom();
    if (!d) return;
    const text = d.text.value;
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch (err) {
      console.info('[title] clipboard write refused', err);
    }
    if (!ok && !auto) {
      try {
        d.text.focus();
        d.text.select();
        ok = document.execCommand('copy');
      } catch (err) {
        console.info('[title] execCommand copy failed', err);
      }
    }
    if (ok) this.say('Copied to the clipboard.', false);
    else this.say(auto ? 'Press Copy, or select the code and copy it.' : 'The browser blocked copying: select the code and copy it by hand.', !auto);
  }
}

/** The page's save-code panel. */
export const domSaveCodeUi: SaveCodeUi = new DomSaveCodeUi();

/** Decode a pasted code; anything but a SaveCodeError is logged and reported generically. */
function parseCode(code: string): SaveData {
  try {
    return decodeSaveCode(code);
  } catch (err) {
    if (err instanceof SaveCodeError) throw err;
    console.error('[title] save code import failed', err);
    throw new Error('That code could not be read.');
  }
}

// ------------------------------------------------------------------------------------------------ the title

/** Title screen, file select (with save-code export / import) and title options. */
export class TitleScene implements Scene {
  private t = 0;
  private mode: TitleMode = 'press';
  private sel = 0;
  private fileSel = 0;
  private actionSel = 0;
  private files: Array<{ slot: number; data: SaveData | null }> = [];
  private readonly heroes = ['gokuSSB', 'vegetaSSB', 'gohan', 'futureTrunksSSJ', 'piccolo'];
  /** Frames without any button held (drives the attract loop). */
  private idle = 0;
  private flash = 0;
  private flashLen = 1;
  /** A validated save waiting for "overwrite?" confirmation. */
  private pendingImport: SaveData | null = null;
  private message: { text: string; color: string; t: number } | null = null;

  constructor(private readonly game: Game, private readonly codeUi: SaveCodeUi = domSaveCodeUi) {
    this.files = game.saves.summaries();
  }

  /** Current menu state (for tests and the debug harness). */
  get state(): TitleMode {
    return this.mode;
  }

  /** Fade in from white over `frames` (the opening ends on a white flash). */
  flashIn(frames: number): void {
    this.flash = Math.max(0, Math.floor(frames));
    this.flashLen = Math.max(1, this.flash);
  }

  update(input: Input): void {
    this.t++;
    if (this.flash > 0) this.flash--;
    // The HTML code panel owns the keyboard until it resolves.
    if (this.mode === 'code') return;
    this.idle = BUTTONS.some((b) => input.isDown(b)) ? 0 : this.idle + 1;
    if (this.mode === 'press' && this.idle >= ATTRACT_IDLE_FRAMES) {
      this.game.scenes.replace(new IntroScene(this.game, { splash: false }));
      return;
    }
    const up = input.repeat('up');
    const down = input.repeat('down');
    const ok = input.pressed('A') || input.pressed('start');
    const back = input.pressed('B');
    switch (this.mode) {
      case 'press':
        if (ok) { this.mode = 'menu'; audio.sfx('menuOk'); }
        break;
      case 'menu':
        if (up || down) { this.sel ^= 1; audio.sfx('menuMove'); }
        if (ok) {
          audio.sfx('menuOk');
          if (this.sel === 0) { this.files = this.game.saves.summaries(); this.mode = 'files'; }
          else { this.mode = 'options'; this.sel = 0; }
        }
        break;
      case 'files':
        if (up) { this.fileSel = (this.fileSel + 2) % 3; audio.sfx('menuMove'); }
        if (down) { this.fileSel = (this.fileSel + 1) % 3; audio.sfx('menuMove'); }
        if (back) { this.mode = 'menu'; this.sel = 0; audio.sfx('menuBack'); }
        if (ok) { this.mode = 'fileAction'; this.actionSel = 0; audio.sfx('menuOk'); }
        break;
      case 'fileAction': {
        const has = !!this.files[this.fileSel].data;
        const opts = this.fileOptions(has);
        if (up) { this.actionSel = (this.actionSel + opts.length - 1) % opts.length; audio.sfx('menuMove'); }
        if (down) { this.actionSel = (this.actionSel + 1) % opts.length; audio.sfx('menuMove'); }
        if (back) { this.mode = 'files'; audio.sfx('menuBack'); }
        if (ok) {
          const o = opts[this.actionSel];
          audio.sfx('menuOk');
          if (o === 'Continue') this.continueFile();
          else if (o === 'New Game' && has) { this.mode = 'confirmNew'; this.actionSel = 1; }
          else if (o === 'New Game') void this.game.startNewGame(this.fileSel);
          else if (o === 'Export Code') this.exportFile();
          else if (o === 'Import Code') this.importFile();
          else { this.mode = 'confirmDelete'; this.actionSel = 1; }
        }
        break;
      }
      case 'confirmNew':
        // A new game on an occupied file: the old save stays in the file until the new run saves over it.
        if (up || down) { this.actionSel ^= 1; audio.sfx('menuMove'); }
        if (back) { this.mode = 'fileAction'; this.actionSel = 1; audio.sfx('menuBack'); }
        if (ok) {
          if (this.actionSel === 0) { audio.sfx('menuOk'); void this.game.startNewGame(this.fileSel); }
          else { this.mode = 'fileAction'; this.actionSel = 1; audio.sfx('menuBack'); }
        }
        break;
      case 'confirmDelete':
        if (up || down) { this.actionSel ^= 1; audio.sfx('menuMove'); }
        if (back) { this.mode = 'files'; audio.sfx('menuBack'); }
        if (ok) {
          if (this.actionSel === 0) { this.game.saves.erase(this.fileSel); this.files = this.game.saves.summaries(); audio.sfx('explode'); }
          this.mode = 'files';
        }
        break;
      case 'confirmImport': {
        // The pasted save is already validated; the file is only written once the player says so.
        const pending = this.pendingImport;
        if (up || down || input.repeat('left') || input.repeat('right')) { this.actionSel ^= 1; audio.sfx('menuMove'); }
        if (back || !pending || (ok && this.actionSel !== 0)) { this.cancelImport(); break; }
        if (ok) this.writeImport(pending);
        break;
      }
      case 'message':
        if (this.message) this.message.t++;
        if (ok || back || (this.message?.t ?? MESSAGE_FRAMES) >= MESSAGE_FRAMES) { this.message = null; this.mode = 'files'; }
        break;
      case 'options': {
        const d = this.game.state.data;
        if (up) { this.sel = (this.sel + 3) % 4; audio.sfx('menuMove'); }
        if (down) { this.sel = (this.sel + 1) % 4; audio.sfx('menuMove'); }
        const l = input.repeat('left');
        const r = input.repeat('right');
        if (l || r) {
          const dv = r ? 1 : -1;
          if (this.sel === 0) d.textSpeed = Math.max(1, Math.min(4, d.textSpeed + dv));
          if (this.sel === 1) d.musicVol = Math.max(0, Math.min(1, +(d.musicVol + dv * 0.1).toFixed(1)));
          if (this.sel === 2) d.sfxVol = Math.max(0, Math.min(1, +(d.sfxVol + dv * 0.1).toFixed(1)));
          // Applied now and remembered; a New Game started from here keeps them.
          this.game.optionsChanged();
          if (this.sel === 2) audio.sfx('menuMove');
        }
        if (ok && this.sel === 3) { this.mode = 'credits'; this.t = 0; audio.sfx('menuOk'); }
        if (back) { this.mode = 'menu'; this.sel = 1; audio.sfx('menuBack'); }
        break;
      }
      case 'credits':
        if (back || (ok && this.t > 30)) { this.mode = 'options'; this.sel = 3; }
        break;
    }
  }

  /** Actions offered for a file; export needs a save, import works on any file. */
  private fileOptions(has: boolean): string[] {
    return has ? ['Continue', 'New Game', 'Export Code', 'Import Code', 'Delete'] : ['New Game', 'Import Code'];
  }

  /** Load the selected file; a save that cannot be resumed is reported instead of freezing the title screen. */
  private continueFile(): void {
    try {
      if (!this.game.continueGame(this.fileSel)) audio.sfx('denied');
    } catch (err) {
      console.error('[title] could not load file', this.fileSel + 1, err);
      audio.sfx('denied');
      this.game.toTitle();
    }
  }

  /** Show the selected file as a save code (copied to the clipboard when the browser allows it). */
  private exportFile(): void {
    const n = this.fileSel + 1;
    const code = this.game.saves.exportCode(this.fileSel);
    if (!code) { audio.sfx('denied'); this.notify(`File ${n} could not be read.`, RED); return; }
    if (!this.codeUi.available) { audio.sfx('denied'); this.notify('Save codes are not available on this page.', RED); return; }
    this.mode = 'code';
    this.codeUi.showExport(`File ${n} save code`, code).then(
      () => this.codeClosed(),
      (err: unknown) => { console.error('[title] export panel failed', err); this.codeClosed(); },
    );
  }

  /** Ask for a code to import into the selected file. Nothing is written until it validates (and is confirmed). */
  private importFile(): void {
    if (!this.codeUi.available) { audio.sfx('denied'); this.notify('Save codes are not available on this page.', RED); return; }
    this.mode = 'code';
    this.codeUi.promptImport(`Import a save code into File ${this.fileSel + 1}`, parseCode).then(
      (d) => this.imported(d),
      (err: unknown) => { console.error('[title] import panel failed', err); this.codeClosed(); },
    );
  }

  private codeClosed(): void {
    if (this.mode !== 'code') return;
    this.mode = 'fileAction';
    this.game.input.swallow();
  }

  /** A validated save came back from the panel (or null: cancelled). An occupied file asks before it is replaced. */
  private imported(d: SaveData | null): void {
    if (this.mode !== 'code') return;
    this.game.input.swallow();
    if (!d) { this.mode = 'fileAction'; return; }
    if (this.files[this.fileSel].data) {
      this.pendingImport = d;
      this.mode = 'confirmImport';
      this.actionSel = 1;
      audio.sfx('menuOk');
      return;
    }
    this.writeImport(d);
  }

  private writeImport(d: SaveData): void {
    const n = this.fileSel + 1;
    const ok = this.game.saves.save(this.fileSel, d);
    this.pendingImport = null;
    this.files = this.game.saves.summaries();
    if (ok) { audio.sfx('save'); this.notify(`Imported into File ${n}.`, PAL.white); }
    else { audio.sfx('denied'); this.notify(`Could not write File ${n}. Nothing was changed.`, RED); }
  }

  /** "Replace File N?" answered Cancel / B: drop the pasted save and go back to the file's actions, on Import Code. */
  private cancelImport(): void {
    this.pendingImport = null;
    this.mode = 'fileAction';
    this.actionSel = Math.max(0, this.fileOptions(!!this.files[this.fileSel].data).indexOf('Import Code'));
    audio.sfx('menuBack');
  }

  private notify(text: string, color: string): void {
    this.message = { text, color, t: 0 };
    this.mode = 'message';
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D): void {
    // Energy-burst sky.
    const g = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
    g.addColorStop(0, '#081038');
    g.addColorStop(0.6, '#283880');
    g.addColorStop(1, '#f0a040');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.save();
    ctx.translate(SCREEN_W / 2, 150);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + this.t / 400;
      ctx.fillStyle = i % 2 ? 'rgba(255,220,120,0.10)' : 'rgba(120,180,255,0.08)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 300, Math.sin(a) * 300);
      ctx.lineTo(Math.cos(a + 0.17) * 300, Math.sin(a + 0.17) * 300);
      ctx.fill();
    }
    ctx.restore();
    // Heroes lined up on a cliff.
    ctx.fillStyle = '#20182c';
    ctx.fillRect(0, 140, SCREEN_W, 20);
    this.heroes.forEach((id, i) => {
      const set = spriteSet(id);
      const bob = Math.round(Math.sin((this.t + i * 20) / 30) * 1);
      const x = 40 + i * 40 - 12;
      const y = 112 + bob + (i === 2 ? -2 : 0);
      ctx.drawImage(set[i % 2 ? 'charge' : 'idle'].down, x, y);
      if (this.t % 6 === i) { ctx.fillStyle = '#fff8c0'; ctx.fillRect(x + 4 + (this.t % 13), y + 4, 1, 2); }
    });
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.drawBackdrop(ctx);
    const lg = logo();
    ctx.drawImage(lg, Math.round((SCREEN_W - lg.width) / 2), 10 + Math.round(Math.sin(this.t / 50) * 1.5));
    font.drawCentered(ctx, 'A Dragon Ball Super fan tribute', SCREEN_W / 2, 64, '#c8d0f0', '#000');

    switch (this.mode) {
      case 'press':
        if (Math.floor(this.t / 30) % 2 === 0) font.drawCentered(ctx, 'PRESS START', SCREEN_W / 2, 90, PAL.white, '#000');
        this.renderStorageNotice(ctx);
        break;
      case 'menu': {
        drawWindow(ctx, 84, 80, 72, 34);
        ['START', 'OPTIONS'].forEach((o, i) => {
          font.draw(ctx, o, 104, 86 + i * 12, i === this.sel ? PAL.gold : PAL.white, '#000');
          if (i === this.sel) this.orb(ctx, 94, 89 + i * 12);
        });
        this.renderStorageNotice(ctx);
        break;
      }
      case 'files':
      case 'fileAction':
      case 'confirmDelete':
      case 'confirmNew':
        this.renderFiles(ctx);
        break;
      case 'confirmImport':
        this.renderFiles(ctx);
        this.renderConfirmImport(ctx);
        break;
      case 'code':
        this.renderFiles(ctx);
        ctx.fillStyle = 'rgba(0,0,10,0.6)';
        ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
        drawWindow(ctx, 40, 66, 160, 26);
        font.drawCentered(ctx, 'Using the save code window...', SCREEN_W / 2, 75, PAL.white, '#000');
        break;
      case 'message':
        this.renderFiles(ctx);
        this.renderMessage(ctx);
        break;
      case 'options':
        this.renderOptions(ctx);
        break;
      case 'credits':
        this.renderCredits(ctx);
        break;
    }
    if (this.flash > 0) {
      ctx.save();
      ctx.globalAlpha = this.flash / this.flashLen;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      ctx.restore();
    }
  }

  private orb(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = '#f89820';
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e03020';
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }

  /** Browser storage is blocked (some private modes): saves still work, but only until the tab closes. */
  private renderStorageNotice(ctx: CanvasRenderingContext2D): void {
    if (this.game.saves.persistent) return;
    ctx.fillStyle = 'rgba(64,16,32,0.9)';
    ctx.fillRect(0, 148, SCREEN_W, 12);
    font.drawCentered(ctx, STORAGE_NOTICE, SCREEN_W / 2, 150, '#f8c060', '#000');
  }

  private renderFiles(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,10,0.55)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    font.drawCentered(ctx, 'SELECT FILE', SCREEN_W / 2, 6, PAL.gold, '#000');
    this.files.forEach(({ slot, data }, i) => {
      const y = 20 + i * 44;
      drawWindow(ctx, 16, y, 208, 40, { fill: i === this.fileSel ? '#203060' : undefined });
      font.draw(ctx, `FILE ${slot + 1}`, 24, y + 4, i === this.fileSel ? PAL.gold : PAL.white, '#000');
      if (!data) { font.draw(ctx, '- New Game -', 90, y + 16, '#a0a8c8', '#000'); return; }
      const s = describe(data);
      const por = portrait(CHARACTERS[data.active].sprite);
      if (por) ctx.drawImage(por, 0, 4, 32, 30, 24, y + 9, 32, 30);
      font.draw(ctx, `${s.name}  Lv ${s.level}`, 62, y + 14, PAL.white, '#000');
      font.draw(ctx, s.area, 62, y + 25, '#a8c8f8', '#000');
      font.drawRight(ctx, s.chapter, 216, y + 4, '#c8c8c8', '#000');
      font.drawRight(ctx, s.time, 216, y + 25, '#c8c8c8', '#000');
    });
    if (!this.game.saves.persistent) font.drawCentered(ctx, STORAGE_NOTICE, SCREEN_W / 2, 150, '#f8c060', '#000');
    if (this.mode === 'fileAction' || this.mode === 'confirmDelete' || this.mode === 'confirmNew') {
      const has = !!this.files[this.fileSel].data;
      const opts = this.mode === 'confirmDelete' ? ['Delete', 'Cancel'] : this.mode === 'confirmNew' ? ['Start', 'Cancel'] : this.fileOptions(has);
      const w = Math.max(70, Math.max(...opts.map((o) => font.drawWidth(o))) + 26);
      const h = opts.length * 12 + 8;
      const x = SCREEN_W - 20 - w;
      const y = Math.min(SCREEN_H - h - 2, 24 + this.fileSel * 44);
      drawWindow(ctx, x, y, w, h);
      if (this.mode === 'confirmDelete') font.draw(ctx, 'Erase?', x + 4, y - 10, RED, '#000');
      if (this.mode === 'confirmNew') font.drawRight(ctx, 'Start over?', x + w - 2, y - 10, '#f8c060', '#000');
      opts.forEach((o, i) => {
        const yy = y + 5 + i * 12;
        font.draw(ctx, o, x + 16, yy, i === this.actionSel ? PAL.gold : PAL.white, '#000');
        if (i === this.actionSel) font.draw(ctx, '▶', x + 6, yy, PAL.gold, '#000');
      });
    }
  }

  /** "Replace File N with ...?" for a validated import over an existing save. */
  private renderConfirmImport(ctx: CanvasRenderingContext2D): void {
    const d = this.pendingImport;
    if (!d) return;
    const s = describe(d);
    ctx.fillStyle = 'rgba(0,0,10,0.5)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    drawWindow(ctx, 24, 38, 192, 82);
    font.drawCentered(ctx, `Replace File ${this.fileSel + 1} with this save?`, SCREEN_W / 2, 44, '#f8c060', '#000');
    const por = portrait(CHARACTERS[d.active].sprite);
    if (por) ctx.drawImage(por, 0, 4, 32, 30, 32, 58, 32, 30);
    font.draw(ctx, `${s.name}  Lv ${s.level}`, 70, 60, PAL.white, '#000');
    font.draw(ctx, `${s.chapter}   ${s.time}`, 70, 71, '#c8c8c8', '#000');
    font.draw(ctx, s.area, 70, 82, '#a8c8f8', '#000');
    ['Replace', 'Cancel'].forEach((o, i) => {
      const x = 70 + i * 70;
      font.draw(ctx, o, x + 10, 102, i === this.actionSel ? PAL.gold : PAL.white, '#000');
      if (i === this.actionSel) font.draw(ctx, '▶', x, 102, PAL.gold, '#000');
    });
  }

  private renderMessage(ctx: CanvasRenderingContext2D): void {
    const m = this.message;
    if (!m) return;
    const rows = wrap(m.text, 180);
    const h = rows.length * 11 + 12;
    const y = Math.round((SCREEN_H - h) / 2);
    drawWindow(ctx, 24, y, 192, h);
    rows.forEach((r, i) => font.drawCentered(ctx, r, SCREEN_W / 2, y + 6 + i * 11, m.color, '#000'));
  }

  private renderOptions(ctx: CanvasRenderingContext2D): void {
    const d = this.game.state.data;
    drawWindow(ctx, 40, 74, 160, 60);
    const rows: Array<[string, string]> = [
      ['Text Speed', ['', 'Slow', 'Normal', 'Fast', 'Instant'][d.textSpeed]],
      ['Music', `${Math.round(d.musicVol * 10)}`],
      ['Sound FX', `${Math.round(d.sfxVol * 10)}`],
      ['Credits', ''],
    ];
    rows.forEach(([k, v], i) => {
      const y = 80 + i * 12;
      font.draw(ctx, k, 58, y, i === this.sel ? PAL.gold : PAL.white, '#000');
      if (v) font.drawRight(ctx, `< ${v} >`, 192, y, PAL.white, '#000');
      if (i === this.sel) font.draw(ctx, '▶', 48, y, PAL.gold, '#000');
    });
  }

  private renderCredits(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,10,0.8)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    const lines = [
      'LEGACY OF SUPER',
      '',
      'A non-commercial fan tribute.',
      'Gameplay modelled on The Legacy of Goku II',
      '(Webfoot / Atari, 2003).',
      'Dragon Ball Super (c) Bird Studio / Shueisha,',
      'Toei Animation. All rights belong to their owners.',
      '',
      'All sprites, music and code in this build are',
      'original and generated procedurally.',
      '',
      'B: back',
    ];
    lines.forEach((l, i) => font.drawCentered(ctx, l, SCREEN_W / 2, 12 + i * 11, i === 0 ? PAL.gold : PAL.white, '#000'));
  }
}
