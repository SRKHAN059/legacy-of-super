import { audio } from '../../../engine/audio';
import { dist, norm } from '../../../engine/math';
import type { Actor } from '../../../game/actor';
import type { Enemy } from '../../../game/enemy';
import type { Field } from '../../../game/field';
import { Shot } from '../../../game/projectiles';
import type { ScriptApi } from '../../../game/script';
import { battle, freeNear, heroTile, stage } from './helpers';

/**
 * Chapter 14 fight mechanics built on the engine's scripted fights: a fighting partner (Hit, Android 18, Piccolo),
 * an invisible opponent's cues (Gamisalas) and a twin boss that regenerates (Saonel and Pirina).
 */

// ================================================================ per-frame routines

/** A per-frame routine bound to the field it was started on. */
export interface FrameLoop {
  /** End the routine (it also ends by itself when the field is left). */
  stop(): void;
  /** Resolves once the routine has ended. */
  readonly done: Promise<void>;
}

/**
 * Run `step` once per field tick, inside the field update (after actors and enemies have moved, before the frame
 * is drawn), until stopped or until another map replaces the field. It is a field wait, so it pauses with the
 * field (dialogue boxes, menus). A step that throws is logged and ends the routine.
 */
export function everyFrame(s: ScriptApi, step: (f: Field) => void): FrameLoop {
  const f = s.field;
  let on = true;
  let failed = false;
  const done = f.until(() => {
    if (!on || failed || f.abandoned) return true;
    try {
      step(f);
    } catch (err) {
      failed = true;
      console.error('[c14] per-frame routine failed', err);
      return true;
    }
    return false;
  }, true);
  return { stop: () => { on = false; }, done };
}

/** An enemy an ally (or the cues) may act on: alive, in the fight, visible and hittable. */
function inFight(e: Enemy): boolean {
  return !e.dead && e.state !== 'dying' && !e.ended && !e.puppet && !e.hidden && !e.def.invulnerable;
}

/** Step an actor toward a point with terrain collision (the void edge stops it). True once it has arrived. */
function stepTo(f: Field, a: Actor, x: number, y: number, speed: number): boolean {
  const d = Math.hypot(x - a.x, y - a.y);
  if (d < 2) { a.moving = false; return true; }
  const v = norm({ x: x - a.x, y: y - a.y });
  const r = f.col.move(a.box(), v.x * Math.min(speed, d), v.y * Math.min(speed, d));
  a.x += r.dx;
  a.y += r.dy;
  a.moving = r.dx !== 0 || r.dy !== 0;
  a.faceTo(x, y);
  return false;
}

// ================================================================ fighting partner

/** How a fighting partner attacks. */
export type AllyStyle =
  | 'strike' // closes in and punches (Android 18)
  | 'blast' // keeps its distance and fires ki blasts (Piccolo)
  | 'timeSkip'; // vanishes, reappears behind the target, strikes and freezes it in time (Hit)

/** A cutscene actor that fights beside the hero during a scripted fight. */
export interface AllySpec {
  /** Actor id; staged beside the hero unless it already stands on the map. */
  id: string;
  sprite: string;
  name: string;
  style: AllyStyle;
  /** Attack stat the blows roll with (the engine's damage formula, against the target's END). */
  atk: number;
  /** Damage multiplier per blow. */
  mult: number;
  /** Frames between attacks. */
  every: number;
  color: string;
  /** Frames a Time-Skip strike freezes its target in place. */
  freeze?: number;
  /** Enemy uids the partner goes after first. */
  prefer?: string[];
}

/** A running partner. */
export interface Ally extends FrameLoop {
  /** Attacks made so far. */
  readonly attacks: number;
}

/** Walking speed of a partner, px per frame. */
export const ALLY_SPEED = 1.5;
/** Preferred distance to the target per style, px. */
const ALLY_RANGE: Record<AllyStyle, number> = { strike: 16, blast: 76, timeSkip: 44 };

/** The enemy a partner should go after: a preferred uid first, then the nearest one in the fight. */
function pickTarget(f: Field, spec: AllySpec, a: Actor): Enemy | null {
  for (const uid of spec.prefer ?? []) {
    const e = f.enemies.find((x) => x.uid === uid);
    if (e && inFight(e)) return e;
  }
  let best: Enemy | null = null;
  let bd = Infinity;
  for (const e of f.enemies) {
    if (!inFight(e)) continue;
    const d = dist(a, e);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

/**
 * Start a fighting partner (LoG2 has none; the Tournament of Power's tag-teams need one). It follows the hero,
 * picks a target, and attacks on its own rhythm with the engine's damage rules: vulnerability flags, guards, poise
 * and ring-out knockback all apply. Enemies never target it. It pauses while the field is locked (dialogue).
 */
export function ally(s: ScriptApi, spec: AllySpec): Ally {
  if (!s.exists(spec.id)) {
    const [hx, hy] = heroTile(s);
    stage(s, spec.id, spec.sprite, hx - 1, hy + 1, 'up', spec.name);
  }
  const a = s.actor(spec.id);
  a.hidden = false;
  let cd = Math.round(spec.every / 2);
  let mode: 'move' | 'swing' | 'vanish' | 'appear' = 'move';
  let t = 0;
  let walk = 0;
  let attacks = 0;
  let target: Enemy | null = null;

  /** Land one blow on the target. */
  const blow = (f: Field, e: Enemy): void => {
    const v = norm({ x: e.x - a.x, y: e.y - a.y });
    const dealt = f.applyDamage(e, spec.atk, spec.mult, { x: v.x * 1.6, y: v.y * 1.6 }, 10, false);
    f.fx.hit(e.x, e.cy, spec.color, 5);
    audio.sfx(dealt > 0 ? 'hit' : 'block');
  };

  const loop = everyFrame(s, (f) => {
    if (f.locked) { a.moving = false; return; }
    t++;
    if (cd > 0) cd--;
    if (!target || !inFight(target)) target = pickTarget(f, spec, a);
    const e = target;
    switch (mode) {
      case 'move': {
        const p = f.player;
        if (!e) {
          // Nothing to fight: stay at the hero's side.
          if (dist(a, p) > 30) stepTo(f, a, p.x - 20, p.y + 6, ALLY_SPEED);
          else a.moving = false;
          break;
        }
        const d = dist(a, e);
        const range = ALLY_RANGE[spec.style];
        if (spec.style === 'blast' && d < range - 24) stepTo(f, a, a.x * 2 - e.x, a.y * 2 - e.y, ALLY_SPEED);
        else if (d > range) stepTo(f, a, e.x, e.y, ALLY_SPEED);
        else { a.moving = false; a.faceTo(e.x, e.y); }
        if (cd > 0) break;
        if (spec.style === 'strike' && d <= range + 6) {
          mode = 'swing';
          t = 0;
          a.scriptPose = 'punch1';
          a.faceTo(e.x, e.y);
        } else if (spec.style === 'blast' && d <= 150) {
          const v = norm({ x: e.x - a.x, y: e.y - a.y });
          const shot = new Shot('player', 'ball', a.x + v.x * 8, a.y + v.y * 4, v, 2.8, spec.mult, spec.color, spec.atk, 0);
          shot.r = 4;
          f.spawnShot(shot);
          audio.sfx('blast');
          attacks++;
          mode = 'swing';
          t = 0;
          a.scriptPose = 'blast';
          a.faceTo(e.x, e.y);
        } else if (spec.style === 'timeSkip') {
          mode = 'vanish';
          t = 0;
          audio.sfx('teleport');
        }
        break;
      }
      case 'swing':
        a.moving = false;
        if (spec.style === 'strike' && t === 3 && e) { blow(f, e); attacks++; }
        if (t >= 12) { a.scriptPose = null; mode = 'move'; cd = spec.every; }
        break;
      case 'vanish':
        a.moving = false;
        a.alpha = Math.max(0, 1 - t / 10);
        if (t < 10) break;
        if (!e) { a.alpha = 1; mode = 'move'; cd = spec.every; break; }
        {
          // Reappear on the far side of the target from the hero, so the two attack it from both sides.
          const side = Math.sign(e.x - f.player.x) || 1;
          for (const sx of [side, -side]) {
            const bx = e.x + sx * 16;
            if (!f.col.blocked({ x: bx - a.w / 2, y: e.y - a.h, w: a.w, h: a.h })) { a.x = bx; a.y = e.y; break; }
          }
          a.faceTo(e.x, e.y);
          f.fx.number(e.x, e.y - 40, 'TIME-SKIP', spec.color);
        }
        mode = 'appear';
        t = 0;
        break;
      case 'appear':
        a.alpha = Math.min(1, t / 4);
        if (t === 4 && e) {
          a.scriptPose = 'punch2';
          blow(f, e);
          attacks++;
          if (spec.freeze && inFight(e)) e.frozen = Math.max(e.frozen, spec.freeze);
        }
        if (t >= 16) { a.scriptPose = null; a.alpha = 1; mode = 'move'; cd = spec.every; }
        break;
    }
    // NPCs reset their walk cycle every update; keep the partner's own so it animates at a running pace.
    if (a.moving) walk += 1.8;
    a.running = a.moving;
    a.walkT = walk;
  });

  return {
    stop: () => {
      loop.stop();
      a.scriptPose = null;
      a.alpha = 1;
      a.moving = false;
    },
    done: loop.done,
    get attacks() { return attacks; },
  };
}

// ================================================================ invisible opponent

/** Cue timings for an invisible fighter, in frames. */
export const CLOAK = {
  /** Standing still this long lets Piccolo hear the footsteps. */
  listen: 60,
  /** A landed blow shows where he is for this long. */
  reveal: 50,
  /** A dust puff at his feet every N frames while he moves. */
  footstep: 10,
  /** His cloak flickers every N frames... */
  flicker: 150,
  /** ...for this many frames. */
  flickerLen: 4,
} as const;

/** What the player can currently pick up about an invisible fighter. */
export interface CloakState {
  /** Winding up an attack: the air ripples before he strikes. */
  windup: boolean;
  /** Frames left of the reveal after a landed blow. */
  reveal: number;
  /** Frames the hero has stood still (listening). */
  listen: number;
  /** Frames left of a cloak flicker. */
  flicker: number;
}

/** Cloak strength for one frame (1 = unseen): the strongest current cue wins. */
export function cloakLevel(c: CloakState): number {
  let k = 1;
  if (c.flicker > 0) k = Math.min(k, 0.6);
  if (c.windup) k = Math.min(k, 0.5);
  if (c.listen >= CLOAK.listen) k = Math.min(k, 0.45);
  if (c.reveal > 0) k = Math.min(k, 0.2);
  return k;
}

/** A running set of invisibility cues. */
export interface Cloak extends FrameLoop {
  /** The hero has stood still long enough to hear the footsteps. */
  readonly listening: boolean;
}

/**
 * Make the enemy `uid` invisible for the rest of its fight and drive the cues that give it away: dust puffs where
 * it steps, a shimmer while it winds up an attack, a flicker every few seconds, a short reveal after each landed
 * blow, and, while the hero stands still, Piccolo's hearing (a faint outline and the sound of its steps).
 * The cloak drops for good once the fight ends (scripted end, ring-out or knockout).
 */
export function cloakCues(s: ScriptApi, uid: string): Cloak {
  const st: CloakState = { windup: false, reveal: 0, listen: 0, flicker: 0 };
  let lastHp = -1;
  let n = 0;
  const loop = everyFrame(s, (f) => {
    const e = f.enemies.find((x) => x.uid === uid);
    if (!e || e.dead) return;
    if (e.ended || e.puppet || e.state === 'dying') { e.cloak = 0; return; }
    if (f.locked) return;
    n++;
    if (lastHp >= 0 && e.hp < lastHp) st.reveal = CLOAK.reveal;
    lastHp = e.hp;
    const p = f.player;
    st.listen = !p.moving && p.state === 'free' ? st.listen + 1 : 0;
    if (st.reveal > 0) st.reveal--;
    if (st.flicker > 0) st.flicker--;
    else if (n % CLOAK.flicker === 0) st.flicker = CLOAK.flickerLen;
    st.windup = e.state === 'windup';
    if (e.moving && n % CLOAK.footstep === 0) f.fx.dust(e.x, e.y);
    if (st.listen === CLOAK.listen) f.fx.number(p.x, p.y - 40, '...', '#e8f0ff');
    if (st.listen >= CLOAK.listen && n % 20 === 0) f.fx.hit(e.x, e.cy, '#e8f0ff', 3);
    e.cloak = cloakLevel(st);
  });
  return { stop: loop.stop, done: loop.done, get listening() { return st.listen >= CLOAK.listen; } };
}

// ================================================================ twin boss

/** One half of a twin boss. */
export interface TwinSpec {
  type: string;
  uid: string;
  /** Spawn tile (snapped to the stage). */
  x: number;
  y: number;
}

/** Where a twin ended up when the fight was over. */
export interface TwinOutcome {
  uid: string;
  x: number;
  y: number;
  /** Knocked off the stage during the fight (it is gone, not lying on the stage). */
  ringedOut: boolean;
}

/** Twin regeneration rules. */
export const TWIN = {
  /** HP fraction a downed twin gets back when its partner did not fall in time. */
  regen: 0.6,
  /** HUD countdown label for the regeneration window. */
  label: 'REGEN',
} as const;

/** A downed twin gets back up (Namekian regeneration). */
function regenerate(f: Field, e: Enemy): void {
  e.ended = false;
  e.state = 'chase';
  e.pose = 'idle';
  e.hp = Math.max(e.hp, Math.round(e.maxHp * TWIN.regen));
  e.flash = 8;
  e.armorT = 60;
  f.fx.explode(e.x, e.y - 12, 16, '#70e070');
  f.fx.number(e.x, e.y - 34, 'REGENERATED', '#70e070');
  audio.sfx('powerUp');
}

/**
 * Twin boss fight (Saonel and Pirina). Both fight at once and the boss bar follows whichever standing twin is
 * closer to falling. A twin brought to its scripted end goes down, and the other must follow within `windowSec`
 * seconds (HUD countdown) or the downed twin regenerates with TWIN.regen of its HP. A twin knocked off the stage
 * stays out. Resolves when both are down. Neither pays EXP here: the caller pays one reward for the pair.
 */
export async function twinFight(s: ScriptApi, twins: readonly [TwinSpec, TwinSpec], windowSec: number): Promise<TwinOutcome[]> {
  const f = s.field;
  const foes = twins.map((t) => {
    const [x, y] = freeNear(s, t.x, t.y);
    return s.spawnEnemy(t.type, x, y, t.uid);
  });
  const down = (e: Enemy): boolean => e.ended || e.dead || e.state === 'dying';
  const clearTimer = (): void => { if (f.timer?.label === TWIN.label) f.timer = null; };
  const watch = everyFrame(s, () => {
    const up = foes.filter((e) => !down(e));
    if (!up.length) {
      // Both down together: they leave the fight, which lets the field battle end.
      for (const e of foes) if (!e.dead && e.state !== 'dying') e.die();
      f.boss = null;
      clearTimer();
      return;
    }
    f.boss = up.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a));
    const fallen = foes.find((e) => e.ended && !e.hidden);
    if (!fallen) { clearTimer(); return; }
    if (f.timer?.label !== TWIN.label) { f.timer = { frames: Math.round(windowSec * 60), label: TWIN.label }; return; }
    if (f.timer.frames > 0) return;
    regenerate(f, fallen);
    clearTimer();
  });
  try {
    await battle(s);
  } finally {
    watch.stop();
    f.boss = null;
    clearTimer();
  }
  return foes.map((e, i) => ({ uid: twins[i].uid, x: Math.floor(e.x / 16), y: Math.floor((e.y - 14) / 16), ringedOut: e.hidden }));
}
