import type { Pose } from '../../../art/humanoid';
import type { Dir } from '../../../engine/math';
import type { FightOpts, FightResult, ScriptApi } from '../../../game/script';
import type { CharId } from '../../characters';
import { ENEMIES } from '../../enemies';
import { force } from '../common';

/**
 * Shared staging helpers for act 5. Hub maps are owned by other authors, so every spawn/warp on a hub
 * snaps to the nearest walkable tile instead of trusting hard-coded coordinates.
 */

/** True when an actor standing on tile (x, y) would not overlap terrain, props or gates. */
function walkable(s: ScriptApi, x: number, y: number): boolean {
  return !s.field.col.blocked({ x: x * 16 + 3, y: y * 16 + 8, w: 10, h: 6 });
}

/** Nearest walkable tile to (x, y) on the current map, searching outward in rings. */
export function freeNear(s: ScriptApi, x: number, y: number, maxR = 12): [number, number] {
  const rx = Math.round(x);
  const ry = Math.round(y);
  if (walkable(s, rx, ry)) return [rx, ry];
  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (walkable(s, rx + dx, ry + dy)) return [rx + dx, ry + dy];
      }
    }
  }
  return [rx, ry];
}

/** Spawn a cutscene actor on the nearest free tile. Returns the tile used. */
export function stage(s: ScriptApi, id: string, sprite: string, x: number, y: number, dir: Dir = 'down', name?: string): [number, number] {
  const [fx, fy] = freeNear(s, x, y);
  s.spawn(id, sprite, fx, fy, dir, name);
  return [fx, fy];
}

/** Spawn a talkable NPC at runtime (cutscene NPC that keeps a talk script after the scene). */
export function stageTalker(s: ScriptApi, id: string, sprite: string, x: number, y: number, talk: string, name?: string, dir: Dir = 'down'): void {
  const [fx, fy] = freeNear(s, x, y);
  const n = s.spawn(id, sprite, fx, fy, dir, name);
  n.def.talk = talk;
}

/** Warp, then nudge the hero onto a walkable tile if the target was blocked. */
export async function warpTo(s: ScriptApi, map: string, x: number, y: number, dir: Dir = 'down'): Promise<void> {
  await s.warp(map, x, y, dir);
  const [fx, fy] = freeNear(s, x, y);
  if (fx !== x || fy !== y) s.place('hero', fx, fy, dir);
}

/** Hero's current tile. */
export function heroTile(s: ScriptApi): [number, number] {
  const p = s.actor('hero');
  return [Math.floor(p.x / 16), Math.floor((p.y - 14) / 16)];
}

/**
 * Set while an act 5 scripted fight hands the player control. Walk-on exits, edge exits and event triggers on
 * act 5 maps (and the tournament stage overlays) are gated `!act5_busy`, so the player can neither walk off the
 * map nor re-fire the running event mid-fight. Every such map clears it on entry (`act5_map_enter`), so an
 * interrupted fight (Whis's Charm, a Game Over) never leaves it stuck.
 */
export const BUSY = 'act5_busy';

/**
 * Seal the current field for a scripted fight: set BUSY and switch off every flight circle, world-map sign and
 * save disc on the map (LoG2 never lets you save or leave mid-boss). Returns the function that unseals it.
 * A fight only resumes on the same field, so the unseal always applies to the objects it sealed.
 */
function seal(s: ScriptApi): () => void {
  const sealed = s.field.map.objects.filter((o) => !o.gone && (o.def.type === 'flight' || o.def.type === 'worldSign' || o.def.type === 'save'));
  for (const o of sealed) o.gone = true;
  s.set(BUSY);
  return () => {
    for (const o of sealed) o.gone = false;
    s.clear(BUSY);
  };
}

/**
 * Boss fight that also pays the boss's EXP when the fight ends at its scripted threshold
 * (kills already pay it). Leaves the boss on the map as a puppet; callers `remove` it.
 */
export async function bossFight(s: ScriptApi, type: string, opts: FightOpts = {}): Promise<FightResult> {
  s.heal();
  const unseal = seal(s);
  const r = await s.fight(type, opts);
  unseal();
  const exp = ENEMIES[type]?.exp ?? 0;
  if (r === 'end' && exp > 0) s.exp(exp);
  return r;
}

/** Field battle: hand control over until every enemy on the map is down, with the map sealed like a boss fight. */
export async function battle(s: ScriptApi): Promise<void> {
  const unseal = seal(s);
  await s.clearEnemies();
  unseal();
}

/**
 * Remember the active character before a forced segment. A replayed (interrupted) segment keeps the character
 * remembered the first time, not the forced one.
 */
export function rememberHero(s: ScriptApi, key: string): void {
  if (s.state.get(`act5_prev_${key}`) === undefined) s.set(`act5_prev_${key}`, s.hero);
}

/** Forced perspective switch for a story segment, with a short fade when the active character actually changes. */
export async function forceFade(s: ScriptApi, id: CharId): Promise<void> {
  if (s.hero === id) { force(s, id); return; }
  await s.fadeOut(12);
  force(s, id);
  await s.fadeIn(12);
}

/** The fighter leaving a relay hand-off, kept on the stage as a cutscene actor. */
export interface Outgoing {
  /** Actor id for the outgoing fighter. */
  id: string;
  name: string;
  /** Pose to hold (a knocked-out Goku, a hurt Frieza). */
  pose?: Pose;
}

/** Options for `handOff`. */
export interface HandOffOpts {
  /** Stage the outgoing fighter where the hero stood (drawn with the hero's current sprite and form). */
  out?: Outgoing;
  /** Where the incoming fighter stands, relative to the outgoing one (default one tile to the right). */
  dx?: number;
  dy?: number;
  /** Take the place of this cutscene actor instead (it is removed: the incoming fighter "was" that actor). */
  at?: string;
  /** Z form to hold the moment the incoming fighter appears. */
  form?: string;
  dir?: Dir;
}

/**
 * LoG2 relay hand-off (§12: fade-out, cutscene, fade-in). The screen fades out, the outgoing fighter stays on the
 * stage as an actor (so the next lines can address them), the next forced fighter takes over beside them, and the
 * screen fades back in. Without `out` or `at` the swap simply happens in the dark (a time skip).
 */
export async function handOff(s: ScriptApi, to: CharId, opts: HandOffOpts = {}): Promise<void> {
  const [hx, hy] = heroTile(s);
  const sprite = s.field.player.spriteId;
  const facing = s.field.player.dir;
  await s.fadeOut(16);
  s.pose('hero', null);
  s.show('hero', true);
  const swap = s.hero !== to;
  if (opts.out && swap) {
    stage(s, opts.out.id, sprite, hx, hy, facing, opts.out.name);
    if (opts.out.pose) s.pose(opts.out.id, opts.out.pose);
  }
  let tx = hx;
  let ty = hy;
  if (opts.at && s.exists(opts.at)) {
    const a = s.actor(opts.at);
    tx = Math.floor(a.x / 16);
    ty = Math.floor((a.y - 14) / 16);
    s.remove(opts.at);
  } else if (opts.out && swap) {
    tx = hx + (opts.dx ?? 1);
    ty = hy + (opts.dy ?? 0);
  }
  force(s, to);
  s.heal();
  const [fx, fy] = freeNear(s, tx, ty);
  s.place('hero', fx, fy, opts.dir ?? facing);
  if (opts.form) s.transformNow(opts.form);
  await s.fadeIn(16);
}

/** Switch back to the character remembered by `rememberHero` (ignores guests). */
export function restoreHero(s: ScriptApi, key: string): void {
  const prev = s.state.get(`act5_prev_${key}`);
  s.clear(`act5_prev_${key}`);
  if (typeof prev === 'string' && prev !== s.hero && prev !== 'android17' && prev !== 'frieza') {
    const id = prev as CharId;
    if (s.state.char(id)?.joined) s.switchTo(id);
  }
}

/** Bring a Tournament of Power guest (Android 17 / Frieza) up to strength without a party announcement. */
export function readyGuest(s: ScriptApi, id: 'android17' | 'frieza', level: number): void {
  s.state.join(id, level);
  if (id === 'android17') s.state.learn('android17', 'barrier');
  if (id === 'frieza') {
    s.state.learn('frieza', 'deathBeam');
    s.state.char('frieza').form = 'goldenFrieza';
  }
}

/** Run several walks/flights at once and wait for all of them. */
export async function together(...steps: Array<Promise<void>>): Promise<void> {
  await Promise.all(steps);
}

/** Remove actors if they exist (safe on hubs where an overlay NPC may be hidden). */
export function removeAll(s: ScriptApi, ...ids: string[]): void {
  for (const id of ids) if (s.exists(id)) s.remove(id);
}

/** Id of an NPC on the current map drawn with `sprite` (another act's overlay NPC counts), if any. */
export function npcWithSprite(s: ScriptApi, sprite: string): string | null {
  return s.field.npcs.find((n) => n.spriteId === sprite)?.def.id ?? null;
}

/**
 * Use the cutscene actor `id` if it already stands on the map (an overlay NPC), otherwise stage one.
 * Returns true when it was staged here (so the caller removes it afterwards).
 */
export function stageOrReuse(s: ScriptApi, id: string, sprite: string, x: number, y: number, dir: Dir = 'down', name?: string): boolean {
  if (s.exists(id)) return false;
  stage(s, id, sprite, x, y, dir, name);
  return true;
}

/**
 * Knock the free-roaming rival fighters off the stage before a staged Tournament of Power fight, so only the
 * scripted opponents remain. Scripted enemies (with a uid) are left alone. Returns how many were swept.
 */
export function sweepRivals(s: ScriptApi): number {
  let n = 0;
  for (const e of s.field.enemies) {
    if (e.uid || e.dead || e.state === 'dying') continue;
    s.boom(Math.round(e.x / 16), Math.round((e.y - 14) / 16), 12, '#f8e040');
    e.dead = true;
    n++;
  }
  return n;
}
