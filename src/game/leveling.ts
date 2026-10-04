import type { Rng } from '../engine/math';

/** Maximum character level (LoG2: 50). */
export const MAX_LEVEL = 50;
/** STR/POW/END hard cap (LoG2: 100). */
export const STAT_CAP = 100;

/**
 * Total EXP required to reach each level, index = level. Exact values from the LoG2 ROM
 * (table at 0x1D9834).
 */
export const EXP_TABLE: readonly number[] = [
  0, // L0 placeholder
  0, 50, 150, 325, 600, 1000, 1550, 2275, 3200, 4350,
  5775, 7550, 10225, 13500, 17525, 22450, 28475, 35750, 44425, 54750,
  66975, 81400, 98825, 119750, 144750, 175250, 212875, 259000, 314625, 382750,
  467625, 572525, 701900, 855775, 1045400, 1270775, 1531900, 1853025, 2245900, 2727775,
  3335510, 4090385, 5030260, 6195885, 7646510, 9442210, 11663685, 14520185, 18138435, 22965105,
];

/** Level for a total EXP amount. */
export function levelForExp(exp: number): number {
  let lv = 1;
  while (lv < MAX_LEVEL && exp >= EXP_TABLE[lv + 1]) lv++;
  return lv;
}

/** EXP still needed to reach the next level (0 at max). */
export function expToNext(level: number, exp: number): number {
  if (level >= MAX_LEVEL) return 0;
  return Math.max(0, EXP_TABLE[level + 1] - exp);
}

/** Fraction of progress through the current level, for the EXP bar. */
export function expFraction(level: number, exp: number): number {
  if (level >= MAX_LEVEL) return 1;
  const lo = EXP_TABLE[level];
  const hi = EXP_TABLE[level + 1];
  return Math.max(0, Math.min(1, (exp - lo) / (hi - lo)));
}

/** Per-stat growth range in 1/256ths of a point per level (datamined LoG2 format). */
export interface Growth {
  str: [number, number];
  pow: [number, number];
  end: [number, number];
}

/** The numeric core of a character that leveling mutates. */
export interface StatBlock {
  level: number;
  hpMax: number;
  epMax: number;
  str: number;
  pow: number;
  end: number;
  /** Hidden fractional "stat experience" accumulators, 0..255. */
  strF: number;
  powF: number;
  endF: number;
}

/** Stat changes produced by one level-up (for the "Attribute bonus" popup). */
export interface LevelUpResult {
  level: number;
  hp: number;
  ep: number;
  str: number;
  pow: number;
  end: number;
}

/**
 * Apply one level-up with LoG2's algorithm (ROM 0x08003CA0):
 * HP += HP*(3604+rand(1311))>>16 (+5.50..7.50%); EP += 2+rand(3);
 * STR/POW/END accumulate a random 1/256 amount from the character's range, overflowing into the visible stat.
 */
export function levelUp(s: StatBlock, g: Growth, rng: Rng): LevelUpResult {
  // ROM 0x08003CA0: HPmax += HPmax*(3604+rand(1311))>>16; EPmax += 2+rand(3).
  const hpGain = Math.floor((s.hpMax * (3604 + rng.int(0, 1310))) / 65536);
  const epGain = 2 + rng.int(0, 2);
  s.hpMax += hpGain;
  s.epMax += epGain;
  const grow = (stat: 'str' | 'pow' | 'end', fr: 'strF' | 'powF' | 'endF', range: [number, number]): number => {
    const before = s[stat];
    const total = s[stat] * 256 + s[fr] + rng.int(range[0], range[1]);
    s[stat] = Math.min(STAT_CAP, Math.floor(total / 256));
    s[fr] = s[stat] >= STAT_CAP ? 0 : total % 256;
    return s[stat] - before;
  };
  const str = grow('str', 'strF', g.str);
  const pow = grow('pow', 'powF', g.pow);
  const end = grow('end', 'endF', g.end);
  s.level++;
  return { level: s.level, hp: hpGain, ep: epGain, str, pow, end };
}

/** Roll a character from level 1 up to `target` (LoG2 "join at level N" behaviour). */
export function rollToLevel(s: StatBlock, g: Growth, target: number, rng: Rng): void {
  while (s.level < target && s.level < MAX_LEVEL) levelUp(s, g, rng);
}

/** LoG2's stat scaling curve f(S) (ROM 0x0800F910): cubic in the attacking stat. */
export function statCurve(S: number): number {
  const x = Math.max(0, Math.floor(S));
  return Math.floor((x * (x * (26 * x - 701) + 115618)) / 256);
}

/** Inputs to a damage roll. */
export interface DamageInput {
  /** Attack base power (desc.power). */
  power: number;
  /** Attack multiplier (1.0 = 1024 in ROM units). */
  mult: number;
  /** Attacker STR (melee) or POW (ki). */
  stat: number;
  /** Defender END. */
  end: number;
  /** Defender damage-taken multiplier (1 = 0x80). */
  res: number;
  /** Melee crit doubles base power. */
  crit: boolean;
  /** rand(26) roll, 0..25. */
  r26: number;
}

/**
 * Exact LoG2 damage function:
 *   a = (base*(128-END))>>7; t = ((a*(256+rand(26)))>>8)*f(S)>>18; dmg = mult*t; final = dmg*res.
 */
export function damage(d: DamageInput): number {
  const base = d.power * (d.crit ? 2 : 1);
  const a = Math.floor((base * (128 - Math.min(124, Math.max(0, d.end)))) / 128);
  const t = Math.floor((Math.floor((a * (256 + d.r26)) / 256) * statCurve(d.stat)) / 262144);
  return Math.max(1, Math.floor(Math.floor(d.mult * t) * d.res));
}

/** Melee crit chance: chance(STR*164) of 65536 => STR/400 (25% at STR 100). */
export function critChance(str: number): number {
  return (str * 164) / 65536;
}

/** Base power of the hero's melee hits (calibrated to LoG2 damage observations). */
export const MELEE_POWER = 1200;
/** Base power of ki techniques before the technique multiplier. */
export const KI_POWER = 1100;
/** Base power of enemy attacks before per-attack multipliers. */
export const ENEMY_POWER = 900;

/**
 * EXP per kill (ROM 0x0800E4D2): clamped between 1/128 and 1/2 of the current level's span;
 * nothing at level 50. Values <= 5 are not clamped.
 */
export function killExp(base: number, level: number): number {
  if (base <= 5) return base;
  if (level >= MAX_LEVEL) return 0;
  const span = EXP_TABLE[level + 1] - EXP_TABLE[level];
  let e = base;
  if (span >> 7 > e) e = span >> 7;
  return Math.min(e, span >> 1);
}
