import '../src/content';
import type { CharId } from '../src/content/characters';
import { resolveMap } from '../src/content/registry';
import { terrainSolid } from '../src/art/tiles';
import { TILE } from '../src/engine/constants';
import { Input } from '../src/engine/input';
import type { Enemy } from '../src/game/enemy';
import { Game } from '../src/game/game';
import { parseGrid } from '../src/game/world';
import { ScriptApi, type FightOpts, type FightResult, type ScriptCtx } from '../src/game/script';
import type { Dir } from '../src/engine/math';
// @ts-expect-error -- Node built-in; the project ships no @types/node (only the opt-in fight recorder writes files).
import { writeFileSync } from 'node:fs';

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
  /**
   * Fair play: the bot only reads dialogue and menus. It leaves fights, the hero's HP and survive timers alone, so a
   * `driver` (tests/fairbot.ts) can play them with real input.
   */
  fair = false;
  /** Called every tick after the dialogue bot and before input is polled: inject the buttons a player would hold. */
  driver: ((sim: Sim) => void) | null = null;

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
    if (f && g.allowControl && !this.fair) {
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
      this.driver?.(this);
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

// ------------------------------------------------------------------------------------------------ fight recorder

/** A scripted fight (`ScriptApi.fight`) or field battle (`clearEnemies` / `waitDefeat`) seen by `recordFights`. */
export interface RecordedFight {
  /** Order of the fight in the whole recording (0-based). */
  seq: number;
  /** 'boss' = `fight`, 'wave' = `clearEnemies` / `waitDefeat`. */
  kind: 'boss' | 'wave';
  /** Boss enemy type ('' for a wave). */
  type: string;
  opts: FightOpts;
  map: string;
  chapter: number;
  hero: CharId;
  level: number;
  /** Enemy types standing on the field when the fight began (a wave's roster). */
  roster: string[];
  /** Outcome; 'cleared' for a wave, null while the fight is still running. */
  result: FightResult | 'cleared' | null;
}

/**
 * The top-level script a fight ran inside (the one `Game.runScript` started from a trigger, a talk, a map entry or a
 * test), with the save exactly as it stood when that script started: replaying it re-creates the fight in context
 * (tests/fairbot.ts).
 */
export interface RecordedRoot {
  /** Which Game instance ran it (0 = the first one the recording process created). */
  game: number;
  script: string;
  map: string;
  /** Hero position in world pixels, and facing, when the script started. */
  x: number;
  y: number;
  dir: Dir;
  /** Map NPC (definition id) the script was started by, if any. */
  npc: string | null;
  /** The script is one of its map's onEnter scripts (entering the map replays it). */
  onEnter: boolean;
  /** `JSON.stringify(state.data)` when the script started. */
  save: string;
  /** Fragile quest object the hero was carrying (field state, not part of the save). */
  carrying: { label: string; onBreak?: string } | null;
  fights: RecordedFight[];
}

/**
 * Record every scripted fight to `file` (JSON array of RecordedRoot, rewritten after every fight). Patches
 * Game.prototype.runScript and the ScriptApi fight calls until the returned `stop` is called; LOS_RECORD_FIGHTS=<file>
 * records for the whole process (set it while running a test that plays the story, e.g. tests/full_game.test.ts).
 * `stop` puts back every method the recorder still owns; one that something patched on top of it since (the fair
 * bot's fight hooks) keeps its wrapper, which from then on passes straight through, so no later test records.
 */
export function recordFights(file: string): () => void {
  /** Each top-level script gets its own copy of the context object; nested `s.call` scripts share it. */
  const roots = new WeakMap<object, RecordedRoot>();
  const games = new WeakMap<Game, number>();
  const out: RecordedRoot[] = [];
  let seq = 0;
  let nextGame = 0;
  let on = true;
  const save = (): void => writeFileSync(file, JSON.stringify(out));

  const runScript = Game.prototype.runScript;
  const recRunScript = function (this: Game, id: string, ctx: ScriptCtx = {}): Promise<void> {
    if (!on) return runScript.call(this, id, ctx);
    const c: ScriptCtx = { ...ctx };
    const f = this.field;
    if (f) {
      if (!games.has(this)) games.set(this, nextGame++);
      const enter = f.def.onEnter;
      roots.set(c, {
        game: games.get(this) ?? 0, script: id, map: f.def.id, x: f.player.x, y: f.player.y, dir: f.player.dir,
        npc: ctx.npc?.def.id ?? null, onEnter: (Array.isArray(enter) ? enter : enter ? [enter] : []).includes(id),
        save: JSON.stringify(this.state.data), carrying: f.carrying ? { ...f.carrying } : null, fights: [],
      });
    }
    return runScript.call(this, id, c);
  };
  Game.prototype.runScript = recRunScript;

  const begin = (s: ScriptApi, kind: RecordedFight['kind'], type: string, opts: FightOpts): RecordedFight | null => {
    if (!on) return null;
    const root = roots.get(s.ctx);
    const f = (s as unknown as { game: Game }).game.field;
    if (!root || !f) return null;
    const hero = s.state.hero;
    const rec: RecordedFight = {
      seq: seq++, kind, type, opts: { ...opts }, map: f.def.id, chapter: s.state.data.chapter, hero: hero.id, level: hero.level,
      roster: f.enemies.filter((e) => !e.dead && e.state !== 'dying' && !e.puppet).map((e) => e.def.id), result: null,
    };
    root.fights.push(rec);
    if (!out.includes(root)) out.push(root);
    save();
    return rec;
  };
  const finish = (rec: RecordedFight | null, result: RecordedFight['result']): void => {
    if (!rec || !on) return;
    rec.result = result;
    save();
  };

  const fight = ScriptApi.prototype.fight;
  const recFight = async function (this: ScriptApi, type: string, opts: FightOpts = {}): Promise<FightResult> {
    const rec = begin(this, 'boss', type, opts);
    const r = await fight.call(this, type, opts);
    finish(rec, r);
    return r;
  };
  ScriptApi.prototype.fight = recFight;
  const clear = ScriptApi.prototype.clearEnemies;
  const recClear = async function (this: ScriptApi): Promise<void> {
    const rec = begin(this, 'wave', '', {});
    await clear.call(this);
    finish(rec, 'cleared');
  };
  ScriptApi.prototype.clearEnemies = recClear;
  const waitDefeat = ScriptApi.prototype.waitDefeat;
  const recWaitDefeat = async function (this: ScriptApi, uids: string[]): Promise<void> {
    const rec = begin(this, 'wave', '', { uid: uids.join(',') });
    await waitDefeat.call(this, uids);
    finish(rec, 'cleared');
  };
  ScriptApi.prototype.waitDefeat = recWaitDefeat;

  return () => {
    on = false;
    if (Game.prototype.runScript === recRunScript) Game.prototype.runScript = runScript;
    if (ScriptApi.prototype.fight === recFight) ScriptApi.prototype.fight = fight;
    if (ScriptApi.prototype.clearEnemies === recClear) ScriptApi.prototype.clearEnemies = clear;
    if (ScriptApi.prototype.waitDefeat === recWaitDefeat) ScriptApi.prototype.waitDefeat = waitDefeat;
  };
}

const recordTo = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.LOS_RECORD_FIGHTS;
if (recordTo) recordFights(recordTo);
