import { TILE } from '../../../engine/constants';
import type { Dir } from '../../../engine/math';
import type { ScriptApi } from '../../../game/script';

/** Helpers shared by the act 2 scripts (chapters 3-5). */

/** The seven Dragon Ball item ids. */
export const DB_ITEMS = ['db1', 'db2', 'db3', 'db4', 'db5', 'db6', 'db7'] as const;

/** How many Dragon Balls the party is carrying. */
export function dbCount(s: ScriptApi): number {
  return DB_ITEMS.filter((d) => s.count(d) > 0).length;
}

/** Remove a cutscene actor if it exists on the current map. */
export function removeIf(s: ScriptApi, ...ids: string[]): void {
  for (const id of ids) if (s.exists(id)) s.remove(id);
}

/** Spawn an actor, replacing any existing actor with the same id first. */
export function respawn(s: ScriptApi, id: string, sprite: string, x: number, y: number, dir: Dir = 'down', name?: string): void {
  removeIf(s, id);
  s.spawn(id, sprite, x, y, dir, name);
}

/** Use an actor that is already on the map (overlay NPC) or spawn it, then put it at a tile. */
export function stage(s: ScriptApi, id: string, sprite: string, x: number, y: number, dir: Dir = 'down', name?: string): void {
  if (!s.exists(id)) s.spawn(id, sprite, x, y, dir, name);
  s.place(id, x, y, dir);
}

/** Place a decorative prop at runtime (tile coords, fractional allowed). */
export function addProp(s: ScriptApi, kind: string, x: number, y: number, id: string): void {
  s.field.map.removeProp(id);
  s.field.map.addProp(kind, x * TILE, y * TILE, id);
}

/** Remove a runtime prop by id. */
export function removeProp(s: ScriptApi, id: string): void {
  s.field.map.removeProp(id);
}

/**
 * Chapter 3: once all seven balls are in hand, close the hunt and point the journal at Capsule Corp.
 * Called after every ball hand-over and from the onEnter hooks of every hunt map.
 */
export async function ballCheck(s: ScriptApi): Promise<void> {
  if (!s.check('quest:c03_dragonballs') || dbCount(s) < 7) return;
  s.sfx('powerUp');
  await s.say('hero', 'That\'s all seven! The radar\'s screen is one big orange blob.', 'happy');
  await s.narrate('You have all seven Dragon Balls! Bring them to Bulma at Capsule Corp in West City.');
  await s.done('c03_dragonballs');
  await s.quest('c03_summon');
}

/** Small announcement used when a Dragon Ball is handed over by an NPC. */
export async function giveBall(s: ScriptApi, item: (typeof DB_ITEMS)[number]): Promise<void> {
  await s.give(item);
  const n = dbCount(s);
  if (n < 7) s.toast(`Dragon Balls: ${n}/7`);
  await ballCheck(s);
}
