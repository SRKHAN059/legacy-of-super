import type { Expression } from '../../../art/portrait';
import type { Dir } from '../../../engine/math';
import { TILE } from '../../../engine/constants';
import type { Field } from '../../../game/field';
import { Shot } from '../../../game/projectiles';
import { FightAbandoned, registerScripts, type ScriptApi } from '../../../game/script';
import { EP } from './c12_eps_maps';
import { BUSY, heroTile, npcWithSprite, removeAll, stage, warpTo } from './helpers';
import { HUB } from './hubs';

/**
 * Chapter 12 episode: the baseball game (anime ep 70). Champa challenges Beerus to a game of baseball, Universe 6
 * against Universe 7, for the right to Earth's food; Whis and Vados umpire (no ki, no flying, no destruction), and
 * Yamcha, once a pro, is the only player on Universe 7 who knows the rules. The player is Yamcha (a costume over the
 * active hero, who does no fighting here) for the ninth inning, as a LoG2-scale minigame on the existing input:
 *
 * - Top of the ninth, fielding: each Universe 6 fly ball is hit from home plate towards centre field. A chalk ring
 *   shows where it is coming down and the ball's shadow races in; walk (or double-tap to run) under it before it
 *   lands. Every drop scores a run. Magetta, Botamo and Goten make their own outs (the anime's gags), so the half
 *   always ends.
 * - Bottom of the ninth, batting: Champa pitches a fastball, a curve and his "godly" pitch that stops in mid-air;
 *   press A as the ball crosses the plate. In the sweet spot it is a walk-off home run; a little off it is a hit; a
 *   miss is a strike, and three of them end with the umpires ruling Champa's last pitch illegal (ki).
 * - Baserunning: when Yamcha is on base, the next hit sends him home ahead of the throw. Press A at the right moment
 *   to slide under Botamo's tag; otherwise Champa's tag breaks the no-destruction rule and Vados calls him safe.
 *
 * However the player does, the story ends as the anime does: Yamcha scores the winning run. How well it is played
 * (the catches, the swing, the slide) is Yamcha's MVP score, which decides Beerus's bonus.
 */

/** Journal entry of the episode. */
const QUEST = 'c12_ball';
/** Runs each side has on the board when the ninth inning begins. */
export const START_RUNS = 3;
/** How close (px, feet to landing point) a fielder must be when the ball comes down. */
export const CATCH_RADIUS = 14;
/** Pitch progress (0 = release, 1 = in the catcher's mitt) where a swing connects, and the sweet spot inside it. */
export const SWING_WINDOW: [number, number] = [0.76, 1];
export const SWEET_SPOT: [number, number] = [0.85, 0.95];
/** Distance (px) from home plate at which a slide beats the tag. */
export const SLIDE_WINDOW: [number, number] = [18, 44];
/**
 * Best possible MVP score: two catches (two fly balls caught and Magetta's melted ball make the three outs, so the
 * half ends before a third fly ball) and a home run (4). A single is worth 2 and a slide under the tag 1.
 */
export const MVP_MAX = 6;
/** MVP score that earns Beerus's bonus: perfect fielding and a single with a slide, or a catch and a home run. */
export const MVP_BONUS = 5;

/** What the minigame is doing this frame (read by the tests to play it with real input). */
export type BallPlay =
  | { kind: 'fly'; x: number; y: number; t: number; dur: number }
  | { kind: 'pitch'; p: number; type: PitchType }
  | { kind: 'slide'; dist: number };

/** Live state of the game in progress (null between plays). */
export const BALLGAME: { play: BallPlay | null } = { play: null };

type PitchType = 'fast' | 'curve' | 'godly';
type AtBat = 'homer' | 'hit' | 'walk';

/** Pixel position of an actor's feet standing on tile (x, y). */
const px = (tx: number): number => tx * TILE + 8;
const py = (ty: number): number => ty * TILE + 14;

/**
 * Run `step` every field tick until it returns true. A game whose map is replaced underneath it (a reset to the
 * title) unwinds like an abandoned fight, so the costume and the seal are put back.
 */
async function frames(s: ScriptApi, step: (f: Field, t: number) => boolean): Promise<void> {
  const f = s.field;
  let t = 0;
  await f.until(() => f.abandoned || step(f, t++), true);
  if (f.abandoned) throw new FightAbandoned(f.def.id);
}

/** A baseball: a ki-shot sprite that hurts nobody, steered frame by frame (its shadow shows where it is). */
function newBall(f: Field, x: number, y: number): Shot {
  const b = new Shot('player', 'shot', x, y, { x: 0, y: 0 }, 0, 0, '#f4f4ec', 0, 1);
  b.life = 1e9;
  b.ki = false;
  b.lift = 10;
  f.spawnShot(b);
  return b;
}

/** Swap the centre-field scoreboard to the current score. */
function board(s: ScriptApi, u6: number, u7: number, outs: number): void {
  const m = s.field.map;
  m.removeProp('c12_board');
  m.addProp(`c12_board_${Math.min(9, u6)}_${Math.min(9, u7)}_${Math.min(3, outs)}`, 14.5 * TILE, 0, 'c12_board');
}

/** Stage one actor of a lineup (removing any earlier one with the same id). */
function put(s: ScriptApi, id: string, sprite: string, x: number, y: number, dir: Dir, name: string): void {
  removeAll(s, id);
  stage(s, id, sprite, x, y, dir, name);
}

/** Every ballgame actor staged by this file. */
const CAST_IDS = [
  'c12b_goku', 'c12b_gohan', 'c12b_piccolo', 'c12b_krillin', 'c12b_trunks', 'c12b_beerus', 'c12b_whis', 'c12b_vados',
  'c12b_champa', 'c12b_cabba', 'c12b_magetta', 'c12b_botamo', 'c12b_vegeta', 'c12b_goten', 'c12b_batter',
];

/** Universe 7 in the field for the top of the ninth; Universe 6 in its dugout. */
function setupTop(s: ScriptApi): void {
  removeAll(s, ...CAST_IDS);
  const [mx, my] = EP.park.mound;
  put(s, 'c12b_goku', 'goku', mx, my, 'down', 'Goku');
  put(s, 'c12b_krillin', 'krillin', EP.park.catcher[0], EP.park.catcher[1], 'up', 'Krillin');
  put(s, 'c12b_piccolo', 'piccolo', 26, 25, 'down', 'Piccolo');
  put(s, 'c12b_gohan', 'gohan', 14, 25, 'down', 'Gohan');
  put(s, 'c12b_trunks', 'trunksKid', 17, 22, 'down', 'Trunks');
  put(s, 'c12b_whis', 'whis', EP.park.umpire[0], EP.park.umpire[1], 'up', 'Whis');
  put(s, 'c12b_vados', 'vados', 28, 29, 'left', 'Vados');
  put(s, 'c12b_beerus', 'beerus', 7, 31, 'down', 'Beerus');
  put(s, 'c12b_champa', 'champa', 31, 31, 'down', 'Champa');
  put(s, 'c12b_cabba', 'cabba', 33, 31, 'down', 'Cabba');
  put(s, 'c12b_magetta', 'c07_magetta', 35, 31, 'down', 'Magetta');
  put(s, 'c12b_botamo', 'botamo', 34, 33, 'up', 'Botamo');
  put(s, 'c12b_vegeta', 'vegeta', 32, 33, 'up', 'Vegeta');
  put(s, 'c12b_goten', 'goten', 30, 33, 'up', 'Goten');
  const [fx, fy] = EP.park.field;
  s.place('hero', fx, fy, 'down');
}

/** Universe 6 in the field for the bottom of the ninth; Universe 7 (and Yamcha) in its dugout. */
function setupBottom(s: ScriptApi): void {
  removeAll(s, ...CAST_IDS);
  const [mx, my] = EP.park.mound;
  put(s, 'c12b_champa', 'champa', mx, my, 'down', 'Champa');
  put(s, 'c12b_botamo', 'botamo', EP.park.catcher[0], EP.park.catcher[1], 'up', 'Botamo');
  put(s, 'c12b_magetta', 'c07_magetta', 26, 25, 'down', 'Magetta');
  put(s, 'c12b_cabba', 'cabba', 17, 22, 'down', 'Cabba');
  put(s, 'c12b_goten', 'goten', 14, 25, 'down', 'Goten');
  put(s, 'c12b_vegeta', 'vegeta', 21, 12, 'down', 'Vegeta');
  put(s, 'c12b_whis', 'whis', EP.park.umpire[0], EP.park.umpire[1], 'up', 'Whis');
  put(s, 'c12b_vados', 'vados', 28, 29, 'left', 'Vados');
  put(s, 'c12b_beerus', 'beerus', 7, 31, 'down', 'Beerus');
  put(s, 'c12b_goku', 'goku', 5, 33, 'up', 'Goku');
  put(s, 'c12b_gohan', 'gohan', 6, 33, 'up', 'Gohan');
  put(s, 'c12b_piccolo', 'piccolo', 8, 33, 'up', 'Piccolo');
  put(s, 'c12b_krillin', 'krillin', 9, 33, 'up', 'Krillin');
  put(s, 'c12b_trunks', 'trunksKid', 10, 33, 'up', 'Trunks');
  s.place('hero', 4, 31, 'right');
}

// ------------------------------------------------------------------------------------------------ fielding

/**
 * One fly ball to centre field. The ball flies from home plate to (lx, ly) in `dur` frames with the chalk ring on
 * the landing spot; the player has the controls until it comes down. True when Yamcha is under it.
 */
async function flyBall(s: ScriptApi, batter: string, lx: number, ly: number, dur: number, peak: number): Promise<boolean> {
  const f = s.field;
  const [hx, hy] = EP.park.home;
  await s.pan(hx, hy - 2, 30);
  s.pose(batter, 'raise');
  await s.wait(16);
  s.pose(batter, 'punch2');
  s.sfx('hit');
  f.fx.hit(px(hx + 1), py(hy) - 18, '#ffffff', 8);
  const sx = px(hx + 1);
  const sy = py(hy) - 4;
  const tx = px(lx);
  const ty = py(ly);
  const ball = newBall(f, sx, sy);
  f.map.removeProp('c12_mark');
  f.map.addProp('c12_ballMark', tx - 10, ty - 8, 'c12_mark');
  s.follow();
  s.free();
  await frames(s, (_f, t) => {
    const k = Math.min(1, t / dur);
    ball.x = sx + (tx - sx) * k;
    ball.y = sy + (ty - sy) * k;
    ball.lift = 8 + Math.sin(k * Math.PI) * peak;
    BALLGAME.play = { kind: 'fly', x: tx, y: ty, t, dur };
    return k >= 1;
  });
  s.lock();
  BALLGAME.play = null;
  s.pose(batter, null);
  f.map.removeProp('c12_mark');
  const p = f.player;
  const caught = Math.hypot(p.x - tx, p.y - ty) <= CATCH_RADIUS;
  ball.dead = true;
  if (caught) {
    s.sfx('block');
    f.fx.hit(p.x, p.y - 20, '#f8f8f0', 6);
    p.pose = 'raise';
  } else {
    s.sfx('punch');
    f.fx.dust(tx, ty);
  }
  return caught;
}

/** Walk Yamcha back to centre field between batters. */
async function backToCentre(s: ScriptApi): Promise<void> {
  const [fx, fy] = EP.park.field;
  await s.walk('hero', fx, fy, 2.2);
  s.face('hero', 'down');
}

/** The top of the ninth. Returns [Universe 6 runs scored, catches made]. */
async function topOfNinth(s: ScriptApi): Promise<[number, number]> {
  let outs = 0;
  let runs = 0;
  let catches = 0;
  const out = async (line: string): Promise<void> => {
    outs++;
    board(s, START_RUNS + runs, START_RUNS, outs);
    s.toast(`OUT! (${outs})`);
    await s.say('c12b_vados', line, 'smirk');
  };
  const batterUp = (sprite: string, name: string): void => {
    put(s, 'c12b_batter', sprite, EP.park.home[0] + 1, EP.park.home[1], 'up', name);
  };
  const fly = async (sprite: string, name: string, land: [number, number], dur: number, peak: number): Promise<void> => {
    batterUp(sprite, name);
    if (await flyBall(s, 'c12b_batter', land[0], land[1], dur, peak)) {
      catches++;
      await s.say('c12_yamchaBall', catches === 1 ? 'Got it! Like riding a bike!' : catches === 2 ? 'And another one! Still got it!' : 'Nothing gets past centre field today!', 'happy');
      await out(`${name} flies out to centre. Batter is out.`);
    } else {
      runs++;
      board(s, START_RUNS + runs, START_RUNS, outs);
      s.toast(`Universe 6 scores! ${START_RUNS + runs} - ${START_RUNS}`);
      await s.say('c12b_champa', runs === 1 ? 'HA! Did you see that, brother? Universe 6 leads!' : 'Another run! Prepare to hand over your planet\'s food, Beerus!', 'happy');
      await s.say('c12b_beerus', runs === 1 ? 'Yamcha, was it? CATCH THE BALL.' : 'If we lose this game, I am destroying this stadium. And you.', 'angry');
    }
    removeAll(s, 'c12b_batter');
    await backToCentre(s);
  };

  // 1. Cabba: a fair fly to shallow centre.
  await fly('cabba', 'Cabba', [17, 8], 120, 70);
  // 2. Magetta: the heat melts the ball.
  if (outs < 3) {
    batterUp('c07_magetta', 'Magetta');
    await s.pan(EP.park.home[0], EP.park.home[1] - 2, 30);
    await s.say('c12b_batter', 'Fsss... FSSSHH!', 'angry');
    s.flash('#f88020', 10);
    s.sfx('explode');
    await s.narrate('Magetta swings so hard he gets hot. The ball melts on the bat.');
    await out('A melted ball is a dead ball. Batter is out. Do cool down, Magetta.');
    removeAll(s, 'c12b_batter');
    s.follow();
  }
  // 3. Vegeta, filling in for Universe 6: a deep drive to right-centre (Yamcha has to run for it).
  if (outs < 3) {
    batterUp('vegeta', 'Vegeta');
    await s.pan(EP.park.home[0], EP.park.home[1] - 2, 30);
    await s.say('c12b_batter', 'I\'m only here to beat Kakarot\'s team. Watch closely, Yamcha.', 'smirk');
    await fly('vegeta', 'Vegeta', [27, 6], 125, 96);
  }
  // 4. Champa: tries destruction on the first swing, so the umpires make him hit it again, fairly.
  if (outs < 3) {
    batterUp('champa', 'Champa');
    await s.pan(EP.park.home[0], EP.park.home[1] - 2, 30);
    s.flash('#c070f0', 8);
    await s.talk([
      ['c12b_batter', 'Behold, the bat of a God of Destruction!', 'smirk'],
      ['c12b_whis', 'Lord Champa, that bat is glowing. No destruction in this game. Again, please.', 'happy'],
      ['c12b_batter', 'Tch. FINE.', 'angry'],
    ]);
    await fly('champa', 'Champa', [14, 14], 120, 84);
  }
  // 5. Botamo: hits it and will not budge from the plate.
  if (outs < 3) {
    batterUp('botamo', 'Botamo');
    await s.pan(EP.park.home[0], EP.park.home[1] - 2, 30);
    s.pose('c12b_batter', 'punch2');
    s.sfx('hit');
    await s.talk([
      ['c12b_champa', 'RUN, Botamo! RUN!', 'shout'],
      ['c12b_batter', '...', 'neutral'],
      ['c12b_vados', 'Botamo cannot be moved. Not even by Botamo. The ball is fielded at first. Batter is out.', 'smirk'],
    ]);
    await out('That is the rule, Lord Champa.');
    removeAll(s, 'c12b_batter');
    s.follow();
  }
  // 6. Goten: swings so hard he spins into the dirt.
  if (outs < 3) {
    batterUp('goten', 'Goten');
    await s.pan(EP.park.home[0], EP.park.home[1] - 2, 30);
    for (let i = 0; i < 3; i++) {
      s.pose('c12b_batter', i % 2 ? 'kick' : 'punch2');
      s.sfx('dash');
      await s.wait(10);
    }
    s.pose('c12b_batter', 'ko');
    await s.talk([
      ['c12b_batter', 'Whoaaa... the sky is spinning...', 'shock'],
      ['c12b_whis', 'Strike three. Batter is out.', 'happy'],
    ]);
    await out('Three away. Side retired.');
    removeAll(s, 'c12b_batter');
    s.follow();
  }
  return [runs, catches];
}

// ------------------------------------------------------------------------------------------------ batting

/** Pitch progress p (0..1) at frame t of a pitch, the lateral swing of a curve (px), and the pitch's length. */
function pitchPath(type: PitchType, t: number): { p: number; dx: number; dur: number } {
  if (type === 'fast') return { p: t / 54, dx: 0, dur: 54 };
  if (type === 'curve') { const p = t / 66; return { p, dx: Math.sin(Math.min(1, p) * Math.PI) * 18, dur: 66 }; }
  // The godly pitch: out of Champa's hand, then dead still in mid-air, then gone.
  if (t < 30) return { p: (t / 30) * 0.5, dx: 0, dur: 96 };
  if (t < 66) return { p: 0.5, dx: Math.sin(t / 3) * 2, dur: 96 };
  return { p: 0.5 + ((t - 66) / 30) * 0.5, dx: 0, dur: 96 };
}

/** One pitch. Returns 'homer' / 'hit' when Yamcha connects, 'early' / 'late' for a miss. */
async function pitch(s: ScriptApi, type: PitchType): Promise<'homer' | 'hit' | 'early' | 'late'> {
  const f = s.field;
  const [mx, my] = EP.park.mound;
  s.pose('c12b_champa', 'raise');
  if (type === 'godly') s.aura('c12b_champa', '#c070f0');
  await s.wait(30);
  s.pose('c12b_champa', 'blast');
  s.sfx('dash');
  const sx = px(mx);
  const sy = py(my) - 2;
  const ex = px(EP.park.catcher[0]);
  const ey = py(EP.park.catcher[1]) - 8;
  const ball = newBall(f, sx, sy);
  s.pose('hero', 'raise');
  let swing = -1;
  await frames(s, (fld, t) => {
    const { p, dx } = pitchPath(type, t);
    ball.x = sx + (ex - sx) * Math.min(1, p) + dx;
    ball.y = sy + (ey - sy) * Math.min(1, p);
    ball.lift = 14 - Math.min(1, p) * 4;
    BALLGAME.play = { kind: 'pitch', p, type };
    if (swing < 0 && fld.input.pressed('A')) {
      swing = p;
      s.pose('hero', 'punch2');
      s.sfx('slash');
    }
    return p >= 1 || (swing >= SWING_WINDOW[0] && swing < SWING_WINDOW[1]);
  });
  BALLGAME.play = null;
  s.pose('c12b_champa', null);
  s.aura('c12b_champa', null);
  if (swing >= SWING_WINDOW[0] && swing < SWING_WINDOW[1]) {
    const homer = swing >= SWEET_SPOT[0] && swing <= SWEET_SPOT[1];
    s.sfx(homer ? 'blastHit' : 'hit');
    f.fx.hit(ball.x, ball.y - ball.lift, '#ffffff', homer ? 12 : 8);
    s.shake(homer ? 16 : 8, homer ? 2 : 1);
    await launch(s, ball, homer);
    s.pose('hero', null);
    return homer ? 'homer' : 'hit';
  }
  ball.dead = true;
  s.sfx('block');
  s.pose('hero', null);
  return swing >= 0 && swing < SWING_WINDOW[0] ? 'early' : 'late';
}

/** The ball off Yamcha's bat: over the centre-field wall, or into the left-centre gap. */
async function launch(s: ScriptApi, ball: Shot, homer: boolean): Promise<void> {
  const sx = ball.x;
  const sy = ball.y;
  const tx = homer ? px(23) : px(12);
  const ty = homer ? py(4) : py(15);
  const dur = homer ? 90 : 70;
  s.follow();
  await s.pan(homer ? 22 : 16, homer ? 10 : 20, 40);
  await frames(s, (_f, t) => {
    const k = Math.min(1, t / dur);
    ball.x = sx + (tx - sx) * k;
    ball.y = sy + (ty - sy) * k;
    ball.lift = 10 + Math.sin(k * Math.PI * (homer ? 0.6 : 1)) * (homer ? 140 : 60);
    return k >= 1 || ball.dead;
  });
  ball.dead = true;
}

/** Yamcha's at-bat in the bottom of the ninth. Returns how he reached base. */
async function yamchaAtBat(s: ScriptApi): Promise<AtBat> {
  const [bx, by] = EP.park.batter;
  s.place('hero', bx, by, 'up');
  await s.pan(EP.park.home[0], EP.park.home[1] - 3, 30);
  await s.talk([
    ['c12b_whis', 'Now batting for Universe 7... Yamcha.', 'happy'],
    ['c12b_beerus', 'Him?! He was knocked flat by a Saibaman! I read the file!', 'angry'],
    ['c12_yamchaBall', 'That was a long time ago, Lord Beerus. A bat and a ball... that\'s the one thing I\'m really good at.', 'smirk'],
  ]);
  await s.narrate('BATTING: press A as the ball crosses home plate. Right on the plate is the sweet spot.');
  const types: PitchType[] = ['fast', 'curve', 'godly'];
  for (let i = 0; i < types.length; i++) {
    const r = await pitch(s, types[i]);
    if (r === 'homer') return 'homer';
    if (r === 'hit') return 'hit';
    s.toast(`STRIKE ${i + 1}!`);
    if (i === 0) await s.say('c12b_whis', r === 'early' ? 'Strike one. A little early, Yamcha.' : 'Strike one. Champa\'s fastball is quite fast.', 'happy');
    else if (i === 1) {
      await s.say('c12b_whis', r === 'early' ? 'Strike two. You swung before it broke.' : 'Strike two. That curve came right back over the plate.', 'happy');
      await s.say('c12b_champa', 'One more! Watch THIS, you puny Earthling!', 'smirk');
    }
  }
  // Strike three on the godly pitch: which stood still in mid-air.
  await s.talk([
    ['c12b_whis', 'Strike thr- hm.', 'neutral'],
    ['c12b_vados', 'Lord Champa. A ball does not stop in mid-air and wait. That pitch was thrown with ki.', 'smirk'],
    ['c12b_whis', 'Illegal pitch. The batter takes first base.', 'happy'],
    ['c12b_champa', 'WHAT?! Vados, whose side are you on?!', 'angry'],
    ['c12b_vados', 'The rules\', my lord. As always.', 'smirk'],
  ]);
  return 'walk';
}

/** Run the hero along the bases (each leg a straight line), at `speed` px per frame. */
async function runBases(s: ScriptApi, legs: Array<[number, number]>, speed = 2.4): Promise<void> {
  for (const [x, y] of legs) await s.walk('hero', x, y, speed);
}

/**
 * Yamcha races home from third ahead of Vegeta's throw. Returns true for a slide in the window (under the tag).
 * Otherwise he runs into Botamo, and Champa's illegal tag gives him the run anyway.
 */
async function slideHome(s: ScriptApi): Promise<boolean> {
  const f = s.field;
  const p = f.player;
  const hx = px(EP.park.home[0]);
  const hy = py(EP.park.home[1]) - 6;
  const tx = px(EP.park.catcher[0]);
  const ty = py(EP.park.catcher[1]) - 8;
  const ball = newBall(f, px(21), py(13));
  const bsx = ball.x;
  const bsy = ball.y;
  s.toast('SLIDE! Press A just before home plate!');
  let slid = -1;
  let prompt = false;
  await frames(s, (fld, t) => {
    const k = Math.min(1, t / 64);
    ball.x = bsx + (tx - bsx) * k;
    ball.y = bsy + (ty - bsy) * k;
    ball.lift = 10 + Math.sin(k * Math.PI) * 40;
    const dx = hx - p.x;
    const dy = hy - p.y;
    const dist = Math.hypot(dx, dy);
    BALLGAME.play = { kind: 'slide', dist };
    if (!prompt && dist < 70) { prompt = true; s.sfx('menuMove'); }
    if (slid < 0 && fld.input.pressed('A')) {
      slid = dist;
      p.scriptPose = 'kick';
      s.sfx('dash');
    }
    const speed = slid >= 0 ? 3.4 : 2.4;
    if (dist <= speed) { p.x = hx; p.y = hy; return true; }
    p.x += (dx / dist) * speed;
    p.y += (dy / dist) * speed;
    p.dir = 'right';
    p.moving = true;
    p.running = true;
    p.animate();
    if (slid >= 0 && t % 4 === 0) fld.fx.dust(p.x, p.y);
    return false;
  });
  BALLGAME.play = null;
  ball.dead = true;
  p.moving = false;
  p.running = false;
  p.scriptPose = null;
  return slid >= SLIDE_WINDOW[0] && slid <= SLIDE_WINDOW[1];
}

/** A Universe 7 batter strikes out on three of Champa's pitches (the first out of the ninth). */
async function strikeout(s: ScriptApi, sprite: string, name: string, line: [string, Expression]): Promise<void> {
  put(s, 'c12b_batter', sprite, EP.park.home[0] + 1, EP.park.home[1], 'up', name);
  await s.pan(EP.park.home[0], EP.park.home[1] - 3, 30);
  for (let i = 0; i < 3; i++) {
    s.pose('c12b_champa', 'blast');
    s.sfx('dash');
    await s.wait(14);
    s.pose('c12b_batter', 'punch2');
    s.sfx('block');
    await s.wait(14);
    s.pose('c12b_champa', null);
    s.pose('c12b_batter', null);
  }
  await s.talk([
    ['c12b_whis', 'Strike three. One away.', 'happy'],
    ['c12b_batter', line[0], line[1]],
  ]);
  removeAll(s, 'c12b_batter');
}

/**
 * The bottom of the ninth. Returns the MVP points from batting and running.
 *
 * Universe 7 bats round and round in one order: Goku, Krillin, Gohan, Piccolo, Trunks, Yamcha. The inning opens
 * wherever the order stood, which is wherever the runs they need put it, so Yamcha always comes up with two out, the
 * bases empty, the game tied and Goku on deck: the winning run can only be his.
 */
async function bottomOfNinth(s: ScriptApi, u6Runs: number): Promise<number> {
  let u7 = START_RUNS;
  const u6 = START_RUNS + u6Runs;
  let outs = 0;
  board(s, u6, u7, outs);
  const tied = async (): Promise<void> => {
    s.sfx('levelUp');
    board(s, u6, u7, outs);
    await s.pan(20, 4, 40);
    await s.say('c12b_beerus', 'TIED! We are tied! Nobody is getting destroyed yet!', 'happy');
  };
  if (u6Runs >= 2) {
    // Two or three to get back: the order turns over from Goku (three) or from Krillin (two).
    if (u6Runs === 3) await s.narrate('Goku leads off with a bunt and beats the throw by a mile.');
    await strikeout(s, 'krillin', 'Krillin', ['I didn\'t even SEE it... Yamcha, how do you hit that?!', 'shock']);
    outs = 1;
    board(s, u6, u7, outs);
    await s.narrate(u6Runs === 3
      ? 'Gohan doubles Goku home and Piccolo triples Gohan in. Trunks lifts a sacrifice fly to deep centre: two away, and Piccolo tags up and scores!'
      : 'Gohan doubles into the gap and Piccolo triples him home. Trunks lifts a sacrifice fly to deep centre: two away, and Piccolo tags up and scores!');
    u7 += u6Runs;
    outs = 2;
    await tied();
  } else {
    // One to get back or none: Gohan leads off and ties it with one swing, or the order opens with Piccolo.
    if (u6Runs === 1) {
      await s.narrate('Gohan leads off with a drive over the left-field fence!');
      u7 += 1;
      await tied();
    }
    await strikeout(s, 'piccolo', 'Piccolo', ['Hmph. Without ki I can barely follow it. Yamcha. How do you hit that?', 'neutral']);
    outs = 1;
    board(s, u6, u7, outs);
    await s.narrate('Trunks pops up to Cabba for the second out.');
    outs = 2;
    board(s, u6, u7, outs);
  }
  // Yamcha, with two out and the game tied.
  const r = await yamchaAtBat(s);
  if (r === 'homer') {
    await s.narrate('Yamcha\'s swing sends the ball soaring over the centre-field wall!');
    s.music('heroic');
    await s.pan(EP.park.home[0], EP.park.home[1] - 5, 30);
    await runBases(s, [EP.park.first, EP.park.second, EP.park.third, EP.park.home], 1.8);
    u7++;
    board(s, u6, u7, outs);
    return 4;
  }
  // On base: a single, or the illegal pitch.
  await runBases(s, [EP.park.first], r === 'hit' ? 2.4 : 1.4);
  if (r === 'hit') await s.say('c12b_whis', 'A clean single into left-centre!', 'happy');
  put(s, 'c12b_batter', 'goku', EP.park.home[0] + 1, EP.park.home[1], 'up', 'Goku');
  await s.talk([
    ['c12b_batter', 'Okay, Yamcha! I\'ll hit it and you run! Just like you showed me!', 'happy'],
    ['c12_yamchaBall', 'Goku, just make contact. Don\'t blow up the ball!', 'shock'],
  ]);
  s.pose('c12b_champa', 'blast');
  await s.wait(14);
  s.pose('c12b_batter', 'punch2');
  s.sfx('hit');
  s.shake(8, 1);
  await s.narrate('Goku lines the pitch into the right-field corner! Yamcha is off with the swing!');
  s.music('heroic');
  s.follow();
  await runBases(s, [EP.park.second, EP.park.third], 2.6);
  const slid = await slideHome(s);
  if (slid) {
    s.toast('SAFE!');
    await s.talk([
      ['c12b_vados', 'Safe. Under the tag by a whisker.', 'happy'],
      ['c12b_botamo', '...', 'neutral'],
    ]);
  } else {
    s.pose('hero', 'hurt');
    s.sfx('hit');
    s.shake(10, 2);
    await s.say('c12_yamchaBall', 'OOF! It\'s like running into a mountain!', 'hurt');
    await s.walk('c12b_champa', EP.park.home[0] + 1, EP.park.home[1] - 1, 3);
    s.pose('c12b_champa', 'punch2');
    s.flash('#c070f0', 12);
    s.sfx('explode');
    await s.talk([
      ['c12b_champa', 'TAG! You\'re OUT! Hahaha!', 'happy'],
      ['c12b_vados', 'Lord Champa, your glove is glowing purple. You tagged him with destruction.', 'smirk'],
      ['c12b_whis', 'Destruction is banned in this game. The tag does not count. The runner is safe.', 'happy'],
      ['c12b_champa', 'NOOOOO!', 'shock'],
    ]);
    s.pose('hero', null);
    s.pose('c12b_champa', null);
  }
  u7++;
  board(s, u6, u7, outs);
  return (r === 'hit' ? 2 : 0) + (slid ? 1 : 0);
}

// ------------------------------------------------------------------------------------------------ the game

/** Yamcha's costume over the active hero for the length of the game; returns how to put things back. */
function becomeYamcha(s: ScriptApi): () => void {
  const id = s.hero;
  const c = s.state.char(id);
  const prevOutfit = c.outfit ?? null;
  s.transformNow(null);
  s.outfit(id, 'c12_yamchaBall');
  return () => {
    s.outfit(id, prevOutfit);
  };
}

/** Champa's challenge at Capsule Corp, then the game at West City Ballpark, then home. */
async function playBall(s: ScriptApi): Promise<void> {
  await s.quest(QUEST);
  await s.fadeOut(20);
  await warpTo(s, 'c12_ballpark', EP.park.arrive[0], EP.park.arrive[1], 'up');
  const game = s.field.game;
  s.set(BUSY);
  game.fightDepth++;
  game.hideHud = true;
  const unsuit = becomeYamcha(s);
  try {
    s.letterbox(true);
    s.music('tournament');
    setupTop(s);
    board(s, START_RUNS, START_RUNS, 0);
    await s.pan(20, 5, 1);
    await s.narrate('West City Ballpark. Eight innings later...');
    await s.talk([
      ['c12b_whis', 'Universe 6, three. Universe 7, three. Top of the ninth inning!', 'happy'],
      ['c12b_champa', 'You have no pitching, no fielding and one player who knows the rules, brother. Your food is as good as mine.', 'smirk'],
    ]);
    await s.pan(EP.park.field[0], EP.park.field[1] + 1, 50);
    await s.talk([
      ['c12b_beerus', 'Yamcha! You. Centre field. Catch everything.', 'angry'],
      ['c12_yamchaBall', 'Leave it to me, Lord Beerus! I played centre field for three seasons with the Taitans.', 'happy'],
    ]);
    await s.narrate('FIELDING: a chalk ring shows where the fly ball will land. Walk under it before it comes down. Double-tap a direction to run.');
    s.letterbox(false);
    const [u6Runs, catches] = await topOfNinth(s);
    s.letterbox(true);
    await s.fadeOut(16);
    setupBottom(s);
    board(s, START_RUNS + u6Runs, START_RUNS, 0);
    await s.pan(20, 4, 1);
    await s.fadeIn(16);
    await s.talk([
      ['c12b_whis', `Bottom of the ninth. Universe 6, ${START_RUNS + u6Runs}. Universe 7, ${START_RUNS}.`, 'happy'],
      ['c12b_vados', 'Lord Champa will pitch. Do try not to hit anyone, my lord.', 'smirk'],
    ]);
    s.letterbox(false);
    const batting = await bottomOfNinth(s, u6Runs);
    const mvp = catches + batting;
    s.set('c12_ballMvp', mvp);
    // The winning run.
    s.letterbox(true);
    s.sfx('levelUp');
    s.music('victory');
    await s.pan(EP.park.home[0], EP.park.home[1] - 2, 30);
    const [hx, hy] = heroTile(s);
    const mob: Array<[string, number, number]> = [['c12b_goku', -1, -1], ['c12b_krillin', 1, -1], ['c12b_gohan', -2, 0], ['c12b_piccolo', 2, 0], ['c12b_trunks', 0, -2]];
    await Promise.all(mob.map(([id, dx, dy]) => (s.exists(id) ? s.walk(id, hx + dx, hy + dy, 3) : Promise.resolve())));
    for (const [id] of mob) if (s.exists(id)) s.face(id, 'hero');
    s.pose('hero', 'raise');
    await s.talk([
      ['c12b_whis', 'And that is the game! Universe 7 wins it in the bottom of the ninth!', 'happy'],
      ['c12b_krillin', 'YAMCHA! You did it! You actually did it!', 'happy'],
      ['c12b_goku', 'That was amazing, Yamcha! Can we play again tomorrow?', 'happy'],
      ['c12_yamchaBall', 'Hah... ha ha. For once, I\'m not the one lying in a crater.', 'happy'],
    ]);
    s.pose('hero', null);
    await s.walk('c12b_beerus', hx - 3, hy - 1, 2.4);
    s.face('c12b_beerus', 'hero');
    await s.talk([
      ['c12b_beerus', 'Yamcha. You were weak in every way that matters to me...', 'neutral'],
      ['c12b_beerus', mvp >= MVP_BONUS ? '...except today. That was well played. Here. A souvenir from your God of Destruction.' : '...except today. Hmph. Well played.', 'smirk'],
      ['c12_yamchaBall', 'L-Lord Beerus... thank you!', 'happy'],
      ['c12b_champa', 'This isn\'t over, brother! Next time: sumo! Or bowling!', 'angry'],
      ['c12b_vados', 'Next time, my lord, perhaps without trying to destroy anything. Shall we go? The food is at Capsule Corp.', 'smirk'],
    ]);
    s.toast(`Yamcha's MVP rating: ${mvp} of ${MVP_MAX}`);
    await s.give('c12_gameBall');
    await s.give('str3');
    if (mvp >= MVP_BONUS) await s.give('end1');
  } finally {
    BALLGAME.play = null;
    unsuit();
    game.hideHud = false;
    game.fightDepth = Math.max(0, game.fightDepth - 1);
    s.clear(BUSY);
  }
  await s.fadeOut(20);
  removeAll(s, ...CAST_IDS);
  s.letterbox(false);
  await warpTo(s, HUB.cc.map, HUB.cc.arrive[0], HUB.cc.arrive[1], 'up');
  await s.narrate('Back at Capsule Corp, both teams eat until the buffet is empty. Champa takes three plates home "for Vados".');
  // Universe 6 goes home by Vados's staff (the garden-table overlay hides them from now on).
  if (['c12_champaY', 'c12_champaP'].some((id) => s.exists(id))) {
    s.flash('#80d8f8', 8);
    s.sfx('teleport');
    removeAll(s, 'c12_champaY', 'c12_vadosY', 'c12_champaP', 'c12_vadosP');
  }
  await s.done(QUEST, false);
  s.set('c12_ballDone');
  if (s.hasScript('c12_progress')) await s.call('c12_progress');
}

registerScripts({
  /** Champa at the Capsule Corp garden table (Chapter 12, or the post-game): the challenge. */
  c12_champa_talk: async (s) => {
    if (s.check(`done:${QUEST}`)) { await s.say('champa', 'I demand a rematch. Not today. I am still full.', 'angry'); return; }
    if (!s.check('chapter==12') && !s.flag('post_game')) {
      await s.say('champa', 'Hmph. Earth food. Earth food everywhere, and none of it in Universe 6.', 'angry');
      return;
    }
    s.letterbox(true);
    const [hx, hy] = heroTile(s);
    const champa = npcWithSprite(s, 'champa') ?? 'c12_champaS';
    if (!s.exists(champa)) stage(s, champa, 'champa', hx + 2, hy, 'left', 'Champa');
    let beerus = npcWithSprite(s, 'beerus');
    const tempBeerus = !beerus;
    if (!beerus) {
      stage(s, 'c12_beerusS', 'beerus', hx - 2, hy - 1, 'right', 'Beerus');
      beerus = 'c12_beerusS';
    }
    s.face(champa, beerus);
    s.face(beerus, champa);
    await s.talk([
      ['champa', 'Beerus! Brother! I have come to challenge you!', 'shout'],
      ['beerus', 'Champa. You came for the food. You have gravy on your chin already.', 'smirk'],
      ['champa', 'Ahem! A contest. Universe 6 against Universe 7. Winner eats all of Earth\'s food. Forever!', 'happy'],
      ['beerus', 'And what contest is that? Another tournament? You lost the last one.', 'neutral'],
      ['vados', 'Baseball, Lord Beerus. An Earth game. Nine to a side, a bat, a ball. I have read the rulebook twice.', 'happy'],
      ['whis', 'Ohoho! Then Vados and I shall umpire. No ki, no flying, and absolutely no destruction. Of anything.', 'happy'],
      ['beerus', '...Fine! I accept! ...{hero}. What is baseball?', 'angry'],
    ]);
    // Whoever Beerus asks points him at Yamcha, each in their own way.
    const answers: Record<string, [string, Expression]> = {
      goku: ['No idea! Sounds fun, though! Oh, and Yamcha used to play it for money. He knows all the rules!', 'happy'],
      vegeta: ['An Earthling game with sticks. Ask Yamcha. It is the one thing anyone ever paid him to be good at.', 'smirk'],
      gohan: ['A bat-and-ball sport, Lord Beerus. Yamcha played it professionally. He knows every rule.', 'happy'],
      trunks: ['Mom told me about it. She said Yamcha was a real pro! He\'d know all the rules.', 'happy'],
      piccolo: ['A waste of a good afternoon. ...Yamcha played it for money. He will know the rules.', 'neutral'],
      satan: ['Baseball? The Champ has mastered every sport! ...But Yamcha played it pro, so, uh, ask him.', 'shock'],
    };
    const [answer, mood] = answers[s.hero] ?? answers.goku;
    await s.talk([
      ['hero', answer, mood],
      ['beerus', 'Then get me this Yamcha. And everyone else who can hold a stick.', 'angry'],
    ]);
    if (tempBeerus) removeAll(s, 'c12_beerusS');
    if (champa === 'c12_champaS') removeAll(s, champa);
    s.letterbox(false);
    await playBall(s);
  },

  c12_vados_talk: async (s) => {
    if (s.check(`done:${QUEST}`)) { await s.say('vados', 'Lord Champa has been practising his swing every night. Into the furniture.', 'smirk'); return; }
    await s.say('vados', s.check('chapter==12') || s.flag('post_game')
      ? 'Lord Champa has something to say to Lord Beerus. A challenge. He has been rehearsing it all morning.'
      : 'Lord Champa is busy eating. Do come back later.', 'smirk');
  },

  /** The ballpark gate back to Capsule Corp (after the game). */
  c12_park_leave: async (s) => {
    await warpTo(s, HUB.cc.map, HUB.cc.arrive[0], HUB.cc.arrive[1], 'up');
  },
});
