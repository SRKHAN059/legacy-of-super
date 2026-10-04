import { describe, expect, it } from 'vitest';
import { QUESTS } from '../../src/content/quests';
import { MAPS, resolveMap } from '../../src/content/registry';
import { SCREEN_W, TILE } from '../../src/engine/constants';
import { wrap } from '../../src/engine/fontdata';
import type { Button } from '../../src/engine/input';
import { Shot } from '../../src/game/projectiles';
import { ScriptApi, SCRIPTS, type FightOpts, type FightResult, type Script } from '../../src/game/script';
import { HUB } from '../../src/content/chapters/act1/hubs';
import { CHAPTER_MIN_LEVEL, HANDOVER_LEVEL_GAP } from '../../src/content/chapters/common';
import { Sim } from '../sim';

/**
 * ACT 1 chain test: drives the Prologue, Chapter 1 and Chapter 2 gold paths headlessly (newGame -> the moment
 * c03_start would be called), plus every Act 1 side quest and NPC talk script.
 */

declare const setImmediate: (cb: () => void) => void;

const MAX = 120000;
const SEALED = 'c00_sealed';

/** Lines the scripts put on screen while a spy is installed. */
interface Spy {
  narr: string[];
  lines: Array<{ who: string; text: string; chapter: number }>;
  /** Every scripted fight / clearEnemies: the map and whatever was still open when it started. */
  fights: Array<{ what: string; map: string; open: string[] }>;
  walks: Array<[string, number, number]>;
  /** Questions asked: speaker and prompt. */
  asks: Array<{ who: string; text: string }>;
  /** Did the time machine prop still stand in the lab when the narrator said it was gone? */
  machineAtGone?: boolean;
  restore: () => void;
}

/** Everything that would let the hero leave the map (or save) while a fight is on. */
function openExits(s: ScriptApi): string[] {
  const f = s.field;
  const open: string[] = [];
  if (!s.flag(SEALED)) open.push('not sealed');
  for (const o of f.map.objects) if (!o.gone && ['save', 'worldSign', 'flight'].includes(o.def.type)) open.push(`live ${o.def.type}`);
  for (const w of f.def.warps ?? []) {
    const r = { x: w.x * TILE, y: w.y * TILE, w: Math.max(1, w.w * TILE), h: Math.max(1, w.h * TILE) };
    if (!f.col.blocked(r)) open.push(`warp to ${w.to}`);
  }
  return open;
}

/** Patch the ScriptApi prototype to record dialogue, narration, walks and the seal state of every fight. */
function spy(): Spy {
  const proto = ScriptApi.prototype;
  const orig = { narrate: proto.narrate, say: proto.say, talk: proto.talk, fight: proto.fight, clearEnemies: proto.clearEnemies, walk: proto.walk, ask: proto.ask };
  const out: Spy = { narr: [], lines: [], fights: [], walks: [], asks: [], restore: () => Object.assign(proto, orig) };
  proto.ask = async function (this: ScriptApi, who: string, text: string, options: string[], ...rest: unknown[]) {
    out.asks.push({ who, text });
    return (orig.ask as (...a: unknown[]) => Promise<number>).call(this, who, text, options, ...rest);
  };
  proto.narrate = async function (this: ScriptApi, text: string) {
    out.narr.push(text);
    if (text.includes('The machine was already gone')) out.machineAtGone = this.field.map.props.some((p) => p.kind === 'timeMachine');
    return orig.narrate.call(this, text);
  };
  proto.say = async function (this: ScriptApi, who: string, text: string, ...rest: unknown[]) {
    out.lines.push({ who, text, chapter: this.state.data.chapter });
    return (orig.say as (...a: unknown[]) => Promise<void>).call(this, who, text, ...rest);
  };
  proto.talk = async function (this: ScriptApi, lines: Array<[string, string, never?]>) {
    for (const [who, text] of lines) out.lines.push({ who, text, chapter: this.state.data.chapter });
    return orig.talk.call(this, lines);
  };
  proto.fight = async function (this: ScriptApi, type: string, opts?: FightOpts): Promise<FightResult> {
    out.fights.push({ what: type, map: this.field.def.id, open: openExits(this) });
    return orig.fight.call(this, type, opts);
  };
  proto.clearEnemies = async function (this: ScriptApi) {
    out.fights.push({ what: 'clearEnemies', map: this.field.def.id, open: openExits(this) });
    return orig.clearEnemies.call(this);
  };
  proto.walk = async function (this: ScriptApi, id: string, x: number, y: number, speed?: number) {
    out.walks.push([id, x, y]);
    return orig.walk.call(this, id, x, y, speed);
  };
  return out;
}

/** Replace scripts for the duration of a test (e.g. stop a chain at the next chapter). */
function stub(ids: string[]): () => void {
  const prev = ids.map((id) => [id, SCRIPTS[id]] as const);
  for (const id of ids) SCRIPTS[id] = async (s) => { s.set(`test_${id}_called`); };
  return () => { for (const [id, fn] of prev) if (fn) SCRIPTS[id] = fn; else delete SCRIPTS[id]; };
}

/** Tick the game WITHOUT the Sim bot (no auto-win, no dialogue skipping), holding `held` and tapping `tap`. */
async function rawTick(sim: Sim, n: number, held: Button[] = [], tap?: Button): Promise<void> {
  const all: Button[] = ['up', 'down', 'left', 'right', 'A', 'B'];
  for (let i = 0; i < n; i++) {
    for (const b of all) sim.input.inject(b, held.includes(b) || (b === tap && i === 0));
    sim.input.poll();
    sim.game.scenes.update(sim.input);
    await new Promise<void>((r) => setImmediate(r));
  }
  for (const b of all) sim.input.inject(b, false);
}

/** Start a script in the background and tick (with the bot) until `until` holds, before the bot can act on it. */
async function runUntil(sim: Sim, id: string, until: () => boolean): Promise<{ done: () => boolean }> {
  let finished = false;
  void sim.game.runScript(id).then(() => { finished = true; });
  for (let i = 0; i < MAX && !until() && !finished; i++) await sim.tick(1);
  return { done: () => finished };
}

/** Finish a background script started with runUntil. */
async function finish(sim: Sim, h: { done: () => boolean }): Promise<void> {
  for (let i = 0; i < MAX && !h.done(); i += 10) await sim.tick(10);
  expect(h.done()).toBe(true);
  await settle(sim);
}

/** A narrator question must fit the choice box (3 rows at full width; the engine cuts the rest). */
function fitsChoiceBox(text: string): boolean {
  return wrap(text, SCREEN_W - 6 - 16).length <= 3;
}

/** Every Act 1 quest still "active" in the Journal (the dojo sparring arena stays open on purpose). */
function openAct1(sim: Sim): string[] {
  return Object.entries(sim.game.state.data.journal).filter(([id, st]) => /^c0[012]_/.test(id) && st === 'active' && id !== 'c02_spar').map(([id]) => id);
}

/** Tick until every running script (including onEnter scripts) has finished. */
async function settle(sim: Sim, max = MAX): Promise<void> {
  for (let i = 0; i < max && sim.game.lockDepth > 0; i += 10) await sim.tick(10);
  await sim.tick(2);
}

/** Start on a map and let its onEnter scripts finish. */
async function enter(sim: Sim, map: string, x?: number, y?: number): Promise<void> {
  sim.start(map, x, y);
  await sim.tick(3);
  await settle(sim);
}

/** Run a script; when `npcId` is given, run it as that NPC's talk script on the current map. */
async function run(sim: Sim, id: string, npcId?: string): Promise<void> {
  const npc = npcId ? sim.game.field?.npcs.find((n) => n.def.id === npcId) : undefined;
  if (npcId) expect(npc, `NPC ${npcId} on ${sim.game.field?.def.id}`).toBeTruthy();
  const ok = await sim.run(id, npc ? { npc } : {}, MAX);
  expect(ok, `${id} finished`).toBe(true);
  await settle(sim);
  expect(sim.errors, `${id} errors`).toEqual([]);
}

/** Talk to an NPC by id on the current map (its own talk script). */
async function talk(sim: Sim, npcId: string): Promise<void> {
  const npc = sim.game.field?.npcs.find((n) => n.def.id === npcId);
  expect(npc, `NPC ${npcId} on ${sim.game.field?.def.id}`).toBeTruthy();
  await run(sim, npc?.def.talk ?? '', npcId);
}

const st = (sim: Sim) => sim.game.state;
const quest = (sim: Sim, id: string) => st(sim).data.journal[id];

/** Tile-level walkability for an actor-sized box on the current field (props, breakables and water included). */
function walkable(sim: Sim, tx: number, ty: number): boolean {
  const f = sim.game.field;
  if (!f || tx < 0 || ty < 0 || tx >= f.map.cols || ty >= f.map.rows) return false;
  return !f.col.blocked({ x: tx * TILE + 3, y: ty * TILE + 8, w: 10, h: 6 });
}

/** Can the hero walk from one tile to another on the current field? */
function reachable(sim: Sim, from: [number, number], to: [number, number]): boolean {
  const seen = new Set([from.join(',')]);
  const q: Array<[number, number]> = [from];
  while (q.length) {
    const [x, y] = q.shift() as [number, number];
    if (x === to[0] && y === to[1]) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${y + dy}`;
      if (seen.has(k) || !walkable(sim, x + dx, y + dy)) continue;
      seen.add(k);
      q.push([x + dx, y + dy]);
    }
  }
  return false;
}

/** The hero's tile on the current field. */
function heroAt(sim: Sim): [number, number] {
  const p = sim.game.field?.player;
  return p ? [Math.floor(p.x / TILE), Math.floor((p.y - 8) / TILE)] : [-1, -1];
}

/** Stub the next chapter's start so the act ends exactly at the handoff. */
function stubHandoff(): () => void {
  const prev: Script | undefined = SCRIPTS.c03_start;
  SCRIPTS.c03_start = async (s) => { s.set('test_c03_called'); };
  return () => { if (prev) SCRIPTS.c03_start = prev; else delete SCRIPTS.c03_start; };
}

describe('Act 1 main path', () => {
  it('runs newGame -> Prologue -> Chapter 1 -> Chapter 2 -> c03_start', async () => {
    const restore = stubHandoff();
    const log = spy();
    try {
      const sim = new Sim();
      const s = () => st(sim);

      // ---- Prologue.
      expect(await sim.run('newGame', {}, MAX)).toBe(true);
      await settle(sim);
      expect(sim.errors).toEqual([]);
      // Opening crawl: future Goku died of the heart virus when Trunks was an infant (Age 767), not before his birth.
      expect(log.narr.some((n) => n.includes('Son Goku: a hero who died when Trunks was still a baby.'))).toBe(true);
      expect(log.narr.some((n) => /before Trunks was (even )?born/.test(n))).toBe(false);
      expect(s().data.chapter).toBe(0);
      expect(s().data.map).toBe('future_hideout_in');
      expect(s().data.active).toBe('trunks');
      expect(s().char('trunks').joined).toBe(true);
      expect(s().char('trunks').level).toBe(6);
      expect(s().char('trunks').techs).toEqual(expect.arrayContaining(['kiBlast', 'burningAttack']));
      expect(s().flag('c00_awake')).toBe(true);

      await talk(sim, 'c00_fbulma');
      expect(quest(sim, 'c00_fuel')).toBe('active');
      await talk(sim, 'c00_fmai');
      await talk(sim, 'c00_fmai');
      await run(sim, 'c00_save_tut');

      // Briefed: Mai lets Trunks out, and the tunnel cave beside the hatch is open.
      await enter(sim, 'future_hideout_out', 17, 14);
      expect(s().data.map).toBe('future_hideout_out');
      expect(sim.game.field?.def.warps?.some((w) => w.to === 'c00_tunnel')).toBe(true);

      await enter(sim, 'c00_tunnel', 3.5, 11.6);
      expect(s().flag('c00_tunIntro')).toBe(true);
      const f0 = () => sim.game.field!;
      // Melee tutorial: the rubble choke is the only way out of the maintenance bay.
      expect(reachable(sim, [3, 11], [12, 8])).toBe(false);
      await run(sim, 'c00_hint_melee');
      for (let i = 0; i < 2; i++) f0().meleeHit({ x: 11 * TILE, y: 8 * TILE, w: TILE, h: TILE }, 10, 1);
      expect(s().flag('broke:c00_tunnel:c00_rockA')).toBe(true);
      expect(reachable(sim, [3, 11], [31, 8])).toBe(true);
      expect(reachable(sim, [3, 11], [24, 3])).toBe(true);
      // Ki tutorial: the far bank is out of reach on foot, and its flight circle is buried until the rubble is shot.
      expect(reachable(sim, [3, 11], [37, 8])).toBe(false);
      expect(f0().map.objects.some((o) => o.def.type === 'flight' && o.def.x === 31 && !o.gone)).toBe(false);
      await run(sim, 'c00_hint_ki');
      await run(sim, 'c00_pad');
      expect(s().flag('broke:c00_tunnel:c00_rubble')).toBe(false);
      expect(heroAt(sim)[0]).toBeLessThan(33);
      f0().player.x = 31 * TILE + 8;
      f0().player.y = 8 * TILE + 14;
      f0().player.dir = 'right';
      for (let i = 0; i < 3; i++) {
        const p = f0().player;
        f0().spawnShot(new Shot('player', 'shot', p.x + 10, p.y, { x: 1, y: 0 }, 3.6, 1, '#f8e070', 10, 6));
        await sim.tick(40);
      }
      expect(s().flag('broke:c00_tunnel:c00_rubble')).toBe(true);
      // Flight-circle tutorial: the circle wakes up and carries Trunks across.
      await run(sim, 'c00_pad');
      expect(heroAt(sim)).toEqual([37, 8]);
      expect(s().flag('c00_padLit')).toBe(true);
      expect(s().flag('trig:c00_hintL')).toBe(true);
      expect(f0().map.objects.some((o) => o.def.type === 'flight' && o.def.x === 31 && !o.gone)).toBe(true);
      expect(reachable(sim, [37, 8], [44, 7])).toBe(true);
      expect(reachable(sim, [37, 8], [37, 9])).toBe(true);

      await enter(sim, 'c00_depot', 2, 7.5);
      expect(s().flag('trig:c00_depotIn')).toBe(true);
      await enter(sim, 'c00_depot', 24, 5);
      await run(sim, 'c00_locker');
      // Locker -> ambush (survive + SSJ rage fight) -> departure -> Chapter 1 nightmare -> wakes up at home.
      expect(s().char('trunks').form).toBe('ssj');
      expect(s().char('trunks').joined).toBe(false);
      expect(quest(sim, 'c00_fuel')).toBe('done');
      expect(quest(sim, 'c00_return')).toBe('done');
      expect(s().flag('c00_departed')).toBe(true);
      expect(s().count('c00_fuelCell')).toBe(0);
      expect(s().data.regions).toEqual(expect.arrayContaining(['spot_future_city', 'spot_future_base']));
      // Future Trunks has been a Super Saiyan for years: no "has achieved" announcement, his rage is narrated instead.
      expect(log.narr.some((t) => t.includes('Trunks has achieved'))).toBe(false);
      expect(log.narr.some((t) => /Trunks's Super Saiyan power/.test(t))).toBe(true);
      // The time machine is really gone from the lab when the narrator says so.
      expect(log.machineAtGone).toBe(false);
      // Future Mai is human: she can't sense ki.
      expect(log.narr.some((t) => /Mai .*(felt|sensed) .*ki/.test(t))).toBe(false);

      // ---- Chapter 1.
      expect(s().data.chapter).toBe(1);
      expect(s().data.active).toBe('goku');
      expect(s().data.map).toBe('paozu_house');
      expect(s().flag('c01_dreamDone')).toBe(true);
      expect(s().char('goku').level).toBeGreaterThanOrEqual(2);
      expect(quest(sim, 'c01_farm')).toBe('active');

      await enter(sim, 'paozu_home', 12, 18);
      const radishes = sim.game.field?.pickups.filter((p) => p.item === 'c01_radish') ?? [];
      expect(radishes.length).toBeGreaterThanOrEqual(5);
      s().give('c01_radish', 5, 5);
      expect(s().flag('c01_tutRun')).toBe(true);
      await talk(sim, 'c01_goten');

      await enter(sim, 'paozu_house');
      await talk(sim, 'c01_chichi');
      expect(quest(sim, 'c01_farm')).toBe('done');
      expect(quest(sim, 'c01_tracks')).toBe('active');
      expect(s().count('c01_radish')).toBe(0);

      await enter(sim, 'paozu_forest', 30, 14);
      expect(s().flag('c01_tutForest')).toBe(true);
      expect(sim.game.field?.def.warps?.some((w) => w.to === 'c01_shrine')).toBe(true);

      await enter(sim, 'c01_shrine', 14, 12);
      await run(sim, 'c01_gate_hint');
      await run(sim, 'c01_shrine_pray');
      expect(s().char('goku').techs).toContain('kamehameha');
      expect(s().flag('c01_fangBeaten')).toBe(true);
      expect(quest(sim, 'c01_tracks')).toBe('done');

      await enter(sim, 'paozu_house');
      await talk(sim, 'c01_chichi');
      expect(quest(sim, 'c01_lunch')).toBe('active');
      expect(s().count('c01_lunch')).toBe(1);

      await enter(sim, 'gohan_house', 8, 9);
      await talk(sim, 'c01_gohan');
      expect(quest(sim, 'c01_lunch')).toBe('done');
      expect(quest(sim, 'c01_satan')).toBe('active');
      expect(s().data.regions).toEqual(expect.arrayContaining(['spot_paozu', 'spot_satancity']));

      await enter(sim, 'paozu_valley', 20, 12);
      expect(s().flag('c01_tutSign')).toBe(true);

      await enter(sim, 'satan_mansion', 17, 12);
      await talk(sim, 'c01_satan');
      expect(quest(sim, 'c01_satan')).toBe('done');
      expect(quest(sim, 'c01_money')).toBe('active');
      expect(s().count('c01_zeni')).toBe(1);

      // Money -> Beerus wakes -> King Kai -> SSJ -> Beerus -> Chapter 2 gravity room.
      await enter(sim, 'paozu_house');
      await talk(sim, 'c01_chichi');
      expect(quest(sim, 'c01_money')).toBe('done');
      expect(s().flag('c01_beerusAwake')).toBe(true);
      expect(s().char('goku').form).toBe('ssj');
      expect(quest(sim, 'c01_kingkai')).toBe('done');
      expect(s().flag('c01_beerusFight')).toBe(true);
      expect(s().data.regions).toEqual(expect.arrayContaining(['spot_kingkai']));
      // King Kai's Planet gets the same world-map announcement as every other new landing spot.
      expect(log.narr.some((t) => /King Kai.*has been added to the world map/.test(t))).toBe(true);
      // No visual description the (Super Saiyan) sprite contradicts.
      expect(log.narr.some((t) => t.includes('hair blazed down his back'))).toBe(false);
      expect(openAct1(sim).filter((q) => q.startsWith('c01_'))).toEqual([]);

      // ---- Chapter 2.
      expect(s().data.chapter).toBe(2);
      expect(s().data.active).toBe('vegeta');
      expect(s().flag('noSwitch')).toBe(true);
      expect(s().char('vegeta').joined).toBe(true);
      expect(s().char('vegeta').level).toBeGreaterThanOrEqual(8);
      expect(s().char('vegeta').techs).toContain('bigBang');
      expect(s().char('vegeta').form).toBe('ssj');
      // Goku played Chapter 1 and is benched now. Levels come from EXP (the story gates make the player grind): the
      // hand-over only nets the outgoing hero at band start - HANDOVER_LEVEL_GAP, so he keeps what his own fights
      // earned (this chain hands over the radishes instead of farming, about L5) and is never raised to the band.
      expect(s().char('goku').level).toBeGreaterThanOrEqual(CHAPTER_MIN_LEVEL[2] - HANDOVER_LEVEL_GAP);
      expect(quest(sim, 'c02_party')).toBe('active');
      expect(s().data.map).toBe('cc_gravity');

      await enter(sim, 'cc_yard', 17, 12);
      sim.choice = 0;
      await talk(sim, 'c02_driverYard');
      expect(s().data.map).toBe('c02_pier');

      await enter(sim, 'c02_deck', 19.5, 21);
      expect(s().count('scouter')).toBe(1);
      expect(quest(sim, 'c02_party')).toBe('done');
      expect(quest(sim, 'c02_scan')).toBe('active');
      await talk(sim, 'c02_krillin');
      await talk(sim, 'c02_roshi');
      expect(s().data.regions).toContain('spot_kame');
      await run(sim, 'c02_beerus_arrive');
      expect(quest(sim, 'c02_feast')).toBe('active');

      // Takoyaki chain.
      await talk(sim, 'c02_beerus');
      expect(quest(sim, 'c02_takoyaki')).toBe('active');
      await enter(sim, 'c02_galley', 7.5, 8);
      await talk(sim, 'c02_chef');
      await enter(sim, 'c02_pier', 30, 9);
      await talk(sim, 'c02_fisher');
      expect(s().count('c02_octopus')).toBe(1);
      await enter(sim, 'c02_galley', 7.5, 8);
      await talk(sim, 'c02_chef');
      expect(s().count('c02_takoyaki')).toBe(1);
      await enter(sim, 'c02_deck', 30, 6);
      await talk(sim, 'c02_beerus');
      expect(quest(sim, 'c02_takoyaki')).toBe('done');
      expect(s().get('c02_mood')).toBe(1);

      // Ramen chain (West City).
      await talk(sim, 'c02_beerus');
      expect(quest(sim, 'c02_ramen')).toBe('active');
      await enter(sim, 'c02_pier', 6, 13);
      await talk(sim, 'c02_driverPier');
      expect(s().data.map).toBe('wc_streets');
      await talk(sim, 'c02_cart');
      expect(s().flag('c02_punks')).toBe(true);
      await talk(sim, 'c02_punkBoss');
      expect(s().count('c02_capsule')).toBe(1);
      await talk(sim, 'c02_cart');
      expect(s().count('c02_ramen')).toBe(1);
      await enter(sim, 'c02_deck', 30, 6);
      await talk(sim, 'c02_beerus');
      expect(quest(sim, 'c02_ramen')).toBe('done');
      expect(s().get('c02_mood')).toBe(2);

      // Bingo -> the gang sneaks off to the hold (on screen) -> the chase -> Pilaf Machine.
      await talk(sim, 'c02_beerus');
      expect(s().flag('c02_heist')).toBe(true);
      expect(quest(sim, 'c02_thieves')).toBe('active');
      for (const id of ['c02_pilaf', 'c02_mai', 'c02_shu']) expect(log.walks.some(([w, x, y]) => w === id && x === 30.5 && y === 20.2), id).toBe(true);
      expect(sim.game.field?.npcs.some((n) => ['c02_pilaf', 'c02_mai', 'c02_shu'].includes(n.def.id))).toBe(false);
      expect(resolveMap('c02_deck')?.warps?.find((w) => w.to === 'c02_hold')?.showIf).toBe('c02_heist');
      await enter(sim, 'c02_hold', 3, 4);
      expect(s().flag('c02_chaseA')).toBe(true);
      await enter(sim, 'c02_hold', 15, 3);
      expect(s().flag('trig:c02_chaseB')).toBe(true);
      await run(sim, 'c02_hold_vault');
      expect(s().flag('c02_machineBeaten')).toBe(true);
      expect(s().flag('defeated:c02_machine')).toBe(true);
      expect(quest(sim, 'c02_thieves')).toBe('done');

      // Pudding -> point of no return -> rage -> Goku arrives -> handoff.
      await enter(sim, 'c02_deck', 30, 6);
      await talk(sim, 'c02_beerus');
      expect(quest(sim, 'c02_pudding')).toBe('active');
      expect(quest(sim, 'c02_scan')).toBe('active');
      sim.choice = 0; // "Not yet": the unfinished Scouter test is listed and nothing happens.
      await talk(sim, 'c02_buu');
      expect(s().flag('c02_rage')).toBe(false);
      expect(log.narr.some((t) => t.startsWith('Unfinished errands:') && t.includes(QUESTS.c02_scan.title))).toBe(true);
      const q2 = log.asks.find((a) => a.who === 'narrator' && a.text.includes('Buu'));
      expect(q2 && fitsChoiceBox(q2.text), q2?.text).toBe(true);
      sim.choice = 1; // "Confront Buu": the errand that can no longer be finished leaves the Journal.
      await talk(sim, 'c02_buu');
      expect(s().flag('c02_rage')).toBe(true);
      expect(s().data.journal.c02_scan).toBeUndefined();
      expect(s().data.journalOrder).not.toContain('c02_scan');
      expect(quest(sim, 'c02_feast')).toBe('done');
      expect(quest(sim, 'c02_pudding')).toBe('done');
      expect(s().flag('noSwitch')).toBe(false);
      expect(s().data.regions).toEqual(expect.arrayContaining(['spot_westcity', 'spot_kame']));
      expect(s().flag('test_c03_called')).toBe(true);
      expect(openAct1(sim)).toEqual([]);
      // Vegeta's rage is named as Super Saiyan 2, in his own words (no dub catchphrase).
      expect(log.narr.some((t) => t.includes('Super Saiyan 2'))).toBe(true);
      expect(log.lines.some((l) => /MY BULMA/i.test(l.text))).toBe(false);
      // Chapter 2 ends on Goku's arrival; the Super Saiyan God bargain belongs to c03_start.
      expect(log.lines.filter((l) => l.chapter === 2 && l.who === 'goku').some((l) => /Super Saiyan God/.test(l.text))).toBe(false);
      expect(log.lines.some((l) => l.who === 'beerus' && /don't make me wait/i.test(l.text))).toBe(false);
      // Every scripted fight of the act ran on a sealed map, and the seal was lifted afterwards.
      expect(log.fights.map((f) => f.what)).toEqual([
        'c00_blackToy', 'c00_blackRage', 'c01_dreamFrieza', 'c01_fang', 'clearEnemies', 'c01_beerus',
        'clearEnemies', 'clearEnemies', 'c02_pilafMachine', 'c01_beerus', 'c02_beerusRage',
      ]);
      for (const f of log.fights) expect(f.open, `${f.what} on ${f.map}`).toEqual([]);
      expect(s().flag(SEALED)).toBe(false);
      expect(sim.errors).toEqual([]);
    } finally {
      log.restore();
      restore();
    }
  }, 300000);
});

describe('Act 1 side quests', () => {
  function ch1(sim: Sim): void {
    const s = st(sim);
    s.data.chapter = 1;
    s.join('goku', 5);
    s.data.active = 'goku';
    s.set('c01_awake');
  }

  it('c01_gift: Goten & Trunks -> shopper -> hot spring serpent -> Videl', async () => {
    const sim = new Sim();
    ch1(sim);
    st(sim).completeQuest('c01_farm');
    st(sim).completeQuest('c01_tracks');
    await enter(sim, 'paozu_valley', 13, 9);
    sim.choice = 0;
    await talk(sim, 'c01_vtrunks');
    expect(quest(sim, 'c01_gift')).toBe('active');
    await enter(sim, 'satan_shop', 7, 7);
    await talk(sim, 'c01_shopper');
    expect(st(sim).flag('c01_giftSpring')).toBe(true);
    await enter(sim, 'c01_hotspring', 17, 8);
    await run(sim, 'c01_g4_hint');
    await run(sim, 'c01_spring');
    expect(st(sim).flag('c01_serpentBeaten')).toBe(true);
    expect(st(sim).count('c01_springWater')).toBe(1);
    await enter(sim, 'gohan_house', 8, 9);
    await talk(sim, 'c01_videl');
    expect(quest(sim, 'c01_gift')).toBe('done');
    expect(st(sim).count('pow1')).toBe(1);
  }, 120000);

  it('c01_dino: Goten -> Scarface on the Peaks plateau -> dino tail -> Goten', async () => {
    const sim = new Sim();
    ch1(sim);
    st(sim).completeQuest('c01_farm');
    st(sim).completeQuest('c01_tracks');
    await enter(sim, 'paozu_valley', 13, 9);
    sim.choice = 0;
    await talk(sim, 'c01_vgoten');
    expect(quest(sim, 'c01_dino')).toBe('active');
    // Landing on the plateau (the basin's flight circle drops you at 21,7) sets Scarface off.
    await enter(sim, 'paozu_peaks', 21, 7);
    expect(st(sim).flag('c01_scarfaceBeaten')).toBe(true);
    expect(st(sim).count('c01_tail')).toBe(1);
    await enter(sim, 'paozu_peaks', 21, 7);
    expect(sim.errors).toEqual([]);
    await enter(sim, 'paozu_valley', 13, 9);
    await talk(sim, 'c01_vgoten');
    expect(quest(sim, 'c01_dino')).toBe('done');
    expect(st(sim).count('c01_tail')).toBe(0);
    expect(st(sim).count('end1')).toBe(1);
    await talk(sim, 'c01_vgoten');
  }, 120000);

  it('prologue gating: Mai keeps Trunks inside until the briefing; the tunnel seals after the departure', async () => {
    const sim = new Sim();
    const s = st(sim);
    s.data.chapter = 0;
    s.join('trunks', 6);
    s.data.active = 'trunks';
    await enter(sim, 'future_hideout_out', 17, 14);
    expect(s.data.map).toBe('future_hideout_out'); // not mid-prologue: no effect
    s.set('c00_awake');
    await enter(sim, 'future_hideout_out', 17, 14);
    expect(s.data.map).toBe('future_hideout_in');
    expect(sim.errors).toEqual([]);
    const warp = resolveMap('future_hideout_out')?.warps?.find((w) => w.to === 'c00_tunnel');
    expect(warp?.hideIf).toBe('c00_departed');
    expect(warp?.lockedScript).toBe('c00_tunnel_sealed');
    await run(sim, 'c00_tunnel_sealed');
  }, 120000);

  it('c01_autograph: Mika -> Mr. Satan -> Mika', async () => {
    const sim = new Sim();
    ch1(sim);
    st(sim).completeQuest('c01_satan');
    await enter(sim, 'satan_plaza', 24, 26);
    sim.choice = 0;
    await talk(sim, 'c01_fan');
    expect(quest(sim, 'c01_autograph')).toBe('active');
    await enter(sim, 'satan_mansion', 17, 12);
    await talk(sim, 'c01_satan');
    expect(st(sim).count('c01_photo')).toBe(1);
    await enter(sim, 'satan_plaza', 24, 26);
    await talk(sim, 'c01_fan');
    expect(quest(sim, 'c01_autograph')).toBe('done');
    expect(st(sim).count('str1')).toBe(1);
  }, 120000);

  it('c01_goat: carry Mei back to Old Hiro (and she bolts when hit)', async () => {
    const sim = new Sim();
    ch1(sim);
    await enter(sim, 'paozu_forest', 38, 14);
    sim.choice = 0;
    await talk(sim, 'c01_hiro');
    expect(quest(sim, 'c01_goat')).toBe('active');
    await enter(sim, 'paozu_forest', 7, 21);
    await talk(sim, 'c01_goatNpc');
    expect(sim.game.field?.carrying?.label).toBe('goat');
    await run(sim, 'c01_goat_break');
    sim.game.field!.carrying = null;
    await talk(sim, 'c01_goatNpc');
    expect(sim.game.field?.carrying).toBeTruthy();
    await talk(sim, 'c01_hiro');
    expect(quest(sim, 'c01_goat')).toBe('done');
    expect(st(sim).flag('c01_goatHome')).toBe(true);
  }, 120000);

  it('c02_scan: five scans for Bulma', async () => {
    const sim = new Sim();
    const s = st(sim);
    s.data.chapter = 2;
    s.join('vegeta', 9);
    s.data.active = 'vegeta';
    s.set('c02_boarded');
    s.set('c02_scouter');
    s.addQuest('c02_scan');
    await enter(sim, 'c02_deck', 20, 7);
    await talk(sim, 'c02_bulma');
    expect(quest(sim, 'c02_scan')).toBe('active');
    s.data.scans.push('npc:krillin', 'npc:android18', 'npc:yamcha', 'npc:tien', 'npc:bulma');
    await talk(sim, 'c02_bulma');
    expect(quest(sim, 'c02_scan')).toBe('done');
  }, 120000);

  it('c02_spar: Yamcha, Krillin, Tien - one bout per visit, STR/POW/END +3', async () => {
    const sim = new Sim();
    const s = st(sim);
    s.data.chapter = 3;
    s.set('c02_rage');
    s.join('goku', 12);
    s.data.active = 'goku';
    sim.choice = 0;
    await enter(sim, 'satan_dojo', 9, 11);
    expect(quest(sim, 'c02_spar')).toBe('active');
    const expBefore = s.char('goku').exp;
    await talk(sim, 'c02_spKrillinNpc');
    expect(s.flag('c02_beatKrillin')).toBe(false);
    await talk(sim, 'c02_spYamchaNpc');
    expect(s.flag('c02_beatYamcha')).toBe(true);
    expect(s.count('str3')).toBe(1);
    await talk(sim, 'c02_spKrillinNpc');
    expect(s.flag('c02_beatKrillin')).toBe(false); // one bout per visit
    await enter(sim, 'satan_dojo', 9, 11);
    await talk(sim, 'c02_spKrillinNpc');
    expect(s.count('pow3')).toBe(1);
    await enter(sim, 'satan_dojo', 9, 11);
    await talk(sim, 'c02_spTienNpc');
    expect(s.count('end3')).toBe(1);
    expect(quest(sim, 'c02_spar')).toBe('done');
    expect(s.char('goku').exp).toBe(expBefore);
  }, 120000);

  it('c02_spar: no free heal; a lost bout means HP/2 and the dojo door, no reward (ROM script 0x3B63B4)', async () => {
    const sim = new Sim();
    const s = st(sim);
    s.data.chapter = 3;
    s.set('c02_rage');
    s.join('goku', 12);
    s.join('vegeta', 12);
    s.data.active = 'goku';
    sim.choice = 0;
    // The fallback exit in HUB must stay in step with the dojo's real door.
    const door = resolveMap('satan_dojo')?.warps?.find((w) => w.door);
    expect(door && [door.to, door.tx, door.ty]).toEqual(['satan_mansion', ...HUB.satanDojo.outside]);

    // A won bout gives the capsule and nothing else: the benched fighter stays hurt and drained.
    await enter(sim, 'satan_dojo', 9, 11);
    const vegeta = s.char('vegeta');
    vegeta.hp = 1;
    vegeta.ep = 0;
    await talk(sim, 'c02_spYamchaNpc');
    expect(s.flag('c02_beatYamcha')).toBe(true);
    expect(s.count('str3')).toBe(1);
    expect([vegeta.hp, vegeta.ep]).toEqual([1, 0]);
    expect(sim.game.field?.def.id).toBe('satan_dojo');

    // A lost bout: a real knockout through fight()'s loseOk hook (the Sim bot would otherwise win at once).
    await enter(sim, 'satan_dojo', 9, 11);
    const goku = s.char('goku');
    const warps: Array<{ map: string; x: number; y: number; hp: number; ep: number }> = [];
    const origWarp = ScriptApi.prototype.warp;
    ScriptApi.prototype.warp = async function (this: ScriptApi, map: string, x: number, y: number, dir?: Parameters<typeof origWarp>[3]) {
      const c = this.state.char(this.hero);
      warps.push({ map, x, y, hp: c.hp, ep: c.ep });
      return origWarp.call(this, map, x, y, dir);
    };
    try {
      const h = await runUntil(sim, 'c02_spar_krillin', () => sim.game.fightDepth > 0);
      const f = sim.game.field;
      expect(f?.enemies.some((e) => e.uid === 'c02_spKrillin_bout')).toBe(true);
      goku.ep = 5;
      goku.hp = 3;
      if (f) f.damagePlayer(9999, 10, f.player.x, f.player.y, { noInv: true });
      await rawTick(sim, 5);
      await finish(sim, h);
    } finally {
      ScriptApi.prototype.warp = origWarp;
    }
    expect(sim.errors).toEqual([]);
    expect(warps).toEqual([{ map: 'satan_mansion', x: 31, y: 8, hp: Math.floor(goku.hpMax / 2), ep: 5 }]);
    expect(sim.game.field?.def.id).toBe('satan_mansion');
    expect([vegeta.hp, vegeta.ep]).toEqual([1, 0]);
    expect(s.flag('c02_beatKrillin')).toBe(false);
    expect(s.count('pow3')).toBe(0);
    expect(quest(sim, 'c02_spar')).toBe('active');

    // Walking back in starts a new visit: the rematch is on.
    await enter(sim, 'satan_dojo', 9, 11);
    await talk(sim, 'c02_spKrillinNpc');
    expect(s.flag('c02_beatKrillin')).toBe(true);
    expect(s.count('pow3')).toBe(1);
  }, 120000);
});

describe('Act 1 NPC talk scripts across story beats', () => {
  const MAPS: Array<[string, Array<[number, number]>]> = [
    ['future_hideout_in', [[0, 0], [0, 1], [0, 2]]],
    ['paozu_peaks', [[1, 2]]],
    ['paozu_house', [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4]]],
    ['paozu_home', [[1, 0], [1, 1]]],
    ['paozu_valley', [[1, 2], [1, 3]]],
    ['gohan_house', [[1, 0], [1, 2], [1, 3], [1, 4]]],
    ['satan_mansion', [[1, 3], [1, 4]]],
    ['satan_plaza', [[1, 3], [2, 0]]],
    ['satan_shop', [[1, 3]]],
    ['paozu_forest', [[1, 1], [2, 0]]],
    ['kingkai_planet', [[1, 5], [2, 0]]],
    ['c02_deck', [[2, 0], [2, 1], [2, 2]]],
    ['c02_pier', [[2, 0], [2, 1], [2, 2]]],
    ['c02_galley', [[2, 0], [2, 1]]],
    ['wc_streets', [[2, 0]]],
    ['cc_yard', [[2, 0]]],
    ['satan_dojo', [[3, 0]]],
  ];

  /** Put the save into a representative state for (chapter, beat). */
  function setup(sim: Sim, chapter: number, b: number): void {
    const s = st(sim);
    s.data.chapter = chapter;
    if (chapter === 0) {
      s.join('trunks', 6);
      s.data.active = 'trunks';
      if (b >= 1) { s.set('c00_awake'); s.set('c00_briefed'); s.addQuest('c00_fuel'); }
      if (b >= 2) s.give('c00_fuelCell', 2, 3);
      return;
    }
    s.join('goku', 5);
    s.data.active = 'goku';
    if (chapter === 1) {
      s.set('c01_awake');
      const chain = ['c01_farm', 'c01_tracks', 'c01_lunch', 'c01_satan', 'c01_money', 'c01_kingkai'];
      chain.forEach((q, i) => { if (i < b) s.completeQuest(q); else if (i === b) s.addQuest(q); });
      // On the planet after Beerus's visit (a visit cut short mid-training resumes on entry: tested separately).
      if (b >= 5) { s.set('c01_atKingKai'); s.set('c01_beerusFight'); }
      return;
    }
    s.join('vegeta', 9);
    s.data.active = 'vegeta';
    s.set('c02_boarded');
    s.set('c02_scouter');
    if (b >= 1) s.set('c02_beerusArrived');
    if (b >= 2) { s.set('c02_heist'); s.set('c02_mood', 3); }
  }

  for (const [map, states] of MAPS) {
    it(`talk scripts on ${map}`, async () => {
      for (const [chapter, b] of states) {
        const sim = new Sim();
        setup(sim, chapter, b);
        sim.choice = 1;
        await enter(sim, map);
        const npcs = (sim.game.field?.npcs ?? []).filter((n) => /^c0[012]_/.test(n.def.id) && n.def.talk);
        for (const n of npcs) {
          const ok = await sim.run(n.def.talk, { npc: n }, MAX);
          expect(ok, `${map}/${n.def.id} (ch${chapter}/${b}) finished`).toBe(true);
          await settle(sim);
          if (sim.game.field?.def.id !== map) await enter(sim, map);
        }
        expect(sim.errors, `${map} ch${chapter}/${b}`).toEqual([]);
      }
    }, 120000);
  }
});

/** Tick (with the bot) until `cond` holds, stopping before the bot can act on the new state. */
async function tickUntil(sim: Sim, cond: () => boolean, max = MAX): Promise<void> {
  for (let i = 0; i < max && !cond(); i++) await sim.tick(1);
  expect(cond()).toBe(true);
}

function prologueState(sim: Sim): void {
  const s = st(sim);
  s.data.chapter = 0;
  s.join('trunks', 6);
  s.data.active = 'trunks';
  s.learn('trunks', 'burningAttack');
  s.set('c00_awake');
  s.set('c00_briefed');
  s.addQuest('c00_fuel');
}

function ch1State(sim: Sim, level = 5): void {
  const s = st(sim);
  s.data.chapter = 1;
  s.join('goku', level);
  s.data.active = 'goku';
  s.set('c01_awake');
}

function ch2State(sim: Sim, level = 9): void {
  const s = st(sim);
  s.data.chapter = 2;
  s.join('goku', 8);
  s.join('vegeta', level);
  s.data.active = 'vegeta';
  s.set('noSwitch');
}

describe('Act 1 scripted fights seal the map', () => {
  it('depot ambush: the west door and the save disc are dead while Black is fighting', async () => {
    const restore = stub(['c01_start']);
    try {
      const sim = new Sim();
      prologueState(sim);
      await enter(sim, 'c00_depot', 24, 5);
      const f = () => sim.game.field!;
      expect(f().map.objects.find((o) => o.def.type === 'save')?.gone).toBe(false);
      const h = await runUntil(sim, 'c00_locker', () => sim.game.allowControl && !!sim.game.field?.boss);
      expect(f().boss?.def.id).toBe('c00_blackToy');
      expect(st(sim).flag(SEALED)).toBe(true);
      // Run for the west door (no bot: real input, nobody wins the fight for us).
      f().player.inv = 9999;
      f().player.x = 3 * TILE + 8;
      f().player.y = 8 * TILE + 14;
      await rawTick(sim, 150, ['left']);
      expect(st(sim).data.map).toBe('c00_depot');
      expect(f().def.id).toBe('c00_depot');
      expect(f().player.x).toBeGreaterThan(TILE);
      // Try to save at the disc mid-fight: A throws a punch instead of opening the save menu.
      f().player.x = 3 * TILE + 8;
      f().player.y = 100;
      f().player.dir = 'up';
      expect(f().tryInteract()).toBe(false);
      await rawTick(sim, 4, [], 'A');
      expect(sim.game.scenes.top?.constructor.name).toBe('Field');
      await finish(sim, h);
      expect(st(sim).flag('c00_departed')).toBe(true);
      expect(st(sim).flag(SEALED)).toBe(false);
      expect(sim.errors).toEqual([]);
      // Control: with no fight on, the very same walk leaves through the west door.
      await enter(sim, 'c00_depot', 3, 8);
      sim.game.field!.player.x = 3 * TILE + 8;
      sim.game.field!.player.y = 8 * TILE + 14;
      await rawTick(sim, 150, ['left']);
      expect(st(sim).data.map).toBe('c00_tunnel');
    } finally {
      restore();
    }
  }, 120000);

  it("King Kai's planet: world sign and save disc are dead during the Gregory drill (and a cut-short visit resumes)", async () => {
    const restore = stub(['c02_start']);
    try {
      const sim = new Sim();
      ch1State(sim);
      const s = st(sim);
      for (const q of ['c01_farm', 'c01_tracks', 'c01_lunch', 'c01_satan', 'c01_money']) s.completeQuest(q);
      s.addQuest('c01_kingkai');
      s.set('c01_atKingKai');
      // Landing on the planet mid-visit: the onEnter picks the training back up.
      sim.start('kingkai_planet', 16, 18);
      await tickUntil(sim, () => sim.game.allowControl && !!sim.game.field?.enemies.some((e) => e.uid === 'c01_greg'));
      const f = sim.game.field!;
      expect(s.flag(SEALED)).toBe(true);
      f.player.inv = 9999;
      f.player.dir = 'up';
      f.player.x = 13 * TILE + 8; // below the world sign (13,21)
      f.player.y = 372;
      expect(f.tryInteract()).toBe(false);
      await rawTick(sim, 4, [], 'A');
      expect(sim.game.scenes.top?.constructor.name).toBe('Field');
      f.player.x = 19 * TILE + 8; // below the save disc (19,21)
      expect(f.tryInteract()).toBe(false);
      await settle(sim);
      expect(s.flag('c01_beerusFight')).toBe(true);
      expect(s.data.journal.c01_kingkai).toBe('done');
      expect(s.flag('test_c02_start_called')).toBe(true);
      expect(s.flag(SEALED)).toBe(false);
      expect(f.map.objects.filter((o) => o.def.type === 'save' || o.def.type === 'worldSign').every((o) => !o.gone)).toBe(true);
      expect(sim.errors).toEqual([]);
    } finally {
      restore();
    }
  }, 120000);
});

describe('Act 1 beats resume after an interruption', () => {
  it('depot: an ambush that never reached the run home restarts at the locker', async () => {
    const restore = stub(['c01_start']);
    try {
      const sim = new Sim();
      prologueState(sim);
      const s = st(sim);
      s.completeQuest('c00_fuel');
      s.set('c00_ambushed');
      await enter(sim, 'c00_depot', 24, 5);
      expect(resolveMap('c00_depot')?.triggers?.find((t) => t.id === 'c00_locker')?.hideIf).toBe('c00_departed');
      await run(sim, 'c00_locker');
      expect(s.flag('c00_departed')).toBe(true);
      expect(s.data.journal.c00_return).toBe('done');
      expect(s.flag('test_c01_start_called')).toBe(true);
    } finally {
      restore();
    }
  }, 120000);

  it('Fang: a lost bout does not finish the tracks; he pounces again at the tablet and must be beaten', async () => {
    const proto = ScriptApi.prototype;
    const orig = proto.fight;
    let lost = 0;
    proto.fight = async function (this: ScriptApi, type: string, opts?: FightOpts): Promise<FightResult> {
      if (type === 'c01_fang' && lost === 0) { lost++; return 'lose'; }
      return orig.call(this, type, opts);
    };
    try {
      const sim = new Sim();
      ch1State(sim, 3);
      const s = st(sim);
      s.completeQuest('c01_farm');
      s.addQuest('c01_tracks');
      await enter(sim, 'c01_shrine', 14, 6);
      await run(sim, 'c01_shrine_pray');
      expect(lost).toBe(1);
      expect(s.flag('c01_kame')).toBe(true);
      expect(s.flag('c01_fangLost')).toBe(true);
      expect(s.flag('c01_fangBeaten')).toBe(false);
      expect(s.data.journal.c01_tracks).toBe('active');
      // Back up to the tablet: Fang pounces again (walk-in trigger), and this time loses.
      await enter(sim, 'c01_shrine', 14, 3);
      expect(s.flag('c01_fangBeaten')).toBe(true);
      expect(s.data.journal.c01_tracks).toBe('done');
      expect(sim.errors).toEqual([]);
      // The tablet also restarts an unfinished Fang fight on its own.
      const sim2 = new Sim();
      ch1State(sim2, 3);
      st(sim2).completeQuest('c01_farm');
      st(sim2).addQuest('c01_tracks');
      st(sim2).set('c01_kame');
      await enter(sim2, 'c01_shrine', 14, 6);
      await run(sim2, 'c01_shrine_pray');
      expect(st(sim2).flag('c01_fangBeaten')).toBe(true);
      expect(st(sim2).data.journal.c01_tracks).toBe('done');
    } finally {
      proto.fight = orig;
    }
  }, 120000);

  it('gravity room: a cut-short opening resumes on re-entry, so the party quest and West City are never lost', async () => {
    const sim = new Sim();
    ch2State(sim, 8);
    const s = st(sim);
    s.set('c02_gravityOn');
    await enter(sim, 'cc_gravity', 7, 7);
    expect(s.flag('c02_intro')).toBe(true);
    expect(s.data.journal.c02_party).toBe('active');
    expect(s.data.regions).toContain('spot_westcity');
    expect(s.flag(SEALED)).toBe(false);
    // Once done, re-entering is quiet.
    await enter(sim, 'cc_gravity', 7, 7);
    expect(sim.errors).toEqual([]);
  }, 120000);
});

describe('Act 1 points of no return', () => {
  it('Chapter 1: Chi-Chi lists open errands; going on hands over what is in hand and drops the rest', async () => {
    const restore = stub(['c02_start']);
    const log = spy();
    try {
      const sim = new Sim();
      ch1State(sim, 6);
      const s = st(sim);
      for (const q of ['c01_farm', 'c01_tracks', 'c01_lunch', 'c01_satan']) s.completeQuest(q);
      s.addQuest('c01_money');
      s.give('c01_zeni', 1, 1);
      s.addQuest('c01_gift');
      s.give('c01_springWater', 1, 1);
      for (const q of ['c01_dino', 'c01_autograph', 'c01_goat']) s.addQuest(q);
      await enter(sim, 'paozu_house');
      sim.choice = 0;
      await talk(sim, 'c01_chichi');
      expect(s.data.journal.c01_money).toBe('active');
      expect(s.count('c01_zeni')).toBe(1);
      const warn = log.narr.find((t) => t.startsWith('Unfinished errands:')) ?? '';
      for (const q of ['c01_gift', 'c01_dino', 'c01_autograph', 'c01_goat']) expect(warn).toContain(QUESTS[q].title);
      const q1 = log.asks.find((a) => a.who === 'narrator');
      expect(q1 && fitsChoiceBox(q1.text), q1?.text).toBe(true);
      sim.choice = 1;
      await talk(sim, 'c01_chichi');
      expect(s.data.journal.c01_money).toBe('done');
      // The spring water was in hand: delivered with Videl's usual rewards.
      expect(s.data.journal.c01_gift).toBe('done');
      expect(s.count('c01_springWater')).toBe(0);
      expect(s.count('pow1')).toBe(1);
      expect(s.count('end1')).toBe(1);
      // The rest can no longer be finished, so they leave the Journal instead of staying "active" forever.
      for (const q of ['c01_dino', 'c01_autograph', 'c01_goat']) {
        expect(s.data.journal[q], q).toBeUndefined();
        expect(s.data.journalOrder).not.toContain(q);
      }
      expect(openAct1(sim)).toEqual([]);
      expect(s.flag('test_c02_start_called')).toBe(true);
      expect(sim.errors).toEqual([]);
    } finally {
      log.restore();
      restore();
    }
  }, 120000);

  it('Chapter 1: with no errands open there is no prompt', async () => {
    const restore = stub(['c02_start']);
    const log = spy();
    try {
      const sim = new Sim();
      ch1State(sim, 6);
      const s = st(sim);
      for (const q of ['c01_farm', 'c01_tracks', 'c01_lunch', 'c01_satan', 'c01_gift']) s.completeQuest(q);
      s.addQuest('c01_money');
      s.give('c01_zeni', 1, 1);
      await enter(sim, 'paozu_house');
      sim.choice = 0;
      await talk(sim, 'c01_chichi');
      expect(s.data.journal.c01_money).toBe('done');
      expect(log.narr.some((t) => t.startsWith('Unfinished errands:'))).toBe(false);
    } finally {
      log.restore();
      restore();
    }
  }, 120000);

  it('Chapter 2: confronting Buu wraps up a finished Scouter test with Bulma\'s reward', async () => {
    const restore = stub(['c03_start']);
    try {
      const sim = new Sim();
      ch2State(sim);
      const s = st(sim);
      for (const f of ['c02_boarded', 'c02_scouter', 'c02_beerusArrived', 'c02_heist', 'c02_machineBeaten']) s.set(f);
      s.set('c02_mood', 3);
      s.addQuest('c02_feast');
      s.addQuest('c02_pudding');
      s.addQuest('c02_scan');
      s.data.scans.push('npc:krillin', 'npc:android18', 'npc:yamcha', 'npc:tien', 'npc:bulma');
      await enter(sim, 'c02_deck', 12, 14);
      sim.choice = 1;
      await talk(sim, 'c02_buu');
      expect(s.flag('c02_rage')).toBe(true);
      expect(s.data.journal.c02_scan).toBe('done');
      expect(s.count('pow1')).toBe(1);
      expect(openAct1(sim)).toEqual([]);
      expect(s.flag('test_c03_start_called')).toBe(true);
      expect(sim.errors).toEqual([]);
    } finally {
      restore();
    }
  }, 120000);
});

describe("Goku's errands in Chapter 2", () => {
  it('Mika and Old Hiro only offer them to Goku, and Goku-only beats stay quiet for Vegeta', async () => {
    const log = spy();
    try {
      const sim = new Sim();
      ch2State(sim);
      const s = st(sim);
      sim.choice = 0;
      await enter(sim, 'satan_plaza', 24, 26);
      await talk(sim, 'c01_fan');
      expect(s.data.journal.c01_autograph).toBeUndefined();
      await enter(sim, 'paozu_forest', 38, 14);
      await talk(sim, 'c01_hiro');
      expect(s.data.journal.c01_goat).toBeUndefined();
      // An old save with the dino errand still open: Scarface does not answer to Vegeta, and Goku's lines never play.
      s.addQuest('c01_dino');
      await enter(sim, 'paozu_peaks', 21, 7);
      expect(s.flag('c01_scarfaceBeaten')).toBe(false);
      expect(s.count('c01_tail')).toBe(0);
      expect(log.lines.filter((l) => l.who === 'goku')).toEqual([]);
      expect(sim.errors).toEqual([]);
    } finally {
      log.restore();
    }
  }, 120000);
});

describe('Chapter 2 cargo hold', () => {
  it('the maze leads to the vault; the prize store behind it needs Vegeta at level 10', async () => {
    const sim = new Sim();
    ch2State(sim, 9);
    const s = st(sim);
    for (const f of ['c02_boarded', 'c02_heist', 'c02_chaseA', 'c02_machineBeaten']) s.set(f);
    await enter(sim, 'c02_hold', 3, 4);
    const f = sim.game.field!;
    const gate = { x: 34 * TILE, y: 13 * TILE, w: TILE, h: 2 * TILE };
    expect(reachable(sim, [3, 4], [31, 9])).toBe(true);
    expect(reachable(sim, [31, 9], [36, 14])).toBe(false);
    f.meleeHit(gate, 10, 1);
    expect(s.flag('gate:c02_hold:c02_g10')).toBe(false);
    expect(reachable(sim, [31, 9], [36, 14])).toBe(false);
    s.join('vegeta', 10);
    f.meleeHit(gate, 10, 1);
    expect(s.flag('gate:c02_hold:c02_g10')).toBe(true);
    expect(reachable(sim, [31, 9], [36, 14])).toBe(true);
    expect(sim.errors).toEqual([]);
  }, 120000);
});

describe('Act 1 placement and text', () => {
  it('every Act 1 NPC stands on open ground', async () => {
    const bad: string[] = [];
    for (const id of Object.keys(MAPS)) {
      const npcs = (resolveMap(id)?.npcs ?? []).filter((n) => /^c0[012]_/.test(n.id));
      if (!npcs.length) continue;
      const sim = new Sim();
      sim.start(id);
      for (const n of npcs) if (!walkable(sim, Math.floor(n.x), Math.floor(n.y))) bad.push(`${id}/${n.id} @${n.x},${n.y}`);
    }
    expect(bad).toEqual([]);
  }, 120000);

  it('the autograph errand names Mika, the girl in the plaza', () => {
    expect(QUESTS.c01_autograph.desc).toContain('girl');
    expect(QUESTS.c01_autograph.desc).not.toMatch(/\bboy\b/);
  });
});
