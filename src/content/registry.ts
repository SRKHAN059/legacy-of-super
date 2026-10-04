import type { MapDef } from '../game/mapdef';

/** All maps by id. Content modules call `registerMaps`. */
export const MAPS: Record<string, MapDef> = {};

/** Additive per-chapter layers on shared maps (NPCs, enemies, triggers...). */
const OVERLAYS: Record<string, Array<Partial<MapDef>>> = {};

/** Register maps; duplicate ids are a content bug and throw. */
export function registerMaps(list: MapDef[]): void {
  for (const m of list) {
    if (MAPS[m.id]) throw new Error(`Duplicate map id "${m.id}"`);
    MAPS[m.id] = m;
  }
}

/**
 * Add content to an existing (possibly not-yet-registered) map. Arrays are concatenated,
 * `onEnter` scripts accumulate, scalar fields are ignored (the base map owns them).
 * Gate everything with showIf/hideIf so each chapter's layer only appears at the right time.
 */
export function registerOverlay(mapId: string, layer: Partial<MapDef>): void {
  (OVERLAYS[mapId] ??= []).push(layer);
}

const ARRAY_KEYS = ['props', 'npcs', 'enemies', 'warps', 'triggers', 'pickups', 'barriers', 'objects'] as const;

/** Resolve a map id to its base def merged with all overlays. */
export function resolveMap(id: string): MapDef | undefined {
  const base = MAPS[id];
  if (!base) return undefined;
  const layers = OVERLAYS[id];
  if (!layers?.length) return base;
  const out: MapDef = { ...base };
  for (const k of ARRAY_KEYS) {
    const merged = [...((base[k] as unknown[]) ?? [])];
    for (const l of layers) merged.push(...((l[k] as unknown[]) ?? []));
    (out as unknown as Record<string, unknown>)[k] = merged;
  }
  const enters = [base.onEnter, ...layers.map((l) => l.onEnter)].flat().filter((x): x is string => !!x);
  out.onEnter = enters;
  out.exits = { ...(base.exits ?? {}) };
  for (const l of layers) Object.assign(out.exits, l.exits ?? {});
  return out;
}
