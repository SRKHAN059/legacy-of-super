import { describe, expect, it } from 'vitest';
// @ts-expect-error -- Node built-ins; the project ships no @types/node (this file reads the recording and writes the report).
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
// @ts-expect-error -- Node built-in (see above).
import { tmpdir } from 'node:os';
import { ENEMIES, registerEnemies } from '../src/content/enemies';
import { registerMaps } from '../src/content/registry';
import { Rng } from '../src/engine/math';
import { Game } from '../src/game/game';
import { registerScripts, ScriptApi } from '../src/game/script';
import type { GameState } from '../src/game/state';
import {
  factsFor, FIGHT_CAP, type FightReport, type FightRun, type FightStats, FINALE_BAND, formStats, hitsRatio, mainRoots, noteFor,
  type ReferenceBoss, REFERENCE_BOSSES, registerReferenceBosses, replayRoot, runReference, SKILL, statsFor, STORY_BAND, verdictFor,
  WELL_ABOVE,
} from './fairbot';
import { recordFights, type RecordedFight, type RecordedRoot, Sim } from './sim';

/**
 * Fair-play balance (critic gap 1): can a person win the fights?
 *
 * The always-on tests below check the harness itself: the critic's hits ratio, a LoG2 reference boss played through
 * real input, the Senzu menu, and the record -> replay pipeline.
 *
 * The full report replays every story fight of a recorded full-game run with the FairBot (tests/fairbot.ts) for five
 * seeds and writes JSON. It needs a recording, so it only runs on request:
 *
 *   LOS_RECORD_FIGHTS=/tmp/fights.json npx vitest run tests/full_game.test.ts
 *   LOS_FIGHTS=/tmp/fights.json LOS_BALANCE_OUT=/tmp/balance_report.json npx vitest run tests/balance.test.ts
 *
 * LOS_ONLY=<enemy type or script id> limits the report to the fights matching it; LOS_SEEDS=<n> changes the number of
 * seeds (default 5). Verdicts follow the task's rules (fairbot.ts `verdictFor`).
 *
 * The always-on regression ('every story fight') replays the committed recording tests/fixtures/story_fights.json on
 * the report's first three seeds and asserts every fight's band; its header lists the thresholds and exemptions.
 */

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

/** Seeds per fight in the report. */
const SEEDS = Number(env.LOS_SEEDS ?? 5);
/** Extra levels tried for fights the bot cannot win at the recorded level. */
const LEVEL_STEPS = [3, 6];
/**
 * Vitest timeout for a test that replays fights. Each takes 0.3-25 s of test time on an idle machine; the margin is
 * for a loaded one. A replay that cannot finish stops on its own at fairbot.ts BOUT_CAP / IDLE_CAP long before this.
 */
const REPLAY_TIMEOUT = 180000;

/** RNG seed of every save a test builds from scratch. */
const SAVE_SEED = 0x5a1e5eed;

/**
 * Pin a test-built save's RNG. A new GameState draws a random seed (src/game/state.ts) and joining a character rolls
 * its level-ups from it, so without this the same test would build a different party (HP, stats) on every run and
 * its replays would not repeat. The replay itself always reseeds from the fight seed (fairbot.ts `replayRoot`).
 */
function pinSeed(st: GameState): GameState {
  st.data.seed = SAVE_SEED;
  st.rng = new Rng(SAVE_SEED ^ st.data.playFrames);
  return st;
}

/** A fresh, pinned save to build a test's start from. */
function freshState(): GameState {
  return pinSeed(new Sim().game.state);
}

// ------------------------------------------------------------------------------------------------ harness checks

/** A passive, fragile boss for harness tests: never attacks, dies to a couple of strings. */
const DUMMY = 'bal_test_dummy';
registerEnemies([{
  id: DUMMY, name: 'Training Dummy', sprite: 'universeFighter', hp: 120, str: 1, pow: 1, end: 0, exp: 0, ai: 'boss', speed: 0,
  desc: 'Balance harness target.', boss: { endAt: 0, phases: [{ until: 0, moves: ['guard'], rest: 900 }] },
}]);
const DUMMY_REF: ReferenceBoss = { id: DUMMY, name: 'Dummy', hero: 'goku', level: 20, form: 'ssj', techs: ['kiBlast'], charged: false, senzu: 1, critic: 0 };

/**
 * Harness maze: three walls hang from the top of a 36 x 20 yard, so its four bays meet only along the bottom row of
 * tiles. Training posts (passive, fragile) stand at the top of every bay; the hero starts at the bottom of the first.
 */
const MAZE = 'bal_test_maze';
const POST = 'bal_test_post';
const MAZE_POSTS: Array<[number, number]> = [[4, 2], [13, 2], [22, 2], [31, 2]];
registerEnemies([{
  id: POST, name: 'Training Post', sprite: 'universeFighter', hp: 90, str: 1, pow: 1, end: 0, exp: 0, ai: 'idle', speed: 0,
  desc: 'Balance harness target: stands still.',
}]);
registerMaps([{
  id: MAZE, name: 'Harness Maze', music: 'boss', hostile: true, legend: { '.': 'arena', '#': 'cliff' },
  grid: Array.from({ length: 20 }, (_, y) => Array.from({ length: 36 }, (_, x) => (
    x === 0 || y === 0 || x === 35 || y === 19 || ([9, 18, 27].includes(x) && y <= 15) ? '#' : '.')).join('')),
}]);
registerScripts({
  /** A free-roam wave spread through the maze's bays. */
  bal_test_hunt: async (s) => {
    MAZE_POSTS.forEach(([x, y], i) => s.spawnEnemy(POST, x, y, `bal_post${i}`));
    await s.clearEnemies();
  },
  /** A wave nobody can finish: its one enemy is already "ended" (neither bot will hit it) but never dies. */
  bal_test_stuck: async (s) => {
    s.spawnEnemy(POST, 20, 10, 'bal_stuckPost').ended = true;
    await s.clearEnemies();
  },
});

/** A one-wave root on the harness maze (tests/sim.ts RecordedRoot) for Goku L20 starting at the bottom of bay 1. */
const mazeRoot = (script: string): RecordedRoot => {
  const st = freshState();
  st.join('goku', 20);
  st.data.active = 'goku';
  return {
    game: 0, script, map: MAZE, x: 4 * 16 + 8, y: 17 * 16 + 14, dir: 'up', npc: null, onEnter: false, save: JSON.stringify(st.data), carrying: null,
    fights: [{ seq: 0, kind: 'wave', type: '', opts: {}, map: MAZE, chapter: 0, hero: 'goku', level: 20, roster: [], result: null }],
  };
};

describe('fair bot harness', () => {
  it('reproduces the critic\'s hits ratio for LoG2\'s reference bosses (scratchpad bal.txt)', () => {
    const def = (id: string) => ENEMIES[id] ?? REFERENCE_BOSSES.find((r) => r.id === id)?.def;
    // Hero stats bal.txt used for each reference fight.
    const cases: Array<[string, { str: number; end: number; hpMax: number }, number, number, number]> = [
      ['bal_log2_android19', { str: 39, end: 36, hpMax: 291 }, 37, 13, 2.8],
      ['bal_log2_cell', { str: 47, end: 42, hpMax: 513 }, 30, 13, 2.3],
      ['bal_log2_superPerfectCell', { str: 99, end: 91, hpMax: 1162 }, 23, 13, 1.8],
      ['bal_log2_cooler', { str: 76, end: 67, hpMax: 1591 }, 89, 7, 12.7],
    ];
    for (const [id, hero, toEnd, toKo, ratio] of cases) {
      const d = def(id);
      expect(d, id).toBeTruthy();
      if (!d) continue;
      const r = hitsRatio(hero, d);
      // bal.txt prints rounded hero stats, so its hit counts can be one or two hits off the exact formula.
      expect(Math.abs(r.hitsToEnd - toEnd), `${id} hits to end ${r.hitsToEnd}`).toBeLessThanOrEqual(2);
      expect(r.hitsToKO, id).toBe(toKo);
      expect(Math.abs(r.ratio - ratio), `${id} ratio ${r.ratio}`).toBeLessThanOrEqual(0.2);
    }
    // Form bonuses apply like Player.str/end ('max' forms pin to 100).
    const cs = { str: 50, end: 40, hpMax: 900 } as Parameters<typeof formStats>[0];
    expect(formStats(cs, 'ssb')).toEqual({ str: 68, end: 58, hpMax: 900 });
    expect(formStats(cs, 'ui')).toEqual({ str: 100, end: 100, hpMax: 900 });
  });

  it('plays a LoG2 reference boss through real input: lands combos, transforms, takes real damage', async () => {
    const ref = REFERENCE_BOSSES[0];
    const r = await runReference(ref, 1);
    expect(r.errors).toEqual([]);
    const run = r.runs[0];
    expect(run).toBeTruthy();
    expect(run.result).not.toBe('unreached');
    expect(run.melee).toBeGreaterThan(5);
    expect(run.transforms).toBeGreaterThanOrEqual(1);
    expect(run.taken).toBeGreaterThan(0);
    expect(run.bossLeft).toBeLessThan(1);
    expect(run.frames).toBeLessThan(FIGHT_CAP);
  }, REPLAY_TIMEOUT);

  it('eats a Senzu Bean through the pause menu when HP drops below 30%', async () => {
    const r = await runReference(DUMMY_REF, 1, (st) => { st.hero.hp = Math.floor(st.hero.hpMax * 0.2); });
    const run = r.runs[0];
    expect(r.errors).toEqual([]);
    expect(run.senzu).toBe(1);
    expect(run.hpEnd).toBe(run.hpMax);
    expect(run.result).toBe('win');
    expect(run.assisted).toBe(false);
  }, REPLAY_TIMEOUT);

  it('records a scripted fight with the save it started from and replays it with the fair bot', async () => {
    const file = `${mkdtempSync(`${tmpdir()}/los-fights-`)}/fights.json`;
    const methods = () => [Game.prototype.runScript, ScriptApi.prototype.fight, ScriptApi.prototype.clearEnemies, ScriptApi.prototype.waitDefeat];
    await runReference(DUMMY_REF, 2);
    const before = methods();
    const stop = recordFights(file);
    try {
      // The test bot wins the fight once (as in a full-game run)...
      const sim = new Sim();
      const st = pinSeed(sim.game.state);
      st.join('goku', 20);
      st.data.active = 'goku';
      st.data.inv = { senzu: 1 };
      st.set('bal_ref', DUMMY);
      sim.game.startField('bal_arena', 8, 10, 'right');
      expect(await sim.run('bal_reference')).toBe(true);
      const roots = JSON.parse(readFileSync(file, 'utf8')) as RecordedRoot[];
      const root = roots.find((x) => x.script === 'bal_reference' && x.fights.some((f) => f.result === 'win' && f.hero === 'goku'));
      expect(root).toBeTruthy();
      if (!root) return;
      expect(root.fights[0]).toMatchObject({ kind: 'boss', type: DUMMY, map: 'bal_arena', hero: 'goku', level: 20 });
      expect((JSON.parse(root.save) as { active: string }).active).toBe('goku');
      // ...and the fair bot replays it from that save.
      const replay = await replayRoot(root, 1);
      expect(replay.errors).toEqual([]);
      expect(replay.stopped).toBe('done');
      const run = replay.runs.find((x) => x.seq === root.fights[0].seq);
      expect(run).toMatchObject({ result: 'win', ko: false, assisted: false, hero: 'goku' });
    } finally {
      stop();
    }
    // The recorder leaves nothing behind: the same methods as before, and later fights write nothing.
    expect(methods()).toEqual(before);
    const size = readFileSync(file, 'utf8').length;
    await runReference(DUMMY_REF, 3);
    expect(readFileSync(file, 'utf8').length).toBe(size);
  }, REPLAY_TIMEOUT);

  it('hunts down a free-roam wave spread through walled-off bays by the walk, not the crow\'s flight', async () => {
    const rep = await replayRoot(mazeRoot('bal_test_hunt'), 1);
    expect(rep.errors).toEqual([]);
    expect(rep.stopped).toBe('done');
    expect(rep.runs[0]).toMatchObject({ result: 'cleared', ko: false, assisted: false });
    // Four bays, each a 15-tile walk up and back: well inside a minute, nowhere near the 5-minute give-up point.
    expect(rep.runs[0].frames).toBeLessThan(60 * 60);
  }, REPLAY_TIMEOUT);

  it('closes a fight that can never resolve as a capped (timeout) loss and stops the replay at once', async () => {
    const rep = await replayRoot(mazeRoot('bal_test_stuck'), 1, { boutCap: 900 });
    expect(rep.stopped).toBe('capped');
    expect(rep.runs[0]).toMatchObject({ result: 'capped', assisted: true });
    expect(rep.ticks).toBeLessThan(2000);
    const st = statsFor(rep.runs);
    expect([st.wins, st.capped, st.stuck]).toEqual([0, 1, 1]);
  }, REPLAY_TIMEOUT);

  it('a replay orphaned by a newer one stops at once and cannot clobber it', async () => {
    const older = replayRoot(mazeRoot('bal_test_stuck'), 1);
    const newer = await replayRoot(mazeRoot('bal_test_hunt'), 2);
    const orphan = await older;
    expect(orphan.stopped).toBe('superseded');
    expect(orphan.ticks).toBeLessThan(1000);
    expect(newer.errors).toEqual([]);
    expect(newer.stopped).toBe('done');
    expect(newer.runs[0]).toMatchObject({ result: 'cleared', assisted: false });
  }, REPLAY_TIMEOUT);
});

// ------------------------------------------------------------------------------------------------ tuned fights: act1

/**
 * Act 1 fights tuned into the LoG2 band (fair bot wins 4/5 or more with at most 2 Senzu, hits ratio about 2-4).
 *
 * The Satan Dojo sparring ladder opens in Chapter 2; the full-game runs first fight it with Goku at L12-14 in Chapter 3.
 * Each bout is replayed through the real spar script in the dojo from a save holding that Goku. Win rates swing by
 * 10-20 points from one save clock to the next (the field RNG mixes the play time into its seed), so each case plays
 * 8 seeds on each of 5 clocks. Over these 40 bouts Tien wins 87.5% at L12 and 95% at L14, Krillin 92.5% and 97.5%.
 */
describe('tuned fights: act1', () => {
  /** Goku at the dojo in the recorded full-game runs (SSJ, no Senzu yet). */
  const GOKU = {
    12: { level: 12, hpMax: 195, epMax: 49, str: 20, pow: 22, end: 19 },
    14: { level: 14, hpMax: 218, epMax: 54, str: 23, pow: 24, end: 20 },
  } as const;
  const LADDER = ['Yamcha', 'Krillin', 'Tien'] as const;
  type Partner = typeof LADDER[number];
  /** Save clocks (frames of play time): 10 s, 2, 6, 10 and 20 minutes. */
  const CLOCKS = [600, 7200, 21600, 36000, 72000];

  /** The bout's story root (tests/sim.ts RecordedRoot): Goku talking to the partner, the lower rungs already beaten. */
  const bout = (p: Partner, level: 12 | 14, playFrames: number): RecordedRoot => {
    const st = freshState();
    st.data.chapter = 3;
    st.data.playFrames = playFrames;
    for (const f of ['c02_rage', 'c02_dojoIntro', ...LADDER.slice(0, LADDER.indexOf(p)).map((q) => `c02_beat${q}`)]) st.set(f);
    st.addQuest('c02_spar');
    const g = GOKU[level];
    st.join('goku', g.level);
    Object.assign(st.char('goku'), { ...g, hp: g.hpMax, ep: g.epMax, techs: ['kiBlast', 'kamehameha'], selected: 0, form: 'ssj', charged: false });
    st.data.active = 'goku';
    const type = `c02_sp${p}`;
    return {
      game: 0, script: `c02_spar_${p.toLowerCase()}`, map: 'satan_dojo', x: 9 * 16 + 8, y: 11 * 16 + 14, dir: 'down', npc: `${type}Npc`, onEnter: false,
      save: JSON.stringify(st.data), carrying: null,
      fights: [{ seq: 0, kind: 'boss', type, opts: { x: 10, y: 5, uid: `${type}_bout`, loseOk: true }, map: 'satan_dojo', chapter: 3, hero: 'goku', level, roster: [], result: null }],
    };
  };

  it('c02 sparring ladder: LoG2\'s HP, a concession point, and the hits ratio in band for Goku L12 and L14, Tien hardest', () => {
    expect(LADDER.map((p) => ENEMIES[`c02_sp${p}`].hp)).toEqual([800, 1800, 2110]);
    const ends = LADDER.map((p) => ENEMIES[`c02_sp${p}`].boss?.endAt ?? 0);
    expect(ends.every((e) => e > 0)).toBe(true);
    expect(ends[2]).toBeGreaterThanOrEqual(ends[1]);
    for (const level of [12, 14] as const) {
      const hero = formStats(GOKU[level] as unknown as Parameters<typeof formStats>[0], 'ssj');
      const [krillin, tien] = [hitsRatio(hero, ENEMIES.c02_spKrillin), hitsRatio(hero, ENEMIES.c02_spTien)];
      for (const [name, r] of [['Krillin', krillin], ['Tien', tien]] as const) {
        expect(r.ratio, `${name} vs Goku L${level}: hits ratio`).toBeGreaterThanOrEqual(2);
        expect(r.ratio, `${name} vs Goku L${level}: hits ratio`).toBeLessThanOrEqual(4);
        // LoG2's STR 35 Tien floored a Chapter 3 Goku in four hits.
        expect(r.hitsToKO, `${name} vs Goku L${level}: hits to KO`).toBeGreaterThanOrEqual(7);
      }
      expect(tien.ratio, `Goku L${level}: Tien is the hardest rung`).toBeGreaterThanOrEqual(krillin.ratio);
    }
  });

  it('c02 sparring ladder: the fair bot beats Krillin and Tien in the dojo as Goku L12 and L14 (40 bouts each)', async () => {
    const rate: Record<string, number> = {};
    for (const p of ['Krillin', 'Tien'] as const) {
      for (const level of [12, 14] as const) {
        const runs: FightRun[] = [];
        for (const clock of CLOCKS) {
          const root = bout(p, level, clock);
          for (let seed = 1; seed <= 8; seed++) {
            const rep = await replayRoot(root, seed);
            expect(rep.errors).toEqual([]);
            runs.push(...rep.runs.filter((x) => x.seq === 0 && x.attempt === 1));
          }
        }
        const st = statsFor(runs);
        expect(st.unreached, `${p} L${level}: bouts that never started`).toBe(0);
        rate[`${p} L${level}`] = st.wins / st.seeds;
      }
    }
    // The 80% band less sampling noise: 30 of 40 bouts or better.
    for (const [name, r] of Object.entries(rate)) expect(r, `${name}: fair-bot win rate`).toBeGreaterThanOrEqual(0.75);
    // The ladder holds where it is tightest: at L12 Tien wins no more often than Krillin.
    expect(rate['Tien L12']).toBeLessThanOrEqual(rate['Krillin L12']);
  }, REPLAY_TIMEOUT);
});

// ------------------------------------------------------------------------------------------------ tuned fights: act3

/**
 * Act 3 fights tuned into the LoG2 band (fair bot wins 4/5 or more with at most 2 Senzu, hits ratio about 2-4). Each
 * story beat is replayed whole on its own map from a save holding the party the full-game run brought there (levels,
 * stats, techniques, Senzu), so every fight keeps its context: Final Form before Golden Frieza and the relay to Vegeta,
 * Magetta's heat aura, Hit's two rounds, and the copies' wave, Potage's water and the glyph-pillar core hunt before
 * Copy Vegeta.
 */
describe('tuned fights: act3', () => {
  type Member = { level: number; hpMax: number; epMax: number; str: number; pow: number; end: number; form: string; techs: string[] };
  type Fight = Pick<RecordedFight, 'kind' | 'type' | 'opts' | 'hero' | 'level'>;
  const GOKU_TECHS = ['kiBlast', 'kamehameha', 'godKamehameha'];
  const VEGETA_TECHS = ['kiBlast', 'bigBang', 'galickGun'];

  /** A story root (tests/sim.ts RecordedRoot) for a whole beat, from a fresh save holding the recorded party. */
  const beat = (
    script: string, map: string, tile: [number, number], chapter: number, flags: string[],
    party: Partial<Record<'goku' | 'vegeta', Member>>, active: 'goku' | 'vegeta', senzu: number, fights: Fight[],
  ): RecordedRoot => {
    const st = freshState();
    st.data.chapter = chapter;
    for (const [id, m] of Object.entries(party) as Array<['goku' | 'vegeta', Member]>) {
      st.join(id, m.level);
      Object.assign(st.char(id), { ...m, hp: m.hpMax, ep: m.epMax, selected: 0, charged: chapter >= 7 });
    }
    st.data.active = active;
    st.data.inv = { senzu };
    for (const f of ['_storyRun', 'noSwitch', ...flags]) st.set(f);
    return {
      game: 0, script, map, x: tile[0] * 16 + 8, y: tile[1] * 16 + 14, dir: 'up', npc: null, onEnter: false, save: JSON.stringify(st.data),
      carrying: null, fights: fights.map((f, seq) => ({ seq, map, chapter, roster: [], result: null, ...f })),
    };
  };

  /** Five fair-bot seeds of a beat: each recorded fight's first-attempt statistics, in order. */
  const play = async (root: RecordedRoot): Promise<FightStats[]> => {
    const runs: FightRun[] = [];
    for (let seed = 1; seed <= 5; seed++) {
      const rep = await replayRoot(root, seed);
      expect(rep.errors).toEqual([]);
      runs.push(...rep.runs.filter((x) => x.attempt === 1));
    }
    return root.fights.map((f) => statsFor(runs.filter((x) => x.seq === f.seq)));
  };

  /** The band: 4/5 wins or better, at most 2 Senzu, and (bosses) the critic's hits ratio from the live hero within 2-4. */
  const inBand = (name: string, st: FightStats, boss = true): void => {
    expect(st.wins, `${name}: won ${st.wins}/${st.seeds}`).toBeGreaterThanOrEqual(4);
    expect(st.avgSenzu, `${name}: Senzu per fight`).toBeLessThanOrEqual(2);
    if (!boss) return;
    const ratio = st.ratio?.ratio ?? 0;
    expect(ratio, `${name}: hits ratio`).toBeGreaterThanOrEqual(2);
    expect(ratio, `${name}: hits ratio`).toBeLessThanOrEqual(4);
  };

  it('c06: Goku L19 takes Final Form and Golden Frieza back to back, then Vegeta L19 finishes the worn-down Frieza', async () => {
    const final = ENEMIES.c06_frieza;
    // The golden form stays above Final Form and keeps its kit: the stamina drain, the beam/nova/rain middle, the crash.
    for (const g of [ENEMIES.c06_goldenFrieza, ENEMIES.c06_goldenFrieza2]) {
      expect(g.str).toBeGreaterThan(final.str);
      expect(g.end).toBeGreaterThan(final.end);
      expect(g.boss?.stamina ?? 0).toBeGreaterThan(0);
    }
    expect(ENEMIES.c06_goldenFrieza.boss?.phases.map((p) => p.onStart)).toContain('c06_golden_tired');
    expect(ENEMIES.c06_goldenFrieza.boss?.phases.flatMap((p) => p.moves)).toEqual(expect.arrayContaining(['beam', 'nova', 'rain']));
    const round1 = beat('c06_round1', 'waste_mesa', [24, 19], 6, ['c06_arrived'], {
      goku: { level: 19, hpMax: 296, epMax: 67, str: 30, pow: 31, end: 25, form: 'ssg', techs: GOKU_TECHS },
      vegeta: { level: 16, hpMax: 251, epMax: 64, str: 25, pow: 22, end: 26, form: 'ssj', techs: ['kiBlast', 'bigBang'] },
    }, 'goku', 2, [
      { kind: 'boss', type: 'c06_frieza', opts: { uid: 'c06_friezaF' }, hero: 'goku', level: 19 },
      { kind: 'boss', type: 'c06_goldenFrieza', opts: { uid: 'c06_goldenF' }, hero: 'goku', level: 20 },
    ]);
    const [finalSt, goldenSt] = await play(round1);
    inBand('Final Form Frieza', finalSt);
    inBand('Golden Frieza (Goku)', goldenSt);
    const round2 = beat('c06_round2', 'waste_mesa', [24, 19], 6, ['c06_arrived', 'c06_round1'], {
      goku: { level: 21, hpMax: 336, epMax: 75, str: 33, pow: 34, end: 27, form: 'ssb', techs: GOKU_TECHS },
      vegeta: { level: 19, hpMax: 303, epMax: 73, str: 30, pow: 26, end: 30, form: 'ssj', techs: ['kiBlast', 'bigBang'] },
    }, 'vegeta', 2, [{ kind: 'boss', type: 'c06_goldenFrieza2', opts: { uid: 'c06_goldenF2', existing: true }, hero: 'vegeta', level: 19 }]);
    const [golden2St] = await play(round2);
    inBand('Golden Frieza (Vegeta)', golden2St);
  }, REPLAY_TIMEOUT);

  it('c07: Vegeta L22 wears Magetta down through the heat, and Goku L23 reads Hit\'s Time-Skip before the Kaio-ken round', async () => {
    // Magetta is still a ki fight (fists do half damage; c07_match5 adds the heat aura); Hit skips time in every phase
    // of both of Goku's rounds, and the Kaio-ken round is the stronger one.
    expect(ENEMIES.c07_magetta.resMelee ?? 1).toBeLessThanOrEqual(0.5);
    for (const def of [ENEMIES.c07_hit1, ENEMIES.c07_hit2]) for (const ph of def.boss?.phases ?? []) expect(ph.moves).toContain('timeSkip');
    expect(ENEMIES.c07_hit2.str).toBeGreaterThanOrEqual(ENEMIES.c07_hit1.str);
    const party = {
      goku: { level: 23, hpMax: 379, epMax: 81, str: 36, pow: 37, end: 29, form: 'ssb', techs: GOKU_TECHS },
      vegeta: { level: 22, hpMax: 363, epMax: 82, str: 33, pow: 29, end: 35, form: 'ssb', techs: VEGETA_TECHS },
    };
    const flags = ['c07_examDone', 'c07_ceremony'];
    const [magettaSt] = await play(beat('c07_match5', 'c07_nameless_arena', [5, 13], 7, flags, party, 'vegeta', 3, [
      { kind: 'boss', type: 'c07_magetta', opts: { uid: 'c07_magettaF' }, hero: 'vegeta', level: 22 },
    ]));
    inBand('Magetta', magettaSt);
    const [hit1St, hit2St] = await play(beat('c07_match8', 'c07_nameless_arena', [5, 13], 7, flags, party, 'vegeta', 3, [
      { kind: 'boss', type: 'c07_hit1', opts: { uid: 'c07_hitF2' }, hero: 'goku', level: 23 },
      { kind: 'boss', type: 'c07_hit2', opts: { uid: 'c07_hitF3', existing: true }, hero: 'goku', level: 24 },
    ]));
    inBand('Hit, first round', hit1St);
    inBand('Hit, Blue Kaio-ken round', hit2St);
  }, REPLAY_TIMEOUT);

  it('c08: Goku L27 clears the copies, pins and smashes the Commeson core, then outlasts Copy Vegeta', async () => {
    // The puzzle stands: the copy is untouchable until the core breaks, and only fists can break the core.
    expect(ENEMIES.c08_copyVegeta.boss?.vulnerableIf).toBe('c08_coreExposed');
    expect(ENEMIES.c08_core.absorbKi).toBe(true);
    const vault = beat('c08_vault', 'c08_potaufeu_vault', [12, 12], 8, ['c08_landed', 'c08_sealOpen', 'c08_gryllDone'], {
      goku: { level: 27, hpMax: 480, epMax: 94, str: 42, pow: 43, end: 34, form: 'ssb', techs: GOKU_TECHS },
      // Copy Vegeta mirrors this Vegeta (STR 42, POW 38, END 43) wherever he out-stats its own sheet.
      vegeta: { level: 29, hpMax: 552, epMax: 105, str: 42, pow: 38, end: 43, form: 'ssb', techs: VEGETA_TECHS },
    }, 'vegeta', 3, [
      { kind: 'wave', type: '', opts: { uid: 'c08_cg1,c08_cg2' }, hero: 'goku', level: 27 },
      { kind: 'boss', type: 'c08_copyVegeta', opts: { uid: 'c08_copyF', existing: true }, hero: 'goku', level: 27 },
    ]);
    const [waveSt, copySt] = await play(vault);
    inBand('the copies\' wave', waveSt, false);
    inBand('Copy Vegeta', copySt);
  }, REPLAY_TIMEOUT);
});

// ------------------------------------------------------------------------------------------------ tuned fights: act4

/**
 * Act 4 fights tuned into the LoG2 band (fair bot wins 4/5 or more with at most 2 Senzu, hits ratio about 2-4). Each
 * is replayed inside its own story script on its real map (the flashback crater; the Babari plateau with the village
 * below it) from a save holding the hero the full-game run brought there, with that save's stats, HP and Senzu.
 */
describe('tuned fights: act4', () => {
  type Hero = { level: number; hpMax: number; hp: number; epMax: number; str: number; pow: number; end: number };

  /** A one-fight story root (tests/sim.ts RecordedRoot) starting `script` from a fresh save that `setup` fills in. */
  const storyRoot = (
    script: string, map: string, tile: [number, number], npc: string | null,
    fight: Pick<RecordedFight, 'type' | 'opts' | 'chapter' | 'hero' | 'level'>, setup: (st: Sim['game']['state']) => void,
  ): RecordedRoot => {
    const st = freshState();
    setup(st);
    return {
      game: 0, script, map, x: tile[0] * 16 + 8, y: tile[1] * 16 + 14, dir: 'up', npc, onEnter: false, save: JSON.stringify(st.data),
      carrying: null, fights: [{ seq: 0, kind: 'boss', map, roster: [], result: null, ...fight }],
    };
  };

  /** Five fair-bot seeds of a root's fight, plus the hero-to-boss distance (px) when each bout began. */
  const playFair = async (root: RecordedRoot): Promise<{ st: FightStats; gaps: number[] }> => {
    const runs: FightRun[] = [];
    const gaps: number[] = [];
    for (let seed = 1; seed <= 5; seed++) {
      let gap = -1;
      const rep = await replayRoot(root, seed, {
        watch: (bot) => {
          const boss = bot.bout?.boss;
          const pl = bot.game.field?.player;
          if (gap < 0 && boss && pl) gap = Math.hypot(boss.x - pl.x, boss.y - pl.y);
        },
      });
      expect(rep.errors).toEqual([]);
      runs.push(...rep.runs.filter((x) => x.seq === 0 && x.attempt === 1));
      gaps.push(gap);
    }
    return { st: statsFor(runs), gaps };
  };

  /** Join a hero with the recorded stats and make them the active character. */
  const recorded = (st: Sim['game']['state'], id: 'trunks' | 'goku', h: Hero, techs: string[], form: string, chapter: number, senzu: number): void => {
    st.data.chapter = chapter;
    st.join(id, h.level);
    Object.assign(st.char(id), { ...h, ep: h.epMax, techs, selected: 0, charged: true, form });
    st.data.active = id;
    st.data.inv = { senzu };
  };

  it('c09_dabura: Trunks L30 SSJ (the full-game run\'s flashback) beats the Demon King with Senzu to spare', async () => {
    const dabura = ENEMIES.c09_dabura;
    // Trunks's stats in the recorded run (he rejoins at L30); Bulma's two Senzu are all he is sure to carry.
    const trunks: Hero = { level: 30, hpMax: 658, hp: 658, epMax: 102, str: 50, pow: 34, end: 36 };
    const r = hitsRatio(formStats(trunks as Parameters<typeof formStats>[0], 'ssj'), dabura);
    expect(r.ratio).toBeGreaterThanOrEqual(2);
    expect(r.ratio).toBeLessThanOrEqual(4);
    // Still the Demon King: table-bottom boss stats, a ki-heavy second phase, and Trunks finishes him in the cutscene.
    expect(dabura.hp).toBeGreaterThanOrEqual(4900);
    expect(dabura.boss?.endAt).toBe(0.3);
    expect(dabura.boss?.phases[1].moves).toEqual(expect.arrayContaining(['volley', 'beam', 'rain']));
    const root = storyRoot('c09_flashback', 'c09_flash_wastes', [13, 13], null,
      { type: 'c09_dabura', opts: { uid: 'c09_dabura1', loseOk: true }, chapter: 9, hero: 'trunks', level: 30 },
      (st) => recorded(st, 'trunks', trunks, ['kiBlast', 'burningAttack', 'swordBlast'], 'ssj', 9, 2));
    const { st } = await playFair(root);
    expect(st.wins, `won ${st.wins}/${st.seeds}`).toBeGreaterThanOrEqual(4);
    expect(st.avgSenzu).toBeLessThanOrEqual(2);
  }, REPLAY_TIMEOUT);

  it('c10_babarianChief: Goku L31 (arriving hurt, as in the full-game run) out-brawls the chief and his rally', async () => {
    const chief = ENEMIES.c10_babarianChief;
    const goku: Hero = { level: 31, hpMax: 620, hp: 486, epMax: 104, str: 47, pow: 47, end: 38 };
    const r = hitsRatio(formStats(goku as Parameters<typeof formStats>[0], 'ssb'), chief);
    expect(r.ratio).toBeGreaterThanOrEqual(2);
    expect(r.ratio).toBeLessThanOrEqual(4);
    // The brute's kit stays: a heavy club (STR well above POW), bull charges, warriors rallied from the huts.
    expect(chief.str).toBeGreaterThan(chief.pow);
    expect(chief.boss?.minion).toBe('c10_babarian');
    expect(chief.boss?.phases[1].moves).toEqual(expect.arrayContaining(['charge', 'summon']));
    // Started from the landing site, the way the chapter test (and so the full-game run) talks to him.
    const root = storyRoot('c10_chief_talk', 'c10_babari', [6, 22], 'c10_chief',
      { type: 'c10_babarianChief', opts: { uid: 'c10_chief1' }, chapter: 10, hero: 'goku', level: 31 },
      (st) => {
        recorded(st, 'goku', goku, ['kiBlast', 'kamehameha', 'godKamehameha'], 'ssb', 10, 3);
        st.addQuest('c10_q_babari');
        st.set('c10_babariSeen');
      });
    const { st, gaps } = await playFair(root);
    // The bout is staged at the top of the cliff path, a few steps below the chief, wherever he was talked to from.
    for (const g of gaps) expect(g).toBeGreaterThanOrEqual(40);
    expect(st.wins, `won ${st.wins}/${st.seeds}`).toBeGreaterThanOrEqual(4);
    expect(st.avgSenzu).toBeLessThanOrEqual(2);
  }, REPLAY_TIMEOUT);
});

// ------------------------------------------------------------------------------------------------ tuned fights: act2

/**
 * Act 2 fights tuned into the LoG2 band (fair bot wins 4/5 or more with at most 2 Senzu, hits ratio about 2-4). Each is
 * replayed inside its own story script on its real map (Pilaf's vault, the sky over the southern sea, the Great Mesa)
 * from a save holding the hero the full-game run brought there, with that save's level, stats, HP, form and Senzu.
 */
describe('tuned fights: act2', () => {
  type Hero = { level: number; hpMax: number; hp: number; epMax: number; str: number; pow: number; end: number };
  type Watch = NonNullable<NonNullable<Parameters<typeof replayRoot>[2]>['watch']>;

  /** A one-fight story root (tests/sim.ts RecordedRoot) starting `script` at a tile, from a fresh save `setup` fills in. */
  const act2Root = (
    script: string, map: string, tile: [number, number], fight: Pick<RecordedFight, 'kind' | 'type' | 'opts' | 'chapter' | 'hero' | 'level'>,
    setup: (st: Sim['game']['state']) => void,
  ): RecordedRoot => {
    const st = freshState();
    setup(st);
    return {
      game: 0, script, map, x: tile[0] * 16 + 8, y: tile[1] * 16 + 14, dir: 'up', npc: null, onEnter: false, save: JSON.stringify(st.data),
      carrying: null, fights: [{ seq: 0, map, roster: [], result: null, ...fight }],
    };
  };

  /** The fair bot's first try at the root's one fight, over five seeds (`watch` sees every tick of the replays). */
  const fairStats = async (root: RecordedRoot, watch?: Watch): Promise<FightStats> => {
    const runs: FightRun[] = [];
    for (let seed = 1; seed <= 5; seed++) {
      const rep = await replayRoot(root, seed, { watch });
      expect(rep.errors).toEqual([]);
      runs.push(...rep.runs.filter((x) => x.seq === 0 && x.attempt === 1));
    }
    return statsFor(runs);
  };

  /** Join a hero with the recorded stats as the active character, carrying `senzu` beans. */
  const recordedHero = (
    st: Sim['game']['state'], id: 'goku' | 'piccolo', h: Hero, techs: string[], form: string, chapter: number, senzu: number,
  ): void => {
    st.data.chapter = chapter;
    st.join(id, h.level);
    Object.assign(st.char(id), { ...h, ep: h.epMax, techs, selected: 0, form });
    st.data.active = id;
    st.data.inv = senzu ? { senzu } : {};
  };

  it('c03_pilafMk2: Goku L11 SSJ, sprung on at 63% HP with no Senzu (as in the full-game run), wrecks the Mk-II', async () => {
    const mk2 = ENEMIES.c03_pilafMk2;
    const goku: Hero = { level: 11, hpMax: 182, hp: 115, epMax: 46, str: 18, pow: 20, end: 17 };
    const r = hitsRatio(formStats(goku as Parameters<typeof formStats>[0], 'ssj'), mk2);
    expect(r.ratio).toBeGreaterThanOrEqual(2);
    expect(r.ratio).toBeLessThanOrEqual(3.5);
    // Still the gang's pride and joy: a kill-to-win mini-boss in the L8-12 boss band whose second phase calls robots.
    expect(mk2.hp).toBeGreaterThanOrEqual(850);
    expect(mk2.boss?.endAt).toBe(0);
    expect(mk2.boss?.minion).toBe('pilafRobot');
    expect(mk2.boss?.phases[1].moves).toEqual(expect.arrayContaining(['summon', 'volley', 'rain']));
    const root = act2Root('c03_mk2_ambush', 'pilaf_castle_in', [15, 4],
      { kind: 'boss', type: 'c03_pilafMk2', opts: { uid: 'c03_mk2', x: 12, y: 3 }, chapter: 3, hero: 'goku', level: 11 },
      (st) => {
        recordedHero(st, 'goku', goku, ['kiBlast', 'kamehameha'], 'ssj', 3, 0);
        for (const f of ['c03_castleSeen', 'c03_vaultOpen', 'pickup:c03_db1', 'pickup:c03_db2']) st.set(f);
        st.give('db1', 1);
        st.give('db2', 1);
      });
    const st = await fairStats(root);
    expect(st.wins, `won ${st.wins}/${st.seeds}`).toBeGreaterThanOrEqual(4);
    expect(st.avgSenzu).toBe(0);
  }, REPLAY_TIMEOUT);

  it('c03_beerus: forced Goku L14 SSG (no Senzu exist yet) reaches Beerus\'s scripted end', async () => {
    const beerus = ENEMIES.c03_beerus;
    const goku: Hero = { level: 14, hpMax: 218, hp: 218, epMax: 54, str: 23, pow: 24, end: 20 };
    const r = hitsRatio(formStats(goku as Parameters<typeof formStats>[0], 'ssg'), beerus);
    expect(r.ratio).toBeGreaterThanOrEqual(2);
    expect(r.ratio).toBeLessThanOrEqual(4);
    // Overwhelming through his moves, not a stat wall: three phases that escalate to the nova and the beam, and the
    // scripted end at half his HP (the clash moves to orbit) stays.
    expect(beerus.boss?.endAt).toBe(0.5);
    expect(beerus.boss?.phases).toHaveLength(3);
    expect(beerus.boss?.phases[2].moves).toEqual(expect.arrayContaining(['nova', 'beam', 'teleport']));
    expect(beerus.boss?.phases[2].rest).toBeLessThan(beerus.boss?.phases[0].rest ?? 0);
    const root = act2Root('c03_battle', 'c03_sky_sea', [6, 11],
      { kind: 'boss', type: 'c03_beerus', opts: { uid: 'c03_beerus1', x: 22, y: 11 }, chapter: 3, hero: 'goku', level: 14 },
      (st) => {
        recordedHero(st, 'goku', goku, ['kiBlast', 'kamehameha'], 'ssg', 3, 0);
        for (const f of ['c03_ritualDone', 'c03_seaArrived']) st.set(f);
        st.addQuest('c03_beerus');
      });
    const st = await fairStats(root);
    expect(st.wins, `won ${st.wins}/${st.seeds}`).toBeGreaterThanOrEqual(4);
    expect(st.avgSenzu).toBe(0);
  }, REPLAY_TIMEOUT);

  it('c05 wave 3: Piccolo L18 clears the mesa squad (two officers among eight) with Senzu to spare', async () => {
    const piccolo: Hero = { level: 18, hpMax: 260, hp: 260, epMax: 70, str: 24, pow: 28, end: 24 };
    const root = act2Root('c05_wave3', 'waste_mesa', [22, 27],
      { kind: 'wave', type: '', opts: {}, chapter: 5, hero: 'piccolo', level: 18 },
      (st) => {
        st.join('gohan', 18);
        recordedHero(st, 'piccolo', piccolo, ['kiBlast', 'specialBeamCannon'], 'unweighted', 5, 2);
        for (const f of ['c05_assembled', 'c05_wave1', 'c05_wave2', 'c05_shisamiDone', 'c05_mesaSeen']) st.set(f);
        st.addQuest('c05_mesa');
      });
    // The squad as the wave begins: who is in it and how far each soldier stands from Piccolo (tiles).
    const start: { squad: Array<{ id: string; tiles: number }> } = { squad: [] };
    const st = await fairStats(root, (bot) => {
      const f = bot.game.field;
      if (start.squad.length || !bot.bout || !f) return;
      start.squad = f.enemies.filter((e) => !e.dead).map((e) => ({ id: e.def.id, tiles: Math.hypot(e.x - f.player.x, e.y - f.player.y) / 16 }));
    });
    expect(st.wins, `won ${st.wins}/${st.seeds}`).toBeGreaterThanOrEqual(4);
    expect(st.avgSenzu).toBeLessThanOrEqual(1.5);
    // Eight Chapter 5 soldiers, two of them officers; no T4 trooper from the Chapter 8 remnant camp.
    const ids = start.squad.map((x) => x.id);
    expect(ids).toHaveLength(8);
    expect(ids.every((id) => id.startsWith('c05_')), ids.join(',')).toBe(true);
    expect(ids.filter((id) => id === 'c05_officer')).toHaveLength(2);
    // They deploy from the flagship: nobody opens fire point-blank, the shooters walk into range.
    for (const x of start.squad) expect(x.tiles, x.id).toBeGreaterThanOrEqual(8);
  }, REPLAY_TIMEOUT);

  it('chapter 5 soldiers: an officer still out-stings a grunt, shot for shot, and fires no faster', () => {
    const grunt = ENEMIES.c05_grunt;
    const officer = ENEMIES.c05_officer;
    expect((officer.shot?.mult ?? 0) * officer.pow).toBeGreaterThan((grunt.shot?.mult ?? 0) * grunt.pow);
    expect(officer.shot?.cooldown ?? 0).toBeGreaterThanOrEqual(grunt.shot?.cooldown ?? 0);
    expect(officer.hp).toBeGreaterThan(grunt.hp);
  });
});

// ------------------------------------------------------------------------------------------------ tuned fights: act5

/**
 * Act 5 fights tuned into the LoG2 band: the fair bot wins 4/5 or more with at most 2 Senzu, and a boss's hits ratio
 * stays within LoG2's story band (4; the Chapter 14 finale 6) without turning into a walkover (1). Each story beat is
 * replayed whole on its real map from a save holding the party the full-game run brought there (levels, stats, HP,
 * forms, guests, three Senzu), so every fight keeps its context: the students and Max Power Roshi before Cabba's
 * brawl in the same script, Goku walking into the poachers' camp hurt, the assassins before Frieza's spar, and each
 * tournament relay sharing one bag of Senzu across all of its hand-offs.
 */
describe('tuned fights: act5', () => {
  type Member = { level: number; hp: number; hpMax: number; epMax: number; str: number; pow: number; end: number; form: string | null; techs: string[] };
  type Fight = Pick<RecordedFight, 'kind' | 'type' | 'opts' | 'hero' | 'level'>;
  type Who = 'goku' | 'vegeta' | 'gohan' | 'trunks' | 'piccolo' | 'android17' | 'frieza';

  const GOKU_TECHS = ['kiBlast', 'kamehameha', 'godKamehameha'];
  const VEGETA_TECHS = ['kiBlast', 'bigBang', 'galickGun'];
  const GOHAN_TECHS = ['kiBlast', 'masenko', 'kamehameha'];
  const PICCOLO_TECHS = ['kiBlast', 'specialBeamCannon', 'hellzoneGrenade'];
  /** The rest of the party as the full-game run has them through Chapters 12-14 (Trunks never leaves L35). */
  const TRUNKS: Member = { level: 35, hp: 904, hpMax: 904, epMax: 117, str: 57, pow: 38, end: 41, form: 'rage', techs: ['kiBlast', 'burningAttack', 'swordBlast'] };
  const PICCOLO: Member = { level: 24, hp: 381, hpMax: 381, epMax: 88, str: 31, pow: 37, end: 32, form: 'unweighted', techs: PICCOLO_TECHS };
  /** The tournament guests as `readyGuest` brings them in. */
  const GUESTS: Partial<Record<Who, Member>> = {
    android17: { level: 46, hp: 1998, hpMax: 1998, epMax: 160, str: 68, pow: 70, end: 67, form: null, techs: ['kiBlast', 'barrier'] },
    frieza: { level: 47, hp: 1720, hpMax: 1720, epMax: 169, str: 71, pow: 72, end: 62, form: 'goldenFrieza', techs: ['kiBlast', 'deathBeam'] },
  };
  /** The Chapter 14 party between relays (the full-game run's stats at the central ring). */
  const TOURNAMENT: Partial<Record<Who, Member>> = {
    goku: { level: 42, hp: 1235, hpMax: 1235, epMax: 138, str: 63, pow: 63, end: 51, form: 'ssb', techs: [...GOKU_TECHS, 'spiritBomb'] },
    vegeta: { level: 42, hp: 1216, hpMax: 1216, epMax: 147, str: 60, pow: 55, end: 61, form: 'ssb', techs: VEGETA_TECHS },
    gohan: { level: 42, hp: 1075, hpMax: 1075, epMax: 151, str: 68, pow: 69, end: 59, form: 'ultimate', techs: GOHAN_TECHS },
    trunks: TRUNKS, piccolo: PICCOLO, ...GUESTS,
  };

  /** A story beat (tests/sim.ts RecordedRoot) from a fresh save holding `party`, Goku active, three Senzu. */
  const beat = (
    script: string, map: string, tile: [number, number], onEnter: boolean, chapter: number, flags: string[], quests: string[],
    party: Partial<Record<Who, Member>>, fights: Fight[],
  ): RecordedRoot => {
    const st = freshState();
    st.data.chapter = chapter;
    for (const [id, m] of Object.entries(party) as Array<[Who, Member]>) {
      st.join(id, m.level);
      Object.assign(st.char(id), { ...m, ep: m.epMax, selected: 0, charged: id !== 'android17' && id !== 'frieza' });
    }
    st.data.active = 'goku';
    st.data.inv = { senzu: 3 };
    for (const f of ['_storyRun', ...flags]) st.set(f);
    for (const q of quests) st.addQuest(q);
    return {
      game: 0, script, map, x: tile[0] * 16 + 8, y: tile[1] * 16 + 14, dir: 'up', npc: null, onEnter, save: JSON.stringify(st.data),
      carrying: null, fights: fights.map((f, seq) => ({ seq, map, chapter, roster: [], result: null, ...f })),
    };
  };

  /** Five fair-bot seeds of a beat: each recorded fight's first-attempt statistics, in order. */
  const play = async (root: RecordedRoot): Promise<FightStats[]> => {
    const runs: FightRun[] = [];
    for (let seed = 1; seed <= 5; seed++) {
      const rep = await replayRoot(root, seed);
      expect(rep.errors).toEqual([]);
      runs.push(...rep.runs.filter((x) => x.attempt === 1));
    }
    return root.fights.map((f) => statsFor(runs.filter((x) => x.seq === f.seq)));
  };

  /** The band: 4/5 wins or better, at most 2 Senzu; a boss's hits ratio between 1 and the band (story 4, finale 6). */
  const inBand = (name: string, st: FightStats, band: 4 | 6 | null): void => {
    expect(st.wins, `${name}: won ${st.wins}/${st.seeds}`).toBeGreaterThanOrEqual(4);
    expect(st.avgSenzu, `${name}: Senzu per fight`).toBeLessThanOrEqual(2);
    if (band === null) return;
    const ratio = st.ratio?.ratio ?? 0;
    expect(ratio, `${name}: hits ratio`).toBeGreaterThanOrEqual(1);
    expect(ratio, `${name}: hits ratio`).toBeLessThanOrEqual(band);
  };

  const boss = (type: string, uid: string, hero: Who, level: number, extra: Partial<Fight['opts']> = {}): Fight => ({ kind: 'boss', type, opts: { uid, ...extra }, hero, level });
  const wave = (hero: Who, level: number): Fight => ({ kind: 'wave', type: '', opts: {}, hero, level });

  it('c12: Goku L37 reads Hit\'s Time-Skip on the hotel roof', async () => {
    // Hit is still Hit: he skips time in every phase, most of all once Goku starts adapting (phase 2).
    const hit = ENEMIES.c12_hit;
    const skips = (hit.boss?.phases ?? []).map((p) => p.moves.filter((m) => m === 'timeSkip').length / p.moves.length);
    for (const s of skips) expect(s).toBeGreaterThan(0);
    expect(skips[1]).toBe(Math.max(...skips));
    const root = beat('c12_roof_enter', 'c12_rooftop', [8, 16], true, 12, ['c12_hitHinted'], ['c12_hit'], {
      goku: { level: 37, hp: 906, hpMax: 906, epMax: 122, str: 56, pow: 56, end: 46, form: 'ssb', techs: GOKU_TECHS },
      vegeta: { level: 29, hp: 552, hpMax: 552, epMax: 105, str: 42, pow: 38, end: 43, form: 'ssb', techs: VEGETA_TECHS },
      trunks: TRUNKS, piccolo: PICCOLO,
    }, [boss('c12_hit', 'c12_hit1', 'goku', 37)]);
    const [hitSt] = await play(root);
    inBand('Hit', hitSt, 4);
  }, REPLAY_TIMEOUT);

  it('c13: the dojo (students, then Max Power Roshi) and Cabba\'s brawl with Caulifla\'s gang in the same script', async () => {
    // Cabba fights the gang in base form (the Super Saiyan comes after): five toughs, each worth a few combos.
    expect(['c13_gangPunk', 'c13_gangBrute', 'c13_gangSlinger'].every((id) => ENEMIES[id].hp <= 2200)).toBe(true);
    const root = beat('c13_dojo_event', 'c13_tien_dojo', [18, 23], false, 13, [], ['c13_team', 'c13_tien'], {
      goku: { level: 38, hp: 969, hpMax: 969, epMax: 125, str: 57, pow: 57, end: 47, form: 'ssb', techs: GOKU_TECHS },
      vegeta: { level: 29, hp: 552, hpMax: 552, epMax: 105, str: 42, pow: 38, end: 43, form: 'ssb', techs: VEGETA_TECHS },
      trunks: TRUNKS, piccolo: PICCOLO,
    }, [wave('goku', 38), boss('c13_roshiMax', 'c13_roshi1', 'goku', 38), wave('vegeta', 39)]);
    const [students, roshi, gang] = await play(root);
    inBand('the brainwashed students', students, null);
    inBand('Max Power Roshi', roshi, 4);
    inBand('Caulifla\'s gang (Cabba)', gang, null);
  }, REPLAY_TIMEOUT);

  it('c13: Goku L39 walks into the poachers\' camp hurt, beats their boss, then spars with Android 17', async () => {
    // The camp's riflemen run for the ship; the boss whistles up his deckhands in the second phase.
    expect(ENEMIES.c13_poacherBoss.boss?.minion).toBe('c13_poacherGrunt');
    expect(ENEMIES.c13_poacherBoss.boss?.phases[1].moves).toContain('summon');
    const root = beat('c13_camp_boss', 'c13_monster_camp', [20, 10], false, 13, [], ['c13_team', 'c13_17'], {
      goku: { level: 39, hp: 673, hpMax: 1034, epMax: 129, str: 58, pow: 59, end: 48, form: 'ssb', techs: GOKU_TECHS },
      vegeta: { level: 39, hp: 1016, hpMax: 1016, epMax: 135, str: 56, pow: 51, end: 57, form: 'ssb', techs: VEGETA_TECHS },
      gohan: { level: 40, hp: 938, hpMax: 938, epMax: 146, str: 65, pow: 66, end: 56, form: 'ultimate', techs: GOHAN_TECHS },
      trunks: TRUNKS, piccolo: PICCOLO,
    }, [boss('c13_poacherBoss', 'c13_poacherBoss1', 'goku', 39), boss('c13_17spar', 'c13_17spar1', 'goku', 39)]);
    const [poacher, seventeen] = await play(root);
    inBand('the Poacher Boss', poacher, 4);
    inBand('Android 17', seventeen, 4);
  }, REPLAY_TIMEOUT);

  it('c13: Goku L40 fights off Universe 9\'s assassins at Baba\'s lake, then spars with Golden Frieza', async () => {
    // Cabba's spar with Caulifla and berserk Kale come first in the full-game run and leave about two Senzu.
    const root = beat('c13_hell_scene', 'cc_yard', [22, 18], false, 13, ['noSwitch'], ['c13_team', 'c13_frieza'], {
      goku: { level: 40, hp: 1105, hpMax: 1105, epMax: 133, str: 59, pow: 60, end: 49, form: 'ssb', techs: GOKU_TECHS },
      vegeta: { level: 39, hp: 1016, hpMax: 1016, epMax: 135, str: 56, pow: 51, end: 57, form: 'ssb', techs: VEGETA_TECHS },
      gohan: { level: 40, hp: 938, hpMax: 938, epMax: 146, str: 65, pow: 66, end: 56, form: 'ultimate', techs: GOHAN_TECHS },
      trunks: TRUNKS, piccolo: PICCOLO,
    }, [wave('goku', 40), boss('c13_goldenFrieza', 'c13_frieza1', 'goku', 40)]);
    const [assassins, frieza] = await play({ ...root, save: JSON.stringify({ ...JSON.parse(root.save), inv: { senzu: 2 } }) });
    inBand('Universe 9\'s assassins', assassins, null);
    inBand('Golden Frieza', frieza, 4);
  }, REPLAY_TIMEOUT);

  it('c14 stage A: Gohan\'s melee, Vegeta vs the Trio, Goku vs Kahseral\'s squad and Dyspo, on one bag of Senzu', async () => {
    // Kale's rampage stays untouchable and timed; Kahseral stays sealed behind his formation.
    expect(ENEMIES.c14_kaleBerserk.boss?.vulnerableIf).toBe('c14_kaleCalm');
    expect(ENEMIES.c14_kahseral.boss?.vulnerableIf).toBe('c14_squadDown');
    const root = beat('c14_topA_enter', 'top_arena_a', [22, 19], true, 14, ['c14_departed', 'c14_opened'], ['c14_top'], {
      ...TOURNAMENT,
      goku: { level: 41, hp: 1171, hpMax: 1171, epMax: 135, str: 61, pow: 62, end: 50, form: 'ssb', techs: GOKU_TECHS },
      vegeta: { level: 39, hp: 1016, hpMax: 1016, epMax: 135, str: 56, pow: 51, end: 57, form: 'ssb', techs: VEGETA_TECHS },
      gohan: { level: 40, hp: 938, hpMax: 938, epMax: 146, str: 65, pow: 66, end: 56, form: 'ultimate', techs: GOHAN_TECHS },
    }, [
      wave('gohan', 42), wave('gohan', 42), boss('c14_bergamo', 'c14_bergamo1', 'vegeta', 42),
      boss('c14_kaleBerserk', 'c14_kale1', 'goku', 42, { survive: 25, label: 'SURVIVE' }), boss('c14_kahseral', 'c14_kahseral1', 'goku', 42),
      boss('c14_kakunsa', 'c14_kakunsa1', 'android17', 46), boss('c14_dyspoA', 'c14_dyspoA1', 'goku', 42),
      boss('c14_frost', 'c14_frost1', 'frieza', 47), boss('c14_jiren1', 'c14_jiren1', 'goku', 42, { loseOk: true }),
    ]);
    const [melee1, melee2, bergamo, , kahseral, , dyspoA] = await play(root);
    inBand('the opening melee', melee1, null);
    inBand('the second wave', melee2, null);
    inBand('Bergamo and his brothers', bergamo, 6);
    inBand('Kahseral\'s squad', kahseral, 6);
    inBand('Dyspo and K\'nsi', dyspoA, 6);
  }, REPLAY_TIMEOUT);

  it('c14 stage B: Kefla before Ultra Instinct, the Namekian twins, and Android 17 against Anilaza', async () => {
    // Kefla stays the strongest of the central ring; Anilaza is still sealed until the reactor breaks.
    expect(ENEMIES.c14_anilaza.boss?.vulnerableIf).toBe('c14_reactorDown');
    const root = beat('c14_stageB', 'top_arena_b', [12, 16], false, 14, ['c14_departed', 'c14_opened', 'c14_stageA'], ['c14_top'], {
      ...TOURNAMENT,
      goku: { level: 42, hp: 1024, hpMax: 1235, epMax: 138, str: 63, pow: 63, end: 51, form: 'ssb', techs: [...GOKU_TECHS, 'spiritBomb'] },
    }, [
      boss('c14_kefla', 'c14_kefla1', 'goku', 42), boss('c14_keflaUI', 'c14_kefla2', 'goku', 42), boss('c14_ribrianne', 'c14_ribrianne1', 'android17', 46),
      wave('gohan', 42), boss('c14_gamisalas', 'c14_gamisalas1', 'piccolo', 42, { existing: true }), boss('c14_anilaza', 'c14_anilaza1', 'android17', 46),
    ]);
    const [kefla, , , twins, , anilaza] = await play(root);
    inBand('Kefla', kefla, 6);
    inBand('Saonel and Pirina', twins, null);
    inBand('Anilaza', anilaza, 6);
  }, REPLAY_TIMEOUT);

  it('c14 stage C: Gohan outpaces Dyspo for Frieza\'s cage, and Evolved Vegeta breaks Toppo the Destroyer', async () => {
    // The Destroyer outclasses the Toppo of the Zeno Expo and Kefla, stays below Jiren, and keeps the Hakai barrage;
    // Dyspo is still the fastest boss in the game.
    const sum = (id: string) => ENEMIES[id].str + ENEMIES[id].pow + ENEMIES[id].end;
    expect(sum('c14_toppoGoD')).toBeGreaterThan(Math.max(sum('c13_toppo'), sum('c14_kefla')));
    expect(sum('c14_toppoGoD')).toBeLessThan(sum('c14_jiren2'));
    expect(ENEMIES.c14_toppoGoD.boss?.phases.flatMap((p) => p.moves)).toEqual(expect.arrayContaining(['nova', 'beam', 'rain']));
    expect(Math.max(...Object.values(ENEMIES).filter((e) => e.boss).map((e) => e.speed))).toBe(ENEMIES.c14_dyspo.speed);
    const root = beat('c14_stageC', 'top_arena_c', [9, 15], false, 14, ['c14_departed', 'c14_opened', 'c14_stageA', 'c14_stageB'], ['c14_top'], {
      ...TOURNAMENT,
      goku: { level: 43, hp: 1122, hpMax: 1304, epMax: 142, str: 64, pow: 64, end: 52, form: 'ssb', techs: [...GOKU_TECHS, 'spiritBomb'] },
      piccolo: { level: 42, hp: 1151, hpMax: 1151, epMax: 146, str: 53, pow: 61, end: 54, form: 'unweighted', techs: PICCOLO_TECHS },
    }, [
      boss('c14_dyspo', 'c14_dyspo1', 'gohan', 42), boss('c14_toppoGoD', 'c14_toppo1', 'vegeta', 42), boss('c14_jiren2', 'c14_jiren2', 'goku', 43),
      boss('c14_jiren3', 'c14_jiren3', 'frieza', 47, { loseOk: true }), boss('c14_jiren4', 'c14_jiren4', 'android17', 46, { loseOk: true }),
    ]);
    const [dyspo, toppo] = await play(root);
    inBand('Dyspo', dyspo, 6);
    inBand('Toppo, God of Destruction', toppo, 6);
  }, REPLAY_TIMEOUT);
});

// ------------------------------------------------------------------------------------------------ the report

/** Every .ts file under a directory. */
function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir) as string[]) {
    const p = `${dir}/${name}`;
    if ((statSync(p) as { isDirectory(): boolean }).isDirectory()) out.push(...sources(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

/** Content sources, read once (only the report uses them). */
function contentFiles(): Array<{ path: string; text: string }> {
  return sources(`${ROOT}/src/content`).map((p) => ({ path: p.slice(ROOT.length + 1), text: readFileSync(p, 'utf8') as string }));
}

/** The content file that starts this fight (its uid or boss type in a fight call, its wave's enemies, its script). */
function locate(files: Array<{ path: string; text: string }>, rec: RecordedFight, root: RecordedRoot): string {
  const story = files.filter((f) => !/\/(enemies|data|c13_data|c14_enemies)\.ts$/.test(f.path));
  const uid = rec.opts.uid?.split(',')[0];
  const lit = (s: string) => new RegExp(`['\`]${s}['\`]`);
  if (uid) { const f = story.find((x) => lit(uid).test(x.text)); if (f) return f.path; }
  if (rec.kind === 'boss') {
    const f = story.find((x) => new RegExp(`(fight|Fight|bout)\\((s, )?['\`]${rec.type}['\`]`).test(x.text)) ?? story.find((x) => lit(rec.type).test(x.text));
    if (f) return f.path;
  }
  // A wave: the chapter file that names the most of its enemy types (a field battle's spawn list).
  const tag = `c${String(Math.min(14, rec.chapter)).padStart(2, '0')}`;
  const kinds = [...new Set(rec.roster)];
  let best = { path: '', score: 0 };
  for (const x of story) {
    const score = kinds.filter((t) => lit(t).test(x.text)).length + (x.path.includes(`/${tag}`) ? 0.5 : 0);
    if (score > best.score) best = { path: x.path, score };
  }
  if (best.score >= 1) return best.path;
  return files.find((x) => new RegExp(`\\b${root.script}: async`).test(x.text))?.path ?? '';
}

/** 'act1'..'act5' or 'world' from a content path. */
function areaOf(path: string): FightReport['area'] {
  const m = /chapters\/(act[1-5])\//.exec(path);
  return (m ? m[1] : 'world') as FightReport['area'];
}

/**
 * Report ids of every recorded fight, keyed by `seq` (unique within a recording): the enemy type; `type@uid` when the
 * run fights that type more than once; `wave:<script>#n` for the n-th field battle of a script. Ids are taken over the
 * whole run so they do not change when LOS_ONLY narrows the report.
 */
function fightIds(roots: RecordedRoot[]): Map<number, string> {
  const recs = roots.flatMap((root) => root.fights.map((rec) => ({ rec, root })));
  const typeCount = new Map<string, number>();
  for (const { rec } of recs) if (rec.kind === 'boss') typeCount.set(rec.type, (typeCount.get(rec.type) ?? 0) + 1);
  const waveNo = new Map<string, number>();
  const ids = new Map<number, string>();
  for (const { rec, root } of recs) {
    let id = rec.type;
    if (rec.kind === 'wave') {
      const n = (waveNo.get(root.script) ?? 0) + 1;
      waveNo.set(root.script, n);
      id = `wave:${root.script}#${n}`;
    } else if ((typeCount.get(rec.type) ?? 0) > 1) id = `${rec.type}@${rec.opts.uid ?? rec.seq}`;
    ids.set(rec.seq, id);
  }
  return ids;
}

// ------------------------------------------------------------------------------------------------ every story fight

/**
 * Balance regression over every story fight, from the committed recording of a full-game run
 * (tests/fixtures/story_fights.json: each top-level story script that starts a fight, with the save it started from).
 * Each script is replayed whole on its real map by the fair bot on seeds 1-3, the first three of the report's five,
 * so a fight's numbers here are a subset of its report line and the same seeds always give the same result.
 *
 * Three seeds are a small sample: a fight the bot wins 17 times in 20 can still lose two of them. So a script with a
 * fight under 2 wins or over 2 Senzu gets a second look on seeds 4-8 (fixed seeds, so still deterministic), and that
 * fight is judged over all eight instead: at least 6 wins (75%, the report's 80% band less sampling noise) and at most
 * 2 Senzu on average. A fight that is really out of band fails either way; a sound one is not failed by two bad rolls.
 *
 * Every fight that is not exempt must, over the three seeds (all eight after a second look):
 *   - be won by the bot alone on at least 2 of them (the report's 80% band less one unlucky seed; 6 of 8);
 *   - cost at most 2 Senzu Beans on average;
 *   - for a boss, keep the critic's hits ratio (live hero stats and form, fairbot.ts `hitsRatio`) at or below LoG2's
 *     band x1.5: 6 in the story, 9 in the Chapter 14 tournament finale; and for a major boss (no spar, no optional
 *     side fight) at 1 or above, so it never turns into a walkover.
 * Each act must also win at least 85% of its non-exempt bouts on seeds 1-3.
 *
 * Exemptions (fairbot.ts `factsFor`):
 *   - scripted losses (LOSS_TOLERATED: the story continues after a knock-out, e.g. Black's toy fight, Jiren's first
 *     two meetings) and survival fights (`survive` timers such as Kale's rampage): not judged; a script made only of
 *     them is not replayed at all.
 *   - waves: no hits ratio (the ratio is a single-boss measure); wins and Senzu apply.
 *   - the post-game superbosses (Jiren, Hit): judged like the report, against the same bot's LoG2 Cooler (the hardest
 *     LoG2 fight): no win requirement (the bot wins Cooler 0/5), at most 3 Senzu, ratio at most Cooler's x1.25.
 *
 * Every recorded fight must still be reached. When a story change moves a fight (a new beat, a renamed flag) and this
 * fails with "not reached", re-record the fixture and keep only the story run:
 *   LOS_RECORD_FIGHTS=/tmp/fights.json npx vitest run tests/full_game.test.ts
 *   node -e "const a=require('/tmp/fights.json'),c={};for(const r of a)c[r.game]=(c[r.game]||0)+1;const g=+Object.keys(c).sort((x,y)=>c[y]-c[x])[0];require('fs').writeFileSync('tests/fixtures/story_fights.json',JSON.stringify(a.filter(r=>r.game===g)))"
 */
describe('every story fight (recorded run, fair bot, seeds 1-3)', () => {
  const SEEDS_REGRESSION = [1, 2, 3];
  /** Extra seeds a script gets when one of its fights misses the band on the first three (the second look). */
  const SEEDS_SECOND_LOOK = [4, 5, 6, 7, 8];
  /** Wins a judged fight needs: out of the first three seeds, and out of all eight after a second look. */
  const MIN_WINS = 2;
  const MIN_WINS_SECOND_LOOK = 6;
  const MAX_SENZU = 2;
  /** Share of an act's judged bouts the bot must win. */
  const ACT_WIN_RATE = 0.85;
  const ACTS = [
    { name: 'act 1 (prologue, chapters 1-2)', from: 0, to: 2 },
    { name: 'act 2 (chapters 3-5)', from: 3, to: 5 },
    { name: 'act 3 (chapters 6-8)', from: 6, to: 8 },
    { name: 'act 4 (chapters 9-11)', from: 9, to: 11 },
    { name: 'act 5 (chapters 12-14, post-game)', from: 12, to: 99 },
  ];

  const roots = mainRoots(JSON.parse(readFileSync(`${ROOT}/tests/fixtures/story_fights.json`, 'utf8')) as RecordedRoot[]);
  const ids = fightIds(roots);

  /** The LoG2 Cooler line the superbosses are held to: the hits ratio of LoG2's forced hero (fairbot.ts REFERENCE_BOSSES). */
  const coolerRatio = (): number => {
    registerReferenceBosses();
    const ref = REFERENCE_BOSSES.find((r) => r.id === 'bal_log2_cooler');
    if (!ref) throw new Error('LoG2 Cooler reference missing');
    const st = freshState();
    st.join(ref.hero, ref.level);
    return hitsRatio(formStats(st.char(ref.hero), ref.form), ref.def).ratio;
  };

  it('the fixture holds the whole story run: every chapter, the post-game, 90+ fights', () => {
    const chapters = new Set(roots.flatMap((r) => r.fights.map((f) => Math.min(f.chapter, 15))));
    for (let c = 0; c <= 15; c++) expect(chapters.has(c), `chapter ${c} has recorded fights`).toBe(true);
    expect(roots.reduce((n, r) => n + r.fights.length, 0)).toBeGreaterThanOrEqual(90);
    expect(new Set(roots.flatMap((r) => r.fights.map((f) => f.seq))).size, 'fight seqs are unique').toBe(roots.reduce((n, r) => n + r.fights.length, 0));
  });

  for (const act of ACTS) {
    it(`${act.name}: every fight in band`, async () => {
      const mine = roots.filter((r) => {
        const ch = r.fights[0]?.chapter ?? -1;
        return ch >= act.from && ch <= act.to && r.fights.some((f) => !factsFor(f).exempt);
      });
      expect(mine.length, 'recorded scripts in this act').toBeGreaterThan(0);
      /** Every first-attempt run of each recorded fight, with the seed it was played on. */
      const runs = new Map<number, Array<{ seed: number; run: FightRun }>>();
      const errors: string[] = [];
      /** Why a replay stopped before its last recorded fight, keyed by the fights it left unplayed. */
      const cut = new Map<number, string>();
      const play = async (root: RecordedRoot, seeds: number[]): Promise<void> => {
        for (const seed of seeds) {
          const rep = await replayRoot(root, seed);
          for (const e of rep.errors) errors.push(`${root.script} seed ${seed}: ${e.split('\n')[0]}`);
          for (const run of rep.runs) {
            if (run.attempt === 1) (runs.get(run.seq) ?? runs.set(run.seq, []).get(run.seq))?.push({ seed, run });
            if (run.result === 'unreached' && rep.stopped !== 'done') cut.set(run.seq, `${root.script} seed ${seed} stopped: ${rep.stopped}`);
          }
        }
      };
      /** A fight's statistics over the given seeds. */
      const statsOn = (seq: number, seeds: number[]): FightStats => statsFor((runs.get(seq) ?? []).filter((x) => seeds.includes(x.seed)).map((x) => x.run));
      /** A judged fight that missed the win or Senzu line on the first three seeds. */
      const shaky = (rec: RecordedFight): boolean => {
        const facts = factsFor(rec);
        if (facts.exempt || facts.superboss) return false;
        const st = statsOn(rec.seq, SEEDS_REGRESSION);
        return !st.unreached && st.seeds === SEEDS_REGRESSION.length && (st.wins < MIN_WINS || st.avgSenzu > MAX_SENZU);
      };
      for (const root of mine) await play(root, SEEDS_REGRESSION);
      const secondLook = new Set<number>();
      for (const root of mine) {
        const flagged = root.fights.filter(shaky);
        if (!flagged.length) continue;
        for (const rec of flagged) secondLook.add(rec.seq);
        await play(root, SEEDS_SECOND_LOOK);
      }
      expect([...new Set(errors)]).toEqual([]);
      const cooler = coolerRatio();
      const problems: string[] = [];
      let bouts = 0;
      let won = 0;
      for (const rec of mine.flatMap((r) => r.fights)) {
        const id = ids.get(rec.seq) ?? rec.type;
        const facts = factsFor(rec);
        const second = secondLook.has(rec.seq);
        const seeds = second ? [...SEEDS_REGRESSION, ...SEEDS_SECOND_LOOK] : SEEDS_REGRESSION;
        const st = statsOn(rec.seq, seeds);
        if (st.unreached || st.seeds < seeds.length) {
          const why = cut.get(rec.seq);
          problems.push(`${id}: reached on ${st.seeds - st.unreached}/${seeds.length} seeds`
            + (why && !why.endsWith('script over') ? ` (${why})` : ' (the script went another way: re-record the fixture, see above)'));
          continue;
        }
        if (facts.exempt) continue;
        const ratio = st.ratio?.ratio ?? 0;
        const line = `${id} (${rec.hero} L${rec.level}): won ${st.wins}/${st.seeds}, ${st.avgSenzu.toFixed(1)} Senzu, ratio ${ratio}`;
        if (facts.superboss) {
          if (st.avgSenzu > 3) problems.push(`${line}: more than 3 Senzu`);
          if (ratio > cooler * 1.25) problems.push(`${line}: ratio above LoG2 Cooler's ${cooler} x1.25`);
          continue;
        }
        const first = second ? statsOn(rec.seq, SEEDS_REGRESSION) : st;
        bouts += first.seeds;
        won += first.wins;
        const minWins = second ? MIN_WINS_SECOND_LOOK : MIN_WINS;
        if (st.capped) problems.push(`${line}: ${st.capped} seed(s) never resolved (capped)`);
        if (st.wins < minWins) problems.push(`${line}: fewer than ${minWins} wins${second ? ' (second look, seeds 1-8)' : ''}`);
        if (st.avgSenzu > MAX_SENZU) problems.push(`${line}: more than ${MAX_SENZU} Senzu`);
        if (rec.kind !== 'boss') continue;
        const cap = (facts.finale ? FINALE_BAND : STORY_BAND) * WELL_ABOVE;
        if (ratio > cap) problems.push(`${line}: ratio above ${cap}`);
        if (facts.major && ratio < 1) problems.push(`${line}: ratio below 1 (a walkover)`);
      }
      expect(problems).toEqual([]);
      expect(won / bouts, `${act.name}: ${won}/${bouts} judged bouts won`).toBeGreaterThanOrEqual(ACT_WIN_RATE);
    }, REPLAY_TIMEOUT);
  }
});

describe.skipIf(!env.LOS_FIGHTS)('balance report (LOS_FIGHTS=<recording>)', () => {
  it('replays every story fight with the fair bot and writes the report', async () => {
    const all = mainRoots(JSON.parse(readFileSync(env.LOS_FIGHTS, 'utf8')) as RecordedRoot[]);
    const only = env.LOS_ONLY;
    const roots = only ? all.filter((r) => r.script.includes(only) || r.fights.some((f) => f.type.includes(only))) : all;
    const errors: string[] = [];
    const replayAll = async (rs: RecordedRoot[], levelBonus: number): Promise<Map<number, FightRun[]>> => {
      const into = new Map<number, FightRun[]>();
      for (const root of rs) {
        for (let seed = 1; seed <= SEEDS; seed++) {
          const r = await replayRoot(root, seed, { levelBonus });
          for (const e of r.errors) errors.push(`${root.script} seed ${seed}: ${e.split('\n')[0]}`);
          for (const run of r.runs) if (run.seq >= 0 && run.attempt === 1) (into.get(run.seq) ?? into.set(run.seq, []).get(run.seq))?.push(run);
        }
      }
      return into;
    };
    const runsBySeq = await replayAll(roots, 0);

    // LoG2 calibration: the same bot against LoG2's reference bosses.
    const refStats = new Map<string, FightStats>();
    const refLines: string[] = [];
    for (const ref of REFERENCE_BOSSES) {
      const runs: FightRun[] = [];
      for (let seed = 1; seed <= SEEDS; seed++) runs.push(...(await runReference(ref, seed)).runs.filter((x) => x.seq === 0));
      const st = statsFor(runs);
      refStats.set(ref.id, st);
      refLines.push(`${ref.name} (${ref.hero} L${ref.level}${ref.form ? ` ${ref.form}` : ''}, ${ref.senzu} Senzu): won ${st.wins}/${st.seeds}`
        + `${st.kos ? ` (${st.kos} KO at boss ${Math.round(st.bossAtKo * 100)}%)` : ''}, ${st.avgSenzu.toFixed(1)} Senzu, ${st.avgSeconds.toFixed(0)} s, `
        + `ratio ${st.ratio?.ratio ?? '?'} (critic's estimate ${ref.critic})`);
    }
    const cooler = refStats.get('bal_log2_cooler');

    // Level sensitivity: how many extra levels a too-hard fight needs.
    const recs = roots.flatMap((root) => root.fights.map((rec) => ({ rec, root })));
    const firstPass = new Map(recs.map(({ rec }) => [rec.seq, statsFor(runsBySeq.get(rec.seq) ?? [])]));
    const hardRoots = [...new Set(recs.filter(({ rec }) => verdictFor(factsFor(rec), firstPass.get(rec.seq) as FightStats, cooler) === 'too hard').map((x) => x.root))];
    const bonusRuns = new Map<number, Map<number, FightRun[]>>();
    for (const k of LEVEL_STEPS) bonusRuns.set(k, await replayAll(hardRoots, k));

    // Report lines, story order.
    const files = contentFiles();
    const ids = fightIds(all);
    const fights: FightReport[] = [];
    for (const { rec, root } of recs) {
      const facts = factsFor(rec);
      const st = firstPass.get(rec.seq) as FightStats;
      const verdict = verdictFor(facts, st, cooler);
      const extra: string[] = [];
      if (verdict === 'too hard') {
        extra.push(`level sensitivity: ${LEVEL_STEPS.map((k) => {
          const s2 = statsFor(bonusRuns.get(k)?.get(rec.seq) ?? []);
          return `+${k} levels ${s2.wins}/${s2.seeds} won, ${s2.avgSenzu.toFixed(1)} Senzu`;
        }).join('; ')}`);
      }
      if (facts.superboss && cooler) extra.push(`LoG2 Cooler with the same bot: ${cooler.wins}/${cooler.seeds} won, ratio ${cooler.ratio?.ratio}`);
      if (rec.kind === 'wave') extra.push(`enemies: ${[...new Set(rec.roster)].map((t) => `${t} x${rec.roster.filter((x) => x === t).length}`).join(', ')}`);
      const fightId = ids.get(rec.seq) ?? rec.type;
      const file = locate(files, rec, root);
      fights.push({
        area: areaOf(file), chapter: rec.chapter >= 15 ? 'post' : `c${String(rec.chapter).padStart(2, '0')}`, fightId, file,
        hero: rec.hero, level: rec.level, winRate: Math.round((st.seeds ? st.wins / st.seeds : 0) * 100) / 100,
        avgSenzu: Math.round(st.avgSenzu * 100) / 100, ratio: st.ratio?.ratio ?? 0, verdict, note: noteFor(facts, st, extra),
      });
    }
    const report = {
      generated: new Date().toISOString(), seeds: SEEDS, recording: env.LOS_FIGHTS,
      harnessFiles: ['tests/fairbot.ts', 'tests/balance.test.ts', 'tests/sim.ts'],
      howToRun: 'LOS_RECORD_FIGHTS=/tmp/fights.json npx vitest run tests/full_game.test.ts && '
        + 'LOS_FIGHTS=/tmp/fights.json LOS_BALANCE_OUT=/tmp/balance_report.json npx vitest run tests/balance.test.ts '
        + '(one fight: add LOS_ONLY=<enemy type or script id>; LOS_SEEDS=<n> for more seeds)',
      method: [
        'Every fight is replayed inside the story script that starts it, from the save that script started with in a recorded full-game run: same map, party, levels, forms, techniques, HP, EP and inventory, same waves, allies and puzzles.',
        'Levels are the full-game run\'s: its bot grinds only for the story gates, so they sit at or below the docs/CONTENT_GUIDE.md curve (Goku 37-43 in chapters 12-14). Too-hard fights are re-run with every party member 3 and 6 levels higher.',
        'Senzu Beans and Fish come from the save (none before chapter 5, two or three after). Beans eaten in a fight are gone for the later fights of the same script. A fight the bot loses is finished by the test bot (HP refilled), so the next fight in that script starts healthy.',
        `Bot skill: reaction ${SKILL.reaction.join('-')} frames; sidesteps beams ${SKILL.dodgeBeam * 100}%, charges ${SKILL.dodgeCharge * 100}%, ki rain ${SKILL.dodgeRain * 100}%, shots ${SKILL.dodgeShot * 100}%, teleports ${SKILL.dodgeTeleport * 100}% of the time; Senzu below ${SKILL.healAt * 100}% HP; 3-hit strings with ${SKILL.comboPause.join('-')} frame pauses; transforms when the Z gauge is full.`,
        'winRate = seeds the bot finished alone without a knock-out. A fight it was still on after 5 minutes counts as lost; one still unresolved 2 minutes after that is closed as a capped (timeout) loss and stops its replay.',
        'Ratio = the critic\'s hits ratio (scratchpad bal.txt) from the hero\'s real stats and form; waves: melee hits to clear all / hits of the hardest hitter to KO the hero.',
        'LoG2 references: LoG2 HP, STR/POW/END and scripted ends, behaviour mapped onto this engine\'s boss moves, LoG2\'s forced hero at the critic\'s level with 2 Senzu, fought fresh and alone in an empty arena.',
      ],
      fights,
      log2Reference: refLines.join(' | '),
      counts: Object.fromEntries(['ok', 'too hard', 'too easy', 'exempt'].map((v) => [v, fights.filter((f) => f.verdict === v).length])),
      errors: [...new Set(errors)],
    };
    const out = env.LOS_BALANCE_OUT ?? `${tmpdir()}/balance_report.json`;
    writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(`[balance] ${fights.length} fights -> ${out}\n${fights.map((f) => `${f.chapter} ${f.fightId.padEnd(34)} ${f.hero.padEnd(9)} L${String(f.level).padEnd(3)} win ${f.winRate.toFixed(2)} senzu ${f.avgSenzu.toFixed(1)} ratio ${String(f.ratio).padEnd(6)} ${f.verdict}`).join('\n')}\n[balance] LoG2 reference: ${report.log2Reference}`);
    expect(fights.length).toBeGreaterThan(0);
    expect(report.errors).toEqual([]);
  }, 60 * 60 * 1000);
});

// ------------------------------------------------------------------------------------------------ tuned fights: the Zeno Expo

/**
 * The Zeno Expo (Chapter 13 opening, src/content/chapters/act5/c13_expo.ts): every bout the player fights there, played
 * by the fair bot from a save holding the party a story run brings to Chapter 13 (the recording's chapter-12 ending:
 * Goku L37 in Blue, Gohan benched at L19, Vegeta L29, Trunks L35, Piccolo L24) and the three Senzu Beans the pouch
 * holds after Chapter 12's reward. The Expo forces its fighters, which lifts Goku and Gohan to L39 (the Chapter 13 floor
 * for a forced segment); Buu fights at Goku's level in base stats. Band: 4/5 wins or better, at most 2 Senzu, hits ratio
 * between 1 and LoG2's story band (4). Toppo's bout is the existing Chapter 13 Toppo, now fought after Bergamo on the same
 * bag: it must stay winnable (a draw the Grand Priest calls), its ratio is the regression's business.
 */
describe('tuned fights: the Zeno Expo', () => {
  type Member = { level: number; hp: number; hpMax: number; epMax: number; str: number; pow: number; end: number; form: string | null; techs: string[] };
  const PARTY: Record<'goku' | 'vegeta' | 'gohan' | 'trunks' | 'piccolo', Member> = {
    goku: { level: 37, hp: 844, hpMax: 844, epMax: 125, str: 54, pow: 57, end: 47, form: 'ssb', techs: ['kiBlast', 'kamehameha', 'godKamehameha'] },
    vegeta: { level: 29, hp: 574, hpMax: 574, epMax: 110, str: 42, pow: 38, end: 42, form: 'ssb', techs: ['kiBlast', 'bigBang', 'galickGun'] },
    gohan: { level: 19, hp: 242, hpMax: 242, epMax: 74, str: 33, pow: 34, end: 29, form: 'ssj', techs: ['kiBlast', 'masenko'] },
    trunks: { level: 35, hp: 865, hpMax: 865, epMax: 120, str: 57, pow: 38, end: 40, form: 'rage', techs: ['kiBlast', 'burningAttack', 'swordBlast'] },
    piccolo: { level: 24, hp: 376, hpMax: 376, epMax: 88, str: 32, pow: 34, end: 34, form: 'unweighted', techs: ['kiBlast', 'specialBeamCannon'] },
  };

  /** The Expo from Capsule Corp (Beerus's way back in), skipping the bouts already won (`done` flags). */
  const expo = (done: string[], fights: Array<[string, string, 'goku' | 'gohan']>): RecordedRoot => {
    const st = freshState();
    st.data.chapter = 13;
    for (const [id, m] of Object.entries(PARTY) as Array<[keyof typeof PARTY, Member]>) {
      st.join(id, m.level);
      Object.assign(st.char(id), { ...m, ep: m.epMax, selected: 0, charged: true });
    }
    st.data.active = 'goku';
    st.data.inv = { senzu: 3 };
    for (const f of ['_storyRun', ...done]) st.set(f);
    return {
      game: 0, script: 'c13_expo', map: 'cc_yard', x: 22 * 16 + 8, y: 18 * 16 + 14, dir: 'up', npc: null, onEnter: false, save: JSON.stringify(st.data),
      carrying: null,
      fights: fights.map(([type, uid, hero], seq) => ({ seq, kind: 'boss', type, opts: { uid }, hero, level: 39, map: 'c13_expo', chapter: 13, roster: [], result: null })),
    };
  };

  /** Five fair-bot seeds: each recorded bout's first-attempt statistics, in order. */
  const play = async (root: RecordedRoot): Promise<FightStats[]> => {
    const runs: FightRun[] = [];
    for (let seed = 1; seed <= 5; seed++) {
      const rep = await replayRoot(root, seed);
      expect(rep.errors).toEqual([]);
      expect(rep.stopped, `seed ${seed}`).toBe('done');
      runs.push(...rep.runs.filter((x) => x.attempt === 1));
    }
    return root.fights.map((f) => statsFor(runs.filter((x) => x.seq === f.seq)));
  };

  const inBand = (name: string, st: FightStats, band: number | null): void => {
    expect(st.wins, `${name}: won ${st.wins}/${st.seeds}`).toBeGreaterThanOrEqual(4);
    expect(st.avgSenzu, `${name}: Senzu per fight`).toBeLessThanOrEqual(2);
    if (band === null) return;
    const ratio = st.ratio?.ratio ?? 0;
    expect(ratio, `${name}: hits ratio`).toBeGreaterThanOrEqual(1);
    expect(ratio, `${name}: hits ratio`).toBeLessThanOrEqual(band);
  };

  it('Buu (Goku\'s level, base stats) beats Basil through Danger Doping; forced Gohan draws with Lavender through the toxin', async () => {
    const [basil, lavender] = await play(expo([], [['c13_basil', 'c13_basil1', 'goku'], ['c13_lavender', 'c13_lavender1', 'gohan']]));
    inBand('Basil (Buu)', basil, 4);
    inBand('Lavender (Gohan, blinded)', lavender, 4);
    // Buu fights without a Z form; Gohan can use his Super Saiyan radar.
    expect(basil.form).toBeNull();
    expect(lavender.form).toBe('ssj');
  }, REPLAY_TIMEOUT);

  it('Goku beats Bergamo through both growth steps, then holds Toppo to a draw on the same bag of Senzu', async () => {
    const [bergamo, toppo] = await play(expo(['c13_expoMet', 'c13_expoOpened', 'c13_expoBuu', 'c13_expoGohan'], [
      ['c13_bergamo', 'c13_bergamo1', 'goku'], ['c13_toppo', 'c13_toppo1', 'goku'],
    ]));
    inBand('Bergamo', bergamo, 4);
    inBand('Toppo', toppo, null);
  }, REPLAY_TIMEOUT);
});

// ------------------------------------------------------------------------------------------------ Chapter 14, eps 103-107

/**
 * Tuned fights in the middle of the west-ring relay (`c14_obni.ts`, `c14_veterans.ts`), each replayed on its own on the
 * west ring from a save holding the tournament party at the levels the story gives it (Goku, Vegeta and Gohan at the
 * forced floor, L42; the guests at their join levels) and the relay's bag of three Senzu Beans: Gohan against Obni,
 * Master Roshi (a guest worn over Goku, in base form, Max Power for Ganos) against Caway, Dercori and Ganos, Tien (worn
 * over Goku) against Universe 2's snipers (Harmira in his nest, his shots bounced off Prum's mirror), and Roshi against
 * Frost and Magetta. Band: the fair bot wins at least 4 of 5 seeds with at most 2 Senzu on average, and each boss's
 * hits ratio sits between 1 and 4.
 */
describe('tuned fights: c14 west ring, eps 103-107 (Obni, Roshi, the snipers, Frost\'s trap)', () => {
  type Who = 'goku' | 'vegeta' | 'gohan' | 'trunks' | 'piccolo' | 'android17' | 'frieza';
  type Member = { level: number; hp: number; hpMax: number; epMax: number; str: number; pow: number; end: number; form: string | null; techs: string[] };
  type Fight = Pick<RecordedFight, 'kind' | 'type' | 'opts' | 'hero' | 'level'>;

  /** The full-game run's tournament party, Goku through Gohan lifted to the forced floor the relay puts them at. */
  const PARTY: Record<Who, Member> = {
    goku: { level: 42, hp: 1235, hpMax: 1235, epMax: 138, str: 63, pow: 63, end: 51, form: 'ssb', techs: ['kiBlast', 'kamehameha', 'godKamehameha'] },
    vegeta: { level: 42, hp: 1216, hpMax: 1216, epMax: 147, str: 60, pow: 55, end: 61, form: 'ssb', techs: ['kiBlast', 'bigBang', 'galickGun'] },
    gohan: { level: 42, hp: 1075, hpMax: 1075, epMax: 151, str: 68, pow: 69, end: 59, form: 'ultimate', techs: ['kiBlast', 'masenko', 'kamehameha'] },
    trunks: { level: 35, hp: 904, hpMax: 904, epMax: 117, str: 57, pow: 38, end: 41, form: 'rage', techs: ['kiBlast', 'burningAttack', 'swordBlast'] },
    piccolo: { level: 24, hp: 381, hpMax: 381, epMax: 88, str: 31, pow: 37, end: 32, form: 'unweighted', techs: ['kiBlast', 'specialBeamCannon', 'hellzoneGrenade'] },
    android17: { level: 46, hp: 1998, hpMax: 1998, epMax: 160, str: 68, pow: 70, end: 67, form: null, techs: ['kiBlast', 'barrier'] },
    frieza: { level: 47, hp: 1720, hpMax: 1720, epMax: 169, str: 71, pow: 72, end: 62, form: 'goldenFrieza', techs: ['kiBlast', 'deathBeam'] },
  };

  /** One episode run on its own on the west ring, rivals cleared, with `active` handing over to the episode's fighter. */
  const episode = (script: string, active: Who, fights: Fight[]): RecordedRoot => {
    const st = freshState();
    st.data.chapter = 14;
    for (const [id, m] of Object.entries(PARTY) as Array<[Who, Member]>) {
      st.join(id, m.level);
      Object.assign(st.char(id), { ...m, ep: m.epMax, selected: 0, charged: id !== 'android17' && id !== 'frieza' });
    }
    st.data.active = active;
    st.data.inv = { senzu: 3 };
    for (const f of ['_storyRun', 'c14_departed', 'fc_topQuiet']) st.set(f);
    st.addQuest('c14_top');
    return {
      game: 0, script, map: 'top_arena_a', x: 22 * 16 + 8, y: 16 * 16 + 14, dir: 'up', npc: null, onEnter: false, save: JSON.stringify(st.data),
      carrying: null, fights: fights.map((f, seq) => ({ seq, map: 'top_arena_a', chapter: 14, roster: [], result: null, ...f })),
    };
  };

  /** Five fair-bot seeds: each recorded fight's first-attempt statistics, in order. */
  const play = async (root: RecordedRoot): Promise<FightStats[]> => {
    const runs: FightRun[] = [];
    for (let seed = 1; seed <= 5; seed++) {
      const rep = await replayRoot(root, seed);
      expect(rep.errors).toEqual([]);
      expect(rep.stopped, `${root.script} seed ${seed}`).toBe('done');
      runs.push(...rep.runs.filter((x) => x.attempt === 1));
    }
    return root.fights.map((f) => statsFor(runs.filter((x) => x.seq === f.seq)));
  };

  const inBand = (name: string, st: FightStats, boss: boolean): void => {
    expect(st.wins, `${name}: won ${st.wins}/${st.seeds}`).toBeGreaterThanOrEqual(4);
    expect(st.avgSenzu, `${name}: Senzu per fight`).toBeLessThanOrEqual(2);
    if (!boss) return;
    const ratio = st.ratio?.ratio ?? 0;
    expect(ratio, `${name}: hits ratio`).toBeGreaterThanOrEqual(1);
    expect(ratio, `${name}: hits ratio`).toBeLessThanOrEqual(4);
  };

  const boss = (type: string, uid: string, hero: Who): Fight => ({ kind: 'boss', type, opts: { uid }, hero, level: PARTY[hero].level });
  const wave = (hero: Who): Fight => ({ kind: 'wave', type: '', opts: {}, hero, level: PARTY[hero].level });

  it('ep 103: Gohan L42 in his Ultimate form knocks out Obni through the afterimages', async () => {
    expect(ENEMIES.c14_obni.boss?.minion).toBe('c14_obniImage');
    const [obni] = await play(episode('c14_obni', 'android17', [boss('c14_obni', 'c14_obni1', 'gohan')]));
    inBand('Obni', obni, true);
  }, REPLAY_TIMEOUT);

  it('ep 105: Master Roshi (Goku L42 underneath) outfoxes Caway and Dercori, then beats Ganos at Max Power', async () => {
    const [pair, ganos] = await play(episode('c14_roshi', 'goku', [wave('goku'), boss('c14_ganos', 'c14_ganos1', 'goku')]));
    inBand('Caway and Dercori', pair, false);
    inBand('Ganos', ganos, true);
  }, REPLAY_TIMEOUT);

  it('ep 106: Tien (Goku L42 underneath) traces the sniper\'s shots past Prum\'s mirror to his nest, then wears Harmira down', async () => {
    expect(ENEMIES.c14_prum.invulnerable).toBe(true);
    const [harmira] = await play(episode('c14_snipers', 'goku', [boss('c14_harmira', 'c14_harmira1', 'goku')]));
    inBand('Prum and Harmira', harmira, true);
  }, REPLAY_TIMEOUT);

  it('ep 107: Master Roshi makes Frost drop Vegeta\'s jar with Magetta at his back', async () => {
    const [frost] = await play(episode('c14_frostTrap', 'goku', [boss('c14_frostJar', 'c14_frostJar1', 'goku')]));
    inBand('Frost (the jar)', frost, true);
  }, REPLAY_TIMEOUT);

  it('the whole west-ring relay, eps 97-111, on the one bag of three Senzu the party brings: the new episodes fit in it', async () => {
    // Stage A from the top (the west ring's onEnter), Goku, Vegeta and Gohan at the levels the full-game run arrives
    // with (the forced fighters are lifted to the floor as the relay hands over), every fight of the relay recorded.
    const arrival: Partial<Record<Who, Partial<Member>>> = {
      goku: { level: 41, hp: 1171, hpMax: 1171, epMax: 135, str: 61, pow: 62, end: 50 },
      vegeta: { level: 39, hp: 1016, hpMax: 1016, epMax: 135, str: 56, pow: 51, end: 57 },
      gohan: { level: 40, hp: 938, hpMax: 938, epMax: 146, str: 65, pow: 66, end: 56 },
    };
    const st = freshState();
    st.data.chapter = 14;
    for (const [id, m] of Object.entries(PARTY) as Array<[Who, Member]>) {
      const a = { ...m, ...arrival[id] };
      st.join(id, a.level);
      Object.assign(st.char(id), { ...a, ep: a.epMax, selected: 0, charged: id !== 'android17' && id !== 'frieza' });
    }
    st.data.active = 'goku';
    st.data.inv = { senzu: 3 };
    for (const f of ['_storyRun', 'c14_departed', 'c14_opened']) st.set(f);
    st.addQuest('c14_top');
    const fights: Fight[] = [
      wave('gohan'), wave('gohan'), boss('c14_bergamo', 'c14_bergamo1', 'vegeta'),
      { ...boss('c14_kaleBerserk', 'c14_kale1', 'goku'), opts: { uid: 'c14_kale1', survive: 25, label: 'SURVIVE' } },
      boss('c14_kahseral', 'c14_kahseral1', 'goku'), boss('c14_kakunsa', 'c14_kakunsa1', 'android17'),
      boss('c14_obni', 'c14_obni1', 'gohan'), boss('c14_dyspoA', 'c14_dyspoA1', 'goku'),
      wave('goku'), boss('c14_ganos', 'c14_ganos1', 'goku'), boss('c14_harmira', 'c14_harmira1', 'goku'), boss('c14_frostJar', 'c14_frostJar1', 'goku'),
      boss('c14_frost', 'c14_frost1', 'frieza'), { ...boss('c14_jiren1', 'c14_jiren1', 'goku'), opts: { uid: 'c14_jiren1', loseOk: true } },
    ];
    const relay: RecordedRoot = {
      game: 0, script: 'c14_topA_enter', map: 'top_arena_a', x: 22 * 16 + 8, y: 19 * 16 + 14, dir: 'up', npc: null, onEnter: true,
      save: JSON.stringify(st.data), carrying: null, fights: fights.map((f, seq) => ({ seq, map: 'top_arena_a', chapter: 14, roster: [], result: null, ...f })),
    };
    const runs: FightRun[] = [];
    let clean = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const rep = await replayRoot(relay, seed);
      expect(rep.errors).toEqual([]);
      expect(rep.stopped, `seed ${seed}`).toBe('done');
      const first = rep.runs.filter((x) => x.attempt === 1);
      // The relay plays exactly these fourteen fights, in this order.
      expect(first.map((x) => x.seq), `seed ${seed}`).toEqual(fights.map((_, k) => k));
      if (!first.some((x) => x.ko || x.assisted)) clean++;
      runs.push(...first);
    }
    // The relay as a whole gets through on the one bag without a knockout on at least 4 of 5 seeds, and each new
    // episode is won on at least 4 of 5 seeds in it.
    expect(clean, 'relays cleared without a knockout').toBeGreaterThanOrEqual(4);
    const named: Array<[number, string]> = [[6, 'Obni'], [8, 'Caway and Dercori'], [9, 'Ganos'], [10, 'Harmira'], [11, 'Frost (the jar)']];
    for (const [seq, name] of named) {
      const st2 = statsFor(runs.filter((x) => x.seq === seq));
      expect(st2.wins, `${name} in the relay: won ${st2.wins}/${st2.seeds}`).toBeGreaterThanOrEqual(4);
    }
  }, REPLAY_TIMEOUT);
});

// ------------------------------------------------------------------------------------------------ Chapter 12, ep 68

/**
 * "Whose Wish?" (ep 68, `c12_wish.ts`): Goku goes down to the Earth's core in Bulma's heat suit. Replayed from a save
 * holding the party the full-game run has in Chapter 12 (Goku L37 in Super Saiyan Blue, as on Hit's roof) and a bag of
 * three Senzu Beans:
 * - the guardian, the Mantle Wyrm, on the heart's arena (the suit's coolant is paused for the fight). Band: the fair bot
 *   wins at least 4 of 5 seeds with at most 2 Senzu on average, hits ratio between 1 and 4 (Hit's band).
 * - the mantle tunnels as a grind zone, with the heat running: the fair bot clears every regular enemy from the pod
 *   (critic round 2, gap 1: a grind zone costs no knock-out and at most one Senzu at the level the story gives).
 */
describe('tuned fights: Chapter 12, the Earth\'s core (ep 68)', () => {
  type Member = { level: number; hp: number; hpMax: number; epMax: number; str: number; pow: number; end: number; form: string | null; techs: string[] };
  type Fight = Pick<RecordedFight, 'kind' | 'type' | 'opts' | 'hero' | 'level'>;
  const PARTY: Record<'goku' | 'vegeta' | 'trunks' | 'piccolo', Member> = {
    goku: { level: 37, hp: 906, hpMax: 906, epMax: 122, str: 56, pow: 56, end: 46, form: 'ssb', techs: ['kiBlast', 'kamehameha', 'godKamehameha'] },
    vegeta: { level: 29, hp: 552, hpMax: 552, epMax: 105, str: 42, pow: 38, end: 43, form: 'ssb', techs: ['kiBlast', 'bigBang', 'galickGun'] },
    trunks: { level: 35, hp: 904, hpMax: 904, epMax: 117, str: 57, pow: 38, end: 41, form: 'rage', techs: ['kiBlast', 'burningAttack', 'swordBlast'] },
    piccolo: { level: 24, hp: 381, hpMax: 381, epMax: 88, str: 31, pow: 37, end: 32, form: 'unweighted', techs: ['kiBlast', 'specialBeamCannon', 'hellzoneGrenade'] },
  };
  /** The grind-zone check: the regular enemies of the mantle tunnels as one free-roam wave. */
  const CLEAR = 'bal_c12_mantleClear';
  registerScripts({ [CLEAR]: async (s) => { await s.clearEnemies(); } });

  /** A beat on a core map with the episode open and Goku in his heat suit (forced, as the drill pod leaves him). */
  const core = (script: string, map: string, tile: [number, number], fights: Fight[]): RecordedRoot => {
    const st = freshState();
    st.data.chapter = 12;
    for (const [id, m] of Object.entries(PARTY) as Array<[keyof typeof PARTY, Member]>) {
      st.join(id, m.level);
      Object.assign(st.char(id), { ...m, ep: m.epMax, selected: 0, charged: true });
    }
    st.char('goku').outfit = 'c12_heatSuit';
    st.data.active = 'goku';
    st.data.inv = { senzu: 3 };
    for (const f of ['_storyRun', 'noSwitch', 'c12_coreIntro']) st.set(f);
    st.addQuest('c12_days');
    st.addQuest('c12_wish');
    return {
      game: 0, script, map, x: tile[0] * 16 + 8, y: tile[1] * 16 + 14, dir: 'down', npc: null, onEnter: false, save: JSON.stringify(st.data),
      carrying: null, fights: fights.map((f, seq) => ({ seq, map, chapter: 12, roster: [], result: null, ...f })),
    };
  };

  /** Five fair-bot seeds: each recorded fight's first-attempt statistics, in order. */
  const play = async (root: RecordedRoot): Promise<FightStats[]> => {
    const runs: FightRun[] = [];
    for (let seed = 1; seed <= 5; seed++) {
      const rep = await replayRoot(root, seed);
      expect(rep.errors).toEqual([]);
      expect(rep.stopped, `${root.script} seed ${seed}`).toBe('done');
      runs.push(...rep.runs.filter((x) => x.attempt === 1));
    }
    return root.fights.map((f) => statsFor(runs.filter((x) => x.seq === f.seq)));
  };

  it('Goku L37 in Super Saiyan Blue beats the Mantle Wyrm guarding the core alloy', async () => {
    // Its second phase calls magma slimes up out of the lava (they burst when beaten).
    expect(ENEMIES.c12_mantleWyrm.boss?.minion).toBe('c12_magmaSlime');
    expect(ENEMIES.c12_mantleWyrm.boss?.endAt).toBe(0);
    const [wyrm] = await play(core('c12_wyrm_fight', 'c12_core_heart', [15, 10], [
      { kind: 'boss', type: 'c12_mantleWyrm', opts: { uid: 'c12_wyrm1' }, hero: 'goku', level: 37 },
    ]));
    expect(wyrm.wins, `the Mantle Wyrm: won ${wyrm.wins}/${wyrm.seeds}`).toBeGreaterThanOrEqual(4);
    expect(wyrm.avgSenzu, 'the Mantle Wyrm: Senzu per fight').toBeLessThanOrEqual(2);
    expect(wyrm.ratio?.ratio ?? 0, 'the Mantle Wyrm: hits ratio').toBeGreaterThanOrEqual(1);
    expect(wyrm.ratio?.ratio ?? 0, 'the Mantle Wyrm: hits ratio').toBeLessThanOrEqual(4);
  }, REPLAY_TIMEOUT);

  it('the mantle tunnels are a place to level, not a Senzu sink: Goku L37 clears them with the heat running', async () => {
    const [mantle] = await play(core(CLEAR, 'c12_core_mantle', [7, 6], [{ kind: 'wave', type: '', opts: {}, hero: 'goku', level: 37 }]));
    expect(mantle.kos, 'mantle tunnels: knock-outs').toBe(0);
    expect(mantle.wins, `mantle tunnels: cleared ${mantle.wins}/${mantle.seeds}`).toBe(mantle.seeds);
    expect(mantle.avgSenzu, 'mantle tunnels: Senzu per clear').toBeLessThanOrEqual(1);
  }, REPLAY_TIMEOUT);
});

// ------------------------------------------------------------------------------------------------ grind zones

// The free-roam grind zones (critic round 2, gap 1) are held in tests/grind.test.ts: every hostile zone at the stage
// it opens, cleared by the fair bot on seeds 1-3 from the committed recording, against one rule with documented
// exemptions (no knock-out, at most one Senzu a clear, LoG2's per-enemy band, the tuned spawn mix in reach, LoG2's
// levelling pace), and every story gate ground from its arrival level. The per-act checks the zone retune added here
// were folded into that sweep.
