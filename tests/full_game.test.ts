import { describe, expect, it } from 'vitest';
import { CAST } from '../src/content/cast';
import type { CharId } from '../src/content/characters';
import {
  CHAPTER_MIN_LEVEL, ensureChapterState, FORCED_LEVEL_GAP, HANDOVER_LEVEL_GAP, STORY_GATES, storyGateFlag, storyGateHint,
  type StoryGate,
} from '../src/content/chapters/common';
import { QUESTS } from '../src/content/quests';
import { MAPS, resolveMap } from '../src/content/registry';
import { SPOTS, type WorldId } from '../src/content/world';
import { TILE } from '../src/engine/constants';
import type { Dir } from '../src/engine/math';
import type { Line } from '../src/ui/dialogue';
import { EXP_TABLE, killExp, levelForExp } from '../src/game/leveling';
import { Shot } from '../src/game/projectiles';
import { SCRIPTS, type Script, type ScriptApi, type ScriptCtx } from '../src/game/script';
import { GameState, type SaveData } from '../src/game/state';
import { setGroundCacheLimit } from '../src/game/world';
import { type GrindLog, Sim } from './sim';

/**
 * The whole game on ONE save: newGame -> Prologue -> Chapters 1-14 -> credits -> post-game (trophies, Mr. Satan,
 * the ZTV ending, Whis's charm, Jiren and Hit). It replays the beat sequence of every act chain test
 * (tests/chapters/act1..act5) but never resets or fabricates story state between acts: each chapter starts from
 * whatever the previous one really left behind.
 *
 * At every chapter start (each `cNN_start` is wrapped) the test snapshots that hand-over state and asks
 * `ensureChapterState` what it would still have to grant; anything but a level floor is a cross-act seam.
 * After every beat it also checks the world-map flag against the map, duplicate story characters on screen and
 * NPCs standing on doors or arrival tiles, then walks into every shared hub map with a copy of the save (as each
 * hero the player could be playing) and runs the same checks there.
 */

const BIG = 400000;

/** Docs/CHAPTERS.md level curve: [first, last] hero level of each chapter (index = chapter). */
const CURVE: Array<[number, number]> = [
  [6, 6], [1, 8], [8, 12], [12, 15], [15, 18], [18, 22], [22, 25], [25, 29], [29, 31], [30, 34], [34, 37], [37, 40],
  [40, 42], [42, 45], [45, 48], [48, 50],
];

const HEROES: CharId[] = ['goku', 'vegeta', 'gohan', 'trunks', 'piccolo', 'satan'];

/** Flags acts raise only while a scripted fight or finale runs (maps sealed, rivals swept): never across a hand-over. */
const TRANSIENT = ['c00_sealed', 'act5_busy', 'c11_finaleLock', 'fc_topQuiet', 'c11_sealOpen'];

/**
 * Guide §5 timeline: forms and (signature) techniques every party member must already have when chapter `n` starts,
 * i.e. what chapters 0..n-1 really handed over. Cumulative; Trunks keeps his prologue Super Saiyan while away.
 */
const TIMELINE: Record<number, { forms: Partial<Record<CharId, string>>; techs: Partial<Record<CharId, string[]>> }> = {
  1: { forms: { trunks: 'ssj' }, techs: { trunks: ['kiBlast', 'burningAttack'] } },
  2: { forms: { trunks: 'ssj', goku: 'ssj' }, techs: { goku: ['kamehameha'] } },
  3: { forms: { goku: 'ssj', vegeta: 'ssj' }, techs: { goku: ['kamehameha'], vegeta: ['bigBang'] } },
  4: { forms: { goku: 'ssg', vegeta: 'ssj' }, techs: {} },
  5: { forms: { goku: 'ssg', vegeta: 'ssj' }, techs: {} },
  6: { forms: { goku: 'ssg', vegeta: 'ssj', gohan: 'ssj', piccolo: 'unweighted' }, techs: { gohan: ['masenko'], piccolo: ['specialBeamCannon'] } },
  7: { forms: { goku: 'ssb', vegeta: 'ssb', gohan: 'ssj', piccolo: 'unweighted' }, techs: { vegeta: ['bigBang', 'galickGun'] } },
  8: { forms: { goku: 'ssb', vegeta: 'ssb' }, techs: {} },
  9: { forms: { goku: 'ssb', vegeta: 'ssb', trunks: 'ssj' }, techs: {} },
  10: { forms: { trunks: 'ssj' }, techs: { trunks: ['burningAttack', 'swordBlast'] } },
  11: { forms: { trunks: 'ssj', goku: 'ssb', vegeta: 'ssb' }, techs: {} },
  12: { forms: { trunks: 'rage', goku: 'ssb', vegeta: 'ssb', gohan: 'ssj', piccolo: 'unweighted' }, techs: {} },
  13: { forms: { trunks: 'rage' }, techs: {} },
  14: { forms: { gohan: 'ultimate', goku: 'ssb', vegeta: 'ssb' }, techs: { gohan: ['masenko', 'kamehameha'], piccolo: ['specialBeamCannon', 'hellzoneGrenade'] } },
};

/** Talk scripts the act 3 chain runs explicitly (story beats) instead of in bulk. */
const STORY_TALKS = new Set([
  'c06_frieza_talk', 'c06_gfrieza_talk', 'c06_party_beerus', 'c07_b_vegeta_talk', 'c07_cc_beerus', 'c07_vados_exam',
  'c07_announcer_talk', 'c08_party_bulma',
]);

/** Capsule Corp lawn tile the act 3 scripts arrive on. */
const CC_ENTRY: [number, number] = [23, 13];

/** What a chapter start found when it was called (before its own ensureChapterState ran). */
interface Entry {
  chapter: number;
  map: string;
  active: CharId;
  noSwitch: boolean;
  levels: Record<string, number>;
  forms: Record<string, string | null>;
  techs: Record<string, string[]>;
  /** What ensureChapterState would still have to grant (joins, techs, forms, items, spots). */
  missing: string[];
  /** Level floors it would apply. */
  raised: string[];
  /** Gold quests of earlier chapters still open in the Journal. */
  openGold: string[];
  /** Fight-in-progress flags still raised. */
  transient: string[];
  /** Story gates of earlier chapters the player has not broken. */
  standing: string[];
}

// ------------------------------------------------------------------------------------------------ world lookup

/** World of every map reachable from a landing spot through warps, edge exits and flight circles. */
function mapWorlds(): Map<string, WorldId | 'mixed'> {
  const out = new Map<string, WorldId | 'mixed'>();
  const queue: Array<[string, WorldId]> = [];
  for (const s of Object.values(SPOTS)) if (s.map && !s.toWorld) queue.push([s.map, s.world]);
  while (queue.length) {
    const [id, w] = queue.shift() as [string, WorldId];
    const prev = out.get(id);
    if (prev === w || prev === 'mixed') continue;
    out.set(id, prev ? 'mixed' : w);
    const def = resolveMap(id);
    if (!def) continue;
    const next = [
      ...(def.warps ?? []).map((x) => x.to),
      ...Object.values(def.exits ?? {}).map((x) => x?.to ?? ''),
      ...(def.objects ?? []).flatMap((o) => (o.type === 'flight' ? [o.to] : [])),
    ];
    for (const n of next) if (n && MAPS[n]) queue.push([n, w]);
  }
  return out;
}

/** Story-only maps (reached by script, no landing spot) whose world is obvious from the story. */
const SCRIPTED_WORLDS: Record<string, WorldId> = {
  c00_skyline: 'future', c01_dream: 'earth', c02_pier: 'earth', c02_deck: 'earth', c02_galley: 'earth', c02_hold: 'earth',
  c03_sky_sea: 'earth', c09_outskirts: 'earth', c09_flash_wastes: 'earth', c11_rift_sky: 'future', c12_rooftop: 'earth',
  c12_pan_meadow: 'earth', c12_film_set: 'earth', c12_forest: 'earth', post_ztv_studio: 'earth',
};

const WORLD_OF = mapWorlds();
for (const [id, w] of Object.entries(SCRIPTED_WORLDS)) if (MAPS[id] && !WORLD_OF.has(id)) WORLD_OF.set(id, w);

/** Every tile some warp, flight circle or landing spot drops the player on, per map. */
function arrivalTiles(): Map<string, Array<{ x: number; y: number; from: string }>> {
  const out = new Map<string, Array<{ x: number; y: number; from: string }>>();
  const add = (map: string, x: number, y: number, from: string): void => {
    (out.get(map) ?? out.set(map, []).get(map))?.push({ x: Math.floor(x), y: Math.floor(y), from });
  };
  for (const id of Object.keys(MAPS)) {
    const def = resolveMap(id);
    for (const w of def?.warps ?? []) add(w.to, w.tx, w.ty, `${id} warp`);
    for (const o of def?.objects ?? []) if (o.type === 'flight') add(o.to, o.tx, o.ty, `${id} flight`);
  }
  for (const s of Object.values(SPOTS)) if (s.map && !s.toWorld) add(s.map, s.tx, s.ty, `${s.id}`);
  return out;
}

const ARRIVALS = arrivalTiles();

// ------------------------------------------------------------------------------------------------ identities

/** Generic extras: any number of them may share the screen. */
const GENERIC = /^(townsman|townswoman|oldMan|kidNpc|police|scientist|farmer|reporter|waiter|bandit|banditChief|frizaSoldier[BC]?|frizaElite|resistance|universeFighter|prideTrooper|poacher|babarian)$/;

/** Which named character a sprite shows (null for extras and creatures). */
function identity(sprite: string): string | null {
  if (!CAST[sprite] || GENERIC.test(sprite)) return null;
  if (/^(c\d\d|act\d|post|e[abc]|fc)_/.test(sprite)) return null; // chapter-made extras and one-off characters
  if (/^(gokuBlack|blackRose)/.test(sprite)) return null; // Chapter 11 is full of Blacks.
  if (/^goku/.test(sprite)) return 'goku';
  if (/^vegeta/.test(sprite)) return 'vegeta';
  if (/^vegito/.test(sprite)) return 'vegeta';
  if (/^futureTrunks/.test(sprite)) return 'trunks';
  if (/^gohan/.test(sprite)) return 'gohan';
  if (/^piccolo/.test(sprite)) return 'piccolo';
  if (/^android17/.test(sprite)) return 'android17';
  if (/^(frieza|goldenFrieza)$/.test(sprite)) return 'frieza';
  if (/^krillin/.test(sprite)) return 'krillin';
  if (/^cabba/.test(sprite)) return 'cabba';
  if (/^kale/.test(sprite)) return 'kale';
  if (sprite === 'mrSatan') return 'satan';
  return sprite;
}

// ------------------------------------------------------------------------------------------------ the run

/** Everything the run notices along the way (asserted empty at the end). */
interface Watch {
  /** Story characters standing on two hub maps at once (reported, not asserted). */
  elsewhere: Set<string>;
  worldFlag: Set<string>;
  doubles: Set<string>;
  blockers: Set<string>;
}

function makeRun(sim: Sim, watch: Watch, afterBeat?: (id: string) => Promise<void>) {
  const st = sim.game.state;

  /** Checks made whenever the player has control again (after every beat). */
  function observe(): void {
    const f = sim.game.field;
    if (!f || sim.game.lockDepth > 0) return;
    const map = f.def.id;
    const ch = st.data.chapter;
    // The world flag picks which world map the next world sign (or Whis's Charm) opens.
    const w = WORLD_OF.get(map);
    const flag = (st.get('world') as string | undefined) ?? 'earth';
    if (w && w !== 'mixed' && w !== flag) watch.worldFlag.add(`${map} ch${ch}: world flag '${flag}' on a ${w} map`);
    // Nobody is on screen twice (the player included).
    const on = new Map<string, string[]>();
    const add = (who: string | null, tag: string): void => { if (who) on.set(who, [...(on.get(who) ?? []), tag]); };
    if (!f.player.hidden) add(identity(f.player.spriteId), `hero:${st.data.active}`);
    for (const n of f.npcs) if (!n.hidden) add(identity(n.spriteId), n.def.id);
    for (const [who, tags] of on) if (tags.length > 1) watch.doubles.add(`${map} ch${ch}: ${who} x${tags.length} (${tags.join(', ')})`);
    // Map NPCs never stand on an open door or on a tile the player arrives on.
    const def = resolveMap(map);
    const defNpcs = new Set(def?.npcs ?? []);
    for (const n of f.npcs) {
      if (n.hidden || !defNpcs.has(n.def)) continue;
      const tx = Math.floor(n.def.x);
      const ty = Math.floor(n.def.y);
      for (const wp of def?.warps ?? []) {
        if (!st.check(wp.showIf) || (wp.hideIf && st.check(wp.hideIf))) continue;
        if (tx >= Math.floor(wp.x) && tx < Math.ceil(wp.x + wp.w) && ty >= Math.floor(wp.y) && ty < Math.ceil(wp.y + wp.h)) {
          watch.blockers.add(`${map} ch${ch}: ${n.def.id} @${tx},${ty} stands on the warp to ${wp.to}`);
        }
      }
      for (const a of ARRIVALS.get(map) ?? []) {
        if (a.x === tx && a.y === ty) watch.blockers.add(`${map} ch${ch}: ${n.def.id} @${tx},${ty} stands on the arrival tile of ${a.from}`);
      }
    }
  }

  /** Tick until no script holds the controls (onEnter scripts started by warps finish too). */
  async function settle(cond: () => boolean = () => true, max = BIG): Promise<void> {
    for (let i = 0; i < max && !cond(); i += 10) await sim.tick(10);
    let idle = 0;
    for (let i = 0; i < max && idle < 6; i += 5) {
      await sim.tick(5);
      idle = sim.game.lockDepth === 0 ? idle + 1 : 0;
    }
    observe();
  }

  /** Start on a map (standing in for the player travelling there) and let its onEnter scripts finish. */
  async function enter(map: string, x?: number, y?: number): Promise<void> {
    sim.start(map, x, y);
    await sim.tick(3);
    await settle();
  }

  /** Run a script to the end (NPC context optional) and assert it ran cleanly. */
  async function run(id: string, ctx: ScriptCtx = {}): Promise<void> {
    expect(SCRIPTS[id], `script ${id} exists`).toBeTruthy();
    expect(await sim.run(id, ctx, BIG), `${id} finished`).toBe(true);
    await settle();
    expect(sim.errors, `${id} errors`).toEqual([]);
    await afterBeat?.(id);
  }

  /** Talk to an NPC on the current map (entering `map` first if the hero is elsewhere). */
  async function talk(npcId: string, map?: string, x?: number, y?: number): Promise<void> {
    if (map && (sim.game.field?.def.id !== map || x !== undefined)) await enter(map, x, y);
    const npc = sim.game.field?.npcs.find((n) => n.def.id === npcId);
    expect(npc, `${npcId} on ${sim.game.field?.def.id} (ch${st.data.chapter})`).toBeTruthy();
    if (!npc) return;
    await run(npc.def.talk, { npc });
  }

  /** Act 5 style: optionally enter a map, then run a script as the NPC that owns it (if any). */
  async function beat(map: string | null, script: string, x?: number, y?: number): Promise<void> {
    if (map) await enter(map, x, y);
    const npc = sim.game.field?.npcs.find((n) => n.def.talk === script);
    await run(script, npc ? { npc } : {});
  }

  /** Run every non-story act 3 talk script on the current map (the act 3 chain does this on every stop). */
  async function talkAll(): Promise<string[]> {
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    const ran: string[] = [];
    for (const n of [...f.npcs]) {
      const t = n.def.talk;
      if (!t || STORY_TALKS.has(t) || !/^c0[678]_/.test(t)) continue;
      await run(t, { npc: n });
      ran.push(t);
    }
    return ran;
  }

  /** Stand the hero on a tile. */
  function put(x: number, y: number, dir: Dir = 'down'): void {
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    f.player.x = x * TILE + 8;
    f.player.y = y * TILE + 14;
    f.player.dir = dir;
  }

  /** Walk onto a visible pickup (or examine a hidden one) and wait for the item box. */
  async function collect(map: string, pickupId: string): Promise<void> {
    const def = resolveMap(map)?.pickups?.find((p) => p.id === pickupId);
    expect(def, `pickup ${pickupId} on ${map}`).toBeTruthy();
    if (!def) return;
    const y = def.hidden ? def.y - 1 : def.y;
    await enter(map, def.x, y);
    put(def.x, y);
    if (def.hidden) sim.game.field?.tryInteract();
    for (let i = 0; i < 400 && !st.flag(`pickup:${pickupId}`); i += 10) await sim.tick(10);
    await settle();
    expect(st.flag(`pickup:${pickupId}`), `collected ${pickupId}`).toBe(true);
  }

  /** Open a chest on a map, standing on whichever side of it is open ground. */
  async function openChest(map: string, chestId: string): Promise<void> {
    const o = resolveMap(map)?.objects?.find((x) => x.type === 'chest' && x.id === chestId);
    expect(o, `chest ${chestId} on ${map}`).toBeTruthy();
    if (!o) return;
    await enter(map, o.x, o.y + 1);
    const f = sim.game.field;
    if (!f) return;
    const sides: Array<[number, number, Dir]> = [[0, 1, 'up'], [0, -1, 'down'], [-1, 0, 'right'], [1, 0, 'left']];
    for (const [dx, dy, dir] of sides) {
      if (f.col.blocked({ x: (o.x + dx) * TILE + 3, y: (o.y + dy) * TILE + 8, w: 10, h: 6 })) continue;
      put(o.x + dx, o.y + dy, dir);
      if (f.tryInteract()) break;
    }
    await settle();
    expect(st.flag(`chest:${chestId}`), `opened ${chestId}`).toBe(true);
  }

  /** Smash a breakable object (by id) on the current map with melee hits. */
  function smash(id: string): void {
    const f = sim.game.field;
    const o = f?.map.objects.find((x) => x.def.type === 'breakable' && 'id' in x.def && x.def.id === id);
    expect(o, `breakable ${id} on ${f?.def.id}`).toBeTruthy();
    for (let i = 0; i < 4 && o && !o.gone; i++) f?.meleeHit(o.rect, 10, 1);
    expect(o?.gone, `${id} broken`).toBe(true);
  }

  /** Break a level gate with the active hero. */
  function breakGate(gateId: string): void {
    const f = sim.game.field;
    const g = f?.map.gates.find((x) => x.def.id === gateId);
    expect(g, `gate ${gateId} on ${f?.def.id}`).toBeTruthy();
    if (g && !g.broken) f?.meleeHit(g.rect, 10, 1);
    expect(st.flag(`gate:${f?.def.id}:${gateId}`), `${gateId} broken by ${st.data.active} L${st.hero.level}`).toBe(true);
  }

  return { settle, enter, run, talk, beat, talkAll, put, collect, openChest, smash, breakGate };
}

// ------------------------------------------------------------------------------------------------ hand-over snapshots

/** What `ensureChapterState(n)` would still add to this save (never mutates it). */
function pendingGrants(data: SaveData, n: number): { missing: string[]; raised: string[] } {
  const copy = JSON.parse(JSON.stringify(data)) as SaveData;
  const gs = new GameState(copy);
  const spots: string[] = [];
  const fake = {
    state: gs,
    unlockRegion: (id: string) => { if (!gs.data.regions.includes(id)) { gs.data.regions.push(id); spots.push(id); } },
  } as unknown as ScriptApi;
  ensureChapterState(fake, n);
  const missing: string[] = [];
  const raised: string[] = [];
  for (const id of Object.keys(copy.chars) as CharId[]) {
    const a = data.chars[id];
    const b = copy.chars[id];
    if (!a.joined && b.joined) missing.push(`${id} joins`);
    for (const t of b.techs) if (!a.techs.includes(t)) missing.push(`${id} learns ${t}`);
    if (a.form !== b.form) missing.push(`${id} form ${a.form} -> ${b.form}`);
    if (!a.charged && b.charged) missing.push(`${id} charged melee`);
    if (a.joined && b.level > a.level) raised.push(`${id} L${a.level} -> L${b.level}`);
  }
  for (const [k, v] of Object.entries(copy.inv)) if ((data.inv[k] ?? 0) < v) missing.push(`item ${k}`);
  for (const sp of spots) missing.push(`spot ${sp}`);
  return { missing, raised };
}

/** Gold quests of chapters before `n` that are still open. */
function openGold(data: SaveData, n: number): string[] {
  return Object.entries(data.journal)
    .filter(([id, v]) => v === 'active' && QUESTS[id]?.star === 'gold')
    .filter(([id]) => { const m = /^c(\d\d)_/.exec(id); return !!m && Number(m[1]) < n; })
    .map(([id]) => id);
}

function snapshot(sim: Sim, n: number): Entry {
  const st = sim.game.state;
  const d = st.data;
  const levels: Record<string, number> = {};
  const forms: Record<string, string | null> = {};
  const techs: Record<string, string[]> = {};
  for (const id of HEROES) {
    const c = st.char(id);
    if (c.joined) levels[id] = c.level;
    forms[id] = c.form;
    techs[id] = [...c.techs];
  }
  const { missing, raised } = pendingGrants(d, n);
  return {
    chapter: n, map: sim.game.field?.def.id ?? d.map, active: d.active,
    noSwitch: st.flag('noSwitch'), levels, forms, techs, missing, raised, openGold: openGold(d, n),
    transient: TRANSIENT.filter((f) => st.flag(f)),
    standing: STORY_GATES.filter((g) => g.chapter < n && !st.flag(storyGateFlag(g))).map((g) => g.id),
  };
}

// ------------------------------------------------------------------------------------------------ hub audit

/** Guide §8 shared hub maps: every act overlays these. */
const HUBS = [
  'paozu_valley', 'paozu_home', 'paozu_house', 'gohan_house', 'paozu_forest', 'paozu_peaks', 'satan_plaza', 'satan_mansion',
  'satan_mansion_in', 'satan_shop', 'satan_dojo', 'kame_island', 'kame_house_in', 'korin_base', 'korin_tower', 'lookout',
  'lookout_palace_in', 'wc_streets', 'wc_shops', 'cc_yard', 'cc_inside', 'cc_gravity', 'waste_entry', 'waste_canyon', 'waste_mesa',
  'desert_entry', 'desert_oasis', 'pilaf_castle_out', 'pilaf_castle_in', 'snow_entry', 'snow_peak', 'future_city', 'future_highway',
  'future_hideout_out', 'future_hideout_in', 'future_cc_ruins', 'kingkai_planet', 'beerus_grounds', 'beerus_palace_in', 'u10_sacred',
  'zeno_palace', 'hell_lake',
];

/** Where a player walks into a hub: its landing spot, else the first door/flight that leads there, else the centre. */
function hubEntry(map: string): [number, number] | undefined {
  const spot = Object.values(SPOTS).find((x) => x.map === map && !x.toWorld);
  if (spot) return [spot.tx, spot.ty];
  const a = ARRIVALS.get(map)?.[0];
  return a ? [a.x, a.y] : undefined;
}

/**
 * Walk into every hub with a copy of the live save, as every hero the player could be playing right now
 * (only the forced one during forced segments), and record what the run's observer would flag there.
 */
async function auditHubs(live: Sim, label: string, watch: Watch, errors: string[]): Promise<void> {
  const keepErr = console.error;
  try {
    const data = JSON.stringify(live.game.state.data);
    const st0 = live.game.state;
    const heroes = st0.flag('noSwitch') ? [st0.data.active] : st0.party.map((c) => c.id);
    const where = new Map<string, Set<string>>();
    for (const map of HUBS) {
      for (const hero of heroes) {
        const sim = new Sim();
        sim.game.state = new GameState(JSON.parse(data) as SaveData);
        sim.game.state.data.active = hero;
        const at = hubEntry(map);
        sim.start(map, at?.[0], at?.[1]);
        const run = makeRun(sim, watch);
        await sim.tick(3);
        await run.settle(() => true, 60000);
        for (const e of sim.errors) errors.push(`${label} ${map} as ${hero}: ${e.split('\n')[0]}`);
        if (hero !== heroes[0] || !sim.game.field) continue;
        const defs = new Set(resolveMap(map)?.npcs ?? []);
        for (const n of sim.game.field.npcs) {
          const who = identity(n.spriteId);
          if (!who || n.hidden || !defs.has(n.def)) continue;
          (where.get(who) ?? where.set(who, new Set()).get(who))?.add(`${map}/${n.def.id}`);
        }
      }
    }
    for (const [who, at] of where) {
      const maps = new Set([...at].map((x) => x.split('/')[0]));
      if (maps.size > 1) watch.elsewhere.add(`${label}: ${who} on ${[...at].join(', ')}`);
    }
  } finally {
    console.error = keepErr;
  }
}

// ------------------------------------------------------------------------------------------------ the test

describe('full game: one save from newGame to the post-game', () => {
  it('plays every chapter in order on one continuous save and hands each chapter the state the next expects', async () => {
    // The hub audits walk into ~40 maps after every beat: keep every map's ground cached (the game keeps 8).
    setGroundCacheLimit(1000);
    const sim = new Sim();
    const st = sim.game.state;
    const q = (id: string) => st.data.journal[id];
    const watch: Watch = { elsewhere: new Set(), worldFlag: new Set(), doubles: new Set(), blockers: new Set() };
    const auditErrors: string[] = [];
    /** Walk into every hub with a copy of the save as it is now (after every beat, at every chapter start). */
    const audit = async (label: string): Promise<void> => { await auditHubs(sim, label, watch, auditErrors); };
    const R = makeRun(sim, watch, (id) => audit(`ch${st.data.chapter} after ${id}`));
    const { settle, enter, run, talk, beat, talkAll, put, collect, openChest, smash, breakGate } = R;

    /** What each story gate cost the run (printed with the hand-over levels). */
    const grinds: Array<{ gate: StoryGate; log: GrindLog }> = [];
    /**
     * A story gate, met the way a player meets it: walk up to it (the hint plays), find it shut to whoever is playing,
     * switch to its character at its save point (or stay, when the story is forcing that character), grind in its
     * zone on real enemies until strong enough, smash it, and switch back to the hero the story was following.
     */
    const passGate = async (id: string): Promise<void> => {
      const g = STORY_GATES.find((x) => x.id === id);
      if (!g) throw new Error(`no story gate ${id}`);
      expect(st.data.chapter, `${id}: chapter`).toBe(g.chapter);
      expect(st.flag(storyGateFlag(g)), `${id} still standing`).toBe(false);
      const story = st.data.active;
      const forced = st.flag('noSwitch');
      if (forced) expect(story, `${id}: the story is forcing a hero, so it must be the gate's own`).toBe(g.character);
      const [sm, sx, sy] = g.save;
      await enter(sm, sx, sy);
      await run(storyGateHint(g));
      const gate = () => sim.game.field?.map.gates.find((x) => x.def.id === g.id);
      if (story !== g.character || st.char(g.character).level < g.level) {
        const at = gate();
        if (at) sim.game.field?.meleeHit(at.rect, 10, 1);
        expect(gate()?.broken, `${id} holds against ${story} L${st.hero.level}`).toBe(false);
      }
      sim.game.switchCharacter(g.character);
      const log = await sim.grind(g.level, g.zone);
      grinds.push({ gate: g, log });
      await enter(sm, sx, sy);
      breakGate(g.id);
      if (story !== g.character) sim.game.switchCharacter(story);
      await settle();
      expect(sim.errors, `${id} errors`).toEqual([]);
    };

    // Wrap every chapter start: snapshot the hand-over, and let the bot answer each chapter's first prompts with
    // option 0 (as every act chain test does when it starts).
    const entries: Record<number, Entry> = {};
    const originals: Record<string, Script> = {};
    for (let n = 0; n <= 14; n++) {
      const id = `c${String(n).padStart(2, '0')}_start`;
      const orig = SCRIPTS[id];
      expect(orig, `${id} is registered`).toBeTruthy();
      originals[id] = orig;
      SCRIPTS[id] = async (s) => {
        expect(entries[n], `${id} runs once`).toBeUndefined();
        entries[n] = snapshot(sim, n);
        sim.choice = 0;
        await orig(s);
      };
    }

    /** Hand-over checks for chapter `n` once its opening has played. */
    const boundary = (n: number, hero: CharId, party: CharId[], forced: boolean): void => {
      const e = entries[n];
      expect(e, `c${n}_start was reached`).toBeTruthy();
      if (!e) return;
      const tag = `chapter ${n} hand-over`;
      expect(st.data.chapter, tag).toBe(n);
      expect(st.data.active, `${tag}: hero`).toBe(hero);
      expect(st.party.map((c) => c.id).sort(), `${tag}: party`).toEqual([...party].sort());
      expect(st.flag('noSwitch'), `${tag}: noSwitch`).toBe(forced);
      // Forms and techniques the earlier chapters really taught (Guide §5), before this chapter's own grants.
      const want = TIMELINE[n];
      for (const [id, form] of Object.entries(want?.forms ?? {})) expect.soft(e.forms[id], `${tag}: ${id}'s form`).toBe(form);
      for (const [id, list] of Object.entries(want?.techs ?? {})) expect.soft(e.techs[id], `${tag}: ${id}'s techniques`).toEqual(expect.arrayContaining(list ?? []));
      // The previous chapter delivered everything Guide §5 promises; ensureChapterState only fills level floors.
      expect.soft(e.missing, `${tag}: grants the previous chapters never gave`).toEqual([]);
      expect.soft(e.openGold, `${tag}: gold quests left open`).toEqual([]);
      expect.soft(e.noSwitch, `${tag}: noSwitch left over from chapter ${n - 1}`).toBe(false);
      expect.soft(e.transient, `${tag}: fight flags left raised`).toEqual([]);
      if (n > 0) {
        const done = Object.keys(QUESTS).filter((id) => id.startsWith(`c${String(n - 1).padStart(2, '0')}_`) && QUESTS[id].star === 'gold');
        expect(done.length, `${tag}: chapter ${n - 1} has gold quests`).toBeGreaterThan(0);
        for (const id of done) if (st.data.journal[id]) expect.soft(st.data.journal[id], `${tag}: ${id}`).toBe('done');
        // Levels: nobody over-levelled for the chapter just finished, nobody below the new chapter's floor.
        for (const [id, lv] of Object.entries(e.levels)) expect.soft(lv, `${tag}: ${id} level at hand-over`).toBeLessThanOrEqual(CURVE[n - 1][1] + 3);
      }
      // LoG2 levels come from EXP: the hand-over's safety net lifts only the hero who played the last chapter, and only
      // to band start - HANDOVER_LEVEL_GAP; the bench keeps its EXP-earned level; a character the story forces is at
      // least band start - FORCED_LEVEL_GAP. Every story gate of an earlier chapter was broken by the player.
      if (e.levels[e.active] !== undefined && e.active !== 'satan') {
        expect.soft(st.char(e.active).level, `${tag}: ${e.active} (hero at hand-over) level`).toBeGreaterThanOrEqual(CHAPTER_MIN_LEVEL[n] - HANDOVER_LEVEL_GAP);
      }
      expect.soft(e.standing, `${tag}: story gates of earlier chapters still standing`).toEqual([]);
      expect.soft(e.raised.filter((r) => !r.startsWith(`${e.active} `)), `${tag}: bench raised at the hand-over`).toEqual([]);
      if (forced) expect.soft(st.hero.level, `${tag}: forced ${st.data.active} level`).toBeGreaterThanOrEqual(CHAPTER_MIN_LEVEL[n] - FORCED_LEVEL_GAP);
      // Story costumes: Whis's gi from the end of Chapter 4 through the Frieza arc, Gohan's suit until he changes.
      const outfits: Record<string, string> = {};
      for (const id of HEROES) { const o = st.char(id).outfit; if (o) outfits[id] = o; }
      const costumes: Record<number, Record<string, string>> = { 5: { goku: 'gokuWhis', gohan: 'gohanSuit' }, 6: { goku: 'gokuWhis' } };
      expect.soft(outfits, `${tag}: outfits`).toEqual(costumes[n] ?? {});
      expect(sim.errors, tag).toEqual([]);
    };

    try {
      // ============================================================================================ PROLOGUE
      expect(await sim.run('newGame', {}, BIG)).toBe(true);
      await settle();
      expect(sim.errors).toEqual([]);
      boundary(0, 'trunks', ['trunks'], false);
      await audit('ch0 start');
      expect(st.data.map).toBe('future_hideout_in');
      expect(st.char('trunks').level).toBe(6);
      expect(st.char('trunks').techs).toEqual(expect.arrayContaining(['kiBlast', 'burningAttack']));
      expect(st.get('world')).toBe('future');

      await talk('c00_fbulma');
      expect(q('c00_fuel')).toBe('active');
      await talk('c00_fmai');
      await talk('c00_fmai');
      await run('c00_save_tut');
      await enter('future_hideout_out', 17, 14);
      expect(st.data.map).toBe('future_hideout_out');

      await enter('c00_tunnel', 3.5, 11.6);
      const f = () => { const x = sim.game.field; if (!x) throw new Error('no field'); return x; };
      await run('c00_hint_melee');
      for (let i = 0; i < 2; i++) f().meleeHit({ x: 11 * TILE, y: 8 * TILE, w: TILE, h: TILE }, 10, 1);
      expect(st.flag('broke:c00_tunnel:c00_rockA')).toBe(true);
      await run('c00_hint_ki');
      await run('c00_pad');
      put(31, 8, 'right');
      for (let i = 0; i < 3; i++) {
        const p = f().player;
        f().spawnShot(new Shot('player', 'shot', p.x + 10, p.y, { x: 1, y: 0 }, 3.6, 1, '#f8e070', 10, 6));
        await sim.tick(40);
      }
      expect(st.flag('broke:c00_tunnel:c00_rubble')).toBe(true);
      await run('c00_pad');
      expect(st.flag('c00_padLit')).toBe(true);
      await enter('c00_depot', 2, 7.5);
      await enter('c00_depot', 24, 5);
      await run('c00_locker');
      expect(st.char('trunks').form).toBe('ssj');
      expect(st.char('trunks').joined).toBe(false);
      expect(q('c00_fuel')).toBe('done');
      expect(q('c00_return')).toBe('done');

      // ============================================================================================ CHAPTER 1
      boundary(1, 'goku', ['goku'], false);
      expect(st.get('world')).toBe('earth');
      expect(st.data.map).toBe('paozu_house');
      expect(q('c01_farm')).toBe('active');

      await enter('paozu_home', 12, 18);
      const radishes = sim.game.field?.pickups.filter((p) => p.item === 'c01_radish') ?? [];
      expect(radishes.length).toBeGreaterThanOrEqual(5);
      for (const p of radishes.slice(0, 5)) {
        f().player.x = p.x;
        f().player.y = p.y;
        for (let i = 0; i < 40 && !st.flag(`pickup:${p.id}`); i += 5) await sim.tick(5);
        await settle();
      }
      expect(st.count('c01_radish')).toBe(5);
      await talk('c01_goten');
      await talk('c01_chichi', 'paozu_house');
      expect(q('c01_farm')).toBe('done');
      expect(q('c01_tracks')).toBe('active');

      await enter('paozu_forest', 30, 14);
      await enter('c01_shrine', 14, 12);
      await run('c01_gate_hint');
      await run('c01_shrine_pray');
      expect(st.char('goku').techs).toContain('kamehameha');
      expect(q('c01_tracks')).toBe('done');

      // Bronze errands: Goten's dino, Trunks's birthday gift, Old Hiro's goat.
      sim.choice = 0;
      await talk('c01_vgoten', 'paozu_valley', 13, 9);
      expect(q('c01_dino')).toBe('active');
      await talk('c01_vtrunks');
      expect(q('c01_gift')).toBe('active');
      await enter('paozu_peaks', 21, 7);
      expect(st.flag('c01_scarfaceBeaten')).toBe(true);
      await talk('c01_vgoten', 'paozu_valley', 13, 9);
      expect(q('c01_dino')).toBe('done');
      await talk('c01_hiro', 'paozu_forest', 38, 14);
      expect(q('c01_goat')).toBe('active');
      await talk('c01_goatNpc', 'paozu_forest', 7, 21);
      expect(sim.game.field?.carrying?.label).toBe('goat');
      await talk('c01_hiro');
      expect(q('c01_goat')).toBe('done');

      await talk('c01_chichi', 'paozu_house');
      expect(q('c01_lunch')).toBe('active');
      await talk('c01_gohan', 'gohan_house', 8, 9);
      expect(q('c01_lunch')).toBe('done');
      expect(q('c01_satan')).toBe('active');
      await enter('paozu_valley', 20, 12);
      expect(st.flag('c01_tutSign')).toBe(true);

      await talk('c01_shopper', 'satan_shop', 7, 7);
      expect(st.flag('c01_giftSpring')).toBe(true);
      await enter('c01_hotspring', 17, 8);
      await run('c01_g4_hint');
      await run('c01_spring');
      expect(st.count('c01_springWater')).toBe(1);
      await talk('c01_videl', 'gohan_house', 8, 9);
      expect(q('c01_gift')).toBe('done');

      await talk('c01_satan', 'satan_mansion', 17, 12);
      expect(q('c01_satan')).toBe('done');
      expect(q('c01_money')).toBe('active');
      await talk('c01_fan', 'satan_plaza', 24, 26);
      expect(q('c01_autograph')).toBe('active');
      await talk('c01_satan', 'satan_mansion', 17, 12);
      expect(st.count('c01_photo')).toBe(1);
      await talk('c01_fan', 'satan_plaza', 24, 26);
      expect(q('c01_autograph')).toBe('done');

      // Money -> Beerus wakes -> King Kai -> SSJ -> Beerus -> Chapter 2.
      await talk('c01_chichi', 'paozu_house');
      expect(q('c01_money')).toBe('done');
      expect(st.char('goku').form).toBe('ssj');

      // ============================================================================================ CHAPTER 2
      boundary(2, 'vegeta', ['goku', 'vegeta'], true);
      expect(st.char('vegeta').techs).toContain('bigBang');
      expect(st.char('vegeta').form).toBe('ssj');
      expect(q('c02_party')).toBe('active');

      await talk('c02_driverYard', 'cc_yard', 17, 12);
      expect(st.data.map).toBe('c02_pier');
      await enter('c02_deck', 19.5, 21);
      expect(st.count('scouter')).toBe(1);
      expect(q('c02_scan')).toBe('active');
      await talk('c02_krillin');
      await talk('c02_roshi');
      await run('c02_beerus_arrive');
      expect(q('c02_feast')).toBe('active');

      await talk('c02_beerus');
      await talk('c02_chef', 'c02_galley', 7.5, 8);
      await talk('c02_fisher', 'c02_pier', 30, 9);
      await talk('c02_chef', 'c02_galley', 7.5, 8);
      expect(st.count('c02_takoyaki')).toBe(1);
      await talk('c02_beerus', 'c02_deck', 30, 6);
      expect(q('c02_takoyaki')).toBe('done');

      await talk('c02_beerus');
      expect(q('c02_ramen')).toBe('active');
      await talk('c02_driverPier', 'c02_pier', 6, 13);
      expect(st.data.map).toBe('wc_streets');
      await talk('c02_cart');
      await talk('c02_punkBoss');
      await talk('c02_cart');
      expect(st.count('c02_ramen')).toBe(1);
      await talk('c02_beerus', 'c02_deck', 30, 6);
      expect(q('c02_ramen')).toBe('done');

      await talk('c02_beerus');
      expect(q('c02_thieves')).toBe('active');
      await enter('c02_hold', 3, 4);
      await enter('c02_hold', 15, 3);
      await run('c02_hold_vault');
      expect(q('c02_thieves')).toBe('done');

      // Bulma's Scouter test: five scans (the Scouter view pushes them), then report back.
      st.data.scans.push('npc:krillin', 'npc:android18', 'npc:yamcha', 'npc:tien', 'npc:bulma');
      await talk('c02_bulma', 'c02_deck', 20, 7);
      expect(q('c02_scan')).toBe('done');

      await talk('c02_beerus', 'c02_deck', 30, 6);
      expect(q('c02_pudding')).toBe('active');
      await talk('c02_buu');
      expect(st.flag('c02_rage')).toBe(true);
      expect(q('c02_feast')).toBe('done');

      // ============================================================================================ CHAPTER 3
      boundary(3, 'goku', ['goku', 'vegeta'], false);
      expect(st.count('dragonRadar')).toBe(1);
      expect(q('c03_dragonballs')).toBe('active');
      expect(st.data.regions).toEqual(expect.arrayContaining(['spot_desert', 'spot_lookout', 'spot_kame', 'spot_satancity']));

      await talk('c03_panchy', 'cc_yard');
      expect(st.count('c03_bento')).toBe(1);
      await talk('c03_bulma', 'cc_yard');

      await collect('desert_oasis', 'c03_db1');
      await passGate('c03_g_castle');
      await enter('pilaf_castle_in', 15, 9);
      await run('c03_gate_note');
      await enter('c03_pilaf_vault', 4, 17);
      await run('c03_memo');
      for (const l of ['moon', 'sun', 'dragon', 'pilaf']) await run(`c03_lever_${l}`);
      expect(st.flag('c03_vaultOpen')).toBe(true);
      await enter('pilaf_castle_in', 15, 9);
      await collect('pilaf_castle_in', 'c03_db2');
      await run('c03_mk2_ambush');
      expect(st.count('db2') + st.count('db3')).toBe(2);
      await run('c03_mk2_phase2');

      await talk('c03_satan', 'satan_mansion');
      await talk('c03_pastry', 'satan_plaza');
      await talk('c03_satan', 'satan_mansion');
      expect(st.count('db5')).toBe(1);
      await talk('c03_roshi', 'kame_island');
      await collect('kame_island', 'c03_db4');
      await talk('c03_yajirobe', 'korin_base');
      expect(st.count('db6')).toBe(1);
      await talk('c03_dende', 'lookout');
      expect(q('c03_dragonballs')).toBe('done');

      // The dojo's sparring arena (Act 1 side content): one bout per visit.
      for (const npc of ['c02_spYamchaNpc', 'c02_spKrillinNpc', 'c02_spTienNpc']) await talk(npc, 'satan_dojo', 9, 11);
      expect(q('c02_spar')).toBe('done');
      // Beaten sparring partners go home: Krillin and Tien have story parts elsewhere later on.
      await enter('satan_dojo', 9, 11);
      expect(sim.game.field?.npcs.filter((n) => n.def.id.startsWith('c02_sp')).map((n) => n.def.id)).toEqual([]);
      expect(st.count('str3') + st.count('pow3') + st.count('end3')).toBeGreaterThanOrEqual(3);

      await talk('c03_bulma', 'cc_yard');
      expect(st.char('goku').form).toBe('ssg');
      expect(sim.game.field?.def.id).toBe('c03_sky_sea');
      await run('c03_battle');
      expect(st.flag('c03_beerusDone')).toBe(true);
      expect(q('c03_beerus')).toBe('done');

      // ============================================================================================ CHAPTER 4
      boundary(4, 'vegeta', ['goku', 'vegeta'], true);
      expect(q('c04_whis')).toBe('active');
      await enter('cc_inside', 15, 3);
      await run('c04_stash');
      await talk('c04_bulma', 'cc_yard');
      await talk('c04_whis', 'cc_yard');
      expect(q('c04_training')).toBe('active');
      expect(q('c04_delicacies')).toBe('active');
      expect(sim.game.field?.def.id).toBe('c04_whis_field');
      await settle();
      // The field's Moss Grazer roams free and can be mid-charge when a jar is filled; a jar it knocks out of the
      // hero's hands is fetched again, as a player would (the save's random seed decides whether that happens).
      for (let i = 0; i < 12 && !st.flag('c04_jarsDone'); i++) {
        await run('c04_jar_fill');
        await run('c04_jar_deliver');
      }
      expect(st.flag('c04_jarsDone')).toBe(true);
      for (const id of ['c04_rock1', 'c04_rock2', 'c04_rock3']) smash(id);
      await run('c04_critter_caught');
      expect(st.count('c04_spoon')).toBe(1);
      await talk('c04_fieldWhis', 'c04_whis_field');
      expect(q('c04_spar')).toBe('done');
      expect(st.flag('c04_done')).toBe(true);

      // ============================================================================================ CHAPTER 5
      boundary(5, 'gohan', ['goku', 'vegeta', 'gohan'], true);
      expect(st.char('gohan').level).toBeGreaterThanOrEqual(16);
      expect(st.char('gohan').outfit).toBe('gohanSuit');
      expect(q('c05_army')).toBe('active');
      await talk('c05_bulma', 'cc_yard');
      await talk('c05_jacoNpc', 'cc_yard');
      await enter('waste_entry', 3, 15);
      expect(st.char('piccolo').joined).toBe(true);
      expect(st.char('gohan').outfit).toBeUndefined();
      await run('c05_wave1');
      await enter('waste_canyon', 2, 13);
      await run('c05_wave2');
      await run('c05_shisami');
      expect(st.data.active).toBe('piccolo');
      await enter('waste_mesa', 22, 31);
      await run('c05_wave3');
      await run('c05_ginyu');
      expect(st.flag('c05_done')).toBe(true);
      expect(q('c05_mesa')).toBe('done');

      // ============================================================================================ CHAPTER 6
      boundary(6, 'goku', ['goku', 'vegeta', 'gohan', 'piccolo'], true);
      expect(sim.game.field?.def.id).toBe('waste_mesa');
      expect(q('c06_frieza')).toBe('active');
      await settle();
      expect(await talkAll()).toContain('c06_jaco_talk');
      await run('c06_round1');
      expect(st.char('goku').form).toBe('ssb');
      expect(st.data.active).toBe('vegeta');
      await talkAll();
      await run('c06_round2');
      expect(st.char('vegeta').form).toBe('ssb');
      expect(st.char('vegeta').techs).toContain('galickGun');
      expect(q('c06_frieza')).toBe('done');
      expect(st.flag('noSwitch')).toBe(false);
      expect(sim.game.field?.def.id).toBe('cc_yard');

      await enter('waste_canyon', 20, 4);
      for (let i = 0; i < 3; i++) await run('c06_deserter_down');
      expect(q('c06_deserters')).toBe('done');

      // Master Roshi's charged melee: each of the four students talks to him once.
      for (const id of ['goku', 'vegeta', 'gohan', 'piccolo'] as CharId[]) {
        await enter('kame_island', 25, 15);
        sim.game.switchCharacter(id);
        await talk('c05_roshi');
        expect(st.char(id).charged, `${id} charged`).toBe(true);
      }
      expect(q('c05_roshi')).toBe('done');
      sim.game.switchCharacter('goku');

      await enter('cc_yard', ...CC_ENTRY);
      expect(await talkAll()).toContain('c06_party_bulma');
      await run('c06_party_beerus', { npc: sim.game.field?.npcs.find((n) => n.def.id === 'c06_p_beerus') });

      // ============================================================================================ CHAPTER 7
      boundary(7, 'goku', ['goku', 'vegeta', 'gohan', 'piccolo'], true);
      expect(sim.game.field?.def.id).toBe('beerus_grounds');
      await settle();
      await talkAll();
      await run('c07_b_vegeta_talk');
      expect(q('c07_spar')).toBe('done');
      // Buu joins Team Universe 7, so Mr. Satan's Buu leaves the mansion until the tournament is over.
      expect(st.flag('ea_buuAway')).toBe(true);
      expect(sim.game.field?.def.id).toBe('cc_yard');
      await settle();
      await run('c07_cc_beerus');
      await talkAll();
      await run('c07_cc_panchy');
      await run('c07_cc_buu');
      expect(q('c07_cake')).toBe('done');
      await run('c07_cc_beerus');
      expect(st.flag('c07_departed')).toBe(true);
      expect(sim.game.field?.def.id).toBe('c07_nameless_grounds');
      await settle();
      await talkAll();
      await run('c07_vados_exam');
      expect(q('c07_exam')).toBe('done');
      await talkAll();
      st.give('c07_snackCrate', 1);
      await run('c07_vendor_talk');
      st.give('c07_starShard', 3);
      await settle();
      await run('c07_whis_grounds');
      expect(q('c07_shards')).toBe('done');
      await passGate('c07_g_stadium');
      await enter('c07_nameless_arena', 17, 27);
      await run('c07_beerus_talk');
      expect(q('c07_snacks')).toBe('done');
      await talkAll();
      for (let m = 1; m <= 8; m++) {
        await settle();
        await run('c07_announcer_talk');
        expect(st.flag(`c07_m${m}`), `match ${m}`).toBe(true);
        await talkAll();
      }
      await run('c07_announcer_talk');
      expect(st.flag('c07_done')).toBe(true);
      expect(q('c07_tournament')).toBe('done');

      // ============================================================================================ CHAPTER 8
      boundary(8, 'goku', ['goku', 'vegeta', 'gohan', 'piccolo'], true);
      expect(q('c08_monaka')).toBe('done');
      expect(st.flag('ea_buuAway')).toBe(false);
      expect(sim.game.field?.def.id).toBe('cc_yard');
      await settle();
      await talkAll();
      await run('c08_party_bulma');
      expect(st.data.active).toBe('vegeta');
      expect(sim.game.field?.def.id).toBe('c08_potaufeu_landing');
      await settle();
      await talkAll();
      await enter('c08_potaufeu_mushrooms', 21, 28);
      await run('c08_boys');
      await run('c08_gryll');
      expect(q('c08_gryll')).toBe('done');
      await enter('c08_potaufeu_landing', 18, 13);
      await talkAll();
      st.give('c08_water', 3);
      st.give('c08_parcel', 3);
      const potage = () => ({ npc: sim.game.field?.npcs.find((n) => n.def.id === 'c08_l_potage') });
      await run('c08_potage_talk', potage());
      await run('c08_potage_talk', potage());
      expect(q('c08_water')).toBe('done');
      expect(q('c08_delivery')).toBe('done');
      await enter('c08_potaufeu_vault', 12, 15);
      await run('c08_vault');
      expect(q('c08_copy')).toBe('done');

      // ============================================================================================ CHAPTER 9
      boundary(9, 'trunks', ['goku', 'vegeta', 'gohan', 'piccolo', 'trunks'], true);
      expect(st.char('trunks').level).toBeGreaterThanOrEqual(30);
      expect(st.char('trunks').techs).toEqual(expect.arrayContaining(['swordBlast', 'burningAttack']));
      expect(st.char('trunks').charged).toBe(true);
      expect(st.char('trunks').form).toBe('ssj');
      expect(q('c09_q_spar')).toBe('active');

      await talk('c09_vegeta', 'cc_gravity', 7, 9);
      expect(q('c09_q_spar')).toBe('done');
      await enter('cc_yard', 21, 8);
      await settle(() => st.flag('c09_cellOut'));
      expect(q('c09_q_black')).toBe('done');
      expect(q('c09_q_fuel')).toBe('active');
      await enter('c09_mine', 5, 25);
      await run('c09_crystal1');
      await run('c09_crystal2');
      await passGate('c09_g_shaft');
      await run('c09_excavator_fight');
      await run('c09_crystal3');
      expect(st.count('c09_crystal')).toBe(3);
      await talk('c09_gohanH', 'gohan_house', 8, 10);
      expect(q('c09_q_gohan')).toBe('done');
      sim.choice = 1;
      await talk('c09_pilafK', 'cc_yard', 9, 21);
      sim.choice = 0;
      expect(q('c09_q_homework')).toBe('done');
      await talk('c09_bulmaPad', 'cc_yard', 31, 10);
      expect(q('c09_q_depart')).toBe('done');

      // ============================================================================================ CHAPTER 10
      boundary(10, 'goku', ['goku', 'vegeta', 'gohan', 'piccolo', 'trunks'], true);
      expect(st.get('world')).toBe('earth');
      await talk('c10_beerus', 'cc_yard', 23, 22);
      expect(sim.game.field?.def.id).toBe('u10_sacred');
      expect(st.get('world')).toBe('space');
      await talk('c10_gowasu');
      await talk('c10_zamasu');
      await run('c10_ring_shrine');
      await talk('c10_beerusU');
      expect(q('c10_q_u10')).toBe('done');
      expect(sim.game.field?.def.id).toBe('zeno_palace');
      await talk('c10_zeno');
      expect(st.count('c10_zenoButton')).toBe(1);
      expect(sim.game.field?.def.id).toBe('cc_yard');
      await talk('c10_gowasu', 'u10_sacred', 20, 20);
      expect(q('c10_q_babari')).toBe('active');
      await talk('c10_slain');
      await talk('c10_chief');
      await run('c10_fruit_tree');
      await run('c10_kaistone');
      await talk('c10_gowasu');
      expect(q('c10_q_babari')).toBe('done');
      await talk('c09_bulmaPad', 'cc_yard', 31, 10);
      expect(sim.game.field?.def.id).toBe('c10_lair');
      expect(st.get('world')).toBe('future');
      await talk('c10_runner');
      await run('c10_pharmacy');
      await talk('c10_runner');
      expect(q('c10_q_medicine')).toBe('done');
      await passGate('c10_g_courtyard');
      await run('c10_showdown');
      expect(q('c10_q_lair')).toBe('done');

      // ============================================================================================ CHAPTER 11
      boundary(11, 'trunks', ['goku', 'vegeta', 'gohan', 'piccolo', 'trunks'], true);
      expect(st.char('trunks').form).toBe('rage');
      await talk('c11_roshi', 'kame_island', 21, 15);
      expect(q('c11_q_urn')).toBe('active');
      await enter('lookout', 22, 28);
      expect(st.count('c11_urn')).toBe(1);
      await run('c11_htc_door');
      await talk('c11_gokuK', 'kame_island', 21, 15);
      await talk('c11_roshi');
      expect(q('c11_q_charm')).toBe('done');
      await talk('c09_bulmaPad', 'cc_yard', 31, 10);
      expect(st.get('world')).toBe('future');
      await talk('c11_mother', 'future_hideout_in', 9, 11);
      await enter('future_city', 40, 4);
      for (const id of ['c11_surv1', 'c11_surv2', 'c11_surv3']) await talk(id);
      await enter('future_cc_ruins', 32, 6);
      await run('c11_notes_shelf');
      await talk('c11_mother', 'future_hideout_in', 9, 11);
      expect(q('c11_q_survivors')).toBe('done');
      await talk('c09_fmai');
      expect(q('c11_q_notes')).toBe('done');
      await enter('future_city', 22, 27);
      expect(await sim.run('c11_to_rift', {}, BIG)).toBe(true);
      await settle(() => sim.game.field?.def.id === 'c11_rift_sky');
      expect(sim.game.field?.def.id).toBe('c11_rift_sky');
      await run('c11_showdown');
      expect(st.flag('c11_finaleDone')).toBe(true);
      expect(q('c11_q_rift')).toBe('done');
      expect(st.char('vegeta').outfit).toBeUndefined();

      // ============================================================================================ CHAPTER 12
      boundary(12, 'goku', ['goku', 'vegeta', 'gohan', 'piccolo', 'trunks'], false);
      expect(st.get('world')).toBe('earth');
      expect(q('c12_days')).toBe('active');
      await beat('cc_yard', 'act5_beerus_talk', 25, 17);
      expect(st.flag('c12_hitHinted')).toBe(true);
      await beat('satan_plaza', 'c12_porter_talk', 31, 6);
      expect(q('c12_hit')).toBe('done');
      await beat('paozu_valley', 'c12_videl_talk', 8, 8);
      expect(sim.game.field?.def.id).toBe('c12_pan_meadow');
      for (const e of sim.game.field?.enemies ?? []) if (!e.uid && !e.dead) e.dead = true;
      for (let i = 0; i < 4; i++) await beat(null, 'c12_pan_talk');
      expect(st.flag('c12_panCaught')).toBe(true);
      await beat(null, 'c12_videl_meadow');
      expect(q('c12_pan')).toBe('done');
      expect(q('c12_days')).toBe('done');

      // ============================================================================================ CHAPTER 13
      boundary(13, 'goku', ['goku', 'vegeta', 'gohan', 'piccolo', 'trunks'], false);
      expect(q('c13_team')).toBe('active');
      await beat('satan_plaza', 'c13_krillin_talk', 21, 23);
      expect(q('c13_krillin')).toBe('done');
      await beat('kame_island', 'c13_chiaotzu_talk', 16, 14);
      await beat(null, 'c13_dojo_event');
      expect(q('c13_tien')).toBe('done');
      // Played as Piccolo this time: Gohan stands in for the Lookout's Piccolo, and the training plays as Gohan.
      await enter('lookout', 26, 23);
      sim.game.switchCharacter('piccolo');
      await enter('lookout', 26, 23);
      expect(sim.game.field?.npcs.some((n) => n.def.id === 'c13_piccoloL')).toBe(false);
      await talk('c13_gohanL');
      expect(q('c13_gohan')).toBe('done');
      expect(st.data.active).toBe('piccolo');
      sim.game.switchCharacter('goku');
      expect(st.char('gohan').form).toBe('ultimate');
      expect(st.char('gohan').techs).toContain('kamehameha');
      expect(st.char('piccolo').techs).toContain('hellzoneGrenade');
      await beat('c13_monster_beach', 'c13_beach_enter', 16, 16);
      await beat('c13_monster_hut', 'c13_17_talk', 16, 11);
      await passGate('c13_g_north');
      await beat('c13_monster_camp', 'c13_camp_boss', 20, 12);
      expect(q('c13_17')).toBe('done');
      const animals: Array<[string, string]> = [
        ['c13_monster_beach', 'c13_ani1'], ['snow_peak', 'c13_ani2'], ['c13_monster_camp', 'c13_ani3'], ['kame_reef', 'c13_ani4'],
        ['waste_canyon', 'c13_ani5'], ['c13_baba_lake', 'c13_ani6'], ['paozu_home', 'c13_ani7'],
      ];
      for (const [map, id] of animals) {
        await enter(map);
        const npc = sim.game.field?.npcs.find((n) => n.def.id === id);
        expect(npc, `${id} on ${map}`).toBeTruthy();
        await run('c13_animal_talk', { npc });
      }
      await beat('c13_monster_hut', 'c13_17_talk', 16, 11);
      expect(q('c13_animals')).toBe('done');
      await beat('cc_yard', 'act5_beerus_talk', 25, 17);
      expect(q('c13_frieza')).toBe('done');
      expect(q('c13_team')).toBe('done');

      // ============================================================================================ CHAPTER 14
      boundary(14, 'goku', ['goku', 'vegeta', 'gohan', 'piccolo', 'trunks'], false);
      expect(q('c14_ready')).toBe('active');
      await beat(null, 'act5_beerus_talk');
      expect(q('c14_top')).toBe('active');
      expect(st.flag('c14_stageA')).toBe(true);
      expect(st.char('goku').techs).toContain('spiritBomb');
      await enter('top_arena_b', 3, 15);
      await beat(null, 'c14_stageB');
      expect(st.flag('c14_stageB')).toBe(true);
      await beat('top_arena_c', 'c14_stageC', 3, 17);
      expect(st.char('vegeta').form).toBe('ssbe');
      expect(st.char('vegeta').techs).toContain('finalFlash');
      expect(q('c14_top')).toBe('done');
      expect(st.flag('c14_won')).toBe(true);

      // ============================================================================================ POST-GAME
      expect(st.flag('post_game')).toBe(true);
      expect(st.data.active).toBe('goku');
      expect(st.flag('noSwitch')).toBe(false);
      expect(st.get('world')).toBe('earth');
      expect(sim.game.field?.def.id).toBe('cc_yard');
      for (const c of st.party) expect.soft(c.outfit, `${c.id} outfit after the credits`).toBeUndefined();
      expect(st.char('satan').joined).toBe(false);
      await beat('cc_yard', 'act5_beerus_talk', 25, 17);
      expect(q('post_trueEnd')).toBe('done');
      await audit('post-game');

      // The 25 Earth Delicacies, picked up where the world builders hid them, then Whis's charm (exactly once).
      const delicacies: Array<{ map: string; id: string; kind: 'pickup' | 'chest' | 'jar' }> = [];
      for (const id of Object.keys(MAPS)) {
        const def = resolveMap(id);
        for (const p of def?.pickups ?? []) if (p.item === 'delicacy') delicacies.push({ map: id, id: p.id, kind: 'pickup' });
        for (const o of def?.objects ?? []) {
          if (o.type === 'chest' && o.item === 'delicacy') delicacies.push({ map: id, id: o.id, kind: 'chest' });
          if (o.type === 'breakable' && o.item === 'delicacy' && o.id) delicacies.push({ map: id, id: o.id, kind: 'jar' });
        }
      }
      expect(delicacies.length).toBe(25);
      for (const d of delicacies) {
        if (d.kind === 'pickup') await collect(d.map, d.id);
        else if (d.kind === 'chest') await openChest(d.map, d.id);
        else {
          const had = st.count('delicacy');
          await enter(d.map);
          smash(d.id);
          const drop = sim.game.field?.pickups.find((p) => p.item === 'delicacy');
          expect(drop, `${d.id} drops a delicacy`).toBeTruthy();
          if (drop) { f().player.x = drop.x; f().player.y = drop.y + 2; }
          for (let i = 0; i < 200 && st.count('delicacy') === had; i += 5) await sim.tick(5);
          await settle();
          expect(st.count('delicacy'), d.id).toBe(had + 1);
        }
      }
      expect(st.count('delicacy')).toBe(25);
      await beat('cc_yard', 'act5_beerus_talk', 25, 17);
      expect(st.count('whisStaff')).toBe(0);
      await talk('c04_whis', 'cc_yard');
      expect(st.count('whisStaff')).toBe(1);
      expect(q('c04_delicacies')).toBe('done');
      await talk('c04_whis', 'cc_yard');
      await beat('cc_yard', 'act5_beerus_talk', 25, 17);
      expect(st.count('whisStaff')).toBe(1);

      // Trophies: grind the five heroes to L50, break their gates, open the chests -> Mr. Satan joins.
      for (const id of ['goku', 'vegeta', 'gohan', 'trunks', 'piccolo'] as CharId[]) st.gainExp(id, 1e9);
      const trophies: Array<[CharId, string, string, string]> = [
        ['gohan', 'paozu_peaks', 'trophy_gohan', 'trophyGohan'],
        ['vegeta', 'waste_mesa', 'trophy_vegeta', 'trophyVegeta'],
        ['goku', 'snow_peak', 'trophy_goku', 'trophyGoku'],
        ['trunks', 'snow_peak', 'trophy_trunks', 'trophyTrunks'],
        ['piccolo', 'snow_peak', 'trophy_piccolo', 'trophyPiccolo'],
      ];
      for (const [who, map, chest, item] of trophies) {
        await enter(map);
        sim.game.switchCharacter(who);
        const gate = sim.game.field?.map.gates.find((g) => g.def.character === who && g.def.level === 50);
        expect(gate, `${who}'s L50 gate on ${map}`).toBeTruthy();
        if (gate) breakGate(gate.def.id);
        await openChest(map, chest);
        expect(st.count(item), item).toBe(1);
      }
      sim.game.switchCharacter('goku');
      await enter('cc_yard', 22, 20);
      expect(st.char('satan').joined).toBe(true);
      expect(st.char('satan').level).toBe(Number(st.get('c14_gokuLv') ?? 0) >= 50 ? 40 : 1);
      expect(q('post_trophies')).toBe('done');
      expect(q('post_ztv')).toBe('active');

      // Alternate ending: Mr. Satan (L50) breaks the red ZTV gate and walks into the press conference.
      st.gainExp('satan', 1e9);
      expect(st.char('satan').level).toBe(50);
      await enter('satan_plaza', 8, 8);
      sim.game.switchCharacter('satan');
      const ztv = sim.game.field?.map.gates.find((g) => g.def.character === 'satan');
      expect(ztv, 'ZTV gate').toBeTruthy();
      if (ztv) breakGate(ztv.def.id);
      await beat(null, 'post_ztv_ending');
      expect(q('post_ztv')).toBe('done');
      expect(st.flag('post_ztvSeen')).toBe(true);

      // The seven animals -> 17 -> Jiren's rematch; Hit's no-rules contract.
      sim.game.switchCharacter('goku');
      await beat('c13_monster_hut', 'c13_17_talk', 16, 11);
      expect(q('post_jiren')).toBe('active');
      await beat('zeno_palace', 'post_jiren_talk', 28, 7);
      expect(q('post_jiren')).toBe('done');
      await enter('satan_plaza', 31, 6); // the hotel roof is reached from Satan City
      await beat('c12_rooftop', 'post_hit_talk', 8, 16);
      expect(q('post_hit')).toBe('done');

      // ============================================================================================ WHOLE RUN
      // Every story quest is finished; only the two skipped Days-of-Peace episodes stay open (on purpose).
      const open = Object.entries(st.data.journal).filter(([, v]) => v === 'active').map(([id]) => id).sort();
      expect.soft(open, 'quests still open at the end').toEqual(['c12_krillin', 'c12_saiyaman']);
      expect.soft(st.count('whisStaff')).toBe(1);
      for (const sp of Object.values(SPOTS)) {
        if (/^(c\d\d_|post_|spot_dev)/.test(sp.id)) continue;
        expect.soft(st.data.regions, `spot ${sp.id} unlocked`).toContain(sp.id);
      }
      expect.soft([...watch.worldFlag], 'world flag vs. map').toEqual([]);
      expect.soft([...watch.doubles], 'story characters shown twice').toEqual([]);
      expect.soft([...watch.blockers], 'NPCs on doors / arrival tiles').toEqual([]);
      expect.soft(auditErrors, 'errors walking into hubs').toEqual([]);
      expect.soft(TRANSIENT.filter((x) => st.flag(x)), 'fight flags left raised after the post-game').toEqual([]);
      expect(sim.errors).toEqual([]);
    } finally {
      for (const [id, fn] of Object.entries(originals)) SCRIPTS[id] = fn;
      // Report the natural hand-over levels (what each chapter really delivered before any level floor).
      const rows = Object.values(entries).map((e) => `c${String(e.chapter).padStart(2, '0')} ${e.map} ${JSON.stringify(e.levels)}${e.raised.length ? ` floor: ${e.raised.join(', ')}` : ''}`);
      console.log(`[full game] hand-over levels\n${rows.join('\n')}`);
      const effort = grinds.map(({ gate: g, log: l }) => `c${String(g.chapter).padStart(2, '0')} ${g.id} (${g.character} ${g.level}): L${l.from} -> L${l.to}, `
        + `${l.exp.toLocaleString('en-US')} EXP from ${l.kills} kills over ${l.visits} map visit${l.visits === 1 ? '' : 's'} (${l.maps.join(', ')})`);
      console.log(`[full game] story-gate grinding\n${effort.join('\n')}`);
      const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
      if (env.FULL_GAME_REPORT) {
        console.log(`[full game] in two places at once\n${[...watch.elsewhere].join('\n')}`);
        console.log(`[full game] quests never offered\n${Object.keys(QUESTS).filter((id) => !st.data.journal[id]).join(' ')}`);
      }
    }
  }, 1800000);
});

describe('cross-act rules the full run relies on', () => {
  it('every map start keeps the world-map flag in step with the map (story warps between worlds included)', () => {
    const sim = new Sim();
    const st = sim.game.state;
    sim.start('cc_yard', 23, 13);
    expect(st.get('world')).toBe('earth');
    sim.start('beerus_grounds'); // Chapter 7 opens here by script, not by the world map
    expect(st.get('world')).toBe('space');
    sim.start('c04_whis_field'); // reached from Beerus's planet
    expect(st.get('world')).toBe('space');
    sim.start('future_hideout_in');
    expect(st.get('world')).toBe('future');
    sim.start('c03_sky_sea'); // story-only map with no landing spot: left alone
    expect(st.get('world')).toBe('future');
    expect(sim.errors).toEqual([]);
  });

  it('a delicacy knocked out of the Satan Dojo jar waits for the player after leaving the map, once', async () => {
    const sim = new Sim();
    const st = sim.game.state;
    st.data.chapter = 13;
    st.join('goku', 45);
    st.data.active = 'goku';
    const R = makeRun(sim, { elsewhere: new Set(), worldFlag: new Set(), doubles: new Set(), blockers: new Set() });
    await R.enter('satan_dojo');
    R.smash('del_satan_dojo_1');
    const drop = () => sim.game.field?.pickups.filter((p) => p.item === 'delicacy') ?? [];
    expect(drop().length).toBe(1);
    await R.enter('satan_plaza');
    await R.enter('satan_dojo');
    expect(drop().length).toBe(1);
    const p = drop()[0];
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    f.player.x = p.x;
    f.player.y = p.y + 2;
    for (let i = 0; i < 200 && st.count('delicacy') === 0; i += 5) await sim.tick(5);
    await R.settle();
    expect(st.count('delicacy')).toBe(1);
    await R.enter('satan_dojo');
    expect(drop().length).toBe(0);
    expect(sim.errors).toEqual([]);
  });
});

describe('story gates (LoG2 §6.6: coloured level gates on the critical path)', () => {
  /** A fresh save at the gate's chapter, standing at its near-side save point; the gate shut, or broken. */
  async function nearSide(g: StoryGate, broken = false): Promise<Sim> {
    const sim = new Sim();
    const st = sim.game.state;
    st.data.chapter = g.chapter;
    if (g.standsIf) st.set(g.standsIf);
    if (broken) st.set(storyGateFlag(g));
    const [m, x, y] = g.save;
    sim.start(m, x, y);
    await sim.tick(2);
    return sim;
  }

  /** Tiles of the gate's map that lie beyond it: its far regions, and the doors and edge exits to its far maps. */
  function farTiles(g: StoryGate): string[] {
    const def = resolveMap(g.map);
    if (!def) throw new Error(`no map ${g.map}`);
    const W = def.grid[0].length;
    const H = def.grid.length;
    const out = new Set<string>();
    const area = (x0: number, y0: number, w: number, h: number) => {
      for (let y = Math.floor(y0); y < Math.ceil(y0 + h); y++) for (let x = Math.floor(x0); x < Math.ceil(x0 + w); x++) out.add(`${x},${y}`);
    };
    for (const f of g.far) {
      if (typeof f !== 'string') { if (f[0] === g.map) area(f[1], f[2], f[3], f[4]); continue; }
      for (const w of def.warps ?? []) if (w.to === f) area(w.x, w.y, w.w, w.h);
      for (const [side, ex] of Object.entries(def.exits ?? {})) {
        if (ex?.to !== f) continue;
        if (side === 'north') area(0, 0, W, 1);
        if (side === 'south') area(0, H - 1, W, 1);
        if (side === 'west') area(0, 0, 1, H);
        if (side === 'east') area(W - 1, 0, 1, H);
      }
    }
    return [...out];
  }

  /** Base EXP of every regular enemy a player can reach on each zone visit at the gate's chapter. */
  async function zoneVisits(g: StoryGate): Promise<number[][]> {
    const visits: number[][] = [];
    for (const [m, x, y] of g.zone) {
      const sim = new Sim();
      sim.game.state.data.chapter = g.chapter;
      if (g.standsIf) sim.game.state.set(g.standsIf);
      sim.start(m, x, y);
      await sim.tick(2);
      const f = sim.game.field;
      if (!f) throw new Error(`no field on ${m}`);
      const reach = sim.reach();
      visits.push(f.enemies.filter((e) => !e.dead && !e.isBoss && !e.uid && !e.def.invulnerable && e.def.exp > 0 && Sim.inReach(reach, e)).map((e) => e.def.exp));
    }
    return visits;
  }

  /**
   * Kills a player arriving at `g.arrive` needs, fighting through the zone in order with the ROM kill clamp, and the
   * zone clears that makes (every zone map visited once = 1).
   */
  function effort(g: StoryGate, visits: number[][]): { kills: number; clears: number } {
    let exp = EXP_TABLE[g.arrive];
    let kills = 0;
    const perClear = visits.reduce((n, v) => n + v.length, 0);
    for (let pass = 0; pass < 20 && levelForExp(exp) < g.level; pass++) {
      for (const base of visits.flat()) {
        if (levelForExp(exp) >= g.level) break;
        exp += killExp(base, levelForExp(exp));
        kills++;
      }
    }
    return { kills, clears: kills / perClear };
  }

  /** Capture every dialogue line shown. */
  function record(sim: Sim): Line[] {
    const said: Line[] = [];
    const say = sim.game.say.bind(sim.game);
    sim.game.say = (lines: Line[]) => { said.push(...lines); return say(lines); };
    return said;
  }

  it('lists four to six gates in story order, one per chapter, covering the whole party (LoG2: Piccolo, Vegeta, Trunks, Goku)', () => {
    expect(STORY_GATES.length).toBeGreaterThanOrEqual(4);
    expect(STORY_GATES.length).toBeLessThanOrEqual(6);
    const chapters = STORY_GATES.map((g) => g.chapter);
    expect(chapters).toEqual([...chapters].sort((a, b) => a - b));
    expect(new Set(chapters).size).toBe(chapters.length);
    expect(new Set(STORY_GATES.map((g) => g.character))).toEqual(new Set(['goku', 'vegeta', 'gohan', 'trunks', 'piccolo']));
    // Each asks for more than the character arrives with, and no more than that chapter's band allows.
    for (const g of STORY_GATES) {
      expect(g.level, g.id).toBeGreaterThan(g.arrive);
      expect(g.level, g.id).toBeLessThanOrEqual(CHAPTER_MIN_LEVEL[g.chapter + 1]);
    }
  });

  for (const g of STORY_GATES) {
    describe(`${g.id} (${g.character} ${g.level}, chapter ${g.chapter})`, () => {
      it('stands on its map in its character\'s colour, with a hint trigger, its scripts and a near-side save point', () => {
        const def = resolveMap(g.map);
        const bar = def?.barriers?.find((b) => b.id === g.id);
        expect(bar).toMatchObject({ x: g.rect[0], y: g.rect[1], w: g.rect[2], h: g.rect[3], level: g.level, character: g.character });
        expect(def?.triggers?.find((t) => t.script === storyGateHint(g))).toMatchObject({ once: true, hideIf: storyGateFlag(g) });
        expect(SCRIPTS[storyGateHint(g)]).toBeTruthy();
        g.rescue.forEach((_, i) => expect(SCRIPTS[`${g.id}_rescue${i}`]).toBeTruthy());
        const [m, x, y] = g.save;
        expect(resolveMap(m)?.objects?.some((o) => o.type === 'save' && o.x === x && o.y === y), `save point ${m} (${x},${y})`).toBe(true);
      });

      it('walls off the far side until it breaks, and the hint and the save point are on the near side', async () => {
        const shut = await nearSide(g);
        const reach = shut.reach();
        const far = farTiles(g);
        expect(far.length, 'far tiles').toBeGreaterThan(0);
        expect(far.filter((t) => reach.has(t)), 'far side reachable past a closed gate').toEqual([]);
        const [hx, hy, hw, hh] = g.hint;
        let hint = 0;
        for (let yy = hy; yy < hy + hh; yy++) for (let xx = hx; xx < hx + hw; xx++) if (reach.has(`${xx},${yy}`)) hint++;
        expect(hint, 'reachable hint tiles').toBeGreaterThan(0);
        const open = (await nearSide(g, true)).reach();
        expect(far.filter((t) => open.has(t)).length, 'far side reachable once broken').toBeGreaterThan(0);
        expect(shut.errors).toEqual([]);
      });

      it('costs about one or two clears of its zone from the level a player arrives with (EXP table + ROM kill clamp)', async () => {
        const visits = await zoneVisits(g);
        for (const [i, v] of visits.entries()) expect(v.length, `regular enemies within reach on ${g.zone[i][0]}`).toBeGreaterThan(0);
        const { kills, clears } = effort(g, visits);
        console.log(`[story gate] ${g.id}: ${g.character} L${g.arrive} -> L${g.level} = ${kills} kills, ${clears.toFixed(2)} clears of `
          + `${g.zone.map((z) => z[0]).join(' + ')} (${visits.map((v) => v.length).join('+')} enemies in reach)`);
        // A real grind (LoG2's gates were never free), but never more than two passes through the zone.
        expect(kills).toBeGreaterThanOrEqual(10);
        expect(clears).toBeGreaterThanOrEqual(0.5);
        expect(clears).toBeLessThanOrEqual(2);
      });

      it('explains itself the first time: who, what level, where to switch and where to train', async () => {
        const other = g.character === 'goku' ? 'vegeta' : 'goku';
        const sim = await nearSide(g);
        const st = sim.game.state;
        st.join(g.character, g.arrive);
        st.join(other, g.level);
        sim.game.switchCharacter(other);
        const said = record(sim);
        expect(await sim.run(storyGateHint(g))).toBe(true);
        const name = g.character === 'goku' ? 'Goku' : g.character[0].toUpperCase() + g.character.slice(1);
        const text = said.map((l) => l.text).join(' ');
        expect(said.length).toBeGreaterThanOrEqual(3);
        expect(text).toContain(`only to ${name}. This one needs level ${g.level}.`);
        expect(text).toContain(`${name} is level ${g.arrive}.`);
        expect(text).toContain(`Switch to ${name} at ${g.saveAt}.`);
        expect(text).toContain(g.train);
        // Played as the gate's own character, strong enough: no switching, just the go-ahead.
        st.join(g.character, g.level);
        sim.game.switchCharacter(g.character);
        said.length = 0;
        expect(await sim.run(storyGateHint(g))).toBe(true);
        expect(said.map((l) => l.text).join(' ')).toContain('strong enough: hit the barrier');
        expect(sim.errors).toEqual([]);
      });

      it('breaks only for its own character at its level', async () => {
        const sim = await nearSide(g);
        const st = sim.game.state;
        const f = () => sim.game.field;
        const gate = () => f()?.map.gates.find((x) => x.def.id === g.id);
        const other = g.character === 'goku' ? 'vegeta' : 'goku';
        st.join(other, 50);
        sim.game.switchCharacter(other);
        const r = gate()?.def;
        const rect = { x: g.rect[0] * TILE, y: g.rect[1] * TILE, w: g.rect[2] * TILE, h: g.rect[3] * TILE };
        expect(r).toBeTruthy();
        f()?.meleeHit(rect, 10, 1);
        expect(gate()?.broken, 'another character at L50').toBe(false);
        st.join(g.character, g.level - 1);
        sim.game.switchCharacter(g.character);
        f()?.meleeHit(rect, 10, 1);
        expect(gate()?.broken, `${g.character} at L${g.level - 1}`).toBe(false);
        st.join(g.character, g.level);
        sim.game.switchCharacter(g.character);
        f()?.meleeHit(rect, 10, 1);
        expect(gate()?.broken, `${g.character} at L${g.level}`).toBe(true);
        expect(st.flag(storyGateFlag(g))).toBe(true);
      });

      for (const [i, place] of g.rescue.entries()) {
        const [m, region] = typeof place === 'string' ? [place, undefined] : [place[0], place.slice(1) as number[]];
        it(`opens behind a hero resuming beyond it (${m}${region ? ` ${region.join(',')}` : ''}), so an old save is never walled in`, async () => {
          const sim = new Sim();
          const st = sim.game.state;
          st.data.chapter = g.chapter;
          if (g.standsIf) st.set(g.standsIf);
          const save = resolveMap(m)?.objects?.find((o) => o.type === 'save');
          const [x, y] = region ? [region[0] + Math.floor(region[2] / 2), region[1] + Math.floor(region[3] / 2)] : [save?.x, save?.y];
          sim.start(m, x, y);
          await sim.idle();
          expect(st.flag(storyGateFlag(g)), `rescue ${i}`).toBe(true);
          if (m === g.map) expect(sim.game.field?.map.gates.find((x2) => x2.def.id === g.id)?.broken).toBe(true);
          // The same entry on the near side leaves the gate alone.
          const near = await nearSide(g);
          await near.idle();
          expect(near.game.state.flag(storyGateFlag(g))).toBe(false);
        });
      }
    });
  }

  it('a chapter start opens the story gates of earlier chapters (standalone starts), and a story hand-over only nets the hero at band - 5', () => {
    const api = (st: GameState): ScriptApi => ({
      state: st, unlockRegion: (id: string) => { if (!st.data.regions.includes(id)) st.data.regions.push(id); },
    }) as unknown as ScriptApi;
    const st = new GameState();
    ensureChapterState(api(st), 10);
    for (const g of STORY_GATES) expect(st.flag(storyGateFlag(g)), g.id).toBe(g.chapter < 10);
    // Story run: the outgoing hero below the net is lifted to it, never to the band; nobody else moves.
    const run = new GameState();
    ensureChapterState(api(run), 0);
    run.join('goku', 20);
    run.join('vegeta', 25);
    run.data.active = 'goku';
    run.data.chapter = 7;
    ensureChapterState(api(run), 8);
    expect(run.char('goku').level).toBe(CHAPTER_MIN_LEVEL[8] - HANDOVER_LEVEL_GAP);
    expect(run.char('vegeta').level).toBe(25);
    run.join('goku', 26);
    ensureChapterState(api(run), 8);
    expect(run.char('goku').level).toBe(26);
  });
});
