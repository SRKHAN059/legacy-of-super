import { MAPS, resolveMap } from './registry';

/** A world-map landing spot (LoG2: purple dots, land with A). */
export interface LandingSpot {
  id: string;
  name: string;
  world: WorldId;
  /** Position on the 256x256 world texture. */
  x: number;
  y: number;
  /** Destination map and tile. */
  map: string;
  tx: number;
  ty: number;
  /** Visual marker drawn on the texture. */
  icon?: 'city' | 'house' | 'mountain' | 'island' | 'tower' | 'planet' | 'arena' | 'ruins' | 'palace' | 'cave';
  /** Planet colour for space spots. */
  color?: string;
  /** Instead of landing on a map, switch to another world's map (e.g. "Return to Earth"). */
  toWorld?: WorldId;
}

export type WorldId = 'earth' | 'future' | 'space';

export interface WorldDef {
  id: WorldId;
  name: string;
  music: string;
  seed: number;
}

export const WORLDS: Record<WorldId, WorldDef> = {
  earth: { id: 'earth', name: 'Earth', music: 'worldmap', seed: 7 },
  future: { id: 'future', name: 'Future Earth', music: 'futureWorld', seed: 7 },
  space: { id: 'space', name: 'Universe 7', music: 'space', seed: 21 },
};

/** All landing spots. Chapter content registers its own. */
export const SPOTS: Record<string, LandingSpot> = {};

/** Register landing spots. */
export function registerSpots(list: LandingSpot[]): void {
  for (const s of list) SPOTS[s.id] = s;
}

let worldCache: { key: string; worlds: Map<string, WorldId | null> } | null = null;

/**
 * The world a map belongs to: the world of the landing spots it can be walked, flown or warped to from
 * (null when no spot reaches it, or spots of two worlds do). Story warps use it to keep the world-map flag right.
 */
export function worldOfMap(mapId: string): WorldId | null {
  const key = `${Object.keys(MAPS).length}:${Object.keys(SPOTS).length}`;
  if (worldCache?.key !== key) {
    const worlds = new Map<string, WorldId | null>();
    const queue: Array<[string, WorldId]> = [];
    for (const s of Object.values(SPOTS)) if (s.map && !s.toWorld) queue.push([s.map, s.world]);
    while (queue.length) {
      const [id, w] = queue.shift() as [string, WorldId];
      if (worlds.has(id)) {
        if (worlds.get(id) !== w) worlds.set(id, null);
        continue;
      }
      worlds.set(id, w);
      const def = resolveMap(id);
      if (!def) continue;
      const next = [
        ...(def.warps ?? []).map((x) => x.to),
        ...Object.values(def.exits ?? {}).map((x) => x?.to),
        ...(def.objects ?? []).map((o) => (o.type === 'flight' ? o.to : undefined)),
      ];
      for (const n of next) if (n && MAPS[n]) queue.push([n, w]);
    }
    worldCache = { key, worlds };
  }
  return worldCache.worlds.get(mapId) ?? null;
}
