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
      while (this.acc >= DT && steps < 8 * this.speed) {
        this.update();
        this.acc -= DT;
        steps++;
      }
      this.render();
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
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
