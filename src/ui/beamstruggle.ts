import { PAL, shade } from '../art/color';
import { audio } from '../engine/audio';
import { SCREEN_H, SCREEN_W } from '../engine/constants';
import { wrap } from '../engine/fontdata';
import { font, type Bitmap } from '../engine/gfx';
import type { Input } from '../engine/input';
import type { Scene } from '../engine/scene';

/** Options for a scripted beam struggle (LoG2's finale device). */
export interface StruggleOpts {
  heroName: string;
  foeName: string;
  heroColor: string;
  foeColor: string;
  heroPortrait: Bitmap | null;
  foePortrait: Bitmap | null;
  /** Taunts shown at the top while struggling. */
  lines?: string[];
  /** Opponent push strength per tick (0.1 easy … 0.35 brutal). */
  pressure?: number;
}

/**
 * Mash A to push the clash point toward the foe. The struggle cannot be lost — like LoG2's
 * scripted finales — the foe's surges just push back until the player wins.
 */
export class BeamStruggleScene implements Scene {
  readonly transparent = true;
  readonly done: Promise<void>;
  private resolve!: () => void;
  /** 0 = hero overwhelmed, 1 = foe overwhelmed. */
  private balance = 0.5;
  private t = 0;
  private surge = 0;
  private finished = 0;

  constructor(private readonly o: StruggleOpts) {
    this.done = new Promise((r) => (this.resolve = r));
    audio.sfx('beam');
  }

  update(input: Input): void {
    this.t++;
    if (this.finished) {
      this.finished++;
      if (this.finished > 70) this.resolve();
      return;
    }
    const pressure = this.o.pressure ?? 0.18;
    if (this.t % 180 === 0) this.surge = 40;
    const push = (pressure + (this.surge > 0 ? 0.25 : 0)) / 100;
    if (this.surge > 0) this.surge--;
    this.balance = Math.max(0.12, this.balance - push);
    if (input.pressed('A') || input.pressed('B')) {
      this.balance += 0.022;
      if (this.t % 2 === 0) audio.sfx('text');
    }
    if (this.t % 20 === 0) audio.sfx('charge');
    if (this.balance >= 1) {
      this.balance = 1;
      this.finished = 1;
      audio.sfx('explode');
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,10,0.55)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    const y = 82;
    const left = 40;
    const right = SCREEN_W - 40;
    const cx = Math.round(left + (right - left) * this.balance);
    const wob = this.t % 4 < 2 ? 1 : 0;
    const beam = (x0: number, x1: number, col: string) => {
      const w = 9 + wob;
      ctx.fillStyle = shade(col, 0.7);
      ctx.fillRect(Math.min(x0, x1), y - w / 2 - 2, Math.abs(x1 - x0), w + 4);
      ctx.fillStyle = col;
      ctx.fillRect(Math.min(x0, x1), y - w / 2, Math.abs(x1 - x0), w);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.min(x0, x1), y - 1, Math.abs(x1 - x0), 3);
    };
    beam(left, cx, this.o.heroColor);
    beam(cx, right, this.o.foeColor);
    const r = 12 + (this.t % 6 < 3 ? 2 : 0) + (this.finished ? this.finished : 0);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(this.balance > 0.5 ? this.o.heroColor : this.o.foeColor, 1.2);
    ctx.beginPath(); ctx.arc(cx, y, r * 0.6, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 6; i++) {
      const a = this.t * 0.3 + i;
      ctx.fillStyle = '#fff8c0';
      ctx.fillRect(Math.round(cx + Math.cos(a) * (r + 6)), Math.round(y + Math.sin(a) * (r + 6)), 2, 2);
    }
    if (this.o.heroPortrait) ctx.drawImage(this.o.heroPortrait, 4, y - 18);
    if (this.o.foePortrait) {
      ctx.save();
      ctx.translate(SCREEN_W - 4, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(this.o.foePortrait, 0, y - 18);
      ctx.restore();
    }
    font.draw(ctx, this.o.heroName.toUpperCase(), 6, y + 20, PAL.gold, '#000');
    font.drawRight(ctx, this.o.foeName.toUpperCase(), SCREEN_W - 6, y + 20, '#f8a0a0', '#000');
    // Balance bar.
    ctx.fillStyle = '#000';
    ctx.fillRect(39, 129, 162, 8);
    ctx.fillStyle = this.o.foeColor;
    ctx.fillRect(40, 130, 160, 6);
    ctx.fillStyle = this.o.heroColor;
    ctx.fillRect(40, 130, Math.round(160 * this.balance), 6);
    const line = this.o.lines?.length ? this.o.lines[Math.floor(this.t / 150) % this.o.lines.length] : '';
    if (line) wrap(line, SCREEN_W - 12).slice(0, 3).forEach((r, i) => font.drawCentered(ctx, r, SCREEN_W / 2, 14 + i * 10, PAL.white, '#000'));
    if (!this.finished && this.t % 30 < 20) font.drawCentered(ctx, this.surge > 0 ? 'HOLD ON! MASH A!' : 'MASH A!', SCREEN_W / 2, 144, this.surge > 0 ? '#f86060' : PAL.gold, '#000');
    if (this.finished) {
      ctx.globalAlpha = Math.min(1, this.finished / 40);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      ctx.globalAlpha = 1;
    }
  }
}
