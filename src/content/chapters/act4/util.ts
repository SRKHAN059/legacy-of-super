import type { CharId } from '../../characters';
import type { FightOpts, FightResult, ScriptApi } from '../../../game/script';
import { TILE } from '../../../engine/constants';

/**
 * Shared helpers for Act 4 scripts: runtime props, time-machine travel, temporary stat boosts
 * and small guards that keep cutscenes safe when a script is smoke-run out of context.
 */

/** Hub coordinates used by Act 4 cutscenes (tiles). Taken from the hub authors' map notes. */
export const HUB = {
  /** Capsule Corp hangar pad: time machine prop top-left, Bulma's spot, where travellers step out. */
  ccPad: { tmX: 32, tmY: 4, bulmaX: 31, bulmaY: 8, arriveX: 31, arriveY: 9 },
  ccLawn: { x: 23, y: 21 },
  ccDoor: { x: 21, y: 8 },
  hideoutIn: { arriveX: 9, arriveY: 11, maiX: 13, maiY: 8 },
  hideoutOut: { x: 17, y: 15 },
  u10: { arriveX: 20, arriveY: 20 },
  zeno: { arriveX: 20, arriveY: 20 },
} as const;

/** Add a prop at runtime (visible immediately; persistent props are overlays gated by flags). */
export function propOn(s: ScriptApi, kind: string, x: number, y: number, id: string): void {
  const map = s.field.map;
  if (map.props.some((p) => p.id === id)) return;
  map.addProp(kind, x * TILE, y * TILE, id);
}

/** Remove a runtime or overlay prop by id. */
export function propOff(s: ScriptApi, id: string): void {
  s.field.map.removeProp(id);
}

/** Remove several cutscene actors if present. */
export function clearActors(s: ScriptApi, ids: string[]): void {
  for (const id of ids) if (s.exists(id)) s.remove(id);
}

/** Spawn a cutscene actor, replacing any actor with the same id. */
export function actor(s: ScriptApi, id: string, sprite: string, x: number, y: number, dir: 'up' | 'down' | 'left' | 'right' = 'down', name?: string): void {
  if (s.exists(id)) s.remove(id);
  s.spawn(id, sprite, x, y, dir, name);
}

/**
 * Spawn a talkable NPC mid-scene (an overlay NPC whose showIf flag was only just set appears on the next
 * map load; this puts it there right away with the same id and talk script).
 */
export function talker(s: ScriptApi, id: string, sprite: string, x: number, y: number, dir: 'up' | 'down' | 'left' | 'right', talk: string, name?: string): void {
  if (s.exists(id)) return;
  const n = s.spawn(id, sprite, x, y, dir, name);
  n.def.talk = talk;
}

/**
 * Ride the time machine: white-out, swap the world-map world, land on a map.
 * 'present' lands on Earth's world map; 'future' on Trunks's ruined Earth.
 */
export async function timeTravel(s: ScriptApi, era: 'present' | 'future', map: string, x: number, y: number, line?: string): Promise<void> {
  s.sfx('teleport');
  s.shake(30, 2);
  await s.fadeOut(30, '#ffffff');
  if (line) await s.narrate(line);
  s.set('world', era === 'future' ? 'future' : 'earth');
  await s.warp(map, x, y, 'down');
}

/** Teleport with a god (Whis's staff, Kai Kai): flash and land. */
export async function godWarp(s: ScriptApi, world: 'earth' | 'space' | 'future', map: string, x: number, y: number, color = '#a0e0ff'): Promise<void> {
  s.sfx('teleport');
  s.flash(color, 12);
  await s.fadeOut(16, '#ffffff');
  s.set('world', world);
  await s.warp(map, x, y, 'up');
}

/**
 * Temporary stat boost (Vegito). Stores exactly what was added so it can be undone,
 * and parks the character's Z form so the outfit sprite cannot be overridden mid-segment.
 */
export function boost(s: ScriptApi, id: CharId, n: number): void {
  if (s.flag(`c11_boost_${id}`)) return;
  const c = s.state.char(id);
  const add = (v: number) => Math.max(0, Math.min(n, 100 - v));
  const a = [add(c.str), add(c.pow), add(c.end)];
  c.str += a[0]; c.pow += a[1]; c.end += a[2];
  s.set(`c11_boost_${id}`, a.join(','));
  s.set(`c11_form_${id}`, c.form ?? '');
  c.form = null;
  c.hp = c.hpMax;
  c.ep = c.epMax;
}

/** Undo `boost`. Safe to call twice. */
export function unboost(s: ScriptApi, id: CharId): void {
  const raw = s.state.get(`c11_boost_${id}`);
  if (typeof raw !== 'string') return;
  const [a, b, d] = raw.split(',').map((v) => parseInt(v, 10) || 0);
  const c = s.state.char(id);
  c.str -= a; c.pow -= b; c.end -= d;
  const f = s.state.get(`c11_form_${id}`);
  if (typeof f === 'string' && f) c.form = f;
  s.clear(`c11_boost_${id}`);
  s.clear(`c11_form_${id}`);
}

/** Speaker id for an NPC talk script: the NPC that started it, else a cast id (smoke runs, inline calls). */
export function who(s: ScriptApi, fallback: string): string {
  return s.npc?.def.id ?? fallback;
}

/** Stop a wandering hub NPC from drifting back to its post until the map reloads (after a scripted walk). */
export function still(s: ScriptApi, id: string): void {
  const n = s.field.npcs.find((x) => x.def.id === id);
  if (n) n.paused = true;
}

/**
 * Remove every regular (non-boss) enemy still standing on the map, each with a puff of ki, so frozen mooks
 * don't loiter in the middle of a cutscene. `color` tints the puffs (e.g. pink when Black's clones fade).
 */
export function clearMooks(s: ScriptApi, color = '#c0c0c0'): number {
  const f = s.field;
  const gone = f.enemies.filter((e) => !e.isBoss && !e.puppet && !e.dead && e.state !== 'dying');
  for (const e of gone) f.fx.explode(e.x, e.y - 12, 12, color);
  f.enemies = f.enemies.filter((e) => !gone.includes(e));
  return gone.length;
}

/**
 * Drop any toasts still on screen. The field only ticks toasts while it is the top scene, so a fight toast
 * raised just before a cutscene would otherwise hang, frozen, over the dialogue that follows.
 * (Reaches into the field's private toast list; does nothing if that ever changes shape.)
 */
export function clearToasts(s: ScriptApi): void {
  const f = s.field as unknown as { toasts?: unknown[] };
  if (Array.isArray(f.toasts)) f.toasts.length = 0;
}

/** Object types that take the player off the current field (or save mid-scene) when used. */
const LEAVE_OBJECTS = new Set(['save', 'worldSign', 'flight']);

/**
 * Seal the arena for a scripted fight. The engine hands the player control during `s.fight`, and with it the
 * map's warps, edge exits, save points, world signs and flight circles; using any of them mid-fight swaps the
 * field, so the fight (and the scene waiting on it) never resumes. This keeps the field's exit cooldown topped
 * up every tick and parks those objects until the returned `release()` is called.
 * (Reaches into the field's private exit cooldown; if that ever changes shape only the objects are parked.)
 */
export function sealArena(s: ScriptApi): () => void {
  const f = s.field;
  const parked = f.map.objects.filter((o) => !o.gone && LEAVE_OBJECTS.has(o.def.type));
  for (const o of parked) o.gone = true;
  const cd = f as unknown as { exitCd?: unknown };
  let open = false;
  if (typeof cd.exitCd === 'number') {
    const hold = (): void => { cd.exitCd = Math.max(typeof cd.exitCd === 'number' ? cd.exitCd : 0, 2); };
    hold();
    void f.until(() => {
      if (open) return true;
      hold();
      return false;
    });
  }
  return () => {
    open = true;
    for (const o of parked) o.gone = false;
  };
}

/**
 * `s.fight` with the arena sealed (no warps, exits, save points or world signs while it runs) that also clears
 * fight toasts (phase calls, seal hints) before the cutscene that follows.
 */
export async function bout(s: ScriptApi, type: string, opts: FightOpts = {}): Promise<FightResult> {
  const release = sealArena(s);
  let r: FightResult;
  try {
    r = await s.fight(type, opts);
  } finally {
    release();
  }
  clearToasts(s);
  return r;
}

/** Heal only the active character to full (after scripted losses). */
export function patchUp(s: ScriptApi): void {
  const c = s.state.hero;
  c.hp = c.hpMax;
  c.ep = c.epMax;
}
