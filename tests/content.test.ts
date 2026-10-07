import { describe, expect, it, vi } from 'vitest';
import '../src/content';
import { propArt } from '../src/art/props';
import { CAST, CAST_NAMES } from '../src/content/cast';
import { CHARACTERS } from '../src/content/characters';
import { CREATURES } from '../src/content/creatures';
import { ENEMIES } from '../src/content/enemies';
import { ITEMS } from '../src/content/items';
import { QUESTS } from '../src/content/quests';
import { MAPS, resolveMap } from '../src/content/registry';
import { GENERIC_SCAN_KEY, GENERIC_SCAN_SPRITES, namedScanCount, NPC_SCAN_OVERRIDES, SCAN_ALIASES, SCANS, scanEntries, scanEntryCount, scanKey, scanNpc } from '../src/content/scans';
import { SPOTS } from '../src/content/world';
import { FORMS } from '../src/content/characters';
import { TECHNIQUES } from '../src/content/techniques';
import { Enemy } from '../src/game/enemy';
import { SCRIPTS } from '../src/game/script';
import { parseGrid } from '../src/game/world';
import { SCREEN_W, TILE } from '../src/engine/constants';
import { measure, wrap } from '../src/engine/fontdata';
import { ScouterScene } from '../src/ui/scouter';
import { ScouterDbScene } from '../src/ui/scouterdb';
import { DEV_QUESTS } from '../src/content/dev/quests';
import { DEV_ENEMIES, DEV_MAPS, DEV_SCRIPTS, DEV_SPOTS } from '../src/content/dev/sandbox';
import { CollisionMap, type CornerSlide } from '../src/game/collision';
import type { MapDef } from '../src/game/mapdef';
import { GameState } from '../src/game/state';
import { setGroundCacheLimit } from '../src/game/world';
import type { Rect } from '../src/engine/math';
import { clearZone, mainRoots } from './fairbot';
import storyFights from './fixtures/story_fights.json';
import { type RecordedRoot, Sim } from './sim';
import { arrivals, gridCache, scanGrid, scanMap, scanStory, VARIANTS, WalkGrid } from './walkscan';

const sprite = (id: string) => !!(CAST[id] || CREATURES[id]);

describe('content integrity', () => {
  for (const id of Object.keys(MAPS)) {
    it(`map ${id}`, () => {
      const m = resolveMap(id);
      expect(m).toBeTruthy();
      if (!m) return;
      const grid = parseGrid(m);
      const W = grid[0].length;
      const H = grid.length;
      const inb = (x: number, y: number, what: string) => {
        expect(x >= 0 && x < W && y >= 0 && y < H, `${id}: ${what} at ${x},${y} out of bounds ${W}x${H}`).toBe(true);
      };
      const scr = (s: string | undefined, what: string) => { if (s) expect(SCRIPTS[s], `${id}: ${what} script "${s}" missing`).toBeTruthy(); };
      for (const e of [m.onEnter].flat()) scr(e, 'onEnter');
      for (const n of m.npcs ?? []) {
        expect(sprite(n.sprite), `${id}: npc ${n.id} sprite ${n.sprite}`).toBe(true);
        if (n.talk) scr(n.talk, `npc ${n.id}`);
        inb(n.x, n.y, `npc ${n.id}`);
      }
      for (const e of m.enemies ?? []) {
        expect(ENEMIES[e.type], `${id}: enemy type ${e.type}`).toBeTruthy();
        scr(e.onDefeat, `enemy ${e.type} onDefeat`);
        inb(e.x, e.y, `enemy ${e.type}`);
      }
      for (const w of m.warps ?? []) {
        expect(MAPS[w.to], `${id}: warp to ${w.to}`).toBeTruthy();
        scr(w.lockedScript, 'warp locked');
        if (MAPS[w.to]) {
          const tg = parseGrid(MAPS[w.to]);
          expect(w.tx >= 0 && w.tx < tg[0].length && w.ty >= 0 && w.ty < tg.length, `${id}: warp dest ${w.to} ${w.tx},${w.ty} out of bounds`).toBe(true);
        }
      }
      for (const [side, ex] of Object.entries(m.exits ?? {})) {
        if (!ex) continue;
        expect(MAPS[ex.to], `${id}: ${side} exit to ${ex.to}`).toBeTruthy();
        scr(ex.lockedScript, 'exit locked');
      }
      for (const t of m.triggers ?? []) { scr(t.script, `trigger ${t.id}`); inb(t.x, t.y, `trigger ${t.id}`); }
      for (const p of m.pickups ?? []) { expect(ITEMS[p.item], `${id}: pickup item ${p.item}`).toBeTruthy(); inb(p.x, p.y, `pickup ${p.id}`); }
      for (const b of m.barriers ?? []) {
        if (b.character) expect(CHARACTERS[b.character as keyof typeof CHARACTERS], `${id}: gate character ${b.character}`).toBeTruthy();
        inb(b.x, b.y, `gate ${b.id}`);
      }
      for (const o of m.objects ?? []) {
        inb(o.x, o.y, `object ${o.type}`);
        if (o.type === 'flight') expect(MAPS[o.to], `${id}: flight to ${o.to}`).toBeTruthy();
        if (o.type === 'chest' || (o.type === 'breakable' && o.item)) expect(ITEMS[o.item as string], `${id}: object item ${o.item}`).toBeTruthy();
      }
      for (const p of m.props ?? []) {
        const kind = Array.isArray(p) ? p[0] : p.kind;
        expect(() => propArt(kind), `${id}: prop ${kind}`).not.toThrow();
      }
    });
  }

  it('every map enemy spawn starts clear of terrain, props and gates (an overlapping one is frozen in place for good)', () => {
    const stuck: string[] = [];
    for (const id of Object.keys(MAPS)) {
      const m = resolveMap(id);
      if (!m?.enemies?.length) continue;
      const sim = new Sim();
      sim.game.state.data.chapter = 15;
      for (const b of m.barriers ?? []) sim.game.state.set(`gate:${id}:${b.id}`);
      sim.start(id);
      const f = sim.game.field;
      if (!f) throw new Error(`no field on ${id}`);
      for (const s of m.enemies) {
        // Field.enter places a map spawn at the tile's centre, feet near its bottom edge.
        const e = new Enemy(s.type, s.x * TILE + 8, s.y * TILE + 14);
        if (f.col.blocked(e.box(), e.flying)) stuck.push(`${id}: ${s.type} at ${s.x},${s.y}`);
      }
    }
    expect(stuck).toEqual([]);
  }, 120000);

  it('enemies reference valid sprites, scripts and minions', () => {
    for (const e of Object.values(ENEMIES)) {
      expect(sprite(e.sprite), `enemy ${e.id} sprite ${e.sprite}`).toBe(true);
      if (e.boss?.minion) expect(ENEMIES[e.boss.minion], `enemy ${e.id} minion`).toBeTruthy();
      for (const ph of e.boss?.phases ?? []) if (ph.onStart) expect(SCRIPTS[ph.onStart], `enemy ${e.id} phase script ${ph.onStart}`).toBeTruthy();
      expect(e.end, `enemy ${e.id} END must stay below 124`).toBeLessThan(124);
    }
  });

  it('landing spots and quests are consistent', () => {
    for (const s of Object.values(SPOTS)) expect(MAPS[s.map], `spot ${s.id} map ${s.map}`).toBeTruthy();
    for (const q of Object.values(QUESTS)) if (q.region) expect(SPOTS[q.region], `quest ${q.id} region ${q.region}`).toBeTruthy();
  });

  it('forms and techniques reference valid data', () => {
    for (const f of Object.values(FORMS)) if (f.sprite) expect(sprite(f.sprite), `form ${f.id} sprite ${f.sprite}`).toBe(true);
    for (const c of Object.values(CHARACTERS)) {
      expect(sprite(c.sprite), `char ${c.id}`).toBe(true);
      for (const s of Object.values(c.formSprites)) expect(sprite(s), `char ${c.id} form sprite ${s}`).toBe(true);
    }
    expect(Object.keys(TECHNIQUES).length).toBeGreaterThan(5);
  });
});

// ------------------------------------------------------------------ Scouter database (LoG2 §8.5: 128 entries)

const CONTENT_SOURCES = import.meta.glob<string>('../src/content/**/*.ts', { query: '?raw', import: 'default', eager: true });

/**
 * Every sprite that can stand in the field as a scannable NPC, with where it is used: map NPCs (including chapter
 * overlays), scripted spawns and sprite swaps (`s.spawn`, `s.sprite`, and the acts' `actor(s, id, sprite, ...)`-style
 * helpers), and the whole humanoid cast, since any of it can be spawned through a helper with a computed sprite.
 */
function scannableSprites(): Map<string, Array<{ where: string; npcId?: string }>> {
  const out = new Map<string, Array<{ where: string; npcId?: string }>>();
  const add = (s: string, where: string, npcId?: string) => {
    if (!sprite(s)) return;
    if (!out.has(s)) out.set(s, []);
    out.get(s)?.push({ where, npcId });
  };
  for (const id of Object.keys(MAPS)) for (const n of resolveMap(id)?.npcs ?? []) add(n.sprite, `${id}:${n.id}`, n.id);
  for (const [file, src] of Object.entries(CONTENT_SOURCES)) {
    for (const m of src.matchAll(/\.(?:spawn|sprite|addNpc)\(\s*[^,()]+,\s*'([A-Za-z0-9_]+)'/g)) add(m[1], file);
    for (const m of src.matchAll(/\(\s*s\s*,\s*'[^']+'\s*,\s*'([A-Za-z0-9_]+)'\s*,/g)) add(m[1], file);
  }
  for (const id of Object.keys(CAST)) add(id, 'cast');
  return out;
}

describe('scouter database coverage', () => {
  const sprites = scannableSprites();

  it('finds the sprites to check (enumeration sanity)', () => {
    for (const id of ['hit', 'champa', 'vados', 'cabba', 'frost', 'botamo', 'monaka', 'zeno', 'grandPriest', 'gowasu', 'zamasu', 'kingKai', 'supremeKai', 'oldKai', 'korin', 'mrPopo', 'pan', 'babarian', 'caulifla', 'kale', 'ribrianne', 'gamisalas', 'prideTrooper', 'vegetaCasual', 'alienFish']) {
      expect(sprites.has(id), `sprite ${id} not enumerated`).toBe(true);
    }
  });

  it('no named character, creature or extra falls back to the generic Earthling reading', () => {
    const bad: string[] = [];
    for (const [s, uses] of sprites) {
      for (const u of uses) {
        const r = scanNpc(s, u.npcId);
        const generic = r.id === `npc:${GENERIC_SCAN_KEY}`;
        const disguised = !!(u.npcId && NPC_SCAN_OVERRIDES[u.npcId]);
        if (generic !== (GENERIC_SCAN_SPRITES.has(s) && !disguised)) bad.push(`${s} (${u.where}) -> ${r.id}`);
      }
    }
    expect(bad, 'sprites scanning wrongly (named -> Earthling, or generic -> named)').toEqual([]);
  });

  it('every humanoid cast member has a named entry of its own or through its base character', () => {
    const missing = Object.keys(CAST).filter((id) => !GENERIC_SCAN_SPRITES.has(id) && !scanKey(id));
    expect(missing, 'cast ids without a scan entry or alias').toEqual([]);
  });

  it('forms and outfits file under their base character', () => {
    const cases: Array<[string, string]> = [
      ['vegetaCasual', 'vegeta'], ['vegetaSSB', 'vegeta'], ['gokuUI', 'goku'], ['gokuSSJ', 'goku'], ['krillinGi', 'krillin'],
      ['goldenFrieza', 'frieza'], ['gohanSuit', 'gohan'], ['piccoloUnweighted', 'piccolo'], ['cabbaSSJ', 'cabba'],
      ['android17Top', 'android17'], ['futureTrunksSSJ', 'futureTrunks'], ['blackRose', 'gokuBlack'],
    ];
    for (const [variant, base] of cases) expect(scanNpc(variant).id, variant).toBe(`npc:${base}`);
    for (const c of Object.values(CHARACTERS)) {
      for (const s of [c.sprite, ...Object.values(c.formSprites)]) expect(scanKey(s), `${c.id} form sprite ${s}`).toBe(scanKey(c.sprite));
    }
  });

  it('aliases, generic sprites and NPC overrides are consistent', () => {
    for (const [from, to] of Object.entries(SCAN_ALIASES)) {
      expect(sprite(from), `alias source ${from} is not a sprite`).toBe(true);
      expect(SCANS[to], `alias ${from} -> ${to}: no entry`).toBeTruthy();
      expect(SCANS[from], `alias ${from} is shadowed by its own entry`).toBeUndefined();
      expect(SCAN_ALIASES[to], `alias ${from} -> ${to} chains`).toBeUndefined();
    }
    for (const g of GENERIC_SCAN_SPRITES) {
      expect(CAST[g], `generic sprite ${g}`).toBeTruthy();
      expect(SCANS[g], `generic sprite ${g} also has a named entry`).toBeUndefined();
    }
    const npcIds = new Set(Object.keys(MAPS).flatMap((id) => (resolveMap(id)?.npcs ?? []).map((n) => n.id)));
    for (const [npc, key] of Object.entries(NPC_SCAN_OVERRIDES)) {
      expect(npcIds.has(npc), `override for unknown NPC ${npc}`).toBe(true);
      expect(SCANS[key], `override ${npc} -> ${key}`).toBeTruthy();
    }
    // A main-cast character standing in a generic uniform (Krillin on police duty) must still scan as themselves.
    const core = new Map(Object.keys(SCANS).filter((k) => CAST[k] && !/^(c\d\d|ea|eb|fc)_/.test(k)).map((k) => [CAST_NAMES[k] ?? SCANS[k].name, k]));
    for (const id of Object.keys(MAPS)) {
      for (const n of resolveMap(id)?.npcs ?? []) {
        if (!GENERIC_SCAN_SPRITES.has(n.sprite) || !n.name || !core.has(n.name)) continue;
        expect(scanNpc(n.sprite, n.id).id, `${id}: ${n.name} (${n.id}) in a generic sprite`).toBe(`npc:${core.get(n.name)}`);
      }
    }
  });

  it('entries are complete and fit the readout and the database panel', () => {
    const stat = (v: number | string) => v === '???' || (typeof v === 'number' && Number.isInteger(v) && v > 0);
    for (const [id, e] of Object.entries(SCANS)) {
      expect(e.name.trim(), `scan ${id} name`).not.toBe('');
      expect(measure(e.name), `scan ${id} name "${e.name}" too wide for the list`).toBeLessThanOrEqual(96);
      expect(e.kind, `scan ${id} needs a race / universe / affiliation line`).toBeTruthy();
      expect(measure(e.kind ?? ''), `scan ${id} kind "${e.kind}" too wide`).toBeLessThanOrEqual(116);
      for (const v of [e.hp, e.str, e.pow, e.end]) expect(stat(v), `scan ${id} stat ${v}`).toBe(true);
      expect(wrap(e.desc, SCREEN_W - 40).length, `scan ${id} desc overflows the field readout`).toBeLessThanOrEqual(4);
      expect(wrap(e.desc, 118).length, `scan ${id} desc overflows the database panel`).toBeLessThanOrEqual(7);
    }
    for (const e of Object.values(ENEMIES)) {
      expect(wrap(e.desc, SCREEN_W - 40).length, `enemy ${e.id} desc overflows the field readout`).toBeLessThanOrEqual(4);
      expect(wrap(e.desc, 118).length, `enemy ${e.id} desc overflows the database panel`).toBeLessThanOrEqual(7);
    }
  });

  it('matches or beats LoG2\'s 128-entry database', () => {
    expect(Object.keys(SCANS).length).toBeGreaterThanOrEqual(128);
    // Named entries a player can actually file from the field, before counting a single bestiary scan.
    const named = new Set([...sprites.keys()].map((s) => scanNpc(s).id).filter((id) => id.startsWith('npc:') && id !== `npc:${GENERIC_SCAN_KEY}`));
    expect(named.size).toBeGreaterThanOrEqual(128);
  });
});

describe('scouter scan and database', () => {
  const canvas = () => {
    const c = document.createElement('canvas');
    c.width = 240;
    c.height = 160;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    return ctx;
  };

  it('scans NPCs into the right database ids and shows their readings', () => {
    const sim = new Sim();
    sim.start('cc_yard');
    const g = sim.game;
    const f = g.field;
    if (!f) throw new Error('no field');
    f.npcs.length = 0;
    f.enemies.length = 0;
    const px = f.player.x;
    const py = f.player.y;
    const casual = f.addNpc('t_vegeta', 'vegetaCasual', px + 40, py);
    const local = f.addNpc('t_local', 'townsman', px - 40, py, 'down', 'Neighbour');
    const machine = f.addNpc('t_exc', 'c09_excavator', px, py - 50);
    g.state.data.scans = [];
    const ctx = canvas();
    const scanAt = (a: { body(): { x: number; y: number; w: number; h: number } }) => {
      const sc = new ScouterScene(g);
      const b = a.body();
      Object.assign(sc as unknown as { cx: number; cy: number }, { cx: b.x + b.w / 2 - f.camera.x, cy: b.y + b.h / 2 - f.camera.y });
      sim.input.inject('A', true);
      sim.input.poll();
      sc.update(sim.input);
      sim.input.inject('A', false);
      sim.input.poll();
      sc.render(ctx);
      return (sc as unknown as { readout: { id: string; name: string; kind: string; hp: number | string } | null }).readout;
    };
    const v = scanAt(casual);
    expect(v?.id).toBe('npc:vegeta');
    expect(v?.name).toBe('Vegeta');
    expect(v?.kind).toBe(SCANS.vegeta.kind);
    const l = scanAt(local);
    expect(l?.id).toBe(`npc:${GENERIC_SCAN_KEY}`);
    expect(l?.name).toBe('Neighbour');
    expect(l?.hp).toBe(32);
    const m = scanAt(machine);
    expect(m?.id).toBe('enemy:c09_excavator');
    expect(m?.hp).toBe(ENEMIES.c09_excavator.hp);
    expect(g.state.data.scans).toEqual(['npc:vegeta', `npc:${GENERIC_SCAN_KEY}`, 'enemy:c09_excavator']);
  });

  it('the Capsule Corp database merges variants, sorts by name and draws every entry', () => {
    const sim = new Sim();
    sim.start('cc_yard');
    const g = sim.game;
    g.state.data.scans = ['npc:vegeta', 'npc:vegetaCasual', 'npc:hit', 'enemy:c09_excavator', `npc:${GENERIC_SCAN_KEY}`, 'npc:champa', 'npc:c13_cauliflaSSJ'];
    const db = new ScouterDbScene(g);
    const entries = (db as unknown as { entries: Array<{ id: string; name: string; kind: string }> }).entries;
    expect(entries.map((e) => e.id)).toEqual(['npc:c13_cauliflaSSJ', 'npc:champa', 'npc:human', 'enemy:c09_excavator', 'npc:hit', 'npc:vegeta']);
    expect(entries.find((e) => e.id === 'npc:champa')?.kind).toBe('U6 God of Destruction');
    const ctx = canvas();
    for (let i = 0; i < entries.length; i++) {
      db.render(ctx);
      sim.input.inject('down', true);
      sim.input.poll();
      db.update(sim.input);
      sim.input.inject('down', false);
      sim.input.poll();
    }
  });
});

/** Registries of a freshly loaded content graph, as a build whose `import.meta.env.DEV` is `dev` holds them. */
async function loadContent(dev: boolean) {
  vi.stubEnv('DEV', dev);
  vi.resetModules();
  try {
    await import('../src/content');
    const registry = await import('../src/content/registry');
    return {
      maps: registry.MAPS,
      resolveMap: registry.resolveMap,
      enemies: (await import('../src/content/enemies')).ENEMIES,
      scripts: (await import('../src/game/script')).SCRIPTS,
      spots: (await import('../src/content/world')).SPOTS,
      quests: (await import('../src/content/quests')).QUESTS,
    };
  } finally {
    vi.unstubAllEnvs();
    vi.resetModules();
  }
}

describe('developer content stays out of production builds', () => {
  it('the dev server and the tests register the test maps, sparring robot, scripts, spots and dev quest', () => {
    for (const m of DEV_MAPS) expect(MAPS[m.id], m.id).toBe(m);
    for (const e of DEV_ENEMIES) expect(ENEMIES[e.id], e.id).toBe(e);
    for (const [id, fn] of Object.entries(DEV_SCRIPTS)) expect(SCRIPTS[id], id).toBe(fn);
    for (const sp of DEV_SPOTS) expect(SPOTS[sp.id], sp.id).toBe(sp);
    for (const q of DEV_QUESTS) expect(QUESTS[q.id], q.id).toBe(q);
  });

  it('with import.meta.env.DEV off (a production build) the registries and the journal hold none of it', async () => {
    const dev = await loadContent(true);
    const prod = await loadContent(false);
    expect(prod.maps).not.toBe(dev.maps);
    // Fresh graphs both: production holds everything the dev build does, minus exactly the dev content.
    const minus = (all: Record<string, unknown>, drop: string[]) => Object.keys(all).filter((id) => !drop.includes(id)).sort();
    expect(Object.keys(prod.maps).sort()).toEqual(minus(dev.maps, DEV_MAPS.map((m) => m.id)));
    expect(Object.keys(prod.enemies).sort()).toEqual(minus(dev.enemies, DEV_ENEMIES.map((e) => e.id)));
    expect(Object.keys(prod.scripts).sort()).toEqual(minus(dev.scripts, Object.keys(DEV_SCRIPTS)));
    expect(Object.keys(prod.spots).sort()).toEqual(minus(dev.spots, DEV_SPOTS.map((sp) => sp.id)));
    expect(Object.keys(prod.quests).sort()).toEqual(minus(dev.quests, DEV_QUESTS.map((q) => q.id)));
    for (const m of DEV_MAPS) expect(dev.maps[m.id], m.id).toBeTruthy();
    // Nothing left in production leads to a dev map: no map in the dev region, and no exit, warp or flight circle
    // (chapter overlays included) or landing spot into one.
    const devRegions = new Set(DEV_MAPS.map((m) => m.region));
    for (const id of Object.keys(prod.maps)) {
      const m = prod.resolveMap(id);
      expect(m, id).toBeTruthy();
      if (!m) continue;
      expect(devRegions.has(m.region), `${m.id} region ${m.region}`).toBe(false);
      for (const ex of Object.values(m.exits ?? {})) if (ex) expect(prod.maps[ex.to], `${m.id} exit to ${ex.to}`).toBeTruthy();
      for (const w of m.warps ?? []) expect(prod.maps[w.to], `${m.id} warp to ${w.to}`).toBeTruthy();
      for (const o of m.objects ?? []) if (o.type === 'flight') expect(prod.maps[o.to], `${m.id} flight to ${o.to}`).toBeTruthy();
    }
    for (const sp of Object.values(prod.spots)) if (sp.map) expect(prod.maps[sp.map], `${sp.id} lands on ${sp.map}`).toBeTruthy();
    // The production journal: every gold (main story) objective carries its world-map star, as in LoG2, and every
    // star points at a landing spot that ships.
    const starless = Object.values(prod.quests).filter((q) => q.star === 'gold' && !q.region).map((q) => q.id);
    expect(starless).toEqual([]);
    for (const q of Object.values(prod.quests)) if (q.region) expect(prod.spots[q.region], `${q.id} star on ${q.region}`).toBeTruthy();
  });
});

describe('scouter scan counts (pause screen, database and Bulma\'s errand agree)', () => {
  // A save from before the alias table: Vegeta filed twice (casual outfit and base), Goku twice (Whis gi and base),
  // a townsperson, a creature stand-in and Krillin.
  const OLD_SAVE = ['npc:vegetaCasual', 'npc:vegeta', 'npc:gokuWhis', 'npc:goku', `npc:${GENERIC_SCAN_KEY}`, 'enemy:c09_excavator', 'npc:krillin'];

  it('counts unique database entries: a variant id and its base character are one entry', () => {
    expect(scanEntries(OLD_SAVE)).toEqual(['npc:vegeta', 'npc:goku', `npc:${GENERIC_SCAN_KEY}`, 'enemy:c09_excavator', 'npc:krillin']);
    expect(scanEntryCount(OLD_SAVE)).toBe(5);
    expect(namedScanCount(OLD_SAVE)).toBe(3);
    expect(scanEntryCount([])).toBe(0);
    // Ids the game no longer knows read as the generic Earthling entry, so they never inflate either count.
    expect(scanEntryCount(['npc:noSuchCharacter', `npc:${GENERIC_SCAN_KEY}`, 'enemy:noSuchEnemy'])).toBe(1);
    expect(namedScanCount(['npc:noSuchCharacter', 'enemy:c09_excavator'])).toBe(0);
  });

  it('the Capsule Corp database lists exactly the counted entries', () => {
    const sim = new Sim();
    sim.start('cc_yard');
    sim.game.state.data.scans = [...OLD_SAVE];
    const db = new ScouterDbScene(sim.game);
    const entries = (db as unknown as { entries: Array<{ id: string }> }).entries;
    expect(entries.length).toBe(scanEntryCount(OLD_SAVE));
    expect(entries.map((e) => e.id).sort()).toEqual(scanEntries(OLD_SAVE).sort());
  });

  it('Bulma\'s Scouter test wants five different guests, not five stored ids', async () => {
    const sim = new Sim();
    const st = sim.game.state;
    st.data.chapter = 2;
    st.join('vegeta', 9);
    st.data.active = 'vegeta';
    st.set('c02_boarded');
    st.set('c02_scouter');
    st.addQuest('c02_scan');
    sim.start('c02_deck', 20, 7);
    for (let i = 0; i < 4000 && sim.game.lockDepth > 0; i += 10) await sim.tick(10);
    const bulma = sim.game.field?.npcs.find((n) => n.def.id === 'c02_bulma');
    expect(bulma).toBeTruthy();
    const talk = async () => expect(await sim.run(bulma?.def.talk ?? '', bulma ? { npc: bulma } : {})).toBe(true);
    // Five stored ids but four guests: an old save filed Goku in Whis's gi apart from Goku.
    st.data.scans = ['npc:krillin', 'npc:android18', 'npc:yamcha', 'npc:gokuWhis', 'npc:goku'];
    await talk();
    expect(st.data.journal.c02_scan).toBe('active');
    expect(st.count('pow1')).toBe(0);
    st.data.scans.push('npc:tien');
    await talk();
    expect(st.data.journal.c02_scan).toBe('done');
    expect(st.count('pow1')).toBe(1);
    expect(sim.errors).toEqual([]);
  }, 120000);
});

describe('wedges: nowhere a player can get to holds the hero for good (critic round 3, gap 5)', () => {
  /** A box walked with a held direction for `frames` frames (CollisionMap.move, 1 px a frame; the player's assist). */
  const hold = (col: CollisionMap, from: Rect, dx: number, dy: number, frames: number, slide: CornerSlide = 'assist'): Rect => {
    const b = { ...from };
    for (let i = 0; i < frames; i++) {
      const r = col.move(b, dx, dy, false, slide);
      b.x += r.dx;
      b.y += r.dy;
    }
    return b;
  };

  it('holding right slides past the Crater Rim rock into the lane beside the cliff (the fair bot stood there for good)', () => {
    const g = new WalkGrid('c07_nameless_rim', 'start');
    // Feet half a pixel up into the rock's footprint on row 5; the cliff is 8 px below it, so a fixed 4 px probe
    // under the rock never found the lane and the step east stalled.
    const at = { x: 246.54524687013253, y: 87.50394104199006, w: 10, h: 6 };
    expect(g.col.blocked(at)).toBe(false);
    const end = hold(g.col, at, 1, 0, 40);
    expect(end.x).toBeGreaterThan(at.x + 20);
    expect(g.col.blocked(end)).toBe(false);
    // Enemies and NPCs keep the probe slide their steering was tuned with: it stalls there, as the hero used to.
    expect(hold(g.col, at, 1, 0, 40, 'probe')).toEqual(at);
  });

  it('the corner assist never slides flush into a gap exactly the feet box\'s size, and keeps clear of walls', () => {
    const col = new CollisionMap(8, 8);
    // Two posts 10 px apart (x 32-42 open): a 10-wide box fits only exactly; one pixel more and the nudge takes it.
    col.addRect({ x: 22, y: 40, w: 10, h: 16 });
    col.addRect({ x: 42, y: 40, w: 10, h: 16 });
    const above = { x: 33.5, y: 30, w: 10, h: 6 };
    const stuck = hold(col, above, 0, 1, 30);
    expect(stuck.y).toBeLessThanOrEqual(34);
    expect(col.blocked(stuck)).toBe(false);
    const wide = new CollisionMap(8, 8);
    wide.addRect({ x: 22, y: 40, w: 10, h: 16 });
    wide.addRect({ x: 43, y: 40, w: 10, h: 16 });
    const through = hold(wide, above, 0, 1, 40);
    expect(through.y).toBeGreaterThan(56);
    expect(wide.blocked(through)).toBe(false);
  });

  it('the fair bot walks round the cliff when its feet sit at the very top of a tile below it (Potaufeu, seed 3)', async () => {
    const st = new GameState();
    st.data.chapter = 8;
    st.join('vegeta', 26);
    st.data.active = 'vegeta';
    let placed = false;
    const res = await clearZone(JSON.stringify(st.data), 'c08_potaufeu_mushrooms', 3, {
      stallFrames: 45 * 60,
      watch: (bot) => {
        const f = bot.game.field;
        if (!f) return;
        const beetle = f.enemies.find((e) => e.def.id === 'c08_sporeBeetle');
        if (!placed) {
          placed = true;
          // Where the round-3 clear stalled: the hero under the cliff south of the eastern ledge, the last beetle on it.
          for (const e of f.enemies) if (e !== beetle) e.dead = true;
          f.player.x = 548.3671177705085;
          f.player.y = 294.286881112341;
        }
        // The beetle stayed on its ledge, charging the hero straight into the cliff, until the hero came round.
        if (beetle && f.player.y > 200) { beetle.x = 549; beetle.y = 143; }
      },
    });
    expect(placed).toBe(true);
    expect(res.stopped).toBe('cleared');
  }, 120000);

  it('the scan finds the traps it is for (fixture maps)', () => {
    setGroundCacheLimit(200);
    // West room with a warp out, a wall at column 5 with a gap on row 3, and a chest in the east room.
    const base = (rows: string[], props: MapDef['props'] = []): MapDef => ({
      id: `walkscan_fixture_${rows.join('').length}_${props.length}`, name: 'Fixture', music: 'peaceful',
      legend: { '.': 'grass', '#': 'cliff' }, grid: rows, props,
      warps: [{ x: 1, y: 6, w: 1, h: 1, to: 'paozu_valley', tx: 10, ty: 10 }],
      objects: [{ type: 'chest', x: 9, y: 5, id: 'walkscan_fixture', item: 'senzu' }],
    });
    const open = ['############', '#....#.....#', '#....#.....#', '#..........#', '#....#.....#', '#....#.....#', '#....#.....#', '############'];
    const shut = open.map((r, y) => (y === 3 ? '#....#.....#' : r));
    const west = [{ px: 2 * TILE + 8, py: 3 * TILE + 14, src: null, from: 'fixture arrival' }];
    const east = [{ px: 8 * TILE + 8, py: 3 * TILE + 14, src: null, from: 'east arrival' }];
    const scan = (def: MapDef, arr = west) => scanGrid(new WalkGrid(def, 'open'), 'open', arr).problems;
    expect(scan(base(open))).toEqual([]);
    // Rubble above and below the gap: 6 px (the feet box exactly) or 7 px between their footprints.
    const narrow = (gap: number): MapDef['props'] => [['rubble', 79 / TILE, 42 / TILE], ['rubble', 79 / TILE, (49 + gap) / TILE]];
    expect(scan(base(open, narrow(6)))).toEqual(['tight gap: chest at 9,5 is reached only through a gap exactly as wide as the feet box']);
    expect(scan(base(open, narrow(7)))).toEqual([]);
    expect(scan(base(shut))).toEqual(['unreachable: chest at 9,5']);
    expect(scan(base(shut), east)).toEqual(['pocket: east arrival lands where no warp, edge exit, flight circle or world sign can be reached']);
    expect(scan(base(open), [{ px: 5 * TILE + 8, py: 2 * TILE + 14, src: null, from: 'wall arrival' }])[0]).toMatch(/^arrival inside a wall: wall arrival/);
  });

  for (const variant of VARIANTS) {
    it(`every map (${variant === 'start' ? 'as a new game finds it' : 'every gate open, every rock broken'}): arrivals land free, nothing is out of reach, no snag or knock-back pocket`, () => {
      setGroundCacheLimit(200);
      const grids = gridCache(variant);
      const problems: string[] = [];
      let reached = 0;
      for (const id of Object.keys(MAPS)) {
        const r = scanMap(id, variant, grids);
        reached += r.reachable;
        for (const p of r.problems) problems.push(`${id}: ${p}`);
      }
      // Sanity: the scan walked the maps (hundreds of thousands of feet-box positions each).
      expect(reached).toBeGreaterThan(Object.keys(MAPS).length * 20000);
      expect(problems).toEqual([]);
    }, 120000);
  }
});

describe('wedges in the story\'s own layouts, and the checks that guard them (critic round 3, gap 5)', () => {
  /** The recorded story run's states, one per story script it starts (chapter by chapter, Prologue to post-game). */
  const storyStates = (): Array<{ label: string; save: string }> => mainRoots(storyFights as unknown as RecordedRoot[])
    .map((r) => ({ label: `${r.script} (chapter ${(JSON.parse(r.save) as { chapter: number }).chapter})`, save: r.save }));

  it('every map in every layout the story run gives it: props, barriers and flight circles that stand only part of the game', () => {
    setGroundCacheLimit(200);
    const states = storyStates();
    expect(states.length).toBeGreaterThan(40);
    const reports = scanStory(states);
    // Capsule Corp's yard alone changes with nearly every chapter (party tables, the crashed time machine, the lab).
    expect(reports.filter((r) => r.map === 'cc_yard').length).toBeGreaterThanOrEqual(5);
    expect(reports.length).toBeGreaterThanOrEqual(20);
    const problems = reports.flatMap((r) => r.problems.map((p) => `${r.map} (${r.label}): ${p}`));
    expect(problems).toEqual([]);
  }, 120000);

  it('the snag check catches the stall the probe slide left at the Crater Rim rock (the scan is not vacuous)', () => {
    setGroundCacheLimit(200);
    const grids = gridCache('start');
    const arr = arrivals('c07_nameless_rim', grids);
    expect(scanGrid(grids('c07_nameless_rim'), 'start', arr).problems).toEqual([]);
    const probe = scanGrid(grids('c07_nameless_rim'), 'start', arr, 'probe').problems;
    expect(probe.some((p) => /^snag \(tile 1[56],5\): .*heading east/.test(p)), probe.join('\n')).toBe(true);
  });
});
