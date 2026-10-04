import type { Input } from './input';

/** A screen-level state: title, field, menu, battle overlay, etc. */
export interface Scene {
  /** Advance one fixed tick. */
  update(input: Input): void;
  /** Draw into the 240x160 back buffer. */
  render(ctx: CanvasRenderingContext2D): void;
  /** When true, the scene below is also rendered (menus/dialogue over the field). */
  readonly transparent?: boolean;
  /** Called when the scene becomes the top of the stack. */
  enter?(): void;
  /** Called when the scene is removed. */
  exit?(): void;
}

/** Stack of scenes; only the top one updates, transparent ones render over those below. */
export class SceneStack {
  private readonly stack: Scene[] = [];

  /** Current top scene, if any. */
  get top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  /** Number of scenes on the stack. */
  get size(): number {
    return this.stack.length;
  }

  /** Push a scene over the current one. */
  push(s: Scene): void {
    this.stack.push(s);
    s.enter?.();
  }

  /** Pop the top scene. */
  pop(): Scene | undefined {
    const s = this.stack.pop();
    s?.exit?.();
    this.top?.enter?.();
    return s;
  }

  /** Remove a specific scene wherever it sits. */
  remove(s: Scene): void {
    const i = this.stack.indexOf(s);
    if (i < 0) return;
    const wasTop = i === this.stack.length - 1;
    this.stack.splice(i, 1);
    s.exit?.();
    if (wasTop) this.top?.enter?.();
  }

  /** Replace the whole stack with one scene. */
  replace(s: Scene): void {
    while (this.stack.length) this.stack.pop()?.exit?.();
    this.push(s);
  }

  /** Update the top scene. */
  update(input: Input): void {
    this.top?.update(input);
  }

  /** Render from the lowest visible scene upward. */
  render(ctx: CanvasRenderingContext2D): void {
    let start = this.stack.length - 1;
    while (start > 0 && this.stack[start].transparent) start--;
    for (let i = Math.max(0, start); i < this.stack.length; i++) this.stack[i].render(ctx);
  }
}
