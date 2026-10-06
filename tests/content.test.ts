import { describe, expect, it } from 'vitest';
import '../src/content';
import { propArt } from '../src/art/props';
import { CAST, CAST_NAMES } from '../src/content/cast';
import { CHARACTERS } from '../src/content/characters';
import { CREATURES } from '../src/content/creatures';
import { ENEMIES } from '../src/content/enemies';
import { ITEMS } from '../src/content/items';
import { QUESTS } from '../src/content/quests';
import { MAPS, resolveMap } from '../src/content/registry';
import { GENERIC_SCAN_KEY, GENERIC_SCAN_SPRITES, NPC_SCAN_OVERRIDES, SCAN_ALIASES, SCANS, scanKey, scanNpc } from '../src/content/scans';
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
import { Sim } from './sim';

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
