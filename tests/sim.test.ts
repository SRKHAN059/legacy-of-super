import { describe, expect, it } from 'vitest';
import { Sim } from './sim';

describe('headless sim', () => {
  it('runs a scripted boss fight to its scripted end and applies rewards', async () => {
    const sim = new Sim();
    sim.start('dev_arena', 5, 5);
    await sim.tick(5);
    const before = sim.game.state.hero.exp;
    const ok = await sim.run('dev_boss');
    expect(ok).toBe(true);
    expect(sim.errors).toEqual([]);
    expect(sim.game.state.data.journal.dev_q1).toBe('done');
    expect(sim.game.state.hero.exp).toBeGreaterThan(before);
  });

  it('reports a missing actor as an error', async () => {
    const { registerScripts } = await import('../src/game/script');
    registerScripts({ test_bad: async (s) => { s.face('nobody', 'up'); } });
    const sim = new Sim();
    sim.start('dev_arena');
    await sim.run('test_bad');
    expect(sim.errors.join('\n')).toContain('nobody');
  });
});
