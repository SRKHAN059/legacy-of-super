import { describe, expect, it, vi } from 'vitest';
import { CHAPTER_MIN_LEVEL, ensureChapterState, force, FORCED_LEVEL_GAP, HANDOVER_LEVEL_GAP, STORY_RUN } from '../src/content/chapters/common';
import { inArena } from '../src/content/chapters/act3/helpers';
import { ENEMIES } from '../src/content/enemies';
import { resolveMap } from '../src/content/registry';
import { SPOTS } from '../src/content/world';
import { audio } from '../src/engine/audio';
import { SCREEN_H, SCREEN_W, TILE } from '../src/engine/constants';
import { wrap } from '../src/engine/fontdata';
import { font } from '../src/engine/gfx';
import { dpadButtons, type Button } from '../src/engine/input';
import { Loop } from '../src/engine/loop';
import { BOSS_ARMOR, BOSS_HITSTUN, BOSS_POISE_HITS, BOSS_TECH_STUN, enemyMaxHp, type Enemy } from '../src/game/enemy';
import type { Field } from '../src/game/field';
import { TIMER_Y } from '../src/game/hud';
import { damage, ENEMY_POWER, enemyPowerScale, rollToLevel } from '../src/game/leveling';
import { Shot } from '../src/game/projectiles';
import { registerScripts, type ScriptApi } from '../src/game/script';
import { decodeSaveCode, encodeSaveCode, GameState, newChar, newGame, repairSave, SAVE_VERSION, SaveCodeError, SaveService, type SaveData } from '../src/game/state';
import { BrowserStorage, type StorageHost } from '../src/game/storage';
import { cachedGrounds, setGroundCacheLimit } from '../src/game/world';
import { CreditsScene } from '../src/ui/credits';
import { ChoiceScene, DialogueScene, textSettings, type Line } from '../src/ui/dialogue';
import { PauseMenu } from '../src/ui/pause';
import { spotBiome, worldTexel } from '../src/ui/worldmap';
import { CHARACTERS } from '../src/content/characters';
import { Rng } from '../src/engine/math';
import { TRACKS } from '../src/content/music';
import { CAPTION_ROWS, CAPTION_TOP, FIELD_TOP, GOKU_Y, GOTEN_Y, IntroScene } from '../src/ui/intro';
import { SaveMenu } from '../src/ui/savemenu';
import { ATTRACT_IDLE_FRAMES, DomSaveCodeUi, TitleScene, type SaveCodeUi } from '../src/ui/title';
import { HUMANOID_H } from '../src/art/humanoid';
import { Sim } from './sim';

declare const setImmediate: (cb: () => void) => void;
const flush = () => new Promise<void>((r) => setImmediate(r));

/** Advance n ticks with exactly these buttons held (no bot). */
async function step(sim: Sim, n = 1, held: Partial<Record<Button, boolean>> = {}): Promise<void> {
  for (let i = 0; i < n; i++) {
    for (const b of Object.keys(held) as Button[]) sim.input.inject(b, !!held[b]);
    sim.input.poll();
    sim.game.scenes.update(sim.input);
    await flush();
  }
}

function field(sim: Sim): Field {
  const f = sim.game.field;
  if (!f) throw new Error('no field');
  return f;
}

/** Goku in the dev arena (hostile) next to the sparring robot boss. */
function bossArena(): { sim: Sim; f: Field; boss: Enemy } {
  const sim = new Sim();
  sim.game.state.join('goku', 20);
  sim.game.state.data.active = 'goku';
  sim.start('dev_arena', 4, 8);
  const f = field(sim);
  f.player.dir = 'right';
  const boss = f.spawnEnemy('devBoss', f.player.x + 18, f.player.y);
  return { sim, f, boss };
}

// ------------------------------------------------------------------------------------------------ boss poise

describe('boss poise (LoG2 chase-lock: pinned briefly, then recover and counter)', () => {
  it('ordinary hits stun a boss for a few frames only, and five quick hits make it break free', async () => {
    const { sim, f, boss } = bossArena();
    for (let i = 1; i < BOSS_POISE_HITS; i++) {
      f.applyDamage(boss, 10, 0.05, { x: 1, y: 0 }, 12, false);
      expect(boss.stun).toBeLessThanOrEqual(BOSS_HITSTUN);
      expect(boss.armorT).toBe(0);
      await step(sim, 3);
    }
    f.applyDamage(boss, 10, 0.05, { x: 1, y: 0 }, 12, false);
    expect(boss.stun).toBe(0);
    expect(boss.armorT).toBe(BOSS_ARMOR);
    // While breaking free, hits still hurt but no longer stun.
    const hp = boss.hp;
    f.applyDamage(boss, 10, 0.05, { x: 1, y: 0 }, 12, false);
    expect(boss.hp).toBeLessThan(hp);
    expect(boss.stun).toBe(0);
  });

  it('a boss mashed at combo / beam speed still spends most of the time acting and still lands hits', async () => {
    const { sim, f, boss } = bossArena();
    const p = f.player;
    let stunned = 0;
    let hurt = 0;
    for (let t = 0; t < 900; t++) {
      // A hit every 8 frames, from right beside it (a beam's tick rate; the A combo is slower).
      if (t % 8 === 0 && !boss.dead) f.applyDamage(boss, 1, 0.01, { x: 0, y: 0 }, 12, false);
      if (boss.stun > 0) stunned++;
      if (p.cs.hp < p.cs.hpMax) { hurt++; p.cs.hp = p.cs.hpMax; }
      p.x = boss.x - 18;
      p.y = boss.y;
      await step(sim, 1);
    }
    expect(stunned / 900).toBeLessThan(0.5);
    expect(hurt).toBeGreaterThan(0);
  });

  it('a stunned boss pauses its move instead of skipping the frame its attack fires on', async () => {
    const { sim, boss } = bossArena();
    await step(sim, 1);
    const move = boss as unknown as { move: string | null; state: string; t: number };
    move.move = 'shot';
    move.state = 'move';
    move.t = 12;
    boss.stun = 5;
    await step(sim, 5);
    expect(move.t).toBe(12);
    await step(sim, 1);
    expect(move.t).toBe(13);
  });

  it('Burning Attack holds a boss ~1.5 s (then it breaks free) and a regular enemy 4 s', async () => {
    const { sim, f, boss } = bossArena();
    const p = f.player;
    const burning = new Shot('player', 'stun', boss.x - 10, boss.y, { x: 1, y: 0 }, 3, 1, '#f0f', 20, 20);
    burning.stun = 240;
    burning.techStun = true;
    f.applyDamage(boss, burning.atk, 0.01, { x: 0, y: 0 }, burning.stun, true, burning.techStun);
    expect(boss.stun).toBe(BOSS_TECH_STUN);
    // Mashing during the hold neither extends nor breaks it early.
    for (let i = 0; i < 6; i++) f.applyDamage(boss, 1, 0.01, { x: 0, y: 0 }, 12, false);
    expect(boss.stun).toBe(BOSS_TECH_STUN);
    expect(boss.armorT).toBe(0);
    await step(sim, BOSS_TECH_STUN);
    expect(boss.stun).toBe(0);
    expect(boss.armorT).toBeGreaterThan(0);
    const wolf = f.spawnEnemy('wolf', p.x, p.y + 40);
    f.applyDamage(wolf, 1, 0.01, { x: 0, y: 0 }, 240, true, true);
    expect(wolf.stun).toBe(240);
  });

  it('the player\'s Burning Attack shot carries a 4 s technique stun', async () => {
    const sim = new Sim();
    const st = sim.game.state;
    st.join('trunks', 30);
    st.learn('trunks', 'burningAttack');
    st.data.active = 'trunks';
    sim.start('dev_arena', 4, 8);
    const f = field(sim);
    const c = f.player.cs;
    c.selected = c.techs.indexOf('burningAttack');
    f.player.dir = 'right';
    await step(sim, 1, { B: true });
    await step(sim, 1, { B: false });
    const s = f.shots.find((x) => x.kind === 'stun');
    expect(s?.stun).toBe(240);
    expect(s?.techStun).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------ balance curve

describe('late-game enemy damage and HP (Guide §6 engine curve)', () => {
  /** Average strike (mult 0.5) of an attacker stat against a hero, as a share of the hero's HP. */
  const strikeShare = (atk: number, id: 'goku', lv: number): number => {
    let hp = 0;
    let end = 0;
    for (let i = 0; i < 40; i++) {
      const c = newChar(id);
      rollToLevel(c, CHARACTERS[id].growth, lv, new Rng(77 + i * 31));
      hp += c.hpMax; end += c.end;
    }
    hp /= 40; end /= 40;
    let sum = 0;
    for (let r = 0; r < 26; r++) sum += damage({ power: ENEMY_POWER, mult: 0.5 * enemyPowerScale(atk), stat: atk, end: Math.round(end), res: 1, crit: false, r26: r });
    return sum / 26 / hp;
  };

  it('scales only past mid-game, monotonically, with a cap', () => {
    expect(enemyPowerScale(8)).toBe(1);
    expect(enemyPowerScale(28)).toBe(1);
    let last = 1;
    for (let s = 29; s <= 100; s++) { expect(enemyPowerScale(s)).toBeGreaterThanOrEqual(last); last = enemyPowerScale(s); }
    expect(enemyPowerScale(100)).toBe(2.4);
  });

  it('a tier-7 strike costs a band-start L45 hero about what a tier-2 strike costs an L9 hero', () => {
    const early = strikeShare(15, 'goku', 9);
    const late = strikeShare(64, 'goku', 45);
    expect(late / early).toBeGreaterThan(0.75);
    expect(late / early).toBeLessThan(1.25);
  });

  it('late regular enemies spawn with up to 25% less HP; bosses and early tiers keep theirs', () => {
    expect(enemyMaxHp(ENEMIES.wolf)).toBe(ENEMIES.wolf.hp);
    expect(enemyMaxHp(ENEMIES.direWolf)).toBeLessThan(ENEMIES.direWolf.hp);
    expect(enemyMaxHp(ENEMIES.direWolf)).toBeGreaterThanOrEqual(Math.round(ENEMIES.direWolf.hp * 0.75));
    const boss = Object.values(ENEMIES).find((e) => e.ai === 'boss' && Math.max(e.str, e.pow) > 60);
    expect(boss).toBeTruthy();
    if (boss) expect(enemyMaxHp(boss)).toBe(boss.hp);
    const t7 = Object.values(ENEMIES).find((e) => e.ai !== 'boss' && !e.invulnerable && Math.max(e.str, e.pow) >= 60);
    if (t7) expect(enemyMaxHp(t7)).toBe(Math.round(t7.hp * 0.75));
  });

  it('an exploder\'s death blast hits with its strongest stat, not STR+POW inside the cubic curve', async () => {
    const sim = new Sim();
    sim.game.state.join('goku', 12);
    sim.game.state.data.active = 'goku';
    sim.start('dev_arena', 4, 8);
    const f = field(sim);
    const blob = f.spawnEnemy('mudSlime', f.player.x + 12, f.player.y);
    const calls: Array<[number, number]> = [];
    const orig = f.damagePlayer.bind(f);
    f.damagePlayer = (atk, mult, x, y, o) => { calls.push([atk, mult]); return orig(atk, mult, x, y, o); };
    blob.die();
    await step(sim, 45);
    const d = ENEMIES.mudSlime;
    expect(calls).toContainEqual([Math.max(d.str, d.pow), 1.1]);
  });
});

// ------------------------------------------------------------------------------------------------ fight seal & transitions

describe('fight seal and map transitions', () => {
  it('NPCs do not talk mid-fight (A punches instead); they talk again once it is over', async () => {
    registerScripts({
      test_eng_sealedTalk: async (s) => { await s.fight('devBoss', { x: 25, y: 16, uid: 'eng_sealBoss' }); },
    });
    const sim = new Sim();
    sim.game.state.join('goku', 10);
    sim.game.state.data.active = 'goku';
    sim.start('dev_sandbox', 17, 5);
    const f = field(sim);
    const bulma = f.npcs.find((n) => n.def.id === 'bulma');
    if (!bulma) throw new Error('no bulma');
    bulma.def.wander = 0;
    const run = sim.game.runScript('test_eng_sealedTalk');
    await step(sim, 3);
    expect(f.sealed).toBe(true);
    f.player.x = bulma.x;
    f.player.y = bulma.y + 14;
    f.player.dir = 'up';
    const depth = sim.game.lockDepth;
    expect(f.tryInteract()).toBe(false);
    expect(sim.game.lockDepth).toBe(depth);
    await sim.tick(30); // the bot wins the fight
    await run;
    expect(f.sealed).toBe(false);
    f.player.x = bulma.x;
    f.player.y = bulma.y + 14;
    expect(f.tryInteract()).toBe(true);
  });

  it('a warp that slips past the seal abandons the fight cleanly instead of sealing the game forever', async () => {
    registerScripts({
      test_eng_fightHere: async (s) => { await s.fight('devBoss', { x: 14, y: 5, uid: 'eng_abBoss' }); await s.set('eng_unreachable'); },
      test_eng_warpOut: async (s) => { await s.warp('dev_sandbox', 12, 4, 'down'); },
    });
    const sim = new Sim();
    sim.game.state.join('goku', 10);
    sim.game.state.data.active = 'goku';
    sim.start('dev_arena', 4, 8);
    const warns: string[] = [];
    const keepWarn = console.warn;
    console.warn = (...a: unknown[]) => { warns.push(a.map(String).join(' ')); };
    try {
      void sim.game.runScript('test_eng_fightHere');
      await step(sim, 3);
      expect(sim.game.fightDepth).toBe(1);
      const warp = sim.game.runScript('test_eng_warpOut');
      for (let i = 0; i < 80; i++) await step(sim, 1);
      await warp;
      await step(sim, 2);
    } finally {
      console.warn = keepWarn;
    }
    const g = sim.game;
    expect(g.field?.def.id).toBe('dev_sandbox');
    expect(g.fightDepth).toBe(0);
    expect(g.lockDepth).toBe(0);
    expect(g.allowControl).toBe(false);
    expect(g.field?.sealed).toBe(false);
    expect(g.state.flag('eng_unreachable')).toBe(false);
    expect(warns.some((w) => w.includes('abandoned'))).toBe(true);
    expect(sim.errors).toEqual([]);
    // The save disc answers again.
    const f = field(sim);
    f.player.x = 12 * TILE + 8;
    f.player.y = 3 * TILE + 14;
    f.player.dir = 'up';
    expect(f.tryInteract()).toBe(true);
    await step(sim, 1);
    expect(g.scenes.top?.constructor.name).toBe('SaveMenu');
  });

  it('a warp out of an arena-sealed enemy wave (waitDefeat) also abandons it and releases the seal', async () => {
    registerScripts({
      test_eng_waveHere: async (s) => {
        s.spawnEnemy('wolf', 12, 5, 'eng_w1');
        s.spawnEnemy('wolf', 14, 5, 'eng_w2');
        s.free();
        await inArena(s, s.waitDefeat(['eng_w1', 'eng_w2']), { x0: 1, y0: 1, x1: 18, y1: 9 });
        s.set('eng_unreachable');
      },
      test_eng_waveOut: async (s) => { await s.warp('dev_sandbox', 12, 4, 'down'); },
    });
    const sim = new Sim();
    sim.game.state.join('goku', 10);
    sim.game.state.data.active = 'goku';
    sim.start('dev_arena', 4, 8);
    const keepWarn = console.warn;
    console.warn = () => undefined;
    try {
      void sim.game.runScript('test_eng_waveHere');
      await step(sim, 3);
      expect(sim.game.fightDepth).toBe(1);
      expect(field(sim).sealed).toBe(true);
      const warp = sim.game.runScript('test_eng_waveOut');
      for (let i = 0; i < 80; i++) await step(sim, 1);
      await warp;
      await step(sim, 2);
    } finally {
      console.warn = keepWarn;
    }
    const g = sim.game;
    expect(g.field?.def.id).toBe('dev_sandbox');
    expect(g.fightDepth).toBe(0);
    expect(g.lockDepth).toBe(0);
    expect(g.field?.sealed).toBe(false);
    expect(g.state.flag('eng_unreachable')).toBe(false);
    expect(sim.errors).toEqual([]);
  });

  it('nothing can hurt the player while a door / edge transition fades, so a death cannot strand the Game Over', async () => {
    const sim = new Sim();
    sim.game.state.join('goku', 10);
    sim.game.state.data.active = 'goku';
    sim.start('dev_sandbox', 5, 5);
    const f = field(sim);
    const go = sim.game.changeMap('dev_arena', 3, 5, 'right');
    await step(sim, 4);
    expect(sim.game.inTransition).toBe(true);
    expect(f.locked).toBe(true);
    expect(f.damagePlayer(999, 50, f.player.x + 5, f.player.y)).toBe(0);
    expect(f.player.cs.hp).toBe(f.player.cs.hpMax);
    for (let i = 0; i < 40; i++) await step(sim, 1);
    await go;
    expect(sim.game.inTransition).toBe(false);
    expect(sim.game.field?.def.id).toBe('dev_arena');
    expect(sim.game.lockDepth).toBe(0);
    expect(field(sim).locked).toBe(false);
  });

  it('a story warp requested during a transition waits for it instead of being dropped', async () => {
    const sim = new Sim();
    sim.start('dev_sandbox', 5, 5);
    const a = sim.game.changeMap('dev_arena', 3, 5, 'right');
    await step(sim, 2);
    const b = sim.game.changeMap('dev_sandbox', 12, 4, 'down');
    for (let i = 0; i < 80; i++) await step(sim, 1);
    await Promise.all([a, b]);
    expect(sim.game.field?.def.id).toBe('dev_sandbox');
  });
});

// ------------------------------------------------------------------------------------------------ saves & options

describe('saves, options and Game Over', () => {
  it('a run never saved does not Continue into another playthrough after a Game Over', async () => {
    const sim = new Sim();
    const old = newGame();
    old.chapter = 7;
    old.map = 'cc_yard';
    old.x = 23 * TILE + 8;
    old.y = 13 * TILE + 14;
    sim.game.saves.save(0, old);
    sim.game.slot = 0;
    sim.game.runSaved = false;
    expect(sim.game.continueAfterGameOver()).toBe(true);
    expect(sim.game.state.data.chapter).not.toBe(7);
    // With a save of this run it goes back to that save.
    sim.game.runSaved = true;
    expect(sim.game.continueAfterGameOver()).toBe(true);
    expect(sim.game.state.data.chapter).toBe(7);
    expect(sim.game.field?.def.id).toBe('cc_yard');
    sim.game.saves.erase(0);
  });

  it('options apply live, survive a reload and carry into a New Game', () => {
    const sim = new Sim();
    const g = sim.game;
    const d = g.state.data;
    d.textSpeed = 4;
    d.musicVol = 0;
    d.sfxVol = 0.2;
    g.optionsChanged();
    expect(textSettings.speed).toBe(4);
    expect(audio.musicVolume).toBe(0);
    expect(audio.sfxVolume).toBe(0.2);
    g.saves.save(1, { ...newGame(), map: 'dev_sandbox', x: 5 * TILE + 8, y: 5 * TILE + 14, textSpeed: 4, musicVol: 0, sfxVol: 0.2 });
    // Reload: a fresh session restores them before anything is played, and Continue keeps them.
    textSettings.speed = 2;
    audio.musicVolume = 0.55;
    audio.sfxVolume = 0.7;
    const again = new Sim();
    expect(textSettings.speed).toBe(4);
    expect(again.game.continueGame(1)).toBe(true);
    expect([textSettings.speed, audio.musicVolume, audio.sfxVolume]).toEqual([4, 0, 0.2]);
    expect(again.game.state.data.textSpeed).toBe(4);
    // Back to defaults for the rest of the file.
    again.game.state.data.textSpeed = 2;
    again.game.state.data.musicVol = 0.55;
    again.game.state.data.sfxVol = 0.7;
    again.game.optionsChanged();
    again.game.saves.erase(1);
  });

  it('a save made before an update loads: unknown map, missing fields, retired ids', () => {
    const d = JSON.parse(JSON.stringify(newGame())) as SaveData;
    d.map = 'removed_old_map';
    d.regions = ['spot_dev'];
    d.chars.goku.joined = true;
    d.chars.goku.techs = ['kiBlast', 'retiredTech'];
    d.chars.goku.form = 'retiredForm';
    delete (d.chars.goku as unknown as Record<string, unknown>).selected;
    delete (d.chars as unknown as Record<string, unknown>).piccolo;
    delete (d as unknown as Record<string, unknown>).scans;
    d.active = 'goku';
    const fixed = repairSave(d);
    expect(fixed.chars.goku.selected).toBe(0);
    expect(fixed.chars.goku.techs).toEqual(['kiBlast']);
    expect(fixed.chars.goku.form).toBeNull();
    expect(fixed.chars.piccolo.joined).toBe(false);
    expect(fixed.scans).toEqual([]);
    const sim = new Sim();
    sim.game.saves.save(2, d);
    expect(sim.game.continueGame(2)).toBe(true);
    expect(sim.game.field?.def.id).toBe(SPOTS.spot_dev.map);
    sim.game.saves.erase(2);
  });

  it('the main loop keeps running after a frame throws', () => {
    const g = globalThis as unknown as { requestAnimationFrame: (cb: (t: number) => void) => number };
    const keep = g.requestAnimationFrame;
    const keepErr = console.error;
    const queued: Array<(t: number) => void> = [];
    g.requestAnimationFrame = (cb) => { queued.push(cb); return queued.length; };
    console.error = () => undefined;
    try {
      let ticks = 0;
      const loop = new Loop(() => { ticks++; if (ticks === 3) throw new Error('boom'); }, () => undefined);
      loop.start();
      let now = performance.now();
      for (let i = 0; i < 10; i++) { const cb = queued.shift(); now += 1000 / 60 + 1; cb?.(now); }
      expect(ticks).toBeGreaterThan(5);
      expect(loop.errors).toBe(1);
    } finally {
      g.requestAnimationFrame = keep;
      console.error = keepErr;
    }
  });

  it('map grounds are cached LRU, not forever', () => {
    setGroundCacheLimit(8);
    const sim = new Sim();
    const maps = ['dev_sandbox', 'dev_arena', 'paozu_home', 'paozu_forest', 'paozu_house', 'cc_yard', 'cc_inside', 'satan_plaza', 'wc_streets', 'kame_island', 'lookout'];
    for (const m of maps) if (resolveMap(m)) sim.start(m);
    expect(cachedGrounds().length).toBeLessThanOrEqual(8);
    expect(cachedGrounds()).toContain(sim.game.field?.def.id);
  });
});

// ------------------------------------------------------------------------------------------------ level floors

describe('chapter level floors (LoG2: levels come from EXP)', () => {
  const api = (st: GameState): ScriptApi => ({
    state: st,
    unlockRegion: (id: string) => { if (!st.data.regions.includes(id)) st.data.regions.push(id); },
    switchTo: (id: string) => { st.data.active = id as never; },
    set: (f: string) => st.set(f),
  }) as unknown as ScriptApi;

  it('a playthrough from the prologue nets only the hero who played the last chapter, at band - 5; the bench keeps its level', () => {
    const st = new GameState();
    ensureChapterState(api(st), 0);
    expect(st.flag(STORY_RUN)).toBe(true);
    st.join('goku', 15);
    st.join('vegeta', 14);
    st.join('piccolo', 18);
    st.data.active = 'goku';
    st.data.chapter = 5;
    ensureChapterState(api(st), 6);
    expect(st.char('goku').level).toBe(CHAPTER_MIN_LEVEL[6] - HANDOVER_LEVEL_GAP);
    expect(st.char('vegeta').level).toBe(14);
    expect(st.char('piccolo').level).toBe(18);
  });

  it('a chapter started standalone still floors the whole party', () => {
    const st = new GameState();
    st.join('goku', 5);
    st.join('vegeta', 5);
    st.data.active = 'goku';
    ensureChapterState(api(st), 6);
    expect(st.char('goku').level).toBe(CHAPTER_MIN_LEVEL[6]);
    expect(st.char('vegeta').level).toBe(CHAPTER_MIN_LEVEL[6]);
  });

  it('force() lifts a benched character to band start - 3, but never below a fresh join level', () => {
    const st = new GameState();
    st.set(STORY_RUN);
    st.data.chapter = 12;
    st.join('gohan', 19);
    st.join('goku', 40);
    st.data.active = 'goku';
    force(api(st), 'gohan');
    expect(st.char('gohan').level).toBe(CHAPTER_MIN_LEVEL[12] - FORCED_LEVEL_GAP);
    expect(st.data.active).toBe('gohan');
    st.data.chapter = 5;
    st.join('piccolo', 18);
    force(api(st), 'piccolo');
    expect(st.char('piccolo').level).toBe(18);
  });

  it('Bulma\'s Scouter upgrade (unexplored areas in grey) is in place by Chapter 13', () => {
    const st = new GameState();
    ensureChapterState(api(st), 12);
    expect(st.flag('scouterPlus')).toBe(false);
    ensureChapterState(api(st), 13);
    expect(st.flag('scouterPlus')).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------ presentation

describe('presentation', () => {
  it('long choice prompts are paged so the question is on screen with the options', () => {
    const text = 'Ah, the guest who asked about the roof. A strange man in a long coat went up there an hour ago. He didn\'t use the stairs. Shall I take you?';
    let picked = -1;
    const c = new ChoiceScene({ name: 'Porter', text }, ['Go up', 'Not now'], (i) => { picked = i; });
    const sim = new Sim();
    const press = (b: Button) => { sim.input.inject(b, true); sim.input.poll(); c.update(sim.input); sim.input.inject(b, false); sim.input.poll(); c.update(sim.input); };
    const pages = (c as unknown as { pages: string[][] }).pages;
    expect(pages.length).toBeGreaterThan(1);
    // Every row of the prompt is shown exactly in order, and the last page (with the options) holds the question.
    expect(pages.slice(0, -1).flat().concat(pages[pages.length - 1]).join(' ')).toBe(wrap(text, SCREEN_W - 22).join(' '));
    expect(pages[pages.length - 1].join(' ')).toContain('Shall I take you?');
    expect(pages[pages.length - 1].length).toBe(3);
    for (let i = 0; i < pages.length - 1; i++) { expect(c.rows).toBe(pages[i]); press('A'); }
    expect(picked).toBe(-1);
    expect(c.rows).toBe(pages[pages.length - 1]);
    press('A');
    expect(picked).toBe(0);
  });

  it('the dialogue box opens at the top when the speaker stands low on screen; L/R move it', async () => {
    const sim = new Sim();
    sim.start('dev_sandbox', 17, 5);
    const f = field(sim);
    const bulma = f.npcs.find((n) => n.def.id === 'bulma');
    if (!bulma) throw new Error('no bulma');
    bulma.def.wander = 0;
    registerScripts({ test_eng_say: async (s) => { await s.say('bulma', 'Hi!'); } });
    const lineOf = () => (sim.game.scenes.top as unknown as { pages: Array<{ line: Line }> }).pages[0].line;
    bulma.y = f.camera.y + 40;
    void sim.game.runScript('test_eng_say');
    await flush();
    expect(sim.game.scenes.top).toBeInstanceOf(DialogueScene);
    expect(lineOf().top).toBeFalsy();
    await sim.tick(20);
    bulma.y = f.camera.y + SCREEN_H - 20;
    void sim.game.runScript('test_eng_say');
    await flush();
    expect(lineOf().top).toBe(true);
    const d = sim.game.scenes.top as unknown as { pos: string | null };
    sim.input.inject('R', true); sim.input.poll(); (sim.game.scenes.top as DialogueScene).update(sim.input);
    expect(d.pos).toBe('bottom');
    sim.input.inject('R', false);
  });

  it('the survival countdown sits under the HUD, clear of the technique box and the boss name', () => {
    // HUD panel y 4..26 (technique box x 76..96, y 6..18); boss name row y 4..12 and bar y 14..19.
    expect(TIMER_Y).toBeGreaterThan(26);
    const txt = 'HOLD THE LINE 0:30';
    expect(font.drawWidth(txt)).toBeLessThan(SCREEN_W - 40);
  });

  it('banner, toast, taunt and credit lines wrap inside the screen', () => {
    const lines = [
      'The glyphs pin the Commeson core in place! Smash it by hand!',
      'EXCAVATOR: OVERDRIVE ENGAGED. DEPLOYING SURVEY DRONES.',
      'Trunks: This is the hope of every person you tried to erase!',
      'Mr. Satan: World Champion, Savior of Earth, Savior of All Universes (self-declared)',
    ];
    for (const l of lines) for (const r of wrap(l, SCREEN_W - 20)) expect(font.drawWidth(r), r).toBeLessThanOrEqual(SCREEN_W - 20);
    const credits = new CreditsScene(['#LEGACY OF SUPER', '', lines[3]]);
    const rows = (credits as unknown as { lines: string[] }).lines;
    expect(rows.length).toBeGreaterThan(3);
    for (const r of rows) expect(font.drawWidth(r.replace(/^#/, ''))).toBeLessThanOrEqual(SCREEN_W - 16);
    expect(rows[0]).toBe('#LEGACY OF SUPER');
  });

  it('the pause Status page shows a story guest (Android 17) while he is played', () => {
    const sim = new Sim();
    const st = sim.game.state;
    st.join('goku', 45);
    st.join('android17', 46);
    st.data.active = 'android17';
    sim.start('dev_sandbox', 5, 5);
    const m = new PauseMenu(sim.game) as unknown as { party: Array<{ id: string }>; charIdx: number };
    expect(m.party[m.charIdx].id).toBe('android17');
  });

  it('world-map spots stand on matching terrain (islands in the sea, cities and deserts where they belong)', () => {
    const isWater = ([r, g, b]: number[]) => b > r + 60 && b > g + 30;
    for (const sp of Object.values(SPOTS)) {
      if (sp.world === 'space' || sp.toWorld) continue;
      const c = worldTexel(sp.world, sp.x, sp.y);
      const biome = spotBiome(sp);
      expect(isWater(c), `${sp.id} centre is land`).toBe(false);
      if (biome === 'island') {
        let water = 0;
        for (let a = 0; a < 16; a++) if (isWater(worldTexel(sp.world, sp.x + Math.cos(a) * 12, sp.y + Math.sin(a) * 12))) water++;
        expect(water, `${sp.id} is surrounded by sea`).toBeGreaterThan(12);
      }
      if (sp.world === 'earth' && biome === 'desert') expect(c, sp.id).toEqual([216, 184, 112]);
      if (sp.world === 'earth' && biome === 'city') expect(Math.abs(c[0] - c[2]) < 20 && c[0] > 100, `${sp.id} grey city`).toBe(true);
    }
    expect(spotBiome(SPOTS.spot_kame)).toBe('island');
    expect(spotBiome(SPOTS.spot_desert)).toBe('desert');
    expect(spotBiome(SPOTS.spot_westcity)).toBe('city');
  });

  it('the touch D-pad presses diagonals and has a small dead zone', () => {
    expect(dpadButtons(30, 0)).toEqual(['right']);
    expect(dpadButtons(0, -30)).toEqual(['up']);
    expect(dpadButtons(-30, 0)).toEqual(['left']);
    expect(dpadButtons(0, 30)).toEqual(['down']);
    expect(dpadButtons(25, -25).sort()).toEqual(['right', 'up']);
    expect(dpadButtons(-25, 25).sort()).toEqual(['down', 'left']);
    expect(dpadButtons(-25, -25).sort()).toEqual(['left', 'up']);
    expect(dpadButtons(25, 25).sort()).toEqual(['down', 'right']);
    expect(dpadButtons(2, 3)).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------ boot, title & save codes

/** Press a button for one tick, then let go for one (a tap). */
async function tap(sim: Sim, b: Button): Promise<void> {
  await step(sim, 1, { [b]: true });
  await step(sim, 1, { [b]: false });
}

/** A 2D context from the test canvas shim (drawing is a no-op; the code paths still run). */
function testCtx(): CanvasRenderingContext2D {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) throw new Error('2D context unavailable in the test shim');
  return ctx;
}

/** A save with some of everything a code has to carry: party, forms, techniques, flags of every type, quests, items. */
function richSave(): SaveData {
  const st = new GameState(newGame());
  st.join('goku', 24);
  st.join('vegeta', 21);
  st.learn('goku', 'kamehameha');
  st.char('goku').form = 'ssj';
  st.data.active = 'goku';
  st.data.chapter = 6;
  st.data.map = 'cc_yard';
  st.data.x = 23 * TILE + 8;
  st.data.y = 13 * TILE + 14;
  st.data.dir = 'left';
  st.data.playFrames = 60 * 60 * 95 + 17;
  st.set('c05_done');
  st.set('c06_counter', 42);
  st.set('c06_note', 'Bulma’s “pudding” ✓');
  st.addQuest('c06_main');
  st.completeQuest('c05_main');
  st.give('senzu', 3);
  st.give('fish', 7);
  st.data.scans = ['goku', 'beerus'];
  st.data.visited = ['paozu_home', 'cc_yard'];
  st.data.regions = ['spot_westcity'];
  st.data.textSpeed = 3;
  st.data.musicVol = 0.4;
  st.data.sfxVol = 0.9;
  return st.data;
}

/** Stand-in for the HTML code panel: hands the title queued pastes (refused ones are recorded) or records exports. */
class FakeCodeUi implements SaveCodeUi {
  readonly available = true;
  readonly exported: string[] = [];
  readonly errors: string[] = [];
  pastes: string[] = [];

  async showExport(_heading: string, code: string): Promise<void> {
    this.exported.push(code);
  }

  async promptImport<T>(_heading: string, parse: (code: string) => T): Promise<T | null> {
    // Like the panel: a refused paste shows its message and the player tries the next one, then gives up.
    for (const p of this.pastes.splice(0)) {
      try {
        return parse(p);
      } catch (err) {
        this.errors.push(err instanceof Error ? err.message : String(err));
      }
    }
    return null;
  }
}

/** A localStorage stand-in. */
function fakeLocalStorage(): Window['localStorage'] {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}

describe('save codes (export / import)', () => {
  it('export -> import round-trips a save, and pasted line breaks or spaces do not matter', () => {
    const d = richSave();
    const code = encodeSaveCode(d);
    expect(code).toMatch(/^LOS1\.[0-9a-f]{8}\.[A-Za-z0-9_-]+$/);
    expect(decodeSaveCode(code)).toEqual(d);
    const wrapped = `  ${(code.match(/.{1,40}/g) ?? []).join('\n ')}\n`;
    expect(decodeSaveCode(wrapped)).toEqual(d);
  });

  it('packs a late-game save to a fraction of its JSON size', () => {
    const st = new GameState(newGame());
    for (const id of Object.keys(CHARACTERS) as Array<keyof typeof CHARACTERS>) st.join(id, 40);
    for (let i = 0; i < 700; i++) st.set(`c${String(i % 15).padStart(2, '0')}_flag_${i}`, i % 3 === 0 ? i : true);
    for (let i = 0; i < 90; i++) st.completeQuest(`c${String(i % 15).padStart(2, '0')}_quest_${i}`);
    st.data.visited = Array.from({ length: 86 }, (_, i) => `map_${i}`);
    const json = JSON.stringify(st.data);
    const code = encodeSaveCode(st.data);
    expect(code.length).toBeLessThan(json.length * 0.55);
    expect(decodeSaveCode(code)).toEqual(st.data);
  });

  it('rejects bad codes with a reason: empty, foreign, newer, damaged, cut short, or not a valid save', () => {
    const code = encodeSaveCode(richSave());
    const reason = (text: string): string => {
      try {
        decodeSaveCode(text);
        return 'accepted';
      } catch (err) {
        return err instanceof SaveCodeError ? err.reason : `threw ${String(err)}`;
      }
    };
    const edit = (i: number): string => code.slice(0, i) + (code[i] === '0' ? '1' : '0') + code.slice(i + 1);
    expect(reason('')).toBe('empty');
    expect(reason('   \n ')).toBe('empty');
    expect(reason('hello there')).toBe('format');
    expect(reason(code.replace('LOS1.', 'LOX1.'))).toBe('format');
    expect(reason(`${code}!`)).toBe('format');
    expect(reason(code.replace(/^LOS1/, 'LOS2'))).toBe('newer');
    expect(reason(edit(6))).toBe('checksum');
    expect(reason(code.slice(0, Math.floor(code.length / 2)))).toMatch(/^(checksum|corrupt)$/);
    expect(reason(code.slice(0, -1))).toMatch(/^(checksum|corrupt)$/);
    // Every single edited character, anywhere in the code, is refused.
    for (let i = 0; i < code.length; i++) expect(reason(edit(i)), `edit at ${i}`).not.toBe('accepted');
    // Intact codes whose save this version cannot load.
    expect(reason(encodeSaveCode({ ...newGame(), version: SAVE_VERSION + 1 }))).toBe('newer');
    expect(reason(encodeSaveCode({ ...newGame(), chapter: -3 }))).toBe('invalid');
    expect(reason(encodeSaveCode({ ...newGame(), map: '' }))).toBe('invalid');
    expect(reason(encodeSaveCode({ ...newGame(), inv: { senzu: 'lots' } } as unknown as SaveData))).toBe('invalid');
    expect(reason(encodeSaveCode({ ...newGame(), journal: { c01_main: 'maybe' } } as unknown as SaveData))).toBe('invalid');
  });

  it('a save made by an older build still imports: missing fields are filled in and retired ids dropped', () => {
    const old = JSON.parse(JSON.stringify(richSave())) as SaveData;
    delete (old as unknown as Record<string, unknown>).regions;
    old.chars.goku.techs.push('retiredTech');
    const back = decodeSaveCode(encodeSaveCode(old));
    expect(back.regions).toEqual([]);
    expect(back.chars.goku.techs).not.toContain('retiredTech');
    expect(back.chars.goku.level).toBe(old.chars.goku.level);
  });
});

describe('title file screen: export and import codes', () => {
  /** A title screen using the fake code panel. */
  function titleWith(ui: SaveCodeUi): { sim: Sim; title: TitleScene } {
    const sim = new Sim();
    const title = new TitleScene(sim.game, ui);
    sim.game.scenes.replace(title);
    return { sim, title };
  }

  it('a bad code never touches the file; a good one replaces it only after the player confirms', async () => {
    const ui = new FakeCodeUi();
    const { sim, title } = titleWith(ui);
    const old = { ...newGame(), chapter: 2, map: 'cc_yard' };
    sim.game.saves.save(0, old);
    const before = window.localStorage.getItem('legacyOfSuper.slot0');
    await tap(sim, 'start');
    await tap(sim, 'A');
    await tap(sim, 'A');
    expect(title.state).toBe('fileAction');
    for (let i = 0; i < 3; i++) await tap(sim, 'down');
    // Only bad pastes, then the player gives up.
    ui.pastes = ['', 'not a code', encodeSaveCode(richSave()).slice(0, 60)];
    await tap(sim, 'A');
    await step(sim, 2);
    expect(ui.errors).toHaveLength(3);
    expect(title.state).toBe('fileAction');
    expect(window.localStorage.getItem('legacyOfSuper.slot0')).toBe(before);
    // A valid code, but "Replace File 1?" defaults to Cancel.
    const incoming = richSave();
    ui.pastes = [encodeSaveCode(incoming)];
    await tap(sim, 'A');
    await step(sim, 2);
    expect(title.state).toBe('confirmImport');
    await tap(sim, 'A');
    expect(title.state).toBe('fileAction');
    expect(window.localStorage.getItem('legacyOfSuper.slot0')).toBe(before);
    // Confirmed this time.
    ui.pastes = [encodeSaveCode(incoming)];
    await tap(sim, 'A');
    await step(sim, 2);
    await tap(sim, 'left');
    await tap(sim, 'A');
    expect(title.state).toBe('message');
    expect(sim.game.saves.load(0)).toEqual(incoming);
    sim.game.saves.erase(0);
  });

  it('Export Code hands over the file as a code, and importing it into an empty file copies the save', async () => {
    const ui = new FakeCodeUi();
    const { sim, title } = titleWith(ui);
    sim.game.saves.save(0, richSave());
    sim.game.saves.erase(1);
    await tap(sim, 'start');
    await tap(sim, 'A');
    await tap(sim, 'A');
    await tap(sim, 'down');
    await tap(sim, 'down');
    await tap(sim, 'A');
    await step(sim, 2);
    expect(ui.exported).toHaveLength(1);
    expect(title.state).toBe('fileAction');
    await tap(sim, 'B');
    await tap(sim, 'down');
    await tap(sim, 'A');
    await tap(sim, 'down');
    ui.pastes = [ui.exported[0]];
    await tap(sim, 'A');
    await step(sim, 2);
    expect(title.state).toBe('message');
    expect(sim.game.saves.load(1)).toEqual(sim.game.saves.load(0));
    // Continue from the imported copy.
    await tap(sim, 'A');
    await tap(sim, 'A');
    await tap(sim, 'A');
    expect(sim.game.field?.def.id).toBe('cc_yard');
    expect(sim.game.slot).toBe(1);
    sim.game.saves.erase(0);
    sim.game.saves.erase(1);
  });
});

describe('browser storage', () => {
  it('the first save asks the browser to keep storage, once per session, and not when already granted', async () => {
    const persist = vi.fn(async () => true);
    const svc = new SaveService(new BrowserStorage({ localStorage: fakeLocalStorage(), storageManager: { persist, persisted: async () => false } }));
    expect(persist).not.toHaveBeenCalled();
    expect(svc.save(0, newGame())).toBe(true);
    expect(svc.save(1, newGame())).toBe(true);
    await flush();
    expect(persist).toHaveBeenCalledTimes(1);
    const again = vi.fn(async () => true);
    const granted = new SaveService(new BrowserStorage({ localStorage: fakeLocalStorage(), storageManager: { persist: again, persisted: async () => true } }));
    granted.save(0, newGame());
    await flush();
    expect(again).not.toHaveBeenCalled();
    // An older browser without a StorageManager, or one that throws, still saves.
    expect(new SaveService(new BrowserStorage({ localStorage: fakeLocalStorage() })).save(0, newGame())).toBe(true);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const flaky = new BrowserStorage({ localStorage: fakeLocalStorage(), storageManager: { persist: async () => { throw new Error('denied'); } } });
      expect(new SaveService(flaky).save(0, newGame())).toBe(true);
      await expect(flaky.requestPersistence()).resolves.toBe(false);
    } finally {
      warn.mockRestore();
    }
  });

  it('blocked localStorage keeps the game playable for the session and says so on the title and after saving', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const drawn: string[] = [];
    const spy = vi.spyOn(font, 'drawCentered').mockImplementation((_ctx, text) => { drawn.push(text); });
    try {
      const blocked: StorageHost = { get localStorage(): Window['localStorage'] { throw new Error('SecurityError: storage disabled'); } };
      const store = new BrowserStorage(blocked);
      expect(store.persistent).toBe(false);
      const svc = new SaveService(store);
      expect(svc.persistent).toBe(false);
      expect(svc.save(0, { ...newGame(), chapter: 4 })).toBe(true);
      expect(svc.load(0)?.chapter).toBe(4);
      // A localStorage that refuses writes (quota 0 in some private modes) counts as blocked too.
      const readOnly = fakeLocalStorage();
      readOnly.setItem = () => { throw new Error('QuotaExceededError'); };
      expect(new BrowserStorage({ localStorage: readOnly }).persistent).toBe(false);
      expect(new BrowserStorage({ localStorage: fakeLocalStorage() }).persistent).toBe(true);

      const sim = new Sim();
      const ctx = testCtx();
      new TitleScene(sim.game, new FakeCodeUi()).render(ctx);
      expect(drawn.some((t) => /saves end with this tab/.test(t))).toBe(false);
      (sim.game as unknown as { saves: SaveService }).saves = svc;
      new TitleScene(sim.game, new FakeCodeUi()).render(ctx);
      expect(drawn.some((t) => /saves end with this tab/.test(t))).toBe(true);
      const menu = new SaveMenu(sim.game);
      (menu as unknown as { mode: string }).mode = 'saved';
      menu.render(ctx);
      expect(drawn).toContain('(until this tab closes)');
    } finally {
      spy.mockRestore();
      warn.mockRestore();
    }
  });
});

describe('boot sequence (LoG2 §8.1: opening, title, attract loop)', () => {
  it('a cold boot plays the splash, the story and the hero panels, then lands on PRESS START by itself', async () => {
    const sim = new Sim();
    const intro = new IntroScene(sim.game, { splash: true });
    sim.game.scenes.replace(intro);
    const ctx = testCtx();
    const seen: string[] = [];
    const tracks = new Set<string>();
    for (let i = 0; i < intro.length + 2 && sim.game.scenes.top === intro; i++) {
      if (seen[seen.length - 1] !== intro.shotId) seen.push(intro.shotId);
      if (i % 9 === 0) sim.game.scenes.render(ctx);
      if (audio.playing) tracks.add(audio.playing);
      await step(sim);
    }
    expect(seen).toEqual(['splash', 'notice', 'peace', 'friends', 'space', 'wake', 'destroyer', 'heroes']);
    expect(intro.done).toBe(true);
    const title = sim.game.scenes.top;
    expect(title).toBeInstanceOf(TitleScene);
    expect((title as TitleScene).state).toBe('press');
    expect([...tracks].filter((t) => !TRACKS[t])).toEqual([]);
    expect(tracks.has('beerusPlanet')).toBe(true);
    expect(sim.errors).toEqual([]);
  });

  it('every opening caption fits in one LoG2 text box', () => {
    const layout = new IntroScene(new Sim().game, { splash: true }).captionLayout();
    expect(layout.length).toBeGreaterThanOrEqual(10);
    for (const c of layout) expect(c.rows, `${c.shot}: ${c.text}`).toBeLessThanOrEqual(CAPTION_ROWS);
  });

  it('A or Start skips to the title from any point, without the same press opening the title menu', async () => {
    for (const [button, at] of [['A', 1], ['start', 40], ['A', 700], ['start', 2000]] as const) {
      const sim = new Sim();
      const intro = new IntroScene(sim.game, { splash: true });
      sim.game.scenes.replace(intro);
      await step(sim, at);
      expect(sim.game.scenes.top).toBe(intro);
      await step(sim, 3, { [button]: true });
      const title = sim.game.scenes.top;
      expect(title, `${button} at ${at}`).toBeInstanceOf(TitleScene);
      expect((title as TitleScene).state).toBe('press');
      await step(sim, 1, { [button]: false });
    }
  });

  it('a returning player gets from a cold boot to Continue in five presses', async () => {
    const sim = new Sim();
    const save = { ...newGame(), chapter: 7, map: 'cc_yard', x: 23 * TILE + 8, y: 13 * TILE + 14 };
    save.chars.goku.joined = true;
    save.active = 'goku';
    sim.game.saves.save(0, save);
    sim.game.scenes.replace(new IntroScene(sim.game, { splash: true }));
    await step(sim, 30);
    for (const b of ['start', 'start', 'A', 'A', 'A'] as const) await tap(sim, b);
    expect(sim.game.field?.def.id).toBe('cc_yard');
    expect(sim.game.state.data.chapter).toBe(7);
    sim.game.saves.erase(0);
  });

  it('left idle at PRESS START the title replays the opening (no splash); input or the file screen holds it', async () => {
    const sim = new Sim();
    sim.game.toTitle();
    const title = sim.game.scenes.top as TitleScene;
    await step(sim, ATTRACT_IDLE_FRAMES - 60);
    await tap(sim, 'left');
    await step(sim, ATTRACT_IDLE_FRAMES - 10);
    expect(sim.game.scenes.top).toBe(title);
    await step(sim, 20);
    const replay = sim.game.scenes.top;
    expect(replay).toBeInstanceOf(IntroScene);
    expect((replay as IntroScene).shotId).toBe('peace');
    await step(sim, (replay as IntroScene).length + 2);
    const back = sim.game.scenes.top as TitleScene;
    expect(back).toBeInstanceOf(TitleScene);
    await tap(sim, 'start');
    await tap(sim, 'A');
    expect(back.state).toBe('files');
    await step(sim, ATTRACT_IDLE_FRAMES + 30);
    expect(sim.game.scenes.top).toBe(back);
  });
});

describe('save codes and storage: hardening', () => {
  it('an intact code whose characters carry impossible values is refused before it can reach a file', () => {
    const reason = (d: unknown): string => {
      try {
        decodeSaveCode(encodeSaveCode(d as SaveData));
        return 'accepted';
      } catch (err) {
        return err instanceof SaveCodeError ? err.reason : `threw ${String(err)}`;
      }
    };
    const withGoku = (patch: Record<string, unknown>): SaveData => {
      const d = richSave();
      Object.assign(d.chars.goku, patch);
      return d;
    };
    expect(reason(richSave())).toBe('accepted');
    expect(reason(withGoku({ level: 99 }))).toBe('invalid');
    expect(reason(withGoku({ level: 0 }))).toBe('invalid');
    expect(reason(withGoku({ level: 12.5 }))).toBe('invalid');
    expect(reason(withGoku({ exp: -40 }))).toBe('invalid');
    expect(reason(withGoku({ hpMax: '900' }))).toBe('invalid');
    expect(reason(withGoku({ joined: 'yes' }))).toBe('invalid');
    expect(reason(withGoku({ techs: 'kamehameha' }))).toBe('invalid');
    expect(reason(withGoku({ form: 7 }))).toBe('invalid');
    expect(reason(withGoku({ outfit: 3 }))).toBe('invalid');
    // A real story costume and a character missing fields added later still import.
    expect(reason(withGoku({ outfit: 'gokuGi' }))).toBe('accepted');
    const partial = JSON.parse(JSON.stringify(richSave())) as SaveData;
    delete (partial.chars.goku as unknown as Record<string, unknown>).trophy;
    expect(decodeSaveCode(encodeSaveCode(partial)).chars.goku.trophy).toBe(false);
  });

  it('a localStorage that can be read but not written keeps existing files visible and deletions real', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const ls = fakeLocalStorage();
      const writable = new SaveService(new BrowserStorage({ localStorage: ls }));
      const old = { ...newGame(), chapter: 9 };
      writable.save(0, old);
      writable.save(1, { ...newGame(), chapter: 3 });
      const before0 = ls.getItem('legacyOfSuper.slot0');
      // The quota fills up (or a private mode allows reads only): writes now throw.
      const realSet = ls.setItem.bind(ls);
      ls.setItem = () => { throw new Error('QuotaExceededError'); };
      const store = new BrowserStorage({ localStorage: ls });
      const svc = new SaveService(store);
      expect(store.persistent).toBe(false);
      expect(svc.load(0)?.chapter).toBe(9);
      // Saving still works for the session, without touching what is stored.
      expect(svc.save(0, { ...newGame(), chapter: 10 })).toBe(true);
      expect(svc.load(0)?.chapter).toBe(10);
      expect(ls.getItem('legacyOfSuper.slot0')).toBe(before0);
      // Deleting a file removes it for good (removal frees space, so the browser allows it).
      svc.erase(1);
      expect(svc.load(1)).toBeNull();
      expect(ls.getItem('legacyOfSuper.slot1')).toBeNull();
      ls.setItem = realSet;
      expect(new SaveService(new BrowserStorage({ localStorage: ls })).load(0)?.chapter).toBe(9);
    } finally {
      warn.mockRestore();
    }
  });
});

// ------------------------------------------------------------------------------------------------ save-code panel (DOM)

/** The parts of a DOM event the save-code panel reads or calls. */
interface PanelEvent {
  type: string;
  target: unknown;
  key: string;
  repeat: boolean;
  shiftKey: boolean;
  isComposing: boolean;
  defaultPrevented: boolean;
  propagationStopped: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}

/** Stand-in for the few DOM element features the save-code panel uses (the test shim has no DOM). */
class PanelEl {
  hidden = false;
  textContent = '';
  readonly classes = new Set<string>();
  readonly classList = {
    toggle: (c: string, on?: boolean): boolean => {
      const v = on ?? !this.classes.has(c);
      if (v) this.classes.add(c);
      else this.classes.delete(c);
      return v;
    },
  };
  private readonly handlers = new Map<string, Array<(e: PanelEvent) => void>>();

  constructor(readonly doc: PanelDoc) {}

  addEventListener(type: string, fn: (e: PanelEvent) => void): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), fn]);
  }

  /** Fire an event at this element (for bubbling ones, at the panel root with `target` set to the inner element). */
  dispatch(type: string, init: Partial<Pick<PanelEvent, 'target' | 'key' | 'repeat' | 'shiftKey'>> = {}): PanelEvent {
    const e: PanelEvent = {
      type, target: init.target ?? this, key: init.key ?? '', repeat: init.repeat ?? false, shiftKey: init.shiftKey ?? false,
      isComposing: false, defaultPrevented: false, propagationStopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.propagationStopped = true; },
    };
    for (const fn of this.handlers.get(type) ?? []) fn(e);
    return e;
  }

  focus(): void {
    this.doc.activeElement = this;
    this.dispatch('focus');
  }

  blur(): void {
    if (this.doc.activeElement === this) this.doc.activeElement = this.doc.body;
  }
}

class PanelForm extends PanelEl {}
class PanelButton extends PanelEl {}
class PanelTextArea extends PanelEl {
  value = '';
  readOnly = false;
  placeholder = '';
  /** The whole value is selected (ready to copy). */
  selected = false;
  scrollTop = 0;
  select(): void {
    this.selected = true;
  }
  setSelectionRange(start: number, end: number): void {
    this.selected = start === 0 && end === this.value.length;
  }
}

/** The page around the panel: #code-panel and its parts, focus, and execCommand. */
class PanelDoc {
  activeElement: PanelEl;
  readonly body: PanelEl;
  readonly els: Record<string, PanelEl>;
  readonly execCommand = vi.fn((_cmd: string) => true);

  constructor() {
    this.body = new PanelEl(this);
    this.activeElement = this.body;
    this.els = {
      'code-panel': new PanelEl(this), 'code-form': new PanelForm(this), 'code-title': new PanelEl(this),
      'code-help': new PanelEl(this), 'code-text': new PanelTextArea(this), 'code-status': new PanelEl(this),
      'code-copy': new PanelButton(this), 'code-ok': new PanelButton(this), 'code-close': new PanelButton(this),
    };
    this.els['code-panel'].hidden = true;
  }

  getElementById(id: string): PanelEl | null {
    return this.els[id] ?? null;
  }

  get text(): PanelTextArea {
    return this.els['code-text'] as PanelTextArea;
  }
}

describe('save-code panel and opening: details', () => {
  /** Swap in the stand-in DOM (and a clipboard) for one test. */
  function withPanelDom(clipboard: { writeText(s: string): Promise<void> } | null): PanelDoc {
    const doc = new PanelDoc();
    vi.stubGlobal('document', doc);
    vi.stubGlobal('HTMLElement', PanelEl);
    vi.stubGlobal('HTMLFormElement', PanelForm);
    vi.stubGlobal('HTMLButtonElement', PanelButton);
    vi.stubGlobal('HTMLTextAreaElement', PanelTextArea);
    vi.stubGlobal('navigator', clipboard ? { clipboard } : {});
    return doc;
  }

  it('Export shows the code selected in the box (not on a button), copies it, and ignores a held Start', async () => {
    const writeText = vi.fn(async (_s: string) => undefined);
    const doc = withPanelDom({ writeText });
    try {
      const ui = new DomSaveCodeUi();
      expect(ui.available).toBe(true);
      const code = encodeSaveCode(richSave());
      let closed = false;
      const shown = ui.showExport('File 1 save code', code).then(() => { closed = true; });
      const root = doc.els['code-panel'];
      expect(root.hidden).toBe(false);
      expect(doc.text.value).toBe(code);
      expect(doc.text.readOnly).toBe(true);
      // Focus sits on the selected code: releasing the Space (A) that opened the panel cannot click Close.
      expect(doc.activeElement).toBe(doc.text);
      expect(doc.text.selected).toBe(true);
      expect(doc.els['code-ok'].hidden).toBe(true);
      expect(doc.els['code-copy'].hidden).toBe(false);
      await flush();
      expect(writeText).toHaveBeenCalledWith(code);
      expect(doc.els['code-status'].textContent).toBe('Copied to the clipboard.');
      // Start (Enter) still held from opening the panel auto-repeats into it: nothing happens, and the game never sees it.
      const held = root.dispatch('keydown', { key: 'Enter', target: doc.text, repeat: true });
      expect(held.propagationStopped).toBe(true);
      await flush();
      expect(closed).toBe(false);
      expect(root.hidden).toBe(false);
      // A click on the dimmed backdrop keeps the focus in the panel.
      doc.text.blur();
      const click = root.dispatch('mousedown', { target: root });
      expect(click.defaultPrevented).toBe(true);
      expect(doc.activeElement).toBe(doc.text);
      // A fresh Enter closes it and clears the box.
      root.dispatch('keydown', { key: 'Enter', target: doc.text });
      await shown;
      expect(closed).toBe(true);
      expect(root.hidden).toBe(true);
      expect(doc.text.value).toBe('');
      expect(doc.activeElement).toBe(doc.body);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('Copy falls back to selecting the code when the clipboard API is missing (plain-http LAN play)', async () => {
    const doc = withPanelDom(null);
    try {
      const ui = new DomSaveCodeUi();
      const shown = ui.showExport('File 2 save code', 'LOS1.00000000.AA');
      await flush();
      expect(doc.els['code-status'].textContent).toMatch(/Press Copy/);
      doc.els['code-copy'].dispatch('click');
      await flush();
      expect(doc.execCommand).toHaveBeenCalledWith('copy');
      expect(doc.els['code-status'].textContent).toBe('Copied to the clipboard.');
      doc.els['code-close'].dispatch('click');
      await shown;
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('Import keeps typing away from the game, refuses bad pastes in place, and returns a good one or null', async () => {
    const doc = withPanelDom(null);
    try {
      const ui = new DomSaveCodeUi();
      const root = doc.els['code-panel'];
      const save = richSave();
      const got = ui.promptImport('Import a save code into File 1', decodeSaveCode);
      expect(root.hidden).toBe(false);
      expect(doc.text.readOnly).toBe(false);
      expect(doc.activeElement).toBe(doc.text);
      expect(doc.els['code-ok'].hidden).toBe(false);
      expect(doc.els['code-copy'].hidden).toBe(true);
      // Keys typed into the box (Z, Space, WASD are game buttons) stop at the panel.
      for (const key of ['z', ' ', 'w', 'Backspace']) expect(root.dispatch('keydown', { key, target: doc.text }).propagationStopped).toBe(true);
      doc.text.value = 'not a code';
      doc.els['code-form'].dispatch('submit');
      expect(root.hidden).toBe(false);
      expect(doc.els['code-status'].textContent).toMatch(/not a Legacy of Super save code/);
      expect(doc.els['code-status'].classes.has('error')).toBe(true);
      doc.text.value = encodeSaveCode(save).replace(/(.{30})/g, '$1\n');
      root.dispatch('keydown', { key: 'Enter', target: doc.text });
      expect(await got).toEqual(save);
      expect(root.hidden).toBe(true);
      // Esc cancels with nothing imported.
      const cancelled = ui.promptImport('Import a save code into File 2', decodeSaveCode);
      expect(doc.els['code-status'].textContent).toBe('');
      doc.text.value = encodeSaveCode(save);
      root.dispatch('keydown', { key: 'Escape', target: doc.text });
      expect(await cancelled).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('a page without the panel reports it unavailable instead of hanging the title', async () => {
    vi.stubGlobal('document', { getElementById: () => null });
    try {
      const ui = new DomSaveCodeUi();
      expect(ui.available).toBe(false);
      await expect(ui.promptImport('Import', decodeSaveCode)).resolves.toBeNull();
      await expect(ui.showExport('Export', 'LOS1.00000000.AA')).resolves.toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('cancelling "Replace File N?" goes back to the file actions with the cursor still on Import Code', async () => {
    const ui = new FakeCodeUi();
    const sim = new Sim();
    const old = { ...newGame(), chapter: 2, map: 'cc_yard' };
    sim.game.saves.save(0, old);
    const before = window.localStorage.getItem('legacyOfSuper.slot0');
    const title = new TitleScene(sim.game, ui);
    sim.game.scenes.replace(title);
    await tap(sim, 'start');
    await tap(sim, 'A');
    await tap(sim, 'A');
    for (let i = 0; i < 3; i++) await tap(sim, 'down');
    const code = encodeSaveCode(richSave());
    // B, then Cancel with A: each time a plain A goes straight back into Import Code.
    for (const answer of ['B', 'A'] as const) {
      ui.pastes = [code];
      await tap(sim, 'A');
      await step(sim, 2);
      expect(title.state).toBe('confirmImport');
      await tap(sim, answer);
      expect(title.state).toBe('fileAction');
    }
    ui.pastes = [code];
    await tap(sim, 'A');
    await step(sim, 2);
    expect(title.state).toBe('confirmImport');
    await tap(sim, 'B');
    expect(window.localStorage.getItem('legacyOfSuper.slot0')).toBe(before);
    sim.game.saves.erase(0);
  });

  it('a paste that starts like a code but was cut off or picked up stray characters is told so', () => {
    const code = encodeSaveCode(richSave());
    const message = (text: string): string => {
      try {
        decodeSaveCode(text);
        return 'accepted';
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    };
    for (const mangled of [`${code}.`, `"${code}"`.slice(1), code.slice(0, 10), code.replace(/-/g, '+').replace(/_/g, '/') + '+/']) {
      expect(message(mangled), mangled.slice(0, 24)).toMatch(/cut short or has extra characters/);
    }
    expect(message('hello there')).toMatch(/Codes start with "LOS"/);
  });

  it('the Paozu shot keeps the radish field and both farmers in view above the caption box', () => {
    // At least two furrow rows (7 px apart, the first 5 px in) show between the horizon and the box.
    expect(FIELD_TOP + 5 + 7 + 3).toBeLessThan(CAPTION_TOP);
    for (const y of [GOKU_Y, GOTEN_Y]) {
      expect(y + HUMANOID_H).toBeLessThanOrEqual(CAPTION_TOP);
      expect(y + HUMANOID_H).toBeGreaterThan(FIELD_TOP);
    }
  });
});
