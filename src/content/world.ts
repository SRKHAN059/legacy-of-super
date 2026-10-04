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
