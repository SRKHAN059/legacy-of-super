import type { Dir } from '../../../engine/math';
import type { ScriptApi } from '../../../game/script';
import { freeNear, heroTile, sweepRivals } from './helpers';

/**
 * Tournament of Power staging kit shared by the Chapter 14 relays (`c14.ts`) and their set pieces
 * (`c14_setpieces.ts`): staging on the hero's own platform, eliminations, erasures, scripted waves and cutscene
 * ring-outs.
 */

// ================================================================ staging on the stage the hero stands on

/** True when an actor standing on tile (x, y) would not overlap terrain, props or gates (as `freeNear` tests it). */
function walkable(s: ScriptApi, x: number, y: number): boolean {
  return !s.field.col.blocked({ x: x * 16 + 3, y: y * 16 + 8, w: 10, h: 6 });
}

/** Tile key for the reachability set. */
const key = (x: number, y: number): number => y * 4096 + x;

/** Every tile the hero can walk to from where they stand (the void, terrain and props split the stage). */
function reachable(s: ScriptApi): Set<number> {
  const [hx, hy] = heroTile(s);
  const [sx, sy] = walkable(s, hx, hy) ? [hx, hy] : freeNear(s, hx, hy);
  const grid = s.field.map.grid;
  const seen = new Set<number>([key(sx, sy)]);
  const queue: Array<[number, number]> = [[sx, sy]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (ny < 0 || ny >= grid.length || nx < 0 || nx >= grid[ny].length) continue;
      const k = key(nx, ny);
      if (seen.has(k) || !walkable(s, nx, ny)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

/**
 * Tiles a scripted fighter starts at least this far from the void. Every Tournament of Power fighter can be rung out,
 * so one spawned at the edge would fall to the first combo finisher; three tiles of stage make a ring-out earned.
 */
export const FIGHT_MARGIN = 3;

/** True when no void (or map edge) lies within `m` tiles of (x, y). */
function clearOfVoid(s: ScriptApi, x: number, y: number, m: number): boolean {
  const grid = s.field.map.grid;
  for (let dy = -m; dy <= m; dy++) {
    const row = grid[y + dy];
    if (!row) return false;
    for (let dx = -m; dx <= m; dx++) {
      const t = row[x + dx];
      if (t === undefined || t === 'void') return false;
    }
  }
  return true;
}

/**
 * Nearest tile to (x, y) that the hero can reach on foot, keeping `margin` tiles of stage between it and the void
 * when the platform allows (`FIGHT_MARGIN` for fighters). The tournament stage has floating rocks that only a
 * flight circle reaches, and fights seal the circles: a fighter staged on one could never be hit (shots stop at the
 * void too), so every Chapter 14 fighter and actor is placed on the hero's own platform.
 */
export function onStage(s: ScriptApi, x: number, y: number, margin = 0, maxR = 24): [number, number] {
  const ok = reachable(s);
  const rx = Math.round(x);
  const ry = Math.round(y);
  // With a margin, fall back to the plain nearest reachable tile on a platform too narrow to keep it.
  for (const m of margin > 0 ? [margin, 0] : [0]) {
    const fits = (tx: number, ty: number): boolean => ok.has(key(tx, ty)) && (m === 0 || clearOfVoid(s, tx, ty, m));
    if (fits(rx, ry)) return [rx, ry];
    for (let r = 1; r <= maxR; r++) {
      let best: [number, number] | null = null;
      let bd = Infinity;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !fits(rx + dx, ry + dy)) continue;
          const d = Math.hypot(dx, dy);
          if (d < bd) { bd = d; best = [rx + dx, ry + dy]; }
        }
      }
      if (best) return best;
    }
  }
  return heroTile(s);
}

/**
 * Spawn a cutscene actor on the hero's platform, as close to (x, y) as it allows (and `margin` tiles clear of the
 * void, see `onStage`). Returns the tile used.
 */
export function stageOn(s: ScriptApi, id: string, sprite: string, x: number, y: number, dir: Dir = 'down', name?: string, margin = 0): [number, number] {
  const [fx, fy] = onStage(s, x, y, margin);
  s.spawn(id, sprite, fx, fy, dir, name);
  return [fx, fy];
}

// ================================================================ eliminations and waves

/**
 * Generic rival fighters from the world builder are hidden while the opening scene and the stage A waves run.
 * Afterwards they roam the stage again (LoG2 hostile zone for levelling), and each stage relay sweeps them away
 * before its staged fights.
 */
export const QUIET = 'fc_topQuiet';

/** Clear the stage of free-roaming rivals before a staged relay. */
export async function clearStage(s: ScriptApi): Promise<void> {
  if (sweepRivals(s) > 0) {
    await s.wait(20);
    await s.narrate('The stray fighters around you are blown off the stage in the crossfire!');
  }
}

/** Announce an elimination with a ring-out flash. */
export async function eliminated(s: ScriptApi, text: string): Promise<void> {
  s.flash('#f8e040', 8);
  s.sfx('explode');
  await s.narrate(text);
}

/** A universe is erased by Zeno. */
export async function erased(s: ScriptApi, text: string): Promise<void> {
  s.flash('#ffffff', 24);
  s.shake(20, 2);
  await s.narrate(text);
}

/** Spawn a scripted wave on the hero's platform. */
export function wave(s: ScriptApi, list: Array<[string, number, number]>): void {
  for (const [type, x, y] of list) {
    const [fx, fy] = onStage(s, x, y);
    s.spawnEnemy(type, fx, fy);
  }
}

/** Walk an actor off the stage edge into the void and remove it (ring-out cutscene). */
export async function ringOut(s: ScriptApi, id: string, x: number, y: number): Promise<void> {
  if (!s.exists(id)) return;
  await s.walk(id, x, y, 4);
  s.remove(id);
  s.sfx('explode');
}

/**
 * The actor for the scene after a scripted fight: the fight's puppet where it stands, brought back to (x, y) when a
 * ring-out left it hidden at the edge, or staged fresh at (x, y) when it is gone. Returns the actor id to use.
 */
export function standIn(s: ScriptApi, id: string, sprite: string, x: number, y: number, name: string, dir: Dir = 'left'): string {
  if (s.exists(id)) {
    const a = s.actor(id);
    if (a.hidden) {
      const [fx, fy] = onStage(s, x, y);
      s.place(id, fx, fy, dir);
    }
    a.hidden = false;
    a.alpha = 1;
    return id;
  }
  stageOn(s, id, sprite, x, y, dir, name);
  return id;
}
