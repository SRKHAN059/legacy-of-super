import { POSES, type SpriteSet } from '../../../art/humanoid';
import { spriteSet } from '../../../art/registry';
import { STAT_CAP } from '../../../game/leveling';
import { makeBitmap, type Bitmap } from '../../../engine/gfx';
import { DIRS, type Dir } from '../../../engine/math';
import type { Enemy } from '../../../game/enemy';
import type { Field } from '../../../game/field';
import { registerScripts, type FightOpts, type FightResult, type ScriptApi } from '../../../game/script';
import type { CharId } from '../../characters';
import { ENEMIES } from '../../enemies';
import { ITEMS } from '../../items';
import { force, unforce } from '../common';
import { everyFrame, type FrameLoop } from './c14_assist';
import { bossFight, freeNear, heroTile, refresh, removeAll, stage, warpTo } from './helpers';
import './c13_expo_data';

/**
 * Chapter 13 opening, the Zeno Expo (anime eps 78-82), played LoG2-style: Universe 7 against Universe 9's Trio de
 * Dangers in front of both Zenos and every god, three bouts the player fights, then Toppo's challenge.
 *
 * - Ep 79, Buu vs. Basil: the player controls Majin Buu, drawn as an outfit over a forced Goku (Cabba's and Vegito's
 *   precedent). Buu is not a party member and the guest roster (`CharId`: Android 17, Frieza) would need a new
 *   character with a save slot, level curve and NPC reactions for one bout, so the costume is the clean fit: Buu keeps
 *   Goku's level, a Ki Blast and his copied Kamehameha, no Z form, and his rubber body: once per bout, a blow that would
 *   leave him in pieces snaps him back together. Basil's blast through Buu's belly and the crossfire that floors Mr.
 *   Satan (the hooded Toppo puts another out and scolds Buu) make Buu furious (STR/POW up). Buu knocks Basil out of
 *   the ring, but Universe 7's ring-out rule does not count here: a match goes on until Zeno is satisfied or a fighter
 *   cannot continue. Basil crawls back in and Roh's "tonic" pumps him into Danger Doping ("anything goes"). Basil's
 *   Wolfgang Pressure, then Buu's full-power Kamehameha ends it and Basil collapses as the drug wears off; Buu heals
 *   Mr. Satan and the Grand Priest mends the ring with a snap of his fingers.
 * - Ep 80, Gohan vs. Lavender: forced Gohan. Lavender's mist blinds him: the view darkens, Lavender fades out of sight
 *   and the toxin eats Gohan's HP. Cues: footstep dust, the hiss before each strike, a flicker, a short reveal after
 *   each landed blow, Gohan's hearing when he stands still, and his Super Saiyan reading ki like a radar (which spreads
 *   the poison faster, as Whis warns the first time). The bout ends as canon's does: Gohan's Kamehameha against the
 *   poison blast, then he grabs Lavender from behind and slams them both into the ring, a double knock-out and a
 *   draw. Goku feeds him a Senzu Bean, and the Grand Priest tells every god what losing the tournament means.
 * - Ep 81, Goku vs. Bergamo: the speech that makes Goku the villain of every universe, then a boss who grows with the
 *   blows he absorbs (two visible size and stat steps). Goku wins with a Super Saiyan Blue Kaio-ken Kamehameha against
 *   the Wolfgang Penetrator: a knock-out (an Expo match goes on until a fighter cannot continue).
 * - Eps 81-82, Goku vs. Toppo: he jumps down from Universe 11's box uninvited; Super Saiyan, Justice Tornado, the
 *   Justice Crusher hold, Super Saiyan Blue and a point-blank Kamehameha that tears his uniform, a short bout; as Goku
 *   adds Kaio-ken and charges a Kamehameha the Grand Priest stops it before anyone dies: a draw. Toppo names Jiren
 *   and the Grand Priest announces the Tournament of Power's rules.
 *
 * There is no save disc in the World of Void, so a knock-out never means Game Over here: Zeno wants to see the bout
 * again (an encore) and it restarts fresh; against Toppo the Grand Priest calls the draw early. Each finished bout
 * sets its flag, so a replayed Expo (Beerus at Capsule Corp) picks up at the next one.
 */

const EXPO = 'c13_expo';
/** Bouts finished (a replayed Expo skips them). */
const DONE = { buu: 'c13_expoBuu', gohan: 'c13_expoGohan', bergamo: 'c13_expoBergamo', toppo: 'c13_expoToppo' } as const;
/** The meeting at Zeno's palace and the Expo's opening words were seen. */
const MET = 'c13_expoMet';
const OPENED = 'c13_expoOpened';
/** Story beats already played once this Expo (a replayed bout gets the short version). */
const BEAT = {
  satan: 'c13_expoSatanHit', more: 'c13_expoMore', mist: 'c13_expoMist', radar: 'c13_expoRadar', grow: 'c13_expoGrow', giant: 'c13_expoGiant',
} as const;

/** Senzu Beans the Supreme Kai has left in his bag after Gohan's (ep 80). */
const SHIN_SENZU = 2;

const BASIL_UID = 'c13_basil1';
const LAVENDER_UID = 'c13_lavender1';
const BERGAMO_UID = 'c13_bergamo1';
const TOPPO_UID = 'c13_toppo1';

/** Ring marks: Universe 7's fighter faces up from the south, the opponent faces down from the north. */
const RING = { hero: [16, 16], foe: [16, 11], mid: [16, 13] } as const;
/** The ring's tiles one in from its edge (maps_c13 `c13_expo`: arena x 6-27, y 8-20, corners cut). */
const RING_IN = { x0: 7, x1: 26, y0: 9, y1: 19 } as const;

/** The nearest tile inside the ring, so a cutscene beat staged around a fighter never lands on the void. */
function inRing(x: number, y: number): [number, number] {
  return [Math.max(RING_IN.x0, Math.min(RING_IN.x1, x)), Math.max(RING_IN.y0, Math.min(RING_IN.y1, y))];
}

/** Where everyone watches from: the gods' balcony above the ring. */
const SEATS: Record<string, [string, number, number, string]> = {
  c13_oldKaiX: ['oldKai', 5, 3, 'Old Kai'],
  c13_skX: ['supremeKai', 6, 4, 'Supreme Kai'],
  c13_beerusX: ['beerus', 7, 3, 'Beerus'],
  c13_whisX: ['whis', 8, 4, 'Whis'],
  c13_satanX: ['mrSatan', 9, 3, 'Mr. Satan'],
  c13_gohanX: ['gohan', 11, 4, 'Gohan'],
  c13_buuX: ['majinBuu', 12, 3, 'Buu'],
  c13_zeno: ['zeno', 15, 4, 'Zeno'],
  c13_zenoF: ['zeno', 17, 4, 'Future Zeno'],
  c13_gp: ['grandPriest', 19, 3, 'Grand Priest'],
  c13_champaX: ['champa', 21, 3, 'Champa'],
  c13_vadosX: ['vados', 22, 4, 'Vados'],
  c13_toppoX: ['toppo', 24, 3, '???'],
  c13_mojitoX: ['c13_mojito', 25, 4, 'Mojito'],
  c13_sidraX: ['c13_sidra', 26, 3, 'Sidra'],
  c13_rohX: ['c13_roh', 27, 4, 'Roh'],
  c13_basilX: ['basil', 28, 3, 'Basil'],
  c13_lavenderX: ['lavender', 29, 4, 'Lavender'],
  c13_bergamoX: ['bergamo', 30, 3, 'Bergamo'],
};
/** Goku's own seat (the hero sits here; while someone else fights, a Goku actor does). */
const GOKU_SEAT = [13, 4] as const;

// ================================================================ staging

/** Seat everyone who is not already on the balcony. */
function seatAll(s: ScriptApi): void {
  for (const [id, [sprite, x, y, name]] of Object.entries(SEATS)) {
    if (s.exists(id)) continue;
    stage(s, id, sprite, x, y, 'down', name);
  }
  // Toppo watches from Universe 11's box under a hooded cloak until he jumps into the ring.
  if (s.exists('c13_toppoX') && !s.flag(DONE.toppo)) s.silhouette('c13_toppoX', true);
}

/** Every actor the Expo staged. */
function clearExpo(s: ScriptApi): void {
  removeAll(s, ...Object.keys(SEATS), 'c13_gokuX', BASIL_UID, LAVENDER_UID, BERGAMO_UID, TOPPO_UID);
}

/** Fly an actor between the balcony and the ring (fighters jump down into the ring, as in the anime). */
async function hop(s: ScriptApi, id: string, x: number, y: number, speed = 2.6): Promise<void> {
  if (!s.exists(id)) return;
  await s.lift(id, 14, 8);
  s.pose(id, 'fly');
  await s.walk(id, x, y, speed);
  s.pose(id, null);
  await s.lift(id, 0, 6);
}

/** Tile an actor stands on. */
function tileOf(s: ScriptApi, id: string): [number, number] {
  const a = s.actor(id);
  return [Math.floor(a.x / 16), Math.floor((a.y - 14) / 16)];
}

/** The live enemy with this uid, if it is on the field. */
function foe(s: ScriptApi, uid: string): Enemy | undefined {
  return s.field.enemies.find((e) => e.uid === uid && !e.dead);
}

/**
 * Hand the controls to the next fighter: in the dark, the hero's current self stays seated as an actor (`out`) and
 * the player takes the seat of `seat` (that actor leaves the balcony), then jumps into the ring.
 */
async function intoRing(s: ScriptApi, become: () => void, out: { id: string; sprite: string; name: string } | null, seat: string | null): Promise<void> {
  await s.fadeOut(14);
  const [hx, hy] = heroTile(s);
  if (out) stage(s, out.id, out.sprite, hx, hy, 'down', out.name);
  become();
  if (seat && s.exists(seat)) {
    const [sx, sy] = tileOf(s, seat);
    s.remove(seat);
    s.place('hero', sx, sy, 'down');
  }
  await s.fadeIn(14);
  s.follow();
  await hop(s, 'hero', RING.hero[0], RING.hero[1]);
  s.face('hero', 'up');
}

/** Lord Zeno wants to see it again: the bout restarts from the top with a fresh fighter (no Game Over in the Expo). */
async function encore(s: ScriptApi, uid: string, hero: CharId): Promise<void> {
  s.letterbox(true);
  removeAll(s, uid);
  s.pose('hero', null);
  s.flash('#ffffff', 12);
  await s.talk([
    ['zeno', 'Again! Again! Show me that one again!', 'happy'],
    ['grandPriest', 'You heard Lord Zeno. Both fighters, back to your marks. The match starts over.', 'neutral'],
  ]);
  refresh(s, hero);
  s.place('hero', RING.hero[0], RING.hero[1], 'up');
  s.letterbox(false);
}

/** A bout with Zeno's encore: lost bouts restart until the hero wins or reaches the scripted end. */
async function bout(s: ScriptApi, type: string, uid: string, hero: CharId, opts: FightOpts = {}, perBout?: () => FrameLoop): Promise<FightResult> {
  for (;;) {
    const loop = perBout?.();
    let r: FightResult;
    try {
      r = await bossFight(s, type, { x: RING.foe[0], y: RING.foe[1], uid, loseOk: true, ...opts });
    } finally {
      loop?.stop();
    }
    if (r !== 'lose') return r;
    await encore(s, uid, hero);
  }
}

// ================================================================ Majin Buu (ep 79)

/** Goku's HP, EP, form and techniques before he lent Buu his stats (restored when the bout ends). */
const BUU_STASH = 'c13_expoBuuStash';
/** Stat points Buu's anger added (so they come off exactly). */
const BUU_RAGE = 'c13_expoBuuRage';
/** Buu's controls were explained (once per Expo). */
const BUU_TIP = 'c13_expoBuuTip';
/** Buu's kit: a Ki Blast and the Kamehameha he copied from Goku long ago. */
const BUU_TECHS = ['kiBlast', 'kamehameha'];
/** STR/POW Buu gains when Basil's crossfire floors Mr. Satan. */
const BUU_RAGE_BONUS = 8;
/** Rubber body: once per bout, at or below `at` of his HP, Buu pulls himself back together to `to`. */
export const RUBBER = { at: 0.35, to: 0.75 } as const;

interface BuuStash { hp: number; ep: number; form: string | null; techs: string[]; selected: number }

/** Put the player in Buu's shoes: Goku forced, Buu's costume and kit, no Z form, fresh HP/EP. */
function becomeBuu(s: ScriptApi): void {
  const c = s.state.char('goku');
  if (s.state.get(BUU_STASH) === undefined) {
    const stash: BuuStash = { hp: c.hp, ep: c.ep, form: c.form, techs: [...c.techs], selected: c.selected };
    s.set(BUU_STASH, JSON.stringify(stash));
  }
  force(s, 'goku');
  s.transformNow(null);
  c.form = null;
  c.techs = [...BUU_TECHS];
  c.selected = 0;
  s.outfit('goku', 'majinBuu');
  refresh(s, 'goku');
}

/** Buu's anger on (STR/POW up, to the stat cap) or off. Safe to call twice either way. */
function buuRage(s: ScriptApi, on: boolean): void {
  const c = s.state.char('goku');
  const raw = s.state.get(BUU_RAGE);
  if (on && raw === undefined) {
    const add = (v: number): number => Math.max(0, Math.min(BUU_RAGE_BONUS, STAT_CAP - v));
    const a = [add(c.str), add(c.pow)];
    c.str += a[0];
    c.pow += a[1];
    s.set(BUU_RAGE, a.join(','));
  } else if (!on && typeof raw === 'string') {
    const [a, b] = raw.split(',').map((v) => parseInt(v, 10) || 0);
    c.str -= a;
    c.pow -= b;
    s.clear(BUU_RAGE);
  }
}

/** Back to Goku: costume and anger off, his HP, EP, form and techniques as they were. */
function leaveBuu(s: ScriptApi): void {
  buuRage(s, false);
  const c = s.state.char('goku');
  const raw = s.state.get(BUU_STASH);
  if (typeof raw === 'string') {
    const st = JSON.parse(raw) as BuuStash;
    c.hp = Math.max(1, Math.min(c.hpMax, st.hp));
    c.ep = Math.max(0, Math.min(c.epMax, st.ep));
    c.form = st.form;
    c.techs = st.techs;
    c.selected = st.selected;
  }
  s.clear(BUU_STASH);
  s.outfit('goku', null);
}

/** Buu's rubber body for one bout: the first time his HP falls to RUBBER.at, he snaps back into shape. */
function rubberBody(s: ScriptApi): FrameLoop {
  let used = false;
  return everyFrame(s, (f) => {
    if (used || f.locked) return;
    const b = f.boss;
    if (!b || b.ended || b.dead) return;
    const p = f.player;
    if (p.cs.hp <= 0 || p.cs.hp > p.cs.hpMax * RUBBER.at) return;
    used = true;
    p.cs.hp = Math.max(p.cs.hp, Math.round(p.cs.hpMax * RUBBER.to));
    f.fx.explode(p.x, p.y - 14, 16, '#f8a0c0');
    f.fx.number(p.x, p.y - 40, 'BOING!', '#f8a0c0');
    s.sfx('heal');
  });
}

// ================================================================ Lavender's toxin (ep 80)

/** Raised by Lavender's mist (the blindness and the toxin start), and when he takes to the air. */
const BLIND = 'c13_expoBlind';
const AIRBORNE = 'c13_expoLavAir';
/** Darkened view while blind; a lighter, golden one while Super Saiyan senses his ki. */
const BLIND_TINT = 'rgba(18,6,30,0.58)';
const RADAR_TINT = 'rgba(48,32,0,0.28)';
/**
 * Toxin: HP drained per second (fraction of max), three times faster while transformed; cue timings in frames. `listen`
 * is half a second: Lavender strikes about every 80 frames, so a longer wait would only ever end in his wind-up and
 * standing still would never show him coming.
 */
export const TOXIN = { base: 0.003, radar: 0.009, listen: 30, reveal: 40, flicker: 150, flickerLen: 4 } as const;

/** Lavender's cloak strength for one frame (1 = unseen). */
export function lavenderCloak(c: { radar: boolean; windup: boolean; listening: boolean; airborne: boolean; reveal: number; flicker: number }): number {
  if (c.radar) return 0;
  let k = 1;
  if (c.flicker > 0) k = Math.min(k, 0.6);
  if (c.windup) k = Math.min(k, 0.4);
  if (c.listening && !c.airborne) k = Math.min(k, 0.45);
  if (c.reveal > 0) k = Math.min(k, 0.25);
  return k;
}

/**
 * Gohan's blindness for one bout, active once the mist has hit (BLIND): darkened view, Lavender cloaked, the toxin
 * draining HP (never below 1), and the cues that give Lavender away. Ends with the bout; `clearBlind` lifts it.
 */
function toxin(s: ScriptApi): FrameLoop {
  let n = 0;
  let listen = 0;
  let reveal = 0;
  let flicker = 0;
  let lastHp = -1;
  let acc = 0;
  return everyFrame(s, (f) => {
    const e = f.enemies.find((x) => x.uid === LAVENDER_UID);
    if (!e || e.dead || !s.flag(BLIND)) return;
    if (e.ended || e.puppet || e.state === 'dying') { e.cloak = 0; return; }
    if (f.locked) return;
    n++;
    const p = f.player;
    const radar = !!p.formActive;
    const airborne = s.flag(AIRBORNE);
    // The first time he goes Super Saiyan in the mist: his ki radar, and Whis's warning (once per Expo).
    if (radar && !s.flag(BEAT.radar)) {
      s.set(BEAT.radar);
      f.runScript('c13_lavender_radar');
    }
    f.tintOverride = radar ? RADAR_TINT : BLIND_TINT;
    acc += (p.cs.hpMax * (radar ? TOXIN.radar : TOXIN.base)) / 60;
    while (acc >= 1) { acc -= 1; if (p.cs.hp > 1) p.cs.hp--; }
    if (lastHp >= 0 && e.hp < lastHp) reveal = TOXIN.reveal;
    lastHp = e.hp;
    listen = !p.moving && p.state === 'free' ? listen + 1 : 0;
    if (reveal > 0) reveal--;
    if (flicker > 0) flicker--;
    else if (n % TOXIN.flicker === 0) flicker = TOXIN.flickerLen;
    e.z = airborne ? 10 : 0;
    // Footsteps on the stone (gone once he flies), the hiss of the spray before he strikes, Gohan listening.
    if (!airborne && e.moving && n % 10 === 0) f.fx.dust(e.x, e.y);
    if (e.state === 'windup' && n % 4 === 0) f.fx.hit(e.x, e.cy, '#d0a0ff', 3);
    if (listen === TOXIN.listen && !airborne) f.fx.number(p.x, p.y - 40, '...', '#e8f0ff');
    e.cloak = lavenderCloak({ radar, windup: e.state === 'windup', listening: listen >= TOXIN.listen, airborne, reveal, flicker });
  });
}

/** Gohan can see again: tint off, Lavender visible and back on the ground. */
function clearBlind(s: ScriptApi): void {
  s.clear(BLIND);
  s.clear(AIRBORNE);
  s.field.tintOverride = undefined;
  const e = foe(s, LAVENDER_UID) ?? s.field.enemies.find((x) => x.uid === LAVENDER_UID);
  if (e) { e.cloak = 0; e.z = 0; }
}

// ================================================================ Bergamo's growth (ep 81)

/** Bergamo's size steps: his bestiary entry, sprite scale, hurtbox size (creature frame) and feet box. */
const GROWTH = [
  { def: 'c13_bergamo', scale: 1, size: 0, box: [10, 6] },
  { def: 'c13_bergamoL', scale: 1.5, size: 40, box: [16, 8] },
  { def: 'c13_bergamoXL', scale: 2, size: 48, box: [22, 10] },
] as const;

const scaledCache = new Map<string, SpriteSet>();

/** A sprite set scaled up by `k` with nearest-neighbour pixels (the GBA's affine sprite scaling). */
export function scaledSprite(id: string, k: number): SpriteSet {
  const key = `${id}@${k}`;
  const hit = scaledCache.get(key);
  if (hit) return hit;
  const base = spriteSet(id);
  const done = new Map<Bitmap, Bitmap>();
  const scale = (src: Bitmap): Bitmap => {
    const had = done.get(src);
    if (had) return had;
    const { bmp, ctx } = makeBitmap(Math.round(src.width * k), Math.round(src.height * k));
    ctx.drawImage(src, 0, 0, bmp.width, bmp.height);
    done.set(src, bmp);
    return bmp;
  };
  const out = {} as SpriteSet;
  for (const pose of POSES) {
    const dirs = {} as Record<Dir, Bitmap>;
    for (const d of DIRS) dirs[d] = scale(base[pose][d]);
    out[pose] = dirs;
  }
  scaledCache.set(key, out);
  return out;
}

/** Bergamo's current size step (0 = as he entered the ring). */
export function growthOf(e: Enemy): number {
  const i = GROWTH.findIndex((g) => g.def === e.def.id);
  return Math.max(0, i);
}

/** Step Bergamo up to `stage`: new entry (stats, name), bigger sprite, hurtbox and feet; nudged clear of the void. */
function applyGrowth(f: Field, e: Enemy, stage: number): void {
  const g = GROWTH[stage];
  const def = ENEMIES[g.def];
  if (!def) throw new Error(`[c13] Bergamo growth entry ${g.def} missing`);
  e.def = def;
  e.set = g.scale === 1 ? spriteSet('bergamo') : scaledSprite('bergamo', g.scale);
  e.creatureSize = g.size;
  e.w = g.box[0];
  e.h = g.box[1];
  if (!f.col.blocked(e.box())) return;
  // A bigger body may not fit where he stood (the ring's edge): step toward the middle until it does.
  const [cx, cy] = [RING.mid[0] * 16 + 8, RING.mid[1] * 16 + 14];
  for (let i = 1; i <= 24 && f.col.blocked(e.box()); i++) {
    e.x += Math.sign(cx - e.x) * Math.min(4, Math.abs(cx - e.x));
    e.y += Math.sign(cy - e.y) * Math.min(4, Math.abs(cy - e.y));
  }
}

/** The growth beat at a phase change: Bergamo glows, swells and gets stronger (the lines play once per Expo). */
async function grow(s: ScriptApi, stage: number): Promise<void> {
  const e = foe(s, BERGAMO_UID);
  if (!e || growthOf(e) >= stage) return;
  const live = !e.ended;
  if (live) e.puppet = true;
  s.flash('#e0b0ff', 10);
  await s.powerUp(BERGAMO_UID, '#b070d0', 36);
  applyGrowth(s.field, e, stage);
  s.shake(24, 2);
  s.field.fx.number(e.x, e.y - (e.creatureSize || 32) - 10, stage === 1 ? 'BIGGER!' : 'GIANT!', '#e0a0ff');
  const beat = stage === 1 ? BEAT.grow : BEAT.giant;
  if (!s.flag(beat)) {
    s.set(beat);
    await s.talk(stage === 1 ? [
      ['bergamo', 'Yes... YES! Every blow you land feeds me. Keep going, Son Goku!', 'smirk'],
      ['c13_rohX', 'Behold! The more Bergamo the Crusher is hit, the bigger and stronger he gets! His power is limitless!', 'happy'],
      ['c13_gohanX', 'Dad, be careful! He\'s turning your own power against you!', 'shock'],
    ] : [
      ['bergamo', 'Look at me, gods of every universe! This is the power that will end this tournament!', 'shout'],
      ['goku', 'Heh. You\'re huge now... but the bigger you get, the more blind spots you\'ve got!', 'smirk'],
    ]);
    await s.narrate(stage === 1 ? 'Bergamo grows! He hits harder with every step up.' : 'Bergamo is a giant! He hits very hard, but he is slow to turn and hard to miss.');
  }
  if (live && !e.ended) e.puppet = false;
}

// ================================================================ the Expo

registerScripts({
  /**
   * The Zeno Expo, from Goku's recruiting through Toppo's challenge, then the team planning at Capsule Corp.
   * Replayable from Beerus at Capsule Corp if it was ever left before the end: finished bouts are skipped.
   */
  c13_expo: async (s) => {
    if (s.flag('c13_expoSeen')) { await s.call('c13_planning'); return; }
    // A bout left in Buu's costume (an interrupted Expo) gives Goku his own body back first.
    if (s.state.get(BUU_STASH) !== undefined) leaveBuu(s);
    clearBlind(s);
    if (s.hero !== 'goku') await s.fadeOut(12);
    force(s, 'goku');
    if (!s.check('quest:c13_expo') && !s.check('done:c13_expo')) await s.quest('c13_expo');
    if (!s.flag(MET)) await s.call('c13_expo_palace');
    await warpTo(s, EXPO, GOKU_SEAT[0], GOKU_SEAT[1], 'down');
    s.letterbox(true);
    s.music('godly');
    seatAll(s);
    if (!s.flag(OPENED)) await s.call('c13_expo_open');
    if (!s.flag(DONE.buu)) await s.call('c13_expo_buu');
    if (!s.flag(DONE.gohan)) await s.call('c13_expo_gohan');
    if (!s.flag(DONE.bergamo)) await s.call('c13_expo_bergamo');
    if (!s.flag(DONE.toppo)) await s.call('c13_expo_toppo');
    clearExpo(s);
    s.letterbox(false);
    for (const f of [...Object.values(DONE), ...Object.values(BEAT), MET, OPENED, BUU_TIP]) s.clear(f);
    s.set('c13_expoSeen');
    await s.done('c13_expo', false);
    unforce(s);
    await s.call('c13_planning');
  },

  /** Ep 78: an hour to find two partners, then Zeno's palace, where Universe 9 is waiting. */
  c13_expo_palace: async (s) => {
    await s.narrate('The Grand Priest himself comes for Goku. Zeno wants an exhibition before the tournament: three fighters from Universe 7 against three from Universe 9.');
    await s.narrate('"You have one hour to find two partners," he says. He has just told the gods of all twelve universes the tournament\'s one rule nobody likes: every universe that loses will be erased.');
    await s.narrate('Vegeta won\'t leave Bulma\'s side. Gohan says yes when Pan flies into his arms; he and Goku keep the erasure secret. Buu comes along too, as long as Mr. Satan does.');
    await warpTo(s, 'zeno_palace', 20, 24, 'up');
    s.letterbox(true);
    // Zeno is not at his throne yet: he arrives at the Expo itself.
    if (s.exists('act5_zeno')) s.show('act5_zeno', false);
    const [hx, hy] = heroTile(s);
    stage(s, 'c13_pGohan', 'gohan', hx - 1, hy + 1, 'up', 'Gohan');
    stage(s, 'c13_pBuu', 'majinBuu', hx + 1, hy + 1, 'up', 'Buu');
    stage(s, 'c13_pSatan', 'mrSatan', hx + 2, hy + 2, 'up', 'Mr. Satan');
    stage(s, 'c13_pBeerus', 'beerus', hx - 1, hy - 1, 'up', 'Beerus');
    stage(s, 'c13_pWhis', 'whis', hx - 2, hy, 'up', 'Whis');
    stage(s, 'c13_pShin', 'supremeKai', hx + 1, hy - 1, 'up', 'Supreme Kai');
    stage(s, 'c13_pOldKai', 'oldKai', hx + 2, hy, 'up', 'Old Kai');
    await s.talk([
      ['mrSatan', 'S-so this is where the King of Everything lives... It\'s, uh, very... white.', 'shock'],
      ['beerus', 'Mr. Satan. If you want to keep existing, say nothing and touch nothing.', 'angry'],
    ]);
    s.follow();
    // Up the long carpet two abreast, under the arch, then into the throne room: Universe 7 takes the west side of
    // the carpet (the arch and the pillar ranks at x 13 and 26 stay clear).
    const u7: Array<[string, number, number, number, number]> = [
      ['c13_pBeerus', 19, 14, 18, 6], ['c13_pWhis', 20, 14, 17, 7], ['hero', 19, 15, 19, 8], ['c13_pGohan', 20, 15, 18, 9],
      ['c13_pShin', 19, 16, 17, 8], ['c13_pOldKai', 20, 16, 16, 7], ['c13_pBuu', 19, 17, 17, 10], ['c13_pSatan', 20, 17, 16, 9],
    ];
    await s.walkAll(u7.map(([id, cx, cy]) => [id, cx, cy, 1.2] as [string, number, number, number]));
    await s.walkAll(u7.map(([id, , , x, y]) => [id, x, y, 1.2] as [string, number, number, number]));
    for (const [id] of u7) s.face(id, 'right');
    // Universe 9 walks in from the east wing and lines up across the carpet, Bergamo face to face with Goku.
    const u9: Array<[string, string, number, number, string]> = [
      ['c13_pRoh', 'c13_roh', 23, 8, 'Roh'], ['c13_pSidra', 'c13_sidra', 24, 9, 'Sidra'],
      ['c13_pBasil', 'basil', 22, 9, 'Basil'], ['c13_pLavender', 'lavender', 22, 7, 'Lavender'], ['c13_pBergamo', 'bergamo', 21, 8, 'Bergamo'],
    ];
    for (const [id, sprite, x, y, name] of u9) stage(s, id, sprite, x + 8, y, 'left', name);
    await s.walkAll(u9.map(([id, , x, y]) => [id, x, y, 1.4] as [string, number, number, number]));
    for (const [id] of u9) s.face(id, 'left');
    await s.talk([
      ['c13_roh', 'So this is Universe 7\'s team. A monkey, a schoolboy and a pink balloon! Gaze upon Universe 9\'s finest: the Trio de Dangers!', 'smirk'],
      ['oldKai', '"Trio de Dangers"? Who names a team that?', 'neutral'],
      ['supremeKai', 'Elder Kai! You\'re not even supposed to be here!', 'shock'],
      ['bergamo', 'Son Goku. So you are the man who whispers in Lord Zeno\'s ear. We will talk in the ring.', 'smirk'],
      ['c13_sidra', '(Win this, all of you. If Zeno finds us boring, he might erase us right here...)', 'shock'],
      ['goku', 'You three look strong! This is gonna be fun!', 'happy'],
      ['grandPriest', 'Everyone is here. Then come with me, to the World of Void. The gods of every universe are already waiting.', 'happy'],
    ]);
    s.flash('#ffffff', 16);
    removeAll(s, 'c13_pGohan', 'c13_pBuu', 'c13_pSatan', 'c13_pBeerus', 'c13_pWhis', 'c13_pShin', 'c13_pOldKai', ...u9.map(([id]) => id));
    if (s.exists('act5_zeno')) s.show('act5_zeno', true);
    s.letterbox(false);
    s.set(MET);
  },

  /** Ep 78: the gods gather, Zeno and Future Zeno arrive, and the Grand Priest sets the Expo's rules. */
  c13_expo_open: async (s) => {
    await s.pan(16, 4, 40);
    await s.talk([
      ['grandPriest', 'Gods of every universe, welcome to the Zeno Expo! Universe 7 and Universe 9 will show Lord Zeno and Future Lord Zeno what a tournament is.', 'happy'],
      ['c13_zeno', 'Fight, fight! It\'ll be fun!', 'happy'],
      ['c13_zenoF', 'What\'s a tournament?', 'neutral'],
      ['goku', 'Hiya, Zen-chan! Thanks for letting us go first!', 'happy'],
      ['champa', 'Z-Zen... CHAN?!', 'shock'],
      ['beerus', '(Goku... what have you DONE?) Get back in your seat, you idiot!', 'angry'],
      ['grandPriest', 'One fighter against one, three matches in order. No time limit.', 'neutral'],
      ['grandPriest', 'Other than that... anything goes.', 'happy'],
      ['grandPriest', 'And do give it everything. Should Lord Zeno find the fighters boring, he may take... drastic measures.', 'happy'],
      ['c13_sidra', 'D-drastic? You mean he would erase us on the spot?!', 'shock'],
      ['grandPriest', 'It is a possibility. All is as Lord Zeno wills it.', 'happy'],
    ]);
    s.set(OPENED);
  },

  // ================================================================ round one: Buu vs. Basil
  c13_expo_buu: async (s) => {
    s.letterbox(true);
    await s.pan(16, 4, 30);
    await s.talk([
      ['grandPriest', 'The first match! Majin Buu of Universe 7, against Basil of Universe 9!', 'happy'],
      ['c13_basilX', 'Finally! Big brother, can I play with them?', 'smirk'],
      ['c13_bergamoX', 'Toy with them as much as you like, Basil.', 'smirk'],
      ['goku', 'Okay, Buu, you\'re up! ...Buu?', 'happy'],
    ]);
    await s.emote('c13_buuX', 'Zzz');
    await s.talk([
      ['beerus', 'He fell ASLEEP?! Mr. Satan, do your job. NOW.', 'angry'],
      ['mrSatan', 'R-right! Buu! If you go play with the doggy, I\'ll give you a whole box of chocolate!', 'happy'],
      ['majinBuu', 'Chocolate?! Buu go play with doggy!', 'happy'],
    ]);
    await intoRing(s, () => becomeBuu(s), { id: 'c13_gokuX', sprite: 'goku', name: 'Goku' }, 'c13_buuX');
    await hop(s, 'c13_basilX', RING.foe[0], RING.foe[1], 3.2);
    s.face('c13_basilX', 'hero');
    await s.talk([
      ['basil', 'A pink balloon with legs. I\'ll pop you with one kick, fatso!', 'smirk'],
      ['majinBuu', 'Hehe. Doggy funny.', 'happy'],
    ]);
    if (!s.flag(BUU_TIP)) {
      s.set(BUU_TIP);
      await s.narrate('You are fighting as Majin Buu! He has a Ki Blast and his own Kamehameha, and his rubber body snaps back once from a beating that would floor anyone else.');
    }
    s.letterbox(false);
    s.music('battle');
    removeAll(s, 'c13_basilX');
    const r = await bout(s, 'c13_basil', BASIL_UID, 'goku', {}, () => {
      // Every bout starts with a calm Buu; Mr. Satan's crossfire makes him furious again.
      buuRage(s, false);
      return rubberBody(s);
    });
    s.letterbox(true);
    const e = s.field.enemies.find((x) => x.uid === BASIL_UID);
    const doped = !!e && e.def.id === 'c13_basilDoped';
    if (e && r !== 'win') {
      // Canon's finish: Basil's Wolfgang Pressure swallows Buu, and Buu answers from the smoke with a full Kamehameha.
      await s.say('basil', 'Time to finish this! Wolfgang... PRESSURE!!', 'shout');
      await s.blast(BASIL_UID, 'hero', '#f8a040');
      const [hx, hy] = heroTile(s);
      s.boom(hx, hy, 24, '#f8a040');
      s.shake(24, 2);
      await s.wait(24);
      await s.say('c13_roh', 'Hahaha! Not even a speck of pink left!', 'happy');
      await s.say('majinBuu', 'Hehe. Buu still here. Now Buu\'s turn! Kaaa... meee... haaa... meee...', 'smirk');
      await s.powerUp('hero', '#70c8f8', 30);
      await s.say('majinBuu', 'HAAAAA!!', 'shout');
      await s.blast('hero', BASIL_UID, '#70c8f8');
      s.boom(Math.round(e.x / 16), Math.round((e.y - 14) / 16), 26, '#70c8f8');
      s.flash('#ffffff', 10);
      s.shake(30, 3);
      await s.wait(20);
      if (doped) {
        await s.say('basil', 'Heh... heh... still... standing...', 'hurt');
        s.sprite(BASIL_UID, 'basil');
        s.flash('#f8a040', 8);
        await s.narrate('The Danger Doping wears off. Basil\'s legs give out under him.');
      }
      s.pose(BASIL_UID, 'ko');
    }
    await s.talk([
      ['grandPriest', 'Basil cannot continue. The winner is Majin Buu of Universe 7!', 'happy'],
      ['c13_zeno', 'That was fun! The pink one is funny!', 'happy'],
      ['majinBuu', 'Buu win! Mr. Satan! Chocolate!', 'happy'],
    ]);
    await s.fadeOut(14);
    removeAll(s, BASIL_UID);
    const [gx, gy] = s.exists('c13_gokuX') ? tileOf(s, 'c13_gokuX') : [GOKU_SEAT[0], GOKU_SEAT[1]];
    removeAll(s, 'c13_gokuX');
    leaveBuu(s);
    s.place('hero', gx, gy, 'down');
    seatAll(s);
    s.music('godly');
    await s.fadeIn(14);
    await s.pan(10, 4, 20);
    // Back in the stands, Buu heals Mr. Satan with his magic (ep 79).
    if (s.exists('c13_buuX') && s.exists('c13_satanX') && s.actor('c13_satanX').scriptPose === 'ko') {
      const [sx, sy] = tileOf(s, 'c13_satanX');
      await s.walk('c13_buuX', sx + 1, sy, 1.4);
      s.face('c13_buuX', 'c13_satanX');
      await s.say('c13_buuX', 'Mr. Satan! Buu make you all better!', 'happy');
      await s.blast('c13_buuX', 'c13_satanX', '#f8a0c0');
      s.sfx('heal');
      s.pose('c13_satanX', null);
      await s.talk([
        ['c13_satanX', 'Ugh... my head... Hm? I feel great! Did we win? Of course we won! That was all my training!', 'happy'],
        ['c13_buuX', 'Chocolate now?', 'happy'],
      ]);
      await s.walk('c13_buuX', SEATS.c13_buuX[1], SEATS.c13_buuX[2], 1.4);
      s.face('c13_buuX', 'down');
    }
    // The Grand Priest makes the cracked ring whole with a snap of his fingers.
    await s.pan(16, 4, 16);
    s.flash('#ffffff', 10);
    s.sfx('teleport');
    await s.say('grandPriest', 'There. The ring is as good as new. Shall we continue?', 'happy');
    await s.say('beerus', 'One down. Don\'t you dare embarrass me now.', 'neutral');
    for (const f of [BEAT.satan, BEAT.more]) s.clear(f);
    s.set(DONE.buu);
  },

  /**
   * Phase two: Basil powers up his legs; his blast goes through Buu's belly, Buu bats the next ones into the stands:
   * one floors Mr. Satan, the hooded Toppo swats another away. Buu gets furious.
   */
  c13_basil_legs: async (s) => {
    const e = foe(s, BASIL_UID);
    if (!e || e.ended) return;
    e.puppet = true;
    await s.say('basil', 'Fine! No more holding back! Shining... BLASTER!!', 'angry');
    await s.powerUp(BASIL_UID, '#f8a040', 30);
    if (!s.flag(BEAT.satan)) {
      s.set(BEAT.satan);
      await s.blast(BASIL_UID, 'hero', '#f8a040');
      s.pose('hero', 'hurt');
      s.flash('#ffffff', 8);
      await s.narrate('Basil\'s blast punches a hole clean through Buu\'s belly. Buu just laughs, and bats the next ones away... straight into the stands!');
      if (s.exists('c13_satanX')) {
        await s.pan(9, 4, 20);
        s.boom(9, 3, 18, '#f8a040');
        s.pose('c13_satanX', 'ko');
        await s.wait(16);
        await s.say('c13_satanX', 'Gah...! I-I\'m fine, Buu... Win the match... for the... chocolate...', 'hurt');
        // The hooded figure in Universe 11's box puts the next one out with one hand (ep 79), and has words for Buu.
        await s.pan(24, 4, 16);
        s.boom(24, 3, 12, '#f8a040');
        await s.wait(10);
        await s.talk([
          ['???', 'Majin Buu. Mind where you send those. You stand before the gods of every universe.', 'angry'],
          ['c13_champaX', 'Ooh. He put that out with one hand, without even blinking. Who IS that?', 'shock'],
        ]);
        s.follow();
      }
      s.pose('hero', null);
      await s.say('majinBuu', 'Hole all gone! ...Mr. Satan? Mr. Satan sleep?', 'shock');
      await s.say('majinBuu', 'Doggy hurt Mr. Satan. BUU... MAD!!!', 'angry');
    } else {
      await s.say('majinBuu', 'Buu still mad at doggy!', 'angry');
    }
    await s.powerUp('hero', '#f870a0', 30);
    buuRage(s, true);
    s.banner('Buu is furious! STR and POW up!');
    if (!e.ended) e.puppet = false;
  },

  /**
   * Phase three (ep 79): Buu's fury knocks Basil clean out of the ring and Goku calls it a ring-out win, but Universe
   * 7's rules don't count here: a match goes on until Lord Zeno is satisfied or a fighter cannot continue. Basil
   * crawls back in and asks Roh for "that"; Roh's "tonic" (anything goes) swaps in Danger Doping.
   */
  c13_basil_dope: async (s) => {
    const e = foe(s, BASIL_UID);
    if (!e || e.ended) return;
    e.puppet = true;
    const [bx, by] = inRing(...tileOf(s, BASIL_UID));
    if (!s.flag(BEAT.more)) {
      s.set(BEAT.more);
      // Thrown over the nearer side rope, onto the floor of the void.
      const ox = bx < RING.mid[0] ? RING_IN.x0 - 3 : RING_IN.x1 + 3;
      s.sfx('hit');
      s.shake(16, 2);
      s.pose(BASIL_UID, 'hurt');
      await Promise.all([s.walk(BASIL_UID, ox, by, 5), s.lift(BASIL_UID, 16, 12).then(() => s.lift(BASIL_UID, 0, 10))]);
      s.pose(BASIL_UID, 'ko');
      s.boom(ox, by, 14, '#f8e0a0');
      await s.wait(24);
      await s.talk([
        ['c13_gokuX', 'He\'s out of the ring! That\'s a ring-out! Buu wins!', 'happy'],
        ['c13_zeno', 'Ring-out? What\'s that?', 'neutral'],
        ['c13_gokuX', 'On Earth, if you fall out of the ring, you lose!', 'happy'],
        ['grandPriest', 'Universe 7\'s rules do not apply here. A match goes on until Lord Zeno is satisfied... or until a fighter cannot continue.', 'neutral'],
        ['c13_zeno', 'Not done yet! We want to see more!', 'happy'],
        ['c13_zenoF', 'More! More!', 'happy'],
        ['c13_beerusX', '(Tch. Then knock him out for good, Buu.)', 'angry'],
      ]);
      // He crawls back up into the ring.
      s.pose(BASIL_UID, null);
      await s.walk(BASIL_UID, bx, by, 1);
      s.face(BASIL_UID, 'hero');
    }
    if (s.exists('c13_rohX')) {
      await s.say('basil', 'Lord Roh! Give me... THAT!', 'shout');
      await s.pan(27, 5, 16);
      await s.say('c13_rohX', 'Hehe, of course! Catch, Basil! Purely medicinal, I assure everyone!', 'smirk');
      s.follow();
      await s.blast('c13_rohX', BASIL_UID, '#60f0c0');
    }
    await s.say('basil', '*CRUNCH* ...Hehe. HAHAHA! Here it comes!', 'smirk');
    await s.powerUp(BASIL_UID, '#f04040', 36);
    s.sprite(BASIL_UID, 'c13_basilDoped');
    const doped = ENEMIES.c13_basilDoped;
    if (doped) e.def = doped;
    s.shake(20, 2);
    await s.talk([
      ['c13_beerusX', 'Hey! He fed him something! That\'s cheating!', 'angry'],
      ['grandPriest', 'As I said, Lord Beerus: anything goes.', 'happy'],
      ['basil', 'Danger Doping! Now I\'ll kick you into pink confetti!', 'shout'],
      ['majinBuu', 'Doggy got big...', 'neutral'],
    ]);
    if (!e.ended) e.puppet = false;
  },

  // ================================================================ round two: Gohan vs. Lavender
  c13_expo_gohan: async (s) => {
    s.letterbox(true);
    await s.pan(16, 4, 30);
    await s.talk([
      ['grandPriest', 'The second match! Son Gohan of Universe 7, against Lavender of Universe 9!', 'happy'],
      ['c13_lavenderX', 'Big brother... this one I can kill, right?', 'smirk'],
      ['c13_bergamoX', 'Kill to your heart\'s content.', 'smirk'],
      ['c13_gohanX', 'Dad, let me go next. I want to see how far I\'ve fallen.', 'neutral'],
      ['goku', 'Don\'t wait to see what he does, Gohan. Go all out from the start. You\'re strong!', 'happy'],
      ['c13_gohanX', 'Right. Thanks, Dad.', 'happy'],
    ]);
    await intoRing(s, () => { force(s, 'gohan'); refresh(s, 'gohan'); }, { id: 'c13_gokuX', sprite: 'goku', name: 'Goku' }, 'c13_gohanX');
    await hop(s, 'c13_lavenderX', RING.foe[0], RING.foe[1], 3);
    s.face('c13_lavenderX', 'hero');
    await s.talk([
      ['gohan', 'I haven\'t been in a tournament in a long time. I can\'t sense his ki at all... I\'ll have to watch him with my eyes.', 'neutral'],
      ['lavender', 'Hehehe. Watch closely, then. While you still can.', 'smirk'],
    ]);
    s.letterbox(false);
    s.music('battle');
    removeAll(s, 'c13_lavenderX');
    const r = await bout(s, 'c13_lavender', LAVENDER_UID, 'gohan', {}, () => {
      // Every bout starts with clear eyes; the mist (phase two) blinds him again.
      clearBlind(s);
      return toxin(s);
    });
    s.letterbox(true);
    clearBlind(s);
    const e = s.field.enemies.find((x) => x.uid === LAVENDER_UID);
    if (e && r !== 'win') {
      // Canon's ending: Gohan's Kamehameha against the poison blast, then he dives through the mist, grabs Lavender
      // from behind and drives them both head first into the ring.
      const [lx, ly] = inRing(...tileOf(s, LAVENDER_UID));
      s.place(LAVENDER_UID, lx, ly);
      e.z = 0;
      s.face('hero', LAVENDER_UID);
      await s.say('lavender', 'Enough games! Let the poison take you! HAAA!', 'shout');
      await s.beamStruggle('gohan', 'lavender', '#70c8f8', '#a050e0', [
        'Kaaa... meee... haaa... meee... HAAA!',
        'You can\'t even see where it\'s coming from!',
        'I don\'t need to see it!',
      ], 0.2);
      s.flash('#a050e0', 12);
      await s.say('gohan', 'Blind or not... this close, I can\'t miss!', 'shout');
      // From behind him (south), or from the north when he stands on the ring's south edge.
      const gy = ly < RING_IN.y1 ? ly + 1 : ly - 1;
      await s.walk('hero', lx, gy, 3);
      s.pose('hero', 'guard');
      s.pose(LAVENDER_UID, 'hurt');
      await s.say('lavender', 'L-let go of me! You\'ll go down too!', 'shock');
      await Promise.all([s.lift('hero', 30, 16), s.lift(LAVENDER_UID, 30, 16)]);
      await Promise.all([s.lift('hero', 0, 5), s.lift(LAVENDER_UID, 0, 5)]);
      s.boom(lx, gy, 30, '#f8f0d0');
      s.flash('#ffffff', 16);
      s.shake(36, 3);
      s.pose(LAVENDER_UID, 'ko');
      s.pose('hero', 'ko');
      await s.wait(40);
      s.pose('hero', null);
      await s.say('gohan', 'I... won...', 'hurt');
      s.pose('hero', 'ko');
      await s.wait(20);
    }
    await s.talk([
      ['grandPriest', 'Neither fighter can continue. This match is a draw!', 'neutral'],
      ['c13_zeno', 'A draw! Both fell down! That was exciting!', 'happy'],
    ]);
    // Goku jumps into the ring with one of Shin's Senzu Beans.
    const [kx, ky] = inRing(...heroTile(s));
    await hop(s, 'c13_gokuX', kx < RING_IN.x1 ? kx + 1 : kx - 1, ky, 3);
    s.face('c13_gokuX', 'hero');
    await s.say('c13_gokuX', 'Here, Gohan. One of the Supreme Kai\'s Senzu Beans. Eat up.', 'happy');
    s.pose('hero', null);
    refresh(s, 'gohan');
    await s.talk([
      ['gohan', 'Thanks, Dad... I\'m still way too weak.', 'sad'],
      ['c13_gokuX', 'Are you kidding? You fought blind! That got ME all fired up!', 'happy'],
    ]);
    // Shin tops Goku's pouch up from his bag (a hero carries three at most).
    const room = Math.min(SHIN_SENZU, (ITEMS.senzu?.max ?? 3) - s.count('senzu'));
    if (room > 0) {
      await s.say('supremeKai', 'Goku. Take what\'s left of the bag. Bergamo is the strongest of the three, I can tell.', 'neutral');
      await s.give('senzu', room);
    }
    await s.fadeOut(14);
    removeAll(s, LAVENDER_UID, 'c13_gokuX');
    force(s, 'goku');
    s.place('hero', GOKU_SEAT[0], GOKU_SEAT[1], 'down');
    seatAll(s);
    s.music('tense');
    await s.fadeIn(14);
    await s.call('c13_expo_stakes');
    s.set(DONE.gohan);
  },

  /** Phase two: the toxic mist. Gohan is blinded; the toxin starts working. */
  c13_lavender_mist: async (s) => {
    const e = foe(s, LAVENDER_UID);
    if (!e || e.ended) return;
    e.puppet = true;
    const [hx, hy] = heroTile(s);
    await s.walk(LAVENDER_UID, hx, hy - 1, 3);
    s.pose(LAVENDER_UID, 'guard');
    await s.say('lavender', 'Got your arm! Now take a deep breath...', 'smirk');
    s.flash('#a050e0', 14);
    s.field.fx.explode(e.x, e.y - 20, 18, '#a050e0');
    s.pose(LAVENDER_UID, null);
    s.set(BLIND);
    s.field.tintOverride = BLIND_TINT;
    if (!s.flag(BEAT.mist)) {
      s.set(BEAT.mist);
      await s.talk([
        ['gohan', 'Gah... my eyes! I can\'t see!', 'hurt'],
        ['c13_whisX', 'A powerful toxin. It will spread through his whole body.', 'neutral'],
        ['c13_rohX', 'Give up, boy! Lavender\'s poison will kill you long before he gets bored!', 'smirk'],
        ['c13_skX', 'Gohan! If they can use drugs, we can use Senzu Beans! I brought a whole bag!', 'shock'],
        ['gohan', 'No! I want to do this with my own power.', 'angry'],
        ['c13_gokuX', 'That\'s it, Gohan. Don\'t fight with your eyes. Feel him.', 'neutral'],
      ]);
      await s.narrate('Gohan is blind! Stand still to hear Lavender\'s steps. Super Saiyan senses his ki like a radar, but it spreads the poison faster.');
    } else {
      await s.say('gohan', 'The mist again... Stay calm. Listen.', 'hurt');
    }
    if (!e.ended) e.puppet = false;
  },

  /** Phase three: Lavender flies. No more footsteps to hear; ki blasts from the air. */
  c13_lavender_fly: async (s) => {
    const e = foe(s, LAVENDER_UID);
    if (!e || e.ended) return;
    s.set(AIRBORNE);
    await s.talk([
      ['gohan', 'His footsteps... they stopped. He\'s in the air!', 'shock'],
      ['lavender', 'Hehehe! Try hearing THIS!', 'shout'],
    ]);
  },

  /** Gohan goes Super Saiyan blind (ep 80): he reads Lavender's ki like a radar, and Whis sees the catch. */
  c13_lavender_radar: async (s) => {
    const e = foe(s, LAVENDER_UID);
    if (!e || e.ended) return;
    e.puppet = true;
    await s.talk([
      ['gohan', 'I can\'t see you... but I can sense your ki now. There!', 'angry'],
      ['c13_whisX', 'Oh my. A Super Saiyan reads his opponent\'s ki like a radar. But all that power pumps the poison through him faster.', 'neutral'],
      ['c13_gokuX', 'Then finish it quick, Gohan!', 'shout'],
    ]);
    if (!e.ended) e.puppet = false;
  },

  /** Ep 80, after the draw: Zeno's ranking of the universes, and the stakes of the tournament, told to every god. */
  c13_expo_stakes: async (s) => {
    await s.pan(16, 4, 20);
    await s.talk([
      ['grandPriest', 'A word for every god here. Lord Zeno has ranked your universes by the level of their mortals.', 'neutral'],
      ['grandPriest', 'Universe 7 scores 3.18: second from the bottom. Universe 9 is last, at 1.86.', 'happy'],
      ['c13_rohX', 'L-last?!', 'shock'],
      ['grandPriest', 'Universes 1, 5, 8 and 12 score above seven and are excused. The other eight will fight in the Tournament of Power.', 'neutral'],
      ['grandPriest', 'And every universe that loses will be erased. Along with its gods.', 'happy'],
      ['c13_oldKaiX', 'Its gods too?! What about the angels?', 'shock'],
      ['grandPriest', 'The angels will be quite all right.', 'happy'],
      ['c13_beerusX', 'WHIS!', 'angry'],
      ['c13_whisX', 'Ohoho. Angels are not so easy to erase, my lord.', 'smirk'],
      ['c13_satanX', 'E-erased? The whole universe? The Earth... my mansion... my statue...', 'shock'],
    ]);
    if (s.exists('c13_satanX')) s.pose('c13_satanX', 'ko');
    await s.talk([
      ['c13_buuX', 'Mr. Satan sleep again?', 'neutral'],
      ['c13_gohanX', 'So much for keeping it secret...', 'sad'],
    ]);
  },

  // ================================================================ round three: Goku vs. Bergamo
  c13_expo_bergamo: async (s) => {
    s.letterbox(true);
    await s.pan(16, 4, 30);
    await s.say('grandPriest', 'The final match! Son Goku of Universe 7, against Bergamo of Universe 9!', 'happy');
    await hop(s, 'c13_bergamoX', RING.foe[0], RING.foe[1], 2.6);
    s.face('c13_bergamoX', 'down');
    await s.pan(16, 9, 30);
    await s.talk([
      ['c13_bergamoX', 'Gods of every universe, hear me! I am Bergamo of Universe 9!', 'shout'],
      ['c13_bergamoX', 'Lord Zeno ranked us lowest of all. But look at that man. Son Goku is the one who asked for this tournament!', 'shout'],
      ['c13_bergamoX', 'Without him, every universe could have lived in peace. He put us all at risk for his own amusement. He is the enemy of every universe!', 'angry'],
      ['c13_champaX', 'Yeah! Boo! BOOO!', 'angry'],
      ['c13_whisX', 'Oh my. He is making Goku the villain in front of every god at once.', 'neutral'],
      ['c13_bergamoX', 'Lord Zeno. When I defeat him, I humbly ask you to cancel the erasure of the losing universes.', 'neutral'],
      ['c13_zeno', 'Okay! If Universe 9 wins, no erasing!', 'happy'],
      ['grandPriest', 'Then, Son Goku, you will fight with everything you have. A match thrown on purpose would not amuse Lord Zeno.', 'happy'],
      ['c13_beerusX', '(Lose, and he saves every universe. Win, and he is the villain of all twelve. Wonderful.)', 'angry'],
      ['goku', 'Villain, huh? I don\'t mind. But I\'m not losing on purpose. That\'d be rude to you!', 'smirk'],
    ]);
    s.follow();
    await hop(s, 'hero', RING.hero[0], RING.hero[1]);
    s.face('hero', 'up');
    await s.talk([
      ['bergamo', 'Come, then. Hit me. As hard as you like. I\'ll show you why they call me Bergamo the Crusher.', 'smirk'],
    ]);
    s.letterbox(false);
    s.music('boss');
    removeAll(s, 'c13_bergamoX');
    const r = await bout(s, 'c13_bergamo', BERGAMO_UID, 'goku');
    s.letterbox(true);
    const e = s.field.enemies.find((x) => x.uid === BERGAMO_UID);
    if (e && r !== 'win') {
      // He stands at full size for the finish (a fight ended in a rush can skip a growth beat).
      if (growthOf(e) < 2) applyGrowth(s.field, e, 2);
      await s.talk([
        ['goku', 'You can still get stronger? Then so can I! Super Saiyan Blue... Kaio-ken!', 'shout'],
      ]);
      s.transformNow('ssbkk');
      await s.powerUp('hero', '#f83838', 40);
      await s.say('bergamo', 'Then take it all back! Wolfgang... PENETRATOR!', 'shout');
      await s.beamStruggle('goku', 'bergamo', '#70c8f8', '#b070d0', [
        'Kaaa... meee... haaa... meee...!',
        'Every blow I take makes me stronger!',
        'Then I\'ll hit you with everything at once! HAAAA!',
      ], 0.2);
      await s.blast('hero', BERGAMO_UID, '#70c8f8');
      s.boom(Math.round(e.x / 16), Math.round((e.y - 14) / 16), 34, '#70c8f8');
      s.flash('#ffffff', 18);
      s.shake(40, 3);
      s.transformNow(null);
    }
    // Knocked out, he shrinks back to his own size.
    await s.fadeOut(10);
    const [bx, by] = e ? tileOf(s, BERGAMO_UID) : [RING.foe[0], RING.foe[1]];
    removeAll(s, BERGAMO_UID);
    stage(s, 'c13_bergamoX', 'bergamo', bx, by, 'down', 'Bergamo');
    s.pose('c13_bergamoX', 'ko');
    await s.fadeIn(10);
    await s.talk([
      ['grandPriest', 'Bergamo cannot continue! The winner, and the winner of the Zeno Expo: Universe 7!', 'happy'],
      ['c13_zeno', 'That was so fun! The big one got bigger and bigger!', 'happy'],
      ['c13_zenoF', 'Tournaments are fun!', 'happy'],
    ]);
    await Promise.all([
      hop(s, 'c13_basilX', bx - 1, by, 3),
      hop(s, 'c13_lavenderX', bx + 1, by, 3),
    ]);
    s.pose('c13_bergamoX', null);
    await s.talk([
      ['c13_bergamoX', 'You won the match, Son Goku. But you have made an enemy of every universe. They will all come for you.', 'angry'],
      ['goku', 'Good! Tell them to send their strongest. I\'ll take on every single one!', 'happy'],
      ['c13_beerusX', '...Why does he always say the WORST possible thing?', 'angry'],
    ]);
    await Promise.all([
      hop(s, 'c13_bergamoX', SEATS.c13_bergamoX[1], SEATS.c13_bergamoX[2], 3),
      hop(s, 'c13_basilX', SEATS.c13_basilX[1], SEATS.c13_basilX[2], 3),
      hop(s, 'c13_lavenderX', SEATS.c13_lavenderX[1], SEATS.c13_lavenderX[2], 3),
    ]);
    for (const id of ['c13_bergamoX', 'c13_basilX', 'c13_lavenderX']) if (s.exists(id)) s.face(id, 'down');
    s.set(DONE.bergamo);
  },

  /** Phase two: Bergamo has absorbed enough blows to grow. */
  c13_bergamo_grow: async (s) => { await grow(s, 1); },
  /** Phase three: Bergamo, giant. */
  c13_bergamo_giant: async (s) => { await grow(s, 2); },

  // ================================================================ Toppo cuts in (eps 81-82)
  c13_expo_toppo: async (s) => {
    s.letterbox(true);
    s.music('tense');
    // Goku back on his mark (a resumed Expo starts him in his seat on the balcony).
    if (heroTile(s)[1] < RING_IN.y0) await hop(s, 'hero', RING.hero[0], RING.hero[1]);
    else await s.walk('hero', RING.hero[0], RING.hero[1], 1.5);
    s.face('hero', 'up');
    await s.pan(24, 4, 20);
    if (s.exists('c13_toppoX')) {
      // Uninvited: he jumps down from Universe 11's box and throws off his hood.
      await s.emote('c13_toppoX', '!');
      s.follow();
      await hop(s, 'c13_toppoX', RING.foe[0], RING.foe[1], 3.4);
      s.shake(16, 2);
      s.silhouette('c13_toppoX', false);
    }
    const t = s.field.npcs.find((n) => n.def.id === 'c13_toppoX');
    if (t) t.def.name = 'Toppo';
    await s.pan(16, 13, 24);
    await s.talk([
      ['toppo', 'Halt! I am Toppo, leader of the Pride Troopers, the warriors of justice of Universe 11!', 'angry'],
      ['toppo', 'Son Goku. You put every universe in danger for your own amusement. That is evil, and justice cannot let it stand. I will judge you myself!', 'shout'],
      ['goku', 'Ooh, you\'re strong! Bergamo didn\'t really satisfy me anyway. Let\'s go!', 'happy'],
      ['grandPriest', 'Lord Zeno?', 'neutral'],
      ['c13_zeno', 'Okay! Fight!', 'happy'],
    ]);
    // Goku opens in Super Saiyan. Toppo is fast for his size: Justice Tornado, then the Justice Crusher hold, until
    // Goku breaks it in Blue and answers with a Kamehameha from point-blank range (ep 82).
    s.transformNow('ssj');
    await s.powerUp('hero', '#f8e048', 24);
    const [tx, ty] = tileOf(s, 'c13_toppoX');
    const [hx, hy] = heroTile(s);
    await s.say('toppo', 'Justice... TORNADO!', 'shout');
    s.sfx('dash');
    s.aura('c13_toppoX', '#f05040');
    await s.walk('c13_toppoX', hx, hy - 1, 5);
    await s.clash('c13_toppoX', 'hero', 30);
    s.aura('c13_toppoX', null);
    s.sfx('hit');
    s.pose('hero', 'hurt');
    await s.say('goku', 'Whoa! He spins like a top!', 'hurt');
    // Before Goku is back on his feet, Toppo is behind him.
    s.sfx('dash');
    s.place('c13_toppoX', hx, hy + 1, 'up');
    s.pose('c13_toppoX', 'guard');
    s.shake(40, 2);
    await s.talk([
      ['toppo', 'Justice... CRUSHER! Let us see how long your evil lasts in my grip!', 'shout'],
      ['goku', 'Can\'t... breathe...!', 'hurt'],
      ['c13_skX', 'He\'ll crush him! We have to stop this!', 'shock'],
      ['c13_gohanX', 'Wait, Supreme Kai. Watch.', 'neutral'],
    ]);
    s.transformNow('ssb');
    await s.powerUp('hero', '#40c0f8', 40);
    s.pose('hero', null);
    s.pose('c13_toppoX', 'hurt');
    await s.walk('c13_toppoX', tx, ty, 3);
    s.pose('c13_toppoX', null);
    s.face('c13_toppoX', 'hero');
    await s.say('toppo', 'This ki... the ki of a god? From a mortal?!', 'shock');
    // Instant Transmission to his chest, and a Kamehameha that tears his uniform.
    s.sfx('teleport');
    s.show('hero', false);
    await s.wait(12);
    s.place('hero', tx, ty + 1, 'up');
    s.show('hero', true);
    await s.say('goku', 'Kamehameha!', 'shout');
    await s.blast('hero', 'c13_toppoX', '#70c8f8');
    s.boom(tx, ty, 20, '#70c8f8');
    s.pose('c13_toppoX', 'hurt');
    await s.wait(24);
    s.pose('c13_toppoX', null);
    await s.talk([
      ['toppo', 'My uniform... You tore the proud uniform of the Pride Troopers! Now you have made me angry!', 'angry'],
      ['goku', 'Heh. Sorry! Round two, mister!', 'smirk'],
    ]);
    await s.walk('hero', RING.hero[0], RING.hero[1], 3);
    s.face('hero', 'up');
    s.letterbox(false);
    s.music('boss');
    const [fx, fy] = freeNear(s, tx, ty);
    s.remove('c13_toppoX');
    // A short exhibition: it ends at half his strength, or when the Grand Priest calls time. A knock-out ends it too.
    const r = await bossFight(s, 'c13_toppo', { x: fx, y: fy, uid: TOPPO_UID, survive: 45, label: 'MATCH', loseOk: true });
    if (r === 'timeout') s.exp(ENEMIES.c13_toppo?.exp ?? 0);
    // Knocked down, Goku is back on his feet when the Grand Priest steps in (no Game Over in an exhibition).
    if (r === 'lose') refresh(s, 'goku');
    s.letterbox(true);
    s.pose('hero', null);
    if (!s.exists(TOPPO_UID)) stage(s, TOPPO_UID, 'toppo', fx, fy, 'down', 'Toppo');
    s.face('hero', TOPPO_UID);
    // Canon's end: Goku adds Kaio-ken to Blue, both power up for the next exchange, and the Grand Priest steps in.
    await s.say('goku', 'Heh... this is great! Then I\'ll go all out too! Kaio-ken!', 'smirk');
    s.transformNow('ssbkk');
    await s.powerUp('hero', '#f83838', 30);
    s.aura('hero', '#f83838');
    s.aura(TOPPO_UID, '#f05040');
    s.shake(40, 2);
    await s.talk([
      ['goku', 'Kaaa... meee...', 'shout'],
      ['toppo', 'Then I will show you justice at full power!', 'shout'],
      ['goku', 'Haaa... meee...!', 'shout'],
    ]);
    s.flash('#ffffff', 16);
    s.aura('hero', null);
    s.aura(TOPPO_UID, null);
    s.transformNow(null);
    await s.talk([
      ['grandPriest', 'That is enough! Should one of you die here, there would be no Tournament of Power. This match is a draw.', 'neutral'],
      ['c13_zeno', 'Awww... Okay.', 'sad'],
      ['toppo', 'Hmph. Know this, Son Goku: in Universe 11 there is a warrior named Jiren. If you can only fight me to a draw, you stand no chance against him.', 'smirk'],
      ['goku', 'Jiren... Stronger than you? Heh. I can\'t wait. Good match, Toppo!', 'happy'],
    ]);
    await s.emote(TOPPO_UID, '...');
    await s.say('toppo', 'I do not shake hands with evil. We will settle this in the tournament.', 'angry');
    const [sx, sy] = [SEATS.c13_toppoX[1], SEATS.c13_toppoX[2]];
    await hop(s, TOPPO_UID, sx, sy, 3.4);
    removeAll(s, TOPPO_UID);
    stage(s, 'c13_toppoX', 'toppo', sx, sy, 'down', 'Toppo');
    // Ep 82: the rules of the Tournament of Power, told to every god at once.
    await s.pan(16, 4, 30);
    await s.talk([
      ['grandPriest', 'The Zeno Expo is concluded. Now hear the rules of the Tournament of Power.', 'happy'],
      ['grandPriest', 'Each of the eight universes brings ten warriors. All eighty fight in one ring at once, for one hundred tak: about forty-eight of your Earth minutes.', 'neutral'],
      ['grandPriest', 'Fall out of the ring and you are eliminated. No killing. No weapons. And no flying, unless you were born with wings.', 'neutral'],
      ['grandPriest', 'The universe with the most warriors left in the ring, or with the last one standing, wins the Super Dragon Balls. Every universe that loses will be erased.', 'happy'],
      ['grandPriest', 'The tournament begins in about forty Earth hours. I shall build a ring worthy of it.', 'neutral'],
      ['c13_zeno', 'Erase, erase! Hehe!', 'happy'],
      ['c13_beerusX', 'GOKUUU!!', 'shout'],
    ]);
    s.set(DONE.toppo);
  },

  c13_toppo_p2: async (s) => {
    await s.say('toppo', 'Justice... RUSH!', 'shout');
  },
});
