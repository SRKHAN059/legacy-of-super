/** Axis-aligned rectangle in world pixels. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 2D vector. */
export interface Vec {
  x: number;
  y: number;
}

/** Four facing directions, matching sprite sheet row order. */
export type Dir = 'down' | 'up' | 'left' | 'right';

export const DIRS: readonly Dir[] = ['down', 'up', 'left', 'right'];

/** Unit vector for a facing direction. */
export function dirVec(d: Dir): Vec {
  switch (d) {
    case 'down': return { x: 0, y: 1 };
    case 'up': return { x: 0, y: -1 };
    case 'left': return { x: -1, y: 0 };
    case 'right': return { x: 1, y: 0 };
  }
}

/** Facing direction that best matches a vector (horizontal wins ties). */
export function vecDir(v: Vec, fallback: Dir = 'down'): Dir {
  if (v.x === 0 && v.y === 0) return fallback;
  if (Math.abs(v.x) >= Math.abs(v.y)) return v.x < 0 ? 'left' : 'right';
  return v.y < 0 ? 'up' : 'down';
}

/** Clamp a number into [lo, hi]. */
export function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

/** True when two rectangles overlap (touching edges do not count). */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Euclidean distance between two points. */
export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Normalise a vector; zero vector stays zero. */
export function norm(v: Vec): Vec {
  const l = Math.hypot(v.x, v.y);
  return l === 0 ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
}

/** Rectangle centre point. */
export function center(r: Rect): Vec {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** Deterministic xorshift32 RNG so replays and tests are reproducible. */
export class Rng {
  private s: number;

  constructor(seed = 0x9e3779b9) {
    this.s = seed >>> 0 || 1;
  }

  /** Next float in [0, 1). */
  next(): number {
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 0x100000000;
  }

  /** Integer in [lo, hi] inclusive. */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Random element of a non-empty array. */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}
