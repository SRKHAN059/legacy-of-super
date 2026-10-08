import { CAST } from '../content/cast';
import { CREATURES } from '../content/creatures';
import type { Bitmap } from '../engine/gfx';
import { buildCreature } from './creatures';
import { buildHumanoid, type SpriteSet } from './humanoid';
import { buildPortrait, type Expression } from './portrait';
import { buildSheetSet, onSheetCast, sheetBlock, sheetCastOf } from './sheets';
import './sheetcast';
import { buildSheetCreatureSet, onSheetCreature, sheetCreatureOf } from './sheetcast/creatures';

export {
  isDefaultSheetCast, registerSheetCast, sheetBlock, sheetBlockIds, sheetCastIds, sheetCastOf, spriteAnims,
  type SheetCastOptions, type SheetExtra, type SheetLook, type SheetOverlay,
} from './sheets';
export {
  registerSheetCreatures, sheetCreatureIds, sheetCreatureOf, type CreatureLook, type CreatureMark,
} from './sheetcast/creatures';

const sprites = new Map<string, SpriteSet>();
const portraits = new Map<string, Bitmap>();

// A sheet look registered after an id was first drawn replaces the cached procedural set.
onSheetCast((ids) => {
  for (const id of ids) sprites.delete(id);
});
onSheetCreature((ids) => {
  for (const id of ids) sprites.delete(id);
});

/** True when a creature id is drawn from a built sprite-sheet block (false: procedural creature art). */
export function isSheetCreature(id: string): boolean {
  const look = sheetCreatureOf(id);
  return !!CREATURES[id] && !!look && !!sheetBlock(look.block);
}

/** True when a cast id is drawn from a built sprite-sheet block (false: procedural or creature art). */
export function isSheetSprite(id: string): boolean {
  const look = sheetCastOf(id);
  return !!look && !!sheetBlock(look.block);
}

/**
 * Sprite set for a cast or creature id: a LoG2 sheet block when one is registered for the id
 * (registerSheetCast for cast, registerSheetCreatures for creatures), else the procedural humanoid /
 * creature builder. Throws on unknown ids so content typos fail loudly in dev.
 */
export function spriteSet(id: string): SpriteSet {
  const hit = sprites.get(id);
  if (hit) return hit;
  let set: SpriteSet;
  const look = sheetCastOf(id);
  if (look && sheetBlock(look.block)) set = buildSheetSet(look);
  else if (CAST[id]) set = buildHumanoid(CAST[id]);
  else if (CREATURES[id]) {
    const creature = sheetCreatureOf(id);
    set = creature && sheetBlock(creature.block) ? buildSheetCreatureSet(creature) : buildCreature(CREATURES[id]);
  } else throw new Error(`Unknown sprite id "${id}"`);
  sprites.set(id, set);
  return set;
}

/** True when a sprite id exists. */
export function hasSprite(id: string): boolean {
  const look = sheetCastOf(id);
  return !!(CAST[id] || CREATURES[id] || (look && sheetBlock(look.block)));
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
