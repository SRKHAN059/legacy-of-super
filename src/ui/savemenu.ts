import { PAL } from '../art/color';
import { portrait } from '../art/registry';
import { CHARACTERS } from '../content/characters';
import { audio } from '../engine/audio';
import { SCREEN_H } from '../engine/constants';
import { font } from '../engine/gfx';
import type { Input } from '../engine/input';
import type { Scene } from '../engine/scene';
import type { Game } from '../game/game';
import { drawWindow } from './window';

type Mode = 'root' | 'saved' | 'switch' | 'failed';

/** Capsule Corp save point: Save / Switch Character (LoG2 §8.3). */
export class SaveMenu implements Scene {
  readonly transparent = true;
  readonly done: Promise<void>;
  private resolve!: () => void;
  private mode: Mode = 'root';
  private sel = 0;
  private t = 0;

  constructor(private readonly game: Game) {
    this.done = new Promise((r) => (this.resolve = r));
    audio.sfx('save');
  }

  private get options(): string[] {
    const o = ['Save'];
    if (this.game.state.party.length > 1 && !this.game.state.flag('noSwitch')) o.push('Switch Character');
    o.push('Cancel');
    return o;
  }

  update(input: Input): void {
    this.t++;
    if (this.mode === 'saved' || this.mode === 'failed') {
      if (input.pressed('A') || input.pressed('B')) this.resolve();
      return;
    }
    if (this.mode === 'switch') {
      const party = this.game.state.party;
      if (input.repeat('up')) { this.sel = (this.sel + party.length - 1) % party.length; audio.sfx('menuMove'); }
      if (input.repeat('down')) { this.sel = (this.sel + 1) % party.length; audio.sfx('menuMove'); }
      if (input.pressed('B')) { this.mode = 'root'; this.sel = 1; audio.sfx('menuBack'); }
      if (input.pressed('A')) {
        const c = party[this.sel];
        audio.sfx('teleport');
        this.game.switchCharacter(c.id);
        this.game.field?.fx.explode(this.game.field.player.x, this.game.field.player.y - 12, 14, CHARACTERS[c.id].color);
        this.resolve();
      }
      return;
    }
    const opts = this.options;
    if (input.repeat('up')) { this.sel = (this.sel + opts.length - 1) % opts.length; audio.sfx('menuMove'); }
    if (input.repeat('down')) { this.sel = (this.sel + 1) % opts.length; audio.sfx('menuMove'); }
    if (input.pressed('B')) { audio.sfx('menuBack'); this.resolve(); return; }
    if (input.pressed('A')) {
      const o = opts[this.sel];
      if (o === 'Save') {
        // Saving restores nothing in LoG2, but we top up nothing either — faithful.
        const ok = this.game.saveGame();
        this.mode = ok ? 'saved' : 'failed';
        audio.sfx(ok ? 'save' : 'denied');
      } else if (o === 'Switch Character') {
        this.mode = 'switch';
        this.sel = Math.max(0, this.game.state.party.findIndex((c) => c.id === this.game.state.data.active));
        audio.sfx('menuOk');
      } else {
        audio.sfx('menuBack');
        this.resolve();
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.mode === 'saved' || this.mode === 'failed') {
      // With browser storage blocked the save lives in memory: say so, so nobody closes the tab trusting it.
      const sessionOnly = this.mode === 'saved' && !this.game.saves.persistent;
      drawWindow(ctx, 50, 60, 140, sessionOnly ? 37 : 26);
      font.drawCentered(ctx, this.mode === 'saved' ? `Saved to File ${this.game.slot + 1}.` : 'Could not save!', 120, 69, this.mode === 'saved' ? PAL.white : '#f86060', '#000');
      if (sessionOnly) font.drawCentered(ctx, '(until this tab closes)', 120, 80, '#f8c060', '#000');
      return;
    }
    if (this.mode === 'switch') {
      const party = this.game.state.party;
      const h = party.length * 22 + 10;
      const y = Math.max(4, Math.floor((SCREEN_H - h) / 2));
      drawWindow(ctx, 40, y, 160, h);
      party.forEach((c, i) => {
        const yy = y + 5 + i * 22;
        const def = CHARACTERS[c.id];
        const por = portrait(c.outfit ?? def.sprite);
        if (por) ctx.drawImage(por, 4, 6, 24, 20, 56, yy, 24, 20);
        font.draw(ctx, def.name, 86, yy + 2, i === this.sel ? PAL.gold : PAL.white, '#000');
        font.draw(ctx, `Lv ${c.level}`, 86, yy + 11, '#a8c8f8', '#000');
        if (c.id === this.game.state.data.active) font.drawRight(ctx, 'NOW', 192, yy + 6, '#60e060', '#000');
        if (i === this.sel) font.draw(ctx, '▶', 46, yy + 6, PAL.gold, '#000');
      });
      return;
    }
    const opts = this.options;
    const h = opts.length * 12 + 10;
    drawWindow(ctx, 70, 50, 100, h);
    opts.forEach((o, i) => {
      font.draw(ctx, o, 88, 56 + i * 12, i === this.sel ? PAL.gold : PAL.white, '#000');
      if (i === this.sel) font.draw(ctx, '▶', 77, 56 + i * 12, PAL.gold, '#000');
    });
  }
}
