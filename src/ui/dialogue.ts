import { PAL } from '../art/color';
import { PORTRAIT_H, PORTRAIT_W } from '../art/portrait';
import { SCREEN_H, SCREEN_W } from '../engine/constants';
import { audio } from '../engine/audio';
import { wrap } from '../engine/fontdata';
import { font, type Bitmap } from '../engine/gfx';
import type { Input } from '../engine/input';
import type { Scene } from '../engine/scene';
import { drawWindow } from './window';

/** One page of dialogue. */
export interface Line {
  /** Speaker display name; omit for narration. */
  name?: string;
  text: string;
  portrait?: Bitmap | null;
  /** Show the box at the top of the screen (set automatically when the speaker is low on screen). */
  top?: boolean;
}

/** Box position chosen with L (top) / R (bottom) while a box is open (LoG2); null = follow the line. */
type BoxPos = 'top' | 'bottom' | null;

/** L moves the text box to the top of the screen, R to the bottom (LoG2). Returns the new override. */
function moveBox(input: Input, cur: BoxPos): BoxPos {
  if (input.pressed('L') && cur !== 'top') { audio.sfx('menuMove'); return 'top'; }
  if (input.pressed('R') && cur !== 'bottom') { audio.sfx('menuMove'); return 'bottom'; }
  return cur;
}

/** Whether a line's box sits at the top, given the player's L/R override. */
function atTop(line: Line, pos: BoxPos): boolean {
  return pos ? pos === 'top' : !!line.top;
}

const BOX_H = 52;
const LINES_PER_PAGE = 3;
const LINE_STEP = 11;
/** Text panel width when a portrait frame sits on the right (LoG2: ~70/25 split). */
const PANEL_W_PORTRAIT = 182;
const PORTRAIT_FRAME_W = 50;

/** Global text options (set from the Options menu / save data). speed 1..4, 4 = instant. */
export const textSettings = { speed: 2 };

function charsPerTick(): number {
  return [0, 0.5, 1.5, 3, 999][textSettings.speed] ?? 1.5;
}

/** Dark-blue panel with LoG2's scan-line texture. */
function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  drawWindow(ctx, x, y, w, h, { fill: '#101c40', alpha: 0.95 });
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let yy = y + 3; yy < y + h - 2; yy += 2) ctx.fillRect(x + 3, yy, w - 6, 1);
}

/** Draw the speaker header + rows + portrait frame. Shared by dialogue and choice prompts. */
function drawBox(ctx: CanvasRenderingContext2D, line: Line, rows: string[], shownChars: number, top = !!line.top): { y: number; panelW: number } {
  const y = top ? 3 : SCREEN_H - BOX_H - 3;
  const hasPortrait = !!line.portrait;
  const panelW = hasPortrait ? PANEL_W_PORTRAIT : SCREEN_W - 6;
  panel(ctx, 3, y, panelW, BOX_H);
  if (hasPortrait && line.portrait) {
    const fx = 3 + panelW + 3;
    drawWindow(ctx, fx, y, PORTRAIT_FRAME_W, BOX_H, { fill: '#283c78', alpha: 1 });
    ctx.drawImage(line.portrait, fx + Math.floor((PORTRAIT_FRAME_W - PORTRAIT_W) / 2), y + Math.floor((BOX_H - PORTRAIT_H) / 2));
  }
  let ty = y + 5;
  if (line.name) {
    font.draw(ctx, `${line.name.toUpperCase()}:`, 10, ty, PAL.gold, '#000');
    ty += 11;
  } else {
    ty += 5;
  }
  let left = shownChars;
  rows.forEach((r, i) => {
    if (left <= 0) return;
    const part = r.slice(0, Math.floor(left));
    left -= r.length;
    font.draw(ctx, part, 10, ty + i * LINE_STEP, PAL.white, '#000');
  });
  return { y, panelW };
}

function textWidth(line: Line): number {
  return (line.portrait ? PANEL_W_PORTRAIT : SCREEN_W - 6) - 16;
}

/**
 * LoG2-style dialogue box: dark-blue scan-lined text panel on the left with "NAME:" header,
 * a framed portrait on the right, typewriter text, ▼ prompt. A completes the page / advances; B fast-forwards.
 */
export class DialogueScene implements Scene {
  readonly transparent = true;
  private pages: Array<{ line: Line; rows: string[] }> = [];
  private page = 0;
  private shown = 0;
  private tick = 0;
  private pos: BoxPos = null;
  done = false;

  constructor(lines: Line[], private readonly onDone: () => void) {
    for (const line of lines) {
      const per = line.name ? LINES_PER_PAGE : LINES_PER_PAGE;
      const rows = wrap(line.text, textWidth(line));
      for (let i = 0; i < rows.length; i += per) this.pages.push({ line, rows: rows.slice(i, i + per) });
    }
    if (this.pages.length === 0) this.pages.push({ line: { text: '' }, rows: [''] });
  }

  private get total(): number {
    return this.pages[this.page].rows.reduce((a, r) => a + r.length, 0);
  }

  update(input: Input): void {
    if (this.done) return;
    this.tick++;
    this.pos = moveBox(input, this.pos);
    const fast = input.isDown('B');
    if (this.shown < this.total) {
      const before = this.shown;
      this.shown = Math.min(this.total, this.shown + (fast ? 8 : charsPerTick()));
      if (Math.floor(before / 4) !== Math.floor(this.shown / 4)) audio.sfx('text');
      if (input.pressed('A')) this.shown = this.total;
      return;
    }
    if (input.pressed('A') || (fast && this.tick % 8 === 0)) {
      if (this.page < this.pages.length - 1) {
        this.page++;
        this.shown = 0;
        audio.sfx('menuMove');
      } else {
        this.done = true;
        this.onDone();
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.done) return;
    const { line, rows } = this.pages[this.page];
    const { y, panelW } = drawBox(ctx, line, rows, this.shown, atTop(line, this.pos));
    if (this.shown >= this.total && Math.floor(this.tick / 16) % 2 === 0) {
      font.draw(ctx, '▼', panelW - 8, y + BOX_H - 11, PAL.white, '#000');
    }
  }
}

/**
 * A multiple-choice prompt shown with its question box. A prompt longer than one box is paged like dialogue
 * (A/B turn the page) and the options open with its last page, so the question itself is always on screen.
 */
export class ChoiceScene implements Scene {
  readonly transparent = true;
  private sel = 0;
  done = false;
  /** Pages of at most LINES_PER_PAGE rows; the options open on the last one (the prompt's last 3 rows). */
  private readonly pages: string[][] = [];
  private page = 0;
  private tick = 0;
  private pos: BoxPos = null;

  constructor(private readonly prompt: Line, private readonly options: string[], private readonly onPick: (i: number) => void) {
    // The options open with the prompt's last full box (where the question is); anything before it is paged first.
    const rows = wrap(prompt.text, textWidth(prompt));
    const lead = Math.max(0, rows.length - LINES_PER_PAGE);
    for (let i = 0; i < lead; i += LINES_PER_PAGE) this.pages.push(rows.slice(i, Math.min(lead, i + LINES_PER_PAGE)));
    this.pages.push(rows.length ? rows.slice(lead) : ['']);
  }

  /** Rows on the page showing now (the last page carries the options). */
  get rows(): string[] {
    return this.pages[this.page];
  }

  private get asking(): boolean {
    return this.page >= this.pages.length - 1;
  }

  update(input: Input): void {
    if (this.done) return;
    this.tick++;
    this.pos = moveBox(input, this.pos);
    if (!this.asking) {
      if (input.pressed('A') || input.pressed('B')) { this.page++; audio.sfx('menuMove'); }
      return;
    }
    if (input.repeat('up')) { this.sel = (this.sel + this.options.length - 1) % this.options.length; audio.sfx('menuMove'); }
    if (input.repeat('down')) { this.sel = (this.sel + 1) % this.options.length; audio.sfx('menuMove'); }
    if (input.pressed('A')) { this.done = true; audio.sfx('menuOk'); this.onPick(this.sel); }
    if (input.pressed('B') && this.options.length === 2) { this.done = true; audio.sfx('menuBack'); this.onPick(1); }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.done) return;
    const top = atTop(this.prompt, this.pos);
    const { y, panelW } = drawBox(ctx, this.prompt, this.rows, 9999, top);
    if (!this.asking) {
      if (Math.floor(this.tick / 16) % 2 === 0) font.draw(ctx, '▼', panelW - 8, y + BOX_H - 11, PAL.white, '#000');
      return;
    }
    const ow = Math.max(...this.options.map((o) => font.drawWidth(o))) + 22;
    const oh = this.options.length * 12 + 8;
    const ox = SCREEN_W - ow - 4;
    // Options sit on the far side of the box from the screen edge.
    const oy = top ? y + BOX_H + 2 : y - oh - 2;
    drawWindow(ctx, ox, oy, ow, oh);
    this.options.forEach((o, i) => {
      font.draw(ctx, o, ox + 14, oy + 5 + i * 12, i === this.sel ? PAL.gold : PAL.white, '#000');
      if (i === this.sel) font.draw(ctx, '▶', ox + 5, oy + 5 + i * 12, PAL.gold, '#000');
    });
  }
}
