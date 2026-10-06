import { describe, expect, it } from 'vitest';
// @ts-expect-error -- Node built-ins; the project ships no @types/node (this file reads the recording and writes the report).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { STORY_GATES, type StoryGate } from '../src/content/chapters/common';
import type { CharId } from '../src/content/characters';
import { ENEMIES, registerEnemies, type EnemyDef } from '../src/content/enemies';
import { MAPS, registerMaps, resolveMap } from '../src/content/registry';
import { TILE } from '../src/engine/constants';
import { Rng } from '../src/engine/math';
import { damage, ENEMY_POWER, EXP_TABLE, MELEE_POWER } from '../src/game/leveling';
import { GameState } from '../src/game/state';
import {
  clearZone, formStats, type HitsRatio, LOG2_ENTRY, LOG2_FOES, LOG2_SPAWNS, LOG2_ZONES, log2EnemyDef, log2Save, log2Spawns, type Log2Zone,
  mainRoots, mobAttack, mobRatio, type RatioHero, registerLog2Zones, type ZoneClear, zoneEntries,
} from './fairbot';
import { type RecordedRoot, Sim } from './sim';

/**
 * Free-roam grind balance (critic round 2, gap 1): can a person grind the hostile zones the way LoG2 is played?
 *
 * The story-fight suite (tests/balance.test.ts) never walks into a hostile zone to fight its regular enemies for EXP,
 * LoG2's core loop; the full-game test grinds its story gates with 255-power hits at full HP. `clearZone`
 * (tests/fairbot.ts) puts the FairBot on a map with the save a player has when that zone first opens, spawns its
 * enemies as the game does for that save, and has it clear every enemy reachable on foot, nearest walk first, through
 * real input and real damage both ways.
 *
 * What runs in the default suite (about 25 s of test time):
 *   - harness checks: the attack stat a mob hits with, the LoG2 reference data against the ROM tables, entry points,
 *     knock-out counting and a real zone clear;
 *   - the zone sweep: every hostile map with spawns, at the stage each of its spawn mixes opens (`ZONE_STAGES`), cleared
 *     on seeds 1-3 (deterministic: pinned saves, seeded clears) and held to `RULE` with the stage's documented
 *     exemptions;
 *   - the story gates: each coloured gate on the story path (src/content/chapters/common.ts STORY_GATES) ground with
 *     the fair bot from the level its character arrives with to the gate's level, in the gate's own zones, and held to
 *     LoG2's "a few minutes of play" (`GATE_MINUTES`).
 *
 * The saves come from a recording of the story run, the committed one (tests/fixtures/story_fights.json) unless
 * LOS_ZONE_FIGHTS names another. LOS_GRIND_SEEDS=1,2,3,4,5,6 widens the seeds (thresholds are means over the seeds).
 * The full report adds LoG2's own zones and gates (ROM stats and placements, LoG2's hero at that stage) as the
 * reference, and writes JSON:
 *
 *   LOS_RECORD_FIGHTS=/tmp/fights.json npx vitest run tests/full_game.test.ts -t "plays every chapter"
 *   LOS_ZONE_FIGHTS=/tmp/fights.json LOS_ZONE_REPORT=/tmp/zone_report.json npx vitest run tests/grind.test.ts
 *
 * LOS_ZONE_ONLY=<map> limits the report to the stages of one map. Per zone it reports, over the zone's enemy types (hero
 * in form when the hero has one), the median melee hits to kill and enemy hits to knock the hero out (fairbot.ts
 * `mobRatio`: the critic's formula with each mob's real attack stat), and over the seeds the knock-outs, Senzu, clear
 * time, EXP per minute and minutes of clearing per level, with the enemy types furthest out of LoG2's band. Verdicts
 * follow the task's rule:
 *   - too hard: any knock-out on average, more than 1 Senzu per clear, over 10 hits to kill or under 12 hits to KO;
 *   - too easy: under 3 hits to kill with over 40 hits to KO;
 *   - otherwise ok.
 */

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const RESEARCH = `${ROOT}/../research/rom`;

/** Seeds per zone (LOS_GRIND_SEEDS widens them for a probe). */
const SEEDS = (env.LOS_GRIND_SEEDS ?? '1,2,3').split(',').map(Number).filter((n) => Number.isFinite(n) && n > 0);
/** Vitest timeout for a test that clears zones (each clear takes 0.1-2 s of test time on an idle machine). */
const CLEAR_TIMEOUT = 180000;
/** RNG seed of every save this file builds or re-levels. */
const SAVE_SEED = 0x6d1e5eed;

/** LoG2's band for ordinary mid/late-game enemies (critic round 2): hits to kill at most, hits to KO at least. */
const LOG2_KILL_MAX = 8;
const LOG2_KO_MIN = 15;

/**
 * The rule every zone stage is held to, means over the seeds. The zone-wide part is the task's verdict rule; the
 * per-type part keeps any one enemy from being a wall inside an otherwise fine zone.
 *   - knock-outs per clear at most `kos`, Senzu per clear at most `senzu`;
 *   - median hits to kill at most `killMedian`, median hits to KO at least `koMedian`, and not a walkover (`easyKill`
 *     with `easyKO`);
 *   - every enemy type: at most `typeKill` hits to kill and at least `typeKO` hits to KO (`earlyKO` for a hero at
 *     `earlyLevel` or below: LoG2's East District wolves knock Gohan L3 out in 9 hits, its jungle's Kuma Mercenaries
 *     Piccolo L10 in 7). A stage's `heavy` types are its one big-bodied enemy, as most LoG2 zones keep one (ROM: the
 *     Snowy Highlands wolf takes 6 hits to kill and knocks Goku L35 out in 4; East District's Destroyer takes 22 / 10;
 *     the T-Rex outside Gingertown 16 / 8): those are held to LoG2's own extremes, `heavyKill` / `heavyKO`;
 *   - at least `cleared` of three seeds cleared to the last enemy, and never more than `left` enemies left on a seed
 *     (a bot that steers itself into a corner now and then is the bot's problem, not the zone's);
 *   - `pace`: minutes of clearing per level at the arrival level, at most LoG2's slowest zone (3.4 for Goku L40 in
 *     the late Northern Wastelands) with some room. A zone that pays too little EXP for its stage fails here.
 */
const RULE = {
  kos: 0, senzu: 1, killMedian: 10, koMedian: 12, easyKill: 3, easyKO: 40,
  typeKill: 10, typeKO: 12, earlyKO: 9, earlyLevel: 11, heavyKill: 25, heavyKO: 4,
  cleared: 2 / 3, left: 2, pace: 5,
};

/**
 * Fair-bot minutes a story gate may cost from the level its character arrives with: LoG2's gates took a few minutes of
 * play each (its Piccolo 25 gate costs this bot about 4 minutes of the Northern Mountains, the report shows).
 */
const GATE_MINUTES = { min: 2, max: 12 };
/**
 * Story gates held to a shorter grind, with why. Chapter 3's is the first gate, the one that teaches switching heroes at
 * a save point: LoG2's counterpart, Piccolo 10, costs nothing (Piccolo joins at L10), and this one may not ask for more
 * than L15, the band Vegeta plays Chapter 4 in (CHAPTER_MIN_LEVEL[4], checked in tests/full_game.test.ts).
 */
const GATE_SHORT: Record<string, { min: number; why: string }> = {
  c03_g_castle: { min: 1, why: 'the switching tutorial (LoG2 Piccolo 10), capped by the Chapter 4 band start' },
};
/** Re-entering a zone for fresh spawns (LoG2 respawns a map on re-entry): walk out at the nearest exit and back. */
const REENTRY_SECONDS = 20;

// ------------------------------------------------------------------------------------------------ stages

type Area = 'act1' | 'act2' | 'act3' | 'act4' | 'act5' | 'worldA' | 'worldB' | 'worldC';

/**
 * One hostile map at the moment the player first gets to fight there: which recorded story script's starting save
 * stands for that moment (`from`: script id, optionally the chapter it ran in; 'post' = the save right after the
 * credits), the hero who walks in (default: that save's active hero) and at what level (default: theirs), and flags
 * that select the spawn mix (a chapter's own enemies).
 */
interface ZoneStage {
  area: Area;
  map: string;
  /** Chapter number, or 'post' for the post-game. */
  chapter: string;
  from: { script: string; chapter?: number } | 'post';
  hero?: CharId;
  level?: number;
  flags?: string[];
  /** Spawn mix label when a map has more than one stage. */
  mix?: string;
  /** Why this save / hero / level stands for the zone's opening. */
  why: string;
  /** The regular enemies in reach of the entry: the spawn mix the zone was tuned with (every seed). */
  spawns: Record<string, number>;
  /** The stage's heavyweight types (see RULE), each with the LoG2 enemy that stands behind it. */
  heavy?: Record<string, string>;
}

const C03 = { script: 'c03_mk2_ambush' };
const C10 = { script: 'c10_chief_talk' };
const C11 = { script: 'c11_showdown' };
const C12 = { script: 'c12_roof_enter' };
const C13_END = { script: 'act5_beerus_talk', chapter: 13 };
const C14_A = { script: 'act5_beerus_talk', chapter: 14 };
const C14_B = { script: 'c14_stageB' };

/** The late-tier wolf of the snow and the Paozu Highlands (src/content/bestiary.ts): HP trimmed by the engine, STR kept. */
const DIRE_WOLF = { direWolf: 'LoG2\'s Snowy Highlands wolf (ROM 104: 1000 HP, STR 65), which knocks Goku L35 out in 4 hits' };
/** LoG2's red Destroyer ported verbatim (ROM 33), a lone guard of Future Earth's ruins in Chapter 11. */
const RED_MECH = { redMech: 'LoG2\'s Destroyer (ROM 33, verbatim), 22 hits to kill and 10 to KO for Goku L35 in LoG2\'s East District' };
/** The Universe 4 roamer keeps the HP of Universe 4's set pieces (tests/chapters/act5.test.ts). */
const U4 = { c14_u4Fighter: 'the stage\'s big-bodied fighter, as LoG2\'s Mushroom Cavern keeps its Destroyer (20 hits to kill for Goku L45)' };

/** Every hostile map with spawns, at the stage each of its spawn mixes opens (dev maps excluded). */
const ZONE_STAGES: ZoneStage[] = [
  // Act 1: Prologue, Chapters 1-2.
  { area: 'act1', map: 'c00_tunnel', chapter: '0', from: { script: 'c00_locker' }, why: 'Prologue supply run, Trunks L6', spawns: { c00_rat: 3, c00_scavDrone: 1 } },
  { area: 'act1', map: 'c00_depot', chapter: '0', from: { script: 'c00_locker' }, why: 'Prologue depot, Trunks L6', spawns: { c00_rat: 2, c00_scavDrone: 2, c00_sentry: 1 } },
  { area: 'act1', map: 'c01_shrine', chapter: '1', from: { script: 'c01_shrine_pray' }, why: 'behind the Goku L2 tutorial gate', spawns: { caveBat: 3, snake: 2 } },
  {
    area: 'act1', map: 'c01_hotspring', chapter: '1', from: { script: 'c01_scarface' }, why: 'door off Mt. Paozu peaks, open from Chapter 1 (Goku L4 on the peaks)',
    spawns: { hawk: 1, snake: 2, wolf: 2 },
  },
  { area: 'act1', map: 'c02_hold', chapter: '2', from: { script: 'c02_hold_vault' }, why: 'cruise-ship hold, Vegeta forced', spawns: { c02_gangDrone: 1, c02_guardBot: 3, drone: 2 } },
  // Act 2: Chapters 3-5.
  {
    area: 'act2', map: 'c03_pilaf_vault', chapter: '3', from: C03, hero: 'goku', level: 11, why: 'Dragon Ball hunt, Goku L11 (Chapter 3 hand-over)',
    spawns: { drone: 2, pilafRobot: 2 },
  },
  {
    area: 'act2', map: 'c04_whis_field', chapter: '4', from: { script: 'c04_fieldWhis_talk' }, why: 'Whis\'s training field, Vegeta L15',
    spawns: { c04_critter: 1, c04_mossCalf: 1, c04_puffChick: 2 },
  },
  // Act 3: Chapters 6-8.
  {
    area: 'act3', map: 'c07_nameless_rim', chapter: '7', from: { script: 'c07_b_vegeta_talk' }, hero: 'piccolo', level: 20, why: 'Piccolo 25 story gate grind zone; Piccolo arrives L20',
    spawns: { c07_debrisCrawler: 4, c07_debrisGolem: 3, c07_rockWisp: 3 },
  },
  {
    area: 'act3', map: 'c08_potaufeu_mushrooms', chapter: '8', from: { script: 'c08_boys' }, why: 'Potaufeu, Vegeta L26',
    spawns: { c08_gooBlob: 2, c08_gooHench: 3, c08_sporeBeetle: 4, c08_stalkSerpent: 1 },
  },
  // Act 4: Chapters 9-11.
  {
    area: 'act4', map: 'c09_mine', chapter: '9', from: { script: 'c09_vegeta_talk' }, hero: 'trunks', level: 30, why: 'Trunks 33 story gate grind zone; Trunks arrives L30',
    spawns: { c09_crystalBat: 4, c09_haywireMech: 2, c09_mineDrone: 3, c09_rockCrawler: 2 },
  },
  { area: 'act4', map: 'c10_babari', chapter: '10', from: C10, why: 'Planet Babari, Goku L31', spawns: { c10_babariBeast: 3, c10_babarian: 4, c10_babarianSlinger: 2 } },
  {
    area: 'act4', map: 'c10_lair', chapter: '10', from: C10, hero: 'goku', level: 33, why: 'Goku 35 story gate grind zone (with the future city); Goku arrives L33',
    spawns: { c10_mutantHound: 4, c10_scrapMech: 1 },
  },
  { area: 'act4', map: 'c11_rift_sky', chapter: '11', from: C11, why: 'the rift, Trunks L34', spawns: { c11_blackClone: 2, c11_roseClone: 2 } },
  // Act 5: Chapters 12-14 and the post-game.
  {
    area: 'act5', map: 'c12_pan_meadow', chapter: '12', from: { script: 'c12_videl_meadow' }, why: 'Pan\'s meadow, Goku L37',
    spawns: { c12_ironBoar: 2, direWolf: 2, stormPtero: 2 }, heavy: DIRE_WOLF,
  },
  { area: 'act5', map: 'c12_forest', chapter: '12', from: C12, why: 'Days of Peace episode, Goku L35 (Chapter 12 floor)', spawns: { c12_shadeWolf: 4, giantSnake: 1 } },
  {
    area: 'act5', map: 'c12_core_mantle', chapter: '12', from: C12, why: 'Earth\'s core episode, Goku L35',
    spawns: { c12_cinderBat: 2, c12_crustCrab: 2, c12_lavaSerpent: 2, c12_magmaSlime: 3 },
  },
  {
    area: 'act5', map: 'c13_monster_jungle', chapter: '13', from: { script: 'c13_gohanL_talk' }, hero: 'gohan', level: 39, why: 'Gohan 41 story gate grind zone; Gohan arrives L39',
    spawns: { c13_jungleRaptor: 3, c13_mossBoar: 2, c13_poacher: 2, c13_poacherBrute: 1, c13_poacherDrone: 1 },
  },
  {
    area: 'act5', map: 'c13_monster_camp', chapter: '13', from: { script: 'c13_camp_boss' }, why: 'poacher camp, Goku L40',
    spawns: { c13_poacher: 3, c13_poacherBrute: 2, c13_poacherDrone: 2 },
  },
  {
    area: 'act5', map: 'c13_training_wilds', chapter: '13', from: { script: 'c13_gohanL_talk' }, hero: 'gohan', level: 39, why: 'Gohan\'s training ground, Gohan L39',
    spawns: { direWolf: 2, redRaptor: 2 }, heavy: DIRE_WOLF,
  },
  { area: 'act5', map: 'c13_baba_lake', chapter: '13', from: C13_END, why: 'Baba\'s lake before the tournament, Goku L41', spawns: { giantSnake: 2 } },
  { area: 'act5', map: 'c13_sadala_crags', chapter: 'post', from: 'post', why: 'post-game Sadala, credits save', spawns: { c13_cragHound: 3, c13_sadalaPtero: 2 } },
  // World A: Mt. Paozu, Kame House, the Lookout.
  {
    area: 'worldA', map: 'paozu_forest', chapter: '1', from: { script: 'c01_shrine_pray' }, why: 'first hostile zone, Goku L2 (the L2 gate tutorial)',
    spawns: { caveBat: 3, crab: 2, hawk: 2, slime: 2, snake: 3, wolf: 3 },
  },
  { area: 'worldA', map: 'paozu_peaks', chapter: '1', from: { script: 'c01_scarface' }, why: 'Mt. Paozu peaks, Goku L4', spawns: { crab: 3, hawk: 3, hornet: 2, wolf: 2 } },
  {
    area: 'worldA', map: 'kame_reef', chapter: '3', from: C03, hero: 'goku', level: 11, why: 'Kame House unlocked at the end of Chapter 2; Goku L11',
    spawns: { crab: 5, ea_tideSlime: 2, viper: 2 },
  },
  {
    area: 'worldA', map: 'korin_base', chapter: '3', from: C03, hero: 'goku', level: 11, why: 'the Lookout unlocked in Chapter 3; Goku L11',
    spawns: { bear: 1, beetle: 2, crab: 2, hawk: 2, hornet: 1, snake: 3, viper: 2 },
  },
  // World B: Diablo Desert, the Rocky Wasteland, the Snowy Highlands.
  {
    area: 'worldB', map: 'desert_entry', chapter: '3', from: C03, hero: 'vegeta', level: 12, why: 'Vegeta 15 story gate grind zone; Vegeta arrives L12',
    spawns: { bandit: 3, banditBrute: 2, sandSnake: 2, scarab: 1 },
  },
  {
    area: 'worldB', map: 'desert_oasis', chapter: '3', from: C03, hero: 'vegeta', level: 12, why: 'Vegeta 15 story gate grind zone; Vegeta arrives L12',
    spawns: { bandit: 3, banditBrute: 3, hawk: 1, kingCrab: 1, sandSnake: 3, scarab: 1, viper: 2 },
    heavy: { kingCrab: 'LoG2\'s Alligator (ROM 1, verbatim), the pond\'s Fish carrier; LoG2\'s Northern Mountains snake takes 11 hits and knocks Piccolo L22 out in 7' },
  },
  {
    area: 'worldB', map: 'pilaf_castle_out', chapter: '3', from: C03, hero: 'vegeta', level: 12, why: 'the gate\'s courtyard; Vegeta arrives L12',
    spawns: { bandit: 1, banditBrute: 1, greenDrone: 2, pilafRobot: 2 },
  },
  { area: 'worldB', map: 'pilaf_castle_in', chapter: '3', from: C03, hero: 'vegeta', level: 15, why: 'behind the Vegeta 15 gate', spawns: { greenDrone: 3, pilafRobot: 6 } },
  { area: 'worldB', map: 'waste_entry', chapter: '5', from: { script: 'c05_wave1' }, why: 'Resurrection F, Gohan L16 forced', spawns: { boar: 2, hawk: 2, raptor: 2, timberWolf: 3 } },
  {
    area: 'worldB', map: 'waste_canyon', chapter: '5', from: { script: 'c05_wave2' }, why: 'Resurrection F, Gohan L16 forced',
    spawns: { boar: 2, pterodactyl: 2, raptor: 2, sabertooth: 1, timberWolf: 2 },
  },
  {
    area: 'worldB', map: 'waste_mesa', chapter: '5', from: { script: 'c05_wave3' }, mix: 'wildlife', why: 'Resurrection F, Piccolo L18',
    spawns: { greyBear: 1, pterodactyl: 2, raptor: 3, sabertooth: 2 },
  },
  {
    area: 'worldB', map: 'waste_mesa', chapter: '8', from: { script: 'c08_boys' }, mix: 'Frieza Force stragglers (chapter>=8)', why: 'Chapter 8 hero Vegeta L26',
    spawns: { greyBear: 1, pterodactyl: 2, raptor: 3, sabertooth: 2, soldierB: 1, soldierC: 2, soldierElite: 1 },
  },
  {
    area: 'worldB', map: 'snow_entry', chapter: '12', from: C12, why: 'Snowy Highlands unlocked in Chapter 12; Goku L35',
    spawns: { direWolf: 1, iceSabertooth: 2, snowWolf: 3, stormPtero: 2 }, heavy: DIRE_WOLF,
  },
  {
    area: 'worldB', map: 'snow_peak', chapter: '12', from: C12, why: 'Snowy Highlands unlocked in Chapter 12; Goku L35',
    spawns: { direWolf: 2, iceSabertooth: 2, snowWolf: 1, stormPtero: 2 }, heavy: DIRE_WOLF,
  },
  {
    area: 'worldB', map: 'snow_peak', chapter: 'post', from: 'post', mix: 'trophy-gate grind', why: 'post-game L50 trophy gates, credits save',
    spawns: { direWolf: 2, iceSabertooth: 2, snowWolf: 1, stormPtero: 2 },
  },
  // World C: Future Earth, Beerus's planet, the Tournament of Power, Hell.
  {
    area: 'worldC', map: 'future_city', chapter: '0', from: { script: 'c00_locker' }, mix: 'scavengers (chapter<9)', why: 'Prologue, Trunks L6',
    spawns: { drone: 2, fc_scavDrone: 2, fc_scrapHound: 5 },
  },
  {
    area: 'worldC', map: 'future_highway', chapter: '0', from: { script: 'c00_locker' }, mix: 'scavengers (chapter<9)', why: 'Prologue, Trunks L6',
    spawns: { drone: 1, fc_scavDrone: 1, fc_scrapHound: 4 },
  },
  {
    area: 'worldC', map: 'future_cc_ruins', chapter: '0', from: { script: 'c00_locker' }, mix: 'scavengers (chapter<9)', why: 'Prologue, Trunks L6',
    spawns: { fc_scavDrone: 2, fc_scrapHound: 3 },
  },
  {
    area: 'worldC', map: 'future_city', chapter: '10', from: C10, hero: 'goku', level: 33, mix: 'Black\'s hunters (chapter>=9)', why: 'Goku 35 story gate grind zone; Goku arrives L33',
    spawns: { fc_hunterDrone: 2, fc_ravager: 3, goldDrone: 1, mechTrooper: 1 },
  },
  {
    area: 'worldC', map: 'future_highway', chapter: '10', from: C10, hero: 'goku', level: 33, mix: 'Black\'s hunters (chapter>=9)', why: 'Goku 35 gate period; Goku L33',
    spawns: { fc_hunterDrone: 2, fc_ravager: 1, goldDrone: 1, mechTrooper: 1 },
  },
  {
    area: 'worldC', map: 'future_cc_ruins', chapter: '10', from: C10, hero: 'goku', level: 33, mix: 'Black\'s hunters (chapter>=9)', why: 'Goku 35 story gate grind zone; Goku arrives L33',
    spawns: { fc_hunterDrone: 2, fc_ravager: 1, goldDrone: 1 },
  },
  {
    area: 'worldC', map: 'future_city', chapter: '11', from: C11, flags: ['c11_inFuture'], mix: 'Zamasu\'s clones (chapter 11)', why: 'Chapter 11 in the future, Trunks L34',
    spawns: { c11_blackClone: 5, c11_roseClone: 3, fc_hunterDrone: 2, fc_ravager: 3, goldDrone: 1, mechTrooper: 1, redMech: 1 }, heavy: RED_MECH,
  },
  {
    area: 'worldC', map: 'future_cc_ruins', chapter: '11', from: C11, flags: ['c11_inFuture'], mix: 'red Destroyer (chapter>=11)', why: 'Chapter 11 in the future, Trunks L34',
    spawns: { fc_hunterDrone: 2, fc_ravager: 1, goldDrone: 1, redMech: 1 }, heavy: RED_MECH,
  },
  {
    area: 'worldC', map: 'beerus_grounds', chapter: '4', from: { script: 'c04_fieldWhis_talk' }, mix: 'chapters 4-6', why: 'Beerus\'s planet unlocked in Chapter 4; Vegeta L15',
    spawns: { fc_lakeCrab: 2, fc_mossBeast: 2, fc_puffbird: 2 },
  },
  {
    area: 'worldC', map: 'beerus_grounds', chapter: '7', from: { script: 'c07_b_vegeta_talk' }, mix: 'chapter>=7', why: 'Chapter 7 training, Goku L22',
    spawns: { fc_hornBeast: 2, fc_lakeCrab: 1, fc_starWasp: 2 },
  },
  {
    area: 'worldC', map: 'top_arena_a', chapter: '14', from: C14_A, mix: 'stage A', why: 'Tournament of Power stage A, Goku L41',
    spawns: { c14_pride: 2, c14_u2Fighter: 2, c14_u3Robot: 2, c14_u4Fighter: 1, fc_topBrawler: 2, fc_topGunner: 2 }, heavy: U4,
  },
  {
    area: 'worldC', map: 'top_arena_b', chapter: '14', from: C14_A, mix: 'stage A', why: 'Tournament of Power stage A, Goku L41',
    spawns: { c14_pride: 2, c14_u2Fighter: 2, c14_u3Robot: 2, c14_u4Fighter: 1, fc_topBrawler: 2, fc_topGunner: 2 }, heavy: U4,
  },
  {
    area: 'worldC', map: 'top_arena_a', chapter: '14', from: C14_B, flags: ['c14_stageB'], mix: 'stage B', why: 'Tournament of Power stage B, Goku L43',
    spawns: { c14_pride: 3, c14_prideLancer: 2, fc_topGunner: 3 },
  },
  {
    area: 'worldC', map: 'top_arena_b', chapter: '14', from: C14_B, flags: ['c14_stageB'], mix: 'stage B', why: 'Tournament of Power stage B, Goku L43',
    spawns: { c14_pride: 4, c14_prideLancer: 2, fc_topGunner: 3 },
  },
  {
    area: 'worldC', map: 'top_arena_c', chapter: '14', from: { script: 'c14_stageC' }, flags: ['c14_stageB'], mix: 'stage B', why: 'Tournament of Power stage C ring, Goku L44',
    spawns: { c14_pride: 1, c14_prideLancer: 1, fc_topGunner: 1 },
  },
  {
    area: 'worldC', map: 'top_arena_a', chapter: 'post', from: 'post', mix: 'post-game', why: 'post-game arena, credits save',
    spawns: { c14_pride: 1, c14_prideLancer: 1, c14_u10Fighter: 2, c14_u2Fighter: 2, c14_u3Robot: 1, c14_u4Fighter: 1, c14_u9Wolf: 2, fc_topBrawler: 1, fc_topGunner: 1 }, heavy: U4,
  },
  {
    area: 'worldC', map: 'top_arena_b', chapter: 'post', from: 'post', mix: 'post-game', why: 'post-game arena, credits save',
    spawns: { c14_pride: 1, c14_prideLancer: 1, c14_u10Fighter: 2, c14_u2Fighter: 1, c14_u3Robot: 2, c14_u4Fighter: 1, c14_u9Wolf: 2, fc_topBrawler: 1, fc_topGunner: 1 }, heavy: U4,
  },
  {
    area: 'worldC', map: 'top_arena_c', chapter: 'post', from: 'post', mix: 'post-game', why: 'post-game arena, credits save',
    spawns: { c14_pride: 1, c14_prideLancer: 1, c14_u10Fighter: 1, c14_u2Fighter: 1, c14_u3Robot: 2, c14_u4Fighter: 1, c14_u9Wolf: 2, fc_topBrawler: 1, fc_topGunner: 2 }, heavy: U4,
  },
  {
    area: 'worldC', map: 'hell_lake', chapter: '4', from: { script: 'c04_fieldWhis_talk' }, mix: 'chapter<13',
    why: 'story warps only (Chapter 4 cutscene); no free-roam entry, measured as if there were', spawns: { fireBat: 4 },
  },
  {
    area: 'worldC', map: 'hell_lake', chapter: '13', from: C13_END, mix: 'chapter>=13',
    why: 'story warps only (Chapter 13 visit); no free-roam entry, measured as if there were', spawns: { fc_hellBat: 3, fc_lavaOoze: 2 },
  },
];

/** Maps with spawns no player ever fights in (the dev sandbox). */
const NOT_ZONES = new Set(['dev_sandbox']);

/** The arrival save of each story gate's character: the recorded script that opens the gate's chapter there. */
const GATE_FROM: Record<string, { script: string; chapter?: number }> = {
  c03_g_castle: C03,
  c07_g_stadium: { script: 'c07_b_vegeta_talk' },
  c09_g_shaft: { script: 'c09_vegeta_talk' },
  c10_g_courtyard: C10,
  c13_g_north: { script: 'c13_gohanL_talk' },
};

/** LoG2's own story gates on its reference maps: the hero's level where LoG2 opens the gate's zone, and the gate's. */
const LOG2_GATES: Array<{ gate: string; zones: string[]; from: number; to: number }> = [
  { gate: 'Piccolo 25 (Gingertown entrance)', zones: ['north'], from: 22, to: 25 },
  { gate: 'Trunks 30 (behind Gero\'s lab)', zones: ['ginger'], from: 27, to: 30 },
  { gate: 'Goku 40 (Cell Games arena)', zones: ['snowy', 'east_late'], from: 35, to: 40 },
];

// ------------------------------------------------------------------------------------------------ saves

/** Pin a save's RNG so re-levelling and the zone clear repeat run to run. */
function pinned(data: unknown, salt: number): GameState {
  const st = new GameState(data as ConstructorParameters<typeof GameState>[0]);
  st.data.seed = SAVE_SEED ^ salt;
  st.rng = new Rng(SAVE_SEED ^ salt);
  return st;
}

/**
 * Set a party member to exactly `level`: roll the missing level-ups, or rebuild them from level 1 on a pinned RNG
 * when the save has them higher (a story script's save comes after the grinding the stage is about).
 */
function setLevel(st: GameState, id: CharId, level: number): void {
  const c = st.char(id);
  if (c.level === level) return;
  if (c.level < level) { st.join(id, level); return; }
  const fresh = pinned(undefined, level * 31 + id.length);
  fresh.join(id, level);
  const f = fresh.char(id);
  Object.assign(c, { level: f.level, exp: f.exp, hpMax: f.hpMax, epMax: f.epMax, str: f.str, pow: f.pow, end: f.end, strF: f.strF, powF: f.powF, endF: f.endF });
  c.hp = c.hpMax;
  c.ep = c.epMax;
}

let rootsCache: RecordedRoot[] | null = null;

/** The recorded story run: LOS_ZONE_FIGHTS, or the committed recording (read once). */
function storyRoots(): RecordedRoot[] {
  const file = env.LOS_ZONE_FIGHTS ?? `${ROOT}/tests/fixtures/story_fights.json`;
  rootsCache ??= mainRoots(JSON.parse(readFileSync(file, 'utf8')) as RecordedRoot[]);
  return rootsCache;
}

/** The save a recorded story script started from. */
function rootSave(roots: RecordedRoot[], from: { script: string; chapter?: number }): string {
  const r = roots.find((x) => x.script === from.script && (from.chapter === undefined || (JSON.parse(x.save) as { chapter: number }).chapter === from.chapter));
  if (!r) throw new Error(`no recorded root ${from.script}${from.chapter !== undefined ? ` in chapter ${from.chapter}` : ''}`);
  return r.save;
}

/**
 * The save right after the credits: the Chapter 14 finale script replayed from its recorded save by the test bot (its
 * scripted wins pay the same boss EXP as a player's) until the post-game opens.
 */
async function replayToPostGame(roots: RecordedRoot[]): Promise<string> {
  const root = roots.find((r) => r.script === 'c14_stageC');
  if (!root) throw new Error('no recorded c14_stageC');
  const sim = new Sim();
  const g = sim.game;
  g.state = pinned(JSON.parse(root.save), 0x50);
  g.onPlayerDown = () => { const p = g.field?.player; if (p) p.cs.hp = p.cs.hpMax; return true; };
  g.startField(root.map, (root.x - 8) / TILE, (root.y - 14) / TILE, root.dir);
  await sim.idle();
  void g.runScript(root.script);
  for (let t = 0; t < 400000 && !(g.state.flag('post_game') && g.lockDepth === 0); t += 10) await sim.tick(10);
  if (!g.state.flag('post_game')) throw new Error('the finale never reached the post-game');
  return JSON.stringify(g.state.data);
}

let postCache: Promise<string> | null = null;

/** The post-game save (replayed once per run). */
function postGameSave(roots: RecordedRoot[]): Promise<string> {
  postCache ??= replayToPostGame(roots);
  return postCache;
}

/** The save a stage is cleared with. */
function stageSave(stage: ZoneStage, base: string): string {
  const st = pinned(JSON.parse(base), stage.map.length * 131 + Number(stage.chapter === 'post' ? 15 : stage.chapter));
  if (stage.hero) {
    if (!st.char(stage.hero).joined) throw new Error(`${stage.map}: ${stage.hero} is not in the party`);
    st.data.active = stage.hero;
  }
  if (stage.level !== undefined) setLevel(st, st.data.active, stage.level);
  for (const f of stage.flags ?? []) st.set(f);
  const c = st.hero;
  c.hp = c.hpMax;
  c.ep = c.epMax;
  return JSON.stringify(st.data);
}

/** A stage's save from the recording (the post-game one replayed on demand). */
async function saveFor(stage: ZoneStage): Promise<string> {
  const roots = storyRoots();
  return stageSave(stage, stage.from === 'post' ? await postGameSave(roots) : rootSave(roots, stage.from));
}

/** Label of a stage in test names and the report. */
const stageName = (s: ZoneStage): string => (s.mix ? `${s.map} [${s.mix}]` : s.map);

// ------------------------------------------------------------------------------------------------ measures

/** One enemy type of a zone against the hero (in form, and without). */
interface TypeLine {
  type: string;
  name: string;
  count: number;
  hp: number;
  atk: number;
  end: number;
  hitsToKill: number;
  hitsToKO: number;
  hitsToKillBase: number;
  hitsToKOBase: number;
  /** Over the seeds: share of the damage the hero took, and knock-out blows. */
  damageShare: number;
  koBlows: number;
  /** max(hits to kill / LoG2's 8, LoG2's 15 / hits to KO): above 1 = out of LoG2's band. */
  outOfBand: number;
}

const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round = (x: number, d = 1): number => Math.round(x * 10 ** d) / 10 ** d;

/** The hero a save sends into a zone, in form (if any) and without. */
function heroOf(save: string): { id: CharId; level: number; form: string | null; formed: RatioHero; base: RatioHero } {
  const st = new GameState(JSON.parse(save) as ConstructorParameters<typeof GameState>[0]);
  const c = st.hero;
  return { id: c.id, level: c.level, form: c.form, formed: formStats(c, c.form), base: formStats(c, null) };
}

/** LoG2's own numbers for a ROM enemy: no late-game damage scale, no HP trim (the ROM formula as LoG2 runs it). */
function romRatio(hero: RatioHero, def: EnemyDef): { hitsToKill: number; hitsToKO: number } {
  const heroHit = damage({ power: MELEE_POWER, mult: 1, stat: hero.str, end: def.end, res: def.resMelee ?? 1, crit: false, r26: 12 });
  const atk = mobAttack(def);
  const foeHit = damage({ power: ENEMY_POWER, mult: 1, stat: atk, end: hero.end, res: 1, crit: false, r26: 12 });
  return { hitsToKill: Math.ceil(def.hp / heroHit), hitsToKO: Math.ceil(hero.hpMax / foeHit) };
}

/** Per-type lines for a zone from its clears (the types in scope on any seed). */
function typeLines(runs: ZoneClear[], hero: ReturnType<typeof heroOf>): TypeLine[] {
  const types = new Map<string, number>();
  for (const r of runs) for (const [t, f] of Object.entries(r.foes)) if (f.count) types.set(t, Math.max(types.get(t) ?? 0, f.count));
  const taken = runs.reduce((a, r) => a + Object.values(r.foes).reduce((b, f) => b + f.dealt, 0), 0) || 1;
  const lines: TypeLine[] = [];
  for (const [type, count] of types) {
    const def = ENEMIES[type];
    if (!def) continue;
    const f: HitsRatio = mobRatio(hero.formed, def);
    const b: HitsRatio = mobRatio(hero.base, def);
    const dealt = runs.reduce((a, r) => a + (r.foes[type]?.dealt ?? 0), 0);
    const koBlows = runs.reduce((a, r) => a + (r.foes[type]?.koBlows ?? 0), 0);
    lines.push({
      type, name: def.name, count, hp: Math.round(def.hp), atk: mobAttack(def), end: def.end,
      hitsToKill: f.hitsToEnd, hitsToKO: f.hitsToKO, hitsToKillBase: b.hitsToEnd, hitsToKOBase: b.hitsToKO,
      damageShare: round(dealt / taken, 2), koBlows,
      outOfBand: round(Math.max(f.hitsToEnd / LOG2_KILL_MAX, LOG2_KO_MIN / f.hitsToKO), 2),
    });
  }
  return lines.sort((a, c) => c.outOfBand - a.outOfBand || c.damageShare - a.damageShare);
}

/** The worst offenders, with numbers. */
function worstOf(lines: TypeLine[]): string {
  const out = lines.filter((l) => l.outOfBand > 1 || l.koBlows > 0).slice(0, 3);
  const pick = out.length ? out : lines.slice(0, 1);
  return pick.map((l) => `${l.type} (${l.name} x${l.count}, HP ${l.hp}, atk ${l.atk}, END ${l.end}): ${l.hitsToKill} hits to kill, ${l.hitsToKO} hits to KO`
    + `, ${Math.round(l.damageShare * 100)}% of damage taken${l.koBlows ? `, ${l.koBlows} KO blows` : ''}${l.outOfBand > 1 ? '' : ' (within LoG2\'s band)'}`).join('; ');
}

/** The rules a zone breaks (the task's verdict rule), e.g. ['KOs 0.3 > 0', 'hits to KO 9 < 12']. */
function reasonsOf(z: { kos: number; senzu: number; hitsToKill: number; hitsToKO: number }): string[] {
  const hard: string[] = [];
  if (z.kos > RULE.kos) hard.push(`KOs ${z.kos} > ${RULE.kos}`);
  if (z.senzu > RULE.senzu) hard.push(`Senzu ${z.senzu} > ${RULE.senzu}`);
  if (z.hitsToKill > RULE.killMedian) hard.push(`hits to kill ${z.hitsToKill} > ${RULE.killMedian}`);
  if (z.hitsToKO < RULE.koMedian) hard.push(`hits to KO ${z.hitsToKO} < ${RULE.koMedian}`);
  if (hard.length) return hard;
  return z.hitsToKill < RULE.easyKill && z.hitsToKO > RULE.easyKO ? [`hits to kill ${z.hitsToKill} < ${RULE.easyKill} and hits to KO ${z.hitsToKO} > ${RULE.easyKO}`] : [];
}

/** The task's verdict for a zone: too hard if it breaks any hard rule, too easy if it breaks the easy one. */
function verdictOf(z: { kos: number; senzu: number; hitsToKill: number; hitsToKO: number }): 'ok' | 'too hard' | 'too easy' {
  const r = reasonsOf(z);
  if (!r.length) return 'ok';
  return r[0].includes('< 3 and') ? 'too easy' : 'too hard';
}

/** Minutes of clearing a level takes at `level`, at a zone's EXP per minute. */
const minutesPerLevel = (level: number, expPerMinute: number): number => (expPerMinute > 0 ? (EXP_TABLE[level + 1] - EXP_TABLE[level]) / expPerMinute : Infinity);

/** A zone's report line from its clears. */
function zoneLine(runs: ZoneClear[], hero: ReturnType<typeof heroOf>) {
  const lines = typeLines(runs, hero);
  const hitsToKill = median(lines.map((l) => l.hitsToKill));
  const hitsToKO = median(lines.map((l) => l.hitsToKO));
  const kos = round(mean(runs.map((r) => r.kos)), 2);
  const senzu = round(mean(runs.map((r) => r.senzu)), 2);
  const clearSeconds = round(mean(runs.map((r) => r.frames / 60)), 0);
  const expPerMinute = Math.round(mean(runs.map((r) => (r.frames > 0 ? r.exp / (r.frames / 3600) : 0))));
  return {
    hero: hero.id, level: hero.level, form: hero.form, hitsToKill, hitsToKO,
    hitsToKillNoForm: median(lines.map((l) => l.hitsToKillBase)), hitsToKONoForm: median(lines.map((l) => l.hitsToKOBase)),
    kos, senzu, clearSeconds, expPerMinute, minutesPerLevel: round(minutesPerLevel(hero.level, expPerMinute), 2),
    cleared: runs.filter((r) => r.stopped === 'cleared').length, seeds: runs.length,
    stops: runs.map((r) => r.stopped), scoped: runs[0]?.scoped ?? 0, spawned: runs[0]?.spawned ?? 0,
    left: runs.map((r) => r.scoped - r.kills),
    levelsGained: round(mean(runs.map((r) => r.levelEnd - r.level)), 1),
    taken: Math.round(mean(runs.map((r) => r.taken))),
    verdict: verdictOf({ kos, senzu, hitsToKill, hitsToKO }), reasons: reasonsOf({ kos, senzu, hitsToKill, hitsToKO }),
    worst: worstOf(lines), types: lines,
  };
}

/** Everything a stage's clears break of `RULE` and its own spawn mix (empty: the stage passes). */
function judge(stage: ZoneStage, runs: ZoneClear[], hero: ReturnType<typeof heroOf>): string[] {
  const bad: string[] = [];
  const line = zoneLine(runs, hero);
  for (const r of runs) {
    const inReach = Object.fromEntries(Object.entries(r.foes).filter(([, f]) => f.count > 0).sort(([a], [b]) => a.localeCompare(b)).map(([t, f]) => [t, f.count]));
    const want = Object.fromEntries(Object.entries(stage.spawns).sort(([a], [b]) => a.localeCompare(b)));
    if (JSON.stringify(inReach) !== JSON.stringify(want)) bad.push(`seed ${r.seed}: enemies in reach ${JSON.stringify(inReach)}, tuned for ${JSON.stringify(want)}`);
    if (r.scoped - r.kills > RULE.left) bad.push(`seed ${r.seed}: ${r.scoped - r.kills} enemies left (${r.stopped})`);
  }
  bad.push(...line.reasons);
  for (const t of line.types) {
    const heavy = stage.heavy?.[t.type];
    const killMax = heavy ? RULE.heavyKill : RULE.typeKill;
    const koMin = heavy ? RULE.heavyKO : hero.level <= RULE.earlyLevel ? RULE.earlyKO : RULE.typeKO;
    if (t.hitsToKill > killMax) bad.push(`${t.type}: ${t.hitsToKill} hits to kill > ${killMax}`);
    if (t.hitsToKO < koMin) bad.push(`${t.type}: ${t.hitsToKO} hits to KO < ${koMin}`);
  }
  for (const t of Object.keys(stage.heavy ?? {})) if (!stage.spawns[t]) bad.push(`heavy type ${t} is not in the spawn mix`);
  if (line.cleared < Math.ceil(RULE.cleared * runs.length)) bad.push(`cleared ${line.cleared}/${runs.length} seeds (${line.stops.join(', ')})`);
  if (line.minutesPerLevel > RULE.pace) bad.push(`${line.minutesPerLevel} minutes of clearing per level > ${RULE.pace} (${line.expPerMinute} EXP/min at L${hero.level})`);
  return bad;
}

/** Clear a stage on every seed. */
async function clearStage(stage: ZoneStage): Promise<{ save: string; runs: ZoneClear[] }> {
  const save = await saveFor(stage);
  const runs: ZoneClear[] = [];
  for (const seed of SEEDS) runs.push(await clearZone(save, stage.map, seed));
  return { save, runs };
}

// ------------------------------------------------------------------------------------------------ story gates

/** What grinding one story gate cost the fair bot on one seed. */
interface GateRun {
  seed: number;
  /** Fair-bot frames of clearing plus REENTRY_SECONDS per return to a zone. */
  frames: number;
  visits: number;
  kills: number;
  kos: number;
  senzu: number;
  reached: boolean;
  level: number;
}

/**
 * Grind a gate the way a player does: from `save`, clear the gate's zones in turn (a map's spawns come back on
 * re-entry), carrying HP, EXP and Senzu from one visit to the next, until the hero reaches `target`.
 */
async function grindGate(save: string, hero: CharId, zones: Array<{ map: string; entry?: { x: number; y: number } }>, target: number, seed: number): Promise<GateRun> {
  const run: GateRun = { seed, frames: 0, visits: 0, kills: 0, kos: 0, senzu: 0, reached: false, level: 0 };
  let at = save;
  for (let v = 0; v < 40; v++) {
    const z = zones[v % zones.length];
    const r = await clearZone(at, z.map, seed * 1000 + v, { entry: z.entry, until: (st) => st.char(hero).level >= target });
    run.frames += r.frames + (v ? REENTRY_SECONDS * 60 : 0);
    run.visits++;
    run.kills += r.kills;
    run.kos += r.kos;
    run.senzu += r.senzu;
    at = r.save;
    run.level = new GameState(JSON.parse(at) as ConstructorParameters<typeof GameState>[0]).char(hero).level;
    if (run.level >= target) { run.reached = true; break; }
    if (r.kills === 0) break;
  }
  return run;
}

/** A story gate's arrival save: its chapter's recorded save, its character active at the level `arrive` names. */
function gateSave(g: StoryGate): string {
  const from = GATE_FROM[g.id];
  if (!from) throw new Error(`story gate ${g.id} has no arrival save in GATE_FROM`);
  const st = pinned(JSON.parse(rootSave(storyRoots(), from)), g.level * 17 + g.chapter);
  st.data.active = g.character;
  setLevel(st, g.character, g.arrive);
  const c = st.hero;
  c.hp = c.hpMax;
  c.ep = c.epMax;
  return JSON.stringify(st.data);
}

/** The gate's zones in the order a player grinds them: the gate's own map first when it is one of them. */
function gateZones(g: StoryGate): Array<{ map: string; entry: { x: number; y: number } }> {
  const zones = g.zone.map(([map, x, y]) => ({ map, entry: { x, y } }));
  return [...zones.filter((z) => z.map === g.map), ...zones.filter((z) => z.map !== g.map)];
}

/** A gate's line: fair-bot minutes (mean over the seeds) and what they bought. */
function gateLine(runs: GateRun[]) {
  return {
    minutes: round(mean(runs.map((r) => r.frames / 3600)), 1),
    visits: round(mean(runs.map((r) => r.visits)), 1),
    kills: round(mean(runs.map((r) => r.kills)), 1),
    kos: round(mean(runs.map((r) => r.kos)), 2),
    senzu: round(mean(runs.map((r) => r.senzu)), 2),
    reached: runs.filter((r) => r.reached).length,
    seeds: runs.length,
  };
}

// ------------------------------------------------------------------------------------------------ harness checks

/** A gunner whose every shot knocks out a level-1 hero, for the knock-out check. */
const GUNNER = 'grind_test_gunner';
const PEN = 'grind_test_pen';
registerEnemies([{ id: GUNNER, name: 'Test Gunner', sprite: 'drone', hp: 900, str: 1, pow: 60, end: 0, exp: 40, ai: 'shooter', speed: 1.2, desc: 'Grind harness gunner.' }]);
registerMaps([{
  id: PEN, name: 'Test Pen', music: 'field', hostile: true, legend: { '.': 'grass', '#': 'cliff' },
  grid: Array.from({ length: 14 }, (_, y) => Array.from({ length: 20 }, (_, x) => (x === 0 || y === 0 || x === 19 || y === 13 ? '#' : '.')).join('')),
  enemies: [{ type: GUNNER, x: 14, y: 4 }, { type: GUNNER, x: 14, y: 9 }],
}]);

describe('grind harness', () => {
  it('a mob hits with its real attack stat: POW for shooters, the stronger stat for flamers and exploders', () => {
    const base: EnemyDef = { id: 'x', name: 'X', sprite: 'wolf', hp: 500, str: 20, pow: 40, end: 10, exp: 0, ai: 'rusher', speed: 1, desc: '' };
    expect(mobAttack(base)).toBe(20);
    expect(mobAttack({ ...base, ai: 'shooter' })).toBe(40);
    expect(mobAttack({ ...base, ai: 'heavy' })).toBe(40);
    expect(mobAttack({ ...base, ai: 'exploder', str: 50 })).toBe(50);
    const hero = { str: 30, end: 20, hpMax: 400 };
    expect(mobRatio(hero, { ...base, ai: 'shooter' }).hitsToKO).toBeLessThan(mobRatio(hero, base).hitsToKO);
    expect(mobRatio(hero, base).hitsToEnd).toBe(mobRatio(hero, { ...base, ai: 'shooter' }).hitsToEnd);
  });

  it.skipIf(!existsSync(`${RESEARCH}/enemy_stats.csv`))('the LoG2 reference enemies and zones are the ROM tables verbatim', () => {
    const csv = (name: string) => {
      const [head, ...rows] = (readFileSync(`${RESEARCH}/${name}`, 'utf8') as string).trim().split('\n');
      const keys = head.split(',');
      // Only `names` may hold a comma-free free-text field; every other column is plain.
      return rows.map((r) => Object.fromEntries(r.split(',').map((v, i) => [keys[i], v])) as Record<string, string>);
    };
    const stats = new Map(csv('enemy_stats.csv').map((r) => [Number(r.stat_idx), r]));
    for (const f of Object.values(LOG2_FOES)) {
      const r = stats.get(f.idx);
      expect(r, `ROM stat entry ${f.idx}`).toBeTruthy();
      if (!r) continue;
      expect([f.hp, f.str, f.pow, f.end, f.exp, f.mel, f.en], `${f.idx} ${f.name}`)
        .toEqual([r.HP, r.STR, r.POW, r.END, r.EXP, r.melee_dmg_taken_x128, r.energy_dmg_taken_x128].map(Number));
      expect(r.names, `${f.idx}`).toContain(f.name);
      expect(ENEMIES[f.like], `${f.idx} stand-in ${f.like}`).toBeTruthy();
    }
    const areas = new Map(csv('areas.csv').map((r) => [Number(r.area_idx), r.name]));
    const placed = new Map<string, number>();
    for (const p of csv('enemy_placements.csv')) {
      const k = `${areas.get(Number(p.area_idx))}|${p.stat_idx}`;
      placed.set(k, (placed.get(k) ?? 0) + 1);
    }
    for (const z of LOG2_ZONES) {
      for (const [idx, n] of z.foes) {
        expect(placed.get(`${z.area}|${idx}`) ?? 0, `${z.id}: ${n} x stat ${idx} in ${z.area}`).toBe(n);
      }
    }
  });

  it('scales a LoG2 zone\'s ROM placements to a reference map, keeping every type', () => {
    registerLog2Zones();
    for (const z of LOG2_ZONES) {
      const spawns = log2Spawns(z);
      expect(spawns.map(([i]) => i), z.id).toEqual(z.foes.map(([i]) => i));
      expect(spawns.every(([, n]) => n >= 1), z.id).toBe(true);
      expect(spawns.reduce((a, [, n]) => a + n, 0), z.id).toBeLessThanOrEqual(Math.max(LOG2_SPAWNS, z.foes.length));
      const map = resolveMap(`log2_${z.id}`);
      expect(map?.enemies?.length, z.id).toBe(spawns.reduce((a, [, n]) => a + n, 0));
      for (const [idx] of z.foes) expect(ENEMIES[`log2_${idx}`]?.hp, `${z.id} log2_${idx}`).toBe(LOG2_FOES[idx].hp);
    }
    // ROM resistances carry over (LoG2's Triceratops takes half damage from ki).
    expect(log2EnemyDef(LOG2_FOES[54]).resKi).toBe(0.5);
  });

  it('enters a map where the player lands: its world-map spot first, then doors and flight circles leading in', () => {
    expect(zoneEntries('waste_entry')[0]).toEqual({ x: 3, y: 15 });
    expect(zoneEntries('c01_hotspring')).toContainEqual({ x: 17, y: 21 });
    for (const stage of ZONE_STAGES) expect(zoneEntries(stage.map).length, stage.map).toBeGreaterThan(0);
  });

  it('clears a LoG2 reference zone with the fair bot: every enemy dead, EXP earned, no knock-out', async () => {
    registerLog2Zones();
    const z = LOG2_ZONES.find((x) => x.id === 'east_early') as Log2Zone;
    const r = await clearZone(log2Save(z), `log2_${z.id}`, 1, { entry: LOG2_ENTRY });
    expect(r.stopped).toBe('cleared');
    expect(r.scoped).toBe(r.spawned);
    expect(r.kills).toBe(r.scoped);
    expect(r.exp).toBeGreaterThan(0);
    expect(r.kos).toBe(0);
    expect(Object.values(r.foes).reduce((a, f) => a + f.killed, 0)).toBe(r.kills);
  }, CLEAR_TIMEOUT);

  it('counts every knock-out and keeps clearing (LoG2: Game Over, reload, go again)', async () => {
    const st = pinned(undefined, 1);
    st.join('goku', 1);
    st.data.active = 'goku';
    st.char('goku').techs = [];
    const r = await clearZone(JSON.stringify(st.data), PEN, 1, { entry: { x: 4, y: 6 } });
    expect(r.kos).toBeGreaterThanOrEqual(1);
    expect(r.foes[GUNNER].koBlows).toBe(r.kos);
    expect(r.foes[GUNNER].dealt).toBeGreaterThanOrEqual(r.kos * st.char('goku').hpMax);
    expect(r.taken).toBe(r.foes[GUNNER].dealt);
    expect(r.stopped).toBe('cleared');
  }, CLEAR_TIMEOUT);

  it('stops a clear at the caller\'s goal and hands back the save to chain the next visit from', async () => {
    registerLog2Zones();
    const z = LOG2_ZONES.find((x) => x.id === 'highway') as Log2Zone;
    const start = new GameState(JSON.parse(log2Save(z)) as ConstructorParameters<typeof GameState>[0]);
    const r = await clearZone(log2Save(z), `log2_${z.id}`, 1, { entry: LOG2_ENTRY, until: (st) => st.hero.exp > start.hero.exp });
    expect(r.stopped).toBe('goal');
    expect(r.kills).toBeGreaterThanOrEqual(1);
    expect(r.kills).toBeLessThan(r.scoped);
    const after = new GameState(JSON.parse(r.save) as ConstructorParameters<typeof GameState>[0]);
    expect(after.hero.exp).toBe(start.hero.exp + r.exp);
    expect(Object.keys(after.data.flags).filter((k) => k.startsWith('defeated:zone:'))).toEqual([]);
  }, CLEAR_TIMEOUT);

  it('clears a real hostile zone from the recorded story save, sealed in and fighting only what it can reach', async () => {
    const stage = ZONE_STAGES.find((s) => s.map === 'paozu_peaks') as ZoneStage;
    const r = await clearZone(await saveFor(stage), stage.map, 1);
    expect(r.stopped).toBe('cleared');
    expect(r.scoped).toBeGreaterThan(5);
    expect(r.scoped).toBeLessThanOrEqual(r.spawned);
    expect(r.kills).toBe(r.scoped);
    expect(r.exp).toBeGreaterThan(0);
  }, CLEAR_TIMEOUT);

  it('has a stage for every hostile map with spawns, and every stage\'s save spawns enemies there', () => {
    const roots = storyRoots();
    const staged = new Set(ZONE_STAGES.map((s) => s.map));
    for (const id of Object.keys(MAPS)) {
      const m = resolveMap(id);
      if (!m?.hostile || !(m.enemies ?? []).length || NOT_ZONES.has(id) || id.startsWith('log2_') || id.startsWith('grind_test_') || id.startsWith('bal_')) continue;
      expect(staged.has(id), `hostile map ${id} has no grind stage in tests/grind.test.ts ZONE_STAGES`).toBe(true);
    }
    for (const stage of ZONE_STAGES) {
      if (stage.from === 'post') continue;
      const st = new GameState(JSON.parse(stageSave(stage, rootSave(roots, stage.from))) as ConstructorParameters<typeof GameState>[0]);
      const spawns = (resolveMap(stage.map)?.enemies ?? []).filter((e) => st.check(e.showIf) && !(e.hideIf && st.check(e.hideIf)));
      expect(spawns.length, `${stage.map} (chapter ${stage.chapter}) spawns`).toBeGreaterThan(0);
      if (stage.level !== undefined) expect(st.hero.level, stage.map).toBe(stage.level);
      for (const t of Object.keys(stage.spawns)) expect(ENEMIES[t], `${stageName(stage)}: enemy ${t}`).toBeTruthy();
    }
    for (const g of STORY_GATES) expect(GATE_FROM[g.id], `story gate ${g.id}: arrival save`).toBeTruthy();
  });
});

// ------------------------------------------------------------------------------------------------ the sweep

/**
 * Every hostile zone at the stage it opens, cleared by the fair bot from the save a player has then (seeds 1-3) and
 * held to `RULE`: no knock-out, at most one Senzu a clear, LoG2's per-enemy band (heavyweights at LoG2's own
 * extremes), the tuned spawn mix in reach, cleared, and a levelling pace no slower than LoG2's slowest zone. The
 * report (LOS_ZONE_REPORT) prints the same numbers next to LoG2's zones.
 */
describe('grind zones: every hostile zone at its opening stage (fair bot)', () => {
  for (const stage of ZONE_STAGES) {
    it(`${stageName(stage)} (chapter ${stage.chapter}): ${stage.why}`, async () => {
      const { save, runs } = await clearStage(stage);
      expect(judge(stage, runs, heroOf(save))).toEqual([]);
    }, CLEAR_TIMEOUT);
  }
});

/**
 * The coloured gates on the story path (src/content/chapters/common.ts STORY_GATES), ground the way a player grinds
 * them: the gate's character at the level `arrive` names (what the full-game run brings), clearing the gate's zones in
 * turn with the fair bot (HP, EXP and Senzu carried from visit to visit, REENTRY_SECONDS per return) until the gate's
 * level. Each must cost GATE_MINUTES of fair-bot play on average, with no knock-out and at most one Senzu per zone
 * visit (the zone rule; LoG2's own gates cost this bot about two Beans over six to eight visits).
 */
describe('story gates: the fair bot grinds each one from its arrival level', () => {
  for (const g of STORY_GATES) {
    it(`${g.id}: ${g.character} L${g.arrive} -> L${g.level} in ${g.zone.map(([m]) => m).join(', ')}`, async () => {
      const save = gateSave(g);
      const runs: GateRun[] = [];
      for (const seed of SEEDS) runs.push(await grindGate(save, g.character, gateZones(g), g.level, seed));
      const line = gateLine(runs);
      console.log(`[story gate] ${g.id} (${g.character} L${g.arrive} -> L${g.level}): ${line.minutes} fair-bot min, ${line.kills} kills over ${line.visits} visits, `
        + `${line.kos} KOs, ${line.senzu} Senzu, reached ${line.reached}/${line.seeds}`);
      expect(line.reached, `${g.id}: seeds that reach L${g.level}`).toBe(runs.length);
      expect(line.kos, `${g.id}: knock-outs`).toBe(0);
      expect(line.senzu / line.visits, `${g.id}: Senzu per zone visit`).toBeLessThanOrEqual(RULE.senzu);
      expect(line.minutes, `${g.id}: fair-bot minutes${GATE_SHORT[g.id] ? ` (${GATE_SHORT[g.id].why})` : ''}`).toBeGreaterThanOrEqual(GATE_SHORT[g.id]?.min ?? GATE_MINUTES.min);
      expect(line.minutes, `${g.id}: fair-bot minutes`).toBeLessThanOrEqual(GATE_MINUTES.max);
    }, CLEAR_TIMEOUT);
  }
});

// ------------------------------------------------------------------------------------------------ the report

describe.skipIf(!env.LOS_ZONE_REPORT)('zone report (LOS_ZONE_REPORT=<file>)', () => {
  it('clears every hostile zone at its opening stage and LoG2\'s zones at theirs, and grinds every story gate', async () => {
    const only = env.LOS_ZONE_ONLY;
    // LoG2's zones first: each of ours is set against the LoG2 stage whose hero level is nearest.
    registerLog2Zones();
    const log2: Array<ReturnType<typeof zoneLine> & { id: string; area: string; stage: string; romHitsToKill: number; romHitsToKO: number }> = [];
    for (const z of LOG2_ZONES) {
      const save = log2Save(z);
      const runs: ZoneClear[] = [];
      for (const seed of SEEDS) runs.push(await clearZone(save, `log2_${z.id}`, seed, { entry: LOG2_ENTRY }));
      const hero = heroOf(save);
      const line = zoneLine(runs, hero);
      const rom = z.foes.map(([idx]) => romRatio(hero.formed, log2EnemyDef(LOG2_FOES[idx])));
      log2.push({ id: z.id, area: z.area, stage: z.stage, ...line, romHitsToKill: median(rom.map((x) => x.hitsToKill)), romHitsToKO: median(rom.map((x) => x.hitsToKO)) });
      console.log(`[log2] ${z.area} (${z.stage}): kill ${line.hitsToKill} / KO ${line.hitsToKO} (ROM-pure KO ${median(rom.map((x) => x.hitsToKO))}), KOs ${line.kos}, Senzu ${line.senzu}, ${line.clearSeconds}s, ${line.expPerMinute} EXP/min`);
    }
    const nearest = (level: number) => {
      const d = Math.min(...log2.map((l) => Math.abs(l.level - level)));
      const at = log2.filter((l) => Math.abs(l.level - level) === d);
      return {
        stages: at.map((l) => `${l.area} (${l.hero} L${l.level})`).join(' / '),
        hitsToKill: median(at.map((l) => l.hitsToKill)), hitsToKO: median(at.map((l) => l.hitsToKO)),
        kos: round(mean(at.map((l) => l.kos)), 2), senzu: round(mean(at.map((l) => l.senzu)), 2),
        clearSeconds: round(mean(at.map((l) => l.clearSeconds)), 0), expPerMinute: Math.round(mean(at.map((l) => l.expPerMinute))),
      };
    };
    const zones: Array<Record<string, unknown>> = [];
    for (const stage of ZONE_STAGES) {
      if (only && stage.map !== only) continue;
      const { save, runs } = await clearStage(stage);
      const hero = heroOf(save);
      const line = zoneLine(runs, hero);
      const failures = judge(stage, runs, hero);
      zones.push({ area: stage.area, map: stageName(stage), chapter: stage.chapter, why: stage.why, ...line, failures, log2: nearest(line.level) });
      console.log(`[zone] ${stageName(stage)} ch${stage.chapter} ${line.hero} L${line.level}${line.form ? ` ${line.form}` : ''}: kill ${line.hitsToKill} / KO ${line.hitsToKO}, KOs ${line.kos}, `
        + `Senzu ${line.senzu}, ${line.clearSeconds}s, ${line.expPerMinute} EXP/min (${line.minutesPerLevel} min/level), ${line.cleared}/${line.seeds} cleared -> ${line.verdict}`
        + `${failures.length ? ` | fails: ${failures.join('; ')}` : ''}`);
    }
    const gates: Array<Record<string, unknown>> = [];
    if (!only) {
      for (const g of STORY_GATES) {
        const save = gateSave(g);
        const runs: GateRun[] = [];
        for (const seed of SEEDS) runs.push(await grindGate(save, g.character, gateZones(g), g.level, seed));
        gates.push({ gate: g.id, chapter: g.chapter, hero: g.character, from: g.arrive, to: g.level, zones: g.zone.map(([m]) => m), ...gateLine(runs), runs });
        console.log(`[gate] ${g.id} ${g.character} L${g.arrive} -> L${g.level}: ${JSON.stringify(gateLine(runs))}`);
      }
      for (const lg of LOG2_GATES) {
        const z0 = LOG2_ZONES.find((z) => z.id === lg.zones[0]) as Log2Zone;
        const save = log2Save({ ...z0, level: lg.from });
        const runs: GateRun[] = [];
        for (const seed of SEEDS) runs.push(await grindGate(save, z0.hero, lg.zones.map((id) => ({ map: `log2_${id}`, entry: LOG2_ENTRY })), lg.to, seed));
        gates.push({ gate: `LoG2 ${lg.gate}`, hero: z0.hero, from: lg.from, to: lg.to, zones: lg.zones.map((id) => `log2_${id}`), ...gateLine(runs), runs });
        console.log(`[gate] LoG2 ${lg.gate} ${z0.hero} L${lg.from} -> L${lg.to}: ${JSON.stringify(gateLine(runs))}`);
      }
    }
    const counts = { ok: 0, 'too hard': 0, 'too easy': 0 } as Record<string, number>;
    for (const z of zones) counts[z.verdict as string]++;
    writeFileSync(env.LOS_ZONE_REPORT, JSON.stringify({
      generated: new Date().toISOString(), recording: env.LOS_ZONE_FIGHTS ?? 'tests/fixtures/story_fights.json', seeds: SEEDS,
      rule: 'too hard: KOs > 0 on average, Senzu > 1 per clear, hits to kill > 10 or hits to KO < 12; too easy: hits to kill < 3 and hits to KO > 40; else ok',
      sweepRule: RULE, gateMinutes: GATE_MINUTES, gateShort: GATE_SHORT, reentrySeconds: REENTRY_SECONDS,
      counts, failing: zones.filter((z) => (z.failures as string[]).length).map((z) => z.map), zones, gates, log2,
    }, null, 1));
    expect(zones.length).toBeGreaterThan(0);
  }, 3600000);
});
