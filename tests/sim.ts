import '../src/content';
import type { CharId } from '../src/content/characters';
import { resolveMap } from '../src/content/registry';
import { terrainSolid } from '../src/art/tiles';
import { TILE } from '../src/engine/constants';
import { Input } from '../src/engine/input';
import type { Enemy } from '../src/game/enemy';
import { Game } from '../src/game/game';
import { parseGrid } from '../src/game/world';
import type { ScriptCtx } from '../src/game/script';

declare const setImmediate: (cb: () => void) => void;
const flush = () => new Promise<void>((r) => setImmediate(r));

/** What `Sim.grind` took: the hero's levels and EXP before/after, regular enemies killed, map visits. */
export interface GrindLog {
  hero: CharId;
  from: number;
  to: number;
  exp: number;
  kills: number;
  visits: number;
  maps: string[];
}

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
  /** The bot wins every fight on its own (off while `grind` fights enemy by enemy). */
  autoFight = true;

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
    } else if (/Credits/.test(top)) {
      this.pressA = !this.pressA;
      this.input.inject('start', this.pressA);
      this.input.inject('A', true);
    } else {
      this.input.inject('A', false);
      this.input.inject('start', false);
    }
    const f = g.field;
    if (f && g.allowControl) {
      for (const e of this.autoFight ? f.enemies : []) {
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

  /** Tiles the hero can walk to from where they stand on the current field (`"x,y"` keys; gates and props block). */
  reach(): Set<string> {
    const f = this.game.field;
    const seen = new Set<string>();
    if (!f) return seen;
    const grid = parseGrid(f.def);
    const W = grid[0].length;
    const H = grid.length;
    const free = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H
      && !f.col.blocked({ x: x * TILE + 3, y: y * TILE + 8, w: 10, h: 6 });
    // The hero's own tile, or the tiles around it when the hero's box straddles a solid edge (a save disc, a wall).
    const px = Math.floor(f.player.x / TILE);
    const py = Math.floor((f.player.y - 8) / TILE);
    const queue: Array<[number, number]> = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) queue.push([px + dx, py + dy]);
    while (queue.length) {
      const [x, y] = queue.pop() as [number, number];
      const k = `${x},${y}`;
      if (seen.has(k) || !free(x, y)) continue;
      seen.add(k);
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return seen;
  }

  /** Whether an enemy's home tile is within striking distance (2 tiles) of a tile in `reach`. */
  static inReach(reach: Set<string>, e: Enemy): boolean {
    const ex = Math.floor(e.homeX / TILE);
    const ey = Math.floor((e.homeY - 8) / TILE);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (reach.has(`${ex + dx},${ey + dy}`)) return true;
    return false;
  }

  /** Tick until no script is running (map-entry scripts finish). */
  async idle(max = 20000): Promise<void> {
    let calm = 0;
    for (let i = 0; i < max && calm < 6; i += 5) {
      await this.tick(5);
      calm = this.game.lockDepth === 0 ? calm + 1 : 0;
    }
  }

  /**
   * Grind like a player until the active hero reaches `level`: walk into each `[map, x, y]` of `zone` in turn
   * (regular enemies respawn on every entry, LoG2 §5.8) and fight every one the hero can reach on foot from there,
   * one at a time, through the real damage and kill path (Field.applyDamage -> killEnemy -> killExp). Bosses,
   * one-off spawns and anything behind a closed gate or across water are left alone. Like the bot in scripted fights,
   * the hero is kept at full HP: this measures the EXP a gate costs, not survival. Throws if `maxVisits` map
   * entries are not enough, so a gate tuned out of reach fails loudly instead of hanging.
   */
  async grind(level: number, zone: ReadonlyArray<readonly [string, number, number]>, maxVisits = 40): Promise<GrindLog> {
    const st = this.game.state;
    const hero = st.data.active;
    const c = st.char(hero);
    const log: GrindLog = { hero, from: c.level, to: c.level, exp: 0, kills: 0, visits: 0, maps: [] };
    const exp0 = c.exp;
    const auto = this.autoFight;
    this.autoFight = false;
    try {
      while (c.level < level) {
        if (log.visits >= maxVisits) throw new Error(`${hero} still L${c.level} (< ${level}) after ${log.visits} visits of ${zone.map((z) => z[0]).join(', ')}`);
        const [map, x, y] = zone[log.visits % zone.length];
        this.start(map, x, y);
        log.visits++;
        if (!log.maps.includes(map)) log.maps.push(map);
        await this.idle();
        const f = this.game.field;
        if (!f) throw new Error(`no field on ${map}`);
        const reach = this.reach();
        const down = (e: Enemy) => e.dead || e.state === 'dying';
        const targets = f.enemies.filter((e) => !down(e) && !e.isBoss && !e.uid && !e.def.invulnerable && e.def.exp > 0 && Sim.inReach(reach, e));
        for (const e of targets) {
          for (let i = 0; i < 120 && !down(e); i++) {
            // The player has the controls in free roam (no script running) or in a scripted fight.
            if (this.game.lockDepth === 0 || this.game.allowControl) {
              f.player.cs.hp = f.player.cs.hpMax;
              if (!e.ended) f.applyDamage(e, 255, 400, { x: 0, y: 0 }, 0, false);
            }
            await this.tick(1);
          }
          if (down(e)) log.kills++;
          if (c.level >= level) break;
        }
      }
    } finally {
      this.autoFight = auto;
    }
    log.to = c.level;
    log.exp = c.exp - exp0;
    return log;
  }

  /** Run a script to completion. Returns false on timeout. */
  async run(id: string, ctx: ScriptCtx = {}, maxTicks = 20000): Promise<boolean> {
    let done = false;
    void this.game.runScript(id, ctx).then(() => { done = true; });
    for (let i = 0; i < maxTicks && !done; i += 10) await this.tick(10);
    return done;
  }
}
