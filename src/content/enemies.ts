/** Regular-enemy behaviour archetypes (LoG2 §5.9). */
export type AiKind =
  | 'rusher' // runs at you and hits
  | 'reach' // longer melee reach (snakes)
  | 'shooter' // keeps distance and fires
  | 'charger' // telegraphed charge
  | 'flyer' // glides and swoops (ignores water)
  | 'heavy' // slow, flamethrower/close blast + punches
  | 'exploder' // rusher that blows up on death
  | 'hazard' // invulnerable patroller
  | 'boss' // driven by BossDef patterns
  | 'idle'; // does nothing (targets, sparring dummies)

/** Boss move vocabulary. */
export type BossMove =
  | 'chase' // pursue and melee combo
  | 'shot' // single aimed ki blast
  | 'volley' // 3-5 shot fan
  | 'rain' // ki blasts falling around the player
  | 'beam' // telegraphed straight beam
  | 'dash' // fast dash attack across the arena
  | 'teleport' // vanish and reappear beside the player, then strike
  | 'summon' // spawn minions
  | 'drain' // grab-and-drain (Cell tail) — mash to escape
  | 'charge' // telegraphed bull charge
  | 'timeSkip' // Hit: freeze the player briefly then strike
  | 'nova' // ring of shots outward
  | 'guard'; // block briefly (reduced damage)

export interface BossPhase {
  /** Phase is active while HP fraction is above this value. */
  until: number;
  moves: BossMove[];
  /** Ticks between moves. */
  rest: number;
  /** Speed multiplier for this phase. */
  speed?: number;
  /** Script id to run when the phase begins (taunts, arena changes). */
  onStart?: string;
}

export interface BossDef {
  phases: BossPhase[];
  /** Fight ends (scripted) when HP fraction falls to this; 0 = must be defeated. */
  endAt: number;
  /** Absorbs ki attacks, healing instead (Androids 19/20 analogue). */
  absorbKi?: boolean;
  /** Minion enemy id for 'summon'. */
  minion?: string;
  /** HP drain per second as fraction of max (Golden Frieza stamina). */
  stamina?: number;
  /** Ring-out style arena edges kill on contact. */
  ringOut?: boolean;
  /** Fully heals at this HP fraction once (Perfect Cell refill). */
  refillAt?: number;
  refillTo?: number;
  /** Projectile colour. */
  kiColor?: string;
  /** Can only be damaged while this flag is set (sealing puzzles etc.). */
  vulnerableIf?: string;
}

/** A bestiary entry. Stronger tiers are separate entries with different sprites. */
export interface EnemyDef {
  id: string;
  name: string;
  sprite: string;
  hp: number;
  str: number;
  pow: number;
  end: number;
  exp: number;
  ai: AiKind;
  /** px/frame. */
  speed: number;
  /** Collision box at the feet. */
  box?: { w: number; h: number };
  /** Contact damage multiplier (0 = none). */
  touch?: number;
  /** Ranged config for shooters/heavies. */
  shot?: { color: string; cooldown: number; speed: number; mult: number };
  /** Drop table flavour. */
  drops?: 'normal' | 'water' | 'none' | 'rich';
  /** Scouter description. */
  desc: string;
  boss?: BossDef;
  /** Can't be hit (hazard herds). */
  invulnerable?: boolean;
  /** Absorbs ki (heals) — melee only. */
  absorbKi?: boolean;
  /** Flies over water / obstacles. */
  flying?: boolean;
  /** Damage-taken multipliers (ROM /128 values as fractions): melee and ki. */
  resMelee?: number;
  resKi?: number;
}

/** All enemies. Content files register more via `registerEnemies`. */
export const ENEMIES: Record<string, EnemyDef> = {};

/** Register bestiary entries. */
export function registerEnemies(list: EnemyDef[]): void {
  for (const e of list) ENEMIES[e.id] = e;
}
