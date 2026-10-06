import '../src/content';
import { CHARACTERS, FORMS, type CharId } from '../src/content/characters';
import { ENEMIES, registerEnemies, type BossMove, type EnemyDef } from '../src/content/enemies';
import { MAPS, registerMaps, resolveMap } from '../src/content/registry';
import { TECHNIQUES, type Technique } from '../src/content/techniques';
import { SPOTS } from '../src/content/world';
import { terrainSolid } from '../src/art/tiles';
import { TILE } from '../src/engine/constants';
import { BUTTONS, type Button } from '../src/engine/input';
import { dirVec, overlaps, Rng, type Dir, type Rect } from '../src/engine/math';
import { enemyMaxHp, type Enemy } from '../src/game/enemy';
import { Field } from '../src/game/field';
import type { Game } from '../src/game/game';
import { damage, ENEMY_POWER, enemyPowerScale, MELEE_POWER } from '../src/game/leveling';
import type { EnemySpawn, MapDef } from '../src/game/mapdef';
import type { Player } from '../src/game/player';
import { registerScripts, ScriptApi, type FightOpts, type FightResult, type ScriptCtx } from '../src/game/script';
import { GameState, type CharState, type SaveData } from '../src/game/state';
import { parseGrid } from '../src/game/world';
import { Sim, type RecordedFight, type RecordedRoot } from './sim';
// @ts-expect-error -- Node built-in; the project ships no @types/node (only the opt-in replay trace writes files).
import { appendFileSync } from 'node:fs';

/**
 * Fair-play balance harness (critic gap 1). The test Sim wins fights by dealing 255-power hits and keeping the hero at
 * full HP; `FairBot` instead plays a scripted fight the way a person holding a GBA pad does, through the real engine:
 *
 * - every action is a button injected into `Input` (walk, double-tap run, A combos, hold-A charged melee, B ki, L to
 *   pick a technique or the Z slot, Start -> Items -> A to eat a Senzu), so the real damage formulas run both ways,
 *   the hero takes hits, boss poise, hitstun, EP drain and the transformation gauge all apply;
 * - it approaches and lines up for the 3-hit combo, uses the techniques the character actually knows (ki shots,
 *   beams, charged balls, lobbed blasts, stun shots, sword waves, the Victory-Pose freeze) at range, the charged
 *   melee when learnt, transforms when the Z gauge is full, eats a Senzu (or a Fish) from the save's real inventory
 *   below 30% HP, sidesteps telegraphed beams, bull charges and ki rain only some of the time and with a reaction
 *   delay, mashes out of grabs, picks up food and smashes recovery rocks when hurt;
 * - it plays fight puzzles the way the on-screen hints say (an untouchable boss: press the glowing pillars, break the
 *   wards / reactor / formation first), herds ring-out bosses toward the void and kites in survival fights.
 *
 * `replayRoot` re-runs a recorded story script (tests/sim.ts `recordFights`) from the save it started with, so every
 * fight is measured in its real context: the map, the party level a full-game run reaches, the forced or guest
 * character, the HP and Senzu left over from earlier fights in the same script, its waves, allies and puzzles.
 */

// ------------------------------------------------------------------------------------------------ skill model

/** How well the bot plays: an attentive, non-expert player (frame-perfect play would hide difficulty spikes). */
export const SKILL = {
  /** Frames between a threat appearing and the bot reacting to it. */
  reaction: [10, 22] as const,
  /** Chance to sidestep a telegraphed boss beam (36-frame warning line). */
  dodgeBeam: 0.6,
  /** Chance to sidestep a bull charge / dash / grab wind-up. */
  dodgeCharge: 0.45,
  /** Chance to step out of ki-rain target marks. */
  dodgeRain: 0.5,
  /** Chance to sidestep an incoming ki shot. */
  dodgeShot: 0.2,
  /** Chance to step away while a teleporting boss fades back in beside the hero. */
  dodgeTeleport: 0.35,
  /** Chance to punish a bull-charge wind-up with a combo when already in reach (LoG2 punish). */
  punish: 0.35,
  /** Chance to wait out a boss's guard instead of punching into it (a guard takes 80% off). */
  respectGuard: 0.7,
  /** Frames the bot waits after a combo before engaging again (re-positioning; LoG2 bosses break a chase-lock). */
  comboPause: [6, 30] as const,
  /** HP fraction that sends the bot to the menu for a Senzu Bean (or a Fish when none are left). */
  healAt: 0.3,
  /** Same threshold in survival fights, where a knock-out ends the attempt. */
  healAtSurvive: 0.4,
  /** Chance to open an engagement with the charged melee when it is learnt. */
  charged: 0.3,
  /** Chance to take a ki shot / beam when lined up at range (otherwise close in for melee). */
  kiAppetite: 0.7,
} as const;

/** Frames before a fight may be given up as stuck (5 minutes of play): the Sim's test bot then finishes it. */
export const FIGHT_CAP = 5 * 60 * 60;

/**
 * Hard per-fight cap, in replay ticks: a fight still unresolved a minute after the test bot took it over (something
 * neither bot can do: a hidden enemy, a trigger nobody can reach) is recorded as a 'capped' loss and the replay stops
 * there, so no test ever spins to the replay's tick budget. Two minutes past FIGHT_CAP, so that mid-fight dialogue
 * (which holds the field's clock but not the replay's) never cuts short a fight the test bot is finishing.
 */
export const BOUT_CAP = FIGHT_CAP + 2 * 60 * 60;

/** Replay ticks with no fight running and none starting before the replay is given up as stalled (10 minutes of play). */
export const IDLE_CAP = 10 * 60 * 60;

/** Replay ticks with no script running (and no fight) after which the root script counts as over. */
const SCRIPT_OVER = 600;

// ------------------------------------------------------------------------------------------------ hits ratio

/** The critic's difficulty estimate for one fight (scratchpad bal.txt): melee hits to the boss's end / boss hits to KO. */
export interface HitsRatio {
  heroHit: number;
  hitsToEnd: number;
  bossHit: number;
  hitsToKO: number;
  ratio: number;
}

/** Fighter stats the ratio needs (form bonus already applied). */
export interface RatioHero {
  str: number;
  end: number;
  hpMax: number;
}

/**
 * Hits ratio exactly as bal.txt computes it: one average un-critted melee hit (MELEE_POWER, mult 1, rand(26) = 12)
 * against the boss's END and melee resistance, the HP the boss must lose before its scripted end (a Perfect-Cell
 * refill adds the refilled bar), and one average boss hit (ENEMY_POWER x enemyPowerScale(STR), mult 1) against the
 * hero's END.
 */
export function hitsRatio(hero: RatioHero, def: EnemyDef): HitsRatio {
  const b = def.boss;
  const hp = enemyMaxHp(def);
  const endAt = b?.endAt ?? 0;
  const toEnd = b?.refillAt !== undefined
    ? hp * (1 - b.refillAt) + (b.refillTo ?? hp) * (1 - endAt)
    : hp * (1 - endAt);
  const heroHit = damage({ power: MELEE_POWER, mult: 1, stat: hero.str, end: def.end, res: def.resMelee ?? 1, crit: false, r26: 12 });
  const bossHit = damage({ power: ENEMY_POWER, mult: enemyPowerScale(def.str), stat: def.str, end: hero.end, res: 1, crit: false, r26: 12 });
  const hitsToEnd = Math.ceil(toEnd / heroHit);
  const hitsToKO = Math.ceil(hero.hpMax / bossHit);
  return { heroHit, hitsToEnd, bossHit, hitsToKO, ratio: Math.round((hitsToEnd / hitsToKO) * 10) / 10 };
}

/** The hero's STR/END in a form (`max` forms pin to 100, like Player.str/end). */
export function formStats(cs: CharState, form: string | null): RatioHero {
  const f = form ? FORMS[form] : undefined;
  if (f?.bonus === 'max') return { str: 100, end: 100, hpMax: cs.hpMax };
  const bonus = typeof f?.bonus === 'number' ? f.bonus : 0;
  return { str: cs.str + bonus, end: cs.end + bonus, hpMax: cs.hpMax };
}

// ------------------------------------------------------------------------------------------------ geometry

/** Player.front() for an arbitrary facing (the engine's melee reach rectangle). */
function frontRect(x: number, y: number, dir: Dir, reach: number, width = 18): Rect {
  const v = dirVec(dir);
  const midY = y - 12;
  if (v.x !== 0) return { x: v.x > 0 ? x + 4 : x - 4 - reach, y: midY - width / 2, w: reach, h: width };
  if (v.y > 0) return { x: x - width / 2, y: y - 6, w: width, h: reach };
  return { x: x - width / 2, y: y - 20 - reach, w: width, h: reach };
}

/** Feet positions from which a melee swing facing `dir` overlaps `body`: [xLo, xHi, yLo, yHi] (open ranges). */
function strikeRange(body: Rect, dir: Dir, reach: number): [number, number, number, number] {
  const { x: bx, y: by, w: bw, h: bh } = body;
  switch (dir) {
    case 'right': return [bx - 4 - reach, bx + bw - 4, by + 3, by + bh + 21];
    case 'left': return [bx + 4, bx + bw + 4 + reach, by + 3, by + bh + 21];
    case 'down': return [bx - 9, bx + bw + 9, by + 6 - reach, by + bh + 6];
    default: return [bx - 9, bx + bw + 9, by + 20, by + bh + 20 + reach];
  }
}

/** Where to stand to strike `body` facing `dir`: on the attacking side of the range, centred across it. */
function strikeSpot(body: Rect, dir: Dir, reach: number): { x: number; y: number } {
  const [x0, x1, y0, y1] = strikeRange(body, dir, reach);
  const k = dir === 'right' ? 0.35 : dir === 'left' ? 0.65 : 0.5;
  const j = dir === 'down' ? 0.3 : dir === 'up' ? 0.7 : 0.5;
  return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * j };
}

/** A ki shot fired facing `dir` from (x, y) passes through `body` (shot band at hand height, r = 3). */
function kiLine(x: number, y: number, dir: Dir, body: Rect): boolean {
  const v = dirVec(dir);
  if (v.x !== 0) {
    const y0 = y - 17;
    const y1 = y - 11;
    if (!(y0 < body.y + body.h && y1 > body.y)) return false;
    return v.x > 0 ? body.x + body.w > x : body.x < x;
  }
  if (!(x - 3 < body.x + body.w && x + 3 > body.x)) return false;
  return v.y > 0 ? body.y + body.h > y : body.y < y - 14;
}

const KEY: Record<Dir, Button> = { left: 'left', right: 'right', up: 'up', down: 'down' };

/** Engine internals the bot reads the way a player reads the screen (poses, timers, telegraph marks). */
type PlayerView = { t: number; chargeT: number; special: { style: string; t: number; extra: number } | null; kiCharge: { tech: Technique; lv: number; t: number } | null };
type EnemyView = { move: BossMove | null; marks: Array<{ x: number; y: number; t: number }>; hitCount: number };
type PauseView = { page: string; itemSel: number; message: string | null; items(): Array<{ id: string }> };

// ------------------------------------------------------------------------------------------------ one fight's record

/** What one scripted fight cost the bot on one seed. */
export interface FightRun {
  /** Recording order of the fight this run matches (-1 for a fight the recording never saw). */
  seq: number;
  kind: 'boss' | 'wave';
  type: string;
  uid: string;
  opts: FightOpts;
  /** 1 = first try; a script that repeats a lost fight gets attempt 2 (played by the assist bot). */
  attempt: number;
  /** 'capped': still unresolved at BOUT_CAP, a timeout loss (the replay stopped there). */
  result: FightResult | 'cleared' | 'unreached' | 'capped';
  /** The hero was knocked out (a Game Over in the real game unless the fight is `loseOk`). */
  ko: boolean;
  /** The bot could not finish it fairly (knocked out, or stuck past FIGHT_CAP) and the test bot finished it. */
  assisted: boolean;
  frames: number;
  senzu: number;
  fish: number;
  cookies: number;
  hero: CharId;
  level: number;
  /** Form the hero fought in (or could transform into). */
  form: string | null;
  hpStart: number;
  hpEnd: number;
  hpMax: number;
  /** Damage the hero took (after healing items). */
  taken: number;
  /** Boss HP fraction left (1 for waves). */
  bossLeft: number;
  /** When the hero was knocked out: frame and boss HP fraction at that moment (-1 = never). */
  koFrame: number;
  bossAtKo: number;
  /** Melee hits landed / ki techniques fired / Z transformations completed / beams dodged. */
  melee: number;
  ki: number;
  transforms: number;
  dodges: number;
  ratio: HitsRatio | null;
}

// ------------------------------------------------------------------------------------------------ the bot

/** A queued menu macro: open the pause menu, page to Items, eat one item, close. */
interface MenuMacro {
  item: string;
  step: number;
  t: number;
  /** Release every button on the next tick (each press must be a fresh edge). */
  gap: boolean;
}

/** One running fight as the bot sees it. */
interface Bout {
  run: FightRun;
  boss: Enemy | null;
  survive: boolean;
  started: number;
  inv0: { senzu: number; fish: number; cookie: number };
}

/**
 * The fair player. Attach with `sim.driver = (s) => bot.step()` on a Sim with `fair = true`; it acts only while a
 * scripted fight hands the player control and leaves dialogue, menus and cutscenes to the Sim's reader.
 */
export class FairBot {
  readonly sim: Sim;
  readonly rng: Rng;
  bout: Bout | null = null;
  /** The bot gave up on the current fight (knocked out or stuck): the Sim's test bot finishes it. */
  assisting = false;
  private want = new Set<Button>();
  private held = new Set<Button>();
  private menu: MenuMacro | null = null;
  private pauseT = 0;
  /** The current engagement: whom, from which side, charged melee or not, and the technique to open with. */
  private plan: { target: Enemy | null; dir: Dir; charged: boolean; ki: Technique | null } | null = null;
  private decided = new WeakMap<object, { dodge: boolean; at: number }>();
  private dodgeT = 0;
  private dodgeVec = { x: 0, y: 0 };
  private path: { pts: Array<{ x: number; y: number }>; t: number } | null = null;
  private stuck = { x: 0, y: 0, n: 0 };
  /**
   * Path only through steps the feet box can slide along, not just between free tiles (set by `clearZone`: a long walk
   * across a zone meets props straddling two tiles; the story-fight replays keep the paths they were tuned with).
   */
  slidePaths = false;
  private lastL = -9;
  private lastPose = 0;
  /** The map `lastL` / `lastPose` were stamped on. */
  private stampField: Field | null = null;
  private runTap: { dir: Dir; n: number } | null = null;
  private beamHold = 0;
  private chargeLv = 1;
  private lastHp = 0;
  private transforming = false;
  /** Holding A through the first jab into the charged melee. */
  private charging = false;
  /** Tapping A through a 3-hit string. */
  private comboing = false;
  /** Frames spent backing off to make room for a transformation, and a cool-down before trying again. */
  private roomT = 0;
  private roomWait = 0;

  /**
   * Enemies the bot leaves alone until a field tick (zone clears only: one it cannot get at, hovering over a wall or
   * across a ledge, while others wait). Always empty in story fights.
   */
  private shunned = new Map<Enemy, number>();

  constructor(sim: Sim, seed: number) {
    this.sim = sim;
    this.rng = new Rng((seed * 2654435761) >>> 0 || 1);
  }

  get game(): Game {
    return this.sim.game;
  }

  /** The enemy the current engagement is aimed at (null between engagements). */
  get target(): Enemy | null {
    return this.plan?.target ?? null;
  }

  /** Leave an enemy alone until field tick `until` (see `shunned`). */
  shun(e: Enemy, until: number): void {
    this.shunned.set(e, until);
    if (this.plan?.target === e) this.plan = null;
  }

  // ---------------------------------------------------------------------------------------------- fight lifecycle

  /** Called by the fight hooks when a scripted fight (or wave) hands over control. */
  begin(kind: 'boss' | 'wave', type: string, opts: FightOpts, seq: number, attempt: number): FightRun {
    const st = this.game.state;
    const cs = st.hero;
    const f = this.game.field;
    const p = f?.player;
    const form = p?.formActive ?? cs.form;
    const def = kind === 'boss' ? ENEMIES[type] : this.strongest(f);
    const run: FightRun = {
      seq, kind, type, uid: opts.uid ?? (kind === 'boss' ? `fight:${type}` : ''), opts: { ...opts }, attempt,
      result: 'unreached', ko: false, assisted: false, frames: 0, senzu: 0, fish: 0, cookies: 0,
      hero: cs.id, level: cs.level, form, hpStart: cs.hp, hpEnd: cs.hp, hpMax: cs.hpMax, taken: 0, bossLeft: 1, koFrame: -1, bossAtKo: -1,
      melee: 0, ki: 0, transforms: 0, dodges: 0,
      ratio: def ? (kind === 'boss' ? hitsRatio(formStats(cs, form), def) : this.waveRatio(f, formStats(cs, form), opts.uid)) : null,
    };
    this.bout = {
      run, boss: null, survive: !!opts.survive, started: f?.tick ?? 0,
      inv0: { senzu: st.count('senzu'), fish: st.count('fish'), cookie: st.count('cookie') },
    };
    this.assisting = attempt > 1;
    this.sim.fair = !this.assisting;
    this.plan = null;
    this.menu = null;
    this.pauseT = 0;
    this.lastHp = cs.hp;
    // Field.tick restarts on every map: tick stamps from an earlier map would lock L (and the pose) out for minutes.
    if (f && f !== this.stampField) { this.stampField = f; this.lastL = -9; this.lastPose = 0; }
    return run;
  }

  /** The running fight hit BOUT_CAP: close it as a 'capped' (timeout) loss and let go of the pad. */
  cap(): void {
    const b = this.bout;
    if (!b) return;
    b.run.assisted = true;
    this.end('capped');
  }

  /** Called by the fight hooks when the fight resolves. */
  end(result: FightResult | 'cleared' | 'capped'): void {
    const b = this.bout;
    if (!b) return;
    const st = this.game.state;
    const f = this.game.field;
    const cs = st.hero;
    const r = b.run;
    r.result = result;
    r.frames = (f?.tick ?? b.started) - b.started;
    r.senzu = Math.max(0, b.inv0.senzu - st.count('senzu'));
    r.fish = Math.max(0, b.inv0.fish - st.count('fish'));
    r.cookies = Math.max(0, b.inv0.cookie - st.count('cookie'));
    r.hpEnd = cs.hp;
    r.assisted = r.assisted || this.assisting;
    const boss = b.boss ?? f?.enemies.find((e) => e.uid === r.uid) ?? null;
    if (boss) r.bossLeft = Math.round((boss.hp / boss.maxHp) * 1000) / 1000;
    this.bout = null;
    this.assisting = false;
    this.sim.fair = true;
    this.releaseAll();
  }

  /** The hero was knocked out in a fight that does not allow it: note it and let the test bot finish the fight. */
  knockedOut(): void {
    const b = this.bout;
    if (b) {
      b.run.ko = true;
      b.run.assisted = true;
      b.run.koFrame = b.run.frames;
      const boss = b.boss ?? this.game.field?.enemies.find((e) => e.uid === b.run.uid);
      if (boss) b.run.bossAtKo = Math.round((boss.hp / boss.maxHp) * 1000) / 1000;
    }
    this.assisting = true;
    this.sim.fair = false;
    this.menu = null;
    this.releaseAll();
  }

  /** Strongest enemy on the field (a wave's reference for the hits ratio). */
  private strongest(f: Field | null): EnemyDef | undefined {
    const list = (f?.enemies ?? []).filter((e) => !e.dead && !e.puppet && !e.def.invulnerable);
    list.sort((a, c) => Math.max(c.def.str, c.def.pow) - Math.max(a.def.str, a.def.pow));
    return list[0]?.def;
  }

  /** A wave's ratio: melee hits to clear every enemy it needs cleared / hits of its strongest attacker to KO the hero. */
  private waveRatio(f: Field | null, hero: RatioHero, uids?: string): HitsRatio | null {
    const listed = uids ? new Set(uids.split(',')) : null;
    const list = (f?.enemies ?? []).filter((e) => !e.dead && !e.puppet && !e.def.invulnerable && e.state !== 'dying' && (!listed || (!!e.uid && listed.has(e.uid))));
    const top = this.strongest(f);
    if (!list.length || !top) return null;
    let hits = 0;
    let heroHit = 0;
    for (const e of list) {
      const one = hitsRatio(hero, { ...e.def, boss: e.def.boss ? { ...e.def.boss, refillAt: undefined } : undefined });
      hits += one.hitsToEnd;
      heroHit = Math.max(heroHit, one.heroHit);
    }
    // Its hardest hitter, by its stronger attack stat (shooters hit with POW).
    const ko = hitsRatio(hero, { ...top, str: Math.max(top.str, top.pow) });
    return { heroHit, hitsToEnd: hits, bossHit: ko.bossHit, hitsToKO: ko.hitsToKO, ratio: Math.round((hits / ko.hitsToKO) * 10) / 10 };
  }

  // ---------------------------------------------------------------------------------------------- per tick

  /** Sim driver: decide this tick's buttons. */
  step(): void {
    const g = this.game;
    const f = g.field;
    this.want.clear();
    const b = this.bout;
    if (b && f) {
      b.run.frames = f.tick - b.started;
      const cs = f.player.cs;
      if (cs.hp < this.lastHp) b.run.taken += this.lastHp - cs.hp;
      this.lastHp = cs.hp;
      if (!b.boss && b.run.kind === 'boss') b.boss = f.enemies.find((e) => e.uid === b.run.uid) ?? null;
      if (!this.assisting && b.run.frames > FIGHT_CAP) {
        b.run.assisted = true;
        this.assisting = true;
        this.sim.fair = false;
      }
    }
    if (this.assisting || !b || !f) { this.flush(); return; }
    if (this.menu) { this.runMenu(f); this.flush(); return; }
    if (g.scenes.top !== f || !g.allowControl || f.locked || f.player.state === 'dead') { this.flush(); return; }
    this.fight(f, b);
    this.flush();
  }

  /** Inject this tick's buttons: exactly the wanted set is down. */
  private flush(): void {
    const inp = this.sim.input;
    for (const btn of BUTTONS) {
      const on = this.want.has(btn);
      if (on) { inp.inject(btn, true); this.held.add(btn); }
      else if (this.held.has(btn)) { inp.inject(btn, false); this.held.delete(btn); }
    }
  }

  private releaseAll(): void {
    this.want.clear();
    this.flush();
  }

  /** A fresh press of `btn` this tick (only if it was up last tick). */
  private tap(btn: Button): boolean {
    if (this.held.has(btn)) return false;
    this.want.add(btn);
    return true;
  }

  private hold(btn: Button): void {
    this.want.add(btn);
  }

  // ---------------------------------------------------------------------------------------------- the fight

  private fight(f: Field, b: Bout): void {
    const p = f.player;
    const cs = p.cs;
    const pv = p as unknown as PlayerView;

    if (p.grabbed > 0) { this.tap(f.tick % 2 ? 'A' : 'B'); return; }
    if (p.state === 'transform' || p.state === 'hurt' || p.state === 'locked') { this.transforming = p.state === 'transform'; return; }
    if (this.transforming && p.formActive) { this.transforming = false; b.run.transforms++; }

    const target = this.pickTarget(f, b);
    const threat = this.threat(f);

    switch (p.state) {
      case 'chargeMelee': {
        const ready = pv.chargeT >= 60 || threat !== null || !target;
        if (!ready) this.hold('A');
        else this.charging = false;
        return;
      }
      case 'special':
        if (pv.special?.style === 'flurry' && pv.special.t > 24 && pv.special.t <= 54) this.tap('A');
        return;
      case 'kiCharge': {
        const kc = pv.kiCharge;
        const max = kc?.tech.maxCharge ?? 3;
        const want = Math.min(max, this.chargeLv);
        const aligned = target ? kiLine(p.x, p.y, p.dir, target.body()) : false;
        if (kc && (kc.lv < want || !aligned) && kc.t < 150 && !threat) this.hold('B');
        return;
      }
      case 'beam': {
        this.beamHold--;
        const on = target && kiLine(p.x, p.y, p.dir, this.grow(target.body(), 6));
        if (this.beamHold > 0 && on && !threat && cs.ep > this.epReserve(p) * 0.5) this.hold('B');
        return;
      }
      case 'attack':
        // Hold A through the jab to charge, or queue the next hit of the string (a press after the 5th frame).
        if (this.charging) this.hold('A');
        else if (this.comboing && pv.t > 5) this.tap('A');
        return;
      default: break;
    }
    if (p.state !== 'free') return;
    this.charging = false;
    this.comboing = false;

    // Free: heal, dodge, transform, then fight.
    const healAt = b.survive ? SKILL.healAtSurvive : SKILL.healAt;
    if (cs.hp < cs.hpMax * healAt) {
      const item = this.healItem(cs);
      if (item) { this.menu = { item, step: 0, t: 0, gap: false }; this.runMenu(f); return; }
    }
    if (this.dodgeT > 0) {
      this.dodgeT--;
      this.steer(f, p.x + this.dodgeVec.x * 24, p.y + this.dodgeVec.y * 24, true);
      return;
    }
    if (threat) {
      this.dodgeVec = threat;
      this.dodgeT = 10;
      b.run.dodges++;
      this.plan = null;
      this.steer(f, p.x + threat.x * 24, p.y + threat.y * 24, true);
      return;
    }
    if (this.pauseT > 0) {
      this.pauseT--;
      if (target) this.keepRange(f, target, 34);
      return;
    }
    const tf = this.wantsTransform(f);
    if (tf === 'now') { this.roomT = 0; this.transform(p); return; }
    if (this.roomWait > 0) this.roomWait--;
    if (tf === 'room' && this.roomWait === 0) {
      // Back away to power up (a hit during the 1-second transformation cancels it and empties the gauge).
      if (++this.roomT > 90) { this.roomT = 0; this.roomWait = 240; }
      const near = this.nearestEnemy(f);
      if (near) { this.kite(f, near); return; }
    }
    if (this.healFromField(f, cs)) return;
    // A pinned or stunned target first (a glyph-pinned core, a frozen ward), then any puzzle switch, then the fight.
    const held = !!target && (target.frozen > 0 || target.stun > 30);
    if (!held && this.objective(f, b)) return;
    if (!target) { if (b.boss && !b.boss.ended) this.kite(f, b.boss); return; }
    // "HOLD ON" fights against a foe the hero cannot dent: stay away until the timer runs out.
    if (b.survive && target === b.boss && (b.run.ratio?.ratio ?? 0) > 8) { this.kite(f, target); return; }
    this.engage(f, b, target);
  }

  // ---------------------------------------------------------------------------------------------- targets

  /** An enemy the hero can hurt right now. */
  private vulnerable(f: Field, e: Enemy): boolean {
    if (e.dead || e.state === 'dying' || e.hidden || e.puppet || e.ended || e.def.invulnerable) return false;
    const v = e.def.boss?.vulnerableIf;
    return !v || f.state.check(v);
  }

  /**
   * Who to fight: the fight's boss while it can be hurt (a minion standing in the way first); otherwise the nearest
   * enemy that can be hurt (wards, a reactor, the trooper formation, a wave).
   */
  private pickTarget(f: Field, b: Bout): Enemy | null {
    const p = f.player;
    const d = (e: Enemy) => Math.hypot(e.x - p.x, e.y - p.y);
    // What this fight is about: a `waitDefeat` wave's listed enemies; a boss fight's boss, the enemies its script
    // spawned for it (wards, a reactor, a formation: they carry ids) and its summons; a field battle: everyone.
    const listed = b.run.kind === 'wave' && b.run.uid ? new Set(b.run.uid.split(',')) : null;
    const minion = b.boss?.def.boss?.minion;
    const inScope = (e: Enemy): boolean => {
      if (listed) return !!e.uid && listed.has(e.uid);
      if (b.run.kind === 'wave') return true;
      return !!e.uid || e.def.id === minion || d(e) < 48;
    };
    const live = f.enemies.filter((e) => this.vulnerable(f, e) && (e === b.boss || inScope(e)) && !((this.shunned.get(e) ?? -1) > f.tick));
    // Reachable on foot first (a player cannot punch across a river), nearest by the walk there, not as the crow
    // flies: in a free-roam wave spread through alleys the bot hunts down whoever is the shortest walk away. Ki can
    // still reach the rest.
    const walk = this.walkDist(f);
    const boss = b.boss && this.vulnerable(f, b.boss) ? b.boss : null;
    // An untouchable boss: the thing the hints point at (the script's own reactor, wards, formation, core: they have
    // ids) before the boss's summons, unless a summon is right in the hero's face.
    const sealed = !!b.boss && !boss;
    const rank = (e: Enemy) => {
      const w = walk(e);
      return (Number.isFinite(w) ? Math.max(w, d(e)) : 1000 + d(e)) + (sealed && !e.uid && d(e) > 30 ? 500 : 0);
    };
    const others = live.filter((e) => e !== b.boss).sort((a, c) => rank(a) - rank(c));
    if (boss) {
      const near = others[0];
      if (near && d(near) < 30 && d(boss) > 60) return near;
      return boss;
    }
    return others[0] ?? null;
  }

  /**
   * Walking distance (tiles) from the hero to every tile, -1 where the hero cannot walk (see `walkDist`), over a mask
   * of walkable tiles (1 = free) re-read from the collision map every two seconds (gates open, rocks break).
   */
  private reach: { field: Field | null; maskTick: number; tick: number; from: number; free: Uint8Array; dist: Int32Array; W: number; H: number } = {
    field: null, maskTick: -999, tick: -999, from: -1, free: new Uint8Array(0), dist: new Int32Array(0), W: 0, H: 0,
  };

  /**
   * Walking distance in pixels from the hero to the nearest tile within two tiles of an enemy (close enough to strike
   * or shoot), Infinity when no walkable ground gets there. One breadth-first pass over the map's walkable tiles (gates,
   * props and clutter block), refreshed when the hero steps onto another tile or every half second.
   */
  private walkDist(f: Field): (e: Enemy) => number {
    const p = f.player;
    const r = this.reach;
    const fresh = r.field !== f;
    if (fresh) {
      const grid = parseGrid(f.def);
      r.W = grid[0].length;
      r.H = grid.length;
      r.free = new Uint8Array(r.W * r.H);
      r.dist = new Int32Array(r.W * r.H);
      r.field = f;
    }
    const { W, H } = r;
    if (fresh || f.tick - r.maskTick > 120 || f.tick < r.maskTick) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) r.free[y * W + x] = f.col.blocked({ x: x * TILE + 3, y: y * TILE + 8, w: 10, h: 6 }) ? 0 : 1;
      r.maskTick = f.tick;
      r.from = -1;
    }
    const px = Math.floor(p.x / TILE);
    const py = Math.floor((p.y - 8) / TILE);
    if (r.from !== py * W + px || f.tick - r.tick > 30 || f.tick < r.tick) {
      const free = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && r.free[y * W + x] === 1;
      const dist = r.dist;
      dist.fill(-1);
      // The hero's own tile, or the tiles around it when the feet box straddles a solid edge.
      let q: number[] = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = px + dx;
          const y = py + dy;
          if (free(x, y) && dist[y * W + x] < 0) { dist[y * W + x] = dx === 0 && dy === 0 ? 0 : 1; q.push(y * W + x); }
        }
      }
      while (q.length) {
        const next: number[] = [];
        for (const k of q) {
          const x = k % W;
          const y = (k - x) / W;
          for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as Array<[number, number]>) {
            const nk = ny * W + nx;
            if (!free(nx, ny) || dist[nk] >= 0) continue;
            dist[nk] = dist[k] + 1;
            next.push(nk);
          }
        }
        q = next;
      }
      r.tick = f.tick;
      r.from = py * W + px;
    }
    const dist = r.dist;
    return (e: Enemy) => {
      const ex = Math.floor(e.x / TILE);
      const ey = Math.floor((e.y - 8) / TILE);
      let best = Infinity;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const x = ex + dx;
          const y = ey + dy;
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const v = dist[y * W + x];
          if (v >= 0 && v < best) best = v;
        }
      }
      return best * TILE;
    };
  }

  /** Whether an enemy stands next to ground the hero can walk to. */
  private reachable(f: Field): (e: Enemy) => boolean {
    const walk = this.walkDist(f);
    return (e: Enemy) => Number.isFinite(walk(e));
  }

  /** Fight puzzles: an untouchable boss and a glowing switch (onAction trigger) the hints tell you to press. */
  private objective(f: Field, b: Bout): boolean {
    if (!b.boss || this.vulnerable(f, b.boss)) return false;
    const p = f.player;
    let best: { x: number; y: number; w: number; h: number } | null = null;
    let bd = Infinity;
    for (const t of f.def.triggers ?? []) {
      if (!t.onAction || !t.showIf || !f.state.check(t.showIf) || (t.hideIf && f.state.check(t.hideIf))) continue;
      if (t.once && f.state.flag(`trig:${t.id}`)) continue;
      const r = { x: t.x * TILE, y: t.y * TILE, w: t.w * TILE, h: t.h * TILE };
      const dd = Math.hypot(r.x + r.w / 2 - p.x, r.y + r.h / 2 - p.y);
      if (dd < bd) { bd = dd; best = r; }
    }
    if (!best) return false;
    if (overlaps(p.box(), best) || overlaps(frontRect(p.x, p.y, p.dir, 14, 16), best)) { this.tap('A'); return true; }
    this.steer(f, best.x + best.w / 2, best.y + best.h / 2 + 4, false);
    return true;
  }

  // ---------------------------------------------------------------------------------------------- threats

  /** Escape direction from the most urgent threat the bot noticed (and chose to react to), or null. */
  private threat(f: Field): { x: number; y: number } | null {
    const p = f.player;
    const body = p.body();
    const react = (key: object, chance: number): boolean => {
      let d = this.decided.get(key);
      if (!d) {
        d = { dodge: this.rng.chance(chance), at: f.tick + this.rng.int(SKILL.reaction[0], SKILL.reaction[1]) };
        this.decided.set(key, d);
      }
      return d.dodge && f.tick >= d.at;
    };
    // Telegraphed and live enemy beams.
    for (const bm of f.beams) {
      if (bm.owner !== 'enemy' || bm.dead) continue;
      const r = this.grow(bm.rect(), 3);
      if (!overlaps(r, body)) continue;
      if (!react(bm, SKILL.dodgeBeam)) continue;
      return dirVec(bm.dir).x !== 0
        ? { x: 0, y: this.freeSide(f, p.y - r.y < r.y + r.h - p.y + 26 ? -1 : 1, 'y') }
        : { x: this.freeSide(f, p.x - r.x < r.x + r.w - p.x ? -1 : 1, 'x'), y: 0 };
    }
    for (const e of f.enemies) {
      if (e.dead || e.puppet || e.hidden) continue;
      const ev = e as unknown as EnemyView;
      // Ki-rain target marks about to land.
      for (const m of ev.marks ?? []) {
        if (m.t > 30 || Math.hypot(m.x - p.x, m.y - p.y) > 20) continue;
        if (!react(m, SKILL.dodgeRain)) continue;
        const dx = p.x - m.x || 1;
        const dy = p.y - m.y || 1;
        const l = Math.hypot(dx, dy);
        return { x: dx / l, y: dy / l };
      }
      // Bull charge / dash / grab wind-ups aimed at the hero.
      if (e.isBoss && e.state === 'windup' && (ev.move === 'charge' || ev.move === 'dash' || ev.move === 'drain')) {
        const near = Math.hypot(e.x - p.x, e.y - p.y);
        if (near < 150 && react(this.windupKey(f, e), SKILL.dodgeCharge)) {
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          return Math.abs(dx) > Math.abs(dy) ? { x: 0, y: this.freeSide(f, dy >= 0 ? 1 : -1, 'y') } : { x: this.freeSide(f, dx >= 0 ? 1 : -1, 'x'), y: 0 };
        }
      }
      // A teleport: the boss vanishes and fades back in behind the hero before striking.
      if (e.isBoss && e.state === 'windup' && ev.move === 'teleport' && e.t >= 16 && e.t < 27 && Math.hypot(e.x - p.x, e.y - p.y) < 40
        && react(this.windupKey(f, e), SKILL.dodgeTeleport)) {
        const l = Math.hypot(p.x - e.x, p.y - e.y) || 1;
        return { x: (p.x - e.x) / l, y: (p.y - e.y) / l };
      }
      // A dying exploder close by: always back off (one look at the flashing creature is enough).
      if (e.def.ai === 'exploder' && e.state === 'dying' && Math.hypot(e.x - p.x, e.y - p.y) < 40) {
        const l = Math.hypot(p.x - e.x, p.y - e.y) || 1;
        return { x: (p.x - e.x) / l, y: (p.y - e.y) / l };
      }
      // Invulnerable patrollers: step out of their path.
      if (e.def.ai === 'hazard' && Math.hypot(e.x - p.x, e.y - p.y) < 24) {
        const l = Math.hypot(p.x - e.x, p.y - e.y) || 1;
        return { x: (p.x - e.x) / l, y: (p.y - e.y) / l };
      }
    }
    // Incoming ki shots.
    for (const s of f.shots) {
      if (s.owner !== 'enemy' || s.dead || s.arcDur > 0) continue;
      const sp = Math.hypot(s.vx, s.vy);
      if (sp < 0.5) continue;
      const rx = p.x - s.x;
      const ry = p.y - s.y;
      const along = (rx * s.vx + ry * s.vy) / sp;
      if (along <= 0 || along / sp > 24) continue;
      const across = Math.abs(rx * s.vy - ry * s.vx) / sp;
      if (across > 12) continue;
      if (!react(s, SKILL.dodgeShot)) continue;
      const nx = -s.vy / sp;
      const ny = s.vx / sp;
      const side = rx * nx + ry * ny >= 0 ? 1 : -1;
      return { x: nx * side, y: ny * side };
    }
    return null;
  }

  private windups = new WeakMap<Enemy, { start: number }>();

  /** One decision object per boss wind-up (a new one each time a wind-up starts). */
  private windupKey(f: Field, e: Enemy): object {
    const start = f.tick - e.t;
    let k = this.windups.get(e);
    if (!k || Math.abs(k.start - start) > 2) { k = { start }; this.windups.set(e, k); }
    return k;
  }

  /** Which way along an axis has room to step (prefers `pref`). */
  private freeSide(f: Field, pref: number, axis: 'x' | 'y'): number {
    const p = f.player;
    const box = p.box();
    const room = (s: number): boolean => {
      for (let k = 6; k <= 30; k += 6) {
        const b = axis === 'x' ? { ...box, x: box.x + s * k } : { ...box, y: box.y + s * k };
        if (f.col.blocked(b)) return false;
      }
      return true;
    };
    if (room(pref)) return pref;
    if (room(-pref)) return -pref;
    return pref;
  }

  private grow(r: Rect, m: number): Rect {
    return { x: r.x - m, y: r.y - m, w: r.w + m * 2, h: r.h + m * 2 };
  }

  // ---------------------------------------------------------------------------------------------- healing

  /** The item the bot eats at low HP: a Senzu Bean, else a Fish, else a Cookie when 5 HP still matters. */
  private healItem(cs: CharState): string | null {
    const st = this.game.state;
    if (st.count('senzu') > 0) return 'senzu';
    if (st.count('fish') > 0) return 'fish';
    if (st.count('cookie') > 0 && cs.hpMax <= 150) return 'cookie';
    return null;
  }

  /** Hurt and out of beans: walk over food lying nearby, or smash a recovery rock for a drop. */
  private healFromField(f: Field, cs: CharState): boolean {
    const p = f.player;
    if (cs.hp >= cs.hpMax * 0.6) return false;
    const food = (f as unknown as { pickups: Array<{ x: number; y: number; kind: string; t: number; hidden?: boolean }> }).pickups
      .filter((k) => !k.hidden && k.kind.startsWith('food') && Math.hypot(k.x - p.x, k.y - p.y) < 72)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (food) { this.steer(f, food.x, food.y + 2, true); return true; }
    if (cs.hp >= cs.hpMax * 0.4 || this.healItem(cs)) return false;
    const rock = f.map.objects.filter((o) => !o.gone && o.def.type === 'breakable')
      .map((o) => ({ o, d: Math.hypot(o.rect.x + o.rect.w / 2 - p.x, o.rect.y + o.rect.h / 2 - p.y) }))
      .filter((x) => x.d < 110).sort((a, b) => a.d - b.d)[0];
    if (!rock) return false;
    const r = rock.o.rect;
    const dir: Dir = p.x < r.x ? 'right' : p.x > r.x + r.w ? 'left' : p.y < r.y ? 'down' : 'up';
    const [x0, x1, y0, y1] = strikeRange(r, dir, CHARACTERS[cs.id].sword ? 20 : 16);
    if (p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1) { this.want.add(KEY[dir]); this.tap('A'); return true; }
    const s = strikeSpot(r, dir, CHARACTERS[cs.id].sword ? 20 : 16);
    this.steer(f, s.x, s.y, false);
    return true;
  }

  /** Pause -> R (Items page) -> up/down to the item -> A -> A (close the message) -> Start. */
  private runMenu(f: Field): void {
    const m = this.menu;
    if (!m) return;
    const g = this.game;
    m.t++;
    if (m.gap) { m.gap = false; return; }
    const top = g.scenes.top;
    const pm = top && top.constructor.name === 'PauseMenu' ? (top as unknown as PauseView) : null;
    const press = (btn: Button) => { this.want.add(btn); m.gap = true; };
    if (m.t > 240) {
      // Something else took the screen (a cutscene line): back out.
      if (pm) press('start');
      else this.menu = null;
      return;
    }
    switch (m.step) {
      case 0:
        if (pm) { m.step = 1; return; }
        if (top === f && f.player.state === 'free' && !f.locked) press('start');
        return;
      case 1:
        if (!pm) { if (top === f) m.step = 0; return; }
        if (pm.page !== 'items') { press('R'); return; }
        m.step = 2;
        return;
      case 2: {
        if (!pm) { this.menu = null; return; }
        const list = pm.items();
        const idx = list.findIndex((it) => it.id === m.item);
        if (idx < 0) { m.step = 4; return; }
        if (pm.itemSel !== idx) { press(pm.itemSel < idx ? 'down' : 'up'); return; }
        press('A');
        m.step = 3;
        return;
      }
      case 3:
        if (pm?.message) { press('A'); return; }
        m.step = 4;
        return;
      case 4:
        if (pm) { press('start'); return; }
        this.menu = null;
        return;
      default:
        this.menu = null;
    }
  }

  // ---------------------------------------------------------------------------------------------- transformation

  /** EP kept back from ki techniques: enough to stay transformed, or to power up once the triangle is nearly full. */
  private epReserve(p: Player): number {
    const form = p.form;
    if (form && form.drain > 0) return p.cs.epMax * 0.45;
    if (p.cs.form && !p.formActive && p.zGauge > 0.6) return Math.max(6, p.cs.epMax * 0.3);
    return 0;
  }

  /**
   * Power up when the triangle is full and there is EP to burn: 'now' when nobody can cancel it with a hit, 'room'
   * when an enemy is too close or winding up an attack (back off first), null when there is nothing to do.
   */
  private wantsTransform(f: Field): 'now' | 'room' | null {
    const p = f.player;
    const cs = p.cs;
    if (!cs.form || p.formActive || p.zGauge < 1 || cs.ep < Math.max(4, cs.epMax * 0.25)) return null;
    for (const e of f.enemies) {
      if (e.dead || e.puppet || e.ended || e.hidden || e.state === 'dying') continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      const mv = (e as unknown as EnemyView).move;
      const aimed = e.state === 'windup' && mv !== null && mv !== 'guard' && mv !== 'summon';
      if (d < 36 || (aimed && d < 110) || ((e.state === 'strike' || e.state === 'move') && d < 60)) return 'room';
    }
    for (const bm of f.beams) if (bm.owner === 'enemy' && !bm.dead && overlaps(this.grow(bm.rect(), 8), p.body())) return 'room';
    return 'now';
  }

  private nearestEnemy(f: Field): Enemy | null {
    const p = f.player;
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e of f.enemies) {
      if (e.dead || e.puppet || e.hidden || e.state === 'dying' || e.def.ai === 'idle') continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  private transform(p: Player): void {
    const slots = p.cs.techs.length;
    if (p.cs.selected !== slots) { this.selectSlot(p, slots); return; }
    this.tap('B');
  }

  /** Cycle L toward a technique slot (one press every other tick, only while free). */
  private selectSlot(p: Player, slot: number): boolean {
    if (p.cs.selected === slot) return true;
    if (this.sim.game.field && this.sim.game.field.tick - this.lastL >= 2 && this.tap('L')) this.lastL = this.sim.game.field.tick;
    return false;
  }

  // ---------------------------------------------------------------------------------------------- engaging

  /** Pick a ranged technique for this moment, or null to close in. */
  private chooseKi(f: Field, target: Enemy, dist: number): Technique | null {
    const p = f.player;
    const cs = p.cs;
    if (target.absorbsKi) return null;
    const spare = cs.ep - this.epReserve(p);
    const stunned = target.stun > 20 || target.frozen > 20;
    const options: Array<{ t: Technique; w: number }> = [];
    for (const id of cs.techs) {
      const t = TECHNIQUES[id];
      if (!t || spare < t.cost) continue;
      switch (t.kind) {
        case 'shot': if (dist > 40) options.push({ t, w: 1 }); break;
        case 'wave': if (dist > 28) options.push({ t, w: 3 }); break;
        case 'stun': if (dist > 30 && dist < 130 && !stunned) options.push({ t, w: 5 }); break;
        case 'beam':
        case 'pierceBeam': if (dist > 44 && spare > t.cost + 12) options.push({ t, w: 4 }); break;
        case 'charge': if (dist > 56 && (stunned || target.state === 'chase' || target.state === 'wander') && spare > t.cost * 2) options.push({ t, w: 4 }); break;
        case 'arc': if (dist > 52 && dist < 132) options.push({ t, w: 3 }); break;
        case 'spread': if (dist > 36 && dist < 150) options.push({ t, w: 3 }); break;
        case 'pose':
          if (f.tick - this.lastPose > 900 && dist < 90 && (cs.hp < cs.hpMax * 0.5 || target.state === 'windup')) options.push({ t, w: 6 });
          break;
        default: break;
      }
    }
    if (!options.length) return null;
    options.sort((a, c) => c.w - a.w);
    return options[0].t;
  }

  private engage(f: Field, b: Bout, target: Enemy): void {
    const p = f.player;
    const cs = p.cs;
    const body = target.body();
    const dist = Math.hypot(target.x - p.x, target.y - p.y);
    const reach = CHARACTERS[cs.id].sword ? 20 : 16;

    // Ranged: a technique fires along the facing, so line up on one axis first.
    const onFoot = this.reachable(f)(target);
    if (!this.plan || this.plan.target !== target) {
      const ki = !onFoot || this.rng.chance(SKILL.kiAppetite) ? this.chooseKi(f, target, Math.max(dist, onFoot ? 0 : 60)) : null;
      this.plan = { target, dir: this.attackDir(f, target), charged: cs.charged && this.rng.chance(SKILL.charged), ki };
    }
    const plan = this.plan;
    if (plan.ki && plan.ki.kind === 'pose') {
      const slot = cs.techs.indexOf(plan.ki.id);
      if (!this.selectSlot(p, slot)) return;
      this.tap('B');
      this.lastPose = f.tick;
      b.run.ki++;
      plan.ki = null;
      return;
    }
    if (plan.ki) {
      const fire = this.kiDir(p.x, p.y, body);
      if (fire) {
        const slot = cs.techs.indexOf(plan.ki.id);
        if (!this.selectSlot(p, slot)) return;
        const t = plan.ki;
        if (t.kind === 'arc') {
          const want = Math.max(1, Math.min(t.maxCharge ?? 3, Math.round((dist - 36) / 28)));
          this.chargeLv = want;
        } else this.chargeLv = dist > 110 ? 3 : 2;
        this.beamHold = 50 + this.rng.int(0, 60);
        this.want.add(KEY[fire]);
        this.tap('B');
        b.run.ki++;
        // A stun shot opens a melee string; everything else lets the boss come back first.
        this.plan = t.kind === 'stun' ? { target, dir: this.attackDir(f, target), charged: plan.charged, ki: null } : null;
        if (t.kind !== 'stun') this.pauseT = this.rng.int(4, 14);
        return;
      }
      // Not lined up: slide along the cheaper axis (or give up on ki when the target is close or out of line).
      if (dist < 36) { plan.ki = null; }
      else {
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const gy = body.y + body.h / 2 + 14;
        const goal = Math.abs(dy) < Math.abs(dx)
          ? { x: p.x + Math.sign(dx) * Math.max(0, Math.abs(dx) - 70), y: gy }
          : { x: target.x, y: p.y + Math.sign(dy) * Math.max(0, Math.abs(dy) - 70) };
        if (this.blockedApproach(plan, Math.hypot(goal.x - p.x, goal.y - p.y))) { plan.ki = null; return; }
        this.steer(f, goal.x, goal.y, false);
        return;
      }
    }

    // Out of reach on foot and no technique to spare: walk to the ground nearest it (the path search ends on the
    // closest walkable tile) and wait there for EP or for it to come closer.
    if (!onFoot) {
      this.plan = null;
      if (dist > 72) this.steer(f, target.x, target.y, dist > 110);
      else this.keepRange(f, target, 40);
      return;
    }
    // Melee: if energy punch is known and EP is plentiful, keep it selected; otherwise a ki slot (never Z).
    const ep = cs.techs.indexOf('energyPunch');
    const wantSlot = ep >= 0 && cs.ep - this.epReserve(p) > 30 ? ep : cs.selected >= cs.techs.length ? 0 : cs.selected;
    if (cs.selected !== wantSlot && !this.selectSlot(p, wantSlot)) return;

    const dir = plan.dir;
    const [x0, x1, y0, y1] = strikeRange(body, dir, reach);
    const inX = p.x > x0 + 1 && p.x < x1 - 1;
    const inY = p.y > y0 + 1 && p.y < y1 - 1;
    const ev = target as unknown as EnemyView;
    // A guarding boss takes a fifth of the damage: most players wait the guard out instead of punching into it.
    if (target.guarding) {
      const key = this.windupKey(f, target);
      let d = this.decided.get(key);
      if (!d) { d = { dodge: this.rng.chance(SKILL.respectGuard), at: f.tick }; this.decided.set(key, d); }
      if (d.dodge) { this.keepRange(f, target, 40); return; }
    }
    // A boss winding up a bull charge in reach: hit it out of the wind-up (LoG2 punish) only some of the time.
    if (inX && inY && target.isBoss && target.state === 'windup' && ev.move === 'charge') {
      const key = this.windupKey(f, target);
      let d = this.decided.get(key);
      if (!d) { d = { dodge: this.rng.chance(SKILL.punish), at: f.tick }; this.decided.set(key, d); }
      if (!d.dodge) { this.keepRange(f, target, 40); return; }
    }
    if (inX && inY) {
      this.want.add(KEY[dir]);
      if (plan.charged && this.tap('A')) this.charging = true;
      else if (this.tap('A')) this.comboing = true;
      b.run.melee++;
      this.pauseT = this.rng.int(SKILL.comboPause[0], SKILL.comboPause[1]);
      // Decide afresh after every string (ki or melee, charged or not, which side).
      this.plan = null;
      return;
    }
    const s = strikeSpot(body, dir, reach);
    this.steer(f, s.x, s.y, dist > 70);
    // Re-plan now and then (the target moves; a better side may open up), and at once when walled off from this side.
    if (this.blockedApproach(plan, Math.hypot(s.x - p.x, s.y - p.y))) { this.failedDir = dir; this.plan = null; return; }
    if (this.rng.chance(0.02)) { this.failedDir = null; this.plan = null; }
  }

  /** Facing to strike from: toward the void on ring-out stages, else the side the hero is already on. */
  private attackDir(f: Field, target: Enemy): Dir {
    const p = f.player;
    if (f.def.ringOut && f.canRingOut(target)) {
      let best: Dir | null = null;
      let bd = 80;
      for (const d of ['left', 'right', 'up', 'down'] as Dir[]) {
        const v = dirVec(d);
        for (let k = 8; k < bd; k += 4) {
          if (f.voidAt(target.x + v.x * k, target.y - 4 + v.y * k)) { if (k < bd) { bd = k; best = d; } break; }
        }
      }
      if (best) return best;
    }
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const natural: Dir = Math.abs(dy) > Math.abs(dx) * 1.6 ? (dy > 0 ? 'down' : 'up') : dx >= 0 ? 'right' : 'left';
    // Only a side the hero can actually stand on (a foe backed against a wall or a prop is hit from the open side).
    const reach = CHARACTERS[p.cs.id].sword ? 20 : 16;
    const order: Dir[] = [natural, ...(['left', 'right', 'down', 'up'] as Dir[]).filter((d) => d !== natural && d !== this.failedDir)];
    for (const d of order) {
      if (d === this.failedDir) continue;
      const sp = strikeSpot(target.body(), d, reach);
      if (!f.col.blocked({ x: sp.x - 5, y: sp.y - 6, w: 10, h: 6 })) return d;
    }
    return natural;
  }

  /** True once the bot has not got any closer to its goal for 45 frames under the same plan (walled off). */
  private blockedApproach(plan: object, gap: number): boolean {
    const key = { plan, ki: (plan as { ki?: unknown }).ki ?? null };
    const a = this.approach;
    if (a.plan !== plan || a.ki !== key.ki || gap < a.best - 2) { this.approach = { plan, ki: key.ki, best: gap, t: 0 }; return false; }
    if (++a.t > 45) { this.approach = { plan: null, ki: null, best: Infinity, t: 0 }; return true; }
    return false;
  }

  /** A side the bot could not get to last time (tried again after the next re-plan). */
  private failedDir: Dir | null = null;
  /** Closing in on a strike spot: closest distance so far and frames without getting closer. */
  private approach: { plan: object | null; ki: unknown; best: number; t: number } = { plan: null, ki: null, best: Infinity, t: 0 };

  /** The facing from which a ki shot from (x, y) would hit `body`, or null. */
  private kiDir(x: number, y: number, body: Rect): Dir | null {
    for (const d of ['left', 'right', 'up', 'down'] as Dir[]) if (kiLine(x, y, d, body)) return d;
    return null;
  }

  /** Stay near (but outside) a target's reach while waiting between strings. */
  private keepRange(f: Field, target: Enemy, range: number): void {
    const p = f.player;
    const d = Math.hypot(target.x - p.x, target.y - p.y);
    if (d < range * 0.6) this.steer(f, p.x + (p.x - target.x), p.y + (p.y - target.y), false);
  }

  /**
   * Survival: circle an untouchable boss at about 110 px, strafing around it toward the side with more open floor
   * (backing straight away ends in a corner), and never standing still.
   */
  private kite(f: Field, boss: Enemy): void {
    const p = f.player;
    const dx = p.x - boss.x;
    const dy = p.y - boss.y;
    const d = Math.hypot(dx, dy) || 1;
    const base = Math.atan2(dy, dx);
    const open = (a: number, r: number): boolean => {
      const gx = boss.x + Math.cos(a) * r;
      const gy = boss.y + Math.sin(a) * r;
      return !f.col.blocked({ x: gx - 5, y: gy - 6, w: 10, h: 6 }) && this.lineFree(f, p.x, p.y, gx, gy);
    };
    // Keep the strafing direction until it runs into a wall.
    if (!open(base + this.kiteSpin * 0.5, Math.max(90, Math.min(130, d)))) this.kiteSpin = -this.kiteSpin;
    const r = d < 80 ? 120 : Math.max(95, Math.min(130, d));
    for (const off of [0.5, 0.9, 0.25, 1.3, 0, 1.8]) {
      const a = base + this.kiteSpin * off;
      if (open(a, r)) { this.steer(f, boss.x + Math.cos(a) * r, boss.y + Math.sin(a) * r, d < 80); return; }
    }
    for (const off of [-0.5, -0.9, -1.3]) {
      const a = base + this.kiteSpin * off;
      if (open(a, r)) { this.kiteSpin = -this.kiteSpin; this.steer(f, boss.x + Math.cos(a) * r, boss.y + Math.sin(a) * r, true); return; }
    }
    this.steer(f, p.x + dx / d * 24, p.y + dy / d * 24, true);
  }

  /** Strafing direction around a kited boss (+1 / -1). */
  private kiteSpin = 1;

  // ---------------------------------------------------------------------------------------------- walking

  /** Hold the d-pad toward a point, running (double-tap) when far, path-finding around walls when blocked. */
  private steer(f: Field, gx: number, gy: number, run: boolean): void {
    const p = f.player;
    // Stuck detection: wanted to move but did not for a while -> BFS path.
    if (Math.hypot(p.x - this.stuck.x, p.y - this.stuck.y) < 0.4) this.stuck.n++;
    else { this.stuck.n = 0; this.stuck.x = p.x; this.stuck.y = p.y; }
    let tx = gx;
    let ty = gy;
    if (this.path && f.tick - this.path.t < 40 && this.path.pts.length) {
      const w = this.path.pts[0];
      if (Math.hypot(w.x - p.x, w.y - p.y) < 4) this.path.pts.shift();
      if (this.path.pts.length) { tx = this.path.pts[0].x; ty = this.path.pts[0].y; }
    } else if (this.stuck.n > 8 || !this.lineFree(f, p.x, p.y, gx, gy)) {
      const pts = this.bfs(f, gx, gy);
      this.path = { pts, t: f.tick };
      this.stuck.n = 0;
      if (pts.length) { tx = pts[0].x; ty = pts[0].y; }
    }
    const dx = tx - p.x;
    const dy = ty - p.y;
    const keys: Dir[] = [];
    if (dx < -1) keys.push('left');
    if (dx > 1) keys.push('right');
    if (dy < -1) keys.push('up');
    if (dy > 1) keys.push('down');
    // Double-tap-and-hold to run along the longer axis.
    const major: Dir | null = Math.abs(dx) >= Math.abs(dy) ? (dx < -1 ? 'left' : dx > 1 ? 'right' : null) : (dy < -1 ? 'up' : dy > 1 ? 'down' : null);
    if (run && major && Math.hypot(dx, dy) > 40 && !p.running) {
      if (!this.runTap || this.runTap.dir !== major || this.runTap.n > 6) this.runTap = { dir: major, n: 0 };
      this.runTap.n++;
      // tick 1: down, tick 2: up, tick 3+: down and held.
      if (this.runTap.n === 2) { for (const k of keys) if (k !== major) this.want.add(KEY[k]); return; }
    } else if (!run || !major) this.runTap = null;
    for (const k of keys) this.want.add(KEY[k]);
  }

  /** Feet box can slide in a straight line between two points. */
  private lineFree(f: Field, x0: number, y0: number, x1: number, y1: number): boolean {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4);
    for (let i = 1; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      if (f.col.blocked({ x: x - 5, y: y - 6, w: 10, h: 6 })) return false;
    }
    return true;
  }

  private gridCache = new WeakMap<Field, { W: number; H: number }>();

  /** Tile path (as feet points) from the hero to the walkable tile nearest a goal. */
  private bfs(f: Field, gx: number, gy: number): Array<{ x: number; y: number }> {
    let dims = this.gridCache.get(f);
    if (!dims) { const grid = parseGrid(f.def); dims = { W: grid[0].length, H: grid.length }; this.gridCache.set(f, dims); }
    const { W, H } = dims;
    const free = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !f.col.blocked({ x: x * TILE + 3, y: y * TILE + 8, w: 10, h: 6 });
    const p = f.player;
    const sx = Math.floor(p.x / TILE);
    const sy = Math.floor((p.y - 8) / TILE);
    const ex = Math.floor(gx / TILE);
    const ey = Math.floor((gy - 8) / TILE);
    const prev = new Map<number, number>();
    const key = (x: number, y: number) => y * W + x;
    const q: Array<[number, number]> = [[sx, sy]];
    prev.set(key(sx, sy), -1);
    let best = key(sx, sy);
    let bd = Math.hypot(sx - ex, sy - ey);
    while (q.length) {
      const [x, y] = q.shift() as [number, number];
      const d = Math.hypot(x - ex, y - ey);
      if (d < bd) { bd = d; best = key(x, y); }
      if (d === 0) break;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as Array<[number, number]>) {
        const k = key(nx, ny);
        if (prev.has(k) || !free(nx, ny)) continue;
        // The feet box must also slide from one tile's foot point to the next: a prop's footprint can straddle two
        // free tiles (the crater rim's dead tree between rows 4 and 5), and a path through it wedges the hero.
        if (this.slidePaths && !this.lineFree(f, x * TILE + 8, y * TILE + 14, nx * TILE + 8, ny * TILE + 14)) continue;
        prev.set(k, key(x, y));
        q.push([nx, ny]);
      }
    }
    const pts: Array<{ x: number; y: number }> = [];
    for (let k = best; k !== -1 && k !== key(sx, sy); k = prev.get(k) ?? -1) pts.unshift({ x: (k % W) * TILE + 8, y: Math.floor(k / W) * TILE + 14 });
    return pts;
  }
}

/**
 * A recorded start position can be one no player could stand on (the full-game test starts some scripts on whatever
 * terrain tile is nearest the map centre, which may sit inside a crate or a barrel). Move the hero to the nearest tile
 * whose feet box is clear; a no-op when the hero can already move.
 */
export function unstick(f: Field): void {
  const p = f.player;
  if (!f.col.blocked(p.box())) return;
  const grid = parseGrid(f.def);
  const W = grid[0].length;
  const H = grid.length;
  const sx = Math.floor(p.x / TILE);
  const sy = Math.floor((p.y - 8) / TILE);
  for (let r = 1; r < Math.max(W, H); r++) {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (let y = sy - r; y <= sy + r; y++) {
      for (let x = sx - r; x <= sx + r; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        if (f.col.blocked({ x: x * TILE + 3, y: y * TILE + 8, w: 10, h: 6 })) continue;
        const d = Math.hypot(x - sx, y - sy);
        if (d < bd) { bd = d; best = [x, y]; }
      }
    }
    if (best) { p.x = best[0] * TILE + 8; p.y = best[1] * TILE + 14; return; }
  }
}

// ------------------------------------------------------------------------------------------------ fight hooks

/** One replay's claim on the fight hooks. */
interface ActiveReplay {
  bot: FairBot;
  game: Game;
  seqs: RecordedFight[];
  runs: FightRun[];
  next: number;
}

/**
 * The replay playing in this process right now (fights of other Games run untouched). Each replay owns its own
 * `ActiveReplay` token: it reads only its own token, clears the slot only while it still holds it, and stops as soon
 * as a newer replay has taken the slot, so a replay orphaned by a test timeout can never clobber the next one.
 */
let ACTIVE: ActiveReplay | null = null;
let hooked = false;

/** Take the hook slot for a replay (any older replay still running notices and stops). */
function acquire(token: ActiveReplay): ActiveReplay {
  ACTIVE = token;
  return token;
}

/** Give the hook slot back, unless a newer replay already holds it. */
function release(token: ActiveReplay): void {
  if (ACTIVE === token) ACTIVE = null;
}

const gameOf = (s: ScriptApi): Game => (s as unknown as { game: Game }).game;

/** Match a fight call to the recording: the next recorded fight of that kind and type (or -1 for an extra one). */
function claim(a: ActiveReplay, kind: 'boss' | 'wave', type: string): { seq: number; attempt: number } {
  const due = a.seqs[a.next];
  if (due && due.kind === kind && due.type === type) { a.next++; return { seq: due.seq, attempt: 1 }; }
  // The script repeats a boss fight the hero just lost (LoG2 "try again" loops).
  const last = a.runs[a.runs.length - 1];
  if (kind === 'boss' && last && last.kind === kind && last.type === type && (last.result === 'lose' || last.ko)) return { seq: last.seq, attempt: last.attempt + 1 };
  for (let i = a.next; i < a.seqs.length; i++) {
    const r = a.seqs[i];
    if (r.kind === kind && r.type === type) { a.next = i + 1; return { seq: r.seq, attempt: 1 }; }
  }
  return { seq: -1, attempt: 1 };
}

/** Route ScriptApi.fight / clearEnemies / waitDefeat through the active FairBot (installed once per process). */
export function installFightHooks(): void {
  if (hooked) return;
  hooked = true;
  const wrap = async <T>(s: ScriptApi, kind: 'boss' | 'wave', type: string, opts: FightOpts, call: () => Promise<T>, toResult: (r: T) => FightResult | 'cleared'): Promise<T> => {
    const a = ACTIVE;
    const g = gameOf(s);
    if (!a || a.game !== g) return call();
    const { seq, attempt } = claim(a, kind, type);
    if (g.field) unstick(g.field);
    const run = a.bot.begin(kind, type, opts, seq, attempt);
    a.runs.push(run);
    const prev = g.onPlayerDown;
    // A knock-out in a fight that does not allow one: in the real game, Game Over. Here: record it and let the
    // test bot finish the fight so the script (and the fights after it) can still be measured. `fight` swaps in its
    // own handler for `loseOk` fights and restores this one afterwards.
    g.onPlayerDown = () => {
      a.bot.knockedOut();
      const pl = g.field?.player;
      if (pl) { pl.cs.hp = pl.cs.hpMax; pl.inv = 90; }
      return true;
    };
    try {
      const r = await call();
      a.bot.end(toResult(r));
      return r;
    } finally {
      g.onPlayerDown = prev;
    }
  };
  const fight = ScriptApi.prototype.fight;
  ScriptApi.prototype.fight = function (this: ScriptApi, type: string, opts: FightOpts = {}): Promise<FightResult> {
    return wrap(this, 'boss', type, opts, () => fight.call(this, type, opts), (r) => r);
  };
  const clear = ScriptApi.prototype.clearEnemies;
  ScriptApi.prototype.clearEnemies = function (this: ScriptApi): Promise<void> {
    return wrap(this, 'wave', '', {}, () => clear.call(this), () => 'cleared');
  };
  const waitDefeat = ScriptApi.prototype.waitDefeat;
  ScriptApi.prototype.waitDefeat = function (this: ScriptApi, uids: string[]): Promise<void> {
    // Waves fought under `waitDefeat` hand control over themselves (`free`); the bot plays them like `clearEnemies`.
    return wrap(this, 'wave', '', { uid: uids.join(',') }, () => waitDefeat.call(this, uids), () => 'cleared');
  };
}

// ------------------------------------------------------------------------------------------------ replay

/** Options for `replayRoot`. */
export interface ReplayOptions {
  /** Tick budget for the whole script (default 400k, about 1 h 50 min of play); BOUT_CAP and IDLE_CAP stop it sooner. */
  maxTicks?: number;
  /** Called after the bot's input every tick (debug traces). */
  watch?: (bot: FairBot) => void;
  /** Extra levels for every party member (level sensitivity of a too-hard fight). */
  levelBonus?: number;
  /** Per-fight cap in replay ticks (default BOUT_CAP; the harness self-test uses a short one). */
  boutCap?: number;
}

/**
 * Why a replay stopped: every recorded fight resolved ('done'); the root script finished with recorded fights still
 * unplayed ('script over': the script went another way); a fight hit BOUT_CAP ('capped'); nothing happened for
 * IDLE_CAP ticks ('stalled'); a newer replay took the fight hooks ('superseded'); or the tick budget ran out ('budget').
 */
export type ReplayStop = 'done' | 'script over' | 'capped' | 'stalled' | 'superseded' | 'budget';

/** Result of replaying one recorded script on one seed. */
export interface Replay {
  runs: FightRun[];
  errors: string[];
  ticks: number;
  stopped: ReplayStop;
}

/** Load a recording (tests/sim.ts `recordFights`) and keep the story run: the Game that ran the most scripts. */
export function mainRoots(all: RecordedRoot[]): RecordedRoot[] {
  const count = new Map<number, number>();
  for (const r of all) count.set(r.game, (count.get(r.game) ?? 0) + 1);
  const main = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return all.filter((r) => r.game === main);
}

/** FNV-1a hash of a string (tells apart replays of one script from different saves in a trace). */
function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/**
 * A save without its RNG seed: the replay overrides the seed, and a save built in a test from a fresh GameState carries
 * a random one, so two runs of the same test would otherwise hash the same start differently.
 */
function saveKey(save: string): string {
  const { seed: _ignored, ...rest } = JSON.parse(save) as SaveData;
  return JSON.stringify(rest);
}

const TRACE = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.LOS_REPLAY_TRACE;

/**
 * With LOS_REPLAY_TRACE=<file>, every replay appends one JSON line: the script, save hash, seed, why it stopped and
 * each fight's outcome. Two runs of a test file (in any order) must write the same set of lines but for `wallMs`: the
 * determinism check.
 */
function trace(root: RecordedRoot, seed: number, opts: ReplayOptions, rep: Replay, wallMs: number): void {
  if (!TRACE) return;
  const line = {
    script: root.script, map: root.map, save: fnv(saveKey(root.save)), seed, levelBonus: opts.levelBonus ?? 0, stopped: rep.stopped, ticks: rep.ticks,
    // Wall-clock time: diagnostics only (it differs between runs; compare everything else).
    wallMs,
    runs: rep.runs.map((r) => ({
      seq: r.seq, type: r.type, attempt: r.attempt, result: r.result, ko: r.ko, assisted: r.assisted, frames: r.frames, senzu: r.senzu,
      fish: r.fish, taken: r.taken, hpEnd: r.hpEnd, bossLeft: r.bossLeft, melee: r.melee, ki: r.ki, transforms: r.transforms,
    })),
  };
  appendFileSync(TRACE, `${JSON.stringify(line)}\n`);
}

/** A placeholder run for a recorded fight the replay never reached. */
function unreachedRun(rec: RecordedFight): FightRun {
  return {
    seq: rec.seq, kind: rec.kind, type: rec.type, uid: rec.opts.uid ?? '', opts: rec.opts, attempt: 1, result: 'unreached', ko: false,
    assisted: false, frames: 0, senzu: 0, fish: 0, cookies: 0, hero: rec.hero, level: rec.level, form: null, hpStart: 0, hpEnd: 0,
    hpMax: 0, taken: 0, bossLeft: 1, koFrame: -1, bossAtKo: -1, melee: 0, ki: 0, transforms: 0, dodges: 0, ratio: null,
  };
}

/**
 * Replay a recorded top-level script from the save it started with, with the FairBot playing every fight in it.
 * The Sim reads dialogue (first choice), the bot fights; a knock-out or a stuck fight is recorded and then finished
 * by the test bot so later fights of the same script are still measured. Stops once every recorded fight resolved,
 * or early (`Replay.stopped`): a fight unresolved at BOUT_CAP is closed as a 'capped' loss, and a script that ended,
 * stalled for IDLE_CAP ticks or lost the fight hooks to a newer replay leaves its remaining fights 'unreached'.
 */
export async function replayRoot(root: RecordedRoot, seed: number, opts: ReplayOptions = {}): Promise<Replay> {
  installFightHooks();
  const wall0 = Date.now();
  const maxTicks = opts.maxTicks ?? 400000;
  const boutCap = opts.boutCap ?? BOUT_CAP;
  const sim = new Sim();
  sim.fair = true;
  const bot = new FairBot(sim, seed);
  sim.driver = () => { bot.step(); opts.watch?.(bot); };
  const data = JSON.parse(root.save) as SaveData;
  data.seed = ((seed + 1) * 0x9e3779b1) >>> 0;
  sim.game.state = new GameState(data);
  if (opts.levelBonus) {
    // "What if the player had ground a few more levels": every party member rolls `levelBonus` more level-ups.
    const st = sim.game.state;
    for (const c of Object.values(st.data.chars)) if (c.joined) st.join(c.id, Math.min(50, c.level + opts.levelBonus));
  }
  const g = sim.game;
  const runs: FightRun[] = [];
  const me = acquire({ bot, game: g, seqs: root.fights, runs, next: 0 });
  const errors: string[] = [];
  // Outside fights (cutscenes with live enemies): never let a stray hit end the replay.
  g.onPlayerDown = () => { const pl = g.field?.player; if (pl) { pl.cs.hp = pl.cs.hpMax; pl.inv = 90; } return true; };
  let ticks = 0;
  let stopped: ReplayStop = 'budget';
  try {
    g.startField(root.map, (root.x - 8) / TILE, (root.y - 14) / TILE, root.dir);
    if (!root.onEnter) {
      for (let calm = 0; calm < 6 && ticks < 30000; ticks += 5) {
        await sim.tick(5);
        calm = g.lockDepth === 0 ? calm + 1 : 0;
      }
      const f = g.field;
      if (f) {
        f.player.x = root.x;
        f.player.y = root.y;
        f.player.dir = root.dir;
        f.carrying = root.carrying ? { ...root.carrying } : null;
        // A script the test started directly stood in for the player walking into its trigger: put the hero where the
        // trigger is (scripts stage their fights around it, some seal an arena there), and a one-shot trigger that
        // runs the same script has been used up (the test bot finished fights before the hero could re-enter it).
        const own = (f.def.triggers ?? []).filter((t) => t.script === root.script && !t.onAction && f.state.check(t.showIf));
        const here = own.find((t) => overlaps(f.player.box(), { x: t.x * TILE, y: t.y * TILE, w: t.w * TILE, h: t.h * TILE }));
        if (!root.npc && own.length && !here) {
          const t = own[0];
          f.player.x = (t.x + t.w / 2) * TILE;
          f.player.y = (t.y + t.h / 2) * TILE + 6;
        }
        unstick(f);
        for (const t of f.def.triggers ?? []) if (t.once && t.script === root.script) g.state.set(`trig:${t.id}`);
        // The hero was already standing in whatever trigger started this script: it must not fire a second time.
        const inside = (f as unknown as { triggersInside: Set<string> }).triggersInside;
        const box = f.player.box();
        for (const t of f.def.triggers ?? []) if (overlaps(box, { x: t.x * TILE, y: t.y * TILE, w: t.w * TILE, h: t.h * TILE })) inside.add(t.id);
      }
      const npc = root.npc ? f?.npcs.find((n) => n.def.id === root.npc) : undefined;
      const ctx: ScriptCtx = npc ? { npc } : {};
      void g.runScript(root.script, ctx);
    }
    const want = root.fights.length;
    let settled = 0;
    /** Replay ticks with no script running and no fight; ticks since a fight last ran or began. */
    let over = 0;
    let idle = 0;
    /** The fight being played and the replay tick it began on. */
    let bout: Bout | null = null;
    let boutAt = 0;
    while (ticks < maxTicks) {
      await sim.tick(10);
      ticks += 10;
      if (ACTIVE !== me) {
        stopped = 'superseded';
        errors.push(`${root.script}: replay stopped at tick ${ticks}, a newer replay took over the fight hooks (an earlier test timed out?)`);
        break;
      }
      if (bot.bout !== bout) { bout = bot.bout; boutAt = ticks; }
      if (bout) {
        idle = 0;
        over = 0;
        if (ticks - boutAt > boutCap) { bot.cap(); stopped = 'capped'; break; }
        continue;
      }
      const done = runs.filter((r) => r.result !== 'unreached').length;
      if (me.next >= want && done === runs.length) settled++;
      else settled = 0;
      if (settled >= 3) { stopped = 'done'; break; }
      over = g.lockDepth === 0 ? over + 10 : 0;
      if (over >= SCRIPT_OVER) { stopped = 'script over'; break; }
      idle += 10;
      if (idle >= IDLE_CAP) {
        stopped = 'stalled';
        errors.push(`${root.script}: replay stalled at tick ${ticks}, no fight for ${IDLE_CAP} ticks with the script still running (it waits on something the replay cannot do)`);
        break;
      }
    }
    if (stopped === 'budget') errors.push(`${root.script}: replay ran out of its ${maxTicks}-tick budget`);
  } finally {
    release(me);
    sim.driver = null;
  }
  // Fights the replay never reached (the script went another way, or the replay stopped early).
  for (const rec of root.fights) if (!runs.some((r) => r.seq === rec.seq)) runs.push(unreachedRun(rec));
  const rep: Replay = { runs, errors: [...sim.errors, ...errors], ticks, stopped };
  trace(root, seed, opts, rep, Date.now() - wall0);
  return rep;
}

// ------------------------------------------------------------------------------------------------ LoG2 reference bosses

/** A LoG2 boss rebuilt with this engine's move set, and the hero LoG2 sends against it (log2_mechanics.md §12). */
export interface ReferenceBoss {
  id: string;
  name: string;
  hero: CharId;
  level: number;
  form: string | null;
  techs: string[];
  charged: boolean;
  /** Senzu Beans carried (LoG2 players usually hold one or two by then). */
  senzu: number;
  /** Ratio the critic's estimate gives (bal.txt), for the record. */
  critic: number;
}

/**
 * LoG2's calibration bosses (ROM enemy_stats.csv / log2_mechanics.md §12): HP, STR/POW/END and scripted ends are
 * LoG2's; behaviour is LoG2's described toolkit mapped onto this engine's boss moves.
 */
export const REFERENCE_BOSSES: Array<ReferenceBoss & { def: EnemyDef }> = [
  {
    id: 'bal_log2_android19', name: 'Android 19 (LoG2 ch. 9)', hero: 'vegeta', level: 18, form: 'ssj', techs: ['kiBlast', 'bigBang'], charged: false, senzu: 2, critic: 2.8,
    def: {
      id: 'bal_log2_android19', name: 'Android 19', sprite: 'universeFighter', hp: 2970, str: 21, pow: 14, end: 11, exp: 0, ai: 'boss', speed: 1.0,
      desc: 'LoG2 reference: absorbs ki (melee only), energy-drain grab.',
      boss: { endAt: 0, absorbKi: true, phases: [{ until: 0, moves: ['chase', 'drain', 'dash', 'chase'], rest: 50 }] },
    },
  },
  {
    id: 'bal_log2_cell', name: 'Cell, imperfect (LoG2 ch. 15)', hero: 'piccolo', level: 27, form: 'unweighted', techs: ['kiBlast', 'specialBeamCannon'], charged: false, senzu: 2, critic: 2.3,
    def: {
      id: 'bal_log2_cell', name: 'Cell (Imperfect)', sprite: 'universeFighter', hp: 5210, str: 32, pow: 32, end: 37, exp: 0, ai: 'boss', speed: 1.1,
      desc: 'LoG2 reference: tail grab drains HP; ends at 50%.',
      boss: { endAt: 0.5, phases: [{ until: 0, moves: ['chase', 'drain', 'shot', 'dash'], rest: 44 }] },
    },
  },
  {
    id: 'bal_log2_perfectCell', name: 'Perfect Cell (LoG2 ch. 21)', hero: 'trunks', level: 30, form: 'ssj', techs: ['kiBlast', 'burningAttack'], charged: false, senzu: 2, critic: 3.4,
    def: {
      id: 'bal_log2_perfectCell', name: 'Perfect Cell', sprite: 'universeFighter', hp: 5160, str: 44, pow: 46, end: 50, exp: 0, ai: 'boss', speed: 1.3,
      desc: 'LoG2 reference: fast, heavy Kamehameha use; refills to 5,500 at half HP, then ends at 50% again.',
      boss: { endAt: 0.5, refillAt: 0.52, refillTo: 5500, phases: [{ until: 0, moves: ['chase', 'beam', 'teleport', 'dash', 'beam'], rest: 36 }] },
    },
  },
  {
    id: 'bal_log2_superPerfectCell', name: 'Super Perfect Cell (LoG2 finale)', hero: 'gohan', level: 40, form: 'bal_ssjRage', techs: ['kiBlast', 'masenko', 'kamehameha'], charged: true, senzu: 2, critic: 1.8,
    def: {
      id: 'bal_log2_superPerfectCell', name: 'Super Perfect Cell', sprite: 'universeFighter', hp: 8230, str: 60, pow: 59, end: 65, exp: 0, ai: 'boss', speed: 1.3,
      desc: 'LoG2 reference: SSJ2 Gohan with maxed stats; ends at 25%.',
      boss: { endAt: 0.25, phases: [{ until: 0, moves: ['chase', 'beam', 'teleport', 'volley', 'nova'], rest: 32 }] },
    },
  },
  {
    id: 'bal_log2_cooler', name: 'Cooler (LoG2 optional superboss)', hero: 'goku', level: 45, form: 'ssj', techs: ['kiBlast', 'kamehameha'], charged: true, senzu: 2, critic: 12.7,
    def: {
      id: 'bal_log2_cooler', name: 'Cooler', sprite: 'universeFighter', hp: 10200, str: 75, pow: 85, end: 79, exp: 0, ai: 'boss', speed: 1.3,
      desc: 'LoG2 reference: the toughest enemy in LoG2; no healing objects in the arena.',
      boss: { endAt: 0, phases: [{ until: 0, moves: ['chase', 'shot', 'volley', 'beam', 'teleport', 'dash', 'nova'], rest: 30 }] },
    },
  },
];

let refsReady = false;

/** Register the reference bosses, an empty LoG2-style boss arena and the script that starts a reference fight. */
export function registerReferenceBosses(): void {
  if (refsReady) return;
  refsReady = true;
  // LoG2's SSJ2 "Rage" Gohan: stats maxed, no EP drain (the finale's god mode).
  FORMS.bal_ssjRage = { id: 'bal_ssjRage', name: 'Super Saiyan Rage (LoG2)', bonus: 'max', speed: 2, drain: 0, regen: 0, sprite: '', aura: '#f8e048' };
  registerEnemies(REFERENCE_BOSSES.map((r) => r.def));
  const W = 30;
  const H = 20;
  const grid = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (x === 0 || y === 0 || x === W - 1 || y === H - 1 ? '#' : '.')).join(''));
  registerMaps([{ id: 'bal_arena', name: 'Reference Arena', music: 'boss', hostile: true, legend: { '.': 'arena', '#': 'cliff' }, grid }]);
  registerScripts({
    bal_reference: async (s) => {
      const id = String(s.state.get('bal_ref') ?? '');
      await s.fight(id, { x: 20, y: 10, uid: 'bal_refBoss' });
    },
  });
}

/**
 * Fight one LoG2 reference boss (or any registered boss described the same way) with the FairBot on one seed, in an
 * empty boss arena. `setup` may adjust the save first (HP, inventory) once the hero has joined.
 */
export async function runReference(ref: ReferenceBoss, seed: number, setup?: (st: GameState) => void): Promise<Replay> {
  registerReferenceBosses();
  installFightHooks();
  const sim = new Sim();
  sim.fair = true;
  const bot = new FairBot(sim, seed);
  sim.driver = () => bot.step();
  const st = sim.game.state;
  st.data.seed = ((seed + 1) * 0x9e3779b1) >>> 0;
  st.rng = new Rng(0x5eed + ref.level);
  st.join(ref.hero, ref.level);
  st.data.active = ref.hero;
  const c = st.char(ref.hero);
  c.techs = [...ref.techs];
  c.selected = 0;
  c.form = ref.form;
  c.charged = ref.charged;
  st.data.inv = { senzu: ref.senzu };
  st.set('bal_ref', ref.id);
  setup?.(st);
  const runs: FightRun[] = [];
  const rec: RecordedFight = {
    seq: 0, kind: 'boss', type: ref.id, opts: { uid: 'bal_refBoss' }, map: 'bal_arena', chapter: 0, hero: ref.hero, level: ref.level, roster: [], result: null,
  };
  const me = acquire({ bot, game: sim.game, seqs: [rec], runs, next: 0 });
  const errors: string[] = [];
  let ticks = 0;
  let stopped: ReplayStop = 'budget';
  try {
    sim.game.startField('bal_arena', 8, 10, 'right');
    void sim.game.runScript('bal_reference');
    while (ticks < BOUT_CAP + 600) {
      await sim.tick(10);
      ticks += 10;
      if (ACTIVE !== me) { stopped = 'superseded'; errors.push(`${ref.id}: a newer replay took over the fight hooks at tick ${ticks}`); break; }
      if (runs.length && runs[0].result !== 'unreached' && !bot.bout) { stopped = 'done'; break; }
    }
    if (stopped === 'budget' && bot.bout) { bot.cap(); stopped = 'capped'; }
    else if (stopped === 'budget') errors.push(`${ref.id}: the reference fight never resolved in ${ticks} ticks`);
  } finally {
    release(me);
    sim.driver = null;
  }
  if (!runs.length) runs.push(unreachedRun(rec));
  return { runs, errors: [...sim.errors, ...errors], ticks, stopped };
}

// ------------------------------------------------------------------------------------------------ the report

/** Verdicts of the balance report (critic gap 1). */
export type Verdict = 'ok' | 'too hard' | 'too easy' | 'exempt';

/**
 * Story fights whose script carries on after a knock-out (`loseOk` and no retry: the story is told either way).
 * Read from the act scripts; keyed by enemy type, or by uid where a type is also fought for real elsewhere.
 */
export const LOSS_TOLERATED = new Set([
  'c00_blackRage', 'c01_dreamFrieza', 'c02_beerusRage', 'c04_vegetaSpar', 'c08_monakaBeerus', 'c10_black1', 'c11_fusedA',
  'c11_fusedC', 'c13_cauliflaSSJ', 'c13_gohanUltimate', 'c14_jiren1', 'c14_jiren3', 'c14_jiren4',
]);

/** Side fights the story never requires (mini-bosses of side quests, the Satan Dojo sparring ladder, Babari's chief). */
export const OPTIONAL = new Set(['c01_scarface', 'c01_serpent', 'c02_spYamcha', 'c02_spKrillin', 'c02_spTien', 'c10_babarianChief']);

/** Sparring bouts and tests of strength against friends: not "major bosses" for the too-easy rule. */
export const SPARS = new Set([
  'c01_dreamFrieza', 'c04_whis', 'c04_vegetaSpar', 'c07_sparVegeta', 'c09_vegetaSpar', 'c10_zamasuSpar', 'c13_krillin', 'c13_roshiMax',
  'c13_piccolo', 'c13_gohanTag', 'c13_17spar', 'c13_cauliflaSSJ', 'c00_blackRage', 'c02_beerusRage', 'c08_monakaBeerus',
]);

/** LoG2's ratio band (critic, bal.txt): story bosses about 2-4, the finale up to about 6; "well above" = 1.5x. */
export const STORY_BAND = 4;
export const FINALE_BAND = 6;
export const WELL_ABOVE = 1.5;

/** One fight's line in the report. */
export interface FightReport {
  area: 'act1' | 'act2' | 'act3' | 'act4' | 'act5' | 'world';
  chapter: string;
  fightId: string;
  file: string;
  hero: string;
  level: number;
  winRate: number;
  avgSenzu: number;
  ratio: number;
  verdict: Verdict;
  note: string;
}

/** What the verdict rules need to know about a fight besides its runs. */
export interface FightFacts {
  rec: RecordedFight;
  /** Enemy type / uid keyed lists above. */
  exempt: 'survival' | 'scripted loss' | null;
  optional: boolean;
  major: boolean;
  finale: boolean;
  superboss: boolean;
}

/** Classify a recorded fight for the verdict rules. */
export function factsFor(rec: RecordedFight): FightFacts {
  const uid = rec.opts.uid ?? '';
  const exempt = rec.opts.survive ? 'survival' : LOSS_TOLERATED.has(rec.type) || LOSS_TOLERATED.has(uid) ? 'scripted loss' : null;
  const optional = OPTIONAL.has(rec.type);
  const superboss = rec.type.startsWith('post_');
  return {
    rec, exempt, optional, superboss,
    major: rec.kind === 'boss' && !exempt && !optional && !SPARS.has(rec.type),
    finale: rec.chapter === 14,
  };
}

/** Per-fight statistics over the seeds. */
export interface FightStats {
  seeds: number;
  /** Seeds the bot finished on its own, never knocked out. */
  wins: number;
  kos: number;
  /** Seeds handed to the test bot past FIGHT_CAP without a knock-out (includes `capped`). */
  stuck: number;
  /** Seeds still unresolved at BOUT_CAP: timeout losses that stopped the replay. */
  capped: number;
  unreached: number;
  avgSenzu: number;
  avgFish: number;
  avgSeconds: number;
  /** Mean boss HP fraction left when the hero went down (KO seeds only), -1 without KOs. */
  bossAtKo: number;
  ratio: HitsRatio | null;
  form: string | null;
  /** Mean HP fraction the hero entered the fight with. */
  hpIn: number;
}

/** Fold a fight's first-attempt runs (one per seed) into statistics. */
export function statsFor(runs: FightRun[]): FightStats {
  const n = runs.length;
  const played = runs.filter((r) => r.result !== 'unreached');
  const kos = played.filter((r) => r.ko || r.result === 'lose');
  const stuck = played.filter((r) => r.assisted && !r.ko);
  const wins = played.filter((r) => !r.ko && !r.assisted && r.result !== 'lose' && r.result !== 'capped');
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const atKo = kos.map((r) => (r.bossAtKo >= 0 ? r.bossAtKo : r.bossLeft));
  return {
    seeds: n, wins: wins.length, kos: kos.length, stuck: stuck.length, capped: played.filter((r) => r.result === 'capped').length, unreached: n - played.length,
    avgSenzu: mean(played.map((r) => r.senzu)), avgFish: mean(played.map((r) => r.fish)),
    avgSeconds: mean(played.map((r) => (r.koFrame >= 0 ? r.koFrame : r.frames) / 60)),
    bossAtKo: atKo.length ? mean(atKo) : -1,
    ratio: played.find((r) => r.ratio)?.ratio ?? null,
    form: played[0]?.form ?? null,
    hpIn: mean(played.filter((r) => r.hpMax > 0).map((r) => r.hpStart / r.hpMax)),
  };
}

/**
 * The verdict (task rules): exempt for scripted losses and survival fights; too hard below an 80% win rate, above two
 * Senzu Beans on average, or with a hits ratio well above LoG2's band (story 4, Chapter 14 finale 6, x1.5); too
 * easy for a major boss under ratio 1; superbosses are judged against the same bot's LoG2 Cooler.
 */
export function verdictFor(facts: FightFacts, st: FightStats, cooler?: FightStats): Verdict {
  if (facts.exempt) return 'exempt';
  const rate = st.seeds ? st.wins / st.seeds : 0;
  const ratio = st.ratio?.ratio ?? 0;
  if (facts.superboss && cooler) {
    const coolerRate = cooler.seeds ? cooler.wins / cooler.seeds : 0;
    const coolerRatio = cooler.ratio?.ratio ?? 0;
    if (rate + 0.2 < coolerRate || st.avgSenzu > 3 || ratio > coolerRatio * 1.25) return 'too hard';
    return ratio < 1 ? 'too easy' : 'ok';
  }
  const band = facts.finale ? FINALE_BAND : STORY_BAND;
  if (rate < 0.8 || st.avgSenzu > 2 || (facts.rec.kind === 'boss' && ratio > band * WELL_ABOVE)) return 'too hard';
  if (facts.major && ratio > 0 && ratio < 1) return 'too easy';
  return 'ok';
}

/** Human-readable details for the report line. */
export function noteFor(facts: FightFacts, st: FightStats, extra: string[] = []): string {
  const parts: string[] = [];
  const r = st.ratio;
  parts.push(`${st.wins}/${st.seeds} won by the fair bot` + (st.kos ? `, ${st.kos} KO (boss at ${Math.round(st.bossAtKo * 100)}% HP on average)` : '')
    + (st.stuck ? `, ${st.stuck} stuck past ${FIGHT_CAP / 3600} min` : '') + (st.capped ? ` (${st.capped} never resolved: timeout loss)` : '')
    + (st.unreached ? `, ${st.unreached} not reached` : ''));
  parts.push(`avg ${st.avgSeconds.toFixed(0)} s, ${st.avgSenzu.toFixed(1)} Senzu` + (st.avgFish ? ` + ${st.avgFish.toFixed(1)} Fish` : ''));
  if (r) parts.push(`${facts.rec.kind === 'wave' ? 'wave: melee hits to clear all' : 'hits to end'} ${r.hitsToEnd} (hero hit ${r.heroHit}) / hits to KO ${r.hitsToKO} (boss hit ${r.bossHit})`);
  if (st.form) parts.push(`form ${st.form}`);
  if (st.hpIn > 0 && st.hpIn < 0.75) parts.push(`entered at ${Math.round(st.hpIn * 100)}% HP`);
  if (facts.exempt === 'survival') parts.push(facts.rec.opts.loseOk ? 'survival fight (a KO is a scripted loss)' : 'survival fight: a KO here is a Game Over');
  if (facts.exempt === 'scripted loss') parts.push('loseOk: the story continues after a knock-out');
  if (facts.optional) parts.push('optional side fight');
  if (facts.superboss) parts.push('post-game superboss');
  return [...parts, ...extra].join('; ');
}

// ------------------------------------------------------------------------------------------------ zone clears

/**
 * Free-roam zone clears (critic round 2, gap 1). The story-fight replays above never measure LoG2's core loop: walking
 * into a hostile zone and fighting its regular enemies for EXP. `clearZone` puts the hero on a map with a given save,
 * spawns the map's enemies exactly as the game does for that save (showIf / hideIf / defeated flags), and has the
 * FairBot hunt down every enemy it can reach on foot from where the player enters, nearest by walking distance,
 * through real input and real damage both ways. The map is held the way a player clearing it would hold it: exits
 * and doors are sealed (nobody walks out halfway through a clear), story triggers are left alone (a clear measures
 * the zone, not a cutscene the hero happens to cross), and a knock-out does not end the run: it is counted, the hero
 * gets back up at full HP (LoG2: Game Over and reload) and the clear goes on, so "KOs per clear" can exceed one.
 */

/** What one enemy type did in a zone clear. */
export interface ZoneFoe {
  /** Spawned within reach of the entry (the clear's scope). */
  count: number;
  killed: number;
  /** Damage it dealt the hero, and the knock-outs it landed the last blow of. */
  dealt: number;
  koBlows: number;
}

/**
 * Why a clear stopped: every enemy in scope died ('cleared'); the caller's `until` goal was met first ('goal'); no
 * kill for `stallFrames` ('stalled'); the play-time budget ran out ('budget'); a story script on entering the map
 * never handed the controls back ('locked'); or the hero ended up on another map ('left').
 */
export type ZoneStop = 'cleared' | 'goal' | 'stalled' | 'budget' | 'locked' | 'left';

/** One zone clear on one seed. */
export interface ZoneClear {
  map: string;
  seed: number;
  hero: CharId;
  level: number;
  levelEnd: number;
  /** The hero's Z form (the bot transforms whenever the triangle is full). */
  form: string | null;
  /** Tile the hero entered on. */
  entry: { x: number; y: number };
  /** Regular enemies on the map, those reachable on foot from the entry (the scope), and those killed. */
  spawned: number;
  scoped: number;
  kills: number;
  stopped: ZoneStop;
  /**
   * Frames of field play until the last kill (dialogue and the pause menu stop the field clock); a stalled clear
   * stops counting at its last kill (the player gives up on the rest and walks on).
   */
  frames: number;
  kos: number;
  senzu: number;
  fish: number;
  cookies: number;
  /** Damage the hero took (every hit counted in full, also the one that knocks the hero out). */
  taken: number;
  /** EXP the hero gained (kills only; the ROM clamp applies). */
  exp: number;
  /** Per enemy type. */
  foes: Record<string, ZoneFoe>;
  /**
   * The save when the clear stopped (`JSON.stringify(state.data)`): HP, EXP, levels and the Senzu left, for chaining
   * clears the way a player grinds (leave the map, come back to fresh spawns). The clear's own enemy uids are dropped.
   */
  save: string;
}

/** Options for `clearZone`. */
export interface ZoneOptions {
  /** Entry tile (default: the landing spot, door, flight circle or save point from which the most enemies are reachable). */
  entry?: { x: number; y: number };
  /** Frames of play before the clear is given up (capped a second below FIGHT_CAP, so the test bot never takes over). */
  maxFrames?: number;
  /** Frames without a kill before the clear is given up. */
  stallFrames?: number;
  /** Called after the bot's input every tick of the clear (debug traces). */
  watch?: (bot: FairBot) => void;
  /** Stop as soon as this holds (checked every 5 ticks), e.g. the hero reaching a story gate's level: 'goal'. */
  until?: (st: GameState) => boolean;
}

/** The attack stat a regular enemy hits with: POW for shooters, the stronger of the two for flamers and exploders. */
export function mobAttack(def: EnemyDef): number {
  if (def.ai === 'shooter') return def.pow;
  if (def.ai === 'heavy' || def.ai === 'exploder') return Math.max(def.str, def.pow);
  return def.str;
}

/** `hitsRatio` for a regular enemy: hits to kill it, and its hits (with its real attack stat) to knock the hero out. */
export function mobRatio(hero: RatioHero, def: EnemyDef): HitsRatio {
  return hitsRatio(hero, { ...def, str: mobAttack(def), boss: undefined });
}

/** Regular enemies a zone clear fights (not bosses, scripted actors, invulnerable herds or hazards). */
function zoneFoe(e: Enemy): boolean {
  return !e.dead && e.state !== 'dying' && !e.isBoss && !e.puppet && !e.hidden && !e.def.invulnerable && e.def.ai !== 'hazard';
}

/**
 * Where a player can enter a map, in tiles: its world-map landing spots, the doors, flight circles and edge exits of
 * other maps that lead to it, then its own save points, flight circles and world signs, then its centre.
 */
export function zoneEntries(mapId: string): Array<{ x: number; y: number }> {
  const def = resolveMap(mapId);
  if (!def) return [];
  const grid = parseGrid(def);
  const W = grid[0].length;
  const H = grid.length;
  const out: Array<{ x: number; y: number }> = [];
  for (const s of Object.values(SPOTS)) if (s.map === mapId && !s.toWorld) out.push({ x: s.tx, y: s.ty });
  for (const id of Object.keys(MAPS)) {
    if (id === mapId) continue;
    const m = resolveMap(id);
    for (const w of m?.warps ?? []) if (w.to === mapId) out.push({ x: w.tx, y: w.ty });
    for (const o of m?.objects ?? []) if (o.type === 'flight' && o.to === mapId) out.push({ x: o.tx, y: o.ty });
    for (const [side, ex] of Object.entries(m?.exits ?? {})) {
      if (!m || ex?.to !== mapId) continue;
      // Game.edgeExit keeps the coordinate along the edge (plus the exit's offset): arrive where the middle of the
      // source edge's open ground lands, on the opposite edge of this map.
      const src = parseGrid(m);
      const sw = src[0].length;
      const sh = src.length;
      const along = side === 'north' || side === 'south'
        ? Array.from({ length: sw }, (_, x) => x).filter((x) => !terrainSolid(src[side === 'north' ? 0 : sh - 1][x]))
        : Array.from({ length: sh }, (_, y) => y).filter((y) => !terrainSolid(src[y][side === 'west' ? 0 : sw - 1]));
      if (!along.length) continue;
      const k = along[Math.floor(along.length / 2)] + (ex.offset ?? 0);
      if (side === 'north') out.push({ x: Math.min(W - 1, Math.max(0, k)), y: H - 2 });
      else if (side === 'south') out.push({ x: Math.min(W - 1, Math.max(0, k)), y: 1 });
      else if (side === 'east') out.push({ x: 1, y: Math.min(H - 1, Math.max(0, k)) });
      else out.push({ x: W - 2, y: Math.min(H - 1, Math.max(0, k)) });
    }
  }
  for (const o of def.objects ?? []) if (o.type === 'save' || o.type === 'flight' || o.type === 'worldSign') out.push({ x: o.x, y: o.y + 1 });
  out.push({ x: Math.floor(W / 2), y: Math.floor(H / 2) });
  return out;
}

/** Frames a clear's target may go undented before the bot turns to the others, and how long it then leaves it. */
const SHUN_AFTER = 15 * 60;
const SHUN_FOR = 30 * 60;

/** The zone clear running in this process (the damage hook attributes hits to its enemy types). */
interface ActiveZone {
  field: Field;
  foes: Record<string, ZoneFoe>;
  /** Type of the enemy that landed the latest hit. */
  last: string | null;
  kos: number;
}

let ZONE: ActiveZone | null = null;
let zoneHooked = false;

/** Attribute every hit on the hero during a zone clear to the enemy type that dealt it (installed once). */
function installZoneHooks(): void {
  if (zoneHooked) return;
  zoneHooked = true;
  const orig = Field.prototype.damagePlayer;
  Field.prototype.damagePlayer = function (this: Field, atk: number, mult: number, fromX: number, fromY: number, opts?: { noKnock?: boolean; noInv?: boolean }): number {
    const z = ZONE;
    if (!z || z.field !== this) return orig.call(this, atk, mult, fromX, fromY, opts);
    // The attacker: the nearest enemy (alive or bursting) whose STR or POW is the attack stat.
    let who: Enemy | null = null;
    let bd = Infinity;
    for (const e of this.enemies) {
      if (e.dead || e.puppet) continue;
      if (e.def.str !== atk && e.def.pow !== atk && Math.max(e.def.str, e.def.pow) !== atk) continue;
      const d = Math.hypot(e.x - fromX, e.y - fromY);
      if (d < bd) { bd = d; who = e; }
    }
    const type = who?.def.id ?? '?';
    z.last = type;
    const dealt = orig.call(this, atk, mult, fromX, fromY, opts);
    if (dealt > 0) (z.foes[type] ??= { count: 0, killed: 0, dealt: 0, koBlows: 0 }).dealt += dealt;
    return dealt;
  };
}

/**
 * Clear a hostile map with the FairBot on one seed, from `save` (a `JSON.stringify(state.data)`): every regular enemy
 * the game spawns for that save and the hero can reach on foot from the entry. See the section comment.
 */
export async function clearZone(save: string, mapId: string, seed: number, opts: ZoneOptions = {}): Promise<ZoneClear> {
  installZoneHooks();
  const sim = new Sim();
  sim.fair = true;
  const bot = new FairBot(sim, seed);
  bot.slidePaths = true;
  const g = sim.game;
  const data = JSON.parse(save) as SaveData;
  data.seed = ((seed + 1) * 0x9e3779b1) >>> 0;
  g.state = new GameState(data);
  const st = g.state;
  const cs = st.hero;
  const def = resolveMap(mapId);
  if (!def) throw new Error(`clearZone: no map ${mapId}`);
  /** True once the clear hands the player the controls (free roam: no script holds them). */
  let holding = false;
  sim.driver = () => {
    const f = g.field;
    if (f) {
      // No story triggers on the field (walk-in and A-button ones alike): a clear measures the zone.
      if (f.def.triggers?.length) (f as unknown as { def: MapDef }).def = { ...f.def, triggers: [] };
      if (holding && g.lockDepth === 0) g.allowControl = true;
    }
    bot.step();
    if (holding) opts.watch?.(bot);
  };
  const revive = (): boolean => { const pl = g.field?.player; if (pl) { pl.cs.hp = pl.cs.hpMax; pl.inv = 90; } return true; };
  g.onPlayerDown = revive;
  const settle = async (limit: number): Promise<boolean> => {
    for (let calm = 0, t = 0; calm < 6; t += 5) {
      if (t > limit) return false;
      await sim.tick(5);
      calm = g.lockDepth === 0 ? calm + 1 : 0;
    }
    return true;
  };
  const candidates = opts.entry ? [opts.entry] : zoneEntries(mapId);
  const first = candidates[0] ?? { x: 1, y: 1 };
  const blank = (stopped: ZoneStop): ZoneClear => ({
    map: mapId, seed, hero: cs.id, level: cs.level, levelEnd: cs.level, form: cs.form, entry: first, spawned: 0, scoped: 0, kills: 0, stopped,
    frames: 0, kos: 0, senzu: 0, fish: 0, cookies: 0, taken: 0, exp: 0, foes: {}, save,
  });
  // Sealed from the first frame: exits, doors, flight circles and save points stay shut (a player clearing the zone
  // stays in it), also while the map's entry scripts run.
  g.fightDepth++;
  g.startField(mapId, first.x, first.y, 'down');
  if (!(await settle(6000))) {
    // A story scene runs on entry (a scripted fight, say): let the test bot finish it, then walk in afresh.
    sim.fair = false;
    await settle(40000);
    sim.fair = true;
    g.startField(mapId, first.x, first.y, 'down');
    if (!(await settle(6000))) { sim.driver = null; g.fightDepth = 0; return blank('locked'); }
  }
  const f = g.field;
  if (!f || f.def.id !== mapId) { sim.driver = null; g.fightDepth = 0; return blank('left'); }
  // Enter where the most of the zone is reachable on foot.
  const p = f.player;
  let best = { at: first, n: -1, reach: new Set<string>() };
  for (const c of candidates) {
    p.x = c.x * TILE + 8;
    p.y = c.y * TILE + 14;
    unstick(f);
    const reach = sim.reach();
    const n = f.enemies.filter((e) => zoneFoe(e) && Sim.inReach(reach, e)).length;
    if (n > best.n) best = { at: { x: Math.floor(p.x / TILE), y: Math.floor((p.y - 8) / TILE) }, n, reach };
  }
  p.x = best.at.x * TILE + 8;
  p.y = best.at.y * TILE + 14;
  p.dir = 'down';
  const spawned = f.enemies.filter(zoneFoe);
  const scope = spawned.filter((e) => Sim.inReach(best.reach, e));
  const foes: Record<string, ZoneFoe> = {};
  scope.forEach((e, i) => {
    e.uid ??= `zone:${i}`;
    (foes[e.def.id] ??= { count: 0, killed: 0, dealt: 0, koBlows: 0 }).count++;
  });
  const zone: ActiveZone = { field: f, foes, last: null, kos: 0 };
  g.onPlayerDown = () => {
    zone.kos++;
    if (zone.last) (foes[zone.last] ??= { count: 0, killed: 0, dealt: 0, koBlows: 0 }).koBlows++;
    return revive();
  };
  const hero = cs.id;
  const level = cs.level;
  const exp0 = cs.exp;
  const maxFrames = Math.min(opts.maxFrames ?? FIGHT_CAP, FIGHT_CAP - 60);
  const stallFrames = opts.stallFrames ?? 90 * 60;
  let stopped: ZoneStop = 'budget';
  let t0 = f.tick;
  let lastKill = f.tick;
  let killed = 0;
  ZONE = zone;
  holding = true;
  const run = bot.begin('wave', '', { uid: scope.map((e) => e.uid).join(',') }, -1, 1);
  t0 = f.tick;
  lastKill = t0;
  let chase: { e: Enemy | null; hp: number; since: number } = { e: null, hp: 0, since: t0 };
  try {
    // Real ticks per field frame are bounded too: dialogue (signs, NPCs the bot bumps into) holds the field clock.
    for (let ticks = 0; ticks < maxFrames * 3 + 20000; ticks += 5) {
      await sim.tick(5);
      if (g.field !== f) { stopped = 'left'; break; }
      const down = scope.filter((e) => e.dead || e.state === 'dying').length;
      if (down > killed) { killed = down; lastKill = f.tick; }
      // A target the bot has chased for SHUN_AFTER frames without denting it (a drone hovering over a wall, a
      // flyer across a ledge): a player turns to the others first and comes back to it later.
      const t = bot.target;
      if (t && t !== chase.e) chase = { e: t, hp: t.hp, since: f.tick };
      else if (t && t.hp < chase.hp) { chase.hp = t.hp; chase.since = f.tick; }
      else if (t && f.tick - chase.since > SHUN_AFTER) { bot.shun(t, f.tick + SHUN_FOR); chase = { e: null, hp: 0, since: f.tick }; }
      if (down === scope.length) { stopped = 'cleared'; break; }
      if (opts.until?.(st)) { stopped = 'goal'; break; }
      if (f.tick - t0 >= maxFrames || bot.assisting) { stopped = 'budget'; break; }
      if (f.tick - lastKill >= stallFrames) { stopped = 'stalled'; break; }
    }
  } finally {
    bot.end('cleared');
    g.fightDepth = 0;
    holding = false;
    if (ZONE === zone) ZONE = null;
    sim.driver = null;
  }
  for (const e of scope) if (e.dead || e.state === 'dying') foes[e.def.id].killed++;
  const c = st.char(hero);
  const out = JSON.parse(JSON.stringify(st.data)) as SaveData;
  for (const k of Object.keys(out.flags)) if (k.startsWith('defeated:zone:')) delete out.flags[k];
  return {
    map: mapId, seed, hero, level, levelEnd: c.level, form: c.form, entry: best.at, spawned: spawned.length, scoped: scope.length, kills: killed, stopped,
    frames: (stopped === 'stalled' ? lastKill : f.tick) - t0, kos: zone.kos, senzu: run.senzu, fish: run.fish, cookies: run.cookies,
    taken: Object.values(foes).reduce((a, x) => a + x.dealt, 0), exp: c.exp - exp0, foes, save: JSON.stringify(out),
  };
}

// ------------------------------------------------------------------------------------------------ LoG2 reference zones

/** A LoG2 regular enemy (ROM enemy_stats.csv) and the bestiary entry whose sprite and behaviour stand in for it. */
export interface Log2Foe {
  /** ROM stat index. */
  idx: number;
  name: string;
  hp: number;
  str: number;
  pow: number;
  end: number;
  exp: number;
  /** ROM melee / energy damage-taken multipliers (x128). */
  mel: number;
  en: number;
  /** Bestiary id lending its sprite, AI, speed and shot (the ports in src/content/bestiary.ts). */
  like: string;
}

/** The LoG2 regular enemies the reference zones use (ROM enemy_stats.csv, values verbatim). */
export const LOG2_FOES: Record<number, Log2Foe> = Object.fromEntries(([
  [1, 'Alligator', 600, 29, 1, 20, 5400, 128, 128, 'crab'],
  [8, 'Tiger Bandit', 38, 6, 3, 4, 14, 128, 128, 'bandit'],
  [9, 'Tiger Bandit', 325, 10, 12, 8, 650, 128, 128, 'banditBrute'],
  [10, 'Tiger Bandit', 1120, 34, 42, 25, 25250, 128, 128, 'bandit'],
  [12, 'Warlord\'s Henchman', 900, 10, 30, 26, 3200, 128, 128, 'soldier'],
  [14, 'Snake', 530, 32, 1, 28, 3290, 128, 128, 'sandSnake'],
  [16, 'T-Rex', 5120, 49, 1, 55, 36900, 128, 128, 'blueTRex'],
  [17, 'Wolf', 65, 8, 1, 4, 45, 128, 128, 'wolf'],
  [31, 'Destroyer', 1463, 32, 39, 29, 4170, 128, 128, 'mechTrooper'],
  [32, 'Destroyer', 4200, 49, 44, 43, 58900, 128, 128, 'goldMech'],
  [33, 'Destroyer', 3120, 46, 42, 39, 43180, 128, 128, 'redMech'],
  [37, 'Eggbot', 250, 19, 25, 18, 875, 128, 128, 'mudSlime'],
  [38, 'Eggbot', 525, 35, 41, 22, 2670, 128, 128, 'mudSlime'],
  [39, 'Eggbot', 1349, 47, 53, 52, 46200, 128, 128, 'voidSlime'],
  [40, 'Eggbot', 1130, 38, 44, 34, 33170, 128, 128, 'voidSlime'],
  [51, 'Warlord\'s Henchman', 1100, 15, 42, 36, 16200, 128, 128, 'soldier'],
  [53, 'Snake', 35, 7, 1, 3, 13, 128, 128, 'snake'],
  [54, 'Triceratops', 870, 40, 1, 40, 35000, 128, 64, 'boar'],
  [55, 'Saber-Toothed Tiger', 1500, 25, 1, 21, 20000, 128, 128, 'iceSabertooth'],
  [57, 'Wolf', 675, 29, 1, 24, 1680, 128, 128, 'timberWolf'],
  [58, 'Hawk', 110, 10, 1, 5, 300, 128, 128, 'hawk'],
  [65, 'Ladybug', 29, 1, 7, 4, 16, 128, 128, 'drone'],
  [66, 'Ladybug', 175, 1, 16, 11, 520, 128, 128, 'greenDrone'],
  [67, 'Ladybug', 700, 1, 32, 29, 11200, 128, 128, 'goldDrone'],
  [69, 'Kuma Mercenary', 125, 17, 1, 15, 250, 128, 128, 'bear'],
  [70, 'Kuma Mercenary', 940, 35, 1, 32, 9800, 128, 128, 'greyBear'],
  [71, 'Kuma Mercenary', 596, 25, 1, 20, 3610, 128, 128, 'bear'],
  [75, 'Ninja', 900, 34, 25, 27, 5200, 128, 128, 'bandit'],
  [80, 'Pterodactyl', 900, 28, 1, 16, 9578, 128, 128, 'pterodactyl'],
  [83, 'Snake', 275, 15, 1, 14, 600, 128, 128, 'viper'],
  [85, 'Warlord\'s Henchman', 90, 2, 8, 6, 325, 128, 96, 'soldier'],
  [86, 'Ninja', 1400, 37, 31, 31, 36800, 128, 128, 'bandit'],
  [88, 'Pterodactyl', 1200, 40, 1, 30, 25000, 128, 128, 'stormPtero'],
  [90, 'Scorpion', 400, 18, 1, 11, 750, 128, 128, 'scarab'],
  [91, 'Snake', 125, 10, 1, 5, 350, 128, 128, 'snake'],
  [92, 'Saber-Toothed Tiger', 750, 32, 1, 14, 6160, 128, 128, 'sabertooth'],
  [99, 'T-Rex', 1750, 40, 1, 30, 3750, 128, 128, 'tRex'],
  [102, 'Warthog', 300, 20, 1, 14, 800, 128, 128, 'boar'],
  [103, 'Scorpion', 110, 11, 1, 5, 375, 128, 128, 'scarab'],
  [104, 'Wolf', 1000, 65, 1, 35, 1300, 128, 128, 'snowWolf'],
] as Array<[number, string, number, number, number, number, number, number, number, string]>).map(([idx, name, hp, str, pow, end, exp, mel, en, like]) => [idx, { idx, name, hp, str, pow, end, exp, mel, en, like }]));

/**
 * A LoG2 hostile zone at the stage the story opens it (log2_mechanics.md §10): the ROM area, the hero LoG2 has there
 * and at what level, and its regular enemies with their ROM placement counts in that area. Enemies behind a gate a
 * later chapter opens (the Goku gates' Triceratops, Pterodactyls, T-Rexes and Destroyers, the L50 trophy guards),
 * one-off guardians and LoG2's invulnerable stampede herds are left to the stage that opens them.
 */
export interface Log2Zone {
  id: string;
  /** ROM area name (areas.csv). */
  area: string;
  stage: string;
  hero: CharId;
  level: number;
  form: string | null;
  techs: string[];
  charged: boolean;
  senzu: number;
  /** [ROM stat index, spawners of it in the area]. */
  foes: Array<[number, number]>;
}

export const LOG2_ZONES: Log2Zone[] = [
  { id: 'east_early', area: 'East District 439', stage: 'Trunks Saga ch. 1-3 (Gohan L3)', hero: 'gohan', level: 3, form: null, techs: ['kiBlast'], charged: false, senzu: 0, foes: [[53, 7], [17, 5]] },
  { id: 'wastelands', area: 'Northern Wastelands', stage: 'Trunks Saga ch. 2 (Gohan L3)', hero: 'gohan', level: 3, form: null, techs: ['kiBlast'], charged: false, senzu: 0, foes: [[65, 3], [8, 8]] },
  { id: 'highway', area: 'West City Highway', stage: 'Trunks Saga ch. 4 (Gohan L6)', hero: 'gohan', level: 6, form: null, techs: ['kiBlast'], charged: false, senzu: 0, foes: [[65, 5], [53, 13], [8, 6], [17, 17]] },
  { id: 'jungle', area: 'Triceratops Jungle', stage: 'Trunks Saga ch. 5 (Piccolo L10)', hero: 'piccolo', level: 10, form: null, techs: ['kiBlast'], charged: false, senzu: 0, foes: [[65, 2], [69, 19], [9, 2]] },
  { id: 'warlord', area: 'Warlord\'s Domain', stage: 'Trunks Saga ch. 6 (Piccolo L11)', hero: 'piccolo', level: 11, form: null, techs: ['kiBlast'], charged: false, senzu: 0, foes: [[65, 5], [8, 2], [85, 23]] },
  { id: 'south', area: 'Southern Continent', stage: 'Android Saga ch. 9 (Vegeta L18, SSJ)', hero: 'vegeta', level: 18, form: 'ssj', techs: ['kiBlast', 'bigBang'], charged: false, senzu: 2, foes: [[65, 7], [85, 4], [103, 12], [66, 6], [83, 8], [9, 24], [90, 7]] },
  { id: 'north', area: 'Northern Mountains', stage: 'Android Saga ch. 10-12 (Piccolo L22)', hero: 'piccolo', level: 22, form: null, techs: ['kiBlast', 'specialBeamCannon'], charged: true, senzu: 2, foes: [[8, 4], [85, 10], [58, 6], [66, 11], [37, 57], [83, 10], [102, 27], [9, 45], [14, 3], [57, 7]] },
  { id: 'ginger', area: 'Outside Gingertown', stage: 'Android Saga ch. 14 (Trunks L27, SSJ)', hero: 'trunks', level: 27, form: 'ssj', techs: ['kiBlast', 'burningAttack'], charged: false, senzu: 2, foes: [[91, 12], [66, 2], [38, 9], [71, 21], [12, 5], [31, 2], [99, 1]] },
  { id: 'tropical', area: 'Tropical Islands', stage: 'Perfect Cell ch. 20 (Vegeta L30, SSJ)', hero: 'vegeta', level: 30, form: 'ssj', techs: ['kiBlast', 'bigBang', 'energyPunch'], charged: true, senzu: 2, foes: [[1, 41], [67, 9], [92, 27], [80, 5]] },
  { id: 'snowy', area: 'Snowy Highlands', stage: 'Cell Games prep ch. 23 (Goku L35, SSJ)', hero: 'goku', level: 35, form: 'ssj', techs: ['kiBlast', 'kamehameha', 'spiritBomb'], charged: true, senzu: 2, foes: [[67, 5], [70, 20], [104, 4], [10, 11], [55, 3]] },
  { id: 'east_late', area: 'East District 439', stage: 'Cell Games prep ch. 23, Tao\'s castle (Goku L35, SSJ)', hero: 'goku', level: 35, form: 'ssj', techs: ['kiBlast', 'kamehameha', 'spiritBomb'], charged: true, senzu: 2, foes: [[67, 9], [75, 20], [12, 10], [40, 15], [86, 39], [33, 5]] },
  { id: 'north_late', area: 'Northern Mountains', stage: 'Cell Games prep, beyond the Goku 40 gate (Goku L40, SSJ)', hero: 'goku', level: 40, form: 'ssj', techs: ['kiBlast', 'kamehameha', 'spiritBomb'], charged: true, senzu: 2, foes: [[54, 22], [88, 4], [16, 5], [31, 1], [32, 3]] },
  { id: 'wastelands_late', area: 'Northern Wastelands', stage: 'Cell Games prep, beyond the Goku gate (Goku L40, SSJ)', hero: 'goku', level: 40, form: 'ssj', techs: ['kiBlast', 'kamehameha', 'spiritBomb'], charged: true, senzu: 2, foes: [[51, 11], [10, 2], [86, 4]] },
  { id: 'mushroom', area: 'Mushroom Cavern', stage: 'post-Cell trophy grind (Goku L45, SSJ)', hero: 'goku', level: 45, form: 'ssj', techs: ['kiBlast', 'kamehameha', 'spiritBomb'], charged: true, senzu: 2, foes: [[9, 3], [39, 8], [32, 2]] },
];

/** Spawn points per LoG2 reference map (our hostile maps hold 4-33; most 8-15). */
export const LOG2_SPAWNS = 12;

/** A LoG2 enemy as an engine enemy: ROM stats and resistances, the stand-in's sprite and behaviour. */
export function log2EnemyDef(f: Log2Foe): EnemyDef {
  const like = ENEMIES[f.like] ?? ENEMIES.wolf;
  return {
    ...like, id: `log2_${f.idx}`, name: `${f.name} (LoG2)`, hp: f.hp, str: f.str, pow: f.pow, end: f.end, exp: f.exp,
    resMelee: f.mel / 128, resKi: f.en / 128, drops: undefined, boss: undefined, invulnerable: undefined,
    desc: `LoG2 reference: ROM stat entry ${f.idx}.`,
  };
}

/** Spawn counts for a reference map: the zone's ROM proportions scaled to LOG2_SPAWNS, at least one of each type. */
export function log2Spawns(z: Log2Zone): Array<[number, number]> {
  const total = z.foes.reduce((a, [, n]) => a + n, 0);
  const out = z.foes.map(([idx, n]) => [idx, Math.max(1, Math.round((n / total) * LOG2_SPAWNS))] as [number, number]);
  // Trim the most common types back to the total (rounding up the rare ones can overshoot).
  while (out.reduce((a, [, n]) => a + n, 0) > Math.max(LOG2_SPAWNS, out.length)) {
    const top = out.reduce((a, b) => (b[1] > a[1] ? b : a));
    top[1]--;
  }
  return out;
}

let log2Ready = false;

/**
 * Register the LoG2 enemies and one open reference map per LoG2 zone (`log2_<id>`): 44 x 30 tiles of grass ringed by
 * cliffs, with a few rock outcrops, the spawns spread over the field and the entry at the bottom centre.
 */
export function registerLog2Zones(): void {
  if (log2Ready) return;
  log2Ready = true;
  registerEnemies(Object.values(LOG2_FOES).map(log2EnemyDef));
  const W = 44;
  const H = 30;
  const rows = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (x === 0 || y === 0 || x === W - 1 || y === H - 1 ? '#' : '.')));
  for (const [cx, cy] of [[9, 7], [33, 6], [20, 14], [8, 21], [35, 21], [26, 24]]) {
    for (let y = cy; y < cy + 2; y++) for (let x = cx; x < cx + 3; x++) rows[y][x] = '#';
  }
  const grid = rows.map((r) => r.join(''));
  const slots: Array<[number, number]> = [];
  for (const y of [4, 10, 17, 23]) for (const x of [6, 16, 27, 38]) slots.push([x, y]);
  const maps: MapDef[] = LOG2_ZONES.map((z) => {
    const enemies: EnemySpawn[] = [];
    let k = 0;
    for (const [idx, n] of log2Spawns(z)) for (let i = 0; i < n; i++) { const [x, y] = slots[k++ % slots.length]; enemies.push({ type: `log2_${idx}`, x, y }); }
    return { id: `log2_${z.id}`, name: `${z.area} (LoG2)`, music: 'field', hostile: true, region: 'LoG2 reference', legend: { '.': 'grass', '#': 'cliff' }, grid, enemies };
  });
  registerMaps(maps);
}

/** Entry tile of every LoG2 reference map. */
export const LOG2_ENTRY = { x: 22, y: 27 };

/** A save for a LoG2 reference zone: the hero LoG2 sends there, at its level, techniques, form and Senzu supply. */
export function log2Save(z: Log2Zone): string {
  const st = new GameState();
  st.rng = new Rng(0x10c2 + z.level);
  st.data.chapter = 1;
  st.join(z.hero, z.level);
  st.data.active = z.hero;
  const c = st.char(z.hero);
  c.techs = [...z.techs];
  c.selected = 0;
  c.form = z.form;
  c.charged = z.charged;
  st.data.inv = z.senzu ? { senzu: z.senzu } : {};
  return JSON.stringify(st.data);
}
