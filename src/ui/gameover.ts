import { PAL } from '../art/color';
import { audio } from '../engine/audio';
import { SCREEN_H, SCREEN_W } from '../engine/constants';
import { font } from '../engine/gfx';
import type { Input } from '../engine/input';
import type { Scene } from '../engine/scene';
import type { Game } from '../game/game';
import { drawWindow } from './window';

/** GAME OVER: continue from the last save or return to the title (LoG2 has no lives). */
export class GameOverScene implements Scene {
  private t = 0;
  private sel = 0;

  constructor(private readonly game: Game) {
    audio.stopMusic();
  }

  update(input: Input): void {
    this.t++;
    if (this.t < 60) return;
    if (input.repeat('up') || input.repeat('down')) { this.sel ^= 1; audio.sfx('menuMove'); }
    if (input.pressed('A') || input.pressed('start')) {
      audio.sfx('menuOk');
      if (this.sel === 0 && this.game.continueGame(this.game.slot)) return;
      this.game.toTitle();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    const a = Math.min(1, this.t / 40);
    ctx.globalAlpha = a;
    font.drawCentered(ctx, 'G A M E   O V E R', SCREEN_W / 2, 56, '#e03030', '#300000');
    ctx.globalAlpha = 1;
    if (this.t < 60) return;
    drawWindow(ctx, 70, 84, 100, 34);
    const opts = ['Continue', 'Title Screen'];
    opts.forEach((o, i) => {
      font.draw(ctx, o, 90, 90 + i * 12, i === this.sel ? PAL.gold : PAL.white, '#000');
      if (i === this.sel) font.draw(ctx, '▶', 80, 90 + i * 12, PAL.gold, '#000');
    });
  }
}
