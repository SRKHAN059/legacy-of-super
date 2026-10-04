import { describe, expect, it } from 'vitest';
import { resolveMap } from '../../src/content/registry';
import { SPOTS } from '../../src/content/world';
import { SCRIPTS } from '../../src/game/script';
import { GameState } from '../../src/game/state';
import { MapInstance } from '../../src/game/world';
import { Sim } from '../sim';

/**
 * Act 3 chain test (Chapters 6-8): runs every gold-quest beat in order on its map, asserting flags, quests,
 * forms and techniques, all the way to the Chapter 9 handoff. Every NPC talk script met along the way is run too.
 */

/** Talk scripts that advance the story; the chain calls them explicitly instead of in bulk. */
const STORY_TALKS = new Set([
  'c06_frieza_talk', 'c06_gfrieza_talk', 'c06_party_beerus', 'c07_b_vegeta_talk', 'c07_cc_beerus', 'c07_vados_exam',
  'c07_announcer_talk', 'c08_party_bulma',
]);

/** Capsule Corp arrival tile used by the act 3 scripts (row 15 holds chapter 4's table from chapter 4 on). */
const CC_ENTRY: [number, number] = [23, 13];

const TICKS = 80000;

/** Run a script and assert it finished without console errors. */
async function beat(sim: Sim, id: string, ctx = {}): Promise<void> {
  const ok = await sim.run(id, ctx, TICKS);
  expect(sim.errors, `${id} errors`).toEqual([]);
  expect(ok, `${id} did not finish`).toBe(true);
}

/** Let any running onEnter / cutscene finish. */
async function settle(sim: Sim): Promise<void> {
  for (let i = 0; i < 4000 && sim.game.lockDepth > 0; i++) await sim.tick(10);
  expect(sim.game.lockDepth).toBe(0);
}

/** Run every non-story act 3 NPC talk script on the current map (with the NPC as context). */
async function talkAll(sim: Sim): Promise<string[]> {
  const f = sim.game.field;
  if (!f) throw new Error('no field');
  const ran: string[] = [];
  for (const n of [...f.npcs]) {
    const t = n.def.talk;
    if (!t || STORY_TALKS.has(t) || !/^c0[678]_/.test(t)) continue;
    await beat(sim, t, { npc: n });
    ran.push(t);
  }
  return ran;
}

function flag(sim: Sim, f: string): boolean {
  return sim.game.state.check(f);
}

declare const setImmediate: (cb: () => void) => void;
const flush = () => new Promise<void>((r) => setImmediate(r));

/**
 * Manual driver for mid-fight tests: advances dialogue and choices like the Sim bot and keeps the hero's HP full,
 * but never touches the enemies, so a fight stays open while the test moves the hero around.
 */
async function drive(sim: Sim, frames: number, until?: () => boolean): Promise<boolean> {
  const g = sim.game;
  let press = false;
  for (let i = 0; i < frames; i++) {
    if (until?.()) return true;
    const top = g.scenes.top?.constructor.name ?? '';
    if (/Dialogue|TitleCard|BeamStruggle|Choice/.test(top)) {
      if (/Choice/.test(top)) (g.scenes.top as unknown as { sel: number }).sel = 0;
      press = !press;
      sim.input.inject('A', press);
    } else {
      press = false;
      sim.input.inject('A', false);
    }
    const f = g.field;
    if (f) f.player.cs.hp = f.player.cs.hpMax;
    sim.input.poll();
    g.scenes.update(sim.input);
    await flush();
  }
  return until?.() ?? false;
}

/** Start `id` (as a trigger or NPC would) and drive until it hands control over for its fight against `uid`. */
async function toFight(sim: Sim, id: string, uid: string): Promise<void> {
  void sim.game.runScript(id);
  const live = () => sim.game.allowControl && !!sim.game.field?.enemies.some((e) => e.uid === uid && !e.dead);
  expect(await drive(sim, 20000, live), `${id} reaches the ${uid} fight`).toBe(true);
}

/** Put the hero on a tile and let a few frames run (triggers, warps and arena walls react). */
async function stepTo(sim: Sim, x: number, y: number): Promise<void> {
  const p = sim.game.field?.player;
  if (!p) throw new Error('no field');
  p.x = x * 16 + 8;
  p.y = y * 16 + 14;
  await drive(sim, 4);
}

/** Live enemies on the current map carrying `uid`. */
function copies(sim: Sim, uid: string): number {
  return sim.game.field?.enemies.filter((e) => e.uid === uid && !e.dead).length ?? 0;
}

/** Record every dialogue / narrator line shown from now on, as "Speaker: text". */
function record(sim: Sim): string[] {
  const out: string[] = [];
  const g = sim.game;
  const say = g.say.bind(g);
  g.say = (lines) => {
    for (const l of lines) out.push(`${l.name ?? ''}: ${l.text}`);
    return say(lines);
  };
  const ask = g.ask.bind(g);
  g.ask = (prompt, options) => {
    out.push(`${prompt.name ?? ''}: ${prompt.text}`);
    return ask(prompt, options);
  };
  return out;
}

/** Record every dialogue line shown from now on (name, text and whether it carries a portrait). */
function recordLines(sim: Sim): Array<{ name: string; text: string; portrait: boolean }> {
  const out: Array<{ name: string; text: string; portrait: boolean }> = [];
  const g = sim.game;
  const say = g.say.bind(g);
  g.say = (lines) => {
    for (const l of lines) out.push({ name: l.name ?? '', text: l.text, portrait: !!l.portrait });
    return say(lines);
  };
  return out;
}

/** Walk: hold a direction for `frames` frames (dialogue still advances), then release it. */
async function hold(sim: Sim, dir: 'up' | 'down' | 'left' | 'right', frames: number): Promise<void> {
  sim.input.inject(dir, true);
  await drive(sim, frames);
  sim.input.inject(dir, false);
  await drive(sim, 2);
}

/** Hero tile. */
function heroTile(sim: Sim): [number, number] {
  const p = sim.game.field?.player;
  if (!p) throw new Error('no field');
  return [Math.floor(p.x / 16), Math.floor(p.y / 16)];
}

/** Finish the open fight(s) the way the Sim bot does, then let the script run to its end. */
async function finish(sim: Sim, ticks = 40000): Promise<void> {
  for (let i = 0; i < ticks && sim.game.lockDepth > 0; i += 10) await sim.tick(10);
  expect(sim.errors).toEqual([]);
}

describe('act3: chapters 6-8 chain', () => {
  it('plays from c06_start to the c09 handoff', async () => {
    SCRIPTS.c09_start = async (s) => { s.set('test_c09_reached'); };
    const sim = new Sim();
    const st = sim.game.state;
    st.data.chapter = 5;
    st.join('goku', 22);
    st.join('vegeta', 22);
    st.data.active = 'goku';
    sim.start('waste_mesa', 22, 27);
    await settle(sim);

    // ---------------------------------------------------------------- Chapter 6
    // Every speaker in the act shows a real name (never a raw script id such as "c08_monakaF").
    const lines = recordLines(sim);
    const said = record(sim);
    await beat(sim, 'c06_start');
    // Chapter 5 already played Goku and Vegeta's arrival: no second entrance, dessert joke or "How touching".
    expect(said.join('\n')).not.toMatch(/we're late|dessert|touching|crawled out of Hell/i);
    // Piccolo died taking Frieza's beam for Gohan (anime ep 22); Goten and Trunks carry him to the Lookout.
    expect(said.join('\n')).toMatch(/not breathing/);
    expect(said.join('\n')).toMatch(/Lookout/);
    expect(said.join('\n')).not.toMatch(/pulse|he's alive|one more senzu/i);
    said.length = 0;
    expect(st.data.chapter).toBe(6);
    expect(flag(sim, 'c06_arrived')).toBe(true);
    expect(flag(sim, 'quest:c06_frieza')).toBe(true);
    expect(sim.game.field?.def.id).toBe('waste_mesa');
    expect(st.data.active).toBe('goku');
    await settle(sim);
    // Beerus and Whis came with Goku and Vegeta (end of Chapter 5) and stay on the mesa for the whole fight.
    expect(sim.game.field?.npcs.some((n) => n.def.id === 'c06_m_beerus')).toBe(true);
    expect(sim.game.field?.npcs.some((n) => n.def.id === 'c06_m_whis')).toBe(true);
    // Piccolo's body is no longer on the mesa.
    expect(sim.game.field?.npcs.some((n) => /piccolo/i.test(n.def.id))).toBe(false);
    const mesaTalks = await talkAll(sim);
    expect(mesaTalks).toContain('c06_jaco_talk');
    expect(flag(sim, 'quest:c06_deserters')).toBe(true);

    await beat(sim, 'c06_round1');
    expect(flag(sim, 'c06_round1')).toBe(true);
    expect(st.char('goku').form).toBe('ssb');
    // Vegeta's blue is revealed (and unlocked) in round 2, not over the black hand-over screen.
    expect(st.char('vegeta').form).not.toBe('ssb');
    expect(st.char('vegeta').techs).not.toContain('galickGun');
    expect(st.data.active).toBe('vegeta');
    expect(flag(sim, 'noSwitch')).toBe(true);
    await settle(sim);
    await talkAll(sim);

    said.length = 0;
    const visited: string[] = [];
    const changeMap = sim.game.changeMap.bind(sim.game);
    sim.game.changeMap = (...a: Parameters<typeof changeMap>) => {
      visited.push(a[0]);
      return changeMap(...a);
    };
    await beat(sim, 'c06_round2');
    sim.game.changeMap = changeMap;
    expect(st.char('vegeta').form).toBe('ssb');
    expect(st.char('vegeta').techs).toContain('galickGun');
    expect(flag(sim, 'c06_won')).toBe(true);
    // The rewind cannot undo Piccolo's death: Porunga revives him on the Lookout (anime ep 27), no senzu.
    expect(flag(sim, 'c06_piccoloRevived')).toBe(true);
    expect(visited).toEqual(['c06_void', 'waste_mesa', 'lookout', 'cc_yard']);
    expect(said.join('\n')).toMatch(/Porunga/);
    expect(said.join('\n')).toMatch(/^Piccolo: .*You got sloppy/m);
    expect(said.join('\n')).not.toMatch(/senzu/i);
    expect(flag(sim, 'done:c06_frieza')).toBe(true);
    expect(flag(sim, 'quest:c06_party')).toBe(true);
    expect(flag(sim, 'noSwitch')).toBe(false);
    expect(sim.game.field?.def.id).toBe('cc_yard');

    // Jaco's deserters (bronze): defeat the three officers in the canyon.
    sim.start('waste_canyon', 20, 4);
    await settle(sim);
    expect(sim.game.field?.enemies.filter((e) => e.def.id === 'c06_deserter').length).toBe(3);
    for (let i = 0; i < 3; i++) await beat(sim, 'c06_deserter_down');
    expect(flag(sim, 'done:c06_deserters')).toBe(true);

    sim.start('cc_yard', ...CC_ENTRY);
    await settle(sim);
    const partyTalks = await talkAll(sim);
    expect(partyTalks).toContain('c06_party_bulma');
    await beat(sim, 'c06_party_beerus', { npc: sim.game.field?.npcs.find((n) => n.def.id === 'c06_p_beerus') });

    // ---------------------------------------------------------------- Chapter 7
    expect(st.data.chapter).toBe(7);
    expect(flag(sim, 'done:c06_party')).toBe(true);
    expect(flag(sim, 'quest:c07_spar')).toBe(true);
    expect(st.data.active).toBe('goku');
    expect(sim.game.field?.def.id).toBe('beerus_grounds');
    await settle(sim);
    expect(await talkAll(sim)).toContain('c07_b_beerus_talk');
    await beat(sim, 'c07_b_vegeta_talk');
    expect(flag(sim, 'c07_champaDone')).toBe(true);
    expect(flag(sim, 'done:c07_spar')).toBe(true);
    expect(flag(sim, 'quest:c07_recruit')).toBe(true);
    expect(sim.game.field?.def.id).toBe('cc_yard');
    await settle(sim);
    await beat(sim, 'c07_cc_beerus'); // Not enough fighters yet: Beerus refuses.
    expect(flag(sim, 'c07_departed')).toBe(false);
    const ccTalks = await talkAll(sim);
    expect(ccTalks).toEqual(expect.arrayContaining(['c07_cc_bulma', 'c07_cc_piccolo', 'c07_cc_buu', 'c07_cc_panchy', 'c07_cc_gohan']));
    expect(flag(sim, 'c07_piccolo')).toBe(true);
    expect(flag(sim, 'quest:c07_cake')).toBe(true);
    expect(st.count('c07_superRadar')).toBe(1);
    await beat(sim, 'c07_cc_panchy');
    expect(st.count('c07_cake')).toBe(1);
    expect(flag(sim, 'c07_cakeTaken')).toBe(true);
    await beat(sim, 'c07_cc_buu');
    expect(flag(sim, 'c07_buu')).toBe(true);
    expect(flag(sim, 'done:c07_cake')).toBe(true);
    expect(st.count('c07_cake')).toBe(0);
    await beat(sim, 'c07_cc_beerus');
    expect(flag(sim, 'c07_departed')).toBe(true);
    expect(flag(sim, 'done:c07_recruit')).toBe(true);
    expect(flag(sim, 'noSwitch')).toBe(false);
    expect(flag(sim, 'quest:c07_exam')).toBe(true);
    expect(st.data.regions).toContain('spot_nameless');
    expect(sim.game.field?.def.id).toBe('c07_nameless_grounds');
    await settle(sim);
    await talkAll(sim);
    expect(flag(sim, 'quest:c07_shards')).toBe(true);
    expect(flag(sim, 'quest:c07_snacks')).toBe(true);

    await beat(sim, 'c07_vados_exam');
    expect(flag(sim, 'c07_examDone')).toBe(true);
    expect(flag(sim, 'done:c07_exam')).toBe(true);
    expect(flag(sim, 'quest:c07_tournament')).toBe(true);
    expect(st.count('c07_buuPaper')).toBe(1);
    // The team has moved into the stadium.
    expect(sim.game.field?.npcs.some((n) => n.def.id === 'c07_g_beerus')).toBe(false);
    await talkAll(sim);

    // Side quests: the snack crate and the orange stones from the crater rim.
    st.give('c07_snackCrate', 1);
    await beat(sim, 'c07_vendor_talk');
    expect(st.count('c07_puffs')).toBe(1);
    st.give('c07_starShard', 3);
    await settle(sim);
    await beat(sim, 'c07_whis_grounds');
    expect(flag(sim, 'done:c07_shards')).toBe(true);

    sim.start('c07_nameless_arena', 17, 27);
    await settle(sim);
    expect(flag(sim, 'c07_ceremony')).toBe(true);
    await beat(sim, 'c07_beerus_talk');
    expect(flag(sim, 'done:c07_snacks')).toBe(true);
    await talkAll(sim);

    const fighters = ['goku', 'goku', 'piccolo', 'vegeta', 'vegeta', 'vegeta', 'vegeta', 'goku'];
    for (let m = 1; m <= 8; m++) {
      await settle(sim);
      await beat(sim, 'c07_announcer_talk');
      expect(flag(sim, `c07_m${m}`), `match ${m}`).toBe(true);
      expect(st.data.active, `match ${m} fighter`).toBe(fighters[m - 1]);
      expect(sim.game.field?.def.id).toBe('c07_nameless_arena');
      await settle(sim);
      await talkAll(sim);
    }
    // Match 9 ends the chapter (Zeno, Super Shenron) and starts Chapter 8.
    await beat(sim, 'c07_announcer_talk');
    expect(flag(sim, 'c07_done')).toBe(true);
    expect(flag(sim, 'done:c07_tournament')).toBe(true);
    expect(flag(sim, 'c07_shenronGone')).toBe(true);

    // ---------------------------------------------------------------- Chapter 8
    expect(st.data.chapter).toBe(8);
    expect(flag(sim, 'c08_monakaDone')).toBe(true);
    expect(flag(sim, 'done:c08_monaka')).toBe(true);
    expect(flag(sim, 'c08_truckGone')).toBe(true);
    expect(sim.game.field?.def.id).toBe('cc_yard');
    await settle(sim);
    await talkAll(sim);
    // Goku stays the hero on the lawn until the screen is dark (Vegeta's party NPC is still standing there).
    const heroAt: Array<[string, string]> = [];
    const say = sim.game.say.bind(sim.game);
    sim.game.say = (lines) => {
      for (const l of lines) heroAt.push([st.data.active, l.text]);
      return say(lines);
    };
    await beat(sim, 'c08_party_bulma');
    sim.game.say = say;
    expect(heroAt.find(([, t]) => /added to the world map/.test(t))?.[0]).toBe('goku');
    expect(heroAt.find(([, t]) => /Journal updated/.test(t))?.[0]).toBe('goku');
    expect(flag(sim, 'c08_landed')).toBe(true);
    expect(st.data.active).toBe('vegeta');
    expect(sim.game.field?.def.id).toBe('c08_potaufeu_landing');
    expect(st.data.regions).toContain('c08_spot_potaufeu');
    await settle(sim);
    // Jaco just said there is no sign of Monaka: he only turns up once the boys are safe.
    expect(sim.game.field?.npcs.some((n) => n.def.id === 'c08_l_monaka')).toBe(false);
    await talkAll(sim);

    sim.start('c08_potaufeu_mushrooms', 21, 28);
    await settle(sim);
    await beat(sim, 'c08_boys');
    expect(flag(sim, 'c08_boysFound')).toBe(true);
    // Every story step is a gold journal entry: the rescue is done, the chase is on.
    expect(flag(sim, 'done:c08_potaufeu')).toBe(true);
    expect(flag(sim, 'quest:c08_gryll')).toBe(true);
    await beat(sim, 'c08_gryll');
    expect(flag(sim, 'c08_gryllDone')).toBe(true);
    expect(flag(sim, 'done:c08_gryll')).toBe(true);
    expect(flag(sim, 'quest:c08_copy')).toBe(true);

    // Potage's water jars and Monaka's parcels.
    sim.start('c08_potaufeu_landing', 18, 13);
    await settle(sim);
    expect(sim.game.field?.npcs.some((n) => n.def.id === 'c08_l_monaka')).toBe(true);
    await talkAll(sim);
    expect(flag(sim, 'quest:c08_delivery')).toBe(true);
    expect(flag(sim, 'quest:c08_water')).toBe(true);
    st.give('c08_water', 3);
    st.give('c08_parcel', 3);
    const potage = () => ({ npc: sim.game.field?.npcs.find((n) => n.def.id === 'c08_l_potage') });
    await beat(sim, 'c08_potage_talk', potage());
    await beat(sim, 'c08_potage_talk', potage());
    expect(flag(sim, 'done:c08_water')).toBe(true);
    expect(flag(sim, 'done:c08_delivery')).toBe(true);

    sim.start('c08_potaufeu_vault', 12, 15);
    await settle(sim);
    await beat(sim, 'c08_vault');
    expect(flag(sim, 'c08_coreExposed')).toBe(true);
    expect(flag(sim, 'c08_copyDone')).toBe(true);
    expect(flag(sim, 'done:c08_copy')).toBe(true);
    expect(flag(sim, 'c08_done')).toBe(true);
    expect(flag(sim, 'noSwitch')).toBe(false);
    expect(flag(sim, 'test_c09_reached')).toBe(true);
    expect(st.char('goku').level).toBeGreaterThanOrEqual(29);

    // No raw ids as speaker names; "Monaka"'s lines after the lawn match carry his name and portrait.
    const raw = lines.filter((l) => /^c0\d_|^[a-z]+_[a-z]/.test(l.name));
    expect(raw.map((l) => `${l.name}: ${l.text}`)).toEqual([]);
    const flick = lines.find((l) => /\*flick\*/.test(l.text));
    expect(flick).toEqual({ name: 'Monaka', text: 'Enough. *flick*', portrait: true });
    const train = lines.find((l) => /Train\. Far away/.test(l.text));
    expect(train?.name).toBe('Monaka');
    expect(train?.portrait).toBe(true);
  });
});

/** Player feet box (10x6) standing on a tile. */
function standable(m: MapInstance, tx: number, ty: number): boolean {
  return !m.col.blocked({ x: tx * 16 + 3, y: ty * 16 + 8, w: 10, h: 6 });
}

/** Tiles reachable on foot from `start` (4-way BFS over standable tiles). */
function reachable(m: MapInstance, start: [number, number]): Set<string> {
  const seen = new Set<string>([start.join(',')]);
  const q: Array<[number, number]> = [start];
  while (q.length) {
    const [x, y] = q.shift() as [number, number];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= m.cols || ny >= m.rows || seen.has(k) || !standable(m, nx, ny)) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return seen;
}

/** True if the tile or one of its neighbours is reachable (talk / examine range). */
function near(r: Set<string>, x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  return [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => r.has(`${tx + dx},${ty + dy}`));
}

describe('act3: map layout sanity', () => {
  const cases: Array<{ map: string; from: [number, number]; flags: string[]; chapter: number }> = [
    // The stadium walkway's Piccolo gate (common.ts STORY_GATES) is broken in these cases; tests/full_game.test.ts
    // checks that it walls the arena off until then.
    { map: 'c07_nameless_grounds', from: [7, 13], flags: ['gate:c07_nameless_grounds:c07_g_stadium'], chapter: 7 },
    { map: 'c07_nameless_grounds', from: [7, 13], flags: ['c07_examDone', 'gate:c07_nameless_grounds:c07_g_stadium'], chapter: 7 },
    { map: 'c07_nameless_arena', from: [17, 27], flags: ['c07_examDone'], chapter: 7 },
    { map: 'c07_nameless_rim', from: [0, 22], flags: ['gate:c07_nameless_rim:c07_v27', 'gate:c07_nameless_rim:c07_g28'], chapter: 7 },
    { map: 'c08_potaufeu_landing', from: [18, 13], flags: ['c08_landed', 'c08_boysFound'], chapter: 8 },
    { map: 'c08_potaufeu_mushrooms', from: [20, 30], flags: ['gate:c08_potaufeu_mushrooms:c08_v30'], chapter: 8 },
    { map: 'c08_potaufeu_vault', from: [12, 15], flags: ['c08_sealOpen'], chapter: 8 },
    { map: 'waste_mesa', from: [22, 27], flags: ['c06_arrived', 'c06_round1'], chapter: 6 },
    { map: 'cc_yard', from: CC_ENTRY, flags: ['c06_won'], chapter: 6 },
    { map: 'cc_yard', from: CC_ENTRY, flags: ['c07_champaDone'], chapter: 7 },
    { map: 'cc_yard', from: CC_ENTRY, flags: [], chapter: 8 },
    { map: 'beerus_grounds', from: [22, 16], flags: [], chapter: 7 },
    { map: 'c07_nameless_grounds', from: [7, 13], flags: ['c07_examDone', 'c07_done', 'quest:c07_shards', 'gate:c07_nameless_grounds:c07_g_stadium'], chapter: 8 },
  ];
  for (const c of cases) {
    it(`${c.map} (${c.chapter}${c.flags.length ? `, ${c.flags.join('+')}` : ''}): act 3 content is reachable`, () => {
      const def = resolveMap(c.map);
      if (!def) throw new Error(`missing map ${c.map}`);
      const st = new GameState();
      st.data.chapter = c.chapter;
      st.data.active = 'goku';
      for (const f of c.flags) {
        if (f.startsWith('quest:')) st.data.journal[f.slice(6)] = 'active';
        else st.set(f);
      }
      const m = new MapInstance(def, st);
      expect(standable(m, ...c.from), 'entry tile').toBe(true);
      const r = reachable(m, c.from);
      const mine = (id: string) => /^c0[678]_/.test(id);
      for (const n of def.npcs ?? []) {
        if (!mine(n.id) || !st.check(n.showIf) || (n.hideIf && st.check(n.hideIf))) continue;
        expect(near(r, n.x, n.y), `npc ${n.id} at ${n.x},${n.y}`).toBe(true);
      }
      for (const t of def.triggers ?? []) {
        if (!mine(t.id)) continue;
        let ok = false;
        for (let y = t.y; y < t.y + t.h; y++) for (let x = t.x; x < t.x + t.w; x++) if (r.has(`${x},${y}`)) ok = true;
        expect(ok, `trigger ${t.id}`).toBe(true);
      }
      if (!mine(c.map)) return;
      for (const p of def.pickups ?? []) expect(near(r, p.x, p.y), `pickup ${p.id}`).toBe(true);
      for (const o of def.objects ?? []) expect(near(r, o.x, o.y), `object ${o.type} at ${o.x},${o.y}`).toBe(true);
      for (const e of def.enemies ?? []) expect(r.has(`${e.x},${e.y}`), `enemy ${e.type} at ${e.x},${e.y}`).toBe(true);
      for (const w of def.warps ?? []) {
        let ok = false;
        for (let y = w.y; y < w.y + w.h; y++) for (let x = w.x; x < w.x + w.w; x++) if (near(r, x, y)) ok = true;
        expect(ok, `warp to ${w.to}`).toBe(true);
        const dest = resolveMap(w.to);
        if (dest) expect(standable(new MapInstance(dest, st), Math.floor(w.tx), Math.floor(w.ty)), `warp arrival on ${w.to}`).toBe(true);
      }
    });
  }

  it('landing spots arrive on open ground', () => {
    for (const id of ['spot_nameless', 'c08_spot_potaufeu']) {
      const sp = SPOTS[id];
      const def = resolveMap(sp.map);
      if (!def) throw new Error(`missing ${sp.map}`);
      expect(standable(new MapInstance(def, new GameState()), sp.tx, sp.ty), id).toBe(true);
    }
  });
});

describe('act3: story fights cannot be re-entered or walked out of', () => {
  it('chapter 6 round 1: re-entering the trigger mid-fight neither restarts the round nor locks the controls', async () => {
    const sim = new Sim();
    const st = sim.game.state;
    st.data.chapter = 6;
    st.join('goku', 22);
    st.join('vegeta', 22);
    st.data.active = 'goku';
    st.set('c06_arrived');
    st.addQuest('c06_frieza');
    sim.start('waste_mesa', 24, 24);
    await settle(sim);
    await toFight(sim, 'c06_round1', 'c06_friezaF');
    expect(sim.game.lockDepth).toBe(1);
    await stepTo(sim, 24, 21);
    await stepTo(sim, 24, 19); // Back inside c06_round1T (x21-27, y18-19).
    expect(sim.game.lockDepth).toBe(1);
    expect(sim.game.allowControl).toBe(true);
    expect(copies(sim, 'c06_friezaF')).toBe(1);
    // The flight circle (14,12), the save point (19,29) and the south exit are outside the arena wall.
    await stepTo(sim, 18, 12);
    await hold(sim, 'left', 90);
    expect(heroTile(sim)[0]).toBeGreaterThanOrEqual(16);
    await stepTo(sim, 22, 25);
    await hold(sim, 'down', 240);
    expect(sim.game.field?.def.id).toBe('waste_mesa');
    expect(heroTile(sim)[1]).toBeLessThanOrEqual(26);
    expect(sim.game.scenes.top?.constructor.name).toBe('Field');
    await finish(sim);
    expect(flag(sim, 'c06_round1')).toBe(true);
    expect(sim.game.lockDepth).toBe(0);
    expect(sim.game.field?.locked).toBe(false);
  });

  it('chapter 6 round 2: re-entering the trigger mid-fight neither restarts the round nor locks the controls', async () => {
    const sim = new Sim();
    const st = sim.game.state;
    st.data.chapter = 6;
    st.join('goku', 23);
    st.join('vegeta', 23);
    st.data.active = 'vegeta';
    for (const f of ['c06_arrived', 'c06_round1', 'noSwitch']) st.set(f);
    st.addQuest('c06_frieza');
    sim.start('waste_mesa', 24, 23);
    await settle(sim);
    await toFight(sim, 'c06_round2', 'c06_goldenF2');
    await stepTo(sim, 24, 21);
    await stepTo(sim, 24, 19);
    expect(sim.game.lockDepth).toBe(1);
    expect(copies(sim, 'c06_goldenF2')).toBe(1);
    await finish(sim);
    expect(flag(sim, 'c06_won')).toBe(true);
    expect(sim.game.field?.def.id).toBe('cc_yard');
    expect(sim.game.lockDepth).toBe(0);
    expect(sim.game.field?.npcs.some((n) => n.def.id === 'c06_p_beerus')).toBe(true);
  });

  /** A chapter 8 state on Potaufeu with Vegeta active. */
  function potaufeu(flags: string[], quests: string[]): Sim {
    SCRIPTS.c09_start = async (s) => { s.set('test_c09_reached'); };
    const sim = new Sim();
    const st = sim.game.state;
    st.data.chapter = 8;
    st.join('goku', 30);
    st.join('vegeta', 30);
    st.data.active = 'vegeta';
    for (const f of flags) st.set(f);
    for (const q of quests) st.addQuest(q);
    return sim;
  }

  it('chapter 8 boys: re-entering the trigger mid-wave does not restart the rescue', async () => {
    const sim = potaufeu(['c08_landed', 'noSwitch'], ['c08_potaufeu']);
    sim.start('c08_potaufeu_mushrooms', 10, 20);
    await settle(sim);
    await toFight(sim, 'c08_boys', 'c08_w1');
    await stepTo(sim, 9, 19);
    await stepTo(sim, 6, 16); // Back inside c08_boysT (x2-7, y12-17).
    expect(sim.game.lockDepth).toBe(1);
    expect(copies(sim, 'c08_w1')).toBe(1);
    // The wave seals the forest like a boss fight: no Whis's Charm, save disc or map edge while it is up.
    expect(sim.game.field?.sealed).toBe(true);
    // The south exit (row 31) and the save point (18,5) are outside the camp's arena wall.
    await stepTo(sim, 14, 20);
    await hold(sim, 'down', 300);
    expect(sim.game.field?.def.id).toBe('c08_potaufeu_mushrooms');
    expect(heroTile(sim)[1]).toBeLessThanOrEqual(21);
    await stepTo(sim, 14, 8);
    await hold(sim, 'right', 120);
    expect(heroTile(sim)[0]).toBeLessThanOrEqual(16);
    expect(sim.game.lockDepth).toBe(1);
    expect(sim.game.allowControl).toBe(true);
    await finish(sim);
    expect(flag(sim, 'c08_boysFound')).toBe(true);
    expect(flag(sim, 'quest:c08_gryll')).toBe(true);
    expect(sim.game.lockDepth).toBe(0);
    expect(sim.game.fightDepth).toBe(0);
    expect(sim.game.field?.sealed).toBe(false);
  });

  it('chapter 8 Monaka: after the lawn match, "Monaka" speaks with his name and portrait', async () => {
    const sim = new Sim();
    const st = sim.game.state;
    st.data.chapter = 8;
    st.join('goku', 29);
    st.join('vegeta', 29);
    st.data.active = 'goku';
    st.addQuest('c08_monaka');
    sim.start('cc_yard', ...CC_ENTRY);
    await settle(sim);
    const lines = recordLines(sim);
    // Lose the match (loseOk): the boss is left on the lawn as an enemy puppet, the case that used to show raw ids.
    void sim.game.runScript('c08_monaka_fight');
    const live = () => sim.game.allowControl && !!sim.game.field?.enemies.some((e) => e.uid === 'c08_monakaF' && !e.dead);
    expect(await drive(sim, 20000, live)).toBe(true);
    const boss = sim.game.field?.enemies.find((e) => e.uid === 'c08_monakaF');
    if (!boss) throw new Error('no Monaka');
    boss.ended = true;
    await drive(sim, 4000, () => sim.game.lockDepth === 0);
    expect(sim.errors).toEqual([]);
    expect(flag(sim, 'c08_monakaDone')).toBe(true);
    const monaka = lines.filter((l) => /\*flick\*|Train\. Far away/.test(l.text));
    expect(monaka).toEqual([
      { name: 'Monaka', text: 'Enough. *flick*', portrait: true },
      { name: 'Monaka', text: 'Yes. Train. Far away. For a long time.', portrait: true },
    ]);
    // Neither the boss puppet nor the costume NPC stays behind on the lawn.
    expect(sim.game.field?.enemies.some((e) => e.uid === 'c08_monakaF')).toBe(false);
    expect(sim.game.field?.npcs.some((n) => n.def.id === 'c08_monakaN')).toBe(false);
  });

  it('chapter 8 Gryll: crossing the trigger row mid-fight does not spawn a second Copy Gryll', async () => {
    const sim = potaufeu(['c08_landed', 'c08_boysFound', 'noSwitch'], ['c08_gryll']);
    sim.start('c08_potaufeu_mushrooms', 21, 8);
    await settle(sim);
    await toFight(sim, 'c08_gryll', 'c08_gryllF');
    await stepTo(sim, 21, 5);
    await stepTo(sim, 21, 6); // Back inside c08_gryllT (row 6).
    expect(sim.game.lockDepth).toBe(1);
    expect(copies(sim, 'c08_gryllF')).toBe(1);
    await finish(sim);
    expect(flag(sim, 'c08_gryllDone')).toBe(true);
    expect(flag(sim, 'done:c08_gryll')).toBe(true);
    expect(sim.game.lockDepth).toBe(0);
  });

  it('chapter 8 vault: the copies cannot restart the beat or be walked away from, and chapter 9 still starts', async () => {
    const sim = potaufeu(['c08_landed', 'c08_boysFound', 'c08_gryllDone', 'c08_sealOpen', 'noSwitch'], ['c08_copy']);
    sim.start('c08_potaufeu_vault', 12, 15);
    await settle(sim);
    // Control comes back with the hero standing inside c08_vaultT (x4-21, y11-12).
    await toFight(sim, 'c08_vault', 'c08_cg1');
    await stepTo(sim, 12, 9);
    await stepTo(sim, 12, 12);
    expect(sim.game.lockDepth).toBe(1);
    expect(copies(sim, 'c08_cg1')).toBe(1);
    await hold(sim, 'down', 120); // Toward the vault exit (row 17).
    await drive(sim, 30);
    expect(sim.game.field?.def.id).toBe('c08_potaufeu_vault');
    expect(heroTile(sim)[1]).toBeLessThanOrEqual(15);
    await finish(sim);
    expect(flag(sim, 'c08_copyDone')).toBe(true);
    expect(flag(sim, 'test_c09_reached')).toBe(true);
    expect(sim.game.lockDepth).toBe(0);
  });

  it('chapter 8 Monaka: the match cannot be walked out of, and an abandoned match can be replayed', async () => {
    const sim = new Sim();
    const st = sim.game.state;
    st.data.chapter = 8;
    st.join('goku', 29);
    st.join('vegeta', 29);
    st.data.active = 'goku';
    sim.start('cc_yard', ...CC_ENTRY);
    await settle(sim);
    await toFight(sim, 'c08_start', 'c08_monakaF');
    const npc = (id: string) => sim.game.field?.npcs.find((n) => n.def.id === id);
    expect(npc('c04_whis')?.hidden, 'Whis (travel menu) steps aside during the match').toBe(true);
    await stepTo(sim, 21, 12);
    await hold(sim, 'up', 120); // Toward the Capsule Corp door (21,7), 8 steps north of the hero's start.
    await drive(sim, 30);
    expect(sim.game.field?.def.id).toBe('cc_yard');
    expect(heroTile(sim)[1]).toBeGreaterThanOrEqual(11);
    await stepTo(sim, 8, 13);
    await hold(sim, 'left', 240); // Toward the west exit to the city streets.
    await drive(sim, 30);
    expect(sim.game.field?.def.id).toBe('cc_yard');
    expect(heroTile(sim)[0]).toBeGreaterThanOrEqual(6);
    // Abandon the match anyway, as a Game Over or a mid-fight save and reload would: reload the lawn.
    sim.game.lockDepth = 0;
    sim.game.allowControl = false;
    sim.start('cc_yard', ...CC_ENTRY);
    await settle(sim);
    expect(flag(sim, 'c08_monakaDone')).toBe(false);
    const fake = npc('c08_p_fake');
    expect(fake, '"Monaka" waits on the lawn for the rematch').toBeTruthy();
    expect(npc('c08_p_beerus'), 'Beerus is "busy" while Monaka is around').toBeUndefined();
    await beat(sim, 'c08_party_bulma'); // Not yet: the boys are still on the lawn.
    expect(flag(sim, 'c08_departed')).toBe(false);
    await beat(sim, 'c08_fake_talk', { npc: fake });
    expect(flag(sim, 'c08_monakaDone')).toBe(true);
    expect(flag(sim, 'done:c08_monaka')).toBe(true);
    expect(flag(sim, 'c08_truckGone')).toBe(true);
    await settle(sim);
    expect(npc('c08_p_fake')).toBeUndefined();
    expect(npc('c08_p_beerus')).toBeTruthy();
    await beat(sim, 'c08_party_bulma');
    expect(flag(sim, 'c08_departed')).toBe(true);
    expect(flag(sim, 'c08_landed')).toBe(true);
  });
});

describe('act3: side content and puzzles', () => {
  it('lighting both glyph pillars pins the Commeson core, then the pillars recharge', async () => {
    const sim = new Sim();
    const st = sim.game.state;
    st.data.chapter = 8;
    st.join('goku', 30);
    st.data.active = 'goku';
    st.set('c08_gryllDone');
    st.set('c08_copyDone');
    sim.start('c08_potaufeu_vault', 12, 15);
    await settle(sim);
    const f = sim.game.field;
    if (!f) throw new Error('no field');
    const core = f.spawnEnemy('c08_core', 14 * 16 + 8, 10 * 16 + 14, 'c08_coreE');
    await beat(sim, 'c08_glyph_w');
    expect(flag(sim, 'c08_glyphW')).toBe(false); // Inactive outside the fight.
    st.set('c08_coreHunt');
    await beat(sim, 'c08_glyph_w');
    expect(flag(sim, 'c08_glyphW')).toBe(true);
    expect(core.frozen).toBe(0);
    await beat(sim, 'c08_glyph_e');
    expect(core.frozen).toBeGreaterThan(0);
    expect(flag(sim, 'c08_glyphW') || flag(sim, 'c08_glyphE')).toBe(false);
  });

  it('the orange stones and the snack crate can still be handed in after the tournament', async () => {
    const sim = new Sim();
    const st = sim.game.state;
    st.data.chapter = 8;
    st.join('goku', 29);
    st.data.active = 'goku';
    for (const f of ['c07_departed', 'c07_examDone', 'c07_done']) st.set(f);
    st.addQuest('c07_shards');
    st.addQuest('c07_snacks');
    st.give('c07_starShard', 3);
    st.give('c07_snackCrate', 1);
    sim.start('c07_nameless_grounds', 7, 13);
    await settle(sim);
    const whis = sim.game.field?.npcs.find((n) => n.def.id === 'c07_g_whis2');
    expect(whis, 'Whis waits for the stones').toBeTruthy();
    expect(sim.game.field?.npcs.some((n) => n.def.id === 'c07_g_whis')).toBe(false);
    await beat(sim, 'c07_whis_grounds', { npc: whis });
    expect(flag(sim, 'done:c07_shards')).toBe(true);
    await beat(sim, 'c07_vendor_talk');
    expect(flag(sim, 'done:c07_snacks')).toBe(true);
    expect(st.count('c07_snackCrate')).toBe(0);
    // With the quest done, the post-chapter Whis leaves.
    sim.start('c07_nameless_grounds', 7, 13);
    await settle(sim);
    expect(sim.game.field?.npcs.some((n) => n.def.id === 'c07_g_whis2')).toBe(false);
  });

  it('Galaxy Puffs still in the bag after the tournament are shipped to Beerus by the vendor', async () => {
    const sim = new Sim();
    const st = sim.game.state;
    st.data.chapter = 8;
    st.join('goku', 29);
    st.data.active = 'goku';
    for (const f of ['c07_departed', 'c07_examDone', 'c07_done']) st.set(f);
    st.addQuest('c07_snacks');
    st.give('c07_puffs', 1);
    sim.start('c07_nameless_grounds', 7, 13);
    await settle(sim);
    await beat(sim, 'c07_vendor_talk');
    expect(flag(sim, 'done:c07_snacks')).toBe(true);
    expect(st.count('c07_puffs')).toBe(0);
  });

  it('water broken out of a jar but never picked up is waiting when you come back (once)', async () => {
    const sim = new Sim();
    const st = sim.game.state;
    st.data.chapter = 8;
    st.join('vegeta', 30);
    st.data.active = 'vegeta';
    for (const f of ['c08_landed', 'c08_boysFound', 'broke:c08_potaufeu_mushrooms:c08_jar1', 'broke:c08_potaufeu_mushrooms:c08_jar2']) st.set(f);
    st.addQuest('c08_water');
    st.give('c08_water', 1); // Jar 1's water was picked up, jar 2's was left behind.
    st.set('pickup:c08_jar1');
    sim.start('c08_potaufeu_mushrooms', 21, 28);
    await settle(sim);
    const waters = () => sim.game.field?.pickups.filter((p) => p.item === 'c08_water') ?? [];
    expect(waters().length).toBe(1);
    const pk = waters()[0];
    const p = sim.game.field?.player;
    if (!p) throw new Error('no field');
    p.x = pk.x;
    p.y = pk.y + 2;
    await drive(sim, 60);
    expect(st.count('c08_water')).toBe(2);
    sim.start('c08_potaufeu_mushrooms', 21, 28);
    await settle(sim);
    expect(waters().length).toBe(0);
    // Once Potage has the jars, nothing comes back.
    st.data.journal.c08_water = 'done';
    st.take('c08_water', 2);
    sim.start('c08_potaufeu_mushrooms', 21, 28);
    await settle(sim);
    expect(waters().length).toBe(0);
  });

  it('the kids in the stands cheer for their own dads and only learn about the needle in match 3', async () => {
    const sim = new Sim();
    const st = sim.game.state;
    st.data.chapter = 7;
    st.join('goku', 26);
    st.data.active = 'goku';
    for (const f of ['c07_departed', 'c07_examDone', 'c07_ceremony']) st.set(f);
    sim.start('c07_nameless_arena', 17, 27);
    await settle(sim);
    const kid = (id: string) => ({ npc: sim.game.field?.npcs.find((n) => n.def.id === id) });
    const said = record(sim);
    const both = async (): Promise<[string, string]> => {
      said.length = 0;
      await beat(sim, 'c07_kids_arena', kid('c07_a_goten'));
      await beat(sim, 'c07_kids_arena', kid('c07_a_trunks'));
      return [said[0], said[1]];
    };
    let [goten, trunks] = await both();
    expect(goten).not.toMatch(/Mr\. Goku/);
    expect(goten).not.toBe(trunks);
    st.set('c07_m1');
    st.set('c07_m2'); // Goku's loss: nobody knows about the needle yet.
    [goten, trunks] = await both();
    expect(`${goten}\n${trunks}`).not.toMatch(/needle|cheat/i);
    st.set('c07_m3'); // Piccolo's match exposes it.
    [goten, trunks] = await both();
    expect(goten).toMatch(/needle/i);
    expect(trunks).toMatch(/needle/i);
    for (const m of [4, 5, 6, 7]) st.set(`c07_m${m}`);
    [goten, trunks] = await both();
    expect(trunks).not.toMatch(/Mr\. Vegeta/);
  });

  it('exam replies and Monaka chatter come from the fighter you are playing', async () => {
    const sim = new Sim();
    const st = sim.game.state;
    st.data.chapter = 7;
    st.join('goku', 26);
    st.join('vegeta', 26);
    st.join('piccolo', 26);
    st.data.active = 'vegeta';
    st.set('c07_departed');
    st.addQuest('c07_exam');
    sim.start('c07_nameless_grounds', 19, 22);
    await settle(sim);
    const said = record(sim);
    await beat(sim, 'c07_vados_exam');
    expect(flag(sim, 'c07_examDone')).toBe(true);
    const vegeta = said.filter((l) => l.startsWith('Vegeta:')).join('\n');
    expect(vegeta).not.toMatch(/Easy!|Phew/);
    expect(vegeta.length).toBeGreaterThan(0);
    // After match 3 the active fighter is Piccolo, who suspects Monaka: no "fighting spirit" from him.
    for (const m of [1, 2, 3]) st.set(`c07_m${m}`);
    st.data.active = 'piccolo';
    sim.start('c07_nameless_arena', 17, 27);
    await settle(sim);
    said.length = 0;
    await beat(sim, 'c07_monaka_talk', { npc: sim.game.field?.npcs.find((n) => n.def.id === 'c07_a_monaka') });
    expect(said.join('\n')).toMatch(/^Piccolo:/m);
    expect(said.join('\n')).not.toMatch(/fighting spirit|dying to get in/);
  });

  it('only registered fighters can sit the written exam', async () => {
    const sim = new Sim();
    const st = sim.game.state;
    st.data.chapter = 7;
    st.join('goku', 25);
    st.join('gohan', 25);
    st.data.active = 'gohan';
    st.set('c07_departed');
    st.addQuest('c07_exam');
    sim.start('c07_nameless_grounds', 19, 22);
    await settle(sim);
    await beat(sim, 'c07_vados_exam');
    expect(flag(sim, 'c07_examDone')).toBe(false);
    st.data.active = 'goku';
    await beat(sim, 'c07_vados_exam');
    expect(flag(sim, 'c07_examDone')).toBe(true);
    expect(flag(sim, 'done:c07_exam')).toBe(true);
  });

  it('every act 3 script referenced from a map or overlay exists', () => {
    const ids = ['c06_start', 'c07_start', 'c08_start', 'c07_b_vegeta_talk', 'c07_cc_beerus', 'c07_vados_exam', 'c07_announcer_talk',
      'c07_arena_enter', 'c07_arena_locked', 'c08_glyph_w', 'c08_glyph_e', 'c08_monaka_fight', 'c08_fake_talk'];
    for (const id of ids) expect(SCRIPTS[id], id).toBeTruthy();
  });
});
