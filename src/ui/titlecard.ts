import { PAL } from '../art/color';
import { SCREEN_H, SCREEN_W } from '../engine/constants';
import { font } from '../engine/gfx';
import type { Input } from '../engine/input';
import type { Scene } from '../engine/scene';

/** Full-screen chapter card: "Chapter N" / title / subtitle over a starfield. */
export class TitleCardScene implements Scene {
  private t = 0;
  private closing = false;
  private readonly stars: Array<[number, number, number]> = [];

  constructor(private readonly head: string, private readonly title: string, private readonly sub: string | undefined, private readonly onDone: () => void) {
    for (let i = 0; i < 60; i++) this.stars.push([Math.floor(Math.random() * SCREEN_W), Math.floor(Math.random() * SCREEN_H), Math.random()]);
  }

  update(input: Input): void {
    this.t++;
    if (!this.closing && this.t > 60 && (input.pressed('A') || input.pressed('start') || this.t > 260)) {
      this.closing = true;
      this.t = 0;
    }
    if (this.closing && this.t > 24) this.onDone();
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    for (const [x, y, b] of this.stars) {
      ctx.fillStyle = b > 0.7 ? '#ffffff' : b > 0.4 ? '#8888b0' : '#444466';
      ctx.fillRect(x, y, 1, 1);
    }
    const a = this.closing ? 1 - this.t / 24 : Math.min(1, this.t / 30);
    ctx.globalAlpha = Math.max(0, a);
    font.drawCentered(ctx, this.head.toUpperCase(), SCREEN_W / 2, 58, PAL.uiLight, '#000');
    const w = Math.min(200, font.drawWidth(this.title) + 30);
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(Math.round((SCREEN_W - w) / 2), 70, w, 1);
    font.drawCentered(ctx, this.title, SCREEN_W / 2, 76, PAL.gold, '#402000');
    ctx.fillRect(Math.round((SCREEN_W - w) / 2), 89, w, 1);
    if (this.sub) font.drawCentered(ctx, this.sub, SCREEN_W / 2, 96, PAL.white, '#000');
    ctx.globalAlpha = 1;
  }
}
