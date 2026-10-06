import { TILE } from '../../../engine/constants';
import type { Dir, Rect } from '../../../engine/math';
import type { FightOpts, FightResult, ScriptApi } from '../../../game/script';
import { QUESTS } from '../../quests';
import { namedScanCount } from '../../scans';
import { SPOTS } from '../../world';

/** Shared staging helpers for Act 1 scripts. */

/**
 * Transient flag that is set while a scripted fight has sealed the map (see `seal`). Beat scripts that a trigger,
 * an NPC or the A button could start a second time mid-fight check it and bail out. It never reaches a save file,
 * because saving is impossible while it is set.
 */
export const SEALED = 'c00_sealed';
const SEAL_TAG = 'c00_seal';

/**
 * Seal the current map for a scripted fight. Fights hand control back to the player, and the engine keeps doors,
 * edge exits, save discs, world-map signs and flight circles live meanwhile; leaving the map would strand the fight's
 * script on the old field forever. While sealed: every warp and edge exit is walled off, save discs and world signs
 * stop answering the A button (it throws a punch instead) and flight circles power down. Returns the undo function.
 */
export function seal(s: ScriptApi): () => void {
  const f = s.field;
  const pb = f.player.box();
  const touches = (r: Rect) => pb.x < r.x + r.w && pb.x + pb.w > r.x && pb.y < r.y + r.h && pb.y + pb.h > r.y;
  // Never drop a wall on top of the hero (he would be stuck inside it).
  const wall = (r: Rect) => { if (!touches(r)) f.col.addRect(r, SEAL_TAG); };
  for (const w of f.def.warps ?? []) wall({ x: w.x * TILE - 2, y: w.y * TILE - 2, w: w.w * TILE + 4, h: w.h * TILE + 4 });
  const { pw, ph } = f.map;
  const ex = f.def.exits ?? {};
  const E = 4;
  if (ex.north) wall({ x: 0, y: 0, w: pw, h: E });
  if (ex.south) wall({ x: 0, y: ph - E, w: pw, h: E });
  if (ex.west) wall({ x: 0, y: 0, w: E, h: ph });
  if (ex.east) wall({ x: pw - E, y: 0, w: E, h: ph });
  const off = f.map.objects.filter((o) => !o.gone && (o.def.type === 'save' || o.def.type === 'worldSign' || o.def.type === 'flight'));
  const pads: string[] = [];
  off.forEach((o, i) => {
    o.gone = true;
    // A powered-down circle stays visible where the live one was.
    if (o.def.type === 'flight') { const id = `${SEAL_TAG}${i}`; f.map.addProp('c00_deadPad', o.rect.x, o.rect.y, id); pads.push(id); }
  });
  s.set(SEALED);
  return () => {
    f.col.removeTag(SEAL_TAG);
    for (const o of off) o.gone = false;
    for (const id of pads) f.map.removeProp(id);
    s.clear(SEALED);
  };
}

/** `s.fight` on a sealed map (see `seal`). Every Act 1 scripted fight goes through here. */
export async function arenaFight(s: ScriptApi, type: string, opts: FightOpts = {}): Promise<FightResult> {
  const undo = seal(s);
  try {
    return await s.fight(type, opts);
  } finally {
    undo();
  }
}

/** `s.clearEnemies` on a sealed map (see `seal`). */
export async function arenaClear(s: ScriptApi): Promise<void> {
  const undo = seal(s);
  try {
    await s.clearEnemies();
  } finally {
    undo();
  }
}

/** An optional errand that a chapter's point of no return wraps up (see `pointOfNoReturn`). */
export interface Errand {
  quest: string;
  /** True when the deliverable is in hand, so the errand can be finished on the spot. */
  ready?: (s: ScriptApi) => boolean;
  /** Hand the deliverable over off-screen: one line of narration plus the errand's usual rewards. */
  deliver?: (s: ScriptApi) => Promise<void>;
}

/** Remove a journal entry the story can no longer finish, so it does not sit in the Journal as "active" forever. */
export function dropQuest(s: ScriptApi, id: string): void {
  const d = s.state.data;
  if (d.journal[id] !== 'active') return;
  delete d.journal[id];
  d.journalOrder = d.journalOrder.filter((q) => q !== id);
}

/**
 * A chapter's point of no return. When none of `errands` is open this returns true at once. Otherwise the narrator
 * lists them and asks `question` with the options [`stay`, `go`]; "stay" returns false so the player can finish them
 * first. On "go" every open errand is closed: one whose deliverable is in hand is handed over off-screen with its
 * usual rewards, the rest are dropped from the Journal.
 */
export async function pointOfNoReturn(s: ScriptApi, errands: Errand[], question: string, stay: string, go: string): Promise<boolean> {
  const open = errands.filter((e) => s.check(`quest:${e.quest}`));
  if (!open.length) return true;
  await s.narrate(`Unfinished errands: ${open.map((e) => QUESTS[e.quest]?.title ?? e.quest).join('; ')}.`);
  if (await s.ask('narrator', question, [stay, go]) === 0) return false;
  for (const e of open) {
    if (e.ready?.(s) && e.deliver) await e.deliver(s);
    else dropQuest(s, e.quest);
  }
  return true;
}

/** True the first time it is called for `flag` (and sets the flag). */
export function once(s: ScriptApi, flag: string): boolean {
  if (s.flag(flag)) return false;
  s.set(flag);
  return true;
}

/** Spawn a cutscene actor unless one with that id is already on the map. */
export function actor(s: ScriptApi, id: string, sprite: string, x: number, y: number, dir: Dir = 'down', name?: string): string {
  if (!s.exists(id)) s.spawn(id, sprite, x, y, dir, name);
  else s.place(id, x, y, dir);
  return id;
}

/**
 * Spawn (or place) an actor that the player can talk to afterwards on this same visit. Overlay NPCs gated by a
 * flag only appear when a map is (re)loaded, so story beats that introduce an NPC mid-visit use this.
 */
export function talker(s: ScriptApi, id: string, sprite: string, x: number, y: number, dir: Dir, name: string, talk: string): string {
  if (s.exists(id)) { s.place(id, x, y, dir); s.show(id, true); }
  else s.spawn(id, sprite, x, y, dir, name).def.talk = talk;
  return id;
}

/** Remove several actors if present. */
export function removeAll(s: ScriptApi, ids: string[]): void {
  for (const id of ids) if (s.exists(id)) s.remove(id);
}

/** The hero's current tile (rounded). */
export function heroTile(s: ScriptApi): [number, number] {
  const p = s.field.player;
  return [Math.floor(p.x / TILE), Math.floor((p.y - 8) / TILE)];
}

/** True when an actor-sized box can stand on tile (tx, ty). */
export function walkable(s: ScriptApi, tx: number, ty: number): boolean {
  const f = s.field;
  if (tx < 0 || ty < 0 || tx >= f.map.cols || ty >= f.map.rows) return false;
  return !f.col.blocked({ x: tx * TILE + 3, y: ty * TILE + 8, w: 10, h: 6 });
}

/** Nearest walkable tile to (tx, ty), searching outward in rings. Falls back to the hero's tile. */
export function freeTile(s: ScriptApi, tx: number, ty: number, maxR = 8): [number, number] {
  const x0 = Math.round(tx);
  const y0 = Math.round(ty);
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (walkable(s, x0 + dx, y0 + dy)) return [x0 + dx, y0 + dy];
      }
    }
  }
  return heroTile(s);
}

/** Free tile offset from the hero (used when a scene can happen anywhere on a map). */
export function nearHero(s: ScriptApi, dx: number, dy: number): [number, number] {
  const [hx, hy] = heroTile(s);
  return freeTile(s, hx + dx, hy + dy);
}

/** Begin a cutscene: letterbox on and an optional pan. */
export async function scene(s: ScriptApi, x?: number, y?: number, frames = 30): Promise<void> {
  s.letterbox(true);
  if (x !== undefined && y !== undefined) await s.pan(x, y, frames);
}

/** End a cutscene: camera back on the hero, letterbox off. */
export function endScene(s: ScriptApi): void {
  s.follow();
  s.letterbox(false);
}

/** Show an emote over an actor if it exists (safe in smoke tests). */
export async function emote(s: ScriptApi, id: string, symbol: string): Promise<void> {
  if (s.exists(id)) await s.emote(id, symbol);
}

/** Reset a scripted-fight hostility override so towns become safe again. */
export function calm(s: ScriptApi): void {
  s.field.forceHostile = null;
}

/**
 * Unlock a world-map landing spot with LoG2's narrator line ("X has been added to the world map!").
 * Silent when the spot was already unlocked.
 */
export async function unlockSpot(s: ScriptApi, spot: string): Promise<void> {
  if (s.state.data.regions.includes(spot)) return;
  s.unlockRegion(spot);
  s.sfx('item');
  await s.narrate(`${SPOTS[spot]?.name ?? 'A new place'} has been added to the world map!`);
}

/**
 * Scripted flight-circle hop (lift off, white-out, land elsewhere): mirrors the engine's own flight circle for the
 * moment a circle comes back to life mid-visit (flight circles are only rebuilt when a map loads).
 */
export async function flyHop(s: ScriptApi, map: string, x: number, y: number, dir: Dir): Promise<void> {
  s.sfx('dash');
  s.pose('hero', 'fly');
  s.flash('#fff8c0', 12);
  await s.lift('hero', 24, 24);
  await s.warp(map, x, y, dir);
  s.field.player.z = 24;
  s.pose('hero', 'fly');
  await s.lift('hero', 0, 12);
  s.pose('hero', null);
}

/**
 * Number of distinct named characters scanned with the Scouter (excluding anonymous townsfolk), counted like the
 * database and the pause screen: an old save's variant id (`npc:vegetaCasual`) and its base are one character.
 */
export function scanCount(s: ScriptApi): number {
  return namedScanCount(s.state.data.scans);
}
