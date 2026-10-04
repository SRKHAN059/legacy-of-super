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
  /** Show the box at the top of the screen (when the speaker is low on screen). */
  top?: boolean;
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
function drawBox(ctx: CanvasRenderingContext2D, line: Line, rows: string[], shownChars: number): { y: number; panelW: number } {
  const y = line.top ? 3 : SCREEN_H - BOX_H - 3;
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
    const { y, panelW } = drawBox(ctx, line, rows, this.shown);
    if (this.shown >= this.total && Math.floor(this.tick / 16) % 2 === 0) {
      font.draw(ctx, '▼', panelW - 8, y + BOX_H - 11, PAL.white, '#000');
    }
  }
}

/** A multiple-choice prompt shown with its question box. */
export class ChoiceScene implements Scene {
  readonly transparent = true;
  private sel = 0;
  done = false;
  private readonly rows: string[];

  constructor(private readonly prompt: Line, private readonly options: string[], private readonly onPick: (i: number) => void) {
    this.rows = wrap(prompt.text, textWidth(prompt)).slice(0, LINES_PER_PAGE);
  }

  update(input: Input): void {
    if (this.done) return;
    if (input.repeat('up')) { this.sel = (this.sel + this.options.length - 1) % this.options.length; audio.sfx('menuMove'); }
    if (input.repeat('down')) { this.sel = (this.sel + 1) % this.options.length; audio.sfx('menuMove'); }
    if (input.pressed('A')) { this.done = true; audio.sfx('menuOk'); this.onPick(this.sel); }
    if (input.pressed('B') && this.options.length === 2) { this.done = true; audio.sfx('menuBack'); this.onPick(1); }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.done) return;
    const { y } = drawBox(ctx, this.prompt, this.rows, 9999);
    const ow = Math.max(...this.options.map((o) => font.drawWidth(o))) + 22;
    const oh = this.options.length * 12 + 8;
    const ox = SCREEN_W - ow - 4;
    const oy = y - oh - 2;
    drawWindow(ctx, ox, oy, ow, oh);
    this.options.forEach((o, i) => {
      font.draw(ctx, o, ox + 14, oy + 5 + i * 12, i === this.sel ? PAL.gold : PAL.white, '#000');
      if (i === this.sel) font.draw(ctx, '▶', ox + 5, oy + 5 + i * 12, PAL.gold, '#000');
    });
  }
}
