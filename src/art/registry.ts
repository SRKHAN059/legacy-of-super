import { CAST } from '../content/cast';
import { CREATURES } from '../content/creatures';
import type { Bitmap } from '../engine/gfx';
import { buildCreature } from './creatures';
import { buildHumanoid, type SpriteSet } from './humanoid';
import { buildPortrait, type Expression } from './portrait';

const sprites = new Map<string, SpriteSet>();
const portraits = new Map<string, Bitmap>();

/** Sprite set for a cast or creature id; throws on unknown ids so content typos fail loudly in dev. */
export function spriteSet(id: string): SpriteSet {
  const hit = sprites.get(id);
  if (hit) return hit;
  let set: SpriteSet;
  if (CAST[id]) set = buildHumanoid(CAST[id]);
  else if (CREATURES[id]) set = buildCreature(CREATURES[id]);
  else throw new Error(`Unknown sprite id "${id}"`);
  sprites.set(id, set);
  return set;
}

/** True when a sprite id exists. */
export function hasSprite(id: string): boolean {
  return !!(CAST[id] || CREATURES[id]);
}

/** Dialogue portrait for a cast id, or null for creatures / unknown ids. */
export function portrait(id: string, expr: Expression = 'neutral'): Bitmap | null {
  const spec = CAST[id];
  if (!spec) return null;
  const key = `${id}:${expr}`;
  let b = portraits.get(key);
  if (!b) {
    b = buildPortrait(spec, expr);
    portraits.set(key, b);
  }
  return b;
}
