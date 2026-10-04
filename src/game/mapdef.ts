import type { PropKind } from '../art/props';
import type { Terrain } from '../art/tiles';
import type { Dir } from '../engine/math';

/**
 * Authoring format for a map. All coordinates are in TILES unless noted; fractional values are allowed.
 * Content files export `MapDef`s; the World turns them into runtime objects.
 */
export interface MapDef {
  id: string;
  /** Area name shown in the entry banner and on the save screen. */
  name: string;
  /** Music track id. */
  music: string;
  /** Character → terrain lookup for `grid`. */
  legend: Record<string, Terrain>;
  /** Terrain rows; every row must be the same length. */
  grid: string[];
  /** Props placed by their top-left tile. Optionally offset in pixels. */
  props?: PropPlacement[];
  npcs?: NpcDef[];
  /** Enemy spawn points; enemies respawn when the map is re-entered. */
  enemies?: EnemySpawn[];
  /** Edge/door transitions. */
  warps?: WarpDef[];
  /** Invisible areas that run a script when entered (or when A is pressed inside, if `onAction`). */
  triggers?: TriggerDef[];
  /** One-time item pickups (capsules, collectibles). */
  pickups?: PickupDef[];
  /** Level-gated energy barriers. */
  barriers?: BarrierDef[];
  /** Script(s) run every time the map is entered (after fade-in). Scripts should self-gate with flags. */
  onEnter?: string | string[];
  /** Background tint for dark caves / night. */
  tint?: string;
  /** Sky/backdrop colour for maps with void edges (tournament stage, lookout). */
  backdrop?: string;
  /** World-map region this map belongs to (for the map screen). */
  region?: string;
  /** Combat allowed (LoG2's hostile-zone icon). Towns/interiors are false. */
  hostile?: boolean;
  /** Indoor map: Whis's Charm can't be used, no weather. */
  indoor?: boolean;
  /** Walk-off-the-edge connections to neighbouring maps. The parallel coordinate is kept (+offset tiles). */
  exits?: Partial<Record<'north' | 'south' | 'east' | 'west', EdgeExit>>;
  /** Interactive world objects. */
  objects?: ObjectDef[];
  /** Enemies knocked hard into `void` tiles are eliminated (Tournament of Power rules). */
  ringOut?: boolean;
}

/** Edge connection. */
export interface EdgeExit {
  to: string;
  /** Tile offset added to the parallel coordinate on arrival (maps of different alignment). */
  offset?: number;
  showIf?: string;
  hideIf?: string;
  /** Script run instead when the exit is locked. */
  lockedScript?: string;
}

/** Interactive objects with built-in behaviour. Coordinates in tiles. */
export type ObjectDef =
  /** Capsule Corp save disc: Save / Switch Character. */
  | { type: 'save'; x: number; y: number }
  /** Flight circle: fly to another map position. */
  | { type: 'flight'; x: number; y: number; to: string; tx: number; ty: number; showIf?: string; label?: string }
  /** World-map signpost: take off to the world map. */
  | { type: 'worldSign'; x: number; y: number }
  /** Breakable rock/pot/crate; size 1-3 hits. May drop food/orbs or a fixed item. */
  | { type: 'breakable'; x: number; y: number; size: 1 | 2 | 3; look?: 'rock' | 'jar' | 'crate'; item?: string; id?: string }
  /** Readable sign (A). */
  | { type: 'sign'; x: number; y: number; text: string }
  /** Item container (opens once). */
  | { type: 'chest'; x: number; y: number; id: string; item: string; qty?: number; showIf?: string }
  /** Training dummy / punching bag (1 EXP per hit). */
  | { type: 'bag'; x: number; y: number };

/** A prop placement: [kind, tileX, tileY] or with pixel offsets / a unique id. */
export type PropPlacement =
  | [PropKind | string, number, number]
  | { kind: PropKind | string; x: number; y: number; id?: string; flag?: string; hideFlag?: string };

/** A non-hostile character. */
export interface NpcDef {
  id: string;
  /** Sprite id from CAST or creature registry. */
  sprite: string;
  x: number;
  y: number;
  dir?: Dir;
  /** Script id run when the player presses A facing them. */
  talk: string;
  /** Wander inside a box of this radius (tiles); 0 = stand still. */
  wander?: number;
  /** Only present when this flag is set. */
  showIf?: string;
  /** Hidden once this flag is set. */
  hideIf?: string;
  /** Display name for dialogue. */
  name?: string;
}

/** Enemy spawn. */
export interface EnemySpawn {
  /** Enemy type id from the bestiary. */
  type: string;
  x: number;
  y: number;
  /** Only spawn when this flag is set / not set. */
  showIf?: string;
  hideIf?: string;
  /** Unique id for bosses / one-time enemies; once defeated, the flag `defeated:<id>` is set. */
  id?: string;
  /** Script run when this enemy is defeated. */
  onDefeat?: string;
}

/** Map transition. Stepping into the rect warps to `to` at the given tile. */
export interface WarpDef {
  x: number;
  y: number;
  w: number;
  h: number;
  to: string;
  tx: number;
  ty: number;
  dir?: Dir;
  /** Only active when the flag is set. */
  showIf?: string;
  hideIf?: string;
  /** Door sound and no edge-walk. */
  door?: boolean;
  /** Script that runs instead of warping when the warp is locked (hideIf/showIf not met). */
  lockedScript?: string;
}

/** Script trigger zone. */
export interface TriggerDef {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  script: string;
  /** Requires pressing A inside (signs, examinable objects). */
  onAction?: boolean;
  /** Fires once; sets flag `trig:<id>`. */
  once?: boolean;
  showIf?: string;
  hideIf?: string;
}

/** Collectible on the ground. */
export interface PickupDef {
  id: string;
  item: string;
  x: number;
  y: number;
  qty?: number;
  showIf?: string;
  /** Hidden pickups only appear when examined (A) and show no sprite. */
  hidden?: boolean;
}

/** An energy barrier that blocks passage until the active character reaches a level. */
export interface BarrierDef {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Required level. 0 with `openIf` = white story gate. */
  level: number;
  /** Character whose colour the gate shows; only they can break it. Omit for a white story gate. */
  character?: string;
  /** White story gates open automatically when this condition is true. */
  openIf?: string;
}
