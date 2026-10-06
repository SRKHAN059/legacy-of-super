import { PAL } from '../art/color';
import { portrait, spriteSet } from '../art/registry';
import { scanEntries, scanRecord } from '../content/scans';
import { audio } from '../engine/audio';
import { SCREEN_H, SCREEN_W } from '../engine/constants';
import { measure, wrap } from '../engine/fontdata';
import { font } from '../engine/gfx';
import type { Input } from '../engine/input';
import type { Scene } from '../engine/scene';
import type { Game } from '../game/game';

interface Entry {
  id: string;
  name: string;
  sprite: string;
  hp: number | string;
  str: number | string;
  pow: number | string;
  end: number | string;
  kind: string;
  desc: string;
  npc: boolean;
}

/** Width of the name column; longer names are cut with "..." so they never run into the detail panel. */
const LIST_W = 96;

/** `text`, shortened with a trailing "..." until it fits `maxW` pixels. */
function fit(text: string, maxW: number): string {
  if (measure(text) <= maxW) return text;
  let s = text;
  while (s.length > 1 && measure(`${s}...`) > maxW) s = s.slice(0, -1);
  return `${s.trimEnd()}...`;
}

/** Capsule Corp computer: browse every Scouter scan (LoG2's database), alphabetical. */
export class ScouterDbScene implements Scene {
  readonly done: Promise<void>;
  private resolve!: () => void;
  private sel = 0;
  private t = 0;
  private readonly entries: Entry[];

  constructor(game: Game) {
    this.done = new Promise((r) => (this.resolve = r));
    // Stored ids resolve through the shared table (scanEntries), so an old id for a variant sprite files under its base
    // character and this list always has as many entries as the pause screen's scan count.
    this.entries = scanEntries(game.state.data.scans).map((id): Entry => {
      const r = scanRecord(id);
      const e = r.entry;
      return { id: r.id, name: e.name, sprite: r.sprite, hp: e.hp, str: e.str, pow: e.pow, end: e.end, kind: e.kind ?? '', desc: e.desc, npc: r.npc };
    }).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    audio.sfx('menuOk');
  }

  update(input: Input): void {
    this.t++;
    const n = this.entries.length;
    if (input.pressed('B') || input.pressed('start')) { audio.sfx('menuBack'); this.resolve(); return; }
    if (!n) return;
    if (input.repeat('up')) { this.sel = (this.sel + n - 1) % n; audio.sfx('menuMove'); }
    if (input.repeat('down')) { this.sel = (this.sel + 1) % n; audio.sfx('menuMove'); }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#041808';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    font.draw(ctx, `SCOUTER DATABASE  ${this.entries.length} ENTRIES`, 6, 4, '#80f8a0', '#000');
    if (!this.entries.length) { font.drawCentered(ctx, 'No scans recorded. Use SELECT in the field.', SCREEN_W / 2, 70, '#c8f8d0'); return; }
    const start = Math.max(0, Math.min(this.sel - 5, this.entries.length - 12));
    this.entries.slice(start, start + 12).forEach((e, i) => {
      const idx = start + i;
      font.draw(ctx, fit(e.name, LIST_W), 10, 16 + i * 11, idx === this.sel ? '#f8f040' : '#80c890', '#000');
    });
    const e = this.entries[this.sel];
    ctx.strokeStyle = '#40f070';
    ctx.strokeRect(110.5, 15.5, 124, 138);
    let set;
    try { set = spriteSet(e.sprite); } catch { set = null; }
    const por = e.npc ? portrait(e.sprite) : null;
    if (por) ctx.drawImage(por, 116, 20);
    else if (set) { const b = set.idle.down; ctx.drawImage(b, 132 - b.width / 2, 56 - b.height); }
    const rows: Array<[string, number | string]> = [['HP', e.hp], ['STR', e.str], ['POW', e.pow], ['END', e.end]];
    rows.forEach(([k, v], i) => {
      font.draw(ctx, k, 160, 20 + i * 11, '#40c060', '#000');
      font.drawRight(ctx, String(v), 230, 20 + i * 11, '#c8f8d0', '#000');
    });
    if (e.kind) font.draw(ctx, fit(e.kind, 118), 114, 58, '#60d880', '#000');
    font.drawLines(ctx, wrap(e.desc, 118).slice(0, 7), 114, 70, '#c8f8d0', '#000', 11);
    font.draw(ctx, 'B: exit', 6, SCREEN_H - 10, '#80c890', '#000');
    void PAL;
  }
}
