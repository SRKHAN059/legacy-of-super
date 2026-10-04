import '../src/content';
import { resolveMap } from '../src/content/registry';
import { terrainSolid } from '../src/art/tiles';
import { Input } from '../src/engine/input';
import { Game } from '../src/game/game';
import { parseGrid } from '../src/game/world';
import type { ScriptCtx } from '../src/game/script';

declare const setImmediate: (cb: () => void) => void;
const flush = () => new Promise<void>((r) => setImmediate(r));

/**
 * Headless game driver for tests. A simple bot advances dialogue (A), picks the first choice,
 * and auto-resolves fights so story scripts can run start to finish without a human.
 */
export class Sim {
  readonly input = new Input(null);
  readonly game = new Game(this.input);
  readonly errors: string[] = [];
  private pressA = false;
  /** Choice index the bot picks (cycled per prompt when `choiceCycle` is set). */
  choice = 0;

  constructor() {
    const orig = console.error;
    console.error = (...args: unknown[]) => {
      this.errors.push(args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : String(a))).join(' '));
      void orig;
    };
  }

  /** Start on a map at the first walkable tile near (x, y) (default: map centre). */
  start(mapId: string, x?: number, y?: number): void {
    const def = resolveMap(mapId);
    if (!def) throw new Error(`no map ${mapId}`);
    const grid = parseGrid(def);
    const cx = x ?? Math.floor(grid[0].length / 2);
    const cy = y ?? Math.floor(grid.length / 2);
    let best: [number, number] = [cx, cy];
    let bd = Infinity;
    grid.forEach((row, ty) => row.forEach((t, tx) => {
      if (terrainSolid(t)) return;
      const d = Math.hypot(tx - cx, ty - cy);
      if (d < bd) { bd = d; best = [tx, ty]; }
    }));
    this.game.startField(mapId, best[0], best[1], 'down');
  }

  private bot(): void {
    const g = this.game;
    const top = g.scenes.top?.constructor.name ?? '';
    if (/Dialogue|TitleCard|GameOver|BeamStruggle/.test(top)) {
      this.pressA = !this.pressA;
      this.input.inject('A', this.pressA);
    } else if (/Choice/.test(top)) {
      this.input.inject('A', false);
      const c = g.scenes.top as unknown as { sel: number };
      c.sel = this.choice;
      this.pressA = !this.pressA;
      this.input.inject('A', this.pressA);
    } else {
      this.input.inject('A', false);
    }
    const f = g.field;
    if (f && g.allowControl) {
      for (const e of f.enemies) {
        if (e.dead || e.state === 'dying' || e.def.invulnerable || e.ended) continue;
        f.applyDamage(e, 255, 400, { x: 0, y: 0 }, 0, false);
      }
      if (f.timer) f.timer.frames = 0;
      f.player.cs.hp = f.player.cs.hpMax;
    }
  }

  /** Advance n ticks with the bot driving input. */
  async tick(n = 1): Promise<void> {
    for (let i = 0; i < n; i++) {
      this.bot();
      this.input.poll();
      this.game.scenes.update(this.input);
      await flush();
    }
  }

  /** Run a script to completion. Returns false on timeout. */
  async run(id: string, ctx: ScriptCtx = {}, maxTicks = 20000): Promise<boolean> {
    let done = false;
    void this.game.runScript(id, ctx).then(() => { done = true; });
    for (let i = 0; i < maxTicks && !done; i += 10) await this.tick(10);
    return done;
  }
}
