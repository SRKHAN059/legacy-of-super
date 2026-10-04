import { DT } from './constants';

/**
 * Fixed-timestep loop on requestAnimationFrame. `update` runs at exactly 60 Hz
 * regardless of display refresh; `render` runs once per animation frame.
 */
export class Loop {
  private acc = 0;
  private last = 0;
  private running = false;
  private rafId = 0;
  /** Simulation speed multiplier (debug fast-forward). */
  speed = 1;
  /** Exceptions caught in update/render (the loop keeps running; repeats of one message are logged once). */
  errors = 0;
  private lastError = '';

  constructor(
    private readonly update: () => void,
    private readonly render: () => void,
  ) {}

  /** Start ticking. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      // Clamp long stalls (tab hidden, breakpoint) so we don't spiral.
      this.acc += Math.min(0.25, (now - this.last) / 1000) * this.speed;
      this.last = now;
      let steps = 0;
      try {
        while (this.acc >= DT && steps < 8 * this.speed) {
          this.acc -= DT;
          steps++;
          this.update();
        }
        this.render();
      } catch (err) {
        this.report(err);
      }
      // Always re-arm: one bad frame must not freeze the game.
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  /** Log a caught frame exception (identical repeats are counted, not re-logged every frame). */
  private report(err: unknown): void {
    this.errors++;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === this.lastError) return;
    this.lastError = msg;
    console.error('[loop] frame failed; still running', err);
  }

  /** Stop ticking. */
  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  /** Advance the simulation synchronously (automated tests / fast-forward). */
  step(n: number): void {
    for (let i = 0; i < n; i++) this.update();
    this.render();
  }
}
