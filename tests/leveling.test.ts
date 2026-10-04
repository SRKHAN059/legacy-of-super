import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../src/content/characters';
import { Rng } from '../src/engine/math';
import { critChance, damage, EXP_TABLE, expFraction, expToNext, killExp, levelForExp, levelUp, MAX_LEVEL, rollToLevel, STAT_CAP, statCurve } from '../src/game/leveling';
import { GameState, newChar, newGame, SaveService } from '../src/game/state';
import { MemoryStorage } from '../src/game/storage';

describe('EXP table', () => {
  it('matches LoG2 anchor thresholds', () => {
    expect(EXP_TABLE[2]).toBe(50);
    expect(EXP_TABLE[10]).toBe(4350);
    expect(EXP_TABLE[18]).toBe(35750);
    expect(EXP_TABLE[27]).toBe(212875);
    expect(EXP_TABLE[35]).toBe(1045400);
    expect(EXP_TABLE[41]).toBe(3335510);
    expect(EXP_TABLE[3]).toBe(150);
    expect(EXP_TABLE[MAX_LEVEL]).toBe(22965105);
  });

  it('is strictly increasing', () => {
    for (let l = 2; l <= MAX_LEVEL; l++) expect(EXP_TABLE[l]).toBeGreaterThan(EXP_TABLE[l - 1]);
  });

  it('maps exp to level and next', () => {
    expect(levelForExp(0)).toBe(1);
    expect(levelForExp(49)).toBe(1);
    expect(levelForExp(50)).toBe(2);
    expect(levelForExp(99_999_999)).toBe(MAX_LEVEL);
    expect(expToNext(1, 20)).toBe(30);
    expect(expToNext(MAX_LEVEL, 1)).toBe(0);
    expect(expFraction(1, 25)).toBeCloseTo(0.5);
  });
});

describe('level-up algorithm', () => {
  it('grows HP by 5.49-7.49% and EP by 2-4', () => {
    const rng = new Rng(1234);
    for (let i = 0; i < 200; i++) {
      const c = newChar('gohan');
      const hp0 = c.hpMax;
      const ep0 = c.epMax;
      const r = levelUp(c, CHARACTERS.gohan.growth, rng);
      expect(r.hp).toBeGreaterThanOrEqual(Math.floor((hp0 * 3604) / 65536));
      expect(r.hp).toBeLessThanOrEqual(Math.floor((hp0 * 4914) / 65536));
      expect(c.epMax - ep0).toBeGreaterThanOrEqual(2);
      expect(c.epMax - ep0).toBeLessThanOrEqual(4);
    }
  });

  it('reproduces LoG2 join ranges for Vegeta at L18', () => {
    const rng = new Rng(99);
    for (let i = 0; i < 50; i++) {
      const c = newChar('vegeta');
      rollToLevel(c, CHARACTERS.vegeta.growth, 18, rng);
      expect(c.level).toBe(18);
      expect(c.hpMax).toBeGreaterThanOrEqual(260);
      expect(c.hpMax).toBeLessThanOrEqual(320);
      expect(c.epMax).toBeGreaterThanOrEqual(54);
      expect(c.epMax).toBeLessThanOrEqual(88);
      expect(c.str).toBeGreaterThanOrEqual(21);
      expect(c.str).toBeLessThanOrEqual(34);
    }
  });

  it('never exceeds the stat cap', () => {
    const rng = new Rng(7);
    const c = newChar('gohan');
    c.str = 99;
    rollToLevel(c, CHARACTERS.gohan.growth, MAX_LEVEL, rng);
    expect(c.str).toBe(STAT_CAP);
  });
});

describe('damage (ROM formula)', () => {
  it('matches the documented f(S) values', () => {
    expect(statCurve(1)).toBe(448);
    expect(statCurve(10)).toBe(4344);
    expect(statCurve(50)).toBe(28431);
    expect(statCurve(100)).toBe(119342); // 30551800 >> 8 (the research note rounded up)
  });

  it('lands near LoG2 observations (L41 Goku vs Cooler ~100-125)', () => {
    const d = damage({ power: 1200, mult: 1, stat: 77, end: 79, res: 1, crit: false, r26: 13 });
    expect(d).toBeGreaterThan(95);
    expect(d).toBeLessThan(140);
    const crit = damage({ power: 1200, mult: 1, stat: 77, end: 79, res: 1, crit: true, r26: 13 });
    expect(crit).toBeGreaterThanOrEqual(d * 2 - 1);
  });

  it('respects resistances and floors at 1', () => {
    const full = damage({ power: 1200, mult: 1, stat: 40, end: 20, res: 1, crit: false, r26: 0 });
    const half = damage({ power: 1200, mult: 1, stat: 40, end: 20, res: 0.5, crit: false, r26: 0 });
    expect(half).toBe(Math.floor(full / 2) || 1);
    expect(damage({ power: 0, mult: 0, stat: 1, end: 100, res: 1, crit: false, r26: 0 })).toBe(1);
  });

  it('crit chance is STR/400', () => {
    expect(critChance(100)).toBeCloseTo(0.25, 2);
  });
});

describe('kill EXP clamp', () => {
  it('clamps to [span/128, span/2] and pays nothing at 50', () => {
    expect(killExp(5, 10)).toBe(5);
    expect(killExp(10, 30)).toBe((EXP_TABLE[31] - EXP_TABLE[30]) >> 7);
    expect(killExp(10_000_000, 3)).toBe((EXP_TABLE[4] - EXP_TABLE[3]) >> 1);
    expect(killExp(500, MAX_LEVEL)).toBe(0);
  });
});

describe('GameState', () => {
  it('evaluates conditions', () => {
    const g = new GameState(newGame());
    g.set('metBeerus');
    g.data.chapter = 3;
    g.give('senzu', 2, 3);
    expect(g.check('metBeerus')).toBe(true);
    expect(g.check('!metBeerus')).toBe(false);
    expect(g.check('chapter>=3&has:senzu')).toBe(true);
    expect(g.check('chapter<3')).toBe(false);
  });

  it('clamps inventory to max', () => {
    const g = new GameState(newGame());
    expect(g.give('senzu', 5, 3)).toBe(3);
    expect(g.take('senzu', 4)).toBe(false);
    expect(g.take('senzu', 3)).toBe(true);
    expect(g.count('senzu')).toBe(0);
  });

  it('levels up through gainExp and refills HP/EP', () => {
    const g = new GameState(newGame());
    g.join('goku', 1);
    g.char('goku').hp = 1;
    const ups = g.gainExp('goku', 1000);
    expect(ups.length).toBe(5);
    expect(g.char('goku').level).toBe(6);
    expect(g.char('goku').hp).toBe(g.char('goku').hpMax);
  });

  it('joins at a level with matching exp', () => {
    const g = new GameState(newGame());
    g.join('vegeta', 18);
    expect(g.char('vegeta').level).toBe(18);
    expect(g.char('vegeta').exp).toBe(EXP_TABLE[18]);
    expect(g.party.map((c) => c.id)).toContain('vegeta');
  });
});

describe('SaveService', () => {
  it('round-trips a save and rejects corrupt data', () => {
    const store = new MemoryStorage();
    const svc = new SaveService(store);
    const d = newGame();
    d.flags.test = 5;
    expect(svc.save(0, d)).toBe(true);
    expect(svc.load(0)?.flags.test).toBe(5);
    store.set('legacyOfSuper.slot1', '{not json');
    expect(svc.load(1)).toBeNull();
    expect(svc.load(2)).toBeNull();
    svc.erase(0);
    expect(svc.load(0)).toBeNull();
  });
});
