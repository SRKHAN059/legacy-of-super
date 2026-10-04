import { describe, expect, it } from 'vitest';
import { CHAPTER_MIN_LEVEL, ensureChapterState, force, FORCED_LEVEL_GAP, STORY_RUN } from '../src/content/chapters/common';
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
import { GameState, newChar, newGame, repairSave, type SaveData } from '../src/game/state';
import { cachedGrounds, setGroundCacheLimit } from '../src/game/world';
import { CreditsScene } from '../src/ui/credits';
import { ChoiceScene, DialogueScene, textSettings, type Line } from '../src/ui/dialogue';
import { PauseMenu } from '../src/ui/pause';
import { spotBiome, worldTexel } from '../src/ui/worldmap';
import { CHARACTERS } from '../src/content/characters';
import { Rng } from '../src/engine/math';
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

  it('a playthrough from the prologue lifts only the hero who played the last chapter; the bench keeps its level', () => {
    const st = new GameState();
    ensureChapterState(api(st), 0);
    expect(st.flag(STORY_RUN)).toBe(true);
    st.join('goku', 18);
    st.join('vegeta', 14);
    st.join('piccolo', 18);
    st.data.active = 'goku';
    st.data.chapter = 5;
    ensureChapterState(api(st), 6);
    expect(st.char('goku').level).toBe(CHAPTER_MIN_LEVEL[6]);
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
