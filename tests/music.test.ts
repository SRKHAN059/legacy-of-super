import { afterEach, describe, expect, it } from 'vitest';
import '../src/content';
import { TRACKS } from '../src/content/music';
import { MAPS, resolveMap } from '../src/content/registry';
import { WORLDS } from '../src/content/world';
import { Audio, audio, DRUM_TOKENS, expandPattern, noteFreq, type Track } from '../src/engine/audio';
import { Sim } from './sim';

const BAR = 16;
/** Seconds per 16-row bar. */
const barSeconds = (t: Track): number => (60 / t.bpm / (t.rpb ?? 4)) * BAR;
const channels = (t: Track): Record<string, string[]> => ({
  lead: expandPattern(t.lead),
  harmony: expandPattern(t.harmony ?? ''),
  bass: expandPattern(t.bass ?? ''),
  drums: expandPattern(t.drums ?? ''),
});
const barsOf = (rows: string[]): string[] => {
  const out: string[] = [];
  for (let i = 0; i < rows.length; i += BAR) out.push(rows.slice(i, i + BAR).join(' '));
  return out;
};

describe('music tracks', () => {
  for (const [id, t] of Object.entries(TRACKS)) {
    describe(id, () => {
      const ch = channels(t);
      const rows = ch.lead.length;
      const from = t.loopFrom ?? 0;
      const loopBars = (rows - from) / BAR;

      it('has four channels of whole, equal-length bars with valid tokens', () => {
        for (const [name, c] of Object.entries(ch)) {
          expect(c.length, `${id}.${name} length`).toBe(rows);
          expect(c.length % BAR, `${id}.${name} has ${c.length} rows`).toBe(0);
          for (const tok of c) {
            if (name === 'drums') expect(['.', '-', ...DRUM_TOKENS], `${id}.${name} token ${tok}`).toContain(tok);
            else if (tok !== '.' && tok !== '-') expect(noteFreq(tok), `${id}.${name} note ${tok}`).not.toBeNull();
          }
        }
      });

      if (t.loop) {
        it('loops a full arrangement: 24-48 bars lasting 40-90 seconds, after an optional short intro', () => {
          expect(from % BAR, `${id} loopFrom ${from} is mid-bar`).toBe(0);
          expect(from / BAR, `${id} intro bars`).toBeLessThanOrEqual(4);
          expect(loopBars, `${id} loop bars`).toBeGreaterThanOrEqual(24);
          expect(loopBars, `${id} loop bars`).toBeLessThanOrEqual(48);
          const seconds = loopBars * barSeconds(t);
          expect(seconds, `${id} loop seconds`).toBeGreaterThanOrEqual(40);
          expect(seconds, `${id} loop seconds`).toBeLessThanOrEqual(90);
        });

        it('has a lead that develops instead of repeating a short phrase', () => {
          const lead = barsOf(ch.lead.slice(from));
          expect(new Set(lead).size / lead.length, `${id} distinct lead bars`).toBeGreaterThanOrEqual(0.75);
          // No period shorter than the whole loop: the melody never just restarts after a few bars.
          for (let k = 1; k < lead.length; k++) {
            if (lead.length % k !== 0) continue;
            const periodic = lead.every((b, i) => b === lead[i % k]);
            expect(periodic, `${id} lead repeats every ${k} bars`).toBe(false);
          }
        });

        it('moves its bass and harmony through the sections', () => {
          expect(new Set(barsOf(ch.bass.slice(from))).size, `${id} distinct bass bars`).toBeGreaterThanOrEqual(6);
          expect(new Set(barsOf(ch.harmony.slice(from))).size, `${id} distinct harmony bars`).toBeGreaterThanOrEqual(4);
        });
      } else {
        it('is a short one-shot jingle', () => {
          expect(t.loopFrom ?? 0).toBe(0);
          expect(rows / BAR).toBeLessThanOrEqual(4);
          expect((rows / BAR) * barSeconds(t)).toBeLessThanOrEqual(15);
        });
      }
    });
  }
});

/** Every source file, raw, so the test can see each literal track id the game asks for. */
const SOURCES = import.meta.glob<string>('../src/**/*.ts', { query: '?raw', import: 'default', eager: true });
const REFERENCE = [/\.music\(\s*'([^']+)'\s*\)/g, /playMusic\(\s*'([^']+)'\s*\)/g, /\bmusic:\s*'([^']+)'/g];

/** Track ids referenced by literal anywhere outside the soundtrack itself, with the files that use them. */
function references(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [file, src] of Object.entries(SOURCES)) {
    if (file.endsWith('/content/music.ts')) continue;
    for (const re of REFERENCE) {
      for (const m of src.matchAll(re)) out.set(m[1], [...(out.get(m[1]) ?? []), file]);
    }
  }
  return out;
}

describe('soundtrack coverage', () => {
  const refs = references();

  it('every track id the game references exists', () => {
    for (const [id, files] of refs) expect(TRACKS[id], `unknown track "${id}" in ${files.join(', ')}`).toBeTruthy();
  });

  it('every track is used at least once', () => {
    for (const id of Object.keys(TRACKS)) expect(refs.has(id), `track "${id}" is never played`).toBe(true);
  });

  it('every map and world map plays an existing track', () => {
    for (const id of Object.keys(MAPS)) {
      const m = resolveMap(id);
      expect(m && TRACKS[m.music], `map ${id} music "${m?.music}"`).toBeTruthy();
    }
    for (const w of Object.values(WORLDS)) expect(TRACKS[w.music], `world ${w.id} music "${w.music}"`).toBeTruthy();
  });

  it('no single track dominates the maps (at most 8 maps each)', () => {
    const count = new Map<string, string[]>();
    for (const m of Object.values(MAPS)) count.set(m.music, [...(count.get(m.music) ?? []), m.id]);
    for (const [id, maps] of count) expect(maps.length, `"${id}" plays on ${maps.join(', ')}`).toBeLessThanOrEqual(8);
  });

  it('each region has its own theme, as LoG2 gave each zone its own field music', () => {
    const theme: Record<string, string> = {
      paozu_forest: 'field', paozu_valley: 'peaceful', satan_plaza: 'town', wc_streets: 'westCity', c02_deck: 'party',
      desert_entry: 'desert', waste_canyon: 'wasteland', snow_peak: 'snow', kame_island: 'islands', cc_gravity: 'training',
      lookout: 'lookout', kingkai_planet: 'otherworld', beerus_grounds: 'beerusPlanet', c08_potaufeu_landing: 'alien',
      future_city: 'future', future_hideout_out: 'futureWorld', c07_nameless_arena: 'tournament', top_arena_b: 'topArena',
      pilaf_castle_in: 'cave',
    };
    for (const [map, track] of Object.entries(theme)) expect(MAPS[map]?.music, map).toBe(track);
    expect(new Set(Object.values(theme)).size).toBe(Object.keys(theme).length);
  });

  it('headline bosses fight to their own themes', () => {
    const boss: Array<[string, string]> = [
      ['c00_blackToy', 'zamasu'], ['c01_beerus', 'beerus'], ['c03_beerus', 'beerus'],
      ['c06_goldenFrieza', 'goldenFrieza'], ['c06_goldenFrieza2', 'goldenFrieza'], ['c13_goldenFrieza', 'goldenFrieza'],
      ['c07_hitV', 'hit'], ['c07_hit1', 'hit'], ['c12_hit', 'hit'], ['post_hit', 'hit'],
      ['c09_black', 'zamasu'], ['c10_black', 'zamasu'], ['c11_blackRoseA', 'zamasu'], ['c11_blackRoseB', 'zamasu'],
      ['c11_zamasuSeal', 'zamasu'], ['c11_fusedA', 'zamasu'],
      ['c14_jiren1', 'jiren'], ['c14_jiren3', 'jiren'], ['post_jiren', 'jiren'], ['c14_jiren2', 'finale'], ['c14_jiren4', 'finale'],
    ];
    for (const [enemy, track] of boss) {
      const call = new RegExp(`(?:fight|bout|bossFight|arenaFight)\\(\\s*(?:s,\\s*)?'${enemy}'`, 'g');
      let found = 0;
      for (const [file, src] of Object.entries(SOURCES)) {
        for (const m of src.matchAll(call)) {
          found++;
          // Only the script (or helper) the fight sits in counts: a theme left over from an earlier scene does not.
          const head = src.slice(0, m.index);
          const start = Math.max(0, ...[...head.matchAll(/\basync\s*(?:function\s+\w+\s*)?\(\s*s\b/g)].map((x) => x.index ?? 0));
          const before = [...head.slice(start).matchAll(/\.music\(\s*'([^']+)'\s*\)/g)];
          expect(before.at(-1)?.[1], `${enemy} in ${file}`).toBe(track);
        }
      }
      expect(found, `no fight call for ${enemy}`).toBeGreaterThan(0);
    }
  });
});

// ---- fight themes in play: the headless bot runs the scenes and listens to what the engine was asked for ----

const TICKS = 400000;

/** Tick until no script holds the controls (onEnter scripts started by warps finish too). */
async function settle(sim: Sim): Promise<void> {
  let idle = 0;
  for (let i = 0; i < TICKS && idle < 6; i += 5) {
    await sim.tick(5);
    idle = sim.game.lockDepth === 0 ? idle + 1 : 0;
  }
}

/** Start on a map (when given), then run a script the way the player reaches it, with its NPC if it has one. */
async function beat(sim: Sim, map: string | null, script: string, x?: number, y?: number): Promise<void> {
  if (map) {
    sim.start(map, x, y);
    await settle(sim);
  }
  const npc = sim.game.field?.npcs.find((n) => n.def.talk === script);
  expect(await sim.run(script, npc ? { npc } : {}, TICKS), `${script} finished`).toBe(true);
  await settle(sim);
  expect(sim.errors, `${script} errors`).toEqual([]);
}

describe('fight themes in play', () => {
  it('a fight that leaves the player on the same map hands the music back to that map\'s track', async () => {
    const sim = new Sim();
    const played: string[] = [];
    const play = sim.game.playMusic.bind(sim.game);
    sim.game.playMusic = (id: string): void => { played.push(id); play(id); };
    /** Run a scene, check it fought to `themes`, and that the player is left with the map's own track. */
    const scene = async (map: string, script: string, x: number, y: number, themes: string[]): Promise<void> => {
      played.length = 0;
      await beat(sim, map, script, x, y);
      const f = sim.game.field;
      if (!f) throw new Error(`${script}: no field`);
      for (const t of themes) expect(played, `${script} plays ${t}`).toContain(t);
      expect(audio.playing, `after ${script} on ${f.def.id}`).toBe(f.def.music);
    };

    // Chapter 12: Hit's contract on the hotel roof (the porter's lift runs the scene from the roof's onEnter).
    sim.start('paozu_home', 31, 10);
    await settle(sim);
    await beat(sim, null, 'c12_start');
    await beat(sim, 'cc_yard', 'act5_beerus_talk', 25, 17);
    await scene('satan_plaza', 'c12_porter_talk', 31, 6, ['hit']);
    expect(sim.game.field?.def.id).toBe('c12_rooftop');

    // Chapter 13: recruit spars with Krillin in Satan City and Android 17 at the poachers' camp.
    await beat(sim, null, 'c13_start');
    await scene('satan_plaza', 'c13_krillin_talk', 21, 23, ['battle']);
    await beat(sim, 'c13_monster_beach', 'c13_beach_enter', 16, 16);
    await beat(sim, 'c13_monster_hut', 'c13_17_talk', 16, 11);
    await scene('c13_monster_camp', 'c13_camp_boss', 20, 12, ['boss', 'battle']);
    expect(sim.game.state.flag('c13_17Joined')).toBe(true);
  });
});

// ---- the sequencer, against a recording stand-in for WebAudio ----

interface Hit { kind: 'osc' | 'noise'; type: string; freq: number }

class FakeParam {
  value = 0;
  setValueAtTime(v: number): this { this.value = v; return this; }
  linearRampToValueAtTime(): this { return this; }
  exponentialRampToValueAtTime(): this { return this; }
}

class FakeNode {
  connect<T>(n: T): T { return n; }
}

class FakeOsc extends FakeNode {
  type = 'sine';
  pulse = false;
  frequency = new FakeParam();
  constructor(private readonly hits: Hit[]) { super(); }
  setPeriodicWave(): void { this.pulse = true; }
  start(): void { this.hits.push({ kind: 'osc', type: this.pulse ? 'pulse' : this.type, freq: this.frequency.value }); }
  stop(): void { /* nothing to release */ }
}

class FakeSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  constructor(private readonly hits: Hit[]) { super(); }
  start(): void { this.hits.push({ kind: 'noise', type: 'noise', freq: 0 }); }
  stop(): void { /* nothing to release */ }
}

class FakeContext {
  static last: FakeContext | null = null;
  currentTime = 0;
  sampleRate = 8000;
  destination = new FakeNode();
  hits: Hit[] = [];
  /** First Fourier term of each pulse wave built: (2 / pi) * sin(pi * duty). */
  waves: number[] = [];
  constructor() { FakeContext.last = this; }
  resume(): Promise<void> { return Promise.resolve(); }
  createGain(): FakeNode & { gain: FakeParam } { return Object.assign(new FakeNode(), { gain: new FakeParam() }); }
  createOscillator(): FakeOsc { return new FakeOsc(this.hits); }
  createPeriodicWave(real: Float32Array): object { this.waves.push(real[1]); return {}; }
  createBuffer(_ch: number, len: number): { getChannelData(): Float32Array } {
    const d = new Float32Array(len);
    return { getChannelData: () => d };
  }
  createBiquadFilter(): FakeNode & { type: string; frequency: FakeParam } {
    return Object.assign(new FakeNode(), { type: 'lowpass', frequency: new FakeParam() });
  }
  createBufferSource(): FakeSource { return new FakeSource(this.hits); }
}

const win = window as unknown as Record<string, unknown>;
const realContext = win.AudioContext;
afterEach(() => { win.AudioContext = realContext; });

/** Play a track on a fresh engine for `seconds`, pumping the scheduler the way its 25 ms timer would. */
function run(track: Track, seconds: number): { audio: Audio; ctx: FakeContext } {
  win.AudioContext = FakeContext;
  const audio = new Audio();
  audio.unlock();
  const ctx = FakeContext.last;
  if (!ctx) throw new Error('the engine did not create an AudioContext');
  audio.play('test', track);
  const pump = audio as unknown as { schedule(): void };
  for (let t = 0; t < seconds; t += 0.025) {
    ctx.currentTime = t;
    pump.schedule();
  }
  return { audio, ctx };
}

const pulses = (ctx: FakeContext): number[] => ctx.hits.filter((h) => h.type === 'pulse').map((h) => Math.round(h.freq));

describe('music sequencer', () => {
  it('loops back to loopFrom, so an intro plays only once', () => {
    // 240 bpm: one bar per second. Bar 1 (C4) is the intro, bar 2 (E4) the loop.
    const { audio, ctx } = run({ bpm: 240, loop: true, loopFrom: 16, lead: 'C4*16 E4*16' }, 4.5);
    const notes = pulses(ctx);
    expect(notes.filter((f) => f === 262)).toHaveLength(1);
    expect(notes.filter((f) => f === 330).length).toBeGreaterThanOrEqual(3);
    expect(audio.playing).toBe('test');
    audio.stopMusic();
  });

  it('plays a jingle once and then falls silent', () => {
    const { audio, ctx } = run({ bpm: 240, loop: false, lead: 'C4*8 G4*8' }, 3);
    expect(pulses(ctx)).toEqual([262, 392]);
    expect(audio.playing).toBeNull();
  });

  it('synthesises every drum voice: noise for snares, hats and cymbals, triangle blips for kick and toms', () => {
    const { ctx } = run({ bpm: 240, loop: false, lead: '.*16', drums: 'k x X h o c t T .*8' }, 2);
    expect(ctx.hits.filter((h) => h.kind === 'noise')).toHaveLength(5);
    expect(ctx.hits.filter((h) => h.type === 'triangle')).toHaveLength(3);
  });

  it('gives the harmony channel its own pulse duty', () => {
    const { ctx } = run({ bpm: 240, loop: false, lead: 'C5*16', harmony: 'E4*16', leadDuty: 0.25, harmonyDuty: 0.5 }, 1.5);
    const duty = (d: number): number => (2 / Math.PI) * Math.sin(Math.PI * d);
    expect(ctx.waves.some((w) => Math.abs(w - duty(0.25)) < 1e-4)).toBe(true);
    expect(ctx.waves.some((w) => Math.abs(w - duty(0.5)) < 1e-4)).toBe(true);
  });
});
