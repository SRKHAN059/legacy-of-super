import type { ScriptApi } from '../../../game/script';
import { FIGHT_MARGIN, onStage } from './c14_kit';

/**
 * Stage geometry for the west-ring episodes (`c14_obni.ts`, `c14_veterans.ts`): where an actor stands, where to walk
 * it so it goes over the nearest edge of the stage (cutscene ring-outs), and where a relay picks up after a time skip.
 */

/** Tile an actor (cutscene NPC, enemy puppet or the hero) stands on. */
export function tileOf(s: ScriptApi, id: string): [number, number] {
  const a = s.actor(id);
  return [Math.floor(a.x / 16), Math.floor((a.y - 14) / 16)];
}

/** A tile a few steps past the stage edge nearest to (x, y): where a cutscene ring-out walks an actor. */
export function pastEdge(s: ScriptApi, x: number, y: number): [number, number] {
  const grid = s.field.map.grid;
  for (let r = 1; r <= 24; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const t = grid[y + dy]?.[x + dx];
        if (t !== undefined && t !== 'void') continue;
        const k = (r + 3) / r;
        return [Math.round(x + dx * k), Math.round(y + dy * k)];
      }
    }
  }
  return [x + 12, y - 12];
}

/**
 * A tile near the middle of the stage the hero stands on, `FIGHT_MARGIN` clear of the void: where a relay picks up
 * after a time skip in the dark, so the next set piece is staged in the open and not against a rim or a map edge.
 */
export function ringCentre(s: ScriptApi): [number, number] {
  const grid = s.field.map.grid;
  return onStage(s, Math.floor(grid[0].length / 2), Math.floor(grid.length / 2), FIGHT_MARGIN);
}
