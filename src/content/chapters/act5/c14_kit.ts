import type { ScriptApi } from '../../../game/script';
import { freeNear, sweepRivals } from './helpers';

/**
 * Tournament of Power staging kit shared by the Chapter 14 relays (`c14.ts`) and their set pieces
 * (`c14_setpieces.ts`): eliminations, erasures, scripted waves and cutscene ring-outs.
 */

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

/** Spawn a scripted wave at tiles snapped to the stage. */
export function wave(s: ScriptApi, list: Array<[string, number, number]>): void {
  for (const [type, x, y] of list) {
    const [fx, fy] = freeNear(s, x, y);
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
export function standIn(s: ScriptApi, id: string, sprite: string, x: number, y: number, name: string, dir: 'left' | 'right' | 'up' | 'down' = 'left'): string {
  if (s.exists(id)) {
    const a = s.actor(id);
    if (a.hidden) {
      const [fx, fy] = freeNear(s, x, y);
      s.place(id, fx, fy, dir);
    }
    a.hidden = false;
    a.alpha = 1;
    return id;
  }
  const [fx, fy] = freeNear(s, x, y);
  s.spawn(id, sprite, fx, fy, dir, name);
  return id;
}
