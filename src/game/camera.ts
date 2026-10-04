import { SCREEN_H, SCREEN_W } from '../engine/constants';
import { clamp, type Vec } from '../engine/math';

/** Follows a target, clamped to map bounds, with optional screen shake and scripted pans. */
export class Camera {
  x = 0;
  y = 0;
  private shakeT = 0;
  private shakeMag = 0;
  private pan: { from: Vec; to: Vec; t: number; dur: number } | null = null;
  /** When set, the camera holds this point instead of following. */
  hold: Vec | null = null;

  constructor(public mapW: number, public mapH: number) {}

  /** Start a screen shake. */
  shake(frames: number, magnitude = 2): void {
    this.shakeT = Math.max(this.shakeT, frames);
    this.shakeMag = Math.max(this.shakeMag, magnitude);
  }

  /** Smoothly pan to centre on a world point over `frames` ticks. Resolves via `panning`. */
  panTo(to: Vec, frames: number): void {
    this.pan = { from: { x: this.x + SCREEN_W / 2, y: this.y + SCREEN_H / 2 }, to, t: 0, dur: Math.max(1, frames) };
  }

  /** True while a pan is in progress. */
  get panning(): boolean {
    return this.pan !== null;
  }

  /** Advance one tick toward `target` (world point to centre on). */
  update(target: Vec): void {
    let cx: number;
    let cy: number;
    if (this.pan) {
      this.pan.t++;
      const k = this.pan.t / this.pan.dur;
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      cx = this.pan.from.x + (this.pan.to.x - this.pan.from.x) * e;
      cy = this.pan.from.y + (this.pan.to.y - this.pan.from.y) * e;
      if (this.pan.t >= this.pan.dur) {
        this.hold = this.pan.to;
        this.pan = null;
      }
    } else if (this.hold) {
      cx = this.hold.x;
      cy = this.hold.y;
    } else {
      cx = target.x;
      cy = target.y;
    }
    this.x = clamp(Math.round(cx - SCREEN_W / 2), 0, Math.max(0, this.mapW - SCREEN_W));
    this.y = clamp(Math.round(cy - SCREEN_H / 2), 0, Math.max(0, this.mapH - SCREEN_H));
    // Maps smaller than the screen are centred.
    if (this.mapW < SCREEN_W) this.x = -Math.floor((SCREEN_W - this.mapW) / 2);
    if (this.mapH < SCREEN_H) this.y = -Math.floor((SCREEN_H - this.mapH) / 2);
    if (this.shakeT > 0) this.shakeT--;
    else this.shakeMag = 0;
  }

  /** Release a scripted hold so the camera follows the player again. */
  release(): void {
    this.hold = null;
    this.pan = null;
  }

  /** Render offset including shake. */
  get ox(): number {
    return this.x + (this.shakeT > 0 ? Math.round((Math.random() * 2 - 1) * this.shakeMag) : 0);
  }

  /** Render offset including shake. */
  get oy(): number {
    return this.y + (this.shakeT > 0 ? Math.round((Math.random() * 2 - 1) * this.shakeMag) : 0);
  }
}
