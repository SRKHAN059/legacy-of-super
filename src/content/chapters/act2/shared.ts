import { TILE } from '../../../engine/constants';
import type { Dir } from '../../../engine/math';
import type { Field } from '../../../game/field';
import type { Script, ScriptApi } from '../../../game/script';

/** Helpers shared by the act 2 scripts (chapters 3-5). */

/** Story beats currently running, per map visit (the Field object). */
const RUNNING = new WeakMap<Field, Set<string>>();

/**
 * Wrap a trigger- or NPC-started story beat so only one copy of it runs per map visit. A scripted fight or field
 * battle hands control back while its step trigger is still live (the beat's done flag is only set after the
 * fight), so stepping out of the trigger band and back in mid-fight would otherwise replay the cutscene, spawn a
 * second boss with the same uid and leave the field locked for good once the first copy moves on.
 * The mark lives on the Field object: it is never saved and resets whenever the map is (re)loaded, so a beat
 * abandoned through a Game Over or a reload can always be replayed.
 */
export function exclusive(id: string, body: Script): Script {
  return async (s) => {
    const field = s.field;
    let running = RUNNING.get(field);
    if (!running) {
      running = new Set();
      RUNNING.set(field, running);
    }
    if (running.has(id)) return;
    running.add(id);
    try {
      await body(s);
    } finally {
      running.delete(id);
    }
  };
}

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
