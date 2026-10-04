import { PAL } from '../art/color';
import { spriteSet } from '../art/registry';
import { SCREEN_H, SCREEN_W } from '../engine/constants';
import { font } from '../engine/gfx';
import type { Input } from '../engine/input';
import type { Scene } from '../engine/scene';

/** Scrolling ending credits over a starfield with the cast parading along the bottom. */
export class CreditsScene implements Scene {
  readonly done: Promise<void>;
  private resolve!: () => void;
  private t = 0;
  private readonly stars: Array<[number, number, number]> = [];
  private readonly parade = ['goku', 'vegeta', 'gohan', 'futureTrunks', 'piccolo', 'android17', 'frieza', 'krillin', 'android18', 'tien', 'roshi', 'beerus', 'whis', 'bulma', 'chichi', 'videl', 'pan', 'goten', 'trunksKid', 'mrSatan', 'majinBuu'];

  constructor(private readonly lines: string[]) {
    this.done = new Promise((r) => (this.resolve = r));
    for (let i = 0; i < 80; i++) this.stars.push([Math.random() * SCREEN_W, Math.random() * SCREEN_H, 0.2 + Math.random()]);
  }

  private get length(): number {
    return this.lines.length * 14 + SCREEN_H + 40;
  }

  update(input: Input): void {
    this.t++;
    const speed = input.isDown('A') ? 3 : 0.5;
    this.t += speed - 1;
    if (this.t > this.length * 2 || (this.t > 120 && input.pressed('start'))) this.resolve();
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#04040c';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    for (const s of this.stars) {
      s[0] -= s[2] * 0.3;
      if (s[0] < 0) s[0] += SCREEN_W;
      ctx.fillStyle = s[2] > 0.9 ? '#ffffff' : '#6868a0';
      ctx.fillRect(Math.round(s[0]), Math.round(s[1]), 1, 1);
    }
    const scroll = this.t / 2;
    this.lines.forEach((l, i) => {
      const y = Math.round(SCREEN_H - scroll + i * 14);
      if (y < -10 || y > SCREEN_H - 36) return;
      const head = l.startsWith('#');
      font.drawCentered(ctx, head ? l.slice(1) : l, SCREEN_W / 2, y, head ? PAL.gold : PAL.white, '#000');
    });
    // Cast parade.
    ctx.fillStyle = '#101020';
    ctx.fillRect(0, SCREEN_H - 34, SCREEN_W, 34);
    this.parade.forEach((id, i) => {
      const x = Math.round(((i * 28 - this.t * 0.4) % (this.parade.length * 28) + this.parade.length * 28) % (this.parade.length * 28)) - 24;
      if (x < -24 || x > SCREEN_W) return;
      const set = spriteSet(id);
      const step = Math.floor((this.t + i * 7) / 10) % 4;
      ctx.drawImage(set[step === 0 ? 'walk1' : step === 2 ? 'walk2' : 'idle'].right, x, SCREEN_H - 34);
    });
  }
}
