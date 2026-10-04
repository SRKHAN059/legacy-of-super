import { TILE } from '../../../engine/constants';
import type { Dir } from '../../../engine/math';
import type { Enemy } from '../../../game/enemy';
import type { Field } from '../../../game/field';
import type { FightResult, Script, ScriptApi } from '../../../game/script';
import { ENEMIES } from '../../enemies';

/** Shared staging helpers for the act 3 scripts (Chapters 6-8). */

/** Story beats currently running, per map visit (the Field object). */
const RUNNING = new WeakMap<Field, Set<string>>();

/**
 * Wrap a story beat so only one copy of it runs per map visit. Step-on triggers stay live while a scripted fight
 * hands control back, so walking out of and back into a beat's trigger mid-fight would otherwise start a second
 * copy (duplicate boss, stacked locks). The mark lives on the Field object: it is never saved, and it resets
 * whenever the map is (re)loaded, so a beat abandoned through a Game Over or a save/reload can always be replayed.
 */
export function exclusive(id: string, body: Script): Script {
  return async (s) => {
    const field = s.field;
    let running = RUNNING.get(field);
    if (!running) {
      running = new Set();
      RUNNING.set(field, running);
    }
    if (running.has(id)) return;
    running.add(id);
    try {
      await body(s);
    } finally {
      running.delete(id);
    }
  };
}

/** Inclusive tile rectangle (hero feet position) used by `inArena`. */
export interface ArenaBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Keep the hero inside `box` while `pending` (a fight or a wave) is unresolved: an invisible arena wall, so a staged
 * battle cannot be walked out of through a door, a map exit, a flight circle or a save point (which would strand
 * the beat's script on a map that no longer exists). Resolves with `pending`'s value.
 */
export function inArena<T>(s: ScriptApi, pending: Promise<T>, box: ArenaBox): Promise<T> {
  const minX = box.x0 * TILE + 8;
  const maxX = box.x1 * TILE + 8;
  const minY = box.y0 * TILE + 14;
  const maxY = box.y1 * TILE + 14;
  const field = s.field;
  const clampHero = (): void => {
    const p = field.player;
    p.x = Math.min(maxX, Math.max(minX, p.x));
    p.y = Math.min(maxY, Math.max(minY, p.y));
  };
  clampHero();
  return duringFight(s, pending, 1, clampHero);
}

/** Remove every wild (uid-less) enemy from the current map so a scripted boss fight is one-on-one. */
export function clearWild(s: ScriptApi): void {
  s.field.enemies = s.field.enemies.filter((e) => !!e.uid);
}

/** Spawn a cutscene actor unless one with this id is already on the map; returns true if it was spawned. */
export function cast(s: ScriptApi, id: string, sprite: string, x: number, y: number, dir: Dir = 'down', name?: string): boolean {
  if (s.exists(id)) {
    s.place(id, x, y, dir);
    s.show(id, true);
    return false;
  }
  s.spawn(id, sprite, x, y, dir, name);
  return true;
}

/** Remove several actors if present (safe on maps where some never spawned). */
export function dismiss(s: ScriptApi, ...ids: string[]): void {
  for (const id of ids) if (s.exists(id)) s.remove(id);
}

/** Hide a map NPC for the rest of this visit if it is present. */
export function hide(s: ScriptApi, id: string): void {
  if (s.exists(id)) s.show(id, false);
}

/** Pixel distance between two actors (feet positions). */
export function gap(s: ScriptApi, a: string, b: string): number {
  const A = s.actor(a);
  const B = s.actor(b);
  return Math.hypot(A.x - B.x, A.y - B.y);
}

/** Award a boss's scripted EXP when its fight ended at the HP threshold instead of a kill. */
export function bossExp(s: ScriptApi, type: string, result: FightResult): void {
  const def = ENEMIES[type];
  if (!def) throw new Error(`[act3] unknown boss ${type}`);
  if (result === 'win') return; // Kills already paid the EXP.
  s.exp(result === 'end' ? def.exp : Math.round(def.exp / 2));
}

/**
 * Spawn a boss on the map (so its HP or stats can be adjusted first) and return it.
 * Use with `s.fight(type, { uid, existing: true })`.
 */
export function stageBoss(s: ScriptApi, type: string, x: number, y: number, uid: string, hpFrac = 1): Enemy {
  const e = s.spawnEnemy(type, x, y, uid);
  e.hp = Math.max(1, Math.round(e.maxHp * hpFrac));
  e.puppet = true;
  return e;
}

/**
 * Run `tick` every `every` frames while `fight` is pending (heat auras, hazards, taunts) and resolve with the
 * fight's result. The loop stops as soon as the fight resolves.
 */
export async function duringFight<T>(s: ScriptApi, fight: Promise<T>, every: number, tick: () => void): Promise<T> {
  let running = true;
  const field = s.field;
  const loop = async (): Promise<void> => {
    while (running && s.field === field) {
      await field.wait(every);
      if (running && s.field === field) tick();
    }
  };
  void loop();
  try {
    return await fight;
  } finally {
    running = false;
  }
}

/** Knock an actor out of the ring: a fast slide toward `x,y`, a hurt pose, then a KO slump. */
export async function knockOut(s: ScriptApi, id: string, x: number, y: number): Promise<void> {
  s.pose(id, 'hurt');
  s.shake(14, 2);
  s.flash('#ffffff', 6);
  s.sfx('hit');
  await s.walk(id, x, y, 4);
  s.pose(id, 'ko');
  s.sfx('explode');
  s.shake(10, 2);
}

/** Tile centre (pixels) of an actor, for effects. */
export function tileOf(s: ScriptApi, id: string): { x: number; y: number } {
  const a = s.actor(id);
  return { x: Math.floor(a.x / TILE), y: Math.floor(a.y / TILE) };
}

/** Reload the current map at the hero's tile so overlay NPCs, props and warps reflect flags set during a cutscene. */
export async function reloadHere(s: ScriptApi, dir: Dir = 'down'): Promise<void> {
  const p = s.field.player;
  await s.warp(s.field.def.id, Math.floor(p.x / TILE), Math.floor(p.y / TILE), dir);
}

/** Place a decorative prop at runtime (tile coords, fractional allowed); replaces a prop with the same id. */
export function addProp(s: ScriptApi, kind: string, x: number, y: number, id: string): void {
  s.field.map.removeProp(id);
  s.field.map.addProp(kind, x * TILE, y * TILE, id);
}

/** Remove a runtime or map prop by id. */
export function dropProp(s: ScriptApi, id: string): void {
  s.field.map.removeProp(id);
}
